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
  _editVendor: null,    // vendor whose placed order is pulled back for editing
  _pendingEditId: null, // one-shot: order id to edit, set by Order History deep-link
  _menuCloser: null,    // active outside-click closer for an open ⋯ menu
  customOpen: false,    // is the Create Custom Order card open (toggled by the status-card link)

  countsAsc() {
    return [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort(App.cmpOldest);
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
    this._editVendor = null;   // fresh entry starts clean (not mid-edit)
    if (this._pendingEditId) {   // deep-link from Order History "Edit Order"
      const o = this.orders().find(x => x.id === this._pendingEditId);
      this._pendingEditId = null;
      if (o && o.status !== 'Received') this._editVendor = o.vendor;
    }
    if (this._menuCloser) { document.removeEventListener('click', this._menuCloser, true); this._menuCloser = null; }
    this.renderMain();
  },

  showHowTo() {
    App.showHelpModal('How the Order Sheet Works', [
      { p: ['The Order Sheet turns your latest count into orders. Anything below par shows up under the vendor you buy it from, already filled to the quantity that brings you back to par. You can also build an order from scratch at the bottom.'] },
      { h: 'The Order Status Card', p: ['Up top, Order Status shows what is still to order at a glance, what you have already ordered, and how old the count behind these suggestions is. Email an already-placed order straight to the vendor from here. When the count behind these numbers is more than a week old, the date line turns amber with a Take a fresh count link, because old counts make for stale reorder math; tap it to go count before you order off a guess.'] },
      { h: 'More Actions On A Placed Order', p: ['On an Already Ordered row, the ... button opens a menu with three moves. Export PDF gives you a purchase order to print or attach to a vendor email. Edit Order pulls that placed order back onto the page as an editable card so you can fix a quantity or add a line, then Update Order writes it back to the same order. Cancel Order removes it and returns those items to your Order Sheet so you can reorder.'] },
      { h: 'Suggested Orders', p: ['Each vendor card lists their products that fell under par in your last count, with on-hand, par, and a suggested order quantity. Adjust any quantity, add a product the count missed with Add Item, then Create Order. Bottle beer is ordered by the case. If a vendor card or the Order Status shows that some pars look off versus your real usage, the Dynamic Pars link takes you to tune them, because the suggested quantities are only as sharp as the pars behind them.'] },
      { h: 'Sending The Order', p: ['Once you create an order it moves to Already Ordered up top. Email to Vendor opens your email client with the order written out and addressed to the vendor on file, and marks it Submitted. The order also sits in Order History.'] },
      { h: 'Order Minimums', p: ['If a vendor has an Order Minimum set on their vendor page, each vendor card shows your running order against it, right beside Add Item, and turns amber when you are short, for example "$70 under the $250 minimum" (or a count like "2 cases under the 5 cases minimum" for a case minimum). Add more of that vendor’s below-par items to clear it in one delivery instead of paying twice. A delivery fee or free-delivery-over amount shows here too. Order Status up top counts how many vendors are currently under minimum. You are only ever warned, so you can still create a short order if you need to.'] },
      { h: 'Create A Custom Order', p: ['Need an off-cycle order, like a party order or a one-time buy without waiting on a count? Hit Create Custom Order on the right side of the Order Status card. The build card opens up: pick the vendor, add the products and quantities, and create it the same way. Hit Cancel Custom Order on that same link to close it back up.'] },
      { h: 'Closing The Loop', p: ['When the delivery shows up, go to Receive Delivery and match it to the open order. The line items pre-fill, you confirm against the invoice, and Bar Cop marks the order Received.'] }
    ]);
  },

  // Units RECEIVED for each product since the count its on-hand came from.
  // ⚠ THIS IS NOW FOLDED INTO THE SUGGESTION (Kyle's call 2026-07-24, superseding "surface it,
  // never fold it in"). The old rule feared that receipts-without-pours bias on-hand HIGH and
  // suppress orders you genuinely need. Kyle then hit the other side of it live: count Sunday,
  // order 5, receive them Monday, and the SAME order comes back at full quantity. Following the
  // sheet was actively creating trapped cash, which is the exact thing Bar Cop exists to free.
  // The run-dry risk is handled instead by the just-received strip in belowParByVendor(), which
  // keeps such an item VISIBLE and one click from being ordered.
  // Per PRODUCT, not per file: a count can skip products, so each product's on-hand can come from a
  // different (older) count, and what matters is everything received after THAT product's count.
  receivedSinceCount() {
    // A count and a delivery on the SAME DAY cannot be ordered by date alone, and getting it wrong
    // now MOVES THE SUGGESTION rather than just a note. Prefer a real created_at on both sides.
    // When one is missing, assume the COUNT came first (an operator counts before service and takes
    // deliveries during it) so the delivery is credited. That is also the safer default here:
    // over-crediting surfaces in the just-received strip, under-crediting silently re-orders stock
    // already on the shelf. created_at is UTC and `date` is the local business day, so a same-day
    // comparison is a heuristic either way — which is why the strip exists.
    const ts = (rec, endOfDay) => {
      const c = rec && rec.created_at ? String(rec.created_at) : '';
      if (/^\d{4}-\d{2}-\d{2}T/.test(c)) return c;
      const d = String((rec && rec.date) || '').slice(0, 10);
      return d ? d + (endOfDay ? 'T23:59:59' : 'T00:00:00') : '';
    };
    const lastCounted = {};   // product_id -> newest stamp that product was actually counted
    ((App.inventoryData && App.inventoryData.ic_counts) || []).forEach(cnt => {
      const t = ts(cnt, false);
      if (!t) return;
      (cnt.items || []).forEach(it => {
        // `counted === false` never sets on-hand, so it must not count as "you counted this" here.
        if (!it || it.counted === false || !it.product_id) return;
        if (!lastCounted[it.product_id] || t > lastCounted[it.product_id]) lastCounted[it.product_id] = t;
      });
    });
    const out = {};
    ((App.inventoryData && App.inventoryData.ic_deliveries) || []).forEach(dv => {
      const t = ts(dv, true);
      if (!t) return;
      (dv.line_items || []).forEach(li => {
        const pid = li && li.product_id;
        if (!pid) return;
        const since = lastCounted[pid];
        if (!since || t <= since) return;   // counted at/after the delivery: already reflected in on-hand
        // Delivery qty is stored in the same container unit as on-hand and par (cases for bottle beer).
        out[pid] = (out[pid] || 0) + (App.unitsFromDeliveryLine ? App.unitsFromDeliveryLine(li) : (parseFloat(li.qty) || 0));
      });
    });
    return out;
  },

  // products below par in the latest count, grouped by vendor.
  belowParByVendor() {
    const asc = this.countsAsc();
    if (asc.length === 0) return null;
    const latest = asc[asc.length - 1];   // kept for the "suggestions based on your … count" date line
    const onHand = App.currentOnHand();
    const received = this.receivedSinceCount();

    const groups = {};
    // Items that are only OFF the list because of a receipt. Same shape as a `groups` line, so the
    // strip can render and order them with the existing machinery. See the run-dry note below.
    const justReceived = {};
    Object.keys(onHand).forEach(pid => {
      const p = this.productById(pid);
      if (!p || p.active === false) return;   // hidden/discontinued: out of orders, same as counts/par/receive (Hide promises this)
      if (p.par_level == null || p.par_level === '' || !(p.par_level > 0)) return;
      const isCaseBeer = (p.category === 'Bottle Beer') && p.case_size && p.case_size > 0;
      const oh = onHand[pid] || 0;
      const recvd = received[pid] || 0;
      // ⭐ POSITION, not the last count. What you counted PLUS what has landed since. Ordering off
      // the count alone re-ordered everything you had just received, at full quantity, until the
      // next count — a sheet telling you to buy what is already on the shelf. Floored so a
      // short receive still asks for the remainder and a full one asks for nothing.
      const position = oh + recvd;
      const line = {
        product: p,
        on_hand: oh,             // what was COUNTED — kept separate so the row can show both
        par: p.par_level,
        position: position,
        suggested: Math.max(1, Math.ceil(p.par_level - position)),
        unit_cost: p.unit_cost != null ? p.unit_cost : 0,
        is_case_beer: isCaseBeer,
        received_since: recvd
      };
      const vendor = p.vendor || 'Unassigned';
      if (position >= p.par_level) {
        // ⚠ THE RUN-DRY GUARD. Nothing subtracts what you POUR between counts, so a receipt the bar
        // has already poured through would silently hide a genuine reorder. An item that is only
        // off the list BECAUSE of a receipt therefore does not vanish: it moves to the
        // just-received strip with its real breakdown, and stays one click from being ordered.
        // (An item that was simply at par all along was never on the list and does not belong here.)
        if (oh < p.par_level && recvd > 0) (justReceived[vendor] = justReceived[vendor] || []).push(line);
        return;
      }
      if (!groups[vendor]) groups[vendor] = [];
      groups[vendor].push(line);
    });
    return { latest, groups, justReceived };
  },

  // Most recent in-flight order (status != Received) for a vendor, or null.
  openOrderForVendor(vendorName) {
    if (!vendorName) return null;
    const open = this.orders().filter(o => o && o.vendor === vendorName && o.status !== 'Received');
    if (open.length === 0) return null;
    return open.slice().sort(App.cmpNewest)[0];
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

    // A vendor pulled back for editing shows as an editable card up top, seeded
    // from the placed order — not under Already Ordered while it is being edited.
    const editOrder = this._editVendor ? this.openOrderForVendor(this._editVendor) : null;
    if (this._editVendor && !editOrder) this._editVendor = null;

    // Split vendors into "needs ordering" vs "already has an open order".
    const visibleVendors = [];
    const hiddenVendors  = [];
    allVendors.forEach(v => {
      if (v === this._editVendor) return;            // handled as the edit card below
      if (this.openOrderForVendor(v)) hiddenVendors.push(v);
      else visibleVendors.push(v);
    });

    const editHtml = editOrder
      ? '<div class="sh" style="margin:24px 0 10px;">Editing Order</div>' + this.editVendorCardHTML(editOrder)
      : '';

    let statusHtml, vendorHtml = '';
    if (visibleVendors.length === 0 && hiddenVendors.length === 0 && !editOrder) {
      statusHtml = '<div class="card form-card"><div class="card-title">'
        + '<span>Order Status</span></div>'
        + '<div class="empty" style="margin:0;"><div class="empty-title">Everything is at par</div>'
        + '<div class="empty-sub">No products in the ' + this.fmtDate(data.latest.date)
        + ' count are below their par level. Nothing to order.</div></div>'
        + this.customToggleRow(data.latest) + '</div>';
    } else {
      statusHtml = this.statusCardHTML(visibleVendors, hiddenVendors, data);
      // Just-received lines ride INSIDE their vendor's card when that vendor already has one, so a
      // vendor never renders twice with two Create Order buttons. Only vendors with nothing below
      // par get their own strip card below.
      const jrAll = data.justReceived || {};
      const linesFor = v => (data.groups[v] || [])
        .concat((jrAll[v] || []).map(l => Object.assign({}, l, { just_received: true })));
      vendorHtml = editHtml + (visibleVendors.length
        ? '<div class="sh" style="margin:24px 0 10px;">Suggested Orders</div>'
          + visibleVendors.map(v => this.vendorCard(v, linesFor(v))).join('')
        : '');
      const jrOnly = Object.keys(jrAll).sort()
        .filter(v => !(data.groups[v] || []).length && v !== this._editVendor && !this.openOrderForVendor(v));
      if (jrOnly.length) {
        vendorHtml += '<div class="sh" style="margin:24px 0 4px;">Just Received &middot; Confirm At Your Next Count</div>'
          + '<div style="font-size:12px;color:var(--t3);margin:0 0 10px;">These were under par at your last count, but deliveries since have covered them, '
          + 'so Bar Cop is not suggesting them. If you have already poured through what landed, order anyway.</div>'
          + jrOnly.map(v => this.justReceivedCard(v, (jrAll[v] || []).map(l => Object.assign({}, l, { just_received: true })))).join('');
      }
    }

    // Custom Order card sits right below Order Status, above the suggested vendor cards.
    this.container.innerHTML = '<div class="screen">' + statusHtml + (this.customOpen ? this.customOrderPanelHTML() : '') + vendorHtml + '</div>';

    // Per-card input handler for the quantity field on existing lines, plus the
    // in-row product picker on blank Add Item rows.
    this.container.querySelectorAll('.os-vcard').forEach(card => {
      card.addEventListener('input', ev => {
        if (ev.target.classList.contains('os-qty')) { this.recalcVendor(card); this._captureCard(card); }
      });
      card.addEventListener('change', ev => {
        if (ev.target.classList.contains('os-prod')) { this.onLineProductChange(ev.target); this._captureCard(card); }
      });
    });

    // Vendor picker on the custom order panel.
    this.container.querySelector('.os-co-vendor')?.addEventListener('change', (ev) => this.onCustomVendorChange(ev.target.value));

    this.container.onclick = ev => {
      const more = ev.target.closest('.os-omore');
      if (more) { ev.stopPropagation(); this.toggleMenu(more.dataset.id); return; }
      // Any other click (including a menu item) closes the open ⋯ menu. The item
      // handlers below still fire — closest() resolves on the hidden node.
      this.closeAllMenus();

      if (ev.target.closest('.os-par-nudge')) { App.navigate('ic-par-suggestions'); return; }
      if (ev.target.closest('#os-go-history')) { App.navigate('ic-order-history'); return; }
      if (ev.target.closest('.os-take')) { App.navigate('ic-take-inventory'); return; }
      const email = ev.target.closest('.os-email');
      if (email) { this.emailOrder(email.dataset.id); return; }
      const pdf = ev.target.closest('.os-pdf');
      if (pdf) { this.exportOrderPdf(pdf.dataset.id); return; }
      const editOrder = ev.target.closest('.os-edit');
      if (editOrder) { this.startEditOrder(editOrder.dataset.id); return; }
      const cancelOrder = ev.target.closest('.os-cancel');
      if (cancelOrder) { this.cancelOrder(cancelOrder.dataset.id); return; }
      const update = ev.target.closest('.os-update');
      if (update) { this.updateOrder(update.dataset.vendor); return; }
      if (ev.target.closest('.os-editcancel')) { this.cancelEditOrder(); return; }
      const rm      = ev.target.closest('.os-remove');
      const create  = ev.target.closest('.os-create');
      const coCreate = ev.target.closest('.os-co-create');
      const coCancel = ev.target.closest('.os-co-cancel');
      const addItem = ev.target.closest('.os-add-item');

      if (rm) {
        const card = rm.closest('.os-vcard');
        rm.closest('.os-line').remove();
        this.recalcVendor(card);
        this._captureCard(card);
        return;
      }
      if (addItem) { this.addBlankLine(addItem.closest('.os-vcard')); return; }
      if (ev.target.closest('.os-co-toggle')) {
        this.customOpen = !this.customOpen;
        if (!this.customOpen) this.closeCustomOrder();
        this.renderMain();
        return;
      }
      if (coCreate) { this.createCustomOrder(); return; }
      if (coCancel) { this.customOpen = false; this.closeCustomOrder(); this.renderMain(); return; }
      if (create) this.createOrder(create.dataset.vendor);
    };

    this._restoreDrafts();
    this.container.querySelectorAll('.os-vcard').forEach(card => this.recalcVendor(card));
  },

  // ── Combined Order Status card (still to order + already ordered + age) ──────
  statusCardHTML(visibleVendors, hiddenVendors, data) {
    let stillCount = 0, stillTotal = 0, underMin = 0;
    visibleVendors.forEach(v => (data.groups[v] || []).forEach(l => {
      stillCount++; stillTotal += (l.suggested || 0) * (l.unit_cost || 0);
    }));
    // How many suggested orders fall under their vendor's minimum right now.
    visibleVendors.forEach(v => {
      const info = this._vendorInfo(v);
      if (!info || info.min == null) return;
      const lines = data.groups[v] || [];
      const money = info.unit === '$';
      const measure = money ? lines.reduce((t, l) => t + (l.suggested || 0) * (l.unit_cost || 0), 0)
                            : lines.reduce((t, l) => t + (l.suggested || 0), 0);
      if (measure < info.min - 0.001) underMin++;
    });

    const stillSection = '<div style="flex:1;min-width:220px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Still to Order</div>'
      + (visibleVendors.length === 0
          ? '<div style="font-size:13px;color:var(--t2);">Nothing left to order from this count.</div>'
          : '<div style="font-size:13px;color:var(--t1);line-height:1.6;"><strong>' + visibleVendors.length + ' vendor' + (visibleVendors.length === 1 ? '' : 's') + '</strong> &middot; ' + stillCount + ' item' + (stillCount === 1 ? '' : 's') + ' &middot; <strong style="color:var(--gold);">' + App.fmtCurrency(stillTotal) + '</strong> to order</div>')
      + (underMin > 0 ? '<div style="font-size:12px;color:var(--amber);margin-top:6px;"><strong>' + underMin + ' vendor' + (underMin === 1 ? '' : 's') + '</strong> under order minimum &middot; top off on the vendor order</div>' : '')
      + '</div>';

    const openOrders = hiddenVendors.map(v => this.openOrderForVendor(v)).filter(Boolean);
    const orderedSection = openOrders.length === 0 ? '' :
      '<div style="flex:1;min-width:280px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--green);margin-bottom:8px;">Already Ordered</div>'
      + openOrders.map(o => '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid var(--b2);">'
          + '<div style="font-size:12px;color:var(--t1);min-width:0;">' + esc(o.vendor) + ' <span style="color:var(--t3);white-space:nowrap;">&middot; ' + App.fmtCurrency(o.total || 0) + ' &middot; ' + esc(o.status || 'Open') + '</span></div>'
          + '<div style="display:flex;gap:8px;flex-shrink:0;position:relative;align-items:center;">'
            + '<button class="btn btn-ghost btn-sm os-email" data-id="' + esc(o.id) + '">' + (o.status === 'Open' ? 'Email to Vendor' : 'Resend') + '</button>'
            + '<button class="btn btn-ghost btn-sm os-omore" data-id="' + esc(o.id) + '" aria-label="More actions" style="letter-spacing:2px;padding-left:10px;padding-right:10px;">&middot;&middot;&middot;</button>'
            + '<div class="os-omenu" data-id="' + esc(o.id) + '" style="display:none;">'
              + '<button class="om-item os-pdf" data-id="' + esc(o.id) + '">Export PDF</button>'
              + '<button class="om-item os-edit" data-id="' + esc(o.id) + '">Edit Order</button>'
              + '<button class="om-item danger os-cancel" data-id="' + esc(o.id) + '">Cancel Order</button>'
            + '</div>'
          + '</div>'
        + '</div>').join('')
      + '<div style="margin-top:8px;"><button class="btn btn-ghost btn-sm" id="os-go-history">View in Order History</button></div>'
      + '</div>';

    return '<div class="card form-card"><div class="card-title">'
      + '<span>Order Status</span></div>'
      + '<div style="display:flex;gap:36px;flex-wrap:wrap;align-items:flex-start;">' + stillSection + orderedSection + '</div>'
      + this.customToggleRow(data.latest)
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
    // 'inline' = just the text (no border/margin); the caller supplies the row
    // that pairs it with the Create Custom Order link.
    if (standalone === 'inline') {
      return '<div style="font-size:11px;color:' + (stale ? 'var(--amber)' : 'var(--t3)') + ';">' + inner + '</div>';
    }
    if (standalone) {
      return '<div style="font-size:11px;color:' + (stale ? 'var(--amber)' : 'var(--t3)') + ';margin-top:14px;">' + inner + '</div>';
    }
    return '<div style="font-size:11px;color:' + (stale ? 'var(--amber)' : 'var(--t3)') + ';margin-top:14px;border-top:1px solid var(--b2);padding-top:10px;">' + inner + '</div>';
  },

  // The Order Status card's bottom row: the count-age note on the left, the gold
  // Create / Cancel Custom Order toggle link on the right.
  customToggleRow(latest) {
    const label = this.customOpen ? '+ Cancel Custom Order' : '+ Create Custom Order';
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:14px;border-top:1px solid var(--b2);padding-top:10px;">'
      + '<div style="flex:1;min-width:200px;">' + this.countAgeNote(latest, 'inline') + '</div>'
      + '<span class="os-co-toggle" style="color:var(--gold);font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;white-space:nowrap;">' + label + '</span>'
      + '</div>';
  },

  // ── Email an already-placed order to the vendor (reuses Order History's body) ─
  async emailOrder(orderId) {
    const order = this.orders().find(o => o.id === orderId);
    if (!order) return;
    if (S.InventoryOrderHistory && S.InventoryOrderHistory.buildMailto) {
      window.location.href = S.InventoryOrderHistory.buildMailto(order);
    }
    if (order.status === 'Open') {
      // Twin of ic-order-history.emailOrder — same live-row shape, fixed with it.
      const undo = App.snapshotRows([order]);
      order.status = 'Submitted';
      order.submitted_at = new Date().toISOString();
      if (!(await App.putRecord('ic', 'order', order))) App.restoreRows(undo);
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
    this._captureCard(card);
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

    // Perpetual on-hand summed across EVERY location, the same number belowParByVendor
    // and the suggested lines already read. The old lookup took the first matching line
    // off the latest count, which is a single LOCATION's shelf, so a product stocked at
    // the front bar and dry storage showed only the front bar and this one screen
    // carried two different on-hand figures for it. Worse, the low one seeded the order
    // qty, so + Add Item reordered a full par against a shelf already at par.
    const _oh = App.currentOnHand()[pid];
    const onHand = (_oh != null && !isNaN(_oh)) ? _oh : null;
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
    this._customDraft = null;
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
      this._customDraft = null;
      body.style.display = 'none';
      if (actions) actions.style.display = 'none';
      return;
    }
    body.style.display = '';
    if (actions) actions.style.display = 'flex';
    const tbody = panel.querySelector('.os-lines-tbody');
    if (tbody) tbody.innerHTML = this.blankLineRowHTML(vendorName, []);
    this.recalcVendor(panel);
    this._captureCard(panel);
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
      const qty = Math.max(0, parseFloat(inp.value) || 0);
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
      this.customOpen = false;
      this.closeCustomOrder();
      this.renderMain();
      this.scrollContentTop();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Create Order'; }
      fail('Could not create the order. Try again.');
    }
  },

  // ⚠ TWO DIFFERENT ESCAPES — do not mix them. cssEsc builds the HTML ATTRIBUTE, where a double
  // quote has to become &quot; and the DOM then holds a real ". selEsc builds the CSS SELECTOR that
  // has to MATCH that DOM value. Feeding cssEsc into a selector produced
  // [data-vendor="Bob&quot;s Beverage"], which matches nothing — querySelector returned null and
  // Create Order hit its `if (!card) return`, so the button did nothing and said nothing. A vendor
  // name is free-typed operator text. (bottle-slider.js:135 reaches for CSS.escape, but that
  // escapes an IDENTIFIER; the value here sits inside quotes, where escaping " and \ is the whole
  // job and CSS.escape would only add noise like \32  for a leading digit.)
  cssEsc(s) { return String(s).replace(/"/g, '&quot;'); },
  selEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); },

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
  lineRowHTML(product, qty, onHand, par, recvd, line) {
    const unitCost = product.unit_cost != null ? product.unit_cost : 0;
    const unit = App.unitAbbr(App.productUnit(product));
    const jr = !!(line && line.just_received);
    // Deliveries since this product's last count are now IN the suggestion (see
    // receivedSinceCount), so the row shows the working rather than a bare number: what you
    // counted, what has landed since, and the position those add up to. On a just-received row
    // that position is what took it off the order list, so it has to be legible or the operator
    // cannot judge whether to override it. Formatted through onHandText so beer reads in cases.
    const recvNote = (recvd > 0)
      ? '<div style="font-size:10px;color:var(--gold);margin-top:2px;">+' + esc(this.onHandText(product, recvd, unit)) + ' received since'
        + (line && line.position != null
            ? ' &middot; ' + esc(this.onHandText(product, line.position, unit)) + ' on hand now' : '')
        + '</div>'
      : '';
    // A just-received row defaults to ZERO. It is here so a genuine reorder is never hidden, not
    // to be ordered by reflex — position already covers par, so any quantity is a deliberate
    // override by someone who thinks the stock has been poured through.
    if (jr) qty = 0;
    return '<tr class="os-line" data-product-id="' + esc(product.id || '') + '">'
      + '<td><div class="val">' + esc(product.name || '') + '</div>'
      + '<div style="font-size:10px;color:var(--t3);">' + esc(product.category || '') + '</div></td>'
      + '<td class="os-onhand">' + this.onHandText(product, onHand, unit) + recvNote + '</td>'
      + '<td class="os-par">' + this.parText(par, unit) + '</td>'
      + '<td><input type="number" class="os-qty form-input" data-cost="' + unitCost + '" data-product-id="' + esc(product.id || '') + '" min="0" step="1" '
      + 'value="' + qty + '" style="width:80px;"/>' + (unit ? ' <span class="os-unit" style="font-size:10px;color:var(--t3);">' + unit + '</span>' : '<span class="os-unit"></span>') + '</td>'
      + '<td class="os-uc">' + App.fmtCurrency(unitCost) + '</td>'
      + '<td class="val os-ext">' + App.fmtCurrency(qty * unitCost) + '</td>'
      + '<td data-label=""></td>'
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
      + '<td><input type="number" class="os-qty form-input" data-cost="0" data-product-id="" min="0" step="1" value="" style="width:80px;"/> <span class="os-unit" style="font-size:10px;color:var(--t3);"></span></td>'
      + '<td class="os-uc">' + App.fmtCurrency(0) + '</td>'
      + '<td class="val os-ext">' + App.fmtCurrency(0) + '</td>'
      + '<td data-label=""></td>'
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
      return '<option value="">All products on the order</option>';
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
    const rows = lines.map(l => this.lineRowHTML(l.product, l.suggested, l.on_hand, l.par, l.received_since, l)).join('');
    return this.vendorCardShell(vendor, rows, lines.map(l => l.product), { mode: 'create' });
  },

  // Just-received lines for a vendor that has NOTHING below par — they would otherwise have no
  // card at all. A vendor that DOES have below-par lines gets these appended to its existing card
  // instead (see renderMain): two cards for one vendor means two Create Order buttons and two
  // orders for the same delivery.
  justReceivedCard(vendor, lines) {
    const rows = lines.map(l => this.lineRowHTML(l.product, l.suggested, l.on_hand, l.par, l.received_since, l)).join('');
    return this.vendorCardShell(vendor, rows, lines.map(l => l.product), { mode: 'create' });
  },

  // Re-open a placed order as an editable card, seeded from the order's own line
  // items (current on-hand / par shown alongside). Saving writes back to the
  // SAME order. This is "pull it back to the Order Sheet to tweak it".
  editVendorCardHTML(order) {
    // On hand from the perpetual read, the same source the fresh order sheet, the
    // line-product picker (onLineProductChange) and the delivery flow all use. This built
    // its own map off `belowParByVendor().latest.items`, which is ONE count: a product
    // counted at another location dropped out entirely, and with no `counted === false`
    // filter an UNCOUNTED line read as real stock. Worst of it, changing a row's product
    // fires onLineProductChange, which reads App.currentOnHand(), so the same cell in the
    // same card showed two different On Hand numbers depending on whether you touched it.
    // (App.currentOnHand takes the newest COUNTED value per product per location across
    // every count, then sums the locations.)
    const onHand = App.currentOnHand();
    const products = [];
    const rows = (order.line_items || []).map(li => {
      let p = this.productById(li.product_id);
      if (!p) p = { id: li.product_id || '', name: li.name || 'Unknown product', unit_cost: li.unit_cost || 0, category: '' };
      products.push(p);
      const _oh = li.product_id != null ? onHand[li.product_id] : null;
      const oh = (_oh != null && !isNaN(_oh)) ? _oh : null;
      const par = (p.par_level != null && p.par_level !== '') ? p.par_level : null;
      return this.lineRowHTML(p, li.qty != null ? li.qty : 0, oh, par);
    }).join('');
    return this.vendorCardShell(order.vendor || '', rows, products, { mode: 'edit', orderId: order.id });
  },

  // Shared card body for a fresh suggested order AND an order pulled back to
  // edit. The primary button + error sit in a row BELOW the card.
  vendorCardShell(vendor, rows, products, opts) {
    const isEdit = opts && opts.mode === 'edit';
    const parOff = this.parIssueCount(products || []);
    const parNudge = parOff > 0
      ? '<div class="os-par-nudge" style="margin-left:auto;display:flex;align-items:center;gap:10px;cursor:pointer;max-width:540px;">'
        + '<span style="font-size:12px;color:var(--t1);line-height:1.5;text-align:right;"><strong style="color:var(--amber);">' + parOff + ' par' + (parOff === 1 ? '' : 's') + '</strong> ' + (parOff === 1 ? 'looks' : 'look') + ' off vs usage.</span>'
        + '<span style="font-size:12px;font-weight:700;color:var(--gold);white-space:nowrap;">Dynamic Pars &rsaquo;</span></div>'
      : '';
    const title = isEdit
      ? esc(vendor) + ' <span style="font-size:11px;font-weight:600;color:var(--t3);">&middot; editing placed order</span>'
      : esc(vendor);
    const actionBtns = isEdit
      ? '<button class="btn btn-primary os-update" data-vendor="' + this.cssEsc(vendor) + '" data-order-id="' + esc(opts.orderId) + '">Update Order</button>'
        + '<button class="btn btn-ghost os-editcancel">Cancel</button>'
      : '<button class="btn btn-primary os-create" data-vendor="' + this.cssEsc(vendor) + '">Create Order</button>';

    return '<div class="card form-card os-vcard" data-vendor="' + this.cssEsc(vendor) + '"' + (isEdit ? ' data-order-id="' + esc(opts.orderId) + '"' : '') + '>'
      + '<div class="card-title">' + title + '</div>'
      + '<div class="pill-wrap" style="margin-bottom:12px;"><table class="ing-tbl pill" style="table-layout:fixed;"><thead><tr>'
      + '<th style="width:26%;">Product</th><th style="width:11%;">On Hand</th><th style="width:8%;">Par</th><th style="width:14%;">Order Qty</th><th style="width:11%;">Unit Cost</th><th style="width:11%;">Extended</th><th style="width:9%;"></th><th style="width:10%;"></th>'
      + '</tr></thead><tbody class="os-lines-tbody">' + rows + '</tbody></table></div>'
      // Add Item on the left; the vendor order-minimum / delivery-fee readout sits
      // right beside it (filled by recalcVendor; hidden when the vendor has none set).
      + '<div style="margin-top:10px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">'
      +   '<button class="btn btn-ghost btn-sm os-add-item">+ Add Item</button>'
      +   '<div class="os-min-row" style="display:none;align-items:center;gap:12px;font-size:12px;flex-wrap:wrap;">'
      +     '<span class="os-min"></span>'
      +   '</div>'
      + '</div>'
      + '<div style="margin-top:14px;background:var(--input);border:1px solid var(--b-edge);border-radius:8px;padding:14px 18px;">'
      + '<div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Line Items</div><div class="calc-val lg os-vcount">0</div></div>'
      + '<div class="calc-item"><div class="calc-label">Order Total</div><div class="calc-val lg os-vtotal">$0.00</div></div>'
      + parNudge
      + '</div>'
      + '</div>'
      + '</div>'
      + '<div class="os-create-row" data-vendor="' + this.cssEsc(vendor) + '" style="margin:16px 0 32px;display:flex;align-items:center;gap:8px;">'
      + actionBtns
      + '<span class="os-verr" style="color:var(--red);font-size:12px;display:none;"></span>'
      + '</div>';
  },

  // ── Custom Order panel (vendor-agnostic ad-hoc order, at the bottom) ──────
  customOrderPanelHTML() {
    const vendors = ((App.inventoryData && App.inventoryData.ic_vendors) || [])
      .slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const opts = '<option value="">Select vendor...</option>'
      + vendors.map(v => '<option value="' + esc(v.name) + '">' + esc(v.name) + '</option>').join('');
    return '<div class="sh" style="margin:24px 0 10px;">Create Custom Order</div>'
      + '<div class="card form-card os-vcard os-custom" data-vendor="">'
      + '<div class="form-row" style="margin-bottom:0;">'
        + '<div class="f" style="width:280px;margin-bottom:0;"><label>Vendor</label>'
          + '<select class="os-co-vendor">' + opts + '</select></div>'
      + '</div>'
      + '<div class="os-co-body" style="display:none;margin-top:12px;">'
        + '<div class="pill-wrap" style="margin-bottom:12px;"><table class="ing-tbl pill" style="table-layout:fixed;"><thead><tr>'
          + '<th style="width:26%;">Product</th><th style="width:11%;">On Hand</th><th style="width:8%;">Par</th><th style="width:14%;">Order Qty</th><th style="width:11%;">Unit Cost</th><th style="width:11%;">Extended</th><th style="width:9%;"></th><th style="width:10%;"></th>'
        + '</tr></thead><tbody class="os-lines-tbody"></tbody></table></div>'
        + '<div style="margin-top:10px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">'
          + '<button class="btn btn-ghost btn-sm os-add-item">+ Add Item</button>'
          + '<div class="os-min-row" style="display:none;align-items:center;gap:12px;font-size:12px;flex-wrap:wrap;">'
            + '<span class="os-min"></span>'
          + '</div>'
        + '</div>'
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
    let total = 0, count = 0, qtyTotal = 0;
    card.querySelectorAll('.os-line').forEach(line => {
      const inp = line.querySelector('.os-qty');
      const qty = Math.max(0, parseFloat(inp.value) || 0);
      /* ⛔ THE FLOOR ON `qty` ABOVE IS WHAT MAKES THIS TOTAL AGREE WITH "LINE ITEMS" (F15).
         The two COLLECT paths drop non-positive lines (`if (qty <= 0 || !productId) return;`)
         while this DISPLAY recalc counted everything — so a qty of -2 rendered EXTENDED
         "$-330.00", dragged ORDER TOTAL to "$-140.00", and the header still said LINE ITEMS 1.
         Two rows feeding the total under a heading that counted one. Flooring here makes the
         negative line contribute 0 to both, and the collect guard still excludes it from the
         order. Pinned by verify-order-sheet-qty-agrees.js. */
      const cost = parseFloat(inp.dataset.cost) || 0;
      const ext = qty * cost;
      line.querySelector('.os-ext').textContent = App.fmtCurrency(ext);
      total += ext; qtyTotal += qty;
      if (qty > 0) count++;
    });
    const cEl = card.querySelector('.os-vcount');
    const tEl = card.querySelector('.os-vtotal');
    if (cEl) cEl.textContent = count;
    if (tEl) tEl.textContent = App.fmtCurrency(total);
    this._updateMinReadout(card, total, qtyTotal);
  },

  // ── Vendor order minimums / delivery fees ──────────────────────────────────
  _vendorInfo(name) {
    const v = ((App.inventoryData && App.inventoryData.ic_vendors) || []).find(x => x.name === name);
    if (!v) return null;
    return {
      min:  (v.order_minimum != null && v.order_minimum > 0) ? v.order_minimum : null,
      unit: v.order_minimum_unit || '$',
      fee:  (v.delivery_fee > 0) ? v.delivery_fee : null,
      free: (v.free_delivery_over > 0) ? v.free_delivery_over : null,
    };
  },
  _qtyStr(x) { return Number.isInteger(x) ? String(x) : (Math.round(x * 100) / 100); },
  // How this order measures against the minimum: dollars for a '$' minimum, else the
  // raw quantity of units ordered.
  _updateMinReadout(card, total, qtyTotal) {
    const row = card.querySelector('.os-min-row');
    const minEl = card.querySelector('.os-min');
    if (!row || !minEl) return;
    const info = this._vendorInfo(card.dataset.vendor || '');
    if (!info || (info.min == null && info.fee == null && info.free == null)) { row.style.display = 'none'; return; }
    const parts = [];
    let under = 0;
    if (info.min != null) {
      const money = info.unit === '$';
      const measure = money ? total : qtyTotal;
      const fmt = x => money ? App.fmtCurrency(x) : (this._qtyStr(x) + ' ' + info.unit);
      under = info.min - measure;
      parts.push(under > 0.001
        ? '<span style="color:var(--amber);font-weight:700;">' + fmt(under) + ' under the ' + fmt(info.min) + ' minimum</span>'
        : '<span style="color:var(--green);font-weight:700;">Meets the ' + fmt(info.min) + ' minimum</span>');
    }
    if (info.free != null) {
      parts.push(total >= info.free
        ? '<span style="color:var(--green);">Free delivery</span>'
        : '<span style="color:var(--t3);">Free delivery over ' + App.fmtCurrency(info.free) + (info.fee != null ? ' (else ' + App.fmtCurrency(info.fee) + ' fee)' : '') + '</span>');
    } else if (info.fee != null) {
      parts.push('<span style="color:var(--t3);">' + App.fmtCurrency(info.fee) + ' delivery fee</span>');
    }
    minEl.innerHTML = parts.join(' <span style="color:var(--t4);">&middot;</span> ');
    row.style.display = 'flex';
  },

  // ── Draft persistence (suggested vendor cards + the custom order panel) ────
  // Keep edited quantities and added lines alive across leaving the screen and
  // coming back. In-memory: a full reload starts fresh, and creating the order
  // clears that card's draft. Captured ONLY on real edits (not the initial
  // render), so a fresh count still refreshes the suggestions for untouched
  // vendors. The edit-a-placed-order card is its own door, never a draft.
  _snapLines(card) {
    return [...card.querySelectorAll('.os-line')].map(line => {
      const inp = line.querySelector('.os-qty');
      return { product_id: (inp && inp.dataset.productId) || line.dataset.productId || '', qty: (inp && inp.value) || '' };
    });
  },
  _captureCard(card) {
    if (!card) return;
    if (card.classList.contains('os-custom')) {
      this._customDraft = { vendor: card.dataset.vendor || '', lines: this._snapLines(card) };
      return;
    }
    if (card.dataset.orderId) return;
    const vendor = card.dataset.vendor;
    if (!vendor) return;
    if (!this._cardDrafts) this._cardDrafts = {};
    this._cardDrafts[vendor] = this._snapLines(card);
  },
  // Rebuild one drafted line: a known product as a filled row (on-hand + par
  // recomputed from the latest count), an empty pick as a blank Add Item row.
  _restoreLineHTML(vendor, d, existingIds) {
    const product = d.product_id ? this.productById(d.product_id) : null;
    if (!product) return this.blankLineRowHTML(vendor, existingIds);
    // Same perpetual, all-locations on-hand as onLineProductChange: restoring a draft
    // used to silently flip every line's On Hand from the summed figure to one shelf's.
    const _oh = App.currentOnHand()[d.product_id];
    const onHand = (_oh != null && !isNaN(_oh)) ? _oh : null;
    const par = (product.par_level != null && product.par_level !== '') ? product.par_level : null;
    return this.lineRowHTML(product, d.qty !== '' ? d.qty : 0, onHand, par);
  },
  _restoreDrafts() {
    // Custom order panel.
    if (this._customDraft && this._customDraft.vendor) {
      const panel = this.container.querySelector('.os-custom');
      if (panel) {
        const sel = panel.querySelector('.os-co-vendor');
        if (sel) sel.value = this._customDraft.vendor;
        panel.dataset.vendor = this._customDraft.vendor;
        const body = panel.querySelector('.os-co-body');
        if (body) body.style.display = '';
        const actions = this.container.querySelector('.os-co-actions');
        if (actions) actions.style.display = 'flex';
        const tbody = panel.querySelector('.os-lines-tbody');
        if (tbody) {
          const lines = this._customDraft.lines || [];
          const ids = lines.map(d => d.product_id).filter(Boolean);
          tbody.innerHTML = lines.length
            ? lines.map(d => this._restoreLineHTML(this._customDraft.vendor, d, ids)).join('')
            : this.blankLineRowHTML(this._customDraft.vendor, []);
        }
      }
    }
    // Suggested vendor cards (skip the custom panel + any edit-order card).
    if (this._cardDrafts) {
      this.container.querySelectorAll('.os-vcard').forEach(card => {
        if (card.classList.contains('os-custom') || card.dataset.orderId) return;
        const vendor = card.dataset.vendor;
        const draft = vendor && this._cardDrafts[vendor];
        if (!draft) return;
        const tbody = card.querySelector('.os-lines-tbody');
        if (!tbody) return;
        const ids = draft.map(d => d.product_id).filter(Boolean);
        tbody.innerHTML = draft.map(d => this._restoreLineHTML(vendor, d, ids)).join('');
      });
    }
  },

  async createOrder(vendor) {
    const card = this.container.querySelector('.os-vcard[data-vendor="' + this.selEsc(vendor) + '"]');
    if (!card) return;
    const actions = this.container.querySelector('.os-create-row[data-vendor="' + this.selEsc(vendor) + '"]');
    const err = actions ? actions.querySelector('.os-verr') : null;
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };

    const lineItems = this.collectLines(card);
    if (lineItems.length === 0) { fail('Set an order quantity above zero first.'); return; }

    // Warn (never block) when the order is under the vendor's minimum.
    const info = this._vendorInfo(vendor);
    if (info && info.min != null) {
      const money = info.unit === '$';
      const measure = money ? lineItems.reduce((t, i) => t + i.extended, 0) : lineItems.reduce((t, i) => t + (parseFloat(i.qty) || 0), 0);
      if (measure < info.min - 0.001) {
        const fmt = x => money ? App.fmtCurrency(x) : (this._qtyStr(x) + ' ' + info.unit);
        const ok = await App.confirm({ title: 'Under the vendor minimum', message: 'This order is ' + fmt(info.min - measure) + ' under ' + vendor + '’s ' + fmt(info.min) + ' minimum. Create it anyway?', confirmText: 'Create Anyway' });
        if (!ok) return;
      }
    }

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
      if (this._cardDrafts) delete this._cardDrafts[vendor];
      this.renderMain();
      this.scrollContentTop();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Create Order'; }
      fail('Could not create the order. Try again.');
    }
  },

  // ── Collect line items from a vendor / edit card's ing-tbl rows ────────────
  collectLines(card) {
    const lineItems = [];
    card.querySelectorAll('.os-line').forEach(line => {
      const inp = line.querySelector('.os-qty');
      const qty = Math.max(0, parseFloat(inp.value) || 0);
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
    return lineItems;
  },

  // ── ⋯ overflow menu on an Already Ordered row ─────────────────────────────
  toggleMenu(id) {
    const menu = this.container.querySelector('.os-omenu[data-id="' + id + '"]');
    if (!menu) return;
    const open = menu.style.display === 'block';
    this.closeAllMenus();
    if (!open) {
      menu.style.display = 'block';
      const closer = (e) => {
        if (e.target.closest('.os-omenu') || e.target.closest('.os-omore')) return;
        this.closeAllMenus();
      };
      this._menuCloser = closer;
      setTimeout(() => document.addEventListener('click', closer, true), 0);
    }
  },
  closeAllMenus() {
    if (!this.container) return;
    this.container.querySelectorAll('.os-omenu').forEach(m => { m.style.display = 'none'; });
    if (this._menuCloser) { document.removeEventListener('click', this._menuCloser, true); this._menuCloser = null; }
  },

  // ── Edit a placed order: pull it back onto the Order Sheet as an editable card
  startEditOrder(id) {
    this.closeAllMenus();
    const order = this.orders().find(o => o.id === id);
    if (!order) return;
    this._editVendor = order.vendor;
    this.renderMain();
    this.scrollContentTop();
  },
  cancelEditOrder() {
    this._editVendor = null;
    this.renderMain();
  },
  // Pure write-back for an edited order: collect the card's ing-tbl lines, write
  // them onto the order record, and persist. The ONE canonical save for an order
  // edit — the Order Sheet's Update button AND Order History's inline editor both
  // come through here (two doors, one save). No render side effects; returns
  // {ok:true} on success, {empty:true} when no valid line, {ok:false} on failure.
  async saveOrderEdit(order, card) {
    if (!order || !card) return { ok: false };
    const lineItems = this.collectLines(card);
    if (lineItems.length === 0) return { ok: false, empty: true };
    // `order` is the LIVE row, so putRecord cannot revert it for us (see App.putRecord). Callers do
    // check the returned ok and say "Could not update the order" — but memory kept the new line
    // quantities and the new TOTAL, so the order read as edited on screen while the server and the
    // vendor still had the old one.
    const undo = App.snapshotRows([order]);
    order.line_items = lineItems;
    order.item_count = lineItems.length;
    order.total = lineItems.reduce((t, i) => t + i.extended, 0);
    order.updated_at = new Date().toISOString();
    const ok = await App.putRecord('ic', 'order', order);
    if (!ok) App.restoreRows(undo);
    return { ok: !!ok };
  },

  async updateOrder(vendor) {
    const card = this.container.querySelector('.os-vcard[data-vendor="' + this.selEsc(vendor) + '"]');
    if (!card) return;
    const actions = this.container.querySelector('.os-create-row[data-vendor="' + this.selEsc(vendor) + '"]');
    const err = actions ? actions.querySelector('.os-verr') : null;
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const order = this.orders().find(o => o.id === card.dataset.orderId);
    if (!order) { fail('Could not find that order.'); return; }

    const btn = actions ? actions.querySelector('.os-update') : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const res = await this.saveOrderEdit(order, card);
    if (res.empty) { if (btn) { btn.disabled = false; btn.textContent = 'Update Order'; } fail('Set an order quantity above zero first.'); return; }
    if (res.ok) {
      this._editVendor = null;
      this.renderMain();
      this.scrollContentTop();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Update Order'; }
      fail('Could not update the order. Try again.');
    }
  },

  // ── Cancel a placed order: remove it; the vendor returns to the Order Sheet ─
  async cancelOrder(id) {
    this.closeAllMenus();
    const order = this.orders().find(o => o.id === id);
    if (!order) return;
    const ok = await App.confirm({
      title: 'Cancel this order?',
      message: 'This removes the ' + (order.vendor || '') + ' order'
        + (order.total ? ' for ' + App.fmtCurrency(order.total) : '')
        + '. Those items return to your Order Sheet so you can reorder. This cannot be undone.',
      confirmText: 'Cancel Order',
      cancelText: 'Keep Order',
      danger: true
    });
    if (!ok) return;
    if (this._editVendor === order.vendor) this._editVendor = null;
    await App.removeRecord('ic', 'order', id);
    this.renderMain();
  }
};
