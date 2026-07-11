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
    if (App._hubBlocked && App._hubBlocked('hub-books-home')) return;   // Books area gate
    App.openHubFullPage('Week Review', (mount) => { this.container = mount; this.render(mount); }, 'week-review');
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
    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 22px;"></div>';
    return '<div style="display:flex;align-items:flex-start;flex-wrap:wrap;row-gap:16px;">' + items.join(vdiv) + '</div>';
  },
  _res(label, val, col) {
    return '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:600;line-height:1;color:' + (col || 'var(--t1)') + ';">' + val + '</div></div>';
  },
  _resRow(items) {
    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 24px;"></div>';
    return '<div style="display:flex;align-items:flex-start;flex-wrap:wrap;row-gap:16px;">' + items.join(vdiv) + '</div>';
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
  _sectionCard(name, screen, mod, statusText, blocks) {
    const idiv = '<div style="height:1px;background:var(--b2);margin:0 20px;"></div>';
    const header = '<div style="display:flex;align-items:center;gap:12px;padding:15px 20px;border-bottom:1px solid var(--b2);min-width:0;">'
      + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:17px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:var(--t1);">' + esc(name) + '</span>'
      + statusText + '</div>';
    const body = blocks.map(b => '<div style="padding:15px 20px;">' + this._eyebrow(b.label) + b.html + '</div>').join(idiv);
    const footer = idiv + '<div style="padding:14px 20px;">'
      + '<button class="btn btn-ghost btn-sm no-print" onclick="S.Hub._enter(\'' + screen + '\',\'' + mod + '\')">Open ' + esc(name) + '</button></div>';
    return '<div class="card" style="padding:0;overflow:hidden;margin-bottom:16px;">' + header + body + footer + '</div>';
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
    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 34px;"></div>';
    const stats = [
      stat('Net Sales', m.netSales != null ? App.fmtCurrency(m.netSales, 0) : '-'),
      stat('Prime Cost', pct(m.prime)),
      stat('Labor', pct(m.laborPct))
    ].join(vdiv);
    return '<div class="card" style="margin-bottom:16px;overflow:hidden;padding:0;">'
      + '<div style="padding:12px 22px;border-bottom:1px solid var(--b2);"><div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);">Week In Review</div></div>'
      + '<div style="padding:20px 22px;display:flex;align-items:flex-start;flex-wrap:wrap;row-gap:16px;">' + stats + '</div></div>';
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

    return this._sectionCard('Profit', 'dashboard', 'profit', this._statusText(doneCount, STEPS.length), [
      { label: 'Done This Week', html: activity },
      { label: 'The Weekly Close &middot; ' + doneCount + ' of ' + STEPS.length, html: this._closeList(STEPS, done) },
      { label: 'What It Turned Up', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
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
    const selectorRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;">'
      + '<div style="display:inline-flex;align-items:center;gap:8px;">' + prevBtn + pill + nextBtn + nowBtn + '</div>'
      + exportBtn + '</div>';

    const sections = [this._inventorySection(), this._laborSection(), this._shiftSection(), this._profitSection()].filter(Boolean).join('');
    const note = '<div style="margin-top:4px;font-size:11.5px;color:var(--t4);line-height:1.6;">Revenue, Cash, Events, and Books roll up the same way, added next.</div>';

    mount.innerHTML = '<div class="screen">'
      + this._topCard()
      + selectorRow
      + '<div id="wr-export-root">' + sections + note + '</div>'
      + '</div>';

    mount.querySelectorAll('.wr-arrow').forEach(a =>
      a.addEventListener('click', () => this._step(parseInt(a.dataset.step, 10))));
    mount.querySelector('.wr-now')?.addEventListener('click', () => { this._wkStart = this._monday(); this.render(mount); });
    document.getElementById('wr-export')?.addEventListener('click', () =>
      App.exportPDF({ title: 'Week Review', subtitle: range, root: document.getElementById('wr-export-root') }));
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
