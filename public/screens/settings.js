'use strict';
/* ── Hub Settings — the single platform-wide settings view ────────────────────
   A Hub-owned view, not a module screen. Opens from the Hub into the Hub
   container (never the module app shell), with a Back to Hub control. Tab
   navigation across the seven settings sections; each section saves on its
   own. Reads and writes the existing settings keys; purely a UI consolidation. */
S.HubSettings = {

  // The seven settings sections split across two Settings-sidebar pages so
  // neither is overloaded. open(group) lands on one; the gear and the legacy
  // openScreen('settings') default to Business Profile. wire() only mounts
  // ServicePeriods and saves the sections actually present, so a subset renders
  // safely.
  _GROUPS: {
    'business-profile': { title: 'Business Profile', action: 'settings-profile', ids: ['profile', 'service', 'links'] },
    'recovery-targets': { title: 'Recovery Targets', action: 'settings-targets', ids: ['profit', 'revenue', 'traffic', 'tconv'] }
  },

  // Full-page Hub screen. Sidebar stays mounted, content area swaps.
  open(group) {
    const g = this._GROUPS[group] ? group : 'business-profile';
    const meta = this._GROUPS[g];
    App.openHubFullPage(meta.title, (mount) => this.render(mount, g), meta.action);
  },

  render(container, group) {
    const allSecs = [
      { id:'profile', title:'Profile',                   body:this.secProfile(),       save:true },
      { id:'service', title:'Service Periods',           body:this.secServicePeriods(), save:true },
      { id:'profit',  title:'Profit Targets',            body:this.secProfit(),        save:true },
      { id:'revenue', title:'Revenue Targets',           body:this.secRevenue(),       save:true },
      { id:'traffic', title:'Traffic Targets',           body:this.secTraffic(),       save:true },
      { id:'links',   title:'Operation Links',           body:this.secLinks(),         save:true },
      { id:'tconv',   title:'Traffic Conversion Rates',  body:this.secTrafficConv(),   save:true }
    ];
    const grp = this._GROUPS[group];
    const secs = grp ? allSecs.filter(s => grp.ids.indexOf(s.id) !== -1) : allSecs;
    container.scrollTop = 0;

    const cards = secs.map(s =>
      '<div class="card form-card" data-section="' + s.id + '" style="margin-bottom:16px;">'
      + this.sectionHead(s.id, s.title, s.save)
      + s.body
      + '</div>'
    ).join('');

    container.innerHTML =
      '<div class="screen">'
      + cards
      + '</div>';
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    this.wire(container);
  },

  // Card header: title left, Saved indicator + Save Data button right.
  // Save button styled like the "Go" buttons in Getting Started (ghost, small).
  sectionHead(id, title, hasSave) {
    return '<div class="card-title" style="display:flex;align-items:center;gap:12px;">'
      + '<span style="flex:1;">' + esc(title) + '</span>'
      + (hasSave
          ? '<span class="hs-msg" data-msg="' + id + '" style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gold);display:none;">Saved</span>'
            + '<button class="btn btn-ghost btn-sm hs-save" data-save="' + id + '">Save Data</button>'
          : '')
      + '</div>';
  },

  // ── Section bodies ──────────────────────────────────────────────────────────
  secProfile() {
    const s = App.data.settings || {};
    return '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="width:195px;"><label>Bar / Restaurant Name</label><input type="text" id="hs-name" value="' + esc(s.bar_name||'') + '" placeholder="The Rusty Nail"/></div>'
      + '<div class="f" style="width:200px;"><label>Street Address</label><input type="text" id="hs-address" value="' + esc(s.address||'') + '" placeholder="123 Main St"/></div>'
      + '<div class="f" style="width:120px;"><label>City</label><input type="text" id="hs-city" value="' + esc((s.city_state||'').split(',')[0]?.trim()||'') + '" placeholder="Austin"/></div>'
      + '<div class="f" style="width:125px;"><label>State / Province</label><input type="text" id="hs-state" value="' + esc((s.city_state||'').split(',')[1]?.trim()||'') + '" placeholder="TX"/></div>'
      + '<div class="f" style="width:120px;"><label>Phone</label><input type="text" id="hs-phone" value="' + esc(s.phone||'') + '" placeholder="(512) 555-0142"/></div>'
      + '<div class="f" style="width:150px;"><label>Bar Sales</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-abr" value="' + (s.annual_bar_revenue||'') + '" placeholder="Annual Bar Sales"/></div></div>'
      + '<div class="f" style="width:150px;"><label>Food Sales</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-afr" value="' + (s.annual_food_revenue||'') + '" placeholder="Annual Food Sales"/></div></div>'
      + '</div>';
  },

  // Service Periods — which dayparts the operator runs. Mounts the shared
  // ServicePeriods selector (mounted in wire()); Save writes settings.service_periods.
  secServicePeriods() {
    return '<div id="hs-sp-mount"></div>'
      + '<span id="hs-sp-err" style="color:var(--red);font-size:12px;display:none;margin-top:8px;"></span>';
  },

  secProfit() {
    const t = (App.data.settings||{}).targets || {};
    return '<div class="form-row" style="gap:16px 20px;flex-wrap:wrap;">'
      + '<div class="f" style="width:130px;"><label>Bar Pour Cost % ' + tt('sh-bar-pour') + '</label><div class="fw"><input class="suf" type="number" id="hs-bpc" value="' + (t.bar_pour_cost_pct ?? 22) + '" step="0.1"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Food Cost % ' + tt('sh-food-cost') + '</label><div class="fw"><input class="suf" type="number" id="hs-fc" value="' + (t.food_cost_pct ?? 32) + '" step="0.1"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Labor Cost % ' + tt('sh-labor-cost') + '</label><div class="fw"><input class="suf" type="number" id="hs-lc" value="' + (t.labor_cost_pct ?? 30) + '" step="0.1"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Prime Cost % ' + tt('sh-prime-cost') + '</label><div class="fw"><input class="suf" type="number" id="hs-pc" value="' + (t.prime_cost_pct ?? 60) + '" step="0.1"/><span class="suf">%</span></div></div>'
      + '</div>';
  },

  secRevenue() {
    const rt = ((App.data.revenue_settings||{}).targets) || {};
    return '<div class="form-row" style="gap:16px 20px;flex-wrap:wrap;">'
      + '<div class="f" style="width:130px;"><label>Check Average ' + tt('r-check-avg') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-r-ca" value="' + (rt.check_avg ?? 35) + '" step="0.5"/></div></div>'
      + '<div class="f" style="width:130px;"><label>Lunch RPLH ' + tt('r-lunch-rplh') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-r-rl" value="' + (rt.rplh_lunch ?? 50) + '"/></div></div>'
      + '<div class="f" style="width:130px;"><label>Dinner RPLH ' + tt('r-dinner-rplh') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-r-rd" value="' + (rt.rplh_dinner ?? 75) + '"/></div></div>'
      + '<div class="f" style="width:130px;"><label>Bar RPLH ' + tt('r-bar-rplh') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-r-rb" value="' + (rt.rplh_bar ?? 65) + '"/></div></div>'
      + '<div class="f" style="width:130px;"><label>Event Close Rate ' + tt('r-event-close') + '</label><div class="fw"><input class="suf" type="number" id="hs-r-ec" value="' + (rt.event_close_rate ?? 40) + '" step="1"/><span class="suf">%</span></div></div>'
      + '</div>';
  },

  secTraffic() {
    const tg = ((App.data.traffic_settings||{}).targets) || {};
    return '<div class="form-row" style="gap:16px 20px;flex-wrap:wrap;">'
      + '<div class="f" style="width:140px;"><label>Google Rating ' + tt('t-google-rating') + '</label><div class="fw"><input class="suf" type="number" id="hs-t-gr" value="' + (tg.google_rating ?? 4.3) + '" step="0.1" min="1" max="5"/><span class="suf">&#9733;</span></div></div>'
      + '<div class="f" style="width:140px;"><label>New Reviews / Mo ' + tt('t-review-vel') + '</label><div class="fw"><input class="suf" type="number" id="hs-t-rv" value="' + (tg.review_velocity ?? 8) + '" step="1"/><span class="suf">/mo</span></div></div>'
      + '<div class="f" style="width:140px;"><label>Response Rate ' + tt('t-response-rate') + '</label><div class="fw"><input class="suf" type="number" id="hs-t-rr" value="' + (tg.response_rate ?? 75) + '" step="1"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:140px;"><label>Monthly Sessions ' + tt('t-monthly-sessions') + '</label><div class="fw"><input class="suf" type="number" id="hs-t-ms" value="' + (tg.monthly_sessions ?? 2000) + '" step="100"/><span class="suf">/mo</span></div></div>'
      + '<div class="f" style="width:140px;"><label>Social Posts / Mo ' + tt('t-social-posts') + '</label><div class="fw"><input class="suf" type="number" id="hs-t-sp" value="' + (tg.social_posts_month ?? 12) + '" step="1"/><span class="suf">posts</span></div></div>'
      + '</div>';
  },

  // Operation Links — operator's public URLs for each digital platform. The
  // Traffic Audit fetches public data from these (where possible) and Recovery
  // screens use them for "Open Live" click-throughs to the operator's actual
  // listings. One-time setup.
  secLinks() {
    const u = ((App.data.traffic_settings || {}).urls) || {};
    const field = (id, label, val, ph) =>
      '<div class="f" style="width:100%;"><label>' + label + '</label>'
      + '<input type="url" id="' + id + '" value="' + esc(val || '') + '" placeholder="' + esc(ph) + '"/></div>';
    const rows = App.TRAFFIC_PLATFORMS.map(p =>
      field('hs-url-' + p.urlKey, p.label, u[p.urlKey], p.placeholder)
    ).join('');
    return '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 20px;">' + rows + '</div>';
  },

  // Traffic Recovery Scoreboard conversion rates. Each rate maps a Traffic
  // metric improvement to a dollar figure via check_avg × this rate. Defaults
  // are industry benchmarks; operator can override per channel based on their
  // own data once they have it.
  secTrafficConv() {
    const c = ((App.data.traffic_settings || {}).conversion_rates) || {};
    return '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:14px;">'
      + 'How often each digital signal turns into an actual guest visit. These rates power dollar figures on the Recovery Scoreboard for Traffic fixes. Defaults are industry benchmarks for bar and restaurant operations. Override if your own data shows a different conversion.'
      + '</div>'
      + '<div class="form-row" style="gap:16px 20px;flex-wrap:wrap;">'
      + '<div class="f" style="width:200px;"><label>Website Session to Visit ' + tt('hs-conv-web') + '</label><div class="fw"><input class="suf" type="number" id="hs-conv-web" value="' + (c.web_session_to_visit ?? 3) + '" step="0.1" min="0" max="100"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:200px;"><label>Email Open to Visit ' + tt('hs-conv-email') + '</label><div class="fw"><input class="suf" type="number" id="hs-conv-email" value="' + (c.email_open_to_visit ?? 1) + '" step="0.1" min="0" max="100"/><span class="suf">%</span></div></div>'
      + '</div>';
  },

  // secShift removed. Cash variance tolerance now lives in Shift Control's
  // own Setup section (Cash Tolerances) so all Control setup stays with the
  // module it controls. Hub Settings keeps only genuinely cross-system fields.

  // ── Wiring ──────────────────────────────────────────────────────────────────
  wire(container) {
    container.querySelectorAll('.hs-save').forEach(btn => {
      btn.addEventListener('click', () => this.saveSection(btn.dataset.save));
    });
    const spMount = container.querySelector('#hs-sp-mount');
    if (spMount && window.ServicePeriods) {
      this._spCtrl = ServicePeriods.mount(spMount, { selected: App.servicePeriods() });
    }
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
      s.phone               = document.getElementById('hs-phone')?.value.trim() || '';
      s.address             = document.getElementById('hs-address')?.value.trim() || '';
      s.city_state          = city && state ? city + ', ' + state : city || state || '';
      s.annual_bar_revenue  = numOr('hs-abr', 0);
      s.annual_food_revenue = numOr('hs-afr', 0);
      keys.push('settings');
      // Filling the profile here (not just via onboarding) checks off the setup step.
      if (s.bar_name && App.markSetupDone) App.markSetupDone('gs_profile');
    } else if (which === 'service') {
      const all = this._spCtrl ? this._spCtrl.value() : [];
      const errEl = document.getElementById('hs-sp-err');
      const showErr = m => { if (errEl) { errEl.textContent = m; errEl.style.display = 'inline'; } };
      if (all.some(p => !(p.name || '').trim())) { showErr('Name your custom period, or turn it off.'); return; }
      const periods = all.filter(p => p && p.name);
      if (!periods.length) { showErr('Pick at least one service period.'); return; }
      if (errEl) errEl.style.display = 'none';
      App.data.settings.service_periods = periods;
      keys.push('settings');
    } else if (which === 'profit') {
      const s = App.data.settings;
      s.targets = Object.assign({}, s.targets, {
        bar_pour_cost_pct: numOr('hs-bpc', 22),
        food_cost_pct:     numOr('hs-fc', 32),
        labor_cost_pct:    numOr('hs-lc', 30),
        prime_cost_pct:    numOr('hs-pc', 60)
      });
      // Drop the pre-consolidation per-department labor fields so stored data
      // can't disagree with the single labor_cost_pct.
      delete s.targets.bar_labor_cost_pct;
      delete s.targets.food_labor_cost_pct;
      keys.push('settings');
    } else if (which === 'revenue') {
      const rs = App.data.revenue_settings = App.data.revenue_settings || {};
      rs.targets = Object.assign({}, rs.targets, {
        check_avg:         numOr('hs-r-ca', 35),
        rplh_lunch:        numOr('hs-r-rl', 50),
        rplh_dinner:       numOr('hs-r-rd', 75),
        rplh_bar:          numOr('hs-r-rb', 65),
        event_close_rate:  numOr('hs-r-ec', 40)
      });
      // Labor % is now the single settings.targets.labor_cost_pct (App.laborTargetPct);
      // drop the old per-department copies so they can't drift.
      delete rs.targets.bar_labor_pct;
      delete rs.targets.kitchen_labor_pct;
      delete rs.targets.floor_labor_pct;
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
      keys.push('traffic_settings');
    } else if (which === 'links') {
      const ts = App.data.traffic_settings = App.data.traffic_settings || {};
      const strOr = (id) => (document.getElementById(id)?.value || '').trim();
      const next = Object.assign({}, ts.urls);
      App.TRAFFIC_PLATFORMS.forEach(p => { next[p.urlKey] = strOr('hs-url-' + p.urlKey); });
      ts.urls = next;
      keys.push('traffic_settings');
    } else if (which === 'tconv') {
      const ts = App.data.traffic_settings = App.data.traffic_settings || {};
      ts.conversion_rates = Object.assign({}, ts.conversion_rates, {
        web_session_to_visit:    numOr('hs-conv-web',    3),
        email_open_to_visit:     numOr('hs-conv-email',  1)
      });
      keys.push('traffic_settings');
    } else {
      return;
    }

    Promise.all(keys.map(k => App.saveKey(k))).then(() => {
      this._flashSaved(which);
      App.updatePeriod();
      // Saving any target group counts as completing the Hub Getting Started
      // targets task — Profit, Revenue, or Traffic. Profile is auto-completed
      // by the onboarding wizard, so this is the second Foundation task.
      if (which === 'profit' || which === 'revenue' || which === 'traffic') {
        App.markSetupDone('gs_targets');
      }
      if (which === 'service') App.markSetupDone('gs_service_periods');
    });
  },

  // ── Data backup (Section 15) ───────────────────────────────────────────────
  // A full, self-contained backup: the Recovery data blob plus all three
  // Control stores. Plain JSON the operator keeps offsite.
  _backupMsg(text, color) {
    const m = document.getElementById('ua-backup-msg');
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
      a.download = 'barcop-backup-' + safe + '-' + App.todayLocal() + '.json';
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
    const ok = await App.confirm({
      title: 'Restore the backup from ' + when + '?',
      message: 'This replaces every record currently in your account: settings, weekly numbers, audits, and all Inventory, Labor, and Shift Control data. It cannot be undone.',
      confirmText: 'Restore',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    this._backupMsg('Restoring backup...', 'var(--t3)');
    try {
      App.data          = backup.data;
      App.inventoryData = backup.inventoryData || {};
      App.laborData     = backup.laborData || {};
      App.shiftData     = backup.shiftData || {};
      await App.save();
      await App.saveInventory();
      await App.seedEventStores('ic');
      await App.saveLabor();
      await App.seedEventStores('lc');
      await App.saveShift();
      await App.seedEventStores('sc');
      await App.seedEventStores('core');   // recovery event logs -> core_events rows
      this._backupMsg('Backup restored. Reloading...', 'var(--gold)');
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      this._backupMsg('Restore failed: ' + (e.message || 'unknown error'), 'var(--red)');
    }
  },

  async loadSample() {
    const msg = document.getElementById('ua-test-msg');
    if (msg) { msg.style.color = 'var(--gold)'; msg.textContent = 'Loading sample data...'; msg.style.display = 'block'; }

    const uid = () => App.uid();
    const today = new Date();
    const dateStr = (daysAgo) => { const d = new Date(today); d.setDate(d.getDate() - daysAgo); return App.ymdLocal(d); };

    // ── Settings ──
    App.data.settings.bar_name           = 'The Anchor Bar & Kitchen';
    App.data.settings.phone              = '(512) 555-0142';
    App.data.settings.address            = '1900 Barton Springs Rd';
    App.data.settings.city_state         = 'Austin, TX';
    App.data.settings.annual_bar_revenue = 624000;
    App.data.settings.annual_food_revenue= 374400;
    App.data.settings.targets = { bar_pour_cost_pct:22, food_cost_pct:32, labor_cost_pct:30, prime_cost_pct:60 };
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

    // ── 52 Weeks of Data — derived from the locked Anchor profile ──
    // Every figure traces to window.ANCHOR so Profit, Revenue and the Control
    // modules all describe one operation. Week 1 is oldest, week 52 most recent.
    // Align the seeded weeks to the app's Sunday week-ending (This Week steps by
    // Sundays via nextSunday), so This Week loads each saved week instead of
    // re-deriving it from Control. sunOff = today's weekday (0=Sun..6=Sat); the
    // most recent week ends on the last Sunday on/before today, and every daily
    // Control record shifts with it so the weekdays land correctly too.
    const sunOff = new Date(App.todayLocal() + 'T00:00:00').getDay();
    const weeks = window.ANCHOR.weeks.map(a => {
      const endDate = dateStr(sunOff + window.ANCHOR.endAgo(a));
      const bar_count = bp.map(p => {
        const used = +(Math.random()*3+0.5).toFixed(2);
        return { product_id:p.id, beg_inv:+(Math.random()*2+0.5).toFixed(1), purchases:+(Math.random()*4+1).toFixed(0), end_inv:+(Math.random()*1.5).toFixed(1), units_used:used, total_cost:+(used*p.cost_per_unit).toFixed(2) };
      });
      const bar_variance = bp.map(p => {
        const cnt = bar_count.find(c=>c.product_id===p.id);
        const actualPours = (cnt?.units_used||0) * p.pours_per_bottle;
        const theo = Math.round(actualPours * (0.95 + Math.random()*0.08));
        const varU = +(actualPours - theo).toFixed(1);
        return { product_id:p.id, actual_units:+actualPours.toFixed(1), theoretical_units:theo, variance_units:varU, variance_oz:+(varU*p.std_pour_oz).toFixed(1), variance_dollar:+(varU*p.cost_per_pour).toFixed(2), status:Math.abs(varU)<=2?'OK':(varU>0?'Over: Investigate':'Under: Investigate') };
      });
      // Catering on roughly every fifth week (an offsite or private event), merch
      // and vending as Other on every fourth, and weekly 3rd-party platform fees
      // (~4.5% of food revenue). Keeps the Books income statement non-zero + real.
      const catRev = (a.wk % 5 === 0) ? 1400 + (a.wk % 4) * 250 : 0;
      const othRev = (a.wk % 4 === 0) ? 180 + (a.wk % 3) * 60 : 0;
      return { id:uid(), week_num:a.wk, period_end:endDate, saved_at:new Date().toISOString(),
        bar:{ revenue:a.bar_rev, cogs:a.bar_cogs, labor:a.bar_labor, cost_pct:a.bar_pour_pct,
              labor_pct:a.bar_labor/a.bar_rev*100, vs_target_pct:a.bar_pour_pct-22, vs_target_dollar:((a.bar_pour_pct-22)/100)*a.bar_rev },
        food:{ revenue:a.food_rev, cogs:a.food_cogs, labor:a.food_labor, cost_pct:a.food_cost_pct,
               labor_pct:a.food_labor/a.food_rev*100, vs_target_pct:a.food_cost_pct-32, vs_target_dollar:((a.food_cost_pct-32)/100)*a.food_rev },
        catering: catRev > 0 ? { revenue:catRev, cogs:+(catRev*0.30).toFixed(2), labor:+(catRev*0.16).toFixed(2), cost_pct:30, labor_pct:16 } : { revenue:0, cogs:0, labor:0, cost_pct:0, labor_pct:0 },
        other:{ revenue:othRev, cogs:+(othRev*0.45).toFixed(2) },
        platform_fees:+(a.food_rev*0.045).toFixed(2),
        prime_cost_pct:a.prime_cost_pct, bar_count, bar_variance, food_count:[], notes:'' };
    });
    App.data.weeks = weeks;

    // Operating expenses: a realistic monthly set across the sample window so the
    // Books income statement shows true operating costs, not zeros.
    const opexMonthly = [
      ['Occupancy (Rent, Property Tax)', 12000], ['Utilities', 2600], ['Insurance', 1500],
      ['Marketing and Advertising', 1200], ['Professional Fees', 650], ['Bank and Credit Card Fees', 2100],
      ['Licenses and Permits', 300], ['Software and Subscriptions', 520], ['Other', 380]
    ];
    const opexMonths = [...new Set(weeks.map(w => String(w.period_end).slice(0, 7)))];
    const operatingExpenses = [];
    opexMonths.forEach(mk => {
      opexMonthly.forEach(([cat, amt]) => {
        operatingExpenses.push({ id:uid(), date:mk + '-05', category:cat, amount:+(amt * (0.95 + Math.random() * 0.1)).toFixed(2), vendor:'', notes:'' });
      });
    });
    // Two recurring-term bills (fixed cost + fixed term) so the page shows the
    // recurring feature with data. Bar Cop fills in each elapsed month on load.
    // The software subscription's term ends next month, so the "ending" banner
    // shows; the alarm contract runs long, so it does not.
    const monthAnchor = (back, day) => App.ymdLocal(new Date(today.getFullYear(), today.getMonth() - back, day));
    operatingExpenses.push(
      { id:uid(), date:monthAnchor(10, 5), category:'Software and Subscriptions', vendor:'Bar Cop', amount:249, notes:'Monthly software subscription.', recurring:true, term_months:12, recur_day:5, created_at:new Date().toISOString() },
      { id:uid(), date:monthAnchor(7, 5),  category:'Other',                      vendor:'Sonitrol', amount:89,  notes:'Alarm and security monitoring.', recurring:true, term_months:36, recur_day:5, created_at:new Date().toISOString() }
    );
    App.data.operating_expenses = operatingExpenses;

    // Permits and licenses: a realistic Austin bar/restaurant set so the page
    // shows the full status spread (on track, due soon, expired) and the Needs
    // Attention surface. Renewal dates are relative to today (dateStr negative =
    // future), so the statuses stay meaningful whenever sample data is loaded.
    App.data.permits_compliance = [
      { id:uid(), name:'Texas Mixed Beverage Permit', type:'Liquor License',                renewal_date:dateStr(-205), recurrence:'Annual',   cost:1500, last_renewed:dateStr(160), notes:'TABC. Permit on file with the GM.',  created_at:new Date().toISOString() },
      { id:uid(), name:'City of Austin Business License', type:'Business License',          renewal_date:dateStr(-92),  recurrence:'Annual',   cost:250,  last_renewed:dateStr(273), notes:'',                                  created_at:new Date().toISOString() },
      { id:uid(), name:'Music and Entertainment License', type:'Music / Entertainment License', renewal_date:dateStr(-138), recurrence:'Annual', cost:300, last_renewed:dateStr(227), notes:'Covers Live Music Friday.',         created_at:new Date().toISOString() },
      { id:uid(), name:'Sidewalk Cafe Permit', type:'Outdoor Seating Permit',               renewal_date:dateStr(-308), recurrence:'Annual',   cost:200,  last_renewed:dateStr(57),  notes:'Patio seating, 18 seats.',          created_at:new Date().toISOString() },
      { id:uid(), name:'Workers Compensation Policy', type:'Workers Compensation',          renewal_date:dateStr(-61),  recurrence:'Annual',   cost:4200, last_renewed:dateStr(304), notes:'',                                  created_at:new Date().toISOString() },
      { id:uid(), name:'Food Enterprise Permit', type:'Health Permit',                      renewal_date:dateStr(-23),  recurrence:'Annual',   cost:550,  last_renewed:dateStr(342), notes:'Austin Public Health.',             created_at:new Date().toISOString() },
      { id:uid(), name:'Certified Food Manager', type:'Food Service Permit',                renewal_date:dateStr(-9),   recurrence:'Biennial', cost:120,  last_renewed:dateStr(721), notes:'',                                  created_at:new Date().toISOString() },
      { id:uid(), name:'Certificate of Occupancy', type:'Fire Safety / Occupancy',          renewal_date:dateStr(7),    recurrence:'Annual',   cost:175,  last_renewed:dateStr(358), notes:'Annual fire inspection.',           created_at:new Date().toISOString() }
    ];

    // ── Dead-array seeds removed (shifts / reconciliations / vendor_log):
    //    cash recon now lives in Shift Control; these were vestigial. ──

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
        if (d.S1_MONTHLY_GAP    > 0) items.push({ action:'Reduce bar pour cost. $'+Math.round(d.S1_MONTHLY_GAP)+'/month gap vs target.', monthly_impact:d.S1_MONTHLY_GAP, gap_id:'pour-cost' });
        if (d.S3_MONTHLY_GAP    > 0) items.push({ action:'Reduce food cost. $'+Math.round(d.S3_MONTHLY_GAP)+'/month gap vs target.', monthly_impact:d.S3_MONTHLY_GAP, gap_id:'food-cost' });
        if (d.S2_MONTHLY_GAP    > 0) items.push({ action:'Address void and comp rate. $'+Math.round(d.S2_MONTHLY_GAP)+'/month in excess.', monthly_impact:d.S2_MONTHLY_GAP, gap_id:'theft-loss' });
        if (d.S4_EXPOSURE_MONTHLY > 0) items.push({ action:'Improve vendor verification. $'+Math.round(d.S4_EXPOSURE_MONTHLY)+'/month exposure.', monthly_impact:d.S4_EXPOSURE_MONTHLY, gap_id:'vendor-control' });
        // Prime cost (S5_COMBINED_COGS_GAP) already equals S1 + S3, so it is context
        // only, never a recoverable item, or Total Recoverable double-counts pour +
        // food. Mirrors audit-tracker.js extractActionItems. Do not re-add a $ here.
      } else {
        if (d.S1_SCORE != null) sections['Check Average and Revenue'] = d.S1_SCORE;
        if (d.S2_SCORE != null) sections['Labor Efficiency']          = d.S2_SCORE;
        if (d.S3_SCORE != null) sections['Menu Performance']          = d.S3_SCORE;
        if (d.S4_SCORE != null) sections['Server Performance']        = d.S4_SCORE;
        if (d.S5_SCORE != null) sections['Events and Private Dining'] = d.S5_SCORE;
        if (d.S1_MONTHLY_GAP > 0) items.push({ action:'Close check average gap. $'+Math.round(d.S1_MONTHLY_GAP)+'/month at current cover count.', monthly_impact:d.S1_MONTHLY_GAP, gap_id:'check-average' });
        if (d.S2_MONTHLY_GAP > 0) items.push({ action:'Reduce labor cost. $'+Math.round(d.S2_MONTHLY_GAP)+'/month over target.', monthly_impact:d.S2_MONTHLY_GAP, gap_id:'labor-scheduling' });
        if (d.S3_MONTHLY_GAP > 0) items.push({ action:'Improve menu mix. $'+Math.round(d.S3_MONTHLY_GAP)+'/month opportunity from repricing Dogs.', monthly_impact:d.S3_MONTHLY_GAP, gap_id:'menu-engineering' });
        if (d.S4_MONTHLY_GAP > 0) items.push({ action:'Close server performance spread. $'+Math.round(d.S4_MONTHLY_GAP)+'/month from bottom third to team average.', monthly_impact:d.S4_MONTHLY_GAP, gap_id:'server-performance' });
        if (d.S5_MONTHLY_GAP > 0) items.push({ action:'Grow event revenue. $'+Math.round(d.S5_MONTHLY_GAP)+'/month gap to target.', monthly_impact:d.S5_MONTHLY_GAP, gap_id:'events-catering' });
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
        S1_TOOL: 'Jigger every well and call drink, then watch pour variance in Spot Check.',
        S2_SCORE: 9, S2_VOID_COMP_PCT: 4.6, S2_VOID_COMP_AMT: 3827, S2_VOIDS_NO_APPROVAL_PCT: 71,
        S2_DRAWER_RECON: 'Not performed', S2_CASH_POLICY: 'No', S2_VOID_APPROVAL: 'No', S2_SPILLAGE_LOG: 'No',
        S2_MONTHLY_GAP: 2995,
        S2_NARRATIVE: 'Voids and comps reached 4.6% of sales, more than four times the 1% benchmark. 71% of voids were rung with no manager approval at all.',
        S2_FINDING: 'Two bartenders account for roughly 80% of unapproved voids. With no drawer reconciliation and no cash policy on file, there is no control gate anywhere in the cash path.',
        S2_TOOL: 'Log every void in Void and Comps and require manager authorization in Shift Policies.',
        S3_SCORE: 14, S3_FOOD_COST_PCT: 39.8, S3_TARGET_PCT: 32, S3_FOOD_REV_MONTHLY: 30800,
        S3_FOOD_VAR_PCT: 7.1, S3_FOOD_VAR_AMT: 2187, S3_RECIPE_COVERAGE: '0 of 24 plates costed',
        S3_INV_FREQ: 'Never', S3_WASTE_LOG: 'No', S3_MONTHLY_GAP: 2402, S3_ANNUAL_GAP: 28829,
        S3_NARRATIVE: 'Food cost landed at 39.8% against a 32% target. No plates are costed, inventory is never counted, and there is no waste log.',
        S3_FINDING: 'A 7.1% food variance with zero recipe coverage means portioning is uncontrolled across the line. The 7.8-point overage costs $2,402 per month.',
        S3_TOOL: 'Cost your top 10 plates in Menu Items and track food variance in the Variance Report.',
        S4_SCORE: 12, S4_BEV_INVOICE_COUNT: 9, S4_FOOD_INVOICE_COUNT: 14, S4_VENDOR_SPEND_MONTHLY: 29400,
        S4_INVOICE_VS_PO: 'Never matched', S4_PRICE_VERIFY: 'No',
        S4_EXPOSURE_MONTHLY: 1140, S4_EXPOSURE_ANNUAL: 13680,
        S4_NARRATIVE: 'Invoices are never matched against orders and prices are never verified against quoted sheets.',
        S4_FINDING: 'Sampled invoices show price drift and at least two short deliveries that were paid in full. That works out to roughly $1,140 of monthly exposure, with no backup vendor to put pressure on prices.',
        S4_TOOL: 'Match every delivery to its order in Receive Delivery and file shortfalls in Vendor Tracker.',
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
        S6_SIG1_TOOL: 'Run a Spot Check on those bottles every close for two weeks.',
        S6_SIG2_SCORE: 'HIGH', S6_SIG2_LABEL: 'Void concentration',
        S6_SIG2_EVIDENCE: '71% of voids were rung without a manager code; two bartenders account for 80% of them.',
        S6_SIG2_GAP: 'Pattern is consistent with comped-drink theft, not training error.',
        S6_SIG2_TOOL: 'Log voids in Void and Comps and review the unapproved ones in Loss Prevention.',
        S6_SIG3_SCORE: 'MEDIUM', S6_SIG3_LABEL: 'No closing inventory counts',
        S6_SIG3_EVIDENCE: 'No end-of-night liquor counts were recorded in the audit period.',
        S6_SIG3_GAP: 'Variance cannot be isolated to a shift or a person.',
        S6_SIG3_TOOL: 'Run a closing Spot Check every night so variance ties to a shift.',
        S6_SIG4_SCORE: 'MEDIUM', S6_SIG4_LABEL: 'Unrestricted comp authority',
        S6_SIG4_EVIDENCE: 'Every server can comp without a limit or a reason code.',
        S6_SIG4_GAP: 'Comp dollars are untracked and untrainable.',
        S6_SIG4_TOOL: 'Set a comp authorization threshold in Shift Policies.'
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
        S2_TOOL: 'Set your cash policy in Shift Policies and log breakage in Waste and Spills.',
        S3_SCORE: 35, S3_FOOD_COST_PCT: 36.4, S3_TARGET_PCT: 32, S3_FOOD_REV_MONTHLY: 31600,
        S3_FOOD_VAR_PCT: 4.8, S3_FOOD_VAR_AMT: 1517, S3_RECIPE_COVERAGE: '16 of 24 plates costed',
        S3_INV_FREQ: 'Monthly', S3_WASTE_LOG: 'Started', S3_MONTHLY_GAP: 1390, S3_ANNUAL_GAP: 16685,
        S3_NARRATIVE: 'Food cost improved to 36.4% as recipe costing reached two-thirds of the menu.',
        S3_FINDING: 'Monthly counts replaced never-counting and a waste log is now in place. The remaining 4.4-point gap is $1,390 per month, mostly on the eight uncosted plates.',
        S3_TOOL: 'Finish the last eight plate cards and move counts from monthly to weekly.',
        S4_SCORE: 44, S4_BEV_INVOICE_COUNT: 10, S4_FOOD_INVOICE_COUNT: 15, S4_VENDOR_SPEND_MONTHLY: 28900,
        S4_INVOICE_VS_PO: 'Spot checked', S4_PRICE_VERIFY: 'Started',
        S4_EXPOSURE_MONTHLY: 610, S4_EXPOSURE_ANNUAL: 7320,
        S4_NARRATIVE: 'Invoice spot-checking caught two billing errors this period and price verification has begun.',
        S4_FINDING: 'Exposure fell to about $610 per month. One backup vendor is identified, but vendor price changes are not yet caught on every delivery.',
        S4_TOOL: 'Match every delivery in Receive Delivery, not a sample, and track price drift in Vendor Tracker.',
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
        S6_SIG2_TOOL: 'Review the Void and Comps log weekly and watch the two flagged bartenders in Loss Prevention.',
        S6_SIG3_SCORE: 'MEDIUM', S6_SIG3_LABEL: 'No spillage log',
        S6_SIG3_EVIDENCE: 'Breakage and spillage are still not recorded anywhere.',
        S6_SIG3_GAP: 'Legitimate loss cannot be separated from variance.',
        S6_SIG3_TOOL: 'Start logging breakage in Waste and Spills this week.'
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
        S2_FINDING: 'The cash policy is finalized, drawers are reconciled at close, and a spillage log is running. Breakage now separates cleanly from theft.',
        S2_TOOL: 'Review the Void and Comps log monthly and refresh staff training each quarter.',
        S3_SCORE: 54, S3_FOOD_COST_PCT: 33.8, S3_TARGET_PCT: 32, S3_FOOD_REV_MONTHLY: 31300,
        S3_FOOD_VAR_PCT: 2.9, S3_FOOD_VAR_AMT: 908, S3_RECIPE_COVERAGE: '24 of 24 plates costed',
        S3_INV_FREQ: 'Weekly', S3_WASTE_LOG: 'Yes', S3_MONTHLY_GAP: 563, S3_ANNUAL_GAP: 6761,
        S3_NARRATIVE: 'Food cost is 33.8%, within two points of target, with the full menu costed and weekly counts in place.',
        S3_FINDING: 'Food variance of 2.9% is acceptable. The remaining gap is small enough to close with targeted repricing on two plowhorse plates.',
        S3_TOOL: 'Use Menu Engineering to reprice the two lowest-margin plates.',
        S4_SCORE: 56, S4_BEV_INVOICE_COUNT: 11, S4_FOOD_INVOICE_COUNT: 16, S4_VENDOR_SPEND_MONTHLY: 27600,
        S4_INVOICE_VS_PO: 'Matched on every delivery', S4_PRICE_VERIFY: 'Yes',
        S4_EXPOSURE_MONTHLY: 210, S4_EXPOSURE_ANNUAL: 2520,
        S4_NARRATIVE: 'Every delivery is now matched to its order and prices are verified against quoted sheets.',
        S4_FINDING: 'Exposure has fallen to about $210 per month. Every delivery is matched to its order and price drift is tracked in Vendor Tracker, with two backup vendors per category.',
        S4_TOOL: 'Keep matching deliveries and reviewing price changes in Vendor Tracker.',
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
        S6_SIG1_TOOL: 'Run a weekly Spot Check on measured pours.',
        S6_SIG2_SCORE: 'MEDIUM', S6_SIG2_LABEL: 'Vendor price drift unreviewed',
        S6_SIG2_EVIDENCE: 'Two vendors logged price increases this period that have not been reviewed.',
        S6_SIG2_GAP: 'Small price increases quietly give back the margin you just recovered.',
        S6_SIG2_TOOL: 'Review the Price Changes tab in Vendor Tracker each month.'
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
        S1_TOOL: 'Set a floor upsell standard and track check average in Server Check each week.',
        S2_SCORE: 28, S2_LABOR_PCT: 37.5, S2_LABOR_TARGET_PCT: 30, S2_RPLH: 58, S2_RPLH_TARGET: 75,
        S2_LABOR_PERIOD: 30788, S2_SCHED_VS_ACTUAL: '214 scheduled / 247 actual hrs', S2_OVERTIME_HRS: 41,
        S2_MONTHLY_GAP: 6158,
        S2_NARRATIVE: 'Total labor ran 37.5% against a 30% target. Actual hours overran the schedule by 33 hours and 41 of those were overtime.',
        S2_FINDING: 'RPLH of $58 is well short of the $75 target. The floor is overstaffed on slow shifts and clock-out discipline is loose.',
        S2_TOOL: 'Build the schedule against your labor target in Build Schedule and watch Overtime Watch.',
        S3_SCORE: 24, S3_STARS_COUNT: 3, S3_PLOWHORSES_COUNT: 9, S3_DOGS_COUNT: 7, S3_PUZZLES_COUNT: 5,
        S3_TOP_CATEGORY: 'Draft Beer', S3_MONTHLY_GAP: 1820, S3_PRICING_OPPORTUNITY: 2640,
        S3_NARRATIVE: 'The menu carries seven Dogs against only three Stars.',
        S3_FINDING: 'Revenue leans on low-margin draft beer. Repricing or cutting Dogs and promoting Stars is a $1,820/month mix opportunity, with $2,640 more available from pricing.',
        S3_TOOL: 'Use Menu Engineering and the Dog Test Tracker to rework the seven Dog items.',
        S4_SCORE: 30, S4_SERVER_COUNT: 9, S4_TOP_CHECK_AVG: 38.60, S4_BOTTOM_CHECK_AVG: 21.40,
        S4_PERFORMANCE_SPREAD: 17.20, S4_APP_ATTACH_RATE: 19, S4_DESSERT_ATTACH_RATE: 6,
        S4_PRESHIFT_BRIEFING: 'Not held', S4_MONTHLY_GAP: 3960,
        S4_NARRATIVE: 'The spread between the top and bottom server check average is $17.20. That is a coaching gap, not a talent gap.',
        S4_FINDING: 'Appetizer attach sits at 19% and dessert at 6%. With no pre-shift briefing, the bottom third is never coached. Lifting them to the team average is worth $3,960/month.',
        S4_TOOL: 'Start a daily pre-shift briefing and track each server in Server Check.',
        S5_SCORE: 18, S5_EVENT_REV_PERIOD: 2400, S5_EVENTS_PER_MONTH: 1, S5_AVG_EVENT_REVENUE: 2400,
        S5_MINIMUM_MET: false, S5_CATERING_REV_PERIOD: 0, S5_ANNUAL_EVENT_GAP: 64800, S5_MONTHLY_GAP: 5400,
        S5_NARRATIVE: 'Events brought in $2,400 from a single booking. There is no private dining minimum and no catering revenue at all.',
        S5_FINDING: 'For a venue this size, three to four events a month is realistic. The unbuilt event channel is the largest single opportunity in this audit at $5,400/month.',
        S5_TOOL: 'Build a private dining package in Events with a spend minimum and a rate card.',
        S6_SIG1_SCORE: 'HIGH', S6_SIG1_LABEL: 'Server comp concentration',
        S6_SIG1_EVIDENCE: 'One server accounts for 54% of comped checks over the audit period.',
        S6_SIG1_GAP: 'Pattern is consistent with discount abuse, not service recovery.',
        S6_SIG1_TOOL: 'Review comps by server in Loss Prevention and set a comp authorization threshold in Shift Policies.',
        S6_SIG2_SCORE: 'HIGH', S6_SIG2_LABEL: 'Saturday floor overstaffed',
        S6_SIG2_EVIDENCE: 'Saturday floor RPLH ran $48 against a $75 target while weeknight RPLH hit $72.',
        S6_SIG2_GAP: 'About $720 per Saturday in excess labor.',
        S6_SIG2_TOOL: 'Drop one server from the Saturday floor for two weeks and watch RPLH on This Week.',
        S6_SIG3_SCORE: 'MEDIUM', S6_SIG3_LABEL: 'One menu item drives complaints',
        S6_SIG3_EVIDENCE: 'House Burger appears in 41% of negative comments and 18% of comps.',
        S6_SIG3_GAP: 'Build, portion, or price is off.',
        S6_SIG3_TOOL: 'Spec-check the burger every shift for a week and review its build in Menu Items.',
        S6_SIG4_SCORE: 'MEDIUM', S6_SIG4_LABEL: 'No pre-shift briefings',
        S6_SIG4_EVIDENCE: 'No briefings logged in the audit period.',
        S6_SIG4_GAP: 'Bottom-third servers get no daily coaching.',
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
        S1_NARRATIVE: 'Check average climbed to $30.20, with bar checks up $2.50, the strongest move.',
        S1_FINDING: 'The blend is now $1.80 short of target. Dessert and after-dinner drinks are the weakest add-ons, where most of the remaining gap sits.',
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
        S1_FINDING: 'Bar checks are up $5.30 from the February baseline and holding above target.',
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
        S6_SIG2_GAP: 'The smallest remaining lift on your check average.',
        S6_SIG2_TOOL: 'Run a one-month dessert-attach contest with a server prize.',
        S6_SIG3_SCORE: 'LOW', S6_SIG3_LABEL: 'Events at venue ceiling',
        S6_SIG3_EVIDENCE: 'Five events per month is near peak-season capacity.',
        S6_SIG3_GAP: 'Growing further requires a second Saturday slot or off-site catering.',
        S6_SIG3_TOOL: 'Add a Friday and Saturday early-dining slot and price it.'
      }})
    ];

    // ════════════════════════════════════════════════════════════════════
    //  REVENUE RECOVERY — the Anchor's revenue side, all traced to
    //  window.ANCHOR: fifty-two weekly records, the menu, server checks,
    //  events, dog tests and the price-change log.
    // ════════════════════════════════════════════════════════════════════
    App.data.revenue_settings = App.data.revenue_settings || {};
    App.data.revenue_settings.targets = { check_avg:35, rplh_lunch:50, rplh_dinner:75, rplh_bar:65, event_close_rate:40 };

    // Four servers carry the floor. Each week's covers split by these weights,
    // with the top server running a higher check average than the bottom.
    const rServers     = ['Jessica M.','Marcus T.','Brianna K.','Priya N.'];
    const rSrvWeight   = [0.30, 0.26, 0.24, 0.20];
    const rSrvCheckMul = [1.14, 1.04, 0.96, 0.86];

    App.data.revenue_weeks = window.ANCHOR.weeks.map(a => {
      const dep   = window.ANCHOR.laborDepts(a);
      const hours = a.bar_labor/16 + dep.kitchen/15 + dep.floor/14;
      return {
        id:uid(), week_num:a.wk, period_end:dateStr(sunOff + window.ANCHOR.endAgo(a)),
        bar_revenue:a.bar_rev, floor_revenue:a.food_rev, covers:a.covers, check_avg:a.check_avg,
        total_labor_cost:a.bar_labor + a.food_labor, total_hours:+hours.toFixed(1),
        labor_pct_blended:a.labor_pct_blended, rplh_blended:+(a.total_rev / hours).toFixed(2),
        notes:'', saved_at:new Date().toISOString()
      };
    });

    // ── Revenue Forecasts — one record per Monday for the last 6 weeks plus
    // the coming week. Each weekly forecast is built from the same actuals
    // we just generated, with a small ±4% nudge so the operator-facing
    // "vs Forecast" tile shows a realistic variance rather than a zero.
    // Per-day split uses the same weekday-weight curve other sample data uses
    // (heavier Fri/Sat, lighter Mon/Tue).
    const fcDayWeights = { Mon:0.10, Tue:0.10, Wed:0.12, Thu:0.13, Fri:0.18, Sat:0.22, Sun:0.15 };
    const fcDays       = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const monStartFor  = (dStr) => {
      const d = new Date(dStr + 'T00:00:00');
      const wd = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - wd);
      return App.ymdLocal(d);
    };
    // Covers forecast derives from the revenue forecast at the Anchor's blended
    // check average. Active Shift reads covers_per_day for its Cover Goal.
    const AVG_CHECK = 38;
    const coversFor = (pd) => { const c = {}; fcDays.forEach(d => { c[d] = Math.round((pd[d] || 0) / AVG_CHECK); }); return c; };
    const totalCoversOf = (cpd) => fcDays.reduce((t, d) => t + (cpd[d] || 0), 0);
    const lastSix = App.data.revenue_weeks.slice(-6);
    App.data.revenue_forecasts = lastSix.map((wk, i) => {
      // Forecast was set the Saturday BEFORE the week, so it's a forward
      // projection that landed close to but not exactly on actuals.
      const total = (wk.bar_revenue + wk.floor_revenue) * (i % 2 === 0 ? 0.96 : 1.04);
      const per_day = {};
      fcDays.forEach(d => { per_day[d] = Math.round(total * fcDayWeights[d]); });
      const covers_per_day = coversFor(per_day);
      const week_start = monStartFor(wk.period_end);
      return {
        id: uid(),
        week_start,
        per_day,
        covers_per_day,
        total: +total.toFixed(2),
        total_covers: totalCoversOf(covers_per_day),
        method: 'manual',
        notes: '',
        created_at: new Date(week_start + 'T18:00:00').toISOString(),
        updated_at: new Date(week_start + 'T18:00:00').toISOString()
      };
    });
    // Plus a coming-week forecast so the schedule builder has something to read
    // when the operator opens it on the demo data.
    (() => {
      const last = App.data.revenue_weeks[App.data.revenue_weeks.length - 1];
      const ref  = (last.bar_revenue + last.floor_revenue) * 1.02;
      const monAt = (offsetWeeks) => {
        const d = new Date();
        const wd = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - wd + offsetWeeks * 7);
        return App.ymdLocal(d);
      };
      const per_day = {};
      fcDays.forEach(d => { per_day[d] = Math.round(ref * fcDayWeights[d]); });
      const covers_per_day = coversFor(per_day);
      const mk = (week_start, notes) => ({
        id: uid(), week_start, per_day: { ...per_day }, covers_per_day: { ...covers_per_day },
        total: +ref.toFixed(2), total_covers: totalCoversOf(covers_per_day),
        method: 'manual', notes,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      });
      // Current week feeds Active Shift's Cover Goal; the coming week feeds the
      // schedule builder.
      App.data.revenue_forecasts.push(mk(monAt(0), ''));
      App.data.revenue_forecasts.push(mk(monAt(1), ''));
    })();

    // ── Menu — the Anchor's full card, costed for Menu Engineering ──
    const rMenu = [
      // Plate Items tab — food only (valid plate categories: Appetizers,
      // Entrees, Desserts, Specials). Beer + wine are NOT plate items; they are
      // added below as linked Inventory menu items once ic_products exists.
      ['Loaded Nachos',        'Appetizers', 12, 3.60,  95],
      ['Smoked Wings',         'Appetizers', 13, 4.20, 110],
      ['Fried Pickles',        'Appetizers',  8, 1.80,  58],
      ['Pretzel Bites',        'Appetizers',  9, 2.10,  40],
      ['Deviled Eggs',         'Appetizers',  9, 2.10,  64],
      ['Charcuterie Board',    'Appetizers', 18, 7.20,  48],
      ['Crispy Brussels',      'Appetizers', 11, 2.80,  72],
      ['Hummus and Flatbread', 'Appetizers', 10, 2.40,  50],
      ['Calamari',             'Appetizers', 14, 4.60,  66],
      ['Street Corn Ribs',     'Appetizers', 10, 2.30,  54],
      ['Tuna Poke',            'Appetizers', 16, 6.40,  44],
      ['Truffle Fries',        'Appetizers',  8, 1.90, 120],
      ['House Salad',          'Appetizers',  7, 1.60,  70],
      ['Mac and Cheese',       'Appetizers',  9, 2.40,  64],
      ['Avocado Toast',        'Appetizers', 12, 3.00,  78],
      ['Breakfast Tacos',      'Appetizers', 11, 2.80, 110],
      ['Anchor Burger',        'Entrees',    16, 4.80, 140],
      ['Brisket Sandwich',     'Entrees',    15, 5.20,  88],
      ['Fish and Chips',       'Entrees',    17, 5.60,  52],
      ['Chicken Caesar',       'Entrees',    14, 3.90,  70],
      ['Steak Frites',         'Entrees',    26, 9.10,  38],
      ['Veggie Grain Bowl',    'Entrees',    13, 3.20,  30],
      ['Shrimp Tacos',         'Entrees',    16, 5.40,  84],
      ['Grilled Pork Chop',    'Entrees',    27, 8.80,  36],
      ['Pan-Seared Salmon',    'Entrees',    25, 8.20,  58],
      ['Braised Short Rib',    'Entrees',    29, 9.60,  42],
      ['Mushroom Risotto',     'Entrees',    19, 5.10,  34],
      ['Chicken and Waffles',  'Entrees',    16, 4.80,  92],
      ['Brunch Burger',        'Entrees',    15, 4.60,  70],
      ['Shakshuka',            'Entrees',    14, 3.90,  46],
      ['Skillet Cookie',       'Desserts',    8, 1.90,  48],
      ['Key Lime Pie',         'Desserts',    7, 1.70,  30],
      ['Creme Brulee',         'Desserts',    9, 2.10,  44],
      ['Chocolate Torte',      'Desserts',    9, 2.30,  38],
      // Cocktail Items tab — composed drinks (category 'Cocktails').
      ['Old Fashioned',        'Cocktails',  12, 2.40, 130],
      ['House Margarita',      'Cocktails',  11, 2.10, 145],
      ['Espresso Martini',     'Cocktails',  13, 2.90,  78],
      ['Paloma',               'Cocktails',  11, 2.20,  62],
      ['Negroni',              'Cocktails',  13, 2.60,  74],
      ['Whiskey Sour',         'Cocktails',  12, 2.30,  88],
      ['Manhattan',            'Cocktails',  14, 2.80,  66],
      ['Mezcal Mule',          'Cocktails',  13, 2.70,  58],
      ['Spicy Margarita',      'Cocktails',  12, 2.30, 112],
      ['French 75',            'Cocktails',  13, 2.60,  48],
      ['Mojito',               'Cocktails',  11, 2.10,  70],
      ['Boulevardier',         'Cocktails',  14, 2.90,  40],
      ['Aviation',             'Cocktails',  13, 2.70,  36],
      ['Cosmopolitan',         'Cocktails',  12, 2.40,  52],
    ].map(m => ({ id:uid(), name:m[0], category:m[1], price:m[2], cost:m[3], weekly_covers:m[4], notes:'', recipe:null, created_at:new Date().toISOString(), updated_at:new Date().toISOString() }));
    App.data.menu_items = rMenu;
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

    // ════════════════════════════════════════════════════════════════════
    //  EVENTS — the Anchor's bookings pipeline, regulars book, rate card, and
    //  planning calendar. One unified booking record per party (lead -> quote
    //  -> booked -> completed/lost). In-house events show $0 labor until staff
    //  are checked to them in Build Schedule; offsite catering feeds This Week.
    // ════════════════════════════════════════════════════════════════════
    const monthDay = (day) => { const d = new Date(today); d.setDate(day); return App.ymdLocal(d); };
    const offMonth = (n, day) => { const d = new Date(today); d.setMonth(d.getMonth() + n, day); return App.ymdLocal(d); };

    App.data.bookings = [
      { id:uid(), stage:'Completed', event_name:'Reyes Rehearsal Dinner', event_type:'Rehearsal Dinner',
        contact_name:'Marisol Reyes', contact_phone:'512-555-0148', contact_email:'mreyes@example.com', source:'Referral',
        date_received:dateStr(72), event_date:dateStr(38), event_time:'6:30 PM', party_size:34, space:'Private Room',
        fb_minimum:2200, per_head:0, quoted_total:2840, deposit_amount:800, deposit_paid_date:dateStr(60), balance_paid_date:dateStr(37),
        actual_revenue:2840, event_food_cost:760, event_bar_cost:520, event_other_cost:0,
        requests:'Family-style, one toast mid-dinner.', created_at:daysAgoISO(72) },
      { id:uid(), stage:'Completed', event_name:'Live Music Friday', event_type:'Other',
        contact_name:'', contact_phone:'', contact_email:'', source:'',
        date_received:dateStr(21), event_date:dateStr(3), event_time:'8:00 PM', party_size:0, space:'Main Floor',
        fb_minimum:0, per_head:0, quoted_total:0, deposit_amount:0,
        actual_revenue:3200, event_food_cost:0, event_bar_cost:820, event_other_cost:350,
        requests:'Trio plays 8 to 11. Revenue is the night\'s take, the band is the other cost.', created_at:daysAgoISO(21) },
      { id:uid(), stage:'Completed', event_name:'Westlake Realty Lunch Catering', event_type:'Catering (Offsite)',
        contact_name:'Dana Whitfield', contact_phone:'512-555-0173', contact_email:'dana@westlakerealty.example', source:'Email',
        date_received:dateStr(12), event_date:dateStr(2), event_time:'12:00 PM', party_size:45, space:'Offsite',
        fb_minimum:0, per_head:35, quoted_total:1575, deposit_amount:400, deposit_paid_date:dateStr(8), balance_paid_date:dateStr(1),
        actual_revenue:1575, event_food_cost:430, event_bar_cost:0, event_other_cost:180,
        requests:'Boxed lunches delivered to their office.', created_at:daysAgoISO(12) },
      { id:uid(), stage:'Booked', event_name:'Hargrove 40th Birthday', event_type:'Birthday',
        contact_name:'Tom Hargrove', contact_phone:'512-555-0119', contact_email:'thargrove@example.com', source:'Walk-in',
        date_received:dateStr(15), event_date:dateStr(-9), event_time:'7:00 PM', party_size:28, space:'Private Room',
        fb_minimum:1800, per_head:0, quoted_total:2100, deposit_amount:500, deposit_paid_date:dateStr(10),
        actual_revenue:0, event_food_cost:0, event_bar_cost:0, event_other_cost:0,
        requests:'Surprise. Cake drop at 8.', created_at:daysAgoISO(15) },
      { id:uid(), stage:'Booked', event_name:'Keller Saturday Buyout', event_type:'Buyout',
        contact_name:'Priya Keller', contact_phone:'512-555-0162', contact_email:'pkeller@example.com', source:'OpenTable/Resy',
        date_received:dateStr(9), event_date:dateStr(-21), event_time:'5:00 PM', party_size:90, space:'Full Buyout',
        fb_minimum:6000, per_head:0, quoted_total:6800, deposit_amount:1500,
        actual_revenue:0, event_food_cost:0, event_bar_cost:0, event_other_cost:0,
        requests:'Full buyout, passed apps then seated.', created_at:daysAgoISO(9) },
      { id:uid(), stage:'Quote Sent', event_name:'Downtown Tech Mixer', event_type:'Corporate',
        contact_name:'Jordan Bell', contact_phone:'512-555-0185', contact_email:'jbell@example.com', source:'Website Form',
        date_received:dateStr(5), event_date:dateStr(-34), event_time:'6:00 PM', party_size:60, space:'Patio and Bar',
        fb_minimum:3000, per_head:60, quoted_total:3600, deposit_amount:0,
        actual_revenue:0, event_food_cost:0, event_bar_cost:0, event_other_cost:0,
        requests:'Open bar two hours, passed apps.', created_at:daysAgoISO(5) },
      { id:uid(), stage:'Lead', event_name:'Nguyen Baby Shower', event_type:'Bridal/Baby Shower',
        contact_name:'Lan Nguyen', contact_phone:'512-555-0137', contact_email:'lnguyen@example.com', source:'Phone',
        date_received:dateStr(2), event_date:dateStr(-45), event_time:'2:00 PM', party_size:22, space:'Private Room',
        fb_minimum:0, per_head:0, quoted_total:0, deposit_amount:0,
        actual_revenue:0, event_food_cost:0, event_bar_cost:0, event_other_cost:0,
        requests:'Daytime, non-alcoholic punch option.', created_at:daysAgoISO(2) },
      { id:uid(), stage:'Lead', event_name:'Acme Holiday Party', event_type:'Holiday Party',
        contact_name:'Rob Castellano', contact_phone:'512-555-0151', contact_email:'rob@acme.example', source:'Phone',
        date_received:dateStr(6), event_date:dateStr(-70), event_time:'7:00 PM', party_size:70, space:'Full Buyout',
        fb_minimum:0, per_head:0, quoted_total:0, deposit_amount:0,
        actual_revenue:0, event_food_cost:0, event_bar_cost:0, event_other_cost:0,
        requests:'Company party in December, wants a quote.', created_at:daysAgoISO(6) },
      { id:uid(), stage:'Lost', event_name:'Riverside Wedding Block', event_type:'Rehearsal Dinner',
        contact_name:'Emily Park', contact_phone:'512-555-0190', contact_email:'epark@example.com', source:'Referral',
        date_received:dateStr(28), event_date:dateStr(-55), event_time:'6:00 PM', party_size:40, space:'Private Room',
        fb_minimum:2500, per_head:0, quoted_total:2900, deposit_amount:0, lost_reason:'Booked the steakhouse downtown over room layout.',
        actual_revenue:0, event_food_cost:0, event_bar_cost:0, event_other_cost:0,
        requests:'', created_at:daysAgoISO(28) },
    ];

    App.data.event_rate_cards = [
      { id:uid(), package_name:'Weeknight Private Room', event_type:'Private Dining', min_covers:15, max_covers:40, fb_minimum:1500, room_fee:0,   per_head:55 },
      { id:uid(), package_name:'Saturday Full Buyout',   event_type:'Buyout',        min_covers:60, max_covers:110, fb_minimum:6000, room_fee:500, per_head:75 },
      { id:uid(), package_name:'Offsite Catering',       event_type:'Catering (Offsite)', min_covers:20, max_covers:200, fb_minimum:0, room_fee:0, per_head:32 },
    ];

    App.data.event_regulars = [
      { id:uid(), name:'Carla Mendez',   contact_phone:'512-555-0211', contact_email:'carla.m@example.com', birthday:monthDay(8),  anniversary:offMonth(4,12), drink_prefs:'Negroni, then a mezcal old fashioned', last_visit:dateStr(4),  vip:true,  notes:'Sits at the corner of the bar.' , created_at:daysAgoISO(120) },
      { id:uid(), name:'Derek Hollis',   contact_phone:'512-555-0224', contact_email:'dhollis@example.com',  birthday:monthDay(19), anniversary:offMonth(7,3),  drink_prefs:'Tito\'s soda, lime. No IPAs.',         last_visit:dateStr(9),  vip:false, notes:'' , created_at:daysAgoISO(110) },
      { id:uid(), name:'Sofia Reyes',    contact_phone:'512-555-0238', contact_email:'sofia.r@example.com',  birthday:monthDay(27), anniversary:offMonth(2,18), drink_prefs:'Natural wine, skin contact',           last_visit:dateStr(2),  vip:true,  notes:'Industry. Comes in late.' , created_at:daysAgoISO(95) },
      { id:uid(), name:'Marcus Webb',    contact_phone:'512-555-0245', contact_email:'mwebb@example.com',    birthday:offMonth(3,14), anniversary:monthDay(12), drink_prefs:'Bourbon neat, Buffalo Trace or better', last_visit:dateStr(18), vip:false, notes:'' , created_at:daysAgoISO(140) },
      { id:uid(), name:'Priya Anand',    contact_phone:'512-555-0259', contact_email:'panand@example.com',   birthday:offMonth(5,9),  anniversary:monthDay(22), drink_prefs:'Gin martini, extra olives',            last_visit:dateStr(75), vip:false, notes:'Used to come weekly, slowed down.' , created_at:daysAgoISO(160) },
      { id:uid(), name:'Tom & Ana Briggs',contact_phone:'512-555-0263',contact_email:'briggs@example.com',  birthday:'', anniversary:monthDay(5), drink_prefs:'A bottle of Sancerre',                          last_visit:dateStr(11), vip:true,  notes:'Date-night regulars on Thursdays.' , created_at:daysAgoISO(200) },
      { id:uid(), name:'Jamal Carter',   contact_phone:'512-555-0271', contact_email:'jcarter@example.com',  birthday:offMonth(8,21), anniversary:'', drink_prefs:'Hazy IPA, whatever is freshest',                last_visit:dateStr(6),  vip:false, notes:'' , created_at:daysAgoISO(80) },
      { id:uid(), name:'Helen Vance',    contact_phone:'512-555-0288', contact_email:'hvance@example.com',   birthday:offMonth(1,3),  anniversary:offMonth(9,16), drink_prefs:'Espresso martini',                   last_visit:dateStr(92), vip:false, notes:'Gone quiet, was a Friday regular.' , created_at:daysAgoISO(175) },
      { id:uid(), name:'Owen Fitzgerald',contact_phone:'512-555-0294', contact_email:'owenf@example.com',    birthday:monthDay(14), anniversary:'', drink_prefs:'Guinness, then a Jameson',                       last_visit:dateStr(3),  vip:false, notes:'' , created_at:daysAgoISO(60) },
      { id:uid(), name:'Renee Cho',      contact_phone:'512-555-0303', contact_email:'rcho@example.com',     birthday:offMonth(6,28), anniversary:offMonth(3,2), drink_prefs:'Low-ABV spritz, Aperol',              last_visit:dateStr(14), vip:false, notes:'' , created_at:daysAgoISO(70) },
      { id:uid(), name:'Greg Pulaski',   contact_phone:'512-555-0317', contact_email:'gpulaski@example.com', birthday:offMonth(10,11), anniversary:'', drink_prefs:'Manhattan, rye, up',                          last_visit:dateStr(120),vip:false, notes:'Win-back: has not been in months.' , created_at:daysAgoISO(190) },
      { id:uid(), name:'Bianca Russo',   contact_phone:'512-555-0322', contact_email:'brusso@example.com',   birthday:offMonth(2,7),  anniversary:offMonth(11,19), drink_prefs:'Margarita, Espolon, Tajin rim',     last_visit:dateStr(7),  vip:true,  notes:'Brings big groups on weekends.' , created_at:daysAgoISO(130) },
    ];

    App.data.event_calendar = [
      { id:uid(), date:dateStr(-5),  name:'Industry Night Launch', type:'Promotion',   checklist:{ menu:true,  promo:false, staffing:true,  reservations:false }, notes:'Mondays. Comp the first round for service industry.' },
      { id:uid(), date:dateStr(-12), name:'Local Music Festival',  type:'Local Event', checklist:{ menu:true,  promo:true,  staffing:false, reservations:false }, notes:'Festival crowd spills over. Staff up the patio.' },
      { id:uid(), date:dateStr(-18), name:'Big Game Sunday',       type:'Big Game',    checklist:{ menu:true,  promo:true,  staffing:true,  reservations:true  }, notes:'Wing and bucket specials. All hands.' },
      { id:uid(), date:dateStr(-40), name:'Patio Season Kickoff',  type:'Promotion',   checklist:{ menu:false, promo:false, staffing:false, reservations:false }, notes:'' },
    ];

    // ════════════════════════════════════════════════════════════════════
    //  TRAFFIC RECOVERY — the Anchor's digital presence over 12 weeks plus
    //  a three-audit recovery arc and a complete scorecard profile.
    // ════════════════════════════════════════════════════════════════════
    App.data.traffic_settings = App.data.traffic_settings || {};
    App.data.traffic_settings.targets = { google_rating:4.3, review_velocity:8,
      response_rate:75, monthly_sessions:3000, social_posts_month:12 };
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
      web_exists:true, web_mobile:true, web_menu:true, web_online_order:true, web_reservations:true, web_analytics:true,
      web_avg_duration:96, web_top_source:'Organic Search', web_reviewed_at:daysAgoISO(7),
      // Social
      social_stories:true, social_reels:true, social_ig_engagement:2.4, social_fb_posts:6,
      social_content_mix:'Balanced', social_reviewed_at:daysAgoISO(5),
      // Delivery
      dd_active:'yes', dd_rating:4.6, dd_photos:26, dd_menu:true, dd_promo:true,
      ue_active:'yes', ue_rating:4.4, ue_photos:22, ue_menu:true, ue_promo:false,
      gh_active:'no', gh_photos:null, gh_menu:false, gh_promo:false,
      delivery_reviewed_at:daysAgoISO(8),
      // Email and loyalty
      email_last_send:dateStr(5), email_frequency:'Weekly', email_growth:'WiFi login capture',
      email_reviewed_at:daysAgoISO(5)
    };

    // ── Traffic weeks — recovery arc, oldest to newest ──
    // Five tracked-metric series (monthly_sessions, gbp_views, social_profile_visits,
    // email_list_size+open_rate, delivery_orders+avg_order_value) hold flat through
    // the first ~5-7 weeks then climb after the matching fix dates seeded below in
    // fix_log. That gives the Traffic Recovery Scoreboard real before/after data so
    // every tracked gap dollarizes on demo. Reviews and SEO stay untracked (Rule
    // 14a — too indirect to defend) and ride along as context.
    const tw = {
      google_rating:        [3.9,3.9,4.0,4.0,4.1,4.1,4.2,4.3,4.3,4.4,4.5,4.5],
      google_total:         [240,246,253,261,268,275,284,293,302,310,318,326],
      new_reviews:          [3,4,4,5,5,6,8,9,9,10,11,11],
      response_rate:        [38,42,48,54,60,68,74,78,82,84,86,88],
      yelp_rating:          [3.7,3.7,3.8,3.8,3.8,3.9,3.9,4.0,4.0,4.0,4.1,4.1],
      yelp_total:           [80,81,83,84,86,88,90,92,95,98,101,104],
      monthly_sessions:     [1180,1240,1300,1380,1480,1620,1780,1940,2080,2200,2320,2420],
      monthly_reservations: [95,100,108,115,122,130,138,145,152,158,164,170],
      bounce_rate:          [74,73,72,70,68,66,64,62,60,58,57,56],
      gbp_views:            [1500,1520,1540,1560,1580,1680,1820,1980,2120,2240,2340,2400],
      ig_followers:         [1880,1920,1965,2010,2060,2120,2200,2280,2360,2440,2520,2600],
      ig_posts_month:       [5,6,6,7,8,9,10,11,12,13,14,14],
      fb_followers:         [1050,1060,1075,1085,1100,1115,1135,1155,1175,1195,1215,1240],
      social_profile_visits:[260,265,270,280,290,300,340,400,460,510,560,600],
      dd_rating:            [4.2,4.2,4.3,4.3,4.3,4.4,4.4,4.5,4.5,4.5,4.6,4.6],
      ue_rating:            [4.0,4.0,4.1,4.1,4.1,4.2,4.2,4.3,4.3,4.3,4.4,4.4],
      delivery_orders:      [120,122,125,128,130,132,135,148,162,178,190,200],
      delivery_avg_order_value:[28,28,29,29,29,30,30,31,32,33,34,36],
      email_list_size:      [380,410,445,480,520,560,605,650,690,720,745,760],
      emails_sent:          [1,1,2,2,2,3,3,3,4,4,4,4],
      email_open_rate:      [18,19,20,21,22,24,25,26,27,27,28,28],
    };
    // The traffic metrics above are a 12-week hand-authored series (separate from
    // the 52-week P&L arc). Map them onto the most recent 12 weeks so recent
    // traffic reads full and older weeks stay realistically empty until the
    // Traffic sweep extends the series to a full year.
    const twN = tw.google_rating.length;
    App.data.traffic_weeks = window.ANCHOR.weeks.slice(-twN).map((a, i) => ({
      id: Date.now() + i, week_num: a.wk, period_end: dateStr(sunOff + window.ANCHOR.endAgo(a)),
      saved_at: new Date().toISOString(),
      google_rating: tw.google_rating[i], google_total: tw.google_total[i],
      new_reviews: tw.new_reviews[i], response_rate: tw.response_rate[i],
      yelp_rating: tw.yelp_rating[i], yelp_total: tw.yelp_total[i],
      monthly_sessions: tw.monthly_sessions[i], monthly_reservations: tw.monthly_reservations[i], bounce_rate: tw.bounce_rate[i],
      gbp_views: tw.gbp_views[i],
      ig_followers: tw.ig_followers[i], ig_posts_month: tw.ig_posts_month[i],
      fb_followers: tw.fb_followers[i],
      social_profile_visits: tw.social_profile_visits[i],
      dd_active: 'yes', dd_rating: tw.dd_rating[i],
      ue_active: 'yes', ue_rating: tw.ue_rating[i],
      gh_active: 'no',  gh_rating: null,
      delivery_orders: tw.delivery_orders[i],
      delivery_avg_order_value: tw.delivery_avg_order_value[i],
      email_list_size: tw.email_list_size[i], emails_sent: tw.emails_sent[i],
      email_open_rate: tw.email_open_rate[i],
      notes: ''
    }));

    // ── Traffic audits — three-audit recovery arc, Feb / Mar / Apr ──
    const mkTrafficAudit = (date, generated_at, audit_id, period, score, tier, raw) => {
      const sections = {
        'Google Business': raw.S1_SCORE, 'Website': raw.S2_SCORE,
        'Reviews': raw.S3_SCORE, 'Search and SEO': raw.S4_SCORE,
        'Social Media': raw.S5_SCORE, 'Delivery Platforms': raw.S6_SCORE,
        'Email Marketing': raw.S7_SCORE
      };
      // Traffic carries NO dollar gaps (matches the live computeTrafficAudit
      // contract). Zero every section gap and build deficit-based action items
      // with no dollar impact, so the demo never shows a recoverable-dollar strip
      // the real product cannot produce.
      [1, 2, 3, 4, 5, 6, 7].forEach(n => { raw['S' + n + '_MONTHLY_GAP'] = 0; });
      const items = [];
      const push = (n, action, gid) => { if (raw['S' + n + '_SCORE'] != null && raw['S' + n + '_SCORE'] < 65) items.push({ action: action, gap_id: gid }); };
      push(1, 'Fill every Google Business field, load photos toward 100, and post weekly.', 'gbp');
      push(2, 'Add online ordering and a reservation link, and make the menu load fast on a phone.', 'website');
      push(3, 'Reply to every review and ask every happy table.', 'reviews');
      push(4, 'Match your name, address, and phone everywhere and get into the Google Maps pack.', 'search-seo');
      push(5, 'Post three times a week, mixing food, people, and the room.', 'social');
      push(6, 'Run a first-order promo and load food photos on each delivery platform.', 'delivery');
      push(7, 'Send at least monthly and add a sign-up so new guests opt in.', 'email-loyalty');
      raw.OVERALL_SCORE = score;
      raw.BAR_NAME = 'The Anchor Bar & Kitchen';
      raw.AUDIT_ID = audit_id;
      raw.AUDIT_PERIOD = period;
      raw.DATA_TIER_LABEL = tier;
      raw.INDUSTRY_AVG = 58;
      raw.TARGET_SCORE = 65;
      return { id:uid(), date:date, bar_name:raw.BAR_NAME, overall_score:score,
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
        S1_FINDING:'Photos are well below 100, the menu link is missing, and posts barely run.',
        S1_TOOL:'Add the menu link, post weekly offers, and load 60 more photos this month.',
        S2_SCORE:30, S2_MOBILE_OPTIMIZED:'No', S2_MONTHLY_SESSIONS:1180,
        S2_SESSIONS_BENCHMARK:2000, S2_BOUNCE_RATE:74, S2_BOUNCE_BENCHMARK:55,
        S2_MENU_PAGE_IN_TOP_3:'No', S2_ONLINE_ORDERING_PRESENT:'No', S2_MONTHLY_GAP:720,
        S2_NARRATIVE:'Site traffic of 1,180 monthly sessions is roughly 40% below benchmark, and the homepage is not mobile-optimized.',
        S2_FINDING:'Bounce rate is 74% and the site has no online ordering.',
        S2_TOOL:'Rebuild the homepage above-the-fold for mobile and add a menu page that loads fast.',
        S3_SCORE:22, S3_GOOGLE_RATING:3.9, S3_GOOGLE_RATING_BENCHMARK:4.3,
        S3_GOOGLE_REVIEW_COUNT:240, S3_RESPONSE_RATE:38, S3_RESPONSE_BENCHMARK:75,
        S3_MOST_RECENT_REVIEW_DAYS:19, S3_YELP_RATING:3.7,
        S3_UNANSWERED:148, S3_NEGATIVE_PATTERN:'Slow weekend service mentioned in 4 of the last 10 reviews.',
        S3_MONTHLY_GAP:1280,
        S3_NARRATIVE:'Google rating is 3.9 against a 4.3 benchmark, and the response rate is just 38%.',
        S3_FINDING:'148 reviews sit unanswered, and a slow-weekend-service pattern shows in the recent ones.',
        S3_TOOL:'Respond to every unanswered review this week and address the weekend pacing issue on the floor.',
        S4_SCORE:32, S4_MAPS_PACK_CONFIRMED:'No', S4_NAP_CONSISTENT:'No',
        S4_NAP_BUSINESS_NAME:'Inconsistent across Yelp and Apple Maps',
        S4_PRIMARY_KEYWORD:'austin sports bar',
        S4_NARRATIVE:'The business does not appear in the Google Maps pack for its primary keyword.',
        S4_FINDING:'Name, address and phone vary across Yelp, Apple Maps and the website footer.',
        S4_TOOL:'Pick the canonical NAP and fix every directory listing to match it exactly.',
        S5_SCORE:35, S5_IG_FOLLOWERS:1880, S5_IG_POSTS_LAST_30:5, S5_IG_POSTS_BENCHMARK:12,
        S5_FB_FOLLOWERS:1050, S5_CONTENT_TYPE:'Mostly promotional', S5_MONTHLY_GAP:380,
        S5_NARRATIVE:'Instagram posting runs 5 per 30 days against a 12 benchmark.',
        S5_FINDING:'Content is mostly promotional graphics, not food and people.',
        S5_TOOL:'Move to a balanced mix of food, people and the room. Post three times a week.',
        S6_SCORE:38, S6_DOORDASH_ACTIVE:'Yes', S6_UBEREATS_ACTIVE:'Yes', S6_GRUBHUB_ACTIVE:'No',
        S6_DOORDASH_RATING:4.2, S6_UBEREATS_RATING:4.0,
        S6_PHOTO_COUNT_DELIVERY:11, S6_MENU_COMPLETE:'Partial', S6_PROMO_ACTIVE:'No',
        S6_MONTHLY_GAP:540,
        S6_NARRATIVE:'Both delivery platforms are live but ratings sit below the 4.5 benchmark and photos are sparse.',
        S6_FINDING:'No promo is active on either platform.',
        S6_TOOL:'Add 15 more food photos per platform and run a first-order promo on DoorDash.',
        S7_SCORE:30, S7_EMAIL_LIST_EXISTS:'Yes', S7_LIST_SIZE:380, S7_LIST_BENCHMARK:500,
        S7_LAST_SEND_DAYS_AGO:42, S7_SEND_FREQUENCY:'Rarely', S7_OPEN_RATE:18, S7_OPEN_BENCHMARK:20,
        S7_GROWTH_MECHANISM:'No active mechanism', S7_MONTHLY_GAP:420,
        S7_NARRATIVE:'A 380-contact list has not been emailed in over six weeks.',
        S7_FINDING:'The list is going cold, opens are below benchmark, and there is no way for new guests to opt in.',
        S7_TOOL:'Send a monthly email starting this week and add a WiFi sign-up capture.',
        S8_SIG1_SCORE:'HIGH', S8_SIG1_LABEL:'Review velocity dead',
        S8_SIG1_EVIDENCE:'Most recent review is 19 days old.',
        S8_SIG1_GAP:'Nothing fresh on the listing for searching guests.',
        S8_SIG1_TOOL:'Drop QR table cards asking for a Google review at every check.',
        S8_SIG2_SCORE:'HIGH', S8_SIG2_LABEL:'Unanswered reviews piling up',
        S8_SIG2_EVIDENCE:'148 Google reviews sit with no response.',
        S8_SIG2_GAP:'Every searching guest sees them sitting unanswered.',
        S8_SIG2_TOOL:'Clear the backlog this week, then 10 minutes a day to stay current.',
        S8_SIG3_SCORE:'MEDIUM', S8_SIG3_LABEL:'Email list going cold',
        S8_SIG3_EVIDENCE:'Last email send was 42 days ago.',
        S8_SIG3_GAP:'A 380-name list earning nothing.',
        S8_SIG3_TOOL:'Send a monthly email this week, even a simple one.',
        S8_SIG4_SCORE:'MEDIUM', S8_SIG4_LABEL:'No delivery promos',
        S8_SIG4_EVIDENCE:'No promo active on DoorDash or UberEats.',
        S8_SIG4_GAP:'Sitting below the competitors who run offers.',
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
        S7_GROWTH_MECHANISM:'WiFi login capture', S7_MONTHLY_GAP:220,
        S7_NARRATIVE:'List grew past 500 and sends became monthly. Open rate of 24% beats the 20% benchmark.',
        S7_FINDING:'Sending monthly works. Moving to weekly during event months grows revenue per send.',
        S7_TOOL:'Add a weekly Thursday email during event-heavy weeks.',
        S8_SIG1_SCORE:'MEDIUM', S8_SIG1_LABEL:'Posting schedule inconsistent',
        S8_SIG1_EVIDENCE:'IG posts at 9 per 30 days, but clustered in two bursts.',
        S8_SIG1_GAP:'Two bursts, then quiet, not steady.',
        S8_SIG1_TOOL:'Lock a Tuesday and Friday content slot.',
        S8_SIG2_SCORE:'MEDIUM', S8_SIG2_LABEL:'UberEats trails DoorDash',
        S8_SIG2_EVIDENCE:'UberEats rating 4.2 vs DoorDash 4.4.',
        S8_SIG2_GAP:'Trailing DoorDash by two-tenths.',
        S8_SIG2_TOOL:'Mirror the DoorDash photo and promo plan on UberEats.',
        S8_SIG3_SCORE:'LOW', S8_SIG3_LABEL:'Email still monthly',
        S8_SIG3_EVIDENCE:'Sending once a month, opens at 24%.',
        S8_SIG3_GAP:'Room to send weekly during event months.',
        S8_SIG3_TOOL:'Add a weekly email during event-heavy weeks.'
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
        S5_NARRATIVE:'Follower growth has accelerated. Posting frequency is above benchmark with a balanced mix.',
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
        S7_GROWTH_MECHANISM:'WiFi login capture',
        S7_MONTHLY_GAP:80,
        S7_NARRATIVE:'List grew to 760 with weekly sends and 28% opens.',
        S7_FINDING:'The email channel is now a real revenue line. Keep sending weekly and keep growing the list.',
        S7_TOOL:'Keep sending weekly and add a segmented email for your regulars.',
        S8_SIG1_SCORE:'LOW', S8_SIG1_LABEL:'Photo library steady',
        S8_SIG1_EVIDENCE:'138 photos current, with 54 added in the last 30 days.',
        S8_SIG1_GAP:'On track. Refresh photos seasonally.',
        S8_SIG1_TOOL:'Replace the menu cover shots quarterly with current plating.',
        S8_SIG2_SCORE:'LOW', S8_SIG2_LABEL:'Grubhub still inactive',
        S8_SIG2_EVIDENCE:'Grubhub listing remains off.',
        S8_SIG2_GAP:'Confirm this is intentional given local order mix.',
        S8_SIG2_TOOL:'Review Grubhub local order share annually before deciding.',
        S8_SIG3_SCORE:'LOW', S8_SIG3_LABEL:'Email channel strong',
        S8_SIG3_EVIDENCE:'760 contacts, weekly sends, 28% opens.',
        S8_SIG3_GAP:'On track. Keep sending weekly and segment the list.',
        S8_SIG3_TOOL:'Add a regulars-only email and a monthly performance check.'
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
      { id:uid(), name:'Local Produce Co.',   rep:'Gabe Flores', phone:'512-555-0177', email:'orders@localproduce.example', delivery_days:'Tue, Fri', payment_terms:'Net 15', account_number:'LPC-3050',  notes:'Produce and dairy', created_at:new Date().toISOString() },
    ];

    const SERVICE_BARS = new Set(['Main Bar', 'Back Bar']);   // a register sits here; spot checks run at these
    App.inventoryData.ic_locations = [
      ['Main Bar','bar'], ['Back Bar','bar'], ['Liquor Room','bar'],
      ['Walk-in Cooler','both'], ['Kitchen Line','kitchen'], ['Dry Storage','both']
    ].map(([n, type]) => ({ id:uid(), name:n, type, archived:false, service_bar: SERVICE_BARS.has(n) }));

    // Categories must match Profit's BAR_CATS / KITCHEN_CATS for the COGS feed.
    // Sub-category (style) per product, so the grouped Products + Set Locations
    // lists land populated in the demo. Keyed by the CLEANED name (unit suffix
    // stripped). Misc uses misc_type instead, so it is not listed here.
    const SUBCAT_SEED = {
      // Liquor
      "Tito's Handmade Vodka":'Vodka', 'Ketel One':'Vodka', 'Grey Goose':'Vodka',
      'Hendrick\'s Gin':'Gin', 'Tanqueray':'Gin', 'Roku Gin':'Gin',
      'Espolòn Tequila Blanco':'Tequila', 'Don Julio Blanco':'Tequila', 'Casamigos Reposado':'Tequila',
      'Mezcal':'Mezcal', 'White Rum':'Rum', 'Mount Gay Eclipse':'Rum', 'Sailor Jerry Spiced':'Rum',
      'Bulleit Bourbon':'Bourbon', "Maker's Mark":'Bourbon', 'Woodford Reserve':'Bourbon', 'Buffalo Trace':'Bourbon',
      'Rittenhouse Rye':'Rye', 'Jameson':'Irish Whiskey', 'Macallan 12':'Scotch', "Dewar's":'Scotch',
      'Hennessy VS':'Cognac', 'Campari':'Amaro', 'Aperol':'Aperitif',
      'Triple Sec':'Liqueur', 'Coffee Liqueur':'Liqueur', 'Maraschino Liqueur':'Liqueur',
      'St-Germain':'Liqueur', 'Cointreau':'Liqueur', 'Disaronno Amaretto':'Liqueur', 'Green Chartreuse':'Liqueur',
      // Wine
      'House Cabernet':'Red', 'Pinot Noir':'Red', 'Malbec':'Red', 'Red Blend':'Red', 'Cabernet Reserve':'Red',
      'House Chardonnay':'White', 'Sauvignon Blanc':'White', 'Pinot Grigio':'White', 'Chardonnay Reserve':'White',
      'Rosé':'Rosé', 'Prosecco':'Sparkling', 'Champagne':'Champagne', 'Sweet Vermouth':'Vermouth', 'Dry Vermouth':'Vermouth',
      // Bottle Beer
      'Bud Light':'Domestic', 'Lone Star':'Domestic', 'Modelo Especial':'Import', 'Corona':'Import', 'Stella Artois':'Import',
      'White Claw':'Seltzer', 'Austin Eastciders':'Cider', 'Athletic NA':'Non-Alcoholic',
      // Draft Beer
      'ABW Pearl Snap (1/2 bbl)':'Pilsner', 'Live Oak Hefeweizen':'Wheat', "Real Ale Fireman's 4":'Ale',
      'ABW Fire Eagle IPA':'IPA', 'Independence Stout':'Stout', 'Seasonal Rotating Tap':'Ale',
      // Food
      'Ground Beef 80/20':'Protein', 'Chicken Thigh':'Protein', 'Applewood Bacon':'Protein', 'Pork Chop':'Protein',
      'Beef Brisket':'Protein', 'Chicken Wings':'Protein', 'Beef Short Rib':'Protein', 'Charcuterie Selection':'Protein',
      'Atlantic Cod':'Seafood', 'Salmon Fillet':'Seafood', 'Gulf Shrimp':'Seafood', 'Calamari':'Seafood', 'Ahi Tuna':'Seafood',
      'Romaine':'Produce', 'Beefsteak Tomato':'Produce', 'Mixed Greens':'Produce', 'Russet Potato':'Produce',
      'Hass Avocado':'Produce', 'Brussels Sprouts':'Produce', 'Sweet Corn':'Produce',
      'Cheddar Cheese':'Dairy', 'Large Eggs':'Dairy', 'Parmesan':'Dairy', 'Heavy Cream':'Dairy',
      'Flour Tortilla':'Bakery', 'Brioche Bun':'Bakery', 'Flatbread':'Bakery', 'Sourdough Loaf':'Bakery',
      'Arborio Rice':'Dry Goods', 'Tortilla Chips':'Dry Goods', 'Chickpeas':'Dry Goods', 'Elbow Pasta':'Dry Goods',
      'Quinoa':'Dry Goods', 'Waffle Mix':'Dry Goods', 'Dark Chocolate':'Dry Goods', 'Kettle Chips':'Dry Goods'
    };
    const icProducts = [
      { name:"Tito's Handmade Vodka",    category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.5, unit_cost:22.40, menu_price:9,  par_level:24,  reorder_point:10,  primary_location:'Liquor Room' },
      { name:'Espolòn Tequila Blanco',   category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.5, unit_cost:24.50, menu_price:10, par_level:20,  reorder_point:9,   primary_location:'Liquor Room' },
      { name:'Bulleit Bourbon',          category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.5, unit_cost:27.90, menu_price:11, par_level:16,  reorder_point:7,   primary_location:'Liquor Room' },
      { name:"Hendrick's Gin",           category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.5, unit_cost:31.00, menu_price:12, par_level:10,  reorder_point:5,   primary_location:'Liquor Room' },
      { name:'House Cabernet',           category:'Wine',        vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:5,   unit_cost:9.50,  menu_price:10, par_level:24,  reorder_point:10,  primary_location:'Back Bar', serving_sizes:[{ label:'Bottle', size_oz:25.4, price:34 }] },
      { name:'House Chardonnay',         category:'Wine',        vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:5,   unit_cost:8.75,  menu_price:9,  par_level:24,  reorder_point:10,  primary_location:'Walk-in Cooler' },
      { name:'Modelo Especial',          category:'Bottle Beer', vendor:"Glazer's Beer & Bev", container_size_oz:12,   pour_size_oz:12,  unit_cost:32.40, menu_price:6,  case_size:24, par_level:20,  reorder_point:6, primary_location:'Walk-in Cooler' },
      { name:'Lone Star',                category:'Bottle Beer', vendor:"Glazer's Beer & Bev", container_size_oz:12,   pour_size_oz:12,  unit_cost:22.80, menu_price:5,  case_size:24, par_level:15,  reorder_point:5, primary_location:'Walk-in Cooler' },
      { name:'ABW Pearl Snap (1/2 bbl)', category:'Draft Beer',  vendor:'Austin Beerworks',    container_size_oz:1984, pour_size_oz:16,  unit_cost:165.00,menu_price:6,  par_level:6,   reorder_point:2,   primary_location:'Walk-in Cooler' },
      { name:'Ground Beef 80/20 (lb)',   category:'Food',        vendor:'Sysco Foods',                                                   unit_cost:4.20,  par_level:240, reorder_point:80,  primary_location:'Walk-in Cooler' },
      { name:'Chicken Thigh (lb)',       category:'Food',        vendor:'Sysco Foods',                                                   unit_cost:2.95,  par_level:200, reorder_point:60,  primary_location:'Walk-in Cooler' },
      { name:'Cheddar Cheese (lb)',      category:'Food',        vendor:'Sysco Foods',                                                   unit_cost:4.60,  par_level:90,  reorder_point:30,  primary_location:'Walk-in Cooler' },
      { name:'Romaine (case)',           category:'Food',        vendor:'Sysco Foods',                                                   unit_cost:22.00, par_level:16,  reorder_point:6,   primary_location:'Walk-in Cooler' },
      { name:'Flour Tortilla (case)',    category:'Food',        vendor:'Sysco Foods',                                                   unit_cost:16.00, par_level:20,  reorder_point:8,   primary_location:'Kitchen Line' },
      { name:'Fryer Oil (jug)',          category:'Misc',        misc_type:'Cleaning & Supplies',        vendor:'Restaurant Depot',                                              unit_cost:28.00, par_level:10,  reorder_point:4,   primary_location:'Kitchen Line' },
      { name:'To-Go Boxes (case)',       category:'Misc',        misc_type:'Paper & To-Go',        vendor:'Restaurant Depot',                                              unit_cost:42.00, par_level:8,   reorder_point:3,   primary_location:'Kitchen Line' },
      { name:'Triple Sec',               category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:0.75, unit_cost:9.00,  menu_price:7, par_level:12,  reorder_point:5,   primary_location:'Back Bar' },
      { name:'Lime Juice (qt)',          category:'Misc',        misc_type:'Drink Mixer',        vendor:'Sysco Foods',         container_size_oz:32,   pour_size_oz:0.5,  unit_cost:4.50,  par_level:18,  reorder_point:6,   primary_location:'Walk-in Cooler' },
      { name:'Simple Syrup (qt)',        category:'Misc',        misc_type:'Drink Mixer',        vendor:'Sysco Foods',         container_size_oz:32,   pour_size_oz:0.5,  unit_cost:3.50,  par_level:12,  reorder_point:4,   primary_location:'Back Bar' },
      // Kitchen ingredients (appended so existing index-based recipes stay valid).
      { name:'Brioche Bun (each)',       category:'Food',        vendor:'Sysco Foods',         unit_cost:0.55,  par_level:240, reorder_point:80,  primary_location:'Dry Storage' },
      { name:'Beefsteak Tomato (lb)',    category:'Food',        vendor:'Local Produce Co.',   unit_cost:2.40,  par_level:40,  reorder_point:14,  primary_location:'Walk-in Cooler' },
      { name:'Mixed Greens (case)',      category:'Food',        vendor:'Local Produce Co.',   unit_cost:24.00, par_level:14,  reorder_point:5,   primary_location:'Walk-in Cooler' },
      { name:'Applewood Bacon (lb)',     category:'Food',        vendor:'Sysco Foods',         unit_cost:6.50,  par_level:60,  reorder_point:20,  primary_location:'Walk-in Cooler' },
      { name:'Russet Potato (lb)',       category:'Food',        vendor:'Local Produce Co.',   unit_cost:1.10,  par_level:200, reorder_point:60,  primary_location:'Dry Storage' },
      { name:'Atlantic Cod (lb)',        category:'Food',        vendor:'Sysco Foods',         unit_cost:9.20,  par_level:60,  reorder_point:20,  primary_location:'Walk-in Cooler' },
      { name:'Salmon Fillet (lb)',       category:'Food',        vendor:'Sysco Foods',         unit_cost:12.40, par_level:50,  reorder_point:18,  primary_location:'Walk-in Cooler' },
      { name:'Gulf Shrimp (lb)',         category:'Food',        vendor:'Sysco Foods',         unit_cost:11.80, par_level:50,  reorder_point:18,  primary_location:'Walk-in Cooler' },
      { name:'Pork Chop (each)',         category:'Food',        vendor:'Sysco Foods',         unit_cost:4.60,  par_level:60,  reorder_point:20,  primary_location:'Walk-in Cooler' },
      { name:'Hass Avocado (each)',      category:'Food',        vendor:'Local Produce Co.',   unit_cost:1.20,  par_level:90,  reorder_point:30,  primary_location:'Walk-in Cooler' },
      { name:'Large Eggs (dozen)',       category:'Food',        vendor:'Sysco Foods',         unit_cost:3.40,  par_level:40,  reorder_point:14,  primary_location:'Walk-in Cooler' },
      { name:'Arborio Rice (lb)',        category:'Food',        vendor:'Sysco Foods',         unit_cost:3.10,  par_level:40,  reorder_point:14,  primary_location:'Dry Storage' },
      { name:'Parmesan (lb)',            category:'Food',        vendor:'Sysco Foods',         unit_cost:8.90,  par_level:30,  reorder_point:10,  primary_location:'Walk-in Cooler' },
      { name:'Beef Brisket (lb)',        category:'Food',        vendor:'Sysco Foods',         unit_cost:6.80,  par_level:80,  reorder_point:24,  primary_location:'Walk-in Cooler' },
      // Ingredients added for the full recipe-costed menu (C reseed 2026-05-30).
      // Every menu recipe ingredient must exist here as a product.
      { name:'Tortilla Chips (bag)',     category:'Food',        vendor:'Sysco Foods',         unit_cost:3.00,  par_level:24,  reorder_point:8,   primary_location:'Dry Storage' },
      { name:'Chicken Wings (lb)',       category:'Food',        vendor:'Sysco Foods',         unit_cost:2.40,  par_level:120, reorder_point:40,  primary_location:'Walk-in Cooler' },
      { name:'Brussels Sprouts (lb)',    category:'Food',        vendor:'Local Produce Co.',   unit_cost:2.20,  par_level:40,  reorder_point:14,  primary_location:'Walk-in Cooler' },
      { name:'Chickpeas (lb)',           category:'Food',        vendor:'Sysco Foods',         unit_cost:1.50,  par_level:30,  reorder_point:10,  primary_location:'Dry Storage' },
      { name:'Flatbread (each)',         category:'Food',        vendor:'Sysco Foods',         unit_cost:0.60,  par_level:120, reorder_point:40,  primary_location:'Dry Storage' },
      { name:'Calamari (lb)',            category:'Food',        vendor:'Sysco Foods',         unit_cost:6.00,  par_level:30,  reorder_point:10,  primary_location:'Walk-in Cooler' },
      { name:'Sweet Corn (each)',        category:'Food',        vendor:'Local Produce Co.',   unit_cost:0.55,  par_level:120, reorder_point:40,  primary_location:'Walk-in Cooler' },
      { name:'Ahi Tuna (lb)',            category:'Food',        vendor:'Sysco Foods',         unit_cost:14.00, par_level:24,  reorder_point:8,   primary_location:'Walk-in Cooler' },
      { name:'Elbow Pasta (lb)',         category:'Food',        vendor:'Sysco Foods',         unit_cost:1.40,  par_level:40,  reorder_point:14,  primary_location:'Dry Storage' },
      { name:'Sourdough Loaf (each)',    category:'Food',        vendor:'Local Produce Co.',   unit_cost:3.50,  par_level:30,  reorder_point:10,  primary_location:'Dry Storage' },
      { name:'Quinoa (lb)',              category:'Food',        vendor:'Sysco Foods',         unit_cost:3.20,  par_level:30,  reorder_point:10,  primary_location:'Dry Storage' },
      { name:'Beef Short Rib (lb)',      category:'Food',        vendor:'Sysco Foods',         unit_cost:7.50,  par_level:60,  reorder_point:20,  primary_location:'Walk-in Cooler' },
      { name:'Waffle Mix (lb)',          category:'Food',        vendor:'Sysco Foods',         unit_cost:1.80,  par_level:40,  reorder_point:14,  primary_location:'Dry Storage' },
      { name:'Mayonnaise (qt)',          category:'Misc',        misc_type:'Food Ingredient',        vendor:'Sysco Foods',         unit_cost:4.00,  par_level:12,  reorder_point:4,   primary_location:'Walk-in Cooler' },
      { name:'Heavy Cream (qt)',         category:'Food',        vendor:'Sysco Foods',         unit_cost:4.50,  par_level:16,  reorder_point:6,   primary_location:'Walk-in Cooler' },
      { name:'Charcuterie Selection (lb)',category:'Food',       vendor:'Local Produce Co.',   unit_cost:12.00, par_level:20,  reorder_point:7,   primary_location:'Walk-in Cooler' },
      { name:'Dark Chocolate (lb)',      category:'Food',        vendor:'Sysco Foods',         unit_cost:6.50,  par_level:20,  reorder_point:7,   primary_location:'Dry Storage' },
      { name:'Coffee Liqueur',           category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.0, unit_cost:19.00, menu_price:9, par_level:8,  reorder_point:3, primary_location:'Back Bar' },
      { name:'Campari',                  category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.0, unit_cost:26.00, menu_price:9, par_level:6,  reorder_point:2, primary_location:'Back Bar' },
      { name:'Sweet Vermouth',           category:'Wine',        vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.0, unit_cost:11.00, menu_price:8, par_level:6,  reorder_point:2, primary_location:'Back Bar' },
      { name:'Mezcal',                   category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.5, unit_cost:33.00, menu_price:12, par_level:6,  reorder_point:2, primary_location:'Liquor Room' },
      { name:'Prosecco',                 category:'Wine',        vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:2.0, unit_cost:12.00, menu_price:10, par_level:18, reorder_point:6, primary_location:'Walk-in Cooler' },
      { name:'White Rum',                category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.5, unit_cost:14.00, menu_price:8, par_level:8,  reorder_point:3, primary_location:'Liquor Room' },
      { name:'Maraschino Liqueur',       category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:0.5, unit_cost:24.00, menu_price:9, par_level:4,  reorder_point:2, primary_location:'Back Bar' },
      { name:'Cold Brew Concentrate (qt)',category:'Misc',       misc_type:'NA Beverage',       vendor:'Sysco Foods',         unit_cost:9.00,  par_level:8,  reorder_point:3,   primary_location:'Walk-in Cooler' },
      { name:'Ginger Beer (qt)',         category:'Misc',        misc_type:'NA Beverage',        vendor:"Glazer's Beer & Bev", unit_cost:3.00,  par_level:18, reorder_point:6,   primary_location:'Walk-in Cooler' },
      { name:'Cranberry Juice (qt)',     category:'Misc',        misc_type:'Drink Mixer',        vendor:'Sysco Foods',         unit_cost:3.50,  par_level:12, reorder_point:4,   primary_location:'Back Bar' },
      // ── Expanded bar stock (full lineup for a craft cocktail bar) ──────────
      { name:'Ketel One',                category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:28.00, menu_price:11, par_level:6, reorder_point:3, primary_location:'Liquor Room' },
      { name:'Grey Goose',               category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:34.00, menu_price:13, par_level:5, reorder_point:2, primary_location:'Liquor Room' },
      { name:'Tanqueray',                category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:26.00, menu_price:11, par_level:5, reorder_point:2, primary_location:'Liquor Room' },
      { name:'Roku Gin',                 category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:30.00, menu_price:12, par_level:4, reorder_point:2, primary_location:'Liquor Room' },
      { name:'Don Julio Blanco',         category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:45.00, menu_price:14, par_level:5, reorder_point:2, primary_location:'Liquor Room' },
      { name:'Casamigos Reposado',       category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:48.00, menu_price:15, par_level:4, reorder_point:2, primary_location:'Liquor Room' },
      { name:"Maker's Mark",             category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:27.00, menu_price:11, par_level:6, reorder_point:3, primary_location:'Liquor Room' },
      { name:'Woodford Reserve',         category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:35.00, menu_price:13, par_level:5, reorder_point:2, primary_location:'Liquor Room' },
      { name:'Buffalo Trace',            category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:26.00, menu_price:11, par_level:5, reorder_point:2, primary_location:'Liquor Room' },
      { name:'Rittenhouse Rye',          category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:24.00, menu_price:10, par_level:4, reorder_point:2, primary_location:'Liquor Room' },
      { name:'Jameson',                  category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:28.00, menu_price:11, par_level:6, reorder_point:3, primary_location:'Liquor Room' },
      { name:'Macallan 12',              category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:65.00, menu_price:18, par_level:3, reorder_point:1, primary_location:'Liquor Room' },
      { name:"Dewar's",                  category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:26.00, menu_price:10, par_level:4, reorder_point:2, primary_location:'Liquor Room' },
      { name:'Mount Gay Eclipse',        category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:22.00, menu_price:10, par_level:4, reorder_point:2, primary_location:'Liquor Room' },
      { name:'Sailor Jerry Spiced',      category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:21.00, menu_price:9,  par_level:4, reorder_point:2, primary_location:'Liquor Room' },
      { name:'Hennessy VS',              category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:38.00, menu_price:14, par_level:4, reorder_point:2, primary_location:'Liquor Room' },
      { name:'Aperol',                   category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.0, unit_cost:24.00, menu_price:9,  par_level:4, reorder_point:2, primary_location:'Back Bar' },
      { name:'St-Germain',               category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:0.75, unit_cost:32.00, menu_price:10, par_level:3, reorder_point:1, primary_location:'Back Bar' },
      { name:'Cointreau',                category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:0.75, unit_cost:33.00, menu_price:10, par_level:3, reorder_point:1, primary_location:'Back Bar' },
      { name:'Disaronno Amaretto',       category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.0, unit_cost:25.00, menu_price:9,  par_level:3, reorder_point:1, primary_location:'Back Bar' },
      { name:'Green Chartreuse',         category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:0.75, unit_cost:60.00, menu_price:12, par_level:2, reorder_point:1, primary_location:'Back Bar' },
      { name:'Pinot Noir',               category:'Wine',   vendor:'Republic National', container_size_oz:25.4, pour_size_oz:5, unit_cost:13.00, menu_price:12, par_level:18, reorder_point:6, primary_location:'Back Bar' },
      { name:'Malbec',                   category:'Wine',   vendor:'Republic National', container_size_oz:25.4, pour_size_oz:5, unit_cost:12.00, menu_price:11, par_level:18, reorder_point:6, primary_location:'Back Bar' },
      { name:'Red Blend',                category:'Wine',   vendor:'Republic National', container_size_oz:25.4, pour_size_oz:5, unit_cost:11.00, menu_price:10, par_level:18, reorder_point:6, primary_location:'Back Bar' },
      { name:'Sauvignon Blanc',          category:'Wine',   vendor:'Republic National', container_size_oz:25.4, pour_size_oz:5, unit_cost:12.00, menu_price:11, par_level:18, reorder_point:6, primary_location:'Walk-in Cooler' },
      { name:'Pinot Grigio',             category:'Wine',   vendor:'Republic National', container_size_oz:25.4, pour_size_oz:5, unit_cost:11.00, menu_price:10, par_level:18, reorder_point:6, primary_location:'Walk-in Cooler' },
      { name:'Rosé',                     category:'Wine',   vendor:'Republic National', container_size_oz:25.4, pour_size_oz:5, unit_cost:12.00, menu_price:11, par_level:14, reorder_point:5, primary_location:'Walk-in Cooler' },
      { name:'Champagne',                category:'Wine',   vendor:'Republic National', container_size_oz:25.4, pour_size_oz:2, unit_cost:30.00, menu_price:14, par_level:12, reorder_point:4, primary_location:'Walk-in Cooler', serving_sizes:[{ label:'Bottle', size_oz:25.4, price:65 }] },
      { name:'Dry Vermouth',             category:'Wine',   vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.0, unit_cost:11.00, menu_price:8, par_level:4, reorder_point:2, primary_location:'Back Bar' },
      { name:'Cabernet Reserve',         category:'Wine',   vendor:'Republic National', container_size_oz:25.4, pour_size_oz:5, unit_cost:22.00, menu_price:16, par_level:8, reorder_point:3, primary_location:'Back Bar' },
      { name:'Chardonnay Reserve',       category:'Wine',   vendor:'Republic National', container_size_oz:25.4, pour_size_oz:5, unit_cost:20.00, menu_price:15, par_level:8, reorder_point:3, primary_location:'Walk-in Cooler' },
      { name:'Bud Light',                category:'Bottle Beer', vendor:"Glazer's Beer & Bev", container_size_oz:12, pour_size_oz:12, unit_cost:28.80, menu_price:5, case_size:24, par_level:12, reorder_point:4, primary_location:'Walk-in Cooler' },
      { name:'Corona',                   category:'Bottle Beer', vendor:"Glazer's Beer & Bev", container_size_oz:12, pour_size_oz:12, unit_cost:33.60, menu_price:6, case_size:24, par_level:10, reorder_point:4, primary_location:'Walk-in Cooler' },
      { name:'Stella Artois',            category:'Bottle Beer', vendor:"Glazer's Beer & Bev", container_size_oz:12, pour_size_oz:12, unit_cost:38.40, menu_price:7, case_size:24, par_level:8,  reorder_point:3, primary_location:'Walk-in Cooler' },
      { name:'Athletic NA',              category:'Bottle Beer', vendor:"Glazer's Beer & Bev", container_size_oz:12, pour_size_oz:12, unit_cost:33.60, menu_price:6, case_size:24, par_level:6,  reorder_point:2, primary_location:'Walk-in Cooler' },
      { name:'White Claw',               category:'Bottle Beer', vendor:"Glazer's Beer & Bev", container_size_oz:12, pour_size_oz:12, unit_cost:38.40, menu_price:6, case_size:24, par_level:10, reorder_point:4, primary_location:'Walk-in Cooler' },
      { name:'Austin Eastciders',        category:'Bottle Beer', vendor:"Glazer's Beer & Bev", container_size_oz:12, pour_size_oz:12, unit_cost:43.20, menu_price:7, case_size:24, par_level:8,  reorder_point:3, primary_location:'Walk-in Cooler' },
      { name:'Live Oak Hefeweizen',      category:'Draft Beer', vendor:"Glazer's Beer & Bev", container_size_oz:1984, pour_size_oz:16, unit_cost:180.00, menu_price:6, par_level:3, reorder_point:1, primary_location:'Walk-in Cooler', serving_sizes:[{ label:'12 oz', size_oz:12, price:5 },{ label:'Pitcher', size_oz:60, price:18 }] },
      { name:"Real Ale Fireman's 4",     category:'Draft Beer', vendor:"Glazer's Beer & Bev", container_size_oz:1984, pour_size_oz:16, unit_cost:165.00, menu_price:6, par_level:3, reorder_point:1, primary_location:'Walk-in Cooler' },
      { name:'ABW Fire Eagle IPA',       category:'Draft Beer', vendor:'Austin Beerworks',    container_size_oz:1984, pour_size_oz:16, unit_cost:190.00, menu_price:7, par_level:3, reorder_point:1, primary_location:'Walk-in Cooler' },
      { name:'Independence Stout',       category:'Draft Beer', vendor:"Glazer's Beer & Bev", container_size_oz:1984, pour_size_oz:16, unit_cost:175.00, menu_price:6, par_level:2, reorder_point:1, primary_location:'Walk-in Cooler' },
      { name:'Seasonal Rotating Tap',    category:'Draft Beer', vendor:"Glazer's Beer & Bev", container_size_oz:1984, pour_size_oz:16, unit_cost:185.00, menu_price:7, par_level:2, reorder_point:1, primary_location:'Walk-in Cooler' },
      // ── Resale items (bought + sold whole, marked Sold on the menu) ─────────
      { name:'Topo Chico (each)',        category:'Misc', misc_type:'NA Beverage',  sold_on_menu:true, vendor:'Sysco Foods', unit_cost:0.95, menu_price:4,    servings_per_unit:1,  cost_per_serving:0.95, par_level:48, reorder_point:24, primary_location:'Walk-in Cooler' },
      { name:'House Lemonade',           category:'Misc', misc_type:'NA Beverage',  sold_on_menu:true, unit_type:'gal', vendor:'Sysco Foods', unit_cost:6.00, menu_price:4, servings_per_unit:12, cost_per_serving:0.50, par_level:6,  reorder_point:2,  primary_location:'Walk-in Cooler' },
      { name:'Kettle Chips (bag)',       category:'Food', sold_on_menu:true, vendor:'Sysco Foods', unit_cost:0.85, menu_price:3.5, servings_per_unit:1, cost_per_serving:0.85, par_level:60, reorder_point:24, primary_location:'Dry Storage' },
    ].map(p => {
      const pours = (p.container_size_oz && p.pour_size_oz) ? p.container_size_oz / p.pour_size_oz : null;
      // Bottle Beer unit_cost is per CASE; convert to per-bottle before costing
      // the pour, mirroring the product form's effectiveBottleCost().
      const effCost = (p.category === 'Bottle Beer' && p.case_size) ? p.unit_cost / p.case_size : p.unit_cost;
      const cpp   = pours ? effCost / pours : null;
      // Names carry no unit suffix; the unit lives in unit_type and is shown in
      // the Par / Order Qty / On-Hand columns. Derive unit_type from the legacy
      // "(lb)"-style suffix and strip it from the display name.
      const um = (p.name || '').match(/\s*\((lb|case|each|qt|bag|jug|dozen)\)\s*$/i);
      const cleanName = um ? p.name.replace(/\s*\((lb|case|each|qt|bag|jug|dozen)\)\s*$/i, '') : p.name;
      const unitType  = p.unit_type || (um ? um[1].toLowerCase() : null);
      return { id:uid(), brand:'', sub_category:'', secondary_location:'', notes:'', active:true,
        container_size_oz:null, pour_size_oz:null, menu_price:null,
        pours_per_container:pours, cost_per_pour:cpp,
        pour_cost_pct:(cpp != null && p.menu_price) ? cpp/p.menu_price*100 : null,
        // Phase 0: cost_history captures every auto-update from Receive Delivery
        // price changes. Empty on fresh data; populated as deliveries log price moves.
        cost_history:[],
        ...p, name: cleanName, unit_type: unitType,
        sub_category: p.sub_category || SUBCAT_SEED[cleanName] || '' };
    });
    // Multi-location stocking: bar products live in storage AND at the service
    // bars, the way a real bar runs. locations[0] is the primary (ordering home).
    icProducts.forEach(p => {
      let locs = null;
      if (p.category === 'Liquor')           locs = ['Liquor Room', 'Main Bar'];
      else if (p.category === 'Wine')        locs = ['Back Bar', 'Main Bar', 'Walk-in Cooler'];
      else if (p.category === 'Bottle Beer') locs = ['Walk-in Cooler', 'Main Bar', 'Back Bar'];
      else if (p.category === 'Draft Beer')  locs = ['Walk-in Cooler', 'Main Bar'];
      if (locs) { p.locations = locs.slice(); p.primary_location = locs[0]; }
    });
    App.inventoryData.ic_products = icProducts;

    // Seed a few recent vendor price changes (cost_history) so the vendor "Recent
    // Price Changes" card lands populated in the demo. Exactly the shape Receive
    // Delivery writes when a price update is applied; new_cost = the product's
    // current cost so the numbers stay honest. Mostly creeping up, one drop.
    (function seedPriceChanges() {
      const byName = {}; icProducts.forEach(p => { byName[p.name] = p; });
      const dAgo = n => { const d = new Date(Date.now() - n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      const log = (name, oldCost, daysAgo) => {
        const p = byName[name]; if (!p) return;
        p.cost_history = p.cost_history || [];
        p.cost_history.push({ date: dAgo(daysAgo), old_cost: oldCost, new_cost: p.unit_cost, vendor: p.vendor, delivery_id: 'seed', source: 'delivery' });
      };
      log('Don Julio Blanco', 42.00, 5);
      log("Maker's Mark",     25.50, 9);
      log('Woodford Reserve', 33.00, 7);
      log('Buffalo Trace',    27.50, 12);   // a supplier drop (green)
      log('Stella Artois',    36.00, 6);
      log('Corona',           32.40, 14);
      log('ABW Fire Eagle IPA', 185.00, 4);
      log('Cranberry Juice',  3.25, 11);
    })();

    // ── Beer + Wine as linked Menu Inventory Items ──────────────────────────
    // Direct-pour beverages live in the menu's Inventory Items tab, LINKED to
    // the Inventory Control product (the screen classifies on linked_product_id,
    // not category, so a free-floating 'Beer'/'Wine' row would wrongly show as a
    // Plate Item). Cost flows from the product's cost-per-pour. These are the
    // bar's actual stocked beer/wine — the menu only offers what Inventory
    // carries. rMenu is the same array as App.data.menu_items, so pushing here
    // adds them to the live menu.
    const IC_TO_MENU = App.MENU_IC_TO_CAT || { 'Bottle Beer':'Beer', 'Draft Beer':'Beer', 'Wine':'Wine', 'Misc':'NA Beverages' };
    const invMenuItem = (p, price, covers) => ({
      id:uid(), name:p.name, category:(IC_TO_MENU[p.category] || 'Beer'),
      price:price, cost:+((p.cost_per_pour || 0)).toFixed(2), weekly_covers:covers,
      prev_weekly_covers:null, weekly_covers_updated_at:null, notes:'', recipe:null,
      linked_product_id:p.id, pour_size_oz:null, target_cost_pct:null,
      created_at:new Date().toISOString(), updated_at:new Date().toISOString()
    });
    const icByName = nm => icProducts.find(p => p.name === nm);
    [ ['ABW Pearl Snap (1/2 bbl)', 6, 320], ['Modelo Especial', 6, 180],
      ['Lone Star', 5, 150], ['House Cabernet', 10, 64], ['House Chardonnay', 9, 70],
      // Expanded beer + wine list — the menu offers what Inventory now carries.
      ['Bud Light', 5, 210], ['Corona', 6, 160], ['Stella Artois', 7, 90],
      ['Athletic NA', 6, 40], ['White Claw', 6, 120], ['Austin Eastciders', 7, 70],
      ['Live Oak Hefeweizen', 6, 240], ["Real Ale Fireman's 4", 6, 200], ['ABW Fire Eagle IPA', 7, 220],
      ['Independence Stout', 6, 110], ['Seasonal Rotating Tap', 7, 130],
      ['Pinot Noir', 12, 80], ['Malbec', 11, 70], ['Red Blend', 10, 90],
      ['Sauvignon Blanc', 11, 85], ['Pinot Grigio', 10, 75], ['Rosé', 11, 60], ['Champagne', 14, 30],
      ['Cabernet Reserve', 16, 24], ['Chardonnay Reserve', 15, 22]
    ].forEach(row => { const p = icByName(row[0]); if (p) rMenu.push(invMenuItem(p, row[1], row[2])); });

    // ── Resale items (NA beverages + snacks) as linked Menu Items ───────────
    // Packaged items sold whole, linked to their Inventory product. Cost flows
    // per serving via App.menuLinkCost (cost / servings per unit), so the menu
    // shows an honest per-serving cost, not the per-case purchase cost.
    const resaleMenuItem = (p, covers) => ({
      id:uid(), name:p.name,
      category:(App.menuCatForProduct ? (App.menuCatForProduct(p) || 'Snacks') : 'Snacks'),
      price:p.menu_price || 0,
      cost:+((App.menuLinkCost ? App.menuLinkCost(p) : (p.unit_cost || 0))).toFixed(2),
      weekly_covers:covers, prev_weekly_covers:null, weekly_covers_updated_at:null, notes:'',
      recipe:null, linked_product_id:p.id, pour_size_oz:null, target_cost_pct:null,
      created_at:new Date().toISOString(), updated_at:new Date().toISOString()
    });
    [ ['Topo Chico', 90], ['House Lemonade', 70], ['Kettle Chips', 110] ]
      .forEach(row => { const p = icByName(row[0]); if (p) rMenu.push(resaleMenuItem(p, row[1])); });

    // ── Recipes attached to menu items + standalone batches ─────────────────
    // Recipes now live EMBEDDED in App.data.menu_items as the optional
    // `recipe` field. When attached, cost auto-computes from current product
    // prices via App.menuItemCost. We attach 3 recipes to existing rMenu
    // items here so the demo shows both menu items with recipes (cost
    // auto-flows) and menu items without (manual cost stays as-is).
    const attachRecipe = (itemName, recipe) => {
      const item = rMenu.find(m => m.name === itemName);
      if (item) item.recipe = recipe;
    };
    // Look an ingredient id up by product name (robust against index shifts).
    // Tolerant lookup: recipe ingredient names may still carry the legacy
    // "(lb)" suffix, but product names were stripped of it — match either way.
    const icp = nm => {
      const clean = (nm || '').replace(/\s*\((lb|case|each|qt|bag|jug|dozen)\)\s*$/i, '');
      return (icProducts.find(p => p.name === clean) || {}).id;
    };
    const ing = (nm, quantity) => ({ source: 'product', id: icp(nm), quantity: quantity });
    attachRecipe('House Margarita', {
      mode: 'single',
      ingredients: [
        { source: 'product', id: icProducts[1].id,  quantity: 1 },     // Espolòn Tequila (1 pour)
        { source: 'product', id: icProducts[16].id, quantity: 0.5 },   // Triple Sec
        { source: 'product', id: icProducts[17].id, quantity: 0.04 }   // Lime Juice (fraction of qt)
      ],
      plate_yield: null
    });
    attachRecipe('Anchor Burger', {
      mode: 'food',
      ingredients: [
        ing('Ground Beef 80/20 (lb)', 0.33),
        ing('Brioche Bun (each)',     1),
        ing('Cheddar Cheese (lb)',    0.12),
        ing('Applewood Bacon (lb)',   0.10),
        ing('Beefsteak Tomato (lb)',  0.08),
        ing('Mixed Greens (case)',    0.03)
      ],
      plate_yield: 1
    });
    attachRecipe('Old Fashioned', {
      mode: 'single',
      // Spirit quantity = pours; mixer quantity = fraction of the qt container
      // (the seed costs Misc mixers off unit_cost, so keep these small/realistic).
      ingredients: [ ing('Bulleit Bourbon', 1.3), ing('Simple Syrup (qt)', 0.02) ],
      plate_yield: null
    });
    // More plate + cocktail recipes, all built from real Inventory products.
    // Not every item carries a recipe (by design) — these cover the headline
    // dishes so Recipe Cost Analysis and Menu Engineering have real coverage.
    attachRecipe('Brisket Sandwich', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Beef Brisket (lb)', 0.35), ing('Brioche Bun (each)', 1), ing('Mixed Greens (case)', 0.02) ] });
    attachRecipe('Fish and Chips', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Atlantic Cod (lb)', 0.40), ing('Russet Potato (lb)', 0.50) ] });
    attachRecipe('Chicken Caesar', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Chicken Thigh (lb)', 0.30), ing('Romaine (case)', 0.05), ing('Parmesan (lb)', 0.05) ] });
    attachRecipe('Steak Frites', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Beef Brisket (lb)', 0.50), ing('Russet Potato (lb)', 0.45) ] });
    attachRecipe('Shrimp Tacos', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Gulf Shrimp (lb)', 0.30), ing('Flour Tortilla (case)', 0.02), ing('Hass Avocado (each)', 0.5) ] });
    attachRecipe('Pan-Seared Salmon', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Salmon Fillet (lb)', 0.40), ing('Arborio Rice (lb)', 0.15), ing('Mixed Greens (case)', 0.03) ] });
    attachRecipe('Grilled Pork Chop', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Pork Chop (each)', 1), ing('Russet Potato (lb)', 0.40) ] });
    attachRecipe('Mushroom Risotto', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Arborio Rice (lb)', 0.25), ing('Parmesan (lb)', 0.06) ] });
    attachRecipe('Breakfast Tacos', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Large Eggs (dozen)', 0.25), ing('Flour Tortilla (case)', 0.02), ing('Cheddar Cheese (lb)', 0.06), ing('Applewood Bacon (lb)', 0.08) ] });
    attachRecipe('Paloma', { mode: 'single', plate_yield: null, ingredients: [
      ing('Espolòn Tequila Blanco', 1), ing('Lime Juice (qt)', 0.03), ing('Simple Syrup (qt)', 0.02) ] });
    attachRecipe('Whiskey Sour', { mode: 'single', plate_yield: null, ingredients: [
      ing('Bulleit Bourbon', 1.3), ing('Lime Juice (qt)', 0.04), ing('Simple Syrup (qt)', 0.03) ] });

    // ── C reseed (2026-05-30): recipe-cost the rest of the menu off real
    // Inventory products so nearly every item is recipe-driven and costs auto-
    // flow. Five simple/prepared items stay manual-cost by design (Fried
    // Pickles, Pretzel Bites, Truffle Fries, Skillet Cookie, Key Lime Pie).
    attachRecipe('Loaded Nachos', { mode:'food', plate_yield:1, ingredients:[
      ing('Tortilla Chips (bag)', 0.5), ing('Cheddar Cheese (lb)', 0.15), ing('Ground Beef 80/20 (lb)', 0.20) ] });
    attachRecipe('Smoked Wings', { mode:'food', plate_yield:1, ingredients:[
      ing('Chicken Wings (lb)', 1.2) ] });
    attachRecipe('Deviled Eggs', { mode:'food', plate_yield:1, ingredients:[
      ing('Large Eggs (dozen)', 0.5), ing('Mayonnaise (qt)', 0.05) ] });
    attachRecipe('Charcuterie Board', { mode:'food', plate_yield:1, ingredients:[
      ing('Charcuterie Selection (lb)', 0.4), ing('Cheddar Cheese (lb)', 0.15), ing('Flatbread (each)', 1) ] });
    attachRecipe('Crispy Brussels', { mode:'food', plate_yield:1, ingredients:[
      ing('Brussels Sprouts (lb)', 0.6), ing('Applewood Bacon (lb)', 0.12) ] });
    attachRecipe('Hummus and Flatbread', { mode:'food', plate_yield:1, ingredients:[
      ing('Chickpeas (lb)', 0.5), ing('Flatbread (each)', 2) ] });
    attachRecipe('Calamari', { mode:'food', plate_yield:1, ingredients:[
      ing('Calamari (lb)', 0.5), ing('Lime Juice (qt)', 0.02) ] });
    attachRecipe('Street Corn Ribs', { mode:'food', plate_yield:1, ingredients:[
      ing('Sweet Corn (each)', 3), ing('Parmesan (lb)', 0.05) ] });
    attachRecipe('Tuna Poke', { mode:'food', plate_yield:1, ingredients:[
      ing('Ahi Tuna (lb)', 0.30), ing('Hass Avocado (each)', 0.5), ing('Arborio Rice (lb)', 0.10) ] });
    attachRecipe('House Salad', { mode:'food', plate_yield:1, ingredients:[
      ing('Mixed Greens (case)', 0.05), ing('Beefsteak Tomato (lb)', 0.10) ] });
    attachRecipe('Mac and Cheese', { mode:'food', plate_yield:1, ingredients:[
      ing('Elbow Pasta (lb)', 0.30), ing('Cheddar Cheese (lb)', 0.30), ing('Heavy Cream (qt)', 0.06) ] });
    attachRecipe('Avocado Toast', { mode:'food', plate_yield:1, ingredients:[
      ing('Hass Avocado (each)', 1.5), ing('Sourdough Loaf (each)', 0.2), ing('Large Eggs (dozen)', 0.17) ] });
    attachRecipe('Veggie Grain Bowl', { mode:'food', plate_yield:1, ingredients:[
      ing('Quinoa (lb)', 0.30), ing('Mixed Greens (case)', 0.05), ing('Hass Avocado (each)', 0.5) ] });
    attachRecipe('Braised Short Rib', { mode:'food', plate_yield:1, ingredients:[
      ing('Beef Short Rib (lb)', 1.0), ing('Russet Potato (lb)', 0.40) ] });
    attachRecipe('Chicken and Waffles', { mode:'food', plate_yield:1, ingredients:[
      ing('Chicken Thigh (lb)', 0.6), ing('Waffle Mix (lb)', 0.5) ] });
    attachRecipe('Brunch Burger', { mode:'food', plate_yield:1, ingredients:[
      ing('Ground Beef 80/20 (lb)', 0.33), ing('Brioche Bun (each)', 1), ing('Applewood Bacon (lb)', 0.10), ing('Large Eggs (dozen)', 0.08), ing('Cheddar Cheese (lb)', 0.08) ] });
    attachRecipe('Shakshuka', { mode:'food', plate_yield:1, ingredients:[
      ing('Large Eggs (dozen)', 0.33), ing('Beefsteak Tomato (lb)', 0.40), ing('Chickpeas (lb)', 0.15) ] });
    attachRecipe('Creme Brulee', { mode:'food', plate_yield:1, ingredients:[
      ing('Heavy Cream (qt)', 0.25), ing('Large Eggs (dozen)', 0.17) ] });
    attachRecipe('Chocolate Torte', { mode:'food', plate_yield:1, ingredients:[
      ing('Dark Chocolate (lb)', 0.20), ing('Large Eggs (dozen)', 0.10), ing('Heavy Cream (qt)', 0.05) ] });
    attachRecipe('Espresso Martini', { mode:'single', plate_yield:null, ingredients:[
      ing("Tito's Handmade Vodka", 1.0), ing('Coffee Liqueur', 0.75), ing('Cold Brew Concentrate (qt)', 0.05) ] });
    attachRecipe('Negroni', { mode:'single', plate_yield:null, ingredients:[
      ing("Hendrick's Gin", 0.8), ing('Campari', 0.8), ing('Sweet Vermouth', 0.8) ] });
    attachRecipe('Manhattan', { mode:'single', plate_yield:null, ingredients:[
      ing('Bulleit Bourbon', 1.3), ing('Sweet Vermouth', 0.5) ] });
    attachRecipe('Mezcal Mule', { mode:'single', plate_yield:null, ingredients:[
      ing('Mezcal', 1.0), ing('Lime Juice (qt)', 0.04), ing('Ginger Beer (qt)', 0.13) ] });
    attachRecipe('Spicy Margarita', { mode:'single', plate_yield:null, ingredients:[
      ing('Espolòn Tequila Blanco', 1.0), ing('Triple Sec', 0.5), ing('Lime Juice (qt)', 0.04) ] });
    attachRecipe('French 75', { mode:'single', plate_yield:null, ingredients:[
      ing("Hendrick's Gin", 0.8), ing('Lime Juice (qt)', 0.03), ing('Simple Syrup (qt)', 0.02), ing('Prosecco', 1) ] });
    attachRecipe('Mojito', { mode:'single', plate_yield:null, ingredients:[
      ing('White Rum', 1.5), ing('Lime Juice (qt)', 0.04), ing('Simple Syrup (qt)', 0.03) ] });
    attachRecipe('Boulevardier', { mode:'single', plate_yield:null, ingredients:[
      ing('Bulleit Bourbon', 1.0), ing('Campari', 0.8), ing('Sweet Vermouth', 0.8) ] });
    attachRecipe('Aviation', { mode:'single', plate_yield:null, ingredients:[
      ing("Hendrick's Gin", 1.0), ing('Maraschino Liqueur', 0.5), ing('Lime Juice (qt)', 0.03) ] });
    attachRecipe('Cosmopolitan', { mode:'single', plate_yield:null, ingredients:[
      ing("Tito's Handmade Vodka", 1.0), ing('Triple Sec', 0.5), ing('Lime Juice (qt)', 0.03), ing('Cranberry Juice (qt)', 0.1) ] });
    // Re-compute cost on items that just got a recipe so the menu engineering
    // numbers stay consistent on first render (before any save fires).
    rMenu.forEach(m => {
      if (m.recipe && m.recipe.ingredients && m.recipe.ingredients.length) {
        const tc = m.recipe.ingredients.reduce((s, ing) => {
          if (ing.source === 'batch') return s; // batches not seeded in cost pre-compute
          const id = ing.id || ing.product_id;
          const p = icProducts.find(x => x.id === id);
          if (!p) return s;
          const isBar = ['Liquor','Wine','Bottle Beer','Draft Beer'].includes(p.category);
          const unitCost = isBar
            ? (m.recipe.mode === 'single' ? (p.cost_per_pour || 0) : (p.unit_cost || 0))
            : (p.unit_cost || 0);
          return s + unitCost * (ing.quantity || 0);
        }, 0);
        m.cost = m.recipe.mode === 'food' && m.recipe.plate_yield > 0 ? tc / m.recipe.plate_yield : tc;
      }
    });

    // Prep batches: made-in-house ingredients. Frozen Margarita Mix is the
    // classic example. Lives in App.inventoryData.ic_prep_batches alongside
    // Products, Locations, Vendors as IC Setup reference data (Rule 21).
    const fmIngredients = [
      { product_id: icProducts[1].id, quantity: 2 },   // Espolòn Tequila
      { product_id: icProducts[16].id, quantity: 1 },  // Triple Sec
      { product_id: icProducts[17].id, quantity: 2 },  // Lime Juice
      { product_id: icProducts[18].id, quantity: 1 }   // Simple Syrup
    ];
    const fmTotalCost = fmIngredients.reduce((s, ing) => {
      const p = icProducts.find(x => x.id === ing.product_id);
      return s + (p?.unit_cost || 0) * ing.quantity;
    }, 0);
    App.inventoryData.ic_prep_batches = [
      {
        id: uid(), name: 'Frozen Margarita Mix', category: 'Cocktail Mix',
        ingredients: fmIngredients,
        batch_yield: 1, batch_yield_unit: 'gallons',
        serving_size: 5, serving_size_unit: 'oz',
        servings_per_batch: 25.6,
        total_cost: fmTotalCost, cost_per_serving: fmTotalCost / 25.6,
        updated_at: new Date().toISOString(), created_at: new Date().toISOString()
      }
    ];

    // Count totals per product index: [current (today), one week ago].
    // Usage = week-ago minus today; no deliveries land in the last 7 days, so
    // the icCOGS feed reads cleanly as (start - end) x unit cost. Realistic
    // weekly turnover is spread across EVERY product (not concentrated in a
    // few), so the usage/variance reports read like a real operating week and
    // the count-derived COGS sums to ~$2,758 bar / ~$2,362 food — in line with
    // the booked weekly P&L for this volume. Regenerated for the full bar stock.
    const icTotals = {
      0:[1.6,4.3], 1:[1.4,3.8], 2:[1.3,3.4], 3:[0.9,2.4], 4:[2.2,5.8], 5:[2.2,5.8],
      6:[34,91], 7:[27,72], 8:[0.5,1.3], 9:[17,45], 10:[11,30], 11:[8,22],
      12:[1.1,3], 13:[0.8,2.2], 14:[1.1,3], 15:[1.4,3.7], 16:[0.4,1], 17:[2.2,5.9],
      18:[1.7,4.5], 19:[50,134], 20:[7,19], 21:[1.7,4.5], 22:[8,22], 23:[34,90],
      24:[8,22], 25:[8,21], 26:[7,19], 27:[10,27], 28:[25,67], 29:[8,22],
      30:[4,11], 31:[4,11], 32:[11,30], 33:[4,11], 34:[31,82], 35:[7,18],
      36:[4,11], 37:[22,59], 38:[6,16], 39:[34,90], 40:[5,13], 41:[5,13],
      42:[5,14], 43:[4,11], 44:[8,22], 45:[4,11], 46:[1.7,4.5], 47:[2.8,7.5],
      48:[4,11], 49:[2.2,5.9], 50:[0.3,0.8], 51:[0.2,0.6], 52:[0.3,0.8], 53:[0.3,0.8],
      54:[0.9,2.4], 55:[0.5,1.4], 56:[0.1,0.3], 57:[1.4,3.7], 58:[2.2,5.9], 59:[1.7,4.5],
      60:[1.6,4.3], 61:[0.9,2.4], 62:[1.3,3.4], 63:[0.7,1.9], 64:[0.9,2.4], 65:[0.7,1.9],
      66:[1.6,4.3], 67:[0.9,2.4], 68:[1.3,3.4], 69:[0.7,1.9], 70:[1.4,3.8], 71:[0.4,1],
      72:[0.9,2.4], 73:[0.7,1.9], 74:[0.7,1.9], 75:[0.7,1.9], 76:[0.5,1.4], 77:[0.4,1],
      78:[0.5,1.4], 79:[0.4,1], 80:[0.3,0.8], 81:[2.5,6.7], 82:[2.2,5.8], 83:[2.9,7.7],
      84:[2.7,7.2], 85:[2.3,6.2], 86:[1.8,4.8], 87:[0.9,2.4], 88:[0.4,1], 89:[0.7,1.9],
      90:[0.7,1.9], 91:[34,91], 92:[27,72], 93:[14,38], 94:[7,19], 95:[22,58],
      96:[13,34], 97:[0.5,1.3], 98:[0.4,1], 99:[0.5,1.3], 100:[0.2,0.6], 101:[0.3,0.8],
      // Resale items appended to icProducts (Topo Chico, House Lemonade, Kettle
      // Chips) — every product index needs an entry here or mkCount throws.
      102:[18,48], 103:[2,6], 104:[22,60]
    };
    // Bottle beer is counted, ordered and valued by the CASE (the one canonical
    // unit). icTotals above were authored in bottles, so convert every beer index
    // to cases (divide by case_size). The dollar value is unchanged (cases x
    // per-case == bottles x per-bottle). Then set realistic case pars tied to
    // weekly usage so on-hand (cases) vs par (cases) reads coherently.
    icProducts.forEach((p, i) => {
      if (p.category === 'Bottle Beer' && p.case_size && icTotals[i]) {
        // Convert the authored-in-bottles totals to CASES (beer's canonical
        // unit). Pars are set below by the shared par-alignment pass, the same
        // way as every other category.
        icTotals[i] = [icTotals[i][0] / p.case_size, icTotals[i][1] / p.case_size];
      }
    });
    // On-hand value = counted quantity x unit_cost, in container units for every
    // category (cases for beer, bottles for liquor/wine, kegs for draft, stock
    // unit for food). unit_cost is stored per container, so this is a straight
    // multiply with no per-category special case.
    const icCountItem = (p, qty) => {
      // Bottle beer is counted as full cases + loose bottles, stored as a decimal
      // number of cases — identical to what the Take Inventory form writes, so a
      // seeded count round-trips through the form and Count History detects it as
      // case beer (carries cases / loose / case_size_at_count).
      if (p.category === 'Bottle Beer' && p.case_size) {
        const whole = Math.floor(qty);
        const loose = Math.round((qty - whole) * p.case_size);
        const total = whole + loose / p.case_size;
        return { product_id:p.id, name:p.name, category:p.category,
          cases:whole, loose, case_size_at_count:p.case_size,
          fulls:whole, partial:0, total,
          unit_cost:p.unit_cost, value:+(total * (p.unit_cost || 0)).toFixed(2), notes:'' };
      }
      return { product_id:p.id, name:p.name, category:p.category,
        fulls:Math.floor(qty), partial:+(qty - Math.floor(qty)).toFixed(2), total:qty,
        unit_cost:p.unit_cost, value:+(qty * (p.unit_cost || 0)).toFixed(2), notes:'' };
    };
    const mkCount = (daysAgo, pick, countedBy) => {
      const items = icProducts.map((p, i) => icCountItem(p, pick(i)));
      return { id:uid(), date:dateStr(daysAgo), type:'Full', counted_by:countedBy || 'Maria G.',
        locations:['Liquor Room','Back Bar','Walk-in Cooler','Kitchen Line'],
        items:items, item_count:items.length,
        total_value:+items.reduce((s, it) => s + it.value, 0).toFixed(2),
        created_at:daysAgoISO(daysAgo) };
    };
    // The recent three counts drive the live weekly COGS + variance window and
    // must stay exactly as-is. The older weekly counts (back ~12 weeks) oscillate
    // around the well-stocked day-7 level so inventory reads flat across the
    // quarter (beginning ~= ending), with a couple of busy-week draw-downs — the
    // sawtooth a real bar shows. Deterministic multipliers keep it reproducible.
    const icOlderCounters = ['Carlos P.', 'Maria G.', 'Jake T.'];
    const icOlderWeeks = [
      [21, 1.05], [28, 0.92], [35, 1.10], [42, 0.86], [49, 1.03],
      [56, 0.95], [63, 1.09], [70, 0.90], [77, 1.04], [84, 0.98]
    ];
    App.inventoryData.ic_counts = [
      mkCount(14, i => icTotals[i][1] + (icTotals[i][1] - icTotals[i][0])),
      mkCount(7,  i => icTotals[i][1]),
      mkCount(0,  i => icTotals[i][0]),
      ...icOlderWeeks.map(([d, m], k) =>
        mkCount(d, i => +(icTotals[i][1] * m).toFixed(2), icOlderCounters[k % icOlderCounters.length]))
    ];

    // Deliveries — all dated 8+ days back so none fall inside the last count
    // period. Two carry price increases, which Vendor Watch surfaces.
    const icDLine = (p, qty, price, prev) => {
      const isCaseBeer = p.category === 'Bottle Beer' && p.case_size;
      return {
        product_id:p.id, name:p.name,
        container_size_oz:p.container_size_oz != null ? p.container_size_oz : null,
        qty:qty, price_per_unit:price, prev_price:prev,
        price_changed:(prev != null && Math.abs(price - prev) > 0.001),
        extended:+(qty * price).toFixed(2),
        // Bottle beer is received by the CASE: qty is in cases, price is per case.
        display_unit: isCaseBeer ? 'case' : 'unit',
        case_size_at_receive: isCaseBeer ? p.case_size : null
      };
    };
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
        icDLine(icProducts[6], 20, 32.40, 30.72),
        icDLine(icProducts[7], 15, 22.80, 22.80),
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

    // ── Full quarter of delivery history (ties to COGS) ───────────────────────
    // Each SKU is reordered on its own cadence based on how fast it moves in
    // dollars: big movers weekly, mid every 2-3 weeks, slow movers monthly. A SKU
    // only lands on an invoice the week it's due, so each invoice reads like a
    // real reorder (the items that dropped to par) at ~8-15 lines, and the qty
    // refills the gap since the last drop. Summed over the quarter this
    // auto-ties to ~12 weeks of usage. The most recent ~14 days are left light on
    // purpose: the inventory draw-down those weeks is what the seeded Open /
    // Submitted orders in the pipeline will refill. The whole chain reconciles —
    // beginning count + purchases - ending count lands within 2% of the booked
    // 12-week COGS.
    const icWkUsage = {}; Object.keys(icTotals).forEach(i => { icWkUsage[i] = icTotals[i][1] - icTotals[i][0]; });
    const icOrderInterval = uv => uv >= 60 ? 1 : uv >= 25 ? 2 : uv >= 10 ? 3 : 4;
    let icInvSeq = 1000;
    const mkVendorDelivery = (daysAgo, vendor, prefix, allowBump) => {
      const weekIndex = Math.round(daysAgo / 7);
      const lines = [];
      icProducts.forEach((p, i) => {
        if (p.vendor !== vendor) return;
        const usage = icWkUsage[i] || 0;                        // container units (cases for beer)
        const base  = (p.unit_cost != null) ? p.unit_cost : 0;  // per container (per case for beer)
        const uv    = usage * base;
        if (uv < 3) return;                                  // negligible mover, not reordered in-window
        const interval = icOrderInterval(uv);
        if (weekIndex % interval !== (i % interval)) return; // not due this week
        const qty = Math.max(1, Math.round(usage * interval)); // whole containers (cases for beer)
        const price = (allowBump && (i % 7 === 0)) ? +(base * 1.06).toFixed(2) : base;
        lines.push(icDLine(p, qty, price, base));
      });
      if (lines.length === 0) return null;
      icInvSeq += 1;
      return mkDelivery(daysAgo, vendor, prefix + '-' + icInvSeq, lines);
    };
    // Vendor truck days across the quarter. Skips the most recent ~14 days (to
    // preserve the draw-down + the live variance window) and the existing
    // invoices' days above.
    const icDeliveryPlan = [
      ...[17, 24, 38, 45, 52, 59, 66, 73, 80].map(d => [d, 'Republic National', 'RN']),
      ...[20, 27, 34, 41, 48, 55, 62, 69, 76, 83].map(d => [d, 'Sysco Foods', 'SY']),
      ...[21, 28, 35, 42, 49, 56, 63, 70, 77, 84].map(d => [d, "Glazer's Beer & Bev", 'GLZ']),
      ...[22, 36, 50, 64, 78].map(d => [d, 'Austin Beerworks', 'ABW']),
      ...[19, 26, 33, 40, 47, 54, 61, 68, 75, 82].map(d => [d, 'Local Produce Co.', 'LPC']),
      ...[30, 58].map(d => [d, 'Restaurant Depot', 'RD']),
    ];
    icDeliveryPlan.forEach(([d, vn, pre], k) => {
      const del = mkVendorDelivery(d, vn, pre, (k % 5 === 0));
      if (del) App.inventoryData.ic_deliveries.push(del);
    });

    // ── Align pars to real usage so Dynamic Pars reads like a real operation ──
    // Bake the engine's OWN suggested par into each product so most products sit
    // right at par (nothing to change). A deliberate handful is left off: nine
    // carrying too much (Reduce) and three carrying too little (Increase), spread
    // across every vendor so the Order Sheet's per-card par nudge shows up on the
    // first card the operator opens. Uses the live computeSuggestion against the
    // counts + deliveries just built, so the seed can never drift from the screen.
    App.inventoryData.par_settings = App.inventoryData.par_settings || { window_weeks: 8, buffer_pct: 30, cycle_days: 7 };
    const parReduceSet   = new Set([0, 2, 6, 8, 9, 10, 14, 23, 32]); // par too high -> Reduce
    const parIncreaseSet = new Set([1, 19, 20]);                     // par too low  -> Increase
    icProducts.forEach((p, i) => {
      const sug = S.InventoryParSuggestions.computeSuggestion(p, App.inventoryData.par_settings);
      const suggested = (sug && sug.suggested > 0)
        ? sug.suggested
        : Math.max(1, Math.ceil((icWkUsage[i] || 0) * 1.3));
      let par = suggested;
      if (parReduceSet.has(i))        par = suggested + Math.max(2, Math.round(suggested * 0.5));
      else if (parIncreaseSet.has(i)) par = Math.max(1, suggested - Math.max(1, Math.round(suggested * 0.35)));
      p.par_level     = Math.max(1, par);
      p.reorder_point = Math.max(1, Math.round(p.par_level * 0.4));
    });

    // Spot checks — feed the Theft Risk pour-variance signal. flagged is COMPUTED
    // exactly like the live app (Variance Flag: off by more than the percent of
    // POS sold, either direction, past a 1-pour floor) so the demo never shows
    // anything different from what a real check produces. Default tolerance 5%.
    const SPOT_FLAG_PCT = 5;
    const icSpotItem = (p, pre, post, sold) => {
      const ppc = p.pours_per_container || 1, cpp = p.cost_per_pour || 0;
      const used = +(pre - post).toFixed(2);
      const poured = +(used * ppc).toFixed(1);
      const varP = +(poured - sold).toFixed(1);
      const pct = sold > 0 ? Math.abs(varP) / sold * 100 : (Math.abs(varP) > 0 ? 100 : 0);
      const flagged = Math.abs(varP) > 1 && pct >= SPOT_FLAG_PCT;
      return { product_id:p.id, name:p.name, category:p.category,
        pours_per_container:ppc, cost_per_pour:cpp, pre:pre, post:post,
        pos_sold:sold, used_containers:used, poured:poured,
        variance_pours:varP, variance_dollar:+(varP * cpp).toFixed(2), flagged:flagged };
    };
    const mkSpot = (daysAgo, items) => ({
      id:uid(), date:dateStr(daysAgo), shift:'PM', checked_by:'Maria G.',
      items:items, flag_pct:SPOT_FLAG_PCT, product_count:items.length,
      flagged_count:items.filter(i => i.flagged).length,
      total_variance_dollar:+items.reduce((t, i) => t + (i.variance_dollar || 0), 0).toFixed(2),
      created_at:daysAgoISO(daysAgo)
    });
    // Liquor at ~16.9 pours per 25.4 oz bottle (1.5 oz pour). Numbers are tuned to
    // a real, consistent mix: mostly clean, a recurring Tito's overpour that gets
    // cleaned up by the latest check, one Bulleit short-pour (under), and a new
    // Espolon overpour. flagged is computed, so both directions show in the demo.
    App.inventoryData.ic_spot_checks = [
      mkSpot(26, [
        icSpotItem(icProducts[0], 4,   1.0, 45),   // Tito's: poured 50.8 vs 45 → +5.8 over, flag
        icSpotItem(icProducts[2], 3,   0.7, 39),   // Bulleit: 38.9 vs 39 → clean
        icSpotItem(icProducts[1], 3,   1.1, 32),   // Espolon: 32.2 vs 32 → clean
      ]),
      mkSpot(19, [
        icSpotItem(icProducts[0], 4,   1.2, 42),   // Tito's: 47.4 vs 42 → +5.4 over, flag
        icSpotItem(icProducts[3], 2.5, 1.0, 26),   // Hendrick's: 25.4 vs 26 → clean
      ]),
      mkSpot(12, [
        icSpotItem(icProducts[0], 4,   0.9, 47),   // Tito's: 52.5 vs 47 → +5.5 over, flag
        icSpotItem(icProducts[2], 3,   1.0, 38),   // Bulleit: 33.9 vs 38 → -4.1 under (short pour), flag
      ]),
      mkSpot(4, [
        icSpotItem(icProducts[0], 4,   1.0, 51),   // Tito's: 50.8 vs 51 → clean (overpour fixed)
        icSpotItem(icProducts[1], 3.5, 1.0, 38),   // Espolon: 42.3 vs 38 → +4.3 over, flag
      ]),
    ];

    // ── Vendor Discrepancies ─────────────────────────────────────────────
    // A disciplined operator catches overcharges and chases most of them down.
    // Three caught and recovered, one still in Credit Requested (the filed-but-
    // uncollected credit the Profit Audit surfaces under Vendor Control). All
    // recent, none aging past 60 days. Feeds Inventory Execution + the BCA.
    App.data.vendor_discrepancies = [
      { id:uid(), date:dateStr(52), vendor:'Republic National', reference:'RN-54880', type:'Overcharge',
        product_id:icProducts[0].id, sku:icProducts[0].name, units:24, agreed_price:21.40, invoiced_price:22.65,
        overcharge:30, notes:'Billed above agreed case price', status:'Resolved', source:'manual',
        filed_at:daysAgoISO(52), resolved_at:daysAgoISO(40), recovered_amount:30 },
      { id:uid(), date:dateStr(33), vendor:'Sysco Foods', reference:'SY-90201', type:'Short Delivery',
        product_id:icProducts[9].id, sku:icProducts[9].name, units:8, agreed_price:4.20, invoiced_price:4.20,
        overcharge:34, notes:'Two cases short, caught at receiving', status:'Resolved', source:'manual',
        filed_at:daysAgoISO(33), resolved_at:daysAgoISO(22), recovered_amount:34 },
      { id:uid(), date:dateStr(21), vendor:'Republic National', reference:'RN-55021', type:'Overcharge',
        product_id:icProducts[2].id, sku:icProducts[2].name, units:12, agreed_price:27.90, invoiced_price:28.90,
        overcharge:12, notes:'Price drift on a single line', status:'Resolved', source:'manual',
        filed_at:daysAgoISO(21), resolved_at:daysAgoISO(12), recovered_amount:12 },
      { id:uid(), date:dateStr(11), vendor:"Glazer's Beer & Bev", reference:'GLZ-3402', type:'Overcharge',
        product_id:icProducts[6].id, sku:icProducts[6].name, units:48, agreed_price:1.35, invoiced_price:1.50,
        overcharge:72, notes:'Unagreed price increase, credit requested', status:'Credit Requested', source:'manual',
        filed_at:daysAgoISO(11), resolved_at:null },
    ];

    // ── Inventory Adjustment Log ─────────────────────────────────────────
    // A few documented adjustments across the trailing 8 weeks: a couple of
    // bottles broken behind the bar, one expiration write-off, one confirmed
    // theft event (feeds Theft Risk), and a found-stock entry. Gives the
    // operator a realistic view of how the log accumulates without making the
    // numbers ugly.
    const adjAt = (daysAgo, hour, min) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      d.setHours(hour, min, 0, 0);
      return d.toISOString().slice(0, 16);
    };
    const adjValue = (product, qty, unit) => {
      let bottles = qty;
      if (product.category === 'Bottle Beer' && unit === 'cases' && product.case_size) bottles = qty * product.case_size;
      const perBottleCost = product.unit_cost != null
        ? (product.category === 'Bottle Beer' && product.case_size ? product.unit_cost / product.case_size : product.unit_cost)
        : 0;
      return { bottles, perBottleCost, value: bottles * perBottleCost };
    };
    const mkAdj = (daysAgo, hour, min, productIdx, qty, unit, direction, reason, performed, notes) => {
      const p = icProducts[productIdx];
      const v = adjValue(p, qty, unit);
      return {
        id: uid(),
        date_time: adjAt(daysAgo, hour, min),
        product_id: p.id, product_name: p.name, category: p.category || '',
        quantity: qty, unit,
        direction, reason,
        unit_cost_at_adjustment: v.perBottleCost,
        value: v.value,
        performed_by_id: '', performed_by: performed,
        witnessed_by_id: '', witnessed_by: '',
        notes,
        created_at: new Date().toISOString()
      };
    };
    App.inventoryData.ic_adjustments = [
      mkAdj(48, 22, 10, 0, 1, 'bottles', 'out', 'Damage', 'Maria G.',
        'Bartender knocked it off the back bar mid-shift. No injuries.'),
      mkAdj(32, 14, 30, 3, 2, 'units', 'out', 'Expiration', 'Carlos P.',
        'Past expiration on the back shelf. Pulled and trashed.'),
      mkAdj(18, 9, 45, 1, 1, 'bottles', 'out', 'Theft', 'Jake T.',
        'Found empty in the dumpster, never on a check. Reviewing camera footage.'),
      mkAdj(6, 11, 20, 2, 0.5, 'bottles', 'out', 'Damage', 'Maria G.',
        'Cracked bottle during a transfer from storage.'),
      mkAdj(3, 16, 0, 0, 1, 'bottles', 'in', 'Found', 'Carlos P.',
        'Found a bottle behind a stack in the liquor room. Adding it back.')
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

    // ── Cash settings + Drawers (Phase 0.5) ────────────────────────────────
    if (!App.shiftData.settings) App.shiftData.settings = {};
    App.shiftData.settings.cash_tolerance = 10;
    App.shiftData.settings.tolerances_by_type = {
      'Brunch':     10,
      'Lunch':      10,
      'Dinner':     15,
      'Late Night': 20,
      'Full Day':   15
    };
    // Comp over this dollar amount should carry a manager in Authorized By.
    App.shiftData.settings.comp_auth_threshold = 25;

    // Drawers reference table. Seeded with realistic registers so the
    // dropdowns on Cash Drop and Variance Log render with options out of
    // the box. Default opening bank pre-fills the Start a Shift bank field
    // when the matching drawer is the one tonight runs on.
    App.shiftData.sc_drawers = [
      { id: App.uid(), name: 'Main Bar Register',     location: 'Main Bar',       default_opening_bank: 300, notes: '', active: true, created_at: new Date().toISOString() },
      { id: App.uid(), name: 'Service Bar Register',  location: 'Back Bar',       default_opening_bank: 200, notes: 'Server-only well', active: true, created_at: new Date().toISOString() },
      { id: App.uid(), name: 'Floor Register 1',      location: 'Front of House', default_opening_bank: 250, notes: '', active: true, created_at: new Date().toISOString() },
      { id: App.uid(), name: 'Floor Register 2',      location: 'Front of House', default_opening_bank: 250, notes: '', active: true, created_at: new Date().toISOString() }
    ];
    const scDrawers = App.shiftData.sc_drawers;

    // Each operating day runs multiple typed services that sum to the day's
    // bar_rev / food_rev / covers, so the weekly revenue feed is unchanged but
    // Shift Reports (by type) and the per-type cash tolerances demo realistically.
    // Weekends open with Brunch, weekdays with Lunch, and Dinner anchors the day.
    // ── Close-out seed helpers (cash recon / tip recon / handoff) ────────────
    // The recap reads the close-wizard blocks; the seed predated them, so closed
    // sample shifts had empty recaps. Cash is ~15% of revenue, dropped toward the
    // bank through service; drawers end within tolerance except a deterministic
    // handful with a real over/short to demo the catch. Registers vary by daypart.
    const REG_BANKS = { 'Main Bar Register': 300, 'Service Bar Register': 200, 'Floor Register 1': 250, 'Floor Register 2': 250 };
    const DAYPART_REGS = {
      Brunch: ['Main Bar Register', 'Floor Register 1'],
      Lunch: ['Main Bar Register', 'Floor Register 1'],
      Dinner: ['Main Bar Register', 'Service Bar Register', 'Floor Register 1', 'Floor Register 2'],
      'Late Night': ['Main Bar Register', 'Service Bar Register']
    };
    const CASH_MISS = [0, 0, 0, 4, 0, -3, 0, 0, -18, 0, 5, 0, 16, -2, 0];
    const seedCashRecon = (shiftType, totalRev, idx) => {
      const regs = DAYPART_REGS[shiftType] || ['Main Bar Register'];
      const cashTotal = Math.round(totalRev * 0.15);
      const miss = CASH_MISS[idx % CASH_MISS.length];
      const drawers = regs.map((name, di) => {
        const opening = REG_BANKS[name] || 200;
        const sales_cash = Math.round(cashTotal / regs.length);
        const drops_total = Math.max(0, Math.floor(sales_cash / 20) * 20);
        const expected = opening + sales_cash - drops_total;
        const counted_cash = expected + (di === 0 ? miss : 0);
        const variance = counted_cash - expected;
        const status = Math.abs(variance) <= 10 ? 'Within Tolerance' : (variance < 0 ? 'Short' : 'Over');
        return { drawer_id: '', name, opening_bank: opening, drops_total, sales_cash, expected, counted_cash, variance, status };
      });
      const sum = k => drawers.reduce((t, d) => t + d[k], 0);
      const expected = sum('expected'), counted_cash = sum('counted_cash');
      return { drawers, opening_bank: sum('opening_bank'), drops_total: sum('drops_total'),
        sales_cash: sum('sales_cash'), expected, counted_cash, variance: counted_cash - expected, skipped: false };
    };
    const TIP_MISS = [0, 0, 6, 0, -4, 0, 9, 0, -3, 0];
    const seedTipRecon = (totalRev, idx) => {
      const logged = Math.round(totalRev * 0.18);
      const pos = logged + TIP_MISS[idx % TIP_MISS.length];
      return { logged_total: logged, pos_reported: pos, variance: logged - pos };
    };
    const SEED_HANDOFFS = [
      'Slow start, picked up after seven. Walk-in running a touch warm, flagged it to maintenance.',
      'Busy all night. Down to the last case of the house red, get an order in before tomorrow.',
      'Smooth shift. Comped a birthday round for a regular, approved.',
      'Short a server, the team covered well. Bourbon delivery came up light, check the invoice.',
      'Steady night. Floor 2 card reader glitched twice, give it a restart at open.',
      ''
    ];
    const SEED_SHIFT_NOTES = [
      'VIP four-top at nine, comped dessert.',
      'Delivery short on limes, ran to the store.',
      'Large party walk-in, watched the door the rest of the night.',
      'Server sent home sick after first turn, covered the section.'
    ];
    const seedShiftNotes = (date, idx) => idx % 6 === 0
      ? [{ id: uid(), at: date + 'T20:30:00', text: SEED_SHIFT_NOTES[idx % SEED_SHIFT_NOTES.length], manager_id: '' }]
      : [];

    const scShifts = [];
    const scDays   = [];   // one entry per operating day, drives the checklists
    ANCHS.weeks.forEach(a => {
      const baseAgo = sunOff + ANCHS.endAgo(a);
      let barLeft = a.bar_rev, foodLeft = a.food_rev, covLeft = a.covers;
      dayW.forEach((w, di) => {
        const last     = di === dayW.length - 1;
        const dayBar   = last ? barLeft  : Math.round(a.bar_rev  * w);
        const dayFloor = last ? foodLeft : Math.round(a.food_rev * w);
        const dayCov   = last ? covLeft  : Math.round(a.covers   * w);
        barLeft -= dayBar; foodLeft -= dayFloor; covLeft -= dayCov;
        const date    = dateStr(baseAgo + 6 - di);
        const weekend = di >= 5;
        const isLastWeek = a.wk === ANCHS.weeks.length;
        // daypart: [type, revenue share, staff on floor]. Dinner is the anchor.
        const parts = weekend
          ? [['Brunch', 0.35, 7], ['Dinner', 0.45, 9], ['Late Night', 0.20, 5]]
          : [['Lunch', 0.30, 5], ['Dinner', 0.50, 8], ['Late Night', 0.20, 4]];
        let bLeft = dayBar, fLeft = dayFloor, cLeft = dayCov;
        parts.forEach((p, pi) => {
          const lastPart = pi === parts.length - 1;
          const bar   = lastPart ? bLeft : Math.round(dayBar   * p[1]);
          const floor = lastPart ? fLeft : Math.round(dayFloor * p[1]);
          const cov   = lastPart ? cLeft : Math.round(dayCov   * p[1]);
          bLeft -= bar; fLeft -= floor; cLeft -= cov;
          // Phase 0: weather_tag gives the audits real context so a low-revenue
          // Friday during a thunderstorm reads as bad luck, not bad ops. (Event
          // P&L no longer reads a shift tag; it uses the checked event staff in
          // Build Schedule. See ev-bookings eventStaffShifts.)
          const weatherTag = (a.wk === ANCHS.weeks.length - 3 && di === 4 && p[0] === 'Dinner') ? 'thunderstorm' : '';
          const sIdx = scShifts.length;
          const cashRecon = seedCashRecon(p[0], bar + floor, sIdx);
          scShifts.push({
            id:uid(), date:date, shift_type:p[0],
            manager:mgrs[(di + pi) % 3], bar_revenue:bar, floor_revenue:floor,
            total_revenue:bar + floor, covers:cov, opening_bank:cashRecon.opening_bank,
            staff_on_floor:p[2], status:'Closed', notes:'',
            cash_recon:cashRecon, tip_recon:seedTipRecon(bar + floor, sIdx),
            handoff_notes:SEED_HANDOFFS[sIdx % SEED_HANDOFFS.length], shift_notes:seedShiftNotes(date, sIdx),
            weather_tag:weatherTag,
            created_at:new Date().toISOString()
          });
        });
        scDays.push({ date:date, manager:mgrs[di % 3] });
      });
    });
    App.shiftData.sc_shifts = scShifts;

    // ── Checklist Templates + Opening / Closing runs ──
    // Templates mirror the built-in defaults so the Templates library is not
    // empty and the runs reference a real template. One run of each per operating
    // DAY (not per service). A disciplined, recovered operation runs at near-100%
    // completion with the rare item missed. Records match what the run screens
    // save: the full items array plus done_count / total_count.
    const scOpenItems  = (window.S && S.ShiftOpeningChecklist && S.ShiftOpeningChecklist.DEFAULT_ITEMS) || [];
    const scCloseItems = (window.S && S.ShiftClosingChecklist && S.ShiftClosingChecklist.DEFAULT_ITEMS) || [];
    const scOpenTplId  = uid();
    const scCloseTplId = uid();
    App.shiftData.sc_checklist_templates = [
      { id:scOpenTplId,  name:'Standard Open',  type:'Opening', items:scOpenItems.slice(),  created_at:new Date().toISOString() },
      { id:scCloseTplId, name:'Standard Close', type:'Closing', items:scCloseItems.slice(), created_at:new Date().toISOString() },
    ];
    const mkChkItems = (arr, doneN) => arr.map((text, idx) => ({ text:text, done:idx < doneN }));
    const scChecklists = [];
    scDays.forEach((d, i) => {
      const mgr = d.manager;
      const openDone  = (i % 9 === 0) ? scOpenItems.length  - 1 : scOpenItems.length;   // ~89% fully complete
      const closeDone = (i % 7 === 0) ? scCloseItems.length - 1 : scCloseItems.length;  // ~86% fully complete
      scChecklists.push({ id:uid(), type:'Opening', template_id:scOpenTplId, template_name:'Standard Open',
        date:d.date, completed_by:mgr, completed_by_id:'', items:mkChkItems(scOpenItems, openDone),
        done_count:openDone, total_count:scOpenItems.length, notes:'',
        completed_at:new Date().toISOString(), created_at:new Date().toISOString() });
      scChecklists.push({ id:uid(), type:'Closing', template_id:scCloseTplId, template_name:'Standard Close',
        date:d.date, completed_by:mgr, completed_by_id:'', items:mkChkItems(scCloseItems, closeDone),
        done_count:closeDone, total_count:scCloseItems.length, notes:'',
        completed_at:new Date().toISOString(), created_at:new Date().toISOString() });
    });
    App.shiftData.sc_checklists = scChecklists;

    // Drawer reconciliations — variance tightens after the fix week.
    const scVariances = [];
    ANCHS.weeks.forEach(a => {
      const baseAgo = sunOff + ANCHS.endAgo(a);
      const improving = !a.loose;
      [1, 4].forEach((dayOff, vi) => {
        const exp = 600 + Math.round(Math.random() * 350);
        const variance = improving
          ? Math.round((Math.random() - 0.55) * 12)
          : Math.round((Math.random() - 0.75) * 30);
        scVariances.push({
          id:uid(), date:dateStr(baseAgo + dayOff), shift_type:'Close',
          drawer_id: scDrawers[vi % scDrawers.length].id,
          drawer:    scDrawers[vi % scDrawers.length].name,
          cashier:mgrs[(a.wk + vi) % 3],
          source:'shift-close',
          expected_cash:exp, counted_cash:exp + variance, variance:variance,
          tolerance:10, status:Math.abs(variance) <= 10 ? 'Within Tolerance' : variance < 0 ? 'Short' : 'Over',
          reason:'', notes:'', created_at:new Date().toISOString()
        });
      });
    });
    App.shiftData.sc_variances = scVariances;

    // Voids and comps — fewer events and all manager-authorized after the fix.
    // Phase 0: comp records carry product_id + units so the Inventory Variance
    // Report can subtract comp pours from "used." Voids stay product-less
    // (assumed pre-pour, not subtracted from variance). staff_id gets patched
    // in after lcStaff is built (below).
    const vcServers = ['Jessica M.', 'Marcus T.', 'Brianna K.', 'Devin R.', 'Carlos P.'];
    const findProdId = (name) => (icProducts.find(p => p.name === name) || {}).id || '';
    const findMenuId = (name) => (((App.data && App.data.menu_items) || []).find(m => m.name === name) || {}).id || '';
    const vcShifts = ['Dinner', 'Late Night', 'Dinner', 'Lunch', 'Brunch', 'Dinner'];
    // Voids = a sale reversed (error). Comps = a sale given away, carrying a
    // category that splits loss (Customer Comp / Service Recovery) from policy
    // expense (Staff Meal / Shift Drink). Some comps link to a tracked product so
    // the Variance Report subtracts the known pour. The mix and the unauthorized
    // rate ease off after the fix week, matching the audit arc.
    const VOID_SC = [
      { kind:'menu',   name:'Anchor Burger',           reason:'Wrong item',            amount:18 },
      { kind:'menu',   name:'House Margarita',         reason:'Customer changed mind', amount:14 },
      { kind:'menu',   name:'Fish and Chips',          reason:'Kitchen error',         amount:21 },
      { kind:'custom', name:'Draft pour, over-poured', reason:'Rung in error',         amount:8  },
      { kind:'menu',   name:'Steak Frites',            reason:'Sent back',             amount:34 },
      { kind:'menu',   name:'Old Fashioned',           reason:'Rung in error',         amount:16 },
      { kind:'menu',   name:'Pan-Seared Salmon',       reason:'Sent back',             amount:29 },
      { kind:'menu',   name:'Whiskey Sour',            reason:'Wrong item',            amount:15 }
    ];
    // Comps. The reason carries the loss-vs-expense class (App.SC_COMP_REASONS):
    // customer-facing reasons are loss, Staff Meal and Shift Drink are policy
    // expense. kind:'none' is an amount-only comp (a whole-check give-away, no
    // single item). Product comps carry units for the Variance Report.
    const COMP_SC = [
      { kind:'none',    name:'',                             reason:'Service Recovery',  amount:46 },
      { kind:'menu',    name:'Old Fashioned',                reason:'Service Recovery',  amount:16 },
      { kind:'menu',    name:'Anchor Burger',                reason:'Customer Goodwill', amount:18 },
      { kind:'product', name:'House Cabernet',               reason:'Regular / VIP',     units:1, amount:13 },
      { kind:'custom',  name:'Staff meal, Brisket Sandwich', reason:'Staff Meal',        amount:14 },
      { kind:'menu',    name:'Pan-Seared Salmon',            reason:'Service Recovery',  amount:29 },
      { kind:'none',    name:'',                             reason:'Manager Comp',      amount:24 },
      { kind:'product', name:'Modelo',                       reason:'Marketing / Promo', units:1, amount:6  },
      { kind:'custom',  name:'Shift drink, Lone Star',       reason:'Shift Drink',       amount:5  },
      { kind:'product', name:"Tito's Handmade Vodka",        reason:'Regular / VIP',     units:1, amount:12 },
      { kind:'menu',    name:'Anchor Burger',                reason:'Customer Goodwill', amount:18 },
      { kind:'custom',  name:'Staff meal, Cobb Salad',       reason:'Staff Meal',        amount:13 }
    ];
    const VC_THRESHOLD = 25;
    const scVoidComps = [];
    let vcVi = 0, vcCi = 0;
    ANCHS.weeks.forEach(a => {
      const baseAgo = sunOff + ANCHS.endAgo(a);
      const improving = !a.loose;
      const voidN = improving ? 1 : 3;
      const compN = improving ? 1 : 2;
      let vcDay = 1;
      for (let j = 0; j < voidN; j++) {
        const s = VOID_SC[vcVi % VOID_SC.length]; vcVi++;
        scVoidComps.push({
          id:uid(), date:dateStr(baseAgo + vcDay++), type:'Void', shift_type:vcShifts[(a.wk + j) % vcShifts.length],
          item:s.name, menu_item_id:(s.kind === 'menu' ? findMenuId(s.name) : ''),
          product_id:'', product_name:'', units:null, amount:s.amount,
          server:vcServers[(a.wk + j) % vcServers.length], staff_id:'',
          authorized_by:improving ? mgrs[(a.wk + j) % 3] : (j === 0 ? '' : mgrs[j % 3]),
          check_number:'', reason:s.reason, notes:'', auth_threshold_override:false,
          created_at:new Date().toISOString()
        });
      }
      for (let j = 0; j < compN; j++) {
        const s = COMP_SC[vcCi % COMP_SC.length]; vcCi++;
        // Pre-fix, comps concentrate on one server, which feeds the Theft Risk pattern.
        const server = (!improving && j === 0) ? 'Brianna K.' : vcServers[(a.wk + j + 2) % vcServers.length];
        const pid = s.kind === 'product' ? findProdId(s.name) : '';
        const noAuth = !improving && ((a.wk + j) % 2 === 0);
        scVoidComps.push({
          id:uid(), date:dateStr(baseAgo + vcDay++), type:'Comp', shift_type:vcShifts[(a.wk + j + 1) % vcShifts.length],
          item:(s.kind === 'none' ? '' : s.name), menu_item_id:(s.kind === 'menu' ? findMenuId(s.name) : ''),
          product_id:pid, product_name:(pid ? s.name : ''), units:(pid ? (s.units || 1) : null),
          amount:s.amount, server:server, staff_id:'',
          authorized_by:noAuth ? '' : mgrs[(a.wk + j) % 3],
          check_number:'', reason:s.reason, notes:'',
          auth_threshold_override:(noAuth && s.amount > VC_THRESHOLD),
          created_at:new Date().toISOString()
        });
      }
    });
    App.shiftData.sc_void_comps = scVoidComps;

    // One Saturday cash drop per week. Each drop also seeds a mirrored
    // sc_safe_log entry so the Cash Control safe balance is honest from
    // load (Phase 2 Chunk A auto-mirror only fires for NEW drops; sample
    // drops have to seed both stores by hand).
    const scCashDrops = [];
    const scSafeLog = [];
    ANCHS.weeks.forEach(a => {
      const baseAgo = sunOff + ANCHS.endAgo(a);
      const dropId = uid();
      const safeId = uid();
      const dropDate = dateStr(baseAgo + 1);
      const dropAmount = 900 + Math.round(Math.random() * 500);
      const performed = mgrs[a.wk % 3];
      const witness   = mgrs[(a.wk + 1) % 3];
      scCashDrops.push({
        id:dropId, date:dropDate, shift_type:'Close', drop_time:'23:30',
        drawer_id: scDrawers[0].id, drawer: scDrawers[0].name,
        performed_by:performed, witness:witness,
        amount:dropAmount, denominations:{}, notes:'',
        safe_log_id: safeId,
        created_at:new Date().toISOString()
      });
      scSafeLog.push({
        id:safeId, date:dropDate, time:'23:30',
        txn_type:'Cash Drop', direction:'in', amount:dropAmount,
        reference:'Drawer: ' + scDrawers[0].name + ' / Close',
        performed_by:performed, witness:witness, notes:'',
        source:'cash-drop', source_id:dropId,
        created_at:new Date().toISOString()
      });
    });
    // Seed a couple of bank deposit out entries so Net In Window can swing
    // negative on some windows — gives the operator a realistic demo.
    scSafeLog.push({
      id:uid(), date:dateStr(10), time:'09:30',
      txn_type:'Bank Deposit', direction:'out', amount:6500,
      reference:'Tuesday deposit run', performed_by:mgrs[0], witness:'', notes:'',
      source:'safe-log', created_at:new Date().toISOString()
    });
    scSafeLog.push({
      id:uid(), date:dateStr(38), time:'09:15',
      txn_type:'Bank Deposit', direction:'out', amount:5200,
      reference:'Tuesday deposit run', performed_by:mgrs[1], witness:'', notes:'',
      source:'safe-log', created_at:new Date().toISOString()
    });
    App.shiftData.sc_cash_drops = scCashDrops;
    App.shiftData.sc_safe_log = scSafeLog;

    // Currently-out items (status '86') are recent; older ones are Back In Stock
    // (status 'Back' + date_back). Ribeye, Hazy IPA, and the Espresso Martini
    // repeat across the window so the repeat-86 -> Inventory par alert has signal.
    App.shiftData.sc_86_list = [
      { id:uid(), item:'Ribeye (10 oz)',      category:'Food',       reason:'Out of product, delivery Thursday',
        date_86:dateStr(2),  time_86:'19:40', reported_by:'Luis V.',   status:'86',   date_back:'',          notes:'', created_at:new Date().toISOString() },
      { id:uid(), item:'Espresso Martini',    category:'Cocktails',  reason:'Espresso machine down',
        date_86:dateStr(1),  time_86:'18:10', reported_by:'Maria G.',  status:'86',   date_back:'',          notes:'', created_at:new Date().toISOString() },
      { id:uid(), item:'House Chardonnay',    category:'Wine',       reason:'Ran the case, reorder placed',
        date_86:dateStr(4),  time_86:'21:30', reported_by:'Jake T.',   status:'86',   date_back:'',          notes:'', created_at:new Date().toISOString() },
      { id:uid(), item:'Burrata',             category:'Food',       reason:'Out until morning prep',
        date_86:dateStr(9),  time_86:'12:30', reported_by:'Hector M.', status:'Back', date_back:dateStr(9),  notes:'', created_at:new Date().toISOString() },
      { id:uid(), item:'Hazy IPA',            category:'Draft Beer', reason:'Keg blew, tapping new in the morning',
        date_86:dateStr(12), time_86:'22:15', reported_by:'Maria G.',  status:'Back', date_back:dateStr(11), notes:'', created_at:new Date().toISOString() },
      { id:uid(), item:'Ribeye (10 oz)',      category:'Food',       reason:'Short on the delivery again',
        date_86:dateStr(16), time_86:'20:05', reported_by:'Sam P.',    status:'Back', date_back:dateStr(15), notes:'', created_at:new Date().toISOString() },
      { id:uid(), item:'Oysters',             category:'Food',       reason:'Daily count sold out',
        date_86:dateStr(18), time_86:'21:00', reported_by:'Luis V.',   status:'Back', date_back:dateStr(18), notes:'', created_at:new Date().toISOString() },
      { id:uid(), item:'Branzino',            category:'Food',       reason:'Sold out at dinner',
        date_86:dateStr(24), time_86:'20:30', reported_by:'Sam P.',    status:'Back', date_back:dateStr(24), notes:'', created_at:new Date().toISOString() },
      { id:uid(), item:'Hazy IPA',            category:'Draft Beer', reason:'Keg kicked mid-service',
        date_86:dateStr(27), time_86:'21:45', reported_by:'Jake T.',   status:'Back', date_back:dateStr(26), notes:'', created_at:new Date().toISOString() },
      { id:uid(), item:'Ribeye (10 oz)',      category:'Food',       reason:'Weekend rush sold out',
        date_86:dateStr(33), time_86:'20:50', reported_by:'Hector M.', status:'Back', date_back:dateStr(33), notes:'', created_at:new Date().toISOString() },
      { id:uid(), item:'Espresso Martini',    category:'Cocktails',  reason:'Out of espresso beans',
        date_86:dateStr(31), time_86:'19:00', reported_by:'Ashley B.', status:'Back', date_back:dateStr(30), notes:'', created_at:new Date().toISOString() },
      { id:uid(), item:'Barrel Old Fashioned',category:'Cocktails',  reason:'Barrel batch empty, re-batching',
        date_86:dateStr(38), time_86:'18:40', reported_by:'Maria G.',  status:'Back', date_back:dateStr(37), notes:'', created_at:new Date().toISOString() },
      { id:uid(), item:'House Margarita',     category:'Cocktails',  reason:'Out of fresh lime',
        date_86:dateStr(45), time_86:'18:20', reported_by:'Jake T.',   status:'Back', date_back:dateStr(44), notes:'', created_at:new Date().toISOString() },
    ];

    // A real mix of Open / In Progress / Resolved across the window. Resolved
    // rows carry a resolution date and the repair cost so the cost rollup is
    // honest. The open Walk-in Cooler ties to the same equipment as the temp
    // checklist item and the cooler running warm.
    App.shiftData.sc_maintenance = [
      { id:uid(), date_reported:dateStr(3),  equipment:'Walk-in Cooler', location:'Kitchen',
        issue:'Temperature running 4 degrees high', priority:'High', status:'Open',
        reported_by:'Luis V.', assigned_to:'CoolTech Repair', date_resolved:'', cost:null, notes:'', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(6),  equipment:'Beer Tap 3', location:'Main Bar',
        issue:'Foaming, needs line cleaning and FOB check', priority:'Normal', status:'Open',
        reported_by:'Jake T.', assigned_to:'', date_resolved:'', cost:null, notes:'', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(8),  equipment:'Ice Machine', location:'Main Bar',
        issue:'Slow ice production', priority:'Normal', status:'In Progress',
        reported_by:'Maria G.', assigned_to:'CoolTech Repair', date_resolved:'', cost:null, notes:'Tech scheduled', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(11), equipment:'Dish Machine', location:'Kitchen',
        issue:'Not reaching sanitizing temp', priority:'Urgent', status:'Resolved',
        reported_by:'Luis V.', assigned_to:'Ecolab', date_resolved:dateStr(10), cost:310, notes:'', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(14), equipment:'Walk-in Cooler', location:'Kitchen',
        issue:'Door gasket torn, not sealing', priority:'High', status:'Resolved',
        reported_by:'Hector M.', assigned_to:'CoolTech Repair', date_resolved:dateStr(10), cost:220, notes:'', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(18), equipment:'Glass Washer', location:'Main Bar',
        issue:'Leaving spots, rinse aid line', priority:'Low', status:'Resolved',
        reported_by:'Ashley B.', assigned_to:'', date_resolved:dateStr(17), cost:null, notes:'Adjusted rinse aid in-house', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(20), equipment:'POS Terminal 2', location:'Front of House',
        issue:'Card reader intermittent', priority:'Normal', status:'Resolved',
        reported_by:'Jessica M.', assigned_to:'POS Vendor', date_resolved:dateStr(16), cost:140, notes:'', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(25), equipment:'Mens Restroom', location:'Front of House',
        issue:'Faucet leaking at the base', priority:'Low', status:'Resolved',
        reported_by:'Owen L.', assigned_to:'Handyman', date_resolved:dateStr(21), cost:85, notes:'', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(30), equipment:'HVAC', location:'Dining Room',
        issue:'Dining room runs warm on busy Saturdays', priority:'Normal', status:'Open',
        reported_by:'Carlos P.', assigned_to:'CoolTech Repair', date_resolved:'', cost:null, notes:'', created_at:new Date().toISOString() },
    ];

    // ── Fix Layer — logged fixes feeding the Recovery Scoreboard ──
    // Each system STARTS when the operator first works it, which for The Anchor
    // is the beginning of the logged history (week 1, ~77 days back). Recovery is
    // then COMPUTED honestly by the engine: those first weeks are the baseline (a
    // loose start), and the improving arc that follows shows up as real recovered
    // dollars, exactly as a live user's would. No backdated "fix landed here"
    // fantasy. Reviews stays untracked (absent from Recovery.METRICS by design,
    // too indirect to dollarize) so the demo also shows how an untracked fix renders.
    const fxStart = dateStr(77), fxStartISO = daysAgoISO(77);
    App.data.fix_log = (App.data.fix_log || [])
      .filter(e => e.module !== 'profit' && e.module !== 'revenue' && e.module !== 'traffic')
      .concat([
      { id:uid(), module:'profit', gap_id:'pour-cost',  gap_name:'Pour Cost',           date:fxStart, logged_at:fxStartISO },
      { id:uid(), module:'profit', gap_id:'food-cost',  gap_name:'Food Cost',           date:fxStart, logged_at:fxStartISO },
      { id:uid(), module:'profit', gap_id:'prime-cost', gap_name:'Prime Cost',          date:fxStart, logged_at:fxStartISO },
      { id:uid(), module:'profit', gap_id:'theft-loss', gap_name:'Theft and Loss',      date:fxStart, logged_at:fxStartISO },
      { id:uid(), module:'revenue', gap_id:'check-average',    gap_name:'Check Average and Upsell',  date:fxStart, logged_at:fxStartISO },
      { id:uid(), module:'revenue', gap_id:'labor-scheduling', gap_name:'Labor Cost and Scheduling', date:fxStart, logged_at:fxStartISO },
      { id:uid(), module:'revenue', gap_id:'rplh',            gap_name:'Labor Productivity (RPLH)',  date:fxStart, logged_at:fxStartISO },
      { id:uid(), module:'traffic', gap_id:'gbp',           gap_name:'Google Business',         date:fxStart, logged_at:fxStartISO },
      { id:uid(), module:'traffic', gap_id:'website',       gap_name:'Website',                 date:fxStart, logged_at:fxStartISO },
      { id:uid(), module:'traffic', gap_id:'social',        gap_name:'Social Media',            date:fxStart, logged_at:fxStartISO },
      { id:uid(), module:'traffic', gap_id:'email-loyalty', gap_name:'Email Marketing',          date:fxStart, logged_at:fxStartISO },
      { id:uid(), module:'traffic', gap_id:'delivery',      gap_name:'Delivery Platforms',      date:fxStart, logged_at:fxStartISO },
      { id:uid(), module:'traffic', gap_id:'reviews',       gap_name:'Reviews',                 date:fxStart, logged_at:fxStartISO },
    ]);

    // ── Variance Investigations ──
    App.data.variance_investigations = [
      { id:uid(), product_id:findProdId("Tito's Handmade Vodka"), sku:"Tito's Handmade Vodka", opened_date:dateStr(38),
        status:'resolved', resolved_date:dateStr(24),
        steps:[
          { done:true, finding:'Count sheets pulled. One 1L bottle was missed in the back well on the period-open count.' },
          { done:true, finding:'Theoretical usage recalculated. The gap closed to under 2% once the missed bottle was added back.' },
          { done:true, finding:'Variance traced to two consecutive Friday late shifts.' },
          { done:true, finding:'Bar manager confirmed a keg-line spill on one of those shifts that was never logged.' },
          { done:true, finding:'Mid-shift count run the following Friday came back clean.' },
          { done:true, finding:'Closed as a counting error plus one unlogged spill. No theft indicated.' },
        ],
        resolution:'Counting error plus an unlogged spill. Added a spill line to the closing checklist so breakage gets recorded from here on.' },
      { id:uid(), product_id:findProdId('Espolòn Tequila Blanco'), sku:'Espolòn Tequila Blanco', opened_date:dateStr(9),
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
      { name:'Assistant Manager', department:'Management', default_wage:24,               tipped:false },
    ].map(p => ({ id:uid(), created_at:new Date().toISOString(), ...p }));
    App.laborData.lc_positions = lcPositions;
    const lcPos = n => lcPositions.find(p => p.name === n).id;

    // Phase 0: wage_history captures every wage change so historical labor
    // cost reads correctly off the wage in effect on the entry date, not the
    // current wage. Empty on fresh hires (their current wage is the starting wage).
    const mkStaff = (name, posName, wage, hiredDaysAgo) => ({
      id:uid(), name:name, position_id:lcPos(posName), pay_type:'Hourly', wage:wage, annual_salary:null,
      status:'Active', hire_date:dateStr(hiredDaysAgo), phone:'', email:'',
      wage_history:[], created_at:new Date().toISOString()
    });
    // Salaried (exempt): fixed annual salary, no hourly wage and no overtime.
    const mkSalaried = (name, posName, annual, hiredDaysAgo) => ({
      id:uid(), name:name, position_id:lcPos(posName), pay_type:'Salary', wage:null, annual_salary:annual,
      status:'Active', hire_date:dateStr(hiredDaysAgo), phone:'', email:'',
      wage_history:[], created_at:new Date().toISOString()
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
      mkSalaried('Carlos P.', 'Manager',           68000, 520),
      mkSalaried('Renee K.',  'Assistant Manager', 52000, 300),
    ];
    App.laborData.lc_staff = lcStaff;

    // ════════════════════════════════════════════════════════════════════
    //  INVENTORY OPERATIONS LOGS — Empties, Transfers, Order History, and the
    //  staff link for Adjustments. Seeded here (not up in the inventory block)
    //  because every one of these forms requires a real staff member for
    //  Performed By / Witnessed By — a record seeded with an empty staff id
    //  would fail the form's own open->save round trip. icProducts, icByName,
    //  dateStr, daysAgoISO and adjAt are all still in loadSample scope.
    // ════════════════════════════════════════════════════════════════════
    const staffIdByName = nm => (lcStaff.find(s => s.name === nm) || {}).id || '';

    // Link the Adjustment records (seeded earlier, before the roster existed)
    // to real staff so each one round-trips through the form's required
    // "Performed By" instead of failing validation on Update.
    (App.inventoryData.ic_adjustments || []).forEach(a => {
      if (!a.performed_by_id && a.performed_by) a.performed_by_id = staffIdByName(a.performed_by);
    });

    // ── Empties Log ──────────────────────────────────────────────────────
    // The real back-door routine over the trailing ~12 weeks. Austin has no
    // bottle-deposit law, so empty glass/cans are Recycle at $0 (honest — the
    // Deposit Value tile stays empty for those). Empty kegs carry a real
    // distributor deposit, logged Return for Deposit so the deposit credit is
    // tracked. One Trash line for glass that broke in the bin.
    const mkEmpty = (daysAgo, prodName, qty, unit, disposition, by, deposit, notes) => {
      const p = icByName(prodName) || {};
      return { id:uid(), date:dateStr(daysAgo), product_id:p.id || '', product_name:p.name || prodName,
        category:p.category || '', quantity:qty, unit, deposit_amount:deposit || 0,
        disposition, performed_by_id:staffIdByName(by), performed_by:by, notes:notes || '',
        created_at:daysAgoISO(daysAgo) };
    };
    App.inventoryData.ic_empties = [
      mkEmpty(82, "Tito's Handmade Vodka", 9, 'bottles', 'Recycle', 'Devin R.', 0, 'Weekly well-liquor empties to recycling.'),
      mkEmpty(82, 'House Cabernet', 14, 'bottles', 'Recycle', 'Devin R.', 0, ''),
      mkEmpty(78, 'ABW Pearl Snap (1/2 bbl)', 2, 'kegs', 'Return for Deposit', 'Carlos P.', 30, 'Empty kegs back to Austin Beerworks, deposit credited.'),
      mkEmpty(71, 'Modelo Especial', 96, 'bottles', 'Recycle', 'Devin R.', 0, 'Weekend beer empties.'),
      mkEmpty(64, 'Bulleit Bourbon', 6, 'bottles', 'Recycle', 'Maria G.', 0, ''),
      mkEmpty(64, 'House Chardonnay', 11, 'bottles', 'Recycle', 'Maria G.', 0, ''),
      mkEmpty(57, 'Live Oak Hefeweizen', 1, 'kegs', 'Return for Deposit', 'Carlos P.', 30, 'Single empty keg return.'),
      mkEmpty(50, 'Lone Star', 72, 'bottles', 'Recycle', 'Devin R.', 0, ''),
      mkEmpty(43, "Tito's Handmade Vodka", 8, 'bottles', 'Recycle', 'Ashley B.', 0, ''),
      mkEmpty(43, 'House Cabernet', 3, 'bottles', 'Trash', 'Ashley B.', 0, 'Broke in the bin, not recyclable.'),
      mkEmpty(36, 'ABW Pearl Snap (1/2 bbl)', 3, 'kegs', 'Return for Deposit', 'Carlos P.', 30, 'Three empties back on the Tuesday delivery.'),
      mkEmpty(29, 'Corona', 60, 'bottles', 'Recycle', 'Devin R.', 0, ''),
      mkEmpty(22, 'Espolòn Tequila Blanco', 7, 'bottles', 'Recycle', 'Maria G.', 0, ''),
      mkEmpty(15, 'House Chardonnay', 12, 'bottles', 'Recycle', 'Devin R.', 0, ''),
      mkEmpty(8,  "Real Ale Fireman's 4", 2, 'kegs', 'Return for Deposit', 'Carlos P.', 30, 'Empty kegs staged for pickup.'),
      mkEmpty(3,  'Modelo Especial', 84, 'bottles', 'Recycle', 'Devin R.', 0, 'Weekend beer empties.'),
    ];

    // ── Transfer Log ─────────────────────────────────────────────────────
    // The daily restock routine now that stock lives in multiple locations:
    // Liquor Room -> Main Bar wells, Walk-in -> Back Bar (wine), Walk-in ->
    // Main Bar (beer + keg swaps), Walk-in / Dry Storage -> Kitchen Line. Real
    // products, real cadence, a couple counted out and witnessed at shift change.
    const mkXfer = (daysAgo, hour, min, prodName, qty, unit, from, to, by, witness, notes) => {
      const p = icByName(prodName) || {};
      return { id:uid(), date_time:adjAt(daysAgo, hour, min),
        from_location:from, to_location:to, product_id:p.id || '', product_name:p.name || prodName,
        category:p.category || '', quantity:qty, unit,
        performed_by_id:staffIdByName(by), performed_by:by,
        witnessed_by_id:witness ? staffIdByName(witness) : '', witnessed_by:witness || '',
        notes:notes || '', created_at:daysAgoISO(daysAgo) };
    };
    App.inventoryData.ic_transfers = [
      mkXfer(80, 16, 30, "Tito's Handmade Vodka", 3, 'bottles', 'Liquor Room', 'Main Bar', 'Maria G.', '', 'Pre-shift well restock.'),
      mkXfer(80, 16, 35, 'House Cabernet', 8, 'bottles', 'Walk-in Cooler', 'Back Bar', 'Maria G.', '', ''),
      mkXfer(73, 15, 0,  'ABW Pearl Snap (1/2 bbl)', 1, 'kegs', 'Walk-in Cooler', 'Main Bar', 'Jake T.', 'Carlos P.', 'Keg swap, tapped fresh.'),
      mkXfer(73, 17, 10, 'Modelo Especial', 48, 'bottles', 'Walk-in Cooler', 'Main Bar', 'Devin R.', '', 'Two cases to the bar cooler.'),
      mkXfer(66, 16, 20, 'Bulleit Bourbon', 2, 'bottles', 'Liquor Room', 'Main Bar', 'Ashley B.', '', ''),
      mkXfer(66, 11, 45, 'Ground Beef 80/20', 40, 'lbs', 'Walk-in Cooler', 'Kitchen Line', 'Luis V.', '', 'Lunch prep pull.'),
      mkXfer(59, 16, 15, 'House Chardonnay', 10, 'bottles', 'Walk-in Cooler', 'Back Bar', 'Maria G.', '', ''),
      mkXfer(59, 10, 30, 'Russet Potato', 50, 'lbs', 'Dry Storage', 'Kitchen Line', 'Sam P.', '', 'Fry station par.'),
      mkXfer(52, 15, 50, 'Live Oak Hefeweizen', 1, 'kegs', 'Walk-in Cooler', 'Main Bar', 'Jake T.', '', 'Keg swap.'),
      mkXfer(45, 16, 40, "Tito's Handmade Vodka", 4, 'bottles', 'Liquor Room', 'Main Bar', 'Maria G.', '', ''),
      mkXfer(45, 12, 5,  'Chicken Thigh', 30, 'lbs', 'Walk-in Cooler', 'Kitchen Line', 'Hector M.', '', ''),
      mkXfer(38, 17, 0,  'Corona', 48, 'bottles', 'Walk-in Cooler', 'Main Bar', 'Devin R.', '', 'Weekend stock up.'),
      mkXfer(31, 16, 25, 'Bulleit Bourbon', 3, 'bottles', 'Liquor Room', 'Main Bar', 'Ashley B.', 'Carlos P.', 'Counted out together at shift change.'),
      mkXfer(24, 15, 30, 'ABW Pearl Snap (1/2 bbl)', 1, 'kegs', 'Walk-in Cooler', 'Main Bar', 'Jake T.', '', 'Keg swap.'),
      mkXfer(17, 16, 10, 'House Cabernet', 12, 'bottles', 'Walk-in Cooler', 'Back Bar', 'Maria G.', '', 'Heavy reservation night, extra red on hand.'),
      mkXfer(17, 11, 20, 'Flour Tortilla', 4, 'units', 'Dry Storage', 'Kitchen Line', 'Luis V.', '', ''),
      mkXfer(9,  16, 45, 'Modelo Especial', 24, 'bottles', 'Walk-in Cooler', 'Main Bar', 'Devin R.', '', ''),
      mkXfer(2,  15, 40, "Maker's Mark", 2, 'bottles', 'Liquor Room', 'Main Bar', 'Maria G.', '', ''),
    ];

    // ── Order History (mirrors Delivery History one-to-one) ───────────────
    // Every delivery was placed as an order first, so Order History mirrors
    // Delivery History: each Received order carries the same vendor, the same
    // line items and the same dollars as its delivery, dated a vendor-specific
    // lead time earlier. Bottle beer is in CASES on both (the canonical unit).
    // Two recent orders are still in the pipeline (Submitted / Open): the
    // reorders that refill the current draw-down, not yet delivered, which is why
    // the most recent days have no matching delivery.
    const orderLeadDays = { 'Republic National':3, "Glazer's Beer & Bev":2, 'Sysco Foods':1,
      'Austin Beerworks':4, 'Local Produce Co.':1, 'Restaurant Depot':5 };
    const deliveryToOrder = (del) => {
      const lead = orderLeadDays[del.vendor] != null ? orderLeadDays[del.vendor] : 2;
      const lineItems = del.line_items.map(li => ({
        product_id:li.product_id, name:li.name, qty:li.qty,
        unit_cost:li.price_per_unit, extended:li.extended,
        display_unit:li.display_unit || 'unit', case_size:li.case_size_at_receive || null
      }));
      const delDate = new Date(del.date + 'T00:00:00');
      const ordDate = new Date(delDate); ordDate.setDate(ordDate.getDate() - lead);
      return { id:uid(), vendor:del.vendor, date:App.ymdLocal(ordDate), status:'Received',
        line_items:lineItems, item_count:lineItems.length, total:del.total, custom:true,
        created_at:ordDate.toISOString(), received_at:delDate.toISOString() };
    };
    const mkPendingOrder = (daysAgo, vendor, status, pairs) => {
      const lineItems = pairs.map(([nm, qty]) => {
        const p = icByName(nm) || {};
        const isCaseBeer = p.category === 'Bottle Beer' && p.case_size && p.case_size > 0;
        const cost = p.unit_cost != null ? p.unit_cost : 0;
        return { product_id:p.id || '', name:p.name || nm, qty, unit_cost:cost,
          extended:+(qty * cost).toFixed(2), display_unit:isCaseBeer ? 'case' : 'unit',
          case_size:isCaseBeer ? p.case_size : null };
      });
      const rec = { id:uid(), vendor, date:dateStr(daysAgo), status,
        line_items:lineItems, item_count:lineItems.length,
        total:+lineItems.reduce((t, i) => t + i.extended, 0).toFixed(2),
        custom:true, created_at:daysAgoISO(daysAgo) };
      if (status === 'Submitted') rec.submitted_at = daysAgoISO(daysAgo);
      return rec;
    };
    App.inventoryData.ic_orders = [
      ...(App.inventoryData.ic_deliveries || []).map(deliveryToOrder),
      mkPendingOrder(5, 'Sysco Foods', 'Submitted', [
        ['Ground Beef 80/20', 200], ['Salmon Fillet', 40], ['Gulf Shrimp', 40]]),
      mkPendingOrder(2, "Glazer's Beer & Bev", 'Open', [
        ['Modelo Especial', 16], ['White Claw', 10], ['Stella Artois', 8]]),
    ];

    // Phase 0: now that lcStaff exists, patch staff_id onto every sc_void_comps
    // record so the Server Scorecard (Phase 4) can show comps per server with
    // a real foreign-key link. Same patch lets Theft Risk run by-employee math.
    scVoidComps.forEach(vc => {
      if (!vc.server) return;
      const match = lcStaff.find(s => s.name === vc.server);
      if (match) vc.staff_id = match.id;
    });
    App.shiftData.sc_void_comps = scVoidComps;

    // ── Shift Control staff-linked logs (Walked Tabs, Waste) ──
    // Seeded here, after the roster exists, because each form requires a real
    // staff member (server / manager / recorded_by) for its open->save round
    // trip. icProducts is in scope for the waste cost, which mirrors the
    // costFor()/unitLabel() logic in sc-waste.js so the Total Cost is honest.
    const wtServers = ['Jessica M.', 'Marcus T.', 'Brianna K.', 'Priya N.'];
    const wtReasons = ['Walked', 'Mis-bill', 'Lost Check', 'Refused to Pay', 'Other'];
    const scWalkedTabs = [];
    ANCHS.weeks.forEach(a => {
      const baseAgo = sunOff + ANCHS.endAgo(a);
      const improving = !a.loose;
      const n = improving ? 1 : 2;   // walked tabs taper after the fix lands
      for (let k = 0; k < n; k++) {
        const server = wtServers[(a.wk + k) % wtServers.length];
        const mgr    = mgrs[(a.wk + k) % 3];
        const reason = wtReasons[(a.wk + k) % wtReasons.length];
        const amount = 20 + Math.round(Math.random() * (improving ? 55 : 100));
        scWalkedTabs.push({
          id:uid(), date:dateStr(baseAgo + (k === 0 ? 5 : 6)), time:(k === 0 ? '21:50' : '23:10'),
          server_id:staffIdByName(server), server:server,
          check_ref:'#' + (4000 + a.wk * 7 + k), amount:amount, reason:reason,
          manager_id:staffIdByName(mgr), manager:mgr, notes:'',
          created_at:new Date().toISOString()
        });
      }
    });
    App.shiftData.sc_walked_tabs = scWalkedTabs;

    // Waste / Spill Log — products pulled from the real inventory; cost mirrors
    // sc-waste.js costFor()/unitLabel() exactly so the Total Cost is honest.
    const wasteUnitOf = p => !p ? 'units'
      : p.category === 'Bottle Beer' ? 'btls'
      : p.category === 'Draft Beer'  ? 'oz'
      : (p.category === 'Food' || p.category === 'Misc') ? (p.unit_type || 'units')
      : 'btls';
    const wasteCostOf = (p, units) => {
      if (!p || !units) return 0;
      if (p.category === 'Draft Beer') return (!p.container_size_oz || p.unit_cost == null) ? 0 : (units / p.container_size_oz) * p.unit_cost;
      if (p.category === 'Food' || p.category === 'Misc') return (p.unit_cost != null) ? units * p.unit_cost : 0;
      const bc = App.bottleCost ? App.bottleCost(p) : null;
      return bc != null ? units * bc : 0;
    };
    const wByCat = cat => icProducts.filter(p => p.category === cat);
    const wPick = (arr, i) => (arr.length ? arr[i % arr.length] : null);
    // Realistic waste: varied reasons (from the form's list), products, people,
    // shifts, and days across the quarter instead of the same three every week.
    // Units feed wasteCostOf() so the Total Cost stays honest.
    const WASTE_SC = [
      { cat:'Food',        reason:'Expired / Past Date',              units:2,  who:'Luis V.',   shift:'Lunch',      day:3 },
      { cat:'Liquor',      reason:'Broken',                           units:1,  who:'Maria G.',  shift:'Dinner',     day:5 },
      { cat:'Draft Beer',  reason:'Spill',                            units:32, who:'Jake T.',   shift:'Late Night', day:4 },
      { cat:'Food',        reason:'Dumped / Tasted Bad',              units:1,  who:'Renee K.',  shift:'Dinner',     day:6 },
      { cat:'Wine',        reason:'Bad Pour / Customer Dissatisfied', units:1,  who:'Devin R.',  shift:'Dinner',     day:2 },
      { cat:'Food',        reason:'Expired / Past Date',              units:3,  who:'Luis V.',   shift:'Brunch',     day:1 },
      { cat:'Liquor',      reason:'Bad Pour / Customer Dissatisfied', units:1,  who:'Brianna K.',shift:'Late Night', day:5 },
      { cat:'Draft Beer',  reason:'Training',                         units:16, who:'Marcus T.', shift:'Lunch',      day:3 },
      { cat:'Bottle Beer', reason:'Broken',                           units:1,  who:'Maria G.',  shift:'Dinner',     day:4 },
      { cat:'Food',        reason:'Dumped / Tasted Bad',              units:1,  who:'Luis V.',   shift:'Dinner',     day:5 }
    ];
    const scWaste = [];
    let wsI = 0;
    ANCHS.weeks.forEach(a => {
      const baseAgo = sunOff + ANCHS.endAgo(a);
      const count = (a.wk % 2 === 0) ? 2 : 3;
      for (let j = 0; j < count; j++) {
        const s = WASTE_SC[wsI % WASTE_SC.length]; wsI++;
        const p = wPick(wByCat(s.cat), a.wk + j);
        if (!p) continue;
        scWaste.push({
          id:uid(), date:dateStr(baseAgo + s.day + (j % 2)), shift_type:s.shift,
          product_id:p.id, product_name:p.name, product_category:p.category,
          unit:wasteUnitOf(p), units:s.units, cost:+wasteCostOf(p, s.units).toFixed(2),
          reason:s.reason, recorded_by_id:staffIdByName(s.who), recorded_by:s.who, notes:'',
          created_at:new Date().toISOString()
        });
      }
    });
    App.shiftData.sc_waste = scWaste;

    // Phase 4: patch staff_id + shift_id onto every revenue_server_checks
    // record so the Server Scorecard joins cleanly to lc_staff and sc_shifts.
    (App.data.revenue_server_checks || []).forEach(c => {
      if (!c.staff_id && c.server_name) {
        const match = lcStaff.find(s => s.name === c.server_name);
        if (match) c.staff_id = match.id;
      }
      if (!c.shift_id && c.date) {
        const matchShift = scShifts.find(s => s.date === c.date && (!c.shift || s.shift_type === c.shift));
        if (matchShift) c.shift_id = matchShift.id;
      }
    });

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
    // Each department covers a realistic spread of dayparts: the bar skews to
    // dinner and late night, the kitchen to lunch and dinner, the floor to the
    // brunch/lunch/dinner stretch. Rotating by (person + day) gives each staffer
    // a believable week instead of the same daypart five days running.
    const lcAllocate = (staff, weights, deptDollars, baseAgo, dayparts) => {
      staff.forEach((st, i) => {
        const weekHours = (deptDollars * (weights[i] || 0)) / st.wage;
        for (let d = 0; d < 5; d++) {
          const h = +(weekHours / 5).toFixed(1);
          if (h <= 0) continue;
          lcActuals.push({
            id:uid(), date:dateStr(baseAgo + 5 - d), staff_id:st.id, name:st.name,
            position_id:st.position_id, shift_type:dayparts[(i + d) % dayparts.length],
            hours:h, wage:st.wage,
            cost:+(h * st.wage).toFixed(2), notes:''
          });
        }
      });
    };
    ANCHL.weeks.forEach(a => {
      const baseAgo = sunOff + ANCHS.endAgo(a);
      lcAllocate(lcBar,     [0.30, 0.27, 0.24, 0.19],       a.bar_labor,        baseAgo, ['Dinner', 'Late Night', 'Dinner', 'Brunch', 'Late Night']);
      lcAllocate(lcKitchen, [0.30, 0.27, 0.24, 0.19],       a.food_labor * 0.5, baseAgo, ['Lunch', 'Dinner', 'Dinner', 'Brunch', 'Lunch']);
      lcAllocate(lcFloor,   [0.23, 0.21, 0.20, 0.19, 0.17], a.food_labor * 0.5, baseAgo, ['Brunch', 'Lunch', 'Dinner', 'Dinner', 'Lunch']);
    });
    App.laborData.lc_actuals   = lcActuals;

    // ── Schedules — the two most recent weeks, built from the roster ──
    // Each position holds a few real daypart shifts (brunch, lunch, dinner,
    // late). Staff in a position are staggered across them (person 1 opens,
    // person 2 closes, etc.) so the grid reads like a human-built week covering
    // brunch through last call, not one identical block per role.
    const SCHED_PLAN = {
      'Bartender': [
        { days:['Tue','Wed','Thu','Fri'],       start:'11:00', end:'17:00', hours:6 },   // day / lunch bar
        { days:['Wed','Thu','Fri','Sat'],       start:'16:00', end:'00:00', hours:8 },   // dinner into late
        { days:['Fri','Sat','Sun'],             start:'17:00', end:'01:00', hours:8 },   // late bar / last call
      ],
      'Barback':   [ { days:['Thu','Fri','Sat','Sun'], start:'17:00', end:'01:00', hours:8 } ],
      'Line Cook': [
        { days:['Tue','Wed','Thu','Fri'],       start:'09:00', end:'16:00', hours:7 },   // brunch / lunch line
        { days:['Wed','Thu','Fri','Sat'],       start:'15:00', end:'23:00', hours:8 },   // dinner line
        { days:['Sat','Sun'],                   start:'09:00', end:'16:00', hours:7 },   // weekend brunch line
      ],
      'Prep Cook': [ { days:['Mon','Tue','Wed','Thu','Fri'], start:'08:00', end:'14:00', hours:6 } ],
      'Server':    [
        { days:['Mon','Tue','Wed','Thu','Fri'], start:'11:00', end:'15:30', hours:4.5 }, // weekday lunch
        { days:['Wed','Thu','Fri','Sat'],       start:'16:00', end:'22:00', hours:6 },   // dinner
        { days:['Sat','Sun'],                   start:'09:30', end:'15:00', hours:5.5 }, // weekend brunch
        { days:['Fri','Sat','Sun'],             start:'17:00', end:'23:00', hours:6 },   // dinner into late
      ],
      'Host':      [
        { days:['Sat','Sun'],                   start:'09:30', end:'15:00', hours:5.5 }, // brunch host
        { days:['Wed','Thu','Fri','Sat'],       start:'17:00', end:'22:30', hours:5.5 },// dinner host
      ],
      'Manager':   [
        { days:['Mon','Tue','Wed','Fri'],       start:'09:00', end:'17:00', hours:8 },   // opener
        { days:['Thu','Fri','Sat','Sun'],       start:'15:00', end:'23:00', hours:8 },   // closer
      ],
    };
    const posNameOf = id => (lcPositions.find(p => p.id === id) || {}).name;
    const mondayISO = (daysBack) => {
      const d = new Date(today); d.setDate(d.getDate() - daysBack);
      const day = d.getDay();
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
      return App.ymdLocal(d);
    };
    // Expand a plan map into per-staff day assignments. Staff within a position
    // are staggered across that position's shift patterns (i % patterns) so the
    // week covers all dayparts instead of cloning one shift onto everyone.
    const expandPlan = (planMap) => {
      const out = [], byPos = {};
      lcStaff.forEach(st => { const pos = posNameOf(st.position_id); (byPos[pos] = byPos[pos] || []).push(st); });
      Object.keys(byPos).forEach(pos => {
        const patterns = planMap[pos]; if (!patterns) return;
        byPos[pos].forEach((st, i) => {
          const plan = patterns[i % patterns.length];
          plan.days.forEach(day => out.push({ st, day, plan }));
        });
      });
      return out;
    };
    const buildSchedule = (weekStart, forecast) => {
      const shifts = expandPlan(SCHED_PLAN).map(({ st, day, plan }) => ({
        staff_id:st.id, name:st.name, position_id:st.position_id, day:day,
        start:plan.start, end:plan.end, hours:plan.hours, wage:st.wage,
        cost:+(plan.hours * st.wage).toFixed(2) }));
      const total_hours = shifts.reduce((s, x) => s + x.hours, 0);
      const total_cost  = +shifts.reduce((s, x) => s + x.cost, 0).toFixed(2);
      return { id:uid(), week_start:weekStart, revenue_forecast:forecast, shifts:shifts,
        total_hours:total_hours, total_cost:total_cost,
        labor_pct:+(total_cost / forecast * 100).toFixed(2),
        rplh:+(forecast / total_hours).toFixed(2),
        notes:'', status:'Posted', created_at:new Date().toISOString() };
    };
    App.laborData.lc_schedules = [
      buildSchedule(mondayISO(21), 17980),
      buildSchedule(mondayISO(14), 18420),
      buildSchedule(mondayISO(7),  18812),
      buildSchedule(mondayISO(0),  19150),
    ];

    // ── Tips — recent shifts for every tipped staff member ──
    // Phase 0: every tip carries shift_id linked to the sc_shifts record on
    // the same date. Shift Close (Phase 2-3) reconciles tips against this link;
    // Books Form 8027 pulls per-employee allocations through it; Server
    // Scorecard (Phase 4) shows tips % per server through it.
    const lcTipped = lcStaff.filter(st => ['Bartender','Barback','Server'].includes(posNameOf(st.position_id)));
    const lcTips = [];
    [3, 5, 8, 11, 14, 18, 22, 27, 33, 40, 47, 54, 61, 68, 75].forEach(d => {
      const tipDate = dateStr(d);
      const matchedShift = scShifts.find(s => s.date === tipDate && s.shift_type === 'Dinner') || scShifts.find(s => s.date === tipDate);
      const shiftId = matchedShift ? matchedShift.id : '';
      lcTipped.forEach(st => {
        const role = posNameOf(st.position_id);
        const base = role === 'Bartender' ? 135 : role === 'Server' ? 100 : 55;
        const cash = Math.round(base * (0.30 + Math.random() * 0.22));
        const card = Math.round(base * (0.92 + Math.random() * 0.40));
        lcTips.push({ id:uid(), date:tipDate, shift_id:shiftId, staff_id:st.id, name:st.name,
          position_id:st.position_id, shift_type:'Dinner',
          cash_tips:cash, card_tips:card, total_tips:cash + card,
          hours:role === 'Server' ? 5 : 7, notes:'', created_at:daysAgoISO(d) });
      });
    });
    App.laborData.lc_tips = lcTips;

    // ── Tip pools — three recent close-outs, split by hours, linked to shifts.
    // Phase 3: shift_id ties each pool to the closing shift so Books Form 8027
    // pulls per-employee taxable allocations from the pool split (not the raw
    // tip log), and Tip History can group by shift.
    const mkPool = (d, amount) => {
      const poolDate = dateStr(d);
      const matched = scShifts.find(s => s.date === poolDate);
      const parts = lcTipped.map(st => ({ staff_id:st.id, name:st.name,
        hours:posNameOf(st.position_id) === 'Server' ? 5 : 7 }));
      const totH = parts.reduce((s, p) => s + p.hours, 0);
      parts.forEach(p => p.share = +(amount * p.hours / totH).toFixed(2));
      return { id:uid(),
        shift_id:    matched ? matched.id : '',
        date:        poolDate,
        shift_type:  matched ? (matched.shift_type || '') : 'Dinner',
        method:      'hours',
        pool_amount: amount,
        total_hours: totH,
        participants: parts,
        created_at:  daysAgoISO(d) };
    };
    App.laborData.lc_tip_pools = [ mkPool(4, 980), mkPool(11, 1120), mkPool(18, 1040), mkPool(25, 1075), mkPool(33, 990), mkPool(46, 1150), mkPool(60, 1020) ];

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
      lcCO(lcStaff[8],  58, 'Called Out Sick', true,  'Marcus T.'),
      lcCO(lcStaff[11], 71, 'Late Arrival',    false, ''),
    ];

    // ── Schedule templates — three reusable week patterns the operator applies
    // in Build Schedule. Shifts are {staff_id, day, start, end}; Build Schedule
    // computes hours + cost on apply.
    const tmplShifts = (planMap) => expandPlan(planMap).map(({ st, day, plan }) => ({ staff_id:st.id, day:day, start:plan.start, end:plan.end }));
    const BUSY_PLAN = {
      'Bartender':[ {days:['Wed','Thu','Fri','Sat','Sun'],start:'15:00',end:'01:00'}, {days:['Fri','Sat','Sun'],start:'18:00',end:'02:00'} ],
      'Barback':  [ {days:['Wed','Thu','Fri','Sat','Sun'],start:'16:00',end:'01:00'} ],
      'Line Cook':[ {days:['Tue','Wed','Thu','Fri','Sat','Sun'],start:'14:00',end:'22:00'}, {days:['Fri','Sat','Sun'],start:'09:00',end:'16:00'} ],
      'Prep Cook':[ {days:['Mon','Tue','Wed','Thu','Fri'],start:'08:00',end:'15:00'} ],
      'Server':   [ {days:['Wed','Thu','Fri','Sat','Sun'],start:'16:00',end:'23:00'}, {days:['Sat','Sun'],start:'09:30',end:'15:30'}, {days:['Fri','Sat','Sun'],start:'17:00',end:'00:00'} ],
      'Host':     [ {days:['Wed','Thu','Fri','Sat','Sun'],start:'16:30',end:'23:00'}, {days:['Sat','Sun'],start:'09:30',end:'15:30'} ],
      'Manager':  [ {days:['Tue','Wed','Thu','Fri','Sat','Sun'],start:'13:00',end:'22:00'} ],
    };
    const SLOW_PLAN = {
      'Bartender':[ {days:['Thu','Fri','Sat'],start:'16:00',end:'23:00'} ],
      'Line Cook':[ {days:['Wed','Thu','Fri','Sat'],start:'15:00',end:'22:00'}, {days:['Sat','Sun'],start:'09:00',end:'15:00'} ],
      'Prep Cook':[ {days:['Tue','Wed','Thu'],start:'09:00',end:'14:00'} ],
      'Server':   [ {days:['Thu','Fri','Sat'],start:'17:00',end:'22:00'}, {days:['Sat','Sun'],start:'10:00',end:'15:00'} ],
      'Host':     [ {days:['Fri','Sat'],start:'17:30',end:'22:00'} ],
      'Manager':  [ {days:['Wed','Thu','Fri','Sat'],start:'14:00',end:'22:00'} ],
    };
    App.laborData.lc_schedule_templates = [
      { id:uid(), name:'Standard Week',       shifts:tmplShifts(SCHED_PLAN), created_at:daysAgoISO(64) },
      { id:uid(), name:'Busy Weekend Push',   shifts:tmplShifts(BUSY_PLAN),  created_at:daysAgoISO(48) },
      { id:uid(), name:'Slow Week (Reduced)', shifts:tmplShifts(SLOW_PLAN),  created_at:daysAgoISO(30) },
    ];

    // ── Certifications — TABC for anyone serving alcohol (Austin TX), food
    // safety for the kitchen. expDays = days until expiration (negative = already
    // lapsed); spread so the dashboard alert shows current, expiring-soon, and
    // expired all at once.
    const stByName = nm => lcStaff.find(s => s.name === nm);
    const certRec = (nm, type, issuer, expDays, num) => {
      const st = stByName(nm); if (!st) return null;
      return { id:uid(), staff_id:st.id, cert_type:type, cert_number:num || '',
        issuer:issuer, issue_date:dateStr(700), expiration_date:dateStr(-expDays),
        notes:'', created_at:daysAgoISO(150), updated_at:new Date().toISOString() };
    };
    App.laborData.lc_certs = [
      certRec('Maria G.',   'TABC (Texas)', 'Texas ABC', 240, 'TX-1184422'),
      certRec('Jake T.',    'TABC (Texas)', 'Texas ABC',  18, 'TX-1190877'),
      certRec('Ashley B.',  'TABC (Texas)', 'Texas ABC', 310, 'TX-1205513'),
      certRec('Devin R.',   'TABC (Texas)', 'Texas ABC', 150, 'TX-1213004'),
      certRec('Jessica M.', 'TABC (Texas)', 'Texas ABC', 200, 'TX-1166201'),
      certRec('Marcus T.',  'TABC (Texas)', 'Texas ABC', 275, 'TX-1188190'),
      certRec('Brianna K.', 'TABC (Texas)', 'Texas ABC', 120, 'TX-1221765'),
      certRec('Priya N.',   'TABC (Texas)', 'Texas ABC', 330, 'TX-1230918'),
      certRec('Luis V.',    'ServSafe Food Handler', 'ServSafe', 180, 'SS-77120'),
      certRec('Sam P.',     'ServSafe Food Handler', 'ServSafe',  60, 'SS-78431'),
      certRec('Hector M.',  'ServSafe Food Handler', 'ServSafe', -12, 'SS-79002'),
      certRec('Tonya B.',   'ServSafe Food Handler', 'ServSafe', 220, 'SS-80155'),
      certRec('Owen L.',    'ServSafe Food Handler', 'ServSafe', 290, 'SS-81330'),
      certRec('Carlos P.',  'TABC (Texas)', 'Texas ABC', 400, 'TX-1099001'),
      certRec('Carlos P.',  'ServSafe Manager', 'ServSafe', 400, 'SS-MGR-4410'),
      certRec('Renee K.',   'TABC (Texas)', 'Texas ABC', 300, 'TX-1100250'),
      certRec('Renee K.',   'ServSafe Manager', 'ServSafe', 300, 'SS-MGR-4502'),
    ].filter(Boolean);

    // ── Coaching Log — written record of staff conversations, authored by the
    // GM. Mix of Praise, Coaching, Concern, and Warning across the window.
    const mgr = stByName('Carlos P.');
    const coachNote = (nm, daysAgo, category, text) => {
      const st = stByName(nm); if (!st) return null;
      return { id:uid(), staff_id:st.id, date:dateStr(daysAgo), category:category,
        manager_id:mgr ? mgr.id : '', manager_name:'Carlos P.', text:text,
        created_at:daysAgoISO(daysAgo), updated_at:daysAgoISO(daysAgo) };
    };
    App.laborData.lc_staff_notes = [
      coachNote('Maria G.',   12, 'Praise',   'Covered Jake\'s Friday close on no notice and the bar still ran clean. Called it out in the group thread so the team saw it.'),
      coachNote('Jake T.',    20, 'Coaching', 'Drawer came up 14 dollars short on the 12th. Walked the void and comp procedure again; he agreed to call a manager for any comp over 20 dollars.'),
      coachNote('Devin R.',   26, 'Concern',  'Third late arrival in three weeks. Talked through the bus schedule, he is switching to the earlier route. Revisit in two weeks.'),
      coachNote('Marcus T.',  33, 'Warning',  'Second no-call no-show. Issued a written warning per the handbook. One more is termination. He acknowledged and signed.'),
      coachNote('Jessica M.', 40, 'Praise',   'Top check average on the floor two months running. Asked her to run a five minute upsell huddle before Friday dinner.'),
      coachNote('Luis V.',    47, 'Coaching', 'Ticket times creeping past 18 minutes on the Saturday rush. Reorganized the line station with him; watching next weekend.'),
      coachNote('Priya N.',    9, 'Praise',   'Guest emailed to compliment her wine pairing on the anniversary table. Forwarded the note to her.'),
      coachNote('Tonya B.',   30, 'Coaching', 'Prep par sheet not getting filled on Mondays. Showed her where it lives and she owns it going forward.'),
      coachNote('Ashley B.',  18, 'Concern',  'Seemed checked out the last two shifts. Quick private check-in, personal stuff and nothing performance related. Keeping an eye out.'),
      coachNote('Hector M.',   6, 'Warning',  'Worked a shift on a lapsed Food Handler card. Pulled him off the line until it is renewed and documented per health code.'),
    ].filter(Boolean);

    // ── Pay periods — two older weeks closed + locked, recent weeks left open
    // so both states are visible. Stamps locked + pay_period_id on the actuals
    // in range, mirroring lc-pay-periods closePeriod().
    const buildClosedPeriod = (weekStart, closedDaysAgo) => {
      const dd = new Date(weekStart + 'T00:00:00'); dd.setDate(dd.getDate() + 6);
      const weekEnd = App.ymdLocal(dd);
      const periodId = uid();
      const byStaff = {};
      lcActuals.filter(a => (a.date || '') >= weekStart && (a.date || '') <= weekEnd).forEach(a => {
        if (!byStaff[a.staff_id]) byStaff[a.staff_id] = { staff_id:a.staff_id, name:a.name, position_id:a.position_id, wage:a.wage, hours:0 };
        byStaff[a.staff_id].hours += (a.hours || 0);
        a.locked = true; a.pay_period_id = periodId;
      });
      const rows = Object.values(byStaff).map(r => {
        const regH = Math.min(r.hours, 40), otH = Math.max(0, r.hours - 40);
        const regC = +(regH * r.wage).toFixed(2), otC = +(otH * r.wage * 1.5).toFixed(2);
        return { staff_id:r.staff_id, name:r.name, position_id:r.position_id,
          regular_hours:+regH.toFixed(2), ot_hours:+otH.toFixed(2), wage:r.wage,
          regular_cost:regC, ot_cost:otC, gross:+(regC + otC).toFixed(2) };
      });
      const sum = k => +rows.reduce((t, r) => t + r[k], 0).toFixed(2);
      return { id:periodId, week_start:weekStart, week_end:weekEnd, status:'Closed',
        closed_at:daysAgoISO(closedDaysAgo),
        total_hours:+(sum('regular_hours') + sum('ot_hours')).toFixed(2),
        total_cost:+(sum('regular_cost') + sum('ot_cost')).toFixed(2),
        ot_hours:sum('ot_hours'), ot_cost:sum('ot_cost'), gross:sum('gross'),
        participants: rows };
    };
    App.laborData.lc_pay_periods = [
      buildClosedPeriod(mondayISO(63), 55),
      buildClosedPeriod(mondayISO(70), 62),
    ];

    // ── Save everything — App.data plus all three Control stores ──
    await App.save();
    await App.saveInventory();           // config only (products, locations, vendors, batches, par/variance settings)
    await App.seedEventStores('ic');     // inventory event logs -> ic_events rows
    await App.saveLabor();               // config only (staff, positions, schedule templates, certs, notes)
    await App.seedEventStores('lc');     // labor event logs -> lc_events rows
    await App.saveShift();               // config only (settings, drawers, checklist templates)
    await App.seedEventStores('sc');     // shift event logs -> sc_events rows
    await App.seedEventStores('core');   // recovery event logs (weeks, audits, theft scores, discrepancies, investigations) -> core_events rows
    App.updatePeriod();

    if (msg) { msg.style.color = 'var(--gold)'; msg.textContent = '✓ Sample data loaded. All six systems populated. Go test!'; }
  },

  async clearAll() {
    const ok = await App.confirm({
      title: 'Clear all data?',
      message: 'This permanently erases ALL data in your account: every weekly record, audit, recipe, and all Inventory, Labor, and Shift Control data. Your settings and targets are kept. This cannot be undone.',
      confirmText: 'Clear all data',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    const msg = document.getElementById('ua-test-msg');
    if (msg) { msg.style.color = 'var(--t3)'; msg.textContent = 'Clearing...'; msg.style.display = 'block'; }

    // Reset every data key to its default. App.data.settings (bar name,
    // targets, etc.) is preserved — that is "user settings" the dialog says
    // it keeps. Everything else — Profit, Revenue, Traffic, fix log —
    // goes back to its empty default.
    const s = App.data.settings;
    const defaults = DB._defaultData();
    App.data = {
      ...defaults,
      settings: { ...s, onboarding_complete:true }
    };
    // Clear the three Control stores too — Inventory, Labor, and Shift.
    App.inventoryData = {};
    App.laborData     = {};
    App.shiftData     = {};
    await App.save();
    await App.saveInventory();
    await DB.clearEvents('ic_events');   // drop the inventory event rows too
    await App.saveLabor();
    await DB.clearEvents('lc_events');   // drop the labor event rows too
    await App.saveShift();
    await DB.clearEvents('sc_events');   // drop the shift event rows too
    await DB.clearEvents('core_events'); // drop the recovery event rows too
    App.updatePeriod();

    if (msg) { msg.style.color = 'var(--gold)'; msg.textContent = '✓ All data cleared. Reloading...'; }
    setTimeout(() => window.location.reload(), 800);
  }
};
