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
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // ── Entry ─────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Delivery History Works', [
      { p: ['Delivery History is the record of every delivery you have received. Each row is one delivery, with its total, whether anything came in off, and a full line-item breakdown you can open.'] },
      { h: 'Reading The List', p: ['Each row shows the date, vendor, invoice number, line item count, and total. The Discrepancy column flags any delivery where a price changed or a count came up short, so you can see at a glance which ones need follow-up. Clean means everything matched.'] },
      { h: 'Filter By Vendor', p: ['Use the vendor filter to pull up just one distributor. Handy when you are reviewing a single vendor\'s pricing or chasing a credit on their account.'] },
      { h: 'The Detail View', p: ['Open any delivery with View to see every line: product, container, quantity received, unit price, any price change against your old cost, and the extended total. Bottle beer shows in cases.'] },
      { h: 'Export', p: ['Use Export PDF to save a clean PDF of any delivery for your records, your accountant, or a credit claim with the vendor.'] }
    ]);
  },

  renderList() {
    this.actions.innerHTML = '';
    const all = this.sorted();
    const filtered = this.vendorFilter ? all.filter(d => d.vendor === this.vendorFilter) : all;

    let html;
    if (all.length === 0) {
      App.setupCard(this.container, {
        title: 'Delivery History',
        lead: 'Delivery History lists every delivery you record, with totals and price-change discrepancy flags so a sneaky price hike never slips through.',
        steps: [
          { title: 'Receive your first delivery', desc: 'Deliveries you record in Receive Delivery show up here. Record one to get started.', btn: 'Receive Delivery', screen: 'ic-receive-delivery', done: false }
        ]
      });
      return;
    } else {
      const vendors = [...new Set(all.map(d => d.vendor).filter(Boolean))].sort();
      const filter = '<div class="form-row" style="margin-bottom:14px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;"><div class="f" style="width:280px;margin-bottom:0;">'
        + '<label>Filter by Vendor</label><select id="dh-filter">'
        + '<option value="">All vendors</option>'
        + vendors.map(v => '<option value="' + esc(v) + '"' + (this.vendorFilter === v ? ' selected' : '') + '>' + esc(v) + '</option>').join('')
        + '</select></div>'
        + '<button class="btn btn-ghost btn-sm" id="dh-list-export">Export PDF</button></div>';

      const rows = filtered.slice(0, App.listLimit('ic', 'delivery')).map(d => {
        let disc;
        if (d.has_discrepancy) {
          const parts = [];
          if (d.price_change_count) parts.push(d.price_change_count + ' Price Change' + (d.price_change_count === 1 ? '' : 's'));
          if (d.short_count_count)  parts.push(d.short_count_count + ' Short Count' + (d.short_count_count === 1 ? '' : 's'));
          disc = '<span style="color:var(--gold);font-weight:700;">' + (parts.join(' &middot; ') || 'Discrepancy') + '</span>';
        } else {
          disc = '<span style="color:var(--green);font-weight:600;">Clean</span>';
        }
        return '<tr class="dh-row" data-id="' + d.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(d.date) + '</div></td>'
          + '<td>' + esc(d.vendor || '-') + '</td>'
          + '<td>' + esc(d.invoice_number || '-') + '</td>'
          + '<td>' + (d.item_count || (d.line_items ? d.line_items.length : 0)) + '</td>'
          + '<td class="val">' + App.fmtCurrency(d.total || 0) + '</td>'
          + '<td>' + disc + '</td>'
          + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm dh-view" data-id="' + d.id + '">View</button>'
          + (App.canEdit('ic-delivery-history') ? '<button class="btn btn-danger btn-sm dh-del" data-id="' + d.id + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');

      html = '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
        + '<span>Delivery History</span>'
        + App.helpButton('dh-how') + '</div>'
        + filter
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Vendor</th><th>Invoice #</th><th>Items</th><th>Total</th><th>Discrepancy</th><th></th>'
        + '</tr></thead><tbody>' + (rows || '<tr><td colspan="7" style="color:var(--t3);">No deliveries for this vendor.</td></tr>') + '</tbody></table></div>'
        + App.showOlderBar('ic', 'delivery', filtered, !!this.vendorFilter) + '</div>';
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      if (ev.target.closest('#dh-list-export')) { this.exportList(); return; }
      const how = ev.target.closest('#dh-how');
      const del = ev.target.closest('.dh-del');
      const view = ev.target.closest('.dh-view');
      const row = ev.target.closest('.dh-row');
      const rec = ev.target.closest('#dh-receive');
      if (how)  { this.showHowTo(); return; }
      if (del)  { ev.stopPropagation(); this.confirmDelete(del.dataset.id); return; }
      if (view) { this.renderDetail(view.dataset.id); return; }
      if (row)  { this.renderDetail(row.dataset.id); return; }
      if (rec) App.navigate('ic-receive-delivery');
    };
    document.getElementById('dh-filter')?.addEventListener('change', e => {
      this.vendorFilter = e.target.value || '';
      this.renderList();
    });
  },

  // Export the COMPLETE delivery list to PDF (every delivery, not just the
  // on-screen window, which paginates via Show older). Built from an off-screen node.
  exportList() {
    const all = this.sorted();
    if (all.length === 0) return;
    const rows = all.map(d => {
      let disc;
      if (d.has_discrepancy) {
        const parts = [];
        if (d.price_change_count) parts.push(d.price_change_count + ' Price Change' + (d.price_change_count === 1 ? '' : 's'));
        if (d.short_count_count)  parts.push(d.short_count_count + ' Short Count' + (d.short_count_count === 1 ? '' : 's'));
        disc = parts.join(', ') || 'Discrepancy';
      } else {
        disc = 'Clean';
      }
      return '<tr><td>' + this.fmtDate(d.date) + '</td>'
        + '<td>' + esc(d.vendor || '-') + '</td>'
        + '<td>' + esc(d.invoice_number || '-') + '</td>'
        + '<td>' + (d.item_count || (d.line_items ? d.line_items.length : 0)) + '</td>'
        + '<td>' + App.fmtCurrency(d.total || 0) + '</td>'
        + '<td>' + esc(disc) + '</td></tr>';
    }).join('');
    const node = document.createElement('div');
    node.className = 'screen';
    node.style.cssText = 'position:absolute;left:-99999px;top:0;';
    node.innerHTML = '<div class="card"><div class="card-title">Delivery History</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Vendor</th><th>Invoice #</th><th>Items</th><th>Total</th><th>Discrepancy</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    document.body.appendChild(node);
    Promise.resolve(App.exportPDF({ title: 'Delivery History', root: node })).finally(() => node.remove());
  },

  // Guarded delete: a delivery is a finalized record, so removing one is behind
  // the edit permission and an honest confirm because it moves your stock,
  // usage, and variance. The correction path matters more than strict
  // immutability. Applied price-master changes are not reversed here.
  confirmDelete(id) {
    if (!App.canEdit('ic-delivery-history')) return;
    const rec = this.deliveries().find(d => d.id === id);
    const label = rec ? (esc((rec.vendor || 'Delivery') + ', ' + this.fmtDate(rec.date))) : 'this delivery';
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;';
    m.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;max-width:440px;width:100%;padding:24px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;">Delete Delivery</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.7;margin-bottom:20px;">Delete the ' + label + ' delivery? This feeds your stock, usage, and variance numbers, so deleting it will change those reports. This cannot be undone.</div>'
      + '<div style="display:flex;justify-content:flex-end;gap:10px;">'
        + '<button type="button" class="btn btn-ghost" id="dh-del-cancel">Cancel</button>'
        + '<button type="button" class="btn btn-danger" id="dh-del-confirm">Delete Delivery</button>'
      + '</div></div>';
    document.body.appendChild(m);
    const close = () => m.remove();
    m.addEventListener('click', ev => { if (ev.target === m) close(); });
    document.getElementById('dh-del-cancel').addEventListener('click', close);
    document.getElementById('dh-del-confirm').addEventListener('click', async () => {
      close();
      if (!App.canEdit('ic-delivery-history') || !App.inventoryData) return;
      await App.removeRecord('ic', 'delivery', id);
      this.renderList();
    });
  },

  // ── Detail ────────────────────────────────────────────────────────────────
  renderDetail(id) {
    const d = this.deliveries().find(x => x.id === id);
    if (!d) { this.renderList(); return; }
    const items = d.line_items || [];

    this.actions.innerHTML = '';

    const meta = (label, val) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val">' + val + '</div></div>';

    const itemRows = items.map(it => {
      const isCase = it.display_unit === 'case';
      const p = ((App.inventoryData && App.inventoryData.ic_products) || []).find(pr => pr.id === it.product_id);
      const unitSuffix = isCase ? ' cases' : (p ? ' ' + (App.productUnit(p) || '') : '');
      const priceSuffix = isCase ? '<div style="font-size:9px;color:var(--t3);">per case</div>' : '';
      const change = it.price_changed
        ? '<span style="color:var(--gold);font-weight:700;">was ' + App.fmtCurrency(it.prev_price) + '</span>'
        : '<span style="color:var(--t4);">-</span>';
      const containerCol = isCase && it.case_size_at_receive
        ? (it.container_size_oz != null ? it.container_size_oz + ' oz btl &middot; ' + it.case_size_at_receive + '/case' : it.case_size_at_receive + ' btl/case')
        : (it.container_size_oz != null ? it.container_size_oz + ' oz' : '-');
      return '<tr>'
        + '<td><div class="val">' + esc(it.name) + '</div></td>'
        + '<td>' + containerCol + '</td>'
        + '<td>' + (it.qty != null ? it.qty + unitSuffix : '-') + '</td>'
        + '<td>' + (it.price_per_unit != null ? App.fmtCurrency(it.price_per_unit) + priceSuffix : '-') + '</td>'
        + '<td>' + change + '</td>'
        + '<td class="val">' + App.fmtCurrency(it.extended || 0) + '</td>'
        + '</tr>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>' + esc(d.vendor || 'Delivery') + ' &middot; ' + this.fmtDate(d.date) + '</span>'
      + '<button class="btn btn-ghost btn-sm" id="dh-export">Export PDF</button></div>'
      + '<div class="calc" style="margin-bottom:' + (d.notes ? '14px' : '0') + ';">'
      + meta('Invoice #', esc(d.invoice_number || '-'))
      + meta('Driver', esc(d.driver || '-'))
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

    this.container.onclick = null;
    document.getElementById('dh-export')?.addEventListener('click', () => App.exportPDF({ title: 'Delivery History', root: this.container }));
  }
};
