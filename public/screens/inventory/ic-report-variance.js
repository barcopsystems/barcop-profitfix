'use strict';

/* ── Inventory Control — Variance Report (ic_counts + ic_deliveries + POS) ────
   Compares what was used (from inventory counts) against what was sold (from a
   POS sales CSV). Two-step flow:

   LANDING: front and center is the QUICK VARIANCE CHECK — pick a count period and
   key in your actual category sales (off the POS sales-by-category report); Bar Cop
   compares them to the theoretical (the period's comp/waste-adjusted usage valued at
   each product's pour price, summed by category) for an instant per-category +
   overall variance, with a vs-last-period column and an overall-variance trend strip.
   No upload needed; actuals save per period (variance_category_sales). BELOW that,
   "Dig Deeper" is the product-level path: set Variance Standards, import the POS
   sales for that date range, map any unmatched products, then Run Report. Running
   SAVES the run (the period + the uploaded POS) to history, keyed by the count
   period — one run per period, re-running overwrites it. Standards are NOT saved:
   OK/Flag always re-derives from your CURRENT standards, so changing a standard
   re-judges every saved period consistently. (See [[help-model]]: the nav "i".)

   REPORT: a clean read-only view of one saved run — a two-period scroller over
   the saved runs for lookback, stats, and the Sales Variance / Usage Variance /
   History tabs. The Sales and Usage tabs group products by category (the category
   in each table's first column header). The History tab is the variance trend
   across saved periods. Stepping the scroller loads THAT run's saved POS alongside
   its usage, so the two never mismatch.

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
  QUICK_CATS: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer'],  // the 4 main bar categories for the Quick Variance Check

  DEFAULT_THRESHOLDS: {
    'Liquor':        { flag: 2 },
    'Wine':          { flag: 3 },
    'Bottle Beer':   { flag: 2 },
    'Draft Beer':    { flag: 10 },
    'Misc':          { flag: 10 },
    'Food':          { flag: 5 },
    'By the Bottle': { bottles: 1 }
  },
  // 'Bottle Beer' (a %) drives the Quick Variance Check, where bottle beer is a
  // category-level dollar variance. Bottle beer PRODUCTS in the deep-dive still
  // map to 'By the Bottle' (a bottle count) via stdKey.
  STD_ORDER: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Misc', 'Food', 'By the Bottle'],

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
      { h: 'Quick Variance Check (No Upload)', p: ['The fastest read is the Quick Variance Check on the landing. Pick a count period and Bar Cop shows what each beverage category should have rung at your standard pour pricing. Type in your actual category sales off your POS sales-by-category report and the variance shows instantly, per category and overall, with last period beside it. A few percent is normal over-pour and rounding; a big gap is where to look. No file upload needed. It assumes your drinks are priced off your standard pour costs; food and recipe items are covered in the deep dive below.'] },
      { h: 'Dig Deeper: Set It Up, Then Run It', p: ['For product-by-product detail, scroll to Dig Deeper, set your variance standards, then upload a product sales report from your POS for that exact date range. Map the product name, quantity, and sales columns once, map anything unmatched, then Run Report. Bar Cop saves the run so you can look back at it later.'] },
      { h: 'Map Anything Unmatched', p: ['Any POS row that does not line up with a product or menu item shows under Unmatched. Map each one once and Bar Cop remembers it for every future upload. Cocktails and plates explode through their recipe so each ingredient gets its share. If a product sells in more than one size, a pint and a pitcher, each size you set up shows as its own choice, so map the pitcher line to the pitcher size and it draws the right ounces and revenue.'] },
      { h: 'Comps And Waste Come Out First', p: ['Bar Cop subtracts logged comps and waste from your used number before comparing to sales, because those are known non-revenue losses. What is left is the amount that should match POS, so variance is unexplained loss, not give-aways you already tracked.'] },
      { h: 'Two Views', p: ['Sales Variance is in dollars: what the product you poured should have rung up versus what the register actually rang. Usage Variance reads in each category\'s own unit. Liquor and wine show ounces, pours, and bottles. Draft shows ounces and kegs. Bottle beer matches bottle for bottle. Mixers read in quarts. Food reads per ingredient in its own unit. Cocktails and plates explode through their recipe so each ingredient gets its share.'] },
      { h: 'Variance Standards (You Set These)', p: [
        'Each category gets one number: the variance you will accept before it flags. Below the line is OK, above it flags. Set your own on the setup screen. Starting points:',
        'Liquor: flag over 2%. Wine by the glass: over 3%. Draft: over 10%. Misc mixers: over 10%. Food: over 5%.',
        'By the Bottle (bottle beer, wine by the bottle, champagne splits): flags the moment a single bottle is unaccounted, because it is bottle-in, bottle-out.' ] },
      { h: 'History', p: ['Every run is saved against its count period, so the History tab shows your variance trend period over period, and you can reopen any past run with the period scroller up top or by clicking a row in History. Re-running a period replaces it, and because standards are never frozen into a saved run, tightening a standard re-judges your whole history consistently.'] }
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

  // A flagged product opens the shared investigation modal (worked in place,
  // against the same record Loss Prevention reads) — no page leave. The modal
  // lives on S.TheftRisk so the Variance Report and Spot Check stay identical.

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    // Always land on the Quick Variance Check (setup). The deep-dive product
    // report opens from a POS run or "View saved reports".
    this.reportOpen = false;
    this.posRows = null;
    this._unmatchedCollapsed = null;
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

  // ── SETUP / LANDING (Quick Variance Check + the deep-dive upload) ───────────
  renderSetup() {
    const period = this.currentPeriod();

    const periodRow = '<div class="no-print" style="margin:0 0 14px;">' + this.periodStepper() + '</div>';

    let importBlock;
    if (!this.posRows) {
      importBlock = '<div class="card form-card"><div class="card-title">Upload Full POS Sales</div>'
        + '<div style="font-size:11px;color:var(--t3);margin:-4px 0 12px;">Breaks your variance down to every product, recipe-level.</div>'
        + '<div id="vr-import"></div></div>'
        + '<div id="vr-import-actions"></div>';
    } else {
      importBlock = this.matchSummary() + this.unmatchedCard()
        + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary" id="vr-run">Run Report</button>'
        + '<button class="btn btn-ghost" id="vr-reimport">Re-import a different file</button>'
        + '</div>';
    }
    const digDeeper = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:28px 0 10px;">'
      + '<div class="sh" style="margin:0;">Dig Deeper: Product-by-Product Detail</div>'
      + (this.runs().length ? '<button class="btn btn-ghost btn-sm" id="vr-view-saved">View saved reports</button>' : '')
      + '</div>'
      + importBlock;

    // Standards sit up top: one global setting governing both the Quick Variance
    // Check below and the deep-dive run reports.
    this.container.innerHTML = '<div class="screen">'
      + this.varianceStandardsCard()
      + periodRow + this.quickStatStrip() + this.quickCheckCard() + this.quickTrendStrip() + digDeeper + '</div>';

    // Period scroller.
    document.getElementById('vrq-period-prev')?.addEventListener('click', () => this.stepPeriod(-1));
    document.getElementById('vrq-period-next')?.addEventListener('click', () => this.stepPeriod(1));
    document.getElementById('vrq-period-latest')?.addEventListener('click', () => { const a = this.countsAsc(); if (a.length) { this.endCountId = a[a.length - 1].id; this.posRows = null; this._unmatchedCollapsed = null; this.draw(); } });
    document.getElementById('vr-view-saved')?.addEventListener('click', () => { const r = this.runsSorted()[0]; if (r) { this.loadRun(r); this.draw(); this.scrollTop(); } });

    // Quick Variance Check: live recompute on input, save the actuals per period
    // on change.
    this.container.querySelectorAll('.qv-in').forEach(inp => {
      inp.addEventListener('input', () => this.recomputeQuickCheck());
      inp.addEventListener('change', async () => {
        const store = this.categorySalesStore(), eid = period.endC.id;
        if (!store[eid]) store[eid] = {};
        const raw = inp.value;
        if (raw === '' || raw == null || isNaN(parseFloat(raw))) delete store[eid][inp.dataset.cat];
        else store[eid][inp.dataset.cat] = parseFloat(raw);
        await App.saveInventory();
      });
    });

    this.wireStandards();

    if (!this.posRows) {
      CSVMapper.mount(document.getElementById('vr-import'), {
        actionsEl: document.getElementById('vr-import-actions'),
        confirmLabel: 'Import POS Sales',
        dropTitle: 'Drop your ' + this.fmtLong(period.startC.date) + ' to ' + this.fmtLong(period.endC.date) + ' POS sales file here',
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
          this.draw();                 // stay on the landing; now shows mapping + Run Report
        }
      });
    } else {
      document.getElementById('vr-run')?.addEventListener('click', () => this.runReport());
      document.getElementById('vr-reimport')?.addEventListener('click', () => { this.posRows = null; this._unmatchedCollapsed = null; this.draw(); });
      this.wireSetupMapping();
    }
  },

  // ── Quick Variance Check (key in category sales, no POS upload) ──────────────
  categorySalesStore() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!App.inventoryData.variance_category_sales) App.inventoryData.variance_category_sales = {};
    return App.inventoryData.variance_category_sales;
  },
  categorySalesFor(endCountId) { return this.categorySalesStore()[endCountId] || {}; },

  // Theoretical category sales for the CURRENT period: each product's pours valued
  // at its menu price, summed by category, with coverage (priced of sellable). Only
  // products sold by a pour/serving contribute, so Food/Misc ingredients drop out.
  categoryTheoretical() {
    const usage = this.usageMap();
    const out = {};
    Object.keys(usage).forEach(pid => {
      const u = usage[pid], p = u.product || {};
      const cat = p.category;
      if (!this.QUICK_CATS.includes(cat) || u.poursMade == null) return;
      if (!out[cat]) out[cat] = { theo: 0, priced: 0, total: 0 };
      out[cat].total++;
      if (p.menu_price) { out[cat].theo += u.poursMade * p.menu_price; out[cat].priced++; }
    });
    return out;
  },
  // Same, for an arbitrary period (vs-Last + trend). Save/restore the selected
  // period so the live page is untouched.
  categoryTheoForPeriod(endCountId) {
    const saved = this.endCountId;
    this.endCountId = endCountId;
    const out = this.categoryTheoretical();
    this.endCountId = saved;
    return out;
  },
  // Overall variance for a period across only the categories the operator entered
  // (apples to apples). Null if nothing entered.
  overallVarianceForPeriod(endCountId) {
    const theoMap = this.categoryTheoForPeriod(endCountId);
    const actuals = this.categorySalesFor(endCountId);
    let theo = 0, actual = 0, any = false;
    Object.keys(theoMap).forEach(cat => {
      if (actuals[cat] == null) return;
      theo += theoMap[cat].theo; actual += parseFloat(actuals[cat]) || 0; any = true;
    });
    if (!any) return null;
    return { theo, actual, variance: theo - actual, pct: theo ? (theo - actual) / theo * 100 : null };
  },

  // ── Quick Variance Check flagging (off the per-category Variance Standards) ──
  // A beverage category flags when its variance % exceeds its own standard, so the
  // Quick Check and the deep-dive run reports judge against the same numbers.
  quickFlagPct(cat) {
    const t = this.thresholds()[cat];
    return (t && t.flag != null) ? parseFloat(t.flag) : null;
  },
  quickOver(cat, pct) {
    const f = this.quickFlagPct(cat);
    return (f != null && pct != null && Math.abs(pct) > f);
  },
  // Did any entered category breach its standard in a given period (trend strip).
  periodAnyOver(endCountId) {
    const theoMap = this.categoryTheoForPeriod(endCountId);
    const actuals = this.categorySalesFor(endCountId);
    return this.QUICK_CATS.some(c => {
      if (!theoMap[c] || actuals[c] == null) return false;
      const t = theoMap[c].theo;
      const pct = t ? (t - (parseFloat(actuals[c]) || 0)) / t * 100 : null;
      return this.quickOver(c, pct);
    });
  },

  // The overall headline tiles up top (selected period, fills in as actuals are
  // keyed; everything compares only the categories you've entered).
  quickStatStrip() {
    const period = this.currentPeriod();
    const theoMap = this.categoryTheoretical();
    const actuals = this.categorySalesFor(period.endC.id);
    const cats = this.QUICK_CATS.filter(c => theoMap[c] && theoMap[c].total > 0);
    let theo = 0, actual = 0, any = false, anyOver = false;
    cats.forEach(c => {
      if (actuals[c] == null) return;
      theo += theoMap[c].theo; actual += parseFloat(actuals[c]) || 0; any = true;
      const cpct = theoMap[c].theo ? (theoMap[c].theo - (parseFloat(actuals[c]) || 0)) / theoMap[c].theo * 100 : null;
      if (this.quickOver(c, cpct)) anyOver = true;
    });
    const dash = '<span style="color:var(--t4);">-</span>';
    const variance = any ? theo - actual : null;
    const pct = (any && theo) ? variance / theo * 100 : null;
    const pctCol = anyOver ? 'color:var(--amber);' : '';
    return this.statsCard(
      this.statItem('Theoretical Sales', '<span id="qv-stat-theo">' + (any ? App.fmtCurrency(theo) : dash) + '</span>')
      + this.statItem('Actual POS Sales', '<span id="qv-stat-actual">' + (any ? App.fmtCurrency(actual) : dash) + '</span>')
      + this.statItem('Overall Variance', '<span id="qv-stat-var">' + (variance != null ? App.fmtCurrency(variance) : dash) + '</span>')
      + this.statItem('Variance %', '<span id="qv-stat-pct" style="' + pctCol + '">' + (pct != null ? pct.toFixed(1) + '%' : dash) + '</span>'));
  },

  quickCheckCard() {
    const period = this.currentPeriod();
    const theoMap = this.categoryTheoretical();
    const actuals = this.categorySalesFor(period.endC.id);
    const cats = this.QUICK_CATS.filter(c => theoMap[c] && theoMap[c].total > 0);
    this._qvTheo = {};
    cats.forEach(c => { this._qvTheo[c] = theoMap[c].theo; });

    if (!cats.length) {
      return '<div class="card"><div style="font-size:13px;color:var(--t3);padding:6px 2px;">No beverage usage to check for this period yet. This works once your counts cover liquor, beer, or wine and those products have a menu price set.</div></div>';
    }

    const asc = this.countsAsc();
    const endIdx = asc.findIndex(x => x.id === period.endC.id);
    const priorEndId = endIdx >= 2 ? asc[endIdx - 1].id : null;
    const priorTheo = priorEndId ? this.categoryTheoForPeriod(priorEndId) : {};
    const priorActuals = priorEndId ? this.categorySalesFor(priorEndId) : {};
    const priorPct = c => {
      const pt = (priorTheo[c] && priorTheo[c].theo) || null, pa = priorActuals[c];
      if (pt == null || pa == null) return null;
      return pt ? (pt - (parseFloat(pa) || 0)) / pt * 100 : null;
    };
    const dash = '<span style="color:var(--t4);">-</span>';

    const body = cats.map(c => {
      const t = theoMap[c].theo;
      const av = actuals[c];
      const entered = av != null;
      const v = entered ? t - (parseFloat(av) || 0) : null;
      const pct = (entered && t) ? v / t * 100 : null;
      const over = this.quickOver(c, pct);
      const pp = priorPct(c);
      const cov = (theoMap[c].priced < theoMap[c].total)
        ? ' <span style="font-size:9px;color:var(--t3);">(' + theoMap[c].priced + ' of ' + theoMap[c].total + ' priced)</span>' : '';
      return '<tr>'
        + '<td><div class="val">' + esc(c) + cov + '</div></td>'
        + '<td>' + App.fmtCurrency(t) + '</td>'
        + '<td><div class="fw" style="max-width:150px;"><span class="pre">$</span><input class="form-input pre qv-in" data-cat="' + esc(c) + '" type="number" min="0" step="0.01" value="' + (entered ? esc(String(av)) : '') + '" placeholder="0.00"/></div></td>'
        + '<td class="qv-var" data-cat="' + esc(c) + '">' + (entered ? App.fmtCurrency(v) : dash) + '</td>'
        + '<td class="qv-pct" data-cat="' + esc(c) + '"' + (over ? ' style="color:var(--amber);font-weight:700;"' : '') + '>' + (pct != null ? pct.toFixed(1) + '%' : dash) + '</td>'
        + '<td style="color:var(--t3);">' + (pp != null ? pp.toFixed(1) + '%' : dash) + '</td>'
        + '</tr>';
    }).join('');

    const headers = '<th>Category</th><th>Theoretical Sales</th><th>Actual POS Sales</th><th>Variance</th><th>Variance %</th><th>Last Period</th>';
    return this.dataCard(headers, body);
  },

  recomputeQuickCheck() {
    const theo = this._qvTheo || {};
    const dash = '<span style="color:var(--t4);">-</span>';
    let totTheo = 0, totActual = 0, any = false, anyOver = false;
    this.container.querySelectorAll('.qv-in').forEach(inp => {
      const cat = inp.dataset.cat, t = theo[cat] || 0, raw = inp.value;
      const varCell = this.container.querySelector('.qv-var[data-cat="' + cat + '"]');
      const pctCell = this.container.querySelector('.qv-pct[data-cat="' + cat + '"]');
      if (raw === '' || raw == null || isNaN(parseFloat(raw))) {
        if (varCell) varCell.innerHTML = dash;
        if (pctCell) { pctCell.innerHTML = dash; pctCell.style.color = ''; pctCell.style.fontWeight = ''; }
        return;
      }
      const actual = parseFloat(raw) || 0, v = t - actual, pct = t ? v / t * 100 : null;
      if (varCell) varCell.textContent = App.fmtCurrency(v);
      if (pctCell) {
        pctCell.textContent = pct == null ? '-' : pct.toFixed(1) + '%';
        const over = this.quickOver(cat, pct);
        pctCell.style.color = over ? 'var(--amber)' : '';
        pctCell.style.fontWeight = over ? '700' : '';
        if (over) anyOver = true;
      }
      totTheo += t; totActual += actual; any = true;
    });
    const variance = any ? totTheo - totActual : null;
    const pct = (any && totTheo) ? variance / totTheo * 100 : null;
    const setHtml = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    setHtml('qv-stat-theo', any ? App.fmtCurrency(totTheo) : dash);
    setHtml('qv-stat-actual', any ? App.fmtCurrency(totActual) : dash);
    setHtml('qv-stat-var', variance != null ? App.fmtCurrency(variance) : dash);
    const pctEl = document.getElementById('qv-stat-pct');
    if (pctEl) {
      pctEl.innerHTML = pct != null ? pct.toFixed(1) + '%' : dash;
      pctEl.style.color = anyOver ? 'var(--amber)' : '';
    }
  },

  // Overall variance % for the 5 most-recent periods that have entered actuals
  // (capped at 5 so it stays one row on a phone, newest on the right).
  quickTrendStrip() {
    const asc = this.countsAsc();
    const periods = asc.slice(1).map(c => ({ endId: c.id, label: this.fmtDate(c.date) })).reverse().slice(0, 5);
    const items = periods.map(p => {
      const ov = this.overallVarianceForPeriod(p.endId);
      return ov && ov.pct != null ? { label: p.label, pct: ov.pct, endId: p.endId } : null;
    }).filter(Boolean);
    if (items.length < 2) return '';
    const cells = items.reverse().map(it => {   // oldest → newest, left to right
      const col = this.periodAnyOver(it.endId) ? 'var(--amber)' : 'var(--t1)';
      return '<div style="text-align:center;">'
        + '<div style="font-size:16px;font-weight:700;color:' + col + ';white-space:nowrap;">' + it.pct.toFixed(1) + '%</div>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:2px;white-space:nowrap;">' + esc(it.label) + '</div></div>';
    }).join('');
    return '<div class="sh" style="margin:24px 0 10px;">Overall Variance Trend</div>'
      + '<div class="card"><div class="qv-trend">' + cells + '</div></div>';
  },

  // Single-pill period selector, exactly like the Inventory cockpit week selector.
  periodStepper() {
    const ids = this.countsAsc().slice(1).map(c => c.id);   // end-count ids, oldest → newest
    const len = ids.length;
    const cur = this.currentPeriod();
    let selIdx = ids.indexOf(cur ? cur.endC.id : null);
    if (selIdx < 0) selIdx = len - 1;
    const isNewest = selIdx >= len - 1, atOldest = selIdx <= 0;
    const label = cur ? (this.fmtDate(cur.startC.date) + ' - ' + this.fmtDate(cur.endC.date)).toUpperCase() : '';
    const nowBadge = isNewest ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const prevBtn = atOldest
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&lsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm" id="vrq-period-prev" aria-label="Older period" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = isNewest
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm" id="vrq-period-next" aria-label="Newer period" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + esc(label) + nowBadge + '</span>';
    const latestBtn = isNewest ? '' : '<button class="btn btn-ghost btn-sm" id="vrq-period-latest" style="margin-left:4px;">Latest</button>';
    return '<div style="display:inline-flex;align-items:center;gap:8px;">' + prevBtn + pill + nextBtn + latestBtn + '</div>';
  },
  stepPeriod(delta) {
    const ids = this.countsAsc().slice(1).map(c => c.id);
    if (!ids.length) return;
    const cur = this.currentPeriod();
    let selIdx = ids.indexOf(cur ? cur.endC.id : null);
    if (selIdx < 0) selIdx = ids.length - 1;
    const ni = selIdx + delta;
    if (ni < 0 || ni >= ids.length) return;
    this.endCountId = ids[ni];
    this.posRows = null;
    this._unmatchedCollapsed = null;
    this.draw();
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
    const sizeLabel = (p, s, oz) => p.name + ' · ' + (s.label ? s.label + ' ' : '') + '(' + (oz % 1 === 0 ? oz : oz.toFixed(1)) + ' oz)';

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
    const periodLabel = run ? (this.fmtDate(run.start_date) + ' - ' +this.fmtDate(run.end_date)) : '';

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

    // Period = a two-period scroller over the saved runs (no category filter; the
    // Sales and Usage tables group by category instead). History is all-periods,
    // so it shows no scroller.
    const filterArea = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 12px;">'
      + this.runStepper()
      + '<button class="btn btn-ghost btn-sm" id="vr-export">Export PDF</button>'
      + '</div>';
    const runNewRow = '<div class="no-print" style="margin:16px 0 24px;"><button class="btn btn-primary" id="vr-new">Run New Report</button></div>';

    let html;
    if (this.tab === 'history') {
      html = this.tabBar() + this.tabHistory() + runNewRow;
    } else {
      html = this.tabBar() + statsCard + filterArea
        + (this.tab === 'usage' ? this.tabUsage() : this.tabSales()) + runNewRow;
    }
    this.container.innerHTML = '<div class="screen">' + html + '</div>';

    this.container.querySelectorAll('.ch-tab').forEach(btn => btn.addEventListener('click', () => { this.tab = btn.dataset.tab; this.draw(); }));
    document.getElementById('vr-new')?.addEventListener('click', () => this.newReport());
    document.getElementById('vr-export')?.addEventListener('click', () => App.exportPDF({ title: 'Variance Report' + (periodLabel ? ' ' + periodLabel : ''), root: this.container }));
    document.getElementById('vr-period-prev')?.addEventListener('click', () => this.stepRun(-1));
    document.getElementById('vr-period-next')?.addEventListener('click', () => this.stepRun(1));
    document.getElementById('vr-period-latest')?.addEventListener('click', () => { const r = this.runsSorted()[0]; if (r) { this.loadRun(r); this.draw(); } });
    this.container.querySelectorAll('.vr-hist-row').forEach(row => row.addEventListener('click', () => {
      const r = this.runs().find(x => x.id === row.dataset.id);
      if (r) { this.loadRun(r); this.tab = 'sales'; this.draw(); this.scrollTop(); }
    }));
    this.container.querySelectorAll('.vr-review').forEach(b => b.addEventListener('click', ev => {
      ev.stopPropagation();
      S.TheftRisk.openInvestigationModal(b.dataset.pid, b.dataset.name, { onClose: () => this.draw() });
    }));
  },

  // ── Period scroller (single pill over the saved runs, like the cockpit) ─────
  runStepper() {
    const asc = this.runsSorted().slice().reverse();   // oldest → newest
    const len = asc.length;
    let selIdx = asc.findIndex(r => r.id === this._viewRunId);
    if (selIdx < 0) selIdx = len - 1;
    const isNewest = selIdx >= len - 1, atOldest = selIdx <= 0;
    const r = asc[selIdx];
    const label = r ? (this.fmtDate(r.start_date) + ' - ' + this.fmtDate(r.end_date)).toUpperCase() : '';
    const nowBadge = isNewest ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const prevBtn = atOldest
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&lsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm" id="vr-period-prev" aria-label="Older period" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = isNewest
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm" id="vr-period-next" aria-label="Newer period" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + esc(label) + nowBadge + '</span>';
    const latestBtn = isNewest ? '' : '<button class="btn btn-ghost btn-sm" id="vr-period-latest" style="margin-left:4px;">Latest</button>';
    return '<div style="display:inline-flex;align-items:center;gap:8px;">' + prevBtn + pill + nextBtn + latestBtn + '</div>';
  },
  stepRun(delta) {
    const ids = this.runsSorted().slice().reverse().map(r => r.id);  // oldest → newest
    if (!ids.length) return;
    let selIdx = ids.indexOf(this._viewRunId);
    if (selIdx < 0) selIdx = ids.length - 1;
    const ni = selIdx + delta;
    if (ni < 0 || ni >= ids.length) return;
    const r = this.runs().find(x => x.id === ids[ni]);
    if (r) { this.loadRun(r); this.draw(); }
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
        + '<td><div class="val">' + this.fmtDate(r.start_date) + ' - ' +this.fmtDate(r.end_date) + '</div></td>'
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
    if (pid) {
      const investigating = (App.data.variance_investigations || []).some(i => i.product_id === pid && i.status !== 'resolved');
      if (investigating || s.label === 'Flag') {
        return '<button type="button" class="vr-review btn btn-ghost btn-sm" data-pid="' + esc(pid) + '" data-name="' + esc(name || '')
          + '" style="background:var(--gold-tint);border:1px solid var(--gold-tint-bord);white-space:nowrap;">' + (investigating ? 'Reviewing' : 'Review') + '</button>';
      }
    } else if (s.label === 'Flag') {
      return '<span style="font-weight:700;color:' + s.color + ';">Review</span>';
    }
    return '<span style="font-weight:700;color:' + s.color + ';">' + s.label + '</span>';
  },
  cur(v) { return v == null ? '<span style="color:var(--t4);">-</span>' : App.fmtCurrency(v); },
  pct(v) { if (v == null) return '<span style="color:var(--t4);">-</span>'; const x = Number(v.toFixed(1)) === 0 ? 0 : v; return x.toFixed(1) + '%'; },

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
    const restHeaders = '<th>Register Sales</th><th>Theo Sales</th><th>Sales Variance</th>'
      + '<th>Variance %</th><th>Actual Cost %</th><th>Actual Profit</th><th>Status</th>';
    const rows = this.salesRows();
    if (!rows.length) {
      return this.dataCard('<th>Product</th>' + restHeaders, '<tr><td colspan="8" style="color:var(--t3);padding:14px 8px;">'
        + 'No direct-pour products matched your POS for this period. Beer, wine, and liquor sold by the glass or bottle show here. Cocktails and plates are in Usage Variance.</td></tr>');
    }
    const dash = '<span style="color:var(--t4);">-</span>';
    const noData = '<span style="color:var(--t4);font-size:11px;" title="This product sells in more than one size. Map each size and include its quantity sold and sales amount so Bar Cop can compute the variance.">Not enough data to calculate</span>';
    const blended = ' <span style="font-size:8px;color:var(--t3);font-weight:700;letter-spacing:1px;" title="Sold in multiple sizes: theoretical sales is the ounces you used valued at the blended price-per-ounce your POS sold at.">BLENDED</span>';
    const profitCls = r => r.actualProfit != null ? (r.actualProfit >= 0 ? 'pos' : 'neg') : '';
    const rowHtml = r => {
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
    };
    // Group by category (CAT_ORDER first, extras after), name-sorted within, the
    // category in the first column header, a shared colgroup so columns line up.
    const ORDER = this.CAT_ORDER;
    const byCat = {};
    rows.forEach(r => { const c = r.category || 'Uncategorized'; (byCat[c] = byCat[c] || []).push(r); });
    const cats = Object.keys(byCat).sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      return ((ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)) || a.localeCompare(b);
    });
    return cats.map(c => {
      const catRows = byCat[c].slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      return this.dataCard('<th>' + esc(c) + '</th>' + restHeaders, catRows.map(rowHtml).join(''), this.usageColgroup(8));
    }).join('');
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

  usageTableLiquorWine(cat, rows, label) {
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
    return this.usageTbl([label, 'Oz Sold', 'Oz Used', 'Pours', 'Btls Used', 'Oz Var', 'Var %', 'Status'], body);
  },
  usageTableBottleWine(rows, label) {
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
    return this.usageTbl([label, 'Btls Sold', 'Btls Used', 'Btl Var', 'Var %', 'Status'], body);
  },
  usageTableDraft(rows, label) {
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
    return this.usageTbl([label, 'Oz Sold', 'Oz Used', 'Pours', 'Kegs Used', 'Oz Var', 'Var %', 'Status'], body);
  },
  usageTableBottleBeer(rows, label) {
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
    return this.usageTbl([label, 'Btls Sold', 'Btls Used', 'Cases', 'Case Var', 'Btl Var', 'Var %', 'Status'], body);
  },
  usageTableMisc(rows, label) {
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
    return this.usageTbl([label, 'Recipe Qt', 'Counted Qt', 'Qt Var', 'Var %', 'Status'], body);
  },
  foodUnit(name) { const m = /\(([^)]+)\)\s*$/.exec(name || ''); return m ? m[1].trim() : 'unit'; },
  foodName(name) { return String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim(); },
  usageTableFood(rows, label) {
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
    return this.usageTbl([label, 'Unit', 'Recipe Use', 'Counted Use', 'Use Var', 'Var %', 'Status'], body);
  },
  renderUsageCat(cat, rows) {
    // Misc rows are mixers, Food rows are recipe ingredients — name them so.
    const label = cat === 'Misc' ? 'Misc Mixers' : cat === 'Food' ? 'Food Ingredients' : esc(cat);
    if (cat === 'Bottle Beer') return this.usageTableBottleBeer(rows, label);
    if (cat === 'Draft Beer')  return this.usageTableDraft(rows, label);
    if (cat === 'Misc')        return this.usageTableMisc(rows, label);
    if (cat === 'Food')        return this.usageTableFood(rows, label);
    if (cat === 'Wine') {
      const glass  = rows.filter(r => !r.byBottle);
      const bottle = rows.filter(r => r.byBottle);
      let out = glass.length ? this.usageTableLiquorWine('Wine', glass, label) : '';
      if (bottle.length) out += this.usageTableBottleWine(bottle, 'Wine (By the Bottle)');
      return out;
    }
    return this.usageTableLiquorWine(cat, rows, label);
  },
  tabUsage() {
    const avail = this.availableCats();
    if (!avail.length) return this.emptyMatch();
    const out = avail.map(cat => {
      const rows = this.usageVarRows(cat);
      if (!rows.length) return '';
      return this.renderUsageCat(cat, rows);
    }).join('');
    return out || this.emptyMatch();
  },
  emptyMatch() {
    return this.dataCard('<th>Usage Variance</th>', '<tr><td style="color:var(--t3);padding:14px 8px;">'
      + 'No products have both usage data for this period and a matched POS sales row. '
      + 'Check the count period and the unmatched-product mapping.</td></tr>');
  }
};
