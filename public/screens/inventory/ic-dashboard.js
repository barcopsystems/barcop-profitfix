'use strict';

/* ── Inventory Control — Close The Week (landing screen) ──────────────────────
   Same pattern as the Shift / Labor weekly closes: a "CLOSE OUT YOUR WEEK" banner
   with a week-stepper and progress bar, then the week's inventory steps top to
   bottom (take the count, receive deliveries, place orders, review flags). The
   current step opens inline; deeper work (Take Inventory, Order Sheet, the
   reports) launches out. A status strip carries the KPIs, and once the week is
   current the rich readout (cash by category, movement, since-last-count, leaks)
   drops in as the payoff. Every number is computed from real data — no scores. */

S.InventoryDashboard = {
  _weekStart: null,   // Monday of the selected week
  _openStep: null,
  _flash: null,
  _st: null,

  showHowTo() {
    App.showHelpModal('How the Weekly Close Works', [
      { p: ['This is your weekly close-out for Inventory. You land on the week, see how far along you are, and work the steps top to bottom. Open a step to do it; when the week is done it reads "You\'re current this week" and the full readout drops in below.'] },
      { h: 'Where You Stand', p: ['The card up top reads your inventory value on hand and how many weeks of business that covers, then breaks down where your shelf cash sits: what is on the reorder, what you used this period, and shrinkage over the last 30 days. Hit Bar Cop Briefing for a written read of your week in plain language.'] },
      { h: 'The Steps', p: ['1. Take this week\'s count: count your inventory in Take Inventory. 2. Receive deliveries: log anything that came in since your last count, or mark it none. 3. Place your orders: everything below par, grouped by vendor, with the cost to refill, and create the orders in the Order Sheet. 4. Review the flags: shrinkage written off, spot-check flags, and dead stock worth chasing.'] },
      { h: 'Working A Step', p: ['Click a step to open it. Take Inventory, Receive Delivery, and the Order Sheet open the full screen and come back. Mark a step done and the bar advances; mark it not done to reopen it. The week selector steps you back to close out a prior week.'] },
      { h: 'The Readout', p: ['Once the week is current, the readout below breaks your cash down by category, shows what is moving fast, slow, and not at all, the honest direction since your last count, and any leaks worth chasing. The As-needed row keeps Spot Check and Par Suggestions one tap away.'] }
    ]);
  },

  // ── Data ─────────────────────────────────────────────────────────────────────
  countsAsc() {
    return [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort(App.cmpOldest);
  },
  deliveries()   { return ((App.inventoryData && App.inventoryData.ic_deliveries) || []); },
  products()     { return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false); },
  adjustments()  { return ((App.inventoryData && App.inventoryData.ic_adjustments) || []); },
  spotChecks()   { return ((App.inventoryData && App.inventoryData.ic_spot_checks) || []); },
  locations()    { return ((App.inventoryData && App.inventoryData.ic_locations) || []); },
  vendors()      { return ((App.inventoryData && App.inventoryData.ic_vendors) || []); },
  productById(id){ return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id); },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },
  daysSince(str) {
    if (!str) return null;
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  },
  _onHand(count) {
    const m = {};
    // Skip counted:false items: a stored total:0 means "not counted this pass", not "empty".
    // Counting it as 0 on hand made a partial count read products as below reorder and
    // falsely dragged the "In-stock vs reorder" / dead-stock trend down. Mirrors _perpetualInventory.
    (count.items || []).forEach(it => { if (it.counted === false) return; m[it.product_id] = (m[it.product_id] || 0) + (it.total || 0); });
    return m;
  },

  // ── Health signals at a given count index — raw, honest metrics (no score) ──
  _signalsAt(asc, idx) {
    const latest = asc[idx];
    if (!latest) return null;
    const prevC = idx >= 1 ? asc[idx - 1] : null;
    const onHand = this._onHand(latest);
    const comps = [];

    let counted = 0, atRisk = 0;
    Object.keys(onHand).forEach(pid => {
      const p = this.productById(pid); if (!p) return;
      const trig = (p.reorder_point != null && p.reorder_point !== '') ? parseFloat(p.reorder_point) : parseFloat(p.par_level);
      if (isNaN(trig) || trig <= 0) return;
      counted++; if (onHand[pid] < trig) atRisk++;
    });
    if (counted > 0) comps.push({ key: 'stock', label: 'In-stock vs reorder', raw: (counted - atRisk) / counted * 100, lowerBetter: false, fmt: v => Math.round(v) + '% stocked' });

    const PS = S.InventoryParSuggestions;
    if (prevC && PS && PS.settings && PS.computeSuggestion) {
      const settings = PS.settings();
      let withPar = 0, tuned = 0;
      this.products().forEach(p => {
        if (p.par_level == null || p.par_level === '') return;
        const sug = PS.computeSuggestion(p, settings, latest.date);
        if (!sug || sug.suggested == null) return;
        withPar++;
        const cur = Math.round(parseFloat(p.par_level) || 0);
        const diff = Math.abs(sug.suggested - cur);
        if (!(diff >= 1 && diff >= cur * 0.25)) tuned++;
      });
      if (withPar > 0) comps.push({ key: 'par', label: 'Par accuracy', raw: tuned / withPar * 100, lowerBetter: false, fmt: v => Math.round(v) + '% on target', off: withPar - tuned });
    }

    const end = new Date(latest.date + 'T00:00:00').getTime();
    const start = end - 30 * 86400000;
    let shrink = 0;
    this.adjustments().forEach(a => {
      if (a.direction !== 'out') return;
      const t = new Date(a.date_time || a.created_at || 0).getTime();
      if (isNaN(t) || t > end || t < start) return;
      shrink += Math.abs(a.value || 0);
    });
    comps.push({ key: 'shrink', label: 'Shrinkage (30d)', raw: shrink, lowerBetter: true, fmt: v => App.fmtCurrency(v) });

    if (prevC) {
      const gap = (end - new Date(prevC.date + 'T00:00:00').getTime()) / 86400000;
      comps.push({ key: 'count_gap', label: 'Days between counts', raw: gap, lowerBetter: true, fmt: v => Math.round(v) + 'd apart' });
    }

    if (prevC) {
      const base = App.computeUsagePair(prevC, latest, this.deliveries());
      let dead = 0;
      Object.keys(onHand).forEach(pid => {
        const p = this.productById(pid); if (!p || onHand[pid] <= 0) return;
        const used = base[pid] ? Math.max(0, base[pid].rawUsed) : 0;
        if (used > 0.001) return;
        dead += onHand[pid] * (App.unitCost(p) || 0);
      });
      comps.push({ key: 'dead', label: 'Dead stock', raw: dead, lowerBetter: true, fmt: v => App.fmtCurrency(v) });
    }
    return { comps };
  },

  // ── Week (Monday-based) ──────────────────────────────────────────────────────
  mondayOf(d) {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return App.ymdLocal(date);
  },
  addDays(dateStr, n) { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n); return App.ymdLocal(d); },
  todayMonday()   { return this.mondayOf(new Date()); },
  weekStart()     { return this._weekStart || this.todayMonday(); },
  weekEnd()       { return this.addDays(this.weekStart(), 6); },
  inWeek(d)       { const s = this.weekStart(), e = this.weekEnd(); d = String(d || '').slice(0, 10); return !!d && d >= s && d <= e; },
  atCurrentWeek() { return this.weekStart() >= this.todayMonday(); },
  _stepWeek(n) {
    const next = this.addDays(this.weekStart(), n);
    if (n > 0 && next > this.todayMonday()) return;
    this._weekStart = next;
    this._openStep = null;
    this.render(this.container, this.actions);
  },

  // ── Per-week step-done stamps (operator-controlled, local to the device) ─────
  _doneKey() { return 'ic_cockpit_done_' + this.weekStart(); },   // account-synced (App.data), follows the user across devices; no per-browser suffix
  doneMap()  { return App.acctGet(this._doneKey(), {}); },
  setDone(step, val) { const m = { ...this.doneMap() }; m[step] = val; App.acctSet(this._doneKey(), m); },

  ORDER: ['count', 'deliveries', 'orders', 'review'],
  // Compact step summary for the Hub Inventory card. Reuses this page's own
  // ORDER + stepDone + labels, forced to the current week, so the two can never
  // drift. Returns { steps:[{label,done}], doneCount, total }.
  hubSteps() {
    const sv = this._weekStart; this._weekStart = this.todayMonday();
    try {
      const st = this.computeState();
      const done = this.stepDone(st);
      const steps = this.ORDER.map(k => ({ key: k, label: this._META[k].title, done: !!done[k] }));
      const cur = v => App.fmtCurrency(v);
      const stats = [
        { label: 'Inventory Value', value: cur(st.inventoryValue) },
        { label: 'Below Par', value: cur(st.reorderTotal), warn: st.reorderCount > 0 },
        { label: 'Used', value: st.periodCost != null ? cur(st.periodCost) : '-' }
      ];
      return { steps, stats, doneCount: steps.filter(s => s.done).length, total: steps.length };
    } finally { this._weekStart = sv; }
  },
  // A step is done ONLY when the operator marks it. The week's data drives the
  // status text (counted date, everything at par) but never checks the box for
  // them — marking a step complete for the week is a deliberate manual action.
  stepDone(st) {
    const dm = this.doneMap();
    const r = {};
    this.ORDER.forEach(k => { r[k] = !!dm[k]; });
    return r;
  },

  // ── Heavy compute, once per render, shared by steps + strip + readout ────────
  computeState() {
    const asc = this.countsAsc();
    const latest = asc.length ? asc[asc.length - 1] : null;
    const prev = asc.length >= 2 ? asc[asc.length - 2] : null;
    const perp = App._perpetualInventory();
    const onHand = {};
    let inventoryValue = 0;
    Object.keys(perp).forEach(pid => { onHand[pid] = perp[pid].onHand; inventoryValue += (perp[pid].value || 0); });
    const lastAge = latest ? this.daysSince(latest.date) : null;
    // The count taken IN the selected week (latest one that week), so the step
    // reads that week's date, not the globally-newest count from a later week.
    const weekCounts = asc.filter(c => this.inWeek(c.date));
    const weekCount = weekCounts.length ? weekCounts[weekCounts.length - 1] : null;
    const hasCountThisWeek = !!weekCount;

    let base = null, periodCost = null, weeklyCogs = null, weeksOnHand = null;
    if (latest && prev) {
      base = App.computeUsagePair(prev, latest, this.deliveries());
      periodCost = Object.values(base).reduce((s, b) => s + (b.unitCost != null ? Math.max(0, b.rawUsed) * b.unitCost : 0), 0);
      const span = (new Date(latest.date + 'T00:00:00').getTime() - new Date(prev.date + 'T00:00:00').getTime()) / 86400000;
      const weeks = span > 0 ? span / 7 : null;
      weeklyCogs = weeks ? periodCost / weeks : null;
      weeksOnHand = (weeklyCogs && weeklyCogs > 0) ? inventoryValue / weeklyCogs : null;
    }

    const sigNow = latest ? this._signalsAt(asc, asc.length - 1) : null;
    const sigPrev = asc.length >= 3 ? this._signalsAt(asc, asc.length - 2) : null;
    const prevRaw = {};
    if (sigPrev) sigPrev.comps.forEach(c => { prevRaw[c.key] = c.raw; });

    // Reorder plan (same basis as Order Sheet: below par → fill to par).
    const byVendor = {};
    let reorderTotal = 0, reorderCount = 0, parChecked = 0;
    Object.keys(onHand).forEach(pid => {
      const p = this.productById(pid); if (!p) return;
      const par = parseFloat(p.par_level); if (isNaN(par) || par <= 0) return;
      parChecked++;
      const oh = onHand[pid]; if (oh >= par) return;
      const qty = Math.max(1, Math.ceil(par - oh));
      const cost = qty * (App.unitCost(p) || 0);
      const v = p.vendor || 'Unassigned';
      if (!byVendor[v]) byVendor[v] = { vendor: v, items: 0, cost: 0 };
      byVendor[v].items++; byVendor[v].cost += cost;
      reorderTotal += cost; reorderCount++;
    });
    const vendors = Object.values(byVendor).sort((a, b) => b.cost - a.cost);
    let parOff = 0;
    if (sigNow) { const pc = sigNow.comps.find(c => c.key === 'par'); if (pc) parOff = pc.off || 0; }

    // Movement — fast / slow / dead from the last period.
    const move = Object.keys(onHand).map(pid => {
      const p = this.productById(pid); if (!p) return null;
      const used = base && base[pid] ? Math.max(0, base[pid].rawUsed) : 0;
      const uc = App.unitCost(p) || 0;
      return { p, name: p.name, used, cost: used * uc, tied: onHand[pid] * uc, oh: onHand[pid] };
    }).filter(Boolean);
    const fast = base ? [...move].filter(m => m.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 3) : [];
    const dead = base ? [...move].filter(m => m.used <= 0.001 && m.oh > 0 && m.tied >= 15).sort((a, b) => b.tied - a.tied).slice(0, 3) : [];
    const fastIds = new Set(fast.map(m => m.p.id));
    const slow = base ? [...move].filter(m => m.used > 0.001 && m.oh > 0 && !fastIds.has(m.p.id)).sort((a, b) => a.cost - b.cost).slice(0, 3) : [];
    const deadAll = base ? move.filter(m => m.used <= 0.001 && m.oh > 0 && m.tied >= 15).length : 0;

    // Leaks (last 30 days).
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    let shrink = 0;
    this.adjustments().forEach(a => {
      if (a.direction !== 'out') return;
      const d = new Date(a.date_time || a.created_at || 0);
      if (isNaN(d.getTime()) || d < cutoff) return;
      shrink += Math.abs(a.value || 0);
    });
    let spotFlags = 0;
    this.spotChecks().forEach(s => {
      const d = new Date((s.date || '') + 'T00:00:00');
      if (isNaN(d.getTime()) || d < cutoff) return;
      spotFlags += (s.flagged_count || 0);
    });

    // Inventory value by category, from the perpetual on-hand (not just the latest count).
    const byCat = {};
    Object.keys(perp).forEach(pid => { const p = this.productById(pid); const c = (p && p.category) || 'Other'; byCat[c] = (byCat[c] || 0) + (perp[pid].value || 0); });
    const catRows = Object.entries(byCat).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);
    const catMax = catRows.length ? catRows[0][1] : 1;

    const deliveriesThisWeek = this.deliveries().filter(d => this.inWeek(d.date)).length;
    const menuOver = App.menuItemsOverTarget().length;

    return {
      asc, latest, prev, onHand, inventoryValue, lastAge, hasCountThisWeek, weekCount,
      base, periodCost, weeksOnHand, sigNow, prevRaw,
      vendors, reorderTotal, reorderCount, parOff, hasReorderBasis: parChecked > 0,
      fast, slow, dead, deadAll, shrink, spotFlags, catRows, catMax, deliveriesThisWeek, menuOver
    };
  },

  // ── Render ───────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container; this.actions = actions;
    if (actions) actions.innerHTML = '';

    const st = this._st = this.computeState();
    const done = this.stepDone(st);
    const doneCount = this.ORDER.filter(k => done[k]).length;
    if (this._openStep == null) this._openStep = this.ORDER.find(k => !done[k]) || '';
    const allDone = doneCount === this.ORDER.length;
    const flash = this._flash; this._flash = null;

    container.innerHTML = '<div class="screen">'
      + (st.latest ? this.whereYouStand(st) : this.getStartedBox())
      + this.banner(doneCount, this.ORDER.length)
      + (flash ? '<div style="font-size:12px;color:var(--green);font-weight:700;margin:12px 2px 0;">&#10003; ' + esc(flash) + '</div>' : '')
      + '<div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">'
      +   this.ORDER.map(k => this.stepRow(k, done)).join('')
      + '</div>'
      + (allDone ? this.readout(st) : '')
      + this.outlierStrip()
      + '</div>';
    this.wire();
  },

  // ── Week selector: ‹ [JUN 16 - JUN 22 NOW] › ─────────────────────────────────
  weekSelector() {
    const isCur = this.atCurrentWeek();
    const fmt = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(); };
    const range = fmt(this.weekStart()) + ' - ' + fmt(this.weekEnd());
    const nowBadge = isCur ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const prevBtn = '<button class="btn btn-ghost btn-sm ic-wk-prev" aria-label="Previous week" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = isCur
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm ic-wk-next" aria-label="Next week" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + esc(range) + nowBadge + '</span>';
    const nowBtn = isCur ? '' : '<button class="btn btn-ghost btn-sm ic-wk-now" style="margin-left:4px;">This Week</button>';
    return '<div style="display:inline-flex;align-items:center;gap:8px;">' + prevBtn + pill + nextBtn + nowBtn + '</div>';
  },

  banner(doneCount, total) {
    const allDone = doneCount === total;
    const pct = Math.round(doneCount / total * 100);
    const doneLine = allDone
      ? '<span style="color:var(--green);font-weight:700;">&#10003; You\'re current this week</span>'
      : '<span style="color:var(--t2);"><span style="color:var(--t1);font-weight:800;">' + doneCount + '</span> of ' + total + ' done this week</span>';
    return '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);overflow:hidden;margin-bottom:16px;">'
      + '<div style="padding:11px 22px;border-bottom:1px solid var(--b2);">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);">Close Out Your Week</div>'
      + '</div>'
      + '<div style="padding:18px 22px;">'
      +   this.weekSelector()
      +   '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:14px;">'
      +     '<div style="flex:1;min-width:160px;height:6px;background:var(--input);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--green);transition:width .2s;"></div></div>'
      +     '<div style="font-size:12px;">' + doneLine + '</div>'
      +   '</div>'
      +   (allDone ? '' : '<div style="font-size:11px;color:var(--t3);margin-top:12px;">Have ready: time to count, and any delivery invoices since your last count.</div>')
      + '</div>'
      + '</div>';
  },

  _META: {
    count:      { n: 1, title: 'Take this week\'s count', sub: 'Count your inventory' },
    deliveries: { n: 2, title: 'Receive deliveries',      sub: 'Log anything that came in since your last count' },
    orders:     { n: 3, title: 'Place your orders',       sub: 'Order what is below par, by vendor' },
    review:     { n: 4, title: 'Review the flags',        sub: 'Shrinkage, spot checks, dead stock' }
  },
  stepStatus(k, isDone) {
    const st = this._st;
    if (k === 'count') {
      if (st.hasCountThisWeek) return 'Counted ' + this.fmtDate((st.weekCount || st.latest).date);
      if (st.lastAge != null) return 'Last count ' + (st.lastAge === 0 ? 'today' : st.lastAge + 'd ago') + ', not counted this week';
      return this._META.count.sub;
    }
    if (k === 'deliveries') {
      const n = st.deliveriesThisWeek;
      return n ? (n + ' deliver' + (n === 1 ? 'y' : 'ies') + ' logged this week') : (isDone ? 'None this week' : this._META.deliveries.sub);
    }
    if (k === 'orders') {
      if (st.reorderCount) return App.fmtCurrency(st.reorderTotal) + ' to reorder, ' + st.vendors.length + ' vendor' + (st.vendors.length === 1 ? '' : 's');
      return st.hasReorderBasis ? 'Everything at par' : this._META.orders.sub;
    }
    if (k === 'review') {
      const flags = (st.shrink > 0 ? 1 : 0) + (st.spotFlags > 0 ? 1 : 0) + (st.deadAll > 0 ? 1 : 0) + (st.menuOver > 0 ? 1 : 0);
      return isDone ? 'Reviewed' : (flags ? flags + ' flag' + (flags === 1 ? '' : 's') + ' to review' : 'Nothing flagged');
    }
    return '';
  },
  stepRow(k, done) {
    const m = this._META[k], isDone = done[k], isOpen = this._openStep === k;
    const circle = isDone
      ? '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:13px;font-weight:800;">&#10003;</span>'
      : '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:11px;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,.45);">' + m.n + '</span>';
    const bg = isOpen ? 'var(--gold-tint)' : (isDone ? 'var(--input)' : 'var(--surface)');
    let html = '<div style="border:1px solid var(--b-edge);border-radius:var(--r);background:' + bg + ';overflow:hidden;">'
      + '<div class="ic-step-head' + (isOpen ? '' : ' collapsed') + '" data-step="' + k + '" style="display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;">'
      +   circle
      +   '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--t1);">' + m.title + '</div>'
      +     '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + this.stepStatus(k, isDone) + '</div></div>'
      +   '<span class="card-chevron" aria-hidden="true">&#9662;</span>'
      + '</div>';
    if (isOpen) html += '<div style="padding:2px 16px 18px;">' + this.workspace(k, isDone) + '</div>';
    return html + '</div>';
  },

  markBtn(k, label) {
    return this._isDone
      ? '<button class="btn btn-ghost btn-sm" data-undone="' + k + '">Mark not done</button>'
      : '<button class="btn btn-primary btn-sm" data-done="' + k + '">' + label + '</button>';
  },
  workspace(k, isDone) {
    this._isDone = isDone;
    const st = this._st;
    const explain = txt => '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">' + txt + '</div>';
    const btnRow = inner => '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' + inner + '</div>';

    if (k === 'count') {
      const lastInfo = st.latest
        ? 'Last count: ' + this.fmtDate(st.latest.date) + (st.lastAge != null ? ' (' + (st.lastAge === 0 ? 'today' : st.lastAge + 'd ago') + ')' : '')
        : 'No counts yet';
      return explain('Count your inventory for the week. Bar Cop values it, builds your reorder plan, and reads what you used since your last count.')
        + '<div style="font-size:12px;color:var(--t2);">' + lastInfo + '</div>'
        + btnRow('<button class="btn btn-ghost btn-sm" data-go="ic-take-inventory">Start Count</button>' + this.markBtn('count', 'Mark Done'));
    }
    if (k === 'deliveries') {
      return explain('Log anything that came in since your last count, checking each invoice against the order. Re-priced items feed Vendor Tracker. Nothing came in? Mark this done.')
        + '<div style="font-size:12px;color:var(--t2);">' + st.deliveriesThisWeek + ' deliver' + (st.deliveriesThisWeek === 1 ? 'y' : 'ies') + ' logged this week.</div>'
        + btnRow('<button class="btn btn-ghost btn-sm" data-go="ic-receive-delivery">Receive Delivery</button>' + this.markBtn('deliveries', 'Mark Done'));
    }
    if (k === 'orders') {
      if (st.reorderCount === 0) {
        const msg = st.hasReorderBasis
          ? 'Everything is at or above par. Nothing to reorder right now.'
          : 'No reorder plan yet. Take a count and set pars, and anything below par shows up here to order by vendor.';
        return '<div style="font-size:13px;color:var(--t2);padding:2px 0;">' + msg + '</div>'
          + (st.parOff ? this.parNudge(st.parOff) : '')
          + btnRow('<button class="btn btn-ghost btn-sm" data-go="ic-order-sheet">Open Order Sheet</button>' + this.markBtn('orders', 'Mark Done'));
      }
      const vRows = st.vendors.map((v, i) => {
        const order = (S.InventoryOrderSheet && S.InventoryOrderSheet.openOrderForVendor) ? S.InventoryOrderSheet.openOrderForVendor(v.vendor) : null;
        const action = order
          ? '<span data-go="ic-order-sheet" style="font-size:11px;font-weight:700;white-space:nowrap;cursor:pointer;color:' + (order.status === 'Submitted' ? 'var(--green)' : 'var(--gold)') + ';">Order ' + esc(order.status || 'Open') + '</span>'
          : '<button class="btn btn-ghost btn-sm" data-go="ic-order-sheet" style="margin:0;">Create Order</button>';
        return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;' + (i < st.vendors.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
          + '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;color:var(--t1);">' + esc(v.vendor) + '</div>'
          + '<div style="font-size:11px;color:var(--t3);">' + v.items + ' item' + (v.items === 1 ? '' : 's') + ' below par</div></div>'
          + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:20px;font-weight:600;color:var(--t1);white-space:nowrap;">' + App.fmtCurrency(v.cost) + '</div>'
          + '<div style="width:130px;flex-shrink:0;display:flex;justify-content:center;">' + action + '</div></div>';
      }).join('');
      return '<div style="font-size:12px;color:var(--t2);margin-bottom:6px;">Bring everything to par: <strong style="color:var(--gold);font-size:15px;">' + App.fmtCurrency(st.reorderTotal) + '</strong></div>'
        + vRows + (st.parOff ? this.parNudge(st.parOff) : '')
        + btnRow('<button class="btn btn-ghost btn-sm" data-go="ic-order-sheet">Open Order Sheet</button>' + this.markBtn('orders', 'Mark Done'));
    }
    // review
    const line = (label, val, screen, warn, open) =>
      '<div ' + (open ? 'data-open="' + screen + '"' : 'data-go="' + screen + '"') + ' style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--b2);cursor:pointer;">'
      + '<span style="font-size:12px;color:var(--t2);">' + label + '</span>'
      + '<span style="font-size:13px;font-weight:600;color:' + (warn ? 'var(--red)' : 'var(--t1)') + ';">' + val + ' &rsaquo;</span></div>';
    const anyFlag = st.shrink > 0 || st.spotFlags > 0 || st.deadAll > 0 || st.menuOver > 0;
    return line('Shrinkage written off (30d)', App.fmtCurrency(st.shrink), 'ic-adjustments', st.shrink > 0)
      + line('Spot-check flags (30d)', String(st.spotFlags), 'ic-spot-check', st.spotFlags > 0)
      + line('Dead stock items', String(st.deadAll), 'ic-report-usage', st.deadAll > 0)
      + line('Menu items over cost target', String(st.menuOver), 'recipe-cost-analysis', st.menuOver > 0, true)
      + (anyFlag ? '' : '<div style="font-size:11px;color:var(--gold);margin-top:8px;">Nothing flagged in the last 30 days. Clean.</div>')
      + btnRow('<button class="btn btn-ghost btn-sm" data-go="ic-report-variance">Open Variance</button>' + this.markBtn('review', 'Mark Reviewed'));
  },

  // ── Where You Stand (inventory headline + three-stat read + Briefing) ────────
  whereYouStand(st) {
    const counted = st.latest ? this.fmtDate(st.latest.date) : null;
    const sub = counted
      ? (st.weeksOnHand != null ? st.weeksOnHand.toFixed(1) + ' weeks on hand &middot; counted ' + counted : 'counted ' + counted)
      : 'take your first count to fill this in';
    const hero = '<div style="padding:2px 0;">'
      + '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">'
      +   '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:600;line-height:0.9;color:var(--w);">' + App.fmtCurrency(st.inventoryValue, 0) + '</span>'
      +   '<span style="font-size:13px;color:var(--t2);">on hand</span>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:12px;">' + sub + '</div></div>';
    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 30px;"></div>';
    const mini = (label, val, col) => '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:600;line-height:1;color:' + (col || 'var(--t1)') + ';">' + val + '</div></div>';
    const secondary = '<div style="margin-top:12px;padding-top:14px;border-top:1px solid var(--b2);">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Where Your Shelf Cash Went</div>'
      + '<div style="display:flex;align-items:flex-start;flex-wrap:wrap;">'
      +   mini('Below Par', App.fmtCurrency(st.reorderTotal, 0), st.reorderCount ? 'var(--amber)' : 'var(--t1)') + vdiv
      +   mini('Used This Period', st.periodCost != null ? App.fmtCurrency(st.periodCost, 0) : '-') + vdiv
      +   mini('Shrinkage 30d', App.fmtCurrency(st.shrink, 0), st.shrink > 0 ? 'var(--red)' : 'var(--t1)')
      + '</div>'
      + '<div style="margin-top:14px;"><button class="btn btn-ghost btn-sm" data-go="ic-report-variance">Variance Report</button></div>'
      + '</div>';
    return '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span>Where You Stand</span>'
      + '<button class="btn btn-ghost btn-sm" data-insights style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Bar Cop Briefing</button></div>'
      + hero + secondary + '</div>';
  },

  // ── Rich readout (the done-state payoff) ─────────────────────────────────────
  shPanel(title, bodyHtml) {
    return '<div class="sh" style="margin:0 0 10px;">' + title + '</div>'
      + '<div class="card" style="flex:1;">' + bodyHtml + '</div>';
  },
  row(a, b) {
    return '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;align-items:stretch;">'
      + '<div style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;">' + a + '</div>'
      + '<div style="flex:1 1 280px;min-width:0;display:flex;flex-direction:column;">' + b + '</div></div>';
  },
  catBody(st) {
    return st.catRows.length
      ? st.catRows.map(([cat, valv]) => {
          const pct = Math.max(2, Math.round(valv / st.catMax * 100));
          return '<div style="margin-bottom:11px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">'
            + '<span style="color:var(--t2);">' + esc(cat) + '</span><span style="color:var(--t1);font-weight:600;">' + App.fmtCurrency(valv) + '</span></div>'
            + '<div style="height:7px;background:var(--input);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--gold);"></div></div></div>';
        }).join('')
      : '<div style="font-size:12px;color:var(--t3);">No counted value yet.</div>';
  },
  moveBody(st) {
    const moveLine = (m, right) =>
      '<div style="display:flex;align-items:center;gap:10px;padding:5px 0;">'
      + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(m.name) + '</div>'
      + '<div style="font-size:12px;font-weight:600;color:var(--t1);white-space:nowrap;">' + right + '</div></div>';
    const moveBlock = (title, rows, emptyMsg, dotColor) =>
      '<div style="margin-bottom:10px;">'
      + '<div style="display:flex;align-items:center;gap:6px;font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">'
      + '<span style="width:6px;height:6px;border-radius:50%;background:' + dotColor + ';"></span>' + title + '</div>'
      + (rows.length ? rows : '<div style="font-size:11px;color:var(--t4);padding:2px 0;">' + emptyMsg + '</div>') + '</div>';
    return !st.base
      ? '<div style="font-size:12px;color:var(--t3);">Take a second count to see what is moving fast, slow, and not at all.</div>'
      : moveBlock('Fast Movers', st.fast.map(m => moveLine(m, App.fmtCurrency(m.cost) + ' used')).join(''), 'No usage recorded.', 'var(--gold)')
        + moveBlock('Slow Movers', st.slow.map(m => moveLine(m, App.fmtCurrency(m.cost) + ' used')).join(''), 'Nothing crawling.', 'var(--steel)')
        + moveBlock('Dead Stock', st.dead.map(m => moveLine(m, App.fmtCurrency(m.tied) + ' tied')).join(''), 'Nothing stale. Every product moved.', 'var(--red)');
  },
  sinceBody(st) {
    return st.sigNow && st.sigNow.comps.length
      ? st.sigNow.comps.map((c, i) => {
          const pv = st.prevRaw[c.key];
          let icon = '&#8226;', word = '', col = 'var(--t4)';
          if (pv != null) {
            const eps = 1e-6;
            const improved = c.lowerBetter ? c.raw < pv - eps : c.raw > pv + eps;
            const worsened = c.lowerBetter ? c.raw > pv + eps : c.raw < pv - eps;
            if (improved) { icon = '&#9650;'; word = 'Improving'; col = 'var(--gold)'; }
            else if (worsened) { icon = '&#9660;'; word = 'Slipping'; col = 'var(--red)'; }
            else { icon = '&#8211;'; word = 'Flat'; col = 'var(--t4)'; }
          }
          const detail = pv != null ? esc(c.fmt(pv)) + ' &rarr; ' + esc(c.fmt(c.raw)) : esc(c.fmt(c.raw));
          return '<div style="display:flex;align-items:center;gap:12px;padding:9px 0;' + (i < st.sigNow.comps.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<span style="width:14px;text-align:center;color:' + col + ';font-size:12px;flex-shrink:0;">' + icon + '</span>'
            + '<div style="flex:1;min-width:0;"><div style="font-size:12px;color:var(--t1);">' + c.label + '</div>'
            + '<div style="font-size:11px;color:var(--t3);">' + detail + '</div></div>'
            + '<span style="font-size:11px;font-weight:700;color:' + col + ';white-space:nowrap;">' + word + '</span></div>';
        }).join('')
      : '<div style="font-size:12px;color:var(--t3);">Trends appear once you have two counts.</div>';
  },
  leakBody(st) {
    const leakRow = (label, val, screen, warn) =>
      '<div data-go="' + screen + '" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--b2);cursor:pointer;">'
      + '<span style="font-size:12px;color:var(--t2);">' + label + '</span>'
      + '<span style="font-size:13px;font-weight:600;color:' + (warn ? 'var(--red)' : 'var(--t1)') + ';">' + val + ' &rsaquo;</span></div>';
    const anyLeak = st.shrink > 0 || st.spotFlags > 0;
    return leakRow('Shrinkage written off (30d)', App.fmtCurrency(st.shrink), 'ic-adjustments', st.shrink > 0)
      + leakRow('Spot-check flags (30d)', String(st.spotFlags), 'ic-spot-check', st.spotFlags > 0)
      + (anyLeak ? '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Tap any line to dig in.</div>'
                 : '<div style="font-size:11px;color:var(--gold);margin-top:8px;">No leaks flagged in the last 30 days. Clean.</div>');
  },
  readout(st) {
    return '<div style="margin-top:22px;">'
      + this.row(this.shPanel('Where Your Cash Sits', this.catBody(st)), this.shPanel('Movement', this.moveBody(st)))
      + this.row(this.shPanel('Since Last Count', this.sinceBody(st)), this.shPanel('Leaks &amp; Watch', this.leakBody(st)))
      + '</div>';
  },

  parNudge(n) {
    return '<div data-go="ic-par-suggestions" style="margin-top:12px;padding:11px 13px;background:var(--input);border:1px solid var(--b2);border-radius:5px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span style="font-size:13px;color:var(--t1);line-height:1.5;"><strong style="color:var(--gold);">' + n + ' par' + (n === 1 ? '' : 's') + '</strong> look off versus your real usage. Tuning them sharpens these reorder numbers.</span>'
      + '<span style="font-size:12px;font-weight:700;color:var(--gold);white-space:nowrap;">Dynamic Pars &rsaquo;</span></div>';
  },

  outlierStrip() {
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;">'
      + '<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-right:4px;">As needed</span>'
      + '<button class="btn btn-ghost btn-sm" data-go="ic-spot-check">Spot Check</button>'
      + '<button class="btn btn-ghost btn-sm" data-go="ic-par-suggestions">Par Suggestions</button>'
      + '</div>';
  },

  // ── Get Started: setup steps above the cockpit until all four are done ───────
  getStartedBox() {
    return App.controlGetStarted('Inventory', [
      { num: 1, label: 'List vendors',          screen: 'ic-vendors',        done: this.vendors().length > 0 },
      { num: 2, label: 'Add products',          screen: 'ic-product-setup',  done: this.products().length > 0 },
      { num: 3, label: 'Set locations',         screen: 'ic-locations',      done: this.locations().length > 0 },
      { num: 4, label: 'Take your first count', screen: 'ic-take-inventory', done: this.countsAsc().length > 0 }
    ]);
  },

  // ── Bar Cop Briefing: a written read of the inventory week, the same button
  //    the recovery dashboards carry. Cached a week per section (DashUI helpers)
  //    so repeat opens do not spend on the API. ──────────────────────────────
  // Code-generated (no API): where inventory stands, where cash is stuck, the move.
  showInsights() {
    const st = this._st || this.computeState();
    if (!st.latest) { DashUI.insightsModal('Bar Cop Briefing', 'Take a couple of counts and Bar Cop can read your inventory week for you.'); return; }
    DashUI.insightsModal('Bar Cop Briefing', this._insBriefing(st));
  },

  _insBriefing(st) {
    const m = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');
    const paras = [];

    // 1 — where the inventory stands
    let p1 = 'You are holding ' + m(st.inventoryValue) + ' on the shelf';
    if (st.weeksOnHand != null) p1 += ', about ' + st.weeksOnHand.toFixed(1) + ' weeks of stock';
    p1 += '. ' + (st.hasCountThisWeek ? 'Your count is current, so this read is real.'
                : st.latest ? 'Last count was ' + st.lastAge + ' days ago, so the number drifts until you recount.'
                : 'No count on file yet, so treat this as a starting point.');
    paras.push(p1);

    // 2 — where cash is leaking or stuck
    const leaks = [];
    if (st.shrink > 0) leaks.push(m(st.shrink) + ' written off to shrinkage in the last thirty days');
    if (st.deadAll > 0) leaks.push(st.deadAll + ' dead item' + (st.deadAll === 1 ? '' : 's') + ' tying up cash' + (st.dead && st.dead.length ? ', worst is ' + st.dead[0].name + ' at ' + m(st.dead[0].tied) : ''));
    if (st.parOff > 0) leaks.push(st.parOff + ' par' + (st.parOff === 1 ? '' : 's') + ' off versus real usage');
    if (st.menuOver > 0) leaks.push(st.menuOver + ' menu item' + (st.menuOver === 1 ? '' : 's') + ' now over cost target');
    paras.push(leaks.length ? 'Where cash is stuck: ' + leaks.join(', ') + '.' : 'Nothing is leaking or stuck right now. Shrinkage is clean and the pars are close to usage.');

    // 3 — the single move
    let move;
    if (st.reorderCount > 0) move = 'Place your order first: ' + m(st.reorderTotal) + ' across ' + st.reorderCount + ' product' + (st.reorderCount === 1 ? '' : 's') + ' are below par.';
    else if (st.dead && st.dead.length) move = 'Run down the dead stock, starting with ' + st.dead[0].name + '. It is cash sitting still.';
    else if (!st.hasCountThisWeek) move = 'Take this week\'s count so the whole read is real, not drifting.';
    else move = 'Nothing urgent. Hold the count rhythm and keep the pars tight to usage.';
    paras.push(move);

    return paras.map(p => '<p style="margin:0 0 12px;">' + esc(p) + '</p>').join('');
  },

  // ── Wiring ───────────────────────────────────────────────────────────────────
  wire() {
    this.container.onclick = ev => {
      if (ev.target.closest('[data-insights]')) { this.showInsights(); return; }
      const head = ev.target.closest('.ic-step-head');
      if (head) { const k = head.dataset.step; this._openStep = (this._openStep === k) ? '' : k; this.render(this.container, this.actions); return; }
      const dn = ev.target.closest('[data-done]');
      if (dn) { this.setDone(dn.dataset.done, true); this._openStep = null; this.render(this.container, this.actions); return; }
      const un = ev.target.closest('[data-undone]');
      if (un) { this.setDone(un.dataset.undone, false); this._openStep = un.dataset.undone; this.render(this.container, this.actions); return; }
      const op = ev.target.closest('[data-open]');
      if (op && op.dataset.open) { App.openScreen(op.dataset.open); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.navigate(go.dataset.go); return; }
      if (ev.target.closest('.ic-wk-prev')) { this._stepWeek(-7); return; }
      if (ev.target.closest('.ic-wk-next')) { this._stepWeek(7); return; }
      if (ev.target.closest('.ic-wk-now'))  { this._weekStart = null; this._openStep = null; this.render(this.container, this.actions); return; }
    };
  }
};
