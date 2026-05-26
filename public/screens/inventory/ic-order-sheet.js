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

  // products below par in the latest count, grouped by vendor.
  // For bottle beer with case_size, on-hand is converted from bottles to
  // cases (par_level is already in cases for case-tracked beer) so the
  // par comparison and the suggested order quantity are both in case units.
  belowParByVendor() {
    const asc = this.countsAsc();
    if (asc.length === 0) return null;
    const latest = asc[asc.length - 1];
    const onHandBottles = {};
    const onHandItem = {};
    (latest.items || []).forEach(it => {
      onHandBottles[it.product_id] = it.total || 0;
      onHandItem[it.product_id] = it;
    });

    const groups = {};
    Object.keys(onHandBottles).forEach(pid => {
      const p = this.productById(pid);
      if (!p || p.par_level == null || p.par_level === '' || !(p.par_level > 0)) return;
      const isCaseBeer = (p.category === 'Bottle Beer') && p.case_size && p.case_size > 0;
      // For case-tracked beer: convert raw-bottle on-hand into cases.
      // par_level is already in cases for case-tracked beer.
      const oh = isCaseBeer ? ((onHandBottles[pid] || 0) / p.case_size) : (onHandBottles[pid] || 0);
      if (oh >= p.par_level) return;
      const vendor = p.vendor || 'Unassigned';
      if (!groups[vendor]) groups[vendor] = [];
      groups[vendor].push({
        product: p,
        on_hand: oh,
        on_hand_raw_bottles: isCaseBeer ? (onHandBottles[pid] || 0) : null,
        on_hand_loose: isCaseBeer ? ((onHandBottles[pid] || 0) % p.case_size) : null,
        par: p.par_level,
        suggested: Math.max(1, Math.ceil(p.par_level - oh)),
        unit_cost: p.unit_cost != null ? p.unit_cost : 0,
        is_case_beer: isCaseBeer
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

    // Always show the New Custom Order button at the top of the screen.
    const newCustomBtn = '<div style="margin-bottom:16px;display:flex;justify-content:flex-end;">'
      + '<button class="btn btn-ghost btn-sm" id="os-new-custom">+ New Custom Order</button>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">' + newCustomBtn + this.customOrderPanelHTML() + body + '</div>';

    document.getElementById('os-go-history')?.addEventListener('click', () => App.navigate('ic-order-history'));
    document.getElementById('os-new-custom')?.addEventListener('click', () => this.openCustomOrder());

    // Per-card input handler for the quantity field on existing lines.
    this.container.querySelectorAll('.os-vcard').forEach(card => {
      card.addEventListener('input', ev => {
        if (ev.target.classList.contains('os-qty')) this.recalcVendor(card);
      });
    });

    // Vendor picker on the custom order panel.
    this.container.querySelector('.os-co-vendor')?.addEventListener('change', (ev) => this.onCustomVendorChange(ev.target.value));

    this.container.onclick = ev => {
      const take    = ev.target.closest('#os-take');
      const rm      = ev.target.closest('.os-remove');
      const create  = ev.target.closest('.os-create');
      const coCreate = ev.target.closest('.os-co-create');
      const coCancel = ev.target.closest('.os-co-cancel');
      const addItem = ev.target.closest('.os-add-item');
      const pickAdd = ev.target.closest('.os-picker-add');
      const pickCancel = ev.target.closest('.os-picker-cancel');

      if (take) { App.navigate('ic-take-inventory'); return; }
      if (rm) {
        const card = rm.closest('.os-vcard');
        rm.closest('.os-line').remove();
        this.recalcVendor(card);
        this.refreshPicker(card);
        return;
      }
      if (addItem) {
        this.openPicker(addItem.closest('.os-vcard'));
        return;
      }
      if (pickAdd) {
        this.addPickedItem(pickAdd.closest('.os-vcard'));
        return;
      }
      if (pickCancel) {
        this.closePicker(pickCancel.closest('.os-vcard'));
        return;
      }
      if (coCreate) {
        this.createCustomOrder();
        return;
      }
      if (coCancel) {
        this.closeCustomOrder();
        return;
      }
      if (create) this.createOrder(create.dataset.vendor);
    };

    visibleVendors.forEach(v => {
      const card = this.container.querySelector('.os-vcard[data-vendor="' + this.cssEsc(v) + '"]');
      if (card) this.recalcVendor(card);
    });
  },

  // ── Picker open/close/add helpers (shared by suggested + custom cards) ───
  openPicker(card) {
    if (!card) return;
    this.refreshPicker(card);
    const picker = card.querySelector('.os-picker');
    const btn = card.querySelector('.os-add-item');
    if (picker) picker.style.display = '';
    if (btn) btn.style.display = 'none';
  },

  closePicker(card) {
    if (!card) return;
    const picker = card.querySelector('.os-picker');
    const btn = card.querySelector('.os-add-item');
    if (picker) {
      picker.style.display = 'none';
      const sel = picker.querySelector('.os-picker-prod');
      if (sel) sel.value = '';
    }
    if (btn) btn.style.display = '';
  },

  // Rebuild the picker's product list each time it opens so a newly-added
  // line is excluded from the choices. Also rebuilds after a Remove so a
  // removed product can be re-added.
  refreshPicker(card) {
    if (!card) return;
    const vendor = card.dataset.vendor || '';
    const existingIds = [...card.querySelectorAll('.os-line[data-product-id]')]
      .map(el => el.dataset.productId).filter(Boolean);

    // Custom card has the picker inside .os-picker-mount; suggested cards
    // have the picker inline already. Replace either with a fresh build.
    const mount = card.querySelector('.os-picker-mount');
    if (mount) {
      mount.innerHTML = this.addItemPickerHTML(vendor, existingIds);
    } else {
      const oldPicker = card.querySelector('.os-picker');
      if (oldPicker) {
        const wasVisible = oldPicker.style.display !== 'none';
        const fresh = document.createElement('div');
        fresh.innerHTML = this.addItemPickerHTML(vendor, existingIds);
        const newPicker = fresh.firstChild;
        if (wasVisible) newPicker.style.display = '';
        oldPicker.replaceWith(newPicker);
      }
    }
  },

  addPickedItem(card) {
    if (!card) return;
    const picker = card.querySelector('.os-picker');
    const sel = picker?.querySelector('.os-picker-prod');
    const pid = sel?.value;
    if (!pid) {
      // Visual nudge — pulse the dropdown border so operator knows what's
      // missing instead of silently doing nothing.
      if (sel) {
        sel.style.borderColor = 'var(--red)';
        setTimeout(() => { sel.style.borderColor = ''; }, 1200);
      }
      return;
    }
    const product = this.productById(pid);
    if (!product) return;

    const qtyInp = picker?.querySelector('.os-picker-qty');
    const qty = Math.max(1, parseFloat(qtyInp?.value) || 1);

    // Pull on-hand from latest count if present (informational only).
    let onHand = null;
    const counts = this.countsAsc();
    if (counts.length) {
      const latest = counts[counts.length - 1];
      const it = (latest.items || []).find(i => i.product_id === pid);
      if (it) onHand = it.total != null ? it.total : null;
    }
    const par = (product.par_level != null && product.par_level !== '') ? product.par_level : null;
    const tbody = card.querySelector('.os-lines-tbody');
    if (tbody) {
      tbody.insertAdjacentHTML('beforeend', this.lineRowHTML(product, qty, onHand, par));
    }
    this.recalcVendor(card);
    this.closePicker(card);
    this.refreshPicker(card);
  },

  // ── Custom Order open/close + create ─────────────────────────────────────
  openCustomOrder() {
    const panel = this.container.querySelector('.os-custom');
    if (panel) panel.style.display = '';
    const btn = document.getElementById('os-new-custom');
    if (btn) btn.style.display = 'none';
  },

  closeCustomOrder() {
    const panel = this.container.querySelector('.os-custom');
    if (!panel) return;
    // Reset to blank state for the next time.
    panel.style.display = 'none';
    panel.dataset.vendor = '';
    const sel = panel.querySelector('.os-co-vendor');
    if (sel) sel.value = '';
    const body = panel.querySelector('.os-co-body');
    if (body) body.style.display = 'none';
    const tbody = panel.querySelector('.os-lines-tbody');
    if (tbody) tbody.innerHTML = '';
    const err = panel.querySelector('.os-verr');
    if (err) { err.textContent = ''; err.style.display = 'none'; }
    this.recalcVendor(panel);
    const btn = document.getElementById('os-new-custom');
    if (btn) btn.style.display = '';
  },

  onCustomVendorChange(vendorName) {
    const panel = this.container.querySelector('.os-custom');
    if (!panel) return;
    panel.dataset.vendor = vendorName || '';
    const body = panel.querySelector('.os-co-body');
    if (!body) return;
    if (!vendorName) {
      body.style.display = 'none';
      return;
    }
    body.style.display = '';
    // Clear any existing lines and reset the picker. closePicker resets the
    // "+ Add Item" button visibility so changing vendor mid-picker does not
    // leave the button hidden.
    const tbody = panel.querySelector('.os-lines-tbody');
    if (tbody) tbody.innerHTML = '';
    this.refreshPicker(panel);
    this.closePicker(panel);
    this.recalcVendor(panel);
  },

  async createCustomOrder() {
    const panel = this.container.querySelector('.os-custom');
    if (!panel) return;
    const vendor = panel.dataset.vendor;
    if (!vendor) return;
    const err = panel.querySelector('.os-verr');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (err) { err.textContent = ''; err.style.display = 'none'; }

    const lineItems = [];
    panel.querySelectorAll('.os-line').forEach(line => {
      const inp = line.querySelector('.os-qty');
      const qty = parseFloat(inp.value) || 0;
      if (qty <= 0) return;
      const name = line.querySelector('.val').textContent;
      const cost = parseFloat(inp.dataset.cost) || 0;
      const productId = inp.dataset.productId || '';
      const product = this.productById(productId);
      const isCaseBeer = product && product.category === 'Bottle Beer' && product.case_size && product.case_size > 0;
      lineItems.push({
        product_id: productId,
        name,
        qty,
        unit_cost: cost,
        extended: qty * cost,
        display_unit: isCaseBeer ? 'case' : 'unit',
        case_size: isCaseBeer ? product.case_size : null
      });
    });
    if (lineItems.length === 0) { fail('Add at least one item with a quantity above zero.'); return; }

    const rec = {
      id:         App.uid(),
      vendor,
      date:       new Date().toISOString().slice(0, 10),
      status:     'Open',
      line_items: lineItems,
      item_count: lineItems.length,
      total:      lineItems.reduce((t, i) => t + i.extended, 0),
      custom:     true,
      created_at: new Date().toISOString()
    };

    const btn = panel.querySelector('.os-co-create');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }
    this.orders().push(rec);
    const ok = await App.saveInventory();
    if (ok) {
      this.closeCustomOrder();
      this.renderMain();
    } else {
      this.orders().pop();
      if (btn) { btn.disabled = false; btn.textContent = 'Create Order'; }
      fail('Could not create the order. Try again.');
    }
  },

  cssEsc(s) { return String(s).replace(/"/g, '&quot;'); },

  // ── Line row builder ──────────────────────────────────────────────────────
  // Shared by the suggested-from-count rows AND the "+ Add Item" picker so
  // both flow types produce identical HTML and recalcVendor/createOrder work
  // the same way for either. For bottle beer with case_size set, the qty
  // and unit cost are in case units (par_level is already in cases). The
  // on-hand display shows "X cases + Y loose" so the operator sees raw
  // counts the way they look on the shelf.
  lineRowHTML(product, qty, onHand, par) {
    const isCaseBeer = (product.category === 'Bottle Beer') && product.case_size && product.case_size > 0;
    const unitCost = product.unit_cost != null ? product.unit_cost : 0;
    const unitLabel = isCaseBeer ? 'cases' : '';

    let onHandTxt;
    if (onHand == null || isNaN(onHand)) {
      onHandTxt = '-';
    } else if (isCaseBeer) {
      const totalBottles = Math.round(Number(onHand) * product.case_size);
      const cases = Math.floor(totalBottles / product.case_size);
      const loose = totalBottles % product.case_size;
      onHandTxt = cases + ' cases' + (loose > 0 ? ' + ' + loose + ' btl' : '');
    } else {
      onHandTxt = Number(onHand).toFixed(1);
    }
    const parTxt = (par != null && par !== '' && !isNaN(par))
      ? (par + (isCaseBeer ? ' cases' : ''))
      : '-';

    return '<tr class="os-line" data-product-id="' + esc(product.id || '') + '">'
      + '<td><div class="val">' + esc(product.name || '') + '</div>'
      + '<div style="font-size:10px;color:var(--t3);">' + esc(product.category || '') + '</div></td>'
      + '<td>' + onHandTxt + '</td>'
      + '<td>' + parTxt + '</td>'
      + '<td><input type="number" class="os-qty" data-cost="' + unitCost + '" data-product-id="' + esc(product.id || '') + '" min="0" step="1" '
      + 'value="' + qty + '" style="width:80px;"/>' + (unitLabel ? ' <span style="font-size:10px;color:var(--t3);">' + unitLabel + '</span>' : '') + '</td>'
      + '<td>' + App.fmtCurrency(unitCost) + (isCaseBeer ? '<div style="font-size:9px;color:var(--t3);">per case</div>' : '') + '</td>'
      + '<td class="val os-ext">' + App.fmtCurrency(qty * unitCost) + '</td>'
      + '<td><button class="btn btn-ghost btn-sm os-remove">Remove</button></td>'
      + '</tr>';
  },

  // Build the inline product picker HTML. When the operator clicks "+ Add
  // Item" the picker expands here. Excludes products already on the card.
  // For vendor-bound cards (suggested + custom-with-vendor-picked), filters
  // to that vendor's products. For a custom card with no vendor yet, the
  // picker is hidden.
  addItemPickerHTML(vendorName, existingProductIds) {
    const allProducts = ((App.inventoryData && App.inventoryData.ic_products) || [])
      .filter(p => p && p.active !== false);
    const onlyVendor = allProducts.filter(p => (p.vendor || '') === vendorName);
    const pool = onlyVendor.length > 0 ? onlyVendor : allProducts;
    const filtered = pool.filter(p => !existingProductIds.includes(p.id));

    // Group by category
    const byCat = {};
    filtered.forEach(p => {
      const c = p.category || 'Other';
      if (!byCat[c]) byCat[c] = [];
      byCat[c].push(p);
    });
    const cats = Object.keys(byCat).sort();
    const opts = ['<option value="">Select a product...</option>']
      .concat(cats.map(c =>
        '<optgroup label="' + esc(c) + '">'
        + byCat[c].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('')
        + '</optgroup>'
      ));
    return '<div class="os-picker" style="display:none;margin-top:12px;padding:12px 14px;background:var(--bg);border:1px solid var(--b1);border-radius:4px;">'
      + '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">'
        + '<div class="f" style="flex:1;min-width:220px;"><label>Add Product</label>'
          + '<select class="os-picker-prod">' + opts.join('') + '</select>'
        + '</div>'
        + '<div class="f" style="width:90px;flex-shrink:0;"><label>Qty</label>'
          + '<input type="number" class="os-picker-qty" min="1" step="1" value="1"/>'
        + '</div>'
        + '<button class="btn btn-primary os-picker-add">Add</button>'
        + '<button class="btn btn-ghost os-picker-cancel">Cancel</button>'
      + '</div>'
      + (filtered.length === 0
          ? '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Every product for this vendor is already on the order. Edit a quantity above to add more of one.</div>'
          : '')
      + '</div>';
  },

  vendorCard(vendor, lines) {
    const rows = lines.map(l =>
      this.lineRowHTML(l.product, l.suggested, l.on_hand, l.par)
    ).join('');
    const existingIds = lines.map(l => l.product.id || '').filter(Boolean);

    return '<div class="card os-vcard" data-vendor="' + this.cssEsc(vendor) + '">'
      + '<div class="card-title">' + esc(vendor) + '</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>On Hand</th><th>Par</th><th>Order Qty</th><th>Unit Cost</th><th>Extended</th><th></th>'
      + '</tr></thead><tbody class="os-lines-tbody">' + rows + '</tbody></table></div>'
      + this.addItemPickerHTML(vendor, existingIds)
      + '<div style="margin-top:10px;"><button class="btn btn-ghost btn-sm os-add-item">+ Add Item</button></div>'
      + '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Line Items</div><div class="calc-val os-vcount">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Order Total</div><div class="calc-val good os-vtotal">$0</div></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary os-create" data-vendor="' + this.cssEsc(vendor) + '">Create Order</button>'
      + '<span class="os-verr" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
  },

  // ── Custom Order panel (vendor-agnostic ad-hoc order) ─────────────────────
  // Lets the operator build an order from scratch without depending on the
  // latest count. Picks a vendor first, then uses the same "+ Add Item"
  // picker to add products. Useful for party orders, special events, any
  // ad-hoc need outside the routine count-driven cycle.
  customOrderPanelHTML() {
    const vendors = ((App.inventoryData && App.inventoryData.ic_vendors) || [])
      .slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const opts = '<option value="">Select vendor...</option>'
      + vendors.map(v => '<option value="' + esc(v.name) + '">' + esc(v.name) + '</option>').join('');
    return '<div class="card os-vcard os-custom" data-vendor="" style="display:none;">'
      + '<div class="card-title">New Custom Order</div>'
      + '<div class="form-row" style="margin-bottom:12px;">'
        + '<div class="f" style="width:280px;"><label>Vendor</label>'
          + '<select class="os-co-vendor">' + opts + '</select>'
        + '</div>'
      + '</div>'
      + '<div class="os-co-body" style="display:none;">'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
          + '<th>Product</th><th>On Hand</th><th>Par</th><th>Order Qty</th><th>Unit Cost</th><th>Extended</th><th></th>'
        + '</tr></thead><tbody class="os-lines-tbody"></tbody></table></div>'
        + '<div class="os-picker-mount"></div>'
        + '<div style="margin-top:10px;"><button class="btn btn-ghost btn-sm os-add-item">+ Add Item</button></div>'
        + '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
          + '<div class="calc-item"><div class="calc-label">Line Items</div><div class="calc-val os-vcount">0</div></div>'
          + '<div class="calc-item"><div class="calc-label">Order Total</div><div class="calc-val good os-vtotal">$0</div></div>'
        + '</div>'
        + '<div class="card-actions">'
          + '<button class="btn btn-primary os-co-create">Create Order</button>'
          + '<button class="btn btn-ghost os-co-cancel">Cancel</button>'
          + '<span class="os-verr" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
        + '</div>'
      + '</div>'
      + '</div>';
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
      const productId = inp.dataset.productId || '';
      const product = this.productById(productId);
      const isCaseBeer = product && product.category === 'Bottle Beer' && product.case_size && product.case_size > 0;
      lineItems.push({
        product_id: productId,
        name,
        qty,
        unit_cost: cost,
        extended: qty * cost,
        // Display unit and case size snapshot so Receive Delivery knows
        // whether the ordered qty is in cases or single units, and so
        // downstream variance math can convert to bottles when needed.
        display_unit: isCaseBeer ? 'case' : 'unit',
        case_size: isCaseBeer ? product.case_size : null
      });
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
