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

    // ── Account ──
    const s       = (App.data && App.data.settings) || {};
    const barName = s.bar_name || 'Your operation';
    const email   = (window.DB && DB._user && DB._user.email) || (App.demoMode ? 'Demo account' : '');
    const plan    = App.demoMode ? 'Demo' : 'Active';
    const acctRow = (label, val) => '<div style="display:flex;gap:14px;padding:9px 0;border-bottom:1px solid var(--b2);">'
      + '<div style="width:110px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);padding-top:2px;">' + label + '</div>'
      + '<div style="flex:1;font-size:13px;color:var(--t1);">' + val + '</div></div>';
    const acctCard = '<div class="card" style="margin-bottom:18px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);">Account</div>'
      +   '<button class="btn btn-ghost btn-sm" data-act="user-account">Manage</button>'
      + '</div>'
      + acctRow('Operation', esc(barName))
      + (email ? acctRow('Signed in', esc(email)) : '')
      + acctRow('Plan', plan)
      + '</div>';

    // ── Jump to ──
    const link = (act, label, sub) => '<div class="set-link" data-act="' + act + '" style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:16px 18px;cursor:pointer;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);">' + label + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:4px;line-height:1.5;">' + sub + '</div></div>';
    const links = '<div class="sh" style="margin:0 0 8px;">Jump To</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">'
      +   link('settings-profile', 'Business Profile', 'Name, sales, service periods, and your public links.')
      +   link('settings-targets', 'Recovery Targets', 'Profit, revenue, and traffic benchmarks Bar Cop measures against.')
      +   (complete ? '' : link('getting-started', 'Getting Started', 'The full setup checklist, step by step.'))
      +   link('user-account', 'Your Account', 'Password, subscription, and backups.')
      + '</div>';

    mount.innerHTML = '<div class="screen">' + head + setupCard + acctCard + links + '</div>';
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
