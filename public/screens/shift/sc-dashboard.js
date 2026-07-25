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
  async _doImportSales(rows, opts) {
    opts = opts || {};
    const built = PosIngest.build('sales', rows, opts);
    const { toAdd, skipped, zeroSkipped, dupCount, merged, keptManual, conflicts, covDropped } = built;
    // A covers column the file carried but Bar Cop could not read (an accounting-negative cell, a
    // date, a range). The sales are still imported — only covers is left alone — but the operator
    // has to be told, or the day's covers look imported when they were never touched.
    const covNote = (covDropped && covDropped.length)
      ? ' (covers could not be read on ' + covDropped.length + ' day' + (covDropped.length === 1 ? '' : 's')
        + ', so ' + (covDropped.length === 1 ? 'that day kept its' : 'those days kept their')
        + ' existing count — sales still came in)'
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
    }
    const keptMine = (conflicts ? conflicts.length : 0) - usedTheirs;   // hand days the operator kept at the prompt
    const kept = (keptManual || 0) + keptMine;                          // + hand days the file simply matched
    const allToAdd = toAdd.concat(extra);
    if (!allToAdd.length) {
      // ⚠ Say the TRUE reason (S105). Kept-by-hand and cleared days are real outcomes, not a broken
      // file — never blame the operator's own work. A dropped row is still surfaced. And if days
      // were CLEARED (deleted up in saveManualSales) but every typed day came through empty, report
      // the clear AND re-render — otherwise the delete is silent and the grid keeps showing them.
      const skipNote = skipped.length ? ' (' + skipped.length + ' row' + (skipped.length === 1 ? '' : 's')
          + ' skipped, no usable date or sales figure)' : '';
      if (opts.cleared) {
        this._flash = opts.cleared + ' day' + (opts.cleared === 1 ? '' : 's') + ' cleared to zero'
          + (kept ? ', ' + kept + ' day' + (kept === 1 ? '' : 's') + ' kept as entered' : '') + skipNote + zeroNote + covNote + '.';
        this._openStep = 'cash'; this.render(this.container, this.actions); return;
      }
      if (kept) note('No new figures written. ' + kept + ' day' + (kept === 1 ? ' was' : 's were')
                     + ' kept as you entered ' + (kept === 1 ? 'it' : 'them') + ' by hand.' + skipNote + zeroNote + covNote);
      // S189: nothing imported and the ONLY reason is $0 days — say that plainly instead of "check the
      // Date column", and point to the sanctioned zeroing path (Enter Manually).
      else if (zeroSkipped.length && !skipped.length) fail((zeroSkipped.length === 1 ? 'That day' : 'Those days')
                     + ' came in at $0, so nothing was imported. Use Enter Manually to record a zero day.');
      else fail((opts.manual ? 'No days saved. Enter sales for at least one day.'
                             : 'No days imported. Check that the file has a Date column and sales values.') + skipNote + zeroNote + covNote);
      return;
    }
    const ok = await PosIngest.commit('sales', allToAdd);
    if (!ok) { fail('Save failed. Try the ' + (opts.manual ? 'save' : 'import') + ' again.'); return; }
    if (App.markSetupDone) App.markSetupDone('gs_sc_shift');
    this.setDone('import', true);   // a cockpit import is a deliberate "the week is in" action
    // Say when rows were combined, replaced, chosen over a hand entry, or kept — folding any of
    // those into a money figure silently is how the old drop-the-repeats bug stayed invisible.
    this._flash = allToAdd.length + ' day' + (allToAdd.length === 1 ? '' : 's') + ' ' + (opts.manual ? 'saved' : 'imported')
      + (merged ? ' (' + merged + ' extra row' + (merged === 1 ? '' : 's') + ' combined into day totals)' : '')
      + (dupCount ? ' (' + dupCount + ' replaced earlier figures)' : '')
      + (usedTheirs ? ' (' + usedTheirs + ' used the file over your hand entry)' : '')
      + (kept ? ' (' + kept + ' day' + (kept === 1 ? '' : 's') + ' kept as you entered ' + (kept === 1 ? 'it' : 'them') + ')' : '')
      // ⚠ A dropped row is a MEASUREMENT THAT WENT MISSING (S105): a junk date, or a day whose
      // revenue came through zero or negative. Silence let the operator read "3 days imported" off
      // a 5-day file and believe the week was in.
      + (skipped.length ? ' (' + skipped.length + ' row' + (skipped.length === 1 ? '' : 's')
          + ' skipped, no usable date or sales figure)' : '')
      + zeroNote + covNote
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
    const rows = [], zeroDays = [], badDays = [];
    this._weekDays().forEach(d => {
      const bar = (document.getElementById('scm-bar-' + d) || {}).value;
      const food = (document.getElementById('scm-food-' + d) || {}).value;
      const cov = (document.getElementById('scm-cov-' + d) || {}).value;
      if (!(has(bar) || has(food) || has(cov))) return;   // day left untouched: leave it alone
      // Covers WITHOUT sales is an incomplete row, not an instruction. Only an explicit
      // zero in a SALES cell means "this day had none, clear it". Without this test a day
      // with covers typed and sales blank fell through to zeroDays and deleted the day.
      if (!(has(bar) || has(food))) return;
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
      rows.push({ date: d, bar: bar, food: food, covers: cov });
    });
    const res = document.getElementById('sc-ck-import-res');
    const fail = m => { if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">' + m + '</div>'; };
    // Refuse the whole save on a negative rather than part-saving around it — a day silently left
    // out is the thing that makes the week's total wrong without anything on screen saying so.
    if (badDays.length) {
      // Name the day the way the GRID does ("Thu, Jul 23"), not as a raw ISO date. This is the one
      // thing standing between the operator and a save, so it must point at a row they can see.
      const label = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
      fail('Sales and covers cannot be negative. Check ' + badDays.map(label).join(', ') + ' and save again.');
      return;
    }
    if (!rows.length && !zeroDays.length) { fail('Enter at least one day\'s sales before saving.'); return; }

    let cleared = 0, broke = false;
    for (const d of zeroDays) {
      // The operator is IN the grid explicitly zeroing this day, so clear whatever record held it,
      // WHATEVER its source (S140) — a hand entry is now source:'manual', imported:false, and the
      // old `imported === true` filter would leave their own prior figure standing and re-render it.
      // This IS the operator's own edit door, so clearing their prior figure for the day is the point.
      const stale = ((App.shiftData && App.shiftData.sc_shifts) || []).filter(s => s && s.date === d);
      for (const s of stale) { if (await App.removeRecord('sc', 'shift', s.id)) cleared++; else broke = true; }
    }
    if (broke) { fail('Could not clear a day. Try the save again.'); return; }
    if (rows.length) { await this.importSales(rows, { manual: true, cleared: cleared }); return; }

    // Zeroed days only: nothing left to write, so report the clear from here.
    this._flash = cleared
      ? cleared + ' day' + (cleared === 1 ? '' : 's') + ' cleared to zero.'
      : 'Those days were already empty.';
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
    const { toAdd, skipped, incomplete, dupCount } = PosIngest.build('server', rows);
    const res = document.getElementById('sc-ck-server-res');
    if (!toAdd.length) {
      if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + (dupCount ? 'No new server rows imported. ' + dupCount + ' already logged.' : 'No server rows imported. Each row needs a server name Bar Cop can match, a date, covers, and sales.') + '</div>';
      return;
    }
    const ok = await PosIngest.commit('server', toAdd);
    if (!ok) { if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">Save failed. Try the import again.</div>'; return; }
    const inc = (incomplete || []).length;
    this._flash = toAdd.length + ' server check' + (toAdd.length === 1 ? '' : 's') + ' imported'
      + (dupCount ? ' (' + dupCount + ' already logged)' : '')
      + (skipped.length ? ' (' + skipped.length + ' row' + (skipped.length === 1 ? '' : 's') + ' skipped, names not matched)' : '')
      + (inc ? ' (' + inc + ' row' + (inc === 1 ? '' : 's') + ' skipped, no covers or sales rung)' : '') + '.';
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
    const { toAdd, skipped, merged } = PosIngest.build('pmix', rows);
    const res = document.getElementById('sc-ck-pmix-res');
    if (!toAdd.length) {
      if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">No items updated. Each row needs an item name Bar Cop can match on your menu and a units-sold number.</div>';
      return;
    }
    const ok = await PosIngest.commit('pmix', toAdd);
    if (!ok) { if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">Save failed. Try the import again.</div>'; return; }
    // Say when rows were combined. A daypart-split export legitimately lists an item several
    // times and we sum them, so the operator should see why the total is bigger than any one row.
    this._flash = toAdd.length + ' menu item' + (toAdd.length === 1 ? '' : 's') + ' updated from sales mix'
      + (merged ? ' (' + merged + ' extra row' + (merged === 1 ? '' : 's') + ' combined into item totals)' : '')
      + (skipped.length ? ' (' + skipped.length + ' name' + (skipped.length === 1 ? '' : 's') + ' not matched)' : '') + '.';
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
        if (sel.value === '__add') { const r = this._addRegister(name); created.push(r); touched.set(r.id, r); return; }
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
    const { toAdd, skipped, dupCount, keptManual, conflicts, extraDropped, totalsLines } = built;
    const res = document.getElementById('sc-ck-cash-res');
    const fail = m => { if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">' + m + '</div>'; };
    const note = m => { if (res) res.innerHTML = '<div style="font-size:13px;color:var(--t2);margin-top:12px;">' + m + '</div>'; };
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
    if (!allToAdd.length) {
      const skipNote = skipped.length ? ' (' + skipped.length + ' row' + (skipped.length === 1 ? '' : 's')
          + ' skipped, no over/short figure)' : '';
      if (kept || extraDropped || totalsLines) note('No new figures written.'
          + (kept ? ' ' + kept + ' hand count' + (kept === 1 ? '' : 's') + ' kept.' : '') + extraNote + totalsNote + skipNote);
      else fail('No rows imported. Each row needs a date plus an over/short, or expected and counted cash.' + skipNote);
      return;
    }
    const ok = await PosIngest.commit('cash', allToAdd);
    if (!ok) { fail('Save failed. Try the import again.'); return; }
    this._pendingCashRows = null;
    this._flash = allToAdd.length + ' reconcile' + (allToAdd.length === 1 ? '' : 's') + ' imported'
      + (dupCount ? ' (' + dupCount + ' replaced earlier figures)' : '')
      + (usedTheirs ? ' (' + usedTheirs + ' used the file over your hand count)' : '')
      + (kept ? ' (' + kept + ' hand count' + (kept === 1 ? '' : 's') + ' kept)' : '')
      + extraNote + totalsNote
      // ⚠ A skipped cash row is a register-day with NO over/short at all (S105). Silence let the
      // operator read "4 reconciles imported" off a 6-row file and believe the week was counted.
      + (skipped.length ? ' (' + skipped.length + ' row' + (skipped.length === 1 ? '' : 's')
          + ' skipped, no over/short figure)' : '') + '.';
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
