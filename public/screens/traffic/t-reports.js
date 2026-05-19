'use strict';
S.TrafficReports = {
  render(container, actions) {
    const weeks    = App.data.traffic_weeks || [];
    const t        = App.data.traffic_settings?.targets || {};
    const settings = App.data.settings || {};
    const targetGR = t.google_rating    || 4.3;
    const targetRV = t.review_velocity  || 8;
    const targetRR = t.response_rate    || 75;

    if (!weeks.length) {
      container.innerHTML = '<div class="screen"><div class="card"><div class="empty"><div class="empty-title">No Data Yet</div><div class="empty-sub">Enter at least one week in This Week to see reports.</div></div></div></div>';
      return;
    }

    // Annual / summary projections
    const recentWeeks   = weeks.slice(-12);
    const avgGR  = recentWeeks.reduce((s,w)=>s+(w.google_rating||0),0) / (recentWeeks.filter(w=>w.google_rating).length||1);
    const avgRV  = recentWeeks.reduce((s,w)=>s+(w.new_reviews||0),0)   / (recentWeeks.filter(w=>w.new_reviews).length||1);
    const avgRR  = recentWeeks.reduce((s,w)=>s+(w.response_rate||0),0) / (recentWeeks.filter(w=>w.response_rate).length||1);
    const annualReviews = Math.round(avgRV * 12);

    // Full history table
    const rows = weeks.slice().reverse().map(w => {
      const grGap = w.google_rating  ? w.google_rating  - targetGR : null;
      const rvGap = w.new_reviews    ? w.new_reviews    - targetRV : null;
      const rrGap = w.response_rate  ? w.response_rate  - targetRR : null;
      return '<tr>'
        + '<td>Wk ' + w.week_num + '</td>'
        + '<td>' + (w.period_end||'').slice(0,10) + '</td>'
        + '<td class="' + (grGap!=null?(grGap>=0?'pos':'neg'):'') + '">' + (w.google_rating ? w.google_rating.toFixed(1)+'★' : '&mdash;') + '</td>'
        + '<td class="' + (rvGap!=null?(rvGap>=0?'pos':'neg'):'') + '">' + (w.new_reviews ?? '&mdash;') + '</td>'
        + '<td class="' + (rrGap!=null?(rrGap>=0?'pos':'neg'):'') + '">' + (w.response_rate ? w.response_rate.toFixed(0)+'%' : '&mdash;') + '</td>'
        + '<td class="val">'  + (w.monthly_sessions ? w.monthly_sessions.toLocaleString() : '&mdash;') + '</td>'
        + '<td>' + (w.ig_followers ?? '&mdash;') + '</td>'
        + '</tr>';
    }).join('');

    container.innerHTML = '<div class="screen">'
      + '<div class="sh">Traffic Summary</div>'
      + '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;">'
      + '<div><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Avg Google Rating</div><div style="font-size:22px;font-weight:800;color:' + (avgGR >= targetGR ? 'var(--gold)' : 'var(--red)') + ';">' + avgGR.toFixed(2) + '★</div><div style="font-size:11px;color:var(--t3);">Target: ' + targetGR + '★</div></div>'
      + '<div><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Avg New Reviews/Mo</div><div style="font-size:22px;font-weight:800;color:' + (avgRV >= targetRV ? 'var(--gold)' : 'var(--red)') + ';">' + avgRV.toFixed(1) + '</div><div style="font-size:11px;color:var(--t3);">Target: ' + targetRV + '/mo</div></div>'
      + '<div><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Avg Response Rate</div><div style="font-size:22px;font-weight:800;color:' + (avgRR >= targetRR ? 'var(--gold)' : 'var(--red)') + ';">' + avgRR.toFixed(1) + '%</div><div style="font-size:11px;color:var(--t3);">Target: ' + targetRR + '%</div></div>'
      + '<div><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Projected Annual Reviews</div><div style="font-size:22px;font-weight:800;color:var(--gold);">' + annualReviews + '</div><div style="font-size:11px;color:var(--t3);">Based on last ' + recentWeeks.length + ' weeks avg</div></div>'
      + '</div></div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'
      + '<div class="sh" style="margin-bottom:0;">Weekly History</div>'
      + '<button class="btn btn-ghost" id="tr-export" style="font-size:11px;padding:6px 14px;">Export PDF</button>'
      + '</div>'
      + '<div class="tbl-wrap"><table class="tbl" id="tr-history-tbl"><thead><tr><th>Week</th><th>Period End</th><th>Google Rating</th><th>New Reviews</th><th>Response Rate</th><th>Sessions</th><th>IG Followers</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';

    document.getElementById('tr-export')?.addEventListener('click', () => this.exportPDF(weeks, settings, t, avgGR, avgRV, avgRR, targetGR, targetRV, targetRR));
  },

  exportPDF(weeks, settings, t, avgGR, avgRV, avgRR, targetGR, targetRV, targetRR) {
    const barName = settings.bar_name || 'Bar Cop Report';
    const today   = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
    const rows    = weeks.slice().reverse().map(w => `<tr>
        <td>Wk ${w.week_num}</td>
        <td>${(w.period_end||'').slice(0,10)}</td>
        <td style="color:${(w.google_rating||0)>=targetGR?'#2a7a3b':'#b91c1c'};">${w.google_rating ? w.google_rating.toFixed(1)+'★' : ''}</td>
        <td style="color:${(w.new_reviews||0)>=targetRV?'#2a7a3b':'#b91c1c'};">${w.new_reviews||''}</td>
        <td style="color:${(w.response_rate||0)>=targetRR?'#2a7a3b':'#b91c1c'};">${w.response_rate ? w.response_rate.toFixed(0)+'%' : ''}</td>
        <td>${w.monthly_sessions ? w.monthly_sessions.toLocaleString() : ''}</td>
        <td>${w.ig_followers||''}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${barName} - Weekly Traffic Report</title>
<style>
  body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { font-size: 11px; color: #666; margin-bottom: 20px; }
  .summary { display: flex; gap: 24px; margin-bottom: 20px; flex-wrap: wrap; }
  .metric { background: #f7f7f7; border-radius: 6px; padding: 10px 16px; min-width: 140px; }
  .metric-label { font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
  .metric-val { font-size: 20px; font-weight: 800; color: #111; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #1a1a2e; color: #fff; padding: 7px 8px; text-align: left; font-weight: 700; font-size: 10px; letter-spacing: 0.5px; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) td { background: #fafafa; }
  .footer { margin-top: 20px; font-size: 10px; color: #aaa; text-align: center; }
</style></head><body>
<h1>${barName} - Weekly Traffic Report</h1>
<div class="sub">Generated ${today} &nbsp;|&nbsp; ${weeks.length} weeks of data</div>
<div class="summary">
  <div class="metric"><div class="metric-label">Avg Google Rating</div><div class="metric-val">${avgGR.toFixed(2)}★</div></div>
  <div class="metric"><div class="metric-label">Avg New Reviews/Mo</div><div class="metric-val">${avgRV.toFixed(1)}</div></div>
  <div class="metric"><div class="metric-label">Avg Response Rate</div><div class="metric-val">${avgRR.toFixed(1)}%</div></div>
  <div class="metric"><div class="metric-label">Rating Target</div><div class="metric-val">${targetGR}★</div></div>
</div>
<table>
  <thead><tr><th>Week</th><th>Period End</th><th>Google Rating</th><th>New Reviews</th><th>Response Rate</th><th>Sessions</th><th>IG Followers</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">Bar Cop Traffic Fix &nbsp;|&nbsp; barcop.com</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Allow pop-ups to export the report.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  }
};
