'use strict';

/* ── Week Review — what the crew actually did this week (Books section) ────────
   The accountability side of Close the Week. For a chosen week it reads every
   section's real activity (counts taken, spot checks run, deliveries received,
   orders placed, hours and tips logged, logs filed) plus the Close-the-Week
   step-completion state, and lays out per section: what was DONE, whether the
   weekly close got finished, what it turned up, and what is carrying into next
   week. An owner reads one page and sees where the team is on it and where they
   let things slide. Every number is a real record or a real step stamp, nothing
   projected. Monday-based weeks, to match the section cockpits. Opened from the
   Books sidebar (under Break-Even). Sections added one at a time. */

S.WeekReview = {
  container: null,
  _wkStart: null,   // Monday (ymd) of the selected week; null = this week

  open() {
    if (App._hubBlocked && App._hubBlocked()) return;   // app-wide accountability view — not for Staff
    App.openHubFullPage('Week in Review', (mount) => { this.container = mount; this.render(mount); }, 'week-review');
  },

  // ── Monday-based week (matches the section closes) ──────────────────────────
  _monday(dstr) {
    const d = dstr ? new Date(dstr + 'T00:00:00') : new Date();
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return App.ymdLocal(d);
  },
  _addDays(ymd, n) { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return App.ymdLocal(d); },
  _wkS() { return this._wkStart || this._monday(); },
  _wkE() { return this._addDays(this._wkS(), 6); },
  _inWeek(dstr) { const d = String(dstr || '').slice(0, 10); const s = this._wkS(), e = this._wkE(); return !!d && d >= s && d <= e; },
  _isThisWeek() { return this._wkS() >= this._monday(); },
  _step(n) {
    const next = this._addDays(this._wkS(), n);
    if (n > 0 && next > this._monday()) return;
    this._wkStart = next;
    this.render(this.container);
  },

  // ── Shared visual bits ──────────────────────────────────────────────────────
  _eyebrow(t) {
    return '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:11px;">' + t + '</div>';
  },
  _check() {
    return '<span style="width:22px;height:22px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:12px;font-weight:800;">&#10003;</span>';
  },
  _cross() {
    return '<span style="width:22px;height:22px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;background:var(--red);color:var(--bg);font-size:11px;font-weight:800;">&#10005;</span>';
  },
  _act(n, label) {
    const zero = !n;
    return '<div style="min-width:0;">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:23px;font-weight:600;line-height:1;color:' + (zero ? 'var(--t4)' : 'var(--t1)') + ';">' + n + '</div>'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-top:4px;">' + label + '</div></div>';
  },
  _actRow(items) {
    const vdiv = '<div class="wr-vdiv" style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 22px;"></div>';
    return '<div class="wr-statrow" style="display:flex;align-items:flex-start;flex-wrap:wrap;row-gap:16px;">' + items.join(vdiv) + '</div>';
  },
  _res(label, val, col) {
    return '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:600;line-height:1;color:' + (col || 'var(--t1)') + ';">' + val + '</div></div>';
  },
  _resRow(items) {
    const vdiv = '<div class="wr-vdiv" style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 24px;"></div>';
    return '<div class="wr-statrow" style="display:flex;align-items:flex-start;flex-wrap:wrap;row-gap:16px;">' + items.join(vdiv) + '</div>';
  },
  _openItem(text, sev) {
    const col = sev === 'red' ? 'var(--red)' : 'var(--amber)';
    return '<div style="display:flex;align-items:center;gap:11px;padding:10px 13px;background:var(--gold-tint);border-radius:5px;">'
      + '<span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:' + col + ';"></span>'
      + '<span style="font-size:12.5px;color:var(--t2);line-height:1.5;">' + text + '</span></div>';
  },
  _openList(items) {
    return items.length
      ? '<div style="display:flex;flex-direction:column;gap:8px;">' + items.slice(0, 5).map(o => this._openItem(o.t, o.sev)).join('') + '</div>'
      : '<div style="font-size:12.5px;color:var(--green);padding:2px 0;">&#10003; Nothing open. Clean week.</div>';
  },
  // Status text (colored, no badge). Complete / N to do / N missed.
  _statusText(doneCount, total) {
    const remaining = total - doneCount;
    const txt = (t, tone) => { const c = { good: 'var(--green)', warn: 'var(--amber)', bad: 'var(--red)' }[tone];
      return '<span style="font-size:11px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;color:' + c + ';white-space:nowrap;">' + t + '</span>'; };
    if (remaining === 0) return txt('Complete', 'good');
    return this._isThisWeek() ? txt(remaining + ' to do', 'warn') : txt(remaining + ' missed', remaining >= Math.ceil(total * 0.75) ? 'bad' : 'warn');
  },
  _closeList(steps, done) {
    return '<div style="display:flex;flex-direction:column;gap:9px;">'
      + steps.map(s => '<div style="display:flex;align-items:center;gap:11px;">'
          + (done[s.key] ? this._check() : this._cross())
          + '<span style="font-size:13px;color:' + (done[s.key] ? 'var(--t2)' : 'var(--t1)') + ';font-weight:' + (done[s.key] ? '400' : '600') + ';">' + s.label + '</span></div>').join('')
      + '</div>';
  },
  // Section shell: header (name + status, full-bleed divider), inset-divided
  // blocks, then the Open link on its own bottom row.
  _sectionCard(name, screen, mod, statusText, blocks, openJs) {
    const idiv = '<div class="wr-idiv"></div>';
    const oc = openJs || ("S.Hub._enter('" + screen + "','" + mod + "')");
    const header = '<div class="wr-head" style="display:flex;align-items:center;gap:12px;min-width:0;">'
      + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:17px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:var(--t1);">' + esc(name) + '</span>'
      + statusText + '</div>';
    const body = blocks.map(b => '<div class="wr-block">' + this._eyebrow(b.label) + b.html + '</div>').join(idiv);
    const footer = idiv + '<div class="wr-foot">'
      + '<button class="btn btn-ghost btn-sm no-print" onclick="' + oc + '">Open ' + esc(name) + '</button></div>';
    // flex column + a growing body wrapper pins the Open link to the card bottom,
    // so both cards in a grid row read the same height no matter what is in them.
    return '<div class="card" style="padding:0;overflow:hidden;margin:0;display:flex;flex-direction:column;">'
      + header + '<div style="flex:1 1 auto;">' + body + '</div>' + footer + '</div>';
  },

  // ── The week's money headline (from the confirmed week, matched by Sunday) ───
  _weekMoney() {
    const pe = this._wkE();
    const w  = ((App.data && App.data.weeks) || []).find(x => x && x.period_end === pe);
    const rw = ((App.data && App.data.revenue_weeks) || []).find(x => x && x.period_end === pe);
    let netSales = null, prime = null, laborPct = null;
    if (w) {
      const bar = w.bar || {}, food = w.food || {}, cat = w.catering || {}, oth = w.other || {};
      netSales = (bar.revenue || 0) + (food.revenue || 0) + (cat.revenue || 0) + (oth.revenue || 0);
      prime = w.prime_cost_pct;
    } else if (rw) {
      netSales = (rw.bar_revenue || 0) + (rw.floor_revenue || 0);
    }
    if (rw && rw.labor_pct_blended != null) laborPct = rw.labor_pct_blended;
    else if (w) { const b = w.bar || {}, f = w.food || {}; const s = (b.revenue || 0) + (f.revenue || 0); if (s > 0) laborPct = ((b.labor || 0) + (f.labor || 0)) / s * 100; }
    return { netSales, prime, laborPct };
  },
  _topCard() {
    const m = this._weekMoney();
    const pct = v => (v != null && !isNaN(v)) ? (Number(v).toFixed(1) + '%') : '-';
    const stat = (label, val) => '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:7px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:38px;font-weight:600;line-height:0.9;color:var(--w);">' + val + '</div></div>';
    const vdiv = '<div class="wr-vdiv" style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 34px;"></div>';
    const stats = [
      stat('Net Sales', m.netSales != null ? App.fmtCurrency(m.netSales, 0) : '-'),
      stat('Prime Cost', pct(m.prime)),
      stat('Labor', pct(m.laborPct))
    ].join(vdiv);
    return '<div class="card" style="margin-bottom:16px;overflow:hidden;padding:0;">'
      + '<div class="wr-tophead" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);">Week In Review</div>'
      +   '<button class="btn btn-ghost btn-sm no-print" id="wr-brief" style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Bar Cop Briefing</button>'
      + '</div>'
      + '<div class="wr-statrow wr-topstats" style="display:flex;align-items:flex-start;flex-wrap:wrap;row-gap:16px;">' + stats + '</div></div>';
  },

  // ── Inventory ───────────────────────────────────────────────────────────────
  _inventorySection() {
    const ID = S.InventoryDashboard;
    if (!ID) return '';
    const inv = (App.inventoryData) || {};
    const products = (inv.ic_products || []).filter(p => p.active !== false);
    if (!products.length || !(inv.ic_counts || []).length) return null;

    const sv = ID._weekStart;
    ID._weekStart = this._wkS();
    let st, done;
    try { st = ID.computeState(); done = ID.stepDone(st); } finally { ID._weekStart = sv; }

    const wkCounts   = (inv.ic_counts || []).filter(c => this._inWeek(c.date)).length;
    const wkSpot     = (inv.ic_spot_checks || []).filter(s => this._inWeek(s.date)).length;
    const wkDeliv    = st.deliveriesThisWeek || 0;
    const wkOrders   = (inv.ic_orders || []).filter(o => this._inWeek(o.date)).length;
    const wkAdj      = (inv.ic_adjustments || []).filter(a => this._inWeek(a.date_time || a.created_at)).length;
    const wkTransfer = (inv.ic_transfers || []).filter(t => this._inWeek(t.date_time || t.created_at)).length;

    const STEPS = [
      { key: 'count',      label: 'Took the count' },
      { key: 'deliveries', label: 'Received deliveries' },
      { key: 'orders',     label: 'Placed the orders' },
      { key: 'review',     label: 'Reviewed the flags' }
    ];
    const doneCount = STEPS.filter(s => done[s.key]).length;

    const activity = this._actRow([
      this._act(wkCounts, 'Counts'), this._act(wkDeliv, 'Deliveries'), this._act(wkOrders, 'Orders'),
      this._act(wkSpot, 'Spot Checks'), this._act(wkAdj, 'Adjustments'), this._act(wkTransfer, 'Transfers')
    ]);
    const results = this._resRow([
      this._res('Used This Period', st.periodCost != null ? App.fmtCurrency(st.periodCost, 0) : '-'),
      this._res('Below Par', App.fmtCurrency(st.reorderTotal, 0), st.reorderCount ? 'var(--amber)' : 'var(--t1)'),
      this._res('Shrinkage 30d', App.fmtCurrency(st.shrink, 0), st.shrink > 0 ? 'var(--red)' : 'var(--t1)'),
      this._res('Dead Stock', String(st.deadAll), st.deadAll > 0 ? 'var(--red)' : 'var(--t1)'),
      this._res('Over Target', String(st.menuOver), st.menuOver > 0 ? 'var(--red)' : 'var(--t1)')
    ]);
    const open = [];
    const anyFlag = st.shrink > 0 || st.spotFlags > 0 || st.deadAll > 0 || st.menuOver > 0;
    if (!done.review && anyFlag) open.push({ t: 'Variance flags never reviewed this week', sev: 'red' });
    if (!done.orders && st.reorderCount > 0) open.push({ t: '<b>' + st.reorderCount + '</b> item' + (st.reorderCount === 1 ? '' : 's') + ' below par, no order placed', sev: 'red' });
    if (st.deadAll > 0) open.push({ t: '<b>' + st.deadAll + '</b> dead-stock item' + (st.deadAll === 1 ? '' : 's') + ' tying up cash', sev: 'amber' });
    if (st.parOff > 0) open.push({ t: '<b>' + st.parOff + '</b> par' + (st.parOff === 1 ? '' : 's') + ' off versus real usage', sev: 'amber' });
    if (st.menuOver > 0) open.push({ t: '<b>' + st.menuOver + '</b> menu item' + (st.menuOver === 1 ? '' : 's') + ' over cost target', sev: 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Inventory', status: this._statusPlain(doneCount, STEPS.length),
      activity: 'Counts ' + wkCounts + ', Deliveries ' + wkDeliv + ', Orders ' + wkOrders + ', Spot Checks ' + wkSpot + ', Adjustments ' + wkAdj + ', Transfers ' + wkTransfer,
      close: STEPS.map(s => s.label + (done[s.key] ? ' (done)' : ' (open)')).join(', '),
      results: 'Used ' + (st.periodCost != null ? App.fmtCurrency(st.periodCost, 0) : '-') + ', Below Par ' + App.fmtCurrency(st.reorderTotal, 0) + ', Shrinkage 30d ' + App.fmtCurrency(st.shrink, 0) + ', Dead Stock ' + st.deadAll + ', Over Target ' + st.menuOver,
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Inventory', 'ic-dashboard', 'inventory', this._statusText(doneCount, STEPS.length), [
      { label: 'Done This Week', html: activity },
      { label: 'The Weekly Close &middot; ' + doneCount + ' of ' + STEPS.length, html: this._closeList(STEPS, done) },
      { label: 'What It Turned Up', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Labor ───────────────────────────────────────────────────────────────────
  _laborSection() {
    const LD = S.LaborDashboard;
    if (!LD) return '';
    const lab = (App.laborData) || {};
    if (!(lab.lc_staff || []).length || !(lab.lc_actuals || []).length) return null;

    const target = App.laborTargetPct ? App.laborTargetPct() : 29;
    const today = App.todayLocal();
    const cutoff30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return App.ymdLocal(d); })();

    const sv = LD._weekStart;
    LD._weekStart = this._wkS();
    let done, wkHours, wkCost, laborPct, rplh, proj, tipN, calloutN, calloutUncov, toPending, expired, expiring, schedBuilt;
    try {
      done = LD.stepDone();
      const wkStart = LD.weekStart(), wkEnd = LD.weekEnd();
      const endCap = wkEnd < today ? wkEnd : today;
      const wkActuals = LD.actuals().filter(a => a.date >= wkStart && a.date <= wkEnd);
      wkHours = wkActuals.reduce((t, a) => t + (a.hours || 0), 0);
      const salCost = (App.salariedCost ? App.salariedCost(wkStart, endCap).total : 0) || 0;
      wkCost = wkActuals.reduce((t, a) => t + (a.cost || 0), 0) + salCost;
      const weekRevenue = ((App.shiftData && App.shiftData.sc_shifts) || [])
        .filter(s => LD.inWeek(s.date)).reduce((t, s) => t + (parseFloat(s.total_revenue) || 0), 0);
      laborPct = weekRevenue > 0 ? (wkCost / weekRevenue * 100) : null;
      rplh = (wkHours > 0 && weekRevenue > 0) ? (weekRevenue / wkHours) : null;
      proj = LD.weekProjection();
      tipN = LD.tips().filter(t => LD.inWeek(t.date)).length;
      calloutN = LD.callouts().filter(c => LD.inWeek(c.date)).length;
      calloutUncov = LD.callouts().filter(c => LD.inWeek(c.date) && !c.covered).length;
      toPending = LD.timeOff().filter(t => t.status === 'Requested').length;
      const activeIds = new Set(LD.staff().filter(s => s.status !== 'Inactive').map(s => s.id));
      expired = LD.certs().filter(c => activeIds.has(c.staff_id) && c.expiration_date && c.expiration_date < today).length;
      expiring = LD.certs().filter(c => activeIds.has(c.staff_id) && c.expiration_date && c.expiration_date >= today && c.expiration_date <= cutoff30).length;
      schedBuilt = LD.schedules().some(s => s.week_start === LD.nextWeekStart());
    } finally { LD._weekStart = sv; }

    const STEPS = [
      { key: 'hours',    label: 'Imported the hours' },
      { key: 'tips',     label: 'Logged the tips' },
      { key: 'schedule', label: "Built next week's schedule" },
      { key: 'review',   label: 'Reviewed the labor flags' }
    ];
    const doneCount = STEPS.filter(s => done[s.key]).length;
    const otRisk = (proj.over || 0) + (proj.approaching || 0);

    const activity = this._actRow([
      this._act(wkHours ? wkHours.toFixed(1) : 0, 'Hours'),
      this._act(tipN, 'Tip Entries'),
      this._act(calloutN, 'Call-Outs'),
      this._act(toPending, 'Time-Off')
    ]);
    const results = this._resRow([
      this._res('Labor Cost', App.fmtCurrency(wkCost, 0)),
      this._res('Labor %', laborPct != null ? laborPct.toFixed(1) + '%' : '-', (laborPct != null && laborPct > target) ? 'var(--amber)' : 'var(--t1)'),
      this._res('Hours', wkHours.toFixed(1)),
      this._res('RPLH', rplh != null ? App.fmtCurrency(rplh) : '-'),
      this._res('OT Risk', String(otRisk), otRisk > 0 ? 'var(--amber)' : 'var(--t1)')
    ]);
    const open = [];
    if (!done.schedule && !schedBuilt) open.push({ t: "Next week's schedule not built", sev: 'red' });
    if (proj.over > 0) open.push({ t: '<b>' + proj.over + '</b> staff projected over ' + App.OT_THRESHOLD + ' hrs (~' + App.fmtCurrency(proj.otPremium, 0) + ' premium)', sev: 'red' });
    if (calloutUncov > 0) open.push({ t: '<b>' + calloutUncov + '</b> uncovered call-out' + (calloutUncov === 1 ? '' : 's') + ' this week', sev: 'red' });
    if (toPending > 0) open.push({ t: '<b>' + toPending + '</b> time-off request' + (toPending === 1 ? '' : 's') + ' to review', sev: 'amber' });
    if (expired > 0) open.push({ t: '<b>' + expired + '</b> certification' + (expired === 1 ? '' : 's') + ' expired', sev: 'red' });
    if (expiring > 0) open.push({ t: '<b>' + expiring + '</b> certification' + (expiring === 1 ? '' : 's') + ' expiring within 30 days', sev: 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Labor', status: this._statusPlain(doneCount, STEPS.length),
      activity: 'Hours ' + (wkHours ? wkHours.toFixed(1) : 0) + ', Tip Entries ' + tipN + ', Call-Outs ' + calloutN + ', Time-Off ' + toPending,
      close: STEPS.map(s => s.label + (done[s.key] ? ' (done)' : ' (open)')).join(', '),
      results: 'Labor Cost ' + App.fmtCurrency(wkCost, 0) + ', Labor % ' + (laborPct != null ? laborPct.toFixed(1) + '%' : '-') + ', Hours ' + wkHours.toFixed(1) + ', RPLH ' + (rplh != null ? App.fmtCurrency(rplh) : '-') + ', OT Risk ' + otRisk,
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Labor', 'lc-dashboard', 'labor', this._statusText(doneCount, STEPS.length), [
      { label: 'Done This Week', html: activity },
      { label: 'The Weekly Close &middot; ' + doneCount + ' of ' + STEPS.length, html: this._closeList(STEPS, done) },
      { label: 'What It Turned Up', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Shift ───────────────────────────────────────────────────────────────────
  _shiftSection() {
    const SD = S.ShiftDashboard;
    if (!SD) return '';
    const sh = (App.shiftData) || {};
    if (!(sh.sc_shifts || []).length) return null;

    const sv = SD._weekEnd;
    SD._weekEnd = this._wkE();
    let done, rev, covers, checkAvg, voidTot, compTot, netVar, days, vcN, wasteN, walkedN, reconN, shorts, oot;
    try {
      done = SD.stepDone();
      const wkS = SD.shifts().filter(s => SD.inWeek(s.date));
      rev = wkS.reduce((t, s) => t + (parseFloat(s.total_revenue) || 0), 0);
      covers = wkS.reduce((t, s) => t + (s.covers || 0), 0);
      checkAvg = covers > 0 ? rev / covers : null;
      const wkVC = SD.voidComps().filter(r => SD.inWeek(r.date));
      voidTot = wkVC.filter(r => r.type === 'Void').reduce((t, r) => t + (r.amount || 0), 0);
      compTot = wkVC.filter(r => r.type === 'Comp').reduce((t, r) => t + (r.amount || 0), 0);
      const wkVar = SD.variances().filter(v => SD.inWeek(v.date));
      netVar = wkVar.reduce((t, v) => t + (v.variance || 0), 0);
      shorts = wkVar.filter(v => v.status === 'Short').length;
      oot = wkVar.filter(v => v.status === 'Over' || v.status === 'Short').length;
      reconN = wkVar.length;
      days = wkS.length;
      vcN = wkVC.length;
      wasteN = SD.waste().filter(r => SD.inWeek(r.date)).length;
      walkedN = SD.walkedTabs().filter(r => SD.inWeek(r.date)).length;
    } finally { SD._weekEnd = sv; }

    const STEPS = [
      { key: 'import', label: 'Imported the sales' },
      { key: 'cash',   label: 'Reconciled cash' },
      { key: 'exc',    label: 'Logged the exceptions' },
      { key: 'review', label: 'Reviewed the loss flags' }
    ];
    const doneCount = STEPS.filter(s => done[s.key]).length;

    const activity = this._actRow([
      this._act(days, 'Days'), this._act(reconN, 'Reconciles'), this._act(vcN, 'Voids/Comps'),
      this._act(wasteN, 'Waste'), this._act(walkedN, 'Walked Tabs')
    ]);
    const results = this._resRow([
      this._res('Net Sales', App.fmtCurrency(rev, 0)),
      this._res('Covers', String(covers)),
      this._res('Check Avg', checkAvg != null ? App.fmtCurrency(checkAvg) : '-'),
      this._res('Over / Short', (netVar > 0 ? '+' : '') + App.fmtCurrency(netVar, 0), netVar < 0 ? 'var(--red)' : 'var(--t1)'),
      this._res('Voids + Comps', App.fmtCurrency(voidTot + compTot, 0))
    ]);
    const open = [];
    if (!done.review && (oot > 0 || voidTot + compTot > 0)) open.push({ t: 'Loss flags never reviewed this week', sev: 'red' });
    if (shorts > 0) open.push({ t: '<b>' + shorts + '</b> cash-short shift' + (shorts === 1 ? '' : 's') + ' to chase', sev: 'red' });
    if (!done.cash && reconN === 0) open.push({ t: 'Cash not reconciled this week', sev: 'amber' });
    if (walkedN > 0) open.push({ t: '<b>' + walkedN + '</b> walked tab' + (walkedN === 1 ? '' : 's') + ' this week', sev: 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Shift', status: this._statusPlain(doneCount, STEPS.length),
      activity: 'Days ' + days + ', Reconciles ' + reconN + ', Voids/Comps ' + vcN + ', Waste ' + wasteN + ', Walked Tabs ' + walkedN,
      close: STEPS.map(s => s.label + (done[s.key] ? ' (done)' : ' (open)')).join(', '),
      results: 'Net Sales ' + App.fmtCurrency(rev, 0) + ', Covers ' + covers + ', Check Avg ' + (checkAvg != null ? App.fmtCurrency(checkAvg) : '-') + ', Over/Short ' + (netVar > 0 ? '+' : '') + App.fmtCurrency(netVar, 0) + ', Voids+Comps ' + App.fmtCurrency(voidTot + compTot, 0),
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Shift', 'sc-dashboard', 'shift', this._statusText(doneCount, STEPS.length), [
      { label: 'Done This Week', html: activity },
      { label: 'The Weekly Close &middot; ' + doneCount + ' of ' + STEPS.length, html: this._closeList(STEPS, done) },
      { label: 'What It Turned Up', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Profit (Recovery) ───────────────────────────────────────────────────────
  _profitSection() {
    const PD = S.Dashboard;
    if (!PD) return '';
    if (!((App.data && App.data.weeks) || []).length && !((App.data && App.data.audits) || []).length) return null;

    const sv = PD._weekEnd;
    PD._weekEnd = this._wkE();
    let done, w, costRows, overCount, topLeak, auditState, recoverable;
    try {
      done = PD.stepDone();
      w = PD.savedWeek(this._wkE());
      costRows = w ? PD._costRows(w) : null;
      overCount = costRows ? costRows.filter(r => r.over).length : 0;
      topLeak = PD._topLeak ? PD._topLeak() : null;
      auditState = PD._auditState();
      const latestAudit = App.latestEvent ? App.latestEvent(PD.audits()) : null;
      const monthly = latestAudit ? (latestAudit.action_items || []).reduce((s, a) => s + (a.monthly_impact || 0), 0) : 0;
      recoverable = monthly * 12;
    } finally { PD._weekEnd = sv; }

    // Real recovery activity logged this week (records dated in the window).
    const dat = App.data || {};
    const auditsWk  = (dat.audits || []).filter(a => this._inWeek((a.date || a.generated_at || '').slice(0, 10))).length;
    const reviewsWk = (dat.sales_reviews || []).filter(r => this._inWeek(r.date || r.created_at)).length;
    const discWk    = (dat.vendor_discrepancies || []).filter(d => this._inWeek(d.date || d.filed_at || d.created_at)).length;
    const investWk  = (dat.variance_investigations || []).filter(i => this._inWeek(i.opened_date || i.date)).length;
    const expActive = (dat.profit_initiatives || []).filter(e => e.status === 'Active').length;

    const STEPS = [
      { key: 'week',  label: 'Confirmed the week' },
      { key: 'costs', label: 'Checked costs against target' },
      { key: 'leaks', label: 'Worked the biggest leak' },
      { key: 'audit', label: 'Ran the Profit audit' }
    ];
    const doneCount = STEPS.filter(s => done[s.key]).length;

    const activity = this._actRow([
      this._act(auditsWk, 'Audits Run'), this._act(reviewsWk, 'Sales Reviews'), this._act(discWk, 'Discrepancies'),
      this._act(investWk, 'Investigations'), this._act(expActive, 'Experiments')
    ]);
    const costCell = (i, label) => {
      const r = costRows ? costRows[i] : null;
      const has = r && r.val != null;
      return this._res(label, has ? r.val.toFixed(1) + '%' : '-', has ? (r.over ? 'var(--red)' : 'var(--green)') : 'var(--t1)');
    };
    const results = this._resRow([
      costCell(0, 'Bar Pour'), costCell(1, 'Food Cost'), costCell(2, 'Prime Cost'),
      this._res('Recoverable/yr', recoverable > 0 ? App.fmtCurrency(recoverable, 0) : '-')
    ]);

    const open = [];
    if (!done.week) open.push({ t: 'Week not confirmed, so this week\'s cost numbers are blank', sev: 'red' });
    if (w && overCount > 0) {
      const names = costRows.filter(r => r.over).map(r => r.label.toLowerCase());
      open.push({ t: '<b>' + overCount + '</b> of 3 costs over target (' + names.join(', ') + ')', sev: overCount >= 2 ? 'red' : 'amber' });
    }
    if (!done.leaks && topLeak && topLeak.dollars > 0) open.push({ t: 'Biggest leak not worked: <b>' + App.fmtCurrency(topLeak.dollars, 0) + '</b>/yr on ' + esc(topLeak.name), sev: 'red' });
    if (!done.audit || (auditState && auditState.due)) open.push({ t: (auditState && auditState.latest) ? ('Profit audit is ' + (auditState.daysSince != null ? auditState.daysSince + ' days old' : 'stale') + ', run a fresh one') : 'No Profit audit run yet', sev: 'amber' });

    const pcv = i => (costRows && costRows[i] && costRows[i].val != null) ? (costRows[i].val.toFixed(1) + '%') : '-';
    (this._pdf || (this._pdf = [])).push({ name: 'Profit', status: this._statusPlain(doneCount, STEPS.length),
      activity: 'Audits Run ' + auditsWk + ', Sales Reviews ' + reviewsWk + ', Discrepancies ' + discWk + ', Investigations ' + investWk + ', Experiments ' + expActive,
      close: STEPS.map(s => s.label + (done[s.key] ? ' (done)' : ' (open)')).join(', '),
      results: 'Bar Pour ' + pcv(0) + ', Food ' + pcv(1) + ', Prime ' + pcv(2) + ', Recoverable/yr ' + (recoverable > 0 ? App.fmtCurrency(recoverable, 0) : '-'),
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Profit', 'dashboard', 'profit', this._statusText(doneCount, STEPS.length), [
      { label: 'Done This Week', html: activity },
      { label: 'The Weekly Close &middot; ' + doneCount + ' of ' + STEPS.length, html: this._closeList(STEPS, done) },
      { label: 'What It Turned Up', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Revenue (Recovery) ──────────────────────────────────────────────────────
  _revenueSection() {
    const RD = S.RevenueDashboard;
    if (!RD) return '';
    if (!((App.data && App.data.revenue_weeks) || []).length && !((App.data && App.data.revenue_audits) || []).length) return null;

    const sv = RD._weekEnd;
    RD._weekEnd = this._wkE();
    let done, w, metrics, offCount, topLeak, auditState, recoverable;
    try {
      done = RD.stepDone();
      w = RD.savedWeek(this._wkE());
      metrics = RD.metricsRows(w || {});
      offCount = metrics.filter(m => m.good === false).length;
      topLeak = RD._topLeak ? RD._topLeak() : null;
      auditState = RD._auditState();
      const latestAudit = App.latestEvent ? App.latestEvent(RD.audits()) : null;
      const monthly = latestAudit ? (latestAudit.action_items || []).reduce((s, a) => s + (a.monthly_impact || 0), 0) : 0;
      recoverable = monthly * 12;
    } finally { RD._weekEnd = sv; }

    const dat = App.data || {};
    const auditsWk = (dat.revenue_audits || []).filter(a => this._inWeek((a.date || a.generated_at || '').slice(0, 10))).length;
    const priceWk  = (dat.revenue_price_log || []).filter(p => this._inWeek(p.date || p.created_at || p.changed_at)).length;
    const dogWk    = (dat.menu_dog_tests || []).filter(t => this._inWeek(t.start_date || t.created_at)).length;
    const checkWk  = (dat.revenue_server_checks || []).filter(c => this._inWeek(c.date || c.created_at)).length;
    const expActive = (dat.initiatives || []).filter(e => e.status === 'Active').length;

    const STEPS = [
      { key: 'week',    label: 'Confirmed the week' },
      { key: 'numbers', label: 'Checked numbers against target' },
      { key: 'leaks',   label: 'Worked the biggest leak' },
      { key: 'audit',   label: 'Ran the Revenue audit' }
    ];
    const doneCount = STEPS.filter(s => done[s.key]).length;

    const activity = this._actRow([
      this._act(auditsWk, 'Audits Run'), this._act(priceWk, 'Price Changes'), this._act(dogWk, 'Dog Tests'),
      this._act(checkWk, 'Server Checks'), this._act(expActive, 'Experiments')
    ]);
    const mCell = (i, label) => {
      const m = metrics[i];
      const col = (m && m.good != null) ? (m.good ? 'var(--green)' : 'var(--red)') : 'var(--t1)';
      return this._res(label, m ? m.value : '-', col);
    };
    const results = this._resRow([
      mCell(0, 'Check Avg'), mCell(1, 'Labor %'), mCell(2, 'Rev / Labor Hr'),
      this._res('Recoverable/yr', recoverable > 0 ? App.fmtCurrency(recoverable, 0) : '-')
    ]);

    const open = [];
    if (!done.week) open.push({ t: 'Week not confirmed, so this week\'s numbers are blank', sev: 'red' });
    if (w && offCount > 0) {
      const names = metrics.filter(m => m.good === false).map(m => m.label.toLowerCase());
      open.push({ t: '<b>' + offCount + '</b> off target (' + names.join(', ') + ')', sev: offCount >= 2 ? 'red' : 'amber' });
    }
    if (!done.leaks && topLeak && topLeak.dollars > 0) open.push({ t: 'Biggest leak not worked: <b>' + App.fmtCurrency(topLeak.dollars, 0) + '</b>/yr on ' + esc(topLeak.name), sev: 'red' });
    if (!done.audit || (auditState && auditState.due)) open.push({ t: (auditState && auditState.latest) ? ('Revenue audit is ' + (auditState.daysSince != null ? auditState.daysSince + ' days old' : 'stale') + ', run a fresh one') : 'No Revenue audit run yet', sev: 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Revenue', status: this._statusPlain(doneCount, STEPS.length),
      activity: 'Audits Run ' + auditsWk + ', Price Changes ' + priceWk + ', Dog Tests ' + dogWk + ', Server Checks ' + checkWk + ', Experiments ' + expActive,
      close: STEPS.map(s => s.label + (done[s.key] ? ' (done)' : ' (open)')).join(', '),
      results: 'Check Avg ' + metrics[0].value + ', Labor % ' + metrics[1].value + ', Rev/Labor Hr ' + metrics[2].value + ', Recoverable/yr ' + (recoverable > 0 ? App.fmtCurrency(recoverable, 0) : '-'),
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Revenue', 'r-dashboard', 'revenue', this._statusText(doneCount, STEPS.length), [
      { label: 'Done This Week', html: activity },
      { label: 'The Weekly Close &middot; ' + doneCount + ' of ' + STEPS.length, html: this._closeList(STEPS, done) },
      { label: 'What It Turned Up', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Cash (Recovery; numbers are a live position, not per-week) ──────────────
  _cashSection() {
    const CD = S.CashDashboard;
    if (!CD || !window.CashEngine) return '';
    const trapped = CashEngine.trapped ? CashEngine.trapped() : { hasData: false };
    const sf = CashEngine.survivalForecast ? CashEngine.survivalForecast(13) : { hasData: false };
    const pos = CashEngine.position ? CashEngine.position() : { hasOpening: false };
    if (!trapped.hasData && !sf.hasData) return null;

    const sv = CD._weekStart;
    CD._weekStart = this._wkS();
    let done;
    try { done = CD.stepDone(); } finally { CD._weekStart = sv; }

    const dat = App.data || {};
    const auditsWk  = (dat.cash_audits || []).filter(a => this._inWeek((a.date || a.generated_at || '').slice(0, 10))).length;
    const expActive = (dat.cash_initiatives || []).filter(e => e.status === 'Active').length;

    const STEPS = [
      { key: 'trapped', label: 'Freed up trapped cash' },
      { key: 'week',    label: 'Checked the week ahead' },
      { key: 'terms',   label: 'Paid on terms' },
      { key: 'audit',   label: 'Ran the Cash audit' }
    ];
    const doneCount = STEPS.filter(s => done[s.key]).length;
    const runwayLabel = r => r == null ? '13+ wks' : r === 0 ? 'This wk' : r + ' wk' + (r === 1 ? '' : 's');

    const activity = this._actRow([
      this._act(auditsWk, 'Audits Run'), this._act(expActive, 'Experiments')
    ]);
    const results = this._resRow([
      this._res('Trapped Cash', trapped.hasData ? App.fmtCurrency(trapped.total, 0) : '-', (trapped.hasData && trapped.total > 0) ? 'var(--amber)' : 'var(--t1)'),
      this._res('Runway', (sf.hasData && sf.hasOpening) ? runwayLabel(sf.runway) : '-', (sf.hasOpening && sf.runway != null) ? 'var(--red)' : 'var(--t1)'),
      this._res('Safe to Spend', pos.hasOpening ? App.fmtCurrency(pos.safe, 0) : '-', (pos.hasOpening && pos.safe < 0) ? 'var(--red)' : 'var(--t1)'),
      this._res('Tightest Week', (sf.hasData && sf.lowPoint) ? App.fmtCurrency(sf.lowPoint.balance, 0) : '-', (sf.lowPoint && sf.lowPoint.balance < 0) ? 'var(--red)' : 'var(--t1)')
    ]);

    const open = [];
    if (!done.trapped && trapped.hasData && trapped.total > 0) open.push({ t: '<b>' + App.fmtCurrency(trapped.total, 0) + '</b> still trapped on the shelf, not freed', sev: 'amber' });
    if (sf.hasOpening && sf.runway != null && sf.runway <= 4) open.push({ t: 'Cash runs thin, about ' + runwayLabel(sf.runway) + ' of runway', sev: 'red' });
    else if (sf.hasData && sf.tightWeeks > 0) open.push({ t: '<b>' + sf.tightWeeks + '</b> tight week' + (sf.tightWeeks === 1 ? '' : 's') + ' in the next 13', sev: 'amber' });
    if (pos.hasOpening && pos.safe != null && pos.safe < 0) open.push({ t: 'Safe-to-spend is negative, into money already spoken for', sev: 'red' });
    if (!done.audit) open.push({ t: 'Cash audit not run this week', sev: 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Cash', status: this._statusPlain(doneCount, STEPS.length),
      activity: 'Audits Run ' + auditsWk + ', Experiments ' + expActive,
      close: STEPS.map(s => s.label + (done[s.key] ? ' (done)' : ' (open)')).join(', '),
      results: 'Current position: Trapped Cash ' + (trapped.hasData ? App.fmtCurrency(trapped.total, 0) : '-') + ', Runway ' + ((sf.hasData && sf.hasOpening) ? runwayLabel(sf.runway) : '-') + ', Safe to Spend ' + (pos.hasOpening ? App.fmtCurrency(pos.safe, 0) : '-') + ', Tightest Week ' + ((sf.hasData && sf.lowPoint) ? App.fmtCurrency(sf.lowPoint.balance, 0) : '-'),
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Cash', 'c-dashboard', 'cash', this._statusText(doneCount, STEPS.length), [
      { label: 'Done This Week', html: activity },
      { label: 'The Weekly Close &middot; ' + doneCount + ' of ' + STEPS.length, html: this._closeList(STEPS, done) },
      { label: 'What It Turned Up &middot; Current Position', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Events (pipeline, not a weekly close) ───────────────────────────────────
  _eventsSection() {
    const ED = S.EventsDashboard;
    if (!ED) return '';
    if (!((App.data && App.data.bookings) || []).length) return null;

    let st, done, doneCount;
    try {
      st = ED._computeState();
      done = {};
      ED.ORDER.forEach(k => { done[k] = ED.stepInfo(k, st).done; });
      doneCount = ED.ORDER.filter(k => done[k]).length;
    } catch (e) { return null; }

    const bookings = (App.data && App.data.bookings) || [];
    const newBookWk = bookings.filter(b => this._inWeek(b.date_received)).length;
    const heldWk    = bookings.filter(b => this._inWeek(b.event_date) && (b.stage === 'Booked' || b.stage === 'Completed')).length;
    const depCollWk = bookings.filter(b => this._inWeek(b.deposit_paid_date)).length;

    const STEPS = [
      { key: 'leads',    label: 'Worked the open leads' },
      { key: 'deposits', label: 'Collected deposits due' },
      { key: 'prep',     label: 'Prepped upcoming events' },
      { key: 'close',    label: 'Closed out completed events' }
    ];

    const activity = this._actRow([
      this._act(newBookWk, 'New Bookings'), this._act(heldWk, 'Events Held'), this._act(depCollWk, 'Deposits In')
    ]);
    const results = this._resRow([
      this._res('Booked', ED._money(st.bookedRev)),
      this._res('Pipeline', ED._money(st.pipeline)),
      this._res('Deposits Due', ED._money(st.depositsDue), st.depositsDue > 0 ? 'var(--amber)' : 'var(--t1)'),
      this._res('Win Rate', st.conv)
    ]);

    const open = [];
    if (st.open.length) open.push({ t: '<b>' + st.open.length + '</b> open lead' + (st.open.length === 1 ? '' : 's') + ' to follow up', sev: st.stale.length ? 'red' : 'amber' });
    if (st.depositsDue > 0) open.push({ t: '<b>' + ED._money(st.depositsDue) + '</b> in deposits still due', sev: 'amber' });
    if (st.noRunSheet.length) open.push({ t: '<b>' + st.noRunSheet.length + '</b> upcoming event' + (st.noRunSheet.length === 1 ? '' : 's') + ' need a run sheet', sev: 'amber' });
    if (st.completedOpen.length) open.push({ t: '<b>' + st.completedOpen.length + '</b> completed event' + (st.completedOpen.length === 1 ? '' : 's') + ' to close out', sev: 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Events', status: this._statusPlain(doneCount, STEPS.length),
      activity: 'New Bookings ' + newBookWk + ', Events Held ' + heldWk + ', Deposits In ' + depCollWk,
      close: STEPS.map(s => s.label + (done[s.key] ? ' (handled)' : ' (open)')).join(', '),
      results: 'Booked ' + ED._money(st.bookedRev) + ', Pipeline ' + ED._money(st.pipeline) + ', Deposits Due ' + ED._money(st.depositsDue) + ', Win Rate ' + st.conv,
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Events', 'ev-dashboard', 'events', this._statusText(doneCount, STEPS.length), [
      { label: 'Done This Week', html: activity },
      { label: 'Pipeline Handled &middot; ' + doneCount + ' of ' + STEPS.length, html: this._closeList(STEPS, done) },
      { label: 'What It Turned Up &middot; Current Pipeline', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Books (monthly close) ───────────────────────────────────────────────────
  _booksSection() {
    const BH = S.HubBooksHome;
    if (!BH) return '';
    if (!((App.data && App.data.weeks) || []).length) return null;

    let st, done, doneCount;
    try {
      st = BH._computeState();
      done = BH.stepDone();
      doneCount = BH.ORDER.filter(k => done[k]).length;
    } catch (e) { return null; }

    const opex = (App.data && App.data.operating_expenses) || [];
    const billsWk = opex.filter(r => r && this._inWeek(r.date)).length;
    const outflowWk = ((App.data && App.data.cash_outflows) || []).filter(o => this._inWeek(o.date || o.created_at)).length;
    const billsMonth = opex.filter(r => r && String(r.date || '').slice(0, 7) === st.curKey).length;
    const rawRun = key => { try { return localStorage.getItem(key); } catch (e) { return null; } };
    const pnlRun = rawRun('books_report_run_weeklypnl');
    const meRun  = rawRun('books_report_run_monthend');
    const reportsWk = (pnlRun && this._inWeek(String(pnlRun).slice(0, 10)) ? 1 : 0) + (meRun && this._inWeek(String(meRun).slice(0, 10)) ? 1 : 0);

    const STEPS = [
      { key: 'expenses', label: 'Logged the month\'s expenses' },
      { key: 'pnl',      label: 'Generated the P&L brief' },
      { key: 'review',   label: 'Reviewed the income statement' },
      { key: 'generate', label: 'Generated Month-End Books' }
    ];

    const activity = this._actRow([
      this._act(billsWk, 'Bills Logged'), this._act(outflowWk, 'Outflows Logged'), this._act(reportsWk, 'Reports Run')
    ]);
    const results = this._resRow([
      this._res('Op Income YTD', BH._money(st.ytdInc), st.ytdInc < 0 ? 'var(--red)' : 'var(--t1)'),
      this._res('Margin', BH._pct(st.ytdMargin)),
      this._res('Month Revenue', BH._money(st.cmRev)),
      this._res('Month Income', BH._money(st.mInc), st.mInc < 0 ? 'var(--red)' : 'var(--t1)')
    ]);

    const open = [];
    if (!done.expenses && billsMonth === 0) open.push({ t: 'No bills logged this month yet', sev: 'amber' });
    if (!done.generate) open.push({ t: esc(st.monthName) + ' books not closed yet', sev: 'amber' });
    if (st.dueCount > 0) open.push({ t: '<b>' + st.dueCount + '</b> permit/license item' + (st.dueCount === 1 ? '' : 's') + ' need attention', sev: st.expiredCt > 0 ? 'red' : 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Books', status: this._statusPlain(doneCount, STEPS.length),
      activity: 'Bills Logged ' + billsWk + ', Outflows Logged ' + outflowWk + ', Reports Run ' + reportsWk,
      close: STEPS.map(s => s.label + (done[s.key] ? ' (done)' : ' (open)')).join(', '),
      results: 'Op Income YTD ' + BH._money(st.ytdInc) + ', Margin ' + BH._pct(st.ytdMargin) + ', Month Revenue ' + BH._money(st.cmRev) + ', Month Income ' + BH._money(st.mInc),
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing to close' });
    return this._sectionCard('Books', 'books-home', 'books', this._statusText(doneCount, STEPS.length), [
      { label: 'Done This Week', html: activity },
      { label: 'The Monthly Close &middot; ' + doneCount + ' of ' + STEPS.length, html: this._closeList(STEPS, done) },
      { label: 'What It Turned Up &middot; Month + YTD', html: results },
      { label: 'To Close', html: this._openList(open) }
    ], 'S.HubBooksHome&&S.HubBooksHome.open&&S.HubBooksHome.open()');
  },

  render(mount) {
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    if (this._wkStart == null) this._wkStart = this._monday();

    const products = ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
    const counts = (App.inventoryData && App.inventoryData.ic_counts) || [];
    if (!products.length || !counts.length) {
      App.setupCard(mount, {
        title: 'Week Review',
        lead: 'Week Review shows what your team actually did in each section this week, what got skipped, and what is carrying over. It reads from your real logs, so set up and work a section first.',
        steps: [{ title: 'Set up Inventory', desc: 'Add products and take a count, then work a weekly close. Week Review reads it back here.', btn: 'Open Inventory', screen: 'ic-dashboard', done: false }]
      });
      return;
    }

    // ── Week selector (standard buttoned arrows + pill + This Week) ─────────────
    const fmt = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(); };
    const range = fmt(this._wkS()) + ' - ' + fmt(this._wkE());
    const isCur = this._isThisWeek();
    const prevBtn = '<button class="btn btn-ghost btn-sm wr-arrow" data-step="-7" aria-label="Previous week" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = isCur
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm wr-arrow" data-step="7" aria-label="Next week" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pill = '<span style="display:inline-flex;align-items:center;border:1px solid var(--b-edge);background:var(--sel-active-bg);border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;color:var(--t1);white-space:nowrap;">'
      + esc(range) + (isCur ? '<span style="color:var(--gold);font-weight:800;font-size:11px;margin-left:6px;">NOW</span>' : '') + '</span>';
    const nowBtn = isCur ? '' : '<button class="btn btn-ghost btn-sm wr-now" style="margin-left:4px;">This Week</button>';
    const exportBtn = '<button class="btn btn-ghost btn-sm no-print" id="wr-export">Export PDF</button>';
    const selectorRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:inline-flex;align-items:center;gap:8px;">' + prevBtn + pill + nextBtn + nowBtn + '</div>'
      + exportBtn + '</div>';

    this._pdf = [];   // section payloads, collected as each section builds, for the PDF
    const sections = [this._inventorySection(), this._laborSection(), this._shiftSection(), this._profitSection(), this._revenueSection(), this._cashSection(), this._eventsSection(), this._booksSection()].filter(Boolean).join('');

    mount.innerHTML = '<div class="screen wr-screen">'
      + this._topCard()
      + selectorRow
      + '<div class="wr-grid">' + sections + '</div>'
      + '</div>';

    mount.querySelectorAll('.wr-arrow').forEach(a =>
      a.addEventListener('click', () => this._step(parseInt(a.dataset.step, 10))));
    mount.querySelector('.wr-now')?.addEventListener('click', () => { this._wkStart = this._monday(); this.render(mount); });
    document.getElementById('wr-export')?.addEventListener('click', () => this._exportPDF());
    document.getElementById('wr-brief')?.addEventListener('click', () => this.showBriefing());
  },

  // ── Bar Cop Briefing — a written cross-section read of the week. Code-generated
  //    (no API), off the same per-section payloads the page and PDF are built from.
  showBriefing() {
    DashUI.insightsModal('Bar Cop Briefing', this._briefing());
  },
  _briefing() {
    const m = this._weekMoney();
    const secs = this._pdf || [];
    const money = n => App.fmtCurrency(n, 0);
    const pctv = v => (v != null && !isNaN(v)) ? (Number(v).toFixed(1) + '%') : null;
    const paras = [];

    // 1 — the week's headline
    if (m.netSales != null) {
      let p1 = 'This week rang ' + money(m.netSales);
      const bits = [];
      if (m.prime != null) bits.push('a ' + pctv(m.prime) + ' prime cost');
      if (m.laborPct != null) bits.push(pctv(m.laborPct) + ' labor');
      if (bits.length) p1 += ' on ' + bits.join(' and ');
      paras.push(p1 + '.');
    } else {
      paras.push('The week is not confirmed yet, so the sales and cost numbers are still open. Confirm it in Profit or Revenue and the money reads fill in.');
    }

    // 2 — who is on it, who slipped
    const complete = secs.filter(s => s.status === 'Complete').map(s => s.name);
    const openSecs = secs.filter(s => s.status !== 'Complete');
    if (complete.length) paras.push(complete.join(', ') + ' closed clean this week.' + (openSecs.length ? '' : ' The whole board is caught up.'));
    if (openSecs.length) {
      const lead = this._isThisWeek() ? 'Still open: ' : 'Fell short: ';
      paras.push(lead + openSecs.map(s => s.name + ' (' + s.status + ')').join(', ') + '.');
    }

    // 3 — the biggest open items across the board
    const opens = secs.filter(s => s.open && !/^Nothing/.test(s.open)).map(s => s.name + ', ' + s.open.split(';')[0].trim());
    if (opens.length) paras.push('Worth chasing first: ' + opens.slice(0, 4).join('; ') + '.');
    else paras.push('Nothing is carrying over. Clean week across the board.');

    // 4 — the one move
    let move;
    if (m.netSales == null) move = 'The one move this week: confirm the week in Profit and Revenue so the whole page reads real, then take down the biggest leak.';
    else if (openSecs.length) move = 'Finish the open sign-offs above before next week starts, worst first.';
    else move = 'Nothing urgent. Hold the discipline and keep every section closing on time.';
    paras.push(move);

    return paras.map(p => '<p style="margin:0 0 12px;">' + esc(p) + '</p>').join('');
  },

  // Plain-text status + tag strip for the PDF.
  _statusPlain(doneCount, total) {
    const r = total - doneCount;
    if (r === 0) return 'Complete';
    return this._isThisWeek() ? (r + ' to do') : (r + ' missed');
  },
  _stripTags(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, ''); },

  // Data-driven PDF built from the per-section payloads collected during render.
  async _exportPDF() {
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const m = this._weekMoney();
    const pctv = v => (v != null && !isNaN(v)) ? (Number(v).toFixed(1) + '%') : '-';
    const fmt = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
    const range = fmt(this._wkS()) + ' - ' + fmt(this._wkE());
    const b = App._pdfBuilder('Week in Review', {});
    b.header({ right: 'Week in Review', meta: range });
    b.kv('Net Sales', m.netSales != null ? App.fmtCurrency(m.netSales, 0) : '-');
    b.kv('Prime Cost', pctv(m.prime));
    b.kv('Labor', pctv(m.laborPct));
    (this._pdf || []).forEach(s => {
      b.sectionTitle(s.name + '   (' + s.status + ')');
      if (s.activity) b.paragraph('Done this week: ' + s.activity, { gray: 70 });
      b.paragraph('Weekly close: ' + s.close, { gray: 70 });
      b.paragraph('What it turned up: ' + s.results, { gray: 70 });
      b.paragraph('Carrying over: ' + s.open, { gray: 70 });
    });
    await b.save('Week in Review');
  },

  showHowTo() {
    App.showHelpModal('How Week Review Works', [
      { p: ['Week Review is the accountability side of your weekly close. For any week it reads what your team actually did in each section, whether the weekly close got finished, what it turned up, and what is carrying into next week, so you can see in one place where the crew is on it and where things slid.'] },
      { h: 'Pick a week', p: ['Use the arrows to step back through your weeks. NOW marks the current one. Everything reads from your real logs and the steps you marked done, nothing projected.'] },
      { h: 'Read a section', p: ['Done This Week is the raw activity that got logged: counts, deliveries, hours, tips, sales days, and for the Recovery sections the audits run, sales reviews, vendor discrepancies filed, investigations opened, and experiments running. The Weekly Close shows which sign-off steps got finished and which are still open. What It Turned Up is the result, and Carrying Into Next Week is the open items to clear.'] },
      { h: 'Why some numbers read a dash', p: ['The Recovery sections (Profit, Revenue, Cash) only produce cost and margin numbers once you Confirm the Week, which rolls up that week\'s revenue, COGS, and labor into the numbers. Until you do, the cost cells read a dash and the Weekly Close shows a red X on "Confirmed the week." That dash and that X are the signal: they are telling you the week is not confirmed yet, so go into the section, confirm it, and the numbers fill in. This is on purpose. A dash is an honest blank, never a made-up number.'] },
      { h: 'Export', p: ['Export PDF saves the week as a one-page accountability report you can keep or hand off.'] }
    ]);
  }
};
