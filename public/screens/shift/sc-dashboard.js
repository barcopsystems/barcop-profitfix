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
        /* ⚠ OVER / SHORT IS A CHANGE, SO THE MINUS GOES OUTSIDE THE DOLLAR SIGN. fmtCurrency is
           '$' + v, so a short drawer printed "$-3.00" — and this stat is mirrored onto the HUB
           LANDING PAGE, which is the first screen every operator opens. App.fmtBal carries the
           minus; the '+' and the warn state both come off fmtSigned's ROUNDED sign so a range
           that balances to the cent cannot read as a shortage. Same rule as cash-recon. */
        varCount
          ? { label: 'Over / Short', value: (App.fmtSigned(netVar, 2).sign > 0 ? '+' : '') + App.fmtBal(netVar),
              warn: App.fmtSigned(netVar, 2).sign < 0 }
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
    const flashZone = this._flashZone; this._flashZone = null;
    /* ⛔⛔⛔ A LANDED IMPORT HAS TO BE REPORTED SOMEWHERE, AND IT WAS NOT BEING. A zone's `-res` slot
       lives inside `workspace(zone)`, which `stepRow` renders ONLY while that step is open — and
       every lane advances the step in the same breath as it sets the flash (`_doImportSales` moves
       to 'cash', `_commitCash` to 'exc'). So the message was written into an element this same
       render had just taken off the page, and dropped. Measured on v106 with a DOM that resolves
       only ids the render emitted: BOTH lanes, no line anywhere, on the press that saves the week.
       ⭐ THE ZONE SLOT IS A PLACEMENT, NOT A REQUIREMENT. Kyle's *"gold, under the drop file box,
       between the box and the two buttons"* still holds whenever that box is on the page; when it is
       not, the line goes back to the top of the page — which is where a zone-less flash has always
       gone — rather than nowhere.
       ⚠ DERIVED, NEVER PROBED: the slot is on the page exactly when its zone is the open step, and
       that is knowable before a byte of markup is built. */
    const flashInZone = !!(flash && flashZone && this._openStep === flashZone);
    const wys = this._wys();

    /* ⛔ THE IMPORT OWNS THE PAGE. Nothing under it: not the other three drop zones, not the
       remaining steps, not Where You Stand. The operator dropped a file and is doing one job.
       ⚠ The carried mapper is re-attached, never re-mounted — see `_onMapState`. Once the mapper has
       handed its rows over, `_salesReview` is what holds the page and the carried node is spent. */
    /* ⛔ A FINISHED IMPORT GIVES THE PAGE BACK, and `_flash` is the one signal every lane already
       sets the moment it lands — sales, per-server, product mix and cash all set it and re-render.
       Reading it here is one release path instead of four, and it cannot drift from what the lanes
       do because it IS what they do. A flash set by something other than an import finds no
       takeover to clear, so this is a no-op there. */
    if (flash && !this._anyReview()) this._clearTakeover();

    /* ⛔⛔ A TAKEOVER WITH NO MAPPER LEFT IS A LIE ABOUT THE STATE, AND IT STRANDS THE OPERATOR.
       Kyle found it on Close The Books (2026-08-07): *"if you drop a file and it takes over page...
       and then you click and go to another page and come back.. the drop file has no cancel button
       so the only way to get back to the full page is to refresh it."* The flag lives on this object
       and outlives the DOM, so on the way back in it can still say "an import is in progress" over a
       mapper that did not survive — a bare drop zone with the steps gone and no control that returns
       the page.
       ⛔ THE FIX IS NOT A CANCEL BUTTON, IT IS NOT CLAIMING THE STATE. If the carried mapper is gone
       the parsed rows went with it, so there is no import in progress and the page belongs back to
       the operator. A Cancel would be a control for a state that should not exist — and this screen
       just had a second Cancel removed for being one control too many.
       ⚠ THE CONFIRM SCREEN IS THE EXCEPTION AND IT IS WHY THE GUARD READS BOTH: `_salesReview` lives
       on the OBJECT, not in the DOM, so a file that got that far genuinely IS still in progress and
       has to survive the round trip untouched. */
    if (this._ckTakeover != null && !this._ckCarry && !this._anyReview()) this._clearTakeover();

    /* ⛔⛔ BUILT TO MATCH CLOSE THE BOOKS, which is the one that shipped and was walked. Kyle,
       comparing them side by side: *"books is on the right... yours is image on the left.. you did it
       completely different.. make it like books."* Books' own comment says what it keeps and why —
       *"keeps the context of what they are closing and how far along they are"* — so Where You Stand
       and the progress banner STAY, and only the steps and the row of navigate-away buttons go.
       My first version stripped the page to a bare small-caps title, which is a different screen.
       ⛔ ONE CANCEL. CSVMapper already renders its own beside Import, and it releases the page
       through `_onMapState('drop')`. A second one under it is two controls for one job and the
       operator cannot tell which abandons what. */
    if (this.ckTakeover()) {
      container.innerHTML = '<div class="screen">'
        + (wys.hasSales ? this.whereYouStand(wys) : this.getStartedBox())
        + this.banner(doneCount, this.ORDER.length)
        /* ⛔ TWO SHAPES, AND KYLE WALKED BOTH.
           MAPPER: a card holding the drop zone and the column mapper, then the Import / Cancel row
           OUTSIDE it — *"the import/cancel buttons go outside the card"*. That is exactly how Books
           renders `<div class="card form-card">…</div>` followed by its actions slot.
           CONFIRM: the shell's panel and nothing else. It already brings its own heading, its own
           card around the table and its own buttons below it, so wrapping it in a second card gave
           *"a card inside another card"* and a duplicate title. */
        + (this._anyReview()
            ? '<div style="margin-top:18px;">'
              /* ⚠ ONE CONFIRM SCREEN ON THIS PAGE AGAIN. Door 10 made this a two-way pick between the
                 sales panel and a per-server one; the per-server drop is a signpost now and its member
                 went with it, so the second branch was a call to something that no longer exists —
                 unreachable only because `_anyReview()` happens to read one field. `verify-method-refs`
                 is what found it, which is the whole reason that sweep exists. */
              + this._reviewHTML() + '</div>'
            : '<div class="card form-card" style="margin-top:18px;">'
              +   '<div class="card-title">' + esc(this.CK_TITLE[this._ckTakeover] || 'Check your import') + '</div>'
              +   '<div id="sc-ck-takeover"></div>'
              + '</div>'
              + '<div id="sc-ck-takeover-actions" style="margin-top:14px;"></div>'
              /* ⛔⛔ A MESSAGE RAISED WHILE A FILE OWNS THE PAGE HAD NOWHERE TO GO, AND ONE OF THEM
                 WAS A CONTROL THE OPERATOR HAS TO ANSWER. `_showCashMap` renders the register
                 map-or-add prompt into `#sc-ck-cash-res`, which lives inside the STEP's workspace —
                 and by the time Import fires `onComplete` the file has already taken the page, so
                 that id is gone and the function returned in silence. Measured on v106: the press
                 created no register, wrote no row and rendered no prompt. NOTHING HAPPENED AT ALL,
                 for every bar whose POS names its registers differently — the ordinary case once
                 the registers are set up. Live since the takeover shipped (2026-08-07).
                 ⚠ The confirm stage needs none of this: the shell brings its own result slot. */
              + '<div id="sc-ck-takeover-res"></div>')
        + '</div>';
      if (!this._anyReview() && this._ckCarry) {
        const slot = document.getElementById('sc-ck-takeover');
        if (slot) slot.appendChild(this._ckCarry);
        const aslot = document.getElementById('sc-ck-takeover-actions');
        if (aslot && this._ckCarryActs) aslot.appendChild(this._ckCarryActs);
      }
      this.wire();
      /* ⭐ AND SCROLL TO IT, exactly as Close The Books does and for the same measured reason: the
         takeover renders BELOW Where You Stand and the banner, so on a short window the operator
         drops a file and sees nothing move. Only on the way in — on the way back out the steps are
         what they want to see, and yanking the page down to them would be the wrong end. */
      setTimeout(() => document.getElementById('sc-ck-takeover')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
      return;
    }

    container.innerHTML = '<div class="screen">'
      + (wys.hasSales ? this.whereYouStand(wys) : this.getStartedBox())
      + this.banner(doneCount, this.ORDER.length)
      /* ⛔ THE RESULT LANDS UNDER THE DROP BOX IT CAME FROM, IN GOLD (Kyle, 2026-08-07): *"still had
         the green text should be gold that lands under the drop file box between the box and the two
         buttons."* It used to print in GREEN at the top of the page — the loudest and least
         consistent of the five success-line treatments across the import doors, and nowhere near the
         zone the operator just used. A lane that names its zone puts it in that zone's own `-res`
         slot, which already sits between the drop box and the step's button row; only a flash with
         no zone (a manual clear-to-zero, a week change) still has nowhere better than here. */
      + (flash && !flashInZone
          ? '<div style="font-size:12px;color:var(--gold);font-weight:700;margin:12px 2px 0;">&#10003; ' + esc(flash) + '</div>'
          : '')
      + '<div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">'
      +   this.ORDER.map(k => this.stepRow(k, done)).join('')
      + '</div>'
      + this.outlierStrip()
      + '</div>';

    // ⚠ NOT WHILE THE CONFIRM SCREEN IS UP. Its markup replaces the whole step, so #sc-ck-import is
    // gone and re-mounting the dropzone would hand the operator a second file picker over a file
    // they have not finished confirming.
    if (this._openStep === 'import' && this._salesMode !== 'manual' && !this._anyReview()) {
      this.mountImport();
    }
    if (this._openStep === 'cash') this.mountCashImport();
    /* The result, written into the slot that already sits between that zone's drop box and the
       step's button row. Written AFTER the mounts, because `CSVMapper.mount` repaints its own
       container and a message put there first would be gone. */
    if (flashInZone) {
      const slot = document.getElementById((this.CK_ZONE[flashZone] || '') + '-res');
      if (slot) slot.innerHTML = '<div style="font-size:12px;color:var(--gold);font-weight:700;margin:12px 2px 0;">'
        + '&#10003; ' + esc(flash) + '</div>';
    }
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
      ? '<span style="color:var(--green);font-weight:700;">&#10003; ' + (this.atCurrentWeek() ? 'You\'re current this week' : 'This week is closed out') + '</span>'
      : '<span style="color:var(--t2);"><span style="color:var(--t1);font-weight:800;">' + doneCount + '</span> of ' + total + ' done</span>';
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
      /* ⚠ SAY HOW THE DAYS GOT HERE (SH12). This counted records and called every one of them
         "imported", so a bar with no POS export that keys its week into the Enter Manually grid
         read "7 days imported" about figures they typed by hand. The step offers both doors, so
         the subtitle has to describe whichever they used rather than naming one of them. */
      const wk = this.shifts().filter(s => this.inWeek(s.date));
      const n = wk.length;
      if (!n) return this._META.import.sub;
      const days = n + ' day' + (n === 1 ? '' : 's');
      const manual = wk.filter(s => s.source === 'manual').length;
      if (manual === 0) return days + ' imported';
      if (manual === n) return days + ' entered';
      return days + ' in';
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
    const bg = isOpen ? 'var(--step-open)' : (isDone ? 'var(--input)' : 'var(--surface)');
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
  /* ⭐⭐⭐ A SIGNPOST, NOT A DROP ZONE — Kyle, after actually using it (2026-08-07): *"maybe it doesn't
     make sense having the per-server sales and product mix here on the cockpit.. because you drop the
     file and it functions fine.. but then you are still on the cockpit.. so you don't visually get the
     immediate results and then you still have to go to the server check anyway to see it."*
     ⛔ MEASURED BEFORE AGREEING, AND THE CODE SAID IT THREE WAYS: `revenue_pmix` had **zero**
     references anywhere on this screen, `revenue_server_checks` had exactly ONE and it was inside the
     import's own failure message, and neither lane touched `stepDone()` — which reads only the
     operator's manual done-map. So both zones wrote data this page cannot show and could not advance
     the step they sat in. Their own copy already said where the result lives.
     ⭐ THE LINE THIS SETTLES, and it is worth more than the two zones: **the drop belongs where the
     result shows.** Sales by day feeds Confirm the Week and moves this page's hero and step head; the
     cash report feeds Reconcile Cash and moves Over / Short. Those two stay. These two never did.
     ⛔ AND THE FEATURE IS SIGNPOSTED, NOT DELETED. `verify-money-out-one-door.js` block C exists for
     exactly this: a screen that loses an entry point has to still SHOW THE WAY, or a feature that was
     MOVED reads as one that was LOST. The heading, the "optional" tag, the Weekly tag and the sentence
     naming the destination all stay; only the drop zone goes, and the gold link becomes a button that
     takes the operator to the page that will show them the result. */
  /* ⚠ RENAMED FROM `optDrop`, AND THE TWO DEAD ARGUMENTS WENT WITH IT. A member called `optDrop` that
     renders no drop zone is copy outliving the feature it describes, and it still took the mount `id`
     and the `_optOpen` `key` that nothing reads any more. */
  optSignpost(title, sub, go, goLabel) {
    return '<div style="margin-top:16px;border-top:1px solid var(--b2);padding-top:14px;">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;"><span style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--t3);">' + title + ' <span style="color:var(--t4);font-weight:600;text-transform:none;letter-spacing:0;">&middot; optional</span></span>' + App.freqTag('Weekly') + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:12px;">' + sub + '</div>'
      + '<button class="btn btn-ghost btn-sm" data-go="' + esc(go) + '">' + esc(goLabel) + '</button></div>';
  },
  /* ⛔⛔ A FILE DROPPED ON A COCKPIT STEP TAKES THE PAGE (Kyle, 2026-08-07, looking at the sales step
     mid-map): *"once a file is dropped that mapping takes over the page and there is nothing under
     it that becomes distracting.. here it is now with file dropped inline.. so you have everything
     below it... including the other two drop file links in the same card and then the reconcile cash
     section below that."* Close The Books already does exactly this for the Money Out step.

     ⛔ THE FLAG NAMES A ZONE, NOT A BOOLEAN, AND THAT IS THE DIFFERENCE FROM MONEY OUT. That step has
     ONE drop zone; this page has FOUR, three of them inside the sales card. A boolean cannot tell
     the re-render whose mapper to put back.
     ⚠ ONE AT A TIME: once a zone owns the page, a second `map` is ignored. The other zones are not
     even on screen at that point, so this is a guard against a stray event rather than a UI state —
     but it is the difference between "put the file back" and "put SOMETHING back". */
  /* ⚠ TWO ZONES SINCE 2026-08-07, and the flag still NAMES the zone rather than reverting to a
     boolean: sales and cash sit in DIFFERENT steps, so the re-render still has to know whose mapper
     to put back. Per-server and product mix became signposts to the pages that show their results
     (see `optSignpost`), so this page no longer takes those two files at all. */
  CK_ZONE: { import: 'sc-ck-import', cash: 'sc-ck-cash' },
  CK_TITLE: { import: 'Import this week\'s sales', cash: 'Import your cash report' },
  _ckTakeover: null,   // which zone owns the page
  _ckCarry: null,      // its live mapper node, carried across the re-render

  /* The question `render` asks before it decides its layout. The confirm screen holds it open too: a
     file already dropped and waiting to be confirmed must not lose the page out from under it. */
  /* Any lane's confirm screen. FIVE sites ask this question — the release on a flash, the stranded
     guard, the mapper re-attach, the drop-zone mount and `ckTakeover` — and each one was written
     against `_salesReview` when sales was the only converted lane. One accessor means a third lane
     joins by adding its field here, not by finding five call sites. */
  _anyReview() { return this._salesReview || this._cashReview; },
  /* WHICH lane's confirm screen is up. `_anyReview` says one of them is; this says which. Both read
     the same two fields, so they cannot disagree — and the door-10 note above records what happens
     when a branch here outlives the lane it was written for. */
  _reviewHTML() { return this._salesReview ? this.salesReviewHTML() : this.cashReviewHTML(); },
  ckTakeover() { return this._ckTakeover != null || !!this._anyReview(); },
  _ckCarryActs: null,  // the mapper's Import/Cancel row, which lives in its own element
  _clearTakeover() { this._ckTakeover = null; this._ckCarry = null; this._ckCarryActs = null; },

  /* ⛔⛔⛔ THE HANDOVER, AND THE ONE THING IT MUST NOT DO IS REBUILD THE MAPPER.
     `CSVMapper.mount()` opens with `container.innerHTML = <drop zone>`, so escalating by re-rendering
     and re-mounting would throw the operator's parsed file away and put them back on an empty drop
     zone — work lost, silently, which is the expensive class of defect here. The live node is
     DETACHED and carried, and `render` re-attaches that same element with its listeners and parsed
     rows intact.
     ⚠ ONE NODE IS THE WHOLE CARRY **ONLY BECAUSE NO ZONE HERE USES `actionsEl`** — the Import button
     renders inside the mapper's own container. Money Out had to carry two, and the version that
     carried only the mapper left the operator with a parsed file and nothing but Cancel. Pinned by
     `verify-cockpit-drop-takeover.js` block E, so a zone that gains an actionsEl fails loudly instead
     of silently losing its button. */
  _onMapState(key, st) {
    /* ⛔ THE MAPPER'S OWN CANCEL GIVES THE PAGE BACK, and it does it through the same hook: CSVMapper
       emits exactly two states, and going back to `drop` means the operator abandoned the file.
       Handling it here rather than only on a button of ours means there is ONE release path, so the
       page cannot be left taken over by a mapper that is showing an empty drop zone.
       ⚠ `drop` also fires when a mapper first MOUNTS, which is why this is gated on the zone already
       owning the page — at mount time nothing does, so it is a no-op. */
    if (st === 'drop') {
      if (this._ckTakeover === key) { this._clearTakeover(); this.render(this.container, this.actions); }
      return;
    }
    if (st !== 'map' || this._ckTakeover != null) return;
    const node = document.getElementById(this.CK_ZONE[key] || '');
    if (!node) return;
    /* ⛔⛔⛔ CARRY THE ACTIONS SLOT TOO, OR THE IMPORT BUTTON IS GONE AND THE FILE IS A DEAD END.
       CSVMapper renders its confirm button into a SEPARATE element — `actionsEl` — not into the
       mapper's own container. Money Out's first handover carried only the mapper, so the re-render
       destroyed the node holding Import and painted a fresh empty one: the operator dropped a file,
       got the column mapper, and had nothing but Cancel. Kyle found that on the live build.
       ⚠ THE LESSON, WRITTEN AT THE LINE: when you move state across a rebuild, enumerate EVERY node
       the component owns, not the one you were thinking about. */
    const acts = document.getElementById(this.CK_ZONE[key] + '-actions');
    this._ckCarry = node;
    this._ckCarryActs = acts || null;
    node.remove();
    if (acts) acts.remove();
    this._ckTakeover = key;
    this.render(this.container, this.actions);
  },

  workspace(k, isDone) {
    this._isDone = isDone;
    if (k === 'import') {
      /* The confirm screen takes the whole step. The Import / Enter Manually toggle and the two
         optional POS drops go with it on purpose: an operator part-way through confirming a week's
         sales is doing one job, and the reference screen behaves the same way. */
      if (this._salesReview) return this.salesReviewHTML();
      const seg = this._salesSeg();
      if (this._salesMode === 'manual') {
        return seg + this._manualSalesGrid()
          + '<div id="sc-ck-import-res"></div>'
          + '<div id="sc-ck-import-btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;"><button class="btn btn-primary btn-sm" data-savesales="1">Save the Week</button>' + this.markBtn('import', 'Mark Done') + '</div>';
      }
      return seg
        + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">One file, the whole week. Pull your sales-by-day report from your POS and drop it below. Re-importing replaces the days already in. Mark this done once the week is in.</div>'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--t3);">Daily sales <span style="color:var(--t4);font-weight:600;text-transform:none;letter-spacing:0;">&middot; required</span></span>' + App.freqTag('Weekly') + '</div>'
        + '<div id="sc-ck-import"></div><div id="sc-ck-import-actions"></div><div id="sc-ck-import-res"></div>'
        /* ⚠ THE SENTENCE ALREADY NAMED THE DESTINATION — *"Feeds your Server Check scorecard"* — which
           is why the button label can be the plain instruction rather than repeating it. */
        + this.optSignpost('Per-server sales', 'One row per server with covers and sales. Feeds your Server Check scorecard.', 'r-server-check', 'Drop It On Server Check')
        + this.optSignpost('Product mix', 'One row per item with units sold. Feeds Menu Engineering.', 'r-menu-engineering', 'Drop It On Menu Engineering')
        + '<div id="sc-ck-import-btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">' + this.markBtn('import', 'Mark Done') + '</div>';
    }
    if (k === 'cash') {
      return '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">Get this week\'s cash over/short in. If your POS makes a cash or drawer report, drop it here. No report? Reconcile your drawers in Cash Control. Mark this done once it is handled, or if you do not track cash over/short.</div>'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--t3);">Cash report</span>' + App.freqTag('Weekly') + '</div>'
        + '<div id="sc-ck-cash"></div><div id="sc-ck-cash-actions"></div><div id="sc-ck-cash-res"></div>'
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
      // Same fix as the stat strip above — the twin, fixed in the same edit so the two cannot
      // drift apart on the one number a drawer count exists to produce.
      +   (st.varCount
            ? mini('Cash Over / Short', (App.fmtSigned(st.netVar, 0).sign > 0 ? '+' : '') + App.fmtBal(st.netVar, 0),
                   App.fmtSigned(st.netVar, 0).sign < 0 ? 'var(--red)' : 'var(--t1)')
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
  //    section. Built fresh from your logged data on every open: no cache, no API call. ─────────────
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

  // ── Inline sales import (step 1) ─────────────────────────────────────────────
  mountImport() {
    const el = document.getElementById('sc-ck-import');
    if (!el || typeof CSVMapper === 'undefined' || typeof PosIngest === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your weekly POS sales-by-day report here',
      dropSub: 'Needs a Date column plus your sales (bar and/or food). Covers optional. One row per day.',
      fields: PosIngest.FIELDS.sales,
      confirmLabel: 'Import',
      actionsEl: '#sc-ck-import-actions',
      onState: st => { this._toggleBtns('sc-ck-import-btns', st); this._onMapState('import', st); },
      /* ⛔ THE FILE DOES NOT WRITE ITSELF ANY MORE. It goes to the confirm screen, exactly as Add
         Products does, and the Import press there is what moves responsibility for what lands from
         Bar Cop to the operator. This door was picked to prove the pattern BECAUSE it is the worst
         fit: rows are dates, there is nothing to recognise and nothing to decide, and `buildSales`
         reaches eleven different outcomes that used to be flattened into one sentence printed after
         the write. */
      onComplete: rows => this._openSalesReview(rows)
    });
  },

  // ── The confirm screen (Kyle, 2026-08-04) ────────────────────────────────────
  /* Same contract as `ic-product-setup`'s routing screen: nothing is written until the button, the
     button's number is what lands, every row says what will happen to it, and a row that will not
     land is dimmed with the reason on it. What did NOT come across is the grouping — a sales file
     has one destination, so there is one table — and the sink-to-the-bottom order, because a week
     is read Monday to Sunday and moving Wednesday down for coming in at $0 is harder to read, not
     easier. Both divergences are pinned in `verify-sales-import-review.js` rather than left to drift. */
  _openSalesReview(rows) {
    this._salesReview = { rows: (rows || []).slice(), useTheirs: {} };
    this._openStep = 'import';
    this.render(this.container, this.actions);
  },

  /* ⛔ ONE WALK PRODUCES THE ROWS, THEIR STATUS AND THE COUNT. This is the property `_routeSummary`
     was rebuilt around after the button promised 14, the table said 13 and 12 landed: if the count
     and the per-row verdict come from two passes they can disagree, and this is the last number an
     operator reads before pressing ([[output-honesty]]).
     ⚠ It rebuilds from `PosIngest.build` on every render rather than caching a result. A cached
     `toAdd` goes stale the moment anything else touches the week; the build is pure and cheap. */
  _salesReviewSummary() {
    const r = this._salesReview;
    if (!r) return { days: [], count: 0, built: null };
    const built = PosIngest.build('sales', r.rows, {});
    /* One label per outcome, and the ones on a row that will NOT land have to be distinct — a
       single generic "not imported" is what this screen replaces. The conflict wording is computed
       below instead, because it depends on the operator's own answer.
       ⚠ INSIDE the function on purpose. Written as a sibling data property it is invisible to every
       slicer in the harness suite (they all lift METHODS by name), so the stub reads `undefined` and
       the lifted body throws on its first row — which looks exactly like a real defect
       ([[the-loop]] #16). Nothing else needs it, so nothing has to lift a second name. */
    const NOTE = {
      'new':   'Adding this day',
      replace: 'Replacing earlier figures',
      /* ⛔ THE REMEDY GOES ON THE ROW, not in the line printed afterwards. Everything the old
         success sentence said now has to be on this screen, because that sentence is being cut back
         to the headline — it was repeating, in six parenthetical clauses, what the operator had
         just read row by row and approved. A fact that only lived in it has to move here first. */
      zero:    'Came in at $0, not imported. Use Enter Manually to record a zero day',
      nofig:   'No sales figure Bar Cop could use',
      same:    'Already matches what is saved',
      kept:    'You entered this day by hand and the file agrees',
      undated: 'No readable date'
    };
    const days = [];
    const add = (date, status, lands, extra) => {
      const row = Object.assign({ date: date, status: status, lands: !!lands, notes: [] }, extra || {});
      row.note = NOTE[status] || '';
      days.push(row);
      return row;
    };
    const byDate = {};
    const replaced = new Set(built.replacedDates || []);
    // A conflict day never reaches `toAdd` (the builder returns before it), so these sets cannot
    // overlap and no day can be listed twice.
    (built.toAdd || []).forEach(rec => { byDate[rec.date] = add(rec.date, replaced.has(rec.date) ? 'replace' : 'new', true, { rec: rec }); });
    (built.conflicts || []).forEach(c => {
      const chosen = !!r.useTheirs[c.key];
      const row = add(c.date, 'conflict', chosen, { key: c.key, mine: c.mine, theirs: c.theirs });
      row.note = chosen ? 'Using the file' : 'Keeping the figures you entered';
      byDate[c.date] = row;
    });
    (built.skipped     || []).forEach(d => { byDate[d] = add(d, 'nofig', false); });
    (built.zeroSkipped || []).forEach(d => { byDate[d] = add(d, 'zero',  false); });
    /* ⚠ THESE TWO ROWS SHOW THE FIGURES THAT ARE ALREADY SAVED, and that is not a second source —
       it is what the row says about itself. "Already matches what is saved" and "the file agrees"
       both mean the file's figures and the saved ones are the same number, so the saved record IS
       the file's figures. Left empty they rendered three dashes on a day the file had real numbers
       for, which tells the operator nothing about the day they are looking at. The other two
       non-landing states genuinely have nothing to show: a $0 day says so in words, and a day with
       no usable figure has none by definition. */
    const saved = {};
    (this.shifts() || []).forEach(s => { if (s && s.date != null) saved[String(s.date)] = s; });
    (built.unchanged   || []).forEach(d => { byDate[d] = add(d, 'same', false, { rec: saved[d] }); });
    (built.keptManualDates || []).forEach(d => { byDate[d] = add(d, 'kept', false, { rec: saved[d] }); });

    /* The extra lines under a day: a column the file could not give a figure for, and a guest count
       that was taken once instead of added up. Both are assumptions the import makes on a day that
       IS landing, so they belong on that day's row rather than in a sentence after the fact. */
    const gaps = built.colGaps || {};
    const COLNAME = { bar: 'Bar sales', food: 'Food sales', covers: 'Covers' };
    /* ⚠ "NO USABLE", NOT "UNREADABLE". One bucket covers BOTH a cell that is blank on this day and
       one holding something Bar Cop refused (a negative, a date, a range) — `_doImportSales` carries
       the same note about its own wording, because the two narrower phrasings were each false for
       the other case. Shortening these must not quietly pick one of them. */
    ['bar', 'food', 'covers'].forEach(k => {
      const what = COLNAME[k].toLowerCase();
      ((gaps.kept || {})[k] || []).forEach(d => { if (byDate[d]) byDate[d].notes.push('No usable ' + what + ', kept what is saved'); });
      ((gaps.zeroed || {})[k] || []).forEach(d => { if (byDate[d]) byDate[d].notes.push('No usable ' + what + ', saved as zero'); });
    });
    (built.coversRepeated || []).forEach(d => { if (byDate[d]) byDate[d].notes.push('Guest count taken once, not added up'); });
    /* A day your file splits across several rows (dayparts, revenue centres) is added up into one.
       The screen shows the total, so it has to say the total is a sum.
       ⚠ SHORT ENOUGH FOR ONE LINE (Kyle, 2026-08-04). These notes sit under the Day cell, which is
       22% of the table, and the first wording ran to a second line with the single word "day" on it.
       ~43 characters is the budget at this size; anything longer orphans a word. */
    (built.mergedDates || []).forEach(d => { if (byDate[d]) byDate[d].notes.push('Added up from several rows'); });

    // Monday to Sunday. The operator knows their week in date order and nothing else.
    days.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    /* Rows whose date could not be read never became a day, so they have no place in the list above
       — and leaving them out entirely is how a file quietly imports less than it looks like it did.
       They get one entry of their own at the end, carrying the count. */
    const nUnd = (built.undated || []).length;
    // ⚠ The count belongs in the Day cell, ONCE. Written into the reason as well it read
    // "1 row | 1 row has no readable date" — the same fact twice on a four-word row.
    if (nUnd) days.push({ date: '', status: 'undated', lands: false, notes: [], count: nUnd, note: NOTE.undated });

    return { days: days, count: days.filter(d => d.lands).length, built: built };
  },
  // ONE SOURCE with the table above it, or the button and the screen disagree.
  _salesReviewCount() { return this._salesReview ? this._salesReviewSummary().count : 0; },

  /* One day as an `ImportConfirm` row: the cells this door owns, plus the facts the shell needs to
     decide the dim, the count and the button. It builds no markup of its own beyond the cells.
     ⚠ `cells` is HTML and this door escapes it; `note` and `notes` are TEXT the shell escapes, and
     they are the two the NOTE_BUDGET applies to. */
  _salesReviewRow(d) {
    const money = v => (v == null ? '&mdash;' : App.fmtCurrency(v));
    const dayLabel = ymd => {
      const dt = new Date(ymd + 'T00:00:00');
      return isNaN(dt.getTime()) ? ymd : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };
    if (d.status === 'undated') {
      return { cells: [esc(d.count + (d.count === 1 ? ' row' : ' rows')), '&mdash;', '&mdash;', '&mdash;'],
               note: d.note, notes: [], lands: false };
    }
    // The figures shown are the FILE's, because that is what the press would write.
    const src = d.status === 'conflict' ? d.theirs : (d.rec || {});
    const mine = d.mine || {};
    /* ⛔ THE COMPARISON GOES IN THE COLUMN IT IS ABOUT (Kyle, 2026-08-04: *"that layout looks bad"*).
       It used to be one run-on sentence in the last cell — "You entered: $500.00 bar · $718.00 food
       · 50 covers" — stacked above two buttons in a 37% column, so reading it meant matching three
       figures in prose back against three columns an inch to the left. The row already HAS a Bar
       column; the operator's own bar figure belongs under it.
       ⚠ `ImportConfirm.compare` owns the "only where they differ" half, so every door gets it the
       same way. A `null` second value means there is nothing to compare and must look exactly like
       agreement — never "you entered &mdash;" — which is why the raw value is tested before it is
       formatted. */
    const cmp = (fileV, mineV, fmt) =>
      (d.status !== 'conflict' ? fmt(fileV) : ImportConfirm.compare(fmt(fileV), mineV == null ? null : fmt(mineV)));
    let decision = '';
    if (d.status === 'conflict') {
      const btn = (use, label, on) => '<button type="button" class="btn ' + (on ? 'btn-primary' : 'btn-ghost')
        + ' btn-sm" data-salesconf="' + esc(d.key) + '" data-use="' + use + '">' + label + '</button>';
      // ⚠ `.row-actions` right-aligns by default (it is built for Edit/Delete at the end of a row).
      // Here the buttons answer the sentence directly above them, so they line up with it.
      decision = '<div class="row-actions" style="justify-content:flex-start;margin-top:6px;">'
        + btn('mine', 'Keep Mine', !d.lands) + btn('file', 'Use The File', d.lands) + '</div>';
    }
    return {
      cells: [esc(dayLabel(d.date)),
              cmp(src.bar_revenue, mine.bar_revenue, money),
              cmp(src.floor_revenue, mine.floor_revenue, money),
              cmp(src.covers, mine.covers, v => (v == null ? '&mdash;' : String(v)))],
      note: d.note,
      notes: d.notes || [],
      lands: d.lands,
      // ⛔ A day the file disagrees with is the only row on this screen that needs the operator, so
      // it is never dimmed. The shell owns that rule now, for every door.
      needsYou: d.status === 'conflict',
      decision: decision
    };
  },

  salesReviewHTML() {
    const s = this._salesReviewSummary();
    const days = s.days;
    const nConf = days.filter(d => d.status === 'conflict').length;
    const nDays = days.filter(d => d.status !== 'undated').length;
    const busy = !!this._salesReviewWriting;
    /* ⚠ EACH PLURAL NAMES ITS OWN COLLECTION ([[the-loop]] #86): `nDays` is days read out of the
       file, `nConf` is days needing a call, and the button counts days that will be written. Three
       different numbers, and reading the nearest one is how a screen ends up contradicting itself. */
    /* ⚠ THE LEAD NAMES THE BUTTON, SO RENAMING THE BUTTON REWRITES THE LEAD. Both sentences said
       "press Import" and survived the rename to Add in silence — the screen would have pointed at a
       button that is not on it ([[copy-matches-app]], and [[the-loop]] #107: a rename breaks the
       pins that quote the old word and quietly satisfies the ones checking it is gone). Caught by
       reading the render, not by any assertion, so there is one below now. */
    const lead = nConf
      ? 'Bar Cop read ' + nDays + ' day' + (nDays === 1 ? '' : 's') + ' out of this file. '
        + (nConf === 1 ? 'One of them you' : nConf + ' of them you') + ' entered by hand and the file disagrees, so pick which figures to keep. '
        + 'Nothing is saved until you add them.'
      : 'Bar Cop read ' + nDays + ' day' + (nDays === 1 ? '' : 's') + ' out of this file. Check them, then add them. '
        + 'Nothing is saved until you do.';
    /* ⛔ THE FRAME COMES FROM `ImportConfirm`, WHICH EVERY IMPORT DOOR WILL SHARE. This door owns
       its columns, its per-row decision control and its build; the shell owns the card wrapper (the
       rows are invisible without it), the colgroup, the dim rule, the result slot and — the one
       that matters most — the BUTTON'S COUNT, which it derives from the rows it is handed rather
       than taking as an argument. That is what makes "the button promises what lands" true by
       construction here and at the thirteen doors still to convert, instead of a rule each one has
       to remember. `s.count` is still the screen's own figure; nothing passes it in.
       ⚠ "ADD", NOT "IMPORT" (Kyle, 2026-08-04, the same call he made on Add Products): the file was
       imported two screens ago, and a button offering to import it again reads as though the work
       has not happened yet. */
    return ImportConfirm.panel({
      label: 'Check your week',
      lead: lead,
      columns: [{ label: 'Day', width: 22 }, { label: 'Bar', width: 15 },
                { label: 'Food', width: 15 }, { label: 'Covers', width: 11 }],
      outcomeLabel: 'What Happens',
      rows: days.map(d => this._salesReviewRow(d)),
      verb: 'Add', noun: 'Day',
      /* ⛔ FLAT, AND THIS IS THE ONE DOOR THAT SHOULD BE. Every other import is an unbounded list of
         things and gets the shell's needs-a-look / collapsed split, because a 240-row first drop
         buries both the work and the button. A sales week is SEVEN DAYS READ MONDAY TO SUNDAY: the
         count is bounded by the calendar and the order is the whole point, so splitting it into two
         sections would be worse, not better. A fact about this door, not a row-count threshold. */
      flat: true,
      goAttr: 'data-salesreview-go', backAttr: 'data-salesreview-back', backLabel: 'Start Over',
      resultId: 'sc-ck-import-res',
      busy: busy
    });
  },

  /* One press, one import. The button is rebuilt by every re-render, so a flag on the screen is the
     only thing a re-render cannot hand back ([[the-loop]] #85). `importSales` holds its own re-entry
     guard as well; this one exists so the button can SAY it is working. */
  async _runSalesReview() {
    const r = this._salesReview;
    if (!r || this._salesReviewWriting) return;
    this._salesReviewWriting = true;
    const btn = this.container && this.container.querySelector('[data-salesreview-go]');
    if (btn) { btn.disabled = true; btn.textContent = 'Adding...'; }
    // `reviewed` says the operator has already been shown every outcome row by row and accepted it,
    // which is what lets the success line drop back to a headline. An explicit flag, not the
    // presence of `useTheirs` — a flag has to say what it means, and `useTheirs` is `{}` on a file
    // with no conflicts in it.
    try { await this.importSales(r.rows, { useTheirs: r.useTheirs, reviewed: true }); }
    finally {
      this._salesReviewWriting = false;
      /* ⛔ ONLY THE SUCCESS PATH CLEARS THE SCREEN, and `_doImportSales` is what clears it — a
         refused write keeps every answer so the operator can press again without re-dropping the
         file. Do NOT re-render here: the failure path writes into #sc-ck-import-res and a re-render
         would destroy the only message saying what happened. */
      if (this._salesReview) {
        const b = this.container && this.container.querySelector('[data-salesreview-go]');
        // ⚠ Counted ONCE into a local. Calling it twice in one expression runs the whole build twice
        // and, on anything less deterministic, lets the number and its own plural disagree
        // ([[harness-review-like-code]] #27).
        const n = this._salesReviewCount();
        if (b) { b.disabled = false; b.textContent = 'Add ' + n + ' Day' + (n === 1 ? '' : 's'); }
      }
    }
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
    const { toAdd, skipped, zeroSkipped, unchanged, undated, dupCount, merged, keptManual, conflicts, colGaps, coversRepeated } = built;
    /* ⚠ P1c: days where EVERY row stated the same guest count, so it was taken once instead of
       added up (a by-revenue-centre export repeats the day's total on every line). That is an
       ASSUMPTION, and the one shape it can get wrong is two dayparts that genuinely drew the same
       count — so it is said out loud with the dates, rather than quietly picked. The old behaviour
       was wrong in the other direction and said nothing at all, which is how a tripled guest count
       sat there looking fine. */
    const nRep = (coversRepeated || []).length;
    /* ⚠ Its OWN formatter. The `dayLabel` further down is declared inside the conflicts block, so
       reaching for it here is a ReferenceError at runtime and `node --check` cannot see it. */
    const repDay = d => { const t = new Date(d + 'T00:00:00'); return isNaN(t.getTime()) ? d
      : t.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
    const repNote = nRep
      ? ' (' + nRep + ' day' + (nRep === 1 ? '' : 's')
        + ' had the same guest count on every row, so it was counted once rather than added up: '
        + coversRepeated.map(repDay).join(', ') + ')'
      : '';
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
        + (zeroSkipped.length === 1 ? 'was' : 'were') + ' skipped: use Enter Manually to record a zero day)'
      : '';
    const res = document.getElementById('sc-ck-import-res');
    const fail = m => { if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">' + m + '</div>'; };
    const note = m => { if (res) res.innerHTML = '<div style="font-size:13px;color:var(--t2);margin-top:12px;">' + m + '</div>'; };
    /* A conflict: the file disagrees with days the operator entered BY HAND. The answer arrives in
       `opts.useTheirs`, decided ON THE ROW of the confirm screen before this ran
       ([[user-chooses-conflicts]]). Never on the manual grid — that grid IS the choice, and
       `buildSales` raises no conflict for it.
       ⛔ THE MODAL IS GONE FROM THIS DOOR, deliberately, rather than kept as a fallback. Two places
       to answer one question is the drift this codebase has paid for four times, and a branch that
       nothing can reach reads as live coverage to the next person who greps it ([[the-loop]] #61).
       `App.promptImportConflicts` itself stays — the cash and per-server doors still use it, and
       they are next in the rollout.
       ⚠ NO ANSWER MEANS KEEP YOUR OWN, which is the same default the prompt had. That is the safe
       direction: a caller that somehow reaches here without the screen can never overwrite an
       operator's own figures without being asked. */
    const extra = []; let usedTheirs = 0;
    if (conflicts && conflicts.length) {
      const chosen = opts.useTheirs || {};
      conflicts.forEach(c => { if (chosen[c.key]) { extra.push(c.useRec); usedTheirs++; } });
      /* ⚠ A CONFLICT DAY THE OPERATOR KEPT IS A DAY THE IMPORT DID NOT TOUCH, so its gap note reads
         as a second, separate event: "1 day kept as you entered it" AND "Food sales had no usable
         figure on 1 day, so that day kept the figures already saved" — both true, both about the
         same day, and together they sound like two things happened. The builder cannot know this;
         only the operator's answer decides it. A day resolved as USE THE FILE keeps its note,
         because there the unusable column really does stay at the prior figure and that is exactly
         what the operator needs to know about the choice they just made. */
      conflicts.forEach(c => { if (!chosen[c.key]) keptConflictDates.add(c.date); });
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
                     + (nUnd === 1 ? 'a row' : 'any row') + '. Check the date column in your export.' + tail);
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
    /* ⛔ THE CONFIRM SCREEN CLEARS ON SUCCESS AND ONLY ON SUCCESS. A refused write returns above
       this line with the screen and every answer still up, so the operator presses Import again
       rather than re-dropping the file and re-making their choices. Cleared here rather than in the
       caller because THIS is the only line that knows the write landed. */
    this._salesReview = null;
    this.setDone('import', true);   // a cockpit import is a deliberate "the week is in" action
    /* ⚠⚠ SAY SO WHEN THIS LANDED INSIDE A WEEK ALREADY CONFIRMED (S281). Nothing here was blocked
       and nothing was lost — Confirm the Week stores its own figures on the `week` / `revenue_week`
       records, so the confirmed week still shows exactly what was signed off. But the DAYS behind it
       now say something different, and until this line the operator had no way to know: the import
       reported plain success while the two halves quietly disagreed. Kyle's call was warn, not
       block, and the sentence has to carry both facts or it reads as an error. */
    const cwEnds = App.confirmedWeeksTouched(allToAdd.map(r => r && r.date));
    const cwLabel = d => { const dt = new Date(d + 'T00:00:00'); return isNaN(dt.getTime()) ? d
      : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
    const cwNote = cwEnds.length
      ? ' Heads up: ' + (cwEnds.length === 1 ? 'this covers a week you already confirmed (week ending '
          + cwLabel(cwEnds[0]) + ')' : 'this covers ' + cwEnds.length + ' weeks you already confirmed ('
          + cwEnds.map(cwLabel).join(', ') + ')')
        + '. Your confirmed figures are unchanged. Re-confirm ' + (cwEnds.length === 1 ? 'that week' : 'those weeks')
        + ' if you want them to pick this up.'
      : '';
    /* ⛔ THE CLAUSE LIST IS FOR AN IMPORT NOBODY WAS SHOWN (Kyle, 2026-08-04, looking at six
       parentheticals in green): *"all that green text is very hard to read and follow.. it is just
       repeating what the user just saw on screen and confirmed by adding."* He is right, and the
       reason is that every one of those clauses was written when the drop wrote straight through
       and this line was the operator's ONLY account of what happened. It is now the second telling.
       So the headline stands alone when the operator came through the confirm screen, and the full
       account survives for the Enter Manually grid, which has no screen in front of it.
       ⚠ THIS ONLY HOLDS BECAUSE EVERY CLAUSE IS ON THAT SCREEN. Two were not until this edit — the
       row merge (now a per-row note) and the zero day's "use Enter Manually" remedy (now on the row
       itself). Before dropping a clause from here, find it on the screen ([[the-loop]] #25).
       ⚠ AND THE FAILURE LINE KEEPS EVERYTHING, deliberately. A refused write is when they read
       hardest, and success/failure agreeing is pinned for the path that still prints both. */
    this._flashZone = 'import';
    this._flash = allToAdd.length + ' day' + (allToAdd.length === 1 ? '' : 's') + ' ' + (opts.manual ? 'saved' : 'imported')
      + (opts.reviewed ? '' : salesOutcomes)
      + (opts.cleared ? ', ' + opts.cleared + ' cleared to zero' : '') + (opts.reviewed ? '' : repNote) + '.' + cwNote;
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
          // ⚠ PARENTHESES, NOT A COMMA. The label list directly in front of this is comma-joined, so
          // ", or 0 in both sales cells" read as one more day in that list. The em dash was carrying
          // real work here; a comma was the one replacement that could not do it.
          + ' (or 0 in both sales cells if the bar was closed). Clearing the covers instead leaves'
          + ' whatever is already saved for that day exactly as it is.'
        : 'Enter at least one day\'s sales before saving.');
      return;
    }

    /* ⚠⚠ WRITE THE DAYS THAT CHANGED, NEVER THE WHOLE WEEK (SH1). Every cell in this grid arrives
       PRE-FILLED from the saved record, so a day the operator never looked at is byte-identical to
       one they retyped, and writing it stamps source:'manual' / imported:false / a fresh
       created_at over a day that came from their POS file.
       That is not cosmetic. `PosIngest.buildSales` decides protect-vs-replace on exactly
       `prior.source === 'manual'`, so ONE hand correction turned the next weekly drop into a
       conflict prompt reading "2 days you already entered by hand" about days nobody had ever
       typed, offering "Keep mine" over figures that were never the operator's, on the screen that
       feeds Confirm the Week and every Recovery revenue read.
       ⚠ Compare against the record the CELL WAS FILLED FROM, built the same way _manualSalesGrid
       builds it (last row per date wins), or the comparison is against a different record than the
       one on screen ([[the-loop]] #36). A date with no saved record can never match, so a brand-new
       day always writes. */
    const priorByDate = {};
    this.shifts().filter(s => this.inWeek(s.date)).forEach(s => { priorByDate[String(s.date).slice(0, 10)] = s; });
    const cents = x => Math.round((App.parseNum(x) ?? 0) * 100);
    const unchanged = r => {
      const p = priorByDate[r.date];
      if (!p) return false;
      return cents(r.bar) === cents(p.bar_revenue)
          && cents(r.food) === cents(p.floor_revenue)
          && cents(r.covers) === cents(p.covers);
    };
    // ⚠ A NEW BINDING, NOT A REASSIGNMENT. `rows` is a const up top, and "Assignment to constant
    // variable" only throws on the branch that runs it ([[the-loop]] #72).
    const untouched = rows.filter(unchanged).length;
    const changedRows = rows.filter(r => !unchanged(r));
    // Everything on screen already matches what is saved, and nothing was zeroed. Say that rather
    // than reporting a write that did not happen. "Those days were already empty" is the zeroed-day
    // wording and is false here, because these days have figures.
    if (!changedRows.length && !zeroDays.length) {
      this._flash = untouched === 1
        ? 'Nothing to save. That day already reads exactly this way.'
        : 'Nothing to save. Those ' + untouched + ' days already read exactly this way.';
      this.render(this.container, this.actions);
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
            ? 'every day. ' + cleared + ' of ' + attempted + ' were cleared before the save was refused. Try the save again to finish.'
            // ...and say how many were being cleared, rather than "the day" over a batch of three.
            : (attempted === 1 ? 'the day' : 'those ' + attempted + ' days') + '. Try the save again.') + coTail);
      return;
    }
    if (changedRows.length) { await this.importSales(changedRows, { manual: true, cleared: cleared, coversOnly: coversOnlyLabels }); return; }

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
  // The label comes from the SHELL, not a second copy of its rule.


  // ── Inline product-mix (PMIX) import (step 1 optional) ───────────────────────
  // Feeds Menu Engineering covers. Matches each item to the menu by name and
  // updates weekly_covers in place; unmatched item names are skipped and surfaced.

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
      actionsEl: '#sc-ck-cash-actions',
      onState: st => { this._toggleBtns('sc-ck-cash-btns', st); this._onMapState('cash', st); },
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
      const cashRes = this._cashPanelSlot();
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
        /* ⛔⛔⛔ THE FILE'S OWN TOTALS LINE IS NOT A REGISTER, AND THIS WALK WAS THE LAST PLACE THAT
           DID NOT KNOW IT. Kyle, walking the shipped screen: *"why is 'TOTAL' there as a register
           option.. on a first drop with no data in app it automatically adds 'TOTAL' as an active
           register on the cash control screen and in add registers."* Reproduced, all four halves:
           a first drop minted a register literally named TOTAL; a bar that already had registers was
           asked to file the totals line as one, with no way to answer "that is not a register"; and
           mapping it onto a real one wrote TOTAL as a permanent `pos_alias` — which then puts "total"
           into `known`, so the prompt stops firing and the operator hides the symptom by polluting
           their own setup.
           ⛔ `buildCash` HAS KNOWN SINCE STAGE 1 and files no row against it. The rule was taught to
           the BUILDER and stopped there; this walk asks a different question about the same rows
           ("which register names do I not know") and never asked. Whenever a builder learns a rule,
           find every other walk over the same rows.
           ⭐ THE TEST IS THE BUILDER'S OWN, both cells, so the two cannot drift apart: a row the
           builder will skip cannot justify creating a register. It is deliberately not a word list
           of my own — `isSummaryName` already answers for TOTAL / Totals / Grand Total / Team
           Average and, just as importantly, answers FALSE for a real register called "Total Wine
           Bar". */
        if (PosIngest.isSummaryName(raw) || PosIngest.isSummaryName(r.cashier)) return;
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
        return this._openCashReview(rows);
      }
      if (unmatched.length) { this._showCashMap(unmatched); return; }   // map or add
      return this._openCashReview(rows);
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
  /* ⛔⛔ WHERE A CASH MESSAGE CAN LAND, IN ONE PLACE, BECAUSE THE PAGE HAS THREE SHAPES AND ONE OF
     THEM HAD NO SLOT AT ALL:
       `#sc-ck-cash-res`      the step's own slot — open step, or the confirm screen (the shell
                              renders it as its `resultId`, so a refused reviewed write reports there);
       `#sc-ck-takeover-res`  while a dropped file owns the page and the step flow is gone.
     ⛔ THE SECOND ONE IS WHY THIS EXISTS. `_showCashMap` opened `if (!res) return;` against the
     first — and a file always owns the page by the time Import fires, so the register map-or-add
     prompt could not render and the press did nothing at all. Not a message going missing: a
     CONTROL the operator has to answer, for every bar whose POS names its registers differently. */
  _cashPanelSlot() {
    return document.getElementById('sc-ck-cash-res')
        || document.getElementById('sc-ck-takeover-res');
  },
  _showCashMap(unmatched) {
    const res = this._cashPanelSlot();
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
      /* ⛔ `.f`, WHICH IS WHERE THE GREY CHEVRON LIVES (Kyle: *"the drop down is not styled
         correctly.. should be like the drop downs in the mapping part.. with the grey drop down
         arrow"*). `.f select` in style.css sets `appearance:none` and paints the chevron itself; a
         bare select outside a `.f` gets none of it and falls back to the browser's own arrow, at a
         different height. The column mapper two inches above renders exactly this wrapper, which is
         why the two read as different controls for the same job.
         ⚠ AND THE INLINE HEIGHT GOES WITH IT. `height:34px` fought `.f select`'s own padding, so
         even wrapped it would have stayed a different size from the mapper's. */
      + '<div class="f" style="min-width:220px;">'
      +   '<select class="sc-cm-sel" data-name="' + esc(n) + '">'
      +     '<option value="__add">Add as a new register</option>' + opts
      +   '</select>'
      + '</div></div>').join('');
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
      /* ⛔ THE REGISTERS ARE SAVED; THE FIGURES ARE NOT. Setting a register up is the operator's own
         deliberate answer to a question Bar Cop asked, and `buildCash` resolves `drawer_id` off
         `sc_drawers` — so the confirm screen cannot describe a truthful outcome until they exist
         (door 5's rule, from the other end). Only the over/short figures wait for the button, which
         is exactly what this door's own cancel message has said for months. */
      return this._openCashReview(this._pendingCashRows);
    } finally {
      this._applyingCashMap = false;
      const b = document.getElementById('sc-cm-go');
      if (b) b.disabled = false;
    }
  },
  // ── The cash confirm screen — DOOR 14 (2026-08-08) ──────────────────────────
  /* THE SAME FIVE PIECES EVERY CONVERTED DOOR HAS:
       1 the pure walk    `PosIngest.build('cash', rows)` + `cashReviewRows`
       2 open the review  stamps `_rid` per row, so Remove has a key that survives a removal
       3 the summary      filters removed, re-walks, maps to shell rows
       4 the panel        `ImportConfirm.panel`, whose lead names the BUTTON'S OWN verb
       5 the press        one guard, then `_commitCash` with `{ reviewed: true }`

     ⛔ THE REGISTER STEP STAYS IN FRONT OF THIS SCREEN, AND THAT IS NOT AN OVERSIGHT. `buildCash`
     resolves `drawer_id` off `sc_drawers`, and every verdict here hangs off it: the dedupe key, the
     hand-count match, the whole-day totals guard. A walk run before the registers exist would
     describe an outcome the write will not produce. So the map-or-add prompt is answered first and
     its registers are saved; only the OVER/SHORT FIGURES wait for the button.

     ⛔ SECTIONED, NOT `flat`, WHICH IS THE OPPOSITE ANSWER TO THE SALES SCREEN ONE STEP ABOVE — same
     rule, different door. Sales opts out because a week is SEVEN DAYS read Monday to Sunday, a bound
     the calendar sets. A cash report is one row per register per day, so its length is the bar's own
     register count times seven and nothing bounds it: four registers is 28 rows, eight is 56, and
     the button then sits under all of them. Measured on the real 30-row first drop: 26 going in,
     4 left out, and the operator sees two counted heads and a button instead of three screens of
     table. */
  cashReviewRows(built, opts) {
    opts = opts || {};
    const useFile = opts.useFile || {};      // conflict key -> the operator chose the file
    const removed = opts.removed || {};      // row key -> taken out of this import
    /* Ten outcomes, ten sentences. Merging any two is how an operator reads "already logged" over a
       corrected drawer report that WAS written, or is sent to fix a date column on a line that is
       the file's own total. `replaced` is the one this lane needed of its own: on the hours and tips
       lanes a duplicate is SKIPPED, here it is an upsert that LANDS carrying the superseded row's id.
       ⚠ INSIDE the function, like the sales door's `NOTE` and for the same reason: written as a
       sibling data property it is invisible to every slicer in the harness suite (they all lift
       METHODS by name), so a stub reads `undefined` and the lifted body throws on its first row —
       which looks exactly like a real defect ([[the-loop]] #16). */
    const NOTE = {
      summary:      'Your file\'s own totals line, not a register',
      undated:      'Could not read the date on this row',
      incomplete:   'No over/short figure Bar Cop could use',
      dayTotal:     'Whole-day total, the register rows cover it',
      repeat:       'Same line twice in your file',
      kept:         'Counted by hand, and the file agrees',
      extraDropped: 'Already counted from an earlier row',
      replaced:     'Replacing the figures already imported',
      'new':        'Adding this drawer count'
    };
    /* ⛔ THE SPELLINGS ARE THE VARIANCE LOG'S OWN, read off `sc-cash-history`: the date is
       "Aug 10, 2026", expected and counted go through `App.fmtCurrency`, a figure Bar Cop does not
       have is a DASH (never $0.00 — that reads as an empty drawer for a register that took $900),
       and the over/short carries its sign OUTSIDE the dollar sign through `App.fmtBal`. These
       records land in that log; one quantity must not get two spellings between the screen that adds
       it and the screen that shows it.
       ⚠ THE READABILITY TEST IS THE BUILDER'S, NOT `new Date`'s. `v.date` is what the walk decided,
       and only a row it could read gets formatted — `new Date('Week of 8/10')` does NOT return NaN,
       so formatting the raw cell would turn an unreadable date into a confident wrong one. That
       exact trap cost the labor lanes a round. */
    const money = v => (v == null ? '&mdash;' : App.fmtCurrency(v));
    const overShort = v => (v == null ? '&mdash;'
      : (App.fmtSigned(v, 2).sign > 0 ? '+' : '') + App.fmtBal(v));
    const dayLabel = ymd => {
      const d = new Date(String(ymd).length <= 10 ? ymd + 'T00:00:00' : ymd);
      return isNaN(d.getTime()) ? String(ymd)
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const rows = [];
    (built.perRow || []).forEach((v, i) => {
      const key = (v.raw && v.raw._rid != null) ? v.raw._rid : i;
      if (removed[key]) return;
      const st = v.status, raw = v.raw || {}, conf = v.conflict || {};
      const needsYou = st === 'conflict';
      const chose = needsYou && !!useFile[conf.key];
      const lands = st === 'new' || st === 'replaced' || chose;
      /* WHICH FIGURES THE ROW SHOWS, and every branch is the row telling the truth about itself:
           conflict  the FILE's, with the operator's own underneath ONLY where they differ;
           kept      the SAVED figures — the note says the file agrees with them, so the saved
                     record IS the file's figures (door 2's rule for `same` / `kept`);
           has a rec the record's, because that is what a press would store — and for a `repeat` or
                     an `extraDropped`, the record it duplicates, which is what the file holds;
           the rest  the file's own cells, parsed and never re-derived. A non-landing row printed
                     over three dashes reads as "there was no figure", which is the finding the
                     labor lanes paid for over a file that plainly said 7.50. */
      let expC, cntC, osC;
      if (needsYou) {
        const mine = conf.mine || {}, theirs = conf.theirs || {};
        expC = ImportConfirm.compare(money(theirs.expected_cash),
          mine.expected_cash == null ? null : money(mine.expected_cash));
        cntC = ImportConfirm.compare(money(theirs.counted_cash),
          mine.counted_cash == null ? null : money(mine.counted_cash));
        osC = ImportConfirm.compare(overShort(theirs.variance),
          mine.variance == null ? null : overShort(mine.variance));
      } else {
        const src = st === 'kept' ? (v.prior || null) : (v.rec || null);
        if (src) {
          expC = money(src.expected_cash == null ? null : Number(src.expected_cash));
          cntC = money(src.counted_cash == null ? null : Number(src.counted_cash));
          osC = overShort(src.variance == null ? null : Number(src.variance));
        } else {
          expC = money(App.parseNum(raw.expected));
          cntC = money(App.parseNum(raw.counted));
          osC = overShort(App.parseNum(raw.over_short));
        }
      }
      rows.push({
        cells: [
          v.drawer ? esc(v.drawer) : '&mdash;',
          v.date ? esc(dayLabel(v.date)) : (raw.date ? esc(String(raw.date)) : '&mdash;'),
          expC, cntC, osC
        ],
        note: needsYou ? (chose ? 'Using the file' : 'Keeping the count you entered') : (NOTE[st] || ''),
        notes: [],
        lands: lands,
        // ⛔ A register-day the file disagrees with is the only row here that needs the operator, so
        // it is never dimmed. The shell owns that rule, for every door.
        needsYou: needsYou,
        key: key,
        decision: needsYou ? this._cashConflictHTML(v, chose) : ''
      });
    });
    return { rows: rows, count: rows.filter(r => r.lands).length };
  },
  /* Keep Mine / Use The File, on the row — the control the sales door and `r-server-check` already
     use, for the reason in [[user-chooses-conflicts]]: Bar Cop never picks between two figures the
     operator entered themselves. Default is KEEP YOUR OWN, and the answer is STORED, not applied,
     so nothing is written until Add. */
  _cashConflictHTML(v, useFile) {
    const k = esc(String((v.conflict || {}).key || ''));
    const btn = (val, label, on) => '<button type="button" class="btn ' + (on ? 'btn-primary' : 'btn-ghost')
      + ' btn-sm" data-cashconf="' + k + '" data-use="' + val + '">' + label + '</button>';
    // ⚠ `.row-actions` right-aligns by default. These answer the sentence directly above them, so
    // they line up with it — the same correction the sales row needed.
    return '<div class="row-actions" style="justify-content:flex-start;margin-top:6px;">'
      + btn('mine', 'Keep Mine', !useFile) + btn('file', 'Use The File', useFile) + '</div>';
  },

  /* ⛔ `_rid` IS STAMPED ON THE RAW ROW and read back by the mapper. Without a stable key, Remove is
     keyed on array position — and position moves the moment a row is removed, so the second Remove
     takes a different row than the one clicked. */
  _openCashReview(rows) {
    (rows || []).forEach((r, i) => { if (r && r._rid == null) r._rid = 'cr' + i; });
    this._cashReview = { rows: (rows || []).slice(), open: {}, removed: {}, useFile: {} };
    this._openStep = 'cash';
    this.render(this.container, this.actions);
  },

  /* ⛔⛔ RE-WALKED ON EVERY RENDER OVER THE ROWS NOT REMOVED, and that is deliberate: the walk is the
     ONE place a row's outcome is decided, so the screen and the write cannot disagree. Doors 6 and 7
     both had to FREEZE a file-level verdict for exactly this. MEASURED here rather than assumed —
     removing each row of the real 30-row file in turn moves only two things, and both follow the
     operator's own action:
       - removing the FIRST of two identical lines promotes the second from `repeat` to `new`, which
         is right: they took out the duplicate;
       - removing every NAMED row on a date promotes that date's blank-register line from `dayTotal`
         to the day's only count — which is that guard's whole purpose (never double-count a day the
         per-register rows already cover), and the day totals the same money either way.
     Block M of `verify-cash-import-review.js` pins both, and pins that nothing else moves. */
  _cashReviewSummary() {
    const r = this._cashReview;
    if (!r) return { rows: [], count: 0 };
    const live = r.rows.filter(x => !r.removed[x._rid]);
    return this.cashReviewRows(PosIngest.build('cash', live), { removed: {}, useFile: r.useFile });
  },
  /* The rows the operator took out, built by a SEPARATE walk over only those rows — so a removed
     duplicate stops blocking the row behind it. Their verdicts are meaningless and are never read;
     only their cells are, which is all the "Removed" section shows. */
  _cashReviewRemoved() {
    const r = this._cashReview;
    if (!r) return [];
    const gone = r.rows.filter(x => r.removed[x._rid]);
    if (!gone.length) return [];
    return this.cashReviewRows(PosIngest.build('cash', gone), { removed: {}, useFile: {} }).rows;
  },

  cashReviewHTML() {
    const r = this._cashReview || { open: {} };
    const s = this._cashReviewSummary();
    const n = s.rows.length;
    const nConf = s.rows.filter(x => x.needsYou).length;
    /* ⚠ THE LEAD NAMES THE BUTTON'S OWN VERB, never a hardcoded word. Both lead sentences on the
       sales door still said "press Import" after Kyle renamed that button to Add, and survived the
       rename in silence — the screen would have pointed at a button that is not on it.
       ⚠ EACH PLURAL NAMES ITS OWN COLLECTION: `n` is rows read out of the file, `nConf` is
       register-days needing a call, and the button counts what will be written. Three numbers. */
    const lead = nConf
      ? 'Bar Cop read ' + n + ' row' + (n === 1 ? '' : 's') + ' out of this file. '
        + (nConf === 1 ? 'One register-day you' : nConf + ' register-days you')
        + ' counted by hand and the file disagrees, so pick which figures to keep. '
        + 'Nothing is saved until you add them.'
      /* ⛔ NO CLAIM ABOUT WHAT THE ROWS ARE. This read *"out of this file, one per register per day"*
         — a description of what a cash report is SUPPOSED to be, printed over a screen that is at
         that moment showing a repeated line, a whole-day total and the file's own TOTAL row. Door 11
         shipped the same shape (*"Every row from your file is here"* on the one door that folds) and
         Kyle caught it on the walk. The Register column and the rows say what each one is; the lead
         does not need to promise it. */
      : 'Bar Cop read ' + n + ' row' + (n === 1 ? '' : 's')
        + ' out of this file. Check them, then add them. '
        + 'Nothing is saved until you do.';
    return ImportConfirm.panel({
      label: 'Check your cash report',
      lead: lead,
      columns: [{ label: 'Register', width: 20 }, { label: 'Date', width: 14 },
                { label: 'Expected', width: 12 }, { label: 'Counted', width: 12 },
                { label: 'Over / Short', width: 13 }],
      outcomeLabel: 'What Happens',
      rows: s.rows,
      removedRows: this._cashReviewRemoved(),
      removable: true,
      verb: 'Add', noun: 'Reconcile', nounPlural: 'Reconciles',
      open: r.open,
      goAttr: 'data-cashreview-go', backAttr: 'data-cashreview-back', backLabel: 'Start Over',
      resultId: 'sc-ck-cash-res',
      busy: !!this._cashReviewWriting
    });
  },

  /* One press, one import. The button is rebuilt by every re-render, so a flag on the screen object
     is the only thing a re-render cannot hand back ([[the-loop]] #85). */
  async _runCashReview() {
    const r = this._cashReview;
    if (!r || this._cashReviewWriting) return;
    this._cashReviewWriting = true;
    const btn = this.container && this.container.querySelector('[data-cashreview-go]');
    if (btn) { btn.disabled = true; btn.textContent = 'Adding...'; }
    try {
      await this._commitCash(r.rows.filter(x => !r.removed[x._rid]),
        { reviewed: true, useFile: r.useFile });
    } finally {
      this._cashReviewWriting = false;
      /* ⛔ ONLY THE SUCCESS PATH CLEARS THE SCREEN, and `_commitCash` is what clears it — a refused
         write keeps every answer so the operator can press again without re-dropping the file. Do
         NOT re-render here: the failure path writes into the shell's result slot and a re-render
         would destroy the only message saying what happened. */
      if (this._cashReview) {
        const b = this.container && this.container.querySelector('[data-cashreview-go]');
        if (b) { b.disabled = false; b.textContent = ImportConfirm.goLabel(this._cashPanelOpts()); }
      }
    }
  },
  // The label comes from the SHELL, never a second copy of its rule — the reference door once
  // relabelled its own button in place to something `ImportConfirm.panel` would never render.
  _cashPanelOpts() {
    return { rows: this._cashReviewSummary().rows, verb: 'Add', noun: 'Reconcile', nounPlural: 'Reconciles' };
  },

  // opts.reviewed = the operator has already seen every outcome row by row and accepted it, so the
  // conflict answers come off the rows and the success line drops back to its headline.
  async _commitCash(rows, opts) {
    opts = opts || {};
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
    const slot = () => document.getElementById('sc-cm-err') || this._cashPanelSlot();
    const fail = m => { const el = slot(); if (el) el.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">' + m + '</div>'; };
    const note = m => { const el = slot(); if (el) el.innerHTML = '<div style="font-size:13px;color:var(--t2);margin-top:12px;">' + m + '</div>'; };
    // A conflict: the file disagrees with a drawer the operator counted BY HAND. Ask which wins
    // before writing ([[user-chooses-conflicts]]) — Bar Cop never picks between two figures the
    // operator entered themselves. A file that MATCHES the hand count is kept silently (keptManual).
    const extra = []; let usedTheirs = 0;
    /* ⛔⛔ ON THE REVIEWED PATH THE ANSWER IS ALREADY ON THE ROW, SO THE MODAL MUST NOT FIRE. Asking
       twice for one decision is the shape door 2 removed from this app: the confirm screen shows both
       sets of figures with Keep Mine / Use The File, and `opts.useFile` is what the operator chose.
       ⚠ `App.promptImportConflicts` STAYS — `_commitCash` is called directly by seven harnesses and
       the per-server door still uses the helper, so this is a branch, not a retirement. */
    if (opts.reviewed) {
      const chose = opts.useFile || {};
      (conflicts || []).forEach(c => { if (chose[c.key]) { extra.push(c.useRec); usedTheirs++; } });
    } else if (conflicts && conflicts.length) {
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
    /* ⛔ THE SCREEN CLEARS ON SUCCESS AND ONLY ON SUCCESS. `_cashReview` surviving a refusal is what
       says the write did not land — it keeps every conflict answer and every Remove so the operator
       can press again without re-dropping the file. Clearing it unconditionally would hand them a
       page that looks finished over rows that never saved. */
    if (opts.reviewed) this._cashReview = null;
    this._flashZone = 'cash';
    /* ⛔ ONCE A DOOR HAS A CONFIRM SCREEN, ITS SUCCESS LINE IS THE HEADLINE ALONE. Every clause below
       was written when the drop wrote straight through and this sentence was the operator's ONLY
       account of it; they have now read all of it row by row and pressed Add. Kyle, on the sales
       door: *"all that green text is very hard to read and follow.. it is just repeating what the
       user just saw on screen and confirmed by adding."*
       ⛔ THE PRECONDITION IS THAT EVERY CLAUSE IS ALREADY ON THE SCREEN, and it was checked one at a
       time: replaced, used-the-file, kept, an extra row for a counted register-day, a whole-day
       totals line, no over/short, an unreadable date, a repeated line — and the file's own TOTAL
       row, which had no home anywhere until this screen. Dropping a clause before its fact is on
       the screen is losing information, not repeating less. */
    const outcomes = opts.reviewed ? ''
      : ((dupCount ? ' (' + dupCount + ' replaced earlier figures)' : '')
        + (usedTheirs ? ' (' + usedTheirs + ' used the file over your hand count)' : '')
        + (kept ? ' (' + kept + ' hand count' + (kept === 1 ? '' : 's') + ' kept)' : '')
        + extraNote + totalsNote
        // ⚠ A skipped cash row is a register-day with NO over/short at all (S105). Silence let the
        // operator read "4 reconciles imported" off a 6-row file and believe the week was counted.
        + (skipped.length ? ' (' + skipped.length + ' row' + (skipped.length === 1 ? '' : 's')
            + ' skipped, no over/short figure)' : '') + undatedNote);
    this._flash = allToAdd.length + ' reconcile' + (allToAdd.length === 1 ? '' : 's') + ' imported'
      + outcomes + '.';
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
      /* The one decision the sales confirm screen asks, answered ON THE ROW rather than in a modal
         stacked on top of the write. Writes state and re-renders, so the button count, the row and
         what gets written all read from the same place ([[user-chooses-conflicts]]). */
      const sconf = ev.target.closest('[data-salesconf]');
      if (sconf && this._salesReview) {
        const key = sconf.dataset.salesconf;
        if (sconf.dataset.use === 'file') this._salesReview.useTheirs[key] = true;
        else delete this._salesReview.useTheirs[key];
        this.render(this.container, this.actions); return;
      }
      if (ev.target.closest('[data-salesreview-go]')) { this._runSalesReview(); return; }
      /* ── The cash confirm screen's own controls. They come BEFORE the step handlers because none
         of those is on screen while a review is up, and the section heads share the shell's
         `data-confirm-section` hook with every other converted door. */
      if (this._cashReview) {
        const sec = ev.target.closest('[data-confirm-section]');
        if (sec) {
          const k = sec.dataset.confirmSection;
          // `needs` defaults OPEN, so its toggle is inverted — the shell's own convention, written
          // generically so a new section key (`notgoing`, `removed`) needs no line here.
          this._cashReview.open[k] = (k === 'needs') ? (this._cashReview.open[k] === false) : !this._cashReview.open[k];
          this.render(this.container, this.actions); return;
        }
        const rm = ev.target.closest('[data-confirm-remove]');
        if (rm) { this._cashReview.removed[rm.dataset.confirmRemove] = true; this.render(this.container, this.actions); return; }
        /* ⛔ REMOVE IS REVERSIBLE. Every other control here is, right up to the button, under a
           sentence reading "Nothing is saved until you do" — Remove was the one that destroyed, and
           the only way back was Start Over, which drops the file. */
        const rs = ev.target.closest('[data-confirm-restore]');
        if (rs) { delete this._cashReview.removed[rs.dataset.confirmRestore]; this.render(this.container, this.actions); return; }
        /* The row's own conflict answer. Default is KEEP MINE and it stays that way unless the
           operator picks the file — the answer is STORED, not applied, so nothing is written until
           Add, and the button's count, the row and the write all read from this one place. */
        const cc = ev.target.closest('[data-cashconf]');
        if (cc) {
          const key = cc.dataset.cashconf;
          if (cc.dataset.use === 'file') this._cashReview.useFile[key] = true;
          else delete this._cashReview.useFile[key];
          this.render(this.container, this.actions); return;
        }
      }
      if (ev.target.closest('[data-cashreview-go]')) { this._runCashReview(); return; }
      if (ev.target.closest('[data-cashreview-back]')) {
        // Back to the drop zone, not out of the step. A mapping belongs to the file it was made for,
        // so the file is re-dropped from scratch — nothing was written to undo.
        // ⚠ AND THE PAGE COMES BACK WITH IT. The carried mapper is spent once its rows have gone to
        // the confirm screen, so leaving the takeover set would re-attach a dead node over the step.
        this._cashReview = null; this._pendingCashRows = null;
        this._clearTakeover(); this.render(this.container, this.actions); return;
      }
      if (ev.target.closest('[data-salesreview-back]')) {
        // Back to the drop zone, not out of the step. A mapping belongs to the file it was made
        // for, so the file is re-dropped from scratch — nothing was written to undo.
        // ⚠ AND THE PAGE COMES BACK WITH IT. The carried mapper is spent once its rows have gone to
        // the confirm screen, so leaving the takeover set would re-attach a dead node over the step.
        this._salesReview = null; this._clearTakeover(); this.render(this.container, this.actions); return;
      }
      /* ⚠ NO SECOND CANCEL HERE, DELIBERATELY. I rendered one under the mapper and Kyle caught it on
         the first walk: CSVMapper already draws its own beside Import, so the page had two. The
         mapper's own is the one that stays, and it releases the page through `_onMapState('drop')`
         — the same single path a completed import uses. */
      const opt = ev.target.closest('[data-opt]');
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
