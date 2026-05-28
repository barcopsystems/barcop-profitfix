'use strict';
S.TrafficReports = {
  range: 8,

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const container = this.container;
    const all = App.data.traffic_weeks || [];
    const ts  = App.data.traffic_settings?.targets || {};
    const tGR = ts.google_rating || 4.3;
    const tRV = ts.review_velocity || 8;
    const tRR = ts.response_rate || 75;
    const tSS = ts.monthly_sessions || 2000;

    if (!all.length) {
      container.innerHTML = '<div class="screen"><div class="card"><div class="empty">'
        + '<div class="empty-title">No Data Yet</div>'
        + '<div class="empty-sub">Enter at least one week in This Week to see Traffic reports and trends.</div>'
        + '<div style="margin-top:14px;"><button class="btn btn-ghost" onclick="App.navigate(\'t-this-week\')">Go to This Week</button></div>'
        + '</div></div></div>';
      return;
    }

    const weeks = this.range === 'all' ? all.slice() : all.slice(-this.range);
    const lbl = w => 'Wk ' + w.week_num;
    // Reads delivery ratings off every platform in App.TRAFFIC_DELIVERY_PLATFORMS
    // so ezCater (and any future platform addition) rolls into the average
    // automatically. Falls back to legacy dd/ue/gh weekly fields for older data.
    const delivAvg = w => {
      const r = App.TRAFFIC_DELIVERY_PLATFORMS.map(p => w[p.key + '_rating']).filter(v => v != null);
      return r.length ? Math.round(r.reduce((a,b)=>a+b,0)/r.length*100)/100 : null;
    };

    // ── Range selector ──
    const ranges = [['8','Last 8 weeks'],['12','Last 12 weeks'],['26','Last 26 weeks'],['all','All time']];
    const rangeSel = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px;">'
      + '<div class="f" style="width:180px;"><label>Date Range</label><select id="tr-range">'
      + ranges.map(([v,t]) => '<option value="' + v + '"' + (String(this.range)===v?' selected':'') + '>' + t + '</option>').join('')
      + '</select></div>'
      + '<div style="display:flex;gap:8px;">'
      +   '<button class="btn btn-ghost btn-sm" id="tr-month-brief">Month End Brief (PDF)</button>'
      +   '<button class="btn btn-ghost btn-sm" id="tr-export">Weekly History (PDF)</button>'
      + '</div>'
      + '</div>';

    // ── Trend charts ──
    const charts =
        App.trendChart({ title:'Google Rating Over Time', target:tGR, points: weeks.map(w => ({label:lbl(w), value:w.google_rating ?? null})) })
      + App.trendChart({ title:'Review Velocity: New Reviews per Month', target:tRV, points: weeks.map(w => ({label:lbl(w), value:w.new_reviews ?? null})) })
      + App.trendChart({ title:'Website Sessions per Month', target:tSS, points: weeks.map(w => ({label:lbl(w), value:w.monthly_sessions ?? null})) })
      + App.trendChart({ title:'Instagram Followers', points: weeks.map(w => ({label:lbl(w), value:w.ig_followers ?? null})) })
      + App.trendChart({ title:'Average Delivery Platform Rating', target:4.5, points: weeks.map(w => ({label:lbl(w), value:delivAvg(w)})) });

    // ── History table ──
    const cell = (val, gap) => '<td class="' + (gap == null ? '' : gap >= 0 ? 'pos' : 'neg') + '">' + val + '</td>';
    const rows = weeks.slice().reverse().map(w => {
      const da = delivAvg(w);
      return '<tr>'
        + '<td>Wk ' + w.week_num + '</td>'
        + '<td>' + (w.period_end||'').slice(0,10) + '</td>'
        + cell(w.google_rating != null ? w.google_rating.toFixed(1)+'★' : '-', w.google_rating != null ? w.google_rating-tGR : null)
        + cell(w.yelp_rating != null ? w.yelp_rating.toFixed(1)+'★' : '-', w.yelp_rating != null ? w.yelp_rating-4.0 : null)
        + cell(w.new_reviews != null ? w.new_reviews : '-', w.new_reviews != null ? w.new_reviews-tRV : null)
        + cell(w.response_rate != null ? Math.round(w.response_rate)+'%' : '-', w.response_rate != null ? w.response_rate-tRR : null)
        + cell(w.monthly_sessions != null ? w.monthly_sessions.toLocaleString() : '-', w.monthly_sessions != null ? w.monthly_sessions-tSS : null)
        + '<td>' + (w.ig_followers != null ? w.ig_followers.toLocaleString() : '-') + '</td>'
        + cell(da != null ? da.toFixed(1)+'★' : '-', da != null ? da-4.5 : null)
        + cell(w.email_open_rate != null ? Math.round(w.email_open_rate)+'%' : '-', w.email_open_rate != null ? w.email_open_rate-20 : null)
        + '</tr>';
    }).join('');

    const tableCard = '<div class="sh">Weekly History</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Week</th><th>Period End</th><th>Google</th><th>Yelp</th><th>New Reviews</th><th>Response</th><th>Sessions</th><th>IG Followers</th><th>Delivery Avg</th><th>Email Open</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>';

    container.innerHTML = '<div class="screen">' + rangeSel + charts + tableCard + '</div>';

    document.getElementById('tr-range')?.addEventListener('change', e => {
      const v = e.target.value;
      this.range = v === 'all' ? 'all' : parseInt(v);
      this.draw();
    });
    document.getElementById('tr-export')?.addEventListener('click', () => this.exportPDF(weeks));
    document.getElementById('tr-month-brief')?.addEventListener('click', () => this.exportMonthBrief());
  },

  // Month End Brief — operator/owner-readable one-pager covering the month
  // just closed. Score with month-over-month delta, big-3 metrics with
  // deltas, top fixes closed (from fix_log) this month. Disclaimers per
  // [[legal-protection]]. Print via window.print() for save-as-PDF.
  exportMonthBrief() {
    const settings = App.data.settings || {};
    const barName  = settings.bar_name || 'Bar Cop';
    const ts       = App.data.traffic_settings?.targets || {};
    const all      = App.data.traffic_weeks || [];

    // Group weekly snapshots by month, then average each metric within the
    // month. Avg week_num across the month is meaningless; we use the latest
    // week's value for "point-in-time" metrics (rating, list size) and the
    // average for rate-style metrics (response %, open %).
    const monthKey = w => (w.period_end || '').slice(0, 7);
    const monthOf = (key) => all.filter(w => monthKey(w) === key);
    const today = new Date();
    const thisMonthKey = today.toISOString().slice(0, 7);
    const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthKey = prevDate.toISOString().slice(0, 7);

    const thisWeeks = monthOf(thisMonthKey);
    const prevWeeks = monthOf(prevMonthKey);

    // If the current month has no weekly entries yet, fall back to the most
    // recent month with data and treat the month before that as the prior.
    let focusMonthKey = thisMonthKey, focusWeeks = thisWeeks, compareWeeks = prevWeeks;
    if (!thisWeeks.length) {
      const monthsWithData = [...new Set(all.map(monthKey).filter(k => k))].sort();
      if (monthsWithData.length) {
        focusMonthKey = monthsWithData[monthsWithData.length - 1];
        focusWeeks    = monthOf(focusMonthKey);
        const focusIdx = monthsWithData.length - 1;
        const prevIdx  = focusIdx - 1;
        compareWeeks   = prevIdx >= 0 ? monthOf(monthsWithData[prevIdx]) : [];
      }
    }

    if (!focusWeeks.length) {
      alert('No weekly data yet. Log at least one week in This Week before generating the Month End Brief.');
      return;
    }

    // Pull the latest weekly snapshot in the month for point-in-time metrics.
    // Average rate-style metrics (response_rate, email_open_rate) across the
    // month so a single bad week doesn't dominate.
    const latest = (list) => list.length ? list[list.length - 1] : null;
    const avg    = (list, key) => {
      const v = list.map(w => w[key]).filter(x => x != null);
      return v.length ? v.reduce((a,b) => a+b, 0) / v.length : null;
    };
    const sumOrLatest = (list, key) => {
      // Metrics that are monthly counts in nature (gbp_posts via log etc.)
      // — for this brief we read the latest weekly snapshot value, since
      // the operator types month-to-date counts each week.
      const l = latest(list);
      return l ? l[key] : null;
    };

    const fmt = (n, suf = '', d = 1) => n == null ? '-' : (typeof n === 'number' ? (d === 0 ? Math.round(n).toLocaleString() : n.toFixed(d)) : n) + suf;
    const delta = (cur, was) => {
      if (cur == null || was == null) return { txt: '-', cls: 'flat' };
      const diff = cur - was;
      if (Math.abs(diff) < 0.01) return { txt: 'No change', cls: 'flat' };
      return { txt: (diff > 0 ? '+' : '') + (typeof diff === 'number' ? diff.toFixed(1) : diff), cls: diff > 0 ? 'pos' : 'neg' };
    };
    const deltaInt = (cur, was) => {
      if (cur == null || was == null) return { txt: '-', cls: 'flat' };
      const diff = cur - was;
      if (diff === 0) return { txt: 'No change', cls: 'flat' };
      return { txt: (diff > 0 ? '+' : '') + Math.round(diff).toLocaleString(), cls: diff > 0 ? 'pos' : 'neg' };
    };

    // Big-3 metric values for focus month + comparison
    const rating       = sumOrLatest(focusWeeks,   'google_rating');
    const ratingPrev   = sumOrLatest(compareWeeks, 'google_rating');
    const sessions     = sumOrLatest(focusWeeks,   'monthly_sessions');
    const sessionsPrev = sumOrLatest(compareWeeks, 'monthly_sessions');
    const listSize     = sumOrLatest(focusWeeks,   'email_list_size');
    const listPrev     = sumOrLatest(compareWeeks, 'email_list_size');
    const newReviews   = sumOrLatest(focusWeeks,   'new_reviews');
    const newRevPrev   = sumOrLatest(compareWeeks, 'new_reviews');
    const respRate     = avg(focusWeeks,   'response_rate');
    const respPrev     = avg(compareWeeks, 'response_rate');

    // Composite score: same shape as the Hub Dashboard, average of % toward
    // each target. Capped at 100 per metric so over-target metrics don't
    // distort the score.
    const tGR  = ts.google_rating   || 4.3;
    const tRV  = ts.review_velocity || 8;
    const tRR  = ts.response_rate   || 75;
    const tSS  = ts.monthly_sessions || 2000;
    const score = (weeks) => {
      const cap = (v) => Math.max(0, Math.min(100, v));
      const r  = sumOrLatest(weeks, 'google_rating');
      const nr = sumOrLatest(weeks, 'new_reviews');
      const rr = avg(weeks, 'response_rate');
      const ss = sumOrLatest(weeks, 'monthly_sessions');
      const parts = [
        r  != null ? cap((r / tGR) * 100)  : null,
        nr != null ? cap((nr / tRV) * 100) : null,
        rr != null ? cap((rr / tRR) * 100) : null,
        ss != null ? cap((ss / tSS) * 100) : null
      ].filter(v => v != null);
      return parts.length ? Math.round(parts.reduce((a,b)=>a+b,0) / parts.length) : null;
    };
    const scoreNow  = score(focusWeeks);
    const scorePrev = score(compareWeeks);
    const scoreDelta = deltaInt(scoreNow, scorePrev);

    // Top fixes closed this month — read from fix_log filtered to Traffic.
    const fixLog = Array.isArray(App.data.fix_log) ? App.data.fix_log : [];
    const monthFixes = fixLog
      .filter(f => f.module === 'traffic')
      .filter(f => (f.saved_at || '').slice(0, 7) === focusMonthKey)
      .sort((a, b) => (b.saved_at || '').localeCompare(a.saved_at || ''));
    const topFixes = monthFixes.slice(0, 6);

    const fmtMonth = (key) => {
      if (!key) return '';
      const [y, m] = key.split('-');
      return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };
    const fmtFixDate = (str) => {
      if (!str) return '';
      const d = new Date(str);
      return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const fixRows = topFixes.length
      ? topFixes.map(f => '<tr><td style="width:80px;color:#666;">' + fmtFixDate(f.saved_at) + '</td><td>' + esc(f.note || '(no note)') + '</td></tr>').join('')
      : '<tr><td colspan="2" style="color:#999;font-style:italic;padding:10px 0;">No Traffic fixes logged this month. Operator actions that close gaps (GBP completeness 100%, review velocity hit, list growth, etc.) credit here automatically.</td></tr>';

    const metricRow = (label, val, target, deltaObj) =>
      '<tr>'
      +   '<td class="m">' + label + '</td>'
      +   '<td class="v">' + esc(val) + '</td>'
      +   '<td class="t">' + esc(target) + '</td>'
      +   '<td class="d ' + deltaObj.cls + '">' + esc(deltaObj.txt) + '</td>'
      + '</tr>';

    const today_str = today.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
    const focusLabel = fmtMonth(focusMonthKey);

    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(barName) + ' Month End Brief</title>'
      + '<style>'
      + '@page { margin: 0.5in; }'
      + 'body{font-family:Georgia,"Times New Roman",serif;font-size:12px;color:#111;margin:0;padding:0;}'
      + 'h1{font-size:22px;margin:0 0 2px;font-family:Helvetica,Arial,sans-serif;letter-spacing:0.3px;}'
      + '.sub{font-size:11px;color:#666;margin-bottom:18px;font-family:Helvetica,Arial,sans-serif;}'
      + '.score-card{padding:14px 18px;background:#f7f4ec;border:1px solid #d9c98a;border-radius:6px;margin-bottom:20px;display:flex;align-items:baseline;justify-content:space-between;gap:24px;}'
      + '.score-card .label{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8a6a16;}'
      + '.score-card .score{font-size:42px;font-weight:700;color:#8a6a16;font-family:Helvetica,Arial,sans-serif;line-height:1;}'
      + '.score-card .delta{font-size:14px;font-family:Helvetica,Arial,sans-serif;}'
      + '.section-h{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#555;margin:0 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px;}'
      + 'table.metrics{width:100%;border-collapse:collapse;margin-bottom:20px;font-family:Helvetica,Arial,sans-serif;}'
      + 'table.metrics th{background:#1a1a2e;color:#fff;padding:8px 10px;text-align:left;font-size:10px;letter-spacing:0.5px;text-transform:uppercase;}'
      + 'table.metrics td{padding:9px 10px;border-bottom:1px solid #eee;font-size:12px;}'
      + 'table.metrics td.m{font-weight:700;width:30%;}'
      + 'table.metrics td.v{width:25%;font-family:Helvetica,Arial,sans-serif;font-weight:600;}'
      + 'table.metrics td.t{width:20%;color:#666;font-size:11px;}'
      + 'table.metrics td.d{width:25%;text-align:right;font-weight:700;}'
      + 'table.metrics td.d.pos{color:#1a7a4a;}'
      + 'table.metrics td.d.neg{color:#a32820;}'
      + 'table.metrics td.d.flat{color:#888;font-weight:400;}'
      + 'table.fixes{width:100%;border-collapse:collapse;margin-bottom:20px;}'
      + 'table.fixes td{padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;}'
      + '.footer{margin-top:24px;font-size:9px;color:#999;line-height:1.5;font-family:Helvetica,Arial,sans-serif;border-top:1px solid #ddd;padding-top:10px;}'
      + '.disclaimer{font-style:italic;}'
      + '</style></head><body>'
      + '<h1>' + esc(barName) + '</h1>'
      + '<div class="sub">Month End Brief &nbsp;|&nbsp; ' + esc(focusLabel) + ' &nbsp;|&nbsp; Generated ' + today_str + '</div>'

      + '<div class="score-card">'
      +   '<div><div class="label">Digital Presence Score</div><div class="score">' + (scoreNow != null ? scoreNow : '-') + '</div></div>'
      +   '<div style="text-align:right;"><div class="label">vs ' + (compareWeeks.length ? esc(fmtMonth(compareWeeks[0] ? monthKey(compareWeeks[0]) : '')) : 'prior month') + '</div>'
      +   '<div class="delta ' + scoreDelta.cls + '" style="color:' + (scoreDelta.cls === 'pos' ? '#1a7a4a' : scoreDelta.cls === 'neg' ? '#a32820' : '#666') + ';font-weight:700;font-size:18px;">' + esc(scoreDelta.txt) + (scoreDelta.txt !== '-' && scoreDelta.txt !== 'No change' ? ' pts' : '') + '</div></div>'
      + '</div>'

      + '<div class="section-h">Big Three Metrics</div>'
      + '<table class="metrics"><thead><tr><th>Metric</th><th>This Month</th><th>Target</th><th>vs Prior</th></tr></thead><tbody>'
      +   metricRow('Google Rating',       rating   != null ? rating.toFixed(1) + '★' : '-',         tGR + '★',                  delta(rating, ratingPrev))
      +   metricRow('New Reviews / Mo',    newReviews != null ? Math.round(newReviews) : '-',         tRV + '/mo',                deltaInt(newReviews, newRevPrev))
      +   metricRow('Response Rate',       respRate != null ? Math.round(respRate) + '%' : '-',       tRR + '%',                  deltaInt(respRate, respPrev))
      +   metricRow('Website Sessions',    sessions != null ? sessions.toLocaleString() : '-',        tSS.toLocaleString() + '/mo', deltaInt(sessions, sessionsPrev))
      +   metricRow('Email List Size',     listSize != null ? listSize.toLocaleString() : '-',        '500+',                     deltaInt(listSize, listPrev))
      + '</tbody></table>'

      + '<div class="section-h">Fixes Closed This Month</div>'
      + '<table class="fixes"><tbody>' + fixRows + '</tbody></table>'

      + '<div class="footer">'
      +   '<div>Bar Cop Traffic Recovery &nbsp;|&nbsp; Brief for the operation\'s owner or marketing consultant.</div>'
      +   '<div class="disclaimer">This brief summarizes data the operator entered in Bar Cop for the month shown. It is not a substitute for professional marketing, SEO, or business advice. Numbers reflect what was logged; actions taken outside Bar Cop are not captured.</div>'
      + '</div>'
      + '</body></html>';

    const win = window.open('', '_blank');
    if (!win) { alert('Allow pop-ups to export the Month End Brief.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  },

  exportPDF(weeks) {
    const settings = App.data.settings || {};
    const ts  = App.data.traffic_settings?.targets || {};
    const barName = settings.bar_name || 'Bar Cop';
    const today = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
    const delivAvg = w => {
      const r = App.TRAFFIC_DELIVERY_PLATFORMS.map(p => w[p.key + '_rating']).filter(v => v != null);
      return r.length ? (r.reduce((a,b)=>a+b,0)/r.length).toFixed(1)+'★' : '';
    };
    const rows = weeks.slice().reverse().map(w => '<tr>'
      + '<td>Wk ' + w.week_num + '</td>'
      + '<td>' + (w.period_end||'').slice(0,10) + '</td>'
      + '<td>' + (w.google_rating != null ? w.google_rating.toFixed(1)+'★' : '') + '</td>'
      + '<td>' + (w.yelp_rating != null ? w.yelp_rating.toFixed(1)+'★' : '') + '</td>'
      + '<td>' + (w.new_reviews != null ? w.new_reviews : '') + '</td>'
      + '<td>' + (w.response_rate != null ? Math.round(w.response_rate)+'%' : '') + '</td>'
      + '<td>' + (w.monthly_sessions != null ? w.monthly_sessions.toLocaleString() : '') + '</td>'
      + '<td>' + (w.ig_followers != null ? w.ig_followers.toLocaleString() : '') + '</td>'
      + '<td>' + delivAvg(w) + '</td>'
      + '<td>' + (w.email_open_rate != null ? Math.round(w.email_open_rate)+'%' : '') + '</td>'
      + '</tr>').join('');

    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(barName) + ' Traffic Report</title>'
      + '<style>body{font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#111;margin:0;padding:24px;}'
      + 'h1{font-size:20px;margin:0 0 4px;}.sub{font-size:11px;color:#666;margin-bottom:20px;}'
      + 'table{width:100%;border-collapse:collapse;font-size:11px;}'
      + 'th{background:#1a1a2e;color:#fff;padding:7px 8px;text-align:left;font-weight:700;font-size:10px;}'
      + 'td{padding:6px 8px;border-bottom:1px solid #eee;}tr:nth-child(even) td{background:#fafafa;}'
      + '.footer{margin-top:20px;font-size:10px;color:#aaa;text-align:center;}</style></head><body>'
      + '<h1>' + esc(barName) + ': Weekly Traffic Report</h1>'
      + '<div class="sub">Generated ' + today + ' &nbsp;|&nbsp; ' + weeks.length + ' weeks shown &nbsp;|&nbsp; Targets: ' + (ts.google_rating||4.3) + '★ rating, ' + (ts.review_velocity||8) + ' reviews/mo</div>'
      + '<table><thead><tr><th>Week</th><th>Period End</th><th>Google</th><th>Yelp</th><th>New Reviews</th><th>Response</th><th>Sessions</th><th>IG Followers</th><th>Delivery Avg</th><th>Email Open</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table>'
      + '<div class="footer">Bar Cop Traffic Recovery</div></body></html>';

    const win = window.open('', '_blank');
    if (!win) { alert('Allow pop-ups to export the report.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }
};
