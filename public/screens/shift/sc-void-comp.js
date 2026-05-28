'use strict';

/* ── Shift Control — Void and Comp Log (writes sc_void_comps) ─────────────────
   Mobile-first. Logs voided and comped items during service. Voids and comps
   are exception transactions — sc_void_comps feeds Profit Recovery's Theft Risk
   and the Profit Audit's exception analysis. */

S.ShiftVoidComp = {
  editId: null,
  _pendingDelId: null,
  REASONS: {
    Void: ['Rung in error', 'Wrong item', 'Customer changed mind', 'Kitchen error', 'Sent back', 'Other'],
    Comp: ['Service recovery', 'Manager comp', 'Regular / VIP', 'Marketing / promo', 'Other']
  },
  // Categories on Comp records. A 30-year operator separates loss (a comp
  // given to fix a guest issue) from policy expense (a staff meal eaten, a
  // shift drink poured under house rules). Conflating them inflates the
  // Theft Risk score and lies to the P&L. Default = Customer Comp.
  // Loss categories feed Theft Risk; expense categories are tracked as
  // separate cost lines in Books and Year-End.
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
  productOptions(selectedId) {
    const prods = this.products();
    const cats = [...new Set(prods.map(p => p.category || 'Other'))]
      .sort((a, b) => {
        const order = ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
        const ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    let h = '<option value="">Not linked to a tracked product</option>';
    cats.forEach(cat => {
      h += '<optgroup label="' + esc(cat) + '">';
      prods.filter(p => (p.category || 'Other') === cat)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .forEach(p => {
          h += '<option value="' + p.id + '"' + (selectedId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>';
        });
      h += '</optgroup>';
    });
    return h;
  },
  shiftTypes() {
    return App.SHIFT_TYPES;
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = 'Log Void / Comp';
    addBtn.addEventListener('click', () => this.showForm());
    actions.appendChild(addBtn);
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-ghost btn-sm';
    exportBtn.textContent = 'Export PDF';
    exportBtn.addEventListener('click', () => window.print());
    actions.appendChild(exportBtn);
    const printBlankBtn = document.createElement('button');
    printBlankBtn.className = 'btn btn-ghost btn-sm';
    printBlankBtn.textContent = 'Print Blank Sheet';
    printBlankBtn.addEventListener('click', () => this.printBlank());
    actions.appendChild(printBlankBtn);
    this.renderList();
  },

  // Paper-at-bar workflow. Managers commonly clip a void/comp sheet to the
  // POS, tally as the night runs, then enter into Bar Cop after close.
  printBlank() {
    App.printBlankSheet({
      title: 'Void / Comp Sheet',
      subtitle: 'Log every void and comp during the shift. Manager enters each row into Bar Cop after close.',
      columns: [
        { label: 'Time',         width: '8%'  },
        { label: 'Type',         width: '10%' },
        { label: 'Item',         width: '20%' },
        { label: 'Amount',       width: '10%' },
        { label: 'Server',       width: '13%' },
        { label: 'Authorized By',width: '13%' },
        { label: 'Reason',       width: '16%' },
        { label: 'Notes',        width: '10%' }
      ],
      rows: 16
    });
  },

  renderList() {
    const recs = [...this.records()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

    let html;
    if (recs.length === 0) {
      html = '<div class="empty"><div class="empty-title">No voids or comps logged yet</div>'
        + '<div class="empty-sub">Log every voided and comped item. These exception transactions feed '
        + 'your Theft Risk score and exception analysis in Profit Recovery.</div>'
        + '<button class="btn btn-primary" id="vc-add-first">Log Void / Comp</button></div>';
    } else {
      const voids = recs.filter(r => r.type === 'Void');
      const comps = recs.filter(r => r.type === 'Comp');
      const voidTot = voids.reduce((t, r) => t + (r.amount || 0), 0);
      const compTot = comps.reduce((t, r) => t + (r.amount || 0), 0);
      const summary = '<div class="calc" style="margin-bottom:16px;">'
        + '<div class="calc-item"><div class="calc-label">Voids</div><div class="calc-val">' + voids.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Void Total</div><div class="calc-val warn">' + App.fmtCurrency(voidTot) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Comps</div><div class="calc-val">' + comps.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Comp Total</div><div class="calc-val warn">' + App.fmtCurrency(compTot) + '</div></div>'
        + '</div>';
      const rows = recs.map(r => {
        const badge = r.type === 'Void'
          ? '<span class="badge badge-warn">Void</span>'
          : '<span class="badge badge-dim">Comp</span>';
        return '<tr class="vc-row" data-id="' + r.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(r.date) + '</div></td>'
          + '<td>' + badge + '</td>'
          + '<td>' + esc(r.item || '-') + '</td>'
          + '<td class="val">' + App.fmtCurrency(r.amount || 0) + '</td>'
          + '<td>' + esc(r.server || '-') + '</td>'
          + '<td>' + esc(r.authorized_by || '-') + '</td>'
          + '<td>' + esc(r.reason || '-') + '</td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('sc-void-comp') ? '<button class="btn btn-ghost btn-sm vc-edit" data-id="' + r.id + '">Edit</button>' : '')
          + (App.canEdit('sc-void-comp') ? '<button class="btn btn-danger btn-sm vc-del" data-id="' + r.id + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');
      html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Type</th><th>Item</th><th>Amount</th><th>Server</th>'
        + '<th>Authorized By</th><th>Reason</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="vc-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this entry?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="vc-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="vc-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      const row = ev.target.closest('.vc-row');
      const edit = ev.target.closest('.vc-edit');
      const del = ev.target.closest('.vc-del');
      const addF = ev.target.closest('#vc-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row && App.canEdit('sc-void-comp')) this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
  },

  reasonOptions(type, selected) {
    return '<option value="">Select reason...</option>'
      + (this.REASONS[type] || []).map(r =>
          '<option' + (r === selected ? ' selected' : '') + '>' + r + '</option>').join('');
  },

  categoryOptions(selected) {
    // Default to Customer Comp when no category is set (the common case for
    // a comp filed without thought). Voids don't carry categories.
    const sel = selected || 'Customer Comp';
    return this.CATEGORIES.map(c =>
      '<option' + (c === sel ? ' selected' : '') + '>' + c + '</option>').join('');
  },

  showForm(id) {
    if (id && !App.canEdit('sc-void-comp')) return;
    this.editId = id || null;
    const r = id ? this.records().find(x => x.id === id) : null;
    const type = (r && r.type) || 'Void';
    const typeOpts = ['Void', 'Comp'].map(t =>
      '<option' + (type === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const shiftOpts = this.shiftTypes().map(t =>
      '<option' + (r && r.shift_type === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const v = val => (val != null && val !== '') ? val : '';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'Log') + ' Void / Comp</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="vc-date" value="' + esc(r?.date || new Date().toISOString().slice(0, 10)) + '" style="height:44px;"/></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Type</label>'
      + '<select id="vc-type" style="height:44px;">' + typeOpts + '</select></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Shift Type</label>'
      + '<select id="vc-shift" style="height:44px;">' + shiftOpts + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="flex:1;min-width:180px;"><label>Item</label>'
      + '<input type="text" id="vc-item" list="vc-item-list" value="' + esc(r?.item || '') + '" placeholder="Pick a menu item or type the name" style="height:44px;"/>'
      + '<datalist id="vc-item-list">'
      + (((App.menuItems && App.menuItems()) || [])
          .slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          .map(m => '<option value="' + esc(m.name || '') + '"></option>').join(''))
      + '</datalist>'
      + '</div>'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>Amount</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="vc-amount" min="0" step="0.01" '
      + 'inputmode="decimal" value="' + v(r?.amount) + '" style="height:44px;font-size:16px;"/></div></div>'
      + '</div>'

      // Linked product + units. Comps with a linked product subtract those
      // units from the Inventory Variance Report "used" total so a known
      // comp does not show up as a theft signal. Voids stay logged but do
      // not subtract from variance (assumption: voided drinks were not
      // poured). Linking a void is still useful for theft analytics.
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="flex:1;min-width:240px;"><label>Linked Product <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
      + '<select id="vc-product" style="height:44px;">' + this.productOptions(r?.product_id) + '</select></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Units</label>'
      + '<input type="number" id="vc-units" min="0" step="0.01" inputmode="decimal" value="' + v(r?.units != null ? r.units : (r ? '' : 1)) + '" placeholder="1" style="height:44px;font-size:16px;"/></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Server</label>'
      + '<select id="vc-server" style="height:44px;">' + App.staffOptions(r?.staff_id || r?.server, { placeholder: 'Select staff...' }) + '</select></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Authorized By</label>'
      + '<select id="vc-auth" style="height:44px;">' + App.staffOptions(r?.authorized_by_id || r?.authorized_by, { placeholder: 'Select manager...' }) + '</select></div>'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>Check #</label>'
      + '<input type="text" id="vc-check" value="' + esc(r?.check_number || '') + '" placeholder="Optional" style="height:44px;"/></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:200px;flex-shrink:0;" id="vc-cat-wrap"><label>Category</label>'
      + '<select id="vc-cat" style="height:44px;">' + this.categoryOptions(r?.category) + '</select>'
      + '<div style="font-size:10px;color:var(--t3);margin-top:4px;line-height:1.4;">Staff Meal and Shift Drink are policy expense, not theft signals. Customer Comp and Service Recovery feed Theft Risk.</div></div>'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Reason</label>'
      + '<select id="vc-reason" style="height:44px;">' + this.reasonOptions(type, r?.reason) + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="vc-notes" rows="2" placeholder="Optional">' + esc(r?.notes || '') + '</textarea></div></div>'

      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="vc-save">' + (id ? 'Update' : 'Save') + '</button>'
      + '<button class="btn btn-ghost" id="vc-cancel">Cancel</button>'
      + '<span id="vc-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('vc-type')?.addEventListener('change', e => {
      const sel = document.getElementById('vc-reason');
      if (sel) sel.innerHTML = this.reasonOptions(e.target.value, '');
      // Category only applies to Comp records — hide for Voids.
      const catWrap = document.getElementById('vc-cat-wrap');
      if (catWrap) catWrap.style.display = e.target.value === 'Void' ? 'none' : '';
    });
    // Sync category visibility on initial render too.
    const catWrap = document.getElementById('vc-cat-wrap');
    if (catWrap) catWrap.style.display = type === 'Void' ? 'none' : '';
    document.getElementById('vc-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('vc-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const err = document.getElementById('vc-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('vc-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const item = document.getElementById('vc-item')?.value.trim();
    if (!item) { fail('Item is required.'); return; }
    const amount = parseFloat(document.getElementById('vc-amount')?.value);
    if (isNaN(amount) || amount < 0) { fail('Enter the amount.'); return; }

    const productId = document.getElementById('vc-product')?.value || '';
    const product = productId ? this.productById(productId) : null;
    const unitsRaw = parseFloat(document.getElementById('vc-units')?.value);
    const units = isNaN(unitsRaw) ? null : unitsRaw;

    const type = document.getElementById('vc-type')?.value || 'Void';
    const authBy = document.getElementById('vc-auth')?.value || '';

    // Comp authorization threshold check. If this is a Comp over the operator's
    // set threshold and no manager is in the Authorized By field, pop a soft
    // warning. Operator can override (and the override gets logged as a Theft
    // Risk signal — the bartender comping a $40 round of drinks without
    // manager involvement is one of the most common bar-theft patterns).
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
    // Category only applies to Comps. Voids stay un-categorized. Default to
    // Customer Comp when category dropdown is empty (legacy records will read
    // as Customer Comp via the same default downstream).
    const category = type === 'Comp'
      ? (document.getElementById('vc-cat')?.value || 'Customer Comp')
      : '';
    const rec = {
      id:            this.editId || App.uid(),
      date,
      type,
      category,
      shift_type:    document.getElementById('vc-shift')?.value || '',
      item,
      amount,
      product_id:    productId,
      product_name:  product?.name || '',
      units,
      staff_id:         document.getElementById('vc-server')?.value || '',
      server:           (App.staffById(document.getElementById('vc-server')?.value) || {}).name || '',
      authorized_by_id: authBy,
      authorized_by:    (App.staffById(authBy) || {}).name || '',
      check_number:  document.getElementById('vc-check')?.value.trim() || '',
      reason:        document.getElementById('vc-reason')?.value || '',
      notes:         document.getElementById('vc-notes')?.value.trim() || '',
      auth_threshold_override: authThresholdOverride
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.records();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('vc-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveShift();
    this.editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
      fail('Save failed. Try again.');
    }
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('vc-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('vc-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('vc-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.shiftData.sc_void_comps = this.records().filter(x => x.id !== delId);
      await App.saveShift();
      this.renderList();
    };
  }
};
