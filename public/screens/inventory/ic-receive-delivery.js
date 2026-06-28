'use strict';

/* ── Inventory Control — Receive Delivery (writes ic_deliveries) ──────────────
   Logs a vendor delivery line by line. Unit price pre-fills from the product
   master and is editable; any difference is flagged as a price change. On save
   the delivery is recorded, and products whose price changed have their unit
   cost (and pour metrics) updated so Profit Recovery stays current. */

S.InventoryReceiveDelivery = {
  _seq: 0,
  _pendingOrderId: null,   // set by Order History "Log the Delivery" to pre-load an order
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
      { p: ['Receiving a delivery logs what actually showed up against what you ordered and what you got charged. Match it to your invoice line by line, flag anything that is off, and Bar Cop keeps your costs current and your vendor honest. Do it the moment the driver is still on the dock, while you can still hand back a case or get a signature on a short count.'] },
      { h: 'Start With The Vendor', p: ['Pick the vendor up top, then set the date and who took the delivery in. Invoice number and driver are optional, but worth keeping for your records and any credit claim down the road. When you select Republic National, Bar Cop checks for any open orders you placed with them and offers them in the Open Order picker.'] },
      { h: 'Match Your Order', p: ['If you placed this order through Bar Cop, it is waiting in the Open Order picker, newest first, and Bar Cop pre-fills the most recent one so you just confirm it against the invoice. That also arms the short-count check, since Bar Cop knows what was supposed to show up, and it marks the order Received when you save so it drops off your Order Sheet. If this delivery is not one of your Bar Cop orders, or the vendor has none on file, pick No matched order (walk-in delivery) and add the lines by hand. Either way the delivery records and feeds your stock, usage, and variance.'] },
      { h: 'Check Each Line', p: ['Go down your invoice and confirm the quantity and unit price on every line. Unit price pre-fills from your product master, so you are really just confirming it still matches. Bottle beer is received by the case, so the qty is cases and the price is per case. A delivery of Modelo Especial is entered as 4 cases at the per-case price, not 96 bottles. Everything else is in its own container unit: liquor and wine by the bottle, draft by the keg.'] },
      { h: 'Flag What Is Off', p: ['When a price does not match your master cost, or you got fewer than you ordered, Bar Cop calls it out on the line and gives you a Flag button. Say your 750ml well vodka was costing 18.00 a bottle and the invoice reads 21.50. Bar Cop catches the 3.50 jump, multiplies it across every bottle on the line, and the Flag button opens a pre-filled claim with the overcharge already figured. File it right there and it lands in Vendor Tracker under Discrepancies, where you chase the credit.'] },
      { h: 'Print a Worksheet', p: ['Use the Worksheet button up top to print a blank Delivery Inspection Sheet. Take it to the dock, check every line by hand as the truck unloads, and enter anything that came in off back here, or later from Delivery History.'] },
      { h: 'Saving The Delivery', p: ['If any prices changed, Bar Cop asks which ones should become your new cost from here on. Apply the real increases so your pour costs stay honest, and check Dispute on the ones you are not eating, which files the vendor discrepancy claim in the same step. When a price increase pushes any menu item over its cost target, Bar Cop names that item right on the confirmation so you know what to re-price before the new cost quietly eats your margin. Saved deliveries feed your on-hand stock, your usage and variance reports, and the Vendor Tracker.'] }
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

  // One line item = one table row, plus a hidden full-width sub-row that shows
  // the discrepancy detail (price change / short count) only when the line is
  // off. The row itself highlights gold when flagged. Matches the Void/Comp
  // ing-tbl batch builder.
  lineHTML(lid) {
    return '<tr class="rd-line" data-lid="' + lid + '" data-ext="0">'
      + '<td><select class="form-input rd-prod" style="width:100%;">' + this.productOptions() + '</select></td>'
      + '<td><input class="form-input rd-qty" type="number" min="0" step="0.01" placeholder="0" style="width:100%;"/></td>'
      + '<td><div class="fw"><span class="pre">$</span><input class="form-input pre rd-price" type="number" min="0" step="0.01" placeholder="0.00" style="width:100%;"/></div></td>'
      + '<td class="rd-ext val" style="white-space:nowrap;">$0.00</td>'
      + '<td><div class="row-actions">'
        + '<span class="rd-flag-msg" style="display:none;font-size:10px;font-weight:600;color:var(--gold);align-self:center;text-align:right;white-space:nowrap;"></span>'
        + '<button type="button" class="btn btn-ghost btn-sm rd-flag-btn" style="display:none;background:var(--gold-tint);border:1px solid var(--gold-tint-bord);white-space:nowrap;">Flag</button>'
        + '<button type="button" class="btn btn-ghost btn-sm rd-disc-status" style="display:none;white-space:nowrap;background:var(--gold-tint);border:1px solid var(--gold-tint-bord);">Filed</button>'
        + '<button type="button" class="btn btn-danger btn-sm rd-remove">Delete</button>'
      + '</div></td>'
      + '</tr>';
  },

  renderForm() {
    if (this.vendors().length === 0 || this.products().length === 0) {
      App.setupCard(this.container, {
        title: 'Set Up Receiving',
        lead: 'Receiving logs what showed up against what you ordered and flags price changes before they cost you. Two quick steps and you can record a delivery.',
        steps: [
          { title: 'Add your vendors', desc: 'A delivery is logged against a vendor, so add the distributors you receive from.', btn: 'Add Vendors', screen: 'ic-vendors', done: this.vendors().length > 0 },
          { title: 'Add your products', desc: 'Add the products you stock so a delivery has line items to receive.', btn: 'Add Products', screen: 'ic-product-setup', done: this.products().length > 0 }
        ]
      });
      return;
    }

    this._seq = 0;
    const vendorOpts = '<option value="">Select vendor...</option>'
      + this.vendors().map(v => '<option value="' + esc(v.name) + '">' + esc(v.name) + '</option>').join('');
    const today = App.todayLocal();

    // One flowing form card: delivery details up top (Worksheet across from the
    // heading), then the line-item builder, the totals box, Notes at the bottom,
    // and the save actions.
    const formCard = '<div class="card form-card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Delivery Details</span>'
      + '<button class="btn btn-ghost btn-sm no-print" id="rd-worksheet" type="button">Worksheet</button>'
      + '</div>'
      + '<div class="form-row" style="gap:12px;">'
      + '<div class="f" style="flex:1.3;min-width:150px;"><label>Vendor</label><select id="rd-vendor">' + vendorOpts + '</select></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Date</label><input type="date" id="rd-date" value="' + today + '"/></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Invoice #</label><input type="text" id="rd-invoice" placeholder="Optional"/></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Driver</label><input type="text" id="rd-driver" placeholder="Optional"/></div>'
      + '<div class="f" style="flex:1.2;min-width:150px;"><label>Received By</label>'
      + '<select id="rd-by">' + App.staffOptions(App.activeManagerId(), { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'
      // Open Order picker. Hidden until a vendor with at least one open order is
      // selected. Picking an order pre-fills the line items.
      + '<div class="form-row" style="gap:16px;" id="rd-order-row">'
        + '<div class="f" style="flex:1;min-width:280px;"><label>Open Order</label>'
          + '<select id="rd-order"><option value="">No open orders for this vendor</option></select>'
        + '</div>'
      + '</div>'
      + '<div class="pill-wrap" style="margin:6px 0 12px;">'
      + '<table class="ing-tbl pill" style="table-layout:fixed;"><thead><tr>'
      + '<th style="width:280px;">Product</th>'
      + '<th style="width:130px;">Qty Received</th>'
      + '<th style="width:140px;">Unit Price</th>'
      + '<th style="width:110px;">Extended</th>'
      + '<th></th>'
      + '</tr></thead><tbody id="rd-lines">' + this.lineHTML(++this._seq) + '</tbody></table></div>'
      + '<button class="btn btn-ghost btn-sm" id="rd-add" type="button" style="margin-bottom:14px;">+ Add Line Item</button>'
      + '<div style="background:var(--input);border:1px solid var(--b-edge);border-radius:8px;padding:14px 18px;">'
      + '<div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Line Items</div><div class="calc-val lg" id="rd-count">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Price Changes</div><div class="calc-val lg" id="rd-changes">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Short Counts</div><div class="calc-val lg" id="rd-shorts">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Delivery Total</div><div class="calc-val lg" id="rd-total">$0.00</div></div>'
      + '</div></div>'
      + '<div class="form-row" style="gap:16px;margin-top:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="rd-notes" class="notes-ta" rows="2" placeholder="Optional"></textarea></div></div>'
      + '</div>';

    // Save actions sit below the card, like the other working screens.
    const saveRow = '<div style="margin-top:16px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="rd-save">Save Delivery</button>'
      + '<button class="btn btn-ghost" id="rd-startover">Start Over</button>'
      + '<span id="rd-err" style="color:var(--red);font-size:12px;display:none;"></span>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">' + formCard + saveRow + '</div>';

    const orderRow = document.getElementById('rd-order-row');
    if (orderRow) orderRow.style.display = 'none';

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
      if (ev.target.closest('.rd-remove')) { this.removeLine(ev.target.closest('.rd-line')); return; }
      const statusBtn = ev.target.closest('.rd-disc-status');
      if (statusBtn) { this.openLineDiscrepancy(statusBtn.closest('.rd-line')); return; }
      const flagBtn = ev.target.closest('.rd-flag-btn');
      if (flagBtn) { this.openLineDiscrepancy(flagBtn.closest('.rd-line')); return; }
    });

    document.getElementById('rd-add')?.addEventListener('click', () => {
      lines.insertAdjacentHTML('beforeend', this.lineHTML(++this._seq));
      this.recalcTotal();
      this._capture();
    });
    document.getElementById('rd-save')?.addEventListener('click', () => this.save());
    document.getElementById('rd-startover')?.addEventListener('click', () => this.startOver());
    document.getElementById('rd-worksheet')?.addEventListener('click', () => this.printWorksheet());

    this.container.onclick = null;
    this.recalcTotal();

    // Persist a half-entered delivery across leaving and returning. The .screen
    // wrapper is rebuilt every render, so this listener never stacks up.
    const screenEl = this.container.querySelector('.screen');
    if (screenEl) {
      const cap = () => this._capture();
      screenEl.addEventListener('input', cap);
      screenEl.addEventListener('change', cap);
    }

    // Deep-link from Order History "Log the Delivery": pre-load this order so the
    // operator lands on a ready-to-confirm form (vendor + order picked, every
    // line filled in). A deep-link is a fresh start, so it clears any stale draft;
    // otherwise restore an in-progress delivery. Saving still runs the full price /
    // short-count verification and auto-marks the order Received.
    const pendingId = this._pendingOrderId;
    this._pendingOrderId = null;
    if (pendingId) {
      this._draft = null; this._draftLines = null;
      const order = this.orders().find(o => o.id === pendingId);
      const vSel = document.getElementById('rd-vendor');
      if (order && vSel) {
        vSel.value = order.vendor || '';
        this.onVendorChange(vSel.value);
        const oSel = document.getElementById('rd-order');
        if (oSel) { oSel.value = order.id; this.onOrderPick(order.id); }
        const sc = this.container.closest('.content') || document.querySelector('.content');
        if (sc) sc.scrollTop = 0;
      }
      this._capture();
    } else if (this._draftLines && this._draftLines.length) {
      this._restoreDraft();
    }
  },

  // Remove a line: drop its data row; keep at least one.
  removeLine(line) {
    if (!line) return;
    line.remove();
    const lines = document.getElementById('rd-lines');
    if (lines && this.container.querySelectorAll('.rd-line').length === 0) {
      lines.insertAdjacentHTML('beforeend', this.lineHTML(++this._seq));
    }
    this.recalcTotal();
    this._capture();
  },

  // Start Over: clear the in-progress delivery (header + every line) back to a
  // blank form.
  startOver() {
    this._draft = null;
    this._draftLines = null;
    this.renderForm();
  },

  recalcLine(line) {
    const lid   = line.dataset.lid;
    const qty   = parseFloat(line.querySelector('.rd-qty').value) || 0;
    const price = parseFloat(line.querySelector('.rd-price').value);
    const ext   = qty * (isNaN(price) ? 0 : price);
    line.dataset.ext = ext;
    line.querySelector('.rd-ext').textContent = App.fmtCurrency(ext);

    const p = this.productById(line.querySelector('.rd-prod').value);

    const flag    = line.querySelector('.rd-flag-msg');
    const flagBtn = line.querySelector('.rd-flag-btn');
    // Short gold flag notes (kept terse so they never widen the row): "$0.40 Over"
    // for a price change, "Short QTY 2" for a short count. Joined with a middot
    // when both trip.
    const messages = [];
    let hasPriceChange = false;
    if (p && p.unit_cost != null && !isNaN(price) && Math.abs(price - p.unit_cost) > 0.001) {
      messages.push(App.fmtCurrency(Math.abs(price - p.unit_cost)) + (price > p.unit_cost ? ' Over' : ' Under'));
      hasPriceChange = true;
    }
    const orderedQty = parseFloat(line.dataset.orderedQty);
    let hasShortCount = false;
    if (!isNaN(orderedQty) && orderedQty > 0 && qty >= 0 && qty < orderedQty) {
      const shortBy = orderedQty - qty;
      messages.push('Short QTY ' + (Number.isInteger(shortBy) ? shortBy : shortBy.toFixed(2)));
      line.dataset.shortCount = '1';
      hasShortCount = true;
    } else {
      line.dataset.shortCount = '';
    }
    // The short gold note sits to the left of the Flag button while unfiled; once
    // a discrepancy is filed, the Filed / Resolved status button replaces both.
    const discId = line.dataset.discrepancyId;
    const alreadyLogged = !!discId;
    const statusBtn = line.querySelector('.rd-disc-status');
    if (flag) {
      if (!alreadyLogged && messages.length > 0) { flag.style.display = ''; flag.textContent = messages.join(' · '); }
      else { flag.style.display = 'none'; flag.textContent = ''; }
    }
    line.classList.toggle('rd-flagged', messages.length > 0);
    if (flagBtn) flagBtn.style.display = (!alreadyLogged && (hasPriceChange || hasShortCount)) ? '' : 'none';
    if (statusBtn) {
      if (alreadyLogged) {
        const rec = (App.data.vendor_discrepancies || []).find(x => x.id === discId);
        const resolved = rec && rec.status === 'Resolved';
        statusBtn.style.display = '';
        statusBtn.textContent = resolved ? 'Resolved' : 'Filed';
        statusBtn.style.color = resolved ? 'var(--green)' : '';
        statusBtn.style.background = resolved ? 'transparent' : 'var(--gold-tint)';
        statusBtn.style.borderColor = resolved ? 'var(--b1)' : 'var(--gold-tint-bord)';
      } else {
        statusBtn.style.display = 'none';
      }
    }
  },

  recalcTotal() {
    const lines = [...this.container.querySelectorAll('.rd-line')];
    let total = 0, count = 0, changes = 0, shorts = 0;
    lines.forEach(line => {
      total += parseFloat(line.dataset.ext) || 0;
      const prod = line.querySelector('.rd-prod').value;
      const qty = parseFloat(line.querySelector('.rd-qty').value) || 0;
      if (prod && qty > 0) count++;
      const p = this.productById(prod);
      const price = parseFloat(line.querySelector('.rd-price').value);
      if (p && p.unit_cost != null && !isNaN(price) && Math.abs(price - p.unit_cost) > 0.001) changes++;
      if (line.dataset.shortCount === '1') shorts++;
    });
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('rd-count', count);
    set('rd-changes', changes);
    set('rd-shorts', shorts);
    set('rd-total', App.fmtCurrency(total));
  },

  // ── Draft persistence (header fields + every line row) ───────────────────
  // Keep a half-entered delivery alive across leaving the screen and coming back.
  // In-memory, so a full reload starts fresh; saving the delivery clears it.
  _capture() {
    this._draft = App.captureDraft(this.container);
    this._draftLines = [...this.container.querySelectorAll('.rd-line')].map(line => ({
      product_id:    line.querySelector('.rd-prod')?.value || '',
      qty:           line.querySelector('.rd-qty')?.value || '',
      price:         line.querySelector('.rd-price')?.value || '',
      orderedQty:    line.dataset.orderedQty || '',
      shortCount:    line.dataset.shortCount || '',
      discrepancyId: line.dataset.discrepancyId || ''
    }));
  },
  _restoreDraft() {
    if (this._draft) App.restoreDraft(this.container, this._draft);
    // Re-run the vendor change so the Open Order picker matches, then show the
    // chosen order WITHOUT re-prefilling (that would overwrite the edited lines).
    const vSel = document.getElementById('rd-vendor');
    if (vSel && vSel.value) this.onVendorChange(vSel.value);
    if (this._draft && this._draft['rd-order']) {
      const oSel = document.getElementById('rd-order');
      if (oSel) oSel.value = this._draft['rd-order'];
    }
    const linesEl = document.getElementById('rd-lines');
    if (linesEl) {
      linesEl.innerHTML = '';
      this._draftLines.forEach(d => {
        const lid = ++this._seq;
        linesEl.insertAdjacentHTML('beforeend', this.lineHTML(lid));
        const line = linesEl.querySelector('.rd-line[data-lid="' + lid + '"]');
        if (!line) return;
        const prodSel = line.querySelector('.rd-prod'); if (prodSel) prodSel.value = d.product_id || '';
        const qtyInp = line.querySelector('.rd-qty');   if (qtyInp) qtyInp.value = d.qty || '';
        const priceInp = line.querySelector('.rd-price'); if (priceInp) priceInp.value = d.price || '';
        if (d.orderedQty)    line.dataset.orderedQty = d.orderedQty;
        if (d.shortCount)    line.dataset.shortCount = d.shortCount;
        if (d.discrepancyId) line.dataset.discrepancyId = d.discrepancyId;
        this.recalcLine(line);
      });
    }
    this.recalcTotal();
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
    const walkInOpt = '<option value="">No matched order (walk-in delivery)</option>';
    if (!vendorName) {
      // No vendor chosen yet — hide the picker entirely.
      orderRow.style.display = 'none';
      orderSel.innerHTML = walkInOpt;
      return;
    }
    // Always show the picker once a vendor is chosen, so a vendor with no open
    // orders still gets the walk-in cue (the box tells the operator to enter the
    // lines below).
    orderRow.style.display = '';
    const open = this.openOrdersForVendor(vendorName);
    if (open.length === 0) {
      orderSel.innerHTML = walkInOpt;
      orderSel.value = '';
      this.onOrderPick('');   // clean single line for a manual walk-in
      return;
    }
    // Open orders lead (newest first); walk-in is the fallback at the bottom.
    const opts = open.map(o => {
      const label = (o.date || '') + '  ·  ' + (o.item_count || (o.line_items || []).length) + ' items  ·  ' + App.fmtCurrency(o.total || 0) + (o.status === 'Submitted' ? '  ·  Submitted' : '  ·  Open');
      return '<option value="' + esc(o.id) + '">' + esc(label) + '</option>';
    });
    opts.push(walkInOpt);
    orderSel.innerHTML = opts.join('');
    // Default to the most recent open order and pre-fill it, so the pending
    // order is front-and-center instead of hidden behind the walk-in option.
    orderSel.value = open[0].id;
    this.onOrderPick(open[0].id);
  },

  onOrderPick(orderId) {
    const linesEl = document.getElementById('rd-lines');
    if (!orderId) {
      // Walk-in: this delivery is not one of the vendor's open orders, so reset
      // to a clean single line for manual entry (nothing to pre-fill or
      // short-count against).
      if (linesEl) {
        linesEl.innerHTML = '';
        linesEl.insertAdjacentHTML('beforeend', this.lineHTML(++this._seq));
      }
      this.recalcTotal();
      return;
    }
    const order = this.orders().find(o => o.id === orderId);
    if (!order) return;
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

  // ── Discrepancy: open the shared Vendor Tracker modal from a flagged line ──
  // File the claim and chase it to credit/resolution in place (no page leave),
  // against the same vendor_discrepancies record Vendor Tracker reads. The line
  // stores the record id so it reads Filed / Resolved. [[two-doors-same-data]]
  openLineDiscrepancy(line) {
    if (!line) return;
    const did = line.dataset.discrepancyId;
    const existing = (did && (App.data.vendor_discrepancies || []).some(x => x.id === did)) ? did : null;
    S.VendorTracker.openDiscrepancyModal({
      discrepancyId: existing,
      prefill: this.discPrefillForLine(line),
      onFiled: rec => { line.dataset.discrepancyId = rec.id; this.recalcLine(line); this._capture(); },
      onClose: () => this.recalcLine(line)
    });
  },

  // Pre-fill for the shared discrepancy modal, computed from the in-progress line.
  discPrefillForLine(line) {
    const vendor  = document.getElementById('rd-vendor')?.value || '';
    const date    = document.getElementById('rd-date')?.value || App.todayLocal();
    const invoice = document.getElementById('rd-invoice')?.value.trim() || '';
    const product = this.productById(line.querySelector('.rd-prod')?.value || '');
    const productName = product?.name || '(unrecorded)';
    const qty = parseFloat(line.querySelector('.rd-qty')?.value) || 0;
    const invoicedPrice = parseFloat(line.querySelector('.rd-price')?.value);
    const agreedPrice = product?.unit_cost != null ? product.unit_cost : null;
    const orderedQtyRaw = line.dataset.orderedQty;
    const orderedQty = (orderedQtyRaw === '' || orderedQtyRaw == null) ? null : parseFloat(orderedQtyRaw);
    const hasPriceChange = (agreedPrice != null && !isNaN(invoicedPrice) && Math.abs(invoicedPrice - agreedPrice) > 0.001);
    const hasShortCount  = (orderedQty != null && !isNaN(orderedQty) && orderedQty > 0 && qty < orderedQty);
    let type = 'Other';
    if (hasShortCount && !hasPriceChange) type = 'Short Count';
    else if (hasPriceChange) type = 'Price Overcharge';
    let overcharge = 0;
    if (hasShortCount && agreedPrice != null) overcharge += (orderedQty - qty) * agreedPrice;
    if (hasPriceChange && qty > 0) overcharge += (invoicedPrice - agreedPrice) * qty;
    if (overcharge < 0) overcharge = 0;
    return {
      date, vendor, reference: invoice, sku: productName, type,
      units: hasShortCount ? (orderedQty - qty) : qty,
      agreed_price: agreedPrice, invoiced_price: isNaN(invoicedPrice) ? null : invoicedPrice,
      overcharge, source: 'receive-delivery'
    };
  },

  // Blank Delivery Inspection Sheet to print and fill at the dock; the manager
  // enters anything off after the fact via this screen or Delivery History.
  printWorksheet() {
    App.printBlankSheet({
      title: 'Delivery Inspection Sheet',
      subtitle: 'Check every line at the dock. Anything off, write it down and file it in Bar Cop after close.',
      columns: [
        { label: 'Vendor', width: '13%' }, { label: 'Product', width: '17%' },
        { label: 'Ordered Qty', width: '10%' }, { label: 'Received Qty', width: '10%' },
        { label: 'Agreed Price', width: '10%' }, { label: 'Invoiced Price', width: '11%' },
        { label: 'Issue', width: '13%' }, { label: 'Receiver', width: '16%' }
      ],
      rows: 18
    });
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
      if (changed) { priceChanges++; productUpdates.push({ product: p, newPrice: unitPrice, prevPrice, qty, alreadyFlagged: !!line.dataset.discrepancyId }); }
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
    let disputedUpdates = [];
    if (productUpdates.length > 0) {
      const choice = await this._confirmPriceChanges(productUpdates);
      if (choice === null) return;  // operator cancelled the save
      appliedUpdates  = productUpdates.filter((_, i) => choice.apply.has(i));
      // Disputed price changes auto-file a vendor discrepancy claim below
      // (skip lines the operator already filed by hand during entry).
      disputedUpdates = productUpdates.filter((u, i) => choice.dispute.has(i) && !u.alreadyFlagged);
    }

    const matchedOrderId = document.getElementById('rd-order')?.value || '';

    const record = {
      id:             App.uid(),
      vendor,
      date:           document.getElementById('rd-date')?.value || App.todayLocal(),
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

    // Cost creep: before the new costs land, snapshot the cost% of every menu
    // item that uses a product whose price ROSE in this delivery, so afterward we
    // can name the items pushed over their target and attribute the jump.
    const risenUpdates = appliedUpdates.filter(u => u.newPrice > u.prevPrice);
    const risenById = {}; risenUpdates.forEach(u => { risenById[u.product.id] = u; });
    const creepItems = App.menuItemsUsingProducts(new Set(Object.keys(risenById)));
    const creepBefore = {}; creepItems.forEach(it => { creepBefore[it.id] = App.menuItemPct(it); });

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

    // Now the new costs are live — name the menu items pushed over target by the
    // price increases, with the ingredient(s) that drove each one.
    const itemDrivers = it => {
      const ids = new Set();
      if (it.linked_product_id && risenById[it.linked_product_id]) ids.add(it.linked_product_id);
      ((it.recipe && it.recipe.ingredients) || []).forEach(ing => {
        const id = ing.id || ing.product_id;
        if ((ing.source || (ing.product_id ? 'product' : null)) === 'product' && id && risenById[id]) ids.add(id);
      });
      return [...ids].map(id => risenById[id]);
    };
    const creepHits = creepItems
      .map(it => ({ item: it, before: creepBefore[it.id], after: App.menuItemPct(it), drivers: itemDrivers(it) }))
      .filter(c => c.after.over)
      .sort((a, b) => {
        const ac = (a.before && !a.before.over) ? 1 : 0, bc = (b.before && !b.before.over) ? 1 : 0;
        if (ac !== bc) return bc - ac;   // items that just crossed over, first
        return (b.after.pct - b.after.target) - (a.after.pct - a.after.target);
      });

    const btn = document.getElementById('rd-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    // Auto-mark the matched order as Received so the Order Sheet stops
    // hiding the vendor and the operator gets a clean inventory picture
    // for the next order cycle.
    let matchedOrder = null;
    if (matchedOrderId) {
      const order = this.orders().find(o => o.id === matchedOrderId);
      if (order && order.status !== 'Received') {
        order.status = 'Received';
        order.received_at = new Date().toISOString();
        order.received_delivery_id = record.id;
        matchedOrder = order;
      }
    }

    // Persist DELIVERY FIRST so a mid-write failure leaves the delivery on
    // record (replayable) rather than a product cost change with no delivery
    // behind it: the delivery (row), then cost changes (config blob), then the
    // matched order's new status (row).
    const okDel = await App.putRecord('ic', 'delivery', record);
    const okCfg = appliedUpdates.length ? await App.saveInventory() : true;
    const okOrd = matchedOrder ? await App.putRecord('ic', 'order', matchedOrder) : true;
    const ok = okDel && okCfg && okOrd;
    if (ok) {
      App.markSetupDone('gs_ic_delivery');
      this._draft = null; this._draftLines = null;
      const filed = await this._autoFileDisputes(disputedUpdates, { vendor, date: record.date, invoice: record.invoice_number });
      this.renderDone(record, filed, creepHits);
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Delivery'; }
      fail('Save failed. Try again.');
    }
  },

  // File a vendor discrepancy claim for each DISPUTED price change (the ones the
  // operator chose not to accept as the new cost) so "dispute" actually files
  // the claim in one step. Lands in Profit Recovery > Vendor Discrepancies.
  async _autoFileDisputes(disputed, ctx) {
    let filed = 0;
    for (const u of (disputed || [])) {
      const overcharge = Math.max(0, (u.newPrice - u.prevPrice) * (u.qty || 0));
      const rec = {
        id:             App.uid(),
        date:           ctx.date,
        vendor:         ctx.vendor,
        reference:      ctx.invoice || '',
        type:           'Price Overcharge',
        sku:            u.product.name,
        units:          u.qty || 0,
        agreed_price:   u.prevPrice != null ? u.prevPrice : 0,
        invoiced_price: u.newPrice != null ? u.newPrice : 0,
        overcharge,
        notes:          'Auto-filed from the delivery: price disputed, not accepted as the new cost.',
        status:         'Open',
        source:         'receive-delivery',
        created_at:     new Date().toISOString()
      };
      const okR = await App.putRecord('core', 'vendor_discrepancy', rec);
      if (okR) filed++;
    }
    return filed;
  },

  renderDone(record, disputesFiled, creepHits) {
    const applied = record.price_change_applied_count || 0;
    const total   = record.price_change_count || 0;
    const disputeLine = disputesFiled > 0
      ? '<div style="font-size:11px;color:var(--gold);font-weight:700;margin-top:8px;">'
        + disputesFiled + ' disputed price change' + (disputesFiled === 1 ? '' : 's')
        + ' filed as a vendor discrepancy &middot; follow up in Profit Recovery</div>'
      : '';
    let priceLine = '';
    if (applied > 0) {
      priceLine = '<div style="font-size:11px;color:var(--gold);font-weight:700;margin-top:8px;">'
        + applied + ' price change' + (applied === 1 ? '' : 's')
        + ' applied to the product master &middot; flagged for Vendor Tracker</div>';
    } else if (total > 0) {
      priceLine = '<div style="font-size:11px;color:var(--t3);font-weight:700;margin-top:8px;">'
        + total + ' price change' + (total === 1 ? '' : 's')
        + ' logged on this delivery only &middot; product master cost unchanged</div>';
    }
    // Cost-creep notice: the price increases on this delivery just pushed these
    // menu items over their cost target. Named + attributed, with a jump to the
    // full Recipe Summary diagnostic.
    let creepLine = '';
    if (creepHits && creepHits.length) {
      const rows = creepHits.slice(0, 6).map(c => {
        const beforeTxt = (c.before && c.before.pct != null) ? Math.round(c.before.pct) + '% &rarr; ' : '';
        const drv = (c.drivers || []).map(d => esc(d.product.name) + ' ' + App.fmtCurrency(d.prevPrice) + ' &rarr; ' + App.fmtCurrency(d.newPrice)).join(' &middot; ');
        return '<div style="padding:7px 0;border-top:1px solid var(--b2);">'
          + '<div style="font-size:12px;"><span style="color:var(--t1);font-weight:600;">' + esc(c.item.name) + '</span>'
          + '<span style="color:var(--red);font-weight:700;margin-left:8px;">' + beforeTxt + Math.round(c.after.pct) + '% '
          + '<span style="color:var(--t3);font-weight:400;">(target ' + Math.round(c.after.target) + '%)</span></span></div>'
          + (drv ? '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + drv + '</div>' : '') + '</div>';
      }).join('');
      const n = creepHits.length;
      creepLine = '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-top:14px;text-align:left;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:6px;">Cost Creep</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.5;">This delivery pushes ' + n + ' menu item' + (n === 1 ? '' : 's') + ' over ' + (n === 1 ? 'its' : 'their') + ' cost target:</div>'
        + rows
        + '<button class="btn btn-ghost btn-sm" id="rd-creep-review" style="margin-top:10px;">Review in Recipe Summary</button>'
        + '</div>';
    }
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div style="text-align:center;padding:14px 0;">'
      + '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" style="margin-bottom:12px;">'
      + '<circle cx="20" cy="20" r="17" stroke="var(--green)" stroke-width="1.8"/>'
      + '<path d="M12 20.5l5.5 5.5L28 14" stroke="var(--green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:6px;">Delivery Recorded</div>'
      + '<div style="font-size:12px;color:var(--t3);">' + esc(record.vendor) + ' &middot; ' + record.item_count
      + ' line item' + (record.item_count === 1 ? '' : 's') + ' &middot; ' + App.fmtCurrency(record.total) + '</div>'
      + priceLine + disputeLine
      + '</div>'
      + creepLine
      + '<div class="card-actions" style="justify-content:center;">'
      + '<button class="btn btn-ghost" id="rd-again">Receive Another</button>'
      + '<button class="btn btn-primary" id="rd-history">View Delivery History</button>'
      + '</div></div></div>';
    this.container.onclick = null;
    document.getElementById('rd-again')?.addEventListener('click', () => this.renderForm());
    document.getElementById('rd-history')?.addEventListener('click', () => App.navigate('ic-delivery-history'));
    document.getElementById('rd-creep-review')?.addEventListener('click', () => App.openScreen('recipe-cost-analysis'));
  },

  // Promise-based: resolves null if cancelled, else { apply:Set, dispute:Set }
  // of line indexes. Apply = make it the new master cost. Dispute = file a
  // vendor discrepancy claim (auto-filed on save). Independent per line, so a
  // disputed overcharge is "don't apply + file claim" in one screen.
  _confirmPriceChanges(updates) {
    return new Promise(resolve => {
      const rows = updates.map((u, i) => {
        const isCase = (u.product.category === 'Bottle Beer') && u.product.case_size && u.product.case_size > 0;
        const unit = isCase ? '/case' : '';
        const up = u.newPrice > u.prevPrice;
        const arrow = up ? '&#9650;' : '&#9660;';
        const color = up ? 'var(--red)' : 'var(--gold)';
        const delta = Math.abs(u.newPrice - u.prevPrice);
        const pct = u.prevPrice > 0 ? Math.round(delta / u.prevPrice * 100) : 0;
        const chk = (cls, label, checked) => '<label style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--t2);cursor:pointer;">'
          + '<input type="checkbox" class="bc-check ' + cls + '" data-idx="' + i + '"' + (checked ? ' checked' : '') + '/>' + label + '</label>';
        return '<div style="padding:12px 0;border-bottom:1px solid var(--b2);">'
          + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
            + '<div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(u.product.name) + '</div>'
            + '<div style="font-size:11px;color:var(--t3);">' + App.fmtCurrency(u.prevPrice) + unit + ' &rarr; <span style="color:' + color + ';font-weight:700;">' + App.fmtCurrency(u.newPrice) + unit + ' ' + arrow + ' ' + pct + '%</span></div>'
          + '</div>'
          + '<div style="display:flex;gap:18px;margin-top:8px;">' + chk('rdp-apply', 'Apply as new cost', true) + chk('rdp-dispute', 'Dispute (file claim)', false) + '</div>'
        + '</div>';
      }).join('');

      const html = '<div class="card form-card" style="margin:0;"><div class="card-title">Price Changes on This Delivery</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:6px;">Bar Cop spotted ' + updates.length + ' price change' + (updates.length === 1 ? '' : 's') + '. For each, keep <strong>Apply</strong> to make it your new cost, and check <strong>Dispute</strong> to file a vendor discrepancy claim for the overcharge.</div>'
        + '<div style="max-height:48vh;overflow-y:auto;">' + rows + '</div>'
        + '<div class="card-actions">'
        + '<button type="button" id="rdp-confirm" class="btn btn-primary">Save Delivery</button>'
        + '<button type="button" id="rdp-cancel" class="btn btn-ghost">Back to Edit</button>'
        + '</div></div>';
      App.openModal(html, { id: 'rdp-modal', maxWidth: 560, noClose: true });
      const collect = cls => new Set([...document.querySelectorAll('.' + cls + ':checked')].map(c => parseInt(c.dataset.idx, 10)));
      document.getElementById('rdp-cancel')?.addEventListener('click', () => { App.closeModal('rdp-modal'); resolve(null); });
      document.getElementById('rdp-confirm')?.addEventListener('click', () => {
        const apply = collect('rdp-apply');
        const dispute = collect('rdp-dispute');
        App.closeModal('rdp-modal');
        resolve({ apply, dispute });
      });
    });
  }
};
