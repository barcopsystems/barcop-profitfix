'use strict';
S.TrafficReviews = {
  render(container, actions) {
    actions.innerHTML = '';
    this.container = container;
    this.draw();
  },

  draw() {
    const container = this.container;
    const ts    = App.data.traffic_settings || {};
    const prof  = ts.profile || {};
    const tGR   = ts.targets?.google_rating   || 4.3;
    const tRV   = ts.targets?.review_velocity || 8;
    const tRR   = ts.targets?.response_rate   || 75;
    const tYR   = 4.0;
    const weeks = App.data.traffic_weeks || [];
    const latest = weeks.length ? weeks[weeks.length - 1] : null;
    const prev   = weeks.length > 1 ? weeks[weeks.length - 2] : null;

    const trend = (cur, was, suffix) => {
      if (cur == null || was == null) return ' ';
      const diff = cur - was;
      if (Math.abs(diff) < 0.01) return 'No change vs last week';
      const amt = suffix === '★' ? Math.abs(diff).toFixed(1) : Math.round(Math.abs(diff)).toLocaleString();
      return (diff > 0 ? '↑ ' : '↓ ') + amt + (suffix || '') + ' vs last week';
    };
    const card = (label, val, targetStr, onTarget, trendStr) => {
      const valHtml = val == null
        ? '<div class="metric-val" style="color:var(--t4);font-size:22px;">No data</div>'
        : '<div class="metric-val ' + (onTarget == null ? '' : onTarget ? 'on-target' : 'over-target') + '">' + val + '</div>';
      return '<div class="metric-card"><div class="metric-label">' + label + '</div>' + valHtml
        + '<div class="metric-target">' + targetStr + '</div>'
        + '<div class="metric-trend">' + (trendStr || ' ') + '</div></div>';
    };

    const gr = latest?.google_rating ?? null;
    const yr = latest?.yelp_rating ?? null;
    const nr = latest?.new_reviews ?? null;
    const rr = latest?.response_rate ?? null;

    const cards =
        card('Google Rating',   gr != null ? gr.toFixed(1) + '★' : null,  'Target: ' + tGR + '★',   gr != null ? gr >= tGR : null, trend(gr, prev?.google_rating, '★'))
      + card('Yelp Rating',     yr != null ? yr.toFixed(1) + '★' : null,  'Target: ' + tYR + '★',   yr != null ? yr >= tYR : null, trend(yr, prev?.yelp_rating, '★'))
      + card('Review Velocity', nr != null ? nr + '/mo' : null,           'Target: ' + tRV + '/mo', nr != null ? nr >= tRV : null, trend(nr, prev?.new_reviews, ''))
      + card('Response Rate',   rr != null ? Math.round(rr) + '%' : null, 'Target: ' + tRR + '%',   rr != null ? rr >= tRR : null, trend(rr, prev?.response_rate, '%'));

    // ── Trend charts ──
    const recent = weeks.slice(-8);
    const velChart = App.trendChart({
      title: 'Review Velocity — New Reviews per Month',
      target: tRV,
      points: recent.map(w => ({ label: 'Wk ' + w.week_num, value: w.new_reviews ?? null }))
    });
    const rrChart = App.trendChart({
      title: 'Response Rate Trend',
      target: tRR,
      points: recent.map(w => ({ label: 'Wk ' + w.week_num, value: w.response_rate ?? null }))
    });

    // ── Review monitoring inputs ──
    const age = prof.rev_age != null ? prof.rev_age : '';
    const inputsCard = '<div class="card">'
      + '<div class="card-title">Review Monitoring</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:200px;"><label>Most Recent Review Age ' + tt('t-review-age') + '</label><div class="fw"><input class="suf" type="number" id="rev-age" value="' + esc(String(age)) + '" min="0"/><span class="suf">days ago</span></div></div>'
      + '</div>'
      + '<div class="f" style="margin-bottom:14px;"><label>Negative Patterns Noted ' + tt('t-review-patterns') + '</label>'
      + '<textarea id="rev-patterns" rows="2" placeholder="Recurring complaints or themes across recent reviews — slow service, noise, a specific dish.">' + esc(prof.rev_patterns || '') + '</textarea></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="rev-save">Save</button>'
      + '<span id="rev-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--gold);display:none;margin-left:8px;">Saved.</span>'
      + '</div></div>';

    // ── Action items ──
    const tips = [];
    if (gr != null && gr < tGR) tips.push('Google rating is ' + gr.toFixed(1) + '★, below the ' + tGR + '★ target. Ask happy guests for a review at the table or on the receipt.');
    if (yr != null && yr < tYR) tips.push('Yelp rating is ' + yr.toFixed(1) + '★, below the ' + tYR + '★ benchmark. Yelp runs lower than Google, but under 4.0 hurts.');
    if (nr != null && nr < tRV) tips.push('Only ' + nr + ' new reviews this month, below the ' + tRV + '/month target. A steady stream of fresh reviews matters more than the all-time count.');
    if (rr != null && rr < tRR) tips.push('Response rate is ' + Math.round(rr) + '%, below the ' + tRR + '% target. Reply to every review, positive and negative.');
    if (age !== '' && Number(age) > 14) tips.push('Most recent review is ' + age + ' days old. Reviews have gone quiet — prompt guests this week.');
    if (prof.rev_patterns && prof.rev_patterns.trim()) tips.push('Negative pattern on file: "' + prof.rev_patterns.trim() + '". Fix the root cause, not just the reply.');
    if (!latest) tips.push('No weekly data yet. Enter a week in This Week to score this section.');

    const tipsCard = tips.length
      ? '<div class="card"><div class="card-title">Action Items</div>'
        + tips.map((t,i) =>
            '<div style="display:flex;gap:12px;padding:9px 0;' + (i < tips.length-1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:var(--t3);width:22px;flex-shrink:0;">' + (i+1) + '</div>'
            + '<div style="font-size:13px;color:var(--t1);line-height:1.5;">' + esc(t) + '</div></div>'
          ).join('')
        + '</div>'
      : '<div class="card"><div class="empty"><div class="empty-title">Reviews Looking Good</div>'
        + '<div class="empty-sub">Ratings, velocity, and response rate are all on target. Keep replying to every review.</div></div></div>';

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + velChart + rrChart
      + inputsCard
      + tipsCard
      + '</div>';

    document.getElementById('rev-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const ts = App.data.traffic_settings || (App.data.traffic_settings = {});
    const prof = ts.profile || (ts.profile = {});
    const age = parseInt(document.getElementById('rev-age')?.value);
    prof.rev_age = isNaN(age) ? null : age;
    prof.rev_patterns = document.getElementById('rev-patterns')?.value || '';
    const ok = await App.saveKey('traffic_settings');
    this.draw();
    const msg = document.getElementById('rev-msg');
    if (msg) {
      msg.textContent = ok ? 'Saved.' : 'Save failed.';
      msg.style.color = ok ? 'var(--gold)' : 'var(--red)';
      msg.style.display = 'inline';
    }
  }
};
