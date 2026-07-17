'use strict';

/* ── Inventory Control — Order History (reads ic_orders) ──────────────────────
   Every order created from the Order Sheet, with its line items, value, and
   status. Orders can be marked received once the delivery arrives, or deleted.
   Detail view exports to PDF. */

S.InventoryOrderHistory = {
  _pendingDelId: null,
  _editOrderId: null,      // order being edited inline in the detail view
  filterPreset: 'last-4',  // active range chip (weekly cadence)
  _prevPreset: 'last-4',
  filterFrom: '',          // custom range only
  filterTo: '',
  RANGE_CHIPS: [
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'last-12', label: 'Last 12 Weeks' }, { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],

  orders() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_orders)) App.inventoryData.ic_orders = [];
    return App.inventoryData.ic_orders;
  },
  sorted() {
    return [...this.orders()].sort(App.cmpNewest);
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  statusText(s) {
    if (s === 'Received')  return '<span style="color:var(--green);font-weight:600;">Received</span>';
    if (s === 'Submitted') return '<span style="color:var(--t2);font-weight:600;">Submitted</span>';
    return '<span style="color:var(--amber);font-weight:700;">Open</span>';
  },

  // Effective window from the active range chip; Custom reads From/To, All clears.
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  // Range chips left, Export right, above the list (the accepted filter model).
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'oh-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><button class="btn btn-ghost btn-sm" id="oh-list-export">Export PDF</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="oh-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="oh-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
  },

  // Find the vendor record matching this order's vendor name. Returns null
  // if no match (operator never set up the vendor in Vendors).
  vendorByName(name) {
    if (!name) return null;
    const vendors = (App.inventoryData && App.inventoryData.ic_vendors) || [];
    return vendors.find(v => v.name === name) || null;
  },

  // Build the email body for a vendor order. Plain text, structured like a
  // real operator's email to their distributor rep. Includes account number
  // and payment terms when on file; falls back gracefully when missing.
  buildEmailBody(order) {
    const barName = (App.data?.settings?.bar_name) || 'Bar Cop User';
    const v = this.vendorByName(order.vendor);
    const lines = [];
    lines.push('Hi' + (v?.rep ? ' ' + v.rep : '') + ',');
    lines.push('');
    lines.push('Please process the following order for ' + barName + '.');
    lines.push('');
    if (v?.account_number) lines.push('Account: ' + v.account_number);
    if (v?.payment_terms)  lines.push('Terms: ' + v.payment_terms);
    if (v?.account_number || v?.payment_terms) lines.push('');
    lines.push('Order date: ' + (order.date || ''));
    lines.push('');
    lines.push('Items');
    lines.push('-----');
    (order.line_items || []).forEach(li => {
      const qty  = li.qty || 0;
      const unit = parseFloat(li.unit_cost || 0).toFixed(2);
      const ext  = parseFloat(li.extended  || 0).toFixed(2);
      const isCase = li.display_unit === 'case';
      lines.push('  ' + (li.name || '(unnamed)') + '  -  ' + qty + (isCase ? ' cases' : '')
        + '  @  $' + unit + (isCase ? '/case' : '') + '  =  $' + ext);
    });
    lines.push('');
    lines.push('Order total: $' + parseFloat(order.total || 0).toFixed(2));
    lines.push('');
    lines.push('Please confirm receipt and let me know your soonest delivery.');
    lines.push('');
    lines.push('Thanks,');
    lines.push(barName);
    return lines.join('\n');
  },

  buildMailto(order) {
    const v = this.vendorByName(order.vendor);
    const to = v?.email || '';
    const barName = (App.data?.settings?.bar_name) || 'Bar Cop User';
    const subj = 'Order from ' + barName + ' - ' + (order.date || '');
    const body = this.buildEmailBody(order);
    return 'mailto:' + encodeURIComponent(to)
      + '?subject=' + encodeURIComponent(subj)
      + '&body='    + encodeURIComponent(body);
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Order History Works', [
      { p: ['Order History is the record of every order you have created. Each row is one order, with its vendor, total, and where it stands, from open to sent to received.'] },
      { h: 'Reading The List', p: ['Each row shows the date, vendor, item count, total, and status. Open means created but not received yet, Submitted means you emailed it from the Order Sheet, and Received means the delivery came in and closed it out. Filter by a date range to focus in.'] },
      { h: 'The Detail View', p: ['Open any order with View to see every line. From there you log the delivery when it arrives, or export a clean copy for your records.'] },
      { h: 'Editing An Order', p: ['Need to fix an open order? Open it with View and hit Edit Order. The order opens right there as an editable list, the same one the Order Sheet uses. Adjust quantities, add an item, or remove a line, then hit Update Order and Bar Cop saves it in place. A received order has to be reopened before you can edit it.'] },
      { h: 'Logging The Delivery', p: ['Hit Log the Delivery and Bar Cop opens Receiving with every line already filled in from your order. Check it against the invoice, flag anything short or overpriced, and save. Bar Cop records the delivery and marks the order Received for you, so there is no separate Mark Received step.'] },
      { h: 'Fixing A Mistake', p: ['Opened an order in error, or marked one received too soon? Reopen Order puts a received order back to open, and you can delete an order you created by mistake.'] }
    ]);
  },

  renderList() {
    this.actions.innerHTML = '';
    this._editOrderId = null;   // leaving the detail clears any inline edit
    const all = this.sorted();

    if (all.length === 0) {
      App.setupCard(this.container, {
        title: 'Order History',
        lead: 'Order History lists every order you create, with line items, value, and status, so you always have a paper trail.',
        steps: [
          { title: 'Create your first order', desc: 'Orders you create on the Order Sheet show up here. Create one to get started.', btn: 'Go to Order Sheet', screen: 'ic-order-sheet', done: false }
        ]
      });
      return;
    }

    const { from, to } = this.effectiveRange();
    const filtered = all.filter(o =>
      (!from || (o.date || '') >= from) && (!to || (o.date || '') <= to));

    const openOrders = all.filter(o => o.status !== 'Received');
    const openValue = openOrders.reduce((s, o) => s + (o.total || 0), 0);
    const last = all[0];

    const statsCard = '<div class="card"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">'
      + '<div style="flex:1;display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Orders</div><div class="calc-val lg">' + all.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Open</div><div class="calc-val lg">' + openOrders.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Open Value</div><div class="calc-val lg">' + App.fmtCurrency(openValue) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Last Order</div><div class="calc-val lg">' + this.fmtDate(last.date) + '</div></div>'
      + '</div></div></div>';

    const rows = filtered.slice(0, App.listLimit('ic', 'order')).map(o => '<tr class="oh-row" data-id="' + o.id + '" style="cursor:pointer;">'
      + '<td><div class="val">' + this.fmtDate(o.date) + '</div></td>'
      + '<td>' + esc(o.vendor || '-') + '</td>'
      + '<td>' + (o.item_count || (o.line_items ? o.line_items.length : 0)) + '</td>'
      + '<td class="val">' + App.fmtCurrency(o.total || 0) + '</td>'
      + '<td>' + this.statusText(o.status) + '</td>'
      + '<td><div class="row-actions">'
      + '<button class="btn btn-ghost btn-sm oh-view" data-id="' + o.id + '">View</button>'
      + (App.canEdit('ic-order-history') ? '<button class="btn btn-danger btn-sm oh-del" data-id="' + o.id + '">Delete</button>' : '')
      + '</div></td></tr>').join('');
    const listCard = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Date</th><th>Vendor</th><th>Items</th><th>Total</th><th>Status</th><th></th>'
      + '</tr></thead><tbody>' + (rows || '<tr><td colspan="6" style="color:var(--t3);padding:12px 8px;">No orders in this range. Pick a wider range above.</td></tr>') + '</tbody></table></div>'
      + App.showOlderBar('ic', 'order', filtered, this.filterPreset !== 'all');

    this.container.innerHTML = '<div class="screen">' + statsCard + this.filterRow() + listCard + '</div>';
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const chip = ev.target.closest('.oh-range-chip');
      if (chip) {
        const v = chip.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.renderList();
        return;
      }
      if (ev.target.closest('#oh-list-export')) { this.exportList(); return; }
      const row = ev.target.closest('.oh-row');
      const view = ev.target.closest('.oh-view');
      const del = ev.target.closest('.oh-del');
      if (del)        { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (view)       { ev.stopPropagation(); const id = view.dataset.id; App.pushView(() => this.renderDetail(id)); return; }
      if (row)        { const id = row.dataset.id; App.pushView(() => this.renderDetail(id)); return; }
    };
    document.getElementById('oh-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('oh-to')?.addEventListener('change', e => { this.filterTo = e.target.value || ''; this.renderList(); });
  },

  // Export the COMPLETE order list to PDF (every order, not just the on-screen
  // window, which paginates via Show older). Built from an off-screen node.
  exportList() {
    const all = this.sorted();
    if (all.length === 0) return;
    const statusPlain = s => s === 'Received' ? 'Received' : s === 'Submitted' ? 'Submitted' : 'Open';
    const rows = all.map(o => '<tr><td>' + this.fmtDate(o.date) + '</td>'
      + '<td>' + esc(o.vendor || '-') + '</td>'
      + '<td>' + (o.item_count || (o.line_items ? o.line_items.length : 0)) + '</td>'
      + '<td>' + App.fmtCurrency(o.total || 0) + '</td>'
      + '<td>' + statusPlain(o.status) + '</td></tr>').join('');
    const node = document.createElement('div');
    node.className = 'screen';
    node.style.cssText = 'position:absolute;left:-99999px;top:0;';
    node.innerHTML = '<div class="card"><div class="card-title">Order History</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Vendor</th><th>Items</th><th>Total</th><th>Status</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    document.body.appendChild(node);
    Promise.resolve(App.exportPDF({ title: 'Order History', root: node })).finally(() => node.remove());
  },

  // Build a single-order PDF that reads as a purchase order, from the order
  // DATA (not a DOM-walk of a rendered screen) so it can be called from
  // anywhere — the Order Sheet status card calls this too. One canonical
  // order PDF; both doors come through here.
  exportOrderPDF(order) {
    if (!order) return;
    const v = this.vendorByName(order.vendor);
    const statusPlain = order.status === 'Received' ? 'Received'
      : order.status === 'Submitted' ? 'Submitted' : 'Open';

    const kv = (label, val) => '<div class="calc-item"><div class="calc-label">' + label
      + '</div><div class="calc-val">' + val + '</div></div>';
    const headerKV = [
      kv('Vendor', esc(order.vendor || '-')),
      (v && v.rep)            ? kv('Contact', esc(v.rep)) : '',
      (v && v.account_number) ? kv('Account', esc(v.account_number)) : '',
      (v && v.payment_terms)  ? kv('Terms', esc(v.payment_terms)) : '',
      kv('Order Date', this.fmtDate(order.date)),
      kv('Status', statusPlain)
    ].filter(Boolean).join('');

    const rows = (order.line_items || []).map(li => {
      const isCase = li.display_unit === 'case';
      return '<tr><td>' + esc(li.name || '') + '</td>'
        + '<td>' + (li.qty || 0) + (isCase ? ' cases' : '') + '</td>'
        + '<td>' + App.fmtCurrency(li.unit_cost || 0) + (isCase ? ' /case' : '') + '</td>'
        + '<td>' + App.fmtCurrency(li.extended || 0) + '</td></tr>';
    }).join('');

    const node = document.createElement('div');
    node.className = 'screen';
    node.style.cssText = 'position:absolute;left:-99999px;top:0;';
    node.innerHTML = '<div class="card"><div class="card-title">Purchase Order</div>'
      + '<div class="calc" style="margin-bottom:14px;">' + headerKV + '</div>'
      + '<div class="sh">Order Items</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Qty</th><th>Unit Cost</th><th>Extended</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<div class="calc" style="margin-top:14px;">' + kv('Order Total', App.fmtCurrency(order.total || 0)) + '</div>'
      + '</div>';
    document.body.appendChild(node);
    Promise.resolve(App.exportPDF({
      title: 'Purchase Order',
      subtitle: order.vendor || '',
      fileTag: 'PurchaseOrder_' + (order.vendor || 'Order'),
      root: node
    })).finally(() => node.remove());
  },

  renderDetail(id) {
    const o = this.orders().find(x => x.id === id);
    if (!o) { this.renderList(); return; }
    if (this._editOrderId && this._editOrderId !== id) this._editOrderId = null;
    const editing = this._editOrderId === id;

    this.actions.innerHTML = '';

    const meta = (label, val) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val">' + val + '</div></div>';

    // Saved-snapshot header (vendor/date/status stay put; the editable card below
    // carries its own live line-item count + total while you edit).
    const metaCard = '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
      + '<div style="flex:1;display:flex;gap:28px;align-items:center;flex-wrap:wrap;min-width:0;">'
      + meta('Vendor', esc(o.vendor || '-'))
      + meta('Order Date', this.fmtDate(o.date))
      + meta('Line Items', o.item_count || (o.line_items || []).length)
      + meta('Order Total', App.fmtCurrency(o.total || 0))
      + meta('Status', this.statusText(o.status))
      + '</div>'
      + '</div></div>';

    let body;
    if (editing) {
      // Reuse the Order Sheet's editable vendor card verbatim — no second editor.
      body = '<div class="sh" style="margin:24px 0 10px;">Editing Order</div>'
        + S.InventoryOrderSheet.editVendorCardHTML(o);
    } else {
      const rows = (o.line_items || []).map(li => {
        const isCase = li.display_unit === 'case';
        return '<tr>'
          + '<td><div class="val">' + esc(li.name) + '</div></td>'
          + '<td>' + (li.qty || 0) + (isCase ? ' cases' : '') + '</td>'
          + '<td>' + App.fmtCurrency(li.unit_cost || 0) + (isCase ? '<div style="font-size:9px;color:var(--t3);">per case</div>' : '') + '</td>'
          + '<td class="val">' + App.fmtCurrency(li.extended || 0) + '</td>'
          + '</tr>';
      }).join('');

      const received = o.status === 'Received';
      // Open orders close by logging the delivery (which runs the receiving
      // verification and auto-marks Received). Received orders can be reopened.
      // An open order can also be edited in place here, or canceled.
      const actionBtns = App.canEdit('ic-order-history')
        ? (received
            ? '<button class="btn btn-ghost" id="oh-reopen">Reopen Order</button>'
            : '<button class="btn btn-primary" id="oh-log">Log the Delivery</button>'
              + '<button class="btn btn-ghost" id="oh-email">' + (o.status === 'Open' ? 'Email to Vendor' : 'Resend') + '</button>'
              + '<button class="btn btn-ghost" id="oh-edit">Edit Order</button>'
              + '<button class="btn btn-ghost" id="oh-cancel" style="color:var(--red);">Cancel Order</button>')
        : '';

      body = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
        + '<div class="sh" style="margin:0;">' + esc(o.vendor || 'Order') + ' &middot; ' + this.fmtDate(o.date) + '</div>'
        + '<div style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" id="oh-export">Export PDF</button></div></div>'
        + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Product</th><th>Qty</th><th>Unit Cost</th><th>Extended</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + (actionBtns ? '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">' + actionBtns + '</div>' : '');
    }

    this.container.innerHTML = '<div class="screen">' + metaCard + body + '</div>';

    this.container.onclick = ev => {
      if (editing) {
        const card = this.container.querySelector('.os-vcard');
        if (ev.target.closest('.os-add-item')) { S.InventoryOrderSheet.addBlankLine(card); return; }
        const rm = ev.target.closest('.os-remove');
        if (rm) { const c = rm.closest('.os-vcard'); rm.closest('.os-line').remove(); S.InventoryOrderSheet.recalcVendor(c); return; }
        if (ev.target.closest('.os-par-nudge')) { App.navigate('ic-par-suggestions'); return; }
        if (ev.target.closest('.os-update')) { this.saveInlineEdit(id); return; }
        if (ev.target.closest('.os-editcancel')) { this._editOrderId = null; this.renderDetail(id); return; }
        return;
      }
      if (ev.target.closest('#oh-export')) { this.exportOrderPDF(o); return; }
      if (ev.target.closest('#oh-reopen')) { this.toggleStatus(id); return; }
      if (ev.target.closest('#oh-log')) {
        S.InventoryReceiveDelivery._pendingOrderId = id;
        App.navigate('ic-receive-delivery');
        return;
      }
      if (ev.target.closest('#oh-edit')) { this._editOrderId = id; this.renderDetail(id); return; }
      if (ev.target.closest('#oh-email')) { this.emailOrder(id); return; }
      if (ev.target.closest('#oh-cancel')) { this.cancelOrder(id); return; }
    };

    // Wire the editable card's live inputs (qty recalc + in-row product pick) to
    // the Order Sheet's own helpers, scoped to this container.
    if (editing) {
      const card = this.container.querySelector('.os-vcard');
      if (card) {
        card.addEventListener('input', ev => { if (ev.target.classList.contains('os-qty')) S.InventoryOrderSheet.recalcVendor(card); });
        card.addEventListener('change', ev => { if (ev.target.classList.contains('os-prod')) S.InventoryOrderSheet.onLineProductChange(ev.target); });
        S.InventoryOrderSheet.recalcVendor(card);
      }
    }
  },

  // Save the inline edit via the Order Sheet's canonical write-back, then drop
  // back to the read-only detail with the fresh numbers in place.
  async saveInlineEdit(id) {
    const o = this.orders().find(x => x.id === id);
    if (!o) { this._editOrderId = null; this.renderDetail(id); return; }
    const card = this.container.querySelector('.os-vcard');
    if (!card) return;
    const row = this.container.querySelector('.os-create-row');
    const err = row ? row.querySelector('.os-verr') : null;
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (err) { err.textContent = ''; err.style.display = 'none'; }
    const btn = row ? row.querySelector('.os-update') : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const res = await S.InventoryOrderSheet.saveOrderEdit(o, card);
    if (res.empty) { if (btn) { btn.disabled = false; btn.textContent = 'Update Order'; } fail('Set an order quantity above zero first.'); return; }
    if (res.ok) {
      this._editOrderId = null;
      this.renderDetail(id);
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Update Order'; }
      fail('Could not update the order. Try again.');
    }
  },

  // Email a placed order to the vendor (same body as the Order Sheet uses). An
  // Open order is marked Submitted on send, so the button becomes Resend.
  async emailOrder(id) {
    const o = this.orders().find(x => x.id === id);
    if (!o) return;
    window.location.href = this.buildMailto(o);
    if (o.status === 'Open') {
      o.status = 'Submitted';
      o.submitted_at = new Date().toISOString();
      await App.putRecord('ic', 'order', o);
      this.renderDetail(id);
    }
  },

  // Cancel a placed order: remove it; the vendor returns to the Order Sheet so
  // it can be reordered. Same soft confirm as the Order Sheet ⋯ menu.
  async cancelOrder(id) {
    const o = this.orders().find(x => x.id === id);
    if (!o) return;
    const ok = await App.confirm({
      title: 'Cancel this order?',
      message: 'This removes the ' + (o.vendor || '') + ' order'
        + (o.total ? ' for ' + App.fmtCurrency(o.total) : '')
        + '. Those items return to your Order Sheet so you can reorder. This cannot be undone.',
      confirmText: 'Cancel Order',
      cancelText: 'Keep Order',
      danger: true
    });
    if (!ok) return;
    await App.removeRecord('ic', 'order', id);
    App.goBack();
  },

  async toggleStatus(id) {
    const o = this.orders().find(x => x.id === id);
    if (!o) return;
    o.status = o.status === 'Received' ? 'Open' : 'Received';
    o.received_at = o.status === 'Received' ? new Date().toISOString() : null;
    await App.putRecord('ic', 'order', o);
    this.renderDetail(id);
  },

  async confirmDel(id) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    await App.removeRecord('ic', 'order', id);
    this.renderList();
  }
};
