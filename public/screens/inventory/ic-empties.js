'use strict';

/* ── Inventory Control — Empties Log (writes ic_empties) ──────────────────────
   Tracks empty container disposition for compliance (some states/cities
   require recyclable/redeemable container logs by law) and deposit
   redemption tracking. Standalone — does not affect inventory math.

   Each record: { id, date, product_id, product_name, category, quantity,
   unit, deposit_amount, disposition (Recycle/Return/Trash), performed_by_id,
   performed_by, notes, created_at }. */

S.InventoryEmpties = {
  editId: null,
  _pendingDelId: null,
  filterFrom: '',
  filterTo: '',
  filterProductId: '',
  filterDisposition: '',

  DISPOSITIONS: ['Recycle', 'Return for Deposit', 'Trash'],

  empties() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_empties)) App.inventoryData.ic_empties = [];
    return App.inventoryData.ic_empties;
  },
  products() {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
  },
  // Empties are bar containers (bottles, cans, kegs). Food and Misc are excluded
  // from every product picker on this screen.
  barProducts() {
    const bar = App.BAR_CATS || ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer'];
    return this.products().filter(p => bar.includes(p.category));
  },
  productById(id) {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
  },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
  activeShift() {
    const list = (App.shiftData && App.shiftData.sc_shifts) || [];
    return list.filter(s => s.status === 'Open')
      .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())[0] || null;
  },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // ── Entry ───────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  renderList() {
    this.editId = null;
    this.actions.innerHTML = '';

    if (this.products().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Set up products first</div>'
        + '<div class="empty-sub">Empties are tracked against your products. Add products under Setup, then log empties here.</div>'
        + '<button class="btn btn-primary" id="em-go-products">Add Products</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#em-go-products')) App.navigate('ic-product-setup'); };
      return;
    }

    const all = this.empties();
    const filtered = this.applyFilters(all);
    filtered.sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());

    let listHtml = this.filterCard();
    if (all.length === 0) {
      listHtml += '<div class="empty"><div class="empty-title">No empties logged yet</div>'
        + '<div class="empty-sub">Track empty container disposition for compliance reporting and deposit redemption. Required in some states and cities by law.</div></div>';
    } else if (filtered.length === 0) {
      listHtml += '<div class="empty"><div class="empty-title">No empties match the filters</div>'
        + '<div class="empty-sub">Adjust or clear the filters above.</div></div>';
    } else {
      const rows = filtered.slice(0, 200).map(e => {
        const dispBadge = e.disposition === 'Return for Deposit'
          ? '<span style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--gold);">' + esc(e.disposition) + '</span>'
          : esc(e.disposition || '-');
        const deposit = (parseFloat(e.deposit_amount) || 0) * (parseFloat(e.quantity) || 0);
        return '<tr class="em-row" data-id="' + e.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(e.date) + '</div></td>'
          + '<td><div class="val">' + esc(e.product_name || '-') + '</div>'
          + (e.category ? '<div style="font-size:10px;color:var(--t3);">' + esc(e.category) + '</div>' : '') + '</td>'
          + '<td>' + (e.quantity != null ? e.quantity : '-') + ' ' + esc(e.unit || '') + '</td>'
          + '<td>' + dispBadge + '</td>'
          + '<td>' + (deposit > 0 ? '<span style="color:var(--gold);">' + App.fmtCurrency(deposit) + '</span>' : '<span style="color:var(--t4);">-</span>') + '</td>'
          + '<td>' + esc(e.performed_by || '-') + '</td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('ic-empties') ? '<button class="btn btn-ghost btn-sm em-edit" data-id="' + e.id + '">Edit</button>' : '')
          + (App.canEdit('ic-empties') ? '<button class="btn btn-danger btn-sm em-del" data-id="' + e.id + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');
      listHtml += '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Product</th><th>Quantity</th><th>Disposition</th><th>Deposit Value</th><th>By</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">' + this.logFormCard() + listHtml + '</div>';
    this.wireList();
    this.wireForm();
  },

  showHowTo() {
    App.showHelpModal('How the Empties Log Works', [
      { p: ['The Empties Log records empty containers as you clear them, like spent kegs, bottles, and cans. Some states and cities require a container log by law, and it is how you track deposit money you can claim back.'] },
      { h: 'Logging Empties', p: ['Set the date, pick the product, enter how many containers and the unit, then choose what happened to them: Recycle, Return for Deposit, or Trash. Add the deposit per container when there is money on them, and name who logged it.'] },
      { h: 'Deposits And Compliance', p: ['When you mark containers Return for Deposit and set a deposit amount, Bar Cop tracks the money owed back to you. The log doubles as your compliance record if an inspector ever asks for one.'] },
      { h: 'It Does Not Change Your Counts', p: ['Logging an empty does not touch your inventory totals, usage, or variance. The product was already used. This log is purely about where the empty container went.'] },
      { h: 'Filtering And History', p: ['Every entry drops into the list below. Filter by date range, product, or disposition, and edit or delete any entry to fix a mistake. Print Sheet gives you a paper grid to fill on the floor and enter after close.'] }
    ]);
  },

  // The Log Empties form lives at the top of the landing page, always open.
  logFormCard() {
    return '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Log Empties</span>'
      + '<button class="btn btn-ghost btn-sm" id="em-how">How This Works</button></div>'
      + this.formRows(null)
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="em-save">Log Empties</button>'
        + '<span id="em-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
  },

  // Shared single-row field layout for both the inline log form and the edit
  // page. All data cells on one row; Notes below. Pass the record for edit, or
  // null for a new log.
  formRows(e) {
    const v = val => (val != null && val !== '') ? val : '';
    const active = this.activeShift();
    const defaultMgrId = active ? (active.manager_id || '') : '';
    const initialProdId = e?.product_id || '';
    const initialCat = initialProdId ? (this.productById(initialProdId)?.category || '') : '';
    const dispOpts = this.DISPOSITIONS.map(d =>
      '<option' + (e?.disposition === d ? ' selected' : '') + '>' + esc(d) + '</option>').join('');

    return '<div class="form-row" style="gap:10px;flex-wrap:wrap;">'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Date</label>'
          + '<input type="date" id="em-date" value="' + esc(e?.date || new Date().toISOString().slice(0, 10)) + '"/></div>'
        + '<div class="f" style="flex:1.4;min-width:150px;"><label>Product</label>'
          + '<select id="em-prod">' + this.productOptions(initialProdId) + '</select></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Qty ' + tt('em-qty') + '</label>'
          + '<div class="fw"><input class="suf" type="number" id="em-qty" min="0" step="1" value="' + v(e?.quantity) + '" placeholder="0"/><span class="suf" id="em-qty-unit">' + (initialCat ? this.unitFor(initialCat) : 'bottles') + '</span></div></div>'
        + '<div class="f" style="width:86px;flex-shrink:0;"><label>Deposit ' + tt('em-deposit') + '</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="em-deposit" min="0" step="0.01" value="' + v(e?.deposit_amount) + '" placeholder="0.05"/></div></div>'
        + '<div class="f" style="width:125px;flex-shrink:0;"><label>Disposition</label>'
          + '<select id="em-disp"><option value="">Select...</option>' + dispOpts + '</select></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>Performed By</label>'
          + '<select id="em-by">' + App.staffOptions(e?.performed_by_id || defaultMgrId, { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'
      + '<div class="f" style="margin-top:6px;margin-bottom:0;"><label>Notes</label>'
        + '<textarea id="em-notes" rows="2" placeholder="Optional">' + esc(e?.notes || '') + '</textarea></div>';
  },

  // Wire the always-open inline log form (How This Works, Save, product change).
  wireForm() {
    document.getElementById('em-how')?.addEventListener('click', () => this.showHowTo());
    document.getElementById('em-save')?.addEventListener('click', () => this.save());
    this.wireProdChange();
  },

  // Product change updates the Qty unit suffix to match the product category.
  wireProdChange() {
    document.getElementById('em-prod')?.addEventListener('change', ev => {
      const p = this.productById(ev.target.value);
      const hint = document.getElementById('em-qty-unit');
      if (hint) hint.textContent = p ? this.unitFor(p.category) : 'bottles';
    });
  },

  filterCard() {
    const prodOpts = '<option value="">All products</option>'
      + this.barProducts().slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          .map(p => '<option value="' + p.id + '"' + (this.filterProductId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
    const dispOpts = '<option value="">All</option>'
      + this.DISPOSITIONS.map(d => '<option value="' + esc(d) + '"' + (this.filterDisposition === d ? ' selected' : '') + '>' + esc(d) + '</option>').join('');
    return '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Filter</span>'
      + '<div style="display:flex;gap:8px;">'
        + '<button class="btn btn-ghost btn-sm" id="em-export">Export PDF</button>'
        + '<button class="btn btn-ghost btn-sm" id="em-print-blank">Print Sheet</button>'
      + '</div></div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="em-f-from" value="' + esc(this.filterFrom) + '"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="em-f-to" value="' + esc(this.filterTo) + '"/></div>'
        + '<div class="f" style="width:220px;flex-shrink:0;"><label>Product</label><select id="em-f-prod">' + prodOpts + '</select></div>'
        + '<div class="f" style="width:180px;flex-shrink:0;"><label>Disposition</label><select id="em-f-disp">' + dispOpts + '</select></div>'
        + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="em-f-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div></div>';
  },

  applyFilters(list) {
    return list.filter(e => {
      if (this.filterFrom && (e.date || '') < this.filterFrom) return false;
      if (this.filterTo && (e.date || '') > this.filterTo) return false;
      if (this.filterProductId && e.product_id !== this.filterProductId) return false;
      if (this.filterDisposition && e.disposition !== this.filterDisposition) return false;
      return true;
    });
  },

  wireList() {
    this.container.onclick = ev => {
      const row  = ev.target.closest('.em-row');
      const edit = ev.target.closest('.em-edit');
      const del  = ev.target.closest('.em-del');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row && App.canEdit('ic-empties')) this.showForm(row.dataset.id);
    };
    document.getElementById('em-export')?.addEventListener('click', () => window.print());
    document.getElementById('em-print-blank')?.addEventListener('click', () => this.printBlank());
    document.getElementById('em-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('em-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });
    document.getElementById('em-f-prod')?.addEventListener('change', e => { this.filterProductId = e.target.value || ''; this.renderList(); });
    document.getElementById('em-f-disp')?.addEventListener('change', e => { this.filterDisposition = e.target.value || ''; this.renderList(); });
    document.getElementById('em-f-clear')?.addEventListener('click', () => {
      this.filterFrom = this.filterTo = this.filterProductId = this.filterDisposition = '';
      this.renderList();
    });
  },

  // ── Form ────────────────────────────────────────────────────────────
  productOptions(selectedId) {
    const prods = this.barProducts();
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

  // The empties unit is implied by the product: draft is by the keg, everything
  // else (liquor, wine, bottle beer) is by the bottle. No picker needed.
  unitFor(category) { return category === 'Draft Beer' ? 'kegs' : 'bottles'; },

  // Edit page (own screen). Same single-row field layout as the inline log
  // form; Cancel stays here because the operator navigated away to edit.
  showForm(id) {
    if (!App.canEdit('ic-empties')) return;
    this.editId = id || null;
    const e = id ? this.empties().find(x => x.id === id) : null;

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">Edit Empties Entry</div>'
      + this.formRows(e)
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="em-save">Update Entry</button>'
        + '<button class="btn btn-ghost" id="em-cancel">Cancel</button>'
        + '<span id="em-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('em-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('em-save')?.addEventListener('click', () => this.save());
    this.wireProdChange();
  },

  async save() {
    const err = document.getElementById('em-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('em-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const productId = document.getElementById('em-prod')?.value;
    if (!productId) { fail('Pick a product.'); return; }
    const product = this.productById(productId);
    if (!product) { fail('Product not found.'); return; }
    const quantity = parseFloat(document.getElementById('em-qty')?.value);
    if (isNaN(quantity) || quantity <= 0) { fail('Enter a quantity greater than zero.'); return; }
    const disposition = document.getElementById('em-disp')?.value;
    if (!disposition) { fail('Pick a disposition (Recycle, Return for Deposit, or Trash).'); return; }
    const performedById = document.getElementById('em-by')?.value;
    if (!performedById) { fail('Pick who logged this.'); return; }
    const performedBy = (this.staffById(performedById) || {}).name || '';

    const rec = {
      id:               this.editId || App.uid(),
      date,
      product_id:       product.id,
      product_name:     product.name,
      category:         product.category || '',
      quantity,
      unit:             this.unitFor(product.category),
      deposit_amount:   parseFloat(document.getElementById('em-deposit')?.value) || 0,
      disposition,
      performed_by_id:  performedById,
      performed_by:     performedBy,
      notes:            document.getElementById('em-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();
    else rec.updated_at = new Date().toISOString();

    const list = this.empties();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }
    const btn = document.getElementById('em-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveInventory();
    this.editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Log Empties'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const ok = await App.confirm({ title: 'Delete this empties entry?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;
    App.inventoryData.ic_empties = this.empties().filter(x => x.id !== id);
    await App.saveInventory();
    this.renderList();
  },

  // ── Print blank sheet — for shift use ─────────────────────────────────
  printBlank() {
    App.printBlankSheet({
      title: 'Empties Log',
      subtitle: 'Log every empty container removed during the shift. Required by law in some states for compliance and deposit redemption.',
      columns: [
        { label: 'Time',          width: '12%' },
        { label: 'Product',       width: '30%' },
        { label: 'Qty',           width: '10%' },
        { label: 'Unit',          width: '10%' },
        { label: 'Disposition',   width: '15%' },
        { label: 'Logged By',     width: '15%' },
        { label: 'Initials',      width: '8%' }
      ],
      rows: 20
    });
  }
};
