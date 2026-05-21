'use strict';

S.Hub = {

  AUDIT_STALE: 35,        // days before an audit is flagged stale
  WEEKLY_STALE: 14,       // days before a weekly entry is flagged stale
  WEEKLY_TILE_CUTOFF: 8,  // days within which a module counts as "this week"

  render(container) {
    const data = App.data || {};

    // ── Data sources ──
    const pWeeks  = data.weeks || [];
    const rWeeks  = (data.revenue_weeks || []).filter(w => (w.bar_revenue||0)+(w.floor_revenue||0) > 0);
    const tWeeks  = data.traffic_weeks || [];
    const pAudits = data.audits || [];
    const rAudits = data.revenue_audits || [];
    const tAudits = data.traffic_audits || [];

    const barName = data.settings?.bar_name || 'Your Operation';

    const last  = arr => arr.length ? arr[arr.length - 1] : null;
    const prior = arr => arr.length >= 2 ? arr[arr.length - 2] : null;

    // ── Helpers ──
    const daysSince = (str) => {
      if (!str) return null;
      const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
      if (isNaN(d.getTime())) return null;
      return Math.floor((Date.now() - d.getTime()) / 86400000);
    };
    const auditOpp = (a) => a ? (a.action_items || []).reduce((s,x) => s + (x.monthly_impact || 0), 0) : 0;
    const ago = (d) => d <= 0 ? 'today' : d === 1 ? '1 day ago' : d + ' days ago';

    // ── Cross-system rollup ──
    const pA = last(pAudits), rA = last(rAudits), tA = last(tAudits);
    const sysScores = [pA, rA, tA].map(a => a ? a.overall_score : null).filter(v => v != null);
    const overall   = sysScores.length ? Math.round(sysScores.reduce((a,b)=>a+b,0)/sysScores.length) : null;
    const anyAudit  = !!(pAudits.length || rAudits.length || tAudits.length);
    const totalOpp  = auditOpp(pA) + auditOpp(rA) + auditOpp(tA);

    const sysTrend = (audits) => {
      const l = last(audits), p = prior(audits);
      return (l && p) ? (l.overall_score||0) - (p.overall_score||0) : null;
    };
    const trendList = [sysTrend(pAudits), sysTrend(rAudits), sysTrend(tAudits)].filter(v => v != null);
    const netTrend  = trendList.length ? trendList.reduce((a,b)=>a+b,0) : null;

    // ── Weekly status ──
    const wkMods = [
      { name:'Profit',  days: daysSince(last(pWeeks)?.period_end) },
      { name:'Revenue', days: daysSince(last(rWeeks)?.period_end) },
      { name:'Traffic', days: daysSince(last(tWeeks)?.period_end) },
    ].map(m => ({ ...m, current: m.days != null && m.days <= this.WEEKLY_TILE_CUTOFF }));
    const wkCount   = wkMods.filter(m => m.current).length;
    const wkOverdue = wkMods.filter(m => !m.current).map(m => m.name);

    // ── Audit-overdue nudge (only for systems with an aging prior audit) ──
    const auditOverdue = [];
    [['Profit',pAudits],['Revenue',rAudits],['Traffic',tAudits]].forEach(([n,a]) => {
      const d = daysSince(last(a)?.date);
      if (d != null && d > this.AUDIT_STALE) auditOverdue.push(n);
    });

    // ── UI builders ──
    const ring = (score, size = 72) => {
      if (score == null) return `<div style="width:${size}px;height:${size}px;border-radius:50%;border:3px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:10px;color:var(--t3);text-align:center;line-height:1.3;">No<br>Data</span></div>`;
      const r = (size/2)-7, circ = 2*Math.PI*r, dash = (Math.min(score,100)/100)*circ;
      const col = App.scoreHex(score);
      return `<div style="position:relative;width:${size}px;height:${size}px;flex-shrink:0;"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg);"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="4"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${col}" stroke-width="4" stroke-dasharray="${dash} ${circ}" stroke-linecap="round"/></svg><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><span style="font-size:18px;font-weight:800;color:${col};line-height:1;">${score}</span></div></div>`;
    };

    const trendPill = (val) => {
      if (val == null) return `<span style="font-size:11px;color:var(--t3);">No prior audit yet</span>`;
      const up = val >= 0;
      return `<span style="font-size:11px;font-weight:700;color:${up?'#C9A84C':'#C03828'};background:${up?'rgba(201,168,76,0.12)':'rgba(192,56,40,0.12)'};padding:2px 8px;border-radius:3px;">${up?'+':''}${val} pts vs last audit</span>`;
    };

    const stat = (l,v) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="font-size:12px;color:var(--t3);">${l}</span><span style="font-size:12px;font-weight:600;color:var(--t2);">${v}</span></div>`;

    const freshSeg = (label, days, staleAt, noneText) => {
      const stale = days == null || days > staleAt;
      const txt = days == null ? noneText : label + ' ' + ago(days);
      return `<span style="color:${stale?'var(--gold)':'var(--t3)'};">${txt}</span>`;
    };
    const freshnessLine = (audits, weeks) =>
      `<div style="font-size:11px;font-weight:600;display:flex;align-items:center;gap:9px;margin-bottom:14px;">`
      + freshSeg('Audit', daysSince(last(audits)?.date), this.AUDIT_STALE, 'No audit yet')
      + `<span style="color:var(--t4);">&middot;</span>`
      + freshSeg('Weekly entry', daysSince(last(weeks)?.period_end), this.WEEKLY_STALE, 'No weekly data')
      + `</div>`;

    const CARD_STYLE = `background:var(--surface);border-radius:10px;padding:24px;display:flex;flex-direction:column;height:392px;overflow:hidden;min-width:0;border:1px solid rgba(201,168,76,0.4);box-shadow:0 0 24px rgba(201,168,76,0.05);`;

    const systemCard = (title, desc, score, trend, stats, freshness, enterScreen, mod) => `
      <div style="${CARD_STYLE}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">
          <div style="flex:1;padding-right:12px;">
            <div style="display:flex;align-items:center;margin-bottom:6px;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#C9A84C;margin-right:6px;flex-shrink:0;"></span><span style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);">Active</span></div>
            <div style="font-size:15px;font-weight:800;color:var(--t1);margin-bottom:5px;">${title}</div>
            <div style="font-size:12px;color:var(--t3);line-height:1.5;min-height:54px;">${desc}</div>
          </div>
          ${ring(score)}
        </div>
        <div style="height:22px;margin-bottom:10px;">${trendPill(trend)}</div>
        <div style="flex:1;">${stats}</div>
        ${freshness}
        <button class="btn btn-primary" style="width:100%;font-size:13px;font-weight:700;padding:11px 16px;" onclick="S.Hub._enter('${enterScreen}','${mod}')">Enter ${title}</button>
      </div>`;

    // ── System card stats (real fields only) ──
    const pW = last(pWeeks), rW = last(rWeeks), tW = last(tWeeks);

    const profitStats =
        stat('Bar Pour Cost', pW?.bar?.cost_pct != null ? App.fmtPct(pW.bar.cost_pct) : 'No data')
      + stat('Prime Cost',    pW?.prime_cost_pct != null ? App.fmtPct(pW.prime_cost_pct) : 'No data')
      + stat('Monthly Opportunity', pA ? App.fmtCurrency(auditOpp(pA),0) : 'No data');

    const revenueStats =
        stat('Check Average', rW?.check_avg != null ? App.fmtCurrency(rW.check_avg) : 'No data')
      + stat('Labor Cost %',  rW?.labor_pct_blended != null ? App.fmtPct(rW.labor_pct_blended) : 'No data')
      + stat('Monthly Opportunity', rA ? App.fmtCurrency(auditOpp(rA),0) : 'No data');

    const trafficStats =
        stat('Google Rating',  tW?.google_rating != null ? tW.google_rating.toFixed(1) + ' / 5.0' : 'No data')
      + stat('New Reviews/Mo', tW?.new_reviews != null ? tW.new_reviews + ' reviews' : 'No data')
      + stat('Monthly Opportunity', tA ? App.fmtCurrency(auditOpp(tA),0) : 'No data');

    const cards =
        systemCard('Profit Recovery',  'Pour cost, food cost, theft, inventory variance, vendor pricing and cash control.', pA?.overall_score ?? null, sysTrend(pAudits), profitStats,  freshnessLine(pAudits,pWeeks), 'dashboard',   'profit')
      + systemCard('Revenue Recovery', 'Menu engineering, pricing strategy, server performance, labor efficiency and events.', rA?.overall_score ?? null, sysTrend(rAudits), revenueStats, freshnessLine(rAudits,rWeeks), 'r-dashboard', 'revenue')
      + systemCard('Traffic Recovery', 'Google presence, online menu, reviews, social media, delivery platforms and digital visibility.', tA?.overall_score ?? null, sysTrend(tAudits), trafficStats, freshnessLine(tAudits,tWeeks), 't-dashboard', 'traffic');

    // ── Rollup strip tiles ──
    const tileInner = (label, big, bigColor, sub, subColor) =>
        `<div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">${label}</div>`
      + `<div style="font-size:26px;font-weight:800;line-height:1;color:${bigColor};">${big}</div>`
      + `<div style="font-size:11px;color:${subColor||'var(--t3)'};margin-top:7px;min-height:14px;">${sub||''}</div>`;

    const tile1 = tileInner(
      'Overall Recovery Score',
      overall != null ? overall : 'None',
      overall != null ? App.scoreHex(overall) : 'var(--t4)',
      overall != null ? App.scoreLabel(overall) + ' &middot; ' + sysScores.length + ' of 3 audited' : 'No audits run yet');

    const tile2 = tileInner(
      'Total Monthly Opportunity',
      anyAudit ? App.fmtCurrency(totalOpp,0) : 'No data',
      anyAudit && totalOpp > 0 ? '#C03828' : 'var(--t4)',
      anyAudit ? 'Recoverable across audited systems' : 'Run an audit to surface this');

    const tile3 = tileInner(
      'Score Trend',
      netTrend != null ? (netTrend >= 0 ? '+' : '') + netTrend + ' pts' : 'No data',
      netTrend == null ? 'var(--t4)' : netTrend >= 0 ? '#C9A84C' : '#C03828',
      netTrend != null ? 'Combined, vs last audit' : 'Needs a second audit');

    const tile4 = tileInner(
      'Weekly Status',
      `${wkCount} / 3 <span style="font-size:13px;color:var(--t3);font-weight:400;">this week</span>`,
      wkCount === 3 ? '#C9A84C' : 'var(--t1)',
      wkOverdue.length ? wkOverdue.join(', ') + ' overdue' : 'All modules entered this week',
      wkOverdue.length ? '#C03828' : 'var(--t3)');

    // ── Priority Action Items (merged, ranked) ──
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

    const chip = (txt) => `<span style="font-size:9px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--gold);background:rgba(201,168,76,0.12);padding:3px 7px;border-radius:3px;flex-shrink:0;">${txt}</span>`;
    const chevron = `<svg width="7" height="11" viewBox="0 0 7 11" fill="none" style="flex-shrink:0;"><path d="M1 1l5 4.5L1 10" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    const PANEL = `width:100%;max-width:920px;background:var(--surface);border:1px solid rgba(255,255,255,0.08);border-radius:10px;`;

    const actionItemsCard = topItems.length
      ? `<div style="${PANEL}padding:22px 26px;margin-bottom:24px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Priority Action Items</div>
          <div style="font-size:13px;color:var(--t3);margin-bottom:16px;line-height:1.5;">Your highest-impact opportunities across all three systems, ranked by monthly dollar impact.</div>
          ${topItems.map((it,i) => `
            <div onclick="S.Hub._enter('${it.screen}','${it.mod}')" style="display:flex;align-items:center;gap:12px;padding:12px 0;${i < topItems.length-1 ? 'border-bottom:1px solid rgba(255,255,255,0.05);' : ''}cursor:pointer;">
              ${chip(it.sys)}
              <div style="flex:1;font-size:13px;color:var(--t2);line-height:1.45;min-width:0;">${esc(it.action)}</div>
              ${it.impact > 0 ? `<div style="font-size:13px;font-weight:800;color:var(--gold);flex-shrink:0;white-space:nowrap;">${App.fmtCurrency(it.impact,0)}/mo</div>` : ''}
              ${chevron}
            </div>`).join('')}
        </div>`
      : `<div style="${PANEL}padding:22px 26px;margin-bottom:24px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Priority Action Items</div>
          <div style="font-size:13px;color:var(--t3);line-height:1.6;">Run an audit in any system and your highest-impact opportunities will be ranked here by monthly dollar value.</div>
        </div>`;

    // ── Audit-overdue nudge ──
    const nudge = auditOverdue.length
      ? `<div style="width:100%;max-width:920px;background:var(--surface);border:1px solid rgba(201,168,76,0.13);border-radius:10px;padding:18px 24px;display:flex;align-items:flex-start;gap:14px;margin-bottom:16px;">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;margin-top:1px;"><circle cx="8" cy="8" r="7" stroke="rgba(201,168,76,0.55)" stroke-width="1.2"/><path d="M8 4.5v4.5M8 12v.5" stroke="rgba(201,168,76,0.75)" stroke-width="1.4" stroke-linecap="round"/></svg>
          <div style="font-size:13px;color:var(--t2);line-height:1.6;">${auditOverdue.join(' and ')} ${auditOverdue.length > 1 ? 'audits are' : 'audit is'} more than ${this.AUDIT_STALE} days old. Run a fresh audit to keep your recovery numbers accurate.</div>
        </div>`
      : '';

    // ── Last-updated timestamp ──
    const stamps = [];
    [pWeeks,rWeeks,tWeeks].forEach(arr => arr.forEach(w => { if (w && w.saved_at) stamps.push(w.saved_at); }));
    const prof = data.traffic_settings?.profile || {};
    ['gbp_reviewed_at','search_reviewed_at','web_reviewed_at','rev_reviewed_at','social_reviewed_at','delivery_reviewed_at','email_reviewed_at']
      .forEach(k => { if (prof[k]) stamps.push(prof[k]); });
    [pAudits,rAudits,tAudits].forEach(arr => arr.forEach(a => { if (a && a.date) stamps.push(a.date); }));

    let lastStamp = null, lastT = -1;
    stamps.forEach(s => {
      const t = new Date(String(s).length <= 10 ? s + 'T00:00:00' : s).getTime();
      if (!isNaN(t) && t > lastT) { lastT = t; lastStamp = s; }
    });
    const fmtStamp = (s) => {
      const dateOnly = String(s).length <= 10;
      const d = new Date(dateOnly ? s + 'T00:00:00' : s);
      if (isNaN(d.getTime())) return null;
      const sameDay = d.toDateString() === new Date().toDateString();
      const datePart = sameDay ? 'today' : d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
      return dateOnly ? datePart : datePart + ' at ' + d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    };
    const lastUpdatedTxt = lastStamp ? 'Data last updated: ' + fmtStamp(lastStamp) : 'No data entered yet';

    // ── Compose ──
    container.innerHTML = `
      <div style="min-height:100vh;background:var(--bg);display:flex;flex-direction:column;align-items:center;padding:40px 24px 60px;overflow-y:auto;">

        <div style="text-align:center;margin-bottom:36px;">
          <img src="assets/logo.png" alt="Bar Cop" style="height:38px;margin-bottom:18px;opacity:0.93;"/>
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;color:var(--t3);text-transform:uppercase;margin-bottom:8px;">Recovery Platform</div>
          <div style="font-size:22px;font-weight:800;color:var(--t1);letter-spacing:-0.01em;">${esc(barName)}</div>
        </div>

        <div style="width:100%;max-width:920px;background:var(--surface);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:22px 32px;margin-bottom:24px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
          <div>${tile1}</div>
          <div style="border-left:1px solid rgba(255,255,255,0.07);padding-left:20px;">${tile2}</div>
          <div style="border-left:1px solid rgba(255,255,255,0.07);padding-left:20px;">${tile3}</div>
          <div style="border-left:1px solid rgba(255,255,255,0.07);padding-left:20px;">${tile4}</div>
        </div>

        <div style="width:100%;max-width:920px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
          ${cards}
        </div>

        ${actionItemsCard}

        ${nudge}

        <div style="width:100%;max-width:920px;display:flex;justify-content:space-between;align-items:center;padding:4px 0 8px;">
          <span style="font-size:11px;color:var(--t4);">${lastUpdatedTxt}</span>
          <button id="hub-signout" style="background:none;border:none;color:var(--t3);font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;padding:4px 0;">Sign Out</button>
        </div>

      </div>
    `;

    document.getElementById('hub-signout')?.addEventListener('click', async () => { await DB.signOut(); });
  },

  _enter(screen, module) { App.showApp(module || 'profit'); App.navigate(screen); }

};
