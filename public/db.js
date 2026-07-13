'use strict';

const DB = {
  _sb: null,
  _user: null,
  _accountId: null,  // resolved lazily on first read/write after signin (Phase 2)
  _role: null,       // 'admin' | 'staff' | 'viewer' — resolved alongside _accountId
  _ownerUserId: null, // accounts.owner_user_id for the active account (the Owner tier)
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
    this._ownerUserId = null;
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
        this._ownerUserId = null;
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
    this._ownerUserId = null;
    this._permissions = null;
    this._accountsCache = null;
    return { data, error };
  },

  async signUp(email, password) {
    if (!this._sb) return { error: { message: 'Not connected' } };
    // Email confirmations are OFF (Stripe verifies the email at payment), so a
    // successful signUp returns a live session. Adopt it immediately and clear
    // any cached account/role so _ensureAccountId re-resolves the freshly
    // trigger-provisioned account (owner_user_id = this new user).
    const res = await this._sb.auth.signUp({ email, password });
    // Only adopt the identity when signUp actually created a session. An
    // existing-email signUp (Supabase anti-enumeration) returns an obfuscated
    // user with NO session; adopting it would leave DB pointed at a phantom
    // user with no account/membership.
    if (res.data?.session && res.data?.user) {
      this._user = res.data.user;
      this._accountId = null;
      this._role = null;
      this._ownerUserId = null;
      this._permissions = null;
      this._accountsCache = null;
      // A brand-new signup must not resolve a prior user's account left in
      // localStorage from an earlier session on this browser — clear it so
      // _ensureAccountId lands on the freshly provisioned account.
      this._setStoredActiveAccountId(null);
    }
    return res;
  },

  // Fresh JWT headers for authed server endpoints (rename, etc.).
  async _authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    try {
      const cur = await this._sb?.auth.getSession();
      const token = cur?.data?.session?.access_token;
      if (token) h['Authorization'] = 'Bearer ' + token;
    } catch (e) {}
    return h;
  },

  // The active account's display name (accounts.name), from the cached list.
  // Used to pre-fill onboarding and detect a still-default name (email/"My Bar").
  activeAccountName() {
    const id = this._accountId || this._getStoredActiveAccountId();
    const a = (this._accountsCache || []).find(x => x.id === id);
    return a ? a.name : null;
  },

  // Sync accounts.name (the bar switcher's label) with the in-app bar name.
  // Called from onboarding + Business Profile save. Owner/admin only (enforced
  // server-side). Updates the cached list so the switcher reflects it at once.
  async setAccountName(name) {
    if (!this._sb || !this._user || !name || !String(name).trim()) return { ok: false };
    const accountId = await this._ensureAccountId();
    if (!accountId) return { ok: false };
    try {
      const headers = await this._authHeaders();
      const r = await fetch('/api/set-account-name', {
        method: 'POST', headers, body: JSON.stringify({ accountId, name: String(name).trim() })
      });
      const data = await r.json();
      if (data.ok && Array.isArray(this._accountsCache)) {
        const a = this._accountsCache.find(x => x.id === accountId);
        if (a) a.name = String(name).trim();
      }
      return data;
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  // Clickwrap: record a Terms/Privacy acceptance (who / when / which version).
  // Called right after signUp, while the session is live so RLS insert-self
  // (user_id = auth.uid()) passes. Best-effort: a failure here never blocks the
  // paid signup, but it should essentially never fail.
  async recordTosAcceptance(accountId, version, termsUrl, privacyUrl) {
    if (!this._sb || !this._user) return { error: { message: 'Not signed in' } };
    return await this._sb.from('tos_acceptances').insert({
      user_id:     this._user.id,
      account_id:  accountId || null,
      tos_version: version,
      terms_url:   termsUrl || null,
      privacy_url: privacyUrl || null
    });
  },

  async signOut() {
    if (!this._sb) return;
    await this._sb.auth.signOut();
    this._user = null;
    this._accountId = null;
    this._role = null;
    this._ownerUserId = null;
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
      // Billing is per bar: the subscription lives on the account, not the user.
      // An owner of two bars has two subscription rows, keyed by account_id.
      const accountId = await this._ensureAccountId();
      if (!accountId) {
        return { status: 'inactive', plan: null, active_modules: [], period_end: null };
      }
      const { data, error } = await this._sb
        .from('subscriptions')
        .select('subscription_status, subscription_plan, active_modules, current_period_end')
        .eq('account_id', accountId)
        .single();

      if (error) {
        // PGRST116 = no matching row = genuinely no subscription on this bar.
        if (error.code === 'PGRST116') {
          return { status: 'inactive', plan: null, active_modules: [], period_end: null };
        }
        // Any other error = we could not READ the subscription (transient DB/RLS
        // hiccup). Report 'unknown' so the paywall never locks out a paying
        // customer over a momentary read failure.
        return { status: 'unknown', plan: null, active_modules: [], period_end: null };
      }
      if (!data) {
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
      // Couldn't reach the backend at all — treat as unknown, not unpaid.
      return { status: 'unknown', plan: null, active_modules: [], period_end: null };
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
          .select('account_id, role, permissions, accounts(owner_user_id)')
          .eq('user_id', this._user.id)
          .eq('account_id', stored)
          .maybeSingle();
        if (!e1 && m) {
          this._accountId = m.account_id;
          this._role = m.role || 'admin';
          this._ownerUserId = (m.accounts && m.accounts.owner_user_id) || null;
          this._permissions = m.permissions || {};
          return this._accountId;
        }
        // Stale stored ID (user lost access to that account). Clear it.
        this._setStoredActiveAccountId(null);
      }
      const { data, error } = await this._sb
        .from('memberships')
        .select('account_id, role, permissions, accounts(owner_user_id)')
        .eq('user_id', this._user.id)
        .order('account_id', { ascending: true })   // deterministic: a multi-account user with no stored active bar resolves to the SAME bar every time, not an arbitrary one
        .limit(1)
        .single();
      if (error || !data) return null;
      this._accountId = data.account_id;
      this._role = data.role || 'admin';
      this._ownerUserId = (data.accounts && data.accounts.owner_user_id) || null;
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
        .select('account_id, role, accounts(id, name, subscriptions(subscription_status))')
        .eq('user_id', this._user.id);
      if (error || !data) { this._accountsCache = []; return []; }
      const list = data
        .filter(m => m.accounts)
        .map(m => {
          const subs = m.accounts.subscriptions;
          const sub = Array.isArray(subs) ? subs[0] : subs;
          const st = sub && sub.subscription_status;
          // "active" for the switcher = a real bar the operator set up and paid
          // for. Include trialing/past_due (a transient failed retry) so such a
          // bar never vanishes from the switcher; exclude a never-paid mid-signup
          // bar (no row / inactive / incomplete / canceled).
          return { id: m.accounts.id, name: m.accounts.name || 'My Bar', role: m.role, active: st === 'active' || st === 'trialing' || st === 'past_due' };
        });
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

  // Current user's role in their active account. 'admin' | 'staff' | null if not
  // yet resolved. Resolved lazily as a side effect of any read/write. (The owner
  // holds an 'admin' membership plus accounts.owner_user_id — see isOwner.)
  role() { return this._role; },
  permissions() { return this._permissions || {}; },
  isAdmin()  { return this._role === 'admin'; },
  isStaff()  { return this._role === 'staff'; },
  isViewer() { return this._role === 'viewer'; },
  canWrite() { return this._role !== 'viewer'; },
  // Owner = the accounts.owner_user_id for the active account. Ownership lives on the
  // account (not as a membership role), so isOwner compares the signed-in user to it.
  // The Owner holds billing + can transfer ownership; admins cannot touch either.
  ownerUserId() { return this._ownerUserId; },
  isOwner() { return !!(this._user && this._ownerUserId && this._user.id === this._ownerUserId); },

  // ── Permission system — access by OPERATING AREA ────────────────────────────
  // Access is No Access / Full Access per area: a member's permissions object
  // holds { area: 'edit' } for each area they can use; a missing area = No Access.
  // (There is no read-only tier — that was dropped as unenforceable across every
  // screen for a trusted team.) This matches how the app is organized (by area),
  // so the owner grants "Inventory" once instead of toggling 40 screens.
  //
  // Owner: full access to everything (bypasses the map) — also holds billing.
  // Admin + Staff: look up the screen's area in their OWN permissions object,
  //   set by the owner (Admin additionally gets Settings; Staff only their
  //   password). There is no implicit-everything role below the owner.
  // Help screens (mapped to '_always'): accessible to anyone signed in.
  // A screen not listed below resolves its area from its id PREFIX (see
  // _areaOf), so a newly added screen never falsely blocks a member who has its
  // section — only the odd cross-section screens need an explicit entry here.
  SCREEN_GROUPS: {
    // Inventory
    'ic-take-inventory':'inventory','ic-count-history':'inventory',
    'ic-receive-delivery':'inventory','ic-delivery-history':'inventory',
    'ic-order-sheet':'inventory','ic-order-history':'inventory',
    'ic-spot-check':'inventory',
    'ic-transfers':'inventory','ic-empties':'inventory','ic-adjustments':'inventory',
    'ic-par-suggestions':'inventory',
    'ic-product-setup':'inventory','ic-locations':'inventory','ic-vendors':'inventory','ic-prep-batches':'inventory',
    'ic-report-stock':'inventory','ic-report-usage':'inventory','ic-report-variance':'inventory',
    'ic-dashboard':'inventory','ic-help':'_always',
    // Labor
    'lc-log-hours':'labor',
    'lc-tip-log':'labor','lc-tip-history':'labor',
    'lc-schedule-history':'labor','lc-build-schedule':'labor',
    'lc-staff-roster':'labor','lc-positions':'labor','lc-training':'labor',
    'lc-callout-log':'labor','lc-time-off':'labor',
    'lc-reports':'labor','lc-overtime-watch':'labor','lc-pay-periods':'labor','lc-payroll-export':'labor',
    'lc-dashboard':'labor','lc-help':'_always',
    // Shift
    'sc-cash-history':'shift','sc-cash-control':'shift','sc-drawers':'shift',
    'sc-checklists':'shift','sc-checklist-templates':'shift',
    'sc-void-comp':'shift','sc-maintenance':'shift','sc-incidents':'shift','sc-waste':'shift','sc-walked-tabs':'shift',
    'sc-dashboard':'shift','sc-help':'_always',
    // Profit Recovery
    'dashboard':'profit','this-week':'profit','audit-tracker':'profit','profit-fix':'profit',
    'cash-recon':'profit','theft-risk':'profit','sales-integrity':'profit',
    'recipe-cost-analysis':'profit','profit-experiments':'profit','vendor-tracker':'profit',
    'vendor-watch':'profit','vendor-scorecard':'profit','vendor-discrepancy':'profit',
    'profit-forecast':'profit','help':'_always',
    // Revenue Recovery
    'r-dashboard':'revenue','r-this-week':'revenue','r-forecast':'revenue',
    'r-audit':'revenue','r-fix':'revenue','r-server-check':'revenue','r-menu-items':'revenue',
    'r-menu-engineering':'revenue','r-menu-planning':'revenue',
    'r-dog-test':'revenue','r-experiments':'revenue','r-help':'_always',
    // Cash Recovery
    'c-dashboard':'cash','c-audit':'cash','c-playbook':'cash','c-fix':'cash','c-trapped':'cash','c-purchasing':'cash','c-capital':'cash','c-forecast':'cash','c-position':'cash','c-bridge':'cash','c-experiments':'cash','c-help':'_always',
    // Events
    'ev-dashboard':'events','ev-bookings':'events','ev-calendar':'events',
    'ev-regulars':'events','ev-pricing':'events','ev-help':'_always',
    // Books
    'hub-books':'books','hub-books-home':'books','hub-breakeven':'books',
    // Bar Cop Audit (the cross-section meta-audit — its own grantable area)
    'bar-cop-audit':'audit'
  },

  // Resolve a screen's operating area: an explicit SCREEN_GROUPS entry wins
  // (needed for help '_always', Books hub pages, and the prefix-less Profit
  // screens); otherwise fall back to the id prefix so every section screen maps
  // to its area automatically and no unlisted screen can falsely block a member.
  _areaOf(screen) {
    const g = this.SCREEN_GROUPS[screen];
    if (g) return g;
    if (/^ic-/.test(screen)) return 'inventory';
    if (/^lc-/.test(screen)) return 'labor';
    if (/^sc-/.test(screen)) return 'shift';
    if (/^ev-/.test(screen)) return 'events';
    if (/^r-/.test(screen))  return 'revenue';
    if (/^c-/.test(screen))  return 'cash';
    return 'profit';   // Profit screens carry no common prefix
  },

  canAccessLevel(screen) {
    if (!this._role) return 'edit';  // not yet resolved (e.g., demo mode) — open
    if (this.SCREEN_GROUPS[screen] === '_always') return 'view';  // help — always readable
    if (this.isOwner()) return 'edit';        // Owner = full access to everything
    const area = this._areaOf(screen);
    return (this._permissions || {})[area] ? 'edit' : null;   // granted = Full Access, else No Access
  },

  screenAllowed(screen) { return this.canAccessLevel(screen) !== null; },
  screenCanAdd(screen)  { return this.canAccessLevel(screen) === 'edit'; },   // Full Access
  screenCanEdit(screen) { return this.canAccessLevel(screen) === 'edit'; },   // Full Access

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

  // Every offline/local-cache key is scoped to the ACTIVE ACCOUNT so a multi-bar
  // owner (or a shared browser) can never be served — or sync — one bar's cached
  // data under another. Uses the resolved account id, else the synchronously-stored
  // active-account id (the same one _ensureAccountId resolves to), so it is correct
  // even on the first read before the network resolves the account.
  _acctKey(base) {
    const acct = this._accountId || this._getStoredActiveAccountId();
    return acct ? (base + '__' + acct) : base;
  },

  _pendingList() {
    try { const r = localStorage.getItem(this._acctKey(this._PENDING_KEY)); return r ? JSON.parse(r) : []; }
    catch (e) { return []; }
  },
  _setPendingList(list) {
    try {
      const k = this._acctKey(this._PENDING_KEY);
      if (list && list.length) localStorage.setItem(k, JSON.stringify(list));
      else localStorage.removeItem(k);
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
    // The pending list is account-scoped, so it only holds THIS bar's offline
    // writes; push them back to THIS bar with the account-scoped upsert the rest of
    // the file uses (account_id + onConflict:'account_id'), not a user_id upsert
    // that would fail or land under the wrong bar for a multi-account owner.
    const accountId = await this._ensureAccountId();
    if (!accountId) return { ok: false, synced: 0, failed: 0, error: 'No account membership' };
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
          account_id: accountId, user_id: this._user.id, data: data, updated_at: new Date().toISOString()
        }, { onConflict: 'account_id' });
        if (error) { failed++; }
        else { this._clearPending(lsKey); synced++; }
      } catch (e) { failed++; }
    }
    return { ok: failed === 0, synced: synced, failed: failed };
  },

  // ── Local storage fallback ────────────────────────────────────────────────
  _localRead() {
    try {
      const r = localStorage.getItem(this._acctKey('pf_data'));
      return r ? JSON.parse(r) : this._defaultData();
    } catch (e) {
      return this._defaultData();
    }
  },

  _localWrite(data) {
    try {
      localStorage.setItem(this._acctKey('pf_data'), JSON.stringify(data));
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
      const r = localStorage.getItem(this._acctKey(lsKey));
      return r ? JSON.parse(r) : {};
    } catch (e) {
      return {};
    }
  },

  _localWriteControl(lsKey, data) {
    try {
      localStorage.setItem(this._acctKey(lsKey), JSON.stringify(data));
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
  _evCacheKey(table, kind) { return this._acctKey('pfev_' + table + '_' + kind); },
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
          // One page of the query. Secondary order by id keeps pagination stable
          // when many rows share a date.
          const page = (from, to) => {
            let q = this._sb.from(table).select('payload,date')
              .eq('account_id', accountId).eq('kind', kind)
              .order('date', { ascending: false, nullsFirst: false })
              .order('id', { ascending: false });
            // Default = the rolling window; include null-date rows so a record
            // missing a business date is never hidden.
            if (opts.before) q = q.lt('date', opts.before);
            else q = q.or('date.gte.' + this._windowStartDate() + ',date.is.null');
            return q.range(from, to);
          };
          if (opts.limit) {
            const { data, error } = await page(0, opts.limit - 1);
            if (!error && Array.isArray(data)) return data.map(r => r.payload).filter(Boolean);
          } else {
            // Fetch EVERY row in the window, paging past Supabase's 1000-row cap
            // (a full year of logged hours / tips / voids blows past it). Without
            // this the oldest records silently stop loading.
            const PAGE = 1000; const recs = []; let from = 0;
            for (;;) {
              const { data, error } = await page(from, from + PAGE - 1);
              if (error || !Array.isArray(data)) { if (from === 0) throw (error || new Error('loadEvents')); break; }
              for (const r of data) { if (r && r.payload) recs.push(r.payload); }
              if (data.length < PAGE) break;
              from += PAGE;
            }
            this._cacheEvents(table, kind, recs);
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
      // queued:true — the op is safely in the local replay queue and WILL sync,
      // so the caller must keep it in the in-memory list (not revert it). Absent
      // on the viewer path below, which is a genuine rejection with no queue.
      if (!accountId) { this._queueEvent(table, kind, 'put', rec); return { ok: false, queued: true, error: 'no account membership found' }; }
      if (this._role === 'viewer') return { ok: false, error: 'Viewer access is read-only.' };
      try {
        const { error } = await this._sb.from(table).upsert({
          account_id: accountId, kind: kind, id: String(rec.id),
          date: this._eventDate(rec), payload: rec, updated_at: new Date().toISOString()
        }, { onConflict: 'account_id,kind,id' });
        if (error) { this._queueEvent(table, kind, 'put', rec); return { ok: false, queued: true, error }; }
        return { ok: true };
      } catch (e) { this._queueEvent(table, kind, 'put', rec); return { ok: false, queued: true, error: e }; }
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
      // queued:true — see putEvent: the delete is safely queued for replay, so
      // the caller keeps the row removed instead of restoring it.
      if (!accountId) { this._queueEvent(table, kind, 'del', { id }); return { ok: false, queued: true, error: 'no account membership found' }; }
      if (this._role === 'viewer') return { ok: false, error: 'Viewer access is read-only.' };
      try {
        const { error } = await this._sb.from(table).delete()
          .eq('account_id', accountId).eq('kind', kind).eq('id', String(id));
        if (error) { this._queueEvent(table, kind, 'del', { id }); return { ok: false, queued: true, error }; }
        return { ok: true };
      } catch (e) { this._queueEvent(table, kind, 'del', { id }); return { ok: false, queued: true, error: e }; }
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
  // Scoped to the active account (like every other local key) so a queued op
  // created under one bar can never replay into another after an account switch.
  _eventQueue() {
    try { return JSON.parse(localStorage.getItem(this._acctKey(this._EVENTQ_KEY)) || '[]'); }
    catch (e) { return []; }
  },
  _setEventQueue(list) {
    try {
      const k = this._acctKey(this._EVENTQ_KEY);
      if (list && list.length) localStorage.setItem(k, JSON.stringify(list));
      else localStorage.removeItem(k);
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
      // Menu items: the unified store for everything sellable on the menu.
      // Recipes live embedded as the optional `recipe` field on each item.
      // Edited from r-menu-items (Revenue Recovery) — the single edit
      // surface. Profit Recovery's Recipe Cost Analysis is read-only.
      menu_items: [],
      weeks: [],
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
      cash_audits: [],
      cash_outflows: [],
      revenue_server_checks: [],
      menu_dog_tests: [],
      revenue_price_log: [],
      getting_started_revenue: {},
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
