'use strict';
S.RevenueReports = {
  render(container, actions) {
    const weeks    = App.data.revenue_weeks || [];
    const t        = App.data.revenue_settings?.targets || {};
    const settings = App.data.settings || {};
    const targetCA = t.check_avg || 35;
    const tgtLP    = ((t.bar_labor_pct||28)+(t.kitchen_labor_pct||30)+(t.floor_labor_pct||32))/3;

    if (!weeks.length) {
      container.innerHTML = '<div class="screen"><div class="card"><div class="empty"><div class="empty-title">No Data Yet</div><div class="empty-sub">Enter at least one week in This Week to see reports.</div></div></div></div>';
      return;
    }

    // Annual projections
    const recentWeeks = weeks.slice(-12);
    const avgRev    = recentWeeks.reduce((s,w)=>s+(w.bar_revenue||0)+(w.floor_revenue||0),0) / recentWeeks.length;
    const annualRev = avgRev * 52;
    const avgLabor  = recentWeeks.reduce((s,w)=>s+(w.labor_pct_blended||0),0) / (recentWeeks.filter(w=>w.labor_pct_blended).length || 1);
    const avgCA     = recentWeeks.reduce((s,w)=>s+(w.check_avg||0),0) / (recentWeeks.filter(w=>w.check_avg).length || 1);
    const avgCovers = recentWeeks.reduce((s,w)=>s+(w.covers||0),0) / (recentWeeks.filter(w=>w.covers).length || 1);

    const annualGap   = avgCA && avgCovers ? (targetCA - avgCA) * avgCovers * 52 : 0;
    const laborGapAnn = avgLabor && avgRev ? ((avgLabor - tgtLP)/100) * avgRev * 52 : 0;

    // Full history table
    const rows = weeks.slice().reverse().map(w => {
      const totalRev = (w.bar_revenue||0) + (w.floor_revenue||0);
      const caGap    = w.check_avg ? w.check_avg - targetCA : null;
      const labGap   = w.labor_pct_blended ? w.labor_pct_blended - tgtLP : null;
      return '<tr>'
        + '<td>Wk ' + w.week_num + '</td>'
        + '<td>' + (w.period_end||'').slice(0,10) + '</td>'
        + '<td>' + App.fmtCurrency(w.bar_revenue||0) + '</td>'
        + '<td>' + App.fmtCurrency(w.floor_revenue||0) + '</td>'
        + '<td class="val">' + App.fmtCurrency(totalRev) + '</td>'
        + '<td>' + (w.covers||'-') + '</td>'
        + '<td class="' + (caGap == null ? '' : caGap >= 0 ? 'pos' : 'neg') + '">' + (w.check_avg ? App.fmtCurrency(w.check_avg) : '-') + '</td>'
        + '<td class="' + (labGap == null ? '' : labGap <= 0 ? 'pos' : 'neg') + '">' + (w.labor_pct_blended ? w.labor_pct_blended.toFixed(1)+'%' : '-') + '</td>'
        + '<td class="val">' + (w.rplh_blended ? App.fmtCurrency(w.rplh_blended) : '-') + '</td>'
        + '</tr>';
    }).join('');

    container.innerHTML = '<div class="screen">'
      + '<div class="sh">Annual Revenue Projection</div>'
      + '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;">'
      + '<div><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Projected Annual Revenue</div><div style="font-size:22px;font-weight:800;color:var(--gold);">' + App.fmtCurrency(annualRev) + '</div><div style="font-size:11px;color:var(--t3);">Based on last ' + recentWeeks.length + ' weeks avg</div></div>'
      + '<div><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Avg Check Average</div><div style="font-size:22px;font-weight:800;color:' + (avgCA >= targetCA ? 'var(--gold)' : 'var(--red)') + ';">' + App.fmtCurrency(avgCA) + '</div><div style="font-size:11px;color:var(--t3);">Target: $' + targetCA + '</div></div>'
      + '<div><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Annual Check Avg Gap</div><div style="font-size:22px;font-weight:800;color:' + (annualGap >= 0 ? 'var(--gold)' : 'var(--red)') + ';">' + (annualGap >= 0 ? '+' : '') + App.fmtCurrency(annualGap) + '</div><div style="font-size:11px;color:var(--t3);">vs target at current volume</div></div>'
      + '<div><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Avg Labor %</div><div style="font-size:22px;font-weight:800;color:' + (avgLabor <= tgtLP ? 'var(--gold)' : 'var(--red)') + ';">' + avgLabor.toFixed(1) + '%</div><div style="font-size:11px;color:var(--t3);">Target: ' + tgtLP.toFixed(1) + '%</div></div>'
      + (laborGapAnn ? '<div><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Annual Labor Gap</div><div style="font-size:22px;font-weight:800;color:' + (laborGapAnn <= 0 ? 'var(--gold)' : 'var(--red)') + ';">' + (laborGapAnn <= 0 ? '' : '+') + App.fmtCurrency(laborGapAnn) + '</div><div style="font-size:11px;color:var(--t3);">vs labor target</div></div>' : '')
      + '</div></div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'
      + '<div class="sh" style="margin-bottom:0;">Weekly History</div>'
      + '<button class="btn btn-ghost" id="rr-export" style="font-size:11px;padding:6px 14px;">Export PDF</button>'
      + '</div>'
      + '<div class="tbl-wrap"><table class="tbl" id="rr-history-tbl"><thead><tr><th>Week</th><th>Period End</th><th>Bar Rev</th><th>Floor Rev</th><th>Total</th><th>Covers</th><th>Check Avg</th><th>Labor %</th><th>RPLH</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';

    document.getElementById('rr-export')?.addEventListener('click', () => this.exportPDF(weeks, settings, t, annualRev, avgCA, avgLabor, tgtLP, targetCA));
  },

  exportPDF(weeks, settings, t, annualRev, avgCA, avgLabor, tgtLP, targetCA) {
    const barName  = settings.bar_name || 'Bar Cop Report';
    const today    = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
    const rows     = weeks.slice().reverse().map(w => {
      const total = (w.bar_revenue||0) + (w.floor_revenue||0);
      return `<tr>
        <td>Wk ${w.week_num}</td>
        <td>${(w.period_end||'').slice(0,10)}</td>
        <td>$${(w.bar_revenue||0).toLocaleString()}</td>
        <td>$${(w.floor_revenue||0).toLocaleString()}</td>
        <td><strong>$${total.toLocaleString()}</strong></td>
        <td>${w.covers||''}</td>
        <td style="color:${(w.check_avg||0)>=targetCA?'#2a7a3b':'#b91c1c'};">${w.check_avg ? '$'+w.check_avg.toFixed(2) : ''}</td>
        <td style="color:${(w.labor_pct_blended||0)<=tgtLP?'#2a7a3b':'#b91c1c'};">${w.labor_pct_blended ? w.labor_pct_blended.toFixed(1)+'%' : ''}</td>
        <td>${w.rplh_blended ? '$'+w.rplh_blended.toFixed(2) : ''}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${barName} - Weekly Revenue Report</title>
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
<h1>${barName} - Weekly Revenue Report</h1>
<div class="sub">Generated ${today} &nbsp;|&nbsp; ${weeks.length} weeks of data</div>
<div class="summary">
  <div class="metric"><div class="metric-label">Projected Annual</div><div class="metric-val">$${Math.round(annualRev).toLocaleString()}</div></div>
  <div class="metric"><div class="metric-label">Avg Check Average</div><div class="metric-val">$${avgCA.toFixed(2)}</div></div>
  <div class="metric"><div class="metric-label">Check Avg Target</div><div class="metric-val">$${targetCA}</div></div>
  <div class="metric"><div class="metric-label">Avg Labor %</div><div class="metric-val">${avgLabor.toFixed(1)}%</div></div>
  <div class="metric"><div class="metric-label">Labor % Target</div><div class="metric-val">${tgtLP.toFixed(1)}%</div></div>
</div>
<table>
  <thead><tr><th>Week</th><th>Period End</th><th>Bar Rev</th><th>Floor Rev</th><th>Total</th><th>Covers</th><th>Check Avg</th><th>Labor %</th><th>RPLH</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">Bar Cop Revenue Fix &nbsp;|&nbsp; barcop.com</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) {
      App.confirm({
        title: 'Pop-ups blocked',
        message: 'Allow pop-ups for Bar Cop to export the report.',
        confirmText: 'OK',
        cancelText: ''
      });
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  }
};
