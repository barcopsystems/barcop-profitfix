'use strict';

/* ── Inventory Control — Order History (reads ic_orders) ──────────────────────
   Every order created from the Order Sheet, with its line items, value, and
   status. Orders can be marked received once the delivery arrives, or deleted.
   Detail view exports to PDF. */

S.InventoryOrderHistory = {
  _pendingDelId: null,
  vendorFilter: '',

  orders() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_orders)) App.inventoryData.ic_orders = [];
    return App.inventoryData.ic_orders;
  },
  sorted() {
    return [...this.orders()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  statusText(s) {
    if (s === 'Received')  return '<span style="color:var(--green);font-weight:600;">Received</span>';
    if (s === 'Submitted') return '<span style="color:var(--steel);font-weight:600;">Submitted</span>';
    return '<span style="color:var(--gold);font-weight:700;">Open</span>';
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

  async submitToVendor(id) {
    const o = this.orders().find(x => x.id === id);
    if (!o) return;
    window.location.href = this.buildMailto(o);
    // Mark Submitted right after opening the mailto. If the operator never
    // hits Send in their email client they can toggle the status back via
    // the Reopen / Mark Received buttons later.
    o.status = 'Submitted';
    o.submitted_at = new Date().toISOString();
    await App.saveInventory();
    this.renderDetail(id);
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Order History Works', [
      { p: ['Order History is the record of every order you have created. Each row is one order, with its vendor, total, and where it stands, from open to sent to received.'] },
      { h: 'Reading The List', p: ['Each row shows the date, vendor, item count, total, and status. Open means created but not sent yet, Submitted means you emailed it to the vendor, and Received means the delivery came in and closed it out. Filter by vendor to focus on one distributor.'] },
      { h: 'The Detail View', p: ['Open any order with View to see every line, then email it to the vendor, mark it received by hand, or jump straight to Receive Delivery to log what showed up.'] },
      { h: 'Emailing The Vendor', p: ['Email to Vendor opens your email client with the order already written out and addressed to the vendor on file. Send it, and Bar Cop marks the order Submitted. You can edit anything in the email before you send it.'] },
      { h: 'Closing It Out', p: ['When you receive a delivery against an order, Bar Cop marks the order Received for you. You can also flip the status by hand here, or delete an order you created by mistake.'] }
    ]);
  },

  renderList() {
    this.actions.innerHTML = '';
    const orders = this.sorted();

    let html;
    if (orders.length === 0) {
      html = '<div class="empty"><div class="empty-title">No orders yet</div>'
        + '<div class="empty-sub">Orders you create on the Order Sheet are listed here, with line items, '
        + 'value, and status.</div>'
        + '<button class="btn btn-primary" id="oh-sheet">Go to Order Sheet</button></div>';
    } else {
      const vendors = [...new Set(orders.map(o => o.vendor).filter(Boolean))].sort();
      const filtered = this.vendorFilter ? orders.filter(o => o.vendor === this.vendorFilter) : orders;
      const filter = '<div class="form-row" style="margin-bottom:14px;"><div class="f" style="width:280px;">'
        + '<label>Filter by Vendor</label><select id="oh-filter">'
        + '<option value="">All vendors</option>'
        + vendors.map(v => '<option value="' + esc(v) + '"' + (this.vendorFilter === v ? ' selected' : '') + '>' + esc(v) + '</option>').join('')
        + '</select></div></div>';
      const rows = filtered.map(o => '<tr class="oh-row" data-id="' + o.id + '" style="cursor:pointer;">'
        + '<td><div class="val">' + this.fmtDate(o.date) + '</div></td>'
        + '<td>' + esc(o.vendor || '-') + '</td>'
        + '<td>' + (o.item_count || (o.line_items ? o.line_items.length : 0)) + '</td>'
        + '<td class="val">' + App.fmtCurrency(o.total || 0) + '</td>'
        + '<td>' + this.statusText(o.status) + '</td>'
        + '<td><div class="row-actions">'
        + '<button class="btn btn-ghost btn-sm oh-view" data-id="' + o.id + '">View</button>'
        + (App.canEdit('ic-order-history') ? '<button class="btn btn-danger btn-sm oh-del" data-id="' + o.id + '">Delete</button>' : '')
        + '</div></td></tr>').join('');
      html = '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
        + '<span>Order History</span>'
        + '<button class="btn btn-ghost btn-sm" id="oh-how">How This Works</button></div>'
        + filter
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Vendor</th><th>Items</th><th>Total</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + (rows || '<tr><td colspan="6" style="color:var(--t3);">No orders for this vendor.</td></tr>') + '</tbody></table></div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.container.onclick = ev => {
      const how = ev.target.closest('#oh-how');
      const row = ev.target.closest('.oh-row');
      const view = ev.target.closest('.oh-view');
      const del = ev.target.closest('.oh-del');
      const sheet = ev.target.closest('#oh-sheet');
      if (how)        { this.showHowTo(); return; }
      if (del)        { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (view)       { ev.stopPropagation(); this.renderDetail(view.dataset.id); return; }
      if (row)        { this.renderDetail(row.dataset.id); return; }
      if (sheet) App.navigate('ic-order-sheet');
    };
    document.getElementById('oh-filter')?.addEventListener('change', e => {
      this.vendorFilter = e.target.value || '';
      this.renderList();
    });
  },

  renderDetail(id) {
    const o = this.orders().find(x => x.id === id);
    if (!o) { this.renderList(); return; }

    this.actions.innerHTML = '';

    const rows = (o.line_items || []).map(li => {
      const isCase = li.display_unit === 'case';
      return '<tr>'
        + '<td><div class="val">' + esc(li.name) + '</div></td>'
        + '<td>' + (li.qty || 0) + (isCase ? ' cases' : '') + '</td>'
        + '<td>' + App.fmtCurrency(li.unit_cost || 0) + (isCase ? '<div style="font-size:9px;color:var(--t3);">per case</div>' : '') + '</td>'
        + '<td class="val">' + App.fmtCurrency(li.extended || 0) + '</td>'
        + '</tr>';
    }).join('');

    const received  = o.status === 'Received';
    const submitted = o.status === 'Submitted';
    const statusLabel = received ? 'Received' : submitted ? 'Submitted' : 'Open';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Order &middot; ' + esc(o.vendor || 'Vendor') + ' &middot; ' + this.fmtDate(o.date) + '</span>'
      + '<button class="btn btn-ghost btn-sm" id="oh-export">Export PDF</button></div>'
      + '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Vendor</div><div class="calc-val">' + esc(o.vendor || '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Line Items</div><div class="calc-val">' + (o.item_count || (o.line_items || []).length) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Order Total</div><div class="calc-val">' + App.fmtCurrency(o.total || 0) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Status</div><div class="calc-val">' + statusLabel + '</div></div>'
      + '</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Qty</th><th>Unit Cost</th><th>Extended</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<div class="card-actions">'
      + (App.canEdit('ic-order-history')
          ? ((received ? '' : '<button class="btn btn-primary" id="oh-submit">' + (submitted ? 'Resend to Vendor' : 'Email to Vendor') + '</button>')
             + '<button class="btn btn-ghost" id="oh-status">' + (received ? 'Reopen Order' : 'Mark Received') + '</button>')
          : '')
      + (received ? '' : '<button class="btn btn-ghost" id="oh-receive">Log the Delivery</button>')
      + '</div></div></div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#oh-export')) { window.print(); return; }
      if (ev.target.closest('#oh-submit')) { this.submitToVendor(id); return; }
      if (ev.target.closest('#oh-status')) { this.toggleStatus(id); return; }
      if (ev.target.closest('#oh-receive')) { App.navigate('ic-receive-delivery'); return; }
    };
  },

  async toggleStatus(id) {
    const o = this.orders().find(x => x.id === id);
    if (!o) return;
    o.status = o.status === 'Received' ? 'Open' : 'Received';
    o.received_at = o.status === 'Received' ? new Date().toISOString() : null;
    await App.saveInventory();
    this.renderDetail(id);
  },

  async confirmDel(id) {
    const ok = await App.confirm({ title: 'Delete this order?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;
    App.inventoryData.ic_orders = this.orders().filter(x => x.id !== id);
    await App.saveInventory();
    this.renderList();
  }
};
