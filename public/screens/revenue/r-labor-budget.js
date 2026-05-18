'use strict';
S.RevenueLaborBudget = {
  render(container, actions) {
    const rs   = App.data.revenue_settings || {};
    const t    = rs.targets || {};
    const wages = rs.avg_hourly_wage || { bar:15, kitchen:14, floor:13 };
    const weeks = App.data.revenue_weeks || [];
    const last  = weeks.length ? weeks[weeks.length - 1] : null;

    const depts = [
      { key:'bar',     label:'Bar',     target: t.bar_labor_pct || 28,     wage: wages.bar || 15,     projRev: last?.bar_revenue    || 0 },
      { key:'kitchen', label:'Kitchen', target: t.kitchen_labor_pct || 30, wage: wages.kitchen || 14, projRev: last?.bar_revenue    || 0 },
      { key:'floor',   label:'Floor',   target: t.floor_labor_pct || 32,   wage: wages.floor || 13,   projRev: last?.floor_revenue  || 0 },
    ];

    const deptRows = depts.map(d => {
      const budgetDollars = d.projRev * (d.target / 100);
      const budgetHours   = d.wage > 0 ? (budgetDollars / d.wage) : 0;
      return '<tr>'
        + '<td style="font-weight:600;">' + d.label + '</td>'
        + '<td>' + App.fmtCurrency(d.projRev) + '</td>'
        + '<td>' + d.target + '%</td>'
        + '<td style="color:var(--gold);font-weight:700;">' + App.fmtCurrency(budgetDollars) + '</td>'
        + '<td style="color:var(--gold);font-weight:700;">' + Math.round(budgetHours) + ' hrs</td>'
        + '<td>' + App.fmtCurrency(d.wage) + '/hr</td>'
        + '</tr>';
    }).join('');

    const totalBudget = depts.reduce((s,d) => s + d.projRev * (d.target/100), 0);
    const totalHrs    = depts.reduce((s,d) => { const b = d.projRev*(d.target/100); return s + (d.wage > 0 ? b/d.wage : 0); }, 0);

    // History table
    const histRows = weeks.slice().reverse().slice(0,12).map(w => {
      const totalRev  = (w.bar_revenue||0) + (w.floor_revenue||0);
      const totalLabor = w.total_labor_cost || 0;
      const pct = totalRev > 0 ? (totalLabor/totalRev*100).toFixed(1) : '—';
      const tgtPct = ((t.bar_labor_pct||28)+(t.kitchen_labor_pct||30)+(t.floor_labor_pct||32))/3;
      const gap = totalRev > 0 ? ((parseFloat(pct)||0) - tgtPct).toFixed(1) : null;
      return '<tr><td>Wk ' + w.week_num + '</td>'
        + '<td>' + App.fmtCurrency(totalRev) + '</td>'
        + '<td>' + App.fmtCurrency(totalLabor) + '</td>'
        + '<td class="' + (parseFloat(pct) > tgtPct ? 'neg' : 'pos') + ' val">' + pct + '%</td>'
        + '<td style="color:' + (gap && parseFloat(gap) > 0 ? 'var(--red)' : 'var(--gold)') + ';">' + (gap ? (parseFloat(gap) > 0 ? '+' : '') + gap + ' pts' : '—') + '</td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="5" style="color:var(--t3);text-align:center;padding:14px;">No weeks saved yet.</td></tr>';

    container.innerHTML = '<div class="screen">'
      + '<div class="card" style="margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Labor Budget Calculator</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Based on last week\'s revenue and your labor targets. Use this before writing the schedule.</div>'
      + '<div class="tbl-wrap"><table class="sum-tbl"><thead><tr><th>Department</th><th>Projected Revenue</th><th>Target %</th><th>Budget $ ' + tt('r-labor-cost') + '</th><th>Budget Hours ' + tt('r-labor-hours') + '</th><th>Avg Wage</th></tr></thead>'
      + '<tbody>' + deptRows + '</tbody>'
      + '<tfoot><tr style="font-weight:700;border-top:2px solid var(--b1);"><td>Total</td><td></td><td></td>'
      + '<td style="color:var(--gold);">' + App.fmtCurrency(totalBudget) + '</td>'
      + '<td style="color:var(--gold);">' + Math.round(totalHrs) + ' hrs</td><td></td></tr></tfoot>'
      + '</table></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">Avg wage and targets can be updated in Settings.</div>'
      + '</div>'
      + '<div class="sh">Weekly Labor History</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Week</th><th>Revenue</th><th>Labor $</th><th>Labor %</th><th>vs Target</th></tr></thead><tbody>' + histRows + '</tbody></table></div>'
      + '</div>';
  }
};
