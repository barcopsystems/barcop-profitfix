'use strict';

/* ── Inventory Control — Products (master product list: ic_products) ──────────
   ic_products is the platform-wide product master. Profit Recovery Bar Products
   and Kitchen Products read from it. Stored in App.inventoryData (ic_data table,
   Rule 21) — saved via App.saveInventory().

   Category-first entry: the operator lands on six big category cards (Liquor,
   Wine, Bottle Beer, Draft Beer, Food, Misc). Picking a card opens a form
   tailored to that category with the right field labels (Bottle Size, Keg
   Size, Cost per Case, Unit Type), the right defaults, and only the fields
   that matter. Edit reopens the same category's form. CSV import is per
   category so the column schema matches what's actually being imported. */

S.InventoryProducts = {
  editId: null,
  _saving: false,
  _pendingDelIds: null,
  _formCategory: null,     // category being entered/edited in the open form
  activeCat: 'Liquor',     // list filter for the existing-products table
  _selected: null,         // Set of product ids checked for bulk delete
  _dismissedAlerts: null,  // Set of categories whose incomplete-data bar was dismissed

  get CATEGORIES() { return App.IC_CATEGORIES; },   // single source on App

  // Per-category form spec: labels, defaults, which fields show.
  // The single renderForm() method reads this to assemble each form.
  FORM_SPEC: {
    'Liquor': {
      title:           'Liquor',
      noun:            'Bottle',
      sizeLabel:       'Bottle Size',
      sizeGroup:       'Spirits',
      defaultSize:     25.4,
      showPour:        true,
      pourLabel:       'Pour Size',
      defaultPour:     1.5,
      priceLabel:      'Pour Price',
      costLabel:       'Cost per Bottle',
      costTT:          'ic-cost-per-bottle',
      sizeTT:          'ic-bottle-size',
      pourTT:          'ic-liquor-pour',
      priceTT:         'ic-liquor-pour-price',
      calc1Label:      'Pours / Bottle',
      calc2Label:      'Cost / Pour',
      servingPlaceholder:'Double, Happy Hour',
      servingTT:       'ic-serving-sizes-liquor',
      parUnit:         'btls',
      showMenuPrice:   true,
      showCaseSize:    false,
      showUnitType:    false,
      showCalcStrip:   true,
      showServingSizes:true
    },
    'Wine': {
      title:           'Wine',
      noun:            'Bottle',
      sizeLabel:       'Bottle Size',
      sizeGroup:       'Wine',
      defaultSize:     25.4,
      showPour:        true,
      pourLabel:       'Glass Size',
      defaultPour:     5,
      priceLabel:      'Glass Price',
      costLabel:       'Cost per Bottle',
      costTT:          'ic-cost-per-bottle',
      sizeTT:          'ic-bottle-size',
      pourTT:          'ic-wine-glass-size',
      priceTT:         'ic-wine-glass-price',
      calc1Label:      'Glasses / Bottle',
      calc2Label:      'Cost / Glass',
      servingPlaceholder:'Bottle, Split',
      servingTT:       'ic-serving-sizes-wine',
      parUnit:         'btls',
      showMenuPrice:   true,
      showCaseSize:    false,
      showUnitType:    false,
      showCalcStrip:   true,
      showServingSizes:true
    },
    'Bottle Beer': {
      title:           'Bottle Beer',
      noun:            'Case',
      sizeLabel:       'Bottle Size',
      sizeGroup:       'Beer',
      defaultSize:     12,
      showPour:        false,
      priceLabel:      'Price per Bottle',
      costLabel:       'Cost per Case',
      costTT:          'ic-cost-per-case',
      sizeTT:          'ic-bottle-size-beer',
      priceTT:         'ic-beer-bottle-price',
      calc1Label:      'Btls / Case',
      calc2Label:      'Cost / Btl',
      parUnit:         'cases',
      showMenuPrice:   true,
      showCaseSize:    true,
      defaultCaseSize: 24,
      showUnitType:    false,
      showCalcStrip:   true,
      showServingSizes:false
    },
    'Draft Beer': {
      title:           'Draft Beer',
      noun:            'Keg',
      sizeLabel:       'Keg Size',
      sizeGroup:       'Draft Keg',
      defaultSize:     1984,
      showPour:        true,
      pourLabel:       'Pour Size',
      defaultPour:     16,
      priceLabel:      'Pour Price',
      costLabel:       'Cost per Keg',
      costTT:          'ic-cost-per-keg',
      sizeTT:          'ic-keg-size',
      pourTT:          'ic-draft-pour',
      priceTT:         'ic-draft-pour-price',
      calc1Label:      'Pours / Keg',
      calc2Label:      'Cost / Pour',
      servingPlaceholder:'Pitcher, 12 oz',
      servingTT:       'ic-serving-sizes-draft',
      parUnit:         'kegs',
      showMenuPrice:   true,
      showCaseSize:    false,
      showUnitType:    false,
      showCalcStrip:   true,
      showServingSizes:true
    },
    'Food': {
      title:           'Food Item',
      noun:            'Unit',
      sizeLabel:       null,
      sizeGroup:       null,
      showPour:        false,
      costLabel:       'Cost per Unit',
      costTT:          'ic-cost-per-unit',
      parUnit:         'units',
      showMenuPrice:   false,
      showCaseSize:    false,
      showUnitType:    true,
      defaultUnitType: 'lb',
      showCalcStrip:   false,
      showServingSizes:false
    },
    'Misc': {
      title:           'Misc Item',
      noun:            'Unit',
      sizeLabel:       null,
      sizeGroup:       null,
      showPour:        false,
      costLabel:       'Cost per Unit',
      costTT:          'ic-cost-per-unit',
      parUnit:         'units',
      showMenuPrice:   false,
      showCaseSize:    false,
      showUnitType:    true,
      defaultUnitType: 'each',
      showCalcStrip:   false,
      showServingSizes:false
    }
  },

  // Unit types offered to Food and Misc. Operator can also pick "custom" and
  // type a free-form unit (gal, qt, dozen, etc.) if their item does not fit.
  get UNIT_TYPES() { return App.IC_FOOD_UNIT_TYPES; },   // single source on App

  SIZES: [
    {g:'Spirits',l:'50ml (1.7 oz)',oz:1.7},{g:'Spirits',l:'200ml (6.8 oz)',oz:6.8},
    {g:'Spirits',l:'375ml (12.7 oz)',oz:12.7},{g:'Spirits',l:'750ml (25.4 oz)',oz:25.4},
    {g:'Spirits',l:'1L (33.8 oz)',oz:33.8},{g:'Spirits',l:'1.75L (59.2 oz)',oz:59.2},
    {g:'Wine',l:'187ml (6.3 oz)',oz:6.3},{g:'Wine',l:'375ml (12.7 oz)',oz:12.7},
    {g:'Wine',l:'750ml (25.4 oz)',oz:25.4},{g:'Wine',l:'1.5L (50.7 oz)',oz:50.7},
    {g:'Beer',l:'12 oz',oz:12},{g:'Beer',l:'16 oz',oz:16},{g:'Beer',l:'22 oz bomber',oz:22},
    {g:'Beer',l:'32 oz crowler',oz:32},{g:'Beer',l:'40 oz',oz:40},
    {g:'Draft Keg',l:'1/6 keg (661 oz)',oz:661},{g:'Draft Keg',l:'1/4 keg (992 oz)',oz:992},
    {g:'Draft Keg',l:'1/2 keg (1984 oz)',oz:1984},{g:'Other',l:'Custom (enter oz)',oz:null}
  ],

  // ── Helpers ───────────────────────────────────────────────────────────────
  isPourable(cat) { return cat !== 'Food' && cat !== 'Misc'; },

  // Location is NOT part of completeness — a product is assigned to locations on
  // Set Locations, and a missing one is surfaced as a "Needs a location" nudge in
  // the list rather than blocking the product. Primary location auto-derives from
  // the first location it's placed in.
  isComplete(p) {
    if (!p.name || p.unit_cost == null || p.unit_cost === '') return false;
    if (p.category === 'Bottle Beer') return !!(p.container_size_oz && p.case_size);
    if (this.isPourable(p.category)) return !!(p.container_size_oz && p.pour_size_oz && p.menu_price);
    return true;
  },

  products() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_products)) App.inventoryData.ic_products = [];
    return App.inventoryData.ic_products;
  },

  // Pull unique oz values from existing products that are NOT in the
  // built-in SIZES list. These get added to a "Saved Custom Sizes" optgroup
  // so an operator who entered "22.5 oz" once never has to re-type it.
  customSizesUsed(group) {
    const builtIn = new Set(this.SIZES.filter(s => s.oz != null).map(s => s.oz));
    const seen = new Set();
    (this.products() || []).forEach(p => {
      if (group) {
        const pg = (this.FORM_SPEC[p.category] || {}).sizeGroup;
        if (pg !== group) return;
      }
      const oz = parseFloat(p.container_size_oz);
      if (!isNaN(oz) && oz > 0 && !builtIn.has(oz)) seen.add(oz);
    });
    return [...seen].sort((a, b) => a - b);
  },

  vendorOpts(sel) {
    const vendors = ((App.inventoryData && App.inventoryData.ic_vendors) || [])
      .slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    let h = '<option value="">Select vendor...</option>';
    vendors.forEach(v => {
      h += '<option value="' + esc(v.name) + '"' + (sel === v.name ? ' selected' : '') + '>' + esc(v.name) + '</option>';
    });
    if (sel && !vendors.some(v => v.name === sel)) {
      h += '<option value="' + esc(sel) + '" selected>' + esc(sel) + ' (unsaved)</option>';
    }
    return h;
  },

  locationOpts(sel) {
    const locs = ((App.inventoryData && App.inventoryData.ic_locations) || [])
      .filter(l => !l.archived)
      .slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    let h = '<option value="">Select location...</option>';
    locs.forEach(l => {
      h += '<option value="' + esc(l.name) + '"' + (sel === l.name ? ' selected' : '') + '>' + esc(l.name) + '</option>';
    });
    if (sel && !locs.some(l => l.name === sel)) {
      h += '<option value="' + esc(sel) + '" selected>' + esc(sel) + ' (unsaved)</option>';
    }
    return h;
  },

  // Size dropdown scoped to the form's category group. Adds Saved Custom
  // Sizes (across all products, not just this category) plus a Custom entry.
  sizeOpts(sel, group) {
    let h = '<option value="">Select size...</option>';
    if (group) {
      h += '<optgroup label="' + esc(group) + '">';
      this.SIZES.filter(s => s.g === group).forEach(s => {
        h += '<option value="' + s.oz + '"' + (sel != null && s.oz === sel ? ' selected' : '') + '>' + s.l + '</option>';
      });
      h += '</optgroup>';
    }
    const custom = this.customSizesUsed();
    if (custom.length) {
      h += '<optgroup label="Saved Custom Sizes">';
      custom.forEach(oz => {
        h += '<option value="' + oz + '"' + (sel === oz ? ' selected' : '') + '>' + oz + ' oz</option>';
      });
      h += '</optgroup>';
    }
    h += '<option value="custom"' + (sel != null && !this.SIZES.find(s => s.oz === sel) ? ' selected' : '') + '>Custom (enter oz)</option>';
    return h;
  },

  unitTypeOpts(sel) {
    let h = '';
    this.UNIT_TYPES.forEach(u => {
      h += '<option value="' + u + '"' + (sel === u ? ' selected' : '') + '>' + u + '</option>';
    });
    if (sel && !this.UNIT_TYPES.includes(sel) && sel !== 'custom') {
      h += '<option value="' + esc(sel) + '" selected>' + esc(sel) + '</option>';
    }
    h += '<option value="custom"' + (sel === 'custom' ? ' selected' : '') + '>Custom (type one)</option>';
    return h;
  },

  // ── Entry point ───────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    this._selected = null;   // fresh entry starts with nothing selected
    this.renderLanding();
  },

  // Page directions for the nav "i" (see [[help-model]]). Covers single entry
  // AND the per-category CSV / Excel upload flow.
  showHowTo() {
    App.showHelpModal('How Add Products Works', [
      { p: ['Add Products is your master product list. Everything Bar Cop costs, counts, orders, and reports reads from here, so a complete product list is the best hour of setup you can put into Bar Cop. Get it right once and every count sheet, order, and pour cost downstream is right too.'] },
      { h: 'Start With A Category', p: ['Pick one of the six category cards on top: Liquor, Wine, Bottle Beer, Draft Beer, Food, Misc. Each opens a form built for that category with the right fields and labels: bottle size and pour for liquor, glass for wine, case size for bottle beer, keg size for draft, a unit type for food and misc. Add one product at a time, or upload a whole list.'] },
      { h: 'What Makes A Product Complete', p: ['Every product needs a name and a cost. Anything you pour (liquor, wine, draft) also needs its container size, pour size, and menu price so Bar Cop can figure pours per container, cost per pour, and pour cost percent. For example, a 750ml bottle of well vodka at 25.4 oz, poured at 1.5 oz, gives you about 17 pours per bottle. Bottle beer needs the bottle size and case size. A product missing a required field shows as Incomplete in red until you finish it.'] },
      { h: 'Bottle Beer Is By The Case', p: ['Bottle beer is bought, costed, and counted by the case, the same way liquor is the bottle and draft is the keg. Enter the cost per case and the case size, say 24 for a case of Modelo, and Bar Cop works out the per-bottle cost for the menu side on its own. You never track loose bottles as the unit; the case is the unit.'] },
      { h: 'Other Sizes Sold', p: ['The standard serving and its menu price live up top. If a product also sells another way, a pitcher, a happy hour pour, a whole bottle of wine, add it under Other Sizes Sold with its own price and Bar Cop shows that size its own pour cost. A thinner happy hour price reads its own honest margin instead of hiding inside the standard pour.'] },
      { h: 'Uploading A List', p: ['Each category card has an Upload option for bringing in a whole list at once from a CSV or Excel file: a POS export, a distributor order guide, or your own spreadsheet. The first row is your column headers, one product per row. The category is locked to the card you uploaded from, so the columns offered match that category and Bar Cop never figures a cost per pour with the wrong divisor.'] },
      { h: 'Matching Your Columns', p: ['Only Product Name is required; everything else is optional and can be filled in after. Your headers do not need to match exactly. After you drop the file, Bar Cop shows the columns it found, auto-matched to each field, with a preview of your first rows so you can confirm it lined them up right. Fix any that are wrong, set ones you want to ignore to Skip, then Import. Every row comes in as a product in that category, and any row missing required data shows as Incomplete so you can finish it later.'] },
      { h: 'Bulk Edit Many At Once', p: ['After an upload you often need the same value across a whole category: a 1.5 oz pour on every liquor, one vendor or storage location across a list, the same par. Check the products you want, or use Select All on the category tab, then tap Bulk Edit. Turn on only the fields you want to change, set each value, and Apply. Bar Cop writes those fields to every selected product at once and leaves everything else untouched, then refigures pours per container, cost per pour, and pour cost percent for each one. Anything that was Incomplete and now has what it needs clears its flag.'] },
      { h: 'Hiding A Product', p: ['When you Edit a product, the status across from the title reads ACTIVE or HIDDEN. Hit Hide from operations to pull a seasonal pour or a discontinued item out of counts, orders, and the menu side without throwing away its history, then Update to commit. A hidden product reads Inactive on the list; open it again and Make active brings it back.'] }
    ]);
  },

  // ── Landing: six category cards on top, filterable list below ────────────
  renderLanding() {
    const all = this.products();
    // Short, category-specific labels for the per-card upload button.
    const UPLOAD_LABEL = { 'Liquor': 'Liquor', 'Wine': 'Wine', 'Bottle Beer': 'Btl Beer', 'Draft Beer': 'Draft', 'Food': 'Food', 'Misc': 'Misc' };
    const cards = this.CATEGORIES.map(c => {
      const n = all.filter(p => (p.category || '') === c).length;
      const incomplete = all.filter(p => (p.category || '') === c && !this.isComplete(p)).length;
      const incText = incomplete > 0
        ? '<div style="font-size:10px;color:var(--t4);margin-top:6px;">' + incomplete + ' incomplete</div>'
        : '';
      return '<div class="ip-card" data-cat="' + esc(c) + '" '
        + 'style="background:var(--surface);border:1px solid var(--b-edge);border-radius:8px;padding:22px 18px 20px;text-align:center;">'
        + '<div style="font-size:17px;font-weight:800;color:var(--t1);letter-spacing:0.3px;margin-bottom:4px;">' + esc(c) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);">' + n + ' product' + (n === 1 ? '' : 's') + '</div>'
        + incText
        + '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:18px;">'
          + '<span class="ip-card-add" data-cat="' + esc(c) + '" style="color:var(--gold);font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">+ Add Single Product</span>'
          + '<span style="font-size:10px;color:var(--t4);letter-spacing:1px;">or</span>'
          + '<button type="button" class="ip-card-imp" data-cat="' + esc(c) + '" style="background:none;border:1px solid var(--b1);border-radius:4px;color:var(--t2);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 12px;cursor:pointer;">Upload ' + esc(UPLOAD_LABEL[c] || c) + ' List</button>'
        + '</div>'
        + '</div>';
    }).join('');

    const cardsBlock = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">'
      + cards + '</div>';

    // Existing-products table, filtered by activeCat. Tabs flip the filter.
    const prods = all.filter(p => (p.category || '') === this.activeCat);
    const target = App.data?.settings?.targets?.bar_pour_cost_pct ?? 22;
    const incompleteHere = prods.filter(p => !this.isComplete(p));

    const tabs = this.catTabs();

    let body;
    if (prods.length === 0) {
      body = '<div class="empty"><div class="empty-title">No ' + esc(this.activeCat) + ' products yet</div>'
        + '<div class="empty-sub">Click the ' + esc(this.activeCat) + ' card above to add your first one.</div></div>';
    } else {
      const spec = this.FORM_SPEC[this.activeCat];
      const pourable = this.isPourable(this.activeCat);
      const dismissed = this._dismissedAlerts && this._dismissedAlerts.has(this.activeCat);
      const alertBar = (incompleteHere.length > 0 && !dismissed)
        ? '<div class="alert-bar" style="margin-bottom:14px;"><div class="alert-text">'
          + incompleteHere.length + ' product' + (incompleteHere.length > 1 ? 's have' : ' has')
          + ' incomplete data, flagged in the Product column.</div>'
          + '<button class="btn btn-ghost btn-sm ip-alert-dismiss" style="flex-shrink:0;border-color:rgba(255,255,255,0.5);color:var(--w);">Dismiss</button></div>'
        : '';

      const selCount = this._selected ? this._selected.size : 0;
      const toolbar = '<div class="no-print" style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">'
        + '<button class="btn btn-ghost btn-sm ip-sel-all">Select All</button>'
        + '<button class="btn btn-ghost btn-sm ip-sel-clear">Clear</button>'
        + (selCount > 0 ? '<button class="btn btn-ghost btn-sm ip-sel-edit">Bulk Edit ' + selCount + ' Selected</button>' : '')
        + (selCount > 0 ? '<button class="btn btn-danger btn-sm ip-sel-del">Delete ' + selCount + ' Selected</button>' : '')
        + '</div>';

      const sizeCol = (this.activeCat === 'Food' || this.activeCat === 'Misc') ? 'Unit' : (spec && spec.sizeLabel) || 'Container';
      const costCol = 'Cost Per';

      // Group the list by Sub-Category (Misc Type for Misc) into its own card so a
      // manager can scan each style — "Vodka Products (18)" — and spot what is
      // missing. The sub-category lands in the first column header, like the
      // category-grouped usage reports. Products with no sub-category fall into an
      // "Uncategorized" card at the bottom.
      const headerCols = '<th>Vendor</th><th>' + esc(sizeCol) + '</th><th>Pour</th>'
        + '<th>' + esc(costCol) + '</th><th>Cost %</th><th>Par</th><th></th>';
      // Shared fixed colgroup so every group card lines its columns up in straight
      // lines down the page (and the mobile full-width stack hook kicks in).
      // Content-proportioned widths so each column hugs its data and the gaps read evenly.
      const colgroup = '<colgroup><col style="width:40px;"/><col style="width:200px;"/><col style="width:150px;"/><col style="width:130px;"/><col style="width:80px;"/><col style="width:120px;"/><col style="width:80px;"/><col style="width:90px;"/><col style="width:150px;"/></colgroup>';
      const tables = App.subcatGroups(prods, this.activeCat).map((g, gi) => {
        const hdr = (g.key ? esc(g.key) : 'Uncategorized') + ' (' + g.items.length + ')';
        const groupRows = g.items.map(p => this._productRowHtml(p, pourable, target)).join('');
        return '<div class="card" style="overflow-x:auto;margin-top:' + (gi === 0 ? '0' : '16') + 'px;">'
          + '<table class="row-list" style="table-layout:fixed;width:100%;">' + colgroup + '<thead><tr>'
          + '<th></th><th>' + hdr + '</th>' + headerCols
          + '</tr></thead><tbody>' + groupRows + '</tbody></table></div>';
      }).join('');

      body = alertBar + toolbar + tables;
    }

    // When an upload is active, the lower area becomes the in-place import
    // panel (drop zone -> column mapper) instead of the product list. The list
    // sits in an .rpt-panel so the active category tab connects into it cleanly
    // (same connected look as the report tabs) and the header row gets padding.
    const lower = this._import ? this.importPanelHTML() : (tabs + body);
    this.container.innerHTML = '<div class="screen">' + cardsBlock + lower + '</div>';
    this.wireLanding();
  },

  // One product row for the grouped Products list.
  _productRowHtml(p, pourable, target) {
    const complete = this.isComplete(p);
    const sz  = this.SIZES.find(s => s.oz === p.container_size_oz);
    const szL = p.category === 'Food' || p.category === 'Misc'
      ? esc(p.unit_type || '-')
      : (sz ? sz.l : (p.container_size_oz ? p.container_size_oz + ' oz' : '-'));
    const pc  = p.pour_cost_pct != null ? (p.pour_cost_pct > target ? 'neg' : 'pos') : '';
    const dim = p.active === false ? 'opacity:0.5;' : '';
    const costUnit = ((this.FORM_SPEC[p.category] || {}).costLabel || 'Cost per Unit').split(' ').pop().toLowerCase();
    const costDisplay = p.unit_cost != null
      ? App.fmtCurrency(p.unit_cost) + ' <span style="font-size:9px;color:var(--t3);">/' + costUnit + '</span>'
      : '<span style="color:var(--t4);">-</span>';
    const checked = (this._selected && this._selected.has(p.id)) ? ' checked' : '';
    return '<tr style="' + dim + '">'
      + '<td style="width:40px;text-align:center;"><input type="checkbox" class="bc-check ip-sel" data-id="' + p.id + '"' + checked + '/></td>'
      + '<td><div class="val">' + esc(p.name)
      + (p.active === false ? ' <span style="font-size:10px;font-weight:700;color:var(--t3);letter-spacing:0.5px;">Inactive</span>' : '') + '</div>'
      + (p.brand ? '<div style="font-size:10px;color:var(--t3);">' + esc(p.brand) + '</div>' : '')
      + (!complete ? '<div style="font-size:10px;color:var(--red);font-weight:600;letter-spacing:0.5px;">Incomplete</div>' : '')
      + (App.productLocations(p).length === 0 ? '<div style="font-size:10px;color:var(--red);font-weight:600;letter-spacing:0.5px;">Needs a location</div>' : '') + '</td>'
      + '<td>' + esc(p.vendor || '-') + '</td>'
      + '<td>' + esc(szL) + '</td>'
      + '<td>' + (pourable ? (p.pour_size_oz ? p.pour_size_oz + ' oz' : '-') : '<span style="color:var(--t4);">-</span>') + '</td>'
      + '<td>' + costDisplay + '</td>'
      + '<td class="' + pc + '">' + (pourable && p.pour_cost_pct != null ? App.fmtPct(p.pour_cost_pct) : '<span style="color:var(--t4);">-</span>') + '</td>'
      + '<td>' + (p.par_level != null && p.par_level !== '' ? esc(p.par_level + ' ' + (App.productUnit(p) || '')) : '<span style="color:var(--t4);">-</span>') + '</td>'
      + '<td><div class="row-actions">'
      + '<button class="btn btn-ghost btn-sm ip-edit" data-id="' + p.id + '">Edit</button>'
      + '<button class="btn btn-danger btn-sm ip-del" data-id="' + p.id + '">Delete</button>'
      + '</div></td></tr>';
  },

  // Category filter tabs, styled to match the report tab bar (.rpt-tabs).
  catTabs() {
    const all = this.products();
    return '<div class="ch-tabs no-print">'
      + this.CATEGORIES.map(c => {
          const n = all.filter(p => (p.category || '') === c).length;
          const on = c === this.activeCat;
          return '<button class="ch-tab' + (on ? ' on' : '') + '" data-cat="' + esc(c) + '">'
            + esc(c) + (n ? ' <span style="opacity:0.55;">' + n + '</span>' : '') + '</button>';
        }).join('')
      + '</div>';
  },

  wireLanding() {
    this.container.onclick = ev => {
      const addLink = ev.target.closest('.ip-card-add');
      const impLink = ev.target.closest('.ip-card-imp');
      const tab     = ev.target.closest('.ch-tab');
      const edit    = ev.target.closest('.ip-edit');
      const del     = ev.target.closest('.ip-del');
      const dismiss = ev.target.closest('.ip-alert-dismiss');
      const selAll  = ev.target.closest('.ip-sel-all');
      const selClr  = ev.target.closest('.ip-sel-clear');
      const selEdit = ev.target.closest('.ip-sel-edit');
      const selDel  = ev.target.closest('.ip-sel-del');
      const selBox  = ev.target.closest('.ip-sel');

      if (addLink) { ev.stopPropagation(); this.showForm(addLink.dataset.cat); return; }
      if (impLink) { ev.stopPropagation(); this._import = { cat: impLink.dataset.cat }; this._formCategory = impLink.dataset.cat; this.renderLanding(); return; }
      if (tab)     { ev.stopPropagation(); this.activeCat = tab.dataset.cat; this._selected = new Set(); this.renderLanding(); return; }
      if (edit)    { ev.stopPropagation(); this.showFormForId(edit.dataset.id); return; }
      if (del)     { ev.stopPropagation(); this.confirmDel([del.dataset.id], 'Delete this product?'); return; }
      if (dismiss) { ev.stopPropagation(); (this._dismissedAlerts = this._dismissedAlerts || new Set()).add(this.activeCat); this.renderLanding(); return; }
      if (selAll)  { ev.stopPropagation(); this._selected = new Set(this.products().filter(p => (p.category || '') === this.activeCat).map(p => p.id)); this.renderLanding(); return; }
      if (selClr)  { ev.stopPropagation(); this._selected = new Set(); this.renderLanding(); return; }
      if (selEdit) { ev.stopPropagation(); this.openBulkEdit(); return; }
      if (selDel)  { ev.stopPropagation(); this.confirmDel([...(this._selected || [])]); return; }
      if (selBox)  { const id = selBox.dataset.id; this._selected = this._selected || new Set(); if (this._selected.has(id)) this._selected.delete(id); else this._selected.add(id); this.renderLanding(); return; }
    };

    // In-place import panel (drop zone -> column mapper, same spot). Wired only
    // while an upload is active for a category.
    if (this._import) {
      document.getElementById('ip-imp-cancel')?.addEventListener('click', () => { this._import = null; this.renderLanding(); });
      const cat = this._import.cat;
      const el = document.getElementById('ip-csv');
      if (el && typeof CSVMapper !== 'undefined') {
        CSVMapper.mount(el, {
          actionsEl: '#ip-csv-actions',
          dropTitle: 'Drop your ' + cat + ' product file here',
          dropSub: 'Needs a product name column; cost, size, price and par are optional.',
          confirmLabel: 'Import',
          fields: this.importFieldsForCategory(cat).map(f => ({ key: f.key, label: f.label, required: f.required, match: f.aliases })),
          onState: state => { const row = document.getElementById('ip-imp-cancel-row'); if (row) row.style.display = (state === 'map') ? 'none' : ''; },
          onComplete: rows => { this._formCategory = cat; this.runImport(rows); }
        });
      }
    }
  },

  // ── Form ──────────────────────────────────────────────────────────────────
  // Track whether the form is being opened to EDIT an INCOMPLETE existing
  // product. Drives field-missing highlights. Add-new flow + edit-of-
  // complete flow both stay clean (no red borders). Only when the operator
  // clicks Edit on a row flagged as Incomplete do the missing cells light up.
  _setEditFlag(id) {
    if (!id) { this._editingIncomplete = false; return; }
    const p = this.products().find(x => x.id === id);
    this._editingIncomplete = !!(p && !this.isComplete(p));
  },

  showForm(category, id) {
    this._setEditFlag(id);
    if (!this.CATEGORIES.includes(category)) category = 'Liquor';
    this.editId = id || null;
    this._formCategory = category;
    this.renderForm();
  },

  // Used by Edit click: resolves the category from the existing record.
  showFormForId(id) {
    const p = this.products().find(x => x.id === id);
    if (!p) return;
    this.showForm(p.category || 'Misc', id);
  },

  renderForm() {
    const cat = this._formCategory;
    const spec = this.FORM_SPEC[cat] || this.FORM_SPEC['Misc'];
    const p = this.editId ? this.products().find(x => x.id === this.editId) : null;
    const v = (val) => val != null && val !== '' ? val : '';
    const isActive = p ? p.active !== false : true;

    // ── Header: standard form-card title; the Active toggle sits across from
    // the title on the right (edit mode only). ─────────────────────────────────
    const titleText = this.editId ? 'Editing ' + esc(cat) + ' Product' : 'New ' + esc(spec.title) + ' Product';

    const statusHTML = this.editId
      ? '<div style="display:flex;align-items:center;gap:10px;">'
        + '<span class="ip-active-state" data-active="' + (isActive ? 'true' : 'false') + '" style="'
          + 'display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:1px;'
          + 'background:' + (isActive ? 'rgba(125,199,125,0.12)' : 'rgba(199,125,125,0.12)') + ';'
          + 'color:' + (isActive ? 'var(--green)' : 'var(--red)') + ';">'
          + '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;"></span>'
          + (isActive ? 'ACTIVE' : 'HIDDEN')
        + '</span>'
        + '<button type="button" class="btn btn-ghost btn-sm" id="ip-toggle-active">'
          + (isActive ? 'Hide from operations' : 'Make active')
        + '</button>'
      + '</div>'
      : '';

    const header = '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">'
      + '<span>' + titleText + '</span>'
      + statusHTML
    + '</div>';

    // ── Row 1: identity fields (Name, Brand, Sub-Cat, Vendor, Location) ────
    // Auto-fit grid: fits all five on one row on wide screens and wraps/stacks
    // cleanly on narrow screens instead of overflowing the form container.
    // Misc is a grab-bag, so it gets a structured Misc Type select that tags the
    // product (NA Beverage / Drink Mixer / Food Ingredient / supplies). That tag
    // drives the Menu Items NA picker and the recipe ingredient picker, so it
    // replaces the unreliable free-text Sub-Category here. Every other category
    // keeps a Sub-Category, but as a datalist (suggestions + values already used)
    // so matching styles group cleanly on the Products list instead of splintering
    // on typos.
    const subOrType = cat === 'Misc'
      ? '<div class="f"><label>Misc Type</label>'
        + '<select id="ip-misctype"><option value="">Select type...</option>'
        + App.MISC_TYPES.map(t => '<option' + (p?.misc_type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('')
        + '</select></div>'
      : (() => {
          const cur = (p?.sub_category || '');
          const opts = App.subcatSuggestions(cat).filter(o => o.toLowerCase() !== 'other');
          return '<div class="f"><label>Sub-Category</label>'
            + '<select id="ip-subcat-sel">'
              + '<option value="">Select...</option>'
              + opts.map(o => '<option' + (o.toLowerCase() === cur.toLowerCase() ? ' selected' : '') + '>' + esc(o) + '</option>').join('')
              + '<option' + (cur.toLowerCase() === 'other' ? ' selected' : '') + '>Other</option>'
            + '</select></div>';
        })();

    const row1 = '<div class="form-grid" style="align-items:start;">'
      + '<div class="f"><label>Product Name</label>'
      + '<input type="text" id="ip-name" value="' + esc(p?.name || '') + '" placeholder="' + esc(this._namePlaceholder(cat)) + '"/></div>'
      + '<div class="f"><label>Brand</label>'
      + '<input type="text" id="ip-brand" value="' + esc(p?.brand || '') + '" placeholder="' + esc(this._brandPlaceholder(cat)) + '"/></div>'
      + subOrType
      + '<div class="f"><label>Primary Vendor</label>'
      + '<select id="ip-vendor">' + this.vendorOpts(p?.vendor) + '</select></div>'
      + '<div class="f"><label>Primary Location</label>'
      + '<select id="ip-loc1">' + this.locationOpts(p?.primary_location) + '</select></div>'
    + '</div>';

    // ── Row 2: category-specific size/cost/par fields ─────────────────────
    let row2 = '';
    if (spec.sizeGroup && spec.showPour) {
      // Liquor / Wine / Draft Beer
      const isCustom = p?.container_size_oz != null && !this.SIZES.find(s => s.oz === p.container_size_oz);
      const sizeSel = isCustom ? null : (p?.container_size_oz != null ? p.container_size_oz : spec.defaultSize);
      row2 = '<div class="form-row ip-row2" style="gap:14px;margin-top:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>' + esc(spec.sizeLabel) + '</label>'
        + '<select id="ip-size">' + this.sizeOpts(sizeSel, spec.sizeGroup) + '</select></div>'
        + '<div class="f" id="ip-cw" style="width:90px;flex-shrink:0;' + (isCustom ? '' : 'display:none;') + '"><label>Custom (oz)</label>'
        + '<div class="fw"><input class="suf" type="number" id="ip-coz" value="' + (isCustom ? p.container_size_oz : '') + '" step="0.1"/><span class="suf">oz</span></div></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>' + esc(spec.costLabel) + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-cost" value="' + v(p?.unit_cost) + '" step="0.01" placeholder="0.00"/></div></div>'
        + '<div class="f" style="width:100px;flex-shrink:0;"><label>' + esc(spec.pourLabel || 'Pour Size') + '</label>'
        + '<div class="fw"><input class="suf" type="number" id="ip-pour" value="' + v(p?.pour_size_oz) + '" step="0.25" placeholder="e.g. ' + spec.defaultPour + '"/><span class="suf">oz</span></div></div>'
        + '<div class="f" style="width:120px;flex-shrink:0;"><label>' + 'Menu Price' + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-price" value="' + v(p?.menu_price) + '" step="0.25" placeholder="0.00"/></div></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Par <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span></label>'
        + '<input type="number" id="ip-par" value="' + v(p?.par_level) + '" step="1" min="0" placeholder="0"/></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Reorder <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span></label>'
        + '<input type="number" id="ip-reorder" value="' + v(p?.reorder_point) + '" step="1" min="0" placeholder="0"/></div>'
      + '</div>';
    } else if (spec.showCaseSize) {
      // Bottle Beer
      const isCustom = p?.container_size_oz != null && !this.SIZES.find(s => s.oz === p.container_size_oz);
      const sizeSel = isCustom ? null : (p?.container_size_oz != null ? p.container_size_oz : spec.defaultSize);
      row2 = '<div class="form-row ip-row2" style="gap:14px;margin-top:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>' + esc(spec.sizeLabel) + '</label>'
        + '<select id="ip-size">' + this.sizeOpts(sizeSel, spec.sizeGroup) + '</select></div>'
        + '<div class="f" id="ip-cw" style="width:90px;flex-shrink:0;' + (isCustom ? '' : 'display:none;') + '"><label>Custom (oz)</label>'
        + '<div class="fw"><input class="suf" type="number" id="ip-coz" value="' + (isCustom ? p.container_size_oz : '') + '" step="0.1"/><span class="suf">oz</span></div></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Case Size</label>'
        + '<div class="fw"><input class="suf" type="number" id="ip-case-size" value="' + v(p?.case_size != null ? p.case_size : spec.defaultCaseSize) + '" step="1" min="1"/><span class="suf">btl</span></div></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>' + esc(spec.costLabel) + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-cost" value="' + v(p?.unit_cost) + '" step="0.01" placeholder="0.00"/></div></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>' + 'Menu Price' + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-price" value="' + v(p?.menu_price) + '" step="0.25" placeholder="0.00"/></div></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Par <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span></label>'
        + '<input type="number" id="ip-par" value="' + v(p?.par_level) + '" step="1" min="0" placeholder="0"/></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Reorder <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span></label>'
        + '<input type="number" id="ip-reorder" value="' + v(p?.reorder_point) + '" step="1" min="0" placeholder="0"/></div>'
      + '</div>';
    } else if (spec.showUnitType) {
      // Food / Misc
      const ut = p?.unit_type || spec.defaultUnitType;
      const isCustomUnit = ut && !this.UNIT_TYPES.includes(ut);
      row2 = '<div class="form-row ip-row2" style="gap:14px;margin-top:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Unit Type</label>'
        + '<select id="ip-unit">' + this.unitTypeOpts(isCustomUnit ? 'custom' : ut) + '</select></div>'
        + '<div class="f" id="ip-uw" style="width:140px;flex-shrink:0;' + (isCustomUnit ? '' : 'display:none;') + '"><label>Custom Unit</label>'
        + '<input type="text" id="ip-unit-custom" value="' + esc(isCustomUnit ? ut : '') + '" placeholder="gal, dozen, etc."/></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>' + esc(spec.costLabel) + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-cost" value="' + v(p?.unit_cost) + '" step="0.01" placeholder="0.00"/></div></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Par <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span></label>'
        + '<input type="number" id="ip-par" value="' + v(p?.par_level) + '" step="1" min="0" placeholder="0"/></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Reorder <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span></label>'
        + '<input type="number" id="ip-reorder" value="' + v(p?.reorder_point) + '" step="1" min="0" placeholder="0"/></div>'
      + '</div>';
    }

    // ── Calc strip (pourable + bottle beer) ───────────────────────────────
    // For Bottle Beer slots are: Btls/Case, Cost/Btl, Pour Cost %.
    // For everything else: Pours/Container, Cost/Pour, Pour Cost %.
    let calcStrip = '';
    if (spec.showCalcStrip) {
      const slot1Label = spec.calc1Label || (spec.showCaseSize ? 'Btls / Case' : 'Pours / Container');
      const slot2Label = spec.calc2Label || (spec.showCaseSize ? 'Cost / Btl' : 'Cost / Pour');
      calcStrip = '<div class="card" style="margin-top:18px;"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">' + esc(slot1Label) + '</div><div class="calc-val" id="ip-pours">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">' + esc(slot2Label) + '</div><div class="calc-val" id="ip-cpp">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Pour Cost %</div><div class="calc-val" id="ip-pct">-</div></div>'
      + '</div></div>';
    }

    // ── Notes ─────────────────────────────────────────────────────────────
    const notes = '<div class="form-row" style="gap:14px;margin-top:14px;">'
      + '<div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="ip-notes" class="notes-ta" rows="2" placeholder="Optional">' + esc(p?.notes || '') + '</textarea></div>'
    + '</div>';

    const servingBlock = spec.showServingSizes ? this.servingSizesBlockHTML(p, spec) : '';

    // ── Resale block (Food + Misc) ────────────────────────────────────────
    // For packaged items the bar buys and sells whole (bagged chips, bottled
    // NA), an optional "Sold on the menu" reveal carries a menu price + how many
    // servings one purchased unit yields, so cost flows to the menu per serving.
    let resaleBlock = '';
    if (spec.showUnitType) {
      const sold = !!p?.sold_on_menu;
      const initCps = sold ? this._resaleCps(p?.unit_cost, p?.servings_per_unit) : 0;
      resaleBlock = '<div class="form-row" style="margin-top:16px;">'
        + '<label style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--t1);cursor:pointer;">'
          + '<input type="checkbox" class="bc-check" id="ip-sold"' + (sold ? ' checked' : '') + '/> Sold on the menu as-is (resale item)</label>'
      + '</div>'
      + '<div id="ip-resale" style="' + (sold ? '' : 'display:none;') + 'margin-top:10px;">'
        + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
          + '<div class="f" style="width:130px;flex-shrink:0;"><label>Menu Price</label>'
            + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-price" value="' + v(p?.menu_price) + '" step="0.25" placeholder="0.00"/></div></div>'
          + '<div class="f" style="width:150px;flex-shrink:0;"><label>Servings per Unit</label>'
            + '<input type="number" id="ip-servings" value="' + v(p?.servings_per_unit) + '" step="1" min="1" placeholder="1"/></div>'
          + '<div class="f" style="width:140px;flex-shrink:0;"><label>Cost / Serving</label>'
            + '<div class="calc-val" id="ip-cps" style="padding-top:7px;">' + (initCps > 0 ? App.fmtCurrency(initCps) : '-') + '</div></div>'
        + '</div></div>';
    }

    const formCard = '<div class="card form-card">'
      + header
      + row1
      + row2
      + calcStrip
      + resaleBlock
      + servingBlock
      + notes
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="ip-save">' + (this.editId ? 'Update' : 'Save') + '</button>'
        + '<button class="btn btn-ghost" id="ip-cancel">Cancel</button>'
        + '<span id="ip-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
    + '</div>';
    // Popup over the products list (which stays mounted behind), instead of
    // swapping the whole page out. noClose drops the corner X; Cancel closes it.
    App.openModal(formCard, { id: 'ip-form-modal', layer: 9000, maxWidth: 920, noClose: true });

    this._wireForm();
  },

  _namePlaceholder(cat) {
    return { 'Liquor':"Tito's Handmade Vodka", 'Wine':'House Cabernet', 'Bottle Beer':'Modelo Especial',
             'Draft Beer':'ABW Pearl Snap', 'Food':'Ground Beef 80/20', 'Misc':'Lime Juice' }[cat] || '';
  },
  _brandPlaceholder(cat) {
    return { 'Liquor':"Tito's", 'Wine':'Producer', 'Bottle Beer':'Constellation',
             'Draft Beer':'Austin Beerworks', 'Food':'', 'Misc':'' }[cat] || '';
  },
  _subcatPlaceholder(cat) {
    return { 'Liquor':'Vodka', 'Wine':'Red', 'Bottle Beer':'Domestic',
             'Draft Beer':'Craft', 'Food':'Protein', 'Misc':'Mixer' }[cat] || '';
  },

  // Required fields per category — matches isComplete() exactly so the
  // .field-missing highlights surface the same items as the Incomplete badge.
  // All categories require name, unit cost, and a primary location (a product
  // with no location can't be counted). Pourable (Liquor/Wine/Draft Beer) also
  // require container size, pour size, and menu price. Bottle Beer requires
  // container size + case size. Food/Misc just need the basics.
  _requiredFieldIds(cat) {
    const ids = ['ip-name', 'ip-cost'];
    if (cat === 'Bottle Beer') {
      ids.push('ip-size', 'ip-case-size');
    } else if (this.isPourable(cat)) {
      ids.push('ip-size', 'ip-pour', 'ip-price');
    }
    return ids;
  },
  // Value check: is a given input "filled"? Handles the size dropdown's
  // "custom" option by also checking the linked custom-oz input.
  _isFilled(id) {
    const el = document.getElementById(id);
    if (!el) return true; // not rendered in this category — not required
    const v = (el.value || '').trim();
    if (!v) return false;
    // Size dropdown: if value is "custom", the actual size lives in ip-coz
    if (id === 'ip-size' && v === 'custom') {
      const cozEl = document.getElementById('ip-coz');
      return !!(cozEl && parseFloat(cozEl.value) > 0);
    }
    // For numeric inputs, zero counts as not-filled
    if (el.type === 'number') return parseFloat(v) > 0;
    return true;
  },
  applyMissingFieldHighlights(cat) {
    const ids = this._requiredFieldIds(cat);
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const wrap = el.closest('.f');
      if (!wrap) return;
      if (!this._isFilled(id)) wrap.classList.add('field-missing');
      else wrap.classList.remove('field-missing');
    });
  },

  _wireForm() {
    document.getElementById('ip-cancel')?.addEventListener('click', () => { App.closeModal('ip-form-modal'); this.renderLanding(); });
    document.getElementById('ip-save')?.addEventListener('click', () => this.save());
    document.getElementById('ip-name')?.focus();

    document.getElementById('ip-size')?.addEventListener('change', () => {
      const cw = document.getElementById('ip-cw');
      if (cw) cw.style.display = document.getElementById('ip-size').value === 'custom' ? '' : 'none';
      this.calcProduct();
      this._refreshMissing();
    });
    document.getElementById('ip-unit')?.addEventListener('change', () => {
      const uw = document.getElementById('ip-uw');
      if (uw) uw.style.display = document.getElementById('ip-unit').value === 'custom' ? '' : 'none';
    });
    ['ip-coz','ip-pour','ip-cost','ip-price','ip-case-size'].forEach(fid =>
      document.getElementById(fid)?.addEventListener('input', () => { this.calcProduct(); this._refreshMissing(); })
    );
    // Resale block (Food / Misc): toggle the menu-price fields + live cost/serving.
    document.getElementById('ip-sold')?.addEventListener('change', e => {
      const box = document.getElementById('ip-resale');
      if (box) box.style.display = e.target.checked ? '' : 'none';
      this._calcResale();
    });
    ['ip-cost','ip-price','ip-servings'].forEach(fid =>
      document.getElementById(fid)?.addEventListener('input', () => this._calcResale()));
    // Field-missing refresh on the other required inputs
    ['ip-name', 'ip-vendor', 'ip-loc1'].forEach(fid =>
      document.getElementById(fid)?.addEventListener('input', () => this._refreshMissing())
    );
    document.getElementById('ip-vendor')?.addEventListener('change', () => this._refreshMissing());
    document.getElementById('ip-loc1')?.addEventListener('change', () => this._refreshMissing());

    // Edit mode: status toggle. Flips the visual state and updates the
    // button label. Save reads the toggled state via the badge's data-active
    // attribute, so the operator commits the change by clicking Update.
    document.getElementById('ip-toggle-active')?.addEventListener('click', () => {
      const el = document.querySelector('.ip-active-state');
      if (!el) return;
      const nowActive = !(el.dataset.active === 'true');
      el.dataset.active = nowActive ? 'true' : 'false';
      el.style.background = nowActive ? 'rgba(125,199,125,0.12)' : 'rgba(199,125,125,0.12)';
      el.style.color = nowActive ? 'var(--green)' : 'var(--red)';
      el.innerHTML = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;"></span>' + (nowActive ? 'ACTIVE' : 'HIDDEN');
      document.getElementById('ip-toggle-active').textContent = nowActive ? 'Hide from operations' : 'Make active';
    });

    // Other sizes sold: wire existing rows + the add button.
    document.querySelectorAll('.vss-row').forEach(r => this._wireServingRow(r));
    document.getElementById('vss-add')?.addEventListener('click', () => {
      const list = document.getElementById('vss-list');
      if (!list) return;
      const holder = document.createElement('div');
      holder.innerHTML = this.servingRowHTML({}, list.children.length);
      const row = holder.firstElementChild;
      list.appendChild(row);
      this._wireServingRow(row);
      row.querySelector('.vss-label')?.focus();
    });

    if (this.editId) this.calcProduct();

    // On render: if we're editing an existing product, highlight required-
    // but-empty fields so the operator sees what's missing at a glance.
    if (this._editingIncomplete) {
      this.applyMissingFieldHighlights(this._formCategory || '');
    }
  },

  _refreshMissing() {
    if (!this._editingIncomplete) return;
    this.applyMissingFieldHighlights(this._formCategory || '');
  },

  getOz() {
    const v = document.getElementById('ip-size')?.value;
    if (!v || v === '') return 0;
    if (v === 'custom') return parseFloat(document.getElementById('ip-coz')?.value) || 0;
    return parseFloat(v) || 0;
  },

  getUnitType() {
    const u = document.getElementById('ip-unit')?.value;
    if (!u) return null;
    if (u === 'custom') return (document.getElementById('ip-unit-custom')?.value.trim() || null);
    return u;
  },

  // Sub-Category value: the picked option (including the "Other" catch-all).
  getSubcat() {
    const sel = document.getElementById('ip-subcat-sel');
    return sel ? sel.value : (document.getElementById('ip-subcat')?.value.trim() || '');
  },

  // Cost per menu serving for a resale item = purchase cost / servings per unit.
  _resaleCps(cost, servings) {
    const c = parseFloat(cost) || 0;
    const n = parseFloat(servings);
    return (n && n > 0) ? c / n : c;
  },
  _calcResale() {
    const el = document.getElementById('ip-cps');
    if (!el) return;
    const cps = this._resaleCps(document.getElementById('ip-cost')?.value, document.getElementById('ip-servings')?.value);
    el.textContent = cps > 0 ? App.fmtCurrency(cps) : '-';
  },

  // Per-bottle cost from the form. For Bottle Beer with case_size > 0, the
  // cost field is per-case so divide. Otherwise pass through.
  effectiveBottleCost() {
    const cost = parseFloat(document.getElementById('ip-cost')?.value) || 0;
    if (this._formCategory === 'Bottle Beer') {
      const cs = parseInt(document.getElementById('ip-case-size')?.value) || 0;
      if (cs > 0) return cost / cs;
    }
    return cost;
  },

  calcProduct() {
    const spec = this.FORM_SPEC[this._formCategory] || {};
    if (!spec.showCalcStrip) return;
    const oz    = this.getOz();
    const pour  = parseFloat(document.getElementById('ip-pour')?.value) || 0;
    const cost  = this.effectiveBottleCost();
    const price = parseFloat(document.getElementById('ip-price')?.value) || 0;
    const target = App.data?.settings?.targets?.bar_pour_cost_pct || 22;
    const pours = pour > 0 ? oz / pour : null;
    const cpp   = pours ? cost / pours : null;
    const pct   = cpp && price ? cpp / price * 100 : null;
    const set   = (id, val, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = val; el.className = 'calc-val' + (cls ? ' ' + cls : ''); };

    if (this._formCategory === 'Bottle Beer') {
      // Bottle Beer slots: Btls/Case · Cost/Btl · Pour Cost %
      const cs = parseInt(document.getElementById('ip-case-size')?.value) || 0;
      const cb = cs > 0 ? (parseFloat(document.getElementById('ip-cost')?.value) / cs) : null;
      const pct = cb && price ? cb / price * 100 : null;
      set('ip-pours', cs > 0 ? cs.toString() : '-');
      set('ip-cpp',   cb ? App.fmtCurrency(cb) : '-');
      set('ip-pct',   pct ? App.fmtPct(pct) : '-', pct ? (pct > target ? 'warn' : 'good') : '');
      return;
    }
    set('ip-pours', pours ? pours.toFixed(1) : '-');
    set('ip-cpp',   cpp   ? App.fmtCurrency(cpp) : '-');
    set('ip-pct',   pct   ? App.fmtPct(pct) : '-', pct ? (pct > target ? 'warn' : 'good') : '');
    this.recalcAllServing();
  },

  // ── Other sizes sold (serving sizes) ────────────────────────────────────────
  // The standard pour/price lives in the row above. These are the OTHER ways the
  // same bottle/keg sells: a pitcher, a happy hour pour, a whole bottle of wine.
  // Each carries its own price and shows its own pour cost, because a discounted
  // size is a thinner margin. The shelf is still one counted pool; this only
  // captures the extra price points so each size reads an honest pour cost.
  servingSizesBlockHTML(p, spec) {
    const sizes = Array.isArray(p?.serving_sizes) ? p.serving_sizes : [];
    const rows = sizes.map((s, i) => this.servingRowHTML(s, i)).join('');
    return '<div style="margin-top:18px;border-top:1px solid var(--b2);padding-top:14px;">'
      + '<div style="display:flex;align-items:center;gap:14px;margin-bottom:10px;">'
        + '<label style="margin:0;">Other Sizes Sold</label>'
        + '<button type="button" class="btn btn-ghost btn-sm" id="vss-add">+ Add a size</button>'
      + '</div>'
      + '<div id="vss-list">' + rows + '</div></div>';
  },
  servingRowHTML(s, i) {
    s = s || {};
    const spec = this.FORM_SPEC[this._formCategory] || {};
    const ph = spec.servingPlaceholder || 'Pitcher, Bottle...';
    return '<div class="vss-row" style="display:flex;gap:10px;align-items:flex-end;margin-bottom:8px;flex-wrap:wrap;">'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Name</label>'
      + '<input type="text" class="vss-label" value="' + esc(s.label || '') + '" placeholder="' + esc(ph) + '"/></div>'
      + '<div class="f" style="width:90px;flex-shrink:0;"><label>Size</label>'
      + '<div class="fw"><input class="suf vss-size" type="number" step="0.1" min="0" value="' + (s.size_oz != null ? s.size_oz : '') + '"/><span class="suf">oz</span></div></div>'
      + '<div class="f" style="width:100px;flex-shrink:0;"><label>Price</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre vss-price" type="number" step="0.25" min="0" value="' + (s.price != null ? s.price : '') + '"/></div></div>'
      + '<div style="font-size:11px;color:var(--t3);padding-bottom:9px;white-space:nowrap;">Pour cost <span class="vss-pct" style="font-weight:700;color:var(--t1);">-</span></div>'
      + '<button type="button" class="btn btn-ghost btn-sm vss-del" style="margin-bottom:2px;">Remove</button>'
      + '</div>';
  },
  // Pour cost for one serving-size row: (bottle cost / bottle oz) x this size, over this price.
  recalcServingRow(row) {
    if (!row) return;
    const span = row.querySelector('.vss-pct');
    if (!span) return;
    const oz   = this.getOz();
    const cost = this.effectiveBottleCost();
    const size  = parseFloat(row.querySelector('.vss-size')?.value) || 0;
    const price = parseFloat(row.querySelector('.vss-price')?.value) || 0;
    const costPerOz = oz > 0 ? cost / oz : 0;
    const pct = (size > 0 && price > 0 && costPerOz > 0) ? (costPerOz * size) / price * 100 : null;
    const target = App.data?.settings?.targets?.bar_pour_cost_pct || 22;
    span.textContent = pct != null ? App.fmtPct(pct) : '-';
    span.style.color = pct == null ? 'var(--t1)' : (pct > target ? 'var(--red)' : 'var(--green)');
  },
  recalcAllServing() {
    document.querySelectorAll('.vss-row').forEach(r => this.recalcServingRow(r));
  },
  _wireServingRow(row) {
    row.querySelectorAll('.vss-size, .vss-price').forEach(inp =>
      inp.addEventListener('input', () => this.recalcServingRow(row)));
    row.querySelector('.vss-del')?.addEventListener('click', () => row.remove());
    this.recalcServingRow(row);
  },

  // ── Save ──────────────────────────────────────────────────────────────────
  async save() {
    if (this._saving) return;
    this._saving = true;
    setTimeout(() => { this._saving = false; }, 2000);

    const cat = this._formCategory || 'Misc';
    const spec = this.FORM_SPEC[cat] || this.FORM_SPEC['Misc'];
    const name = document.getElementById('ip-name')?.value.trim();
    const err  = document.getElementById('ip-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } this._saving = false; };
    if (!name) { fail('Product name required.'); return; }
    // Guard against duplicate product names (catches inactive products too), the
    // same way Vendors and Locations block duplicates.
    const allProds = (App.inventoryData && App.inventoryData.ic_products) || [];
    if (allProds.find(x => x.id !== this.editId && (x.name || '').trim().toLowerCase() === name.toLowerCase())) {
      fail('A product named "' + name + '" already exists. Use a different name or edit that product.'); return;
    }

    const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };
    const oz    = spec.sizeGroup || spec.showCaseSize ? (this.getOz() || null) : null;
    const pour  = spec.showPour ? num('ip-pour') : null;
    const cost  = num('ip-cost');
    // Resale items (Food / Misc) carry a menu price too — read it from the same
    // ip-price field, gated on the Sold-on-menu checkbox.
    const soldOnMenu = spec.showUnitType ? !!document.getElementById('ip-sold')?.checked : false;
    const servingsPerUnit = soldOnMenu ? (parseInt(document.getElementById('ip-servings')?.value) || 1) : null;
    const price = (spec.showMenuPrice || soldOnMenu) ? num('ip-price') : null;
    const costPerServing = soldOnMenu ? this._resaleCps(cost, servingsPerUnit) : null;
    const pours = oz && pour ? oz / pour : null;
    const effCost = this.effectiveBottleCost();
    const cpp   = pours && effCost != null && effCost > 0 ? effCost / pours : null;
    const pct   = cpp != null && price ? cpp / price * 100 : null;
    const caseSize = spec.showCaseSize
      ? (parseInt(document.getElementById('ip-case-size')?.value) || null)
      : null;
    const unitType = spec.showUnitType ? this.getUnitType() : null;
    // Other sizes sold: each row needs a size and a price to count.
    const servingSizes = [];
    if (spec.showServingSizes) {
      document.querySelectorAll('.vss-row').forEach(r => {
        const sz = parseFloat(r.querySelector('.vss-size')?.value);
        const pr = parseFloat(r.querySelector('.vss-price')?.value);
        if (sz > 0 && pr > 0) servingSizes.push({ label: r.querySelector('.vss-label')?.value.trim() || '', size_oz: sz, price: pr });
      });
    }
    // Status: edit mode reads the badge state, new mode defaults to active.
    const stateEl = document.querySelector('.ip-active-state');
    const active = stateEl ? stateEl.dataset.active === 'true' : true;

    // Primary location is the product's "home" (ordering/transfer default).
    // Any additional locations are managed from the Locations screen; preserve
    // them and make sure the primary is always included in locations[].
    const primaryLoc = document.getElementById('ip-loc1')?.value.trim() || '';
    const existingProd = this.editId ? this.products().find(x => x.id === this.editId) : null;
    const locSet = new Set(existingProd && Array.isArray(existingProd.locations) ? existingProd.locations : []);
    if (primaryLoc) locSet.add(primaryLoc);
    const locsArr = [...locSet];
    // First location placed is the ordering/transfer home. Never leave a product
    // with locations but no valid primary, or it skips the "Needs a location" flag.
    let primary = primaryLoc;
    if (!primary || !locsArr.includes(primary)) primary = locsArr[0] || '';

    const prod = {
      id:                  this.editId || App.uid(),
      name,
      brand:               document.getElementById('ip-brand')?.value.trim() || '',
      category:            cat,
      sub_category:        this.getSubcat(),
      misc_type:           cat === 'Misc' ? (document.getElementById('ip-misctype')?.value || '') : '',
      vendor:              document.getElementById('ip-vendor')?.value.trim() || '',
      container_size_oz:   oz,
      case_size:           caseSize,
      pour_size_oz:        pour,
      unit_type:           unitType,
      unit_cost:           cost,
      menu_price:          price,
      sold_on_menu:        soldOnMenu,
      servings_per_unit:   servingsPerUnit,
      cost_per_serving:    costPerServing,
      par_level:           num('ip-par'),
      reorder_point:       num('ip-reorder'),
      locations:           locsArr,
      primary_location:    primary,
      active,
      notes:               document.getElementById('ip-notes')?.value.trim() || '',
      pours_per_container: pours,
      cost_per_pour:       cpp,
      pour_cost_pct:       pct,
      serving_sizes:       servingSizes
    };

    const list = this.products();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...prod };
    } else {
      prod.created_at = new Date().toISOString();
      list.push(prod);
    }

    const btn = document.getElementById('ip-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    const ok = await App.saveInventory();
    this._saving = false;
    this.editId = null;
    this._formCategory = null;
    if (ok) {
      App.markSetupDone('gs_ic_products');
      this.activeCat = prod.category;
      App.closeModal('ip-form-modal');
      this.renderLanding();
    } else if (btn) {
      btn.disabled = false;
      btn.textContent = 'Save';
      if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; }
    }
  },

  // ── Delete ────────────────────────────────────────────────────────────────
  async confirmDel(ids, msg) {
    if (!ids.length) return;
    if (!(await App.confirmDelete(ids.length > 1 ? ids.length + ' products' : null))) return;
    App.inventoryData.ic_products = this.products().filter(p => !ids.includes(p.id));
    if (this._selected) ids.forEach(id => this._selected.delete(id));
    await App.saveInventory();
    this.renderLanding();
  },

  // ── Bulk edit (set the same field across many selected products) ─────────────
  // After an upload you often need one value on a whole category (a 1.5 oz pour
  // on every liquor, one vendor or location across a list). Selection is scoped
  // to the active category tab, so the form shows that category's exact fields.
  // Only fields whose Apply box is checked are written; everything else stays.

  // The bulk-applicable fields per category (cost stays out — it is per-product).
  bulkFieldDefs(cat, spec) {
    const defs = [];
    if (spec.sizeGroup || spec.showCaseSize) defs.push({ key: 'size', label: spec.sizeLabel || 'Size', type: 'size' });
    if (spec.showPour)      defs.push({ key: 'pour', label: spec.pourLabel || 'Pour Size', type: 'oz' });
    if (spec.showCaseSize)  defs.push({ key: 'case', label: 'Case Size', type: 'int', suffix: 'btl' });
    if (spec.showUnitType)  defs.push({ key: 'unit', label: 'Unit Type', type: 'unit' });
    if (spec.showMenuPrice) defs.push({ key: 'price', label: 'Menu Price', type: 'money' });
    if (cat === 'Misc') defs.push({ key: 'misctype', label: 'Misc Type', type: 'misctype' });
    else                defs.push({ key: 'subcat',   label: 'Sub-Category', type: 'subcat' });
    defs.push({ key: 'vendor',  label: 'Primary Vendor',   type: 'vendor' });
    defs.push({ key: 'loc',     label: 'Primary Location', type: 'location' });
    defs.push({ key: 'par',     label: 'Par' + (spec.parUnit ? ' (' + spec.parUnit + ')' : ''),     type: 'int' });
    defs.push({ key: 'reorder', label: 'Reorder' + (spec.parUnit ? ' (' + spec.parUnit + ')' : ''), type: 'int' });
    return defs;
  },

  bulkInputHTML(def, spec, cat) {
    const k = def.key;
    if (def.type === 'subcat') {
      const opts = (App.subcatSuggestions(cat) || []).filter(o => o.toLowerCase() !== 'other');
      return '<select id="be-subcat" class="be-input" data-key="subcat"><option value="">Select...</option>'
        + opts.map(o => '<option>' + esc(o) + '</option>').join('')
        + '<option>Other</option></select>';
    }
    if (def.type === 'misctype') {
      return '<select id="be-misctype" class="be-input" data-key="misctype"><option value="">Select...</option>'
        + (App.MISC_TYPES || []).map(t => '<option>' + esc(t) + '</option>').join('')
        + '</select>';
    }
    if (def.type === 'size') {
      return '<select id="be-size" class="be-input" data-key="size">' + this.sizeOpts(null, spec.sizeGroup) + '</select>'
        + '<div id="be-cw" style="display:none;margin-top:6px;"><div class="fw"><input class="suf be-input" type="number" id="be-coz" step="0.1" data-key="size"/><span class="suf">oz</span></div></div>';
    }
    if (def.type === 'oz')   return '<div class="fw"><input class="suf be-input" type="number" id="be-' + k + '" step="0.25" data-key="' + k + '"/><span class="suf">oz</span></div>';
    if (def.type === 'money') return '<div class="fw"><span class="pre">$</span><input class="pre be-input" type="number" id="be-' + k + '" step="0.25" data-key="' + k + '" placeholder="0.00"/></div>';
    if (def.type === 'int') {
      return def.suffix
        ? '<div class="fw"><input class="suf be-input" type="number" id="be-' + k + '" step="1" min="0" data-key="' + k + '"/><span class="suf">' + esc(def.suffix) + '</span></div>'
        : '<input type="number" class="be-input" id="be-' + k + '" step="1" min="0" data-key="' + k + '"/>';
    }
    if (def.type === 'unit') {
      let opts = '<option value="">Select unit...</option>';
      this.UNIT_TYPES.forEach(u => { opts += '<option value="' + u + '">' + u + '</option>'; });
      opts += '<option value="custom">Custom (type one)</option>';
      return '<select id="be-unit" class="be-input" data-key="unit">' + opts + '</select>'
        + '<div id="be-uw" style="display:none;margin-top:6px;"><input type="text" class="be-input" id="be-unit-custom" placeholder="gal, dozen, etc." data-key="unit"/></div>';
    }
    if (def.type === 'vendor')   return '<select id="be-vendor" class="be-input" data-key="vendor">' + this.vendorOpts(null) + '</select>';
    if (def.type === 'location') return '<select id="be-loc" class="be-input" data-key="loc">' + this.locationOpts(null) + '</select>';
    return '';
  },

  openBulkEdit() {
    const ids = [...(this._selected || [])];
    if (!ids.length) return;
    const cat = this.activeCat;
    const spec = this.FORM_SPEC[cat] || this.FORM_SPEC['Misc'];
    const n = ids.length;
    const fieldsHTML = this.bulkFieldDefs(cat, spec).map(def =>
      '<div class="f">'
      + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">'
        + '<input type="checkbox" class="bc-check be-apply" data-key="' + def.key + '"/>'
        + '<span>' + esc(def.label) + '</span>'
      + '</label>'
      + this.bulkInputHTML(def, spec, cat)
      + '</div>').join('');
    const body = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">Bulk Edit ' + n + ' ' + esc(cat) + ' Product' + (n === 1 ? '' : 's') + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px 18px;">' + fieldsHTML + '</div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="be-apply-btn">Apply to ' + n + ' Product' + (n === 1 ? '' : 's') + '</button>'
        + '<button class="btn btn-ghost" id="be-cancel">Cancel</button>'
        + '<span id="be-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
    + '</div>';
    App.openModal(body, { id: 'ip-bulk-modal', layer: 9000, maxWidth: 640, noClose: true });
    this._wireBulk(cat, spec, ids);
  },

  _wireBulk(cat, spec, ids) {
    document.getElementById('be-cancel')?.addEventListener('click', () => App.closeModal('ip-bulk-modal'));
    document.getElementById('be-apply-btn')?.addEventListener('click', () => this.applyBulk(ids));
    document.getElementById('be-size')?.addEventListener('change', e => {
      const cw = document.getElementById('be-cw'); if (cw) cw.style.display = e.target.value === 'custom' ? '' : 'none';
    });
    document.getElementById('be-unit')?.addEventListener('change', e => {
      const uw = document.getElementById('be-uw'); if (uw) uw.style.display = e.target.value === 'custom' ? '' : 'none';
    });
    // Touching a field auto-checks its Apply box (automate the obvious step).
    document.querySelectorAll('.be-input').forEach(inp => {
      inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
        const box = document.querySelector('.be-apply[data-key="' + inp.dataset.key + '"]');
        if (box) box.checked = true;
      });
    });
  },

  async applyBulk(ids) {
    const applied = {};
    document.querySelectorAll('.be-apply').forEach(box => { if (box.checked) applied[box.dataset.key] = true; });
    const err = document.getElementById('be-err');
    if (!Object.keys(applied).length) {
      if (err) { err.textContent = 'Turn on a field to apply, or Cancel.'; err.style.display = 'inline'; }
      return;
    }
    const num = id => { const el = document.getElementById(id); if (!el) return null; const n = parseFloat(el.value); return isNaN(n) ? null : n; };
    const intVal = id => { const el = document.getElementById(id); if (!el) return null; const n = parseInt(el.value); return isNaN(n) ? null : n; };
    const getSize = () => {
      const v = document.getElementById('be-size')?.value;
      if (v === 'custom') return num('be-coz');
      const n = parseFloat(v); return isNaN(n) ? null : n;
    };
    const getUnit = () => {
      const v = document.getElementById('be-unit')?.value;
      if (v === 'custom') return (document.getElementById('be-unit-custom')?.value || '').trim() || null;
      return v || null;
    };
    const idSet = new Set(ids);
    this.products().forEach(p => {
      if (!idSet.has(p.id)) return;
      if (applied.size)    p.container_size_oz = getSize();
      if (applied.pour)    p.pour_size_oz = num('be-pour');
      if (applied.case)    p.case_size = intVal('be-case');
      if (applied.unit)    p.unit_type = getUnit();
      if (applied.price)   p.menu_price = num('be-price');
      if (applied.subcat)   p.sub_category = (document.getElementById('be-subcat')?.value || '');
      if (applied.misctype) p.misc_type = (document.getElementById('be-misctype')?.value || '');
      if (applied.vendor)  p.vendor = (document.getElementById('be-vendor')?.value || '').trim();
      if (applied.loc) {
        const locVal = (document.getElementById('be-loc')?.value || '').trim();
        const locSet = new Set(Array.isArray(p.locations) ? p.locations : []);
        if (locVal) locSet.add(locVal);
        p.locations = [...locSet];
        let primary = locVal;
        if (!primary || !p.locations.includes(primary)) primary = p.locations[0] || '';
        p.primary_location = primary;
      }
      if (applied.par)     p.par_level = num('be-par');
      if (applied.reorder) p.reorder_point = num('be-reorder');
      this.recomputeDerived(p);
    });
    const btn = document.getElementById('be-apply-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Applying...'; }
    const ok = await App.saveInventory();
    if (ok) {
      App.closeModal('ip-bulk-modal');
      this._selected = new Set();
      this.renderLanding();
    } else if (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Apply to ' + ids.length + ' Product' + (ids.length === 1 ? '' : 's'); }
      err.textContent = 'Save failed. Try again.'; err.style.display = 'inline';
    }
  },

  // Recompute a product's derived fields from its own values, matching save() and
  // runImport() exactly (bottle beer divides the cost-per-case by case size; a
  // non-pourable item has no pour, so its pour-based figures stay null).
  recomputeDerived(p) {
    const oz = p.container_size_oz || 0;
    const pour = p.pour_size_oz || 0;
    const price = p.menu_price || 0;
    let effCost = p.unit_cost;
    if (p.category === 'Bottle Beer' && p.case_size > 0 && p.unit_cost != null) effCost = p.unit_cost / p.case_size;
    const pours = oz && pour ? oz / pour : null;
    const cpp = pours && effCost != null && effCost > 0 ? effCost / pours : null;
    const pct = cpp != null && price ? cpp / price * 100 : null;
    p.pours_per_container = pours;
    p.cost_per_pour = cpp;
    p.pour_cost_pct = pct;
  },

  // ── Import (category-scoped CSV / Excel with column mapping) ──────────────
  // Each category card has its own Import link. The category is locked at
  // import time so the mapping schema can include only category-relevant
  // columns (Case Size for Bottle Beer, Keg Size for Draft, Unit Type for
  // Food and Misc) and we never compute cost_per_pour with the wrong divisor.

  // Category-specific column maps. Each category gets only the fields that
  // actually live on its form so the operator is not picking columns for
  // fields that will be ignored.
  importFieldsForCategory(cat) {
    const COMMON = [
      {key:'name',          label:'Product Name',  required:true,  aliases:['name','item','product','description','item name','product name']},
      {key:'brand',         label:'Brand',         required:false, aliases:['brand','make','label']},
      {key:'sub_category',  label:'Sub-Category',  required:false, aliases:['sub-category','subcategory','sub category','subtype','type']},
      {key:'vendor',        label:'Primary Vendor',required:false, aliases:['vendor','supplier','distributor','source']},
      {key:'unit_cost',     label:'Unit Cost ($)', required:false, aliases:['cost','unit cost','cogs','item cost','wholesale','price paid']},
    ];
    if (cat === 'Liquor' || cat === 'Wine') {
      return COMMON.concat([
        {key:'container_size_oz',label:'Bottle Size (oz)', required:false, aliases:['size','bottle size','container','volume','oz','ounces']},
        {key:'pour_size_oz',     label:'Pour Size (oz)',   required:false, aliases:['pour','pour size','standard pour','std pour']},
        {key:'menu_price',       label:'Menu Price ($)',   required:false, aliases:['price','menu price','sell price','retail','selling price']},
        {key:'par_level',        label:'Par (bottles)',    required:false, aliases:['par','par level','target stock']},
        {key:'reorder_point',    label:'Reorder Point (bottles)', required:false, aliases:['reorder','reorder point','min','minimum']},
      ]);
    }
    if (cat === 'Bottle Beer') {
      return COMMON.map(f => f.key === 'unit_cost' ? {...f, label:'Cost per Case ($)'} : f).concat([
        {key:'container_size_oz',label:'Bottle Size (oz)', required:false, aliases:['size','bottle size','container','volume','oz','ounces']},
        {key:'case_size',        label:'Case Size (bottles per case)', required:false, aliases:['case','case size','case pack','pack','bottles per case','pack size','units per case']},
        {key:'menu_price',       label:'Menu Price ($ per bottle)', required:false, aliases:['price','menu price','sell price','retail']},
        {key:'par_level',        label:'Par (cases)',      required:false, aliases:['par','par level','target stock']},
        {key:'reorder_point',    label:'Reorder Point (cases)', required:false, aliases:['reorder','reorder point','min','minimum']},
      ]);
    }
    if (cat === 'Draft Beer') {
      return COMMON.map(f => f.key === 'unit_cost' ? {...f, label:'Cost per Keg ($)'} : f).concat([
        {key:'container_size_oz',label:'Keg Size (oz)',   required:false, aliases:['size','keg','keg size','volume','oz','ounces']},
        {key:'pour_size_oz',     label:'Pour Size (oz)',  required:false, aliases:['pour','pour size','standard pour','std pour']},
        {key:'menu_price',       label:'Menu Price ($)',  required:false, aliases:['price','menu price','sell price','retail']},
        {key:'par_level',        label:'Par (kegs)',      required:false, aliases:['par','par level','target stock']},
        {key:'reorder_point',    label:'Reorder Point (kegs)', required:false, aliases:['reorder','reorder point','min','minimum']},
      ]);
    }
    const tail = [
      {key:'unit_type',         label:'Unit Type (lb / case / each / ...)', required:false, aliases:['unit','unit type','uom','unit of measure','measure']},
      {key:'menu_price',        label:'Menu Price ($, if sold as-is)', required:false, aliases:['price','menu price','sell price','retail','selling price']},
      {key:'servings_per_unit', label:'Servings per Unit (if sold as-is)', required:false, aliases:['servings','servings per unit','units per','per unit','yield','pack','pack size']},
      {key:'par_level',         label:'Par Level',     required:false, aliases:['par','par level','target stock']},
      {key:'reorder_point',     label:'Reorder Point', required:false, aliases:['reorder','reorder point','min','minimum']},
    ];
    if (cat === 'Misc') {
      // Misc swaps free-text Sub-Category for the structured Misc Type tag.
      return COMMON.filter(f => f.key !== 'sub_category').concat([
        {key:'misc_type', label:'Misc Type (NA Beverage / Drink Mixer / Food Ingredient / supply)', required:false, aliases:['misc type','type','group','category','sub-category','subcategory','sub category']},
      ], tail);
    }
    // Food
    return COMMON.concat(tail);
  },

  // In-place import panel rendered in the landing's lower area. Two stages:
  // 'drop' (drag-drop / browse zone) then 'mapper' (column matching) — same
  // spot, no page change. Wired in wireLanding().
  // The upload uses the shared CSVMapper (drop -> Map Your Columns -> preview ->
  // Import), mounted in wireLanding, so it matches every other import in the app.
  importPanelHTML() {
    const cat = this._import.cat;
    const spec = this.FORM_SPEC[cat] || {};
    return '<div class="card form-card">'
      + '<div class="card-title">Upload ' + esc(spec.title || cat) + ' Product List</div>'
      + '<div id="ip-csv"></div>'
      + '</div>'
      + '<div id="ip-csv-actions" class="no-print" style="margin:16px 0 24px;"></div>'
      + '<div id="ip-imp-cancel-row" class="no-print" style="margin:0 0 24px;"><button type="button" class="btn btn-ghost" id="ip-imp-cancel">Cancel</button></div>';
  },

  // CSVMapper hands back rows already keyed by field (name, unit_cost, ...). Build
  // a product per row with the same category-specific cost math the form uses.
  async runImport(rows) {
    rows = rows || [];
    const cat = this._formCategory || 'Liquor';
    const spec = this.FORM_SPEC[cat];
    const val = (row, k) => String(row[k] != null ? row[k] : '').trim();
    const numOf = str => { if (str == null || str === '') return null; const n = parseFloat(String(str).replace(/[^0-9.]/g, '')); return isNaN(n) ? null : n; };
    // Snap an imported Misc Type to a known tag (case-insensitive); an unknown
    // value is kept as typed and simply behaves as a recipe ingredient.
    const normMiscType = v => { const s = (v || '').trim().toLowerCase(); return (App.MISC_TYPES || []).find(t => t.toLowerCase() === s) || (v || '').trim(); };
    const note = (txt, color) => { const a = document.getElementById('ip-csv-actions'); if (a) a.insertAdjacentHTML('beforeend', '<span style="color:' + (color || 'var(--red)') + ';font-size:12px;margin-left:10px;">' + esc(txt) + '</span>'); };

    const imported = [];
    rows.forEach(row => {
      const name = val(row, 'name');
      if (!name) return;
      const oz   = numOf(val(row, 'container_size_oz'));
      const pour = spec.showPour ? numOf(val(row, 'pour_size_oz')) : null;
      const cost = numOf(val(row, 'unit_cost'));
      // Menu price + servings come in for resale Food/Misc as well as pourables.
      const price = (spec.showMenuPrice || spec.showUnitType) ? numOf(val(row, 'menu_price')) : null;
      const soldOnMenu = spec.showUnitType && price != null && price > 0;
      const servingsPerUnit = soldOnMenu ? (parseInt(val(row, 'servings_per_unit')) || 1) : null;
      const costPerServing = soldOnMenu ? this._resaleCps(cost, servingsPerUnit) : null;
      const caseSize = spec.showCaseSize ? (parseInt(val(row, 'case_size')) || null) : null;
      const unitType = spec.showUnitType ? (val(row, 'unit_type').toLowerCase() || spec.defaultUnitType) : null;
      const pours = oz && pour ? oz / pour : null;
      // Per-bottle cost (divides by case_size for Bottle Beer when set).
      const perBottle = (cat === 'Bottle Beer' && caseSize && caseSize > 0)
        ? (cost != null ? cost / caseSize : null)
        : cost;
      const cpp = pours && perBottle != null ? perBottle / pours : null;
      const pct = cpp != null && price ? cpp / price * 100 : null;
      imported.push({
        id:                  App.uid(),
        name,
        brand:               val(row, 'brand'),
        category:            cat,
        sub_category:        cat === 'Misc' ? '' : val(row, 'sub_category'),
        misc_type:           cat === 'Misc' ? normMiscType(val(row, 'misc_type')) : '',
        vendor:              val(row, 'vendor'),
        container_size_oz:   oz,
        case_size:           caseSize,
        pour_size_oz:        pour,
        unit_type:           unitType,
        unit_cost:           cost,
        menu_price:          price,
        sold_on_menu:        soldOnMenu,
        servings_per_unit:   servingsPerUnit,
        cost_per_serving:    costPerServing,
        par_level:           numOf(val(row, 'par_level')),
        reorder_point:       numOf(val(row, 'reorder_point')),
        primary_location:    '',
        active:              true,
        notes:               '',
        pours_per_container: pours,
        cost_per_pour:       cpp,
        pour_cost_pct:       pct,
        created_at:          new Date().toISOString(),
        imported:            true
      });
    });

    if (!imported.length) { note('No rows with a product name were found.'); return; }

    this.products().push(...imported);
    const ok = await App.saveInventory();
    if (ok) {
      App.markSetupDone('gs_ic_products');
      this.activeCat = cat;
      this.editId = null;
      this._formCategory = null;
      this._import = null;
      this.renderLanding();
    } else {
      note('Save failed. Try again.');
    }
  }
};
