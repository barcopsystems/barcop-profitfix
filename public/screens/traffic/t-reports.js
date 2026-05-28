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
      + '<button class="btn btn-ghost btn-sm" id="tr-export">Export PDF</button>'
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
