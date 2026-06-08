'use strict';

/* ── Inventory Control — Variance Report (ic_counts + ic_deliveries + POS) ────
   Compares what was used (from inventory counts) against what was sold (from a
   POS sales CSV). Two views: Sales Variance (dollars) and Usage Variance, which
   reads in each category's natural unit (liquor/wine in ounces + pours +
   bottles, draft in ounces + kegs, bottle beer bottle-to-bottle in bottles +
   cases, mixers in quarts, food per ingredient in its own purchase unit). A
   Category picker focuses one category or stacks them all. POS sales are
   imported with the reusable CSVMapper; the import stays in memory for the
   session.

   Tabbed shell mirrors Labor Tip History: a .ch-tabs switcher over a stats
   card, a Filter heading with Export, the controls-only filter card, then the
   data card(s). Standards + unmatched mapping live below the report. */

S.InventoryVarianceReport = {
  tab: 'sales',
  endCountId: null,
  catFilter: '',        // '' = all categories, else one of CAT_ORDER
  posRows: null,        // [{name, qty, sales}]
  manualMap: {},        // { posName(lowercased): productId }

  TABS: [['sales', 'Sales Variance'], ['usage', 'Usage Variance']],

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

  showHowTo() {
    App.showHelpModal('How the Variance Report Works', [
      { p: ['Variance is the leak detector. It takes what your counts say you used and compares it to what your POS actually sold. The gap is product that left the bar without a matching sale: over-pour, theft, give-aways, or a count error.'] },
      { h: 'Import Your POS Sales', p: ['Pick the count period up top, then upload a product sales report from your POS. Toast, Square, Aloha, Lightspeed, or any system that exports a spreadsheet works. A CSV or Excel file (.csv, .xlsx, .xls) with one product per row and a header row. Bar Cop needs the product name, the quantity sold, and the sales amount; common header names are auto-matched and it remembers your layout, so next month is one drop and done.'] },
      { h: 'Map Anything Unmatched', p: ['Any POS row that does not line up with a product or menu item shows under Unmatched. Map each one once and Bar Cop remembers it for every future upload. Cocktails and plates explode through their recipe so each ingredient gets its share. If a product sells in more than one size, a pint and a pitcher, each size you set up shows as its own choice, so map the pitcher line to the pitcher size and it draws the right ounces and revenue.'] },
      { h: 'Pick A Category', p: ['Use the Category picker to read one category at a time, or leave it on All Categories to see every category stacked. Each category reads in the unit you actually think in, so you are never staring at ounces of beer or ounces of lime juice.'] },
      { h: 'Comps And Waste Come Out First', p: ['Bar Cop subtracts logged comps and waste from your used number before comparing to sales, because those are known non-revenue losses. What is left is the amount that should match POS. So variance is unexplained loss, not legit give-aways you already tracked.'] },
      { h: 'Two Views', p: ['Sales Variance is in dollars: what the product you poured should have rung up versus what the register actually rang. Usage Variance reads in each category\'s own unit. Liquor and wine show ounces, pours made, and bottles used. Draft shows ounces and kegs. Bottle beer matches bottle for bottle, in bottles and cases. Mixers like lime juice and simple syrup read in quarts. Food reads per ingredient in its own unit, pounds, each, or dozen: what the dishes that sold should have drawn versus what the count says left. Cocktails and plates explode through their recipe so each ingredient gets its share.'] },
      { h: 'Variance Standards (You Set These)', p: [
        'Each category gets one number: the variance you will accept before it flags to investigate. Below the line is OK, above it flags. Set your own in the Variance Standards box. Starting points:',
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
        const ozPer = parseFloat(p.pour_size_oz) || (App.isCaseBeer(p) ? (parseFloat(p.container_size_oz) || 0) : 0);
        const oz = (parseFloat(pr.qty) || 0) * ozPer;
        addProduct(p.id, oz, pr.qty, pr.sales, false);
      } else if (mi) {
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

  // ── shared markup helpers (mirror Tip History) ──────────────────────────────
  tabBar() {
    return '<div class="ch-tabs no-print">'
      + this.TABS.map(([k, label]) => '<button class="ch-tab' + (this.tab === k ? ' on' : '') + '" data-tab="' + esc(k) + '">' + esc(label) + '</button>').join('')
      + '</div>';
  },
  statItem(label, val, cls) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
  },
  statsCard(items) {
    return '<div class="card"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">'
      + '<div style="flex:1;display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="vr-export">Export PDF</button></div></div>';
  },
  dataCard(headers, rowsHtml, fixedColgroup) {
    return '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"' + (fixedColgroup ? ' style="table-layout:fixed;width:100%;min-width:560px;"' : '') + '>'
      + (fixedColgroup || '') + '<thead><tr>' + headers + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>';
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    this.draw();
  },

  draw() {
    // The shared screen container is reused across reports; clear any stale
    // delegated handler from another report so its clicks don't bubble onto ours.
    this.container.onclick = null;
    this.container.onchange = null;
    const asc = this.countsAsc();
    if (asc.length < 2) {
      App.setupCard(this.container, {
        title: 'Variance Report',
        lead: 'Variance compares what you used against what your POS rang up, so theft, over-pouring, and waste surface as a dollar gap.',
        steps: [
          { title: 'Take two inventory counts', desc: 'Variance needs usage between two counts to compare against your sales. Submit at least two to get started.', btn: 'Take Inventory', screen: 'ic-take-inventory', done: false }
        ]
      });
      return;
    }

    // Controls + Variance Standards stay at the top, in their original spots —
    // before AND after import (Category only appears once a file is imported).
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
    const controls = '<div class="card form-card no-print"><div class="card-title">Variance Report</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;flex-wrap:wrap;"><div class="f" style="width:260px;">'
      + '<label>Count Period</label><select id="vr-period">' + periodOpts + '</select></div>' + catCtl + '</div></div>';

    let body;
    if (!this.posRows) {
      body = '<div class="card form-card"><div class="card-title">Import POS Sales</div>'
        + '<div id="vr-import"></div></div>';
    } else {
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
      body = statsCard + this.matchSummary() + this.unmatchedCard()
        + this.tabBar()
        + (this.tab === 'usage' ? this.tabUsage() : this.tabSales());
    }

    this.container.innerHTML = '<div class="screen">' + controls + this.varianceStandardsCard() + body + '</div>';

    document.getElementById('vr-period')?.addEventListener('change', e => { this.endCountId = e.target.value; this.draw(); });
    document.getElementById('vr-cat')?.addEventListener('change', e => { this.catFilter = e.target.value; this.draw(); });
    this.wireStandards();

    if (!this.posRows) {
      CSVMapper.mount(document.getElementById('vr-import'), {
        confirmLabel: 'Import POS Sales',
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
    return '<div class="alert-bar no-print" style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<div class="alert-text">' + this.posRows.length + ' rows imported &middot; '
      + recognized + ' recognized' + (unmatched ? ' &middot; ' + unmatched + ' unmatched' : '')
      + (savedCount ? ' &middot; ' + savedCount + ' remembered' : '')
      + '.</div>'
      + '<div style="display:flex;gap:8px;flex-shrink:0;">' + clearBtn
      + '<button class="btn btn-ghost btn-sm" id="vr-reimport">Re-import</button></div></div>';
  },

  // Word tokens for best-match scoring of a POS name against products/menu items.
  _MATCH_STOP: new Set(['the', 'and', 'with', 'of', 'a', 'an', 'oz', 'for', 'to']),
  _tokens(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')
      .filter(t => t.length >= 2 && !this._MATCH_STOP.has(t));
  },
  _bestMatchGroup(posName, cands) {
    const pt = new Set(this._tokens(posName));
    if (!pt.size) return '';
    const scored = cands
      .map(c => ({ c, score: c.tokens.reduce((n, t) => n + (pt.has(t) ? 1 : 0), 0) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    if (!scored.length) return '';
    return '<optgroup label="Best Matches">'
      + scored.map(x => '<option value="' + esc(x.c.value) + '">' + esc(x.c.label) + '</option>').join('')
      + '</optgroup>';
  },

  unmatchedCard() {
    const un = this.unmatchedPos();
    if (!un.length) return '';
    const sortedProds = this.allProducts().slice().sort((a, b) => a.name.localeCompare(b.name));
    const sortedMenu  = this.menuItems().slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const sizeTargets = sortedProds.filter(p => Array.isArray(p.serving_sizes) && p.serving_sizes.length);
    const sizeLabel = (p, s, oz) => p.name + ' — ' + (s.label ? s.label + ' ' : '') + '(' + (oz % 1 === 0 ? oz : oz.toFixed(1)) + ' oz)';

    let full = '';
    if (sortedMenu.length) {
      full += '<optgroup label="Menu Items">'
        + sortedMenu.map(m => '<option value="' + esc(m.id) + '">' + esc(m.name) + '</option>').join('') + '</optgroup>';
    }
    if (sizeTargets.length) {
      full += '<optgroup label="Product Sizes">';
      sizeTargets.forEach(p => p.serving_sizes.forEach(s => {
        const oz = parseFloat(s.size_oz) || 0; if (!oz) return;
        full += '<option value="sv|' + esc(p.id) + '|' + oz + '">' + esc(sizeLabel(p, s, oz)) + '</option>';
      }));
      full += '</optgroup>';
    }
    if (sortedProds.length) {
      full += '<optgroup label="Inventory Products">'
        + sortedProds.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('') + '</optgroup>';
    }

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

    if (this._unmatchedCollapsed == null) this._unmatchedCollapsed = un.length > 6;
    const collapsed = this._unmatchedCollapsed;
    return '<div class="card form-card no-print"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Unmatched POS Products (' + un.length + ')</span>'
      + '<button class="btn btn-ghost btn-sm" id="vr-unmatched-toggle">' + (collapsed ? 'Show' : 'Hide') + '</button></div>'
      + '<div id="vr-unmatched-body" style="' + (collapsed ? 'display:none;' : '') + '">' + rows + '</div></div>';
  },

  wireBody() {
    document.getElementById('vr-reimport')?.addEventListener('click', () => { this.posRows = null; this.manualMap = { ...this.savedPosMap() }; this._unmatchedCollapsed = null; this.draw(); });
    document.getElementById('vr-export')?.addEventListener('click', () => App.exportPDF({ title: 'Variance Report', root: this.container }));
    document.getElementById('vr-unmatched-toggle')?.addEventListener('click', () => {
      this._unmatchedCollapsed = !this._unmatchedCollapsed;
      const body = document.getElementById('vr-unmatched-body');
      const btn = document.getElementById('vr-unmatched-toggle');
      if (body) body.style.display = this._unmatchedCollapsed ? 'none' : '';
      if (btn) btn.textContent = this._unmatchedCollapsed ? 'Show' : 'Hide';
    });
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
    this.container.querySelectorAll('.ch-tab').forEach(btn =>
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
  // Binary: OK below the standard (green), Flag above it (red).
  status(key, pct, unitVar) {
    const t = this.thresholds()[key] || { flag: 10 };
    if (t.bottles != null) {
      const off = Math.abs(unitVar || 0);
      const lim = parseFloat(t.bottles) || 1;
      return off >= lim - 1e-6
        ? { label: 'Flag', color: 'var(--red)' }
        : { label: 'OK', color: 'var(--green)' };
    }
    return Math.abs(pct || 0) > (parseFloat(t.flag) || 0)
      ? { label: 'Flag', color: 'var(--red)' }
      : { label: 'OK', color: 'var(--green)' };
  },
  badge(key, pct, unitVar) {
    const s = this.status(key, pct, unitVar);
    return '<span style="font-weight:700;color:' + s.color + ';">' + s.label + '</span>';
  },
  cur(v) { return v == null ? '<span style="color:var(--t4);">-</span>' : App.fmtCurrency(v); },
  pct(v) { return v == null ? '<span style="color:var(--t4);">-</span>' : v.toFixed(1) + '%'; },

  // ── Variance Standards (operator-tunable, one number per category) ─────────
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
    return '<div class="card form-card no-print"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Variance Standards</span>'
      + '<button class="btn btn-ghost btn-sm" id="vr-th-reset">Reset to Defaults</button></div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
      + this.STD_ORDER.map(k => box(k)).join('') + '</div></div>';
  },

  // ── Sales Variance ────────────────────────────────────────────────────────
  // Direct-pour products only (beer, wine, liquor sold by the glass or bottle).
  // A cocktail's or plate's register sale belongs to the menu item, not to an
  // ounce of an ingredient, so those rows live in Usage Variance instead.
  salesRows() {
    const usage = this.usageMap();
    const pos = this.posByProduct();
    return Object.keys(usage).filter(pid => pos[pid]).map(pid => {
      const u = usage[pid], pr = pos[pid], p = u.product;
      const viaMenu = pr.fromMenu && pr.sales === 0;
      const registerSales = pr.sales;
      const theoSales = u.poursMade != null && p.menu_price ? u.poursMade * p.menu_price : null;
      const salesVar = theoSales != null ? theoSales - registerSales : null;
      const varPct = theoSales ? salesVar / theoSales * 100 : null;
      const actualCostPct = (registerSales && u.usageCost != null) ? u.usageCost / registerSales * 100 : null;
      const actualProfit = (u.usageCost != null) ? registerSales - u.usageCost : null;
      const byBottle = this.isByBottle(p);
      const bottlesSold = byBottle && p.container_size_oz ? (pr.ouncesSold || 0) / p.container_size_oz : (pr.qty || 0);
      const unitVar = (byBottle && u.poursMade != null) ? u.poursMade - bottlesSold : null;
      return { name: u.name, category: p.category, key: this.stdKey(p), viaMenu, mixedSizes: pr.mixedSizes,
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
        name: u.name, fromMenu: pr.fromMenu,
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

  // Shared fixed-grid colgroup so the last three columns line up across every
  // category table. Returns a colgroup string for the data-card table.
  usageColgroup(n) {
    const cols = [];
    for (let i = 0; i < n; i++) {
      if (i === 0)     cols.push('<col style="width:200px;"/>');
      else if (i === n - 3) cols.push('<col style="width:92px;"/>');
      else if (i === n - 2) cols.push('<col style="width:78px;"/>');
      else if (i === n - 1) cols.push('<col style="width:62px;"/>');
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

  usageTableBottleWine(rows) {
    const body = rows.map(r => {
      const bottlesSold = r.containerSizeOz ? r.ouncesSold / r.containerSizeOz : 0;
      const bottlesUsed = r.containersUsed;
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

  usageTableMisc(rows) {
    const body = rows.map(r => {
      const recipeQt = r.ouncesSold || 0;
      const countedQt = r.containersUsed;
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

  foodUnit(name) { const m = /\(([^)]+)\)\s*$/.exec(name || ''); return m ? m[1].trim() : 'unit'; },
  foodName(name) { return String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim(); },
  usageTableFood(rows) {
    const body = rows.map(r => {
      const recipeUse = r.ouncesSold || 0;
      const countedUse = r.containersUsed;
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
    const out = cats.map(cat => {
      const rows = this.usageVarRows(cat);
      if (!rows.length) return '';
      // Each category is a .sh heading above its own data-card so the sections
      // read cleanly when All Categories stacks them.
      const heading = cats.length > 1
        ? '<div class="sh" style="margin:24px 0 10px;">' + esc(cat) + '</div>'
        : '';
      return heading + this.renderUsageCat(cat, rows);
    }).join('');
    return out || this.emptyMatch();
  },

  emptyMatch() {
    return this.dataCard('<th>Usage Variance</th>', '<tr><td style="color:var(--t3);padding:14px 8px;">'
      + 'No products have both usage data for this period and a matched POS sales row. '
      + 'Check the count period and the unmatched-product mapping below.</td></tr>');
  }
};
