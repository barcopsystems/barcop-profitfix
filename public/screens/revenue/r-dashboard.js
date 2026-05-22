'use strict';
S.RevenueDashboard = {
  _dismissed: false,

  render(container, actions) {
    actions.innerHTML = '';
    const insBtn = document.createElement('button');
    insBtn.className = 'btn btn-ghost btn-sm';
    insBtn.id = 'r-insights-btn';
    insBtn.textContent = 'Trend Insights';
    insBtn.addEventListener('click', () => this.showInsights());
    actions.appendChild(insBtn);
    const rs     = App.data.revenue_settings || {};
    const t      = rs.targets || {};
    const weeks  = App.data.revenue_weeks || [];
    const validWeeks = weeks.filter(w => (w.bar_revenue||0) + (w.floor_revenue||0) > 0);
    const latest = validWeeks.length ? validWeeks[validWeeks.length - 1] : null;
    const prior4 = validWeeks.slice(-5, -1);
    const avg4   = fn => { const v = prior4.map(fn).filter(x => x != null && !isNaN(x)); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };

    const checkAvg   = latest?.check_avg ?? null;
    const laborPct   = latest?.labor_pct_blended ?? null;
    const rplh       = latest?.rplh_blended ?? null;
    const totalRev   = latest ? (latest.bar_revenue||0) + (latest.floor_revenue||0) : null;
    const covers     = latest?.covers ?? null;
    const targetCA   = t.check_avg ?? 35;
    const targetLP   = ((t.bar_labor_pct||28) + (t.kitchen_labor_pct||30) + (t.floor_labor_pct||32)) / 3;
    const targetRPLH = ((t.rplh_lunch||50) + (t.rplh_dinner||75) + (t.rplh_bar||65)) / 3;
    const weeklyGap  = checkAvg != null && covers != null ? (checkAvg - targetCA) * covers : null;

    // Alert
    let alertHtml = '';
    if (latest && !this._dismissed) {
      if (checkAvg != null && (targetCA - checkAvg) > 2) {
        const annualGap = (targetCA - checkAvg) * (covers||0) * 52;
        alertHtml = '<div class="alert-bar" id="r-alert"><div class="alert-text">Check average is ' + App.fmtCurrency(targetCA - checkAvg) + ' below target. That is ' + App.fmtCurrency(Math.abs(annualGap)) + ' in lost annual revenue at your current cover count.</div><button class="alert-dismiss" id="r-dismiss">Close</button></div>';
      } else if (laborPct != null && laborPct - targetLP > 2) {
        const wkOver = ((laborPct - targetLP) / 100) * (totalRev||0);
        alertHtml = '<div class="alert-bar" id="r-alert"><div class="alert-text">Labor is ' + (laborPct - targetLP).toFixed(1) + ' points over target this week. That is ' + App.fmtCurrency(wkOver) + ' over budget.</div><button class="alert-dismiss" id="r-dismiss">Close</button></div>';
      }
    }

    // Start Here card
    const targetsSet = rs._targets_saved || false;
    let startHere = '';
    if (!targetsSet) {
      startHere = '<div class="card" style="margin-bottom:18px;border:1px solid rgba(201,168,76,0.35);">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);margin-bottom:6px;">Start Here</div>'
        + '<div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:4px;">Set Your Revenue Targets</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-bottom:16px;">Numbers below are industry benchmarks. Adjust any target to match your operation. Click the info icon on each field to see what it means and when to change it.</div>'
        + '<div class="form-row" style="gap:12px 16px;margin-bottom:18px;flex-wrap:wrap;">'
        + '<div class="f" style="width:130px;min-width:120px;"><label>Check Average ' + tt('r-check-avg') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rsh-ca" value="' + targetCA + '" step="0.5"/></div></div>'
        + '<div class="f" style="width:130px;min-width:120px;"><label>Bar Labor % ' + tt('r-bar-labor') + '</label><div class="fw"><input class="suf" type="number" id="rsh-bl" value="' + (t.bar_labor_pct??28) + '" step="0.1"/><span class="suf">%</span></div></div>'
        + '<div class="f" style="width:130px;min-width:120px;"><label>Kitchen Labor % ' + tt('r-kitchen-labor') + '</label><div class="fw"><input class="suf" type="number" id="rsh-kl" value="' + (t.kitchen_labor_pct??30) + '" step="0.1"/><span class="suf">%</span></div></div>'
        + '<div class="f" style="width:130px;min-width:120px;"><label>Floor Labor % ' + tt('r-floor-labor') + '</label><div class="fw"><input class="suf" type="number" id="rsh-fl" value="' + (t.floor_labor_pct??32) + '" step="0.1"/><span class="suf">%</span></div></div>'
        + '<div class="f" style="width:130px;min-width:120px;"><label>Lunch RPLH ' + tt('r-lunch-rplh') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rsh-rl" value="' + (t.rplh_lunch??50) + '"/></div></div>'
        + '<div class="f" style="width:130px;min-width:120px;"><label>Dinner RPLH ' + tt('r-dinner-rplh') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rsh-rd" value="' + (t.rplh_dinner??75) + '"/></div></div>'
        + '<div class="f" style="width:130px;min-width:120px;"><label>Bar RPLH ' + tt('r-bar-rplh') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rsh-rb" value="' + (t.rplh_bar??65) + '"/></div></div>'
        + '<div class="f" style="width:130px;min-width:120px;"><label>Event Close Rate ' + tt('r-event-close') + '</label><div class="fw"><input class="suf" type="number" id="rsh-ec" value="' + (t.event_close_rate??40) + '" step="1"/><span class="suf">%</span></div></div>'
        + '</div>'
        + '<button class="btn btn-primary" id="rsh-save">Save and Continue</button>'
        + '</div>';
    }

    // Metric cards
    const trendHtml = (cur, avg, lowerBetter=false) => {
      if (avg==null||cur==null) return '<div class="metric-trend"> </div>';
      const diff = cur - avg;
      if (Math.abs(diff) < 0.15) return '<div class="metric-trend">→ flat</div>';
      const improving = lowerBetter ? diff < 0 : diff > 0;
      return '<div class="metric-trend ' + (improving?'trend-up':'trend-dn') + '">' + (diff>0?'↑':'↓') + ' vs 4wk avg</div>';
    };

    const metCard = (label, val, target, impact, trendEl, cls) => {
      const impHtml = impact != null
        ? '<div class="metric-impact ' + (impact > 0 ? 'neg' : 'pos') + '">' + (impact > 0 ? '+' : '') + App.fmtCurrency(impact) + ' vs target</div>'
        : '<div class="metric-impact" style="color:var(--t4);">&mdash;</div>';
      const valHtml = val != null
        ? '<div class="metric-val ' + cls + '">' + val + '</div>'
        : '<div class="metric-val" style="color:var(--t4);font-size:22px;">No data</div>';
      return '<div class="metric-card"><div class="metric-label">' + label + '</div>'
        + valHtml
        + '<div class="metric-target">Target: ' + target + '</div>'
        + impHtml + trendEl + '</div>';
    };

    const caCls   = checkAvg==null?'':checkAvg>=targetCA?'on-target':'over-target';
    const labCls  = laborPct==null?'':laborPct>targetLP?'over-target':'on-target';
    const rplhCls = rplh==null?'':rplh>=targetRPLH?'on-target':'over-target';
    const gapCls  = weeklyGap==null?'':weeklyGap>=0?'on-target':'over-target';

    const caImpact   = checkAvg!=null&&covers!=null ? (checkAvg-targetCA)*covers : null;
    const labImpact  = laborPct!=null&&totalRev!=null ? ((laborPct-targetLP)/100)*totalRev : null;
    const rplhImpact = rplh!=null&&latest?.total_hours ? (rplh-targetRPLH)*latest.total_hours : null;

    // Summary table
    const prev = weeks.length > 1 ? weeks[weeks.length-2] : null;
    let summaryHtml = '';
    if (latest) {
      const row = (label, tw, lw, av) => '<tr><td>' + label + '</td><td class="val">' + (tw||' ') + '</td><td>' + (lw||' ') + '</td><td>' + (av||' ') + '</td></tr>';
      const f = App.fmtCurrency, p = App.fmtPct;
      const a4 = fn => avg4(fn);
      summaryHtml = '<div class="tbl-wrap" style="margin-bottom:18px;"><table class="sum-tbl">'
        + '<thead><tr><th></th><th>This Week</th><th>Last Week</th><th>4-Week Avg</th></tr></thead><tbody>'
        + row('Bar Revenue',      f(latest.bar_revenue),    prev?f(prev.bar_revenue):' ',    a4(w=>w.bar_revenue)?f(a4(w=>w.bar_revenue)):' ')
        + row('Floor Revenue',    f(latest.floor_revenue),  prev?f(prev.floor_revenue):' ',  a4(w=>w.floor_revenue)?f(a4(w=>w.floor_revenue)):' ')
        + row('Covers',           latest.covers,            prev?.covers??' ',               a4(w=>w.covers)?Math.round(a4(w=>w.covers)):' ')
        + row('Check Average',    checkAvg?f(checkAvg):' ', prev?.check_avg?f(prev.check_avg):' ', a4(w=>w.check_avg)?f(a4(w=>w.check_avg)):' ')
        + row('Labor Cost',       f(latest.total_labor_cost), prev?f(prev.total_labor_cost):' ', a4(w=>w.total_labor_cost)?f(a4(w=>w.total_labor_cost)):' ')
        + row('Labor %',          laborPct?p(laborPct):' ', prev?.labor_pct_blended?p(prev.labor_pct_blended):' ', a4(w=>w.labor_pct_blended)?p(a4(w=>w.labor_pct_blended)):' ')
        + row('RPLH',             rplh?f(rplh):' ',         prev?.rplh_blended?f(prev.rplh_blended):' ', a4(w=>w.rplh_blended)?f(a4(w=>w.rplh_blended)):' ')
        + '</tbody></table></div>';
    } else {
      summaryHtml = '<div class="card"><div class="empty"><div class="empty-title">No weeks saved yet</div><div class="empty-sub">Enter your first week to see your numbers here.</div></div></div>';
    }

    container.innerHTML = '<div class="screen">'
      + startHere
      + alertHtml
      + '<div class="metric-grid">'
      + metCard('Check Average',    checkAvg!=null?App.fmtCurrency(checkAvg):null, App.fmtCurrency(targetCA), caImpact,   trendHtml(checkAvg,avg4(w=>w.check_avg)), caCls)
      + metCard('Labor Cost %',     laborPct!=null?App.fmtPct(laborPct):null,       App.fmtPct(targetLP),     labImpact,  trendHtml(laborPct,avg4(w=>w.labor_pct_blended),true), labCls)
      + metCard('RPLH',             rplh!=null?App.fmtCurrency(rplh):null,          App.fmtCurrency(targetRPLH), rplhImpact, trendHtml(rplh,avg4(w=>w.rplh_blended)), rplhCls)
      + metCard('Weekly Revenue Gap', weeklyGap!=null?App.fmtCurrency(Math.abs(weeklyGap)):null, '$0', weeklyGap!=null ? -weeklyGap : null, trendHtml(weeklyGap,avg4(w=>w.check_avg!=null&&w.covers?((w.check_avg-(t.check_avg||35))*w.covers):null)), gapCls)
      + '</div>'
      + this.buildChart(validWeeks.slice(-8), t)
      + '<div class="sh">This Week Summary</div>'
      + summaryHtml
      + FixPanel.recoveryCard('revenue')
      + FixPanel.fixAreasCard('revenue')
      + '<div class="sh">Quick Actions</div>'
      + '<div class="qa">'
      + '<button class="btn btn-primary" id="r-qa-week">Enter This Week</button>'
      + '<button class="btn btn-ghost" id="r-qa-server">Revenue Audit</button>'
      + '<button class="btn btn-ghost" id="r-qa-reports">View Reports</button>'
      + '</div>'
      + '</div>';

    document.getElementById('r-dismiss')?.addEventListener('click', () => { this._dismissed=true; document.getElementById('r-alert')?.remove(); });
    document.getElementById('r-qa-week')?.addEventListener('click', () => App.navigate('r-this-week'));
    document.getElementById('r-qa-server')?.addEventListener('click', () => App.navigate('r-audit'));
    document.getElementById('r-qa-reports')?.addEventListener('click', () => App.navigate('r-reports'));
    FixPanel.wireFixAreas(container);

    document.getElementById('rsh-save')?.addEventListener('click', async () => {
      const rs2 = App.data.revenue_settings;
      rs2.targets = {
        check_avg:          parseFloat(document.getElementById('rsh-ca')?.value)||35,
        bar_labor_pct:      parseFloat(document.getElementById('rsh-bl')?.value)||28,
        kitchen_labor_pct:  parseFloat(document.getElementById('rsh-kl')?.value)||30,
        floor_labor_pct:    parseFloat(document.getElementById('rsh-fl')?.value)||32,
        rplh_lunch:         parseFloat(document.getElementById('rsh-rl')?.value)||50,
        rplh_dinner:        parseFloat(document.getElementById('rsh-rd')?.value)||75,
        rplh_bar:           parseFloat(document.getElementById('rsh-rb')?.value)||65,
        event_close_rate:   parseFloat(document.getElementById('rsh-ec')?.value)||40,
      };
      rs2._targets_saved = true;
      const gs = App.data.getting_started_revenue||{};
      gs['rgs_targets'] = new Date().toISOString();
      App.data.getting_started_revenue = gs;
      await App.saveKey('revenue_settings');
      await App.saveKey('getting_started_revenue');
      App.navigate('r-getting-started');
    });
  },

  buildChart(weeks, t) {
    if (weeks.length < 2) return '<div class="chart-card" style="padding:24px 24px 20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:32px;">8-Week Trend</div>'
      + '<div style="text-align:center;padding:24px 0 8px;color:var(--t4);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Enter at least 2 weeks to see trend</div></div>';

    const W=800, H=220, PAD={t:28,r:60,b:40,l:48};
    const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;

    const caS   = weeks.map(w=>w.check_avg??null);
    const labS  = weeks.map(w=>w.labor_pct_blended??null);
    const rplhS = weeks.map(w=>w.rplh_blended??null);
    const allV  = [...caS,...labS,...rplhS].filter(v=>v!=null);
    if (!allV.length) return '';

    const minY = Math.max(0, Math.floor(Math.min(...allV)-4));
    const maxY = Math.ceil(Math.max(...allV)+6);
    const xs = i => PAD.l + (weeks.length>1 ? (i/(weeks.length-1))*cw : cw/2);
    const ys = v => PAD.t + ch - ((v-minY)/(maxY-minY))*ch;

    const smoothPath = pts => {
      const valid = pts.map((v,i)=>v!=null?{x:xs(i),y:ys(v)}:null).filter(Boolean);
      if (valid.length<2) return valid.length===1?'M'+valid[0].x+','+valid[0].y:'';
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

    const range=maxY-minY, tickStep=range<=12?2:range<=24?4:8;
    const ticks=[]; for(let v=Math.ceil(minY/tickStep)*tickStep;v<=maxY;v+=tickStep)ticks.push(v);
    const yTicks=ticks.map(v=>'<line x1="'+PAD.l+'" y1="'+ys(v).toFixed(1)+'" x2="'+(W-PAD.r)+'" y2="'+ys(v).toFixed(1)+'" stroke="rgba(255,255,255,0.06)" stroke-width="1"/><text x="'+(PAD.l-8)+'" y="'+(ys(v)+4).toFixed(1)+'" text-anchor="end" fill="rgba(255,255,255,0.25)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">'+v+'</text>').join('');
    const xLabels=weeks.map((w,i)=>'<text x="'+xs(i).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">'+(w.period_end?w.period_end.slice(5).replace('-','/'):'Wk'+w.week_num)+'</text>').join('');

    const caLabels=caS.map((v,i)=>{if(v==null)return '';const x=xs(i),y=ys(v);const above=y>PAD.t+16;return '<text x="'+x.toFixed(1)+'" y="'+(above?y-10:y+18).toFixed(1)+'" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="Barlow Condensed,sans-serif" font-size="11" font-weight="700">$'+v.toFixed(0)+'</text>';}).join('');

    const tCA  = t.check_avg||35;
    const uid  = 'rg'+Math.random().toString(36).slice(2,6);

    return '<div class="chart-card" style="padding:20px 24px 16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">8-Week Trend</div>'
      + '<div style="display:flex;gap:20px;">'
      + '<span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);"><span style="width:20px;height:2px;background:#C9A84C;display:inline-block;border-radius:1px;"></span>Check Avg</span>'
      + '<span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);"><span style="width:20px;height:2px;background:rgba(255,255,255,0.4);display:inline-block;border-radius:1px;"></span>Labor %</span>'
      + '<span style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);"><span style="width:20px;height:2px;background:rgba(255,255,255,0.2);display:inline-block;border-radius:1px;"></span>RPLH</span>'
      + '</div></div>'
      + '<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="display:block;overflow:visible;">'
      + '<defs><linearGradient id="caGrad'+uid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#C9A84C" stop-opacity="0.18"/><stop offset="100%" stop-color="#C9A84C" stop-opacity="0.01"/></linearGradient></defs>'
      + yTicks
      + '<line x1="'+PAD.l+'" y1="'+ys(tCA).toFixed(1)+'" x2="'+(W-PAD.r)+'" y2="'+ys(tCA).toFixed(1)+'" stroke="#C9A84C" stroke-width="1" stroke-dasharray="5,5" opacity="0.35"/>'
      + '<text x="'+(W-PAD.r+6)+'" y="'+(ys(tCA)+4).toFixed(1)+'" fill="rgba(201,168,76,0.55)" font-family="Barlow,sans-serif" font-size="9" font-weight="700">TGT</text>'
      + (areaPath(caS)?'<path d="'+areaPath(caS)+'" fill="url(#caGrad'+uid+')"/>':'')
      + '<path d="'+smoothPath(rplhS)+'" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="'+smoothPath(labS)+'" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="'+smoothPath(caS)+'" fill="none" stroke="#C9A84C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
      + caS.map((v,i)=>v!=null?'<circle cx="'+xs(i).toFixed(1)+'" cy="'+ys(v).toFixed(1)+'" r="4" fill="#0A1520" stroke="#C9A84C" stroke-width="2"/>':'').join('')
      + caLabels + xLabels
      + '</svg></div>';
  },

  showInsights() {
    const weeks = (App.data.revenue_weeks||[]).filter(w=>(w.bar_revenue||0)+(w.floor_revenue||0)>0).slice(-8);
    const showModal = (html) => {
      const m = document.createElement('div');
      m.className = 'ins-modal';
      m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;';
      const box = document.createElement('div');
      box.style.cssText = 'background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:580px;width:100%;max-height:80vh;overflow-y:auto;';
      box.innerHTML = html;
      m.appendChild(box);
      document.body.appendChild(m);
      m.onclick = ev => { if(ev.target===m) m.remove(); };
      box.querySelector('.ins-close')?.addEventListener('click', () => m.remove());
    };
    if (weeks.length < 2) {
      showModal('<div style="text-align:center;"><div style="font-size:13px;color:var(--t1);margin-bottom:16px;">Enter at least 2 weeks of data to generate trend insights.</div><button class="btn btn-ghost ins-close">OK</button></div>');
      return;
    }
    const btn = document.getElementById('r-insights-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Analyzing...'; }
    const t  = App.data.revenue_settings?.targets || {};
    const avg = arr => { const v = arr.filter(x=>x!=null); return v.length ? v.reduce((s,x)=>s+x,0)/v.length : 0; };
    const caT = t.check_avg || 35;
    const lpT = ((t.bar_labor_pct||28)+(t.kitchen_labor_pct||30)+(t.floor_labor_pct||32))/3;
    const caVals  = weeks.map(w=>w.check_avg).filter(v=>v!=null);
    const lpVals  = weeks.map(w=>w.labor_pct_blended).filter(v=>v!=null);
    const revVals = weeks.map(w=>(w.bar_revenue||0)+(w.floor_revenue||0));
    const covVals = weeks.map(w=>w.covers).filter(v=>v!=null);
    const aCA = avg(caVals).toFixed(2);
    const aLP = avg(lpVals).toFixed(1);
    const aRev = avg(revVals).toFixed(0);
    const aCov = avg(covVals).toFixed(0);
    const caTrend = caVals.length>=3 ? (caVals[caVals.length-1]-caVals[0]>1 ? 'trending up (improving)' : caVals[0]-caVals[caVals.length-1]>1 ? 'trending down (worsening)' : 'holding steady') : 'early data';
    const lines = [
      'Check Average: '+weeks.map(w=>w.check_avg?'$'+w.check_avg.toFixed(2):'n/a').join(', ')+' (target:$'+caT+' avg:$'+aCA+')',
      'Check average trend: '+caTrend,
      'Labor %: '+weeks.map(w=>w.labor_pct_blended?w.labor_pct_blended.toFixed(1)+'%':'n/a').join(', ')+' (target:'+lpT.toFixed(1)+'% avg:'+aLP+'%)',
      'Avg weekly revenue: $'+aRev,
      'Avg covers/week: '+aCov,
      'Weekly check avg gap vs target: $'+Math.abs((parseFloat(aCA)-caT)*parseFloat(aCov)).toFixed(0)+' '+(parseFloat(aCA)<caT?'below target':'above target'),
    ];
    const prompt = 'You are a 30-year bar and restaurant operator writing a brief analysis for a fellow owner. Write 3 short paragraphs, one insight each, based on the revenue and labor data below. Rules: no emdashes, no dashes used as punctuation, no bullet points, no headers, no AI language. Write the way an experienced operator talks to another operator. Plain sentences. Specific numbers. Direct about what needs to change and exactly what to do about it this week.\n\n'+lines.join('\n')+'\n\nLead with check average performance, then labor efficiency, then the single action that will move revenue most this week.';
    fetch('/api/claude', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({model:'claude-sonnet-4-5', max_tokens:600, messages:[{role:'user', content:prompt}]})})
    .then(r => { if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(data => {
      if (btn) { btn.disabled=false; btn.textContent='Trend Insights'; }
      if (data.error) { showModal('<div><div style="font-size:13px;color:var(--red);margin-bottom:16px;">API error: '+data.error.message+'</div><button class="btn btn-ghost ins-close">OK</button></div>'); return; }
      const text = data.content?.[0]?.text;
      if (!text) { showModal('<div><div style="font-size:13px;color:var(--red);margin-bottom:16px;">No response received. Try again.</div><button class="btn btn-ghost ins-close">OK</button></div>'); return; }
      const header = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;"><div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Trend Insights: Last '+weeks.length+' Weeks</div><button class="btn btn-ghost btn-sm ins-close">Close</button></div>';
      const body   = '<div style="font-size:13px;color:var(--t2);line-height:1.9;">'+text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n\n/g,'</div><div style="font-size:13px;color:var(--t2);line-height:1.9;margin-top:14px;">')+'</div>';
      showModal(header+body);
    }).catch(err => {
      if (btn) { btn.disabled=false; btn.textContent='Trend Insights'; }
      showModal('<div><div style="font-size:13px;color:var(--red);margin-bottom:16px;">Connection error: '+err.message+'. Check your connection and try again.</div><button class="btn btn-ghost ins-close">OK</button></div>');
    });
  }
};
