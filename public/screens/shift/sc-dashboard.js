'use strict';

/* ── Shift Control — Close The Week (landing screen) ──────────────────────────
   Not a stack of status cards. A guided weekly close-out: a progress banner, a
   step flow you work top to bottom (the current step expands as a live
   workspace, done steps collapse to a check), and a compact status strip + the
   as-needed outliers at the bottom. The keystone step (Import this week's sales
   & voids) runs INLINE here via PosIngest. This is the prototype for the
   weekly-cockpit pattern that rolls to the other section dashboards. */

S.ShiftDashboard = {
  _weekEnd: null,    // Sunday of the selected week
  _openStep: null,   // which step is expanded ('' = all collapsed; null = auto-open first undone)
  _flash: null,      // one-shot confirmation line under the banner
  _salesMode: null,  // step-1 sales entry: null/'import' = drop file, 'manual' = per-day grid

  showHowTo() {
    App.showHelpModal('How the Weekly Close Works', [
      { p: ['This is your weekly close-out for Shift. You land on the week, see how far along you are, and work the steps top to bottom. The current step opens right here as a workspace, so you do the quick things without leaving the page. When the week is done it reads "You\'re current this week."'] },
      { h: 'The Steps', p: ['1. Import this week\'s sales: drop your weekly POS sales-by-day report (one row per day) and Bar Cop reads the whole week at once. If your POS also exports a per-server sales report or a product-mix report, drop those in the same step and Bar Cop feeds your Server Check scorecard and Menu Engineering off the same sitting. 2. Reconcile cash: drop your POS cash report, or reconcile each drawer by hand in Cash Control if your POS does not make one. 3. Log exceptions: waste, spills, and walked tabs, off your sheet. 4. Review loss flags: cash shorts, voids, and comps worth a look.'] },
      { h: 'Working A Step', p: ['Click a step to open it. The import runs right on the page. The others either do the quick part here or send you to the full screen and come back. Mark a step done and the bar advances. The week selector at the top steps you to a prior week to close it out.'] },
      { h: 'The Bottom Strip', p: ['Once the week is in, the strip shows your revenue, voids, and cash over/short at a glance. Below it, the as-needed jobs (Spot Check, Maintenance, Run Checklists) are one tap away whenever you need them, not part of the weekly flow.'] }
    ]);
  },

  // ── Data ──────────────────────────────────────────────────────────────────
  shifts()     { return ((App.shiftData && App.shiftData.sc_shifts) || []); },
  variances()  { return ((App.shiftData && App.shiftData.sc_variances) || []); },
  voidComps()  { return ((App.shiftData && App.shiftData.sc_void_comps) || []); },
  walkedTabs() { return ((App.shiftData && App.shiftData.sc_walked_tabs) || []); },
  waste()      { return ((App.shiftData && App.shiftData.sc_waste) || []); },
  maint()      { return ((App.shiftData && App.shiftData.sc_maintenance) || []); },

  // ── Week math ───────────────────────────────────────────────────────────────
  weekEnd()   { return this._weekEnd || (App.nextSunday ? App.nextSunday() : App.todayLocal()); },
  weekStart() { return App.weekStartFor(this.weekEnd()); },
  inWeek(d)   { const s = this.weekStart(), e = this.weekEnd(); d = String(d || '').slice(0, 10); return !!d && d >= s && d <= e; },
  _stepWeek(n) {
    const d = new Date(this.weekEnd() + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    d.setDate(d.getDate() + n);
    const next = App.ymdLocal(d);
    const cur = App.nextSunday ? App.nextSunday() : App.todayLocal();
    if (n > 0 && next > cur) return;   // never walk into the future
    this._weekEnd = next;
    this._openStep = null; this._flash = null;
    this.render(this.container, this.actions);
  },

  // ── Per-week step-done stamps (operator-controlled, local to the device) ────
  _doneKey() { return 'sc_cockpit_done_' + this.weekEnd(); },   // account-synced (App.data), follows the user across devices; no per-browser suffix
  doneMap()  { return App.acctGet(this._doneKey(), {}); },
  setDone(step, val) { const m = { ...this.doneMap() }; m[step] = val; App.acctSet(this._doneKey(), m); },

  // A step is done ONLY when the operator marks it — never auto-checked off data.
  stepDone() {
    const dm = this.doneMap();
    const r = {};
    this.ORDER.forEach(k => { r[k] = !!dm[k]; });
    return r;
  },

  ORDER: ['import', 'cash', 'exc', 'review'],

  // Which week the read surfaces (Hub card stat strip + Where You Stand hero)
  // should show. The current week is empty until the close import, and neither the
  // Hub card nor the section hero may ever sit empty / disappear on a fresh week
  // (a live user hits that every week). So: the current week if it has sales, else
  // the most recent week that does, flagged "last wk". ONE resolver so the Hub and
  // the section can never disagree. The step flow + week selector stay on the
  // current week separately; this only drives the read.
  _statWeek() {
    const cur = App.nextSunday ? App.nextSunday() : App.todayLocal();
    const sv = this._weekEnd;
    try {
      this._weekEnd = cur;
      if (this.shifts().some(s => this.inWeek(s.date))) return { end: cur, lastWk: false };
      const dates = this.shifts().map(s => String(s.date || '').slice(0, 10)).filter(Boolean).sort();
      const latest = dates.length ? dates[dates.length - 1] : '';
      if (!latest) return { end: cur, lastWk: false };
      const ws = App.weekStartFor(latest);
      if (!ws) return { end: cur, lastWk: false };
      const d = new Date(ws + 'T00:00:00'); d.setDate(d.getDate() + 6);
      const sun = App.ymdLocal(d);
      return (sun && sun !== cur) ? { end: sun, lastWk: true } : { end: cur, lastWk: false };
    } finally { this._weekEnd = sv; }
  },

  // Compact step summary for the Hub Shift card; mirrors this page exactly.
  hubSteps() {
    const cur = (App.nextSunday ? App.nextSunday() : App.todayLocal());
    const sv = this._weekEnd; this._weekEnd = cur;
    try {
      const done = this.stepDone();
      const steps = this.ORDER.map(k => ({ key: k, label: this._META[k].title, done: !!done[k] }));
      // Step checklist stays on the CURRENT week; the stat strip uses _statWeek so
      // it never sits empty on a fresh week (falls back to the last week with data).
      const sw = this._statWeek();
      this._weekEnd = sw.end;
      const wkS = this.shifts().filter(s => this.inWeek(s.date));
      const rev = wkS.reduce((t, s) => t + (s.total_revenue || 0), 0);
      const voidTot = this.voidComps().filter(r => this.inWeek(r.date) && r.type === 'Void').reduce((t, r) => t + (r.amount || 0), 0);
      // ⚠ ZERO COUNTS IS NOT ZERO OVER/SHORT. An empty list reduces to 0, and $0.00 reads as a
      // perfectly balanced week — indistinguishable from one that actually balanced. That is the
      // normal mid-close state (sales imported, cash not reconciled yet) and the permanent state of
      // any bar that has not started counting drawers. Say "Not counted" instead; the app already
      // uses that exact word as a variance status elsewhere.
      const wkVar = this.variances().filter(v => this.inWeek(v.date));
      const varCount = wkVar.length;
      const netVar = wkVar.reduce((t, v) => t + (v.variance || 0), 0);
      const stats = [
        { label: 'Revenue', value: App.fmtCurrency(rev) },
        { label: 'Voids', value: App.fmtCurrency(voidTot) },
        varCount
          ? { label: 'Over / Short', value: (netVar > 0 ? '+' : '') + App.fmtCurrency(netVar), warn: netVar < 0 }
          : { label: 'Over / Short', value: 'Not counted', color: 'var(--t3)' }
      ];
      return { steps, stats, doneCount: steps.filter(s => s.done).length, total: steps.length, lastWk: sw.lastWk };
    } finally { this._weekEnd = sv; }
  },
  // ── Render ──────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container; this.actions = actions;
    if (actions) actions.innerHTML = '';
    if (!this._weekEnd) this._weekEnd = App.nextSunday ? App.nextSunday() : App.todayLocal();
    const done = this.stepDone();
    const doneCount = this.ORDER.filter(k => done[k]).length;
    if (this._openStep == null) this._openStep = this.ORDER.find(k => !done[k]) || '';
    const flash = this._flash; this._flash = null;
    const wys = this._wys();

    container.innerHTML = '<div class="screen">'
      + (wys.hasSales ? this.whereYouStand(wys) : this.getStartedBox())
      + this.banner(doneCount, this.ORDER.length)
      + (flash ? '<div style="font-size:12px;color:var(--green);font-weight:700;margin:12px 2px 0;">&#10003; ' + esc(flash) + '</div>' : '')
      + '<div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">'
      +   this.ORDER.map(k => this.stepRow(k, done)).join('')
      + '</div>'
      + this.outlierStrip()
      + '</div>';

    if (this._openStep === 'import' && this._salesMode !== 'manual') {
      this.mountImport();
      if (this._optOpen && this._optOpen.server) this.mountServer();
      if (this._optOpen && this._optOpen.pmix) this.mountPmix();
    }
    if (this._openStep === 'cash') this.mountCashImport();
    this.wire();
  },

  // ── Get Started: setup steps above the cockpit until both are done ───────────
  getStartedBox() {
    return App.controlGetStarted('Shift', [
      { num: 1, label: 'Set up your registers', screen: 'sc-cash-control',        done: ((App.shiftData && App.shiftData.sc_drawers) || []).filter(d => d.active !== false).length > 0 },
      { num: 2, label: 'Build your checklists',  screen: 'sc-checklist-templates', done: ((App.shiftData && App.shiftData.sc_checklist_templates) || []).length > 0 }
    ]);
  },

  // True when the shown week is the current week (or later) — the forward edge.
  // The cockpit only walks backward from the current week, never into the future.
  atCurrentWeek() {
    const cur = App.nextSunday ? App.nextSunday() : App.todayLocal();
    return this.weekEnd() >= cur;
  },
  // Week selector: ‹ [JUN 22 - JUN 28 NOW] › — one week at a time (arrows sit
  // OUTSIDE the pill). The shown week is always the active-selector pill
  // (--sel-active-bg) with the standard card border; a gold NOW marks the current
  // week and a This Week button appears to snap back once you step away. Forward
  // is inert on the current week.
  weekSelector() {
    const isCur = this.atCurrentWeek();
    const fmt = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(); };
    const range = fmt(this.weekStart()) + ' - ' + fmt(this.weekEnd());
    const nowBadge = isCur ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const prevBtn = '<button class="btn btn-ghost btn-sm sc-wk-prev" aria-label="Previous week" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = isCur
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm sc-wk-next" aria-label="Next week" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + esc(range) + nowBadge + '</span>';
    const nowBtn = isCur ? '' : '<button class="btn btn-ghost btn-sm sc-wk-now" style="margin-left:4px;">This Week</button>';
    return '<div style="display:inline-flex;align-items:center;gap:8px;">' + prevBtn + pill + nextBtn + nowBtn + '</div>';
  },

  // Standard titled card: an uppercase header band over the body (selector on the
  // left above the progress bar).
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
      +   (allDone ? '' : '<div style="font-size:11px;color:var(--t3);margin-top:12px;">Have ready: your weekly POS sales-by-day report, plus a cash report if your POS makes one.</div>')
      + '</div>'
      + '</div>';
  },

  _META: {
    import: { n: 1, title: 'Import this week\'s sales',             sub: 'Drop your weekly POS sales-by-day report' },
    cash:   { n: 2, title: 'Reconcile cash',                        sub: 'POS cash report, or a hand count in Cash Control' },
    exc:    { n: 3, title: 'Log this week\'s exceptions',           sub: 'Waste, spills, walked tabs' },
    review: { n: 4, title: 'Review loss flags',                     sub: 'Cash shorts, voids, comps' }
  },
  stepStatus(k, isDone) {
    if (k === 'import') {
      const n = this.shifts().filter(s => this.inWeek(s.date)).length;
      return n ? (n + ' day' + (n === 1 ? '' : 's') + ' imported') : this._META.import.sub;
    }
    if (k === 'cash') return isDone ? 'Reconciled' : this._META.cash.sub;
    if (k === 'exc') {
      const v = this.voidComps().filter(r => this.inWeek(r.date)).length;
      const w = this.waste().filter(r => this.inWeek(r.date)).length;
      const t = this.walkedTabs().filter(r => this.inWeek(r.date)).length;
      const tot = v + w + t;
      return tot ? (tot + ' logged this week') : (isDone ? 'Nothing to log' : this._META.exc.sub);
    }
    if (k === 'review') return isDone ? 'Reviewed' : this._META.review.sub;
    return '';
  },
  stepRow(k, done) {
    const m = this._META[k], isDone = done[k], isOpen = this._openStep === k;
    const circle = isDone
      ? '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:13px;font-weight:800;">&#10003;</span>'
      : '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:11px;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,.45);">' + m.n + '</span>';
    // Active box uses the panel-fill token (--gold-tint) with the standard card
    // border, so the white title and gold number read true, not washed by a
    // translucent tint.
    const bg = isOpen ? 'var(--gold-tint)' : (isDone ? 'var(--input)' : 'var(--surface)');
    const bord = 'var(--b-edge)';
    let html = '<div style="border:1px solid ' + bord + ';border-radius:var(--r);background:' + bg + ';overflow:hidden;">'
      + '<div class="sc-step-head' + (isOpen ? '' : ' collapsed') + '" data-step="' + k + '" style="display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;">'
      +   circle
      +   '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--t1);">' + m.title + '</div>'
      +     '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + this.stepStatus(k, isDone) + '</div></div>'
      +   '<span class="card-chevron" aria-hidden="true">&#9662;</span>'
      + '</div>';
    if (isOpen) html += '<div style="padding:2px 16px 18px;">' + this.workspace(k, isDone) + '</div>';
    return html + '</div>';
  },

  // A done step's button flips to "Mark not done" so any step can be unmarked.
  markBtn(k, label) {
    return this._isDone
      ? '<button class="btn btn-ghost btn-sm" data-undone="' + k + '">Mark not done</button>'
      : '<button class="btn btn-primary btn-sm" data-done="' + k + '">' + label + '</button>';
  },
  // Step-1 optional sales cut (per-server / product mix): collapsed to a gold
  // "+ Add POS Report" link under its title. Clicking opens its dropzone (link
  // flips to "+ Close POS Report"); once a file is dropped the mapping takes over
  // with its own Cancel and the link hides (see _toggleOptLink via onState).
  optDrop(id, title, sub, key) {
    const open = !!(this._optOpen && this._optOpen[key]);
    return '<div style="margin-top:16px;border-top:1px solid var(--b2);padding-top:14px;">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;"><span style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--t3);">' + title + ' <span style="color:var(--t4);font-weight:600;text-transform:none;letter-spacing:0;">&middot; optional</span></span>' + App.freqTag('Weekly') + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:12px;">' + sub + '</div>'
      + '<span class="sc-opt-link" data-opt="' + key + '" id="' + key + '-optlink" style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gold);cursor:pointer;">' + (open ? '+ Close POS Report' : '+ Add POS Report') + '</span>'
      + '<div id="' + id + '" style="margin-top:10px;' + (open ? '' : 'display:none;') + '"></div><div id="' + id + '-res"></div></div>';
  },
  workspace(k, isDone) {
    this._isDone = isDone;
    if (k === 'import') {
      const seg = this._salesSeg();
      if (this._salesMode === 'manual') {
        return seg + this._manualSalesGrid()
          + '<div id="sc-ck-import-res"></div>'
          + '<div id="sc-ck-import-btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;"><button class="btn btn-primary btn-sm" data-savesales="1">Save the Week</button>' + this.markBtn('import', 'Mark Done') + '</div>';
      }
      return seg
        + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">One file, the whole week. Pull your sales-by-day report from your POS and drop it below. Re-importing replaces the days already in. Mark this done once the week is in.</div>'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--t3);">Daily sales <span style="color:var(--t4);font-weight:600;text-transform:none;letter-spacing:0;">&middot; required</span></span>' + App.freqTag('Weekly') + '</div>'
        + '<div id="sc-ck-import"></div><div id="sc-ck-import-res"></div>'
        + this.optDrop('sc-ck-server', 'Per-server sales', 'One row per server with covers and sales. Feeds your Server Check scorecard.', 'server')
        + this.optDrop('sc-ck-pmix', 'Product mix', 'One row per item with units sold. Feeds Menu Engineering.', 'pmix')
        + '<div id="sc-ck-import-btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">' + this.markBtn('import', 'Mark Done') + '</div>';
    }
    if (k === 'cash') {
      return '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">Get this week\'s cash over/short in. If your POS makes a cash or drawer report, drop it here. No report? Reconcile your drawers in Cash Control. Mark this done once it is handled, or if you do not track cash over/short.</div>'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--t3);">Cash report</span>' + App.freqTag('Weekly') + '</div>'
        + '<div id="sc-ck-cash"></div><div id="sc-ck-cash-res"></div>'
        + '<div id="sc-ck-cash-btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">'
        + '<button class="btn btn-ghost btn-sm" data-go="sc-cash-control">Reconcile by Hand</button>'
        + this.markBtn('cash', 'Mark Done') + '</div>';
    }
    if (k === 'exc') {
      const cnt = (arr) => arr.filter(r => this.inWeek(r.date)).length;
      const v = cnt(this.voidComps()), w = cnt(this.waste()), t = cnt(this.walkedTabs());
      const tally = '<div style="font-size:12px;color:var(--t2);margin-bottom:12px;">This week so far: '
        + '<strong style="color:var(--t1);">' + v + '</strong> voids/comps, <strong style="color:var(--t1);">' + w + '</strong> waste, <strong style="color:var(--t1);">' + t + '</strong> walked tabs.</div>';
      return tally
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        + '<button class="btn btn-ghost btn-sm" data-go="sc-void-comp">Voids / Comps</button>'
        + '<button class="btn btn-ghost btn-sm" data-go="sc-waste">Waste / Spills</button>'
        + '<button class="btn btn-ghost btn-sm" data-go="sc-walked-tabs">Walked Tabs</button>'
        + this.markBtn('exc', 'Mark Reviewed') + '</div>';
    }
    // review
    const wkVar = this.variances().filter(v => this.inWeek(v.date));
    const shorts = wkVar.filter(v => v.status === 'Short').length;
    const oot = wkVar.filter(v => v.status === 'Over' || v.status === 'Short').length;
    const wkVC = this.voidComps().filter(r => this.inWeek(r.date));
    const voidTot = wkVC.filter(r => r.type === 'Void').reduce((s, r) => s + (r.amount || 0), 0);
    const compTot = wkVC.filter(r => r.type === 'Comp').reduce((s, r) => s + (r.amount || 0), 0);
    const line = (label, val, warn) => '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;font-size:12px;">'
      + '<span style="color:var(--t2);">' + label + '</span><span style="font-weight:700;color:' + (warn ? 'var(--red)' : 'var(--t1)') + ';">' + val + '</span></div>';
    // ⚠ Not counted ≠ zero shorts (S77): a $0/0 read over a week nobody reconciled is the same
    // "clean" lie the "Not counted" tile above already avoids — mirror it here.
    const counted = wkVar.length > 0;
    return line('Cash shorts this week', counted ? String(shorts) : 'Not counted', counted && shorts > 0)
      + line('Drawers out of tolerance', counted ? String(oot) : 'Not counted', counted && oot > 0)
      + line('Voids', App.fmtCurrency(voidTot), false)
      + line('Comps', App.fmtCurrency(compTot), false)
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">'
      + '<button class="btn btn-ghost btn-sm" data-go="theft-risk">Open Loss Prevention</button>'
      + this.markBtn('review', 'Mark Reviewed') + '</div>';
  },

  // ── Where You Stand state (the week's floor headline + reads) ────────────────
  _wys() {
    // Reads through the shared _statWeek resolver so the hero shows the current
    // week when it has sales and otherwise the last week that does (never blank).
    const sw = this._statWeek();
    const sv = this._weekEnd;
    try {
      this._weekEnd = sw.end;
      const wkS = this.shifts().filter(s => this.inWeek(s.date));
      const rev = wkS.reduce((t, s) => t + (parseFloat(s.total_revenue) || 0), 0);
      const covers = wkS.reduce((t, s) => t + (s.covers || 0), 0);
      const checkAvg = covers > 0 ? rev / covers : null;
      const wkVC = this.voidComps().filter(r => this.inWeek(r.date));
      const voidTot = wkVC.filter(r => r.type === 'Void').reduce((t, r) => t + (r.amount || 0), 0);
      const compTot = wkVC.filter(r => r.type === 'Comp').reduce((t, r) => t + (r.amount || 0), 0);
      // varCount carries "was the drawer counted at all", which netVar alone cannot express — see
      // the note in hubSteps. Every consumer of netVar must check it before showing a figure.
      const wkVar = this.variances().filter(v => this.inWeek(v.date));
      const netVar = wkVar.reduce((t, v) => t + (v.variance || 0), 0);
      // shorts/oot/walked computed HERE, in the stat-week context, so _insBriefing reads them off `st`
      // instead of recomputing against the (often empty) selected week — that mismatch printed last
      // week's net short with this week's zero shift/walked counts (S76).
      const shorts = wkVar.filter(v => v.status === 'Short').length;
      const oot = wkVar.filter(v => v.status === 'Over' || v.status === 'Short').length;
      const walked = this.walkedTabs().filter(r => this.inWeek(r.date)).length;
      return { wkS, rev, covers, checkAvg, voidTot, compTot, netVar, varCount: wkVar.length, shorts, oot, walked, days: wkS.length, hasSales: wkS.length > 0, lastWk: sw.lastWk };
    } finally { this._weekEnd = sv; }
  },

  // ── Where You Stand (floor headline + three-stat read + Briefing) ────────────
  whereYouStand(st) {
    const sub = st.hasSales
      ? st.days + ' day' + (st.days === 1 ? '' : 's') + ' imported' + (st.checkAvg != null ? ' &middot; ' + App.fmtCurrency(st.checkAvg) + ' check average' : '')
      : 'import this week\'s sales to fill this in';
    const hero = '<div style="padding:2px 0;">'
      + '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">'
      +   '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:600;line-height:0.9;color:var(--w);">' + App.fmtCurrency(st.rev, 0) + '</span>'
      +   '<span style="font-size:13px;color:var(--t2);">in sales</span>'
      +   (st.lastWk ? '<span style="font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--t3);border:1px solid var(--b-edge);border-radius:4px;padding:2px 6px;">last wk</span>' : '')
      + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:12px;">' + sub + '</div></div>';
    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 30px;"></div>';
    const mini = (label, val, col) => '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:600;line-height:1;color:' + (col || 'var(--t1)') + ';">' + val + '</div></div>';
    const vcTot = st.voidTot + st.compTot;
    const secondary = '<div style="margin-top:12px;padding-top:14px;border-top:1px solid var(--b2);">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Where The Money Walked</div>'
      + '<div style="display:flex;align-items:flex-start;flex-wrap:wrap;">'
      +   mini('Covers', String(st.covers)) + vdiv
      +   (st.varCount
            ? mini('Cash Over / Short', (st.netVar > 0 ? '+' : '') + App.fmtCurrency(st.netVar, 0), st.netVar < 0 ? 'var(--red)' : 'var(--t1)')
            : mini('Cash Over / Short', 'Not counted', 'var(--t3)')) + vdiv
      +   mini('Voids + Comps', App.fmtCurrency(vcTot, 0))
      + '</div>'
      + '<div style="margin-top:14px;"><button class="btn btn-ghost btn-sm" data-go="theft-risk">Loss Prevention</button></div>'
      + '</div>';
    return '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span>Where You Stand</span>'
      + '<button class="btn btn-ghost btn-sm" data-insights style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Bar Cop Briefing</button></div>'
      + hero + secondary + '</div>';
  },

  // ── Bar Cop Briefing: a written read of the floor week, cached a week per
  //    section via DashUI so repeat opens do not spend on the API. ─────────────
  // Code-generated (no API): where sales stand, where money walks, the one move.
  showInsights() {
    const st = this._wys();
    if (!st.hasSales) { DashUI.insightsModal('Bar Cop Briefing', 'Import a week of sales and Bar Cop can read your floor week for you.'); return; }
    DashUI.insightsModal('Bar Cop Briefing', this._insBriefing(st));
  },

  _insBriefing(st) {
    const m = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');
    // Read off `st` (the stat week _wys resolved), NOT a recompute against the selected week — the two
    // disagree on a fresh Monday and the Briefing printed last week's net short with this week's zero
    // counts (S76). `counted` gates every cash claim so an uncounted week never reads clean.
    const shorts = st.shorts || 0, oot = st.oot || 0, walked = st.walked || 0;
    const counted = st.varCount > 0;
    const vc = (st.voidTot || 0) + (st.compTot || 0);
    const paras = [];

    // 1 — where sales stand
    let p1 = 'You rang ' + m(st.rev) + ' across ' + st.days + ' day' + (st.days === 1 ? '' : 's') + ' this week on ' + st.covers + ' covers';
    p1 += st.checkAvg != null ? ', a ' + m(st.checkAvg) + ' check.' : '.';
    paras.push(p1);

    // 2 — where money is walking. Cash figures are gated on `counted`, and the "no drawer counted"
    // note is INDEPENDENT of voids/comps (S79): an ordinary week has voids, which used to fill `walks`
    // and suppress the note while the tile above still read "Not counted".
    const walks = [];
    if (counted && st.netVar < 0) walks.push('the drawer came up ' + m(Math.abs(st.netVar)) + ' short net' + (shorts > 0 ? ' across ' + shorts + ' short shift' + (shorts === 1 ? '' : 's') : ''));
    else if (counted && st.netVar > 0) walks.push('the drawer ran ' + m(st.netVar) + ' over net, which is its own flag');
    if (oot > 0) walks.push(oot + ' drawer' + (oot === 1 ? '' : 's') + ' out of tolerance');
    if (vc > 0) walks.push(m(st.voidTot) + ' in voids and ' + m(st.compTot) + ' in comps');
    if (walked > 0) walks.push(walked + ' walked tab' + (walked === 1 ? '' : 's'));

    let p2;
    if (!counted) {
      p2 = 'No drawer was counted this week, so cash is unread'
         + (walks.length ? '. On the floor: ' + walks.join(', ') + '.' : '. Reconcile the drawers and this fills in.');
    } else if (walks.length) {
      p2 = 'Where money is walking: ' + walks.join(', ') + '.';
    } else {
      p2 = 'The register is clean this week. Drawer is in tolerance and voids and comps are quiet.';
    }
    paras.push(p2);

    // 3 — the single move, tied to what para 2 actually found (S78). The final "nothing walking" is
    // reachable ONLY when `walks` is empty, so a walked tab or a within-tolerance net short (both of
    // which para 2 lists) never reads as "nothing walking" one line below "money is walking".
    let move;
    if (!counted) move = 'Reconcile the drawers first so cash gets read, then log the exceptions as they happen.';
    else if (oot > 0 || st.netVar < -20) move = 'Chase the cash first. Pull the out-of-tolerance drawers in Cash Control and see who counted and when.';
    else if (vc > 0) move = 'Watch the voids and comps by server in Loss Prevention. The ones who spike are the conversation.';
    else if (walks.length) move = 'Nothing major this week, but it is not spotless. Keep the drawer counts honest and log the exceptions as they happen.';
    else move = 'Nothing walking this week. Keep the drawer counts honest and log the exceptions as they happen.';
    paras.push(move);

    return paras.map(p => '<p style="margin:0 0 12px;">' + esc(p) + '</p>').join('');
  },

  outlierStrip() {
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;">'
      + '<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-right:4px;">As needed</span>'
      + '<button class="btn btn-ghost btn-sm" data-go="sc-maintenance">Maintenance</button>'
      + '<button class="btn btn-ghost btn-sm" data-go="sc-checklists">Run Checklists</button>'
      + '</div>';
  },

  // Hide a step's own buttons while the column-mapper is open so they do not
  // stack under the mapper's Import/Cancel row; show them again on cancel.
  _toggleBtns(id, st) { const b = document.getElementById(id); if (b) b.style.display = (st === 'map') ? 'none' : 'flex'; },
  // Hide the "+ Close POS Report" link once a file is dropped and the mapping (with
  // its own Cancel) takes over; show it again when the mapper returns to the drop zone.
  _toggleOptLink(key, st) { const l = document.getElementById(key + '-optlink'); if (l) l.style.display = (st === 'map') ? 'none' : ''; },

  // ── Inline sales import (step 1) ─────────────────────────────────────────────
  mountImport() {
    const el = document.getElementById('sc-ck-import');
    if (!el || typeof CSVMapper === 'undefined' || typeof PosIngest === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your weekly POS sales-by-day report here',
      dropSub: 'Needs a Date column plus your sales (bar and/or food). Covers optional. One row per day.',
      fields: PosIngest.FIELDS.sales,
      confirmLabel: 'Import',
      onState: st => this._toggleBtns('sc-ck-import-btns', st),
      onComplete: rows => this.importSales(rows)
    });
  },
  // opts.manual = came from the Enter Manually grid, which has no file, so it must never be told to
  // go check the file's columns, and is an EDIT (never raises a conflict against itself).
  // opts.cleared = days zeroed out by that grid.
  async importSales(rows, opts) {
    // ⚠ Re-entry guard, the twin of importCash's (S146). The CSVMapper Import button (.csvm-go) is
    // not disabled after onComplete, and saveManualSales routes through here too — so a double-click
    // re-enters. Unlike a re-import (idempotent via S147 id-reuse), the FIRST multi-day import while
    // ONLINE is not: the second call's buildSales reuses only the day already written and mints FRESH
    // ids for the rest, and each _commitSales computed its retire set before the other's rows landed,
    // so days 2..N get written twice and double-count Confirm the Week, the cash-forecast baseline and
    // the sales-tax hold. Held through the commit (return await) so a click during the conflict prompt
    // or the write can't double either. The real body is _doImportSales.
    if (this._importingSales) return;
    this._importingSales = true;
    try { return await this._doImportSales(rows, opts); }
    finally { this._importingSales = false; }
  },
  // ⚠ The partial-save helpers moved to App.landedOf / App.partialSaveNote — FIVE import doors
  // need them (sales, cash, per-server, voids, and the two labour doors) and three had already
  // drifted into three wordings of the same lie. Read the contract there before changing a caller.
  async _doImportSales(rows, opts) {
    opts = opts || {};
    const built = PosIngest.build('sales', rows, opts);
    const { toAdd, skipped, zeroSkipped, unchanged, undated, dupCount, merged, keptManual, conflicts, colGaps } = built;
    // ⚠ ROWS whose DATE could not be read, split out of `skipped` (which is keyed per DAY). Two
    // different problems with two different fixes; the red headline below used to blame the Date
    // column for both, so a file whose dates all parsed could still be told to go check them.
    const nUnd = (undated || []).length;
    const undNote = nUnd ? ' (' + nUnd + ' row' + (nUnd === 1 ? '' : 's') + ' skipped, no readable date)' : '';
    // Days this file had nothing new for — every figure it carried already matches what is saved.
    // Rebuilding those records and calling them "replaced earlier figures" claimed a change that
    // never happened; re-dropping the same export is the ordinary way to land here.
    const nSame = (unchanged || []).length;
    const sameNote = nSame ? ' (' + nSame + ' day' + (nSame === 1 ? '' : 's')
        + ' already matched what is saved)' : '';
    /* ⚠ NAME THE COLUMN, AND SAY WHAT ACTUALLY HAPPENED TO IT. The copy here read "(covers could
       not be read on N days, so those days kept their existing count — sales still came in)". It
       was written when this only ever fired for covers. The test underneath it has since widened to
       bar and food, so on a bad BAR column every one of those three claims was false at once — and
       the worst of them, "sales still came in", is precisely the thing that did not happen. This is
       my own copy, left standing after the code beneath it grew. Two outcomes, two sentences:
         kept   — a day that already had a record keeps the figure already saved;
         zeroed — a brand-new day, so the column was written as 0 and is now part of a
                  total_revenue that Confirm the Week, the cash forecast and the tax hold all read. */
    const COLNAME = { bar: 'Bar sales', food: 'Food sales', covers: 'Covers' };
    const colList = g => {
      const cols = ['bar', 'food', 'covers'].filter(k => ((g || {})[k] || []).length);
      if (!cols.length) return null;
      const days = new Set(); cols.forEach(k => g[k].forEach(d => days.add(d)));
      const names = cols.map(k => COLNAME[k]);
      return { text: names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1],
               n: days.size };
    };
    /* ⚠ BUILT AFTER THE CONFLICT PROMPT, not here. Which days belong in the `kept` bucket is not
       known until the operator has answered — a conflict day they KEEP is a day the import never
       touched, and its gap note would read as a second, separate event alongside "1 day kept as you
       entered it". The builder cannot know that; only the answer can. `keptConflictDates` is filled
       in below and this string is assembled straight after.
       ⚠ "NO USABLE FIGURE", not "could not be read" and not "had no figure". One bucket covers BOTH
       a cell blank on this day and a cell holding something Bar Cop refused (a negative, a date, a
       range), and the two earlier phrasings were each false for the other case: a day whose Bar cell
       held "($4,500.00)" was told the file "had no figure for bar sales" with $4,500 sitting right
       there in the column. One phrase that is true of both. */
    const keptConflictDates = new Set();
    let covNote = '';
    const buildCovNote = () => {
      const gaps = colGaps || {};
      const gk = colList(gaps.kept), gz = colList(gaps.zeroed);
      covNote = (gk ? ' (' + gk.text + ' had no usable figure on ' + gk.n + ' day' + (gk.n === 1 ? '' : 's')
                      + ', so ' + (gk.n === 1 ? 'that day' : 'those days') + ' kept the figures already saved)' : '')
              + (gz ? ' (' + gz.n + ' new day' + (gz.n === 1 ? '' : 's') + ' had no usable figure for '
                      + gz.text.toLowerCase() + ', so ' + (gz.n === 1 ? 'it was' : 'they were')
                      + ' saved as zero)' : '');
    };
    // A day the operator typed covers into with both sales cells left empty. saveManualSales drops
    // it (a covers-only row is not a saveable day) and hands the labels over so it is not dropped
    // in silence while every other day saves.
    const coNote = (opts.coversOnly && opts.coversOnly.length)
      ? ' (' + opts.coversOnly.length + ' day' + (opts.coversOnly.length === 1 ? '' : 's')
        + ' had covers but no sales and ' + (opts.coversOnly.length === 1 ? 'was' : 'were')
        + ' not saved: ' + opts.coversOnly.join(', ') + ')'
      : '';
    // S189: days that came in at $0. An import will NOT write $0 over FACT-tier sales (a blank/partial
    // export must not silently wipe a day), so a zero day is reported plainly and the operator is sent
    // to Enter Manually — the sanctioned zeroing path — rather than told "no usable sales figure".
    const zeroNote = (zeroSkipped && zeroSkipped.length)
      ? ' (' + zeroSkipped.length + ' day' + (zeroSkipped.length === 1 ? '' : 's') + ' came in at $0 and '
        + (zeroSkipped.length === 1 ? 'was' : 'were') + ' skipped — use Enter Manually to record a zero day)'
      : '';
    const res = document.getElementById('sc-ck-import-res');
    const fail = m => { if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">' + m + '</div>'; };
    const note = m => { if (res) res.innerHTML = '<div style="font-size:13px;color:var(--t2);margin-top:12px;">' + m + '</div>'; };
    // A conflict: the file disagrees with days the operator entered BY HAND. Ask which wins before
    // writing anything ([[user-chooses-conflicts]]). Never on the manual grid — that IS the choice.
    const extra = []; let usedTheirs = 0;
    if (conflicts && conflicts.length) {
      const money = v => v == null ? '—' : '$' + (Math.round(v * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const dayLabel = d => { const dt = new Date(d + 'T00:00:00'); return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
      const salesText = v => {
        const parts = [];
        if (v.bar_revenue != null) parts.push('Bar ' + money(v.bar_revenue));
        if (v.floor_revenue != null) parts.push('Food ' + money(v.floor_revenue));
        if (v.covers != null) parts.push(v.covers + (v.covers === 1 ? ' cover' : ' covers'));
        return parts.join(' · ') || '—';
      };
      const r = await App.promptImportConflicts({
        title: 'Some days were entered by hand',
        intro: 'This file has different sales for ' + conflicts.length + ' day' + (conflicts.length === 1 ? '' : 's')
             + ' you already entered by hand. Pick which figures to keep. Your own are kept unless you choose the file, and only the columns this file carries are changed.',
        rowLabel: 'Day', colMine: 'You entered', colTheirs: 'This file',
        rows: conflicts.map(c => ({ key: c.key, label: dayLabel(c.date), mineText: salesText(c.mine), theirsText: salesText(c.theirs) }))
      });
      if (!r.confirmed) { note('Import cancelled. Nothing was changed.'); return; }
      conflicts.forEach(c => { if (r.useTheirs.has(c.key)) { extra.push(c.useRec); usedTheirs++; } });
      /* ⚠ A CONFLICT DAY THE OPERATOR KEPT IS A DAY THE IMPORT DID NOT TOUCH, so its gap note reads
         as a second, separate event: "1 day kept as you entered it" AND "Food sales had no usable
         figure on 1 day, so that day kept the figures already saved" — both true, both about the
         same day, and together they sound like two things happened. The builder cannot know this;
         only the answer to the prompt decides it. A day resolved as USE THE FILE keeps its note,
         because there the unusable column really does stay at the prior figure and that is exactly
         what the operator needs to know about the choice they just made. */
      conflicts.forEach(c => { if (!r.useTheirs.has(c.key)) keptConflictDates.add(c.date); });
    }
    ['bar', 'food', 'covers'].forEach(k => {
      const list = ((colGaps || {}).kept || {})[k];
      if (list) colGaps.kept[k] = list.filter(d => !keptConflictDates.has(d));
    });
    buildCovNote();   // only now is the `kept` bucket final
    const keptMine = (conflicts ? conflicts.length : 0) - usedTheirs;   // hand days the operator kept at the prompt
    const kept = (keptManual || 0) + keptMine;                          // + hand days the file simply matched
    const allToAdd = toAdd.concat(extra);
    // ⚠ DECLARED OUT HERE, not inside the no-rows branch. The commit-FAILURE path needs it too, and
    // block-scoping it there is why a refused write reported the failure and silently dropped every
    // skipped row the same import had already found.
    // ⚠ "DAYS", not "rows" — `skipped` is keyed per DATE, after the file's rows have been
    // aggregated, so a daypart-split day that produced 4 rows is ONE entry here. And the date is no
    // longer part of this sentence; unreadable dates have their own list now.
    const skipNote = skipped.length ? ' (' + skipped.length + ' day' + (skipped.length === 1 ? '' : 's')
        + ' skipped, no usable sales figure)' : '';
    if (!allToAdd.length) {
      // ⚠ Say the TRUE reason (S105). Kept-by-hand and cleared days are real outcomes, not a broken
      // file — never blame the operator's own work. A dropped row is still surfaced. And if days
      // were CLEARED (deleted up in saveManualSales) but every typed day came through empty, report
      // the clear AND re-render — otherwise the delete is silent and the grid keeps showing them.
      if (opts.cleared) {
        this._flash = opts.cleared + ' day' + (opts.cleared === 1 ? '' : 's') + ' cleared to zero'
          + (kept ? ', ' + kept + ' day' + (kept === 1 ? '' : 's') + ' kept as entered' : '') + skipNote + undNote + zeroNote + covNote + coNote + sameNote + '.';
        this._openStep = 'cash'; this.render(this.container, this.actions); return;
      }
      // ⚠ "ALREADY MATCHED" IS A SUCCESS, NOT A BROKEN FILE. Re-dropping the same export is the
      // ordinary way to land here, and without this it fell through to the red "check that the file
      // has a Date column" — blaming a file that was read perfectly and agreed with every figure.
      if (kept || nSame) note('No new figures written.'
                     + (kept ? ' ' + kept + ' day' + (kept === 1 ? ' was' : 's were')
                               + ' kept as you entered ' + (kept === 1 ? 'it' : 'them') + ' by hand.' : '')
                     + (nSame ? ' ' + nSame + ' day' + (nSame === 1 ? '' : 's') + ' already matched what is saved.' : '')
                     + skipNote + undNote + zeroNote + covNote + coNote);
      /* ⚠ AN ABSOLUTE HEADLINE MUST EXCLUDE EVERY OTHER BUCKET, INCLUDING THE $0 ONE. Each of these
         branches used to check only the buckets it named, so a file carrying BOTH a readable $0 day
         and unreadable ones printed an absolute claim and then contradicted it one clause later:
         "No day in this file carried a sales figure Bar Cop could read. (3 days skipped) (1 day
         came in at $0 and was skipped)" — the $0 day's figure was read; it read zero. Same shape
         with dates: "could not read a date on any row" beside a $0 day that only exists because its
         date parsed. A claim about ALL days needs every other bucket empty, and the mixed case gets
         a plain headline that asserts nothing the notes then have to walk back.
         ⚠ AND THE MANUAL GRID GOES FIRST. Two of these branches say "in this file"/"your export";
         saveManualSales routes through here with no file at all (reachable: type 0.004 into Bar and
         it rounds to zero cents), and only the old generic branch had the opts.manual guard.
         ⚠ `zeroSkipped` GUARDED, like its twin above: a browser holding a CACHED older pos-ingest.js
         under a fresh sc-dashboard.js gets `undefined`, and the TypeError fires BEFORE fail() runs —
         so the import dies in complete silence, the one outcome every message here exists to prevent. */
      else {
        const nZero = (zeroSkipped || []).length;
        const mergeNote = merged ? ' (' + merged + ' extra row' + (merged === 1 ? '' : 's') + ' combined into day totals)' : '';
        const rest = skipNote + undNote + covNote + coNote + sameNote + mergeNote;
        const tail = zeroNote + rest;
        if (opts.manual) fail('No days saved. Enter sales for at least one day.' + tail);
        /* S189: the ONLY reason is $0 days — say that plainly and point to the sanctioned zeroing path.
           ⚠ THIS BRANCH GETS `rest`, NOT `tail`. Round 4 handed one shared tail to every headline, and
           this is the one headline whose own note adds nothing: the operator read "That day came in at
           $0, so nothing was imported. Use Enter Manually to record a zero day. (1 day came in at $0
           and was skipped — use Enter Manually to record a zero day)". The instruction twice, the fact
           twice, one line. The other headlines each GAIN a count from their note; this one already
           carries it. */
        else if (nZero && !skipped.length && !nUnd) fail((nZero === 1 ? 'That day' : 'Those ' + nZero + ' days')
                     + ' came in at $0, so nothing was imported. Use Enter Manually to record a zero day.' + rest);
        else if (nUnd && !skipped.length && !nZero) fail('No days imported. Bar Cop could not read a date on '
                     + (nUnd === 1 ? 'a row' : 'any row') + ' — check the date column in your export.' + tail);
        else if (skipped.length && !nUnd && !nZero) fail('No days imported. No day in this file carried a sales figure Bar Cop could read.' + tail);
        else {
          /* Mixed: assert nothing about ALL days, and name ONLY the columns that were actually a
             problem. A flat "Check that the file has a Date column and sales values" sent the
             operator at a sales column that read perfectly whenever the mix was undated rows plus a
             genuine $0 day — `skipped` is empty there, so no day lacked a figure. */
          // ⚠ EACH CLAUSE STANDS ALONE. "sales values it can read" borrowed its "it" from the Date
          // clause, so the combination that prints ONLY the second one ($0 days plus unreadable
          // figures, no undated rows) read "Check that the file has sales values it can read" with
          // nothing for "it" to refer to. Same antecedent trap as "That day" in _partialNote.
          const bits = [];
          if (nUnd) bits.push('a readable Date column');
          if (skipped.length) bits.push('readable sales values');
          fail('No days imported.' + (bits.length ? ' Check that the file has ' + bits.join(' and ') + '.' : '')
            // ⚠ BACKSTOP, NOT A LIVE PATH — and the earlier comment here wrongly called it reachable.
            // CSVMapper cannot emit zero rows (the CSV parser pops trailing blank rows and then
            // refuses anything under two rows; the XLSX path re-checks after filtering), and
            // saveManualSales guards on rows.length. Kept as one clause of insurance so a future
            // change upstream cannot produce a headline that is the entire message.
            + (tail || ' Bar Cop found no rows to read in this file.'));
        }
      }
      return;
    }
    /* ⚠ ONE OUTCOMES STRING, USED BY BOTH THE SUCCESS LINE AND THE FAILURE LINE. Say when rows were
       combined, replaced, chosen over a hand entry, or kept — folding any of those into a money
       figure silently is how the old drop-the-repeats bug stayed invisible (S105).
       The failure line used to hand-list a SUBSET of these, so a refused write dropped `merged`,
       `dupCount`, `usedTheirs` and `kept` — the operator staring at a red message was told nothing
       about their hand-closed Monday, and nothing about whether the "use the file" choice they had
       just made had taken effect (for the refused day it had not). The comment sitting above that
       line already stated the invariant it was breaking: a refused write is when they read hardest,
       so it must carry everything the success message would. The cash and server doors were already
       built this way (`cashOutcomes`, `serverOutcomes`); sales was the last one hand-listing.
       ⚠ KNOWN LIMIT, DOCUMENTED NOT FIXED. These clauses describe what the FILE held and what the
       import set out to do; `_partialNote` in front of them says how much of it actually landed. So
       on a refused write "(1 replaced earlier figures)" can name a day that did not make it. Making
       each clause landed-aware means recomputing all four against the written set on every door, and
       it buys nothing: the message LEADS with the landed count, the instruction ("run it again") is
       correct and complete either way, and re-running reconciles everything. All three doors read
       the same way on purpose — do not "fix" one of them alone. */
    const salesOutcomes =
        (merged ? ' (' + merged + ' extra row' + (merged === 1 ? '' : 's') + ' combined into day totals)' : '')
      + (dupCount ? ' (' + dupCount + ' replaced earlier figures)' : '')
      + (usedTheirs ? ' (' + usedTheirs + ' used the file over your hand entry)' : '')
      + (kept ? ' (' + kept + ' day' + (kept === 1 ? '' : 's') + ' kept as you entered ' + (kept === 1 ? 'it' : 'them') + ')' : '')
      + skipNote + undNote + zeroNote + covNote + coNote + sameNote;
    const ok = await PosIngest.commit('sales', allToAdd);
    if (!ok) {
      // ⚠ THE CLEAR ALREADY HAPPENED. saveManualSales deletes the zeroed days BEFORE calling here,
      // so a refused save leaves those days genuinely gone while this line said only "Save failed" —
      // which reads as "nothing happened" to someone whose Monday has just been removed.
      fail(App.partialSaveNote(App.landedOf(allToAdd, App.shiftData && App.shiftData.sc_shifts),
                             allToAdd.length, 'day', 'days')
        + (opts.cleared ? ' ' + opts.cleared + ' day' + (opts.cleared === 1 ? ' was' : 's were')
                          + ' already cleared to zero and stayed cleared.' : '')
        + salesOutcomes);
      return;
    }
    if (App.markSetupDone) App.markSetupDone('gs_sc_shift');
    this.setDone('import', true);   // a cockpit import is a deliberate "the week is in" action
    this._flash = allToAdd.length + ' day' + (allToAdd.length === 1 ? '' : 's') + ' ' + (opts.manual ? 'saved' : 'imported')
      + salesOutcomes
      + (opts.cleared ? ', ' + opts.cleared + ' cleared to zero' : '') + '.';
    this._openStep = 'cash';
    this.render(this.container, this.actions);
  },

  // ── Manual sales entry (step-1 "Enter Manually" toggle) ──────────────────────
  // Writes the same per-day sc_shifts records the drop file does (reuses
  // importSales for build/commit/advance), so Confirm the Week fills identically.
  _salesSeg() {
    const on = m => (this._salesMode === m || (m === 'import' && this._salesMode !== 'manual'));
    const btn = (m, label) => '<button type="button" class="btn btn-sm" data-salesmode="' + m + '" style="'
      + (on(m) ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;' : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    return '<div class="seg-toggle" style="margin-bottom:14px;">' + btn('import', 'Import File') + btn('manual', 'Enter Manually') + '</div>';
  },
  _weekDays() {
    const out = [], s = new Date(this.weekStart() + 'T00:00:00');
    for (let i = 0; i < 7; i++) {
      const d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i);
      out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
    }
    return out;
  },
  _manualSalesGrid() {
    const days = this._weekDays(), existing = {};
    this.shifts().filter(s => this.inWeek(s.date)).forEach(s => { existing[String(s.date).slice(0, 10)] = s; });
    const fmt = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
    const v = (s, f) => (s && s[f] != null && s[f] !== '') ? s[f] : '';
    const dollar = (id, val) => '<td style="background:#0D181E;"><div class="fw" style="margin:0;"><span class="pre">$</span><input class="form-input pre" type="number" step="0.01" min="0" id="' + id + '" value="' + val + '" style="width:100%;min-width:0;"/></div></td>';
    const plain = (id, val) => '<td style="background:#0D181E;"><input class="form-input" type="number" step="1" min="0" id="' + id + '" value="' + val + '" style="width:100%;min-width:0;"/></td>';
    const lbl = t => '<td style="font-weight:600;color:var(--t1);background:#0D181E;white-space:nowrap;">' + t + '</td>';
    const rows = days.map(d => { const s = existing[d];
      return '<tr class="cw-line">' + lbl(fmt(d)) + dollar('scm-bar-' + d, v(s, 'bar_revenue')) + dollar('scm-food-' + d, v(s, 'floor_revenue')) + plain('scm-cov-' + d, v(s, 'covers')) + '</tr>';
    }).join('');
    return '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">No POS export this week? Key it in by hand. Enter each day\'s bar and food sales, plus covers if you track them, then save. It lands exactly like the file drop and feeds Confirm the Week the same way.</div>'
      + '<div style="overflow-x:auto;"><table class="ing-tbl pill" style="table-layout:fixed;width:100%;">'
      + '<colgroup><col style="width:120px;"/><col/><col/><col style="width:90px;"/></colgroup>'
      + '<thead><tr><th>Day</th><th>Bar Sales</th><th>Food Sales</th><th>Covers</th></tr></thead><tbody>'
      + rows + '</tbody></table></div>';
  },
  async saveManualSales() {
    const has = x => x != null && String(x).trim() !== '';
    // App.parseNum is the ONE coercion; 0 is this caller's own default for "no number".
    const n = x => App.parseNum(x) ?? 0;
    const rows = [], zeroDays = [], badDays = [], coversOnly = [], unreadable = [];
    this._weekDays().forEach(d => {
      /* ⚠⚠ A NUMBER INPUT HIDES WHAT IT CANNOT PARSE, AND THAT NOW MATTERS. `<input type="number">`
         returns the EMPTY STRING from `.value` whenever its contents are not a valid floating-point
         number — while still SHOWING the operator exactly what they typed. A trailing decimal
         ("1200."), a thousands comma pasted in ("1,200.00"), a stray second dot: the cell looks
         filled and reads back blank.
         That was survivable while a blank meant "column not carried" (the prior figure was kept and
         nothing was destroyed). It is NOT survivable now that a blank means an explicit zero: a
         saved $1,200 Tuesday would be overwritten with $0, in place on its own id, and reported as
         "1 day saved". `validity.badInput` is the one thing that tells the two apart, so ask it.
         Refuse the whole save and name the day — the same treatment a negative gets. Guessing
         either way is wrong when we cannot read what is on their screen. */
      const el = id => document.getElementById(id) || {};
      const eBar = el('scm-bar-' + d), eFood = el('scm-food-' + d), eCov = el('scm-cov-' + d);
      const bad = e => !!(e.validity && e.validity.badInput);
      if (bad(eBar) || bad(eFood) || bad(eCov)) { unreadable.push(d); return; }
      const bar = eBar.value, food = eFood.value, cov = eCov.value;
      if (!(has(bar) || has(food) || has(cov))) return;   // day left untouched: leave it alone
      // Covers WITHOUT sales is an incomplete row, not an instruction. Only an explicit
      // zero in a SALES cell means "this day had none, clear it". Without this test a day
      // with covers typed and sales blank fell through to zeroDays and deleted the day.
      // ⚠ AND IT IS REPORTED. Dropping the row is right; dropping it in SILENCE is not — the
      // operator typed a number into that row, pressed Save, and every OTHER day saved, so the
      // screen said "4 days saved" and the covers they entered were simply gone. They cannot tell
      // that from a save that worked. Named in the result line, the same as every other drop.
      if (!(has(bar) || has(food))) { coversOnly.push(d); return; }
      // A day the operator explicitly zeroed is a CORRECTION, not an empty row. buildSales
      // drops a zero row and _commitSales only clears records for the dates it is
      // replacing, so a wrong $500 Monday on a day the bar was closed could never be taken
      // back down: the save reported success and the grid re-rendered the same $500, while
      // it kept feeding Where You Stand, the Hub and Revenue. Clear those days instead.
      // ⚠ A NEGATIVE IS NOT AN OPERATOR ZEROING THE DAY. `<= 0` treated one as an explicit zero and
      // DELETED that day's saved record, reporting "1 day cleared to zero" — and a negative bar
      // against a larger food figure netted positive and got STORED as -4,500, rendering
      // $-4,500.00. `min="0"` on the input does not stop it: a number input still hands back
      // "-4500" and nothing calls checkValidity. Only a genuine, non-negative zero clears a day.
      const b = n(bar), f = n(food);
      if (b < 0 || f < 0 || n(cov) < 0) { badDays.push(d); return; }
      if (b + f <= 0) { zeroDays.push(d); return; }
      /* ⚠ IN THE GRID A CLEARED CELL IS A ZERO, NOT AN ABSENT COLUMN. This handed the raw cell
         strings to buildSales, whose `carry` test reads a blank as "the FILE does not have this
         column" and therefore preserves the prior figure — the right answer for a POS export that
         only carries bar sales, and exactly the wrong one here. The grid always shows all three
         columns, pre-filled from the saved day, so an empty cell can only mean the operator emptied
         it. Deleting the Food figure and saving RESTORED the old food number, re-rendered it in the
         cell, and reported the save as successful: the one correction the operator cannot make is
         taking a number back down to nothing. (Typing 0 worked; deleting did not, which is a
         difference no one would ever guess.) Send the explicit zero the grid means. */
      rows.push({ date: d, bar: has(bar) ? bar : '0', food: has(food) ? food : '0', covers: has(cov) ? cov : '0' });
    });
    const res = document.getElementById('sc-ck-import-res');
    const fail = m => { if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">' + m + '</div>'; };
    // Name the day the way the GRID does ("Thu, Jul 23"), not as a raw ISO date. Anything standing
    // between the operator and a save has to point at a row they can actually see.
    const label = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
    // ⚠ DECLARED ABOVE EVERY EXIT, not just the one that used it. Sitting below the `badDays`
    // return meant a save refused for a negative could not even mention the covers-only day it was
    // also dropping — the label list did not exist yet at that point in the function.
    const coversOnlyLabels = coversOnly.map(label);
    const coTail = coversOnlyLabels.length
      ? ' ' + (coversOnlyLabels.length === 1 ? 'One day' : coversOnlyLabels.length + ' days')
        + ' with covers but no sales ' + (coversOnlyLabels.length === 1 ? 'was' : 'were')
        + ' also not saved: ' + coversOnlyLabels.join(', ') + '.'
      : '';
    // Refuse the whole save when a cell cannot be READ. This is not the same as a blank cell and
    // must never be treated as one — see the badInput note above.
    if (unreadable.length) {
      fail('Bar Cop could not read what is typed in ' + unreadable.map(label).join(', ')
        + '. Check those cells for a stray comma or a trailing decimal point, then save again.' + coTail);
      return;
    }
    // Refuse the whole save on a negative rather than part-saving around it — a day silently left
    // out is the thing that makes the week's total wrong without anything on screen saying so.
    if (badDays.length) {
      fail('Sales and covers cannot be negative. Check ' + badDays.map(label).join(', ') + ' and save again.' + coTail);
      return;
    }
    if (!rows.length && !zeroDays.length) {
      // ⚠ NOT "enter at least one day's sales" when they DID enter something. A covers-only row is
      // the one case where the operator typed a number, pressed Save and got told they had typed
      // nothing — so name the day and say what it needs.
      // ⚠ NAME THE ACTION THAT ACTUALLY WORKS. This used to end "or clear the covers to leave the
      // row empty" — and on a day that already HAS a saved record, clearing the covers makes all
      // three cells blank, which is the untouched-day return two screens up, so the old figure
      // stands and the next Save says "Enter at least one day's sales". The only input that takes a
      // day down to nothing is an explicit 0 in the sales cells, and that is what has to be said.
      fail(coversOnly.length
        ? 'Nothing saved. ' + (coversOnly.length === 1 ? 'That day has' : 'Those days have')
          + ' covers but no sales. Enter bar or food sales for ' + coversOnlyLabels.join(', ')
          + ' — or 0 in both sales cells if the bar was closed. Clearing the covers instead leaves'
          + ' whatever is already saved for that day exactly as it is.'
        : 'Enter at least one day\'s sales before saving.');
      return;
    }

    /* ⚠ COUNT DAYS, NOT RECORDS. `cleared++` sat inside the per-RECORD loop, and a date can
       legitimately hold more than one sc_shifts row — _commitSales deliberately leaves a superseded
       row in place when its retirement delete is refused (S102). So clearing ONE such day reported
       "2 days cleared to zero", and the failure message could say "2 of 2 were cleared" while
       refusing. Every number the operator reads here is a DAY, so count days.
       `attempted` counts only days that actually had something to remove — a zeroed day with no
       saved record is not a failure, it is a no-op, and folding it into the denominator would
       under-report success. */
    let cleared = 0, attempted = 0, broke = false;
    for (const d of zeroDays) {
      // The operator is IN the grid explicitly zeroing this day, so clear whatever record held it,
      // WHATEVER its source (S140) — a hand entry is now source:'manual', imported:false, and the
      // old `imported === true` filter would leave their own prior figure standing and re-render it.
      // This IS the operator's own edit door, so clearing their prior figure for the day is the point.
      const stale = ((App.shiftData && App.shiftData.sc_shifts) || []).filter(s => s && s.date === d);
      if (!stale.length) continue;
      attempted++;
      let dayOk = true;
      for (const s of stale) { if (!(await App.removeRecord('sc', 'shift', s.id))) { dayOk = false; broke = true; } }
      if (dayOk) cleared++;
    }
    // ⚠ SAY WHAT ALREADY LANDED. The days above are deleted one at a time, so a refusal partway
    // through leaves some ALREADY CLEARED — and "Could not clear a day. Try the save again." reads
    // as "nothing happened" over a week that has already lost a record.
    if (broke) {
      fail('Could not clear ' + (cleared
            ? 'every day — ' + cleared + ' of ' + attempted + ' were cleared before the save was refused. Try the save again to finish.'
            // ...and say how many were being cleared, rather than "the day" over a batch of three.
            : (attempted === 1 ? 'the day' : 'those ' + attempted + ' days') + '. Try the save again.') + coTail);
      return;
    }
    if (rows.length) { await this.importSales(rows, { manual: true, cleared: cleared, coversOnly: coversOnlyLabels }); return; }

    // Zeroed days only: nothing left to write, so report the clear from here.
    const co = coversOnlyLabels.length
      ? ' ' + coversOnlyLabels.length + ' day' + (coversOnlyLabels.length === 1 ? '' : 's')
        + ' had covers but no sales and ' + (coversOnlyLabels.length === 1 ? 'was' : 'were')
        + ' not saved: ' + coversOnlyLabels.join(', ') + '.'
      : '';
    this._flash = (cleared
      ? cleared + ' day' + (cleared === 1 ? '' : 's') + ' cleared to zero.'
      : 'Those days were already empty.') + co;
    this._openStep = 'cash';
    this.render(this.container, this.actions);
  },

  // ── Inline per-server sales import (step 1 optional) ─────────────────────────
  // Feeds Server Check + Sales Integrity off the same weekly sitting. Matches each
  // server to the roster by name; unmatched rows are skipped and surfaced.
  mountServer() {
    const el = document.getElementById('sc-ck-server');
    if (!el || typeof CSVMapper === 'undefined' || typeof PosIngest === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your POS per-server sales report here',
      dropSub: 'Needs a Server, Date, Covers, and Total Sales column. One row per server, per day.',
      fields: PosIngest.FIELDS.server,
      confirmLabel: 'Import',
      onState: st => { this._toggleBtns('sc-ck-import-btns', st); this._toggleOptLink('server', st); },
      onComplete: rows => this.importServer(rows)
    });
  },
  async importServer(rows) {
    // `incomplete` (on the roster, rang no covers/sales) is split out of `skipped` (name
    // not matched) by buildServer. Destructure BOTH or those rows vanish with no mention:
    // they used to be counted in the skipped total. Server Check's door reports both.
    /* ⚠⚠ AND `conflicts` / `replaced` JOIN THE LIST FOR THE SAME REASON (S215f, 2026-07-27). When
       buildServer stopped keying on the figures, a row that DISAGREES with a hand-entered check
       became a conflict instead of a silent second record. A door that does not destructure it
       drops that row on the floor: not in `toAdd`, not in any count, no message — which is worse
       than the double-count it replaced. This is the same lesson the comment above records about
       `incomplete`, one field later. */
    const { toAdd, skipped, incomplete, undated, dupCount, replaced, conflicts, fileRepeats } = PosIngest.build('server', rows);
    const res = document.getElementById('sc-ck-server-res');
    const inc = (incomplete || []).length, und = (undated || []).length;
    /* Everything this import found besides the rows it wrote. Built ONCE and appended to every
       outcome — the zero-row message, the failure message and the success flash — because a refused
       write is exactly when the operator reads hardest, and the failure path used to replace all of
       this with a bare "Save failed". The twin door renders its notes under a failed headline, so
       the two were telling different stories about the same file.
       ⚠ A ROW WITH NO NAME TO PRINT IS NOT "a name not matched". buildServer pushes '(blank)' for a
       row whose Server cell is empty — a subtotal or section line, which CSVMapper keeps because not
       every cell is empty — and calling that "1 name not matched" sends the operator hunting for a
       roster spelling that does not exist. Counted separately, the way both revenue doors do it. */
    const nameless = (skipped || []).filter(s => !s || s === '(blank)').length;
    const named = skipped.length - nameless;
    let serverOutcomes = (named ? ' (' + named + ' name' + (named === 1 ? '' : 's') + ' not matched)' : '')
      + (nameless ? ' (' + nameless + ' row' + (nameless === 1 ? '' : 's') + ' had no server name)' : '')
      + (inc ? ' (' + inc + ' row' + (inc === 1 ? '' : 's') + ' rang no covers or sales)' : '')
      + (und ? ' (' + und + ' row' + (und === 1 ? '' : 's') + ' had no readable date)' : '')
      // Same collapse as the twin door, reported the same way. Silence here would leave the
      // operator's row count and Bar Cop's disagreeing with no explanation.
      + ((fileRepeats || 0) ? ' (' + fileRepeats + ' repeated line' + (fileRepeats === 1 ? '' : 's') + ' counted once)' : '');
    /* The file disagrees with checks the operator entered BY HAND. Ask before writing anything
       ([[user-chooses-conflicts]]) — the same prompt this screen already uses for sales and cash,
       so the three import lanes behave identically. ⚠ This runs ABOVE the zero-row branch: a file
       whose every row is a conflict has an EMPTY toAdd, and falling into "no server rows imported.
       Each row needs a server name…" would blame the file for rows Bar Cop understood perfectly. */
    const serverExtra = [];
    if (conflicts && conflicts.length) {
      const figs = v => v.covers + (v.covers === 1 ? ' cover' : ' covers') + ' · $'
        + (Math.round((v.sales || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const rowLabel = c => { const dt = new Date(c.date + 'T00:00:00');
        return c.name + ' · ' + (isNaN(dt.getTime()) ? c.date : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))
          + (c.shift ? ' · ' + c.shift : ''); };
      const r = await App.promptImportConflicts({
        title: 'Some checks were entered by hand',
        intro: 'This file has different figures for ' + conflicts.length + ' check'
             + (conflicts.length === 1 ? '' : 's') + ' you already entered or corrected by hand. Pick which to keep. Your own are kept unless you choose the file.',
        rowLabel: 'Check', colMine: 'You entered', colTheirs: 'This file',
        rows: conflicts.map(c => ({ key: c.key, label: rowLabel(c), mineText: figs(c.mine), theirsText: figs(c.theirs) }))
      });
      if (!r.confirmed) { if (res) res.innerHTML = '<div style="font-size:13px;color:var(--t2);margin-top:12px;">Import cancelled. Nothing was changed.</div>'; return; }
      conflicts.forEach(c => { if (r.useTheirs.has(c.key)) serverExtra.push(c.useRec); });
    }
    const keptByHand = (conflicts ? conflicts.length : 0) - serverExtra.length;
    // Both outcomes are REPORTED, on every branch below, because `serverOutcomes` is appended to
    // the zero-row message, the failure message and the success flash alike. A row we overwrote and
    // a row the operator chose to keep are things that happened to their data; neither is "already
    // logged", and neither may be silent.
    serverOutcomes += ((replaced || 0) ? ' (' + replaced + ' earlier import' + (replaced === 1 ? '' : 's') + ' updated)' : '')
      + (keptByHand ? ' (' + keptByHand + ' kept as you entered ' + (keptByHand === 1 ? 'it' : 'them') + ')' : '');
    serverExtra.forEach(rec => toAdd.push(rec));
    if (!toAdd.length) {
      /* ⚠ THE BREAKDOWN WAS ONLY REACHABLE WHEN SOMETHING IMPORTED. `undated` and `incomplete` were
         rendered on the success flash alone, so the case where they matter MOST — nothing came in at
         all — printed one generic line naming four requirements. A per-server export dated "Jul 24"
         (no year) on every row told the operator to check the server names, the covers and the sales
         and never mentioned the date; a file where everyone rang zero sent them to the Staff Roster
         to add people already on it. _commitCash already reports its skips on this path, so this was
         an asymmetry rather than a decision. */
      /* ⚠ A HEADLINE PER COMBINATION, not per single bucket. Each branch below used to demand that
         the OTHER two lists be empty, so a file with some undated rows AND some that rang nothing
         fell straight through to "Each row needs a server name Bar Cop can match" — with the notes
         under it naming only dates and covers, and no unmatched-name note at all. And "All N rows
         were already logged" was claimed whenever dupCount was non-zero, even with rows dropped for
         other reasons alongside it. Only ever say "All" when nothing else was dropped. */
      /* ⚠ Step 0.5, and the twin needed BOTH halves of the same fix (2026-07-27). `otherDrops` knew
         nothing about a repeated line counted once or a conflict kept by hand, so this door would
         have printed "All N rows were already logged" over a file where a 9th row was collapsed —
         the very "All" claim the comment above exists to prevent. And "the rest could not be used"
         is false of a repeat, which WAS used. Rows that could not be USED and rows handled some
         other way are separate counts now, exactly as at the twin. */
      const otherDrops = skipped.length + inc + und;
      const otherHandled = (fileRepeats || 0) + (keptByHand || 0);
      // ⚠ RED IS FOR A PROBLEM. Re-dropping the same report is a NORMAL thing to do and nothing is
      // wrong with the file, but this block was hard-coded red, so "All 12 rows were already logged"
      // read as a failure. The twin door (r-server-check) renders the identical outcome neutral and
      // _doImportSales treats its equivalent as a success. Only colour it red when something is
      // actually wrong. (Round 2 rewrote this very expression and left the colour behind it.)
      // Benign (neutral, not red) whenever nothing was actually WRONG with the file — a repeat
      // collapsed or a hand entry kept is not a problem, but it does stop the word "All".
      const benign = dupCount && !otherDrops;
      if (res) res.innerHTML = '<div style="font-size:13px;color:var(--' + (benign ? 't2' : 'red') + ');margin-top:12px;">'
        + (benign && !otherHandled ? 'No new server rows imported. All ' + dupCount + ' row' + (dupCount === 1 ? ' was' : 's were') + ' already logged.'
         : (dupCount && !otherDrops) ? 'No new server rows imported. ' + dupCount + ' row' + (dupCount === 1 ? ' was' : 's were') + ' already logged.'
         : dupCount ? 'No new server rows imported. ' + dupCount + ' row' + (dupCount === 1 ? ' was' : 's were') + ' already logged, ' + otherDrops + ' could not be used.'
         : (und && !skipped.length && !inc) ? 'No server rows imported. Bar Cop could not read a date on any row — check the date column in your export.'
         : (inc && !skipped.length && !und) ? 'No server rows imported. Every name matched your roster, but no row had both covers and sales.'
         : (!skipped.length && (und || inc)) ? 'No server rows imported. Every name matched your roster — see below for what stopped each row.'
         : 'No server rows imported. Each row needs a server name Bar Cop can match, a date, covers, and sales.')
        + serverOutcomes
        + '</div>';
      return;
    }
    const ok = await PosIngest.commit('server', toAdd);
    if (!ok) {
      /* ⚠ SAY HOW MANY ACTUALLY LANDED. PosIngest.commit's generic path writes ROW BY ROW and
         accumulates ONE boolean, and it does not stop at the first refusal — so a single rejected
         row in the middle of a twelve-row file reported the WHOLE import as failed while eleven
         checks were saved. "Save failed" reads as "nothing was imported", and the operator's next
         move is to key those checks in by hand, which is how the server ends up holding each one
         twice. (_commitSales and _commitCashRows both track what landed; the generic path never did.)
         App.putRecord REVERTS the array slot on a genuine refusal — for a fresh id that is a splice
         straight back out — so what is STILL IN MEMORY is exactly what landed. Re-running the import
         is safe either way: buildServer dedupes on staff + date + SHIFT, so the rows that did save
         come back as "already logged" rather than doubling. (The key stopped including the figures
         on 2026-07-27 — with them in it, a hand-corrected row no longer matched its own file.) */
      if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + App.partialSaveNote(App.landedOf(toAdd, App.data && App.data.revenue_server_checks),
                            toAdd.length, 'server check', 'server checks')
        + serverOutcomes   // the failure does not cancel what else the import found
        + '</div>';
      return;
    }
    // Step 0.5: same split as the twin. A row the operator handed to the file at the conflict
    // prompt REPLACED an existing check — it is not a new import, and merging the two hides the
    // decision they just made.
    const freshCount = toAdd.length - serverExtra.length;
    this._flash = (freshCount ? freshCount + ' server check' + (freshCount === 1 ? '' : 's') + ' imported' : '')
      + (serverExtra.length ? (freshCount ? ', ' : '') + serverExtra.length + ' replaced with the file'
                              + String.fromCharCode(8217) + 's figures' : '')
      + (dupCount ? ' (' + dupCount + ' already logged)' : '')
      + serverOutcomes + '.';
    if (this._optOpen) this._optOpen.server = false;   // collapse back to the link
    this._openStep = 'import';
    this.render(this.container, this.actions);
  },

  // ── Inline product-mix (PMIX) import (step 1 optional) ───────────────────────
  // Feeds Menu Engineering covers. Matches each item to the menu by name and
  // updates weekly_covers in place; unmatched item names are skipped and surfaced.
  mountPmix() {
    const el = document.getElementById('sc-ck-pmix');
    if (!el || typeof CSVMapper === 'undefined' || typeof PosIngest === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your POS product-mix (PMIX) report here',
      dropSub: 'Needs an Item Name and Units Sold column. One row per menu item for the week.',
      fields: PosIngest.FIELDS.pmix,
      confirmLabel: 'Import',
      onState: st => { this._toggleBtns('sc-ck-import-btns', st); this._toggleOptLink('pmix', st); },
      onComplete: rows => this.importPmix(rows)
    });
  },
  async importPmix(rows) {
    const { toAdd, skipped, incomplete, netNegative, merged } = PosIngest.build('pmix', rows);
    const res = document.getElementById('sc-ck-pmix-res');
    if (!toAdd.length) {
      /* ⚠ THE ZERO-ROW PATH DROPPED ALL THREE LISTS AND THEN GUESSED WRONG. It said "Each row needs
         an item name Bar Cop can match on your menu and a units-sold number" whatever had happened,
         so a PMIX whose items ALL netted negative after returns — names matched, units present —
         sent the operator off to rename a menu that was already right, and the real outcome (every
         item left at last week's figure, which this cockpit then presents as this week's mix) was
         never mentioned at all. Same rule as the success path below: three outcomes, three
         sentences. Anything involving a genuinely unmatched name still gets the name message. */
      const nSkip = skipped.length, nInc = (incomplete || []).length, nNeg = (netNegative || []).length;
      if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">No items updated.'
        + (!nSkip && nInc && !nNeg ? ' The item names matched, but Bar Cop could not read a units-sold figure for any of them.'
         : !nSkip && nNeg && !nInc ? ' Every item came out at negative units after returns, so the previous figures were left alone.'
         // ⚠ NOT "no row carried a usable units figure" — a net-negative item DID carry one; it went
         // negative after returns. That sentence denied what the note printed under it stated.
         : !nSkip && (nInc || nNeg) ? ' The item names matched — see below for what happened to each row.'
         : ' Each row needs an item name Bar Cop can match on your menu and a units-sold number.')
        + (nSkip ? ' (' + nSkip + ' name' + (nSkip === 1 ? '' : 's') + ' not matched)' : '')
        + (nInc ? ' (' + nInc + ' row' + (nInc === 1 ? '' : 's') + ' had no readable units figure)' : '')
        + (nNeg ? ' (' + nNeg + ' item' + (nNeg === 1 ? '' : 's') + ' came out at negative units after returns)' : '')
        + '</div>';
      return;
    }
    const ok = await PosIngest.commit('pmix', toAdd);
    if (!ok) { if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">Save failed. Try the import again.</div>'; return; }
    // Say when rows were combined. A daypart-split export legitimately lists an item several
    // times and we sum them, so the operator should see why the total is bigger than any one row.
    // ⚠ THREE DIFFERENT OUTCOMES, THREE DIFFERENT SENTENCES. This used to report one `skipped`
    // list as "N names not matched", which sent the operator to rename a menu item that was
    // already correct when the real problem was an unreadable Units cell — and an item whose
    // units netted negative was dropped with NO mention at all, so it silently kept last week's
    // figure and presented it as this week's mix.
    const inc = incomplete || [], neg = netNegative || [];
    this._flash = toAdd.length + ' menu item' + (toAdd.length === 1 ? '' : 's') + ' updated from sales mix'
      + (merged ? ' (' + merged + ' extra row' + (merged === 1 ? '' : 's') + ' combined into item totals)' : '')
      + (skipped.length ? ' (' + skipped.length + ' name' + (skipped.length === 1 ? '' : 's') + ' not matched)' : '')
      + (inc.length ? ' (' + inc.length + ' row' + (inc.length === 1 ? '' : 's') + ' had no readable units figure)' : '')
      + (neg.length ? ' (' + neg.length + ' item' + (neg.length === 1 ? '' : 's')
          + ' came out at negative units after returns and ' + (neg.length === 1 ? 'was' : 'were')
          + ' left at the previous figure)' : '') + '.';
    if (this._optOpen) this._optOpen.pmix = false;   // collapse back to the link
    this._openStep = 'import';
    this.render(this.container, this.actions);
  },

  // ── Inline cash-report import (step 2) ───────────────────────────────────────
  // The POS blind close already computed over/short; drop that report and the
  // variance pattern lands without a hand reconcile. Manual reconcile lives on
  // Cash Control as the fallback.
  mountCashImport() {
    const el = document.getElementById('sc-ck-cash');
    if (!el || typeof CSVMapper === 'undefined' || typeof PosIngest === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your POS cash or drawer report here',
      dropSub: 'Needs a Date column plus Over/Short, or Expected and Counted cash. Register and cashier matched if present.',
      fields: PosIngest.FIELDS.cash,
      confirmLabel: 'Import',
      onState: st => this._toggleBtns('sc-ck-cash-btns', st),
      onComplete: rows => this.importCash(rows)
    });
  },
  // The cash report names its own registers. Match them to the operator's
  // registers (by name or a saved alias). Unknown names get resolved once: on a
  // blank slate they auto-create; if registers already exist, a one-time map-or-add
  // prompt links each to an existing register or adds it new (remembered as an
  // alias), so we never make duplicate registers and never ask twice.
  async importCash(rows) {
    // ⚠ Re-entry guard, the twin of _applyCashMap's (S146). The CSVMapper Import button (.csvm-go)
    // is not disabled after it fires onComplete, so a double-click re-enters here. Without the guard
    // the second call runs while the first is still awaiting the register save: on a zero-register
    // bar the first click creates the registers synchronously, so the second skips the blank-slate
    // branch and commits variance rows against those ids — then the first click's refused save rolls
    // the registers back, orphaning the reconciles this branch's own comment says it exists to
    // prevent (and flashing a false "nothing was imported"). Held through _commitCash (return await)
    // so a click during the conflict prompt or the write can't double-commit the day either.
    if (this._importingCash) return;
    this._importingCash = true;
    try {
      /* ⚠ CLEAR ANY MAPPING PANEL LEFT OVER FROM A PREVIOUS FILE. Nothing else retires it, and now
         that a refused save deliberately LEAVES it standing, an abandoned panel outlives the file
         it belongs to: drop file A (unknown registers), walk away from the prompt, drop file B whose
         registers all match, and file B's result prints inside file A's panel — under a live "Match
         and Import" button that would commit file B's rows (`_pendingCashRows` is overwritten one
         line down) against file A's mappings. The panel is re-rendered below whenever it is still
         wanted, so clearing it here costs nothing. */
      const cashRes = document.getElementById('sc-ck-cash-res');
      if (cashRes && cashRes.innerHTML.indexOf('sc-cm-sel') !== -1) cashRes.innerHTML = '';
      this._pendingCashRows = rows;
      // ⚠ EVERY register, archived ones included (S104). Matching only active registers made an
      // ARCHIVED register's own name count as unmatched, so the mapping prompt fired for a register
      // the bar already has — and the dropdown did not offer it, so the only way out was minting a
      // duplicate name with a fresh id. This also keeps the blank-slate test below honest: a bar
      // whose only register is archived is not a blank slate.
      const drawers = ((App.shiftData && App.shiftData.sc_drawers) || []).filter(Boolean);
      const key = s => String(s || '').trim().toLowerCase();
      const known = new Set();
      drawers.forEach(d => { if (d.name) known.add(key(d.name)); (d.pos_aliases || []).forEach(a => known.add(key(a))); });
      // ⚠ DEDUP CASE-INSENSITIVELY (S143). The Set was on the trimmed-but-not-lowercased name while
      // `known` and buildCash's drawerByName both lower-case, so "Main Bar" and "MAIN BAR" survived as
      // TWO unmatched names — the map prompt offered the register twice, minting both put every row on
      // the second (orphaning the first) and silently discarded an explicit mapping. Collapse by the
      // lower-cased key, keeping the first display spelling.
      const seenKeys = new Set();
      const unmatched = [];
      (rows || []).forEach(r => {
        const raw = String(r.drawer || '').trim();
        if (!raw) return;
        const k = key(raw);
        if (known.has(k) || seenKeys.has(k)) return;
        seenKeys.add(k);
        unmatched.push(raw);
      });

      if (unmatched.length && drawers.length === 0) {        // blank slate: create silently
        const created = unmatched.map(n => this._addRegister(n));
        // Stop if the registers didn't persist: _commitCash below mints variance rows stamped with
        // these drawer_ids, and the registers are stripped from the blob — so on reload every
        // imported reconcile would point at a register that no longer exists.
        if (!(await App.putRecordsBulk('sc', 'drawer', created))) {   // row-per-record
          created.forEach(d => { const i = App.shiftData.sc_drawers.indexOf(d); if (i >= 0) App.shiftData.sc_drawers.splice(i, 1); });
          return await App.confirm({
            title: 'Could not save your registers',
            message: 'Nothing was imported, so your data is unchanged. Check your connection and run the import again.',
            confirmText: 'OK', cancelText: '', danger: false
          });
        }
        return await this._commitCash(rows);
      }
      if (unmatched.length) { this._showCashMap(unmatched); return; }   // map or add
      return await this._commitCash(rows);
    } finally {
      this._importingCash = false;
    }
  },
  _addRegister(name) {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_drawers)) App.shiftData.sc_drawers = [];
    const rec = { id: App.uid(), name: name, default_opening_bank: null, notes: '', active: true, pos_aliases: [], created_at: new Date().toISOString() };
    App.shiftData.sc_drawers.push(rec);
    return rec;   // caller persists it (putRecord/putRecordsBulk) — row-per-record
  },
  _showCashMap(unmatched) {
    const res = document.getElementById('sc-ck-cash-res');
    if (!res) return;
    // ⚠ EVERY register, archived ones LABELLED (S104). An archived register was unreachable here,
    // so a POS name that belonged to one could only be mapped to the wrong register or added as a
    // duplicate — orphaning every prior reconcile keyed to the original id.
    const drawers = ((App.shiftData && App.shiftData.sc_drawers) || []).filter(Boolean);
    const opts = drawers.map(d => '<option value="' + esc(d.id) + '">' + esc(d.name)
      + (d.active === false ? ' (archived)' : '') + '</option>').join('');
    const rows = unmatched.map(n =>
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:7px 0;">'
      + '<span style="font-size:13px;font-weight:700;color:var(--t1);min-width:130px;">' + esc(n) + '</span>'
      + '<span style="color:var(--t3);font-size:12px;">&rarr;</span>'
      + '<select class="sc-cm-sel" data-name="' + esc(n) + '" style="height:34px;min-width:200px;">'
      +   '<option value="__add">Add as a new register</option>' + opts
      + '</select></div>').join('');
    res.innerHTML = '<div style="margin-top:14px;border:1px solid var(--b-edge);border-radius:var(--r);background:var(--bg);padding:14px 16px;">'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:10px;">Your report has registers Bar Cop does not recognize. Match each to one of yours, or add it new. Bar Cop remembers your choice.</div>'
      + rows
      + '<div style="margin-top:12px;"><button class="btn btn-primary btn-sm" id="sc-cm-go">Match and Import</button></div>'
      // ⚠ A dedicated error slot so a refused save shows its message WITHOUT clobbering the selects
      // above it (S150) — those live in this same #sc-ck-cash-res, so writing the error there forced
      // a full CSV re-drop to retry. Writing #sc-cm-err leaves the operator's mappings intact.
      + '<div id="sc-cm-err" aria-live="polite"></div>'
      + '</div>';
    document.getElementById('sc-cm-go')?.addEventListener('click', () => this._applyCashMap());
  },
  async _applyCashMap() {
    // ⚠ A double-click on Match and Import used to run this twice off the still-live selects,
    // minting an "__add" register TWICE and letting the second _commitCash flash a false
    // "(1 replaced earlier figures)" (S146). A re-entry flag holds the second call; the button is
    // disabled for the duration too. Both are released in the finally, so a refused save can retry.
    if (this._applyingCashMap) return;
    this._applyingCashMap = true;
    const goBtn = document.getElementById('sc-cm-go');
    if (goBtn) goBtn.disabled = true;
    try {
      const keyOf = s => String(s || '').trim().toLowerCase();
      // Dedupe by id: one existing drawer can be the target of several unmatched names, so it
      // would otherwise appear multiple times in one bulk upsert (Postgres rejects a duplicate
      // id in a single ON CONFLICT chunk). The Map keeps the last-mutated copy (all aliases added).
      const touched = new Map();
      const created = [];   // brand-new registers, appended to sc_drawers by _addRegister
      const undo = [];      // existing registers, snapshotted before their aliases are appended
      [...document.querySelectorAll('.sc-cm-sel')].forEach(sel => {
        const name = sel.dataset.name;
        if (sel.value === '__add') {
          // ⚠ IDEMPOTENT ON RETRY, and this only became reachable when _commitCash stopped
          // clobbering this panel. A refused over/short save now leaves the selects standing so the
          // operator can press Match and Import again — and this line used to mint a SECOND register
          // with the same name on every press, because the registers from the FIRST attempt had
          // already persisted successfully (only the variance rows failed). The bar then had two
          // "Main Bar" registers, and buildCash's name index resolves a name to exactly one of them,
          // so that register's history split across two ids. If the name is already on the list it
          // IS the previous attempt's register: reuse it instead of adding another.
          const already = ((App.shiftData && App.shiftData.sc_drawers) || []).find(x => x && keyOf(x.name) === keyOf(name));
          // ⚠ SNAPSHOT IT ANYWAY. Nothing is mutated on THIS select, but `touched` is now set for
          // that id — so a LATER select mapping a second POS name onto the same register hits
          // `if (!touched.has(d.id))` below, skips its snapshot, and appends an alias that the
          // rollback cannot put back. One line here closes it; App.restoreRows is a no-op for an
          // unchanged row, so snapshotting a register we did not touch costs nothing.
          if (already) { if (!touched.has(already.id)) undo.push(...App.snapshotRows([already])); touched.set(already.id, already); return; }
          const r = this._addRegister(name); created.push(r); touched.set(r.id, r); return;
        }
        const d = ((App.shiftData && App.shiftData.sc_drawers) || []).find(x => x.id === sel.value);
        if (d) {
          if (!touched.has(d.id)) undo.push(...App.snapshotRows([d]));   // once, before the first alias lands
          if (!Array.isArray(d.pos_aliases)) d.pos_aliases = []; if (!d.pos_aliases.some(a => keyOf(a) === keyOf(name))) d.pos_aliases.push(name); touched.set(d.id, d);
        }
      });
      // Same reasoning as the blank-slate branch above: _commitCash mints variance rows stamped with
      // these drawer_ids, so if the registers did not persist those reconciles would point at
      // registers that vanish on reload. Put memory back and stop rather than commit against them.
      if (!(await App.putRecordsBulk('sc', 'drawer', [...touched.values()]))) {   // row-per-record
        App.restoreRows(undo);
        App.dropRows((App.shiftData && App.shiftData.sc_drawers) || [], created);
        // ⚠ The error goes in its OWN slot, NOT #sc-ck-cash-res — that element holds the .sc-cm-sel
        // selects and this button, so clobbering it would force a full CSV re-drop to retry (S150).
        const msg = '<div style="font-size:13px;color:var(--red);margin-top:12px;">Could not save the register setup, so the cash counts were not imported. Try again.</div>';
        const err = document.getElementById('sc-cm-err');
        if (err) err.innerHTML = msg;
        else { const res = document.getElementById('sc-ck-cash-res'); if (res) res.innerHTML = msg; }
        return;
      }
      return await this._commitCash(this._pendingCashRows);
    } finally {
      this._applyingCashMap = false;
      const b = document.getElementById('sc-cm-go');
      if (b) b.disabled = false;
    }
  },
  async _commitCash(rows) {
    const built = PosIngest.build('cash', rows);
    const { toAdd, skipped, undated, dupCount, keptManual, conflicts, extraDropped, totalsLines, fileRepeats } = built;
    // ⚠ THE MESSAGE GOES IN THE DEDICATED SLOT WHENEVER THE REGISTER-MAPPING PANEL IS UP — this is
    // the other half of S150 and it was left undone. _showCashMap renders its .sc-cm-sel selects and
    // its Match and Import button INTO #sc-ck-cash-res, and _applyCashMap calls straight through to
    // here, so every fail/note below was DESTROYING the operator's own register mappings to print an
    // error at them. The only way to retry was to re-drop the CSV and map every register again — on
    // a refused save, which is exactly when a retry is the thing they need. _applyCashMap built
    // #sc-cm-err for precisely this and _commitCash never used it. The slot only exists while the
    // panel is up, so the ordinary import path still resolves to #sc-ck-cash-res unchanged.
    const slot = () => document.getElementById('sc-cm-err') || document.getElementById('sc-ck-cash-res');
    const fail = m => { const el = slot(); if (el) el.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">' + m + '</div>'; };
    const note = m => { const el = slot(); if (el) el.innerHTML = '<div style="font-size:13px;color:var(--t2);margin-top:12px;">' + m + '</div>'; };
    // A conflict: the file disagrees with a drawer the operator counted BY HAND. Ask which wins
    // before writing ([[user-chooses-conflicts]]) — Bar Cop never picks between two figures the
    // operator entered themselves. A file that MATCHES the hand count is kept silently (keptManual).
    const extra = []; let usedTheirs = 0;
    if (conflicts && conflicts.length) {
      const money = v => v == null ? '—' : '$' + (Math.round(v * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const dayLabel = d => { const dt = new Date(d + 'T00:00:00'); return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
      const cashText = v => {
        const os = v.variance;
        const tag = os == null ? '' : (os < 0 ? ' short' : os > 0 ? ' over' : ' even');
        return (os == null ? '—' : money(Math.abs(os)) + tag)
             + (v.expected_cash != null && v.counted_cash != null ? ' (exp ' + money(v.expected_cash) + ' / count ' + money(v.counted_cash) + ')' : '');
      };
      const r = await App.promptImportConflicts({
        title: 'Some drawers were counted by hand',
        intro: 'This file has a different over/short for ' + conflicts.length + ' register-day' + (conflicts.length === 1 ? '' : 's')
             + ' you already counted by hand. Pick which to keep. Your own count is kept unless you choose the file.',
        rowLabel: 'Register / day', colMine: 'You counted', colTheirs: 'This file',
        rows: conflicts.map(c => ({ key: c.key, label: (c.drawer || 'Register') + ' · ' + dayLabel(c.date), mineText: cashText(c.mine), theirsText: cashText(c.theirs) }))
      });
      // ⚠ NOT "nothing was changed" — importCash may have already created/persisted registers (the
      // blank-slate auto-create, or an add/alias the operator picked in the map step) BEFORE this
      // prompt. Those are the operator's own deliberate setup and are kept; only the over/short
      // figures are cancelled. Say exactly that.
      if (!r.confirmed) { note('Import cancelled. No over/short figures were imported.'); return; }
      conflicts.forEach(c => { if (r.useTheirs.has(c.key)) { extra.push(c.useRec); usedTheirs++; } });
    }
    const keptMine = (conflicts ? conflicts.length : 0) - usedTheirs;   // hand counts the operator kept at the prompt
    const kept = (keptManual || 0) + keptMine;                          // + hand counts the file matched
    const allToAdd = toAdd.concat(extra);
    // A later file row for a register-day already handled (kept / conflicted) was dropped — the
    // per-day scope is deliberate (S99/S103) but the drop must be surfaced (S141), never in silence.
    const extraNote = extraDropped ? ' (' + extraDropped + ' extra row' + (extraDropped === 1 ? '' : 's')
        + ' for an already-counted register-day, not imported)' : '';
    // A column-less whole-day totals line was skipped as already covered by the per-register rows (S142).
    const totalsNote = totalsLines ? ' (' + totalsLines + ' whole-day totals row' + (totalsLines === 1 ? '' : 's')
        + ' skipped, already covered by the per-register rows)' : '';
    // ⚠ A ROW WITH NO READABLE DATE IS A DIFFERENT PROBLEM FROM A ROW WITH NO OVER/SHORT, and it
    // gets its own sentence. Both used to arrive in one `skipped` list rendered as "no over/short
    // figure", so a file whose date cell reads "Jul 24" sent the operator to check a column that
    // was never the problem. It is also the one skip they can actually fix in the file.
    const und = (undated || []).length;
    const undatedNote = und ? ' (' + und + ' row' + (und === 1 ? '' : 's') + ' skipped, no readable date)' : '';
    // Declared out here so the commit-FAILURE path can carry it too — see the sales door's note.
    const skipNote = skipped.length ? ' (' + skipped.length + ' row' + (skipped.length === 1 ? '' : 's')
        + ' skipped, no over/short figure)' : '';
    /* A register-day the FILE listed twice with identical figures (S218). Distinct from `extraNote`,
       which is a second row for a register-day ALREADY COUNTED in this import with different
       figures; this one is the same line over again. A drawer count is one per register per day —
       the hand form keys on drawer_id and says so — so the repeat is counted once. */
    const repeatNote = (fileRepeats || 0) ? ' (' + fileRepeats + ' repeated line' + (fileRepeats === 1 ? '' : 's')
        + ' counted once)' : '';
    // Everything this import found besides the write itself. A refused save must not swallow it.
    const cashOutcomes = (kept ? ' (' + kept + ' hand count' + (kept === 1 ? '' : 's') + ' kept)' : '')
        + (usedTheirs ? ' (' + usedTheirs + ' used the file over your hand count)' : '')
        + extraNote + totalsNote + skipNote + undatedNote + repeatNote;
    if (!allToAdd.length) {
      if (kept || extraDropped || totalsLines || fileRepeats) note('No new figures written.'
          + (kept ? ' ' + kept + ' hand count' + (kept === 1 ? '' : 's') + ' kept.' : '') + extraNote + totalsNote + skipNote + undatedNote + repeatNote);
      else fail('No rows imported. Each row needs a date plus an over/short, or expected and counted cash.' + skipNote + undatedNote);
      return;
    }
    const ok = await PosIngest.commit('cash', allToAdd);
    // Same partial-save honesty as the sales and server doors — _commitCashRows writes per row too,
    // and the failure carries every other outcome the import found rather than replacing them.
    if (!ok) { fail(App.partialSaveNote(App.landedOf(allToAdd, App.shiftData && App.shiftData.sc_variances),
                                      allToAdd.length, 'reconcile', 'reconciles') + cashOutcomes); return; }
    this._pendingCashRows = null;
    this._flash = allToAdd.length + ' reconcile' + (allToAdd.length === 1 ? '' : 's') + ' imported'
      + (dupCount ? ' (' + dupCount + ' replaced earlier figures)' : '')
      + (usedTheirs ? ' (' + usedTheirs + ' used the file over your hand count)' : '')
      + (kept ? ' (' + kept + ' hand count' + (kept === 1 ? '' : 's') + ' kept)' : '')
      + extraNote + totalsNote
      // ⚠ A skipped cash row is a register-day with NO over/short at all (S105). Silence let the
      // operator read "4 reconciles imported" off a 6-row file and believe the week was counted.
      + (skipped.length ? ' (' + skipped.length + ' row' + (skipped.length === 1 ? '' : 's')
          + ' skipped, no over/short figure)' : '') + undatedNote + '.';
    this._openStep = 'exc';
    this.render(this.container, this.actions);
  },

  // ── Wiring ───────────────────────────────────────────────────────────────────
  wire() {
    this.container.onclick = ev => {
      if (ev.target.closest('[data-insights]')) { this.showInsights(); return; }
      const sm = ev.target.closest('[data-salesmode]');
      if (sm) { this._salesMode = sm.dataset.salesmode; this._openStep = 'import'; this.render(this.container, this.actions); return; }
      if (ev.target.closest('[data-savesales]')) { this.saveManualSales(); return; }
      const opt = ev.target.closest('[data-opt]');
      if (opt) { const key = opt.dataset.opt; this._optOpen = this._optOpen || {}; this._optOpen[key] = !this._optOpen[key]; this.render(this.container, this.actions); return; }
      const head = ev.target.closest('.sc-step-head');
      if (head) { const k = head.dataset.step; this._openStep = (this._openStep === k) ? '' : k; this.render(this.container, this.actions); return; }
      const dn = ev.target.closest('[data-done]');
      if (dn) { this.setDone(dn.dataset.done, true); this._openStep = null; this.render(this.container, this.actions); return; }
      const un = ev.target.closest('[data-undone]');
      if (un) { this.setDone(un.dataset.undone, false); this._openStep = un.dataset.undone; this.render(this.container, this.actions); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
      if (ev.target.closest('.sc-wk-prev')) { this._stepWeek(-7); return; }
      if (ev.target.closest('.sc-wk-next')) { this._stepWeek(7); return; }
      if (ev.target.closest('.sc-wk-now'))  { this._weekEnd = null; this._openStep = null; this._flash = null; this.render(this.container, this.actions); return; }
    };
  }
};
