'use strict';
S.RevenueRPLH = {
  render(container, actions) {
    const rs    = App.data.revenue_settings || {};
    const t     = rs.targets || {};
    const weeks = App.data.revenue_weeks || [];
    const last  = weeks.length ? weeks[weeks.length - 1] : null;
    const prev4 = weeks.slice(-5,-1);
    const avg4  = fn => { const v = prev4.map(fn).filter(x => x != null); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };

    const dayparts = [
      { key:'lunch',  label:'Lunch',  target: t.rplh_lunch  || 50 },
      { key:'dinner', label:'Dinner', target: t.rplh_dinner || 75 },
      { key:'bar',    label:'Bar',    target: t.rplh_bar    || 65 },
    ];

    const dpCards = dayparts.map(d => {
      const cur  = last?.['rplh_' + d.key] || null;
      const avg  = avg4(w => w['rplh_' + d.key]);
      const gap  = cur != null ? cur - d.target : null;
      return '<div class="metric-card">'
        + '<div class="metric-label">' + d.label + ' RPLH</div>'
        + '<div class="metric-val ' + (cur == null ? '' : cur >= d.target ? 'on-target' : 'over-target') + '">' + (cur ? App.fmtCurrency(cur) : '—') + '</div>'
        + '<div class="metric-target">Target: ' + App.fmtCurrency(d.target) + '</div>'
        + '<div class="metric-impact ' + (gap == null ? '' : gap >= 0 ? 'pos' : 'neg') + '">' + (gap != null ? (gap >= 0 ? '+' : '') + App.fmtCurrency(gap) + ' vs target' : '—') + '</div>'
        + '<div class="metric-trend">' + (avg ? App.fmtCurrency(avg) + ' 4wk avg' : '—') + '</div>'
        + '</div>';
    }).join('');

    // Optimal staffing calculator
    const calcHtml = '<div class="card" style="margin-top:16px;">'
      + '<div class="sh">Optimal Staffing Calculator</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:16px;line-height:1.6;">Enter a revenue forecast and RPLH target to get the optimal hours for that shift.</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:16px;">'
      + '<div class="f w-md"><label>Revenue Forecast</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rplh-rev" placeholder="0"/></div></div>'
      + '<div class="f w-md"><label>RPLH Target</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rplh-tgt" value="' + (t.rplh_dinner || 75) + '"/></div></div>'
      + '<div class="f w-md"><label>Labor Cost Target %</label><div class="fw"><input class="suf" type="number" id="rplh-pct" value="' + (t.floor_labor_pct || 32) + '" step="0.5"/><span class="suf">%</span></div></div>'
      + '</div>'
      + '<div id="rplh-result"></div>'
      + '</div>';

    // 8-week trend chart
    const chartWeeks = weeks.slice(-8);
    let chartHtml = '';
    if (chartWeeks.length >= 2) {
      const W=700, H=200, PAD={t:20,r:40,b:30,l:48};
      const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;
      const series = dayparts.map(d => chartWeeks.map(w => w['rplh_'+d.key]||null));
      const allV = series.flat().filter(v=>v!=null);
      if (allV.length) {
        const minY = Math.max(0, Math.floor(Math.min(...allV)-10));
        const maxY = Math.ceil(Math.max(...allV)+10);
        const xp = i => PAD.l + (i/(chartWeeks.length-1))*cw;
        const yp = v => PAD.t + (1-(v-minY)/(maxY-minY))*ch;
        const cols = ['#C9A84C','rgba(255,255,255,0.7)','#4888A8'];
        const lines = series.map((s,si) => {
          const pts = s.map((v,i) => v!=null ? xp(i).toFixed(1)+','+yp(v).toFixed(1) : null).filter(Boolean);
          return pts.length >= 2 ? '<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+cols[si]+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' : '';
        }).join('');
        const labels = chartWeeks.map((w,i) => '<text x="'+xp(i).toFixed(1)+'" y="'+(H-PAD.b+14)+'" text-anchor="middle" fill="var(--t4)" font-size="9">W'+w.week_num+'</text>').join('');
        chartHtml = '<div class="chart-card" style="margin-top:16px;">'
          + '<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;flex-wrap:wrap;">'
          + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">8-Week RPLH Trend</div>'
          + cols.map((c,i) => '<span style="font-size:10px;color:'+c+';">— '+dayparts[i].label+'</span>').join('')
          + '</div>'
          + '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;">'
          + lines + labels
          + '</svg></div>';
      }
    }

    const histRows = weeks.slice().reverse().slice(0,12).map(w =>
      '<tr><td>Wk ' + w.week_num + '</td>'
      + '<td>' + (w.rplh_lunch  ? App.fmtCurrency(w.rplh_lunch)  : '—') + '</td>'
      + '<td>' + (w.rplh_dinner ? App.fmtCurrency(w.rplh_dinner) : '—') + '</td>'
      + '<td>' + (w.rplh_bar    ? App.fmtCurrency(w.rplh_bar)    : '—') + '</td>'
      + '<td class="val">' + (w.rplh_blended ? App.fmtCurrency(w.rplh_blended) : '—') + '</td>'
      + '</tr>'
    ).join('') || '<tr><td colspan="5" style="color:var(--t3);text-align:center;padding:14px;">No weeks saved yet.</td></tr>';

    container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + dpCards + '</div>'
      + chartHtml
      + calcHtml
      + '<div class="sh" style="margin-top:16px;">RPLH History</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Week</th><th>Lunch ' + tt('r-rplh') + '</th><th>Dinner ' + tt('r-rplh') + '</th><th>Bar ' + tt('r-rplh') + '</th><th>Blended ' + tt('r-rplh') + '</th></tr></thead><tbody>' + histRows + '</tbody></table></div>'
      + '</div>';

    const calcResult = () => {
      const rev = parseFloat(document.getElementById('rplh-rev')?.value) || 0;
      const tgt = parseFloat(document.getElementById('rplh-tgt')?.value) || 65;
      const pct = parseFloat(document.getElementById('rplh-pct')?.value) || 32;
      const el  = document.getElementById('rplh-result');
      if (!el || !rev) { if(el) el.innerHTML=''; return; }
      const optHrs   = rev / tgt;
      const maxLabor = rev * (pct / 100);
      el.innerHTML = '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;">'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 14px;"><div style="font-size:10px;color:var(--t3);">Optimal Hours</div><div style="font-size:20px;font-weight:800;color:var(--gold);">' + optHrs.toFixed(1) + ' hrs</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 14px;"><div style="font-size:10px;color:var(--t3);">Max Labor Budget</div><div style="font-size:20px;font-weight:800;color:var(--t1);">' + App.fmtCurrency(maxLabor) + '</div></div>'
        + '</div>';
    };
    ['rplh-rev','rplh-tgt','rplh-pct'].forEach(id => document.getElementById(id)?.addEventListener('input', calcResult));
  }
};
