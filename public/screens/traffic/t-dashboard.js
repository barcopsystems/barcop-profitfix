'use strict';
// Traffic Recovery landing. Same skeleton as the Profit/Revenue dashboards, via
// DashUI: Recovery Scoreboard hero, Live Links, a diagnosis row (Where You're
// Leaking Now + This Week vs Target), an Online Tracker + Traffic Audit row,
// then Quick Actions. No charts. Header off; nav-i carries the directions; full
// day-one mirror before any data lands.
S.TrafficDashboard = {

  showHowTo() {
    App.showHelpModal('How the Traffic Dashboard Works', [
      { p: ['The Traffic Recovery landing runs the whole loop on one page: how much you have recovered up top, where your demand is leaking right now and your numbers against target under it, then your Online Tracker read and audit. Before you have run an audit or logged a week, a Get Started strip points you at your first audit and your weekly numbers.'] },
      { h: 'Recovery Scoreboard', p: ['What Bar Cop has measured you added back since each fix started running. Website, email, and delivery turn into recovered dollars over time; the rest move your visibility without a clean dollar figure.'] },
      { h: 'Live Links', p: ['One-tap shortcuts to your live Google, Yelp, social, delivery, and email pages, pulled from the links you saved in Settings. Open any to check it without hunting for the URL.'] },
      { h: 'Where You\'re Leaking Now', p: ['Your demand gaps, biggest first. The ones that dollarize show a number; the rest read as a Review row you tap to work on. Tap any row to open its fix.'] },
      { h: 'This Week vs Target', p: ['Your Google rating, review response, website visits, and posting from your latest logged week, each against target. Green is hitting it, red is missing it. Tap Bar Cop Insights for a written read on the trend.'] },
      { h: 'Online Tracker and Traffic Audit', p: ['Online Tracker is the live Strong/Watch/Weak read across all seven areas. Traffic Audit shows your latest score and when the next one can run. Both open with a tap.'] }
    ]);
  },

  targets() { return (App.data.traffic_settings && App.data.traffic_settings.targets) || {}; },
  weeks() { return (App.data.traffic_weeks || []).slice().sort((a, b) => (a.period_end || '').localeCompare(b.period_end || '')); },
  latest() { const w = this.weeks(); return w.length ? w[w.length - 1] : null; },

  render(container, actions) {
    if (actions) actions.innerHTML = '';
    this.container = container;
    const weeks  = App.data.traffic_weeks || [];
    const audits = App.data.traffic_audits || [];
    if (weeks.length === 0 && audits.length === 0) { this.renderDayOne(container); return; }
    this.renderFull(container);
  },

  renderFull(container) {
    const t = this.targets();
    const latest = this.latest();

    const leak = FixPanel.leakRowsText('traffic');
    const leakBody = leak || DashUI.ph('Run a Traffic Audit and log a week, and your biggest demand gaps rank here.');
    const insightsBtn = '<button class="btn btn-ghost btn-sm" id="t-insights-btn" style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Bar Cop Insights</button>';
    const metricsBody = DashUI.metricsPanel(this.metricsRows(latest, t), 'Log a week to see your numbers');

    container.innerHTML = '<div class="screen">'
      + FixPanel._scoreboardCard('traffic', insightsBtn)
      + this.buildLiveLinks()
      + DashUI.row(
          DashUI.shPanel('Where You\'re Leaking Now', leakBody),
          DashUI.shPanel('This Week vs Target', metricsBody))
      + DashUI.row(
          DashUI.shPanel('Online Tracker', this.presencePanel()),
          DashUI.shPanel('Traffic Audit', DashUI.auditPanel({
            audits: App.data.traffic_audits,
            screen: 't-audit',
            runText: 'Run Traffic Audit',
            emptyText: 'Run your first Traffic Audit for a baseline across your Google profile, website, reviews, search, social, delivery, and email.'
          })))
      + '<div class="sh" style="margin:24px 0 10px;">Initiative Tracker</div>'
      + InitiativeTracker.card('traffic')
      + DashUI.quickActions([
          { go: 't-this-week', label: 'Enter This Week' },
          { go: 't-audit', label: 'Run Traffic Audit' },
          { go: 't-presence', label: 'Online Tracker' },
          { go: 't-fix', label: 'Traffic Fix' }
        ])
      + '</div>';

    FixPanel.wireFixAreas(container);
    DashUI.wireQuick(container);
    document.getElementById('t-insights-btn')?.addEventListener('click', () => this.showInsights());
    InitiativeTracker.wire('traffic', container, () => this.render(this.container, document.getElementById('topbar-actions') || document.createElement('div')));
  },

  // This Week vs Target — latest logged week's headline numbers against target.
  metricsRows(latest, t) {
    if (!latest) return [];
    const rows = [];
    const n = v => v != null ? Number(v).toLocaleString('en-US') : null;
    if (latest.google_rating != null) rows.push({
      label: 'Google Rating', sub: 'target ' + (t.google_rating || 4.3) + '★',
      value: latest.google_rating + '★', color: latest.google_rating >= (t.google_rating || 4.3) ? 'var(--green)' : 'var(--red)'
    });
    if (latest.response_rate != null) rows.push({
      label: 'Review Response', sub: 'target ' + (t.response_rate || 75) + '%',
      value: latest.response_rate + '%', color: latest.response_rate >= (t.response_rate || 75) ? 'var(--green)' : 'var(--red)'
    });
    if (latest.monthly_sessions != null) rows.push({
      label: 'Website Visits', sub: 'target ' + n(t.monthly_sessions || 2000),
      value: n(latest.monthly_sessions), color: latest.monthly_sessions >= (t.monthly_sessions || 2000) ? 'var(--green)' : 'var(--red)'
    });
    if (latest.ig_posts_month != null) rows.push({
      label: 'Posts / Mo', sub: 'target ' + (t.social_posts_month || 12),
      value: String(latest.ig_posts_month), color: latest.ig_posts_month >= (t.social_posts_month || 12) ? 'var(--green)' : 'var(--red)'
    });
    return rows;
  },

  // Online Tracker panel — the live Strong/Watch/Weak count across the seven
  // areas, reusing the Online Tracker page's own status logic.
  presencePanel() {
    const open = '<div style="margin-top:14px;"><button class="btn btn-ghost btn-sm db-qa" data-go="t-presence">Open Online Tracker</button></div>';
    if (!(window.S && S.TrafficPresence && S.TrafficPresence.areas) || !this.latest()) {
      return '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:12px;">Log a week and your seven online areas read Strong, Watch, or Weak here, each a tap into its fix.</div>'
        + '<button class="btn btn-ghost btn-sm db-qa" data-go="t-presence">Open Online Tracker</button>';
    }
    const w = S.TrafficPresence.latestWeek();
    const p = (App.data.traffic_settings && App.data.traffic_settings.profile) || {};
    const areas = S.TrafficPresence.areas(w, p, this.targets());
    const c = { Strong: 0, Watch: 0, Weak: 0 };
    areas.forEach(a => { if (c[a.status.label] != null) c[a.status.label]++; });
    const stat = (label, val, color) => '<div style="text-align:center;"><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:30px;font-weight:700;line-height:1;color:' + color + ';">' + val + '</div>'
      + '<div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-top:4px;">' + label + '</div></div>';
    return '<div style="display:flex;gap:30px;align-items:flex-start;">'
      + stat('Strong', c.Strong, c.Strong ? 'var(--green)' : 'var(--t3)')
      + stat('Watch', c.Watch, c.Watch ? 'var(--amber)' : 'var(--t3)')
      + stat('Weak', c.Weak, c.Weak ? 'var(--red)' : 'var(--t3)')
      + '</div>' + open;
  },

  // Day one (no weeks, no audits): guided steps + placeholders mirroring the
  // full layout.
  renderDayOne(container) {
    const hasAudit = (App.data.traffic_audits || []).length > 0;
    const hasWeek  = (App.data.traffic_weeks || []).length > 0;
    const ph = DashUI.ph;

    container.innerHTML = '<div class="screen">'
      + DashUI.dayOneStrip(
          'Three steps and this dashboard fills in with your recovered dollars, where demand is leaking, and your weekly trend.',
          [
            { done: hasAudit, num: 1, label: 'Run your first Traffic Audit', go: 't-audit' },
            { done: hasWeek,  num: 2, label: 'Enter This Week', go: 't-this-week' },
            { done: false,    num: 3, label: 'Check your Online Tracker', go: 't-presence' }
          ])
      + '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Recovery Scoreboard</div>'
        + ph('Your recovered dollars show here once you log your first fix. Website, email, and delivery dollarize; the rest move your visibility without a dollar figure.') + '</div>'
      + DashUI.row(
          DashUI.shPanel('Where You\'re Leaking Now', ph('Your demand gaps rank here once a week of data lands, each a tap into the fix process.')),
          DashUI.shPanel('This Week vs Target', ph('Your Google rating, review response, website visits, and posting against target show here once you log a week.')))
      + DashUI.row(
          DashUI.shPanel('Online Tracker', ph('Your seven online areas read Strong, Watch, or Weak here once you log a week.')),
          DashUI.shPanel('Traffic Audit', ph('Your latest Traffic Audit score lands here once you run one.')))
      + DashUI.quickActions([
          { go: 't-this-week', label: 'Enter This Week' },
          { go: 't-audit', label: 'Run Traffic Audit' },
          { go: 't-presence', label: 'Online Tracker' },
          { go: 't-fix', label: 'Traffic Fix' }
        ])
      + '</div>';
    DashUI.wireQuick(container);
  },

  /* Live Links card — one-click jumps to the operator's saved public platforms.
     Reads traffic_settings.urls (Operation Links in Hub Settings); renders only
     the URLs that are set, hidden entirely when none are. */
  buildLiveLinks() {
    const urls = (App.data.traffic_settings && App.data.traffic_settings.urls) || {};
    const items = (App.TRAFFIC_PLATFORMS || [])
      .map(p => ({ key: p.key, label: p.label, u: urls[p.urlKey] }))
      .filter(x => x.u && x.u.trim());
    if (!items.length) return '';
    const btns = items.map(x =>
      '<a href="' + esc(x.u) + '" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" '
      + 'style="font-size:10px;padding:5px 12px;letter-spacing:0.5px;text-decoration:none;display:inline-flex;align-items:center;gap:5px;">'
      + esc(x.label)
      + '<svg width="9" height="9" viewBox="0 0 9 9" fill="none" style="opacity:0.6;"><path d="M2 2h5v5M7 2L2 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></a>'
    ).join('');
    return '<div class="card" style="padding:14px 20px;margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);flex-shrink:0;">Live Links</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + btns + '</div>'
      + '</div></div>';
  },

  // Bar Cop Insights — a written read on the recent digital-presence trend.
  showInsights() {
    if (App.demoBlock && App.demoBlock('Bar Cop Insights')) return;
    const weeks = this.weeks().slice(-8);
    if (weeks.length < 2) { DashUI.insightsModal('Bar Cop Insights', 'Enter at least two weeks of data and Bar Cop can read the trend for you.'); return; }
    const rec = DashUI._insRec('traffic');
    if (rec && DashUI._insFresh(rec)) { DashUI.insightsModal('Bar Cop Insights', rec.html, rec.generated_at); return; }
    const btn = document.getElementById('t-insights-btn');
    const restore = label => { if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; btn.textContent = label || 'Bar Cop Insights'; } };
    const ts  = this.targets();
    const avg = arr => { const v = arr.filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0; };
    const grVals = weeks.map(w => w.google_rating).filter(v => v != null);
    const rvVals = weeks.map(w => w.new_reviews).filter(v => v != null);
    const rrVals = weeks.map(w => w.response_rate).filter(v => v != null);
    const ssVals = weeks.map(w => w.monthly_sessions).filter(v => v != null);
    const aGR = avg(grVals).toFixed(2), aRV = avg(rvVals).toFixed(1), aRR = avg(rrVals).toFixed(1), aSS = Math.round(avg(ssVals));
    const grTrend = grVals.length >= 3 ? (grVals[grVals.length - 1] - grVals[0] > 0.1 ? 'trending up' : grVals[0] - grVals[grVals.length - 1] > 0.1 ? 'trending down' : 'holding steady') : 'early data';
    const lines = [
      'Google Rating: ' + weeks.map(w => w.google_rating ? w.google_rating.toFixed(1) + '★' : 'n/a').join(', ') + ' (target ' + (ts.google_rating || 4.3) + '★, avg ' + aGR + '★)',
      'Rating trend: ' + grTrend,
      'New reviews/mo: ' + weeks.map(w => w.new_reviews ?? 'n/a').join(', ') + ' (target ' + (ts.review_velocity || 8) + '/mo, avg ' + aRV + ')',
      'Response rate: ' + weeks.map(w => w.response_rate ? w.response_rate.toFixed(0) + '%' : 'n/a').join(', ') + ' (target ' + (ts.response_rate || 75) + '%, avg ' + aRR + '%)',
      'Monthly sessions: ' + weeks.map(w => w.monthly_sessions ?? 'n/a').join(', ') + ' (target ' + (ts.monthly_sessions || 2000) + ', avg ' + aSS + ')'
    ];
    const prompt = 'You are a 30-year bar and restaurant operator writing a brief, blunt read for a fellow owner about their online presence. The facts below are computed from this operator\'s own weekly numbers.\n\nSTRICT RULES, follow exactly:\n- Use only the facts below. Do not invent numbers, streaks, or week counts.\n- Respect the stated trend direction. If on or above target, say so plainly.\n- No emdashes, no dashes used as punctuation, no bullet points, no headers, no AI phrasing. Plain operator sentences.\n\nFACTS:\n' + lines.join('\n') + '\n\nWrite three short paragraphs, one each: first Google rating and review velocity, then website traffic, then the single action that will move local visibility most this week. Use the exact numbers from the facts.';

    if (btn) { btn.disabled = true; btn.style.opacity = '0.65'; btn.style.cursor = 'not-allowed'; btn.textContent = 'Analyzing...'; }
    fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }) })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        if (data.error) { DashUI.insightsModal('Bar Cop Insights', 'Could not read the trend right now: ' + esc(data.error.message || 'try again.')); restore('Try Again'); return; }
        const text = data.content?.[0]?.text;
        if (!text) { DashUI.insightsModal('Bar Cop Insights', 'No response came back. Try again.'); restore('Try Again'); return; }
        const clean = text.replace(/—/g, ', ').replace(/–/g, '-').replace(/ -- /g, ', ').replace(/--/g, '-');
        const safe = clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n\n/g, '</p><p style="margin:12px 0 0;">');
        const html = '<p style="margin:0;">' + safe + '</p>';
        DashUI.insightsModal('Bar Cop Insights', html, DashUI._insSave('traffic', html));
        restore();
      })
      .catch(err => { DashUI.insightsModal('Bar Cop Insights', 'Connection error: ' + esc(err.message) + '. Check your connection and try again.'); restore('Try Again'); });
  }
};
