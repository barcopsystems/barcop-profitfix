'use strict';

/* ── Inventory Control — Variance Report (ic_counts + ic_deliveries + POS) ────
   Compares what was used (from inventory counts) against what was sold (from a
   POS sales CSV). Two views: Sales Variance (dollars) and Usage Variance, which
   reads in each category's natural unit (liquor/wine in ounces + pours +
   bottles, draft in ounces + kegs, bottle beer bottle-to-bottle in bottles +
   cases, mixers in quarts, food per ingredient in its own purchase unit). A
   Category picker focuses one category or stacks them all. POS sales are
   imported with the reusable CSVMapper; the import stays in memory for the
   session. */

S.InventoryVarianceReport = {
  tab: 'sales',
  endCountId: null,
  catFilter: '',        // '' = all categories, else one of CAT_ORDER
  posRows: null,        // [{name, qty, sales}]
  manualMap: {},        // { posName(lowercased): productId }

  TABS: [['sales','Sales Variance','rpt-v-sales'], ['usage','Usage Variance','rpt-v-usage']],

  // Usage Variance reads in each category's NATURAL unit, modeled on the old
  // inventory program: liquor/wine in ounces (with pours + bottles), draft in
  // ounces + kegs, bottle beer bottle-to-bottle in bottles + cases (no ounces,
  // beer matches the POS directly), mixers in quarts, food per ingredient in
  // its own purchase unit (lb / each / dozen / case / bag). Every category is
  // the same engine: what the recipes drew versus what the count says left.
  CAT_ORDER: ['Liquor', 'Wine', 'Draft Beer', 'Bottle Beer', 'Misc', 'Food'],

  // Variance standards, one number per category, because the categories do not
  // leak the same way. Percent categories: anything OVER `flag` percent flags to
  // investigate, below is OK (no middle "watch" tier). "By the Bottle" covers
  // everything sold whole (bottle beer, wine by the bottle, champagne splits):
  // bottle-in, bottle-out, so it flags the moment `bottles` or more are
  // unaccounted. Operator-tunable in the Variance Standards card; overrides
  // persist to App.inventoryData.variance_thresholds.
  DEFAULT_THRESHOLDS: {
    'Liquor':        { flag: 2 },
    'Wine':          { flag: 3 },
    'Draft Beer':    { flag: 10 },
    'Misc':          { flag: 10 },
    'Food':          { flag: 5 },
    'By the Bottle': { bottles: 1 }
  },
  // The order the boxes show in the Variance Standards card.
  STD_ORDER: ['Liquor', 'Wine', 'Draft Beer', 'Misc', 'Food', 'By the Bottle'],
  TT_BY_CAT: {
    'Liquor': 'vr-std-liquor', 'Wine': 'vr-std-wine', 'Draft Beer': 'vr-std-draft',
    'Misc': 'vr-std-misc', 'Food': 'vr-std-food', 'By the Bottle': 'vr-std-bottle'
  },

  // Merge stored overrides over the defaults so a partial override still resolves
  // to a full standard set.
  thresholds() {
    if (!App.inventoryData) App.inventoryData = {};
    const stored = App.inventoryData.variance_thresholds || {};
    const out = {};
    Object.keys(this.DEFAULT_THRESHOLDS).forEach(cat => {
      out[cat] = { ...this.DEFAULT_THRESHOLDS[cat], ...(stored[cat] || {}) };
    });
    return out;
  },

  // True when a product is tracked bottle-in / bottle-out: bottle beer, or a wine
  // sold whole (its pour size is the whole bottle). These use the By the Bottle
  // count standard, not a pour percent.
  isByBottle(p) {
    if (!p) return false;
    if (p.category === 'Bottle Beer') return true;
    const c = parseFloat(p.container_size_oz) || 0;
    const pr = parseFloat(p.pour_size_oz) || 0;
    return p.category === 'Wine' && c > 0 && pr >= c;
  },
  // The standard key a product is judged on.
  stdKey(p) { return this.isByBottle(p) ? 'By the Bottle' : ((p && p.category) || 'Liquor'); },

  showImportHelp() {
    App.showHelpModal('How the POS Import Works', [
      { p: ['Variance compares what you used against what you sold, so it needs your POS sales. Export a product sales report from your POS and drop it on the box. Toast, Square, Aloha, Lightspeed, or any system that exports a spreadsheet works.'] },
      { h: 'The File', p: ['A CSV or Excel file (.csv, .xlsx, .xls). The first row is your column headers, one product per row. This is the standard product or item sales report every POS can export.'] },
      { h: 'The Columns', p: ['Bar Cop needs three things: the Product Name (required), the Quantity Sold, and the Sales Amount. Your headers do not need to match exactly. Common names like item, qty, units, net sales, and revenue are recognized for you.'] },
      { h: 'The Mapping', p: ['After you drop the file, Bar Cop shows the columns it found and auto-matches them to Name, Quantity, and Sales. Fix any that are wrong, then import. It remembers your layout, so next month is one drop and done.'] },
      { h: 'Names That Do Not Match', p: ['Any POS row that does not line up with a product or menu item shows under Unmatched. Map each one once and Bar Cop remembers it for every future upload. Menu items like cocktails and plates explode through their recipe, so each ingredient gets its share of the variance.'] },
      { h: 'Products Sold In More Than One Size', p: ['If a product sells in more than one size, a pint and a pitcher, a glass and a bottle, each size you set up on the product shows as its own choice in the Unmatched list. Map the pitcher line to the pitcher size and it draws the right ounces and counts the right revenue. A product sold across sizes shows its true blended pour cost on Sales Variance, and its single-price columns read "mixed sizes" because one standard price no longer applies.'] }
    ]);
  },

  showHowTo() {
    App.showHelpModal('How the Variance Report Works', [
      { p: ['Variance is the leak detector. It takes what your counts say you used and compares it to what your POS actually sold. The gap is product that left the bar without a matching sale: over-pour, theft, give-aways, or a count error.'] },
      { h: 'Import Your POS Sales', p: ['Pick the count period up top, then upload a product sales report from your POS. Map the product name, quantity, and sales columns once and Bar Cop matches each row to your products and menu items.'] },
      { h: 'Pick A Category', p: ['Use the Category picker to read one category at a time, or leave it on All Categories to see every category stacked. Each category reads in the unit you actually think in, so you are never staring at ounces of beer or ounces of lime juice.'] },
      { h: 'Comps And Waste Come Out First', p: ['Bar Cop subtracts logged comps and waste from your used number before comparing to sales, because those are known non-revenue losses. What is left is the amount that should match POS. So variance is unexplained loss, not legit give-aways you already tracked.'] },
      { h: 'Two Views', p: ['Sales Variance is in dollars: what the product you poured should have rung up versus what the register actually rang. Usage Variance reads in each category\'s own unit. Liquor and wine show ounces, pours made, and bottles used. Draft shows ounces and kegs. Bottle beer matches bottle for bottle, in bottles and cases. Mixers like lime juice and simple syrup read in quarts. Food reads per ingredient in its own unit, pounds, each, or dozen: what the dishes that sold should have drawn versus what the count says left. Cocktails and plates explode through their recipe so each ingredient gets its share.'] },
      { h: 'Variance Standards (You Set These)', p: [
        'Each category gets one number: the variance you will accept before it flags to investigate. Below the line is OK, above it flags. Set your own in the Variance Standards box up top. Starting points:',
        'Liquor: flag over 2%.',
        'Wine by the glass: flag over 3%.',
        'Draft: flag over 10%.',
        'Misc mixers: flag over 10%.',
        'Food: flag over 5%.',
        'By the Bottle, which covers bottle beer, wine by the bottle, and champagne splits: flag the moment a single bottle is unaccounted. It is bottle-in, bottle-out, so there is no pour variance to forgive.' ] },
      { h: 'Reading The Status', p: ['OK means the gap is within your standard for that category. Flag means it is over, so that is where your money is walking out: start there. You control every standard in the Variance Standards box.'] }
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

  // Remembered POS-name -> target map, persisted so a mapping done once applies
  // to every future upload (next month is one drop and done). Keyed by the
  // lowercased POS product name.
  savedPosMap() {
    return (App.inventoryData && App.inventoryData.variance_pos_map) || {};
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  // ── Usage for the selected period ─────────────────────────────────────────
  currentPeriod() {
    const asc = this.countsAsc();
    if (asc.length < 2) return null;
    let i = asc.findIndex(c => c.id === this.endCountId);
    if (i < 1) i = asc.length - 1;
    return { startC: asc[i - 1], endC: asc[i] };
  },

  // Sum comp units + waste units per product across the count period.
  // Voids are intentionally NOT subtracted (assumed pre-pour). Waste covers
  // every spill / dump / break logged on sc-waste. Both deductions come out
  // of the "used" number before it gets compared to POS sold, so legit
  // non-revenue product loss does not show up as theft variance.
  // Draft beer waste is stored in oz on sc_waste (because partial keg loss
  // is the realistic case); convert to kegs by dividing container_size_oz.
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
      // Comps are logged in serving units (a comped beer is one bottle); convert
      // bottle beer to cases so the subtraction unit-matches "used" (cases).
      const p = this.productById(v.product_id) || {};
      const units = parseFloat(v.units) || 0;
      entry.comp_units += (p.category === 'Bottle Beer' && p.case_size) ? units / p.case_size : units;
    });
    this.waste().forEach(w => {
      if (!w.product_id || w.units == null) return;
      if (w.date <= startDate || w.date > endDate) return;
      const entry = bump(w.product_id, w.units);
      // Convert waste into the product's container unit so it matches "used":
      // draft waste comes in oz -> kegs; bottle beer waste comes in bottles ->
      // cases; everything else is already in its container unit.
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
    // Base usage (container units) from the shared helper; Variance then subtracts
    // known comps + waste (already converted to the product's container unit in
    // adjustmentsMap) so "Adjusted Used" is the amount that should match POS.
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
        compUnits: a.comp_units || 0,
        wasteUnits: a.waste_units || 0,
        used,
        poursMade:  b.servingsPerUnit != null ? used * b.servingsPerUnit : null,
        ouncesUsed: b.ozPerUnit != null ? used * b.ozPerUnit : null,
        usageCost:  b.unitCost != null ? used * b.unitCost : null
      };
    });
    return map;
  },

  // ── POS matching ──────────────────────────────────────────────────────────
  // Phase 7: extended to recognize menu items as well as products. When a
  // POS row matches a menu item (or is manually mapped to one), the menu
  // item is exploded through its recipe / linked product so each ingredient
  // contributes its share of ounces to the right product.
  //
  // Output per product: { ouncesSold, qty, sales, directSales, fromMenu }
  //   ouncesSold = sum of all oz attributed to this product across rows
  //   qty        = sum of POS qty for DIRECT product matches (legacy field)
  //   sales      = total sales attributed (direct only; menu item shares
  //                aren't split across ingredients — see note in tabSales)
  //   fromMenu   = true if any of the oz came from a menu item explosion
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
      // Resolve target: direct product, then menu item, then manual map.
      let p  = productByName[key];
      let mi = menuItemByName[key];
      const mapped = (!p && !mi) ? this.manualMap[key] : null;
      // Serving-size mapping "sv|<productId>|<ozPerUnit>": this POS line is one of
      // the product's other sizes (a pitcher, a bottle). Draw that many oz per
      // sold unit and add its revenue, then mark the product mixedSizes so the
      // Sales tab won't compare a multi-price product against one standard price.
      if (mapped && String(mapped).indexOf('sv|') === 0) {
        const parts = String(mapped).split('|');   // ['sv', productId, ozPerUnit]
        const svPid = parts[1], svOz = parseFloat(parts[2]) || 0;
        if (svPid && svOz) {
          addProduct(svPid, svOz * (parseFloat(pr.qty) || 0), 0, pr.sales, false);
          result[svPid].mixedSizes = true;
        }
        return;
      }
      if (mapped) { p = this.productById(mapped); if (!p) mi = this.menuItemById(mapped); }
      if (p) {
        // Direct product match — qty × oz per sold unit. A beer sold by the bottle
        // has no pour_size_oz, so fall back to the bottle's container_size_oz.
        const ozPer = parseFloat(p.pour_size_oz) || (App.isCaseBeer(p) ? (parseFloat(p.container_size_oz) || 0) : 0);
        const oz = (parseFloat(pr.qty) || 0) * ozPer;
        addProduct(p.id, oz, pr.qty, pr.sales, false);
      } else if (mi) {
        // Menu item match — explode into per-product oz
        const explosion = App.explodeMenuItem ? App.explodeMenuItem(mi, pr.qty) : {};
        Object.keys(explosion).forEach(pid => {
          addProduct(pid, explosion[pid], 0, 0, true);
        });
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


  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const asc = this.countsAsc();
    if (asc.length < 2) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Not enough counts yet</div>'
        + '<div class="empty-sub">Variance compares usage between two counts against POS sales. '
        + 'Submit at least two inventory counts first.</div>'
        + '<button class="btn btn-primary" id="vr-take">Take Inventory</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#vr-take')) App.navigate('ic-take-inventory'); };
      return;
    }

    const period = this.currentPeriod();
    const periodOpts = asc.slice(1).map((c, i) =>
      '<option value="' + c.id + '"' + (c.id === period.endC.id ? ' selected' : '') + '>'
      + this.fmtDate(asc[i].date) + ' &rarr; ' + this.fmtDate(c.date) + '</option>').reverse().join('');

    let catCtl = '';
    if (this.posRows) {
      const avail = this.availableCats();
      if (avail.length) {
        const catOpts = '<option value="">All Categories</option>'
          + avail.map(c => '<option value="' + esc(c) + '"' + (this.catFilter === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
        catCtl = '<div class="f" style="width:200px;"><label>Category</label><select id="vr-cat">' + catOpts + '</select></div>';
      }
    }
    const controls = '<div class="card no-print"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Variance Report</span>'
      + '<button class="btn btn-ghost btn-sm" id="vr-how">How This Works</button></div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;flex-wrap:wrap;"><div class="f" style="width:260px;">'
      + '<label>Count Period</label><select id="vr-period">' + periodOpts + '</select></div>' + catCtl + '</div></div>';

    let body;
    if (!this.posRows) {
      body = '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
        + '<span>Import POS Sales</span>'
        + '<button class="btn btn-ghost btn-sm" id="vr-import-how">How This Works</button></div>'
        + '<div id="vr-import"></div></div>';
    } else {
      body = this.matchSummary() + this.unmatchedCard()
        + App.reportTabBar(this.TABS, this.tab)
        + App.reportPanel(this.TABS, this.tab, 'vr-export', this.tab === 'usage' ? this.tabUsage() : this.tabSales());
    }

    this.container.innerHTML = '<div class="screen">' + controls + this.varianceStandardsCard() + body + '</div>';

    document.getElementById('vr-how')?.addEventListener('click', () => this.showHowTo());
    document.getElementById('vr-period')?.addEventListener('change', e => { this.endCountId = e.target.value; this.draw(); });
    document.getElementById('vr-cat')?.addEventListener('change', e => { this.catFilter = e.target.value; this.draw(); });
    this.wireStandards();

    if (!this.posRows) {
      document.getElementById('vr-import-how')?.addEventListener('click', () => this.showImportHelp());
      CSVMapper.mount(document.getElementById('vr-import'), {
        confirmLabel: 'Import POS Sales',
        fields: [
          { key: 'name',  label: 'Product Name',   required: true,  match: ['product','item','name','description','menu item'] },
          { key: 'qty',   label: 'Quantity Sold',  required: false, match: ['qty','quantity','sold','units','count'] },
          { key: 'sales', label: 'Sales Amount',   required: false, match: ['sales','amount','revenue','net sales','total'] }
        ],
        onComplete: rows => {
          this.posRows = rows.map(r => ({
            name: String(r.name || '').trim(),
            qty: parseFloat(String(r.qty || '').replace(/[^0-9.]/g, '')) || 0,
            sales: parseFloat(String(r.sales || '').replace(/[^0-9.-]/g, '')) || 0
          })).filter(r => r.name);
          // Start from any remembered mappings so prior choices apply on the spot.
          this.manualMap = { ...this.savedPosMap() };
          this.draw();
        }
      });
    } else {
      this.wireBody();
    }
  },

  matchSummary() {
    const unmatched = this.unmatchedPos().length;
    const recognized = this.posRows.length - unmatched;
    const savedCount = Object.keys(this.savedPosMap()).length;
    const clearBtn = savedCount
      ? '<button class="btn btn-ghost btn-sm" id="vr-clearmap">Clear saved mappings</button>' : '';
    return '<div class="alert-bar no-print" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<div class="alert-text">' + this.posRows.length + ' rows imported &middot; '
      + recognized + ' recognized' + (unmatched ? ' &middot; ' + unmatched + ' unmatched' : '')
      + (savedCount ? ' &middot; ' + savedCount + ' remembered' : '')
      + '. Cocktails and plates break into their recipe ingredients below.</div>'
      + '<div style="display:flex;gap:8px;flex-shrink:0;">' + clearBtn
      + '<button class="btn btn-ghost btn-sm" id="vr-reimport">Re-import</button></div></div>';
  },

  unmatchedCard() {
    const un = this.unmatchedPos();
    if (!un.length) return '';
    const sortedProds = this.allProducts().slice().sort((a, b) => a.name.localeCompare(b.name));
    const sortedMenu  = this.menuItems().slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    let opts = '<option value="">Skip: not a tracked item</option>';
    if (sortedMenu.length) {
      opts += '<optgroup label="Menu Items">';
      sortedMenu.forEach(m => { opts += '<option value="' + m.id + '">' + esc(m.name) + '</option>'; });
      opts += '</optgroup>';
    }
    // Other sizes: any product with serving_sizes gets one target per size so a
    // POS line like "Live Oak Pitcher" maps to that size (draws its ounces, adds
    // its revenue). The plain product option below is the product's standard pour.
    const sizeTargets = sortedProds.filter(p => Array.isArray(p.serving_sizes) && p.serving_sizes.length);
    if (sizeTargets.length) {
      opts += '<optgroup label="Product Sizes">';
      sizeTargets.forEach(p => {
        p.serving_sizes.forEach(s => {
          const oz = parseFloat(s.size_oz) || 0;
          if (!oz) return;
          const lbl = (s.label ? s.label + ' ' : '') + '(' + (oz % 1 === 0 ? oz : oz.toFixed(1)) + ' oz)';
          opts += '<option value="sv|' + p.id + '|' + oz + '">' + esc(p.name + ' — ' + lbl) + '</option>';
        });
      });
      opts += '</optgroup>';
    }
    if (sortedProds.length) {
      opts += '<optgroup label="Inventory Products">';
      sortedProds.forEach(p => { opts += '<option value="' + p.id + '">' + esc(p.name) + '</option>'; });
      opts += '</optgroup>';
    }
    const rows = un.map(pr => '<div class="form-row" style="gap:12px;align-items:center;margin-bottom:8px;">'
      + '<div style="width:240px;font-size:13px;color:var(--t1);font-weight:600;flex-shrink:0;">' + esc(pr.name) + '</div>'
      + '<div class="f" style="width:260px;"><select class="vr-map" data-pos="' + esc(pr.name.toLowerCase().trim()) + '">'
      + opts + '</select></div></div>').join('');
    return '<div class="card no-print"><div class="card-title">Unmatched POS Products ' + tt('vr-unmatched') + '</div>'
      + rows + '</div>';
  },

  wireBody() {
    document.getElementById('vr-reimport')?.addEventListener('click', () => { this.posRows = null; this.manualMap = { ...this.savedPosMap() }; this.draw(); });
    document.getElementById('vr-export')?.addEventListener('click', () => window.print());
    document.getElementById('vr-clearmap')?.addEventListener('click', async () => {
      if (App.inventoryData) App.inventoryData.variance_pos_map = {};
      this.manualMap = {};
      await App.saveInventory();
      this.draw();
    });
    this.container.querySelectorAll('.vr-map').forEach(sel =>
      sel.addEventListener('change', async e => {
        const pos = e.target.dataset.pos;
        if (!App.inventoryData) App.inventoryData = {};
        if (!App.inventoryData.variance_pos_map) App.inventoryData.variance_pos_map = {};
        if (e.target.value) { this.manualMap[pos] = e.target.value; App.inventoryData.variance_pos_map[pos] = e.target.value; }
        else { delete this.manualMap[pos]; delete App.inventoryData.variance_pos_map[pos]; }
        await App.saveInventory();
        this.draw();
      }));
    this.container.querySelectorAll('.rpt-tab').forEach(btn =>
      btn.addEventListener('click', () => { this.tab = btn.dataset.tab; this.draw(); }));
  },

  wireStandards() {
    this.container.querySelectorAll('.vr-th').forEach(inp =>
      inp.addEventListener('change', async e => {
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

  // ── Status ────────────────────────────────────────────────────────────────
  // Binary: OK below the standard, Flag above it. `key` is the standard key
  // (category, or "By the Bottle"). For By the Bottle, `unitVar` is the absolute
  // bottles off; otherwise `pct` is the variance percent.
  status(key, pct, unitVar) {
    const t = this.thresholds()[key] || { flag: 10 };
    if (t.bottles != null) {
      const off = Math.abs(unitVar || 0);
      const lim = parseFloat(t.bottles) || 1;
      // Tiny epsilon so a float-rounding 0.000x never false-flags a clean count.
      return off >= lim - 1e-6
        ? { label: 'Flag', color: 'var(--red)' }
        : { label: 'OK', color: 'var(--gold)' };
    }
    return Math.abs(pct || 0) > (parseFloat(t.flag) || 0)
      ? { label: 'Flag', color: 'var(--red)' }
      : { label: 'OK', color: 'var(--gold)' };
  },
  badge(key, pct, unitVar) {
    const s = this.status(key, pct, unitVar);
    return '<span style="font-weight:700;color:' + s.color + ';">' + s.label + '</span>';
  },
  cur(v) { return v == null ? '<span style="color:var(--t4);">-</span>' : App.fmtCurrency(v); },
  pct(v) { return v == null ? '<span style="color:var(--t4);">-</span>' : v.toFixed(1) + '%'; },

  // ── Variance Standards (operator-tunable, one number per category) ─────────
  // Built like the Dynamic Pars settings row: a box per category, one number,
  // tooltip by each label, no explainer text (it all lives in How This Works and
  // the tooltips). Below the number is OK, above it flags. Edits persist to
  // inventoryData and drive the Status on both views.
  thNum(v) { return (v == null || isNaN(v)) ? '' : String(+v); },
  varianceStandardsCard() {
    const t = this.thresholds();
    const box = key => {
      const isBottle = t[key].bottles != null;
      const field = isBottle ? 'bottles' : 'flag';
      const suffix = isBottle ? 'btl' : '%';
      const step = isBottle ? '1' : '0.5';
      return '<div class="f" style="width:' + (isBottle ? 150 : 120) + 'px;flex-shrink:0;">'
        + '<label>' + esc(key) + ' ' + tt(this.TT_BY_CAT[key]) + '</label>'
        + '<div class="fw"><input class="suf vr-th" type="number" data-cat="' + esc(key) + '" data-key="' + field
        + '" min="0" step="' + step + '" value="' + this.thNum(t[key][field]) + '"/><span class="suf">' + suffix + '</span></div></div>';
    };
    return '<div class="card no-print"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Variance Standards</span>'
      + '<button class="btn btn-ghost btn-sm" id="vr-th-reset">Reset to Defaults</button></div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
      + this.STD_ORDER.map(k => box(k)).join('') + '</div></div>';
  },

  // ── Sales Variance ────────────────────────────────────────────────────────
  // Note: per-product sales attribution is only honest for direct-pour items
  // (bottle beer, draft pours, wine glasses). For cocktail/food ingredients
  // that flow through menu items, the register sale belongs to the menu item,
  // not the ingredient product. Those rows show "via menu" — Sales Variance
  // is null because the dollar attribution can't be reliably split.
  // Direct-pour products only (beer, wine, liquor sold by the glass or bottle).
  // A cocktail's or plate's register sale belongs to the menu item, not to an
  // ounce of an ingredient, so those rows can't show a real dollar variance —
  // they live in Usage Variance (ounces) instead. Keeping them out keeps this
  // view a clean dollar leak report.
  tabSales() {
    const usage = this.usageMap();
    const pos = this.posByProduct();
    const rows = Object.keys(usage).filter(pid => pos[pid]).map(pid => {
      const u = usage[pid], pr = pos[pid], p = u.product;
      const viaMenu = pr.fromMenu && pr.sales === 0;
      const registerSales = pr.sales;
      const theoSales = u.poursMade != null && p.menu_price ? u.poursMade * p.menu_price : null;
      const salesVar = theoSales != null ? theoSales - registerSales : null;
      const varPct = theoSales ? salesVar / theoSales * 100 : null;
      const actualCostPct = (registerSales && u.usageCost != null) ? u.usageCost / registerSales * 100 : null;
      const actualProfit = (u.usageCost != null) ? registerSales - u.usageCost : null;
      // Anything sold by the bottle flags on the unit count, not the dollar
      // percent, so carry the bottle variance for the status badge.
      const byBottle = this.isByBottle(p);
      const bottlesSold = byBottle && p.container_size_oz ? (pr.ouncesSold || 0) / p.container_size_oz : (pr.qty || 0);
      const unitVar = (byBottle && u.poursMade != null) ? u.poursMade - bottlesSold : null;
      // A product sold at more than one size/price (a draft sold as pints AND
      // pitchers) can't be measured against a single standard price, so the theo
      // and sales-variance columns are blanked. The blended Actual Cost % and
      // Actual Profit below stay honest because they use the real register total.
      return { name: u.name, category: p.category, key: this.stdKey(p), viaMenu, mixedSizes: pr.mixedSizes,
        registerSales, theoSales, salesVar, varPct, actualCostPct, actualProfit, unitVar };
    }).filter(r => !r.viaMenu && (!this.catFilter || r.category === this.catFilter));
    if (!rows.length) {
      return '<div style="font-size:12px;color:var(--t3);padding:20px 0;text-align:center;">'
        + 'No direct-pour products matched your POS for this period. Beer, wine, and liquor sold by the glass or bottle show here. Cocktails and plates are in Usage Variance.</div>';
    }
    const dash = '<span style="color:var(--t4);">-</span>';
    const mixedNote = '<span style="color:var(--t4);font-size:11px;">mixed sizes</span>';
    const body = rows.map(r => '<tr>'
      + '<td><div class="val">' + esc(r.name) + '</div></td>'
      + '<td>' + this.cur(r.registerSales) + '</td>'
      + '<td>' + (r.mixedSizes ? mixedNote : this.cur(r.theoSales)) + '</td>'
      + '<td>' + (r.mixedSizes ? dash : this.cur(r.salesVar)) + '</td>'
      + '<td>' + (r.mixedSizes ? dash : this.pct(r.varPct)) + '</td>'
      + '<td>' + this.pct(r.actualCostPct) + '</td>'
      + '<td class="' + (r.actualProfit != null ? (r.actualProfit >= 0 ? 'pos' : 'neg') : '') + '">' + this.cur(r.actualProfit) + '</td>'
      + '<td>' + (r.mixedSizes ? dash : ((r.varPct != null || r.unitVar != null) ? this.badge(r.key, r.varPct, r.unitVar) : '-')) + '</td>'
      + '</tr>').join('');
    return '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Register Sales</th><th>Theo Sales</th><th>Sales Variance</th>'
      + '<th>Variance %</th><th>Actual Cost %</th><th>Actual Profit</th><th>Status</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  // ── Usage Variance (category-aware) ─────────────────────────────────────────
  // Each category reads in its own unit (see CAT_ORDER note up top). What your
  // counts say you used (after comps and waste come out) versus what the POS
  // sold, and the gap. FROM RECIPE rows are cocktail/plate ingredients exploded
  // through the recipe. The Category picker focuses one category; All stacks
  // every category, each in its own unit.

  // Categories that actually have both usage and a matched POS row, in the
  // canonical display order. Drives the Category dropdown options.
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

  // Raw per-product variance numbers for one bar category. Every unit conversion
  // is resolved here off the shared engine output (containers + ouncesUsed +
  // poursMade from usageMap, ouncesSold from posByProduct); the category
  // renderers below only lay out columns.
  usageVarRows(cat) {
    const usage = this.usageMap();
    const pos = this.posByProduct();
    const rows = [];
    Object.keys(usage).forEach(pid => {
      if (!pos[pid]) return;
      const u = usage[pid], pr = pos[pid], p = u.product || {};
      if (p.category !== cat) return;
      rows.push({
        name: u.name, fromMenu: pr.fromMenu,
        // ouncesUsed/ouncesSold are ounces for bar categories. For Misc the
        // explosion and the count are both in the native purchase unit (quarts),
        // so ouncesSold carries qt-poured and containersUsed carries qt-counted.
        ouncesUsed: u.ouncesUsed, ouncesSold: pr.ouncesSold || 0,
        poursMade: u.poursMade, containersUsed: u.used,   // bottles / kegs / cases / qt
        containerSizeOz: parseFloat(p.container_size_oz) || 0,
        caseSize: parseFloat(p.case_size) || 0,
        byBottle: this.isByBottle(p)
      });
    });
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },

  n(v, d) { return (v == null || isNaN(v)) ? '<span style="color:var(--t4);">-</span>' : Number(v).toFixed(d == null ? 1 : d); },
  recipeTag(r) { return r.fromMenu ? ' <span style="font-size:9px;color:var(--gold);font-weight:700;letter-spacing:1px;">FROM RECIPE</span>' : ''; },
  // Shared table shell. Every category table is laid out on the SAME fixed
  // grid so the columns line up vertically section to section as you scroll:
  // the name column and the trailing three (variance value, variance %, status)
  // are fixed widths; the in-between metric columns share whatever is left. The
  // last three headers of every table are always [a variance value, Variance %,
  // Status], so this aligns them across Liquor, Wine, Draft, Beer, Misc, Food.
  usageTbl(headers, body) {
    const n = headers.length;
    const cols = headers.map((h, i) => {
      if (i === 0)     return '<col style="width:200px;"/>';  // product / ingredient / mixer
      if (i === n - 3) return '<col style="width:92px;"/>';   // variance value
      if (i === n - 2) return '<col style="width:78px;"/>';   // variance %
      if (i === n - 1) return '<col style="width:62px;"/>';   // status
      return '<col/>';                                        // metric columns share the rest
    }).join('');
    return '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl" style="table-layout:fixed;width:100%;min-width:560px;">'
      + '<colgroup>' + cols + '</colgroup><thead><tr>'
      + headers.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  // Liquor + Wine: ounces, with pours made and bottles used alongside.
  usageTableLiquorWine(cat, rows) {
    const body = rows.map(r => {
      const ounceVar = r.ouncesUsed != null ? r.ouncesUsed - r.ouncesSold : null;
      const varPct = (ounceVar != null && r.ouncesUsed) ? ounceVar / r.ouncesUsed * 100 : null;
      return '<tr>'
        + '<td><div class="val">' + esc(r.name) + this.recipeTag(r) + '</div></td>'
        + '<td>' + this.n(r.ouncesSold) + '</td>'
        + '<td>' + this.n(r.ouncesUsed) + '</td>'
        + '<td>' + this.n(r.poursMade, 0) + '</td>'
        + '<td>' + this.n(r.containersUsed) + '</td>'
        + '<td>' + this.n(ounceVar) + '</td>'
        + '<td>' + this.pct(varPct) + '</td>'
        + '<td>' + (varPct != null ? this.badge(cat, varPct) : '-') + '</td>'
        + '</tr>';
    }).join('');
    return this.usageTbl(['Product', 'Oz Sold', 'Oz Used', 'Pours', 'Btls Used', 'Oz Var', 'Var %', 'Status'], body);
  },

  // Wine sold by the bottle (and champagne splits): counted bottle-in /
  // bottle-out, so it reads in whole bottles, not ounces, like bottle beer.
  // Detected when a wine's pour size is the whole bottle (see isByBottle).
  usageTableBottleWine(rows) {
    const body = rows.map(r => {
      const bottlesSold = r.containerSizeOz ? r.ouncesSold / r.containerSizeOz : 0;
      const bottlesUsed = r.containersUsed;   // wine is counted in bottles
      const bottleVar = bottlesUsed != null ? bottlesUsed - bottlesSold : null;
      const varPct = (bottleVar != null && bottlesUsed) ? bottleVar / bottlesUsed * 100 : null;
      return '<tr>'
        + '<td><div class="val">' + esc(r.name) + this.recipeTag(r) + '</div></td>'
        + '<td>' + this.n(bottlesSold, 0) + '</td>'
        + '<td>' + this.n(bottlesUsed, 0) + '</td>'
        + '<td>' + this.n(bottleVar, 0) + '</td>'
        + '<td>' + this.pct(varPct) + '</td>'
        + '<td>' + (bottlesUsed != null ? this.badge('By the Bottle', varPct, bottleVar) : '-') + '</td>'
        + '</tr>';
    }).join('');
    return this.usageTbl(['Product', 'Btls Sold', 'Btls Used', 'Btl Var', 'Var %', 'Status'], body);
  },

  // Draft Beer: ounces poured, kegs used.
  usageTableDraft(rows) {
    const body = rows.map(r => {
      const ounceVar = r.ouncesUsed != null ? r.ouncesUsed - r.ouncesSold : null;
      const varPct = (ounceVar != null && r.ouncesUsed) ? ounceVar / r.ouncesUsed * 100 : null;
      return '<tr>'
        + '<td><div class="val">' + esc(r.name) + this.recipeTag(r) + '</div></td>'
        + '<td>' + this.n(r.ouncesSold) + '</td>'
        + '<td>' + this.n(r.ouncesUsed) + '</td>'
        + '<td>' + this.n(r.containersUsed, 2) + '</td>'
        + '<td>' + this.n(ounceVar) + '</td>'
        + '<td>' + this.pct(varPct) + '</td>'
        + '<td>' + (varPct != null ? this.badge('Draft Beer', varPct) : '-') + '</td>'
        + '</tr>';
    }).join('');
    return this.usageTbl(['Product', 'Oz Sold', 'Oz Used', 'Kegs', 'Oz Var', 'Var %', 'Status'], body);
  },

  // Bottle Beer: bottle-to-bottle, no ounces. The recipe explosion is needless
  // for beer; it matches the POS bottle count directly. Cases shown alongside.
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
        + '<td>' + this.n(bottlesSold, 0) + '</td>'
        + '<td>' + this.n(bottlesUsed, 0) + '</td>'
        + '<td>' + this.n(casesUsed) + '</td>'
        + '<td>' + this.n(caseVar) + '</td>'
        + '<td>' + this.n(bottleVar, 0) + '</td>'
        + '<td>' + this.pct(varPct) + '</td>'
        + '<td>' + (bottlesUsed != null ? this.badge('By the Bottle', varPct, bottleVar) : '-') + '</td>'
        + '</tr>';
    }).join('');
    return this.usageTbl(['Product', 'Btls Sold', 'Btls Used', 'Cases', 'Case Var', 'Btl Var', 'Var %', 'Status'], body);
  },

  // Misc mixers: bought and counted by the quart, so variance reads in quarts.
  // Recipe Qt is what the cocktails that sold should have drawn; Counted Qt is
  // what the count says actually left. No ounces — a mixer is not poured by the
  // ounce on a count sheet. Every row is recipe-derived, so the column header
  // already says "Recipe"; no FROM RECIPE tag needed.
  usageTableMisc(rows) {
    const body = rows.map(r => {
      const recipeQt = r.ouncesSold || 0;   // native qt from the recipe explosion
      const countedQt = r.containersUsed;    // native qt from the count
      const qtVar = countedQt != null ? countedQt - recipeQt : null;
      const varPct = (qtVar != null && countedQt) ? qtVar / countedQt * 100 : null;
      return '<tr>'
        + '<td><div class="val">' + esc(r.name) + '</div></td>'
        + '<td>' + this.n(recipeQt, 2) + '</td>'
        + '<td>' + this.n(countedQt, 2) + '</td>'
        + '<td>' + this.n(qtVar, 2) + '</td>'
        + '<td>' + this.pct(varPct) + '</td>'
        + '<td>' + (varPct != null ? this.badge('Misc', varPct) : '-') + '</td>'
        + '</tr>';
    }).join('');
    return this.usageTbl(['Mixer', 'Recipe Qt', 'Counted Qt', 'Qt Var', 'Var %', 'Status'], body);
  },

  // Food: each ingredient in its own purchase unit. One ingredient spans many
  // dishes, so Recipe Use sums the draw across every dish that sold (Ground Beef
  // is pulled by the burger, the nachos, the brunch burger). Counted Use is what
  // the count says left. The unit (lb / each / dozen / case / bag) comes off the
  // product name so a number is never ambiguous. No ounces — food is weighed and
  // counted in its own unit, never poured.
  foodUnit(name) { const m = /\(([^)]+)\)\s*$/.exec(name || ''); return m ? m[1].trim() : 'unit'; },
  foodName(name) { return String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim(); },
  usageTableFood(rows) {
    const body = rows.map(r => {
      const recipeUse = r.ouncesSold || 0;   // native units from the recipe explosion
      const countedUse = r.containersUsed;    // native units from the count
      const useVar = countedUse != null ? countedUse - recipeUse : null;
      const varPct = (useVar != null && countedUse) ? useVar / countedUse * 100 : null;
      return '<tr>'
        + '<td><div class="val">' + esc(this.foodName(r.name)) + '</div></td>'
        + '<td>' + esc(this.foodUnit(r.name)) + '</td>'
        + '<td>' + this.n(recipeUse, 2) + '</td>'
        + '<td>' + this.n(countedUse, 2) + '</td>'
        + '<td>' + this.n(useVar, 2) + '</td>'
        + '<td>' + this.pct(varPct) + '</td>'
        + '<td>' + (varPct != null ? this.badge('Food', varPct) : '-') + '</td>'
        + '</tr>';
    }).join('');
    return this.usageTbl(['Ingredient', 'Unit', 'Recipe Use', 'Counted Use', 'Use Var', 'Var %', 'Status'], body);
  },

  renderUsageCat(cat, rows) {
    if (cat === 'Bottle Beer') return this.usageTableBottleBeer(rows);
    if (cat === 'Draft Beer')  return this.usageTableDraft(rows);
    if (cat === 'Misc')        return this.usageTableMisc(rows);
    if (cat === 'Food')        return this.usageTableFood(rows);
    if (cat === 'Wine') {
      // Split wine into by-the-glass (ounces) and by-the-bottle (whole bottles).
      const glass  = rows.filter(r => !r.byBottle);
      const bottle = rows.filter(r => r.byBottle);
      let out = glass.length ? this.usageTableLiquorWine('Wine', glass) : '';
      if (bottle.length) {
        out += '<div style="font-weight:700;color:var(--t3);font-size:10px;letter-spacing:1.5px;margin:'
          + (glass.length ? '16px' : '2px') + ' 0 8px;">BY THE BOTTLE</div>'
          + this.usageTableBottleWine(bottle);
      }
      return out;
    }
    return this.usageTableLiquorWine(cat, rows); // Liquor
  },

  tabUsage() {
    const avail = this.availableCats();
    if (!avail.length) return this.emptyMatch();
    const cats = (this.catFilter && avail.includes(this.catFilter)) ? [this.catFilter] : avail;
    const out = cats.map((cat, i) => {
      const rows = this.usageVarRows(cat);
      if (!rows.length) return '';
      const heading = cats.length > 1
        ? '<div style="font-weight:700;color:var(--gold);font-size:11px;letter-spacing:1.5px;margin:' + (i ? '24px' : '2px') + ' 0 10px;">' + esc(cat.toUpperCase()) + '</div>'
        : '';
      return heading + this.renderUsageCat(cat, rows);
    }).join('');
    return out || this.emptyMatch();
  },

  emptyMatch() {
    return '<div style="font-size:12px;color:var(--t3);padding:20px 0;text-align:center;">'
      + 'No products have both usage data for this period and a matched POS sales row. '
      + 'Check the count period and the unmatched-product mapping above.</div>';
  }
};
