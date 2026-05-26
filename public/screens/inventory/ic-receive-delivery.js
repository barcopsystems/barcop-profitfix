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
      + '<div class="form-row" style="gap:12px;margin-bottom:10px;">'
      + '<div class="f" style="flex:1;min-width:180px;"><label>Product</label>'
      + '<select class="rd-prod">' + this.productOptions() + '</select></div></div>'
      + '<div class="form-row" style="gap:12px;align-items:flex-end;margin-bottom:0;">'
      + '<div class="f" style="width:100px;flex-shrink:0;"><label>Qty Received</label>'
      + '<input type="number" class="rd-qty" min="0" step="0.01" placeholder="0"/></div>'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>Unit Price</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre rd-price" type="number" min="0" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>Extended</label>'
      + '<div class="f-display rd-ext">$0</div></div>'
      + '<button type="button" class="btn btn-ghost btn-sm rd-remove" style="margin-bottom:2px;">Remove</button>'
      + '</div>'
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
      + '<div class="card"><div class="card-title">Delivery Details</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f w-md"><label>Vendor</label><select id="rd-vendor">' + vendorOpts + '</select></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label><input type="date" id="rd-date" value="' + today + '"/></div>'
      + '<div class="f w-md"><label>Invoice #</label><input type="text" id="rd-invoice" placeholder="Optional"/></div>'
      + '<div class="f w-md"><label>Driver</label><input type="text" id="rd-driver" placeholder="Optional"/></div>'
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
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:12px;line-height:1.6;">'
        + 'Type line items manually, or upload the vendor\'s PDF invoice and Bar Cop will pre-fill what it can read. '
        + 'Image-based PDFs (scans) will not parse. Most vendor-emailed PDFs work.'
      + '</div>'
      + '<div id="rd-lines">' + this.lineHTML(++this._seq) + '</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:4px;">'
        + '<button class="btn btn-ghost btn-sm" id="rd-add">+ Add Line Item</button>'
        + '<button class="btn btn-ghost btn-sm" id="rd-pdf-btn">Upload Invoice PDF</button>'
        + '<input type="file" id="rd-pdf-file" accept="application/pdf" style="display:none;"/>'
        + '<span id="rd-pdf-status" style="font-size:11px;color:var(--t3);display:none;"></span>'
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

    document.getElementById('rd-vendor')?.addEventListener('change', (ev) => this.onVendorChange(ev.target.value));
    document.getElementById('rd-order')?.addEventListener('change', (ev) => this.onOrderPick(ev.target.value));

    const lines = document.getElementById('rd-lines');
    const onInput = ev => {
      const line = ev.target.closest('.rd-line');
      if (!line) return;
      if (ev.target.classList.contains('rd-prod')) {
        const p = this.productById(ev.target.value);
        line.querySelector('.rd-price').value = p && p.unit_cost != null ? p.unit_cost : '';
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

    // PDF invoice upload (text PDFs only; image PDFs won't parse). Operator
    // confirms every line after pre-fill so any parser miss is correctable.
    document.getElementById('rd-pdf-btn')?.addEventListener('click', () => {
      document.getElementById('rd-pdf-file')?.click();
    });
    document.getElementById('rd-pdf-file')?.addEventListener('change', (ev) => this.handlePdfUpload(ev));

    this.container.onclick = null;
  },

  // ── PDF Invoice Upload (text PDFs only) ──────────────────────────────────
  // PDF.js extracts the page text, a generic heuristic finds lines that
  // look like invoice line items (description + qty + currency price), and
  // each detected item is matched against ic_products by name substring.
  // Matches get appended as form lines for operator review. Anything we
  // cannot parse stays missing and the operator types it manually. Vendor
  // invoice formats vary too much for a single parser to nail every one;
  // this is a workable starting point that can be tuned with per-vendor
  // template overrides later if any specific format proves popular.
  setPdfStatus(text, color, opts) {
    const el = document.getElementById('rd-pdf-status');
    if (!el) return;
    if (!text) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = '';
    el.style.color = color || 'var(--t3)';
    el.style.lineHeight = '1.6';
    el.style.maxWidth = '640px';
    let html = esc(text);
    if (opts && opts.contactButton) {
      html += ' <button class="btn btn-ghost btn-sm" id="rd-pdf-contact" style="margin-left:6px;">Send to Bar Cop</button>';
    }
    el.innerHTML = html;
    if (opts && opts.contactButton) {
      document.getElementById('rd-pdf-contact')?.addEventListener('click', () => {
        if (window.S && S.HubSupport && S.HubSupport.open) S.HubSupport.open();
      });
    }
  },

  async handlePdfUpload(ev) {
    const file = ev.target?.files?.[0];
    ev.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    if (!window.pdfjsLib) {
      this.setPdfStatus('PDF reader did not load. Hard refresh the page (Ctrl+Shift+R) and try again.', 'var(--red)');
      return;
    }

    this.setPdfStatus('Reading ' + file.name + '...', 'var(--t3)');
    try {
      const buf = await file.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data: buf });
      const pdf = await loadingTask.promise;
      let allText = '';
      const allLines = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        // PDF.js returns text items with their position. Group items into
        // logical lines by y-coordinate so column-oriented invoices read
        // as one row per item rather than a stream of fragments.
        const byY = new Map();
        content.items.forEach(it => {
          if (!it.str) return;
          const y = Math.round((it.transform?.[5] ?? 0) * 10) / 10;
          if (!byY.has(y)) byY.set(y, []);
          byY.get(y).push({ x: it.transform?.[4] ?? 0, str: it.str });
        });
        const yKeys = [...byY.keys()].sort((a, b) => b - a); // top to bottom
        yKeys.forEach(y => {
          const fragments = byY.get(y).sort((a, b) => a.x - b.x).map(f => f.str.trim()).filter(Boolean);
          if (fragments.length === 0) return;
          const line = fragments.join(' ').replace(/\s+/g, ' ').trim();
          if (line.length > 0) allLines.push(line);
        });
        allText += allLines.join('\n') + '\n';
      }

      if (allLines.length === 0) {
        this.setPdfStatus('This looks like a scanned image PDF, not a text PDF. Bar Cop can only read text-based PDFs (the kind a vendor emails out of their billing system). Type the items manually below.', 'var(--red)');
        return;
      }

      const detected = this.parseInvoiceLines(allLines);
      if (detected.length === 0) {
        this.setPdfStatus(
          'Bar Cop could not detect line items in this vendor\'s PDF format. Type the items manually below. If you want this vendor supported, send the PDF to Bar Cop and we will add the format.',
          'var(--red)',
          { contactButton: true }
        );
        return;
      }

      const matched = this.matchDetectedToProducts(detected);
      this.appendDetectedLines(matched);

      const matchCount = matched.filter(m => m.product).length;
      const skipCount  = matched.length - matchCount;
      if (matchCount === 0) {
        this.setPdfStatus(
          'Bar Cop detected ' + matched.length + ' line' + (matched.length === 1 ? '' : 's') + ' in the PDF but none matched a product in your master list. Type the items manually below, or send the PDF to Bar Cop so we can improve the matching for this vendor.',
          'var(--red)',
          { contactButton: true }
        );
        return;
      }
      let msg = matchCount + ' item' + (matchCount === 1 ? '' : 's') + ' added.';
      if (skipCount > 0) {
        msg += ' ' + skipCount + ' detected line' + (skipCount === 1 ? '' : 's') + ' could not be matched to a product in your master list and were skipped. Add them manually below if needed.';
      }
      msg += ' Review every line before saving.';
      this.setPdfStatus(msg, 'var(--gold)');
    } catch (e) {
      console.error('PDF upload error:', e);
      this.setPdfStatus('Could not read this PDF: ' + (e?.message || 'unknown error'), 'var(--red)');
    }
  },

  // Generic line parser. Looks for rows with a description + integer qty +
  // 1-2 currency amounts. Returns [{ name, qty, unitPrice }].
  parseInvoiceLines(lines) {
    const out = [];
    // Patterns to try, in priority order. Each captures (description, qty, unit, extended OR description, qty, unit).
    // PDF text often arrives as "DESCRIPTION ... QTY UNIT_PRICE EXTENDED" or "QTY DESCRIPTION UNIT EXTENDED".
    const patterns = [
      // "Description QTY UnitPrice ExtendedPrice" at end of line
      /^(.+?)\s+(\d+(?:\.\d+)?)\s+\$?(\d+(?:,\d{3})*\.\d{2})\s+\$?(\d+(?:,\d{3})*\.\d{2})\s*$/,
      // "QTY Description UnitPrice ExtendedPrice"
      /^(\d+(?:\.\d+)?)\s+(.+?)\s+\$?(\d+(?:,\d{3})*\.\d{2})\s+\$?(\d+(?:,\d{3})*\.\d{2})\s*$/,
      // "Description QTY UnitPrice" (no extended column)
      /^(.+?)\s+(\d+(?:\.\d+)?)\s+\$?(\d+(?:,\d{3})*\.\d{2})\s*$/
    ];
    const normNum = s => parseFloat(String(s).replace(/,/g, ''));

    lines.forEach(line => {
      // Skip obvious header/footer rows
      if (/^(subtotal|total|tax|invoice|date|po\s*#|account|terms|thank|page|due)/i.test(line)) return;
      // Skip lines too short to be a real item
      if (line.length < 8) return;

      let m = line.match(patterns[0]);
      if (m) {
        const name = m[1].trim();
        const qty  = normNum(m[2]);
        const unit = normNum(m[3]);
        if (qty > 0 && unit > 0 && name.length >= 2 && /[A-Za-z]/.test(name)) {
          out.push({ name, qty, unitPrice: unit });
          return;
        }
      }
      m = line.match(patterns[1]);
      if (m) {
        const qty  = normNum(m[1]);
        const name = m[2].trim();
        const unit = normNum(m[3]);
        if (qty > 0 && unit > 0 && name.length >= 2 && /[A-Za-z]/.test(name)) {
          out.push({ name, qty, unitPrice: unit });
          return;
        }
      }
      m = line.match(patterns[2]);
      if (m) {
        const name = m[1].trim();
        const qty  = normNum(m[2]);
        const unit = normNum(m[3]);
        if (qty > 0 && unit > 0 && name.length >= 2 && /[A-Za-z]/.test(name)) {
          out.push({ name, qty, unitPrice: unit });
        }
      }
    });
    return out;
  },

  matchDetectedToProducts(detected) {
    const all = (App.inventoryData?.ic_products || []).filter(p => p.active !== false);
    return detected.map(d => {
      const lower = d.name.toLowerCase();
      // 1) Try exact name match first (case-insensitive)
      let product = all.find(p => (p.name || '').toLowerCase() === lower);
      // 2) Try substring match either direction
      if (!product) {
        product = all.find(p => {
          const pn = (p.name || '').toLowerCase();
          return pn.length >= 3 && (lower.includes(pn) || pn.includes(lower));
        });
      }
      // 3) Try token overlap on the first meaningful word
      if (!product) {
        const tokens = lower.split(/\s+/).filter(t => t.length >= 4);
        if (tokens.length > 0) {
          product = all.find(p => {
            const pn = (p.name || '').toLowerCase();
            return tokens.some(t => pn.includes(t));
          });
        }
      }
      return { ...d, product: product || null };
    });
  },

  appendDetectedLines(matchedItems) {
    const linesEl = document.getElementById('rd-lines');
    if (!linesEl) return;
    matchedItems.forEach(m => {
      if (!m.product) return; // skip unmatched
      const lid = ++this._seq;
      linesEl.insertAdjacentHTML('beforeend', this.lineHTML(lid));
      const line = linesEl.querySelector('.rd-line[data-lid="' + lid + '"]');
      if (!line) return;
      const prodSel  = line.querySelector('.rd-prod');
      const qtyInp   = line.querySelector('.rd-qty');
      const priceInp = line.querySelector('.rd-price');
      prodSel.value  = m.product.id;
      qtyInp.value   = m.qty;
      priceInp.value = m.unitPrice;
      this.recalcLine(line);
    });
    this.recalcTotal();
  },

  recalcLine(line) {
    const qty   = parseFloat(line.querySelector('.rd-qty').value) || 0;
    const price = parseFloat(line.querySelector('.rd-price').value);
    const ext   = qty * (isNaN(price) ? 0 : price);
    line.dataset.ext = ext;
    line.querySelector('.rd-ext').textContent = App.fmtCurrency(ext);

    const p = this.productById(line.querySelector('.rd-prod').value);
    const flag = line.querySelector('.rd-flag');
    const messages = [];
    if (p && p.unit_cost != null && !isNaN(price) && Math.abs(price - p.unit_cost) > 0.001) {
      const up = price > p.unit_cost;
      messages.push('Price ' + (up ? 'up' : 'down') + ' from ' + App.fmtCurrency(p.unit_cost) + ' to ' + App.fmtCurrency(price) + ' (master will update).');
    }
    const orderedQty = parseFloat(line.dataset.orderedQty);
    if (!isNaN(orderedQty) && orderedQty > 0 && qty > 0 && qty < orderedQty) {
      const shortBy = orderedQty - qty;
      messages.push('Short count: ordered ' + orderedQty + ', received ' + qty + ' (short ' + shortBy + ').');
      line.dataset.shortCount = '1';
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
      return;
    }
    orderRow.style.display = '';
    const opts = ['<option value="">No matched order (walk-in delivery)</option>']
      .concat(open.map(o => {
        const label = (o.date || '') + '  ·  ' + (o.item_count || (o.line_items || []).length) + ' items  ·  ' + App.fmtCurrency(o.total || 0) + (o.status === 'Submitted' ? '  ·  Submitted' : '  ·  Open');
        return '<option value="' + esc(o.id) + '">' + esc(label) + '</option>';
      }));
    orderSel.innerHTML = opts.join('');
    orderSel.value = '';
  },

  onOrderPick(orderId) {
    if (!orderId) return;
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

  // ── Save ──────────────────────────────────────────────────────────────────
  async save() {
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
      if (changed) { priceChanges++; productUpdates.push({ product: p, newPrice: unitPrice }); }
      // Short count: ordered_qty came from the matched order (data attribute);
      // a delivered qty under the ordered qty flags this line for the
      // Vendor Discrepancy auto-fill in Phase 4.
      const orderedQtyRaw = line.dataset.orderedQty;
      const orderedQty = (orderedQtyRaw === '' || orderedQtyRaw == null) ? null : parseFloat(orderedQtyRaw);
      const shortCount = (orderedQty != null && !isNaN(orderedQty) && orderedQty > 0 && qty < orderedQty);
      if (shortCount) shortCounts++;
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
        extended:          unitPrice != null ? qty * unitPrice : 0
      });
    });

    if (lineItems.length === 0) { fail('Add at least one line item with a product and quantity.'); return; }

    // Apply price changes to the product master
    productUpdates.forEach(({ product, newPrice }) => {
      product.unit_cost = newPrice;
      const pours = product.container_size_oz && product.pour_size_oz
        ? product.container_size_oz / product.pour_size_oz : null;
      product.pours_per_container = pours;
      product.cost_per_pour = pours && newPrice != null ? newPrice / pours : null;
      product.pour_cost_pct = product.cost_per_pour != null && product.menu_price
        ? product.cost_per_pour / product.menu_price * 100 : null;
    });

    const matchedOrderId = document.getElementById('rd-order')?.value || '';

    const record = {
      id:             App.uid(),
      vendor,
      date:           document.getElementById('rd-date')?.value || new Date().toISOString().slice(0, 10),
      invoice_number: document.getElementById('rd-invoice')?.value.trim() || '',
      driver:         document.getElementById('rd-driver')?.value.trim() || '',
      notes:          document.getElementById('rd-notes')?.value.trim() || '',
      line_items:     lineItems,
      item_count:     lineItems.length,
      total:          lineItems.reduce((s, i) => s + (i.extended || 0), 0),
      price_change_count: priceChanges,
      short_count_count:  shortCounts,
      matched_order_id:   matchedOrderId || null,
      has_discrepancy: priceChanges > 0 || shortCounts > 0,
      created_at:     new Date().toISOString()
    };

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
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div style="text-align:center;padding:14px 0;">'
      + '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" style="margin-bottom:12px;">'
      + '<circle cx="20" cy="20" r="17" stroke="var(--gold)" stroke-width="1.8"/>'
      + '<path d="M12 20.5l5.5 5.5L28 14" stroke="var(--gold)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      + '<div style="font-size:16px;font-weight:800;color:var(--t1);margin-bottom:6px;">Delivery Recorded</div>'
      + '<div style="font-size:12px;color:var(--t3);">' + esc(record.vendor) + ' &middot; ' + record.item_count
      + ' line item' + (record.item_count === 1 ? '' : 's') + ' &middot; ' + App.fmtCurrency(record.total) + '</div>'
      + (record.price_change_count
          ? '<div style="font-size:11px;color:var(--gold);font-weight:700;margin-top:8px;">'
            + record.price_change_count + ' price change' + (record.price_change_count === 1 ? '' : 's')
            + ' applied to the product master &middot; flagged for Vendor Watch</div>'
          : '')
      + '</div>'
      + '<div class="card-actions" style="justify-content:center;">'
      + '<button class="btn btn-ghost" id="rd-again">Receive Another</button>'
      + '<button class="btn btn-primary" id="rd-history">View Delivery History</button>'
      + '</div></div></div>';
    this.container.onclick = null;
    document.getElementById('rd-again')?.addEventListener('click', () => this.renderForm());
    document.getElementById('rd-history')?.addEventListener('click', () => App.navigate('ic-delivery-history'));
  }
};
