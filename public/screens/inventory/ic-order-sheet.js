'use strict';

/* ── Inventory Control — Order Sheet (writes ic_orders) ───────────────────────
   Auto-generated from the latest count against par levels: every product below
   par is suggested for reorder, grouped by vendor. Quantities are editable.
   Creating an order for a vendor saves an ic_orders record. The Order Status
   card up top summarizes what is still to order, what is already ordered (with
   Email to Vendor right there), and how old the count behind the suggestions
   is. Build a custom off-cycle order at the bottom. */

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
  scrollContentTop() {
    const s = this.container && (this.container.closest('.content') || document.querySelector('.content'));
    if (s) s.scrollTop = 0;
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this._created = this._created || {};
    this.renderMain();
  },

  showHowTo() {
    App.showHelpModal('How the Order Sheet Works', [
      { p: ['The Order Sheet turns your latest count into orders. Anything below par shows up under the vendor you buy it from, already filled to the quantity that brings you back to par. You can also build an order from scratch at the bottom.'] },
      { h: 'The Order Status Card', p: ['Up top, Order Status shows what is still to order at a glance, what you have already ordered, and how old the count behind these suggestions is. Email an already-placed order straight to the vendor from here.'] },
      { h: 'Suggested Orders', p: ['Each vendor card lists their products that fell under par in your last count, with on-hand, par, and a suggested order quantity. Adjust any quantity, add a product the count missed with Add Item, then Create Order. Bottle beer is ordered by the case.'] },
      { h: 'Sending The Order', p: ['Once you create an order it moves to Already Ordered up top. Email to Vendor opens your email client with the order written out and addressed to the vendor on file, and marks it Submitted. The order also sits in Order History.'] },
      { h: 'New Custom Order', p: ['Use the card at the bottom to build an order off-cycle, like a party order or a one-time buy, without waiting on a count. Pick the vendor, add the products and quantities, then create it the same way.'] },
      { h: 'Closing The Loop', p: ['When the delivery shows up, go to Receive Delivery and match it to the open order. The line items pre-fill, you confirm against the invoice, and Bar Cop marks the order Received.'] }
    ]);
  },

  // products below par in the latest count, grouped by vendor.
  belowParByVendor() {
    const asc = this.countsAsc();
    if (asc.length === 0) return null;
    const latest = asc[asc.length - 1];
    const onHand = {};
    (latest.items || []).forEach(it => {
      onHand[it.product_id] = (onHand[it.product_id] || 0) + (it.total || 0);
    });

    const groups = {};
    Object.keys(onHand).forEach(pid => {
      const p = this.productById(pid);
      if (!p || p.par_level == null || p.par_level === '' || !(p.par_level > 0)) return;
      const isCaseBeer = (p.category === 'Bottle Beer') && p.case_size && p.case_size > 0;
      const oh = onHand[pid] || 0;
      if (oh >= p.par_level) return;
      const vendor = p.vendor || 'Unassigned';
      if (!groups[vendor]) groups[vendor] = [];
      groups[vendor].push({
        product: p,
        on_hand: oh,
        par: p.par_level,
        suggested: Math.max(1, Math.ceil(p.par_level - oh)),
        unit_cost: p.unit_cost != null ? p.unit_cost : 0,
        is_case_beer: isCaseBeer
      });
    });
    return { latest, groups };
  },

  // Most recent in-flight order (status != Received) for a vendor, or null.
  openOrderForVendor(vendorName) {
    if (!vendorName) return null;
    const open = this.orders().filter(o => o && o.vendor === vendorName && o.status !== 'Received');
    if (open.length === 0) return null;
    return open.slice().sort((a, b) =>
      new Date(b.created_at || b.date || 0).getTime() - new Date(a.created_at || a.date || 0).getTime()
    )[0];
  },

  renderMain() {
    this.actions.innerHTML = '';
    const data = this.belowParByVendor();

    if (!data) {
      App.setupCard(this.container, {
        title: 'Build Your First Order',
        lead: 'The Order Sheet builds a reorder list from your latest count against your par levels, grouped by vendor. Take a count and it fills in here.',
        steps: [
          { title: 'Take an inventory count', desc: 'The order sheet compares your latest count to par to see what to reorder. Take a count to get started.', btn: 'Take Inventory', screen: 'ic-take-inventory', done: false }
        ]
      });
      return;
    }

    const allVendors = Object.keys(data.groups).sort();
    // Split vendors into "needs ordering" vs "already has an open order".
    const visibleVendors = [];
    const hiddenVendors  = [];
    allVendors.forEach(v => {
      if (this.openOrderForVendor(v)) hiddenVendors.push(v);
      else visibleVendors.push(v);
    });

    let statusHtml, vendorHtml = '';
    if (visibleVendors.length === 0 && hiddenVendors.length === 0) {
      statusHtml = '<div class="card form-card"><div class="card-title">'
        + '<span>Order Status</span></div>'
        + '<div class="empty" style="margin:0;"><div class="empty-title">Everything is at par</div>'
        + '<div class="empty-sub">No products in the ' + this.fmtDate(data.latest.date)
        + ' count are below their par level. Nothing to order.</div></div>'
        + this.countAgeNote(data.latest, false) + '</div>';
    } else {
      statusHtml = this.statusCardHTML(visibleVendors, hiddenVendors, data);
      vendorHtml = visibleVendors.length
        ? '<div class="sh" style="margin:24px 0 10px;">Suggested Orders</div>'
          + visibleVendors.map(v => this.vendorCard(v, data.groups[v])).join('')
        : '';
    }

    // Custom Order card sits right below Order Status, above the suggested vendor cards.
    this.container.innerHTML = '<div class="screen">' + statusHtml + this.customOrderPanelHTML() + vendorHtml + '</div>';

    // Per-card input handler for the quantity field on existing lines, plus the
    // in-row product picker on blank Add Item rows.
    this.container.querySelectorAll('.os-vcard').forEach(card => {
      card.addEventListener('input', ev => {
        if (ev.target.classList.contains('os-qty')) this.recalcVendor(card);
      });
      card.addEventListener('change', ev => {
        if (ev.target.classList.contains('os-prod')) this.onLineProductChange(ev.target);
      });
    });

    // Vendor picker on the custom order panel.
    this.container.querySelector('.os-co-vendor')?.addEventListener('change', (ev) => this.onCustomVendorChange(ev.target.value));

    this.container.onclick = ev => {
      if (ev.target.closest('.os-par-nudge')) { App.navigate('ic-par-suggestions'); return; }
      if (ev.target.closest('#os-go-history')) { App.navigate('ic-order-history'); return; }
      if (ev.target.closest('.os-take')) { App.navigate('ic-take-inventory'); return; }
      const email = ev.target.closest('.os-email');
      if (email) { this.emailOrder(email.dataset.id); return; }
      const pdf = ev.target.closest('.os-pdf');
      if (pdf) { this.exportOrderPdf(pdf.dataset.id); return; }
      const rm      = ev.target.closest('.os-remove');
      const create  = ev.target.closest('.os-create');
      const coCreate = ev.target.closest('.os-co-create');
      const coCancel = ev.target.closest('.os-co-cancel');
      const addItem = ev.target.closest('.os-add-item');

      if (rm) {
        const card = rm.closest('.os-vcard');
        rm.closest('.os-line').remove();
        this.recalcVendor(card);
        return;
      }
      if (addItem) { this.addBlankLine(addItem.closest('.os-vcard')); return; }
      if (coCreate) { this.createCustomOrder(); return; }
      if (coCancel) { this.closeCustomOrder(); return; }
      if (create) this.createOrder(create.dataset.vendor);
    };

    visibleVendors.forEach(v => {
      const card = this.container.querySelector('.os-vcard[data-vendor="' + this.cssEsc(v) + '"]');
      if (card) this.recalcVendor(card);
    });
  },

  // ── Combined Order Status card (still to order + already ordered + age) ──────
  statusCardHTML(visibleVendors, hiddenVendors, data) {
    let stillCount = 0, stillTotal = 0;
    visibleVendors.forEach(v => (data.groups[v] || []).forEach(l => {
      stillCount++; stillTotal += (l.suggested || 0) * (l.unit_cost || 0);
    }));

    const stillSection = '<div style="flex:1;min-width:220px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Still to Order</div>'
      + (visibleVendors.length === 0
          ? '<div style="font-size:13px;color:var(--t2);">Nothing left to order from this count.</div>'
          : '<div style="font-size:13px;color:var(--t1);line-height:1.6;"><strong>' + visibleVendors.length + ' vendor' + (visibleVendors.length === 1 ? '' : 's') + '</strong> &middot; ' + stillCount + ' item' + (stillCount === 1 ? '' : 's') + ' &middot; <strong style="color:var(--gold);">' + App.fmtCurrency(stillTotal) + '</strong> to order</div>')
      + '</div>';

    const openOrders = hiddenVendors.map(v => this.openOrderForVendor(v)).filter(Boolean);
    const orderedSection = openOrders.length === 0 ? '' :
      '<div style="flex:1;min-width:280px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin-bottom:8px;">Already Ordered</div>'
      + openOrders.map(o => '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid var(--b2);">'
          + '<div style="font-size:12px;color:var(--t1);min-width:0;">' + esc(o.vendor) + ' <span style="color:var(--t3);white-space:nowrap;">&middot; ' + App.fmtCurrency(o.total || 0) + ' &middot; ' + esc(o.status || 'Open') + '</span></div>'
          + '<div style="display:flex;gap:8px;flex-shrink:0;">'
            + '<button class="btn btn-ghost btn-sm os-email" data-id="' + esc(o.id) + '">' + (o.status === 'Open' ? 'Email to Vendor' : 'Resend') + '</button>'
            + '<button class="btn btn-ghost btn-sm os-pdf" data-id="' + esc(o.id) + '">Export PDF</button>'
          + '</div>'
        + '</div>').join('')
      + '<div style="margin-top:8px;"><button class="btn btn-ghost btn-sm" id="os-go-history">View in Order History</button></div>'
      + '</div>';

    return '<div class="card form-card"><div class="card-title">'
      + '<span>Order Status</span></div>'
      + '<div style="display:flex;gap:36px;flex-wrap:wrap;align-items:flex-start;">' + stillSection + orderedSection + '</div>'
      + this.countAgeNote(data.latest, false)
      + '</div>';
  },

  // "Based on your [date] count (X days ago)" — nudges a fresh count when stale.
  countAgeNote(latest, standalone) {
    if (!latest || !latest.date) return '';
    const days = Math.floor((Date.now() - new Date(latest.date + 'T00:00:00').getTime()) / 86400000);
    const stale = days > 7;
    const inner = 'Suggestions are based on your ' + this.fmtDate(latest.date) + ' count'
      + (days > 0 ? ' (' + days + ' day' + (days === 1 ? '' : 's') + ' ago)' : ' (today)') + '.'
      + (stale ? ' <span class="os-take" style="color:var(--gold);cursor:pointer;text-decoration:underline;">Take a fresh count</span> for accurate numbers.' : '');
    if (standalone) {
      return '<div style="font-size:11px;color:' + (stale ? 'var(--amber)' : 'var(--t3)') + ';margin-top:14px;">' + inner + '</div>';
    }
    return '<div style="font-size:11px;color:' + (stale ? 'var(--amber)' : 'var(--t3)') + ';margin-top:14px;border-top:1px solid var(--b2);padding-top:10px;">' + inner + '</div>';
  },

  // ── Email an already-placed order to the vendor (reuses Order History's body) ─
  async emailOrder(orderId) {
    const order = this.orders().find(o => o.id === orderId);
    if (!order) return;
    if (S.InventoryOrderHistory && S.InventoryOrderHistory.buildMailto) {
      window.location.href = S.InventoryOrderHistory.buildMailto(order);
    }
    if (order.status === 'Open') {
      order.status = 'Submitted';
      order.submitted_at = new Date().toISOString();
      await App.putRecord('ic', 'order', order);
      this.renderMain();
    }
  },

  // Export an already-placed order as a purchase-order PDF (print it, or attach
  // it to an email/vendor portal). Reuses Order History's canonical builder.
  exportOrderPdf(orderId) {
    const order = this.orders().find(o => o.id === orderId);
    if (!order) return;
    if (S.InventoryOrderHistory && S.InventoryOrderHistory.exportOrderPDF) {
      S.InventoryOrderHistory.exportOrderPDF(order);
    }
  },

  // ── Add Item = a blank inline ing-tbl row (standard batch-builder pattern) ──
  // Clicking "+ Add Item" drops an empty row whose Product cell is a select;
  // picking a product fills On Hand / Par / Unit Cost / a suggested qty in place.
  addBlankLine(card) {
    if (!card) return;
    const vendor = card.dataset.vendor || '';
    const existingIds = [...card.querySelectorAll('.os-line[data-product-id]')]
      .map(el => el.dataset.productId).filter(Boolean);
    const tbody = card.querySelector('.os-lines-tbody');
    if (!tbody) return;
    tbody.insertAdjacentHTML('beforeend', this.blankLineRowHTML(vendor, existingIds));
    this.recalcVendor(card);
  },

  // Operator picks a product in a blank row's select: fill the read-only cells,
  // stash the cost/id on the qty input, and default the qty to bring it to par.
  onLineProductChange(sel) {
    const row = sel.closest('.os-line');
    const card = sel.closest('.os-vcard');
    if (!row) return;
    const pid = sel.value;
    const product = pid ? this.productById(pid) : null;
    const qtyInp = row.querySelector('.os-qty');
    const ohCell = row.querySelector('.os-onhand');
    const parCell = row.querySelector('.os-par');
    const ucCell = row.querySelector('.os-uc');
    const unitSpan = row.querySelector('.os-unit');

    if (!product) {
      row.dataset.productId = '';
      if (qtyInp) { qtyInp.dataset.productId = ''; qtyInp.dataset.cost = 0; }
      if (ohCell) ohCell.textContent = '-';
      if (parCell) parCell.textContent = '-';
      if (ucCell) ucCell.textContent = App.fmtCurrency(0);
      if (unitSpan) unitSpan.textContent = '';
      if (card) this.recalcVendor(card);
      return;
    }

    const unitCost = product.unit_cost != null ? product.unit_cost : 0;
    const unit = App.unitAbbr(App.productUnit(product));

    let onHand = null;
    const counts = this.countsAsc();
    if (counts.length) {
      const it = (counts[counts.length - 1].items || []).find(i => i.product_id === pid);
      if (it) onHand = it.total != null ? it.total : null;
    }
    const par = (product.par_level != null && product.par_level !== '') ? product.par_level : null;

    row.dataset.productId = product.id || '';
    if (qtyInp) {
      qtyInp.dataset.productId = product.id || '';
      qtyInp.dataset.cost = unitCost;
      if (!qtyInp.value || parseFloat(qtyInp.value) <= 0) {
        qtyInp.value = (onHand != null && par != null && !isNaN(onHand) && !isNaN(par) && par > onHand)
          ? Math.max(1, Math.ceil(par - onHand)) : 1;
      }
    }
    if (ohCell) ohCell.textContent = this.onHandText(product, onHand, unit);
    if (parCell) parCell.textContent = this.parText(par, unit);
    if (ucCell) ucCell.textContent = App.fmtCurrency(unitCost);
    if (unitSpan) unitSpan.textContent = unit || '';
    if (card) this.recalcVendor(card);
  },

  // ── Custom Order reset + create ──────────────────────────────────────────
  closeCustomOrder() {
    const panel = this.container.querySelector('.os-custom');
    if (!panel) return;
    panel.dataset.vendor = '';
    const sel = panel.querySelector('.os-co-vendor');
    if (sel) sel.value = '';
    const body = panel.querySelector('.os-co-body');
    if (body) body.style.display = 'none';
    const actions = this.container.querySelector('.os-co-actions');
    if (actions) actions.style.display = 'none';
    const tbody = panel.querySelector('.os-lines-tbody');
    if (tbody) tbody.innerHTML = '';
    const err = actions ? actions.querySelector('.os-verr') : null;
    if (err) { err.textContent = ''; err.style.display = 'none'; }
    this.recalcVendor(panel);
  },

  onCustomVendorChange(vendorName) {
    const panel = this.container.querySelector('.os-custom');
    if (!panel) return;
    panel.dataset.vendor = vendorName || '';
    const body = panel.querySelector('.os-co-body');
    const actions = this.container.querySelector('.os-co-actions');
    if (!body) return;
    if (!vendorName) {
      body.style.display = 'none';
      if (actions) actions.style.display = 'none';
      return;
    }
    body.style.display = '';
    if (actions) actions.style.display = 'flex';
    const tbody = panel.querySelector('.os-lines-tbody');
    if (tbody) tbody.innerHTML = this.blankLineRowHTML(vendorName, []);
    this.recalcVendor(panel);
  },

  async createCustomOrder() {
    const panel = this.container.querySelector('.os-custom');
    if (!panel) return;
    const vendor = panel.dataset.vendor;
    if (!vendor) return;
    const err = this.container.querySelector('.os-co-actions .os-verr');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (err) { err.textContent = ''; err.style.display = 'none'; }

    const lineItems = [];
    panel.querySelectorAll('.os-line').forEach(line => {
      const inp = line.querySelector('.os-qty');
      const qty = parseFloat(inp.value) || 0;
      const productId = inp.dataset.productId || '';
      if (qty <= 0 || !productId) return;
      const product = this.productById(productId);
      const nameEl = line.querySelector('.val');
      const name = product ? product.name : (nameEl ? nameEl.textContent : '');
      const cost = parseFloat(inp.dataset.cost) || 0;
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
    if (lineItems.length === 0) { fail('Add at least one item with a product and a quantity above zero.'); return; }

    const rec = {
      id:         App.uid(),
      vendor,
      date:       App.todayLocal(),
      status:     'Open',
      line_items: lineItems,
      item_count: lineItems.length,
      total:      lineItems.reduce((t, i) => t + i.extended, 0),
      custom:     true,
      created_at: new Date().toISOString()
    };

    const btn = this.container.querySelector('.os-co-actions .os-co-create');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }
    const ok = await App.putRecord('ic', 'order', rec);
    if (ok) {
      this.closeCustomOrder();
      this.renderMain();
      this.scrollContentTop();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Create Order'; }
      fail('Could not create the order. Try again.');
    }
  },

  cssEsc(s) { return String(s).replace(/"/g, '&quot;'); },

  // On-hand cell text. Bottle beer reads in cases + loose bottles; everything
  // else in its abbreviated container unit.
  onHandText(product, onHand, unit) {
    if (onHand == null || isNaN(onHand)) return '-';
    const isCaseBeer = (product.category === 'Bottle Beer') && product.case_size && product.case_size > 0;
    if (isCaseBeer) {
      const totalBottles = Math.round(Number(onHand) * product.case_size);
      const cases = Math.floor(totalBottles / product.case_size);
      const loose = totalBottles % product.case_size;
      return cases + ' cs' + (loose > 0 ? ' + ' + loose + ' btl' : '');
    }
    const n = Number(onHand);
    return (n % 1 === 0 ? n.toString() : n.toFixed(1)) + (unit ? ' ' + unit : '');
  },
  parText(par, unit) {
    return (par != null && par !== '' && !isNaN(par)) ? (par + (unit ? ' ' + unit : '')) : '-';
  },

  // ── Line row builder (ing-tbl row for a known product: suggested + added) ──
  // For bottle beer with case_size, qty/unit cost are in CASES (par is already
  // in cases). Quantities carry the abbreviated container unit (cs / btls).
  lineRowHTML(product, qty, onHand, par) {
    const unitCost = product.unit_cost != null ? product.unit_cost : 0;
    const unit = App.unitAbbr(App.productUnit(product));
    return '<tr class="os-line" data-product-id="' + esc(product.id || '') + '">'
      + '<td><div class="val">' + esc(product.name || '') + '</div>'
      + '<div style="font-size:10px;color:var(--t3);">' + esc(product.category || '') + '</div></td>'
      + '<td class="os-onhand">' + this.onHandText(product, onHand, unit) + '</td>'
      + '<td class="os-par">' + this.parText(par, unit) + '</td>'
      + '<td><input type="number" class="os-qty" data-cost="' + unitCost + '" data-product-id="' + esc(product.id || '') + '" min="0" step="1" '
      + 'value="' + qty + '" style="width:80px;"/>' + (unit ? ' <span class="os-unit" style="font-size:10px;color:var(--t3);">' + unit + '</span>' : '<span class="os-unit"></span>') + '</td>'
      + '<td class="os-uc">' + App.fmtCurrency(unitCost) + '</td>'
      + '<td class="val os-ext">' + App.fmtCurrency(qty * unitCost) + '</td>'
      + '<td><div class="row-actions"><button class="btn btn-danger btn-sm os-remove">Remove</button></div></td>'
      + '</tr>';
  },

  // Blank ing-tbl row whose Product cell is an in-row select (the standard Add
  // Item). On Hand / Par / Unit Cost fill in via onLineProductChange on pick.
  blankLineRowHTML(vendor, existingIds) {
    return '<tr class="os-line" data-product-id="">'
      + '<td><select class="form-input os-prod" style="width:100%;">' + this.productOptionsHTML(vendor, existingIds) + '</select></td>'
      + '<td class="os-onhand">-</td>'
      + '<td class="os-par">-</td>'
      + '<td><input type="number" class="os-qty" data-cost="0" data-product-id="" min="0" step="1" value="" style="width:80px;"/> <span class="os-unit" style="font-size:10px;color:var(--t3);"></span></td>'
      + '<td class="os-uc">' + App.fmtCurrency(0) + '</td>'
      + '<td class="val os-ext">' + App.fmtCurrency(0) + '</td>'
      + '<td><div class="row-actions"><button class="btn btn-danger btn-sm os-remove">Remove</button></div></td>'
      + '</tr>';
  },

  // Grouped product <option>s. Excludes products already on the card; filters to
  // the card's vendor when one is set (falls back to all products otherwise).
  productOptionsHTML(vendorName, existingProductIds) {
    const allProducts = ((App.inventoryData && App.inventoryData.ic_products) || [])
      .filter(p => p && p.active !== false);
    const onlyVendor = allProducts.filter(p => (p.vendor || '') === vendorName);
    const pool = onlyVendor.length > 0 ? onlyVendor : allProducts;
    const filtered = pool.filter(p => !(existingProductIds || []).includes(p.id));

    if (filtered.length === 0) {
      return '<option value="">Every product for this vendor is already on the order</option>';
    }
    const byCat = {};
    filtered.forEach(p => { const c = p.category || 'Other'; (byCat[c] = byCat[c] || []).push(p); });
    const cats = Object.keys(byCat).sort();
    return ['<option value="">Select a product...</option>']
      .concat(cats.map(c =>
        '<optgroup label="' + esc(c) + '">'
        + byCat[c].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('')
        + '</optgroup>'
      )).join('');
  },

  // Count products on a card whose par looks off vs the dynamic-par suggestion.
  parIssueCount(products) {
    const PS = S.InventoryParSuggestions;
    if (!PS || !PS.computeSuggestion || !PS.settings) return 0;
    const settings = PS.settings();
    let off = 0;
    (products || []).forEach(p => {
      if (!p || p.par_level == null || p.par_level === '') return;
      const sug = PS.computeSuggestion(p, settings);
      if (!sug || sug.suggested == null) return;
      const cur = Math.round(parseFloat(p.par_level) || 0);
      const diff = Math.abs(sug.suggested - cur);
      if (diff >= 1 && diff >= cur * 0.25) off++;
    });
    return off;
  },

  vendorCard(vendor, lines) {
    const rows = lines.map(l => this.lineRowHTML(l.product, l.suggested, l.on_hand, l.par)).join('');
    const parOff = this.parIssueCount(lines.map(l => l.product));
    const parNudge = parOff > 0
      ? '<div class="os-par-nudge" style="margin-left:auto;display:flex;align-items:center;gap:10px;cursor:pointer;max-width:540px;">'
        + '<span style="font-size:12px;color:var(--t1);line-height:1.5;text-align:right;"><strong style="color:var(--gold);">' + parOff + ' par' + (parOff === 1 ? '' : 's') + '</strong> look off versus your real usage. Tuning them sharpens these reorder numbers.</span>'
        + '<span style="font-size:12px;font-weight:700;color:var(--gold);white-space:nowrap;">Dynamic Pars &rsaquo;</span></div>'
      : '';

    return '<div class="card form-card os-vcard" data-vendor="' + this.cssEsc(vendor) + '">'
      + '<div class="card-title">' + esc(vendor) + '</div>'
      + '<div class="card" style="padding:0;overflow:hidden;margin-bottom:12px;"><table class="ing-tbl"><thead><tr>'
      + '<th>Product</th><th style="width:130px;">On Hand</th><th style="width:90px;">Par</th><th style="width:140px;">Order Qty</th><th style="width:110px;">Unit Cost</th><th style="width:110px;">Extended</th><th style="width:110px;"></th>'
      + '</tr></thead><tbody class="os-lines-tbody">' + rows + '</tbody></table></div>'
      + '<div style="margin-top:10px;"><button class="btn btn-ghost btn-sm os-add-item">+ Add Item</button></div>'
      + '<div style="margin-top:14px;background:var(--input);border:1px solid var(--b-edge);border-radius:8px;padding:14px 18px;">'
      + '<div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Line Items</div><div class="calc-val lg os-vcount">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Order Total</div><div class="calc-val lg os-vtotal">$0.00</div></div>'
      + parNudge
      + '</div></div>'
      + '</div>'
      + '<div class="os-create-row" data-vendor="' + this.cssEsc(vendor) + '" style="margin:16px 0 32px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary os-create" data-vendor="' + this.cssEsc(vendor) + '">Create Order</button>'
      + '<span class="os-verr" style="color:var(--red);font-size:12px;display:none;"></span>'
      + '</div>';
  },

  // ── Custom Order panel (vendor-agnostic ad-hoc order, at the bottom) ──────
  customOrderPanelHTML() {
    const vendors = ((App.inventoryData && App.inventoryData.ic_vendors) || [])
      .slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const opts = '<option value="">Select vendor...</option>'
      + vendors.map(v => '<option value="' + esc(v.name) + '">' + esc(v.name) + '</option>').join('');
    return '<div class="sh" style="margin:24px 0 10px;">New Custom Order</div>'
      + '<div class="card form-card os-vcard os-custom" data-vendor="">'
      + '<div class="form-row" style="margin-bottom:0;">'
        + '<div class="f" style="width:280px;margin-bottom:0;"><label>Vendor</label>'
          + '<select class="os-co-vendor">' + opts + '</select></div>'
      + '</div>'
      + '<div class="os-co-body" style="display:none;margin-top:12px;">'
        + '<div class="card" style="padding:0;overflow:hidden;margin-bottom:12px;"><table class="ing-tbl"><thead><tr>'
          + '<th>Product</th><th style="width:130px;">On Hand</th><th style="width:90px;">Par</th><th style="width:140px;">Order Qty</th><th style="width:110px;">Unit Cost</th><th style="width:110px;">Extended</th><th style="width:110px;"></th>'
        + '</tr></thead><tbody class="os-lines-tbody"></tbody></table></div>'
        + '<div style="margin-top:10px;"><button class="btn btn-ghost btn-sm os-add-item">+ Add Item</button></div>'
        + '<div style="margin-top:14px;background:var(--input);border:1px solid var(--b-edge);border-radius:8px;padding:14px 18px;">'
        + '<div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
          + '<div class="calc-item"><div class="calc-label">Line Items</div><div class="calc-val lg os-vcount">0</div></div>'
          + '<div class="calc-item"><div class="calc-label">Order Total</div><div class="calc-val lg os-vtotal">$0.00</div></div>'
        + '</div></div>'
      + '</div>'
      + '</div>'
      + '<div class="os-co-actions" style="display:none;margin:16px 0 32px;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary os-co-create">Create Order</button>'
        + '<button class="btn btn-ghost os-co-cancel">Cancel</button>'
        + '<span class="os-verr" style="color:var(--red);font-size:12px;display:none;"></span>'
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
    const actions = this.container.querySelector('.os-create-row[data-vendor="' + this.cssEsc(vendor) + '"]');
    const err = actions ? actions.querySelector('.os-verr') : null;
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };

    const lineItems = [];
    card.querySelectorAll('.os-line').forEach(line => {
      const inp = line.querySelector('.os-qty');
      const qty = parseFloat(inp.value) || 0;
      const productId = inp.dataset.productId || '';
      if (qty <= 0 || !productId) return;
      const product = this.productById(productId);
      const nameEl = line.querySelector('.val');
      const name = product ? product.name : (nameEl ? nameEl.textContent : '');
      const cost = parseFloat(inp.dataset.cost) || 0;
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
    if (lineItems.length === 0) { fail('Set an order quantity above zero first.'); return; }

    const rec = {
      id:         App.uid(),
      vendor,
      date:       App.todayLocal(),
      status:     'Open',
      line_items: lineItems,
      item_count: lineItems.length,
      total:      lineItems.reduce((t, i) => t + i.extended, 0),
      created_at: new Date().toISOString()
    };

    const btn = actions ? actions.querySelector('.os-create') : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }
    const ok = await App.putRecord('ic', 'order', rec);
    if (ok) {
      this._created[vendor] = true;
      this.renderMain();
      this.scrollContentTop();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Create Order'; }
      fail('Could not create the order. Try again.');
    }
  }
};
