'use strict';

/* ── Inventory Control — Variance Report (ic_counts + ic_deliveries + POS) ────
   Compares what was used (from inventory counts) against what was sold (from a
   POS sales CSV). Two views: Sales Variance (dollars) and Usage Variance (oz).
   POS sales are imported with the reusable CSVMapper; the import stays in
   memory for the session. */

S.InventoryVarianceReport = {
  tab: 'sales',
  endCountId: null,
  posRows: null,        // [{name, qty, sales}]
  manualMap: {},        // { posName(lowercased): productId }

  TABS: [['sales','Sales Variance','rpt-v-sales'], ['usage','Usage Variance','rpt-v-usage']],

  showImportHelp() {
    App.showHelpModal('How the POS Import Works', [
      { p: ['Variance compares what you used against what you sold, so it needs your POS sales. Export a product sales report from your POS and drop it on the box. Toast, Square, Aloha, Lightspeed, or any system that exports a spreadsheet works.'] },
      { h: 'The File', p: ['A CSV or Excel file (.csv, .xlsx, .xls). The first row is your column headers, one product per row. This is the standard product or item sales report every POS can export.'] },
      { h: 'The Columns', p: ['Bar Cop needs three things: the Product Name (required), the Quantity Sold, and the Sales Amount. Your headers do not need to match exactly. Common names like item, qty, units, net sales, and revenue are recognized for you.'] },
      { h: 'The Mapping', p: ['After you drop the file, Bar Cop shows the columns it found and auto-matches them to Name, Quantity, and Sales. Fix any that are wrong, then import. It remembers your layout, so next month is one drop and done.'] },
      { h: 'Names That Do Not Match', p: ['Any POS row that does not line up with a product or menu item shows under Unmatched. Map each one once. Menu items like cocktails and plates explode through their recipe, so each ingredient gets its share of the variance.'] }
    ]);
  },

  showHowTo() {
    App.showHelpModal('How the Variance Report Works', [
      { p: ['Variance is the leak detector. It takes what your counts say you used and compares it to what your POS actually sold. The gap is product that left the bar without a matching sale: over-pour, theft, give-aways, or a count error.'] },
      { h: 'Import Your POS Sales', p: ['Pick the count period up top, then upload a product sales report from your POS. Map the product name, quantity, and sales columns once and Bar Cop matches each row to your products and menu items.'] },
      { h: 'Comps And Waste Come Out First', p: ['Bar Cop subtracts logged comps and waste from your used number before comparing to sales, because those are known non-revenue losses. What is left is the amount that should match POS. So variance is unexplained loss, not legit give-aways you already tracked.'] },
      { h: 'Two Views', p: ['Sales Variance is in dollars: theoretical sales (what the product should have rung up) versus register sales. Usage Variance is in ounces: what you poured versus what the POS sold. Use ounces for cocktails and food, where the sale belongs to the menu item and Bar Cop explodes the recipe down to each ingredient.'] },
      { h: 'Reading The Status', p: ['Under 5 percent off is OK, 5 to 15 is Watch, over 15 is Flag. A flagged product is where your money is walking out. Start there.'] }
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
      if (!result[productId]) result[productId] = { ouncesSold: 0, qty: 0, sales: 0, fromMenu: false };
      result[productId].ouncesSold += ouncesSold || 0;
      result[productId].qty        += qty        || 0;
      result[productId].sales      += sales      || 0;
      if (fromMenu) result[productId].fromMenu = true;
    };

    this.posRows.forEach(pr => {
      const key = pr.name.toLowerCase().trim();
      // Resolve target: direct product, then menu item, then manual map.
      // Manual map values can point to either a product id or a menu item id.
      let p  = productByName[key];
      let mi = menuItemByName[key];
      if (!p && !mi && this.manualMap[key]) {
        const mappedId = this.manualMap[key];
        p  = this.productById(mappedId);
        if (!p) mi = this.menuItemById(mappedId);
      }
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

    const controls = '<div class="card no-print"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Variance Report</span>'
      + '<button class="btn btn-ghost btn-sm" id="vr-how">How This Works</button></div>'
      + '<div class="form-row" style="margin-bottom:0;"><div class="f" style="width:260px;">'
      + '<label>Count Period</label><select id="vr-period">' + periodOpts + '</select></div></div></div>';

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

    this.container.innerHTML = '<div class="screen">' + controls + body + '</div>';

    document.getElementById('vr-how')?.addEventListener('click', () => this.showHowTo());
    document.getElementById('vr-period')?.addEventListener('change', e => { this.endCountId = e.target.value; this.draw(); });

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
          this.manualMap = {};
          this.draw();
        }
      });
    } else {
      this.wireBody();
    }
  },

  matchSummary() {
    const matched = Object.keys(this.posByProduct()).length;
    const unmatched = this.unmatchedPos().length;
    return '<div class="alert-bar" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<div class="alert-text">' + this.posRows.length + ' POS rows imported &middot; '
      + matched + ' matched to products' + (unmatched ? ' &middot; ' + unmatched + ' unmatched' : '') + '.</div>'
      + '<button class="btn btn-ghost btn-sm" id="vr-reimport">Re-import</button></div>';
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
    if (sortedProds.length) {
      opts += '<optgroup label="Inventory Products">';
      sortedProds.forEach(p => { opts += '<option value="' + p.id + '">' + esc(p.name) + '</option>'; });
      opts += '</optgroup>';
    }
    const rows = un.map(pr => '<div class="form-row" style="gap:12px;align-items:center;margin-bottom:8px;">'
      + '<div style="width:240px;font-size:13px;color:var(--t1);font-weight:600;flex-shrink:0;">' + esc(pr.name) + '</div>'
      + '<div class="f" style="width:260px;"><select class="vr-map" data-pos="' + esc(pr.name.toLowerCase().trim()) + '">'
      + opts + '</select></div></div>').join('');
    return '<div class="card"><div class="card-title">Unmatched POS Products</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:12px;">These POS rows did not match a product or menu item. Map each to the right one — menu items explode through their recipe so cocktails and food plates contribute correctly to ingredient variance.</div>' + rows + '</div>';
  },

  wireBody() {
    document.getElementById('vr-reimport')?.addEventListener('click', () => { this.posRows = null; this.manualMap = {}; this.draw(); });
    document.getElementById('vr-export')?.addEventListener('click', () => window.print());
    this.container.querySelectorAll('.vr-map').forEach(sel =>
      sel.addEventListener('change', e => {
        const pos = e.target.dataset.pos;
        if (e.target.value) this.manualMap[pos] = e.target.value;
        else delete this.manualMap[pos];
        this.draw();
      }));
    this.container.querySelectorAll('.rpt-tab').forEach(btn =>
      btn.addEventListener('click', () => { this.tab = btn.dataset.tab; this.draw(); }));
  },

  // ── Status ────────────────────────────────────────────────────────────────
  status(pct) {
    const a = Math.abs(pct || 0);
    if (a < 5)  return { label: 'OK',    color: 'var(--gold)' };
    if (a <= 15) return { label: 'Watch', color: 'var(--steel)' };
    return { label: 'Flag', color: 'var(--red)' };
  },
  badge(pct) {
    const s = this.status(pct);
    return '<span style="font-weight:700;color:' + s.color + ';">' + s.label + '</span>';
  },
  cur(v) { return v == null ? '<span style="color:var(--t4);">-</span>' : App.fmtCurrency(v); },
  pct(v) { return v == null ? '<span style="color:var(--t4);">-</span>' : v.toFixed(1) + '%'; },

  // ── Sales Variance ────────────────────────────────────────────────────────
  // Note: per-product sales attribution is only honest for direct-pour items
  // (bottle beer, draft pours, wine glasses). For cocktail/food ingredients
  // that flow through menu items, the register sale belongs to the menu item,
  // not the ingredient product. Those rows show "via menu" — Sales Variance
  // is null because the dollar attribution can't be reliably split.
  tabSales() {
    const usage = this.usageMap();
    const pos = this.posByProduct();
    const rows = Object.keys(usage).filter(pid => pos[pid]).map(pid => {
      const u = usage[pid], pr = pos[pid], p = u.product;
      const viaMenu = pr.fromMenu && pr.sales === 0;
      const registerSales = pr.sales;
      const theoSales = u.poursMade != null && p.menu_price ? u.poursMade * p.menu_price : null;
      const salesVar = (!viaMenu && theoSales != null) ? theoSales - registerSales : null;
      const varPct = (!viaMenu && theoSales) ? salesVar / theoSales * 100 : null;
      const actualCostPct = (!viaMenu && registerSales && u.usageCost != null) ? u.usageCost / registerSales * 100 : null;
      const actualProfit = (!viaMenu && u.usageCost != null) ? registerSales - u.usageCost : null;
      return { name: u.name, viaMenu, registerSales, theoSales, salesVar, varPct, actualCostPct, actualProfit };
    });
    if (!rows.length) return this.emptyMatch();
    const body = rows.map(r => '<tr>'
      + '<td><div class="val">' + esc(r.name) + (r.viaMenu ? ' <span style="font-size:9px;color:var(--t3);font-weight:700;letter-spacing:1px;">VIA MENU</span>' : '') + '</div></td>'
      + '<td>' + (r.viaMenu ? '<span style="color:var(--t4);">n/a</span>' : this.cur(r.registerSales)) + '</td>'
      + '<td>' + (r.viaMenu ? '<span style="color:var(--t4);">n/a</span>' : this.cur(r.theoSales)) + '</td>'
      + '<td>' + (r.viaMenu ? '<span style="color:var(--t4);">n/a</span>' : this.cur(r.salesVar)) + '</td>'
      + '<td>' + (r.viaMenu ? '<span style="color:var(--t4);">n/a</span>' : this.pct(r.varPct)) + '</td>'
      + '<td>' + (r.viaMenu ? '<span style="color:var(--t4);">n/a</span>' : this.pct(r.actualCostPct)) + '</td>'
      + '<td class="' + (r.actualProfit != null ? (r.actualProfit >= 0 ? 'pos' : 'neg') : '') + '">' + (r.viaMenu ? '<span style="color:var(--t4);">n/a</span>' : this.cur(r.actualProfit)) + '</td>'
      + '<td>' + (r.viaMenu ? '-' : (r.varPct != null ? this.badge(r.varPct) : '-')) + '</td>'
      + '</tr>').join('');
    return '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Register Sales</th><th>Theo Sales</th><th>Sales Variance</th>'
      + '<th>Variance %</th><th>Actual Cost %</th><th>Actual Profit</th><th>Status</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  // ── Usage Variance ────────────────────────────────────────────────────────
  tabUsage() {
    const usage = this.usageMap();
    const pos = this.posByProduct();
    const rows = Object.keys(usage).filter(pid => pos[pid]).map(pid => {
      const u = usage[pid], pr = pos[pid], p = u.product;
      // Phase 7: oz sold comes from posByProduct directly (which already
      // accounts for direct POS rows AND menu-item explosions).
      const ouncesSold = pr.ouncesSold || 0;
      const ounceVar = u.ouncesUsed != null ? u.ouncesUsed - ouncesSold : null;
      const varPct = ounceVar != null && u.ouncesUsed ? ounceVar / u.ouncesUsed * 100 : null;
      return { name: u.name, fromMenu: pr.fromMenu,
        ouncesSold, ouncesUsed: u.ouncesUsed, poursMade: u.poursMade,
        rawUsed: u.rawUsed, compUnits: u.compUnits, wasteUnits: u.wasteUnits,
        used: u.used, ounceVar, varPct };
    });
    if (!rows.length) return this.emptyMatch();
    const n = (v, d) => v == null ? '<span style="color:var(--t4);">-</span>' : Number(v).toFixed(d == null ? 1 : d);
    const dim = v => !v ? '<span style="color:var(--t4);">0</span>' : Number(v).toFixed(2).replace(/\.?0+$/, '');
    const body = rows.map(r => '<tr>'
      + '<td><div class="val">' + esc(r.name) + (r.fromMenu ? ' <span style="font-size:9px;color:var(--gold);font-weight:700;letter-spacing:1px;">FROM RECIPE</span>' : '') + '</div></td>'
      + '<td>' + n(r.ouncesSold) + '</td>'
      + '<td>' + n(r.ouncesUsed) + '</td>'
      + '<td>' + n(r.poursMade, 0) + '</td>'
      + '<td>' + n(r.rawUsed) + '</td>'
      + '<td>' + dim(r.compUnits) + '</td>'
      + '<td>' + dim(r.wasteUnits) + '</td>'
      + '<td>' + n(r.used) + '</td>'
      + '<td>' + n(r.ounceVar) + '</td>'
      + '<td>' + this.pct(r.varPct) + '</td>'
      + '<td>' + (r.varPct != null ? this.badge(r.varPct) : '-') + '</td>'
      + '</tr>').join('');
    return '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Oz Sold</th><th>Oz Used</th><th>Pours Made</th>'
      + '<th>Used (Raw)</th><th>Comps</th><th>Waste</th><th>Adjusted Used</th>'
      + '<th>Oz Variance</th><th>Variance %</th><th>Status</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  emptyMatch() {
    return '<div style="font-size:12px;color:var(--t3);padding:20px 0;text-align:center;">'
      + 'No products have both usage data for this period and a matched POS sales row. '
      + 'Check the count period and the unmatched-product mapping above.</div>';
  }
};
