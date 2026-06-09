'use strict';

/* ── Inventory Control — Variance Report (ic_counts + ic_deliveries + POS) ────
   Compares what was used (from inventory counts) against what was sold (from a
   POS sales CSV). Two-step flow:

   SETUP (landing): pick the Count Period, set Variance Standards, import the POS
   sales for that exact date range, map any unmatched products, then Run Report.
   Running SAVES the run (the period + the uploaded POS) to history, keyed by the
   count period — one run per period, re-running overwrites it. Standards are NOT
   saved: OK/Flag always re-derives from your CURRENT standards, so changing a
   standard re-judges every saved period consistently and never makes junk
   history. (See [[help-model]] context: the nav "i" carries directions.)

   REPORT: a clean read-only view of one saved run — locked period (a dropdown of
   saved runs for lookback), category selector, stats, and the Sales Variance /
   Usage Variance / History tabs. The History tab is the variance trend across
   saved periods. Switching the period dropdown loads THAT run's saved POS
   alongside its usage, so the two never mismatch.

   Usage Variance reads in each category's natural unit (liquor/wine in ounces +
   pours + bottles, draft in ounces + kegs, bottle beer bottle-to-bottle in
   bottles + cases, mixers in quarts, food per ingredient in its purchase unit). */

S.InventoryVarianceReport = {
  reportOpen: null,     // null = uninitialized, false = setup, true = report
  tab: 'sales',
  endCountId: null,
  catFilter: '',
  posRows: null,        // [{name, qty, sales}] for the current run/view
  manualMap: {},        // { posName(lowercased): productId }
  _viewRunId: null,     // id of the saved run currently shown

  REPORT_TABS: [['sales', 'Sales Variance'], ['usage', 'Usage Variance'], ['history', 'History']],

  CAT_ORDER: ['Liquor', 'Wine', 'Draft Beer', 'Bottle Beer', 'Misc', 'Food'],

  DEFAULT_THRESHOLDS: {
    'Liquor':        { flag: 2 },
    'Wine':          { flag: 3 },
    'Draft Beer':    { flag: 10 },
    'Misc':          { flag: 10 },
    'Food':          { flag: 5 },
    'By the Bottle': { bottles: 1 }
  },
  STD_ORDER: ['Liquor', 'Wine', 'Draft Beer', 'Misc', 'Food', 'By the Bottle'],

  thresholds() {
    if (!App.inventoryData) App.inventoryData = {};
    const stored = App.inventoryData.variance_thresholds || {};
    const out = {};
    Object.keys(this.DEFAULT_THRESHOLDS).forEach(cat => {
      out[cat] = { ...this.DEFAULT_THRESHOLDS[cat], ...(stored[cat] || {}) };
    });
    return out;
  },

  isByBottle(p) {
    if (!p) return false;
    if (p.category === 'Bottle Beer') return true;
    const c = parseFloat(p.container_size_oz) || 0;
    const pr = parseFloat(p.pour_size_oz) || 0;
    return p.category === 'Wine' && c > 0 && pr >= c;
  },
  stdKey(p) { return this.isByBottle(p) ? 'By the Bottle' : ((p && p.category) || 'Liquor'); },

  showHowTo() {
    App.showHelpModal('How the Variance Report Works', [
      { p: ['Variance is the leak detector. It takes what your counts say you used and compares it to what your POS actually sold. The gap is product that left the bar without a matching sale: over-pour, theft, give-aways, or a count error.'] },
      { h: 'Set It Up, Then Run It', p: ['On the setup screen pick the count period, set your variance standards, then upload a product sales report from your POS for that exact date range. Map the product name, quantity, and sales columns once, map anything unmatched, then Run Report. Bar Cop saves the run so you can look back at it later.'] },
      { h: 'Map Anything Unmatched', p: ['Any POS row that does not line up with a product or menu item shows under Unmatched. Map each one once and Bar Cop remembers it for every future upload. Cocktails and plates explode through their recipe so each ingredient gets its share. If a product sells in more than one size, a pint and a pitcher, each size you set up shows as its own choice, so map the pitcher line to the pitcher size and it draws the right ounces and revenue.'] },
      { h: 'Comps And Waste Come Out First', p: ['Bar Cop subtracts logged comps and waste from your used number before comparing to sales, because those are known non-revenue losses. What is left is the amount that should match POS, so variance is unexplained loss, not give-aways you already tracked.'] },
      { h: 'Two Views', p: ['Sales Variance is in dollars: what the product you poured should have rung up versus what the register actually rang. Usage Variance reads in each category\'s own unit. Liquor and wine show ounces, pours, and bottles. Draft shows ounces and kegs. Bottle beer matches bottle for bottle. Mixers read in quarts. Food reads per ingredient in its own unit. Cocktails and plates explode through their recipe so each ingredient gets its share.'] },
      { h: 'Variance Standards (You Set These)', p: [
        'Each category gets one number: the variance you will accept before it flags. Below the line is OK, above it flags. Set your own on the setup screen. Starting points:',
        'Liquor: flag over 2%. Wine by the glass: over 3%. Draft: over 10%. Misc mixers: over 10%. Food: over 5%.',
        'By the Bottle (bottle beer, wine by the bottle, champagne splits): flags the moment a single bottle is unaccounted, because it is bottle-in, bottle-out.' ] },
      { h: 'History', p: ['Every run is saved against its count period, so the History tab shows your variance trend period over period and the Period dropdown lets you reopen any past run. Re-running a period replaces it, and because standards are never frozen into a saved run, tightening a standard re-judges your whole history consistently.'] }
    ]);
  },

  countsAsc() {
    return [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
  },
  deliveries() { return ((App.inventoryData && App.inventoryData.ic_deliveries) || []); },
  voidComps() { return ((App.shiftData && App.shiftData.sc_void_comps) || []); },
  waste()     { return ((App.shiftData && App.shiftData.sc_waste) || []); },
  allProducts() { return ((App.inventoryData && App.inventoryData.ic_products) || []); },
  productById(id) { return this.allProducts().find(p => p.id === id); },
  menuItems() { return ((App.data && App.data.menu_items) || []); },
  menuItemById(id) { return this.menuItems().find(m => m.id === id); },
  savedPosMap() { return (App.inventoryData && App.inventoryData.variance_pos_map) || {}; },

  // Saved runs (one per count period). Newest period first.
  runs() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_variance_runs)) App.inventoryData.ic_variance_runs = [];
    return App.inventoryData.ic_variance_runs;
  },
  runsSorted() {
    return [...this.runs()].sort((a, b) => (b.end_date || '').localeCompare(a.end_date || ''));
  },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },
  fmtLong(str) {
    if (!str) return '';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  },

  // ── Usage for the selected period ─────────────────────────────────────────
  currentPeriod() {
    const asc = this.countsAsc();
    if (asc.length < 2) return null;
    let i = asc.findIndex(c => c.id === this.endCountId);
    if (i < 1) i = asc.length - 1;
    return { startC: asc[i - 1], endC: asc[i] };
  },

  adjustmentsMap(startDate, endDate) {
    const out = {};
    const bump = (pid, units) => {
      if (!pid || !units) return;
      if (!out[pid]) out[pid] = { comp_units: 0, waste_units: 0 };
      return out[pid];
    };
    this.voidComps().forEach(v => {
      if (!v.product_id || v.units == null) return;
      if (v.type !== 'Comp') return;
      if (v.date <= startDate || v.date > endDate) return;
      const entry = bump(v.product_id, v.units);
      const p = this.productById(v.product_id) || {};
      const units = parseFloat(v.units) || 0;
      entry.comp_units += (p.category === 'Bottle Beer' && p.case_size) ? units / p.case_size : units;
    });
    this.waste().forEach(w => {
      if (!w.product_id || w.units == null) return;
      if (w.date <= startDate || w.date > endDate) return;
      const entry = bump(w.product_id, w.units);
      const p = this.productById(w.product_id) || {};
      const units = parseFloat(w.units) || 0;
      if (p.category === 'Draft Beer' && p.container_size_oz) {
        entry.waste_units += units / p.container_size_oz;
      } else if (p.category === 'Bottle Beer' && p.case_size) {
        entry.waste_units += units / p.case_size;
      } else {
        entry.waste_units += units;
      }
    });
    return out;
  },

  usageMap() {
    const period = this.currentPeriod();
    if (!period) return {};
    const { startC, endC } = period;
    const base = App.computeUsagePair(startC, endC, this.deliveries());
    const adj = this.adjustmentsMap(startC.date, endC.date);
    const map = {};
    Object.keys(base).forEach(pid => {
      const b = base[pid];
      const p = b.product || {};
      const a = adj[pid] || { comp_units: 0, waste_units: 0 };
      const adjustments = (a.comp_units || 0) + (a.waste_units || 0);
      const used = Math.max(b.rawUsed - adjustments, 0);
      map[pid] = {
        product: p, name: b.name,
        rawUsed: b.rawUsed, adjustments,
        compUnits: a.comp_units || 0, wasteUnits: a.waste_units || 0, used,
        poursMade:  b.servingsPerUnit != null ? used * b.servingsPerUnit : null,
        ouncesUsed: b.ozPerUnit != null ? used * b.ozPerUnit : null,
        usageCost:  b.unitCost != null ? used * b.unitCost : null
      };
    });
    return map;
  },

  posByProduct() {
    const result = {};
    if (!this.posRows) return result;
    const productByName  = {};
    this.allProducts().forEach(p => { productByName[p.name.toLowerCase().trim()] = p; });
    const menuItemByName = {};
    this.menuItems().forEach(m => { if (m && m.name) menuItemByName[m.name.toLowerCase().trim()] = m; });

    const addProduct = (productId, ouncesSold, qty, sales, fromMenu) => {
      if (!result[productId]) result[productId] = { ouncesSold: 0, qty: 0, sales: 0, fromMenu: false, mixedSizes: false };
      result[productId].ouncesSold += ouncesSold || 0;
      result[productId].qty        += qty        || 0;
      result[productId].sales      += sales      || 0;
      if (fromMenu) result[productId].fromMenu = true;
    };

    this.posRows.forEach(pr => {
      const key = pr.name.toLowerCase().trim();
      let p  = productByName[key];
      let mi = menuItemByName[key];
      const mapped = (!p && !mi) ? this.manualMap[key] : null;
      if (mapped && String(mapped).indexOf('sv|') === 0) {
        const parts = String(mapped).split('|');
        const svPid = parts[1], svOz = parseFloat(parts[2]) || 0;
        if (svPid && svOz) {
          addProduct(svPid, svOz * (parseFloat(pr.qty) || 0), 0, pr.sales, false);
          result[svPid].mixedSizes = true;
        }
        return;
      }
      if (mapped) { p = this.productById(mapped); if (!p) mi = this.menuItemById(mapped); }
      if (p) {
        const ozPer = parseFloat(p.pour_size_oz) || (App.isCaseBeer(p) ? (parseFloat(p.container_size_oz) || 0) : 0);
        const oz = (parseFloat(pr.qty) || 0) * ozPer;
        addProduct(p.id, oz, pr.qty, pr.sales, false);
      } else if (mi) {
        const explosion = App.explodeMenuItem ? App.explodeMenuItem(mi, pr.qty) : {};
        Object.keys(explosion).forEach(pid => { addProduct(pid, explosion[pid], 0, 0, true); });
      }
    });
    return result;
  },

  unmatchedPos() {
    if (!this.posRows) return [];
    const productByName = {};
    this.allProducts().forEach(p => { productByName[p.name.toLowerCase().trim()] = true; });
    const menuItemByName = {};
    this.menuItems().forEach(m => { if (m && m.name) menuItemByName[m.name.toLowerCase().trim()] = true; });
    return this.posRows.filter(pr => {
      const k = pr.name.toLowerCase().trim();
      return !productByName[k] && !menuItemByName[k] && !this.manualMap[k];
    });
  },

  // ── shared markup helpers ───────────────────────────────────────────────────
  tabBar() {
    return '<div class="ch-tabs no-print">'
      + this.REPORT_TABS.map(([k, label]) => '<button class="ch-tab' + (this.tab === k ? ' on' : '') + '" data-tab="' + esc(k) + '">' + esc(label) + '</button>').join('')
      + '</div>';
  },
  statItem(label, val, cls) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
  },
  statsCard(items) {
    return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>';
  },
  dataCard(headers, rowsHtml, fixedColgroup) {
    return '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"' + (fixedColgroup ? ' style="table-layout:fixed;width:100%;min-width:560px;"' : '') + '>'
      + (fixedColgroup || '') + '<thead><tr>' + headers + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>';
  },
  scrollTop() {
    const s = this.container && (this.container.closest('.content') || document.querySelector('.content'));
    if (s) s.scrollTop = 0;
  },

  // ── Run lifecycle ───────────────────────────────────────────────────────────
  loadRun(run) {
    if (!run) return;
    this.posRows = Array.isArray(run.pos_rows) ? run.pos_rows : [];
    this.endCountId = run.end_count_id;
    this._viewRunId = run.id;
    this.manualMap = { ...this.savedPosMap() };
    this.reportOpen = true;
  },
  newReport() {
    this.posRows = null;
    this._viewRunId = null;
    this.reportOpen = false;
    this.manualMap = { ...this.savedPosMap() };
    this._unmatchedCollapsed = null;
    this.draw();
    this.scrollTop();
  },
  async runReport() {
    if (!this.posRows || !this.posRows.length) return;
    const period = this.currentPeriod();
    if (!period) return;
    const unmatched = this.unmatchedPos().length;
    const sr = this.salesRows();
    const rec = {
      id:                   (this.runs().find(r => r.end_count_id === period.endC.id) || {}).id || App.uid(),
      date:                 period.endC.date,            // event-window/sort date
      start_date:           period.startC.date,
      end_date:             period.endC.date,
      start_count_id:       period.startC.id,
      end_count_id:         period.endC.id,
      pos_rows:             this.posRows,
      // Standards-independent summaries for the History trend (no stored verdicts):
      total_sales_variance: sr.reduce((s, r) => s + ((!r.mixedSizes && r.salesVar != null) ? r.salesVar : 0), 0),
      item_count:           this.posRows.length - unmatched,
      run_at:               new Date().toISOString()
    };
    const btn = document.getElementById('vr-run');
    if (btn) { btn.disabled = true; btn.textContent = 'Running...'; }
    const ok = await App.putRecord('ic', 'variance_run', rec);
    if (ok) {
      this._viewRunId = rec.id;
      this.reportOpen = true;
      this.tab = 'sales';
      this.draw();
      this.scrollTop();
    } else if (btn) {
      btn.disabled = false; btn.textContent = 'Run Report';
    }
  },

  // Open (or create) a variance investigation for a flagged product and jump to
  // it in Profit Recovery > Theft Risk, where it is worked and resolved. Mirrors
  // the Spot Check flag so the investigation trail is one shared place.
  openInvestigation(productId, productName) {
    if (!productId) return;
    App.data.variance_investigations = App.data.variance_investigations || [];
    const existing = App.data.variance_investigations.find(i => i.product_id === productId && i.status !== 'resolved');
    if (!existing) {
      const steps = (S.TheftRisk && S.TheftRisk.VARIANCE_STEPS)
        ? S.TheftRisk.VARIANCE_STEPS.map(() => ({ done: false, finding: '' })) : [];
      App.putRecord('core', 'variance_investigation', {
        id: App.uid(), product_id: productId, sku: productName || '',
        opened_date: App.todayLocal(), created_at: new Date().toISOString(),
        status: 'open', steps, resolution: ''
      });
    }
    App.showApp('profit');
    App.navigate('theft-risk');
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    // Entering the screen with nothing in flight: open the latest saved run if
    // one exists, otherwise start in setup.
    if (!this.reportOpen && !this.posRows) {
      const latest = this.runsSorted()[0];
      if (latest) this.loadRun(latest);
    }
    this.draw();
  },

  draw() {
    this.container.onclick = null;
    this.container.onchange = null;
    if (this.countsAsc().length < 2) {
      App.setupCard(this.container, {
        title: 'Variance Report',
        lead: 'Variance compares what you used against what your POS rang up, so theft, over-pouring, and waste surface as a dollar gap.',
        steps: [
          { title: 'Take two inventory counts', desc: 'Variance needs usage between two counts to compare against your sales. Submit at least two to get started.', btn: 'Take Inventory', screen: 'ic-take-inventory', done: false }
        ]
      });
      return;
    }
    if (this.reportOpen && this.posRows) this.renderReport();
    else this.renderSetup();
  },

  // ── SETUP (landing) ─────────────────────────────────────────────────────────
  renderSetup() {
    const asc = this.countsAsc();
    const period = this.currentPeriod();
    const periodOpts = asc.slice(1).map((c, i) =>
      '<option value="' + c.id + '"' + (c.id === period.endC.id ? ' selected' : '') + '>'
      + this.fmtDate(asc[i].date) + ' &rarr; ' + this.fmtDate(c.date) + '</option>').reverse().join('');

    const viewSaved = this.runs().length
      ? '<div style="align-self:flex-end;padding-bottom:9px;font-size:12px;color:var(--t3);">or <span id="vr-view-saved" style="color:var(--gold);cursor:pointer;text-decoration:underline;">view saved reports</span></div>'
      : '';
    const controls = '<div class="card form-card no-print"><div class="card-title">Variance Report</div>'
      + '<div class="form-row" style="gap:16px;align-items:flex-end;margin-bottom:0;flex-wrap:wrap;"><div class="f" style="width:280px;margin-bottom:0;">'
      + '<label>Select Count Period</label><select id="vr-period">' + periodOpts + '</select></div>'
      + viewSaved + '</div></div>';

    let importBlock;
    if (!this.posRows) {
      importBlock = '<div class="sh" style="margin:24px 0 10px;">Import POS Sales</div><div id="vr-import"></div>';
    } else {
      importBlock = this.matchSummary() + this.unmatchedCard()
        + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary" id="vr-run">Run Report</button>'
        + '<button class="btn btn-ghost" id="vr-reimport">Re-import a different file</button>'
        + '</div>';
    }

    this.container.innerHTML = '<div class="screen">' + controls + this.varianceStandardsCard() + importBlock + '</div>';

    // Changing the period invalidates any already-dropped file (a file belongs to
    // one date range), so clear it and return to the dropzone for the new period.
    document.getElementById('vr-period')?.addEventListener('change', e => {
      this.endCountId = e.target.value;
      this.posRows = null;
      this._unmatchedCollapsed = null;
      this.draw();
    });
    document.getElementById('vr-view-saved')?.addEventListener('click', () => { const r = this.runsSorted()[0]; if (r) { this.loadRun(r); this.draw(); this.scrollTop(); } });
    this.wireStandards();

    if (!this.posRows) {
      CSVMapper.mount(document.getElementById('vr-import'), {
        confirmLabel: 'Import POS Sales',
        dropTitle: 'Drop your ' + this.fmtLong(period.startC.date) + ' – ' + this.fmtLong(period.endC.date) + ' POS sales file here',
        dropSub: 'Needs columns for product name, quantity sold, and sales amount.',
        fields: [
          { key: 'name',  label: 'Product Name',   required: true,  match: ['product', 'item', 'name', 'description', 'menu item'] },
          { key: 'qty',   label: 'Quantity Sold',  required: false, match: ['qty', 'quantity', 'sold', 'units', 'count'] },
          { key: 'sales', label: 'Sales Amount',   required: false, match: ['sales', 'amount', 'revenue', 'net sales', 'total'] }
        ],
        onComplete: rows => {
          this.posRows = rows.map(r => ({
            name: String(r.name || '').trim(),
            qty: parseFloat(String(r.qty || '').replace(/[^0-9.]/g, '')) || 0,
            sales: parseFloat(String(r.sales || '').replace(/[^0-9.-]/g, '')) || 0
          })).filter(r => r.name);
          this.manualMap = { ...this.savedPosMap() };
          this._unmatchedCollapsed = null;
          this.draw();                 // stay in setup; now shows mapping + Run Report
        }
      });
    } else {
      document.getElementById('vr-run')?.addEventListener('click', () => this.runReport());
      document.getElementById('vr-reimport')?.addEventListener('click', () => { this.posRows = null; this._unmatchedCollapsed = null; this.draw(); });
      this.wireSetupMapping();
    }
  },

  matchSummary() {
    const unmatched = this.unmatchedPos().length;
    const recognized = this.posRows.length - unmatched;
    const savedCount = Object.keys(this.savedPosMap()).length;
    const clearBtn = savedCount ? '<button class="btn btn-ghost btn-sm" id="vr-clearmap">Clear saved mappings</button>' : '';
    return '<div class="alert-bar no-print" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<div class="alert-text">' + this.posRows.length + ' rows imported &middot; '
      + recognized + ' recognized' + (unmatched ? ' &middot; ' + unmatched + ' unmatched' : '')
      + (savedCount ? ' &middot; ' + savedCount + ' remembered' : '') + '.</div>'
      + (clearBtn ? '<div style="flex-shrink:0;">' + clearBtn + '</div>' : '') + '</div>';
  },

  _MATCH_STOP: new Set(['the', 'and', 'with', 'of', 'a', 'an', 'oz', 'for', 'to']),
  _tokens(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')
      .filter(t => t.length >= 2 && !this._MATCH_STOP.has(t));
  },
  _bestMatchGroup(posName, cands) {
    const pt = new Set(this._tokens(posName));
    if (!pt.size) return '';
    const scored = cands.map(c => ({ c, score: c.tokens.reduce((n, t) => n + (pt.has(t) ? 1 : 0), 0) }))
      .filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
    if (!scored.length) return '';
    return '<optgroup label="Best Matches">'
      + scored.map(x => '<option value="' + esc(x.c.value) + '">' + esc(x.c.label) + '</option>').join('') + '</optgroup>';
  },

  unmatchedCard() {
    const un = this.unmatchedPos();
    if (!un.length) return '';
    const sortedProds = this.allProducts().slice().sort((a, b) => a.name.localeCompare(b.name));
    const sortedMenu  = this.menuItems().slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const sizeTargets = sortedProds.filter(p => Array.isArray(p.serving_sizes) && p.serving_sizes.length);
    const sizeLabel = (p, s, oz) => p.name + ' — ' + (s.label ? s.label + ' ' : '') + '(' + (oz % 1 === 0 ? oz : oz.toFixed(1)) + ' oz)';

    let full = '';
    if (sortedMenu.length) full += '<optgroup label="Menu Items">'
      + sortedMenu.map(m => '<option value="' + esc(m.id) + '">' + esc(m.name) + '</option>').join('') + '</optgroup>';
    if (sizeTargets.length) {
      full += '<optgroup label="Product Sizes">';
      sizeTargets.forEach(p => p.serving_sizes.forEach(s => {
        const oz = parseFloat(s.size_oz) || 0; if (!oz) return;
        full += '<option value="sv|' + esc(p.id) + '|' + oz + '">' + esc(sizeLabel(p, s, oz)) + '</option>';
      }));
      full += '</optgroup>';
    }
    if (sortedProds.length) full += '<optgroup label="Inventory Products">'
      + sortedProds.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('') + '</optgroup>';

    const cands = [];
    sortedMenu.forEach(m => cands.push({ value: m.id, label: m.name, tokens: this._tokens(m.name) }));
    sizeTargets.forEach(p => p.serving_sizes.forEach(s => {
      const oz = parseFloat(s.size_oz) || 0; if (!oz) return;
      cands.push({ value: 'sv|' + p.id + '|' + oz, label: sizeLabel(p, s, oz), tokens: this._tokens(p.name + ' ' + (s.label || '')) });
    }));
    sortedProds.forEach(p => cands.push({ value: p.id, label: p.name, tokens: this._tokens(p.name) }));

    const skip = '<option value="">Skip: not a tracked item</option>';
    const rows = un.map(pr => '<div class="form-row" style="gap:12px;align-items:center;margin-bottom:8px;">'
      + '<div style="width:240px;font-size:13px;color:var(--t1);font-weight:600;flex-shrink:0;">' + esc(pr.name) + '</div>'
      + '<div class="f" style="width:260px;"><select class="vr-map" data-pos="' + esc(pr.name.toLowerCase().trim()) + '">'
      + skip + this._bestMatchGroup(pr.name, cands) + full + '</select></div></div>').join('');

    return '<div class="card form-card no-print"><div class="card-title">Unmatched POS Products (' + un.length + ')</div>'
      + '<div>' + rows + '</div></div>';
  },

  wireSetupMapping() {
    document.getElementById('vr-clearmap')?.addEventListener('click', async () => {
      if (App.inventoryData) App.inventoryData.variance_pos_map = {};
      this.manualMap = {};
      await App.saveInventory();
      this.draw();
    });
    this.container.querySelectorAll('.vr-map').forEach(sel => sel.addEventListener('change', async e => {
      const pos = e.target.dataset.pos;
      if (!App.inventoryData) App.inventoryData = {};
      if (!App.inventoryData.variance_pos_map) App.inventoryData.variance_pos_map = {};
      if (e.target.value) { this.manualMap[pos] = e.target.value; App.inventoryData.variance_pos_map[pos] = e.target.value; }
      else { delete this.manualMap[pos]; delete App.inventoryData.variance_pos_map[pos]; }
      await App.saveInventory();
      this.draw();
    }));
  },

  wireStandards() {
    this.container.querySelectorAll('.vr-th').forEach(inp => inp.addEventListener('change', async e => {
      const cat = e.target.dataset.cat, key = e.target.dataset.key;
      const v = parseFloat(e.target.value);
      if (!cat || !key || isNaN(v) || v < 0) { this.draw(); return; }
      if (!App.inventoryData) App.inventoryData = {};
      if (!App.inventoryData.variance_thresholds) App.inventoryData.variance_thresholds = {};
      if (!App.inventoryData.variance_thresholds[cat]) App.inventoryData.variance_thresholds[cat] = {};
      App.inventoryData.variance_thresholds[cat][key] = v;
      await App.saveInventory();
      this.draw();
    }));
    document.getElementById('vr-th-reset')?.addEventListener('click', async () => {
      if (App.inventoryData) App.inventoryData.variance_thresholds = {};
      await App.saveInventory();
      this.draw();
    });
  },

  thNum(v) { return (v == null || isNaN(v)) ? '' : String(+v); },
  varianceStandardsCard() {
    const t = this.thresholds();
    const box = key => {
      const isBottle = t[key].bottles != null;
      const field = isBottle ? 'bottles' : 'flag';
      const suffix = isBottle ? 'btl' : '%';
      const step = isBottle ? '1' : '0.5';
      return '<div class="f" style="width:' + (isBottle ? 150 : 120) + 'px;flex-shrink:0;">'
        + '<label>' + esc(key) + '</label>'
        + '<div class="fw"><input class="suf vr-th" type="number" data-cat="' + esc(key) + '" data-key="' + field
        + '" min="0" step="' + step + '" value="' + this.thNum(t[key][field]) + '"/><span class="suf">' + suffix + '</span></div></div>';
    };
    return '<div class="card form-card no-print"><div class="card-title">Set Variance Standards</div>'
      + '<div class="form-row" style="gap:14px;align-items:flex-end;margin-bottom:0;flex-wrap:wrap;">'
      + this.STD_ORDER.map(k => box(k)).join('')
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="vr-th-reset">Reset</button></div>'
      + '</div></div>';
  },

  // ── REPORT (read-only results) ──────────────────────────────────────────────
  renderReport() {
    const run = this.runs().find(r => r.id === this._viewRunId);
    const periodLabel = run ? (this.fmtDate(run.start_date) + ' → ' + this.fmtDate(run.end_date)) : '';

    // Stats headline (current run, current standards).
    const unmatched = this.unmatchedPos().length;
    const recognized = this.posRows.length - unmatched;
    const sr = this.salesRows();
    const flagged = sr.filter(r => !r.mixedSizes && (r.varPct != null || r.unitVar != null)
      && this.status(r.key, r.varPct, r.unitVar).label === 'Flag').length;
    const netVar = sr.reduce((s, r) => s + ((!r.mixedSizes && r.salesVar != null) ? r.salesVar : 0), 0);
    const statsCard = this.statsCard(
      this.statItem('Recognized', recognized)
      + this.statItem('Unmatched', unmatched, unmatched ? 'warn' : '')
      + this.statItem('Flagged', flagged, flagged ? 'warn' : '')
      + this.statItem('Sales Variance', App.fmtCurrency(netVar), netVar > 0 ? 'warn' : ''));

    const runOpts = this.runsSorted().map(r => '<option value="' + esc(r.id) + '"' + (r.id === this._viewRunId ? ' selected' : '') + '>'
      + this.fmtDate(r.start_date) + ' → ' + this.fmtDate(r.end_date) + '</option>').join('');
    const avail = this.availableCats();
    const catOpts = '<option value="">All Categories</option>'
      + avail.map(c => '<option value="' + esc(c) + '"' + (this.catFilter === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');

    const filterHeading = '<div class="no-print" style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:24px 0 10px;">'
      + '<button class="btn btn-ghost btn-sm" id="vr-export">Export PDF</button></div>';
    const runNewRow = '<div class="no-print" style="margin:16px 0 24px;"><button class="btn btn-primary" id="vr-new">Run New Report</button></div>';
    const filterCard = '<div class="card no-print"><div class="form-row" style="gap:14px;align-items:flex-end;margin-bottom:0;flex-wrap:wrap;">'
      + '<div class="f" style="width:240px;flex-shrink:0;"><label>Period</label><select id="vr-run">' + runOpts + '</select></div>'
      + (avail.length ? '<div class="f" style="width:200px;flex-shrink:0;"><label>Category</label><select id="vr-cat">' + catOpts + '</select></div>' : '')
      + '</div></div>';

    let html;
    if (this.tab === 'history') {
      html = this.tabBar() + this.tabHistory() + runNewRow;
    } else {
      html = this.tabBar() + statsCard + filterHeading + filterCard
        + (this.tab === 'usage' ? this.tabUsage() : this.tabSales()) + runNewRow;
    }
    this.container.innerHTML = '<div class="screen">' + html + '</div>';

    this.container.querySelectorAll('.ch-tab').forEach(btn => btn.addEventListener('click', () => { this.tab = btn.dataset.tab; this.draw(); }));
    document.getElementById('vr-new')?.addEventListener('click', () => this.newReport());
    document.getElementById('vr-export')?.addEventListener('click', () => App.exportPDF({ title: 'Variance Report' + (periodLabel ? ' ' + periodLabel : ''), root: this.container }));
    document.getElementById('vr-run')?.addEventListener('change', e => { const r = this.runs().find(x => x.id === e.target.value); if (r) { this.loadRun(r); this.draw(); } });
    document.getElementById('vr-cat')?.addEventListener('change', e => { this.catFilter = e.target.value; this.draw(); });
    this.container.querySelectorAll('.vr-hist-row').forEach(row => row.addEventListener('click', () => {
      const r = this.runs().find(x => x.id === row.dataset.id);
      if (r) { this.loadRun(r); this.tab = 'sales'; this.draw(); this.scrollTop(); }
    }));
    this.container.querySelectorAll('.vr-flag').forEach(b => b.addEventListener('click', ev => {
      ev.stopPropagation();
      this.openInvestigation(b.dataset.pid, b.dataset.name);
    }));
  },

  // ── History tab (variance trend across saved periods) ───────────────────────
  tabHistory() {
    const runs = this.runsSorted();
    const headers = '<th>Period</th><th>Items</th><th>Sales Variance</th><th>Run</th><th></th>';
    if (!runs.length) return this.dataCard(headers, '<tr><td colspan="5" style="color:var(--t3);padding:14px 8px;">No saved variance runs yet. Run a report and it lands here.</td></tr>');
    const body = runs.map(r => {
      const sv = r.total_sales_variance;
      const cls = sv > 0 ? 'neg' : (sv < 0 ? 'pos' : '');
      return '<tr class="vr-hist-row" data-id="' + esc(r.id) + '" style="cursor:pointer;">'
        + '<td><div class="val">' + this.fmtDate(r.start_date) + ' &rarr; ' + this.fmtDate(r.end_date) + '</div></td>'
        + '<td>' + (r.item_count != null ? r.item_count : '-') + '</td>'
        + '<td class="' + cls + '">' + (sv != null ? App.fmtCurrency(sv) : '-') + '</td>'
        + '<td style="color:var(--t3);font-size:11px;">' + this.fmtDate((r.run_at || '').slice(0, 10)) + '</td>'
        + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm vr-hist-view" data-id="' + esc(r.id) + '">View</button></div></td></tr>';
    }).join('');
    return this.dataCard(headers, body);
  },

  // ── Status ────────────────────────────────────────────────────────────────
  status(key, pct, unitVar) {
    const t = this.thresholds()[key] || { flag: 10 };
    if (t.bottles != null) {
      const off = Math.abs(unitVar || 0);
      const lim = parseFloat(t.bottles) || 1;
      return off >= lim - 1e-6 ? { label: 'Flag', color: 'var(--red)' } : { label: 'OK', color: 'var(--green)' };
    }
    return Math.abs(pct || 0) > (parseFloat(t.flag) || 0)
      ? { label: 'Flag', color: 'var(--red)' } : { label: 'OK', color: 'var(--green)' };
  },
  // A flagged row is an action: the status becomes a gold Flag button (cohesive
  // with the Receive Delivery flag) that opens a variance investigation for that
  // product in Profit Recovery. OK stays plain green text.
  badge(key, pct, unitVar, pid, name) {
    const s = this.status(key, pct, unitVar);
    if (s.label === 'Flag' && pid) {
      return '<button type="button" class="vr-flag btn btn-ghost btn-sm" data-pid="' + esc(pid) + '" data-name="' + esc(name || '')
        + '" style="border-color:var(--gold);color:var(--gold);white-space:nowrap;">Flag</button>';
    }
    return '<span style="font-weight:700;color:' + s.color + ';">' + s.label + '</span>';
  },
  cur(v) { return v == null ? '<span style="color:var(--t4);">-</span>' : App.fmtCurrency(v); },
  pct(v) { return v == null ? '<span style="color:var(--t4);">-</span>' : v.toFixed(1) + '%'; },

  // ── Sales Variance ────────────────────────────────────────────────────────
  salesRows() {
    const usage = this.usageMap();
    const pos = this.posByProduct();
    return Object.keys(usage).filter(pid => pos[pid]).map(pid => {
      const u = usage[pid], pr = pos[pid], p = u.product;
      const viaMenu = pr.fromMenu && pr.sales === 0;
      const registerSales = pr.sales;
      let theoSales = null, insufficient = false;
      if (pr.mixedSizes) {
        // Sold at more than one price/size, so "pours made x one menu price" is
        // undefined. Instead value the ounces you USED at the blended price-per-
        // ounce the POS actually sold at. Needs ounces sold + a sales amount;
        // without those there isn't enough to compute it honestly.
        const ouncesSold = pr.ouncesSold || 0;
        if (u.ouncesUsed != null && ouncesSold > 0 && registerSales > 0) {
          theoSales = u.ouncesUsed * (registerSales / ouncesSold);
        } else {
          insufficient = true;
        }
      } else {
        theoSales = (u.poursMade != null && p.menu_price) ? u.poursMade * p.menu_price : null;
      }
      const salesVar = theoSales != null ? theoSales - registerSales : null;
      const varPct = theoSales ? salesVar / theoSales * 100 : null;
      const actualCostPct = (registerSales && u.usageCost != null) ? u.usageCost / registerSales * 100 : null;
      const actualProfit = (u.usageCost != null) ? registerSales - u.usageCost : null;
      const byBottle = this.isByBottle(p);
      const bottlesSold = byBottle && p.container_size_oz ? (pr.ouncesSold || 0) / p.container_size_oz : (pr.qty || 0);
      const unitVar = (byBottle && u.poursMade != null) ? u.poursMade - bottlesSold : null;
      return { pid, name: u.name, category: p.category, key: this.stdKey(p), viaMenu, mixedSizes: pr.mixedSizes, insufficient,
        registerSales, theoSales, salesVar, varPct, actualCostPct, actualProfit, unitVar };
    }).filter(r => !r.viaMenu && (!this.catFilter || r.category === this.catFilter));
  },

  tabSales() {
    const headers = '<th>Product</th><th>Register Sales</th><th>Theo Sales</th><th>Sales Variance</th>'
      + '<th>Variance %</th><th>Actual Cost %</th><th>Actual Profit</th><th>Status</th>';
    const rows = this.salesRows();
    if (!rows.length) {
      return this.dataCard(headers, '<tr><td colspan="8" style="color:var(--t3);padding:14px 8px;">'
        + 'No direct-pour products matched your POS for this period. Beer, wine, and liquor sold by the glass or bottle show here. Cocktails and plates are in Usage Variance.</td></tr>');
    }
    const dash = '<span style="color:var(--t4);">-</span>';
    const noData = '<span style="color:var(--t4);font-size:11px;" title="This product sells in more than one size. Map each size and include its quantity sold and sales amount so Bar Cop can compute the variance.">Not enough data to calculate</span>';
    const blended = ' <span style="font-size:8px;color:var(--t3);font-weight:700;letter-spacing:1px;" title="Sold in multiple sizes: theoretical sales is the ounces you used valued at the blended price-per-ounce your POS sold at.">BLENDED</span>';
    const profitCls = r => r.actualProfit != null ? (r.actualProfit >= 0 ? 'pos' : 'neg') : '';
    const body = rows.map(r => {
      if (r.insufficient) {
        return '<tr>'
          + '<td><div class="val">' + esc(r.name) + '</div></td>'
          + '<td>' + this.cur(r.registerSales) + '</td>'
          + '<td colspan="3">' + noData + '</td>'
          + '<td>' + this.pct(r.actualCostPct) + '</td>'
          + '<td class="' + profitCls(r) + '">' + this.cur(r.actualProfit) + '</td>'
          + '<td>' + dash + '</td></tr>';
      }
      return '<tr>'
        + '<td><div class="val">' + esc(r.name) + (r.mixedSizes ? blended : '') + '</div></td>'
        + '<td>' + this.cur(r.registerSales) + '</td>'
        + '<td>' + this.cur(r.theoSales) + '</td>'
        + '<td>' + this.cur(r.salesVar) + '</td>'
        + '<td>' + this.pct(r.varPct) + '</td>'
        + '<td>' + this.pct(r.actualCostPct) + '</td>'
        + '<td class="' + profitCls(r) + '">' + this.cur(r.actualProfit) + '</td>'
        + '<td>' + ((r.varPct != null || r.unitVar != null) ? this.badge(r.key, r.varPct, r.unitVar, r.pid, r.name) : '-') + '</td>'
        + '</tr>';
    }).join('');
    return this.dataCard(headers, body);
  },

  // ── Usage Variance (category-aware) ─────────────────────────────────────────
  availableCats() {
    const usage = this.usageMap();
    const pos = this.posByProduct();
    const present = new Set();
    Object.keys(usage).forEach(pid => {
      if (!pos[pid]) return;
      const c = (usage[pid].product || {}).category;
      if (this.CAT_ORDER.includes(c)) present.add(c);
    });
    return this.CAT_ORDER.filter(c => present.has(c));
  },

  usageVarRows(cat) {
    const usage = this.usageMap();
    const pos = this.posByProduct();
    const rows = [];
    Object.keys(usage).forEach(pid => {
      if (!pos[pid]) return;
      const u = usage[pid], pr = pos[pid], p = u.product || {};
      if (p.category !== cat) return;
      rows.push({
        pid, name: u.name, fromMenu: pr.fromMenu,
        ouncesUsed: u.ouncesUsed, ouncesSold: pr.ouncesSold || 0,
        poursMade: u.poursMade, containersUsed: u.used,
        containerSizeOz: parseFloat(p.container_size_oz) || 0,
        caseSize: parseFloat(p.case_size) || 0,
        unitType: p.unit_type || '',
        byBottle: this.isByBottle(p)
      });
    });
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },

  n(v, d) { return (v == null || isNaN(v)) ? '<span style="color:var(--t4);">-</span>' : Number(v).toFixed(d == null ? 1 : d); },
  recipeTag(r) { return r.fromMenu ? ' <span style="font-size:8px;color:var(--gold);font-weight:700;letter-spacing:1px;">FROM RECIPE</span>' : ''; },
  // Product column wide enough that "FROM RECIPE" stays on the name's row; Status
  // stays narrow; every data column in between shares the rest equally so the
  // spacing is even (no cramped Oz Var / Var % at the end).
  usageColgroup(n) {
    const cols = [];
    for (let i = 0; i < n; i++) {
      if (i === 0) cols.push('<col style="width:260px;"/>');
      else if (i === n - 1) cols.push('<col style="width:92px;"/>');
      else cols.push('<col/>');
    }
    return '<colgroup>' + cols.join('') + '</colgroup>';
  },
  usageTbl(headers, body) {
    return this.dataCard(headers.map(h => '<th>' + h + '</th>').join(''), body, this.usageColgroup(headers.length));
  },

  usageTableLiquorWine(cat, rows) {
    const body = rows.map(r => {
      const ounceVar = r.ouncesUsed != null ? r.ouncesUsed - r.ouncesSold : null;
      const varPct = (ounceVar != null && r.ouncesUsed) ? ounceVar / r.ouncesUsed * 100 : null;
      return '<tr>'
        + '<td><div class="val">' + esc(r.name) + this.recipeTag(r) + '</div></td>'
        + '<td>' + this.n(r.ouncesSold) + '</td>' + '<td>' + this.n(r.ouncesUsed) + '</td>'
        + '<td>' + this.n(r.poursMade, 0) + '</td>' + '<td>' + this.n(r.containersUsed) + '</td>'
        + '<td>' + this.n(ounceVar) + '</td>' + '<td>' + this.pct(varPct) + '</td>'
        + '<td>' + (varPct != null ? this.badge(cat, varPct, null, r.pid, r.name) : '-') + '</td></tr>';
    }).join('');
    return this.usageTbl(['Product', 'Oz Sold', 'Oz Used', 'Pours', 'Btls Used', 'Oz Var', 'Var %', 'Status'], body);
  },
  usageTableBottleWine(rows) {
    const body = rows.map(r => {
      const bottlesSold = r.containerSizeOz ? r.ouncesSold / r.containerSizeOz : 0;
      const bottlesUsed = r.containersUsed;
      const bottleVar = bottlesUsed != null ? bottlesUsed - bottlesSold : null;
      const varPct = (bottleVar != null && bottlesUsed) ? bottleVar / bottlesUsed * 100 : null;
      return '<tr>'
        + '<td><div class="val">' + esc(r.name) + this.recipeTag(r) + '</div></td>'
        + '<td>' + this.n(bottlesSold, 0) + '</td>' + '<td>' + this.n(bottlesUsed, 0) + '</td>'
        + '<td>' + this.n(bottleVar, 0) + '</td>' + '<td>' + this.pct(varPct) + '</td>'
        + '<td>' + (bottlesUsed != null ? this.badge('By the Bottle', varPct, bottleVar, r.pid, r.name) : '-') + '</td></tr>';
    }).join('');
    return this.usageTbl(['Product', 'Btls Sold', 'Btls Used', 'Btl Var', 'Var %', 'Status'], body);
  },
  usageTableDraft(rows) {
    const body = rows.map(r => {
      const ounceVar = r.ouncesUsed != null ? r.ouncesUsed - r.ouncesSold : null;
      const varPct = (ounceVar != null && r.ouncesUsed) ? ounceVar / r.ouncesUsed * 100 : null;
      return '<tr>'
        + '<td><div class="val">' + esc(r.name) + this.recipeTag(r) + '</div></td>'
        + '<td>' + this.n(r.ouncesSold) + '</td>' + '<td>' + this.n(r.ouncesUsed) + '</td>'
        + '<td>' + this.n(r.poursMade, 0) + '</td>' + '<td>' + this.n(r.containersUsed, 2) + '</td>'
        + '<td>' + this.n(ounceVar) + '</td>' + '<td>' + this.pct(varPct) + '</td>'
        + '<td>' + (varPct != null ? this.badge('Draft Beer', varPct, null, r.pid, r.name) : '-') + '</td></tr>';
    }).join('');
    return this.usageTbl(['Product', 'Oz Sold', 'Oz Used', 'Pours', 'Kegs Used', 'Oz Var', 'Var %', 'Status'], body);
  },
  usageTableBottleBeer(rows) {
    const body = rows.map(r => {
      const cs = r.caseSize || 1;
      const bottlesSold = r.containerSizeOz ? r.ouncesSold / r.containerSizeOz : 0;
      const bottlesUsed = r.containersUsed != null ? r.containersUsed * cs : null;
      const casesUsed = r.containersUsed;
      const casesSold = bottlesSold / cs;
      const caseVar = casesUsed != null ? casesUsed - casesSold : null;
      const bottleVar = bottlesUsed != null ? bottlesUsed - bottlesSold : null;
      const varPct = (bottleVar != null && bottlesUsed) ? bottleVar / bottlesUsed * 100 : null;
      return '<tr>'
        + '<td><div class="val">' + esc(r.name) + this.recipeTag(r) + '</div></td>'
        + '<td>' + this.n(bottlesSold, 0) + '</td>' + '<td>' + this.n(bottlesUsed, 0) + '</td>'
        + '<td>' + this.n(casesUsed) + '</td>' + '<td>' + this.n(caseVar) + '</td>'
        + '<td>' + this.n(bottleVar, 0) + '</td>' + '<td>' + this.pct(varPct) + '</td>'
        + '<td>' + (bottlesUsed != null ? this.badge('By the Bottle', varPct, bottleVar, r.pid, r.name) : '-') + '</td></tr>';
    }).join('');
    return this.usageTbl(['Product', 'Btls Sold', 'Btls Used', 'Cases', 'Case Var', 'Btl Var', 'Var %', 'Status'], body);
  },
  usageTableMisc(rows) {
    const body = rows.map(r => {
      const recipeQt = r.ouncesSold || 0;
      const countedQt = r.containersUsed;
      const qtVar = countedQt != null ? countedQt - recipeQt : null;
      const varPct = (qtVar != null && countedQt) ? qtVar / countedQt * 100 : null;
      return '<tr>'
        + '<td><div class="val">' + esc(r.name) + '</div></td>'
        + '<td>' + this.n(recipeQt, 2) + '</td>' + '<td>' + this.n(countedQt, 2) + '</td>'
        + '<td>' + this.n(qtVar, 2) + '</td>' + '<td>' + this.pct(varPct) + '</td>'
        + '<td>' + (varPct != null ? this.badge('Misc', varPct, null, r.pid, r.name) : '-') + '</td></tr>';
    }).join('');
    return this.usageTbl(['Mixer', 'Recipe Qt', 'Counted Qt', 'Qt Var', 'Var %', 'Status'], body);
  },
  foodUnit(name) { const m = /\(([^)]+)\)\s*$/.exec(name || ''); return m ? m[1].trim() : 'unit'; },
  foodName(name) { return String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim(); },
  usageTableFood(rows) {
    const body = rows.map(r => {
      const recipeUse = r.ouncesSold || 0;
      const countedUse = r.containersUsed;
      const useVar = countedUse != null ? countedUse - recipeUse : null;
      const varPct = (useVar != null && countedUse) ? useVar / countedUse * 100 : null;
      const unit = r.unitType || this.foodUnit(r.name);
      return '<tr>'
        + '<td><div class="val">' + esc(this.foodName(r.name)) + '</div></td>'
        + '<td>' + esc(unit) + '</td>'
        + '<td>' + this.n(recipeUse, 2) + '</td>' + '<td>' + this.n(countedUse, 2) + '</td>'
        + '<td>' + this.n(useVar, 2) + '</td>' + '<td>' + this.pct(varPct) + '</td>'
        + '<td>' + (varPct != null ? this.badge('Food', varPct, null, r.pid, r.name) : '-') + '</td></tr>';
    }).join('');
    return this.usageTbl(['Ingredient', 'Unit', 'Recipe Use', 'Counted Use', 'Use Var', 'Var %', 'Status'], body);
  },
  renderUsageCat(cat, rows) {
    if (cat === 'Bottle Beer') return this.usageTableBottleBeer(rows);
    if (cat === 'Draft Beer')  return this.usageTableDraft(rows);
    if (cat === 'Misc')        return this.usageTableMisc(rows);
    if (cat === 'Food')        return this.usageTableFood(rows);
    if (cat === 'Wine') {
      const glass  = rows.filter(r => !r.byBottle);
      const bottle = rows.filter(r => r.byBottle);
      let out = glass.length ? this.usageTableLiquorWine('Wine', glass) : '';
      if (bottle.length) {
        out += '<div style="font-weight:700;color:var(--t3);font-size:10px;letter-spacing:1.5px;margin:'
          + (glass.length ? '16px' : '2px') + ' 0 8px;">BY THE BOTTLE</div>' + this.usageTableBottleWine(bottle);
      }
      return out;
    }
    return this.usageTableLiquorWine(cat, rows);
  },
  tabUsage() {
    const avail = this.availableCats();
    if (!avail.length) return this.emptyMatch();
    const cats = (this.catFilter && avail.includes(this.catFilter)) ? [this.catFilter] : avail;
    const out = cats.map(cat => {
      const rows = this.usageVarRows(cat);
      if (!rows.length) return '';
      const heading = cats.length > 1 ? '<div class="sh" style="margin:24px 0 10px;">' + esc(cat) + '</div>' : '';
      return heading + this.renderUsageCat(cat, rows);
    }).join('');
    return out || this.emptyMatch();
  },
  emptyMatch() {
    return this.dataCard('<th>Usage Variance</th>', '<tr><td style="color:var(--t3);padding:14px 8px;">'
      + 'No products have both usage data for this period and a matched POS sales row. '
      + 'Check the count period and the unmatched-product mapping.</td></tr>');
  }
};
