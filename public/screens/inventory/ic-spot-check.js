'use strict';

/* ── Inventory Control — Spot Check (writes ic_spot_checks) ───────────────────
   A manager's per-shift theft check on a few high-risk bar products. It is a
   two-moment job: count the targets at the START of the shift (pre), count them
   again at the END (post), enter what the register rang, and Bar Cop shows
   whether what left the bar matches what was sold. The in-progress check
   auto-saves to this device so the pre-counts survive the whole shift and can be
   finished at close. It is SCOPED TO ONE LOCATION/register: the products are
   that bar's bottles and the POS sold must be that register's sales, or the
   variance is meaningless. No tie to inventory counts beyond the product list.
   ic_spot_checks feeds Profit Recovery's Theft Risk and the Profit Audit. */

S.InventorySpotCheck = {
  draft: null,
  DRAFT_KEY: 'ic_spot_check_draft',
  posMode: 'manual',     // 'manual' = type POS per line, 'import' = drop the register report
  _seq: 0,
  _onHistory: false,
  filterPreset: 'last-4',  // history range chip (weekly cadence)
  _prevPreset: 'last-4',   // range to restore when Custom is toggled closed
  filterFrom: '',          // custom range only
  filterTo: '',
  RANGE_CHIPS: [
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'last-12', label: 'Last 12 Weeks' }, { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],
  CAT_ORDER: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'],

  products() {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
  },
  productById(id) {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
  },
  checks() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_spot_checks)) App.inventoryData.ic_spot_checks = [];
    return App.inventoryData.ic_spot_checks;
  },
  // Operator-set variance tolerance: a line flags when it is off by more than
  // this percent of what the register rang, either direction. Persisted so it is
  // set once and pre-fills every check. Defaults to 5%.
  flagPctSetting() {
    const v = App.inventoryData && App.inventoryData.spot_check_flag_pct;
    return (v != null && !isNaN(v)) ? parseFloat(v) : 5;
  },
  async saveFlagPct() {
    if (!App.inventoryData) App.inventoryData = {};
    App.inventoryData.spot_check_flag_pct = this._flagPct;
    await App.saveInventory();
  },
  poursPer(p) {
    if (!p) return 1;
    if (p.pours_per_container) return p.pours_per_container;
    if (p.container_size_oz && p.pour_size_oz) return p.container_size_oz / p.pour_size_oz;
    return 1;
  },
  costPer(p) {
    if (!p) return 0;
    if (p.cost_per_pour != null) return p.cost_per_pour;
    const pp = this.poursPer(p);
    const bc = App.bottleCost(p);
    if (bc != null && pp > 0) return bc / pp;
    return 0;
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  ago(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'recently';
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return mins + ' min ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return hrs + ' hr ago';
    return Math.floor(hrs / 24) + ' day(s) ago';
  },

  // ── Draft (auto-save so the pre-counts survive the shift) ───────────────────
  loadDraft() {
    try { const r = localStorage.getItem(this.DRAFT_KEY); return r ? JSON.parse(r) : null; }
    catch (e) { return null; }
  },
  saveDraft() {
    if (!this.draft) return;
    try { localStorage.setItem(this.DRAFT_KEY, JSON.stringify(this.draft)); } catch (e) {}
  },
  clearDraft() {
    try { localStorage.removeItem(this.DRAFT_KEY); } catch (e) {}
    this.draft = null;
  },
  // Read the whole on-screen check into a plain object (the same shape we save).
  collectState() {
    const lines = [...this.container.querySelectorAll('.sp-line')].map(line => {
      const p = this.productById(line.dataset.pid);
      if (!p) return null;
      const lid = line.dataset.lid;
      const added = parseFloat(line.querySelector('.sp-added')?.value);
      const soldRaw = line.querySelector('.sp-sold')?.value;
      return {
        product_id: p.id,
        pre:  this.spReadRaw('sp-pre-'  + lid, p),
        post: this.spReadRaw('sp-post-' + lid, p),
        added: isNaN(added) ? 0 : added,
        sold:  (soldRaw == null || soldRaw === '') ? null : (parseFloat(soldRaw) || 0)
      };
    }).filter(Boolean);
    return {
      date:          document.getElementById('sp-date')?.value || '',
      location:      document.getElementById('sp-loc')?.value || '',
      shift:         document.getElementById('sp-shift')?.value || '',
      checked_by_id: document.getElementById('sp-by')?.value || '',
      lines
    };
  },
  syncDraft() {
    const state = this.collectState();
    if (!state.lines.length && !state.location) { this.clearDraft(); return; }
    const started = (this.draft && this.draft.started_at) || new Date().toISOString();
    this.draft = state;
    this.draft.started_at = started;
    this.saveDraft();
  },

  // ── Count input by product type (mirrors Take Inventory) ─────────────────
  _isCaseBeer(p) { return p.category === 'Bottle Beer' && p.case_size && p.case_size > 0; },
  _isPourable(p) { return !!(p.container_size_oz && p.pour_size_oz); },
  _restockUnit(p) { return p.category === 'Draft Beer' ? 'kegs' : 'btl'; },
  _posUnit(p)     { return this._isCaseBeer(p) ? 'btl' : 'pours'; },
  _posLabel(p)    { const prefix = (this._curBar || 'POS'); return prefix + (this._isCaseBeer(p) ? ' Bottles Sold' : ' Pours Sold'); },
  _servingWord(p) { return this._isCaseBeer(p) ? 'bottles' : 'pours'; },

  showHowTo() {
    App.showHelpModal('How the Spot Check Works', [
      { p: ['A spot check is a fast theft and overpour check on a few high-risk bar products for one shift. You count a product before and after the shift, tell Bar Cop what the register rang, and it shows whether what left the bar matches what was sold. It does not touch your inventory counts; it only borrows the product list.'] },
      { h: 'One Bar At A Time', p: ['A spot check is scoped to one service bar and its register. Pick the bar you are checking from the dropdown (the service bars you marked in Set Locations), and the product picker narrows to that bar\'s liquor, wine, bottle beer, and draft. The POS sold you enter or import must be THAT register\'s sales for the shift, not the whole venue. That single-register scope is the whole point: it is the only way the bottles that left can be matched to what was actually rung. Mark a bar as a service bar with the checkbox on Set Locations.'] },
      { h: 'Pick Your Targets', p: ['You do not check everything. Pick the bottles most likely to walk or get overpoured, usually your top shelf and your fast movers.'] },
      { h: 'Count Before And After', p: ['Set the pre-shift count when the shift starts and the post-shift count when it ends. Liquor and wine use the fill slider, bottle beer is cases plus loose, and draft uses the keg slider. Your check auto-saves to this device, so take the pre-counts at open and come back to finish at close.'] },
      { h: 'Restocked And POS Sold', p: ['If you brought more up from storage mid-shift, enter it under Restocked so the used number stays honest. Then enter what the register rang for each product, or drop that register\'s POS sales report and Bar Cop fills it in by matching product names.'] },
      { h: 'Reading The Result', p: ['Bar Cop works out what physically left the bottle from your counts and compares it to what the register rang. Anything off by more than your Flag at % setting, in either direction, flags red. Over means more left the bar than was sold, the classic sign of overpouring, give-aways, or theft. Under means less left the bottle than was rung in, which points to short pours that skimp the guest. Set Flag at % up top to your own tolerance; it remembers what you set.'] },
      { h: 'After You Save', p: ['Saved checks land in Spot Check History, where View opens the full breakdown. Hit Review on a flagged product and the investigation opens right here, working the same record Loss Prevention reads. Spot checks also feed Loss Prevention and the Bar Cop Audit.'] }
    ]);
  },

  spInputHTML(slotId, p, vals) {
    vals = vals || {};
    if (this._isCaseBeer(p)) {
      return '<div class="form-row" style="gap:10px;">'
        + '<div class="f" style="width:104px;"><label>Cases</label><div class="fw"><input class="suf sp-cases" data-slot="' + slotId + '" type="number" min="0" step="1" value="' + (vals.cases || 0) + '" style="height:42px;text-align:center;"/><span class="suf">cs</span></div></div>'
        + '<div class="f" style="width:110px;"><label>Loose</label><div class="fw"><input class="suf sp-loose" data-slot="' + slotId + '" type="number" min="0" step="1" value="' + (vals.loose || 0) + '" style="height:42px;text-align:center;"/><span class="suf">btl</span></div></div>'
        + '</div>';
    }
    if (this._isPourable(p)) {
      return BottleSlider.html(slotId, { value: vals.value || 0, fulls: vals.fulls || 0, category: p.category, shape: App.sliderShape(p) });
    }
    return '<div class="f" style="width:170px;"><label>Count</label><div class="fw"><input class="suf sp-num" data-slot="' + slotId + '" type="number" min="0" step="0.1" value="' + (vals.value || 0) + '" style="height:42px;text-align:center;"/><span class="suf">' + esc(App.unitAbbr(App.productUnit(p)) || 'units') + '</span></div></div>';
  },
  spMount(slotId, p, onChange) {
    if (!this._isCaseBeer(p) && this._isPourable(p)) { BottleSlider.mount(slotId, onChange); return; }
    document.querySelectorAll('[data-slot="' + slotId + '"]').forEach(inp => inp.addEventListener('input', onChange));
  },
  // Raw input values (for the draft + re-render): preserves the cases/loose or
  // fulls/value split instead of collapsing to a single total.
  spReadRaw(slotId, p) {
    if (this._isCaseBeer(p)) {
      return { cases: parseFloat(document.querySelector('.sp-cases[data-slot="' + slotId + '"]')?.value) || 0,
               loose: parseFloat(document.querySelector('.sp-loose[data-slot="' + slotId + '"]')?.value) || 0 };
    }
    if (this._isPourable(p)) {
      const g = (BottleSlider.get ? BottleSlider.get(slotId) : null) || { fulls: 0, value: 0 };
      return { fulls: g.fulls || 0, value: g.value || 0 };
    }
    return { value: parseFloat(document.querySelector('.sp-num[data-slot="' + slotId + '"]')?.value) || 0 };
  },
  // Container total for the variance math.
  spRead(slotId, p) {
    if (this._isCaseBeer(p)) {
      const r = this.spReadRaw(slotId, p);
      const total = r.cases * (p.case_size || 1) + r.loose;
      return { fulls: total, value: 0, total };
    }
    if (this._isPourable(p)) {
      const r = this.spReadRaw(slotId, p);
      return { fulls: r.fulls, value: r.value, total: r.fulls + r.value };
    }
    const r = this.spReadRaw(slotId, p);
    return { fulls: r.value, value: 0, total: r.value };
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    this.draft = this.loadDraft();
    this.posMode = 'manual';
    this.renderMain();
    const pend = App._pendingInvestigation;
    if (pend && pend.spotCheckId) {
      App._pendingInvestigation = null;
      App.pushView(() => this.renderDetail(pend.spotCheckId));
      S.TheftRisk.openInvestigationModal(pend.productId, pend.sku || '', { source: 'spot-check', spotCheckId: pend.spotCheckId, onClose: () => this.renderDetail(pend.spotCheckId) });
    }
  },

  // The service bars (a register is there), marked in Set Locations. A spot check
  // is run at ONE of them: it scopes the product picker and tags the saved check.
  serviceBars() {
    return ((App.inventoryData && App.inventoryData.ic_locations) || []).filter(l => !l.archived && l.service_bar);
  },
  locationOptions(selected) {
    const list = this.serviceBars().map(l => l.name).sort();
    let h = '<option value="">Select bar station...</option>';
    list.forEach(name => { h += '<option value="' + esc(name) + '"' + (selected === name ? ' selected' : '') + '>' + esc(name) + '</option>'; });
    return h;
  },
  // Bar products at the chosen station. No station picked = no list yet, so only
  // that station's bottles ever show (the operator picks the bar station first).
  productOptions(location) {
    if (!location) return '<option value="">Select bar station first</option>';
    const bar = App.BAR_CATS;
    const prods = this.products().filter(p => bar.includes(p.category) && App.productLocations(p).includes(location));
    const cats = bar.filter(c => prods.some(p => p.category === c));
    let h = '<option value="">Add a product to check...</option>';
    cats.forEach(cat => {
      h += '<optgroup label="' + esc(cat) + '">';
      prods.filter(p => p.category === cat).forEach(p => { h += '<option value="' + p.id + '">' + esc(p.name) + '</option>'; });
      h += '</optgroup>';
    });
    return h;
  },
  lineHTML(lid, p, ld) {
    ld = ld || {};
    return '<div class="card sp-line" data-lid="' + lid + '" data-pid="' + p.id + '" data-vd="0" style="margin-bottom:12px;">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">'
        + '<span style="flex:1;font-size:15px;font-weight:700;color:var(--t1);">' + esc(p.name) + '</span>'
        + '<span style="font-size:11px;color:var(--t3);">' + esc(p.category || '-') + '</span>'
        + '<button type="button" class="btn btn-ghost btn-sm sp-remove">Remove</button>'
      + '</div>'
      + '<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">'
        + '<div style="flex:1;min-width:220px;">'
          + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin-bottom:8px;text-align:center;">Pre-Shift Count</div>'
          + '<div style="display:flex;justify-content:center;">' + this.spInputHTML('sp-pre-' + lid, p, ld.pre) + '</div>'
        + '</div>'
        + '<div style="flex:1;min-width:220px;">'
          + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin-bottom:8px;text-align:center;">Post-Shift Count</div>'
          + '<div style="display:flex;justify-content:center;">' + this.spInputHTML('sp-post-' + lid, p, ld.post) + '</div>'
        + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:18px;justify-content:center;flex-wrap:wrap;margin-top:22px;">'
        + '<div class="f" style="width:170px;margin-bottom:0;"><label style="text-align:center;">Restocked Mid-Shift</label>'
          + '<div class="fw"><input class="suf sp-added" type="number" min="0" step="1" value="' + (ld.added ? ld.added : '') + '" placeholder="0" style="height:42px;font-size:15px;text-align:center;"/><span class="suf">' + this._restockUnit(p) + '</span></div>'
        + '</div>'
        + '<div class="f" style="width:170px;margin-bottom:0;"><label style="text-align:center;">' + this._posLabel(p) + '</label>'
          + '<div class="fw"><input class="suf sp-sold" type="number" min="0" step="1" value="' + (ld.sold != null ? ld.sold : '') + '" placeholder="0" style="height:42px;font-size:15px;text-align:center;"/><span class="suf">' + this._posUnit(p) + '</span></div>'
        + '</div>'
      + '</div>'
      + '<div class="sp-result" style="font-size:12px;color:var(--t3);line-height:1.6;text-align:center;padding:10px 12px;margin-top:14px;background:var(--bg);border:1px solid var(--b2);border-radius:4px;">'
      + 'Set the pre and post counts, then enter POS ' + this._servingWord(p) + ' sold, to see the variance.</div>'
      + '</div>';
  },

  renderMain() {
    this.actions.innerHTML = '';

    const sbList = this.serviceBars();
    if (this.products().length === 0 || sbList.length === 0) {
      App.setupCard(this.container, {
        title: 'Set Up Spot Checks',
        lead: 'A spot check is a fast theft check on a few high-risk bottles for one shift, run at one service bar. Set these up and you can run one in under a minute.',
        steps: [
          { title: 'Add your products', desc: 'A spot check runs against the bottles you stock, so add your products first.', btn: 'Add Products', screen: 'ic-product-setup', done: this.products().length > 0 },
          { title: 'Mark your service bars', desc: 'In Set Locations, check "Service bar" on each bar that has a register. A spot check is run at one of these.', btn: 'Set Locations', screen: 'ic-locations', done: sbList.length > 0 }
        ]
      });
      return;
    }

    this._seq = 0;
    const dft = this.draft || { lines: [] };
    this._curBar = (dft.location || '').trim();   // drives the per-line "<Bar> Pours Sold" label
    this._flagPct = this.flagPctSetting();
    const resuming = !!(this.draft && this.draft.lines && this.draft.lines.length);

    const active = App.activeShift();
    const defaultShift = dft.shift || (active && active.shift_type ? active.shift_type : 'Dinner');
    const shiftOpts = (App.SHIFT_TYPES || ['Brunch','Lunch','Dinner','Late Night','Full Day'])
      .map(t => '<option' + (t === defaultShift ? ' selected' : '') + '>' + esc(t) + '</option>').join('');

    const resumeBar = resuming
      ? '<div class="alert-bar" style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
        + '<div class="alert-text">A spot check started ' + this.ago(this.draft.started_at) + ' is in progress. Add the post-shift counts and POS sold to finish it.</div>'
        + '<div style="display:flex;gap:8px;">'
          + '<button class="btn btn-ghost btn-sm" id="sp-resume">Resume Check</button>'
          + '<button class="btn btn-ghost btn-sm" id="sp-discard">Start Over</button>'
        + '</div></div>'
      : '';

    // Spot Check card: collapsible header, the four setup cells, a divider, then
    // Add Products. Save lives at the bottom of the page.
    const setup = '<div class="card form-card">'
      + App.collapsibleCardTitle('sp-setup', 'Spot Check')
      + '<div class="collapse-body">'
      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
        + '<input type="date" id="sp-date" value="' + (dft.date || App.todayLocal()) + '"/></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Bar Station</label>'
        + '<select id="sp-loc">' + this.locationOptions(dft.location) + '</select></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>Shift</label>'
        + '<select id="sp-shift">' + shiftOpts + '</select></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Checked By</label>'
        + '<select id="sp-by">' + App.staffOptions(dft.checked_by_id || App.activeManagerId(), { placeholder: 'Select manager...', audience: 'supervisor' }) + '</select></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Variance Flag</label>'
        + '<div class="fw"><input class="suf" type="number" id="sp-flagpct" min="0" step="0.5" value="' + this._flagPct + '"/><span class="suf">%</span></div></div>'
      + '</div>'
      + '<div class="divider"></div>'
      + '<div class="form-row" style="gap:12px;margin-bottom:0;align-items:flex-end;flex-wrap:wrap;">'
        + '<div class="f" style="width:260px;flex-shrink:0;margin-bottom:0;"><label>Add Products</label><select id="sp-add">' + this.productOptions(dft.location) + '</select></div>'
      + '</div></div></div>';

    const lineHtmls = (dft.lines || []).map(ld => {
      const p = this.productById(ld.product_id);
      if (!p) return '';
      const lid = ++this._seq;
      ld._lid = lid;
      return this.lineHTML(lid, p, ld);
    }).join('');

    // The three stats in their own card at the top.
    const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Products</div><div class="calc-val lg" id="sp-count">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Flagged</div><div class="calc-val lg" id="sp-flagged">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Variance</div><div class="calc-val lg" id="sp-total">$0</div></div>'
      + '</div></div>';

    // POS sold: type on each line, or reveal the importer for this register's report.
    const posToggle = '<button type="button" class="btn btn-ghost btn-sm sp-posmode" data-mode="' + (this.posMode === 'import' ? 'manual' : 'import') + '">' + (this.posMode === 'import' ? 'Hide Importer' : 'Import POS Report') + '</button>';
    const posCard = '<div class="card no-print">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.6;flex:1;min-width:200px;">Enter the POS sold on each product manually, or import this register\'s report to fill them in.</div>'
      + posToggle + '</div>'
      + (this.posMode === 'import' ? '<div style="margin-top:14px;"><div id="sp-pos-csv"></div><div id="sp-pos-result"></div></div>' : '')
      + '</div>';

    const historyRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Take Spot Check</div>'
      + '<button class="btn btn-ghost btn-sm" id="sp-history">View History</button></div>';
    this.container.innerHTML = '<div class="screen">' + resumeBar + statsCard + historyRow + setup + posCard
      + '<div class="sh" id="sp-products-title" style="margin:24px 0 10px;display:none;">Products to spot check</div>'
      + '<div id="sp-lines">' + lineHtmls + '</div>'
      + '<div style="margin-top:18px;">'
        + '<button class="btn btn-primary" id="sp-save">Save Spot Check</button>'
      + '</div></div>';
    App.applyCollapsed(this.container);
    this.updateProductsTitle();
    this._onHistory = false;

    // Mount sliders for any restored lines.
    BottleSlider._inst = {};
    (dft.lines || []).forEach(ld => {
      const p = this.productById(ld.product_id);
      if (!p || ld._lid == null) return;
      this.spMount('sp-pre-'  + ld._lid, p, () => this.onLineChange(ld._lid));
      this.spMount('sp-post-' + ld._lid, p, () => this.onLineChange(ld._lid));
    });
    this.container.querySelectorAll('.sp-line').forEach(line => this.recalcLine(line));
    this.recalcTotal();
    if (this.posMode === 'import') this.mountPosImporter();

    const lines = document.getElementById('sp-lines');
    lines.addEventListener('input', ev => {
      const line = ev.target.closest('.sp-line');
      if (line) { line.classList.remove('sp-missing'); this.recalcLine(line); this.recalcTotal(); this.syncDraft(); }
    });
    lines.addEventListener('click', ev => {
      if (ev.target.closest('.sp-remove')) {
        ev.target.closest('.sp-line').remove();
        this.recalcTotal();
        this.syncDraft();
        this.updateProductsTitle();
      }
    });
    document.getElementById('sp-add')?.addEventListener('change', e => {
      const pid = e.target.value;
      e.target.value = '';
      if (!this.requireSetup()) return;   // no product added until Date + Bar Station are set
      e.target.closest('.f')?.classList.remove('field-missing');
      const p = this.productById(pid);
      if (p) this.addLine(p);
    });
    // Clicking Add Products with no bar station picked flags the Bar Station cell
    // red immediately (the product list is empty until a station is chosen).
    document.getElementById('sp-add')?.addEventListener('mousedown', () => {
      if (!document.getElementById('sp-loc')?.value) this.requireSetup();
    });
    document.getElementById('sp-date')?.addEventListener('input', e => e.target.closest('.f')?.classList.remove('field-missing'));
    document.getElementById('sp-loc')?.addEventListener('change', () => { this.syncDraft(); this.renderMain(); });
    document.getElementById('sp-shift')?.addEventListener('change', () => this.syncDraft());
    document.getElementById('sp-by')?.addEventListener('change', () => this.syncDraft());
    document.getElementById('sp-flagpct')?.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      this._flagPct = (isNaN(v) || v < 0) ? 0 : v;
      this.container.querySelectorAll('.sp-line').forEach(line => this.recalcLine(line));
      this.recalcTotal();
    });
    document.getElementById('sp-flagpct')?.addEventListener('change', () => this.saveFlagPct());
    document.getElementById('sp-save')?.addEventListener('click', () => this.save());

    this.container.onclick = ev => {
      const collHead = ev.target.closest('.card-collapse-head');
      if (collHead) { App.toggleCollapse(collHead); return; }
      if (ev.target.closest('#sp-resume')) { this.container.querySelector('.alert-bar')?.remove(); return; }
      if (ev.target.closest('#sp-discard')) { this.clearDraft(); this.renderMain(); return; }
      if (ev.target.closest('#sp-history')) { App.pushView(() => this.renderHistory()); return; }
      const posSeg = ev.target.closest('.sp-posmode');
      if (posSeg) { this.syncDraft(); this.posMode = posSeg.dataset.mode; this.renderMain(); return; }
    };
  },

  // Effective window from the active range chip; Custom reads From/To, All clears.
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  // Range chips left, Export right, above the list (the accepted filter model).
  // Custom reveals a bare From/To row. Weekly cadence for inventory.
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'sp-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><button class="btn btn-ghost btn-sm" id="sp-list-export">Export PDF</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="sp-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="sp-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
  },

  // ── History (its own page: a stat box + the saved-checks list) ──────────────
  renderHistory() {
    this.actions.innerHTML = '';
    this._onHistory = true;
    const all = [...this.checks()].sort(App.cmpNewest);
    const flagged = all.reduce((s, c) => s + (c.flagged_count || 0), 0);
    const totalVar = all.reduce((s, c) => s + (c.total_variance_dollar || 0), 0);
    const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Checks</div><div class="calc-val lg">' + all.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Flagged</div><div class="calc-val lg' + (flagged ? ' warn' : '') + '">' + flagged + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Variance</div><div class="calc-val lg">' + (totalVar > 0 ? '+' : '') + App.fmtCurrency(totalVar, 2) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Last Check</div><div class="calc-val lg">' + (all.length ? this.fmtDate(all[0].date) : '-') + '</div></div>'
      + '</div></div>';

    if (all.length === 0) {
      this.container.innerHTML = '<div class="screen">' + statsCard
        + '<div class="sh" style="margin:24px 0 10px;">Spot Check History</div>'
        + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Date</th><th>Bar</th><th>Shift</th><th>Checked By</th><th>Products</th><th>Flagged</th><th>Variance</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="8" style="color:var(--t3);">No spot checks saved yet.</td></tr></tbody></table></div></div>';
      this.wireHistory();
      return;
    }

    const { from, to } = this.effectiveRange();
    const filtered = all.filter(c =>
      (!from || (c.date || '') >= from) && (!to || (c.date || '') <= to));

    const rows = filtered.slice(0, App.listLimit('ic', 'spot_check')).map(c => {
      const vd = c.total_variance_dollar || 0;
      return '<tr class="sp-hrow" data-id="' + c.id + '" style="cursor:pointer;">'
        + '<td><div class="val">' + this.fmtDate(c.date) + '</div></td>'
        + '<td>' + esc(c.location || '-') + '</td>'
        + '<td>' + esc(c.shift || '-') + '</td>'
        + '<td>' + esc(c.checked_by || '-') + '</td>'
        + '<td>' + (c.product_count || 0) + '</td>'
        + '<td class="' + (c.flagged_count ? 'neg' : '') + '">' + (c.flagged_count || 0) + '</td>'
        + '<td class="' + (vd > 0 ? 'neg' : '') + '">' + (vd > 0 ? '+' : '') + App.fmtCurrency(vd, 2) + '</td>'
        + '<td><div class="row-actions">'
        + '<button class="btn btn-ghost btn-sm sp-hview" data-id="' + c.id + '">View</button>'
        + (App.canEdit('ic-spot-check') ? '<button class="btn btn-danger btn-sm sp-hdel" data-id="' + c.id + '">Delete</button>' : '')
        + '</div></td></tr>';
    }).join('');
    const listCard = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Date</th><th>Bar</th><th>Shift</th><th>Checked By</th><th>Products</th><th>Flagged</th><th>Variance</th><th></th>'
      + '</tr></thead><tbody>' + (rows || '<tr><td colspan="8" style="color:var(--t3);padding:12px 8px;">No spot checks in this range. Pick a wider range above.</td></tr>') + '</tbody></table></div>'
      + App.showOlderBar('ic', 'spot_check', filtered, this.filterPreset !== 'all');

    this.container.innerHTML = '<div class="screen">' + statsCard + this.filterRow() + listCard + '</div>';
    if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
    this.wireHistory();
  },

  wireHistory() {
    document.getElementById('sp-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderHistory(); });
    document.getElementById('sp-to')?.addEventListener('change', e => { this.filterTo = e.target.value || ''; this.renderHistory(); });
    this.container.onclick = ev => {
      const chip = ev.target.closest('.sp-range-chip');
      if (chip) {
        const v = chip.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.renderHistory();
        return;
      }
      if (ev.target.closest('#sp-list-export')) { const r = this.effectiveRange(); App.exportListPDF({ title: 'Spot Check History', root: this.container, lists: [['ic', 'spot_check']], reRender: () => this.renderHistory(), range: App.chipRangeLabel(this.RANGE_CHIPS, this.filterPreset, r.from, r.to) }); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderHistory()); return; }
      const hdel = ev.target.closest('.sp-hdel');
      const hview = ev.target.closest('.sp-hview');
      const hrow = ev.target.closest('.sp-hrow');
      if (hdel) { ev.stopPropagation(); this.confirmDel(hdel.dataset.id); }
      else if (hview) { ev.stopPropagation(); const id = hview.dataset.id; App.pushView(() => this.renderDetail(id)); }
      else if (hrow) { const id = hrow.dataset.id; App.pushView(() => this.renderDetail(id)); }
    };
  },

  addLine(p) {
    const lines = document.getElementById('sp-lines');
    if (!lines) return;
    const lid = ++this._seq;
    lines.insertAdjacentHTML('beforeend', this.lineHTML(lid, p));
    const newLine = lines.querySelector('.sp-line[data-lid="' + lid + '"]');
    this.spMount('sp-pre-'  + lid, p, () => this.onLineChange(lid));
    this.spMount('sp-post-' + lid, p, () => this.onLineChange(lid));
    this.recalcLine(newLine);
    this.recalcTotal();
    this.syncDraft();
    this.updateProductsTitle();
  },

  // The "Products to spot check" heading shows only once a product is on the check.
  updateProductsTitle() {
    const t = document.getElementById('sp-products-title');
    const lines = document.getElementById('sp-lines');
    if (t && lines) t.style.display = lines.children.length ? '' : 'none';
  },
  // Clear the red required-field highlights.
  clearMissing() {
    this.container.querySelectorAll('.f.field-missing').forEach(f => f.classList.remove('field-missing'));
    this.container.querySelectorAll('.sp-line.sp-missing').forEach(l => l.classList.remove('sp-missing'));
  },
  // Block adding products until the required setup fields (Date + Bar) are filled,
  // so the red flag lands right by the Add Products control instead of failing on
  // Save at the bottom of a long list. Returns true when all are set.
  requireSetup() {
    let ok = true;
    const need = id => {
      const f = document.getElementById(id)?.closest('.f');
      if (!document.getElementById(id)?.value) { f?.classList.add('field-missing'); ok = false; }
      else f?.classList.remove('field-missing');
    };
    need('sp-date');
    need('sp-loc');
    if (!ok) this.expandSetup();
    return ok;
  },
  // Make sure the Spot Check card is open so a flagged cell inside it is visible.
  expandSetup() {
    const head = this.container.querySelector('.card-collapse-head[data-collapse-key="sp-setup"]');
    const card = head ? head.closest('.card') : null;
    if (card && card.classList.contains('collapsed')) {
      card.classList.remove('collapsed');
      try { localStorage.removeItem('barcop_collapse_sp-setup'); } catch (e) {}
    }
  },
  onLineChange(lid) {
    const line = this.container.querySelector('.sp-line[data-lid="' + lid + '"]');
    if (line) this.recalcLine(line);
    this.recalcTotal();
    this.syncDraft();
  },

  // ── POS import (fills the per-line POS sold from this register's report) ────
  mountPosImporter() {
    const el = document.getElementById('sp-pos-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    const loc = document.getElementById('sp-loc')?.value || 'this register';
    CSVMapper.mount(el, {
      dropTitle: 'Drop the ' + loc + ' POS sales report for this shift',
      dropSub: 'Needs columns for product name and pours or bottles sold. That register only, not the whole venue.<br>The sold number fills in on each product you have added.',
      fields: [
        { key: 'product', label: 'Product', required: true, match: ['product', 'item', 'name', 'description', 'item name', 'menu item', 'product name'] },
        { key: 'sold',    label: 'Sold',    required: true, match: ['sold', 'pours', 'qty', 'quantity', 'units', 'count', 'qty sold', 'quantity sold', 'units sold', 'sold qty', 'number sold'] }
      ],
      confirmLabel: 'Fill POS Sold',
      onComplete: rows => this.applyPosImport(rows)
    });
  },
  applyPosImport(rows) {
    const byName = {};
    this.products().forEach(p => { byName[(p.name || '').trim().toLowerCase()] = p; });
    let filled = 0;
    const onScreen = {};
    this.container.querySelectorAll('.sp-line').forEach(line => { onScreen[line.dataset.pid] = line; });
    rows.forEach(r => {
      const p = byName[(r.product || '').trim().toLowerCase()];
      const sold = parseFloat(r.sold);
      if (!p || isNaN(sold)) return;
      const line = onScreen[p.id];
      if (!line) return;
      const inp = line.querySelector('.sp-sold');
      if (inp) { inp.value = sold; this.recalcLine(line); filled++; }
    });
    this.recalcTotal();
    this.syncDraft();
    const res = document.getElementById('sp-pos-result');
    if (res) {
      res.innerHTML = filled > 0
        ? '<div style="font-size:13px;color:var(--gold);font-weight:700;margin-top:12px;">Filled POS sold for ' + filled + ' product' + (filled === 1 ? '' : 's') + '. Review the variance below, then save.</div>'
        : '<div style="font-size:13px;color:var(--red);margin-top:12px;">No products matched. Add the products to the check first, and make sure the names match.</div>';
    }
  },

  // compute one line; returns its variance dollars and supporting numbers
  //   actual_pours_used = (pre_total + added - post_total) × pours_per_container
  //   variance_pours    = actual - pos_sold   (positive = overpoured/theft)
  //   variance_dollars  = variance_pours × cost_per_pour
  lineCalc(line) {
    const p = this.productById(line.dataset.pid);
    if (!p) return null;
    const lid = line.dataset.lid;
    const pre  = this.spRead('sp-pre-'  + lid, p);
    const post = this.spRead('sp-post-' + lid, p);
    const preTotal  = pre.total;
    const postTotal = post.total;
    const num = sel => { const v = parseFloat(line.querySelector(sel)?.value); return isNaN(v) ? null : v; };
    const added = num('.sp-added') || 0;
    const sold  = num('.sp-sold');
    const pp    = this.poursPer(p);
    const usedContainers = preTotal + added - postTotal;
    const actualPours = usedContainers * pp;
    const variance = sold != null ? actualPours - sold : null;
    const vd = variance != null ? variance * this.costPer(p) : null;
    return {
      p, preTotal, postTotal, added, sold,
      pre_value: pre.value, pre_fulls: pre.fulls,
      post_value: post.value, post_fulls: post.fulls,
      used: usedContainers, poured: actualPours, variance, vd, pp
    };
  },

  // "Nothing was recorded on this line" — which is NOT the same as "this line measured zero".
  // The POS importer fills the Sold box on every product whose name it matched, so a product that
  // was added to the check and never counted resolves to variance = 0 - pos_sold: the register's
  // whole sale booked as an Under, against a bottle nobody touched. Same rule Count History runs on
  // a skipped product — a skip is not a counted zero.
  // ⚠ RESTOCKED counts as recorded. Pre 0, post 0, brought up 3 containers and poured them all is a
  // REAL measurement; the old `preTotal === 0 && postTotal === 0` test suppressed its message while
  // still counting its dollars, so the two halves of this guard disagreed in opposite directions.
  _notRecorded(r) { return !r || (r.preTotal === 0 && r.postTotal === 0 && !r.added); },

  recalcLine(line) {
    const r = this.lineCalc(line);
    const res = line.querySelector('.sp-result');
    // ⚠ dataset.vd is cleared HERE, inside the guard. It used to be assigned ABOVE the
    // nothing-recorded check and the early return left it standing, so recalcTotal summed a
    // variance the line itself was printing "no variance yet" for.
    if (this._notRecorded(r)) {
      line.dataset.vd = '0'; line.dataset.flag = '0';
      if (res) res.innerHTML = 'Set the pre and post counts to start the variance calculation.';
      return;
    }
    const sw = this._servingWord(r.p);
    line.dataset.vd = r.vd != null ? r.vd : '0';
    const usedTxt = 'Used ' + r.used.toFixed(2) + ' container'
      + (Math.abs(r.used - 1) < 0.001 ? '' : 's')
      + (r.added > 0 ? ' (restocked ' + r.added + ' mid-shift)' : '')
      + ' &middot; ' + r.poured.toFixed(1) + ' ' + sw + ' actual';
    if (r.variance == null) {
      line.dataset.flag = '0';
      if (res) res.innerHTML = '<span style="color:var(--t2);">' + usedTxt + '.</span> Enter POS ' + sw + ' sold to see the variance.';
      return;
    }
    // Flag when the variance is more than the operator's percent of what the
    // register rang, either direction, past a 1-pour floor so a small-sample
    // rounding blip does not trip it.
    const thr = (this._flagPct != null && !isNaN(this._flagPct)) ? this._flagPct : 5;
    const pct = (r.sold > 0) ? Math.abs(r.variance) / r.sold * 100 : (Math.abs(r.variance) > 0 ? 100 : 0);
    const flagged = Math.abs(r.variance) > 1 && pct >= thr;
    line.dataset.flag = flagged ? '1' : '0';
    const cls = flagged ? 'var(--red)' : 'var(--gold)';
    const direction = r.variance > 0 ? 'Over' : (r.variance < 0 ? 'Under' : 'On target');
    const byTxt = r.variance === 0 ? '' : ' by ' + Math.abs(r.variance).toFixed(1) + ' ' + sw;
    if (res) res.innerHTML = '<span style="color:var(--t2);">' + usedTxt + ' &middot; ' + r.sold.toFixed(0) + ' ' + sw + ' rung in.</span><br>'
      + '<span style="color:' + cls + ';font-weight:700;">' + direction + byTxt + ' &middot; '
      + (r.vd > 0 ? '+' : '') + App.fmtBal(r.vd, 2) + '</span>';
  },

  recalcTotal() {
    const lines = [...document.querySelectorAll('.sp-line')];
    let total = 0, flagged = 0;
    lines.forEach(line => {
      total += parseFloat(line.dataset.vd) || 0;
      if (line.dataset.flag === '1') flagged++;
    });
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('sp-count', lines.length);
    set('sp-flagged', flagged);
    const totEl = document.getElementById('sp-total');
    if (totEl) {
      totEl.textContent = (total > 0 ? '+' : '') + App.fmtBal(total, 2);
      totEl.className = 'calc-val lg' + (flagged ? ' warn' : '');
    }
  },

  async save() {
    if (!App.canEdit('ic-spot-check')) return;
    // A missing required field turns its cell border red, like the Add Product form.
    this.clearMissing();
    const mark = id => { document.getElementById(id)?.closest('.f')?.classList.add('field-missing'); };
    const date = document.getElementById('sp-date')?.value;
    if (!date) { this.expandSetup(); mark('sp-date'); return; }
    const location = document.getElementById('sp-loc')?.value || '';
    if (!location) { this.expandSetup(); mark('sp-loc'); return; }

    const lines = [...document.querySelectorAll('.sp-line')];
    if (lines.length === 0) { this.expandSetup(); mark('sp-add'); return; }

    const items = [];
    let valid = false;
    lines.forEach(line => {
      const r = this.lineCalc(line);
      const p = this.productById(line.dataset.pid);
      if (!p) return;
      // A line with nothing entered is stored as what it is: a product that was ON the check and
      // never counted. Every measured field stays null so the detail view dashes it out the way
      // Count History does, and it carries no variance — so it cannot reach the Bar Cop Audit's
      // shrink figure, and it cannot cancel a REAL overpour on another bottle down to a clean check.
      // pos_sold is deliberately KEPT: "the register rang 30 and nobody counted the bottle" is the
      // useful half of the record, and it is the thing that tells the operator what they missed.
      const skipped = this._notRecorded(r);
      if (!skipped) valid = true;
      items.push({
        product_id:      p.id,
        name:            p.name,
        category:        p.category || '',
        pours_per_container: this.poursPer(p),
        cost_per_pour:   this.costPer(p),
        not_counted:     skipped,
        pre_value:       skipped ? null : r.pre_value,
        pre_fulls:       skipped ? null : r.pre_fulls,
        pre_total:       skipped ? null : r.preTotal,
        post_value:      skipped ? null : r.post_value,
        post_fulls:      skipped ? null : r.post_fulls,
        post_total:      skipped ? null : r.postTotal,
        pre:             skipped ? null : r.preTotal,
        post:            skipped ? null : r.postTotal,
        added:           skipped ? null : r.added,
        pos_sold:        r ? r.sold : null,
        used_containers: skipped ? null : r.used,
        poured:          skipped ? null : r.poured,
        variance_pours:  skipped ? null : r.variance,
        variance_dollar: skipped ? null : r.vd,
        flagged:         line.dataset.flag === '1'
      });
    });
    if (!valid) { lines.forEach(l => l.classList.add('sp-missing')); return; }

    const rec = {
      id:           App.uid(),
      date,
      location,
      shift:        document.getElementById('sp-shift')?.value || '',
      checked_by_id: document.getElementById('sp-by')?.value || '',
      checked_by:   (App.staffById(document.getElementById('sp-by')?.value) || {}).name || '',
      items,
      flag_pct:       this._flagPct,
      product_count:  items.length,
      flagged_count:  items.filter(i => i.flagged).length,
      total_variance_dollar: items.reduce((t, i) => t + (i.variance_dollar || 0), 0),
      created_at:   new Date().toISOString()
    };

    const btn = document.getElementById('sp-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('ic', 'spot_check', rec);
    if (ok) {
      this.clearDraft();
      this.renderMain();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Try Again'; }
    }
  },

  renderDetail(id) {
    const c = this.checks().find(x => x.id === id);
    if (!c) { this.renderMain(); return; }
    this.actions.innerHTML = '';

    const rows = (c.items || []).map(it => {
      const vd = it.variance_dollar;
      const p = this.productById(it.product_id);
      const cu = (it.category === 'Bottle Beer') ? 'btls' : App.unitAbbr(App.productUnit(p || { category: it.category }));
      const cus = cu ? ' ' + cu : '';
      const sw = (it.category === 'Bottle Beer') ? 'btls' : 'pours';
      const invList = it.product_id ? (App.data.variance_investigations || []).filter(i => i.product_id === it.product_id) : [];
      const invOpen = invList.some(i => i.status !== 'resolved');
      const invResolved = !invOpen && invList.some(i => i.status === 'resolved');
      const action = (it.product_id && (it.flagged || invOpen || invResolved))
        ? '<button class="btn btn-ghost btn-sm sp-review" data-pid="' + esc(it.product_id) + '" data-name="' + esc(it.name) + '" style="' + (invResolved ? 'color:var(--green);' : 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);') + '">' + (invOpen ? 'Reviewing' : invResolved ? 'Resolved' : 'Review') + '</button>'
        : '';
      // A product that was on the check but never counted is LABELLED, not printed as a row of
      // zeros. Same treatment as a skipped product in Count History.
      const skipped = !!it.not_counted;
      return '<tr><td><div class="val">' + esc(it.name)
        + (skipped ? ' <span style="font-size:9px;font-weight:700;letter-spacing:.5px;color:var(--amber);">NOT COUNTED</span>' : '') + '</div></td>'
        + '<td>' + esc(it.category || '-') + '</td>'
        + '<td>' + (it.pre != null ? it.pre.toFixed(1) + cus : '-') + '</td>'
        + '<td>' + (it.post != null ? it.post.toFixed(1) + cus : '-') + '</td>'
        + '<td>' + (it.poured != null ? it.poured.toFixed(1) + ' ' + sw : '-') + '</td>'
        + '<td>' + (it.pos_sold != null ? it.pos_sold.toFixed(1) + ' ' + sw : '-') + '</td>'
        + '<td class="' + (it.flagged ? 'neg' : '') + '">'
        + (it.variance_pours != null ? (it.variance_pours > 0 ? '+' : '') + it.variance_pours.toFixed(1) + ' ' + sw : '-') + '</td>'
        + '<td class="' + (it.flagged ? 'neg' : '') + '">'
        + (vd != null ? (vd > 0 ? '+' : '') + App.fmtBal(vd, 2) : '-') + '</td>'
        + '<td><div class="row-actions">' + action + '</div></td></tr>';
    }).join('');

    const meta = (label, val, cls) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val ' + (cls || '') + '">' + val + '</div></div>';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + meta('Location', esc(c.location || '-'))
      + meta('Shift', esc(c.shift || '-'))
      + meta('Checked By', esc(c.checked_by || '-'))
      + meta('Flagged', (c.flagged_count || 0), (c.flagged_count ? 'warn' : ''))
      + meta('Total Variance', ((c.total_variance_dollar || 0) > 0 ? '+' : '') + App.fmtBal(c.total_variance_dollar || 0, 2), ((c.total_variance_dollar || 0) > 0 ? 'warn' : ''))
      + '</div></div>'
      + '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Spot Check &middot; ' + this.fmtDate(c.date) + '</div>'
      + '<div style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" id="sp-export">Export PDF</button></div></div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Product</th><th>Category</th><th>Pre</th><th>Post</th><th>Poured</th><th>POS Sold</th>'
      + '<th>Variance</th><th>Variance $</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#sp-export')) { App.exportPDF({ title: 'Spot Check', root: this.container }); return; }
      const inv = ev.target.closest('.sp-review');
      if (inv) { ev.stopPropagation(); S.TheftRisk.openInvestigationModal(inv.dataset.pid, inv.dataset.name, { source: 'spot-check', spotCheckId: id, onClose: () => this.renderDetail(id) }); }
    };
  },

  async confirmDel(id) {
    if (!(await App.confirmDelete())) return;
    await App.removeRecord('ic', 'spot_check', id);
    if (this._onHistory) this.renderHistory(); else this.renderMain();
  }
};
