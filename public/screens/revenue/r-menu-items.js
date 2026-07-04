'use strict';

/* ── Revenue Recovery — Menu Items (THE single menu edit surface) ─────────────
   An always-on inline Add form (Enter Manually / Import File) sits on top; the
   menu below is grouped into category data-cards. The category you pick drives
   the form: Cocktails and food (Appetizers/Entrees/Desserts/Specials) get the
   recipe builder (cost auto-computes from ingredients, or type a flat cost);
   Beer/Wine/NA link an inventory product and the cost auto-fills. Editing opens
   one modal with the same shared form body, so add and edit never drift. This is
   the single edit door — also opened in place from Recipe Cost Analysis. */

S.RevenueMenuItems = {
  // ── State ─────────────────────────────────────────────────────────────
  editIdx:          null,
  formType:         null,        // 'plate' | 'cocktail' | 'inventory'
  rows:             [],          // recipe ingredient rows
  mode:             null,        // 'single' | 'food' — recipe mode
  linkedProductId:  '',          // for inventory items
  _saving:          false,
  entryMode:        'manual',    // inline add-form lane: 'manual' | 'import'
  activeType:       'plate',     // active tile/tab: 'plate' | 'cocktail' | 'inventory'
  _importOpen:      false,       // Upload panel open in place of the list
  _selected:        null,        // Set of item ids checked for bulk delete
  _recipeOpen:      false,       // recipe builder revealed (allow-but-nudge toggle)
  _otherPrices:     [],          // alternate menu prices (happy hour, specials)

  // ── Constants ─────────────────────────────────────────────────────────
  // All menu category groupings now live on App so they never drift across
  // the screens that consume them (r-menu-items, r-menu-engineering, r-dog-test,
  // recipe-cost-analysis). Read App.MENU_* directly.
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
      // Keep pure operating supplies (paper, cleaning) out of the recipe
      // ingredient picker — only mixers, food ingredients, and NA beverages
      // belong in a recipe.
      const inCat = prods.filter(p => (p.category || '') === cat && p.active !== false && !(cat === 'Misc' && App.miscIsSupply(p)))
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
    // The shared engine decides the measure (ounces for a pour, per-serving for a
    // solid) and its cost, so this preview matches the live menu cost exactly.
    const b = App.recipeBasis(p);
    return { unit: b.unitLabel, costPerUnit: b.costPerUnit };
  },

  // ── Inventory product picker (Card 3 / Inventory form) ───────────────
  inventoryProductOptions(selectedId, menuCat) {
    const prods = this.products().filter(p => p.active !== false);
    let h = '<option value="">Select inventory product...</option>';
    // Scope to the menu category the operator picked, so Beer shows only beers,
    // Wine only wines, NA only NA beverages, Snacks only packaged resale items.
    // With no category yet, every sellable group shows. menuCatForProduct is the
    // single classifier — each product lands in exactly one group.
    const groups = menuCat ? this.INVENTORY_GROUPS.filter(g => g.menuCat === menuCat) : this.INVENTORY_GROUPS;
    let totalShown = 0;
    groups.forEach(grp => {
      const inGrp = prods.filter(p => App.menuCatForProduct(p) === grp.menuCat)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (!inGrp.length) return;
      totalShown += inGrp.length;
      h += '<optgroup label="' + esc(grp.menuCat) + '">';
      inGrp.forEach(p => {
        h += '<option value="' + p.id + '"' + (p.id === selectedId ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      });
      h += '</optgroup>';
    });
    if (!totalShown) h += '<option value="" disabled>No ' + esc(menuCat || 'sellable') + ' products in Inventory Control yet</option>';
    return h;
  },

  // ── Required-field validation (shared) ───────────────────────────────
  missingFields(item, formType) {
    const out = new Set();
    if (!item) return out;
    if (formType === 'inventory') {
      if (!item.linked_product_id) out.add('ri-linked-prod');
      if (!(parseFloat(item.price) > 0)) out.add('ri-price');
      if (!item.name) out.add('ri-name');   // auto-fills from the product, but required
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

  showHowTo() {
    App.showHelpModal('How Menu Items Works', [
      { p: ['This is the one place you build and price your menu. Everything Bar Cop knows about an item, its price, cost, recipe and weekly covers, lives here, and Menu Engineering, Dog Test, and Recipe Summary all read from it.'] },
      { h: 'Adding an Item', p: ['Pick a category and the form fills in. Cocktails and food (Appetizers, Entrees, Desserts, Specials) get a recipe builder, so add ingredients and the cost computes itself, or skip the recipe and type a flat cost. Beer, Wine, NA, and Snacks link straight to an Inventory Control product, and the cost and menu price both auto-fill from that product (the price stays yours to change). The product list shows only the products that fit the category you picked, so there is nothing to scroll past. Snacks are packaged items you buy and sell whole (bagged chips, bottled NA), marked Sold on the menu in Inventory; their cost comes in per serving. Enter covers so Menu Engineering can weight the item by how often it sells.'] },
      { h: 'Importing', p: ['Switch the form to Import File to drop a spreadsheet of your whole menu at once. You map the columns, then items come in without recipes; edit any item afterward to build its recipe or link a product.'] },
      { h: 'Incomplete Items', p: ['An item missing a price or a cost shows as Incomplete and is left out of Menu Engineering until you finish it. The banner at the top counts how many are still open. Editing a price here also logs a pricing change so the Pricing Review Log in Menu Engineering picks it up.'] },
      { h: 'Archived Items', p: ['An item you cut from the Dog Test lands in an Archived list at the bottom of the page, kept out of the menu and out of Menu Engineering but not deleted. Restore brings one back onto the live menu with everything intact; Delete Permanently removes it for good after a confirm. You can only get here by cutting an item, so nothing archives by accident.'] }
    ]);
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
  CAT_ORDER: ['Cocktails', 'Appetizers', 'Entrees', 'Desserts', 'Specials', 'Beer', 'Wine', 'NA Beverages', 'Snacks'],

  // The three menu-item types, shown as tiles + tabs the way Add Products shows
  // its category cards + tabs, so Inventory and the Menu Builder read as one
  // connected surface. Each type's list groups by menu category into sections.
  TYPES: [
    { key: 'plate',     label: 'Dishes',    add: 'Add Dish Menu Item',     imp: 'Dish List',     noun: 'dish' },
    { key: 'cocktail',  label: 'Cocktails', add: 'Add Cocktail Menu Item', imp: 'Cocktail List', noun: 'cocktail' },
    { key: 'inventory', label: 'No Prep',   add: 'Add Inventory Item',     imp: 'No Prep List',  noun: 'no prep' }
  ],
  catsForType(type) {
    if (type === 'cocktail')  return ['Cocktails'];
    if (type === 'plate')     return this.PLATE_CATEGORIES.slice();
    if (type === 'inventory') return [...new Set(this.INVENTORY_GROUPS.map(g => g.menuCat))];
    return null;
  },

  renderLanding() {
    const everything = this.items();
    const all = everything.filter(i => !i.archived);
    const archivedItems = everything.filter(i => i.archived);
    if (!this.activeType) this.activeType = 'plate';

    // Reset the shared editor's transient state on every landing render (add
    // happens in the popup, so the landing itself holds no live form).
    this._editItem = null; this.editIdx = null; this.formType = null;
    this.rows = []; this.mode = null; this.linkedProductId = '';
    this._editingIncomplete = false; this._editReturn = null; this._addType = null;

    // ── Three tiles: Food Recipes / Cocktails / Inventory Items ───────────
    const tiles = this.TYPES.map(t => {
      const n = all.filter(i => this.classifyItem(i) === t.key).length;
      return '<div class="ip-card" data-type="' + t.key + '" style="background:var(--surface);border:1px solid var(--b-edge);border-radius:8px;padding:22px 18px 20px;text-align:center;">'
        + '<div style="font-size:17px;font-weight:800;color:var(--t1);letter-spacing:0.3px;margin-bottom:4px;">' + esc(t.label) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);">' + n + ' item' + (n === 1 ? '' : 's') + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:18px;">'
          + '<span class="mi-card-add" data-type="' + t.key + '" style="color:var(--gold);font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">+ ' + esc(t.add) + '</span>'
          + '<span style="font-size:10px;color:var(--t4);letter-spacing:1px;">or</span>'
          + '<button type="button" class="mi-card-imp" data-type="' + t.key + '" style="background:none;border:1px solid var(--b1);border-radius:4px;color:var(--t2);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 12px;cursor:pointer;">Upload ' + esc(t.imp) + '</button>'
        + '</div></div>';
    }).join('');
    const tilesBlock = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">' + tiles + '</div>';

    // ── Type tabs ─────────────────────────────────────────────────────────
    const tabs = '<div class="ch-tabs no-print">'
      + this.TYPES.map(t => {
          const on = this.activeType === t.key;
          const n = all.filter(i => this.classifyItem(i) === t.key).length;
          return '<button class="ch-tab mi-tab' + (on ? ' on' : '') + '" data-type="' + t.key + '">'
            + esc(t.label) + (n ? ' <span style="opacity:0.55;">' + n + '</span>' : '') + '</button>';
        }).join('')
      + '</div>';

    const lower = this._importOpen ? this.importPanelHTML() : this.listHTML(all);

    // Archived items (cut from a Dog Test, or archived here), across all types.
    const archivedSection = archivedItems.length
      ? '<div class="sh" style="margin:24px 0 10px;">Archived</div>'
        + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Item</th><th>Category</th><th>Price</th><th></th>'
        + '</tr></thead><tbody>'
        + archivedItems.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(item => '<tr>'
            + '<td><div class="val">' + esc(item.name) + '</div></td>'
            + '<td>' + esc(item.category || '') + '</td>'
            + '<td>' + (item.price ? App.fmtCurrency(item.price) : '-') + '</td>'
            + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm mi-restore" data-id="' + esc(item.id) + '">Restore</button>'
            + '<button class="btn btn-danger btn-sm mi-delperm" data-id="' + esc(item.id) + '">Delete Permanently</button></div></td>'
          + '</tr>').join('')
        + '</tbody></table></div>'
      : '';

    this.container.innerHTML = '<div class="screen">' + tilesBlock + tabs + lower + archivedSection + '</div>';
    this.wireLanding();
  },

  // The active type's items, grouped by menu category into section cards.
  listHTML(all) {
    const t = this.TYPES.find(x => x.key === this.activeType) || {};
    const typeItems = all.filter(i => this.classifyItem(i) === this.activeType);
    if (!typeItems.length) {
      return '<div class="card" style="margin-top:18px;padding:14px 20px;"><div style="font-size:12px;color:var(--t3);line-height:1.6;">No ' + esc((t.label || 'items').toLowerCase()) + ' yet. Use <strong>+ ' + esc(t.add || 'Add') + '</strong> above, or Upload to bring your menu in at once.</div></div>';
    }
    const incompleteN = typeItems.filter(i => !i.price || (App.menuItemCost(i) || 0) === 0).length;
    const cats = [...new Set(typeItems.map(i => i.category || 'Uncategorized'))]
      .sort((a, b) => {
        const ia = this.CAT_ORDER.indexOf(a), ib = this.CAT_ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
      });
    const warn = incompleteN > 0
      ? '<div style="background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:6px;padding:11px 16px;margin:16px 0;font-size:12px;color:var(--t1);">'
        + incompleteN + ' item' + (incompleteN > 1 ? 's' : '') + ' missing price or cost. Incomplete items are left out of Menu Engineering until you finish them.</div>'
      : '';
    // Select All / Clear + bulk delete + Export, same toolbar shape as Add Products.
    const selCount = this._selected ? this._selected.size : 0;
    const toolbar = '<div class="no-print" style="display:flex;align-items:center;gap:8px;margin:16px 0 10px;">'
      + '<button class="btn btn-ghost btn-sm mi-sel-all">Select All</button>'
      + '<button class="btn btn-ghost btn-sm mi-sel-clear">Clear</button>'
      + (selCount > 0 ? '<button class="btn btn-danger btn-sm mi-sel-del">Delete ' + selCount + ' Selected</button>' : '')
      + '<button class="btn btn-ghost btn-sm" id="mi-export" style="margin-left:auto;">Export PDF</button>'
      + '</div>';
    const sections = cats.map((cat, ci) => {
      const items = typeItems.filter(i => (i.category || 'Uncategorized') === cat)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const rows = items.map(item => this._itemRowHTML(item)).join('');
      return '<div class="card" style="overflow-x:auto;margin-top:' + (ci === 0 ? '0' : '16') + 'px;"><table class="row-list" style="table-layout:fixed;width:100%;">'
        + '<colgroup><col style="width:40px;"/><col style="width:230px;"/><col/><col/><col/><col/><col/><col style="width:160px;"/></colgroup>'
        + '<thead><tr>'
        + '<th></th><th>' + esc(cat) + '</th><th>Price</th><th>Cost</th><th>Cost %</th><th>Margin</th><th>Wkly Covers</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }).join('');
    return warn + toolbar + '<div id="mi-list-export">' + sections + '</div>';
  },

  _itemRowHTML(item) {
    const cost = App.menuItemCost(item) || 0;
    const cm   = (item.price && cost) ? (item.price - cost) : null;
    const pct  = (item.price && cost) ? (cost / item.price * 100) : null;
    const cls  = this.classifyItem(item);
    // Inventory-linked beer/wine/NA have no cocktail/plate cost target, so
    // leave their Cost % neutral rather than flagging it red vs 22%.
    const tgt  = item.target_cost_pct || (cls === 'plate' ? App.MENU_TARGET_COST_PCT.plate : cls === 'cocktail' ? App.MENU_TARGET_COST_PCT.cocktail : null);
    const ok   = item.price && cost;
    const hasRecipe = !!(item.recipe && Array.isArray(item.recipe.ingredients) && item.recipe.ingredients.length);
    const src  = hasRecipe ? 'from recipe' : (item.linked_product_id ? 'from linked product' : (item.cost ? 'manual cost' : ''));
    const checked = (this._selected && this._selected.has(item.id)) ? ' checked' : '';
    return '<tr>'
      + '<td style="width:40px;text-align:center;"><input type="checkbox" class="bc-check mi-sel" data-id="' + esc(item.id) + '"' + checked + '/></td>'
      + '<td><div class="val" style="color:' + (ok ? 'var(--t1)' : 'var(--red)') + ';">' + esc(item.name) + '</div>'
      + (src ? '<div style="font-size:10px;color:var(--t3);">' + src + '</div>' : '')
      + (!ok ? '<div style="font-size:10px;font-weight:700;color:var(--red);">Incomplete</div>' : '') + '</td>'
      + '<td>' + (item.price ? App.fmtCurrency(item.price) : '-') + '</td>'
      + '<td>' + (cost ? App.fmtCurrency(cost) : '-') + '</td>'
      + '<td class="' + (pct != null && tgt ? (pct > tgt ? 'neg' : 'pos') : '') + '">' + (pct != null ? pct.toFixed(1) + '%' : '-') + '</td>'
      + '<td>' + (cm != null ? App.fmtCurrency(cm) : '-') + '</td>'
      + '<td>' + (item.weekly_covers ? item.weekly_covers : '-') + '</td>'
      + '<td><div class="row-actions">'
      + '<button class="btn btn-ghost btn-sm mi-edit" data-id="' + esc(item.id) + '">Edit</button>'
      + '<button class="btn btn-danger btn-sm mi-del" data-id="' + esc(item.id) + '">Delete</button>'
      + '</div></td></tr>';
  },

  // The in-place Upload panel (replaces the list), mirroring Add Products.
  importPanelHTML() {
    const t = this.TYPES.find(x => x.key === this.activeType) || {};
    // Same layout as Add Products: the drop area lives inside the card, the Cancel
    // button sits on its own row below-left outside the card, and CSVMapper renders
    // its Import button into the actions row under that.
    return '<div class="card form-card">'
      + '<div class="card-title">Upload ' + esc(t.label || 'Menu') + ' List</div>'
      + '<div id="mi-csv"></div><div id="mi-imp-result"></div>'
      + '</div>'
      + '<div id="mi-imp-cancel-row" class="no-print" style="margin:16px 0 24px;"><button type="button" class="btn btn-ghost mi-imp-cancel">Cancel</button></div>'
      + '<div id="mi-imp-actions" class="no-print" style="margin:0 0 24px;"></div>';
  },
  openImport(type) {
    if (type) this.activeType = type;
    this._importOpen = true;
    this.renderLanding();
  },
  closeImport() {
    this._importOpen = false;
    this.renderLanding();
  },

  wireLanding() {
    // Tiles: + Add opens the popup editor scoped to the type; Upload opens the
    // in-place import panel for that type.
    this.container.querySelectorAll('.mi-card-add').forEach(el =>
      el.addEventListener('click', () => this.openEditor(null, { type: el.dataset.type })));
    this.container.querySelectorAll('.mi-card-imp').forEach(el =>
      el.addEventListener('click', () => this.openImport(el.dataset.type)));
    // Tabs switch the active type (and clear any selection).
    this.container.querySelectorAll('.mi-tab').forEach(b =>
      b.addEventListener('click', () => { this.activeType = b.dataset.type; this._importOpen = false; this._selected = new Set(); this.renderLanding(); }));

    // Select All / Clear + per-row checkboxes + bulk delete (active type only).
    this.container.querySelectorAll('.mi-sel-all').forEach(b => b.addEventListener('click', () => {
      const rows = this.items().filter(i => !i.archived && this.classifyItem(i) === this.activeType);
      this._selected = new Set(rows.map(i => i.id));
      this.renderLanding();
    }));
    this.container.querySelectorAll('.mi-sel-clear').forEach(b => b.addEventListener('click', () => { this._selected = new Set(); this.renderLanding(); }));
    this.container.querySelectorAll('.mi-sel').forEach(cb => cb.addEventListener('change', () => {
      if (!this._selected) this._selected = new Set();
      if (cb.checked) this._selected.add(cb.dataset.id); else this._selected.delete(cb.dataset.id);
      this.renderLanding();
    }));
    this.container.querySelector('.mi-sel-del')?.addEventListener('click', async () => {
      const ids = this._selected ? [...this._selected] : [];
      if (!ids.length) return;
      const ok = await App.confirm({
        title: 'Delete ' + ids.length + ' item' + (ids.length > 1 ? 's' : '') + '?',
        message: 'The selected menu items will be removed. This cannot be undone.',
        confirmText: 'Delete', danger: true
      });
      if (!ok) return;
      const kill = new Set(ids);
      App.data.menu_items = this.items().filter(i => !kill.has(i.id));
      this._selected = new Set();
      await App.saveKey('menu_items');
      this.renderLanding();
    });

    if (this._importOpen) {
      this.mountImporter();
      this.container.querySelector('.mi-imp-cancel')?.addEventListener('click', () => this.closeImport());
    }

    // List: Edit opens the popup; Delete removes.
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
    // Archived: restore or delete-permanently (guarded, no undo).
    this.container.querySelectorAll('.mi-restore').forEach(b =>
      b.addEventListener('click', async () => {
        const item = this.items().find(i => i.id === b.dataset.id);
        if (item) { item.archived = false; await App.saveKey('menu_items'); this.renderLanding(); }
      }));
    this.container.querySelectorAll('.mi-delperm').forEach(b =>
      b.addEventListener('click', async () => {
        const item = this.items().find(i => i.id === b.dataset.id);
        if (!item) return;
        const ok = await App.confirm({
          title: 'Delete this item permanently?',
          message: '"' + (item.name || 'This item') + '" will be removed for good. This cannot be undone.',
          confirmText: 'Delete Permanently', danger: true
        });
        if (!ok) return;
        App.data.menu_items = this.items().filter(i => i.id !== b.dataset.id);
        await App.saveKey('menu_items');
        this.renderLanding();
      }));

    document.getElementById('mi-export')?.addEventListener('click', () => App.exportPDF({ title: 'Menu', root: document.getElementById('mi-list-export') }));
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

  openEditor(item, opts) {
    opts = opts || {};
    this._editItem = item || null;
    // Optional return callback: a foreign door (Profit > Recipe Cost Analysis)
    // opens this modal IN PLACE over its own page and re-renders itself on close
    // instead of the Menu Builder landing — so no cross-section jump.
    this._editReturn = opts.onDone || null;
    // A tile "+ Add" passes its type so the new form opens scoped + ready: the
    // category picker is limited to that type and preset to its first category.
    this._addType = (!item && opts.type) ? opts.type : null;
    this._presetCat = this._addType ? ((this.catsForType(this._addType) || [])[0] || '') : '';
    this.editIdx   = item ? this.items().findIndex(i => i.id === item.id) : null;
    this.formType  = item ? this.classifyItem(item) : (this._presetCat ? this.typeForCategory(this._presetCat) : null);
    this.linkedProductId = item?.linked_product_id || '';
    const hasRecipe = !!(item?.recipe && Array.isArray(item.recipe.ingredients) && item.recipe.ingredients.length);
    // The recipe is optional (allow-but-nudge): an existing recipe opens expanded,
    // a new item starts collapsed behind a "+ Build Recipe" toggle with no rows.
    this._recipeOpen = hasRecipe;
    this.mode = hasRecipe ? item.recipe.mode : (this.formType === 'cocktail' ? 'single' : this.formType === 'plate' ? 'food' : null);
    this.rows = hasRecipe
      ? item.recipe.ingredients.map(i => ({ source: i.source || 'product', id: i.id || i.product_id, quantity: i.quantity }))
      : [];
    this._otherPrices = (item && Array.isArray(item.other_prices)) ? item.other_prices.map(o => ({ label: o.label, price: o.price })) : [];
    this._editingIncomplete = !!(item && this.formType && this.missingFields(item, this.formType).size > 0);

    // Remove the inline add form (card + buttons) so its ri-* / mi-adaptive ids
    // don't collide with the modal's. cancelEditor()/_save() rebuild it (blank)
    // via renderLanding() when the modal closes.
    document.getElementById('mi-add-wrap')?.remove();

    // An inventory-linked item is a few fields, so it gets the standard narrow
    // two-column form (540); a recipe item carries the ingredient builder, so it
    // runs at the prep-batch width (900). Kept in step on category change below.
    const isInv = this.formType === 'inventory';
    const editLbl = { plate: 'Dish', cocktail: 'Cocktail', inventory: 'No Prep Item' }[this.formType] || 'Menu Item';
    const addTitle = this.formType === 'plate' ? 'Add Dish Item'
      : this.formType === 'cocktail' ? 'Add Cocktail Item'
      : this.formType === 'inventory' ? 'Add No Prep Item' : 'Add Menu Item';
    const title = item ? ('Edit ' + editLbl) : addTitle;
    const html = '<div class="card form-card' + (isInv ? ' narrow-form' : '') + '" id="mi-editor-card" style="margin:0;">'
      + '<div class="card-title">' + title + '</div>'
      + this.formBodyHtml(item)
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="ri-save">' + (item ? 'Update Item' : 'Save Item') + '</button>'
      + '<span id="ri-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';

    App.openModal(html, { id: 'mi-editor', maxWidth: isInv ? 540 : 660, onClose: () => this.cancelEditor() });
    document.getElementById('ri-cat')?.addEventListener('change', e => this.onCategoryChange(e.target.value));
    document.getElementById('ri-save')?.addEventListener('click', () => this._save(this._editItem));
    document.getElementById('ri-name')?.addEventListener('input', () => this.refreshFieldMissing());
    this.renderAdaptive(item);
    if (item) this.applyMissingFieldHighlights(item, this.formType);
  },

  // Shared form body (Category + the adaptive section) injected by BOTH the inline
  // add form on the landing AND the edit modal, so the two never drift. The ri-* /
  // mi-adaptive ids are identical, so only ONE of the two forms is ever in the DOM
  // at once (openEditor removes the inline form first).
  formBodyHtml(item) {
    // On a tile "+ Add" the category picker is scoped to that type; on edit it
    // shows every category so an item can still be recategorized.
    const scoped = (!item && this._addType) ? this.catsForType(this._addType) : null;
    const invMenuCats = [...new Set(this.INVENTORY_GROUPS.map(g => g.menuCat))];
    const allCats = scoped || ['Cocktails'].concat(this.PLATE_CATEGORIES, invMenuCats);
    const selCat = item?.category || this._presetCat || '';
    const scopeType = item ? this.classifyItem(item) : this._addType;
    // Cocktails are the only category in their tab, so the picker is hidden (kept
    // as a fixed value); every other type shows the Category dropdown.
    const catCell = scopeType === 'cocktail'
      ? '<input type="hidden" id="ri-cat" value="Cocktails"/>'
      : '<div class="f" style="width:130px;flex-shrink:0;"><label>Category</label><select class="form-input" id="ri-cat">'
        + '<option value="">Select category...</option>'
        + allCats.map(c => '<option' + (selCat === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('')
        + '</select></div>';
    const nameSlot = '<div class="f" id="mi-name-slot" style="width:150px;flex-shrink:0;display:none;"></div>';
    const linkedSlot = '<div class="f" id="mi-linked-slot" style="width:185px;flex-shrink:0;display:none;"></div>';
    const adaptive = '<div id="mi-adaptive" style="display:contents;"></div>';
    // Recipe types lead with Menu Name then Category; inventory leads with
    // Category, then the Inventory Product picker, then the Menu Name that
    // auto-fills from the product. The adaptive price/cost/covers cells flow into
    // mi-adaptive (display:contents); the recipe builder and notes carry 100%.
    const order = scopeType === 'inventory'
      ? (catCell + linkedSlot + nameSlot + adaptive)
      : (nameSlot + catCell + adaptive);
    return '<div class="form-row">' + order + '</div>';
  },

  // Close the edit modal and return to the calling page — the Menu Items landing
  // by default (rebuilds the inline add form), or a foreign door's own re-render.
  cancelEditor() {
    App.closeModal('mi-editor');
    const back = this._editReturn;
    this._editReturn = null;
    if (back) back(); else this.renderLanding();
  },

  // Start Over on the inline add form = a clean, blank landing render.
  resetAddForm() {
    this.renderLanding();
  },

  // Flip the inline add form between typing one item and dropping a file.
  setEntryMode(mode) {
    this.entryMode = mode === 'import' ? 'import' : 'manual';
    this.renderLanding();
  },

  onCategoryChange(cat) {
    this.formType = this.typeForCategory(cat);
    // Switching to (or between) an inventory category resets the linked product
    // so the scoped picker starts blank instead of holding a stale pick from the
    // previous category.
    if (this.formType === 'inventory') { this.mode = null; this.rows = []; this.linkedProductId = ''; }
    else if (this.formType) {
      this.mode = this.formType === 'cocktail' ? 'single' : 'food';
      if (!this.rows.length) this.rows = [{ source: 'product', id: '', quantity: '' }];
    } else { this.mode = null; this.rows = []; }
    this.syncEditorWidth();
    this.renderAdaptive(this._editItem);
    this.refreshFieldMissing();
  },

  // When the edit modal is open, keep its width + layout matched to the category:
  // the narrow two-column form for an inventory product, the wider recipe-builder
  // form (prep-batch width) for cocktails and plates. No-op on the inline add form.
  syncEditorWidth() {
    const overlay = document.getElementById('mi-editor');
    if (!overlay) return;
    const isInv = this.formType === 'inventory';
    document.getElementById('mi-editor-card')?.classList.toggle('narrow-form', isInv);
    const box = overlay.firstElementChild;
    if (box) box.style.maxWidth = (isInv ? 540 : 660) + 'px';
  },

  renderAdaptive(item) {
    const host = document.getElementById('mi-adaptive');
    const nameSlot = document.getElementById('mi-name-slot');
    const slot = document.getElementById('mi-linked-slot');
    if (nameSlot) { nameSlot.innerHTML = ''; nameSlot.style.display = 'none'; }
    if (slot) { slot.innerHTML = ''; slot.style.display = 'none'; }
    if (!host) return;
    if (!this.formType) {
      host.innerHTML = '<div style="flex:0 0 100%;font-size:12px;color:var(--t3);padding:14px 2px;">Pick a category and the rest of the form fills in.</div>';
      return;
    }
    if (this.formType === 'inventory') {
      // Inventory: the Inventory Product picker loads right after Category, then a
      // Menu Name that auto-fills from the product (still editable), then
      // price/cost/covers/pour/notes fill the adaptive section below.
      if (slot) { slot.innerHTML = this.linkedFieldHtml(item); slot.style.display = ''; }
      if (nameSlot) { nameSlot.innerHTML = this.nameFieldHtml(item); nameSlot.style.display = ''; }
      host.innerHTML = this.inventoryRestHtml(item);
      this.wireInventoryFields();
      return;
    }
    // Recipe types carry a real typed name, so the Menu Name field loads right
    // after Category.
    if (nameSlot) { nameSlot.innerHTML = this.nameFieldHtml(item); nameSlot.style.display = ''; }
    host.innerHTML = this.recipeFields(item);
    document.getElementById('ri-name')?.addEventListener('input', () => this.refreshFieldMissing());
    this.renderRecipeArea(item);
    this.renderOtherPrices(item);
    document.getElementById('ri-price')?.addEventListener('input', () => { this.refreshFieldMissing(); this.calcRecipe(); });
    // Manual cost edits (no recipe) refresh the alternate-price cost %s too.
    document.getElementById('ri-cost')?.addEventListener('input', () => { this.refreshFieldMissing(); this.recalcAllPrices(); });
  },

  // The recipe area toggles: a "+ Build Recipe" button when closed (the item can
  // be saved with just a manual cost), the full ingredient builder when open.
  renderRecipeArea(item) {
    const wrap = document.getElementById('ri-recipe-wrap');
    if (!wrap) return;
    if (this._recipeOpen) {
      wrap.innerHTML = '<div id="ri-recipe-section" style="border-top:1px solid var(--b2);padding-top:16px;margin-top:6px;"></div>';
      const target = item?.target_cost_pct || (this.formType === 'cocktail' ? App.MENU_TARGET_COST_PCT.cocktail : App.MENU_TARGET_COST_PCT.plate);
      this.renderRecipeSection(item, target);
    } else {
      wrap.innerHTML = '<div style="border-top:1px solid var(--b2);padding-top:14px;margin-top:6px;">'
        + '<span id="ri-build-recipe" style="color:var(--gold);font-size:12px;font-weight:700;letter-spacing:0.5px;cursor:pointer;">+ Build Recipe</span>'
        + '<span style="font-size:11px;color:var(--t3);margin-left:12px;">Optional — add a recipe for accurate, auto-updating cost.</span>'
        + '</div>';
      document.getElementById('ri-build-recipe')?.addEventListener('click', () => {
        this._recipeOpen = true;
        if (!this.rows.length) this.rows = [{ source: 'product', id: '', quantity: '' }];
        this.renderRecipeArea(item);
      });
    }
  },

  // ── Other Prices (happy hour / specials): one item, several price points ─────
  // Same recipe cost, each price shows its own cost %, so the operator can see
  // whether a happy-hour price runs into a loss. Margin visibility only — no
  // sales-mix blend (that would need POS covers split by price).
  renderOtherPrices(item) {
    const wrap = document.getElementById('ri-other-prices-wrap');
    if (!wrap) return;
    const rows = (this._otherPrices || []).map((o, i) => this.priceRowHTML(o, i)).join('');
    wrap.innerHTML = '<div style="border-top:1px solid var(--b2);padding-top:14px;margin-top:6px;">'
      + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">'
        + '<label style="margin:0;">Other Prices <span style="color:var(--t4);font-weight:400;">(happy hour, specials)</span></label>'
        + '<span id="ri-add-price" style="color:var(--gold);font-size:12px;font-weight:700;letter-spacing:0.5px;cursor:pointer;">+ Add Price</span>'
      + '</div>'
      + '<div id="ri-op-list">' + rows + '</div>'
      + '</div>';
    document.getElementById('ri-add-price')?.addEventListener('click', () => {
      this.syncOtherPrices();
      this._otherPrices.push({ label: '', price: '' });
      this.renderOtherPrices(item);
    });
    wrap.querySelectorAll('.op-row').forEach(r => this.wirePriceRow(r));
  },
  priceRowHTML(o) {
    o = o || {};
    return '<div class="op-row" style="display:flex;gap:10px;align-items:flex-end;margin-bottom:8px;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Name</label><input type="text" class="op-label" value="' + esc(o.label || '') + '" placeholder="Happy Hour"/></div>'
      + '<div class="f" style="width:100px;flex-shrink:0;"><label>Price</label><div class="fw"><span class="pre">$</span><input class="pre op-price" type="number" step="0.25" min="0" value="' + (o.price != null && o.price !== '' ? o.price : '') + '"/></div></div>'
      + '<div style="font-size:11px;color:var(--t3);padding-bottom:9px;white-space:nowrap;">Cost <span class="op-pct" style="font-weight:700;color:var(--t1);">-</span></div>'
      + '<button type="button" class="btn btn-ghost btn-sm op-del" style="margin-bottom:2px;">Remove</button>'
      + '</div>';
  },
  wirePriceRow(row) {
    row.querySelector('.op-price')?.addEventListener('input', () => this.recalcPriceRow(row));
    row.querySelector('.op-del')?.addEventListener('click', () => row.remove());
    this.recalcPriceRow(row);
  },
  recalcPriceRow(row) {
    if (!row) return;
    const span = row.querySelector('.op-pct');
    if (!span) return;
    const cost = parseFloat(document.getElementById('ri-cost')?.value) || 0;
    const price = parseFloat(row.querySelector('.op-price')?.value) || 0;
    const pct = (cost > 0 && price > 0) ? (cost / price * 100) : null;
    const target = parseFloat(document.getElementById('ri-target-pct')?.value)
      || (this.formType === 'cocktail' ? App.MENU_TARGET_COST_PCT.cocktail : App.MENU_TARGET_COST_PCT.plate);
    span.textContent = pct != null ? pct.toFixed(1) + '%' : '-';
    span.style.color = pct == null ? 'var(--t1)' : (pct > target ? 'var(--red)' : 'var(--green)');
  },
  recalcAllPrices() { document.querySelectorAll('.op-row').forEach(r => this.recalcPriceRow(r)); },
  syncOtherPrices() {
    this._otherPrices = [...document.querySelectorAll('.op-row')].map(r => ({
      label: r.querySelector('.op-label')?.value.trim() || '',
      price: parseFloat(r.querySelector('.op-price')?.value) || ''
    }));
  },

  // The Menu Name field, loaded into #mi-name-slot. Typed for recipe items; for
  // inventory items it auto-fills from the chosen product (still editable).
  nameFieldHtml(item) {
    const ph = this.formType === 'plate' ? 'Anchor Burger'
      : this.formType === 'cocktail' ? 'House Margarita'
      : 'Auto-fills from the product';
    return '<label>Menu Name</label><input class="form-input" type="text" id="ri-name" value="' + esc(item?.name || '') + '" placeholder="' + esc(ph) + '"/>';
  },

  recipeFields(item) {
    return '<div class="f" style="width:90px;"><label>Menu Price</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ri-price" value="' + (item?.price || '') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f" style="width:85px;"><label>Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ri-cost" value="' + (item?.cost ? (+item.cost).toFixed(2) : '') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f" style="width:85px;"><label>Avg Covers</label><div class="fw"><input class="form-input suf" type="number" id="ri-cov" value="' + (item?.weekly_covers || '') + '"/><span class="suf">wk</span></div></div>'
      + '<div id="ri-recipe-wrap" style="flex:0 0 100%;"></div>'
      + '<div id="ri-other-prices-wrap" style="flex:0 0 100%;"></div>'
      + '<div style="flex:0 0 100%;">' + App.noteField({ id: 'ri-notes', value: item?.notes, placeholder: 'Optional', mt: 6 }) + '</div>';
  },

  // The inventory-product picker — rendered into the top-row slot (right of
  // Category), at normal width.
  linkedFieldHtml(item) {
    const linkedId = this.linkedProductId || item?.linked_product_id || '';
    const menuCat = document.getElementById('ri-cat')?.value || item?.category || '';
    return '<label>Inventory Product</label>'
      + '<select class="form-input" id="ri-linked-prod">' + this.inventoryProductOptions(linkedId, menuCat) + '</select>';
  },
  // Everything below the top row for an inventory item: price, cost, covers, pour, notes.
  inventoryRestHtml(item) {
    const linkedId = this.linkedProductId || item?.linked_product_id || '';
    const linkedProd = linkedId ? this.prodById(linkedId) : null;
    const menuCat = document.getElementById('ri-cat')?.value || item?.category || '';
    // Poured drinks (Beer/Wine) carry a Pour Size; Food/Misc resale/side items
    // (NA Beverages, Snacks) carry a Portion in the product's own recipe measure
    // (servings or ounces), so the cost is portion x per-serving / per-ounce.
    const pourEligible = menuCat !== 'NA Beverages' && menuCat !== 'Snacks';
    const amount = pourEligible ? item?.pour_size_oz : item?.portion;
    const autoCost = linkedProd ? (App.menuLinkCost(linkedProd, amount) || 0) : 0;
    // Pour Size only for products SOLD BY A POUR: draft beer (from a keg) and wine
    // by the glass. Rendered for eligible categories but hidden until a poured
    // product is picked (toggled in the product-change handler).
    const pourShow = this.pourVisibleFor(menuCat, linkedProd);
    const pourField = pourEligible
      ? '<div class="f" id="ri-pour-cell" style="width:85px;' + (pourShow ? '' : 'display:none;') + '"><label>Pour Size</label>'
        + '<div class="fw"><input class="form-input suf" type="number" id="ri-pour" value="' + (item?.pour_size_oz != null ? item.pour_size_oz : '') + '" step="0.25" min="0" placeholder="' + (linkedProd?.pour_size_oz != null ? linkedProd.pour_size_oz : '') + '"/><span class="suf">oz</span></div></div>'
      : '';
    // Portion (NA Beverages / Snacks): how many servings / ounces of the linked
    // product this menu item is. A Side of Fries is 1 serving, a Basket is 3.
    const basis = linkedProd && App.recipeBasis ? App.recipeBasis(linkedProd) : null;
    const portionUnit = basis ? basis.unitLabel : 'ea';
    const portionField = !pourEligible
      ? '<div class="f" id="ri-portion-cell" style="width:120px;"><label>Portion</label>'
        + '<div class="fw"><input class="form-input suf" type="number" id="ri-portion" value="' + (item?.portion != null ? item.portion : '') + '" step="0.25" min="0" placeholder="1"/><span class="suf" id="ri-portion-unit">' + esc(portionUnit) + '</span></div></div>'
      : '';
    return '<div class="f" style="width:100px;"><label>Menu Price</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ri-price" value="' + (item?.price || '') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f" style="width:95px;"><label>Avg Covers</label><div class="fw"><input class="form-input suf" type="number" id="ri-cov" value="' + (item?.weekly_covers || '') + '"/><span class="suf">wk</span></div></div>'
      + pourField
      + portionField
      // Auto-calculated cost + cost % in one strip at the bottom, matching the
      // recipe forms' Cost Per Serving / Recipe Cost % strip.
      + '<div style="flex:0 0 100%;background:var(--input);border:1px solid var(--b-edge);border-radius:8px;padding:14px 18px;margin-top:6px;"><div style="display:flex;gap:30px;flex-wrap:wrap;align-items:center;">'
        + '<div class="calc-item"><div class="calc-label">Cost</div><div class="calc-val" id="ri-inv-cost">' + (autoCost > 0 ? App.fmtCurrency(autoCost) : '-') + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Cost %</div><div class="calc-val" id="ri-inv-pct">' + (autoCost > 0 && item?.price > 0 ? (autoCost / item.price * 100).toFixed(1) + '%' : '-') + '</div></div>'
        + '</div></div>'
      + '<div style="flex:0 0 100%;">' + App.noteField({ id: 'ri-notes', value: item?.notes, placeholder: 'Optional', mt: 6 }) + '</div>';
  },
  // Pour Size applies only to products sold by a pour: draft beer and wine by the
  // glass. Bottle beer sells whole, so it carries no pour size.
  pourVisibleFor(menuCat, prod) {
    if (menuCat === 'NA Beverages' || menuCat === 'Snacks') return false;
    if (menuCat === 'Beer') return !!(prod && prod.category === 'Draft Beer');
    return true;
  },

  wireInventoryFields() {
    // Cost auto-fills from the linked product, honoring the Pour Size (poured
    // beverages cost per pour, so a bigger pour costs more) — recomputed on both
    // a product change and a pour change.
    const recomputeCost = () => {
      const p = this.linkedProductId ? this.prodById(this.linkedProductId) : null;
      const costEl = document.getElementById('ri-inv-cost');
      if (!costEl) return;
      // Food / Misc cost by the Portion; beer / wine by the Pour Size.
      const isFoodMisc = p && (p.category === 'Food' || p.category === 'Misc');
      const raw = parseFloat(document.getElementById(isFoodMisc ? 'ri-portion' : 'ri-pour')?.value);
      const amount = (!isNaN(raw) && raw > 0) ? raw : null;
      const bc = p ? (App.menuLinkCost(p, amount) || 0) : 0;
      costEl.textContent = bc > 0 ? App.fmtCurrency(bc) : '-';
      const price = parseFloat(document.getElementById('ri-price')?.value) || 0;
      const pctEl = document.getElementById('ri-inv-pct');
      if (pctEl) pctEl.textContent = (bc > 0 && price > 0) ? (bc / price * 100).toFixed(1) + '%' : '-';
    };
    document.getElementById('ri-linked-prod')?.addEventListener('change', e => {
      this.linkedProductId = e.target.value || '';
      const p = this.linkedProductId ? this.prodById(this.linkedProductId) : null;
      // Pour Size shows only for poured products (draft beer, wine by the glass);
      // hide and clear it for bottle beer and the like before recomputing cost.
      const pourCell = document.getElementById('ri-pour-cell');
      if (pourCell) {
        const show = this.pourVisibleFor(document.getElementById('ri-cat')?.value || '', p);
        pourCell.style.display = show ? '' : 'none';
        if (!show) { const pi = document.getElementById('ri-pour'); if (pi) pi.value = ''; }
      }
      // Update the Portion field's inline unit to the product's recipe measure
      // (slice / oz / ea) so the operator sees what they're entering.
      const punit = document.getElementById('ri-portion-unit');
      if (punit && p && App.recipeBasis) punit.textContent = App.recipeBasis(p).unitLabel;
      recomputeCost();
      // Auto-fill the menu price from the linked product's saved menu price,
      // the same way cost auto-fills. Beer + Wine carry a menu price in
      // Inventory; the operator can still override it here. Leave it editable.
      const priceInp = document.getElementById('ri-price');
      if (priceInp && p && p.menu_price > 0) priceInp.value = (+p.menu_price).toFixed(2);
      // Auto-fill the Menu Name from the product; the operator can still edit it.
      const nameInp = document.getElementById('ri-name');
      if (nameInp && p) nameInp.value = p.name;
      this.refreshFieldMissing();
    });
    document.getElementById('ri-pour')?.addEventListener('input', recomputeCost);
    document.getElementById('ri-portion')?.addEventListener('input', recomputeCost);
    document.getElementById('ri-name')?.addEventListener('input', () => this.refreshFieldMissing());
    document.getElementById('ri-price')?.addEventListener('input', () => { this.refreshFieldMissing(); recomputeCost(); });
  },

  // ── Recipe section (used by the adaptive Cocktail + food editor) ─────
  // Recipe builder (food + cocktail). Always shown for those categories — no
  // opt-out toggle. Add ingredients and cost auto-computes (Cost field locks);
  // add none and the Cost field above stays editable (calcRecipe handles it).
  renderRecipeSection(item, target) {
    const sec = document.getElementById('ri-recipe-section');
    if (!sec) return;
    if (!this.mode) this.mode = this.formType === 'cocktail' ? 'single' : 'food';
    // No Plates Per Batch: a menu item is one plate, so the recipe is per plate.
    // Target Cost % lives in the stat box (not its own row), next to Recipe Cost %.
    sec.innerHTML = '<div id="ri-ings" style="margin-bottom:10px;"></div>'
      + '<div style="margin-bottom:14px;"><span id="ri-add-ing" style="color:var(--gold);font-size:12px;font-weight:700;letter-spacing:0.5px;cursor:pointer;">+ Add Ingredient</span></div>'
      + '<div style="background:var(--input);border:1px solid var(--b-edge);border-radius:8px;padding:14px 18px;">'
        + '<div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-end;">'
        + '<div class="calc-item"><div class="calc-label">Target Cost %</div>'
          + '<div class="fw" style="max-width:88px;"><input class="form-input suf" type="number" id="ri-target-pct" value="' + target + '" step="0.5" style="padding:5px 8px;"/><span class="suf">%</span></div></div>'
        + '<div class="calc-item"><div class="calc-label">Recipe Cost %</div><div class="calc-val" id="ri-cpct">-</div></div>'
        + '</div></div>'
      + '<div style="margin-top:12px;"><span id="ri-remove-recipe" style="color:var(--t3);font-size:11px;cursor:pointer;text-decoration:underline;">Remove recipe</span></div>';

    this.renderRows();
    this.calcRecipe();

    document.getElementById('ri-add-ing')?.addEventListener('click', () => { this.addRow(); this.calcRecipe(); });
    document.getElementById('ri-target-pct')?.addEventListener('input', () => this.calcRecipe());
    // Remove Recipe is a quiet link, and it confirms first when there are real
    // ingredients so an accidental click can't wipe a built recipe.
    document.getElementById('ri-remove-recipe')?.addEventListener('click', async () => {
      const hasReal = this.rows.some(r => r.id && (parseFloat(r.quantity) || 0) > 0);
      if (hasReal) {
        const ok = await App.confirm({ title: 'Remove this recipe?', message: 'The ingredients will be cleared and the item goes back to a manual cost.', confirmText: 'Remove Recipe', danger: true });
        if (!ok) return;
      }
      this._recipeOpen = false;
      this.rows = [];
      this.renderRecipeArea(item);
      this.calcRecipe();
    });
  },

  renderRows() {
    const area = document.getElementById('ri-ings');
    if (!area) return;
    // Pill rows everywhere (matches the prep-batch builder); only the wrapper
    // differs so the modal keeps it a table on desktop while the inline add form
    // stacks it through the .pill-wrap container query.
    const inModal = !!area.closest('#app-modal-host');
    const wrapOpen = inModal ? '<div style="overflow-x:auto;">' : '<div class="pill-wrap">';
    // The operator enters a pour (cocktail) or a serving (plate) with the unit
    // shown inline; they care about the cost of that pour/serving and its % of the
    // menu price, not the raw stock unit cost. So the row is Ingredient · Amount ·
    // Cost · Cost %, dropping the old Unit and Unit Cost columns.
    const amtHdr = this.mode === 'single' ? 'Pour' : 'Serving';
    area.innerHTML = wrapOpen
      + '<table class="ing-tbl pill"><thead><tr><th>Ingredient</th><th>' + amtHdr + '</th><th>Cost</th><th>Cost %</th><th></th></tr></thead>'
      + '<tbody>' + this.rows.map((r, idx) => {
        const selKey = r.id ? (r.source === 'batch' ? 'b:' : 'p:') + r.id : '';
        const basis = this.ingredientCostBasis(r, this.mode);
        const qty = parseFloat(r.quantity) || 0;
        const lineCost = qty * (basis.costPerUnit || 0);
        const lineD = lineCost > 0 ? App.fmtCurrency(lineCost) : '-';
        const unitLbl = (basis.unit && basis.unit !== '-') ? basis.unit : '';
        return '<tr class="mi-ing-line">'
          + '<td data-label="Ingredient" style="min-width:200px;"><select class="form-input ri-ing-src" data-i="' + idx + '" style="width:100%;">' + this.ingredientOptions(selKey, this.mode) + '</select></td>'
          + '<td data-label="' + amtHdr + '" style="width:130px;"><div style="display:flex;align-items:center;gap:6px;"><input class="form-input ri-ing-qty" type="number" data-i="' + idx + '" value="' + (r.quantity || '') + '" min="0" step="0.25" style="width:74px;padding:6px 8px;"/><span style="color:var(--t3);font-size:11px;white-space:nowrap;">' + esc(unitLbl) + '</span></div></td>'
          + '<td data-label="Cost" style="width:90px;" class="val" id="ri-lc-' + idx + '">' + lineD + '</td>'
          + '<td data-label="Cost %" style="width:80px;font-size:12px;color:var(--t2);" id="ri-pct-' + idx + '">-</td>'
          + '<td data-label="" style="width:70px;"><button class="btn btn-danger btn-sm ri-rm-ing" data-i="' + idx + '">Delete</button></td>'
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
    const py = this.mode === 'food' ? (parseFloat(document.getElementById('ri-plate-yield')?.value) || 1) : 1;
    const mp  = parseFloat(document.getElementById('ri-price')?.value) || 0;
    let tc = 0;
    this.rows.forEach((r, idx) => {
      const basis = this.ingredientCostBasis(r, this.mode);
      const qty = parseFloat(r.quantity) || 0;
      const line = qty * (basis.costPerUnit || 0);
      tc += line;
      const le = document.getElementById('ri-lc-' + idx);
      if (le) le.textContent = line > 0 ? App.fmtCurrency(line) : '-';
      // Per-ingredient cost % of the menu price (per plate for a multi-yield food
      // recipe) so the operator can spot one pour/portion eating too much.
      const pe = document.getElementById('ri-pct-' + idx);
      const perPlate = py > 0 ? line / py : line;
      if (pe) pe.textContent = (perPlate > 0 && mp > 0) ? (perPlate / mp * 100).toFixed(1) + '%' : '-';
    });
    const cps = (this.mode === 'food' && py > 0) ? tc / py : tc;
    const tpct = parseFloat(document.getElementById('ri-target-pct')?.value) || 0;
    const cpct = mp > 0 ? (cps / mp * 100) : null;
    const set = (id, val, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = val; el.className = 'calc-val' + (cls ? ' ' + cls : ''); };
    set('ri-cps', cps > 0 ? App.fmtCurrency(cps) : '-');
    set('ri-cpct', cpct != null ? cpct.toFixed(1) + '%' : '-', cpct != null && tpct > 0 ? (cpct > tpct ? 'warn' : 'good') : '');
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
    this.recalcAllPrices();
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
    // Recipe types carry a typed name; inventory items take the product's name
    // (set in the inventory branch below), so the name check waits until after.
    let name = document.getElementById('ri-name')?.value.trim() || '';
    const price = parseFloat(document.getElementById('ri-price')?.value) || 0;
    const covers = parseFloat(document.getElementById('ri-cov')?.value) || 0;
    const notes = document.getElementById('ri-notes')?.value || '';

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
      if (!name) name = p.name;   // Menu Name auto-fills from the product; fall back if cleared
      category = App.menuCatForProduct(p) || this.IC_TO_MENU_CAT[p.category] || 'Other';
      // Cost from the per-item amount: Food/Misc by Portion, beer/wine by Pour.
      const isFoodMisc = p.category === 'Food' || p.category === 'Misc';
      const raw = parseFloat(document.getElementById(isFoodMisc ? 'ri-portion' : 'ri-pour')?.value);
      const amt = (!isNaN(raw) && raw > 0) ? raw : null;
      const tmp = isFoodMisc
        ? { linked_product_id: linkedProductId, portion: amt }
        : { linked_product_id: linkedProductId, pour_size_oz: amt };
      computedCost = App.menuItemCost(tmp) || 0;
    }

    if (!name) { fail('Item name required.'); return; }

    // Phase 7: capture optional pour_size_oz override on direct-pour items
    // (Inventory form only). Drives Variance Report multi-size math.
    let pourSizeOz = null;
    let portion = null;
    if (type === 'inventory') {
      const lp = this.prodById(linkedProductId);
      if (lp && (lp.category === 'Food' || lp.category === 'Misc')) {
        const portVal = parseFloat(document.getElementById('ri-portion')?.value);
        if (!isNaN(portVal) && portVal > 0) portion = portVal;
      } else {
        const pourVal = parseFloat(document.getElementById('ri-pour')?.value);
        if (!isNaN(pourVal) && pourVal > 0) pourSizeOz = pourVal;
      }
    }

    // Other Prices (happy hour / specials) on dish + cocktail items: one item,
    // several price points; same cost, each carries its own margin.
    const otherPrices = [];
    if (type === 'plate' || type === 'cocktail') {
      document.querySelectorAll('.op-row').forEach(r => {
        const price = parseFloat(r.querySelector('.op-price')?.value);
        if (!isNaN(price) && price > 0) otherPrices.push({ label: (r.querySelector('.op-label')?.value.trim() || 'Other'), price });
      });
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

    // Setting the price directly here is a LIVE change, so a pending Menu
    // Engineering plan for this item is cleared (the new live price supersedes
    // it). A non-price edit carries the plan forward so it is not silently lost.
    const priceChanged = existing && existing.price != null && existing.price !== price;
    const entry = {
      id:                 existing?.id || App.uid(),
      name,
      category,
      price,
      cost:               +(computedCost || 0).toFixed(2),
      weekly_covers:      covers,
      prev_weekly_covers: prevCovers,
      weekly_covers_updated_at: coversUpdatedAt,
      notes,
      recipe,
      linked_product_id:  linkedProductId,
      pour_size_oz:       pourSizeOz,
      portion:            portion,
      other_prices:       otherPrices,
      target_cost_pct:    targetPct,
      planned_price:      priceChanged ? null : (existing && existing.planned_price != null ? existing.planned_price : null),
      planned_vol_pct:    priceChanged ? null : (existing && existing.planned_vol_pct != null ? existing.planned_vol_pct : null),
      planned_at:         priceChanged ? null : (existing && existing.planned_at ? existing.planned_at : null),
      created_at:         existing?.created_at || new Date().toISOString(),
      updated_at:         new Date().toISOString()
    };

    if (this.editIdx !== null) this.items()[this.editIdx] = entry;
    else this.items().push(entry);

    await App.saveKey('menu_items');
    // A direct price edit on an existing item is a real reprice: log it through
    // the one canonical pricing logger (no prediction — that is a Menu
    // Engineering reprice thing) so the Pricing Review Log and Recovery pick it up.
    if (priceChanged) {
      await App.logPriceChange(entry, existing.price, price, { reason: 'Direct edit on Menu Items', source: 'menu-items-edit' });
    }
    App.markSetupDone('gs_r_menu');
    if (recipe) App.markSetupDone('gs_p_recipes');
    this.editIdx = null;
    this.rows = [];
    this.mode = null;
    this.linkedProductId = '';
    this.formType = null;
    App.closeModal('mi-editor');
    const back = this._editReturn;
    this._editReturn = null;
    if (back) back(); else this.renderLanding();
  },

  // ── Import (CSVMapper drop-file behind the Import File toggle) ───────
  mountImporter() {
    const el = document.getElementById('mi-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    const t = this.TYPES.find(x => x.key === this.activeType) || { noun: 'menu' };
    const dropSub = this.activeType === 'plate'
      ? 'Needs a column for dish name. Category (Appetizers, Entrees, Sides...), price, and cost come in if your file has them. Dishes import without recipes; edit one afterward to build its recipe.'
      : this.activeType === 'cocktail'
      ? 'Needs a column for cocktail name. Price and cost come in if your file has them. Cocktails import without recipes; edit one afterward to build its recipe.'
      : 'Needs a column for item name. Category (NA Beverages, Snacks), price, and cost come in if your file has them. Edit an item afterward to link its inventory product.';
    CSVMapper.mount(el, {
      dropTitle: 'Drop your ' + t.noun + ' items file here',
      dropSub: dropSub,
      onState: state => { const row = document.getElementById('mi-imp-cancel-row'); if (row) row.style.display = (state === 'map') ? 'none' : ''; },
      actionsEl: '#mi-imp-actions',
      fields: [
        { key: 'name',     label: 'Menu Name',    required: true,  match: ['name', 'item', 'item name', 'menu name', 'product', 'description', 'menu item'] },
        { key: 'category', label: 'Category',     required: false, match: ['category', 'type', 'group', 'section'] },
        { key: 'price',    label: 'Menu Price',   required: false, match: ['price', 'menu price', 'sell price', 'sell', 'retail'] },
        { key: 'cost',     label: 'Cost',         required: false, match: ['cost', 'item cost', 'cogs', 'food cost', 'plate cost'] },
        { key: 'covers',   label: 'Weekly Covers',required: false, match: ['covers', 'cover', 'weekly covers', 'volume', 'qty', 'quantity', 'count', 'sold'] }
      ],
      confirmLabel: 'Import',
      onComplete: rows => this.importItems(rows)
    });
  },

  async importItems(rows) {
    const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
    const toAdd = [];
    rows.forEach(r => {
      const name = (r.name || '').trim();
      if (!name) return;
      toAdd.push({
        id:                 App.uid(),
        name,
        category:           (r.category || '').trim(),
        price:              num(r.price),
        cost:               +(num(r.cost)).toFixed(2),
        weekly_covers:      num(r.covers),
        prev_weekly_covers: null,
        weekly_covers_updated_at: null,
        notes:              '',
        recipe:             null,
        linked_product_id:  '',
        pour_size_oz:       null,
        target_cost_pct:    null,
        created_at:         new Date().toISOString(),
        updated_at:         new Date().toISOString()
      });
    });

    const result = document.getElementById('mi-imp-result');
    if (!toAdd.length) {
      if (result) result.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">No items imported. No item names were found in the file.</div>';
      return;
    }

    this.items().push(...toAdd);
    await App.saveKey('menu_items');
    App.markSetupDone('gs_r_menu');
    // Re-render so the new items show in the list below (stays in import mode),
    // then drop the summary into the freshly-mounted result slot.
    this.renderLanding();
    const res2 = document.getElementById('mi-imp-result');
    if (res2) res2.innerHTML = '<div style="font-size:13px;color:var(--gold);font-weight:700;margin-top:12px;">'
      + 'Imported ' + toAdd.length + ' item' + (toAdd.length === 1 ? '' : 's') + '. Edit any item to set its price, cost, or recipe.'
      + '</div>';
  }
};
