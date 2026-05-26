'use strict';

/* ── Inventory Control — Order Sheet (writes ic_orders) ───────────────────────
   Auto-generated from the latest count against par levels: every product below
   par is suggested for reorder, grouped by vendor. Quantities are editable.
   Creating an order for a vendor saves an ic_orders record. */

S.InventoryOrderSheet = {
  _created: null,

  countsAsc() {
    return [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
  },
  products() { return ((App.inventoryData && App.inventoryData.ic_products) || []); },
  productById(id) { return this.products().find(p => p.id === id); },
  orders() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_orders)) App.inventoryData.ic_orders = [];
    return App.inventoryData.ic_orders;
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this._created = this._created || {};
    this.renderMain();
  },

  // products below par in the latest count, grouped by vendor
  belowParByVendor() {
    const asc = this.countsAsc();
    if (asc.length === 0) return null;
    const latest = asc[asc.length - 1];
    const onHand = {};
    (latest.items || []).forEach(it => { onHand[it.product_id] = it.total || 0; });

    const groups = {};
    Object.keys(onHand).forEach(pid => {
      const p = this.productById(pid);
      if (!p || p.par_level == null || p.par_level === '' || !(p.par_level > 0)) return;
      const oh = onHand[pid];
      if (oh >= p.par_level) return;
      const vendor = p.vendor || 'Unassigned';
      if (!groups[vendor]) groups[vendor] = [];
      groups[vendor].push({
        product: p,
        on_hand: oh,
        par: p.par_level,
        suggested: Math.max(1, Math.ceil(p.par_level - oh)),
        unit_cost: p.unit_cost != null ? p.unit_cost : 0
      });
    });
    return { latest, groups };
  },

  // Returns the most recent order for a vendor that is still in flight
  // (status is anything other than Received). Null if no open order exists.
  // Used to suppress the vendor's card on the Order Sheet so the operator
  // cannot accidentally place a duplicate order.
  openOrderForVendor(vendorName) {
    if (!vendorName) return null;
    const orders = this.orders();
    const open = orders.filter(o => o && o.vendor === vendorName && o.status !== 'Received');
    if (open.length === 0) return null;
    return open.slice().sort((a, b) =>
      new Date(b.created_at || b.date || 0).getTime() - new Date(a.created_at || a.date || 0).getTime()
    )[0];
  },

  renderMain() {
    this.actions.innerHTML = '';
    const data = this.belowParByVendor();

    if (!data) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">No count to order from</div>'
        + '<div class="empty-sub">The Order Sheet is built from your latest inventory count against par '
        + 'levels. Take a count in Take Inventory, then come back.</div>'
        + '<button class="btn btn-primary" id="os-take">Take Inventory</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#os-take')) App.navigate('ic-take-inventory'); };
      return;
    }

    const allVendors = Object.keys(data.groups).sort();
    // Split vendors into "needs ordering" vs "already has an open order"
    // so we never render a Create Order button next to a vendor the operator
    // already placed an order for. The hidden vendors get summarized in a
    // compact notice that links to Order History.
    const visibleVendors = [];
    const hiddenVendors  = [];
    allVendors.forEach(v => {
      if (this.openOrderForVendor(v)) hiddenVendors.push(v);
      else visibleVendors.push(v);
    });

    const hiddenNotice = hiddenVendors.length === 0 ? '' :
      '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:4px;padding:12px 16px;margin-bottom:16px;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin-bottom:6px;">Already Ordered</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;">'
      +   hiddenVendors.map(v => esc(v)).join(', ')
      +   ' ' + (hiddenVendors.length === 1 ? 'has an open order.' : 'have open orders.')
      +   ' <button class="btn btn-ghost btn-sm" id="os-go-history" style="margin-left:8px;">View in Order History</button>'
      + '</div></div>';

    let body;
    if (visibleVendors.length === 0 && hiddenVendors.length === 0) {
      body = '<div class="empty"><div class="empty-title">Everything is at par</div>'
        + '<div class="empty-sub">No products in the ' + this.fmtDate(data.latest.date)
        + ' count are below their par level. Nothing to order.</div></div>';
    } else if (visibleVendors.length === 0) {
      body = hiddenNotice
        + '<div class="empty"><div class="empty-title">Everything below par is already on order</div>'
        + '<div class="empty-sub">Every vendor with products below par from the '
        + esc(this.fmtDate(data.latest.date))
        + ' count has an open order in flight. Mark those received in Order History as deliveries arrive.</div></div>';
    } else {
      body = hiddenNotice
        + '<div style="font-size:12px;color:var(--t3);margin-bottom:16px;">'
        + 'Suggested from the ' + esc(this.fmtDate(data.latest.date)) + ' count. '
        + 'Adjust quantities, then create an order per vendor.</div>'
        + visibleVendors.map(v => this.vendorCard(v, data.groups[v])).join('');
    }

    this.container.innerHTML = '<div class="screen">' + body + '</div>';

    document.getElementById('os-go-history')?.addEventListener('click', () => App.navigate('ic-order-history'));

    this.container.querySelectorAll('.os-vcard').forEach(card => {
      card.addEventListener('input', ev => {
        if (ev.target.classList.contains('os-qty')) this.recalcVendor(card);
      });
    });
    this.container.onclick = ev => {
      const take = ev.target.closest('#os-take');
      const rm = ev.target.closest('.os-remove');
      const create = ev.target.closest('.os-create');
      if (take) { App.navigate('ic-take-inventory'); return; }
      if (rm) {
        const card = rm.closest('.os-vcard');
        rm.closest('.os-line').remove();
        this.recalcVendor(card);
        return;
      }
      if (create) this.createOrder(create.dataset.vendor);
    };
    vendors.forEach(v => {
      const card = this.container.querySelector('.os-vcard[data-vendor="' + this.cssEsc(v) + '"]');
      if (card) this.recalcVendor(card);
    });
  },

  cssEsc(s) { return String(s).replace(/"/g, '&quot;'); },

  vendorCard(vendor, lines) {
    const created = this._created[vendor];
    const rows = lines.map(l => '<tr class="os-line">'
      + '<td><div class="val">' + esc(l.product.name) + '</div>'
      + '<div style="font-size:10px;color:var(--t3);">' + esc(l.product.category || '') + '</div></td>'
      + '<td>' + l.on_hand.toFixed(1) + '</td>'
      + '<td>' + l.par + '</td>'
      + '<td><input type="number" class="os-qty" data-cost="' + l.unit_cost + '" min="0" step="1" '
      + 'value="' + l.suggested + '" style="width:80px;"/></td>'
      + '<td>' + App.fmtCurrency(l.unit_cost) + '</td>'
      + '<td class="val os-ext">' + App.fmtCurrency(l.suggested * l.unit_cost) + '</td>'
      + '<td><button class="btn btn-ghost btn-sm os-remove">Remove</button></td>'
      + '</tr>').join('');

    return '<div class="card os-vcard" data-vendor="' + this.cssEsc(vendor) + '">'
      + '<div class="card-title">' + esc(vendor) + '</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>On Hand</th><th>Par</th><th>Order Qty</th><th>Unit Cost</th><th>Extended</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Line Items</div><div class="calc-val os-vcount">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Order Total</div><div class="calc-val good os-vtotal">$0</div></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary os-create" data-vendor="' + this.cssEsc(vendor) + '">Create Order</button>'
      + (created
          ? '<span style="color:var(--gold);font-size:11px;font-weight:700;margin-left:8px;">Order created. See Order History</span>'
          : '')
      + '<span class="os-verr" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
  },

  recalcVendor(card) {
    let total = 0, count = 0;
    card.querySelectorAll('.os-line').forEach(line => {
      const inp = line.querySelector('.os-qty');
      const qty = parseFloat(inp.value) || 0;
      const cost = parseFloat(inp.dataset.cost) || 0;
      const ext = qty * cost;
      line.querySelector('.os-ext').textContent = App.fmtCurrency(ext);
      total += ext;
      if (qty > 0) count++;
    });
    const cEl = card.querySelector('.os-vcount');
    const tEl = card.querySelector('.os-vtotal');
    if (cEl) cEl.textContent = count;
    if (tEl) tEl.textContent = App.fmtCurrency(total);
  },

  async createOrder(vendor) {
    const card = this.container.querySelector('.os-vcard[data-vendor="' + this.cssEsc(vendor) + '"]');
    if (!card) return;
    const err = card.querySelector('.os-verr');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };

    const lineItems = [];
    card.querySelectorAll('.os-line').forEach(line => {
      const inp = line.querySelector('.os-qty');
      const qty = parseFloat(inp.value) || 0;
      if (qty <= 0) return;
      const name = line.querySelector('.val').textContent;
      const cost = parseFloat(inp.dataset.cost) || 0;
      lineItems.push({ name, qty, unit_cost: cost, extended: qty * cost });
    });
    if (lineItems.length === 0) { fail('Set an order quantity above zero first.'); return; }

    const rec = {
      id:         App.uid(),
      vendor,
      date:       new Date().toISOString().slice(0, 10),
      status:     'Open',
      line_items: lineItems,
      item_count: lineItems.length,
      total:      lineItems.reduce((t, i) => t + i.extended, 0),
      created_at: new Date().toISOString()
    };

    const btn = card.querySelector('.os-create');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }
    this.orders().push(rec);
    const ok = await App.saveInventory();
    if (ok) {
      this._created[vendor] = true;
      this.renderMain();
    } else {
      this.orders().pop();
      if (btn) { btn.disabled = false; btn.textContent = 'Create Order'; }
      fail('Could not create the order. Try again.');
    }
  }
};
