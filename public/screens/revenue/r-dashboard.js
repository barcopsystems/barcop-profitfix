'use strict';
// Revenue Recovery landing. Same skeleton as the Profit dashboard, via DashUI:
// Recovery Scoreboard hero, a diagnosis row (Where You're Leaking Now + This
// Week vs Target), a forward/audit row (Revenue Forecast + Revenue Audit),
// Quick Actions, then the Initiative Tracker. Header off; nav-i carries the
// directions; full day-one mirror before any data lands.
S.RevenueDashboard = {

  showHowTo() {
    App.showHelpModal('How the Revenue Dashboard Works', [
      { p: ['The Revenue Recovery landing runs the whole loop on one page: how much you have recovered up top, where the top line is leaking right now and your numbers against target just under it, your forecast and audit below that, and the experiments you are running at the bottom. Every number is computed from your own logged data, never an industry average. Before you have run an audit or logged a week, a Get Started strip points you at your first audit and the Control sections that feed Revenue.'] },
      { h: 'Recovery Scoreboard', p: ['The headline is what Bar Cop has measured you added back to the top line since each fix started running. Realized to date, not a projection. A figure appears once a couple of weeks of after-data exist and firms up from there.'] },
      { h: 'Where You\'re Leaking Now', p: ['Your revenue gaps as plain text, biggest dollar first. Check average and menu mix dollarize at this week\'s cover count; the rest read as a Review row you tap to work on their own screen. Tap any row to open its fix process.'] },
      { h: 'This Week vs Target', p: ['Your check average, labor cost, and revenue per labor hour from your latest confirmed week, each against its own target. Green is hitting it, red is missing it. Tap Bar Cop Insights for a written read on where the numbers are heading.'] },
      { h: 'Revenue Forecast and Revenue Audit', p: ['Revenue Forecast shows what you expect to bring in for the coming week so Labor can build the schedule to a real number. Revenue Audit shows your latest score and when the next one can run. Both open their full screen with a tap.'] },
      { h: 'Initiative Tracker', p: ['Log a revenue experiment and Bar Cop measures whether it actually moved a number. Hit Start Initiative, name it, set the start date, and tag the Type so the list reads at a glance: Menu Change, Promotion, Service Change, Operational Change, or Other. Pick the Watch Metric you expect to move, Total Revenue, Covers, Check Average, or Labor %. Labor % is lower-is-better, so a drop counts as a win and shows gold; on every other metric a rise is the win.', 'Once it is running, Bar Cop averages the eight weeks before the start date against the eight weeks after and shows the lift on that watched metric, so the number is your own before-and-after, not a guess. When an experiment has run its course, hit Mark Complete to move it out of the active list and into Completed below, where the final lift stays on record. Delete drops one you do not want to track.'] }
    ]);
  },

  render(container, actions) {
    if (actions) actions.innerHTML = '';
    this.container = container;
    const weeks  = App.data.revenue_weeks  || [];
    const audits = App.data.revenue_audits || [];
    if (weeks.length === 0 && audits.length === 0) { this.renderDayOne(container); return; }
    this.renderFull(container);
  },

  renderFull(container) {
    const rs     = App.data.revenue_settings || {};
    const t      = rs.targets || {};
    // Sort by period_end (revenue_weeks load order is not guaranteed chronological),
    // so latest is genuinely the newest confirmed week, not the last array element.
    const weeks  = (App.data.revenue_weeks || []).filter(w => (w.bar_revenue || 0) + (w.floor_revenue || 0) > 0)
      .sort((a, b) => (a.period_end || '').localeCompare(b.period_end || ''));
    const latest = weeks.length ? weeks[weeks.length - 1] : null;

    const leak = FixPanel.leakRowsText('revenue');
    const leakBody = leak || DashUI.ph('Run a Revenue Audit and log a week, and your biggest revenue gaps rank here, dollar first.');
    const insightsBtn = '<button class="btn btn-ghost btn-sm" id="r-insights-btn" style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Bar Cop Insights</button>';
    const metricsBody = DashUI.metricsPanel(this.metricsRows(latest, t), 'Confirm a week to see your numbers');

    container.innerHTML = '<div class="screen">'
      + FixPanel._scoreboardCard('revenue')
      + DashUI.row(
          DashUI.shPanel('Where You\'re Leaking Now', leakBody),
          DashUI.shPanel('This Week vs Target', metricsBody, insightsBtn))
      + DashUI.row(
          DashUI.shPanel('Revenue Forecast', this.forecastPanel(latest)),
          DashUI.shPanel('Revenue Audit', DashUI.auditPanel({
            audits: App.data.revenue_audits,
            screen: 'r-audit',
            runText: 'Run Revenue Audit',
            emptyText: 'Run your first Revenue Audit for a baseline across check average, menu mix, server performance, and labor efficiency.'
          })))
      + '<div class="sh" style="margin:24px 0 10px;">Initiative Tracker</div>'
      + this.buildInitiativesCard()
      + DashUI.quickActions([
          { go: 'r-this-week', label: 'Enter This Week' },
          { go: 'r-audit', label: 'Run Revenue Audit' },
          { go: 'r-forecast', label: 'Revenue Forecast' },
          { go: 'r-menu-engineering', label: 'Menu Engineering' }
        ])
      + '</div>';

    FixPanel.wireFixAreas(container);
    DashUI.wireQuick(container);
    document.getElementById('r-insights-btn')?.addEventListener('click', () => this.showInsights());
    this.wireInitiatives(container);
  },

  // This Week vs Target — latest confirmed week's check average, labor cost, and
  // revenue per labor hour, each colored over/under its own target.
  metricsRows(latest, t) {
    if (!latest) return [];
    const rows = [];
    const ca = latest.check_avg, lp = latest.labor_pct_blended, rplh = latest.rplh_blended;
    const tCA = t.check_avg ?? 35;
    const tLP = App.laborTargetPct();
    if (ca != null) rows.push({
      label: 'Check Average', sub: 'target ' + App.fmtCurrency(tCA),
      value: App.fmtCurrency(ca), color: ca >= tCA ? 'var(--green)' : 'var(--red)'
    });
    if (lp != null) rows.push({
      label: 'Labor %', sub: 'target ' + tLP.toFixed(1) + '%',
      value: lp.toFixed(1) + '%', color: lp <= tLP ? 'var(--green)' : 'var(--red)'
    });
    if (rplh != null) {
      const tR = t.rplh;
      rows.push({
        label: 'Revenue / Labor Hour', sub: tR ? 'target ' + App.fmtCurrency(tR) : 'this week',
        value: App.fmtCurrency(rplh), color: tR ? (rplh >= tR ? 'var(--green)' : 'var(--red)') : 'var(--t1)'
      });
    }
    return rows;
  },

  // Revenue Forecast panel — the planning week's revenue (the number the
  // schedule builder reads), against last confirmed week. Ties to the real
  // Revenue Forecast planner so the dashboard and the full screen never disagree.
  forecastPanel(latest) {
    const ws = (S.RevenueForecast && S.RevenueForecast.defaultWeekStart) ? S.RevenueForecast.defaultWeekStart() : null;
    const fc = ws ? App.forecastForWeek(ws) : null;
    const placeholder = '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:12px;">Set your revenue forecast so Labor builds the schedule against a real number, not a guess.</div>'
      + '<button class="btn btn-ghost btn-sm db-qa" data-go="r-forecast">Open Revenue Forecast</button>';
    if (!fc || !(fc.total > 0)) return placeholder;
    const lastRev = latest ? (latest.bar_revenue || 0) + (latest.floor_revenue || 0) : null;
    const diff = (lastRev != null) ? fc.total - lastRev : null;
    const wkLabel = (() => { const d = new Date(ws + 'T00:00:00'); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); })();
    const money = n => App.fmtCurrency(n, 0);
    return '<div style="font-size:11px;color:var(--t3);margin-bottom:5px;">Forecast, week of ' + wkLabel + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:40px;font-weight:700;line-height:1;color:var(--t1);">' + money(fc.total) + '</div>'
      + (diff != null
          ? '<div style="font-size:13px;font-weight:600;color:' + (diff >= 0 ? 'var(--gold)' : 'var(--t3)') + ';margin-top:12px;">' + (diff >= 0 ? '+' : '') + money(diff) + ' vs last confirmed week</div>'
          : '')
      + '<div style="margin-top:14px;"><button class="btn btn-ghost btn-sm db-qa" data-go="r-forecast">Open Revenue Forecast</button></div>';
  },

  // Day one (no weeks, no audits): guided steps + placeholders mirroring the
  // full layout. Points at the first audit and the Control feeds, not a prereq
  // checklist; the wow visuals switch on only once data backs them.
  renderDayOne(container) {
    const hasAudit = (App.data.revenue_audits || []).length > 0;
    const hasWeek  = (App.data.revenue_weeks || []).length > 0;
    const hasShift = ((App.shiftData && App.shiftData.sc_shifts) || []).length > 0;
    const hasLabor = ((App.laborData && App.laborData.lc_actuals) || []).length > 0;
    const ph = DashUI.ph;

    container.innerHTML = '<div class="screen">'
      + DashUI.dayOneStrip(
          'Run your first Revenue Audit for a baseline, enter a week in This Week, and set up the Control sections that feed Revenue. As that data lands, this dashboard fills in with your recovered dollars and where the top line is leaking.',
          [
            { done: hasAudit, num: 1, label: 'Run your first Revenue Audit', go: 'r-audit' },
            { done: hasWeek,  num: 2, label: 'Enter This Week', go: 'r-this-week' },
            { done: hasShift, num: 3, label: 'Set up Shift Control', go: 'sc-dashboard', cross: true },
            { done: hasLabor, num: 4, label: 'Set up Labor Control', go: 'lc-dashboard', cross: true }
          ])
      + '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Recovery Scoreboard</div>'
        + ph('Your recovered dollars show here once you log your first fix. Bar Cop measures the metric before and after the fix and reports only what is real.') + '</div>'
      + DashUI.row(
          DashUI.shPanel('Where You\'re Leaking Now', ph('Your revenue gaps rank here once a week of data lands, biggest dollar first, each a tap into the fix process.')),
          DashUI.shPanel('This Week vs Target', ph('Your check average, labor cost, and revenue per labor hour against target show here once you confirm a week.')))
      + DashUI.row(
          DashUI.shPanel('Revenue Forecast', ph('Your next week\'s revenue forecast shows here once you set one.')),
          DashUI.shPanel('Revenue Audit', ph('Your latest Revenue Audit score lands here once you run one.')))
      + DashUI.quickActions([
          { go: 'r-this-week', label: 'Enter This Week' },
          { go: 'r-audit', label: 'Run Revenue Audit' },
          { go: 'r-forecast', label: 'Revenue Forecast' },
          { go: 'r-menu-engineering', label: 'Menu Engineering' }
        ])
      + '</div>';
    DashUI.wireQuick(container);
  },

  // ── Initiative Tracker ─────────────────────────────────────────────────
  // Operator-typed revenue experiments. Each captures start date, what changed,
  // and which metric to watch; Bar Cop computes the 8-week-before vs 8-week-after
  // average of the watched metric and shows the lift. Distinct from the Recovery
  // Scoreboard (audit-action-item fixes) — this tracks revenue experiments.
  INITIATIVE_TYPES: ['Menu Change', 'Promotion', 'Service Change', 'Operational Change', 'Other'],
  INITIATIVE_METRICS: [
    { key: 'revenue',    label: 'Total Revenue (weekly)' },
    { key: 'covers',     label: 'Covers (weekly)' },
    { key: 'check_avg',  label: 'Check Average' },
    { key: 'labor_pct',  label: 'Labor % (lower is better)' }
  ],

  initiatives() {
    if (!Array.isArray(App.data.initiatives)) App.data.initiatives = [];
    return App.data.initiatives;
  },

  _metricFor(week, key) {
    if (!week) return null;
    if (key === 'revenue')   return (parseFloat(week.bar_revenue) || 0) + (parseFloat(week.floor_revenue) || 0);
    if (key === 'covers')    return parseFloat(week.covers) || 0;
    if (key === 'check_avg') return parseFloat(week.check_avg) || 0;
    if (key === 'labor_pct') return parseFloat(week.labor_pct_blended) || 0;
    return null;
  },

  _measureInitiative(init) {
    const weeks = (App.data.revenue_weeks || []).filter(w => w.period_end);
    const sd = init.start_date;
    if (!sd) return { before: null, after: null, lift: null, weeksAfter: 0 };
    const before = weeks.filter(w => w.period_end < sd).slice(-8);
    const after  = weeks.filter(w => w.period_end >= sd).slice(0, 8);
    const avg = arr => {
      const vals = arr.map(w => this._metricFor(w, init.metric)).filter(v => v != null && !isNaN(v));
      if (!vals.length) return null;
      return vals.reduce((s, v) => s + v, 0) / vals.length;
    };
    const beforeAvg = avg(before);
    const afterAvg  = avg(after);
    const lift = (beforeAvg != null && afterAvg != null) ? (afterAvg - beforeAvg) : null;
    return { before: beforeAvg, after: afterAvg, lift, weeksAfter: after.length };
  },

  buildInitiativesCard() {
    const all = this.initiatives();
    const active = all.filter(i => i.status === 'Active');
    const closed = all.filter(i => i.status !== 'Active');

    const formatLift = (lift, metric) => {
      if (lift == null) return '<span style="color:var(--t4);">no data yet</span>';
      const isLowerBetter = metric === 'labor_pct';
      const positive = isLowerBetter ? lift < 0 : lift > 0;
      const color = positive ? 'var(--gold)' : (lift === 0 ? 'var(--t2)' : 'var(--red)');
      const fmt = (metric === 'revenue' || metric === 'check_avg') ? App.fmtCurrency(lift) : (metric === 'covers' ? lift.toFixed(0) : lift.toFixed(1) + '%');
      return '<span style="color:' + color + ';font-weight:700;">' + (lift >= 0 ? '+' : '') + fmt + '</span>';
    };

    const activeRows = active.length ? active.map(i => {
      const m = this._measureInitiative(i);
      const metricLabel = (this.INITIATIVE_METRICS.find(x => x.key === i.metric) || {}).label || i.metric;
      const windowMsg = m.weeksAfter < 2 ? 'Measuring (week ' + m.weeksAfter + ' of 8)' : m.weeksAfter + ' weeks in';
      const fmtV = v => v == null ? '-' : (i.metric === 'revenue' || i.metric === 'check_avg' ? App.fmtCurrency(v) : i.metric === 'covers' ? Math.round(v) : v.toFixed(1) + '%');
      return '<div style="border-top:1px solid var(--b2);padding:12px 20px;">'
        + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;">'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(i.name) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);">' + esc(i.type || '') + ' &middot; started ' + esc(i.start_date || '') + ' &middot; ' + esc(windowMsg) + '</div>'
        + '</div>'
        + (i.hypothesis ? '<div style="font-size:11px;color:var(--t3);margin-top:4px;line-height:1.5;">' + esc(i.hypothesis) + '</div>' : '')
        + '<div style="display:flex;gap:18px;margin-top:8px;flex-wrap:wrap;align-items:baseline;">'
        + '<div style="font-size:11px;color:var(--t3);">Watching: <span style="color:var(--t1);">' + esc(metricLabel) + '</span></div>'
        + '<div style="font-size:11px;color:var(--t3);">Before: <span style="color:var(--t1);">' + fmtV(m.before) + '</span></div>'
        + '<div style="font-size:11px;color:var(--t3);">After: <span style="color:var(--t1);">' + fmtV(m.after) + '</span></div>'
        + '<div style="font-size:11px;color:var(--t3);">Lift: ' + formatLift(m.lift, i.metric) + '</div>'
        + '<div style="margin-left:auto;display:flex;gap:6px;">'
        + '<button class="btn btn-ghost btn-sm init-complete" data-id="' + esc(i.id) + '" style="font-size:10px;padding:3px 8px;">Mark Complete</button>'
        + '<button class="btn btn-danger btn-sm init-del" data-id="' + esc(i.id) + '" style="font-size:10px;padding:3px 8px;">Delete</button>'
        + '</div></div></div>';
    }).join('') : '<div style="padding:18px 20px;font-size:12px;color:var(--t3);line-height:1.65;">No active initiatives. Start one when you launch a new menu item, run a promotion, or make a service change you want to measure.</div>';

    const closedRows = closed.length ? '<div style="padding:8px 20px 4px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);border-top:1px solid var(--b2);">Completed</div>'
      + closed.slice().reverse().slice(0, 5).map(i => {
        const m = this._measureInitiative(i);
        return '<div style="padding:8px 20px;display:flex;align-items:center;gap:10px;border-top:1px solid var(--b2);font-size:11px;">'
          + '<span style="color:var(--t2);flex:1;">' + esc(i.name) + '</span>'
          + '<span style="color:var(--t3);">' + esc(i.type || '') + '</span>'
          + '<span>' + formatLift(m.lift, i.metric) + '</span>'
          + '<button class="btn btn-ghost btn-sm init-del" data-id="' + esc(i.id) + '" style="font-size:10px;padding:2px 6px;">Remove</button>'
          + '</div>';
      }).join('') : '';

    return '<div class="card" style="padding:0;overflow:hidden;">'
      + '<div style="padding:14px 20px;display:flex;align-items:center;justify-content:flex-end;">'
      + '<button class="btn btn-ghost btn-sm" id="init-add">+ Start Initiative</button>'
      + '</div>'
      + activeRows + closedRows + '</div>';
  },

  wireInitiatives(container) {
    document.getElementById('init-add')?.addEventListener('click', () => this.showInitiativeForm());
    container.querySelectorAll('.init-complete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const i = this.initiatives().find(x => x.id === btn.dataset.id);
        if (!i) return;
        i.status = 'Completed';
        i.completed_at = new Date().toISOString();
        await App.saveKey('initiatives');
        this.render(container, document.getElementById('topbar-actions') || document.createElement('div'));
      });
    });
    container.querySelectorAll('.init-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await App.confirmDelete();
        if (!ok) return;
        App.data.initiatives = this.initiatives().filter(x => x.id !== btn.dataset.id);
        await App.saveKey('initiatives');
        this.render(container, document.getElementById('topbar-actions') || document.createElement('div'));
      });
    });
  },

  showInitiativeForm() {
    const typeOpts = this.INITIATIVE_TYPES.map(t => '<option>' + esc(t) + '</option>').join('');
    const metricOpts = this.INITIATIVE_METRICS.map(m => '<option value="' + esc(m.key) + '">' + esc(m.label) + '</option>').join('');
    const today = App.todayLocal();
    const body = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">Start Initiative</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f" style="flex:1;min-width:200px;"><label>Name</label><input type="text" id="init-name" placeholder="New Cocktail Menu"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>Start Date</label><input type="date" id="init-date" value="' + today + '"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f" style="width:180px;"><label>Type</label><select id="init-type">' + typeOpts + '</select></div>'
        + '<div class="f" style="flex:1;min-width:200px;"><label>Watch Metric</label><select id="init-metric">' + metricOpts + '</select></div>'
      + '</div>'
      + '<div class="f" style="width:100%;"><label>What you changed (optional)</label><textarea class="notes-ta" id="init-hyp" rows="2" placeholder="Launched 6 new cocktails Aug 1, expecting a check average lift"></textarea></div>'
      + '<div class="card-actions">'
        + '<button type="button" id="init-save" class="btn btn-primary">Start Initiative</button>'
        + '<button type="button" id="init-cancel" class="btn btn-ghost">Cancel</button>'
        + '<span id="init-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(body, { id: 'init-modal', maxWidth: 540, noClose: true });
    document.getElementById('init-cancel').addEventListener('click', () => App.closeModal('init-modal'));
    document.getElementById('init-save').addEventListener('click', async () => {
      const name = document.getElementById('init-name')?.value.trim();
      const date = document.getElementById('init-date')?.value;
      const err = document.getElementById('init-err');
      const fail = msg => { if (err) { err.textContent = msg; err.style.display = 'inline'; } };
      if (!name) { fail('Name is required.'); return; }
      if (!date) { fail('Start date is required.'); return; }
      this.initiatives().push({
        id: App.uid(),
        name,
        start_date: date,
        type: document.getElementById('init-type')?.value || 'Other',
        metric: document.getElementById('init-metric')?.value || 'revenue',
        hypothesis: document.getElementById('init-hyp')?.value.trim() || '',
        status: 'Active',
        created_at: new Date().toISOString()
      });
      await App.saveKey('initiatives');
      App.closeModal('init-modal');
      const c = this.container || document.getElementById('content-area') || document.querySelector('.content');
      const a = document.getElementById('topbar-actions') || document.createElement('div');
      if (c) this.render(c, a);
    });
  },

  // Bar Cop Insights — a written read on the recent revenue + labor trend.
  showInsights() {
    if (App.demoBlock && App.demoBlock('Bar Cop Insights')) return;
    const weeks = (App.data.revenue_weeks || []).filter(w => (w.bar_revenue || 0) + (w.floor_revenue || 0) > 0).sort((a, b) => (a.period_end || '').localeCompare(b.period_end || '')).slice(-8);
    if (weeks.length < 2) { DashUI.insightsModal('Bar Cop Insights', 'Enter at least two weeks of data and Bar Cop can read the trend for you.'); return; }
    const btn = document.getElementById('r-insights-btn');
    const orig = btn ? btn.textContent : '';
    const restore = label => { if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; btn.textContent = label || orig || 'Bar Cop Insights'; } };

    const t = App.data.revenue_settings?.targets || {};
    const avg = arr => { const v = arr.filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0; };
    const caT = t.check_avg || 35;
    const lpT = App.laborTargetPct();
    const caVals  = weeks.map(w => w.check_avg).filter(v => v != null);
    const lpVals  = weeks.map(w => w.labor_pct_blended).filter(v => v != null);
    const revVals = weeks.map(w => (w.bar_revenue || 0) + (w.floor_revenue || 0));
    const covVals = weeks.map(w => w.covers).filter(v => v != null);
    const aCA = avg(caVals).toFixed(2), aLP = avg(lpVals).toFixed(1), aRev = avg(revVals).toFixed(0), aCov = avg(covVals).toFixed(0);
    const caTrend = caVals.length >= 3 ? (caVals[caVals.length - 1] - caVals[0] > 1 ? 'trending up, improving' : caVals[0] - caVals[caVals.length - 1] > 1 ? 'trending down, worsening' : 'holding steady') : 'early data';
    const lines = [
      'Check Average: ' + weeks.map(w => w.check_avg ? '$' + w.check_avg.toFixed(2) : 'n/a').join(', ') + ' (target $' + caT + ', avg $' + aCA + ')',
      'Check average trend: ' + caTrend,
      'Labor %: ' + weeks.map(w => w.labor_pct_blended ? w.labor_pct_blended.toFixed(1) + '%' : 'n/a').join(', ') + ' (target ' + lpT.toFixed(1) + '%, avg ' + aLP + '%)',
      'Avg weekly revenue: $' + aRev,
      'Avg covers per week: ' + aCov,
      'Weekly check average gap vs target: $' + Math.abs((parseFloat(aCA) - caT) * parseFloat(aCov)).toFixed(0) + ' ' + (parseFloat(aCA) < caT ? 'below target' : 'at or above target')
    ];
    const prompt = 'You are a 30-year bar and restaurant operator writing a brief, blunt read for a fellow owner. The facts below are computed from this operator\'s own weekly numbers.\n\nSTRICT RULES, follow exactly:\n- Use only the facts below. Do not invent numbers, streaks, or week counts.\n- The current week figure is what the operator is looking at on screen. Never contradict it.\n- Respect the stated trend direction. If on or under target, say so plainly.\n- No emdashes, no dashes used as punctuation, no bullet points, no headers, no AI phrasing. Plain operator sentences.\n\nFACTS:\n' + lines.join('\n') + '\n\nWrite three short paragraphs, one each: first check average against target, then labor efficiency, then the single action that will move revenue most this week. Use the exact numbers from the facts.';

    if (btn) { btn.disabled = true; btn.style.opacity = '0.65'; btn.style.cursor = 'not-allowed'; btn.textContent = 'Analyzing...'; }
    fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }) })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        if (data.error) { DashUI.insightsModal('Bar Cop Insights', 'Could not read the trend right now: ' + esc(data.error.message || 'try again.')); restore('Try Again'); return; }
        const text = data.content?.[0]?.text;
        if (!text) { DashUI.insightsModal('Bar Cop Insights', 'No response came back. Try again.'); restore('Try Again'); return; }
        const clean = text.replace(/—/g, ', ').replace(/–/g, '-').replace(/ -- /g, ', ').replace(/--/g, '-');
        const safe = clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n\n/g, '</p><p style="margin:12px 0 0;">');
        DashUI.insightsModal('Bar Cop Insights', '<p style="margin:0;">' + safe + '</p>');
        restore();
      })
      .catch(err => { DashUI.insightsModal('Bar Cop Insights', 'Connection error: ' + esc(err.message) + '. Check your connection and try again.'); restore('Try Again'); });
  }
};
