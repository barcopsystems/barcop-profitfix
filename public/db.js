'use strict';

const DB = {
  _sb: null,
  _user: null,
  _accountId: null,  // resolved lazily on first read/write after signin (Phase 2)
  _role: null,       // 'admin' | 'staff' | 'viewer' — resolved alongside _accountId
  _permissions: null, // { groupKey: 'view' | 'add' | 'edit' } — staff granular permissions
  _accountsCache: null,  // last-known accounts list for the current user (Phase 2)
  _demo: false,   // demo mode — all writes are no-ops so the demo never persists

  // ── Init ─────────────────────────────────────────────────────────────────
  async init() {
    const url = 'https://plpikfpintruksclkwyb.supabase.co';
    const key = 'sb_publishable_2tv02ZIL_HKQitRV1ST-rQ_9a8Gjw_u';

    if (window.supabase) {
      this._sb = window.supabase.createClient(url, key);
      window.SUPABASE_URL = url;
    } else {
      console.warn('Supabase not loaded — using localStorage');
    }
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  async getSession() {
    if (!this._sb) return null;
    const { data } = await this._sb.auth.getSession();
    this._user = data?.session?.user || null;
    this._accountId = null;
    this._role = null;
    this._permissions = null;
    this._accountsCache = null;  // force re-resolve on next read/write
    return data?.session || null;
  },

  onAuthChange(cb) {
    if (!this._sb) return;
    this._sb.auth.onAuthStateChange((event, session) => {
      const prevUserId = this._user?.id;
      this._user = session?.user || null;
      const newUserId = this._user?.id;
      // Only clear cached account/role/permissions if the user actually
      // changed. TOKEN_REFRESHED events keep the same user — wiping the cache
      // there was hiding the Team card after periodic token refresh.
      if (prevUserId !== newUserId) {
        this._accountId = null;
        this._role = null;
        this._permissions = null;
        this._accountsCache = null;
      }
      cb(event, session);
    });
  },

  async signIn(email, password) {
    if (!this._sb) return { error: { message: 'Not connected' } };
    const { data, error } = await this._sb.auth.signInWithPassword({ email, password });
    if (data?.user) this._user = data.user;
    this._accountId = null;
    this._role = null;
    this._permissions = null;
    this._accountsCache = null;
    return { data, error };
  },

  async signUp(email, password) {
    if (!this._sb) return { error: { message: 'Not connected' } };
    return await this._sb.auth.signUp({ email, password });
  },

  async signOut() {
    if (!this._sb) return;
    await this._sb.auth.signOut();
    this._user = null;
    this._accountId = null;
    this._role = null;
    this._permissions = null;
    this._accountsCache = null;
  },

  async resetPassword(email) {
    if (!this._sb) return { error: { message: 'Not connected' } };
    return await this._sb.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://app.barcop.com/'
    });
  },

  // ── Subscription ─────────────────────────────────────────────────────────
  async getSubscription() {
    if (!this._sb || !this._user) {
      return { status: 'inactive', plan: null, active_modules: [], period_end: null };
    }
    try {
      const { data, error } = await this._sb
        .from('subscriptions')
        .select('subscription_status, subscription_plan, active_modules, current_period_end')
        .eq('user_id', this._user.id)
        .single();

      if (error || !data) {
        return { status: 'inactive', plan: null, active_modules: [], period_end: null };
      }
      return {
        status:         data.subscription_status,
        plan:           data.subscription_plan,
        active_modules: data.active_modules || [],
        period_end:     data.current_period_end
      };
    } catch (e) {
      console.error('getSubscription error:', e);
      return { status: 'inactive', plan: null, active_modules: [], period_end: null };
    }
  },

  hasModule(moduleName) {
    return App.subscription?.active_modules?.includes(moduleName) || false;
  },

  // ── Account resolution (Phase 2) ──────────────────────────────────────────
  // Looks up the current user's account_id from the memberships table and
  // caches it. Lazy: resolves on first read/write after signin. Cleared in
  // every auth handler so a fresh signin always re-resolves.
  // Active account ID is stored in localStorage so it persists across reloads.
  // Multi-account users (owners of 2+ bars) pick which bar to view via the
  // topbar account switcher; that selection becomes the active account.
  _ACTIVE_ACCOUNT_KEY: 'pf_active_account_id',
  _getStoredActiveAccountId() {
    try { return localStorage.getItem(this._ACTIVE_ACCOUNT_KEY) || null; }
    catch (e) { return null; }
  },
  _setStoredActiveAccountId(id) {
    try {
      if (id) localStorage.setItem(this._ACTIVE_ACCOUNT_KEY, id);
      else localStorage.removeItem(this._ACTIVE_ACCOUNT_KEY);
    } catch (e) {}
  },

  async _ensureAccountId() {
    if (this._accountId) return this._accountId;
    if (!this._sb || !this._user) return null;
    try {
      // Multi-account: if the user previously selected an active account,
      // resolve that one first. Falls back to first membership otherwise.
      const stored = this._getStoredActiveAccountId();
      if (stored) {
        const { data: m, error: e1 } = await this._sb
          .from('memberships')
          .select('account_id, role, permissions')
          .eq('user_id', this._user.id)
          .eq('account_id', stored)
          .maybeSingle();
        if (!e1 && m) {
          this._accountId = m.account_id;
          this._role = m.role || 'admin';
          this._permissions = m.permissions || {};
          return this._accountId;
        }
        // Stale stored ID (user lost access to that account). Clear it.
        this._setStoredActiveAccountId(null);
      }
      const { data, error } = await this._sb
        .from('memberships')
        .select('account_id, role, permissions')
        .eq('user_id', this._user.id)
        .limit(1)
        .single();
      if (error || !data) return null;
      this._accountId = data.account_id;
      this._role = data.role || 'admin';
      this._permissions = data.permissions || {};
      return this._accountId;
    } catch (e) {
      return null;
    }
  },

  // Returns every account the current user is a member of, with name + role.
  // Used by the topbar account switcher and the Hub sidebar Locations gate.
  // Caches the result in _accountsCache so synchronous callers (sidebar render)
  // can read the list without awaiting a network round-trip. Cache clears on
  // signIn / signOut / user change.
  async listMyAccounts() {
    if (!this._sb || !this._user) { this._accountsCache = []; return []; }
    try {
      const { data, error } = await this._sb
        .from('memberships')
        .select('account_id, role, accounts(id, name)')
        .eq('user_id', this._user.id);
      if (error || !data) { this._accountsCache = []; return []; }
      const list = data
        .filter(m => m.accounts)
        .map(m => ({ id: m.accounts.id, name: m.accounts.name || 'My Bar', role: m.role }));
      this._accountsCache = list;
      return list;
    } catch (e) {
      this._accountsCache = [];
      return [];
    }
  },

  // Sync accessor for callers that need the accounts list during render and
  // cannot await. Returns whatever the last listMyAccounts() populated, or
  // an empty array if nothing has been resolved yet. Pre-fetched by
  // App.loadAllData() so by the time the Hub renders, the cache is populated.
  cachedAccounts() {
    return this._accountsCache || [];
  },

  // Switch which account is active. Stores in localStorage and reloads so
  // every cached data structure starts fresh under the new account context.
  setActiveAccount(accountId) {
    this._setStoredActiveAccountId(accountId);
    window.location.reload();
  },

  // Current user's role in their active account. 'admin' | 'staff' | 'viewer' |
  // null if not yet resolved. Resolved lazily as a side effect of any read/write.
  role() { return this._role; },
  permissions() { return this._permissions || {}; },
  isAdmin()  { return this._role === 'admin'; },
  isStaff()  { return this._role === 'staff'; },
  isViewer() { return this._role === 'viewer'; },
  canWrite() { return this._role !== 'viewer'; },

  // ── Granular permission system (Phase 2 Item 25b) ───────────────────────────
  // Each screen maps to a permission group. The user's permissions object
  // stores per-group access levels: 'add' (view + create new) or 'edit'
  // (view + create + edit + delete). Missing key = no access.
  //
  // Admin: implicit 'edit' on all groups (bypasses the map).
  // Viewer: implicit 'view' on all groups (read-only, blocked at write).
  // Staff: looks up the screen's group in their permissions object.
  // Help screens (mapped to '_always'): accessible to anyone signed in.
  SCREEN_GROUPS: {
    // Inventory Control
    'ic-take-inventory':'take-inventory','ic-count-history':'take-inventory',
    'ic-receive-delivery':'receive-delivery','ic-delivery-history':'receive-delivery',
    'ic-order-sheet':'place-orders','ic-order-history':'place-orders',
    'ic-spot-check':'spot-check',
    'ic-transfers':'inventory-counts',
    'ic-empties':'inventory-counts',
    'ic-adjustments':'inventory-counts',
    'ic-par-suggestions':'inventory-reports',
    'ic-product-setup':'manage-products','ic-locations':'manage-products','ic-vendors':'manage-products','ic-prep-batches':'manage-products',
    'ic-report-stock':'inventory-reports','ic-report-movers':'inventory-reports',
    'ic-report-usage':'inventory-reports','ic-report-variance':'inventory-reports',
    'ic-dashboard':'inventory-dashboard','ic-help':'_always',
    // Labor Control
    'lc-log-hours':'log-hours',
    'lc-tip-log':'log-tips','lc-tip-history':'log-tips','lc-tip-pool':'log-tips',
    'lc-schedule-history':'view-schedule',
    'lc-build-schedule':'manage-schedule',
    'lc-staff-roster':'manage-staff','lc-positions':'manage-staff',
    'lc-wage-settings':'manage-staff',
    'lc-callout-log':'call-out-log','lc-time-off':'time-off',
    'lc-reports':'labor-reports','lc-overtime-watch':'labor-reports','lc-pay-periods':'labor-reports','lc-payroll-export':'labor-reports',
    'lc-dashboard':'labor-dashboard','lc-help':'_always',
    // Shift Control
    'sc-cash-history':'cash-mgmt',
    'sc-cash-control':'cash-mgmt','sc-drawers':'cash-mgmt',
    'sc-checklists':'checklists','sc-checklist-templates':'checklists',
    'sc-void-comp':'void-comp',
    'sc-maintenance':'maintenance',
    'sc-waste':'waste',
    'sc-walked-tabs':'cash-mgmt',
    'sc-dashboard':'shift-dashboard','sc-help':'_always',
    // Profit Recovery (root + profit module screens)
    'dashboard':'profit-recovery','this-week':'profit-recovery',
    'audit-tracker':'profit-recovery','profit-fix':'profit-recovery',
    'cash-recon':'profit-recovery','theft-risk':'profit-recovery','sales-integrity':'profit-recovery',
    'recipe-cost-analysis':'profit-recovery','vendor-tracker':'profit-recovery',
    'vendor-watch':'profit-recovery','vendor-scorecard':'profit-recovery','vendor-discrepancy':'profit-recovery',
    'profit-forecast':'profit-recovery','help':'_always',
    // Revenue Recovery
    'r-dashboard':'revenue-recovery','r-this-week':'revenue-recovery','r-forecast':'revenue-recovery',
    'r-audit':'revenue-recovery','r-fix':'revenue-recovery',
    'r-server-check':'revenue-recovery','r-menu-items':'revenue-recovery',
    'r-menu-engineering':'revenue-recovery','r-price-calc':'revenue-recovery',
    'r-dog-test':'revenue-recovery',
    'r-help':'_always',
    // Traffic Recovery
    't-dashboard':'traffic-recovery','t-this-week':'traffic-recovery',
    't-audit':'traffic-recovery','t-fix':'traffic-recovery',
    't-presence':'traffic-recovery','t-forecast':'traffic-recovery',
    't-help':'_always',
    // Events
    'ev-dashboard':'events','ev-bookings':'events','ev-calendar':'events',
    'ev-regulars':'events','ev-pricing':'events','ev-help':'_always'
  },

  canAccessLevel(screen) {
    if (!this._role) return 'edit';  // not yet resolved (e.g., demo mode) — open
    if (this._role === 'admin') return 'edit';
    const group = this.SCREEN_GROUPS[screen];
    if (group === '_always') return 'view';  // help screens always accessible
    if (this._role === 'viewer') return 'view';
    if (!group) return null;
    const perms = this._permissions || {};
    return perms[group] || null;
  },

  screenAllowed(screen) { return this.canAccessLevel(screen) !== null; },
  screenCanAdd(screen)  { const l = this.canAccessLevel(screen); return l === 'add' || l === 'edit'; },
  screenCanEdit(screen) { return this.canAccessLevel(screen) === 'edit'; },

  // ── Data ──────────────────────────────────────────────────────────────────
  async readData() {
    // Supabase mode
    if (this._sb && this._user) {
      // Unsynced local changes from an offline session are newer than the
      // server copy — load them so no offline work is lost.
      if (this._pendingList().includes('pf_data')) {
        return this._mergeDefaults(this._localRead());
      }
      const accountId = await this._ensureAccountId();
      if (!accountId) {
        // No membership found — should not happen after Phase 19 backfill +
        // 22a signup trigger, but fall back to local so the operator is never
        // locked out of their own data.
        return this._mergeDefaults(this._localRead());
      }
      try {
        const { data, error } = await this._sb
          .from('user_data')
          .select('data')
          .eq('account_id', accountId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('readData error:', error);
          return this._mergeDefaults(this._localRead());
        }
        if (!data) {
          // First login — create row with defaults
          const defaults = this._defaultData();
          await this._sb.from('user_data').insert({
            account_id: accountId,
            user_id: this._user.id,
            data: defaults,
            updated_at: new Date().toISOString()
          });
          return defaults;
        }
        return this._mergeDefaults(data.data);
      } catch (e) {
        console.error('readData exception:', e);
        return this._mergeDefaults(this._localRead());
      }
    }
    // localStorage fallback
    return this._mergeDefaults(this._localRead());
  },

  async writeData(appData) {
    if (this._demo) return { ok: true };
    if (this._sb && this._user) {
      // Fix D: short-circuit the network call when the browser knows it is offline.
      // No round-trip, no console error, faster save. The local copy is canonical.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this._localWrite(appData);
        this._markPending('pf_data');
        return { ok: false, offline: true };
      }
      const accountId = await this._ensureAccountId();
      if (!accountId) {
        this._localWrite(appData);
        this._markPending('pf_data');
        return { ok: false, error: 'no account membership found' };
      }
      // Viewer role: read-only. Silently swallow writes so the UI doesn't
      // pretend a save succeeded. Server-side RLS is the real enforcement;
      // this is the friendly client-side rejection.
      if (this._role === 'viewer') {
        return { ok: false, error: 'Viewer access is read-only.' };
      }
      try {
        const { error } = await this._sb
          .from('user_data')
          .upsert({
            account_id: accountId,
            user_id: this._user.id,
            data: appData,
            updated_at: new Date().toISOString()
          }, { onConflict: 'account_id' });

        if (error) {
          console.error('writeData error:', error);
          this._localWrite(appData);
          this._markPending('pf_data');
          return { ok: false, error };
        }
        this._localWrite(appData); // keep local copy in sync
        this._clearPending('pf_data');
        return { ok: true };
      } catch (e) {
        console.error('writeData exception:', e);
        this._localWrite(appData);
        this._markPending('pf_data');
        return { ok: false, error: e };
      }
    }
    this._localWrite(appData);
    return { ok: true };
  },

  async writeKey(key, value) {
    if (!App.data) return { ok: false };
    App.data[key] = value;
    return await this.writeData(App.data);
  },

  // ── Offline sync (Section 14) ─────────────────────────────────────────────
  // When a write to Supabase fails (offline or server unreachable), the local
  // copy is kept and the store is marked pending. On the next load the local
  // copy is loaded (it is newer than the server), and App prompts to sync.
  _PENDING_KEY: 'pf_pending_sync',

  _pendingList() {
    try { const r = localStorage.getItem(this._PENDING_KEY); return r ? JSON.parse(r) : []; }
    catch (e) { return []; }
  },
  _setPendingList(list) {
    try {
      if (list && list.length) localStorage.setItem(this._PENDING_KEY, JSON.stringify(list));
      else localStorage.removeItem(this._PENDING_KEY);
    } catch (e) { /* storage full or unavailable */ }
  },
  _markPending(lsKey) {
    const list = this._pendingList();
    if (!list.includes(lsKey)) {
      list.push(lsKey);
      this._setPendingList(list);
      // Fix C: tell the app that something just landed in the pending queue, so it
      // can surface the sync banner immediately instead of waiting for next reload.
      try { window.dispatchEvent(new CustomEvent('bcop:pending-write', { detail: { key: lsKey } })); }
      catch (e) { /* CustomEvent unavailable */ }
    }
  },
  _clearPending(lsKey) {
    this._setPendingList(this._pendingList().filter(k => k !== lsKey));
  },
  // True only in Supabase mode with a signed-in user and unsynced local data.
  hasPendingSync() {
    return !!(this._sb && this._user && this._pendingList().length > 0);
  },

  // Re-push every pending store's local copy to Supabase. Each store clears
  // from the pending list only on its own successful write.
  async syncPending() {
    if (!this._sb || !this._user) return { ok: false, synced: 0, failed: 0, error: 'Not connected' };
    const tableOf = { pf_data: 'user_data', pf_ic_data: 'ic_data', pf_lc_data: 'lc_data', pf_sc_data: 'sc_data' };
    let synced = 0, failed = 0;
    for (const lsKey of this._pendingList()) {
      if (lsKey === 'events') {
        const er = await this.syncPendingEvents();
        synced += er.synced; failed += er.failed;
        continue; // syncPendingEvents clears 'events' itself once the queue drains
      }
      const table = tableOf[lsKey];
      if (!table) { this._clearPending(lsKey); continue; }
      const data = lsKey === 'pf_data' ? this._localRead() : this._localReadControl(lsKey);
      try {
        const { error } = await this._sb.from(table).upsert({
          user_id: this._user.id, data: data, updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        if (error) { failed++; }
        else { this._clearPending(lsKey); synced++; }
      } catch (e) { failed++; }
    }
    return { ok: failed === 0, synced: synced, failed: failed };
  },

  // ── Local storage fallback ────────────────────────────────────────────────
  _localRead() {
    try {
      const r = localStorage.getItem('pf_data');
      return r ? JSON.parse(r) : this._defaultData();
    } catch (e) {
      return this._defaultData();
    }
  },

  _localWrite(data) {
    try {
      localStorage.setItem('pf_data', JSON.stringify(data));
    } catch (e) {
      console.warn('localStorage write failed:', e);
    }
  },

  // ── Control module data (separate Supabase tables — see Rule 21) ──────────
  // Inventory / Labor / Shift data lives in its own table (ic_data / lc_data /
  // sc_data), NOT in the user_data JSON blob. Same read/write pattern as
  // readData()/writeData(); default for a fresh row is an empty object.
  async _readControl(table, lsKey) {
    if (this._sb && this._user) {
      // Unsynced offline changes are newer than the server copy.
      if (this._pendingList().includes(lsKey)) {
        return this._localReadControl(lsKey);
      }
      const accountId = await this._ensureAccountId();
      if (!accountId) {
        return this._localReadControl(lsKey);
      }
      try {
        const { data, error } = await this._sb
          .from(table)
          .select('data')
          .eq('account_id', accountId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('read ' + table + ' error:', error);
          return this._localReadControl(lsKey);
        }
        if (!data) {
          // First access — create the row with an empty object
          await this._sb.from(table).insert({
            account_id: accountId,
            user_id: this._user.id,
            data: {},
            updated_at: new Date().toISOString()
          });
          return {};
        }
        return data.data || {};
      } catch (e) {
        console.error('read ' + table + ' exception:', e);
        return this._localReadControl(lsKey);
      }
    }
    return this._localReadControl(lsKey);
  },

  async _writeControl(table, lsKey, data) {
    if (this._demo) return { ok: true };
    if (this._sb && this._user) {
      // Fix D: short-circuit the network call when the browser knows it is offline.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this._localWriteControl(lsKey, data);
        this._markPending(lsKey);
        return { ok: false, offline: true };
      }
      const accountId = await this._ensureAccountId();
      if (!accountId) {
        this._localWriteControl(lsKey, data);
        this._markPending(lsKey);
        return { ok: false, error: 'no account membership found' };
      }
      if (this._role === 'viewer') {
        return { ok: false, error: 'Viewer access is read-only.' };
      }
      try {
        const { error } = await this._sb
          .from(table)
          .upsert({
            account_id: accountId,
            user_id: this._user.id,
            data: data,
            updated_at: new Date().toISOString()
          }, { onConflict: 'account_id' });

        if (error) {
          console.error('write ' + table + ' error:', error);
          this._localWriteControl(lsKey, data);
          this._markPending(lsKey);
          return { ok: false, error };
        }
        this._localWriteControl(lsKey, data); // keep local copy in sync
        this._clearPending(lsKey);
        return { ok: true };
      } catch (e) {
        console.error('write ' + table + ' exception:', e);
        this._localWriteControl(lsKey, data);
        this._markPending(lsKey);
        return { ok: false, error: e };
      }
    }
    this._localWriteControl(lsKey, data);
    return { ok: true };
  },

  _localReadControl(lsKey) {
    try {
      const r = localStorage.getItem(lsKey);
      return r ? JSON.parse(r) : {};
    } catch (e) {
      return {};
    }
  },

  _localWriteControl(lsKey, data) {
    try {
      localStorage.setItem(lsKey, JSON.stringify(data));
    } catch (e) {
      console.warn('localStorage write failed:', e);
    }
  },

  // ── Bug reports ──────────────────────────────────────────────────────────
  // Operator-submitted bug reports land in the bug_reports Supabase table for
  // the team to triage. In demo mode it's a no-op success — demo users should
  // not be filing real bug reports. On any failure the operator sees an
  // inline error and can retry.
  async submitBugReport(report) {
    if (this._demo) return { ok: true };
    if (!this._sb || !this._user) return { ok: false, error: 'Not connected. Sign in and try again.' };
    try {
      const { error } = await this._sb.from('bug_reports').insert({
        user_id:            this._user.id,
        user_email:         this._user.email || '',
        title:              report.title || '',
        severity:           report.severity || 'moderate',
        what_happened:      report.what_happened || '',
        steps_to_reproduce: report.steps_to_reproduce || '',
        expected_behavior:  report.expected_behavior || '',
        previous_screen:    report.previous_screen || '',
        user_agent:         report.user_agent || '',
        viewport:           report.viewport || '',
        status:             'open'
      });
      if (error) {
        console.error('submitBugReport error:', error);
        return { ok: false, error };
      }
      return { ok: true };
    } catch (e) {
      console.error('submitBugReport exception:', e);
      return { ok: false, error: e };
    }
  },

  async readInventoryData()      { return await this._readControl('ic_data', 'pf_ic_data'); },
  async writeInventoryData(data) { return await this._writeControl('ic_data', 'pf_ic_data', data); },
  async readLaborData()          { return await this._readControl('lc_data', 'pf_lc_data'); },
  async writeLaborData(data)     { return await this._writeControl('lc_data', 'pf_lc_data', data); },
  async readShiftData() {
    const d = await this._readControl('sc_data', 'pf_sc_data');
    return d;
  },
  async writeShiftData(data)     { return await this._writeControl('sc_data', 'pf_sc_data', data); },

  // ── Event-log stores (row per record) ────────────────────────────────────
  // Unbounded logs (counts, deliveries, shifts, tips, audits…) live one row per
  // record in <module>_events instead of inside the JSON blob, so login and save
  // stay flat as history grows. payload = the record object verbatim, so the
  // app's in-memory arrays are unchanged. The (account_id, kind, date desc)
  // index keeps "last N of a kind" constant-time. Config stays in the blob.
  // Offline: a failed write queues the op locally and replays on sync; loads
  // fall back to a localStorage cache of the last-loaded window.
  _WINDOW_MONTHS: 24,
  _EVENTQ_KEY: 'pf_pending_events',

  _windowStartDate() {
    const d = new Date();
    d.setMonth(d.getMonth() - this._WINDOW_MONTHS);
    // Local calendar date (not UTC) so the window edge matches the local
    // date stamps every record is written with (App.ymdLocal).
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  },
  // Business date (YYYY-MM-DD) for the windowing index, pulled from the record.
  _eventDate(rec) {
    const v = rec && (rec.date || rec.created_at || rec.date_time || rec.closed_at || rec.filed_at);
    if (!v) return null;
    const s = String(v).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  },
  _evCacheKey(table, kind) { return 'pfev_' + table + '_' + kind; },
  _cacheEvents(table, kind, recs) {
    try { localStorage.setItem(this._evCacheKey(table, kind), JSON.stringify(recs)); } catch (e) {}
  },
  _readEventCache(table, kind) {
    try { const r = localStorage.getItem(this._evCacheKey(table, kind)); return r ? JSON.parse(r) : []; }
    catch (e) { return []; }
  },

  // Load one kind, newest first. Default = rolling 24-month window (the hot set
  // every screen reads). opts.before = an older page ("Show older"). opts.limit
  // caps the page. Falls back to the local cache when offline / on error.
  async loadEvents(table, kind, opts) {
    opts = opts || {};
    if (this._sb && this._user && !(typeof navigator !== 'undefined' && navigator.onLine === false)) {
      const accountId = await this._ensureAccountId();
      if (accountId) {
        try {
          let q = this._sb.from(table).select('payload,date')
            .eq('account_id', accountId).eq('kind', kind)
            .order('date', { ascending: false, nullsFirst: false });
          // Default = the rolling window; include null-date rows so a record
          // missing a business date is never hidden.
          if (opts.before) q = q.lt('date', opts.before);
          else q = q.or('date.gte.' + this._windowStartDate() + ',date.is.null');
          if (opts.limit) q = q.limit(opts.limit);
          const { data, error } = await q;
          if (!error && Array.isArray(data)) {
            const recs = data.map(r => r.payload).filter(Boolean);
            if (!opts.before) this._cacheEvents(table, kind, recs);
            return recs;
          }
        } catch (e) { /* fall through to cache */ }
      }
    }
    return opts.before ? [] : this._readEventCache(table, kind);
  },

  async putEvent(table, kind, rec) {
    if (this._demo || !rec || rec.id == null) return { ok: this._demo === true };
    if (this._sb && this._user) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this._queueEvent(table, kind, 'put', rec); return { ok: false, offline: true };
      }
      const accountId = await this._ensureAccountId();
      if (!accountId) { this._queueEvent(table, kind, 'put', rec); return { ok: false, error: 'no account membership found' }; }
      if (this._role === 'viewer') return { ok: false, error: 'Viewer access is read-only.' };
      try {
        const { error } = await this._sb.from(table).upsert({
          account_id: accountId, kind: kind, id: String(rec.id),
          date: this._eventDate(rec), payload: rec, updated_at: new Date().toISOString()
        }, { onConflict: 'account_id,kind,id' });
        if (error) { this._queueEvent(table, kind, 'put', rec); return { ok: false, error }; }
        return { ok: true };
      } catch (e) { this._queueEvent(table, kind, 'put', rec); return { ok: false, error: e }; }
    }
    return { ok: true }; // local-only mode: App keeps the in-memory array
  },

  async removeEvent(table, kind, id) {
    if (this._demo || id == null) return { ok: this._demo === true };
    if (this._sb && this._user) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this._queueEvent(table, kind, 'del', { id }); return { ok: false, offline: true };
      }
      const accountId = await this._ensureAccountId();
      if (!accountId) { this._queueEvent(table, kind, 'del', { id }); return { ok: false, error: 'no account membership found' }; }
      if (this._role === 'viewer') return { ok: false, error: 'Viewer access is read-only.' };
      try {
        const { error } = await this._sb.from(table).delete()
          .eq('account_id', accountId).eq('kind', kind).eq('id', String(id));
        if (error) { this._queueEvent(table, kind, 'del', { id }); return { ok: false, error }; }
        return { ok: true };
      } catch (e) { this._queueEvent(table, kind, 'del', { id }); return { ok: false, error: e }; }
    }
    return { ok: true };
  },

  // Seed many rows for a kind in one upsert (sample data / migration).
  async putEventsBulk(table, kind, recs) {
    if (this._demo || !this._sb || !this._user) return { ok: true };
    const accountId = await this._ensureAccountId();
    if (!accountId) return { ok: false, error: 'no account membership found' };
    const rows = (recs || []).filter(r => r && r.id != null).map(rec => ({
      account_id: accountId, kind: kind, id: String(rec.id),
      date: this._eventDate(rec), payload: rec, updated_at: new Date().toISOString()
    }));
    if (!rows.length) return { ok: true };
    try {
      // Chunk to keep each request small.
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await this._sb.from(table).upsert(rows.slice(i, i + 500), { onConflict: 'account_id,kind,id' });
        if (error) return { ok: false, error };
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: e }; }
  },

  // Delete every row for this account in an events table (sample reload / clear
  // all). Also drops the local window caches for that table.
  async clearEvents(table) {
    try {
      Object.keys(localStorage).filter(k => k.indexOf('pfev_' + table + '_') === 0)
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    if (this._demo || !this._sb || !this._user) return { ok: true };
    const accountId = await this._ensureAccountId();
    if (!accountId) return { ok: false, error: 'no account membership found' };
    try {
      const { error } = await this._sb.from(table).delete().eq('account_id', accountId);
      return error ? { ok: false, error } : { ok: true };
    } catch (e) { return { ok: false, error: e }; }
  },

  // ── Event offline queue ───────────────────────────────────────────────────
  _eventQueue() {
    try { return JSON.parse(localStorage.getItem(this._EVENTQ_KEY) || '[]'); }
    catch (e) { return []; }
  },
  _setEventQueue(list) {
    try {
      if (list && list.length) localStorage.setItem(this._EVENTQ_KEY, JSON.stringify(list));
      else localStorage.removeItem(this._EVENTQ_KEY);
    } catch (e) {}
  },
  _queueEvent(table, kind, op, rec) {
    const list = this._eventQueue();
    // Collapse to the latest op for a given row so replays stay minimal.
    const id = String(rec.id);
    const filtered = list.filter(e => !(e.table === table && e.kind === kind && e.id === id));
    filtered.push({ table, kind, op, id, payload: op === 'put' ? rec : null });
    this._setEventQueue(filtered);
    this._markPending('events');
  },
  hasPendingEvents() {
    return !!(this._sb && this._user && this._eventQueue().length > 0);
  },
  // Replay queued record ops. Each op clears only on its own success.
  async syncPendingEvents() {
    if (!this._sb || !this._user) return { ok: false, synced: 0, failed: 0 };
    const accountId = await this._ensureAccountId();
    if (!accountId) return { ok: false, synced: 0, failed: 0, error: 'no account' };
    let synced = 0, failed = 0;
    const remaining = [];
    for (const e of this._eventQueue()) {
      try {
        let error;
        if (e.op === 'put') {
          ({ error } = await this._sb.from(e.table).upsert({
            account_id: accountId, kind: e.kind, id: e.id,
            date: this._eventDate(e.payload), payload: e.payload, updated_at: new Date().toISOString()
          }, { onConflict: 'account_id,kind,id' }));
        } else {
          ({ error } = await this._sb.from(e.table).delete()
            .eq('account_id', accountId).eq('kind', e.kind).eq('id', e.id));
        }
        if (error) { failed++; remaining.push(e); } else { synced++; }
      } catch (err) { failed++; remaining.push(e); }
    }
    this._setEventQueue(remaining);
    if (!remaining.length) this._clearPending('events');
    return { ok: failed === 0, synced, failed };
  },

  // ── Merge defaults (ensures all keys exist after updates) ─────────────────
  _mergeDefaults(data) {
    const d = this._defaultData();
    Object.keys(d).forEach(k => { if (!(k in data)) data[k] = d[k]; });
    if (data.settings) {
      Object.keys(d.settings).forEach(k => {
        if (!(k in data.settings)) data.settings[k] = d.settings[k];
      });
      if (data.settings.targets) {
        Object.keys(d.settings.targets).forEach(k => {
          if (!(k in data.settings.targets)) data.settings.targets[k] = d.settings.targets[k];
        });
      } else {
        data.settings.targets = d.settings.targets;
      }
    }
    if (data.revenue_settings) {
      Object.keys(d.revenue_settings).forEach(k => {
        if (!(k in data.revenue_settings)) data.revenue_settings[k] = d.revenue_settings[k];
      });
    }
    if (data.traffic_settings) {
      Object.keys(d.traffic_settings).forEach(k => {
        if (!(k in data.traffic_settings)) data.traffic_settings[k] = d.traffic_settings[k];
      });
    }
    return data;
  },

  // ── Default data structure ────────────────────────────────────────────────
  _defaultData() {
    return {
      settings: {
        bar_name: '', city_state: '',
        annual_bar_revenue: 0, annual_food_revenue: 0,
        targets: {
          bar_pour_cost_pct: 22, food_cost_pct: 32,
          labor_cost_pct: 30, prime_cost_pct: 60
        },
        // Cash variance tolerance is per-register now (sc_drawers.cash_tolerance,
        // set on the Add Register form). See App.drawerTolerance().
        onboarding_complete: false
      },
      bar_products: [], kitchen_products: [],
      // Menu items: the unified store for everything sellable on the menu.
      // Recipes live embedded as the optional `recipe` field on each item.
      // Edited from r-menu-items (Revenue Recovery) — the single edit
      // surface. Profit Recovery's Recipe Cost Analysis is read-only.
      menu_items: [],
      weeks: [],
      theft_scores: [], last_theft_score_date: null,
      vendor_discrepancies: [],
      variance_investigations: [],
      sales_reviews: [],
      audits: [],
      getting_started_profit: {},
      // Revenue Recovery data
      revenue_settings: {
        targets: {
          check_avg: 35,
          rplh_lunch: 50,
          rplh_dinner: 75,
          rplh_bar: 65,
          event_close_rate: 40
        },
        servers: []
      },
      revenue_weeks: [],
      revenue_audits: [],
      revenue_server_checks: [],
      menu_dog_tests: [],
      revenue_price_log: [],
      getting_started_revenue: {},
      // Traffic Recovery data
      traffic_settings: {
        targets: {
          google_rating:      4.3,
          review_velocity:    8,
          response_rate:      75,
          monthly_sessions:   2000,
          social_posts_month: 12
        },
        // Static digital-presence profile state — set once on the scorecard
        // screens, not repeated on every weekly record.
        profile: {},
        // Operation links — the operator's public URLs for each platform.
        // The audit fetches public data from these; Recovery screens use them
        // for "Open Live" click-throughs. Empty until the operator enters them.
        urls: {
          website:         '',
          gbp:             '',
          yelp:            '',
          instagram:       '',
          facebook:        '',
          doordash:        '',
          ubereats:        '',
          grubhub:         '',
          email_platform:  ''
        },
        // Traffic Recovery Scoreboard conversion rates. These map a Traffic
        // metric improvement to a dollar figure using check_avg from Revenue
        // Recovery as the per-visit value. Defaults are industry benchmarks
        // for restaurant digital channels; operator can override per channel.
        conversion_rates: {
          web_session_to_visit:    3,
          gbp_view_to_visit:       2,
          social_profile_to_visit: 1,
          email_open_to_visit:     1
        }
      },
      traffic_weeks:   [],
      traffic_audits:  [],
      // Traffic Recovery logs added in the Traffic deep dive — each holds the
      // operator-typed history that feeds the matching screen card and the
      // fix_log auto-emit thresholds.
      traffic_review_replies:  [],
      traffic_gbp_posts:       [],
      traffic_social_posts:    [],
      traffic_email_campaigns: [],
      getting_started_traffic: {},
      // ── Events section (bookings, guests, planning) ────────────────────────
      // Unified booking record: lead -> quote -> booked -> completed/lost, one
      // per party. Row-per-record via core_events (kind 'booking'); replaces the
      // old split revenue_events + traffic_inquiries. Rate cards, the guest CRM,
      // and the planning calendar are blob-persisted.
      bookings:         [],
      event_rate_cards: [],
      event_regulars:   [],
      event_calendar:   [],
      getting_started_events: {},
      // Hub — Bar Cop Audit history (executive monthly audits at Hub level)
      bar_cop_audits: [],
      // Hub — Operating Expenses Log (per-entry expense capture, feeds Books)
      operating_expenses: [],
      // Hub — Permits and Compliance Log (liquor license, tax filings, etc)
      permits_compliance: [],
      // Hub — unified setup checklist progress (Section 1, Section 9)
      hub_setup_progress: {},
      // Fix layer — implemented-fix events feeding the Recovery Scoreboard
      fix_log: [],
      // Fix layer — per-gap step checklist progress, shape: { gap_id: [step_index,...] }
      fix_progress: {},
      // Fix layer — chronological step-check feed for the Recent Activity card.
      // Shape: [{ id, module, gap_id, gap_name, step_index, step_title, step_kind, ts }]
      fix_activity: [],
      // Profit Fix — last day each review-target screen was opened, so review
      // steps verify. Shape: { screenId: 'YYYY-MM-DD' }
      fix_views: {}
    };
  }
};

window.DB = DB;
