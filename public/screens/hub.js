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

    const barName = data.settings?.bar_name || 'Your Operation';

    const profitScore = latestAudit ? latestAudit.overall_score : null;
    const profitTrend = latestAudit && prevAudit
      ? (latestAudit.overall_score - prevAudit.overall_score)
      : null;
    const barCostPct  = latest?.bar?.cost_pct ?? null;
    const primePct    = latest?.prime_cost_pct ?? null;
    const target      = data.settings?.targets?.bar_pour_cost_pct ?? 22;
    const barRev      = latest?.bar?.revenue ?? 0;
    const opportunity = barCostPct != null && barCostPct > target
      ? ((barCostPct - target) / 100) * barRev * 4.33
      : null;

    const activeCount   = [hasP, hasR, hasT].filter(Boolean).length;
    const lastAuditDate = latestAudit
      ? new Date(latestAudit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null;

    // Score ring
    const ring = (score, size = 80) => {
      if (score == null) return `
        <div style="width:${size}px;height:${size}px;border-radius:50%;border:3px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span style="font-size:10px;color:var(--t3);text-align:center;line-height:1.3;">No<br>Data</span>
        </div>`;
      const r    = (size / 2) - 7;
      const circ = 2 * Math.PI * r;
      const dash = (Math.min(score, 100) / 100) * circ;
      const col  = score >= 65 ? '#C9A84C' : score >= 45 ? '#4888A8' : '#C03828';
      return `
        <div style="position:relative;width:${size}px;height:${size}px;flex-shrink:0;">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg);">
            <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="4"/>
            <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${col}" stroke-width="4"
              stroke-dasharray="${dash} ${circ}" stroke-linecap="round"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
            <span style="font-size:${size > 70 ? 20 : 15}px;font-weight:800;color:${col};line-height:1;">${score}</span>
          </div>
        </div>`;
    };

    // Trend indicator
    const trendPill = (val) => {
      if (val == null) return `<span style="font-size:11px;color:var(--t3);">No prior audit</span>`;
      const up = val >= 0;
      return `<span style="font-size:11px;font-weight:700;color:${up ? '#C9A84C' : '#C03828'};background:${up ? 'rgba(201,168,76,0.12)' : 'rgba(192,56,40,0.12)'};padding:2px 8px;border-radius:3px;">${up ? '+' : ''}${val} pts this month</span>`;
    };

    // Stat row
    const stat = (label, val) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <span style="font-size:12px;color:var(--t3);">${label}</span>
        <span style="font-size:12px;font-weight:600;color:var(--t2);">${val}</span>
      </div>`;

    // Blurred stat for locked sections
    const blurStat = (label, fake) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <span style="font-size:12px;color:var(--t3);">${label}</span>
        <span style="font-size:12px;font-weight:600;color:var(--t3);filter:blur(5px);user-select:none;">${fake}</span>
      </div>`;

    // Status indicator
    const statusDot = (active) => `
      <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${active ? '#C9A84C' : 'rgba(255,255,255,0.15)'};margin-right:6px;flex-shrink:0;"></span>`;

    // Build active section card (larger, elevated)
    const activeCard = (id, title, desc, scoreVal, trendVal, stats, enterScreen) => `
      <div style="background:var(--surface);border:1px solid rgba(201,168,76,0.4);border-radius:10px;padding:28px;display:flex;flex-direction:column;box-shadow:0 0 28px rgba(201,168,76,0.06);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;">
          <div>
            <div style="display:flex;align-items:center;margin-bottom:6px;">
              ${statusDot(true)}
              <span style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);">Active</span>
            </div>
            <div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:5px;">${title}</div>
            <div style="font-size:12px;color:var(--t3);line-height:1.5;max-width:260px;">${desc}</div>
          </div>
          ${ring(scoreVal, 80)}
        </div>
        <div style="margin-bottom:6px;">${trendPill(trendVal)}</div>
        <div style="flex:1;margin:16px 0 20px;">${stats}</div>
        <button class="btn btn-primary" style="width:100%;font-size:13px;font-weight:700;padding:11px 16px;" onclick="S.Hub._enter('${enterScreen}')">
          Enter ${title}
        </button>
      </div>`;

    // Build locked section card (smaller, dim)
    const lockedCard = (id, title, desc, upgradeBlurbs, module) => `
      <div style="background:var(--surface);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:24px;display:flex;flex-direction:column;opacity:0.8;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">
          <div style="flex:1;padding-right:12px;">
            <div style="display:flex;align-items:center;margin-bottom:6px;">
              ${statusDot(false)}
              <span style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);">Available</span>
            </div>
            <div style="font-size:15px;font-weight:700;color:var(--t2);margin-bottom:6px;">${title}</div>
            <div style="font-size:12px;color:var(--t3);line-height:1.5;min-height:54px;">${desc}</div>
          </div>
          ${ring(null, 64)}
        </div>
        <div style="flex:1;margin-bottom:18px;">${upgradeBlurbs}</div>
        <button class="btn btn-primary" style="width:100%;font-size:13px;font-weight:700;padding:11px 16px;" onclick="S.Hub._upgrade('${module}', '${title}')">
          Add ${title}
        </button>
      </div>`;

    // Profit stats
    const profitStats = hasP
      ? stat('Latest Audit', lastAuditDate || 'No audits yet') +
        stat('Bar Pour Cost', barCostPct != null ? App.fmtPct(barCostPct) : 'No data') +
        stat('Prime Cost', primePct != null ? App.fmtPct(primePct) : 'No data') +
        stat('Monthly Opportunity', opportunity ? App.fmtCurrency(opportunity, 0) : 'No data')
      : blurStat('Latest Audit', 'Mar 15, 2026') +
        blurStat('Bar Pour Cost', '28.4%') +
        blurStat('Prime Cost', '67.2%') +
        blurStat('Monthly Opportunity', '$4,280');

    const revenueStats = hasR
      ? stat('Latest Audit', 'No audits yet') +
        stat('Check Average', 'No data') +
        stat('Labor Cost', 'No data') +
        stat('Revenue Gap', 'No data')
      : blurStat('Latest Audit', 'Mar 15, 2026') +
        blurStat('Check Average', '$38.40') +
        blurStat('Labor Cost', '34.1%') +
        blurStat('Revenue Gap', '$6,100');

    const trafficStats = hasT
      ? stat('Latest Audit', 'No audits yet') +
        stat('Google Rating', 'No data') +
        stat('Review Velocity', 'No data') +
        stat('Digital Score', 'No data')
      : blurStat('Latest Audit', 'Mar 15, 2026') +
        blurStat('Google Rating', '3.9 / 5.0') +
        blurStat('Review Velocity', '2 / month') +
        blurStat('Digital Score', '41 / 100');

    // Bottom insight copy
    const insightCopy = activeCount === 3
      ? 'Full platform visibility active. Profit, Revenue and Traffic Recovery are working together to surface operational gaps no single system can detect alone.'
      : activeCount === 2
      ? 'Adding the third Recovery section enables cross-system intelligence. Operators with full platform coverage identify compounding revenue leakage that isolated systems miss entirely.'
      : 'Profit, Revenue and Traffic Recovery are interdependent systems. Traffic drives revenue. Revenue drives margin. Operating them separately leaves cross-system leakage undetected.';

    container.innerHTML = `
      <div style="min-height:100vh;background:var(--bg);display:flex;flex-direction:column;align-items:center;padding:40px 24px 60px;overflow-y:auto;">

        <!-- Logo + header -->
        <div style="text-align:center;margin-bottom:36px;">
          <img src="assets/logo.png" alt="Bar Cop" style="height:38px;margin-bottom:18px;opacity:0.93;"/>
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;color:var(--t3);text-transform:uppercase;margin-bottom:8px;">Recovery Platform</div>
          <div style="font-size:22px;font-weight:800;color:var(--t1);letter-spacing:-0.01em;">${barName}</div>
        </div>

        <!-- Global overview bar -->
        <div style="width:100%;max-width:920px;background:var(--surface);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:22px 32px;margin-bottom:24px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">

          <div>
            <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Recovery Coverage</div>
            <div style="font-size:26px;font-weight:800;color:var(--t1);line-height:1;">${activeCount} <span style="font-size:13px;color:var(--t3);font-weight:400;">/ 3 Systems Active</span></div>
          </div>

          <div style="border-left:1px solid rgba(255,255,255,0.07);padding-left:20px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Latest Audit Score</div>
            <div style="font-size:26px;font-weight:800;line-height:1;color:${profitScore != null ? (profitScore >= 65 ? '#C9A84C' : profitScore >= 45 ? '#4888A8' : '#C03828') : 'var(--t4)'};">
              ${profitScore != null ? profitScore : 'None'}
            </div>
          </div>

          <div style="border-left:1px solid rgba(255,255,255,0.07);padding-left:20px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Monthly Opportunity</div>
            <div style="font-size:26px;font-weight:800;line-height:1;color:${opportunity ? '#C03828' : 'var(--t4)'};">
              ${opportunity ? App.fmtCurrency(opportunity, 0) : 'No data'}
            </div>
          </div>

          <div style="border-left:1px solid rgba(255,255,255,0.07);padding-left:20px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Score Trend</div>
            <div style="font-size:26px;font-weight:800;line-height:1;color:${profitTrend == null ? 'var(--t4)' : profitTrend >= 0 ? '#C9A84C' : '#C03828'};">
              ${profitTrend != null ? (profitTrend >= 0 ? '+' : '') + profitTrend + ' pts' : 'No data'}
            </div>
          </div>

        </div>

        <!-- Three recovery panels -->
        <div style="width:100%;max-width:920px;display:grid;grid-template-columns:${activeCount === 1 && hasP ? '1.45fr 1fr 1fr' : activeCount === 1 && hasR ? '1fr 1.45fr 1fr' : activeCount === 1 && hasT ? '1fr 1fr 1.45fr' : 'repeat(3,1fr)'};gap:16px;margin-bottom:24px;align-items:start;">

          ${hasP
            ? activeCard('profit', 'Profit Recovery', 'Pour cost, food cost, theft, inventory variance, vendor pricing and cash control.', profitScore, profitTrend, profitStats, 'dashboard')
            : lockedCard('profit', 'Profit Recovery', 'Pour cost, food cost, theft, inventory variance, vendor pricing and cash control.', profitStats, 'profit')}

          ${hasR
            ? activeCard('revenue', 'Revenue Recovery', 'Menu engineering, pricing strategy, server performance, labor efficiency and events.', null, null, revenueStats, 'dashboard')
            : lockedCard('revenue', 'Revenue Recovery', 'Menu engineering, pricing strategy, server performance, labor efficiency and events.', revenueStats, 'revenue')}

          ${hasT
            ? activeCard('traffic', 'Traffic Recovery', 'Google presence, online menu, reviews, social media, delivery platforms and digital visibility.', null, null, trafficStats, 'dashboard')
            : lockedCard('traffic', 'Traffic Recovery', 'Google presence, online menu, reviews, social media, delivery platforms and digital visibility.', trafficStats, 'traffic')}

        </div>

        <!-- Bottom insight strip -->
        <div style="width:100%;max-width:920px;background:rgba(201,168,76,0.04);border:1px solid rgba(201,168,76,0.13);border-radius:10px;padding:18px 24px;display:flex;align-items:flex-start;gap:14px;">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;margin-top:1px;">
            <circle cx="8" cy="8" r="7" stroke="rgba(201,168,76,0.55)" stroke-width="1.2"/>
            <path d="M8 4.5v4.5M8 12v.5" stroke="rgba(201,168,76,0.75)" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <div style="font-size:13px;color:var(--t2);line-height:1.6;">${insightCopy}</div>
        </div>

        <!-- Upgrade modal -->
        <div id="hub-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:2000;align-items:center;justify-content:center;">
          <div style="background:var(--surface);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:32px;width:420px;max-width:90vw;position:relative;">
            <button onclick="document.getElementById('hub-modal').style.display='none'" style="position:absolute;top:12px;right:16px;background:none;border:none;color:var(--t3);font-size:22px;cursor:pointer;line-height:1;">x</button>
            <div id="hub-modal-title" style="font-size:17px;font-weight:800;color:var(--t1);margin-bottom:8px;"></div>
            <div id="hub-modal-body" style="font-size:13px;color:var(--t3);margin-bottom:24px;line-height:1.6;"></div>
            <button class="btn btn-primary" id="hub-modal-btn" style="width:100%;font-size:13px;font-weight:700;">Add Section to Subscription</button>
            <div id="hub-modal-error" style="color:var(--red);font-size:12px;margin-top:10px;display:none;text-align:center;"></div>
          </div>
        </div>

      </div>
    `;
  },

  _enter(screen) {
    App.showApp();
    App.navigate(screen);
  },

  _upgrade(module, title) {
    const modal = document.getElementById('hub-modal');
    document.getElementById('hub-modal-title').textContent = 'Add ' + title;
    document.getElementById('hub-modal-body').textContent =
      title + ' will be added to your current subscription immediately. You will be billed the difference on your next billing cycle.';
    document.getElementById('hub-modal-error').style.display = 'none';
    const btn = document.getElementById('hub-modal-btn');
    btn.textContent = 'Add Section to Subscription';
    btn.disabled = false;
    btn.onclick = () => this._addModule(module, btn);
    modal.style.display = 'flex';
  },

  async _addModule(module, btn) {
    const err = document.getElementById('hub-modal-error');
    err.style.display = 'none';
    btn.textContent = 'Processing...';
    btn.disabled = true;
    try {
      const response = await fetch('/api/add-module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: DB._user?.id, module })
      });
      const data = await response.json();
      if (data.ok) {
        App.subscription = await DB.getSubscription();
        document.getElementById('hub-modal').style.display = 'none';
        const hw = document.getElementById('hub-wrapper');
        if (hw) this.render(hw);
      } else {
        throw new Error(data.error || 'Upgrade failed');
      }
    } catch (e) {
      err.textContent = e.message;
      err.style.display = 'block';
      btn.textContent = 'Add Section to Subscription';
      btn.disabled = false;
    }
  }
};
