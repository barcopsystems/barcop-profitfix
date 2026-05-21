'use strict';

S.Hub = {

  AUDIT_STALE: 35,
  WEEKLY_CUTOFF: 8,

  render(container) {
    container.style.overflowY = 'hidden';
    const data = App.data || {};

    // ── Data sources ──
    const s   = data.settings || {};
    const pt  = s.targets || {};
    const rt  = (data.revenue_settings || {}).targets || {};
    const tTar= (data.traffic_settings || {}).targets || {};

    const pWeeks  = data.weeks || [];
    const rWeeks  = (data.revenue_weeks || []).filter(w => (w.bar_revenue||0)+(w.floor_revenue||0) > 0);
    const tWeeks  = data.traffic_weeks || [];
    const pAudits = data.audits || [];
    const rAudits = data.revenue_audits || [];
    const tAudits = data.traffic_audits || [];
    const recs    = data.reconciliations || [];

    const barName = s.bar_name || 'Your Operation';

    const last  = a => a.length ? a[a.length-1] : null;
    const prior = a => a.length >= 2 ? a[a.length-2] : null;
    const pW = last(pWeeks), rW = last(rWeeks), tW = last(tWeeks);
    const pA = last(pAudits), rA = last(rAudits), tA = last(tAudits);

    // ── Helpers ──
    const daysSince = (str) => {
      if (!str) return null;
      const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
      if (isNaN(d.getTime())) return null;
      return Math.floor((Date.now() - d.getTime()) / 86400000);
    };
    const auditOpp  = (a) => a ? (a.action_items || []).reduce((sum,x) => sum + (x.monthly_impact || 0), 0) : 0;
    const sysTrend  = (au) => { const l = last(au), p = prior(au); return (l && p) ? (l.overall_score||0) - (p.overall_score||0) : null; };
    const shortDate = (str) => str ? new Date(String(str).length<=10 ? str+'T00:00:00' : str).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : null;

    // ── Cross-system rollup ──
    const sysScores = [pA, rA, tA].map(a => a ? a.overall_score : null).filter(v => v != null);
    const overall   = sysScores.length ? Math.round(sysScores.reduce((a,b)=>a+b,0)/sysScores.length) : null;
    const anyAudit  = !!(pAudits.length || rAudits.length || tAudits.length);
    const totalOpp  = auditOpp(pA) + auditOpp(rA) + auditOpp(tA);
    const trendVals = [sysTrend(pAudits), sysTrend(rAudits), sysTrend(tAudits)].filter(v => v != null);
    const netTrend  = trendVals.length ? trendVals.reduce((a,b)=>a+b,0) : null;

    // ── Weekly status ──
    const wkMods = [
      { name:'Profit',  d: daysSince(pW?.period_end) },
      { name:'Revenue', d: daysSince(rW?.period_end) },
      { name:'Traffic', d: daysSince(tW?.period_end) },
    ].map(m => ({ ...m, current: m.d != null && m.d <= this.WEEKLY_CUTOFF }));
    const wkCount   = wkMods.filter(m => m.current).length;
    const wkOverdue = wkMods.filter(m => !m.current).map(m => m.name);

    // ── Key metrics ──
    const invVar  = pW ? (pW.bar_variance || []).reduce((sum,v) => sum + (v.variance_dollar||0), 0) : null;
    const recOpen = recs.length
      ? recs.filter(r => { const d = daysSince(r.date); return d != null && d <= 30 && r.status && r.status !== 'OK'; }).length
      : null;

    const band = (val, target, dir) => {
      if (val == null) return 'none';
      if (dir === 'low')  return val <= target ? 'good' : val <= target*1.1 ? 'warn' : 'bad';
      return val >= target ? 'good' : val >= target*0.9 ? 'warn' : 'bad';
    };
    const bandColor = b => b === 'good' ? 'var(--gold)' : b === 'warn' ? 'var(--w)' : b === 'bad' ? 'var(--red)' : 'var(--t4)';

    const pourT = pt.bar_pour_cost_pct ?? 22;
    const foodT = pt.food_cost_pct ?? 32;
    const primeT= pt.prime_cost_pct ?? 60;
    const caT   = rt.check_avg ?? 35;
    const laborT= rt.labor_pct ?? 30;
    const grT   = tTar.google_rating ?? 4.3;

    const metrics = [
      { label:'Bar Pour Cost', val: pW?.bar?.cost_pct ?? null, disp: pW?.bar?.cost_pct!=null?App.fmtPct(pW.bar.cost_pct):null, tgt: pourT+'%', status: band(pW?.bar?.cost_pct ?? null, pourT, 'low'), screen:'dashboard', mod:'profit' },
      { label:'Food Cost', val: pW?.food?.cost_pct ?? null, disp: pW?.food?.cost_pct!=null?App.fmtPct(pW.food.cost_pct):null, tgt: foodT+'%', status: band(pW?.food?.cost_pct ?? null, foodT, 'low'), screen:'dashboard', mod:'profit' },
      { label:'Prime Cost', val: pW?.prime_cost_pct ?? null, disp: pW?.prime_cost_pct!=null?App.fmtPct(pW.prime_cost_pct):null, tgt: primeT+'%', status: band(pW?.prime_cost_pct ?? null, primeT, 'low'), screen:'dashboard', mod:'profit' },
      { label:'Check Average', val: rW?.check_avg ?? null, disp: rW?.check_avg!=null?App.fmtCurrency(rW.check_avg):null, tgt: App.fmtCurrency(caT), status: band(rW?.check_avg ?? null, caT, 'high'), screen:'r-dashboard', mod:'revenue' },
      { label:'Labor %', val: rW?.labor_pct_blended ?? null, disp: rW?.labor_pct_blended!=null?App.fmtPct(rW.labor_pct_blended):null, tgt: laborT+'%', status: band(rW?.labor_pct_blended ?? null, laborT, 'low'), screen:'r-dashboard', mod:'revenue' },
      { label:'Google Rating', val: tW?.google_rating ?? null, disp: tW?.google_rating!=null?tW.google_rating.toFixed(1)+' / 5.0':null, tgt: grT.toFixed(1)+' stars', status: band(tW?.google_rating ?? null, grT, 'high'), screen:'t-dashboard', mod:'traffic' },
      { label:'Inventory Variance', val: invVar, disp: invVar!=null?App.fmtCurrency(invVar,0):null, tgt: 'Under $25', status: invVar==null?'none':Math.abs(invVar)<=25?'good':Math.abs(invVar)<=75?'warn':'bad', screen:'dashboard', mod:'profit' },
      { label:'Open Cash Variances', val: recOpen, disp: recOpen!=null?String(recOpen):null, tgt: '0 open', status: recOpen==null?'none':recOpen===0?'good':recOpen<=2?'warn':'bad', screen:'cash-recon', mod:'profit' },
    ];

    // ── Alerts (metric breaches) ──
    const sevRank = { bad:0, warn:1 };
    const alerts = metrics
      .filter(m => m.status === 'warn' || m.status === 'bad')
      .sort((a,b) => sevRank[a.status] - sevRank[b.status])
      .slice(0, 5)
      .map(m => ({
        sev: m.status,
        text: m.label + ' at ' + m.disp + ' · target ' + m.tgt,
        screen: m.screen, mod: m.mod
      }));

    // ── Priority action items ──
    const itemRows = [];
    const collect = (audit, sysName, screen, mod) => {
      if (!audit) return;
      (audit.action_items || []).forEach(it => {
        if (it && it.action) itemRows.push({ action: it.action, impact: it.monthly_impact || 0, sys: sysName, screen, mod });
      });
    };
    collect(pA, 'Profit',  'audit-tracker', 'profit');
    collect(rA, 'Revenue', 'r-audit',       'revenue');
    collect(tA, 'Traffic', 't-audit',       'traffic');
    itemRows.sort((a,b) => b.impact - a.impact);
    const topItems = itemRows.slice(0, 5);

    // ── Last updated ──
    const stamps = [];
    [pWeeks,rWeeks,tWeeks].forEach(arr => arr.forEach(w => { if (w && w.saved_at) stamps.push(w.saved_at); }));
    const prof = (data.traffic_settings || {}).profile || {};
    ['gbp_reviewed_at','search_reviewed_at','web_reviewed_at','rev_reviewed_at','social_reviewed_at','delivery_reviewed_at','email_reviewed_at']
      .forEach(k => { if (prof[k]) stamps.push(prof[k]); });
    [pAudits,rAudits,tAudits].forEach(arr => arr.forEach(a => { if (a && a.date) stamps.push(a.date); }));
    recs.forEach(r => { if (r && r.saved_at) stamps.push(r.saved_at); });

    let lastStamp = null, lastT = -1;
    stamps.forEach(str => {
      const t = new Date(String(str).length<=10 ? str+'T00:00:00' : str).getTime();
      if (!isNaN(t) && t > lastT) { lastT = t; lastStamp = str; }
    });
    let lastUpdatedTxt = 'No data entered yet';
    if (lastStamp) {
      const dateOnly = String(lastStamp).length <= 10;
      const d = new Date(dateOnly ? lastStamp+'T00:00:00' : lastStamp);
      const sameDay = d.toDateString() === new Date().toDateString();
      const datePart = sameDay ? 'today' : d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
      lastUpdatedTxt = 'Data last updated: ' + (dateOnly ? datePart : datePart + ' at ' + d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}));
    }

    const todayStr = new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});

    // ── UI builders ──
    const ring = (score, size) => {
      if (score == null) return `<div style="width:${size}px;height:${size}px;border-radius:50%;border:3px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:center;"><span style="font-size:8px;color:var(--t4);text-align:center;line-height:1.2;">No<br>Data</span></div>`;
      const r = (size/2)-5, circ = 2*Math.PI*r, dash = (Math.min(score,100)/100)*circ, col = App.scoreHex(score);
      return `<div style="position:relative;width:${size}px;height:${size}px;"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg);"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="3.5"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${col}" stroke-width="3.5" stroke-dasharray="${dash} ${circ}" stroke-linecap="round"/></svg><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><span style="font-size:15px;font-weight:800;color:${col};">${score}</span></div></div>`;
    };

    const panelTitle = (t) => `<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;flex-shrink:0;">${t}</div>`;
    const PANEL = `background:var(--surface);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:13px 15px;display:flex;flex-direction:column;overflow:hidden;min-height:0;`;

    // Stat tiles
    const tile = (label, big, bigColor, sub, subColor) => `
      <div style="background:var(--surface);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:11px 15px;display:flex;flex-direction:column;justify-content:center;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);margin-bottom:7px;">${label}</div>
        <div style="font-size:23px;font-weight:800;line-height:1;color:${bigColor};">${big}</div>
        <div style="font-size:10px;color:${subColor||'var(--t3)'};margin-top:6px;">${sub}</div>
      </div>`;

    const tiles =
        tile('Overall Recovery Score', overall != null ? overall : 'None',
             overall != null ? App.scoreHex(overall) : 'var(--t4)',
             overall != null ? App.scoreLabel(overall) + ' · ' + sysScores.length + ' of 3 audited' : 'No audits run yet')
      + tile('Total Monthly Opportunity', anyAudit ? App.fmtCurrency(totalOpp,0) : 'No data',
             anyAudit && totalOpp > 0 ? 'var(--red)' : 'var(--t4)',
             anyAudit ? 'Recoverable across audited systems' : 'Run an audit to surface this')
      + tile('Score Trend', netTrend != null ? (netTrend>=0?'+':'') + netTrend + ' pts' : 'No data',
             netTrend == null ? 'var(--t4)' : netTrend >= 0 ? 'var(--gold)' : 'var(--red)',
             netTrend != null ? 'Combined, vs last audit' : 'Needs a second audit')
      + tile('Weekly Status', `${wkCount} / 3 <span style="font-size:11px;color:var(--t3);font-weight:400;">this week</span>`,
             wkCount === 3 ? 'var(--gold)' : 'var(--t1)',
             wkOverdue.length ? wkOverdue.join(', ') + ' overdue' : 'All modules entered this week',
             wkOverdue.length ? 'var(--red)' : 'var(--t3)');

    // Audit scores panel
    const ringCol = (name, audit, trend, screen, mod) => {
      const score = audit?.overall_score ?? null;
      const trendHtml = trend == null
        ? '<span style="color:var(--t4);">No trend</span>'
        : `<span style="color:${trend>=0?'var(--gold)':'var(--red)'};font-weight:700;">${trend>=0?'+':''}${trend} pts</span>`;
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;">
        ${ring(score,52)}
        <div style="font-size:10px;font-weight:700;color:var(--t2);">${name}</div>
        <div style="font-size:9px;">${trendHtml}</div>
        <div style="font-size:9px;color:var(--t3);">Audit: ${audit?.date ? shortDate(audit.date) : 'None'}</div>
        <div style="font-size:9px;color:var(--t4);">Ind. avg 58</div>
        <button class="hd-btn" style="width:100%;" onclick="S.Hub._enter('${screen}','${mod}')">Run Audit</button>
      </div>`;
    };
    const auditPanel = `<div style="${PANEL}">${panelTitle('Audit Scores')}
      <div style="display:flex;gap:10px;flex:1;align-items:center;">
        ${ringCol('Profit', pA, sysTrend(pAudits), 'audit-tracker', 'profit')}
        ${ringCol('Revenue', rA, sysTrend(rAudits), 'r-audit', 'revenue')}
        ${ringCol('Traffic', tA, sysTrend(tAudits), 't-audit', 'traffic')}
      </div></div>`;

    // Key metrics panel
    const metricCells = metrics.map(m => `
      <div class="hd-metric" onclick="S.Hub._enter('${m.screen}','${m.mod}')">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--t3);">${m.label}</div>
        <div style="font-size:19px;font-weight:800;line-height:1;color:${bandColor(m.status)};">${m.disp || '—'}</div>
        <div style="font-size:9px;color:var(--t4);">${m.disp ? 'Target ' + m.tgt : 'No data'}</div>
      </div>`).join('');
    const metricsPanel = `<div style="${PANEL}">${panelTitle('Key Metrics')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;flex:1;">${metricCells}</div></div>`;

    // Alerts panel
    const alertsBody = alerts.length
      ? alerts.map(a => `
          <div style="display:flex;align-items:center;gap:9px;padding:7px 8px;border:1px solid rgba(255,255,255,0.05);border-radius:6px;">
            <span style="width:7px;height:7px;border-radius:50%;background:${a.sev==='bad'?'var(--red)':'var(--gold)'};flex-shrink:0;"></span>
            <div style="flex:1;font-size:11px;color:var(--t2);line-height:1.35;min-width:0;">${esc(a.text)}</div>
            <button class="hd-btn" onclick="S.Hub._enter('${a.screen}','${a.mod}')">Fix It</button>
          </div>`).join('')
      : `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="11" stroke="var(--gold)" stroke-width="1.4"/><path d="M8 13l3.5 3.5L18 9" stroke="var(--gold)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <div style="font-size:12px;font-weight:700;color:var(--t1);">All Clear</div>
          <div style="font-size:10px;color:var(--t3);text-align:center;">No metrics are off target right now.</div>
        </div>`;
    const alertsPanel = `<div style="${PANEL}">${panelTitle('Alerts')}
      <div style="flex:1;display:flex;flex-direction:column;gap:6px;overflow:hidden;">${alertsBody}</div></div>`;

    // Trend chart panel
    const buildChart = () => {
      const pour = pWeeks.slice(-8).map(w => w?.bar?.cost_pct).filter(v => v != null);
      const ca   = rWeeks.slice(-8).map(w => w?.check_avg).filter(v => v != null);
      if (pour.length < 2 && ca.length < 2) {
        return '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--t4);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Enter 2+ weeks to see trends</div>';
      }
      const W = 540, H = 188, P = { t:14, r:14, b:18, l:14 };
      const cw = W-P.l-P.r, ch = H-P.t-P.b;
      const series = (vals, target, color) => {
        if (vals.length < 2) return '';
        let mn = Math.min(...vals, target), mx = Math.max(...vals, target);
        const sp = (mx-mn)*0.2 || 1; mn -= sp; mx += sp;
        const x = i => P.l + (i/(vals.length-1))*cw;
        const y = v => P.t + ch - ((v-mn)/(mx-mn||1))*ch;
        let d = 'M' + x(0).toFixed(1) + ',' + y(vals[0]).toFixed(1);
        for (let i = 1; i < vals.length; i++) {
          const cp = (x(i)-x(i-1))*0.35;
          d += ' C' + (x(i-1)+cp).toFixed(1) + ',' + y(vals[i-1]).toFixed(1) + ' ' + (x(i)-cp).toFixed(1) + ',' + y(vals[i]).toFixed(1) + ' ' + x(i).toFixed(1) + ',' + y(vals[i]).toFixed(1);
        }
        const tgt = '<line x1="'+P.l+'" y1="'+y(target).toFixed(1)+'" x2="'+(W-P.r)+'" y2="'+y(target).toFixed(1)+'" stroke="'+color+'" stroke-width="1" stroke-dasharray="4,4" opacity="0.4"/>';
        const dots = vals.map((v,i) => '<circle cx="'+x(i).toFixed(1)+'" cy="'+y(v).toFixed(1)+'" r="2.6" fill="var(--surface)" stroke="'+color+'" stroke-width="1.6"/>').join('');
        return tgt + '<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="2"/>' + dots;
      };
      return '<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="display:block;overflow:visible;">'
        + series(pour, pourT, '#C9A84C')
        + series(ca, caT, '#ffffff')
        + '</svg>';
    };
    const chartLegend = `<div style="display:flex;gap:16px;margin-bottom:8px;flex-shrink:0;">
        <span style="font-size:9px;color:var(--t3);"><span style="display:inline-block;width:9px;height:2px;background:#C9A84C;vertical-align:middle;margin-right:5px;"></span>Bar Pour Cost %</span>
        <span style="font-size:9px;color:var(--t3);"><span style="display:inline-block;width:9px;height:2px;background:#ffffff;vertical-align:middle;margin-right:5px;"></span>Check Average</span>
        <span style="font-size:9px;color:var(--t4);margin-left:auto;">Last 8 weeks</span>
      </div>`;
    const chartPanel = `<div style="${PANEL}">${panelTitle('Cost & Revenue Trend')}${chartLegend}${buildChart()}</div>`;

    // Priority action items panel
    const actionBody = topItems.length
      ? topItems.map((it,i) => `
          <div class="hd-row" onclick="S.Hub._enter('${it.screen}','${it.mod}')" style="display:flex;align-items:center;gap:9px;padding:7px 6px;${i<topItems.length-1?'border-bottom:1px solid rgba(255,255,255,0.05);':''}">
            <span style="font-size:8px;font-weight:800;letter-spacing:0.06em;color:var(--gold);background:rgba(201,168,76,0.12);padding:3px 0;border-radius:3px;flex-shrink:0;width:56px;text-align:center;">${it.sys.toUpperCase()}</span>
            <div style="flex:1;font-size:11px;color:var(--t2);line-height:1.35;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(it.action)}</div>
            ${it.impact > 0 ? `<div style="font-size:11px;font-weight:800;color:var(--gold);flex-shrink:0;">${App.fmtCurrency(it.impact,0)}/mo</div>` : ''}
          </div>`).join('')
      : `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--t3);font-size:11px;text-align:center;line-height:1.5;padding:0 20px;">Run an audit in any system and your highest-impact opportunities will be ranked here.</div>`;
    const actionPanel = `<div style="${PANEL}">${panelTitle('Priority Action Items')}
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">${actionBody}</div></div>`;

    // Sidebar
    const icons = {
      profit:  '<path d="M2 13h11M4 13V8M7.5 13V4M11 13V9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      revenue: '<path d="M2 11l3.5-3.5 2.5 2.5L13 4M10 4h3v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
      traffic: '<circle cx="7.5" cy="7.5" r="5.3" stroke="currentColor" stroke-width="1.3"/><path d="M2.2 7.5h10.6M7.5 2.2c2.1 2.4 2.1 8.2 0 10.6M7.5 2.2c-2.1 2.4-2.1 8.2 0 10.6" stroke="currentColor" stroke-width="1.2"/>',
      inv:     '<path d="M2.5 4.5L7.5 2l5 2.5v6L7.5 13l-5-2.5v-6z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M2.5 4.5l5 2.5 5-2.5M7.5 7v6" stroke="currentColor" stroke-width="1.2"/>',
      labor:   '<circle cx="5.5" cy="5" r="2.1" stroke="currentColor" stroke-width="1.2"/><circle cx="10.5" cy="5.6" r="1.7" stroke="currentColor" stroke-width="1.2"/><path d="M2 12c0-2 1.6-3.4 3.5-3.4S9 10 9 12M9.3 11.3c.1-1.7 1.3-2.7 2.9-2.7S15 9.7 15 11.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      shift:   '<circle cx="7.5" cy="7.5" r="5.3" stroke="currentColor" stroke-width="1.3"/><path d="M7.5 4.3v3.4l2.4 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    };
    const navItems = [
      { name:'Profit Recovery',  icon:icons.profit,  screen:'dashboard',   mod:'profit'  },
      { name:'Revenue Recovery', icon:icons.revenue, screen:'r-dashboard', mod:'revenue' },
      { name:'Traffic Recovery', icon:icons.traffic, screen:'t-dashboard', mod:'traffic' },
      { name:'Inventory Control',icon:icons.inv,   screen:'ic-dashboard', mod:'inventory' },
      { name:'Labor Control',    icon:icons.labor, soon:true },
      { name:'Shift Control',    icon:icons.shift, screen:'sc-log-shift', mod:'shift' },
    ];
    const navHtml = navItems.map(n => n.soon
      ? `<div class="hd-nav soon"><svg width="15" height="15" viewBox="0 0 15 15" fill="none">${n.icon}</svg><span style="flex:1;">${n.name}</span><span style="font-size:7px;font-weight:800;letter-spacing:0.07em;color:var(--t4);border:1px solid rgba(255,255,255,0.1);border-radius:3px;padding:2px 4px;">SOON</span></div>`
      : `<div class="hd-nav" onclick="S.Hub._enter('${n.screen}','${n.mod}')"><svg width="15" height="15" viewBox="0 0 15 15" fill="none">${n.icon}</svg><span>${n.name}</span></div>`
    ).join('');

    // ── Compose ──
    container.innerHTML = `
      <style>
        .hub-dash *{box-sizing:border-box;}
        .hub-dash .hd-nav{display:flex;align-items:center;gap:9px;padding:9px 13px;cursor:pointer;color:var(--t3);font-size:12px;font-weight:600;border-left:2px solid transparent;}
        .hub-dash .hd-nav:hover{background:rgba(255,255,255,0.03);color:var(--t1);border-left-color:var(--gold);}
        .hub-dash .hd-nav.soon,.hub-dash .hd-nav.soon:hover{cursor:default;color:var(--t4);background:none;border-left-color:transparent;}
        .hub-dash .hd-nav svg{flex-shrink:0;}
        .hub-dash .hd-metric{padding:8px 11px;border:1px solid rgba(255,255,255,0.05);border-radius:6px;cursor:pointer;display:flex;flex-direction:column;justify-content:center;gap:4px;}
        .hub-dash .hd-metric:hover{border-color:rgba(201,168,76,0.4);background:rgba(255,255,255,0.02);}
        .hub-dash .hd-row{cursor:pointer;}
        .hub-dash .hd-row:hover{background:rgba(255,255,255,0.03);}
        .hub-dash .hd-btn{background:none;border:1px solid rgba(255,255,255,0.12);color:var(--t2);font-size:9px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;padding:5px 9px;border-radius:4px;cursor:pointer;white-space:nowrap;}
        .hub-dash .hd-btn:hover{border-color:var(--gold);color:var(--gold);}
      </style>
      <div class="hub-dash" style="height:100vh;display:grid;grid-template-columns:160px 1fr;grid-template-rows:48px 1fr 34px;background:var(--bg);overflow:hidden;">

        <div style="grid-column:1/-1;grid-row:1;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid rgba(255,255,255,0.07);background:var(--surface);">
          <div style="display:flex;align-items:center;gap:13px;flex:1;">
            <img src="assets/logo.png" alt="Bar Cop" style="height:20px;opacity:0.93;"/>
            <span style="font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:var(--t3);">Recovery Platform</span>
          </div>
          <div style="font-size:14px;font-weight:800;color:var(--t1);">${esc(barName)}</div>
          <div style="display:flex;align-items:center;gap:14px;flex:1;justify-content:flex-end;">
            <span style="font-size:11px;color:var(--t3);">${todayStr}</span>
            <button id="hub-signout" class="hd-btn">Sign Out</button>
          </div>
        </div>

        <div style="grid-column:1;grid-row:2;border-right:1px solid rgba(255,255,255,0.07);background:var(--surface);padding:8px 0;overflow:hidden;">
          <div style="font-size:8px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--t4);padding:6px 13px 8px;">Modules</div>
          ${navHtml}
        </div>

        <div style="grid-column:2;grid-row:2;display:grid;grid-template-rows:78px 1fr 1fr;gap:12px;padding:12px;overflow:hidden;min-height:0;">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">${tiles}</div>
          <div style="display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:12px;min-height:0;">${auditPanel}${metricsPanel}${alertsPanel}</div>
          <div style="display:grid;grid-template-columns:1.25fr 1fr;gap:12px;min-height:0;">${chartPanel}${actionPanel}</div>
        </div>

        <div style="grid-column:1/-1;grid-row:3;display:flex;align-items:center;padding:0 18px;border-top:1px solid rgba(255,255,255,0.07);background:var(--surface);">
          <span style="font-size:10px;color:var(--t4);">${lastUpdatedTxt}</span>
        </div>

      </div>
    `;

    document.getElementById('hub-signout')?.addEventListener('click', async () => { await DB.signOut(); });
  },

  _enter(screen, module) { App.showApp(module || 'profit'); App.navigate(screen); }

};
