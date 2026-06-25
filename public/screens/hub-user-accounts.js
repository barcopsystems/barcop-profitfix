'use strict';

/* ── Hub User Accounts — Account + Team + Backup + Testing Tools ───────────
   A Hub-owned view (Phase 2 Item 25b). Holds everything related to who has
   access to this Bar Cop account, plus per-user concerns (password,
   subscription, data backup). App Settings is now strictly bar configuration
   (targets, profile, links). This screen is for users and access. */

S.HubUserAccounts = {

  // Permission groups: organized by module, each with two checkboxes per
  // member (Access + Allow Edit/Delete).
  // No pre-selected defaults. Admin explicitly checks every box for every
  // staff invite. Protects ownership from accidental over-permissioning.
  PERMISSION_GROUPS: [
    // Inventory Control
    { module: 'Inventory Control', key: 'inventory-dashboard', label: 'Inventory Overview (Dashboard)' },
    { module: 'Inventory Control', key: 'take-inventory',   label: 'Take Inventory' },
    { module: 'Inventory Control', key: 'receive-delivery', label: 'Receive Deliveries' },
    { module: 'Inventory Control', key: 'place-orders',     label: 'Place Orders' },
    { module: 'Inventory Control', key: 'spot-check',       label: 'Spot Checks' },
    { module: 'Inventory Control', key: 'manage-products',  label: 'Manage Products & Vendors' },
    { module: 'Inventory Control', key: 'inventory-reports',label: 'Inventory Reports' },
    // Labor Control
    { module: 'Labor Control',     key: 'labor-dashboard',  label: 'Labor Overview (Dashboard)' },
    { module: 'Labor Control',     key: 'log-hours',        label: 'Log Hours' },
    { module: 'Labor Control',     key: 'log-tips',         label: 'Log Tips' },
    { module: 'Labor Control',     key: 'view-schedule',    label: 'View Schedule' },
    { module: 'Labor Control',     key: 'manage-schedule',  label: 'Manage Schedule' },
    { module: 'Labor Control',     key: 'manage-staff',     label: 'Manage Staff & Positions' },
    { module: 'Labor Control',     key: 'call-out-log',     label: 'Call-Out Log' },
    { module: 'Labor Control',     key: 'time-off',         label: 'Time Off' },
    { module: 'Labor Control',     key: 'labor-reports',    label: 'Labor History' },
    // Shift Control
    { module: 'Shift Control',     key: 'shift-dashboard',  label: 'Shift Overview (Dashboard)' },
    { module: 'Shift Control',     key: 'cash-mgmt',        label: 'Cash Management' },
    { module: 'Shift Control',     key: 'checklists',       label: 'Opening / Closing Checklists' },
    { module: 'Shift Control',     key: 'void-comp',        label: 'Void / Comp Log' },
    { module: 'Shift Control',     key: 'maintenance',      label: 'Maintenance Log' },
    { module: 'Shift Control',     key: 'waste',            label: 'Waste / Spill Log' },
    // Recovery
    { module: 'Recovery',          key: 'profit-recovery',  label: 'Profit Recovery (all)' },
    { module: 'Recovery',          key: 'revenue-recovery', label: 'Revenue Recovery (all)' },
    { module: 'Recovery',          key: 'cash-recovery',    label: 'Cash Recovery (all)' },
    { module: 'Events',            key: 'events',           label: 'Events (all)' }
  ],

  // Full-page Hub screen. Sidebar stays mounted, content area swaps, topbar
  // shows "USER ACCOUNTS | Back to Dashboard".
  // Split across two Settings-sidebar pages so the long Team / permissions card
  // does not push everything down one scroll: 'account' = Your Account, 'team'
  // = Team Members (admin only). No group = both (backward compatible).
  async open(group) {
    if (window.DB && DB._ensureAccountId) await DB._ensureAccountId();
    const meta = {
      account: { title: 'Your Account',  action: 'user-account' },
      team:    { title: 'Team Members',  action: 'user-team' }
    };
    const g = meta[group] ? group : 'account';
    App.openHubFullPage(meta[g].title, (mount) => {
      this.container = mount;
      this.render(mount, g);
    }, meta[g].action);
  },

  render(container, group) {
    const userEmail = DB._user?.email || (App.demoMode ? 'Demo Account' : '');
    const isAdmin = (window.DB && DB.isAdmin && DB.isAdmin());
    const showTeam    = group !== 'account' && isAdmin;
    const showAccount = group !== 'team' || !showTeam;   // non-admin 'team' falls back to account

    const sh = (txt) => '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin:18px 0 12px;">' + txt + '</div>';
    const eye = (id) => '<button type="button" class="pw-eye" tabindex="-1" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);margin-left:6px;padding:0 9px;cursor:pointer;color:var(--t3);display:flex;align-items:center;flex-shrink:0;" onclick="const i=document.getElementById(\'' + id + '\');i.type=i.type===\'password\'?\'text\':\'password\';this.style.color=i.type===\'text\'?\'var(--gold)\':\'var(--t3)\';"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/></svg></button>';

    const accountCard = '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Your Account</div>'
      + (userEmail ? '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">Signed in as <span style="color:var(--t1);font-weight:600;">' + esc(userEmail) + '</span></div>' : '')
      + sh('Password')
      + '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
      +   '<div class="f" style="width:220px;"><label>New Password</label><div class="fw"><input class="suf" type="password" id="ua-pw1" placeholder="Enter new password" autocomplete="new-password"/>' + eye('ua-pw1') + '</div></div>'
      +   '<div class="f" style="width:220px;"><label>Confirm Password</label><div class="fw"><input class="suf" type="password" id="ua-pw2" placeholder="Confirm new password" autocomplete="new-password"/>' + eye('ua-pw2') + '</div></div>'
      +   '<div style="display:flex;align-items:flex-end;padding-bottom:1px;"><button class="btn btn-ghost" id="ua-pw-btn">Update Password</button></div>'
      + '</div>'
      + '<div id="ua-pw-msg" style="font-size:12px;margin-top:8px;display:none;"></div>'
      + sh('Subscription')
      + '<div id="ua-sub-content"></div>'
      + sh('Data and Backup')
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:14px;line-height:1.6;">Export a full backup of everything in your account: settings, weekly numbers, audits, and your Inventory, Labor, and Shift Control records, in one file you keep offsite. Restore from a backup to recover your data or move it.</div>'
      + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
      +   '<button class="btn btn-ghost" id="ua-export-data">Export Backup</button>'
      +   '<button class="btn btn-ghost" id="ua-import-btn">Restore from Backup</button>'
      +   '<input type="file" id="ua-import-file" accept="application/json,.json" style="display:none;"/>'
      + '</div>'
      + '<div id="ua-backup-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-top:12px;display:none;"></div>'
      + (App.demoMode ? '' :
          sh('Testing Tools')
          + '<div style="font-size:12px;color:var(--t2);margin-bottom:14px;line-height:1.6;">Load realistic sample data across every system to test calculations and layouts. Clear All Data wipes every record across Bar Cop and the Inventory, Labor, and Shift Control stores, and starts fresh.</div>'
          + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
          +   '<button class="btn btn-ghost" id="ua-load-sample">Load Sample Data</button>'
          +   '<button class="btn btn-danger" id="ua-clear-all">Clear All Data</button>'
          +   '<button class="btn btn-ghost" id="ua-reset-ob" style="margin-left:auto;">Reset Onboarding</button>'
          + '</div>'
          + '<div id="ua-test-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-top:12px;display:none;"></div>')
      + '</div>';

    const teamCard = showTeam ? '<div class="hs-card" style="background:var(--surface);border:1px solid var(--b1);border-radius:4px;padding:22px 24px;margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--b2);">'
      +   '<div style="flex:1;font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Team</div>'
      + '</div>'
      + sh('Members').replace('margin:18px', 'margin:2px')
      + '<div id="ua-team-members" style="font-size:12px;color:var(--t3);margin-bottom:8px;">Loading...</div>'
      + sh('Invite a Member')
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">Send an invite email. Admin sees everything. Viewer is read-only on all data, useful for a bookkeeper. Staff gets only the sections you check below, with optional edit and delete on each.</div>'
      + '<div class="form-row" style="gap:10px;flex-wrap:wrap;align-items:flex-end;">'
      +   '<div class="f" style="width:240px;"><label>Email Address</label><input type="email" id="ua-team-email" placeholder="bartender@email.com" autocomplete="off"/></div>'
      +   '<div class="f" style="width:120px;"><label>Role</label><select id="ua-team-role"><option value="staff">Staff</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select></div>'
      +   '<div><button class="btn btn-primary" id="ua-team-invite">Send Invite</button></div>'
      + '</div>'
      + '<div id="ua-team-perms-wrap" style="margin-top:16px;">' + this.renderPermsGrid({}, 'invite') + '</div>'
      + '<div id="ua-team-invite-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-top:10px;display:none;"></div>'
      + '</div>' : '';

    container.innerHTML =
      '<div class="screen">'
      + (showAccount ? accountCard : '')
      + (showTeam ? teamCard : '')
      + '</div>';

    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    this.wire();
    if (showAccount) this.renderSubscription();
    if (showTeam) { this._teamRoleChange(); this._teamRefresh(); }
  },

  renderPermsGrid(currentPerms, mode) {
    // Always starts from currentPerms (empty {} for new invites = all unchecked).
    // Admin explicitly chooses every section for every invite.
    const groups = this.PERMISSION_GROUPS;
    const byModule = {};
    groups.forEach(g => {
      if (!byModule[g.module]) byModule[g.module] = [];
      byModule[g.module].push(g);
    });

    let html = '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin:0 0 10px;">Permissions (Staff role only)</div>';
    html += '<div style="font-size:11px;color:var(--t3);margin-bottom:12px;">Check Access to grant the user that section. Check Allow Edit/Delete to additionally let them modify existing entries. Unchecked Allow Edit means they can only add new entries, not change past ones.</div>';
    html += '<div class="ua-perms-grid" style="border:1px solid var(--b2);border-radius:4px;background:var(--input);padding:14px 16px;">';

    Object.keys(byModule).forEach(mod => {
      html += '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t2);margin:8px 0 6px;border-bottom:1px solid var(--b2);padding-bottom:4px;">' + esc(mod) + '</div>';
      byModule[mod].forEach(g => {
        const current = (currentPerms || {})[g.key] || null;
        const access = current === 'add' || current === 'edit';
        const edit = current === 'edit';
        html += '<div style="display:flex;align-items:center;gap:12px;padding:5px 0;">'
          +   '<div style="flex:1;font-size:12px;color:var(--t1);">' + esc(g.label) + '</div>'
          +   '<label style="font-size:11px;color:var(--t2);display:flex;align-items:center;gap:5px;cursor:pointer;width:90px;"><input type="checkbox" class="ua-perm-access" data-key="' + esc(g.key) + '"' + (access ? ' checked' : '') + '/>Access</label>'
          +   '<label style="font-size:11px;color:var(--t2);display:flex;align-items:center;gap:5px;cursor:pointer;width:140px;"><input type="checkbox" class="ua-perm-edit" data-key="' + esc(g.key) + '"' + (edit ? ' checked' : '') + (access ? '' : ' disabled') + '/>Allow Edit/Delete</label>'
          + '</div>';
      });
    });

    html += '</div>';
    return html;
  },

  // Read the current state of the permissions grid into a permissions object.
  // root scopes the query to a specific container (modal box or invite wrap),
  // so when both the invite form AND the edit modal are in the DOM we don't
  // mix their checkbox states.
  collectPerms(root) {
    const scope = root || document;
    const out = {};
    scope.querySelectorAll('.ua-perm-access').forEach(box => {
      const key = box.dataset.key;
      if (box.checked) {
        const editBox = scope.querySelector('.ua-perm-edit[data-key="' + key + '"]');
        out[key] = (editBox && editBox.checked) ? 'edit' : 'add';
      }
    });
    return out;
  },

  // ── Wiring ────────────────────────────────────────────────────────────────
  wire() {
    document.getElementById('ua-pw-btn')?.addEventListener('click', () => this.changePassword());
    document.getElementById('ua-export-data')?.addEventListener('click', () => this.exportBackup());
    document.getElementById('ua-import-btn')?.addEventListener('click', () => document.getElementById('ua-import-file')?.click());
    document.getElementById('ua-import-file')?.addEventListener('change', (e) => this.importBackup(e));
    document.getElementById('ua-load-sample')?.addEventListener('click', () => this.loadSample());
    document.getElementById('ua-clear-all')?.addEventListener('click', () => this.clearAll());
    document.getElementById('ua-reset-ob')?.addEventListener('click', async () => {
      App.data.settings.onboarding_complete = false;
      await App.saveKey('settings');
      window.location.reload();
    });

    document.getElementById('ua-team-invite')?.addEventListener('click', () => this._teamInvite());
    document.getElementById('ua-team-role')?.addEventListener('change', () => this._teamRoleChange());

    // Wire the INVITE form's perms grid (scoped to its wrap so it doesn't
    // collide with the Edit Permissions modal when that opens).
    const inviteWrap = document.getElementById('ua-team-perms-wrap');
    this._wirePermsGrid(inviteWrap);
  },

  _wirePermsGrid(root) {
    const scope = root || document;
    scope.querySelectorAll('.ua-perm-access').forEach(box => {
      box.addEventListener('change', () => {
        const editBox = scope.querySelector('.ua-perm-edit[data-key="' + box.dataset.key + '"]');
        if (editBox) {
          if (box.checked) {
            editBox.disabled = false;
          } else {
            editBox.checked = false;
            editBox.disabled = true;
          }
        }
      });
    });
  },

  _teamRoleChange() {
    const role = document.getElementById('ua-team-role')?.value || 'staff';
    const wrap = document.getElementById('ua-team-perms-wrap');
    if (!wrap) return;
    wrap.style.display = (role === 'staff') ? '' : 'none';
  },

  // ── Subscription rendering — same logic as the old App Settings card ─────
  async renderSubscription() {
    const el = document.getElementById('ua-sub-content');
    if (!el) return;
    if (App.demoMode) {
      el.innerHTML = '<div style="font-size:12px;color:var(--t3);">Subscription details are hidden in demo mode.</div>';
      return;
    }
    const sub = App.subscription || { status: 'inactive', plan: null };
    if (sub.status === 'active') {
      el.innerHTML = '<div style="font-size:12px;color:var(--t2);line-height:1.7;">Bar Cop Recovery Platform · '
        + 'Status: <span style="color:var(--green);font-weight:700;">Active</span></div>'
        + '<div style="margin-top:10px;"><button class="btn btn-ghost" id="ua-billing-portal">Manage Billing</button></div>'
        + '<div id="ua-billing-msg" style="display:none;font-size:11px;color:var(--red);margin-top:8px;"></div>';
      document.getElementById('ua-billing-portal')?.addEventListener('click', async () => {
        const msg = document.getElementById('ua-billing-msg');
        const showErr = (t) => { if (msg) { msg.textContent = t; msg.style.display = 'block'; } };
        try {
          const r = await fetch('/api/billing-portal', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: DB._user?.id })
          });
          const data = await r.json();
          if (data.url) { window.location.href = data.url; return; }
          showErr('Could not open billing right now. Try again, or contact support.');
        } catch (e) {
          showErr('Connection error. Check your connection and try again.');
        }
      });
    } else {
      el.innerHTML = '<div style="font-size:12px;color:var(--t2);line-height:1.7;">No active subscription on this account.</div>';
    }
  },

  // ── Password change — copied from settings.js ────────────────────────────
  async changePassword() {
    const pw1 = document.getElementById('ua-pw1').value;
    const pw2 = document.getElementById('ua-pw2').value;
    const msg = document.getElementById('ua-pw-msg');
    if (!pw1 || pw1.length < 8) { msg.style.color='var(--red)'; msg.textContent='Password must be at least 8 characters.'; msg.style.display='block'; return; }
    if (pw1 !== pw2) { msg.style.color='var(--red)'; msg.textContent='Passwords do not match.'; msg.style.display='block'; return; }
    const btn = document.getElementById('ua-pw-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      const { error } = await DB._sb.auth.updateUser({ password: pw1 });
      if (error) {
        msg.style.color = 'var(--red)'; msg.textContent = error.message; msg.style.display = 'block';
      } else {
        msg.style.color = 'var(--gold)'; msg.textContent = 'Password updated.'; msg.style.display = 'block';
        document.getElementById('ua-pw1').value = ''; document.getElementById('ua-pw2').value = '';
      }
    } finally {
      btn.disabled = false; btn.textContent = 'Update Password';
    }
  },

  // ── Backup export/import/sample helpers — delegate to S.HubSettings ──────
  exportBackup() { S.HubSettings?.exportBackup?.call(this._asSettingsHost('ua-backup-msg')); },
  importBackup(e) { S.HubSettings?.importBackup?.call(this._asSettingsHost('ua-backup-msg'), e); },
  loadSample() { S.HubSettings?.loadSample?.call(this._asSettingsHost('ua-test-msg')); },
  clearAll() { S.HubSettings?.clearAll?.call(this._asSettingsHost('ua-test-msg')); },
  _asSettingsHost(msgId) {
    // Provide a small shim so S.HubSettings helpers can find the right msg <div>
    // by overriding the _backupMsg/_testMsg targets via document.getElementById.
    return S.HubSettings;
  },

  // ── Team management (Phase 2 Item 25b) ────────────────────────────────────
  async _teamAuthHeaders() {
    // Force-refresh the JWT if it's expiring within 2 minutes (or has
    // already expired). supabase-js auto-refreshes in the background, but
    // the auto-refresher can lapse if the tab has been idle or backgrounded
    // for hours, leaving getSession() to return a stale token that the
    // server rejects with "Invalid auth token." Refreshing here costs one
    // extra round-trip on Team operations, which are infrequent.
    //
    // If the refresh itself fails (refresh token gone bad alongside the
    // access token), the only recovery is a fresh sign-in, so we
    // auto-sign-out and return null. Callers bail when headers is null;
    // the SIGNED_OUT event routes the operator to the auth screen.
    let session = null;
    let refreshFailed = false;
    try {
      const cur = await DB._sb?.auth.getSession();
      session = cur?.data?.session || null;
      const expiresAt = session?.expires_at || 0;
      const nowSec = Math.floor(Date.now() / 1000);
      if (!session || expiresAt - nowSec < 120) {
        const refreshed = await DB._sb?.auth.refreshSession();
        const newSession = refreshed?.data?.session || null;
        if (newSession && newSession.access_token) {
          session = newSession;
        } else {
          refreshFailed = true;
        }
      }
    } catch (e) {
      refreshFailed = true;
    }

    if (refreshFailed) {
      const expiresAt = session?.expires_at || 0;
      const nowSec = Math.floor(Date.now() / 1000);
      if (!session || expiresAt - nowSec < 0) {
        try { await DB.signOut(); } catch (e) {}
        return null;
      }
    }

    const token = session?.access_token;
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  },

  async _teamRefresh() {
    const box = document.getElementById('ua-team-members');
    if (!box) return;
    if (App.demoMode) {
      box.innerHTML = '<div style="color:var(--t3);">Team management is disabled in demo mode.</div>';
      return;
    }
    const accountId = await DB._ensureAccountId();
    if (!accountId) {
      box.innerHTML = '<div style="color:var(--t3);">No account found.</div>';
      return;
    }
    try {
      const headers = await this._teamAuthHeaders();
      if (!headers) return;
      const r = await fetch('/api/list-members', {
        method: 'POST', headers, body: JSON.stringify({ accountId })
      });
      const data = await r.json();
      if (!data.ok) {
        box.innerHTML = '<div style="color:var(--t3);">' + esc(data.error || 'Could not load members.') + '</div>';
        return;
      }
      this._teamRenderMembers(data.members || []);
    } catch (e) {
      box.innerHTML = '<div style="color:var(--t3);">Connection error.</div>';
    }
  },

  _teamRenderMembers(members) {
    const box = document.getElementById('ua-team-members');
    if (!box) return;

    const rows = members.map(m => {
      const isSelf = m.is_self;
      const roleCell = !isSelf
        ? '<select data-mid="' + esc(m.id) + '" class="ua-team-role-sel" style="font-size:12px;padding:4px 8px;">'
            + '<option value="admin"' + (m.role === 'admin' ? ' selected' : '') + '>Admin</option>'
            + '<option value="staff"' + (m.role === 'staff' ? ' selected' : '') + '>Staff</option>'
            + '<option value="viewer"' + (m.role === 'viewer' ? ' selected' : '') + '>Viewer</option>'
          + '</select>'
        : '<span style="text-transform:capitalize;font-weight:600;color:var(--t1);">' + esc(m.role) + '</span>';

      const statusBadge = m.confirmed ? ''
        : '<span style="font-size:9px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:1.5px;margin-left:10px;">Pending</span>';

      const editPermsBtn = (!isSelf && m.role === 'staff')
        ? '<button class="btn btn-ghost btn-sm ua-team-perms" data-mid="' + esc(m.id) + '" data-perms="' + esc(JSON.stringify(m.permissions || {})) + '" data-email="' + esc(m.email) + '" style="font-size:10px;padding:3px 9px;">Edit Access</button>'
        : '';

      const removeBtn = !isSelf
        ? '<button class="btn btn-ghost btn-sm ua-team-remove" data-mid="' + esc(m.id) + '" data-email="' + esc(m.email) + '" style="font-size:10px;padding:3px 9px;">Remove</button>'
        : '<span style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:1.5px;">You</span>';

      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--b2);flex-wrap:wrap;">'
        +   '<div style="flex:1;min-width:160px;font-size:13px;color:var(--t1);">' + esc(m.email) + statusBadge + '</div>'
        +   '<div style="width:130px;">' + roleCell + '</div>'
        +   '<div style="width:100px;text-align:right;">' + editPermsBtn + '</div>'
        +   '<div style="width:90px;text-align:right;">' + removeBtn + '</div>'
        + '</div>';
    }).join('');

    box.innerHTML = rows || '<div style="color:var(--t3);">No members yet.</div>';

    box.querySelectorAll('.ua-team-role-sel').forEach(sel => {
      sel.addEventListener('change', (ev) => this._teamUpdateRole(sel.dataset.mid, ev.target.value));
    });
    box.querySelectorAll('.ua-team-remove').forEach(btn => {
      btn.addEventListener('click', () => this._teamRemove(btn.dataset.mid, btn.dataset.email));
    });
    box.querySelectorAll('.ua-team-perms').forEach(btn => {
      btn.addEventListener('click', () => {
        let perms = {};
        try { perms = JSON.parse(btn.dataset.perms || '{}'); } catch (e) {}
        this._teamEditPerms(btn.dataset.mid, btn.dataset.email, perms);
      });
    });
  },

  _teamMsg(text, color) {
    const el = document.getElementById('ua-team-invite-msg');
    if (!el) return;
    el.style.color = color;
    el.textContent = text;
    el.style.display = '';
    setTimeout(() => { el.style.display = 'none'; }, 4500);
  },

  _teamModal(opts) {
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;';
    const box = document.createElement('div');
    const maxWidth = opts.wide ? '700px' : '420px';
    box.style.cssText = 'background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:' + maxWidth + ';width:100%;max-height:85vh;overflow-y:auto;';
    const msgColor = opts.tone === 'error' ? 'var(--red)' : 'var(--t1)';
    const buttons = (opts.buttons || [{ label: 'OK', act: 'ok', kind: 'ghost' }])
      .map(b => '<button class="btn btn-' + (b.kind || 'ghost') + '" data-act="' + esc(b.act) + '">' + esc(b.label) + '</button>')
      .join('');
    const header = opts.title ? '<div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:14px;">' + esc(opts.title) + '</div>' : '';
    const body = opts.bodyHTML || '<div style="font-size:13px;color:' + msgColor + ';line-height:1.6;margin-bottom:20px;">' + esc(opts.message || '') + '</div>';
    box.innerHTML = header + body + '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">' + buttons + '</div>';
    m.appendChild(box);
    document.body.appendChild(m);
    const close = () => m.remove();
    box.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (opts.onAction) {
          const result = opts.onAction(act, box);
          if (result === false) return;  // onAction can cancel close
        }
        close();
      });
    });
    m.addEventListener('click', ev => { if (ev.target === m) close(); });
    return box;
  },

  async _teamInvite() {
    const emailInput = document.getElementById('ua-team-email');
    const roleSelect = document.getElementById('ua-team-role');
    const btn = document.getElementById('ua-team-invite');
    const email = (emailInput?.value || '').trim().toLowerCase();
    const role = roleSelect?.value || 'staff';

    if (!email || email.indexOf('@') < 1) {
      this._teamMsg('Enter a valid email address.', 'var(--red)');
      return;
    }
    const accountId = await DB._ensureAccountId();
    if (!accountId) {
      this._teamMsg('No account found.', 'var(--red)');
      return;
    }

    const inviteWrap = document.getElementById('ua-team-perms-wrap');
    const permissions = (role === 'staff') ? this.collectPerms(inviteWrap) : {};

    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

    try {
      const headers = await this._teamAuthHeaders();
      if (!headers) return;
      const r = await fetch('/api/invite-user', {
        method: 'POST', headers,
        body: JSON.stringify({ email, accountId, role, permissions })
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        this._teamMsg(data.error || 'Invite failed.', 'var(--red)');
      } else if (data.addedDirectly) {
        const tail = data.emailSent
          ? ' They will receive an email to set their password.'
          : ' They already have a Bar Cop account.';
        this._teamMsg('Added ' + email + ' to your team.' + tail, 'var(--gold)');
        if (emailInput) emailInput.value = '';
        this._teamRefresh();
      } else {
        this._teamMsg('Invite sent to ' + email + '.', 'var(--gold)');
        if (emailInput) emailInput.value = '';
        this._teamRefresh();
      }
    } catch (e) {
      this._teamMsg('Connection error. Try again.', 'var(--red)');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Send Invite'; }
    }
  },

  async _teamUpdateRole(membershipId, newRole) {
    const accountId = await DB._ensureAccountId();
    if (!accountId) return;
    try {
      const headers = await this._teamAuthHeaders();
      if (!headers) return;
      const r = await fetch('/api/update-member-role', {
        method: 'POST', headers,
        body: JSON.stringify({ accountId, membershipId, newRole })
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        this._teamModal({ message: data.error || 'Could not change role.', tone: 'error' });
      }
      this._teamRefresh();
    } catch (e) {
      this._teamModal({ message: 'Connection error.', tone: 'error' });
      this._teamRefresh();
    }
  },

  async _teamRemove(membershipId, email) {
    this._teamModal({
      title: 'Remove member',
      message: 'Remove ' + (email || 'this member') + ' from your account? They will lose access immediately.',
      buttons: [
        { label: 'Cancel', act: 'cancel', kind: 'ghost' },
        { label: 'Remove', act: 'ok', kind: 'danger' }
      ],
      onAction: async (act) => {
        if (act !== 'ok') return;
        const accountId = await DB._ensureAccountId();
        if (!accountId) return;
        try {
          const headers = await this._teamAuthHeaders();
          if (!headers) return;
          const r = await fetch('/api/remove-member', {
            method: 'POST', headers,
            body: JSON.stringify({ accountId, membershipId })
          });
          const data = await r.json();
          if (!r.ok || !data.ok) {
            this._teamModal({ message: data.error || 'Could not remove member.', tone: 'error' });
          }
          this._teamRefresh();
        } catch (e) {
          this._teamModal({ message: 'Connection error.', tone: 'error' });
          this._teamRefresh();
        }
      }
    });
  },

  _teamEditPerms(membershipId, email, currentPerms) {
    const gridHTML = this.renderPermsGrid(currentPerms, 'edit');
    const box = this._teamModal({
      title: 'Edit Access for ' + email,
      wide: true,
      bodyHTML: gridHTML,
      buttons: [
        { label: 'Cancel', act: 'cancel', kind: 'ghost' },
        { label: 'Save Permissions', act: 'ok', kind: 'primary' }
      ],
      onAction: async (act, modalBox) => {
        if (act !== 'ok') return;
        // Scope to the modal so we read only the modal's checkboxes, not the
        // invite form's grid that lives elsewhere on the same page.
        const newPerms = this.collectPerms(modalBox);
        const accountId = await DB._ensureAccountId();
        if (!accountId) return;
        try {
          const headers = await this._teamAuthHeaders();
          if (!headers) return;
          const r = await fetch('/api/update-member-permissions', {
            method: 'POST', headers,
            body: JSON.stringify({ accountId, membershipId, permissions: newPerms })
          });
          const data = await r.json();
          if (!r.ok || !data.ok) {
            await App.confirm({ title: 'Could not save', message: data.error || 'Could not save permissions.', confirmText: 'OK', cancelText: '' });
          }
          this._teamRefresh();
        } catch (e) {
          await App.confirm({ title: 'Connection error', message: 'Could not reach the server. Try again.', confirmText: 'OK', cancelText: '' });
          this._teamRefresh();
        }
      }
    });
    // Wire the modal's checkboxes (scoped) so toggling Access enables/disables
    // the matching Allow Edit/Delete checkbox in the modal only.
    this._wirePermsGrid(box);
  }
};
