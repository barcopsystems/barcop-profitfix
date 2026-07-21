'use strict';

/* ── Inventory Control — Prep Batches ─────────────────────────────────────────
   Made-in-house ingredients (frozen margarita mix, simple syrup, marinara,
   stocks). Reference data, just like Products / Locations / Vendors — built
   once, then consumed by menu item recipes.

   Stored in App.inventoryData.ic_prep_batches per Rule 21 (Control data lives
   in ic_data). Each batch carries: name, category, batch_yield + unit,
   serving_size + unit, computed servings_per_batch, ingredient list (products
   only), and computed total_cost + cost_per_serving.

   Landing = an inline Add-a-Batch form (header fields + the ing-tbl ingredient
   builder, styled like the Void/Comp + Waste logs) over the batch list. Edit
   opens the same form in a POP-UP. Both the inline form and the pop-up use the
   same field ids, so every form lookup is scoped to the active form root
   (this._scope) to avoid collisions. */

S.PrepBatches = {
  editId: null,
  rows: [],
  _saving: false,
  // Handle on the background cost resync fired by renderList. saveBatch / deleteBatch await it so
  // their write is always the LATER one — otherwise the resync's pre-edit payload lands on top.
  _resyncPromise: null,
  _scope: null,           // the active form root (this.container or the edit modal)
  _editingIncomplete: false,

  // Scoped DOM lookups so the inline add form and the edit pop-up (same ids)
  // never collide. Falls back to document if no scope is set.
  _el(id)  { return (this._scope || document).querySelector('#' + id); },
  _els(sel){ return (this._scope || document).querySelectorAll(sel); },

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

  CATEGORIES: ['Cocktail Mix', 'Syrup', 'Infusion', 'Non-Alcoholic Mix', 'Sauce', 'Marinade', 'Stock', 'Dressing', 'Spice Blend / Rub', 'Brine / Pickle', 'Compound Butter', 'Batter / Breading', 'Other'],

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
    'Cocktail Mix':      'bar',
    'Syrup':             'bar',
    'Infusion':          'all',   // spirit base + a fruit/herb/pepper that lives in Food
    'Non-Alcoholic Mix': 'food',  // juices/syrups (Misc) + fruit/tea/sugar (Food), no liquor
    'Sauce':             'food',
    'Marinade':          'food',
    'Stock':             'food',
    'Dressing':          'food',
    'Spice Blend / Rub': 'food',
    'Brine / Pickle':    'food',
    'Compound Butter':   'food',
    'Batter / Breading': 'food',
    'Other':             'all'
  },
  modeForBatchCategory(cat) { return this.BATCH_CAT_TO_MODE[cat] || 'all'; },

  products() { return (App.inventoryData && App.inventoryData.ic_products) || []; },
  prodById(id) { return this.products().find(p => p.id === id) || null; },
  // ⚠ Inactive products are kept OUT of the picker on purpose — a discontinued product should not
  // be addable to a new row. But the one ALREADY on this row has to stay selectable, or a recipe
  // that still costs perfectly well renders as "Select ingredient..." and the operator re-picks or
  // deletes a good ingredient by hand. (Kyle found this on Frozen Margarita Mix: a blank picker on
  // a row still costing 32 oz x $0.96 = $30.87.) So: current selection always included, labelled.
  prodOpts(selId, mode) {
    const active = this.products().filter(p => p.active !== false);
    const cur = selId ? this.products().find(p => p && p.id === selId) : null;
    const all = (cur && cur.active === false) ? active.concat([cur]) : active;
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
        h += '<option value="' + p.id + '"' + (p.id === selId ? ' selected' : '') + '>' + esc(p.name)
          + (p.active === false ? ' (inactive)' : '') + '</option>';
      });
      h += '</optgroup>';
    });
    return h;
  },
  // A batch ingredient is measured the same way a recipe measures it, through the
  // shared engine: liquids by the OUNCE, countable solids by the SERVING, so the
  // Unit column shows the real unit (oz / slice / lb) and the cost matches what
  // the Menu Builder would compute for the same ingredient.
  unitCost(prod) {
    if (!prod) return 0;
    return App.recipeBasis ? (App.recipeBasis(prod).costPerUnit || 0) : (prod.unit_cost || 0);
  },
  unitLabel(prod) {
    if (!prod) return '-';
    return App.recipeBasis ? App.recipeBasis(prod).unitLabel : 'units';
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
      { h: 'Ingredients', p: ['Add each product that goes into the batch and how much. The batch category sets which products you can pick: a Cocktail Mix or Syrup pulls bar ingredients, a Sauce or Stock pulls kitchen ingredients. Switch the category after you have added ingredients and any that do not fit the new side drop off, so you are never costing a sauce with a bottle of tequila. Line costs use each product\'s current cost, so when an ingredient price changes the batch cost updates on its own. As you build, the Total Ingredient Cost and Cost Per Serving at the bottom move live so you see what the batch runs before you save. Bar Cop keeps a half-built batch if you leave the screen and come back; Start Over clears the form and drops it when you want a clean slate.'] },
      { h: 'Editing A Batch', p: ['Hit Edit on any batch in the list and the same form opens in a pop-up over the page. Change the name, yield, serving size, or ingredients, then Update Batch. Every menu item that uses the batch picks up the new Cost Per Serving on its own.'] },
      { h: 'Where It Flows', p: ['A batch\'s Cost Per Serving feeds straight into any menu item recipe that uses it, so your recipe and menu costs stay honest without re-entering anything.'] }
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

  // The form body (header fields + ingredient builder + live cost), shared by the
  // inline add card and the edit pop-up. b = the batch being edited (null = add).
  formBodyHTML(b, inline) {
    const catOpts = this.CATEGORIES.map(c => '<option' + (b?.category === c ? ' selected' : '') + '>' + c + '</option>').join('');
    // On the on-page (inline) form, Batch Yield + Serving Size are fixed-width so
    // they do not stretch across the form; the edit pop-up keeps its original layout.
    const yw = inline ? 'flex:0 0 175px;' : 'flex:1 1 130px;min-width:0;';
    const catBlank = inline ? 'Select category...' : 'Select...';
    return '<div class="form-row" style="gap:12px;margin-bottom:14px;flex-wrap:wrap;align-items:flex-end;">'
        + '<div class="f" style="flex:1 1 130px;min-width:0;"><label>Batch Name</label>'
          + '<input type="text" id="pb-name" value="' + esc(b?.name || '') + '" placeholder="Frozen Margarita Mix"/></div>'
        + '<div class="f" style="flex:1 1 130px;min-width:0;"><label>Category' + App.manageListLink('prep_category') + '</label>'
          + App.customSelect({ id: 'pb-cat', key: 'prep_category', builtin: this.CATEGORIES, selected: (b ? b.category : ''), blank: true, blankLabel: catBlank }) + '</div>'
        + '<div class="f" style="' + yw + '"><label>Batch Yield</label>'
          + '<div class="fj"><input type="number" id="pb-yield" value="' + (b?.batch_yield || '') + '" placeholder="1"/><select id="pb-yield-unit">' + this.yOpts(b?.batch_yield_unit) + '</select></div></div>'
        + '<div class="f" style="' + yw + '"><label>Serving Size</label>'
          + '<div class="fj"><input type="number" id="pb-serv" value="' + (b?.serving_size || '') + '" placeholder="5"/><select id="pb-serv-unit">' + this.yOpts(b?.serving_size_unit) + '</select></div></div>'
      + '</div>'
      + '<div id="pb-ings" style="margin-top:14px;margin-bottom:12px;"></div>'
      + '<button class="btn btn-ghost btn-sm" id="pb-add-ing" type="button" style="margin-bottom:14px;">+ Add Ingredient</button>'
      // Servings Per Batch is a derived number, so it lives in the stat box with
      // the other auto-calculated figures, not as a cell in the input row.
      + '<div style="background:var(--input);border:1px solid var(--b-edge);border-radius:8px;padding:14px 18px;">'
      + '<div style="display:flex;gap:32px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Servings Per Batch</div><div class="calc-val" id="pb-spb">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Ingredient Cost</div><div class="calc-val" id="pb-tc">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Cost Per Serving</div><div class="calc-val" id="pb-cps">-</div></div>'
      + '</div></div>';
  },

  // Inline add card (collapsible) on the landing.
  addFormCard() {
    return '<div class="card form-card">'
      + App.collapsibleCardTitle('ic-prep-batches', 'Add a Prep Batch')
      + '<div class="collapse-body">'
      + this.formBodyHTML(null, true)
      + '</div></div>'
      + '<div class="no-print" data-collapse-group="ic-prep-batches" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary" id="pb-save">Save Batch</button>'
        + '<button class="btn btn-ghost" id="pb-cancel">Start Over</button>'
        + '<span id="pb-err" style="color:var(--red);font-size:12px;display:none;"></span>'
      + '</div>';
  },

  // Landing: the add form on top, the batch list below.
  // Keep stored batch costs in sync with current product costs so the list, and any menu item
  // that rolls up cost_per_serving, never show a stale number after an ingredient's price moved.
  //
  // ⚠ WRITE FIRST, APPLY TO MEMORY ONLY ON SUCCESS. Two earlier shapes were both wrong:
  //   • The shipped one mutated memory, fired the write and DISCARDED the result. putRecordsBulk
  //     does NOT revert (only single-row putRecord does), so a failed write left memory holding
  //     the corrected cost while the server kept the stale one — and the drift check then compared
  //     memory against the same computed value and PASSED, so it never retried. The correction
  //     vanished on reload while the list had been showing a figure the server did not have.
  //   • Mutate-then-roll-back was no better: renderList is SYNCHRONOUS and does not await this, so
  //     the table is built from the mutated objects and the rollback lands after, with nothing
  //     re-rendering. The list would show the corrected cost while `ic_prep_batches` held the old
  //     one — and App.menuItemCost / explodeMenuItem read `cost_per_serving` off that same live
  //     array, so Menu Items and Recipe Cost Analysis would quote a different number than the
  //     batch list, in the same session.
  // So: compute into a DETACHED payload, write that, and only touch memory once the server has it.
  // Memory therefore always equals the server, and the screen always equals memory. On failure
  // nothing moved anywhere and the next render retries by itself.
  //
  // The re-render is deliberately on SUCCESS only, which is also why it cannot loop: by then the
  // drift is resolved, so the re-entry finds nothing to write and returns immediately. Re-rendering
  // on FAILURE would loop forever (stale -> drift -> write -> fail -> render -> stale).
  //
  // `quiet` because this fires from a RENDER, not from anything the operator did — an unattended
  // write must never pop a failure toast over a page they merely opened.
  // Ingredient product_ids on this batch that no longer exist in ic_products. Deleting a product
  // does NOT cascade into prep-batch recipes (ic-product-setup confirmDel removes the product row
  // and nothing else), so the reference just dangles.
  // Ingredients still on file but marked INACTIVE. Deliberately separate from missingIngredients:
  // a deleted product means the cost is UNKNOWN (load-bearing, blocks the resync), an inactive one
  // means the cost is KNOWN and correct and only the operational picture changed. So this changes
  // no math — it is a note, not an alarm.
  inactiveIngredients(b) {
    return (((b && b.ingredients) || [])
      .map(i => (i && i.product_id) ? this.prodById(i.product_id) : null)
      .filter(p => p && p.active === false));
  },

  missingIngredients(b) {
    return (((b && b.ingredients) || [])
      .filter(i => i && i.product_id && !this.prodById(i.product_id))
      .map(i => i.product_id));
  },

  async _resyncCosts(batches) {
    const pending = [];
    (batches || []).forEach(b => {
      // ⚠ A DELETED ingredient is not a free one. unitCost(null) is 0, so resyncing a batch whose
      // product has been deleted recomputes it CHEAPER and — from a render — writes that to the
      // server. App.menuItemCost reads cost_per_serving off the batch, so every menu item built on
      // it silently under-costs and the margin reads better than it is. Leave the stored cost
      // alone and flag the batch instead; the operator decides.
      if (this.missingIngredients(b).length) return;
      const ings = (b.ingredients || []).map(i => {
        const cpu = this.unitCost(this.prodById(i.product_id));
        return { ...i, cost_per_unit: cpu, total_cost: (cpu || 0) * (i.quantity || 0) };
      });
      const out = this.computeRows(ings.map(i => ({ cost_per_unit: i.cost_per_unit, quantity: i.quantity || 0 })),
        b.batch_yield, b.batch_yield_unit, b.serving_size, b.serving_size_unit);
      if (Math.abs((b.total_cost || 0) - (out.total_cost || 0)) > 0.005
          || Math.abs((b.cost_per_serving || 0) - (out.cost_per_serving || 0)) > 0.005) {
        pending.push({ b, ings, total_cost: out.total_cost, cost_per_serving: out.cost_per_serving, servings_per_batch: out.servings_per_batch });
      }
    });
    if (!pending.length) return true;
    // Row-per-record: persist only the batches whose cost drifted (one bulk upsert). The payload is
    // a COPY — putRecordsBulk writes what it is handed and never touches the in-memory list.
    const payload = pending.map(p => ({ ...p.b, ingredients: p.ings, total_cost: p.total_cost, cost_per_serving: p.cost_per_serving, servings_per_batch: p.servings_per_batch }));
    const ok = await App.putRecordsBulk('ic', 'prep_batch', payload, { quiet: true });
    if (!ok) return false;   // memory never diverged; the next render tries again
    pending.forEach(p => {
      p.b.total_cost = p.total_cost;
      p.b.cost_per_serving = p.cost_per_serving;
      p.b.servings_per_batch = p.servings_per_batch;
      p.b.ingredients = p.ings;
    });
    // Only if this screen is still on the page — the operator may have navigated away while the
    // write was in flight, and re-rendering into a detached container would do nothing useful.
    if (this.container && this.container.isConnected !== false) this.renderList();
    return true;
  },

  renderList() {
    this.actions.innerHTML = '';
    this.editId = null;
    this._editingIncomplete = false;
    // Keep a half-built batch (header fields + ingredient rows) alive across
    // leaving the screen and coming back; only Save or Start Over clears it.
    if (this._draftRows) this.rows = this._draftRows.map(r => ({ ...r }));
    else this.initRows(null);

    // Name-sorted, matching the ingredient picker in this same file. Unsorted, this list
    // inherited row order (newest-first) and rendered upside-down.
    const batches = this.list().slice()
      .sort((a, b) => String((a && a.name) || '').localeCompare(String((b && b.name) || '')));

    // Reported explicitly rather than left to the global unhandledrejection handler, so a
    // repeatedly-failing resync is identifiable in the digest instead of anonymous. Deliberately
    // does NOT take over the screen — see App.init's stated rejection policy: a false alarm on a
    // non-fatal rejection trains people to ignore the real ones. Nothing was mutated (memory is
    // only touched after a confirmed write), so the list simply renders the last good costs.
    // The handle is kept so saveBatch / deleteBatch can wait for it. Its payload was built from
    // what was on screen BEFORE the operator touched anything, so if it landed after their write
    // it would upsert the pre-edit values over the change, or resurrect a batch they just deleted.
    this._resyncPromise = this._resyncCosts(batches).catch(e => {
      try { DB.logClientError('prep_batch_resync', (e && e.message) || String(e), (e && e.stack) || '', 'ic-prep-batches'); } catch (e2) {}
    });

    let listSection;
    if (!batches.length) {
      listSection = '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
        + '<th>Batch</th><th>Category</th><th>Yield</th><th>Servings</th><th>Total Cost</th><th>Cost / Serving</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="7" style="color:var(--t3);">No prep batches yet. Build one above and it shows here.</td></tr></tbody></table></div>';
    } else {
      const rows = batches.map(b =>
        '<tr>'
        + '<td><div class="val">' + esc(b.name)
        // The cost below is deliberately NOT recalculated while an ingredient is missing, so say so
        // rather than showing a stale figure with no explanation.
        + (this.missingIngredients(b).length
            ? ' <span style="font-size:9px;font-weight:700;letter-spacing:.5px;color:var(--amber);">INGREDIENT DELETED</span>'
              + '<div style="font-size:10px;color:var(--t3);">Cost is held at its last good value. Edit the batch to replace or remove the missing product.</div>'
            // Inactive is NOT an alarm: the cost below is correct. Grey note, no badge, no colour —
            // it tells the operator this batch leans on something they have stopped stocking.
            : (this.inactiveIngredients(b).length
                ? '<div style="font-size:10px;color:var(--t3);">Uses ' + this.inactiveIngredients(b).length
                  + ' inactive product' + (this.inactiveIngredients(b).length === 1 ? '' : 's') + ': '
                  + this.inactiveIngredients(b).map(p => esc(p.name)).join(', ') + '</div>'
                : '')) + '</div></td>'
        + '<td>' + esc(b.category || '-') + '</td>'
        + '<td>' + (b.batch_yield || '-') + ' ' + esc(b.batch_yield_unit || '') + '</td>'
        + '<td>' + (b.servings_per_batch ? b.servings_per_batch.toFixed(1) + ' servings' : '-') + '</td>'
        + '<td>' + App.fmtCurrency(b.total_cost || 0) + '</td>'
        + '<td>' + App.fmtCurrency(b.cost_per_serving || 0) + '</td>'
        + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm pb-edit" data-id="' + b.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm pb-del" data-id="' + b.id + '">Delete</button>'
        + '</div></td></tr>').join('');
      listSection = '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
          + '<th>Batch</th><th>Category</th><th>Yield</th><th>Servings</th><th>Total Cost</th><th>Cost / Serving</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">' + this.addFormCard() + listSection + '</div>';
    this._scope = this.container;
    if (this._draft) App.restoreDraft(this.container, this._draft);
    this.renderRows();
    this._restoring = true;
    this.calc();
    this._restoring = false;
    this._wireForm(this.container);
    App.applyCollapsed(this.container);
  },

  // ── Edit pop-up (same form, in a modal) ─────────────────────────────────────
  openEditModal(id) {
    const b = this.byId(id);
    if (!b) { this.renderList(); return; }
    this.editId = id;
    // Field-missing highlights fire ONLY when editing an incomplete batch.
    this._editingIncomplete = !!(b && this.missingFields(b).size > 0);
    this.initRows(b);
    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">Editing ' + esc(b.name || 'Batch') + '</div>'
      + this.formBodyHTML(b)
      + '<div class="card-actions" style="align-items:center;">'
        + '<button class="btn btn-primary" id="pb-save">Update Batch</button>'
        + '<span id="pb-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    const overlay = App.openModal(html, { id: 'pb-edit-modal', maxWidth: 660, onClose: () => this.closeEdit() });
    this._scope = overlay;
    this.renderRows();
    this.calc();
    this._wireForm(overlay);
    if (this._editingIncomplete) this.applyMissingFieldHighlights();
  },

  closeEdit() { this.editId = null; App.closeModal('pb-edit-modal'); this.renderList(); },

  // Shared form wiring. Bound to a root (this.container for the inline form, the
  // modal overlay for the edit pop-up). Each handler stamps this._scope = root so
  // every form lookup hits the right copy. The list Edit/Delete checks are inert
  // inside the modal (no list there).
  _wireForm(root) {
    App.wireCustomSelects(root);
    root.onclick = ev => {
      this._scope = root;
      const head = ev.target.closest('.card-collapse-head');
      if (head) { App.toggleCollapse(head); return; }
      if (ev.target.closest('#pb-save'))    { this.saveBatch(); return; }
      if (ev.target.closest('#pb-cancel'))  { if (root === this.container) { this._draft = null; this._draftRows = null; this.renderList(); } else this.closeEdit(); return; }
      if (ev.target.closest('#pb-add-ing')) { this.addRow(); return; }
      const rm = ev.target.closest('.pb-rm-ing'); if (rm) { this.removeRow(parseInt(rm.dataset.i)); return; }
      const ed = ev.target.closest('.pb-edit'); if (ed) { this.openEditModal(ed.dataset.id); return; }
      const dl = ev.target.closest('.pb-del'); if (dl) { this.deleteBatch(dl.dataset.id); return; }
    };
    root.onchange = ev => {
      this._scope = root;
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
      if (ev.target.id === 'pb-name') { this.refreshFieldMissing(); this._syncDraft(); }
    };
    root.oninput = ev => {
      this._scope = root;
      if (ev.target.classList.contains('pb-ing-qty')) this.calc();
      if (['pb-yield', 'pb-serv'].includes(ev.target.id)) this.calc();
      if (ev.target.id === 'pb-name') { this.refreshFieldMissing(); this._syncDraft(); }
    };
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
    if (!this._editingIncomplete) return;
    const b = this.byId(this.editId);
    if (!b) return;
    const missing = this.missingFields(b);
    missing.forEach(id => {
      const el = this._el(id);
      if (!el) return;
      const wrap = el.closest('.f');
      if (wrap) wrap.classList.add('field-missing');
    });
  },
  refreshFieldMissing() {
    if (!this._editingIncomplete) return;
    const synthetic = {
      name:     this._el('pb-name')?.value.trim() || '',
      category: this._el('pb-cat')?.value || ''
    };
    const missing = this.missingFields(synthetic);
    ['pb-name', 'pb-cat'].forEach(id => {
      const el = this._el(id);
      if (!el) return;
      const wrap = el.closest('.f');
      if (!wrap) return;
      if (missing.has(id)) wrap.classList.add('field-missing');
      else wrap.classList.remove('field-missing');
    });
  },

  // Ingredient builder — the ing-tbl line table, styled like the Void/Comp and
  // Waste logs (each line a .pb-line row with the data-row fill).
  renderRows() {
    const area = this._el('pb-ings');
    if (!area) return;
    const currentCat = this._el('pb-cat')?.value || '';
    const mode = this.modeForBatchCategory(currentCat);
    // Table goes full width; the ingredient dropdown is a fixed (less wide) column
    // and the empty last column absorbs the slack so Delete stays right-aligned.
    // On the page the builder uses .pill-wrap (container query stacks it in the
    // tablet zone); inside the edit modal a plain overflow wrapper keeps it a table
    // on desktop (a real phone still stacks it via the global .ing-tbl media query).
    const inModal = !!area.closest('#pb-edit-modal');
    area.innerHTML = (inModal ? '<div style="overflow-x:auto;margin-bottom:12px;">' : '<div class="pill-wrap" style="margin-bottom:12px;">')
      + '<table class="ing-tbl pill" style="table-layout:fixed;"><thead><tr>'
      + '<th style="width:' + (inModal ? 190 : 290) + 'px;">Ingredient</th><th style="width:65px;">Qty</th><th style="width:55px;">Unit</th>'
      + '<th style="width:85px;">Unit Cost</th><th style="width:85px;">Line Cost</th><th></th>'
      + '</tr></thead><tbody>' + this.rows.map((ing, idx) => {
        const prod = ing.product_id ? this.prodById(ing.product_id) : null;
        const unit = this.unitLabel(prod);
        const cost = this.unitCost(prod);
        const costD = cost > 0 ? App.fmtCurrency(cost) : (prod ? '<span style="color:var(--red);font-size:10px;">Add cost</span>' : '-');
        const lineD = ing.total_cost > 0 ? App.fmtCurrency(ing.total_cost) : '-';
        return '<tr class="pb-line"><td><select class="form-input pb-ing-prod" data-i="' + idx + '" style="width:100%;">' + this.prodOpts(ing.product_id, mode) + '</select></td>'
          + '<td><input class="form-input pb-ing-qty" type="number" data-i="' + idx + '" value="' + (ing.quantity || '') + '" min="0" step="0.25" style="width:100%;"/></td>'
          + '<td style="color:var(--t2);font-size:12px;">' + unit + '</td>'
          + '<td style="font-size:12px;">' + costD + '</td>'
          + '<td class="val" id="pb-lc-' + idx + '">' + lineD + '</td>'
          + '<td style="text-align:right;"><button class="btn btn-danger btn-sm pb-rm-ing" type="button" data-i="' + idx + '">Delete</button></td></tr>';
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
  addRow() { this.rows.push({ product_id: '', quantity: '', cost_per_unit: 0, total_cost: 0 }); this.renderRows(); this._syncDraft(); },
  removeRow(idx) {
    if (this.rows.length <= 1) this.rows = [{ product_id: '', quantity: '', cost_per_unit: 0, total_cost: 0 }];
    else this.rows.splice(idx, 1);
    this.renderRows();
    this.calc();
  },

  calc() {
    this._els('.pb-ing-qty').forEach(el => {
      const idx = parseInt(el.dataset.i);
      if (!this.rows[idx]) return;
      const qty = parseFloat(el.value) || 0;
      this.rows[idx].quantity = qty;
      this.rows[idx].total_cost = qty * (this.rows[idx].cost_per_unit || 0);
      const le = this._el('pb-lc-' + idx);
      if (le) le.textContent = this.rows[idx].total_cost > 0 ? App.fmtCurrency(this.rows[idx].total_cost) : '-';
    });
    const by = parseFloat(this._el('pb-yield')?.value) || 0;
    const bu = this._el('pb-yield-unit')?.value || 'oz';
    const ss = parseFloat(this._el('pb-serv')?.value) || 0;
    const su = this._el('pb-serv-unit')?.value || 'oz';
    const out = this.computeRows(this.rows, by, bu, ss, su);
    const set = (id, val) => { const el = this._el(id); if (el) el.textContent = val; };
    set('pb-spb', out.servings_per_batch != null ? out.servings_per_batch.toFixed(1) + ' servings' : '-');
    set('pb-tc', out.total_cost > 0 ? App.fmtCurrency(out.total_cost) : '-');
    set('pb-cps', out.cost_per_serving > 0 ? App.fmtCurrency(out.cost_per_serving) : '-');
    this._syncDraft();
  },

  // Snapshot the inline add form (header fields + ingredient rows) so a half-built
  // batch survives leaving the screen and coming back. Only the inline form; the
  // edit pop-up (this._scope = the modal) is left untouched.
  _syncDraft() {
    if (this._restoring || this._scope !== this.container) return;
    this._draft = App.captureDraft(this.container);
    this._draftRows = this.rows.map(r => ({ ...r }));
  },

  async saveBatch() {
    if (this._saving) return;
    this._saving = true;
    setTimeout(() => { this._saving = false; }, 1000);
    const wasAdd = !this.editId;

    const name = this._el('pb-name')?.value.trim();
    const err = this._el('pb-err');
    if (!name) { if (err) { err.textContent = 'Batch name required.'; err.style.display = 'inline'; } return; }

    this._els('.pb-ing-qty').forEach(el => {
      const idx = parseInt(el.dataset.i);
      if (this.rows[idx]) {
        this.rows[idx].quantity = parseFloat(el.value) || 0;
        this.rows[idx].total_cost = this.rows[idx].quantity * (this.rows[idx].cost_per_unit || 0);
      }
    });

    const by = parseFloat(this._el('pb-yield')?.value) || 0;
    const bu = this._el('pb-yield-unit')?.value || 'oz';
    const ss = parseFloat(this._el('pb-serv')?.value) || 0;
    const su = this._el('pb-serv-unit')?.value || 'oz';
    const out = this.computeRows(this.rows, by, bu, ss, su);

    const rec = {
      id: this.editId || App.uid(),
      name,
      category: this._el('pb-cat')?.value || '',
      batch_yield: by, batch_yield_unit: bu,
      serving_size: ss, serving_size_unit: su,
      ingredients: this.rows.filter(r => r.product_id && r.quantity > 0).map(r => ({ product_id: r.product_id, quantity: r.quantity })),
      servings_per_batch: out.servings_per_batch,
      total_cost: out.total_cost,
      cost_per_serving: out.cost_per_serving,
      updated_at: new Date().toISOString(),
      created_at: this.editId ? (this.byId(this.editId)?.created_at || new Date().toISOString()) : new Date().toISOString()
    };

    // A background cost resync may still be in flight from the render that got us here, carrying a
    // payload built before this edit. Let it land first so THIS write is the later one; otherwise
    // it upserts the pre-edit values straight over the operator's change.
    try { await this._resyncPromise; } catch (e) {}
    // Row-per-record: putRecord updates the in-memory list (replace by id / push) and writes one row.
    await App.putRecord('ic', 'prep_batch', rec);
    this.editId = null;
    if (wasAdd) { this._draft = null; this._draftRows = null; }
    App.closeModal('pb-edit-modal');
    this.renderList();
  },

  async deleteBatch(id) {
    const b = this.byId(id);
    if (!b) return;
    const ok = await App.confirmDelete();
    if (!ok) return;
    // Same as saveBatch: an in-flight resync upserting this batch after the delete would bring it
    // straight back. Wait for it, then delete.
    try { await this._resyncPromise; } catch (e) {}
    await App.removeRecord('ic', 'prep_batch', id);   // row-per-record
    this.renderList();
  }
};
