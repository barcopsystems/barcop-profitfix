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
  // so cost basis is unit_cost (not cost_per_pour).
  unitCost(prod) {
    if (!prod) return 0;
    if (this.IC_BAR.includes(prod.category) && App.bottleCost) {
      const bc = App.bottleCost(prod);
      if (bc != null) return bc;
    }
    return prod.unit_cost || 0;
  },
  unitLabel(prod) {
    if (!prod) return '-';
    return this.IC_BAR.includes(prod.category) ? 'bottles' : 'units';
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

  renderList() {
    this.actions.innerHTML = '';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = '+ Add Prep Batch';
    addBtn.addEventListener('click', () => this.showForm(null));
    this.actions.appendChild(addBtn);

    const batches = this.list();
    if (!batches.length) {
      this.container.innerHTML = '<div class="screen"><div class="card"><div class="empty">'
        + '<div class="empty-title">No prep batches yet</div>'
        + '<div class="empty-sub">Prep batches are made-in-house ingredients — frozen margarita mix, simple syrup, marinara base, demi-glace. Set them up once and your menu item recipes can use them as ingredients.</div>'
        + '<button class="btn btn-primary" id="pb-empty-add" style="margin-top:14px;">+ Add Your First Batch</button>'
        + '</div></div></div>';
      document.getElementById('pb-empty-add')?.addEventListener('click', () => this.showForm(null));
      return;
    }

    const rows = batches.map(b => {
      return '<tr>'
        + '<td><div class="val">' + esc(b.name) + '</div></td>'
        + '<td>' + esc(b.category || '-') + '</td>'
        + '<td>' + (b.batch_yield || '-') + ' ' + esc(b.batch_yield_unit || '') + '</td>'
        + '<td>' + (b.servings_per_batch ? b.servings_per_batch.toFixed(1) + ' servings' : '-') + '</td>'
        + '<td>' + App.fmtCurrency(b.total_cost || 0) + '</td>'
        + '<td>' + App.fmtCurrency(b.cost_per_serving || 0) + '</td>'
        + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm pb-edit" data-id="' + b.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm pb-del" data-id="' + b.id + '">Delete</button>'
        + '</div></td></tr>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.6;">'
        + 'Prep batches: large recipes you make in advance, with a yield that breaks into servings. Each batch\'s cost-per-serving feeds into any menu item recipe that uses the batch as an ingredient.'
      + '</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Batch</th><th>Category</th><th>Yield</th><th>Servings</th><th>Total Cost</th><th>Cost / Serving</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';

    this.container.querySelectorAll('.pb-edit').forEach(b => b.addEventListener('click', () => this.showForm(b.dataset.id)));
    this.container.querySelectorAll('.pb-del').forEach(b => b.addEventListener('click', () => this.deleteBatch(b.dataset.id)));
  },

  // ── Form ─────────────────────────────────────────────────────────────────
  showForm(id) {
    this.editId = id || null;
    const b = id ? this.byId(id) : null;
    this.rows = (b?.ingredients || []).map(i => {
      const p = this.prodById(i.product_id);
      return { product_id: i.product_id, quantity: i.quantity, cost_per_unit: this.unitCost(p), total_cost: this.unitCost(p) * (i.quantity || 0) };
    });
    if (this.rows.length === 0) this.rows = [{ product_id: '', quantity: '', cost_per_unit: 0, total_cost: 0 }];

    const catOpts = this.CATEGORIES.map(c =>
      '<option' + (b?.category === c ? ' selected' : '') + '>' + c + '</option>').join('');

    this.actions.innerHTML = '';

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="pb-back">&#8592; Back to Prep Batches</button></div>'
      + '<div class="card">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:14px;">'
        + '<div>'
          + '<div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">Prep Batch</div>'
          + '<div style="font-size:18px;font-weight:800;color:var(--t1);margin-top:2px;">' + (id ? esc(b?.name || 'Edit Batch') : 'Add a Prep Batch') + '</div>'
        + '</div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
        + '<div class="f w-lg"><label>Batch Name</label><input type="text" id="pb-name" value="' + esc(b?.name || '') + '" placeholder="Frozen Margarita Mix"/></div>'
        + '<div class="f w-md"><label>Category</label><select id="pb-cat"><option value="">Select...</option>' + catOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
        + '<div class="f" style="width:220px;flex-shrink:0;"><label>Batch Yield</label>'
          + '<div class="fj"><input type="number" id="pb-yield" value="' + (b?.batch_yield || '') + '" placeholder="1"/><select id="pb-yield-unit">' + this.yOpts(b?.batch_yield_unit) + '</select></div></div>'
        + '<div class="f" style="width:220px;flex-shrink:0;"><label>Serving Size</label>'
          + '<div class="fj"><input type="number" id="pb-serv" value="' + (b?.serving_size || '') + '" placeholder="5"/><select id="pb-serv-unit">' + this.yOpts(b?.serving_size_unit) + '</select></div></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Servings Per Batch</label><div class="f-display" id="pb-spb">-</div></div>'
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
        + '<button class="btn btn-ghost" id="pb-cancel">Cancel</button>'
        + '<span id="pb-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.renderRows();
    this.calc();

    this.container.onclick = ev => {
      if (ev.target.closest('#pb-back') || ev.target.closest('#pb-cancel')) { this.editId = null; this.renderList(); }
      if (ev.target.closest('#pb-save')) this.saveBatch();
      if (ev.target.closest('#pb-add-ing')) this.addRow();
      if (ev.target.closest('.pb-rm-ing')) this.removeRow(parseInt(ev.target.closest('.pb-rm-ing').dataset.i));
    };
    this.container.addEventListener('change', ev => {
      if (ev.target.classList.contains('pb-ing-prod')) this.onProdChange(ev.target);
      if (['pb-yield', 'pb-yield-unit', 'pb-serv', 'pb-serv-unit'].includes(ev.target.id)) this.calc();
      if (ev.target.id === 'pb-cat') {
        // Batch category changed — clear any selected ingredient that no longer
        // belongs in the filter (e.g. switched from Cocktail Mix to Sauce),
        // then re-render the ingredient picker with the new filter.
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
      }
      if (ev.target.id === 'pb-name') this.refreshFieldMissing();
    });
    this.container.addEventListener('input', ev => {
      if (ev.target.classList.contains('pb-ing-qty')) this.calc();
      if (['pb-yield', 'pb-serv'].includes(ev.target.id)) this.calc();
      if (ev.target.id === 'pb-name') this.refreshFieldMissing();
    });

    // Highlight missing required fields when EDITING an incomplete record.
    if (this.editId) this.applyMissingFieldHighlights();
  },

  // Required = name + category. Ingredient list is operationally needed but
  // the operator can save a stub and fill ingredients later.
  missingFields(b) {
    const out = new Set();
    if (!b?.name)     out.add('pb-name');
    if (!b?.category) out.add('pb-cat');
    return out;
  },
  applyMissingFieldHighlights() {
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
      + '<table class="ing-tbl"><thead><tr><th>Ingredient</th><th>Qty</th><th>Unit</th><th>Unit Cost</th><th>Line Cost</th><th></th></tr></thead>'
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
          + '<td style="width:36px;"><button class="btn btn-danger btn-sm pb-rm-ing" data-i="' + idx + '" style="padding:4px 8px;">&times;</button></td></tr>';
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

  deleteBatch(id) {
    const b = this.byId(id);
    if (!b) return;
    if (!confirm('Delete "' + b.name + '"? Menu item recipes that use it will fall back to ingredient-only cost.')) return;
    App.inventoryData.ic_prep_batches = this.list().filter(x => x.id !== id);
    App.saveInventory().then(() => this.renderList());
  }
};
