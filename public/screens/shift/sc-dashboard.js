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

  showHowTo() {
    App.showHelpModal('How the Weekly Close Works', [
      { p: ['This is your weekly close-out for Shift. You land on the week, see how far along you are, and work the steps top to bottom. The current step opens right here as a workspace, so you do the quick things without leaving the page. When the week is done it reads "You\'re current this week."'] },
      { h: 'The Steps', p: ['1. Import this week\'s sales: drop your weekly POS sales-by-day report (one row per day) and Bar Cop reads the whole week at once. 2. Reconcile cash: drop your POS cash report, or reconcile each drawer by hand in Cash Control if your POS does not make one. 3. Log exceptions: waste, spills, and walked tabs, off your sheet. 4. Review loss flags: cash shorts, voids, and comps worth a look.'] },
      { h: 'Working A Step', p: ['Click a step to open it. The import runs right on the page. The others either do the quick part here or send you to the full screen and come back. Mark a step done and the bar advances. The week selector at the top steps you to a prior week to close it out.'] },
      { h: 'The Bottom Strip', p: ['Once the week is in, the strip shows your revenue, voids, and cash over/short at a glance. Below it, the as-needed jobs (Spot Check, Maintenance, Checklists) are one tap away whenever you need them, not part of the weekly flow.'] }
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
  _doneKey() { return 'sc_cockpit_done_' + this.weekEnd(); },
  doneMap()  { try { return JSON.parse(localStorage.getItem(this._doneKey()) || '{}'); } catch (e) { return {}; } },
  setDone(step, val) { const m = this.doneMap(); m[step] = val; try { localStorage.setItem(this._doneKey(), JSON.stringify(m)); } catch (e) {} },

  // A step is done if it carries an explicit operator stamp (true/false in the
  // done map, so a step can be UNMARKED), otherwise it falls back to what the
  // week's data shows (sales imported, a drawer reconciled).
  stepDone() {
    const dm = this.doneMap();
    const derive = {
      import: false,   // operator-marked (or set by a cockpit import); a few imported days should not auto-complete the week
      cash:   this.variances().some(v => this.inWeek(v.date)),
      exc:    false,
      review: false
    };
    const r = {};
    this.ORDER.forEach(k => { r[k] = (dm[k] != null) ? !!dm[k] : derive[k]; });
    return r;
  },

  ORDER: ['import', 'cash', 'exc', 'review'],
  // Compact step summary for the Hub Shift card; mirrors this page exactly.
  hubSteps() {
    const sv = this._weekEnd; this._weekEnd = (App.nextSunday ? App.nextSunday() : App.todayLocal());
    try {
      const done = this.stepDone();
      const steps = this.ORDER.map(k => ({ key: k, label: this._META[k].title, done: !!done[k] }));
      const wkS = this.shifts().filter(s => this.inWeek(s.date));
      const rev = wkS.reduce((t, s) => t + (s.total_revenue || 0), 0);
      const voidTot = this.voidComps().filter(r => this.inWeek(r.date) && r.type === 'Void').reduce((t, r) => t + (r.amount || 0), 0);
      const netVar = this.variances().filter(v => this.inWeek(v.date)).reduce((t, v) => t + (v.variance || 0), 0);
      const stats = [
        { label: 'Revenue', value: App.fmtCurrency(rev) },
        { label: 'Voids', value: App.fmtCurrency(voidTot) },
        { label: 'Over / Short', value: (netVar > 0 ? '+' : '') + App.fmtCurrency(netVar), warn: netVar < 0 }
      ];
      return { steps, stats, doneCount: steps.filter(s => s.done).length, total: steps.length };
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
      + (wys.hasSales ? this.whereYouStand(wys) : '')
      + this.getStartedBox()
      + this.banner(doneCount, this.ORDER.length)
      + (flash ? '<div style="font-size:12px;color:var(--green);font-weight:700;margin:12px 2px 0;">&#10003; ' + esc(flash) + '</div>' : '')
      + '<div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">'
      +   this.ORDER.map(k => this.stepRow(k, done)).join('')
      + '</div>'
      + this.outlierStrip()
      + '</div>';

    if (this._openStep === 'import') this.mountImport();
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
      + '<div class="sc-step-head" data-step="' + k + '" style="display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;">'
      +   circle
      +   '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--t1);">' + m.title + '</div>'
      +     '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + this.stepStatus(k, isDone) + '</div></div>'
      +   '<span style="color:var(--t3);font-size:13px;flex-shrink:0;">' + (isOpen ? '&#9652;' : '&#9662;') + '</span>'
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
  workspace(k, isDone) {
    this._isDone = isDone;
    if (k === 'import') {
      return '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">One file, the whole week. Pull your sales-by-day report from your POS for this week and drop it below. Re-importing replaces the days already in. Mark this done once the week is fully in.</div>'
        + '<div id="sc-ck-import"></div><div id="sc-ck-import-res"></div>'
        + '<div id="sc-ck-import-btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' + this.markBtn('import', 'Mark Done') + '</div>';
    }
    if (k === 'cash') {
      return '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">Get this week\'s cash over/short in. If your POS makes a cash or drawer report, drop it here. No report? Reconcile your drawers in Cash Control. Mark this done once it is handled, or if you do not track cash over/short.</div>'
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
    return line('Cash shorts this week', String(shorts), shorts > 0)
      + line('Drawers out of tolerance', String(oot), oot > 0)
      + line('Voids', App.fmtCurrency(voidTot), false)
      + line('Comps', App.fmtCurrency(compTot), false)
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">'
      + '<button class="btn btn-ghost btn-sm" data-go="theft-risk">Open Loss Prevention</button>'
      + this.markBtn('review', 'Mark Reviewed') + '</div>';
  },

  // ── Where You Stand state (the week's floor headline + reads) ────────────────
  _wys() {
    const wkS = this.shifts().filter(s => this.inWeek(s.date));
    const rev = wkS.reduce((t, s) => t + (parseFloat(s.total_revenue) || 0), 0);
    const covers = wkS.reduce((t, s) => t + (s.covers || 0), 0);
    const checkAvg = covers > 0 ? rev / covers : null;
    const wkVC = this.voidComps().filter(r => this.inWeek(r.date));
    const voidTot = wkVC.filter(r => r.type === 'Void').reduce((t, r) => t + (r.amount || 0), 0);
    const compTot = wkVC.filter(r => r.type === 'Comp').reduce((t, r) => t + (r.amount || 0), 0);
    const netVar = this.variances().filter(v => this.inWeek(v.date)).reduce((t, v) => t + (v.variance || 0), 0);
    return { wkS, rev, covers, checkAvg, voidTot, compTot, netVar, days: wkS.length, hasSales: wkS.length > 0 };
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
      +   mini('Cash Over / Short', (st.netVar > 0 ? '+' : '') + App.fmtCurrency(st.netVar, 0), st.netVar < 0 ? 'var(--red)' : 'var(--t1)') + vdiv
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
  showInsights() {
    if (App.demoBlock && App.demoBlock('Bar Cop Briefing')) return;
    const st = this._wys();
    if (!st.hasSales) { DashUI.insightsModal('Bar Cop Briefing', 'Import a week of sales and Bar Cop can read your floor week for you.'); return; }
    const rec = DashUI._insRec('shift');
    if (rec && DashUI._insFresh(rec)) { DashUI.insightsModal('Bar Cop Briefing', rec.html, rec.generated_at); return; }
    const prompt = this._insPrompt(st);
    const btn = this.container.querySelector('[data-insights]');
    const orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.style.opacity = '0.65'; btn.style.cursor = 'not-allowed'; btn.textContent = 'Analyzing...'; }
    const restore = label => { if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; btn.textContent = label || orig || 'Bar Cop Briefing'; } };
    fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }) })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        if (data.error) { DashUI.insightsModal('Bar Cop Briefing', 'Could not read your floor right now: ' + esc(data.error.message || 'try again.')); restore('Try Again'); return; }
        const text = data.content && data.content[0] && data.content[0].text;
        if (!text) { DashUI.insightsModal('Bar Cop Briefing', 'No response came back. Try again.'); restore('Try Again'); return; }
        const clean = text.replace(/—/g, ', ').replace(/–/g, '-').replace(/ -- /g, ', ').replace(/--/g, '-');
        const safe = clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n\n/g, '</p><p style="margin:12px 0 0;">');
        const html = '<p style="margin:0;">' + safe + '</p>';
        DashUI.insightsModal('Bar Cop Briefing', html, DashUI._insSave('shift', html));
        restore();
      })
      .catch(err => { DashUI.insightsModal('Bar Cop Briefing', 'Connection error: ' + esc(err.message) + '. Check your connection and try again.'); restore('Try Again'); });
  },

  _insPrompt(st) {
    const m = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');
    const wkVar = this.variances().filter(v => this.inWeek(v.date));
    const shorts = wkVar.filter(v => v.status === 'Short').length;
    const oot = wkVar.filter(v => v.status === 'Over' || v.status === 'Short').length;
    const waste = this.waste().filter(r => this.inWeek(r.date)).length;
    const walked = this.walkedTabs().filter(r => this.inWeek(r.date)).length;
    const facts = [
      'Sales this week (actual, from sales import): ' + m(st.rev) + ' across ' + st.days + ' day' + (st.days === 1 ? '' : 's'),
      'Covers this week: ' + st.covers,
      'Check average: ' + (st.checkAvg != null ? m(st.checkAvg) : 'n/a, no covers entered'),
      'Cash over/short this week (net): ' + (st.netVar > 0 ? '+' : '') + m(st.netVar),
      'Cash shorts this week: ' + shorts,
      'Drawers out of tolerance: ' + oot,
      'Voids this week: ' + m(st.voidTot),
      'Comps this week: ' + m(st.compTot),
      'Waste/spill records logged: ' + waste,
      'Walked tabs logged: ' + walked
    ].join('\n');
    return 'You are a 30-year bar and restaurant operator writing a read for a fellow owner about the floor and register side of their bar this week. The facts below are computed from this operator\'s own data.\n\n'
      + 'Talk straight across the bar. Give the numbers as they are, the good, the bad, and the ugly, in depth and specific. Do not teach, explain the basics, lecture, or hand out pep talks. No motivational lines, nothing that talks down to the reader. You can be dry and a little funny, and you can weave in a quick bit of bar-floor storytelling so a rough number reads easy instead of stinging, but never at the operator\'s expense and never invented. No emdashes, no double dashes, no bullet points, no headers, no AI words (cadence, leverage, robust, going forward, ecosystem, synthesize, comprehensive, seamless).\n\n'
      + 'STAY TRUE TO THE FACTS:\n- Use only the facts below. Do not invent numbers.\n- If a number is not set or the week\'s sales are not imported, say so plainly instead of guessing.\n\n'
      + 'FACTS:\n' + facts
      + '\n\nWrite two or three short paragraphs: first where sales stand (revenue, covers, check average), then where money is walking (cash shorts, drawers out of tolerance, voids and comps), then the single move that matters most this week. Use the exact numbers from the facts.';
  },

  outlierStrip() {
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;">'
      + '<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-right:4px;">As needed</span>'
      + '<button class="btn btn-ghost btn-sm" data-go="sc-maintenance">Maintenance</button>'
      + '<button class="btn btn-ghost btn-sm" data-go="sc-checklists">Checklists</button>'
      + '</div>';
  },

  // Hide a step's own buttons while the column-mapper is open so they do not
  // stack under the mapper's Import/Cancel row; show them again on cancel.
  _toggleBtns(id, st) { const b = document.getElementById(id); if (b) b.style.display = (st === 'map') ? 'none' : 'flex'; },

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
  async importSales(rows) {
    const { toAdd, dupCount } = PosIngest.build('sales', rows);
    const res = document.getElementById('sc-ck-import-res');
    if (!toAdd.length) {
      if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">No days imported. Check that the file has a Date column and sales values.</div>';
      return;
    }
    const ok = await PosIngest.commit('sales', toAdd);
    if (!ok) {
      if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">Save failed. Try the import again.</div>';
      return;
    }
    if (App.markSetupDone) App.markSetupDone('gs_sc_shift');
    this.setDone('import', true);   // a cockpit import is a deliberate "the week is in" action
    this._flash = toAdd.length + ' day' + (toAdd.length === 1 ? '' : 's') + ' imported' + (dupCount ? ' (' + dupCount + ' replaced earlier figures)' : '') + '.';
    this._openStep = 'cash';
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
    this._pendingCashRows = rows;
    const drawers = ((App.shiftData && App.shiftData.sc_drawers) || []).filter(d => d.active !== false);
    const key = s => String(s || '').trim().toLowerCase();
    const known = new Set();
    drawers.forEach(d => { if (d.name) known.add(key(d.name)); (d.pos_aliases || []).forEach(a => known.add(key(a))); });
    const unmatched = [...new Set((rows || []).map(r => String(r.drawer || '').trim()).filter(Boolean))]
      .filter(n => !known.has(key(n)));

    if (unmatched.length && drawers.length === 0) {        // blank slate: create silently
      unmatched.forEach(n => this._addRegister(n));
      await App.saveShift();
      return this._commitCash(rows);
    }
    if (unmatched.length) { this._showCashMap(unmatched); return; }   // map or add
    return this._commitCash(rows);
  },
  _addRegister(name) {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_drawers)) App.shiftData.sc_drawers = [];
    App.shiftData.sc_drawers.push({ id: App.uid(), name: name, default_opening_bank: null, notes: '', active: true, pos_aliases: [], created_at: new Date().toISOString() });
  },
  _showCashMap(unmatched) {
    const res = document.getElementById('sc-ck-cash-res');
    if (!res) return;
    const drawers = ((App.shiftData && App.shiftData.sc_drawers) || []).filter(d => d.active !== false);
    const opts = drawers.map(d => '<option value="' + esc(d.id) + '">' + esc(d.name) + '</option>').join('');
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
      + '</div>';
    document.getElementById('sc-cm-go')?.addEventListener('click', () => this._applyCashMap());
  },
  async _applyCashMap() {
    const keyOf = s => String(s || '').trim().toLowerCase();
    [...document.querySelectorAll('.sc-cm-sel')].forEach(sel => {
      const name = sel.dataset.name;
      if (sel.value === '__add') { this._addRegister(name); return; }
      const d = ((App.shiftData && App.shiftData.sc_drawers) || []).find(x => x.id === sel.value);
      if (d) { if (!Array.isArray(d.pos_aliases)) d.pos_aliases = []; if (!d.pos_aliases.some(a => keyOf(a) === keyOf(name))) d.pos_aliases.push(name); }
    });
    await App.saveShift();
    return this._commitCash(this._pendingCashRows);
  },
  async _commitCash(rows) {
    const { toAdd, dupCount } = PosIngest.build('cash', rows);
    const res = document.getElementById('sc-ck-cash-res');
    if (!toAdd.length) {
      if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + (dupCount ? 'No new rows imported. ' + dupCount + ' already logged.' : 'No rows imported. Each row needs a date plus an over/short, or expected and counted cash.') + '</div>';
      return;
    }
    const ok = await PosIngest.commit('cash', toAdd);
    if (!ok) { if (res) res.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">Save failed. Try the import again.</div>'; return; }
    this._pendingCashRows = null;
    this._flash = toAdd.length + ' reconcile' + (toAdd.length === 1 ? '' : 's') + ' imported' + (dupCount ? ' (' + dupCount + ' already logged)' : '') + '.';
    this._openStep = 'exc';
    this.render(this.container, this.actions);
  },

  // ── Wiring ───────────────────────────────────────────────────────────────────
  wire() {
    this.container.onclick = ev => {
      if (ev.target.closest('[data-insights]')) { this.showInsights(); return; }
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
