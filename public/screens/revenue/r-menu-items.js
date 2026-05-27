'use strict';

/* ── Revenue Recovery — Menu Items (THE single edit surface) ──────────────────
   The one place menu items are managed. Each item has: name, category, price,
   weekly covers, notes, and an OPTIONAL inline recipe (ingredient breakdown).
   When a recipe is attached, the item's cost auto-computes via
   App.menuItemCost from current product prices in Inventory Control.

   Ingredients pull from two sources: Products (Inventory Control → Add Products)
   and Prep Batches (Inventory Control → Prep Batches). Each ingredient row
   carries { source: 'product'|'batch', id, quantity }.

   Recipe Cost Analysis (Profit Recovery) is the read-only counterpart — it
   ranks items by cost % and bounces back here for any edits. One source of
   truth, no cross-module navigation. */

S.RevenueMenuItems = {
  editIdx: null,        // current index in App.data.menu_items being edited
  rows: [],             // recipe ingredient rows on the active form
  mode: null,           // 'single' | 'food' — recipe mode on the active form
  _saving: false,

  CATEGORIES: ['Appetizers', 'Entrees', 'Desserts', 'Cocktails', 'Beer', 'Wine', 'NA Beverages', 'Specials', 'Other'],

  items() {
    if (!App.data.menu_items) App.data.menu_items = [];
    return App.data.menu_items;
  },

  // ── Ingredient source helpers ────────────────────────────────────────────
  IC_BAR: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer'],
  products() { return (App.inventoryData && App.inventoryData.ic_products) || []; },
  prepBatches() { return (App.prepBatches && App.prepBatches()) || []; },
  prodById(id) { return this.products().find(p => p.id === id) || null; },
  batchById(id) { return this.prepBatches().find(b => b.id === id) || null; },
  isBarProd(p) { return !!(p && this.IC_BAR.includes(p.category)); },

  // What's the operator picking? Build a unified ingredient dropdown.
  ingredientOptions(selKey, mode) {
    // selKey shape: "p:<productId>" or "b:<batchId>" or ""
    const prods = this.products();
    const batches = this.prepBatches();
    let h = '<option value="">Select ingredient...</option>';

    // For Single Drink recipes, default to bar products. For Food Plate, default to kitchen.
    // But ALL options are always available — the operator picks.
    const barProds = prods.filter(p => this.isBarProd(p));
    const kitProds = prods.filter(p => !this.isBarProd(p));

    if (mode === 'food') {
      if (kitProds.length) {
        h += '<optgroup label="Kitchen Products">';
        kitProds.forEach(p => { h += '<option value="p:' + p.id + '"' + (selKey === 'p:' + p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; });
        h += '</optgroup>';
      }
      if (barProds.length) {
        h += '<optgroup label="Bar Products (use sparingly in food)">';
        barProds.forEach(p => { h += '<option value="p:' + p.id + '"' + (selKey === 'p:' + p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; });
        h += '</optgroup>';
      }
    } else {
      // single drink
      if (barProds.length) {
        h += '<optgroup label="Bar Products">';
        barProds.forEach(p => { h += '<option value="p:' + p.id + '"' + (selKey === 'p:' + p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; });
        h += '</optgroup>';
      }
      if (kitProds.length) {
        h += '<optgroup label="Mixers / Kitchen">';
        kitProds.forEach(p => { h += '<option value="p:' + p.id + '"' + (selKey === 'p:' + p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; });
        h += '</optgroup>';
      }
    }

    if (batches.length) {
      h += '<optgroup label="Prep Batches">';
      batches.forEach(b => { h += '<option value="b:' + b.id + '"' + (selKey === 'b:' + b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>'; });
      h += '</optgroup>';
    }
    return h;
  },

  // Return the operator-facing unit + per-unit cost for a row's picked ingredient.
  ingredientCostBasis(row, mode) {
    if (row.source === 'batch') {
      const b = this.batchById(row.id);
      if (!b) return { unit: 'servings', costPerUnit: 0 };
      return { unit: 'servings', costPerUnit: b.cost_per_serving || 0 };
    }
    // product
    const p = this.prodById(row.id);
    if (!p) return { unit: '-', costPerUnit: 0 };
    if (this.isBarProd(p)) {
      // Single drink: quantity is pours; cost is per-pour
      if (mode === 'single') {
        return { unit: 'pours', costPerUnit: (p.cost_per_pour != null ? p.cost_per_pour : (App.bottleCost ? (App.bottleCost(p) || 0) : 0)) };
      }
      // Food plate using a bar product (rare): quantity is bottles
      return { unit: 'bottles', costPerUnit: (App.bottleCost ? (App.bottleCost(p) || 0) : (p.unit_cost || 0)) };
    }
    // kitchen
    return { unit: 'units', costPerUnit: p.unit_cost || 0 };
  },

  // Cost across all rows on the active form, applying plate_yield for food.
  computeFormCost() {
    const mode = this.mode;
    const tc = this.rows.reduce((s, r) => {
      const basis = this.ingredientCostBasis(r, mode);
      const qty = parseFloat(r.quantity) || 0;
      return s + (basis.costPerUnit * qty);
    }, 0);
    let cps = tc;
    if (mode === 'food') {
      const py = parseFloat(document.getElementById('ri-plate-yield')?.value) || 1;
      cps = py > 0 ? tc / py : tc;
    }
    return { total_cost: tc, cost_per_serving: cps };
  },

  // ── Render ───────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    // External focus from Recipe Cost Analysis — drop straight into edit form.
    if (App._menuItemFocus) {
      const focusId = App._menuItemFocus;
      App._menuItemFocus = null;
      const idx = this.items().findIndex(i => i.id === focusId);
      if (idx >= 0) { this.showForm(idx); return; }
    }
    this.renderList();
  },

  renderList() {
    this.actions.innerHTML = '';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = '+ Add Item';
    addBtn.addEventListener('click', () => this.showForm(null));
    this.actions.appendChild(addBtn);
    const impBtn = document.createElement('button');
    impBtn.className = 'btn btn-ghost btn-sm';
    impBtn.style.marginLeft = '8px';
    impBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="margin-right:5px;"><path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Import';
    impBtn.addEventListener('click', () => this.showImport());
    this.actions.appendChild(impBtn);

    const items = this.items();
    const incomplete = items.filter(i => !i.price || (App.menuItemCost(i) || 0) === 0).length;

    const rows = items.map((item, idx) => {
      const cost = App.menuItemCost(item) || 0;
      const cm   = (item.price && cost) ? (item.price - cost) : null;
      const pct  = (item.price && cost) ? (cost / item.price * 100).toFixed(1) : null;
      const ok   = item.price && cost;
      const hasRecipe = !!(item.recipe && Array.isArray(item.recipe.ingredients) && item.recipe.ingredients.length);
      const recipeBadge = hasRecipe
        ? '<span style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gold);border:1px solid var(--gold);border-radius:3px;padding:1px 5px;margin-left:6px;">RECIPE</span>'
        : '';
      return '<tr class="' + (!ok ? 'row-incomplete' : '') + '">'
        + '<td style="width:36px;"><input type="checkbox" class="ri-chk" data-id="' + item.id + '" style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/></td>'
        + '<td style="font-weight:600;color:' + (ok ? 'var(--t1)' : 'var(--red)') + ';">' + esc(item.name) + recipeBadge + (!ok ? ' <span style="font-size:10px;font-weight:700;color:var(--red);">INCOMPLETE</span>' : '') + '</td>'
        + '<td>' + esc(item.category || '') + '</td>'
        + '<td>' + (item.price ? App.fmtCurrency(item.price) : '-') + '</td>'
        + '<td>' + (cost ? App.fmtCurrency(cost) : '-') + (hasRecipe ? '<div style="font-size:9px;color:var(--t3);">from recipe</div>' : '') + '</td>'
        + '<td>' + (pct ? pct + '%' : '-') + '</td>'
        + '<td>' + (cm ? App.fmtCurrency(cm) : '-') + '</td>'
        + '<td>' + (item.weekly_covers ? item.weekly_covers : '-') + '</td>'
        + '<td style="white-space:nowrap;">'
        + '<button class="btn btn-ghost btn-sm ri-edit" data-idx="' + idx + '" style="margin-right:4px;">Edit</button>'
        + '<button class="btn btn-danger btn-sm ri-del" data-idx="' + idx + '">Del</button>'
        + '</td></tr>';
    }).join('') || '<tr><td colspan="9" style="color:var(--t3);text-align:center;padding:14px;">No menu items yet. Add your first item to get started.</td></tr>';

    this.container.innerHTML = '<div class="screen">'
      + (incomplete > 0 ? '<div class="alert-bar"><div class="alert-text">' + incomplete + ' item' + (incomplete > 1 ? 's' : '') + ' missing price or cost. Incomplete items cannot be used in Menu Engineering.</div></div>' : '')
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.6;">'
        + 'Items with a recipe attached have their cost auto-computed from current product prices in Inventory Control. Add or edit a recipe inline on the item form — no extra screens, no jumps.'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
      + '<button class="btn btn-ghost btn-sm" id="ri-sel-all">Select All</button>'
      + '<button class="btn btn-danger btn-sm" id="ri-del-sel" style="display:none;">Delete Selected</button>'
      + '<span id="ri-sel-count" style="font-size:11px;color:var(--t3);"></span>'
      + '</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th style="width:36px;"></th>'
      + '<th>Item Name</th><th>Category</th><th>Price</th><th>Cost</th><th>Cost %</th><th>Contrib. Margin</th><th>Wkly Covers</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';

    this.container.querySelectorAll('.ri-edit').forEach(btn => {
      btn.addEventListener('click', () => this.showForm(parseInt(btn.dataset.idx)));
    });
    this.container.querySelectorAll('.ri-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this item?')) return;
        this.items().splice(parseInt(btn.dataset.idx), 1);
        await App.saveKey('menu_items');
        this.render(this.container, this.actions);
      });
    });

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
      App.data.menu_items = this.items().filter(i => !ids.includes(i.id));
      await App.saveKey('menu_items');
      this.render(this.container, this.actions);
    });
  },

  // ── Inline Item Form (with recipe editor) ────────────────────────────────
  showForm(idx) {
    this.editIdx = idx !== null && idx >= 0 ? idx : null;
    const item = this.editIdx !== null ? this.items()[this.editIdx] : null;
    const hasRecipe = !!(item?.recipe && Array.isArray(item.recipe.ingredients) && item.recipe.ingredients.length);
    this.mode = hasRecipe ? item.recipe.mode : null;
    this.rows = hasRecipe
      ? item.recipe.ingredients.map(i => ({ source: i.source || 'product', id: i.id || i.product_id, quantity: i.quantity }))
      : [];

    const catOpts = this.CATEGORIES.map(c =>
      '<option' + (item?.category === c ? ' selected' : '') + '>' + c + '</option>').join('');

    const target = item?.target_cost_pct || (this.mode === 'food' ? 32 : 22);

    this.actions.innerHTML = '';

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="ri-back">&#8592; Back to Menu Items</button></div>'
      + '<div class="card">'
      + '<div class="sh">' + (item ? 'Edit Item' : 'Add Menu Item') + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
        + '<div class="f w-lg"><label>Item Name</label><input type="text" id="ri-name" value="' + esc(item?.name || '') + '" placeholder="House Burger"/></div>'
        + '<div class="f w-md"><label>Category</label><select id="ri-cat"><option value="">Select...</option>' + catOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
        + '<div class="f w-md"><label>Menu Price</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ri-price" value="' + (item?.price || '') + '" step="0.01" placeholder="0.00"/></div></div>'
        + '<div class="f w-md"><label>Cost ' + (hasRecipe ? '<span style="color:var(--t4);font-weight:400;">(auto from recipe)</span>' : '') + '</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ri-cost" value="' + ((hasRecipe ? (App.menuItemCost(item) || 0).toFixed(2) : item?.cost) || '') + '" step="0.01" placeholder="0.00"' + (hasRecipe ? ' disabled' : '') + '/></div></div>'
        + '<div class="f w-md"><label>Avg Weekly Covers</label><input type="number" id="ri-cov" value="' + (item?.weekly_covers || '') + '" placeholder=""/></div>'
      + '</div>'
      + '<div class="f" style="margin-bottom:18px;"><label>Notes</label><input type="text" id="ri-notes" value="' + esc(item?.notes || '') + '" placeholder="Optional"/></div>'

      // ── Recipe section ──
      + '<div id="ri-recipe-section" style="border-top:1px solid var(--b2);padding-top:18px;margin-top:8px;"></div>'

      + '<div style="display:flex;gap:10px;margin-top:18px;">'
        + '<button class="btn btn-primary" id="ri-save">Save Item</button>'
        + '<button class="btn btn-ghost" id="ri-cancel">Cancel</button>'
        + '<span id="ri-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
      + '</div></div>';

    this.renderRecipeSection(item, target);

    document.getElementById('ri-back')?.addEventListener('click', () => this.renderList());
    document.getElementById('ri-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('ri-save')?.addEventListener('click', () => this._save(item));

    ['ri-price', 'ri-cost'].forEach(id =>
      document.getElementById(id)?.addEventListener('input', () => this.recalcInlineCost(item)));
    this.recalcInlineCost(item);
  },

  // The recipe section either prompts to build one OR shows the full editor.
  renderRecipeSection(item, target) {
    const sec = document.getElementById('ri-recipe-section');
    if (!sec) return;
    const hasRecipe = this.rows.length > 0 && this.mode;

    if (!hasRecipe) {
      sec.innerHTML = '<div class="sh">Recipe</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">'
          + 'Add an ingredient breakdown to auto-compute this item\'s cost from current product prices. Without a recipe, the manual Cost field above is used.'
        + '</div>'
        + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
          + '<button class="btn btn-ghost btn-sm" id="ri-build-single">+ Build Recipe — Single Drink</button>'
          + '<button class="btn btn-ghost btn-sm" id="ri-build-food">+ Build Recipe — Food Plate</button>'
        + '</div>';
      document.getElementById('ri-build-single')?.addEventListener('click', () => this.startRecipe('single', item, target));
      document.getElementById('ri-build-food')?.addEventListener('click', () => this.startRecipe('food', item, target));
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
        + '<div><button class="btn btn-danger btn-sm" id="ri-remove-recipe">Remove Recipe</button></div>'
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

    document.getElementById('ri-remove-recipe')?.addEventListener('click', () => {
      if (!confirm('Remove the recipe? Cost will fall back to manual entry.')) return;
      this.rows = [];
      this.mode = null;
      this.renderRecipeSection(item, target);
      this.recalcInlineCost(item);
    });
    document.getElementById('ri-add-ing')?.addEventListener('click', () => { this.addRow(); this.calcRecipe(); });
    document.getElementById('ri-target-pct')?.addEventListener('input', () => this.calcRecipe());
    document.getElementById('ri-plate-yield')?.addEventListener('input', () => this.calcRecipe());
  },

  startRecipe(mode, item, target) {
    this.mode = mode;
    this.rows = [{ source: 'product', id: '', quantity: '' }];
    this.renderRecipeSection(item, target);
    this.recalcInlineCost(item);
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
    area.querySelectorAll('.ri-rm-ing').forEach(btn => btn.addEventListener('click', () => { this.removeRow(parseInt(btn.dataset.i)); }));
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
      // No ingredients left — drop back to "build recipe" prompt.
      this.mode = null;
      const item = this.editIdx !== null ? this.items()[this.editIdx] : null;
      const target = item?.target_cost_pct || 22;
      this.renderRecipeSection(item, target);
      this.recalcInlineCost(item);
      return;
    }
    this.renderRows();
    this.calcRecipe();
  },

  calcRecipe() {
    // Sync qty from inputs into this.rows
    document.querySelectorAll('.ri-ing-qty').forEach(el => {
      const idx = parseInt(el.dataset.i);
      if (this.rows[idx]) this.rows[idx].quantity = parseFloat(el.value) || 0;
    });
    // Recompute each line + total
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
    // Push computed cost into the disabled Cost field
    const costInp = document.getElementById('ri-cost');
    if (costInp && this.rows.length) {
      costInp.value = cps > 0 ? cps.toFixed(2) : '';
      costInp.disabled = true;
    }
  },

  // No recipe attached: keep the manual cost field active and update the
  // inline cost-pct / margin display. With a recipe attached, the field is
  // disabled and reads from calcRecipe.
  recalcInlineCost(item) {
    const inp = document.getElementById('ri-cost');
    if (!inp) return;
    if (this.rows.length) {
      // recipe path — let calcRecipe handle
      this.calcRecipe();
      return;
    }
    inp.disabled = false;
  },

  // ── Save ─────────────────────────────────────────────────────────────────
  async _save(existing) {
    if (this._saving) return;
    this._saving = true;
    setTimeout(() => { this._saving = false; }, 1000);

    const name = document.getElementById('ri-name')?.value.trim();
    const err = document.getElementById('ri-err');
    if (!name) { if (err) { err.textContent = 'Item name required.'; err.style.display = 'inline'; } return; }

    const hasRecipe = this.rows.length > 0 && this.mode;
    const recipeIngredients = hasRecipe
      ? this.rows.filter(r => r.id && (parseFloat(r.quantity) || 0) > 0).map(r => ({ source: r.source, id: r.id, quantity: parseFloat(r.quantity) || 0 }))
      : [];
    const hasValidRecipe = hasRecipe && recipeIngredients.length > 0;

    const recipe = hasValidRecipe ? {
      mode: this.mode,
      ingredients: recipeIngredients,
      plate_yield: this.mode === 'food' ? (parseFloat(document.getElementById('ri-plate-yield')?.value) || 1) : null
    } : null;

    const price = parseFloat(document.getElementById('ri-price')?.value) || 0;
    const targetPct = recipe ? (parseFloat(document.getElementById('ri-target-pct')?.value) || (this.mode === 'food' ? 32 : 22)) : (existing?.target_cost_pct);

    // Build temp item to compute final cost via App.menuItemCost
    const temp = { recipe, cost: existing?.cost || 0 };
    const computedCost = recipe ? (App.menuItemCost(temp) || 0) : (parseFloat(document.getElementById('ri-cost')?.value) || 0);

    const entry = {
      id:               existing?.id || App.uid(),
      name,
      category:         document.getElementById('ri-cat')?.value || '',
      price,
      cost:             computedCost,
      weekly_covers:    parseFloat(document.getElementById('ri-cov')?.value) || 0,
      notes:            document.getElementById('ri-notes')?.value || '',
      recipe,
      target_cost_pct:  targetPct,
      created_at:       existing?.created_at || new Date().toISOString(),
      updated_at:       new Date().toISOString()
    };

    if (this.editIdx !== null) this.items()[this.editIdx] = entry;
    else this.items().push(entry);

    await App.saveKey('menu_items');
    App.markSetupDone('gs_r_menu');
    if (recipe) App.markSetupDone('gs_p_recipes');
    this.editIdx = null;
    this.rows = [];
    this.mode = null;
    this.render(this.container, this.actions);
  },

  // ── Import (CSV/Excel) ───────────────────────────────────────────────────
  showImport() {
    this.actions.innerHTML = '';
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">Import Menu Items from File</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:12px;">Upload a CSV or Excel file with your menu items. Bar Cop reads your columns and maps them. Items import without recipes attached; you can build recipes after import.</div>'
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

    document.getElementById('rmi-imp-cancel')?.addEventListener('click', () => this.render(this.container, this.actions));
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
          created_at:    new Date().toISOString(),
          updated_at:    new Date().toISOString()
        });
      });
      this.items().push(...imported);
      await App.saveKey('menu_items');
      App.markSetupDone('gs_r_menu');
      status.textContent = imported.length + ' items imported.';
      setTimeout(() => this.render(this.container, this.actions), 1000);
    });
  }
};
