'use strict';
/* ── Hub Settings — the single platform-wide settings view ────────────────────
   A Hub-owned view, not a module screen. Opens from the Hub into the Hub
   container (never the module app shell), with a Back to Hub control. Tab
   navigation across the seven settings sections; each section saves on its
   own. Reads and writes the existing settings keys; purely a UI consolidation. */
S.HubSettings = {

  _activeTab: 'profile',

  // Open the Hub Settings view inside the Hub container. Mirrors App.showHub().
  open() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('ob-overlay').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
    let wrap = document.getElementById('hub-wrapper');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'hub-wrapper';
      wrap.style.cssText = 'position:fixed;inset:0;overflow-y:auto;background:var(--bg);z-index:100;';
      document.body.appendChild(wrap);
    }
    wrap.style.display = 'block';
    // The Hub leaves hub-wrapper at overflowY:hidden (fixed-viewport dashboard).
    // This view scrolls, so restore it whenever the wrapper is reused.
    wrap.style.overflowY = 'auto';
    this.render(wrap);
  },

  render(container) {
    const secs = [
      { id:'profile', title:'Profile',           body:this.secProfile() },
      { id:'profit',  title:'Profit Targets',    body:this.secProfit() },
      { id:'revenue', title:'Revenue Targets',   body:this.secRevenue() },
      { id:'traffic', title:'Traffic Targets',   body:this.secTraffic() },
      { id:'team',    title:'Team and Wages',    body:this.secTeam() },
      { id:'shift',   title:'Shift Preferences', body:this.secShift() },
      { id:'account', title:'Account',           body:this.secAccount() }
    ];
    container.scrollTop = 0;

    // Tab styles match the breadcrumb back-link palette (t3 default, t1 on
    // hover and on the active tab). The gold underline marks the active tab
    // visually so the text colors stay in the same family across the app.
    const tabs = '<div class="hs-tabs" style="display:flex;gap:0;border-bottom:1px solid var(--b2);margin-bottom:24px;">'
      + secs.map(s => {
          const on = s.id === this._activeTab;
          return '<button class="hs-tab" data-tab="' + s.id + '" '
            + 'style="background:none;border:none;border-bottom:2px solid ' + (on ? 'var(--gold)' : 'transparent') + ';'
            + 'color:' + (on ? 'var(--t1)' : 'var(--t3)') + ';font-family:\'Barlow\',sans-serif;font-size:11px;font-weight:600;'
            + 'letter-spacing:0.04em;padding:9px 12px;cursor:pointer;transition:color 0.12s;white-space:nowrap;">'
            + esc(s.title) + '</button>';
        }).join('')
      + '</div>';

    // Render every section body up front so unsaved input survives tab switches.
    // Only the active section is visible; the rest are display:none.
    const bodies = secs.map(s =>
      '<div class="hs-body" data-tab="' + s.id + '" '
      + 'style="display:' + (s.id === this._activeTab ? 'block' : 'none') + ';'
      + 'background:var(--surface);border:1px solid var(--b1);border-radius:4px;padding:22px 24px;">'
      + s.body + '</div>'
    ).join('');

    container.innerHTML =
      '<div style="max-width:880px;margin:0 auto;padding:0 24px 64px;">'
      + '<div style="display:flex;align-items:baseline;gap:10px;padding:20px 0 16px;position:sticky;top:0;background:var(--bg);z-index:5;border-bottom:1px solid var(--b2);margin-bottom:18px;">'
      +   '<div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--w);">App Settings</div>'
      +   '<span style="color:var(--t4);font-size:11px;font-weight:400;">|</span>'
      +   '<a id="hs-back" class="topbar-back-link">Back to Hub</a>'
      + '</div>'
      + tabs
      + bodies
      + '</div>';
    document.getElementById('hs-back').addEventListener('click', () => App.showHub());
    this.wire(container);
    this.renderSubscription();
  },

  saveRow(id) {
    return '<div style="display:flex;align-items:center;gap:12px;margin-top:18px;">'
      + '<button class="btn btn-primary hs-save" data-save="' + id + '">Save</button>'
      + '<span class="hs-msg" data-msg="' + id + '" style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--gold);display:none;">Saved</span>'
      + '</div>';
  },

  // ── Section bodies ──────────────────────────────────────────────────────────
  secProfile() {
    const s = App.data.settings || {};
    return '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="width:195px;"><label>Bar / Restaurant Name</label><input type="text" id="hs-name" value="' + esc(s.bar_name||'') + '" placeholder="The Rusty Nail"/></div>'
      + '<div class="f" style="width:100px;"><label>City</label><input type="text" id="hs-city" value="' + esc((s.city_state||'').split(',')[0]?.trim()||'') + '" placeholder="Austin"/></div>'
      + '<div class="f" style="width:125px;"><label>State / Province</label><input type="text" id="hs-state" value="' + esc((s.city_state||'').split(',')[1]?.trim()||'') + '" placeholder="TX"/></div>'
      + '<div class="f" style="width:145px;"><label>Bar Revenue ' + tt('hs-ann-bar-rev') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-abr" value="' + (s.annual_bar_revenue||'') + '" placeholder="Annual Bar Revenue"/></div></div>'
      + '<div class="f" style="width:145px;"><label>Food Revenue ' + tt('hs-ann-food-rev') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-afr" value="' + (s.annual_food_revenue||'') + '" placeholder="Annual Food Revenue"/></div></div>'
      + '</div>' + this.saveRow('profile');
  },

  secProfit() {
    const t = (App.data.settings||{}).targets || {};
    return '<div class="form-row" style="gap:16px 20px;flex-wrap:wrap;">'
      + '<div class="f" style="width:130px;"><label>Bar Pour Cost % ' + tt('sh-bar-pour') + '</label><div class="fw"><input class="suf" type="number" id="hs-bpc" value="' + (t.bar_pour_cost_pct ?? 22) + '" step="0.1"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Food Cost % ' + tt('sh-food-cost') + '</label><div class="fw"><input class="suf" type="number" id="hs-fc" value="' + (t.food_cost_pct ?? 32) + '" step="0.1"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Bar Labor % ' + tt('sh-bar-labor') + '</label><div class="fw"><input class="suf" type="number" id="hs-bl" value="' + (t.bar_labor_cost_pct ?? 28) + '" step="0.1"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Food Labor % ' + tt('sh-food-labor') + '</label><div class="fw"><input class="suf" type="number" id="hs-fl" value="' + (t.food_labor_cost_pct ?? 30) + '" step="0.1"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Prime Cost % ' + tt('sh-prime-cost') + '</label><div class="fw"><input class="suf" type="number" id="hs-pc" value="' + (t.prime_cost_pct ?? 60) + '" step="0.1"/><span class="suf">%</span></div></div>'
      + '</div>' + this.saveRow('profit');
  },

  secRevenue() {
    const rt = ((App.data.revenue_settings||{}).targets) || {};
    return '<div class="form-row" style="gap:16px 20px;flex-wrap:wrap;">'
      + '<div class="f" style="width:130px;"><label>Check Average ' + tt('r-check-avg') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-r-ca" value="' + (rt.check_avg ?? 35) + '" step="0.5"/></div></div>'
      + '<div class="f" style="width:130px;"><label>Bar Labor % ' + tt('r-bar-labor') + '</label><div class="fw"><input class="suf" type="number" id="hs-r-bl" value="' + (rt.bar_labor_pct ?? 28) + '" step="0.1"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Kitchen Labor % ' + tt('r-kitchen-labor') + '</label><div class="fw"><input class="suf" type="number" id="hs-r-kl" value="' + (rt.kitchen_labor_pct ?? 30) + '" step="0.1"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Floor Labor % ' + tt('r-floor-labor') + '</label><div class="fw"><input class="suf" type="number" id="hs-r-fl" value="' + (rt.floor_labor_pct ?? 32) + '" step="0.1"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Lunch RPLH ' + tt('r-lunch-rplh') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-r-rl" value="' + (rt.rplh_lunch ?? 50) + '"/></div></div>'
      + '<div class="f" style="width:130px;"><label>Dinner RPLH ' + tt('r-dinner-rplh') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-r-rd" value="' + (rt.rplh_dinner ?? 75) + '"/></div></div>'
      + '<div class="f" style="width:130px;"><label>Bar RPLH ' + tt('r-bar-rplh') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-r-rb" value="' + (rt.rplh_bar ?? 65) + '"/></div></div>'
      + '<div class="f" style="width:130px;"><label>Event Close Rate ' + tt('r-event-close') + '</label><div class="fw"><input class="suf" type="number" id="hs-r-ec" value="' + (rt.event_close_rate ?? 40) + '" step="1"/><span class="suf">%</span></div></div>'
      + '</div>' + this.saveRow('revenue');
  },

  secTraffic() {
    const tg = ((App.data.traffic_settings||{}).targets) || {};
    return '<div class="form-row" style="gap:16px 20px;flex-wrap:wrap;">'
      + '<div class="f" style="width:140px;"><label>Google Rating ' + tt('t-google-rating') + '</label><div class="fw"><input class="suf" type="number" id="hs-t-gr" value="' + (tg.google_rating ?? 4.3) + '" step="0.1" min="1" max="5"/><span class="suf">&#9733;</span></div></div>'
      + '<div class="f" style="width:140px;"><label>New Reviews / Mo ' + tt('t-review-vel') + '</label><div class="fw"><input class="suf" type="number" id="hs-t-rv" value="' + (tg.review_velocity ?? 8) + '" step="1"/><span class="suf">/mo</span></div></div>'
      + '<div class="f" style="width:140px;"><label>Response Rate ' + tt('t-response-rate') + '</label><div class="fw"><input class="suf" type="number" id="hs-t-rr" value="' + (tg.response_rate ?? 75) + '" step="1"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:140px;"><label>Monthly Sessions ' + tt('t-monthly-sessions') + '</label><div class="fw"><input class="suf" type="number" id="hs-t-ms" value="' + (tg.monthly_sessions ?? 2000) + '" step="100"/><span class="suf">/mo</span></div></div>'
      + '<div class="f" style="width:140px;"><label>Social Posts / Mo ' + tt('t-social-posts') + '</label><div class="fw"><input class="suf" type="number" id="hs-t-sp" value="' + (tg.social_posts_month ?? 12) + '" step="1"/><span class="suf">posts</span></div></div>'
      + '</div>' + this.saveRow('traffic');
  },

  secTeam() {
    const wg = ((App.data.revenue_settings||{}).avg_hourly_wage) || { bar:15, kitchen:14, floor:13 };
    return '<div class="form-row" style="gap:16px 20px;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;"><label>Bar Staff Wage ' + tt('r-wage-bar') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-w-bar" value="' + (wg.bar ?? 15) + '" step="0.25"/></div></div>'
      + '<div class="f" style="width:160px;"><label>Kitchen Staff Wage ' + tt('r-wage-kitchen') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-w-kit" value="' + (wg.kitchen ?? 14) + '" step="0.25"/></div></div>'
      + '<div class="f" style="width:150px;"><label>Floor Staff Wage ' + tt('r-wage-floor') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-w-floor" value="' + (wg.floor ?? 13) + '" step="0.25"/></div></div>'
      + '</div>' + this.saveRow('team');
  },

  secInventory() {
    return '<div style="font-size:12px;color:var(--t2);line-height:1.7;">Inventory Control has no platform-level preferences. Counting locations, vendors, and par levels are set inside the Inventory Control module, on each product and location.</div>';
  },

  secShift() {
    const s = App.data.settings || {};
    return '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
      + '<div class="f" style="width:180px;"><label>Cash Variance Tolerance ' + tt('sh-cash-tol') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-ct" value="' + (s.cash_tolerance ?? 10) + '"/></div></div>'
      + '</div>'
      + this.saveRow('shift');
  },

  secNotifications() {
    return '<div style="font-size:12px;color:var(--t2);line-height:1.7;">Alerts surface automatically on the Hub: metric breaches, forward-looking warnings, and Traffic activity reminders. There are no notification toggles to configure yet. When email or push delivery is added, its controls will live here.</div>';
  },

  secAccount() {
    const eye = (id) => '<button type="button" class="pw-eye" tabindex="-1" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);margin-left:6px;padding:0 9px;cursor:pointer;color:var(--t3);display:flex;align-items:center;flex-shrink:0;" onclick="const i=document.getElementById(\'' + id + '\');i.type=i.type===\'password\'?\'text\':\'password\';this.style.color=i.type===\'text\'?\'var(--gold)\':\'var(--t3)\';"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/></svg></button>';
    const sh = (txt) => '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin:18px 0 12px;">' + txt + '</div>';
    const userEmail = DB._user?.email || (App.demoMode ? 'Demo Account' : '');
    const accountInfo = userEmail
      ? sh('Account').replace('margin:18px', 'margin:2px')
        + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:4px;">Signed in as <span style="color:var(--t1);font-weight:600;">' + esc(userEmail) + '</span></div>'
      : '';
    return accountInfo
      + sh('Password')
      + '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
      + '<div class="f" style="width:220px;"><label>New Password</label><div class="fw"><input class="suf" type="password" id="s-pw1" placeholder="Enter new password" autocomplete="new-password"/>' + eye('s-pw1') + '</div></div>'
      + '<div class="f" style="width:220px;"><label>Confirm Password</label><div class="fw"><input class="suf" type="password" id="s-pw2" placeholder="Confirm new password" autocomplete="new-password"/>' + eye('s-pw2') + '</div></div>'
      + '<div style="display:flex;align-items:flex-end;padding-bottom:1px;"><button class="btn btn-ghost" id="s-pw-btn">Update Password</button></div>'
      + '</div>'
      + '<div id="s-pw-msg" style="font-size:12px;margin-top:8px;display:none;"></div>'
      + sh('Subscription')
      + '<div id="s-sub-content"></div>'
      + sh('Data and Backup')
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:14px;line-height:1.6;">Export a full backup of everything in your account: settings, weekly numbers, audits, and your Inventory, Labor, and Shift Control records, in one file you keep offsite. Restore from a backup to recover your data or move it.</div>'
      + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
      + '<button class="btn btn-ghost" id="s-export-data">Export Backup</button>'
      + '<button class="btn btn-ghost" id="s-import-btn">Restore from Backup</button>'
      + '<input type="file" id="s-import-file" accept="application/json,.json" style="display:none;"/>'
      + '</div>'
      + '<div id="s-backup-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-top:12px;display:none;"></div>'
      // Testing Tools — build-time only. Remove the Load Sample button (and its
      // wire() listener) before launching the paid app.
      + (App.demoMode ? '' :
          sh('Testing Tools')
          + '<div style="font-size:12px;color:var(--t2);margin-bottom:14px;line-height:1.6;">Load realistic sample data across every module to test calculations and layouts. Clear all data wipes every store, App data and Inventory, Labor, and Shift Control, and starts fresh.</div>'
          + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
          + '<button class="btn btn-ghost" id="s-load-sample">Load Sample Data</button>'
          + '<button class="btn btn-danger" id="s-clear-all">Clear All Data</button>'
          + '<button class="btn btn-ghost" id="s-reset-ob" style="margin-left:auto;">Reset Onboarding</button>'
          + '</div>'
          + '<div id="s-test-msg" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-top:12px;display:none;"></div>');
  },

  // ── Wiring ──────────────────────────────────────────────────────────────────
  wire(container) {
    // Tab switching — toggle display rather than re-render so any unsaved
    // input in a tab survives a switch away and back.
    container.querySelectorAll('.hs-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const newTab = btn.dataset.tab;
        if (newTab === this._activeTab) return;
        this._activeTab = newTab;
        container.querySelectorAll('.hs-tab').forEach(t => {
          const on = t.dataset.tab === newTab;
          t.style.borderBottomColor = on ? 'var(--gold)' : 'transparent';
          t.style.color = on ? 'var(--t1)' : 'var(--t3)';
        });
        container.querySelectorAll('.hs-body').forEach(b => {
          b.style.display = b.dataset.tab === newTab ? 'block' : 'none';
        });
        container.scrollTop = 0;
      });
    });
    container.querySelectorAll('.hs-save').forEach(btn => {
      btn.addEventListener('click', () => this.saveSection(btn.dataset.save));
    });
    document.getElementById('s-pw-btn')?.addEventListener('click', () => this.changePassword());
    document.getElementById('s-export-data')?.addEventListener('click', () => this.exportBackup());
    document.getElementById('s-import-btn')?.addEventListener('click', () => document.getElementById('s-import-file')?.click());
    document.getElementById('s-import-file')?.addEventListener('change', (e) => this.importBackup(e));
    document.getElementById('s-load-sample')?.addEventListener('click', () => this.loadSample());
    document.getElementById('s-clear-all')?.addEventListener('click', () => this.clearAll());
    document.getElementById('s-reset-ob')?.addEventListener('click', async () => {
      App.data.settings.onboarding_complete = false;
      App.data.settings._targets_saved = false;
      await App.saveKey('settings');
      window.location.reload();
    });
  },

  _flashSaved(id) {
    const m = document.querySelector('.hs-msg[data-msg="' + id + '"]');
    if (m) { m.style.display = 'inline'; setTimeout(() => { m.style.display = 'none'; }, 2500); }
  },

  // ── Per-section save — writes only that section's existing keys ─────────────
  saveSection(which) {
    const numOr = (id, d) => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? d : v; };
    const keys = [];

    if (which === 'profile') {
      const s = App.data.settings;
      const city  = document.getElementById('hs-city')?.value.trim() || '';
      const state = document.getElementById('hs-state')?.value.trim() || '';
      s.bar_name            = document.getElementById('hs-name')?.value.trim() || '';
      s.city_state          = city && state ? city + ', ' + state : city || state || '';
      s.annual_bar_revenue  = numOr('hs-abr', 0);
      s.annual_food_revenue = numOr('hs-afr', 0);
      keys.push('settings');
    } else if (which === 'profit') {
      const s = App.data.settings;
      s.targets = Object.assign({}, s.targets, {
        bar_pour_cost_pct:  numOr('hs-bpc', 22),
        food_cost_pct:      numOr('hs-fc', 32),
        bar_labor_cost_pct: numOr('hs-bl', 28),
        food_labor_cost_pct:numOr('hs-fl', 30),
        prime_cost_pct:     numOr('hs-pc', 60)
      });
      s._targets_saved = true;
      keys.push('settings');
    } else if (which === 'revenue') {
      const rs = App.data.revenue_settings = App.data.revenue_settings || {};
      rs.targets = Object.assign({}, rs.targets, {
        check_avg:         numOr('hs-r-ca', 35),
        bar_labor_pct:     numOr('hs-r-bl', 28),
        kitchen_labor_pct: numOr('hs-r-kl', 30),
        floor_labor_pct:   numOr('hs-r-fl', 32),
        rplh_lunch:        numOr('hs-r-rl', 50),
        rplh_dinner:       numOr('hs-r-rd', 75),
        rplh_bar:          numOr('hs-r-rb', 65),
        event_close_rate:  numOr('hs-r-ec', 40)
      });
      rs._targets_saved = true;
      keys.push('revenue_settings');
    } else if (which === 'traffic') {
      const ts = App.data.traffic_settings = App.data.traffic_settings || {};
      ts.targets = Object.assign({}, ts.targets, {
        google_rating:      numOr('hs-t-gr', 4.3),
        review_velocity:    numOr('hs-t-rv', 8),
        response_rate:      numOr('hs-t-rr', 75),
        monthly_sessions:   numOr('hs-t-ms', 2000),
        social_posts_month: numOr('hs-t-sp', 12)
      });
      ts._targets_saved = true;
      keys.push('traffic_settings');
    } else if (which === 'team') {
      const rs = App.data.revenue_settings = App.data.revenue_settings || {};
      rs.avg_hourly_wage = {
        bar:     numOr('hs-w-bar', 15),
        kitchen: numOr('hs-w-kit', 14),
        floor:   numOr('hs-w-floor', 13)
      };
      keys.push('revenue_settings');
    } else if (which === 'shift') {
      App.data.settings.cash_tolerance = numOr('hs-ct', 10);
      keys.push('settings');
    } else {
      return;
    }

    Promise.all(keys.map(k => App.saveKey(k))).then(() => {
      this._flashSaved(which);
      App.updatePeriod();
    });
  },

  renderSubscription() {
    const el = document.getElementById('s-sub-content');
    if (!el) return;
    const sub = App.subscription || {};
    const status = sub.status || 'inactive';
    const periodEnd = sub.period_end ? new Date(sub.period_end) : null;

    // Single-tier subscription (Section 13 of platform map: "One price.
    // Everything included.") — no more module/tier breakdown.
    const planName = 'Bar Cop Recovery Platform';
    const statusMeta = {
      active:   { color: 'var(--green)', label: 'Active' },
      past_due: { color: 'var(--red)',   label: 'Past Due' },
      canceled: { color: 'var(--red)',   label: 'Canceled' },
      inactive: { color: 'var(--t2)',    label: 'No Active Subscription' }
    };
    const meta = statusMeta[status] || statusMeta.inactive;

    let billingLine = '';
    if (status === 'active' && periodEnd) {
      billingLine = '<div style="font-size:12px;color:var(--t2);margin-top:4px;">Renews ' + periodEnd.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) + '</div>';
    } else if (status === 'canceled' && periodEnd) {
      billingLine = '<div style="font-size:12px;color:var(--red);margin-top:4px;">Access ends ' + periodEnd.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) + '</div>';
    }

    // 30-day cancellation retention (Section 15) — after a subscription is
    // canceled the operator's data is kept 30 days so they can export it.
    let retentionBlock = '';
    if (status === 'canceled') {
      let removalLine = 'Your data is kept for 30 days after your access ends so you have time to export it. After that it is removed.';
      if (periodEnd) {
        const removal = new Date(periodEnd.getTime() + 30 * 86400000);
        removalLine = 'Your data is kept until ' + removal.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
          + ', 30 days after your access ends, so you have time to export it. After that it is removed.';
      }
      retentionBlock = '<div style="border:1px solid rgba(192,56,40,0.35);border-radius:4px;padding:14px 16px;margin-top:16px;">'
        + '<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--red);margin-bottom:8px;text-transform:uppercase;">Export Your Data Before It Is Removed</div>'
        + '<div style="font-size:12px;color:var(--t2);margin-bottom:12px;line-height:1.6;">' + removalLine + ' Download a full backup now so you keep your records.</div>'
        + '<button class="btn btn-primary" id="s-retain-export">Export a Backup</button>'
        + '</div>';
    }

    el.innerHTML = '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div>'
      + '<div style="font-size:16px;font-weight:700;color:var(--t1);">' + planName + '</div>'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:' + meta.color + ';margin-top:4px;text-transform:uppercase;">' + meta.label + '</div>'
      + billingLine
      + '</div>'
      + (status === 'active' ? '<button class="btn btn-ghost" id="s-portal-btn" style="flex-shrink:0;">Manage Billing</button>' : '')
      + '</div>'
      + retentionBlock;

    document.getElementById('s-portal-btn')?.addEventListener('click', () => this.openBillingPortal());
    document.getElementById('s-retain-export')?.addEventListener('click', () => this.exportBackup());
  },

  async openBillingPortal() {
    const btn = document.getElementById('s-portal-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Opening...'; }
    try {
      const userId = DB._sb?.auth?.getUser ? (await DB._sb.auth.getUser()).data?.user?.id : null;
      if (!userId) throw new Error('Not logged in.');
      const res = await fetch('/api/billing-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not open billing portal.');
      window.open(data.url, '_blank');
    } catch (e) {
      alert('Could not open billing portal: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Manage Billing'; }
    }
  },

  async changePassword() {
    const pw1=document.getElementById('s-pw1')?.value;
    const pw2=document.getElementById('s-pw2')?.value;
    const msg=document.getElementById('s-pw-msg');
    if(!pw1||pw1.length<8){if(msg){msg.style.color='var(--red)';msg.textContent='Password must be at least 8 characters.';msg.style.display='block';}return;}
    if(pw1!==pw2){if(msg){msg.style.color='var(--red)';msg.textContent='Passwords do not match.';msg.style.display='block';}return;}
    const btn=document.getElementById('s-pw-btn');
    if(btn){btn.disabled=true;btn.textContent='Updating...';}
    try{
      if(!DB._sb){throw new Error('Not connected to database.');}
      const{error}=await DB._sb.auth.updateUser({password:pw1});
      if(error)throw error;
      if(msg){msg.style.color='var(--gold)';msg.textContent='Password updated successfully.';msg.style.display='block';}
      document.getElementById('s-pw1').value='';
      document.getElementById('s-pw2').value='';
    }catch(e){
      if(msg){msg.style.color='var(--red)';msg.textContent='Error: '+(e.message||'Could not update password.');msg.style.display='block';}
    }finally{
      if(btn){btn.disabled=false;btn.textContent='Update Password';}
    }
  },

  // ── Data backup (Section 15) ───────────────────────────────────────────────
  // A full, self-contained backup: the Recovery data blob plus all three
  // Control stores. Plain JSON the operator keeps offsite.
  _backupMsg(text, color) {
    const m = document.getElementById('s-backup-msg');
    if (m) { m.style.color = color || 'var(--gold)'; m.textContent = text; m.style.display = 'block'; }
  },

  exportBackup() {
    const backup = {
      _backup: 'barcop',
      version: 1,
      exported_at: new Date().toISOString(),
      bar_name: (App.data.settings && App.data.settings.bar_name) || '',
      data:          App.data || {},
      inventoryData: App.inventoryData || {},
      laborData:     App.laborData || {},
      shiftData:     App.shiftData || {}
    };
    try {
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const safe = (backup.bar_name || 'bar-cop').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'bar-cop';
      const a = document.createElement('a');
      a.href = url;
      a.download = 'barcop-backup-' + safe + '-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      this._backupMsg('Backup downloaded. Keep it somewhere safe.', 'var(--gold)');
    } catch (e) {
      this._backupMsg('Could not create the backup file: ' + (e.message || 'unknown error'), 'var(--red)');
    }
  },

  async importBackup(ev) {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    let backup;
    try {
      backup = JSON.parse(await file.text());
    } catch (e) {
      this._backupMsg('That file is not readable. Pick a Bar Cop backup file.', 'var(--red)');
      return;
    }
    if (!backup || backup._backup !== 'barcop' || !backup.data) {
      this._backupMsg('That is not a Bar Cop backup file.', 'var(--red)');
      return;
    }
    const when = backup.exported_at
      ? new Date(backup.exported_at).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
      : 'an unknown date';
    if (!confirm('Restore the backup from ' + when + '?\n\nThis replaces every record currently in your account: settings, weekly numbers, audits, and all Inventory, Labor, and Shift Control data. It cannot be undone.')) {
      return;
    }
    this._backupMsg('Restoring backup...', 'var(--t3)');
    try {
      App.data          = backup.data;
      App.inventoryData = backup.inventoryData || {};
      App.laborData     = backup.laborData || {};
      App.shiftData     = backup.shiftData || {};
      await App.save();
      await App.saveInventory();
      await App.saveLabor();
      await App.saveShift();
      this._backupMsg('Backup restored. Reloading...', 'var(--gold)');
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      this._backupMsg('Restore failed: ' + (e.message || 'unknown error'), 'var(--red)');
    }
  },

  async loadSample() {
    const msg = document.getElementById('s-test-msg');
    if (msg) { msg.style.color = 'var(--gold)'; msg.textContent = 'Loading sample data...'; msg.style.display = 'block'; }

    const uid = () => App.uid();
    const today = new Date();
    const dateStr = (daysAgo) => { const d = new Date(today); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0,10); };

    // ── Settings ──
    App.data.settings.bar_name           = 'The Anchor Bar & Kitchen';
    App.data.settings.city_state         = 'Austin, TX';
    App.data.settings.annual_bar_revenue = 624000;
    App.data.settings.annual_food_revenue= 374400;
    App.data.settings.targets = { bar_pour_cost_pct:22, food_cost_pct:32, bar_labor_cost_pct:28, food_labor_cost_pct:30, prime_cost_pct:60 };
    App.data.settings.cash_tolerance     = 10;
    App.data.settings.onboarding_complete= true;

    // ── Bar Products ──
    const bp = [
      { id:uid(), name:"Tito's Handmade Vodka",    category:'Spirits',      vendor:'Republic National', bottle_size_oz:25.4, std_pour_oz:1.5, cost_per_unit:14.99, menu_price:9.00  },
      { id:uid(), name:"Espolòn Tequila Blanco",   category:'Spirits',      vendor:'Republic National', bottle_size_oz:25.4, std_pour_oz:1.5, cost_per_unit:17.49, menu_price:10.00 },
      { id:uid(), name:"Hendrick's Gin",            category:'Spirits',      vendor:'RNDC',              bottle_size_oz:25.4, std_pour_oz:1.5, cost_per_unit:24.99, menu_price:12.00 },
      { id:uid(), name:"Jack Daniel's Old No. 7",   category:'Spirits',      vendor:'Republic National', bottle_size_oz:25.4, std_pour_oz:1.5, cost_per_unit:16.99, menu_price:9.00  },
      { id:uid(), name:"Bacardi Superior Rum",      category:'Spirits',      vendor:'RNDC',              bottle_size_oz:25.4, std_pour_oz:1.5, cost_per_unit:11.99, menu_price:8.00  },
      { id:uid(), name:"Bud Light",                 category:'Beer - Bottle',vendor:'Glazer\'s',         bottle_size_oz:12,   std_pour_oz:12,  cost_per_unit:1.10,  menu_price:4.00  },
      { id:uid(), name:"Modelo Especial",           category:'Beer - Bottle',vendor:'Glazer\'s',         bottle_size_oz:12,   std_pour_oz:12,  cost_per_unit:1.35,  menu_price:5.00  },
      { id:uid(), name:"Austin Beerworks IPA",      category:'Beer - Draft', vendor:'Austin Beerworks',  bottle_size_oz:661,  std_pour_oz:16,  cost_per_unit:85.00, menu_price:6.00  },
      { id:uid(), name:"Kim Crawford Sauvignon Blanc",category:'Wine',       vendor:'RNDC',              bottle_size_oz:25.4, std_pour_oz:5,   cost_per_unit:12.99, menu_price:9.00  },
      { id:uid(), name:"Well Whiskey",              category:'Spirits',      vendor:'Republic National', bottle_size_oz:33.8, std_pour_oz:1.5, cost_per_unit:9.99,  menu_price:7.00  },
    ].map(p => {
      const pours = p.bottle_size_oz / p.std_pour_oz;
      const cpp   = p.cost_per_unit / pours;
      const pct   = cpp / p.menu_price * 100;
      return { ...p, pours_per_bottle: pours, cost_per_pour: cpp, pour_cost_pct: pct, created_at: new Date().toISOString() };
    });
    App.data.bar_products = bp;

    // ── Kitchen Products ──
    const kp = [
      { id:uid(), name:'Chicken Breast',      category:'Protein',    vendor:'Sysco',  unit:'lb',   cost_per_unit:3.20 },
      { id:uid(), name:'Beef Brisket',        category:'Protein',    vendor:'Sysco',  unit:'lb',   cost_per_unit:5.80 },
      { id:uid(), name:'Romaine Lettuce',     category:'Produce',    vendor:'Sysco',  unit:'head', cost_per_unit:1.50 },
      { id:uid(), name:'Lime Juice',          category:'Mixer/Supply',vendor:'Sysco', unit:'qt',   cost_per_unit:4.50 },
      { id:uid(), name:'Triple Sec',          category:'Mixer/Supply',vendor:'RNDC',  unit:'bottle',cost_per_unit:8.99 },
      { id:uid(), name:'Simple Syrup',        category:'Mixer/Supply',vendor:'Sysco', unit:'qt',   cost_per_unit:3.25 },
      { id:uid(), name:'Burger Patties 8oz',  category:'Protein',    vendor:'Sysco',  unit:'each', cost_per_unit:2.80 },
      { id:uid(), name:'Cheddar Cheese',      category:'Dairy',      vendor:'Sysco',  unit:'lb',   cost_per_unit:4.20 },
      { id:uid(), name:'Nacho Chips',         category:'Dry Goods',  vendor:'Sysco',  unit:'bag',  cost_per_unit:3.50 },
      { id:uid(), name:'Queso Sauce',         category:'Dairy',      vendor:'Sysco',  unit:'qt',   cost_per_unit:5.00 },
    ].map(p => ({ ...p, created_at: new Date().toISOString() }));
    App.data.kitchen_products = kp;

    // Recipes are built further down, once ic_products exists — see
    // "── Recipes" after the Inventory Control block.

    // ── 12 Weeks of Data — derived from the locked Anchor profile ──
    // Every figure traces to window.ANCHOR so Profit, Revenue and the Control
    // modules all describe one operation. Week 1 is oldest, week 12 most recent.
    const weeks = window.ANCHOR.weeks.map(a => {
      const endDate = dateStr((12 - a.wk) * 7);
      const bar_count = bp.map(p => {
        const used = +(Math.random()*3+0.5).toFixed(2);
        return { product_id:p.id, beg_inv:+(Math.random()*2+0.5).toFixed(1), purchases:+(Math.random()*4+1).toFixed(0), end_inv:+(Math.random()*1.5).toFixed(1), units_used:used, total_cost:+(used*p.cost_per_unit).toFixed(2) };
      });
      const bar_variance = bp.map(p => {
        const cnt = bar_count.find(c=>c.product_id===p.id);
        const actualPours = (cnt?.units_used||0) * p.pours_per_bottle;
        const theo = Math.round(actualPours * (0.95 + Math.random()*0.08));
        const varU = +(actualPours - theo).toFixed(1);
        return { product_id:p.id, actual_units:+actualPours.toFixed(1), theoretical_units:theo, variance_units:varU, variance_oz:+(varU*p.std_pour_oz).toFixed(1), variance_dollar:+(varU*p.cost_per_pour).toFixed(2), status:Math.abs(varU)<=2?'OK':'Over: Investigate' };
      });
      return { id:uid(), week_num:a.wk, period_end:endDate, saved_at:new Date().toISOString(),
        bar:{ revenue:a.bar_rev, cogs:a.bar_cogs, labor:a.bar_labor, cost_pct:a.bar_pour_pct,
              labor_pct:a.bar_labor/a.bar_rev*100, vs_target_pct:a.bar_pour_pct-22, vs_target_dollar:((a.bar_pour_pct-22)/100)*a.bar_rev },
        food:{ revenue:a.food_rev, cogs:a.food_cogs, labor:a.food_labor, cost_pct:a.food_cost_pct,
               labor_pct:a.food_labor/a.food_rev*100, vs_target_pct:a.food_cost_pct-32, vs_target_dollar:((a.food_cost_pct-32)/100)*a.food_rev },
        prime_cost_pct:a.prime_cost_pct, bar_count, bar_variance, food_count:[], notes:'' };
    });
    App.data.weeks = weeks;

    // ── Shifts ──
    const shiftNames = ['Maria G.','Jake T.','Samantha R.','Carlos M.','Ashley B.'];
    const shifts = [];
    for (let i = 0; i < 14; i++) {
      const rev  = 1800 + Math.round(Math.random()*800);
      const cogs = Math.round(rev * (0.22 + (Math.random()-0.5)*0.06));
      const pct  = cogs/rev*100;
      const diff = pct - 22;
      const status = diff<=0?'ON TARGET':diff<=3?'WATCH: SLIGHTLY OVER':'INVESTIGATE: SIGNIFICANTLY OVER';
      shifts.push({ id:uid(), date:dateStr(i*2), shift:['AM','PM','Late'][i%3], bartender:shiftNames[i%5], revenue:rev, cogs, pour_cost_pct:pct, variance_dollar:(diff/100)*rev, status, saved_at:new Date().toISOString() });
    }
    App.data.shifts = shifts;

    // ── Cash Reconciliations ──
    const recons = [];
    for (let i = 0; i < 10; i++) {
      const exp = 600 + Math.round(Math.random()*400);
      const cnt = exp + Math.round((Math.random()-0.5)*30);
      const os  = cnt - exp;
      recons.push({ id:uid(), date:dateStr(i*3), shift:['AM','PM','Close'][i%3], register:'1', cashier:shiftNames[i%5], opening_bank:200, expected_cash:exp, counted_cash:cnt, credit_debit:Math.round(Math.random()*800)+400, over_short:os, tolerance:10, status:Math.abs(os)<=10?'OK':os>0?'Over':'Short', saved_at:new Date().toISOString() });
    }
    App.data.reconciliations = recons;

    // ── Vendor Log ──
    App.data.vendor_log = [
      { id:uid(), date:dateStr(21), vendor:'Republic National', product_id:bp[0].id, product_name:"Tito's Handmade Vodka", product_type:'bar', old_price:14.99, new_price:15.99, change_dollar:1.00, change_pct:6.7, weekly_usage:4, annual_impact:208, saved_at:new Date().toISOString() },
      { id:uid(), date:dateStr(14), vendor:'Sysco',             product_id:kp[0].id, product_name:'Chicken Breast',        product_type:'kitchen', old_price:3.20, new_price:3.45, change_dollar:0.25, change_pct:7.8, weekly_usage:20, annual_impact:260, saved_at:new Date().toISOString() },
      { id:uid(), date:dateStr(7),  vendor:'Glazer\'s',         product_id:bp[6].id, product_name:'Modelo Especial',       product_type:'bar', old_price:1.35, new_price:1.50, change_dollar:0.15, change_pct:11.1, weekly_usage:48, annual_impact:374.4, saved_at:new Date().toISOString() },
    ];

    // ── Theft Scores ──
    App.data.theft_scores = [
      { id:uid(), date:dateStr(60), scores:{0:3,1:4,2:3,3:4,4:3,5:4,6:3,7:4,8:3,9:3,10:4,11:4}, total:42, rating:'High Risk: Immediate Action' },
      { id:uid(), date:dateStr(30), scores:{0:2,1:3,2:2,3:3,4:2,5:3,6:2,7:3,8:2,9:2,10:3,11:3}, total:30, rating:'Moderate Risk: Tighten Controls' },
      { id:uid(), date:new Date().toISOString(),  scores:{0:1,1:2,2:1,3:2,4:1,5:2,6:1,7:2,8:1,9:2,10:2,11:2}, total:19, rating:'Low Risk: Strong Controls' },
    ];
    App.data.last_theft_score_date = new Date().toISOString();

    // ── Sample Audit Records (Profit + Revenue) ──
    // Three months of audits each, telling The Anchor Bar's recovery story.
    const daysAgoISO = (n) => new Date(Date.now() - n*24*60*60*1000).toISOString();
    const mkAudit = (mod, p) => {
      const d = p.raw;
      const sections = {};
      const items = [];
      if (mod === 'profit') {
        if (d.S1_SCORE != null) sections['Bar Cost and Pour Control'] = d.S1_SCORE;
        if (d.S2_SCORE != null) sections['Theft and Loss Prevention'] = d.S2_SCORE;
        if (d.S3_SCORE != null) sections['Food Cost Control']         = d.S3_SCORE;
        if (d.S4_SCORE != null) sections['Vendor Control']            = d.S4_SCORE;
        if (d.S5_SCORE != null) sections['Prime Cost']                = d.S5_SCORE;
        if (d.S1_MONTHLY_GAP    > 0) items.push({ action:'Reduce bar pour cost. $'+Math.round(d.S1_MONTHLY_GAP)+'/month gap vs target.', monthly_impact:d.S1_MONTHLY_GAP });
        if (d.S3_MONTHLY_GAP    > 0) items.push({ action:'Reduce food cost. $'+Math.round(d.S3_MONTHLY_GAP)+'/month gap vs target.', monthly_impact:d.S3_MONTHLY_GAP });
        if (d.S2_MONTHLY_GAP    > 0) items.push({ action:'Address void and comp rate. $'+Math.round(d.S2_MONTHLY_GAP)+'/month in excess.', monthly_impact:d.S2_MONTHLY_GAP });
        if (d.S4_EXPOSURE_MONTHLY > 0) items.push({ action:'Improve vendor verification. $'+Math.round(d.S4_EXPOSURE_MONTHLY)+'/month exposure.', monthly_impact:d.S4_EXPOSURE_MONTHLY });
        if (d.S5_COMBINED_COGS_GAP > 0) items.push({ action:'Close prime cost gap. $'+Math.round(d.S5_COMBINED_COGS_GAP)+'/month combined COGS overage.', monthly_impact:d.S5_COMBINED_COGS_GAP });
      } else {
        if (d.S1_SCORE != null) sections['Check Average and Revenue'] = d.S1_SCORE;
        if (d.S2_SCORE != null) sections['Labor Efficiency']          = d.S2_SCORE;
        if (d.S3_SCORE != null) sections['Menu Performance']          = d.S3_SCORE;
        if (d.S4_SCORE != null) sections['Server Performance']        = d.S4_SCORE;
        if (d.S5_SCORE != null) sections['Events and Private Dining'] = d.S5_SCORE;
        if (d.S1_MONTHLY_GAP > 0) items.push({ action:'Close check average gap. $'+Math.round(d.S1_MONTHLY_GAP)+'/month at current cover count.', monthly_impact:d.S1_MONTHLY_GAP });
        if (d.S2_MONTHLY_GAP > 0) items.push({ action:'Reduce labor cost. $'+Math.round(d.S2_MONTHLY_GAP)+'/month over target.', monthly_impact:d.S2_MONTHLY_GAP });
        if (d.S3_MONTHLY_GAP > 0) items.push({ action:'Improve menu mix. $'+Math.round(d.S3_MONTHLY_GAP)+'/month opportunity from repricing Dogs.', monthly_impact:d.S3_MONTHLY_GAP });
        if (d.S4_MONTHLY_GAP > 0) items.push({ action:'Close server performance spread. $'+Math.round(d.S4_MONTHLY_GAP)+'/month from bottom third to team average.', monthly_impact:d.S4_MONTHLY_GAP });
        if (d.S5_MONTHLY_GAP > 0) items.push({ action:'Grow event revenue. $'+Math.round(d.S5_MONTHLY_GAP)+'/month gap to target.', monthly_impact:d.S5_MONTHLY_GAP });
      }
      items.sort((a,b) => (b.monthly_impact||0) - (a.monthly_impact||0));
      const totalMo = items.reduce((s,i) => s + (i.monthly_impact||0), 0);
      d.WEEKLY_GAP_AMT = '$' + Math.round(totalMo/4.345).toLocaleString('en-US');
      return {
        id: uid(), date: p.date, bar_name: d.BAR_NAME, overall_score: d.OVERALL_SCORE,
        grade: d.DATA_TIER_LABEL, audit_period: d.AUDIT_PERIOD, audit_id: d.AUDIT_ID,
        sections, action_items: items, raw: d, generated_at: p.generated_at
      };
    };

    // ── Profit Audits ──
    App.data.audits = [
      mkAudit('profit', { date: dateStr(74), generated_at: daysAgoISO(74), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 21,
        DATA_TIER_LABEL: 'Tier 2 Analysis, Standard Data Submitted',
        AUDIT_PERIOD: 'February 2026, 4 weeks ending Feb 27', AUDIT_ID: 'PFA-2026-0031',
        INDUSTRY_AVG: 63, TARGET_SCORE: 65,
        S1_SCORE: 16, S1_BAR_COST_PCT: 29.4, S1_TARGET_PCT: 22, S1_BAR_REV_MONTHLY: 51200,
        S1_BEV_COGS_PERIOD: 15053, S1_INV_VARIANCE_PCT: 6.8, S1_INV_VARIANCE_AMT: 1024,
        S1_POUR_METHOD: 'Free pour, no jiggers in use', S1_RECIPE_COVERAGE: '0 of 18 cocktails costed',
        S1_MONTHLY_GAP: 3789, S1_ANNUAL_GAP: 45468,
        S1_NARRATIVE: 'Bar pour cost ran 29.4% against a 22% target. That is the single largest profit leak in this audit. Free pouring with no jiggers and no costed recipes means every drink is a guess.',
        S1_FINDING: 'A 6.8% inventory variance confirms the overage is pour discipline, not menu pricing. A 7.4-point cost overage on $51,200 of monthly bar sales is $3,789 walking out every month.',
        S1_TOOL: 'Start with the Measured Pour Standards policy and jigger every well and call drink.',
        S2_SCORE: 9, S2_VOID_COMP_PCT: 4.6, S2_VOID_COMP_AMT: 3827, S2_VOIDS_NO_APPROVAL_PCT: 71,
        S2_DRAWER_RECON: 'Not performed', S2_CASH_POLICY: 'No', S2_VOID_APPROVAL: 'No', S2_SPILLAGE_LOG: 'No',
        S2_MONTHLY_GAP: 2995,
        S2_NARRATIVE: 'Voids and comps reached 4.6% of sales, more than four times the 1% benchmark. 71% of voids were rung with no manager approval at all.',
        S2_FINDING: 'Two bartenders account for roughly 80% of unapproved voids. With no drawer reconciliation and no cash policy on file, there is no control gate anywhere in the cash path.',
        S2_TOOL: 'Require a manager PIN on all post-send voids and adopt the Closing Bar Checklist.',
        S3_SCORE: 14, S3_FOOD_COST_PCT: 39.8, S3_TARGET_PCT: 32, S3_FOOD_REV_MONTHLY: 30800,
        S3_FOOD_VAR_PCT: 7.1, S3_FOOD_VAR_AMT: 2187, S3_RECIPE_COVERAGE: '0 of 24 plates costed',
        S3_INV_FREQ: 'Never', S3_WASTE_LOG: 'No', S3_MONTHLY_GAP: 2402, S3_ANNUAL_GAP: 28829,
        S3_NARRATIVE: 'Food cost landed at 39.8% against a 32% target. No plates are costed, inventory is never counted, and there is no waste log.',
        S3_FINDING: 'A 7.1% food variance with zero recipe coverage means portioning is uncontrolled across the line. The 7.8-point overage costs $2,402 per month.',
        S3_TOOL: 'Cost the top 10 plates by volume first and run the Portion Control Audit weekly.',
        S4_SCORE: 12, S4_BEV_INVOICE_COUNT: 9, S4_FOOD_INVOICE_COUNT: 14, S4_VENDOR_SPEND_MONTHLY: 29400,
        S4_INVOICE_VS_PO: 'Never matched', S4_PRICE_VERIFY: 'No', S4_ANNUAL_BIDS: 'No', S4_BACKUP_VENDORS: 'None on file',
        S4_EXPOSURE_MONTHLY: 1140, S4_EXPOSURE_ANNUAL: 13680,
        S4_NARRATIVE: 'Invoices are never matched against orders and prices are never verified against quoted sheets.',
        S4_FINDING: 'Sampled invoices show price drift and at least two short deliveries that were paid in full. That works out to roughly $1,140 of monthly exposure, with no backup vendor to put pressure on prices.',
        S4_TOOL: 'Match every invoice to its delivery using the Vendor Delivery Inspection sheet.',
        S5_SCORE: 18, S5_TOTAL_REV_PERIOD: 82000, S5_TOTAL_COGS_PERIOD: 27311, S5_LABOR_PERIOD: 30340,
        S5_LABOR_PCT: 37.0, S5_BAR_COST_PCT: 29.4, S5_FOOD_COST_PCT: 39.8, S5_PRIME_COST_PCT: 70.3,
        S5_TARGET_PCT: 60, S5_PRIME_COST_AMT: 57651, S5_RPLH_TRACKED: 'No', S5_LABOR_BY_DEPT: 'No',
        S5_COMBINED_COGS_GAP: 6191,
        S5_NARRATIVE: 'Prime cost hit 70.3% against a 60% target. That is 10 points of margin gone before a single fixed cost is paid.',
        S5_FINDING: 'Both COGS and labor are out of range. Combined COGS alone is $6,191 over target for the period. Labor is not tracked by department and RPLH is not measured.',
        S5_TOOL: 'Fixing pour cost and food cost first pulls prime cost down fastest; revisit labor once COGS is in range.',
        S6_SIG1_SCORE: 'HIGH', S6_SIG1_LABEL: 'Premium spirit variance',
        S6_SIG1_EVIDENCE: 'Three top-shelf bottles show 11–14% negative variance against POS sales.',
        S6_SIG1_GAP: 'Roughly $640/month in unaccounted premium pours.',
        S6_SIG1_TOOL: 'Run the Shift Pour Check on every close for two weeks.',
        S6_SIG2_SCORE: 'HIGH', S6_SIG2_LABEL: 'Void concentration',
        S6_SIG2_EVIDENCE: '71% of voids were rung without a manager code; two bartenders account for 80% of them.',
        S6_SIG2_GAP: 'Pattern is consistent with comped-drink theft, not training error.',
        S6_SIG2_TOOL: 'Require a manager PIN on all post-send voids.',
        S6_SIG3_SCORE: 'MEDIUM', S6_SIG3_LABEL: 'No closing inventory counts',
        S6_SIG3_EVIDENCE: 'No end-of-night liquor counts were recorded in the audit period.',
        S6_SIG3_GAP: 'Variance cannot be isolated to a shift or a person.',
        S6_SIG3_TOOL: 'Adopt the Closing Bar Checklist nightly.',
        S6_SIG4_SCORE: 'MEDIUM', S6_SIG4_LABEL: 'Unrestricted comp authority',
        S6_SIG4_EVIDENCE: 'Every server can comp without a limit or a reason code.',
        S6_SIG4_GAP: 'Comp dollars are untracked and untrainable.',
        S6_SIG4_TOOL: 'Set a per-shift comp ceiling in the POS.'
      }}),
      mkAudit('profit', { date: dateStr(42), generated_at: daysAgoISO(42), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 39,
        DATA_TIER_LABEL: 'Tier 2 Analysis, Standard Data Submitted',
        AUDIT_PERIOD: 'March 2026, 4 weeks ending Mar 27', AUDIT_ID: 'PFA-2026-0036',
        INDUSTRY_AVG: 63, TARGET_SCORE: 65,
        S1_SCORE: 38, S1_BAR_COST_PCT: 26.1, S1_TARGET_PCT: 22, S1_BAR_REV_MONTHLY: 52400,
        S1_BEV_COGS_PERIOD: 13676, S1_INV_VARIANCE_PCT: 4.2, S1_INV_VARIANCE_AMT: 612,
        S1_POUR_METHOD: 'Jiggers on wells, free pour still used on call drinks',
        S1_RECIPE_COVERAGE: '11 of 18 cocktails costed', S1_MONTHLY_GAP: 2148, S1_ANNUAL_GAP: 25780,
        S1_NARRATIVE: 'Bar pour cost dropped from 29.4% to 26.1% after jiggers went onto every well. Inventory variance is nearly halved.',
        S1_FINDING: 'Call drinks are still free poured and seven cocktails remain uncosted. The remaining 4.1-point gap is concentrated there, worth $2,148 per month.',
        S1_TOOL: 'Extend measured pours to call liquor and finish costing the last seven cocktails.',
        S2_SCORE: 41, S2_VOID_COMP_PCT: 2.7, S2_VOID_COMP_AMT: 2268, S2_VOIDS_NO_APPROVAL_PCT: 34,
        S2_DRAWER_RECON: 'Performed at close', S2_CASH_POLICY: 'Draft', S2_VOID_APPROVAL: 'Manager PIN required', S2_SPILLAGE_LOG: 'No',
        S2_MONTHLY_GAP: 1428,
        S2_NARRATIVE: 'The manager-PIN requirement cut unapproved voids from 71% to 34% and pulled the void rate down to 2.7%.',
        S2_FINDING: 'Drawer reconciliation now happens at close. The cash policy is still only a draft and there is no spillage log, so breakage is still indistinguishable from theft.',
        S2_TOOL: 'Finalize the Cash Handling policy and start a daily spillage log.',
        S3_SCORE: 35, S3_FOOD_COST_PCT: 36.4, S3_TARGET_PCT: 32, S3_FOOD_REV_MONTHLY: 31600,
        S3_FOOD_VAR_PCT: 4.8, S3_FOOD_VAR_AMT: 1517, S3_RECIPE_COVERAGE: '16 of 24 plates costed',
        S3_INV_FREQ: 'Monthly', S3_WASTE_LOG: 'Started', S3_MONTHLY_GAP: 1390, S3_ANNUAL_GAP: 16685,
        S3_NARRATIVE: 'Food cost improved to 36.4% as recipe costing reached two-thirds of the menu.',
        S3_FINDING: 'Monthly counts replaced never-counting and a waste log is now in place. The remaining 4.4-point gap is $1,390 per month, mostly on the eight uncosted plates.',
        S3_TOOL: 'Finish the last eight plate cards and move counts from monthly to weekly.',
        S4_SCORE: 44, S4_BEV_INVOICE_COUNT: 10, S4_FOOD_INVOICE_COUNT: 15, S4_VENDOR_SPEND_MONTHLY: 28900,
        S4_INVOICE_VS_PO: 'Spot checked', S4_PRICE_VERIFY: 'Started', S4_ANNUAL_BIDS: 'No', S4_BACKUP_VENDORS: 'One identified',
        S4_EXPOSURE_MONTHLY: 610, S4_EXPOSURE_ANNUAL: 7320,
        S4_NARRATIVE: 'Invoice spot-checking caught two billing errors this period and price verification has begun.',
        S4_FINDING: 'Exposure fell to about $610 per month. One backup vendor has been identified but no annual bid process exists yet.',
        S4_TOOL: 'Match every delivery, not a sample, and schedule an annual bid for the top three categories.',
        S5_SCORE: 40, S5_TOTAL_REV_PERIOD: 84000, S5_TOTAL_COGS_PERIOD: 25178, S5_LABOR_PERIOD: 28560,
        S5_LABOR_PCT: 34.0, S5_BAR_COST_PCT: 26.1, S5_FOOD_COST_PCT: 36.4, S5_PRIME_COST_PCT: 64.0,
        S5_TARGET_PCT: 60, S5_PRIME_COST_AMT: 53738, S5_RPLH_TRACKED: 'Started', S5_LABOR_BY_DEPT: 'Yes',
        S5_COMBINED_COGS_GAP: 3538,
        S5_NARRATIVE: 'Prime cost came down from 70.3% to 64.0% as COGS controls took hold.',
        S5_FINDING: 'Labor is now tracked by department and RPLH measurement has started. Combined COGS is still $3,538 over target for the period.',
        S5_TOOL: 'Hold the COGS course; the last four points of prime cost will close as recipe coverage completes.',
        S6_SIG1_SCORE: 'MEDIUM', S6_SIG1_LABEL: 'Call-liquor free pour',
        S6_SIG1_EVIDENCE: 'Wells are jiggered but call and premium drinks are still free poured.',
        S6_SIG1_GAP: 'Most of the remaining pour-cost gap sits in this category.',
        S6_SIG1_TOOL: 'Extend measured pours to call liquor.',
        S6_SIG2_SCORE: 'LOW', S6_SIG2_LABEL: 'Void rate trending down',
        S6_SIG2_EVIDENCE: 'Void rate fell from 4.6% to 2.7% after the manager-PIN rule.',
        S6_SIG2_GAP: 'On track. Keep monitoring the two flagged bartenders.',
        S6_SIG2_TOOL: 'Review the weekly void report at the manager meeting.',
        S6_SIG3_SCORE: 'MEDIUM', S6_SIG3_LABEL: 'No spillage log',
        S6_SIG3_EVIDENCE: 'Breakage and spillage are still not recorded anywhere.',
        S6_SIG3_GAP: 'Legitimate loss cannot be separated from variance.',
        S6_SIG3_TOOL: 'Start the daily spillage log this week.'
      }}),
      mkAudit('profit', { date: dateStr(8), generated_at: daysAgoISO(8), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 57,
        DATA_TIER_LABEL: 'Tier 3 Analysis, Full Data Submitted',
        AUDIT_PERIOD: 'April 2026, 4 weeks ending Apr 24', AUDIT_ID: 'PFA-2026-0042',
        INDUSTRY_AVG: 63, TARGET_SCORE: 65,
        S1_SCORE: 62, S1_BAR_COST_PCT: 23.4, S1_TARGET_PCT: 22, S1_BAR_REV_MONTHLY: 53100,
        S1_BEV_COGS_PERIOD: 12425, S1_INV_VARIANCE_PCT: 2.1, S1_INV_VARIANCE_AMT: 312,
        S1_POUR_METHOD: 'Measured pours on all spirits', S1_RECIPE_COVERAGE: '18 of 18 cocktails costed',
        S1_MONTHLY_GAP: 743, S1_ANNUAL_GAP: 8920,
        S1_NARRATIVE: 'Bar pour cost is now 23.4%, just 1.4 points off target, with every cocktail costed and measured pours across the board.',
        S1_FINDING: 'Inventory variance of 2.1% is within a healthy range. The small residual gap is normal menu-mix drift, not a control failure.',
        S1_TOOL: 'Maintain the current discipline; review pour cost monthly rather than chasing it weekly.',
        S2_SCORE: 58, S2_VOID_COMP_PCT: 1.6, S2_VOID_COMP_AMT: 1351, S2_VOIDS_NO_APPROVAL_PCT: 8,
        S2_DRAWER_RECON: 'Performed at close', S2_CASH_POLICY: 'Yes', S2_VOID_APPROVAL: 'Manager PIN required', S2_SPILLAGE_LOG: 'Yes',
        S2_MONTHLY_GAP: 506,
        S2_NARRATIVE: 'Void and comp rate is down to 1.6%, near the 1% benchmark, with only 8% of voids unapproved.',
        S2_FINDING: 'The cash policy is finalized, drawers are reconciled at close, and a spillage log is running. Loss prevention is now a functioning system.',
        S2_TOOL: 'Audit the void report monthly and refresh staff training each quarter.',
        S3_SCORE: 54, S3_FOOD_COST_PCT: 33.8, S3_TARGET_PCT: 32, S3_FOOD_REV_MONTHLY: 31300,
        S3_FOOD_VAR_PCT: 2.9, S3_FOOD_VAR_AMT: 908, S3_RECIPE_COVERAGE: '24 of 24 plates costed',
        S3_INV_FREQ: 'Weekly', S3_WASTE_LOG: 'Yes', S3_MONTHLY_GAP: 563, S3_ANNUAL_GAP: 6761,
        S3_NARRATIVE: 'Food cost is 33.8%, within two points of target, with the full menu costed and weekly counts in place.',
        S3_FINDING: 'Food variance of 2.9% is acceptable. The remaining gap is small enough to close with targeted repricing on two plowhorse plates.',
        S3_TOOL: 'Use the Menu Engineering Audit to reprice the two lowest-margin plates.',
        S4_SCORE: 56, S4_BEV_INVOICE_COUNT: 11, S4_FOOD_INVOICE_COUNT: 16, S4_VENDOR_SPEND_MONTHLY: 27600,
        S4_INVOICE_VS_PO: 'Matched on every delivery', S4_PRICE_VERIFY: 'Yes', S4_ANNUAL_BIDS: 'Scheduled', S4_BACKUP_VENDORS: 'Two per category',
        S4_EXPOSURE_MONTHLY: 210, S4_EXPOSURE_ANNUAL: 2520,
        S4_NARRATIVE: 'Every delivery is now matched to its order and prices are verified against quoted sheets.',
        S4_FINDING: 'Exposure has fallen to about $210 per month. Two backup vendors per category give you real negotiating room. The annual bid is scheduled but not yet run.',
        S4_TOOL: 'Run the scheduled annual bid to lock in pricing for the next cycle.',
        S5_SCORE: 57, S5_TOTAL_REV_PERIOD: 84400, S5_TOTAL_COGS_PERIOD: 23004, S5_LABOR_PERIOD: 26964,
        S5_LABOR_PCT: 32.0, S5_BAR_COST_PCT: 23.4, S5_FOOD_COST_PCT: 33.8, S5_PRIME_COST_PCT: 59.2,
        S5_TARGET_PCT: 60, S5_PRIME_COST_AMT: 49968, S5_RPLH_TRACKED: 'Yes', S5_LABOR_BY_DEPT: 'Yes',
        S5_COMBINED_COGS_GAP: 1306,
        S5_NARRATIVE: 'Prime cost is 59.2%, under the 60% target for the first time in this audit series.',
        S5_FINDING: 'Labor is tracked by department and RPLH is in use. Combined COGS is a modest $1,306 over the period target, the last increment of margin to recover.',
        S5_TOOL: 'Hold prime cost here and shift focus to revenue growth to widen the margin further.',
        S6_SIG1_SCORE: 'LOW', S6_SIG1_LABEL: 'Pour discipline holding',
        S6_SIG1_EVIDENCE: 'Inventory variance has stayed under 3% for two consecutive periods.',
        S6_SIG1_GAP: 'No action required. This is the target state.',
        S6_SIG1_TOOL: 'Spot-check measured pours during pre-shift once a week.',
        S6_SIG2_SCORE: 'MEDIUM', S6_SIG2_LABEL: 'Annual vendor bid not yet run',
        S6_SIG2_EVIDENCE: 'Backup vendors are identified but the annual competitive bid is still pending.',
        S6_SIG2_GAP: 'Leaving roughly $1,800/year of negotiating room unused.',
        S6_SIG2_TOOL: 'Complete the annual bid before the next supplier contract renews.'
      }})
    ];

    // ── Revenue Audits ──
    App.data.revenue_audits = [
      mkAudit('revenue', { date: dateStr(74), generated_at: daysAgoISO(74), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 26,
        DATA_TIER_LABEL: 'Tier 2 Analysis, Standard Data Submitted',
        AUDIT_PERIOD: 'February 2026, 4 weeks ending Feb 27', AUDIT_ID: 'RVA-2026-0014',
        INDUSTRY_AVG: 61, TARGET_SCORE: 65,
        S1_SCORE: 22, S1_CHECK_AVG: 28.40, S1_CHECK_AVG_TARGET: 32.00, S1_BAR_CHECK_AVG: 22.10,
        S1_FOOD_CHECK_AVG: 34.80, S1_COVER_COUNT: 2890, S1_MONTHLY_REVENUE: 82100,
        S1_MONTHLY_GAP: 4910, S1_ANNUAL_GAP: 58920,
        S1_NARRATIVE: 'Blended check average of $28.40 sits $3.60 below a conservative $32.00 target. Bar checks at $22.10 are dragging the blend down hard.',
        S1_FINDING: 'There is no upsell standard and no add-on prompts. Capturing even half of the gap is worth $4,910 per month at the current cover count.',
        S1_TOOL: 'Roll out the Server Upsell Standards and Scripts and track check average weekly.',
        S2_SCORE: 28, S2_LABOR_PCT: 37.5, S2_LABOR_TARGET_PCT: 30, S2_RPLH: 58, S2_RPLH_TARGET: 75,
        S2_LABOR_PERIOD: 30788, S2_SCHED_VS_ACTUAL: '214 scheduled / 247 actual hrs', S2_OVERTIME_HRS: 41,
        S2_MONTHLY_GAP: 6158,
        S2_NARRATIVE: 'Total labor ran 37.5% against a 30% target. Actual hours overran the schedule by 33 hours and 41 of those were overtime.',
        S2_FINDING: 'RPLH of $58 is well short of the $75 target. The floor is overstaffed on slow shifts and clock-out discipline is loose.',
        S2_TOOL: 'Build the schedule against the Labor Budget tool and enforce clock-out times.',
        S3_SCORE: 24, S3_STARS_COUNT: 3, S3_PLOWHORSES_COUNT: 9, S3_DOGS_COUNT: 7, S3_PUZZLES_COUNT: 5,
        S3_TOP_CATEGORY: 'Draft Beer', S3_MONTHLY_GAP: 1820, S3_PRICING_OPPORTUNITY: 2640,
        S3_NARRATIVE: 'The menu carries seven Dogs, which are low-margin and low-popularity items, against only three Stars.',
        S3_FINDING: 'Revenue leans on low-margin draft beer. Repricing or cutting Dogs and promoting Stars is a $1,820/month mix opportunity, with $2,640 more available from pricing.',
        S3_TOOL: 'Run the Menu Engineering Audit and rework the seven Dog items.',
        S4_SCORE: 30, S4_SERVER_COUNT: 9, S4_TOP_CHECK_AVG: 38.60, S4_BOTTOM_CHECK_AVG: 21.40,
        S4_PERFORMANCE_SPREAD: 17.20, S4_APP_ATTACH_RATE: 19, S4_DESSERT_ATTACH_RATE: 6,
        S4_PRESHIFT_BRIEFING: 'Not held', S4_MONTHLY_GAP: 3960,
        S4_NARRATIVE: 'The spread between the top and bottom server check average is $17.20. That is a coaching gap, not a talent gap.',
        S4_FINDING: 'Appetizer attach sits at 19% and dessert at 6%. With no pre-shift briefing, the bottom third is never coached. Lifting them to the team average is worth $3,960/month.',
        S4_TOOL: 'Start a daily pre-shift briefing using the Pre-Shift Upsell Briefing sheet.',
        S5_SCORE: 18, S5_EVENT_REV_PERIOD: 2400, S5_EVENTS_PER_MONTH: 1, S5_AVG_EVENT_REVENUE: 2400,
        S5_MINIMUM_MET: false, S5_CATERING_REV_PERIOD: 0, S5_ANNUAL_EVENT_GAP: 64800, S5_MONTHLY_GAP: 5400,
        S5_NARRATIVE: 'Events brought in $2,400 from a single booking. There is no private dining minimum and no catering revenue at all.',
        S5_FINDING: 'For a venue this size, three to four events a month is realistic. The unbuilt event channel is the largest single opportunity in this audit at $5,400/month.',
        S5_TOOL: 'Build a private dining package with a spend minimum and a rate card.',
        S6_SIG1_SCORE: 'HIGH', S6_SIG1_LABEL: 'Server comp concentration',
        S6_SIG1_EVIDENCE: 'One server accounts for 54% of comped checks over the audit period.',
        S6_SIG1_GAP: 'Pattern is consistent with discount abuse, not service recovery.',
        S6_SIG1_TOOL: 'Pull the comp report by employee and require manager approval on comps over $10.',
        S6_SIG2_SCORE: 'HIGH', S6_SIG2_LABEL: 'Saturday floor overstaffed',
        S6_SIG2_EVIDENCE: 'Saturday floor RPLH ran $48 against a $75 target while weeknight RPLH hit $72.',
        S6_SIG2_GAP: 'About $720 per Saturday in excess labor.',
        S6_SIG2_TOOL: 'Drop one server from the Saturday floor for two weeks and measure check times.',
        S6_SIG3_SCORE: 'MEDIUM', S6_SIG3_LABEL: 'One menu item drives complaints',
        S6_SIG3_EVIDENCE: 'House Burger appears in 41% of negative comments and 18% of comps.',
        S6_SIG3_GAP: 'Build, portion, or price is off.',
        S6_SIG3_TOOL: 'Spec-check the burger every shift for a week and review the build.',
        S6_SIG4_SCORE: 'MEDIUM', S6_SIG4_LABEL: 'No pre-shift briefings',
        S6_SIG4_EVIDENCE: 'No briefings logged in the audit period.',
        S6_SIG4_GAP: 'Bottom-third servers get no daily coaching, which is where check average leaks.',
        S6_SIG4_TOOL: 'Run a 5-minute pre-shift on every dinner shift, even when short-staffed.'
      }}),
      mkAudit('revenue', { date: dateStr(42), generated_at: daysAgoISO(42), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 42,
        DATA_TIER_LABEL: 'Tier 2 Analysis, Standard Data Submitted',
        AUDIT_PERIOD: 'March 2026, 4 weeks ending Mar 27', AUDIT_ID: 'RVA-2026-0019',
        INDUSTRY_AVG: 61, TARGET_SCORE: 65,
        S1_SCORE: 40, S1_CHECK_AVG: 30.20, S1_CHECK_AVG_TARGET: 32.00, S1_BAR_CHECK_AVG: 24.60,
        S1_FOOD_CHECK_AVG: 36.10, S1_COVER_COUNT: 2960, S1_MONTHLY_REVENUE: 84300,
        S1_MONTHLY_GAP: 3256, S1_ANNUAL_GAP: 39072,
        S1_NARRATIVE: 'Check average climbed to $30.20 after upsell scripts went live. Bar checks improved most, up $2.50.',
        S1_FINDING: 'The blend is now $1.80 short of target. Add-on prompts are landing but dessert and after-dinner drinks are still rarely offered.',
        S1_TOOL: 'Add a dessert and digestif prompt to the close-out step of the server script.',
        S2_SCORE: 44, S2_LABOR_PCT: 34.0, S2_LABOR_TARGET_PCT: 30, S2_RPLH: 66, S2_RPLH_TARGET: 75,
        S2_LABOR_PERIOD: 28662, S2_SCHED_VS_ACTUAL: '221 scheduled / 233 actual hrs', S2_OVERTIME_HRS: 18,
        S2_MONTHLY_GAP: 3372,
        S2_NARRATIVE: 'Labor came down to 34.0% as scheduling tightened. Overtime more than halved, from 41 hours to 18.',
        S2_FINDING: 'RPLH improved to $66. The remaining gap is slow-shift overstaffing on weeknights.',
        S2_TOOL: 'Trim one floor position on Monday through Wednesday and cross-train the bar.',
        S3_SCORE: 43, S3_STARS_COUNT: 5, S3_PLOWHORSES_COUNT: 8, S3_DOGS_COUNT: 4, S3_PUZZLES_COUNT: 6,
        S3_TOP_CATEGORY: 'Craft Cocktails', S3_MONTHLY_GAP: 1080, S3_PRICING_OPPORTUNITY: 1880,
        S3_NARRATIVE: 'Three Dogs were cut and two repriced; Stars rose from three to five. Craft cocktails are now the top revenue category.',
        S3_FINDING: 'Four Dogs remain. Continuing to convert Plowhorses into Stars is a $1,080/month opportunity.',
        S3_TOOL: 'Reprint the menu to give the five Stars premium placement.',
        S4_SCORE: 42, S4_SERVER_COUNT: 9, S4_TOP_CHECK_AVG: 39.80, S4_BOTTOM_CHECK_AVG: 26.10,
        S4_PERFORMANCE_SPREAD: 13.70, S4_APP_ATTACH_RATE: 28, S4_DESSERT_ATTACH_RATE: 11,
        S4_PRESHIFT_BRIEFING: 'Held 3 nights a week', S4_MONTHLY_GAP: 2480,
        S4_NARRATIVE: 'The server spread narrowed to $13.70 as pre-shift briefings began. Appetizer attach improved nine points.',
        S4_FINDING: 'Briefings only run three nights a week, so the weekend crew misses coaching. Dessert attach is still low at 11%.',
        S4_TOOL: 'Extend the pre-shift briefing to all seven shifts.',
        S5_SCORE: 38, S5_EVENT_REV_PERIOD: 6800, S5_EVENTS_PER_MONTH: 3, S5_AVG_EVENT_REVENUE: 2267,
        S5_MINIMUM_MET: true, S5_CATERING_REV_PERIOD: 1500, S5_ANNUAL_EVENT_GAP: 38400, S5_MONTHLY_GAP: 3200,
        S5_NARRATIVE: 'Events grew to three bookings and $6,800, and a private dining minimum is now enforced.',
        S5_FINDING: 'Catering opened with $1,500. The channel is working but is still well below the venue’s realistic ceiling.',
        S5_TOOL: 'List the private dining package on the website and the Google Business Profile.',
        S6_SIG1_SCORE: 'MEDIUM', S6_SIG1_LABEL: 'Weekend pre-shift gap',
        S6_SIG1_EVIDENCE: 'Briefings now run 3 of 7 nights, weekends still missed.',
        S6_SIG1_GAP: 'Weekend covers are the highest-revenue shifts and get no coaching.',
        S6_SIG1_TOOL: 'Extend the briefing to Friday and Saturday close-out crews.',
        S6_SIG2_SCORE: 'MEDIUM', S6_SIG2_LABEL: 'Weeknight floor still loose',
        S6_SIG2_EVIDENCE: 'Tuesday and Wednesday floor RPLH still under $60.',
        S6_SIG2_GAP: 'Cross-training to cover the bar would tighten this.',
        S6_SIG2_TOOL: 'Cross-train two servers to barback on slow nights.',
        S6_SIG3_SCORE: 'LOW', S6_SIG3_LABEL: 'Bottom server gap closing',
        S6_SIG3_EVIDENCE: 'Bottom-third check average up $4.70, spread now $13.70.',
        S6_SIG3_GAP: 'On track. Spread under $10 is the target.',
        S6_SIG3_TOOL: 'Keep the daily briefings going and add a monthly server-by-server review.'
      }}),
      mkAudit('revenue', { date: dateStr(8), generated_at: daysAgoISO(8), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 60,
        DATA_TIER_LABEL: 'Tier 3 Analysis, Full Data Submitted',
        AUDIT_PERIOD: 'April 2026, 4 weeks ending Apr 24', AUDIT_ID: 'RVA-2026-0024',
        INDUSTRY_AVG: 61, TARGET_SCORE: 65,
        S1_SCORE: 61, S1_CHECK_AVG: 33.10, S1_CHECK_AVG_TARGET: 32.00, S1_BAR_CHECK_AVG: 27.40,
        S1_FOOD_CHECK_AVG: 38.90, S1_COVER_COUNT: 3010, S1_MONTHLY_REVENUE: 86700,
        S1_MONTHLY_GAP: 0, S1_ANNUAL_GAP: 0,
        S1_NARRATIVE: 'Blended check average reached $33.10, clearing the $32.00 target for the first time in the series.',
        S1_FINDING: 'Bar checks are up $5.30 from the February baseline. The upsell program is now self-sustaining.',
        S1_TOOL: 'Hold the standard; raise the internal target to $35 for the next quarter.',
        S2_SCORE: 58, S2_LABOR_PCT: 31.5, S2_LABOR_TARGET_PCT: 30, S2_RPLH: 72, S2_RPLH_TARGET: 75,
        S2_LABOR_PERIOD: 27311, S2_SCHED_VS_ACTUAL: '228 scheduled / 231 actual hrs', S2_OVERTIME_HRS: 6,
        S2_MONTHLY_GAP: 1301,
        S2_NARRATIVE: 'Labor is 31.5%, within 1.5 points of target, and overtime is down to 6 hours.',
        S2_FINDING: 'RPLH of $72 is close to the $75 target. Schedule and actual hours are nearly aligned.',
        S2_TOOL: 'Fine-tune weekend bar coverage to close the last point and a half.',
        S3_SCORE: 60, S3_STARS_COUNT: 7, S3_PLOWHORSES_COUNT: 7, S3_DOGS_COUNT: 2, S3_PUZZLES_COUNT: 6,
        S3_TOP_CATEGORY: 'Craft Cocktails', S3_MONTHLY_GAP: 420, S3_PRICING_OPPORTUNITY: 980,
        S3_NARRATIVE: 'The menu now carries seven Stars and only two Dogs. Craft cocktails hold the top revenue spot.',
        S3_FINDING: 'Menu mix is healthy. The small remaining gap is routine quarterly pricing maintenance.',
        S3_TOOL: 'Schedule a quarterly Menu Engineering review to keep the mix tuned.',
        S4_SCORE: 59, S4_SERVER_COUNT: 10, S4_TOP_CHECK_AVG: 41.20, S4_BOTTOM_CHECK_AVG: 31.80,
        S4_PERFORMANCE_SPREAD: 9.40, S4_APP_ATTACH_RATE: 37, S4_DESSERT_ATTACH_RATE: 18,
        S4_PRESHIFT_BRIEFING: 'Held every shift', S4_MONTHLY_GAP: 1180,
        S4_NARRATIVE: 'The server spread tightened to $9.40 with briefings held every shift. Appetizer attach reached 37%.',
        S4_FINDING: 'The bottom server is now within $9.40 of the top. Dessert attach at 18% is the next coaching target.',
        S4_TOOL: 'Set a dessert-attach contest for the next month to push past 25%.',
        S5_SCORE: 55, S5_EVENT_REV_PERIOD: 11200, S5_EVENTS_PER_MONTH: 5, S5_AVG_EVENT_REVENUE: 2240,
        S5_MINIMUM_MET: true, S5_CATERING_REV_PERIOD: 3400, S5_ANNUAL_EVENT_GAP: 18000, S5_MONTHLY_GAP: 1500,
        S5_NARRATIVE: 'Events reached five bookings and $11,200, with catering adding $3,400.',
        S5_FINDING: 'The event channel is now a real revenue line. The remaining gap is peak-season capacity, not demand.',
        S5_TOOL: 'Add a second private dining time slot on Fridays and Saturdays.',
        S6_SIG1_SCORE: 'LOW', S6_SIG1_LABEL: 'Server spread tightened',
        S6_SIG1_EVIDENCE: 'Top to bottom spread is $9.40, under the $10 benchmark.',
        S6_SIG1_GAP: 'No action required.',
        S6_SIG1_TOOL: 'Continue the daily pre-shift briefings.',
        S6_SIG2_SCORE: 'MEDIUM', S6_SIG2_LABEL: 'Dessert attach lagging',
        S6_SIG2_EVIDENCE: 'Dessert attach at 18% against a 25% target.',
        S6_SIG2_GAP: 'Smallest remaining lift in the upsell program.',
        S6_SIG2_TOOL: 'Run a one-month dessert-attach contest with a server prize.',
        S6_SIG3_SCORE: 'LOW', S6_SIG3_LABEL: 'Events at venue ceiling',
        S6_SIG3_EVIDENCE: 'Five events per month is near peak-season capacity.',
        S6_SIG3_GAP: 'Growing further requires a second Saturday slot or off-site catering.',
        S6_SIG3_TOOL: 'Add a Friday and Saturday early-dining slot and price it.'
      }})
    ];

    // ════════════════════════════════════════════════════════════════════
    //  REVENUE RECOVERY — the Anchor's revenue side, all traced to
    //  window.ANCHOR: twelve weekly records, the menu, server checks,
    //  events, dog tests and the price-change log.
    // ════════════════════════════════════════════════════════════════════
    App.data.revenue_settings = App.data.revenue_settings || {};
    App.data.revenue_settings.targets = { check_avg:35, bar_labor_pct:28, kitchen_labor_pct:30,
      floor_labor_pct:32, rplh_lunch:50, rplh_dinner:75, rplh_bar:65, event_close_rate:40 };
    App.data.revenue_settings.avg_hourly_wage = { bar:16, kitchen:15, floor:14 };
    App.data.revenue_settings._targets_saved = true;

    // Four servers carry the floor. Each week's covers split by these weights,
    // with the top server running a higher check average than the bottom.
    const rServers     = ['Jessica M.','Marcus T.','Brianna K.','Priya N.'];
    const rSrvWeight   = [0.30, 0.26, 0.24, 0.20];
    const rSrvCheckMul = [1.14, 1.04, 0.96, 0.86];

    App.data.revenue_weeks = window.ANCHOR.weeks.map(a => {
      const dep   = window.ANCHOR.laborDepts(a);
      const hours = a.bar_labor/16 + dep.kitchen/15 + dep.floor/14;
      const serverEntries = rServers.map((nm,i) => {
        const cv = Math.round(a.covers * rSrvWeight[i]);
        return { name:nm, covers:cv, sales:+(cv * a.check_avg * rSrvCheckMul[i]).toFixed(2) };
      });
      return {
        id:uid(), week_num:a.wk, period_end:dateStr((12 - a.wk) * 7),
        bar_revenue:a.bar_rev, floor_revenue:a.food_rev, covers:a.covers, check_avg:a.check_avg,
        total_labor_cost:a.bar_labor + a.food_labor, total_hours:+hours.toFixed(1),
        labor_pct_blended:a.labor_pct_blended, rplh_blended:+(a.total_rev / hours).toFixed(2),
        rplh_lunch:0, rplh_dinner:0, rplh_bar:0,
        server_entries:serverEntries, notes:'', saved_at:new Date().toISOString()
      };
    });

    // ── Menu — the Anchor's full card, costed for Menu Engineering ──
    const rMenu = [
      ['Loaded Nachos',     'Appetizers', 12, 3.60,  95],
      ['Smoked Wings',      'Appetizers', 13, 4.20, 110],
      ['Fried Pickles',     'Appetizers',  8, 1.80,  58],
      ['Pretzel Bites',     'Appetizers',  9, 2.10,  40],
      ['Anchor Burger',     'Entrees',    16, 4.80, 140],
      ['Brisket Sandwich',  'Entrees',    15, 5.20,  88],
      ['Fish and Chips',    'Entrees',    17, 5.60,  52],
      ['Chicken Caesar',    'Entrees',    14, 3.90,  70],
      ['Steak Frites',      'Entrees',    26, 9.10,  38],
      ['Veggie Grain Bowl', 'Entrees',    13, 3.20,  30],
      ['Old Fashioned',     'Cocktails',  12, 2.40, 130],
      ['House Margarita',   'Cocktails',  11, 2.10, 145],
      ['Espresso Martini',  'Cocktails',  13, 2.90,  78],
      ['Paloma',            'Cocktails',  11, 2.20,  62],
      ['Austin IPA Draft',  'Beer',        6, 1.30, 320],
      ['Modelo Especial',   'Beer',        5, 1.35, 180],
      ['Bud Light',         'Beer',        4, 1.10, 150],
      ['House Red Blend',   'Wine',        9, 2.20,  64],
      ['Sauvignon Blanc',   'Wine',        9, 2.30,  70],
      ['Skillet Cookie',    'Desserts',    8, 1.90,  48],
      ['Key Lime Pie',      'Desserts',    7, 1.70,  30],
    ].map(m => ({ id:uid(), name:m[0], category:m[1], price:m[2], cost:m[3], weekly_covers:m[4], notes:'' }));
    App.data.revenue_menu_items = rMenu;
    const rItem = nm => rMenu.find(x => x.name === nm);

    // ── Price-change log ──
    const rPrice = (nm, oldP, newP, daysBack, reason, volPct) => {
      const it = rItem(nm);
      return { id:uid(), date:dateStr(daysBack), item_id:it.id, item_name:it.name,
        old_price:oldP, new_price:newP, cost:it.cost, reason:reason,
        margin_impact:+(newP - oldP).toFixed(2), covers_at_change:it.weekly_covers,
        predicted_vol_pct:volPct,
        predicted_weekly_impact:+((newP - oldP) * it.weekly_covers * (1 + volPct/100)).toFixed(2),
        saved_at:daysAgoISO(daysBack) };
    };
    App.data.revenue_price_log = [
      rPrice('Anchor Burger', 15.00, 16.00, 40, 'Beef cost rose on the Sysco invoice.', -4),
      rPrice('Old Fashioned', 11.00, 12.00, 26, 'Brought well bourbon pricing in line with the call list.', -2),
      rPrice('Fish and Chips', 16.00, 17.00, 12, 'Cod cost up; repriced to hold the plate margin.', -5),
    ];

    // ── Dog tests ──
    App.data.menu_dog_tests = [
      { id:uid(), item_name:'Veggie Grain Bowl', start_date:dateStr(40), baseline_volume:28,
        change_notes:'Rewrote the menu description and moved it up under Entrees.',
        current_volume:41, status:'Kept', decided_at:daysAgoISO(12) },
      { id:uid(), item_name:'Key Lime Pie', start_date:dateStr(34), baseline_volume:30,
        change_notes:'Added a dessert mention to the server close-out script.',
        current_volume:33, status:'Testing', decided_at:null },
      { id:uid(), item_name:'Pretzel Bites', start_date:dateStr(78), baseline_volume:38,
        change_notes:'Ran it as a featured app for two weeks to see if volume held.',
        current_volume:19, status:'Removed', decided_at:daysAgoISO(58) },
    ];

    // ── Server checks — standalone per-server log ──
    const rSC = [];
    [7, 9, 12, 14, 16, 19, 21].forEach((d, i) => {
      rServers.forEach((nm, j) => {
        const cv = 18 + Math.round(Math.random() * 14);
        rSC.push({ id:uid(), date:dateStr(d), shift:['Dinner','Lunch','Bar'][i % 3],
          server_name:nm, covers:cv,
          sales:+(cv * (31 + j * 1.5 + Math.random() * 7)).toFixed(2),
          saved_at:daysAgoISO(d) });
      });
    });
    App.data.revenue_server_checks = rSC;

    // ── Events and catering pipeline ──
    App.data.revenue_events = [
      { id:uid(), event_name:'Reyes Rehearsal Dinner', event_type:'Private Dining', status:'Completed',
        date:dateStr(38), covers:34, fb_minimum:2200, actual_revenue:2840, estimated_revenue:2500,
        notes:'', saved_at:daysAgoISO(40) },
      { id:uid(), event_name:'Downtown Tech Mixer', event_type:'Corporate', status:'Completed',
        date:dateStr(17), covers:60, fb_minimum:3000, actual_revenue:3620, estimated_revenue:3400,
        notes:'', saved_at:daysAgoISO(19) },
      { id:uid(), event_name:'Hargrove 40th Birthday', event_type:'Social', status:'Confirmed',
        date:dateStr(-9), covers:28, fb_minimum:1800, actual_revenue:0, estimated_revenue:2100,
        notes:'', saved_at:daysAgoISO(6) },
      { id:uid(), event_name:'Keller Group Saturday Buyout', event_type:'Buyout', status:'Proposal Sent',
        date:dateStr(-21), covers:90, fb_minimum:6000, actual_revenue:0, estimated_revenue:6800,
        notes:'', saved_at:daysAgoISO(3) },
      { id:uid(), event_name:'Westlake Realty Lunch Catering', event_type:'Catering', status:'Inquiry',
        date:dateStr(-32), covers:45, fb_minimum:0, actual_revenue:0, estimated_revenue:1500,
        notes:'', saved_at:daysAgoISO(1) },
    ];

    // ════════════════════════════════════════════════════════════════════
    //  TRAFFIC RECOVERY — the Anchor's digital presence over 12 weeks plus
    //  a three-audit recovery arc and a complete scorecard profile.
    // ════════════════════════════════════════════════════════════════════
    App.data.traffic_settings = App.data.traffic_settings || {};
    App.data.traffic_settings.targets = { google_rating:4.3, review_velocity:8,
      response_rate:75, monthly_sessions:2000, social_posts_month:12 };
    App.data.traffic_settings._targets_saved = true;
    App.data.traffic_settings.profile = {
      // GBP scorecard
      gbp_claimed:true, gbp_hours:true, gbp_phone:true, gbp_website:true,
      gbp_menu:true, gbp_category:true, gbp_attributes:true, gbp_qa:false,
      gbp_photos:138, gbp_posts:10, gbp_reviewed_at:daysAgoISO(4),
      // Review tracker
      rev_age:4, rev_patterns:'No recurring complaint pattern in the last 30 days. Earlier weekend-service mentions have dropped off.',
      rev_reviewed_at:daysAgoISO(3),
      // Search and SEO
      search_maps_pack:true, search_nap:true, search_name:true, search_address:true,
      search_phone:true, search_titles:true, search_keyword:'austin sports bar',
      search_citations:42, search_reviewed_at:daysAgoISO(6),
      // Website scorecard
      web_exists:true, web_mobile:true, web_menu:true, web_online_order:true, web_reservations:true,
      web_avg_duration:96, web_top_source:'Organic Search', web_reviewed_at:daysAgoISO(7),
      // Social
      social_stories:true, social_reels:true, social_ig_engagement:2.4, social_fb_posts:6,
      social_content_mix:'Balanced', social_reviewed_at:daysAgoISO(5),
      // Delivery
      dd_photos:26, dd_menu:true, dd_promo:true,
      ue_photos:22, ue_menu:true, ue_promo:false,
      gh_photos:null, gh_menu:false, gh_promo:false,
      delivery_reviewed_at:daysAgoISO(8),
      // Email and loyalty
      email_last_send:dateStr(5), email_frequency:'Weekly', email_growth:'WiFi login capture',
      email_reviewed_at:daysAgoISO(5)
    };

    // ── Traffic weeks — recovery arc, oldest to newest ──
    const tw = {
      google_rating:    [3.9,3.9,4.0,4.0,4.1,4.1,4.2,4.3,4.3,4.4,4.5,4.5],
      google_total:     [240,246,253,261,268,275,284,293,302,310,318,326],
      new_reviews:      [3,4,4,5,5,6,8,9,9,10,11,11],
      response_rate:    [38,42,48,54,60,68,74,78,82,84,86,88],
      yelp_rating:      [3.7,3.7,3.8,3.8,3.8,3.9,3.9,4.0,4.0,4.0,4.1,4.1],
      yelp_total:       [80,81,83,84,86,88,90,92,95,98,101,104],
      monthly_sessions: [1180,1240,1300,1380,1480,1620,1780,1940,2080,2200,2320,2420],
      bounce_rate:      [74,73,72,70,68,66,64,62,60,58,57,56],
      ig_followers:     [1880,1920,1965,2010,2060,2120,2200,2280,2360,2440,2520,2600],
      ig_posts_month:   [5,6,6,7,8,9,10,11,12,13,14,14],
      fb_followers:     [1050,1060,1075,1085,1100,1115,1135,1155,1175,1195,1215,1240],
      dd_rating:        [4.2,4.2,4.3,4.3,4.3,4.4,4.4,4.5,4.5,4.5,4.6,4.6],
      ue_rating:        [4.0,4.0,4.1,4.1,4.1,4.2,4.2,4.3,4.3,4.3,4.4,4.4],
      email_list_size:  [380,410,445,480,520,560,605,650,690,720,745,760],
      emails_sent:      [1,1,2,2,2,3,3,3,4,4,4,4],
      email_open_rate:  [18,19,20,21,22,24,25,26,27,27,28,28],
      loyalty_members:  [0,0,0,0,0,0,60,140,220,300,370,420],
    };
    App.data.traffic_weeks = window.ANCHOR.weeks.map((a, i) => ({
      id: Date.now() + i, week_num: a.wk, period_end: dateStr((12 - a.wk) * 7),
      saved_at: new Date().toISOString(),
      google_rating: tw.google_rating[i], google_total: tw.google_total[i],
      new_reviews: tw.new_reviews[i], response_rate: tw.response_rate[i],
      yelp_rating: tw.yelp_rating[i], yelp_total: tw.yelp_total[i],
      monthly_sessions: tw.monthly_sessions[i], bounce_rate: tw.bounce_rate[i],
      ig_followers: tw.ig_followers[i], ig_posts_month: tw.ig_posts_month[i],
      fb_followers: tw.fb_followers[i],
      dd_active: 'yes', dd_rating: tw.dd_rating[i],
      ue_active: 'yes', ue_rating: tw.ue_rating[i],
      gh_active: 'no',  gh_rating: null,
      email_list_size: tw.email_list_size[i], emails_sent: tw.emails_sent[i],
      email_open_rate: tw.email_open_rate[i],
      loyalty_active: i >= 6 ? 'yes' : 'no', loyalty_members: tw.loyalty_members[i],
      notes: ''
    }));

    // ── Traffic audits — three-audit recovery arc, Feb / Mar / Apr ──
    const mkTrafficAudit = (date, generated_at, audit_id, period, score, tier, raw) => {
      const sections = {
        'Google Business Profile': raw.S1_SCORE, 'Website': raw.S2_SCORE,
        'Reviews': raw.S3_SCORE, 'Search and SEO': raw.S4_SCORE,
        'Social Media': raw.S5_SCORE, 'Delivery Platforms': raw.S6_SCORE,
        'Email and Loyalty': raw.S7_SCORE
      };
      const items = [];
      const push = (gap, label) => { if (gap > 0) items.push({ action:label + ' $' + Math.round(gap) + '/month opportunity.', monthly_impact:gap }); };
      push(raw.S1_MONTHLY_GAP, 'Complete the Google Business Profile setup.');
      push(raw.S2_MONTHLY_GAP, 'Lift website conversion and reduce bounce.');
      push(raw.S3_MONTHLY_GAP, 'Close the review velocity and response gap.');
      push(raw.S5_MONTHLY_GAP, 'Tighten posting schedule and content mix.');
      push(raw.S6_MONTHLY_GAP, 'Tighten delivery platform listings.');
      push(raw.S7_MONTHLY_GAP, 'Activate the email list and loyalty program.');
      items.sort((a, b) => (b.monthly_impact||0) - (a.monthly_impact||0));
      const totalMo = items.reduce((s, it) => s + (it.monthly_impact||0), 0);
      raw.OVERALL_SCORE = score;
      raw.BAR_NAME = 'The Anchor Bar & Kitchen';
      raw.AUDIT_ID = audit_id;
      raw.AUDIT_PERIOD = period;
      raw.DATA_TIER_LABEL = tier;
      raw.INDUSTRY_AVG = 58;
      raw.TARGET_SCORE = 65;
      raw.WEEKLY_GAP_AMT = '$' + Math.round(totalMo/4.345).toLocaleString('en-US');
      return { date:date, bar_name:raw.BAR_NAME, overall_score:score,
        audit_id:audit_id, audit_period:period, grade:tier,
        sections:sections, action_items:items, raw:raw, generated_at:generated_at };
    };

    App.data.traffic_audits = [
      mkTrafficAudit(dateStr(74), daysAgoISO(74), 'TFA-2026-0008',
        'February 2026, 4 weeks ending Feb 27', 31,
        'Tier 2 Analysis, Standard Data Submitted', {
        S1_SCORE:28, S1_LISTING_CLAIMED:'Yes', S1_HOURS_COMPLETE:'Partial',
        S1_WEBSITE_LINKED:'Yes', S1_MENU_LINK_ACTIVE:'No', S1_PHOTO_COUNT:41,
        S1_PHOTO_BENCHMARK:100, S1_POSTS_LAST_30_DAYS:2, S1_POSTS_BENCHMARK:8,
        S1_PROFILE_COMPLETENESS_PCT:52, S1_MONTHLY_GAP:480,
        S1_NARRATIVE:'The Google Business Profile is claimed but only half complete. Two posts in 30 days against an 8-post benchmark.',
        S1_FINDING:'Photos are well below 100, the menu link is missing, and posts barely run. Listings this thin lose discovery clicks to nearby competitors.',
        S1_TOOL:'Add the menu link, post weekly offers, and load 60 more photos this month.',
        S2_SCORE:30, S2_MOBILE_OPTIMIZED:'No', S2_MONTHLY_SESSIONS:1180,
        S2_SESSIONS_BENCHMARK:2000, S2_BOUNCE_RATE:74, S2_BOUNCE_BENCHMARK:55,
        S2_MENU_PAGE_IN_TOP_3:'No', S2_ONLINE_ORDERING_PRESENT:'No', S2_MONTHLY_GAP:720,
        S2_NARRATIVE:'Site traffic of 1,180 monthly sessions is roughly 40% below benchmark, and the homepage is not mobile-optimized.',
        S2_FINDING:'A 74% bounce rate means visitors leave from the homepage. No online ordering means delivery traffic flows entirely to third-party platforms.',
        S2_TOOL:'Rebuild the homepage above-the-fold for mobile and add a menu page that loads fast.',
        S3_SCORE:22, S3_GOOGLE_RATING:3.9, S3_GOOGLE_RATING_BENCHMARK:4.3,
        S3_GOOGLE_REVIEW_COUNT:240, S3_RESPONSE_RATE:38, S3_RESPONSE_BENCHMARK:75,
        S3_MOST_RECENT_REVIEW_DAYS:19, S3_YELP_RATING:3.7,
        S3_UNANSWERED:148, S3_NEGATIVE_PATTERN:'Slow weekend service mentioned in 4 of the last 10 reviews.',
        S3_MONTHLY_GAP:1280,
        S3_NARRATIVE:'Google rating is 3.9 against a 4.3 benchmark, and the response rate is just 38%.',
        S3_FINDING:'148 reviews sit unanswered. A pattern of slow weekend service appears in recent reviews and is now visible to every searching guest.',
        S3_TOOL:'Respond to every unanswered review this week and address the weekend pacing issue on the floor.',
        S4_SCORE:32, S4_MAPS_PACK_CONFIRMED:'No', S4_NAP_CONSISTENT:'No',
        S4_NAP_BUSINESS_NAME:'Inconsistent across Yelp and Apple Maps',
        S4_PRIMARY_KEYWORD:'austin sports bar',
        S4_NARRATIVE:'The business does not appear in the Google Maps pack for its primary keyword.',
        S4_FINDING:'Name, address and phone vary across Yelp, Apple Maps and the website footer. Inconsistent NAP signals depress local ranking.',
        S4_TOOL:'Pick the canonical NAP and fix every directory listing to match it exactly.',
        S5_SCORE:35, S5_IG_FOLLOWERS:1880, S5_IG_POSTS_LAST_30:5, S5_IG_POSTS_BENCHMARK:12,
        S5_FB_FOLLOWERS:1050, S5_CONTENT_TYPE:'Mostly promotional', S5_MONTHLY_GAP:380,
        S5_NARRATIVE:'Instagram posting runs 5 per 30 days against a 12 benchmark.',
        S5_FINDING:'Content is mostly promotional graphics. Food and people content drives the engagement that grows followers.',
        S5_TOOL:'Move to a balanced mix of food, people and the room. Post three times a week.',
        S6_SCORE:38, S6_DOORDASH_ACTIVE:'Yes', S6_UBEREATS_ACTIVE:'Yes', S6_GRUBHUB_ACTIVE:'No',
        S6_DOORDASH_RATING:4.2, S6_UBEREATS_RATING:4.0,
        S6_PHOTO_COUNT_DELIVERY:11, S6_MENU_COMPLETE:'Partial', S6_PROMO_ACTIVE:'No',
        S6_MONTHLY_GAP:540,
        S6_NARRATIVE:'Both delivery platforms are live but ratings sit below the 4.5 benchmark and photos are sparse.',
        S6_FINDING:'No promo is active on either platform, so listings sit low in the feed against competitors running offers.',
        S6_TOOL:'Add 15 more food photos per platform and run a first-order promo on DoorDash.',
        S7_SCORE:30, S7_EMAIL_LIST_EXISTS:'Yes', S7_LIST_SIZE:380, S7_LIST_BENCHMARK:500,
        S7_LAST_SEND_DAYS_AGO:42, S7_SEND_FREQUENCY:'Rarely', S7_OPEN_RATE:18, S7_OPEN_BENCHMARK:20,
        S7_GROWTH_MECHANISM:'No active mechanism', S7_LOYALTY_PROGRAM:'None', S7_MONTHLY_GAP:420,
        S7_NARRATIVE:'A 380-contact list has not been emailed in over six weeks. No loyalty program is in place.',
        S7_FINDING:'The list is going cold, opens are below benchmark, and there is no way for new guests to opt in.',
        S7_TOOL:'Send a monthly email starting this week and add a WiFi sign-up capture.',
        S8_SIG1_SCORE:'HIGH', S8_SIG1_LABEL:'Review velocity dead',
        S8_SIG1_EVIDENCE:'Most recent review is 19 days old.',
        S8_SIG1_GAP:'Listings without recent reviews lose discovery weight quickly.',
        S8_SIG1_TOOL:'Drop QR table cards asking for a Google review at every check.',
        S8_SIG2_SCORE:'HIGH', S8_SIG2_LABEL:'Unanswered reviews piling up',
        S8_SIG2_EVIDENCE:'148 Google reviews sit with no response.',
        S8_SIG2_GAP:'Response rate is a direct local-ranking signal and a trust signal to searching guests.',
        S8_SIG2_TOOL:'Clear the backlog this week, then 10 minutes a day to stay current.',
        S8_SIG3_SCORE:'MEDIUM', S8_SIG3_LABEL:'Email list going cold',
        S8_SIG3_EVIDENCE:'Last email send was 42 days ago.',
        S8_SIG3_GAP:'Open rates fall fast after 30 days dark, assets are bleeding.',
        S8_SIG3_TOOL:'Send a monthly email this week, even a simple one.',
        S8_SIG4_SCORE:'MEDIUM', S8_SIG4_LABEL:'No delivery promos',
        S8_SIG4_EVIDENCE:'No promo active on DoorDash or UberEats.',
        S8_SIG4_GAP:'Listings without promos sit lower in the feed against competitors who run them.',
        S8_SIG4_TOOL:'Launch a first-order promo on DoorDash this week.'
      }),
      mkTrafficAudit(dateStr(42), daysAgoISO(42), 'TFA-2026-0012',
        'March 2026, 4 weeks ending Mar 27', 48,
        'Tier 2 Analysis, Standard Data Submitted', {
        S1_SCORE:48, S1_LISTING_CLAIMED:'Yes', S1_HOURS_COMPLETE:'Yes',
        S1_WEBSITE_LINKED:'Yes', S1_MENU_LINK_ACTIVE:'Yes', S1_PHOTO_COUNT:84,
        S1_PHOTO_BENCHMARK:100, S1_POSTS_LAST_30_DAYS:6, S1_POSTS_BENCHMARK:8,
        S1_PROFILE_COMPLETENESS_PCT:80, S1_MONTHLY_GAP:280,
        S1_NARRATIVE:'GBP is now 80% complete with the menu link live and weekly posts running.',
        S1_FINDING:'Photo count has doubled to 84 and weekly posts are landing. Two more posts a month and 16 more photos close the gap to benchmark.',
        S1_TOOL:'Add two posts a week and finish loading the food photo library.',
        S2_SCORE:46, S2_MOBILE_OPTIMIZED:'Yes', S2_MONTHLY_SESSIONS:1620,
        S2_SESSIONS_BENCHMARK:2000, S2_BOUNCE_RATE:66, S2_BOUNCE_BENCHMARK:55,
        S2_MENU_PAGE_IN_TOP_3:'Yes', S2_ONLINE_ORDERING_PRESENT:'Yes', S2_MONTHLY_GAP:380,
        S2_NARRATIVE:'Mobile rebuild lifted sessions to 1,620 and bounce rate dropped to 66%.',
        S2_FINDING:'Online ordering is now live and the menu page is in the top three viewed. Sessions and bounce still trail benchmark, but the trend is solid.',
        S2_TOOL:'Add a reservations link in the header and run a quick Lighthouse pass on page speed.',
        S3_SCORE:44, S3_GOOGLE_RATING:4.1, S3_GOOGLE_RATING_BENCHMARK:4.3,
        S3_GOOGLE_REVIEW_COUNT:275, S3_RESPONSE_RATE:68, S3_RESPONSE_BENCHMARK:75,
        S3_MOST_RECENT_REVIEW_DAYS:8, S3_YELP_RATING:3.9,
        S3_UNANSWERED:88, S3_NEGATIVE_PATTERN:'Weekend service mentions have dropped.',
        S3_MONTHLY_GAP:640,
        S3_NARRATIVE:'Google rating climbed to 4.1 and response rate is up to 68% as the reply routine took hold.',
        S3_FINDING:'88 reviews remain unanswered. Hitting the 75% response benchmark closes the rest of this gap.',
        S3_TOOL:'Clear the unanswered backlog and set a daily 10-minute response slot.',
        S4_SCORE:50, S4_MAPS_PACK_CONFIRMED:'Sometimes', S4_NAP_CONSISTENT:'Yes',
        S4_NAP_BUSINESS_NAME:'Consistent', S4_PRIMARY_KEYWORD:'austin sports bar',
        S4_NARRATIVE:'NAP is now consistent across the major directories.',
        S4_FINDING:'The business appears in the Maps pack on most keyword variations. Citation count is climbing.',
        S4_TOOL:'Add the bar to ten more local-bar directories.',
        S5_SCORE:52, S5_IG_FOLLOWERS:2120, S5_IG_POSTS_LAST_30:9, S5_IG_POSTS_BENCHMARK:12,
        S5_FB_FOLLOWERS:1115, S5_CONTENT_TYPE:'Balanced', S5_MONTHLY_GAP:200,
        S5_NARRATIVE:'Posting is up to 9 per 30 days and content shifted to a balanced mix.',
        S5_FINDING:'Follower growth followed the schedule change. Three more posts per month hits the benchmark.',
        S5_TOOL:'Set a Tuesday and Friday content slot and stick to it.',
        S6_SCORE:54, S6_DOORDASH_ACTIVE:'Yes', S6_UBEREATS_ACTIVE:'Yes', S6_GRUBHUB_ACTIVE:'No',
        S6_DOORDASH_RATING:4.4, S6_UBEREATS_RATING:4.2,
        S6_PHOTO_COUNT_DELIVERY:18, S6_MENU_COMPLETE:'Yes', S6_PROMO_ACTIVE:'DoorDash',
        S6_MONTHLY_GAP:280,
        S6_NARRATIVE:'DoorDash promo is live and ratings are up. UberEats lags by two-tenths.',
        S6_FINDING:'More photos and a UberEats promo would close the remaining gap.',
        S6_TOOL:'Mirror the DoorDash promo on UberEats and add 8 more food photos to each.',
        S7_SCORE:46, S7_EMAIL_LIST_EXISTS:'Yes', S7_LIST_SIZE:560, S7_LIST_BENCHMARK:500,
        S7_LAST_SEND_DAYS_AGO:9, S7_SEND_FREQUENCY:'Monthly', S7_OPEN_RATE:24, S7_OPEN_BENCHMARK:20,
        S7_GROWTH_MECHANISM:'WiFi login capture', S7_LOYALTY_PROGRAM:'Started', S7_MONTHLY_GAP:220,
        S7_NARRATIVE:'List grew past 500 and a loyalty program launched. Open rate of 24% beats the 20% benchmark.',
        S7_FINDING:'Sending monthly works. Moving to weekly during event months grows revenue per send.',
        S7_TOOL:'Add a weekly Thursday email during event-heavy weeks.',
        S8_SIG1_SCORE:'MEDIUM', S8_SIG1_LABEL:'Posting schedule inconsistent',
        S8_SIG1_EVIDENCE:'IG posts at 9 per 30 days, but clustered in two bursts.',
        S8_SIG1_GAP:'Algorithms reward regular posting more than total volume.',
        S8_SIG1_TOOL:'Lock a Tuesday and Friday content slot.',
        S8_SIG2_SCORE:'MEDIUM', S8_SIG2_LABEL:'UberEats trails DoorDash',
        S8_SIG2_EVIDENCE:'UberEats rating 4.2 vs DoorDash 4.4.',
        S8_SIG2_GAP:'Lower rating means lower feed placement and fewer orders.',
        S8_SIG2_TOOL:'Mirror the DoorDash photo and promo plan on UberEats.',
        S8_SIG3_SCORE:'LOW', S8_SIG3_LABEL:'Loyalty slow start',
        S8_SIG3_EVIDENCE:'60 members in the first month.',
        S8_SIG3_GAP:'Sign-up conversion needs a small incentive to accelerate.',
        S8_SIG3_TOOL:'Offer a free appetizer for the first 100 sign-ups.'
      }),
      mkTrafficAudit(dateStr(8), daysAgoISO(8), 'TFA-2026-0017',
        'April 2026, 4 weeks ending Apr 24', 64,
        'Tier 3 Analysis, Full Data Submitted', {
        S1_SCORE:66, S1_LISTING_CLAIMED:'Yes', S1_HOURS_COMPLETE:'Yes',
        S1_WEBSITE_LINKED:'Yes', S1_MENU_LINK_ACTIVE:'Yes', S1_PHOTO_COUNT:138,
        S1_PHOTO_BENCHMARK:100, S1_POSTS_LAST_30_DAYS:10, S1_POSTS_BENCHMARK:8,
        S1_PROFILE_COMPLETENESS_PCT:95, S1_MONTHLY_GAP:0,
        S1_NARRATIVE:'GBP is at 95% complete with 138 photos and 10 posts in the last 30 days, both above benchmark.',
        S1_FINDING:'Only the Q and A section remains thin. The profile is now a strong discovery asset.',
        S1_TOOL:'Seed the Q and A with the 8 questions guests ask most.',
        S2_SCORE:60, S2_MOBILE_OPTIMIZED:'Yes', S2_MONTHLY_SESSIONS:2420,
        S2_SESSIONS_BENCHMARK:2000, S2_BOUNCE_RATE:56, S2_BOUNCE_BENCHMARK:55,
        S2_MENU_PAGE_IN_TOP_3:'Yes', S2_ONLINE_ORDERING_PRESENT:'Yes', S2_MONTHLY_GAP:0,
        S2_NARRATIVE:'Sessions cleared 2,400 and bounce rate is within a point of benchmark.',
        S2_FINDING:'Online ordering and reservations are both live and visible above the fold on mobile.',
        S2_TOOL:'Add a quarterly content refresh to the events page.',
        S3_SCORE:64, S3_GOOGLE_RATING:4.5, S3_GOOGLE_RATING_BENCHMARK:4.3,
        S3_GOOGLE_REVIEW_COUNT:326, S3_RESPONSE_RATE:88, S3_RESPONSE_BENCHMARK:75,
        S3_MOST_RECENT_REVIEW_DAYS:4, S3_YELP_RATING:4.1,
        S3_UNANSWERED:39, S3_NEGATIVE_PATTERN:'No recurring theme in the last 30 days.',
        S3_MONTHLY_GAP:180,
        S3_NARRATIVE:'Google rating sits at 4.5 with 88% response rate, both ahead of benchmark.',
        S3_FINDING:'39 older reviews remain unanswered but no recurring complaint pattern surfaces in recent ones.',
        S3_TOOL:'Sweep the older unanswered reviews and keep the daily response slot.',
        S4_SCORE:66, S4_MAPS_PACK_CONFIRMED:'Yes', S4_NAP_CONSISTENT:'Yes',
        S4_NAP_BUSINESS_NAME:'Consistent', S4_PRIMARY_KEYWORD:'austin sports bar',
        S4_NARRATIVE:'The bar appears in the Maps pack for every tracked keyword.',
        S4_FINDING:'NAP and citation count are above the local benchmark. Search is performing.',
        S4_TOOL:'Audit citations quarterly and add new ones as new directories appear.',
        S5_SCORE:66, S5_IG_FOLLOWERS:2600, S5_IG_POSTS_LAST_30:14, S5_IG_POSTS_BENCHMARK:12,
        S5_FB_FOLLOWERS:1240, S5_CONTENT_TYPE:'Balanced', S5_MONTHLY_GAP:0,
        S5_NARRATIVE:'Follower growth has compounded. Posting frequency is above benchmark with a balanced mix.',
        S5_FINDING:'IG engagement rate is up to 2.4%. Reels are now in rotation.',
        S5_TOOL:'Add one staff-introduction post a month to deepen the human side.',
        S6_SCORE:68, S6_DOORDASH_ACTIVE:'Yes', S6_UBEREATS_ACTIVE:'Yes', S6_GRUBHUB_ACTIVE:'No',
        S6_DOORDASH_RATING:4.6, S6_UBEREATS_RATING:4.4,
        S6_PHOTO_COUNT_DELIVERY:48, S6_MENU_COMPLETE:'Yes', S6_PROMO_ACTIVE:'Both platforms',
        S6_MONTHLY_GAP:0,
        S6_NARRATIVE:'Both delivery platforms run promos and DoorDash hit the 4.6 benchmark.',
        S6_FINDING:'Photo and menu coverage are strong. Grubhub is still off, which is a deliberate choice given local mix.',
        S6_TOOL:'Add a third promo type, free-delivery threshold, on DoorDash next month.',
        S7_SCORE:62, S7_EMAIL_LIST_EXISTS:'Yes', S7_LIST_SIZE:760, S7_LIST_BENCHMARK:500,
        S7_LAST_SEND_DAYS_AGO:5, S7_SEND_FREQUENCY:'Weekly', S7_OPEN_RATE:28, S7_OPEN_BENCHMARK:20,
        S7_GROWTH_MECHANISM:'WiFi login capture', S7_LOYALTY_PROGRAM:'Active, 420 members',
        S7_MONTHLY_GAP:80,
        S7_NARRATIVE:'List grew to 760, weekly sends with 28% opens, and 420 loyalty members enrolled.',
        S7_FINDING:'The email channel is now a real revenue line. Loyalty redemption rate is the next thing to track.',
        S7_TOOL:'Add a redemption-rate report to the monthly review and run a member-only event quarterly.',
        S8_SIG1_SCORE:'LOW', S8_SIG1_LABEL:'Photo library steady',
        S8_SIG1_EVIDENCE:'138 photos current, with 54 added in the last 30 days.',
        S8_SIG1_GAP:'On track. Refresh photos seasonally.',
        S8_SIG1_TOOL:'Replace the menu cover shots quarterly with current plating.',
        S8_SIG2_SCORE:'LOW', S8_SIG2_LABEL:'Grubhub still inactive',
        S8_SIG2_EVIDENCE:'Grubhub listing remains off.',
        S8_SIG2_GAP:'Confirm this is intentional given local order mix.',
        S8_SIG2_TOOL:'Review Grubhub local order share annually before deciding.',
        S8_SIG3_SCORE:'LOW', S8_SIG3_LABEL:'Loyalty trajectory strong',
        S8_SIG3_EVIDENCE:'420 members in 90 days, redemption rate not yet measured.',
        S8_SIG3_GAP:'Redemption rate is the next leading indicator to watch.',
        S8_SIG3_TOOL:'Add a monthly redemption report and run a member-only event quarterly.'
      })
    ];

    // ════════════════════════════════════════════════════════════════════
    //  INVENTORY CONTROL — The Anchor's stockroom. The last two counts feed
    //  the Profit This Week COGS, so the Capture-to-Diagnose chain computes.
    // ════════════════════════════════════════════════════════════════════
    App.inventoryData = App.inventoryData || {};

    App.inventoryData.ic_vendors = [
      { id:uid(), name:'Republic National',   rep:'Dana Ortiz',  phone:'512-555-0142', email:'dortiz@rndc.example',   delivery_days:'Tue, Fri', payment_terms:'Net 30', account_number:'RNDC-4471',  notes:'', created_at:new Date().toISOString() },
      { id:uid(), name:"Glazer's Beer & Bev", rep:'Marcus Hill', phone:'512-555-0188', email:'mhill@glazers.example', delivery_days:'Wed',      payment_terms:'Net 15', account_number:'GLZ-2210',   notes:'', created_at:new Date().toISOString() },
      { id:uid(), name:'Austin Beerworks',    rep:'Priya Shah',  phone:'512-555-0119', email:'priya@abw.example',     delivery_days:'Thu',      payment_terms:'COD',    account_number:'ABW-0093',   notes:'Local draft', created_at:new Date().toISOString() },
      { id:uid(), name:'Sysco Foods',         rep:'Tom Becker',  phone:'512-555-0203', email:'tbecker@sysco.example', delivery_days:'Mon, Thu', payment_terms:'Net 30', account_number:'SYS-88120',  notes:'', created_at:new Date().toISOString() },
      { id:uid(), name:'Restaurant Depot',    rep:'Walk-in',     phone:'512-555-0250', email:'',                      delivery_days:'Pickup',   payment_terms:'COD',    account_number:'',           notes:'Supplies and paper', created_at:new Date().toISOString() },
    ];

    App.inventoryData.ic_locations = ['Main Bar','Back Bar','Liquor Room','Walk-in Cooler','Kitchen Line']
      .map(n => ({ id:uid(), name:n, archived:false }));

    // Categories must match Profit's BAR_CATS / KITCHEN_CATS for the COGS feed.
    const icProducts = [
      { name:"Tito's Handmade Vodka",    category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.5, unit_cost:22.40, menu_price:9,  par_level:24,  reorder_point:10,  primary_location:'Liquor Room' },
      { name:'Espolòn Tequila Blanco',   category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.5, unit_cost:24.50, menu_price:10, par_level:20,  reorder_point:9,   primary_location:'Liquor Room' },
      { name:'Bulleit Bourbon',          category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.5, unit_cost:27.90, menu_price:11, par_level:16,  reorder_point:7,   primary_location:'Liquor Room' },
      { name:"Hendrick's Gin",           category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.5, unit_cost:31.00, menu_price:12, par_level:10,  reorder_point:5,   primary_location:'Liquor Room' },
      { name:'House Cabernet',           category:'Wine',        vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:5,   unit_cost:9.50,  menu_price:10, par_level:24,  reorder_point:10,  primary_location:'Back Bar' },
      { name:'House Chardonnay',         category:'Wine',        vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:5,   unit_cost:8.75,  menu_price:9,  par_level:24,  reorder_point:10,  primary_location:'Walk-in Cooler' },
      { name:'Modelo Especial',          category:'Bottle Beer', vendor:"Glazer's Beer & Bev", container_size_oz:12,   pour_size_oz:12,  unit_cost:1.35,  menu_price:6,  par_level:480, reorder_point:144, primary_location:'Walk-in Cooler' },
      { name:'Lone Star',                category:'Bottle Beer', vendor:"Glazer's Beer & Bev", container_size_oz:12,   pour_size_oz:12,  unit_cost:0.95,  menu_price:5,  par_level:360, reorder_point:120, primary_location:'Walk-in Cooler' },
      { name:'ABW Pearl Snap (1/2 bbl)', category:'Draft Beer',  vendor:'Austin Beerworks',    container_size_oz:1984, pour_size_oz:16,  unit_cost:165.00,menu_price:6,  par_level:6,   reorder_point:2,   primary_location:'Walk-in Cooler' },
      { name:'Ground Beef 80/20 (lb)',   category:'Food',        vendor:'Sysco Foods',                                                   unit_cost:4.20,  par_level:240, reorder_point:80,  primary_location:'Walk-in Cooler' },
      { name:'Chicken Thigh (lb)',       category:'Food',        vendor:'Sysco Foods',                                                   unit_cost:2.95,  par_level:200, reorder_point:60,  primary_location:'Walk-in Cooler' },
      { name:'Cheddar Cheese (lb)',      category:'Food',        vendor:'Sysco Foods',                                                   unit_cost:4.60,  par_level:90,  reorder_point:30,  primary_location:'Walk-in Cooler' },
      { name:'Romaine (case)',           category:'Food',        vendor:'Sysco Foods',                                                   unit_cost:22.00, par_level:16,  reorder_point:6,   primary_location:'Walk-in Cooler' },
      { name:'Flour Tortilla (case)',    category:'Food',        vendor:'Sysco Foods',                                                   unit_cost:16.00, par_level:20,  reorder_point:8,   primary_location:'Kitchen Line' },
      { name:'Fryer Oil (jug)',          category:'Misc',        vendor:'Restaurant Depot',                                              unit_cost:28.00, par_level:10,  reorder_point:4,   primary_location:'Kitchen Line' },
      { name:'To-Go Boxes (case)',       category:'Misc',        vendor:'Restaurant Depot',                                              unit_cost:42.00, par_level:8,   reorder_point:3,   primary_location:'Kitchen Line' },
      { name:'Triple Sec',               category:'Misc',        vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:0.75, unit_cost:9.00,  par_level:12,  reorder_point:5,   primary_location:'Back Bar' },
      { name:'Lime Juice (qt)',          category:'Misc',        vendor:'Sysco Foods',         container_size_oz:32,   pour_size_oz:0.5,  unit_cost:4.50,  par_level:18,  reorder_point:6,   primary_location:'Walk-in Cooler' },
      { name:'Simple Syrup (qt)',        category:'Misc',        vendor:'Sysco Foods',         container_size_oz:32,   pour_size_oz:0.5,  unit_cost:3.50,  par_level:12,  reorder_point:4,   primary_location:'Back Bar' },
    ].map(p => {
      const pours = (p.container_size_oz && p.pour_size_oz) ? p.container_size_oz / p.pour_size_oz : null;
      const cpp   = pours ? p.unit_cost / pours : null;
      return { id:uid(), brand:'', sub_category:'', secondary_location:'', notes:'', active:true,
        container_size_oz:null, pour_size_oz:null, menu_price:null,
        pours_per_container:pours, cost_per_pour:cpp,
        pour_cost_pct:(cpp != null && p.menu_price) ? cpp/p.menu_price*100 : null,
        ...p };
    });
    App.inventoryData.ic_products = icProducts;

    // ── Recipes — costed against the ic_products master ─────────────────────
    // Each ingredient's product_id is an ic_products id; cost_per_unit and
    // total_cost are derived from that product so Recipe Library recomputes
    // the same figures live.
    const recipes = [
      { id:uid(), name:'Vodka Soda', mode:'single', category:'Cocktail', menu_price:9, target_cost_pct:20,
        ingredients:[ {product_id:icProducts[0].id, quantity:1} ] },
      { id:uid(), name:'House Cabernet', mode:'single', category:'Wine', menu_price:10, target_cost_pct:25,
        ingredients:[ {product_id:icProducts[4].id, quantity:1} ] },
      { id:uid(), name:'Bourbon, Neat', mode:'single', category:'Cocktail', menu_price:12, target_cost_pct:20,
        ingredients:[ {product_id:icProducts[2].id, quantity:1} ] },
      { id:uid(), name:'Gin Martini', mode:'single', category:'Cocktail', menu_price:13, target_cost_pct:20,
        ingredients:[ {product_id:icProducts[3].id, quantity:1.7} ] },
      { id:uid(), name:'Frozen Margarita Batch', mode:'batch', category:'Cocktail', menu_price:10, target_cost_pct:20,
        batch_yield:1, batch_yield_unit:'gallons', serving_size:5, serving_size_unit:'oz', servings_per_batch:25.6,
        ingredients:[ {product_id:icProducts[1].id, quantity:2}, {product_id:icProducts[16].id, quantity:1}, {product_id:icProducts[17].id, quantity:2}, {product_id:icProducts[18].id, quantity:1} ] },
      { id:uid(), name:'Smash Burger', mode:'food', category:'Food Plate', menu_price:13, target_cost_pct:32, plate_yield:1,
        ingredients:[ {product_id:icProducts[9].id, quantity:0.33}, {product_id:icProducts[11].id, quantity:0.12} ] },
      { id:uid(), name:'Chicken Tacos', mode:'food', category:'Food Plate', menu_price:12, target_cost_pct:32, plate_yield:1,
        ingredients:[ {product_id:icProducts[10].id, quantity:0.35}, {product_id:icProducts[13].id, quantity:0.05}, {product_id:icProducts[11].id, quantity:0.08} ] },
    ].map(r => {
      const single = (r.mode === 'single');
      r.ingredients = r.ingredients.map(ing => {
        const p = icProducts.find(x => x.id === ing.product_id);
        const cpu = p ? (single ? (p.cost_per_pour || 0) : (p.unit_cost || 0)) : 0;
        return { product_id:ing.product_id, quantity:ing.quantity, cost_per_unit:cpu,
          total_cost:+(ing.quantity * cpu).toFixed(4) };
      });
      const tc  = r.ingredients.reduce((s, i) => s + i.total_cost, 0);
      const spb = r.servings_per_batch || r.plate_yield || 1;
      const cps = tc / spb;
      const pct = r.menu_price ? cps / r.menu_price * 100 : null;
      return { ...r, total_cost:tc, cost_per_serving:cps, cost_pct:pct,
        flagged:pct != null ? pct > r.target_cost_pct : false,
        updated_at:new Date().toISOString(), created_at:new Date().toISOString() };
    });
    App.data.recipes = recipes;

    // Count totals per product index: [current (today), one week ago].
    // Usage = week-ago minus today; no deliveries land in the last 7 days, so
    // the icCOGS feed reads cleanly as (start - end) x unit cost. Tuned so the
    // feed computes to Anchor week 12: ~$2,729 bar and ~$2,364 food COGS.
    const icTotals = {
      0:[9,25], 1:[8,21], 2:[7,17], 3:[6,10], 4:[10,25], 5:[9,22],
      6:[96,456], 7:[72,332], 8:[2,6], 9:[40,220], 10:[35,199],
      11:[18,88], 12:[4,15], 13:[5,19], 14:[3,9], 15:[2,6],
      16:[2,4], 17:[6,14], 18:[3,7]
    };
    const icCountItem = (p, qty) => ({
      product_id:p.id, name:p.name, category:p.category,
      fulls:Math.floor(qty), partial:+(qty - Math.floor(qty)).toFixed(2), total:qty,
      unit_cost:p.unit_cost, value:+(qty * p.unit_cost).toFixed(2), notes:''
    });
    const mkCount = (daysAgo, pick) => {
      const items = icProducts.map((p, i) => icCountItem(p, pick(i)));
      return { id:uid(), date:dateStr(daysAgo), type:'Full', counted_by:'Maria G.',
        locations:['Liquor Room','Back Bar','Walk-in Cooler','Kitchen Line'],
        items:items, item_count:items.length,
        total_value:+items.reduce((s, it) => s + it.value, 0).toFixed(2),
        created_at:daysAgoISO(daysAgo) };
    };
    App.inventoryData.ic_counts = [
      mkCount(14, i => icTotals[i][1] + (icTotals[i][1] - icTotals[i][0])),
      mkCount(7,  i => icTotals[i][1]),
      mkCount(0,  i => icTotals[i][0]),
    ];

    // Deliveries — all dated 8+ days back so none fall inside the last count
    // period. Two carry price increases, which Vendor Watch surfaces.
    const icDLine = (p, qty, price, prev) => ({
      product_id:p.id, name:p.name,
      container_size_oz:p.container_size_oz != null ? p.container_size_oz : null,
      qty:qty, price_per_unit:price, prev_price:prev,
      price_changed:(prev != null && Math.abs(price - prev) > 0.001),
      extended:+(qty * price).toFixed(2)
    });
    const mkDelivery = (daysAgo, vendor, inv, lines) => ({
      id:uid(), vendor:vendor, date:dateStr(daysAgo), invoice_number:inv, driver:'', notes:'',
      line_items:lines, item_count:lines.length,
      total:+lines.reduce((s, l) => s + l.extended, 0).toFixed(2),
      price_change_count:lines.filter(l => l.price_changed).length,
      has_discrepancy:lines.some(l => l.price_changed), created_at:daysAgoISO(daysAgo)
    });
    App.inventoryData.ic_deliveries = [
      mkDelivery(31, 'Republic National', 'RN-55021', [
        icDLine(icProducts[0], 24, 21.40, 21.40),
        icDLine(icProducts[1], 18, 23.60, 23.60),
        icDLine(icProducts[2], 12, 27.90, 27.90),
      ]),
      mkDelivery(24, "Glazer's Beer & Bev", 'GLZ-3318', [
        icDLine(icProducts[6], 480, 1.35, 1.28),
        icDLine(icProducts[7], 360, 0.95, 0.95),
      ]),
      mkDelivery(17, 'Sysco Foods', 'SY-90455', [
        icDLine(icProducts[9],  200, 4.20, 3.95),
        icDLine(icProducts[10], 160, 2.95, 2.95),
        icDLine(icProducts[11], 80,  4.60, 4.60),
      ]),
      mkDelivery(10, 'Republic National', 'RN-55190', [
        icDLine(icProducts[0], 24, 22.40, 21.40),
        icDLine(icProducts[3], 12, 31.00, 31.00),
      ]),
    ];

    // Spot checks — feed the Theft Risk pour-variance signal.
    const icSpotItem = (p, pre, post, sold, flagged) => {
      const ppc = p.pours_per_container || 1, cpp = p.cost_per_pour || 0;
      const used = +(pre - post).toFixed(2);
      const poured = +(used * ppc).toFixed(1);
      const varP = +(poured - sold).toFixed(1);
      return { product_id:p.id, name:p.name, category:p.category,
        pours_per_container:ppc, cost_per_pour:cpp, pre:pre, post:post,
        pos_sold:sold, used_containers:used, poured:poured,
        variance_pours:varP, variance_dollar:+(varP * cpp).toFixed(2), flagged:flagged };
    };
    const mkSpot = (daysAgo, items) => ({
      id:uid(), date:dateStr(daysAgo), shift:'PM', checked_by:'Maria G.',
      items:items, product_count:items.length,
      flagged_count:items.filter(i => i.flagged).length,
      total_variance_dollar:+items.reduce((t, i) => t + (i.variance_dollar || 0), 0).toFixed(2),
      created_at:daysAgoISO(daysAgo)
    });
    App.inventoryData.ic_spot_checks = [
      mkSpot(12, [
        icSpotItem(icProducts[0], 4,   1.0, 44, true),
        icSpotItem(icProducts[2], 3,   0.7, 33, true),
        icSpotItem(icProducts[1], 3,   1.1, 40, false),
      ]),
      mkSpot(4, [
        icSpotItem(icProducts[0], 4,   1.4, 56, false),
        icSpotItem(icProducts[3], 2.5, 0.8, 38, false),
      ]),
    ];

    // ════════════════════════════════════════════════════════════════════
    //  SHIFT CONTROL — derived from the Anchor profile. Each week's sc_shifts
    //  revenue and covers sum to that week's bar_rev, food_rev and covers, so
    //  the weekly revenue feed for Profit and Revenue computes back to it.
    // ════════════════════════════════════════════════════════════════════
    App.shiftData = App.shiftData || {};
    const ANCHS = window.ANCHOR;
    const dayW  = [0.10, 0.10, 0.12, 0.14, 0.20, 0.22, 0.12]; // Mon..Sun
    const mgrs  = ['Maria G.', 'Jake T.', 'Carlos P.'];

    const scShifts = [];
    ANCHS.weeks.forEach(a => {
      const baseAgo = (12 - a.wk) * 7;
      let barLeft = a.bar_rev, foodLeft = a.food_rev, covLeft = a.covers;
      dayW.forEach((w, di) => {
        const last   = di === dayW.length - 1;
        const bar    = last ? barLeft  : Math.round(a.bar_rev  * w);
        const floor  = last ? foodLeft : Math.round(a.food_rev * w);
        const covers = last ? covLeft  : Math.round(a.covers   * w);
        barLeft -= bar; foodLeft -= floor; covLeft -= covers;
        scShifts.push({
          id:uid(), date:dateStr(baseAgo + 6 - di), shift_type:'Full Day',
          manager:mgrs[di % 3], bar_revenue:bar, floor_revenue:floor,
          total_revenue:bar + floor, covers:covers, opening_bank:300,
          staff_on_floor:di >= 4 ? 8 : 6, status:'Closed', notes:'',
          created_at:new Date().toISOString()
        });
      });
    });
    App.shiftData.sc_shifts = scShifts;

    // Drawer reconciliations — variance tightens after the fix week.
    const scVariances = [];
    ANCHS.weeks.forEach(a => {
      const baseAgo = (12 - a.wk) * 7;
      const improving = a.wk >= ANCHS.fix_week;
      [1, 4].forEach((dayOff, vi) => {
        const exp = 600 + Math.round(Math.random() * 350);
        const variance = improving
          ? Math.round((Math.random() - 0.55) * 12)
          : Math.round((Math.random() - 0.75) * 30);
        scVariances.push({
          id:uid(), date:dateStr(baseAgo + dayOff), shift_type:'Close',
          drawer:'Drawer ' + (vi + 1), cashier:mgrs[(a.wk + vi) % 3],
          expected_cash:exp, counted_cash:exp + variance, variance:variance,
          tolerance:10, status:Math.abs(variance) <= 10 ? 'OK' : variance < 0 ? 'Short' : 'Over',
          reason:'', notes:'', created_at:new Date().toISOString()
        });
      });
    });
    App.shiftData.sc_variances = scVariances;

    // Voids and comps — fewer events and all manager-authorized after the fix.
    const vcServers = ['Jessica M.', 'Marcus T.', 'Brianna K.', 'Derek W.', 'Carlos P.'];
    const scVoidComps = [];
    ANCHS.weeks.forEach(a => {
      const baseAgo = (12 - a.wk) * 7;
      const improving = a.wk >= ANCHS.fix_week;
      const n = improving ? 2 : 4;
      for (let k = 0; k < n; k++) {
        const isComp = k % 2 === 1;
        scVoidComps.push({
          id:uid(), date:dateStr(baseAgo + (k + 1)), type:isComp ? 'Comp' : 'Void',
          shift_type:'Dinner', item:isComp ? 'Guest recovery' : 'Wrong item rung',
          amount:isComp ? 8 + Math.round(Math.random() * 22) : 6 + Math.round(Math.random() * 16),
          server:vcServers[(a.wk + k) % 5],
          authorized_by:improving ? mgrs[(a.wk + k) % 3] : (k === 0 ? '' : mgrs[k % 3]),
          check_number:'', reason:isComp ? 'Service recovery' : 'Order error',
          notes:'', created_at:new Date().toISOString()
        });
      }
    });
    App.shiftData.sc_void_comps = scVoidComps;

    // One Saturday cash drop per week.
    const scCashDrops = [];
    ANCHS.weeks.forEach(a => {
      const baseAgo = (12 - a.wk) * 7;
      scCashDrops.push({
        id:uid(), date:dateStr(baseAgo + 1), shift_type:'Close', drop_time:'23:30',
        drawer:'Drawer 1', performed_by:mgrs[a.wk % 3], witness:mgrs[(a.wk + 1) % 3],
        amount:900 + Math.round(Math.random() * 500), denominations:{}, notes:'',
        created_at:new Date().toISOString()
      });
    });
    App.shiftData.sc_cash_drops = scCashDrops;

    App.shiftData.sc_86_list = [
      { id:uid(), item:'Ribeye (10 oz)',   category:'Food',      reason:'Out of product, delivery Thursday',
        date_86:dateStr(2),  time_86:'19:40', reported_by:'Luis V.',  status:'86', date_back:'', notes:'', created_at:new Date().toISOString() },
      { id:uid(), item:'Espresso Martini', category:'Cocktails', reason:'Espresso machine down',
        date_86:dateStr(1),  time_86:'18:10', reported_by:'Maria G.', status:'86', date_back:'', notes:'', created_at:new Date().toISOString() },
      { id:uid(), item:'House Chardonnay', category:'Wine',      reason:'Ran the case, reorder placed',
        date_86:dateStr(4),  time_86:'21:30', reported_by:'Jake T.',  status:'86', date_back:'', notes:'', created_at:new Date().toISOString() },
    ];

    App.shiftData.sc_maintenance = [
      { id:uid(), date_reported:dateStr(3),  equipment:'Walk-in Cooler', location:'Kitchen',
        issue:'Temperature running 4 degrees high', priority:'High', status:'Open',
        reported_by:'Luis V.', assigned_to:'CoolTech Repair', date_resolved:'', cost:null, notes:'', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(8),  equipment:'Ice Machine', location:'Main Bar',
        issue:'Slow ice production', priority:'Normal', status:'Open',
        reported_by:'Maria G.', assigned_to:'', date_resolved:'', cost:null, notes:'', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(20), equipment:'POS Terminal 2', location:'Front of House',
        issue:'Card reader intermittent', priority:'Normal', status:'Resolved',
        reported_by:'Jessica M.', assigned_to:'POS Vendor', date_resolved:dateStr(16), cost:140, notes:'', created_at:new Date().toISOString() },
    ];

    // ── Fix Layer — logged fixes feeding the Recovery Scoreboard ──
    // Pour Cost and Food Cost fixes landed five weeks back, between weeks 6
    // and 5, which is where both cost trends break downward.
    App.data.fix_log = (App.data.fix_log || [])
      .filter(e => e.module !== 'profit' && e.module !== 'revenue' && e.module !== 'traffic')
      .concat([
      { id:uid(), module:'profit', gap_id:'pour-cost',  gap_name:'Pour Cost',
        date:dateStr(45), logged_at:daysAgoISO(45) },
      { id:uid(), module:'profit', gap_id:'food-cost',  gap_name:'Food Cost',
        date:dateStr(45), logged_at:daysAgoISO(45) },
      { id:uid(), module:'profit', gap_id:'theft-loss', gap_name:'Theft and Loss',
        date:dateStr(24), logged_at:daysAgoISO(24) },
      { id:uid(), module:'revenue', gap_id:'check-average', gap_name:'Check Average and Upsell',
        date:dateStr(45), logged_at:daysAgoISO(45) },
      { id:uid(), module:'revenue', gap_id:'labor-scheduling', gap_name:'Labor Cost and Scheduling',
        date:dateStr(38), logged_at:daysAgoISO(38) },
      { id:uid(), module:'traffic', gap_id:'gbp', gap_name:'Google Business Profile',
        date:dateStr(45), logged_at:daysAgoISO(45) },
      { id:uid(), module:'traffic', gap_id:'reviews', gap_name:'Reviews',
        date:dateStr(30), logged_at:daysAgoISO(30) },
    ]);

    // ── Variance Investigations ──
    App.data.variance_investigations = [
      { id:uid(), sku:"Tito's Handmade Vodka", opened_date:dateStr(38),
        status:'resolved', resolved_date:dateStr(24),
        steps:[
          { done:true, finding:'Count sheets pulled. One 1L bottle was missed in the back well on the period-open count.' },
          { done:true, finding:'Theoretical usage recalculated. The gap closed to under 2% once the missed bottle was added back.' },
          { done:true, finding:'Variance traced to two consecutive Friday late shifts.' },
          { done:true, finding:'Bar manager confirmed a keg-line spill on one of those shifts that was never logged.' },
          { done:true, finding:'Mid-shift count run the following Friday came back clean.' },
          { done:true, finding:'Closed as a counting error plus one unlogged spill. No theft indicated.' },
        ],
        resolution:'Counting error plus an unlogged spill. Added a spill line to the closing checklist so breakage is recorded going forward.' },
      { id:uid(), sku:'Espolòn Tequila Blanco', opened_date:dateStr(9),
        status:'open',
        steps:[
          { done:true, finding:'Count sheets pulled. No obvious missed bottles this time.' },
          { done:true, finding:'Theoretical usage still runs about 9% above POS sales after a recheck.' },
          { done:true, finding:'Variance concentrated on Thursday and Saturday PM shifts.' },
          { done:false, finding:'' },
          { done:false, finding:'' },
          { done:false, finding:'' },
        ],
        resolution:'' },
    ];

    // ════════════════════════════════════════════════════════════════════
    //  LABOR CONTROL — derived from the Anchor profile. Each week's logged
    //  hours by department reconcile to ANCHOR bar_labor and food_labor.
    // ════════════════════════════════════════════════════════════════════
    App.laborData = App.laborData || {};
    const ANCHL = window.ANCHOR;

    const lcPositions = [
      { name:'Bartender', department:'Bar',            default_wage:ANCHL.wages.bar,     tipped:true  },
      { name:'Barback',   department:'Bar',            default_wage:12,                  tipped:true  },
      { name:'Line Cook', department:'Kitchen',        default_wage:ANCHL.wages.kitchen, tipped:false },
      { name:'Prep Cook', department:'Kitchen',        default_wage:13.5,                tipped:false },
      { name:'Server',    department:'Front of House', default_wage:ANCHL.wages.floor,   tipped:true  },
      { name:'Host',      department:'Front of House', default_wage:12.5,                tipped:false },
      { name:'Manager',   department:'Management',     default_wage:28,                  tipped:false },
    ].map(p => ({ id:uid(), created_at:new Date().toISOString(), ...p }));
    App.laborData.lc_positions = lcPositions;
    const lcPos = n => lcPositions.find(p => p.name === n).id;

    const mkStaff = (name, posName, wage, hiredDaysAgo) => ({
      id:uid(), name:name, position_id:lcPos(posName), wage:wage, status:'Active',
      hire_date:dateStr(hiredDaysAgo), phone:'', email:'', created_at:new Date().toISOString()
    });
    const lcStaff = [
      mkStaff('Maria G.',   'Bartender', 16,   320),
      mkStaff('Jake T.',    'Bartender', 16,   210),
      mkStaff('Ashley B.',  'Bartender', 16,   150),
      mkStaff('Devin R.',   'Barback',   12,   135),
      mkStaff('Luis V.',    'Line Cook', 15,   400),
      mkStaff('Sam P.',     'Line Cook', 15,   240),
      mkStaff('Hector M.',  'Line Cook', 15,   165),
      mkStaff('Tonya B.',   'Prep Cook', 13.5, 95),
      mkStaff('Jessica M.', 'Server',    14,   360),
      mkStaff('Marcus T.',  'Server',    14,   250),
      mkStaff('Brianna K.', 'Server',    14,   175),
      mkStaff('Priya N.',   'Server',    14,   110),
      mkStaff('Owen L.',    'Host',      12.5, 80),
      mkStaff('Carlos P.',  'Manager',   28,   520),
    ];
    App.laborData.lc_staff = lcStaff;

    const lcByPos = (...names) => {
      const ids = names.map(lcPos);
      return lcStaff.filter(st => ids.includes(st.position_id));
    };
    const lcBar     = lcByPos('Bartender', 'Barback');
    const lcKitchen = lcByPos('Line Cook', 'Prep Cook');
    const lcFloor   = lcByPos('Server', 'Host');

    // Per week, split each department's labor dollars across its staff, then
    // log five daily hour entries per person. cost sums back to ANCHOR labor.
    const lcActuals = [];
    const lcAllocate = (staff, weights, deptDollars, baseAgo) => {
      staff.forEach((st, i) => {
        const weekHours = (deptDollars * (weights[i] || 0)) / st.wage;
        for (let d = 0; d < 5; d++) {
          const h = +(weekHours / 5).toFixed(1);
          if (h <= 0) continue;
          lcActuals.push({
            id:uid(), date:dateStr(baseAgo + 5 - d), staff_id:st.id, name:st.name,
            position_id:st.position_id, shift_type:'', hours:h, wage:st.wage,
            cost:+(h * st.wage).toFixed(2), notes:''
          });
        }
      });
    };
    ANCHL.weeks.forEach(a => {
      const baseAgo = (12 - a.wk) * 7;
      lcAllocate(lcBar,     [0.30, 0.27, 0.24, 0.19],       a.bar_labor,        baseAgo);
      lcAllocate(lcKitchen, [0.30, 0.27, 0.24, 0.19],       a.food_labor * 0.5, baseAgo);
      lcAllocate(lcFloor,   [0.23, 0.21, 0.20, 0.19, 0.17], a.food_labor * 0.5, baseAgo);
    });
    App.laborData.lc_actuals   = lcActuals;

    // ── Schedules — the two most recent weeks, built from the roster ──
    const SCHED_PLAN = {
      'Bartender': { days:['Wed','Thu','Fri','Sat'],       start:'16:00', end:'23:00', hours:7 },
      'Barback':   { days:['Thu','Fri','Sat','Sun'],       start:'18:00', end:'23:00', hours:5 },
      'Line Cook': { days:['Tue','Wed','Thu','Fri','Sat'], start:'15:00', end:'22:00', hours:7 },
      'Prep Cook': { days:['Mon','Tue','Wed','Thu'],       start:'09:00', end:'15:00', hours:6 },
      'Server':    { days:['Wed','Thu','Fri','Sat','Sun'], start:'17:00', end:'22:00', hours:5 },
      'Host':      { days:['Thu','Fri','Sat','Sun'],       start:'18:00', end:'22:00', hours:4 },
      'Manager':   { days:['Tue','Wed','Thu','Fri','Sat'], start:'14:00', end:'22:00', hours:8 },
    };
    const posNameOf = id => (lcPositions.find(p => p.id === id) || {}).name;
    const mondayISO = (daysBack) => {
      const d = new Date(today); d.setDate(d.getDate() - daysBack);
      const day = d.getDay();
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
      return d.toISOString().slice(0, 10);
    };
    const buildSchedule = (weekStart, forecast) => {
      const shifts = [];
      lcStaff.forEach(st => {
        const plan = SCHED_PLAN[posNameOf(st.position_id)];
        if (!plan) return;
        plan.days.forEach(day => {
          shifts.push({ staff_id:st.id, name:st.name, position_id:st.position_id, day:day,
            start:plan.start, end:plan.end, hours:plan.hours, wage:st.wage,
            cost:+(plan.hours * st.wage).toFixed(2) });
        });
      });
      const total_hours = shifts.reduce((s, x) => s + x.hours, 0);
      const total_cost  = +shifts.reduce((s, x) => s + x.cost, 0).toFixed(2);
      return { id:uid(), week_start:weekStart, revenue_forecast:forecast, shifts:shifts,
        total_hours:total_hours, total_cost:total_cost,
        labor_pct:+(total_cost / forecast * 100).toFixed(2),
        rplh:+(forecast / total_hours).toFixed(2),
        notes:'', status:'Posted', created_at:new Date().toISOString() };
    };
    App.laborData.lc_schedules = [
      buildSchedule(mondayISO(7), 18812),
      buildSchedule(mondayISO(0), 19150),
    ];

    // ── Tips — recent shifts for every tipped staff member ──
    const lcTipped = lcStaff.filter(st => ['Bartender','Barback','Server'].includes(posNameOf(st.position_id)));
    const lcTips = [];
    [3, 5, 8, 10, 12].forEach(d => {
      lcTipped.forEach(st => {
        const role = posNameOf(st.position_id);
        const base = role === 'Bartender' ? 135 : role === 'Server' ? 100 : 55;
        const cash = Math.round(base * (0.30 + Math.random() * 0.22));
        const card = Math.round(base * (0.92 + Math.random() * 0.40));
        lcTips.push({ id:uid(), date:dateStr(d), staff_id:st.id, name:st.name,
          position_id:st.position_id, shift_type:'Dinner',
          cash_tips:cash, card_tips:card, total_tips:cash + card,
          hours:role === 'Server' ? 5 : 7, notes:'', created_at:daysAgoISO(d) });
      });
    });
    App.laborData.lc_tips = lcTips;

    // ── Tip pools — three recent close-outs, split by hours ──
    const mkPool = (d, amount) => {
      const parts = lcTipped.map(st => ({ staff_id:st.id, name:st.name,
        hours:posNameOf(st.position_id) === 'Server' ? 5 : 7 }));
      const totH = parts.reduce((s, p) => s + p.hours, 0);
      parts.forEach(p => p.share = +(amount * p.hours / totH).toFixed(2));
      return { id:uid(), date:dateStr(d), method:'hours', pool_amount:amount,
        total_hours:totH, participants:parts, created_at:daysAgoISO(d) };
    };
    App.laborData.lc_tip_pools = [ mkPool(4, 980), mkPool(11, 1120), mkPool(18, 1040) ];

    // ── Call-out log ──
    const lcCO = (st, d, type, covered, by) => ({ id:uid(), date:dateStr(d), staff_id:st.id,
      name:st.name, type:type, shift_type:'Dinner', covered:covered, covered_by:by,
      reason:'', notes:'', created_at:daysAgoISO(d) });
    App.laborData.lc_callouts = [
      lcCO(lcStaff[1],  6,  'Called Out Sick', true,  'Maria G.'),
      lcCO(lcStaff[9],  13, 'No-Show',         true,  'Jessica M.'),
      lcCO(lcStaff[3],  22, 'Late Arrival',    false, ''),
      lcCO(lcStaff[10], 31, 'Called Out Sick', true,  'Priya N.'),
      lcCO(lcStaff[2],  44, 'Left Early',      true,  'Jake T.'),
    ];

    // ── Save everything — App.data plus all three Control stores ──
    await App.save();
    await App.saveInventory();
    await App.saveLabor();
    await App.saveShift();
    App.updatePeriod();

    if (msg) { msg.style.color = 'var(--gold)'; msg.textContent = '✓ Sample data loaded. All six modules populated. Go test!'; }
  },

  async clearAll() {
    if (!confirm('This permanently erases ALL data in your account: every weekly record, audit, recipe, and all Inventory, Labor, and Shift Control data. Your settings and targets are kept. This cannot be undone.\n\nClear all data?')) return;
    const msg = document.getElementById('s-test-msg');
    if (msg) { msg.style.color = 'var(--t3)'; msg.textContent = 'Clearing...'; msg.style.display = 'block'; }

    // Reset every data key to its default. App.data.settings (bar name,
    // targets, etc.) is preserved — that is "user settings" the dialog says
    // it keeps. Everything else — Profit, Revenue, Traffic, fix log —
    // goes back to its empty default.
    const s = App.data.settings;
    const defaults = DB._defaultData();
    App.data = {
      ...defaults,
      settings: { ...s, onboarding_complete:true, _targets_saved:false }
    };
    // Clear the three Control stores too — Inventory, Labor, and Shift.
    App.inventoryData = {};
    App.laborData     = {};
    App.shiftData     = {};
    await App.save();
    await App.saveInventory();
    await App.saveLabor();
    await App.saveShift();
    App.updatePeriod();

    if (msg) { msg.style.color = 'var(--gold)'; msg.textContent = '✓ All data cleared. Ready for real data.'; }
  }
};
