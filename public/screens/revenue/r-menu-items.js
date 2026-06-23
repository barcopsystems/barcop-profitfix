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

  showHowTo() {
    App.showHelpModal('How Menu Items Works', [
      { p: ['This is the one place you build and price your menu. Everything Bar Cop knows about an item, its price, cost, recipe and weekly covers, lives here, and Menu Engineering, Dog Test, and Recipe Summary all read from it.'] },
      { h: 'Adding an Item', p: ['Pick a category and the form fills in. Cocktails and food (Appetizers, Entrees, Desserts, Specials) get a recipe builder, so add ingredients and the cost computes itself, or skip the recipe and type a flat cost. Beer, Wine, NA, and Snacks link straight to an Inventory Control product, and the cost and menu price both auto-fill from that product (the price stays yours to change). The product list shows only the products that fit the category you picked, so there is nothing to scroll past. Snacks are packaged items you buy and sell whole (bagged chips, bottled NA), marked Sold on the menu in Inventory; their cost comes in per serving. Enter covers so Menu Engineering can weight the item by how often it sells.'] },
      { h: 'Importing', p: ['Switch the form to Import File to drop a spreadsheet of your whole menu at once. You map the columns, then items come in without recipes; edit any item afterward to build its recipe or link a product.'] },
      { h: 'Incomplete Items', p: ['An item missing a price or a cost shows as Incomplete and is left out of Menu Engineering until you finish it. The banner at the top counts how many are still open. Editing a price here also logs a pricing change so the Pricing Review and the Recovery Scoreboard pick it up.'] }
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

  renderLanding() {
    const all = this.items();
    const incompleteN = all.filter(i => !i.price || (App.menuItemCost(i) || 0) === 0).length;

    // Inline add form is always-on at the top (edit happens in the modal), so
    // the add state starts blank on every landing render.
    this._editItem = null;
    this.editIdx = null;
    this.formType = null;
    this.rows = [];
    this.mode = null;
    this.linkedProductId = '';
    this._editingIncomplete = false;
    this._editReturn = null;

    // Always-on inline Add form with an Enter Manually / Import File segmented
    // toggle ([[unified-import-pattern]]). Manual = the shared formBodyHtml()
    // builder (the same one the edit modal uses, so they never drift); Import =
    // the shared CSVMapper drop-file. Wrapped so openEditor can remove the whole
    // thing (card + buttons) before opening the modal — the ri-* ids are
    // identical, so only one form is ever in the DOM at a time.
    const segBtn = (mode, label) => {
      const on = this.entryMode === mode;
      return '<button type="button" class="btn btn-sm mi-mode" data-mode="' + mode + '" style="'
        + (on ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    };
    let modeBody, actionRow;
    if (this.entryMode === 'import') {
      modeBody  = '<div id="mi-csv"></div><div id="mi-imp-result"></div>';
      // Empty until a file is dropped; CSVMapper renders its Import / Cancel row
      // here (below the card) so there is no gap beforehand.
      actionRow = '<div id="mi-imp-actions" class="no-print" data-collapse-group="mi-add" style="margin:16px 0 24px;"></div>';
    } else {
      modeBody  = this.formBodyHtml(null);
      actionRow = '<div class="no-print" data-collapse-group="mi-add" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary" id="ri-save">Save Item</button>'
        + '<button class="btn btn-ghost" id="ri-start-over">Start Over</button>'
        + '<span id="ri-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';
    }
    const addWrap = '<div id="mi-add-wrap">'
      + '<div class="card form-card" style="margin-bottom:0;">'
        + App.collapsibleCardTitle('mi-add', 'Add Menu Item')
        + '<div class="collapse-body">'
          + '<div class="seg-toggle">' + segBtn('manual', 'Enter Manually') + segBtn('import', 'Import File') + '</div>'
          + modeBody
        + '</div>'
      + '</div>'
      + actionRow
    + '</div>';

    let body;
    if (!all.length) {
      body = '<div style="color:var(--t3);font-size:13px;margin-top:8px;">No menu items yet. Add your first one with the form above, or switch to Import File to bring your whole menu in at once.</div>';
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
      const sections = cats.map((cat, ci) => {
        const items = all.filter(i => (i.category || 'Uncategorized') === cat)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const rows = items.map(item => {
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
          return '<tr>'
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
        }).join('');
        // No outside titles above the cards — the category lives in the first
        // column header. The Export PDF button rides a title-less row above the
        // first card.
        return (ci === 0
            ? '<div class="no-print" style="display:flex;justify-content:flex-end;margin:16px 0 10px;"><button class="btn btn-ghost btn-sm" id="mi-export">Export PDF</button></div>'
            : '')
          + '<div class="card card-bleed data-card" style="margin-top:' + (ci === 0 ? '0' : '16') + 'px;"><div class="card-bleed-tbl"><table class="tbl" style="table-layout:fixed;width:100%;min-width:780px;">'
          + '<colgroup><col style="width:230px;"/><col/><col/><col/><col/><col/><col style="width:160px;"/></colgroup>'
          + '<thead><tr>'
          + '<th>' + esc(cat) + '</th><th>Price</th><th>Cost</th><th>Cost %</th><th>Margin</th><th>Wkly Covers</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
      }).join('');
      body = '<div id="mi-list-export">' + warn + sections + '</div>';
    }

    this.container.innerHTML = '<div class="screen">' + addWrap + body + '</div>';

    // Toggle wiring (both lanes)
    this.container.querySelectorAll('.mi-mode').forEach(b =>
      b.addEventListener('click', () => this.setEntryMode(b.dataset.mode)));

    if (this.entryMode === 'import') {
      this.mountImporter();
    } else {
      // Add-form wiring (always-on inline manual form)
      document.getElementById('ri-cat')?.addEventListener('change', e => this.onCategoryChange(e.target.value));
      document.getElementById('ri-save')?.addEventListener('click', () => this._save(null));
      document.getElementById('ri-start-over')?.addEventListener('click', () => this.resetAddForm());
      document.getElementById('ri-name')?.addEventListener('input', () => this.refreshFieldMissing());
      this.renderAdaptive(null);
    }

    // List wiring (edit opens the modal)
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

    // Collapsible Add card (chevron) + the menu PDF export on the first category row.
    const collapseHead = this.container.querySelector('.card-collapse-head');
    if (collapseHead) collapseHead.addEventListener('click', () => App.toggleCollapse(collapseHead));
    document.getElementById('mi-export')?.addEventListener('click', () => App.exportPDF({ title: 'Menu Items', root: document.getElementById('mi-list-export') }));
    App.applyCollapsed(this.container);
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
    this._editItem = item || null;
    // Optional return callback: a foreign door (Profit > Recipe Cost Analysis)
    // opens this modal IN PLACE over its own page and re-renders itself on close
    // instead of the Menu Items landing — so no cross-section jump.
    this._editReturn = (opts && opts.onDone) || null;
    this.editIdx   = item ? this.items().findIndex(i => i.id === item.id) : null;
    this.formType  = item ? this.classifyItem(item) : null;
    this.linkedProductId = item?.linked_product_id || '';
    const hasRecipe = !!(item?.recipe && Array.isArray(item.recipe.ingredients) && item.recipe.ingredients.length);
    this.mode = hasRecipe ? item.recipe.mode : null;
    this.rows = hasRecipe
      ? item.recipe.ingredients.map(i => ({ source: i.source || 'product', id: i.id || i.product_id, quantity: i.quantity }))
      : [];
    this._editingIncomplete = !!(item && this.formType && this.missingFields(item, this.formType).size > 0);

    // Remove the inline add form (card + buttons) so its ri-* / mi-adaptive ids
    // don't collide with the modal's. cancelEditor()/_save() rebuild it (blank)
    // via renderLanding() when the modal closes.
    document.getElementById('mi-add-wrap')?.remove();

    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">' + (item ? 'Edit Menu Item' : 'Add Menu Item') + '</div>'
      + this.formBodyHtml(item)
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="ri-save">' + (item ? 'Update Item' : 'Save Item') + '</button>'
      + '<button class="btn btn-ghost" id="ri-cancel">Cancel</button>'
      + '<span id="ri-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';

    App.openModal(html, { id: 'mi-editor', maxWidth: 680, noClose: true });
    document.getElementById('ri-cat')?.addEventListener('change', e => this.onCategoryChange(e.target.value));
    document.getElementById('ri-save')?.addEventListener('click', () => this._save(this._editItem));
    document.getElementById('ri-cancel')?.addEventListener('click', () => this.cancelEditor());
    document.getElementById('ri-name')?.addEventListener('input', () => this.refreshFieldMissing());
    this.renderAdaptive(item);
    if (item) this.applyMissingFieldHighlights(item, this.formType);
  },

  // Shared form body (Name + Category + the adaptive section) injected by BOTH
  // the inline add form on the landing AND the edit modal, so the two never
  // drift. The ri-* / mi-adaptive ids are identical, so only ONE of the two
  // forms is ever in the DOM at once (openEditor removes the inline form first).
  formBodyHtml(item) {
    const invMenuCats = [...new Set(this.INVENTORY_GROUPS.map(g => g.menuCat))];
    const allCats = ['Cocktails'].concat(this.PLATE_CATEGORIES, invMenuCats);
    const catOpts = '<option value="">Select category...</option>'
      + allCats.map(c => '<option' + (item?.category === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
    // One flex-wrap row holds every field: name + category + inventory product +
    // the adaptive price/cost/covers/pour cells (injected into mi-adaptive, which
    // is display:contents so its cells flow in the same row). The recipe builder
    // and notes carry flex:0 0 100% so they break to their own full-width lines.
    return '<div class="form-row">'
      + '<div class="f" style="width:185px;flex-shrink:0;"><label>Item Name</label><input class="form-input" type="text" id="ri-name" value="' + esc(item?.name || '') + '" placeholder="House Margarita"/></div>'
      + '<div class="f" style="width:145px;flex-shrink:0;"><label>Category</label><select class="form-input" id="ri-cat">' + catOpts + '</select></div>'
      + '<div class="f" id="mi-linked-slot" style="width:185px;flex-shrink:0;display:none;"></div>'
      + '<div id="mi-adaptive" style="display:contents;"></div>'
      + '</div>';
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
    this.renderAdaptive(this._editItem);
    this.refreshFieldMissing();
  },

  renderAdaptive(item) {
    const host = document.getElementById('mi-adaptive');
    const slot = document.getElementById('mi-linked-slot');
    if (slot) { slot.innerHTML = ''; slot.style.display = 'none'; }   // the inventory-product field rides the top row; reset it
    if (!host) return;
    if (!this.formType) {
      host.innerHTML = '<div style="flex:0 0 100%;font-size:12px;color:var(--t3);padding:14px 2px;">Pick a category and the rest of the form fills in.</div>';
      return;
    }
    if (this.formType === 'inventory') {
      // Inventory Product loads to the RIGHT of Category in the top row; price/
      // cost/covers/pour/notes go in the adaptive section below.
      if (slot) { slot.innerHTML = this.linkedFieldHtml(item); slot.style.display = ''; }
      host.innerHTML = this.inventoryRestHtml(item);
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
    return '<div class="f" style="width:100px;"><label>Menu Price</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ri-price" value="' + (item?.price || '') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f" style="width:95px;"><label>Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ri-cost" value="' + (item?.cost ? (+item.cost).toFixed(2) : '') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f" style="width:95px;"><label>Avg Covers</label><div class="fw"><input class="form-input suf" type="number" id="ri-cov" value="' + (item?.weekly_covers || '') + '"/><span class="suf">wk</span></div></div>'
      + '<div id="ri-recipe-section" style="flex:0 0 100%;border-top:1px solid var(--b2);padding-top:16px;margin-top:6px;"></div>'
      + '<div class="f" style="flex:0 0 100%;margin-top:16px;margin-bottom:0;"><label>Notes</label><input class="form-input" type="text" id="ri-notes" value="' + esc(item?.notes || '') + '" placeholder="Optional"/></div>';
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
    const autoCost = linkedProd ? (App.menuLinkCost(linkedProd, item?.pour_size_oz) || 0) : 0;
    // Pour Size only matters for poured drinks (Beer/Wine). Packaged resale
    // items (NA beverages, Snacks) are sold whole, so the field is dropped.
    const menuCat = document.getElementById('ri-cat')?.value || item?.category || '';
    // Pour Size only for products SOLD BY A POUR: draft beer (from a keg) and wine
    // by the glass. Bottle beer, NA, and snacks sell whole, so no pour. The cell is
    // rendered for the eligible categories but hidden until a poured product is
    // picked (toggled in the product-change handler).
    const pourEligible = menuCat !== 'NA Beverages' && menuCat !== 'Snacks';
    const pourShow = this.pourVisibleFor(menuCat, linkedProd);
    const pourField = pourEligible
      ? '<div class="f" id="ri-pour-cell" style="width:85px;' + (pourShow ? '' : 'display:none;') + '"><label>Pour Size</label>'
        + '<div class="fw"><input class="form-input suf" type="number" id="ri-pour" value="' + (item?.pour_size_oz != null ? item.pour_size_oz : '') + '" step="0.25" min="0" placeholder="' + (linkedProd?.pour_size_oz != null ? linkedProd.pour_size_oz : '') + '"/><span class="suf">oz</span></div></div>'
      : '';
    return '<div class="f" style="width:100px;"><label>Menu Price</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ri-price" value="' + (item?.price || '') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f" style="width:95px;"><label>Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ri-cost" value="' + (autoCost > 0 ? autoCost.toFixed(2) : '') + '" step="0.01" placeholder="0.00" disabled/></div></div>'
      + '<div class="f" style="width:95px;"><label>Avg Covers</label><div class="fw"><input class="form-input suf" type="number" id="ri-cov" value="' + (item?.weekly_covers || '') + '"/><span class="suf">wk</span></div></div>'
      + pourField
      + '<div class="f" style="flex:0 0 100%;margin-top:8px;margin-bottom:0;"><label>Notes</label><input class="form-input" type="text" id="ri-notes" value="' + esc(item?.notes || '') + '" placeholder="Optional"/></div>';
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
      const costInp = document.getElementById('ri-cost');
      if (!costInp) return;
      const pv = parseFloat(document.getElementById('ri-pour')?.value);
      const bc = p ? (App.menuLinkCost(p, (!isNaN(pv) && pv > 0) ? pv : null) || 0) : 0;
      costInp.value = bc > 0 ? bc.toFixed(2) : '';
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
      recomputeCost();
      // Auto-fill the menu price from the linked product's saved menu price,
      // the same way cost auto-fills. Beer + Wine carry a menu price in
      // Inventory; the operator can still override it here. Leave it editable.
      const priceInp = document.getElementById('ri-price');
      if (priceInp && p && p.menu_price > 0) priceInp.value = (+p.menu_price).toFixed(2);
      const nameInp = document.getElementById('ri-name');
      if (nameInp && p) nameInp.value = p.name;
      this.refreshFieldMissing();
    });
    document.getElementById('ri-pour')?.addEventListener('input', recomputeCost);
    document.getElementById('ri-name')?.addEventListener('input', () => this.refreshFieldMissing());
    document.getElementById('ri-price')?.addEventListener('input', () => this.refreshFieldMissing());
  },

  // ── Recipe section (used by the adaptive Cocktail + food editor) ─────
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
      + '<div style="background:var(--input);border:1px solid var(--b-edge);border-radius:8px;padding:14px 18px;">'
        + '<div style="display:flex;gap:30px;flex-wrap:wrap;align-items:center;">'
        + '<div class="calc-item"><div class="calc-label">Cost Per Serving</div><div class="calc-val" id="ri-cps">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Recipe Cost %</div><div class="calc-val" id="ri-cpct">-</div></div>'
        + '</div></div>';

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
        return '<tr class="mi-ing-line">'
          + '<td style="min-width:200px;"><select class="form-input ri-ing-src" data-i="' + idx + '" style="width:100%;">' + this.ingredientOptions(selKey, this.mode) + '</select></td>'
          + '<td style="width:90px;"><input class="form-input ri-ing-qty" type="number" data-i="' + idx + '" value="' + (r.quantity || '') + '" min="0" step="0.25" style="width:100%;padding:6px 8px;"/></td>'
          + '<td style="width:70px;color:var(--t2);font-size:12px;">' + basis.unit + '</td>'
          + '<td style="width:90px;font-size:12px;">' + costD + '</td>'
          + '<td style="width:90px;" class="val" id="ri-lc-' + idx + '">' + lineD + '</td>'
          + '<td style="width:80px;"><button class="btn btn-danger btn-sm ri-rm-ing" data-i="' + idx + '">Delete</button></td>'
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
      category = App.menuCatForProduct(p) || this.IC_TO_MENU_CAT[p.category] || 'Other';
      // Include the pour override so the stored cost is the per-pour cost too.
      const pv = parseFloat(document.getElementById('ri-pour')?.value);
      const tmp = { linked_product_id: linkedProductId, pour_size_oz: (!isNaN(pv) && pv > 0) ? pv : null };
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
      cost:               +(computedCost || 0).toFixed(2),
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
    const back = this._editReturn;
    this._editReturn = null;
    if (back) back(); else this.renderLanding();
  },

  // ── Import (CSVMapper drop-file behind the Import File toggle) ───────
  mountImporter() {
    const el = document.getElementById('mi-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your menu items file here',
      dropSub: 'Needs a column for item name. Category, price, cost, and weekly covers come in too if your file has them. Items import without recipes; edit an item afterward to build its recipe or link an inventory product.',
      actionsEl: '#mi-imp-actions',
      fields: [
        { key: 'name',     label: 'Item Name',    required: true,  match: ['name', 'item', 'item name', 'product', 'description', 'menu item'] },
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
