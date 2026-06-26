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
      { h: 'This Week vs Target', p: ['Your check average, labor cost, and revenue per labor hour from your latest confirmed week, each against its own target. Green is hitting it, red is missing it. Tap Bar Cop Briefing for a written read on where the numbers are heading.'] },
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
    const insightsBtn = '<button class="btn btn-ghost btn-sm" id="r-insights-btn" style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Bar Cop Briefing</button>';
    const metricsBody = DashUI.metricsPanel(this.metricsRows(latest, t), 'Confirm a week to see your numbers');

    container.innerHTML = '<div class="screen">'
      + FixPanel._scoreboardCard('revenue', insightsBtn)
      + DashUI.row(
          DashUI.shPanel('Where You\'re Leaking Now', leakBody),
          DashUI.shPanel('This Week vs Target', metricsBody))
      + DashUI.row(
          DashUI.shPanel('Revenue Forecast', this.forecastPanel(latest)),
          DashUI.shPanel('Revenue Audit', DashUI.auditPanel({
            audits: App.data.revenue_audits,
            screen: 'r-audit',
            runText: 'Run Revenue Audit',
            emptyText: 'Run your first Revenue Audit for a baseline across check average, menu mix, server performance, and labor efficiency.'
          })))
      + '<div class="sh" style="margin:24px 0 10px;">Initiative Tracker</div>'
      + InitiativeTracker.card('revenue')
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
    InitiativeTracker.wire('revenue', container, () => this.render(this.container, document.getElementById('topbar-actions') || document.createElement('div')));
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
          'Four steps and this dashboard fills in with your recovered dollars, where the top line is leaking, and this week against target.',
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

  // Bar Cop Briefing — a written read on the recent revenue + labor trend.
  showInsights() {
    if (App.demoBlock && App.demoBlock('Bar Cop Briefing')) return;
    const weeks = (App.data.revenue_weeks || []).filter(w => (w.bar_revenue || 0) + (w.floor_revenue || 0) > 0).sort((a, b) => (a.period_end || '').localeCompare(b.period_end || '')).slice(-8);
    if (weeks.length < 2) { DashUI.insightsModal('Bar Cop Briefing', 'Enter at least two weeks of data and Bar Cop can read the trend for you.'); return; }
    const rec = DashUI._insRec('revenue');
    if (rec && DashUI._insFresh(rec)) { DashUI.insightsModal('Bar Cop Briefing', rec.html, rec.generated_at); return; }
    const btn = document.getElementById('r-insights-btn');
    const orig = btn ? btn.textContent : '';
    const restore = label => { if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; btn.textContent = label || orig || 'Bar Cop Briefing'; } };

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
    const prompt = 'You are a 30-year bar and restaurant operator writing a read for a fellow owner. The facts below are computed from this operator\'s own weekly numbers.\n\nTalk straight across the bar. Give the numbers as they are, the good, the bad, and the ugly, in depth and specific. Do not teach, explain the basics, lecture, or hand out pep talks. No motivational lines, nothing like "you already know what to do," nothing that talks down to the reader. You can be dry and a little funny, and you can weave in a quick bit of bar-floor storytelling so a rough number reads easy instead of stinging, but never at the operator\'s expense and never invented. No emdashes, no double dashes, no bullet points, no headers, no AI words (cadence, leverage, robust, going forward, ecosystem, synthesize, comprehensive, seamless).\n\nSTAY TRUE TO THE FACTS:\n- Use only the facts below. Do not invent numbers, streaks, or week counts.\n- The current week figure is what the operator is looking at on screen. Never contradict it.\n- Respect the stated trend direction. If on or under target, say so plainly.\n\nFACTS:\n' + lines.join('\n') + '\n\nWrite three short paragraphs, one each: first check average against target, then labor efficiency, then the single action that will move revenue most this week. Use the exact numbers from the facts.';

    if (btn) { btn.disabled = true; btn.style.opacity = '0.65'; btn.style.cursor = 'not-allowed'; btn.textContent = 'Analyzing...'; }
    fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }) })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        if (data.error) { DashUI.insightsModal('Bar Cop Briefing', 'Could not read the trend right now: ' + esc(data.error.message || 'try again.')); restore('Try Again'); return; }
        const text = data.content?.[0]?.text;
        if (!text) { DashUI.insightsModal('Bar Cop Briefing', 'No response came back. Try again.'); restore('Try Again'); return; }
        const clean = text.replace(/—/g, ', ').replace(/–/g, '-').replace(/ -- /g, ', ').replace(/--/g, '-');
        const safe = clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n\n/g, '</p><p style="margin:12px 0 0;">');
        const html = '<p style="margin:0;">' + safe + '</p>';
        DashUI.insightsModal('Bar Cop Briefing', html, DashUI._insSave('revenue', html));
        restore();
      })
      .catch(err => { DashUI.insightsModal('Bar Cop Briefing', 'Connection error: ' + esc(err.message) + '. Check your connection and try again.'); restore('Try Again'); });
  }
};
