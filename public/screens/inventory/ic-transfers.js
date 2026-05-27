'use strict';

/* ── Inventory Control — Transfer Log (writes ic_transfers) ───────────────────
   Logs every movement of inventory between operator-defined locations
   (stockroom → front bar, walk-in → kitchen line, etc). The log is an audit
   trail and accountability record — variance math is NOT affected because
   product totals don't change on a transfer (only location does).

   Each record: { id, date_time, from_location, to_location, product_id,
   product_name, category, quantity, unit, performed_by_id, performed_by,
   witnessed_by_id, witnessed_by, notes, created_at }. */

S.InventoryTransfers = {
  editId: null,
  _pendingDelId: null,
  filterFrom: '',
  filterTo: '',
  filterProductId: '',
  filterLocation: '',

  transfers() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_transfers)) App.inventoryData.ic_transfers = [];
    return App.inventoryData.ic_transfers;
  },
  products() {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
  },
  productById(id) {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
  },
  locations() {
    return ((App.inventoryData && App.inventoryData.ic_locations) || []).filter(l => l.status !== 'Deleted' && l.status !== 'Archived');
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

  // ── Entry ───────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  renderList() {
    this.editId = null;
    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="tr-export">Export PDF</button>'
      + '<button class="btn btn-ghost btn-sm" id="tr-print-blank" style="margin-left:8px;">Print Blank Sheet</button>';
    document.getElementById('tr-export')?.addEventListener('click', () => window.print());
    document.getElementById('tr-print-blank')?.addEventListener('click', () => this.printBlank());

    if (this.products().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Set up products first</div>'
        + '<div class="empty-sub">Transfers move products between locations. Add products and locations under Setup, then log transfers here.</div>'
        + '<button class="btn btn-primary" id="tr-go-products">Add Products</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#tr-go-products')) App.navigate('ic-product-setup'); };
      return;
    }
    if (this.locations().length < 2) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Need at least two locations</div>'
        + '<div class="empty-sub">A transfer moves product from one location to another. Set up your locations under Setup → Set Locations.</div>'
        + '<button class="btn btn-primary" id="tr-go-locs">Set Locations</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#tr-go-locs')) App.navigate('ic-locations'); };
      return;
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = '+ Log Transfer';
    addBtn.addEventListener('click', () => this.showForm());
    this.actions.appendChild(addBtn);

    const all = this.transfers();
    const filtered = this.applyFilters(all);
    filtered.sort((a, b) => new Date(b.date_time || b.created_at || 0).getTime() - new Date(a.date_time || a.created_at || 0).getTime());

    const summary = '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Total Transfers</div><div class="calc-val">' + all.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">In Range</div><div class="calc-val">' + filtered.length + '</div></div>'
      + '</div>';

    let html;
    if (all.length === 0) {
      html = '<div class="empty"><div class="empty-title">No transfers logged yet</div>'
        + '<div class="empty-sub">Log every movement of inventory between locations — stockroom to front bar, walk-in to kitchen line. Builds an audit trail and accountability record.</div>'
        + '<button class="btn btn-primary" id="tr-add-first">Log Your First Transfer</button></div>';
    } else if (filtered.length === 0) {
      html = summary + this.filterCard() + '<div class="empty"><div class="empty-title">No transfers match the filters</div>'
        + '<div class="empty-sub">Adjust or clear the filters above.</div></div>';
    } else {
      const rows = filtered.slice(0, 200).map(t => {
        const p = this.productById(t.product_id);
        return '<tr class="tr-row" data-id="' + t.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDateTime(t.date_time) + '</div></td>'
          + '<td>' + esc(t.from_location || '-') + ' <span style="color:var(--t3);">→</span> ' + esc(t.to_location || '-') + '</td>'
          + '<td><div class="val">' + esc(t.product_name || (p ? p.name : '-')) + '</div>'
          + (t.category ? '<div style="font-size:10px;color:var(--t3);">' + esc(t.category) + '</div>' : '') + '</td>'
          + '<td>' + (t.quantity != null ? t.quantity : '-') + ' ' + esc(t.unit || '') + '</td>'
          + '<td>' + esc(t.performed_by || '-') + '</td>'
          + '<td>' + esc(t.witnessed_by || '-') + '</td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('ic-transfers') ? '<button class="btn btn-ghost btn-sm tr-edit" data-id="' + t.id + '">Edit</button>' : '')
          + (App.canEdit('ic-transfers') ? '<button class="btn btn-danger btn-sm tr-del" data-id="' + t.id + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');
      html = summary + this.filterCard()
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>When</th><th>From → To</th><th>Product</th><th>Quantity</th><th>By</th><th>Witnessed By</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.wireList();
  },

  // ── Filter card ─────────────────────────────────────────────────────
  filterCard() {
    const locOpts = '<option value="">All locations</option>'
      + this.locations().map(l => '<option value="' + esc(l.name) + '"' + (this.filterLocation === l.name ? ' selected' : '') + '>' + esc(l.name) + '</option>').join('');
    const prodOpts = '<option value="">All products</option>'
      + this.products().slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          .map(p => '<option value="' + p.id + '"' + (this.filterProductId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
    return '<div class="card"><div class="card-title">Filter</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="tr-f-from" value="' + esc(this.filterFrom) + '"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="tr-f-to" value="' + esc(this.filterTo) + '"/></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Product</label><select id="tr-f-prod">' + prodOpts + '</select></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Location (either side)</label><select id="tr-f-loc">' + locOpts + '</select></div>'
        + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="tr-f-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div></div>';
  },

  applyFilters(list) {
    return list.filter(t => {
      const date = (t.date_time || '').slice(0, 10);
      if (this.filterFrom && date < this.filterFrom) return false;
      if (this.filterTo && date > this.filterTo) return false;
      if (this.filterProductId && t.product_id !== this.filterProductId) return false;
      if (this.filterLocation && t.from_location !== this.filterLocation && t.to_location !== this.filterLocation) return false;
      return true;
    });
  },

  wireList() {
    this.container.onclick = ev => {
      const row  = ev.target.closest('.tr-row');
      const edit = ev.target.closest('.tr-edit');
      const del  = ev.target.closest('.tr-del');
      const addF = ev.target.closest('#tr-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row && App.canEdit('ic-transfers')) this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
    document.getElementById('tr-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('tr-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });
    document.getElementById('tr-f-prod')?.addEventListener('change', e => { this.filterProductId = e.target.value || ''; this.renderList(); });
    document.getElementById('tr-f-loc')?.addEventListener('change',  e => { this.filterLocation  = e.target.value || ''; this.renderList(); });
    document.getElementById('tr-f-clear')?.addEventListener('click', () => {
      this.filterFrom = this.filterTo = this.filterProductId = this.filterLocation = '';
      this.renderList();
    });
  },

  // ── Form ────────────────────────────────────────────────────────────
  productOptions(selectedId) {
    const prods = this.products();
    if (!prods.length) return '<option value="">No products set up</option>';
    // Group by category for easier picking on big bars
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

  locationOptions(selected) {
    return '<option value="">Select location...</option>'
      + this.locations().map(l => '<option value="' + esc(l.name) + '"' + (l.name === selected ? ' selected' : '') + '>' + esc(l.name) + '</option>').join('');
  },

  unitOptions(productCategory, selected) {
    // Sensible default units per category. Operator can pick or default lands
    // on the most common. For Bottle Beer / Draft Beer we allow Cases too.
    let opts = ['bottles', 'units'];
    if (productCategory === 'Bottle Beer') opts = ['bottles', 'cases'];
    else if (productCategory === 'Draft Beer') opts = ['kegs'];
    else if (productCategory === 'Food' || productCategory === 'Misc') opts = ['units', 'each', 'lbs', 'oz'];
    return opts.map(o => '<option' + (o === selected ? ' selected' : '') + '>' + esc(o) + '</option>').join('');
  },

  showForm(id) {
    if (id && !App.canEdit('ic-transfers')) return;
    this.editId = id || null;
    const t = id ? this.transfers().find(x => x.id === id) : null;
    const active = this.activeShift();
    const defaultManagerId = active ? (active.manager_id || '') : '';
    const v = val => (val != null && val !== '') ? val : '';

    // Pre-fill From location to picked product's primary_location when adding new
    let initialProdId = t?.product_id || '';
    let initialFrom = t?.from_location || '';
    let initialTo = t?.to_location || '';
    let initialUnit = t?.unit || '';
    if (!t && initialProdId) {
      const p = this.productById(initialProdId);
      if (p && p.primary_location) initialFrom = p.primary_location;
    }

    const initialCat = initialProdId ? (this.productById(initialProdId)?.category || '') : '';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit Transfer' : 'Log a Transfer') + '</div>'
      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:240px;flex-shrink:0;"><label>Date / Time</label>'
          + '<input type="datetime-local" id="tr-when" value="' + esc((t?.date_time || this.nowDateTime()).slice(0, 16)) + '"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="flex:1;min-width:200px;"><label>Product</label>'
          + '<select id="tr-prod">' + this.productOptions(initialProdId) + '</select></div>'
        + '<div class="f" style="width:120px;flex-shrink:0;"><label>Quantity</label>'
          + '<input type="number" id="tr-qty" min="0" step="0.5" value="' + v(t?.quantity) + '" placeholder="0"/></div>'
        + '<div class="f" style="width:120px;flex-shrink:0;"><label>Unit</label>'
          + '<select id="tr-unit">' + this.unitOptions(initialCat, initialUnit || 'bottles') + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="flex:1;min-width:180px;"><label>From Location</label>'
          + '<select id="tr-from">' + this.locationOptions(initialFrom) + '</select></div>'
        + '<div class="f" style="flex:1;min-width:180px;"><label>To Location</label>'
          + '<select id="tr-to">' + this.locationOptions(initialTo) + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:240px;flex-shrink:0;"><label>Performed By</label>'
          + '<select id="tr-by">' + App.staffOptions(t?.performed_by_id || defaultManagerId, { placeholder: 'Select staff...' }) + '</select></div>'
        + '<div class="f" style="width:240px;flex-shrink:0;"><label>Witnessed By <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
          + '<select id="tr-witness">' + App.staffOptions(t?.witnessed_by_id || '', { placeholder: 'Optional' }) + '</select></div>'
      + '</div>'
      + '<div class="f" style="margin-top:6px;margin-bottom:0;"><label>Notes</label>'
        + '<textarea id="tr-notes" rows="2" placeholder="Optional">' + esc(t?.notes || '') + '</textarea></div>'

      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="tr-save">' + (id ? 'Update Transfer' : 'Log Transfer') + '</button>'
        + '<button class="btn btn-ghost" id="tr-cancel">Cancel</button>'
        + '<span id="tr-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('tr-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('tr-save')?.addEventListener('click', () => this.save());
    // Product change → re-pop unit options + default From location to product's primary
    document.getElementById('tr-prod')?.addEventListener('change', e => {
      const p = this.productById(e.target.value);
      if (!p) return;
      const unitSel = document.getElementById('tr-unit');
      if (unitSel) unitSel.innerHTML = this.unitOptions(p.category, p.category === 'Bottle Beer' ? 'bottles' : (p.category === 'Draft Beer' ? 'kegs' : 'units'));
      const fromSel = document.getElementById('tr-from');
      if (fromSel && !fromSel.value && p.primary_location) fromSel.value = p.primary_location;
    });
  },

  async save() {
    const err = document.getElementById('tr-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };

    const dateTime = document.getElementById('tr-when')?.value;
    if (!dateTime) { fail('Date and time are required.'); return; }
    const productId = document.getElementById('tr-prod')?.value;
    if (!productId) { fail('Pick a product.'); return; }
    const product = this.productById(productId);
    if (!product) { fail('Product not found.'); return; }
    const quantity = parseFloat(document.getElementById('tr-qty')?.value);
    if (isNaN(quantity) || quantity <= 0) { fail('Enter a quantity greater than zero.'); return; }
    const from = document.getElementById('tr-from')?.value;
    const to   = document.getElementById('tr-to')?.value;
    if (!from)       { fail('Pick a From location.'); return; }
    if (!to)         { fail('Pick a To location.'); return; }
    if (from === to) { fail('From and To must be different locations.'); return; }
    const performedById = document.getElementById('tr-by')?.value;
    if (!performedById) { fail('Pick who performed the transfer.'); return; }
    const performedBy = (this.staffById(performedById) || {}).name || '';
    const witnessedById = document.getElementById('tr-witness')?.value || '';
    const witnessedBy   = witnessedById ? ((this.staffById(witnessedById) || {}).name || '') : '';

    const rec = {
      id:               this.editId || App.uid(),
      date_time:        dateTime,
      from_location:    from,
      to_location:      to,
      product_id:       product.id,
      product_name:     product.name,
      category:         product.category || '',
      quantity,
      unit:             document.getElementById('tr-unit')?.value || '',
      performed_by_id:  performedById,
      performed_by:     performedBy,
      witnessed_by_id:  witnessedById,
      witnessed_by:     witnessedBy,
      notes:            document.getElementById('tr-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();
    else rec.updated_at = new Date().toISOString();

    const list = this.transfers();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('tr-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveInventory();
    this.editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Log Transfer'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const ok = await App.confirm({ title: 'Delete this transfer entry?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;
    App.inventoryData.ic_transfers = this.transfers().filter(x => x.id !== id);
    await App.saveInventory();
    this.renderList();
  },

  // ── Print blank sheet — for shift use ─────────────────────────────────
  printBlank() {
    App.printBlankSheet({
      title: 'Transfer Log',
      subtitle: 'Log every product moved between locations during the shift. Manager enters each row into Bar Cop after close.',
      columns: [
        { label: 'Time',          width: '10%' },
        { label: 'Product',       width: '24%' },
        { label: 'Qty',           width: '8%' },
        { label: 'Unit',          width: '8%' },
        { label: 'From',          width: '15%' },
        { label: 'To',            width: '15%' },
        { label: 'By',            width: '12%' },
        { label: 'Witnessed',     width: '8%' }
      ],
      rows: 20
    });
  }
};
