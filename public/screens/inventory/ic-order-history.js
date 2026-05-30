'use strict';

/* ── Inventory Control — Order History (reads ic_orders) ──────────────────────
   Every order created from the Order Sheet, with its line items, value, and
   status. Orders can be marked received once the delivery arrives, or deleted.
   Detail view exports to PDF. */

S.InventoryOrderHistory = {
  _pendingDelId: null,

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
  statusBadge(s) {
    if (s === 'Received')  return '<span class="badge badge-ok">Received</span>';
    if (s === 'Submitted') return '<span class="badge badge-dim">Submitted</span>';
    return '<span class="badge badge-warn">Open</span>';
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
      const open = orders.filter(o => o.status !== 'Received');
      const totVal = orders.reduce((t, o) => t + (o.total || 0), 0);
      const summary = '<div class="calc" style="margin-bottom:16px;">'
        + '<div class="calc-item"><div class="calc-label">Orders</div><div class="calc-val">' + orders.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Open</div><div class="calc-val">' + open.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Ordered</div><div class="calc-val">' + App.fmtCurrency(totVal) + '</div></div>'
        + '</div>';
      const rows = orders.map(o => '<tr class="oh-row" data-id="' + o.id + '" style="cursor:pointer;">'
        + '<td><div class="val">' + this.fmtDate(o.date) + '</div></td>'
        + '<td>' + esc(o.vendor || '-') + '</td>'
        + '<td>' + (o.item_count || (o.line_items ? o.line_items.length : 0)) + '</td>'
        + '<td class="val">' + App.fmtCurrency(o.total || 0) + '</td>'
        + '<td>' + this.statusBadge(o.status) + '</td>'
        + '<td><div class="row-actions">'
        + '<button class="btn btn-ghost btn-sm oh-view" data-id="' + o.id + '">View</button>'
        + (App.canEdit('ic-order-history') ? '<button class="btn btn-danger btn-sm oh-del" data-id="' + o.id + '">Delete</button>' : '')
        + '</div></td></tr>').join('');
      html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Vendor</th><th>Items</th><th>Total</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.container.onclick = ev => {
      const row = ev.target.closest('.oh-row');
      const view = ev.target.closest('.oh-view');
      const del = ev.target.closest('.oh-del');
      const sheet = ev.target.closest('#oh-sheet');
      if (del)        { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (view)  { ev.stopPropagation(); this.renderDetail(view.dataset.id); }
      else if (row)   this.renderDetail(row.dataset.id);
      else if (sheet) App.navigate('ic-order-sheet');
    };
  },

  renderDetail(id) {
    const o = this.orders().find(x => x.id === id);
    if (!o) { this.renderList(); return; }

    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="oh-export">Export PDF</button>';
    document.getElementById('oh-export')?.addEventListener('click', () => window.print());

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
    const v = this.vendorByName(o.vendor);
    const statusLabel = received ? 'Received' : submitted ? 'Submitted' : 'Open';

    // Build the submit-to-vendor row. Shown when the order is not yet
    // received. Notes when no email is on file so the operator knows the
    // mailto will open without a recipient address.
    const submitRow = !received
      ? '<div style="font-size:11px;color:var(--t3);margin-bottom:8px;">'
        + (v?.email
            ? 'Sends to ' + esc(v.email) + ' from your default email client.'
            : 'No email on file for ' + esc(o.vendor || 'this vendor') + '. The email will still open in your client so you can type the address. Add the vendor email under Vendors to skip this step next time.')
        + (submitted && o.submitted_at
            ? '  &middot;  Last submitted ' + this.fmtDate(o.submitted_at.slice(0, 10))
            : '')
        + '</div>'
      : '';

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="oh-back">&#8592; Back to Order History</button></div>'
      + '<div class="card"><div class="card-title">Order &middot; ' + esc(o.vendor || 'Vendor') + ' &middot; ' + this.fmtDate(o.date) + '</div>'
      + '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Vendor</div><div class="calc-val">' + esc(o.vendor || '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Line Items</div><div class="calc-val">' + (o.item_count || (o.line_items || []).length) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Order Total</div><div class="calc-val">' + App.fmtCurrency(o.total || 0) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Status</div><div class="calc-val">' + statusLabel + '</div></div>'
      + '</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Qty</th><th>Unit Cost</th><th>Extended</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + submitRow
      + '<div class="card-actions">'
      + (App.canEdit('ic-order-history')
          ? ((received ? '' : '<button class="btn btn-primary" id="oh-submit">' + (submitted ? 'Resend to Vendor' : 'Email to Vendor') + '</button>')
             + '<button class="btn btn-ghost" id="oh-status">' + (received ? 'Reopen Order' : 'Mark Received') + '</button>')
          : '')
      + (received ? '' : '<button class="btn btn-ghost" id="oh-receive">Log the Delivery</button>')
      + '</div></div></div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#oh-back')) this.renderList();
      else if (ev.target.closest('#oh-submit')) this.submitToVendor(id);
      else if (ev.target.closest('#oh-status')) this.toggleStatus(id);
      else if (ev.target.closest('#oh-receive')) App.navigate('ic-receive-delivery');
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
