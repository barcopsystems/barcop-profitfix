'use strict';
S.RevenueCheckAverage = {
  render(container, actions) {
    const rs    = App.data.revenue_settings || {};
    const t     = rs.targets || {};
    const weeks = App.data.revenue_weeks || [];
    const targetCA = t.check_avg || 35;

    // Build server performance table from all saved weeks
    const serverMap = {};
    weeks.forEach(w => {
      (w.server_entries || []).forEach(e => {
        if (!e.name || !parseFloat(e.covers) || !parseFloat(e.sales)) return;
        if (!serverMap[e.name]) serverMap[e.name] = { name: e.name, totalCovers: 0, totalSales: 0, weeks: 0 };
        serverMap[e.name].totalCovers += parseFloat(e.covers);
        serverMap[e.name].totalSales  += parseFloat(e.sales);
        serverMap[e.name].weeks++;
      });
    });

    const serverStats = Object.values(serverMap).map(s => ({
      ...s,
      checkAvg: s.totalCovers > 0 ? s.totalSales / s.totalCovers : 0
    })).sort((a,b) => b.checkAvg - a.checkAvg);

    const teamAvg = serverStats.length
      ? serverStats.reduce((s,sv) => s + sv.checkAvg, 0) / serverStats.length
      : null;
    const topServer = serverStats[0] || null;
    const botServer = serverStats[serverStats.length - 1] || null;
    const spread    = topServer && botServer ? topServer.checkAvg - botServer.checkAvg : null;

    const serverRows = serverStats.map((sv, i) => {
      const vs     = sv.checkAvg - targetCA;
      const vsTeam = teamAvg ? sv.checkAvg - teamAvg : null;
      const annGap = sv.totalCovers > 0 && spread
        ? (sv.checkAvg - (teamAvg||targetCA)) * (sv.totalCovers / (sv.weeks||1)) * 52
        : null;
      return '<tr>'
        + '<td style="font-weight:700;color:var(--t1);">' + esc(sv.name) + '</td>'
        + '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:' + (sv.checkAvg >= targetCA ? 'var(--gold)' : 'var(--red)') + ';">' + App.fmtCurrency(sv.checkAvg) + '</td>'
        + '<td style="color:' + (vs >= 0 ? 'var(--gold)' : 'var(--red)') + ';font-weight:700;">' + (vs >= 0 ? '+' : '') + App.fmtCurrency(vs) + '</td>'
        + '<td style="color:' + (vsTeam >= 0 ? 'var(--gold)' : 'var(--red)') + ';">' + (vsTeam != null ? (vsTeam >= 0 ? '+' : '') + App.fmtCurrency(vsTeam) : '—') + '</td>'
        + '<td>' + Math.round(sv.totalCovers) + '</td>'
        + '<td>' + sv.weeks + '</td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="6" style="color:var(--t3);text-align:center;padding:14px;">No server data yet. Enter weekly data in This Week.</td></tr>';

    // Upsell revenue calculator
    const upsellCalc = '<div class="card" style="margin-top:16px;">'
      + '<div class="sh">Upsell Revenue Calculator</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:16px;line-height:1.6;">See the annual revenue impact of closing your check average gap.</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:16px;">'
      + '<div class="f w-md"><label>Current Team Check Average</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rca-cur" value="' + (teamAvg ? teamAvg.toFixed(2) : '') + '" step="0.01"/></div></div>'
      + '<div class="f w-md"><label>Target Check Average</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rca-tgt" value="' + targetCA + '" step="0.01"/></div></div>'
      + '<div class="f w-md"><label>Weekly Covers</label><input type="number" id="rca-cov" value="' + (weeks.length ? Math.round(weeks.slice(-4).reduce((s,w)=>s+(w.covers||0),0)/Math.min(weeks.length,4)) : '') + '"/></div>'
      + '</div>'
      + '<div id="rca-result"></div>'
      + '</div>';

    // Weekly trend
    const trendRows = weeks.slice().reverse().slice(0,12).map(w =>
      '<tr><td>Wk ' + w.week_num + '</td>'
      + '<td>' + (w.period_end||'').slice(0,10) + '</td>'
      + '<td>' + (w.covers||'—') + '</td>'
      + '<td class="' + (w.check_avg >= targetCA ? 'pos' : 'neg') + ' val">' + (w.check_avg ? App.fmtCurrency(w.check_avg) : '—') + '</td>'
      + '<td style="color:' + ((w.check_avg||0) >= targetCA ? 'var(--gold)' : 'var(--red)') + ';font-weight:700;">' + (w.check_avg ? ((w.check_avg - targetCA) >= 0 ? '+' : '') + App.fmtCurrency(w.check_avg - targetCA) : '—') + '</td>'
      + '</tr>'
    ).join('') || '<tr><td colspan="5" style="color:var(--t3);text-align:center;padding:14px;">No weeks saved yet.</td></tr>';

    container.innerHTML = '<div class="screen">'
      // Summary cards
      + '<div class="metric-grid" style="margin-bottom:16px;">'
      + '<div class="metric-card"><div class="metric-label">Target Check Average</div><div class="metric-val">' + App.fmtCurrency(targetCA) + '</div><div class="metric-target">Your set target</div></div>'
      + '<div class="metric-card"><div class="metric-label">Team Average</div><div class="metric-val ' + (teamAvg == null ? '' : teamAvg >= targetCA ? 'on-target' : 'over-target') + '">' + (teamAvg ? App.fmtCurrency(teamAvg) : '—') + '</div><div class="metric-target">All servers</div></div>'
      + (spread != null ? '<div class="metric-card"><div class="metric-label">Performance Spread</div><div class="metric-val ' + (spread > 10 ? 'over-target' : 'on-target') + '">' + App.fmtCurrency(spread) + '</div><div class="metric-target">Top vs bottom</div></div>' : '')
      + (topServer ? '<div class="metric-card"><div class="metric-label">Top Server</div><div class="metric-val on-target">' + App.fmtCurrency(topServer.checkAvg) + '</div><div class="metric-target">' + esc(topServer.name) + '</div></div>' : '')
      + '</div>'
      // Server table
      + '<div class="sh">Server Check Average</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Server</th><th>Check Avg</th><th>vs Target</th><th>vs Team</th><th>Total Covers</th><th>Weeks</th></tr></thead><tbody>' + serverRows + '</tbody></table></div>'
      + upsellCalc
      + '<div class="sh" style="margin-top:16px;">Weekly Check Average Trend</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Week</th><th>Period End</th><th>Covers</th><th>Check Avg</th><th>vs Target</th></tr></thead><tbody>' + trendRows + '</tbody></table></div>'
      + '</div>';

    const calcUpsell = () => {
      const cur = parseFloat(document.getElementById('rca-cur')?.value) || 0;
      const tgt = parseFloat(document.getElementById('rca-tgt')?.value) || 0;
      const cov = parseFloat(document.getElementById('rca-cov')?.value) || 0;
      const el  = document.getElementById('rca-result');
      if (!el || !cur || !tgt || !cov) { if(el) el.innerHTML=''; return; }
      const wkGap  = (tgt - cur) * cov;
      const annGap = wkGap * 52;
      el.innerHTML = '<div style="display:flex;gap:16px;flex-wrap:wrap;">'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 14px;"><div style="font-size:10px;color:var(--t3);">Weekly Revenue Gap</div><div style="font-size:20px;font-weight:800;color:' + (wkGap > 0 ? 'var(--gold)' : 'var(--red)') + ';">' + (wkGap > 0 ? '+' : '') + App.fmtCurrency(wkGap) + '</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 14px;"><div style="font-size:10px;color:var(--t3);">Annual Revenue Gap</div><div style="font-size:20px;font-weight:800;color:' + (annGap > 0 ? 'var(--gold)' : 'var(--red)') + ';">' + (annGap > 0 ? '+' : '') + App.fmtCurrency(annGap) + '</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 14px;"><div style="font-size:10px;color:var(--t3);">Per Guest Gap</div><div style="font-size:20px;font-weight:800;color:var(--t1);">' + App.fmtCurrency(tgt - cur) + '</div></div>'
        + '</div>';
    };
    ['rca-cur','rca-tgt','rca-cov'].forEach(id => document.getElementById(id)?.addEventListener('input', calcUpsell));
    calcUpsell();
  }
};
