'use strict';
S.RevenueDashboard = {
  render(container, actions) {
    actions.innerHTML = '';
    const rs  = App.data.revenue_settings || {};
    const t   = rs.targets || {};
    const weeks = App.data.revenue_weeks || [];
    const latest = weeks.length ? weeks[weeks.length - 1] : null;
    const prior4 = weeks.slice(-5, -1);
    const avg4 = fn => { const v = prior4.map(fn).filter(x => x != null && !isNaN(x)); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };

    const checkAvg   = latest?.check_avg ?? null;
    const laborPct   = latest?.labor_pct_blended ?? null;
    const rplh       = latest?.rplh_blended ?? null;
    const totalRev   = latest ? ((latest.bar_revenue || 0) + (latest.floor_revenue || 0)) : null;
    const targetCA   = t.check_avg ?? 35;
    const targetLP   = ((t.bar_labor_pct || 28) + (t.kitchen_labor_pct || 30) + (t.floor_labor_pct || 32)) / 3;
    const targetRPLH = ((t.rplh_lunch || 50) + (t.rplh_dinner || 75) + (t.rplh_bar || 65)) / 3;
    const covers     = latest?.covers ?? null;
    const weeklyGap  = checkAvg != null && covers != null ? (checkAvg - targetCA) * covers : null;

    // Alert
    let alertHtml = '';
    if (latest) {
      if (checkAvg != null && (targetCA - checkAvg) > 2) {
        const annualGap = (targetCA - checkAvg) * (covers || 0) * 52;
        alertHtml = `<div class="alert-bar" id="r-alert"><div class="alert-text">Check average is down $${(targetCA - checkAvg).toFixed(2)} from target. That is ${App.fmtCurrency(annualGap)} in lost annual revenue at your current cover count.</div><button class="alert-dismiss" id="r-dismiss">Close</button></div>`;
      } else if (laborPct != null && laborPct - targetLP > 2) {
        const wkOver = ((laborPct - targetLP) / 100) * (totalRev || 0);
        alertHtml = `<div class="alert-bar" id="r-alert"><div class="alert-text">Labor is ${(laborPct - targetLP).toFixed(1)} points over target this week. That is ${App.fmtCurrency(wkOver)} over budget.</div><button class="alert-dismiss" id="r-dismiss">Close</button></div>`;
      }
    }

    const targetsSet = rs._targets_saved || false;
    let startHere = '';
    if (!targetsSet) {
      startHere = `<div class="card" style="margin-bottom:18px;border:1px solid rgba(201,168,76,0.35);">
        <div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);margin-bottom:6px;">Start Here</div>
        <div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:4px;">Set Your Revenue Targets</div>
        <div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:18px;">Industry benchmarks are already filled in. Adjust them to match your operation and hit Save.</div>
        <div class="form-row" style="gap:14px 20px;margin-bottom:18px;">
          <div class="f" style="width:140px;"><label>Check Average Target</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rsh-ca" value="${targetCA}" step="0.5"/></div></div>
          <div class="f" style="width:120px;"><label>Bar Labor %</label><div class="fw"><input class="suf" type="number" id="rsh-bl" value="${t.bar_labor_pct ?? 28}" step="0.1"/><span class="suf">%</span></div></div>
          <div class="f" style="width:120px;"><label>Kitchen Labor %</label><div class="fw"><input class="suf" type="number" id="rsh-kl" value="${t.kitchen_labor_pct ?? 30}" step="0.1"/><span class="suf">%</span></div></div>
          <div class="f" style="width:120px;"><label>Floor Labor %</label><div class="fw"><input class="suf" type="number" id="rsh-fl" value="${t.floor_labor_pct ?? 32}" step="0.1"/><span class="suf">%</span></div></div>
          <div class="f" style="width:120px;"><label>Lunch RPLH</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rsh-rl" value="${t.rplh_lunch ?? 50}"/></div></div>
          <div class="f" style="width:120px;"><label>Dinner RPLH</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rsh-rd" value="${t.rplh_dinner ?? 75}"/></div></div>
          <div class="f" style="width:120px;"><label>Bar RPLH</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rsh-rb" value="${t.rplh_bar ?? 65}"/></div></div>
        </div>
        <button class="btn btn-primary" id="rsh-save">Save and Continue</button>
      </div>`;
    }

    const fmtTrend = (cur, avg, lowerBetter=false) => {
      if (avg == null || cur == null) return '<div class="metric-trend">—</div>';
      const diff = cur - avg;
      if (Math.abs(diff) < 0.15) return '<div class="metric-trend">flat</div>';
      const improving = lowerBetter ? diff < 0 : diff > 0;
      return `<div class="metric-trend ${improving?'trend-up':'trend-dn'}">${diff>0?'↑':'↓'} vs 4wk avg</div>`;
    };

    const metCard = (label, val, target, imp, trend, cls) => {
      const impHtml = imp != null
        ? `<div class="metric-impact ${imp>0?'neg':'pos'}">${imp>0?'+':''}${App.fmtCurrency(imp)} vs target</div>`
        : '<div class="metric-impact" style="color:var(--t4);">—</div>';
      return `<div class="metric-card"><div class="metric-label">${label}</div><div class="metric-val ${cls}">${val||'—'}</div><div class="metric-target">Target: ${target}</div>${impHtml}${trend}</div>`;
    };

    const caCls   = checkAvg == null ? '' : checkAvg >= targetCA ? 'on-target' : 'over-target';
    const labCls  = laborPct == null ? '' : laborPct > targetLP ? 'over-target' : 'on-target';
    const rplhCls = rplh == null ? '' : rplh >= targetRPLH ? 'on-target' : 'over-target';
    const gapCls  = weeklyGap == null ? '' : weeklyGap >= 0 ? 'on-target' : 'over-target';

    const chartHtml = this.buildChart(weeks.slice(-8), t);

    // Summary table
    const prev = weeks.length > 1 ? weeks[weeks.length - 2] : null;
    let summaryHtml = '';
    if (latest) {
      const row = (label, cur, prv, avg) => `<tr><td>${label}</td><td class="val">${cur??'—'}</td><td>${prv??'—'}</td><td>${avg??'—'}</td></tr>`;
      summaryHtml = `<div class="tbl-wrap" style="margin-bottom:18px;"><table class="sum-tbl">
        <thead><tr><th></th><th>This Week</th><th>Last Week</th><th>4-Week Avg</th></tr></thead>
        <tbody>
          ${row('Bar Revenue', App.fmtCurrency(latest.bar_revenue), prev?App.fmtCurrency(prev.bar_revenue):'—', avg4(w=>w.bar_revenue)!=null?App.fmtCurrency(avg4(w=>w.bar_revenue)):'—')}
          ${row('Floor Revenue', App.fmtCurrency(latest.floor_revenue), prev?App.fmtCurrency(prev.floor_revenue):'—', avg4(w=>w.floor_revenue)!=null?App.fmtCurrency(avg4(w=>w.floor_revenue)):'—')}
          ${row('Covers', latest.covers, prev?.covers??'—', avg4(w=>w.covers)!=null?Math.round(avg4(w=>w.covers)):'—')}
          ${row('Check Average', App.fmtCurrency(checkAvg), prev?App.fmtCurrency(prev.check_avg):'—', avg4(w=>w.check_avg)!=null?App.fmtCurrency(avg4(w=>w.check_avg)):'—')}
          ${row('Labor Cost %', App.fmtPct(laborPct), prev?App.fmtPct(prev.labor_pct_blended):'—', avg4(w=>w.labor_pct_blended)!=null?App.fmtPct(avg4(w=>w.labor_pct_blended)):'—')}
          ${row('RPLH', App.fmtCurrency(rplh), prev?App.fmtCurrency(prev.rplh_blended):'—', avg4(w=>w.rplh_blended)!=null?App.fmtCurrency(avg4(w=>w.rplh_blended)):'—')}
        </tbody></table></div>`;
    } else {
      summaryHtml = '<div class="card"><div class="empty"><div class="empty-title">No weeks saved yet</div><div class="empty-sub">Enter your first week to see your numbers here.</div></div></div>';
    }

    container.innerHTML = `<div class="screen">
      ${startHere}
      ${alertHtml}
      <div class="metric-grid">
        ${metCard('Check Average', checkAvg!=null?App.fmtCurrency(checkAvg):null, App.fmtCurrency(targetCA), checkAvg!=null?(checkAvg-targetCA)*( covers||0):null, fmtTrend(checkAvg, avg4(w=>w.check_avg)), caCls)}
        ${metCard('Labor Cost %', laborPct!=null?App.fmtPct(laborPct):null, App.fmtPct(targetLP), laborPct!=null?((laborPct-targetLP)/100)*(totalRev||0):null, fmtTrend(laborPct, avg4(w=>w.labor_pct_blended), true), labCls)}
        ${metCard('RPLH', rplh!=null?App.fmtCurrency(rplh):null, App.fmtCurrency(targetRPLH), rplh!=null?(rplh-targetRPLH)*(latest?.total_hours||0):null, fmtTrend(rplh, avg4(w=>w.rplh_blended)), rplhCls)}
        <div class="metric-card"><div class="metric-label">Weekly Revenue Gap</div><div class="metric-val ${gapCls}">${weeklyGap!=null?App.fmtCurrency(weeklyGap):'—'}</div><div class="metric-target">vs check avg target</div><div class="metric-impact" style="color:var(--t4);">vs target covers</div>${fmtTrend(weeklyGap, avg4(w=>w.check_avg!=null&&w.covers!=null?(w.check_avg-targetCA)*w.covers:null))}</div>
      </div>
      ${chartHtml}
      <div class="sh">This Week Summary</div>
      ${summaryHtml}
      <div class="sh">Quick Actions</div>
      <div class="qa">
        <button class="btn btn-primary" id="r-qa-week">Enter This Week</button>
        <button class="btn btn-ghost" id="r-qa-server">Run Server Check</button>
        <button class="btn btn-ghost" id="r-qa-reports">View Reports</button>
      </div>
    </div>`;

    document.getElementById('r-dismiss')?.addEventListener('click', () => document.getElementById('r-alert')?.remove());
    document.getElementById('r-qa-week')?.addEventListener('click', () => App.navigate('r-this-week'));
    document.getElementById('r-qa-server')?.addEventListener('click', () => App.navigate('r-server-check'));
    document.getElementById('r-qa-reports')?.addEventListener('click', () => App.navigate('r-reports'));

    document.getElementById('rsh-save')?.addEventListener('click', async () => {
      const rs2 = App.data.revenue_settings;
      rs2.targets = {
        check_avg:          parseFloat(document.getElementById('rsh-ca')?.value) || 35,
        bar_labor_pct:      parseFloat(document.getElementById('rsh-bl')?.value) || 28,
        kitchen_labor_pct:  parseFloat(document.getElementById('rsh-kl')?.value) || 30,
        floor_labor_pct:    parseFloat(document.getElementById('rsh-fl')?.value) || 32,
        rplh_lunch:         parseFloat(document.getElementById('rsh-rl')?.value) || 50,
        rplh_dinner:        parseFloat(document.getElementById('rsh-rd')?.value) || 75,
        rplh_bar:           parseFloat(document.getElementById('rsh-rb')?.value) || 65,
        event_close_rate:   rs2.targets?.event_close_rate || 40,
      };
      rs2._targets_saved = true;
      const gs = App.data.getting_started_revenue || {};
      gs['rgs_targets'] = new Date().toISOString();
      App.data.getting_started_revenue = gs;
      await App.saveKey('revenue_settings');
      await App.saveKey('getting_started_revenue');
      App.navigate('r-getting-started');
    });
  },

  buildChart(weeks, t) {
    if (weeks.length < 2) return `<div class="chart-card" style="padding:24px 24px 20px;"><div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:32px;">8-Week Trend</div><div style="text-align:center;padding:24px 0 8px;color:var(--t4);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Enter at least 2 weeks to see trend</div></div>`;
    const W=800, H=220, PAD={t:28,r:60,b:40,l:48};
    const cw=W-PAD.l-PAD.r, ch=H-PAD.t-PAD.b;
    const caS  = weeks.map(w=>w.check_avg??null);
    const labS = weeks.map(w=>w.labor_pct_blended??null);
    const allV = [...caS,...labS].filter(v=>v!=null);
    if (!allV.length) return '';
    const minY = Math.max(0, Math.floor(Math.min(...allV)-4));
    const maxY = Math.ceil(Math.max(...allV)+6);
    const xp = i => PAD.l + (i/(weeks.length-1))*cw;
    const yp = v => PAD.t + (1-(v-minY)/(maxY-minY))*ch;
    const line = (pts, col) => { const s=pts.filter((p,i)=>p!=null&&weeks[i]); if(s.length<2) return ''; const d=pts.map((v,i)=>v==null?null:`${xp(i).toFixed(1)},${yp(v).toFixed(1)}`).filter(Boolean); return `<polyline points="${d.join(' ')}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`; };
    const tCA  = t.check_avg || 35;
    const tLP  = ((t.bar_labor_pct||28)+(t.kitchen_labor_pct||30)+(t.floor_labor_pct||32))/3;
    const yCA  = yp(tCA), yLP = yp(tLP);
    const labels = weeks.map((w,i) => `<text x="${xp(i).toFixed(1)}" y="${H-PAD.b+18}" text-anchor="middle" fill="var(--t4)" font-size="9">W${w.week_num||i+1}</text>`);
    const yTicks = [minY, Math.round((minY+maxY)/2), maxY].map(v => `<line x1="${PAD.l}" y1="${yp(v).toFixed(1)}" x2="${W-PAD.r}" y2="${yp(v).toFixed(1)}" stroke="rgba(255,255,255,0.04)"/><text x="${PAD.l-6}" y="${(yp(v)+4).toFixed(1)}" text-anchor="end" fill="var(--t4)" font-size="9">${v}</text>`);
    return `<div class="chart-card"><div style="display:flex;align-items:center;gap:18px;margin-bottom:16px;flex-wrap:wrap;">
      <div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">8-Week Trend</div>
      <div style="display:flex;gap:14px;margin-left:auto;">
        <span style="font-size:10px;color:var(--gold);">— Check Average</span>
        <span style="font-size:10px;color:var(--w);">— Labor %</span>
      </div></div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;" preserveAspectRatio="none">
        ${yTicks.join('')}
        <line x1="${PAD.l}" y1="${yCA.toFixed(1)}" x2="${W-PAD.r}" y2="${yCA.toFixed(1)}" stroke="rgba(201,168,76,0.25)" stroke-width="1" stroke-dasharray="4,4"/>
        <line x1="${PAD.l}" y1="${yLP.toFixed(1)}" x2="${W-PAD.r}" y2="${yLP.toFixed(1)}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="4,4"/>
        ${line(caS, '#C9A84C')}${line(labS, 'rgba(255,255,255,0.7)')}
        ${labels.join('')}
      </svg></div>`;
  }
};
