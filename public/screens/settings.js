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
    'business-profile': { title: 'Business Profile', action: 'settings-profile', ids: ['profile', 'tax', 'service'] },
    'recovery-targets': { title: 'Recovery Targets', action: 'settings-targets', ids: ['profit', 'revenue'] }
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
      { id:'tax',     title:'Taxes, Payroll & Wage',     body:this.secTaxes(),         save:true },
      { id:'service', title:'Service Periods',           body:this.secServicePeriods(), save:true },
      { id:'profit',  title:'Profit Targets',            body:this.secProfit(),        save:true },
      { id:'revenue', title:'Revenue Targets',           body:this.secRevenue(),       save:true }
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
      + '<div class="f" style="width:95px;"><label>City</label><input type="text" id="hs-city" value="' + esc((s.city_state||'').split(',')[0]?.trim()||'') + '" placeholder="Austin"/></div>'
      + '<div class="f" style="width:125px;"><label>State / Province</label><input type="text" id="hs-state" value="' + esc((s.city_state||'').split(',')[1]?.trim()||'') + '" placeholder="TX"/></div>'
      + '<div class="f" style="width:120px;"><label>Phone</label><input type="text" id="hs-phone" value="' + esc(s.phone||'') + '" placeholder="(512) 555-0142"/></div>'
      + '<div class="f" style="width:130px;"><label>Bar Sales</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-abr" value="' + (s.annual_bar_revenue||'') + '" placeholder="Annual Bar Sales"/></div></div>'
      + '<div class="f" style="width:130px;"><label>Food Sales</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-afr" value="' + (s.annual_food_revenue||'') + '" placeholder="Annual Food Sales"/></div></div>'
      + '</div>';
  },

  // Taxes, Payroll & Wage — the cross-section financial settings (sales tax rate,
  // how you file, payroll burden, state minimum wage). Entered once here. Tax and
  // payroll read the same CashEngine keys (stored on this device); the minimum
  // wage lives in Labor's data store, where the Pay Periods tip-credit check,
  // Payroll Export, and the Bar Cop Audit all read it.
  secTaxes() {
    const rate   = (window.CashEngine && CashEngine.salesTaxRate)  ? CashEngine.salesTaxRate()  : 0;
    const freq   = (window.CashEngine && CashEngine.taxFrequency)  ? CashEngine.taxFrequency()  : 'monthly';
    const burden = (window.CashEngine && CashEngine.payrollBurden) ? CashEngine.payrollBurden() : 0;
    const mw     = (App.laborData && App.laborData.settings && App.laborData.settings.state_min_wage != null) ? App.laborData.settings.state_min_wage : '';
    const opt = (v, label) => '<option value="' + v + '"' + (freq === v ? ' selected' : '') + '>' + label + '</option>';
    return '<div class="form-row" style="gap:16px 20px;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;"><label>Sales tax rate</label><div class="fw"><input class="suf" type="number" id="hs-tax" value="' + (rate || '') + '" step="0.01" placeholder="0"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:160px;"><label>Sales tax filing</label><select class="form-input" id="hs-freq">' + opt('monthly', 'Monthly') + opt('quarterly', 'Quarterly') + '</select></div>'
      + '<div class="f" style="width:150px;"><label>Payroll tax</label><div class="fw"><input class="suf" type="number" id="hs-burden" value="' + (burden || '') + '" step="0.1" placeholder="0"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:160px;"><label>State minimum wage</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-minwage" min="0" step="0.01" value="' + (mw === '' ? '' : mw) + '" placeholder="0.00"/></div></div>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:8px;">Set these once. Cash, Books, and Events read the tax and payroll figures; Labor uses the minimum wage for the Pay Periods tip-credit check.</div>';
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
      + '<div class="f" style="width:130px;"><label>Bar Pour Cost %</label><div class="fw"><input class="suf" type="number" id="hs-bpc" value="' + (t.bar_pour_cost_pct ?? 22) + '" step="0.1"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Food Cost %</label><div class="fw"><input class="suf" type="number" id="hs-fc" value="' + (t.food_cost_pct ?? 32) + '" step="0.1"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Labor Cost %</label><div class="fw"><input class="suf" type="number" id="hs-lc" value="' + (t.labor_cost_pct ?? 30) + '" step="0.1"/><span class="suf">%</span></div></div>'
      + '<div class="f" style="width:130px;"><label>Prime Cost %</label><div class="fw"><input class="suf" type="number" id="hs-pc" value="' + (t.prime_cost_pct ?? 60) + '" step="0.1"/><span class="suf">%</span></div></div>'
      + '</div>';
  },

  secRevenue() {
    const rt = ((App.data.revenue_settings||{}).targets) || {};
    return '<div class="form-row" style="gap:16px 20px;flex-wrap:wrap;">'
      + '<div class="f" style="width:130px;"><label>Check Average</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-r-ca" value="' + (rt.check_avg ?? 35) + '" step="0.5"/></div></div>'
      + '<div class="f" style="width:130px;"><label>Lunch RPLH</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-r-rl" value="' + (rt.rplh_lunch ?? 50) + '"/></div></div>'
      + '<div class="f" style="width:130px;"><label>Dinner RPLH</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-r-rd" value="' + (rt.rplh_dinner ?? 75) + '"/></div></div>'
      + '<div class="f" style="width:130px;"><label>Bar RPLH</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="hs-r-rb" value="' + (rt.rplh_bar ?? 65) + '"/></div></div>'
      + '<div class="f" style="width:130px;"><label>Event Close Rate</label><div class="fw"><input class="suf" type="number" id="hs-r-ec" value="' + (rt.event_close_rate ?? 40) + '" step="1"/><span class="suf">%</span></div></div>'
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
    } else if (which === 'tax') {
      // Cross-section financial settings live on this device via CashEngine,
      // not in App.data, so there are no keys to push (Promise.all([]) flashes Saved).
      if (window.CashEngine) {
        CashEngine.setSalesTaxRate(document.getElementById('hs-tax')?.value || '');
        CashEngine.setTaxFrequency(document.getElementById('hs-freq')?.value || 'monthly');
        CashEngine.setPayrollBurden(document.getElementById('hs-burden')?.value || '');
      }
      // State minimum wage feeds the Labor tip-credit check; it lives in Labor's
      // data store (loaded at boot, so this never clobbers it), so write it there
      // and persist. The 'tax' branch pushes no App.data keys, so this is the save.
      App.laborData = App.laborData || {};
      App.laborData.settings = App.laborData.settings || {};
      const mwRaw = document.getElementById('hs-minwage')?.value;
      App.laborData.settings.state_min_wage = (mwRaw === '' || mwRaw == null) ? null : (parseFloat(mwRaw) || 0);
      App.saveLabor();
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
    } else {
      return;
    }

    Promise.all(keys.map(k => App.saveKey(k))).then(() => {
      this._flashSaved(which);
      App.updatePeriod();
      // Saving any target group counts as completing the Hub Getting Started
      // targets task — Profit or Revenue. Profile is auto-completed
      // by the onboarding wizard, so this is the second Foundation task.
      if (which === 'profit' || which === 'revenue') {
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

    // Drop the cockpit's per-week "done" stamps (localStorage) so a fresh sample
    // does not inherit phantom step checks from a prior session.
    try { Object.keys(localStorage).filter(k => k.indexOf('cockpit_done_') !== -1).forEach(k => localStorage.removeItem(k)); } catch (e) {}

    // Cash Recovery device-local config (opening balance, tax rate, reserve). These
    // live on the device, not in App.data, so the sample sets them here to light up
    // the survival forecast, Cash Position, and Safe to Spend. The Anchor runs a
    // realistic operating balance for a roughly $1M bar: profitable but cash-tight,
    // the exact bar Cash Recovery is built for.
    try {
      localStorage.setItem('cash_opening_balance', '45000');
      localStorage.setItem('cash_sales_tax_rate', '8.25');
      localStorage.setItem('cash_tax_freq', 'monthly');
      localStorage.setItem('cash_reserve_weeks', '8');
      localStorage.setItem('cash_available_credit', '40000');
      localStorage.setItem('cash_gift_card_liability', '6500');
    } catch (e) {}

    // A history of closed-out weeks so the demo shows the operator has been doing
    // the weekly Cash close, not starting cold. The Close The Week step stamps live
    // in localStorage per week (the clear above wiped them); seed the last eight
    // weeks fully closed and leave the current week open so there is work to do.
    try {
      const _mon = (d) => { const x = new Date(d); const wd = x.getDay(); x.setDate(x.getDate() + (wd === 0 ? -6 : 1 - wd)); return App.ymdLocal(x); };
      const _curMon = _mon(new Date());
      for (let w = 1; w <= 8; w++) {
        const m = new Date(_curMon + 'T00:00:00'); m.setDate(m.getDate() - 7 * w);
        localStorage.setItem('cash_cockpit_done_' + App.ymdLocal(m), JSON.stringify({ trapped: true, order: true, week: true, terms: true }));
      }
      // Control sections, current week mid-close: the first two close steps are
      // done, the last two still to do. Keyed to each page's own done-key (the
      // current week), so it rolls forward week to week with no stale dates.
      if (window.S) {
        if (S.InventoryDashboard) localStorage.setItem(S.InventoryDashboard._doneKey(), JSON.stringify({ deliveries: true }));
        if (S.LaborDashboard)     localStorage.setItem(S.LaborDashboard._doneKey(),     JSON.stringify({ hours: true, tips: true }));
        if (S.ShiftDashboard)     localStorage.setItem(S.ShiftDashboard._doneKey(),     JSON.stringify({ import: true, cash: true }));
      }
    } catch (e) {}

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

    // ── 13 Weeks of Data (the first 90 days on Bar Cop) — from the Anchor profile ──
    // Every figure traces to window.ANCHOR so Profit, Revenue and the Control
    // modules all describe one operation. Week 1 is oldest, week 13 most recent.
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
    // Fixed overhead (Occupancy, Utilities, Insurance) is seeded as recurring
    // vendor bills below, so it is NOT duplicated here as anonymous variable rows.
    const opexMonthly = [
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
    // Two ongoing recurring bills (recur every month until cancelled, no fixed
    // term). Both were entered when the operator set up Books at the start of the
    // 90-day window; Bar Cop fills in each elapsed month on load.
    const monthAnchor = (back, day) => App.ymdLocal(new Date(today.getFullYear(), today.getMonth() - back, day));
    operatingExpenses.push(
      { id:uid(), date:monthAnchor(2, 5), category:'Software and Subscriptions', vendor:'Bar Cop', amount:249, notes:'Monthly software subscription.', recurring:true, recur_day:5, created_at:new Date().toISOString() },
      { id:uid(), date:monthAnchor(2, 5), category:'Other',                      vendor:'Sonitrol', amount:89,  notes:'Alarm and security monitoring.', recurring:true, recur_day:5, created_at:new Date().toISOString() }
    );
    // The major fixed overhead as recurring vendor bills, anchored at the start of
    // the window like the Bar Cop and Sonitrol bills above. catchUpRecurring fills
    // each elapsed month (so Books and the P&L read them) and the survival forecast
    // projects them forward and sizes the reserve off the real nut. These ARE the
    // Occupancy/Utilities/Insurance lines, with no anonymous variable duplicate.
    operatingExpenses.push(
      { id:uid(), date:monthAnchor(2, 5), category:'Occupancy (Rent, Property Tax)', vendor:'Barton Springs Holdings', amount:12000, notes:'Monthly lease.',          recurring:true, recur_day:5, created_at:new Date().toISOString() },
      { id:uid(), date:monthAnchor(2, 5), category:'Utilities',                       vendor:'Austin Energy',           amount:2600,  notes:'Power, gas, water.',     recurring:true, recur_day:5, created_at:new Date().toISOString() },
      { id:uid(), date:monthAnchor(2, 5), category:'Insurance',                       vendor:'Texas Mutual',            amount:1500,  notes:'Liability and property.', recurring:true, recur_day:5, created_at:new Date().toISOString() }
    );
    App.data.operating_expenses = operatingExpenses;

    // ── Cash outflows (the new store): owner draw, equipment loan, and the sales
    //    tax remittance. These feed BOTH the Cash Bridge (where the profit went,
    //    past period) and the 13-week survival forecast (scheduled cash out).
    //    Recurring and anchored two months back so the Bridge reads recent history
    //    and the forecast projects them forward. The tax remittance is the classic
    //    killer: real money leaving on the 20th that was never yours to keep. ────
    App.data.cash_outflows = [
      { id:uid(), date:monthAnchor(2, 1),  type:'draw', amount:4000, notes:'Owner draw',     recurring:true, recur_day:1,  created_at:new Date().toISOString() },
      { id:uid(), date:monthAnchor(2, 12), type:'loan', amount:2200, notes:'Equipment loan', recurring:true, term_months:24, recur_day:12, created_at:new Date().toISOString() },
      // Past tax remittances feed the Cash Bridge (where the profit went). The
      // FORECAST projects the upcoming remittances automatically off the tax rate
      // and due date, so these stay non-recurring history, not a forward series.
      { id:uid(), date:monthAnchor(2, 20), type:'tax', amount:6750, notes:'Sales tax remittance', created_at:new Date().toISOString() },
      { id:uid(), date:monthAnchor(1, 20), type:'tax', amount:6850, notes:'Sales tax remittance', created_at:new Date().toISOString() },
      { id:uid(), date:monthAnchor(0, 20), type:'tax', amount:6800, notes:'Sales tax remittance', created_at:new Date().toISOString() }
    ];

    // Pre-stamp the Fix view-tracking so the Cash Fix systems read on track from
    // the first look, the way a bar that has run Bar Cop for 90 days would: the
    // operator has been reviewing Trapped Cash, Purchasing, the Forecast, Dynamic
    // Pars, and vendor terms recently. A real user's stamps fill in as they
    // navigate to each screen.
    App.data.fix_views = Object.assign({}, App.data.fix_views, {
      'c-trapped': dateStr(2), 'c-purchasing': dateStr(3), 'c-forecast': dateStr(2),
      'ic-par-suggestions': dateStr(4), 'ic-vendors': dateStr(12)
    });

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

    // ── Audit period labels ─────────────────────────────────────────────────
    // The 90-day first-quarter arc: each seeded audit sets its own overall and
    // section scores directly, reconciled to the window's P&L. Period labels are
    // computed from the rolling dates so they always read correctly. Honesty note:
    // seeded audits are sample narrative; the LIVE engine on real data still
    // produces honest scores for any operation.
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const periodLabel = (daysAgo) => {
      const e = new Date(today); e.setDate(e.getDate() - daysAgo);
      return MONTHS[e.getMonth()] + ' ' + e.getFullYear() + ', 4 weeks ending ' + MONTHS[e.getMonth()].slice(0,3) + ' ' + e.getDate();
    };

    // ── Weekly audit series generator ────────────────────────────────────────
    // Audits run weekly now. The four rich milestone audits (today, and 30/60/90
    // days back) stay full detail; between each pair we generate terser weekly
    // fill-ins by interpolating the milestone numbers, so the history reads weekly
    // with honest score-and-gap figures and the latest week stays the richest. A
    // fill-in carries section scores + the headline numbers + gaps (no prose),
    // which the audit views render cleanly (empty fields are filtered).
    let _ipSerial = 60;
    const ipRaw = (lo, hi, t) => {
      const raw = {};
      Object.keys(lo).forEach(k => {
        const a = lo[k], b = hi[k];
        if (typeof a === 'number' && typeof b === 'number') {
          const isFloat = /_PCT$|_AVG$|_RATING$|_RPLH$|_PER_COVER$|_SPREAD$|_VARIANCE$/.test(k);
          const v = a + (b - a) * t;
          raw[k] = isFloat ? +v.toFixed(1) : Math.round(v);
        }
      });
      raw.BAR_NAME = lo.BAR_NAME || 'The Anchor Bar & Kitchen';
      raw.DATA_TIER_LABEL = (t >= 0.5 ? hi : lo).DATA_TIER_LABEL || 'Tier 3 Analysis, Bar Cop Operating Data';
      return raw;
    };
    const ANCH_DAYS = [0, 30, 60, 90];
    const FILL_DAYS = [7, 14, 21, 37, 44, 51, 67, 74, 81];
    const weeklySeries = (mod, richByDay) => {
      const PFX = mod === 'profit' ? 'PFA' : mod === 'revenue' ? 'RFA' : 'CA';
      const all = ANCH_DAYS.map(d => richByDay[d]);
      FILL_DAYS.forEach(D => {
        const hiD = ANCH_DAYS.filter(d => d < D).sort((a, b) => b - a)[0];   // newer milestone (fewer days ago)
        const loD = ANCH_DAYS.filter(d => d > D).sort((a, b) => a - b)[0];   // older milestone (more days ago)
        const lo = richByDay[loD].raw, hi = richByDay[hiD].raw;
        const t = (loD - D) / (loD - hiD);
        const raw = ipRaw(lo, hi, t);
        const id = PFX + '-2026-' + String(++_ipSerial).padStart(4, '0');
        raw.AUDIT_ID = id; raw.AUDIT_PERIOD = periodLabel(D);
        if (mod === 'cash') {
          all.push(mkCashAudit(dateStr(D), daysAgoISO(D), id, periodLabel(D), raw));
        } else {
          all.push(mkAudit(mod, { date: dateStr(D), generated_at: daysAgoISO(D), raw }));
        }
      });
      return all;
    };

    // ── Profit Audits ──
    App.data.audits = weeklySeries('profit', {
      90: mkAudit('profit', { date: dateStr(90), generated_at: daysAgoISO(90), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 33,
        DATA_TIER_LABEL: 'Tier 2 Analysis, Standard Data Submitted',
        AUDIT_PERIOD: periodLabel(90), AUDIT_ID: 'PFA-2026-0029',
        INDUSTRY_AVG: 63, TARGET_SCORE: 70,
        S1_SCORE: 32, S1_BAR_COST_PCT: 30.5, S1_TARGET_PCT: 22, S1_BAR_REV_MONTHLY: 45950,
        S1_BEV_COGS_PERIOD: 14015, S1_INV_VARIANCE_PCT: 6.8, S1_INV_VARIANCE_AMT: 1040,
        S1_POUR_METHOD: 'Free pour, no jiggers in use', S1_RECIPE_COVERAGE: '0 of 18 cocktails costed',
        S1_MONTHLY_GAP: 3906, S1_ANNUAL_GAP: 46872,
        S1_NARRATIVE: 'This first read is built from the sales and cost data you uploaded at intake, before Bar Cop captured a single shift. Bar pour cost ran 30.5% against a 22% target, the single largest profit leak in the audit. Free pouring with no jiggers and no costed recipes means every drink is a guess.',
        S1_FINDING: 'A 6.8% inventory variance confirms the overage is pour discipline, not menu pricing. An 8.5-point cost overage on $45,950 of monthly bar sales is $3,906 walking out every month.',
        S1_TOOL: 'Jigger every well and call drink, then watch pour variance in Spot Check.',
        S2_SCORE: 24, S2_VOID_COMP_PCT: 4.6, S2_VOID_COMP_AMT: 3820, S2_VOIDS_NO_APPROVAL_PCT: 71,
        S2_DRAWER_RECON: 'Not performed', S2_CASH_POLICY: 'No', S2_VOID_APPROVAL: 'No', S2_SPILLAGE_LOG: 'No',
        S2_MONTHLY_GAP: 2900,
        S2_NARRATIVE: 'Voids and comps reached 4.6% of sales, more than four times the 1% benchmark. 71% of voids were rung with no manager approval at all.',
        S2_FINDING: 'Two bartenders account for roughly 80% of unapproved voids. With no drawer reconciliation and no cash policy on file, there is no control gate anywhere in the cash path.',
        S2_TOOL: 'Log every void in Void and Comps against the server who rang it, and watch comp volume by server in Loss Prevention.',
        S3_SCORE: 30, S3_FOOD_COST_PCT: 40.5, S3_TARGET_PCT: 32, S3_FOOD_REV_MONTHLY: 27600,
        S3_FOOD_VAR_PCT: 7.1, S3_FOOD_VAR_AMT: 1960, S3_RECIPE_COVERAGE: '0 of 24 plates costed',
        S3_INV_FREQ: 'Never', S3_WASTE_LOG: 'No', S3_MONTHLY_GAP: 2346, S3_ANNUAL_GAP: 28152,
        S3_NARRATIVE: 'Food cost landed at 40.5% against a 32% target. No plates are costed, inventory is never counted, and there is no waste log.',
        S3_FINDING: 'A 7.1% food variance with zero recipe coverage means portioning is uncontrolled across the line. The 8.5-point overage costs $2,346 per month.',
        S3_TOOL: 'Cost your top 10 plates in Menu Items and track food variance in the Variance Report.',
        S4_SCORE: 40, S4_BEV_INVOICE_COUNT: 9, S4_FOOD_INVOICE_COUNT: 14, S4_VENDOR_SPEND_MONTHLY: 29400,
        S4_INVOICE_VS_PO: 'Never matched', S4_PRICE_VERIFY: 'No',
        S4_EXPOSURE_MONTHLY: 1140, S4_EXPOSURE_ANNUAL: 13680,
        S4_NARRATIVE: 'Invoices are never matched against orders and prices are never verified against quoted sheets.',
        S4_FINDING: 'Sampled invoices show price drift and at least two short deliveries that were paid in full. That works out to roughly $1,140 of monthly exposure, with no backup vendor to put pressure on prices.',
        S4_TOOL: 'Match every delivery to its order in Receive Delivery and file shortfalls in Vendor Tracker.',
        S5_SCORE: 38, S5_TOTAL_REV_PERIOD: 73550, S5_TOTAL_COGS_PERIOD: 25200, S5_LABOR_PERIOD: 23904,
        S5_LABOR_PCT: 32.5, S5_BAR_COST_PCT: 30.5, S5_FOOD_COST_PCT: 40.5, S5_PRIME_COST_PCT: 67.0,
        S5_TARGET_PCT: 60, S5_PRIME_COST_AMT: 49278, S5_RPLH_TRACKED: 'No', S5_LABOR_BY_DEPT: 'No',
        S5_COMBINED_COGS_GAP: 6252,
        S5_NARRATIVE: 'Prime cost hit 67.0% against a 60% target. That is 7 points of margin gone before a single fixed cost is paid.',
        S5_FINDING: 'Both COGS and labor are out of range. Combined COGS alone is $6,252 over target for the period. Labor is not tracked by department and RPLH is not measured.',
        S5_TOOL: 'Fixing pour cost and food cost first pulls prime cost down fastest; revisit labor once COGS is in range.',
        S6_SIG1_SCORE: 'HIGH', S6_SIG1_LABEL: 'Premium spirit variance',
        S6_SIG1_EVIDENCE: 'Three top-shelf bottles show 11-14% negative variance against POS sales.',
        S6_SIG1_GAP: 'Roughly $640/month in unaccounted premium pours.',
        S6_SIG1_TOOL: 'Run a Spot Check on those bottles every close for two weeks.',
        S6_SIG2_SCORE: 'HIGH', S6_SIG2_LABEL: 'Void concentration',
        S6_SIG2_EVIDENCE: '71% of voids were rung without a manager code; two bartenders account for 80% of them.',
        S6_SIG2_GAP: 'Pattern is consistent with comped-drink theft, not training error.',
        S6_SIG2_TOOL: 'Log every void in Void and Comps against the server who rang it, so the concentration on two bartenders shows in the log.',
        S6_SIG3_SCORE: 'MEDIUM', S6_SIG3_LABEL: 'No closing inventory counts',
        S6_SIG3_EVIDENCE: 'No end-of-night liquor counts were recorded in the audit period.',
        S6_SIG3_GAP: 'Variance cannot be isolated to a shift or a person.',
        S6_SIG3_TOOL: 'Run a closing Spot Check every night so variance ties to a shift.',
        S6_SIG4_SCORE: 'MEDIUM', S6_SIG4_LABEL: 'Unrestricted comp authority',
        S6_SIG4_EVIDENCE: 'Every server can comp without a limit or a reason code.',
        S6_SIG4_GAP: 'Comp dollars are untracked and untrainable.',
        S6_SIG4_TOOL: 'Log comps by server in Void and Comps; Loss Prevention flags a server comping far above the rest of the floor.'
      }}),
      60: mkAudit('profit', { date: dateStr(60), generated_at: daysAgoISO(60), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 44,
        DATA_TIER_LABEL: 'Tier 2 Analysis, Standard Data Submitted',
        AUDIT_PERIOD: periodLabel(60), AUDIT_ID: 'PFA-2026-0034',
        INDUSTRY_AVG: 63, TARGET_SCORE: 70,
        S1_SCORE: 44, S1_BAR_COST_PCT: 28.0, S1_TARGET_PCT: 22, S1_BAR_REV_MONTHLY: 47600,
        S1_BEV_COGS_PERIOD: 13328, S1_INV_VARIANCE_PCT: 5.0, S1_INV_VARIANCE_AMT: 720,
        S1_POUR_METHOD: 'Jiggers on wells, free pour still on call drinks', S1_RECIPE_COVERAGE: '8 of 18 cocktails costed',
        S1_MONTHLY_GAP: 2856, S1_ANNUAL_GAP: 34272,
        S1_NARRATIVE: 'Bar pour cost came down from 30.5% to 28.0% in the first month once jiggers went on the wells. The leak is shrinking, but the well-only measure leaves call and premium drinks uncontrolled.',
        S1_FINDING: 'Inventory variance dropped to 5.0%. A 6-point overage on $47,600 of monthly bar sales is $2,856 a month, most of it now on un-jiggered call pours.',
        S1_TOOL: 'Extend the jigger to call and premium pours and finish costing the remaining cocktails.',
        S2_SCORE: 42, S2_VOID_COMP_PCT: 3.4, S2_VOID_COMP_AMT: 2680, S2_VOIDS_NO_APPROVAL_PCT: 45,
        S2_DRAWER_RECON: 'Started at close', S2_CASH_POLICY: 'Drafted', S2_VOID_APPROVAL: 'Manager PIN added', S2_SPILLAGE_LOG: 'No',
        S2_MONTHLY_GAP: 1600,
        S2_NARRATIVE: 'Void and comp rate fell to 3.4% after a manager-PIN requirement went in. Unapproved voids dropped from 71% to 45%.',
        S2_FINDING: 'Drawer reconciliation has started at close and a cash policy is drafted. There is still no spillage log, so breakage and theft still look the same.',
        S2_TOOL: 'Finalize your written cash handling policy and start a spillage log at close.',
        S3_SCORE: 41, S3_FOOD_COST_PCT: 38.0, S3_TARGET_PCT: 32, S3_FOOD_REV_MONTHLY: 29000,
        S3_FOOD_VAR_PCT: 5.6, S3_FOOD_VAR_AMT: 1624, S3_RECIPE_COVERAGE: '12 of 24 plates costed',
        S3_INV_FREQ: 'Monthly', S3_WASTE_LOG: 'Started', S3_MONTHLY_GAP: 1740, S3_ANNUAL_GAP: 20880,
        S3_NARRATIVE: 'Food cost eased to 38.0% as half the menu got costed and monthly counts began.',
        S3_FINDING: 'Food variance is down to 5.6%. The remaining 6-point overage is $1,740 a month, concentrated on the dozen plates still uncosted.',
        S3_TOOL: 'Finish costing the menu in Menu Items and move counts from monthly to weekly.',
        S4_SCORE: 47, S4_BEV_INVOICE_COUNT: 10, S4_FOOD_INVOICE_COUNT: 15, S4_VENDOR_SPEND_MONTHLY: 29100,
        S4_INVOICE_VS_PO: 'Spot checked', S4_PRICE_VERIFY: 'Started',
        S4_EXPOSURE_MONTHLY: 720, S4_EXPOSURE_ANNUAL: 8640,
        S4_NARRATIVE: 'Invoice spot-checking caught two billing errors this period and price verification has begun.',
        S4_FINDING: 'Exposure fell to about $720 a month. One backup vendor is identified, but prices are not yet verified on every delivery.',
        S4_TOOL: 'Match every delivery in Receive Delivery, not a sample, and track price drift in Vendor Tracker.',
        S5_SCORE: 46, S5_TOTAL_REV_PERIOD: 76600, S5_TOTAL_COGS_PERIOD: 24700, S5_LABOR_PERIOD: 24129,
        S5_LABOR_PCT: 31.5, S5_BAR_COST_PCT: 28.0, S5_FOOD_COST_PCT: 38.0, S5_PRIME_COST_PCT: 63.0,
        S5_TARGET_PCT: 60, S5_PRIME_COST_AMT: 48258, S5_RPLH_TRACKED: 'Started', S5_LABOR_BY_DEPT: 'Yes',
        S5_COMBINED_COGS_GAP: 4596,
        S5_NARRATIVE: 'Prime cost came down from 67.0% to 63.0% as the COGS controls took hold.',
        S5_FINDING: 'Labor is now tracked by department. Combined COGS is still $4,596 over target for the period, the next block to recover.',
        S5_TOOL: 'Hold the COGS course; prime cost closes on target as recipe coverage completes.',
        S6_SIG1_SCORE: 'MEDIUM', S6_SIG1_LABEL: 'Call-liquor free pour',
        S6_SIG1_EVIDENCE: 'Wells are jiggered but call and premium drinks are still free poured.',
        S6_SIG1_GAP: 'Most of the remaining pour-cost gap sits in this category.',
        S6_SIG1_TOOL: 'Extend measured pours to call liquor.',
        S6_SIG2_SCORE: 'MEDIUM', S6_SIG2_LABEL: 'Void rate trending down',
        S6_SIG2_EVIDENCE: 'Void rate fell from 4.6% to 3.4% after the manager-PIN rule.',
        S6_SIG2_GAP: 'On track. Keep watching the two flagged bartenders.',
        S6_SIG2_TOOL: 'Review the Void and Comps log weekly in Loss Prevention.',
        S6_SIG3_SCORE: 'MEDIUM', S6_SIG3_LABEL: 'No spillage log',
        S6_SIG3_EVIDENCE: 'Breakage and spillage are still not recorded anywhere.',
        S6_SIG3_GAP: 'Legitimate loss cannot be separated from variance.',
        S6_SIG3_TOOL: 'Start logging breakage in Waste and Spills this week.'
      }}),
      30: mkAudit('profit', { date: dateStr(30), generated_at: daysAgoISO(30), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 58,
        DATA_TIER_LABEL: 'Tier 3 Analysis, Full Data Submitted',
        AUDIT_PERIOD: periodLabel(30), AUDIT_ID: 'PFA-2026-0040',
        INDUSTRY_AVG: 63, TARGET_SCORE: 70,
        S1_SCORE: 60, S1_BAR_COST_PCT: 25.0, S1_TARGET_PCT: 22, S1_BAR_REV_MONTHLY: 50000,
        S1_BEV_COGS_PERIOD: 12500, S1_INV_VARIANCE_PCT: 3.2, S1_INV_VARIANCE_AMT: 480,
        S1_POUR_METHOD: 'Measured pours on wells and call liquor',
        S1_RECIPE_COVERAGE: '16 of 18 cocktails costed', S1_MONTHLY_GAP: 1500, S1_ANNUAL_GAP: 18000,
        S1_NARRATIVE: 'Bar pour cost is down to 25.0% now that measured pours reached call liquor and most cocktails are costed. Inventory variance is under control at 3.2%.',
        S1_FINDING: 'The remaining 3-point gap is two uncosted cocktails and normal menu-mix drift, worth about $1,500 a month.',
        S1_TOOL: 'Cost the last two cocktails and review pour variance weekly in Spot Check.',
        S2_SCORE: 56, S2_VOID_COMP_PCT: 2.2, S2_VOID_COMP_AMT: 1760, S2_VOIDS_NO_APPROVAL_PCT: 18,
        S2_DRAWER_RECON: 'Performed at close', S2_CASH_POLICY: 'Finalized', S2_VOID_APPROVAL: 'Manager PIN required', S2_SPILLAGE_LOG: 'Running',
        S2_MONTHLY_GAP: 800,
        S2_NARRATIVE: 'Void and comp rate is down to 2.2% with only 18% of voids unapproved. The cash policy is finalized and a spillage log is running.',
        S2_FINDING: 'Breakage now separates cleanly from theft. The remaining gap is occasional unapproved voids on the late shift.',
        S2_TOOL: 'Review the unapproved voids each week in Loss Prevention and coach the late crew.',
        S3_SCORE: 55, S3_FOOD_COST_PCT: 35.0, S3_TARGET_PCT: 32, S3_FOOD_REV_MONTHLY: 30000,
        S3_FOOD_VAR_PCT: 3.5, S3_FOOD_VAR_AMT: 1050, S3_RECIPE_COVERAGE: '20 of 24 plates costed',
        S3_INV_FREQ: 'Weekly', S3_WASTE_LOG: 'Running', S3_MONTHLY_GAP: 900, S3_ANNUAL_GAP: 10800,
        S3_NARRATIVE: 'Food cost improved to 35.0% with weekly counts in place and most plates costed.',
        S3_FINDING: 'Food variance is down to 3.5%. The last 3-point gap is the four uncosted plates and two low-margin plowhorses, worth $900 a month.',
        S3_TOOL: 'Finish the last four plate cards and reprice the two lowest-margin plates in Menu Engineering.',
        S4_SCORE: 60, S4_BEV_INVOICE_COUNT: 11, S4_FOOD_INVOICE_COUNT: 16, S4_VENDOR_SPEND_MONTHLY: 28200,
        S4_INVOICE_VS_PO: 'Matched on most deliveries', S4_PRICE_VERIFY: 'Yes',
        S4_EXPOSURE_MONTHLY: 380, S4_EXPOSURE_ANNUAL: 4560,
        S4_NARRATIVE: 'Most deliveries are now matched against the order and prices are verified against quoted sheets.',
        S4_FINDING: 'Exposure fell to about $380 a month. A backup vendor is in place per category; the gap is the occasional unmatched delivery.',
        S4_TOOL: 'Match every delivery, not most, and review price drift monthly in Vendor Tracker.',
        S5_SCORE: 59, S5_TOTAL_REV_PERIOD: 80000, S5_TOTAL_COGS_PERIOD: 23800, S5_LABOR_PERIOD: 24000,
        S5_LABOR_PCT: 30.0, S5_BAR_COST_PCT: 25.0, S5_FOOD_COST_PCT: 35.0, S5_PRIME_COST_PCT: 58.0,
        S5_TARGET_PCT: 60, S5_PRIME_COST_AMT: 46400, S5_RPLH_TRACKED: 'Yes', S5_LABOR_BY_DEPT: 'Yes',
        S5_COMBINED_COGS_GAP: 2400,
        S5_NARRATIVE: 'Prime cost crossed under the 60% target this period, landing at 58.0%.',
        S5_FINDING: 'Labor is tracked by department and RPLH is in use. Combined COGS is $2,400 over target, the last increment of margin to recover.',
        S5_TOOL: 'Hold prime cost here and start shifting attention to revenue growth.',
        S6_SIG1_SCORE: 'LOW', S6_SIG1_LABEL: 'Pour discipline holding',
        S6_SIG1_EVIDENCE: 'Inventory variance has held under 4% for two periods.',
        S6_SIG1_GAP: 'On track. This is close to the target state.',
        S6_SIG1_TOOL: 'Run a weekly Spot Check on measured pours.',
        S6_SIG2_SCORE: 'MEDIUM', S6_SIG2_LABEL: 'Late-shift unapproved voids',
        S6_SIG2_EVIDENCE: '18% of voids still ring without a manager code, mostly on late shifts.',
        S6_SIG2_GAP: 'A small but persistent control gap on one shift.',
        S6_SIG2_TOOL: 'Coach the late crew and review their voids weekly in Loss Prevention.',
        S6_SIG3_SCORE: 'LOW', S6_SIG3_LABEL: 'Spillage log running',
        S6_SIG3_EVIDENCE: 'Breakage is now logged at close and separates from variance.',
        S6_SIG3_GAP: 'On track. Keep the log current.',
        S6_SIG3_TOOL: 'Keep logging breakage in Waste and Spills.'
      }}),
      0: mkAudit('profit', { date: dateStr(0), generated_at: daysAgoISO(0), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 70,
        DATA_TIER_LABEL: 'Tier 3 Analysis, Full Data Submitted',
        AUDIT_PERIOD: periodLabel(0), AUDIT_ID: 'PFA-2026-0046',
        INDUSTRY_AVG: 63, TARGET_SCORE: 70,
        S1_SCORE: 72, S1_BAR_COST_PCT: 23.0, S1_TARGET_PCT: 22, S1_BAR_REV_MONTHLY: 52000,
        S1_BEV_COGS_PERIOD: 11960, S1_INV_VARIANCE_PCT: 2.0, S1_INV_VARIANCE_AMT: 312,
        S1_POUR_METHOD: 'Measured pours on all spirits', S1_RECIPE_COVERAGE: '18 of 18 cocktails costed',
        S1_MONTHLY_GAP: 520, S1_ANNUAL_GAP: 6240,
        S1_NARRATIVE: 'Bar pour cost is 23.0%, a point off target, with every cocktail costed and measured pours across the board.',
        S1_FINDING: 'Inventory variance of 2.0% is healthy. The small residual gap is normal menu-mix drift, not a control failure.',
        S1_TOOL: 'Hold the discipline and review pour cost monthly rather than chasing it weekly.',
        S2_SCORE: 68, S2_VOID_COMP_PCT: 1.5, S2_VOID_COMP_AMT: 1240, S2_VOIDS_NO_APPROVAL_PCT: 8,
        S2_DRAWER_RECON: 'Performed at close', S2_CASH_POLICY: 'Yes', S2_VOID_APPROVAL: 'Manager PIN required', S2_SPILLAGE_LOG: 'Yes',
        S2_MONTHLY_GAP: 350,
        S2_NARRATIVE: 'Void and comp rate is down to 1.5%, near the 1% benchmark, with only 8% of voids unapproved.',
        S2_FINDING: 'The cash policy is finalized, drawers reconcile at close, and a spillage log runs. Breakage separates cleanly from theft.',
        S2_TOOL: 'Review the Void and Comps log monthly and refresh staff training each quarter.',
        S3_SCORE: 66, S3_FOOD_COST_PCT: 33.0, S3_TARGET_PCT: 32, S3_FOOD_REV_MONTHLY: 31200,
        S3_FOOD_VAR_PCT: 2.6, S3_FOOD_VAR_AMT: 811, S3_RECIPE_COVERAGE: '24 of 24 plates costed',
        S3_INV_FREQ: 'Weekly', S3_WASTE_LOG: 'Yes', S3_MONTHLY_GAP: 310, S3_ANNUAL_GAP: 3720,
        S3_NARRATIVE: 'Food cost is 33.0%, within a point of target, with the full menu costed and weekly counts in place.',
        S3_FINDING: 'Food variance of 2.6% is acceptable. The remaining gap closes with targeted repricing on two plowhorse plates.',
        S3_TOOL: 'Use Menu Engineering to reprice the two lowest-margin plates.',
        S4_SCORE: 70, S4_BEV_INVOICE_COUNT: 11, S4_FOOD_INVOICE_COUNT: 16, S4_VENDOR_SPEND_MONTHLY: 27600,
        S4_INVOICE_VS_PO: 'Matched on every delivery', S4_PRICE_VERIFY: 'Yes',
        S4_EXPOSURE_MONTHLY: 180, S4_EXPOSURE_ANNUAL: 2160,
        S4_NARRATIVE: 'Every delivery is now matched to its order and prices are verified against quoted sheets.',
        S4_FINDING: 'Exposure has fallen to about $180 a month. Every delivery is matched and price drift is tracked in Vendor Tracker, with two backup vendors per category.',
        S4_TOOL: 'Keep matching deliveries and reviewing price changes in Vendor Tracker.',
        S5_SCORE: 71, S5_TOTAL_REV_PERIOD: 83200, S5_TOTAL_COGS_PERIOD: 22600, S5_LABOR_PERIOD: 23800,
        S5_LABOR_PCT: 28.6, S5_BAR_COST_PCT: 23.0, S5_FOOD_COST_PCT: 33.0, S5_PRIME_COST_PCT: 55.0,
        S5_TARGET_PCT: 60, S5_PRIME_COST_AMT: 45760, S5_RPLH_TRACKED: 'Yes', S5_LABOR_BY_DEPT: 'Yes',
        S5_COMBINED_COGS_GAP: 830,
        S5_NARRATIVE: 'Prime cost is 55.0%, comfortably under the 60% target and the lowest in the series.',
        S5_FINDING: 'Labor is tracked by department and RPLH is in use. Combined COGS is just $830 over the sub-targets, essentially at target.',
        S5_TOOL: 'Hold prime cost here and shift focus to revenue growth to widen the margin further.',
        S6_SIG1_SCORE: 'LOW', S6_SIG1_LABEL: 'Pour discipline holding',
        S6_SIG1_EVIDENCE: 'Inventory variance has stayed under 3% for three consecutive periods.',
        S6_SIG1_GAP: 'No action required. This is the target state.',
        S6_SIG1_TOOL: 'Run a weekly Spot Check on measured pours.',
        S6_SIG2_SCORE: 'MEDIUM', S6_SIG2_LABEL: 'Vendor price drift unreviewed',
        S6_SIG2_EVIDENCE: 'Two vendors logged price increases this period that have not been reviewed.',
        S6_SIG2_GAP: 'Small price increases quietly give back the margin you just recovered.',
        S6_SIG2_TOOL: 'Review the Price Changes tab in Vendor Tracker each month.'
      }})
    });

    // ── Revenue Audits ──
    App.data.revenue_audits = weeklySeries('revenue', {
      90: mkAudit('revenue', { date: dateStr(90), generated_at: daysAgoISO(90), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 39,
        DATA_TIER_LABEL: 'Tier 2 Analysis, Standard Data Submitted',
        AUDIT_PERIOD: periodLabel(90), AUDIT_ID: 'RVA-2026-0012',
        INDUSTRY_AVG: 61, TARGET_SCORE: 70,
        S1_SCORE: 38, S1_CHECK_AVG: 35.40, S1_CHECK_AVG_TARGET: 40.00, S1_BAR_CHECK_AVG: 28.40,
        S1_FOOD_CHECK_AVG: 41.60, S1_COVER_COUNT: 2090, S1_MONTHLY_REVENUE: 73400,
        S1_MONTHLY_GAP: 3400, S1_ANNUAL_GAP: 40800,
        S1_NARRATIVE: 'This first read is built from the data you uploaded at intake. Blended check average of $35.40 sits $4.60 below a $40.00 target for a bar and bistro at this price point. Bar checks at $28.40 are dragging the blend down.',
        S1_FINDING: 'There is no upsell standard and no add-on prompts. Capturing even a third of the gap is worth $3,400 a month at the current cover count.',
        S1_TOOL: 'Set a floor upsell standard and track check average in Server Check each week.',
        S2_SCORE: 40, S2_LABOR_PCT: 32.5, S2_LABOR_TARGET_PCT: 30, S2_RPLH: 60, S2_RPLH_TARGET: 75,
        S2_LABOR_PERIOD: 23900, S2_SCHED_VS_ACTUAL: '214 scheduled / 231 actual hrs', S2_OVERTIME_HRS: 24,
        S2_MONTHLY_GAP: 1838,
        S2_NARRATIVE: 'Total labor ran 32.5% against a 30% target. Actual hours overran the schedule by 17 hours, and 24 of them were overtime.',
        S2_FINDING: 'RPLH of $60 is short of the $75 target. The floor is overstaffed on slow shifts and clock-out discipline is loose.',
        S2_TOOL: 'Build the schedule against your labor target in Build Schedule and watch Overtime Watch.',
        S3_SCORE: 36, S3_STARS_COUNT: 3, S3_PLOWHORSES_COUNT: 9, S3_DOGS_COUNT: 7, S3_PUZZLES_COUNT: 5,
        S3_TOP_CATEGORY: 'Draft Beer', S3_MONTHLY_GAP: 1820, S3_PRICING_OPPORTUNITY: 2640,
        S3_NARRATIVE: 'The menu carries seven Dogs against only three Stars.',
        S3_FINDING: 'Revenue leans on low-margin draft beer. Repricing or cutting Dogs and promoting Stars is a $1,820 a month mix opportunity, with $2,640 more available from pricing.',
        S3_TOOL: 'Use Menu Engineering and the Dog Test Tracker to rework the seven Dog items.',
        S4_SCORE: 42, S4_SERVER_COUNT: 9, S4_TOP_CHECK_AVG: 44.00, S4_BOTTOM_CHECK_AVG: 27.50,
        S4_PERFORMANCE_SPREAD: 16.50, S4_APP_ATTACH_RATE: 19, S4_DESSERT_ATTACH_RATE: 6,
        S4_PRESHIFT_BRIEFING: 'Not held', S4_MONTHLY_GAP: 3200,
        S4_NARRATIVE: 'The spread between the top and bottom server check average is $16.50. That is a coaching gap, not a talent gap.',
        S4_FINDING: 'Appetizer attach sits at 19% and dessert at 6%. With no pre-shift briefing, the bottom third is never coached. Lifting them to the team average is worth $3,200 a month.',
        S4_TOOL: 'Start a daily pre-shift briefing and track each server in Server Check.',
        S5_SCORE: 39, S5_EVENT_REV_PERIOD: 2400, S5_EVENTS_PER_MONTH: 1, S5_AVG_EVENT_REVENUE: 2400,
        S5_MINIMUM_MET: false, S5_CATERING_REV_PERIOD: 0, S5_ANNUAL_EVENT_GAP: 64800, S5_MONTHLY_GAP: 5400,
        S5_NARRATIVE: 'Events brought in $2,400 from a single booking. There is no private dining minimum and no catering revenue at all.',
        S5_FINDING: 'For a venue this size, three to four events a month is realistic. The unbuilt event channel is the largest single opportunity in this audit at $5,400 a month.',
        S5_TOOL: 'Build a private dining package in Events with a spend minimum and a rate card.',
        S6_SIG1_SCORE: 'HIGH', S6_SIG1_LABEL: 'Server comp concentration',
        S6_SIG1_EVIDENCE: 'One server accounts for 54% of comped checks over the audit period.',
        S6_SIG1_GAP: 'Pattern is consistent with discount abuse, not service recovery.',
        S6_SIG1_TOOL: 'Review comps by server in Loss Prevention; it flags a server comping far above the rest of the floor.',
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
      60: mkAudit('revenue', { date: dateStr(60), generated_at: daysAgoISO(60), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 48,
        DATA_TIER_LABEL: 'Tier 2 Analysis, Standard Data Submitted',
        AUDIT_PERIOD: periodLabel(60), AUDIT_ID: 'RVA-2026-0017',
        INDUSTRY_AVG: 61, TARGET_SCORE: 70,
        S1_SCORE: 47, S1_CHECK_AVG: 36.20, S1_CHECK_AVG_TARGET: 40.00, S1_BAR_CHECK_AVG: 29.60,
        S1_FOOD_CHECK_AVG: 42.40, S1_COVER_COUNT: 2110, S1_MONTHLY_REVENUE: 76400,
        S1_MONTHLY_GAP: 2600, S1_ANNUAL_GAP: 31200,
        S1_NARRATIVE: 'Check average climbed to $36.20 in the first month, with bar checks up $1.20 as the upsell standard took hold.',
        S1_FINDING: 'The blend is now $3.80 short of target. Dessert and after-dinner drinks are the weakest add-ons, where most of the remaining gap sits.',
        S1_TOOL: 'Add a dessert and digestif prompt to the close-out step of the server script.',
        S2_SCORE: 50, S2_LABOR_PCT: 31.5, S2_LABOR_TARGET_PCT: 30, S2_RPLH: 68, S2_RPLH_TARGET: 75,
        S2_LABOR_PERIOD: 24100, S2_SCHED_VS_ACTUAL: '221 scheduled / 229 actual hrs', S2_OVERTIME_HRS: 12,
        S2_MONTHLY_GAP: 1146,
        S2_NARRATIVE: 'Labor came down to 31.5% as scheduling tightened. Overtime halved, from 24 hours to 12.',
        S2_FINDING: 'RPLH improved to $68. The remaining gap is slow-shift overstaffing on weeknights.',
        S2_TOOL: 'Trim one floor position on Monday through Wednesday and cross-train the bar.',
        S3_SCORE: 45, S3_STARS_COUNT: 5, S3_PLOWHORSES_COUNT: 8, S3_DOGS_COUNT: 4, S3_PUZZLES_COUNT: 6,
        S3_TOP_CATEGORY: 'Craft Cocktails', S3_MONTHLY_GAP: 1080, S3_PRICING_OPPORTUNITY: 1880,
        S3_NARRATIVE: 'Three Dogs were cut and two repriced; Stars rose from three to five. Craft cocktails are now the top revenue category.',
        S3_FINDING: 'Four Dogs remain. Continuing to convert Plowhorses into Stars is a $1,080 a month opportunity.',
        S3_TOOL: 'Reprint the menu to give the five Stars premium placement.',
        S4_SCORE: 50, S4_SERVER_COUNT: 9, S4_TOP_CHECK_AVG: 45.20, S4_BOTTOM_CHECK_AVG: 31.60,
        S4_PERFORMANCE_SPREAD: 13.60, S4_APP_ATTACH_RATE: 28, S4_DESSERT_ATTACH_RATE: 11,
        S4_PRESHIFT_BRIEFING: 'Held 3 nights a week', S4_MONTHLY_GAP: 2100,
        S4_NARRATIVE: 'The server spread narrowed to $13.60 as pre-shift briefings began. Appetizer attach improved nine points.',
        S4_FINDING: 'Briefings only run three nights a week, so the weekend crew misses coaching. Dessert attach is still low at 11%.',
        S4_TOOL: 'Extend the pre-shift briefing to all seven shifts.',
        S5_SCORE: 48, S5_EVENT_REV_PERIOD: 6800, S5_EVENTS_PER_MONTH: 3, S5_AVG_EVENT_REVENUE: 2267,
        S5_MINIMUM_MET: true, S5_CATERING_REV_PERIOD: 1500, S5_ANNUAL_EVENT_GAP: 38400, S5_MONTHLY_GAP: 3200,
        S5_NARRATIVE: 'Events grew to three bookings and $6,800, and a private dining minimum is now enforced.',
        S5_FINDING: 'Catering opened with $1,500. The channel is working but is still well below the venue\'s realistic ceiling.',
        S5_TOOL: 'List the private dining package on the website and the Google Business Profile.',
        S6_SIG1_SCORE: 'MEDIUM', S6_SIG1_LABEL: 'Weekend pre-shift gap',
        S6_SIG1_EVIDENCE: 'Briefings now run 3 of 7 nights, weekends still missed.',
        S6_SIG1_GAP: 'Weekend covers are the highest-revenue shifts and get no coaching.',
        S6_SIG1_TOOL: 'Extend the briefing to Friday and Saturday close-out crews.',
        S6_SIG2_SCORE: 'MEDIUM', S6_SIG2_LABEL: 'Weeknight floor still loose',
        S6_SIG2_EVIDENCE: 'Tuesday and Wednesday floor RPLH still under $62.',
        S6_SIG2_GAP: 'Cross-training to cover the bar would tighten this.',
        S6_SIG2_TOOL: 'Cross-train two servers to barback on slow nights.',
        S6_SIG3_SCORE: 'LOW', S6_SIG3_LABEL: 'Bottom server gap closing',
        S6_SIG3_EVIDENCE: 'Bottom-third check average up $4.10, spread now $13.60.',
        S6_SIG3_GAP: 'On track. Spread under $10 is the target.',
        S6_SIG3_TOOL: 'Keep the daily briefings going and add a monthly server-by-server review.'
      }}),
      30: mkAudit('revenue', { date: dateStr(30), generated_at: daysAgoISO(30), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 56,
        DATA_TIER_LABEL: 'Tier 3 Analysis, Full Data Submitted',
        AUDIT_PERIOD: periodLabel(30), AUDIT_ID: 'RVA-2026-0022',
        INDUSTRY_AVG: 61, TARGET_SCORE: 70,
        S1_SCORE: 56, S1_CHECK_AVG: 36.90, S1_CHECK_AVG_TARGET: 40.00, S1_BAR_CHECK_AVG: 30.60,
        S1_FOOD_CHECK_AVG: 43.00, S1_COVER_COUNT: 2140, S1_MONTHLY_REVENUE: 78900,
        S1_MONTHLY_GAP: 1700, S1_ANNUAL_GAP: 20400,
        S1_NARRATIVE: 'Check average reached $36.90 as the dessert and digestif prompts landed. Bar checks are up $2.20 from the intake baseline.',
        S1_FINDING: 'The blend is $3.10 short of the $40 target. The remaining lift is dessert attach, still the weakest add-on.',
        S1_TOOL: 'Run a dessert-attach push and keep tracking each server in Server Check.',
        S2_SCORE: 60, S2_LABOR_PCT: 30.0, S2_LABOR_TARGET_PCT: 30, S2_RPLH: 74, S2_RPLH_TARGET: 75,
        S2_LABOR_PERIOD: 24000, S2_SCHED_VS_ACTUAL: '226 scheduled / 229 actual hrs', S2_OVERTIME_HRS: 6,
        S2_MONTHLY_GAP: 0,
        S2_NARRATIVE: 'Labor hit the 30% target this period and overtime is down to 6 hours. RPLH of $74 is a point off target.',
        S2_FINDING: 'Schedule and actual hours are nearly aligned. The slow-night overstaffing is mostly resolved.',
        S2_TOOL: 'Hold the schedule discipline and fine-tune weekend bar coverage.',
        S3_SCORE: 53, S3_STARS_COUNT: 6, S3_PLOWHORSES_COUNT: 8, S3_DOGS_COUNT: 3, S3_PUZZLES_COUNT: 6,
        S3_TOP_CATEGORY: 'Craft Cocktails', S3_MONTHLY_GAP: 700, S3_PRICING_OPPORTUNITY: 1200,
        S3_NARRATIVE: 'Stars rose to six and Dogs are down to three. Craft cocktails hold the top revenue spot.',
        S3_FINDING: 'Three Dogs remain. Converting the last Plowhorses into Stars is a $700 a month opportunity.',
        S3_TOOL: 'Reprice or cut the last three Dog items in Menu Engineering.',
        S4_SCORE: 58, S4_SERVER_COUNT: 10, S4_TOP_CHECK_AVG: 46.40, S4_BOTTOM_CHECK_AVG: 35.40,
        S4_PERFORMANCE_SPREAD: 11.00, S4_APP_ATTACH_RATE: 33, S4_DESSERT_ATTACH_RATE: 15,
        S4_PRESHIFT_BRIEFING: 'Held most shifts', S4_MONTHLY_GAP: 1500,
        S4_NARRATIVE: 'The server spread narrowed to $11.00 with briefings on most shifts. Appetizer attach reached 33%.',
        S4_FINDING: 'The weekend crew is now coached. Dessert attach at 15% is the next target.',
        S4_TOOL: 'Extend the briefing to every shift and run a dessert-attach contest.',
        S5_SCORE: 53, S5_EVENT_REV_PERIOD: 9000, S5_EVENTS_PER_MONTH: 4, S5_AVG_EVENT_REVENUE: 2250,
        S5_MINIMUM_MET: true, S5_CATERING_REV_PERIOD: 2400, S5_ANNUAL_EVENT_GAP: 26400, S5_MONTHLY_GAP: 2200,
        S5_NARRATIVE: 'Events grew to four bookings and $9,000, with catering up to $2,400.',
        S5_FINDING: 'The channel is building steadily. A second weekend time slot is the path to the venue ceiling.',
        S5_TOOL: 'Add a second private dining slot on Fridays and Saturdays.',
        S6_SIG1_SCORE: 'MEDIUM', S6_SIG1_LABEL: 'Dessert attach lagging',
        S6_SIG1_EVIDENCE: 'Dessert attach at 15% against a 25% target.',
        S6_SIG1_GAP: 'The largest remaining lift on check average.',
        S6_SIG1_TOOL: 'Run a one-month dessert-attach contest with a server prize.',
        S6_SIG2_SCORE: 'LOW', S6_SIG2_LABEL: 'Labor at target',
        S6_SIG2_EVIDENCE: 'Labor hit 30.0% with RPLH at $74.',
        S6_SIG2_GAP: 'On track. Hold the schedule discipline.',
        S6_SIG2_TOOL: 'Keep building the schedule against the labor target in Build Schedule.',
        S6_SIG3_SCORE: 'LOW', S6_SIG3_LABEL: 'Server spread closing',
        S6_SIG3_EVIDENCE: 'Top-to-bottom spread down to $11.00.',
        S6_SIG3_GAP: 'On track. Spread under $10 is the target.',
        S6_SIG3_TOOL: 'Keep daily briefings and a monthly server review.'
      }}),
      0: mkAudit('revenue', { date: dateStr(0), generated_at: daysAgoISO(0), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 64,
        DATA_TIER_LABEL: 'Tier 3 Analysis, Full Data Submitted',
        AUDIT_PERIOD: periodLabel(0), AUDIT_ID: 'RVA-2026-0028',
        INDUSTRY_AVG: 61, TARGET_SCORE: 70,
        S1_SCORE: 64, S1_CHECK_AVG: 38.10, S1_CHECK_AVG_TARGET: 40.00, S1_BAR_CHECK_AVG: 31.80,
        S1_FOOD_CHECK_AVG: 44.20, S1_COVER_COUNT: 2170, S1_MONTHLY_REVENUE: 82700,
        S1_MONTHLY_GAP: 800, S1_ANNUAL_GAP: 9600,
        S1_NARRATIVE: 'Blended check average reached $38.10, up $2.70 from the intake baseline and closing on the $40 target.',
        S1_FINDING: 'Bar checks are up $3.40 since intake and holding. The last $1.90 to target is dessert and digestif attach.',
        S1_TOOL: 'Hold the upsell standard and keep pushing dessert attach toward 25%.',
        S2_SCORE: 68, S2_LABOR_PCT: 28.6, S2_LABOR_TARGET_PCT: 30, S2_RPLH: 80, S2_RPLH_TARGET: 75,
        S2_LABOR_PERIOD: 23800, S2_SCHED_VS_ACTUAL: '228 scheduled / 229 actual hrs', S2_OVERTIME_HRS: 3,
        S2_MONTHLY_GAP: 0,
        S2_NARRATIVE: 'Labor is 28.6%, under the 30% target, with RPLH at $80, ahead of the $75 benchmark.',
        S2_FINDING: 'Schedule and actual hours are aligned and overtime is down to 3 hours. Labor is a strength now.',
        S2_TOOL: 'Hold the discipline and revisit the schedule only as covers grow.',
        S3_SCORE: 62, S3_STARS_COUNT: 7, S3_PLOWHORSES_COUNT: 7, S3_DOGS_COUNT: 2, S3_PUZZLES_COUNT: 6,
        S3_TOP_CATEGORY: 'Craft Cocktails', S3_MONTHLY_GAP: 400, S3_PRICING_OPPORTUNITY: 980,
        S3_NARRATIVE: 'The menu now carries seven Stars and only two Dogs. Craft cocktails hold the top revenue spot.',
        S3_FINDING: 'Menu mix is healthy. The small remaining gap is routine quarterly pricing maintenance.',
        S3_TOOL: 'Schedule a quarterly Menu Engineering review to keep the mix tuned.',
        S4_SCORE: 66, S4_SERVER_COUNT: 10, S4_TOP_CHECK_AVG: 47.20, S4_BOTTOM_CHECK_AVG: 37.80,
        S4_PERFORMANCE_SPREAD: 9.40, S4_APP_ATTACH_RATE: 37, S4_DESSERT_ATTACH_RATE: 18,
        S4_PRESHIFT_BRIEFING: 'Held every shift', S4_MONTHLY_GAP: 1100,
        S4_NARRATIVE: 'The server spread tightened to $9.40 with briefings held every shift. Appetizer attach reached 37%.',
        S4_FINDING: 'The bottom server is now within $9.40 of the top. Dessert attach at 18% is the next coaching target.',
        S4_TOOL: 'Set a dessert-attach contest for the next month to push past 25%.',
        S5_SCORE: 60, S5_EVENT_REV_PERIOD: 11200, S5_EVENTS_PER_MONTH: 5, S5_AVG_EVENT_REVENUE: 2240,
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
    });

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
    // check average. Build Schedule reads covers_per_day for its cover target.
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
      // Both weeks feed the schedule builder's cover target and the forecast.
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

    // ── Revenue Initiative Tracker — operator-typed experiments, each watching a
    // metric that genuinely moved across the recovery arc, so the 8-week-before vs
    // 8-week-after lift computes to a real, believable number (a win, in gold).
    // Mid-window start dates give each one weeks on both sides of the change.
    App.data.initiatives = [
      { id:uid(), name:'New Cocktail Menu', start_date:dateStr(45), type:'Menu Change', metric:'check_avg',
        hypothesis:'Launched eight new craft cocktails to lift the bar check average.', status:'Active', created_at:daysAgoISO(45) },
      { id:uid(), name:'Tighter Weeknight Scheduling', start_date:dateStr(52), type:'Operational Change', metric:'labor_pct',
        hypothesis:'Cut one floor position Monday through Wednesday and cross-trained the bar to the well.', status:'Active', created_at:daysAgoISO(52) },
      { id:uid(), name:'Weeknight Happy Hour Extension', start_date:dateStr(31), type:'Promotion', metric:'revenue',
        hypothesis:'Pushed happy hour to 7pm Tuesday through Thursday to lift weeknight revenue.', status:'Active', created_at:daysAgoISO(31) },
      { id:uid(), name:'Daily Pre-Shift Briefings', start_date:dateStr(70), type:'Service Change', metric:'check_avg',
        hypothesis:'Added a daily pre-shift upsell briefing on every dinner shift.', status:'Completed', created_at:daysAgoISO(70), completed_at:daysAgoISO(8) }
    ];

    // ── Profit Initiative Tracker — cost experiments, each watching a cost
    // percentage that fell across the recovery arc, so the 8-week before/after
    // lift reads as a real win (a drop, in gold, since lower is better).
    App.data.profit_initiatives = [
      { id:uid(), name:'Re-Spec\'d Well Pours to 1.25oz', start_date:dateStr(52), type:'Pour Spec', metric:'pour_pct',
        hypothesis:'Dropped every well pour from a free pour to a 1.25oz jigger and re-trained the bar.', status:'Active', created_at:daysAgoISO(52) },
      { id:uid(), name:'Portion Control on Top Plates', start_date:dateStr(45), type:'Portion Control', metric:'food_pct',
        hypothesis:'Put scales on the line and locked portions on the five highest-cost plates.', status:'Active', created_at:daysAgoISO(45) },
      { id:uid(), name:'Switched Liquor Distributor', start_date:dateStr(38), type:'Vendor Change', metric:'pour_pct',
        hypothesis:'Moved the well and rail to a new distributor at a better case price.', status:'Active', created_at:daysAgoISO(38) },
      { id:uid(), name:'Cut Prep Over-Production', start_date:dateStr(70), type:'Operational Change', metric:'food_pct',
        hypothesis:'Tightened prep pars so the kitchen stopped over-producing and dumping at close.', status:'Completed', created_at:daysAgoISO(70), completed_at:daysAgoISO(9) }
    ];

    // ── Cash Experiments — liquidity changes, each watching a cash metric that
    // improved across the recovery arc (trapped cash and the cash cycle both fell,
    // runway grew), so the 8-week before/after lift reads as a real win. Measured
    // off the weekly cash_audits series.
    App.data.cash_initiatives = [
      { id:uid(), name:'Moved Top Vendors to Net-30', start_date:dateStr(45), type:'Payment Terms', metric:'cycle',
        hypothesis:'Negotiated net-30 with the three biggest vendors to hold cash longer and shorten the cash cycle.', status:'Active', created_at:daysAgoISO(45) },
      { id:uid(), name:'Ran Down Dead Stock', start_date:dateStr(52), type:'Dead Stock', metric:'trapped',
        hypothesis:'Cleared slow-moving premium bottles and overstock to pull cash off the shelf.', status:'Active', created_at:daysAgoISO(52) },
      { id:uid(), name:'Cut Liquor Par Levels', start_date:dateStr(70), type:'Par / Ordering', metric:'runway',
        hypothesis:'Lowered pars on slow movers and moved to weekly ordering, freeing cash and extending the runway.', status:'Completed', created_at:daysAgoISO(70), completed_at:daysAgoISO(9) }
    ];

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
        service_charge_pct:20, tax_pct:8.25,
        actual_revenue:0, event_food_cost:0, event_bar_cost:0, event_other_cost:0,
        guaranteed_count:28, count_due_date:dateStr(-6), day_contact_name:'Dana Hargrove', day_contact_phone:'512-555-0119',
        timeline:'6:30 room set. 7:00 guests arrive, passed apps and the bar open. 8:00 cake drop, lights down. 9:30 last call. 10:00 out.',
        menu_notes:'Passed apps the first hour: sliders, calamari, bruschetta. Birthday cake brought in by the guest, we plate and serve.',
        bev_notes:'Hosted beer and wine plus two signature cocktails on consumption. Champagne toast at the cake.',
        allergies:'One shellfish allergy, keep the calamari off that end of the room. One vegetarian.',
        setup_notes:'Private Room, three rounds of eight plus a standing bar. Reserved sign on the door.',
        av_notes:'House playlist low, a mic for the toast. They bring a slideshow on a laptop, HDMI to the TV.',
        requests:'Surprise. Cake drop at 8.', created_at:daysAgoISO(15) },
      { id:uid(), stage:'Booked', event_name:'Keller Saturday Buyout', event_type:'Buyout',
        contact_name:'Priya Keller', contact_phone:'512-555-0162', contact_email:'pkeller@example.com', source:'OpenTable/Resy',
        date_received:dateStr(9), event_date:dateStr(-21), event_time:'5:00 PM', party_size:90, space:'Full Buyout',
        fb_minimum:6000, per_head:0, quoted_total:6800, deposit_amount:1500,
        service_charge_pct:20, tax_pct:8.25,
        actual_revenue:0, event_food_cost:0, event_bar_cost:0, event_other_cost:0,
        guaranteed_count:90, count_due_date:dateStr(-16), day_contact_name:'Priya Keller', day_contact_phone:'512-555-0162',
        timeline:'4:00 load-in. 5:00 doors, passed apps and the bar open. 6:30 seated dinner. 9:30 last call. 10:30 out.',
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
      'Hennessy VS':'Cognac', 'Hennessy XO':'Cognac', 'Campari':'Amaro', 'Aperol':'Aperitif',
      'Macallan 18':'Scotch', 'Pappy Van Winkle 15':'Bourbon', 'Clase Azul Reposado':'Tequila',
      'Triple Sec':'Liqueur', 'Coffee Liqueur':'Liqueur', 'Maraschino Liqueur':'Liqueur',
      'St-Germain':'Liqueur', 'Cointreau':'Liqueur', 'Disaronno Amaretto':'Liqueur', 'Green Chartreuse':'Liqueur',
      // Wine
      'House Cabernet':'Red', 'Pinot Noir':'Red', 'Malbec':'Red', 'Red Blend':'Red', 'Cabernet Reserve':'Red',
      'House Chardonnay':'White', 'Sauvignon Blanc':'White', 'Pinot Grigio':'White', 'Chardonnay Reserve':'White',
      'Rosé':'Rosé', 'Prosecco':'Sparkling', 'Champagne':'Champagne', 'Dom Pérignon':'Champagne', 'Sweet Vermouth':'Vermouth', 'Dry Vermouth':'Vermouth',
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
      // ── Top-shelf bottles that overstocked and barely move: a few thousand in
      //    cash sitting on the shelf. They carry zero usage between counts, so they
      //    never touch the COGS or variance window, but they read as dead stock in
      //    Trapped Cash and as lazy capital in Capital Efficiency. The "trapped
      //    premium liquor" the cash story is built to surface. Indices 105+.
      { name:'Macallan 18',              category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:240.00, menu_price:38, par_level:2, reorder_point:1, primary_location:'Liquor Room' },
      { name:'Pappy Van Winkle 15',      category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:260.00, menu_price:45, par_level:1, reorder_point:1, primary_location:'Liquor Room' },
      { name:'Clase Azul Reposado',      category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:120.00, menu_price:28, par_level:2, reorder_point:1, primary_location:'Liquor Room' },
      { name:'Hennessy XO',              category:'Liquor', vendor:'Republic National', container_size_oz:25.4, pour_size_oz:1.5, unit_cost:190.00, menu_price:32, par_level:2, reorder_point:1, primary_location:'Liquor Room' },
      { name:'Dom Pérignon',             category:'Wine',   vendor:'Republic National', container_size_oz:25.4, pour_size_oz:2.0, unit_cost:185.00, menu_price:34, par_level:2, reorder_point:1, primary_location:'Walk-in Cooler', serving_sizes:[{ label:'Bottle', size_oz:25.4, price:220 }] },
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
    // Demo seed for the cost-creep alert: the two highest-volume margaritas both
    // pour Espolòn Tequila Blanco and carry a tight cost target, so they sit just
    // under it (Margarita ~16% vs 17%, Paloma ~15% vs 16%). A single tequila price
    // bump on a delivery then visibly tips both over — firing the Receive-Delivery
    // notice + the cockpit flag.
    if (rItem('House Margarita')) rItem('House Margarita').target_cost_pct = 17;
    if (rItem('Paloma'))          rItem('Paloma').target_cost_pct = 16;
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
      102:[18,48], 103:[2,6], 104:[22,60],
      // Idle top-shelf bottles (indices 105-109): FLAT levels so the on-hand is the
      // same at every recent count, which means zero usage, which reads as dead
      // stock in Trapped Cash without touching the COGS or variance window. A few
      // slow bottles each, about $2,400 total, a believable amount for a craft bar
      // to have over-bought and let sit, not a fake pile.
      105:[2,2], 106:[1,1], 107:[3,3], 108:[2,2], 109:[5,5]
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
    // must stay exactly as-is. Weekly counts begin in week 4 (~63 days back): the
    // operator spent the first weeks setting up before counting on a schedule, so
    // the early audit windows honestly show few counts. The older counts oscillate
    // around the well-stocked day-7 level so inventory reads flat across the
    // quarter, with a couple of busy-week draw-downs — the sawtooth a real bar
    // shows. Deterministic multipliers keep it reproducible.
    const icOlderCounters = ['Carlos P.', 'Maria G.', 'Jake T.'];
    const icOlderWeeks = [
      [21, 1.05], [28, 0.92], [35, 1.10], [42, 0.86], [49, 1.03],
      [56, 0.95], [63, 1.09]
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
    // uncollected credit the Profit Audit surfaces under Vendor Control) that has
    // sat 9 days since the request with no response, so it reads as Follow Up Due.
    // All recent, none aging past 60 days. Feeds Inventory Execution + the BCA.
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
        filed_at:daysAgoISO(11), credit_requested_at:daysAgoISO(9), resolved_at:null },
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

    // ── Registers (Phase 0.5) ──────────────────────────────────────────────
    if (!App.shiftData.settings) App.shiftData.settings = {};

    // Drawers reference table. Seeded with realistic registers so the
    // dropdowns on Cash Drop and Variance Log render with options out of
    // the box. Default opening bank pre-fills the Start a Shift bank field
    // when the matching drawer is the one tonight runs on. cash_tolerance is
    // per-register (how far it can be off before a reconcile flags); the busy
    // main bar runs wider than a slow service well.
    App.shiftData.sc_drawers = [
      { id: App.uid(), name: 'Main Bar Register',     location: 'Main Bar',       default_opening_bank: 300, cash_tolerance: 15, notes: '', active: true, created_at: new Date().toISOString() },
      { id: App.uid(), name: 'Service Bar Register',  location: 'Back Bar',       default_opening_bank: 200, cash_tolerance: 10, notes: 'Server-only well', active: true, created_at: new Date().toISOString() },
      { id: App.uid(), name: 'Floor Register 1',      location: 'Front of House', default_opening_bank: 250, cash_tolerance: 10, notes: '', active: true, created_at: new Date().toISOString() },
      { id: App.uid(), name: 'Floor Register 2',      location: 'Front of House', default_opening_bank: 250, cash_tolerance: 10, notes: '', active: true, created_at: new Date().toISOString() }
    ];
    const scDrawers = App.shiftData.sc_drawers;

    // sc_shifts are per-day records fed by the weekly POS sales import (one row
    // per calendar day). The seed builds the exact slim shape the cockpit's
    // PosIngest 'sales' lane writes, off the 13-week spine, so revenue and covers
    // reconcile. Cash, tips, and exceptions live in their own stores, not on the
    // shift record (no live-shift cruft).
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
        const date = dateStr(baseAgo + 6 - di);
        scShifts.push({
          id:uid(), date:date,
          bar_revenue:dayBar, floor_revenue:dayFloor,
          total_revenue:dayBar + dayFloor, covers:dayCov,
          shift_type:'Full Day', status:'Closed', imported:true,
          created_at:new Date().toISOString()
        });
        scDays.push({ date:date, manager:mgrs[di % 3] });
      });
    });
    // Current week, mid-close: the operator has run their end-of-week sales
    // import (one file, the whole week), so Shift's Close The Week shows the full
    // week's revenue with step 1 done. Live: a fresh week is zero until imported.
    const curWk = ANCHS.weeks.reduce((m, a) => (ANCHS.endAgo(a) < ANCHS.endAgo(m) ? a : m), ANCHS.weeks[0]);
    const curBaseAgo = sunOff - 7;   // days-ago of THIS week's Sunday (negative mid-week)
    if (curWk) for (let di = 0; di < 7; di++) {
      const w = dayW[di] || 0.12;
      const dBar = Math.round(curWk.bar_rev * w), dFloor = Math.round(curWk.food_rev * w);
      scShifts.push({
        id:uid(), date:dateStr(curBaseAgo + 6 - di), bar_revenue:dBar, floor_revenue:dFloor,
        total_revenue:dBar + dFloor, covers:Math.round(curWk.covers * w),
        shift_type:'Full Day', status:'Closed', imported:true, created_at:new Date().toISOString()
      });
    }
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
      // Print Only station checklists — printed blank for the clipboard, never run
      // in the app. Realistic Anchor bar-close and kitchen-open routines.
      { id:uid(), name:'Bar Close', type:'Print', created_at:new Date().toISOString(), items:[
        'Break down and wash all bar mats',
        'Empty, clean, and dry the speed wells',
        'Cap and date all open juices and syrups in the rail',
        'Wipe down bottles and restock the well',
        'Run the last rack of glassware',
        'Wipe down and sanitize the bar top and stations',
        'Empty the drains and run hot water through them',
        'Squeegee the floor mats behind the bar',
        'Lock the liquor room and the reach-in coolers',
        'Take out the bar trash and recycling',
      ] },
      { id:uid(), name:'Kitchen Open', type:'Print', created_at:new Date().toISOString(), items:[
        'Fire the line, flat top, and fryers and bring to temp',
        'Check the walk-in and reach-in temps and log them',
        'Pull and date the day\'s prep off the par sheet',
        'Stock the line: proteins, sauces, and garnishes',
        'Fill and label all squeeze bottles',
        'Check the fryer oil and filter it if needed',
        'Set up the dish pit and fill the sanitizer buckets',
        'Confirm every cooler is holding 40F or below',
        'Stock paper, gloves, and to-go containers',
        'Initial the temperature log',
      ] },
    ];
    const mkChkItems = (arr, doneN) => arr.map((text, idx) => ({ text:text, done:idx < doneN }));
    const scChecklists = [];
    // Adoption ramp: the operator sets up in the first two weeks, so checklists
    // start in week 2 (closing routine first), reach a routine by week 3, and
    // settle at a disciplined-but-not-perfect run rate (~75% opening, ~67%
    // closing). The recent 30-day window — what the live audit reads — lands on
    // those rates, so the live score and the seeded day-90 audit agree, while the
    // early audit windows honestly show sparse checklists. Deterministic skips.
    scDays.forEach((d, i) => {
      const mgr = d.manager;
      if (i < 12) return;                                  // weeks 1-1.5: onboarding, no checklists yet
      const inRoutine = i >= 21;                           // fully in the routine by week 3
      const openRun  = inRoutine ? (i % 4 !== 0) : (i % 3 === 0);   // ~75% in routine, sparse during ramp
      const closeRun = inRoutine ? (i % 3 !== 0) : (i % 2 === 0);   // ~67% in routine, partial during ramp
      const openDone  = (i % 9 === 0) ? scOpenItems.length  - 1 : scOpenItems.length;   // ~89% item completion
      const closeDone = (i % 7 === 0) ? scCloseItems.length - 1 : scCloseItems.length;  // ~86% item completion
      if (openRun) scChecklists.push({ id:uid(), type:'Opening', template_id:scOpenTplId, template_name:'Standard Open',
        date:d.date, completed_by:mgr, completed_by_id:'', items:mkChkItems(scOpenItems, openDone),
        done_count:openDone, total_count:scOpenItems.length, notes:'',
        completed_at:new Date().toISOString(), created_at:new Date().toISOString() });
      if (closeRun) scChecklists.push({ id:uid(), type:'Closing', template_id:scCloseTplId, template_name:'Standard Close',
        date:d.date, completed_by:mgr, completed_by_id:'', items:mkChkItems(scCloseItems, closeDone),
        done_count:closeDone, total_count:scCloseItems.length, notes:'',
        completed_at:new Date().toISOString(), created_at:new Date().toISOString() });
    });
    App.shiftData.sc_checklists = scChecklists;

    // Drawer reconciliations — EVERY register is counted at the close of EVERY
    // operating day (the over/short the weekly POS cash report carries), so one
    // record per register per day sharing the same date, not one rotating register.
    // Most land within tolerance; the loose early weeks run wider over/short and
    // tighten after the fixes. Cash counting is day-one discipline, no adoption ramp.
    const scVariances = [];
    const activeRegs = scDrawers.filter(d => d.active !== false);
    ANCHS.weeks.forEach(a => {
      const baseAgo = sunOff + ANCHS.endAgo(a);
      const improving = !a.loose;
      for (let di = 0; di < 7; di++) {
        const date = dateStr(baseAgo + 6 - di);
        activeRegs.forEach((dr, ri) => {
          const exp = 600 + Math.round(Math.random() * 350);
          const variance = improving
            ? Math.round((Math.random() - 0.55) * 12)
            : Math.round((Math.random() - 0.75) * 30);
          const tol = (dr.cash_tolerance != null) ? dr.cash_tolerance : 10;
          scVariances.push({
            id:uid(), date:date,
            drawer_id: dr.id, drawer: dr.name,
            cashier:mgrs[(a.wk + di + ri) % 3],
            source:'import',
            expected_cash:exp, counted_cash:exp + variance, variance:variance,
            tolerance:tol, status:Math.abs(variance) <= tol ? 'Within Tolerance' : variance < 0 ? 'Short' : 'Over',
            reason:'', notes:'', created_at:new Date().toISOString()
          });
        });
      }
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
          check_number:'', reason:s.reason, notes:'',
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
          created_at:new Date().toISOString()
        });
      }
    });
    App.shiftData.sc_void_comps = scVoidComps;

    // A cash drop at every close on operating days (skip Monday, the slowest), so
    // the drawer never holds too much cash — that is the discipline the Bar Cop
    // Audit reads on revenue days. Each drop mirrors an sc_safe_log "in" entry, and
    // a weekly bank deposit "out" clears most of it so the safe balance stays
    // realistic from load (the Phase 2 auto-mirror only fires for NEW drops; sample
    // drops seed both stores by hand).
    const scCashDrops = [];
    const scSafeLog = [];
    ANCHS.weeks.forEach(a => {
      const baseAgo = sunOff + ANCHS.endAgo(a);
      let weekDrops = 0;
      for (let di = 1; di < 7; di++) {           // Tue..Sun (skip Monday)
        const dropId = uid();
        const safeId = uid();
        const dropDate = dateStr(baseAgo + 6 - di);
        const dropAmount = 900 + Math.round(Math.random() * 500);
        weekDrops += dropAmount;
        const performed = mgrs[(a.wk + di) % 3];
        const witness   = mgrs[(a.wk + di + 1) % 3];
        const dr = scDrawers[di % scDrawers.length];
        scCashDrops.push({
          id:dropId, date:dropDate, drop_time:'23:30',
          drawer_id: dr.id, drawer: dr.name,
          performed_by:performed, witness:witness,
          amount:dropAmount, denominations:{}, notes:'',
          safe_log_id: safeId,
          created_at:new Date().toISOString()
        });
        scSafeLog.push({
          id:safeId, date:dropDate, time:'23:30',
          txn_type:'Cash Drop', direction:'in', amount:dropAmount,
          reference:'Drawer: ' + dr.name,
          performed_by:performed, witness:witness, notes:'',
          source:'cash-drop', source_id:dropId,
          created_at:new Date().toISOString()
        });
      }
      // Weekly bank deposit clears ~90% of the week's drops out of the safe.
      scSafeLog.push({
        id:uid(), date:dateStr(baseAgo), time:'09:15',
        txn_type:'Bank Deposit', direction:'out', amount:Math.round(weekDrops * 0.9),
        reference:'Weekly deposit run', performed_by:mgrs[a.wk % 3], witness:'', notes:'',
        source:'safe-log', created_at:new Date().toISOString()
      });
    });
    App.shiftData.sc_cash_drops = scCashDrops;
    App.shiftData.sc_safe_log = scSafeLog;

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
    // Fixes are logged across the 90 days as the operator worked each gap, not all
    // at once: pour cost first (week 2), the rest of the cost leaks through month 1,
    // and the slower digital gaps still being worked in the last month. The recovery
    // engine then treats the first weeks as the baseline (a loose start) and the
    // improving arc that follows shows up as real, maturing recovered dollars,
    // exactly as a live user's would. No backdated "fix landed here" fantasy.
    const fxAt = (n) => ({ date: dateStr(n), logged_at: daysAgoISO(n) });
    App.data.fix_log = (App.data.fix_log || [])
      .filter(e => e.module !== 'profit' && e.module !== 'revenue')
      .concat([
      { id:uid(), module:'profit', gap_id:'pour-cost',  gap_name:'Pour Cost',           ...fxAt(78) },
      { id:uid(), module:'profit', gap_id:'theft-loss', gap_name:'Theft and Loss',      ...fxAt(74) },
      { id:uid(), module:'profit', gap_id:'food-cost',  gap_name:'Food Cost',           ...fxAt(70) },
      { id:uid(), module:'profit', gap_id:'prime-cost', gap_name:'Prime Cost',          ...fxAt(56) },
      { id:uid(), module:'revenue', gap_id:'check-average',    gap_name:'Check Average and Upsell',  ...fxAt(64) },
      { id:uid(), module:'revenue', gap_id:'labor-scheduling', gap_name:'Labor Cost and Scheduling', ...fxAt(50) },
      { id:uid(), module:'revenue', gap_id:'rplh',            gap_name:'Labor Productivity (RPLH)',  ...fxAt(18) },
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

    // Sales Integrity — four weekend server-sales reports run through the live
    // engine so the demo lands on a real review with a history below it. The
    // planted bad actor is Brianna K. (the same server the comp pattern
    // concentrates on); her numbers escalate over the last two weekends, caught
    // building: two clean weekends, then a cash-mix Watch, then a High (heavy
    // no-sales, a high void rate, refunds). On the current weekend a second
    // server, Marcus T., also flags (Watch, under-ringing) on heavy comps and a
    // run of low-dollar checks well off the floor, so the current review shows
    // two flagged. The rest track the floor. True by construction (same
    // analyze() the upload uses), so re-running yields the same flags.
    if (window.S && S.SalesIntegrity) {
      const siRows = (date, s) => [
        { server:'Jessica M.', date, net_sales:2050, checks:41, cash_sales:380, card_sales:1670, voids:25, void_count:2, comps:24, no_sales:1, refunds:0, hours:8   },
        s.bad2
          ? Object.assign({ server:'Marcus T.', date, checks:62, hours:8 }, s.bad2)
          : { server:'Marcus T.', date, net_sales:1820, checks:36, cash_sales:365, card_sales:1455, voids:20, void_count:2, comps:18, no_sales:0, refunds:0, hours:7.5 },
        { server:'Priya N.',   date, net_sales:1680, checks:34, cash_sales:300, card_sales:1380, voids:24, void_count:2, comps:22, no_sales:2, refunds:0, hours:7.5 },
        { server:'Devin R.',   date, net_sales:1540, checks:31, cash_sales:340, card_sales:1200, voids:17, void_count:1, comps:16, no_sales:1, refunds:0, hours:7   },
        { server:'Carlos P.',  date, net_sales:1960, checks:39, cash_sales:410, card_sales:1550, voids:26, void_count:3, comps:20, no_sales:1, refunds:0, hours:8   },
        Object.assign({ server:'Brianna K.', date, checks:30, comps:20, hours:8 }, s.bad)
      ];
      const siShifts = [
        { ago:2,  bad:{ net_sales:1500, cash_sales:705, card_sales:795,  voids:90, void_count:7, no_sales:9, refunds:40 },
                  bad2:{ net_sales:1480, cash_sales:330, card_sales:1170, voids:18, void_count:1, comps:185, no_sales:1, refunds:0 } }, // High + Watch
        { ago:9,  bad:{ net_sales:1620, cash_sales:680, card_sales:940,  voids:24, void_count:2, no_sales:2, refunds:0  } }, // Watch (cash mix)
        { ago:16, bad:{ net_sales:1700, cash_sales:360, card_sales:1340, voids:22, void_count:2, no_sales:1, refunds:0  } }, // clean
        { ago:23, bad:{ net_sales:1580, cash_sales:330, card_sales:1250, voids:20, void_count:2, no_sales:1, refunds:0  } }  // clean
      ];
      App.data.sales_reviews = siShifts.map(s => {
        const d = dateStr(s.ago);
        return S.SalesIntegrity.analyze(siRows(d, s), { id:uid(), date:d, created_at:new Date(d + 'T20:00:00').toISOString(), source:'sample' });
      });
    } else {
      App.data.sales_reviews = [];
    }

    // ════════════════════════════════════════════════════════════════════
    //  LABOR CONTROL — derived from the Anchor profile. Each week's logged
    //  hours by department reconcile to ANCHOR bar_labor and food_labor.
    // ════════════════════════════════════════════════════════════════════
    App.laborData = App.laborData || {};
    const ANCHL = window.ANCHOR;

    // Tipped roles: earners (Server, Bartender) tip out a percent of their sales;
    // support (Barback, Busser) pay 0 and only receive. tip_out_pct drives the Tip
    // Log's earner/receives split + the tip-out reconciliation.
    const lcPositions = [
      { name:'Bartender', department:'Bar',            default_wage:ANCHL.wages.bar,     tipped:true,  tip_out_pct:2 },
      { name:'Barback',   department:'Bar',            default_wage:12,                  tipped:true,  tip_out_pct:0 },
      { name:'Line Cook', department:'Kitchen',        default_wage:ANCHL.wages.kitchen, tipped:false },
      { name:'Prep Cook', department:'Kitchen',        default_wage:13.5,                tipped:false },
      { name:'Server',    department:'Front of House', default_wage:ANCHL.wages.floor,   tipped:true,  tip_out_pct:3 },
      { name:'Busser',    department:'Front of House', default_wage:11,                  tipped:true,  tip_out_pct:0 },
      { name:'Host',      department:'Front of House', default_wage:12.5,                tipped:false },
      { name:'Manager',   department:'Management',     default_wage:28,                  tipped:false },
      { name:'Assistant Manager', department:'Management', default_wage:24,               tipped:false },
    ].map(p => ({ id:uid(), created_at:new Date().toISOString(), ...p }));
    App.laborData.lc_positions = lcPositions;
    const lcPos = n => lcPositions.find(p => p.name === n).id;

    // State minimum wage — Texas (matches the federal $7.25). Set in App Settings
    // under Business Profile (Taxes, Payroll & Wage). Drives the tip-credit check
    // on Pay Periods and the Bar Cop Audit's wage-policy component (which reads as
    // "not configured" until this is set).
    if (!App.laborData.settings) App.laborData.settings = {};
    App.laborData.settings.state_min_wage = 7.25;

    // Phase 0: wage_history captures every wage change so historical labor
    // cost reads correctly off the wage in effect on the entry date, not the
    // current wage. Empty on fresh hires (their current wage is the starting wage).
    const mkStaff = (name, posName, wage, hiredDaysAgo) => ({
      id:uid(), name:name, position_id:lcPos(posName), pay_type:'Hourly', wage:wage, annual_salary:null,
      status:'Active', hire_date:dateStr(hiredDaysAgo), phone:'', email:'',
      wage_history:[], off_days:[], created_at:new Date().toISOString()
    });
    // Salaried (exempt): fixed annual salary, no hourly wage and no overtime.
    const mkSalaried = (name, posName, annual, hiredDaysAgo) => ({
      id:uid(), name:name, position_id:lcPos(posName), pay_type:'Salary', wage:null, annual_salary:annual,
      status:'Active', hire_date:dateStr(hiredDaysAgo), phone:'', email:'',
      wage_history:[], off_days:[], created_at:new Date().toISOString()
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
      mkStaff('Tara W.',    'Busser',    11,   90),
      mkStaff('Diego S.',   'Busser',    11,   55),
      mkSalaried('Carlos P.', 'Manager',           68000, 520),
      mkSalaried('Renee K.',  'Assistant Manager', 52000, 300),
    ];
    App.laborData.lc_staff = lcStaff;
    // Recurring days off for a few staff (feeds Build Schedule's day-off block).
    // Recurring days off, set on days each person is not already scheduled in the
    // seed (so the loaded current-week schedule shows no false day-off conflicts).
    const setOff = (nm, days) => { const st = lcStaff.find(s => s.name === nm); if (st) st.off_days = days; };
    setOff('Priya N.', ['Mon', 'Tue']);
    setOff('Owen L.',  ['Tue']);
    setOff('Ashley B.', ['Wed']);

    // Time off, all in NEXT week (no schedule posted there yet) so the demo shows
    // no conflicts on load; the warning fires when the operator builds next week.
    // An approved vacation, a pending request (surfaces on the cockpit), one more.
    const lcId = nm => (lcStaff.find(s => s.name === nm) || {}).id || '';
    App.laborData.lc_time_off = [
      { id:uid(), staff_id:lcId('Maria G.'),   name:'Maria G.',   start_date:dateStr(-9), end_date:dateStr(-12), type:'Vacation',     status:'Approved',  notes:'Out of town.',  created_at:new Date().toISOString() },
      { id:uid(), staff_id:lcId('Jake T.'),    name:'Jake T.',    start_date:dateStr(-10), end_date:dateStr(-10), type:'Requested Off', status:'Requested', notes:'Family event.', created_at:new Date().toISOString() },
      { id:uid(), staff_id:lcId('Marcus T.'),  name:'Marcus T.',  start_date:dateStr(-11), end_date:dateStr(-11), type:'Personal',     status:'Approved',  notes:'',              created_at:new Date().toISOString() }
    ];

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

    // Incident Log — the kind of thing a real bar documents for protection: a
    // dram-shop cut-off, a guest slip, an ejected fight, an open property-damage
    // case still being chased. A mix of Resolved and one Open across the window.
    // Reported By + Confirmed By point at real roster staff so the pickers match.
    const _incStaff = (App.laborData && App.laborData.lc_staff) || [];
    const _incMgr = _incStaff.find(s => App.isSupervisor && App.isSupervisor(s)) || _incStaff[0] || {};
    const _incSvc = _incStaff.filter(s => !(App.isSupervisor && App.isSupervisor(s)));
    const _incRep = i => _incSvc[i % Math.max(1, _incSvc.length)] || _incStaff[0] || {};
    App.shiftData.sc_incidents = [
      { id:uid(), date:dateStr(4), time:'02:30', type:'Property Damage', severity:'High', status:'Open',
        location:'Front entrance', reported_by_id:_incRep(0).id||'', reported_by:_incRep(0).name||'',
        confirmed_by_id:_incMgr.id||'', confirmed_by:_incMgr.name||'',
        people_involved:'Unknown, after close', witnesses:'',
        description:'Front glass door found cracked at open. Possible attempted break-in overnight; nothing taken, register and safe untouched.',
        action_taken:'Filed a police report, called a glazier for a quote, notified insurance. Awaiting repair.',
        date_resolved:'', cost:450, created_at:new Date().toISOString() },
      { id:uid(), date:dateStr(9), time:'23:15', type:'Refused / Cut Off Service', severity:'High', status:'Resolved',
        location:'Main Bar', reported_by_id:_incRep(1).id||'', reported_by:_incRep(1).name||'',
        confirmed_by_id:_incMgr.id||'', confirmed_by:_incMgr.name||'',
        people_involved:'Male guest, 40s, tab 142', witnesses:'On-duty bartender',
        description:'Guest visibly intoxicated and slurring, asked for another round. Cut off per house policy.',
        action_taken:'Refused further service, comped a water and an app, arranged a rideshare home. Guest left without incident.',
        date_resolved:dateStr(9), cost:null, created_at:new Date().toISOString() },
      { id:uid(), date:dateStr(16), time:'19:40', type:'Injury', severity:'Medium', status:'Resolved',
        location:'Near host stand', reported_by_id:_incRep(2).id||'', reported_by:_incRep(2).name||'',
        confirmed_by_id:_incMgr.id||'', confirmed_by:_incMgr.name||'',
        people_involved:'Female guest, party of 4', witnesses:'Host on duty',
        description:'Guest slipped on water tracked in from the patio door. Caught herself on a chair, no fall to the floor.',
        action_taken:'Offered first aid, guest declined. Dried the area and set out a wet-floor sign. Manager checked on her twice; she was fine.',
        date_resolved:dateStr(16), cost:null, created_at:new Date().toISOString() },
      { id:uid(), date:dateStr(27), time:'00:20', type:'Altercation / Fight', severity:'Medium', status:'Resolved',
        location:'Patio', reported_by_id:_incRep(3).id||'', reported_by:_incRep(3).name||'',
        confirmed_by_id:_incMgr.id||'', confirmed_by:_incMgr.name||'',
        people_involved:'Two male guests', witnesses:'Two servers',
        description:'Verbal argument between two guests escalated to shoving. No punches landed.',
        action_taken:'Separated both parties, ejected the instigator, walked the other to a rideshare. No police called.',
        date_resolved:dateStr(27), cost:null, created_at:new Date().toISOString() }
    ];

    // Phase 4: patch staff_id + shift_id onto every revenue_server_checks
    // record so the Server Scorecard joins cleanly to lc_staff and sc_shifts.
    (App.data.revenue_server_checks || []).forEach(c => {
      if (!c.staff_id && c.server_name) {
        const match = lcStaff.find(s => s.name === c.server_name);
        if (match) c.staff_id = match.id;
      }
      if (!c.shift_id && c.date) {
        const matchShift = scShifts.find(s => s.date === c.date);
        if (matchShift) c.shift_id = matchShift.id;
      }
    });

    const lcByPos = (...names) => {
      const ids = names.map(lcPos);
      return lcStaff.filter(st => ids.includes(st.position_id));
    };
    const lcBar     = lcByPos('Bartender', 'Barback');
    const lcKitchen = lcByPos('Line Cook', 'Prep Cook');
    const lcFloor   = lcByPos('Server', 'Host', 'Busser');

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
      lcAllocate(lcFloor,   [0.20, 0.18, 0.17, 0.16, 0.13, 0.08, 0.08], a.food_labor * 0.5, baseAgo, ['Brunch', 'Lunch', 'Dinner', 'Dinner', 'Lunch']);
    });
    // Current week, mid-close: the operator has imported this week's hours, so
    // Labor's Close The Week shows the full week with step 1 done. Live: zero
    // until imported. Latest week's labor through the same allocator.
    const curL = ANCHL.weeks.reduce((m, a) => (ANCHS.endAgo(a) < ANCHS.endAgo(m) ? a : m), ANCHL.weeks[0]);
    const curLBase = sunOff - 7;
    if (curL) {
      lcAllocate(lcBar,     [0.30, 0.27, 0.24, 0.19],       curL.bar_labor,        curLBase, ['Dinner', 'Late Night', 'Dinner', 'Brunch', 'Late Night']);
      lcAllocate(lcKitchen, [0.30, 0.27, 0.24, 0.19],       curL.food_labor * 0.5, curLBase, ['Lunch', 'Dinner', 'Dinner', 'Brunch', 'Lunch']);
      lcAllocate(lcFloor,   [0.20, 0.18, 0.17, 0.16, 0.13, 0.08, 0.08], curL.food_labor * 0.5, curLBase, ['Brunch', 'Lunch', 'Dinner', 'Dinner', 'Lunch']);
    }
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
      'Busser':    [
        { days:['Thu','Fri','Sat','Sun'],       start:'17:00', end:'23:00', hours:6 },   // dinner / late floor support
        { days:['Sat','Sun'],                   start:'10:00', end:'15:00', hours:5 },   // weekend brunch support
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

    // Offsite catering crew — tag a small crew to the Completed offsite booking on
    // its event date so the Events line on Profit > This Week shows real event
    // labor (otherwise the demo's catering job reads $0 labor). Their floor actual
    // that day is replaced by an event "logged" actual: bookingLabor reads it as
    // the Event P&L labor, and This Week excludes it from bar/food (no double count).
    (() => {
      const offBk = (App.data.bookings || []).find(b => b.event_type === 'Catering (Offsite)' && b.stage === 'Completed');
      if (!offBk || !offBk.event_date) return;
      const iso = String(offBk.event_date).slice(0, 10);
      const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const ed = new Date(iso + 'T00:00:00');
      if (isNaN(ed.getTime())) return;
      const wd = ed.getDay();
      const dayName = DAYS[(wd + 6) % 7];
      const monD = new Date(ed); monD.setDate(monD.getDate() + (wd === 0 ? -6 : 1 - wd));
      const sched = App.laborData.lc_schedules.find(s => s.week_start === App.ymdLocal(monD));
      if (!sched) return;
      const cook = lcStaff.find(st => posNameOf(st.position_id) === 'Line Cook')
                || lcStaff.find(st => posNameOf(st.position_id) === 'Prep Cook');
      const server = lcStaff.find(st => posNameOf(st.position_id) === 'Server');
      const crew = [];
      if (cook)   crew.push({ st: cook,   start: '08:00', end: '14:00', hours: 6 });
      if (server) crew.push({ st: server, start: '09:30', end: '14:00', hours: 4.5 });
      crew.forEach(c => {
        const cost = +(c.hours * c.st.wage).toFixed(2);
        sched.shifts.push({ staff_id: c.st.id, name: c.st.name, position_id: c.st.position_id, day: dayName,
          start: c.start, end: c.end, hours: c.hours, wage: c.st.wage, cost: cost, event: offBk.id });
        // Replace any floor actual for this person that day with the event's logged actual.
        App.laborData.lc_actuals = App.laborData.lc_actuals.filter(a => !(a.staff_id === c.st.id && String(a.date || '').slice(0, 10) === iso));
        App.laborData.lc_actuals.push({ id: uid(), date: iso, staff_id: c.st.id, name: c.st.name,
          position_id: c.st.position_id, shift_type: 'Lunch', hours: c.hours, wage: c.st.wage, cost: cost, notes: 'Offsite catering' });
      });
      sched.total_hours = +sched.shifts.reduce((s, x) => s + (x.hours || 0), 0).toFixed(1);
      sched.total_cost  = +sched.shifts.reduce((s, x) => s + (x.cost || 0), 0).toFixed(2);
      if (sched.revenue_forecast) {
        sched.labor_pct = +(sched.total_cost / sched.revenue_forecast * 100).toFixed(2);
        sched.rplh = +(sched.revenue_forecast / sched.total_hours).toFixed(2);
      }
    })();

    // ── Tips — recent shifts for every tipped staff member ──
    // Every tip carries a synthetic shift_id = App.tipShiftKey(date, service period),
    // not an sc_shifts link. Books Form 8027 per-employee allocations and the Server
    // Scorecard tips % both group through that same key.
    // Tip-out percentages MUST match the position config above (Server 3%,
    // Bartender 2%; Barback + Busser pay 0 and only receive). Earners log sales +
    // tip_out_paid; the collected pool splits across the support crew by hours so
    // Collected == Distributed (the last support row absorbs the rounding remainder).
    const TIPOUT_PCT = { 'Server': 3, 'Bartender': 2 };
    const lcTipped = lcStaff.filter(st => ['Bartender','Barback','Server','Busser'].includes(posNameOf(st.position_id)));
    const isEarnerRole = r => r === 'Server' || r === 'Bartender';
    const lcTips = [];
    [3, 5, 8, 11, 14, 18, 22, 27, 33, 40, 47, 54, 61, 68, 75].forEach(d => {
      const tipDate = dateStr(d);
      const shiftId = App.tipShiftKey(tipDate, '');   // per-day key (the Tip Log logs per day now)
      const built = lcTipped.map(st => {
        const role = posNameOf(st.position_id);
        const earner = isEarnerRole(role);
        const base = role === 'Bartender' ? 135 : 100;
        const cash = earner ? Math.round(base * (0.30 + Math.random() * 0.22)) : 0;
        const card = earner ? Math.round(base * (0.92 + Math.random() * 0.40)) : 0;
        const sales = earner ? Math.round((role === 'Bartender' ? 1450 : 1150) + Math.random() * 450) : 0;
        const paid = earner ? Math.round(sales * (TIPOUT_PCT[role] || 0) / 100 * 100) / 100 : 0;
        return { st, role, earner, cash, card, sales, paid, received:0, hours: role === 'Server' ? 5 : 7 };
      });
      const collected = +built.reduce((s, r) => s + r.paid, 0).toFixed(2);
      const sup = built.filter(r => !r.earner);
      const totSupH = sup.reduce((s, r) => s + r.hours, 0) || 1;
      let handed = 0;
      sup.forEach((r, i) => {
        r.received = (i === sup.length - 1) ? +(collected - handed).toFixed(2)
                                            : Math.round(collected * (r.hours / totSupH) * 100) / 100;
        handed += r.received;
      });
      built.forEach(r => {
        lcTips.push({ id:uid(), date:tipDate, shift_id:shiftId, staff_id:r.st.id, name:r.st.name,
          position_id:r.st.position_id, shift_type:'',
          cash_tips:r.cash, card_tips:r.card, total_tips:r.cash + r.card,
          sales:r.sales, tip_out_paid:r.paid, tip_out_received:r.received,
          hours:r.hours, notes:'', created_at:daysAgoISO(d) });
      });
    });
    App.laborData.lc_tips = lcTips;

    // ── Tip pools — three recent close-outs, split by hours, linked to shifts.
    // Phase 3: shift_id ties each pool to the closing shift so Books Form 8027
    // pulls per-employee taxable allocations from the pool split (not the raw
    // tip log), and Tip History can group by shift.
    const mkPool = (d, amount) => {
      const poolDate = dateStr(d);
      const parts = lcTipped.map(st => ({ staff_id:st.id, name:st.name,
        hours:posNameOf(st.position_id) === 'Server' ? 5 : 7 }));
      const totH = parts.reduce((s, p) => s + p.hours, 0);
      parts.forEach(p => p.share = +(amount * p.hours / totH).toFixed(2));
      return { id:uid(),
        shift_id:    App.tipShiftKey(poolDate, ''),
        date:        poolDate,
        shift_type:  '',
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

    // ── Training — reusable onboarding templates + per-person records. Two
    // templates the Anchor runs, then a few staff records: tenured staff signed
    // off and complete, recent hires still working through theirs. Records carry
    // their own copy of the steps so editing a template never rewrites history.
    const TR_BAR_ITEMS = [
      'Review the employee handbook and sign the acknowledgment',
      'TABC alcohol certification on file',
      'Shadow two closing shifts with a senior bartender',
      'Pass the well-pour and signature cocktail test',
      'POS walkthrough: open a tab, transfer, comp, and void',
      'Walk the cash drawer count and tip-out procedure',
      'Review the draft line and keg-change procedure',
    ];
    const TR_SRV_ITEMS = [
      'Review the employee handbook and sign the acknowledgment',
      'Food handler certification on file',
      'Shadow two dinner shifts with a senior server',
      'Pass the menu, wine, and allergen test',
      'POS walkthrough: fire a course, split a check, comp, and void',
      'Review steps of service and the table-touch standard',
      'Walk the closing side-work checklist',
    ];
    const trBarTplId = uid(), trSrvTplId = uid();
    App.laborData.lc_training_templates = [
      { id:trBarTplId, name:'Bartender Onboarding', position_id:lcPos('Bartender'), items:TR_BAR_ITEMS.slice(), created_at:daysAgoISO(330) },
      { id:trSrvTplId, name:'Server Onboarding',    position_id:lcPos('Server'),    items:TR_SRV_ITEMS.slice(), created_at:daysAgoISO(330) },
    ];
    // doneCount steps checked off; done items dated near the createdDaysAgo mark.
    const trItems = (src, doneCount, doneDaysAgo) => src.map((text, i) =>
      ({ text, done: i < doneCount, done_date: i < doneCount ? dateStr(doneDaysAgo) : '' }));
    const trainRec = (nm, tplId, tplName, items, signerName, createdDaysAgo, completedDaysAgo) => {
      const st = stByName(nm); if (!st) return null;
      const allDone = items.length > 0 && items.every(it => it.done);
      const signer = signerName ? stByName(signerName) : null;
      return { id:uid(), staff_id:st.id, name:tplName, template_id:tplId, start_date:dateStr(createdDaysAgo), items:items,
        signed_off_by_id: allDone && signer ? signer.id : '',
        signed_off_by:    allDone && signer ? signer.name : '',
        completed_date:   allDone ? dateStr(completedDaysAgo) : '',
        notes:'', created_at:daysAgoISO(createdDaysAgo), updated_at:new Date().toISOString() };
    };
    App.laborData.lc_training = [
      trainRec('Maria G.',   trBarTplId, 'Bartender Onboarding', trItems(TR_BAR_ITEMS, 7, 300), 'Carlos P.', 315, 300),
      trainRec('Jessica M.', trSrvTplId, 'Server Onboarding',    trItems(TR_SRV_ITEMS, 7, 340), 'Carlos P.', 355, 340),
      trainRec('Priya N.',   trSrvTplId, 'Server Onboarding',    trItems(TR_SRV_ITEMS, 4, 95),  '',          105, 0),
      trainRec('Ashley B.',  trBarTplId, 'Bartender Onboarding', trItems(TR_BAR_ITEMS, 3, 140), '',          145, 0),
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

    // ── Variance Report demo data (engine-true off the seeded counts) ─────────
    // Reads each period's theoretical category sales / per-product pours straight
    // from the counts, then posts "actual" POS sales a realistic notch under it
    // (normal over-pour, spill, shrink). Feeds the Quick Variance Check (manual
    // category actuals, last 4 periods) and two saved deep-dive runs (the POS
    // upload path), so both variance entry points open with believable numbers.
    (() => {
      const VR = S.InventoryVarianceReport;
      if (!VR || !VR.categoryTheoretical) return;
      const savedEnd = VR.endCountId, savedRows = VR.posRows, savedMap = VR.manualMap;
      const asc = [...(App.inventoryData.ic_counts || [])].sort((a, b) =>
        new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
      const ends = asc.slice(1);   // each count that closes a period
      // Theoretical is the ceiling; actual rings a realistic notch lower, with a
      // small period-to-period wobble so the trend never reads mechanically flat.
      const lossFor = (cat, i) => {
        const base = { 'Liquor': 0.035, 'Wine': 0.026, 'Bottle Beer': 0.012, 'Draft Beer': 0.072 }[cat];
        return Math.max(0.004, (base != null ? base : 0.03) + ((i % 3) - 1) * 0.006);
      };

      // 1) Quick Variance Check — category actuals for the last 4 periods.
      App.inventoryData.variance_category_sales = App.inventoryData.variance_category_sales || {};
      ends.slice(-4).forEach((endC, i) => {
        VR.endCountId = endC.id;
        const theoMap = VR.categoryTheoretical();
        const store = {};
        Object.keys(theoMap).forEach(cat => {
          if (!theoMap[cat] || !theoMap[cat].theo) return;
          store[cat] = +(theoMap[cat].theo * (1 - lossFor(cat, i))).toFixed(2);
        });
        if (Object.keys(store).length) App.inventoryData.variance_category_sales[endC.id] = store;
      });

      // 2) Deep-dive saved runs — last two periods, POS rows built from the
      //    period's poured usage so Sales / Usage Variance reconcile.
      App.inventoryData.ic_variance_runs = App.inventoryData.ic_variance_runs || [];
      ends.slice(-2).forEach((endC, k) => {
        const startC = asc[asc.indexOf(endC) - 1];
        if (!startC) return;
        const periodIdx = ends.length - 2 + k;
        VR.endCountId = endC.id;
        const usage = VR.usageMap();
        const posRows = [];
        Object.keys(usage).forEach(pid => {
          const u = usage[pid], p = u.product || {};
          if (u.poursMade == null || u.poursMade <= 0 || !p.menu_price) return;
          const qty = Math.round(u.poursMade * (1 - lossFor(p.category, periodIdx)));
          if (qty > 0) posRows.push({ name: p.name, qty, sales: +(qty * p.menu_price).toFixed(2) });
        });
        if (!posRows.length) return;
        VR.posRows = posRows; VR.manualMap = {};
        const totalVar = VR.salesRows().reduce((s, r) =>
          s + ((!r.mixedSizes && r.salesVar != null) ? r.salesVar : 0), 0);
        App.inventoryData.ic_variance_runs.push({
          id: uid(), date: endC.date, start_date: startC.date, end_date: endC.date,
          start_count_id: startC.id, end_count_id: endC.id, pos_rows: posRows,
          total_sales_variance: +totalVar.toFixed(2), item_count: posRows.length,
          run_at: endC.created_at || daysAgoISO(0)
        });
      });

      VR.endCountId = savedEnd; VR.posRows = savedRows; VR.manualMap = savedMap;
    })();

    // ── Save everything — App.data plus all three Control stores ──
    await App.save();
    await App.saveInventory();           // config only (products, locations, vendors, batches, par/variance settings)
    await App.seedEventStores('ic');     // inventory event logs -> ic_events rows
    await App.saveLabor();               // config only (staff, positions, schedule templates, certs, notes)
    await App.seedEventStores('lc');     // labor event logs -> lc_events rows
    await App.saveShift();               // config only (settings, drawers, checklist templates)
    await App.seedEventStores('sc');     // shift event logs -> sc_events rows

    // ── Bar Cop Audit — the Hub executive audit across the first 90 days ───────
    // Three monthly snapshots on the cadence: the first runs at day 30 (the engine
    // needs 30 days of logged data), then day 60 and day 90. The day-30 audit has
    // only a few weeks of history, so two sub-scores that need a longer trend
    // (Recovery Action, Operational Consistency) read N/A and fill in by day 60.
    // Overall climbs 48 -> 60 -> 71, the day-90 read matching what the live engine
    // computes on the current seed. Hand-authored sample narrative by necessity
    // (the live engine only scores the current 30-day window, so it cannot
    // reproduce a record dated weeks back); each record is internally consistent:
    // the component detail rolls up to its sub-score, and the covered sub-scores
    // average to the overall. The live engine in hub-bar-cop-audit.js stays honest
    // for any real operation; this is demo only.
    const BCA_LABELS = ['Operational Discipline','Cash Integrity','Inventory Execution','Labor Hygiene','Recovery Action','Operational Consistency'];
    const BCA_KEYS   = ['operational_discipline','cash_integrity','inventory_execution','labor_hygiene','recovery_action','operational_consistency'];
    const d  = (label, extra, pct) => ({ label, extra, pct });           // component row; pct null = N/A
    const bcaRec = (daysAgo, auditId, subs, detail, exposures, patterns, snap) => {
      const sections = {}, sub_scores = {}, sub_score_detail = {};
      BCA_LABELS.forEach((l, i) => { sections[l] = subs[i]; });
      BCA_KEYS.forEach((k, i) => { sub_scores[k] = subs[i]; sub_score_detail[k] = detail[i]; });
      const covered = subs.filter(x => x != null);
      const overall = covered.length ? Math.round(covered.reduce((s, x) => s + x, 0) / covered.length) : null;
      return {
        id: uid(), date: dateStr(daysAgo), audit_id: auditId, audit_period: 'Last 30 days',
        grade: 'Complete Operational Analysis', bar_name: 'The Anchor Bar & Kitchen',
        overall_score: overall, TARGET_SCORE: 70, sub_scores_covered: covered.length,
        sub_scores, sub_score_detail, exposures, patterns,
        recovery_snapshot: snap, sections,
        action_items: exposures.map(e => ({ action: e.label + '. ' + e.detail, gap_id: e.gap_id || null, monthly_impact: 0 }))
      };
    };
    // ════════════════════════════════════════════════════════════════════
    //  CASH RECOVERY — the Anchor's first-quarter cash-recovery arc. Four
    //  milestone audits plus weekly fills trace cash health climbing as trapped
    //  stock is freed, the cash cycle tightens, and vendors move onto terms.
    //  The current (day-0) audit is regenerated by the LIVE CashEngine on the
    //  seeded data, so it matches the Cash screens exactly and behaves like a
    //  real user's. The older milestones are hand-authored frozen history.
    // ════════════════════════════════════════════════════════════════════
    const mkCashAudit = (date, generated_at, audit_id, period, raw) => {
      const N = (window.S && S.CashAudit) ? S.CashAudit.SECTION_NAMES
              : ['Capital Efficiency', 'Cash Conversion Cycle', 'Liquidity & Runway', 'Payment Terms'];
      const sections = {};
      [raw.S1_SCORE, raw.S2_SCORE, raw.S3_SCORE, raw.S4_SCORE].forEach((v, i) => { if (v != null) sections[N[i]] = v; });
      const cur = v => App.fmtCurrency(v);
      const items = [];
      if (raw.TRAPPED_CASH > 0) items.push({ action: 'Free ' + cur(raw.TRAPPED_CASH) + ' of lazy shelf cash: ' + cur(raw.DEAD_STOCK) + ' in dead stock, ' + cur(raw.OVERSTOCK) + ' above par.', gap_id: 'free-trapped' });
      if (raw.CYCLE_DAYS > 7) items.push({ action: 'Your cash is locked about ' + Math.round(raw.CYCLE_DAYS) + ' days. Order to par to free roughly ' + cur(raw.DAILY_COGS) + ' for each day you shorten it.', gap_id: 'order-to-par' });
      if (raw.TIGHT_WEEKS > 0) items.push({ action: raw.TIGHT_WEEKS + ' tight week' + (raw.TIGHT_WEEKS === 1 ? '' : 's') + ' in the next thirteen. Move a payment or hold an order to cover it.', gap_id: 'stay-ahead' });
      if (raw.TOTAL_VENDORS && raw.VENDORS_ON_TERMS < raw.TOTAL_VENDORS) items.push({ action: 'Set payment terms on the ' + (raw.TOTAL_VENDORS - raw.VENDORS_ON_TERMS) + ' vendor' + ((raw.TOTAL_VENDORS - raw.VENDORS_ON_TERMS) === 1 ? '' : 's') + ' without them, so you stop paying early.', gap_id: 'pay-on-terms' });
      return {
        id: uid(), date: date, bar_name: 'The Anchor Bar & Kitchen',
        overall_score: raw.OVERALL_SCORE, grade: '', audit_period: period, audit_id: audit_id,
        sections: sections, action_items: items, cash_to_free: raw.TRAPPED_CASH || 0,
        raw: raw, signals: [], generated_at: generated_at
      };
    };
    const cashRaw = (o) => Object.assign({
      BAR_NAME: 'The Anchor Bar & Kitchen', HAS_OPENING: true, OPENING_CASH: 45000,
      INVENTORY_VALUE: 38000, BLENDED_TURNS: 7.0, DAILY_COGS: 250, WEIGHTED_DPO: 18,
      TOTAL_VENDORS: 6, LOW_POINT_WEEK: ''
    }, o);
    App.data.cash_audits = weeklySeries('cash', {
      90: mkCashAudit(dateStr(90), daysAgoISO(90), 'CA-2026-0006', periodLabel(90), cashRaw({
        OVERALL_SCORE: 42, S1_SCORE: 38, S2_SCORE: 40, S3_SCORE: 44, S4_SCORE: 46,
        TRAPPED_CASH: 6200, DEAD_STOCK: 4100, OVERSTOCK: 2100, BLENDED_TURNS: 6.0,
        DIO: 42, DPO: 12, CYCLE_DAYS: 30, LOCKED_CASH: 7600, DAILY_COGS: 240,
        TIGHT_WEEKS: 2, RUNWAY: 6, LOW_POINT_BAL: 3200, SAFE_TO_SPEND: 4200,
        VENDORS_ON_TERMS: 2, WEIGHTED_DPO: 11,
        S1_FINDING: 'About $6,200 of shelf cash is frozen in slow movers and overstock against $38,000 on hand. Your inventory is working too little of it.',
        S2_FINDING: 'Cash is locked about 30 days: product sits 42 and you take 12 to pay. Order to par and hold your terms.',
        S3_FINDING: '2 of the next thirteen weeks run tight. Free trapped cash and move a payment to cover them.',
        S4_FINDING: '2 of 6 vendors are on terms and you hold about 11 days before paying. Set terms on the rest.'
      })),
      60: mkCashAudit(dateStr(60), daysAgoISO(60), 'CA-2026-0011', periodLabel(60), cashRaw({
        OVERALL_SCORE: 52, S1_SCORE: 48, S2_SCORE: 50, S3_SCORE: 54, S4_SCORE: 56,
        TRAPPED_CASH: 4800, DEAD_STOCK: 3100, OVERSTOCK: 1700, BLENDED_TURNS: 6.6,
        DIO: 36, DPO: 14, CYCLE_DAYS: 24, LOCKED_CASH: 6000, DAILY_COGS: 245,
        TIGHT_WEEKS: 1, RUNWAY: 8, LOW_POINT_BAL: 6400, SAFE_TO_SPEND: 7800,
        VENDORS_ON_TERMS: 3, WEIGHTED_DPO: 15,
        S1_FINDING: 'Trapped cash is down to about $4,800 as the slow premium stock moves. Keep cutting the dead weight.',
        S2_FINDING: 'The cash cycle tightened to about 24 days. Product sits 36 and you take 14 to pay.',
        S3_FINDING: '1 tight week ahead. Catch it on the forecast before it lands.',
        S4_FINDING: '3 of 6 vendors are on terms now, holding about 15 days. Two more to go.'
      })),
      30: mkCashAudit(dateStr(30), daysAgoISO(30), 'CA-2026-0016', periodLabel(30), cashRaw({
        OVERALL_SCORE: 62, S1_SCORE: 60, S2_SCORE: 60, S3_SCORE: 62, S4_SCORE: 66,
        TRAPPED_CASH: 3400, DEAD_STOCK: 2200, OVERSTOCK: 1200, BLENDED_TURNS: 7.0,
        DIO: 30, DPO: 16, CYCLE_DAYS: 18, LOCKED_CASH: 4500, DAILY_COGS: 248,
        TIGHT_WEEKS: 1, RUNWAY: 10, LOW_POINT_BAL: 9200, SAFE_TO_SPEND: 11200,
        VENDORS_ON_TERMS: 4, WEIGHTED_DPO: 17,
        S1_FINDING: 'About $3,400 still tied up, mostly a couple of premium bottles. Run them down or feature them.',
        S2_FINDING: 'Cash cycle down to about 18 days. The pars are closer to real usage now.',
        S3_FINDING: '1 tight week ahead, but the runway is out to about 10 weeks.',
        S4_FINDING: '4 of 6 vendors on terms, holding about 17 days. Pay on the due date, not before.'
      })),
      0: mkCashAudit(dateStr(0), daysAgoISO(0), 'CA-2026-0021', periodLabel(0), cashRaw({
        OVERALL_SCORE: 70, S1_SCORE: 70, S2_SCORE: 68, S3_SCORE: 72, S4_SCORE: 72,
        TRAPPED_CASH: 2400, DEAD_STOCK: 1600, OVERSTOCK: 800, BLENDED_TURNS: 7.4,
        DIO: 26, DPO: 18, CYCLE_DAYS: 14, LOCKED_CASH: 3500, DAILY_COGS: 250,
        TIGHT_WEEKS: 0, RUNWAY: 12, LOW_POINT_BAL: 12800, SAFE_TO_SPEND: 14600,
        VENDORS_ON_TERMS: 4, WEIGHTED_DPO: 18,
        S1_FINDING: 'Down to about $2,400 trapped, mostly slow premium liquor. The shelf is working.',
        S2_FINDING: 'Cash cycle about 14 days and holding. Keep ordering to par.',
        S3_FINDING: 'No tight weeks in the next thirteen. The runway is clear.',
        S4_FINDING: '4 of 6 vendors on terms, holding about 18 days. Set terms on the last two.'
      }))
    });
    // Regenerate the current (day-0) audit from the LIVE engine so it matches the
    // Cash screens exactly; the hand-authored day-0 above only seeds the weekly
    // fill interpolation. Keep its display id/date.
    try {
      if (window.S && S.CashAudit && window.CashEngine && S.CashAudit._computeAudit) {
        const engCash = S.CashAudit._computeAudit();
        if (engCash && App.data.cash_audits[0]) {
          engCash.audit_id     = App.data.cash_audits[0].audit_id;
          engCash.audit_period = App.data.cash_audits[0].audit_period;
          engCash.date         = App.data.cash_audits[0].date;
          engCash.generated_at = App.data.cash_audits[0].generated_at;
          App.data.cash_audits[0] = engCash;
        }
      }
    } catch (e) { /* keep the hand-authored day-0 if the engine cannot read yet */ }

    App.data.bar_cop_audits = [
      // ── Day 30 (61 days ago) — overall 49. The first Bar Cop audit, on only a
      //    few weeks of logged data. Recovery Action and Operational Consistency
      //    read N/A until a longer trend exists; they fill in by day 60.
      bcaRec(61, 'BCA-2026-0009',
        [50, 48, 44, 52, null, null],
        [
          [ d('Opening checklist completion', '7 opening checklists logged', 23),
            d('Closing checklist completion', '5 closing checklists logged', 17),
            d('Inventory counts completed', '1 of 4 expected weekly', 25),
            d('Spot checks completed', '1 of 4 expected weekly', 25),
            d('Shifts logged', '12 shifts in window', 40),
            d('Profit Recovery audit on time', 'Current', 100),
            d('Revenue Recovery audit on time', 'Current', 100),
            d('Cash Recovery audit on time', 'Current', 100),
            d('Maintenance backlog cleared', '4 open over 14 days', 20) ],
          [ d('Cash variance trend (lower is better)', '0.62% of revenue handled', 38),
            d('Drawer counts per operating day', '8 counts on 14 operating days', 57),
            d('Cash drops on revenue days', '7 drops on 14 days over $500', 50) ],
          [ d('Inventory counts on schedule', '2 of 4 expected weekly counts', 50),
            d('Spot checks completed', '1 of 4 expected weekly', 25),
            d('Vendor discrepancy resolution rate', '2 of 3 resolved in last 90 days', 67),
            d('No discrepancies aging past 60 days', '1 open discrepancy aging', 80),
            d('Spot check clean variance rate', '0 of 1 under $5 variance', 0) ],
          [ d('Schedule adherence', '116 actual vs 112 scheduled hours', 50),
            d('Callout frequency', '3 callouts in window', 55),
            d('Overtime incidents under control', '1 shift over 40 hours', 55),
            d('Certifications current', '0 expired, 2 expiring in 30 days', 52),
            d('Coaching log activity', '2 coaching notes in last 90 days', 100),
            d('Wage policy configured', 'Wage Policies not configured', 0) ],
          [ d('Acting on surfaced gaps', 'Only a few weeks of fix history so far', null),
            d('Fixes that produced movement', 'Logged fixes have not matured in the window yet', null) ],
          [ d('Weekly covers consistency', '3 weeks of revenue data (need 8 for a trend)', null),
            d('Weekly labor % consistency', '3 weeks of P&L data (need 8 for a trend)', null),
            d('Weekly pour cost % consistency', '3 weeks of P&L data (need 8 for a trend)', null) ]
        ],
        [
          { label: '2 high-priority maintenance items open', detail: 'Equipment flagged urgent and still unresolved. A failing walk-in or ice machine is lost product and an emergency repair bill. Close these first.', severity: 'critical', screen: 'sc-maintenance' },
          { label: 'Opening checklist run only 7 times in last 30 days', detail: 'Below 20 of an expected 30 runs. Day starts without the opening sweep can mean missed restock or setup issues.', severity: 'warn', screen: 'sc-checklists' },
          { label: 'Closing checklist run only 5 times in last 30 days', detail: 'Below 20 of an expected 30 runs. Missed closes invite cash-handling and clean-up gaps.', severity: 'warn', screen: 'sc-checklists' },
          { label: '4 cash variances over $20 in last 30 days', detail: 'Pattern suggests a drawer or close-out process gap. Review who counted and when.', severity: 'warn', screen: 'sc-cash-control' }
        ],
        [
          { label: 'Recurring cash variance: Maria G.', detail: '4 variance events in last 90 days. Coach or rotate the close.', screen: 'sc-cash-control' },
          { label: 'Void/comp concentration on Late Night shifts', detail: '12 events in last 90 days on Late Night. Pattern worth investigating.', screen: 'sc-void-comp' }
        ],
        { gaps: 8, fixesLogged: 2, dollarsRecovered: 0, stillMeasuring: 2 }
      ),
      // ── Day 60 (31 days ago) — overall 60, all six sub-scores now covered.
      //    Procedures climbing, fixes logged and starting to pay.
      bcaRec(31, 'BCA-2026-0013',
        [63, 56, 60, 62, 56, 62],
        [
          [ d('Opening checklist completion', '11 opening checklists logged', 37),
            d('Closing checklist completion', '9 closing checklists logged', 30),
            d('Inventory counts completed', '2 of 4 expected weekly', 50),
            d('Spot checks completed', '1 of 4 expected weekly', 25),
            d('Shifts logged', '17 shifts in window', 57),
            d('Profit Recovery audit on time', 'Current', 100),
            d('Revenue Recovery audit on time', 'Current', 100),
            d('Cash Recovery audit on time', 'Current', 100),
            d('Maintenance backlog cleared', '2 open over 14 days', 60) ],
          [ d('Cash variance trend (lower is better)', '0.50% of revenue handled', 50),
            d('Drawer counts per operating day', '14 counts on 22 operating days', 64),
            d('Cash drops on revenue days', '11 drops on 20 days over $500', 55) ],
          [ d('Inventory counts on schedule', '3 of 4 expected weekly counts', 75),
            d('Spot checks completed', '2 of 4 expected weekly', 50),
            d('Vendor discrepancy resolution rate', '3 of 5 resolved in last 90 days', 60),
            d('No discrepancies aging past 60 days', '2 open discrepancies aging', 60),
            d('Spot check clean variance rate', '1 of 2 under $5 variance', 50) ],
          [ d('Schedule adherence', '118 actual vs 116 scheduled hours', 68),
            d('Callout frequency', '2 callouts in window', 65),
            d('Overtime incidents under control', '1 shift over 40 hours', 70),
            d('Certifications current', '0 expired, 1 expiring in 30 days', 68),
            d('Coaching log activity', '4 coaching notes in last 90 days', 100),
            d('Wage policy configured', 'Wage Policies not configured', 0) ],
          [ d('Acting on surfaced gaps', '5 fixes logged in last 30 days against 8 surfaced gaps', 63),
            d('Fixes that produced movement', '4 of 8 logged fixes produced favorable movement', 50) ],
          [ d('Weekly covers consistency', '8 weeks of revenue data (need 3+)', 64),
            d('Weekly labor % consistency', '8 weeks of P&L data (need 3+)', 60),
            d('Weekly pour cost % consistency', '8 weeks of P&L data (need 3+)', 62) ]
        ],
        [
          { label: 'ServSafe Food Handler Certification expiring in 18 days', detail: 'For Hector M. Renew before lapse to stay compliant.', severity: 'warn' },
          { label: 'Closing checklist run only 14 times in last 30 days', detail: 'Below 20 of an expected 30 runs. Missed closes invite cash-handling and clean-up gaps.', severity: 'warn', screen: 'sc-checklists' },
          { label: '3 cash variances over $20 in last 30 days', detail: 'Pattern suggests a drawer or close-out process gap. Review who counted and when.', severity: 'warn', screen: 'sc-cash-control' }
        ],
        [
          { label: 'Void/comp concentration on Late Night shifts', detail: '11 events in last 90 days on Late Night. Pattern worth investigating.', screen: 'sc-void-comp' }
        ],
        { gaps: 7, fixesLogged: 4, dollarsRecovered: 1840, stillMeasuring: 2 }
      )
    ];

    // ── Day 90 (current) — generated by the LIVE engine on the seeded data, so
    // every component line is true by construction (the seed-roundtrip rule). The
    // engine only scores the current 30-day window, so the day-30 and day-60
    // records above stay hand-authored history. Stamped to 1 day ago so it sits at
    // the day-90 mark on the cadence; id fixed for a stable display.
    if (window.S && S.HubBarCopAudit && S.HubBarCopAudit._computeAuditSnapshot) {
      const bca90 = S.HubBarCopAudit._computeAuditSnapshot();
      if (bca90) {
        bca90.id = uid();
        bca90.date = dateStr(1);
        bca90.audit_id = 'BCA-2026-0017';
        App.data.bar_cop_audits.push(bca90);
      }
    }

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
    // it keeps. Everything else — Profit, Revenue, Cash, fix log —
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
    // The cockpit's per-week "done" stamps live in localStorage (per device), so
    // clear them too or past weeks keep phantom checks after a wipe.
    try { Object.keys(localStorage).filter(k => k.indexOf('cockpit_done_') !== -1).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    // Cash Recovery device-local config also lives in localStorage. Clear it too,
    // or a wiped account keeps the seeded opening balance, tax rate, and reserve
    // and reads as if the opening balance is already set (Cash Audit step 1 checks
    // off, Cash Position pre-fills). A real fresh signup never has these.
    try { ['cash_opening_balance', 'cash_sales_tax_rate', 'cash_tax_freq', 'cash_payroll_burden', 'cash_reserve_weeks', 'cash_available_credit', 'cash_gift_card_liability', 'events_step_ack_leads', 'events_step_ack_deposits', 'events_step_ack_prep', 'events_step_ack_close', 'event_agreement_terms'].forEach(k => localStorage.removeItem(k)); } catch (e) {}
    App.updatePeriod();

    if (msg) { msg.style.color = 'var(--gold)'; msg.textContent = '✓ All data cleared. Reloading...'; }
    setTimeout(() => window.location.reload(), 800);
  }
};
