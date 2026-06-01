'use strict';

/* ── Inventory Control — Receive Delivery (writes ic_deliveries) ──────────────
   Logs a vendor delivery line by line. Unit price pre-fills from the product
   master and is editable; any difference is flagged as a price change. On save
   the delivery is recorded, and products whose price changed have their unit
   cost (and pour metrics) updated so Profit Recovery stays current. */

S.InventoryReceiveDelivery = {
  _seq: 0,
  CAT_ORDER: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'],

  products() {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
  },
  productById(id) {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
  },
  vendors() {
    return ((App.inventoryData && App.inventoryData.ic_vendors) || []);
  },
  deliveries() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_deliveries)) App.inventoryData.ic_deliveries = [];
    return App.inventoryData.ic_deliveries;
  },
  orders() {
    return ((App.inventoryData && App.inventoryData.ic_orders) || []);
  },
  // All in-flight orders (Open or Submitted) for a given vendor name, newest first.
  openOrdersForVendor(vendorName) {
    if (!vendorName) return [];
    return this.orders()
      .filter(o => o && o.vendor === vendorName && o.status !== 'Received')
      .slice()
      .sort((a, b) => new Date(b.created_at || b.date || 0).getTime() - new Date(a.created_at || a.date || 0).getTime());
  },
  // Find a product by id OR fall back to a case-insensitive name match. Used
  // when pre-filling from an order whose line items may pre-date the
  // product_id capture (older orders).
  resolveProduct(productId, name) {
    if (productId) {
      const p = this.productById(productId);
      if (p) return p;
    }
    if (name) {
      const lower = String(name).toLowerCase().trim();
      return ((App.inventoryData && App.inventoryData.ic_products) || [])
        .find(p => (p.name || '').toLowerCase().trim() === lower) || null;
    }
    return null;
  },

  // ── Entry ─────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    this.renderForm();
  },

  showHowTo() {
    App.showHelpModal('How Receiving a Delivery Works', [
      { p: ['Receiving a delivery logs what actually showed up against what you ordered and what you got charged. Match it to your invoice line by line, flag anything that is off, and Bar Cop keeps your costs current and your vendor honest.'] },
      { h: 'Start With The Vendor', p: ['Pick the vendor up top, then set the date and who took the delivery in. Invoice number and driver are optional, but worth keeping for your records and any credit claim down the road.'] },
      { h: 'Match Your Order', p: ['If you placed this order through Bar Cop, pick it from Open Order and every line pre-fills with what you ordered. Bar Cop sets the order Received when you save, so it drops off your Order Sheet. No order on file means a walk-in delivery, so add the lines by hand.'] },
      { h: 'Check Each Line', p: ['Go down your invoice and confirm the quantity and unit price on every line. Unit price pre-fills from your product master. Bottle beer is received by the case, so the qty is cases and the price is per case. Everything else is in its own container unit.'] },
      { h: 'Flag What Is Off', p: ['When a price does not match your master cost, or you got fewer than you ordered, Bar Cop flags the line and gives you a Flag Discrepancy button. Filing it opens a pre-filled claim that lands in Profit Recovery under Vendor Discrepancies for credit follow-up.'] },
      { h: 'Saving The Delivery', p: ['If any prices changed, Bar Cop asks which ones should become your new cost from here on. Apply the real increases and leave the ones you plan to dispute. Saved deliveries feed your on-hand stock, your usage and variance reports, and Vendor Watch.'] }
    ]);
  },

  productOptions() {
    const prods = this.products();
    const cats = [...new Set(prods.map(p => p.category || 'Other'))]
      .sort((a, b) => {
        const ia = this.CAT_ORDER.indexOf(a), ib = this.CAT_ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    let h = '<option value="">Select product...</option>';
    cats.forEach(cat => {
      h += '<optgroup label="' + esc(cat) + '">';
      prods.filter(p => (p.category || 'Other') === cat)
        .forEach(p => { h += '<option value="' + p.id + '">' + esc(p.name) + '</option>'; });
      h += '</optgroup>';
    });
    return h;
  },

  lineHTML(lid) {
    return '<div class="rd-line" data-lid="' + lid + '" data-ext="0" '
      + 'style="border:1px solid var(--b1);border-radius:6px;padding:12px 14px;margin-bottom:10px;">'
      + '<div class="form-row" style="gap:10px;align-items:flex-end;margin-bottom:0;">'
      + '<div class="f" style="flex:1.4;min-width:170px;"><label>Product</label>'
      + '<select class="rd-prod">' + this.productOptions() + '</select></div>'
      + '<div class="f" style="width:132px;flex-shrink:0;"><label>Qty Received ' + tt('rd-qty') + '</label>'
      + '<input type="number" class="rd-qty" min="0" step="0.01" placeholder="0"/></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Unit Price ' + tt('rd-price') + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre rd-price" type="number" min="0" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Extended</label>'
      + '<div class="f-display rd-ext">$0</div></div>'
      + '<button type="button" class="btn btn-ghost btn-sm rd-remove" style="margin-bottom:2px;">Remove</button>'
      + '</div>'
      // Discrepancy controls sit below the data row: the Flag button (or the
      // Logged badge once filed) shows right above the line that spells out
      // what is off, so the operator reads the prompt then the reason.
      + '<button type="button" class="btn btn-ghost btn-sm rd-flag-btn" style="display:none;margin-top:10px;border-color:var(--gold);color:var(--gold);">Flag Discrepancy</button>'
      + '<span class="rd-flag-logged" style="display:none;margin-top:10px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gold);">Discrepancy Logged</span>'
      + '<div class="rd-flag" style="display:none;font-size:11px;font-weight:700;margin-top:8px;"></div>'
      + '</div>';
  },

  renderForm() {
    if (this.vendors().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Add a vendor first</div>'
        + '<div class="empty-sub">A delivery is logged against a vendor. Add the distributors you '
        + 'receive from in the Vendors screen, then come back to record a delivery.</div>'
        + '<button class="btn btn-primary" id="rd-go-vendors">Go to Vendors</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#rd-go-vendors')) App.navigate('ic-vendors'); };
      return;
    }
    if (this.products().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">No products to receive</div>'
        + '<div class="empty-sub">Add products in the Products screen before recording a delivery.</div>'
        + '</div></div>';
      return;
    }

    this._seq = 0;
    const vendorOpts = '<option value="">Select vendor...</option>'
      + this.vendors().map(v => '<option value="' + esc(v.name) + '">' + esc(v.name) + '</option>').join('');
    const today = new Date().toISOString().slice(0, 10);

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Delivery Details</span>'
      + '<button class="btn btn-ghost btn-sm" id="rd-how">How This Works</button></div>'
      + '<div class="form-row" style="gap:12px;">'
      + '<div class="f" style="flex:1.3;min-width:150px;"><label>Vendor</label><select id="rd-vendor">' + vendorOpts + '</select></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Date</label><input type="date" id="rd-date" value="' + today + '"/></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Invoice #</label><input type="text" id="rd-invoice" placeholder="Optional"/></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Driver</label><input type="text" id="rd-driver" placeholder="Optional"/></div>'
      + '<div class="f" style="flex:1.2;min-width:150px;"><label>Received By</label>'
      + '<select id="rd-by">' + App.staffOptions(App.activeManagerId(), { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'
      // Open Order picker. Hidden until a vendor with at least one open
      // order is selected. Picking an order pre-fills the line items so the
      // operator does not re-enter what they already ordered.
      + '<div class="form-row" style="gap:16px;" id="rd-order-row">'
        + '<div class="f" style="flex:1;min-width:280px;"><label>Open Order</label>'
          + '<select id="rd-order"><option value="">No open orders for this vendor</option></select>'
        + '</div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="rd-notes" rows="2" placeholder="Optional"></textarea></div></div>'
      + '</div>'
      + '<div class="card"><div class="card-title">Line Items</div>'
      + '<div id="rd-lines">' + this.lineHTML(++this._seq) + '</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:4px;">'
        + '<button class="btn btn-ghost btn-sm" id="rd-add">+ Add Line Item</button>'
      + '</div>'
      + '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Line Items</div><div class="calc-val" id="rd-count">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Price Changes</div><div class="calc-val" id="rd-changes">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Short Counts</div><div class="calc-val" id="rd-shorts">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Delivery Total</div><div class="calc-val good" id="rd-total">$0</div></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="rd-save">Save Delivery</button>'
      + '<span id="rd-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    // Hide the Open Order row until a vendor is picked.
    const orderRow = document.getElementById('rd-order-row');
    if (orderRow) orderRow.style.display = 'none';

    document.getElementById('rd-how')?.addEventListener('click', () => this.showHowTo());
    document.getElementById('rd-vendor')?.addEventListener('change', (ev) => this.onVendorChange(ev.target.value));
    document.getElementById('rd-order')?.addEventListener('change', (ev) => this.onOrderPick(ev.target.value));

    const lines = document.getElementById('rd-lines');
    const onInput = ev => {
      const line = ev.target.closest('.rd-line');
      if (!line) return;
      if (ev.target.classList.contains('rd-prod')) {
        const p = this.productById(ev.target.value);
        line.querySelector('.rd-price').value = p && p.unit_cost != null ? p.unit_cost : '';
        // Switching the product detaches this line from the matched order's
        // quantity, so clear the stashed ordered qty to avoid a phantom short count.
        line.dataset.orderedQty = '';
        line.dataset.shortCount = '';
      }
      this.recalcLine(line);
      this.recalcTotal();
    };
    lines.addEventListener('input', onInput);
    lines.addEventListener('change', onInput);
    lines.addEventListener('click', ev => {
      if (ev.target.closest('.rd-remove')) {
        ev.target.closest('.rd-line').remove();
        this.recalcTotal();
      }
    });

    document.getElementById('rd-add')?.addEventListener('click', () => {
      lines.insertAdjacentHTML('beforeend', this.lineHTML(++this._seq));
      this.recalcTotal();
    });
    document.getElementById('rd-save')?.addEventListener('click', () => this.save());
    // Flag a line for discrepancy: opens an inline modal pre-filled with the
    // line's ordered/delivered/agreed/invoiced data.
    document.getElementById('rd-lines')?.addEventListener('click', (ev) => {
      const flagBtn = ev.target.closest('.rd-flag-btn');
      if (flagBtn) this.openDiscrepancyModal(flagBtn.closest('.rd-line'));
    });

    this.container.onclick = null;
  },

  recalcLine(line) {
    const qty   = parseFloat(line.querySelector('.rd-qty').value) || 0;
    const price = parseFloat(line.querySelector('.rd-price').value);
    const ext   = qty * (isNaN(price) ? 0 : price);
    line.dataset.ext = ext;
    line.querySelector('.rd-ext').textContent = App.fmtCurrency(ext);

    const p = this.productById(line.querySelector('.rd-prod').value);
    // For bottle beer with case_size, qty is in cases and unit_cost is
    // cost-per-case. The Qty Received and Unit Price tooltips spell that out.
    const isCaseBeer = p && p.category === 'Bottle Beer' && p.case_size && p.case_size > 0;

    const flag = line.querySelector('.rd-flag');
    const flagBtn = line.querySelector('.rd-flag-btn');
    const messages = [];
    let hasPriceChange = false;
    if (p && p.unit_cost != null && !isNaN(price) && Math.abs(price - p.unit_cost) > 0.001) {
      const up = price > p.unit_cost;
      const priceLabel = isCaseBeer ? ' per case' : '';
      messages.push('Price ' + (up ? 'up' : 'down') + ' from ' + App.fmtCurrency(p.unit_cost) + priceLabel + ' to ' + App.fmtCurrency(price) + priceLabel + '.');
      hasPriceChange = true;
    }
    const orderedQty = parseFloat(line.dataset.orderedQty);
    let hasShortCount = false;
    if (!isNaN(orderedQty) && orderedQty > 0 && qty >= 0 && qty < orderedQty) {
      const shortBy = orderedQty - qty;
      messages.push('Short count: ordered ' + orderedQty + ', received ' + qty + ' (short ' + shortBy + ').');
      line.dataset.shortCount = '1';
      hasShortCount = true;
    } else {
      line.dataset.shortCount = '';
    }
    if (messages.length > 0) {
      flag.style.display = '';
      flag.style.color = 'var(--gold)';
      flag.textContent = messages.join(' ');
    } else {
      flag.style.display = 'none';
      flag.textContent = '';
    }

    // Show the Flag Discrepancy button when a real diff is detected, AND
    // the line has not already been flagged. The "Discrepancy Logged" badge
    // takes over once filed.
    const alreadyLogged = line.dataset.discrepancyId === '1' || line.dataset.discrepancyId === 'logged';
    if (flagBtn) {
      flagBtn.style.display = (!alreadyLogged && (hasPriceChange || hasShortCount)) ? '' : 'none';
    }
  },

  recalcTotal() {
    const lines = [...document.querySelectorAll('.rd-line')];
    let total = 0, count = 0, changes = 0, shorts = 0;
    lines.forEach(line => {
      const ext = parseFloat(line.dataset.ext) || 0;
      total += ext;
      const prod = line.querySelector('.rd-prod').value;
      const qty = parseFloat(line.querySelector('.rd-qty').value) || 0;
      if (prod && qty > 0) count++;
      // Price-change vs short-count: distinguish by checking the data flag.
      if (line.querySelector('.rd-flag').style.display !== 'none') {
        const p = this.productById(prod);
        const price = parseFloat(line.querySelector('.rd-price').value);
        if (p && p.unit_cost != null && !isNaN(price) && Math.abs(price - p.unit_cost) > 0.001) changes++;
      }
      if (line.dataset.shortCount === '1') shorts++;
    });
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('rd-count', count);
    set('rd-changes', changes);
    set('rd-shorts', shorts);
    set('rd-total', App.fmtCurrency(total));
  },

  // ── Vendor + Open Order pickers ──────────────────────────────────────────
  // When operator selects a vendor, populate the Open Order picker with that
  // vendor's open/submitted orders. Picking an order pre-fills the line items
  // with the ordered products + quantities so the operator just confirms or
  // adjusts. Skip the picker entirely (walk-in delivery) by leaving it on the
  // default "No matched order" option.
  onVendorChange(vendorName) {
    const orderRow = document.getElementById('rd-order-row');
    const orderSel = document.getElementById('rd-order');
    if (!orderRow || !orderSel) return;
    const open = this.openOrdersForVendor(vendorName);
    if (open.length === 0) {
      orderRow.style.display = 'none';
      orderSel.innerHTML = '<option value="">No open orders for this vendor</option>';
    } else {
      orderRow.style.display = '';
      const opts = ['<option value="">No matched order (walk-in delivery)</option>']
        .concat(open.map(o => {
          const label = (o.date || '') + '  ·  ' + (o.item_count || (o.line_items || []).length) + ' items  ·  ' + App.fmtCurrency(o.total || 0) + (o.status === 'Submitted' ? '  ·  Submitted' : '  ·  Open');
          return '<option value="' + esc(o.id) + '">' + esc(label) + '</option>';
        }));
      orderSel.innerHTML = opts.join('');
      orderSel.value = '';
    }
  },

  onOrderPick(orderId) {
    if (!orderId) {
      // Operator cleared the order pick (walk-in). Keep the existing form
      // lines so they do not lose typed-in data.
      return;
    }
    const order = this.orders().find(o => o.id === orderId);
    if (!order) return;
    const linesEl = document.getElementById('rd-lines');
    if (!linesEl) return;

    // Replace the existing line(s) with one per order item, pre-filled.
    linesEl.innerHTML = '';
    (order.line_items || []).forEach(li => {
      const prod = this.resolveProduct(li.product_id, li.name);
      const lid  = ++this._seq;
      linesEl.insertAdjacentHTML('beforeend', this.lineHTML(lid));
      const line = linesEl.querySelector('.rd-line[data-lid="' + lid + '"]');
      if (!line) return;
      const prodSel = line.querySelector('.rd-prod');
      const qtyInp  = line.querySelector('.rd-qty');
      const priceInp = line.querySelector('.rd-price');
      if (prod) {
        prodSel.value = prod.id;
      }
      qtyInp.value   = li.qty != null ? li.qty : '';
      priceInp.value = (prod && prod.unit_cost != null) ? prod.unit_cost : (li.unit_cost != null ? li.unit_cost : '');
      // Stash ordered qty for short-count detection on every recalc.
      line.dataset.orderedQty = li.qty != null ? li.qty : '';
      this.recalcLine(line);
    });
    this.recalcTotal();
  },

  // ── Discrepancy modal — opens from a flagged line ────────────────────────
  // Pre-fills date, vendor, product, agreed price, invoiced price, and
  // calculated overcharge. Operator adds notes and saves. Discrepancy record
  // lands in App.data.vendor_discrepancies and surfaces on the Profit
  // Recovery Vendor Discrepancies screen. Operator stays on Receive Delivery
  // throughout — modal closes back to the same screen on save or cancel.
  // Vendor dropdown options for the discrepancy modal. Selected vendor
  // pre-fills from the parent Receive Delivery form. Preserves any legacy
  // vendor name that no longer matches a saved record.
  _vendorOptionsForModal(selected) {
    const vendors = ((App.inventoryData && App.inventoryData.ic_vendors) || [])
      .slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    let h = '<option value="">Select vendor...</option>';
    vendors.forEach(v => {
      h += '<option value="' + esc(v.name) + '"' + (selected === v.name ? ' selected' : '') + '>' + esc(v.name) + '</option>';
    });
    if (selected && !vendors.some(v => v.name === selected)) {
      h += '<option value="' + esc(selected) + '" selected>' + esc(selected) + ' (unsaved)</option>';
    }
    return h;
  },

  openDiscrepancyModal(line) {
    if (!line) return;
    const vendor = document.getElementById('rd-vendor')?.value || '';
    const date   = document.getElementById('rd-date')?.value || new Date().toISOString().slice(0, 10);
    const invoice = document.getElementById('rd-invoice')?.value.trim() || '';

    const productId = line.querySelector('.rd-prod')?.value || '';
    const product = this.productById(productId);
    const productName = product?.name || '(unrecorded)';

    const qty = parseFloat(line.querySelector('.rd-qty')?.value) || 0;
    const invoicedPrice = parseFloat(line.querySelector('.rd-price')?.value);
    const agreedPrice = product?.unit_cost != null ? product.unit_cost : null;
    const orderedQtyRaw = line.dataset.orderedQty;
    const orderedQty = (orderedQtyRaw === '' || orderedQtyRaw == null) ? null : parseFloat(orderedQtyRaw);

    const hasPriceChange = (agreedPrice != null && !isNaN(invoicedPrice) && Math.abs(invoicedPrice - agreedPrice) > 0.001);
    const hasShortCount  = (orderedQty != null && !isNaN(orderedQty) && orderedQty > 0 && qty < orderedQty);

    // Pick the most likely type based on what's wrong.
    let suggestedType = 'Other';
    if (hasShortCount && hasPriceChange) suggestedType = 'Other';
    else if (hasShortCount) suggestedType = 'Short Count';
    else if (hasPriceChange) suggestedType = 'Price Overcharge';

    // Calculate overcharge dollars based on the issue type.
    let overcharge = 0;
    if (hasShortCount && agreedPrice != null) overcharge += (orderedQty - qty) * agreedPrice;
    if (hasPriceChange && qty > 0) overcharge += (invoicedPrice - agreedPrice) * qty;
    if (overcharge < 0) overcharge = 0;

    const TYPES = ['Price Overcharge', 'Short Count', 'Substitution', 'Damaged Goods', 'Other'];
    const typeOpts = TYPES.map(t => '<option value="' + t + '"' + (t === suggestedType ? ' selected' : '') + '>' + t + '</option>').join('');

    const m = document.createElement('div');
    m.id = 'rd-discrepancy-modal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;';
    m.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;max-width:620px;width:100%;max-height:82vh;overflow:hidden;display:flex;flex-direction:column;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:1px solid var(--b2);flex-shrink:0;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">File Discrepancy</div>'
        + '<button type="button" class="btn btn-ghost btn-sm" id="rd-disc-close">Close</button>'
      + '</div>'
      + '<div style="padding:20px 22px 24px;overflow-y:auto;">'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:16px;">Fill this with what was wrong, then save. The discrepancy goes to Profit Recovery > Vendor Discrepancies for credit recovery follow-up. You can adjust the numbers if needed.</div>'
        + '<div class="form-row" style="gap:12px;">'
          + '<div class="f" style="width:160px;"><label>Date</label><input type="date" id="rd-disc-date" value="' + esc(date) + '"/></div>'
          + '<div class="f" style="flex:1;min-width:200px;"><label>Vendor</label><select id="rd-disc-vendor">' + this._vendorOptionsForModal(vendor) + '</select></div>'
          + '<div class="f" style="width:160px;"><label>Invoice / Reference</label><input type="text" id="rd-disc-ref" value="' + esc(invoice) + '"/></div>'
        + '</div>'
        + '<div class="form-row" style="gap:12px;">'
          + '<div class="f" style="flex:1;min-width:220px;"><label>Product</label><input type="text" id="rd-disc-product" value="' + esc(productName) + '"/></div>'
          + '<div class="f" style="width:180px;"><label>Type</label><select id="rd-disc-type">' + typeOpts + '</select></div>'
        + '</div>'
        + '<div class="form-row" style="gap:12px;">'
          + '<div class="f" style="width:100px;"><label>Units</label><input type="number" id="rd-disc-units" step="1" value="' + (hasShortCount ? (orderedQty - qty) : qty) + '"/></div>'
          + '<div class="f" style="width:130px;"><label>Agreed Price</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rd-disc-agreed" step="0.01" value="' + (agreedPrice != null ? agreedPrice.toFixed(2) : '') + '"/></div></div>'
          + '<div class="f" style="width:130px;"><label>Invoiced Price</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rd-disc-invoiced" step="0.01" value="' + (!isNaN(invoicedPrice) ? invoicedPrice.toFixed(2) : '') + '"/></div></div>'
          + '<div class="f" style="width:150px;"><label>Overcharge / Loss</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="rd-disc-overcharge" step="0.01" value="' + overcharge.toFixed(2) + '"/></div></div>'
        + '</div>'
        + '<div class="form-row" style="gap:12px;">'
          + '<div class="f" style="flex:1;min-width:260px;"><label>Notes</label><input type="text" id="rd-disc-notes" placeholder="What was wrong, and who you contacted"/></div>'
        + '</div>'
        + '<div id="rd-disc-err" style="color:var(--red);font-size:12px;margin-bottom:10px;display:none;"></div>'
        + '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px;">'
          + '<button type="button" id="rd-disc-cancel" class="btn btn-ghost">Cancel</button>'
          + '<button type="button" id="rd-disc-file" class="btn btn-primary">File Discrepancy</button>'
        + '</div>'
      + '</div>'
    + '</div>';
    document.body.appendChild(m);
    const close = () => m.remove();
    m.addEventListener('click', ev => { if (ev.target === m) close(); });
    document.getElementById('rd-disc-close').addEventListener('click', close);
    document.getElementById('rd-disc-cancel').addEventListener('click', close);
    document.getElementById('rd-disc-file').addEventListener('click', () => this.saveDiscrepancy(line, close));
  },

  async saveDiscrepancy(line, closeFn) {
    const errEl = document.getElementById('rd-disc-err');
    const fail = m => { if (errEl) { errEl.textContent = m; errEl.style.display = 'inline'; } };
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

    const date = document.getElementById('rd-disc-date')?.value;
    const vendor = document.getElementById('rd-disc-vendor')?.value.trim();
    if (!date) { fail('Date is required.'); return; }
    if (!vendor) { fail('Vendor is required.'); return; }

    const rec = {
      id:             App.uid(),
      date,
      vendor,
      reference:      document.getElementById('rd-disc-ref')?.value.trim() || '',
      type:           document.getElementById('rd-disc-type')?.value || 'Other',
      sku:            document.getElementById('rd-disc-product')?.value.trim() || '',
      units:          parseFloat(document.getElementById('rd-disc-units')?.value) || 0,
      agreed_price:   parseFloat(document.getElementById('rd-disc-agreed')?.value) || 0,
      invoiced_price: parseFloat(document.getElementById('rd-disc-invoiced')?.value) || 0,
      overcharge:     parseFloat(document.getElementById('rd-disc-overcharge')?.value) || 0,
      notes:          document.getElementById('rd-disc-notes')?.value.trim() || '',
      status:         'Open',
      source:         'receive-delivery',
      created_at:     new Date().toISOString()
    };

    if (!Array.isArray(App.data.vendor_discrepancies)) App.data.vendor_discrepancies = [];
    App.data.vendor_discrepancies.push(rec);
    const ok = await App.saveKey('vendor_discrepancies');
    if (!ok && ok !== undefined) {
      App.data.vendor_discrepancies.pop();
      fail('Could not save the discrepancy. Try again.');
      return;
    }

    // Mark the line as logged so the Flag button hides and the badge shows.
    line.dataset.discrepancyId = '1';
    const flagBtn = line.querySelector('.rd-flag-btn');
    const loggedBadge = line.querySelector('.rd-flag-logged');
    if (flagBtn) flagBtn.style.display = 'none';
    if (loggedBadge) loggedBadge.style.display = '';

    if (closeFn) closeFn();
  },

  // ── Save ──────────────────────────────────────────────────────────────────
  async save() {
    if (!App.canEdit('ic-receive-delivery')) return;   // staff-permission guard
    const err = document.getElementById('rd-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };

    const vendor = document.getElementById('rd-vendor')?.value;
    if (!vendor) { fail('Choose a vendor.'); return; }

    const lineEls = [...document.querySelectorAll('.rd-line')];
    const lineItems = [];
    let priceChanges = 0;
    const productUpdates = [];

    let shortCounts = 0;
    lineEls.forEach(line => {
      const pid   = line.querySelector('.rd-prod').value;
      const qty   = parseFloat(line.querySelector('.rd-qty').value);
      const price = parseFloat(line.querySelector('.rd-price').value);
      if (!pid || isNaN(qty) || qty <= 0) return;
      const p = this.productById(pid);
      if (!p) return;
      const prevPrice = p.unit_cost != null ? p.unit_cost : null;
      const unitPrice = isNaN(price) ? prevPrice : price;
      const changed = prevPrice != null && unitPrice != null && Math.abs(unitPrice - prevPrice) > 0.001;
      if (changed) { priceChanges++; productUpdates.push({ product: p, newPrice: unitPrice, prevPrice }); }
      // Short count: ordered_qty came from the matched order (data attribute);
      // a delivered qty under the ordered qty flags this line for the
      // Vendor Discrepancy auto-fill in Phase 4.
      const orderedQtyRaw = line.dataset.orderedQty;
      const orderedQty = (orderedQtyRaw === '' || orderedQtyRaw == null) ? null : parseFloat(orderedQtyRaw);
      const shortCount = (orderedQty != null && !isNaN(orderedQty) && orderedQty > 0 && qty < orderedQty);
      if (shortCount) shortCounts++;
      const isCaseBeer = (p.category === 'Bottle Beer') && p.case_size && p.case_size > 0;
      lineItems.push({
        product_id:        pid,
        name:              p.name,
        container_size_oz: p.container_size_oz != null ? p.container_size_oz : null,
        qty,
        price_per_unit:    unitPrice,
        prev_price:        prevPrice,
        price_changed:     changed,
        ordered_qty:       (orderedQty != null && !isNaN(orderedQty)) ? orderedQty : null,
        short_count:       shortCount,
        extended:          unitPrice != null ? qty * unitPrice : 0,
        // For case-tracked bottle beer, qty is in cases and unit price is
        // cost-per-case. case_size_at_receive snapshots the value so
        // downstream variance math can multiply through to bottles even
        // if the product's case_size changes later.
        display_unit:        isCaseBeer ? 'case' : 'unit',
        case_size_at_receive: isCaseBeer ? p.case_size : null,
        total_units:         isCaseBeer ? (qty * p.case_size) : qty
      });
    });

    if (lineItems.length === 0) { fail('Add at least one line item with a product and quantity.'); return; }

    // Phase 1: confirm price-master updates before they apply. Operator can
    // uncheck any change they want to dispute (file as discrepancy) without
    // committing the new price to the product master. Unchecked changes stay
    // on the delivery record only.
    let appliedUpdates = productUpdates;
    if (productUpdates.length > 0) {
      const selectedSet = await this._confirmPriceChanges(productUpdates);
      if (selectedSet === null) return;  // operator cancelled the save
      appliedUpdates = productUpdates.filter((_, i) => selectedSet.has(i));
    }

    const matchedOrderId = document.getElementById('rd-order')?.value || '';

    const record = {
      id:             App.uid(),
      vendor,
      date:           document.getElementById('rd-date')?.value || new Date().toISOString().slice(0, 10),
      invoice_number: document.getElementById('rd-invoice')?.value.trim() || '',
      driver:         document.getElementById('rd-driver')?.value.trim() || '',
      received_by_id: document.getElementById('rd-by')?.value || '',
      received_by:    (App.staffById(document.getElementById('rd-by')?.value) || {}).name || '',
      notes:          document.getElementById('rd-notes')?.value.trim() || '',
      line_items:     lineItems,
      item_count:     lineItems.length,
      total:          lineItems.reduce((s, i) => s + (i.extended || 0), 0),
      price_change_count:         priceChanges,
      price_change_applied_count: appliedUpdates.length,
      short_count_count:  shortCounts,
      matched_order_id:   matchedOrderId || null,
      has_discrepancy: priceChanges > 0 || shortCounts > 0,
      created_at:     new Date().toISOString()
    };

    // Apply selected price changes to the product master. For case-tracked
    // Bottle Beer, newPrice is per-case (operator enters per-case in the
    // form), so divide by case_size before computing cost_per_pour and
    // pour_cost_pct. Every applied update appends a cost_history entry so
    // price drift is auditable.
    appliedUpdates.forEach(({ product, newPrice, prevPrice }) => {
      product.unit_cost = newPrice;
      const pours = product.container_size_oz && product.pour_size_oz
        ? product.container_size_oz / product.pour_size_oz : null;
      product.pours_per_container = pours;
      const perBottle = App.bottleCost(product);
      product.cost_per_pour = pours && perBottle != null ? perBottle / pours : null;
      product.pour_cost_pct = product.cost_per_pour != null && product.menu_price
        ? product.cost_per_pour / product.menu_price * 100 : null;
      if (!Array.isArray(product.cost_history)) product.cost_history = [];
      product.cost_history.push({
        date:        record.date,
        old_cost:    prevPrice,
        new_cost:    newPrice,
        vendor,
        delivery_id: record.id,
        source:      'delivery'
      });
    });

    const btn = document.getElementById('rd-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    this.deliveries().push(record);

    // Auto-mark the matched order as Received so the Order Sheet stops
    // hiding the vendor and the operator gets a clean inventory picture
    // for the next order cycle.
    if (matchedOrderId) {
      const order = this.orders().find(o => o.id === matchedOrderId);
      if (order && order.status !== 'Received') {
        order.status = 'Received';
        order.received_at = new Date().toISOString();
        order.received_delivery_id = record.id;
      }
    }

    const ok = await App.saveInventory();
    if (ok) {
      App.markSetupDone('gs_ic_delivery');
      this.renderDone(record);
    } else {
      this.deliveries().pop();
      if (btn) { btn.disabled = false; btn.textContent = 'Save Delivery'; }
      fail('Save failed. Try again.');
    }
  },

  renderDone(record) {
    const applied = record.price_change_applied_count || 0;
    const total   = record.price_change_count || 0;
    let priceLine = '';
    if (applied > 0) {
      priceLine = '<div style="font-size:11px;color:var(--gold);font-weight:700;margin-top:8px;">'
        + applied + ' price change' + (applied === 1 ? '' : 's')
        + ' applied to the product master &middot; flagged for Vendor Watch</div>';
    } else if (total > 0) {
      priceLine = '<div style="font-size:11px;color:var(--t3);font-weight:700;margin-top:8px;">'
        + total + ' price change' + (total === 1 ? '' : 's')
        + ' logged on this delivery only &middot; product master cost unchanged</div>';
    }
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div style="text-align:center;padding:14px 0;">'
      + '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" style="margin-bottom:12px;">'
      + '<circle cx="20" cy="20" r="17" stroke="var(--gold)" stroke-width="1.8"/>'
      + '<path d="M12 20.5l5.5 5.5L28 14" stroke="var(--gold)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:6px;">Delivery Recorded</div>'
      + '<div style="font-size:12px;color:var(--t3);">' + esc(record.vendor) + ' &middot; ' + record.item_count
      + ' line item' + (record.item_count === 1 ? '' : 's') + ' &middot; ' + App.fmtCurrency(record.total) + '</div>'
      + priceLine
      + '</div>'
      + '<div class="card-actions" style="justify-content:center;">'
      + '<button class="btn btn-ghost" id="rd-again">Receive Another</button>'
      + '<button class="btn btn-primary" id="rd-history">View Delivery History</button>'
      + '</div></div></div>';
    this.container.onclick = null;
    document.getElementById('rd-again')?.addEventListener('click', () => this.renderForm());
    document.getElementById('rd-history')?.addEventListener('click', () => App.navigate('ic-delivery-history'));
  },

  // Promise-based confirmation: returns null if operator cancelled, or a Set
  // of indexes the operator confirmed to apply to the product master. The
  // delivery itself still saves with the original per-line price either way;
  // this only controls whether the new price becomes the new master cost.
  _confirmPriceChanges(updates) {
    return new Promise(resolve => {
      const m = document.createElement('div');
      m.id = 'rdp-modal';
      m.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;padding:40px 20px;background:rgba(0,0,0,0.65);';

      const rows = updates.map((u, i) => {
        const isCase = (u.product.category === 'Bottle Beer') && u.product.case_size && u.product.case_size > 0;
        const unit = isCase ? '/case' : '';
        const up = u.newPrice > u.prevPrice;
        const arrow = up ? '&#9650;' : '&#9660;';
        const color = up ? 'var(--red)' : 'var(--gold)';
        const delta = Math.abs(u.newPrice - u.prevPrice);
        const pct = u.prevPrice > 0 ? Math.round(delta / u.prevPrice * 100) : 0;
        return '<label style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--b2);cursor:pointer;">'
          + '<input type="checkbox" class="rdp-chk" data-idx="' + i + '" checked style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;flex-shrink:0;"/>'
          + '<div style="flex:1;">'
            + '<div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(u.product.name) + '</div>'
            + '<div style="font-size:11px;color:var(--t3);margin-top:3px;">'
              + App.fmtCurrency(u.prevPrice) + unit + ' &rarr; '
              + '<span style="color:' + color + ';font-weight:700;">' + App.fmtCurrency(u.newPrice) + unit + ' ' + arrow + ' ' + pct + '%</span>'
            + '</div>'
          + '</div>'
        + '</label>';
      }).join('');

      m.innerHTML = '<div style="background:var(--bg);border:1px solid var(--b1);border-radius:8px;max-width:520px;width:100%;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,0.55);">'
        + '<div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--w);margin-bottom:10px;">Update Product Master Costs?</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:16px;">'
          + 'Bar Cop spotted ' + updates.length + ' price change' + (updates.length === 1 ? '' : 's') + ' on this delivery. '
          + 'Apply the ones that should become the new cost from here on. Uncheck anything you plan to dispute, and file a discrepancy on those lines after saving.'
        + '</div>'
        + '<div style="max-height:320px;overflow-y:auto;margin-bottom:18px;">' + rows + '</div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">'
          + '<div style="display:flex;gap:10px;">'
            + '<button type="button" class="btn btn-ghost btn-sm" id="rdp-all">Check All</button>'
            + '<button type="button" class="btn btn-ghost btn-sm" id="rdp-none">Uncheck All</button>'
          + '</div>'
          + '<div style="display:flex;gap:10px;">'
            + '<button type="button" id="rdp-cancel" class="btn btn-ghost">Back to Edit</button>'
            + '<button type="button" id="rdp-confirm" class="btn btn-primary">Save Delivery</button>'
          + '</div>'
        + '</div>'
      + '</div>';

      document.body.appendChild(m);
      const close = result => { m.remove(); resolve(result); };
      const setAll = val => { m.querySelectorAll('.rdp-chk').forEach(c => { c.checked = val; }); };
      document.getElementById('rdp-all')?.addEventListener('click', () => setAll(true));
      document.getElementById('rdp-none')?.addEventListener('click', () => setAll(false));
      document.getElementById('rdp-cancel').addEventListener('click', () => close(null));
      document.getElementById('rdp-confirm').addEventListener('click', () => {
        const checked = [...m.querySelectorAll('.rdp-chk:checked')].map(c => parseInt(c.dataset.idx, 10));
        close(new Set(checked));
      });
    });
  }
};
