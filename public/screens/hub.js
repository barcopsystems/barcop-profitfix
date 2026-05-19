'use strict';

S.Hub = {

  render(container) {
    const sub     = App.subscription || {};
    const modules = sub.active_modules || [];
    const hasP    = modules.includes('profit');
    const hasR    = modules.includes('revenue');
    const hasT    = modules.includes('traffic');

    const data        = App.data || {};
    const weeks       = data.weeks || [];
    const audits      = data.audits || [];
    const latest      = weeks.length ? weeks[weeks.length - 1] : null;
    const latestAudit = audits.length ? audits[audits.length - 1] : null;
    const prevAudit   = audits.length >= 2 ? audits[audits.length - 2] : null;

    const barName     = data.settings?.bar_name || 'Your Operation';
    const profitScore = latestAudit ? latestAudit.overall_score : null;
    const profitTrend = latestAudit && prevAudit ? (latestAudit.overall_score - prevAudit.overall_score) : null;
    const barCostPct  = latest?.bar?.cost_pct ?? null;
    const primePct    = latest?.prime_cost_pct ?? null;
    const target      = data.settings?.targets?.bar_pour_cost_pct ?? 22;
    const barRev      = latest?.bar?.revenue ?? 0;
    const opportunity = barCostPct != null && barCostPct > target ? ((barCostPct - target) / 100) * barRev * 4.33 : null;

    const activeCount    = [hasP, hasR, hasT].filter(Boolean).length;
    const inactiveCount  = 3 - activeCount;
    const lastAuditDate  = latestAudit
      ? new Date(latestAudit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null;

    // Dynamic incremental pricing
    // 0 active: $99 each; 1 active: +$50 each (total $149); 2 active: +$40 each (total $189)
    const perModuleAdd  = activeCount === 0 ? '$99/mo' : activeCount === 1 ? '+$50/mo' : '+$40/mo';
    // Full platform: from 1 active = +$90; from 2 active = +$40
    const fullPlatAdd   = activeCount === 1 ? '+$90/mo' : activeCount === 2 ? '+$40/mo' : null;

    const ring = (score, size = 72) => {
      if (score == null) return `<div style="width:${size}px;height:${size}px;border-radius:50%;border:3px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:10px;color:var(--t3);text-align:center;line-height:1.3;">No<br>Data</span></div>`;
      const r = (size/2)-7, circ = 2*Math.PI*r, dash = (Math.min(score,100)/100)*circ;
      const col = score>=65?'#C9A84C':score>=45?'#4888A8':'#C03828';
      return `<div style="position:relative;width:${size}px;height:${size}px;flex-shrink:0;"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg);"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="4"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${col}" stroke-width="4" stroke-dasharray="${dash} ${circ}" stroke-linecap="round"/></svg><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><span style="font-size:18px;font-weight:800;color:${col};line-height:1;">${score}</span></div></div>`;
    };

    const trendPill = (val) => {
      if (val==null) return `<span style="font-size:11px;color:var(--t3);">No prior audit</span>`;
      const up = val>=0;
      return `<span style="font-size:11px;font-weight:700;color:${up?'#C9A84C':'#C03828'};background:${up?'rgba(201,168,76,0.12)':'rgba(192,56,40,0.12)'};padding:2px 8px;border-radius:3px;">${up?'+':''}${val} pts this month</span>`;
    };

    const stat     = (l,v) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="font-size:12px;color:var(--t3);">${l}</span><span style="font-size:12px;font-weight:600;color:var(--t2);">${v}</span></div>`;
    const blurStat = (l,v) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="font-size:12px;color:var(--t3);">${l}</span><span style="font-size:12px;font-weight:600;color:var(--t3);filter:blur(5px);user-select:none;">${v}</span></div>`;
    const dot      = (on) => `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${on?'#C9A84C':'rgba(255,255,255,0.15)'};margin-right:6px;flex-shrink:0;"></span>`;

    // Identical padding/size for both active and locked cards
    const CARD_STYLE = `background:var(--surface);border-radius:10px;padding:24px;display:flex;flex-direction:column;height:380px;overflow:hidden;min-width:0;`;

    const activeCard = (title, desc, scoreVal, trendVal, stats, enterScreen, mod) => `
      <div style="${CARD_STYLE}border:1px solid rgba(201,168,76,0.4);box-shadow:0 0 24px rgba(201,168,76,0.05);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">
          <div style="flex:1;padding-right:12px;">
            <div style="display:flex;align-items:center;margin-bottom:6px;">${dot(true)}<span style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);">Active</span></div>
            <div style="font-size:15px;font-weight:800;color:var(--t1);margin-bottom:5px;">${title}</div>
            <div style="font-size:12px;color:var(--t3);line-height:1.5;min-height:54px;">${desc}</div>
          </div>
          ${ring(scoreVal)}
        </div>
        <div style="height:22px;margin-bottom:10px;">${trendPill(trendVal)}</div>
        <div style="flex:1;margin:0 0 18px;">${stats}</div>
        <button class="btn btn-primary" style="width:100%;font-size:13px;font-weight:700;padding:11px 16px;" onclick="S.Hub._enter('${enterScreen}', '${mod}')">Enter ${title}</button>
      </div>`;

    const lockedCard = (title, desc, stats, module) => `
      <div style="${CARD_STYLE}border:1px solid rgba(255,255,255,0.07);opacity:0.75;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">
          <div style="flex:1;padding-right:12px;">
            <div style="display:flex;align-items:center;margin-bottom:6px;">${dot(false)}<span style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);">Available</span></div>
            <div style="font-size:15px;font-weight:700;color:var(--t2);margin-bottom:5px;">${title}</div>
            <div style="font-size:12px;color:var(--t3);line-height:1.5;min-height:54px;">${desc}</div>
          </div>
          ${ring(null)}
        </div>
        <div style="height:22px;margin-bottom:10px;"></div>
        <div style="flex:1;margin:0 0 18px;">${stats}</div>
        <button class="btn btn-primary" style="width:100%;font-size:12px;font-weight:700;padding:11px 16px;" onclick="S.Hub._upgrade('${module}','${title}','${perModuleAdd}')">Activate ${module.charAt(0).toUpperCase()+module.slice(1)} &nbsp;<span style="font-weight:400;opacity:0.85;">${perModuleAdd}</span></button>
      </div>`;

    const profitStats = hasP
      ? stat('Latest Audit', lastAuditDate||'No audits yet') + stat('Bar Pour Cost', barCostPct!=null?App.fmtPct(barCostPct):'No data') + stat('Prime Cost', primePct!=null?App.fmtPct(primePct):'No data') + stat('Monthly Opportunity', opportunity?App.fmtCurrency(opportunity,0):'No data')
      : blurStat('Latest Audit','Mar 15, 2026') + blurStat('Bar Pour Cost','28.4%') + blurStat('Prime Cost','67.2%') + blurStat('Monthly Opportunity','$4,280');

    const rAudits      = data.revenue_audits || [];
    const rWeeks       = (data.revenue_weeks || []).filter(w => (w.bar_revenue||0)+(w.floor_revenue||0) > 0);
    const rLatestAudit = rAudits.length ? rAudits[rAudits.length - 1] : null;
    const rLatestWeek  = rWeeks.length  ? rWeeks[rWeeks.length - 1]   : null;
    const rAuditScore  = rLatestAudit?.overall_score ?? null;
    const rAuditDate   = rLatestAudit ? new Date(rLatestAudit.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : null;
    const rCheckAvg    = rLatestWeek?.check_avg    ?? null;
    const rLaborPct    = rLatestWeek?.labor_pct_blended ?? null;
    const rTarget      = data.revenue_settings?.targets?.check_avg ?? 35;
    const rCovers      = rLatestWeek?.covers ?? 0;
    const rGap         = rCheckAvg && rCovers ? (rCheckAvg - rTarget) * rCovers * 52 : null;

    const revenueStats = hasR
      ? stat('Latest Audit', rAuditScore != null ? rAuditScore + ' / 100' : 'No audits yet')
        + stat('Check Average', rCheckAvg ? App.fmtCurrency(rCheckAvg) : 'No data')
        + stat('Labor Cost', rLaborPct ? rLaborPct.toFixed(1) + '%' : 'No data')
        + stat('Annual Rev Gap', rGap != null ? App.fmtCurrency(Math.abs(rGap)) : 'No data')
      : blurStat('Latest Audit','Mar 15, 2026') + blurStat('Check Average','$38.40') + blurStat('Labor Cost','34.1%') + blurStat('Revenue Gap','$6,100');

    const tAudits      = data.traffic_audits || [];
    const tWeeks       = data.traffic_weeks  || [];
    const tLatestAudit = tAudits.length ? tAudits[tAudits.length - 1] : null;
    const tLatestWeek  = tWeeks.length  ? tWeeks[tWeeks.length - 1]   : null;
    const tAuditScore  = tLatestAudit?.overall_score ?? null;
    const tRating      = tLatestWeek?.google_rating  ?? null;
    const tReviews     = tLatestWeek?.new_reviews     ?? null;
    const tRank        = tLatestWeek?.avg_rank        ?? null;

    const trafficStats = hasT
      ? stat('Latest Audit',    tAuditScore != null ? tAuditScore + ' / 100' : 'No audits yet')
        + stat('Google Rating', tRating  != null ? tRating.toFixed(1) + ' / 5.0' : 'No data')
        + stat('New Reviews',   tReviews != null ? tReviews + ' this week'        : 'No data')
        + stat('Avg Rank',      tRank    != null ? '#' + tRank + ' search pos'    : 'No data')
      : blurStat('Latest Audit','Mar 15, 2026') + blurStat('Google Rating','3.9 / 5.0') + blurStat('Review Velocity','2 / month') + blurStat('Digital Score','41 / 100');

    const insightCopy = activeCount===3
      ? 'Full platform visibility active. Profit, Revenue and Traffic Recovery are working together to surface operational gaps no single system can detect alone.'
      : activeCount===2
      ? 'Adding the third Recovery system enables cross-system intelligence. Operators with full platform coverage identify compounding revenue leakage that isolated systems miss.'
      : 'Profit, Revenue and Traffic Recovery are interdependent systems. Traffic drives revenue. Revenue drives margin. Operating them separately leaves cross-system leakage undetected.';

    // Full platform strip only shows when not all 3 active
    const fullPlatformStrip = activeCount < 3 ? `
      <div style="width:100%;max-width:920px;background:var(--surface);border:1px solid rgba(201,168,76,0.15);border-radius:10px;padding:20px 24px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:4px;">Full Platform Access</div>
          <div style="font-size:12px;color:var(--t3);line-height:1.5;max-width:500px;">Unlock all three recovery systems and connect profit, revenue and traffic intelligence together.${fullPlatAdd?' '+fullPlatAdd+' added to your current plan.':''}</div>
        </div>
        <button class="btn btn-primary" style="white-space:nowrap;flex-shrink:0;font-size:13px;font-weight:700;padding:10px 20px;" onclick="S.Hub._upgradeAll()">Unlock Full Platform &nbsp;<span style="font-weight:400;opacity:0.85;">${fullPlatAdd||perModuleAdd+' each'}</span></button>
      </div>` : '';

    container.innerHTML = `
      <div style="min-height:100vh;background:var(--bg);display:flex;flex-direction:column;align-items:center;padding:40px 24px 60px;overflow-y:auto;">

        <div style="text-align:center;margin-bottom:36px;">
          <img src="assets/logo.png" alt="Bar Cop" style="height:38px;margin-bottom:18px;opacity:0.93;"/>
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;color:var(--t3);text-transform:uppercase;margin-bottom:8px;">Recovery Platform</div>
          <div style="font-size:22px;font-weight:800;color:var(--t1);letter-spacing:-0.01em;">${barName}</div>
        </div>

        <div style="width:100%;max-width:920px;background:var(--surface);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:22px 32px;margin-bottom:24px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
          <div>
            <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Recovery Coverage</div>
            <div style="font-size:26px;font-weight:800;color:var(--t1);line-height:1;">${activeCount} <span style="font-size:13px;color:var(--t3);font-weight:400;">/ 3 Systems Active</span></div>
          </div>
          <div style="border-left:1px solid rgba(255,255,255,0.07);padding-left:20px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Latest Audit Score</div>
            <div style="font-size:26px;font-weight:800;line-height:1;color:${profitScore!=null?(profitScore>=65?'#C9A84C':profitScore>=45?'#4888A8':'#C03828'):'var(--t4)'};">${profitScore!=null?profitScore:'None'}</div>
          </div>
          <div style="border-left:1px solid rgba(255,255,255,0.07);padding-left:20px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Monthly Opportunity</div>
            <div style="font-size:26px;font-weight:800;line-height:1;color:${opportunity?'#C03828':'var(--t4)'};">${opportunity?App.fmtCurrency(opportunity,0):'No data'}</div>
          </div>
          <div style="border-left:1px solid rgba(255,255,255,0.07);padding-left:20px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Score Trend</div>
            <div style="font-size:26px;font-weight:800;line-height:1;color:${profitTrend==null?'var(--t4)':profitTrend>=0?'#C9A84C':'#C03828'};">${profitTrend!=null?(profitTrend>=0?'+':'')+profitTrend+' pts':'No data'}</div>
          </div>
        </div>

        <div style="width:100%;max-width:920px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
          ${hasP?activeCard('Profit Recovery','Pour cost, food cost, theft, inventory variance, vendor pricing and cash control.',profitScore,profitTrend,profitStats,'dashboard','profit'):lockedCard('Profit Recovery','Pour cost, food cost, theft, inventory variance, vendor pricing and cash control.',profitStats,'profit')}
          ${hasR?activeCard('Revenue Recovery','Menu engineering, pricing strategy, server performance, labor efficiency and events.',null,null,revenueStats,'r-dashboard','revenue'):lockedCard('Revenue Recovery','Menu engineering, pricing strategy, server performance, labor efficiency and events.',revenueStats,'revenue')}
          ${hasT?activeCard('Traffic Recovery','Google presence, online menu, reviews, social media, delivery platforms and digital visibility.',null,null,trafficStats,'t-dashboard','traffic'):lockedCard('Traffic Recovery','Google presence, online menu, reviews, social media, delivery platforms and digital visibility.',trafficStats,'traffic')}
        </div>

        ${fullPlatformStrip}

        <div style="width:100%;max-width:920px;background:var(--surface);border:1px solid rgba(201,168,76,0.13);border-radius:10px;padding:18px 24px;display:flex;align-items:flex-start;gap:14px;margin-bottom:16px;">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;margin-top:1px;"><circle cx="8" cy="8" r="7" stroke="rgba(201,168,76,0.55)" stroke-width="1.2"/><path d="M8 4.5v4.5M8 12v.5" stroke="rgba(201,168,76,0.75)" stroke-width="1.4" stroke-linecap="round"/></svg>
          <div style="font-size:13px;color:var(--t2);line-height:1.6;">${insightCopy}</div>
        </div>

        <div style="width:100%;max-width:920px;text-align:right;padding:4px 0 8px;">
          <button id="hub-signout" style="background:none;border:none;color:var(--t3);font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;padding:4px 0;">Sign Out</button>
        </div>

        <div id="hub-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:2000;align-items:center;justify-content:center;">
          <div style="background:var(--surface);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:32px;width:420px;max-width:90vw;position:relative;">
            <button onclick="document.getElementById('hub-modal').style.display='none'" style="position:absolute;top:12px;right:16px;background:none;border:none;color:var(--t3);font-size:22px;cursor:pointer;line-height:1;">x</button>
            <div id="hub-modal-title" style="font-size:17px;font-weight:800;color:var(--t1);margin-bottom:8px;"></div>
            <div id="hub-modal-body" style="font-size:13px;color:var(--t3);margin-bottom:24px;line-height:1.6;"></div>
            <button class="btn btn-primary" id="hub-modal-btn" style="width:100%;font-size:13px;font-weight:700;"></button>
            <div id="hub-modal-error" style="color:var(--red);font-size:12px;margin-top:10px;display:none;text-align:center;"></div>
          </div>
        </div>

      </div>
    `;

    document.getElementById('hub-signout')?.addEventListener('click', async () => { await DB.signOut(); });
  },

  _enter(screen, module) { App.showApp(module || 'profit'); App.navigate(screen); },

  _upgrade(module, title, price) {
    const modal = document.getElementById('hub-modal');
    document.getElementById('hub-modal-title').textContent = 'Activate ' + title;
    document.getElementById('hub-modal-body').textContent = title + ' will be added to your subscription immediately. ' + (price||'') + ' will be added to your next billing cycle on a pro-rated basis.';
    document.getElementById('hub-modal-error').style.display = 'none';
    const btn = document.getElementById('hub-modal-btn');
    btn.textContent = 'Activate ' + title + '  ' + (price||'');
    btn.disabled = false;
    btn.onclick = () => this._addModule(module, btn);
    modal.style.display = 'flex';
  },

  _upgradeAll() {
    const modal = document.getElementById('hub-modal');
    const inactive = ['profit','revenue','traffic']
      .filter(m => !(App.subscription?.active_modules||[]).includes(m))
      .map(m => m==='profit'?'Profit Recovery':m==='revenue'?'Revenue Recovery':'Traffic Recovery');
    const activeCount = 3 - inactive.length;
    const fullPlatAdd = activeCount===1?'+$90/mo':activeCount===2?'+$40/mo':'$99/mo each';
    document.getElementById('hub-modal-title').textContent = 'Unlock Full Platform';
    document.getElementById('hub-modal-body').textContent = 'Activates ' + inactive.join(' and ') + ' immediately. Your subscription will be updated to full platform access on your next billing cycle.';
    document.getElementById('hub-modal-error').style.display = 'none';
    const btn = document.getElementById('hub-modal-btn');
    btn.textContent = 'Unlock Full Platform  ' + fullPlatAdd;
    btn.disabled = false;
    btn.onclick = () => this._addAllModules(btn);
    modal.style.display = 'flex';
  },

  async _addAllModules(btn) {
    const inactiveMods = ['profit','revenue','traffic'].filter(m => !(App.subscription?.active_modules||[]).includes(m));
    for (const mod of inactiveMods) { await this._addModule(mod, btn, true); }
    App.subscription = await DB.getSubscription();
    document.getElementById('hub-modal').style.display = 'none';
    const hw = document.getElementById('hub-wrapper');
    if (hw) this.render(hw);
  },

  async _addModule(module, btn, silent=false) {
    const err = document.getElementById('hub-modal-error');
    if (err) err.style.display = 'none';
    if (!silent) { btn.textContent = 'Processing...'; btn.disabled = true; }
    try {
      const res  = await fetch('/api/add-module', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:DB._user?.id, module}) });
      const data = await res.json();
      if (!silent) {
        if (data.ok) {
          App.subscription = await DB.getSubscription();
          document.getElementById('hub-modal').style.display = 'none';
          const hw = document.getElementById('hub-wrapper');
          if (hw) this.render(hw);
        } else throw new Error(data.error||'Activation failed');
      }
      return data.ok;
    } catch(e) {
      if (!silent && err) { err.textContent = e.message; err.style.display = 'block'; }
      if (!silent) { btn.textContent = 'Try Again'; btn.disabled = false; }
      return false;
    }
  }
};
