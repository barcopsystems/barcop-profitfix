'use strict';
S.Dashboard = {
  showHowTo() {
    App.showHelpModal('How the Profit Dashboard Works', [
      { p: ['The Profit Recovery landing runs the whole loop on one page: how much you have recovered up top, where the operation is leaking right now and your costs against target just under it, your profit forecast and your audit below that, and the jobs you run most at the bottom. Every number is computed from your own logged data, never an industry average. Before you have run an audit or logged a week, a Get Started strip points you at your first audit and the Control sections that feed Recovery.'] },
      { h: 'Recovery Scoreboard', p: ['The headline is what Bar Cop has measured you put back in the register since you marked each fix implemented. Realized to date, not a projection. A figure appears once two weeks of after-data exist and firms up over the next six. An on-pace-for-the-year number, when shown, is a clearly labeled secondary line, never banked cash.'] },
      { h: 'Where You\'re Leaking Now', p: ['Your cost gaps as plain text, biggest dollar leak first. Pour Cost and Food Cost carry a live dollar a year at this week\'s pace because Bar Cop has a weekly metric for them. Theft and Loss and Vendor Control do not dollarize into a clean weekly leak, so they read as a Review row you tap to work on their own screen. Tap any row to open its fix process. Labor is part of prime cost but is worked in Revenue Recovery, so it lives on that dashboard, not here.'] },
      { h: 'Cost vs Target', p: ['Your bar pour cost, food cost, and prime cost from your latest confirmed week, each against its own target. Green is at or under target, red is over. Tap Bar Cop Briefing for a written read on where the numbers are heading.'] },
      { h: 'Profit Forecast and Profit Audit', p: ['Profit Forecast projects your profit forward at your recent pace, plus what hitting your cost targets is worth. The panel here reads twelve months; open the full screen to switch the horizon between a month, a quarter, six months, or a year. Profit Audit shows your latest score and when the next one can run. Both open their full screen with a tap.'] },
      { h: 'Quick Actions', p: ['The four jobs you run most from here: enter this week\'s numbers, run a Profit Audit, open the Profit Forecast, and open Recipe Summary.'] }
    ]);
  },

  render(container, actions) {
    if (actions) actions.innerHTML = '';
    this.container = container;
    const weeks  = (App.data && App.data.weeks)  || [];
    const audits = (App.data && App.data.audits) || [];
    if (weeks.length === 0 && audits.length === 0) this.renderDayOne(container);
    else this.renderFull(container);
  },

  // Populated dashboard: Recovery Scoreboard hero, a diagnosis row (Where You're
  // Leaking Now as text + Cost vs Target), a standard row (Profit Forecast +
  // Profit Audit), then Quick Actions. Layout via the shared DashUI.
  renderFull(container) {
    // weeks load newest-first from the event store, so sort a copy ascending by
    // period_end before any positional slice/last-element read (event-store gotcha).
    const weeks   = ((App.data && App.data.weeks) || []).slice().sort((a, b) => (a.period_end || '').localeCompare(b.period_end || ''));
    const targets = (App.data && App.data.settings && App.data.settings.targets) || {};
    const leak = FixPanel.leakRowsText('profit');
    const leakBody = leak || '<div style="font-size:12px;color:var(--t3);line-height:1.6;">Run a Profit Audit and log a week, and your leaks rank here, biggest first.</div>';
    const insightsBtn = '<button class="btn btn-ghost btn-sm" id="db-insights-btn" style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Bar Cop Briefing</button>';
    container.innerHTML = '<div class="screen">'
      + FixPanel._scoreboardCard('profit', insightsBtn)
      + DashUI.row(
          DashUI.shPanel('Where You\'re Leaking Now', leakBody),
          DashUI.shPanel('Cost vs Target', this.costPanel(weeks.slice(-8), targets)))
      + DashUI.row(
          DashUI.shPanel('Profit Forecast', this.forecastPanel()),
          DashUI.shPanel('Profit Audit', DashUI.auditPanel({
            audits: App.data.audits,
            screen: 'audit-tracker',
            runText: 'Run Profit Audit',
            emptyText: 'Run your first Profit Audit for a baseline across pour cost, theft and loss, food cost, vendors, and prime cost.'
          })))
      + '<div class="sh" style="margin:24px 0 10px;">Initiative Tracker</div>'
      + InitiativeTracker.card('profit')
      + DashUI.quickActions([
          { go: 'this-week', label: 'Enter This Week' },
          { go: 'audit-tracker', label: 'Run Profit Audit' },
          { go: 'profit-forecast', label: 'Profit Forecast' },
          { go: 'recipe-cost-analysis', label: 'Recipe Summary' }
        ])
      + '</div>';
    FixPanel.wireFixAreas(container);
    document.getElementById('db-insights-btn')?.addEventListener('click', () => this.showInsights());
    DashUI.wireQuick(container);
    InitiativeTracker.wire('profit', container, () => this.render(this.container, document.getElementById('topbar-actions') || document.createElement('div')));
  },

  // Profit Forecast panel — profit projected forward twelve months, plus what
  // hitting your cost targets is worth. Reuses the Profit Forecast engine so the
  // dashboard and the full screen never disagree. Forward-looking complement to
  // the backward Scoreboard and the Audit score beside it.
  forecastPanel() {
    const PF = S.ProfitForecast;
    const placeholder = '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:12px;">Confirm a few weeks in This Week and Bar Cop projects your profit forward, at your recent pace and at your cost targets.</div>'
      + '<button class="btn btn-ghost btn-sm db-qa" data-go="profit-forecast">Open Profit Forecast</button>';
    if (!PF) return placeholder;
    const rr = PF.runRates();
    if (rr.nW < PF.MIN_WEEKS) return placeholder;
    const targetP = (PF.targets().prime_cost_pct ?? 60) / 100;
    const sales     = rr.avgWeeklyRev * 52;
    const opexTot   = (rr.avgWeeklyOpex + rr.avgWeeklyPF) * 52;
    const profitCur = sales - sales * rr.primePctCurrent - opexTot;
    const profitTgt = sales - sales * targetP - opexTot;
    const swing     = Math.max(0, profitTgt - profitCur);
    const label = rr.opexLogged ? 'Projected Operating Profit, next 12 months' : 'Profit Before Operating Costs, next 12 months';
    const money = n => App.fmtCurrency(n, 0);
    return '<div style="font-size:11px;color:var(--t3);margin-bottom:5px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:40px;font-weight:700;line-height:1;color:' + (profitCur < 0 ? 'var(--red)' : 'var(--t1)') + ';">' + money(profitCur) + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:6px;">at your recent pace</div>'
      + (swing > 0
          ? '<div style="font-size:13px;font-weight:600;color:var(--gold);margin-top:12px;">+' + money(swing) + ' if you hit your cost targets</div>'
          : '<div style="font-size:13px;font-weight:600;color:var(--green);margin-top:12px;">You are at or above your cost targets</div>')
      + '<div style="margin-top:14px;"><button class="btn btn-ghost btn-sm db-qa" data-go="profit-forecast">Open Profit Forecast</button></div>';
  },

  // Day one (no weeks, no audits): guided steps + placeholders, like Control.
  renderDayOne(container) {
    const hasAudit = ((App.data && App.data.audits) || []).length > 0;
    const hasInv   = ((App.inventoryData && App.inventoryData.ic_products) || []).length > 0;
    const hasShift = ((App.shiftData && App.shiftData.sc_shifts) || []).length > 0;
    const hasLabor = ((App.laborData && App.laborData.lc_actuals) || []).length > 0;
    const ph = DashUI.ph;

    container.innerHTML = '<div class="screen">'
      + DashUI.dayOneStrip(
          'Four steps and this dashboard fills in with your recovered dollars, where you are leaking, and your costs against target.',
          [
            { done: hasAudit, num: 1, label: 'Run your first Profit Audit', go: 'audit-tracker' },
            { done: hasInv,   num: 2, label: 'Set up Inventory Control', go: 'ic-dashboard', cross: true },
            { done: hasShift, num: 3, label: 'Set up Shift Control', go: 'sc-dashboard', cross: true },
            { done: hasLabor, num: 4, label: 'Set up Labor Control', go: 'lc-dashboard', cross: true }
          ])
      + '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Recovery Scoreboard</div>'
        + ph('Your recovered dollars show here once you log your first fix. Bar Cop measures the metric before and after the fix and reports only what is real.') + '</div>'
      + DashUI.row(
          DashUI.shPanel('Where You\'re Leaking Now', ph('Your cost gaps rank here once a week of data lands, biggest dollar first, each one a tap into the fix process.')),
          DashUI.shPanel('Cost vs Target', ph('Your bar pour, food, and prime cost against target show here once you confirm a week.')))
      + DashUI.row(
          DashUI.shPanel('Profit Forecast', ph('Your profit projected forward shows here once you have a few weeks confirmed in This Week.')),
          DashUI.shPanel('Profit Audit', ph('Your latest Profit Audit score lands here once you run one.')))
      + DashUI.quickActions([
          { go: 'this-week', label: 'Enter This Week' },
          { go: 'audit-tracker', label: 'Run Profit Audit' },
          { go: 'profit-forecast', label: 'Profit Forecast' },
          { go: 'recipe-cost-analysis', label: 'Recipe Summary' }
        ])
      + '</div>';
    DashUI.wireQuick(container);
  },

  // Cost vs Target — your latest confirmed week's bar pour cost, food cost, and
  // prime cost, each as a plain percentage colored by over/under its own target
  // (red over, green at or under). No chart; the written read lives behind the
  // Insights button. Returns the metricsPanel card body (shPanel wraps it).
  costPanel(weeks, targets) {
    const metrics = [
      { label: 'Bar Pour Cost', vals: weeks.map(w => (w && w.bar)  ? (w.bar.cost_pct  != null ? w.bar.cost_pct  : null) : null), tgt: targets.bar_pour_cost_pct || 22 },
      { label: 'Food Cost',     vals: weeks.map(w => (w && w.food) ? (w.food.cost_pct != null ? w.food.cost_pct : null) : null), tgt: targets.food_cost_pct || 32 },
      { label: 'Prime Cost',    vals: weeks.map(w => (w && w.prime_cost_pct != null) ? w.prime_cost_pct : null),                   tgt: targets.prime_cost_pct || 60 }
    ];
    if (!metrics.some(m => m.vals.some(v => v != null))) {
      return DashUI.metricsPanel([], 'Confirm a week to see your costs');
    }
    const rows = metrics.map(m => {
      let li = m.vals.length - 1; while (li >= 0 && m.vals[li] == null) li--;
      const lastV = li >= 0 ? m.vals[li] : null;
      const col = (lastV != null && lastV > m.tgt) ? 'var(--red)' : (lastV != null ? 'var(--green)' : 'var(--t3)');
      return { label: m.label, sub: 'target ' + m.tgt + '%', value: lastV != null ? lastV.toFixed(1) + '%' : 'n/a', color: col };
    });
    return DashUI.metricsPanel(rows, 'Confirm a week to see your costs');
  },

  showInsights() {
    if (App.demoBlock && App.demoBlock('Bar Cop Briefing')) return;
    const btn = document.getElementById('db-insights-btn');
    const weeks = (App.data.weeks || []).slice().sort((a, b) => (a.period_end || '').localeCompare(b.period_end || '')).slice(-8);
    if (weeks.length < 2) { DashUI.insightsModal('Bar Cop Briefing', 'Enter at least two weeks of data and Bar Cop can read the trend for you.'); return; }

    // Once-a-week cache (shared with Revenue and Cash): re-open the stored
    // read for free, regenerate only when it is a week old. No manual refresh.
    const rec = DashUI._insRec('profit');
    if (rec && DashUI._insFresh(rec)) { DashUI.insightsModal('Bar Cop Briefing', rec.html, rec.generated_at); return; }

    const t = App.data.settings.targets || {};
    const bT = t.bar_pour_cost_pct || 22, fT = t.food_cost_pct || 32, pT = t.prime_cost_pct || 60;
    const r1 = n => (Math.round(n * 10) / 10).toFixed(1);
    const direction = v => {
      if (v.length < 3) return 'not enough weeks to call a trend';
      const d = v[v.length - 1] - v[0];
      return d > 0.5 ? 'rising, getting worse' : d < -0.5 ? 'falling, improving' : 'holding steady';
    };
    const metricFact = (name, raw, tgt) => {
      const v = raw.filter(x => x != null);
      if (!v.length) return name + ': no weeks logged yet.';
      const cur = v[v.length - 1], avg = v.reduce((s, x) => s + x, 0) / v.length;
      const lo = Math.min(...v), hi = Math.max(...v), over = cur - tgt;
      const overTxt = over > 0.05 ? r1(over) + ' points OVER target' : over < -0.05 ? r1(-over) + ' points under target' : 'right on target';
      return name + ': current week ' + r1(cur) + '%, target ' + tgt + '%, ' + overTxt + '. '
        + 'Last ' + v.length + ' weeks ran ' + r1(lo) + '% to ' + r1(hi) + '%, averaging ' + r1(avg) + '%, '
        + v.filter(x => x > tgt).length + ' of ' + v.length + ' weeks over target. Direction: ' + direction(v) + '.';
    };
    const bP = weeks.map(w => w.bar?.cost_pct);
    const fP = weeks.map(w => w.food?.cost_pct);
    const pP = weeks.map(w => w.prime_cost_pct);
    const bR = weeks.map(w => w.bar?.revenue).filter(v => v != null);
    const aR = bR.length ? bR.reduce((s, x) => s + x, 0) / bR.length : 0;
    const curB = bP.filter(v => v != null).slice(-1)[0];
    const barOver = (curB != null && curB > bT) ? Math.round((curB - bT) / 100 * aR) : 0;
    const facts = [
      metricFact('Bar pour cost', bP, bT),
      metricFact('Food cost', fP, fT),
      metricFact('Prime cost', pP, pT),
      'Bar revenue is averaging about $' + Math.round(aR) + ' a week.',
      barOver > 0
        ? 'At this bar pour cost, the overage is costing about $' + barOver + ' a week.'
        : 'Bar pour cost is at or under target, so there is no pour overage to chase right now.'
    ];
    const prompt = 'You are a 30-year bar and restaurant operator writing a read for a fellow owner. The facts below are already computed from this operator\'s own weekly numbers.\n\n'
      + 'Talk straight across the bar. Give the numbers as they are, the good, the bad, and the ugly, in depth and specific. Do not teach, explain the basics, lecture, or hand out pep talks. No motivational lines, nothing like "you already know what to do," nothing that talks down to the reader. You can be dry and a little funny, and you can weave in a quick bit of bar-floor storytelling so a rough number reads easy instead of stinging, but never at the operator\'s expense and never invented. No emdashes, no double dashes, no bullet points, no headers, no AI words (cadence, leverage, robust, going forward, ecosystem, synthesize, comprehensive, seamless).\n\n'
      + 'STAY TRUE TO THE FACTS:\n'
      + '- Use only the facts below. Do not invent numbers, streaks, or week counts.\n'
      + '- The "current week" figure is the number the operator is looking at on screen. Never contradict it. If current bar pour cost is 22.8%, do not say it is above 23% or stuck high.\n'
      + '- Respect the stated direction. If a metric is falling and improving, do not call it stuck or rising. If it is on or under target, say so plainly.\n'
      + '- State over or under target exactly as given.\n\n'
      + 'FACTS:\n' + facts.join('\n')
      + '\n\nWrite three short paragraphs, one each: first the cost that needs attention most (the one furthest over target, or say plainly if all are at or under target), then what the trends are telling you, then the single action that matters most this week. Use the exact numbers from the facts.';

    const orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.style.opacity = '0.65'; btn.style.cursor = 'not-allowed'; btn.textContent = 'Analyzing...'; }
    const restore = label => { if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; btn.textContent = label || orig || 'Bar Cop Briefing'; } };

    fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }) })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        if (data.error) { DashUI.insightsModal('Bar Cop Briefing', 'Could not read the trend right now: ' + esc(data.error.message || 'try again.')); restore('Try Again'); return; }
        const text = data.content?.[0]?.text;
        if (!text) { DashUI.insightsModal('Bar Cop Briefing', 'No response came back. Try again.'); restore('Try Again'); return; }
        const clean = text.replace(/—/g, ', ').replace(/–/g, '-').replace(/ -- /g, ', ').replace(/--/g, '-');
        const safe = clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/\n\n/g, '</p><p style="margin:12px 0 0;">');
        const html = '<p style="margin:0;">' + safe + '</p>';
        DashUI.insightsModal('Bar Cop Briefing', html, DashUI._insSave('profit', html));
        restore();
      })
      .catch(err => { DashUI.insightsModal('Bar Cop Briefing', 'Connection error: ' + esc(err.message) + '. Check your connection and try again.'); restore('Try Again'); });
  }
};
