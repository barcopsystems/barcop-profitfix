'use strict';
S.Dashboard = {
  showHowTo() {
    App.showHelpModal('How the Profit Dashboard Works', [
      { p: ['The Profit Recovery landing runs the whole loop on one page: how much you have recovered up top, where the operation is leaking right now and your costs against target just under it, your profit forecast and your audit below that, and the jobs you run most at the bottom. Every number is computed from your own logged data, never an industry average. Before you have run an audit or logged a week, a Get Started strip points you at your first audit and the Control sections that feed Recovery.'] },
      { h: 'Recovery Scoreboard', p: ['The headline is what Bar Cop has measured you put back in the register since you marked each fix implemented. Realized to date, not a projection. A figure appears once two weeks of after-data exist and firms up over the next six. An on-pace-for-the-year number, when shown, is a clearly labeled secondary line, never banked cash.'] },
      { h: 'Where You\'re Leaking Now', p: ['Your cost gaps as plain text, biggest dollar leak first. Pour Cost and Food Cost carry a live dollar a year at this week\'s pace because Bar Cop has a weekly metric for them. Theft and Loss and Vendor Control do not dollarize into a clean weekly leak, so they read as a Review row you tap to work on their own screen. Tap any row to open its fix process. Labor is part of prime cost but is worked in Revenue Recovery, so it lives on that dashboard, not here.'] },
      { h: 'Cost vs Target', p: ['Your bar pour cost, food cost, and prime cost from your latest confirmed week, each against its own target. Green is at or under target, red is over. Tap Insights for a written read on where the numbers are heading.'] },
      { h: 'Profit Forecast and Profit Audit', p: ['Profit Forecast projects your profit out twelve months at your recent pace, plus what hitting your cost targets is worth. Profit Audit shows your latest score and when the next one can run. Both open their full screen with a tap.'] },
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
  // Leaking Now as text + the 8-week trend), a standard row (This Week + Profit
  // Audit), then Quick Actions. Same skeleton clones to Revenue and Traffic.
  renderFull(container) {
    const weeks   = (App.data && App.data.weeks) || [];
    const targets = (App.data && App.data.settings && App.data.settings.targets) || {};
    const leak = FixPanel.leakRowsText('profit');
    const leakBody = leak || '<div style="font-size:12px;color:var(--t3);line-height:1.6;">Run a Profit Audit and log a week, and your leaks rank here, biggest first.</div>';
    const insightsBtn = '<button class="btn btn-ghost btn-sm" id="db-insights-btn" style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Insights</button>';
    container.innerHTML = '<div class="screen">'
      + FixPanel._scoreboardCard('profit')
      + this.row(this.shPanel('Where You\'re Leaking Now', leakBody), this.shPanel('Cost vs Target', this.costPanel(weeks.slice(-8), targets), insightsBtn))
      + this.row(this.shPanel('Profit Forecast', this.forecastPanel()), this.shPanel('Profit Audit', this.auditPanel()))
      + this.quickActions()
      + '</div>';
    FixPanel.wireFixAreas(container);
    document.getElementById('db-insights-btn')?.addEventListener('click', () => this.showInsights());
    this.wireQuick(container);
  },

  // Equal-height two-column row (the Control-dashboard pattern).
  row(a, b) {
    return '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;align-items:stretch;">'
      + '<div style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;">' + a + '</div>'
      + '<div style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;">' + b + '</div></div>';
  },

  // Heading-outside panel (Control-dashboard style): .sh title above a flex card.
  // The heading is a fixed-height single-line row so titles line up across the
  // row and the cards below start at the same Y; flex:1 + the row's align-items
  // stretch then make both cards equal height.
  shPanel(title, bodyHtml, titleRight) {
    const sh = '<div class="sh" style="margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + title + '</div>';
    const head = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:22px;margin:0 0 10px;">' + sh + (titleRight || '') + '</div>';
    return head + '<div class="card" style="flex:1;">' + bodyHtml + '</div>';
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

  // Profit Audit panel — latest score + next-audit timing + a way in.
  auditPanel() {
    const audits = ((App.data && App.data.audits) || []).slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const latest = audits[0];
    if (!latest) return '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:12px;">Run your first Profit Audit for a baseline across pour cost, theft and loss, food cost, vendors, and prime cost.</div>'
      + '<button class="btn btn-ghost btn-sm db-qa" data-go="audit-tracker">Run Profit Audit</button>';
    const score = latest.overall_score || 0;
    const col = App.scoreColor(score);
    const daysSince = latest.date ? Math.floor((Date.now() - new Date(latest.date + 'T00:00:00').getTime()) / 86400000) : Infinity;
    const daysLeft = Math.max(0, 30 - daysSince);
    const timing = daysLeft > 0 ? 'Next audit in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') : 'Ready to run a new audit';
    return '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:700;color:' + col + ';line-height:1;">' + score + '</div>'
      + '<div><div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' + col + ';">' + esc(App.scoreLabel(score)) + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (latest.date || '').slice(0, 10) + '</div></div></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:12px;">' + timing + '</div>'
      + '<button class="btn btn-ghost btn-sm db-qa" data-go="audit-tracker">View Audit</button>';
  },

  // Day one (no weeks, no audits): guided steps + placeholders, like Control. The
  // Recovery day-one points at the first audit and the Control feeds, not a prereq
  // checklist; the wow visuals switch on only once data backs them.
  renderDayOne(container) {
    const hasAudit = ((App.data && App.data.audits) || []).length > 0;
    const hasInv   = ((App.inventoryData && App.inventoryData.ic_products) || []).length > 0;
    const hasShift = ((App.shiftData && App.shiftData.sc_shifts) || []).length > 0;
    const hasLabor = ((App.laborData && App.laborData.lc_actuals) || []).length > 0;

    const step = (done, num, label, go, cross) =>
      '<div class="db-go" data-go="' + go + '"' + (cross ? ' data-cross="1"' : '') + ' style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;min-width:200px;padding:11px 13px;border:1px solid ' + (done ? 'var(--b2)' : 'var(--gold-tint-bord)') + ';border-radius:8px;background:' + (done ? 'var(--input)' : 'var(--gold-tint)') + ';">'
      + '<span style="width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;' + (done ? 'background:var(--gold);color:var(--bg);' : 'border:1px solid var(--t3);color:var(--t3);') + '">' + (done ? '&#10003;' : num) + '</span>'
      + '<span style="font-size:12px;font-weight:600;color:var(--t1);">' + label + '</span></div>';

    const strip = '<div class="card form-card" style="margin-bottom:14px;">'
      + '<div class="card-title">Get Started</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">Run your first Profit Audit for a baseline, and set up the Control sections that feed Recovery. As that data lands, this dashboard fills in with your recovered dollars and where the operation is leaking.</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + step(hasAudit, 1, 'Run your first Profit Audit', 'audit-tracker', false)
      + step(hasInv,   2, 'Set up Inventory Control', 'ic-dashboard', true)
      + step(hasShift, 3, 'Set up Shift Control', 'sc-dashboard', true)
      + step(hasLabor, 4, 'Set up Labor Control', 'lc-dashboard', true)
      + '</div></div>';

    const ph = (msg) => '<div style="font-size:13px;color:var(--t3);line-height:1.6;">' + msg + '</div>';

    container.innerHTML = '<div class="screen">'
      + strip
      + '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Recovery Scoreboard</div>'
        + ph('Your recovered dollars show here once you log your first fix. Bar Cop measures the metric before and after the fix and reports only what is real.') + '</div>'
      + this.row(
          this.shPanel('Where You\'re Leaking Now', ph('Your cost gaps rank here once a week of data lands, biggest dollar first, each one a tap into the fix process.')),
          this.shPanel('Cost vs Target', ph('Your bar pour, food, and prime cost against target show here once you confirm a week.')))
      + this.row(
          this.shPanel('Profit Forecast', ph('Your profit projected forward shows here once you have a few weeks confirmed in This Week.')),
          this.shPanel('Profit Audit', ph('Your latest Profit Audit score lands here once you run one.')))
      + this.quickActions()
      + '</div>';
    this.wireQuick(container);
  },

  quickActions() {
    const btn = (go, label) => '<button class="btn btn-primary db-qa" data-go="' + go + '" style="flex:1;min-width:150px;">' + label + '</button>';
    return '<div style="margin-top:20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Quick Actions</div>'
      + '<div style="border-top:1px solid var(--b2);padding-top:14px;display:flex;gap:10px;flex-wrap:wrap;">'
      + btn('this-week', 'Enter This Week')
      + btn('audit-tracker', 'Run Profit Audit')
      + btn('profit-forecast', 'Profit Forecast')
      + btn('recipe-cost-analysis', 'Recipe Summary')
      + '</div></div>';
  },

  wireQuick(container) {
    container.querySelectorAll('.db-qa').forEach(b =>
      b.addEventListener('click', () => App.navigate(b.dataset.go)));
    container.querySelectorAll('.db-go').forEach(b =>
      b.addEventListener('click', () => {
        if (b.dataset.cross) App.openScreen(b.dataset.go); else App.navigate(b.dataset.go);
      }));
  },

  // Cost vs Target — your latest confirmed week's bar pour cost, food cost, and
  // prime cost, each as a plain percentage colored by over/under its own target
  // (red over, green at or under). No chart; the written read lives behind the
  // Insights button. Returns inner HTML (shPanel wraps the card).
  costPanel(weeks, targets) {
    const metrics = [
      { label: 'Bar Pour Cost', vals: weeks.map(w => (w && w.bar)  ? (w.bar.cost_pct  != null ? w.bar.cost_pct  : null) : null), tgt: targets.bar_pour_cost_pct || 22 },
      { label: 'Food Cost',     vals: weeks.map(w => (w && w.food) ? (w.food.cost_pct != null ? w.food.cost_pct : null) : null), tgt: targets.food_cost_pct || 32 },
      { label: 'Prime Cost',    vals: weeks.map(w => (w && w.prime_cost_pct != null) ? w.prime_cost_pct : null),                   tgt: targets.prime_cost_pct || 60 }
    ];
    if (!metrics.some(m => m.vals.some(v => v != null))) {
      return '<div style="text-align:center;padding:28px 0;color:var(--t4);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Confirm a week to see your costs</div>';
    }

    return metrics.map((m, i) => {
      let li = m.vals.length - 1; while (li >= 0 && m.vals[li] == null) li--;
      const lastV = li >= 0 ? m.vals[li] : null;
      const col = (lastV != null && lastV > m.tgt) ? 'var(--red)' : (lastV != null ? 'var(--green)' : 'var(--t3)');
      const last = i === metrics.length - 1;
      return '<div style="display:flex;align-items:center;gap:12px;padding:11px 0;' + (last ? '' : 'border-bottom:1px solid var(--row-div);') + '">'
        + '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;color:var(--t1);">' + m.label + '</div>'
        + '<div style="font-size:10px;color:var(--t3);">target ' + m.tgt + '%</div></div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:700;color:' + col + ';">' + (lastV != null ? lastV.toFixed(1) + '%' : 'n/a') + '</div>'
        + '</div>';
    }).join('');
  },

  showInsights() {
    if (App.demoBlock && App.demoBlock('AI Trend Insights')) return;
    const ID = 'db-insights';
    const weeks = (App.data.weeks || []).slice(-8);
    const wrap = inner => '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">Trend Insights</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.85;">' + inner + '</div>'
      + '<div class="card-actions"><button class="btn btn-ghost" onclick="App.closeModal(\'' + ID + '\')">Close</button></div></div>';
    const open = inner => App.openModal(wrap(inner), { id: ID, maxWidth: 600, noClose: true });

    if (weeks.length < 2) { open('Enter at least two weeks of data and Bar Cop can read the trend for you.'); return; }
    open('Reading your last ' + weeks.length + ' weeks&hellip;');

    const t = App.data.settings.targets || {};
    const bT = t.bar_pour_cost_pct || 22, fT = t.food_cost_pct || 32, pT = t.prime_cost_pct || 60;
    const avg = arr => { const v = arr.filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0; };
    const bP = weeks.map(w => w.bar?.cost_pct).filter(v => v != null);
    const fP = weeks.map(w => w.food?.cost_pct).filter(v => v != null);
    const pP = weeks.map(w => w.prime_cost_pct).filter(v => v != null);
    const bR = weeks.map(w => w.bar?.revenue).filter(v => v != null);
    const aB = avg(bP).toFixed(1), aF = avg(fP).toFixed(1), aP = avg(pP).toFixed(1), aR = avg(bR);
    const gap = ((parseFloat(aB) - bT) / 100 * aR).toFixed(0);
    const trend = bP.length >= 3 ? (bP[bP.length - 1] - bP[0] > 1 ? 'trending higher (worsening)' : bP[0] - bP[bP.length - 1] > 1 ? 'trending lower (improving)' : 'holding steady') : 'early data';
    const lines = [
      'Bar Pour Cost %: ' + weeks.map(w => (w.bar?.cost_pct || 0).toFixed(1) + '%').join(', ') + ' (target:' + bT + '% avg:' + aB + '%)',
      'Food Cost %: ' + weeks.map(w => (w.food?.cost_pct || 0).toFixed(1) + '%').join(', ') + ' (target:' + fT + '% avg:' + aF + '%)',
      'Prime Cost %: ' + weeks.map(w => (w.prime_cost_pct || 0).toFixed(1) + '%').join(', ') + ' (target:' + pT + '% avg:' + aP + '%)',
      'Bar Revenue: ' + weeks.map(w => '$' + Math.round(w.bar?.revenue || 0)).join(', '),
      'Weekly gap vs bar target: $' + Math.abs(gap) + ' ' + (parseFloat(gap) > 0 ? 'over' : 'under'),
      'Pour cost trend: ' + trend
    ];
    const prompt = 'You are a 30-year bar and restaurant operator writing a brief analysis for a fellow owner. Write 3 short paragraphs, one insight each, based on the data below. Rules: no emdashes, no dashes used as punctuation, no bullet points, no headers, no AI language. Write the way an experienced operator talks to another operator. Plain sentences. Specific numbers. Direct about what needs to change and exactly what to do about it this week.\n\n' + lines.join('\n') + '\n\nLead with the most urgent cost issue, then revenue trend, then the single action that will matter most this week.';

    fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }) })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        if (data.error) { open('Could not read the trend right now: ' + esc(data.error.message || 'try again.')); return; }
        const text = data.content?.[0]?.text;
        if (!text) { open('No response came back. Try again.'); return; }
        const clean = text.replace(/—/g, ', ').replace(/–/g, '-').replace(/ -- /g, ', ').replace(/--/g, '-');
        const safe = clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/\n\n/g, '</p><p style="margin:12px 0 0;">');
        open('<p style="margin:0;">' + safe + '</p>');
      })
      .catch(err => open('Connection error: ' + esc(err.message) + '. Check your connection and try again.'));
  }
};
