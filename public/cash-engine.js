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
    return [...this.counts()].sort(App.cmpOldest);
  },

  // Perpetual on-hand quantity + dollar value per product (last counted value
  // per product/location, carried forward; same basis as the Inventory cockpit).
  onHand() {
    const perp = App._perpetualInventory();
    const oh = {}; let value = 0;
    Object.keys(perp).forEach(pid => { oh[pid] = perp[pid].onHand; value += (perp[pid].value || 0); });
    return { oh, value };
  },

  // ── Average inventory over the recent counts ──────────────────────────────
  // A single count catches one moment, usually the pre-delivery low, which makes
  // turns and GMROI read far too high. The textbook basis for capital efficiency
  // is AVERAGE inventory, so the capital reads use this. Trapped cash still reads
  // the CURRENT count (onHand), which is what is on the shelf right now.
  // ⚠ TWO BASES, AND THEY DO NOT MIX. Never divide a trapped/onHand figure by an
  // average, or the result measures the inventory TREND, not the thing you asked
  // about: c-audit's S1 did exactly that and scored one bar 0 while it built stock
  // and 65 while it drew the same stock down, at an unchanged 50% lazy. A SHARE of
  // the shelf takes onHand on both sides; turns and GMROI take the average on both
  // sides. (The old `avgInventoryValue` helper lived here and was deleted once S1
  // stopped mixing them: its only two callers were the bug. `avgCategoryValue`
  // below is the live average read, used by capitalByCategory.)
  recentCounts(n) {
    const asc = this.countsAsc();
    return asc.slice(Math.max(0, asc.length - (n || 4)));
  },
  avgCategoryValue(n) {
    const cs = this.recentCounts(n);
    if (!cs.length) return {};
    const acc = {};
    cs.forEach(c => (c.items || []).forEach(it => {
      if (it.counted === false) return;
      const cat = (this.productById(it.product_id) || {}).category || it.category || 'Other';
      acc[cat] = (acc[cat] || 0) + (it.value || 0);
    }));
    const out = {}, k = cs.length;
    Object.keys(acc).forEach(cat => { out[cat] = acc[cat] / k; });
    return out;
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

  // ── Buy vs Use: dollars purchased versus dollars used (cost of goods) over each
  //    count period. When buys outrun usage the difference is cash moving onto the
  //    shelf, the quiet way over-ordering traps capital. One row per count pair so
  //    it traces the real buying behavior, not a single snapshot. ───────────────
  buyVsUse(maxPeriods) {
    const asc = this.countsAsc();
    if (asc.length < 2) return { hasData: false, periods: [], latest: null };
    const dels = this.deliveries();
    const periods = [];
    for (let i = 1; i < asc.length; i++) {
      const prev = asc[i - 1], cur = asc[i];
      const start = String(prev.date).slice(0, 10), end = String(cur.date).slice(0, 10);
      if (!start || !end || end <= start) continue;
      const base = App.computeUsagePair(prev, cur, dels);
      const used = Object.values(base).reduce((s, b) => s + (b.unitCost != null ? Math.max(0, b.rawUsed) * b.unitCost : 0), 0);
      let bought = 0;
      dels.forEach(d => { const dt = String(d.date || '').slice(0, 10); if (dt && dt > start && dt <= end) bought += (parseFloat(d.total) || 0); });
      periods.push({ start, end, bought, used, net: bought - used });
    }
    const trimmed = maxPeriods ? periods.slice(-maxPeriods) : periods;
    return { hasData: trimmed.length > 0, periods: trimmed, latest: trimmed.length ? trimmed[trimmed.length - 1] : null };
  },

  // ── Vendor purchasing scorecard: how you actually buy, by vendor. Orders and
  //    spend over a recent window, the average order, the terms on file, and what
  //    it costs to bring that vendor's items to par this week. Pulls vendors with
  //    recent deliveries and any sitting on this week's order-to-par list. ───────
  vendorPurchasing(days) {
    days = days || 90;
    const cut = (() => { const d = new Date(); d.setDate(d.getDate() - days); return App.ymdLocal(d); })();
    const map = {};
    this.deliveries().forEach(d => {
      const v = d.vendor; if (!v) return;
      const dt = String(d.date || '').slice(0, 10); if (!dt || dt < cut) return;
      const m = map[v] = map[v] || { vendor: v, orders: 0, spend: 0, lastOrder: null };
      m.orders++; m.spend += (parseFloat(d.total) || 0);
      if (!m.lastOrder || dt > m.lastOrder) m.lastOrder = dt;
    });
    const terms = {}; this.vendors().forEach(v => { if (v.name) terms[v.name] = v.payment_terms || ''; });
    const toPar = {}; this.reorderToPar().vendors.forEach(v => { toPar[v.vendor] = v.cost; });
    const names = new Set([...Object.keys(map), ...Object.keys(toPar)]);
    return [...names].map(v => {
      const m = map[v] || { vendor: v, orders: 0, spend: 0, lastOrder: null };
      return { vendor: v, orders: m.orders, spend: m.spend, avg: m.orders ? m.spend / m.orders : 0, lastOrder: m.lastOrder, terms: terms[v] || '', toPar: toPar[v] || 0 };
    }).sort((a, b) => b.spend - a.spend || b.toPar - a.toPar);
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

  // ── Who to pay this week: the bills coming due in the next `days`, by date,
  //    with each vendor's terms where they are on file. Turns Pay on Terms into a
  //    concrete weekly list, hold each to its due date. ────────────────────────
  billsToPay(days) {
    days = days || 14;
    const start = App.todayLocal();
    const end = this._addDays(start, days - 1);
    const terms = {};
    this.vendors().forEach(v => { if (v.name) terms[v.name] = v.payment_terms || ''; });
    return this.projectedBills(start, end)
      .map(b => ({ date: b.date, amount: b.amount, vendor: b.vendor, category: b.category, terms: terms[b.vendor] || '', netDays: this._netDays(terms[b.vendor] || '') }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
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
  // Bar Cop's weighted same-weekday baseline off your shift sales, else a cyclic
  // replay of your recent actual weeks for the far weeks past the lookback window.
  revenueForWeek(ws) {
    if (App.forecastForWeek) { const f = App.forecastForWeek(ws); if (f && f.total) return f.total; }
    if (App.forecastDefaultsFor) { const d = App.forecastDefaultsFor(ws); if (d && d.total) return d.total; }
    // Beyond the forecast's same-weekday lookback window (the default returns 0
    // once a week is more than ~8 weeks past the last logged sales), replay the
    // recent actual weeks forward so a far-out week reads a real recent week's
    // number cycling on, not one flat average repeated to the cent.
    return this._cyclicWeeklySales(ws);
  },

  // Recent COMPLETE weeks of actual shift revenue (bar + floor), oldest to newest,
  // excluding the current in-progress week so a partial week never drags it. The
  // basis for both the trailing average and the cyclic replay.
  _recentWeeklySales(n) {
    const shifts = (App.shiftData && App.shiftData.sc_shifts) || [];
    if (!shifts.length) return [];
    const curMon = this._mondayOf(new Date());
    const byWeek = {};
    shifts.forEach(s => {
      const d = String(s.date || '').slice(0, 10); if (!d) return;
      const r = (parseFloat(s.bar_revenue) || 0) + (parseFloat(s.floor_revenue) || 0);
      if (r <= 0) return;
      const wk = this._mondayOf(new Date(d + 'T00:00:00'));
      if (wk >= curMon) return;
      byWeek[wk] = (byWeek[wk] || 0) + r;
    });
    return Object.keys(byWeek).sort().slice(-(n || 8)).map(w => ({ wk: w, total: byWeek[w] }));
  },
  // Average of the recent weeks, the steady fallback when there is only one week
  // to replay (or for a non-projected week).
  _trailingWeeklySales() {
    const recent = this._recentWeeklySales(8);
    if (!recent.length) return 0;
    return recent.reduce((s, w) => s + w.total, 0) / recent.length;
  },
  // Far-out projection: replay the recent actual weekly totals forward, indexed by
  // how many weeks out the target sits. Grounded in your own numbers, but it moves
  // week to week like your business did instead of repeating a single average.
  _cyclicWeeklySales(ws) {
    const recent = this._recentWeeklySales(8);
    if (!recent.length) return 0;
    if (recent.length === 1) return recent[0].total;
    const last = recent[recent.length - 1].wk;
    const dist = Math.round((new Date(ws + 'T00:00:00').getTime() - new Date(last + 'T00:00:00').getTime()) / (7 * 86400000));
    if (dist <= 0) return this._trailingWeeklySales();
    return recent[(dist - 1) % recent.length].total;
  },

  // Labor cost for an upcoming week: the built schedule if one exists, otherwise
  // a trailing four-week average of what you actually paid.
  laborForWeek(ws) {
    // Newest wins if a week ever carries two schedules. Build Schedule's duplicate-week
    // guard replaces in place, so the single-device flow cannot make one; two managers
    // posting the same week from different devices before a sync can. This feeds the
    // quarter and the lender export, so it takes the same picker as Overtime Watch /
    // Log Hours / the Call-Out Log. cmpNewest resolves schedules on its created_at
    // tiebreak (App._recDate reads none of their fields).
    const sched = ((App.laborData && App.laborData.lc_schedules) || [])
      .filter(s => s && s.week_start === ws).sort(App.cmpNewest)[0];
    if (sched && Array.isArray(sched.shifts) && sched.shifts.length) {
      const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      let cost = 0;
      const rows = [];
      sched.shifts.forEach(sh => {
        if (!sh.staff_id || !sh.start || !sh.end) return;
        const di = DAYS.indexOf(sh.day);
        const date = di >= 0 ? this._addDays(ws, di) : ws;
        const wage = App.wageForStaffOn ? App.wageForStaffOn(sh.staff_id, date) : 0;
        const hours = this._hoursOf(sh.start, sh.end);
        const shCost = hours * wage;
        rows.push({ staff_id: sh.staff_id, date, hours, cost: shCost });
        cost += shCost;
      });
      // Overtime premium, same as Build Schedule's own card: the shift math above is
      // straight time, so without this the forecast disagrees with the schedule the
      // operator is looking at, exactly on the weeks someone is posted into overtime.
      cost += App.otPremiumForRows ? App.otPremiumForRows(rows).total : 0;
      cost += App.salariedCost ? App.salariedCost(ws, this._addDays(ws, 6)).total : 0;
      return { cost, source: 'scheduled' };
    }
    return { cost: this._trailingWeeklyLabor(), source: 'estimated' };
  },
  // A trailing four-week average of what you ACTUALLY paid, always anchored to TODAY.
  // It used to anchor to the forecast week being priced, so from week 4 out the whole
  // 28-day window sat in the future, matched no actuals, and returned $0 hourly labor.
  // The 13-week forecast shed ~80% of payroll on a smooth ramp (nothing looked broken)
  // while sales kept replaying real weeks, so the balance curve, the low point, the
  // runway and the lender PDF all read far too optimistic.
  _trailingWeeklyLabor() {
    const actuals = (App.laborData && App.laborData.lc_actuals) || [];
    // Calendar arithmetic, not milliseconds: subtracting 28 x 86400000 from a local
    // midnight lands an hour off across a DST change and rolls the day, the same trap
    // that made App.salariedCost count 30 days in March.
    const dayBefore = (ymd, n) => { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() - n); return App.ymdLocal(d); };
    const today = App.todayLocal();
    const start = dayBefore(today, 28), end = dayBefore(today, 1);   // 28 days, ending yesterday
    const rows = actuals.filter(a => {
      const d = (a && a.date) ? String(a.date).slice(0, 10) : '';
      return d && d >= start && d <= end;
    });
    let cost = rows.reduce((s, a) => s + (a.cost || 0), 0);
    // lc_actuals carry straight time only, so add the weekly premium. It has to be
    // measured over WHOLE weeks and then allocated to this window: a rolling 28 days
    // is not week-aligned, so handing the filtered rows to otPremiumForRows tested the
    // cut weeks at each edge against 40, they never reached it, and the estimate this
    // feeds (runway, the stress test, the lender PDF) always ran light.
    cost += App.otPremiumInWindow ? App.otPremiumInWindow(actuals, start, end).total : 0;
    const hourlyWeekly = rows.length ? cost / 4 : 0;
    const salaried = App.salariedCost ? App.salariedCost(dayBefore(today, 7), end).total : 0;
    return hourlyWeekly + salaried;
  },
  // Recurring weekly inventory spend, estimated as your weekly cost of goods
  // (in steady state you buy what you use). Overhead bills are counted separately.
  recurringPurchases() { const o = this.overOrder(3); return o.weeklyCogs || 0; },

  // DEPRECATED — do not use for any cash read. This omits projected recurring bills,
  // events, cash outflows, and tax remittances (it uses billsDue = dated records
  // only). Use survivalForecast() everywhere; it is the single comprehensive forecast.
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
  openingCash() { let v = App.acctGet(this._OPENING_KEY); if (v == null) v = this._migCfg(this._OPENING_KEY); const n = parseFloat(v); return isNaN(n) ? null : n; },
  setOpeningCash(v) { App.acctSet(this._OPENING_KEY, (v == null || v === '') ? null : String(v)); },

  // Event balance payments collected around the event date. Booked only.
  // The all-in event total (F&B subtotal + service charge + tax), from the Events
  // section so it matches what the booking shows; falls back to the stored field.
  _eventTotal(b) { try { return S.EventsBookings.quoteTotal(b); } catch (e) { return parseFloat(b.quoted_total) || 0; } },
  eventInflow(startYmd, endYmd) {
    const bookings = (App.data && Array.isArray(App.data.bookings)) ? App.data.bookings : [];
    let total = 0; const list = [];
    bookings.forEach(b => {
      // Only Booked events are future committed money. A Completed event's revenue
      // is already realized through sales and This Week catering, so counting its
      // balance here too would double it. A collected balance is in hand, not inflow.
      if (b.stage !== 'Booked' || b.balance_paid_date) return;
      const d = String(b.event_date || '').slice(0, 10);
      if (!d || d < startYmd || d > endYmd) return;
      const evTotal = this._eventTotal(b);
      // Only a COLLECTED deposit comes off the balance still to come. Netting an
      // uncollected one out made that money vanish from the forecast entirely: it was
      // not inflow here, and committedEventCash counts deposits only when
      // deposit_paid_date is set, so it was in neither. Meanwhile Bookings and the
      // Events dashboard were both showing it as "Deposits Due", money the bar is owed
      // and will bank. It also made the forecast's "Deposit Held" column print a
      // deposit that is not held.
      const dep = b.deposit_paid_date ? (parseFloat(b.deposit_amount) || 0) : 0;
      const bal = Math.max(0, evTotal - dep);
      if (bal > 0) { total += bal; list.push({ name: b.event_name || 'Event', amount: bal, date: d, total: evTotal, deposit: dep }); }
    });
    return { total, list };
  },

  // Booked event money for the forecast window: the balances still coming in, plus
  // the deposits already in hand against future events (cash you hold but owe
  // service for, so it is shown as context, never as safe to spend).
  committedEventCash(numWeeks) {
    numWeeks = numWeeks || 13;
    const start = this._mondayOf(new Date());
    const end = this._addDays(start, numWeeks * 7 - 1);
    const ev = this.eventInflow(start, end);
    const bookings = (App.data && Array.isArray(App.data.bookings)) ? App.data.bookings : [];
    let deposits = 0;
    bookings.forEach(b => {
      if (b.stage !== 'Booked' || !b.deposit_paid_date) return;
      const d = String(b.event_date || '').slice(0, 10);
      if (!d || d < start) return;   // future booked events only
      deposits += parseFloat(b.deposit_amount) || 0;
    });
    return { balanceTotal: ev.total, list: ev.list, deposits };
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
      const term = parseInt(p.term_months, 10) || 0;        // 0 = ongoing until stopped
      const stop = p.stopped_ym || null;                     // YYYY-MM; no occurrence in or after this month
      const step = p.frequency === 'quarterly' ? 3 : p.frequency === 'annual' ? 12 : 1;   // recurrence interval in months
      // Anchor the horizon to the forecast window END, not the bill's own start.
      // The old loop (`m < term` with a 12-month default for ongoing bills) only
      // ever generated the 12 months FOLLOWING the bill's first date, so an
      // ongoing bill logged over a year ago projected $0 into a future window and
      // the survival forecast silently dropped it (overstating the bank balance).
      // Mirrors outflowsBetween, incl. the short-month day clamp.
      const endD = new Date(endYmd + 'T00:00:00');
      const monthsToEnd = (endD.getFullYear() - base.getFullYear()) * 12 + (endD.getMonth() - base.getMonth());
      const lastM = term > 0 ? Math.min(term - 1, monthsToEnd) : monthsToEnd;
      for (let m = 0; m <= lastM; m += step) {
        // Clamp the day to the target month's last day so a series dated the
        // 29th to 31st does not roll a short month forward (Jan 31 -> Mar 3) and
        // silently skip the short month.
        const dim = new Date(base.getFullYear(), base.getMonth() + m + 1, 0).getDate();
        const occ = new Date(base.getFullYear(), base.getMonth() + m, Math.min(day, dim));
        const ymd = App.ymdLocal(occ);
        if (stop && ymd.slice(0, 7) >= stop) break;
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
      let sales = this.revenueForWeek(ws) * (1 + salesAdj / 100);
      if (i === 0) {
        // Opening cash is a "right now" balance that already reflects sales banked
        // earlier this week, so week 0 only projects the days still to come — else
        // the elapsed days are double-counted and the near-term runway overshoots.
        const dow = (new Date().getDay() + 6) % 7;   // 0=Mon .. 6=Sun
        sales = sales * ((7 - dow) / 7);
      }
      // A SAVED forecast override already bundles this week's booked-event revenue
      // (Build Schedule adds it into the number you type), so adding the event
      // balance again would double-count. The baseline sales path is event-free, so
      // events ARE added there. Only add event cash when NOT on a saved override.
      const savedFc = App.forecastForWeek ? App.forecastForWeek(ws) : null;
      const onOverride = !!(savedFc && savedFc.total);
      // NOT date-filtered for week 0, unlike sales and _future0 below. That asymmetry is
      // correct: eventInflow already drops any booking with a balance_paid_date, so a
      // balance collected earlier this week is excluded at the source and cannot be
      // double-counted against opening cash. The only rows a today-or-later gate removes
      // are UNCOLLECTED balances dated Mon..yesterday, which are still owed to you and
      // are in no other week either (every later week starts on a future Monday), so
      // gating here silently deleted them from the whole 13-week forecast.
      const ev = this.eventInflow(ws, we);
      const evAdd = onOverride ? 0 : ev.total;
      const inflow = sales + evAdd;
      const lab = this.laborForWeek(ws);
      const billRecs = this.projectedBills(ws, we);
      const ofRecs = this.outflowsBetween(ws, we).concat(this.projectedTaxRemittances(ws, we));
      // Week 0: opening cash is "right now" and already reflects money that left
      // earlier this week, so count only outflows still to come (dated today or
      // later) — the mirror of the sales proration above. Counting a bill or outflow
      // dated earlier this same week (already paid, already out of opening) would
      // double it and push the near-term low point artificially negative.
      const _future0 = r => (i !== 0) || (String(r.date || '') >= App.todayLocal());
      const bills = billRecs.filter(_future0).reduce((s, b) => s + b.amount, 0);
      const outflows = ofRecs.filter(_future0).reduce((s, o) => s + o.amount, 0);
      let extraOut = 0;
      extra.forEach(x => { if (x.recurring || x.week === i || (x.week == null && i === 0)) extraOut += (parseFloat(x.amount) || 0); });
      const out = lab.cost + purch + bills + outflows + extraOut;
      const net = inflow - out;
      bal += net;
      rows.push({ ws, we, i, sales, events: evAdd, eventList: ev.list, inflow, labor: lab.cost, laborSource: lab.source, purchases: purch, bills, billRecs, outflows, ofRecs, extra: extraOut, out, net, balance: bal });
    }
    let lowIdx = 0;
    rows.forEach((r, i) => { if (r.balance < rows[lowIdx].balance) lowIdx = i; });
    const credit = this.availableCredit();
    // Runway = weeks until you are truly out: cash drained AND the credit line
    // maxed. cashRunway = the earlier week your own cash would run dry.
    let runway = null, cashRunway = null;
    for (let i = 0; i < rows.length; i++) {
      if (cashRunway == null && rows[i].balance < 0) cashRunway = i;
      if (rows[i].balance < -credit) { runway = i; break; }
    }
    const low = rows[lowIdx] || null;
    return {
      rows, opening, hasOpening: this.openingCash() != null,
      lowPoint: low, lowIdx, runway, cashRunway, credit,
      drawsCredit: !!(credit > 0 && low && low.balance < 0 && low.balance >= -credit),
      negativeWeeks: rows.filter(r => r.balance < 0).length,
      tightWeeks: rows.filter(r => r.net < 0).length,
      end: rows.length ? rows[rows.length - 1].balance : opening,
      hasData: rows.some(r => r.inflow > 0 || r.out > 0)
    };
  },

  // ── True Available Cash: the money that is actually yours and safe to spend.
  //    Your balance, minus the money that isn't yours (the tax you collected and
  //    owe, plus tips held), minus the reserve you should keep. Config is light
  //    and kept on this device. ──────────────────────────────────────────────
  // Cash config is PER BAR, but it lives device-local in localStorage. Scope
  // every key by the active account (or 'demo') so a browser that held one bar's
  // numbers — or the demo's — never leaks them into another bar or a fresh
  // signup. A brand-new account has no scoped key, so it reads clean defaults.
  _acctScope() {
    if (window.App && App.demoMode) return 'demo';
    return (window.DB && DB._accountId)
      || (window.DB && DB._getStoredActiveAccountId && DB._getStoredActiveAccountId())
      || 'none';
  },
  _key(base) { return base + '::' + this._acctScope(); },
  // One-time move of a pre-sync device-local cash setting onto the account, so an existing
  // operator's opening balance, tax, reserve, credit etc. are not lost the first time this
  // ships. Reads the old localStorage key, migrates it onto the account, returns the value.
  _migCfg(key) { try { const oldK = this._key(key); const old = localStorage.getItem(oldK); if (old != null && old !== '') { App.acctSet(key, old); localStorage.removeItem(oldK); return old; } } catch (e) {} return null; },   // removeItem after migrating: else clearing/wiping a value lets the stale browser key resurrect it on the next read
  _cfgNum(key, def) { let v = App.acctGet(key); if (v == null) v = this._migCfg(key); const n = parseFloat(v); return isNaN(n) ? def : n; },
  _cfgSet(key, v) { App.acctSet(key, (v == null || v === '') ? null : String(v)); },
  salesTaxRate()   { return this._cfgNum('cash_sales_tax_rate', 0); },
  setSalesTaxRate(v) { this._cfgSet('cash_sales_tax_rate', v); },
  taxFrequency()   { let v = App.acctGet('cash_tax_freq'); if (v == null) v = this._migCfg('cash_tax_freq'); return v || 'monthly'; },
  setTaxFrequency(v) { App.acctSet('cash_tax_freq', v === 'quarterly' ? 'quarterly' : 'monthly'); },
  payrollBurden()  { return this._cfgNum('cash_payroll_burden', 0); },
  setPayrollBurden(v) { this._cfgSet('cash_payroll_burden', v); },
  reserveWeeks()   { return this._cfgNum('cash_reserve_weeks', 8); },
  setReserveWeeks(v) { this._cfgSet('cash_reserve_weeks', v); },
  // Available credit (a line of credit or card) is the backstop you actually lean
  // on in a thin week, so it extends the survival runway past the bank balance.
  availableCredit() { return Math.max(0, this._cfgNum('cash_available_credit', 0)); },
  setAvailableCredit(v) { this._cfgSet('cash_available_credit', v); },
  // Outstanding gift cards are cash you collected but owe product against, the same
  // trap as spending the sales tax, so they are money that isn't yours to spend.
  giftCardLiability() { return Math.max(0, this._cfgNum('cash_gift_card_liability', 0)); },
  setGiftCardLiability(v) { this._cfgSet('cash_gift_card_liability', v); },

  // Weekly fixed overhead: the recurring bills (rent, utilities, insurance, loan),
  // normalized to a week by their frequency (monthly / quarterly / annual), so a
  // quarterly or annual bill is not weighted as if it hit every month.
  weeklyFixedCosts() {
    const cur = App.todayLocal().slice(0, 7);   // current YYYY-MM
    let annual = 0;
    this.bills().forEach(b => {
      if (!b.recurring) return;   // recurring parents only (children carry recurring_parent, not recurring)
      // Skip a series that has ENDED (fixed term fully paid) or been STOPPED. The
      // forecast (projectedBills) already honors term/stop, so without this the
      // reserve target counted a paid-off loan or canceled bill forever — inflating
      // the reserve and shrinking Safe to Spend against a phantom bill.
      if (b.stopped_ym && b.stopped_ym <= cur) return;
      const endYm = this.recurringEndYm(b);
      if (endYm && endYm < cur) return;
      const amt = parseFloat(b.amount) || 0;
      const perYear = b.frequency === 'quarterly' ? 4 : b.frequency === 'annual' ? 1 : 12;
      annual += amt * perYear;
    });
    return annual / 52;
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

  // The money that isn't yours: sales tax collected this period, payroll tax
  // accrued, and outstanding gift cards. Sales tax is the big one and the
  // classic killer.
  setAside() {
    const b = this._taxPeriodBounds();
    const sales = this._salesBetween(b.start, b.end);
    // Sales tax is remitted in ARREARS: a payment logged this period (typically
    // ~the 20th) settles the PRIOR period's liability, not this one's. Netting it
    // against the current period's accrual understated the hold and made Safe to
    // Spend read too high. This in-progress period's tax is still owed in full.
    const salesTax = Math.max(0, sales * (this.salesTaxRate() / 100));
    const wages = this._wagesBetween(b.start, b.end);
    const payrollTax = wages * (this.payrollBurden() / 100);
    const giftCards = this.giftCardLiability();
    return { salesTax, payrollTax, giftCards, total: salesTax + payrollTax + giftCards, sales, wages, periodLabel: b.label };
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

  // ── Non-bill cash outflows (owner draws, loan principal, capital buys, tax
  //    remittances). Their own store so they feed BOTH the forecast (scheduled
  //    cash out) and the bridge (where the profit went). Same forward-recurring
  //    projection as bills. ──────────────────────────────────────────────────
  cashOutflows() { return (App.data && Array.isArray(App.data.cash_outflows)) ? App.data.cash_outflows : []; },
  _outflowLabel(t) { return t === 'draw' ? 'Owner draw' : t === 'loan' ? 'Loan payment' : t === 'tax' ? 'Tax remittance' : t === 'capital' ? 'Capital / equipment' : 'Other'; },
  outflowsBetween(startYmd, endYmd) {
    const recs = this.cashOutflows();
    const out = []; const covered = new Set();
    recs.forEach(o => {
      const d = String(o.date || '').slice(0, 10); if (!d) return;
      covered.add((o.recurring_parent || o.id) + '@' + d.slice(0, 7));
      if (d >= startYmd && d <= endYmd) out.push({ date: d, amount: parseFloat(o.amount) || 0, type: o.type || 'capital', label: o.notes || this._outflowLabel(o.type) });
    });
    recs.filter(o => o.recurring).forEach(p => {
      const amt = parseFloat(p.amount) || 0;
      const base = new Date((p.date || startYmd) + 'T00:00:00'); if (isNaN(base.getTime())) return;
      const day = parseInt(p.recur_day, 10) || base.getDate();
      const term = parseInt(p.term_months, 10) || 0;        // 0 = ongoing until stopped
      const stop = p.stopped_ym || null;                     // YYYY-MM; no occurrence in or after this month
      const step = p.frequency === 'quarterly' ? 3 : p.frequency === 'annual' ? 12 : 1;   // recurrence interval in months
      const endD = new Date(endYmd + 'T00:00:00');
      const monthsToEnd = (endD.getFullYear() - base.getFullYear()) * 12 + (endD.getMonth() - base.getMonth());
      const lastM = term > 0 ? Math.min(term - 1, monthsToEnd) : monthsToEnd;
      for (let m = 0; m <= lastM; m += step) {
        // Clamp the day to the target month's last day so a series dated the
        // 29th to 31st does not roll a short month forward (Jan 31 -> Mar 3)
        // and silently skip the short month.
        const dim = new Date(base.getFullYear(), base.getMonth() + m + 1, 0).getDate();
        const occ = new Date(base.getFullYear(), base.getMonth() + m, Math.min(day, dim));
        const ymd = App.ymdLocal(occ);
        if (stop && ymd.slice(0, 7) >= stop) break;
        if (ymd < startYmd || ymd > endYmd) continue;
        const key = p.id + '@' + ymd.slice(0, 7); if (covered.has(key)) continue; covered.add(key);
        out.push({ date: ymd, amount: amt, type: p.type || 'capital', label: p.notes || this._outflowLabel(p.type), projected: true, recurring_parent: p.id });
      }
    });
    return out;
  },
  // Active recurring outflow series (the parents you can stop or edit).
  recurringOutflows() { return this.cashOutflows().filter(o => o.recurring && o.id); },
  // The last month a fixed-term recurring series pays out, or null if it is ongoing.
  recurringEndYm(o) {
    const term = parseInt(o.term_months, 10) || 0;
    if (!term) return null;
    const base = new Date((o.date || '') + 'T00:00:00'); if (isNaN(base.getTime())) return null;
    const last = new Date(base.getFullYear(), base.getMonth() + term - 1, 1);
    return App.ymdLocal(last).slice(0, 7);
  },
  // One key per type Books offers (hub-cash-outflows TYPES), `other` included. It used
  // to be absent here and only sprang into existence via `r[o.type] = ...` when a row
  // happened to carry it, while `r.total` counted it all along. The Cash Bridge renders
  // a row per named key, so `other` was subtracted from Cash You Kept and never shown:
  // the waterfall did not add up, on a screen that says "the bridge below shows where".
  // Any new type here needs a row in c-bridge.waterfall.
  outflowsInPeriod(s, e) {
    const r = { draw: 0, loan: 0, capital: 0, tax: 0, other: 0, total: 0, list: [] };
    this.outflowsBetween(s, e).forEach(o => { r[o.type] = (r[o.type] || 0) + o.amount; r.total += o.amount; r.list.push(o); });
    return r;
  },

  // ── Projected sales-tax remittance ────────────────────────────────────────
  // Bar Cop knows your rate and your filing schedule, so it projects the tax
  // payment onto its due date (the 20th, the month after the period it covers)
  // and into the forecast as scheduled cash out, the way the biggest periodic
  // outflow actually lands. Sized from the sales of the period it covers, actual
  // where past and run-rate where projected. Suppressed for any month you have
  // already logged a tax outflow, so a remittance is never doubled. Empty until a
  // tax rate is set.
  _daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000); },
  _salesForRange(s, e) {
    const today = App.todayLocal();
    let total = 0;
    if (s <= today) total += this._salesBetween(s, e < today ? e : today);
    const projStart = s > today ? s : this._addDays(today, 1);
    if (projStart <= e) {
      const days = this._daysBetween(projStart, e) + 1;
      if (days > 0) total += (this._trailingWeeklySales() / 7) * days;
    }
    return total;
  },
  projectedTaxRemittances(startYmd, endYmd) {
    const rate = this.salesTaxRate();
    if (!(rate > 0)) return [];
    const quarterly = this.taxFrequency() === 'quarterly';
    const manualMonths = new Set();
    this.cashOutflows().forEach(o => { if (o.type === 'tax' && o.date) manualMonths.add(String(o.date).slice(0, 7)); });
    const out = [];
    const startD = new Date(startYmd + 'T00:00:00');
    let d = new Date(startD.getFullYear(), startD.getMonth(), 20);
    if (App.ymdLocal(d) < startYmd) d = new Date(d.getFullYear(), d.getMonth() + 1, 20);
    let guard = 0;
    while (App.ymdLocal(d) <= endYmd && guard++ < 60) {
      const m = d.getMonth();
      const isDue = quarterly ? (m === 0 || m === 3 || m === 6 || m === 9) : true;
      const monthKey = App.ymdLocal(d).slice(0, 7);
      if (isDue && !manualMonths.has(monthKey)) {
        const back = quarterly ? 3 : 1;
        const pStart = App.ymdLocal(new Date(d.getFullYear(), m - back, 1));
        const pEnd = App.ymdLocal(new Date(d.getFullYear(), m, 0));
        const amount = this._salesForRange(pStart, pEnd) * rate / 100;
        if (amount > 0) out.push({ date: App.ymdLocal(d), amount, type: 'tax', label: 'Sales tax remittance', projected: true });
      }
      d = new Date(d.getFullYear(), d.getMonth() + 1, 20);
    }
    return out;
  },

  // ── The Cash Bridge: profit to cash. You earned a profit; here is where it
  //    went instead of into the account, so the "profitable but broke" gap
  //    becomes a list you can see. ───────────────────────────────────────────
  profitForPeriod(s, e) {
    const weeks = (App.data && App.data.weeks) || [];
    let rev = 0, cogs = 0, labor = 0, fees = 0, any = false;
    weeks.forEach(w => {
      const pe = String(w.period_end || '').slice(0, 10); if (!pe || pe < s || pe > e) return;
      any = true;
      ['bar', 'food', 'catering', 'other'].forEach(k => { const d = w[k]; if (d) { rev += (parseFloat(d.revenue) || 0); cogs += (parseFloat(d.cogs) || 0); labor += (parseFloat(d.labor) || 0); } });
      fees += (parseFloat(w.platform_fees) || 0);
    });
    const overhead = this.billsDue(s, e).total;
    return { profit: rev - cogs - labor - fees - overhead, rev, cogs, labor, fees, overhead, hasData: any };
  },
  inventoryChange(s, e) {
    const asc = this.countsAsc();
    if (asc.length < 2) return { change: 0, hasData: false };
    const valAt = cut => {
      let c = null; asc.forEach(x => { const d = String(x.date).slice(0, 10); if (d <= cut && (!c || d > String(c.date).slice(0, 10))) c = x; });
      if (!c) return null;
      const m = this._onHandFromCount(c); return Object.keys(m).reduce((t, pid) => t + (m[pid].value || 0), 0);
    };
    const startVal = valAt(s), endVal = valAt(e);
    if (startVal == null || endVal == null) return { change: 0, hasData: false };
    return { change: endVal - startVal, startVal, endVal, hasData: true };
  },
  bridge(s, e) {
    const p = this.profitForPeriod(s, e);
    const inv = this.inventoryChange(s, e);
    const co = this.outflowsInPeriod(s, e);
    const cashKept = p.profit - inv.change - co.total;
    return { start: s, end: e, profit: p.profit, p, inv, co, cashKept, hasData: p.hasData };
  },

  // ── Capital efficiency: the return on the cash parked in inventory, by
  //    category. Turns = how many times a year you cycle the capital. GMROI =
  //    gross margin dollars earned per dollar of inventory, the retail measure of
  //    whether a category earns its shelf. ──────────────────────────────────────
  _BAR_CATS: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Misc'],
  _catDept(cat) { return this._BAR_CATS.indexOf(cat) !== -1 ? 'bar' : 'food'; },
  _deptCostPct() {
    const weeks = ((App.data && App.data.weeks) || []).slice().sort((a, b) => (String(a.period_end) < String(b.period_end) ? 1 : -1)).slice(0, 4);
    let bRev = 0, bCogs = 0, fRev = 0, fCogs = 0;
    weeks.forEach(w => { if (w.bar) { bRev += (+w.bar.revenue || 0); bCogs += (+w.bar.cogs || 0); } if (w.food) { fRev += (+w.food.revenue || 0); fCogs += (+w.food.cogs || 0); } });
    return { bar: bRev > 0 ? bCogs / bRev : null, food: fRev > 0 ? fCogs / fRev : null };
  },
  capitalByCategory() {
    const cats = this.categoryBreakdown(3);
    const avgCat = this.avgCategoryValue(4);   // turns/GMROI read off AVERAGE inventory
    const dept = this._deptCostPct();
    return cats.map(c => {
      const value = (avgCat[c.cat] != null && avgCat[c.cat] > 0) ? avgCat[c.cat] : c.value;
      const annualCogs = c.weeklyCogs * 52;
      const turns = value > 0 ? annualCogs / value : null;
      const weeksOnHand = c.weeklyCogs > 0 ? value / c.weeklyCogs : null;
      const d = this._catDept(c.cat);
      const costPct = dept[d];
      const marginPct = costPct != null ? (1 - costPct) : null;
      const gmroi = (costPct != null && costPct > 0 && turns != null) ? turns * (marginPct / costPct) : null;
      return { cat: c.cat, value, weeklyCogs: c.weeklyCogs, weeksOnHand, annualCogs, turns, dept: d, costPct, marginPct, gmroi };
    }).filter(c => c.value > 0).sort((a, b) => (a.gmroi == null ? 99 : a.gmroi) - (b.gmroi == null ? 99 : b.gmroi));
  },
  capitalSummary() {
    const rows = this.capitalByCategory();
    const totalCap = rows.reduce((s, r) => s + r.value, 0);
    const annualCogs = rows.reduce((s, r) => s + r.annualCogs, 0);
    const turns = totalCap > 0 ? annualCogs / totalCap : null;
    const gm = rows.reduce((s, r) => s + (r.gmroi != null ? r.gmroi * r.value : 0), 0);
    const gmroi = totalCap > 0 ? gm / totalCap : null;
    return { rows, totalCap, annualCogs, turns, gmroi };
  },

  // ── Cash conversion cycle: days your cash is locked up. Days of inventory on
  //    hand, minus the days you take to pay your vendors (receivables ~ 0 for a
  //    bar). The shorter it is, the less cash is trapped in the operating cycle. ─
  _weightedDPO() {
    const vendors = {};
    this.vendors().forEach(v => { vendors[v.name] = this._netDays(v.payment_terms); });
    let total = 0, w = 0;
    const spend = {};
    this.deliveries().forEach(d => { const v = d.vendor; if (!v) return; const amt = parseFloat(d.total) || 0; spend[v] = (spend[v] || 0) + amt; total += amt; });
    if (total > 0) { Object.keys(spend).forEach(v => { w += spend[v] * (vendors[v] || 0); }); return w / total; }
    const ds = Object.values(vendors); return ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : 0;
  },
  cashCycle() {
    const o = this.overOrder(3);
    if (!o.hasData || !o.weeklyCogs) return { hasData: false };
    const dailyCogs = o.weeklyCogs / 7;
    const dio = (o.weeksOnHand != null ? o.weeksOnHand : 0) * 7;
    const dpo = this._weightedDPO();
    const cycle = dio - dpo;
    return { hasData: true, dio, dpo, cycle, dailyCogs, lockedCash: Math.max(0, cycle) * dailyCogs, value: o.value, weeklyCogs: o.weeklyCogs };
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
