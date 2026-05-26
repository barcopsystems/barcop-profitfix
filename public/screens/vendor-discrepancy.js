'use strict';

/* ── Profit Recovery — Vendor Discrepancies ───────────────────────────────────
   File and track a discrepancy when a delivery does not match the order or
   invoice: a short count, a price overcharge, a substitution billed at the
   premium price. Every documented discrepancy is a credit to chase. Status
   moves Open -> Credit Requested -> Resolved. The Vendor Control fix process
   deep-links here. */

S.VendorDiscrepancy = {
  TYPES: ['Price Overcharge', 'Short Count', 'Substitution', 'Damaged Goods', 'Other'],

  list() {
    if (!Array.isArray(App.data.vendor_discrepancies)) App.data.vendor_discrepancies = [];
    return App.data.vendor_discrepancies;
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const rows = this.list().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const open = rows.filter(r => r.status !== 'Resolved');
    const openTotal = open.reduce((s, r) => s + (r.overcharge || 0), 0);
    const recovered = rows.filter(r => r.status === 'Resolved').reduce((s, r) => s + (r.overcharge || 0), 0);

    const vendors = ((App.inventoryData && App.inventoryData.ic_vendors) || [])
      .map(v => v && v.name).filter(Boolean);
    const vendorList = vendors.map(n => '<option value="' + esc(n) + '"></option>').join('');
    const typeOpts = this.TYPES.map(t => '<option value="' + t + '">' + t + '</option>').join('');

    // Manual filing form — hidden by default since most discrepancies now
    // get filed straight from Receive Delivery's flag-per-line flow. This
    // form is the escape hatch for the cases that do not come from a
    // delivery (damaged bottle discovered days later, vendor substitution
    // mid-week, etc.). Expands when "+ File Manual Discrepancy" is clicked.
    const form = '<div class="card" id="vd-form-wrap" style="display:none;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">'
        + '<div class="card-title" style="margin-bottom:0;">File a Manual Discrepancy</div>'
        + '<button type="button" class="btn btn-ghost btn-sm" id="vd-form-cancel">Cancel</button>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:14px;line-height:1.6;">'
        + 'Use this for discrepancies that do not come from a delivery you just received. Most discrepancies should be filed directly from Receive Delivery using the Flag Discrepancy button on the affected line.'
      + '</div>'
      + '<div class="form-row">'
      + '<div class="f" style="width:150px;"><label>Delivery Date</label><input type="date" id="vd-date"/></div>'
      + '<div class="f" style="width:200px;"><label>Vendor</label><input type="text" id="vd-vendor" list="vd-vendors" placeholder="Vendor name"/><datalist id="vd-vendors">' + vendorList + '</datalist></div>'
      + '<div class="f" style="width:160px;"><label>Invoice / Reference</label><input type="text" id="vd-ref" placeholder="Optional"/></div>'
      + '<div class="f" style="width:180px;"><label>Type</label><select id="vd-type">' + typeOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row">'
      + '<div class="f" style="width:200px;"><label>Product / SKU</label><input type="text" id="vd-sku" placeholder="Product name"/></div>'
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

    const summary = '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap;">'
      + '<div class="calc" style="margin:0;flex:1;min-width:300px;">'
        + '<div class="calc-item"><div class="calc-label">Open Discrepancies</div><div class="calc-val ' + (open.length ? 'warn' : 'good') + '">' + open.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Open Overcharge</div><div class="calc-val ' + (openTotal > 0 ? 'warn' : '') + '">' + App.fmtCurrency(openTotal) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Recovered</div><div class="calc-val good">' + App.fmtCurrency(recovered) + '</div></div>'
      + '</div>'
      + '<button class="btn btn-ghost" id="vd-show-form">+ File Manual Discrepancy</button>'
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
      const trs = rows.map(r => {
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
        + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
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

    document.getElementById('vd-file')?.addEventListener('click', () => this.file());
    document.getElementById('vd-show-form')?.addEventListener('click', () => this.toggleForm(true));
    document.getElementById('vd-form-cancel')?.addEventListener('click', () => this.toggleForm(false));
    this.container.querySelectorAll('.vd-credit').forEach(b =>
      b.addEventListener('click', () => this.setStatus(b.dataset.id, 'Credit Requested')));
    this.container.querySelectorAll('.vd-resolve').forEach(b =>
      b.addEventListener('click', () => this.setStatus(b.dataset.id, 'Resolved')));
    this.container.querySelectorAll('.vd-remove').forEach(b =>
      b.addEventListener('click', () => this.remove(b.dataset.id)));
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
      ['vd-date','vd-vendor','vd-ref','vd-sku','vd-units','vd-agreed','vd-invoiced','vd-overcharge','vd-notes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = ''; el._touched = false; }
      });
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

    this.list().push({
      id: App.uid(), date: date, vendor: vendor,
      reference: val('vd-ref'), type: val('vd-type') || 'Other',
      sku: val('vd-sku'), units: num('vd-units'),
      agreed_price: num('vd-agreed'), invoiced_price: num('vd-invoiced'),
      overcharge: overcharge, notes: val('vd-notes'),
      status: 'Open', source: 'manual',
      filed_at: new Date().toISOString(), resolved_at: null
    });
    // Close the form on successful save so the operator lands back on the
    // log view with the new discrepancy visible at the top.
    App.saveKey('vendor_discrepancies').then(() => this.draw());
  },

  setStatus(id, status) {
    const r = this.list().find(x => x.id === id);
    if (!r) return;
    r.status = status;
    r.resolved_at = status === 'Resolved' ? new Date().toISOString() : null;
    App.saveKey('vendor_discrepancies').then(() => this.draw());
  },

  remove(id) {
    App.data.vendor_discrepancies = this.list().filter(x => x.id !== id);
    App.saveKey('vendor_discrepancies').then(() => this.draw());
  }
};
