'use strict';
/* ── Hub Settings — the single platform-wide settings view ────────────────────
   A Hub-owned view, not a module screen. Opens from the Hub into the Hub
   container (never the module app shell), with a Back to Hub control. Nine
   collapsible sections (map Section 1, item 8), each saving on its own. Reads
   and writes the existing settings keys; this is purely a UI consolidation. */
S.HubSettings = {

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
    this.render(wrap);
  },

  render(container) {
    const secs = [
      { id:'profile',   title:'Operation Profile',     body:this.secProfile() },
      { id:'profit',    title:'Profit Targets',        body:this.secProfit() },
      { id:'revenue',   title:'Revenue Targets',       body:this.secRevenue() },
      { id:'traffic',   title:'Traffic Targets',       body:this.secTraffic() },
      { id:'team',      title:'Team and Wages',        body:this.secTeam() },
      { id:'inventory', title:'Inventory Preferences', body:this.secInventory() },
      { id:'shift',     title:'Shift Preferences',     body:this.secShift() },
      { id:'notif',     title:'Notifications',         body:this.secNotifications() },
      { id:'account',   title:'Account',               body:this.secAccount() }
    ];
    container.scrollTop = 0;
    container.innerHTML =
      '<div style="max-width:880px;margin:0 auto;padding:0 24px 64px;">'
      + '<div style="display:flex;align-items:center;gap:14px;padding:20px 0 16px;position:sticky;top:0;background:var(--bg);z-index:5;border-bottom:1px solid var(--b2);margin-bottom:18px;">'
      +   '<button id="hs-back" class="btn btn-ghost btn-sm">&#8592; Back to Hub</button>'
      +   '<div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--w);">Platform Settings</div>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:16px;">Every platform setting in one place. Open a section, make your changes, and save that section. Each section saves on its own.</div>'
      + secs.map(sec => this.card(sec)).join('')
      + '</div>';
    document.getElementById('hs-back').addEventListener('click', () => App.showHub());
    this.wire(container);
    this.renderSubscription();
  },

  card(sec) {
    return '<div class="hs-card" style="background:var(--surface);border:1px solid var(--b1);border-radius:4px;margin-bottom:10px;overflow:hidden;">'
      + '<div class="hs-head" style="display:flex;align-items:center;gap:12px;padding:15px 20px;cursor:pointer;">'
      +   '<div style="flex:1;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--t1);">' + esc(sec.title) + '</div>'
      +   '<span class="hs-chev" style="font-size:13px;color:var(--t3);transition:transform .15s;">&#9656;</span>'
      + '</div>'
      + '<div class="hs-body" style="display:none;padding:6px 20px 20px;border-top:1px solid var(--b2);">' + sec.body + '</div>'
      + '</div>';
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
    return '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
      + '<div class="f w-lg"><label>Bar / Restaurant Name</label><input type="text" id="hs-name" value="' + esc(s.bar_name||'') + '" placeholder="The Rusty Nail"/></div>'
      + '<div class="f" style="width:160px;"><label>City</label><input type="text" id="hs-city" value="' + esc((s.city_state||'').split(',')[0]?.trim()||'') + '" placeholder="Austin"/></div>'
      + '<div class="f" style="width:140px;"><label>State / Province</label><input type="text" id="hs-state" value="' + esc((s.city_state||'').split(',')[1]?.trim()||'') + '" placeholder="TX"/></div>'
      + '<div class="f" style="width:170px;"><label>Annual Bar Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-abr" value="' + (s.annual_bar_revenue||0) + '"/></div></div>'
      + '<div class="f" style="width:170px;"><label>Annual Food Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-afr" value="' + (s.annual_food_revenue||0) + '"/></div></div>'
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
      + '<div style="font-size:11px;color:var(--t3);line-height:1.6;margin-top:10px;">A drawer counted within this dollar amount of expected is treated as on target. This tolerance is shared by Shift Control and Profit Cash Reconciliation.</div>'
      + this.saveRow('shift');
  },

  secNotifications() {
    return '<div style="font-size:12px;color:var(--t2);line-height:1.7;">Alerts surface automatically on the Hub: metric breaches, forward-looking warnings, and Traffic cadence nudges. There are no notification toggles to configure yet. When email or push delivery is added, its controls will live here.</div>';
  },

  secAccount() {
    const eye = (id) => '<button type="button" class="pw-eye" tabindex="-1" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);margin-left:6px;padding:0 9px;cursor:pointer;color:var(--t3);display:flex;align-items:center;flex-shrink:0;" onclick="const i=document.getElementById(\'' + id + '\');i.type=i.type===\'password\'?\'text\':\'password\';this.style.color=i.type===\'text\'?\'var(--gold)\':\'var(--t3)\';"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/></svg></button>';
    const sh = (txt) => '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin:18px 0 12px;">' + txt + '</div>';
    return sh('Password').replace('margin:18px', 'margin:2px')
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
    container.querySelectorAll('.hs-head').forEach(head => {
      head.addEventListener('click', () => {
        const body = head.nextElementSibling;
        const chev = head.querySelector('.hs-chev');
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
        if (chev) chev.style.transform = 'rotate(' + (isOpen ? '0' : '90') + 'deg)';
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
    const plan = sub.plan || null;
    const modules = sub.active_modules || [];
    const periodEnd = sub.period_end ? new Date(sub.period_end) : null;

    const planLabels = { tier_1: '1 Module', tier_2: '2 Modules', tier_3: '3 Modules (Full Access)' };
    const moduleLabels = { profit: 'Profit Recovery', revenue: 'Revenue Recovery', traffic: 'Traffic Recovery' };
    const statusColor = { active: 'var(--gold)', past_due: 'var(--red)', canceled: 'var(--red)', inactive: 'var(--t2)' };
    const statusLabel = { active: 'Active', past_due: 'Past Due', canceled: 'Canceled', inactive: 'No Active Subscription' };
    const allModules = ['profit', 'revenue', 'traffic'];
    const hasAll = allModules.every(m => modules.includes(m));

    let moduleRows = allModules.map(m => {
      const on = modules.includes(m);
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">'
        + '<div style="width:8px;height:8px;border-radius:50%;background:' + (on ? 'var(--gold)' : 'var(--t2)') + ';flex-shrink:0;"></div>'
        + '<div style="font-size:13px;color:' + (on ? 'var(--t1)' : 'var(--t2)') + ';">' + moduleLabels[m] + '</div>'
        + '<div style="margin-left:auto;font-size:11px;font-weight:700;letter-spacing:1px;color:' + (on ? 'var(--gold)' : 'var(--t2)') + ';">' + (on ? 'ACTIVE' : 'AVAILABLE') + '</div>'
        + '</div>';
    }).join('');

    let billingLine = '';
    if (periodEnd && status === 'active') {
      billingLine = '<div style="font-size:12px;color:var(--t2);margin-top:4px;">Renews ' + periodEnd.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) + '</div>';
    } else if (periodEnd && status === 'canceled') {
      billingLine = '<div style="font-size:12px;color:var(--red);margin-top:4px;">Access ends ' + periodEnd.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) + '</div>';
    }

    let upgradeBlock = '';
    if (status === 'active' && !hasAll) {
      upgradeBlock = '<div class="card" style="margin-top:0;">'
        + '<div class="settings-title" style="margin-bottom:12px;">Add More Modules</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:14px;line-height:1.6;">Unlock Revenue Recovery or Traffic Recovery to get a full picture of where your bar is bleeding money.</div>'
        + '<button class="btn btn-primary" id="s-upgrade-btn">View Upgrade Options</button>'
        + '</div>';
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
      retentionBlock = '<div class="card" style="margin-top:0;border:1px solid rgba(192,56,40,0.35);">'
        + '<div class="settings-title" style="margin-bottom:10px;">Export Your Data Before It Is Removed</div>'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:14px;line-height:1.6;">' + removalLine + ' Download a full backup now so you keep your records.</div>'
        + '<button class="btn btn-primary" id="s-retain-export">Export a Backup</button>'
        + '</div>';
    }

    let noSubBlock = '';
    if (status === 'inactive' || status === 'canceled') {
      noSubBlock = '<div class="card" style="margin-top:0;">'
        + '<div style="font-size:13px;color:var(--t2);margin-bottom:14px;line-height:1.6;">You do not have an active subscription. Return to the Recovery Hub to choose a plan.</div>'
        + '<button class="btn btn-primary" id="s-go-hub-btn">Go to Recovery Hub</button>'
        + '</div>';
    }

    el.innerHTML = '<div class="settings-section" style="display:flex;flex-direction:column;gap:16px;">'
      + '<div class="card">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div>'
      + '<div style="font-size:18px;font-weight:700;color:var(--t1);">' + (plan ? planLabels[plan] : 'No Plan') + '</div>'
      + '<div style="font-size:12px;font-weight:700;letter-spacing:1px;color:' + (statusColor[status] || 'var(--t2)') + ';margin-top:4px;text-transform:uppercase;">' + (statusLabel[status] || status) + '</div>'
      + billingLine
      + '</div>'
      + (status === 'active'
        ? '<button class="btn btn-ghost" id="s-portal-btn" style="flex-shrink:0;">Manage Billing</button>'
        : '')
      + '</div>'
      + '<div style="margin-top:20px;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--t2);margin-bottom:8px;text-transform:uppercase;">Recovery Modules</div>'
      + moduleRows
      + '</div>'
      + '</div>'
      + upgradeBlock
      + retentionBlock
      + noSubBlock
      + '</div>';

    document.getElementById('s-portal-btn')?.addEventListener('click', () => this.openBillingPortal());
    document.getElementById('s-upgrade-btn')?.addEventListener('click', () => App.showHub());
    document.getElementById('s-go-hub-btn')?.addEventListener('click', () => App.showHub());
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
        return { product_id:p.id, actual_units:+actualPours.toFixed(1), theoretical_units:theo, variance_units:varU, variance_oz:+(varU*p.std_pour_oz).toFixed(1), variance_dollar:+(varU*p.cost_per_pour).toFixed(2), status:Math.abs(varU)<=2?'OK':'Over — Investigate' };
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
      const status = diff<=0?'ON TARGET':diff<=3?'WATCH — SLIGHTLY OVER':'INVESTIGATE — SIGNIFICANTLY OVER';
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
      { id:uid(), date:dateStr(60), scores:{0:3,1:4,2:3,3:4,4:3,5:4,6:3,7:4,8:3,9:3,10:4,11:4}, total:42, rating:'High Risk — Immediate Action' },
      { id:uid(), date:dateStr(30), scores:{0:2,1:3,2:2,3:3,4:2,5:3,6:2,7:3,8:2,9:2,10:3,11:3}, total:30, rating:'Moderate Risk — Tighten Controls' },
      { id:uid(), date:new Date().toISOString(),  scores:{0:1,1:2,2:1,3:2,4:1,5:2,6:1,7:2,8:1,9:2,10:2,11:2}, total:19, rating:'Low Risk — Strong Controls' },
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
        S4_FINDING: 'Sampled invoices show price drift and at least two short deliveries that were paid in full. That works out to roughly $1,140 of monthly exposure, with no backup vendor leverage.',
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
        S4_FINDING: 'Exposure has fallen to about $210 per month. Two backup vendors per category give real negotiating leverage; the annual bid is scheduled but not yet run.',
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
        S6_SIG2_GAP: 'Leaving roughly $1,800/year of negotiating leverage unused.',
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
        S5_TOOL: 'Build a private dining package with a spend minimum and a rate card.'
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
        S5_TOOL: 'List the private dining package on the website and the Google Business Profile.'
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
        S5_TOOL: 'Add a second private dining time slot on Fridays and Saturdays.'
      }})
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
      11:[18,88], 12:[4,15], 13:[5,19], 14:[3,9], 15:[2,6]
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
    App.data.fix_log = (App.data.fix_log || []).filter(e => e.module !== 'profit').concat([
      { id:uid(), module:'profit', gap_id:'pour-cost',  gap_name:'Pour Cost',
        date:dateStr(45), logged_at:daysAgoISO(45) },
      { id:uid(), module:'profit', gap_id:'food-cost',  gap_name:'Food Cost',
        date:dateStr(45), logged_at:daysAgoISO(45) },
      { id:uid(), module:'profit', gap_id:'theft-loss', gap_name:'Theft & Loss',
        date:dateStr(24), logged_at:daysAgoISO(24) },
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
    App.laborData.lc_schedules = [];
    App.laborData.lc_tips      = [];
    App.laborData.lc_tip_pools = [];
    App.laborData.lc_callouts  = [];

    // ── Save everything — App.data plus all three Control stores ──
    await App.save();
    await App.saveInventory();
    await App.saveLabor();
    await App.saveShift();
    App.updatePeriod();

    if (msg) { msg.style.color = 'var(--gold)'; msg.textContent = '✓ Sample data loaded — all six modules populated. Go test!'; }
  },

  async clearAll() {
    if (!confirm('This permanently erases ALL data in your account: every weekly record, audit, recipe, and all Inventory, Labor, and Shift Control data. Your settings and targets are kept. This cannot be undone.\n\nClear all data?')) return;
    const msg = document.getElementById('s-test-msg');
    if (msg) { msg.style.color = 'var(--t3)'; msg.textContent = 'Clearing...'; msg.style.display = 'block'; }

    const s = App.data.settings;
    App.data = {
      settings: { ...s, onboarding_complete:true, _targets_saved:false },
      bar_products:[], kitchen_products:[], recipes:[],
      weeks:[], shifts:[], reconciliations:[],
      theft_scores:[], vendor_log:[], last_theft_score_date:null,
      audits:[],
      getting_started_profit:{},
      revenue_settings: App.data.revenue_settings,
      revenue_weeks: App.data.revenue_weeks || [],
      revenue_audits: App.data.revenue_audits || [],
      revenue_server_checks: App.data.revenue_server_checks || [],
      revenue_menu_items: App.data.revenue_menu_items || [],
      revenue_price_log: App.data.revenue_price_log || [],
      revenue_events: App.data.revenue_events || [],
      revenue_rate_cards: App.data.revenue_rate_cards || [],
      getting_started_revenue: App.data.getting_started_revenue || {},
      traffic_settings: App.data.traffic_settings,
      traffic_weeks: App.data.traffic_weeks || [],
      traffic_audits: App.data.traffic_audits || [],
      getting_started_traffic: App.data.getting_started_traffic || {},
      hub_setup_progress: {},
      fix_log: [],
      variance_investigations: []
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
