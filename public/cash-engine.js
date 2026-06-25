'use strict';

/* ── CashEngine — shared cash-recovery computations ──────────────────────────
   Cash Recovery is the third financial lever (Profit = margin, Revenue = top
   line, Cash = liquidity). It reads data that already lives in Control + Books
   and answers two questions: how much working capital is trapped on the shelf
   right now, and is the cash coming in this week enough to cover what is going
   out. Every cash screen (Close The Week, Forecast, Trapped Cash, Purchasing,
   Position, Audit) reads from here so the numbers never drift screen to screen.
   Nothing here writes; it only computes off the live stores. */

window.CashEngine = {
  // ── Source reads (all guarded; empty data returns empty, never throws) ─────
  products()    { return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false); },
  productById(id){ return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id); },
  counts()      { return ((App.inventoryData && App.inventoryData.ic_counts) || []); },
  deliveries()  { return ((App.inventoryData && App.inventoryData.ic_deliveries) || []); },
  vendors()     { return ((App.inventoryData && App.inventoryData.ic_vendors) || []); },
  bills()       { return (App.data && Array.isArray(App.data.operating_expenses)) ? App.data.operating_expenses : []; },

  countsAsc() {
    return [...this.counts()].sort((a, b) =>
      new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
  },

  // Perpetual on-hand quantity + dollar value per product (last counted value
  // per product/location, carried forward; same basis as the Inventory cockpit).
  onHand() {
    const perp = App._perpetualInventory();
    const oh = {}; let value = 0;
    Object.keys(perp).forEach(pid => { oh[pid] = perp[pid].onHand; value += (perp[pid].value || 0); });
    return { oh, value };
  },

  // Usage between the last two counts, the velocity behind dead/slow + weeks-on-hand.
  usageBase() {
    const asc = this.countsAsc();
    const latest = asc.length ? asc[asc.length - 1] : null;
    const prev = asc.length >= 2 ? asc[asc.length - 2] : null;
    if (!(latest && prev)) return null;
    return App.computeUsagePair(prev, latest, this.deliveries());
  },

  // ── Trapped cash: dead stock (no usage) at full value + the over-par excess
  //    on everything still moving. One number per product so nothing double
  //    counts (a dead item is counted as dead, not also as over-par). ─────────
  trapped() {
    const base = this.usageBase();
    const { oh } = this.onHand();
    const items = [];
    let dead = 0, overPar = 0;
    Object.keys(oh).forEach(pid => {
      const p = this.productById(pid); if (!p) return;
      const qty = oh[pid]; if (!(qty > 0)) return;
      const uc = App.unitCost(p) || 0;
      const tied = qty * uc;
      const used = base && base[pid] ? Math.max(0, base[pid].rawUsed) : null;
      const par = parseFloat(p.par_level);
      if (base && used !== null && used <= 0.001 && tied >= 15) {
        dead += tied;
        items.push({ p, name: p.name, kind: 'dead', free: tied, tied, oh: qty });
      } else if (!isNaN(par) && par > 0 && qty > par) {
        const excess = (qty - par) * uc;
        if (excess >= 15) { overPar += excess; items.push({ p, name: p.name, kind: 'over', free: excess, tied, oh: qty, par }); }
      }
    });
    items.sort((a, b) => b.free - a.free);
    return { total: dead + overPar, dead, overPar, items, hasData: !!base };
  },

  // ── Over-ordering: how many weeks of inventory you are sitting on versus a
  //    target supply, and the cash tied up beyond it. ───────────────────────
  overOrder(targetWeeks) {
    targetWeeks = targetWeeks || 3;
    const base = this.usageBase();
    const { value } = this.onHand();
    if (!base) return { weeksOnHand: null, value, excess: 0, targetWeeks, weeklyCogs: null, hasData: false };
    const asc = this.countsAsc();
    const latest = asc[asc.length - 1], prev = asc[asc.length - 2];
    const periodCost = Object.values(base).reduce((s, b) => s + (b.unitCost != null ? Math.max(0, b.rawUsed) * b.unitCost : 0), 0);
    const span = (new Date(latest.date + 'T00:00:00').getTime() - new Date(prev.date + 'T00:00:00').getTime()) / 86400000;
    const weeks = span > 0 ? span / 7 : null;
    const weeklyCogs = weeks ? periodCost / weeks : null;
    const weeksOnHand = (weeklyCogs && weeklyCogs > 0) ? value / weeklyCogs : null;
    const excess = (weeksOnHand != null && weeksOnHand > targetWeeks && weeklyCogs) ? (weeksOnHand - targetWeeks) * weeklyCogs : 0;
    return { weeksOnHand, value, excess, targetWeeks, weeklyCogs, hasData: true };
  },

  // Per-category cash picture: value on hand, weekly usage cost, weeks on hand,
  // and the cash tied up beyond a target supply. Drives the Purchasing view.
  categoryBreakdown(targetWeeks) {
    targetWeeks = targetWeeks || 3;
    const base = this.usageBase();
    const perp = App._perpetualInventory();
    const cats = {};
    const bump = c => (cats[c] = cats[c] || { cat: c, value: 0, weeklyCogs: 0 });
    Object.keys(perp).forEach(pid => {
      const p = this.productById(pid); if (!p) return;
      bump(p.category || 'Other').value += (perp[pid].value || 0);
    });
    if (base) {
      const asc = this.countsAsc();
      const latest = asc[asc.length - 1], prev = asc[asc.length - 2];
      const span = (new Date(latest.date + 'T00:00:00').getTime() - new Date(prev.date + 'T00:00:00').getTime()) / 86400000;
      const weeks = span > 0 ? span / 7 : null;
      Object.keys(base).forEach(pid => {
        const b = base[pid], p = this.productById(pid); if (!p) return;
        const cost = (b.unitCost != null ? Math.max(0, b.rawUsed) * b.unitCost : 0);
        bump(p.category || 'Other').weeklyCogs += (weeks ? cost / weeks : 0);
      });
    }
    return Object.values(cats).map(c => {
      const woh = c.weeklyCogs > 0 ? c.value / c.weeklyCogs : null;
      const excess = (woh != null && woh > targetWeeks) ? (woh - targetWeeks) * c.weeklyCogs : 0;
      return { cat: c.cat, value: c.value, weeklyCogs: c.weeklyCogs, weeksOnHand: woh, excess };
    }).filter(c => c.value > 0).sort((a, b) => b.excess - a.excess || b.value - a.value);
  },

  // Bills + dated buys due in a window [startYmd, endYmd], inclusive.
  billsDue(startYmd, endYmd) {
    let total = 0; const list = [];
    this.bills().forEach(b => {
      const d = String(b.date || '').slice(0, 10);
      if (!d || d < startYmd || d > endYmd) return;
      const amt = parseFloat(b.amount) || 0;
      total += amt;
      list.push({ vendor: b.vendor || b.category || 'Bill', amount: amt, date: d, category: b.category || '' });
    });
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return { total, list };
  },

  // Cash you are about to spend to bring everything to par, grouped by vendor
  // (same basis as the Order Sheet). This is the "order to par, not to fear" read.
  reorderToPar() {
    const os = window.S && S.InventoryOrderSheet;
    if (os && os.belowParByVendor) {
      const r = os.belowParByVendor();
      if (r && r.groups) {
        let total = 0, count = 0; const vendors = [];
        Object.keys(r.groups).forEach(v => {
          let c = 0, n = 0;
          r.groups[v].forEach(it => { c += (it.suggested || 0) * (it.unit_cost || 0); n++; });
          total += c; count += n; vendors.push({ vendor: v, cost: c, items: n });
        });
        vendors.sort((a, b) => b.cost - a.cost);
        return { total, count, vendors };
      }
    }
    return { total: 0, count: 0, vendors: [] };
  },

  // Vendors carrying real payment terms (net days), the room to hold cash.
  termVendors() {
    return this.vendors()
      .map(v => ({ name: v.name, terms: v.payment_terms || '', netDays: this._netDays(v.payment_terms) }))
      .filter(v => v.netDays > 0)
      .sort((a, b) => b.netDays - a.netDays);
  },
  _netDays(terms) {
    const m = /net\s*(\d+)/i.exec(String(terms || ''));
    return m ? parseInt(m[1], 10) : 0;
  },

  // ── Cash Forecast: net cash 2-4 weeks out, in (projected sales) versus out
  //    (overhead bills + labor + recurring purchases). Catches a week where
  //    heavy cash goes out before the sales come in. ───────────────────────────
  _mondayOf(d) { const date = new Date(d); const day = date.getDay(); date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day)); return App.ymdLocal(date); },
  _addDays(ymd, n) { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return App.ymdLocal(d); },
  _hoursOf(start, end) {
    const ps = String(start).split(':'), pe = String(end).split(':');
    if (ps.length < 2 || pe.length < 2) return 0;
    let mins = (parseInt(pe[0], 10) * 60 + parseInt(pe[1], 10)) - (parseInt(ps[0], 10) * 60 + parseInt(ps[1], 10));
    if (isNaN(mins)) return 0;
    if (mins <= 0) mins += 1440;
    return mins / 60;
  },

  // Projected sales for a week: a saved revenue forecast if there is one, else
  // Bar Cop's weighted same-weekday baseline off your shift sales.
  revenueForWeek(ws) {
    if (App.forecastForWeek) { const f = App.forecastForWeek(ws); if (f && f.total) return f.total; }
    if (App.forecastDefaultsFor) { const d = App.forecastDefaultsFor(ws); if (d && d.total) return d.total; }
    return 0;
  },

  // Labor cost for an upcoming week: the built schedule if one exists, otherwise
  // a trailing four-week average of what you actually paid.
  laborForWeek(ws) {
    const sched = ((App.laborData && App.laborData.lc_schedules) || []).find(s => s && s.week_start === ws);
    if (sched && Array.isArray(sched.shifts) && sched.shifts.length) {
      const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      let cost = 0;
      sched.shifts.forEach(sh => {
        if (!sh.staff_id || !sh.start || !sh.end) return;
        const di = DAYS.indexOf(sh.day);
        const date = di >= 0 ? this._addDays(ws, di) : ws;
        const wage = App.wageForStaffOn ? App.wageForStaffOn(sh.staff_id, date) : 0;
        cost += this._hoursOf(sh.start, sh.end) * wage;
      });
      cost += App.salariedCost ? App.salariedCost(ws, this._addDays(ws, 6)).total : 0;
      return { cost, source: 'scheduled' };
    }
    return { cost: this._trailingWeeklyLabor(ws), source: 'estimated' };
  },
  _trailingWeeklyLabor(beforeYmd) {
    const actuals = (App.laborData && App.laborData.lc_actuals) || [];
    const end = new Date(beforeYmd + 'T00:00:00').getTime();
    const start = end - 28 * 86400000;
    let cost = 0, any = false;
    actuals.forEach(a => {
      const t = new Date((a.date || '') + 'T00:00:00').getTime();
      if (isNaN(t) || t >= end || t < start) return;
      cost += (a.cost || 0); any = true;
    });
    const hourlyWeekly = any ? cost / 4 : 0;
    const wkEnd = App.ymdLocal(new Date(end - 86400000));
    const wkStart = App.ymdLocal(new Date(end - 7 * 86400000));
    const salaried = App.salariedCost ? App.salariedCost(wkStart, wkEnd).total : 0;
    return hourlyWeekly + salaried;
  },
  // Recurring weekly inventory spend, estimated as your weekly cost of goods
  // (in steady state you buy what you use). Overhead bills are counted separately.
  recurringPurchases() { const o = this.overOrder(3); return o.weeklyCogs || 0; },

  forecast(numWeeks, startMonday) {
    numWeeks = numWeeks || 4;
    const start = startMonday || this._mondayOf(new Date());
    const purch = this.recurringPurchases();
    const rows = [];
    for (let i = 0; i < numWeeks; i++) {
      const ws = this._addDays(start, i * 7);
      const we = this._addDays(ws, 6);
      const inflow = this.revenueForWeek(ws);
      const bills = this.billsDue(ws, we).total;
      const lab = this.laborForWeek(ws);
      const out = bills + lab.cost + purch;
      rows.push({ ws, we, inflow, bills, labor: lab.cost, laborSource: lab.source, purch, out, net: inflow - out });
    }
    return rows;
  },

  // ── 13-Week Survival Forecast: the full quarter of cash in versus out, pulling
  //    from every section. Sales + event balances in; labor + purchases + every
  //    bill (one-time and forward-projected recurring) out. A running balance off
  //    your opening cash, the low-point week, and your runway. The stress lever
  //    (slow-season sales adjust + scenario costs) powers "Can I Afford It". ─────
  _OPENING_KEY: 'cash_opening_balance',
  openingCash() { const v = parseFloat(localStorage.getItem(this._OPENING_KEY)); return isNaN(v) ? null : v; },
  setOpeningCash(v) { try { if (v == null || v === '') localStorage.removeItem(this._OPENING_KEY); else localStorage.setItem(this._OPENING_KEY, String(v)); } catch (e) {} },

  // Event balance payments collected around the event date (the deposit is
  // already in hand). Booked + completed only.
  eventInflow(startYmd, endYmd) {
    const bookings = (App.data && Array.isArray(App.data.bookings)) ? App.data.bookings : [];
    let total = 0; const list = [];
    bookings.forEach(b => {
      if (b.stage !== 'Booked' && b.stage !== 'Completed') return;
      const d = String(b.event_date || '').slice(0, 10);
      if (!d || d < startYmd || d > endYmd) return;
      const bal = Math.max(0, (parseFloat(b.quoted_total) || 0) - (parseFloat(b.deposit_amount) || 0));
      if (bal > 0) { total += bal; list.push({ name: b.event_name || 'Event', amount: bal, date: d }); }
    });
    return { total, list };
  },

  // Every bill due in a window: the dated records you have, PLUS future recurring
  // occurrences not yet generated (recurring children only run to this month). A
  // parent or child already covering a month suppresses the projection for it, so
  // nothing double counts.
  projectedBills(startYmd, endYmd) {
    const bills = this.bills();
    const out = [];
    const covered = new Set();
    bills.forEach(b => {
      const d = String(b.date || '').slice(0, 10);
      if (!d) return;
      covered.add((b.recurring_parent || b.id) + '@' + d.slice(0, 7));
      if (d >= startYmd && d <= endYmd) out.push({ date: d, amount: parseFloat(b.amount) || 0, vendor: b.vendor || b.category || 'Bill', category: b.category || '', recurring: !!b.recurring });
    });
    bills.filter(b => b.recurring).forEach(p => {
      const amt = parseFloat(p.amount) || 0;
      const base = new Date((p.date || startYmd) + 'T00:00:00');
      if (isNaN(base.getTime())) return;
      const day = parseInt(p.recur_day, 10) || base.getDate();
      const term = parseInt(p.term_months, 10) || 12;
      for (let m = 0; m < term; m++) {
        const occ = new Date(base.getFullYear(), base.getMonth() + m, day);
        const ymd = App.ymdLocal(occ);
        if (ymd < startYmd || ymd > endYmd) continue;
        const key = p.id + '@' + ymd.slice(0, 7);
        if (covered.has(key)) continue;
        covered.add(key);
        out.push({ date: ymd, amount: amt, vendor: p.vendor || p.category || 'Bill', category: p.category || '', recurring: true, projected: true });
      }
    });
    return out;
  },

  survivalForecast(numWeeks, opts) {
    numWeeks = numWeeks || 13;
    opts = opts || {};
    const salesAdj = opts.salesAdj != null ? opts.salesAdj : 0;   // % slow-season slider
    const extra = Array.isArray(opts.extra) ? opts.extra : [];     // [{week, amount, recurring}]
    const opening = (opts.opening != null) ? opts.opening : (this.openingCash() || 0);
    const start = this._mondayOf(new Date());
    const purch = this.recurringPurchases();
    let bal = opening;
    const rows = [];
    for (let i = 0; i < numWeeks; i++) {
      const ws = this._addDays(start, i * 7), we = this._addDays(ws, 6);
      const sales = this.revenueForWeek(ws) * (1 + salesAdj / 100);
      const ev = this.eventInflow(ws, we);
      const inflow = sales + ev.total;
      const lab = this.laborForWeek(ws);
      const billRecs = this.projectedBills(ws, we);
      const bills = billRecs.reduce((s, b) => s + b.amount, 0);
      let extraOut = 0;
      extra.forEach(x => { if (x.recurring || x.week === i || (x.week == null && i === 0)) extraOut += (parseFloat(x.amount) || 0); });
      const out = lab.cost + purch + bills + extraOut;
      const net = inflow - out;
      bal += net;
      rows.push({ ws, we, i, sales, events: ev.total, eventList: ev.list, inflow, labor: lab.cost, laborSource: lab.source, purchases: purch, bills, billRecs, extra: extraOut, out, net, balance: bal });
    }
    let lowIdx = 0;
    rows.forEach((r, i) => { if (r.balance < rows[lowIdx].balance) lowIdx = i; });
    let runway = null;
    for (let i = 0; i < rows.length; i++) { if (rows[i].balance < 0) { runway = i; break; } }
    return {
      rows, opening, hasOpening: this.openingCash() != null,
      lowPoint: rows[lowIdx] || null, lowIdx,
      runway, negativeWeeks: rows.filter(r => r.balance < 0).length,
      tightWeeks: rows.filter(r => r.net < 0).length,
      end: rows.length ? rows[rows.length - 1].balance : opening,
      hasData: rows.some(r => r.inflow > 0 || r.out > 0)
    };
  },

  // ── True Available Cash: the money that is actually yours and safe to spend.
  //    Your balance, minus the money that isn't yours (the tax you collected and
  //    owe, plus tips held), minus the reserve you should keep. Config is light
  //    and kept on this device. ──────────────────────────────────────────────
  _cfgNum(key, def) { const v = parseFloat(localStorage.getItem(key)); return isNaN(v) ? def : v; },
  _cfgSet(key, v) { try { if (v == null || v === '') localStorage.removeItem(key); else localStorage.setItem(key, String(v)); } catch (e) {} },
  salesTaxRate()   { return this._cfgNum('cash_sales_tax_rate', 0); },
  setSalesTaxRate(v) { this._cfgSet('cash_sales_tax_rate', v); },
  taxFrequency()   { return localStorage.getItem('cash_tax_freq') || 'monthly'; },
  setTaxFrequency(v) { try { localStorage.setItem('cash_tax_freq', v === 'quarterly' ? 'quarterly' : 'monthly'); } catch (e) {} },
  payrollBurden()  { return this._cfgNum('cash_payroll_burden', 0); },
  setPayrollBurden(v) { this._cfgSet('cash_payroll_burden', v); },
  reserveWeeks()   { return this._cfgNum('cash_reserve_weeks', 8); },
  setReserveWeeks(v) { this._cfgSet('cash_reserve_weeks', v); },

  // Weekly fixed overhead: the recurring bills (rent, utilities, insurance, loan),
  // normalized to a week. The nut you owe even on a dead week.
  weeklyFixedCosts() {
    let monthly = 0;
    this.bills().forEach(b => { if (b.recurring) monthly += (parseFloat(b.amount) || 0); });
    return monthly / (52 / 12);
  },

  _taxPeriodBounds() {
    const now = new Date();
    if (this.taxFrequency() === 'quarterly') {
      const q = Math.floor(now.getMonth() / 3);
      return { start: App.ymdLocal(new Date(now.getFullYear(), q * 3, 1)), end: App.ymdLocal(now), label: 'this quarter' };
    }
    return { start: App.ymdLocal(new Date(now.getFullYear(), now.getMonth(), 1)), end: App.ymdLocal(now), label: 'this month' };
  },
  _salesBetween(s, e) {
    let t = 0;
    ((App.shiftData && App.shiftData.sc_shifts) || []).forEach(sh => {
      const d = String(sh.date || '').slice(0, 10); if (!d || d < s || d > e) return;
      t += (parseFloat(sh.bar_revenue) || 0) + (parseFloat(sh.floor_revenue) || 0);
    });
    return t;
  },
  _wagesBetween(s, e) {
    let t = 0;
    ((App.laborData && App.laborData.lc_actuals) || []).forEach(a => {
      const d = String(a.date || '').slice(0, 10); if (!d || d < s || d > e) return;
      t += (parseFloat(a.cost) || 0);
    });
    return t;
  },

  // The money that isn't yours: tax collected this period, plus tips you are
  // holding. Sales tax is the big one and the classic killer.
  setAside() {
    const b = this._taxPeriodBounds();
    const sales = this._salesBetween(b.start, b.end);
    const salesTax = sales * (this.salesTaxRate() / 100);
    const wages = this._wagesBetween(b.start, b.end);
    const payrollTax = wages * (this.payrollBurden() / 100);
    let tipsOwed = 0;
    ((App.laborData && App.laborData.lc_tip_pools) || []).forEach(p => { tipsOwed += Math.max(0, parseFloat(p.unallocated) || 0); });
    return { salesTax, payrollTax, tipsOwed, total: salesTax + payrollTax + tipsOwed, sales, wages, periodLabel: b.label };
  },

  reserveTarget() { return this.reserveWeeks() * this.weeklyFixedCosts(); },

  // The whole position: balance, set-aside, reserve, the cushion (yours before
  // reserve), and Safe to Spend (free and clear).
  position() {
    const opening = this.openingCash();
    const sa = this.setAside();
    const reserve = this.reserveTarget();
    const cushion = (opening || 0) - sa.total;
    return { opening, hasOpening: opening != null, setAside: sa, reserve, cushion, safe: cushion - reserve };
  },

  // ── Realized cash freed (backward, honest). Trapped cash is computed at each
  //    historical count, then "freed" is how far it has come down from your own
  //    first-weeks baseline. No metric × revenue, no fix log to game: it is the
  //    real reduction in capital tied up on the shelf. Reads "building" until a
  //    couple of counts exist. ───────────────────────────────────────────────
  _onHandFromCount(count) {
    const m = {};
    (count.items || []).forEach(it => {
      if (it.counted === false) return;
      const rec = m[it.product_id] || (m[it.product_id] = { onHand: 0, value: 0 });
      rec.onHand += (it.total || 0);
      rec.value += (it.value || 0);
    });
    return m;
  },
  _trappedFrom(oh, base) {
    let dead = 0, overPar = 0;
    Object.keys(oh).forEach(pid => {
      const p = this.productById(pid); if (!p) return;
      const qty = oh[pid].onHand; if (!(qty > 0)) return;
      const uc = App.unitCost(p) || 0;
      const tied = qty * uc;
      const used = base && base[pid] ? Math.max(0, base[pid].rawUsed) : null;
      const par = parseFloat(p.par_level);
      if (used !== null && used <= 0.001 && tied >= 15) dead += tied;
      else if (!isNaN(par) && par > 0 && qty > par) { const ex = (qty - par) * uc; if (ex >= 15) overPar += ex; }
    });
    return dead + overPar;
  },
  trappedAtCount(asc, idx) {
    const latest = asc[idx], prev = idx >= 1 ? asc[idx - 1] : null;
    if (!latest || !prev) return null;
    return this._trappedFrom(this._onHandFromCount(latest), App.computeUsagePair(prev, latest, this.deliveries()));
  },
  trappedSeries() {
    const asc = this.countsAsc();
    const out = [];
    for (let i = 1; i < asc.length; i++) { const v = this.trappedAtCount(asc, i); if (v != null) out.push({ date: asc[i].date, trapped: v }); }
    return out;
  },
  freed() {
    const series = this.trappedSeries();
    if (series.length < 2) return { dollars: 0, building: true, measured: series.length };
    const baseN = Math.min(3, series.length - 1);
    const baseline = series.slice(0, baseN).reduce((s, p) => s + p.trapped, 0) / baseN;
    const current = series[series.length - 1].trapped;
    return { dollars: Math.max(0, baseline - current), building: false, baseline, current, measured: series.length };
  }
};
