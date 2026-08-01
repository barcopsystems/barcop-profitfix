'use strict';

/* ── Settings home — the Settings section landing / account + setup hub ───────
   Opens from the top-nav gear with the Settings sidebar (Setup + Settings +
   Account + Support). Summarizes setup completeness and the account, and
   jumps to the focused settings pages. */

S.HubSettingsHome = {

  open() {
    // SET-2: the demo may SEE the Settings overview. It is navigation and read-only snapshots
    // only — every control on it is a link to another Settings page, so there is nothing to guard.
    if (App._hubBlocked && App._hubBlocked()) return;   // Settings — not for Staff
    App.openHubFullPage('Settings', (mount) => { this.container = mount; this.render(mount); }, 'settings-home');
  },

  render(mount) {
    if (App.setHubTopbarActions) App.setHubTopbarActions('');

    // ── Snapshot cards render label/value rows as .pnl-list pills (the row-list
    // pill look, but keeps its two columns on mobile so a label never stacks
    // above its value). Each row is one attribute: a muted uppercase label cell
    // + the value cell. ──
    const dash = '<span style="color:var(--t3);">Not set</span>';
    const kvRow = (label, val) => '<tr>'
      + '<td style="width:130px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">' + label + '</td>'
      + '<td style="color:var(--t1);">' + val + '</td></tr>';
    const card = (title, act, btnLabel, rows) => '<div class="card form-card" style="margin-bottom:18px;">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span>' + title + '</span>'
      +   '<button class="btn btn-ghost btn-sm" data-act="' + act + '">' + btnLabel + '</button></div>'
      + '<table class="pnl-list"><tbody>' + rows.filter(Boolean).join('') + '</tbody></table></div>';

    // ── Account (subscription + renewal + team for admins) ──
    const s       = (App.data && App.data.settings) || {};
    const email   = (window.DB && DB._user && DB._user.email) || (App.demoMode ? 'Demo account' : '');
    const isAdmin = !!(window.DB && DB.isAdmin && DB.isAdmin());
    const isOwnerHere = App.demoMode || !!(window.DB && DB.isOwner && DB.isOwner());   // billing status is owner-only
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
      isOwnerHere ? kvRow('Plan', planVal) : '',
      isOwnerHere && renewVal ? kvRow('Renews', esc(renewVal)) : '',
      // Owner-only, matching the sidebar row and open('data')'s own refusal: a backup
      // is the whole account, so a restricted admin never gets a door to it.
      isOwnerHere ? kvRow('Backup', '<button class="btn btn-ghost btn-sm" data-act="user-data">Export or Restore</button>') : '',
      isAdmin ? kvRow('Team', '<button class="btn btn-ghost btn-sm" data-act="user-team">Manage Members</button>') : ''
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
      kvRow('Service Periods', periods.length ? esc(periods.join(' · ')) : dash)
    ];
    const profileCard = card('Business Profile', 'settings-profile', 'Edit', profileRows);

    const targetRows = [
      kvRow('Prime Cost', (t.prime_cost_pct ?? 60) + '%'),
      kvRow('Pour Cost', (t.bar_pour_cost_pct ?? 22) + '%'),
      kvRow('Food Cost', (t.food_cost_pct ?? 32) + '%'),
      kvRow('Labor Cost', (t.labor_cost_pct ?? 30) + '%'),
      kvRow('Check Average', fmt$0(rt.check_avg ?? 35)),
      kvRow('Comp Target', (rt.comp_pct ?? 3) + '%')
    ];
    const targetCard = card('Recovery Targets', 'settings-targets', 'Edit', targetRows);

    mount.innerHTML = '<div class="screen">' + acctCard + profileCard + targetCard + '</div>';
    this._wire();
  },

  _wire() {
    const go = (act) => {
      if (act === 'user-account')          S.HubUserAccounts?.open?.('account');
      else if (act === 'user-data')        S.HubUserAccounts?.open?.('data');
      else if (act === 'user-team')        S.HubUserAccounts?.open?.('team');
      else if (act === 'settings-profile') S.HubSettings?.open?.('business-profile');
      else if (act === 'settings-targets') S.HubSettings?.open?.('recovery-targets');
    };
    this.container.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => go(el.dataset.act)));
  }

};
