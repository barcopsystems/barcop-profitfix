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

  CATEGORIES: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'],

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
      defaultPour:     1.5,
      costLabel:       'Cost per Bottle',
      costTT:          'ic-cost-per-bottle',
      sizeTT:          'ic-bottle-size',
      pourTT:          'std-pour',
      parUnit:         'btls',
      showMenuPrice:   true,
      showCaseSize:    false,
      showUnitType:    false,
      showCalcStrip:   true
    },
    'Wine': {
      title:           'Wine',
      noun:            'Bottle',
      sizeLabel:       'Bottle Size',
      sizeGroup:       'Wine',
      defaultSize:     25.4,
      showPour:        true,
      defaultPour:     5,
      costLabel:       'Cost per Bottle',
      costTT:          'ic-cost-per-bottle',
      sizeTT:          'ic-bottle-size',
      pourTT:          'std-pour',
      parUnit:         'btls',
      showMenuPrice:   true,
      showCaseSize:    false,
      showUnitType:    false,
      showCalcStrip:   true
    },
    'Bottle Beer': {
      title:           'Bottle Beer',
      noun:            'Case',
      sizeLabel:       'Bottle Size',
      sizeGroup:       'Beer',
      defaultSize:     12,
      showPour:        false,
      costLabel:       'Cost per Case',
      costTT:          'ic-cost-per-case',
      sizeTT:          'ic-bottle-size-beer',
      parUnit:         'cases',
      showMenuPrice:   true,
      showCaseSize:    true,
      defaultCaseSize: 24,
      showUnitType:    false,
      showCalcStrip:   true
    },
    'Draft Beer': {
      title:           'Draft Beer',
      noun:            'Keg',
      sizeLabel:       'Keg Size',
      sizeGroup:       'Draft Keg',
      defaultSize:     1984,
      showPour:        true,
      defaultPour:     16,
      costLabel:       'Cost per Keg',
      costTT:          'ic-cost-per-keg',
      sizeTT:          'ic-keg-size',
      pourTT:          'ic-draft-pour',
      parUnit:         'kegs',
      showMenuPrice:   true,
      showCaseSize:    false,
      showUnitType:    false,
      showCalcStrip:   true
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
      showCalcStrip:   false
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
      showCalcStrip:   false
    }
  },

  // Unit types offered to Food and Misc. Operator can also pick "custom" and
  // type a free-form unit (gal, qt, dozen, etc.) if their item does not fit.
  UNIT_TYPES: ['lb','oz','each','case','bag','gallon','quart','pint','dozen'],

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
    this.renderLanding();
  },

  // ── Landing: six category cards on top, filterable list below ────────────
  renderLanding() {
    const all = this.products();
    const cards = this.CATEGORIES.map(c => {
      const n = all.filter(p => (p.category || '') === c).length;
      const incomplete = all.filter(p => (p.category || '') === c && !this.isComplete(p)).length;
      const badge = incomplete > 0
        ? '<div style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--red);margin-top:6px;">' + incomplete + ' INCOMPLETE</div>'
        : '';
      return '<div class="ip-card" data-cat="' + esc(c) + '" '
        + 'style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:32px 22px 26px;cursor:pointer;text-align:center;transition:border-color 0.15s;">'
        + '<div style="font-size:20px;font-weight:800;color:var(--gold);letter-spacing:0.5px;margin-bottom:8px;">' + esc(c) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);">' + n + ' product' + (n === 1 ? '' : 's') + '</div>'
        + badge
        + '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:22px;">'
          + '<span class="ip-card-add" data-cat="' + esc(c) + '" style="color:var(--gold);font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">+ Add Products</span>'
          + '<button type="button" class="ip-card-imp" data-cat="' + esc(c) + '" style="background:none;border:1px solid var(--b1);border-radius:4px;color:var(--t2);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:5px 11px;cursor:pointer;">Import CSV</button>'
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
    const syncNote = '<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gold);margin:12px 0 14px;">'
      + 'SYNCED TO PROFIT RECOVERY &#10003;'
      + '<span style="color:var(--t3);font-weight:600;letter-spacing:0.5px;"> &nbsp; Bar categories feed Bar Products &middot; Food and Misc feed Kitchen Products</span></div>';

    let body;
    if (prods.length === 0) {
      body = syncNote
        + '<div class="empty"><div class="empty-title">No ' + esc(this.activeCat) + ' products yet</div>'
        + '<div class="empty-sub">Click the ' + esc(this.activeCat) + ' card above to add your first one.</div></div>';
    } else {
      const spec = this.FORM_SPEC[this.activeCat];
      const pourable = this.isPourable(this.activeCat);
      const rows = prods.map(p => {
        const complete = this.isComplete(p);
        const sz  = this.SIZES.find(s => s.oz === p.container_size_oz);
        const szL = p.category === 'Food' || p.category === 'Misc'
          ? esc(p.unit_type || '-')
          : (sz ? sz.l : (p.container_size_oz ? p.container_size_oz + ' oz' : '-'));
        const pc  = p.pour_cost_pct != null ? (p.pour_cost_pct > target ? 'neg' : 'pos') : '';
        const dim = p.active === false ? 'opacity:0.5;' : '';
        const costDisplay = p.unit_cost != null
          ? App.fmtCurrency(p.unit_cost) + (p.category === 'Bottle Beer' ? ' <span style="font-size:9px;color:var(--t3);">/case</span>' : '')
          : '<span style="color:var(--t4);">-</span>';
        return '<tr style="' + dim + '">'
          + '<td style="width:36px;"><input type="checkbox" class="ip-chk" data-id="' + p.id + '" style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/></td>'
          + '<td><div class="val" style="' + (!complete ? 'color:var(--red);' : '') + '">' + esc(p.name)
          + (p.active === false ? ' <span class="badge badge-dim">Inactive</span>' : '') + '</div>'
          + (p.brand ? '<div style="font-size:10px;color:var(--t3);">' + esc(p.brand) + '</div>' : '')
          + (!complete ? '<div style="font-size:10px;color:var(--red);font-weight:600;letter-spacing:0.5px;">Incomplete</div>' : '') + '</td>'
          + '<td>' + esc(p.vendor || '-') + '</td>'
          + '<td>' + esc(szL) + '</td>'
          + '<td>' + (pourable ? (p.pour_size_oz ? p.pour_size_oz + ' oz' : '-') : '<span style="color:var(--t4);">-</span>') + '</td>'
          + '<td>' + costDisplay + '</td>'
          + '<td>' + (pourable && p.cost_per_pour != null ? App.fmtCurrency(p.cost_per_pour) : '<span style="color:var(--t4);">-</span>') + '</td>'
          + '<td class="' + pc + '">' + (pourable && p.pour_cost_pct != null ? App.fmtPct(p.pour_cost_pct) : '<span style="color:var(--t4);">-</span>') + '</td>'
          + '<td>' + (p.par_level != null && p.par_level !== '' ? p.par_level : '<span style="color:var(--t4);">-</span>') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm ip-edit" data-id="' + p.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm ip-del" data-id="' + p.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');

      const alertBar = incompleteHere.length > 0
        ? '<div class="alert-bar" style="margin-bottom:14px;"><div class="alert-text">'
          + incompleteHere.length + ' product' + (incompleteHere.length > 1 ? 's have' : ' has')
          + ' incomplete data, highlighted red in the Product column.</div></div>'
        : '';

      const sizeCol = (this.activeCat === 'Food' || this.activeCat === 'Misc') ? 'Unit' : (spec && spec.sizeLabel) || 'Container';
      const costCol = (spec && spec.costLabel) || 'Cost';

      body = syncNote + alertBar
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
        + '<button class="btn btn-ghost btn-sm" id="ip-sel-all">Select All</button>'
        + '<button class="btn btn-danger btn-sm" id="ip-del-sel" style="display:none;">Delete Selected</button>'
        + '<span id="ip-sel-count" style="font-size:11px;color:var(--t3);"></span>'
        + '</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th style="width:36px;"></th>'
        + '<th>Product</th><th>Vendor</th><th>' + esc(sizeCol) + '</th><th>Pour</th>'
        + '<th>' + esc(costCol) + '</th><th>Cost/Pour</th><th>Pour Cost %</th><th>Par</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="ip-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div id="ip-del-msg" style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this product?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="ip-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="ip-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + cardsBlock + tabs + body + '</div>' + modal;
    this.wireLanding();
  },

  catTabs() {
    const all = this.products();
    return '<div style="display:flex;gap:2px;border-bottom:1px solid var(--b2);margin-bottom:0;flex-wrap:wrap;">'
      + this.CATEGORIES.map(c => {
          const n = all.filter(p => (p.category || '') === c).length;
          const on = c === this.activeCat;
          return '<button class="ic-tab" data-cat="' + esc(c) + '" style="background:none;border:none;'
            + 'border-bottom:2px solid ' + (on ? 'var(--gold)' : 'transparent') + ';'
            + 'color:' + (on ? 'var(--gold)' : 'var(--t3)') + ';font-size:11px;font-weight:700;'
            + 'letter-spacing:0.5px;text-transform:uppercase;padding:9px 14px;cursor:pointer;">'
            + esc(c) + (n ? ' <span style="opacity:0.55;">' + n + '</span>' : '') + '</button>';
        }).join('')
      + '</div>';
  },

  wireLanding() {
    this.container.onclick = ev => {
      const addLink = ev.target.closest('.ip-card-add');
      const impLink = ev.target.closest('.ip-card-imp');
      const card    = ev.target.closest('.ip-card');
      const tab     = ev.target.closest('.ic-tab');
      const edit    = ev.target.closest('.ip-edit');
      const del     = ev.target.closest('.ip-del');

      if (addLink) { ev.stopPropagation(); this.showForm(addLink.dataset.cat); return; }
      if (impLink) { ev.stopPropagation(); this.showImport(impLink.dataset.cat); return; }
      if (card)    { ev.stopPropagation(); this.showForm(card.dataset.cat); return; }
      if (tab)     { ev.stopPropagation(); this.activeCat = tab.dataset.cat; this.renderLanding(); return; }
      if (edit)    { ev.stopPropagation(); this.showFormForId(edit.dataset.id); return; }
      if (del)     { ev.stopPropagation(); this.confirmDel([del.dataset.id], 'Delete this product?'); return; }
    };

    const updateSel = () => {
      const checked = this.container.querySelectorAll('.ip-chk:checked');
      const btn = document.getElementById('ip-del-sel');
      const cnt = document.getElementById('ip-sel-count');
      if (btn) btn.style.display = checked.length > 0 ? '' : 'none';
      if (cnt) cnt.textContent   = checked.length > 0 ? checked.length + ' selected' : '';
    };
    this.container.addEventListener('change', ev => {
      if (ev.target.classList.contains('ip-chk')) updateSel();
    });
    document.getElementById('ip-sel-all')?.addEventListener('click', () => {
      const chks = document.querySelectorAll('.ip-chk');
      const allChecked = [...chks].every(c => c.checked);
      chks.forEach(c => { c.checked = !allChecked; });
      updateSel();
    });
    document.getElementById('ip-del-sel')?.addEventListener('click', () => {
      const ids = [...document.querySelectorAll('.ip-chk:checked')].map(c => c.dataset.id);
      if (!ids.length) return;
      this.confirmDel(ids, 'Delete ' + ids.length + ' product' + (ids.length > 1 ? 's' : '') + '?');
    });
  },

  // ── Form ──────────────────────────────────────────────────────────────────
  // Track whether the form is being opened to EDIT an existing product
  // (id provided) vs ADD a new one. Drives field-missing highlights —
  // we only show them on edit, since a fresh form is empty by definition.
  _setEditFlag(id) { this._editingExistingProduct = !!id; },

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

    // ── Header: title left (white), Back button right ──────────────────────
    let titleHTML;
    if (this.editId) {
      const catOpts = this.CATEGORIES.map(c => '<option value="' + esc(c) + '"' + (c === cat ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
      titleHTML = '<div style="display:flex;align-items:center;gap:10px;text-align:left;">'
        + '<span style="font-size:15px;font-weight:800;color:var(--w);letter-spacing:0.5px;text-transform:uppercase;">Editing</span>'
        + '<select id="ip-edit-cat" style="min-width:160px;">' + catOpts + '</select>'
        + '<span style="font-size:15px;font-weight:800;color:var(--w);letter-spacing:0.5px;text-transform:uppercase;">Product</span>'
        + '</div>';
    } else {
      titleHTML = '<div style="font-size:15px;font-weight:800;color:var(--w);letter-spacing:0.5px;text-transform:uppercase;text-align:left;">New ' + esc(spec.title) + ' Product</div>';
    }

    const statusHTML = this.editId
      ? '<div style="display:flex;align-items:center;gap:10px;margin-top:10px;">'
        + '<span class="ip-active-state" data-active="' + (isActive ? 'true' : 'false') + '" style="'
          + 'display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:1px;'
          + 'background:' + (isActive ? 'rgba(125,199,125,0.12)' : 'rgba(199,125,125,0.12)') + ';'
          + 'color:' + (isActive ? '#7dc77d' : '#c77d7d') + ';">'
          + '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;"></span>'
          + (isActive ? 'ACTIVE' : 'HIDDEN')
        + '</span>'
        + '<button type="button" class="btn btn-ghost btn-sm" id="ip-toggle-active">'
          + (isActive ? 'Hide from operations' : 'Make active')
        + '</button>'
      + '</div>'
      : '';

    const header = '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:14px;">'
      + '<div>'
        + titleHTML
        + statusHTML
      + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="ip-back">&#8592; Back to Products</button>'
    + '</div>';

    // ── Row 1: identity fields (Name, Brand, Sub-Cat, Vendor, Location) ────
    // Grid layout so all five always fit on one row regardless of screen width.
    const row1 = '<div style="display:grid;grid-template-columns:1.6fr 1fr 1fr 1.3fr 1.3fr;gap:14px;align-items:start;">'
      + '<div class="f"><label>Product Name ' + tt('ic-product-name') + '</label>'
      + '<input type="text" id="ip-name" value="' + esc(p?.name || '') + '" placeholder="' + esc(this._namePlaceholder(cat)) + '"/></div>'
      + '<div class="f"><label>Brand ' + tt('ic-brand') + '</label>'
      + '<input type="text" id="ip-brand" value="' + esc(p?.brand || '') + '" placeholder="' + esc(this._brandPlaceholder(cat)) + '"/></div>'
      + '<div class="f"><label>Sub-Category ' + tt('ic-subcategory') + '</label>'
      + '<input type="text" id="ip-subcat" value="' + esc(p?.sub_category || '') + '" placeholder="' + esc(this._subcatPlaceholder(cat)) + '"/></div>'
      + '<div class="f"><label>Primary Vendor ' + tt('ic-primary-vendor') + '</label>'
      + '<select id="ip-vendor">' + this.vendorOpts(p?.vendor) + '</select></div>'
      + '<div class="f"><label>Primary Location ' + tt('ic-primary-location') + '</label>'
      + '<select id="ip-loc1">' + this.locationOpts(p?.primary_location) + '</select></div>'
    + '</div>';

    // ── Row 2: category-specific size/cost/par fields ─────────────────────
    let row2 = '';
    if (spec.sizeGroup && spec.showPour) {
      // Liquor / Wine / Draft Beer
      const isCustom = p?.container_size_oz != null && !this.SIZES.find(s => s.oz === p.container_size_oz);
      const sizeSel = isCustom ? null : (p?.container_size_oz != null ? p.container_size_oz : spec.defaultSize);
      row2 = '<div class="form-row" style="gap:14px;margin-top:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>' + esc(spec.sizeLabel) + ' ' + tt(spec.sizeTT) + '</label>'
        + '<select id="ip-size">' + this.sizeOpts(sizeSel, spec.sizeGroup) + '</select></div>'
        + '<div class="f" id="ip-cw" style="width:90px;flex-shrink:0;' + (isCustom ? '' : 'display:none;') + '"><label>Custom (oz)</label>'
        + '<div class="fw"><input class="suf" type="number" id="ip-coz" value="' + (isCustom ? p.container_size_oz : '') + '" step="0.1"/><span class="suf">oz</span></div></div>'
        + '<div class="f" style="width:90px;flex-shrink:0;"><label>Pour Size ' + tt(spec.pourTT || 'std-pour') + '</label>'
        + '<div class="fw"><input class="suf" type="number" id="ip-pour" value="' + v(p?.pour_size_oz != null ? p.pour_size_oz : spec.defaultPour) + '" step="0.25"/><span class="suf">oz</span></div></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>' + esc(spec.costLabel) + ' ' + tt(spec.costTT) + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-cost" value="' + v(p?.unit_cost) + '" step="0.01" placeholder="0.00"/></div></div>'
        + '<div class="f" style="width:120px;flex-shrink:0;"><label>Menu Price ' + tt('menu-price') + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-price" value="' + v(p?.menu_price) + '" step="0.25" placeholder="0.00"/></div></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Par <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span> ' + tt('ic-par-level') + '</label>'
        + '<input type="number" id="ip-par" value="' + v(p?.par_level) + '" step="1" min="0" placeholder="0"/></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Reorder <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span> ' + tt('ic-reorder-point') + '</label>'
        + '<input type="number" id="ip-reorder" value="' + v(p?.reorder_point) + '" step="1" min="0" placeholder="0"/></div>'
      + '</div>';
    } else if (spec.showCaseSize) {
      // Bottle Beer
      const isCustom = p?.container_size_oz != null && !this.SIZES.find(s => s.oz === p.container_size_oz);
      const sizeSel = isCustom ? null : (p?.container_size_oz != null ? p.container_size_oz : spec.defaultSize);
      row2 = '<div class="form-row" style="gap:14px;margin-top:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>' + esc(spec.sizeLabel) + ' ' + tt(spec.sizeTT) + '</label>'
        + '<select id="ip-size">' + this.sizeOpts(sizeSel, spec.sizeGroup) + '</select></div>'
        + '<div class="f" id="ip-cw" style="width:90px;flex-shrink:0;' + (isCustom ? '' : 'display:none;') + '"><label>Custom (oz)</label>'
        + '<div class="fw"><input class="suf" type="number" id="ip-coz" value="' + (isCustom ? p.container_size_oz : '') + '" step="0.1"/><span class="suf">oz</span></div></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Case Size ' + tt('ic-case-size') + '</label>'
        + '<div class="fw"><input class="suf" type="number" id="ip-case-size" value="' + v(p?.case_size != null ? p.case_size : spec.defaultCaseSize) + '" step="1" min="1"/><span class="suf">btl</span></div></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>' + esc(spec.costLabel) + ' ' + tt(spec.costTT) + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-cost" value="' + v(p?.unit_cost) + '" step="0.01" placeholder="0.00"/></div></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Menu Price <span style="color:var(--t4);font-weight:400;">(per btl)</span> ' + tt('menu-price') + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-price" value="' + v(p?.menu_price) + '" step="0.25" placeholder="0.00"/></div></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Par <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span> ' + tt('ic-par-level') + '</label>'
        + '<input type="number" id="ip-par" value="' + v(p?.par_level) + '" step="1" min="0" placeholder="0"/></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Reorder <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span> ' + tt('ic-reorder-point') + '</label>'
        + '<input type="number" id="ip-reorder" value="' + v(p?.reorder_point) + '" step="1" min="0" placeholder="0"/></div>'
      + '</div>';
    } else if (spec.showUnitType) {
      // Food / Misc
      const ut = p?.unit_type || spec.defaultUnitType;
      const isCustomUnit = ut && !this.UNIT_TYPES.includes(ut);
      row2 = '<div class="form-row" style="gap:14px;margin-top:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Unit Type ' + tt('ic-unit-type') + '</label>'
        + '<select id="ip-unit">' + this.unitTypeOpts(isCustomUnit ? 'custom' : ut) + '</select></div>'
        + '<div class="f" id="ip-uw" style="width:140px;flex-shrink:0;' + (isCustomUnit ? '' : 'display:none;') + '"><label>Custom Unit</label>'
        + '<input type="text" id="ip-unit-custom" value="' + esc(isCustomUnit ? ut : '') + '" placeholder="gal, dozen, etc."/></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>' + esc(spec.costLabel) + ' ' + tt(spec.costTT) + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-cost" value="' + v(p?.unit_cost) + '" step="0.01" placeholder="0.00"/></div></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Par <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span> ' + tt('ic-par-level') + '</label>'
        + '<input type="number" id="ip-par" value="' + v(p?.par_level) + '" step="1" min="0" placeholder="0"/></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Reorder <span style="color:var(--t4);font-weight:400;">(' + spec.parUnit + ')</span> ' + tt('ic-reorder-point') + '</label>'
        + '<input type="number" id="ip-reorder" value="' + v(p?.reorder_point) + '" step="1" min="0" placeholder="0"/></div>'
      + '</div>';
    }

    // ── Calc strip (pourable + bottle beer) ───────────────────────────────
    // For Bottle Beer slots are: Btls/Case, Cost/Btl, Pour Cost %.
    // For everything else: Pours/Container, Cost/Pour, Pour Cost %.
    let calcStrip = '';
    if (spec.showCalcStrip) {
      const slot1Label = spec.showCaseSize ? 'Btls / Case'   : 'Pours / Container';
      const slot1TT    = spec.showCaseSize ? 'ic-bottles-per-case' : 'ic-pours-container';
      const slot2Label = spec.showCaseSize ? 'Cost / Btl'    : 'Cost / Pour';
      const slot2TT    = spec.showCaseSize ? 'ic-cost-per-bottle-calc' : 'cost-pour';
      calcStrip = '<div class="calc" style="margin-top:18px;">'
        + '<div class="calc-item"><div class="calc-label">' + esc(slot1Label) + ' ' + tt(slot1TT) + '</div><div class="calc-val" id="ip-pours">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">' + esc(slot2Label) + ' ' + tt(slot2TT) + '</div><div class="calc-val" id="ip-cpp">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Pour Cost % ' + tt('pour-cost-pct') + '</div><div class="calc-val" id="ip-pct">-</div></div>'
      + '</div>';
    }

    // ── Notes ─────────────────────────────────────────────────────────────
    const notes = '<div class="form-row" style="gap:14px;margin-top:14px;">'
      + '<div class="f" style="width:100%;"><label>Notes ' + tt('ic-notes') + '</label>'
      + '<textarea id="ip-notes" rows="2" placeholder="Optional">' + esc(p?.notes || '') + '</textarea></div>'
    + '</div>';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + header
      + row1
      + row2
      + calcStrip
      + notes
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="ip-save">' + (this.editId ? 'Update' : 'Save') + '</button>'
        + '<button class="btn btn-ghost" id="ip-cancel">Cancel</button>'
        + '<span id="ip-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
    + '</div></div>';

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
  // All categories require name + unit cost. Pourable (Liquor/Wine/Draft
  // Beer) also require container size, pour size, and menu price. Bottle
  // Beer requires container size + case size. Food/Misc just need basics.
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
    document.getElementById('ip-back')?.addEventListener('click', () => this.renderLanding());
    document.getElementById('ip-cancel')?.addEventListener('click', () => this.renderLanding());
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
    // Field-missing refresh on the other required inputs
    ['ip-name', 'ip-vendor', 'ip-loc1'].forEach(fid =>
      document.getElementById(fid)?.addEventListener('input', () => this._refreshMissing())
    );
    document.getElementById('ip-vendor')?.addEventListener('change', () => this._refreshMissing());
    document.getElementById('ip-loc1')?.addEventListener('change', () => this._refreshMissing());

    // Edit mode: changing the category dropdown re-renders the form for the
    // new category. Field values that map directly persist via the existing
    // product record. Operator should verify cost/size fields after a change
    // since their unit interpretation can shift (per-case vs per-bottle).
    document.getElementById('ip-edit-cat')?.addEventListener('change', ev => {
      this._formCategory = ev.target.value;
      this.renderForm();
    });

    // Edit mode: status toggle. Flips the visual state and updates the
    // button label. Save reads the toggled state via the badge's data-active
    // attribute, so the operator commits the change by clicking Update.
    document.getElementById('ip-toggle-active')?.addEventListener('click', () => {
      const el = document.querySelector('.ip-active-state');
      if (!el) return;
      const nowActive = !(el.dataset.active === 'true');
      el.dataset.active = nowActive ? 'true' : 'false';
      el.style.background = nowActive ? 'rgba(125,199,125,0.12)' : 'rgba(199,125,125,0.12)';
      el.style.color = nowActive ? '#7dc77d' : '#c77d7d';
      el.innerHTML = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;"></span>' + (nowActive ? 'ACTIVE' : 'HIDDEN');
      document.getElementById('ip-toggle-active').textContent = nowActive ? 'Hide from operations' : 'Make active';
    });

    if (this.editId) this.calcProduct();

    // On render: if we're editing an existing product, highlight required-
    // but-empty fields so the operator sees what's missing at a glance.
    if (this._editingExistingProduct) {
      this.applyMissingFieldHighlights(this._formCategory || '');
    }
  },

  _refreshMissing() {
    if (!this._editingExistingProduct) return;
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

    const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };
    const oz    = spec.sizeGroup || spec.showCaseSize ? (this.getOz() || null) : null;
    const pour  = spec.showPour ? num('ip-pour') : null;
    const cost  = num('ip-cost');
    const price = spec.showMenuPrice ? num('ip-price') : null;
    const pours = oz && pour ? oz / pour : null;
    const effCost = this.effectiveBottleCost();
    const cpp   = pours && effCost != null && effCost > 0 ? effCost / pours : null;
    const pct   = cpp != null && price ? cpp / price * 100 : null;
    const caseSize = spec.showCaseSize
      ? (parseInt(document.getElementById('ip-case-size')?.value) || null)
      : null;
    const unitType = spec.showUnitType ? this.getUnitType() : null;
    // Status: edit mode reads the badge state, new mode defaults to active.
    const stateEl = document.querySelector('.ip-active-state');
    const active = stateEl ? stateEl.dataset.active === 'true' : true;

    const prod = {
      id:                  this.editId || App.uid(),
      name,
      brand:               document.getElementById('ip-brand')?.value.trim() || '',
      category:            cat,
      sub_category:        document.getElementById('ip-subcat')?.value.trim() || '',
      vendor:              document.getElementById('ip-vendor')?.value.trim() || '',
      container_size_oz:   oz,
      case_size:           caseSize,
      pour_size_oz:        pour,
      unit_type:           unitType,
      unit_cost:           cost,
      menu_price:          price,
      par_level:           num('ip-par'),
      reorder_point:       num('ip-reorder'),
      primary_location:    document.getElementById('ip-loc1')?.value.trim() || '',
      active,
      notes:               document.getElementById('ip-notes')?.value.trim() || '',
      pours_per_container: pours,
      cost_per_pour:       cpp,
      pour_cost_pct:       pct,
      created_at:          this.editId ? undefined : new Date().toISOString()
    };

    const list = this.products();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...prod };
    } else {
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
      this.renderLanding();
    } else if (btn) {
      btn.disabled = false;
      btn.textContent = 'Save';
      if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; }
    }
  },

  // ── Delete ────────────────────────────────────────────────────────────────
  confirmDel(ids, msg) {
    this._pendingDelIds = ids;
    const modal = document.getElementById('ip-del-modal');
    const msgEl = document.getElementById('ip-del-msg');
    if (msgEl) msgEl.textContent = msg;
    if (modal) modal.style.display = 'flex';
    document.getElementById('ip-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelIds = null; };
    document.getElementById('ip-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const ids = this._pendingDelIds || [];
      App.inventoryData.ic_products = this.products().filter(p => !ids.includes(p.id));
      this._pendingDelIds = null;
      await App.saveInventory();
      this.renderLanding();
    };
  },

  // ── Import (category-scoped CSV / Excel with column mapping) ──────────────
  // Each category card has its own Import link. The category is locked at
  // import time so the mapping schema can include only category-relevant
  // columns (Case Size for Bottle Beer, Keg Size for Draft, Unit Type for
  // Food and Misc) and we never compute cost_per_pour with the wrong divisor.
  showImport(category) {
    if (!this.CATEGORIES.includes(category)) category = 'Liquor';
    this._formCategory = category;
    const spec = this.FORM_SPEC[category];

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="ip-back">&#8592; Back to Products</button></div>'
      + '<div class="card-title">Import ' + esc(spec.title) + ' from File</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:12px;">'
      + 'Upload a CSV or Excel file exported from your POS, your distributor order guide, or a spreadsheet you maintain. '
      + 'Bar Cop reads your columns and shows a mapping screen so you can match them to the right fields. '
      + 'Every row imports as ' + esc(spec.title) + ', any missing data shows as Incomplete and can be filled in afterwards.</div>'
      + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Accepted formats: CSV, XLSX, XLS</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f"><label>Select File</label><input type="file" id="ip-imp-file" accept=".csv,.xlsx,.xls" style="background:var(--input);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:8px;font-size:12px;cursor:pointer;"/></div>'
      + '</div>'
      + '<div id="ip-imp-preview"></div>'
      + '<div class="card-actions"><button class="btn btn-ghost" id="ip-cancel">Cancel</button></div>'
      + '</div></div>';

    document.getElementById('ip-back')?.addEventListener('click', () => this.renderLanding());
    document.getElementById('ip-cancel')?.addEventListener('click', () => this.renderLanding());
    document.getElementById('ip-imp-file')?.addEventListener('change', ev => {
      const file = ev.target.files[0];
      if (file) this.readImportFile(file);
    });
  },

  readImportFile(file) {
    const preview = document.getElementById('ip-imp-preview');
    if (preview) preview.innerHTML = '<div style="color:var(--t3);font-size:12px;margin-top:12px;">Reading file...</div>';
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = e => this.parseCSV(e.target.result);
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = e => this.parseXLSX(e.target.result);
      reader.readAsArrayBuffer(file);
    } else {
      this.showImportError('Unsupported file type. Use CSV or Excel.');
    }
  },

  parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) { this.showImportError('File appears empty or has only one row.'); return; }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).filter(l => l.trim()).map(line => {
      const vals = [];
      let inQ = false, cur = '';
      for (const ch of line) {
        if (ch === '"') inQ = !inQ;
        else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      vals.push(cur.trim());
      return vals;
    });
    this.showColumnMapper(headers, rows);
  },

  parseXLSX(buffer) {
    const run = () => {
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (data.length < 2) { this.showImportError('File appears empty.'); return; }
      const headers = data[0].map(h => String(h).trim());
      const rows = data.slice(1).filter(r => r.some(c => c !== '')).map(r => r.map(c => String(c).trim()));
      this.showColumnMapper(headers, rows);
    };
    if (typeof XLSX === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      script.onload = run;
      script.onerror = () => this.showImportError('Could not load the Excel reader. Save the file as CSV and try again.');
      document.head.appendChild(script);
    } else {
      run();
    }
  },

  showImportError(msg) {
    const preview = document.getElementById('ip-imp-preview');
    if (preview) preview.innerHTML = '<div style="color:var(--red);font-size:12px;margin-top:12px;">' + esc(msg) + '</div>';
  },

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
    // Food / Misc
    return COMMON.concat([
      {key:'unit_type',     label:'Unit Type (lb / case / each / ...)', required:false, aliases:['unit','unit type','uom','unit of measure','measure']},
      {key:'par_level',     label:'Par Level',     required:false, aliases:['par','par level','target stock']},
      {key:'reorder_point', label:'Reorder Point', required:false, aliases:['reorder','reorder point','min','minimum']},
    ]);
  },

  autoMap(headers, fields) {
    const map = {};
    headers.forEach(h => {
      const hl = h.toLowerCase().trim();
      fields.forEach(f => {
        if (!map[f.key] && f.aliases.some(k => hl === k || hl.includes(k))) map[f.key] = h;
      });
    });
    return map;
  },

  showColumnMapper(headers, rows) {
    const preview = document.getElementById('ip-imp-preview');
    if (!preview) return;
    this._importRows = rows;
    this._importHeaders = headers;
    const cat = this._formCategory || 'Liquor';
    const spec = this.FORM_SPEC[cat];
    const fields = this.importFieldsForCategory(cat);
    const autoMap = this.autoMap(headers, fields);
    const optsFor = sel => '<option value="">(skip)</option>'
      + headers.map(h => '<option value="' + esc(h) + '"' + (h === sel ? ' selected' : '') + '>' + esc(h) + '</option>').join('');

    let html = '<div class="divider"></div><div class="card"><div class="card-title">Map Your Columns &middot; ' + esc(spec.title) + '</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:16px;">'
      + 'Found <strong style="color:var(--w);">' + rows.length + ' rows</strong> in your file. '
      + 'Match each field to its column. Anything you leave on (skip) will be blank on the imported product, which can be filled in afterwards.</div>'
      + '<div class="form-row" style="flex-wrap:wrap;gap:12px 20px;">';

    fields.forEach(f => {
      html += '<div class="f" style="width:240px;flex-shrink:0;">'
        + '<label>' + esc(f.label) + (f.required ? ' <span style="color:var(--red);">*</span>' : '') + '</label>'
        + '<select id="ipm-' + f.key + '">' + optsFor(autoMap[f.key] || '') + '</select></div>';
    });

    html += '</div>'
      + '<div id="ip-imp-msg" style="font-size:12px;margin-top:12px;"></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-ghost" id="ip-cancel">Cancel</button>'
      + '<button class="btn btn-primary" id="ip-imp-run">Import ' + rows.length + ' ' + esc(spec.title) + (rows.length === 1 ? '' : 's') + '</button>'
      + '</div></div>';

    preview.innerHTML = html;
    document.getElementById('ip-cancel')?.addEventListener('click', () => this.renderLanding());
    document.getElementById('ip-imp-run')?.addEventListener('click', () => this.runImport());
  },

  async runImport() {
    const rows = this._importRows || [];
    const headers = this._importHeaders || [];
    const cat = this._formCategory || 'Liquor';
    const spec = this.FORM_SPEC[cat];
    const fields = this.importFieldsForCategory(cat);
    const getCol = key => document.getElementById('ipm-' + key)?.value || '';
    const nameCol = getCol('name');
    const msg = document.getElementById('ip-imp-msg');
    if (!nameCol) {
      if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Product Name column is required.'; }
      return;
    }
    const cell = (row, col) => { const i = headers.indexOf(col); return i >= 0 ? String(row[i] || '').trim() : ''; };
    const numOf = str => { if (!str) return null; const n = parseFloat(String(str).replace(/[^0-9.]/g, '')); return isNaN(n) ? null : n; };

    const imported = [];
    rows.forEach(row => {
      const name = cell(row, nameCol);
      if (!name) return;
      const oz   = numOf(cell(row, getCol('container_size_oz')));
      const pour = spec.showPour ? numOf(cell(row, getCol('pour_size_oz'))) : null;
      const cost = numOf(cell(row, getCol('unit_cost')));
      const price = spec.showMenuPrice ? numOf(cell(row, getCol('menu_price'))) : null;
      const caseSize = spec.showCaseSize ? (parseInt(cell(row, getCol('case_size'))) || null) : null;
      const unitType = spec.showUnitType ? (cell(row, getCol('unit_type')).toLowerCase() || spec.defaultUnitType) : null;
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
        brand:               cell(row, getCol('brand')),
        category:            cat,
        sub_category:        cell(row, getCol('sub_category')),
        vendor:              cell(row, getCol('vendor')),
        container_size_oz:   oz,
        case_size:           caseSize,
        pour_size_oz:        pour,
        unit_type:           unitType,
        unit_cost:           cost,
        menu_price:          price,
        par_level:           numOf(cell(row, getCol('par_level'))),
        reorder_point:       numOf(cell(row, getCol('reorder_point'))),
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

    if (!imported.length) {
      if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'No rows with a product name were found.'; }
      return;
    }

    this.products().push(...imported);
    const btn = document.getElementById('ip-imp-run');
    if (btn) { btn.disabled = true; btn.textContent = 'Importing...'; }

    const ok = await App.saveInventory();
    if (ok) {
      this.activeCat = cat;
      this.editId = null;
      this._formCategory = null;
      this.renderLanding();
    } else if (msg) {
      if (btn) { btn.disabled = false; btn.textContent = 'Import ' + imported.length + ' Products'; }
      msg.style.color = 'var(--red)';
      msg.textContent = 'Save failed. Try again.';
    }
  }
};
