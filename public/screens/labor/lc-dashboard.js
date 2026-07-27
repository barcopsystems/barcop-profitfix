'use strict';

/* ── Labor Control — Close The Week (landing screen) ──────────────────────────
   Not a stack of status cards. A guided weekly close-out, same pattern as the
   Shift cockpit: a "CLOSE OUT YOUR WEEK" banner with a week-stepper, a progress
   bar, and the week's steps top to bottom. The current step opens inline as a
   workspace (the hours/tips imports run right here); deeper work (Build Schedule,
   Overtime Watch) launches out. A status strip and "As needed" outliers sit at
   the bottom. Per-week step-done stamps live in localStorage. */

S.LaborDashboard = {
  _weekStart: null,   // Monday of the selected week
  _openStep: null,
  _flash: null,

  showHowTo() {
    App.showHelpModal('How the Weekly Close Works', [
      { p: ['This is your weekly close-out for Labor. You land on the week, see how far along you are, and work the steps top to bottom. The current step opens right here as a workspace, so you do the quick things without leaving the page. When the week is done it reads "You\'re current this week."'] },
      { h: 'The Steps', p: ['1. Import this week\'s hours: drop your timeclock export and Bar Cop matches the hours to your roster. 2. Log this week\'s tips: drop a tips export, or enter them in Tip Tracking. 3. Build next week\'s schedule: set next week\'s shifts and labor budget in Build Schedule. 4. Review labor flags: overtime risk, uncovered call-outs, and expiring certifications worth a look.'] },
      { h: 'Working A Step', p: ['Click a step to open it. The hours and tips imports run right on the page. Build Schedule and Overtime Watch open the full screen and come back. Mark a step done and the bar advances; mark it not done to reopen it. The week selector at the top steps you back to a prior week to close it out.'] },
      { h: 'The Bottom Strip', p: ['Once hours are in, the strip shows the week\'s labor cost, hours, and overtime risk at a glance. Below it, the as-needed jobs (Staff Roster, Call-Out Log, Payroll Export, Labor History) are one tap away whenever you need them, not part of the weekly flow.'] }
    ]);
  },

  // ── Data ─────────────────────────────────────────────────────────────────────
  actuals()   { return ((App.laborData && App.laborData.lc_actuals)   || []); },
  tips()      { return ((App.laborData && App.laborData.lc_tips)       || []); },
  timeOff()   { return ((App.laborData && App.laborData.lc_time_off)   || []); },
  schedules() { return ((App.laborData && App.laborData.lc_schedules)  || []); },
  staff()     { return ((App.laborData && App.laborData.lc_staff)      || []); },
  positions() { return ((App.laborData && App.laborData.lc_positions)  || []); },
  callouts()  { return ((App.laborData && App.laborData.lc_callouts)   || []); },
  certs()     { return ((App.laborData && App.laborData.lc_certs)      || []); },
  posDept(id) { const p = this.positions().find(x => x.id === id); return p ? (p.department || 'Other') : 'Unassigned'; },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  mondayOf(d) {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return App.ymdLocal(date);
  },
  addDays(dateStr, n) { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n); return App.ymdLocal(d); },

  // ── Week (Monday-based, matching lc_schedules.week_start) ────────────────────
  todayMonday()   { return this.mondayOf(new Date()); },
  weekStart()     { return this._weekStart || this.todayMonday(); },
  weekEnd()       { return this.addDays(this.weekStart(), 6); },
  nextWeekStart() { return this.addDays(this.weekStart(), 7); },
  inWeek(d)       { const s = this.weekStart(), e = this.weekEnd(); d = String(d || '').slice(0, 10); return !!d && d >= s && d <= e; },
  atCurrentWeek() { return this.weekStart() >= this.todayMonday(); },
  _stepWeek(n) {
    const next = this.addDays(this.weekStart(), n);
    if (n > 0 && next > this.todayMonday()) return;   // never into the future
    this._weekStart = next;
    this._openStep = null;
    this.render(this.container, this.actions);
  },

  // ── Per-week step-done stamps (operator-controlled, local to the device) ─────
  _doneKey() { return 'lc_cockpit_done_' + this.weekStart(); },   // account-synced (App.data), follows the user across devices; no per-browser suffix
  doneMap()  { return App.acctGet(this._doneKey(), {}); },
  setDone(step, val) { const m = { ...this.doneMap() }; m[step] = val; App.acctSet(this._doneKey(), m); },

  ORDER: ['hours', 'tips', 'schedule', 'review'],
  // Compact step summary for the Hub Labor card; mirrors this page exactly.
  hubSteps() {
    const sv = this._weekStart; this._weekStart = this.todayMonday();
    try {
      const done = this.stepDone();
      const steps = this.ORDER.map(k => ({ key: k, label: this._META[k].title, done: !!done[k] }));
      const wkStart = this.weekStart(), wkEnd = this.weekEnd();
      const today = App.todayLocal();
      const endCap = wkEnd < today ? wkEnd : today;
      const wkActuals = this.actuals().filter(a => a.date >= wkStart && a.date <= wkEnd);
      const wkHours = wkActuals.reduce((t, a) => t + (a.hours || 0), 0);
      const salCost = (App.salariedCost ? App.salariedCost(wkStart, endCap).total : 0) || 0;
      const otPrem = App.otPremiumForRows ? App.otPremiumForRows(wkActuals).total : 0;   // 0.5x over 40/wk, not stored in a.cost
      const wkCost = wkActuals.reduce((t, a) => t + (a.cost || 0), 0) + salCost + otPrem;
      let otRisk = 0; try { const p = this.weekProjection(); otRisk = (p.over || 0) + (p.approaching || 0); } catch (e) {}
      const stats = [
        { label: 'Labor Cost', value: App.fmtCurrency(wkCost) },
        { label: 'Labor Hours', value: wkHours.toFixed(1) },
        { label: 'OT Risk', value: String(otRisk), warn: otRisk > 0 }
      ];
      return { steps, stats, doneCount: steps.filter(s => s.done).length, total: steps.length };
    } finally { this._weekStart = sv; }
  },
  // A step is done if it carries an explicit operator stamp, else it falls back to
  // what the week's data shows (hours logged, tips logged, next week scheduled).
  // A step is done ONLY when the operator marks it — never auto-checked off data.
  stepDone() {
    const dm = this.doneMap();
    const r = {};
    this.ORDER.forEach(k => { r[k] = !!dm[k]; });
    return r;
  },

  // ── Render ───────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container; this.actions = actions;
    if (actions) actions.innerHTML = '';
    const done = this.stepDone();
    const doneCount = this.ORDER.filter(k => done[k]).length;
    if (this._openStep == null) this._openStep = this.ORDER.find(k => !done[k]) || '';
    const flash = this._flash; this._flash = null;
    const wys = this._wys();

    container.innerHTML = '<div class="screen">'
      + (wys.hasHours ? this.whereYouStand(wys) : this.getStartedBox())
      + this.banner(doneCount, this.ORDER.length)
      + (flash ? '<div style="font-size:12px;color:var(--green);font-weight:700;margin:12px 2px 0;">&#10003; ' + esc(flash) + '</div>' : '')
      + '<div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">'
      +   this.ORDER.map(k => this.stepRow(k, done)).join('')
      + '</div>'
      + this.outlierStrip()
      + '</div>';

    if (this._openStep === 'hours') this.mountHoursImport();
    if (this._openStep === 'tips') this.mountTipsImport();
    this.wire();
  },

  // ── Get Started: setup steps above the cockpit until all four are done ───────
  getStartedBox() {
    return App.controlGetStarted('Labor', [
      // Positions come pre-seeded (STARTER_POSITIONS), so "has any position" would
      // read as done before the operator ever touched them. Key this off the setup
      // flag that only a real add/edit/delete sets, not the auto-seed.
      { num: 1, label: 'Add positions',             screen: 'lc-positions',      done: !!(App.data && App.data.hub_setup_progress && App.data.hub_setup_progress.gs_lc_positions) },
      { num: 2, label: 'Add your staff',            screen: 'lc-staff-roster',   done: this.staff().length > 0 },
      { num: 3, label: 'Build your first schedule', screen: 'lc-build-schedule', done: this.schedules().length > 0 },
      { num: 4, label: 'Log your first hours',      screen: 'lc-log-hours',      done: this.actuals().length > 0 }
    ]);
  },

  // ── Week selector: ‹ [JUN 16 - JUN 22 NOW] › ─────────────────────────────────
  weekSelector() {
    const isCur = this.atCurrentWeek();
    const fmt = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(); };
    const range = fmt(this.weekStart()) + ' - ' + fmt(this.weekEnd());
    const nowBadge = isCur ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const prevBtn = '<button class="btn btn-ghost btn-sm lc-wk-prev" aria-label="Previous week" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = isCur
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm lc-wk-next" aria-label="Next week" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + esc(range) + nowBadge + '</span>';
    const nowBtn = isCur ? '' : '<button class="btn btn-ghost btn-sm lc-wk-now" style="margin-left:4px;">This Week</button>';
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
      +   (allDone ? '' : '<div style="font-size:11px;color:var(--t3);margin-top:12px;">Have ready: your weekly timeclock export, plus a tips export if your POS makes one.</div>')
      + '</div>'
      + '</div>';
  },

  _META: {
    hours:    { n: 1, title: 'Import this week\'s hours',   sub: 'Drop your weekly timeclock export' },
    tips:     { n: 2, title: 'Log this week\'s tips',       sub: 'Drop a tips export, or enter in Tip Tracking' },
    schedule: { n: 3, title: 'Build next week\'s schedule', sub: 'Set next week\'s shifts and budget' },
    review:   { n: 4, title: 'Review labor flags',          sub: 'Overtime, call-outs, expiring certs' }
  },
  stepStatus(k, isDone) {
    if (k === 'hours') {
      const hrs = this.actuals().filter(a => this.inWeek(a.date)).reduce((t, a) => t + (a.hours || 0), 0);
      return hrs > 0 ? (hrs.toFixed(1) + ' hrs logged') : this._META.hours.sub;
    }
    if (k === 'tips') {
      const n = this.tips().filter(t => this.inWeek(t.date)).length;
      return n ? (n + ' tip entr' + (n === 1 ? 'y' : 'ies') + ' logged') : (isDone ? 'Nothing to log' : this._META.tips.sub);
    }
    if (k === 'schedule') return isDone ? 'Next week scheduled' : this._META.schedule.sub;
    if (k === 'review') return isDone ? 'Reviewed' : this._META.review.sub;
    return '';
  },
  stepRow(k, done) {
    const m = this._META[k], isDone = done[k], isOpen = this._openStep === k;
    const circle = isDone
      ? '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:13px;font-weight:800;">&#10003;</span>'
      : '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:11px;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,.45);">' + m.n + '</span>';
    const bg = isOpen ? 'var(--gold-tint)' : (isDone ? 'var(--input)' : 'var(--surface)');
    let html = '<div style="border:1px solid var(--b-edge);border-radius:var(--r);background:' + bg + ';overflow:hidden;">'
      + '<div class="lc-step-head' + (isOpen ? '' : ' collapsed') + '" data-step="' + k + '" style="display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;">'
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
    if (k === 'hours') {
      return '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">Drop your weekly timeclock export and Bar Cop matches each row to your roster and rates. Re-dropping will not double-count. No export? Log hours from your posted schedule in Log Hours.</div>'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--t3);">Timeclock hours</span>' + App.freqTag('Weekly') + '</div>'
        + '<div id="lc-ck-hours"></div><div id="lc-ck-hours-res"></div>'
        + '<div id="lc-ck-hours-btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;"><button class="btn btn-ghost btn-sm" data-go="lc-log-hours">Enter in Log Hours</button>' + this.markBtn('hours', 'Mark Done') + '</div>';
    }
    if (k === 'tips') {
      return '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">Get this week\'s tips in. If your POS makes a tips export, drop it here. No export? Enter them in Tip Tracking. Mark this done once it is handled, or if there are no tips to log.</div>'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--t3);">Tips export</span>' + App.freqTag('Weekly') + '</div>'
        + '<div id="lc-ck-tips"></div><div id="lc-ck-tips-res"></div>'
        + '<div id="lc-ck-tips-btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">'
        + '<button class="btn btn-ghost btn-sm" data-go="lc-tip-log">Enter in Tip Tracking</button>'
        + this.markBtn('tips', 'Mark Done') + '</div>';
    }
    if (k === 'schedule') {
      const built = this.schedules().some(s => s.week_start === this.nextWeekStart());
      const nwLabel = this.fmtDate(this.nextWeekStart()) + ' - ' + this.fmtDate(this.addDays(this.nextWeekStart(), 6));
      const status = built
        ? '<span style="color:var(--green);font-weight:700;">&#10003; Built</span>'
        : '<span style="color:var(--t3);">Not built yet</span>';
      return '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">Set next week\'s shifts and labor budget while this week is fresh. Build Schedule projects the cost against your forecast and flags overtime before it is logged.</div>'
        + '<div style="font-size:12px;color:var(--t2);margin-bottom:12px;">Next week (' + nwLabel + '): ' + status + '</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        + '<button class="btn btn-ghost btn-sm" data-go="lc-build-schedule">Build Schedule</button>'
        + this.markBtn('schedule', 'Mark Done') + '</div>';
    }
    // review
    const p = this.weekProjection();
    const cutoff30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return App.ymdLocal(d); })();
    const today = App.todayLocal();
    const activeIds = new Set(this.staff().filter(s => s.status !== 'Inactive').map(s => s.id));
    const uncovered = this.callouts().filter(c => this.inWeek(c.date) && !c.covered).length;
    const expiring = this.certs().filter(c => activeIds.has(c.staff_id) && c.expiration_date && c.expiration_date >= today && c.expiration_date <= cutoff30).length;
    const expired = this.certs().filter(c => activeIds.has(c.staff_id) && c.expiration_date && c.expiration_date < today).length;
    const line = (label, val, warn) => '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;font-size:12px;">'
      + '<span style="color:var(--t2);">' + label + '</span><span style="font-weight:700;color:' + (warn ? 'var(--red)' : 'var(--t1)') + ';">' + val + '</span></div>';
    const toPending = this.timeOff().filter(t => t.status === 'Requested').length;
    return line('Staff projected over ' + App.OT_THRESHOLD + ' hrs', String(p.over), p.over > 0)
      + line('Approaching overtime', String(p.approaching), p.approaching > 0)
      + line('Projected OT premium', App.fmtCurrency(p.otPremium), p.otPremium > 0)
      + line('Uncovered call-outs this week', String(uncovered), uncovered > 0)
      + line('Time-off requests to review', String(toPending), toPending > 0)
      + line('Certifications expired / expiring', expired + ' / ' + expiring, (expired + expiring) > 0)
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">'
      + '<button class="btn btn-ghost btn-sm" data-go="lc-overtime-watch">Open Overtime Watch</button>'
      + (toPending > 0 ? '<button class="btn btn-ghost btn-sm" data-go="lc-time-off">Review Time Off</button>' : '')
      + this.markBtn('review', 'Mark Reviewed') + '</div>';
  },

  // Per-staff overtime projection for the selected week: hours already WORKED plus
  // hours still SCHEDULED on days not yet worked. Same basis as Overtime Watch, which
  // this used to claim to match while actually running max(actual, scheduled) — the
  // basis Overtime Watch abandoned because it misses anyone already logging extra who
  // still has shifts to come. That gap let Close The Week and the Hub Labor card report
  // "0 staff projected over 40" and "$0 premium", and the Briefing say the schedule was
  // clean, on a week Overtime Watch was flagging the same person as Over.
  weekProjection() {
    const wkStart = this.weekStart(), wkEnd = this.weekEnd();
    const curWeek = this.actuals().filter(a => a.date >= wkStart && a.date <= wkEnd);
    // Newest wins when a week somehow carries more than one schedule, matching Overtime
    // Watch, Log Hours, Pay Periods and the Call-Out Log (all .sort(App.cmpNewest)[0]).
    // NOTE, so nobody re-derives this: rebuilding a week does NOT strand a superseded
    // record. Build Schedule's duplicate-week guard replaces in place (same id) and
    // loadWeek edits the existing one, so the single-device flow keeps exactly one
    // schedule per week_start. The narrow case this covers is two managers posting the
    // same week from different devices before a sync. Defensive and consistent, not a
    // live leak. cmpNewest resolves it through its created_at tiebreak (App._recDate
    // reads none of a schedule's fields), and a schedule gets created_at at creation
    // which an edit preserves.
    const sched = this.schedules().filter(s => s.week_start === wkStart).sort(App.cmpNewest)[0] || null;
    const proj = {};
    const ensure = (id, name) => { if (!proj[id]) proj[id] = { id, name: name || '-', actual: 0, scheduled: 0 }; return proj[id]; };
    const DAYS = App.DAYS_MON_FIRST || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    curWeek.forEach(a => {
      if (App.isSalaried(a.staff_id)) return;
      const e = ensure(a.staff_id || a.name, a.name);
      e.actual += (a.hours || 0);
      (e.workedDays = e.workedDays || {})[a.date] = true;   // this day is already logged
    });
    if (sched) (sched.shifts || []).forEach(sh => {
      if (App.isSalaried(sh.staff_id)) return;
      const e = ensure(sh.staff_id || sh.name, sh.name);
      e.scheduled += (sh.hours || 0);
      // wkStart is a Monday and DAYS is Monday-first, so the index is the day offset.
      const di = DAYS.indexOf(sh.day);
      const dt = di >= 0 ? this.addDays(wkStart, di) : null;
      if (dt) (e.schedByDate = e.schedByDate || {})[dt] = (e.schedByDate[dt] || 0) + (sh.hours || 0);
    });
    let over = 0, approaching = 0, otPremium = 0;
    Object.values(proj).forEach(e => {
      const remainingSched = Object.keys(e.schedByDate || {}).reduce((t, d) =>
        t + ((e.workedDays && e.workedDays[d]) ? 0 : e.schedByDate[d]), 0);
      const projected = e.actual + remainingSched;
      const wage = App.wageForStaffOn ? (App.wageForStaffOn(e.id, wkStart) || 0) : 0;
      const otHours = Math.max(0, projected - App.OT_THRESHOLD);
      otPremium += otHours * wage * 0.5;
      if (projected > App.OT_THRESHOLD) over++;
      else if (projected >= App.OT_APPROACHING) approaching++;
    });
    return { over, approaching, otPremium };
  },

  // Resolve the week the read shows: the current week if it has logged hours,
  // else the most recent week that does (flagged lastWk). Mirrors the Shift
  // _statWeek resolver — hours are imported weekly AFTER the week, so the current
  // week is empty mid-week even for a running bar, and the read must not fall back
  // to the Get Started card once the operator has ever logged a week.
  _statWeekStart() {
    const cur = this.todayMonday();
    const sv = this._weekStart;
    try {
      this._weekStart = cur;
      if (this.actuals().some(a => this.inWeek(a.date))) return { start: cur, lastWk: false };
      const dates = this.actuals().map(a => String(a.date || '').slice(0, 10)).filter(Boolean).sort();
      const latest = dates.length ? dates[dates.length - 1] : '';
      if (!latest) return { start: cur, lastWk: false };
      const ms = this.mondayOf(new Date(latest + 'T00:00:00'));
      return (ms && ms !== cur) ? { start: ms, lastWk: true } : { start: cur, lastWk: false };
    } finally { this._weekStart = sv; }
  },

  // ── Where You Stand state (the week's labor headline + reads) ────────────────
  _wys() {
    const p = this.weekProjection();   // OT projection stays on the real current/next week
    const sw = this._statWeekStart();
    const sv = this._weekStart;
    try {
      this._weekStart = sw.start;
      const wkStart = this.weekStart(), wkEnd = this.weekEnd();
      const today = App.todayLocal();
      const endCap = wkEnd < today ? wkEnd : today;
      const wkActuals = this.actuals().filter(a => a.date >= wkStart && a.date <= wkEnd);
      const wkHours = wkActuals.reduce((t, a) => t + (a.hours || 0), 0);
      const salCost = (App.salariedCost ? App.salariedCost(wkStart, endCap).total : 0) || 0;
      const otPrem = App.otPremiumForRows ? App.otPremiumForRows(wkActuals).total : 0;   // 0.5x over 40/wk, not stored in a.cost
      const wkCost = wkActuals.reduce((t, a) => t + (a.cost || 0), 0) + salCost + otPrem;
      // Labor % and RPLH read actual revenue for the week (sc_shifts), not a forecast,
      // so they read "-" until the week's sales are imported rather than dressing a
      // projection as actual.
      const weekRevenue = ((App.shiftData && App.shiftData.sc_shifts) || [])
        .filter(s => this.inWeek(s.date)).reduce((t, s) => t + (parseFloat(s.total_revenue) || 0), 0);
      const laborPct = weekRevenue > 0 ? (wkCost / weekRevenue * 100) : null;
      const rplh = (wkHours > 0 && weekRevenue > 0) ? (weekRevenue / wkHours) : null;
      return {
        wkStart, wkEnd, wkHours, wkCost, weekRevenue, laborPct, rplh, lastWk: sw.lastWk,
        over: p.over, approaching: p.approaching, otRisk: p.over + p.approaching, otPremium: p.otPremium,
        hasHours: wkActuals.length > 0
      };
    } finally { this._weekStart = sv; }
  },

  // ── Where You Stand (labor headline + three-stat read + Briefing) ────────────
  whereYouStand(st) {
    const target = App.laborTargetPct ? App.laborTargetPct() : 29;
    const fmtRange = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(); };
    const sub = st.hasHours
      ? st.wkHours.toFixed(1) + ' hrs logged &middot; week of ' + fmtRange(st.wkStart) + (st.lastWk ? ' <span style="color:var(--t4);">(last week)</span>' : '')
      : 'import this week\'s hours to fill this in';
    const hero = '<div style="padding:2px 0;">'
      + '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">'
      +   '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:600;line-height:0.9;color:var(--w);">' + App.fmtCurrency(st.wkCost, 0) + '</span>'
      +   '<span style="font-size:13px;color:var(--t2);">labor cost</span>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:12px;">' + sub + '</div></div>';
    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 30px;"></div>';
    const mini = (label, val, col) => '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:600;line-height:1;color:' + (col || 'var(--t1)') + ';">' + val + '</div></div>';
    const secondary = '<div style="margin-top:12px;padding-top:14px;border-top:1px solid var(--b2);">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">What This Week\'s Crew Cost You</div>'
      + '<div style="display:flex;align-items:flex-start;flex-wrap:wrap;">'
      +   mini('Labor %', st.laborPct != null ? App.fmtPct(st.laborPct) : '-', (st.laborPct != null && st.laborPct > target) ? 'var(--amber)' : 'var(--t1)') + vdiv
      +   mini('RPLH', st.rplh != null ? App.fmtCurrency(st.rplh) : '-') + vdiv
      +   mini('Overtime Risk', String(st.otRisk), st.otRisk > 0 ? 'var(--amber)' : 'var(--t1)')
      + '</div>'
      + '<div style="margin-top:14px;"><button class="btn btn-ghost btn-sm" data-go="lc-build-schedule">Build Schedule</button></div>'
      + '</div>';
    return '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span>Where You Stand</span>'
      + '<button class="btn btn-ghost btn-sm" data-insights style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Bar Cop Briefing</button></div>'
      + hero + secondary + '</div>';
  },

  // ── Bar Cop Briefing: a written read of the labor week, cached a week per
  //    section via DashUI so repeat opens do not spend on the API. ─────────────
  // Code-generated (no API): where labor stands, where it leaks, the one move.
  showInsights() {
    const st = this._wys();
    if (!st.hasHours) { DashUI.insightsModal('Bar Cop Briefing', 'Log a week of hours and Bar Cop can read your labor week for you.'); return; }
    DashUI.insightsModal('Bar Cop Briefing', this._insBriefing(st));
  },

  _insBriefing(st) {
    const m = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');
    const target = App.laborTargetPct ? App.laborTargetPct() : 29;
    const today = App.todayLocal();
    const cutoff30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return App.ymdLocal(d); })();
    const activeIds = new Set(this.staff().filter(s => s.status !== 'Inactive').map(s => s.id));
    const uncovered = this.callouts().filter(c => this.inWeek(c.date) && !c.covered).length;
    const expiring = this.certs().filter(c => activeIds.has(c.staff_id) && c.expiration_date && c.expiration_date >= today && c.expiration_date <= cutoff30).length;
    const expired = this.certs().filter(c => activeIds.has(c.staff_id) && c.expiration_date && c.expiration_date < today).length;
    const nextBuilt = this.schedules().some(s => s.week_start === this.nextWeekStart());
    const paras = [];

    // 1 — where labor stands
    let p1 = 'Labor ran ' + m(st.wkCost) + ' on ' + st.wkHours.toFixed(1) + ' hours this week. ';
    if (st.laborPct != null) p1 += 'That is ' + st.laborPct.toFixed(1) + '% of floor sales against a ' + target + '% target, ' + (st.laborPct > target ? 'over the line.' : 'inside the line.') + (st.rplh != null ? ' Revenue per labor hour is ' + m(st.rplh) + '.' : '');
    else p1 += 'Import this week\'s sales and the labor percent fills in.';
    paras.push(p1);

    // 2 — where it leaks
    const leaks = [];
    if (st.over > 0) leaks.push(st.over + ' staff projected over ' + App.OT_THRESHOLD + ' hours, about ' + m(st.otPremium) + ' in overtime premium');
    if (st.approaching > 0) leaks.push(st.approaching + ' more approaching overtime');
    if (uncovered > 0) leaks.push(uncovered + ' uncovered call-out' + (uncovered === 1 ? '' : 's') + ' this week');
    if (expired > 0 || expiring > 0) leaks.push(expired + ' expired and ' + expiring + ' expiring certification' + (expiring === 1 ? '' : 's') + ' within thirty days');
    paras.push(leaks.length ? 'Where it leaks: ' + leaks.join(', ') + '.' : 'No overtime, no uncovered shifts, and the certs are current. The schedule is clean this week.');

    // 3 — the single move
    let move;
    if (!nextBuilt) move = 'Build next week\'s schedule first, and build it to the cover forecast so the hours match the room before the week starts.';
    else if (st.over > 0) move = 'Kill the overtime before it starts. Trim the ' + st.over + ' staff over the line in Build Schedule.';
    else if (uncovered > 0) move = 'Cover the ' + uncovered + ' open shift' + (uncovered === 1 ? '' : 's') + ' now, before someone eats a double.';
    else move = 'Nothing urgent. Keep scheduling to the forecast and watch the overtime flags.';
    paras.push(move);

    return paras.map(p => '<p style="margin:0 0 12px;">' + esc(p) + '</p>').join('');
  },

  outlierStrip() {
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;">'
      + '<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-right:4px;">As needed</span>'
      + '<button class="btn btn-ghost btn-sm" data-go="lc-staff-roster">Staff Roster</button>'
      + '<button class="btn btn-ghost btn-sm" data-go="lc-payroll-export">Payroll Export</button>'
      + '</div>';
  },

  // Hide a step's own buttons while the column-mapper is open so they do not
  // stack under the mapper's Import/Cancel row; show them again on cancel.
  _toggleBtns(id, st) { const b = document.getElementById(id); if (b) b.style.display = (st === 'map') ? 'none' : 'flex'; },

  // ── Inline hours import (step 1) ─────────────────────────────────────────────
  mountHoursImport() {
    const el = document.getElementById('lc-ck-hours');
    if (!el || typeof CSVMapper === 'undefined' || typeof PosIngest === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your weekly timeclock export here',
      dropSub: 'Needs Staff, Date, and Hours. Shift matched if present. One row per shift.',
      fields: PosIngest.FIELDS.hours,
      confirmLabel: 'Import',
      onState: st => this._toggleBtns('lc-ck-hours-btns', st),
      onComplete: rows => this.importLane('hours', rows, 'lc-ck-hours-res', 'tips')
    });
  },
  // ── Inline tips import (step 2) ──────────────────────────────────────────────
  mountTipsImport() {
    const el = document.getElementById('lc-ck-tips');
    if (!el || typeof CSVMapper === 'undefined' || typeof PosIngest === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your POS tips export here',
      dropSub: 'Needs Staff and Date plus card and/or cash tips. Servers match your roster by name.',
      fields: PosIngest.FIELDS.tips,
      confirmLabel: 'Import',
      onState: st => this._toggleBtns('lc-ck-tips-btns', st),
      onComplete: rows => this.importLane('tips', rows, 'lc-ck-tips-res', 'schedule')
    });
  },
  // Shared import path: match/dedup/build/save live in PosIngest so the cockpit
  // and the per-page lanes never drift. label = 'hours' | 'tips'.
  async importLane(type, rows, resultId, nextStep) {
    /* ⚠ `fileRepeats` JOINS THE DESTRUCTURE FOR THE SAME REASON AS `incomplete` DID (S218). A line
       the file repeated verbatim is now counted ONCE — at this door that is hours into gross pay and
       tips into Form 8027, so it was the most expensive place the bug lived. A bucket no door reads
       is worse than the bug: the operator's row count stops matching Bar Cop's and nothing says why. */
    const { toAdd, skipped, incomplete, undated, dupCount, fileRepeats } = PosIngest.build(type, rows);
    const noun = type === 'hours' ? 'hour' : 'tip';
    const setRes = html => { const r = document.getElementById(resultId); if (r) r.innerHTML = html; };
    /* ⚠ ROWS WHOSE DATE COULD NOT BE READ ARE NOW REFUSED RATHER THAN WRITTEN BLANK, so they have to
       be reported — this is the one skip an operator can actually fix in the file. Before the
       builder guard they were written with `date: ''`, and since the dedup key is staff + date +
       amount, every undated row of every week shared one key: week one imported and week two
       deduped away IN FULL under "N already logged", about rows that had never been logged.
       ⚠ AND A PARTIAL SAVE IS NOT A FAILED SAVE. This door writes row by row through the generic
       commit, same as the four already closed — App.landedOf/partialSaveNote carry the contract. */
    /* ⚠ "NO ROSTER MATCH" IS ONLY TRUE OF AN UNMATCHED NAME. The builder used to lump "this person
       is not on your roster" together with "this person IS on your roster and had nothing to log"
       — a `--` hours cell, a $0.00 tips line (an ordinary row for a barback, the kitchen, or
       someone's day off) — and this sentence called all of them a roster problem. The implied fix
       is to add the staff member, who already exists, which is how a roster gets duplicated. Split
       at the builder now, exactly as buildServer and buildPmix already were. */
    const nUnd = (undated || []).length, nInc = (incomplete || []).length;
    const figure = type === 'hours' ? 'no hours rung' : 'no tips to log';
    const outcomes = (skipped.length ? ' (' + skipped.length + ' skipped, name not on your roster)' : '')
      + (nInc ? ' (' + nInc + ' row' + (nInc === 1 ? '' : 's') + ' skipped, ' + figure + ')' : '')
      + (nUnd ? ' (' + nUnd + ' row' + (nUnd === 1 ? '' : 's') + ' skipped, no readable date)' : '')
      + (dupCount ? ' (' + dupCount + ' already logged)' : '')
      // Counted once, and said so — never folded into "already logged", which would be false.
      + ((fileRepeats || 0) ? ' (' + fileRepeats + ' repeated line' + (fileRepeats === 1 ? '' : 's') + ' counted once)' : '');
    if (!toAdd.length) {
      const others = skipped.length + nInc + nUnd;
      /* ⚠ THE HEADLINE MUST NOT POINT AT THE COLUMNS WHEN THE COLUMNS ARE THE ONE THING THAT CANNOT
         BE WRONG. Staff, Date and Hours are all `required: true`, and CSVMapper blocks the Import
         button until every required field is mapped — so by the time this fires, the columns are
         mapped by definition. Once this branch was narrowed to "every row's NAME failed the roster
         match", the old copy ("Check the file has Staff, Date, and Hours") was sending the operator
         to the one place with nothing to find, while the clause right after it said the real thing.
         ⚠ AND THE DUP-ONLY HEADLINE DOES NOT GET `outcomes` — it already states the count, so
         appending the shared string printed it twice ("All 2 were already logged. (2 already
         logged)"). It is the one headline that duplicates rather than adds. */
      if (dupCount && !others) {
        setRes('<div style="font-size:13px;color:var(--red);margin-top:12px;">No new rows imported. All '
          + dupCount + ' were already logged.</div>');
        return;
      }
      setRes('<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + (nUnd && !skipped.length && !nInc && !dupCount ? 'No rows imported. Bar Cop could not read a date on ' + (nUnd === 1 ? 'the row' : 'any row') + ' — check the date column in your export.'
         : nInc && !skipped.length && !nUnd && !dupCount ? 'No rows imported. Every name matched your roster, but no row had ' + (type === 'hours' ? 'usable hours.' : 'a tip amount above zero.')
         : skipped.length && !nInc && !nUnd && !dupCount ? 'No rows imported. Not one name in the file matched your staff roster — check the spellings, or add them in Staff Roster.'
         : 'No new rows imported.') + outcomes + '</div>');
      return;
    }
    const ok = await PosIngest.commit(type, toAdd);
    if (!ok) {
      setRes('<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + App.partialSaveNote(App.landedOf(toAdd, type === 'hours'
              ? (App.laborData && App.laborData.lc_actuals) : (App.laborData && App.laborData.lc_tips)),
            toAdd.length, noun + ' record', noun + ' records')
        + outcomes + '</div>');
      return;
    }
    // The import updates the status (flash + step sub-text); the operator marks
    // the step done themselves when the week's hours/tips are fully in.
    // Same `outcomes` string as the zero-row and failure messages, so all three describe one import
    // in one set of words — and the undated count cannot be reported on two paths and dropped on the third.
    this._flash = toAdd.length + ' ' + noun + ' record' + (toAdd.length === 1 ? '' : 's') + ' imported'
      + outcomes + '.';
    this._openStep = nextStep;
    this.render(this.container, this.actions);
  },

  // ── Wiring ───────────────────────────────────────────────────────────────────
  wire() {
    this.container.onclick = ev => {
      if (ev.target.closest('[data-insights]')) { this.showInsights(); return; }
      const head = ev.target.closest('.lc-step-head');
      if (head) { const k = head.dataset.step; this._openStep = (this._openStep === k) ? '' : k; this.render(this.container, this.actions); return; }
      const dn = ev.target.closest('[data-done]');
      if (dn) { this.setDone(dn.dataset.done, true); this._openStep = null; this.render(this.container, this.actions); return; }
      const un = ev.target.closest('[data-undone]');
      if (un) { this.setDone(un.dataset.undone, false); this._openStep = un.dataset.undone; this.render(this.container, this.actions); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
      if (ev.target.closest('.lc-wk-prev')) { this._stepWeek(-7); return; }
      if (ev.target.closest('.lc-wk-next')) { this._stepWeek(7); return; }
      if (ev.target.closest('.lc-wk-now'))  { this._weekStart = null; this._openStep = null; this.render(this.container, this.actions); return; }
    };
  }
};
