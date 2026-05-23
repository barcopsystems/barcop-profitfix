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
      return '<tr>'
        + '<td style="font-weight:700;color:var(--t1);">' + esc(sv.name) + '</td>'
        + '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:' + (sv.checkAvg >= targetCA ? 'var(--gold)' : 'var(--red)') + ';">' + App.fmtCurrency(sv.checkAvg) + '</td>'
        + '<td style="color:' + (vs >= 0 ? 'var(--gold)' : 'var(--red)') + ';font-weight:700;">' + (vs >= 0 ? '+' : '') + App.fmtCurrency(vs) + '</td>'
        + '<td style="color:' + (vsTeam >= 0 ? 'var(--gold)' : 'var(--red)') + ';">' + (vsTeam != null ? (vsTeam >= 0 ? '+' : '') + App.fmtCurrency(vsTeam) : '-') + '</td>'
        + '<td>' + Math.round(sv.totalCovers) + '</td>'
        + '<td>' + sv.weeks + '</td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="6" style="color:var(--t3);text-align:center;padding:14px;">No server data yet. Enter weekly data in This Week.</td></tr>';

    // Upsell revenue calculator
    const upsellCalc = '<div class="card" style="margin-top:16px;">'
      + '<div class="sh">Upsell Revenue Calculator ' + tt('r-upsell-calc') + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:16px;">'
      + '<div class="f w-md"><label>Current Team Check Average</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rca-cur" value="' + (teamAvg ? teamAvg.toFixed(2) : '') + '" step="0.01"/></div></div>'
      + '<div class="f w-md"><label>Target Check Average</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rca-tgt" value="' + targetCA + '" step="0.01"/></div></div>'
      + '<div class="f w-md"><label>Weekly Covers</label><input type="number" id="rca-cov" value="' + (weeks.length ? Math.round(weeks.slice(-4).reduce((s,w)=>s+(w.covers||0),0)/Math.min(weeks.length,4)) : '') + '"/></div>'
      + '</div>'
      + '<div id="rca-result"></div>'
      + '</div>';

    // Weekly trend table
    const trendRows = weeks.slice().reverse().slice(0,12).map(w =>
      '<tr><td>Wk ' + w.week_num + '</td>'
      + '<td>' + (w.period_end||'').slice(0,10) + '</td>'
      + '<td>' + (w.covers||'-') + '</td>'
      + '<td class="' + (w.check_avg >= targetCA ? 'pos' : 'neg') + ' val">' + (w.check_avg ? App.fmtCurrency(w.check_avg) : '-') + '</td>'
      + '<td style="color:' + ((w.check_avg||0) >= targetCA ? 'var(--gold)' : 'var(--red)') + ';font-weight:700;">' + (w.check_avg ? ((w.check_avg - targetCA) >= 0 ? '+' : '') + App.fmtCurrency(w.check_avg - targetCA) : '-') + '</td>'
      + '</tr>'
    ).join('') || '<tr><td colspan="5" style="color:var(--t3);text-align:center;padding:14px;">No weeks saved yet.</td></tr>';

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid" style="margin-bottom:16px;">'
      + '<div class="metric-card"><div class="metric-label">Target Check Average</div><div class="metric-val">' + App.fmtCurrency(targetCA) + '</div><div class="metric-target">Your set target</div></div>'
      + '<div class="metric-card"><div class="metric-label">Team Average</div><div class="metric-val ' + (teamAvg == null ? '' : teamAvg >= targetCA ? 'on-target' : 'over-target') + '">' + (teamAvg ? App.fmtCurrency(teamAvg) : '-') + '</div><div class="metric-target">All servers</div></div>'
      + (spread != null ? '<div class="metric-card"><div class="metric-label">Performance Spread</div><div class="metric-val ' + (spread > 10 ? 'over-target' : 'on-target') + '">' + App.fmtCurrency(spread) + '</div><div class="metric-target">Top vs bottom</div></div>' : '')
      + (topServer ? '<div class="metric-card"><div class="metric-label">Top Server</div><div class="metric-val on-target">' + App.fmtCurrency(topServer.checkAvg) + '</div><div class="metric-target">' + esc(topServer.name) + '</div></div>' : '')
      + '</div>'
      + this.buildChart(weeks.slice(-8), targetCA)
      + '<div class="sh" style="margin-top:16px;">Server Check Average</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Server</th><th>Check Avg ' + tt('r-check-avg') + '</th><th>vs Target</th><th>vs Team</th><th>Total Covers ' + tt('r-covers') + '</th><th>Weeks</th></tr></thead><tbody>' + serverRows + '</tbody></table></div>'
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
  },

  buildChart(weeks, targetCA) {
    if (weeks.length < 2) return '<div class="chart-card" style="padding:24px 24px 20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:32px;">8-Week Check Average Trend</div>'
      + '<div style="text-align:center;padding:24px 0 8px;color:var(--t4);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Enter at least 2 weeks to see trend</div></div>';

    const W=800, H=200, PAD={t:28,r:60,b:40,l:52};
    const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;

    const caS = weeks.map(w => w.check_avg ?? null);
    const allV = caS.filter(v => v != null);
    if (!allV.length) return '';

    const minY = Math.max(0, Math.floor(Math.min(...allV, targetCA) - 3));
    const maxY = Math.ceil(Math.max(...allV, targetCA) + 4);
    const xs = i => PAD.l + (weeks.length > 1 ? (i / (weeks.length - 1)) * cw : cw / 2);
    const ys = v => PAD.t + ch - ((v - minY) / (maxY - minY)) * ch;

    const smoothPath = pts => {
      const valid = pts.map((v,i) => v != null ? {x:xs(i), y:ys(v)} : null).filter(Boolean);
      if (valid.length < 2) return valid.length === 1 ? 'M'+valid[0].x+','+valid[0].y : '';
      let d = 'M'+valid[0].x.toFixed(1)+','+valid[0].y.toFixed(1);
      for (let i=1; i<valid.length; i++) {
        const cp = (valid[i].x - valid[i-1].x) * 0.35;
        d += ' C'+(valid[i-1].x+cp).toFixed(1)+','+valid[i-1].y.toFixed(1)+' '+(valid[i].x-cp).toFixed(1)+','+valid[i].y.toFixed(1)+' '+valid[i].x.toFixed(1)+','+valid[i].y.toFixed(1);
      }
      return d;
    };

    const areaPath = pts => {
      const valid = pts.map((v,i) => v != null ? {x:xs(i), y:ys(v)} : null).filter(Boolean);
      if (valid.length < 2) return '';
      let d = 'M'+valid[0].x.toFixed(1)+','+ys(minY).toFixed(1)+' L'+valid[0].x.toFixed(1)+','+valid[0].y.toFixed(1);
      for (let i=1; i<valid.length; i++) {
        const cp = (valid[i].x - valid[i-1].x) * 0.35;
        d += ' C'+(valid[i-1].x+cp).toFixed(1)+','+valid[i-1].y.toFixed(1)+' '+(valid[i].x-cp).toFixed(1)+','+valid[i].y.toFixed(1)+' '+valid[i].x.toFixed(1)+','+valid[i].y.toFixed(1);
      }
      d += ' L'+valid[valid.length-1].x.toFixed(1)+','+ys(minY).toFixed(1)+' Z';
      return d;
    };

    const range = maxY - minY, tickStep = range <= 10 ? 2 : range <= 20 ? 4 : 5;
    const ticks = []; for (let v=Math.ceil(minY/tickStep)*tickStep; v<=maxY; v+=tickStep) ticks.push(v);
    const yTicks = ticks.map(v =>
      '<line x1="'+PAD.l+'" y1="'+ys(v).toFixed(1)+'" x2="'+(W-PAD.r)+'" y2="'+ys(v).toFixed(1)+'" stroke="rgba(255,255,255,0.04)"/>'
      + '<text x="'+(PAD.l-6)+'" y="'+(ys(v)+4).toFixed(1)+'" text-anchor="end" fill="var(--t4)" font-family="Barlow,sans-serif" font-size="9">$'+v+'</text>'
    ).join('');

    const xLabels = weeks.map((w,i) =>
      '<text x="'+xs(i).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">'
      + (w.period_end ? w.period_end.slice(5).replace('-','/') : 'Wk'+w.week_num) + '</text>'
    ).join('');

    const caLabels = caS.map((v,i) => {
      if (v == null) return '';
      const x = xs(i), y = ys(v);
      const above = y > PAD.t + 16;
      return '<text x="'+x.toFixed(1)+'" y="'+(above ? y-8 : y+16).toFixed(1)+'" text-anchor="middle" fill="rgba(255,255,255,0.75)" font-family="Barlow Condensed,sans-serif" font-size="11" font-weight="700">$'+v.toFixed(0)+'</text>';
    }).join('');

    const uid = 'rca'+Math.random().toString(36).slice(2,6);

    return '<div class="chart-card" style="padding:20px 24px 16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">8-Week Check Average Trend</div>'
      + '<div style="display:flex;gap:16px;">'
      + '<span style="font-size:10px;color:var(--gold);font-weight:600;">-- Check Avg</span>'
      + '<span style="font-size:10px;color:rgba(219,171,70,0.4);font-weight:600;">- - Target $' + targetCA + '</span>'
      + '</div></div>'
      + '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;" preserveAspectRatio="none">'
      + '<defs><linearGradient id="caGrad'+uid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#DBAB46" stop-opacity="0.22"/><stop offset="100%" stop-color="#DBAB46" stop-opacity="0"/></linearGradient></defs>'
      + yTicks
      + '<line x1="'+PAD.l+'" y1="'+ys(targetCA).toFixed(1)+'" x2="'+(W-PAD.r)+'" y2="'+ys(targetCA).toFixed(1)+'" stroke="rgba(219,171,70,0.3)" stroke-width="1.5" stroke-dasharray="5,4"/>'
      + (areaPath(caS) ? '<path d="'+areaPath(caS)+'" fill="url(#caGrad'+uid+')"/>' : '')
      + '<path d="'+smoothPath(caS)+'" fill="none" stroke="#DBAB46" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + caLabels + xLabels
      + '</svg></div>';
  }
};
