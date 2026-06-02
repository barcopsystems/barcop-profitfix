'use strict';

/* ── Profit Recovery — Vendor Discrepancies ───────────────────────────────────
   File and track a discrepancy when a delivery does not match the order or
   invoice: a short count, a price overcharge, a substitution billed at the
   premium price. Every documented discrepancy is a credit to chase. Status
   moves Open -> Credit Requested -> Resolved. The Vendor Control fix process
   deep-links here. */

S.VendorDiscrepancy = {
  list() {
    if (!Array.isArray(App.data.vendor_discrepancies)) App.data.vendor_discrepancies = [];
    return App.data.vendor_discrepancies;
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    // Print a blank delivery-inspection sheet that the receiver fills at the
    // dock and the manager types in after close. Same paper-to-digital pattern
    // as Transfer Log and Empties Log.
    const printBtn = document.createElement('button');
    printBtn.className = 'btn btn-ghost btn-sm';
    printBtn.textContent = 'Worksheet';
    printBtn.addEventListener('click', () => this.printBlank());
    actions.appendChild(printBtn);
    this.draw();
  },

  printBlank() {
    App.printBlankSheet({
      title: 'Delivery Inspection Sheet',
      subtitle: 'Check every line at the dock. Anything off, write it down. Manager files each discrepancy in Bar Cop after close.',
      columns: [
        { label: 'Vendor',       width: '14%' },
        { label: 'Product',      width: '20%' },
        { label: 'Ordered Qty',  width: '10%' },
        { label: 'Received Qty', width: '10%' },
        { label: 'Agreed Price', width: '10%' },
        { label: 'Invoiced Price', width: '10%' },
        { label: 'Issue',        width: '16%' },
        { label: 'Receiver',     width: '10%' }
      ],
      rows: 18
    });
  },

  draw() {
    const rows = this.list().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const open = rows.filter(r => r.status !== 'Resolved');
    const openTotal = open.reduce((s, r) => s + (r.overcharge || 0), 0);
    // Recovered tile sums what the operator actually got back, not the
    // original overcharge. Falls back to overcharge for legacy resolved
    // records that pre-date the recovered_amount field.
    const recovered = rows.filter(r => r.status === 'Resolved').reduce((s, r) => {
      const v = (r.recovered_amount != null) ? r.recovered_amount : r.overcharge;
      return s + (v || 0);
    }, 0);

    const vendors = ((App.inventoryData && App.inventoryData.ic_vendors) || [])
      .map(v => v && v.name).filter(Boolean).sort((a, b) => a.localeCompare(b));
    const vendorList = '<option value="">Select vendor...</option>'
      + vendors.map(n => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('');
    const typeOpts = App.VENDOR_DISCREPANCY_TYPES.map(t => '<option value="' + t + '">' + t + '</option>').join('');
    // Product dropdown options are rebuilt on vendor change so the list stays
    // filtered to the chosen vendor. Initial render is empty until vendor is
    // picked; the wire() handler swaps the inner HTML in real time.
    const productOptsInitial = '<option value="">Pick vendor first...</option>';

    // Manual filing form — hidden by default since most discrepancies now
    // get filed straight from Receive Delivery's flag-per-line flow. This
    // form is the escape hatch for the cases that do not come from a
    // delivery (damaged bottle discovered days later, vendor substitution
    // mid-week, etc.). Expands when "+ File Manual Discrepancy" is clicked.
    const form = '<div class="card" id="vd-form-wrap" style="display:none;margin-top:18px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">'
        + '<div class="card-title" style="margin-bottom:0;">File a Manual Discrepancy</div>'
        + '<button type="button" class="btn btn-ghost btn-sm" id="vd-form-cancel">Cancel</button>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:14px;line-height:1.6;">'
        + 'Use this for discrepancies that do not come from a delivery you just received. Most discrepancies should be filed directly from Receive Delivery using the Flag Discrepancy button on the affected line.'
      + '</div>'
      + '<div class="form-row">'
      + '<div class="f" style="width:150px;"><label>Delivery Date</label><input type="date" id="vd-date"/></div>'
      + '<div class="f" style="width:220px;"><label>Vendor</label><select id="vd-vendor">' + vendorList + '</select></div>'
      + '<div class="f" style="width:160px;"><label>Invoice / Reference</label><input type="text" id="vd-ref" placeholder="Optional"/></div>'
      + '<div class="f" style="width:180px;"><label>Type</label><select id="vd-type">' + typeOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row">'
      + '<div class="f" style="width:220px;"><label>Product</label><select id="vd-product">' + productOptsInitial + '</select></div>'
      + '<div class="f" style="width:90px;"><label>Units</label><input type="number" id="vd-units" step="1" placeholder="0"/></div>'
      + '<div class="f" style="width:120px;"><label>Agreed Price</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="vd-agreed" step="0.01"/></div></div>'
      + '<div class="f" style="width:120px;"><label>Invoiced Price</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="vd-invoiced" step="0.01"/></div></div>'
      + '<div class="f" style="width:140px;"><label>Overcharge / Loss</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="vd-overcharge" step="0.01"/></div></div>'
      + '</div>'
      + '<div class="form-row">'
      + '<div class="f" style="flex:1;min-width:260px;"><label>Notes</label><input type="text" id="vd-notes" placeholder="What was wrong, and who you contacted"/></div>'
      + '</div>'
      + '<div id="vd-err" style="color:var(--red);font-size:12px;margin-bottom:10px;display:none;"></div>'
      + '<button class="btn btn-primary" id="vd-file">File Discrepancy</button>'
      + '</div>';

    const summary = '<div class="calc" style="position:relative;margin-bottom:18px;padding-right:220px;">'
      + '<div class="calc-item"><div class="calc-label">Open Discrepancies</div><div class="calc-val ' + (open.length ? 'warn' : 'good') + '">' + open.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Open Overcharge</div><div class="calc-val ' + (openTotal > 0 ? 'warn' : '') + '">' + App.fmtCurrency(openTotal) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Recovered</div><div class="calc-val good">' + App.fmtCurrency(recovered) + '</div></div>'
      + '<button class="btn btn-ghost btn-sm" id="vd-show-form" style="position:absolute;top:50%;right:20px;transform:translateY(-50%);">+ File Manual Discrepancy</button>'
    + '</div>';

    let body;
    if (!rows.length) {
      body = '<div class="card"><div class="empty"><div class="empty-title">No discrepancies filed</div>'
        + '<div class="empty-sub">When a delivery is short or a price is wrong, file it here. Every discrepancy '
        + 'you document is a credit you can request. Contact the rep within 24 hours; they age out fast.</div></div></div>';
    } else {
      const badge = st => st === 'Resolved' ? '<span class="badge badge-ok">Resolved</span>'
        : st === 'Credit Requested' ? '<span class="badge badge-dim">Credit Requested</span>'
        : '<span class="badge badge-warn">Open</span>';
      const trs = rows.slice(0, App.listLimit('core', 'vendor_discrepancy')).map(r => {
        const act = r.status === 'Open'
          ? '<button class="btn btn-ghost btn-sm vd-credit" data-id="' + esc(r.id) + '">Request Credit</button>'
          : r.status === 'Credit Requested'
            ? '<button class="btn btn-ghost btn-sm vd-resolve" data-id="' + esc(r.id) + '">Mark Resolved</button>'
            : '';
        return '<tr>'
          + '<td>' + esc(r.date || '-') + '</td>'
          + '<td class="val">' + esc(r.vendor || '-') + '</td>'
          + '<td>' + esc(r.type || '-') + '</td>'
          + '<td>' + esc(r.sku || '-') + '</td>'
          + '<td class="' + ((r.overcharge || 0) > 0 ? 'neg' : '') + '">' + App.fmtCurrency(r.overcharge || 0) + '</td>'
          + '<td>' + badge(r.status) + '</td>'
          + '<td style="white-space:nowrap;">' + act
          + ' <button class="btn btn-ghost btn-sm vd-remove" data-id="' + esc(r.id) + '">Remove</button></td>'
          + '</tr>';
      }).join('');
      body = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Vendor</th><th>Type</th><th>Product</th><th>Overcharge</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + trs + '</tbody></table></div>'
        + App.showOlderBar('core', 'vendor_discrepancy', rows, false);
    }

    // Order: summary tiles + log first (default landing is the log view).
    // The manual filing form lives below the log and only renders open when
    // the operator clicks the "+ File Manual Discrepancy" button.
    this.container.innerHTML = '<div class="screen">' + summary + body + form + '</div>';
    this.wire();
  },

  wire() {
    // Live overcharge from (invoiced - agreed) x units, until the operator
    // types in the overcharge field directly.
    const recompute = () => {
      const oc = document.getElementById('vd-overcharge');
      if (!oc || oc._touched) return;
      const u = parseFloat(document.getElementById('vd-units')?.value) || 0;
      const a = parseFloat(document.getElementById('vd-agreed')?.value);
      const i = parseFloat(document.getElementById('vd-invoiced')?.value);
      if (!isNaN(a) && !isNaN(i) && u) oc.value = ((i - a) * u).toFixed(2);
    };
    ['vd-units', 'vd-agreed', 'vd-invoiced'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', recompute);
    });
    document.getElementById('vd-overcharge')?.addEventListener('input', e => { e.target._touched = true; });

    // When the vendor changes, rebuild the product dropdown to show only the
    // products that vendor supplies. Captures product_id on save so Vendor
    // Scorecard can attribute the discrepancy to a real SKU.
    document.getElementById('vd-vendor')?.addEventListener('change', () => this.rebuildProductOptions());
    // When the product changes, pre-fill the agreed price from the product
    // master so the operator only types what's actually new (invoiced price).
    document.getElementById('vd-product')?.addEventListener('change', e => {
      const pid = e.target.value;
      if (!pid) return;
      const p = ((App.inventoryData && App.inventoryData.ic_products) || []).find(x => x.id === pid);
      if (!p) return;
      const ag = document.getElementById('vd-agreed');
      if (ag && !ag.value) ag.value = (parseFloat(p.unit_cost) || 0).toFixed(2);
    });

    document.getElementById('vd-file')?.addEventListener('click', () => this.file());
    document.getElementById('vd-show-form')?.addEventListener('click', () => this.toggleForm(true));
    document.getElementById('vd-form-cancel')?.addEventListener('click', () => this.toggleForm(false));
    this.container.querySelectorAll('.vd-credit').forEach(b =>
      b.addEventListener('click', () => this.requestCredit(b.dataset.id)));
    this.container.querySelectorAll('.vd-resolve').forEach(b =>
      b.addEventListener('click', () => this.markResolved(b.dataset.id)));
    this.container.querySelectorAll('.vd-remove').forEach(b =>
      b.addEventListener('click', () => this.remove(b.dataset.id)));
    this.container.querySelector('[data-show-older]')?.addEventListener('click', e =>
      App.handleShowOlder(e.target, () => this.draw()));
  },

  rebuildProductOptions() {
    const vendorName = document.getElementById('vd-vendor')?.value || '';
    const sel = document.getElementById('vd-product');
    if (!sel) return;
    if (!vendorName) {
      sel.innerHTML = '<option value="">Pick vendor first...</option>';
      return;
    }
    const prods = ((App.inventoryData && App.inventoryData.ic_products) || [])
      .filter(p => (p.vendor || '') === vendorName && p.active !== false)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (!prods.length) {
      sel.innerHTML = '<option value="">No products on file for this vendor</option>';
      return;
    }
    sel.innerHTML = '<option value="">Select product...</option>'
      + prods.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('');
  },

  // ── Request Credit ───────────────────────────────────────────────────────
  // Opens the operator's email client with a structured credit request to
  // the vendor's rep, then flips status to "Credit Requested." Same mailto
  // pattern used for order submission so the operator's own email address
  // is the sender (vendor's reply threads back naturally).
  requestCredit(id) {
    const r = this.list().find(x => x.id === id);
    if (!r) return;
    const vendors = (App.inventoryData?.ic_vendors) || [];
    const v = vendors.find(x => x.name === r.vendor) || null;
    const barName = (App.data?.settings?.bar_name) || 'Bar Cop User';

    const lines = [];
    lines.push('Hi' + (v?.rep ? ' ' + v.rep : '') + ',');
    lines.push('');
    lines.push('I am writing to request a credit on a delivery discrepancy.');
    lines.push('');
    if (v?.account_number) lines.push('Account: ' + v.account_number);
    lines.push('Delivery date: ' + (r.date || ''));
    if (r.reference) lines.push('Invoice / Reference: ' + r.reference);
    lines.push('');
    lines.push('Type: ' + (r.type || 'Other'));
    if (r.sku) lines.push('Product: ' + r.sku);
    if (r.units != null && r.units !== '') lines.push('Units affected: ' + r.units);
    if (r.agreed_price != null)   lines.push('Agreed price: $' + parseFloat(r.agreed_price).toFixed(2));
    if (r.invoiced_price != null) lines.push('Invoiced price: $' + parseFloat(r.invoiced_price).toFixed(2));
    lines.push('Credit amount requested: $' + parseFloat(r.overcharge || 0).toFixed(2));
    if (r.notes) {
      lines.push('');
      lines.push('Notes: ' + r.notes);
    }
    lines.push('');
    lines.push('Please confirm the credit and let me know when it will be applied.');
    lines.push('');
    lines.push('Thanks,');
    lines.push(barName);

    const subj = 'Credit request: ' + (r.vendor || 'vendor') + ' discrepancy from ' + (r.date || '');
    const mailto = 'mailto:' + encodeURIComponent(v?.email || '')
      + '?subject=' + encodeURIComponent(subj)
      + '&body='    + encodeURIComponent(lines.join('\n'));
    window.location.href = mailto;

    // Flip status. If the operator never actually hits Send in their email
    // client, they can revert via Remove + refile, or just leave it.
    r.status = 'Credit Requested';
    r.credit_requested_at = new Date().toISOString();
    App.putRecord('core', 'vendor_discrepancy', r).then(() => this.draw());
  },

  // ── Mark Resolved ────────────────────────────────────────────────────────
  // Opens an in-app modal asking how much credit the vendor actually gave.
  // Vendors often credit only part of what was claimed, so the operator
  // can override the default (which is the full claimed overcharge).
  markResolved(id) {
    const r = this.list().find(x => x.id === id);
    if (!r) return;
    const claimed = parseFloat(r.overcharge) || 0;
    this.openResolveModal(r, claimed);
  },

  openResolveModal(record, claimed) {
    const m = document.createElement('div');
    m.id = 'vd-resolve-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;padding:40px 20px;background:rgba(0,0,0,0.65);';
    m.innerHTML = '<div style="background:var(--bg);border:1px solid var(--b1);border-radius:8px;max-width:480px;width:100%;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,0.55);">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;border-bottom:1px solid var(--b2);padding-bottom:12px;">'
        + '<div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--w);">Mark Resolved</div>'
        + '<button type="button" id="vd-resolve-close" style="background:none;border:none;color:var(--t2);font-size:26px;line-height:1;cursor:pointer;padding:0 4px;font-weight:300;">&times;</button>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:16px;">'
        + 'How much credit did the vendor actually give you? Claimed was '
        + '<strong style="color:var(--t1);">' + App.fmtCurrency(claimed) + '</strong>. '
        + 'Vendors sometimes credit only part of a claim. Enter what you actually got back, then Save. The Recovered tile sums actual recoveries, not original claims.'
      + '</div>'
      + '<div class="f" style="margin-bottom:18px;"><label>Recovered Amount</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="vd-resolve-amt" step="0.01" value="' + claimed.toFixed(2) + '" autofocus/></div>'
      + '</div>'
      + '<div id="vd-resolve-err" style="color:var(--red);font-size:12px;margin-bottom:10px;display:none;"></div>'
      + '<div style="display:flex;justify-content:flex-end;gap:10px;">'
        + '<button type="button" id="vd-resolve-cancel" class="btn btn-ghost">Cancel</button>'
        + '<button type="button" id="vd-resolve-save" class="btn btn-primary">Save</button>'
      + '</div>'
    + '</div>';
    document.body.appendChild(m);
    const close = () => m.remove();
    m.addEventListener('click', ev => { if (ev.target === m) close(); });
    document.getElementById('vd-resolve-close').addEventListener('click', close);
    document.getElementById('vd-resolve-cancel').addEventListener('click', close);
    document.getElementById('vd-resolve-save').addEventListener('click', () => {
      const errEl = document.getElementById('vd-resolve-err');
      const inp = document.getElementById('vd-resolve-amt');
      const fail = msg => { if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; } };
      if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
      const recovered = parseFloat(inp?.value);
      if (isNaN(recovered) || recovered < 0) { fail('Enter a valid dollar amount.'); return; }
      record.status = 'Resolved';
      record.resolved_at = new Date().toISOString();
      record.recovered_amount = recovered;
      App.putRecord('core', 'vendor_discrepancy', record).then(() => { close(); this.draw(); });
    });
    setTimeout(() => document.getElementById('vd-resolve-amt')?.select(), 50);
  },

  toggleForm(show) {
    const wrap = document.getElementById('vd-form-wrap');
    const showBtn = document.getElementById('vd-show-form');
    if (!wrap) return;
    if (show) {
      wrap.style.display = '';
      if (showBtn) showBtn.style.display = 'none';
      // Default the date to today and scroll the form into view.
      const dateInp = document.getElementById('vd-date');
      if (dateInp && !dateInp.value) dateInp.value = new Date().toISOString().slice(0, 10);
      wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      wrap.style.display = 'none';
      if (showBtn) showBtn.style.display = '';
      // Clear the form for next time.
      ['vd-date','vd-vendor','vd-ref','vd-product','vd-units','vd-agreed','vd-invoiced','vd-overcharge','vd-notes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = ''; el._touched = false; }
      });
      this.rebuildProductOptions();
      const err = document.getElementById('vd-err');
      if (err) { err.textContent = ''; err.style.display = 'none'; }
    }
  },

  file() {
    const val = id => document.getElementById(id)?.value.trim() || '';
    const num = id => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? null : v; };
    const err = document.getElementById('vd-err');
    const fail = msg => { if (err) { err.textContent = msg; err.style.display = 'block'; } };

    const date = val('vd-date'), vendor = val('vd-vendor'), overcharge = num('vd-overcharge');
    if (!date)   return fail('Enter the delivery date.');
    if (!vendor) return fail('Enter the vendor.');
    if (overcharge == null) return fail('Enter the overcharge or loss amount.');

    const productId = val('vd-product');
    const product = productId
      ? ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === productId)
      : null;
    const rec = {
      id: App.uid(), date: date, vendor: vendor,
      reference: val('vd-ref'), type: val('vd-type') || 'Other',
      product_id: productId, sku: (product?.name) || '',
      units: num('vd-units'),
      agreed_price: num('vd-agreed'), invoiced_price: num('vd-invoiced'),
      overcharge: overcharge, notes: val('vd-notes'),
      status: 'Open', source: 'manual',
      filed_at: new Date().toISOString(), resolved_at: null
    };
    // Close the form on successful save so the operator lands back on the
    // log view with the new discrepancy visible at the top.
    App.putRecord('core', 'vendor_discrepancy', rec).then(() => this.draw());
  },

  remove(id) {
    App.removeRecord('core', 'vendor_discrepancy', id).then(() => this.draw());
  }
};
