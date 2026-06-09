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
      App.setupCard(this.container, {
        title: 'Set Up Adjustments',
        lead: 'An adjustment writes off or finds a documented quantity of a real product, so your counts stay clean and every loss has a cause. Add your products first.',
        steps: [
          { title: 'Add your products', desc: 'An adjustment is logged against a real product, so add what you stock first.', btn: 'Add Products', screen: 'ic-product-setup', done: this.products().length > 0 }
        ]
      });
      return;
    }

    const all = this.adjustments();
    if (all.length === 0) {
      this.container.innerHTML = '<div class="screen">' + this.logFormCard()
        + '<div style="font-size:13px;color:var(--t3);padding:14px 2px;">No adjustments logged yet. Use the form above to log the first one.</div></div>';
      this.wireForm('adj-');
      return;
    }

    const filtered = this.applyFilters(all)
      .sort((a, b) => new Date(b.date_time || b.created_at || 0).getTime() - new Date(a.date_time || a.created_at || 0).getTime());

    let totalLoss = 0, totalFound = 0, lastDate = '';
    all.forEach(r => {
      const val = Math.abs(r.value || 0);
      if (r.direction === 'in') totalFound += val; else totalLoss += val;
      const d = r.date_time || r.created_at || '';
      if (!lastDate || new Date(d).getTime() > new Date(lastDate).getTime()) lastDate = d;
    });

    const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Adjustments</div><div class="calc-val lg">' + all.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Loss</div><div class="calc-val lg" style="color:var(--red);">' + App.fmtCurrency(totalLoss) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Found</div><div class="calc-val lg" style="color:var(--green);">' + App.fmtCurrency(totalFound) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Last Entry</div><div class="calc-val lg">' + this.fmtDate((lastDate || '').slice(0, 10)) + '</div></div>'
      + '</div></div>';

    const filterHeading = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Filter Adjustments</div>'
      + '<div style="display:flex;gap:8px;">'
        + '<button class="btn btn-ghost btn-sm" id="adj-export">Export PDF</button>'
        + '<button class="btn btn-ghost btn-sm" id="adj-print-blank">Worksheet</button>'
      + '</div></div>';

    const rows = filtered.slice(0, App.listLimit('ic', 'adjustment')).map(r => {
      const dirText = r.direction === 'in'
        ? '<span style="color:var(--green);font-weight:600;">Found</span>'
        : '<span style="color:var(--red);font-weight:600;">Loss</span>';
      const valStr = r.direction === 'in'
        ? '<span style="color:var(--green);">+' + App.fmtCurrency(Math.abs(r.value || 0)) + '</span>'
        : '<span style="color:var(--red);">-' + App.fmtCurrency(Math.abs(r.value || 0)) + '</span>';
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
    const listCard = '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>When</th><th>Product</th><th>Quantity</th><th>Reason</th><th>Value</th><th>By</th><th></th>'
      + '</tr></thead><tbody>' + (rows || '<tr><td colspan="7" style="color:var(--t3);padding:12px 8px;">No adjustments match the filter.</td></tr>') + '</tbody></table></div></div>'
      + App.showOlderBar('ic', 'adjustment', filtered, !!(this.filterFrom || this.filterTo || this.filterProductId || this.filterReason));

    this.container.innerHTML = '<div class="screen">' + this.logFormCard() + statsCard + filterHeading + this.filterCard() + listCard + '</div>';
    this.wireList();
    this.wireForm('adj-');
  },

  showHowTo() {
    App.showHelpModal('How the Adjustment Log Works', [
      { p: ['An adjustment documents stock that left or came back into inventory outside of a normal sale, like product damaged in storage, theft you confirmed, product that expired, or stock you found that was never counted. It keeps your counts clean while attributing the loss to a real cause. Without it, every broken bottle and dumped keg shows up as mystery shrinkage and looks like theft.'] },
      { h: 'Logging An Adjustment', p: ['Set the date and time, pick the reason, and confirm the direction. Loss for product that left, Found for stock that came back. Pick the product, the quantity, and the unit. Draft is by the keg, bottle beer by the case, liquor and wine by the bottle. Bar Cop estimates the dollar value from the product cost as you go, so you see what the loss actually cost you in real money before you save it.'] },
      { h: 'Reasons And Direction', p: ['Damage, Theft, and Expiration default to a Loss. Found defaults to an increase. Other lets you set the direction yourself. Use the right reason, because a write-off labeled Theft feeds your Theft Risk picture while one labeled Damage does not. Honest reasons keep that signal clean.'] },
      { h: 'A Real Example', p: ['A barback at The Anchor drops a full bottle of Hennessy on the way to the well and it shatters. Log it: reason Damage, direction Loss, product Hennessy, quantity one bottle. Bar Cop prices it off your cost, say a 750ml bottle that runs you about thirty dollars, and books a thirty dollar documented loss. Now when you run variance for the period, that thirty dollars is accounted for and does not get mistaken for product walking out the door.'] },
      { h: 'It Does Not Touch Your Counts', p: ['Logging an adjustment does not change your last count or auto-subtract from variance. The Variance Report surfaces adjustments separately so you can see real shrinkage versus a documented cause. Your bookkeeper gets a clean shrinkage trail they can stand behind at tax time.'] },
      { h: 'Filtering And History', p: ['Every adjustment drops into the list below. Filter by date range, product, or reason, and edit or delete any entry to fix a mistake. The Worksheet button prints a clean grid you can carry into the storeroom during a damage or expiration walk-through, then enter the rows here after.'] }
    ]);
  },

  // The Log an Adjustment form lives at the top of the landing page (collapsible).
  logFormCard() {
    return '<div class="card form-card no-print">'
      + App.collapsibleCardTitle('ic-adjustments', 'Log an Adjustment')
      + '<div class="collapse-body">'
      + this.formRows(null, 'adj-')
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="adj-save">Log Adjustment</button>'
        + '<span id="adj-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';
  },

  // Shared field layout for both the inline log form and the edit popup. `idp`
  // prefixes every field id ('adj-' inline, 'adje-' modal) so the popup never
  // collides with the inline form behind it.
  formRows(r, idp) {
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
          + '<input type="datetime-local" id="' + idp + 'when" value="' + esc((r?.date_time || this.nowDateTime()).slice(0, 16)) + '"/></div>'
        + '<div class="f" style="flex:1;min-width:180px;"><label>Product</label>'
          + '<select id="' + idp + 'prod">' + this.productOptions(initialProdId) + '</select></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Quantity</label>'
          + '<input type="number" id="' + idp + 'qty" min="0" step="0.5" value="' + v(r?.quantity) + '" placeholder="0"/></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Unit</label>'
          + '<select id="' + idp + 'unit">' + this.unitOptions(initialCat, initialUnit) + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Reason</label>'
          + '<select id="' + idp + 'reason">' + reasonOpts + '</select></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>Direction</label>'
          + '<select id="' + idp + 'dir">'
            + '<option value="out"' + (initialDir === 'out' ? ' selected' : '') + '>Loss (out)</option>'
            + '<option value="in"'  + (initialDir === 'in'  ? ' selected' : '') + '>Found (in)</option>'
          + '</select></div>'
        + '<div class="f" style="flex:1;min-width:170px;"><label>Performed By</label>'
          + '<select id="' + idp + 'by">' + App.staffOptions(r?.performed_by_id || App.activeManagerId(), { placeholder: 'Select staff...' }) + '</select></div>'
        + '<div class="f" style="flex:1;min-width:170px;"><label>Witnessed By <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
          + '<select id="' + idp + 'witness">' + App.staffOptions(r?.witnessed_by_id || '', { placeholder: 'Optional' }) + '</select></div>'
      + '</div>'
      + '<div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;margin-top:10px;">'
        + '<div class="calc-item"><div class="calc-label">Estimated Value</div><div class="calc-val" id="' + idp + 'c-value">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Unit Cost</div><div class="calc-val dim" id="' + idp + 'c-unitcost">-</div></div>'
      + '</div>'
      + '<div class="f" style="margin-top:10px;margin-bottom:0;"><label>Notes</label>'
        + '<textarea id="' + idp + 'notes" class="notes-ta" rows="2" placeholder="Optional context. What happened, who was around, anything that helps next year\'s review.">' + esc(r?.notes || '') + '</textarea></div>';
  },

  // Wire the always-open inline log form.
  wireForm(idp) {
    document.getElementById(idp + 'save')?.addEventListener('click', () => this.save(idp, null));
    this.wireFormFields(idp);
    const head = this.container.querySelector('.card-collapse-head');
    if (head) head.addEventListener('click', ev => { if (!ev.target.closest('.btn')) App.toggleCollapse(head); });
    App.applyCollapsed(this.container);
  },

  // Reason → default direction, product → unit options, and live value recalc.
  wireFormFields(idp) {
    document.getElementById(idp + 'reason')?.addEventListener('change', e => {
      const dirSel = document.getElementById(idp + 'dir');
      if (dirSel) dirSel.value = this._dirFor(e.target.value);
      this.recalc(idp);
    });
    document.getElementById(idp + 'prod')?.addEventListener('change', e => {
      const p = this.productById(e.target.value);
      const unitSel = document.getElementById(idp + 'unit');
      if (unitSel && p) unitSel.innerHTML = this.unitOptions(p.category, p.category === 'Bottle Beer' ? 'cases' : (p.category === 'Draft Beer' ? 'kegs' : 'bottles'));
      this.recalc(idp);
    });
    [idp + 'qty', idp + 'unit', idp + 'dir'].forEach(fid =>
      document.getElementById(fid)?.addEventListener('input', () => this.recalc(idp)));
    this.recalc(idp);
  },

  filterCard() {
    const reasonOpts = '<option value="">All reasons</option>'
      + this.REASONS.map(r => '<option value="' + esc(r) + '"' + (this.filterReason === r ? ' selected' : '') + '>' + esc(r) + '</option>').join('');
    const prodOpts = '<option value="">All products</option>'
      + this.products().slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          .map(p => '<option value="' + p.id + '"' + (this.filterProductId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
    return '<div class="card no-print"><div class="form-row" style="align-items:flex-end;margin-bottom:0;flex-wrap:wrap;gap:14px;">'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="adj-f-from" value="' + esc(this.filterFrom) + '"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="adj-f-to" value="' + esc(this.filterTo) + '"/></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Product</label><select id="adj-f-prod">' + prodOpts + '</select></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Reason</label><select id="adj-f-reason">' + reasonOpts + '</select></div>'
        + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="adj-f-clear">Clear</button></div>'
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
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row  = ev.target.closest('.adj-row');
      const edit = ev.target.closest('.adj-edit');
      const del  = ev.target.closest('.adj-del');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.openEdit(edit.dataset.id); }
      else if (row && App.canEdit('ic-adjustments')) this.openEdit(row.dataset.id);
    };
    document.getElementById('adj-export')?.addEventListener('click', () => App.exportPDF({ title: 'Adjustment Log', root: this.container }));
    document.getElementById('adj-print-blank')?.addEventListener('click', () => this.printBlank());
    document.getElementById('adj-f-from')?.addEventListener('change',   e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('adj-f-to')?.addEventListener('change',     e => { this.filterTo   = e.target.value || ''; this.renderList(); });
    document.getElementById('adj-f-prod')?.addEventListener('change',   e => { this.filterProductId = e.target.value || ''; this.renderList(); });
    document.getElementById('adj-f-reason')?.addEventListener('change', e => { this.filterReason     = e.target.value || ''; this.renderList(); });
    document.getElementById('adj-f-clear')?.addEventListener('click', () => {
      this.filterFrom = this.filterTo = this.filterProductId = this.filterReason = '';
      this.renderList();
    });
  },

  // ── Form options ────────────────────────────────────────────────────
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

  // Live calc: estimated value = qty × per-unit cost. For Bottle Beer cases we
  // use the per-case cost; loose bottles use per-bottle.
  recalc(idp) {
    const product = this.productById(document.getElementById(idp + 'prod')?.value);
    const qty = parseFloat(document.getElementById(idp + 'qty')?.value) || 0;
    const unit = document.getElementById(idp + 'unit')?.value || '';
    const set = (id, txt, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = txt; el.className = 'calc-val' + (cls ? ' ' + cls : ''); };

    if (!product || qty <= 0) {
      set(idp + 'c-value', '-');
      set(idp + 'c-unitcost', product ? (product.unit_cost != null ? App.fmtCurrency(product.unit_cost) : '-') : '-', 'dim');
      return;
    }
    let perUnitCost, unitLabel;
    if (product.category === 'Bottle Beer' && product.case_size) {
      if (unit === 'cases') { perUnitCost = App.unitCost(product) || 0; unitLabel = '/case'; }
      else { perUnitCost = App.bottleCost(product) || 0; unitLabel = '/bottle'; }
    } else {
      perUnitCost = App.unitCost(product) || 0; unitLabel = '/unit';
    }
    const value = qty * perUnitCost;
    set(idp + 'c-value', value > 0 ? App.fmtCurrency(value) : '-');
    set(idp + 'c-unitcost', perUnitCost > 0 ? App.fmtCurrency(perUnitCost) + unitLabel : '-', 'dim');
  },

  // ── Edit popup (standard modal) ───────────────────────────────────────
  openEdit(id) {
    if (!App.canEdit('ic-adjustments')) return;
    const r = this.adjustments().find(x => x.id === id);
    if (!r) return;
    this.editId = id;
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Adjustment</div>'
      + this.formRows(r, 'adje-')
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="adje-save">Update Adjustment</button>'
        + '<button class="btn btn-ghost" id="adje-cancel">Cancel</button>'
        + '<span id="adje-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
        + '<button class="btn btn-danger" id="adje-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'adj-edit-modal', maxWidth: 540, noClose: true });
    document.getElementById('adje-save')?.addEventListener('click', () => this.save('adje-', 'adj-edit-modal'));
    document.getElementById('adje-cancel')?.addEventListener('click', () => { this.editId = null; App.closeModal('adj-edit-modal'); });
    document.getElementById('adje-del')?.addEventListener('click', async () => {
      if (!(await App.confirmDelete())) return;
      await App.removeRecord('ic', 'adjustment', id);
      this.editId = null;
      App.closeModal('adj-edit-modal');
      this.renderList();
    });
    this.wireFormFields('adje-');
  },

  async save(idp, modalId) {
    const err = document.getElementById(idp + 'err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };

    const dateTime = document.getElementById(idp + 'when')?.value;
    if (!dateTime) { fail('Date and time are required.'); return; }
    const productId = document.getElementById(idp + 'prod')?.value;
    if (!productId) { fail('Pick a product.'); return; }
    const product = this.productById(productId);
    if (!product) { fail('Product not found.'); return; }
    const quantity = parseFloat(document.getElementById(idp + 'qty')?.value);
    if (isNaN(quantity) || quantity <= 0) { fail('Enter a quantity greater than zero.'); return; }
    const reason = document.getElementById(idp + 'reason')?.value;
    if (!reason) { fail('Pick a reason.'); return; }
    const direction = document.getElementById(idp + 'dir')?.value || this._dirFor(reason);
    const unit = document.getElementById(idp + 'unit')?.value || '';
    const performedById = document.getElementById(idp + 'by')?.value;
    if (!performedById) { fail('Pick who logged the adjustment.'); return; }
    const performedBy = (this.staffById(performedById) || {}).name || '';
    const witnessedById = document.getElementById(idp + 'witness')?.value || '';
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
      notes:                    document.getElementById(idp + 'notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();
    else rec.updated_at = new Date().toISOString();

    let saveRec = rec;
    if (this.editId) {
      const ex = this.adjustments().find(x => x.id === this.editId);
      if (ex) saveRec = { ...ex, ...rec };
    }

    const btn = document.getElementById(idp + 'save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('ic', 'adjustment', saveRec);
    this.editId = null;
    if (ok) {
      if (modalId) App.closeModal(modalId);
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = modalId ? 'Update Adjustment' : 'Log Adjustment'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    await App.removeRecord('ic', 'adjustment', id);
    this.renderList();
  },

  // ── Print blank sheet — for a damage / expiration / found walk-through ────
  printBlank() {
    App.printBlankSheet({
      title: 'Adjustment Log',
      subtitle: 'Document stock written off or found outside of normal sale: damage, theft, expiration, or stock you found that was never counted. Manager enters each row into Bar Cop after the walk-through.',
      columns: [
        { label: 'Date',         width: '12%' },
        { label: 'Product',      width: '26%' },
        { label: 'Qty',          width: '7%' },
        { label: 'Unit',         width: '8%' },
        { label: 'Reason',       width: '13%' },
        { label: 'Loss / Found', width: '12%' },
        { label: 'By',           width: '12%' },
        { label: 'Witnessed',    width: '10%' }
      ],
      rows: 20
    });
  }
};
