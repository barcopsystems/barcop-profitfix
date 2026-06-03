'use strict';

/* ── Inventory Control — Prep Batches ─────────────────────────────────────────
   Made-in-house ingredients (frozen margarita mix, simple syrup, marinara,
   stocks). Reference data, just like Products / Locations / Vendors — built
   once, then consumed by menu item recipes.

   Stored in App.inventoryData.ic_prep_batches per Rule 21 (Control data lives
   in ic_data). Each batch carries: name, category, batch_yield + unit,
   serving_size + unit, computed servings_per_batch, ingredient list (products
   only), and computed total_cost + cost_per_serving.

   The Menu Items recipe editor (Revenue Recovery) picks ingredients from
   both Products AND Prep Batches. When a recipe uses a batch, its
   cost_per_serving × quantity rolls into the menu item's effective cost. */

S.PrepBatches = {
  editId: null,
  rows: [],
  _saving: false,

  YUNITS: [
    { l: 'oz',      oz: 1 },
    { l: 'ml',      oz: 0.033814 },
    { l: 'liters',  oz: 33.814 },
    { l: 'gallons', oz: 128 },
    { l: 'quarts',  oz: 32 },
    { l: 'pints',   oz: 16 },
    { l: 'cups',    oz: 8 }
  ],
  yOpts(sel) {
    return this.YUNITS.map(u =>
      '<option value="' + u.l + '"' + (u.l === (sel || 'oz') ? ' selected' : '') + '>' + u.l + '</option>'
    ).join('');
  },
  toOz(v, u) { const m = this.YUNITS.find(x => x.l === u); return v * (m ? m.oz : 1); },

  CATEGORIES: ['Cocktail Mix', 'Syrup', 'Sauce', 'Marinade', 'Stock', 'Dressing', 'Other'],

  list() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_prep_batches)) App.inventoryData.ic_prep_batches = [];
    return App.inventoryData.ic_prep_batches;
  },
  byId(id) { return this.list().find(b => b.id === id) || null; },

  // Batch category drives the ingredient filter automatically. Drink-side
  // batches (Cocktail Mix, Syrup) pull only bar ingredients; kitchen batches
  // (Sauce, Marinade, Stock, Dressing) pull only kitchen ingredients. No
  // chicken in your margarita mix dropdown.
  BAR_CATS:  ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Misc'],
  FOOD_CATS: ['Food', 'Misc'],
  BATCH_CAT_TO_MODE: {
    'Cocktail Mix': 'bar',
    'Syrup':        'bar',
    'Sauce':        'food',
    'Marinade':     'food',
    'Stock':        'food',
    'Dressing':     'food',
    'Other':        'all'
  },
  modeForBatchCategory(cat) { return this.BATCH_CAT_TO_MODE[cat] || 'all'; },

  products() { return (App.inventoryData && App.inventoryData.ic_products) || []; },
  prodById(id) { return this.products().find(p => p.id === id) || null; },
  prodOpts(selId, mode) {
    const all = this.products().filter(p => p.active !== false);
    if (!all.length) return '<option value="">No products set up</option>';
    let cats;
    if (mode === 'bar')       cats = this.BAR_CATS;
    else if (mode === 'food') cats = this.FOOD_CATS;
    else                      cats = [...new Set([...this.BAR_CATS, ...this.FOOD_CATS])]; // 'all'

    let h = '<option value="">Select ingredient...</option>';
    cats.forEach(cat => {
      const inCat = all.filter(p => (p.category || '') === cat)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (!inCat.length) return;
      h += '<optgroup label="' + esc(cat) + '">';
      inCat.forEach(p => {
        h += '<option value="' + p.id + '"' + (p.id === selId ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      });
      h += '</optgroup>';
    });
    return h;
  },
  // For batches, ingredient quantity is in the product's unit (bottle / unit),
  // so cost basis is unit_cost (not cost_per_pour). Sized bar products
  // (Liquor/Wine/Beer with case-tracking) use App.bottleCost; everything
  // else falls back to unit_cost.
  SIZED_BAR_CATS: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer'],
  unitCost(prod) {
    if (!prod) return 0;
    if (this.SIZED_BAR_CATS.includes(prod.category) && App.bottleCost) {
      const bc = App.bottleCost(prod);
      if (bc != null) return bc;
    }
    return prod.unit_cost || 0;
  },
  unitLabel(prod) {
    if (!prod) return '-';
    return this.SIZED_BAR_CATS.includes(prod.category) ? 'bottles' : 'units';
  },

  computeRows(rows, batch_yield, batch_yield_unit, serving_size, serving_size_unit) {
    const tc = rows.reduce((s, r) => s + ((r.cost_per_unit || 0) * (r.quantity || 0)), 0);
    const by = parseFloat(batch_yield) || 0;
    const ss = parseFloat(serving_size) || 0;
    const spb = (by > 0 && ss > 0) ? this.toOz(by, batch_yield_unit || 'oz') / this.toOz(ss, serving_size_unit || 'oz') : null;
    const cps = (spb && spb > 0) ? tc / spb : tc;
    return { total_cost: tc, servings_per_batch: spb, cost_per_serving: cps };
  },

  // ── Entry ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.editId = null;
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Prep Batches Work', [
      { p: ['Prep batches are the things you make in-house from other products: a frozen margarita mix, simple syrup, a marinara base, a demi-glace. Build the recipe once here and any menu item can use the batch as an ingredient.'] },
      { h: 'Yield And Serving Size', p: ['Batch Yield is how much the whole batch makes, like a 1 gallon mix. Serving Size is how much one drink or plate pulls from it, like 5 oz per margarita. Bar Cop divides the two to get Servings Per Batch, then splits the batch cost across those servings for a Cost Per Serving.'] },
      { h: 'Ingredients', p: ['Add each product that goes into the batch and how much. The batch category sets which products you can pick: a Cocktail Mix or Syrup pulls bar ingredients, a Sauce or Stock pulls kitchen ingredients. Line costs use each product’s current cost, so when an ingredient price changes the batch cost updates on its own.'] },
      { h: 'Where It Flows', p: ['A batch’s Cost Per Serving feeds straight into any menu item recipe that uses it, so your recipe and menu costs stay honest without re-entering anything.'] }
    ]);
  },

  // Seed this.rows from a batch (or one blank row for the add form).
  initRows(b) {
    this.rows = (b?.ingredients || []).map(i => {
      const p = this.prodById(i.product_id);
      return { product_id: i.product_id, quantity: i.quantity, cost_per_unit: this.unitCost(p), total_cost: this.unitCost(p) * (i.quantity || 0) };
    });
    if (!this.rows.length) this.rows = [{ product_id: '', quantity: '', cost_per_unit: 0, total_cost: 0 }];
  },

  // The add/edit form card. b = the batch being edited (null for the add form).
  // All header fields live on one row; the number cells carry tooltips.
  formCard(b) {
    const id = this.editId;
    const catOpts = this.CATEGORIES.map(c => '<option' + (b?.category === c ? ' selected' : '') + '>' + c + '</option>').join('');
    const title = id ? 'Editing ' + esc(b?.name || 'Batch') : 'Add a Prep Batch';
    return '<div class="card">'
      + (id
          ? '<div class="card-title">' + title + '</div>'
          : App.collapsibleCardTitle('ic-prep-batches', title, App.helpButton('pb-how')))
      + '<div class="collapse-body">'
      + '<div class="form-row" style="gap:12px;margin-bottom:14px;flex-wrap:wrap;align-items:flex-end;">'
        + '<div class="f" style="width:175px;flex-shrink:0;"><label>Batch Name</label>'
          + '<input type="text" id="pb-name" value="' + esc(b?.name || '') + '" placeholder="Frozen Margarita Mix"/></div>'
        + '<div class="f" style="width:135px;flex-shrink:0;"><label>Category</label>'
          + '<select id="pb-cat"><option value="">Select...</option>' + catOpts + '</select></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Batch Yield ' + tt('pb-yield') + '</label>'
          + '<div class="fj"><input type="number" id="pb-yield" value="' + (b?.batch_yield || '') + '" placeholder="1"/><select id="pb-yield-unit">' + this.yOpts(b?.batch_yield_unit) + '</select></div></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Serving Size ' + tt('pb-serving') + '</label>'
          + '<div class="fj"><input type="number" id="pb-serv" value="' + (b?.serving_size || '') + '" placeholder="5"/><select id="pb-serv-unit">' + this.yOpts(b?.serving_size_unit) + '</select></div></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Servings Per Batch ' + tt('pb-spb') + '</label>'
          + '<div class="f-display" id="pb-spb">-</div></div>'
      + '</div>'
      + '<div class="sh" style="margin-top:4px;">Ingredients</div>'
      + '<div id="pb-ings" style="margin-bottom:12px;"></div>'
      + '<button class="btn btn-ghost btn-sm" id="pb-add-ing" style="margin-bottom:14px;">+ Add Ingredient</button>'
      + '<div class="calc" style="margin-bottom:0;">'
        + '<div class="calc-item"><div class="calc-label">Total Ingredient Cost</div><div class="calc-val" id="pb-tc">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Cost Per Serving</div><div class="calc-val" id="pb-cps">-</div></div>'
      + '</div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="pb-save">' + (id ? 'Update Batch' : 'Save Batch') + '</button>'
        + '<button class="btn btn-ghost" id="pb-cancel">' + (id ? 'Cancel' : 'Clear') + '</button>'
        + '<span id="pb-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';
  },

  // Landing: the add form on top, the batch list below.
  renderList() {
    this.actions.innerHTML = '';
    this.editId = null;
    this._editingIncomplete = false;
    this.initRows(null);

    const batches = this.list();

    // Keep stored batch costs in sync with current product costs so the list and
    // any menu item that rolls up cost_per_serving never show a stale number when
    // an ingredient's price has changed since the batch was last edited.
    let _batchCostChanged = false;
    batches.forEach(b => {
      const ingRows = (b.ingredients || []).map(i => ({ cost_per_unit: this.unitCost(this.prodById(i.product_id)), quantity: i.quantity || 0 }));
      const out = this.computeRows(ingRows, b.batch_yield, b.batch_yield_unit, b.serving_size, b.serving_size_unit);
      if (Math.abs((b.total_cost || 0) - (out.total_cost || 0)) > 0.005
          || Math.abs((b.cost_per_serving || 0) - (out.cost_per_serving || 0)) > 0.005) {
        b.total_cost = out.total_cost;
        b.cost_per_serving = out.cost_per_serving;
        b.servings_per_batch = out.servings_per_batch;
        (b.ingredients || []).forEach(ing => {
          ing.cost_per_unit = this.unitCost(this.prodById(ing.product_id));
          ing.total_cost = (ing.cost_per_unit || 0) * (ing.quantity || 0);
        });
        _batchCostChanged = true;
      }
    });
    if (_batchCostChanged) App.saveInventory();

    let listSection;
    if (!batches.length) {
      listSection = '<div style="margin-top:18px;font-size:12px;color:var(--t3);">No prep batches yet. Build one above and it shows here.</div>';
    } else {
      const rows = batches.map(b =>
        '<tr>'
        + '<td><div class="val">' + esc(b.name) + '</div></td>'
        + '<td>' + esc(b.category || '-') + '</td>'
        + '<td>' + (b.batch_yield || '-') + ' ' + esc(b.batch_yield_unit || '') + '</td>'
        + '<td>' + (b.servings_per_batch ? b.servings_per_batch.toFixed(1) + ' servings' : '-') + '</td>'
        + '<td>' + App.fmtCurrency(b.total_cost || 0) + '</td>'
        + '<td>' + App.fmtCurrency(b.cost_per_serving || 0) + '</td>'
        + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm pb-edit" data-id="' + b.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm pb-del" data-id="' + b.id + '">Delete</button>'
        + '</div></td></tr>').join('');
      listSection = '<div class="card" style="margin-top:18px;"><div class="card-title">Prep Batches</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
          + '<th>Batch</th><th>Category</th><th>Yield</th><th>Servings</th><th>Total Cost</th><th>Cost / Serving</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + this.formCard(null) + listSection + '</div>';
    this.renderRows();
    this.calc();
    this._wire();
  },

  // ── Form ─────────────────────────────────────────────────────────────────
  // Edit opens on its own page (form only, no list, no Back button — the
  // sidebar handles getting back). The add form lives on the landing.
  showForm(id) {
    this.editId = id || null;
    const b = id ? this.byId(id) : null;
    // Field-missing highlights fire ONLY when editing an incomplete batch.
    this._editingIncomplete = !!(b && this.missingFields(b).size > 0);
    this.initRows(b);
    this.actions.innerHTML = '';
    this.container.innerHTML = '<div class="screen">' + this.formCard(b) + '</div>';
    this.renderRows();
    this.calc();
    this._wire();
    if (this.editId) this.applyMissingFieldHighlights();
  },

  cancelForm() { this.editId = null; this.renderList(); },

  // Shared wiring for the form (add on landing OR edit page) plus the list's
  // Edit/Delete buttons. Uses on* assignment so handlers never stack across
  // re-renders.
  _wire() {
    this.container.onclick = ev => {
      if (ev.target.closest('#pb-how'))     { this.showHowTo(); return; }
      const head = ev.target.closest('.card-collapse-head');
      if (head) { App.toggleCollapse(head); return; }
      if (ev.target.closest('#pb-save'))    { this.saveBatch(); return; }
      if (ev.target.closest('#pb-cancel'))  { this.cancelForm(); return; }
      if (ev.target.closest('#pb-add-ing')) { this.addRow(); return; }
      const rm = ev.target.closest('.pb-rm-ing'); if (rm) { this.removeRow(parseInt(rm.dataset.i)); return; }
      const ed = ev.target.closest('.pb-edit'); if (ed) { this.showForm(ed.dataset.id); return; }
      const dl = ev.target.closest('.pb-del'); if (dl) { this.deleteBatch(dl.dataset.id); return; }
    };
    this.container.onchange = ev => {
      if (ev.target.classList.contains('pb-ing-prod')) { this.onProdChange(ev.target); return; }
      if (['pb-yield', 'pb-yield-unit', 'pb-serv', 'pb-serv-unit'].includes(ev.target.id)) { this.calc(); return; }
      if (ev.target.id === 'pb-cat') {
        // Batch category changed — clear any selected ingredient that no longer
        // belongs in the filter, then re-render the ingredient picker.
        const mode = this.modeForBatchCategory(ev.target.value);
        const allowed = mode === 'bar' ? this.BAR_CATS : mode === 'food' ? this.FOOD_CATS : null;
        if (allowed) {
          this.rows = this.rows.map(r => {
            const p = r.product_id ? this.prodById(r.product_id) : null;
            if (p && !allowed.includes(p.category)) return { product_id: '', quantity: '', cost_per_unit: 0, total_cost: 0 };
            return r;
          });
        }
        this.renderRows();
        this.calc();
        this.refreshFieldMissing();
        return;
      }
      if (ev.target.id === 'pb-name') this.refreshFieldMissing();
    };
    this.container.oninput = ev => {
      if (ev.target.classList.contains('pb-ing-qty')) this.calc();
      if (['pb-yield', 'pb-serv'].includes(ev.target.id)) this.calc();
      if (ev.target.id === 'pb-name') this.refreshFieldMissing();
    };
    App.applyCollapsed(this.container);
  },

  // Required = name + category. Ingredient list is operationally needed but
  // the operator can save a stub and fill ingredients later.
  missingFields(b) {
    const out = new Set();
    if (!b?.name)     out.add('pb-name');
    if (!b?.category) out.add('pb-cat');
    return out;
  },
  // Field-missing highlights only fire when EDITING an incomplete batch.
  // Add-new flow + edit-of-complete flow both stay clean.
  applyMissingFieldHighlights() {
    if (!this._editingIncomplete) return;
    const b = this.byId(this.editId);
    if (!b) return;
    const missing = this.missingFields(b);
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
      name:     document.getElementById('pb-name')?.value.trim() || '',
      category: document.getElementById('pb-cat')?.value || ''
    };
    const missing = this.missingFields(synthetic);
    ['pb-name', 'pb-cat'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const wrap = el.closest('.f');
      if (!wrap) return;
      if (missing.has(id)) wrap.classList.add('field-missing');
      else wrap.classList.remove('field-missing');
    });
  },

  renderRows() {
    const area = document.getElementById('pb-ings');
    if (!area) return;
    const currentCat = document.getElementById('pb-cat')?.value || '';
    const mode = this.modeForBatchCategory(currentCat);
    area.innerHTML = '<div class="card" style="padding:0;overflow:hidden;">'
      + '<table class="ing-tbl"><thead><tr><th>Ingredient</th><th>Qty ' + tt('pb-ing-qty') + '</th><th>Unit</th><th>Unit Cost</th><th>Line Cost</th><th></th></tr></thead>'
      + '<tbody>' + this.rows.map((ing, idx) => {
        const prod = ing.product_id ? this.prodById(ing.product_id) : null;
        const unit = this.unitLabel(prod);
        const cost = this.unitCost(prod);
        const costD = cost > 0 ? App.fmtCurrency(cost) : (prod ? '<span style="color:var(--red);font-size:10px;">Add cost</span>' : '-');
        const lineD = ing.total_cost > 0 ? App.fmtCurrency(ing.total_cost) : '-';
        return '<tr><td style="min-width:200px;"><select class="form-input pb-ing-prod" data-i="' + idx + '" style="width:100%;">' + this.prodOpts(ing.product_id, mode) + '</select></td>'
          + '<td style="width:90px;"><input class="form-input pb-ing-qty" type="number" data-i="' + idx + '" value="' + (ing.quantity || '') + '" min="0" step="0.25" style="width:100%;padding:6px 8px;"/></td>'
          + '<td style="width:80px;color:var(--t2);font-size:12px;">' + unit + '</td>'
          + '<td style="width:100px;font-size:12px;">' + costD + '</td>'
          + '<td style="width:100px;" class="val" id="pb-lc-' + idx + '">' + lineD + '</td>'
          + '<td><button class="btn btn-danger btn-sm pb-rm-ing" data-i="' + idx + '">Delete</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  },

  onProdChange(sel) {
    const idx = parseInt(sel.dataset.i);
    const prod = sel.value ? this.prodById(sel.value) : null;
    this.rows[idx].product_id = sel.value;
    this.rows[idx].cost_per_unit = this.unitCost(prod);
    this.rows[idx].total_cost = 0;
    this.renderRows();
    this.calc();
  },
  addRow() { this.rows.push({ product_id: '', quantity: '', cost_per_unit: 0, total_cost: 0 }); this.renderRows(); },
  removeRow(idx) { this.rows.splice(idx, 1); this.renderRows(); this.calc(); },

  calc() {
    document.querySelectorAll('.pb-ing-qty').forEach(el => {
      const idx = parseInt(el.dataset.i);
      if (!this.rows[idx]) return;
      const qty = parseFloat(el.value) || 0;
      this.rows[idx].quantity = qty;
      this.rows[idx].total_cost = qty * (this.rows[idx].cost_per_unit || 0);
      const le = document.getElementById('pb-lc-' + idx);
      if (le) le.textContent = this.rows[idx].total_cost > 0 ? App.fmtCurrency(this.rows[idx].total_cost) : '-';
    });
    const by = parseFloat(document.getElementById('pb-yield')?.value) || 0;
    const bu = document.getElementById('pb-yield-unit')?.value || 'oz';
    const ss = parseFloat(document.getElementById('pb-serv')?.value) || 0;
    const su = document.getElementById('pb-serv-unit')?.value || 'oz';
    const out = this.computeRows(this.rows, by, bu, ss, su);
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('pb-spb', out.servings_per_batch != null ? out.servings_per_batch.toFixed(1) + ' servings' : '-');
    set('pb-tc', out.total_cost > 0 ? App.fmtCurrency(out.total_cost) : '-');
    set('pb-cps', out.cost_per_serving > 0 ? App.fmtCurrency(out.cost_per_serving) : '-');
  },

  async saveBatch() {
    if (this._saving) return;
    this._saving = true;
    setTimeout(() => { this._saving = false; }, 1000);

    const name = document.getElementById('pb-name')?.value.trim();
    const err = document.getElementById('pb-err');
    if (!name) { if (err) { err.textContent = 'Batch name required.'; err.style.display = 'inline'; } return; }

    document.querySelectorAll('.pb-ing-qty').forEach(el => {
      const idx = parseInt(el.dataset.i);
      if (this.rows[idx]) {
        this.rows[idx].quantity = parseFloat(el.value) || 0;
        this.rows[idx].total_cost = this.rows[idx].quantity * (this.rows[idx].cost_per_unit || 0);
      }
    });

    const by = parseFloat(document.getElementById('pb-yield')?.value) || 0;
    const bu = document.getElementById('pb-yield-unit')?.value || 'oz';
    const ss = parseFloat(document.getElementById('pb-serv')?.value) || 0;
    const su = document.getElementById('pb-serv-unit')?.value || 'oz';
    const out = this.computeRows(this.rows, by, bu, ss, su);

    const rec = {
      id: this.editId || App.uid(),
      name,
      category: document.getElementById('pb-cat')?.value || '',
      batch_yield: by, batch_yield_unit: bu,
      serving_size: ss, serving_size_unit: su,
      ingredients: this.rows.filter(r => r.product_id && r.quantity > 0).map(r => ({ product_id: r.product_id, quantity: r.quantity })),
      servings_per_batch: out.servings_per_batch,
      total_cost: out.total_cost,
      cost_per_serving: out.cost_per_serving,
      updated_at: new Date().toISOString(),
      created_at: this.editId ? (this.byId(this.editId)?.created_at || new Date().toISOString()) : new Date().toISOString()
    };

    if (this.editId) {
      const i = this.list().findIndex(x => x.id === this.editId);
      if (i > -1) this.list()[i] = rec;
    } else {
      this.list().push(rec);
    }
    await App.saveInventory();
    this.editId = null;
    this.renderList();
  },

  async deleteBatch(id) {
    const b = this.byId(id);
    if (!b) return;
    const ok = await App.confirm({
      title: 'Delete "' + b.name + '"?',
      message: 'Menu item recipes that use it will fall back to ingredient-only cost.',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    App.inventoryData.ic_prep_batches = this.list().filter(x => x.id !== id);
    await App.saveInventory();
    this.renderList();
  }
};
