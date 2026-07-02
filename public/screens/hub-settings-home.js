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

    // ── Shared #0D181E data-row block helpers ──
    // finish(): stamp the --row-div divider on every row but the last (rows carry a {{div}} placeholder).
    const finish = (rows) => {
      const items = rows.filter(Boolean);
      return items.map((r, i) => r.replace('{{div}}', i < items.length - 1 ? 'border-bottom:1px solid var(--row-div);' : '')).join('');
    };
    // insetBlock = rows in a rounded --b-edge container (sits inside a card that has other content above it, e.g. Setup).
    const insetBlock = (rows) => '<div style="border:1px solid var(--b-edge);border-radius:6px;overflow:hidden;">' + finish(rows) + '</div>';
    // bleedBlock = rows pulled flush to the card's left / right / bottom edges (the card carries overflow:hidden).
    const bleedBlock = (rows) => '<div class="kv-bleed">' + finish(rows) + '</div>';
    const dash = '<span style="color:var(--t3);">Not set</span>';
    const kvRow = (label, val) => '<div style="display:flex;gap:14px;padding:11px 20px;background:#0D181E;{{div}}">'
      + '<div style="width:120px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);padding-top:2px;flex-shrink:0;">' + label + '</div>'
      + '<div style="flex:1;font-size:13px;color:var(--t1);min-width:0;">' + val + '</div></div>';
    // The Account / Profile / Targets cards bleed their data rows to the card edges (data-card look):
    // overflow:hidden clips the rounded corners, the title's bottom margin is dropped so rows sit flush under the band.
    const card = (title, act, btnLabel, rows) => '<div class="card form-card" style="margin-bottom:18px;overflow:hidden;">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:0;"><span>' + title + '</span>'
      +   '<button class="btn btn-ghost btn-sm" data-act="' + act + '">' + btnLabel + '</button></div>'
      + bleedBlock(rows) + '</div>';

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
    const acctRows = [
      kvRow('Operation', esc(s.bar_name || 'Your operation')),
      email ? kvRow('Signed in', esc(email)) : '',
      kvRow('Plan', planVal),
      renewVal ? kvRow('Renews', esc(renewVal)) : '',
      isAdmin ? '<div style="display:flex;gap:14px;padding:11px 20px;background:#0D181E;align-items:center;{{div}}"><div style="width:120px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">Team</div><div style="flex:1;"><button class="btn btn-ghost btn-sm" data-act="user-team">Manage Members</button></div></div>' : ''
    ];
    const acctCard = card('Account', 'user-account', 'Manage', acctRows);

    // ── Configuration snapshot — how Bar Cop is tuned, at a glance ──
    const t    = s.targets || {};
    const rt   = ((App.data.revenue_settings || {}).targets) || {};
    const fmt$0 = (v) => App.fmtCurrency(v || 0, 0);
    const periods = (s.service_periods || []).map(p => p && p.name).filter(Boolean);

    const profileRows = [
      kvRow('Operation', esc(s.bar_name || '') || dash),
      kvRow('Location', esc(s.city_state || '') || dash),
      kvRow('Phone', esc(s.phone || '') || dash),
      kvRow('Address', esc(s.address || '') || dash),
      kvRow('Bar Sales', s.annual_bar_revenue ? fmt$0(s.annual_bar_revenue) + '/yr' : dash),
      kvRow('Food Sales', s.annual_food_revenue ? fmt$0(s.annual_food_revenue) + '/yr' : dash),
      kvRow('Service Periods', periods.length ? esc(periods.join(' · ')) : dash)
    ];
    const profileCard = card('Business Profile', 'settings-profile', 'Edit', profileRows);

    const targetRows = [
      kvRow('Prime Cost', (t.prime_cost_pct ?? 60) + '%'),
      kvRow('Pour Cost', (t.bar_pour_cost_pct ?? 22) + '%'),
      kvRow('Food Cost', (t.food_cost_pct ?? 32) + '%'),
      kvRow('Labor Cost', (t.labor_cost_pct ?? 30) + '%'),
      kvRow('Check Average', fmt$0(rt.check_avg ?? 35))
    ];
    const targetCard = card('Recovery Targets', 'settings-targets', 'Edit', targetRows);

    mount.innerHTML = '<div class="screen">' + acctCard + profileCard + targetCard + '</div>';
    this._wire();
  },

  _wire() {
    const go = (act) => {
      if (act === 'user-account')          S.HubUserAccounts?.open?.('account');
      else if (act === 'user-team')        S.HubUserAccounts?.open?.('team');
      else if (act === 'settings-profile') S.HubSettings?.open?.('business-profile');
      else if (act === 'settings-targets') S.HubSettings?.open?.('recovery-targets');
    };
    this.container.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => go(el.dataset.act)));
  }

};
