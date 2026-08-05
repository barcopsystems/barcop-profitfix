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
    'business-profile': { title: 'Business Profile', action: 'settings-profile', ids: ['profile', 'service', 'tax'] },
    'recovery-targets': { title: 'Recovery Targets', action: 'settings-targets', ids: ['profit', 'revenue'] }
  },

  // Full-page Hub screen. Sidebar stays mounted, content area swaps.
  open(group) {
    // SET-2: the demo may SEE this page. The guard moved to saveSection/saveGroup, so a visitor
    // reads their way round Business Profile and Recovery Targets and can change nothing.
    if (App._hubBlocked && App._hubBlocked()) return;   // Business Profile / Targets — not for Staff
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
    const secs = grp ? grp.ids.map(id => allSecs.find(s => s.id === id)).filter(Boolean)
                     : allSecs;
    container.scrollTop = 0;
    this._activeSecs = secs.map(s => s.id);   // the Save-all button saves these

    let inner;
    if (group === 'business-profile' || group === 'recovery-targets') {
      // Each section in its own dark wrapper (same as the onboarding page), white
      // section titles, no divider lines, all inside one page card. One gold Save
      // Data button (outside the card) saves every section in the group.
      const secLabel = 'font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;';
      const help = 'font-size:11px;color:var(--t3);line-height:1.5;margin-bottom:11px;';
      const EXPLAIN = {
        service: 'Tap on the service periods you run and set the times.',
        tax:     'Set these once. Cash, Books, and Labor read them.',
        profit:  'Your cost goals. Profit Recovery measures your actuals against them.',
        revenue: 'Your sales goals. Revenue Recovery measures your actuals against them.'
      };
      const parts = secs.map((s, i) =>
        '<div class="auth-inputs" data-section="' + s.id + '" style="text-align:left;margin-bottom:' + (i === secs.length - 1 ? '0' : '16px') + ';">'
        + '<div style="' + secLabel + '">' + esc(s.title)
        // Refusal slot (SET-5). Styled to match the Build Schedule modal's bs-lt-err rather
        // than inventing a look; the title is uppercase + letter-spaced, so the span resets
        // both or the message renders as shouting.
        +   '<span class="hs-err" id="hs-' + s.id + '-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;text-transform:none;letter-spacing:0;font-weight:600;"></span>'
        + '</div>'
        + (EXPLAIN[s.id] ? '<div style="' + help + '">' + EXPLAIN[s.id] + '</div>' : '')
        + s.body
        + '</div>'
      ).join('');
      // The three wrapped sections sit inside the standard page card (no header,
      // no dividers); the Save Data button stays outside/below it.
      inner = '<div class="card form-card" style="margin-bottom:0;">' + parts + '</div>'
        + '<div style="display:flex;align-items:center;gap:12px;margin:16px 0 24px;">'
        +   '<button class="btn btn-primary hs-save-all">Save Data</button>'
        +   '<span class="hs-msg" data-msg="all" style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gold);display:none;">Saved</span>'
        + '</div>';
    } else {
      inner = secs.map(s =>
        '<div class="card form-card" data-section="' + s.id + '" style="margin-bottom:16px;">'
        + this.sectionHead(s.id, s.title, s.save)
        + s.body
        + '</div>'
      ).join('');
    }

    container.innerHTML = '<div class="screen">' + inner + '</div>';
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    this.wire(container);
    // SET-2: AFTER wire(), so the ServicePeriods component has mounted its own buttons and
    // time inputs and they get locked too. Locking before wire() would miss every control the
    // component creates, which is most of the Service Periods section.
    if (App.demoLockScreen) App.demoLockScreen(container);
  },

  // Card header: title left, Saved indicator + Save Data button right.
  // Save button styled like the "Go" buttons in Getting Started (ghost, small).
  sectionHead(id, title, hasSave) {
    return '<div class="card-title" style="display:flex;align-items:center;gap:12px;">'
      + '<span style="flex:1;">' + esc(title) + '</span>'
      // The refusal slot exists in BOTH layouts. Only the grouped one ships today, but a
      // guard that can only report itself on one layout is a silent refusal on the other.
      + '<span class="hs-err" id="hs-' + id + '-err" style="color:var(--red);font-size:12px;display:none;font-weight:600;"></span>'
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
      + '<div class="f" style="width:120px;"><label>Phone</label><input type="text" id="hs-phone" value="' + esc(s.phone||'') + '" placeholder="(512) 555-5555"/></div>'
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
      + '<div class="f" style="width:130px;"><label>Comp Target</label><div class="fw"><input class="suf" type="number" id="hs-r-cp" value="' + (rt.comp_pct ?? 3) + '" step="0.5"/><span class="suf">%</span></div></div>'
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
    const saveAll = container.querySelector('.hs-save-all');
    if (saveAll) saveAll.addEventListener('click', () => this.saveGroup(this._activeSecs || []));
    const spMount = container.querySelector('#hs-sp-mount');
    if (spMount && window.ServicePeriods) {
      this._spCtrl = ServicePeriods.mount(spMount, { selected: App.servicePeriods() });
    }
  },

  _flashSaved(id) {
    const m = document.querySelector('.hs-msg[data-msg="' + id + '"]');
    if (m) { m.style.display = 'inline'; setTimeout(() => { m.style.display = 'none'; }, 2500); }
  },

  // ── Write one section's fields into the live stores; return the App.data keys
  // to persist ([] = nothing to push, e.g. Taxes writes device-local + Labor),
  // or null when validation fails (Service Periods) so the caller aborts. ──────
  // ── NUMERIC BOUNDS (SET-5) ────────────────────────────────────────────────────────────
  // Returns '' when every number in the section is allowed, or the operator-facing refusal
  // naming each bad field.
  // ⛔ THIS IS A SEPARATE METHOD ON PURPOSE. saveGroup writes several sections in a row, so
  // every section has to be JUDGED before the first one MUTATES — validating inside the write
  // meant a later section's refusal left an earlier section's edit live in memory, unsaved.
  _boundsError(which) {
    // MEASURED in the live app before this existed: -5% pour cost, 250% labor, 500% sales tax,
    // 900% payroll and a -$5 minimum wage all saved, silently, and the Settings overview then
    // printed "POUR COST -5%" as fact. 74 read sites across 19 files consume settings.targets.*,
    // and every one falls back with `|| 22`, which is FALSY — so 0 falls back to the default
    // but -5 is truthy and reaches all of them.
    //
    // The bounds are STRUCTURAL, not fitted to a fixture ([[the-loop]] #28): a cost target above
    // 100% of sales is arithmetically meaningless; a $0 check-average or RPLH target is
    // meaningless; and a tax RATE of 0 is legitimate (no-sales-tax states), which is why tax and
    // wage take min 0 while the targets take min 1. Blank always means "not set" and stays
    // allowed — that is how an operator clears the payroll figure.
    const BOUNDS = {
      profit: [
        ['hs-bpc', 'Bar Pour Cost %', 1, 100], ['hs-fc', 'Food Cost %', 1, 100],
        ['hs-lc', 'Labor Cost %',     1, 100], ['hs-pc', 'Prime Cost %', 1, 100]
      ],
      revenue: [
        ['hs-r-ca', 'Check Average',    0.01, null], ['hs-r-rl', 'Lunch RPLH',  0.01, null],
        ['hs-r-rd', 'Dinner RPLH',      0.01, null], ['hs-r-rb', 'Bar RPLH',    0.01, null],
        ['hs-r-ec', 'Event Close Rate', 1,    100],  ['hs-r-cp', 'Comp Target', 0,    100]
      ],
      tax: [
        ['hs-tax',     'Sales tax rate',     0, 100], ['hs-burden', 'Payroll tax', 0, 100],
        ['hs-minwage', 'State minimum wage', 0, null]
      ]
    };
    if (!BOUNDS[which]) return '';
    const bad = [];
    for (const [id, label, min, max] of BOUNDS[which]) {
      const el = document.getElementById(id);
      if (!el) continue;
      const raw = String(el.value == null ? '' : el.value).trim();
      if (raw === '') continue;                       // blank = not set, always allowed
      const v = parseFloat(raw);
      if (isNaN(v) || v < min || (max != null && v > max)) {
        bad.push(max != null ? label + ' must be between ' + min + ' and ' + max + '.'
               : min > 0     ? label + ' must be greater than zero.'
                             : label + ' cannot be negative.');
      }
    }
    return bad.join(' ');
  },

  // One writer for the per-section refusal line, so the two callers cannot word it differently.
  _showSectionErr(which, msg) {
    const el = document.getElementById('hs-' + which + '-err');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'inline' : 'none';
  },

  _writeSection(which) {
    const numOr = (id, d) => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? d : v; };

    // Last line of defence for the PER-SECTION Save button (the card layout). saveGroup judges
    // every section up front; this keeps the single-section path honest on its own, and it must
    // stay ABOVE every mutation below ([[the-loop]] #49: a refusal is an exit, and an exit from
    // a handler that has already mutated has to put memory back. Refusing here means there is
    // nothing to put back).
    const boundsMsg = this._boundsError(which);
    this._showSectionErr(which, boundsMsg);
    if (boundsMsg) return null;
    // END GUARD


    if (which === 'profile') {
      const s = App.data.settings;
      const city  = document.getElementById('hs-city')?.value.trim() || '';
      const state = document.getElementById('hs-state')?.value.trim() || '';
      s.bar_name            = document.getElementById('hs-name')?.value.trim() || '';
      s.phone               = document.getElementById('hs-phone')?.value.trim() || '';
      s.address             = document.getElementById('hs-address')?.value.trim() || '';
      s.city_state          = city && state ? city + ', ' + state : city || state || '';
      // Filling the profile here (not just via onboarding) checks off the setup step.
      if (s.bar_name && App.markSetupDone) App.markSetupDone('gs_profile');
      return ['settings'];
    } else if (which === 'tax') {
      // Cross-section financial settings live on this device via CashEngine,
      // not in App.data, so there are no App.data keys to push.
      if (window.CashEngine) {
        CashEngine.setSalesTaxRate(document.getElementById('hs-tax')?.value || '');
        CashEngine.setTaxFrequency(document.getElementById('hs-freq')?.value || 'monthly');
        CashEngine.setPayrollBurden(document.getElementById('hs-burden')?.value || '');
      }
      // State minimum wage feeds the Labor tip-credit check; it lives in Labor's
      // data store (loaded at boot, so this never clobbers it), so write it there
      // and persist it directly.
      App.laborData = App.laborData || {};
      App.laborData.settings = App.laborData.settings || {};
      const mwRaw = document.getElementById('hs-minwage')?.value;
      App.laborData.settings.state_min_wage = (mwRaw === '' || mwRaw == null) ? null : (parseFloat(mwRaw) || 0);
      App.saveLabor();
      return [];
    } else if (which === 'service') {
      const all = this._spCtrl ? this._spCtrl.value() : [];
      const errEl = document.getElementById('hs-sp-err');
      const showErr = m => { if (errEl) { errEl.textContent = m; errEl.style.display = 'inline'; } };
      if (all.some(p => !(p.name || '').trim())) { showErr('Name your custom period, or turn it off.'); return null; }
      const periods = all.filter(p => p && p.name);
      if (!periods.length) { showErr('Pick at least one service period.'); return null; }
      if (errEl) errEl.style.display = 'none';
      App.data.settings.service_periods = periods;
      return ['settings'];
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
      return ['settings'];
    } else if (which === 'revenue') {
      const rs = App.data.revenue_settings = App.data.revenue_settings || {};
      rs.targets = Object.assign({}, rs.targets, {
        check_avg:         numOr('hs-r-ca', 35),
        rplh_lunch:        numOr('hs-r-rl', 50),
        rplh_dinner:       numOr('hs-r-rd', 75),
        rplh_bar:          numOr('hs-r-rb', 65),
        event_close_rate:  numOr('hs-r-ec', 40),
        comp_pct:          numOr('hs-r-cp', 3)
      });
      // Labor % is now the single settings.targets.labor_cost_pct (App.laborTargetPct);
      // drop the old per-department copies so they can't drift.
      delete rs.targets.bar_labor_pct;
      delete rs.targets.kitchen_labor_pct;
      delete rs.targets.floor_labor_pct;
      return ['revenue_settings'];
    }
    return null;
  },

  // ── Per-section save (Recovery Targets page uses this per card) ─────────────
  saveSection(which) {
    // SET-2 layer 2. render() disables these fields in the demo, but a disabled control is a
    // courtesy and not a guard ([[the-loop]] #85), and DB._demo would otherwise ACCEPT the edit
    // and report success — a visitor could rename the bar and carry it onto their exported PDFs
    // for the session, which is the exact thing the original page gate existed to stop.
    if (App.demoBlock && App.demoBlock()) return;
    const keys = this._writeSection(which);
    if (keys == null) return;  // validation failed
    Promise.all(keys.map(k => App.saveKey(k))).then(results => {
      // S195: only claim "Saved" when the write actually landed. saveKey has already surfaced the
      // failure, and ticking a setup task done for a save that never happened would be a second
      // lie on top of the first. An OFFLINE save returns true (it is on-device and queued), so
      // working offline still flashes Saved — which is the truth.
      if (!results.every(Boolean)) return;
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

  // ── Save-all for the combined pages (Business Profile, Recovery Targets) —
  // one button writes every section in the group. Service Periods is validated
  // first so a bad daypart aborts the whole save (nothing writes half-done). ──
  saveGroup(ids) {
    // SET-2 layer 2 — and THIS is the button both Settings pages actually render, so it matters
    // more than saveSection. See saveSection for why the disabled attribute is not enough.
    if (App.demoBlock && App.demoBlock()) return;
    ids = ids || [];
    // ⛔ JUDGE EVERY SECTION BEFORE WRITING ANY OF THEM (SET-5). The loop below swallows a
    // refusal (`this._writeSection(id) || []`), so before this check a refused Profit Targets
    // still let Revenue save and STILL FLASHED "Saved" in gold beside the red refusal. Worse,
    // when every section refused, `keys` came out empty, `Promise.all([])` resolved to `[]`,
    // and `[].every(Boolean)` is TRUE ([[the-loop]] #23 — a claim about "every" is vacuous on
    // an empty collection), so "Saved" flashed over nothing having been saved at all.
    // Judging up front also means a LATER section's refusal cannot leave an EARLIER section's
    // edit sitting live in memory unsaved ([[the-loop]] #49).
    // ⚠ An empty `keys` is still legitimate on its own: the tax section writes through
    // CashEngine and saveLabor and returns no App.data keys, so the flash below is correct
    // for a tax-only group. That is why this guards on the REFUSAL, not on the key count.
    let refused = false;
    ids.forEach(id => {
      const msg = this._boundsError(id);
      this._showSectionErr(id, msg);
      if (msg) refused = true;
    });
    if (refused) return;
    const keys = new Set();
    if (ids.includes('service')) {
      const svcKeys = this._writeSection('service');
      if (svcKeys == null) return;  // service-period validation failed
      svcKeys.forEach(k => keys.add(k));
    }
    ids.filter(id => id !== 'service').forEach(id => {
      (this._writeSection(id) || []).forEach(k => keys.add(k));
    });
    Promise.all([...keys].map(k => App.saveKey(k))).then(async (results) => {
      if (!results.every(Boolean)) return;   // S195 — see saveSection: never flash "Saved" over a failed write
      this._flashSaved('all');
      App.updatePeriod();
      if (ids.includes('service')) App.markSetupDone('gs_service_periods');
      if (ids.includes('profit') || ids.includes('revenue')) App.markSetupDone('gs_targets');
      // Keep the bar switcher (accounts.name) in sync with the bar name.
      if (ids.includes('profile')) {
        try {
          if (window.DB && DB.setAccountName && App.data.settings.bar_name) {
            await DB.setAccountName(App.data.settings.bar_name);
            if (App.renderAccountSwitcher) await App.renderAccountSwitcher();
          }
        } catch (e) { console.error('account name sync', e); }
      }
    });
  },

  // ── Data backup (Section 15) ───────────────────────────────────────────────
  // A full, self-contained backup: the Recovery data blob plus all three
  // Control stores. Plain JSON the operator keeps offsite.
  _backupMsg(text, color) {
    const m = document.getElementById('ua-backup-msg');
    if (m) { m.style.color = color || 'var(--gold)'; m.textContent = text; m.style.display = 'block'; }
  },

  // Build the full-account backup object (all four blobs + device-local cash config).
  // Shared by the file export, the automatic server snapshot, and the "Back up now" button
  // so all three capture the exact same shape (which _applyBackup restores).
  _buildBackup() {
    // Cash Recovery config lives device-local (CashEngine/localStorage), NOT in the four
    // data objects below, so capture it explicitly or a restore to a fresh device would
    // silently drop the opening balance, tax, credit line, gift-card liability and reserve.
    const CE = window.CashEngine;
    return {
      _backup: 'barcop',
      version: 2,
      exported_at: new Date().toISOString(),
      bar_name: (App.data.settings && App.data.settings.bar_name) || '',
      data:          App.data || {},
      inventoryData: App.inventoryData || {},
      laborData:     App.laborData || {},
      shiftData:     App.shiftData || {},
      cashConfig: CE ? {
        opening_cash:        CE.openingCash(),
        sales_tax_rate:      CE.salesTaxRate(),
        tax_frequency:       CE.taxFrequency(),
        payroll_burden:      CE.payrollBurden(),
        reserve_weeks:       CE.reserveWeeks(),
        available_credit:    CE.availableCredit(),
        gift_card_liability: CE.giftCardLiability()
      } : null
    };
  },

  exportBackup() {
    const backup = this._buildBackup();
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
      // Defer revocation so a large multi-MB backup finishes downloading before the
      // blob URL is torn down (matches the app's PDF saver). Revoking on the same
      // tick can yield a 0-byte or truncated file on a slow read.
      setTimeout(() => URL.revokeObjectURL(url), 1500);
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
      await this._applyBackup(backup);
      this._backupMsg('Backup restored. Reloading...', 'var(--gold)');
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      this._backupMsg('Restore failed: ' + (e.message || 'unknown error'), 'var(--red)');
      // A restore that got as far as writing leaves memory and the server possibly disagreeing —
      // a committed blob cannot be un-written. Reload so what is on screen is what is on the
      // server. Longer than the success reload so the failure is actually readable. PREFLIGHT
      // refusals do not set this flag: nothing ran, so there is nothing to settle.
      if (e && e.restoreNeedsReload) setTimeout(() => window.location.reload(), 2500);
    }
  },

  // Does a backup section carry actual ENTERED RECORDS (not just scalar flags)? The 21 entered
  // arrays are row-per-record now, so a control blob can legitimately hold only seed flags like
  // {lc_positions_seeded:true} — a shallow key count would call that "populated" and let it
  // replace a live, fully-populated section, after which seedEventStores wipes that module's
  // rows to match. Test the ARRAYS, which is what a restore actually reseeds.
  _sectionHasRecords(o) {
    return !!o && typeof o === 'object'
      && Object.keys(o).some(k => Array.isArray(o[k]) && o[k].length > 0);
  },

  // Overwrite the account from a backup object (a file OR a stored snapshot — same shape).
  // Caller validates + confirms first. seedEventStores clears+reseeds each event table, so a
  // restore fully replaces rows; the guards below keep a populated section if the backup
  // lacks it (a partial/old file must never erase live staff/locations).
  //
  // ⚠ seedEventStores CLEARS each event table before it reseeds, so this function is
  // destructive the moment it starts. Two protections, both load-bearing:
  //  1. Refuse outright to restore a snapshot that carries no records at all. An empty
  //     snapshot (e.g. captured before the account finished loading) would otherwise clear
  //     all four event tables and seed nothing back — a total wipe reported as "restored".
  //  2. _allowReset + a checked return on every blob save. Without _allowReset the writeData
  //     total-wipe backstop BLOCKS the config save (App.data legitimately looks empty mid-
  //     restore), and because that return was previously discarded the restore carried on to
  //     clear the rows anyway — blob preserved, every record gone. Abort instead.
  async _applyBackup(backup) {
    // ONE restore at a time. Neither entry point disables its control — importBackup even resets
    // the file input to '' so it is instantly re-selectable — and a large restore runs 20-30s
    // behind a static "Restoring backup..." with the reload deferred 1200ms, so a second click
    // was reachable. Overlapping runs corrupt the _allowReset save/restore below: the second
    // captures the first's `true` as its "previous" value, the first hands back `false`, and the
    // second then hands back TRUE — leaving the total-wipe backstop disarmed for the rest of the
    // session. That is the "a leaked bypass is worse than the bug it bypasses" condition.
    // Checked before the flag is set below, with no await in between, so there is no window.
    // DB._restoreBusy, not a flag on this screen. It has to be visible to db.js (the bar switcher
    // reloads the page and would kill a restore mid-flight) AND it has to stay set through the
    // reload that settles a FAILED restore. The old screen-local flag cleared in the finally,
    // before the caller had even scheduled that reload — so for the whole 2.5s window the
    // controls were live, the failure copy said "run the restore again", and a retry started in
    // that window was then killed by the first attempt's timer. Not a race: a restore takes
    // 20-30s and the timer always won.
    if (DB._restoreBusy) {
      throw new Error('a restore is already running. Wait for it to finish before starting another.');
    }
    const hasData = o => this._sectionHasRecords(o);
    if (!hasData(backup.data) && !hasData(backup.inventoryData)
        && !hasData(backup.laborData) && !hasData(backup.shiftData)) {
      throw new Error('that backup contains no records, so restoring it would erase this account');
    }
    // ── PREFLIGHT — refuse BEFORE touching anything ──────────────────────────────────────────
    // The abort-guard inside _applyBackupInner fires between steps, by which point earlier steps
    // have already committed: blobs written, event rows cleared and reseeded, and — on the
    // offline path — writeData has ALREADY done _localWrite + _markPending before returning its
    // failure, so the browser's `online` event later auto-syncs the half-applied restore to the
    // server with no reload and no user action. A mid-flight abort therefore cannot honour the
    // promise "nothing was erased". The only place that promise can be kept is BEFORE the first
    // mutation, so check the things that make a restore fail here and refuse cleanly.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('you appear to be offline. Restoring replaces every record in your account, so it needs a live connection. Nothing has been changed — try again once you are back online.');
    }
    if (!DB._dataReady) {
      throw new Error('your account has not finished loading, so a restore would not be safe. Nothing has been changed — reload the page and try again.');
    }
    // saveInventory/saveLabor/saveShift return false while their control blob is not confirmed
    // loaded (_writeControl returns {deferred:true}), and _controlReady is only reset by
    // loadAllData — so one transient control read at boot would otherwise abort the restore
    // mid-way, every time, until a reload, with no hint that reloading is the fix.
    const _notReady = ['ic_data', 'lc_data', 'sc_data'].filter(t => !DB._controlReady[t]);
    if (_notReady.length) {
      throw new Error('your Inventory, Labor and Shift data has not finished loading, so a restore would not be safe. Nothing has been changed — reload the page and try again.');
    }
    // Refuse on top of UNSYNCED WORK. Two reasons, both load-bearing. First, the abort path has to
    // undo what a failed write staged — writeData and _writeControl each do _localWrite +
    // _markPending BEFORE reporting failure — and that undo is only exact if the queue started
    // empty; otherwise we cannot tell the operator's own queued work from the backup's blob, and
    // both live at the same localStorage key. Second, a restore racing the operator's unsynced
    // edits would push whichever landed last with no way to tell which won.
    const _pendingNow = (DB._pendingList && DB._pendingList()) || [];
    if (_pendingNow.length) {
      throw new Error('you have changes still waiting to sync (' + _pendingNow.length + '). Let them finish, or use Sync Now, before restoring. Nothing has been changed.');
    }

    // A restore intentionally replaces everything — tell the total-wipe backstop this write
    // is sanctioned (same contract clearAll/loadSample use), and always hand it back.
    const prevAllowReset = DB._allowReset;
    DB._allowReset = true;
    DB._restoreBusy = true;
    try {
      await this._applyBackupInner(backup, hasData);
      // ⚠ STAY BUSY (S12). This used to release here, reasoning "the caller reloads shortly;
      // nothing left to protect" — but the caller reloads on a 1200ms TIMER and the restore
      // controls are never disabled, so for that whole window a second restore could be started
      // and would then be killed mid-flight by the first attempt's timer, between clearEvents and
      // putEventsBulk: rows deleted, nothing written. That is the EXACT failure the catch below
      // was fixed for, and the success path never got the same treatment — the reload is what
      // makes the window safe, so the guard has to hold until it lands.
      // Latching here is correct and cannot strand the app: on success the page always reloads
      // (both callers), and a restore that changed NOTHING never reaches this line — a preflight
      // refusal throws before the flag is set, and an inner failure releases in the catch.
    } catch (e) {
      // STAY BUSY only while a reload is actually coming to settle the account. That reload is
      // what makes the 2.5s window safe: the restore controls are never disabled, and the failure
      // copy invites a retry, so without this a second attempt would start and then be killed
      // mid-flight by the first attempt's timer — between clearEvents and putEventsBulk, leaving
      // rows deleted and nothing written. A refusal that changed NOTHING must release, or the app
      // would be permanently unable to restore or switch bars.
      if (!e || !e.restoreNeedsReload) DB._restoreBusy = false;
      throw e;
    } finally {
      DB._allowReset = prevAllowReset;
    }
  },

  async _applyBackupInner(backup, hasData) {
    // A save that reports failure must stop the restore BEFORE seedEventStores clears rows.
    // ⚠ These callers return a BOOLEAN, not a result object: App.save() is `return r.ok`
    // (app.js) and saveInventory/saveLabor/saveShift are `return r.ok || !!r.offline`. The first
    // version of this guard tested `r.ok === false`, which on a boolean is always false — `false`
    // short-circuits on `r &&`, and `true.ok` is undefined. It could not throw for ANY input, so
    // the abort it exists to perform never happened and seedEventStores went on to clear every
    // event row after a failed blob write. Test the boolean.
    // An offline restore is also refused, deliberately: a restore CLEARS event rows before
    // reseeding, and doing that without a confirmed connection is how an account ends up empty.
    // Once the FIRST gated write lands, the ENTIRE core blob is on the server, and the cash
    // config rides inside it: acctSet writes App.data.account_state and _configBlob strips only
    // event-store array kinds, so opening balance, tax rate, tax frequency, payroll burden,
    // reserve weeks, credit line and gift-card liability are already the backup's before
    // inventory/labor/shift/core are touched. From that moment "nothing was erased, your account
    // is unchanged" is FALSE — the account is a hybrid: the backup's settings and cash setup
    // against its CURRENT weeks and audits, which is exactly the state an operator would read
    // Cash Position off and get a wrong opening balance. Round 4 found the reassuring copy
    // firing on every abort after this point.
    // WHICH SECTIONS ARE ACTUALLY APPLIED, in order — not a single boolean. The restore runs
    // settings → inventory config → seed(ic) → labor config → seed(lc) → shift config → seed(sc)
    // → seed(core), and each seed() CLEARS that module's rows and reseeds them from the backup.
    // So by the time must('labor config') fails, Inventory has been completely replaced. One flag
    // said "your settings and cash setup were already restored, but the rest was not", which is
    // false for the whole Inventory module and falser at every later step. Same class of
    // dishonest abort copy the earlier reworks of this function existed to end.
    const done = [];
    const must = async (label, p) => {
      const ok = await p;
      if (ok !== true) {
        // An aborted restore means an owner tried to roll their account back and could not.
        // They are safe (nothing was erased) but they are also stuck, and they may not say so.
        // The step goes in the MESSAGE, not just the detail: logClientError dedupes on
        // kind + message per session, so a constant message meant only the FIRST abort was ever
        // reported — and the retries are exactly what reveal where it actually breaks.
        DB.logClientError('restore_aborted', 'Restore aborted at step: ' + label, 'step=' + label + ' applied=' + (done.join('|') || 'none'));
        throw new Error(done.length
          ? 'could not write ' + label + '. Already restored from the backup: ' + done.join(', ')
            + '. The rest was not. Reloading — run the restore again before entering anything new.'
          : 'could not write ' + label + '. Nothing was changed and nothing is queued to sync.');
      }
    };
    // Snapshot the LIVE objects before swapping. must() now actually aborts, and its message
    // promises "your account is unchanged" — that has to be true in MEMORY as well as on the
    // server. Without this, an aborted restore left App.data holding the BACKUP while the server
    // held the real account, and the next autosave, screen save or _maybeAutoBackup would push
    // that half-applied state up. Restore-on-throw makes the promise honest.
    const _prev = { d: App.data, i: App.inventoryData, l: App.laborData, s: App.shiftData };
    // Snapshot the sync queue as well. The preflight has already refused if it was non-empty, so
    // this is an empty list, and restoring it on abort dequeues anything a failed write staged.
    const _prevPending = (DB._pendingList && DB._setPendingList) ? DB._pendingList().slice() : null;
    // The EVENT queue gets the same treatment. Blanket-clearing it on abort (my first fix for the
    // orphaned-queue bug) was too blunt: an operator can legitimately have unsynced record ops
    // queued before a restore, and clearing threw their work away. Snapshotting and restoring
    // still drops everything THIS restore queued — in the normal case the queue starts empty, so
    // restoring the snapshot is clearing it — while anything that was already there survives.
    const _prevEvents = (DB._eventQueue && DB._setEventQueue) ? DB._eventQueue().slice() : null;
    try {
      if (hasData(backup.data)) App.data = backup.data;
      if (hasData(backup.inventoryData)) App.inventoryData = backup.inventoryData;
      if (hasData(backup.laborData))     App.laborData     = backup.laborData;
      if (hasData(backup.shiftData))     App.shiftData     = backup.shiftData;
      // Settings FIRST, and gated. Nothing may reach the server until one write is CONFIRMED.
      // The cash-config setters used to run here, before any must() — so a restore that then
      // aborted left the account on its OLD data carrying the BACKUP's opening balance, tax rate
      // and credit line. Partial application of exactly the values an operator reads as truth.
      await must('settings', App.save());
      // The core blob is now the backup's, INCLUDING account_state (the cash config). Every
      // abort past this line has to say so rather than promise the account is untouched.
      done.push('settings and cash setup');
      if (backup.cashConfig && window.CashEngine) {
        // AWAITED because these write through acctSet -> saveKey -> writeData, and _applyBackup
        // closes the _allowReset window in a finally; fire-and-forget could leave them in flight
        // past that point, where the total-wipe backstop would block them and the restored
        // account would silently keep the CURRENT cash config instead of the backup's.
        const cc = backup.cashConfig, CE = window.CashEngine;
        await CE.setOpeningCash(cc.opening_cash);
        await CE.setSalesTaxRate(cc.sales_tax_rate);
        await CE.setTaxFrequency(cc.tax_frequency);
        await CE.setPayrollBurden(cc.payroll_burden);
        await CE.setReserveWeeks(cc.reserve_weeks);
        await CE.setAvailableCredit(cc.available_credit);
        await CE.setGiftCardLiability(cc.gift_card_liability);
      }
      // Each blob save is checked BEFORE the matching seedEventStores clears that module's rows.
      // seedEventStores is checked too: it clearEvents() FIRST and then reseeds, so a failure
      // after the clear leaves that module's rows deleted and not replaced. Its result was being
      // discarded across all 64 record kinds in the four event tables — weeks, audits, the
      // product master, the staff roster, permits, menu items — and the operator was still told
      // "Backup restored." We cannot roll the clear back, so the honest thing is to stop and say
      // which module is incomplete rather than report success over it.
      const seed = async (mod, label) => {
        const r = await App.seedEventStores(mod);
        if (r && r.ok === false) {
          DB.logClientError('restore_aborted', 'Restore failed while writing ' + label + ' records', 'mod=' + mod);
          // seed() only ever runs after must('settings') succeeded, so something is always
          // already applied here. Name it rather than saying "your other data is intact", which
          // was never true at this point.
          throw new Error('your ' + label + ' records did not finish writing. Already restored from the backup: '
            + (done.join(', ') || 'settings and cash setup')
            + '. This account is part-way between the backup and where it was. Reloading — run the restore again before entering anything new.');
        }
      };
      // Each module is recorded only once its rows are actually reseeded, so `done` never claims
      // a section that a later abort left half-applied.
      await must('inventory config', App.saveInventory());
      await seed('ic', 'Inventory');
      done.push('Inventory');
      await must('labor config', App.saveLabor());
      await seed('lc', 'Labor');
      done.push('Labor');
      await must('shift config', App.saveShift());
      await seed('sc', 'Shift');
      done.push('Shift');
      await seed('core', 'Recovery');   // recovery event logs -> core_events rows
      done.push('Recovery');
    } catch (e) {
      // ALWAYS revert all four. Round 4 made this conditional on `committed`, reasoning only about
      // the core blob — but all four objects are swapped at the top of the try, so once a commit
      // had happened the operator was left with memory holding the BACKUP's product master,
      // roster, weeks and audits while the server still held their LIVE ic/lc/sc rows. Adding one
      // product from that screen wrote a real row against the live list and pushed the backup's
      // config over theirs, and nothing converged afterwards. The memory/server divergence that
      // change was trying to avoid is handled by the reload below instead.
      App.data = _prev.d; App.inventoryData = _prev.i;
      App.laborData = _prev.l; App.shiftData = _prev.s;
      // Undo whatever a FAILED write STAGED for later replay. writeData and _writeControl each do
      // _localWrite + _markPending BEFORE returning failure, so without this the backup's blob
      // sits in localStorage on the pending queue and syncPending pushes it the moment the session
      // recovers — bypassing writeData, _dataReady, _allowReset and the total-wipe backstop, and
      // landing well AFTER the operator was told the restore had not happened. That is how "could
      // not write settings, nothing was changed" ended with the backup's opening cash and credit
      // line on a live account. The preflight guarantees this queue started empty, so restoring
      // the snapshot is an exact undo rather than a guess.
      // CLEAR THE EVENT QUEUE FIRST. Anything in it is THIS restore's rows: the preflight refuses
      // to start while anything is queued, and seedEventStores retries a failed putEventsBulk
      // three times with EVERY failed attempt calling queueAll() — so one transient blip parks
      // the whole backup there even when the retry then succeeds. Leaving those rows meant the
      // abandoned backup replayed into the live account at an arbitrary later date. Cleared
      // BEFORE the blob list is restored, because _pendingList now derives an 'events' entry from
      // this queue — restoring an empty list first would leave that entry synthesised right back.
      if (_prevEvents) { try { DB._setEventQueue(_prevEvents); } catch (_) {} }
      if (_prevPending) { try { DB._setPendingList(_prevPending); } catch (_) {} }
      // A committed blob cannot be un-written, so memory and the server may still disagree. Only a
      // reload settles that; the callers paint the message first, then reload.
      e.restoreNeedsReload = true;
      throw e;
    }
  },

  // Save a snapshot right now (the owner "Back up now" button). Returns true on success.
  async backupNow() {
    // Never store a snapshot the account can't be restored FROM. A capture taken before the
    // load confirmed the account (or of an account with no records) becomes an indistinguishable
    // one-click "restore" target in the list that would wipe the bar. _applyBackup refuses such
    // a snapshot too; refusing to create it keeps it out of the list in the first place.
    // ⚠ ...and refuse a DEGRADED load — the same guard _maybeAutoBackup carries. If any event kind
    // fell back to the offline cache or a truncated page this session (DB._loadDegraded), the
    // some()-based record test still passes on one populated array while others are silently short;
    // capturing that and later restoring it deletes the missing kinds under "Backup restored". The
    // manual button was the twin the auto-backup guard missed.
    if (!DB._dataReady || !this._sectionHasRecords(App.data) || DB._loadDegraded) {
      this._backupMsg(DB._loadDegraded
        ? 'Your account did not fully load this session. Reload before backing up so the snapshot is complete.'
        : 'Nothing to back up yet — your account data is still loading. Try again in a moment.', 'var(--red)');
      return false;
    }
    this._backupMsg('Saving a backup...', 'var(--t3)');
    const r = await DB.saveBackup(this._buildBackup(), 'manual');
    this._backupMsg((r && r.ok) ? 'Backup saved.' : 'Could not save the backup. Try again.',
      (r && r.ok) ? 'var(--gold)' : 'var(--red)');
    return !!(r && r.ok);
  },

  // Restore a stored server snapshot by id (from the automatic-backup list on Data and Backup).
  async restoreSnapshot(id, whenLabel) {
    const ok = await App.confirm({
      title: 'Restore your account to ' + (whenLabel || 'this backup') + '?',
      message: 'This replaces every record currently in your account with that backup: settings, weekly numbers, audits, and all Inventory, Labor, and Shift Control data. It cannot be undone.',
      confirmText: 'Restore', cancelText: 'Cancel'
    });
    if (!ok) return;
    this._backupMsg('Restoring backup...', 'var(--t3)');
    try {
      const backup = await DB.getBackup(id);
      if (!backup || backup._backup !== 'barcop' || !backup.data) {
        this._backupMsg('That backup could not be read.', 'var(--red)'); return;
      }
      await this._applyBackup(backup);
      this._backupMsg('Backup restored. Reloading...', 'var(--gold)');
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      this._backupMsg('Restore failed: ' + (e.message || 'unknown error'), 'var(--red)');
      // A restore that got as far as writing leaves memory and the server possibly disagreeing —
      // a committed blob cannot be un-written. Reload so what is on screen is what is on the
      // server. Longer than the success reload so the failure is actually readable. PREFLIGHT
      // refusals do not set this flag: nothing ran, so there is nothing to settle.
      if (e && e.restoreNeedsReload) setTimeout(() => window.location.reload(), 2500);
    }
  },

  // Remove every per-period "done" stamp from the ACCOUNT blob (S72). Stored in
  // App.data.account_state via App.acctSet, so a localStorage sweep never touched them.
  // ⚠ TWO KEY PREFIXES, NOT ONE (S172). The six cockpits key `<mod>_cockpit_done_<week>`, and Books
  // Home keys `books_close_done_<month>` (hub-books-home.js:40) — the same per-period done-map
  // class, a different prefix. Both must clear or the Books close flow keeps a phantom done count
  // after a demo re-seed. Nothing else in account_state (recovery targets, cash config, saved
  // import maps) is disturbed — every done-map key carries `_done_`, no other account key does.
  _clearCockpitStamps() {
    try {
      const s = (App.data && App.data.account_state) || null;
      if (!s) return;
      Object.keys(s).forEach(k => {
        if (k.indexOf('cockpit_done_') !== -1 || k.indexOf('books_close_done_') !== -1) delete s[k];
      });
    } catch (e) {}
  },

  async loadSample() {
    // Destructive + dev-only. The live demo (App.startDemo, demoMode) reseeds silently and
    // the real-account Testing Tools button is dev-gated in the UI — refuse any OTHER caller
    // (e.g. a pasted console call on a real account) so this seed/wipe can't run for a
    // customer. Defense in depth over the UI-render gate.
    if (!App.demoMode && !(App.isDevAccount && App.isDevAccount())) return { ok: false };
    // The LIVE DEMO (App.startDemo) also calls loadSample with App.demoMode set, and must
    // seed SILENTLY with no dialog (there is no user to click confirm). Only the real-
    // account Testing Tools button confirms. Gating on demoMode keeps the demo working.
    if (!App.demoMode) {
      const ok = await App.confirm({
        title: 'Load sample data?',
        message: 'This replaces ALL data in this account with the demo bar (The Anchor Bar & Kitchen). Any real data in this account is overwritten, and this cannot be undone.',
        confirmText: 'Load sample data',
        cancelText: 'Cancel'
      });
      if (!ok) return;
    }
    const msg = document.getElementById('ua-test-msg');
    if (msg) { msg.style.color = 'var(--gold)'; msg.textContent = 'Loading sample data...'; msg.style.display = 'block'; }
    // NOTE: the total-wipe backstop stays ON during seeding (no _allowReset here). The seed
    // builds arrays in memory and persists the POPULATED blob at the end (App.save below), so
    // the backstop passes; any intermediate all-empty write is harmlessly blocked. This means
    // an interrupted re-seed can NEVER leave the account empty — the protection is never off.

    // Deterministic pseudo-random for ALL sample data. The demo must load the same
    // every time: same reload => same numbers => same audit scores AND the same
    // recoverable dollar. Math.random would reseed the server checks, cash
    // variances, and inventory usage on every reload, which drifted the live
    // audit's gap math (the recoverable "a year" changed on each Re-Load even
    // though nothing the operator did had changed). This fixed-seed generator
    // keeps the spread realistic while staying identical run to run. Called in a
    // fixed order through loadSample, so the sequence is stable.
    const rnd = (() => { let s = 987654321; return () => { s = (1103515245 * s + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();

    // Drop the cockpit's per-week "done" stamps so a fresh sample does not inherit phantom step
    // checks from a prior session. ⚠ THESE LIVE IN App.data.account_state, NOT localStorage (S72):
    // the six cockpits stamp through App.acctSet, which writes the account blob, and acctGet has no
    // localStorage fallback. loadSample never reassigns App.data (only clearAll and the restore
    // paths do), so account_state SURVIVES a re-seed, and the seed re-stamps only the CURRENT
    // week's cash keys — leaving a prior session's pf_/rev_/ic_/lc_/sc_ checks on OTHER weeks
    // ticked in the fresh sample, visible in the public rolling re-seed demo. The old line here
    // swept localStorage and therefore cleared nothing.
    this._clearCockpitStamps();
    // Same reason, and it bites harder: Build Schedule keeps an unsaved draft on the
    // device (lc_sched_draft) holding a week_start and shifts keyed by staff_id. Every
    // seed mints NEW staff ids, so a draft from a prior session survives with shifts
    // that match nobody: the screen resumes it, pins itself to that OLD week, and every
    // cell renders empty (the grid matches a cell by sh.staff_id === staff.id), with
    // Scheduled showing only the salaried GM. Clear it so a fresh sample lands on the
    // current week's posted schedule.
    try { localStorage.removeItem('lc_sched_draft'); } catch (e) {}

    // Cash Recovery device-local config (opening balance, tax rate, reserve). These
    // live on the device, not in App.data, so the sample sets them here to light up
    // the survival forecast, Cash Position, and Safe to Spend. The Anchor runs a
    // realistic operating balance for a roughly $1M bar: profitable but cash-tight,
    // the exact bar Cash Recovery is built for.
    // Through CashEngine's setters so these land on the account-scoped keys (the
    // demo scopes to 'demo'); writing raw keys would leak across bars / signups.
    try {
      if (window.CashEngine) {
        CashEngine.setOpeningCash(45000);
        CashEngine.setSalesTaxRate(8.25);
        CashEngine.setTaxFrequency('monthly');
        CashEngine.setReserveWeeks(8);
        CashEngine.setAvailableCredit(40000);
        CashEngine.setGiftCardLiability(6500);
      }
    } catch (e) {}

    // A history of closed-out weeks so the demo shows the operator has been doing
    // the weekly Cash close, not starting cold. The Close The Week step-done marks live
    // on the account now (App.acctSet); seed the last eight weeks fully closed and leave
    // the current week open so there is work to do.
    try {
      const _mon = (d) => { const x = new Date(d); const wd = x.getDay(); x.setDate(x.getDate() + (wd === 0 ? -6 : 1 - wd)); return App.ymdLocal(x); };
      const _curMon = _mon(new Date());
      for (let w = 1; w <= 8; w++) {
        const m = new Date(_curMon + 'T00:00:00'); m.setDate(m.getDate() - 7 * w);
        App.acctSet('cash_cockpit_done_' + App.ymdLocal(m), { trapped: true, week: true, terms: true, audit: true });   // keys must match CashDashboard.ORDER ['trapped','week','terms','audit']; 'order' was bogus and 'audit' was missing
      }
      // Control sections, current week mid-close: the first two close steps are
      // done, the last two still to do. Keyed to each page's own done-key (the
      // current week), so it rolls forward week to week with no stale dates.
      // Cockpit steps are now purely operator-marked (nothing auto-derives), so
      // the sample must stamp its own mid-close state for every cockpit or the
      // demo would read 0/4 everywhere. Each = most of the week's steps done, the
      // last one or two still open so there is visible work to do.
      if (window.S) {
        /* ⚠ `orders` IS NOT STAMPED (2026-08-02, Kyle spotted it in the demo). It used to be, and
           the same step renders "$3,988.05 to reorder, 6 vendors" from the seeded below-par stock —
           so the demo showed a green tick on "Place your orders" sitting directly beside four
           thousand dollars of ordering still to do, in one row, on the page a prospect sees first.
           A seeded done-stamp is a CLAIM about what the sample operator has already done, and it
           has to agree with the data seeded beside it ([[demo-coherence-over-accuracy]]).
           ⚠ The app was never wrong here: the tick is the operator's manual call and the subtitle
           reads live data, exactly as [[cockpit-steps-manual]] intends. Only the sample lied.
           Inventory now opens 2 of 4 with ordering and the flag review still to do, which is also
           the shape Shift and Cash already seed. */
        if (S.InventoryDashboard) App.acctSet(S.InventoryDashboard._doneKey(), { count: true, deliveries: true });
        if (S.LaborDashboard)     App.acctSet(S.LaborDashboard._doneKey(),     { hours: true, tips: true, schedule: true });
        if (S.ShiftDashboard)     App.acctSet(S.ShiftDashboard._doneKey(),     { import: true, cash: true });
        // Profit + Revenue: no stamp. Their step 1 (Confirm the Week) now derives
        // its done-state from the confirmed-week record, and the current in-progress
        // week has none yet, so the cockpit honestly opens on "Confirm the Week".
        // (costs/numbers can't be reviewed until the week is confirmed, so nothing
        // downstream is pre-marked either.)
        if (S.CashDashboard)      App.acctSet(S.CashDashboard._doneKey(),      { trapped: true, week: true });
      }
    } catch (e) {}

    const uid = () => App.uid();
    const today = new Date();
    const dateStr = (daysAgo) => { const d = new Date(today); d.setDate(d.getDate() - daysAgo); return App.ymdLocal(d); };
    // ── THE CURRENT WEEK RUNS AHEAD OF TODAY, ON PURPOSE. Disclosed, not hidden. ──
    // The demo seeds the current week WHOLE (all 7 days of sales, hours and shifts),
    // even though only part of it has happened. That is deliberate and it is stated in
    // the demo banner ("this week's data runs through the full week").
    // WHY, because this was tried the other way and it was worse: the app's current
    // week is Mon..NEXT Sunday (App.nextSunday()), so it is NEVER complete on any day.
    // Seeding only the ELAPSED days looks honest and then falls apart, because the rest
    // of the week's numbers do not shrink with it. COGS comes from an inventory COUNT
    // PAIR spanning a full 7 days, so a part-week's revenue against a whole week's COGS
    // put PRIME COST at 91.7% and LABOR at 37.4% on the Confirm the Week popup. The
    // cockpit's done stamps are manual by design and cannot derive from data
    // ([[cockpit-steps-manual]]), so they read "week imported" over a Monday with almost
    // nothing in it. A demo that is date-accurate and internally incoherent is worse
    // than one that runs a few days ahead and says so.
    // KEEP THE WEEK WHOLE. If you gate these days again, you own prime cost too.

    // ── Settings ──
    App.data.settings.bar_name           = 'The Anchor Bar & Kitchen';
    // ⚠ FAKE ON PURPOSE. These ship in the public demo and print on exported PDFs, so they must
    // not resolve to a real business: "1900 Barton Springs Rd" was a real Austin address. 555-5555
    // and a plainly invented street keep the demo obviously fictional (Kyle, 2026-08-01).
    App.data.settings.phone              = '(512) 555-5555';
    App.data.settings.address            = '1111 East Street';
    App.data.settings.city_state         = 'Austin, TX';
    App.data.settings.annual_bar_revenue = 624000;
    App.data.settings.annual_food_revenue= 374400;
    App.data.settings.targets = { bar_pour_cost_pct:22, food_cost_pct:32, labor_cost_pct:30, prime_cost_pct:60 };
    App.data.settings.onboarding_complete= true;
    // The Anchor's own services (a craft cocktail bar + bistro): Lunch, Happy Hour
    // (a Custom, since it is no longer a standard preset), Dinner, Late Night — no
    // Breakfast. Feeds SHIFT_TYPES app-wide + the Pre-Shift Briefing daypart chips.
    App.data.settings.service_periods = [
      { id:'sp_anchor_lunch',  name:'Lunch',      start:'11:00', end:'16:00' },
      { id:'sp_anchor_hh',     name:'Happy Hour', start:'15:00', end:'18:00', custom:true },
      { id:'sp_anchor_dinner', name:'Dinner',     start:'16:00', end:'22:00' },
      { id:'sp_anchor_late',   name:'Late Night', start:'22:00', end:'02:00' }
    ];


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
    // ⚠ `|| 7` — TREAT SUNDAY AS 7, NOT 0 (S73). getDay() is 0 on a Sunday, which made the newest
    // seeded confirmed week (dateStr(sunOff)) land on TODAY = this Sunday = nextSunday(), so the
    // Profit/Revenue cockpits opened with "Confirm the Week" already ticked, and curBaseAgo
    // (sunOff - 7 = -7) put the current-week daily seed on NEXT Sunday's week instead of this one.
    // With 7, the newest confirmed week is LAST Sunday and curBaseAgo becomes 0 = today, aligning
    // the current-week seed with nextSunday(). No-op Mon-Sat (getDay() 1..6 are truthy).
    // ⛔ NOT the S27e trap: that `|| 7` was on nextSunday's `(7 - getDay()) % 7` and pushed the
    // week-END a week FORWARD. This is on the seed's days-since-Sunday reference and makes the seed
    // AGREE with the already-correct nextSunday(). Removing it re-opens the bug.
    const sunOff = new Date(App.todayLocal() + 'T00:00:00').getDay() || 7;
    const weeks = window.ANCHOR.weeks.map(a => {
      const endDate = dateStr(sunOff + window.ANCHOR.endAgo(a));
      // Merch and vending as Other on every fourth week, plus weekly 3rd-party platform
      // fees (~4.5% of food revenue), so the Books income statement is non-zero + real.
      // Catering is deliberately NOT seeded on historical weeks: in the live app
      // catering revenue is derived ONLY from Completed offsite catering bookings
      // (cateringFromBookings), so a seeded catering figure with no backing booking is
      // income a real operator could not produce and would zero out on a re-confirm.
      // Demo catering is shown honestly via the Completed "Westlake Realty Lunch
      // Catering" booking (current week) + the Events section.
      const othRev = (a.wk % 4 === 0) ? 180 + (a.wk % 3) * 60 : 0;
      return { id:uid(), week_num:a.wk, period_end:endDate, saved_at:new Date().toISOString(),
        bar:{ revenue:a.bar_rev, cogs:a.bar_cogs, labor:a.bar_labor, cost_pct:a.bar_pour_pct,
              labor_pct:a.bar_labor/a.bar_rev*100, vs_target_pct:a.bar_pour_pct-22, vs_target_dollar:((a.bar_pour_pct-22)/100)*a.bar_rev },
        food:{ revenue:a.food_rev, cogs:a.food_cogs, labor:a.food_labor, cost_pct:a.food_cost_pct,
               labor_pct:a.food_labor/a.food_rev*100, vs_target_pct:a.food_cost_pct-32, vs_target_dollar:((a.food_cost_pct-32)/100)*a.food_rev },
        catering: { revenue:0, cogs:0, labor:0, cost_pct:0, labor_pct:0 },
        other:{ revenue:othRev, cogs:+(othRev*0.45).toFixed(2) },
        platform_fees:+(a.food_rev*0.045).toFixed(2),
        prime_cost_pct:a.prime_cost_pct, notes:'' };
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
        operatingExpenses.push({ id:uid(), date:mk + '-05', category:cat, amount:+(amt * (0.95 + rnd() * 0.1)).toFixed(2), vendor:'', notes:'' });
      });
    });
    // Two ongoing recurring bills (recur every month until cancelled, no fixed
    // term). Both were entered when the operator set up Books at the start of the
    // 90-day window; Bar Cop fills in each elapsed month on load.
    const monthAnchor = (back, day) => App.ymdLocal(new Date(today.getFullYear(), today.getMonth() - back, day));
    operatingExpenses.push(
      { id:uid(), date:monthAnchor(2, 5), category:'Software and Subscriptions', vendor:'Bar Cop', amount:189, notes:'Monthly software subscription.', recurring:true, recur_day:5, created_at:new Date().toISOString() },
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
    /* ⭐ THE SEED IS A WRITE PATH TOO — PHASE 1 STEP 7 OF THE ONE-LEDGER REBUILD. Every dollar out
       belongs in the ledger, and these five arrive by a door the one-time migration cannot see: it
       marks itself done on the first login, so a LATER re-seed would mint five fresh outflow ids
       that never reach `operating_expenses` and simply vanish at the cutover. Built with the SAME
       mapping every other door uses, and pushed before `seedEventStores('core')` below so they
       persist with everything else.
       ⚠ Guarded like the Bar Cop Audit block above rather than called bare, because there IS a
       backstop here: `reconcileCashOutflowLedger` runs on the next load and adds anything missing.
       Doing it inline as well is what makes the DEMO right, which never reloads. */
    if (window.S && S.HubOperatingExpenses && S.HubOperatingExpenses.migrateCashOutflowRow) {
      App.data.cash_outflows.forEach(o => {
        const led = S.HubOperatingExpenses.migrateCashOutflowRow(o);
        if (led) App.data.operating_expenses.push(led);
      });
    }

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


    // ── Sample Audit Records (Profit + Revenue) ──
    // Three months of audits each, telling The Anchor Bar's recovery story.
    const daysAgoISO = (n) => new Date(Date.now() - n*24*60*60*1000).toISOString();
    const mkAudit = (mod, p) => {
      const d = p.raw;
      // Weekly fills carry interpolated numbers but no authored narrative. Generate
      // the same 3-line findings the live audits use so every seeded audit reads the
      // same; the milestones already carry their authored narrative, so skip those.
      if (!d.S1_NARRATIVE && window.AuditNarrative) {
        Object.assign(d, mod === 'profit' ? AuditNarrative.profitNarrative(d) : AuditNarrative.revenueNarrative(d));
      }
      const sections = {};
      const items = [];
      if (mod === 'profit') {
        if (d.S1_SCORE != null) sections['Pour and Bar Cost']    = d.S1_SCORE;
        if (d.S2_SCORE != null) sections['Food Cost']            = d.S2_SCORE;
        if (d.S3_SCORE != null) sections['Shrink and Waste']     = d.S3_SCORE;
        if (d.S4_SCORE != null) sections['Theft and Cash Loss']  = d.S4_SCORE;
        if (d.S5_SCORE != null) sections['Vendor Cost Control']  = d.S5_SCORE;
        // Recoverable dollars: S1 pour + S2 food (measured cost gaps) + S4 void/comp
        // excess. S3 shrink lives inside S1/S2, S5 exposure is an estimate, so both
        // add $0. Mirrors audit-tracker.js extractActionItems.
        if (d.S1_MONTHLY_GAP > 0) items.push({ action:'Reduce bar pour cost. $'+Math.round(d.S1_MONTHLY_GAP)+'/month gap vs target.', monthly_impact:d.S1_MONTHLY_GAP, gap_id:'pour-cost' });
        if (d.S2_MONTHLY_GAP > 0) items.push({ action:'Reduce food cost. $'+Math.round(d.S2_MONTHLY_GAP)+'/month gap vs target.', monthly_impact:d.S2_MONTHLY_GAP, gap_id:'food-cost' });
        if (d.S4_MONTHLY_GAP > 0) items.push({ action:'Address void and comp rate. $'+Math.round(d.S4_MONTHLY_GAP)+'/month in excess.', monthly_impact:d.S4_MONTHLY_GAP, gap_id:'theft-loss' });
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
      // Carry the string readouts (count frequency, drawer recon, price verify, last
      // price increase, top category) from the nearer milestone so the generated
      // findings on a weekly fill read complete, not "undefined". Those are standalone
      // labels with no numeric twin, so carrying them is honest.
      const near = t >= 0.5 ? hi : lo;
      Object.keys(near).forEach(k => { if (raw[k] == null && typeof near[k] === 'string' && !/_NARRATIVE$|_FINDING$|_TOOL$|^AUDIT_/.test(k)) raw[k] = near[k]; });
      // ── EXCEPT the two coverage readouts, which are not labels: they are a RENDERING
      // of a number that this function just interpolated. Carried from the nearer
      // milestone they contradicted their own twin on every weekly fill: the day-51
      // profit audit read "8 of 18 bar items costed (44%)" beside an interpolated
      // S1_RECIPE_COVERAGE_PCT of 58, so the warn badge disagreed with the sentence next
      // to it. Rebuild both from the interpolated pct instead. The total and the noun are
      // parsed off the milestone rather than hardcoded, so bar items (of 18) and plates
      // (of 24) both keep their own wording.
      [['S1_RECIPE_COVERAGE', 'S1_RECIPE_COVERAGE_PCT'], ['S2_RECIPE_COVERAGE', 'S2_RECIPE_COVERAGE_PCT']]
        .forEach(([sKey, pKey]) => {
          const pct = raw[pKey];
          const m = String(near[sKey] || '').match(/^\d+ of (\d+) (.+) costed \(\d+%\)$/);
          if (typeof pct !== 'number' || !m) return;
          const total = +m[1];
          raw[sKey] = Math.round(pct / 100 * total) + ' of ' + total + ' ' + m[2]
                    + ' costed (' + Math.round(pct) + '%)';
        });
      raw.BAR_NAME = lo.BAR_NAME || 'The Anchor Bar & Kitchen';
      raw.DATA_TIER_LABEL = near.DATA_TIER_LABEL || 'Bar Cop operating data';
      return raw;
    };
    const ANCH_DAYS = [0, 30, 60, 90];
    const FILL_DAYS = [7, 14, 21, 37, 44, 51, 67, 74, 81];
    // ── Natural weekly OVERALL-score paths (keyed by daysAgo) ──────────────────
    // A real weekly audit does not climb a flat +2 every week. These hand-authored
    // sequences hit the reconciled milestones (90/60/30/0) but wander between them:
    // varied jumps, a few genuine backslides (a week that goes down), heaviest in
    // the first month. Deterministic, so the demo is stable.
    const OVERALL_PATH = {
      profit:  { 90:33, 81:36, 74:33, 67:39, 60:44, 51:48, 44:45, 37:52, 30:58, 21:62, 14:59, 7:65, 0:70 },
      revenue: { 90:39, 81:41, 74:39, 67:44, 60:48, 51:51, 44:49, 37:53, 30:56, 21:59, 14:57, 7:61, 0:64 },
      cash:    { 90:42, 81:45, 74:43, 67:48, 60:52, 51:55, 44:54, 37:58, 30:62, 21:65, 14:63, 7:67, 0:70 }
    };
    // ── Data-quality ramp: which section indices have real data by daysAgo ─────
    // A new operation cannot score every section on day one. Early audits read
    // Partial/Limited as Control captures more each week; sections not listed for
    // a day are pruned (read N/A). Days not present here have full coverage.
    // profit idx: 0 Pour, 1 Food, 2 Shrink, 3 Theft, 4 Vendor
    // revenue idx: 0 Check, 1 Labor, 2 Menu, 3 Server, 4 Events
    // cash idx: 0 Capital, 1 Cycle, 2 Liquidity, 3 Terms
    const SECTIONS_PRESENT = {
      profit:  { 90:[0,1], 81:[0,1,3], 74:[0,1,3,4], 67:[0,1,2,3,4] },
      revenue: { 90:[0,1], 81:[0,1,2], 74:[0,1,2], 67:[0,1,2,3] },
      cash:    { 90:[0,1], 81:[0,1], 74:[0,1,2], 67:[0,1,2] }
    };
    // Map an action-item gap_id back to its section index, so a pruned section's
    // recoverable item is dropped too (no dollar for a section that reads N/A).
    const GAP_SEC = {
      profit:  { 'pour-cost':0, 'food-cost':1, 'theft-loss':3, 'vendor-control':4 },
      revenue: { 'check-average':0, 'labor-scheduling':1, 'menu-engineering':2, 'server-performance':3, 'events-catering':4 },
      cash:    { 'free-trapped':0, 'order-to-par':1, 'stay-ahead':2, 'pay-on-terms':3 }
    };
    const SEC_NAMES = {
      profit:  ['Pour and Bar Cost','Food Cost','Shrink and Waste','Theft and Cash Loss','Vendor Cost Control'],
      revenue: ['Check Average and Revenue','Labor Efficiency','Menu Performance','Server Performance','Events and Private Dining'],
      cash:    (window.S && S.CashAudit) ? S.CashAudit.SECTION_NAMES : ['Capital Efficiency','Cash Conversion Cycle','Liquidity & Runway','Payment Terms']
    };
    /* ⛔ THE CASH AUDIT'S METRIC KEYS ARE NOT `S<n>_`-PREFIXED, so the prune below could never
       reach them. Profit and Revenue name every display field `S1_...`, `S2_...`; Cash names
       them for what they are (`TRAPPED_CASH`, `RUNWAY`, `VENDORS_ON_TERMS`). The prune deleted
       the section's SCORE and FINDINGS and left every metric row populated, so a demo visitor
       opening an early audit saw:
         SECTION 3  Liquidity & Runway   N/A  "Not enough data"
                    Tight Weeks Ahead 2 · Runway 6 wks · Low Point $3,200 · Safe to Spend $4,200
       — "not enough data" printed directly above four populated figures. The live code cannot
       produce that state (_computeAudit nulls each of these whenever its section is null), so
       it was seed-only, but every demo visitor could reach it.
       Mirrors _computeAudit's raw block, section for section. */
    const RAW_KEYS = {
      cash: {
        0: ['TRAPPED_CASH', 'INVENTORY_VALUE', 'DEAD_STOCK', 'OVERSTOCK', 'BLENDED_TURNS', 'BLENDED_GMROI', 'LAZY_CATS'],
        1: ['DIO', 'DPO', 'CYCLE_DAYS', 'LOCKED_CASH', 'DAILY_COGS'],
        2: ['TIGHT_WEEKS', 'RUNWAY', 'HAS_OPENING', 'OPENING_CASH', 'END_BALANCE', 'LOW_POINT_BAL', 'LOW_POINT_WEEK', 'SAFE_TO_SPEND'],
        3: ['VENDORS_ON_TERMS', 'TOTAL_VENDORS', 'WEIGHTED_DPO']
      }
    };
    const weeklySeries = (mod, richByDay) => {
      const PFX = mod === 'profit' ? 'PFA' : mod === 'revenue' ? 'RFA' : 'CA';
      const NSEC = mod === 'cash' ? 4 : 5;
      const path = OVERALL_PATH[mod] || {}, present = SECTIONS_PRESENT[mod] || {};
      const names = SEC_NAMES[mod], gapSec = GAP_SEC[mod] || {};
      // Pass 1: assemble every record (anchors pre-built; fills interpolated from
      // the UNPRUNED anchor raws, so no null score poisons the interpolation).
      const recByDay = {};
      ANCH_DAYS.forEach(d => { recByDay[d] = richByDay[d]; });
      FILL_DAYS.forEach(D => {
        const hiD = ANCH_DAYS.filter(d => d < D).sort((a, b) => b - a)[0];   // newer milestone (fewer days ago)
        const loD = ANCH_DAYS.filter(d => d > D).sort((a, b) => a - b)[0];   // older milestone (more days ago)
        const raw = ipRaw(richByDay[loD].raw, richByDay[hiD].raw, (loD - D) / (loD - hiD));
        const id = PFX + '-2026-' + String(++_ipSerial).padStart(4, '0');
        raw.AUDIT_ID = id; raw.AUDIT_PERIOD = periodLabel(D);
        recByDay[D] = (mod === 'cash')
          ? mkCashAudit(dateStr(D), daysAgoISO(D), id, periodLabel(D), raw)
          : mkAudit(mod, { date: dateStr(D), generated_at: daysAgoISO(D), raw });
      });
      // Pass 2: overlay the natural overall path, then prune to the data-quality
      // ramp (drop the section + its raw score + any recoverable item it fed).
      const days = ANCH_DAYS.concat(FILL_DAYS);
      days.forEach(D => {
        const rec = recByDay[D];
        if (path[D] != null) { rec.overall_score = path[D]; if (rec.raw) rec.raw.OVERALL_SCORE = path[D]; }
        const keep = present[D];
        if (keep) {
          for (let i = 0; i < NSEC; i++) {
            if (keep.indexOf(i) === -1) {
              delete rec.sections[names[i]];
              // Remove the whole section from the raw (score + findings), so the
              // full view shows a clean N/A, not N/A next to a written finding.
              if (rec.raw) Object.keys(rec.raw).forEach(k => { if (k.indexOf('S' + (i + 1) + '_') === 0) delete rec.raw[k]; });
              // ...and the unprefixed METRIC keys, which the prefix rule cannot see. See the
              // RAW_KEYS note above: without this the section reads N/A over populated rows.
              const mk = (RAW_KEYS[mod] || {})[i];
              if (rec.raw && mk) mk.forEach(k => { delete rec.raw[k]; });
            }
          }
          rec.action_items = (rec.action_items || []).filter(a => {
            const si = gapSec[a.gap_id];
            return si == null || keep.indexOf(si) !== -1;
          });
        }
      });
      return days.map(D => recByDay[D]);
    };

    // ── Profit Audits ──
    App.data.audits = weeklySeries('profit', {
      90: mkAudit('profit', { date: dateStr(90), generated_at: daysAgoISO(90), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 33,
        DATA_TIER_LABEL: 'Bar Cop operating data',
        AUDIT_PERIOD: periodLabel(90), AUDIT_ID: 'PFA-2026-0029',
        INDUSTRY_AVG: 63, TARGET_SCORE: 70,
        S1_SCORE: 32, S1_BAR_COST_PCT: 30.5, S1_TARGET_PCT: 22, S1_BAR_REV_MONTHLY: 45950,
        S1_BEV_COGS_PERIOD: 14015, S1_RECIPE_COVERAGE: '0 of 18 bar items costed (0%)', S1_RECIPE_COVERAGE_PCT: 0,
        S1_MONTHLY_GAP: 3906, S1_ANNUAL_GAP: 46872,
        S2_SCORE: 30, S2_FOOD_COST_PCT: 40.5, S2_TARGET_PCT: 32, S2_FOOD_REV_MONTHLY: 27600,
        S2_RECIPE_COVERAGE: '0 of 24 plates costed (0%)', S2_RECIPE_COVERAGE_PCT: 0,
        S2_MONTHLY_GAP: 2346, S2_ANNUAL_GAP: 28152,
        S3_SCORE: 28, S3_INV_VARIANCE_DOLLAR: 3000, S3_INV_VARIANCE_PCT: 7.1, S3_COUNT_FREQ: 'Monthly or less',
        S3_COUNTS_IN_PERIOD: 1, S3_SPOT_CHECKS: 0, S3_SPOT_VARIANCE_DOLLAR: 0, S3_WASTE_TOTAL: 480, S3_SHRINK_PERIOD: 3480, S3_MONTHLY_GAP: 0,
        S4_SCORE: 24, S4_VOID_COMP_PCT: 4.6, S4_VOID_COMP_AMT: 3820, S4_VOIDS_NO_APPROVAL_PCT: 71,
        S4_CASH_SHORT_RATE_PCT: 35, S4_DRAWER_RECON: 'Not documented', S4_WALKED_TABS_TOTAL: 1200, S4_WALKED_TABS_COUNT: 14,
        S4_SALES_INTEGRITY_FLAGS: 2, S4_MONTHLY_GAP: 1912, S4_ANNUAL_GAP: 22944,
        S5_SCORE: 40, S5_DELIVERIES_LOGGED: 0, S5_VENDOR_PRICE_CHANGES: 0, S5_VENDOR_SPEND_MONTHLY: 29400,
        S5_PRICE_VERIFY: 'Not documented', S5_UNCOLLECTED_CREDITS: 0, S5_RECOVERED_CREDITS: 0, S5_OPEN_CREDIT_COUNT: 0,
        S5_EXPOSURE_MONTHLY: 882, S5_EXPOSURE_ANNUAL: 10584,
        PRIME_COST_PCT: 67.0, PRIME_TARGET_PCT: 60, PRIME_COST_AMT: 49278, PRIME_LABOR_PCT: 32.5,
        PRIME_LABOR_PERIOD: 23904, PRIME_TOTAL_REV_PERIOD: 73550, PRIME_TOTAL_COGS_PERIOD: 25200
      }}),
      60: mkAudit('profit', { date: dateStr(60), generated_at: daysAgoISO(60), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 44,
        DATA_TIER_LABEL: 'Bar Cop operating data',
        AUDIT_PERIOD: periodLabel(60), AUDIT_ID: 'PFA-2026-0034',
        INDUSTRY_AVG: 63, TARGET_SCORE: 70,
        S1_SCORE: 44, S1_BAR_COST_PCT: 28.0, S1_TARGET_PCT: 22, S1_BAR_REV_MONTHLY: 47600,
        S1_BEV_COGS_PERIOD: 13328, S1_RECIPE_COVERAGE: '8 of 18 bar items costed (44%)', S1_RECIPE_COVERAGE_PCT: 44,
        S1_MONTHLY_GAP: 2856, S1_ANNUAL_GAP: 34272,
        S2_SCORE: 41, S2_FOOD_COST_PCT: 38.0, S2_TARGET_PCT: 32, S2_FOOD_REV_MONTHLY: 29000,
        S2_RECIPE_COVERAGE: '12 of 24 plates costed (50%)', S2_RECIPE_COVERAGE_PCT: 50,
        S2_MONTHLY_GAP: 1740, S2_ANNUAL_GAP: 20880,
        S3_SCORE: 42, S3_INV_VARIANCE_DOLLAR: 2000, S3_INV_VARIANCE_PCT: 5.0, S3_COUNT_FREQ: 'Every other week',
        S3_COUNTS_IN_PERIOD: 2, S3_SPOT_CHECKS: 1, S3_SPOT_VARIANCE_DOLLAR: 90, S3_WASTE_TOTAL: 360, S3_SHRINK_PERIOD: 2360, S3_MONTHLY_GAP: 0,
        S4_SCORE: 42, S4_VOID_COMP_PCT: 3.4, S4_VOID_COMP_AMT: 2680, S4_VOIDS_NO_APPROVAL_PCT: 45,
        S4_CASH_SHORT_RATE_PCT: 20, S4_DRAWER_RECON: 'Started at close', S4_WALKED_TABS_TOTAL: 900, S4_WALKED_TABS_COUNT: 10,
        S4_SALES_INTEGRITY_FLAGS: 1, S4_MONTHLY_GAP: 1072, S4_ANNUAL_GAP: 12864,
        S5_SCORE: 47, S5_DELIVERIES_LOGGED: 8, S5_VENDOR_PRICE_CHANGES: 1, S5_VENDOR_SPEND_MONTHLY: 29100,
        S5_PRICE_VERIFY: 'Active, 1 price changes caught', S5_UNCOLLECTED_CREDITS: 400, S5_RECOVERED_CREDITS: 200, S5_OPEN_CREDIT_COUNT: 1, S5_CREDIT_RECOVERY_PCT: 33,
        S5_EXPOSURE_MONTHLY: 873, S5_EXPOSURE_ANNUAL: 10476,
        PRIME_COST_PCT: 63.0, PRIME_TARGET_PCT: 60, PRIME_COST_AMT: 48258, PRIME_LABOR_PCT: 31.5,
        PRIME_LABOR_PERIOD: 24129, PRIME_TOTAL_REV_PERIOD: 76600, PRIME_TOTAL_COGS_PERIOD: 24700
      }}),
      30: mkAudit('profit', { date: dateStr(30), generated_at: daysAgoISO(30), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 58,
        DATA_TIER_LABEL: 'Bar Cop operating data',
        AUDIT_PERIOD: periodLabel(30), AUDIT_ID: 'PFA-2026-0040',
        INDUSTRY_AVG: 63, TARGET_SCORE: 70,
        S1_SCORE: 60, S1_BAR_COST_PCT: 25.0, S1_TARGET_PCT: 22, S1_BAR_REV_MONTHLY: 50000,
        S1_BEV_COGS_PERIOD: 12500, S1_RECIPE_COVERAGE: '16 of 18 bar items costed (89%)', S1_RECIPE_COVERAGE_PCT: 89,
        S1_MONTHLY_GAP: 1500, S1_ANNUAL_GAP: 18000,
        S2_SCORE: 55, S2_FOOD_COST_PCT: 35.0, S2_TARGET_PCT: 32, S2_FOOD_REV_MONTHLY: 30000,
        S2_RECIPE_COVERAGE: '20 of 24 plates costed (83%)', S2_RECIPE_COVERAGE_PCT: 83,
        S2_MONTHLY_GAP: 900, S2_ANNUAL_GAP: 10800,
        S3_SCORE: 55, S3_INV_VARIANCE_DOLLAR: 1100, S3_INV_VARIANCE_PCT: 3.2, S3_COUNT_FREQ: 'Weekly',
        S3_COUNTS_IN_PERIOD: 4, S3_SPOT_CHECKS: 3, S3_SPOT_VARIANCE_DOLLAR: 60, S3_WASTE_TOTAL: 300, S3_SHRINK_PERIOD: 1400, S3_MONTHLY_GAP: 0,
        S4_SCORE: 56, S4_VOID_COMP_PCT: 2.2, S4_VOID_COMP_AMT: 1760, S4_VOIDS_NO_APPROVAL_PCT: 18,
        S4_CASH_SHORT_RATE_PCT: 10, S4_DRAWER_RECON: 'Performed at close', S4_WALKED_TABS_TOTAL: 500, S4_WALKED_TABS_COUNT: 6,
        S4_SALES_INTEGRITY_FLAGS: 1, S4_MONTHLY_GAP: 160, S4_ANNUAL_GAP: 1920,
        S5_SCORE: 60, S5_DELIVERIES_LOGGED: 11, S5_VENDOR_PRICE_CHANGES: 2, S5_VENDOR_SPEND_MONTHLY: 28200,
        S5_PRICE_VERIFY: 'Active, 2 price changes caught', S5_UNCOLLECTED_CREDITS: 300, S5_RECOVERED_CREDITS: 500, S5_OPEN_CREDIT_COUNT: 1, S5_CREDIT_RECOVERY_PCT: 63,
        S5_EXPOSURE_MONTHLY: 846, S5_EXPOSURE_ANNUAL: 10152,
        PRIME_COST_PCT: 58.0, PRIME_TARGET_PCT: 60, PRIME_COST_AMT: 46400, PRIME_LABOR_PCT: 30.0,
        PRIME_LABOR_PERIOD: 24000, PRIME_TOTAL_REV_PERIOD: 80000, PRIME_TOTAL_COGS_PERIOD: 23800
      }}),
      0: mkAudit('profit', { date: dateStr(0), generated_at: daysAgoISO(0), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 70,
        DATA_TIER_LABEL: 'Bar Cop operating data',
        AUDIT_PERIOD: periodLabel(0), AUDIT_ID: 'PFA-2026-0046',
        INDUSTRY_AVG: 63, TARGET_SCORE: 70,
        S1_SCORE: 72, S1_BAR_COST_PCT: 23.0, S1_TARGET_PCT: 22, S1_BAR_REV_MONTHLY: 52000,
        S1_BEV_COGS_PERIOD: 11960, S1_RECIPE_COVERAGE: '18 of 18 bar items costed (100%)', S1_RECIPE_COVERAGE_PCT: 100,
        S1_MONTHLY_GAP: 520, S1_ANNUAL_GAP: 6240,
        S2_SCORE: 66, S2_FOOD_COST_PCT: 33.0, S2_TARGET_PCT: 32, S2_FOOD_REV_MONTHLY: 31200,
        S2_RECIPE_COVERAGE: '24 of 24 plates costed (100%)', S2_RECIPE_COVERAGE_PCT: 100,
        S2_MONTHLY_GAP: 312, S2_ANNUAL_GAP: 3744,
        S3_SCORE: 68, S3_INV_VARIANCE_DOLLAR: 620, S3_INV_VARIANCE_PCT: 2.0, S3_COUNT_FREQ: 'Weekly',
        S3_COUNTS_IN_PERIOD: 4, S3_SPOT_CHECKS: 4, S3_SPOT_VARIANCE_DOLLAR: 40, S3_WASTE_TOTAL: 260, S3_SHRINK_PERIOD: 880, S3_MONTHLY_GAP: 0,
        S4_SCORE: 68, S4_VOID_COMP_PCT: 1.5, S4_VOID_COMP_AMT: 1240, S4_VOIDS_NO_APPROVAL_PCT: 8,
        S4_CASH_SHORT_RATE_PCT: 5, S4_DRAWER_RECON: 'Performed at close', S4_WALKED_TABS_TOTAL: 400, S4_WALKED_TABS_COUNT: 6,
        S4_SALES_INTEGRITY_FLAGS: 0, S4_MONTHLY_GAP: 0, S4_ANNUAL_GAP: 0,
        S5_SCORE: 70, S5_DELIVERIES_LOGGED: 12, S5_VENDOR_PRICE_CHANGES: 2, S5_VENDOR_SPEND_MONTHLY: 27600,
        S5_PRICE_VERIFY: 'Active, 2 price changes caught', S5_UNCOLLECTED_CREDITS: 180, S5_RECOVERED_CREDITS: 900, S5_OPEN_CREDIT_COUNT: 1, S5_CREDIT_RECOVERY_PCT: 83,
        S5_EXPOSURE_MONTHLY: 828, S5_EXPOSURE_ANNUAL: 9936,
        PRIME_COST_PCT: 55.0, PRIME_TARGET_PCT: 60, PRIME_COST_AMT: 45760, PRIME_LABOR_PCT: 28.6,
        PRIME_LABOR_PERIOD: 23800, PRIME_TOTAL_REV_PERIOD: 83200, PRIME_TOTAL_COGS_PERIOD: 22600
      }})
    });

    // ── Revenue Audits ──
    App.data.revenue_audits = weeklySeries('revenue', {
      90: mkAudit('revenue', { date: dateStr(90), generated_at: daysAgoISO(90), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 39,
        DATA_TIER_LABEL: 'Bar Cop operating data',
        AUDIT_PERIOD: periodLabel(90), AUDIT_ID: 'RFA-2026-0012',
        INDUSTRY_AVG: 61, TARGET_SCORE: 70,
        S1_SCORE: 38, S1_CHECK_AVG: 35.40, S1_CHECK_AVG_TARGET: 40.00, S1_BAR_CHECK_AVG: 28.40,
        // 73,986 = 35.40 x 2,090. r-audit prints Monthly Revenue, Cover Count and Check
        // Average on the same card, and 73,400 / 2,090 came to $35.12, not the $35.40
        // beside it. Live these foot by construction (the engine derives both from the
        // same weeks), so the seed has to as well.
        S1_FOOD_CHECK_AVG: 41.60, S1_COVER_COUNT: 2090, S1_MONTHLY_REVENUE: 73986,
        // Every S1 gap here foots the LIVE rule (audit-compute.js: gap = (target -
        // check average) x monthly covers, annual = x12), and the audit narrative
        // prints the arithmetic right next to it: "On 2,090 monthly covers, closing
        // that gap is $X a month." They used to be hand-picked and ~3x light, which a
        // prospect could catch in their head. (4.60 x 2,090)
        S1_MONTHLY_GAP: 9614, S1_ANNUAL_GAP: 115368,
        S2_SCORE: 40, S2_LABOR_PCT: 32.5, S2_LABOR_TARGET_PCT: 30, S2_RPLH: 60, S2_RPLH_TARGET: 75,
        S2_LABOR_PERIOD: 23900, S2_MONTHLY_GAP: 1838, S2_ANNUAL_GAP: 22056,
        S3_SCORE: 36, S3_STARS_COUNT: 3, S3_PLOWHORSES_COUNT: 9, S3_DOGS_COUNT: 7, S3_PUZZLES_COUNT: 5,
        S3_TOP_CATEGORY: 'Draft Beer', S3_LAST_PRICE_INCREASE: 'Over a year ago', S3_PRICING_STALE: true, S3_DOG_TESTS_ACTIVE: 1, S3_MONTHLY_GAP: 0,
        S4_SCORE: 42, S4_SERVER_COUNT: 9, S4_TOP_CHECK_AVG: 44.00, S4_BOTTOM_CHECK_AVG: 27.50,
        S4_TEAM_CHECK_AVG: 35.75, S4_PERFORMANCE_SPREAD: 16.50, S4_COMP_PCT: 5.2, S4_COMP_BENCHMARK_PCT: 3, S4_MONTHLY_GAP: 3200,
        S5_SCORE: 39, S5_EVENT_REV_PERIOD: 2400, S5_EVENTS_PER_MONTH: 1, S5_AVG_EVENT_REVENUE: 2400,
        S5_MINIMUM_MET: 'Tracked', S5_MONTHLY_GAP: 0
      }}),
      60: mkAudit('revenue', { date: dateStr(60), generated_at: daysAgoISO(60), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 48,
        DATA_TIER_LABEL: 'Bar Cop operating data',
        AUDIT_PERIOD: periodLabel(60), AUDIT_ID: 'RFA-2026-0017',
        INDUSTRY_AVG: 61, TARGET_SCORE: 70,
        S1_SCORE: 47, S1_CHECK_AVG: 36.20, S1_CHECK_AVG_TARGET: 40.00, S1_BAR_CHECK_AVG: 29.60,
        S1_FOOD_CHECK_AVG: 42.40, S1_COVER_COUNT: 2110, S1_MONTHLY_REVENUE: 76400,
        S1_MONTHLY_GAP: 8018, S1_ANNUAL_GAP: 96216,   // (40.00 - 36.20) x 2,110
        S2_SCORE: 50, S2_LABOR_PCT: 31.5, S2_LABOR_TARGET_PCT: 30, S2_RPLH: 68, S2_RPLH_TARGET: 75,
        S2_LABOR_PERIOD: 24100, S2_MONTHLY_GAP: 1146, S2_ANNUAL_GAP: 13752,
        S3_SCORE: 45, S3_STARS_COUNT: 5, S3_PLOWHORSES_COUNT: 8, S3_DOGS_COUNT: 4, S3_PUZZLES_COUNT: 6,
        S3_TOP_CATEGORY: 'Craft Cocktails', S3_LAST_PRICE_INCREASE: 'Over a year ago', S3_PRICING_STALE: true, S3_DOG_TESTS_ACTIVE: 2, S3_MONTHLY_GAP: 0,
        S4_SCORE: 50, S4_SERVER_COUNT: 9, S4_TOP_CHECK_AVG: 45.20, S4_BOTTOM_CHECK_AVG: 31.60,
        S4_TEAM_CHECK_AVG: 38.40, S4_PERFORMANCE_SPREAD: 13.60, S4_COMP_PCT: 4.0, S4_COMP_BENCHMARK_PCT: 3, S4_MONTHLY_GAP: 2100,
        S5_SCORE: 48, S5_EVENT_REV_PERIOD: 6800, S5_EVENTS_PER_MONTH: 3, S5_AVG_EVENT_REVENUE: 2267,
        S5_MINIMUM_MET: 'Tracked', S5_MONTHLY_GAP: 0
      }}),
      30: mkAudit('revenue', { date: dateStr(30), generated_at: daysAgoISO(30), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 56,
        DATA_TIER_LABEL: 'Bar Cop operating data',
        AUDIT_PERIOD: periodLabel(30), AUDIT_ID: 'RFA-2026-0022',
        INDUSTRY_AVG: 61, TARGET_SCORE: 70,
        S1_SCORE: 56, S1_CHECK_AVG: 36.90, S1_CHECK_AVG_TARGET: 40.00, S1_BAR_CHECK_AVG: 30.60,
        S1_FOOD_CHECK_AVG: 43.00, S1_COVER_COUNT: 2140, S1_MONTHLY_REVENUE: 78900,
        S1_MONTHLY_GAP: 6634, S1_ANNUAL_GAP: 79608,   // (40.00 - 36.90) x 2,140
        S2_SCORE: 60, S2_LABOR_PCT: 30.0, S2_LABOR_TARGET_PCT: 30, S2_RPLH: 74, S2_RPLH_TARGET: 75,
        S2_LABOR_PERIOD: 24000, S2_MONTHLY_GAP: 0, S2_ANNUAL_GAP: 0,
        S3_SCORE: 53, S3_STARS_COUNT: 6, S3_PLOWHORSES_COUNT: 8, S3_DOGS_COUNT: 3, S3_PUZZLES_COUNT: 6,
        S3_TOP_CATEGORY: 'Craft Cocktails', S3_LAST_PRICE_INCREASE: '5 months ago', S3_PRICING_STALE: false, S3_DOG_TESTS_ACTIVE: 2, S3_MONTHLY_GAP: 0,
        S4_SCORE: 58, S4_SERVER_COUNT: 10, S4_TOP_CHECK_AVG: 46.40, S4_BOTTOM_CHECK_AVG: 35.40,
        S4_TEAM_CHECK_AVG: 40.90, S4_PERFORMANCE_SPREAD: 11.00, S4_COMP_PCT: 3.2, S4_COMP_BENCHMARK_PCT: 3, S4_MONTHLY_GAP: 1500,
        S5_SCORE: 53, S5_EVENT_REV_PERIOD: 9000, S5_EVENTS_PER_MONTH: 4, S5_AVG_EVENT_REVENUE: 2250,
        S5_MINIMUM_MET: 'Tracked', S5_MONTHLY_GAP: 0
      }}),
      0: mkAudit('revenue', { date: dateStr(0), generated_at: daysAgoISO(0), raw: {
        BAR_NAME: 'The Anchor Bar & Kitchen', OVERALL_SCORE: 64,
        DATA_TIER_LABEL: 'Bar Cop operating data',
        AUDIT_PERIOD: periodLabel(0), AUDIT_ID: 'RFA-2026-0028',
        INDUSTRY_AVG: 61, TARGET_SCORE: 70,
        S1_SCORE: 64, S1_CHECK_AVG: 38.10, S1_CHECK_AVG_TARGET: 40.00, S1_BAR_CHECK_AVG: 31.80,
        S1_FOOD_CHECK_AVG: 44.20, S1_COVER_COUNT: 2170, S1_MONTHLY_REVENUE: 82700,
        S1_MONTHLY_GAP: 4123, S1_ANNUAL_GAP: 49476,   // (40.00 - 38.10) x 2,170
        S2_SCORE: 68, S2_LABOR_PCT: 28.6, S2_LABOR_TARGET_PCT: 30, S2_RPLH: 80, S2_RPLH_TARGET: 75,
        S2_LABOR_PERIOD: 23800, S2_MONTHLY_GAP: 0, S2_ANNUAL_GAP: 0,
        S3_SCORE: 62, S3_STARS_COUNT: 7, S3_PLOWHORSES_COUNT: 7, S3_DOGS_COUNT: 2, S3_PUZZLES_COUNT: 6,
        S3_TOP_CATEGORY: 'Craft Cocktails', S3_LAST_PRICE_INCREASE: '2 months ago', S3_PRICING_STALE: false, S3_DOG_TESTS_ACTIVE: 3, S3_MONTHLY_GAP: 0,
        S4_SCORE: 66, S4_SERVER_COUNT: 10, S4_TOP_CHECK_AVG: 47.20, S4_BOTTOM_CHECK_AVG: 37.80,
        S4_TEAM_CHECK_AVG: 42.50, S4_PERFORMANCE_SPREAD: 9.40, S4_COMP_PCT: 2.6, S4_COMP_BENCHMARK_PCT: 3, S4_MONTHLY_GAP: 1100,
        S5_SCORE: 60, S5_EVENT_REV_PERIOD: 11200, S5_EVENTS_PER_MONTH: 5, S5_AVG_EVENT_REVENUE: 2240,
        S5_MINIMUM_MET: 'Tracked', S5_MONTHLY_GAP: 0
      }})
    });

    // ════════════════════════════════════════════════════════════════════
    //  REVENUE RECOVERY — the Anchor's revenue side, all traced to
    //  window.ANCHOR: fifty-two weekly records, the menu, server checks,
    //  events, dog tests and the price-change log.
    // ════════════════════════════════════════════════════════════════════
    App.data.revenue_settings = App.data.revenue_settings || {};
    // check_avg is 40, not 35, and that is load-bearing: it is the ONE target the
    // Revenue Dashboard, Recovery and the live audit engine all read
    // (audit-compute.js `checkTarget = rt.check_avg ?? 35`). Seeded at 35 it
    // contradicted the demo on two adjacent screens: the Dashboard rendered "$38.30,
    // target $35.00" in GREEN as a beat, while the audit dated TODAY said "$38.10
    // against a $40.00 target. Every guest is leaving room on the table" and booked a
    // gap. Worse, a live "Generate New Audit" on the demo would have scored S1 85 with
    // NO gap (below = 35 - 38.10 is negative), erasing the whole check-average story
    // the seeded audit tells. Every other target here already matches Settings.
    App.data.revenue_settings.targets = { check_avg:40, rplh_lunch:50, rplh_dinner:75, rplh_bar:65, event_close_rate:40 };

    // Four servers carry the floor. Each week's covers split by these weights,
    // with the top server running a higher check average than the bottom.
    const rServers     = ['Jessica M.','Marcus T.','Brianna K.','Priya N.'];
    const rSrvWeight   = [0.30, 0.26, 0.24, 0.20];
    const rSrvCheckMul = [1.14, 1.04, 0.96, 0.86];

    // Fixed salaried pay is the one GM ($68k) — see the roster below. Hourly
    // (schedulable) labor = total labor minus that fixed salary, so the recovery
    // engine dollarizes only what scheduling can move (matches App.salariedCost).
    const WEEKLY_GM_SALARY = 68000 / 52;
    App.data.revenue_weeks = window.ANCHOR.weeks.map(a => {
      const dep   = window.ANCHOR.laborDepts(a);
      const hours = a.bar_labor/16 + dep.kitchen/15 + dep.floor/14;
      const totalLabor  = a.bar_labor + a.food_labor;
      const hourlyLabor = Math.max(0, totalLabor - WEEKLY_GM_SALARY);
      return {
        id:uid(), week_num:a.wk, period_end:dateStr(sunOff + window.ANCHOR.endAgo(a)),
        bar_revenue:a.bar_rev, floor_revenue:a.food_rev, covers:a.covers, check_avg:a.check_avg,
        total_labor_cost:totalLabor, hourly_labor_cost:+hourlyLabor.toFixed(2), total_hours:+hours.toFixed(1),
        labor_pct_blended:a.labor_pct_blended, hourly_labor_pct:+(hourlyLabor / a.total_rev * 100).toFixed(2),
        rplh_blended:+(a.total_rev / hours).toFixed(2),
        notes:'', saved_at:new Date().toISOString()
      };
    });

    // ── Revenue Forecasts — none seeded on purpose. Bar Cop now calculates every
    // week's forecast live from the shift history and booked events above
    // (App.effectiveForecast: 8-week baseline + events). A saved record here would
    // read as a manual OVERRIDE and show a second, competing number, so the demo
    // carries none and every week shows Bar Cop's own calculated forecast. Covers
    // and the schedule cover target come from the same computed baseline
    // (App.coverDefaultsFor), so nothing needs a seeded forecast to read.
    App.data.revenue_forecasts = [];

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
      ['Truffle Fries',        'Appetizers',  8, 2.95, 120],
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
      ['Bread Pudding',        'Desserts',    8, 2.00,  40],
      ['Affogato',             'Desserts',    9, 2.60,  24],
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

    // Sample server talking points on the likely-featured items, so the Pre-Shift
    // briefing ships with real pitches (the operator writes one per item, once).
    const rPitch = (nm, p) => { const it = rItem(nm); if (it) it.server_pitch = p; };
    rPitch('Smoked Wings',       'House dry rub, smoked in-house. Great to share with the first round.');
    rPitch('Loaded Nachos',      'Big enough for the table. Suggest it the second they sit.');
    rPitch('Pretzel Bites',      'Out fast with the beer cheese. A perfect opener.');
    rPitch('Anchor Burger',      'Our signature, half-pound and never frozen. Lead with it.');
    rPitch('Brisket Sandwich',   'Brisket smoked twelve hours. Ask if they want it loaded.');
    rPitch('Chicken and Waffles','Fried to order with maple butter. The one everyone photographs.');
    rPitch('Shrimp Tacos',       'Light and fast, three to an order. A good weeknight pick.');
    rPitch('Breakfast Tacos',    'Three to an order, out of the kitchen fast. Easy add-on.');
    rPitch('Fish and Chips',     'Beer-battered cod, hand-cut fries. The Friday go-to.');
    rPitch('Old Fashioned',      'Top-shelf pour for a couple bucks more. Offer it first.');
    rPitch('House Margarita',    'Fresh lime, no mix. Upsell the top-shelf tequila.');
    rPitch('Key Lime Pie',       'House-made and big enough to share. Circle back after dinner.');

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
        const cv = 18 + Math.round(rnd() * 14);
        // ⚠ SEED HONESTY (S219): these must be periods from `service_periods` above, because every
        // form that writes a shift builds its picker from App.SHIFT_TYPES — so 'Bar' was a value no
        // operator could ever have entered. Rotating through Happy Hour also puts the profile's one
        // CUSTOM daypart on screen, which is the thing it exists to demonstrate.
        rSC.push({ id:uid(), date:dateStr(d), shift:['Dinner','Lunch','Happy Hour'][i % 3],
          server_name:nm, covers:cv,
          sales:+(cv * (31 + j * 1.5 + rnd() * 7)).toFixed(2),
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
        /* ⚠ 20 DAYS BACK, NOT 38, AND THE PLACEMENT IS LOAD-BEARING. The Revenue audit scores
           events over a 4-week window ending at the LAST CONFIRMED WEEK, not today — 0..27 days
           back on a Sunday, 6..33 on a Saturday. The three Completed bookings used to sit at 38,
           3 and 2 days back, BRACKETING that window without ever landing in it, so S5 could never
           score: the readiness card read "Partial data, 4 of 5 ready" while the seeded audit
           beside it claimed Full data and an Events score of 60, and pressing Generate resolved
           it the wrong way (64 -> 77, five sections -> four, Full -> Partial).
           This one moves because it is the only one that can: Live Music Friday and the Westlake
           catering are 3 and 2 days back and feed the CURRENT week's revenue and the Confirm the
           Week catering line, so moving them would change this week's numbers. Reyes is a one-off
           private dinner already far enough back to touch nothing.
           10..25 days back is inside the window on EVERY weekday, so this survives the rolling
           re-seed. Pinned in verify-seed-audit-window-events.js.
           balance_paid moves with it (19d) to keep "paid the day after the event" true. */
        date_received:dateStr(72), event_date:dateStr(20), event_time:'6:30 PM', party_size:34, space:'Private Room',
        fb_minimum:2200, per_head:0, quoted_total:2840, deposit_amount:800, deposit_paid_date:dateStr(60), balance_paid_date:dateStr(19),
        actual_revenue:2640, event_food_cost:760, event_bar_cost:520, event_other_cost:0,
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
        actual_revenue:1890, event_food_cost:430, event_bar_cost:0, event_other_cost:180,
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

    // S179: distinct ascending created_at so App.byCreation renders them in authored order (they carry
    // no created_at otherwise, and byCreation would fall back to the random uid).
    App.data.event_rate_cards = [
      { id:uid(), package_name:'Weeknight Private Room', event_type:'Private Dining', min_covers:15, max_covers:40, fb_minimum:1500, room_fee:0,   per_head:55, created_at:daysAgoISO(30) },
      { id:uid(), package_name:'Saturday Full Buyout',   event_type:'Buyout',        min_covers:60, max_covers:110, fb_minimum:6000, room_fee:500, per_head:75, created_at:daysAgoISO(29) },
      { id:uid(), package_name:'Offsite Catering',       event_type:'Catering (Offsite)', min_covers:20, max_covers:200, fb_minimum:0, room_fee:0, per_head:32, created_at:daysAgoISO(28) },
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
      { id:uid(), name:'Republic National',   rep:'Dana Ortiz',  phone:'512-555-0142', email:'dortiz@rndc.example',   delivery_days:'Tue, Fri', payment_terms:'Net 30', account_number:'RNDC-4471',  order_minimum:150, order_minimum_unit:'$', delivery_fee:null, free_delivery_over:null, notes:'', created_at:new Date().toISOString() },
      { id:uid(), name:"Glazer's Beer & Bev", rep:'Marcus Hill', phone:'512-555-0188', email:'mhill@glazers.example', delivery_days:'Wed',      payment_terms:'Net 15', account_number:'GLZ-2210',   order_minimum:5, order_minimum_unit:'cases', delivery_fee:null, free_delivery_over:null, notes:'', created_at:new Date().toISOString() },
      { id:uid(), name:'Austin Beerworks',    rep:'Priya Shah',  phone:'512-555-0119', email:'priya@abw.example',     delivery_days:'Thu',      payment_terms:'COD',    account_number:'ABW-0093',   order_minimum:2, order_minimum_unit:'kegs', delivery_fee:null, free_delivery_over:null, notes:'Local draft', created_at:new Date().toISOString() },
      { id:uid(), name:'Sysco Foods',         rep:'Tom Becker',  phone:'512-555-0203', email:'tbecker@sysco.example', delivery_days:'Mon, Thu', payment_terms:'Net 30', account_number:'SYS-88120',  order_minimum:250, order_minimum_unit:'$', delivery_fee:25, free_delivery_over:400, notes:'', created_at:new Date().toISOString() },
      { id:uid(), name:'Restaurant Depot',    rep:'Walk-in',     phone:'512-555-0250', email:'',                      delivery_days:'Pickup',   payment_terms:'COD',    account_number:'',           order_minimum:null, order_minimum_unit:'$', delivery_fee:null, free_delivery_over:null, notes:'Supplies and paper', created_at:new Date().toISOString() },
      { id:uid(), name:'Local Produce Co.',   rep:'Gabe Flores', phone:'512-555-0177', email:'orders@localproduce.example', delivery_days:'Tue, Fri', payment_terms:'Net 15', account_number:'LPC-3050',  order_minimum:100, order_minimum_unit:'$', delivery_fee:null, free_delivery_over:null, notes:'Produce and dairy', created_at:new Date().toISOString() },
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
    // Countable food: servings (pieces) per stock unit + the serving noun, so
    // recipes read "2 slices" / "1 patty" instead of a fraction of a pound. Keyed
    // by cleaned name. Weight-portioned food (cheese, fish, potato) is left off
    // and stays priced by the pound.
    const FOOD_SERVINGS = {
      'Ground Beef 80/20': { pack:3,   name:'patty' },
      'Applewood Bacon':   { pack:16,  name:'slice' },
      'Large Eggs':        { pack:12,  name:'egg' },
      'Chicken Wings':     { pack:6,   name:'wing' },
      'Tortilla Chips':    { pack:8,   name:'serving' },
      'Flour Tortilla':    { pack:200, name:'tortilla' },
      'Romaine':           { pack:40,  name:'salad' },
      'Mixed Greens':      { pack:40,  name:'serving' }
    };
    const icProducts = [
      { name:"Tito's Handmade Vodka",    category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.5, unit_cost:22.40, menu_price:9,  par_level:24,  reorder_point:10,  primary_location:'Liquor Room', locations:['Main Bar','Liquor Room'] },
      { name:'Espolòn Tequila Blanco',   category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.5, unit_cost:24.50, menu_price:10, par_level:20,  reorder_point:9,   primary_location:'Liquor Room', locations:['Main Bar','Liquor Room'] },
      { name:'Bulleit Bourbon',          category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.5, unit_cost:27.90, menu_price:11, par_level:16,  reorder_point:7,   primary_location:'Liquor Room', locations:['Main Bar','Liquor Room'] },
      { name:"Hendrick's Gin",           category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.5, unit_cost:31.00, menu_price:12, par_level:10,  reorder_point:5,   primary_location:'Liquor Room', locations:['Main Bar','Liquor Room'] },
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
      { name:'Lime Juice (qt)',          category:'Misc',        misc_type:'Drink Mixer',   unit_type:'quart', container_size_oz:32, vendor:'Sysco Foods',         unit_cost:4.50,  par_level:18,  reorder_point:6,   primary_location:'Walk-in Cooler' },
      { name:'Simple Syrup (qt)',        category:'Misc',        misc_type:'Drink Mixer',   unit_type:'quart', container_size_oz:32, vendor:'Sysco Foods',         unit_cost:3.50,  par_level:12,  reorder_point:4,   primary_location:'Back Bar' },
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
      { name:'Mayonnaise (qt)',          category:'Food',        sub_category:'Condiments',  unit_type:'quart', container_size_oz:32, vendor:'Sysco Foods',         unit_cost:4.00,  par_level:12,  reorder_point:4,   primary_location:'Walk-in Cooler' },
      { name:'Heavy Cream (qt)',         category:'Food',        unit_type:'quart', container_size_oz:32, vendor:'Sysco Foods',         unit_cost:4.50,  par_level:16,  reorder_point:6,   primary_location:'Walk-in Cooler' },
      { name:'Charcuterie Selection (lb)',category:'Food',       vendor:'Local Produce Co.',   unit_cost:12.00, par_level:20,  reorder_point:7,   primary_location:'Walk-in Cooler' },
      { name:'Dark Chocolate (lb)',      category:'Food',        vendor:'Sysco Foods',         unit_cost:6.50,  par_level:20,  reorder_point:7,   primary_location:'Dry Storage' },
      { name:'Coffee Liqueur',           category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.0, unit_cost:19.00, menu_price:9, par_level:8,  reorder_point:3, primary_location:'Back Bar' },
      { name:'Campari',                  category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.0, unit_cost:26.00, menu_price:9, par_level:6,  reorder_point:2, primary_location:'Back Bar' },
      { name:'Sweet Vermouth',           category:'Wine',        vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.0, unit_cost:11.00, menu_price:8, par_level:6,  reorder_point:2, primary_location:'Back Bar' },
      { name:'Mezcal',                   category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.5, unit_cost:33.00, menu_price:12, par_level:6,  reorder_point:2, primary_location:'Liquor Room' },
      { name:'Prosecco',                 category:'Wine',        vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:2.0, unit_cost:12.00, menu_price:10, par_level:18, reorder_point:6, primary_location:'Walk-in Cooler' },
      { name:'White Rum',                category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:1.5, unit_cost:14.00, menu_price:8, par_level:8,  reorder_point:3, primary_location:'Liquor Room' },
      { name:'Maraschino Liqueur',       category:'Liquor',      vendor:'Republic National',   container_size_oz:25.4, pour_size_oz:0.5, unit_cost:24.00, menu_price:9, par_level:4,  reorder_point:2, primary_location:'Back Bar' },
      { name:'Cold Brew Concentrate (qt)',category:'Misc',       misc_type:'NA Beverage',   unit_type:'quart', container_size_oz:32, vendor:'Sysco Foods',         unit_cost:9.00,  par_level:8,  reorder_point:3,   primary_location:'Walk-in Cooler' },
      { name:'Ginger Beer (qt)',         category:'Misc',        misc_type:'NA Beverage',   unit_type:'quart', container_size_oz:32, vendor:"Glazer's Beer & Bev", unit_cost:3.00,  par_level:18, reorder_point:6,   primary_location:'Walk-in Cooler' },
      { name:'Cranberry Juice (qt)',     category:'Misc',        misc_type:'Drink Mixer',   unit_type:'quart', container_size_oz:32, vendor:'Sysco Foods',         unit_cost:3.50,  par_level:12, reorder_point:4,   primary_location:'Back Bar' },
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
      { name:'House Lemonade',           category:'Misc', misc_type:'NA Beverage',  sold_on_menu:true, unit_type:'gallon', container_size_oz:128, vendor:'Sysco Foods', unit_cost:6.00, menu_price:4, servings_per_unit:12, cost_per_serving:0.50, par_level:6,  reorder_point:2,  primary_location:'Walk-in Cooler' },
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
      const rawUnit = p.unit_type || (um ? um[1].toLowerCase() : null);
      // Canonicalize to the Unit Type dropdown values so no seeded product falls
      // back to "Custom" on the form (qt -> quart, gal -> gallon, jug -> gallon).
      const UNIT_CANON = { qt:'quart', gal:'gallon', jug:'gallon', pt:'pint', ea:'each', lbs:'lb' };
      const unitType = rawUnit ? (UNIT_CANON[rawUnit] || rawUnit) : null;
      return { id:uid(), brand:'', sub_category:'', secondary_location:'', notes:'', active:true,
        container_size_oz:null, pour_size_oz:null, menu_price:null,
        pours_per_container:pours, cost_per_pour:cpp,
        pour_cost_pct:(cpp != null && p.menu_price) ? cpp/p.menu_price*100 : null,
        // Phase 0: cost_history captures every auto-update from Receive Delivery
        // price changes. Empty on fresh data; populated as deliveries log price moves.
        cost_history:[],
        ...p, name: cleanName, unit_type: unitType,
        pack_size: (FOOD_SERVINGS[cleanName] ? FOOD_SERVINGS[cleanName].pack : (p.pack_size != null ? p.pack_size : null)),
        serving_name: (FOOD_SERVINGS[cleanName] ? FOOD_SERVINGS[cleanName].name : (p.serving_name || null)),
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
    const resaleMenuItem = (p, covers, portion) => ({
      id:uid(), name:p.name,
      category:(App.menuCatForProduct ? (App.menuCatForProduct(p) || 'Snacks') : 'Snacks'),
      price:p.menu_price || 0,
      cost:+((App.menuLinkCost ? App.menuLinkCost(p, portion) : (p.unit_cost || 0))).toFixed(2),
      weekly_covers:covers, prev_weekly_covers:null, weekly_covers_updated_at:null, notes:'',
      recipe:null, linked_product_id:p.id, pour_size_oz:null, portion:(portion != null ? portion : null), target_cost_pct:null,
      created_at:new Date().toISOString(), updated_at:new Date().toISOString()
    });
    // Topo Chico + Kettle Chips sell whole (1 unit); House Lemonade is a ~10 oz
    // glass poured from the gallon, so cost = 10 oz x per-ounce.
    [ ['Topo Chico', 90, 1], ['House Lemonade', 70, 10], ['Kettle Chips', 110, 1] ]
      .forEach(row => { const p = icByName(row[0]); if (p) rMenu.push(resaleMenuItem(p, row[1], row[2])); });

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
      // Ounces poured, the way a bartender specs a drink (2 oz base, modifiers 0.5-1).
      ingredients: [
        { source: 'product', id: icProducts[1].id,  quantity: 2 },     // Espolòn Tequila
        { source: 'product', id: icProducts[16].id, quantity: 1 },     // Triple Sec
        { source: 'product', id: icProducts[17].id, quantity: 0.75 }   // Lime Juice
      ],
      plate_yield: null
    });
    attachRecipe('Anchor Burger', {
      mode: 'food',
      ingredients: [
        ing('Ground Beef 80/20 (lb)', 1),
        ing('Brioche Bun (each)',     1),
        ing('Cheddar Cheese (lb)',    0.12),
        ing('Applewood Bacon (lb)',   2),
        ing('Beefsteak Tomato (lb)',  0.08),
        ing('Mixed Greens (case)',    1)
      ],
      plate_yield: 1
    });
    attachRecipe('Old Fashioned', {
      mode: 'single',
      // All amounts in ounces (2 oz spirit, a 0.25 oz sweetener).
      ingredients: [ ing('Bulleit Bourbon', 2), ing('Simple Syrup (qt)', 0.25) ],
      plate_yield: null
    });
    // More plate + cocktail recipes, all built from real Inventory products.
    // Not every item carries a recipe (by design) — these cover the headline
    // dishes so Recipe Cost Analysis and Menu Engineering have real coverage.
    attachRecipe('Brisket Sandwich', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Beef Brisket (lb)', 0.35), ing('Brioche Bun (each)', 1), ing('Mixed Greens (case)', 1) ] });
    attachRecipe('Fish and Chips', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Atlantic Cod (lb)', 0.40), ing('Russet Potato (lb)', 0.50) ] });
    attachRecipe('Chicken Caesar', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Chicken Thigh (lb)', 0.30), ing('Romaine (case)', 1), ing('Parmesan (lb)', 0.05) ] });
    attachRecipe('Steak Frites', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Beef Brisket (lb)', 0.50), ing('Russet Potato (lb)', 0.45) ] });
    attachRecipe('Shrimp Tacos', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Gulf Shrimp (lb)', 0.42), ing('Flour Tortilla (case)', 3), ing('Hass Avocado (each)', 0.5) ] });
    attachRecipe('Pan-Seared Salmon', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Salmon Fillet (lb)', 0.58), ing('Arborio Rice (lb)', 0.15), ing('Mixed Greens (case)', 1) ] });
    attachRecipe('Grilled Pork Chop', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Pork Chop (each)', 1), ing('Russet Potato (lb)', 0.40) ] });
    attachRecipe('Mushroom Risotto', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Arborio Rice (lb)', 0.25), ing('Parmesan (lb)', 0.06) ] });
    attachRecipe('Breakfast Tacos', { mode: 'food', plate_yield: 1, ingredients: [
      ing('Large Eggs (dozen)', 3), ing('Flour Tortilla (case)', 3), ing('Cheddar Cheese (lb)', 0.06), ing('Applewood Bacon (lb)', 2) ] });
    attachRecipe('Paloma', { mode: 'single', plate_yield: null, ingredients: [
      ing('Espolòn Tequila Blanco', 2), ing('Lime Juice (qt)', 0.5), ing('Simple Syrup (qt)', 0.5) ] });
    // Demo seed for the cost-creep alert: the two highest-volume margaritas both
    // pour Espolòn Tequila Blanco and carry a tight cost target, so they sit just
    // under it (Margarita ~21.7% vs 22%, Paloma ~18.7% vs 19%). A single tequila
    // price bump on a delivery then visibly tips both over — firing the Receive-
    // Delivery notice + the cockpit flag.
    if (rItem('House Margarita')) rItem('House Margarita').target_cost_pct = 22;
    if (rItem('Paloma'))          rItem('Paloma').target_cost_pct = 19;
    attachRecipe('Whiskey Sour', { mode: 'single', plate_yield: null, ingredients: [
      ing('Bulleit Bourbon', 2), ing('Lime Juice (qt)', 0.75), ing('Simple Syrup (qt)', 0.75) ] });

    // ── C reseed (2026-05-30): recipe-cost the rest of the menu off real
    // Inventory products so nearly every item is recipe-driven and costs auto-
    // flow. Five simple/prepared items stay manual-cost by design (Fried
    // Pickles, Pretzel Bites, Truffle Fries, Skillet Cookie, Key Lime Pie).
    attachRecipe('Loaded Nachos', { mode:'food', plate_yield:1, ingredients:[
      ing('Tortilla Chips (bag)', 4), ing('Cheddar Cheese (lb)', 0.30), ing('Ground Beef 80/20 (lb)', 1) ] });
    attachRecipe('Smoked Wings', { mode:'food', plate_yield:1, ingredients:[
      ing('Chicken Wings (lb)', 11) ] });
    attachRecipe('Deviled Eggs', { mode:'food', plate_yield:1, ingredients:[
      ing('Large Eggs (dozen)', 6), ing('Mayonnaise (qt)', 1.5) ] });
    attachRecipe('Charcuterie Board', { mode:'food', plate_yield:1, ingredients:[
      ing('Charcuterie Selection (lb)', 0.4), ing('Cheddar Cheese (lb)', 0.15), ing('Flatbread (each)', 1) ] });
    attachRecipe('Crispy Brussels', { mode:'food', plate_yield:1, ingredients:[
      ing('Brussels Sprouts (lb)', 0.6), ing('Applewood Bacon (lb)', 2) ] });
    attachRecipe('Hummus and Flatbread', { mode:'food', plate_yield:1, ingredients:[
      ing('Chickpeas (lb)', 0.5), ing('Flatbread (each)', 2) ] });
    attachRecipe('Calamari', { mode:'food', plate_yield:1, ingredients:[
      ing('Calamari (lb)', 0.80), ing('Lime Juice (qt)', 0.5) ] });
    attachRecipe('Street Corn Ribs', { mode:'food', plate_yield:1, ingredients:[
      ing('Sweet Corn (each)', 3), ing('Parmesan (lb)', 0.05) ] });
    attachRecipe('Tuna Poke', { mode:'food', plate_yield:1, ingredients:[
      ing('Ahi Tuna (lb)', 0.30), ing('Hass Avocado (each)', 0.5), ing('Arborio Rice (lb)', 0.10) ] });
    attachRecipe('House Salad', { mode:'food', plate_yield:1, ingredients:[
      ing('Mixed Greens (case)', 2), ing('Beefsteak Tomato (lb)', 0.10) ] });
    attachRecipe('Mac and Cheese', { mode:'food', plate_yield:1, ingredients:[
      ing('Elbow Pasta (lb)', 0.30), ing('Cheddar Cheese (lb)', 0.30), ing('Heavy Cream (qt)', 2) ] });
    attachRecipe('Avocado Toast', { mode:'food', plate_yield:1, ingredients:[
      ing('Hass Avocado (each)', 1.5), ing('Sourdough Loaf (each)', 0.2), ing('Large Eggs (dozen)', 2) ] });
    attachRecipe('Veggie Grain Bowl', { mode:'food', plate_yield:1, ingredients:[
      ing('Quinoa (lb)', 0.30), ing('Mixed Greens (case)', 2), ing('Hass Avocado (each)', 0.5) ] });
    attachRecipe('Braised Short Rib', { mode:'food', plate_yield:1, ingredients:[
      ing('Beef Short Rib (lb)', 1.0), ing('Russet Potato (lb)', 0.40) ] });
    attachRecipe('Chicken and Waffles', { mode:'food', plate_yield:1, ingredients:[
      ing('Chicken Thigh (lb)', 0.6), ing('Waffle Mix (lb)', 0.5) ] });
    attachRecipe('Brunch Burger', { mode:'food', plate_yield:1, ingredients:[
      ing('Ground Beef 80/20 (lb)', 1), ing('Brioche Bun (each)', 1), ing('Applewood Bacon (lb)', 2), ing('Large Eggs (dozen)', 1), ing('Cheddar Cheese (lb)', 0.08) ] });
    attachRecipe('Shakshuka', { mode:'food', plate_yield:1, ingredients:[
      ing('Large Eggs (dozen)', 4), ing('Beefsteak Tomato (lb)', 0.40), ing('Chickpeas (lb)', 0.15) ] });
    attachRecipe('Creme Brulee', { mode:'food', plate_yield:1, ingredients:[
      ing('Heavy Cream (qt)', 8), ing('Large Eggs (dozen)', 2) ] });
    attachRecipe('Chocolate Torte', { mode:'food', plate_yield:1, ingredients:[
      ing('Dark Chocolate (lb)', 0.20), ing('Large Eggs (dozen)', 1), ing('Heavy Cream (qt)', 1.5) ] });
    attachRecipe('Espresso Martini', { mode:'single', plate_yield:null, ingredients:[
      ing("Tito's Handmade Vodka", 1.5), ing('Coffee Liqueur', 0.75), ing('Cold Brew Concentrate (qt)', 1) ] });
    attachRecipe('Negroni', { mode:'single', plate_yield:null, ingredients:[
      ing("Hendrick's Gin", 1), ing('Campari', 1), ing('Sweet Vermouth', 1) ] });
    attachRecipe('Manhattan', { mode:'single', plate_yield:null, ingredients:[
      ing('Bulleit Bourbon', 2), ing('Sweet Vermouth', 1) ] });
    attachRecipe('Mezcal Mule', { mode:'single', plate_yield:null, ingredients:[
      ing('Mezcal', 1.5), ing('Lime Juice (qt)', 0.75), ing('Ginger Beer (qt)', 3) ] });
    attachRecipe('Spicy Margarita', { mode:'single', plate_yield:null, ingredients:[
      ing('Espolòn Tequila Blanco', 2), ing('Triple Sec', 0.75), ing('Lime Juice (qt)', 0.75) ] });
    attachRecipe('French 75', { mode:'single', plate_yield:null, ingredients:[
      ing("Hendrick's Gin", 1), ing('Lime Juice (qt)', 0.5), ing('Simple Syrup (qt)', 0.5), ing('Prosecco', 2) ] });
    attachRecipe('Mojito', { mode:'single', plate_yield:null, ingredients:[
      ing('White Rum', 2), ing('Lime Juice (qt)', 0.75), ing('Simple Syrup (qt)', 0.5) ] });
    attachRecipe('Boulevardier', { mode:'single', plate_yield:null, ingredients:[
      ing('Bulleit Bourbon', 1.5), ing('Campari', 1), ing('Sweet Vermouth', 1) ] });
    attachRecipe('Aviation', { mode:'single', plate_yield:null, ingredients:[
      ing("Hendrick's Gin", 2), ing('Maraschino Liqueur', 0.5), ing('Lime Juice (qt)', 0.75) ] });
    attachRecipe('Cosmopolitan', { mode:'single', plate_yield:null, ingredients:[
      ing("Tito's Handmade Vodka", 1.5), ing('Triple Sec', 0.5), ing('Lime Juice (qt)', 0.5), ing('Cranberry Juice (qt)', 1) ] });
    // Re-compute cost on items that just got a recipe so the menu engineering
    // numbers stay consistent on first render (before any save fires).
    rMenu.forEach(m => {
      if (m.recipe && m.recipe.ingredients && m.recipe.ingredients.length && App.menuItemCost) {
        // Cost via the live engine (App.recipeBasis) so the seeded cost matches
        // exactly what the app recomputes on render — liquids per ounce, solids
        // per serving. ic_products is already assigned above.
        const c = App.menuItemCost(m);
        if (c != null) m.cost = +c.toFixed(2);
      }
    });

    // Prep batches: made-in-house ingredients. Frozen Margarita Mix is the
    // classic example. Lives in App.inventoryData.ic_prep_batches alongside
    // Products, Locations, Vendors as IC Setup reference data (Rule 21).
    // A gallon (128 oz) frozen margarita mix, all ingredients in OUNCES like a
    // recipe: ~88 oz spirits/juice topped to a gallon. Costed per ounce via the
    // shared engine, so the batch cost matches what the Menu Builder computes.
    const fmIngredients = [
      { product_id: icProducts[1].id, quantity: 32 },   // Espolòn Tequila
      { product_id: icProducts[16].id, quantity: 16 },  // Triple Sec
      { product_id: icProducts[17].id, quantity: 24 },  // Lime Juice
      { product_id: icProducts[18].id, quantity: 16 }   // Simple Syrup
    ];
    const fmTotalCost = fmIngredients.reduce((s, ing) => {
      const p = icProducts.find(x => x.id === ing.product_id);
      const per = (p && App.recipeBasis) ? (App.recipeBasis(p).costPerUnit || 0) : (p?.unit_cost || 0);
      return s + per * ing.quantity;
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
        return { product_id:p.id, name:p.name, category:p.category, location:p.primary_location || '',
          cases:whole, loose, case_size_at_count:p.case_size,
          fulls:whole, partial:0, total,
          unit_cost:p.unit_cost, value:+(total * (p.unit_cost || 0)).toFixed(2), notes:'' };
      }
      return { product_id:p.id, name:p.name, category:p.category, location:p.primary_location || '',
        fulls:Math.floor(qty), partial:+(qty - Math.floor(qty)).toFixed(2), total:qty,
        unit_cost:p.unit_cost, value:+(qty * (p.unit_cost || 0)).toFixed(2), notes:'' };
    };
    const mkCount = (daysAgo, pick, countedBy) => {
      const items = icProducts.map((p, i) => icCountItem(p, pick(i)));
      /* ⛔ THE TYPE IS DERIVED THE WAY THE FORM DERIVES IT, NOT WRITTEN DOWN (Q3, 2026-07-31).
         It was hardcoded `'Full'` while the locations below are derived from the products —
         and no seeded product sits on Main Bar, so every count covered FIVE of six shelves and
         called itself Full. ic-take-inventory's own rule says a 5-of-6 count is NOT Full, so the
         seed was writing a record the form could never produce ([[seed-roundtrip-verification]]).
         Visible consequences: the Stock Report's BY LOCATION had no Main Bar row and no note
         saying why, all ten counts in Count History read "Full", and the already-counted-today
         prompt named five locations under a label claiming all of them.
         Deriving it means the label stays honest if the seed's shelves ever change. */
      const countedLocs = [...new Set(items.map(it => it.location).filter(Boolean))];
      const allLocs = (App.inventoryData.ic_locations || []).filter(l => !l.archived).map(l => l.name);
      const type = (countedLocs.length === allLocs.length && allLocs.length > 0) ? 'Full'
        : (countedLocs.length === 1 ? countedLocs[0] : 'Multi-Location');
      return { id:uid(), date:dateStr(daysAgo), type, counted_by:countedBy || 'Maria G.',
        // Derived from the items, not a hardcoded list: Take Inventory writes exactly the
        // locations it counted, and a seeded count that names a different set is a count the
        // form could never have produced.
        locations:[...new Set(items.map(it => it.location).filter(Boolean))],
        items:items, item_count:items.length,
        total_value:+items.reduce((s, it) => s + it.value, 0).toFixed(2),
        created_at:daysAgoISO(daysAgo) };
    };
    /* ⚠⚠⚠ THE OLDER COUNTS ARE DERIVED FROM THE DELIVERIES, NOT INVENTED (2026-07-31, walking the
       live demo). They used to be a hand-picked oscillation around the day-7 level — multipliers
       1.05 / 0.92 / 1.10 / 0.86 / 1.03 / 0.95 / 1.09 — with a day-14 count extrapolated to
       `[1] + ([1] - [0])`. **Stock cannot be authored independently of purchases.** Usage is
       `starting + purchases - ending`, so once the deliveries are fixed, every count total is
       DETERMINED by the count either side of it. Inventing both ends produced usage that had
       nothing to do with the bar:
         MEASURED on the live demo, week by week: $6,307 · $4,939 · $6,534 · $3,211 · $6,513 ·
         $5,508 · **$615** · $6,115 · $5,205 — against a booked weekly COGS of a steady ~$5,100.
       The $615 week is the one that hurt: split by category it is a **BAR COGS of -$970.46**, and
       Confirm the Week's "Refresh from Control" will pull that negative straight into a signed-off
       week. On screen it also read as a bar losing half its stock in seven days ("vs Last Count
       -$5,205"), with the count series lurching $9,216 → $15,922 → $10,717 → $5,511.
       ⭐ THE FIX IS THE IDENTITY, SOLVED BACKWARDS from the day-7 count:
             count(older) = TARGET_WEEKLY_COGS + count(newer) - purchases(window)
       The deliveries are the detailed records (real vendors, line prices, the price rises Vendor
       Watch surfaces, the rows Order History matches), so THEY are the truth and the counts
       reconcile to them. These multipliers are that solution, rounded to four places. Verified
       against the shipped `S.ThisWeek.icCOGS`: every window now returns $5,100 against a booked
       $5,092-$5,321, and nothing is negative.
       ⚠ DO NOT "TIDY" THESE INTO A NEATER SERIES. They look irregular because the weekly delivery
       spend is irregular ($4,589 to $6,902); a smooth series here means a jagged COGS there. If a
       delivery is ever added, moved or repriced, RE-SOLVE the chain — do not adjust one number.
       ⚠ The last two windows are deliberately dry ($910, then $0). That is the demo's story and it
       is why on-hand slides from ~$14.9k to $5,511: the bar stopped ordering, which is exactly what
       "Below Par $4,234" and the Order Sheet's "$2,199.70 to order" are telling them to fix.
       Weekly counts still begin ~63 days back: the operator spent the first weeks setting up. */
    const icOlderCounters = ['Carlos P.', 'Maria G.', 'Jake T.'];
    // solved to a $5,100 weekly COGS — the figure is in the note above, not a const nothing reads
    const icOlderWeeks = [
      [21, 1.3743], [28, 1.2062], [35, 1.2538], [42, 1.1901], [49, 1.2264],
      [56, 1.1607], [63, 1.1889]
    ];
    App.inventoryData.ic_counts = [
      // day 14 is part of the same solved chain — it used to be extrapolated
      // (`[1] + ([1] - [0])`), which spiked it to $15,922 and gave the week after
      // it only $615 of usage.
      mkCount(14, i => +(icTotals[i][1] * 1.3910).toFixed(2)),
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
    // The four most recent invoices are captured so the seeded vendor
    // discrepancies below can tie to the delivery they were flagged on.
    const delRN1 = mkDelivery(31, 'Republic National', 'RN-55021', [
      icDLine(icProducts[0], 24, 21.40, 21.40),
      icDLine(icProducts[1], 18, 23.60, 23.60),
      icDLine(icProducts[2], 12, 27.90, 27.90),
    ]);
    const delGLZ = mkDelivery(24, "Glazer's Beer & Bev", 'GLZ-3318', [
      icDLine(icProducts[6], 20, 32.40, 30.72),
      icDLine(icProducts[7], 15, 22.80, 22.80),
    ]);
    const delSY = mkDelivery(17, 'Sysco Foods', 'SY-90455', [
      icDLine(icProducts[9],  200, 4.20, 3.95),
      icDLine(icProducts[10], 160, 2.95, 2.95),
      icDLine(icProducts[11], 80,  4.60, 4.60),
    ]);
    const delRN2 = mkDelivery(10, 'Republic National', 'RN-55190', [
      icDLine(icProducts[0], 24, 22.40, 21.40),
      icDLine(icProducts[3], 12, 31.00, 31.00),
    ]);
    App.inventoryData.ic_deliveries = [delRN1, delGLZ, delSY, delRN2];

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
      // 'PM' was not a service period (S219) — ic-spot-check's own picker is App.SHIFT_TYPES.
      id:uid(), date:dateStr(daysAgo), location:'Main Bar', shift:'Dinner', checked_by:'Maria G.',
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
    // Each is tied to the delivery it was flagged on (so it shows in Delivery
    // History and the Credits to Chase list). All recent, none aging past 60 days.
    // Feeds Inventory Execution + the BCA.
    App.data.vendor_discrepancies = [
      { id:uid(), date:dateStr(31), vendor:'Republic National', reference:'RN-55021', type:'Overcharge',
        product_id:icProducts[0].id, sku:icProducts[0].name, units:24, agreed_price:21.40, invoiced_price:22.65,
        overcharge:30, notes:'Billed above agreed case price', status:'Resolved', source:'inventory', delivery_id:delRN1.id,
        filed_at:daysAgoISO(31), resolved_at:daysAgoISO(24), recovered_amount:30 },
      { id:uid(), date:dateStr(17), vendor:'Sysco Foods', reference:'SY-90455', type:'Short Delivery',
        product_id:icProducts[9].id, sku:icProducts[9].name, units:8, agreed_price:4.20, invoiced_price:4.20,
        overcharge:34, notes:'Two cases short, caught at receiving', status:'Resolved', source:'inventory', delivery_id:delSY.id,
        filed_at:daysAgoISO(17), resolved_at:daysAgoISO(10), recovered_amount:34 },
      { id:uid(), date:dateStr(31), vendor:'Republic National', reference:'RN-55021', type:'Overcharge',
        product_id:icProducts[2].id, sku:icProducts[2].name, units:12, agreed_price:27.90, invoiced_price:28.90,
        overcharge:12, notes:'Price drift on a single line', status:'Resolved', source:'inventory', delivery_id:delRN1.id,
        filed_at:daysAgoISO(31), resolved_at:daysAgoISO(22), recovered_amount:12 },
      { id:uid(), date:dateStr(24), vendor:"Glazer's Beer & Bev", reference:'GLZ-3318', type:'Overcharge',
        product_id:icProducts[6].id, sku:icProducts[6].name, units:48, agreed_price:1.35, invoiced_price:1.50,
        overcharge:72, notes:'Unagreed price increase, credit requested', status:'Credit Requested', source:'inventory', delivery_id:delGLZ.id,
        filed_at:daysAgoISO(24), credit_requested_at:daysAgoISO(9), resolved_at:null },
    ];
    // Stamp the flagged delivery line so Delivery History reads File / Filed / Resolved.
    (function stampDiscLines() {
      const vd = App.data.vendor_discrepancies;
      const mark = (del, rec) => {
        const li = (del.line_items || []).find(l => l.product_id === rec.product_id);
        if (li) li.discrepancy_id = rec.id;
        del.has_discrepancy = true;
      };
      mark(delRN1, vd[0]); mark(delSY, vd[1]); mark(delRN1, vd[2]); mark(delGLZ, vd[3]);
    })();

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
      // Local wall-clock (matches ic-adjustments.nowDateTime), NOT toISOString/UTC —
      // a UTC evening time rolls hours/a day and is not reproducible by a real user.
      const p2 = n => String(n).padStart(2, '0');
      return App.ymdLocal(d) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes());
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
    // Current week, mid-close: the operator has run their end-of-week sales import
    // (one file, the WHOLE week), so Shift's Close The Week shows the full week's
    // revenue with step 1 done. Live: a fresh week is zero until imported.
    // The week is seeded whole even though part of it is still ahead of today. That is
    // deliberate and disclosed in the demo banner: see the note by `dateStr` above for
    // why a part-week seed is worse (it breaks prime cost and the cockpit stamps).
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
    // S179: the seed templates share one new Date().toISOString(), and byCreation ties on it, so
    // Checklist Templates would render them reversed. Stamp each one step apart to keep authored order.
    App.shiftData.sc_checklist_templates.forEach((t, i) => { t.created_at = new Date(Date.now() + i).toISOString(); });
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
          const exp = 600 + Math.round(rnd() * 350);
          const variance = improving
            ? Math.round((rnd() - 0.55) * 12)
            : Math.round((rnd() - 0.75) * 30);
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
    // Current week's drawer counts, mirroring the current-week sc_shifts block above (curBaseAgo,
    // whole-week) so the week the operator just imported is ALSO cash-counted — otherwise the weekly
    // rollup reads "Not counted" over a week that shows sales and a ticked Reconcile Cash step.
    if (curWk) {
      const improving = !curWk.loose;
      for (let di = 0; di < 7; di++) {
        const date = dateStr(curBaseAgo + 6 - di);
        activeRegs.forEach((dr, ri) => {
          const exp = 600 + Math.round(rnd() * 350);
          const variance = improving ? Math.round((rnd() - 0.55) * 12) : Math.round((rnd() - 0.75) * 30);
          const tol = (dr.cash_tolerance != null) ? dr.cash_tolerance : 10;
          scVariances.push({
            id:uid(), date:date,
            drawer_id: dr.id, drawer: dr.name,
            cashier:mgrs[(curWk.wk + di + ri) % 3],
            source:'import',
            expected_cash:exp, counted_cash:exp + variance, variance:variance,
            tolerance:tol, status:Math.abs(variance) <= tol ? 'Within Tolerance' : variance < 0 ? 'Short' : 'Over',
            reason:'', notes:'', created_at:new Date().toISOString()
          });
        });
      }
    }
    App.shiftData.sc_variances = scVariances;

    // Voids and comps — fewer events and all manager-authorized after the fix.
    // Phase 0: comp records carry product_id + units so the Inventory Variance
    // Report can subtract comp pours from "used." Voids stay product-less
    // (assumed pre-pour, not subtracted from variance). staff_id gets patched
    // in after lcStaff is built (below).
    const vcServers = ['Jessica M.', 'Marcus T.', 'Brianna K.', 'Devin R.', 'Carlos P.'];
    const findProdId = (name) => (icProducts.find(p => p.name === name) || {}).id || '';
    const findMenuId = (name) => (((App.data && App.data.menu_items) || []).find(m => m.name === name) || {}).id || '';
    // Service periods only (S219) — 'Brunch' is not one this profile runs. sc-void-comp's picker is
    // App.SHIFT_TYPES, so a seeded void on a period the operator does not have could not be re-entered.
    const vcShifts = ['Dinner', 'Late Night', 'Dinner', 'Lunch', 'Happy Hour', 'Dinner'];
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
        const dropAmount = 900 + Math.round(rnd() * 500);
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
    /* ⭐ THE REPAIR MONEY LIVES IN THE LEDGER, NOT ON THE TICKETS (Kyle, 2026-08-05). The
       maintenance log is a pure tracker now, so seeding a `cost` on it would seed a field the app
       no longer has and the demo would show repairs the Income Statement could not explain. These
       are ordinary expense rows, exactly what a live operator produces on Close The Books, which
       keeps the seed honest to the round-trip rule. Dates match the tickets they pay for. */
    [[10, 310, 'Dish Machine - sanitizing temp'], [10, 220, 'Walk-in Cooler - door gasket'],
     [16, 140, 'POS Terminal 2 - card reader'], [21, 85, 'Mens Restroom - faucet']]
      .forEach(([back, amt, what]) => App.data.operating_expenses.push({
        id: uid(), date: dateStr(back), category: 'Repairs and Maintenance', vendor: '',
        amount: amt, notes: what, created_at: new Date().toISOString() }));
    App.shiftData.sc_maintenance = [
      { id:uid(), date_reported:dateStr(3),  equipment:'Walk-in Cooler', location:'Kitchen',
        issue:'Temperature running 4 degrees high', priority:'High', status:'Open',
        reported_by:'Luis V.', assigned_to:'CoolTech Repair',  notes:'', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(6),  equipment:'Beer Tap 3', location:'Main Bar',
        issue:'Foaming, needs line cleaning and FOB check', priority:'Normal', status:'Open',
        reported_by:'Jake T.', assigned_to:'',  notes:'', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(8),  equipment:'Ice Machine', location:'Main Bar',
        issue:'Slow ice production', priority:'Normal', status:'In Progress',
        reported_by:'Maria G.', assigned_to:'CoolTech Repair',  notes:'Tech scheduled', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(11), equipment:'Dish Machine', location:'Kitchen',
        issue:'Not reaching sanitizing temp', priority:'Urgent', status:'Resolved',
        reported_by:'Luis V.', assigned_to:'Ecolab',  notes:'', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(14), equipment:'Walk-in Cooler', location:'Kitchen',
        issue:'Door gasket torn, not sealing', priority:'High', status:'Resolved',
        reported_by:'Hector M.', assigned_to:'CoolTech Repair',  notes:'', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(18), equipment:'Glass Washer', location:'Main Bar',
        issue:'Leaving spots, rinse aid line', priority:'Low', status:'Resolved',
        reported_by:'Ashley B.', assigned_to:'',  notes:'Adjusted rinse aid in-house', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(20), equipment:'POS Terminal 2', location:'Front of House',
        issue:'Card reader intermittent', priority:'Normal', status:'Resolved',
        reported_by:'Jessica M.', assigned_to:'POS Vendor',  notes:'', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(25), equipment:'Mens Restroom', location:'Front of House',
        issue:'Faucet leaking at the base', priority:'Low', status:'Resolved',
        reported_by:'Owen L.', assigned_to:'Handyman',  notes:'', created_at:new Date().toISOString() },
      { id:uid(), date_reported:dateStr(30), equipment:'HVAC', location:'Dining Room',
        issue:'Dining room runs warm on busy Saturdays', priority:'Normal', status:'Open',
        reported_by:'Carlos P.', assigned_to:'CoolTech Repair',  notes:'', created_at:new Date().toISOString() },
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
    // building: two clean weekends, then a Watch (cash mix running high AND the
    // first refunds showing), then a High (heavy no-sales, a high void rate, more
    // refunds). Two signals on the Watch weekend on purpose: a server flags on a
    // composite, never on one outlier, so a one-signal weekend reads clean by
    // design. On the current weekend a second
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
        { ago:9,  bad:{ net_sales:1620, cash_sales:680, card_sales:940,  voids:24, void_count:2, no_sales:2, refunds:26 } }, // Watch (cash mix + first refunds)
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
      { name:'Manager',   department:'Management',     pay_type:'Salary', default_salary:68000, tipped:false },
      // The AM runs the bar, so her department is Bar and her pay lands on the bar's
      // P&L. This is load-bearing, not cosmetic: this-week.laborCost buckets EVERY row
      // by its position's department with `posDept === 'Bar' ? bar : food`, so anything
      // not Bar falls on FOOD. Parked in Management, her $780/wk landed on a $2,136
      // food budget alongside the GM's $510 share, leaving $846 for 4 cooks and 7 FOH
      // (a line cook logged 1.7 h/day). Her hours are allocated out of bar_labor below
      // to match. She is still not IN lcBar (that list is by position name), so nothing
      // else moves.
      { name:'Assistant Manager', department:'Bar', default_wage:24, tipped:false },
    ].map((p, i) => ({ id:uid(), created_at:new Date(Date.now() + i).toISOString(), ...p }));   // S179: space created_at so byCreation keeps authored order
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
      mkSalaried('Carlos P.', 'Manager',           68000, 520),   // the one salaried GM
      mkStaff('Renee K.',     'Assistant Manager', 24,    300),   // hourly assistant manager
    ];
    App.laborData.lc_staff = lcStaff;
    // Recurring days off for a few staff (feeds Build Schedule's day-off block).
    // Recurring days off, set on days each person is not already scheduled in the
    // seed (so the loaded current-week schedule shows no false day-off conflicts).
    const setOff = (nm, days) => { const st = lcStaff.find(s => s.name === nm); if (st) st.off_days = days; };
    setOff('Priya N.', ['Mon', 'Tue']);
    setOff('Owen L.',  ['Tue']);
    setOff('Ashley B.', ['Wed']);
    // Two hourly key employees (shift leads) who run the floor when the GM is off.
    ['Maria G.', 'Jessica M.'].forEach(nm => { const st = lcStaff.find(s => s.name === nm); if (st) st.shift_lead = true; });

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
        const amount = 20 + Math.round(rnd() * (improving ? 55 : 100));
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
      { cat:'Food',        reason:'Expired / Past Date',              units:3,  who:'Luis V.',   shift:'Lunch',      day:1 },
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

    // Pre-Shift Briefings — a realistic run of daily line-ups over the last few
    // weeks (not every single day, so the discipline read stays honest, not a flat
    // 100). Feeds the Pre-Shift Briefing history + the Bar Cop Audit opt-in read.
    // Each briefing carries its service period. A couple of days hold two (a Happy
    // Hour and a Dinner line-up), so the per-period model shows in the history.
    const briefSeed = [
      { ago: 2,  period: 'Dinner',      focus: 'Push the fall cocktail list, name a pairing at every table.' },
      { ago: 2,  period: 'Happy Hour',  focus: 'Well pours are running heavy, tighten them up before the rush.' },
      { ago: 4,  period: 'Dinner',      focus: 'Dessert attach is soft. Offer both, every table.' },
      { ago: 6,  period: 'Lunch',       focus: 'New server on section 3, back them up and watch the section.' },
      { ago: 9,  period: 'Dinner',      focus: 'Big party at 7. Prep the private room early.' },
      { ago: 11, period: 'Dinner',      focus: 'Feature the salmon tonight, best margin on the board.' },
      { ago: 13, period: 'Happy Hour',  focus: 'Slow Tuesday. Work the bar and sell the app.' },
      { ago: 16, period: 'Dinner',      focus: 'Wine dinner Thursday, mention it to every four-top.' },
      { ago: 18, period: 'Dinner',      focus: 'Weekend rush. Keep the second-round check tight.' }
    ];
    App.shiftData.sc_briefings = briefSeed.map(b => ({
      id: uid(), date: dateStr(b.ago), period: b.period, focus: b.focus,
      stars_count: 4, stars: [], featured: [], check_target: 40, covers_forecast: null, held: true,
      created_at: new Date().toISOString()
    }));

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
    // Management is ONE salaried GM plus an HOURLY assistant manager. The blended
    // labor % from the profile is the TOTAL labor target, so the hourly crew + the AM
    // carry (total - GM salary), and the GM's fixed pay is added back by
    // App.salariedCost everywhere labor is read. Keeps total labor consistent (hourly
    // actuals + salary = the blended %) AND realistic (a lean recovered crew, not the
    // whole budget loaded onto hourly with salary stacked on top).
    const gmStaff  = lcStaff.filter(s => s.pay_type === 'Salary');   // the one salaried GM
    const weeklySalaried = gmStaff.reduce((sum, s) => sum + ((parseFloat(s.annual_salary) || 0) / 52), 0);
    const amStaff  = lcStaff.find(s => s.name === 'Renee K.');        // hourly assistant manager
    const amHrs    = 6.5;                                             // her shift length, 5 days
    const amWeekly = amStaff ? +(amStaff.wage * amHrs * 5).toFixed(2) : 0;
    // The GM logs coverage hours at 0 hourly cost (salary added by salariedCost); the
    // hourly AM logs real hours/cost, carved out of the food labor budget below.
    const seedLeaders = (baseAgo) => {
      /* ⚠ BLANK, NOT 'Full Day' (S219). These are LOGGED HOURS, and Log Hours' picker is
         `['', ...App.SHIFT_TYPES]` — it offers blank but never 'Full Day', so the operator could not
         reproduce these rows. Blank is also the honest answer for a salaried manager working
         open-to-close: no single service period. (`sc_shifts` above keeps 'Full Day' on purpose —
         that is what the shipped `buildSales` writes and what hub-books' join expects.) */
      gmStaff.forEach(st => { for (let d = 0; d < 5; d++) lcActuals.push({ id:uid(), date:dateStr(baseAgo + 5 - d), staff_id:st.id, name:st.name, position_id:st.position_id, shift_type:'', hours:9, wage:0, cost:0, notes:'' }); });
      if (amStaff) for (let d = 0; d < 5; d++) lcActuals.push({ id:uid(), date:dateStr(baseAgo + 5 - d), staff_id:amStaff.id, name:amStaff.name, position_id:amStaff.position_id, shift_type:'', hours:amHrs, wage:amStaff.wage, cost:+(amHrs * amStaff.wage).toFixed(2), notes:'' });
    };
    // Hours actually seeded into lc_actuals, per week. This is the ONLY honest source
    // for revenue_weeks.total_hours: a live re-confirm reads laborFeed(), which sums
    // every lc_actuals hour in the week (salaried managers included, by its own
    // comment). See the reconcile pass right below the loop.
    const seededHrs = {}, seededOT = {};
    ANCHL.weeks.forEach(a => {
      const baseAgo  = sunOff + ANCHS.endAgo(a);
      const totLab   = a.bar_labor + a.food_labor;
      const barSal   = totLab > 0 ? weeklySalaried * (a.bar_labor / totLab) : 0;
      const foodSal  = weeklySalaried - barSal;
      // The AM's position is in the Bar department, so laborCost books her pay to BAR.
      // Carve her out of the BAR budget to match, and leave the food budget whole for
      // the crew. The bar/food hourly ratio is unchanged either way (the same $780 just
      // sits on the other side), so the GM's salary still splits 61/39 and both
      // departments still foot their seeded labor exactly.
      const foodCrew = Math.max(0, a.food_labor - foodSal);
      const rowsBefore = lcActuals.length;
      // Bar weights are deliberately top-heavy: Maria is the seeded shift lead and runs
      // a real full-time week (44.1 h) while the other three are part-time (22-26 h).
      // That is what a bar this size actually staffs, AND it is the demo's only genuine
      // overtime: she crosses 40 by 4.1 h, so the Hub's "Overtime projected" alert and
      // Overtime Watch have something true to show. An even spread across four
      // bartenders leaves nobody over 40 and those screens go dark. The weights sum to
      // 1.00, so the bar budget still foots either way.
      lcAllocate(lcBar,     [0.40, 0.24, 0.20, 0.16],       Math.max(0, a.bar_labor - barSal - amWeekly), baseAgo, ['Dinner', 'Late Night', 'Dinner', 'Brunch', 'Late Night']);
      lcAllocate(lcKitchen, [0.30, 0.27, 0.24, 0.19],       foodCrew * 0.5, baseAgo, ['Lunch', 'Dinner', 'Dinner', 'Brunch', 'Lunch']);
      lcAllocate(lcFloor,   [0.20, 0.18, 0.17, 0.16, 0.13, 0.08, 0.08], foodCrew * 0.5, baseAgo, ['Brunch', 'Lunch', 'Dinner', 'Dinner', 'Lunch']);
      seedLeaders(baseAgo);
      const wkRows = lcActuals.slice(rowsBefore);
      seededHrs[a.wk] = +wkRows.reduce((s, r) => s + (r.hours || 0), 0).toFixed(1);
      // The OT premium is NEVER stored in lc_actuals (they are straight time only), so
      // every weekly rollup has to add it. Read it off the rows through the canonical
      // helper, never re-implement the reg/OT wage math ([[labor-cost-model]]).
      seededOT[a.wk] = App.otPremiumForRows ? +(App.otPremiumForRows(wkRows).total || 0).toFixed(2) : 0;
    });

    // ── Reconcile revenue_weeks to the rows that actually shipped ──────────────
    // total_hours / rplh_blended were derived up top from a FORMULA
    // (bar_labor/16 + kitchen/15 + floor/14), which divides the FULL blended labor
    // DOLLARS by assumed wage rates. But the actuals above carve the GM's salary out
    // and log him at wage 0, and pay the crew at their REAL wages, so the formula
    // never matched the rows: ~16% high on all 13 weeks (356.3 seeded vs 307.5 on a
    // re-confirm), which put RPLH at $53.75 against the $75 target on the Revenue
    // Dashboard while the audit dated TODAY scored S2_RPLH 80 and narrated "the build
    // is tight". Two numbers 50% apart on adjacent screens, and "Refresh This Week"
    // jumped the figure with nothing changed. Deriving both from the seeded rows makes
    // the tie-out STRUCTURAL: the seed cannot drift from a live re-confirm again.
    // RPLH's numerator is bar + floor, matching confirm-week's totRev for these weeks
    // (the seed carries no catering revenue: it comes only from Completed bookings).
    (App.data.revenue_weeks || []).forEach(rw => {
      const h = seededHrs[rw.week_num];
      if (!(h > 0)) return;
      rw.total_hours  = h;
      rw.rplh_blended = +(((rw.bar_revenue || 0) + (rw.floor_revenue || 0)) / h).toFixed(2);
    });

    // ── labor_pct_blended + prime_cost_pct: TOTAL-SALES basis, OT premium included ──
    // Both came straight off the ANCHOR, which measures them against `total_rev` =
    // bar + food only and leaves ancillary COGS out of prime entirely. The live app
    // measures BOTH against totSales (bar+food+catering+ancillary) and folds oCogs into
    // prime ([[labor-cost-model]] DENOMINATORS; confirm-week `_figures`), and its labor
    // carries the OT premium that lc_actuals never store. So a re-confirm moved the
    // seeded numbers on every week that has either. Derive them from the shipped rows
    // and the shipped week record instead, so the seed and a live re-confirm agree by
    // construction. Ancillary lands on weeks 4/8/12 (`othRev`); catering is 0 on every
    // seeded week (it comes only from Completed bookings), but it is read here rather
    // than assumed so this keeps holding if that changes.
    (App.data.weeks || []).forEach(pw => {
      const ot   = seededOT[pw.week_num] || 0;
      const bRev = (pw.bar && pw.bar.revenue) || 0,   fRev = (pw.food && pw.food.revenue) || 0;
      const cRev = (pw.catering && pw.catering.revenue) || 0, oRev = (pw.other && pw.other.revenue) || 0;
      const totSales = bRev + fRev + cRev + oRev;
      if (!(totSales > 0)) return;
      // ⚠ THE PREMIUM GOES INTO THE LABOR MONEY, not just into the percentages.
      // It used to be added only to the `labor` local below, so prime_cost_pct and
      // labor_pct_blended carried a premium that pw.bar.labor / pw.food.labor did not.
      // Two things broke, on all 13 seeded weeks: the Weekly P&L Brief printed a Prime
      // Cost % that did not equal its own Total Prime Cost / Total Revenue (off ~0.2
      // points), and weeks[] disagreed with revenue_weeks.total_labor_cost by ~$35 on
      // the SAME week — a number an accountant foots by hand. A live confirm has no
      // such split: this-week.laborCost hands ConfirmWeek a bar/food labor figure with
      // the premium already in it, so bLab/fLab and primeCost cannot disagree. Match
      // that shape — the premium lands on Bar/Food by their share of the week's labor,
      // exactly as this-week.laborCost splits it (and as salary is split above).
      // Round each side BEFORE summing, so what the sheet prints is what the total adds.
      if (ot > 0 && pw.bar && pw.food) {
        const bL = pw.bar.labor || 0, fL = pw.food.labor || 0, h = bL + fL;
        if (h > 0) { pw.bar.labor = +(bL + ot * (bL / h)).toFixed(2); pw.food.labor = +(fL + ot * (fL / h)).toFixed(2); }
        else { pw.food.labor = +(fL + ot).toFixed(2); }
        // The department labor % is derived from that same money (confirm-week barLabPct
        // / foodLabPct), so it has to follow or the record disagrees with itself.
        if (bRev > 0) pw.bar.labor_pct  = pw.bar.labor  / bRev * 100;
        if (fRev > 0) pw.food.labor_pct = pw.food.labor / fRev * 100;
      }
      const labor = ((pw.bar && pw.bar.labor) || 0) + ((pw.food && pw.food.labor) || 0)
                  + ((pw.catering && pw.catering.labor) || 0);
      const prime = ((pw.bar && pw.bar.cogs) || 0) + ((pw.food && pw.food.cogs) || 0)
                  + ((pw.catering && pw.catering.cogs) || 0) + ((pw.other && pw.other.cogs) || 0) + labor;
      pw.prime_cost_pct = +(prime / totSales * 100).toFixed(2);
      const rw = (App.data.revenue_weeks || []).find(r => r.week_num === pw.week_num);
      if (!rw) return;
      // Recovery dollarizes a point of labor_pct_blended against its `base`, and that
      // base must be the denominator the value was measured against. Without these two
      // fields `_rTotSales` can only reach bar+floor, so the leak dollars would run
      // light by exactly catering's and ancillary's share (see recovery.js, and the
      // BASE RULE). Seeding the value on a totSales basis REQUIRES seeding them.
      rw.catering_revenue  = cRev;
      rw.other_revenue     = oRev;
      rw.total_labor_cost  = +labor.toFixed(2);
      rw.hourly_labor_cost = +Math.max(0, labor - WEEKLY_GM_SALARY).toFixed(2);
      rw.labor_pct_blended = +(labor / totSales * 100).toFixed(2);
      // hourly_labor_pct stays on BAR + FOOD only: its numerator excludes the catering
      // crew, and it must equal Recovery's labor-scheduling base. Different metric,
      // different basis, on purpose.
      const fbRev = bRev + fRev;
      if (fbRev > 0) rw.hourly_labor_pct = +(Math.max(0, labor - WEEKLY_GM_SALARY) / fbRev * 100).toFixed(2);
    });
    // Current week, mid-close: the operator has imported this week's hours, so
    // Labor's Close The Week shows the full week with step 1 done. Live: zero
    // until imported. Latest week's labor through the same allocator.
    const curL = ANCHL.weeks.reduce((m, a) => (ANCHS.endAgo(a) < ANCHS.endAgo(m) ? a : m), ANCHL.weeks[0]);
    const curLBase = sunOff - 7;
    if (curL) {
      const cTot      = curL.bar_labor + curL.food_labor;
      const cBarSal   = cTot > 0 ? weeklySalaried * (curL.bar_labor / cTot) : 0;
      const cFoodSal  = weeklySalaried - cBarSal;
      const cFoodCrew = Math.max(0, curL.food_labor - cFoodSal);   // AM sits on the bar, as above
      lcAllocate(lcBar,     [0.40, 0.24, 0.20, 0.16],       Math.max(0, curL.bar_labor - cBarSal - amWeekly), curLBase, ['Dinner', 'Late Night', 'Dinner', 'Brunch', 'Late Night']);
      lcAllocate(lcKitchen, [0.30, 0.27, 0.24, 0.19],       cFoodCrew * 0.5, curLBase, ['Lunch', 'Dinner', 'Dinner', 'Brunch', 'Lunch']);
      lcAllocate(lcFloor,   [0.20, 0.18, 0.17, 0.16, 0.13, 0.08, 0.08], cFoodCrew * 0.5, curLBase, ['Brunch', 'Lunch', 'Dinner', 'Dinner', 'Lunch']);
      seedLeaders(curLBase);
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
      'Assistant Manager': [
        { days:['Tue','Wed','Thu','Fri','Sat'], start:'15:30', end:'22:00', hours:6.5 }, // hourly AM, dinner floor
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
    /* ⚠⚠ A SEEDED SCHEDULE MUST STORE THE SAME SHAPE THE REAL DOOR STORES (L2). `total_cost` is a
       stored snapshot that Schedule History renders without recomputing, and
       `lc-build-schedule.save()` writes hourly + the OT premium + salaried — every cost number is
       TOTAL labor ([[labor-cost-model]]). The seed wrote hourly straight time only, so the same
       week read "$5,680.50 · 29.7%, inside a 30% target" on Schedule History and
       "SCHEDULED $6,988.19 · OVER BUDGET $754.79" on Build Schedule, on the shipping demo, before
       anyone touched anything. Proven by re-saving that very schedule through the real door: the
       stored figure moved 5,680.50 -> 6,988.19 and 29.66% -> 33.63%. The code was right; this was.
       ⚠ Guarded, because the seed also runs before App.salariedCost has a roster to read on some
       paths — a missing helper must cost nothing, never throw mid-seed. */
    const schedExtras = (weekStart, shifts) => {
      let extra = 0;
      try {
        const we = new Date(weekStart + 'T00:00:00'); we.setDate(we.getDate() + 6);
        if (App.salariedCost) extra += (App.salariedCost(weekStart, App.ymdLocal(we)) || {}).total || 0;
        if (App.otPremiumForRows) {
          const rows = (shifts || []).map(sh => ({ staff_id: sh.staff_id, name: sh.name,
            date: weekStart, hours: sh.hours || 0, cost: sh.cost || 0 }));
          extra += (App.otPremiumForRows(rows) || {}).total || 0;
        }
      } catch (e) { extra = extra || 0; }
      return extra;
    };
    const buildSchedule = (weekStart, forecast) => {
      const shifts = expandPlan(SCHED_PLAN).map(({ st, day, plan }) => ({
        staff_id:st.id, name:st.name, position_id:st.position_id, day:day,
        start:plan.start, end:plan.end, hours:plan.hours, wage:st.wage,
        cost:+(plan.hours * st.wage).toFixed(2) }));
      const total_hours = shifts.reduce((s, x) => s + x.hours, 0);
      const total_cost  = +(shifts.reduce((s, x) => s + x.cost, 0) + schedExtras(weekStart, shifts)).toFixed(2);
      return { id:uid(), week_start:weekStart, revenue_forecast:forecast, shifts:shifts,
        total_hours:total_hours, total_cost:total_cost,
        labor_pct:+(total_cost / forecast * 100).toFixed(2),
        rplh:+(forecast / total_hours).toFixed(2),
        notes:'', status:'Posted', created_at:new Date().toISOString() };
    };
    /* ⚠⚠ THE DEMO PLANS AHEAD, BECAUSE REAL BARS DO (Kyle, 2026-08-01). This stopped at the CURRENT
       week, so on any day of the week the Labor cockpit's step 3 sat ticked over "Next week not
       built yet" — a bar that had apparently never written a schedule in advance. Nobody waits
       until Sunday night to staff the following week; the schedule goes up mid-week so people can
       plan their lives.
       ⚠ AND THE FIRST FIX WAS THE WRONG ONE. I rewrote the step's subtitle so it told the truth and
       left the contradiction standing — better words on the same disagreement. The state should not
       arise at all. With next week posted, the tick, the subtitle and the workspace all say the
       same thing, and `stepStatus` reading the store (L1) becomes the honest fallback for a live
       operator who ticks the step without building, rather than the demo's normal state.
       `mondayISO` counts days BACKWARDS, so next week is a negative argument. */
    App.laborData.lc_schedules = [
      buildSchedule(mondayISO(21), 17980),
      buildSchedule(mondayISO(14), 18420),
      buildSchedule(mondayISO(7),  18812),
      buildSchedule(mondayISO(0),  19150),
      buildSchedule(mondayISO(-7), 19500),
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
      // L2 — the same total shape as buildSchedule and as lc-build-schedule.save().
      sched.total_cost  = +(sched.shifts.reduce((s, x) => s + (x.cost || 0), 0)
        + schedExtras(sched.week_start, sched.shifts)).toFixed(2);
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
        const cash = earner ? Math.round(base * (0.30 + rnd() * 0.22)) : 0;
        const card = earner ? Math.round(base * (0.92 + rnd() * 0.40)) : 0;
        const sales = earner ? Math.round((role === 'Bartender' ? 1450 : 1150) + rnd() * 450) : 0;
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
      const asc = [...(App.inventoryData.ic_counts || [])].sort(App.cmpOldest);
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
    const seedIc = await App.seedEventStores('ic');     // inventory event logs -> ic_events rows
    await App.saveLabor();               // config only (staff, positions, schedule templates, certs, notes)
    const seedLc = await App.seedEventStores('lc');     // labor event logs -> lc_events rows
    await App.saveShift();               // config only (settings, drawers, checklist templates)
    const seedSc = await App.seedEventStores('sc');     // shift event logs -> sc_events rows

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
      // Only covered sub-scores become sections, so the Data Quality badge reads
      // the true coverage (N/A sub-scores are absent, not stored as null).
      BCA_LABELS.forEach((l, i) => { if (subs[i] != null) sections[l] = subs[i]; });
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
    // Seed-time 3-line findings for the cash audits, built off the same numbers
    // and in the same voice as the live c-audit engine, so every cash audit
    // (milestones and weekly fills) reads the same as Profit, Revenue, and Bar Cop.
    const _cashFindings = (r) => {
      const cur = v => App.fmtCurrency(v);
      const dtxt = v => Math.round(v) + ' day' + (Math.round(v) === 1 ? '' : 's');
      const o = {};
      if (r.S1_SCORE != null) {
        const turns = r.BLENDED_TURNS != null ? 'Your shelf cash turns about ' + r.BLENDED_TURNS.toFixed(1) + ' times a year. ' : '';
        if (r.TRAPPED_CASH > 0) {
          o.S1_NARRATIVE = 'You have ' + cur(r.TRAPPED_CASH) + ' of shelf cash frozen in slow movers and overstock, against ' + cur(r.INVENTORY_VALUE) + ' on hand. That is money working too little.';
          o.S1_FINDING = turns + 'Freeing it puts real money back in the account.';
          o.S1_TOOL = 'Run the dead stock down and cut the over-par in Trapped Cash, then hold pars to real usage so it does not pile back on the shelf.';
        } else {
          o.S1_NARRATIVE = 'Almost none of your shelf cash is trapped. Your inventory is working.';
          o.S1_FINDING = turns + 'The shelf is turning cash, not holding it.';
          o.S1_TOOL = 'Hold it. Keep ordering to par so cash does not pile back onto the shelf.';
        }
      }
      if (r.S2_SCORE != null && r.CYCLE_DAYS != null) {
        if (r.CYCLE_DAYS > 0) {
          o.S2_NARRATIVE = 'Your cash is locked about ' + dtxt(r.CYCLE_DAYS) + ': product sits ' + dtxt(r.DIO) + ' and you take ' + dtxt(r.DPO) + ' to pay.';
          o.S2_FINDING = 'About ' + cur(r.LOCKED_CASH) + ' is tied up in that cycle, and every day you shorten it frees roughly ' + cur(r.DAILY_COGS) + '.';
          o.S2_TOOL = 'Order to par to cut the days product sits, and hold your terms to stretch the days you pay.';
        } else {
          o.S2_NARRATIVE = 'Your cash comes back before the bills are due. Product sits ' + dtxt(r.DIO) + ' and you take ' + dtxt(r.DPO) + ' to pay.';
          o.S2_FINDING = 'Your vendors are financing your inventory. That is the right side of the cycle.';
          o.S2_TOOL = 'Hold it. Keep ordering to par and paying on the due date.';
        }
      }
      if (r.S3_SCORE != null) {
        const safeTxt = (r.SAFE_TO_SPEND != null && r.SAFE_TO_SPEND < 0) ? ' Your Safe to Spend is under zero, you are leaning on money already spoken for.' : '';
        const lowTxt = (r.LOW_POINT_WEEK && r.LOW_POINT_BAL != null) ? ' The tightest week is ' + r.LOW_POINT_WEEK + ' at ' + cur(r.LOW_POINT_BAL) + '.' : '';
        if (r.RUNWAY != null) {
          o.S3_NARRATIVE = 'Your cash runs about ' + Math.round(r.RUNWAY) + ' weeks before it would go negative.';
          o.S3_FINDING = (lowTxt ? lowTxt.trim() : 'The next thirteen weeks are the window.') + safeTxt;
          o.S3_TOOL = 'Free trapped cash and hold payments to their due dates to push the runway out.';
        } else {
          o.S3_NARRATIVE = r.TIGHT_WEEKS > 0 ? r.TIGHT_WEEKS + ' of the next thirteen weeks run tight.' : 'No tight weeks in the next thirteen. Your cash timing looks clear.';
          o.S3_FINDING = 'Without an opening balance this is timing only, not a real runway.';
          o.S3_TOOL = 'Set your opening cash balance in Cash Position to see the full runway.';
        }
      }
      if (r.S4_SCORE != null && r.TOTAL_VENDORS) {
        const hold = 'you hold about ' + dtxt(r.WEIGHTED_DPO) + ' on average before you pay';
        if (r.VENDORS_ON_TERMS < r.TOTAL_VENDORS) {
          o.S4_NARRATIVE = r.VENDORS_ON_TERMS + ' of ' + r.TOTAL_VENDORS + ' vendors are on terms, and ' + hold + '.';
          o.S4_FINDING = 'The ' + (r.TOTAL_VENDORS - r.VENDORS_ON_TERMS) + ' without terms are the ones you are financing early.';
          o.S4_TOOL = 'Set terms on the rest, and pay each bill on its due date, not early, to keep the float.';
        } else {
          o.S4_NARRATIVE = 'Every vendor is on terms, and ' + hold + '.';
          o.S4_FINDING = 'You are holding your cash to the last honest day.';
          o.S4_TOOL = 'Keep paying on the due date, not before, to keep the float yours.';
        }
      }
      return o;
    };
    const mkCashAudit = (date, generated_at, audit_id, period, raw) => {
      Object.assign(raw, _cashFindings(raw));   // 3-line findings on every cash audit
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
        // Pick the day-0 audit by DATE, never by array position. `cash_audits[0]` was
        // day 0 only because weeklySeries happens to build newest-first; reorder that
        // and this would have silently overwritten a 90-day-old audit with today's
        // engine output, and the demo's newest audit would have kept a stale
        // hand-authored raw. `latestEvent` is safe for this kind: a cash_audit carries
        // `date`, which App._recDate reads (it FAILS OPEN on kinds it cannot date, so
        // check the field before reaching for it — [[event-store-gotchas]] section 0).
        const latest = App.latestEvent ? App.latestEvent(App.data.cash_audits) : App.data.cash_audits[0];
        const idx = latest ? App.data.cash_audits.indexOf(latest) : -1;
        if (engCash && latest && idx >= 0) {
          engCash.audit_id     = latest.audit_id;
          engCash.audit_period = latest.audit_period;
          engCash.date         = latest.date;
          engCash.generated_at = latest.generated_at;
          App.data.cash_audits[idx] = engCash;
        }
      }
    } catch (e) { /* keep the hand-authored day-0 if the engine cannot read yet */ }

    // Lighter weekly fill: sub-scores + a natural path, empty component detail
    // (the detail view renders it cleanly), no exposures. The two rich milestones
    // below and the live day-0 engine carry the full breakdowns.
    // Weekly fills now carry real component rows per covered sub-score, so the
    // detail view shows scoring rows and the full 3-line findings on every audit,
    // not just the milestones. pct values spread deterministically around the
    // sub-score (one near full marks, the rest varied) so it reads like a real week.
    const BCA_COMPS = [
      ['Opening checklist completion', 'Closing checklist completion', 'Inventory counts completed', 'Spot checks completed', 'Shifts logged'],
      ['Cash variance trend', 'Drawer counts per operating day', 'Cash drops on revenue days'],
      ['Inventory counts on schedule', 'Spot checks completed', 'Vendor discrepancy resolution rate', 'Spot check clean variance rate'],
      ['Schedule adherence', 'Callout frequency', 'Overtime incidents under control', 'Certifications current', 'Coaching log activity'],
      ['Acting on surfaced gaps', 'Fixes that produced movement'],
      ['Weekly covers consistency', 'Weekly labor % consistency', 'Weekly pour cost % consistency']
    ];
    const BCA_OFF = [30, -16, 8, -20, 14, -10, 4];   // spread that averages near the sub-score
    const bcaDetailFor = (subs) => subs.map((s, i) => {
      if (s == null) return [];
      return BCA_COMPS[i].map((label, j) => ({ label, extra: '', pct: Math.max(15, Math.min(100, Math.round(s + BCA_OFF[j % BCA_OFF.length]))) }));
    });
    const bcaFill = (daysAgo, auditId, subs) =>
      bcaRec(daysAgo, auditId, subs, bcaDetailFor(subs), [], [], { gaps: 0, fixesLogged: 0, dollarsRecovered: 0, stillMeasuring: 0 });
    App.data.bar_cop_audits = [
      // Weekly Bar Cop history on the 90/60/30/0 + fills grid, same as the recovery
      // audits. Recovery Action and Operational Consistency read N/A until a trend
      // exists, so the first weeks are Partial data and coverage fills in over the
      // quarter. Two milestones stay fully detailed; the rest are lighter fills.
      bcaFill(90, 'BCA-2026-0001', [42, 40, 38, null, null, null]),
      bcaFill(81, 'BCA-2026-0002', [45, 43, 41, 44, null, null]),
      bcaFill(74, 'BCA-2026-0003', [44, 43, 43, 43, null, null]),
      bcaFill(67, 'BCA-2026-0004', [48, 46, 46, 47, null, null]),
      // ── Day 60 (rich) — first few weeks of data; Recovery Action and Operational
      //    Consistency read N/A until a longer trend exists; they fill in by day 30.
      bcaRec(60, 'BCA-2026-0009',
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
      bcaFill(51, 'BCA-2026-0010', [53, 51, 51, 52, 48, null]),
      bcaFill(44, 'BCA-2026-0011', [53, 50, 52, 51, 50, null]),
      bcaFill(37, 'BCA-2026-0012', [57, 55, 56, 56, 53, null]),
      // ── Day 30 (rich) — all six sub-scores now covered. Procedures climbing,
      //    fixes logged and starting to pay.
      bcaRec(30, 'BCA-2026-0013',
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
      ),
      bcaFill(21, 'BCA-2026-0014', [63, 60, 62, 63, 60, 63]),
      bcaFill(14, 'BCA-2026-0015', [62, 60, 62, 63, 59, 62]),
      bcaFill(7,  'BCA-2026-0016', [70, 68, 70, 71, 68, 70])
    ];

    // ── Day 0 (current) — generated by the LIVE engine on the seeded data, so
    // every component line is true by construction (the seed-roundtrip rule). The
    // engine only scores the current 30-day window, so the older records above stay
    // hand-authored history. Sits at today on the weekly grid; id fixed for display.
    if (window.S && S.HubBarCopAudit && S.HubBarCopAudit._computeAuditSnapshot) {
      const bca0 = S.HubBarCopAudit._computeAuditSnapshot();
      if (bca0) {
        bca0.id = uid();
        bca0.date = dateStr(0);
        bca0.audit_id = 'BCA-2026-0017';
        App.data.bar_cop_audits.push(bca0);
      }
    }

    const seedCore = await App.seedEventStores('core');   // recovery event logs (weeks, audits, theft scores, discrepancies, investigations) -> core_events rows
    App.updatePeriod();

    // Reload so the app re-renders against a fully hydrated state (like Clear
    // Data does). Without it, navigating mid-load could catch a half-built store
    // and, e.g., flash a Get Started card next to Where You Stand.
    // The demo seeds through this same path, but a reload there would re-run
    // startDemo (?demo=1 still in the URL) and loop forever. The demo renders the
    // Hub itself, so only the interactive Re-Load Sample button needs the reload.
    if (App.demoMode) return;
    // If any event store failed to persist (even after retries), do NOT reload —
    // that would drop into half-written data (the class that lost logged hours).
    // Tell the operator to run it again instead.
    const seedOk = [seedIc, seedLc, seedSc, seedCore].every(r => !r || r.ok !== false);
    if (!seedOk) {
      if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Some sample data did not save (connection hiccup). Click Load Sample Data again.'; }
      return;
    }
    if (msg) { msg.style.color = 'var(--gold)'; msg.textContent = '✓ Sample data loaded. Reloading...'; }
    setTimeout(() => window.location.reload(), 800);
  },

  async clearAll() {
    // Destructive + dev-only (Testing Tools, dev-gated in the UI). Refuse any other caller
    // (e.g. a pasted console call on a real account) — defense in depth over the UI gate.
    if (!(App.isDevAccount && App.isDevAccount())) return;
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
    const s = { ...App.data.settings };
    delete s.week_sales_estimate;   // cold-start sales estimate: the wipe removes the weeks it stood in for, so reset it too
    const defaults = DB._defaultData();
    App.data = {
      ...defaults,
      settings: { ...s, onboarding_complete:true }
    };
    // Clear the three Control stores too — Inventory, Labor, and Shift.
    App.inventoryData = {};
    App.laborData     = {};
    App.shiftData     = {};
    // try/finally, matching _applyBackup. Without it, a throw anywhere in the wipe below left
    // _allowReset stuck TRUE for the rest of the session — and App.data has ALREADY been replaced
    // with empty defaults by this point, so every later save would write an empty blob over a
    // populated account with the total-wipe backstop disarmed. The reload that would have reset
    // the flag never runs on the throw path. A leaked bypass is worse than the bug it bypasses.
    DB._allowReset = true;   // intentional wipe: let the total-wipe backstop through for this explicit reset
    try {
    await App.save();
    await App.saveInventory();
    await DB.clearEvents('ic_events');   // drop the inventory event rows too
    await App.saveLabor();
    await DB.clearEvents('lc_events');   // drop the labor event rows too
    await App.saveShift();
    await DB.clearEvents('sc_events');   // drop the shift event rows too
    await DB.clearEvents('core_events'); // drop the recovery event rows too
    // ⚠ DO NOT close the reset window here. The Cash Recovery resets below write through
    // CashEngine.setX -> App.acctSet -> saveKey -> writeData, which is guarded by the total-wipe
    // backstop. Clearing _allowReset at this point silently BLOCKED all seven of them, so a
    // "cleared" account kept its opening balance, tax rate, credit line, reserve and gift-card
    // liability — the exact outcome the comment below says this block exists to prevent. Caught
    // in the wild 2026-07-20 by the wipe_blocked alert (stack: clearAll -> setTaxFrequency).
    // The window now closes in the finally after EVERY write of this intentional wipe.
    // ⚠ The cockpit "done" stamps live in App.data.account_state, NOT localStorage (S72), so this
    // localStorage sweep never cleared them. It is HARMLESS here — clearAll assigns
    // App.data = { ...DB._defaultData(), settings } above, and _defaultData carries no
    // account_state, so the stamps are already gone before this line runs. Kept as a belt-and-braces
    // account clear via the real helper, which is what the false comment always meant to do.
    this._clearCockpitStamps();
    // Cash Recovery device-local config also lives in localStorage. Clear it too,
    // or a wiped account keeps the seeded opening balance, tax rate, and reserve
    // and reads as if the opening balance is already set (Cash Audit step 1 checks
    // off, Cash Position pre-fills). A real fresh signup never has these.
    // Cash config now lives on account-scoped keys, so clear it through the
    // setters (raw removeItem would miss the scoped keys). Event ack flags are
    // still flat keys.
    // AWAITED: these write through acctSet -> saveKey -> writeData. Fire-and-forget left them
    // in flight past the point the reset window closed, so the finally below could not protect
    // them. Awaiting also means a failure is real rather than invisible.
    try {
      if (window.CashEngine) {
        await CashEngine.setOpeningCash(null);
        await CashEngine.setSalesTaxRate(null);
        await CashEngine.setTaxFrequency('monthly');
        await CashEngine.setPayrollBurden(null);
        await CashEngine.setReserveWeeks(null);
        await CashEngine.setAvailableCredit(null);
        await CashEngine.setGiftCardLiability(null);
      }
    } catch (e) {}
    } finally {
      DB._allowReset = false;   // close the window after EVERY write of this wipe, throw or not
    }
    try { ['events_step_ack_leads', 'events_step_ack_deposits', 'events_step_ack_prep', 'events_step_ack_close', 'event_agreement_terms', 'lc_sched_draft'].forEach(k => localStorage.removeItem(k)); } catch (e) {}
    App.updatePeriod();

    if (msg) { msg.style.color = 'var(--gold)'; msg.textContent = '✓ All data cleared. Reloading...'; }
    setTimeout(() => window.location.reload(), 800);
  }
};
