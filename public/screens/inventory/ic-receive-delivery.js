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
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="rd-notes" rows="2" placeholder="Optional"></textarea></div></div>'
      + '</div>'
      + '<div class="card"><div class="card-title">Line Items</div>'
      + '<div id="rd-lines">' + this.lineHTML(++this._seq) + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="rd-add">+ Add Line Item</button>'
      + '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Line Items</div><div class="calc-val" id="rd-count">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Price Changes</div><div class="calc-val" id="rd-changes">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Delivery Total</div><div class="calc-val good" id="rd-total">$0</div></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="rd-save">Save Delivery</button>'
      + '<span id="rd-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

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
    this.container.onclick = null;
  },

  recalcLine(line) {
    const qty   = parseFloat(line.querySelector('.rd-qty').value) || 0;
    const price = parseFloat(line.querySelector('.rd-price').value);
    const ext   = qty * (isNaN(price) ? 0 : price);
    line.dataset.ext = ext;
    line.querySelector('.rd-ext').textContent = App.fmtCurrency(ext);

    const p = this.productById(line.querySelector('.rd-prod').value);
    const flag = line.querySelector('.rd-flag');
    if (p && p.unit_cost != null && !isNaN(price) && Math.abs(price - p.unit_cost) > 0.001) {
      const up = price > p.unit_cost;
      flag.style.display = '';
      flag.style.color = 'var(--gold)';
      flag.textContent = 'Price change: ' + (up ? 'up' : 'down') + ' from '
        + App.fmtCurrency(p.unit_cost) + '. The product master will update to ' + App.fmtCurrency(price);
    } else {
      flag.style.display = 'none';
    }
  },

  recalcTotal() {
    const lines = [...document.querySelectorAll('.rd-line')];
    let total = 0, count = 0, changes = 0;
    lines.forEach(line => {
      const ext = parseFloat(line.dataset.ext) || 0;
      total += ext;
      const prod = line.querySelector('.rd-prod').value;
      const qty = parseFloat(line.querySelector('.rd-qty').value) || 0;
      if (prod && qty > 0) count++;
      if (line.querySelector('.rd-flag').style.display !== 'none') changes++;
    });
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('rd-count', count);
    set('rd-changes', changes);
    set('rd-total', App.fmtCurrency(total));
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
      lineItems.push({
        product_id:        pid,
        name:              p.name,
        container_size_oz: p.container_size_oz != null ? p.container_size_oz : null,
        qty,
        price_per_unit:    unitPrice,
        prev_price:        prevPrice,
        price_changed:     changed,
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
      has_discrepancy: priceChanges > 0,
      created_at:     new Date().toISOString()
    };

    const btn = document.getElementById('rd-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    this.deliveries().push(record);
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
