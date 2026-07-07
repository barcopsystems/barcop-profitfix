'use strict';

/* ── Profit Recovery — Close The Week (landing screen) ────────────────────────
   The weekly profit close, modeled on the Control closes (Inventory / Labor /
   Shift): the Recovery Scoreboard up top, then "Close Out Your Week" with a
   week-stepper and the week's profit steps top to bottom, the open step expanding
   as a live workspace. The steps are the real last-night profit routine: log the
   week, see where margin slipped, work the biggest leak, and run the deep audit
   when it comes due. Reuses FixPanel (the Scoreboard + leak board) and S.ThisWeek
   for the week math (App.data.weeks, period_end). */

S.Dashboard = {
  _weekEnd: null,    // Sunday (period_end) of the selected week
  _openStep: null,   // which step is expanded ('' = all collapsed; null = auto-open first undone)
  _flash: null,

  showHowTo() {
    App.showHelpModal('How the Weekly Close Works', [
      { p: ['This is your weekly close-out for Profit. Profit Recovery is about margin: where the cost of your pours, plates, and the rest is eating money you already earned. You land on the week, see how far along you are, and work the steps top to bottom on the last night of the week.'] },
      { h: 'Where You Stand', p: ['Up top is Where You Stand: the recoverable profit your latest audit found, what you have put back so far once your fixes are measured, and your pour, food, and prime cost for the week against target. Tap Bar Cop Briefing for a written read of where your costs are heading.'] },
      { h: 'The Steps', p: ['1. Confirm the Week: confirm this week\'s bar and food sales and costs, so everything below has numbers. 2. Check your costs against target: your pour, food, and prime cost for the week, so you see exactly where margin slipped before you act. 3. Work your biggest leak: open Profit Fix on the biggest-dollar leak and take it down. 4. Run your Profit audit: score the whole operation and refresh your leak board. Run it whenever you want a fresh read, flagged here when it has been a while.'] },
      { h: 'Working A Step', p: ['Click a step to open it. Read the numbers, launch into the screen that does the work, and come back. Mark a step done and the bar advances; mark it not done to reopen it. The week selector steps you back to close out a prior week.'] }
    ]);
  },

  // ── Data ──────────────────────────────────────────────────────────────────
  weeks()  { return ((App.data && App.data.weeks)  || []); },
  audits() { return ((App.data && App.data.audits) || []); },
  savedWeek(pe) { return this.weeks().find(w => w.period_end === pe) || null; },
  targets() { return (App.data && App.data.settings && App.data.settings.targets) || {}; },

  // ── Week math (Sunday period_end, same as This Week and the Control closes) ──
  weekEnd()   { return this._weekEnd || (App.nextSunday ? App.nextSunday() : App.todayLocal()); },
  weekStart() { return App.weekStartFor ? App.weekStartFor(this.weekEnd()) : this.weekEnd(); },
  fmtWk(ymd)  { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); },
  addDays(ymd, n) { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return App.ymdLocal(d); },
  atCurrentWeek() { const cur = App.nextSunday ? App.nextSunday() : App.todayLocal(); return this.weekEnd() >= cur; },
  _stepWeek(n) {
    const next = this.addDays(this.weekEnd(), n);
    const cur = App.nextSunday ? App.nextSunday() : App.todayLocal();
    if (n > 0 && next > cur) return;   // never walk into the future
    this._weekEnd = next; this._openStep = null; this._flash = null;
    this.render(this.container, this.actions);
  },

  // ── Per-week step-done stamps (operator-controlled, local to the device) ────
  _doneKey() { return 'pf_cockpit_done_' + this.weekEnd() + App.acctScopeSuffix(); },
  doneMap()  { try { return JSON.parse(localStorage.getItem(this._doneKey()) || '{}'); } catch (e) { return {}; } },
  setDone(step, val) { const m = this.doneMap(); m[step] = val; try { localStorage.setItem(this._doneKey(), JSON.stringify(m)); } catch (e) {} },

  ORDER: ['week', 'costs', 'leaks', 'audit'],
  _META: {
    week:  { n: 1, title: 'Confirm the Week',                sub: 'Confirm this week\'s bar and food sales and costs' },
    costs: { n: 2, title: 'Check your costs against target', sub: 'Pour, food, and prime cost vs target' },
    leaks: { n: 3, title: 'Work your biggest leak',          sub: 'Open Profit Fix on the biggest dollar leak' },
    audit: { n: 4, title: 'Run your Profit audit',           sub: 'Score the operation and refresh your leaks' }
  },

  // Steps are operator-marked (you cannot infer "I reviewed costs / worked the
  // leak" from a number), with ONE exception: Confirm the Week. Confirming the
  // week in the popup IS the completion — it writes the week record — so there is
  // no separate acknowledgment to make. Its done-state therefore derives from that
  // record (the same signal the Confirm/Edit button uses), keeping the check and
  // the button in sync. Every other step stays a pure manual stamp.
  stepDone() {
    const dm = this.doneMap();
    const r = {};
    this.ORDER.forEach(k => { r[k] = !!dm[k]; });
    r.week = !!this.savedWeek(this.weekEnd());
    return r;
  },

  // Compact step summary for the Hub Profit card; mirrors this page for the
  // current week (save/restore the selected week so the live page is untouched).
  hubSteps() {
    const sv = this._weekEnd; this._weekEnd = App.nextSunday ? App.nextSunday() : App.todayLocal();
    try {
      const done = this.stepDone();
      const steps = this.ORDER.map(k => ({ key: k, label: this._META[k].title, done: !!done[k] }));
      return { steps, doneCount: steps.filter(s => s.done).length, total: steps.length };
    } finally { this._weekEnd = sv; }
  },

  // Latest audit + where it sits in the weekly cadence. due = no audit yet, or the
  // last one is 7+ days old (the audit-tracker run gate).
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
    const hasData = this.weeks().length || this.audits().length;
    const insightsBtn = '<button class="btn btn-ghost btn-sm" data-insights style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Bar Cop Briefing</button>';

    container.innerHTML = '<div class="screen">'
      + (hasData ? this.whereYouStand(insightsBtn) : this.getStartedBox())
      + this.banner(doneCount, this.ORDER.length)
      + (flash ? '<div style="font-size:12px;color:var(--green);font-weight:700;margin:12px 2px 0;">&#10003; ' + esc(flash) + '</div>' : '')
      + '<div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">'
      +   this.ORDER.map(k => this.stepRow(k, done)).join('')
      + '</div>'
      + this.outlierStrip()
      + '</div>';

    if (window.FixPanel) FixPanel.wireFixAreas(container);   // scoreboard loop steps + leak-board rows
    this.wire();
  },

  // ── Where You Stand (the profit money card, modeled on Cash Recovery) ─────────
  // Hero = the recoverable-profit opportunity from the latest audit; a recovered-
  // so-far line; then a cost-health strip (pour / food / prime vs target) plus the
  // Profit Forecast, the profit parallel of Cash's runway read. Color = meaning.
  whereYouStand(insightsBtn) {
    const s = (window.Recovery && Recovery.moduleSummary) ? Recovery.moduleSummary('profit') : { recovered: 0, withFigure: 0, logged: 0 };
    const latestAudit = App.latestEvent ? App.latestEvent(this.audits()) : null;
    const monthly = latestAudit ? (latestAudit.action_items || []).reduce((sum, a) => sum + (a.monthly_impact || 0), 0) : 0;
    const annual = monthly * 12;

    let heroBody;
    if (!latestAudit) {
      heroBody = '<div style="font-size:13px;color:var(--t2);line-height:1.6;padding:2px 0;">Run your first Profit audit and Bar Cop reads the margin you can win back, where pours, plates, and labor are eating profit you already earned.</div>';
    } else if (annual > 0) {
      heroBody = '<div style="padding:2px 0;"><div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">'
        + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:600;line-height:0.9;color:var(--gold);">' + App.fmtCurrency(annual, 0) + '</span>'
        + '<span style="font-size:13px;color:var(--t2);">in recoverable profit a year</span></div></div>';
    } else {
      heroBody = '<div style="padding:2px 0;"><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:600;line-height:0.9;color:var(--t1);">All clear</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-top:6px;">Your latest audit found no dollar leaks worth chasing right now. Margins are holding.</div></div>';
    }

    const recoveredLine = s.withFigure > 0
      ? '<span><span style="color:var(--green);font-weight:700;">' + App.fmtCurrency(s.recovered, 0) + '</span> recovered so far, across ' + s.withFigure + ' measured fix' + (s.withFigure === 1 ? '' : 'es') + '.</span>'
      : '<span style="color:var(--t3);">Recovered profit builds here as you work fixes and log your weeks.</span>';

    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span>Where You Stand</span>' + insightsBtn + '</div>'
      + heroBody
      + '<div style="font-size:12px;color:var(--t3);margin-top:10px;padding-bottom:2px;">' + recoveredLine + '</div>'
      + this.costStrip()
      + '</div>';
  },

  // The profit parallel of Cash's survival strip: pour, food, and prime cost for
  // the latest logged week, each against its target. Color = meaning only.
  costStrip() {
    const latest = App.latestEvent ? App.latestEvent(this.weeks()) : null;
    const wrap = inner => '<div style="margin-top:12px;padding-top:14px;border-top:1px solid var(--b2);">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Where Your Costs Stand</div>'
      + inner + '</div>';
    if (!latest) {
      return wrap('<div style="font-size:12px;color:var(--t3);line-height:1.6;">Log a week of sales and costs and Bar Cop shows your pour, food, and prime cost against target right here.</div>');
    }
    const rows = this._costRows(latest);
    const mini = (label, r) => '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:600;line-height:1;color:' + (r.val == null ? 'var(--t3)' : r.over ? 'var(--red)' : 'var(--green)') + ';">' + (r.val == null ? '-' : App.fmtPct(r.val)) + '</div></div>';
    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 30px;"></div>';
    return wrap('<div style="display:flex;align-items:flex-start;flex-wrap:wrap;">'
      + mini('Bar Pour Cost', rows[0]) + vdiv + mini('Food Cost', rows[1]) + vdiv + mini('Prime Cost', rows[2])
      + '</div>'
      + '<div style="margin-top:14px;"><button class="btn btn-ghost btn-sm" data-go="profit-forecast">Profit Forecast</button></div>');
  },

  // ── Get Started: run your first audit + the Control sections that feed Recovery.
  // Drops off once all four are in place (App.controlGetStarted returns '').
  getStartedBox() {
    const hasAudit = this.audits().length > 0;
    const hasInv   = ((App.inventoryData && App.inventoryData.ic_products) || []).length > 0;
    const hasShift = ((App.shiftData && App.shiftData.sc_shifts) || []).length > 0;
    const hasLabor = ((App.laborData && App.laborData.lc_actuals) || []).length > 0;
    return App.controlGetStarted('Profit', [
      { num: 1, label: 'Set up Inventory Control',    screen: 'ic-dashboard',  done: hasInv },
      { num: 2, label: 'Set up Shift Control',        screen: 'sc-dashboard',  done: hasShift },
      { num: 3, label: 'Set up Labor Control',        screen: 'lc-dashboard',  done: hasLabor },
      { num: 4, label: 'Run your first Profit Audit', screen: 'audit-tracker', done: hasAudit }
    ], 'Recovery');
  },

  weekSelector() {
    const isCur = this.atCurrentWeek();
    const fmt = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(); };
    const range = fmt(this.weekStart()) + ' - ' + fmt(this.weekEnd());
    const nowBadge = isCur ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const prevBtn = '<button class="btn btn-ghost btn-sm pf-wk-prev" aria-label="Previous week" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = isCur
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm pf-wk-next" aria-label="Next week" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + esc(range) + nowBadge + '</span>';
    const nowBtn = isCur ? '' : '<button class="btn btn-ghost btn-sm pf-wk-now" style="margin-left:4px;">This Week</button>';
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
  stepStatus(k, isDone) {
    const w = this.savedWeek(this.weekEnd());
    if (k === 'week') {
      if (!w) return this._META.week.sub;
      const sales = ((w.bar && w.bar.revenue) || 0) + ((w.food && w.food.revenue) || 0);
      return sales > 0 ? App.fmtCurrency(sales, 0) + ' in sales logged' : 'Logged';
    }
    if (k === 'costs') {
      if (!w) return this._META.costs.sub;
      const over = this._costRows(w).filter(r => r.over).length;
      return over > 0 ? over + ' of 3 over target' : 'All three at or under target';
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

  // The pour/food/prime cost rows for a saved week, each vs its own target.
  _costRows(w) {
    const t = this.targets();
    const mk = (label, val, tgt) => ({ label, val, tgt, over: (val != null && val > tgt) });
    return [
      mk('Bar Pour Cost', (w.bar && w.bar.cost_pct != null) ? w.bar.cost_pct : null, t.bar_pour_cost_pct || 22),
      mk('Food Cost',     (w.food && w.food.cost_pct != null) ? w.food.cost_pct : null, t.food_cost_pct || 32),
      mk('Prime Cost',    (w.prime_cost_pct != null) ? w.prime_cost_pct : null,         t.prime_cost_pct || 60)
    ];
  },

  // The single biggest dollar leak (for the leaks step status). Mirrors the
  // leak-board ranking, composites excluded.
  _topLeak() {
    if (!window.Recovery || !window.FIX || !Array.isArray(FIX.profit)) return null;
    const composite = (Recovery.COMPOSITE_GAPS) || [];
    let best = null;
    FIX.profit.filter(g => composite.indexOf(g.id) === -1).forEach(g => {
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
      + '<div class="pf-step-head" data-step="' + k + '" style="display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;">'
      +   circle
      +   '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--t1);">' + m.title + '</div>'
      +     '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + this.stepStatus(k, isDone) + '</div></div>'
      +   '<span style="color:var(--t3);font-size:13px;flex-shrink:0;">' + (isOpen ? '&#9652;' : '&#9662;') + '</span>'
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
        const bar = (w.bar && w.bar.revenue) || 0, food = (w.food && w.food.revenue) || 0;
        return explain('This week is confirmed: <strong>' + App.fmtCurrency(bar, 0) + '</strong> bar and <strong>' + App.fmtCurrency(food, 0) + '</strong> food. Edit it if a number needs fixing.')
          + btnRow('<button class="btn btn-ghost btn-sm" data-confirm-week>Edit This Week</button>');
      }
      return explain('Confirm this week\'s numbers. Revenue rolls up from your imported POS sales, COGS from your Inventory counts, and labor from Labor Control; you confirm it. Nothing below scores until the week is in.')
        + btnRow('<button class="btn btn-primary btn-sm" data-confirm-week>Confirm the Week</button>');
    }

    if (k === 'costs') {
      if (!w) {
        return explain('Confirm this week first and your bar pour cost, food cost, and prime cost land here against target, so you see exactly where margin slipped.')
          + btnRow('<button class="btn btn-ghost btn-sm" data-confirm-week>Confirm the Week</button>' + this.markBtn('costs', 'Mark Reviewed'));
      }
      const rows = this._costRows(w).map(r => {
        const col = r.val == null ? 'var(--t3)' : (r.over ? 'var(--red)' : 'var(--green)');
        const val = r.val != null ? r.val.toFixed(1) + '%' : 'n/a';
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;font-size:12px;">'
          + '<span style="color:var(--t2);">' + r.label + ' <span style="color:var(--t4);">target ' + r.tgt + '%</span></span>'
          + '<span style="font-weight:700;color:' + col + ';">' + val + '</span></div>';
      }).join('');
      const over = this._costRows(w).filter(r => r.over);
      const lead = over.length
        ? '<strong style="color:var(--red);">' + over.length + ' of 3</strong> are over target this week' + (over.length ? ': ' + over.map(r => r.label.toLowerCase()).join(', ') : '') + '. Work the leak below.'
        : 'All three are at or under target this week. Hold the line.';
      return explain(lead) + rows
        + btnRow('<button class="btn btn-ghost btn-sm" data-go="profit-fix">Work Your Leaks</button>' + this.markBtn('costs', 'Mark Reviewed'));
    }

    if (k === 'leaks') {
      const leak = window.FixPanel ? FixPanel.leakRowsText('profit') : '';
      if (!leak) {
        return explain('Run a Profit audit and log a week, and your leaks rank here, the biggest dollar first, each one a tap into its fix process.')
          + btnRow('<button class="btn btn-ghost btn-sm" data-go="profit-fix">Open Profit Fix</button>' + this.markBtn('leaks', 'Mark Done'));
      }
      return explain('Your leaks, ranked by what they cost you a year at this week\'s pace. Tap the biggest one to open its fix process, or open Profit Fix to work the whole board.')
        + leak
        + btnRow('<button class="btn btn-ghost btn-sm" data-go="profit-fix">Open Profit Fix</button>' + this.markBtn('leaks', 'Mark Done'));
    }

    // audit
    const as = this._auditState();
    const scored = (as.latest && as.score != null) ? '<strong style="color:' + App.scoreColor(as.score) + ';">' + as.score + '</strong>' : '';
    let lead;
    if (!as.latest || as.score == null) {
      lead = 'Run your first Profit audit. It scores the whole operation and lists every leak with the dollars a year it costs you, which is what feeds the steps above.';
    } else if (as.due) {
      lead = 'Your last Profit audit scored ' + scored + '. Run a fresh one to rescore the operation and refresh the leak board.';
    } else {
      lead = 'Your Profit audit is current, scored ' + scored + '. Run a fresh one anytime you want to rescore the operation.';
    }
    return explain(lead)
      + btnRow('<button class="btn btn-ghost btn-sm" data-go="audit-tracker">' + (as.due ? 'Run Profit Audit' : 'View Profit Audit') + '</button><button class="btn btn-ghost btn-sm" data-go="profit-fix">Profit Fix</button>' + this.markBtn('audit', 'Mark Done'));
  },

  // ── As needed: the deeper reads, off the weekly flow ─────────────────────────
  outlierStrip() {
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;">'
      + '<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-right:4px;">As needed</span>'
      + '<button class="btn btn-ghost btn-sm" data-go="sales-integrity">Sales Integrity</button>'
      + '<button class="btn btn-ghost btn-sm" data-go="recipe-cost-analysis">Recipe Summary</button>'
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
      // Leak-board rows (.fp-fixarea) are wired by FixPanel.wireFixAreas; skip them
      // here so a tap routes into the fix process, not a no-op.
      if (ev.target.closest('.fp-fixarea') || ev.target.closest('.fp-step')) return;
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
      if (ev.target.closest('.pf-wk-prev')) { this._stepWeek(-7); return; }
      if (ev.target.closest('.pf-wk-next')) { this._stepWeek(7); return; }
      if (ev.target.closest('.pf-wk-now'))  { this._weekEnd = null; this._openStep = null; this.render(this.container, this.actions); return; }
    };
  },

  // ── Bar Cop Briefing: a written read of the profit week, cached a week per
  //    section via DashUI so repeat opens do not spend on the API. ─────────────
  // Code-generated (no API): reads the cost trend and writes three short
  // paragraphs in the operator voice, the worst cost, the trends, the one move.
  showInsights() {
    const weeks = this.weeks().slice().sort((a, b) => (a.period_end || '').localeCompare(b.period_end || '')).slice(-8);
    if (weeks.length < 2) { DashUI.insightsModal('Bar Cop Briefing', 'Enter at least two weeks of data and Bar Cop can read the trend for you.'); return; }

    const t = this.targets();
    const bT = t.bar_pour_cost_pct || 22, fT = t.food_cost_pct || 32, pT = t.prime_cost_pct || 60;
    const r1 = n => (Math.round(n * 10) / 10).toFixed(1);
    const money = n => '$' + Math.round(n).toLocaleString('en-US');
    const direction = v => {
      if (v.length < 3) return 'still too few weeks to call a trend';
      const d = v[v.length - 1] - v[0];
      return d > 0.5 ? 'rising, getting worse' : d < -0.5 ? 'falling, improving' : 'holding steady';
    };
    const bR = weeks.map(w => w.bar && w.bar.revenue).filter(v => v != null);
    const aR = bR.length ? bR.reduce((s, x) => s + x, 0) / bR.length : 0;

    const costs = [
      { name: 'Bar pour cost', arr: weeks.map(w => w.bar && w.bar.cost_pct),  tgt: bT, act: 'jigger the wells, cost your recipes, and watch pour variance in Spot Check' },
      { name: 'Food cost',     arr: weeks.map(w => w.food && w.food.cost_pct), tgt: fT, act: 'tighten portions and log waste in Inventory' },
      { name: 'Prime cost',    arr: weeks.map(w => w.prime_cost_pct),          tgt: pT, act: 'work the biggest of pour, food, and labor first in Profit Fix' }
    ].map(c => { const v = c.arr.filter(x => x != null); return Object.assign(c, { cur: v.length ? v[v.length - 1] : null, n: v.length, dir: direction(v) }); })
     .filter(c => c.cur != null);
    costs.forEach(c => c.over = c.cur - c.tgt);
    const curB = (costs.find(c => c.name === 'Bar pour cost') || {}).cur;
    const barOver = (curB != null && curB > bT) ? Math.round((curB - bT) / 100 * aR) : 0;
    const worst = costs.slice().sort((a, b) => b.over - a.over)[0];

    const paras = [];
    if (worst && worst.over > 0.05) {
      let p1 = 'Your ' + worst.name.toLowerCase() + ' is running ' + r1(worst.cur) + '% against a ' + worst.tgt + '% target, ' + r1(worst.over) + ' point' + (Math.round(worst.over) === 1 ? '' : 's') + ' over and the first one to chase.';
      if (worst.name === 'Bar pour cost' && barOver > 0) p1 += ' On about ' + money(aR) + ' of bar sales a week, that overage is roughly ' + money(barOver) + ' walking out.';
      paras.push(p1);
    } else if (costs.length) {
      paras.push('Your costs are at or under target: ' + costs.map(c => c.name.toLowerCase().replace(' cost', '') + ' ' + r1(c.cur) + '%').join(', ') + '. Nothing here is bleeding, which is the whole job.');
    }
    if (costs.some(c => c.n >= 3)) {
      paras.push('Over the last ' + Math.max.apply(null, costs.map(c => c.n)) + ' weeks, ' + costs.map(c => c.name.toLowerCase() + ' is ' + c.dir).join(', ') + '.');
    }
    if (worst && worst.over > 0.05) paras.push('This week, put the wrench on ' + worst.name.toLowerCase() + ': ' + worst.act + ' until it comes back to target.');
    else paras.push('Nothing urgent to chase. Hold the discipline and keep logging every week so the trend stays honest.');

    const html = paras.map(p => '<p style="margin:0 0 12px;">' + esc(p) + '</p>').join('');
    DashUI.insightsModal('Bar Cop Briefing', html);
  }
};
