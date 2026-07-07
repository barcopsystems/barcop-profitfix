'use strict';

/* ── Revenue Recovery — Close The Week (landing) ──────────────────────────────
   The weekly revenue close, modeled on the Profit and Cash closes: the Where You
   Stand card up top (recoverable revenue + recovered + your numbers vs target),
   then Close Out Your Week with a week-stepper and the week's steps top to
   bottom, the open step expanding as a live workspace. Revenue Recovery is the
   top line: check average, menu mix, covers, and labor efficiency. Reuses
   FixPanel (the leak board) + the revenue week math (App.data.revenue_weeks). */

S.RevenueDashboard = {
  _weekEnd: null,    // Sunday (period_end) of the selected week
  _openStep: null,   // which step is expanded ('' = all collapsed; null = auto-open first undone)
  _flash: null,

  showHowTo() {
    App.showHelpModal('How the Weekly Close Works', [
      { p: ['This is your weekly close-out for Revenue. Revenue Recovery is the top line: where check average, menu mix, covers, and labor efficiency are leaving money on the table. You land on the week, see how far along you are, and work the steps top to bottom on the last night of the week.'] },
      { h: 'Where You Stand', p: ['Up top is the recoverable revenue your latest audit found, what you have added back so far once your fixes are measured, and your check average, labor percent, and revenue per labor hour for the week against target. Tap Bar Cop Briefing for a written read of where the numbers are heading.'] },
      { h: 'The Steps', p: ['1. Confirm the Week: confirm this week\'s sales, covers, and labor so everything below has numbers. 2. Check your numbers against target: check average, labor percent, and revenue per labor hour, so you see exactly where the top line slipped. 3. Work your biggest leak: open Revenue Fix on the biggest-dollar gap and take it down. 4. Run your Revenue audit: score the whole top line and refresh your leak board. Run it whenever you want a fresh read, flagged here when it has been a while.'] },
      { h: 'Working A Step', p: ['Click a step to open it. Read the numbers, launch into the screen that does the work, and come back. Mark a step done and the bar advances; mark it not done to reopen it. The week selector steps you back to close out a prior week.'] }
    ]);
  },

  // ── Data ──────────────────────────────────────────────────────────────────
  weeks() {
    return ((App.data && App.data.revenue_weeks) || [])
      .filter(w => ((w.bar_revenue || 0) + (w.floor_revenue || 0)) > 0)
      .slice().sort((a, b) => (a.period_end || '').localeCompare(b.period_end || ''));
  },
  audits() { return ((App.data && App.data.revenue_audits) || []); },
  savedWeek(pe) {
    return ((App.data && App.data.revenue_weeks) || [])
      .find(w => w.period_end === pe && ((w.bar_revenue || 0) + (w.floor_revenue || 0)) > 0) || null;
  },
  targets() { return (App.data && App.data.revenue_settings && App.data.revenue_settings.targets) || {}; },

  // ── Week math (Sunday period_end, same as the Control closes) ───────────────
  weekEnd()   { return this._weekEnd || (App.nextSunday ? App.nextSunday() : App.todayLocal()); },
  weekStart() { return App.weekStartFor ? App.weekStartFor(this.weekEnd()) : this.weekEnd(); },
  fmtWk(ymd)  { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); },
  addDays(ymd, n) { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return App.ymdLocal(d); },
  atCurrentWeek() { const cur = App.nextSunday ? App.nextSunday() : App.todayLocal(); return this.weekEnd() >= cur; },
  _stepWeek(n) {
    const next = this.addDays(this.weekEnd(), n);
    const cur = App.nextSunday ? App.nextSunday() : App.todayLocal();
    if (n > 0 && next > cur) return;
    this._weekEnd = next; this._openStep = null; this._flash = null;
    this.render(this.container, this.actions);
  },

  // ── Per-week step-done stamps (operator-controlled, local to the device) ────
  _doneKey() { return 'rev_cockpit_done_' + this.weekEnd() + App.acctScopeSuffix(); },
  doneMap()  { try { return JSON.parse(localStorage.getItem(this._doneKey()) || '{}'); } catch (e) { return {}; } },
  setDone(step, val) { const m = this.doneMap(); m[step] = val; try { localStorage.setItem(this._doneKey(), JSON.stringify(m)); } catch (e) {} },

  ORDER: ['week', 'numbers', 'leaks', 'audit'],
  _META: {
    week:    { n: 1, title: 'Confirm the Week',                  sub: 'Confirm this week\'s sales, covers, and labor' },
    numbers: { n: 2, title: 'Check your numbers against target', sub: 'Check average, labor, and revenue per labor hour' },
    leaks:   { n: 3, title: 'Work your biggest leak',            sub: 'Open Revenue Fix on the biggest dollar gap' },
    audit:   { n: 4, title: 'Run your Revenue audit',            sub: 'Score the top line and refresh your leaks' }
  },

  // Steps are operator-marked, with ONE exception: Confirm the Week. Confirming
  // the week in the popup IS the completion (it writes the revenue_week record),
  // so this step's done-state derives from that record — the same signal the
  // Confirm/Edit button uses — instead of a manual stamp. Others stay manual.
  stepDone() {
    const dm = this.doneMap();
    const r = {};
    this.ORDER.forEach(k => { r[k] = !!dm[k]; });
    r.week = !!this.savedWeek(this.weekEnd());
    return r;
  },

  // Compact step summary for the Hub Revenue card; mirrors this page for the
  // current week (save/restore the selected week so the live page is untouched).
  hubSteps() {
    const sv = this._weekEnd; this._weekEnd = App.nextSunday ? App.nextSunday() : App.todayLocal();
    try {
      const done = this.stepDone();
      const steps = this.ORDER.map(k => ({ key: k, label: this._META[k].title, done: !!done[k] }));
      return { steps, doneCount: steps.filter(s => s.done).length, total: steps.length };
    } finally { this._weekEnd = sv; }
  },

  _auditState() {
    const latest = App.latestEvent ? App.latestEvent(this.audits()) : null;
    if (!latest) return { latest: null, daysSince: null, due: true, score: null };
    const d = ('' + (latest.date || latest.generated_at || '')).slice(0, 10);
    const daysSince = d ? Math.floor((Date.now() - new Date(d + 'T00:00:00').getTime()) / 86400000) : null;
    return { latest, daysSince, due: (daysSince == null || daysSince >= 7), score: latest.overall_score };
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
    // Flip to Where You Stand when its hero number (recoverable revenue) can be
    // read — when an audit has run, the last Get Started step. A logged week alone
    // fills only the metric strip, not the hero, so it stays on Get Started.
    const hasData = this.audits().length;
    const insightsBtn = '<button class="btn btn-ghost btn-sm" id="r-insights-btn" data-insights style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Bar Cop Briefing</button>';

    container.innerHTML = '<div class="screen">'
      + (hasData ? this.whereYouStand(insightsBtn) : this.getStartedBox())
      + this.banner(doneCount, this.ORDER.length)
      + (flash ? '<div style="font-size:12px;color:var(--green);font-weight:700;margin:12px 2px 0;">&#10003; ' + esc(flash) + '</div>' : '')
      + '<div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">'
      +   this.ORDER.map(k => this.stepRow(k, done)).join('')
      + '</div>'
      + this.outlierStrip()
      + '</div>';

    if (window.FixPanel) FixPanel.wireFixAreas(container);
    this.wire();
  },

  // ── Where You Stand (the revenue money card, modeled on Profit / Cash) ───────
  whereYouStand(insightsBtn) {
    const s = (window.Recovery && Recovery.moduleSummary) ? Recovery.moduleSummary('revenue') : { recovered: 0, withFigure: 0, logged: 0 };
    const latestAudit = App.latestEvent ? App.latestEvent(this.audits()) : null;
    const monthly = latestAudit ? (latestAudit.action_items || []).reduce((sum, a) => sum + (a.monthly_impact || 0), 0) : 0;
    const annual = monthly * 12;

    let heroBody;
    if (!latestAudit) {
      heroBody = '<div style="font-size:13px;color:var(--t2);line-height:1.6;padding:2px 0;">Run your first Revenue audit and Bar Cop reads the top line you can win back, where check average, menu mix, and covers are leaving money on the table.</div>';
    } else if (annual > 0) {
      heroBody = '<div style="padding:2px 0;"><div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">'
        + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:600;line-height:0.9;color:var(--gold);">' + App.fmtCurrency(annual, 0) + '</span>'
        + '<span style="font-size:13px;color:var(--t2);">in recoverable revenue a year</span></div></div>';
    } else {
      heroBody = '<div style="padding:2px 0;"><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:600;line-height:0.9;color:var(--t1);">All clear</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-top:6px;">Your latest audit found no dollar gaps worth chasing right now. The top line is holding.</div></div>';
    }

    const recoveredLine = s.withFigure > 0
      ? '<span><span style="color:var(--green);font-weight:700;">' + App.fmtCurrency(s.recovered, 0) + '</span> recovered so far, across ' + s.withFigure + ' measured fix' + (s.withFigure === 1 ? '' : 'es') + '.</span>'
      : '<span style="color:var(--t3);">Recovered revenue builds here as you work fixes and log your weeks.</span>';

    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span>Where You Stand</span>' + insightsBtn + '</div>'
      + heroBody
      + '<div style="font-size:12px;color:var(--t3);margin-top:10px;padding-bottom:2px;">' + recoveredLine + '</div>'
      + this.numbersStrip()
      + '</div>';
  },

  // The revenue parallel of Profit's cost strip: check average, labor %, and
  // revenue per labor hour for the latest logged week, each against its target.
  numbersStrip() {
    const latest = this.weeks().slice(-1)[0] || null;
    const wrap = inner => '<div style="margin-top:12px;padding-top:14px;border-top:1px solid var(--b2);">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Where Your Numbers Stand</div>'
      + inner + '</div>';
    // No week yet: the same stat design with dashes (metricsRows on an empty week
    // yields all '-'), never explainer text.
    const mini = m => '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">' + m.label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:600;line-height:1;color:' + (m.good == null ? 'var(--t1)' : m.good ? 'var(--green)' : 'var(--red)') + ';">' + m.value + '</div></div>';
    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 30px;"></div>';
    return wrap('<div style="display:flex;align-items:flex-start;flex-wrap:wrap;">'
      + this.metricsRows(latest || {}).map(mini).join(vdiv)
      + '</div>'
      + '<div style="margin-top:14px;"><button class="btn btn-ghost btn-sm" data-go="r-forecast">Revenue Forecast</button></div>');
  },

  // Check average, labor %, and revenue per labor hour for a week, each vs its
  // target. good = hitting it (check avg + rplh higher is better; labor % lower).
  metricsRows(w) {
    const t = this.targets();
    const tCA = t.check_avg != null ? t.check_avg : 35;
    const tLP = App.laborTargetPct ? App.laborTargetPct() : 30;
    const tR  = t.rplh;
    return [
      { label: 'Check Average', value: w.check_avg != null ? App.fmtCurrency(w.check_avg) : '-', sub: 'target ' + App.fmtCurrency(tCA), good: w.check_avg != null ? (w.check_avg >= tCA) : null },
      { label: 'Labor %', value: w.labor_pct_blended != null ? w.labor_pct_blended.toFixed(1) + '%' : '-', sub: 'target ' + tLP.toFixed(1) + '%', good: w.labor_pct_blended != null ? (w.labor_pct_blended <= tLP) : null },
      { label: 'Revenue / Labor Hour', value: w.rplh_blended != null ? App.fmtCurrency(w.rplh_blended) : '-', sub: tR ? 'target ' + App.fmtCurrency(tR) : 'this week', good: (w.rplh_blended != null && tR) ? (w.rplh_blended >= tR) : null }
    ];
  },

  // ── Get Started: first audit + the Control sections that feed Revenue ────────
  getStartedBox() {
    const hasAudit = this.audits().length > 0;
    const hasShift = ((App.shiftData && App.shiftData.sc_shifts) || []).length > 0;
    const hasLabor = ((App.laborData && App.laborData.lc_actuals) || []).length > 0;
    return App.controlGetStarted('Revenue', [
      { num: 1, label: 'Set up Shift Control',         screen: 'sc-dashboard', done: hasShift },
      { num: 2, label: 'Set up Labor Control',         screen: 'lc-dashboard', done: hasLabor },
      { num: 3, label: 'Run your first Revenue Audit', screen: 'r-audit',     done: hasAudit }
    ], 'Recovery');
  },

  weekSelector() {
    const isCur = this.atCurrentWeek();
    const fmt = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(); };
    const range = fmt(this.weekStart()) + ' - ' + fmt(this.weekEnd());
    const nowBadge = isCur ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const prevBtn = '<button class="btn btn-ghost btn-sm r-wk-prev" aria-label="Previous week" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = isCur
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm r-wk-next" aria-label="Next week" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + esc(range) + nowBadge + '</span>';
    const nowBtn = isCur ? '' : '<button class="btn btn-ghost btn-sm r-wk-now" style="margin-left:4px;">This Week</button>';
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
      +   (allDone ? '' : '<div style="font-size:11px;color:var(--t3);margin-top:12px;">A quick weekly pass: log the week, see where you slipped, and take down the worst leak.</div>')
      + '</div>'
      + '</div>';
  },

  // ── Step status (the one-line read under each step title) ────────────────────
  stepStatus(k) {
    const w = this.savedWeek(this.weekEnd());
    if (k === 'week') {
      if (!w) return this._META.week.sub;
      const sales = (w.bar_revenue || 0) + (w.floor_revenue || 0);
      return sales > 0 ? App.fmtCurrency(sales, 0) + ' in sales logged' : 'Logged';
    }
    if (k === 'numbers') {
      if (!w) return this._META.numbers.sub;
      const off = this.metricsRows(w).filter(r => r.good === false).length;
      return off > 0 ? off + ' off target' : 'On target across the board';
    }
    if (k === 'leaks') {
      const top = window.Recovery ? this._topLeak() : null;
      if (top && top.dollars > 0) return App.fmtCurrency(top.dollars, 0) + '/yr on ' + top.name;
      return this._META.leaks.sub;
    }
    if (k === 'audit') {
      const as = this._auditState();
      if (!as.latest || as.score == null) return this._META.audit.sub;
      return 'Scored ' + as.score + (as.due ? ' &middot; run a fresh one' : '');
    }
    return '';
  },

  // The single biggest dollar revenue leak (for the leaks step status).
  _topLeak() {
    if (!window.Recovery || !window.FIX || !Array.isArray(FIX.revenue)) return null;
    const composite = (Recovery.COMPOSITE_GAPS) || [];
    let best = null;
    FIX.revenue.filter(g => composite.indexOf(g.id) === -1).forEach(g => {
      const imp = Recovery.gapImpact(g.id);
      if (imp && imp.dollars > 0 && (!best || imp.dollars > best.dollars)) best = { name: g.name, dollars: imp.dollars };
    });
    return best;
  },

  stepRow(k, done) {
    const m = this._META[k], isDone = done[k], isOpen = this._openStep === k;
    const circle = isDone
      ? '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:13px;font-weight:800;">&#10003;</span>'
      : '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:11px;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,.45);">' + m.n + '</span>';
    const bg = isOpen ? 'var(--gold-tint)' : (isDone ? 'var(--input)' : 'var(--surface)');
    let html = '<div style="border:1px solid var(--b-edge);border-radius:var(--r);background:' + bg + ';overflow:hidden;">'
      + '<div class="pf-step-head' + (isOpen ? '' : ' collapsed') + '" data-step="' + k + '" style="display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;">'
      +   circle
      +   '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--t1);">' + m.title + '</div>'
      +     '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + this.stepStatus(k) + '</div></div>'
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
    const w = this.savedWeek(this.weekEnd());
    const explain = txt => '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">' + txt + '</div>';
    const btnRow = inner => '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' + inner + '</div>';

    if (k === 'week') {
      if (w) {
        const bar = w.bar_revenue || 0, floor = w.floor_revenue || 0;
        return explain('This week is confirmed: <strong>' + App.fmtCurrency(bar, 0) + '</strong> bar and <strong>' + App.fmtCurrency(floor, 0) + '</strong> floor. Edit it if a number needs fixing.')
          + btnRow('<button class="btn btn-ghost btn-sm" data-confirm-week>Edit This Week</button>');
      }
      return explain('Confirm this week\'s numbers. Sales roll up from your imported POS, covers and labor from Shift and Labor Control; you confirm it. Nothing below scores until the week is in.')
        + btnRow('<button class="btn btn-primary btn-sm" data-confirm-week>Confirm the Week</button>');
    }

    if (k === 'numbers') {
      if (!w) {
        return explain('Confirm this week first and your check average, labor percent, and revenue per labor hour land here against target, so you see exactly where the top line slipped.')
          + btnRow('<button class="btn btn-ghost btn-sm" data-confirm-week>Confirm the Week</button>' + this.markBtn('numbers', 'Mark Reviewed'));
      }
      const rows = this.metricsRows(w).map(r => {
        const col = r.good == null ? 'var(--t3)' : (r.good ? 'var(--green)' : 'var(--red)');
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;font-size:12px;">'
          + '<span style="color:var(--t2);">' + r.label + ' <span style="color:var(--t4);">' + r.sub + '</span></span>'
          + '<span style="font-weight:700;color:' + col + ';">' + r.value + '</span></div>';
      }).join('');
      const off = this.metricsRows(w).filter(r => r.good === false);
      const lead = off.length
        ? '<strong style="color:var(--red);">' + off.length + '</strong> off target this week: ' + off.map(r => r.label.toLowerCase()).join(', ') + '. Work the gap below.'
        : 'Your numbers are at or better than target this week. Hold the line.';
      return explain(lead) + rows
        + btnRow('<button class="btn btn-ghost btn-sm" data-go="r-fix">Work Your Leaks</button>' + this.markBtn('numbers', 'Mark Reviewed'));
    }

    if (k === 'leaks') {
      const leak = window.FixPanel ? FixPanel.leakRowsText('revenue') : '';
      if (!leak) {
        return explain('Run a Revenue audit and log a week, and your gaps rank here, the biggest dollar first, each one a tap into its fix process.')
          + btnRow('<button class="btn btn-ghost btn-sm" data-go="r-fix">Open Revenue Fix</button>' + this.markBtn('leaks', 'Mark Done'));
      }
      return explain('Your revenue gaps, ranked by what they cost you a year at this week\'s pace. Tap the biggest one to open its fix process, or open Revenue Fix to work the whole board.')
        + leak
        + btnRow('<button class="btn btn-ghost btn-sm" data-go="r-fix">Open Revenue Fix</button>' + this.markBtn('leaks', 'Mark Done'));
    }

    // audit
    const as = this._auditState();
    const scored = (as.latest && as.score != null) ? '<strong style="color:' + App.scoreColor(as.score) + ';">' + as.score + '</strong>' : '';
    let lead;
    if (!as.latest || as.score == null) {
      lead = 'Run your first Revenue audit. It scores the whole top line and lists every gap with the dollars a year it costs you, which is what feeds the steps above.';
    } else if (as.due) {
      lead = 'Your last Revenue audit scored ' + scored + '. Run a fresh one to rescore the top line and refresh the leak board.';
    } else {
      lead = 'Your Revenue audit is current, scored ' + scored + '. Run a fresh one anytime you want to rescore the top line.';
    }
    return explain(lead)
      + btnRow('<button class="btn btn-ghost btn-sm" data-go="r-audit">' + (as.due ? 'Run Revenue Audit' : 'View Revenue Audit') + '</button><button class="btn btn-ghost btn-sm" data-go="r-fix">Revenue Fix</button>' + this.markBtn('audit', 'Mark Done'));
  },

  // ── As needed: the deeper reads, off the weekly flow ─────────────────────────
  outlierStrip() {
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;">'
      + '<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-right:4px;">As needed</span>'
      + '<button class="btn btn-ghost btn-sm" data-go="r-menu-engineering">Menu Engineering</button>'
      + '<button class="btn btn-ghost btn-sm" data-go="r-server-check">Server Check</button>'
      + '</div>';
  },

  // ── Wiring ───────────────────────────────────────────────────────────────────
  wire() {
    this.container.onclick = ev => {
      const head = ev.target.closest('.pf-step-head');
      if (head) { const k = head.dataset.step; this._openStep = (this._openStep === k) ? '' : k; this.render(this.container, this.actions); return; }
      const dn = ev.target.closest('[data-done]');
      if (dn) { this.setDone(dn.dataset.done, true); this._openStep = null; this.render(this.container, this.actions); return; }
      const un = ev.target.closest('[data-undone]');
      if (un) { this.setDone(un.dataset.undone, false); this._openStep = un.dataset.undone; this.render(this.container, this.actions); return; }
      if (ev.target.closest('[data-confirm-week]')) { ConfirmWeek.open(this.weekEnd(), { onDone: () => this.render(this.container, this.actions) }); return; }
      if (ev.target.closest('[data-insights]')) { this.showInsights(); return; }
      if (ev.target.closest('.fp-fixarea') || ev.target.closest('.fp-step')) return;
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
      if (ev.target.closest('.r-wk-prev')) { this._stepWeek(-7); return; }
      if (ev.target.closest('.r-wk-next')) { this._stepWeek(7); return; }
      if (ev.target.closest('.r-wk-now'))  { this._weekEnd = null; this._openStep = null; this.render(this.container, this.actions); return; }
    };
  },

  // ── Bar Cop Briefing — a written read on the recent revenue + labor trend. ──
  // Code-generated (no API): check average, labor, and the one revenue move.
  showInsights() {
    const weeks = (App.data.revenue_weeks || []).filter(w => (w.bar_revenue || 0) + (w.floor_revenue || 0) > 0).sort((a, b) => (a.period_end || '').localeCompare(b.period_end || '')).slice(-8);
    if (weeks.length < 2) { DashUI.insightsModal('Bar Cop Briefing', 'Enter at least two weeks of data and Bar Cop can read the trend for you.'); return; }

    const t = App.data.revenue_settings?.targets || {};
    const avg = arr => { const v = arr.filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0; };
    const money = n => '$' + Math.round(n).toLocaleString('en-US');
    const caT = t.check_avg || 35;
    const lpT = App.laborTargetPct();
    const caVals  = weeks.map(w => w.check_avg).filter(v => v != null);
    const lpVals  = weeks.map(w => w.labor_pct_blended).filter(v => v != null);
    const covVals = weeks.map(w => w.covers).filter(v => v != null);
    const aCA = avg(caVals), aCov = avg(covVals);
    const curCA = caVals.length ? caVals[caVals.length - 1] : null;
    const curLP = lpVals.length ? lpVals[lpVals.length - 1] : null;
    const caTrend = caVals.length >= 3 ? (caVals[caVals.length - 1] - caVals[0] > 1 ? 'trending up and improving' : caVals[0] - caVals[caVals.length - 1] > 1 ? 'trending down and worsening' : 'holding steady') : null;
    const caGap = (aCA < caT) ? Math.round((caT - aCA) * aCov) : 0;

    const paras = [];
    if (curCA != null) {
      let p1 = 'Your check average is running $' + curCA.toFixed(2) + ' against a $' + caT + ' target, ' + (curCA < caT ? 'money left on every table.' : 'right where you want it.');
      if (caTrend) p1 += ' It is ' + caTrend + '.';
      if (caGap > 0 && aCov > 0) p1 += ' On about ' + Math.round(aCov) + ' covers a week, closing that gap is roughly ' + money(caGap) + '.';
      paras.push(p1);
    }
    if (curLP != null) {
      paras.push('Labor ran ' + curLP.toFixed(1) + '% of sales against a ' + lpT.toFixed(1) + '% target, ' + (curLP > lpT ? 'carrying hours the sales did not ask for.' : 'matched to the room.'));
    }
    if (caGap > 0) paras.push('The fastest revenue this week is the check. Set a drink-and-app standard, teach it at pre-shift, and track it by server in Server Check.');
    else if (curLP != null && curLP > lpT) paras.push('The money this week is in the schedule. Build to the cover forecast and cut the hour that is not earning.');
    else paras.push('Nothing screaming here. Hold the check and the schedule, and keep the covers coming.');

    const html = paras.map(p => '<p style="margin:0 0 12px;">' + esc(p) + '</p>').join('');
    DashUI.insightsModal('Bar Cop Briefing', html);
  }
};
