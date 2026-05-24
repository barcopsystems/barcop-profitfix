'use strict';
S.Dashboard = {
  _dismissed: false,
  render(container, actions) {
    // Add Trend Insights button to topbar actions
    actions.innerHTML = '';
    const insBtn = document.createElement('button');
    insBtn.className = 'btn btn-ghost btn-sm';
    insBtn.id = 'db-insights-btn';
    insBtn.textContent = 'Trend Insights';
    insBtn.addEventListener('click', () => this.showInsights());
    actions.appendChild(insBtn);
    const data = App.data;
    const weeks = data.weeks || [];
    const targets = data.settings.targets || {};
    const latest = weeks.length > 0 ? weeks[weeks.length-1] : null;

    const barPct    = latest?.bar?.cost_pct ?? null;
    const barTarget = targets.bar_pour_cost_pct ?? 22;
    const barRev    = latest?.bar?.revenue ?? 0;

    // Alert
    let alertHtml = '';
    if (latest && !this._dismissed) {
      const diff = barPct != null ? barPct - barTarget : 0;
      if (diff > 2) {
        const wkImpact = (diff/100)*barRev;
        alertHtml = '<div class="alert-bar" id="db-alert">'
          +'<div class="alert-text">Pour cost is '+diff.toFixed(1)+' points above target. '
          +App.fmtCurrency(wkImpact)+' this week, '+App.fmtCurrency(wkImpact*52)+' annualized.</div>'
          +'<button class="alert-dismiss" id="db-dismiss">Close</button>'
          +'</div>';
      }
    }

    // Flagged recipes
    const flagged = (data.recipes||[]).filter(r=>r.flagged).length;

    // Chart — annotated 8-week trend
    const chartHtml = this.buildChart(weeks.slice(-8), targets);

    // Priority Action Items — ranked by dollar impact from the latest Profit audit
    const audits = data.audits || [];
    const latestAudit = audits.length ? audits[audits.length-1] : null;
    const actionItems = (latestAudit?.action_items || [])
      .filter(it => it && it.action)
      .slice()
      .sort((a,b) => (b.monthly_impact||0) - (a.monthly_impact||0))
      .slice(0,5);

    const actionRows = actionItems.length
      ? actionItems.map((it,i) =>
          '<div class="db-action" data-screen="audit-tracker" '
          + 'style="display:flex;align-items:center;gap:12px;padding:13px 20px;cursor:pointer;'
          + (i < actionItems.length-1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
          + '<div style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--gold-bg);'
          + 'color:var(--gold);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;">'+(i+1)+'</div>'
          + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t1);line-height:1.5;">'+esc(it.action)+'</div>'
          + (it.monthly_impact > 0
              ? '<div style="flex-shrink:0;font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:600;color:var(--gold);">'
                + App.fmtCurrency(it.monthly_impact,0) + '<span style="font-size:9px;"> /mo</span></div>'
              : '')
          + '<span style="flex-shrink:0;font-size:13px;color:var(--t3);">&#9656;</span>'
          + '</div>').join('')
      : '<div style="padding:18px 20px;font-size:12px;color:var(--t3);line-height:1.65;">'
        + 'Run a Profit Audit and your highest-impact opportunities will be ranked here by dollar impact.</div>';
    const actionHtml = '<div class="card" style="padding:0;overflow:hidden;margin-bottom:18px;">'
      + FixPanel.sectionHeader('Priority Action Items')
      + actionRows
      + '</div>';

    // Setup pointer — a thin one-line nudge to the Hub Getting Started while
    // targets are unset. Settings live on the Hub, never on the dashboard.
    let startHereHtml = '';
    if (!App.data.settings._targets_saved) {
      startHereHtml = '<div class="card db-gs-pointer" style="margin-bottom:18px;display:flex;align-items:center;gap:12px;cursor:pointer;border:1px solid rgba(219,171,70,0.35);">'
        + '<div style="flex-shrink:0;font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">Setup</div>'
        + '<div style="flex:1;font-size:12px;color:var(--t2);line-height:1.5;">Your Profit targets are not set yet. Finish setup in Getting Started so your scores and dollar figures are accurate.</div>'
        + '<span style="flex-shrink:0;font-size:13px;color:var(--t3);">&#9656;</span>'
        + '</div>';
    }

    container.innerHTML = '<div class="screen">'
      + FixPanel.recoveryCard('profit')
      + startHereHtml
      + alertHtml
      + chartHtml
      + actionHtml
      + '<div class="card" style="padding:0;overflow:hidden;margin-bottom:18px;">'
      + FixPanel.sectionHeader('Quick Actions')
      + '<div class="qa" style="padding:18px 20px;">'
      +'<button class="btn btn-primary" id="qa-week">Enter This Week</button>'
      +'<button class="btn btn-ghost" id="qa-shift">Profit Audit</button>'
      +'<button class="btn btn-ghost" id="qa-reports">View Reports</button>'
      +(flagged>0?'<button class="btn btn-danger" id="qa-recipes">'+flagged+' Recipe'+(flagged>1?'s':'')+' Above Target</button>':'')
      +'</div>'
      +'</div>'
      +'</div>';

    document.getElementById('db-dismiss')?.addEventListener('click', () => {
      this._dismissed = true;
      document.getElementById('db-alert')?.remove();
    });

    container.querySelector('.db-gs-pointer')?.addEventListener('click', () => App.navigate('getting-started'));
    document.getElementById('qa-week')?.addEventListener('click', ()=>App.navigate('this-week'));
    document.getElementById('qa-shift')?.addEventListener('click', ()=>App.navigate('audit-tracker'));
    document.getElementById('qa-reports')?.addEventListener('click', ()=>App.navigate('reports'));
    document.getElementById('qa-recipes')?.addEventListener('click', ()=>App.navigate('recipe-library'));
    container.querySelectorAll('.db-action').forEach(row => {
      row.addEventListener('click', () => App.navigate(row.dataset.screen));
    });
    FixPanel.wireFixAreas(container);
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

    const fixMarkers = (window.Recovery && window.FixPanel)
      ? FixPanel.markerSvg(Recovery.chartMarkers(weeks, 'profit'), xs, PAD.t, PAD.t + ch) : '';

    return `<div class="chart-card" style="padding:20px 24px 16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">8-Week Trend</div>
        <div style="display:flex;gap:20px;">
          <span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);">
            <span style="width:20px;height:2px;background:#DBAB46;display:inline-block;border-radius:1px;"></span>Bar Pour Cost</span>
          <span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);">
            <span style="width:20px;height:2px;background:rgba(255,255,255,0.4);display:inline-block;border-radius:1px;"></span>Food Cost</span>
          <span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);">
            <span style="width:20px;height:2px;background:rgba(255,255,255,0.2);display:inline-block;border-radius:1px;"></span>Prime Cost</span>
        </div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible;">
        <defs>
          <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#DBAB46" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#DBAB46" stop-opacity="0.01"/>
          </linearGradient>
        </defs>
        ${ticks.map(v=>`
          <line x1="${PAD.l}" y1="${ys(v).toFixed(1)}" x2="${W-PAD.r}" y2="${ys(v).toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
          <text x="${PAD.l-8}" y="${(ys(v)+4).toFixed(1)}" text-anchor="end" fill="rgba(255,255,255,0.25)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">${v}%</text>
        `).join('')}
        <line x1="${PAD.l}" y1="${tPx.toFixed(1)}" x2="${W-PAD.r}" y2="${tPx.toFixed(1)}" stroke="#DBAB46" stroke-width="1" stroke-dasharray="5,5" opacity="0.35"/>
        <text x="${W-PAD.r+6}" y="${(tPx+4).toFixed(1)}" fill="rgba(219,171,70,0.55)" font-family="Barlow,sans-serif" font-size="9" font-weight="700">TGT</text>
        ${fixMarkers}
        ${barArea ? `<path d="${barArea}" fill="url(#${uid})"/>` : ''}
        ${priPath ? `<path d="${priPath}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" stroke-linejoin="round"/>` : ''}
        ${foodPath ? `<path d="${foodPath}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-linejoin="round"/>` : ''}
        ${barPath ? `<path d="${barPath}" fill="none" stroke="#DBAB46" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
        ${barS.map((v,i) => v!=null ? `<circle cx="${xs(i).toFixed(1)}" cy="${ys(v).toFixed(1)}" r="4" fill="#0A1520" stroke="#DBAB46" stroke-width="2"/>` : '').join('')}
        ${barLabels}
        ${xLabels}
      </svg>
    </div>`;
  },

  showInsights() {
    if (App.demoBlock('AI Trend Insights')) return;
    const weeks=(App.data.weeks||[]).slice(-8);
    const showModal=(html)=>{
      const m=document.createElement('div');
      m.className='ins-modal';
      m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;';
      const box=document.createElement('div');
      box.style.cssText='background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:580px;width:100%;max-height:80vh;overflow-y:auto;';
      box.innerHTML=html;
      m.appendChild(box);
      document.body.appendChild(m);
      m.onclick=ev=>{if(ev.target===m)m.remove();};
      box.querySelector('.ins-close')?.addEventListener('click',()=>m.remove());
    };
    if(weeks.length<2){
      showModal('<div style="text-align:center;"><div style="font-size:13px;color:var(--t1);margin-bottom:16px;">Enter at least 2 weeks of data to generate trend insights.</div><button class="btn btn-ghost ins-close">OK</button></div>');
      return;
    }
    const btn=document.getElementById('db-insights-btn');
    if(btn){btn.disabled=true;btn.textContent='Analyzing...';}
    const t=App.data.settings.targets||{};
    const bT=t.bar_pour_cost_pct||22,fT=t.food_cost_pct||32,pT=t.prime_cost_pct||60;
    const avg=arr=>{const v=arr.filter(x=>x!=null);return v.length?v.reduce((s,x)=>s+x,0)/v.length:0;};
    const bP=weeks.map(w=>w.bar?.cost_pct).filter(v=>v!=null);
    const fP=weeks.map(w=>w.food?.cost_pct).filter(v=>v!=null);
    const pP=weeks.map(w=>w.prime_cost_pct).filter(v=>v!=null);
    const bR=weeks.map(w=>w.bar?.revenue).filter(v=>v!=null);
    const aB=avg(bP).toFixed(1),aF=avg(fP).toFixed(1),aP=avg(pP).toFixed(1),aR=avg(bR);
    const gap=((parseFloat(aB)-bT)/100*aR).toFixed(0);
    const trend=bP.length>=3?(bP[bP.length-1]-bP[0]>1?'trending higher (worsening)':bP[0]-bP[bP.length-1]>1?'trending lower (improving)':'holding steady'):'early data';
    const lines=['Bar Pour Cost %: '+weeks.map(w=>(w.bar?.cost_pct||0).toFixed(1)+'%').join(', ')+' (target:'+bT+'% avg:'+aB+'%)','Food Cost %: '+weeks.map(w=>(w.food?.cost_pct||0).toFixed(1)+'%').join(', ')+' (target:'+fT+'% avg:'+aF+'%)','Prime Cost %: '+weeks.map(w=>(w.prime_cost_pct||0).toFixed(1)+'%').join(', ')+' (target:'+pT+'% avg:'+aP+'%)','Bar Revenue: '+weeks.map(w=>'$'+Math.round(w.bar?.revenue||0)).join(', '),'Weekly gap vs bar target: $'+Math.abs(gap)+' '+(parseFloat(gap)>0?'over':'under'),'Pour cost trend: '+trend];
    const prompt='You are a 30-year bar and restaurant operator writing a brief analysis for a fellow owner. Write 3 short paragraphs, one insight each, based on the data below. Rules: no emdashes, no dashes used as punctuation, no bullet points, no headers, no AI language. Write the way an experienced operator talks to another operator. Plain sentences. Specific numbers. Direct about what needs to change and exactly what to do about it this week.\n\n'+lines.join('\n')+'\n\nLead with the most urgent cost issue, then revenue trend, then the single action that will matter most this week.';
    fetch('/api/claude',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-5',max_tokens:600,messages:[{role:'user',content:prompt}]})})
    .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(data=>{
      if(btn){btn.disabled=false;btn.textContent='Trend Insights';}
      if(data.error){showModal('<div><div style="font-size:13px;color:var(--red);margin-bottom:16px;">API error: '+data.error.message+'</div><button class="btn btn-ghost ins-close">OK</button></div>');return;}
      const text=data.content?.[0]?.text;
      if(!text){showModal('<div><div style="font-size:13px;color:var(--red);margin-bottom:16px;">No response received. Try again.</div><button class="btn btn-ghost ins-close">OK</button></div>');return;}
      const header='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;"><div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Trend Insights: Last '+weeks.length+' Weeks</div><button class="btn btn-ghost btn-sm ins-close">Close</button></div>';
      const body='<div style="font-size:13px;color:var(--t2);line-height:1.9;">'+text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n\n/g,'</div><div style="font-size:13px;color:var(--t2);line-height:1.9;margin-top:14px;">')+'</div>';
      showModal(header+body);
    }).catch(err=>{
      if(btn){btn.disabled=false;btn.textContent='Trend Insights';}
      showModal('<div><div style="font-size:13px;color:var(--red);margin-bottom:16px;">Connection error: '+err.message+'. Check your connection and try again.</div><button class="btn btn-ghost ins-close">OK</button></div>');
    });
  }
};
