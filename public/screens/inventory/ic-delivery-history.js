'use strict';

/* ── Inventory Control — Delivery History (reads ic_deliveries) ───────────────
   Every recorded delivery with a discrepancy flag for price changes, a full
   line-item detail view, and print-to-PDF export. */

S.InventoryDeliveryHistory = {
  vendorFilter: '',

  deliveries() {
    return ((App.inventoryData && App.inventoryData.ic_deliveries) || []);
  },
  sorted() {
    return [...this.deliveries()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
  },
  fmtDate(str) {
    if (!str) return '—';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // ── Entry ─────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  renderList() {
    this.actions.innerHTML = '';
    const all = this.sorted();
    const filtered = this.vendorFilter ? all.filter(d => d.vendor === this.vendorFilter) : all;

    let html;
    if (all.length === 0) {
      html = '<div class="empty"><div class="empty-title">No deliveries yet</div>'
        + '<div class="empty-sub">Deliveries you record in Receive Delivery are listed here, '
        + 'with totals and price-change discrepancy flags.</div>'
        + '<button class="btn btn-primary" id="dh-receive">Receive Delivery</button></div>';
    } else {
      const vendors = [...new Set(all.map(d => d.vendor).filter(Boolean))].sort();
      const filter = '<div class="form-row" style="margin-bottom:14px;"><div class="f" style="width:240px;">'
        + '<label>Filter by Vendor</label><select id="dh-filter">'
        + '<option value="">All vendors</option>'
        + vendors.map(v => '<option value="' + esc(v) + '"' + (this.vendorFilter === v ? ' selected' : '') + '>' + esc(v) + '</option>').join('')
        + '</select></div></div>';

      const rows = filtered.map(d => {
        const disc = d.has_discrepancy
          ? '<span class="badge badge-warn">' + (d.price_change_count || 1) + ' Price Change' + ((d.price_change_count || 1) === 1 ? '' : 's') + '</span>'
          : '<span class="badge badge-dim">Clean</span>';
        return '<tr class="dh-row" data-id="' + d.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(d.date) + '</div></td>'
          + '<td>' + esc(d.vendor || '—') + '</td>'
          + '<td>' + esc(d.invoice_number || '—') + '</td>'
          + '<td>' + (d.item_count || (d.line_items ? d.line_items.length : 0)) + '</td>'
          + '<td class="val">' + App.fmtCurrency(d.total || 0) + '</td>'
          + '<td>' + disc + '</td></tr>';
      }).join('');

      html = filter
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Vendor</th><th>Invoice #</th><th>Items</th><th>Total</th><th>Discrepancy</th>'
        + '</tr></thead><tbody>' + (rows || '<tr><td colspan="6" style="color:var(--t3);">No deliveries for this vendor.</td></tr>') + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.container.onclick = ev => {
      const row = ev.target.closest('.dh-row');
      const rec = ev.target.closest('#dh-receive');
      if (row) this.renderDetail(row.dataset.id);
      if (rec) App.navigate('ic-receive-delivery');
    };
    document.getElementById('dh-filter')?.addEventListener('change', e => {
      this.vendorFilter = e.target.value || '';
      this.renderList();
    });
  },

  // ── Detail ────────────────────────────────────────────────────────────────
  renderDetail(id) {
    const d = this.deliveries().find(x => x.id === id);
    if (!d) { this.renderList(); return; }
    const items = d.line_items || [];

    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="dh-export">Export PDF</button>';
    document.getElementById('dh-export')?.addEventListener('click', () => window.print());

    const meta = (label, val) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val">' + val + '</div></div>';

    const itemRows = items.map(it => {
      const change = it.price_changed
        ? '<span style="color:var(--gold);font-weight:700;">was ' + App.fmtCurrency(it.prev_price) + '</span>'
        : '<span style="color:var(--t4);">—</span>';
      return '<tr>'
        + '<td><div class="val">' + esc(it.name) + '</div></td>'
        + '<td>' + (it.container_size_oz != null ? it.container_size_oz + ' oz' : '—') + '</td>'
        + '<td>' + (it.qty != null ? it.qty : '—') + '</td>'
        + '<td>' + (it.price_per_unit != null ? App.fmtCurrency(it.price_per_unit) : '—') + '</td>'
        + '<td>' + change + '</td>'
        + '<td class="val">' + App.fmtCurrency(it.extended || 0) + '</td>'
        + '</tr>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="dh-back">&#8592; Back to Delivery History</button></div>'
      + '<div class="card"><div class="card-title">' + esc(d.vendor || 'Delivery') + ' &middot; ' + this.fmtDate(d.date) + '</div>'
      + '<div class="calc" style="margin-bottom:' + (d.notes ? '14px' : '0') + ';">'
      + meta('Invoice #', esc(d.invoice_number || '—'))
      + meta('Driver', esc(d.driver || '—'))
      + meta('Line Items', d.item_count || items.length)
      + meta('Delivery Total', App.fmtCurrency(d.total || 0))
      + '</div>'
      + (d.notes ? '<div style="font-size:12px;color:var(--t2);line-height:1.6;">' + esc(d.notes) + '</div>' : '')
      + '</div>'
      + '<div class="card"><div class="card-title">Line Items</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Container</th><th>Qty</th><th>Unit Price</th><th>Price Change</th><th>Extended</th>'
      + '</tr></thead><tbody>' + itemRows + '</tbody></table></div></div>'
      + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#dh-back')) this.renderList();
    };
  }
};
