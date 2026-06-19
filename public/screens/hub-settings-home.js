'use strict';

/* ── Settings home — the Settings section landing / account + setup hub ───────
   Opens from the top-nav gear with the Settings sidebar (Setup + Settings +
   Account + Support). Summarizes setup completeness (read from the same
   S.HubGettingStarted TASKS the checklist uses) and the account, and jumps to
   the focused settings pages. The detailed step-by-step checklist still lives
   in Getting Started; this page summarizes and links to it. */

S.HubSettingsHome = {

  open() {
    App.openHubFullPage('Settings', (mount) => { this.container = mount; this.render(mount); }, 'settings-home');
  },

  render(mount) {
    if (App.setHubTopbarActions) App.setHubTopbarActions('');

    const GS     = S.HubGettingStarted;
    const TASKS  = (GS && GS.TASKS)  || [];
    const GROUPS = (GS && GS.GROUPS) || [];
    const prog   = (App.data && App.data.hub_setup_progress) || {};
    const done   = TASKS.filter(t => prog[t.id]).length;
    const total  = TASKS.length;
    const pct    = total ? Math.round(done / total * 100) : 0;
    const complete = total > 0 && done === total;

    const head = '<div style="margin-bottom:20px;">'
      + '<div style="font-size:22px;font-weight:800;color:var(--w);letter-spacing:0.3px;">Settings</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:3px;">Your account, your setup, and how Bar Cop is tuned to your operation.</div></div>';

    // ── Setup completeness ──
    const groupRows = GROUPS.map(g => {
      const gt   = TASKS.filter(t => t.group === g.id);
      const gd   = gt.filter(t => prog[t.id]).length;
      const gpct = gt.length ? Math.round(gd / gt.length * 100) : 0;
      return '<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--b2);">'
        + '<div style="flex:1;font-size:12px;color:var(--t1);">' + esc(g.title) + '</div>'
        + '<div style="width:120px;height:5px;background:var(--input);border-radius:3px;overflow:hidden;"><div style="width:' + gpct + '%;height:100%;background:' + (gpct === 100 ? 'var(--green)' : 'var(--gold)') + ';"></div></div>'
        + '<div style="width:44px;text-align:right;font-size:11px;color:var(--t3);">' + gd + '/' + gt.length + '</div></div>';
    }).join('');

    // The setup card exists only while there is setup left to do. Once every
    // step is done, Getting Started disappears (from the sidebar too), so the
    // card has nothing to be about and is dropped entirely.
    const setupCard = complete ? '' : ('<div class="card form-card" style="margin-bottom:18px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">'
      +   '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">Setup</div>'
      +   '<div style="font-size:14px;color:var(--t2);margin-top:4px;">' + done + ' of ' + total + ' steps done. Finish setup so every number has real data behind it.</div></div>'
      +   '<button class="btn btn-primary" data-act="getting-started">Continue Setup</button>'
      + '</div>'
      + '<div style="height:7px;background:var(--input);border-radius:4px;overflow:hidden;margin-bottom:16px;"><div style="width:' + pct + '%;height:100%;background:var(--gold);"></div></div>'
      + '<div style="border:1px solid var(--b2);border-radius:6px;padding:4px 16px;">' + groupRows + '</div>'
      + '</div>');

    // ── Shared row + card helpers ──
    const dash = '<span style="color:var(--t3);">Not set</span>';
    const kvRow = (label, val) => '<div style="display:flex;gap:14px;padding:9px 0;border-bottom:1px solid var(--b2);">'
      + '<div style="width:120px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);padding-top:2px;flex-shrink:0;">' + label + '</div>'
      + '<div style="flex:1;font-size:13px;color:var(--t1);min-width:0;">' + val + '</div></div>';
    const card = (title, act, btnLabel, rowsHtml) => '<div class="card" style="margin-bottom:18px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);">' + title + '</div>'
      +   '<button class="btn btn-ghost btn-sm" data-act="' + act + '">' + btnLabel + '</button>'
      + '</div>' + rowsHtml + '</div>';

    // ── Account (subscription + renewal + team for admins) ──
    const s       = (App.data && App.data.settings) || {};
    const email   = (window.DB && DB._user && DB._user.email) || (App.demoMode ? 'Demo account' : '');
    const isAdmin = !!(window.DB && DB.isAdmin && DB.isAdmin());
    const sub     = App.subscription || {};
    const planVal = App.demoMode ? 'Demo'
      : (sub.status === 'active' ? '<span style="color:var(--green);font-weight:700;">Active</span>'
        : (sub.status ? esc(String(sub.status)) : 'No active subscription'));
    const renewRaw = sub.period_end || sub.current_period_end;
    let renewVal = '';
    if (renewRaw) {
      const d = new Date(typeof renewRaw === 'number' ? (renewRaw > 1e12 ? renewRaw : renewRaw * 1000) : renewRaw);
      if (!isNaN(d.getTime())) renewVal = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const acctRows = kvRow('Operation', esc(s.bar_name || 'Your operation'))
      + (email ? kvRow('Signed in', esc(email)) : '')
      + kvRow('Plan', planVal)
      + (renewVal ? kvRow('Renews', esc(renewVal)) : '')
      + (isAdmin ? '<div style="display:flex;gap:14px;padding:9px 0;align-items:center;"><div style="width:120px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">Team</div><div style="flex:1;"><button class="btn btn-ghost btn-sm" data-act="user-team">Manage Members</button></div></div>' : '');
    const acctCard = card('Account', 'user-account', 'Manage', acctRows);

    // ── Configuration snapshot — how Bar Cop is tuned, at a glance ──
    const t    = s.targets || {};
    const rt   = ((App.data.revenue_settings || {}).targets) || {};
    const tg   = ((App.data.traffic_settings || {}).targets) || {};
    const urls = ((App.data.traffic_settings || {}).urls) || {};
    const fmt$0 = (v) => App.fmtCurrency(v || 0, 0);
    const periods = (s.service_periods || []).map(p => p && p.name).filter(Boolean);
    const platforms = App.TRAFFIC_PLATFORMS || [];
    const connected = platforms.filter(p => urls[p.urlKey]).length;

    const profileRows = kvRow('Operation', esc(s.bar_name || '') || dash)
      + kvRow('Location', esc(s.city_state || '') || dash)
      + kvRow('Phone', esc(s.phone || '') || dash)
      + kvRow('Address', esc(s.address || '') || dash)
      + kvRow('Bar Sales', s.annual_bar_revenue ? fmt$0(s.annual_bar_revenue) + '/yr' : dash)
      + kvRow('Food Sales', s.annual_food_revenue ? fmt$0(s.annual_food_revenue) + '/yr' : dash)
      + kvRow('Service Periods', periods.length ? esc(periods.join(' · ')) : dash)
      + kvRow('Links', platforms.length ? (connected + ' of ' + platforms.length + ' connected') : dash);
    const profileCard = card('Business Profile', 'settings-profile', 'Edit', profileRows);

    const targetRows = kvRow('Prime Cost', (t.prime_cost_pct ?? 60) + '%')
      + kvRow('Pour Cost', (t.bar_pour_cost_pct ?? 22) + '%')
      + kvRow('Food Cost', (t.food_cost_pct ?? 32) + '%')
      + kvRow('Labor Cost', (t.labor_cost_pct ?? 30) + '%')
      + kvRow('Check Average', fmt$0(rt.check_avg ?? 35))
      + kvRow('Google Rating', (tg.google_rating ?? 4.3) + ' ★');
    const targetCard = card('Recovery Targets', 'settings-targets', 'Edit', targetRows);

    mount.innerHTML = '<div class="screen">' + head + setupCard + acctCard + profileCard + targetCard + '</div>';
    this._wire();
  },

  _wire() {
    const go = (act) => {
      if (act === 'getting-started')       S.HubGettingStarted?.open?.();
      else if (act === 'user-account')     S.HubUserAccounts?.open?.('account');
      else if (act === 'user-team')        S.HubUserAccounts?.open?.('team');
      else if (act === 'settings-profile') S.HubSettings?.open?.('business-profile');
      else if (act === 'settings-targets') S.HubSettings?.open?.('recovery-targets');
    };
    this.container.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => go(el.dataset.act)));
  }

};
