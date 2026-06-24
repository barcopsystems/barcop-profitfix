'use strict';

/* ── Inventory Control — Delivery History (reads ic_deliveries) ───────────────
   Every recorded delivery with a discrepancy flag for price changes, a full
   line-item detail view, and print-to-PDF export. */

S.InventoryDeliveryHistory = {
  filterPreset: 'last-4',  // active range chip (weekly cadence)
  _prevPreset: 'last-4',   // range to restore when Custom is toggled closed
  filterFrom: '',          // custom range only
  filterTo: '',
  RANGE_CHIPS: [
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'last-12', label: 'Last 12 Weeks' }, { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],

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

  // Effective window from the active range chip (preset recomputed off "today"
  // each render); Custom reads the From/To pickers; All clears it.
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  // Range chips left, Export right, directly above the list (the accepted filter
  // model). Custom reveals a bare From/To row. Weekly cadence for deliveries.
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'dh-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><button class="btn btn-ghost btn-sm" id="dh-list-export">Export PDF</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="dh-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="dh-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
  },

  // ── Entry ─────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Delivery History Works', [
      { p: ['Delivery History is the record of every delivery you have received. Each row is one delivery, with its total, whether anything came in off, and a full line-item breakdown you can open. This is your paper trail for what you actually bought, what you paid, and where a vendor tried to slip something past you.'] },
      { h: 'Reading The List', p: [
        'Each row shows the date, vendor, invoice number, line item count, and total. The Discrepancy column is the one to watch. It flags any delivery where a price changed against your old cost or a count came up short on the truck.',
        'Clean means every line matched your expected price and the full quantity showed up. Anything else gets tagged so you can see at a glance which deliveries need a follow-up call before you pay the invoice.'
      ] },
      { h: 'Why The Discrepancy Flag Matters', p: ['Distributors raise prices quietly. A nickel a bottle on your well vodka does not jump off an invoice, but across a year and every case you buy it adds up to real money. When Republic National bumps the price on a line, Delivery History catches it and shows you the old price next to the new one so you can decide to eat it, push back, or switch brands. That is the whole point of recording deliveries instead of just stacking invoices in a drawer.'] },
      { h: 'Filter By Date', p: ['Use the range chips above the list to pull up a stretch of deliveries: this month, the last four or twelve weeks, all of it, or a custom span. Reviewing one distributor before your rep visits, like everything Republic National billed you this quarter? Set the range, hit Export PDF, and sort it by vendor in your spreadsheet.'] },
      { h: 'The Detail View', p: [
        'Open any delivery with View to see every line: product, container, quantity received, unit price, any price change against your old cost, and the extended total. Bottle beer shows in cases, so a delivery of Modelo reads in cases the way you order it and pay for it, not loose bottles.',
        'If a line shows a price change, the old price is right there next to what you just paid. If a count came up short, that line tells you what you were billed for versus what hit the floor, which is your starting point for a credit.'
      ] },
      { h: 'File a Discrepancy Later', p: ['Not every problem shows up at the dock. The invoice lands later with a price you did not agree to, a case turns out short or damaged when you open it, a keg pours flat. Open the delivery and hit Flag on that line. Bar Cop files the credit claim pre-filled from the line and tied to this delivery, and it lands in the Vendor Tracker under Discrepancies for follow-up.'] },
      { h: 'Export', p: ['Use Export PDF to save a clean PDF of any delivery for your records, your accountant at month end, or a credit claim you are filing with the vendor. When you are disputing a short count, a printed line-item record with the invoice number on it ends the argument fast.'] }
    ]);
  },

  renderList() {
    this.actions.innerHTML = '';
    const all = this.sorted();

    if (all.length === 0) {
      App.setupCard(this.container, {
        title: 'Delivery History',
        lead: 'Delivery History lists every delivery you record, with totals and price-change discrepancy flags so a sneaky price hike never slips through.',
        steps: [
          { title: 'Receive your first delivery', desc: 'Deliveries you record in Receive Delivery show up here. Record one to get started.', btn: 'Receive Delivery', screen: 'ic-receive-delivery', done: false }
        ]
      });
      return;
    }

    const { from, to } = this.effectiveRange();
    const filtered = all.filter(d =>
      (!from || (d.date || '') >= from) && (!to || (d.date || '') <= to));

    const totalReceived = all.reduce((s, d) => s + (d.total || 0), 0);
    const flagged = all.filter(d => d.has_discrepancy).length;
    const last = all[0];

    const statsCard = '<div class="card"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">'
      + '<div style="flex:1;display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Deliveries</div><div class="calc-val lg">' + all.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Received</div><div class="calc-val lg">' + App.fmtCurrency(totalReceived) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Flagged</div><div class="calc-val lg">' + flagged + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Last Delivery</div><div class="calc-val lg">' + this.fmtDate(last.date) + '</div></div>'
      + '</div></div></div>';

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
    const listCard = '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Vendor</th><th>Invoice #</th><th>Items</th><th>Total</th><th>Discrepancy</th><th></th>'
      + '</tr></thead><tbody>' + (rows || '<tr><td colspan="7" style="color:var(--t3);padding:12px 8px;">No deliveries in this range. Pick a wider range above.</td></tr>') + '</tbody></table></div></div>'
      + App.showOlderBar('ic', 'delivery', filtered, this.filterPreset !== 'all');

    this.container.innerHTML = '<div class="screen">' + statsCard + this.filterRow() + listCard + '</div>';
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const chip = ev.target.closest('.dh-range-chip');
      if (chip) {
        const v = chip.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.renderList();
        return;
      }
      if (ev.target.closest('#dh-list-export')) { this.exportList(); return; }
      const del = ev.target.closest('.dh-del');
      const view = ev.target.closest('.dh-view');
      const row = ev.target.closest('.dh-row');
      if (del)  { ev.stopPropagation(); this.confirmDelete(del.dataset.id); return; }
      if (view) { const id = view.dataset.id; App.pushView(() => this.renderDetail(id)); return; }
      if (row)  { const id = row.dataset.id;  App.pushView(() => this.renderDetail(id)); return; }
    };
    document.getElementById('dh-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('dh-to')?.addEventListener('change', e => { this.filterTo = e.target.value || ''; this.renderList(); });
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
  async confirmDelete(id) {
    if (!App.canEdit('ic-delivery-history')) return;
    if (!(await App.confirmDelete())) return;
    if (!App.inventoryData) return;
    await App.removeRecord('ic', 'delivery', id);
    this.renderList();
  },

  // ── Detail ────────────────────────────────────────────────────────────────
  renderDetail(id) {
    const d = this.deliveries().find(x => x.id === id);
    if (!d) { this.renderList(); return; }
    const items = d.line_items || [];

    this.actions.innerHTML = '';

    const meta = (label, val) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val">' + val + '</div></div>';

    const itemRows = items.map((it, i) => {
      const isCase = it.display_unit === 'case';
      const p = ((App.inventoryData && App.inventoryData.ic_products) || []).find(pr => pr.id === it.product_id);
      const ab = p ? App.unitAbbr(App.productUnit(p)) : '';
      const unitSuffix = isCase ? ' cs' : (ab ? ' ' + ab : '');
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
        + '<td class="no-print" style="text-align:right;">'
        + (it.discrepancy_filed
            ? '<span style="font-size:10px;font-weight:700;color:var(--gold);white-space:nowrap;">Discrepancy Filed</span>'
            : '<button class="btn btn-ghost btn-sm dh-flag" data-idx="' + i + '">File Discrepancy</button>')
        + '</td>'
        + '</tr>';
    }).join('');

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + meta('Invoice #', esc(d.invoice_number || '-'))
      + meta('Driver', esc(d.driver || '-'))
      + meta('Line Items', d.item_count || items.length)
      + meta('Delivery Total', App.fmtCurrency(d.total || 0))
      + '</div>'
      + (d.notes ? '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-top:14px;">' + esc(d.notes) + '</div>' : '')
      + '</div>'
      + '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">' + esc(d.vendor || 'Delivery') + ' &middot; ' + this.fmtDate(d.date) + '</div>'
      + '<div style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" id="dh-export">Export PDF</button></div></div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Container</th><th>Qty</th><th>Unit Price</th><th>Price Change</th><th>Extended</th><th class="no-print"></th>'
      + '</tr></thead><tbody>' + itemRows + '</tbody></table></div></div>'
      + '</div>';

    this.container.onclick = ev => {
      const fl = ev.target.closest('.dh-flag');
      if (fl) { const it = items[parseInt(fl.dataset.idx, 10)]; if (it) this.openLineDiscrepancy(d, it); }
    };
    document.getElementById('dh-export')?.addEventListener('click', () => App.exportPDF({ title: 'Delivery History', root: this.container }));
  },

  // ── File a discrepancy against a saved delivery line (after the fact) ──────
  // The dock catches short counts + price changes live in Receive Delivery; this
  // is the path for issues found later (invoice came after, damage found when a
  // case was opened, a quality failure). Pre-filled from the saved line, tied to
  // the delivery via delivery_id, and the claim lands in Vendor Tracker for
  // credit follow-up ([[two-doors-same-data]]).
  openLineDiscrepancy(d, it) {
    const product = ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === it.product_id);
    const productName = it.name || product?.name || '';
    const agreedPrice = it.prev_price != null ? it.prev_price : (product?.unit_cost != null ? product.unit_cost : null);
    const invoicedPrice = it.price_per_unit != null ? it.price_per_unit : null;
    const qty = it.qty != null ? it.qty : 0;
    const suggestedType = it.price_changed ? 'Price Overcharge' : 'Other';
    let overcharge = 0;
    if (it.price_changed && agreedPrice != null && invoicedPrice != null && qty) overcharge = Math.max(0, (invoicedPrice - agreedPrice) * qty);
    const TYPES = ['Price Overcharge', 'Short Count', 'Substitution', 'Damaged Goods', 'Other'];
    const typeOpts = TYPES.map(t => '<option value="' + t + '"' + (t === suggestedType ? ' selected' : '') + '>' + t + '</option>').join('');

    const html = '<div class="card form-card" style="margin:0;"><div class="card-title">File Discrepancy</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:16px;">Files a credit claim to Vendor Tracker for follow-up, tied to this delivery. Adjust if needed.</div>'
      + '<div class="form-row" style="gap:12px;">'
        + '<div class="f" style="width:160px;"><label>Date</label><input class="form-input" type="date" id="dhd-date" value="' + esc(d.date || App.todayLocal()) + '"/></div>'
        + '<div class="f" style="flex:1;min-width:160px;"><label>Vendor</label><input class="form-input" type="text" id="dhd-vendor" value="' + esc(d.vendor || '') + '" readonly/></div>'
        + '<div class="f" style="width:160px;"><label>Invoice / Reference</label><input class="form-input" type="text" id="dhd-ref" value="' + esc(d.invoice_number || '') + '"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:12px;">'
        + '<div class="f" style="flex:1;min-width:200px;"><label>Product</label><input class="form-input" type="text" id="dhd-product" value="' + esc(productName) + '"/></div>'
        + '<div class="f" style="width:180px;"><label>Type</label><select class="form-input" id="dhd-type">' + typeOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:12px;">'
        + '<div class="f" style="width:100px;"><label>Units</label><input class="form-input" type="number" id="dhd-units" step="1" value="' + qty + '"/></div>'
        + '<div class="f" style="width:130px;"><label>Agreed Price</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="dhd-agreed" step="0.01" value="' + (agreedPrice != null ? agreedPrice.toFixed(2) : '') + '"/></div></div>'
        + '<div class="f" style="width:130px;"><label>Invoiced Price</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="dhd-invoiced" step="0.01" value="' + (invoicedPrice != null ? invoicedPrice.toFixed(2) : '') + '"/></div></div>'
        + '<div class="f" style="width:150px;"><label>Overcharge / Loss</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="dhd-overcharge" step="0.01" value="' + overcharge.toFixed(2) + '"/></div></div>'
      + '</div>'
      + '<div class="f" style="margin-bottom:0;"><label>Notes</label><input class="form-input" type="text" id="dhd-notes" placeholder="What was wrong, and who you contacted"/></div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="dhd-file">File Discrepancy</button>'
        + '<button class="btn btn-ghost" id="dhd-cancel">Cancel</button>'
        + '<span id="dhd-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'dh-disc-modal', maxWidth: 640, noClose: true });

    const recompute = () => {
      const oc = document.getElementById('dhd-overcharge');
      if (!oc || oc._touched) return;
      const u = parseFloat(document.getElementById('dhd-units')?.value) || 0;
      const a = parseFloat(document.getElementById('dhd-agreed')?.value);
      const iv = parseFloat(document.getElementById('dhd-invoiced')?.value);
      if (!isNaN(a) && !isNaN(iv) && u) oc.value = Math.max(0, (iv - a) * u).toFixed(2);
    };
    ['dhd-units', 'dhd-agreed', 'dhd-invoiced'].forEach(id => document.getElementById(id)?.addEventListener('input', recompute));
    document.getElementById('dhd-overcharge')?.addEventListener('input', e => { e.target._touched = true; });
    document.getElementById('dhd-cancel')?.addEventListener('click', () => App.closeModal('dh-disc-modal'));
    document.getElementById('dhd-file')?.addEventListener('click', () => this.saveLineDiscrepancy(d, it));
  },

  async saveLineDiscrepancy(d, it) {
    const errEl = document.getElementById('dhd-err');
    const fail = m => { if (errEl) { errEl.textContent = m; errEl.style.display = 'inline'; } };
    const date = document.getElementById('dhd-date')?.value;
    const vendor = (document.getElementById('dhd-vendor')?.value || d.vendor || '').trim();
    if (!date) { fail('Date is required.'); return; }
    if (!vendor) { fail('Vendor is required.'); return; }
    const rec = {
      id:             App.uid(),
      date,
      vendor,
      reference:      document.getElementById('dhd-ref')?.value.trim() || '',
      type:           document.getElementById('dhd-type')?.value || 'Other',
      sku:            document.getElementById('dhd-product')?.value.trim() || '',
      units:          parseFloat(document.getElementById('dhd-units')?.value) || 0,
      agreed_price:   parseFloat(document.getElementById('dhd-agreed')?.value) || 0,
      invoiced_price: parseFloat(document.getElementById('dhd-invoiced')?.value) || 0,
      overcharge:     parseFloat(document.getElementById('dhd-overcharge')?.value) || 0,
      notes:          document.getElementById('dhd-notes')?.value.trim() || '',
      status:         'Open',
      source:         'delivery-history',
      delivery_id:    d.id,
      created_at:     new Date().toISOString()
    };
    const ok = await App.putRecord('core', 'vendor_discrepancy', rec);
    if (!ok) { fail('Could not save the discrepancy. Try again.'); return; }
    // Mark the line as filed so the detail view shows "Discrepancy Filed" instead
    // of re-offering the button, and flag the delivery so the list shows the flag.
    if (it) it.discrepancy_filed = true;
    d.has_discrepancy = true;
    await App.putRecord('ic', 'delivery', d);
    App.closeModal('dh-disc-modal');
    this.renderDetail(d.id);
  }
};
