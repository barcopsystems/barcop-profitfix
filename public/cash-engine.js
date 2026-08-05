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
  /* ⛔⛔ BILLS ARE OPERATING BILLS. A CASH-ONLY ROW IS NOT ONE (2026-08-04, found by Kyle on the
     live app within minutes of the outflow migration landing, and it was my miss).
     Phase 1 moved every cash outflow into `operating_expenses` as a ledger row, carrying its
     `recurring` fields so the forecast would not lose a series. This function reads that array
     whole — so a recurring owner draw, loan payment and tax remittance immediately became BILLS:
     they entered `weeklyFixedCosts`, moved the reserve target, and moved Safe to Spend. A loan
     payment was worse, counted here AND through break-even's own debt figure off the old store.
     The migration was supposed to change no number and it changed two on the front page.
     ⚠ THE REAL LESSON IS ABOUT THE HARNESS, NOT THE CODE: the equality pin stubbed `bills()` to
     `[]`, so it could never see this. A stub more forgiving than the real dependency certifies the
     bug (integrity #6), and it did, in the one place that mattered. It now runs the REAL reader. */
  bills() {
    /* ⛔ BARE, AND THE GUARD IT REPLACED WAS THE DANGEROUS KIND ([[the-loop]] #40). This used to read
       `if (!OEX || typeof OEX.isCashOnlyCategory !== 'function') return rows;` — which means "if the
       expense screen has not loaded, go back to counting every owner draw and loan payment as a
       BILL, quietly." That is precisely the defect that reached Kyle when the migration shipped: the
       reserve, Safe to Spend and the break-even nut all moved on the front page. A fallback to the
       unfiltered array converts a loud failure into a silently wrong number, and this file loads
       AFTER hub-operating-expenses.js in index.html, so there is nothing to be defensive about. */
    const rows = (App.data && Array.isArray(App.data.operating_expenses)) ? App.data.operating_expenses : [];
    return rows.filter(r => !S.HubOperatingExpenses.isCashOnlyCategory(r && r.category));
  },

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
    /* A `days`-day window is `days` days, today included — and it is bounded at the TOP as well
       (S217). This used to test `dt < cut` and nothing above, so one delivery typed with a future
       date counted in every window at once and inflated a vendor's spend, order count and the
       annualized figure built from them. The delivery itself is still in Delivery History where it
       can be corrected; only the total leaves it out. */
    const inWin = App.inWindow(days);
    const map = {};
    this.deliveries().forEach(d => {
      const v = d.vendor; if (!v) return;
      const dt = String(d.date || '').slice(0, 10); if (!inWin(dt)) return;
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
    // `!= null`, NOT truthiness: $0 is a LEGITIMATE saved forecast. saveForecast accepts any
    // val >= 0 and App.effectiveForecast honours a 0 (Build Schedule shows a $0 labour budget
    // for it), but a truthiness test here discarded it and fell through to the 8-week average —
    // so a week the operator explicitly closed for renovation projected a full average week of
    // phantom revenue into the balance curve, the low-point week, the runway, and the lender PDF.
    if (App.forecastForWeek) { const f = App.forecastForWeek(ws); if (f && f.total != null) return Number(f.total) || 0; }
    // Tier 2 is the raw same-weekday average, uncorrected. It briefly carried the confirmation
    // ratio; that made weeks 0-7 (tier 2, ratio-uplifted) and weeks 8-12 (tier 3, confirmed-
    // substituted) sit on different bases, so the 13-week balance curve bent down ~15% partway
    // along for no data reason — moving the low-point week, the runway and the lender export.
    // Correction now enters only where it is EXACT: tier 3 and _trailingWeeklySales substitute a
    // confirmed week's real total, and _salesBetween does the same for the tax basis.
    if (App.forecastDefaultsFor) { const d = App.forecastDefaultsFor(ws); if (d && d.total) return d.total; }
    // Beyond the forecast's same-weekday lookback window (the default returns 0
    // once a week is more than ~8 weeks past the last logged sales), replay the
    // recent actual weeks forward so a far-out week reads a real recent week's
    // number cycling on, not one flat average repeated to the cent.
    return this._cyclicWeeklySales(ws);
  },

  // The CONFIRMED bar + floor revenue for the week starting `mondayYmd`, or null if that week
  // was never confirmed. Bar + floor ONLY, never the record's grand total: the total also
  // carries catering and ancillary, while the sc_shifts baseline this corrects is bar + floor.
  // Mixing the two bases would fold event revenue into the sales baseline while eventInflow
  // keeps adding it separately on top — a silent double count.
  _confirmedWeekTotal(mondayYmd) {
    const pe = this._addDays(mondayYmd, 6);   // weeks key on Monday; period_end is that Sunday
    const matches = ((App.data && App.data.revenue_weeks) || [])
      .filter(w => String(w.period_end || '').slice(0, 10) === pe);
    // Newest wins, never array order. Row-per-record removed the blob's last-write-wins collapse,
    // so two devices confirming the same week before a sync each miss confirm-week's local lookup,
    // each mint a fresh id, and leave TWO rows on the same period_end. A bare .find returned
    // whichever the load order surfaced — and this value SUBSTITUTES for the week's sales in the
    // forecast, the trailing average and the sales-tax hold, so it must not change on reload.
    // App.forecastForWeek and laborForWeek already defend this exact case; this was the outlier.
    // Keyed on saved_at because confirm-week always stamps it and _recDate/cmpNewest would sort
    // on period_end, which is identical across the duplicates by definition.
    const rw = matches.length < 2 ? matches[0]
      : matches.slice().sort((a, b) => {
          // TIMESTAMP ONLY. `|| r.id` used to sit at the end of this chain, and it inverted the
          // whole thing: App.uid() is Date.now().toString(36), which in 2026 begins with a LETTER,
          // and under localeCompare letters sort after digits — so an id-only row outranked every
          // ISO saved_at and this returned the one row it could not date. A record with no
          // timestamp must never beat one that has it. id stays as a deterministic TIEBREAK only,
          // so two undated rows still cannot be decided by array order.
          const ts = r => String((r && (r.saved_at || r.created_at)) || '');
          const ta = ts(a), tb = ts(b);
          if (ta !== tb) return tb.localeCompare(ta);
          return String((b && b.id) || '').localeCompare(String((a && a.id) || ''));
        })[0];
    if (!rw) return null;
    const bar = parseFloat(rw.bar_revenue), flo = parseFloat(rw.floor_revenue);
    const tot = (isNaN(bar) ? 0 : bar) + (isNaN(flo) ? 0 : flo);
    // A total of 0 means "no bar/floor figure to substitute", not "this week sold nothing".
    // The AND guard here used to be `isNaN(bar) && isNaN(flo)`, so a week where the operator
    // TYPED 0 (a catering-only or closed week — confirm-week's save gate passes on catering
    // revenue alone) returned 0, and 0 != null won over the raw sum: that week vanished from the
    // tax basis entirely. Matches how hub.js and hub-group-dashboard.js already treat these rows
    // (`(bar||0)+(floor||0) > 0`). If the week genuinely sold nothing, the raw sum is ~0 anyway.
    return tot > 0 ? tot : null;
  },

  // ⚠ A `_confirmationRatio()` helper used to live here — a blended confirmed/logged multiplier
  // applied to unconfirmed weeks. DELIBERATELY DELETED 2026-07-20, twice attempted and twice
  // wrong, so do not reintroduce it. It was gated at two confirmed weeks, which made it a step
  // function: confirming one routine week flipped it 1.00 -> 1.30 and re-scaled every OTHER week
  // in the tax basis (a ~$7.7k jump on a $38k month, only $3k of it real), and it ran BACKWARDS
  // when a week aged out of the 8-week sample. Correction now enters ONLY where it is exact —
  // substituting a confirmed week's real total. An estimate must never move a displayed actual
  // for a reason the operator cannot point at.

  // Recent COMPLETE weeks of actual shift revenue (bar + floor), oldest to newest,
  // excluding the current in-progress week so a partial week never drags it. The
  // basis for both the trailing average and the cyclic replay.
  // A week the operator CONFIRMED reports its confirmed bar+floor instead of the raw shift sum:
  // that is the number they reconciled and stand behind, so projecting off the un-reviewed log
  // would forecast from a figure they have already corrected. `logged` keeps the raw value; it
  // has NO consumer in the app now that the blended ratio is gone (see the tombstone above), and
  // is kept only so verify-confirmed-week-forecast.js can assert the raw and confirmed totals
  // stay distinguishable. This line used to say the ratio measures the difference, which pointed
  // at a deleted function three lines below its own tombstone.
  _recentWeeklySales(n) {
    const curMon = this._mondayOf(new Date());
    const byWeek = {};
    // NO `if (!shifts.length) return []` here. A weekly-only operator confirms weeks and never
    // logs nightly, so bailing on an empty shift log handed the whole cash forecast a $0 history
    // off a fully confirmed one.
    ((App.shiftData && App.shiftData.sc_shifts) || []).forEach(s => {
      const d = String(s.date || '').slice(0, 10); if (!d) return;
      const r = (parseFloat(s.bar_revenue) || 0) + (parseFloat(s.floor_revenue) || 0);
      if (r <= 0) return;
      const wk = this._mondayOf(new Date(d + 'T00:00:00'));
      if (wk >= curMon) return;
      byWeek[wk] = (byWeek[wk] || 0) + r;
    });
    // A CONFIRMED week counts even with nothing logged behind it. The map above is built only
    // from sc_shifts, so a week the operator confirmed but never logged nightly was never a key
    // and its reconciled total was never read — it contributed $0, not the raw sum and not the
    // confirmed sum. confirm-week deliberately invites that partial close ("Missing pieces read
    // as blank. You can still confirm and fill them later"). The tell was a discontinuity: one
    // dollar of shift data inside the week unlocked its entire confirmed total.
    // `logged` stays 0 for these — nothing WAS logged — and _confirmedWeekTotal supplies `total`.
    ((App.data && App.data.revenue_weeks) || []).forEach(w => {
      const pe = String(w.period_end || '').slice(0, 10); if (!pe) return;
      // _mondayOf, NOT _addDays(pe, -6). The shift loop above keys on _mondayOf, which is always a
      // Monday; period_end - 6 only lands on a Monday when period_end IS a Sunday. Any other
      // weekday minted a SECOND, non-colliding key for the same calendar week, so the
      // `byWeek[wk] != null` guard below stopped guarding and the week was counted twice — once
      // raw from the log, once confirmed. Identical to the old form for every Sunday, and every
      // writer produces a Sunday today, so this only closes a latent hole.
      const wk = this._mondayOf(new Date(pe + 'T00:00:00'));
      if (wk >= curMon || byWeek[wk] != null) return;   // in-progress week out; never overwrite logged data
      // Null means "no bar/floor figure to substitute" (a catering-only week). Adding it as a $0
      // week would drag the trailing average down with revenue that belongs to eventInflow.
      if (this._confirmedWeekTotal(wk) == null) return;
      byWeek[wk] = 0;
    });
    return Object.keys(byWeek).sort().slice(-(n || 8)).map(w => {
      const conf = this._confirmedWeekTotal(w);
      return { wk: w, total: (conf != null ? conf : byWeek[w]), logged: byWeek[w], confirmed: conf != null };
    });
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
    // Divide by the WEEKS actually logged, not a flat 4. With < 4 weeks of history the old /4
    // understated labor by up to 4x — and understating an outflow OVERSTATES cash (runway, low
    // point, "Can I Afford It", the lender PDF), the one direction this file fears most. Its sibling
    // _trailingWeeklySales already averages over weeks-present. The window is four aligned 7-day
    // buckets ending yesterday; count how many hold a logged row (a full history still divides by 4).
    // Round the day gap so a DST hour offset can't shift a boundary date into the wrong bucket.
    const dayIdx = ymd => Math.round((new Date(end + 'T00:00:00') - new Date(ymd + 'T00:00:00')) / 86400000);
    const weeksPresent = new Set();
    rows.forEach(a => { const di = dayIdx(String(a.date).slice(0, 10)); if (di >= 0 && di < 28) weeksPresent.add(Math.floor(di / 7)); });
    const wkCount = Math.max(1, weeksPresent.size);
    const hourlyWeekly = rows.length ? cost / wkCount : 0;
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
  setOpeningCash(v) { return App.acctSet(this._OPENING_KEY, (v == null || v === '') ? null : String(v)); },

  // Event balance payments collected around the event date. Booked only.
  // The all-in event total (F&B subtotal + service charge + tax), from the Events
  // section so it matches what the booking shows; falls back to the stored field.
  /* ⛔⛔ THIS DELIBERATELY USES THE QUOTE, NEVER `actual_revenue`, AND THE REASONING IS HERE SO THE
     NEXT ROUND DOES NOT RE-OPEN IT ([[the-loop]] #29).
     Round 3 changed it to return `actual_revenue` for a Completed booking, on a finder's framing
     that "the pipeline prints the actual and the forecast prints the quote, so one event has two
     numbers". **That framing was wrong and I bought it without testing it.** The pipeline's column
     is headed "Quote / Revenue" — WHAT THE EVENT WAS WORTH. This function answers WHAT IS STILL
     OWED. Two different quantities are allowed to differ; only the same quantity computed twice
     must agree. Round 1 of this door had already recorded that exact trap: *reconciling a pair of
     tiles is not the same as a tile being right.*
     ⛔ The change was reverted because it produced SIX new divergences, every one measured:
       · `balanceOutstanding` still answered off the quote  → Events $7,618.75 vs forecast $7,400.00
       · an invoice raised outside Bar Cop (no quote typed) → a real $6,195.00 receivable read $0.00,
         which is the precise defect this door was built to fix
       · a GROSS deposit netted off a possibly-NET actual   → $1,619.94 owed vs $1,175.00 forecast
       · deposit ≥ quote but < actual → the forecast charged $1,500.00 with **no button anywhere**
         to settle it (the clearing door's gate reads the quote)
       · an overpaid event billed $3,618.75 it had already been overpaid $1,000.00 on
       · and the forecast's "Event Total" column silently mixed the two bases row by row.
     ⭐ The root cause of all six is one undecided fact: **`actual_revenue` has no stated basis.**
     It is posted to This Week's Events REVENUE line (net of tax, since the engine computes tax
     remittance AS a percentage OF revenue) and it drives Margin %, while a receivable must be
     gross. The seed enters it BOTH ways ($1,575 net-ish on Westlake, $2,840 all-in on Reyes) and no
     single entry can satisfy both readers. That is a product decision (Bar Cop has no final-invoice
     field), not something to infer here. ⚠ S235 IS NOW DECIDED: `actual_revenue` is NET OF SALES
     TAX, stated on the P&L form and in the help. That does not reopen this — a receivable is GROSS,
     so the agreed figure is still the right one to collect; it only ends the ambiguity about what
     the field means.
     Until it is decided, the forecast collects **what was AGREED**, which is unambiguous and is what
     the signed agreement holds the client to. */
  _eventTotal(b) { try { return S.EventsBookings.quoteTotal(b); } catch (e) { return parseFloat(b && b.quoted_total) || 0; } },
  eventInflow(startYmd, endYmd, anchorYmd) {
    const bookings = (App.data && Array.isArray(App.data.bookings)) ? App.data.bookings : [];
    let total = 0; const list = [];
    bookings.forEach(b => {
      // Only Booked events are future committed money. A Completed event's revenue
      // is already realized through sales and This Week catering, so counting its
      // balance here too would double it. A collected balance is in hand, not inflow.
      /* ⚠⚠ THE TEST IS "IS IT STILL OWED", NOT "HAS THE EVENT HAPPENED YET".
         This required stage === 'Booked' and an event date inside the window, on the theory that a
         Completed event's revenue is already realized through sales. That theory is only true when
         the client settled at the bar. A catering invoice on net-30 never touched the POS, and the
         old rule DELETED it from every week of the forecast the moment the date passed or the
         operator pressed Mark Completed. Measured: $6,195 of real receivable showing $0.00, and a
         Booked event five days old showing $0.00 against $7,695 owed.
         Bar Cop cannot work out which case it is, so it no longer guesses: the balance counts until
         the operator marks it paid and says HOW it was settled (see ev-bookings.markPaid). A
         register settlement is already in sales and carries a balance_paid_date, so it drops out
         here exactly as it should; anything still owed stays visible. */
      if (b.stage !== 'Booked' && b.stage !== 'Completed') return;   // Lead/Quote Sent/Lost are not committed money
      if (b.balance_paid_date) return;                               // collected: in the bank, not the forecast
      const raw = String(b.event_date || '').slice(0, 10);
      if (!raw) return;
      /* ⛔⛔ THE ANCHOR IS THE FORECAST'S START, NOT THE CALLER'S WINDOW — [[the-loop]] #47/#52, and
         I broke it again in the very fix this comment sits in. An overdue balance is collectible
         NOW, so it lands at the START rather than in a week that has already gone. But
         survivalForecast asks this function THIRTEEN TIMES, one WEEK each, so clamping to the
         handed-in `startYmd` re-anchored the same invoice to every week's Monday and counted it
         every time. MEASURED: one $6,195 receivable became $80,535 across 13 weeks, and the Anchor
         Bar seed's own two Booked events became $98,652.00 against a truth of $9,503.50 — $89,148.50
         of phantom cash, in the OPTIMISTIC direction, feeding the ending balance, the low point,
         the runway and Safe to Spend.
         So the caller passes the anchor it means, the clamp is measured against THAT, and the
         window test is restored — which makes it impossible to count the row twice however the
         caller slices time. committedEventCash asks once over the whole window and passes nothing,
         so the anchor defaults to its own start and behaves exactly as before. */
      const anchor = anchorYmd || startYmd;
      const d = raw < anchor ? anchor : raw;
      if (d < startYmd || d > endYmd) return;
      const evTotal = this._eventTotal(b);
      // Only a COLLECTED deposit comes off the balance still to come. Netting an
      // uncollected one out made that money vanish from the forecast entirely: it was
      // not inflow here, and committedEventCash counts deposits only when
      // deposit_paid_date is set, so it was in neither. Meanwhile Bookings and the
      // Events dashboard were both showing it as "Deposits Due", money the bar is owed
      // and will bank. It also made the forecast's "Deposit Held" column print a
      // deposit that is not held.
      /* ⚠ THE FOURTH READER OF THE DEPOSIT, AND IT DID NOT GET THE FLOOR THE OTHER THREE GOT — under
         a comment in ev-bookings claiming it had ("one reader, all three balance doors… and the same
         figure into the 13-week forecast"). A confidence claim in a comment is an instruction to the
         next reader not to check, and this one was wrong. MEASURED with a legacy `deposit_amount:
         -2000`: the booking screen read $6,412.50 (floored) while the forecast read **$8,412.50** —
         $2,000 of phantom receivable — and `deposits` came out at **-$2,000.00**, rendering
         "$-2,000.00 in deposits is already in hand". One definition, five readers. */
      const dep = b.deposit_paid_date ? S.EventsBookings._depositHeld(b) : 0;
      const bal = Math.max(0, evTotal - dep);
      if (bal > 0) { total += bal; list.push({ name: b.event_name || 'Event', amount: bal, date: raw, total: evTotal, deposit: dep }); }
    });
    return { total, list };
  },

  /* ⚠⚠ EVENT MONEY GOING OUT: A DEPOSIT THE BAR HAS AGREED TO GIVE BACK. Until now Bar Cop had no
     path for event money LEAVING at all, so marking a booking Lost simply dropped a banked deposit
     out of the cash position with no prompt and no record — measured, $1,500 of real cash vanishing
     from every screen while the record still held it.
     `ev-bookings.markLost` now asks the one question the data cannot answer: was the deposit KEPT
     (whatever their own terms say — nothing moves), REFUNDED (it has already left the bank),
     or STILL TO REFUND (a payable). Only the last one is future money out, and that is what this
     returns.
     ⚠ DELIBERATELY THE MIRROR OF `eventInflow`, line for line, because the anchor rule has bitten
     four times ([[the-loop]] #52): the caller passes the anchor it means, an overdue obligation is
     clamped up to it rather than into a week that has gone, and the window test is then applied — so
     asking week by week totals exactly the same as asking once, however the caller slices time.
     A refund already paid drops out on `deposit_refund_date`, exactly as a collected balance drops
     out of the inflow on `balance_paid_date`: the money has moved and is in the opening balance. */
  eventRefundsOwed(startYmd, endYmd, anchorYmd) {
    const bookings = (App.data && Array.isArray(App.data.bookings)) ? App.data.bookings : [];
    let total = 0; const list = [];
    bookings.forEach(b => {
      if (!b.deposit_paid_date) return;                  // only money actually banked can be refunded
      const held = S.EventsBookings._depositHeld(b);
      let amt = 0;
      if (b.stage === 'Lost') {
        if (b.deposit_outcome !== 'to_refund') return;
        if (b.deposit_refund_date) return;               // already paid back: it has left the bank
        /* ⚠ S247 — PARTIAL REFUNDS. The operator may keep some and give some back (a cancellation
           fee out of the deposit is ordinary), and charging the whole thing made that unrepresentable.
           `refund_amount` is what they said goes back; absent, it is the whole deposit, which is what
           every existing record means. ⚠ CAPPED AT WHAT WAS ACTUALLY BANKED — you cannot give back
           more than you took, and an uncapped figure would be a typo the forecast believes. */
        amt = Math.min(held, Math.max(0, parseFloat(b.refund_amount != null && b.refund_amount !== '' ? b.refund_amount : held) || 0));
      } else {
        /* ⚠⚠ S246 — AN OVERPAID DEPOSIT ON A LIVE BOOKING IS ALSO MONEY GOING BACK, and the Booked
           card has said so on a tile ("Refund Owed $1,459.25") since round 1 while the forecast
           charged $0.00. Same money, same direction, named on one screen and missing from the other.
           It exists exactly while the banked deposit exceeds the quote, so it clears itself the
           moment the operator corrects the deposit or the price — no second field to get stuck on,
           which is what made the Lost payable dangerous until it got its own door. */
        if (b.stage === 'Lost') return;
        amt = Math.max(0, held - this._eventTotal(b));
      }
      if (!(amt > 0)) return;
      // Owed since the booking died, so date it by when it was marked Lost, falling back to the
      // event date and then to the window start — a payable with no date is still a payable.
      /* ⚠ AN OVERPAYMENT IS DATED BY WHEN THE MONEY LANDED, NOT BY THE EVENT. Falling through to
         `event_date` would date it months out and drop it off the far end of the quarter entirely —
         the AA1 defect, where a $3,000 payable read $0.00 because it was dated by an event five
         months away. It is owed from the moment the overpayment exists. */
      const raw = String((b.stage === 'Lost' ? b.lost_date : b.deposit_paid_date) || b.event_date || '').slice(0, 10);
      const anchor = anchorYmd || startYmd;
      const d = (!raw || raw < anchor) ? anchor : raw;
      if (d < startYmd || d > endYmd) return;
      total += amt;
      list.push({ name: b.event_name || 'Event', amount: amt, date: raw || anchor });
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
    /* ⛔⛔ THIS ASKS ONCE OVER THE WHOLE WINDOW, AND A ROUND-3 CHANGE THAT MADE IT ASK WEEK BY WEEK
       — SKIPPING ANY WEEK CARRYING A SAVED FORECAST OVERRIDE — WAS REVERTED. The reasoning is here
       so the next round does not rebuild it ([[the-loop]] #29).
       The intent was sound: c-forecast prints this card under *"the balance still to collect,
       already counted in the cash-in above"*, and `survivalForecast` drops event money on an
       override week, so that sentence was false by a measured $1,808.50. **But the fix was wrong on
       its own premise and worse than the bug.**
       · **The premise is false.** The claim was "the override already bundles that money". It does
         not: `App.bookedEventRevenueForWeek` pre-fills `subtotal + service` — gross of a collected
         deposit, with NO tax and NO room fee — and it bounds on the RAW event date, so it can never
         contain an overdue row the anchor clamped into this week. MEASURED on one week: the override
         bundles **$7,200.00** while the skip dropped **$13,107.50**.
       · **It deleted real receivables from the one card whose job is listing them.** MEASURED with
         overrides on two weeks: card total **$18,237.50 → $0.00**, and c-forecast's empty branch then
         printed *"No balances left to collect this quarter"* against $18,237.50 genuinely owed — the
         card vanishing from the screen AND from the lender PDF. That is the exact defect
         `eventInflow` was rewritten to end.
       A receivable is owed whether or not the operator saved a sales override, so this card must not
       depend on one. **The real defect was the SENTENCE, and it is fixed where it is written** —
       `c-forecast.eventsCard` now says so when a week in the window carries an override. */
    const ev = this.eventInflow(start, end);
    const bookings = (App.data && Array.isArray(App.data.bookings)) ? App.data.bookings : [];
    let deposits = 0;
    bookings.forEach(b => {
      /* ⛔ THIS STAYS `Booked` ONLY, AND THE REASONING IS HERE SO THE NEXT ROUND DOES NOT "FIX" IT
         ([[the-loop]] #29). A scan flagged it as inconsistent with `eventInflow`, which counts
         Completed too and clamps an overdue date up to the anchor — and I very nearly matched them.
         **They answer different questions.** `eventInflow` asks "what is still OWED", which does not
         care whether the party has happened. This half is the struct's other line: deposits held
         against service NOT YET DELIVERED — the operator is holding someone else's money. Once the
         event is Completed the service is delivered and the deposit is simply the bar's, so widening
         this would report money owed against nothing. The clamp is wrong here for the same reason.
         ⚠ The comment below is about the WINDOW BOUNDS (both ends), not the stage set. */
      if (b.stage !== 'Booked' || !b.deposit_paid_date) return;
      const d = String(b.event_date || '').slice(0, 10);
      /* ⚠ THE TWO HALVES OF THIS STRUCT MUST BE WINDOWED THE SAME WAY. eventInflow bounds both ends
         (`d < startYmd || d > endYmd`); this loop had a start bound and no end, so a deposit banked
         against an event beyond the window was counted as "in hand" for a window that does not
         contain the event. Measured: a $1,500 deposit for an event six months out produced an empty
         event list and deposits of $1,500, and c-forecast then printed "$1,500 in deposits is
         already in hand against booked events. No balances left to collect THIS QUARTER." — a
         this-quarter sentence carrying an out-of-quarter figure. */
      if (!d || d < start || d > end) return;   // booked events inside the forecast window only
      deposits += S.EventsBookings._depositHeld(b);   // the fifth reader — same floor as the other four
    });
    return { balanceTotal: ev.total, list: ev.list, deposits };
  },

  // Every bill due in a window: the dated records you have, PLUS future recurring
  // occurrences not yet generated (recurring children only run to this month). A
  // parent or child already covering a month suppresses the projection for it, so
  // nothing double counts.
  /* ⚠⚠ EVERY MONTH-GRAINED DECISION IS MADE OVER WHOLE MONTHS, THEN THE RESULT IS SLICED. Both
     projection loops hand out a consume-once token per logged row per MONTH — and survivalForecast
     asks them thirteen times, one Mon-Sun week each, rebuilding that pool on every call. So one
     logged payment handed out a fresh token in EVERY week of the quarter: measured, two identical
     series with due days in different weeks gave $1,245 asked once and $498 asked week by week —
     60% of the projected bills gone, and $5,550 of debt service on the outflow twin. Understating
     what leaves the bank feeds the low point, the runway, Safe to Spend and the lender PDF.
     This is the third time the same shape has bitten (the tax remittance widening was the second).
     Widening here makes it structural: the answer no longer depends on the window. */
  _monthSpan(startYmd, endYmd) {
    const s = String(startYmd).slice(0, 7) + '-01';
    const eD = new Date(parseInt(String(endYmd).slice(0, 4), 10), parseInt(String(endYmd).slice(5, 7), 10), 0);
    return { s: s, e: App.ymdLocal(eD) };
  },

  projectedBills(reqStart, reqEnd) {
    const _span = this._monthSpan(reqStart, reqEnd);
    const startYmd = _span.s, endYmd = _span.e;
    const bills = this.bills();
    const out = [];
    const covered = new Set();
    /* ⚠⚠ A BILL THE OPERATOR LOGGED THEMSELVES COVERS THAT MONTH TOO (S226c). The comment above
       claims "nothing double counts", and for a generated CHILD that was true — the key is the
       parent's id. But a bill entered by hand, or imported off a bank register, carries no
       recurring_parent, so it keyed on its own id and suppressed nothing: measured, an operator with
       a $4,200 recurring rent who also logged next month's rent saw $8,400 of rent in the forecast
       window against a truth of $4,200, feeding the survival forecast, the low-point week, the
       reserve target and Safe to Spend.
       ⚠ Same question, same answer, same key as the Operating Expenses catch-up — App.billIdentityKey
       is the one definition of it, precisely so these two cannot drift apart again. */
    const ownCovered = new Map();   // identity@month -> how many logged rows are still unclaimed
    const ownDate = new Map();      // identity@month -> the LATEST date logged for it (see below)
    bills.forEach(b => {
      const d = String(b.date || '').slice(0, 10);
      if (!d) return;
      /* ⚠⚠ THE MONTH A CHILD SATISFIES, NOT THE DATE TYPED IN IT — the same fact the catch-up was
         taught (S226b) and this was NOT, which made a half-migration worse than either whole.
         A generated row re-dated across a month boundary ("I paid July's rent on Aug 2") kept
         claiming AUGUST here, so August's own rent was never projected and no re-mint arrived to
         cover it: measured $12,600 of bills in a 13-week window against a truth of $16,800, an
         ending balance $4,200 HIGH, and the low-point week moved with it. Understating what leaves
         the bank is the dangerous direction — it feeds Safe to Spend, the runway and the lender PDF,
         and nothing on screen says a month is missing. */
      covered.add((b.recurring_parent || b.id) + '@' + String(b.recurring_month || d.slice(0, 7)));
      /* ⚠ CONSUME-ONCE, NOT "DOES ONE EXIST" (S226 round 2). A Set answered "is there an identical
         row this month?", so ONE logged payment cancelled EVERY series it matched: two identical
         equipment leases at $249 and a single $249 payment suppressed both, $498 of real outflow
         gone from the forecast. The importer solved this exact problem three files over with a
         consume-once `_used` set, under a comment about same-vendor same-amount repeats being ordinary
         in a bar. That lesson had not travelled. Each logged row now absorbs exactly ONE projection. */
      /* ⚠ A STOPPED SERIES PARENT IS NOT A HAND-LOGGED BILL (round 3, F6). Stopping a bill writes
         recurring:false, so the parent row sailed through this gate and spent a token — a bill the
         operator CANCELLED then quietly cancelled a month of one they did not. stopped_ym is the
         tell, and only a stopped series carries it. */
      if (!b.recurring && !b.recurring_parent && !b.stopped_ym) {
        const _k = App.billIdentityKey(b) + '@' + d.slice(0, 7);
        ownCovered.set(_k, (ownCovered.get(_k) || 0) + 1);
        /* ⚠⚠ AND A PAYMENT CANNOT SETTLE A BILL THAT IS NOT DUE YET (round 3, F2). The key was
           month-granular with no day test, so a $500 payment logged on the 3rd consumed the
           series occurrence due on the 25th — 22 days later — and entering a bill they really paid
           moved the forecast by exactly $0 while a month's rent silently left it. Worse on an ACH
           lag: rent due the 28th clearing on the 2nd of the NEXT month suppressed the FOLLOWING
           month's rent, which it had nothing to do with.
           This is a fact about time, not a threshold fitted to a fixture ([[the-loop]] #30): a
           logged row may only stand for an occurrence dated on or BEFORE it. Anything it cannot
           settle is simply projected, which errs toward showing more money leaving. */
        if (!ownDate.has(_k) || d > ownDate.get(_k)) ownDate.set(_k, d);
      }
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
        const ym = ymd.slice(0, 7);
        // A month the operator deleted off the Operating Expenses card is a decision, not a gap —
        // the same skip list the catch-up honours (S226a). Without this the forecast kept projecting
        // a month the operator had explicitly removed from the books.
        if (Array.isArray(p.skip_months) && p.skip_months.some(m => String(m) === ym)) continue;
        /* ⚠ THE ORDER MATCHES THE CATCH-UP'S (round 3, F5). This asked "did the operator log it?"
           BEFORE "is there already a generated row for it?", while hub-operating-expenses asks them
           the other way round — so a month already covered by a child still spent the logged row's
           token and left a second series unsuppressed. Two screens, same data, $500 apart. */
        const key = p.id + '@' + ym;
        if (covered.has(key)) continue;
        const _ok = App.billIdentityKey(p) + '@' + ym;
        const _on = ownCovered.get(_ok) || 0;
        if (_on > 0 && ownDate.get(_ok) && ownDate.get(_ok) >= ymd) { ownCovered.set(_ok, _on - 1); continue; }
        covered.add(key);
        out.push({ date: ymd, amount: amt, vendor: p.vendor || p.category || 'Bill', category: p.category || '', recurring: true, projected: true });
      }
    });
    // ...and only now cut to what the caller actually asked for.
    return out.filter(b => b.date >= reqStart && b.date <= reqEnd);
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
      /* ⚠⚠ THE PRORATION WAS APPLIED TO THE INFLOW AND NOT TO THE OUTFLOW, so the later in the week
         an operator looked, the poorer Bar Cop told them they were. Opening cash is a "right now"
         balance: on a Sunday it already reflects six days of sales AND six days of labor and
         purchases. Week 0 correctly projected only the sales still to come and then charged a FULL
         week of labor and recurring purchases against them.
         Measured on a $4,000-a-week bar with $2,500 labor and $1,000 purchases:
             Mon  wk0 sales $4,000  net   +$500      <- correct, the whole week is ahead
             Wed  wk0 sales $2,857  net     -$643
             Fri  wk0 sales $1,714  net   -$1,786
             Sun  wk0 sales   $571  net   -$2,929    <- truth is about +$71
         A ~$3,000 error in week one on a $4,000-a-week bar, feeding the RUNWAY line on Cash Audit,
         the low-point week, and the lender PDF. It reads pessimistic, which is the safe direction,
         but an operator checking on a Friday got a materially different answer than on a Monday for
         no reason in the world.
         ⚠ The comment on the outflow filter below already states this exact rule — "counting a bill
         dated earlier this same week (already paid, already out of opening) would double it". It was
         implemented for `bills` and `outflows`, which carry DATES and can be filtered, and could not
         be implemented for labor and recurring purchases, which carry none. The share is the same
         answer their date filter reaches. */
      let wk0Share = 1;
      if (i === 0) {
        // Opening cash is a "right now" balance that already reflects sales banked
        // earlier this week, so week 0 only projects the days still to come — else
        // the elapsed days are double-counted and the near-term runway overshoots.
        const dow = (new Date().getDay() + 6) % 7;   // 0=Mon .. 6=Sun
        wk0Share = (7 - dow) / 7;
        sales = sales * wk0Share;
      }
      // A SAVED forecast override already bundles this week's booked-event revenue
      // (Build Schedule adds it into the number you type), so adding the event
      // balance again would double-count. The baseline sales path is event-free, so
      // events ARE added there. Only add event cash when NOT on a saved override.
      const savedFc = App.forecastForWeek ? App.forecastForWeek(ws) : null;
      // `!= null`, NOT truthiness — the same test tier 1 of revenueForWeek uses, for the same
      // reason: saveForecast accepts val >= 0 and a $0 week is a real answer (closed for
      // renovation), not a missing one. Under a bare truthiness test a saved $0 put the week on
      // the NON-override path for EVENTS while sales correctly read $0, so a closed week with a
      // booked event showed that booking's balance as incoming cash — and saving $0 produced a
      // HIGHER forecast than saving $1.
      const onOverride = !!(savedFc && savedFc.total != null);
      // NOT date-filtered for week 0, unlike sales and _future0 below. That asymmetry is
      // correct: eventInflow already drops any booking with a balance_paid_date, so a
      // balance collected earlier this week is excluded at the source and cannot be
      // double-counted against opening cash. The only rows a today-or-later gate removes
      // are UNCOLLECTED balances dated Mon..yesterday, which are still owed to you and
      // are in no other week either (every later week starts on a future Monday), so
      // gating here silently deleted them from the whole 13-week forecast.
      const ev = this.eventInflow(ws, we, start);
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
      /* ⚠ PRORATED AND *DISPLAYED* PRORATED. The row is what the forecast table prints column by
         column, and `verify-forecast-column-tieouts` asserts inflow - out = net on every row, so
         charging a prorated figure while showing the full one would put a lie in the table and break
         the tie-out. One number, used and shown. `extraOut` is deliberately NOT prorated: those are
         explicit "what if I spend this" entries an operator typed for this week, not a recurring
         cost that has been quietly draining since Monday. */
      /* ⚠⚠ REFUNDS ARE OUTFLOW, AND THEY ARE DELIBERATELY NOT PUT THROUGH `_future0`. A deposit the
         bar has agreed to give back and has not yet paid is money still to leave, exactly as an
         uncollected balance is money still to arrive — and `eventRefundsOwed` already drops one that
         HAS been paid (`deposit_refund_date`), so nothing here can double against opening cash. Put
         through the today-or-later gate it would be deleted from the whole quarter: the anchor clamps
         an overdue obligation into week 0, and every later week starts on a future Monday. That is
         the identical asymmetry the inflow comment above explains, and for the identical reason.
         ⚠ Not suppressed on a saved override either: an override is the operator's SALES number for
         the week, and a refund is not sales. */
      const refunds = this.eventRefundsOwed(ws, we, start);
      const labCost = lab.cost * wk0Share;
      const purchWk = purch * wk0Share;
      const out = labCost + purchWk + bills + outflows + extraOut + refunds.total;
      const net = inflow - out;
      bal += net;
      // ⚠ `refunds` rides in the OUTFLOWS column so the table's inflow - out = net tie-out holds
      // (verify-forecast-column-tieouts asserts it on every row). It carries NO list: a `refundList`
      // field was added here and read nowhere, under a comment claiming it WAS read — [[the-loop]]
      // #25 and a confidence claim in a comment, in one line. c-forecast asks the engine directly.
      rows.push({ ws, we, i, sales, events: evAdd, eventList: ev.list, inflow, labor: labCost, laborSource: lab.source, purchases: purchWk, bills, billRecs, outflows: outflows + refunds.total, ofRecs, extra: extraOut, out, net, balance: bal });
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
    // ⚠ BARE `App`, NOT `window.App` (S320). Same defect as pos-ingest: `App` is a top-level `const`
    // and never lands on `window`, so this could never return 'demo' and the demo's cash state was
    // scoped to whatever real account id was resolved instead of to its own key.
    if (App.demoMode) return 'demo';
    return (window.DB && DB._accountId)
      || (window.DB && DB._getStoredActiveAccountId && DB._getStoredActiveAccountId())
      || 'none';
  },
  _key(base) { return base + '::' + this._acctScope(); },
  // One-time move of a pre-sync device-local cash setting onto the account, so an existing
  // operator's opening balance, tax, reserve, credit etc. are not lost the first time this
  // ships. Reads the old localStorage key, migrates it onto the account, returns the value.
  _migCfg(key) { try { const oldK = this._key(key); const old = localStorage.getItem(oldK); if (old != null && old !== '') { Promise.resolve(App.acctSet(key, old)).then(ok => { if (ok) { try { localStorage.removeItem(oldK); } catch (e) {} } }); return old; } } catch (e) {} return null; },   // removeItem ONLY after the migrate save is CONFIRMED — an eager remove after a failed/gated save would lose the value. Leaving the old key until confirmed is safe (acctGet reads the account first), and once confirmed the remove still prevents a cleared value from resurrecting.
  _cfgNum(key, def) { let v = App.acctGet(key); if (v == null) v = this._migCfg(key); const n = parseFloat(v); return isNaN(n) ? def : n; },
  _cfgSet(key, v) { return App.acctSet(key, (v == null || v === '') ? null : String(v)); },
  salesTaxRate()   { return this._cfgNum('cash_sales_tax_rate', 0); },
  setSalesTaxRate(v) { return this._cfgSet('cash_sales_tax_rate', v); },
  taxFrequency()   { let v = App.acctGet('cash_tax_freq'); if (v == null) v = this._migCfg('cash_tax_freq'); return v || 'monthly'; },
  setTaxFrequency(v) { return App.acctSet('cash_tax_freq', v === 'quarterly' ? 'quarterly' : 'monthly'); },
  payrollBurden()  { return this._cfgNum('cash_payroll_burden', 0); },
  setPayrollBurden(v) { return this._cfgSet('cash_payroll_burden', v); },
  /* ⛔ FLOORED AT ZERO, AND IT IS THE FLOOR THAT MATTERS MOST OF THE THREE ON THIS FORM.
     Cash Position writes reserve weeks, available credit and gift cards from three number
     inputs, none of which carries a `min`. The other two were already floored on read; this
     one was not, and it is the one that SUBTRACTS:
         reserveTarget() = reserveWeeks() * weeklyFixedCosts()
         position().safe = cushion - reserveTarget()
     so a negative weeks value made the target negative and the subtraction ADDED money.
     Measured live at -3 weeks on a bank balance of -$5,000: Safe to Spend read +$4,821.32 in
     green, the Cash Audit went 66 -> 71, and three separate warnings gated on `safe < 0` /
     `reserve > 0` all fell silent at once. An overdrawn bar was told it had money to spend.
     The floor lives on the READ because that is the single door every consumer comes through
     (Cash Position, the Forecast's Save, a restored backup) — a guard on one form is a guard
     on one form. An explicit 0 stays legitimate: it means "I do not want a reserve".
     ⚠ It also fixes weeklyFixedCosts, whose horizon is `(reserveWeeks() || 8) * 7` days
     FORWARD — at -3 that ran 21 days backwards and silently changed which recurring bills the
     reserve was sized from. Pinned in verify-reserve-weeks-floor.js. */
  reserveWeeks()   { return Math.max(0, this._cfgNum('cash_reserve_weeks', 8)); },
  setReserveWeeks(v) { return this._cfgSet('cash_reserve_weeks', v); },
  // Available credit (a line of credit or card) is the backstop you actually lean
  // on in a thin week, so it extends the survival runway past the bank balance.
  availableCredit() { return Math.max(0, this._cfgNum('cash_available_credit', 0)); },
  setAvailableCredit(v) { return this._cfgSet('cash_available_credit', v); },
  // Outstanding gift cards are cash you collected but owe product against, the same
  // trap as spending the sales tax, so they are money that isn't yours to spend.
  giftCardLiability() { return Math.max(0, this._cfgNum('cash_gift_card_liability', 0)); },
  setGiftCardLiability(v) { return this._cfgSet('cash_gift_card_liability', v); },

  // Weekly fixed overhead: the recurring bills (rent, utilities, insurance, loan),
  // normalized to a week by their frequency (monthly / quarterly / annual), so a
  // quarterly or annual bill is not weighted as if it hit every month.
  weeklyFixedCosts() {
    const cur = App.todayLocal().slice(0, 7);   // current YYYY-MM
    // The last month this reserve actually reaches — see the note on the start test below.
    const _hz = new Date(); _hz.setHours(0, 0, 0, 0); _hz.setDate(_hz.getDate() + (this.reserveWeeks() || 8) * 7);
    const horizonYm = App.ymdLocal(_hz).slice(0, 7);
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
      /* ⚠⚠ "NOT STARTED YET" IS MEASURED AGAINST THE RESERVE'S OWN HORIZON, NOT AGAINST TODAY
         (round 4 introduced this test; round 5 corrected its boundary). A bill entered with its
         first payment months out should not be in the nut — but this reserve is a FORWARD claim
         ("N weeks of fixed costs with no sales"), so a bill starting INSIDE that horizon is
         precisely what it exists to cover. Cutting at the current month made it a one-day cliff:
         measured, a loan dated the 31st gave a reserve of $11,169.23 and the SAME loan dated the
         1st gave $7,753.85 — Safe to Spend moving $3,415 for one day, while the 13-week forecast
         charged $3,700 of that loan inside the very weeks the reserve covers.
         ⚠ hub-breakeven deliberately keeps the strict "has started" test and does NOT copy this:
         break-even answers "what must I ring THIS week", which is not a forward horizon. Two
         questions, two boundaries, both stated ([[the-loop]] #29). */
      if (String(b.date || '').slice(0, 7) > horizonYm) return;
      /* ⚠ skip_months IS DELIBERATELY NOT READ HERE, AND THIS IS THE REASONING SO THE NEXT ROUND
         DOES NOT RE-OPEN IT (S228b, [[the-loop]] #29). A scan flagged that the reserve target keeps
         charging a month the operator deleted while projectedBills has dropped it. That is correct:
         this function is a RATE, not a schedule — the annual nut over 52 weeks, "what a typical week
         of fixed costs takes". A one-off skipped month (a bill not paid in March) does not change
         what a typical week costs, and letting it lower the reserve permanently would be wrong in
         the dangerous direction. Stopped and fully-paid series ARE dropped, two lines above,
         because those change the ongoing rate. */
      const amt = parseFloat(b.amount) || 0;
      const perYear = b.frequency === 'quarterly' ? 4 : b.frequency === 'annual' ? 1 : 12;
      annual += amt * perYear;
    });
    /* ⚠⚠ DEBT SERVICE IS A FIXED COST AND THIS FUNCTION COULD NOT SEE IT (round 3, F3). It read only
       bills() — the operating-expense log — while loan and equipment payments live in the SEPARATE
       cash_outflows store, and the operating-expense category list has no debt-service line at all,
       so there was no way to enter one where this would find it. Its own doc comment already
       promised "rent, utilities, insurance, LOAN". Measured: an $1,850/mo loan left the weekly nut
       at $1,057.69 instead of $1,484.62, the 8-week reserve target $8,461 instead of $11,877, and
       Safe to Spend — the number the whole Cash Position page exists to produce — reading $3,415
       HIGH, permanently. The dangerous direction, and outflowsBetween was charging that very series
       into the 13-week forecast the whole time, so the two figures on the same screen disagreed
       about what a fixed cost is.
       ⚠ WHAT IS DELIBERATELY EXCLUDED, and why, so this is not re-opened as an omission:
         · type 'tax' — a sales-tax remittance is collected money passing through, not a cost of
           opening the doors, and setAside() already reserves it. Counting it here would hold it back
           twice.
         · type 'draw' — an owner draw is not a cost the bar must cover to survive a week with no
           sales; it is the first thing an owner suspends. The reserve answers "can I keep the doors
           open", and a draw is not part of that question.
       Stopped and fully-paid series are dropped on the same terms as the bills above. */
    this.cashOutflows().forEach(o => {
      if (!o || !o.recurring) return;
      if (o.type !== 'loan' && o.type !== 'capital') return;
      /* ⚠ AGAINST THE RESERVE'S OWN HORIZON, not against today. A series stopped from NEXT month has
         no payments left at all — stopping records "no occurrence in or after this month" — so
         holding weeks of reserve against it withholds money for a bill that will never arrive.
         Comparing to the horizon rather than dropping every stopped series also stays correct for a
         stop set FURTHER out than the reserve reaches, where the payments in between are real. */
      if (o.stopped_ym && o.stopped_ym <= horizonYm) return;
      const endYm = this.recurringEndYm(o);
      if (endYm && endYm < cur) return;
      if (String(o.date || '').slice(0, 7) > horizonYm) return;   // see the bills half
      const amt = parseFloat(o.amount) || 0;
      const perYear = o.frequency === 'quarterly' ? 4 : o.frequency === 'annual' ? 1 : 12;
      annual += amt * perYear;
    });
    /* ⚠⚠⚠ SALARIED PAY IS A FIXED COST AND THIS RESERVE COULD NOT SEE IT (found on screen by Kyle,
       2026-07-28, by putting Break-Even and Cash Position side by side). This function is the whole
       basis of "N weeks of fixed costs with no sales" — and if a bar rings nothing for eight weeks it
       still owes its salaried managers. That is what SALARIED means; hourly is the part that flexes.
       hub-breakeven has always known it ("Salaried pay does not flex with sales, so it sits in the
       nut"), so the two screens printed two different weekly fixed costs from the same data: the Nut
       $5,608.76/wk against this function's $4,301.08/wk, the gap being salaried pay exactly.
       Measured on the Anchor Bar: an 8-week reserve target of $34,408.62 against a true $44,870.08,
       so **Safe to Spend read -$2,186.87 when the truth was -$12,648.33** — the operator told they
       were $2,187 short of their reserve when they were $12,648 short. The DANGEROUS direction, on
       the number the entire Cash Position page exists to produce.
       ⚠ NOT A DOUBLE COUNT WITH THE FORECAST: survivalForecast charges labour week by week as money
       LEAVING; this is a target for how much cushion to HOLD. Different questions, different numbers.
       ⚠ One full week through the canonical App.salariedCost, exactly as hub-breakeven does it, so
       the two screens cannot drift apart again. */
    const _wkEnd = App.nextSunday ? App.nextSunday() : App.todayLocal();
    const _wkStart = App.weekStartFor ? App.weekStartFor(_wkEnd) : _wkEnd;
    const _salaried = App.salariedCost ? ((App.salariedCost(_wkStart, _wkEnd) || {}).total || 0) : 0;
    return annual / 52 + _salaried;
  },

  _taxPeriodBounds() {
    const now = new Date();
    if (this.taxFrequency() === 'quarterly') {
      const q = Math.floor(now.getMonth() / 3);
      return { start: App.ymdLocal(new Date(now.getFullYear(), q * 3, 1)), end: App.ymdLocal(now), label: 'this quarter' };
    }
    return { start: App.ymdLocal(new Date(now.getFullYear(), now.getMonth(), 1)), end: App.ymdLocal(now), label: 'this month' };
  },
  // Bar + floor sales in a date window, preferring the operator's Confirm-the-Week figure over
  // the raw shift log wherever a whole week is covered. (This block used to say the correction
  // was applied as a bounded ratio — that is no longer true; see below.)
  _salesBetween(s, e) {
    // EXACT confirmed substitution, not a blended ratio. Both callers are money you OWE — the
    // sales-tax hold behind Safe to Spend and the projected remittances — so they must read the
    // revenue the operator reconciled. The first cut multiplied the raw total by
    // _confirmationRatio(), which was doubly wrong: it approximated when the exact confirmed
    // figure was sitting right there, and Cash Position prints this verbatim as "Tax on your $X
    // sales", so it put a dollar amount on screen that reconciled against no other view in the
    // app. Substitute per WEEK instead.
    // A week only qualifies if its ENTIRE Mon..Sun span is inside the range — a partial week
    // cannot take a whole-week total, so those keep the raw daily sum.
    const byWeek = {};
    ((App.shiftData && App.shiftData.sc_shifts) || []).forEach(sh => {
      const d = String(sh.date || '').slice(0, 10); if (!d || d < s || d > e) return;
      const wk = this._mondayOf(new Date(d + 'T00:00:00'));
      byWeek[wk] = (byWeek[wk] || 0) + (parseFloat(sh.bar_revenue) || 0) + (parseFloat(sh.floor_revenue) || 0);
    });
    // Same orphan case as _recentWeeklySales: a confirmed week with no shift rows was never a
    // key, so it contributed $0 to the sales-tax hold and the projected remittances. Only WHOLE
    // weeks qualify — a partial one cannot take a whole-week total, and with no shift rows there
    // is no daily granularity to prorate, so it stays out rather than being guessed at.
    ((App.data && App.data.revenue_weeks) || []).forEach(w => {
      const pe = String(w.period_end || '').slice(0, 10); if (!pe) return;
      const wk = this._mondayOf(new Date(pe + 'T00:00:00'));  // see _recentWeeklySales: never period_end - 6
      if (byWeek[wk] != null) return;                   // never overwrite logged data
      if (!(wk >= s && pe <= e)) return;                 // the whole Mon..Sun span must be in range
      if (this._confirmedWeekTotal(wk) == null) return;  // catering-only week: nothing to substitute
      byWeek[wk] = 0;
    });
    // Whole + confirmed -> the exact reconciled figure. Everything else -> the RAW logged sum.
    // NO extrapolation. An earlier attempt scaled the unconfirmed weeks by a blended
    // "confirmation ratio" to avoid a month-start lag; that was worse. The ratio is gated at two
    // confirmed weeks, so confirming one routine week flipped it 1.00 -> 1.30 and re-scaled every
    // OTHER week in the window: month-to-date sales jumped ~$7.7k on a $38k month with no new
    // sales, only $3k of which belonged to the week confirmed. It also ran BACKWARDS when a week
    // aged out of the 8-week sample. A displayed actual must not move for reasons the operator
    // cannot point at.
    // The remaining lag is honest: early in a month no week is whole yet, so the hold reflects
    // what has been logged. Each week that clears moves it by that week's OWN correction, which
    // is attributable and explicable. A number that is late is recoverable; a number that moves
    // for invisible reasons destroys trust in every number beside it.
    let t = 0;
    Object.keys(byWeek).forEach(wk => {
      const whole = wk >= s && this._addDays(wk, 6) <= e;
      const conf = whole ? this._confirmedWeekTotal(wk) : null;
      t += (conf != null ? conf : byWeek[wk]);
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
  /* ⭐⭐⭐ THE CUTOVER. This reads the ONE LEDGER now, filtered to the rows that are money out.
     `App.data.cash_outflows` is no longer the source of truth for anything: the Cash Outflows door
     writes both stores, `reconcileCashOutflowLedger` guarantees the ledger is a pure function of the
     old one on every load, and `repairGeneratedCashRows` has removed the child rows the old catch-up
     generated. Phase 5 deletes the old store; until then it stays whole and readable.

     ⛔ THE FILTER IS `migrated_from`, NOT THE CATEGORY NAME, AND THAT IS THE WHOLE POINT. The name is
     a string the operator can type — an expense they filed under a category they called "Owner Draw"
     is THEIR bill and belongs on the P&L, not in the cash forecast. Every genuine cash row carries
     `migrated_from: 'cash_outflow'` because `migrateCashOutflowRow` stamps it and nothing else
     writes one. `_isOperatingRow` splits the same three shapes the same way from the other side, so
     a row is on exactly one of the two lists and can never be on both or neither.

     ⚠ Proved identical to the old reader across eight figures from this engine plus break-even's
     debt line, over the same records, by verify-outflow-migration-equality.js. */
  cashOutflows() {
    const rows = (App.data && Array.isArray(App.data.operating_expenses)) ? App.data.operating_expenses : [];
    return rows.filter(r => r && r.migrated_from === 'cash_outflow');
  },
  _outflowLabel(t) { return t === 'draw' ? 'Owner draw' : t === 'loan' ? 'Loan payment' : t === 'tax' ? 'Tax remittance' : t === 'capital' ? 'Capital / equipment' : 'Other'; },
  outflowsBetween(reqStart, reqEnd) {
    const _span = this._monthSpan(reqStart, reqEnd);   // see projectedBills — same reason
    const startYmd = _span.s, endYmd = _span.e;
    const recs = this.cashOutflows();
    const out = []; const covered = new Set();
    /* ⚠⚠ THE SAME QUESTION projectedBills ASKS, ANSWERED THE SAME WAY (S228a). This is a
       line-for-line twin of that projection loop and it had neither the consume-once cover test nor
       the skip list — so a loan payment the operator logged by hand beside a recurring loan series
       counted TWICE: measured 3 rows / $5,550 through the expense door against 4 rows / $7,400
       through this one, on the same money. The direction was pessimistic, which is why it would
       never have been reported, but one file answering one question two ways is the drift that
       produced every defect in this family. */
    const ownCovered = new Map();
    const ownDate = new Map();
    recs.forEach(o => {
      const d = String(o.date || '').slice(0, 10); if (!d) return;
      covered.add((o.recurring_parent || o.id) + '@' + String(o.recurring_month || d.slice(0, 7)));
      if (!o.recurring && !o.recurring_parent && !o.stopped_ym) {
        const _k = App.billIdentityKey(o) + '@' + d.slice(0, 7);
        ownCovered.set(_k, (ownCovered.get(_k) || 0) + 1);
        if (!ownDate.has(_k) || d > ownDate.get(_k)) ownDate.set(_k, d);   // see projectedBills
      }
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
        const _ym = ymd.slice(0, 7);
        if (Array.isArray(p.skip_months) && p.skip_months.some(m => String(m) === _ym)) continue;
        const key = p.id + '@' + _ym; if (covered.has(key)) continue;
        const _ok = App.billIdentityKey(p) + '@' + _ym;
        const _on = ownCovered.get(_ok) || 0;
        if (_on > 0 && ownDate.get(_ok) && ownDate.get(_ok) >= ymd) { ownCovered.set(_ok, _on - 1); continue; }
        covered.add(key);
        out.push({ date: ymd, amount: amt, type: p.type || 'capital', label: p.notes || this._outflowLabel(p.type), projected: true, recurring_parent: p.id });
      }
    });
    return out.filter(o => o.date >= reqStart && o.date <= reqEnd);
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
    /* ⚠⚠ A RECURRING TAX OUTFLOW WAS COUNTED TWICE (round 3, F4). This built its "the operator has
       already entered a remittance for this month" set from RAW rows only, so it could see a tax
       outflow physically dated in a month but never the ones outflowsBetween PROJECTS from a
       recurring tax series — and survivalForecast concatenates both lists. Setting sales tax up as
       a recurring outflow is the obvious move (the type is in the dropdown and Recurring is on the
       same form), and it charged sales tax roughly twice every month, forever. Pessimistic, which is
       why nobody would ever report it; it just makes the runway and the low point wrong.
       Asking outflowsBetween over the same window means the projection and the suppression can never
       disagree about which months a tax series covers. */
    this.cashOutflows().forEach(o => { if (o && o.type === 'tax' && o.date) manualMonths.add(String(o.date).slice(0, 7)); });
    /* ⚠⚠ ASK OVER THE WHOLE MONTH, NOT THE WINDOW WE WERE HANDED (round 4). The round-3 fix was
       right and almost entirely INERT, because the only caller — survivalForecast — asks this one
       WEEK at a time. A month was therefore suppressed only when the tax series' occurrence happened
       to fall in the same Mon-Sun week as the 20th: measured, `recur_day` 20 worked and 1, 15 and 25
       all still double-charged, putting ~$17,500 of phantom tax into a 13-week forecast and taking
       the ending balance from $226,600 to $209,143.
       A month is covered or it is not — that question has nothing to do with the slice of time the
       caller happens to be rendering. Widen to the enclosing months before asking. */
    const _mStart = String(startYmd).slice(0, 7) + '-01';
    const _mEndD = new Date(parseInt(String(endYmd).slice(0, 4), 10), parseInt(String(endYmd).slice(5, 7), 10), 0);
    const _mEnd = App.ymdLocal(_mEndD);
    this.outflowsBetween(_mStart, _mEnd).forEach(o => { if (o && o.type === 'tax' && o.date) manualMonths.add(String(o.date).slice(0, 7)); });
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
