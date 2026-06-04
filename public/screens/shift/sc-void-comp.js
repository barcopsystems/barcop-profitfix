'use strict';

/* ── Shift Control — Void and Comp Log (writes sc_void_comps) ─────────────────
   Logs voided and comped items during service. One Item dropdown (menu items +
   inventory products, with a Custom option) identifies what it was; picking an
   inventory product links it for variance. sc_void_comps feeds Profit Recovery's
   Theft Risk and the Profit Audit. Inline add form on the landing, filter card
   with totals, bare list. */

S.ShiftVoidComp = {
  editId: null,
  filterFrom: '',
  filterTo: '',
  filterType: '',
  filterServerId: '',

  REASONS: {
    Void: ['Rung in error', 'Wrong item', 'Customer changed mind', 'Kitchen error', 'Sent back', 'Other'],
    Comp: ['Service recovery', 'Manager comp', 'Regular / VIP', 'Marketing / promo', 'Other']
  },
  // Loss categories feed Theft Risk; expense categories are tracked as separate
  // cost lines in Books and Year-End. Default = Customer Comp.
  CATEGORIES: ['Customer Comp', 'Service Recovery', 'Staff Meal', 'Shift Drink'],

  records() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_void_comps)) App.shiftData.sc_void_comps = [];
    return App.shiftData.sc_void_comps;
  },
  products() {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
  },
  productById(id) {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
  },
  menuItems() { return (App.menuItems && App.menuItems()) || []; },
  menuItemById(id) { return this.menuItems().find(m => m.id === id) || null; },
  shiftTypes() { return App.SHIFT_TYPES; },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // ── Item picker: menu items + inventory products + custom, one dropdown ─────
  itemOptions(selectedKey) {
    let h = '<option value="">Select item...</option>'
      + '<option value="custom"' + (selectedKey === 'custom' ? ' selected' : '') + '>Custom / not tracked</option>';
    const menu = this.menuItems();
    if (menu.length) {
      h += '<optgroup label="Menu Items">';
      menu.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(m => {
        const v = 'm:' + m.id;
        h += '<option value="' + v + '"' + (selectedKey === v ? ' selected' : '') + '>' + esc(m.name) + '</option>';
      });
      h += '</optgroup>';
    }
    const order = ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
    const cats = [...new Set(this.products().map(p => p.category || 'Other'))]
      .sort((a, b) => { const ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    cats.forEach(cat => {
      const inCat = this.products().filter(p => (p.category || 'Other') === cat).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (!inCat.length) return;
      h += '<optgroup label="' + esc(cat) + '">';
      inCat.forEach(p => { const v = 'p:' + p.id; h += '<option value="' + v + '"' + (selectedKey === v ? ' selected' : '') + '>' + esc(p.name) + '</option>'; });
      h += '</optgroup>';
    });
    return h;
  },
  // Resolve a saved record back to its picker key.
  itemKeyOf(r) {
    if (!r) return '';
    if (r.product_id) return 'p:' + r.product_id;
    if (r.menu_item_id) return 'm:' + r.menu_item_id;
    if (r.item) return 'custom';
    return '';
  },
  reasonOptions(type, selected) {
    return '<option value="">Select reason...</option>'
      + (this.REASONS[type] || []).map(r => '<option' + (r === selected ? ' selected' : '') + '>' + r + '</option>').join('');
  },
  categoryOptions(selected) {
    const sel = selected || 'Customer Comp';
    return this.CATEGORIES.map(c => '<option' + (c === sel ? ' selected' : '') + '>' + c + '</option>').join('');
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How the Void and Comp Log Works', [
      { p: ['Voids and comps are your exception transactions. Logging every one feeds Theft Risk and the Profit Audit, so the bartender comping a round without a manager shows up as a pattern instead of disappearing.'] },
      { h: 'Void vs Comp', p: ['A void reverses a sale that should not have been rung (wrong item, rung in error). A comp is a sale you gave away. Pick the item from your menu or inventory, or choose Custom if Bar Cop does not track it.'] },
      { h: 'Comp category matters', p: ['On a comp, the category separates loss from policy expense. Customer Comp and Service Recovery are loss and feed Theft Risk. Staff Meal and Shift Drink are policy expense, tracked as cost lines in Books and Year-End, not theft. Categorizing honestly keeps the theft score real.'] },
      { h: 'Linked item and units', p: ['When you pick an inventory product, set the units so the Inventory Variance Report subtracts that known comp from usage and it does not read as shrinkage.'] },
      { h: 'Filter, Export, Worksheet', p: ['Filter by date, type, or server and the totals update. Export PDF saves the filtered list. Worksheet prints a blank sheet to tally voids and comps by hand during the rush.'] }
    ]);
  },

  // ── Shared form fields ──────────────────────────────────────────────────────
  formFields(r) {
    const v = val => (val != null && val !== '') ? val : '';
    const type = (r && r.type) || 'Void';
    const typeOpts = ['Void', 'Comp'].map(t => '<option' + (type === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const shiftOpts = this.shiftTypes().map(t => '<option' + (r && r.shift_type === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const itemKey = this.itemKeyOf(r);
    const isCustom = itemKey === 'custom';
    const isProduct = itemKey.startsWith('p:');

    return '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label><input type="date" id="vc-date" value="' + esc(r?.date || new Date().toISOString().slice(0, 10)) + '"/></div>'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>Type</label><select id="vc-type">' + typeOpts + '</select></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Shift Type</label><select id="vc-shift">' + shiftOpts + '</select></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="vc-amount" min="0" step="0.01" value="' + v(r?.amount) + '"/></div></div>'
      + '</div>'

      + '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="width:280px;flex-shrink:0;"><label>Item</label><select id="vc-item-sel">' + this.itemOptions(itemKey) + '</select></div>'
      + '<div class="f" id="vc-custom-wrap" style="width:220px;flex-shrink:0;' + (isCustom ? '' : 'display:none;') + '"><label>Custom Item Name</label><input type="text" id="vc-custom" value="' + esc(isCustom ? (r?.item || '') : '') + '" placeholder="What was it?"/></div>'
      + '<div class="f" id="vc-units-wrap" style="width:120px;flex-shrink:0;' + (isProduct ? '' : 'display:none;') + '"><label>Units</label><input type="number" id="vc-units" min="0" step="0.01" value="' + v(r?.units != null ? r.units : '') + '" placeholder="1"/></div>'
      + '</div>'

      + '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Server</label><select id="vc-server">' + App.staffOptions(r?.staff_id || r?.server, { placeholder: 'Select staff...' }) + '</select></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Authorized By</label><select id="vc-auth">' + App.staffOptions(r?.authorized_by_id || r?.authorized_by, { placeholder: 'Select manager...' }) + '</select></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Check #</label><input type="text" id="vc-check" value="' + esc(r?.check_number || '') + '" placeholder="Optional"/></div>'
      + '<div class="f" id="vc-cat-wrap" style="width:190px;flex-shrink:0;' + (type === 'Void' ? 'display:none;' : '') + '"><label>Category</label><select id="vc-cat">' + this.categoryOptions(r?.category) + '</select></div>'
      + '<div class="f" style="width:190px;flex-shrink:0;"><label>Reason</label><select id="vc-reason">' + this.reasonOptions(type, r?.reason) + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:12px;"><div class="f" style="width:100%;"><label>Notes</label><textarea id="vc-notes" rows="2" placeholder="Optional">' + esc(r?.notes || '') + '</textarea></div></div>';
  },

  // type + item change handlers (wired by both the inline form and the edit page)
  wireFormFields() {
    document.getElementById('vc-type')?.addEventListener('change', e => {
      const t = e.target.value;
      const sel = document.getElementById('vc-reason'); if (sel) sel.innerHTML = this.reasonOptions(t, '');
      const catWrap = document.getElementById('vc-cat-wrap'); if (catWrap) catWrap.style.display = t === 'Void' ? 'none' : '';
    });
    document.getElementById('vc-item-sel')?.addEventListener('change', e => {
      const k = e.target.value;
      const cw = document.getElementById('vc-custom-wrap'); if (cw) cw.style.display = k === 'custom' ? '' : 'none';
      const uw = document.getElementById('vc-units-wrap'); if (uw) uw.style.display = k.startsWith('p:') ? '' : 'none';
    });
  },

  statusText(type) {
    return type === 'Void'
      ? '<span style="color:var(--amber);font-weight:700;">Void</span>'
      : '<span style="color:var(--steel);font-weight:700;">Comp</span>';
  },

  // ── Filter ──────────────────────────────────────────────────────────────────
  filterCard(stats) {
    const typeOpts = ['', 'Void', 'Comp'].map(x => '<option value="' + x + '"' + (this.filterType === x ? ' selected' : '') + '>' + (x === '' ? 'All types' : x) + '</option>').join('');
    return '<div class="card no-print"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Filter</span><div style="display:flex;gap:8px;">'
      + '<button class="btn btn-ghost btn-sm" id="vc-export">Export PDF</button>'
      + '<button class="btn btn-ghost btn-sm" id="vc-print-blank">Worksheet</button></div></div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:14px;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="vc-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="vc-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Type</label><select id="vc-f-type">' + typeOpts + '</select></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Server</label><select id="vc-f-server">' + App.staffOptions(this.filterServerId, { placeholder: 'All servers' }) + '</select></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="vc-f-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div>' + (stats || '') + '</div>';
  },

  applyFilters(list) {
    return list.filter(r => {
      const date = r.date || '';
      if (this.filterFrom && date < this.filterFrom) return false;
      if (this.filterTo && date > this.filterTo) return false;
      if (this.filterType && r.type !== this.filterType) return false;
      if (this.filterServerId && (r.staff_id || '') !== this.filterServerId) return false;
      return true;
    });
  },

  renderList() {
    this.editId = null;
    const all = [...this.records()];
    const filtered = this.applyFilters(all).sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

    const formCard = '<div class="card">'
      + App.collapsibleCardTitle('sc-void-comp', 'Log Void / Comp', App.helpButton('vc-how'))
      + '<div class="collapse-body">'
      + this.formFields(null)
      + '<div class="card-actions"><button class="btn btn-primary" id="vc-save">Save</button>'
      + '<span id="vc-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div>'
      + '</div></div>';

    let below;
    if (all.length === 0) {
      below = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No voids or comps logged yet. Use the form above. These exception transactions feed your Theft Risk score and exception analysis in Profit Recovery.</div>';
    } else {
      const voids = filtered.filter(r => r.type === 'Void');
      const comps = filtered.filter(r => r.type === 'Comp');
      const voidTot = voids.reduce((t, r) => t + (r.amount || 0), 0);
      const compTot = comps.reduce((t, r) => t + (r.amount || 0), 0);
      const stats = '<div class="calc" style="margin-bottom:0;">'
        + '<div class="calc-item"><div class="calc-label">Voids</div><div class="calc-val">' + voids.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Void Total</div><div class="calc-val warn">' + App.fmtCurrency(voidTot) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Comps</div><div class="calc-val">' + comps.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Comp Total</div><div class="calc-val warn">' + App.fmtCurrency(compTot) + '</div></div>'
        + '</div>';

      let listHtml;
      if (filtered.length === 0) {
        listHtml = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No entries match the filters.</div>';
      } else {
        const rows = filtered.slice(0, App.listLimit('sc', 'void_comp')).map(r => '<tr class="vc-row" data-id="' + r.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(r.date) + '</div></td>'
          + '<td>' + this.statusText(r.type) + '</td>'
          + '<td>' + esc(r.item || '-') + '</td>'
          + '<td class="val">' + App.fmtCurrency(r.amount || 0) + '</td>'
          + '<td>' + esc(r.server || '-') + '</td>'
          + '<td>' + esc(r.authorized_by || '-') + '</td>'
          + '<td>' + esc(r.reason || '-') + '</td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('sc-void-comp') ? '<button class="btn btn-ghost btn-sm vc-edit" data-id="' + r.id + '">Edit</button>' : '')
          + (App.canEdit('sc-void-comp') ? '<button class="btn btn-danger btn-sm vc-del" data-id="' + r.id + '">Delete</button>' : '')
          + '</div></td></tr>').join('');
        listHtml = '<div class="tbl-wrap" style="overflow-x:auto;margin-top:16px;"><table class="tbl"><thead><tr>'
          + '<th>Date</th><th>Type</th><th>Item</th><th>Amount</th><th>Server</th><th>Authorized By</th><th>Reason</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          + App.showOlderBar('sc', 'void_comp', filtered, !!(this.filterFrom || this.filterTo || this.filterType || this.filterServerId));
      }
      below = this.filterCard(stats) + listHtml;
    }

    this.container.innerHTML = '<div class="screen">' + formCard + below + '</div>';
    App.applyCollapsed(this.container);
    this.wireList();
    this.wireFormFields();
  },

  wireList() {
    this.container.onclick = ev => {
      if (ev.target.closest('#vc-how')) { this.showHowTo(); return; }
      const head = ev.target.closest('.card-collapse-head');
      if (head && !ev.target.closest('.btn')) { App.toggleCollapse(head); return; }
      if (ev.target.closest('#vc-export')) { App.exportPDF({ title: 'Void and Comp Log', root: this.container }); return; }
      if (ev.target.closest('#vc-print-blank')) { this.printBlank(); return; }
      if (ev.target.closest('#vc-save')) { this.save(); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const edit = ev.target.closest('.vc-edit');
      const del  = ev.target.closest('.vc-del');
      const row  = ev.target.closest('.vc-row');
      if (del)  { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); return; }
      if (row && App.canEdit('sc-void-comp')) this.showForm(row.dataset.id);
    };
    document.getElementById('vc-f-from')?.addEventListener('change',   e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('vc-f-to')?.addEventListener('change',     e => { this.filterTo   = e.target.value || ''; this.renderList(); });
    document.getElementById('vc-f-type')?.addEventListener('change',   e => { this.filterType = e.target.value || ''; this.renderList(); });
    document.getElementById('vc-f-server')?.addEventListener('change', e => { this.filterServerId = e.target.value || ''; this.renderList(); });
    document.getElementById('vc-f-clear')?.addEventListener('click', () => {
      this.filterFrom = this.filterTo = this.filterType = this.filterServerId = '';
      this.renderList();
    });
  },

  // Edit on its own page (same fields, no How it works). Cancel returns to the list.
  showForm(id) {
    if (id && !App.canEdit('sc-void-comp')) return;
    this.editId = id || null;
    const r = id ? this.records().find(x => x.id === id) : null;
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit Void / Comp' : 'Log Void / Comp') + '</div>'
      + this.formFields(r)
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="vc-save">' + (id ? 'Update' : 'Save') + '</button>'
      + '<button class="btn btn-ghost" id="vc-cancel">Cancel</button>'
      + '<span id="vc-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';
    this.container.onclick = null;
    document.getElementById('vc-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('vc-save')?.addEventListener('click', () => this.save());
    this.wireFormFields();
  },

  async save() {
    const err = document.getElementById('vc-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('vc-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const amount = parseFloat(document.getElementById('vc-amount')?.value);
    if (isNaN(amount) || amount < 0) { fail('Enter the amount.'); return; }

    // Resolve the item from the single picker.
    const itemKey = document.getElementById('vc-item-sel')?.value || '';
    let item = '', productId = '', productName = '', menuItemId = '', units = null;
    if (itemKey === 'custom') {
      item = (document.getElementById('vc-custom')?.value || '').trim();
      if (!item) { fail('Enter the custom item name.'); return; }
    } else if (itemKey.startsWith('m:')) {
      const m = this.menuItemById(itemKey.slice(2));
      if (!m) { fail('Pick an item.'); return; }
      item = m.name; menuItemId = m.id;
    } else if (itemKey.startsWith('p:')) {
      const p = this.productById(itemKey.slice(2));
      if (!p) { fail('Pick an item.'); return; }
      item = p.name; productId = p.id; productName = p.name;
      const u = parseFloat(document.getElementById('vc-units')?.value);
      units = isNaN(u) ? null : u;
    } else {
      fail('Pick an item or choose Custom.'); return;
    }

    const type = document.getElementById('vc-type')?.value || 'Void';
    const authBy = document.getElementById('vc-auth')?.value || '';

    // Comp authorization threshold check.
    const threshold = parseFloat((App.shiftData?.settings || {}).comp_auth_threshold);
    const thresholdActive = !isNaN(threshold) && threshold > 0;
    let authThresholdOverride = false;
    if (type === 'Comp' && thresholdActive && amount > threshold && !authBy) {
      const ok = await App.confirm({
        title: 'Comp over your $' + threshold + ' threshold',
        message: 'No manager is set in Authorized By. Continue without manager authorization? The comp will be flagged in Theft Risk as an unauthorized large comp.',
        confirmText: 'Continue Without Auth',
        cancelText: 'Cancel'
      });
      if (!ok) return;
      authThresholdOverride = true;
    }

    const category = type === 'Comp' ? (document.getElementById('vc-cat')?.value || 'Customer Comp') : '';
    const serverId = document.getElementById('vc-server')?.value || '';
    const rec = {
      id:            this.editId || App.uid(),
      date,
      type,
      category,
      shift_type:    document.getElementById('vc-shift')?.value || '',
      item,
      amount,
      product_id:    productId,
      product_name:  productName,
      menu_item_id:  menuItemId,
      units,
      staff_id:         serverId,
      server:           (App.staffById(serverId) || {}).name || '',
      authorized_by_id: authBy,
      authorized_by:    (App.staffById(authBy) || {}).name || '',
      check_number:  document.getElementById('vc-check')?.value.trim() || '',
      reason:        document.getElementById('vc-reason')?.value || '',
      notes:         document.getElementById('vc-notes')?.value.trim() || '',
      auth_threshold_override: authThresholdOverride
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.records();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('vc-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'void_comp', saved);
    this.editId = null;
    if (ok) this.renderList();
    else { if (btn) { btn.disabled = false; btn.textContent = 'Save'; } fail('Save failed. Try again.'); }
  },

  async confirmDel(id) {
    const ok = await App.confirm({ title: 'Delete this entry?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;
    await App.removeRecord('sc', 'void_comp', id);
    this.renderList();
  },

  // Paper-at-bar workflow.
  printBlank() {
    App.printBlankSheet({
      title: 'Void / Comp Sheet',
      subtitle: 'Log every void and comp during the shift. Manager enters each row into Bar Cop after close.',
      columns: [
        { label: 'Time',          width: '8%'  },
        { label: 'Type',          width: '10%' },
        { label: 'Item',          width: '20%' },
        { label: 'Amount',        width: '10%' },
        { label: 'Server',        width: '13%' },
        { label: 'Authorized By', width: '13%' },
        { label: 'Reason',        width: '16%' },
        { label: 'Notes',         width: '10%' }
      ],
      rows: 16
    });
  }
};
