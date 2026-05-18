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

    // Annuals
    const recentWeeks = weeks.slice(-12);
    const avgRev    = recentWeeks.reduce((s,w)=>s+(w.bar_revenue||0)+(w.floor_revenue||0),0) / recentWeeks.length;
    const annualRev = avgRev * 52;
    const avgLabor  = recentWeeks.reduce((s,w)=>s+(w.labor_pct_blended||0),0) / recentWeeks.filter(w=>w.labor_pct_blended).length || 0;
    const avgCA     = recentWeeks.reduce((s,w)=>s+(w.check_avg||0),0) / recentWeeks.filter(w=>w.check_avg).length || 0;
    const avgCovers = recentWeeks.reduce((s,w)=>s+(w.covers||0),0) / recentWeeks.filter(w=>w.covers).length || 0;

    const annualGap = avgCA && avgCovers ? (targetCA - avgCA) * avgCovers * 52 : 0;
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
        + '<td>' + (w.covers||'—') + '</td>'
        + '<td class="' + (caGap >= 0 ? 'pos' : 'neg') + '">' + (w.check_avg ? App.fmtCurrency(w.check_avg) : '—') + '</td>'
        + '<td class="' + (labGap <= 0 ? 'pos' : 'neg') + '">' + (w.labor_pct_blended ? w.labor_pct_blended.toFixed(1)+'%' : '—') + '</td>'
        + '<td class="val">' + (w.rplh_blended ? App.fmtCurrency(w.rplh_blended) : '—') + '</td>'
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
      + '<div class="sh">Weekly History</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Week</th><th>Period End</th><th>Bar Rev</th><th>Floor Rev</th><th>Total</th><th>Covers</th><th>Check Avg</th><th>Labor %</th><th>RPLH</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';
  }
};
