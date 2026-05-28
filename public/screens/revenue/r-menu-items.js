'use strict';

/* ── Revenue Recovery — Menu Items (THE single edit surface) ──────────────────
   Landing screen mirrors IC Add Products: three cards on top (one per menu
   item type) + three tabs to filter the unified list below.

     Card 1 / Tab 1 — Plate Items     (food: Appetizers/Entrees/Desserts/Specials)
     Card 2 / Tab 2 — Cocktail Items  (Cocktails — single drink recipes)
     Card 3 / Tab 3 — Inventory Items (direct-pour: Beer/Wine/NA — picks from
                                       ic_products, cost auto-fills)

   Each card opens a form tailored to that type. No cross-type confusion —
   the Plate form never offers a single drink recipe, the Cocktail form's
   category is fixed, the Inventory form has no recipe builder. */

S.RevenueMenuItems = {
  // ── State ─────────────────────────────────────────────────────────────
  activeTab:        'plate',     // 'plate' | 'cocktail' | 'inventory'
  editIdx:          null,
  formType:         null,        // 'plate' | 'cocktail' | 'inventory'
  rows:             [],          // recipe ingredient rows
  mode:             null,        // 'single' | 'food' — recipe mode
  linkedProductId:  '',          // for inventory items
  recipeOptOut:     false,
  _saving:          false,

  // ── Constants ─────────────────────────────────────────────────────────
  // Plate form's category dropdown — food-side categories only
  PLATE_CATEGORIES: ['Appetizers', 'Entrees', 'Desserts', 'Specials'],

  // IC categories that can ingredients for cocktail recipes
  COCKTAIL_ING_CATS: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Misc'],
  PLATE_ING_CATS:    ['Food', 'Misc'],

  // Direct-pour mapping: what IC categories show on the Inventory form,
  // grouped by their MENU category for the picker.
  INVENTORY_GROUPS: [
    { menuCat: 'Beer',         icCats: ['Bottle Beer', 'Draft Beer'] },
    { menuCat: 'Wine',         icCats: ['Wine'] },
    { menuCat: 'NA Beverages', icCats: ['Misc'] }
  ],
  // Reverse map: IC product category → menu category (auto-derived on save)
  IC_TO_MENU_CAT: {
    'Bottle Beer':  'Beer',
    'Draft Beer':   'Beer',
    'Wine':         'Wine',
    'Misc':         'NA Beverages'
  },

  // ── Data helpers ──────────────────────────────────────────────────────
  items() {
    if (!App.data.menu_items) App.data.menu_items = [];
    return App.data.menu_items;
  },
  products() { return (App.inventoryData && App.inventoryData.ic_products) || []; },
  prodById(id) { return this.products().find(p => p.id === id) || null; },
  prepBatches() { return (App.prepBatches && App.prepBatches()) || []; },
  batchById(id) { return this.prepBatches().find(b => b.id === id) || null; },

  // Classify an existing menu item into the right tab/form type.
  // Used by edit routing and tab filtering.
  classifyItem(item) {
    if (!item) return 'plate';
    if (item.linked_product_id) return 'inventory';
    if (item.recipe && item.recipe.mode === 'single') return 'cocktail';
    if (item.category === 'Cocktails') return 'cocktail';
    return 'plate';
  },

  // ── Ingredient picker helpers (shared by Plate + Cocktail forms) ─────
  ingredientOptions(selKey, mode) {
    const prods = this.products();
    const batches = this.prepBatches();
    let h = '<option value="">Select ingredient...</option>';

    const catList = mode === 'food' ? this.PLATE_ING_CATS : this.COCKTAIL_ING_CATS;
    catList.forEach(cat => {
      const inCat = prods.filter(p => (p.category || '') === cat && p.active !== false)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (!inCat.length) return;
      h += '<optgroup label="' + esc(cat) + '">';
      inCat.forEach(p => {
        h += '<option value="p:' + p.id + '"' + (selKey === 'p:' + p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      });
      h += '</optgroup>';
    });
    if (batches.length) {
      h += '<optgroup label="Prep Batches">';
      batches.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(b => {
        h += '<option value="b:' + b.id + '"' + (selKey === 'b:' + b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>';
      });
      h += '</optgroup>';
    }
    return h;
  },
  ingredientCostBasis(row, mode) {
    if (row.source === 'batch') {
      const b = this.batchById(row.id);
      if (!b) return { unit: 'servings', costPerUnit: 0 };
      return { unit: 'servings', costPerUnit: b.cost_per_serving || 0 };
    }
    const p = this.prodById(row.id);
    if (!p) return { unit: '-', costPerUnit: 0 };
    const isLiquorish = ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer'].includes(p.category);
    if (isLiquorish && mode === 'single') {
      return { unit: 'pours', costPerUnit: (p.cost_per_pour != null ? p.cost_per_pour : (App.bottleCost ? (App.bottleCost(p) || 0) : 0)) };
    }
    if (isLiquorish) {
      return { unit: 'bottles', costPerUnit: (App.bottleCost ? (App.bottleCost(p) || 0) : (p.unit_cost || 0)) };
    }
    if (p.category === 'Misc' && mode === 'single' && p.cost_per_pour != null) {
      return { unit: 'pours', costPerUnit: p.cost_per_pour };
    }
    return { unit: 'units', costPerUnit: p.unit_cost || 0 };
  },

  // ── Inventory product picker (Card 3 / Inventory form) ───────────────
  inventoryProductOptions(selectedId) {
    const prods = this.products().filter(p => p.active !== false);
    let h = '<option value="">Select inventory product...</option>';
    let totalShown = 0;
    this.INVENTORY_GROUPS.forEach(grp => {
      grp.icCats.forEach(icCat => {
        const inCat = prods.filter(p => (p.category || '') === icCat)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        if (!inCat.length) return;
        totalShown += inCat.length;
        h += '<optgroup label="' + esc(icCat) + ' (' + esc(grp.menuCat) + ')">';
        inCat.forEach(p => {
          h += '<option value="' + p.id + '"' + (p.id === selectedId ? ' selected' : '') + '>' + esc(p.name) + '</option>';
        });
        h += '</optgroup>';
      });
    });
    if (!totalShown) h += '<option value="" disabled>No Beer / Wine / NA products in Inventory Control yet</option>';
    return h;
  },

  // ── Required-field validation (shared) ───────────────────────────────
  missingFields(item, formType) {
    const out = new Set();
    if (!item) return out;
    if (formType === 'inventory') {
      if (!item.linked_product_id) out.add('ri-linked-prod');
      if (!(parseFloat(item.price) > 0)) out.add('ri-price');
      // Name is auto-derived from linked product but operator can edit;
      // empty is still a problem if they cleared it.
      if (!item.name) out.add('ri-name');
      return out;
    }
    // Plate + Cocktail
    if (!item.name) out.add('ri-name');
    if (formType === 'plate' && !item.category) out.add('ri-cat');
    if (!(parseFloat(item.price) > 0)) out.add('ri-price');
    const hasRecipe = !!(item.recipe && Array.isArray(item.recipe.ingredients) && item.recipe.ingredients.length);
    const hasCost   = parseFloat(item.cost) > 0;
    if (!hasRecipe && !hasCost) out.add('ri-cost');
    return out;
  },
  // Field-missing highlights fire ONLY when editing an INCOMPLETE record.
  // Add-new flow + edit-of-complete flow both stay clean (no red borders).
  applyMissingFieldHighlights(item, formType) {
    if (!this._editingIncomplete) return;
    if (!item) return;
    const missing = this.missingFields(item, formType);
    missing.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const wrap = el.closest('.f');
      if (wrap) wrap.classList.add('field-missing');
    });
  },
  refreshFieldMissing() {
    if (!this._editingIncomplete) return;
    const synthetic = {
      name:               document.getElementById('ri-name')?.value.trim() || '',
      category:           document.getElementById('ri-cat')?.value || '',
      price:              parseFloat(document.getElementById('ri-price')?.value) || 0,
      cost:               parseFloat(document.getElementById('ri-cost')?.value) || 0,
      recipe:             this.rows.length && this.mode ? { mode: this.mode, ingredients: this.rows.filter(r => r.id) } : null,
      linked_product_id:  this.linkedProductId || ''
    };
    const missing = this.missingFields(synthetic, this.formType);
    ['ri-name', 'ri-cat', 'ri-price', 'ri-cost', 'ri-linked-prod'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const wrap = el.closest('.f');
      if (!wrap) return;
      if (missing.has(id)) wrap.classList.add('field-missing');
      else wrap.classList.remove('field-missing');
    });
  },

  // ── Entry point ───────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    // External focus from Recipe Cost Analysis — drop into the right form for the item.
    if (App._menuItemFocus) {
      const focusId = App._menuItemFocus;
      App._menuItemFocus = null;
      const idx = this.items().findIndex(i => i.id === focusId);
      if (idx >= 0) { this.showFormForIdx(idx); return; }
    }
    this.renderLanding();
  },

  // ── Landing: three cards + tabs + filtered table ─────────────────────
  renderLanding() {
    this.actions.innerHTML = '';
    const impBtn = document.createElement('button');
    impBtn.className = 'btn btn-ghost btn-sm';
    impBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="margin-right:5px;"><path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Import';
    impBtn.addEventListener('click', () => this.showImport());
    this.actions.appendChild(impBtn);

    const all = this.items();
    const counts = {
      plate:     all.filter(i => this.classifyItem(i) === 'plate').length,
      cocktail:  all.filter(i => this.classifyItem(i) === 'cocktail').length,
      inventory: all.filter(i => this.classifyItem(i) === 'inventory').length
    };

    const card = (type, label, sub) => {
      const n = counts[type] || 0;
      return '<div class="mi-card" data-type="' + type + '" '
        + 'style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px 22px 22px;cursor:pointer;text-align:center;transition:border-color 0.15s;">'
        + '<div style="font-size:18px;font-weight:800;color:var(--gold);letter-spacing:0.5px;margin-bottom:6px;">' + esc(label) + '</div>'
        + '<div style="font-size:10px;color:var(--t4);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">' + esc(sub) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-bottom:14px;">' + n + ' item' + (n === 1 ? '' : 's') + '</div>'
        + '<span class="mi-card-add" data-type="' + type + '" style="color:var(--gold);font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">+ Add ' + esc(label.split(' ')[0]) + '</span>'
        + '</div>';
    };

    const cardsBlock = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">'
      + card('plate',     'Menu Plate Item',     'Appetizer, Entree, Dessert, Special')
      + card('cocktail',  'Menu Cocktail Item',  'Built drink with ingredients')
      + card('inventory', 'Menu Inventory Item', 'Beer, Wine, NA, direct pour')
      + '</div>';

    // Tabs
    const tabBtn = (k, label) => {
      const active = this.activeTab === k;
      return '<button class="mi-tab" data-tab="' + k + '" style="background:none;border:none;'
        + 'border-bottom:2px solid ' + (active ? 'var(--gold)' : 'transparent') + ';'
        + 'color:' + (active ? 'var(--gold)' : 'var(--t3)') + ';font-size:11px;font-weight:700;'
        + 'letter-spacing:0.5px;text-transform:uppercase;padding:10px 14px;cursor:pointer;">'
        + esc(label) + ' &middot; ' + (counts[k] || 0)
        + '</button>';
    };
    const tabsBlock = '<div style="display:flex;gap:2px;border-bottom:1px solid var(--b2);margin-bottom:14px;">'
      + tabBtn('plate', 'Plate Items')
      + tabBtn('cocktail', 'Cocktail Items')
      + tabBtn('inventory', 'Inventory Items')
      + '</div>';

    // Filtered list for active tab
    const itemsHere = all.filter(i => this.classifyItem(i) === this.activeTab);
    const incomplete = itemsHere.filter(i => !i.price || (App.menuItemCost(i) || 0) === 0).length;

    let listHtml;
    if (itemsHere.length === 0) {
      const blurb = {
        plate:     'No plate items yet. Click "Menu Plate Item" above to add your first one.',
        cocktail:  'No cocktail items yet. Click "Menu Cocktail Item" above to add your first one.',
        inventory: 'No inventory items yet. Click "Menu Inventory Item" above to add your first one.'
      };
      listHtml = '<div class="empty"><div class="empty-title">Nothing here yet</div>'
        + '<div class="empty-sub">' + esc(blurb[this.activeTab] || '') + '</div></div>';
    } else {
      const rows = itemsHere.map((item) => {
        const cost = App.menuItemCost(item) || 0;
        const cm   = (item.price && cost) ? (item.price - cost) : null;
        const pct  = (item.price && cost) ? (cost / item.price * 100).toFixed(1) : null;
        const ok   = item.price && cost;
        const hasRecipe = !!(item.recipe && Array.isArray(item.recipe.ingredients) && item.recipe.ingredients.length);
        const hasLinked = !!item.linked_product_id;
        const badgeStyle = 'font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gold);border:1px solid var(--gold);border-radius:3px;padding:1px 5px;margin-left:6px;';
        const tagBadge = hasRecipe
          ? '<span style="' + badgeStyle + '">RECIPE</span>'
          : (hasLinked ? '<span style="' + badgeStyle + '">LINKED</span>' : '');
        const costFrom = hasRecipe ? '<div style="font-size:9px;color:var(--t3);">from recipe</div>'
                       : (hasLinked ? '<div style="font-size:9px;color:var(--t3);">from linked product</div>' : '');
        return '<tr class="' + (!ok ? 'row-incomplete' : '') + '">'
          + '<td style="width:36px;"><input type="checkbox" class="ri-chk" data-id="' + item.id + '" style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/></td>'
          + '<td style="font-weight:600;color:' + (ok ? 'var(--t1)' : 'var(--red)') + ';">' + esc(item.name) + tagBadge + (!ok ? ' <span style="font-size:10px;font-weight:700;color:var(--red);">INCOMPLETE</span>' : '') + '</td>'
          + '<td>' + esc(item.category || '') + '</td>'
          + '<td>' + (item.price ? App.fmtCurrency(item.price) : '-') + '</td>'
          + '<td>' + (cost ? App.fmtCurrency(cost) : '-') + costFrom + '</td>'
          + '<td>' + (pct ? pct + '%' : '-') + '</td>'
          + '<td>' + (cm ? App.fmtCurrency(cm) : '-') + '</td>'
          + '<td>' + (item.weekly_covers ? item.weekly_covers : '-') + '</td>'
          + '<td style="white-space:nowrap;">'
          + '<button class="btn btn-ghost btn-sm ri-edit" data-id="' + item.id + '" style="margin-right:4px;">Edit</button>'
          + '<button class="btn btn-danger btn-sm ri-del" data-id="' + item.id + '">Del</button>'
          + '</td></tr>';
      }).join('');

      listHtml = (incomplete > 0 ? '<div class="alert-bar"><div class="alert-text">' + incomplete + ' item' + (incomplete > 1 ? 's' : '') + ' missing price or cost. Incomplete items cannot be used in Menu Engineering.</div></div>' : '')
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
        + '<button class="btn btn-ghost btn-sm" id="ri-sel-all">Select All</button>'
        + '<button class="btn btn-danger btn-sm" id="ri-del-sel" style="display:none;">Delete Selected</button>'
        + '<span id="ri-sel-count" style="font-size:11px;color:var(--t3);"></span>'
        + '</div>'
        + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
        + '<th style="width:36px;"></th>'
        + '<th>Item Name</th><th>Category</th><th>Price</th><th>Cost</th><th>Cost %</th><th>Contrib. Margin</th><th>Wkly Covers</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">'
      + cardsBlock
      + tabsBlock
      + listHtml
      + '</div>';

    // Wire cards + tabs + list actions
    this.container.querySelectorAll('.mi-card, .mi-card-add').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const type = el.dataset.type;
        if (type) this.showForm(type, null);
      });
    });
    this.container.querySelectorAll('.mi-tab').forEach(b =>
      b.addEventListener('click', () => { this.activeTab = b.dataset.tab; this.renderLanding(); })
    );
    this.container.querySelectorAll('.ri-edit').forEach(btn => {
      btn.addEventListener('click', () => this.showFormForId(btn.dataset.id));
    });
    this.container.querySelectorAll('.ri-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await App.confirm({ title: 'Delete this item?', confirmText: 'Delete', cancelText: 'Cancel' });
        if (!ok) return;
        App.data.menu_items = this.items().filter(i => i.id !== btn.dataset.id);
        await App.saveKey('menu_items');
        this.renderLanding();
      });
    });

    // Multi-select
    const updateSel = () => {
      const checked = this.container.querySelectorAll('.ri-chk:checked');
      const delBtn  = document.getElementById('ri-del-sel');
      const count   = document.getElementById('ri-sel-count');
      if (delBtn) delBtn.style.display = checked.length ? '' : 'none';
      if (count)  count.textContent    = checked.length ? checked.length + ' selected' : '';
    };
    document.getElementById('ri-sel-all')?.addEventListener('click', () => {
      const all = this.container.querySelectorAll('.ri-chk');
      const anyUnchecked = [...all].some(c => !c.checked);
      all.forEach(c => { c.checked = anyUnchecked; });
      updateSel();
    });
    this.container.addEventListener('change', e => { if (e.target.classList.contains('ri-chk')) updateSel(); });
    document.getElementById('ri-del-sel')?.addEventListener('click', async () => {
      const ids = [...this.container.querySelectorAll('.ri-chk:checked')].map(c => c.dataset.id);
      if (!ids.length) return;
      const ok = await App.confirm({ title: 'Delete ' + ids.length + ' item' + (ids.length > 1 ? 's' : '') + '?', confirmText: 'Delete', cancelText: 'Cancel' });
      if (!ok) return;
      App.data.menu_items = this.items().filter(i => !ids.includes(i.id));
      await App.saveKey('menu_items');
      this.renderLanding();
    });
  },

  // ── Form routing ──────────────────────────────────────────────────────
  showFormForId(id) {
    const idx = this.items().findIndex(i => i.id === id);
    if (idx < 0) return;
    this.showFormForIdx(idx);
  },
  showFormForIdx(idx) {
    const item = this.items()[idx];
    if (!item) return;
    const type = this.classifyItem(item);
    this.editIdx = idx;
    this.showForm(type, item);
  },

  showForm(type, item) {
    this.formType = type;
    this.editIdx  = item ? this.items().findIndex(i => i.id === item.id) : null;
    this.recipeOptOut = false;
    this.linkedProductId = item?.linked_product_id || '';
    const hasRecipe = !!(item?.recipe && Array.isArray(item.recipe.ingredients) && item.recipe.ingredients.length);
    this.mode = hasRecipe ? item.recipe.mode : (type === 'cocktail' ? 'single' : type === 'plate' ? 'food' : null);
    this.rows = hasRecipe
      ? item.recipe.ingredients.map(i => ({ source: i.source || 'product', id: i.id || i.product_id, quantity: i.quantity }))
      : [];
    // Field-missing highlights fire ONLY when editing an incomplete record.
    // Add-new and edit-of-complete both stay clean.
    this._editingIncomplete = !!(item && this.missingFields(item, type).size > 0);

    if (type === 'plate')     this.renderPlateForm(item);
    if (type === 'cocktail')  this.renderCocktailForm(item);
    if (type === 'inventory') this.renderInventoryForm(item);
  },

  // ── Plate Form ────────────────────────────────────────────────────────
  renderPlateForm(item) {
    const catOpts = this.PLATE_CATEGORIES.map(c =>
      '<option' + (item?.category === c ? ' selected' : '') + '>' + c + '</option>').join('');
    const hasRecipe = this.rows.length > 0 && this.mode;
    const target = item?.target_cost_pct || 32;

    this.actions.innerHTML = '';
    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="ri-back">&#8592; Back to Menu Items</button></div>'
      + '<div class="card">'
      + '<div class="sh">' + (item ? 'Edit Plate Item' : 'Add Menu Plate Item') + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
        + '<div class="f w-lg"><label>Item Name</label><input type="text" id="ri-name" value="' + esc(item?.name || '') + '" placeholder="Anchor Burger"/></div>'
        + '<div class="f w-md"><label>Category</label><select id="ri-cat"><option value="">Select...</option>' + catOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
        + '<div class="f w-md"><label>Menu Price</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ri-price" value="' + (item?.price || '') + '" step="0.01" placeholder="0.00"/></div></div>'
        + '<div class="f w-md"><label>Cost ' + (hasRecipe ? '<span style="color:var(--t4);font-weight:400;">(auto from recipe)</span>' : '') + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ri-cost" value="' + ((hasRecipe ? (App.menuItemCost(item) || 0).toFixed(2) : item?.cost) || '') + '" step="0.01" placeholder="0.00"' + (hasRecipe ? ' disabled' : '') + '/></div></div>'
        + '<div class="f w-md"><label>Avg Weekly Covers</label><input type="number" id="ri-cov" value="' + (item?.weekly_covers || '') + '" placeholder=""/></div>'
      + '</div>'

      + '<div id="ri-recipe-section" style="border-top:1px solid var(--b2);padding-top:18px;margin-top:8px;"></div>'

      // Notes sits at the bottom — last row before the save buttons
      + '<div class="f" style="margin-top:18px;margin-bottom:0;"><label>Notes</label><input type="text" id="ri-notes" value="' + esc(item?.notes || '') + '" placeholder="Optional"/></div>'

      + '<div style="display:flex;gap:10px;margin-top:18px;">'
        + '<button class="btn btn-primary" id="ri-save">Save Item</button>'
        + '<button class="btn btn-ghost" id="ri-cancel">Cancel</button>'
        + '<span id="ri-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
      + '</div></div>';

    // Default to food recipe builder open with one blank row
    if (!hasRecipe && !this.recipeOptOut) {
      this.mode = 'food';
      this.rows = [{ source: 'product', id: '', quantity: '' }];
    }
    this.renderRecipeSection(item, target);

    this._wireSharedForm(item);
    if (item) this.applyMissingFieldHighlights(item, 'plate');
  },

  // ── Cocktail Form ─────────────────────────────────────────────────────
  renderCocktailForm(item) {
    const hasRecipe = this.rows.length > 0 && this.mode;
    const target = item?.target_cost_pct || 22;

    this.actions.innerHTML = '';
    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="ri-back">&#8592; Back to Menu Items</button></div>'
      + '<div class="card">'
      + '<div class="sh">' + (item ? 'Edit Cocktail Item' : 'Add Menu Cocktail Item') + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
        + '<div class="f w-lg"><label>Item Name</label><input type="text" id="ri-name" value="' + esc(item?.name || '') + '" placeholder="House Margarita"/></div>'
        + '<div class="f w-md"><label>Category</label>'
          + '<div style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);padding:8px 10px;color:var(--t1);font-size:13px;">Cocktails</div>'
        + '</div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
        + '<div class="f w-md"><label>Menu Price</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ri-price" value="' + (item?.price || '') + '" step="0.01" placeholder="0.00"/></div></div>'
        + '<div class="f w-md"><label>Cost ' + (hasRecipe ? '<span style="color:var(--t4);font-weight:400;">(auto from recipe)</span>' : '') + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ri-cost" value="' + ((hasRecipe ? (App.menuItemCost(item) || 0).toFixed(2) : item?.cost) || '') + '" step="0.01" placeholder="0.00"' + (hasRecipe ? ' disabled' : '') + '/></div></div>'
        + '<div class="f w-md"><label>Avg Weekly Covers</label><input type="number" id="ri-cov" value="' + (item?.weekly_covers || '') + '" placeholder=""/></div>'
      + '</div>'

      + '<div id="ri-recipe-section" style="border-top:1px solid var(--b2);padding-top:18px;margin-top:8px;"></div>'

      // Notes sits at the bottom — last row before the save buttons
      + '<div class="f" style="margin-top:18px;margin-bottom:0;"><label>Notes</label><input type="text" id="ri-notes" value="' + esc(item?.notes || '') + '" placeholder="Optional"/></div>'

      + '<div style="display:flex;gap:10px;margin-top:18px;">'
        + '<button class="btn btn-primary" id="ri-save">Save Item</button>'
        + '<button class="btn btn-ghost" id="ri-cancel">Cancel</button>'
        + '<span id="ri-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
      + '</div></div>';

    if (!hasRecipe && !this.recipeOptOut) {
      this.mode = 'single';
      this.rows = [{ source: 'product', id: '', quantity: '' }];
    }
    this.renderRecipeSection(item, target);

    this._wireSharedForm(item);
    if (item) this.applyMissingFieldHighlights(item, 'cocktail');
  },

  // ── Inventory Form ────────────────────────────────────────────────────
  renderInventoryForm(item) {
    const linkedId = this.linkedProductId || item?.linked_product_id || '';
    const linkedProd = linkedId ? this.prodById(linkedId) : null;
    const autoCost = linkedProd ? (App.bottleCost ? (App.bottleCost(linkedProd) || linkedProd.unit_cost || 0) : (linkedProd.unit_cost || 0)) : 0;

    this.actions.innerHTML = '';
    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="ri-back">&#8592; Back to Menu Items</button></div>'
      + '<div class="card">'
      + '<div class="sh">' + (item ? 'Edit Inventory Item' : 'Add Menu Inventory Item') + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:14px;line-height:1.55;">'
        + 'Direct-pour menu items: beer, wine, NA beverages. Pick the inventory product first; name and cost auto-fill, and cost stays in sync whenever you update the product in Inventory Control.'
      + '</div>'

      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
        + '<div class="f" style="flex:1;min-width:240px;"><label>Inventory Product</label>'
          + '<select id="ri-linked-prod">' + this.inventoryProductOptions(linkedId) + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
        + '<div class="f w-lg"><label>Item Name <span style="color:var(--t4);font-weight:400;">(editable)</span></label>'
          + '<input type="text" id="ri-name" value="' + esc(item?.name || linkedProd?.name || '') + '" placeholder="Picks up from Inventory Product"/></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
        + '<div class="f w-md"><label>Menu Price</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ri-price" value="' + (item?.price || '') + '" step="0.01" placeholder="0.00"/></div></div>'
        + '<div class="f w-md"><label>Cost <span style="color:var(--t4);font-weight:400;">(auto from linked product)</span></label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ri-cost" value="' + (autoCost > 0 ? autoCost.toFixed(2) : '') + '" step="0.01" placeholder="0.00" disabled/></div></div>'
        + '<div class="f w-md"><label>Avg Weekly Covers</label><input type="number" id="ri-cov" value="' + (item?.weekly_covers || '') + '" placeholder=""/></div>'
      + '</div>'

      // Pour Size Override — for multi-size offerings on the same product
      // (Pint vs Pitcher both drawing from one Heineken Draft keg). Defaults
      // to the linked product's pour_size_oz; operator overrides for the
      // larger size. Drives Variance Report consumption math.
      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Pour Size <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
        + '<div class="fw"><input class="suf" type="number" id="ri-pour" value="' + (item?.pour_size_oz != null ? item.pour_size_oz : '') + '" step="0.25" min="0" placeholder="' + (linkedProd?.pour_size_oz != null ? linkedProd.pour_size_oz : 'oz') + '"/><span class="suf">oz</span></div></div>'
        + '<div class="f" style="flex:1;"><label>&nbsp;</label>'
        + '<div style="font-size:11px;color:var(--t3);padding-bottom:8px;line-height:1.5;">Defaults to the linked product\'s pour size. Override for multi-size offerings, like Pint (16 oz) and Pitcher (60 oz) drawing from the same keg.</div></div>'
      + '</div>'

      // Notes sits at the bottom — last row before the save buttons
      + '<div class="f" style="margin-top:8px;margin-bottom:0;"><label>Notes</label><input type="text" id="ri-notes" value="' + esc(item?.notes || '') + '" placeholder="Optional"/></div>'

      + '<div style="display:flex;gap:10px;margin-top:18px;">'
        + '<button class="btn btn-primary" id="ri-save">Save Item</button>'
        + '<button class="btn btn-ghost" id="ri-cancel">Cancel</button>'
        + '<span id="ri-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
      + '</div></div>';

    // Wire inventory product picker → auto-fills name + cost.
    // Every change overwrites the Item Name with the new product's name.
    // Operator can still edit the name afterwards for custom variants like
    // "Bud Light Pitcher", but switching products is a clear "start over"
    // signal so we reset to match.
    document.getElementById('ri-linked-prod')?.addEventListener('change', e => {
      this.linkedProductId = e.target.value || '';
      const p = this.linkedProductId ? this.prodById(this.linkedProductId) : null;
      // Cost auto-fill
      const costInp = document.getElementById('ri-cost');
      if (costInp) {
        if (p) {
          const bc = App.bottleCost ? (App.bottleCost(p) || p.unit_cost || 0) : (p.unit_cost || 0);
          costInp.value = bc > 0 ? bc.toFixed(2) : '';
        } else {
          costInp.value = '';
        }
      }
      // Name auto-fill — overwrites whatever was there, since switching
      // products is a clear "start over" signal.
      const nameInp = document.getElementById('ri-name');
      if (nameInp) nameInp.value = p ? p.name : '';
      this.refreshFieldMissing();
    });

    this._wireSharedForm(item);
    if (item) this.applyMissingFieldHighlights(item, 'inventory');
  },

  // Common form wiring (Back, Cancel, Save, field-missing inputs)
  _wireSharedForm(item) {
    document.getElementById('ri-back')?.addEventListener('click', () => this.renderLanding());
    document.getElementById('ri-cancel')?.addEventListener('click', () => this.renderLanding());
    document.getElementById('ri-save')?.addEventListener('click', () => this._save(item));
    ['ri-name', 'ri-price', 'ri-cost'].forEach(id =>
      document.getElementById(id)?.addEventListener('input', () => this.refreshFieldMissing())
    );
    document.getElementById('ri-cat')?.addEventListener('change', () => this.refreshFieldMissing());
  },

  // ── Recipe section (used by Plate + Cocktail forms) ──────────────────
  renderRecipeSection(item, target) {
    const sec = document.getElementById('ri-recipe-section');
    if (!sec) return;
    const hasRows = this.rows.length > 0 && this.mode;

    if (!hasRows) {
      // Operator opted out of recipe — show "+ Add recipe" link only
      sec.innerHTML = '<div class="sh">Recipe</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:10px;">'
          + 'No recipe attached. Cost uses the manual entry above.'
        + '</div>'
        + '<a href="#" id="ri-add-anyway" style="font-size:11px;color:var(--gold);">+ Add a recipe</a>';
      document.getElementById('ri-add-anyway')?.addEventListener('click', ev => {
        ev.preventDefault();
        this.recipeOptOut = false;
        this.mode = this.formType === 'cocktail' ? 'single' : 'food';
        this.rows = [{ source: 'product', id: '', quantity: '' }];
        this.renderRecipeSection(item, target);
        this.refreshFieldMissing();
      });
      return;
    }

    const modeLabel = this.mode === 'food' ? 'Food Plate' : 'Single Drink';
    const plateYieldField = this.mode === 'food'
      ? '<div class="f" style="width:130px;flex-shrink:0;"><label>Plates Per Batch</label>'
        + '<input type="number" id="ri-plate-yield" value="' + (item?.recipe?.plate_yield || 1) + '" min="1"/></div>'
      : '';

    sec.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;">'
        + '<div>'
          + '<div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">Recipe &middot; ' + modeLabel + '</div>'
          + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">Cost auto-computes from current product + prep batch prices.</div>'
        + '</div>'
        + '<div><button class="btn btn-ghost btn-sm" id="ri-remove-recipe">No Recipe</button></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Target Cost %</label>'
          + '<div class="fw"><input class="suf" type="number" id="ri-target-pct" value="' + target + '" step="0.5"/><span class="suf">%</span></div></div>'
        + plateYieldField
      + '</div>'
      + '<div class="sh" style="margin-top:4px;">' + (this.mode === 'food' ? 'Kitchen' : 'Bar') + ' Ingredients</div>'
      + '<div id="ri-ings" style="margin-bottom:12px;"></div>'
      + '<button class="btn btn-ghost btn-sm" id="ri-add-ing" style="margin-bottom:14px;">+ Add Ingredient</button>'
      + '<div class="calc" style="margin-bottom:0;">'
        + '<div class="calc-item"><div class="calc-label">Total Ingredient Cost</div><div class="calc-val" id="ri-tc">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Cost Per Serving</div><div class="calc-val" id="ri-cps">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Recipe Cost %</div><div class="calc-val" id="ri-cpct">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Target</div><div class="calc-val dim" id="ri-tgt-d">-</div></div>'
      + '</div>';

    this.renderRows();
    this.calcRecipe();

    document.getElementById('ri-remove-recipe')?.addEventListener('click', async () => {
      const ok = await App.confirm({
        title: 'Skip the recipe?',
        message: 'Cost will fall back to manual entry.',
        confirmText: 'Skip recipe',
        cancelText: 'Keep'
      });
      if (!ok) return;
      this.rows = [];
      this.mode = null;
      this.recipeOptOut = true;
      const costInp = document.getElementById('ri-cost');
      if (costInp) { costInp.disabled = false; costInp.value = ''; }
      this.renderRecipeSection(item, target);
      this.refreshFieldMissing();
    });
    document.getElementById('ri-add-ing')?.addEventListener('click', () => { this.addRow(); this.calcRecipe(); });
    document.getElementById('ri-target-pct')?.addEventListener('input', () => this.calcRecipe());
    document.getElementById('ri-plate-yield')?.addEventListener('input', () => this.calcRecipe());
  },

  renderRows() {
    const area = document.getElementById('ri-ings');
    if (!area) return;
    area.innerHTML = '<div class="card" style="padding:0;overflow:hidden;">'
      + '<table class="ing-tbl"><thead><tr><th>Ingredient</th><th>Qty</th><th>Unit</th><th>Unit Cost</th><th>Line Cost</th><th></th></tr></thead>'
      + '<tbody>' + this.rows.map((r, idx) => {
        const selKey = r.id ? (r.source === 'batch' ? 'b:' : 'p:') + r.id : '';
        const basis = this.ingredientCostBasis(r, this.mode);
        const qty = parseFloat(r.quantity) || 0;
        const lineCost = qty * (basis.costPerUnit || 0);
        const costD = basis.costPerUnit > 0 ? App.fmtCurrency(basis.costPerUnit) : (r.id ? '<span style="color:var(--red);font-size:10px;">Add cost</span>' : '-');
        const lineD = lineCost > 0 ? App.fmtCurrency(lineCost) : '-';
        return '<tr>'
          + '<td style="min-width:220px;"><select class="form-input ri-ing-src" data-i="' + idx + '" style="width:100%;">' + this.ingredientOptions(selKey, this.mode) + '</select></td>'
          + '<td style="width:90px;"><input class="form-input ri-ing-qty" type="number" data-i="' + idx + '" value="' + (r.quantity || '') + '" min="0" step="0.25" style="width:100%;padding:6px 8px;"/></td>'
          + '<td style="width:80px;color:var(--t2);font-size:12px;">' + basis.unit + '</td>'
          + '<td style="width:100px;font-size:12px;">' + costD + '</td>'
          + '<td style="width:100px;" class="val" id="ri-lc-' + idx + '">' + lineD + '</td>'
          + '<td style="width:36px;"><button class="btn btn-danger btn-sm ri-rm-ing" data-i="' + idx + '" style="padding:4px 8px;">&times;</button></td>'
          + '</tr>';
      }).join('') + '</tbody></table></div>';

    area.querySelectorAll('.ri-ing-src').forEach(sel => sel.addEventListener('change', () => this.onSrcChange(sel)));
    area.querySelectorAll('.ri-ing-qty').forEach(inp => inp.addEventListener('input', () => this.calcRecipe()));
    area.querySelectorAll('.ri-rm-ing').forEach(btn => btn.addEventListener('click', () => this.removeRow(parseInt(btn.dataset.i))));
  },

  onSrcChange(sel) {
    const idx = parseInt(sel.dataset.i);
    const v = sel.value;
    if (!v) {
      this.rows[idx].source = 'product';
      this.rows[idx].id = '';
    } else if (v.startsWith('b:')) {
      this.rows[idx].source = 'batch';
      this.rows[idx].id = v.slice(2);
    } else {
      this.rows[idx].source = 'product';
      this.rows[idx].id = v.slice(2);
    }
    this.renderRows();
    this.calcRecipe();
  },
  addRow() {
    this.rows.push({ source: 'product', id: '', quantity: '' });
    this.renderRows();
  },
  removeRow(idx) {
    this.rows.splice(idx, 1);
    if (!this.rows.length) {
      this.mode = null;
      const item = this.editIdx !== null ? this.items()[this.editIdx] : null;
      const target = item?.target_cost_pct || (this.formType === 'cocktail' ? 22 : 32);
      this.renderRecipeSection(item, target);
      this.refreshFieldMissing();
      return;
    }
    this.renderRows();
    this.calcRecipe();
  },

  calcRecipe() {
    document.querySelectorAll('.ri-ing-qty').forEach(el => {
      const idx = parseInt(el.dataset.i);
      if (this.rows[idx]) this.rows[idx].quantity = parseFloat(el.value) || 0;
    });
    let tc = 0;
    this.rows.forEach((r, idx) => {
      const basis = this.ingredientCostBasis(r, this.mode);
      const qty = parseFloat(r.quantity) || 0;
      const line = qty * (basis.costPerUnit || 0);
      tc += line;
      const le = document.getElementById('ri-lc-' + idx);
      if (le) le.textContent = line > 0 ? App.fmtCurrency(line) : '-';
    });
    const py = this.mode === 'food' ? (parseFloat(document.getElementById('ri-plate-yield')?.value) || 1) : 1;
    const cps = (this.mode === 'food' && py > 0) ? tc / py : tc;
    const mp  = parseFloat(document.getElementById('ri-price')?.value) || 0;
    const tpct = parseFloat(document.getElementById('ri-target-pct')?.value) || 0;
    const cpct = mp > 0 ? (cps / mp * 100) : null;
    const set = (id, val, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = val; el.className = 'calc-val' + (cls ? ' ' + cls : ''); };
    set('ri-tc', tc > 0 ? App.fmtCurrency(tc) : '-');
    set('ri-cps', cps > 0 ? App.fmtCurrency(cps) : '-');
    set('ri-cpct', cpct != null ? cpct.toFixed(1) + '%' : '-', cpct != null && tpct > 0 ? (cpct > tpct ? 'warn' : 'good') : '');
    set('ri-tgt-d', tpct > 0 ? tpct.toFixed(1) + '%' : '-');
    const costInp = document.getElementById('ri-cost');
    if (costInp && this.rows.length) {
      costInp.value = cps > 0 ? cps.toFixed(2) : '';
      costInp.disabled = true;
    }
    this.refreshFieldMissing();
  },

  // ── Save ──────────────────────────────────────────────────────────────
  async _save(existing) {
    if (this._saving) return;
    this._saving = true;
    setTimeout(() => { this._saving = false; }, 1000);

    const err = document.getElementById('ri-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } this._saving = false; };

    const type = this.formType;
    const name = document.getElementById('ri-name')?.value.trim();
    const price = parseFloat(document.getElementById('ri-price')?.value) || 0;
    const covers = parseFloat(document.getElementById('ri-cov')?.value) || 0;
    const notes = document.getElementById('ri-notes')?.value || '';

    if (!name) { fail('Item name required.'); return; }
    if (!(price > 0)) { fail('Menu price required.'); return; }

    let category = '';
    let recipe = null;
    let linkedProductId = '';
    let computedCost = 0;
    let targetPct = existing?.target_cost_pct;

    if (type === 'plate') {
      category = document.getElementById('ri-cat')?.value || '';
      if (!category) { fail('Category required.'); return; }
      const recipeIngs = (this.rows.length && this.mode)
        ? this.rows.filter(r => r.id && (parseFloat(r.quantity) || 0) > 0).map(r => ({ source: r.source, id: r.id, quantity: parseFloat(r.quantity) || 0 }))
        : [];
      if (recipeIngs.length > 0) {
        recipe = {
          mode: 'food',
          ingredients: recipeIngs,
          plate_yield: parseFloat(document.getElementById('ri-plate-yield')?.value) || 1
        };
        targetPct = parseFloat(document.getElementById('ri-target-pct')?.value) || 32;
        const tmp = { recipe };
        computedCost = App.menuItemCost(tmp) || 0;
      } else {
        computedCost = parseFloat(document.getElementById('ri-cost')?.value) || 0;
      }
    } else if (type === 'cocktail') {
      category = 'Cocktails';
      const recipeIngs = (this.rows.length && this.mode)
        ? this.rows.filter(r => r.id && (parseFloat(r.quantity) || 0) > 0).map(r => ({ source: r.source, id: r.id, quantity: parseFloat(r.quantity) || 0 }))
        : [];
      if (recipeIngs.length > 0) {
        recipe = { mode: 'single', ingredients: recipeIngs, plate_yield: null };
        targetPct = parseFloat(document.getElementById('ri-target-pct')?.value) || 22;
        const tmp = { recipe };
        computedCost = App.menuItemCost(tmp) || 0;
      } else {
        computedCost = parseFloat(document.getElementById('ri-cost')?.value) || 0;
      }
    } else if (type === 'inventory') {
      linkedProductId = this.linkedProductId || document.getElementById('ri-linked-prod')?.value || '';
      if (!linkedProductId) { fail('Pick an inventory product.'); return; }
      const p = this.prodById(linkedProductId);
      if (!p) { fail('Linked product not found.'); return; }
      category = this.IC_TO_MENU_CAT[p.category] || 'Other';
      const tmp = { linked_product_id: linkedProductId };
      computedCost = App.menuItemCost(tmp) || 0;
    }

    // Phase 7: capture optional pour_size_oz override on direct-pour items
    // (Inventory form only). Drives Variance Report multi-size math.
    let pourSizeOz = null;
    if (type === 'inventory') {
      const pourVal = parseFloat(document.getElementById('ri-pour')?.value);
      if (!isNaN(pourVal) && pourVal > 0) pourSizeOz = pourVal;
    }

    const entry = {
      id:                 existing?.id || App.uid(),
      name,
      category,
      price,
      cost:               computedCost,
      weekly_covers:      covers,
      notes,
      recipe,
      linked_product_id:  linkedProductId,
      pour_size_oz:       pourSizeOz,
      target_cost_pct:    targetPct,
      created_at:         existing?.created_at || new Date().toISOString(),
      updated_at:         new Date().toISOString()
    };

    if (this.editIdx !== null) this.items()[this.editIdx] = entry;
    else this.items().push(entry);

    await App.saveKey('menu_items');
    App.markSetupDone('gs_r_menu');
    if (recipe) App.markSetupDone('gs_p_recipes');
    this.editIdx = null;
    this.rows = [];
    this.mode = null;
    this.linkedProductId = '';
    this.formType = null;
    // Land back on the tab matching what we just saved
    this.activeTab = type;
    this.renderLanding();
  },

  // ── Import (CSV/Excel) ───────────────────────────────────────────────
  showImport() {
    this.actions.innerHTML = '';
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="rmi-imp-back">&#8592; Back to Menu Items</button></div>'
      + '<div class="card-title">Import Menu Items from File</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:12px;">Upload a CSV or Excel file with your menu items. Bar Cop reads your columns and maps them. Items import without recipes attached; you can edit each item afterwards to build recipes or link inventory products.</div>'
      + '<details style="margin-bottom:16px;"><summary style="font-size:11px;color:var(--t3);cursor:pointer;font-weight:700;letter-spacing:0.5px;">What should my file look like?</summary>'
      + '<div style="font-size:11px;color:var(--t2);line-height:1.7;margin-top:8px;padding:10px 12px;background:var(--input);border-radius:3px;">'
      + '<strong style="color:var(--t1);">First row must be column headers.</strong> One row per item.<br><br>'
      + '<strong style="color:var(--t1);">Columns Bar Cop recognizes:</strong><br>'
      + '&bull; <strong>Name / Item / Product / Description</strong> required<br>'
      + '&bull; <strong>Category / Type / Group</strong> optional<br>'
      + '&bull; <strong>Price / Menu Price / Sell Price</strong> optional<br>'
      + '&bull; <strong>Cost / Item Cost / COGS</strong> optional<br>'
      + '&bull; <strong>Covers / Weekly Covers / Volume / Qty</strong> optional<br><br>'
      + '<strong style="color:var(--t1);">Accepted formats:</strong> CSV, Excel (.xlsx, .xls)'
      + '</div></details>'
      + '<input type="file" id="rmi-imp-file" accept=".csv,.xlsx,.xls" style="background:var(--input);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:6px;font-size:11px;cursor:pointer;width:100%;margin-bottom:12px;"/>'
      + '<div id="rmi-imp-status" style="font-size:12px;color:var(--t2);margin-bottom:12px;display:none;"></div>'
      + '<div style="display:flex;gap:10px;">'
      + '<button class="btn btn-primary" id="rmi-imp-btn">Import Items</button>'
      + '<button class="btn btn-ghost" id="rmi-imp-cancel">Cancel</button>'
      + '</div></div></div>';

    const back = () => this.renderLanding();
    document.getElementById('rmi-imp-back')?.addEventListener('click', back);
    document.getElementById('rmi-imp-cancel')?.addEventListener('click', back);
    document.getElementById('rmi-imp-btn')?.addEventListener('click', async () => {
      const file = document.getElementById('rmi-imp-file')?.files?.[0];
      const status = document.getElementById('rmi-imp-status');
      if (!file) { if (status) { status.style.display = 'block'; status.textContent = 'Select a file first.'; } return; }
      if (status) { status.style.display = 'block'; status.textContent = 'Reading file...'; }
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { status.textContent = 'File appears empty.'; return; }
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
      const nameIdx  = headers.findIndex(h => ['name', 'item', 'product', 'description'].some(k => h.includes(k)));
      const catIdx   = headers.findIndex(h => ['category', 'type', 'group'].some(k => h.includes(k)));
      const priceIdx = headers.findIndex(h => ['price', 'menu price', 'sell'].some(k => h.includes(k)));
      const costIdx  = headers.findIndex(h => ['cost', 'cogs'].some(k => h.includes(k)));
      const covIdx   = headers.findIndex(h => ['cover', 'volume', 'qty', 'count'].some(k => h.includes(k)));
      if (nameIdx < 0) { status.textContent = 'Could not find a Name column. Make sure row 1 has headers.'; return; }
      const imported = [];
      lines.slice(1).forEach(line => {
        const cols = line.split(',').map(c => c.replace(/"/g, '').trim());
        const name = cols[nameIdx];
        if (!name) return;
        imported.push({
          id: App.uid(), name,
          category:      catIdx  >= 0 ? cols[catIdx]  : '',
          price:         priceIdx >= 0 ? parseFloat(cols[priceIdx]) || 0 : 0,
          cost:          costIdx  >= 0 ? parseFloat(cols[costIdx])  || 0 : 0,
          weekly_covers: covIdx   >= 0 ? parseFloat(cols[covIdx])   || 0 : 0,
          notes:         '',
          recipe:        null,
          linked_product_id: '',
          created_at:    new Date().toISOString(),
          updated_at:    new Date().toISOString()
        });
      });
      this.items().push(...imported);
      await App.saveKey('menu_items');
      App.markSetupDone('gs_r_menu');
      status.textContent = imported.length + ' items imported.';
      setTimeout(() => this.renderLanding(), 1000);
    });
  }
};
