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
  // Permissions are granted by OPERATING AREA (matching how the whole app is
  // organized), each set to a level: View / Add / Edit & Delete. Owner grants
  // "Inventory: Edit" instead of toggling 40 individual screens.
  AREAS: [
    { key: 'inventory', label: 'Inventory Control' },
    { key: 'labor',     label: 'Labor Control' },
    { key: 'shift',     label: 'Shift Control' },
    { key: 'profit',    label: 'Profit Recovery' },
    { key: 'revenue',   label: 'Revenue Recovery' },
    { key: 'cash',      label: 'Cash Recovery' },
    { key: 'events',    label: 'Events' },
    { key: 'books',     label: 'Books' },
    { key: 'audit',     label: 'Bar Cop Audit' }
  ],

  // Full-page Hub screen. Sidebar stays mounted, content area swaps, topbar
  // shows "USER ACCOUNTS | Back to Dashboard".
  // Split across two Settings-sidebar pages so the long Team / permissions card
  // does not push everything down one scroll: 'account' = Your Account, 'team'
  // = Team Members (admin only). No group = both (backward compatible).
  async open(group) {
    if (App.demoBlock && App.demoBlock()) return;   // App Settings (incl. Your Account) is off in the demo
    const meta = {
      account: { title: 'Your Account',  action: 'user-account' },
      team:    { title: 'Team Members',  action: 'user-team' }
    };
    const g = meta[group] ? group : 'account';
    // Staff can reach Your Account (to change their password — the page renders
    // password-only for them) but nothing else here. Everyone else uses the
    // standard management-only gate.
    const role = (window.DB && DB.role && DB.role()) || null;
    if (role === 'staff') {
      if (g !== 'account') { App.showNoAccess(); return; }
    } else if (App._hubBlocked && App._hubBlocked()) {
      return;
    }
    if (window.DB && DB._ensureAccountId) await DB._ensureAccountId();
    App.openHubFullPage(meta[g].title, (mount) => {
      this.container = mount;
      this.render(mount, g);
    }, meta[g].action);
  },

  render(container, group) {
    const userEmail = DB._user?.email || (App.demoMode ? 'Demo Account' : '');
    const isAdmin = (window.DB && DB.isAdmin && DB.isAdmin());
    const isOwnerNow = !!(window.DB && DB.isOwner && DB.isOwner());   // only the owner invites admins
    const showTeam    = group !== 'account' && isAdmin;
    const showAccount = group !== 'team' || !showTeam;   // non-admin 'team' falls back to account

    const sh = (txt) => '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin:18px 0 12px;">' + txt + '</div>';
    const eye = (id) => '<button type="button" class="pw-eye" tabindex="-1" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);margin-left:6px;padding:0 9px;cursor:pointer;color:var(--t3);display:flex;align-items:center;flex-shrink:0;" onclick="const i=document.getElementById(\'' + id + '\');i.type=i.type===\'password\'?\'text\':\'password\';this.style.color=i.type===\'text\'?\'var(--gold)\':\'var(--t3)\';"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/></svg></button>';

    // Section bodies (the title lives in the wrapper, added below).
    const pwBody = '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
      +   '<div class="f" style="width:220px;"><label>New Password</label><div class="fw"><input class="suf" type="password" id="ua-pw1" placeholder="Enter new password" autocomplete="new-password"/>' + eye('ua-pw1') + '</div></div>'
      +   '<div class="f" style="width:220px;"><label>Confirm Password</label><div class="fw"><input class="suf" type="password" id="ua-pw2" placeholder="Confirm new password" autocomplete="new-password"/>' + eye('ua-pw2') + '</div></div>'
      + '</div>'
      + '<div style="margin-top:12px;"><button class="btn btn-ghost" id="ua-pw-btn">Update Password</button></div>'
      + '<div id="ua-pw-msg" style="font-size:12px;margin-top:8px;display:none;"></div>';
    const barsBody = '<div style="font-size:12px;color:var(--t2);margin-bottom:14px;line-height:1.6;">Each bar is its own subscription and books. Switch between them up top.</div>'
      + '<button class="btn btn-ghost" id="ua-add-bar">Add Another Bar</button>';
    const backupBody = '<div style="font-size:12px;color:var(--t2);margin-bottom:14px;line-height:1.6;">Export everything to one file you keep offsite. Restore to recover or move your data.</div>'
      + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
      +   '<button class="btn btn-ghost" id="ua-export-data">Export Backup</button>'
      +   '<button class="btn btn-ghost" id="ua-import-btn">Restore from Backup</button>'
      +   '<input type="file" id="ua-import-file" accept="application/json,.json" style="display:none;"/>'
      + '</div>'
      + '<div id="ua-backup-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-top:12px;display:none;"></div>';
    const testBody = '<div style="font-size:12px;color:var(--t2);margin-bottom:14px;line-height:1.6;">Load sample data to test, or clear everything and start fresh.</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      +   '<button class="btn btn-ghost" id="ua-load-sample">Load Sample Data</button>'
      +   '<button class="btn btn-danger" id="ua-clear-all">Clear All Data</button>'
      +   '<button class="btn btn-ghost" id="ua-reset-ob" style="margin-left:auto;">Reset Onboarding</button>'
      + '</div>'
      + '<div id="ua-test-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-top:12px;display:none;"></div>';

    // Password is for everyone. Billing (Subscription + Multiple Locations) and
    // account-wide Data & Backup are OWNER-ONLY (a restricted admin must not be
    // able to export the whole account). Staff get password only; a non-owner
    // admin gets password here (their bar config lives on the Settings pages).
    // Testing Tools stays dev-account only.
    const isStaff = (window.DB && DB.role && DB.role()) === 'staff';
    const sections = [{ title: 'Password', body: pwBody }];
    if (isOwnerNow) {
      sections.push({ title: 'Subscription', body: '<div id="ua-sub-content"></div>' });
      if (!App.demoMode) sections.push({ title: 'Multiple Locations', body: barsBody });
      sections.push({ title: 'Data and Backup', body: backupBody });
    }
    if (!isStaff && !App.demoMode && App.isDevAccount && App.isDevAccount()) sections.push({ title: 'Testing Tools', body: testBody });

    // Each section wrapped in the same dark box + grey title as Business Profile
    // and Recovery Targets, all inside one page card (last section's margin
    // trimmed so the card's bottom padding stays even).
    const secLabel = 'font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;';
    const cardInner = sections.map((s, i) =>
      '<div class="auth-inputs" style="text-align:left;margin-bottom:' + (i === sections.length - 1 ? '0' : '16') + 'px;">'
      + '<div style="' + secLabel + '">' + s.title + '</div>'
      + s.body
      + '</div>'
    ).join('');

    // "Your Account" + Signed-in-as sit inside the card on the card background
    // (the only part not in an inner wrapper), above the wrapped sections.
    const accountHeader = '<div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:6px;">Your Account</div>'
      + (userEmail ? '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:16px;">Signed in as <span style="color:var(--t1);font-weight:600;">' + esc(userEmail) + '</span></div>' : '');
    const accountCard = '<div class="card form-card" style="margin-bottom:16px;">' + accountHeader + cardInner + '</div>';

    // Team Members heading + the member list sit on the card background (like
    // Your Account); a divider separates them from Invite a Member below.
    const teamCard = showTeam ? '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:14px;">Team Members</div>'
      + '<div id="ua-team-members" style="font-size:12px;color:var(--t3);margin-bottom:2px;">Loading...</div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--t3);margin:24px 0 14px;">Invite a Member</div>'
      + '<div class="form-row" style="gap:10px;flex-wrap:wrap;align-items:flex-end;">'
      +   '<div class="f" style="width:240px;"><label>Email Address</label><input type="email" id="ua-team-email" placeholder="name@email.com" autocomplete="off"/></div>'
      +   '<div class="f" style="width:120px;"><label>Role</label><select id="ua-team-role"><option value="staff">Staff</option>' + (isOwnerNow ? '<option value="admin">Admin</option>' : '') + '</select></div>'
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
    if (showAccount && isOwnerNow) this.renderSubscription();   // Subscription section is owner-only
    if (showTeam) { this._teamRoleChange(); this._teamRefresh(); }
  },

  // One dropdown per operating area: No Access / Full Access. currentPerms =
  // { area: 'edit' } (empty {} = all No Access). A non-owner admin only sees the
  // areas they themselves hold (they can't grant an area they don't have); the
  // owner sees all areas.
  renderPermsGrid(currentPerms, mode) {
    const perms = currentPerms || {};
    const isOwner = !!(window.DB && DB.isOwner && DB.isOwner());
    const myPerms = (window.DB && DB.permissions) ? DB.permissions() : {};
    const LEVELS = [
      { v: '',     t: 'No Access' },
      { v: 'edit', t: 'Full Access' }
    ];
    let html = '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin:0 0 6px;">Permissions</div>';
    if (mode !== 'edit') {   // the Edit Access popup carries no explainer text
      html += '<div style="font-size:11px;color:var(--t3);margin-bottom:12px;line-height:1.5;">Choose which areas this member can use. Full Access = see and change everything in that area. No Access = the area is hidden from them.</div>';
    }
    const grantable = this.AREAS.filter(a => isOwner || myPerms[a.key]);
    if (!grantable.length) {
      html += '<div style="font-size:12px;color:var(--t3);line-height:1.5;">You do not have access to any areas you can grant. Ask the owner to expand your access first.</div>';
      return html;
    }
    // Each area is its own #0D181E data-row pill (the .pnl-list row look used on
    // the App Settings landing): area label left, the access dropdown right.
    html += '<table class="pnl-list"><tbody>';
    grantable.forEach((a) => {
      const cur = perms[a.key] ? 'edit' : '';   // any stored access = Full
      const opts = LEVELS
        .map(l => '<option value="' + l.v + '"' + (cur === l.v ? ' selected' : '') + '>' + l.t + '</option>').join('');
      html += '<tr>'
        + '<td style="font-size:13px;color:var(--t1);">' + esc(a.label) + '</td>'
        + '<td style="text-align:right;"><select class="ua-perm-level" data-key="' + esc(a.key) + '" style="width:155px;">' + opts + '</select></td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    return html;
  },

  // Read the per-area dropdowns into a permissions object { area: level }.
  // root scopes the query so the invite form and the edit modal never mix.
  collectPerms(root) {
    const scope = root || document;
    const out = {};
    scope.querySelectorAll('.ua-perm-level').forEach(sel => {
      const key = sel.dataset.key;
      if (key && sel.value) out[key] = sel.value;
    });
    return out;
  },

  // ── Wiring ────────────────────────────────────────────────────────────────
  wire() {
    document.getElementById('ua-pw-btn')?.addEventListener('click', () => this.changePassword());
    document.getElementById('ua-export-data')?.addEventListener('click', () => this.exportBackup());
    document.getElementById('ua-import-btn')?.addEventListener('click', () => document.getElementById('ua-import-file')?.click());
    document.getElementById('ua-import-file')?.addEventListener('change', (e) => this.importBackup(e));
    document.getElementById('ua-add-bar')?.addEventListener('click', () => this._addBar());
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

  // The area dropdowns are self-contained (each is one control), so there is no
  // cross-checkbox wiring to do. Kept as a no-op so existing callers are safe.
  _wirePermsGrid(root) {},

  _teamRoleChange() {
    // Both Admin and Staff carry an owner-set area grid now, so the grid shows
    // for either role (only the owner is grid-less, and the owner is not an
    // invitable role).
    const wrap = document.getElementById('ua-team-perms-wrap');
    if (wrap) wrap.style.display = '';
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
    const isOwner = !!(window.DB && DB.isOwner && DB.isOwner());
    if (sub.status === 'active') {
      el.innerHTML = '<div style="font-size:12px;color:var(--t2);line-height:1.7;">Bar Cop · '
        + 'Status: <span style="color:var(--green);font-weight:700;">Active</span></div>'
        + (isOwner
            ? '<div style="margin-top:10px;"><button class="btn btn-ghost" id="ua-billing-portal">Manage Billing</button></div>'
            : '<div style="margin-top:10px;font-size:12px;color:var(--t3);">Only the account owner can manage billing.</div>')
        + '<div id="ua-billing-msg" style="display:none;font-size:11px;color:var(--red);margin-top:8px;"></div>';
      document.getElementById('ua-billing-portal')?.addEventListener('click', async () => {
        const msg = document.getElementById('ua-billing-msg');
        const showErr = (t) => { if (msg) { msg.textContent = t; msg.style.display = 'block'; } };
        try {
          const headers = await this._teamAuthHeaders();
          if (!headers) return;
          const accountId = await DB._ensureAccountId();
          const r = await fetch('/api/billing-portal', {
            method: 'POST', headers,
            body: JSON.stringify({ accountId })
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
      // Fall back to the client's own owner knowledge if the server flag is
      // missing (e.g. an old server during a deploy window) so owner-row
      // protection never silently drops.
      const viewerIsOwner = !!data.requesterIsOwner || !!(window.DB && DB.isOwner && DB.isOwner());
      this._teamRenderMembers(data.members || [], viewerIsOwner);
    } catch (e) {
      box.innerHTML = '<div style="color:var(--t3);">Connection error.</div>';
    }
  },

  _teamRenderMembers(members, viewerIsOwner) {
    const box = document.getElementById('ua-team-members');
    if (!box) return;

    // Client-side owner id as a fallback, so a missing server is_owner flag never
    // strips the owner-row protection (no Remove / no role dropdown).
    const ownerId = (window.DB && DB.ownerUserId && DB.ownerUserId()) || null;
    const myId = (window.DB && DB._user && DB._user.id) || null;

    const rows = members.map(m => {
      const isSelf = m.is_self;
      const isOwner = m.is_owner || (!!ownerId && m.user_id === ownerId);
      // can_manage from the server (owner manages everyone; a non-owner admin
      // manages only Staff they invited). Fall back to a client compute if an
      // old server didn't send it (deploy window).
      const canManage = (m.can_manage != null) ? m.can_manage
        : (viewerIsOwner ? (!isOwner && !isSelf)
                         : (!!myId && m.invited_by === myId && m.role === 'staff'));
      // Only the owner changes roles; everyone else sees the role as a label.
      const roleCell = isOwner
        ? '<span style="font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:1.5px;font-size:11px;">Owner</span>'
        : (viewerIsOwner && !isSelf)
        ? '<select data-mid="' + esc(m.id) + '" class="ua-team-role-sel">'
            + '<option value="admin"' + (m.role === 'admin' ? ' selected' : '') + '>Admin</option>'
            + '<option value="staff"' + (m.role === 'staff' ? ' selected' : '') + '>Staff</option>'
          + '</select>'
        : '<span style="text-transform:capitalize;font-weight:600;color:var(--t1);">' + esc(m.role) + '</span>';

      const statusBadge = m.confirmed ? ''
        : '<span style="font-size:9px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:1.5px;margin-left:10px;">Pending</span>';

      const editPermsBtn = canManage
        ? '<button class="btn btn-ghost btn-sm ua-team-perms" data-mid="' + esc(m.id) + '" data-perms="' + esc(JSON.stringify(m.permissions || {})) + '" data-email="' + esc(m.email) + '" style="font-size:10px;padding:3px 9px;">Edit Access</button>'
        : '';

      const removeBtn = isSelf
        ? '<span style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:1.5px;">You</span>'
        : canManage
        ? '<button class="btn btn-ghost btn-sm ua-team-remove" data-mid="' + esc(m.id) + '" data-email="' + esc(m.email) + '" style="font-size:10px;padding:3px 9px;">Remove</button>'
        : '';

      // Only the current owner can hand ownership to another existing member.
      const makeOwnerBtn = (viewerIsOwner && !isOwner && !isSelf)
        ? '<button class="btn btn-ghost btn-sm ua-team-makeowner" data-mid="' + esc(m.id) + '" data-email="' + esc(m.email) + '" style="font-size:10px;padding:3px 9px;">Make Owner</button>'
        : '';

      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--b2);flex-wrap:wrap;">'
        +   '<div style="flex:1;min-width:160px;font-size:13px;color:var(--t1);">' + esc(m.email) + statusBadge + '</div>'
        +   '<div style="width:130px;">' + roleCell + '</div>'
        +   '<div style="width:100px;text-align:right;">' + editPermsBtn + '</div>'
        +   '<div style="width:110px;text-align:right;">' + makeOwnerBtn + '</div>'
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
    box.querySelectorAll('.ua-team-makeowner').forEach(btn => {
      btn.addEventListener('click', () => this._teamMakeOwner(btn.dataset.mid, btn.dataset.email));
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
    const permissions = this.collectPerms(inviteWrap);   // Admin + Staff both carry a grid

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

  async _teamMakeOwner(membershipId, email) {
    this._teamModal({
      title: 'Transfer ownership',
      message: 'Make ' + (email || 'this member') + ' the owner of this account? '
        + 'They take over billing and become an admin. You stay on as an admin but lose owner control, '
        + 'and only the new owner can transfer it back. This takes effect right away.',
      buttons: [
        { label: 'Cancel', act: 'cancel', kind: 'ghost' },
        { label: 'Transfer Ownership', act: 'ok', kind: 'danger' }
      ],
      onAction: async (act) => {
        if (act !== 'ok') return;
        const accountId = await DB._ensureAccountId();
        if (!accountId) return;
        try {
          const headers = await this._teamAuthHeaders();
          if (!headers) return;
          const r = await fetch('/api/transfer-ownership', {
            method: 'POST', headers,
            body: JSON.stringify({ accountId, membershipId })
          });
          const data = await r.json();
          if (!r.ok || !data.ok) {
            this._teamModal({ message: data.error || 'Could not transfer ownership.', tone: 'error' });
            return;
          }
          // Ownership drives billing + owner-tier gating app-wide; reload so
          // every cached owner check (DB._ownerUserId, the billing card) is fresh.
          window.location.reload();
        } catch (e) {
          this._teamModal({ message: 'Connection error.', tone: 'error' });
        }
      }
    });
  },

  // Add Another Bar (owner tier, multi-location Option A). Runs the same flow as
  // the first bar: onboarding → plan gate → Stripe → the new bar's Hub. The bar's
  // account is created only at payment, so any cancel before then leaves nothing
  // behind and drops back here. See App.startAddBar / startNewBarCheckout.
  _addBar() {
    App.startAddBar();
  },

  _teamEditPerms(membershipId, email, currentPerms) {
    // Standard form popup: full-bleed header + footer, standard card border, the
    // #0D181E permissions wrapper (no explainer), Save / Cancel on the left.
    const id = 'ua-edit-perms';
    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">Edit Access for ' + esc(email) + '</div>'
      + this.renderPermsGrid(currentPerms, 'edit')
      + '<div class="card-actions">'
      +   '<button class="btn btn-primary" id="ua-perms-save">Save Permissions</button>'
      + '</div></div>';
    const overlay = App.openModal(html, { id, maxWidth: 560 });
    document.getElementById('ua-perms-save')?.addEventListener('click', async () => {
      const btn = document.getElementById('ua-perms-save');
      // Scope to this modal so we read only its dropdowns, not the invite grid.
      const newPerms = this.collectPerms(overlay);
      const accountId = await DB._ensureAccountId();
      if (!accountId) return;
      if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
      try {
        const headers = await this._teamAuthHeaders();
        if (!headers) { if (btn) { btn.disabled = false; btn.textContent = 'Save Permissions'; } return; }
        const r = await fetch('/api/update-member-permissions', {
          method: 'POST', headers,
          body: JSON.stringify({ accountId, membershipId, permissions: newPerms })
        });
        const data = await r.json();
        App.closeModal(id);
        if (!r.ok || !data.ok) {
          await App.confirm({ title: 'Could not save', message: data.error || 'Could not save permissions.', confirmText: 'OK', cancelText: '' });
        }
        this._teamRefresh();
      } catch (e) {
        App.closeModal(id);
        await App.confirm({ title: 'Connection error', message: 'Could not reach the server. Try again.', confirmText: 'OK', cancelText: '' });
        this._teamRefresh();
      }
    });
  }
};
