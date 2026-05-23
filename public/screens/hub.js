'use strict';

S.Hub = {

  AUDIT_STALE: 35,
  WEEKLY_CUTOFF: 8,
  _sidebarCollapsed: false,

  render(container) {
    this._stage = container;
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
    // Cash data is owned by Shift Control (sc_variances), not the legacy
    // user_data reconciliations key — that key is empty for a real operator.
    const recs    = (App.shiftData && App.shiftData.sc_variances) || [];

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
    const bandColor = b => b === 'good' ? 'var(--green)' : b === 'warn' ? 'var(--w)' : b === 'bad' ? 'var(--red)' : 'var(--t4)';

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
    ];

    // ── Alerts — metric breaches plus forward-looking signals ──
    const sevRank = { bad:0, warn:1 };
    const metricAlerts = metrics
      .filter(m => m.status === 'warn' || m.status === 'bad')
      .map(m => ({
        sev: m.status,
        text: m.label + ' at ' + m.disp + ' · target ' + m.tgt,
        screen: m.screen, mod: m.mod
      }));
    const alerts = metricAlerts.concat(this.forwardAlerts())
      .sort((a,b) => sevRank[a.sev] - sevRank[b.sev])
      .slice(0, 5);

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
    recs.forEach(r => { const ts = r && (r.saved_at || r.created_at); if (ts) stamps.push(ts); });

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
    const PANEL = `background:var(--surface);border:1px solid var(--b-edge);border-radius:8px;padding:13px 15px;display:flex;flex-direction:column;overflow:hidden;min-height:0;`;

    // Stat tiles — center-aligned to match the 4-stat tile pattern used
    // throughout the rest of the app (module dashboards, etc.). Big number in
    // Barlow Condensed, colored by status (green for good, red for bad).
    const tile = (label, big, bigColor, sub, subColor) => `
      <div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:8px;padding:13px 15px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">${label}</div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:30px;font-weight:700;line-height:1;color:${bigColor};">${big}</div>
        <div style="font-size:10px;color:${subColor||'var(--t3)'};margin-top:7px;">${sub}</div>
      </div>`;

    const tiles =
        tile('Overall Recovery Score', overall != null ? overall : 'None',
             overall != null ? App.scoreHex(overall) : 'var(--t4)',
             overall != null ? App.scoreLabel(overall) + ' · ' + sysScores.length + ' of 3 audited' : 'No audits run yet')
      + tile('Total Monthly Opportunity', anyAudit ? App.fmtCurrency(totalOpp,0) : 'No data',
             anyAudit && totalOpp > 0 ? 'var(--red)' : 'var(--t4)',
             anyAudit ? 'Recoverable across audited systems' : 'Run an audit to surface this')
      + tile('Score Trend', netTrend != null ? (netTrend>=0?'+':'') + netTrend + ' pts' : 'No data',
             netTrend == null ? 'var(--t4)' : netTrend >= 0 ? 'var(--green)' : 'var(--red)',
             netTrend != null ? 'Combined, vs last audit' : 'Needs a second audit')
      + tile('Weekly Status', `${wkCount} / 3 <span style="font-size:13px;color:var(--t3);font-weight:600;">this week</span>`,
             wkCount === 3 ? 'var(--green)' : 'var(--t1)',
             wkOverdue.length ? wkOverdue.join(', ') + ' overdue' : 'All modules entered this week',
             wkOverdue.length ? 'var(--red)' : 'var(--t3)');

    // Audit Scores panel — three stacked rows, one per module.
    // Each row uses the PDF-cover layout: bold module name + action top-right,
    // big score / 100 with the score bar full-width below it, then the red
    // dollar statement (or green "On target") computed honestly from the
    // audit's action_items, then audit date + trend in small subtext. The
    // action mirrors the 30-day rolling rule the audit screens enforce.
    const auditDaysLeft = (a) => {
      if (!a || !a.date) return 0;
      const d = Math.floor((Date.now() - new Date(a.date + 'T00:00:00').getTime()) / 86400000);
      return Math.max(0, 30 - d);
    };
    const auditRow = (name, audit, trend, screen, mod, isFirst, indAvg) => {
      const score      = audit?.overall_score ?? null;
      const scoreColor = score != null ? App.scoreHex(score) : 'var(--t4)';
      const daysLeft   = auditDaysLeft(audit);
      const canRun     = daysLeft <= 0;
      const btnLabel   = !audit ? 'Run First Audit' : 'Run Audit';

      // Action area: button when ready, countdown otherwise
      const actionHtml = canRun
        ? '<button class="hd-btn" onclick="S.Hub._enter(\'' + screen + '\',\'' + mod + '\')">' + btnLabel + '</button>'
        : '<div style="text-align:right;font-size:9px;color:var(--t3);font-weight:700;letter-spacing:0.07em;text-transform:uppercase;line-height:1.3;">'
          + 'Next Audit<br><span style="color:var(--t2);font-family:\'Barlow Condensed\',sans-serif;font-size:14px;letter-spacing:0;">in '
          + daysLeft + ' day' + (daysLeft===1?'':'s') + '</span></div>';

      // Score block: big number / 100 + industry/target line + bar with marker
      let scoreBlock;
      if (score != null) {
        const barPct = Math.max(0, Math.min(100, Math.round(score)));
        scoreBlock = ''
          + '<div style="display:flex;align-items:baseline;gap:12px;">'
          +   '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:34px;font-weight:700;color:' + scoreColor + ';line-height:1;">'
          +     score + '<span style="font-size:13px;color:var(--t3);font-weight:600;letter-spacing:0.04em;"> / 100</span></div>'
          +   '<div style="flex:1;font-size:10px;color:var(--t3);">Industry avg ' + indAvg + ' &middot; Your target 65+</div>'
          + '</div>'
          + '<div style="margin-top:7px;">'
          +   '<div style="display:flex;height:6px;border-radius:4px;overflow:hidden;">'
          +     '<div style="width:50%;background:var(--red);"></div>'
          +     '<div style="width:20%;background:var(--t2);"></div>'
          +     '<div style="width:30%;background:var(--green);"></div>'
          +   '</div>'
          +   '<div style="position:relative;height:0;">'
          +     '<div style="position:absolute;top:-9px;left:' + barPct + '%;width:3px;height:11px;background:var(--w);border-radius:2px;transform:translateX(-1.5px);box-shadow:0 0 0 1.5px var(--surface);"></div>'
          +   '</div>'
          + '</div>';
      } else {
        scoreBlock = '<div style="display:flex;align-items:baseline;gap:12px;">'
          + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:34px;font-weight:700;color:var(--t4);line-height:1;">&#8212;</div>'
          + '<div style="flex:1;font-size:11px;color:var(--t3);">Run the first audit to score this module.</div>'
          + '</div>';
      }

      // Honest dollar statement from action_items.monthly_impact
      let dollarLine = '';
      if (audit) {
        const monthly = (audit.action_items || []).reduce((s, a) => s + (a.monthly_impact || 0), 0);
        const weekly  = monthly / 4.345;
        if (weekly > 0) {
          dollarLine = '<div style="font-size:11px;color:var(--red);font-weight:700;margin-top:7px;">'
            + 'Leaking an estimated ' + App.fmtCurrency(weekly, 0) + ' per week.</div>';
        } else {
          dollarLine = '<div style="font-size:11px;color:var(--green);font-weight:700;margin-top:7px;">'
            + 'On target. Holding the line.</div>';
        }
      }

      // Subtext: trend + audit date
      let subText = '';
      if (audit) {
        const trendHtml = trend == null
          ? ''
          : '<span style="color:' + (trend>=0?'var(--green)':'var(--red)') + ';font-weight:700;">'
            + (trend>=0?'+':'') + trend + ' pts</span> &middot; ';
        subText = '<div style="font-size:9px;color:var(--t4);margin-top:5px;">'
          + trendHtml + (audit.date ? 'Audit ' + shortDate(audit.date) : '')
          + '</div>';
      }

      return '<div style="padding:11px 0;' + (isFirst ? '' : 'border-top:1px solid var(--b2);') + '">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'
        +   '<div style="font-size:10px;font-weight:800;letter-spacing:0.18em;color:var(--t1);text-transform:uppercase;">' + name + '</div>'
        +   '<div style="flex-shrink:0;">' + actionHtml + '</div>'
        + '</div>'
        + scoreBlock
        + dollarLine
        + subText
        + '</div>';
    };
    const auditPanel = `<div style="${PANEL}">${panelTitle('Audit Scores')}
      <div style="display:flex;flex-direction:column;justify-content:space-around;flex:1;">
        ${auditRow('Profit',  pA, sysTrend(pAudits), 'audit-tracker', 'profit',  true,  63)}
        ${auditRow('Revenue', rA, sysTrend(rAudits), 'r-audit',       'revenue', false, 61)}
        ${auditRow('Traffic', tA, sysTrend(tAudits), 't-audit',       'traffic', false, 58)}
      </div></div>`;

    // Key metrics panel — 6 tiles in a 2x3 grid (reduced from 8). Left-aligned
    // big number in Barlow Condensed, colored by status band, default blue
    // tinted background, hover swaps border to gold.
    const metricCells = metrics.map(m => `
      <div class="hd-metric" onclick="S.Hub._enter('${m.screen}','${m.mod}')">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--t3);">${m.label}</div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:34px;font-weight:700;line-height:1;color:${bandColor(m.status)};">${m.disp || '-'}</div>
        <div style="font-size:9px;color:var(--t4);">${m.disp ? 'Target ' + m.tgt : 'No data'}</div>
      </div>`).join('');
    const metricsPanel = `<div style="${PANEL}">${panelTitle('Key Metrics')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;flex:1;">${metricCells}</div></div>`;

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

    // Trend chart panel — three stacked mini charts: Bar Pour Cost %,
    // Check Average $, Prime Cost %. Line style (gold #C9A84C, 2.5 stroke,
    // round caps, dashed target line) matches the module dashboards
    // (dashboard.js, r-dashboard.js) so the look is consistent across the
    // app. Fix-event markers (Section 10.5) ride on the bottom chart only,
    // so they appear once instead of three times.
    const miniChart = (label, series, target, valFmt, dir, withMarkers) => {
      const lastVal  = [...series].reverse().find(v => v != null) ?? null;
      const status   = lastVal != null ? band(lastVal, target, dir) : 'none';
      const curColor = bandColor(status);
      const curDisp  = lastVal != null ? valFmt(lastVal) : '—';
      const tgtDisp  = valFmt(target);

      const head = '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:3px;flex-shrink:0;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);">' + label + '</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:' + curColor + ';line-height:1;">' + curDisp + '</div>'
        + '<div style="margin-left:auto;font-size:9px;color:var(--t4);">Target ' + tgtDisp + '</div>'
        + '</div>';

      const nonNull = series.filter(v => v != null);
      if (nonNull.length < 2) {
        return '<div style="flex:1;display:flex;flex-direction:column;min-height:0;padding:4px 0;">'
          + head
          + '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--t4);font-size:9px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">Need 2+ weeks</div>'
          + '</div>';
      }

      const W = 540, H = 64, P = { t:6, r:10, b:6, l:10 };
      const cw = W-P.l-P.r, ch = H-P.t-P.b;
      let mn = Math.min(...nonNull, target);
      let mx = Math.max(...nonNull, target);
      const sp = (mx-mn)*0.2 || 1; mn -= sp; mx += sp;
      const x = i => P.l + (series.length > 1 ? (i/(series.length-1))*cw : cw/2);
      const y = v => P.t + ch - ((v-mn)/(mx-mn||1))*ch;

      // Smooth path through non-null values; nulls keep their x slot so the
      // time axis stays honest, the path just skips them.
      let d = '';
      let prev = -1;
      for (let i = 0; i < series.length; i++) {
        const v = series[i];
        if (v == null) continue;
        if (prev < 0) {
          d = 'M' + x(i).toFixed(1) + ',' + y(v).toFixed(1);
        } else {
          const cp = (x(i)-x(prev))*0.35;
          d += ' C' + (x(prev)+cp).toFixed(1) + ',' + y(series[prev]).toFixed(1) + ' '
            + (x(i)-cp).toFixed(1) + ',' + y(v).toFixed(1) + ' '
            + x(i).toFixed(1) + ',' + y(v).toFixed(1);
        }
        prev = i;
      }

      const tgtLine = '<line x1="'+P.l+'" y1="'+y(target).toFixed(1)+'" x2="'+(W-P.r)+'" y2="'+y(target).toFixed(1)+'" stroke="#C9A84C" stroke-width="1" stroke-dasharray="5,5" opacity="0.35"/>';
      const dots = series.map((v,i) => v != null
        ? '<circle cx="'+x(i).toFixed(1)+'" cy="'+y(v).toFixed(1)+'" r="3" fill="#0A1520" stroke="#C9A84C" stroke-width="1.8"/>'
        : ''
      ).join('');

      let markerSvg = '';
      if (withMarkers && window.Recovery && window.FixPanel) {
        const refWeeks = pWeeks.slice(-series.length);
        if (refWeeks.length >= 2) {
          const marks = ['profit','revenue','traffic']
            .reduce((acc,m) => acc.concat(Recovery.chartMarkers(refWeeks, m)), []);
          const mxFn = i => P.l + (refWeeks.length > 1 ? (i/(refWeeks.length-1))*cw : cw/2);
          markerSvg = FixPanel.markerSvg(marks, mxFn, P.t, H-P.b);
        }
      }

      return '<div style="flex:1;display:flex;flex-direction:column;min-height:0;padding:4px 0;">'
        + head
        + '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" width="100%" style="display:block;flex:1;min-height:0;">'
        +   markerSvg
        +   tgtLine
        +   '<path d="'+d+'" fill="none" stroke="#C9A84C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
        +   dots
        + '</svg></div>';
    };

    const pourSeries  = pWeeks.slice(-8).map(w => w?.bar?.cost_pct ?? null);
    const caSeries    = rWeeks.slice(-8).map(w => w?.check_avg ?? null);
    const primeSeries = pWeeks.slice(-8).map(w => w?.prime_cost_pct ?? null);
    const anyTrend = pourSeries.filter(v=>v!=null).length >= 2
                  || caSeries.filter(v=>v!=null).length >= 2
                  || primeSeries.filter(v=>v!=null).length >= 2;

    let trendBody;
    if (!anyTrend) {
      trendBody = '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--t4);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Enter 2+ weeks to see trends</div>';
    } else {
      trendBody = ''
        + miniChart('Bar Pour Cost %', pourSeries,  pourT,  v => v.toFixed(1) + '%', 'low',  false)
        + miniChart('Check Average',   caSeries,    caT,    v => App.fmtCurrency(v), 'high', false)
        + miniChart('Prime Cost %',    primeSeries, primeT, v => v.toFixed(1) + '%', 'low',  true);
    }
    const chartSubtitle = '<div style="font-size:9px;color:var(--t4);margin-bottom:4px;flex-shrink:0;text-align:right;">Last 8 weeks</div>';
    const chartPanel = `<div style="${PANEL}">${panelTitle('Cost & Revenue Trend')}${chartSubtitle}
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">${trendBody}</div></div>`;

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

    // Weekly money readout panel — big red weekly leak total up top, then a
    // ranked list of the gap areas producing it. Same emotional language as
    // the Audit Scores card: lead with the dollar number, support with detail.
    const readout = this.weeklyReadout();
    const hasWeekData = pWeeks.length > 0 || rWeeks.length > 0;

    // Per-module color-tinted badge (PROFIT gold, REVENUE green, TRAFFIC blue)
    // — adds visual variation per module on each row.
    const modBadge = (mod) => {
      const map = {
        profit:  { c: 'var(--gold)',  bg: 'var(--gold-bg)'  },
        revenue: { c: 'var(--green)', bg: 'var(--green-bg)' },
        traffic: { c: 'var(--blue)',  bg: 'var(--blue-bg)'  }
      };
      const m = map[mod] || map.profit;
      return '<span style="display:inline-block;font-size:8px;font-weight:800;letter-spacing:0.08em;color:'
        + m.c + ';background:' + m.bg + ';padding:3px 6px;border-radius:3px;flex-shrink:0;min-width:62px;text-align:center;">'
        + (mod || '').toUpperCase() + '</span>';
    };

    let readoutBody;
    if (!hasWeekData) {
      readoutBody = '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:0 16px;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:36px;font-weight:700;color:var(--t4);line-height:1;">&#8212; / wk</div>'
        + '<div style="font-size:11px;color:var(--t3);line-height:1.5;max-width:240px;">Enter this week\'s numbers in Profit and Revenue to see what is leaking and where.</div>'
        + '</div>';
    } else if (readout.items.length === 0) {
      readoutBody = '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;">'
        + '<svg width="34" height="34" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="11" stroke="var(--green)" stroke-width="1.6"/><path d="M8 13l3.5 3.5L18 9" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        + '<div style="display:flex;align-items:baseline;gap:8px;"><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:34px;font-weight:700;color:var(--green);line-height:1;">$0</div><div style="font-size:11px;color:var(--green);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">/ wk</div></div>'
        + '<div style="font-size:11px;color:var(--green);font-weight:700;">Holding the line.</div>'
        + '<div style="font-size:10px;color:var(--t3);line-height:1.4;max-width:240px;">Every gap area with a weekly dollar metric is on target.</div>'
        + '</div>';
    } else {
      const shown = readout.items.slice(0, 4);
      const roRows = shown.map((it, i) => {
        const isBiggest = i === 0;
        const isLast    = i === shown.length - 1;
        return '<div class="hd-row" onclick="S.Hub._enterFix(\'' + it.module + '\',\'' + esc(it.gapId) + '\')"'
          + ' style="display:flex;align-items:center;gap:10px;padding:9px 4px;'
          + (isLast ? '' : 'border-bottom:1px solid var(--b2);') + '">'
          + modBadge(it.module)
          + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
          +   esc(it.label)
          +   (isBiggest ? ' <span style="font-size:8px;font-weight:800;letter-spacing:0.08em;color:var(--red);background:var(--red-bg);padding:2px 5px;border-radius:3px;margin-left:4px;">BIGGEST</span>' : '')
          + '</div>'
          + '<div style="flex-shrink:0;font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:var(--red);">' + App.fmtCurrency(it.weekly, 0) + '<span style="font-size:10px;color:var(--t3);font-weight:600;">/wk</span></div>'
          + '</div>';
      }).join('');
      readoutBody = ''
        + '<div style="display:flex;align-items:baseline;gap:10px;">'
        +   '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:38px;font-weight:700;color:var(--red);line-height:1;">' + App.fmtCurrency(readout.total, 0) + '</div>'
        +   '<div style="font-size:11px;color:var(--t3);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">/ week</div>'
        + '</div>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:5px;">leaking across ' + readout.items.length + ' gap area' + (readout.items.length===1?'':'s') + '</div>'
        + '<div style="margin-top:12px;flex:1;display:flex;flex-direction:column;overflow:hidden;">' + roRows + '</div>';
    }
    const readoutPanel = `<div style="${PANEL}">${panelTitle('Weekly Money Readout')}${readoutBody}</div>`;

    // ── Sidebar nav SVG icons, 17x17 viewBox to match the module sidebars ──
    const navIcons = {
      profit:  '<path d="M2 13h11M4 13V8M7.5 13V4M11 13V9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      revenue: '<path d="M2 13l4-5 3 3 4.5-7M10 4h4v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
      traffic: '<circle cx="8.5" cy="8.5" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 8.5h12M8.5 2.5c2.5 3 2.5 9 0 12M8.5 2.5c-2.5 3-2.5 9 0 12" stroke="currentColor" stroke-width="1.2"/>',
      inv:     '<path d="M2.5 5L8.5 2l6 3v7l-6 3-6-3V5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M2.5 5l6 3 6-3M8.5 8v7" stroke="currentColor" stroke-width="1.2"/>',
      labor:   '<circle cx="6" cy="6" r="2.6" stroke="currentColor" stroke-width="1.3"/><path d="M1.8 14c0-2.6 1.9-4.2 4.2-4.2s4.2 1.6 4.2 4.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M11.5 4.2a2.4 2.4 0 0 1 0 4.6M12 14c0-2.4-1.3-3.9-3-4.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      shift:   '<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 5v4l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      getStart:'<path d="M2.5 8.5l4 4 8-8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
      help:    '<circle cx="8.5" cy="8.5" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 6.5a1.5 1.5 0 0 1 3 0c0 1-1.5 1.5-1.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8.5" cy="12" r="0.6" fill="currentColor"/>',
      settings:'<circle cx="8.5" cy="8.5" r="2" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 2v1.5M8.5 13.5V15M2 8.5h1.5M13.5 8.5H15M3.8 3.8l1.1 1.1M12.1 12.1l1.1 1.1M3.8 13.2l1.1-1.1M12.1 4.9l1.1-1.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      bug:     '<ellipse cx="8.5" cy="9" rx="3.5" ry="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 9H2.5M14.5 9H12M5.5 5L4 3.5M11.5 5L13 3.5M5.5 13L4 14.5M11.5 13L13 14.5M8.5 4.5V3M7 4a2 2 0 0 1 3 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      signout: '<path d="M6.5 3h-3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3M11 5.5l3 3-3 3M14 8.5H7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>'
    };

    // Build one sidebar nav row. extra is an array of [attr, value] tuples
    // for data-mod / data-screen on the module-enter rows.
    const navItem = (action, name, iconKey, extra) => {
      const attrs = (extra || []).map(([k,v]) => ' ' + k + '="' + v + '"').join('');
      return '<div class="nav-item" data-hub-action="' + action + '"' + attrs + '>'
        + '<svg class="nav-icon" viewBox="0 0 17 17" fill="none">' + navIcons[iconKey] + '</svg>'
        + '<span class="nav-label">' + name + '</span></div>';
    };

    const sidebarNav = ''
      + '<div class="nav-section">Recovery</div>'
      + navItem('enter', 'Profit Recovery',  'profit',  [['data-mod','profit'],   ['data-screen','dashboard']])
      + navItem('enter', 'Revenue Recovery', 'revenue', [['data-mod','revenue'],  ['data-screen','r-dashboard']])
      + navItem('enter', 'Traffic Recovery', 'traffic', [['data-mod','traffic'],  ['data-screen','t-dashboard']])
      + '<div class="nav-section">Control</div>'
      + navItem('enter', 'Inventory Control','inv',     [['data-mod','inventory'],['data-screen','ic-dashboard']])
      + navItem('enter', 'Labor Control',    'labor',   [['data-mod','labor'],    ['data-screen','lc-dashboard']])
      + navItem('enter', 'Shift Control',    'shift',   [['data-mod','shift'],    ['data-screen','sc-dashboard']])
      + '<div class="nav-section">Support</div>'
      + navItem('getting-started', 'Getting Started', 'getStart', [])
      + navItem('help',            'Help and FAQ',    'help',     [])
      + '<div class="nav-section">Manage</div>'
      + navItem('settings',  'Settings',   'settings', [])
      + '<div class="nav-item nav-disabled" title="Coming soon">'
      +   '<svg class="nav-icon" viewBox="0 0 17 17" fill="none">' + navIcons.bug + '</svg>'
      +   '<span class="nav-label">Report Bug</span></div>';

    const collapsedClass = this._sidebarCollapsed ? ' sidebar-collapsed' : '';

    // ── Compose ──
    // Reuses the same .app / .sidebar / .topbar / .content classes as the
    // module shells so the Hub sidebar matches them exactly in width, logo
    // area, collapse behavior, and visual styling. The .hub-app class adds
    // hub-specific overrides for the fixed-viewport dashboard layout.
    container.innerHTML = `
      <style>
        .hub-app{height:100% !important;}
        .hub-app .content{overflow:hidden !important;padding:24px;min-width:0;}
        .hub-app .nav-item.nav-disabled{cursor:default;opacity:0.45;}
        .hub-app .nav-item.nav-disabled:hover{background:transparent;}
        .hub-app .nav-item.nav-disabled .nav-icon{color:var(--t4);}
        .hub-app .hd-metric{background:var(--input);padding:10px 13px;border:1px solid var(--b2);border-radius:6px;cursor:pointer;display:flex;flex-direction:column;justify-content:center;gap:6px;transition:border-color 0.12s;}
        .hub-app .hd-metric:hover{border-color:var(--gold);}
        .hub-app .hd-row{cursor:pointer;}
        .hub-app .hd-row:hover{background:rgba(255,255,255,0.03);}
        .hub-app .hd-btn{background:none;border:1px solid rgba(255,255,255,0.12);color:var(--t2);font-size:9px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;padding:5px 9px;border-radius:4px;cursor:pointer;white-space:nowrap;}
        .hub-app .hd-btn:hover{border-color:var(--gold);color:var(--gold);}
      </style>
      <div class="app hub-app${collapsedClass}">
        <aside class="sidebar">
          <div class="sidebar-logo">
            <img src="assets/logo.png" alt="Bar Cop" class="sidebar-logo-full"/>
            <img src="assets/bar-graph-icon.png" alt="Bar Cop" class="sidebar-logo-icon"/>
            <button class="sidebar-logo-toggle" id="hub-sidebar-toggle" title="Toggle sidebar">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="2" y="7.25" width="12" height="1.5" rx="0.75" fill="currentColor"/><rect x="2" y="11.5" width="12" height="1.5" rx="0.75" fill="currentColor"/></svg>
            </button>
          </div>
          <nav class="sidebar-nav">${sidebarNav}</nav>
          <div class="sidebar-footer">
            <button class="sidebar-btn" id="hub-signout">
              <svg class="nav-icon" viewBox="0 0 17 17" fill="none">${navIcons.signout}</svg>
              <span class="sidebar-btn-label">${App.demoMode ? 'Exit Demo' : 'Sign Out'}</span>
            </button>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <div class="topbar-left">
              <h1 class="topbar-title">${esc(barName)}</h1>
              <span class="topbar-sub">${todayStr}</span>
            </div>
            <div class="topbar-right">
              <span style="font-size:10px;color:var(--t4);">${lastUpdatedTxt}</span>
            </div>
          </header>
          <main class="content">
            <div style="height:100%;display:grid;grid-template-rows:auto 1fr 1fr;gap:18px;min-height:0;">
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px;">${tiles}</div>
              <div style="display:grid;grid-template-columns:1fr 1.4fr 1fr;gap:18px;min-height:0;">${auditPanel}${metricsPanel}${alertsPanel}</div>
              <div style="display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:18px;min-height:0;">${chartPanel}${readoutPanel}${actionPanel}</div>
            </div>
          </main>
        </div>
      </div>
    `;

    // ── Wire sign-out, sidebar toggle, sidebar nav clicks, recovery target ──
    document.getElementById('hub-signout')?.addEventListener('click', async () => {
      if (App.demoMode) { window.location.href = '/'; return; }
      await DB.signOut();
    });

    document.getElementById('hub-sidebar-toggle')?.addEventListener('click', () => {
      this._sidebarCollapsed = !this._sidebarCollapsed;
      container.querySelector('.hub-app')?.classList.toggle('sidebar-collapsed');
    });

    const navEl = container.querySelector('.sidebar-nav');
    if (navEl) navEl.addEventListener('click', (ev) => {
      const item = ev.target.closest('.nav-item');
      if (!item || item.classList.contains('nav-disabled')) return;
      const action = item.dataset.hubAction;
      if (action === 'enter') this._enter(item.dataset.screen, item.dataset.mod);
      else if (action === 'getting-started') S.HubGettingStarted.open();
      else if (action === 'help')            S.HubHelp.open();
      else if (action === 'settings')        S.HubSettings.open();
    });

  },

  _enter(screen, module) { App.showApp(module || 'profit'); App.navigate(screen); },

  // Deep-link from the weekly readout into a module's Fix screen at a gap-area.
  _enterFix(module, gapId) {
    App.showApp(module || 'profit');
    if (gapId) App._fixFocus = gapId;
    App.navigate(module === 'revenue' ? 'r-fix' : 'profit-fix');
  },

  /* Weekly money readout (Section 10.3) — what is leaking this week, where, and
     biggest first. Reads the live per-gap-area band from Recovery.gapImpact, the
     same engine the dashboards use. A gap-area only counts when its weekly dollar
     loss computes honestly from real data; metrics shared by two gap-areas (the
     check-average pair) are counted once. */
  weeklyReadout() {
    if (!window.Recovery || !window.FIX) return { items: [], total: 0 };
    const seen = {};
    const items = [];
    [['profit'], ['revenue']].forEach(([mod]) => {
      (FIX[mod] || []).forEach(g => {
        const imp = Recovery.gapImpact(g.id);
        if (!imp || imp.onTarget || !(imp.dollars > 0)) return;
        if (seen[imp.label]) return;
        seen[imp.label] = true;
        items.push({ label: imp.label, gapId: g.id, module: mod,
                     weekly: imp.dollars / 52, band: imp.band });
      });
    });
    items.sort((a, b) => b.weekly - a.weekly);
    return { items: items, total: items.reduce((s, x) => s + x.weekly, 0) };
  },

  /* Forward-looking alerts (Section 10.4) — predictive signals, not just
     historical breaches. Each fires only when the data to compute it exists,
     never on a fabricated projection. They feed the same Hub alert strip. */
  forwardAlerts() {
    const data = App.data || {};
    const out = [];
    const iso = d => d.toISOString().slice(0, 10);
    const mondayOf = d => { const x = new Date(d); const day = x.getDay();
      x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day)); return iso(x); };

    // 1. Projected overtime — current week, lc_actuals projected against lc_schedules
    const ld = App.laborData || {};
    const ws = mondayOf(new Date());
    const weEnd = (() => { const d = new Date(ws + 'T00:00:00'); d.setDate(d.getDate() + 6); return iso(d); })();
    const wkActuals = (ld.lc_actuals || []).filter(a => a.date >= ws && a.date <= weEnd);
    const sched = (ld.lc_schedules || []).find(s => {
      if (!s.week_start) return false;
      const st = new Date(s.week_start + 'T00:00:00').getTime();
      const tg = new Date(ws + 'T00:00:00').getTime();
      return !isNaN(st) && tg >= st && tg <= st + 6 * 86400000;
    });
    const otMap = {};
    wkActuals.forEach(a => { const id = a.staff_id || a.name;
      (otMap[id] = otMap[id] || { actual: 0, scheduled: 0, wage: a.wage, name: a.name }).actual += (a.hours || 0); });
    if (sched) (sched.shifts || []).forEach(sh => { const id = sh.staff_id || sh.name;
      (otMap[id] = otMap[id] || { actual: 0, scheduled: 0, name: sh.name }).scheduled += (sh.hours || 0); });
    let otCount = 0, otCost = 0;
    Object.keys(otMap).forEach(id => {
      const e = otMap[id];
      const st = (ld.lc_staff || []).find(s => s.id === id);
      const wage = st && st.wage != null ? st.wage : (e.wage || 0);
      const otHrs = Math.max(0, Math.max(e.actual, e.scheduled) - 40);
      if (otHrs > 0) { otCount++; otCost += otHrs * wage * 0.5; }
    });
    if (otCount > 0) out.push({
      sev: otCount >= 3 ? 'bad' : 'warn',
      text: 'Overtime projected: ' + otCount + ' staff over 40 hours this week, about ' + App.fmtCurrency(otCost, 0) + ' in extra OT premium.',
      screen: 'lc-overtime-watch', mod: 'labor'
    });

    // 2. Projected month-end prime cost — latest week's pace held to month end
    const weeks = data.weeks || [];
    const lw = weeks.length ? weeks[weeks.length - 1] : null;
    const primeT = ((data.settings || {}).targets || {}).prime_cost_pct ?? 60;
    if (lw && lw.prime_cost_pct != null && lw.prime_cost_pct > primeT) {
      const gap = lw.prime_cost_pct - primeT;
      const monthlyRev = (((lw.bar || {}).revenue || 0) + ((lw.food || {}).revenue || 0)) * 4.345;
      const monthlyOver = (gap / 100) * monthlyRev;
      out.push({
        sev: gap > 3 ? 'bad' : 'warn',
        text: 'Prime cost is tracking at ' + lw.prime_cost_pct.toFixed(1) + '%, ' + gap.toFixed(1) + ' points over your ' + primeT + '% target. Hold this pace and the month closes about ' + App.fmtCurrency(monthlyOver, 0) + ' over.',
        screen: 'dashboard', mod: 'profit'
      });
    }

    // 3. Declining review velocity — latest period below its recent average
    const tw = data.traffic_weeks || [];
    if (tw.length >= 3) {
      const latestT = tw[tw.length - 1];
      const prior = tw.slice(-5, -1).map(w => w.new_reviews).filter(v => v != null);
      if (latestT && latestT.new_reviews != null && prior.length >= 2) {
        const avg = prior.reduce((a, b) => a + b, 0) / prior.length;
        if (avg > 0 && latestT.new_reviews < avg * 0.8) out.push({
          sev: 'warn',
          text: 'Review velocity is sliding: ' + latestT.new_reviews + ' new reviews this period against a ' + avg.toFixed(0) + ' average. Reviews drive local ranking.',
          screen: 't-reviews', mod: 'traffic'
        });
      }
    }

    // 4. Recurring cash shortages — repeated shorts in recent drawer counts
    // (Shift Control sc_variances, the owner of cash data).
    const variances = (App.shiftData || {}).sc_variances || [];
    if (variances.length >= 2) {
      const recent = variances.slice(-6);
      const shorts = recent.filter(r => r.status === 'Short').length;
      if (shorts >= 2) out.push({
        sev: shorts >= 3 ? 'bad' : 'warn',
        text: 'Cash came up short in ' + shorts + ' of the last ' + recent.length + ' drawer counts. Recurring shortages point to a process gap, not a one-off.',
        screen: 'cash-recon', mod: 'profit'
      });
    }

    // 5. Vendor price re-drift — fresh price increases in recent deliveries
    const dels = (App.inventoryData || {}).ic_deliveries || [];
    const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 45); return iso(d); })();
    let incCount = 0;
    dels.filter(d => d.date && d.date >= cutoff).forEach(d => {
      (d.line_items || []).forEach(li => {
        if (li.price_changed && li.prev_price != null && li.price_per_unit != null
            && li.price_per_unit > li.prev_price) incCount++;
      });
    });
    if (incCount >= 2) out.push({
      sev: 'warn',
      text: 'Vendor prices rose on ' + incCount + ' items in deliveries over the last 45 days. Verify these against quoted sheets before they stick.',
      screen: 'vendor-watch', mod: 'profit'
    });

    return out;
  }

};
