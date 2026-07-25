'use strict';

/* ── Revenue Recovery — Menu Builder (THE single menu edit surface) ───────────
   Three add tiles (Dishes / Cocktails / No Prep) open one shared modal; the menu
   below is grouped section-first into the operator's own categories, any item
   type mixing freely inside a section. The tile sets the item TYPE (which drives
   the form + cost model): Dishes and Cocktails get the recipe builder (cost auto-
   computes from ingredients, or type a flat cost); No Prep links an inventory
   product and the cost auto-fills. The Category is a separate free-form menu
   SECTION, shared across all three forms and edited via the | Edit popup. Editing
   opens the same modal, so add and edit never drift. This is the single edit door
   — also opened in place from Recipe Cost Analysis. */

S.RevenueMenuItems = {
  // ── State ─────────────────────────────────────────────────────────────
  editIdx:          null,
  formType:         null,        // 'plate' | 'cocktail' | 'inventory'
  rows:             [],          // recipe ingredient rows
  mode:             null,        // 'single' | 'food' — recipe mode
  linkedProductId:  '',          // for inventory items
  _saving:          false,
  entryMode:        'manual',    // inline add-form lane: 'manual' | 'import'
  activeType:       'plate',     // which TILE an add/upload was opened from: 'plate' | 'cocktail' | 'inventory'
  // The visible LIST tab. Deliberately separate from activeType: that one records which tile the
  // operator opened a form from (the importer stamps item.type off it), and reusing it for the
  // list would make browsing a tab silently change what the next upload creates.
  activeTab:        'plate',     // 'plate' | 'cocktail' | 'inventory' | 'Inactive'
  // The one extra tab after the three types. "Inactive" matches Add Products, which is the
  // pattern this mirrors — deliberately NOT "Archived", the word this screen used before.
  INACTIVE_TAB:     'Inactive',
  _importOpen:      false,       // Upload panel open in place of the list
  _selected:        null,        // Set of item ids checked for bulk delete
  _recipeOpen:      false,       // recipe builder revealed (allow-but-nudge toggle)

  // ── Constants ─────────────────────────────────────────────────────────
  // All menu category groupings now live on App so they never drift across
  // the screens that consume them (r-menu-items, r-menu-engineering, r-dog-test,
  // recipe-cost-analysis). Read App.MENU_* directly.
  get COCKTAIL_ING_CATS()  { return App.MENU_COCKTAIL_ING_CATS; },
  get PLATE_ING_CATS()     { return App.MENU_PLATE_ING_CATS; },

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
    // Explicit type is the source of truth (set on save). Category is now a free-
    // form menu section and no longer implies the item's kind. Fall back to the
    // legacy signals for older items saved before the type field existed.
    if (item.type === 'plate' || item.type === 'cocktail' || item.type === 'inventory') return item.type;
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
    let renderedSel = false;

    const catList = mode === 'food' ? this.PLATE_ING_CATS : this.COCKTAIL_ING_CATS;
    catList.forEach(cat => {
      // Keep pure operating supplies (paper, cleaning) out of the recipe
      // ingredient picker — only mixers, food ingredients, and NA beverages
      // belong in a recipe.
      // ⚠ Inactive products stay OUT on purpose (you should not be able to add a discontinued
      // product to a recipe) — EXCEPT the one already selected on this row. Without that exception
      // a recipe that still costs correctly renders as "Select ingredient..." and the operator
      // re-picks or deletes a good ingredient by hand. Same fix as ic-prep-batches.prodOpts.
      // ⚠ THE EXCEPTION APPLIES TO EVERY EXCLUSION, not just `active`. It was added to the
      // inactive test alone, so a Misc product already in a recipe that was later switched
      // to a supply type (Bar Supplies / Paper & To-Go / Cleaning & Supplies) dropped out
      // and the row rendered "Select ingredient..." over a line that was still costing
      // correctly — the identical symptom Kyle found on Frozen Margarita Mix, on a second
      // axis. Keeping a product out of being CHOSEN is right; hiding one that is already
      // there is not.
      const inCat = prods.filter(p => (p.category || '') === cat
          && (p.active !== false || selKey === 'p:' + p.id)
          && !(cat === 'Misc' && App.miscIsSupply(p) && selKey !== 'p:' + p.id))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (!inCat.length) return;
      h += '<optgroup label="' + esc(cat) + '">';
      inCat.forEach(p => {
        if (selKey === 'p:' + p.id) renderedSel = true;
        h += '<option value="p:' + p.id + '"' + (selKey === 'p:' + p.id ? ' selected' : '') + '>' + esc(p.name)
          + (p.active === false ? ' (inactive)' : (App.miscIsSupply(p) ? ' (supply)' : '')) + '</option>';
      });
      h += '</optgroup>';
    });
    // Cross-category backstop, the twin of inventoryProductOptions': catList does not cover every
    // category, so a product re-categorised OUT of the recipe cats after it was added to a recipe
    // would fall through every group and the row would render "Select ingredient..." over a line
    // still costing correctly. Keep the selected PRODUCT present whatever excludes it (S111b).
    if (selKey && selKey.slice(0, 2) === 'p:' && !renderedSel) {
      const sel = this.prodById(selKey.slice(2));
      if (sel) h += '<optgroup label="Currently in recipe"><option value="p:' + sel.id + '" selected>' + esc(sel.name) + '</option></optgroup>';
    }
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

  // ── Inventory product picker (No Prep form) ──────────────────────────
  // Shows the products you can sell as-is, grouped by what they actually are in
  // inventory (not by menu section). Beer and Wine are always sellable; a Food or
  // Misc item shows only when it is ticked "Sold on the menu" in Add Products, so
  // raw ingredients and supplies stay out of the list.
  _sellableInventory(p) {
    const c = p && p.category;
    if (c === 'Bottle Beer' || c === 'Draft Beer' || c === 'Wine') return true;
    // A ticked Food/Misc item, but never a pure supply (paper, cleaning, bar supplies)
    // even if its box got ticked by mistake.
    if ((c === 'Food' || c === 'Misc') && p.sold_on_menu && !App.miscIsSupply(p)) return true;
    return false;
  },
  // The one obvious menu section for a product, or '' when it is ambiguous. Beer,
  // wine, and NA beverages have a single natural home; food/other misc do not.
  _certainMenuSection(p) {
    if (!p) return '';
    if (p.category === 'Bottle Beer' || p.category === 'Draft Beer') return 'Beer';
    if (p.category === 'Wine') return 'Wine';
    if (p.category === 'Misc' && p.misc_type === 'NA Beverage') return 'NA Beverages';
    return '';
  },
  inventoryProductOptions(selectedId) {
    // ⚠ The CURRENTLY LINKED product is always kept, whatever excludes it. This picker had
    // no such exception at all — S35 only fixed the recipe pickers — so a menu item linked
    // to a product that was later made inactive, un-ticked from "Sold on the menu", or
    // switched to a supply type rendered "Select inventory product..." over a link that
    // was still costing correctly. Three more doors onto the same blank-row symptom Kyle
    // found on Frozen Margarita Mix. Keeping a product out of being CHOSEN is right;
    // hiding one that is already linked is not.
    const keep = (p) => (p.active !== false && this._sellableInventory(p)) || p.id === selectedId;
    const prods = this.products().filter(keep);
    let h = '<option value="">Select inventory product...</option>';
    const ORDER = ['Draft Beer', 'Bottle Beer', 'Wine', 'Food', 'Misc'];
    let total = 0;
    let renderedSelected = false;
    // Why a kept option is unusual, so a supply sitting in this list is not a mystery.
    const label = (p) => esc(p.name)
      + (p.active === false ? ' (inactive)'
        : (!this._sellableInventory(p) ? ' (not sold on the menu)' : ''));
    ORDER.forEach(cat => {
      const inGrp = prods.filter(p => p.category === cat)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (!inGrp.length) return;
      total += inGrp.length;
      h += '<optgroup label="' + esc(cat) + '">';
      inGrp.forEach(p => {
        if (p.id === selectedId) renderedSelected = true;
        h += '<option value="' + p.id + '"' + (p.id === selectedId ? ' selected' : '') + '>' + label(p) + '</option>';
      });
      h += '</optgroup>';
    });
    // ⚠ ORDER does not cover every category (a product re-categorised to Liquor after it
    // was linked would fall through every group), so the selected option is guaranteed
    // here rather than assumed. The rule is that it is ALWAYS present.
    if (selectedId && !renderedSelected) {
      const sel = this.prodById(selectedId);
      if (sel) {
        h += '<optgroup label="Currently linked">'
          + '<option value="' + sel.id + '" selected>' + label(sel) + '</option></optgroup>';
        total++;
      }
    }
    if (!total) h += '<option value="" disabled>No sellable products yet — mark a Food/Misc item "Sold on the menu" in Add Products, or add beer/wine.</option>';
    return h;
  },

  // ── Required-field validation (shared) ───────────────────────────────
  missingFields(item, formType) {
    const out = new Set();
    if (!item) return out;
    if (formType === 'inventory') {
      if (!item.linked_product_id) out.add('ri-linked-prod');
      if (!item.category) out.add('ri-cat');   // a No Prep item needs a menu section too
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
    // ⚠ ri-cost means "we cannot cost this yet" — key it off the ACTUAL cost, not just the presence
    // of a recipe (S176). A DANGLING recipe (an ingredient's product was deleted) has ingredients but
    // App.menuItemCost returns null, so `hasRecipe` alone let it sit Complete while it was uncosted.
    const costed = App.menuItemCost ? App.menuItemCost(item) > 0 : (hasRecipe || hasCost);
    if (!costed) out.add('ri-cost');
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
    App.showHelpModal('How Menu Builder Works', [
      { p: ['This is the one place you build and price your menu. Everything Bar Cop knows about an item, its price, cost, recipe and weekly units sold, lives here, and Menu Engineering, Dog Test, and Recipe Summary all read from it.'] },
      { h: 'Adding an Item', p: ['Start from the tile for the kind of item you are adding. Dishes and Cocktails get a recipe builder, so add ingredients and the cost computes itself, or skip the recipe and type a flat cost. No Prep items link straight to an Inventory Control product, and the cost and menu price both auto-fill from that product (the price stays yours to change). A poured product like draft beer or wine by the glass carries a Pour Size; a food or resale item carries a Portion; bottle beer sells whole. Enter units sold so Menu Engineering can weight the item by how often it sells.'] },
      { h: 'Menu Categories Are Your Sections', p: ['The Category on each item is the section it sits in on your menu, and the list is yours to shape. Tap Edit next to Category to add your own sections (Happy Hour, Brunch, Featured), rename by adding and hiding, or reset to the defaults. Any item type can go in any section, so a Happy Hour section can hold a cocktail, a dish, and a beer together. Your sections show up as real grouped sections on this page and in the rest of the Menu tools. On a No Prep item, beer, wine, and NA beverages land in their obvious section on their own; anything else you pick.'] },
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
    // Register the menu-section builtins up front so the section-first list can
    // order by App.listOptions('menu_category') before the editor form (which
    // otherwise registers them on first render) has ever been opened.
    App._listBuiltins.menu_category = App._listBuiltins.menu_category || App.MENU_ALL_CATEGORIES;
    this.renderLanding();
    // External focus (e.g. from Recipe Cost Analysis): open the editor modal in
    // place over the landing — no full-screen swap, works the same from any door.
    if (App._menuItemFocus) {
      const it = this.items().find(i => i.id === App._menuItemFocus);
      App._menuItemFocus = null;
      if (it) this.openEditor(it);
    }
  },

  // ── Landing: three add tiles + section-first menu list ─────────────────
  // The three menu-item TYPES, shown as tiles (the add/upload doors) the way Add
  // Products shows its category cards. Type drives the form and cost model; the
  // menu section (category) is chosen separately and is free-form.
  TYPES: [
    { key: 'plate',     label: 'Dishes',    add: 'Add Dish Menu Item',     imp: 'Dish List',     noun: 'dish' },
    { key: 'cocktail',  label: 'Cocktails', add: 'Add Cocktail Menu Item', imp: 'Cocktail List', noun: 'cocktail' },
    { key: 'inventory', label: 'No Prep',   add: 'Add Inventory Item',     imp: 'No Prep List',  noun: 'no prep' }
  ],

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

    // ── Type tabs (Kyle, 2026-07-25) ────────────────────────────────────────────────────────
    // This REPLACES "section-first, all types in one long page, so no type tabs". At real menu
    // size that page is a scroll, and the three types have genuinely different forms, different
    // targets and (next step) their own category lists. Same shape as Add Products: the working
    // tabs list ACTIVE items of that type, and INACTIVE items leave those tabs entirely for the
    // Inactive tab, so a seasonal cocktail stops cluttering the live list without being deleted.
    if (!this.TYPES.some(t => t.key === this.activeTab) && this.activeTab !== this.INACTIVE_TAB) {
      this.activeTab = 'plate';
    }
    const onInactive = this.activeTab === this.INACTIVE_TAB;
    const tabDefs = this.TYPES.map(t => ({ key: t.key, label: t.label, n: all.filter(i => this.classifyItem(i) === t.key).length }))
      .concat([{ key: this.INACTIVE_TAB, label: this.INACTIVE_TAB, n: archivedItems.length }]);
    const tabsBlock = '<div class="no-print" style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px;">'
      + tabDefs.map(t => '<button type="button" class="btn btn-sm mi-tab" data-tab="' + esc(t.key) + '" style="'
        + (t.key === this.activeTab
            ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
            : 'background:transparent;border:1px solid var(--b1);color:var(--t2);')
        + '">' + esc(t.label) + ' (' + t.n + ')</button>').join('')
      + '</div>';

    // The visible list is this tab's items only. Inactive gets its own view below.
    const tabItems = onInactive ? [] : all.filter(i => this.classifyItem(i) === this.activeTab);
    const lower = this._importOpen ? this.importPanelHTML()
      : (onInactive ? '' : this.listHTML(tabItems));

    // Inactive items (a seasonal item made inactive here, or cut from a Dog Test), across all
    // types. Shown ONLY on its own tab now — it used to sit at the bottom of every page.
    const archivedSection = (onInactive && archivedItems.length)
      ? '<div class="sh" style="margin:8px 0 10px;">Inactive</div>'
        + '<div style="font-size:12px;color:var(--t3);margin:0 0 10px;">These are off the live menu and out of Menu Engineering, but nothing is lost. Make active brings one straight back.</div>'
        + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Item</th><th>Category</th><th>Price</th><th></th>'
        + '</tr></thead><tbody>'
        + archivedItems.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(item => '<tr>'
            + '<td><div class="val">' + esc(item.name) + '</div></td>'
            + '<td>' + esc(item.category || '') + '</td>'
            + '<td>' + (item.price ? App.fmtCurrency(item.price) : '-') + '</td>'
            + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm mi-restore" data-id="' + esc(item.id) + '">Make Active</button>'
            + '<button class="btn btn-danger btn-sm mi-delperm" data-id="' + esc(item.id) + '">Delete Permanently</button></div></td>'
          + '</tr>').join('')
        + '</tbody></table></div>'
      : '';

    // An empty Inactive tab still needs to say what the tab is FOR, or it reads as a dead end.
    const inactiveEmpty = (onInactive && !archivedItems.length)
      ? '<div class="card" style="margin-top:6px;padding:14px 20px;"><div style="font-size:12px;color:var(--t3);line-height:1.6;">'
        + 'Nothing is inactive. Edit any item and use Make Inactive to pull a seasonal dish or cocktail off the live menu without deleting it.'
        + '</div></div>'
      : '';
    this.container.innerHTML = '<div class="screen">' + tilesBlock + tabsBlock + lower + archivedSection + inactiveEmpty + '</div>';
    this.wireLanding();
  },

  // Every live item, grouped into the operator's menu SECTIONS (categories), any
  // item type mixing freely inside a section. Section order follows the custom
  // menu_category list; leftover categories fall to the end, Uncategorized last.
  listHTML(all) {
    if (!all.length) {
      return '<div class="card" style="margin-top:18px;padding:14px 20px;"><div style="font-size:12px;color:var(--t3);line-height:1.6;">No menu items yet. Use a <strong>+ Add</strong> tile above, or Upload to bring your menu in at once.</div></div>';
    }
    const incompleteN = all.filter(i => !i.price || (App.menuItemCost(i) || 0) === 0).length;
    const order = App.listOptions('menu_category');
    const present = [...new Set(all.map(i => i.category || 'Uncategorized'))];
    const ordered = order.filter(c => present.includes(c))
      .concat(present.filter(c => !order.includes(c) && c !== 'Uncategorized').sort())
      .concat(present.includes('Uncategorized') ? ['Uncategorized'] : []);
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
    let ci = 0;
    const sections = ordered.map(cat => {
      const items = all.filter(i => (i.category || 'Uncategorized') === cat)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (!items.length) return '';
      const rows = items.map(item => this._itemRowHTML(item)).join('');
      const html = '<div class="card" style="overflow-x:auto;margin-top:' + (ci === 0 ? '0' : '16') + 'px;"><table class="row-list" style="table-layout:fixed;width:100%;">'
        + '<colgroup><col style="width:40px;"/><col style="width:230px;"/><col/><col/><col/><col/><col/><col style="width:160px;"/></colgroup>'
        + '<thead><tr>'
        + '<th></th><th>' + esc(cat) + '</th><th>Price</th><th>Cost</th><th>Cost %</th><th>Margin</th><th>Sold/wk</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
      ci++;
      return html;
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
      // "Incomplete" is right but not enough when the cause is a DELETED ingredient: the operator
      // did finish this recipe, and something was taken out from under it. Name it, and say what
      // Bar Cop did about the cost, so the row is not just red with no explanation.
      // Same treatment ic-prep-batches gives a batch whose product was deleted.
      + (!ok ? (App.menuItemMissingIngredients(item).length
          ? '<div style="font-size:10px;font-weight:700;color:var(--amber);">INGREDIENT DELETED</div>'
            + '<div style="font-size:10px;color:var(--t3);">Not costed until you replace or remove it. Bar Cop will not price it cheaper in the meantime.</div>'
          : '<div style="font-size:10px;font-weight:700;color:var(--red);">Incomplete</div>') : '')
      // Inactive is NOT an alarm — this dish costs correctly and stays on every board. Grey note so
      // the operator can see at a glance which dishes lean on something they stopped stocking.
      + (App.menuItemInactiveProducts(item).length
          ? '<div style="font-size:10px;color:var(--t3);">Uses ' + App.menuItemInactiveProducts(item).length
            + ' inactive product' + (App.menuItemInactiveProducts(item).length === 1 ? '' : 's') + ': '
            + App.menuItemInactiveProducts(item).map(p => esc(p.name)).join(', ') + '</div>'
          : '') + '</td>'
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
    this.container.querySelectorAll('.mi-tab').forEach(b =>
      b.addEventListener('click', () => { this.activeTab = b.dataset.tab; this._selected = new Set(); this.renderLanding(); }));
    this.container.querySelectorAll('.mi-card-add').forEach(el =>
      el.addEventListener('click', () => this.openEditor(null, { type: el.dataset.type })));
    this.container.querySelectorAll('.mi-card-imp').forEach(el =>
      el.addEventListener('click', () => this.openImport(el.dataset.type)));
    // Select All / Clear + per-row checkboxes + bulk delete (every live item).
    this.container.querySelectorAll('.mi-sel-all').forEach(b => b.addEventListener('click', () => {
      const rows = this.items().filter(i => !i.archived);
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
      this._selected = new Set();
      for (const delId of ids) await App.removeRecord('core', 'menu_item', delId);
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
        await App.removeRecord('core', 'menu_item', b.dataset.id);
        this.renderLanding();
      }));
    // Archived: restore or delete-permanently (guarded, no undo).
    this.container.querySelectorAll('.mi-restore').forEach(b =>
      b.addEventListener('click', async () => {
        const item = this.items().find(i => i.id === b.dataset.id);
        // Live row: putRecord cannot revert it for us. A refused restore put the dish back on the
        // menu on screen while the server kept it archived, so it read as selling and was priced
        // and costed as live until the next reload.
        if (item) {
          const undo = App.snapshotRows([item]);
          item.archived = false;
          if (!(await App.putRecord('core', 'menu_item', item))) App.restoreRows(undo);
          this.renderLanding();
        }
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
        await App.removeRecord('core', 'menu_item', b.dataset.id);
        this.renderLanding();
      }));

    document.getElementById('mi-export')?.addEventListener('click', () => App.exportPDF({ title: 'Menu', root: document.getElementById('mi-list-export') }));
  },

  // ── Editor (ONE modal, form driven by the item TYPE) ─────────────────────
  // Replaces the old three full-screen forms. The tile you click sets the type:
  // Dishes + Cocktails get the recipe builder; No Prep links an inventory product.
  // The menu section (category) is a separate free-form field. This is the single
  // edit door, also opened from Recipe Cost Analysis, so no cross-section jump.
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
    // Type comes from the tile you clicked, NOT the category. Cocktails preset to
    // the Cocktails section; dishes and no-prep items let the operator pick a
    // section (no-prep also auto-fills one when a product is chosen).
    this._presetCat = this._addType === 'cocktail' ? 'Cocktails' : '';
    this._catAutoSet = '';   // the last section the No Prep picker auto-selected (never clobber a hand-picked one)
    this._pourAutoSet = '';  // the last pour size the No Prep picker auto-filled (same rule)
    this._priceAutoSet = ''; // the last menu price the No Prep picker auto-filled (same rule)
    this._nameAutoSet = '';  // the last menu name the No Prep picker auto-filled (same rule)
    this.editIdx   = item ? this.items().findIndex(i => i.id === item.id) : null;
    this.formType  = item ? this.classifyItem(item) : this._addType;
    this.linkedProductId = item?.linked_product_id || '';
    const hasRecipe = !!(item?.recipe && Array.isArray(item.recipe.ingredients) && item.recipe.ingredients.length);
    // The recipe is optional (allow-but-nudge): an existing recipe opens expanded,
    // a new item starts collapsed behind a "+ Build Recipe" toggle with no rows.
    this._recipeOpen = hasRecipe;
    this.mode = hasRecipe ? item.recipe.mode : (this.formType === 'cocktail' ? 'single' : this.formType === 'plate' ? 'food' : null);
    this.rows = hasRecipe
      ? item.recipe.ingredients.map(i => ({ source: i.source || 'product', id: i.id || i.product_id, quantity: i.quantity }))
      : [];
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

    App.openModal(html, { id: 'mi-editor', maxWidth: isInv ? 540 : 680, confirmDirty: true, onClose: () => this.cancelEditor() });
    App.wireCustomSelects(document.getElementById('mi-editor') || document);
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
    const selCat = item?.category || this._presetCat || '';
    const scopeType = item ? this.classifyItem(item) : this._addType;
    // Category is a free-form menu SECTION, shared across every item type and
    // editable through the | Edit popup. It no longer implies the item's kind
    // (that's the type, set by the tile), so it shows on all three forms.
    const catCell = '<div class="f" style="flex:1.4 1 140px;"><label>Category' + App.manageListLink('menu_category') + '</label>'
      + App.customSelect({ id: 'ri-cat', key: 'menu_category', builtin: App.MENU_ALL_CATEGORIES, selected: selCat, blank: true, blankLabel: 'Select category...' })
      + '</div>';
    const nameSlot = '<div class="f" id="mi-name-slot" style="flex:1.5 1 140px;display:none;"></div>';
    const linkedSlot = '<div class="f" id="mi-linked-slot" style="width:185px;flex-shrink:0;display:none;"></div>';
    const adaptive = '<div id="mi-adaptive" style="display:contents;"></div>';
    // Recipe types lead with Menu Name then Category; inventory leads with
    // Category, then the Inventory Product picker, then the Menu Name that
    // auto-fills from the product. The adaptive price/cost/covers cells flow into
    // mi-adaptive (display:contents); the recipe builder and notes carry 100%.
    const order = scopeType === 'inventory'
      ? (linkedSlot + catCell + nameSlot + adaptive)
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

  // Category is just the menu section now. It does not change the form or the item
  // type (that comes from the tile), so picking a section — including the blank
  // "Select category..." — never re-renders the form. Keep the missing-field
  // highlight in step and nothing else.
  onCategoryChange() {
    this.refreshFieldMissing();
  },

  renderAdaptive(item) {
    const host = document.getElementById('mi-adaptive');
    const nameSlot = document.getElementById('mi-name-slot');
    const slot = document.getElementById('mi-linked-slot');
    if (nameSlot) { nameSlot.innerHTML = ''; nameSlot.style.display = 'none'; }
    if (slot) { slot.innerHTML = ''; slot.style.display = 'none'; }
    if (!host) return;
    if (!this.formType) return;   // type comes from the tile, so this never blanks the form
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
    document.getElementById('ri-price')?.addEventListener('input', () => { this.refreshFieldMissing(); this.calcRecipe(); });
    document.getElementById('ri-cost')?.addEventListener('input', () => this.refreshFieldMissing());
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
        + '<span style="font-size:11px;color:var(--t3);margin-left:12px;">Optional. Add a recipe for accurate, auto-updating cost.</span>'
        + '</div>';
      document.getElementById('ri-build-recipe')?.addEventListener('click', () => {
        this._recipeOpen = true;
        if (!this.rows.length) this.rows = [{ source: 'product', id: '', quantity: '' }];
        this.renderRecipeArea(item);
      });
    }
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
    return '<div class="f" style="flex:1 1 90px;"><label>Menu Price</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ri-price" value="' + (item?.price || '') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f" style="flex:1 1 85px;"><label>Cost</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ri-cost" value="' + (item?.cost ? (+item.cost).toFixed(2) : '') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f" style="flex:1 1 85px;"><label>Units Sold</label><div class="fw"><input class="form-input suf" type="number" id="ri-cov" value="' + (item?.weekly_covers || '') + '"/><span class="suf">wk</span></div></div>'
      + '<div id="ri-recipe-wrap" style="flex:0 0 100%;"></div>'
      + '<div style="flex:0 0 100%;">' + App.noteField({ id: 'ri-notes', value: item?.notes, placeholder: 'Optional', mt: 6 }) + '</div>';
  },

  // The inventory-product picker — rendered into the top-row slot (right of
  // Category), at normal width.
  linkedFieldHtml(item) {
    const linkedId = this.linkedProductId || item?.linked_product_id || '';
    // Show every sellable product (grouped by kind) — the menu category is a free-
    // form section now, so it no longer filters the picker. The product itself
    // drives the cost model (pour vs portion vs whole).
    return '<label>Inventory Product</label>'
      + '<select class="form-input" id="ri-linked-prod">' + this.inventoryProductOptions(linkedId) + '</select>';
  },
  // Everything below the top row for an inventory item: price, cost, covers,
  // pour/portion, other prices, notes.
  inventoryRestHtml(item) {
    const linkedId = this.linkedProductId || item?.linked_product_id || '';
    const linkedProd = linkedId ? this.prodById(linkedId) : null;
    const kind = this._invAmountKind(linkedProd);
    const amount = kind === 'portion' ? item?.portion : (kind === 'pour' ? item?.pour_size_oz : null);
    const autoCost = linkedProd ? (App.menuLinkCost(linkedProd, amount) || 0) : 0;
    const basis = linkedProd && App.recipeBasis ? App.recipeBasis(linkedProd) : null;
    const portionUnit = basis ? basis.unitLabel : 'ea';
    // Pour (draft beer / wine by the glass) and Portion (food / misc resale) are
    // both rendered; only the one that fits the linked product shows, and the
    // product-change handler flips between them. Bottle beer sells whole (neither).
    const pourField = '<div class="f" id="ri-pour-cell" style="width:85px;' + (kind === 'pour' ? '' : 'display:none;') + '"><label>Pour Size</label>'
      + '<div class="fw"><input class="form-input suf" type="number" id="ri-pour" value="' + (item?.pour_size_oz != null ? item.pour_size_oz : '') + '" step="0.25" min="0" placeholder="' + (linkedProd?.pour_size_oz != null ? linkedProd.pour_size_oz : '') + '"/><span class="suf">oz</span></div></div>';
    const portionField = '<div class="f" id="ri-portion-cell" style="width:120px;' + (kind === 'portion' ? '' : 'display:none;') + '"><label>Portion</label>'
      + '<div class="fw"><input class="form-input suf" type="number" id="ri-portion" value="' + (item?.portion != null ? item.portion : '') + '" step="0.25" min="0" placeholder="1"/><span class="suf" id="ri-portion-unit">' + esc(portionUnit) + '</span></div></div>';
    return '<div class="f" style="width:100px;"><label>Menu Price</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="ri-price" value="' + (item?.price || '') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f" style="width:95px;"><label>Units Sold</label><div class="fw"><input class="form-input suf" type="number" id="ri-cov" value="' + (item?.weekly_covers || '') + '"/><span class="suf">wk</span></div></div>'
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
  // Which amount field a linked product uses: a pour (draft beer / wine by the
  // glass), a portion (food / misc resale, in servings or ounces), or none (bottle
  // beer, sold whole). Product-driven now that the menu category is free-form.
  _invAmountKind(prod) {
    if (!prod) return 'none';
    if (prod.category === 'Draft Beer' || prod.category === 'Wine') return 'pour';
    if (prod.category === 'Food' || prod.category === 'Misc') return 'portion';
    return 'none';
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
      // Show the amount field the product needs: Pour (draft beer / wine by the
      // glass), Portion (food / misc), or neither (bottle beer, sold whole). Clear
      // the hidden one so a stale value never rides along into the cost.
      const kind = this._invAmountKind(p);
      const pourCell = document.getElementById('ri-pour-cell');
      const portCell = document.getElementById('ri-portion-cell');
      if (pourCell) {
        pourCell.style.display = kind === 'pour' ? '' : 'none';
        const pi = document.getElementById('ri-pour');
        if (pi) {
          if (kind !== 'pour') { pi.value = ''; this._pourAutoSet = ''; }
          else {
            // Draft beer / wine by the glass: prefill the product's own pour size so
            // the cost lands right away. Update it as the product changes, but never
            // overwrite a pour the operator typed by hand.
            const pp = (p && p.pour_size_oz != null && p.pour_size_oz !== '') ? String(p.pour_size_oz) : '';
            if (pi.value === '' || pi.value === this._pourAutoSet) { pi.value = pp; this._pourAutoSet = pp; }
          }
        }
      }
      if (portCell) { portCell.style.display = kind === 'portion' ? '' : 'none'; if (kind !== 'portion') { const pi = document.getElementById('ri-portion'); if (pi) pi.value = ''; } }
      // Update the Portion field's inline unit to the product's recipe measure
      // (slice / oz / ea) so the operator sees what they're entering.
      const punit = document.getElementById('ri-portion-unit');
      if (punit && p && App.recipeBasis) punit.textContent = App.recipeBasis(p).unitLabel;
      // Auto-fill the menu price + name from the product, updating as the product
      // changes but never overwriting a value the operator typed by hand.
      const priceInp = document.getElementById('ri-price');
      if (priceInp && p) {
        const mp = (p.menu_price > 0) ? (+p.menu_price).toFixed(2) : '';
        if (priceInp.value === '' || priceInp.value === this._priceAutoSet) { priceInp.value = mp; this._priceAutoSet = mp; }
      }
      const nameInp = document.getElementById('ri-name');
      if (nameInp && p) {
        const nm = p.name || '';
        if (nameInp.value === '' || nameInp.value === this._nameAutoSet) { nameInp.value = nm; this._nameAutoSet = nm; }
      }
      // Auto-select the menu section only when it is unambiguous: beer, wine, and
      // NA beverages have one obvious home. Food and other Misc could be Snacks,
      // Sides, or a custom section, so those clear back to "Select category" to pick.
      // Overwrite our own last auto pick as the product changes, but never a section
      // the operator chose by hand.
      const catSel = document.getElementById('ri-cat');
      if (catSel && (catSel.value === '' || catSel.value === this._catAutoSet)) {
        const def = this._certainMenuSection(p);
        catSel.value = def;
        this._catAutoSet = def;
      }
      recomputeCost();   // after the price is set, so the Cost % uses the current price
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
      + '<button type="button" class="btn btn-ghost btn-sm" id="ri-add-ing" style="margin-bottom:14px;">+ Add Ingredient</button>'
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
      category = document.getElementById('ri-cat')?.value || 'Cocktails';
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
      category = document.getElementById('ri-cat')?.value || '';
      if (!category) { fail('Pick a menu category.'); return; }
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
      type,
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
      target_cost_pct:    targetPct,
      planned_price:      priceChanged ? null : (existing && existing.planned_price != null ? existing.planned_price : null),
      planned_vol_pct:    priceChanged ? null : (existing && existing.planned_vol_pct != null ? existing.planned_vol_pct : null),
      planned_at:         priceChanged ? null : (existing && existing.planned_at ? existing.planned_at : null),
      created_at:         existing?.created_at || new Date().toISOString(),
      updated_at:         new Date().toISOString()
    };

    // ⚠ Only log a reprice the server actually took. This discarded its result and logged anyway,
    // so a rejected save still credited Recovery and wrote a Pricing Review Log line for a price
    // the register was never told about. `entry` is a FRESH object, so putRecord's own revert does
    // put the old row back here (unlike the live-row callers in r-menu-engineering) — the missing
    // piece was only the log gate. The import path below already gets this right.
    const okSave = await App.putRecord('core', 'menu_item', entry);
    // A direct price edit on an existing item is a real reprice: log it through
    // the one canonical pricing logger (no prediction — that is a Menu
    // Engineering reprice thing) so the Pricing Review Log and Recovery pick it up.
    if (okSave && priceChanged) {
      await App.logPriceChange(entry, existing.price, price, { reason: 'Direct edit on Menu Builder', source: 'menu-items-edit' });
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
        { key: 'name',     label: 'Menu Name',    required: true,  match: ['name', 'item', 'item name', 'menu name', 'product', 'description', 'menu item', 'product name', 'dish', 'dish name', 'title'] },
        { key: 'category', label: 'Category',     required: false, match: ['category', 'type', 'group', 'section', 'menu category', 'menu section', 'course', 'class', 'department'] },
        { key: 'price',    label: 'Menu Price',   required: false, match: ['price', 'menu price', 'sell price', 'sell', 'retail', 'selling price', 'list price', 'price each'] },
        { key: 'cost',     label: 'Cost',         required: false, match: ['cost', 'item cost', 'cogs', 'food cost', 'plate cost', 'recipe cost', 'cost each', 'ingredient cost', 'unit cost'] },
        { key: 'covers',   label: 'Weekly Units Sold',required: false, match: ['covers', 'cover', 'weekly covers', 'units', 'units sold', 'volume', 'qty', 'quantity', 'count', 'sold', 'weekly units', 'qty sold', 'quantity sold', 'units per week', 'sales count'] }
      ],
      confirmLabel: 'Import',
      onComplete: rows => this.importItems(rows)
    });
  },

  async importItems(rows) {
    const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
    const existing = this.items();
    const keyOf = (t, n) => String(t || '') + '|' + String(n || '').trim().toLowerCase();
    const byKey = {};
    existing.forEach(it => { byKey[keyOf(it.type, it.name)] = it; });
    let added = 0, updated = 0;
    const repriced = [];
    // Snapshot the whole menu before the import touches it, and track the rows it appends. The
    // bulk write below cannot revert itself, so without these a failed import left the new prices
    // and new items on screen while the server kept the old menu — and the repricing below would
    // log price changes to Recovery for prices the register never got.
    const undoAll = App.snapshotRows(existing);
    const addedRecs = [];
    rows.forEach(r => {
      const name = (r.name || '').trim();
      if (!name) return;
      const price = num(r.price), cost = +(num(r.cost)).toFixed(2), covers = num(r.covers);
      const cat = (r.category || '').trim();
      const cur = byKey[keyOf(this.activeType, name)];
      if (cur) {
        // Re-dropping an export REFRESHES the matching item instead of duplicating
        // it. Only overwrite a field the file actually carries, so a partial export
        // (e.g. no cost column) never wipes a good cost/price already on file.
        if (price > 0) {
          if (price !== cur.price) {
            repriced.push({ item: cur, from: cur.price });
            // A price the file moves is a real reprice, same as a direct edit: the new
            // live price supersedes any planned one. Left on the item, a stale plan
            // makes Menu Engineering show a negative delta and its Mark Live button
            // CUT the price, on a screen whose whole contract is raise-only.
            cur.planned_price = null; cur.planned_vol_pct = null; cur.planned_at = null;
          }
          cur.price = price;
        }
        if (cost > 0)   cur.cost = cost;
        if (covers > 0) cur.weekly_covers = covers;
        if (cat)        cur.category = cat;
        cur.updated_at = new Date().toISOString();
        updated++;
      } else {
        const it = {
          id:                 App.uid(),
          type:               this.activeType,   // the tile the Upload was opened from sets the item type
          name,
          category:           cat,
          price,
          cost,
          weekly_covers:      covers,
          prev_weekly_covers: null,
          weekly_covers_updated_at: null,
          notes:              '',
          recipe:             null,
          linked_product_id:  '',
          pour_size_oz:       null,
          target_cost_pct:    null,
          created_at:         new Date().toISOString(),
          updated_at:         new Date().toISOString()
        };
        existing.push(it); addedRecs.push(it);
        byKey[keyOf(this.activeType, name)] = it;
        added++;
      }
    });

    const result = document.getElementById('mi-imp-result');
    if (!added && !updated) {
      if (result) result.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">No items imported. No item names were found in the file.</div>';
      return;
    }

    if (!(await App.putRecordsBulk('core', 'menu_item', this.items()))) {
      App.restoreRows(undoAll);
      App.dropRows(existing, addedRecs);
      if (result) result.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">Could not save the import. Nothing was changed — check your connection and try again.</div>';
      this.render(this.container, this.actions);
      return;
    }
    // Every reprice the file carried goes through the one canonical pricing logger,
    // same as a direct edit, so the Pricing Review Log and Recovery see it. Without
    // this the audit told the operator to reprice the day after they repriced.
    for (const rp of repriced) {
      await App.logPriceChange(rp.item, rp.from, rp.item.price, { reason: 'Menu list import', source: 'menu-items-import' });
    }
    App.markSetupDone('gs_r_menu');
    // Re-render so the new items show in the list below (stays in import mode),
    // then drop the summary into the freshly-mounted result slot.
    this.renderLanding();
    const res2 = document.getElementById('mi-imp-result');
    if (res2) {
      const parts = [];
      if (added)   parts.push('imported ' + added + ' new item' + (added === 1 ? '' : 's'));
      if (updated) parts.push('refreshed ' + updated + ' existing');
      res2.innerHTML = '<div style="font-size:13px;color:var(--gold);font-weight:700;margin-top:12px;">'
        + parts.join(' and ').replace(/^./, c => c.toUpperCase()) + '. Edit any item to set its price, cost, or recipe.'
        + '</div>';
    }
  }
};
