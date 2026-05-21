'use strict';
S.TrafficReviews = {
  render(container, actions) {
    actions.innerHTML = '';
    const weeks = (App.data.traffic_weeks || []).slice();
    const ts    = App.data.traffic_settings?.targets || {};
    const tGR   = ts.google_rating   || 4.3;
    const tYR   = 4.0;
    const tRV   = ts.review_velocity || 8;
    const tRR   = ts.response_rate   || 75;

    if (!weeks.length) {
      container.innerHTML = '<div class="screen"><div class="card"><div class="empty">'
        + '<div class="empty-title">No Data Yet</div>'
        + '<div class="empty-sub">Save a week in This Week with your Google rating, Yelp rating, new reviews, and response rate to see your review tracker.</div>'
        + '<div style="margin-top:14px;"><button class="btn btn-ghost" onclick="App.navigate(\'t-this-week\')">Go to This Week</button></div>'
        + '</div></div></div>';
      return;
    }

    const latest = weeks[weeks.length - 1];
    const prev   = weeks[weeks.length - 2] || null;

    const trend = (cur, was, suffix) => {
      if (cur == null || was == null) return ' ';
      const diff = cur - was;
      if (Math.abs(diff) < 0.01) return 'No change vs last week';
      const arrow = diff > 0 ? '↑' : '↓';
      const amt   = suffix === '★' ? Math.abs(diff).toFixed(1) : Math.round(Math.abs(diff)).toLocaleString();
      return arrow + ' ' + amt + (suffix || '') + ' vs last week';
    };

    const card = (label, val, targetStr, onTarget, trendStr) => {
      const valHtml = val == null
        ? '<div class="metric-val" style="color:var(--t4);font-size:22px;">No data</div>'
        : '<div class="metric-val ' + (onTarget == null ? '' : onTarget ? 'on-target' : 'over-target') + '">' + val + '</div>';
      return '<div class="metric-card"><div class="metric-label">' + label + '</div>'
        + valHtml
        + '<div class="metric-target">' + targetStr + '</div>'
        + '<div class="metric-trend">' + (trendStr || ' ') + '</div>'
        + '</div>';
    };

    const gr = latest.google_rating, yr = latest.yelp_rating, nr = latest.new_reviews, rr = latest.response_rate;

    const cards =
        card('Google Rating',   gr != null ? gr.toFixed(1) + '★' : null, 'Target: ' + tGR + '★',   gr != null ? gr >= tGR : null, trend(gr, prev?.google_rating, '★'))
      + card('Yelp Rating',     yr != null ? yr.toFixed(1) + '★' : null, 'Target: ' + tYR + '★',   yr != null ? yr >= tYR : null, trend(yr, prev?.yelp_rating, '★'))
      + card('Review Velocity', nr != null ? nr + '/mo' : null,           'Target: ' + tRV + '/mo', nr != null ? nr >= tRV : null, trend(nr, prev?.new_reviews, ''))
      + card('Response Rate',   rr != null ? Math.round(rr) + '%' : null, 'Target: ' + tRR + '%',   rr != null ? rr >= tRR : null, trend(rr, prev?.response_rate, '%'));

    const histRows = weeks.slice().reverse().slice(0,12).map(w =>
      '<tr><td>Wk ' + w.week_num + '</td>'
      + '<td class="' + (w.google_rating == null ? '' : w.google_rating >= tGR ? 'pos' : 'neg') + '">' + (w.google_rating != null ? w.google_rating.toFixed(1) + '★' : '&mdash;') + '</td>'
      + '<td class="' + (w.yelp_rating == null ? '' : w.yelp_rating >= tYR ? 'pos' : 'neg') + '">' + (w.yelp_rating != null ? w.yelp_rating.toFixed(1) + '★' : '&mdash;') + '</td>'
      + '<td class="' + (w.new_reviews == null ? '' : w.new_reviews >= tRV ? 'pos' : 'neg') + '">' + (w.new_reviews != null ? w.new_reviews + '/mo' : '&mdash;') + '</td>'
      + '<td class="' + (w.response_rate == null ? '' : w.response_rate >= tRR ? 'pos' : 'neg') + '">' + (w.response_rate != null ? Math.round(w.response_rate) + '%' : '&mdash;') + '</td>'
      + '</tr>'
    ).join('') || '<tr><td colspan="5" style="color:var(--t3);text-align:center;padding:14px;">No weeks saved yet.</td></tr>';

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + '<div class="sh" style="margin-top:16px;">Review History</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Week</th><th>Google</th><th>Yelp</th><th>New Reviews</th><th>Response Rate</th></tr></thead>'
      + '<tbody>' + histRows + '</tbody></table></div>'
      + '</div>';
  }
};
