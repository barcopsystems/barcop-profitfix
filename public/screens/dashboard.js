'use strict';
S.Dashboard = {
  _dismissed: false,
  render(container, actions) {
    const data = App.data;
    const weeks = data.weeks || [];
    const targets = data.settings.targets || {};
    const latest = weeks.length > 0 ? weeks[weeks.length-1] : null;
    const prior4 = weeks.slice(-5,-1);

    const avg4 = fn => {
      const vals = prior4.map(fn).filter(v => v!=null && !isNaN(v));
      return vals.length > 0 ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
    };

    const barPct   = latest?.bar?.cost_pct ?? null;
    const foodPct  = latest?.food?.cost_pct ?? null;
    const primePct = latest?.prime_cost_pct ?? null;
    const weekVar  = latest ? (latest.bar_variance||[]).reduce((s,r)=>s+(r.variance_dollar||0),0) : null;

    const barTarget   = targets.bar_pour_cost_pct ?? 22;
    const foodTarget  = targets.food_cost_pct ?? 32;
    const primeTarget = targets.prime_cost_pct ?? 60;
    const barRev = latest?.bar?.revenue ?? 0;
    const foodRev = latest?.food?.revenue ?? 0;
    const barImpact  = barPct!=null  ? ((barPct-barTarget)/100)*barRev : null;
    const foodImpact = foodPct!=null ? ((foodPct-foodTarget)/100)*foodRev : null;

    const barAvg = avg4(w=>w.bar?.cost_pct);
    const foodAvg = avg4(w=>w.food?.cost_pct);
    const primeAvg = avg4(w=>w.prime_cost_pct);
    const varAvg = avg4(w=>(w.bar_variance||[]).reduce((s,r)=>s+(r.variance_dollar||0),0));

    const trendHtml = (cur, avg, lowerBetter=true) => {
      if (avg==null || cur==null) return '<div class="metric-trend">—</div>';
      const diff = cur - avg;
      if (Math.abs(diff) < 0.15) return '<div class="metric-trend">→ flat</div>';
      const improving = lowerBetter ? diff < 0 : diff > 0;
      return '<div class="metric-trend ' + (improving?'trend-up':'trend-dn') + '">'+(diff>0?'↑':'↓')+' vs 4wk avg</div>';
    };

    const metricCard = (label, val, target, impact, trendEl, cls) => {
      const impactHtml = impact!=null
        ? '<div class="metric-impact ' + (impact>0?'neg':'pos') + '">'+(impact>0?'+':'')+App.fmtCurrency(impact)+' vs target</div>'
        : '<div class="metric-impact" style="color:var(--t4);">—</div>';
      return '<div class="metric-card">'
        +'<div class="metric-label">'+label+'</div>'
        +'<div class="metric-val '+cls+'">'+(val||'—')+'</div>'
        +'<div class="metric-target">Target: '+App.fmtPct(target)+'</div>'
        + impactHtml + trendEl
        +'</div>';
    };

    const barCls   = barPct==null?'':barPct>barTarget?'over-target':'on-target';
    const foodCls  = foodPct==null?'':foodPct>foodTarget?'over-target':'on-target';
    const primeCls = primePct==null?'':primePct>primeTarget?'over-target':'on-target';
    const varCls   = weekVar==null?'':weekVar>0?'over-target':'on-target';

    // Alert
    let alertHtml = '';
    if (latest && !this._dismissed) {
      const diff = barPct != null ? barPct - barTarget : 0;
      if (diff > 2) {
        const wkImpact = (diff/100)*barRev;
        alertHtml = '<div class="alert-bar" id="db-alert">'
          +'<div class="alert-text">Pour cost is '+diff.toFixed(1)+' points above target. '
          +App.fmtCurrency(wkImpact)+' this week — '+App.fmtCurrency(wkImpact*52)+' annualized.</div>'
          +'<button class="alert-dismiss" id="db-dismiss">Dismiss</button>'
          +'</div>';
      }
    }

    // Flagged recipes
    const flagged = (data.recipes||[]).filter(r=>r.flagged).length;

    // Chart
    const chartHtml = this.buildChart(weeks.slice(-8), targets);

    // Summary table
    const prev = weeks.length > 1 ? weeks[weeks.length-2] : null;
    const avg4full = fn => avg4(fn);

    let summaryHtml = '';
    if (latest) {
      const row = (label, twFn, lwFn, avgFn, isCurrency=true) => {
        const tw = twFn(latest);
        const lw = lwFn(prev);
        const av = avgFn();
        const fmt = isCurrency ? App.fmtCurrency : App.fmtPct;
        const twCls = !isCurrency && tw!=null ? (tw>(isCurrency?0:barTarget)?'neg':'pos') : '';
        return '<tr><td>'+label+'</td>'
          +'<td class="val '+twCls+'">'+(tw!=null?fmt(tw):'—')+'</td>'
          +'<td>'+(lw!=null?fmt(lw):'—')+'</td>'
          +'<td>'+(av!=null?fmt(av):'—')+'</td></tr>';
      };
      summaryHtml = '<div class="tbl-wrap" style="margin-bottom:18px;"><table class="sum-tbl">'
        +'<thead><tr><th></th><th>This Week</th><th>Last Week</th><th>4-Week Avg</th></tr></thead>'
        +'<tbody>'
        +'<tr><td>Bar Revenue</td><td class="val">'+App.fmtCurrency(latest.bar?.revenue)+'</td><td>'+(prev?App.fmtCurrency(prev.bar?.revenue):'—')+'</td><td>'+(avg4full(w=>w.bar?.revenue)!=null?App.fmtCurrency(avg4full(w=>w.bar?.revenue)):'—')+'</td></tr>'
        +'<tr><td>Bar COGS</td><td>'+App.fmtCurrency(latest.bar?.cogs)+'</td><td>'+(prev?App.fmtCurrency(prev.bar?.cogs):'—')+'</td><td>'+(avg4full(w=>w.bar?.cogs)!=null?App.fmtCurrency(avg4full(w=>w.bar?.cogs)):'—')+'</td></tr>'
        +'<tr><td>Bar Labor</td><td>'+App.fmtCurrency(latest.bar?.labor)+'</td><td>'+(prev?App.fmtCurrency(prev.bar?.labor):'—')+'</td><td>'+(avg4full(w=>w.bar?.labor)!=null?App.fmtCurrency(avg4full(w=>w.bar?.labor)):'—')+'</td></tr>'
        +'<tr><td>Bar Pour Cost %</td><td class="'+(barPct>barTarget?'neg':'pos')+' val">'+App.fmtPct(barPct)+'</td><td>'+(prev?App.fmtPct(prev.bar?.cost_pct):'—')+'</td><td>'+(avg4full(w=>w.bar?.cost_pct)!=null?App.fmtPct(avg4full(w=>w.bar?.cost_pct)):'—')+'</td></tr>'
        +'<tr><td>Food Revenue</td><td class="val">'+App.fmtCurrency(latest.food?.revenue)+'</td><td>'+(prev?App.fmtCurrency(prev.food?.revenue):'—')+'</td><td>'+(avg4full(w=>w.food?.revenue)!=null?App.fmtCurrency(avg4full(w=>w.food?.revenue)):'—')+'</td></tr>'
        +'<tr><td>Food Cost %</td><td class="'+(foodPct>foodTarget?'neg':'pos')+' val">'+App.fmtPct(foodPct)+'</td><td class="'+(prev?.food?.cost_pct>foodTarget?'neg':'pos')+'">'+App.fmtPct(prev?.food?.cost_pct)+'</td><td>'+(avg4full(w=>w.food?.cost_pct)!=null?App.fmtPct(avg4full(w=>w.food?.cost_pct)):'—')+'</td></tr>'
        +'<tr class="total"><td>Total Revenue</td><td class="val">'+App.fmtCurrency((latest.bar?.revenue||0)+(latest.food?.revenue||0))+'</td><td>'+(prev?App.fmtCurrency((prev.bar?.revenue||0)+(prev.food?.revenue||0)):'—')+'</td><td>—</td></tr>'
        +'<tr class="total"><td>Prime Cost %</td><td class="val '+(primePct>primeTarget?'neg':'pos')+'">'+App.fmtPct(primePct)+'</td><td>'+(prev?App.fmtPct(prev.prime_cost_pct):'—')+'</td><td>'+(avg4full(w=>w.prime_cost_pct)!=null?App.fmtPct(avg4full(w=>w.prime_cost_pct)):'—')+'</td></tr>'
        +'</tbody></table></div>';
    } else {
      summaryHtml = '<div class="card"><div class="empty"><div class="empty-title">No weeks saved yet</div>'
        +'<div class="empty-sub">Enter your first week to see your numbers here.</div></div></div>';
    }

    container.innerHTML = '<div class="screen">'
      + alertHtml
      + '<div class="metric-grid">'
      + metricCard('Bar Pour Cost', barPct!=null?App.fmtPct(barPct):null, barTarget, barImpact, trendHtml(barPct,barAvg), barCls)
      + metricCard('Food Cost', foodPct!=null?App.fmtPct(foodPct):null, foodTarget, foodImpact, trendHtml(foodPct,foodAvg), foodCls)
      + metricCard('Prime Cost', primePct!=null?App.fmtPct(primePct):null, primeTarget, null, trendHtml(primePct,primeAvg), primeCls)
      + '<div class="metric-card"><div class="metric-label">Weekly Variance</div>'
      +'<div class="metric-val '+(weekVar==null?'':weekVar>0?'over-target':'on-target')+'">'+(weekVar!=null?App.fmtCurrency(weekVar):'—')+'</div>'
      +'<div class="metric-target">Target: $0</div>'
      +'<div class="metric-impact" style="color:var(--t4);">From inventory count</div>'
      +trendHtml(weekVar,varAvg,true)+'</div>'
      + '</div>'
      + chartHtml
      + '<div class="sh">This Week Summary</div>'
      + summaryHtml
      + '<div class="sh">Quick Actions</div>'
      + '<div class="qa">'
      +'<button class="btn btn-primary" id="qa-week">Enter This Week</button>'
      +'<button class="btn btn-ghost" id="qa-shift">Run Shift Check</button>'
      +'<button class="btn btn-ghost" id="qa-reports">View Reports</button>'
      +(flagged>0?'<button class="btn btn-danger" id="qa-recipes">'+flagged+' Recipe'+(flagged>1?'s':'')+' Above Target</button>':'')
      +'</div>'
      +'</div>';

    document.getElementById('db-dismiss')?.addEventListener('click', () => {
      this._dismissed=true;
      document.getElementById('db-alert')?.remove();
    });
    document.getElementById('qa-week')?.addEventListener('click', ()=>App.navigate('this-week'));
    document.getElementById('qa-shift')?.addEventListener('click', ()=>App.navigate('shift-check'));
    document.getElementById('qa-reports')?.addEventListener('click', ()=>App.navigate('reports'));
    document.getElementById('qa-recipes')?.addEventListener('click', ()=>App.navigate('recipe-library'));
  },

  buildChart(weeks, targets) {
    if (weeks.length < 2) return '<div class="chart-card" style="padding:24px 24px 20px;">'
      +'<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:32px;">8-Week Trend</div>'
      +'<div style="text-align:center;padding:24px 0 8px;color:var(--t4);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Enter at least 2 weeks to see trend</div></div>';

    const W=800, H=220, PAD={t:28,r:60,b:40,l:48};
    const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;

    const barS  = weeks.map(w=>w.bar?.cost_pct??null);
    const foodS = weeks.map(w=>w.food?.cost_pct??null);
    const priS  = weeks.map(w=>w.prime_cost_pct??null);
    const allV  = [...barS,...foodS,...priS].filter(v=>v!=null);
    if (allV.length===0) return '';

    const minY = Math.max(0, Math.floor(Math.min(...allV) - 4));
    const maxY = Math.ceil(Math.max(...allV) + 6);
    const xs = i => PAD.l + (weeks.length > 1 ? (i/(weeks.length-1))*cw : cw/2);
    const ys = v => PAD.t + ch - ((v-minY)/(maxY-minY))*ch;

    // Smooth bezier path
    const smoothPath = pts => {
      const valid = pts.map((v,i)=>v!=null?{x:xs(i),y:ys(v)}:null).filter(Boolean);
      if (valid.length < 2) return valid.length===1?`M${valid[0].x},${valid[0].y}`:'';
      let d = `M${valid[0].x.toFixed(1)},${valid[0].y.toFixed(1)}`;
      for (let i=1; i<valid.length; i++) {
        const cp = (valid[i].x - valid[i-1].x) * 0.35;
        d += ` C${(valid[i-1].x+cp).toFixed(1)},${valid[i-1].y.toFixed(1)} ${(valid[i].x-cp).toFixed(1)},${valid[i].y.toFixed(1)} ${valid[i].x.toFixed(1)},${valid[i].y.toFixed(1)}`;
      }
      return d;
    };

    // Area fill path (close back to bottom)
    const areaPath = pts => {
      const valid = pts.map((v,i)=>v!=null?{x:xs(i),y:ys(v),orig:v}:null).filter(Boolean);
      if (valid.length < 2) return '';
      let d = `M${valid[0].x.toFixed(1)},${ys(minY).toFixed(1)} L${valid[0].x.toFixed(1)},${valid[0].y.toFixed(1)}`;
      for (let i=1; i<valid.length; i++) {
        const cp = (valid[i].x - valid[i-1].x) * 0.35;
        d += ` C${(valid[i-1].x+cp).toFixed(1)},${valid[i-1].y.toFixed(1)} ${(valid[i].x-cp).toFixed(1)},${valid[i].y.toFixed(1)} ${valid[i].x.toFixed(1)},${valid[i].y.toFixed(1)}`;
      }
      d += ` L${valid[valid.length-1].x.toFixed(1)},${ys(minY).toFixed(1)} Z`;
      return d;
    };

    const pourTarget = targets.bar_pour_cost_pct || 22;
    const primeTarget = targets.prime_cost_pct || 60;
    const tPx = ys(pourTarget);

    // Y-axis ticks — 4 evenly spaced
    const range = maxY - minY;
    const tickStep = range <= 12 ? 2 : range <= 24 ? 4 : 8;
    const ticks = [];
    for (let v = Math.ceil(minY/tickStep)*tickStep; v <= maxY; v += tickStep) ticks.push(v);

    // X labels
    const xLabels = weeks.map((w,i) => {
      const lbl = w.period_end ? w.period_end.slice(5).replace('-','/') : 'Wk'+w.week_num;
      return `<text x="${xs(i).toFixed(1)}" y="${H-8}" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">${lbl}</text>`;
    }).join('');

    // Value labels on bar cost dots
    const barLabels = barS.map((v,i) => {
      if (v==null) return '';
      const x = xs(i), y = ys(v);
      const above = y > PAD.t + 16;
      return `<text x="${x.toFixed(1)}" y="${(above ? y-10 : y+18).toFixed(1)}" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="Barlow Condensed,sans-serif" font-size="11" font-weight="700">${v.toFixed(1)}%</text>`;
    }).join('');

    const barPath  = smoothPath(barS);
    const foodPath = smoothPath(foodS);
    const priPath  = smoothPath(priS);
    const barArea  = areaPath(barS);

    const uid = 'ag'+Math.random().toString(36).slice(2,6);

    return `<div class="chart-card" style="padding:20px 24px 16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">8-Week Trend</div>
        <div style="display:flex;gap:20px;">
          <span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);">
            <span style="width:20px;height:2px;background:#C9A84C;display:inline-block;border-radius:1px;"></span>Bar Pour Cost</span>
          <span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);">
            <span style="width:20px;height:2px;background:rgba(255,255,255,0.4);display:inline-block;border-radius:1px;"></span>Food Cost</span>
          <span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);">
            <span style="width:20px;height:2px;background:rgba(255,255,255,0.2);display:inline-block;border-radius:1px;"></span>Prime Cost</span>
        </div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible;">
        <defs>
          <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#C9A84C" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#C9A84C" stop-opacity="0.01"/>
          </linearGradient>
        </defs>
        ${ticks.map(v=>`
          <line x1="${PAD.l}" y1="${ys(v).toFixed(1)}" x2="${W-PAD.r}" y2="${ys(v).toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
          <text x="${PAD.l-8}" y="${(ys(v)+4).toFixed(1)}" text-anchor="end" fill="rgba(255,255,255,0.25)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">${v}%</text>
        `).join('')}
        <line x1="${PAD.l}" y1="${tPx.toFixed(1)}" x2="${W-PAD.r}" y2="${tPx.toFixed(1)}" stroke="#C9A84C" stroke-width="1" stroke-dasharray="5,5" opacity="0.35"/>
        <text x="${W-PAD.r+6}" y="${(tPx+4).toFixed(1)}" fill="rgba(201,168,76,0.55)" font-family="Barlow,sans-serif" font-size="9" font-weight="700">TGT</text>
        ${barArea ? `<path d="${barArea}" fill="url(#${uid})"/>` : ''}
        ${priPath ? `<path d="${priPath}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" stroke-linejoin="round"/>` : ''}
        ${foodPath ? `<path d="${foodPath}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-linejoin="round"/>` : ''}
        ${barPath ? `<path d="${barPath}" fill="none" stroke="#C9A84C" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
        ${barS.map((v,i) => v!=null ? `<circle cx="${xs(i).toFixed(1)}" cy="${ys(v).toFixed(1)}" r="4" fill="#0A1520" stroke="#C9A84C" stroke-width="2"/>` : '').join('')}
        ${barLabels}
        ${xLabels}
      </svg>
    </div>`;
  }
};
