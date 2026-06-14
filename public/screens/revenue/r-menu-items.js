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
  // All menu category groupings now live on App so they never drift across
  // the screens that consume them (r-menu-items, r-menu-engineering, r-pricing,
  // r-dog-test, recipe-cost-analysis). Read App.MENU_* directly.
  get PLATE_CATEGORIES()   { return App.MENU_PLATE_CATEGORIES; },
  get COCKTAIL_ING_CATS()  { return App.MENU_COCKTAIL_ING_CATS; },
  get PLATE_ING_CATS()     { return App.MENU_PLATE_ING_CATS; },
  get INVENTORY_GROUPS()   { return App.MENU_INVENTORY_GROUPS; },
  get IC_TO_MENU_CAT()     { return App.MENU_IC_TO_CAT; },

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
    if (actions) actions.innerHTML = '';
    this.renderLanding();
    // External focus (e.g. from Recipe Cost Analysis): open the editor modal in
    // place over the landing — no full-screen swap, works the same from any door.
    if (App._menuItemFocus) {
      const it = this.items().find(i => i.id === App._menuItemFocus);
      App._menuItemFocus = null;
      if (it) this.openEditor(it);
    }
  },

  // ── Landing: three cards + tabs + filtered table ─────────────────────
  CAT_ORDER: ['Cocktails', 'Appetizers', 'Entrees', 'Desserts', 'Specials', 'Beer', 'Wine', 'NA Beverages'],

  renderLanding() {
    const all = this.items();
    const incompleteN = all.filter(i => !i.price || (App.menuItemCost(i) || 0) === 0).length;

    const actionRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;">'
      + '<button class="btn btn-primary" id="mi-add">+ Add Menu Item</button>'
      + '<button class="btn btn-ghost btn-sm" id="mi-import">Import</button>'
      + '</div>';

    let body;
    if (!all.length) {
      body = '<div class="card form-card"><div class="empty">'
        + '<div class="empty-title">No menu items yet</div>'
        + '<div class="empty-sub">Add your cocktails, food, and direct-pour beer/wine. Each item carries its price and cost so Bar Cop can show your margins and flag what is bleeding.</div>'
        + '<button class="btn btn-primary" id="mi-add-empty" style="margin-top:14px;">+ Add Your First Item</button>'
        + '</div></div>';
    } else {
      const cats = [...new Set(all.map(i => i.category || 'Uncategorized'))]
        .sort((a, b) => {
          const ia = this.CAT_ORDER.indexOf(a), ib = this.CAT_ORDER.indexOf(b);
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
        });
      const warn = incompleteN > 0
        ? '<div style="background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:6px;padding:11px 16px;margin-bottom:16px;font-size:12px;color:var(--t1);">'
          + incompleteN + ' item' + (incompleteN > 1 ? 's' : '') + ' missing price or cost. Incomplete items are left out of Menu Engineering until you finish them.</div>'
        : '';
      const sections = cats.map(cat => {
        const items = all.filter(i => (i.category || 'Uncategorized') === cat)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const rows = items.map(item => {
          const cost = App.menuItemCost(item) || 0;
          const cm   = (item.price && cost) ? (item.price - cost) : null;
          const pct  = (item.price && cost) ? (cost / item.price * 100) : null;
          const tgt  = item.target_cost_pct || (this.classifyItem(item) === 'plate' ? App.MENU_TARGET_COST_PCT.plate : App.MENU_TARGET_COST_PCT.cocktail);
          const ok   = item.price && cost;
          const hasRecipe = !!(item.recipe && Array.isArray(item.recipe.ingredients) && item.recipe.ingredients.length);
          const src  = hasRecipe ? 'from recipe' : (item.linked_product_id ? 'from linked product' : (item.cost ? 'manual cost' : ''));
          return '<tr>'
            + '<td><div class="val" style="color:' + (ok ? 'var(--t1)' : 'var(--red)') + ';">' + esc(item.name) + '</div>'
            + (src ? '<div style="font-size:10px;color:var(--t3);">' + src + '</div>' : '')
            + (!ok ? '<div style="font-size:10px;font-weight:700;color:var(--red);">Incomplete</div>' : '') + '</td>'
            + '<td>' + (item.price ? App.fmtCurrency(item.price) : '-') + '</td>'
            + '<td>' + (cost ? App.fmtCurrency(cost) : '-') + '</td>'
            + '<td class="' + (pct != null ? (pct > tgt ? 'neg' : 'pos') : '') + '">' + (pct != null ? pct.toFixed(1) + '%' : '-') + '</td>'
            + '<td>' + (cm != null ? App.fmtCurrency(cm) : '-') + '</td>'
            + '<td>' + (item.weekly_covers ? item.weekly_covers : '-') + '</td>'
            + '<td><div class="row-actions">'
            + '<button class="btn btn-ghost btn-sm mi-edit" data-id="' + esc(item.id) + '">Edit</button>'
            + '<button class="btn btn-danger btn-sm mi-del" data-id="' + esc(item.id) + '">Delete</button>'
            + '</div></td></tr>';
        }).join('');
        return '<div class="sh" style="margin:22px 0 10px;">' + esc(cat) + '</div>'
          + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
          + '<th>' + esc(cat) + '</th><th>Price</th><th>Cost</th><th>Cost %</th><th>Margin</th><th>Wkly Covers</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
      }).join('');
      body = warn + sections;
    }

    this.container.innerHTML = '<div class="screen">' + actionRow + body + '</div>';

    document.getElementById('mi-add')?.addEventListener('click', () => this.openEditor(null));
    document.getElementById('mi-add-empty')?.addEventListener('click', () => this.openEditor(null));
    document.getElementById('mi-import')?.addEventListener('click', () => this.showImport());
    this.container.querySelectorAll('.mi-edit').forEach(b =>
      b.addEventListener('click', () => this.openEditor(this.items().find(i => i.id === b.dataset.id) || null)));
    this.container.querySelectorAll('.mi-del').forEach(b =>
      b.addEventListener('click', async () => {
        const ok = await App.confirmDelete();
        if (!ok) return;
        App.data.menu_items = this.items().filter(i => i.id !== b.dataset.id);
        await App.saveKey('menu_items');
        this.renderLanding();
      }));
  },

  // ── Editor (ONE modal, adapts to the chosen category) ────────────────────
  // Replaces the old three full-screen forms. Category drives the form:
  // Cocktails + food get the recipe builder; Beer/Wine/NA link an inventory
  // product. No "type" pre-choice, no No-Recipe toggle — add ingredients and
  // cost auto-computes, leave them empty and the cost field is yours to type.
  // This is the single edit door, opened here and (later) from Recipe Cost
  // Analysis, so no cross-section jump.
  typeForCategory(cat) {
    if (!cat) return null;
    if (cat === 'Cocktails') return 'cocktail';
    if (this.PLATE_CATEGORIES.includes(cat)) return 'plate';
    return 'inventory';
  },

  openEditor(item) {
    this._editItem = item || null;
    this.editIdx   = item ? this.items().findIndex(i => i.id === item.id) : null;
    this.formType  = item ? this.classifyItem(item) : null;
    this.linkedProductId = item?.linked_product_id || '';
    const hasRecipe = !!(item?.recipe && Array.isArray(item.recipe.ingredients) && item.recipe.ingredients.length);
    this.mode = hasRecipe ? item.recipe.mode : null;
    this.rows = hasRecipe
      ? item.recipe.ingredients.map(i => ({ source: i.source || 'product', id: i.id || i.product_id, quantity: i.quantity }))
      : [];
    this._editingIncomplete = !!(item && this.formType && this.missingFields(item, this.formType).size > 0);

    const invMenuCats = [...new Set(this.INVENTORY_GROUPS.map(g => g.menuCat))];
    const allCats = ['Cocktails'].concat(this.PLATE_CATEGORIES, invMenuCats);
    const catOpts = '<option value="">Select category...</option>'
      + allCats.map(c => '<option' + (item?.category === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');

    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">' + (item ? 'Edit Menu Item' : 'Add Menu Item') + '</div>'
      + '<div class="form-row">'
      + '<div class="f" style="flex:2;min-width:220px;"><label>Item Name</label><input class="form-input" type="text" id="ri-name" value="' + esc(item?.name || '') + '" placeholder="House Margarita"/></div>'
      + '<div class="f" style="flex:1;min-width:160px;"><label>Category</label><select class="form-input" id="ri-cat">' + catOpts + '</select></div>'
      + '</div>'
      + '<div id="mi-adaptive"></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="ri-save">' + (item ? 'Update Item' : 'Save Item') + '</button>'
      + '<button class="btn btn-ghost" id="ri-cancel">Cancel</button>'
      + '<span id="ri-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';

    App.openModal(html, { id: 'mi-editor', maxWidth: 680, noClose: true });
    document.getElementById('ri-cat')?.addEventListener('change', e => this.onCategoryChange(e.target.value));
    document.getElementById('ri-save')?.addEventListener('click', () => this._save(this._editItem));
    document.getElementById('ri-cancel')?.addEventListener('click', () => App.closeModal('mi-editor'));
    document.getElementById('ri-name')?.addEventListener('input', () => this.refreshFieldMissing());
    this.renderAdaptive(item);
    if (item) this.applyMissingFieldHighlights(item, this.formType);
  },

  onCategoryChange(cat) {
    this.formType = this.typeForCategory(cat);
    if (this.formType === 'inventory') { this.mode = null; this.rows = []; }
    else if (this.formType) {
      this.mode = this.formType === 'cocktail' ? 'single' : 'food';
      if (!this.rows.length) this.rows = [{ source: 'product', id: '', quantity: '' }];
    } else { this.mode = null; this.rows = []; }
    this.renderAdaptive(this._editItem);
    this.refreshFieldMissing();
  },

  renderAdaptive(item) {
    const host = document.getElementById('mi-adaptive');
    if (!host) return;
    if (!this.formType) {
      host.innerHTML = '<div style="font-size:12px;color:var(--t3);padding:14px 2px;">Pick a category and the rest of the form fills in.</div>';
      return;
    }
    if (this.formType === 'inventory') {
      host.innerHTML = this.inventoryFields(item);
      this.wireInventoryFields();
      return;
    }
    host.innerHTML = this.recipeFields(item);
    const target = item?.target_cost_pct || (this.formType === 'cocktail' ? App.MENU_TARGET_COST_PCT.cocktail : App.MENU_TARGET_COST_PCT.plate);
    this.renderRecipeSection(item, target);
    document.getElementById('ri-price')?.addEventListener('input', () => { this.refreshFieldMissing(); this.calcRecipe(); });
    document.getElementById('ri-cost')?.addEventListener('input', () => this.refreshFieldMissing());
  },

  recipeFields(item) {
    return '<div class="form-row">'
      + '<div class="f" style="width:150px;"><label>Menu Price</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ri-price" value="' + (item?.price || '') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f" style="width:150px;"><label>Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ri-cost" value="' + (item?.cost || '') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f" style="width:150px;"><label>Avg Weekly Covers</label><input class="form-input" type="number" id="ri-cov" value="' + (item?.weekly_covers || '') + '"/></div>'
      + '</div>'
      + '<div id="ri-recipe-section" style="border-top:1px solid var(--b2);padding-top:16px;margin-top:6px;"></div>'
      + '<div class="f" style="margin-top:16px;margin-bottom:0;"><label>Notes (optional)</label><input class="form-input" type="text" id="ri-notes" value="' + esc(item?.notes || '') + '"/></div>';
  },

  inventoryFields(item) {
    const linkedId = this.linkedProductId || item?.linked_product_id || '';
    const linkedProd = linkedId ? this.prodById(linkedId) : null;
    const autoCost = linkedProd ? (App.bottleCost ? (App.bottleCost(linkedProd) || linkedProd.unit_cost || 0) : (linkedProd.unit_cost || 0)) : 0;
    return '<div class="form-row"><div class="f" style="flex:1;min-width:240px;"><label>Inventory Product</label>'
      + '<select class="form-input" id="ri-linked-prod">' + this.inventoryProductOptions(linkedId) + '</select></div></div>'
      + '<div class="form-row">'
      + '<div class="f" style="width:150px;"><label>Menu Price</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ri-price" value="' + (item?.price || '') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f" style="width:170px;"><label>Cost <span style="color:var(--t4);font-weight:400;">(from product)</span></label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ri-cost" value="' + (autoCost > 0 ? autoCost.toFixed(2) : '') + '" step="0.01" placeholder="0.00" disabled/></div></div>'
      + '<div class="f" style="width:150px;"><label>Avg Weekly Covers</label><input class="form-input" type="number" id="ri-cov" value="' + (item?.weekly_covers || '') + '"/></div>'
      + '</div>'
      + '<div class="form-row"><div class="f" style="width:170px;"><label>Pour Size <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
      + '<div class="fw"><input class="form-input suf" type="number" id="ri-pour" value="' + (item?.pour_size_oz != null ? item.pour_size_oz : '') + '" step="0.25" min="0" placeholder="' + (linkedProd?.pour_size_oz != null ? linkedProd.pour_size_oz : 'oz') + '"/><span class="suf">oz</span></div></div></div>'
      + '<div class="f" style="margin-top:8px;margin-bottom:0;"><label>Notes (optional)</label><input class="form-input" type="text" id="ri-notes" value="' + esc(item?.notes || '') + '"/></div>';
  },

  wireInventoryFields() {
    document.getElementById('ri-linked-prod')?.addEventListener('change', e => {
      this.linkedProductId = e.target.value || '';
      const p = this.linkedProductId ? this.prodById(this.linkedProductId) : null;
      const costInp = document.getElementById('ri-cost');
      if (costInp) {
        const bc = p ? (App.bottleCost ? (App.bottleCost(p) || p.unit_cost || 0) : (p.unit_cost || 0)) : 0;
        costInp.value = bc > 0 ? bc.toFixed(2) : '';
      }
      const nameInp = document.getElementById('ri-name');
      if (nameInp && p) nameInp.value = p.name;
      this.refreshFieldMissing();
    });
    document.getElementById('ri-name')?.addEventListener('input', () => this.refreshFieldMissing());
    document.getElementById('ri-price')?.addEventListener('input', () => this.refreshFieldMissing());
  },

  // ── Plate Form ────────────────────────────────────────────────────────
  renderPlateForm(item) {
    const catOpts = this.PLATE_CATEGORIES.map(c =>
      '<option' + (item?.category === c ? ' selected' : '') + '>' + c + '</option>').join('');
    const hasRecipe = this.rows.length > 0 && this.mode;
    const target = item?.target_cost_pct || App.MENU_TARGET_COST_PCT.plate;

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
    const target = item?.target_cost_pct || App.MENU_TARGET_COST_PCT.cocktail;

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
  // Recipe builder (food + cocktail). Always shown for those categories — no
  // opt-out toggle. Add ingredients and cost auto-computes (Cost field locks);
  // add none and the Cost field above stays editable (calcRecipe handles it).
  renderRecipeSection(item, target) {
    const sec = document.getElementById('ri-recipe-section');
    if (!sec) return;
    if (!this.mode) this.mode = this.formType === 'cocktail' ? 'single' : 'food';
    const plateYieldField = this.mode === 'food'
      ? '<div class="f" style="width:140px;"><label>Plates Per Batch</label>'
        + '<input class="form-input" type="number" id="ri-plate-yield" value="' + (item?.recipe?.plate_yield || 1) + '" min="1"/></div>'
      : '';

    sec.innerHTML = '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:12px;">'
        + '<div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">Recipe</div>'
        + '<div style="font-size:11px;color:var(--t3);">Add ingredients and cost computes automatically. Leave empty to enter cost by hand.</div>'
      + '</div>'
      + '<div class="form-row" style="margin-bottom:12px;">'
        + '<div class="f" style="width:130px;"><label>Target Cost %</label>'
          + '<div class="fw"><input class="form-input suf" type="number" id="ri-target-pct" value="' + target + '" step="0.5"/><span class="suf">%</span></div></div>'
        + plateYieldField
      + '</div>'
      + '<div class="sh" style="margin-top:4px;">' + (this.mode === 'food' ? 'Kitchen' : 'Bar') + ' Ingredients</div>'
      + '<div id="ri-ings" style="margin-bottom:12px;"></div>'
      + '<button class="btn btn-ghost btn-sm" id="ri-add-ing" style="margin-bottom:14px;">+ Add Ingredient</button>'
      + '<div style="display:flex;gap:28px;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Cost Per Serving</div><div class="calc-val" id="ri-cps">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Recipe Cost %</div><div class="calc-val" id="ri-cpct">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Target</div><div class="calc-val dim" id="ri-tgt-d">-</div></div>'
      + '</div>';

    this.renderRows();
    this.calcRecipe();

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
    // Only let the recipe drive the cost field when a real ingredient is in
    // the builder (id + qty > 0). A blank starter row must NOT take over and
    // wipe a manually entered cost — otherwise opening a no-recipe item to
    // edit zeroes its cost and silently flips it to Incomplete on save.
    const costInp = document.getElementById('ri-cost');
    if (costInp) {
      const hasRealRecipe = this.rows.some(r => r.id && (parseFloat(r.quantity) || 0) > 0);
      if (hasRealRecipe) {
        costInp.value = cps > 0 ? cps.toFixed(2) : '';
        costInp.disabled = true;
      } else {
        costInp.disabled = false;
      }
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
    if (!this.formType) { fail('Pick a category first.'); return; }
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
        targetPct = parseFloat(document.getElementById('ri-target-pct')?.value) || App.MENU_TARGET_COST_PCT.plate;
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
        targetPct = parseFloat(document.getElementById('ri-target-pct')?.value) || App.MENU_TARGET_COST_PCT.cocktail;
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

    // If this is an edit, snapshot the prior weekly_covers before overwriting
    // so Menu Engineering can show the Menu Mix Delta column ("covers vs prior
    // update"). Only snapshot when the value actually changes — typing the
    // same number twice shouldn't reset the prior anchor.
    let prevCovers = existing?.prev_weekly_covers ?? null;
    let coversUpdatedAt = existing?.weekly_covers_updated_at || null;
    if (existing && existing.weekly_covers != null && covers !== existing.weekly_covers) {
      prevCovers = existing.weekly_covers;
      coversUpdatedAt = new Date().toISOString();
    }

    const entry = {
      id:                 existing?.id || App.uid(),
      name,
      category,
      price,
      cost:               computedCost,
      weekly_covers:      covers,
      prev_weekly_covers: prevCovers,
      weekly_covers_updated_at: coversUpdatedAt,
      notes,
      recipe,
      linked_product_id:  linkedProductId,
      pour_size_oz:       pourSizeOz,
      target_cost_pct:    targetPct,
      created_at:         existing?.created_at || new Date().toISOString(),
      updated_at:         new Date().toISOString()
    };

    // If this is an edit and the price changed, auto-write a revenue_price_log
    // entry + a fix_log entry so Menu Engineering's Pricing Review Log and the
    // Recovery Scoreboard both pick it up. Closes the orphan where direct
    // menu-items price edits used to bypass the log.
    const priceChanged = existing && existing.price != null && existing.price !== price;
    let priceLogRec = null, fixLogRec = null;
    if (priceChanged) {
      priceLogRec = {
        id: App.uid(),
        date: App.todayLocal(),
        item_id: entry.id,
        item_name: entry.name,
        old_price: existing.price,
        new_price: price,
        cost: computedCost,
        reason: 'Direct edit on Menu Items',
        margin_impact: price - existing.price,
        covers_at_change: existing.weekly_covers || 0,
        predicted_vol_pct: null,
        predicted_weekly_impact: null,
        source: 'menu-items-edit',
        saved_at: new Date().toISOString()
      };
      fixLogRec = {
        id: App.uid(),
        module: 'revenue',
        gap_id: 'pricing',
        gap_name: 'Pricing',
        date: App.todayLocal(),
        source: 'price-change',
        note: 'Price change on ' + entry.name + ': ' + App.fmtCurrency(existing.price) + ' to ' + App.fmtCurrency(price)
      };
    }

    if (this.editIdx !== null) this.items()[this.editIdx] = entry;
    else this.items().push(entry);

    await App.saveKey('menu_items');
    if (priceChanged) {
      await App.putRecord('core', 'revenue_price_log', priceLogRec);
      await App.putRecord('core', 'fix_log', fixLogRec);
    }
    App.markSetupDone('gs_r_menu');
    if (recipe) App.markSetupDone('gs_p_recipes');
    this.editIdx = null;
    this.rows = [];
    this.mode = null;
    this.linkedProductId = '';
    this.formType = null;
    App.closeModal('mi-editor');
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
