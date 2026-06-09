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
    this.actions.innerHTML = '';

    if (this.products().length === 0 || this.locations().length < 2) {
      App.setupCard(this.container, {
        title: 'Set Up Transfers',
        lead: 'Transfers move product between locations and build an audit trail of every move. Two quick setup steps and you can start logging.',
        steps: [
          { title: 'Add your products', desc: 'Add the products you stock so a transfer has something to move.', btn: 'Add Products', screen: 'ic-product-setup', done: this.products().length > 0 },
          { title: 'Set your locations', desc: 'You need at least two storage locations to move product between, like a stockroom and the front bar.', btn: 'Set Locations', screen: 'ic-locations', done: this.locations().length >= 2 }
        ]
      });
      return;
    }

    const all = this.transfers();
    if (all.length === 0) {
      this.container.innerHTML = '<div class="screen">' + this.logFormCard()
        + '<div style="font-size:13px;color:var(--t3);padding:14px 2px;">No transfers logged yet. Use the form above to log the first one.</div></div>';
      this.wireForm('tr-');
      return;
    }

    const filtered = this.applyFilters(all)
      .sort((a, b) => new Date(b.date_time || b.created_at || 0).getTime() - new Date(a.date_time || a.created_at || 0).getTime());
    const lastDate = all.reduce((m, t) => {
      const d = t.date_time || t.created_at || '';
      return (!m || new Date(d).getTime() > new Date(m).getTime()) ? d : m;
    }, '');

    const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Transfers</div><div class="calc-val lg">' + all.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Last Transfer</div><div class="calc-val lg">' + this.fmtDate((lastDate || '').slice(0, 10)) + '</div></div>'
      + '</div></div>';

    const filterHeading = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Filter Transfers</div>'
      + '<div style="display:flex;gap:8px;">'
        + '<button class="btn btn-ghost btn-sm" id="tr-export">Export PDF</button>'
        + '<button class="btn btn-ghost btn-sm" id="tr-print-blank">Worksheet</button>'
      + '</div></div>';

    const rows = filtered.slice(0, App.listLimit('ic', 'transfer')).map(t => {
      const p = this.productById(t.product_id);
      return '<tr class="tr-row" data-id="' + t.id + '" style="cursor:pointer;">'
        + '<td><div class="val">' + this.fmtDateTime(t.date_time) + '</div></td>'
        + '<td>' + esc(t.from_location || '-') + ' <span style="color:var(--t3);">&rarr;</span> ' + esc(t.to_location || '-') + '</td>'
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
    const listCard = '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>When</th><th>From &rarr; To</th><th>Product</th><th>Quantity</th><th>By</th><th>Witnessed By</th><th></th>'
      + '</tr></thead><tbody>' + (rows || '<tr><td colspan="7" style="color:var(--t3);padding:12px 8px;">No transfers match the filter.</td></tr>') + '</tbody></table></div></div>'
      + App.showOlderBar('ic', 'transfer', filtered, !!(this.filterFrom || this.filterTo || this.filterProductId || this.filterLocation));

    this.container.innerHTML = '<div class="screen">' + this.logFormCard() + statsCard + filterHeading + this.filterCard() + listCard + '</div>';
    this.wireList();
    this.wireForm('tr-');
  },

  showHowTo() {
    App.showHelpModal('How the Transfer Log Works', [
      { p: ['The Transfer Log records every time product moves from one of your locations to another, like stockroom to the front bar or walk-in to the kitchen line. It is an accountability trail, so you always know who moved what and where it went. When a bottle goes missing from the front bar, the first question is whether it ever left the back. This log answers it.'] },
      { h: 'When You Run Multiple Locations', p: ['The Transfer Log earns its keep the moment your stock lives in more than one place. At The Anchor the well liquor is counted at the front bar and the service bar separately, with the backup cases in the stockroom. If a manager grabs three bottles of house tequila off the stockroom shelf and walks them to the service bar on a busy Friday, that move gets logged here so each location count still ties out.'] },
      { h: 'Logging A Transfer', p: ['Fill in the date and time, pick the product and how much moved, set the From and To locations, and name who did it. Pick the right unit too. Draft moves by the keg, bottle beer by the case, liquor and wine by the bottle. Add a witness when two people should sign off on a high-value move. Notes are optional but worth a line when the move is out of the ordinary.'] },
      { h: 'It Does Not Change Your Counts', p: ['A transfer only changes where product sits, not how much you have in the building. Your total on-hand, usage, and variance stay untouched. This log is purely about tracking movement between locations, so logging one never throws off your numbers.'] },
      { h: 'A Real Example', p: ['Say the front bar runs dry on Tito\'s in the middle of dinner service and your bartender pulls a fresh case from the stockroom. Log it: product Tito\'s, quantity one case if you moved it by the case or the loose bottle count if you broke one out, from Stockroom, to Front Bar, performed by whoever grabbed it. Now when you count the front bar at close and the stockroom on Sunday, both reconcile and nobody is left wondering where the vodka went.'] },
      { h: 'Filtering And History', p: ['Every transfer you log drops into the list below. Use the filters to pull up a date range, a single product, or one location. Edit or delete any entry if you need to fix a mistake.'] },
      { h: 'Worksheet', p: ['The Worksheet button gives you a clean PDF grid to print and carry on the floor during a shift. Jot down moves as they happen, then enter them here after close. That beats trying to remember at the end of the night.'] }
    ]);
  },

  // The Log a Transfer form lives at the top of the landing page (collapsible).
  logFormCard() {
    return '<div class="card form-card no-print">'
      + App.collapsibleCardTitle('ic-transfers', 'Log a Transfer')
      + '<div class="collapse-body">'
      + this.formRows(null, 'tr-')
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="tr-save">Log Transfer</button>'
        + '<span id="tr-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';
  },

  // Shared two-row field layout for both the inline log form and the edit popup.
  // `idp` prefixes every field id ('tr-' inline, 'tre-' modal) so the popup never
  // collides with the always-open inline form behind it.
  formRows(t, idp) {
    const v = val => (val != null && val !== '') ? val : '';
    const active = this.activeShift();
    const defaultManagerId = active ? (active.manager_id || '') : '';
    let initialProdId = t?.product_id || '';
    let initialFrom = t?.from_location || '';
    const initialTo = t?.to_location || '';
    const initialUnit = t?.unit || '';
    if (!t && initialProdId) {
      const p = this.productById(initialProdId);
      if (p && p.primary_location) initialFrom = p.primary_location;
    }
    const initialCat = initialProdId ? (this.productById(initialProdId)?.category || '') : '';

    return '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
        + '<div class="f" style="width:220px;flex-shrink:0;"><label>Date / Time</label>'
          + '<input type="datetime-local" id="' + idp + 'when" value="' + esc((t?.date_time || this.nowDateTime()).slice(0, 16)) + '"/></div>'
        + '<div class="f" style="flex:1;min-width:200px;"><label>Product</label>'
          + '<select id="' + idp + 'prod">' + this.productOptions(initialProdId) + '</select></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Quantity</label>'
          + '<input type="number" id="' + idp + 'qty" min="0" step="0.5" value="' + v(t?.quantity) + '" placeholder="0"/></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Unit</label>'
          + '<select id="' + idp + 'unit">' + this.unitOptions(initialCat, initialUnit || (initialCat === 'Bottle Beer' ? 'cases' : initialCat === 'Draft Beer' ? 'kegs' : 'bottles')) + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
        + '<div class="f" style="flex:1;min-width:160px;"><label>From Location</label>'
          + '<select id="' + idp + 'from">' + this.locationOptions(initialFrom) + '</select></div>'
        + '<div class="f" style="flex:1;min-width:160px;"><label>To Location</label>'
          + '<select id="' + idp + 'to">' + this.locationOptions(initialTo) + '</select></div>'
        + '<div class="f" style="flex:1;min-width:160px;"><label>Performed By</label>'
          + '<select id="' + idp + 'by">' + App.staffOptions(t?.performed_by_id || defaultManagerId, { placeholder: 'Select staff...' }) + '</select></div>'
        + '<div class="f" style="flex:1;min-width:160px;"><label>Witnessed By <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
          + '<select id="' + idp + 'witness">' + App.staffOptions(t?.witnessed_by_id || '', { placeholder: 'Optional' }) + '</select></div>'
      + '</div>'
      + '<div class="f" style="margin-top:6px;margin-bottom:0;"><label>Notes</label>'
        + '<textarea id="' + idp + 'notes" class="notes-ta" rows="2" placeholder="Optional">' + esc(t?.notes || '') + '</textarea></div>';
  },

  // Wire the always-open inline log form.
  wireForm(idp) {
    document.getElementById(idp + 'save')?.addEventListener('click', () => this.save(idp, null));
    this.wireProdChange(idp);
    const head = this.container.querySelector('.card-collapse-head');
    if (head) head.addEventListener('click', ev => { if (!ev.target.closest('.btn')) App.toggleCollapse(head); });
    App.applyCollapsed(this.container);
  },

  // Product change: re-pop unit options + default From to the product's primary.
  wireProdChange(idp) {
    document.getElementById(idp + 'prod')?.addEventListener('change', e => {
      const p = this.productById(e.target.value);
      if (!p) return;
      const unitSel = document.getElementById(idp + 'unit');
      if (unitSel) unitSel.innerHTML = this.unitOptions(p.category, p.category === 'Bottle Beer' ? 'cases' : (p.category === 'Draft Beer' ? 'kegs' : 'units'));
      const fromSel = document.getElementById(idp + 'from');
      if (fromSel && !fromSel.value && p.primary_location) fromSel.value = p.primary_location;
    });
  },

  // ── Filter card (controls only; Export/Worksheet live on the heading row) ──
  filterCard() {
    const locOpts = '<option value="">All locations</option>'
      + this.locations().map(l => '<option value="' + esc(l.name) + '"' + (this.filterLocation === l.name ? ' selected' : '') + '>' + esc(l.name) + '</option>').join('');
    const prodOpts = '<option value="">All products</option>'
      + this.products().slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          .map(p => '<option value="' + p.id + '"' + (this.filterProductId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
    return '<div class="card no-print"><div class="form-row" style="align-items:flex-end;margin-bottom:0;flex-wrap:wrap;gap:14px;">'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="tr-f-from" value="' + esc(this.filterFrom) + '"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="tr-f-to" value="' + esc(this.filterTo) + '"/></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Product</label><select id="tr-f-prod">' + prodOpts + '</select></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Location (either side)</label><select id="tr-f-loc">' + locOpts + '</select></div>'
        + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="tr-f-clear">Clear</button></div>'
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
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row  = ev.target.closest('.tr-row');
      const edit = ev.target.closest('.tr-edit');
      const del  = ev.target.closest('.tr-del');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.openEdit(edit.dataset.id); }
      else if (row && App.canEdit('ic-transfers')) this.openEdit(row.dataset.id);
    };
    document.getElementById('tr-export')?.addEventListener('click', () => App.exportPDF({ title: 'Transfer Log', root: this.container }));
    document.getElementById('tr-print-blank')?.addEventListener('click', () => this.printBlank());
    document.getElementById('tr-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('tr-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });
    document.getElementById('tr-f-prod')?.addEventListener('change', e => { this.filterProductId = e.target.value || ''; this.renderList(); });
    document.getElementById('tr-f-loc')?.addEventListener('change',  e => { this.filterLocation  = e.target.value || ''; this.renderList(); });
    document.getElementById('tr-f-clear')?.addEventListener('click', () => {
      this.filterFrom = this.filterTo = this.filterProductId = this.filterLocation = '';
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

  locationOptions(selected) {
    return '<option value="">Select location...</option>'
      + this.locations().map(l => '<option value="' + esc(l.name) + '"' + (l.name === selected ? ' selected' : '') + '>' + esc(l.name) + '</option>').join('');
  },

  unitOptions(productCategory, selected) {
    let opts = ['bottles', 'units'];
    if (productCategory === 'Bottle Beer') opts = ['cases', 'bottles'];
    else if (productCategory === 'Draft Beer') opts = ['kegs'];
    else if (productCategory === 'Food' || productCategory === 'Misc') opts = ['units', 'each', 'lbs', 'oz'];
    return opts.map(o => '<option' + (o === selected ? ' selected' : '') + '>' + esc(o) + '</option>').join('');
  },

  // ── Edit popup (standard modal) ───────────────────────────────────────
  openEdit(id) {
    if (!App.canEdit('ic-transfers')) return;
    const t = this.transfers().find(x => x.id === id);
    if (!t) return;
    this.editId = id;
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Transfer</div>'
      + this.formRows(t, 'tre-')
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="tre-save">Update Transfer</button>'
        + '<button class="btn btn-ghost" id="tre-cancel">Cancel</button>'
        + '<span id="tre-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
        + '<button class="btn btn-danger" id="tre-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'tr-edit-modal', maxWidth: 540, noClose: true });
    document.getElementById('tre-save')?.addEventListener('click', () => this.save('tre-', 'tr-edit-modal'));
    document.getElementById('tre-cancel')?.addEventListener('click', () => { this.editId = null; App.closeModal('tr-edit-modal'); });
    document.getElementById('tre-del')?.addEventListener('click', async () => {
      if (!(await App.confirmDelete())) return;
      await App.removeRecord('ic', 'transfer', id);
      this.editId = null;
      App.closeModal('tr-edit-modal');
      this.renderList();
    });
    this.wireProdChange('tre-');
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
    const from = document.getElementById(idp + 'from')?.value;
    const to   = document.getElementById(idp + 'to')?.value;
    if (!from)       { fail('Pick a From location.'); return; }
    if (!to)         { fail('Pick a To location.'); return; }
    if (from === to) { fail('From and To must be different locations.'); return; }
    const performedById = document.getElementById(idp + 'by')?.value;
    if (!performedById) { fail('Pick who performed the transfer.'); return; }
    const performedBy = (this.staffById(performedById) || {}).name || '';
    const witnessedById = document.getElementById(idp + 'witness')?.value || '';
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
      unit:             document.getElementById(idp + 'unit')?.value || '',
      performed_by_id:  performedById,
      performed_by:     performedBy,
      witnessed_by_id:  witnessedById,
      witnessed_by:     witnessedBy,
      notes:            document.getElementById(idp + 'notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();
    else rec.updated_at = new Date().toISOString();

    let saveRec = rec;
    if (this.editId) {
      const ex = this.transfers().find(x => x.id === this.editId);
      if (ex) saveRec = { ...ex, ...rec };
    }

    const btn = document.getElementById(idp + 'save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('ic', 'transfer', saveRec);
    this.editId = null;
    if (ok) {
      if (modalId) App.closeModal(modalId);
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = modalId ? 'Update Transfer' : 'Log Transfer'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    await App.removeRecord('ic', 'transfer', id);
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
