'use strict';

const DB = {
  _sb: null,
  _user: null,

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
      redirectTo: window.location.origin + '/reset'
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
          return { ok: false, error };
        }
        this._localWrite(appData); // keep local copy in sync
        return { ok: true };
      } catch (e) {
        console.error('writeData exception:', e);
        this._localWrite(appData);
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
          bar_labor_cost_pct: 28, food_labor_cost_pct: 30, prime_cost_pct: 60
        },
        cash_tolerance: 10,
        onboarding_complete: false
      },
      bar_products: [], kitchen_products: [], recipes: [],
      weeks: [], shifts: [], reconciliations: [],
      theft_scores: [], vendor_log: [], last_theft_score_date: null,
      audits: [],
      getting_started_profit: {}
    };
  }
};

window.DB = DB;
