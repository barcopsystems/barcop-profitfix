'use strict';

/* ── Inventory Control — Adjustment Log (writes ic_adjustments) ───────────────
   Captures every documented inventory adjustment — damaged in storage, theft
   confirmed, expired, found later, or other one-off corrections — so the
   operator can reconcile counts to physical reality without destroying the
   count history.

   Reason codes drive intent:
     - Damage     (decrease)
     - Theft      (decrease, also feeds Theft Risk)
     - Expiration (decrease)
     - Found      (increase — discovered stock not previously counted)
     - Other      (operator picks direction)

   Each record: { id, date_time, product_id, product_name, category, quantity,
   unit, direction:'in'|'out', reason, unit_cost_at_adjustment, value,
   performed_by_id, performed_by, witnessed_by_id, witnessed_by, notes,
   created_at }. Variance math does NOT auto-subtract these — the report
   surfaces them separately so the operator sees the attribution. */

S.InventoryAdjustments = {
  editId: null,
  filterFrom: '',
  filterTo: '',
  filterProductId: '',
  filterReason: '',

  REASONS: ['Damage', 'Theft', 'Expiration', 'Found', 'Other'],
  // Default direction per reason — operator can override on Other.
  _dirFor(reason) {
    if (reason === 'Found') return 'in';
    return 'out';
  },

  adjustments() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_adjustments)) App.inventoryData.ic_adjustments = [];
    return App.inventoryData.ic_adjustments;
  },
  products() {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
  },
  productById(id) {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
  },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  fmtDateTime(str) {
    if (!str) return '-';
    const d = new Date(str);
    if (isNaN(d.getTime())) return esc(str);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  },
  nowDateTime() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  // ── List ────────────────────────────────────────────────────────────
  renderList() {
    this.editId = null;
    this.actions.innerHTML = '';

    if (this.products().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Set up products first</div>'
        + '<div class="empty-sub">An adjustment writes off or finds a documented quantity of a real product. Add products under Setup, then log adjustments here.</div>'
        + '<button class="btn btn-primary" id="adj-go-products">Add Products</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#adj-go-products')) App.navigate('ic-product-setup'); };
      return;
    }

    const all = this.adjustments();
    const filtered = this.applyFilters(all);
    filtered.sort((a, b) => new Date(b.date_time || b.created_at || 0).getTime() - new Date(a.date_time || a.created_at || 0).getTime());

    let listHtml = this.filterCard();
    if (all.length === 0) {
      listHtml += '<div class="empty"><div class="empty-title">No adjustments logged yet</div>'
        + '<div class="empty-sub">When you find damaged stock, confirm theft, expire product, or discover missing inventory, log it here. Counts stay clean, the loss gets attributed to a real cause, and the bookkeeper has a proper shrinkage trail.</div></div>';
    } else if (filtered.length === 0) {
      listHtml += '<div class="empty"><div class="empty-title">No adjustments match the filters</div>'
        + '<div class="empty-sub">Adjust or clear the filters above.</div></div>';
    } else {
      const rows = filtered.slice(0, 200).map(r => {
        const dirText = r.direction === 'in'
          ? '<span style="color:var(--green);font-weight:600;">Found</span>'
          : '<span style="color:var(--red);font-weight:600;">Loss</span>';
        const valStr = r.direction === 'in'
          ? '<span class="pos">+' + App.fmtCurrency(Math.abs(r.value || 0)) + '</span>'
          : '<span class="neg">-' + App.fmtCurrency(Math.abs(r.value || 0)) + '</span>';
        return '<tr class="adj-row" data-id="' + r.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDateTime(r.date_time) + '</div></td>'
          + '<td><div class="val">' + esc(r.product_name || '-') + '</div>'
          + (r.category ? '<div style="font-size:10px;color:var(--t3);">' + esc(r.category) + '</div>' : '') + '</td>'
          + '<td>' + (r.quantity != null ? r.quantity : '-') + ' ' + esc(r.unit || '') + '</td>'
          + '<td>' + esc(r.reason || '-') + ' ' + dirText + '</td>'
          + '<td class="val">' + valStr + '</td>'
          + '<td>' + esc(r.performed_by || '-') + '</td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('ic-adjustments') ? '<button class="btn btn-ghost btn-sm adj-edit" data-id="' + r.id + '">Edit</button>' : '')
          + (App.canEdit('ic-adjustments') ? '<button class="btn btn-danger btn-sm adj-del" data-id="' + r.id + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');
      listHtml += '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>When</th><th>Product</th><th>Quantity</th><th>Reason</th><th>Value</th><th>By</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">' + this.logFormCard() + listHtml + '</div>';
    this.wireList();
    this.wireForm();
  },

  showHowTo() {
    App.showHelpModal('How the Adjustment Log Works', [
      { p: ['An adjustment documents stock that left or came back into inventory outside of a normal sale, like product damaged in storage, theft you confirmed, product that expired, or stock you found that was never counted. It keeps your counts clean while attributing the loss to a real cause.'] },
      { h: 'Logging An Adjustment', p: ['Set the date and time, pick the reason, and confirm the direction: Loss for product that left, Found for stock that came back. Pick the product, the quantity, and the unit. Bar Cop estimates the dollar value from the product cost as you go.'] },
      { h: 'Reasons And Direction', p: ['Damage, Theft, and Expiration default to a Loss. Found defaults to an increase. Other lets you set the direction yourself.'] },
      { h: 'It Does Not Touch Your Counts', p: ['Logging an adjustment does not change your last count or auto-subtract from variance. The Variance Report surfaces adjustments separately so you can see real shrinkage versus a documented cause. Your bookkeeper gets a clean shrinkage trail.'] },
      { h: 'Filtering And History', p: ['Every adjustment drops into the list below. Filter by date range, product, or reason, and edit or delete any entry to fix a mistake.'] }
    ]);
  },

  // The Log an Adjustment form lives at the top of the landing page, always open.
  logFormCard() {
    return '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Log an Adjustment</span>'
      + '<button class="btn btn-ghost btn-sm" id="adj-how">How This Works</button></div>'
      + this.formRows(null)
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="adj-save">Log Adjustment</button>'
        + '<span id="adj-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
  },

  // Shared two-row field layout for both the inline log form and the edit page.
  // Row 1: Date/Time, Product, Quantity, Unit. Row 2: Reason, Direction,
  // Performed By, Witnessed By. The Estimated Value / Unit Cost tile and Notes
  // follow. Pass the record for edit, or null for a new log.
  formRows(r) {
    const v = val => (val != null && val !== '') ? val : '';
    const initialProdId = r?.product_id || '';
    const initialCat = initialProdId ? (this.productById(initialProdId)?.category || '') : '';
    const initialUnit = r?.unit || (initialCat === 'Bottle Beer' ? 'cases' : initialCat === 'Draft Beer' ? 'kegs' : 'bottles');
    const initialReason = r?.reason || 'Damage';
    const initialDir = r?.direction || this._dirFor(initialReason);
    const reasonOpts = this.REASONS.map(rs =>
      '<option' + (rs === initialReason ? ' selected' : '') + '>' + esc(rs) + '</option>').join('');

    return '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:210px;flex-shrink:0;"><label>Date / Time</label>'
          + '<input type="datetime-local" id="adj-when" value="' + esc((r?.date_time || this.nowDateTime()).slice(0, 16)) + '"/></div>'
        + '<div class="f" style="flex:1;min-width:180px;"><label>Product</label>'
          + '<select id="adj-prod">' + this.productOptions(initialProdId) + '</select></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Quantity ' + tt('adj-qty') + '</label>'
          + '<input type="number" id="adj-qty" min="0" step="0.5" value="' + v(r?.quantity) + '" placeholder="0"/></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Unit</label>'
          + '<select id="adj-unit">' + this.unitOptions(initialCat, initialUnit) + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Reason</label>'
          + '<select id="adj-reason">' + reasonOpts + '</select></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>Direction</label>'
          + '<select id="adj-dir">'
            + '<option value="out"' + (initialDir === 'out' ? ' selected' : '') + '>Loss (out)</option>'
            + '<option value="in"'  + (initialDir === 'in'  ? ' selected' : '') + '>Found (in)</option>'
          + '</select></div>'
        + '<div class="f" style="flex:1;min-width:170px;"><label>Performed By</label>'
          + '<select id="adj-by">' + App.staffOptions(r?.performed_by_id || App.activeManagerId(), { placeholder: 'Select staff...' }) + '</select></div>'
        + '<div class="f" style="flex:1;min-width:170px;"><label>Witnessed By <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
          + '<select id="adj-witness">' + App.staffOptions(r?.witnessed_by_id || '', { placeholder: 'Optional' }) + '</select></div>'
      + '</div>'
      + '<div class="calc" style="margin-top:6px;">'
        + '<div class="calc-item"><div class="calc-label">Estimated Value</div><div class="calc-val" id="adj-c-value">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Unit Cost</div><div class="calc-val dim" id="adj-c-unitcost">-</div></div>'
      + '</div>'
      + '<div class="f" style="margin-top:6px;margin-bottom:0;"><label>Notes</label>'
        + '<textarea id="adj-notes" rows="2" placeholder="Optional context. What happened, who was around, anything that helps next year\'s review.">' + esc(r?.notes || '') + '</textarea></div>';
  },

  // Wire the always-open inline log form (How This Works, Save, calc fields).
  wireForm() {
    document.getElementById('adj-how')?.addEventListener('click', () => this.showHowTo());
    document.getElementById('adj-save')?.addEventListener('click', () => this.save());
    this.wireFormFields();
  },

  // Reason → default direction, product → unit options, and live value recalc.
  // Shared by the inline log form and the edit page.
  wireFormFields() {
    document.getElementById('adj-reason')?.addEventListener('change', e => {
      const dirSel = document.getElementById('adj-dir');
      if (dirSel) dirSel.value = this._dirFor(e.target.value);
      this.recalc();
    });
    document.getElementById('adj-prod')?.addEventListener('change', e => {
      const p = this.productById(e.target.value);
      const unitSel = document.getElementById('adj-unit');
      if (unitSel && p) unitSel.innerHTML = this.unitOptions(p.category, p.category === 'Bottle Beer' ? 'cases' : (p.category === 'Draft Beer' ? 'kegs' : 'bottles'));
      this.recalc();
    });
    ['adj-qty', 'adj-unit', 'adj-dir'].forEach(fid =>
      document.getElementById(fid)?.addEventListener('input', () => this.recalc()));
    this.recalc();
  },

  filterCard() {
    const reasonOpts = '<option value="">All reasons</option>'
      + this.REASONS.map(r => '<option value="' + esc(r) + '"' + (this.filterReason === r ? ' selected' : '') + '>' + esc(r) + '</option>').join('');
    const prodOpts = '<option value="">All products</option>'
      + this.products().slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          .map(p => '<option value="' + p.id + '"' + (this.filterProductId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
    return '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Filter</span>'
      + '<button class="btn btn-ghost btn-sm" id="adj-export">Export PDF</button></div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="adj-f-from" value="' + esc(this.filterFrom) + '"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="adj-f-to" value="' + esc(this.filterTo) + '"/></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Product</label><select id="adj-f-prod">' + prodOpts + '</select></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Reason</label><select id="adj-f-reason">' + reasonOpts + '</select></div>'
        + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="adj-f-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div></div>';
  },

  applyFilters(list) {
    return list.filter(r => {
      const date = (r.date_time || '').slice(0, 10);
      if (this.filterFrom && date < this.filterFrom) return false;
      if (this.filterTo && date > this.filterTo) return false;
      if (this.filterProductId && r.product_id !== this.filterProductId) return false;
      if (this.filterReason && r.reason !== this.filterReason) return false;
      return true;
    });
  },

  wireList() {
    this.container.onclick = ev => {
      const row  = ev.target.closest('.adj-row');
      const edit = ev.target.closest('.adj-edit');
      const del  = ev.target.closest('.adj-del');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row && App.canEdit('ic-adjustments')) this.showForm(row.dataset.id);
    };
    document.getElementById('adj-export')?.addEventListener('click', () => window.print());
    document.getElementById('adj-f-from')?.addEventListener('change',   e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('adj-f-to')?.addEventListener('change',     e => { this.filterTo   = e.target.value || ''; this.renderList(); });
    document.getElementById('adj-f-prod')?.addEventListener('change',   e => { this.filterProductId = e.target.value || ''; this.renderList(); });
    document.getElementById('adj-f-reason')?.addEventListener('change', e => { this.filterReason     = e.target.value || ''; this.renderList(); });
    document.getElementById('adj-f-clear')?.addEventListener('click', () => {
      this.filterFrom = this.filterTo = this.filterProductId = this.filterReason = '';
      this.renderList();
    });
  },

  // ── Form ────────────────────────────────────────────────────────────
  productOptions(selectedId) {
    const prods = this.products();
    if (!prods.length) return '<option value="">No products set up</option>';
    const cats = (S.InventoryProducts && S.InventoryProducts.CATEGORIES) || ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
    let h = '<option value="">Select product...</option>';
    cats.forEach(cat => {
      const inCat = prods.filter(p => (p.category || '') === cat).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (!inCat.length) return;
      h += '<optgroup label="' + esc(cat) + '">';
      inCat.forEach(p => {
        h += '<option value="' + p.id + '"' + (p.id === selectedId ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      });
      h += '</optgroup>';
    });
    return h;
  },

  unitOptions(productCategory, selected) {
    let opts = ['bottles', 'units'];
    if (productCategory === 'Bottle Beer') opts = ['cases', 'bottles'];
    else if (productCategory === 'Draft Beer') opts = ['kegs'];
    else if (productCategory === 'Food' || productCategory === 'Misc') opts = ['units', 'each', 'lbs', 'oz'];
    return opts.map(o => '<option' + (o === selected ? ' selected' : '') + '>' + esc(o) + '</option>').join('');
  },

  // Edit page (own screen). Same two-row field layout as the inline log form;
  // Cancel stays here because the operator navigated away to edit.
  showForm(id) {
    if (!App.canEdit('ic-adjustments')) return;
    this.editId = id || null;
    const r = id ? this.adjustments().find(x => x.id === id) : null;

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">Edit Adjustment</div>'
      + this.formRows(r)
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="adj-save">Update Adjustment</button>'
        + '<button class="btn btn-ghost" id="adj-cancel">Cancel</button>'
        + '<span id="adj-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('adj-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('adj-save')?.addEventListener('click', () => this.save());
    this.wireFormFields();
  },

  // Live calc: estimated value = qty × per-unit cost. For Bottle Beer cases we
  // expand to bottles before multiplying so the math matches the rest of IC.
  recalc() {
    const prodId = document.getElementById('adj-prod')?.value;
    const product = this.productById(prodId);
    const qty = parseFloat(document.getElementById('adj-qty')?.value) || 0;
    const unit = document.getElementById('adj-unit')?.value || '';
    const set = (id, txt, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = txt; el.className = 'calc-val' + (cls ? ' ' + cls : ''); };

    if (!product || qty <= 0) {
      set('adj-c-value', '-');
      set('adj-c-unitcost', product ? (product.unit_cost != null ? App.fmtCurrency(product.unit_cost) : '-') : '-', 'dim');
      return;
    }
    // Cost is shown per the chosen unit: per case when writing off cases, per
    // bottle when writing off loose bottles, per container for everything else.
    let perUnitCost, unitLabel;
    if (product.category === 'Bottle Beer' && product.case_size) {
      if (unit === 'cases') { perUnitCost = App.unitCost(product) || 0; unitLabel = '/case'; }
      else { perUnitCost = App.bottleCost(product) || 0; unitLabel = '/bottle'; }
    } else {
      perUnitCost = App.unitCost(product) || 0; unitLabel = '/unit';
    }
    const value = qty * perUnitCost;
    set('adj-c-value', value > 0 ? App.fmtCurrency(value) : '-');
    set('adj-c-unitcost', perUnitCost > 0 ? App.fmtCurrency(perUnitCost) + unitLabel : '-', 'dim');
  },

  async save() {
    const err = document.getElementById('adj-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };

    const dateTime = document.getElementById('adj-when')?.value;
    if (!dateTime) { fail('Date and time are required.'); return; }
    const productId = document.getElementById('adj-prod')?.value;
    if (!productId) { fail('Pick a product.'); return; }
    const product = this.productById(productId);
    if (!product) { fail('Product not found.'); return; }
    const quantity = parseFloat(document.getElementById('adj-qty')?.value);
    if (isNaN(quantity) || quantity <= 0) { fail('Enter a quantity greater than zero.'); return; }
    const reason = document.getElementById('adj-reason')?.value;
    if (!reason) { fail('Pick a reason.'); return; }
    const direction = document.getElementById('adj-dir')?.value || this._dirFor(reason);
    const unit = document.getElementById('adj-unit')?.value || '';
    const performedById = document.getElementById('adj-by')?.value;
    if (!performedById) { fail('Pick who logged the adjustment.'); return; }
    const performedBy = (this.staffById(performedById) || {}).name || '';
    const witnessedById = document.getElementById('adj-witness')?.value || '';
    const witnessedBy   = witnessedById ? ((this.staffById(witnessedById) || {}).name || '') : '';

    // Snapshot the per-unit cost (for the chosen unit) so the value stays honest
    // even after future cost changes.
    let perUnitCost;
    if (product.category === 'Bottle Beer' && product.case_size) {
      perUnitCost = (unit === 'cases') ? (App.unitCost(product) || 0) : (App.bottleCost(product) || 0);
    } else {
      perUnitCost = App.unitCost(product) || 0;
    }
    const value = quantity * perUnitCost;

    const rec = {
      id:                       this.editId || App.uid(),
      date_time:                dateTime,
      product_id:               product.id,
      product_name:             product.name,
      category:                 product.category || '',
      quantity,
      unit,
      direction,
      reason,
      unit_cost_at_adjustment:  perUnitCost,
      value,
      performed_by_id:          performedById,
      performed_by:             performedBy,
      witnessed_by_id:          witnessedById,
      witnessed_by:             witnessedBy,
      notes:                    document.getElementById('adj-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();
    else rec.updated_at = new Date().toISOString();

    const list = this.adjustments();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('adj-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveInventory();
    this.editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Log Adjustment'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const ok = await App.confirm({ title: 'Delete this adjustment entry?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;
    App.inventoryData.ic_adjustments = this.adjustments().filter(x => x.id !== id);
    await App.saveInventory();
    this.renderList();
  }
};
