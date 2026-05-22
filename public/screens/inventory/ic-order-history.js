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
    if (!str) return '—';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  statusBadge(s) {
    return s === 'Received'
      ? '<span class="badge badge-ok">Received</span>'
      : '<span class="badge badge-dim">Open</span>';
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
        + '<td>' + esc(o.vendor || '—') + '</td>'
        + '<td>' + (o.item_count || (o.line_items ? o.line_items.length : 0)) + '</td>'
        + '<td class="val">' + App.fmtCurrency(o.total || 0) + '</td>'
        + '<td>' + this.statusBadge(o.status) + '</td>'
        + '<td><div class="row-actions">'
        + '<button class="btn btn-danger btn-sm oh-del" data-id="' + o.id + '">Delete</button>'
        + '</div></td></tr>').join('');
      html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Vendor</th><th>Items</th><th>Total</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="oh-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this order?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="oh-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="oh-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      const row = ev.target.closest('.oh-row');
      const del = ev.target.closest('.oh-del');
      const sheet = ev.target.closest('#oh-sheet');
      if (del)        { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (row)   this.renderDetail(row.dataset.id);
      else if (sheet) App.navigate('ic-order-sheet');
    };
  },

  renderDetail(id) {
    const o = this.orders().find(x => x.id === id);
    if (!o) { this.renderList(); return; }

    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="oh-export">Export PDF</button>';
    document.getElementById('oh-export')?.addEventListener('click', () => window.print());

    const rows = (o.line_items || []).map(li => '<tr>'
      + '<td><div class="val">' + esc(li.name) + '</div></td>'
      + '<td>' + (li.qty || 0) + '</td>'
      + '<td>' + App.fmtCurrency(li.unit_cost || 0) + '</td>'
      + '<td class="val">' + App.fmtCurrency(li.extended || 0) + '</td>'
      + '</tr>').join('');

    const received = o.status === 'Received';
    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="oh-back">&#8592; Back to Order History</button></div>'
      + '<div class="card"><div class="card-title">Order &middot; ' + esc(o.vendor || 'Vendor') + ' &middot; ' + this.fmtDate(o.date) + '</div>'
      + '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Vendor</div><div class="calc-val">' + esc(o.vendor || '—') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Line Items</div><div class="calc-val">' + (o.item_count || (o.line_items || []).length) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Order Total</div><div class="calc-val">' + App.fmtCurrency(o.total || 0) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Status</div><div class="calc-val">' + (received ? 'Received' : 'Open') + '</div></div>'
      + '</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Qty</th><th>Unit Cost</th><th>Extended</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<div class="card-actions">'
      + '<button class="btn ' + (received ? 'btn-ghost' : 'btn-primary') + '" id="oh-status">'
      + (received ? 'Reopen Order' : 'Mark Received') + '</button>'
      + (received ? '' : '<button class="btn btn-ghost" id="oh-receive">Log the Delivery</button>')
      + '</div></div></div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#oh-back')) this.renderList();
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

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('oh-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('oh-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('oh-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.inventoryData.ic_orders = this.orders().filter(x => x.id !== delId);
      await App.saveInventory();
      this.renderList();
    };
  }
};
