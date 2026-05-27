'use strict';

/* ── Profit Recovery — Recipe Library ─────────────────────────────────────────
   Cost-out view of menu items (ingredient breakdown editor) plus the
   separate prep-batches editor. Two tabs:
     - Menu Item Recipes: every App.data.menu_items entry that has (or could
       have) a recipe. Editor sets ingredients + plate yield for food.
     - Batches: prep batches like frozen margarita mix, simple syrup. Not
       menu items; produce a yield used by other recipes.

   Two doors edit menu item recipes — this screen for cost-out / Recipe
   Library context, r-menu-items for menu engineering context. Both write
   to App.data.menu_items so there's no sync to keep.

   App._recipeFocus = menu_item_id, if set on render, jumps straight into
   the recipe editor for that item (used by Menu Items "Edit Recipe" button). */

S.RecipeLibrary = {
  editId: null,        // menu_item id when editing a menu item recipe
  editBatchId: null,   // batch id when editing a batch
  rows: [],
  mode: null,
  tab: 'menu',         // 'menu' | 'batches'
  _saving: false,
  _pendingDelIds: null,

  YUNITS: [{ l: 'oz', oz: 1 }, { l: 'ml', oz: 0.033814 }, { l: 'liters', oz: 33.814 }, { l: 'gallons', oz: 128 }, { l: 'quarts', oz: 32 }, { l: 'pints', oz: 16 }, { l: 'cups', oz: 8 }],
  yOpts(sel) { return this.YUNITS.map(u => '<option value="' + u.l + '"' + (u.l === (sel || 'oz') ? ' selected' : '') + '>' + u.l + '</option>').join(''); },
  toOz(v, u) { const m = this.YUNITS.find(x => x.l === u); return v * (m ? m.oz : 1); },

  IC_BAR: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer'],
  IC_KITCHEN: ['Food', 'Misc'],
  icProducts() { return (App.inventoryData && App.inventoryData.ic_products) || []; },
  allProds() { return this.icProducts().map(p => ({ ...p, _t: this.IC_BAR.includes(p.category) ? 'bar' : 'kitchen' })); },
  prodsForMode(mode) {
    const all = this.allProds();
    if (mode === 'food') return all.filter(p => p._t === 'kitchen');
    if (mode === 'batch') return all;
    return all.filter(p => p._t === 'bar');
  },
  prodOpts(mode, selId) {
    const prods = this.prodsForMode(mode);
    if (!prods.length) return '<option value="">No products set up</option>';
    if (mode === 'batch') {
      const bar = prods.filter(p => p._t === 'bar'), kit = prods.filter(p => p._t === 'kitchen');
      let h = '<option value="">Select ingredient...</option>';
      if (bar.length) { h += '<optgroup label="Bar Products">'; bar.forEach(p => { h += '<option value="' + p.id + '"' + (p.id === selId ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }); h += '</optgroup>'; }
      if (kit.length) { h += '<optgroup label="Kitchen / Mixers">'; kit.forEach(p => { h += '<option value="' + p.id + '"' + (p.id === selId ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }); h += '</optgroup>'; }
      return h;
    }
    return '<option value="">Select ingredient...</option>' + prods.map(p => '<option value="' + p.id + '"' + (p.id === selId ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
  },
  unitLabel(prod, mode) {
    if (!prod) return '-';
    if (mode === 'single') return prod._t === 'kitchen' ? 'units' : 'pours';
    if (mode === 'batch')  return prod._t === 'kitchen' ? 'units' : 'bottles';
    return 'units';
  },
  costBasis(prod, mode) {
    if (!prod) return 0;
    if (mode === 'single') return prod.cost_per_pour || 0;
    return prod.unit_cost || 0;
  },

  // Cost calculation for any recipe shape (menu item recipe or batch).
  computeFromRows(rows, mode, opts) {
    opts = opts || {};
    const tc = rows.reduce((s, r) => s + ((r.cost_per_unit || 0) * (r.quantity || 0)), 0);
    let cps = tc;
    if (mode === 'batch' && opts.servings_per_batch > 0) cps = tc / opts.servings_per_batch;
    else if (mode === 'food' && opts.plate_yield > 0)    cps = tc / opts.plate_yield;
    return { total_cost: tc, cost_per_serving: cps };
  },

  // ── Entry ───────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.editId = null;
    this.editBatchId = null;
    // If a menu item id was passed via App._recipeFocus, jump straight into
    // its recipe editor (door 2 from Menu Items "Edit Recipe").
    if (App._recipeFocus) {
      const id = App._recipeFocus;
      App._recipeFocus = null;
      const it = App.menuItemById(id);
      if (it) { this.editMenuItemRecipe(id); return; }
    }
    this.renderList();
  },

  renderList() {
    this.actions.innerHTML = '';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = this.tab === 'menu' ? '+ Recipe for an Item' : '+ New Batch';
    addBtn.addEventListener('click', () => this.tab === 'menu' ? this.showAttachRecipePicker() : this.showBatchForm(null));
    this.actions.appendChild(addBtn);

    const tabBtn = (k, label) => '<button class="rl-tab" data-tab="' + k + '" style="background:none;border:none;'
      + 'border-bottom:2px solid ' + (this.tab === k ? 'var(--gold)' : 'transparent') + ';'
      + 'color:' + (this.tab === k ? 'var(--gold)' : 'var(--t3)') + ';font-size:11px;font-weight:700;'
      + 'letter-spacing:0.5px;text-transform:uppercase;padding:9px 14px;cursor:pointer;">' + label + '</button>';

    const tabs = '<div style="display:flex;gap:2px;border-bottom:1px solid var(--b2);margin-bottom:14px;">'
      + tabBtn('menu', 'Menu Item Recipes')
      + tabBtn('batches', 'Batches')
      + '</div>';

    const body = this.tab === 'menu' ? this.renderMenuTab() : this.renderBatchTab();
    const delModal = '<div id="rl-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;"><div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;"><div id="rl-del-msg" style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;"></div><div style="display:flex;gap:10px;justify-content:center;"><button class="btn btn-ghost" id="rl-del-cancel">Cancel</button><button class="btn btn-danger" id="rl-del-confirm">Delete</button></div></div></div>';

    this.container.innerHTML = '<div class="screen">' + tabs + body + '</div>' + delModal;
    this.wireList();
  },

  renderMenuTab() {
    const items = App.menuItems();
    const withRecipe = items.filter(i => i.recipe && Array.isArray(i.recipe.ingredients) && i.recipe.ingredients.length);
    if (withRecipe.length === 0) {
      return '<div class="empty"><div class="empty-title">No menu item recipes yet</div>'
        + '<div class="empty-sub">Pick an existing menu item and build a recipe for it. Cost auto-computes from current product prices and flows back to Menu Items + Menu Engineering.</div>'
        + '<button class="btn btn-primary" id="rl-attach">Build a Recipe</button></div>';
    }
    const rows = withRecipe.map(i => {
      const cost = App.menuItemCost(i) || 0;
      const cpct = i.price > 0 ? (cost / i.price * 100) : null;
      const tgt = i.target_cost_pct || (i.recipe.mode === 'food' ? 32 : 22);
      const over = cpct != null && cpct > tgt;
      const modeLabel = i.recipe.mode === 'food' ? 'Food Plate' : 'Single Drink';
      const yld = i.recipe.mode === 'food' ? (i.recipe.plate_yield > 1 ? i.recipe.plate_yield + ' plates' : '1 plate') : '1 drink';
      return '<tr>'
        + '<td><div class="val">' + esc(i.name) + '</div>'
        + '<div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:' + (over ? 'var(--red)' : 'var(--t3)') + ';">' + modeLabel + '</div></td>'
        + '<td>' + esc(i.category || '-') + '</td>'
        + '<td>' + esc(yld) + '</td>'
        + '<td>' + App.fmtCurrency(cost) + '</td>'
        + '<td>' + (i.price ? App.fmtCurrency(i.price) : '-') + '</td>'
        + '<td class="' + (over ? 'neg' : cpct != null ? 'pos' : '') + '">' + (cpct != null ? App.fmtPct(cpct) : '-') + '</td>'
        + '<td>' + App.fmtPct(tgt) + '</td>'
        + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm rl-edit-menu" data-id="' + i.id + '">Edit Recipe</button>'
          + '<button class="btn btn-danger btn-sm rl-remove-menu" data-id="' + i.id + '">Remove</button>'
        + '</div></td></tr>';
    }).join('');
    return '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.6;">'
        + 'Menu items with a recipe attached. Each item\'s cost is computed live from current product prices in Inventory Control and feeds Menu Items and Menu Engineering directly.'
      + '</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Menu Item</th><th>Category</th><th>Yield</th><th>Cost/Serving</th><th>Menu Price</th><th>Recipe Cost %</th><th>Target %</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  },

  renderBatchTab() {
    const batches = App.batches();
    if (batches.length === 0) {
      return '<div class="empty"><div class="empty-title">No batch recipes yet</div>'
        + '<div class="empty-sub">Batches are prep recipes that produce a yield consumed by drinks. Frozen margarita mix, simple syrup, marinara base.</div>'
        + '<button class="btn btn-primary" id="rl-new-batch">New Batch</button></div>';
    }
    const rows = batches.map(b => {
      const { total_cost, cost_per_serving } = this.computeFromRows(b.ingredients || [], 'batch', { servings_per_batch: b.servings_per_batch });
      return '<tr>'
        + '<td><div class="val">' + esc(b.name) + '</div></td>'
        + '<td>' + esc(b.category || '-') + '</td>'
        + '<td>' + (b.batch_yield || '-') + ' ' + esc(b.batch_yield_unit || '') + '</td>'
        + '<td>' + (b.servings_per_batch ? b.servings_per_batch.toFixed(1) + ' servings' : '-') + '</td>'
        + '<td>' + App.fmtCurrency(total_cost) + '</td>'
        + '<td>' + App.fmtCurrency(cost_per_serving) + '</td>'
        + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm rl-edit-batch" data-id="' + b.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm rl-del-batch" data-id="' + b.id + '">Delete</button>'
        + '</div></td></tr>';
    }).join('');
    return '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.6;">'
        + 'Prep batches: large recipes you make in advance. Each batch has a yield (gallon, quart) and a serving size that divides total cost into per-serving cost. Batches are separate from menu items because they\'re intermediate prep, not sellable items themselves.'
      + '</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Batch</th><th>Category</th><th>Yield</th><th>Servings</th><th>Total Cost</th><th>Cost/Serving</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  },

  wireList() {
    this.container.querySelectorAll('.rl-tab').forEach(b => b.addEventListener('click', () => { this.tab = b.dataset.tab; this.renderList(); }));
    this.container.querySelectorAll('.rl-edit-menu').forEach(b => b.addEventListener('click', () => this.editMenuItemRecipe(b.dataset.id)));
    this.container.querySelectorAll('.rl-remove-menu').forEach(b => b.addEventListener('click', () => this.removeRecipeFromMenuItem(b.dataset.id)));
    this.container.querySelectorAll('.rl-edit-batch').forEach(b => b.addEventListener('click', () => this.showBatchForm(b.dataset.id)));
    this.container.querySelectorAll('.rl-del-batch').forEach(b => b.addEventListener('click', () => this.deleteBatch(b.dataset.id)));
    document.getElementById('rl-attach')?.addEventListener('click', () => this.showAttachRecipePicker());
    document.getElementById('rl-new-batch')?.addEventListener('click', () => this.showBatchForm(null));
  },

  // ── Attach Recipe to an Existing Menu Item ────────────────────────────────
  showAttachRecipePicker() {
    const items = App.menuItems().filter(i => !i.recipe || !Array.isArray(i.recipe.ingredients) || !i.recipe.ingredients.length);
    const opts = items.map(i => '<option value="' + i.id + '">' + esc(i.name) + (i.category ? ' (' + esc(i.category) + ')' : '') + '</option>').join('');

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">Build a Recipe</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">'
        + 'Pick a menu item to attach a recipe to, or create a new menu item with this recipe.'
      + '</div>'
      + (items.length > 0
          ? '<div class="form-row" style="gap:14px;margin-bottom:14px;">'
            + '<div class="f" style="flex:1;min-width:240px;"><label>Existing Menu Item</label>'
            + '<select id="rl-pick-item">' + '<option value="">Select item...</option>' + opts + '</select></div>'
            + '<div style="align-self:flex-end;padding-bottom:10px;font-size:12px;color:var(--t3);">or</div>'
            + '</div>'
          : '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">No existing menu items without a recipe. Add one below.</div>')
      + '<div class="form-row" style="gap:14px;margin-bottom:14px;">'
        + '<div class="f" style="flex:1;min-width:240px;"><label>Or Create New Menu Item</label>'
        + '<input type="text" id="rl-new-item" placeholder="New item name"/></div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:14px;">Recipe type:</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;">'
        + '<button class="btn btn-ghost" id="rl-pick-single">Single Drink</button>'
        + '<button class="btn btn-ghost" id="rl-pick-food">Food Plate</button>'
      + '</div>'
      + '<div class="card-actions"><button class="btn btn-ghost" id="rl-pick-cancel">Cancel</button>'
      + '<span id="rl-pick-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    document.getElementById('rl-pick-cancel')?.addEventListener('click', () => this.renderList());
    const pick = (mode) => {
      const err = document.getElementById('rl-pick-err');
      const existingId = document.getElementById('rl-pick-item')?.value || '';
      const newName = document.getElementById('rl-new-item')?.value.trim() || '';
      if (!existingId && !newName) {
        if (err) { err.textContent = 'Pick an existing item or type a new one.'; err.style.display = 'inline'; }
        return;
      }
      if (existingId) {
        const item = App.menuItemById(existingId);
        if (!item) return;
        item.recipe = { mode, ingredients: [], plate_yield: mode === 'food' ? 1 : null };
        App.saveKey('menu_items').then(() => this.editMenuItemRecipe(existingId));
      } else {
        // Create a new menu item with this recipe
        const newItem = {
          id: App.uid(),
          name: newName,
          category: mode === 'food' ? 'Entrees' : 'Cocktails',
          price: 0,
          cost: 0,
          weekly_covers: 0,
          notes: '',
          recipe: { mode, ingredients: [], plate_yield: mode === 'food' ? 1 : null },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        App.menuItems().push(newItem);
        App.saveKey('menu_items').then(() => this.editMenuItemRecipe(newItem.id));
      }
    };
    document.getElementById('rl-pick-single')?.addEventListener('click', () => pick('single'));
    document.getElementById('rl-pick-food')?.addEventListener('click', () => pick('food'));
  },

  removeRecipeFromMenuItem(id) {
    const item = App.menuItemById(id);
    if (!item) return;
    if (!confirm('Remove the recipe from "' + item.name + '"? Cost will fall back to manual entry.')) return;
    item.recipe = null;
    App.saveKey('menu_items').then(() => this.renderList());
  },

  // ── Menu Item Recipe Editor ───────────────────────────────────────────────
  editMenuItemRecipe(id) {
    const item = App.menuItemById(id);
    if (!item || !item.recipe) { this.renderList(); return; }
    this.editId = id;
    this.editBatchId = null;
    this.mode = item.recipe.mode;
    this.rows = (item.recipe.ingredients || []).map(i => {
      const p = this.prodsForMode(this.mode).find(x => x.id === i.product_id);
      return { ...i, cost_per_unit: this.costBasis(p, this.mode), total_cost: this.costBasis(p, this.mode) * (i.quantity || 0) };
    });
    if (this.rows.length === 0) this.rows = [{ product_id: '', quantity: '', cost_per_unit: 0, total_cost: 0 }];

    const target = item.target_cost_pct || (this.mode === 'food' ? 32 : 22);
    const modeLabel = this.mode === 'food' ? 'Food Plate' : 'Single Drink';

    const plateYieldField = this.mode === 'food'
      ? '<div class="f" style="width:130px;flex-shrink:0;"><label>Plates Per Batch</label>'
        + '<input type="number" id="rl-plate-yield" value="' + (item.recipe.plate_yield || 1) + '" min="1"/></div>'
      : '';

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="rl-back">&#8592; Back to Recipe Library</button></div>'
      + '<div class="card">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:14px;">'
        + '<div>'
          + '<div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">' + modeLabel + ' Recipe</div>'
          + '<div style="font-size:18px;font-weight:800;color:var(--t1);margin-top:2px;">' + esc(item.name) + '</div>'
        + '</div>'
        + '<div style="font-size:11px;color:var(--t3);">Menu item fields live on the Menu Items screen. This is the ingredient editor.</div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Menu Price</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rl-menu-price" value="' + (item.price || '') + '" step="0.25"/></div></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Target Cost %</label>'
          + '<div class="fw"><input class="suf" type="number" id="rl-target-pct" value="' + target + '" step="0.5"/><span class="suf">%</span></div></div>'
        + plateYieldField
      + '</div>'
      + '<div class="sh" style="margin-top:14px;">' + (this.mode === 'food' ? 'Kitchen' : 'Bar') + ' Ingredients</div>'
      + '<div id="rl-ings" style="margin-bottom:12px;"></div>'
      + '<button class="btn btn-ghost btn-sm" id="rl-add-ing" style="margin-bottom:14px;">+ Add Ingredient</button>'
      + '<div class="calc" style="margin-bottom:0;">'
        + '<div class="calc-item"><div class="calc-label">Total Ingredient Cost</div><div class="calc-val" id="rl-tc">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Cost Per Serving</div><div class="calc-val" id="rl-cps">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Recipe Cost %</div><div class="calc-val" id="rl-cpct">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Target</div><div class="calc-val dim" id="rl-tgt-d">-</div></div>'
      + '</div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="rl-save-menu">Save Recipe</button>'
        + '<button class="btn btn-ghost" id="rl-cancel">Cancel</button>'
        + '<span id="rl-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.renderRows();
    this.calc();
    this.container.onclick = ev => {
      if (ev.target.closest('#rl-back') || ev.target.closest('#rl-cancel')) { this.editId = null; this.renderList(); }
      if (ev.target.closest('#rl-save-menu')) this.saveMenuRecipe();
      if (ev.target.closest('#rl-add-ing')) this.addRow();
      if (ev.target.closest('.rl-rm-ing')) this.removeRow(parseInt(ev.target.closest('.rl-rm-ing').dataset.i));
    };
    this.container.addEventListener('change', ev => {
      if (ev.target.classList.contains('rl-ing-prod')) this.onProdChange(ev.target);
      if (['rl-menu-price', 'rl-target-pct', 'rl-plate-yield'].includes(ev.target.id)) this.calc();
    });
    this.container.addEventListener('input', ev => {
      if (ev.target.classList.contains('rl-ing-qty')) this.calc();
      if (['rl-menu-price', 'rl-target-pct', 'rl-plate-yield'].includes(ev.target.id)) this.calc();
    });
  },

  renderRows() {
    const area = document.getElementById('rl-ings');
    if (!area) return;
    const mode = this.mode;
    const qHead = mode === 'single' ? 'Pours' : mode === 'batch' ? 'Qty' : 'Qty';
    area.innerHTML = '<div class="card" style="padding:0;overflow:hidden;">'
      + '<table class="ing-tbl"><thead><tr><th>Ingredient</th><th>' + qHead + '</th><th>Unit</th><th>' + (mode === 'single' ? 'Cost/Pour' : 'Unit Cost') + '</th><th>Line Cost</th><th></th></tr></thead>'
      + '<tbody>' + this.rows.map((ing, idx) => {
        const prod = ing.product_id ? this.prodsForMode(mode).find(p => p.id === ing.product_id) : null;
        const unit = this.unitLabel(prod, mode);
        const cost = this.costBasis(prod, mode);
        const costD = cost > 0 ? App.fmtCurrency(cost) : (prod ? '<span style="color:var(--red);font-size:10px;">Add cost</span>' : '-');
        const lineD = ing.total_cost > 0 ? App.fmtCurrency(ing.total_cost) : '-';
        return '<tr><td style="min-width:180px;"><select class="form-input rl-ing-prod" data-i="' + idx + '" style="width:100%;">' + this.prodOpts(mode, ing.product_id) + '</select></td>'
          + '<td style="width:90px;"><input class="form-input rl-ing-qty" type="number" data-i="' + idx + '" value="' + (ing.quantity || '') + '" min="0" step="0.25" style="width:100%;padding:6px 8px;"/></td>'
          + '<td style="width:70px;color:var(--t2);font-size:12px;">' + unit + '</td>'
          + '<td style="width:90px;font-size:12px;">' + costD + '</td>'
          + '<td style="width:90px;" class="val" id="rl-lc-' + idx + '">' + lineD + '</td>'
          + '<td style="width:36px;"><button class="btn btn-danger btn-sm rl-rm-ing" data-i="' + idx + '" style="padding:4px 8px;">×</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  },

  onProdChange(sel) {
    const idx = parseInt(sel.dataset.i);
    const prod = sel.value ? this.prodsForMode(this.mode).find(p => p.id === sel.value) : null;
    this.rows[idx].product_id = sel.value;
    this.rows[idx].cost_per_unit = this.costBasis(prod, this.mode);
    this.rows[idx].total_cost = 0;
    this.renderRows();
    this.calc();
  },
  addRow() { this.rows.push({ product_id: '', quantity: '', cost_per_unit: 0, total_cost: 0 }); this.renderRows(); },
  removeRow(idx) { this.rows.splice(idx, 1); this.renderRows(); this.calc(); },

  calc() {
    const mode = this.mode;
    document.querySelectorAll('.rl-ing-qty').forEach(el => {
      const idx = parseInt(el.dataset.i);
      if (!this.rows[idx]) return;
      const qty = parseFloat(el.value) || 0;
      this.rows[idx].quantity = qty;
      this.rows[idx].total_cost = qty * (this.rows[idx].cost_per_unit || 0);
      const le = document.getElementById('rl-lc-' + idx);
      if (le) le.textContent = this.rows[idx].total_cost > 0 ? App.fmtCurrency(this.rows[idx].total_cost) : '-';
    });
    const tc = this.rows.reduce((s, i) => s + (i.total_cost || 0), 0);
    const mp = parseFloat(document.getElementById('rl-menu-price')?.value) || 0;
    const tpct = parseFloat(document.getElementById('rl-target-pct')?.value) || 22;
    let cps = tc, spb = null;
    if (mode === 'batch') {
      const by = parseFloat(document.getElementById('rl-batch-yield')?.value) || 0;
      const bu = document.getElementById('rl-batch-yield-unit')?.value || 'oz';
      const ss = parseFloat(document.getElementById('rl-serving-size')?.value) || 0;
      const su = document.getElementById('rl-serving-size-unit')?.value || 'oz';
      spb = by > 0 && ss > 0 ? this.toOz(by, bu) / this.toOz(ss, su) : null;
      const spbEl = document.getElementById('rl-spb');
      if (spbEl) spbEl.textContent = spb != null ? spb.toFixed(1) + ' servings' : '-';
      cps = spb && spb > 0 ? tc / spb : tc;
    } else if (mode === 'food') {
      const py = parseFloat(document.getElementById('rl-plate-yield')?.value) || 1;
      cps = py > 0 ? tc / py : tc;
    }
    const cpct = mp > 0 ? (cps / mp * 100) : null;
    const set = (id, val, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = val; el.className = 'calc-val' + (cls ? ' ' + cls : ''); };
    set('rl-tc', tc > 0 ? App.fmtCurrency(tc) : '-');
    set('rl-cps', cps > 0 ? App.fmtCurrency(cps) : '-');
    set('rl-cpct', cpct != null ? App.fmtPct(cpct) : '-', cpct != null ? (cpct > tpct ? 'warn' : 'good') : '');
    set('rl-tgt-d', App.fmtPct(tpct));
  },

  async saveMenuRecipe() {
    if (this._saving) return;
    this._saving = true;
    setTimeout(() => { this._saving = false; }, 1000);
    const item = App.menuItemById(this.editId);
    if (!item) { this.editId = null; this.renderList(); return; }
    document.querySelectorAll('.rl-ing-qty').forEach(el => {
      const idx = parseInt(el.dataset.i);
      if (this.rows[idx]) {
        this.rows[idx].quantity = parseFloat(el.value) || 0;
        this.rows[idx].total_cost = this.rows[idx].quantity * (this.rows[idx].cost_per_unit || 0);
      }
    });
    const mp = parseFloat(document.getElementById('rl-menu-price')?.value) || 0;
    const tpct = parseFloat(document.getElementById('rl-target-pct')?.value) || 22;
    const py = this.mode === 'food' ? (parseFloat(document.getElementById('rl-plate-yield')?.value) || 1) : null;

    item.recipe = {
      mode: this.mode,
      ingredients: this.rows.filter(r => r.product_id && r.quantity > 0).map(r => ({ product_id: r.product_id, quantity: r.quantity })),
      plate_yield: py
    };
    item.price = mp;
    item.target_cost_pct = tpct;
    item.cost = App.menuItemCost(item);
    item.updated_at = new Date().toISOString();

    await App.saveKey('menu_items');
    App.markSetupDone('gs_p_recipes');
    this.editId = null;
    this.renderList();
  },

  // ── Batch Editor ──────────────────────────────────────────────────────────
  showBatchForm(id) {
    this.editBatchId = id || null;
    this.editId = null;
    this.mode = 'batch';
    const b = id ? App.batches().find(x => x.id === id) : null;
    this.rows = b?.ingredients ? b.ingredients.map(i => {
      const p = this.allProds().find(x => x.id === i.product_id);
      return { ...i, cost_per_unit: this.costBasis(p, 'batch'), total_cost: this.costBasis(p, 'batch') * (i.quantity || 0) };
    }) : [{ product_id: '', quantity: '', cost_per_unit: 0, total_cost: 0 }];

    const catOpts = ['Cocktail Mix', 'Syrup', 'Sauce', 'Marinade', 'Stock', 'Other']
      .map(c => '<option' + (b?.category === c ? ' selected' : '') + '>' + c + '</option>').join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="rl-back">&#8592; Back to Recipe Library</button></div>'
      + '<div class="card">'
      + '<div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:6px;">Batch Recipe</div>'
      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f w-lg"><label>Batch Name</label><input type="text" id="rl-batch-name" value="' + esc(b?.name || '') + '" placeholder="Frozen Margarita Mix"/></div>'
        + '<div class="f w-md"><label>Category</label><select id="rl-batch-cat">' + catOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:220px;flex-shrink:0;"><label>Batch Yield</label>'
          + '<div class="fj"><input type="number" id="rl-batch-yield" value="' + (b?.batch_yield || '') + '" placeholder="1"/><select id="rl-batch-yield-unit">' + this.yOpts(b?.batch_yield_unit) + '</select></div></div>'
        + '<div class="f" style="width:220px;flex-shrink:0;"><label>Serving Size</label>'
          + '<div class="fj"><input type="number" id="rl-serving-size" value="' + (b?.serving_size || '') + '" placeholder="5"/><select id="rl-serving-size-unit">' + this.yOpts(b?.serving_size_unit) + '</select></div></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Servings Per Batch</label><div class="f-display" id="rl-spb">-</div></div>'
      + '</div>'
      + '<div class="sh" style="margin-top:4px;">Ingredients</div>'
      + '<div id="rl-ings" style="margin-bottom:12px;"></div>'
      + '<button class="btn btn-ghost btn-sm" id="rl-add-ing" style="margin-bottom:14px;">+ Add Ingredient</button>'
      + '<div class="calc" style="margin-bottom:0;">'
        + '<div class="calc-item"><div class="calc-label">Total Ingredient Cost</div><div class="calc-val" id="rl-tc">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Cost Per Serving</div><div class="calc-val" id="rl-cps">-</div></div>'
      + '</div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="rl-save-batch">' + (id ? 'Update' : 'Save Batch') + '</button>'
        + '<button class="btn btn-ghost" id="rl-cancel">Cancel</button>'
        + '<span id="rl-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.renderRows();
    this.calc();
    this.container.onclick = ev => {
      if (ev.target.closest('#rl-back') || ev.target.closest('#rl-cancel')) { this.editBatchId = null; this.renderList(); }
      if (ev.target.closest('#rl-save-batch')) this.saveBatch();
      if (ev.target.closest('#rl-add-ing')) this.addRow();
      if (ev.target.closest('.rl-rm-ing')) this.removeRow(parseInt(ev.target.closest('.rl-rm-ing').dataset.i));
    };
    this.container.addEventListener('change', ev => {
      if (ev.target.classList.contains('rl-ing-prod')) this.onProdChange(ev.target);
      if (['rl-batch-yield', 'rl-batch-yield-unit', 'rl-serving-size', 'rl-serving-size-unit'].includes(ev.target.id)) this.calc();
    });
    this.container.addEventListener('input', ev => {
      if (ev.target.classList.contains('rl-ing-qty')) this.calc();
      if (['rl-batch-yield', 'rl-serving-size'].includes(ev.target.id)) this.calc();
    });
  },

  async saveBatch() {
    const name = document.getElementById('rl-batch-name')?.value.trim();
    const err = document.getElementById('rl-err');
    if (!name) { if (err) { err.textContent = 'Batch name required.'; err.style.display = 'inline'; } return; }

    document.querySelectorAll('.rl-ing-qty').forEach(el => {
      const idx = parseInt(el.dataset.i);
      if (this.rows[idx]) {
        this.rows[idx].quantity = parseFloat(el.value) || 0;
        this.rows[idx].total_cost = this.rows[idx].quantity * (this.rows[idx].cost_per_unit || 0);
      }
    });
    const tc = this.rows.reduce((s, i) => s + (i.total_cost || 0), 0);
    const by = parseFloat(document.getElementById('rl-batch-yield')?.value) || 0;
    const bu = document.getElementById('rl-batch-yield-unit')?.value || 'oz';
    const ss = parseFloat(document.getElementById('rl-serving-size')?.value) || 0;
    const su = document.getElementById('rl-serving-size-unit')?.value || 'oz';
    const spb = by > 0 && ss > 0 ? this.toOz(by, bu) / this.toOz(ss, su) : null;
    const cps = spb && spb > 0 ? tc / spb : tc;

    const rec = {
      id: this.editBatchId || App.uid(),
      name,
      category: document.getElementById('rl-batch-cat')?.value,
      ingredients: this.rows.filter(r => r.product_id && r.quantity > 0).map(r => ({ product_id: r.product_id, quantity: r.quantity })),
      batch_yield: by, batch_yield_unit: bu,
      serving_size: ss, serving_size_unit: su,
      servings_per_batch: spb,
      total_cost: tc, cost_per_serving: cps,
      updated_at: new Date().toISOString(),
      created_at: this.editBatchId ? undefined : new Date().toISOString()
    };
    if (this.editBatchId) {
      const i = App.batches().findIndex(b => b.id === this.editBatchId);
      if (i > -1) App.batches()[i] = { ...App.batches()[i], ...rec };
    } else {
      App.batches().push(rec);
    }
    await App.saveKey('batches');
    this.editBatchId = null;
    this.renderList();
  },

  deleteBatch(id) {
    if (!confirm('Delete this batch?')) return;
    App.data.batches = App.batches().filter(b => b.id !== id);
    App.saveKey('batches').then(() => this.renderList());
  }
};
