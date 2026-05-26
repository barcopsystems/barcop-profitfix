'use strict';

S.Hub = {

  AUDIT_STALE: 35,
  WEEKLY_CUTOFF: 8,
  _sidebarCollapsed: false,

  render(container) {
    this._stage = container;
    // Outer wrapper scrolls when the dashboard content exceeds the viewport
    // (tablets, small laptops). On a desktop monitor the min-heights on the
    // grid rows fit naturally and the scrollbar never appears.
    container.style.overflowY = 'auto';
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
    // Hub uses tier-2 (soft) red for status indicators so the few real
    // attention reds (Leaking This Week headline, Alerts count) carry more
    // visual weight than the supporting status data.
    const bandColor = b => b === 'good' ? 'var(--green)' : b === 'warn' ? 'var(--amber)' : b === 'bad' ? 'var(--red-soft)' : 'var(--t4)';
    const softScore = s => { s = Number(s) || 0; return s >= 70 ? 'var(--green)' : s >= 50 ? 'var(--amber)' : 'var(--red-soft)'; };

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
      .slice(0, 50);

    // ── Priority action items ──
    // Show every action item from every audited module, ranked by dollar
    // impact. Cap at 50 as a safety ceiling; the card scrolls internally
    // when the list runs past its allotted height.
    const itemRows = [];
    const collect = (audit, sysName, mod) => {
      if (!audit) return;
      (audit.action_items || []).forEach(it => {
        if (it && it.action) {
          const gid = it.gap_id || (window.FixPanel ? FixPanel.inferGapId(it.action, mod) : null);
          itemRows.push({ action: it.action, impact: it.monthly_impact || 0, sys: sysName, mod: mod, gap: gid });
        }
      });
    };
    collect(pA, 'Profit',  'profit');
    collect(rA, 'Revenue', 'revenue');
    collect(tA, 'Traffic', 'traffic');
    itemRows.sort((a,b) => b.impact - a.impact);
    // Cap visible PAIs at 8 — top by impact — so the most important items are
    // never hidden behind a scrollbar. Overflow flagged in a small footer.
    const topItems = itemRows.slice(0, 8);
    const overflowItems = Math.max(0, itemRows.length - topItems.length);

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
      const r = (size/2)-5, circ = 2*Math.PI*r, dash = (Math.min(score,100)/100)*circ, col = softScore(score);
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
             overall != null ? softScore(overall) : 'var(--t4)',
             overall != null ? App.scoreLabel(overall) + ' · ' + sysScores.length + ' of 3 audited' : 'No audits run yet')
      + tile('Total Monthly Opportunity', anyAudit ? App.fmtCurrency(totalOpp,0) : 'No data',
             anyAudit && totalOpp > 0 ? 'var(--gold)' : 'var(--t4)',
             anyAudit ? 'Recoverable across audited systems' : 'Run an audit to surface this')
      + tile('Score Trend', netTrend != null ? (netTrend>=0?'+':'') + netTrend + ' pts' : 'No data',
             netTrend == null ? 'var(--t4)' : netTrend >= 0 ? 'var(--green)' : 'var(--red)',
             netTrend != null ? 'Combined, vs last audit' : 'Needs a second audit')
      + tile('Weekly Status', `${wkCount} / 3 <span style="font-family:'Barlow',sans-serif;font-size:11px;color:var(--t3);font-weight:600;">this week</span>`,
             'var(--gold)',
             wkOverdue.length ? wkOverdue.join(', ') + ' overdue' : 'All systems updated this week',
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
      const scoreColor = score != null ? softScore(score) : 'var(--t4)';
      const daysLeft   = auditDaysLeft(audit);
      const canRun     = daysLeft <= 0;
      const btnLabel   = !audit ? 'Run First Audit' : 'Run Audit';

      // Action area: button when ready, countdown otherwise
      const actionHtml = canRun
        ? '<button class="hd-btn" onclick="S.Hub._enter(\'' + screen + '\',\'' + mod + '\')">' + btnLabel + '</button>'
        : '<div style="text-align:right;font-size:9px;color:var(--t3);font-weight:700;letter-spacing:0.07em;text-transform:uppercase;line-height:1.3;">'
          + 'Next Audit<br><span style="color:var(--t2);font-family:\'Barlow\',sans-serif;font-weight:700;font-size:12px;letter-spacing:0;text-transform:none;">in '
          + daysLeft + ' day' + (daysLeft===1?'':'s') + '</span></div>';

      // Score block: big number / 100 + industry/target line + bar with marker
      let scoreBlock;
      if (score != null) {
        const barPct = Math.max(0, Math.min(100, Math.round(score)));
        scoreBlock = ''
          + '<div style="display:flex;align-items:baseline;gap:12px;">'
          +   '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:34px;font-weight:700;color:' + scoreColor + ';line-height:1;">'
          +     score + '<span style="font-family:\'Barlow\',sans-serif;font-size:11px;color:var(--t3);font-weight:600;letter-spacing:0.04em;"> / 100</span></div>'
          +   '<div style="flex:1;font-size:10px;color:var(--t3);">Industry avg ' + indAvg + ' &middot; Your target 65+</div>'
          + '</div>'
          // Status bar shortened on the right so it clears the "Next Audit"
          // countdown / "Run Audit" button area (~85px wide on the right
          // edge of the row above). Bar still spans the score+industry text.
          + '<div style="margin-top:7px;margin-right:85px;">'
          +   '<div style="display:flex;height:6px;border-radius:4px;overflow:hidden;">'
          +     '<div style="width:50%;background:var(--red);"></div>'
          +     '<div style="width:20%;background:var(--amber);"></div>'
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

      // Combined summary line: leak status, trend vs last audit, audit date.
      // Was three stacked rows; now one inline row to free vertical space and
      // let the card breathe.
      let summaryLine = '';
      if (audit) {
        const monthly = (audit.action_items || []).reduce((s, a) => s + (a.monthly_impact || 0), 0);
        const weekly  = monthly / 4.345;
        const parts = [];
        if (weekly > 0) {
          parts.push('<span style="color:var(--t3);">Leaking <span style="color:var(--red-soft);font-weight:700;">~' + App.fmtCurrency(weekly, 0) + ' /wk</span></span>');
        } else {
          parts.push('<span style="color:var(--green);font-weight:700;">On target</span>');
        }
        if (trend != null) {
          parts.push('<span style="color:' + (trend>=0?'var(--green)':'var(--red)') + ';font-weight:700;">'
            + (trend>=0?'+':'') + trend + ' pts</span>');
        }
        if (audit.date) {
          parts.push('<span style="color:var(--t3);">since ' + shortDate(audit.date) + ' audit</span>');
        }
        summaryLine = '<div style="font-size:10px;color:var(--t3);margin-top:8px;line-height:1.4;">'
          + parts.join(' <span style="color:var(--t4);">&middot;</span> ')
          + '</div>';
      }

      return '<div style="padding:11px 0;' + (isFirst ? '' : 'border-top:1px solid var(--b2);') + '">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'
        +   '<div style="font-size:10px;font-weight:800;letter-spacing:0.18em;color:var(--t1);text-transform:uppercase;">' + name + '</div>'
        +   '<div style="flex-shrink:0;">' + actionHtml + '</div>'
        + '</div>'
        + scoreBlock
        + summaryLine
        + '</div>';
    };
    const auditPanel = `<div style="${PANEL}">${panelTitle('Audit Scores')}
      <div style="display:flex;flex-direction:column;justify-content:space-around;flex:1;">
        ${auditRow('Profit',  pA, sysTrend(pAudits), 'audit-tracker', 'profit',  true,  63)}
        ${auditRow('Revenue', rA, sysTrend(rAudits), 'r-audit',       'revenue', false, 61)}
        ${auditRow('Traffic', tA, sysTrend(tAudits), 't-audit',       'traffic', false, 58)}
      </div></div>`;

    // Recovery Scoreboard panel — cross-module headline number, sized to be
    // the visual hero of the dashboard. The receipt for the platform: total $
    // recovered across Profit, Revenue, and Traffic from every measured fix.
    const recoveryTotal = window.Recovery ? Recovery.total() : { dollars: 0, fixes: 0 };

    // Setup catch-up banner — shows above the dashboard whenever the Hub
    // Getting Started checklist is incomplete. One click opens the checklist
    // so the operator can pick up where they left off. Hides at 100% done.
    const setupTasks = (window.S && S.HubGettingStarted && S.HubGettingStarted.TASKS) || [];
    const setupProg  = data.hub_setup_progress || {};
    const setupDone  = setupTasks.filter(t => setupProg[t.id]).length;
    const setupTotal = setupTasks.length;
    const catchupBanner = (setupTotal > 0 && setupDone < setupTotal)
      ? '<div class="hub-catchup" style="background:rgba(219,171,70,0.10);border:1px solid rgba(219,171,70,0.35);border-radius:6px;padding:10px 16px;margin-bottom:18px;cursor:pointer;display:flex;align-items:center;gap:14px;">'
        + '<div style="flex-shrink:0;font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">Setup</div>'
        + '<div style="flex:1;font-size:12px;color:var(--t2);line-height:1.5;">'
        +   setupDone + ' of ' + setupTotal + ' setup tasks done. '
        +   '<span style="color:var(--gold);font-weight:700;">Continue setup</span>'
        + '</div>'
        + '<span style="flex-shrink:0;font-size:13px;color:var(--t3);">&#9656;</span>'
        + '</div>'
      : '';
    const fixLog = (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    const oldestFix = fixLog.map(e => e.date).filter(Boolean).sort()[0];
    const sinceTxt = oldestFix
      ? ' since ' + new Date(oldestFix + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : '';
    const recoveryPanel = `<div style="${PANEL}">${panelTitle('Recovery Scoreboard')}
      <div style="display:flex;flex-direction:column;justify-content:center;flex:1;gap:6px;">
        ${recoveryTotal.dollars > 0
          ? `<div style="font-family:'Barlow Condensed',sans-serif;font-size:52px;font-weight:700;color:var(--gold);line-height:1;letter-spacing:-0.01em;">${App.fmtCurrency(recoveryTotal.dollars, 0)}<span style="font-size:14px;color:var(--t3);font-weight:600;letter-spacing:0.04em;"> recovered</span></div>
             <div style="font-size:11px;color:var(--t3);">across ${recoveryTotal.fixes} measured fix${recoveryTotal.fixes === 1 ? '' : 'es'} in Profit, Revenue, and Traffic${sinceTxt}</div>`
          : `<div style="font-size:12px;color:var(--t3);line-height:1.55;">Mark fixes implemented in any Recovery module and the running total recovered shows here.</div>`
        }
      </div></div>`;

    // Key metrics panel — 6 tiles in a 3x2 grid (2 rows of 3). Tighter padding
    // and a 22px number so each tile fits in the shorter container that now
    // shares the middle column with the Recovery Scoreboard above it.
    const metricCells = metrics.map(m => `
      <div class="hd-metric" onclick="S.Hub._enter('${m.screen}','${m.mod}')">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--t3);">${m.label}</div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:700;line-height:1;color:${bandColor(m.status)};">${m.disp || '-'}</div>
        <div style="font-size:9px;color:var(--t4);">${m.disp ? 'Target ' + m.tgt : 'No data'}</div>
      </div>`).join('');
    const metricsPanel = `<div style="${PANEL}">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;flex:1;">${metricCells}</div></div>`;

    // Middle column stacks Recovery Scoreboard on top and Key Metrics below,
    // 50/50 split so the metric tiles get a usable but compact footprint.
    const middleColumn = `<div style="display:grid;grid-template-rows:1fr 1fr;gap:18px;min-height:0;">${recoveryPanel}${metricsPanel}</div>`;

    // Alerts panel — focal headline up top (big red count if alerts exist,
    // big green check + "All Clear" headline if not), then the alert rows
    // below as a clean list. Row styling matches the Priority Action Items
    // panel so the two list cards feel like a pair.
    let alertsPanel;
    if (alerts.length) {
      const alertRows = alerts.map((a,i) => {
        const isLast = i === alerts.length - 1;
        const dotCol = a.sev === 'bad' ? 'var(--red)' : 'var(--gold)';
        return '<div class="hd-row" onclick="S.Hub._enter(\'' + a.screen + '\',\'' + a.mod + '\')" '
          + 'style="display:flex;align-items:center;gap:10px;padding:9px 4px;'
          + (isLast ? '' : 'border-bottom:1px solid var(--b2);') + '">'
          + '<span style="width:8px;height:8px;border-radius:50%;background:' + dotCol + ';flex-shrink:0;"></span>'
          + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t1);line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(a.text) + '</div>'
          + '</div>';
      }).join('');
      const alertHead = '<div style="display:flex;align-items:baseline;gap:12px;padding-bottom:10px;margin-bottom:6px;border-bottom:1px solid var(--b2);flex-shrink:0;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:38px;font-weight:700;color:var(--red);line-height:1;">' + alerts.length + '</div>'
        + '<div style="font-size:11px;color:var(--t2);line-height:1.35;">'
        +   'metric' + (alerts.length===1?'':'s') + ' over target'
        +   '<div style="font-size:10px;color:var(--t3);margin-top:2px;">Address the worst-scoring first.</div>'
        + '</div></div>';
      // Holding-the-line counter: metrics tracked minus metrics flagged as
      // alerts. Quiet positive counterpoint, fills the panel's empty space
      // with productive context instead of dead air.
      const holdingCount = metrics.length - metricAlerts.length;
      const holdingHtml = holdingCount > 0
        ? '<div style="margin-top:auto;padding-top:10px;border-top:1px solid var(--b2);display:flex;align-items:center;gap:8px;flex-shrink:0;">'
          + '<span style="width:6px;height:6px;border-radius:50%;background:var(--green);flex-shrink:0;"></span>'
          + '<div style="font-size:10px;color:var(--t3);line-height:1.4;">' + holdingCount + ' metric' + (holdingCount === 1 ? '' : 's') + ' holding the line.</div>'
          + '</div>'
        : '';
      alertsPanel = `<div style="${PANEL}">${panelTitle('Alerts')}${alertHead}
        <div class="hd-scroll" style="flex:1;display:flex;flex-direction:column;">${alertRows}</div>${holdingHtml}</div>`;
    } else {
      const allClear = '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;">'
        + '<svg width="38" height="38" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="11" stroke="var(--green)" stroke-width="1.6"/><path d="M8 13l3.5 3.5L18 9" stroke="var(--green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        + '<div style="font-size:18px;font-weight:800;color:var(--green);letter-spacing:0.04em;">All Clear</div>'
        + '<div style="font-size:10px;color:var(--t3);line-height:1.4;max-width:240px;">No metrics are off target right now.</div>'
        + '</div>';
      alertsPanel = `<div style="${PANEL}">${panelTitle('Alerts')}${allClear}</div>`;
    }

    // Trend chart panel — three stacked mini charts: Bar Pour Cost %,
    // Check Average $, Prime Cost %. Each chart sits in its own bordered
    // card. Line stroke is tuned for the small chart size (1.7px) — the
    // module dashboards use 2.5 because those charts are 3x taller.
    // Fix-event markers (Section 10.5) ride on the bottom chart only so
    // they show up once instead of three times. Each data point carries
    // hover data attributes consumed by the shared tooltip below.
    const miniChart = (label, weeks, valueOf, target, valFmt, dir, withMarkers) => {
      const series   = weeks.map(w => valueOf(w));
      const lastVal  = [...series].reverse().find(v => v != null) ?? null;
      const status   = lastVal != null ? band(lastVal, target, dir) : 'none';
      const curColor = bandColor(status);
      const curDisp  = lastVal != null ? valFmt(lastVal) : '—';
      const tgtDisp  = valFmt(target);

      const card = (inner) => '<div style="border:1px solid var(--b2);border-radius:6px;padding:7px 10px;display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;">' + inner + '</div>';

      const head = '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:2px;flex-shrink:0;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);">' + label + '</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:17px;font-weight:700;color:' + curColor + ';line-height:1;">' + curDisp + '</div>'
        + '<div style="margin-left:auto;font-size:9px;color:var(--t4);">Target ' + tgtDisp + '</div>'
        + '</div>';

      const nonNull = series.filter(v => v != null);
      if (nonNull.length < 2) {
        return card(head
          + '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--t4);font-size:9px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">Need 2+ weeks</div>');
      }

      const W = 540, H = 54, P = { t:6, r:6, b:4, l:6 };
      const cw = W-P.l-P.r, ch = H-P.t-P.b;
      let mn = Math.min(...nonNull, target);
      let mx = Math.max(...nonNull, target);
      const sp = (mx-mn)*0.2 || 1; mn -= sp; mx += sp;
      const x = i => P.l + (series.length > 1 ? (i/(series.length-1))*cw : cw/2);
      const y = v => P.t + ch - ((v-mn)/(mx-mn||1))*ch;

      // Smooth path through non-null values; nulls keep their x slot so the
      // time axis stays honest, the path just skips them. Build the line
      // path and the area path (line + closure down to chart floor) in the
      // same pass; the area gets a vertical gradient fill that fades to
      // transparent, matching the audit score chart style.
      const baseY = (H-P.b).toFixed(1);
      let d = '', area = '';
      let prev = -1, lastX = null;
      for (let i = 0; i < series.length; i++) {
        const v = series[i];
        if (v == null) continue;
        const xi = x(i), yi = y(v);
        if (prev < 0) {
          d    = 'M' + xi.toFixed(1) + ',' + yi.toFixed(1);
          area = 'M' + xi.toFixed(1) + ',' + baseY + ' L' + xi.toFixed(1) + ',' + yi.toFixed(1);
        } else {
          const cp = (xi-x(prev))*0.35;
          const seg = ' C' + (x(prev)+cp).toFixed(1) + ',' + y(series[prev]).toFixed(1) + ' '
            + (xi-cp).toFixed(1) + ',' + yi.toFixed(1) + ' '
            + xi.toFixed(1) + ',' + yi.toFixed(1);
          d    += seg;
          area += seg;
        }
        lastX = xi;
        prev = i;
      }
      if (area) area += ' L' + lastX.toFixed(1) + ',' + baseY + ' Z';

      const gradId = 'hub-trend-' + label.replace(/[^a-z]/gi,'').toLowerCase();

      const tgtLine = '<line x1="'+P.l+'" y1="'+y(target).toFixed(1)+'" x2="'+(W-P.r)+'" y2="'+y(target).toFixed(1)+'" stroke="#DBAB46" stroke-width="0.7" stroke-dasharray="4,4" opacity="0.4"/>';

      // Dots render as HTML <div>s positioned absolutely over the SVG
      // (instead of <circle>s inside the SVG). The SVG uses
      // preserveAspectRatio="none" so the line stretches to fill the card,
      // but that same stretching squishes SVG circles into vertical ovals.
      // CSS-sized divs stay round regardless of how the SVG is scaled.
      const dots = series.map((v,i) => {
        if (v == null) return '';
        const xPct = (x(i) / W * 100).toFixed(2);
        const yPct = (y(v) / H * 100).toFixed(2);
        const wkRaw = weeks[i] && weeks[i].period_end;
        const wkDate = wkRaw ? (shortDate(wkRaw) || '').toUpperCase() : '';
        const dotBand = band(v, target, dir);
        return '<div class="hd-chart-dot"'
          + ' data-label="' + esc(label) + '"'
          + ' data-disp="' + esc(valFmt(v)) + '"'
          + ' data-tgt="' + esc(tgtDisp) + '"'
          + ' data-date="' + esc(wkDate) + '"'
          + ' data-band="' + dotBand + '"'
          + ' style="position:absolute;left:' + xPct + '%;top:' + yPct + '%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;">'
          + '<div class="hd-chart-marker"></div>'
          + '</div>';
      }).join('');

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

      // Trend chart is the dashboard's visual rest zone — muted gold line and
      // a barely-there area fill so the shape carries the story without
      // adding to the color noise. Status still comes through via the head
      // (current value in band color) and per-dot hover tooltips.
      return card(head
        + '<div style="position:relative;flex:1;min-height:0;">'
        +   '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" width="100%" height="100%" style="display:block;position:absolute;inset:0;">'
        +     '<defs><linearGradient id="'+gradId+'" x1="0" y1="0" x2="0" y2="1">'
        +       '<stop offset="0%" stop-color="#DBAB46" stop-opacity="0.08"/>'
        +       '<stop offset="100%" stop-color="#DBAB46" stop-opacity="0.005"/>'
        +     '</linearGradient></defs>'
        +     markerSvg
        +     tgtLine
        +     (area ? '<path d="'+area+'" fill="url(#'+gradId+')"/>' : '')
        +     '<path d="'+d+'" fill="none" stroke="rgba(219,171,70,0.7)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
        +   '</svg>'
        +   dots
        + '</div>');
    };

    const w8p = pWeeks.slice(-8);
    const w8r = rWeeks.slice(-8);
    const pourSeries  = w8p.map(w => w?.bar?.cost_pct ?? null);
    const caSeries    = w8r.map(w => w?.check_avg ?? null);
    const primeSeries = w8p.map(w => w?.prime_cost_pct ?? null);
    const anyTrend = pourSeries.filter(v=>v!=null).length >= 2
                  || caSeries.filter(v=>v!=null).length >= 2
                  || primeSeries.filter(v=>v!=null).length >= 2;

    let trendBody;
    if (!anyTrend) {
      trendBody = '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--t4);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Enter 2+ weeks to see trends</div>';
    } else {
      trendBody = ''
        + miniChart('Bar Pour Cost %', w8p, w => w?.bar?.cost_pct ?? null,    pourT,  v => v.toFixed(1) + '%', 'low',  false)
        + miniChart('Check Average',   w8r, w => w?.check_avg ?? null,        caT,    v => App.fmtCurrency(v), 'high', false)
        + miniChart('Prime Cost %',    w8p, w => w?.prime_cost_pct ?? null,   primeT, v => v.toFixed(1) + '%', 'low',  false);
    }
    const chartSubtitle = '<div style="font-size:9px;color:var(--t4);margin-bottom:6px;flex-shrink:0;text-align:right;">Last 8 weeks</div>';
    const chartPanel = `<div style="${PANEL}">${panelTitle('Cost & Revenue Trend')}${chartSubtitle}
      <div style="flex:1;display:flex;flex-direction:column;gap:6px;overflow:hidden;">${trendBody}</div></div>`;

    // Priority Action Items panel — dollar amount is the magnet (big gold
    // Barlow Condensed on the left), then a small module badge above the
    // action text on the right. Row styling matches the Alerts panel so the
    // two list cards feel like a pair.
    const actionBody = topItems.length
      ? topItems.map((it,i) => {
          const isLast = i === topItems.length - 1;
          const dollar = it.impact > 0 ? App.fmtCurrency(it.impact, 0) : '—';
          const modBadgeColors = {
            Profit:  { c: 'var(--gold)',  bg: 'var(--gold-bg)'  },
            Revenue: { c: 'var(--green)', bg: 'var(--green-bg)' },
            Traffic: { c: 'var(--blue)',  bg: 'var(--blue-bg)'  }
          };
          const mc = modBadgeColors[it.sys] || modBadgeColors.Profit;
          return '<div class="hd-row" onclick="S.Hub._enterFix(\'' + it.mod + '\',' + (it.gap ? '\'' + it.gap + '\'' : 'null') + ')" '
            + 'style="display:flex;align-items:center;gap:14px;padding:10px 4px;'
            + (isLast ? '' : 'border-bottom:1px solid var(--b2);') + '">'
            + '<div style="flex-shrink:0;min-width:65px;white-space:nowrap;">'
            +   '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:19px;font-weight:700;color:var(--gold);line-height:1;">' + dollar + '</span>'
            +   (it.impact > 0 ? '<span style="font-size:9px;color:var(--t3);font-weight:600;margin-left:2px;">/mo</span>' : '')
            + '</div>'
            + '<div style="flex:1;min-width:0;font-size:11px;line-height:1.45;">'
            +   '<span style="font-size:9px;font-weight:800;letter-spacing:0.1em;color:' + mc.c + ';">' + it.sys.toUpperCase() + '</span>'
            +   '<span style="color:var(--t3);"> &middot; </span>'
            +   '<span style="color:var(--t1);">' + esc(it.action) + '</span>'
            + '</div>'
            + '</div>';
        }).join('')
      : `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--t3);font-size:11px;text-align:center;line-height:1.5;padding:0 20px;">Run an audit in any system and your highest-impact opportunities will be ranked here.</div>`;
    const overflowFooter = overflowItems > 0
      ? '<div style="margin-top:auto;padding-top:10px;border-top:1px solid var(--b2);font-size:10px;color:var(--t3);text-align:center;flex-shrink:0;">+ ' + overflowItems + ' more action item' + (overflowItems === 1 ? '' : 's') + ' across your audits</div>'
      : '';
    const actionPanel = `<div style="${PANEL}">${panelTitle('Priority Action Items')}
      <div class="hd-scroll" style="flex:1;display:flex;flex-direction:column;">${actionBody}</div>${overflowFooter}</div>`;

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
      const shown = readout.items.slice(0, 50);
      const roRows = shown.map((it, i) => {
        const isLast = i === shown.length - 1;
        return '<div class="hd-row" onclick="S.Hub._enterFix(\'' + it.module + '\',\'' + esc(it.gapId) + '\')"'
          + ' style="display:flex;align-items:center;gap:10px;padding:9px 4px;'
          + (isLast ? '' : 'border-bottom:1px solid var(--b2);') + '">'
          + modBadge(it.module)
          + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(it.label) + '</div>'
          + '<div style="flex-shrink:0;font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:var(--t1);">' + App.fmtCurrency(it.weekly, 0) + '<span style="font-family:\'Barlow\',sans-serif;font-size:9px;color:var(--t3);font-weight:600;margin-left:2px;">/wk</span></div>'
          + '</div>';
      }).join('');
      readoutBody = ''
        + '<div style="display:flex;align-items:baseline;gap:10px;">'
        +   '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:38px;font-weight:700;color:var(--red);line-height:1;">' + App.fmtCurrency(readout.total, 0) + '</div>'
        +   '<div style="font-size:11px;color:var(--t3);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">/ week</div>'
        + '</div>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:5px;">'
        +   App.fmtCurrency(readout.total * 52, 0) + ' annualized at this pace '
        +   '<span style="color:var(--t4);">&middot;</span> '
        +   'across ' + readout.items.length + ' gap area' + (readout.items.length === 1 ? '' : 's')
        + '</div>'
        + '<div class="hd-scroll" style="margin-top:12px;flex:1;display:flex;flex-direction:column;">' + roRows + '</div>';
    }
    const readoutPanel = `<div style="${PANEL}">${panelTitle('Leaking This Week')}${readoutBody}</div>`;

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
      mail:    '<rect x="2.2" y="4" width="12.6" height="9" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M2.2 4.5l6.3 4.5 6.3-4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
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
      + navItem('getting-started',  'Getting Started', 'getStart', [])
      + navItem('help',             'Help and FAQ',    'help',     [])
      + navItem('contact-support',  'Contact Us',      'mail',     [])
      + '<div class="nav-section">System</div>'
      + navItem('settings',         'App Settings',    'settings', [])
      + navItem('user-accounts',    'User Accounts',   'settings', [])
      + navItem('report-bug',       'Report a Bug',    'bug',      []);

    const collapsedClass = this._sidebarCollapsed ? ' sidebar-collapsed' : '';

    // ── Compose ──
    // Reuses the same .app / .sidebar / .topbar / .content classes as the
    // module shells so the Hub sidebar matches them exactly in width, logo
    // area, collapse behavior, and visual styling. The .hub-app class adds
    // hub-specific overrides for the fixed-viewport dashboard layout.
    container.innerHTML = `
      <style>
        .hub-app{min-height:100% !important;}
        .hub-app .content{padding:24px;min-width:0;}
        .hub-app .nav-item.nav-disabled{cursor:default;opacity:0.45;}
        .hub-app .nav-item.nav-disabled:hover{background:transparent;}
        .hub-app .nav-item.nav-disabled .nav-icon{color:var(--t4);}
        .hub-app .hd-metric{background:var(--panel);padding:8px 10px;border:1px solid var(--b2);border-radius:6px;cursor:pointer;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:3px;transition:border-color 0.12s;}
        .hub-app .hd-metric:hover{border-color:var(--b-edge);}
        .hub-app .hd-row{cursor:pointer;}
        .hub-app .hd-row:hover{background:rgba(255,255,255,0.03);}
        .hub-app .hd-btn{background:none;border:1px solid rgba(255,255,255,0.12);color:var(--t2);font-size:9px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;padding:5px 9px;border-radius:4px;cursor:pointer;white-space:nowrap;}
        .hub-app .hd-btn:hover{border-color:var(--gold);color:var(--gold);}
        /* Card-internal scroll for list panels (alerts, PAI, weekly readout)
           when row count exceeds card height. Thin scrollbar so it does not
           visually overwhelm the small lists. */
        .hub-app .hd-scroll{overflow-y:auto;}
        .hub-app .hd-scroll::-webkit-scrollbar{width:6px;}
        .hub-app .hd-scroll::-webkit-scrollbar-track{background:transparent;}
        .hub-app .hd-scroll::-webkit-scrollbar-thumb{background:var(--b2);border-radius:3px;}
        .hub-app .hd-scroll::-webkit-scrollbar-thumb:hover{background:var(--b1);}
        /* Trend chart data point hover — the marker grows on hover so the
           interaction reads as "this dot does something." */
        .hub-app .hd-chart-marker{width:5px;height:5px;border-radius:50%;background:rgba(219,171,70,0.55);transition:width 0.12s ease,height 0.12s ease,background 0.12s ease;}
        .hub-app .hd-chart-dot:hover .hd-chart-marker{width:8px;height:8px;background:rgba(219,171,70,0.9);}
        /* Shared tooltip element used by all three mini charts. Lives as a
           sibling of .hub-app inside the wrapper, so the selector has no
           ancestor — otherwise display:block would force the empty div into
           flow and ratchet the dashboard. */
        #hd-chart-tip{
          position:fixed;z-index:200;pointer-events:none;display:none;
          background:var(--surface);border:1px solid var(--b-edge);border-radius:5px;
          padding:8px 12px;min-width:140px;
          font-family:Barlow,sans-serif;font-size:11px;color:var(--t1);
          box-shadow:0 4px 14px rgba(0,0,0,0.45);
        }
      </style>
      <div id="hd-chart-tip"></div>
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
            <div id="hub-topbar-account-switcher" style="display:none;"></div>
            <div class="topbar-right">
              <span style="font-size:10px;color:var(--t4);">${lastUpdatedTxt}</span>
            </div>
          </header>
          <main class="content">
            ${catchupBanner}
            <div style="display:grid;grid-template-rows:auto 470px 510px;gap:18px;padding-bottom:18px;">
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px;">${tiles}</div>
              <div style="display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:18px;">${auditPanel}${middleColumn}${readoutPanel}</div>
              <div style="display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:18px;">${alertsPanel}${chartPanel}${actionPanel}</div>
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

    container.querySelector('.hub-catchup')?.addEventListener('click', () => {
      if (window.S && S.HubGettingStarted) S.HubGettingStarted.open();
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
      else if (action === 'user-accounts')   S.HubUserAccounts.open();
      else if (action === 'contact-support') S.HubSupport.open();
      else if (action === 'report-bug')      S.HubReportBug.open();
    });

    // Trend chart data point hover — populate and position the shared
    // tooltip with the dot's week, value, status, and target.
    const tip = container.querySelector('#hd-chart-tip');
    if (tip) {
      const bandText = { good: 'on target', warn: 'watch', bad: 'off target' };
      const bandCol  = { good: 'var(--green)', warn: 'var(--amber)', bad: 'var(--red)' };
      container.querySelectorAll('.hd-chart-dot').forEach(g => {
        g.addEventListener('mouseenter', () => {
          const r  = g.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const b  = g.dataset.band || 'none';
          const col = bandCol[b] || 'var(--t1)';
          tip.innerHTML =
              '<div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);">Week Ending ' + g.dataset.date + '</div>'
            + '<div style="display:flex;align-items:baseline;gap:10px;margin-top:5px;">'
            +   '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:20px;font-weight:700;color:' + col + ';line-height:1;">' + g.dataset.disp + '</div>'
            +   (bandText[b] ? '<div style="font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:' + col + ';">' + bandText[b] + '</div>' : '')
            + '</div>'
            + '<div style="font-size:10px;color:var(--t3);margin-top:4px;">Target ' + g.dataset.tgt + '</div>';
          tip.style.left = cx + 'px';
          tip.style.top  = (cy - 12) + 'px';
          tip.style.transform = 'translate(-50%, -100%)';
          tip.style.display = 'block';
        });
        g.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
      });
    }

  },

  _enter(screen, module) { App.showApp(module || 'profit'); App.navigate(screen); },

  // Deep-link from the weekly readout into a module's Fix screen at a gap-area.
  _enterFix(module, gapId) {
    App.showApp(module || 'profit');
    if (gapId) App._fixFocus = gapId;
    const scr = module === 'revenue' ? 'r-fix'
              : module === 'traffic' ? 't-fix'
              : 'profit-fix';
    App.navigate(scr);
  },

  /* Weekly money readout (Section 10.3) — what is leaking this week, where, and
     biggest first. Profit and Revenue read live from Recovery.gapImpact (same
     engine the dashboards use). Traffic doesn't have weekly dollar-quantifiable
     live metrics, so its leak figures come from the latest traffic_audit's
     action_items.monthly_impact divided by 4.345. A gap-area only counts when
     its weekly dollar loss computes from real data. */
  weeklyReadout() {
    if (!window.Recovery || !window.FIX) return { items: [], total: 0 };
    const seen = {};
    const items = [];

    // Profit + Revenue — live metric-based
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

    // Traffic — audit-based. Map each action item to its traffic gap-area
    // and use the gap's short name as the label, so the readout stays
    // consistent with the noun-phrase labels Profit and Revenue produce
    // (e.g. "Reviews" not "Close the review velocity and response gap").
    const tA = ((App.data || {}).traffic_audits || []).slice(-1)[0];
    if (tA && Array.isArray(tA.action_items)) {
      const hints = [
        { rx: /google business|gbp/i,           id: 'gbp' },
        { rx: /website|bounce|conversion/i,     id: 'website' },
        { rx: /review/i,                        id: 'reviews' },
        { rx: /search|seo|maps pack|nap/i,      id: 'search-seo' },
        { rx: /social|instagram|facebook|post/i, id: 'social' },
        { rx: /delivery|doordash|uber/i,        id: 'delivery' },
        { rx: /email|loyalty/i,                 id: 'email-loyalty' }
      ];
      const trafficGaps = (window.FIX && FIX.traffic) || [];
      tA.action_items.forEach(it => {
        if (!it || !(it.monthly_impact > 0)) return;
        const raw = it.action || '';
        const hint = hints.find(h => h.rx.test(raw));
        const gapId = hint ? hint.id : 'gbp';
        const gap   = trafficGaps.find(g => g.id === gapId);
        const label = gap ? gap.name : 'Traffic';
        if (seen[label]) return;
        seen[label] = true;
        items.push({ label, gapId, module: 'traffic',
                     weekly: it.monthly_impact / 4.345, band: 'over' });
      });
    }

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

    // 3b. Review response rate below target — guests see unanswered reviews
    // long after they're posted. Response rate is a Traffic target.
    const tTar = (data.traffic_settings || {}).targets || {};
    const respTarget = tTar.response_rate ?? 75;
    if (tw.length) {
      const latestT = tw[tw.length - 1];
      if (latestT && latestT.response_rate != null && latestT.response_rate < respTarget) {
        const gap = respTarget - latestT.response_rate;
        out.push({
          sev: gap > 20 ? 'bad' : 'warn',
          text: 'Review response rate at ' + latestT.response_rate + '%, ' + gap.toFixed(0) + ' points under your ' + respTarget + '% target. Unanswered reviews are visible to every guest searching you.',
          screen: 't-reviews', mod: 'traffic'
        });
      }
    }

    // 3b-2. New reviews below absolute target — a Traffic target, separate from
    // the relative "velocity sliding" check above. Catches the operator who
    // has been consistently low rather than recently dropping.
    const velTarget = tTar.review_velocity ?? 8;
    if (tw.length) {
      const latestT = tw[tw.length - 1];
      if (latestT && latestT.new_reviews != null && latestT.new_reviews < velTarget) {
        const gap = velTarget - latestT.new_reviews;
        out.push({
          sev: latestT.new_reviews < velTarget / 2 ? 'bad' : 'warn',
          text: 'New reviews running at ' + latestT.new_reviews + ' a month, ' + gap + ' below your ' + velTarget + '/month target. Ask satisfied guests this week to close the gap.',
          screen: 't-reviews', mod: 'traffic'
        });
      }
    }

    // 3b-3. Traffic data going stale — the latest logged period is more than
    // 10 days old. The dashboard stops being useful once data ages out.
    if (tw.length) {
      const latestT = tw[tw.length - 1];
      if (latestT && latestT.period_end) {
        const dt = new Date(String(latestT.period_end).length <= 10 ? latestT.period_end + 'T00:00:00' : latestT.period_end);
        const age = isNaN(dt.getTime()) ? null : Math.floor((Date.now() - dt.getTime()) / 86400000);
        if (age != null && age > 10) {
          out.push({
            sev: 'warn',
            text: 'Traffic data is ' + age + ' days old. Log this week in This Week so the trend stays current.',
            screen: 't-this-week', mod: 'traffic'
          });
        }
      }
    }

    // 3d. No marketing emails logged this period — a list you never email
    // goes cold within 30 days.
    if (tw.length) {
      const latestT = tw[tw.length - 1];
      if (latestT && latestT.email_list_size && (!latestT.emails_sent || latestT.emails_sent === 0)) {
        out.push({
          sev: 'warn',
          text: 'No marketing emails sent this period against a list of ' + latestT.email_list_size + '. A list you never email goes cold inside 30 days.',
          screen: 't-email', mod: 'traffic'
        });
      }
    }

    // 3c. Social posting frequency below benchmark — quiet feeds lose
    // discovery on Instagram and Facebook fast.
    const postTarget = tTar.social_posts_month ?? 12;
    if (tw.length) {
      const latestT = tw[tw.length - 1];
      if (latestT && latestT.ig_posts_month != null && latestT.ig_posts_month < postTarget * 0.7) {
        out.push({
          sev: latestT.ig_posts_month < postTarget * 0.4 ? 'bad' : 'warn',
          text: 'Instagram posting ran ' + latestT.ig_posts_month + ' posts this period vs your ' + postTarget + '/month target. Quiet feeds lose the discovery algorithm fast.',
          screen: 't-social', mod: 'traffic'
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
