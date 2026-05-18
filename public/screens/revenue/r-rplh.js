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
        + '<div class="metric-val ' + (cur == null ? '' : cur >= d.target ? 'on-target' : 'over-target') + '">' + (cur ? App.fmtCurrency(cur) : ' ') + '</div>'
        + '<div class="metric-target">Target: ' + App.fmtCurrency(d.target) + '</div>'
        + '<div class="metric-impact ' + (gap == null ? '' : gap >= 0 ? 'pos' : 'neg') + '">' + (gap != null ? (gap >= 0 ? '+' : '') + App.fmtCurrency(gap) + ' vs target' : ' ') + '</div>'
        + '<div class="metric-trend">' + (avg ? App.fmtCurrency(avg) + ' 4wk avg' : ' ') + '</div>'
        + '</div>';
    }).join('');

    // Optimal staffing calculator
    const calcHtml = '<div class="card" style="margin-top:16px;">'
      + '<div class="sh">Optimal Staffing Calculator</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:16px;">'
      + '<div class="f w-md"><label>Revenue Forecast ' + tt('r-daypart-rev') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rplh-rev" placeholder="0"/></div></div>'
      + '<div class="f w-md"><label>RPLH Target ' + tt('r-rplh-target') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rplh-tgt" value="' + (t.rplh_dinner || 75) + '"/></div></div>'
      + '<div class="f w-md"><label>Labor Cost Target % ' + tt('r-labor-pct') + '</label><div class="fw"><input class="suf" type="number" id="rplh-pct" value="' + (t.floor_labor_pct || 32) + '" step="0.5"/><span class="suf">%</span></div></div>'
      + '</div>'
      + '<div id="rplh-result"></div>'
      + '</div>';

    // 8-week trend chart
    const chartWeeks = weeks.slice(-8);
    let chartHtml = '';
    if (chartWeeks.length >= 2) {
      const W=800, H=220, PAD={t:28,r:60,b:40,l:48};
      const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;
      const series = dayparts.map(d => chartWeeks.map(w => w['rplh_'+d.key]||null));
      const allV = series.flat().filter(v=>v!=null);
      if (allV.length) {
        const minY = Math.max(0, Math.floor(Math.min(...allV)-8));
        const maxY = Math.ceil(Math.max(...allV)+8);
        const xs = i => PAD.l + (i/(chartWeeks.length-1))*cw;
        const ys = v => PAD.t + ch - ((v-minY)/(maxY-minY))*ch;
        const cols = ['#C9A84C','rgba(255,255,255,0.65)','#4888A8'];

        const smoothPath = pts => {
          const valid = pts.map((v,i)=>v!=null?{x:xs(i),y:ys(v)}:null).filter(Boolean);
          if (valid.length<2) return '';
          let d='M'+valid[0].x.toFixed(1)+','+valid[0].y.toFixed(1);
          for(let i=1;i<valid.length;i++){const cp=(valid[i].x-valid[i-1].x)*0.35;d+=' C'+(valid[i-1].x+cp).toFixed(1)+','+valid[i-1].y.toFixed(1)+' '+(valid[i].x-cp).toFixed(1)+','+valid[i].y.toFixed(1)+' '+valid[i].x.toFixed(1)+','+valid[i].y.toFixed(1);}
          return d;
        };
        const areaPath = pts => {
          const valid = pts.map((v,i)=>v!=null?{x:xs(i),y:ys(v)}:null).filter(Boolean);
          if (valid.length<2) return '';
          let d='M'+valid[0].x.toFixed(1)+','+ys(minY).toFixed(1)+' L'+valid[0].x.toFixed(1)+','+valid[0].y.toFixed(1);
          for(let i=1;i<valid.length;i++){const cp=(valid[i].x-valid[i-1].x)*0.35;d+=' C'+(valid[i-1].x+cp).toFixed(1)+','+valid[i-1].y.toFixed(1)+' '+(valid[i].x-cp).toFixed(1)+','+valid[i].y.toFixed(1)+' '+valid[i].x.toFixed(1)+','+valid[i].y.toFixed(1);}
          d+=' L'+valid[valid.length-1].x.toFixed(1)+','+ys(minY).toFixed(1)+' Z';
          return d;
        };

        const range=maxY-minY, tickStep=range<=20?4:range<=40?8:12;
        const ticks=[]; for(let v=Math.ceil(minY/tickStep)*tickStep;v<=maxY;v+=tickStep)ticks.push(v);
        const yTicks=ticks.map(v=>'<line x1="'+PAD.l+'" y1="'+ys(v).toFixed(1)+'" x2="'+(W-PAD.r)+'" y2="'+ys(v).toFixed(1)+'" stroke="rgba(255,255,255,0.04)"/><text x="'+(PAD.l-6)+'" y="'+(ys(v)+4).toFixed(1)+'" text-anchor="end" fill="var(--t4)" font-family="Barlow,sans-serif" font-size="9">$'+v+'</text>').join('');
        const xLabels=chartWeeks.map((w,i)=>'<text x="'+xs(i).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">'+(w.period_end?w.period_end.slice(5).replace('-','/'):'Wk'+w.week_num)+'</text>').join('');

        const uid = 'rp'+Math.random().toString(36).slice(2,6);
        const svgParts = series.map((s,si) => {
          const p = smoothPath(s), a = areaPath(s);
          return (a&&si===0?'<path d="'+a+'" fill="url(#rpGrad'+uid+')"/>':'')
               + (p?'<path d="'+p+'" fill="none" stroke="'+cols[si]+'" stroke-width="'+(si===0?2:1.5)+'" stroke-linecap="round" stroke-linejoin="round"/>':'');
        }).join('');

        chartHtml = '<div class="chart-card" style="padding:20px 24px 16px;margin-top:16px;">'
          + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">'
          + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">8-Week RPLH Trend</div>'
          + '<div style="display:flex;gap:16px;">' + cols.map((c,i)=>'<span style="font-size:10px;color:'+c+';font-weight:600;">  '+dayparts[i].label+'</span>').join('') + '</div>'
          + '</div>'
          + '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;" preserveAspectRatio="none">'
          + '<defs><linearGradient id="rpGrad'+uid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#C9A84C" stop-opacity="0.15"/><stop offset="100%" stop-color="#C9A84C" stop-opacity="0"/></linearGradient></defs>'
          + yTicks + svgParts + xLabels
          + '</svg></div>';
      }
    }

    const histRows = weeks.slice().reverse().slice(0,12).map(w =>
      '<tr><td>Wk ' + w.week_num + '</td>'
      + '<td>' + (w.rplh_lunch  ? App.fmtCurrency(w.rplh_lunch)  : ' ') + '</td>'
      + '<td>' + (w.rplh_dinner ? App.fmtCurrency(w.rplh_dinner) : ' ') + '</td>'
      + '<td>' + (w.rplh_bar    ? App.fmtCurrency(w.rplh_bar)    : ' ') + '</td>'
      + '<td class="val">' + (w.rplh_blended ? App.fmtCurrency(w.rplh_blended) : ' ') + '</td>'
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
        + '<div style="background:var(--input);border-radius:6px;padding:10px 14px;"><div style="font-size:10px;color:var(--t3);">Optimal Hours ' + tt('r-optimal-hrs') + '</div><div style="font-size:20px;font-weight:800;color:var(--gold);">' + optHrs.toFixed(1) + ' hrs</div></div>'
        + '<div style="background:var(--input);border-radius:6px;padding:10px 14px;"><div style="font-size:10px;color:var(--t3);">Max Labor Budget ' + tt('r-labor-budget-calc') + '</div><div style="font-size:20px;font-weight:800;color:var(--t1);">' + App.fmtCurrency(maxLabor) + '</div></div>'
        + '</div>';
    };
    ['rplh-rev','rplh-tgt','rplh-pct'].forEach(id => document.getElementById(id)?.addEventListener('input', calcResult));
  }
};
