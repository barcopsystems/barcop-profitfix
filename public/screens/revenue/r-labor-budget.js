'use strict';
S.RevenueLaborBudget = {
  render(container, actions) {
    const rs    = App.data.revenue_settings || {};
    const t     = rs.targets || {};
    const wages = rs.avg_hourly_wage || { bar:15, kitchen:14, floor:13 };
    const weeks = App.data.revenue_weeks || [];
    const validWeeks = weeks.filter(w => (w.bar_revenue||0) + (w.floor_revenue||0) > 0);
    const last  = validWeeks.length ? validWeeks[validWeeks.length - 1] : null;

    const depts = [
      { key:'bar',     label:'Bar',     target: t.bar_labor_pct     || 28, wage: wages.bar     || 15, defaultRev: last?.bar_revenue    || 0 },
      { key:'kitchen', label:'Kitchen', target: t.kitchen_labor_pct || 30, wage: wages.kitchen || 14, defaultRev: (last?.bar_revenue||0) + (last?.floor_revenue||0) },
      { key:'floor',   label:'Floor',   target: t.floor_labor_pct   || 32, wage: wages.floor   || 13, defaultRev: last?.floor_revenue   || 0 },
    ];

    const deptRows = depts.map(d =>
      '<tr>'
      + '<td style="font-weight:600;">' + d.label + '</td>'
      + '<td><div class="fw" style="width:120px;"><span class="pre">$</span><input class="pre lb-rev" type="number" data-dept="' + d.key + '" data-wage="' + d.wage + '" data-target="' + d.target + '" value="' + (d.defaultRev || '') + '" placeholder="" style="width:100%;padding-top:11px;padding-bottom:11px;"/></div></td>'
      + '<td>' + d.target + '%</td>'
      + '<td style="color:var(--gold);font-weight:700;" id="lb-budget-' + d.key + '">' + (d.defaultRev ? App.fmtCurrency(d.defaultRev * d.target / 100) : '&mdash;') + '</td>'
      + '<td style="color:var(--gold);font-weight:700;" id="lb-hrs-' + d.key + '">' + (d.defaultRev && d.wage > 0 ? Math.round(d.defaultRev * d.target / 100 / d.wage) + ' hrs' : '&mdash;') + '</td>'
      + '<td>' + App.fmtCurrency(d.wage) + '/hr</td>'
      + '</tr>'
    ).join('');

    const initTotalBudget = depts.reduce((s,d) => s + d.defaultRev * (d.target/100), 0);
    const initTotalHrs    = depts.reduce((s,d) => s + (d.wage > 0 ? d.defaultRev * (d.target/100) / d.wage : 0), 0);

    // Schedule entry rows - budget hours pre-calculated from defaults
    const schedRows = depts.map(d => {
      const budgetHrs = d.wage > 0 ? Math.round(d.defaultRev * d.target / 100 / d.wage) : 0;
      return '<tr>'
        + '<td style="font-weight:600;">' + d.label + '</td>'
        + '<td style="color:var(--gold);" id="lb-sched-budget-' + d.key + '">' + (budgetHrs || '&mdash;') + ' hrs</td>'
        + '<td><input type="number" class="sched-hrs" data-dept="' + d.key + '" placeholder="" style="width:80px;background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--t1);padding:11px 8px;font-size:13px;"/></td>'
        + '<td id="lb-gap-' + d.key + '" style="font-weight:700;color:var(--t3);">--</td>'
        + '</tr>';
    }).join('');

    // History table
    const tgtPct = ((t.bar_labor_pct||28)+(t.kitchen_labor_pct||30)+(t.floor_labor_pct||32))/3;
    const histRows = validWeeks.slice().reverse().slice(0,12).map(w => {
      const totalRev   = (w.bar_revenue||0) + (w.floor_revenue||0);
      const totalLabor = w.total_labor_cost || 0;
      const pct  = totalRev > 0 ? (totalLabor/totalRev*100).toFixed(1) : null;
      const gap  = pct ? ((parseFloat(pct)) - tgtPct).toFixed(1) : null;
      return '<tr><td>Wk ' + w.week_num + '</td>'
        + '<td>' + App.fmtCurrency(totalRev) + '</td>'
        + '<td>' + App.fmtCurrency(totalLabor) + '</td>'
        + '<td class="' + (pct && parseFloat(pct) > tgtPct ? 'neg' : 'pos') + ' val">' + (pct ? pct+'%' : '&mdash;') + '</td>'
        + '<td style="color:' + (gap && parseFloat(gap) > 0 ? 'var(--red)' : 'var(--gold)') + ';">' + (gap ? (parseFloat(gap)>0?'+':'') + gap + ' pts' : '&mdash;') + '</td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="5" style="color:var(--t3);text-align:center;padding:14px;">No weeks saved yet.</td></tr>';

    container.innerHTML = '<div class="screen">'
      + '<div class="card" style="margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Labor Budget Calculator</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">Enter your projected revenue for the week. Pre-filled from last saved week.</div>'
      + '<div class="tbl-wrap"><table class="sum-tbl lb-tbl"><thead><tr><th>Department</th><th>Projected Revenue</th><th>Target %</th><th>Budget $ ' + tt('r-labor-cost') + '</th><th>Budget Hours ' + tt('r-labor-hours') + '</th><th>Avg Wage</th></tr></thead>'
      + '<tbody>' + deptRows + '</tbody>'
      + '<tfoot><tr style="font-weight:700;border-top:2px solid var(--b1);"><td>Total</td><td></td><td></td>'
      + '<td style="color:var(--gold);" id="lb-total-budget">' + (initTotalBudget ? App.fmtCurrency(initTotalBudget) : '&mdash;') + '</td>'
      + '<td style="color:var(--gold);" id="lb-total-hrs">' + (initTotalHrs ? Math.round(initTotalHrs) + ' hrs' : '&mdash;') + '</td>'
      + '<td></td></tr></tfoot>'
      + '</table></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">Targets and wages can be updated in Settings.</div>'
      + '</div>'
      + '<div class="card" style="margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Schedule Entry</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:12px;">After writing the schedule, enter hours scheduled per department to see over/under vs budget.</div>'
      + '<div class="tbl-wrap"><table class="sum-tbl lb-tbl"><thead><tr><th>Department</th><th>Budget Hours</th><th>Scheduled Hours</th><th>Over/Under</th></tr></thead>'
      + '<tbody>' + schedRows + '</tbody>'
      + '</table></div>'
      + '<div id="lb-sched-total" style="margin-top:10px;font-size:12px;color:var(--t3);"></div>'
      + '</div>'
      + '<div class="sh">Weekly Labor History</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Week</th><th>Revenue</th><th>Labor $</th><th>Labor %</th><th>vs Target</th></tr></thead><tbody>' + histRows + '</tbody></table></div>'
      + '</div>';

    // Live recalc when projected revenue changes
    const recalc = () => {
      let totalBudget = 0, totalHrs = 0;
      document.querySelectorAll('.lb-rev').forEach(input => {
        const dept   = input.dataset.dept;
        const wage   = parseFloat(input.dataset.wage)   || 0;
        const target = parseFloat(input.dataset.target) || 0;
        const rev    = parseFloat(input.value) || 0;
        const budget = rev * target / 100;
        const hrs    = wage > 0 ? budget / wage : 0;
        const budgetEl = document.getElementById('lb-budget-' + dept);
        const hrsEl    = document.getElementById('lb-hrs-'    + dept);
        const schedEl  = document.getElementById('lb-sched-budget-' + dept);
        if (budgetEl) budgetEl.textContent = rev ? App.fmtCurrency(budget) : '—';
        if (hrsEl)    hrsEl.textContent    = rev ? Math.round(hrs) + ' hrs' : '—';
        if (schedEl)  schedEl.textContent  = rev ? Math.round(hrs) + ' hrs' : '—';
        // Update data-budget on sched input for gap calc
        const schedInput = document.querySelector('.sched-hrs[data-dept="' + dept + '"]');
        if (schedInput) schedInput.dataset.budget = Math.round(hrs);
        totalBudget += budget;
        totalHrs    += hrs;
      });
      const tbEl = document.getElementById('lb-total-budget');
      const thEl = document.getElementById('lb-total-hrs');
      if (tbEl) tbEl.textContent = totalBudget ? App.fmtCurrency(totalBudget) : '—';
      if (thEl) thEl.textContent = totalHrs    ? Math.round(totalHrs) + ' hrs' : '—';
      updateGaps();
    };

    const updateGaps = () => {
      let totalBudgetHrs = 0, totalSchedHrs = 0;
      document.querySelectorAll('.sched-hrs').forEach(input => {
        const dept   = input.dataset.dept;
        const budget = parseFloat(input.dataset.budget) || 0;
        const sched  = parseFloat(input.value) || 0;
        const gap    = sched - budget;
        const el     = document.getElementById('lb-gap-' + dept);
        if (el) {
          if (!sched) { el.textContent = '--'; el.style.color = 'var(--t3)'; }
          else { el.textContent = (gap > 0 ? '+' : '') + gap.toFixed(0) + ' hrs'; el.style.color = gap > 0 ? 'var(--red)' : 'var(--gold)'; }
        }
        totalBudgetHrs += budget;
        totalSchedHrs  += sched;
      });
      const totalEl = document.getElementById('lb-sched-total');
      if (totalEl && totalSchedHrs > 0) {
        const totalGap = totalSchedHrs - totalBudgetHrs;
        totalEl.innerHTML = 'Total: <strong style="color:var(--t1);">' + Math.round(totalSchedHrs) + ' scheduled</strong> vs <strong style="color:var(--gold);">' + Math.round(totalBudgetHrs) + ' budgeted</strong> '
          + '<strong style="color:' + (totalGap > 0 ? 'var(--red)' : 'var(--gold)') + ';">(' + (totalGap > 0 ? '+' : '') + Math.round(totalGap) + ' hrs)</strong>';
      }
    };

    document.querySelectorAll('.lb-rev').forEach(i => i.addEventListener('input', recalc));
    document.querySelectorAll('.sched-hrs').forEach(i => i.addEventListener('input', updateGaps));
  }
};
