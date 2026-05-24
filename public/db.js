'use strict';

const DB = {
  _sb: null,
  _user: null,
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
    return data?.session || null;
  },

  onAuthChange(cb) {
    if (!this._sb) return;
    this._sb.auth.onAuthStateChange((event, session) => {
      this._user = session?.user || null;
      cb(event, session);
    });
  },

  async signIn(email, password) {
    if (!this._sb) return { error: { message: 'Not connected' } };
    const { data, error } = await this._sb.auth.signInWithPassword({ email, password });
    if (data?.user) this._user = data.user;
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

  // ── Data ──────────────────────────────────────────────────────────────────
  async readData() {
    // Supabase mode
    if (this._sb && this._user) {
      // Unsynced local changes from an offline session are newer than the
      // server copy — load them so no offline work is lost.
      if (this._pendingList().includes('pf_data')) {
        return this._mergeDefaults(this._localRead());
      }
      try {
        const { data, error } = await this._sb
          .from('user_data')
          .select('data')
          .eq('user_id', this._user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('readData error:', error);
          return this._mergeDefaults(this._localRead());
        }
        if (!data) {
          // First login — create row with defaults
          const defaults = this._defaultData();
          await this._sb.from('user_data').insert({
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
      try {
        const { error } = await this._sb
          .from('user_data')
          .upsert({
            user_id: this._user.id,
            data: appData,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

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
    if (!list.includes(lsKey)) { list.push(lsKey); this._setPendingList(list); }
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
      try {
        const { data, error } = await this._sb
          .from(table)
          .select('data')
          .eq('user_id', this._user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('read ' + table + ' error:', error);
          return this._localReadControl(lsKey);
        }
        if (!data) {
          // First access — create the row with an empty object
          await this._sb.from(table).insert({
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
      try {
        const { error } = await this._sb
          .from(table)
          .upsert({
            user_id: this._user.id,
            data: data,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

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
  async readShiftData()          { return await this._readControl('sc_data', 'pf_sc_data'); },
  async writeShiftData(data)     { return await this._writeControl('sc_data', 'pf_sc_data', data); },

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
        bar_type: 'bar_kitchen',
        annual_bar_revenue: 0, annual_food_revenue: 0,
        targets: {
          bar_pour_cost_pct: 22, food_cost_pct: 32,
          bar_labor_cost_pct: 28, food_labor_cost_pct: 30, prime_cost_pct: 60
        },
        cash_tolerance: 10,
        onboarding_complete: false
      },
      bar_products: [], kitchen_products: [], recipes: [],
      weeks: [], shifts: [], reconciliations: [],
      theft_scores: [], vendor_log: [], last_theft_score_date: null,
      vendor_discrepancies: [],
      variance_investigations: [],
      audits: [],
      getting_started_profit: {},
      // Revenue Recovery data
      revenue_settings: {
        targets: {
          check_avg: 35,
          bar_labor_pct: 28,
          kitchen_labor_pct: 30,
          floor_labor_pct: 32,
          rplh_lunch: 50,
          rplh_dinner: 75,
          rplh_bar: 65,
          event_close_rate: 40
        },
        avg_hourly_wage: { bar: 15, kitchen: 14, floor: 13 },
        servers: [],
        _targets_saved: false
      },
      revenue_weeks: [],
      revenue_audits: [],
      revenue_server_checks: [],
      revenue_menu_items: [],
      menu_dog_tests: [],
      revenue_price_log: [],
      revenue_events: [],
      revenue_rate_cards: [],
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
        _targets_saved: false
      },
      traffic_weeks:   [],
      traffic_audits:  [],
      getting_started_traffic: {},
      // Hub — unified setup checklist progress (Section 1, Section 9)
      hub_setup_progress: {},
      // Fix layer — implemented-fix events feeding the Recovery Scoreboard
      fix_log: [],
      // Fix layer — per-gap step checklist progress, shape: { gap_id: [step_index,...] }
      fix_progress: {}
    };
  }
};

window.DB = DB;
