'use strict';

S.Hub = {

  render(container) {
    const sub     = App.subscription || {};
    const modules = sub.active_modules || [];
    const hasP    = modules.includes('profit');
    const hasR    = modules.includes('revenue');
    const hasT    = modules.includes('traffic');

    const data    = App.data || {};
    const weeks   = data.weeks || [];
    const audits  = data.audits || [];
    const latest  = weeks.length ? weeks[weeks.length - 1] : null;
    const latestAudit = audits.length ? audits[audits.length - 1] : null;

    const barName = data.settings?.bar_name || 'Your Operation';

    // Profit metrics from real data
    const profitScore  = latestAudit ? latestAudit.overall_score : null;
    const profitTrend  = audits.length >= 2
      ? (audits[audits.length-1].overall_score - audits[audits.length-2].overall_score)
      : null;
    const barCostPct   = latest?.bar?.cost_pct ?? null;
    const primePct     = latest?.prime_cost_pct ?? null;
    const target       = data.settings?.targets?.bar_pour_cost_pct ?? 22;
    const barRev       = latest?.bar?.revenue ?? 0;
    const opportunity  = barCostPct != null && barCostPct > target
      ? ((barCostPct - target) / 100) * barRev * 4.33
      : null;

    const activeCount  = [hasP, hasR, hasT].filter(Boolean).length;
    const lastAuditDate = latestAudit
      ? new Date(latestAudit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null;

    // Recovery score ring helper
    const ring = (score, size = 72) => {
      if (score == null) return `
        <div style="width:${size}px;height:${size}px;border-radius:50%;border:3px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;">
          <span style="font-size:11px;color:var(--t3);">N/A</span>
        </div>`;
      const pct = Math.min(score, 100);
      const r   = (size / 2) - 6;
      const circ = 2 * Math.PI * r;
      const dash = (pct / 100) * circ;
      const col  = score >= 65 ? '#C9A84C' : score >= 45 ? '#4888A8' : '#C03828';
      return `
        <div style="position:relative;width:${size}px;height:${size}px;flex-shrink:0;">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg);">
            <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="4"/>
            <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${col}" stroke-width="4"
              stroke-dasharray="${dash} ${circ}" stroke-linecap="round"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;">
            <span style="font-size:${size > 60 ? 18 : 13}px;font-weight:800;color:${col};line-height:1;">${score}</span>
          </div>
        </div>`;
    };

    // Trend badge
    const trendBadge = (val) => {
      if (val == null) return '';
      const pos = val >= 0;
      return `<span style="font-size:11px;font-weight:600;color:${pos ? '#C9A84C' : '#C03828'};background:${pos ? 'rgba(201,168,76,0.12)' : 'rgba(192,56,40,0.12)'};padding:2px 7px;border-radius:3px;">${pos ? '+' : ''}${val} pts</span>`;
    };

    // Stat row helper
    const stat = (label, val, dim = false) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <span style="font-size:12px;color:var(--t3);">${label}</span>
        <span style="font-size:12px;font-weight:600;color:${dim ? 'var(--t4)' : 'var(--t2)'};">${val}</span>
      </div>`;

    // Blurred stat for locked
    const blurStat = (label) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <span style="font-size:12px;color:var(--t3);">${label}</span>
        <span style="font-size:12px;font-weight:600;color:var(--t4);filter:blur(4px);user-select:none;">$0,000</span>
      </div>`;

    container.innerHTML = `
      <div id="hub-root" style="min-height:100vh;background:var(--bg);display:flex;flex-direction:column;align-items:center;padding:40px 24px 60px;overflow-y:auto;">

        <!-- Logo + header -->
        <div style="text-align:center;margin-bottom:40px;">
          <img src="assets/logo.png" alt="Bar Cop" style="height:36px;margin-bottom:20px;opacity:0.92;"/>
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:600;letter-spacing:0.12em;color:var(--t3);text-transform:uppercase;margin-bottom:6px;">Recovery Platform</div>
          <div style="font-size:24px;font-weight:800;color:var(--t1);letter-spacing:-0.01em;">${barName}</div>
        </div>

        <!-- Global overview bar -->
        <div style="width:100%;max-width:900px;background:var(--surface);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:20px 28px;margin-bottom:28px;display:grid;grid-template-columns:repeat(4,1fr);gap:20px;">
          <div style="text-align:center;">
            <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Sections Active</div>
            <div style="font-size:28px;font-weight:800;color:var(--gold);">${activeCount} <span style="font-size:14px;color:var(--t3);font-weight:400;">of 3</span></div>
          </div>
          <div style="text-align:center;border-left:1px solid rgba(255,255,255,0.07);padding-left:20px;">
            <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Latest Audit Score</div>
            <div style="font-size:28px;font-weight:800;color:${profitScore != null ? (profitScore >= 65 ? 'var(--gold)' : profitScore >= 45 ? 'var(--steel)' : 'var(--red)') : 'var(--t4)'};">${profitScore != null ? profitScore : 'None'}</div>
          </div>
          <div style="text-align:center;border-left:1px solid rgba(255,255,255,0.07);padding-left:20px;">
            <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Monthly Opportunity</div>
            <div style="font-size:28px;font-weight:800;color:${opportunity ? 'var(--red)' : 'var(--t4)'};">${opportunity ? App.fmtCurrency(opportunity, 0) : 'No data'}</div>
          </div>
          <div style="text-align:center;border-left:1px solid rgba(255,255,255,0.07);padding-left:20px;">
            <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Score Trend</div>
            <div style="font-size:28px;font-weight:800;color:var(--t4);">${profitTrend != null ? (profitTrend >= 0 ? '+' : '') + profitTrend + ' pts' : 'No data'}</div>
          </div>
        </div>

        <!-- Three recovery panels -->
        <div style="width:100%;max-width:900px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px;">

          <!-- PROFIT RECOVERY -->
          <div style="background:var(--surface);border:1px solid ${hasP ? 'var(--gold)' : 'rgba(255,255,255,0.08)'};border-radius:10px;padding:24px;display:flex;flex-direction:column;position:relative;${hasP ? '' : 'opacity:0.85;'}">
            ${hasP ? '' : '<div style="position:absolute;top:14px;right:14px;font-size:10px;font-weight:700;letter-spacing:0.1em;color:var(--t3);text-transform:uppercase;background:rgba(255,255,255,0.05);padding:3px 8px;border-radius:3px;">Locked</div>'}
            <div style="margin-bottom:16px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${hasP ? 'var(--gold)' : 'var(--t3)'};margin-bottom:6px;">Profit Recovery</div>
              <div style="font-size:12px;color:var(--t3);line-height:1.5;">Pour cost, food cost, variance, vendor pricing and cash control.</div>
            </div>
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
              ${ring(hasP ? profitScore : null)}
              <div>
                <div style="font-size:11px;color:var(--t3);margin-bottom:4px;">Recovery Score</div>
                ${hasP && profitTrend != null ? trendBadge(profitTrend) : '<span style="font-size:11px;color:var(--t4);">No audits yet</span>'}
              </div>
            </div>
            <div style="flex:1;margin-bottom:20px;">
              ${hasP
                ? stat('Latest Audit', lastAuditDate || 'None') +
                  stat('Bar Pour Cost', barCostPct != null ? App.fmtPct(barCostPct) : 'No data') +
                  stat('Prime Cost', primePct != null ? App.fmtPct(primePct) : 'No data') +
                  stat('Monthly Opportunity', opportunity ? App.fmtCurrency(opportunity, 0) : 'No data')
                : blurStat('Latest Audit') + blurStat('Bar Pour Cost') + blurStat('Prime Cost') + blurStat('Monthly Opportunity')
              }
            </div>
            ${hasP
              ? '<button class="btn btn-primary" style="width:100%;" onclick="S.Hub._enter(\'dashboard\')">Enter Profit Recovery</button>'
              : `<div style="font-size:12px;color:var(--t3);margin-bottom:12px;line-height:1.5;">Identify where margin is leaking and recover it systematically.</div>
                 <button class="btn btn-outline" style="width:100%;border-color:var(--gold);color:var(--gold);" onclick="S.Hub._upgrade('profit')">Add Profit Recovery</button>`
            }
          </div>

          <!-- REVENUE RECOVERY -->
          <div style="background:var(--surface);border:1px solid ${hasR ? 'var(--gold)' : 'rgba(255,255,255,0.08)'};border-radius:10px;padding:24px;display:flex;flex-direction:column;position:relative;${hasR ? '' : 'opacity:0.85;'}">
            ${hasR ? '' : '<div style="position:absolute;top:14px;right:14px;font-size:10px;font-weight:700;letter-spacing:0.1em;color:var(--t3);text-transform:uppercase;background:rgba(255,255,255,0.05);padding:3px 8px;border-radius:3px;">Locked</div>'}
            <div style="margin-bottom:16px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${hasR ? 'var(--gold)' : 'var(--t3)'};margin-bottom:6px;">Revenue Recovery</div>
              <div style="font-size:12px;color:var(--t3);line-height:1.5;">Menu engineering, server performance, labor efficiency and event revenue.</div>
            </div>
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
              ${ring(hasR ? null : null)}
              <div>
                <div style="font-size:11px;color:var(--t3);margin-bottom:4px;">Recovery Score</div>
                <span style="font-size:11px;color:var(--t4);">${hasR ? 'No audits yet' : 'Section locked'}</span>
              </div>
            </div>
            <div style="flex:1;margin-bottom:20px;">
              ${hasR
                ? stat('Latest Audit', 'None') + stat('Check Average', 'No data') + stat('Labor Cost', 'No data') + stat('Revenue Gap', 'No data')
                : blurStat('Latest Audit') + blurStat('Check Average') + blurStat('Labor Cost') + blurStat('Revenue Gap')
              }
            </div>
            ${hasR
              ? '<button class="btn btn-primary" style="width:100%;" onclick="S.Hub._enter(\'dashboard\')">Enter Revenue Recovery</button>'
              : `<div style="font-size:12px;color:var(--t3);margin-bottom:12px;line-height:1.5;">Most operators find $8k or more in recoverable monthly revenue within the first audit.</div>
                 <button class="btn btn-outline" style="width:100%;border-color:var(--gold);color:var(--gold);" onclick="S.Hub._upgrade('revenue')">Add Revenue Recovery</button>`
            }
          </div>

          <!-- TRAFFIC RECOVERY -->
          <div style="background:var(--surface);border:1px solid ${hasT ? 'var(--gold)' : 'rgba(255,255,255,0.08)'};border-radius:10px;padding:24px;display:flex;flex-direction:column;position:relative;${hasT ? '' : 'opacity:0.85;'}">
            ${hasT ? '' : '<div style="position:absolute;top:14px;right:14px;font-size:10px;font-weight:700;letter-spacing:0.1em;color:var(--t3);text-transform:uppercase;background:rgba(255,255,255,0.05);padding:3px 8px;border-radius:3px;">Locked</div>'}
            <div style="margin-bottom:16px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${hasT ? 'var(--gold)' : 'var(--t3)'};margin-bottom:6px;">Traffic Recovery</div>
              <div style="font-size:12px;color:var(--t3);line-height:1.5;">Google presence, reviews, social media, delivery platforms and digital visibility.</div>
            </div>
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
              ${ring(hasT ? null : null)}
              <div>
                <div style="font-size:11px;color:var(--t3);margin-bottom:4px;">Recovery Score</div>
                <span style="font-size:11px;color:var(--t4);">${hasT ? 'No audits yet' : 'Section locked'}</span>
              </div>
            </div>
            <div style="flex:1;margin-bottom:20px;">
              ${hasT
                ? stat('Latest Audit', 'None') + stat('Google Rating', 'No data') + stat('Review Velocity', 'No data') + stat('Digital Score', 'No data')
                : blurStat('Latest Audit') + blurStat('Google Rating') + blurStat('Review Velocity') + blurStat('Digital Score')
              }
            </div>
            ${hasT
              ? '<button class="btn btn-primary" style="width:100%;" onclick="S.Hub._enter(\'dashboard\')">Enter Traffic Recovery</button>'
              : `<div style="font-size:12px;color:var(--t3);margin-bottom:12px;line-height:1.5;">Your digital presence is either sending guests to you or to your competitors right now.</div>
                 <button class="btn btn-outline" style="width:100%;border-color:var(--gold);color:var(--gold);" onclick="S.Hub._upgrade('traffic')">Add Traffic Recovery</button>`
            }
          </div>

        </div>

        <!-- Bottom insight strip -->
        ${activeCount < 3 ? `
        <div style="width:100%;max-width:900px;background:rgba(201,168,76,0.05);border:1px solid rgba(201,168,76,0.15);border-radius:10px;padding:18px 24px;display:flex;align-items:center;gap:16px;">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style="flex-shrink:0;">
            <circle cx="9" cy="9" r="8" stroke="rgba(201,168,76,0.6)" stroke-width="1.3"/>
            <path d="M9 5v5M9 13v.5" stroke="rgba(201,168,76,0.8)" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <div style="font-size:13px;color:var(--t2);line-height:1.5;">
            ${activeCount === 1
              ? 'Operators using two or more Recovery sections close operational gaps an average of 40% faster. Unlocking a second section gives you cross-platform intelligence.'
              : 'Full platform members see compounding returns. Profit, Revenue and Traffic Recovery work together to identify opportunities no single section can surface alone.'}
          </div>
        </div>` : `
        <div style="width:100%;max-width:900px;background:rgba(201,168,76,0.05);border:1px solid rgba(201,168,76,0.15);border-radius:10px;padding:18px 24px;display:flex;align-items:center;gap:16px;">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style="flex-shrink:0;">
            <path d="M3 9l4 4 8-8" stroke="rgba(201,168,76,0.8)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div style="font-size:13px;color:var(--t2);line-height:1.5;">All three Recovery sections are active. You have full platform visibility across profit, revenue and traffic.</div>
        </div>`}

        <!-- Upgrade modal -->
        <div id="hub-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:2000;align-items:center;justify-content:center;">
          <div style="background:var(--surface);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:32px;width:420px;max-width:90vw;position:relative;">
            <button onclick="document.getElementById('hub-modal').style.display='none'" style="position:absolute;top:12px;right:16px;background:none;border:none;color:var(--t3);font-size:22px;cursor:pointer;line-height:1;">x</button>
            <div id="hub-modal-title" style="font-size:17px;font-weight:700;color:var(--t1);margin-bottom:6px;"></div>
            <div id="hub-modal-body" style="font-size:13px;color:var(--t3);margin-bottom:24px;line-height:1.5;"></div>
            <button class="btn btn-primary" id="hub-modal-btn" style="width:100%;">Add Section to Subscription</button>
            <div id="hub-modal-error" style="color:var(--red);font-size:12px;margin-top:10px;display:none;text-align:center;"></div>
          </div>
        </div>

      </div>
    `;
  },

  _enter(screen) {
    // Show app shell with sidebar then navigate
    document.getElementById('hub-root')?.remove();
    App.showApp();
    App.navigate(screen);
  },

  _upgrade(module) {
    const names = { profit: 'Profit Recovery', revenue: 'Revenue Recovery', traffic: 'Traffic Recovery' };
    const modal = document.getElementById('hub-modal');
    document.getElementById('hub-modal-title').textContent = 'Add ' + names[module];
    document.getElementById('hub-modal-body').textContent =
      'This will add ' + names[module] + ' to your current subscription. You will be billed the difference on your next cycle.';
    document.getElementById('hub-modal-error').style.display = 'none';
    modal.style.display = 'flex';

    const btn = document.getElementById('hub-modal-btn');
    btn.onclick = () => this._addModule(module, btn);
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
        this.render(document.getElementById('content-area'));
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
