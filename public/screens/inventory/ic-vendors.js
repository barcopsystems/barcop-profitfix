'use strict';

/* ── Inventory Control — Vendors (ic_vendors) ─────────────────────────────────
   Distributor / supplier contacts and terms. Products in ic_products reference
   a vendor by name. Vendor pricing auto-feeds the Vendor Tracker in Profit Recovery.
   Stored in App.inventoryData (ic_data table).

   Landing-form pattern: the add form (all vendor fields on one row + notes, one
   Save) lives on the landing above the vendor list. Editing a vendor opens its
   own page (not a popup — it lists the products + recent price changes for the
   vendor). Return to the list via the sidebar. */

S.InventoryVendors = {
  editId: null,
  _pendingDelId: null,
  entryMode: 'manual',     // default to manual entry (Enter Manually first); 'import' = bulk vendor-list upload
  TERMS: ['', 'COD', 'Net 7', 'Net 15', 'Net 30', 'Net 60'],
  // Built-in order-minimum units. Editable via the "| Edit" list so an operator can
  // add any unit their distributor uses; '$' is the money option (dollar total).
  MIN_UNITS: ['$', 'cases', 'units', 'bottles', 'kegs', 'lbs'],

  vendors() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_vendors)) App.inventoryData.ic_vendors = [];
    return App.inventoryData.ic_vendors;
  },
  vendorById(id) { return this.vendors().find(v => v.id === id); },
  products() { return (App.inventoryData && App.inventoryData.ic_products) || []; },
  vendorProducts(name) { return this.products().filter(p => p.vendor === name); },

  // Human size for a product (container-size label for pourables/beer, unit type
  // for food/misc), matching the Products list.
  sizeLabel(p) {
    if (!p) return '-';
    if (p.category === 'Food' || p.category === 'Misc') return p.unit_type || '-';
    const SIZES = (window.S && S.InventoryProducts && S.InventoryProducts.SIZES) || [];
    const sz = SIZES.find(s => s.oz === p.container_size_oz);
    if (sz) return sz.l;
    return p.container_size_oz != null ? p.container_size_oz + ' oz' : '-';
  },

  // ── Entry ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    this.editId = null;
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Vendors Work', [
      { p: ['Vendors are the distributors and suppliers you order from. Set each one up here with a rep, contact info, and payment terms. Products link to a vendor by name, so once a vendor exists you can set it as the Primary Vendor on the products it delivers.'] },
      { h: 'Add A Vendor', p: ['Fill in the vendor name and whatever you have: rep, phone, email, account number, payment terms. Only the name is required. Save and the vendor is ready to attach to products.'] },
      { h: 'Delivery Days Set Your Pars', p: ['Tap the Delivery Days chips for the days this vendor delivers, or Pickup if you go get it yourself. This is not just a note: Dynamic Pars reads these days to size a tighter reorder par for everything you buy from this vendor, so a vendor who comes twice a week gives a smaller, sharper par than a once-a-week one. Leave them blank and those products fall back to your Default Delivery Cycle. Using the chips instead of typing means the days are always read correctly.'] },
      { h: 'Order Minimums And Fees', p: ['Set the Order Minimum and pick its unit: the dollar sign for a dollar minimum, or cases, kegs, or any unit you add with Edit for a count minimum. Add a delivery fee and a free-delivery-over amount if the vendor has them. On the Order Sheet, each vendor card shows your running order against that minimum and warns when it is short, so you can add more of that vendor’s items and clear the bar in one delivery instead of two. You are always warned, never blocked, so you can still place a short order when you mean to.'] },
      { h: 'Upload A Vendor List', p: ['Already have your vendors in a spreadsheet or a distributor list? Switch the Add a Vendor card to Import File and drop in a CSV or Excel file. The first row is your column headers, one vendor per row. Only the vendor name is required; rep, phone, email, delivery days, terms, account number, order minimum, delivery fee, and free-delivery-over all come in too if your file has them. Bar Cop shows the columns it found, auto-matched, with a preview so you can confirm before importing. A name already on your list is skipped so you never get a duplicate.'] },
      { h: 'Vendors From Your Products', p: ['When you add or import products, a vendor name on a product that is not on your list yet shows up under Set Up From Your Products, along with how many products use it. Tap Set Up to open the add form with that name already filled in, add the rep, terms, and contact details, and Save. The vendor moves into your list and every product already pointing at that name is connected automatically, so you never have to relink anything. If a name is a typo or a vendor you do not actually order from, tap Delete to clear it off those products and drop it from the list.'] },
      { h: 'Edit A Vendor', p: ['Open a vendor to update its details and see two things at a glance: every product you buy from them, and the most recent cost changes on those products. Rename a vendor and every product pointing at the old name follows automatically.'] },
      { h: 'Pricing Feeds Profit Recovery', p: ['Each time you apply a cost change in Receive Delivery, Bar Cop logs it against the vendor. That same history feeds the Vendor Tracker in Profit Recovery, so a vendor quietly raising prices shows up before it eats your margin.'] }
    ]);
  },

  // ── Shared form: all fields on one row + notes. Used by add and edit. ───────
  // Delivery-day chips (tap on/off, same look as the Staff Roster days-off chips).
  // Stored back as a clean "Mon, Thu" string so the par-cycle parser is reliable.
  DAY_NAMES: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  _chipOn:  'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;',
  _chipOff: 'background:transparent;border:1px solid var(--b1);color:var(--t2);',
  deliveryDayChipsHTML(v) {
    const dd = String(v?.delivery_days || '');
    const pickup = /pickup/i.test(dd);
    const on = dn => !pickup && dd.toLowerCase().includes(dn.toLowerCase());
    const chip = (cls, attr, label, isOn) => '<button type="button" class="' + cls + ' btn btn-sm" ' + attr
      + ' data-on="' + (isOn ? '1' : '0') + '" style="' + (isOn ? this._chipOn : this._chipOff) + '">' + label + '</button>';
    return '<div style="flex:1 1 100%;min-width:0;">'
      + '<label>Delivery Days</label>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">'
      +   this.DAY_NAMES.map(dn => chip('iv-day-chip', 'data-day="' + dn + '"', dn, on(dn))).join('')
      +   chip('iv-pickup-chip', '', 'Pickup', pickup)
      + '</div></div>';
  },
  // Read the day chips back into a "Mon, Thu" string (or "Pickup", or "").
  collectDeliveryDays() {
    if (document.querySelector('.iv-pickup-chip[data-on="1"]')) return 'Pickup';
    return [...document.querySelectorAll('.iv-day-chip[data-on="1"]')].map(c => c.dataset.day).join(', ');
  },
  // Wire the delivery-day chips: tap to toggle; a day and Pickup are mutually
  // exclusive (a scheduled delivery or a pickup vendor, never both).
  _setChip(chip, on) {
    chip.dataset.on = on ? '1' : '0';
    chip.style.background  = on ? 'var(--sel-active-bg)' : 'transparent';
    chip.style.borderColor = on ? 'var(--gold-tint-bord)' : 'var(--b1)';
    chip.style.color       = on ? 'var(--t1)' : 'var(--t2)';
    chip.style.fontWeight  = on ? '700' : '';
  },
  wireDeliveryChips(root) {
    root = root || document;
    root.querySelectorAll('.iv-day-chip').forEach(chip => chip.addEventListener('click', () => {
      const turningOn = chip.dataset.on !== '1';
      this._setChip(chip, turningOn);
      const pk = root.querySelector('.iv-pickup-chip');
      if (turningOn && pk) this._setChip(pk, false);
    }));
    const pk = root.querySelector('.iv-pickup-chip');
    if (pk) pk.addEventListener('click', () => {
      const turningOn = pk.dataset.on !== '1';
      this._setChip(pk, turningOn);
      if (turningOn) root.querySelectorAll('.iv-day-chip').forEach(c => this._setChip(c, false));
    });
  },
  formFieldsHTML(v) {
    const minUnit = (v && v.order_minimum_unit) || '$';
    const numVal = x => (x != null && x !== '' ? x : '');
    return '<div class="form-row" style="gap:12px;">'
      + '<div class="f" style="flex:1.7 1 160px;"><label>Vendor Name</label><input type="text" id="iv-name" value="' + esc(v?.name || '') + '" placeholder="Republic National"/></div>'
      + '<div class="f" style="flex:1 1 110px;"><label>Rep Name</label><input type="text" id="iv-rep" value="' + esc(v?.rep || '') + '" placeholder="Sales rep"/></div>'
      + '<div class="f" style="flex:1 1 110px;"><label>Phone</label><input type="text" id="iv-phone" value="' + esc(v?.phone || '') + '" placeholder="(555) 123-4567"/></div>'
      + '<div class="f" style="flex:1 1 110px;"><label>Email</label><input type="email" id="iv-email" value="' + esc(v?.email || '') + '" placeholder="rep@distributor.com"/></div>'
      + '<div class="f" style="flex:1 1 110px;"><label>Terms' + App.manageListLink('payment_term') + '</label>' + App.customSelect({ id: 'iv-terms', key: 'payment_term', builtin: this.TERMS.filter(t => t), selected: (v ? v.payment_terms : ''), blank: true, blankLabel: 'Select terms...' }) + '</div>'
      + '<div class="f" style="flex:1 1 110px;"><label>Account #</label><input type="text" id="iv-account" value="' + esc(v?.account_number || '') + '" placeholder="Account #"/></div>'
      + '</div>'
      // Divider between contact fields and the ordering details.
      + '<div style="border-top:1px solid var(--b2);margin:16px 0 0;"></div>'
      // Ordering economics: minimum (+ any unit), delivery fee, free-delivery threshold.
      + '<div class="form-row" style="gap:12px;margin-top:16px;align-items:flex-end;">'
      +   '<div class="f" style="flex:0 0 130px;"><label>Order Minimum</label><input type="number" id="iv-min" min="0" step="1" value="' + numVal(v?.order_minimum) + '" placeholder="0"/></div>'
      +   '<div class="f" style="flex:0 0 120px;"><label>Unit' + App.manageListLink('order_min_unit') + '</label>' + App.customSelect({ id: 'iv-min-unit', key: 'order_min_unit', builtin: this.MIN_UNITS, selected: minUnit }) + '</div>'
      +   '<div class="f" style="flex:0 0 130px;"><label>Delivery Fee</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="iv-fee" min="0" step="0.01" value="' + numVal(v?.delivery_fee) + '" placeholder="0.00"/></div></div>'
      +   '<div class="f" style="flex:0 0 160px;"><label>Free Delivery Over</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="iv-free" min="0" step="1" value="' + numVal(v?.free_delivery_over) + '" placeholder="0"/></div></div>'
      + '</div>'
      // Delivery Days (chip picker) — last row.
      + '<div class="form-row" style="gap:12px;margin-top:18px;">' + this.deliveryDayChipsHTML(v) + '</div>'
      + App.noteField({ id: 'iv-notes', value: v?.notes, mt: 18 });
  },

  // ── Landing: add form on top, vendor list below ────────────────────────────
  renderList() {
    this.actions.innerHTML = '';
    this.editId = null;
    // Name-sorted, matching every other vendor surface (ic-product-setup, ic-order-sheet).
    // Unsorted, this list inherited row order (newest-first) and rendered upside-down.
    const vendors = this.vendors().slice()
      .sort((a, b) => String((a && a.name) || '').localeCompare(String((b && b.name) || '')));

    let listSection;
    if (vendors.length === 0) {
      listSection = '<div class="card" style="margin-top:18px;padding:14px 20px;"><div style="font-size:12px;color:var(--t3);line-height:1.6;">No vendors yet. Add one above. '
        + 'Products link to a vendor, and vendor pricing feeds the Vendor Tracker in Profit Recovery.</div></div>';
    } else {
      const rows = vendors.map(v => {
        const n = this.vendorProducts(v.name).length;
        return '<tr>'
          + '<td><button class="iv-open" data-id="' + v.id + '" '
          + 'style="padding:0;border:none;background:none;color:var(--t1);font-weight:700;font-size:13px;cursor:pointer;">'
          + esc(v.name) + '</button></td>'
          + '<td>' + esc(v.rep || '-') + '</td>'
          + '<td>' + esc(v.phone || '-') + '</td>'
          + '<td>' + esc(v.payment_terms || '-') + '</td>'
          + '<td>' + n + ' product' + (n === 1 ? '' : 's') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm iv-edit" data-id="' + v.id + '">Edit</button>'
          + '<button class="btn btn-ghost btn-sm iv-del" data-id="' + v.id + '" style="color:var(--red);">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      listSection = '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
        + '<th>Vendor</th><th>Rep</th><th>Phone</th><th>Terms</th><th>Products</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">' + this.addFormCard() + this.pendingSectionHTML() + listSection + '</div>';
    this.wireList();
  },

  // Vendor names that sit on products but have no vendor record yet. Products
  // reference a vendor by name, so a name on a product with no matching record is
  // a "pending" vendor the operator can finish setting up. Grouped by name with a
  // product count, most-used first. ([[two-doors-same-data]]: the name is the
  // canonical identity; Set Up promotes it to a full record, no relinking needed.)
  pendingVendors() {
    const have = new Set(this.vendors().map(v => (v.name || '').trim().toLowerCase()));
    const counts = {};
    this.products().forEach(p => {
      const name = (p.vendor || '').trim();
      if (!name || have.has(name.toLowerCase())) return;
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.keys(counts).map(name => ({ name, count: counts[name] }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  },

  pendingSectionHTML() {
    const pending = this.pendingVendors();
    if (!pending.length) return '';
    const rows = pending.map(pv => '<tr>'
      + '<td><div class="val">' + esc(pv.name) + '</div></td>'
      + '<td>' + pv.count + ' product' + (pv.count === 1 ? '' : 's') + '</td>'
      + '<td><div class="row-actions">'
        + '<button class="btn btn-ghost btn-sm iv-setup" data-name="' + esc(pv.name) + '">Set Up</button>'
        + '<button class="btn btn-ghost btn-sm iv-pdel" data-name="' + esc(pv.name) + '" style="color:var(--red);">Delete</button>'
      + '</div></td>'
      + '</tr>').join('');
    return '<div class="sh" style="margin-top:24px;">Set Up From Your Products</div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Vendor</th><th>On Products</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  },

  // A segmented toggle swaps the card body between typing one vendor and dropping
  // a whole vendor list, so the operator picks a lane instead of facing two boxes
  // ([[unified-import-pattern]]). The import lane mounts the shared CSVMapper.
  addFormCard() {
    const segBtn = (mode, label) => {
      const on = this.entryMode === mode;
      return '<button type="button" class="btn btn-sm iv-mode" data-mode="' + mode + '" style="'
        + (on ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    };
    let modeBody, actionRow;
    if (this.entryMode === 'import') {
      modeBody = '<div id="iv-csv"></div><div id="iv-imp-result"></div>';
      // Empty until a file is dropped; CSVMapper then renders its Import / Cancel
      // row here (below the card) so there's no gap beforehand.
      actionRow = '<div id="iv-imp-actions" class="no-print" data-collapse-group="ic-vendors" style="margin:16px 0 24px;"></div>';
    } else {
      modeBody = this.formFieldsHTML(null);
      actionRow = '<div class="no-print" data-collapse-group="ic-vendors" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary" id="iv-save">Save Vendor</button>'
        + '<button class="btn btn-ghost" id="iv-startover">Start Over</button>'
        + '<span id="iv-err" style="color:var(--red);font-size:12px;display:none;"></span>'
      + '</div>';
    }
    return '<div class="card form-card">'
      + App.collapsibleCardTitle('ic-vendors', 'Add a Vendor')
      + '<div class="collapse-body">'
      + '<div class="seg-toggle">' + segBtn('manual', 'Enter Manually') + segBtn('import', 'Import File') + '</div>'
      + modeBody
      + '</div></div>'
      + actionRow;
  },

  wireList() {
    this.container.onclick = ev => {
      const mode = ev.target.closest('.iv-mode');
      if (mode) { this.entryMode = mode.dataset.mode; this.renderList(); return; }
      const head = ev.target.closest('.card-collapse-head');
      if (head) { App.toggleCollapse(head); return; }
      const save  = ev.target.closest('#iv-save');
      const reset = ev.target.closest('#iv-startover');
      const open  = ev.target.closest('.iv-open');
      const edit  = ev.target.closest('.iv-edit');
      const del   = ev.target.closest('.iv-del');
      const setup = ev.target.closest('.iv-setup');
      const pdel  = ev.target.closest('.iv-pdel');
      if (setup)      this.startSetup(setup.dataset.name);
      else if (pdel)  this.deletePending(pdel.dataset.name);
      else if (save)  this.saveVendor();
      else if (reset) this.startOver();
      else if (open)  this.openEdit(open.dataset.id);
      else if (edit)  this.openEdit(edit.dataset.id);
      else if (del)   this.confirmDel(del.dataset.id);
    };
    App.applyCollapsed(this.container);
    App.wireCustomSelects(this.container);
    this.wireDeliveryChips(this.container);
    if (this.entryMode === 'import') { this.mountImporter(); return; }
    // Manual mode: keep a half-typed vendor alive across re-renders and across
    // leaving the screen and coming back (in-memory; clears on Save, Start Over,
    // or a full reload). Restore the draft, then capture it on every edit.
    if (this._draft) App.restoreDraft(this.container, this._draft);
    const body = this.container.querySelector('.collapse-body');
    if (body) {
      const cap = () => { this._draft = App.captureDraft(this.container); };
      body.addEventListener('input', cap);
      body.addEventListener('change', cap);
    }
    // Coming from a "Set Up" click: prefill the name into the add form.
    if (this._setupName) {
      const nameEl = document.getElementById('iv-name');
      if (nameEl) nameEl.value = this._setupName;
      this._draft = App.captureDraft(this.container);
      document.getElementById('iv-rep')?.focus();
      this._setupName = null;
    }
  },

  // Set Up a pending product-vendor: open the manual add form with its name
  // prefilled (force the card expanded), so the operator just adds the details.
  startSetup(name) {
    this.entryMode = 'manual';
    this._setupName = name;
    this._draft = null;
    try { localStorage.removeItem(App._collapseKey('ic-vendors')); } catch (e) {}
    this.renderList();
  },

  // Start Over on the add form: empty every field (and any prefilled Set Up name)
  // back to a clean form, the card stays open.
  startOver() {
    this._setupName = null;
    this._draft = null;
    ['iv-name', 'iv-rep', 'iv-phone', 'iv-email', 'iv-account', 'iv-notes', 'iv-min', 'iv-fee', 'iv-free'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const terms = document.getElementById('iv-terms'); if (terms) terms.value = '';
    document.querySelectorAll('.iv-day-chip, .iv-pickup-chip').forEach(c => this._setChip(c, false));
    const err = document.getElementById('iv-err'); if (err) { err.style.display = 'none'; err.textContent = ''; }
    document.getElementById('iv-name')?.focus();
  },

  // Remove a pending product-vendor: it exists only because products carry the
  // name, so removing it clears the vendor off those products. The products stay;
  // only the vendor link is cleared, which drops the pending row.
  async deletePending(name) {
    const matches = this.products().filter(p => (p.vendor || '').trim() === name);
    const n = matches.length;
    const ok = await App.confirm({
      title: 'Remove this vendor from your products?',
      message: '"' + name + '" is on ' + n + ' product' + (n === 1 ? '' : 's') + '. Removing it clears the vendor on '
        + (n === 1 ? 'that product' : 'those products') + '. The product' + (n === 1 ? '' : 's')
        + ' stay; only the vendor link is cleared.',
      confirmText: 'Remove Vendor',
      danger: true
    });
    if (!ok) return;
    // Snapshot before the in-place clear: a bulk write cannot revert itself, so a failed write
    // would show the vendor gone from every product while the server still has it.
    const undo = App.snapshotRows(matches);
    matches.forEach(p => { p.vendor = ''; });
    // Row-per-record: only the affected products change — write them as rows.
    if (!(await App.putRecordsBulk('ic', 'product', matches))) App.restoreRows(undo);
    this.renderList();
  },

  // ── CSV / Excel vendor-list import (drag-drop + column mapping) ──────────────
  mountImporter() {
    const el = document.getElementById('iv-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your vendor list here',
      dropSub: 'Needs a column for vendor name. Rep, phone, email, delivery days, terms, account number, order minimum, delivery fee, and free-delivery-over come in too if your file has them.',
      actionsEl: '#iv-imp-actions',
      fields: [
        { key: 'name',           label: 'Vendor Name',   required: true,  match: ['vendor', 'vendor name', 'name', 'supplier', 'distributor', 'company', 'company name', 'supplier name', 'distributor name', 'purveyor', 'business name'] },
        { key: 'rep',            label: 'Rep Name',      required: false, match: ['rep', 'rep name', 'sales rep', 'salesperson', 'contact', 'contact name', 'representative', 'account rep', 'sales representative', 'contact person'] },
        { key: 'phone',          label: 'Phone',         required: false, match: ['phone', 'phone number', 'telephone', 'tel', 'contact phone', 'mobile', 'cell', 'rep phone', 'office phone'] },
        { key: 'email',          label: 'Email',         required: false, match: ['email', 'e-mail', 'email address', 'e mail', 'contact email', 'rep email'] },
        /* ⚠ THE BARE `'delivery'` STOLE THE DELIVERY FEE COLUMN. Fields are claimed in DECLARED
           order and this one sits four ahead of `delivery_fee`, so on a header row of
           `Order Minimum ($) / Delivery Fee ($) / Free Shipping Over ($)` it word-matched
           "Delivery Fee ($)" in pass 2 and took it — the real $25 fee landed in this TEXT field,
           `delivery_fee` then fell through to `'shipping'` and grabbed "Free Shipping Over ($)", and
           the Order Sheet printed a **$400 delivery fee** on every order. Exact headers already win
           in pass 1, so removing the loose token costs nothing and closes both mis-binds. */
        /* ⚠ `'delivery'` IS BACK, AND SO IS `'shipping'` BELOW. Deleting them stopped the mis-bind
           (delivery_days was word-matching "Delivery Fee ($)") but ALSO killed their pass-1 EXACT
           match, so a hand-kept sheet with a one-word "Delivery" column bound NOTHING — and no
           delivery days means `perWeek` 0, which silently reverts every product from that vendor to
           the Default Delivery Cycle for its par. Both tokens are in `EXACT_ONLY` in csv-mapper.js
           now, which is the mechanism built for exactly this: good as a whole header, never allowed
           to hunt inside a longer one. */
        { key: 'delivery_days',  label: 'Delivery Days', required: false, match: ['delivery days', 'delivery day', 'delivery schedule', 'delivery info', 'delivery window', 'ship days', 'order days', 'days', 'delivery'] },
        { key: 'payment_terms',  label: 'Terms',         required: false, match: ['terms', 'payment terms', 'net terms', 'payment', 'credit terms', 'pay terms'] },
        { key: 'account_number', label: 'Account #',     required: false, match: ['account', 'account number', 'account #', 'acct', 'acct #', 'account no', 'customer number', 'customer #', 'acct number', 'account id'] },
        { key: 'order_minimum',  label: 'Order Minimum', required: false, match: ['order minimum', 'minimum', 'min order', 'order min', 'minimum order', 'min purchase', 'minimum purchase', 'minimum order amount'] },
        // `'shipping'` last, and exact-only via EXACT_ONLY — see the note on delivery_days above.
        { key: 'delivery_fee',   label: 'Delivery Fee',  required: false, match: ['delivery fee', 'freight', 'delivery charge', 'shipping fee', 'shipping cost', 'shipping charge', 'shipping charges', 'shipping amount', 'freight charge', 'delivery cost', 'shipping'] },
        { key: 'free_delivery_over', label: 'Free Delivery Over', required: false, match: ['free delivery over', 'free delivery', 'free shipping over', 'free freight over', 'free delivery threshold', 'free shipping', 'free delivery minimum'] }
      ],
      confirmLabel: 'Import',
      onComplete: rows => this.importVendors(rows)
    });
  },

  // Map a free-text terms cell onto one of the known terms, else leave it blank
  // (the edit form's Terms dropdown only offers the known set, so an unrecognized
  // value would be silently unselectable).
  /* ⚠ MATCHES THE OPERATOR'S OWN TERMS LIST TOO, not just the builtins. The Terms field carries a
     "| Edit" list manager that invites them to add their distributor's real terms — and then the
     import threw those values away in silence: `Net 45`, `Due on Receipt` and `2/10 Net 30` all
     landed BLANK even after being added. `hub-operating-expenses._matchCat` exists for exactly this
     failure and already checks `App.listOptions`; this is the same fix.
     ⚠ Punctuation is flattened as well as whitespace, so `Net-30` and `Net 30` are one term. */
  normTerms(raw) {
    const s = (raw || '').trim();
    if (!s) return '';
    const flat = x => String(x).toLowerCase().replace(/[\s\-_.]+/g, '');
    const own = (App.listOptions ? App.listOptions('payment_term') : []) || [];
    const hit = this.TERMS.concat(own).find(t => t && flat(t) === flat(s));
    return hit || '';
  },

  /* ⚠ DELIVERY DAYS MUST COME IN AS CHIP-COMPATIBLE DAY NAMES. The field is stored as a "Mon, Thu"
     string and read back two ways that both broke on free text:
       · `ic-par-suggestions.deliveryDaysPerWeek` COUNTS substring hits, so "Mon-Fri" scored **2**,
         not 5 — and at 20 units/week usage that turned a Suggested Par of 5 into **12**, 2.4x the
         stock the screen tells them to carry, plus every par-value dollar figure built on it;
       · `collectDeliveryDays` reads the CHIPS, which cannot represent "M/W/F" or "Daily" — so the
         first time the operator opened that vendor and pressed Update, the value was WIPED.
     The import is the only door that can put an unrepresentable string here (the form is chips-only).
     A range is expanded, a list is split, "daily" is all seven, and anything unreadable comes back
     empty so the door can COUNT and report it rather than storing something no screen can use. */
  _normDeliveryDays(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (/pick\s*-?\s*up|will\s*call/i.test(s)) return 'Pickup';
    const D = this.DAY_NAMES;                                   // Mon..Sun, index 0..6
    /* Returns a day index, -1 for "not a day", or -2 for AMBIGUOUS. A single "T" is Tuesday or
       Thursday and a single "S" is Saturday or Sunday, and there is nothing in the cell to settle
       it — so an M/T/W sheet is refused and REPORTED rather than half-guessed. M, W and F have only
       one reading, which is what makes the common "M/W/F" shorthand safe to accept. */
    const idxOf = tok => {
      const t = tok.toLowerCase().replace(/[^a-z]/g, '');
      if (!t) return -1;
      if (t.length === 1) {
        const one = { m: 0, w: 2, f: 4 };
        if (one[t] != null) return one[t];
        return (t === 't' || t === 's') ? -2 : -1;
      }
      // 'thu' must beat 'tue' on "thur"/"thurs"; test the 3-letter stem after the long forms.
      const map = { sunday: 6, monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5 };
      if (map[t] != null) return map[t];
      const stem = t.slice(0, 3);
      const s3 = { sun: 6, mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5 };
      return s3[stem] != null ? s3[stem] : -1;
    };
    if (/^\s*(daily|every\s*day|7\s*days?)\s*$/i.test(s)) return D.join(', ');
    const on = new Set();
    let ambiguous = false;
    /* ⚠⚠ EVERY RANGE, THEN EVERYTHING LEFT OVER. The first version matched ONE range and gated the
       token pass behind `if (!on.size)`, so the rest of the cell was silently discarded:
       "Mon-Fri, Sat" lost Saturday, "Mon-Wed, Fri" lost Friday, "Mon-Wed & Fri-Sat" lost two days.
       That is how a distributor actually writes a schedule with an add-on day, and it was INVISIBLE
       — `badDays` only counts a cell that comes back completely empty, so a file with four mangled
       cells printed "Imported 4 vendors." with no note. `deliveryDaysPerWeek` drives the par cycle,
       so "Mon-Wed, Fri" suggested 9 units against a true 7 and "Mon.-Fri." suggested 26 against 6.
       ⚠ `[.\s]*` around the separator, or "Mon.-Fri." never matches at all and collapses to "Mon". */
    /* ⚠ SPLIT INTO SEGMENTS FIRST, THEN DECIDE RANGE-OR-LIST PER SEGMENT. Deciding globally on a
       dash count got "Mon-Wed & Fri-Sat" wrong (two ranges, read as a two-item list → "Mon, Fri")
       and "M-W-F" wrong the other way (a dash-delimited LIST, read as a range). Segmenting settles
       both: a segment with exactly ONE dash between two day tokens is a range; anything else is a
       list of tokens. */
    const addRange = (a, b) => { for (let i = a; ; i = (i + 1) % 7) { on.add(i); if (i === b) break; } };
    s.split(/[,;&|]+|\band\b|\/(?=\s*[a-z]{3,})/i).forEach(rawSeg => {
      /* ⚠ STRIP DELIVERY HOURS BEFORE COUNTING DASHES. A cell reading "Mon-Fri 8-5" carries a
         SECOND dash that has nothing to do with days, and the per-segment dash count then treated
         the whole thing as a token list — so only the two endpoints survived: **"Mon, Fri", 2
         delivery days instead of 5**, which doubles the suggested par. And it was silent, because
         `badDays` only fires on a cell that comes back empty. A delivery-days column carrying
         hours is ordinary on a vendor sheet. */
      // ⚠ "…-close" is a time too. A bar writes its receiving window as "Mon-Fri 4-close", and the
      // digit-dash-DIGIT strip left that second dash behind: "Mon, Fri", 2 delivery days not 5,
      // which doubles the suggested par. Silent, because badDays only counts an EMPTY result.
      const seg = rawSeg.replace(/\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–—]\s*(?:close|closing|\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi, ' ');
      const dashes = (seg.match(/-|–|—/g) || []).length;
      const r = (dashes === 1 || /\b(to|thru|through)\b/i.test(seg))
        ? seg.match(/([a-z]+)[.\s]*(?:-|–|—|to|thru|through)[.\s]*([a-z]+)/i) : null;
      if (r) {
        const a = idxOf(r[1]), b = idxOf(r[2]);
        if (a === -2 || b === -2) { ambiguous = true; return; }
        if (a > -1 && b > -1) { addRange(a, b); return; }
      }
      seg.split(/[/+.\s-]+/).forEach(tok => {
        const i = idxOf(tok);
        if (i === -2) ambiguous = true;
        else if (i > -1) on.add(i);
      });
    });
    /* A cell mixing readable days with an ambiguous single letter is refused WHOLE. Keeping the
       readable half would store a schedule quietly missing a day, and the par count reads it. */
    if (ambiguous) return '';
    if (!on.size) return '';
    return D.filter((_, i) => on.has(i)).join(', ');
  },

  /* An order minimum is not always money. The manual form and the seed both offer cases / kegs /
     lbs, and the import hardcoded `'$'` — so "5 cases" stored as FIVE DOLLARS and the Order Sheet
     measured a case minimum against a dollar total, always reading "Meets the $5.00 minimum". */
  _minUnitOf(raw, fallback) {
    const s = String(raw || '').trim().toLowerCase();
    /* ⚠ THE WHOLE CELL MUST BE "<number> <unit>" AND NOTHING ELSE. Hunting for a unit WORD anywhere
       in the cell read one out of ordinary money text: "$35 case charge" stored the unit `cases`,
       "$1,000 per unit" stored `units`, and "$250 or 5 cases" stored **2,505 cases** (App.parseNum
       concatenates the digit runs, which is its own reason to distrust a cell shaped like that).
       The Order Sheet then measured a DOLLAR minimum against a unit count. A currency marker
       settles it outright: if the cell says $, it is money. */
    if (!s || /[$€£]/.test(s)) return fallback || '$';
    /* ⚠ THE UNIT MUST FOLLOW THE NUMBER; WHAT COMES AFTER IT DOES NOT MATTER. Anchoring the whole
       cell (`...([a-z]+)$`) was one word too tight and reopened the very bug this function exists
       to close: "5 cases min", "2 keg minimum", "10 cases per delivery" — the way a minimum is
       actually written — all fell back to `$`, and the Order Sheet printed "Meets the $5.00
       minimum" in green on every order. */
    const m = s.match(/^[\d.,]+\s*([a-z]+)\b/);
    if (!m) return fallback || '$';
    const own = (App.listOptions ? App.listOptions('order_min_unit') : []) || [];
    const word = m[1].replace(/s$/, '');
    const hit = this.MIN_UNITS.concat(own).find(u => u && u !== '$'
      && String(u).toLowerCase().replace(/s$/, '') === word);
    return hit || fallback || '$';
  },

  async importVendors(rows) {
    const existing = this.vendors();
    /* ⚠ THE SEED MUST BE FLATTENED THE SAME WAY THE INCOMING KEY IS, or the dedup only works for
       punctuation-free names. It was seeded RAW while the incoming key stripped `[\s.,]`, so
       "ben e. keith" never equalled "ben e keith" — and a re-drop, which is the exact case the
       dedup was added for, minted a second "Ben E. Keith" and a second "Glazer's, Inc." Distributor
       names carry periods and commas as a rule. Products link to vendors BY NAME and `_vendorInfo`
       takes the FIRST match, so once the operator edits the second copy the Order Sheet keeps
       quoting the stale first one. */
    const vkey = n => String(n || '').trim().toLowerCase().replace(/[\s.,]+/g, ' ').trim();
    // ⚠ `.map(v => vkey(v.name))`, not `.map(vkey)` — `existing` holds vendor OBJECTS, so passing
    // them straight in stringifies every seed key to "[object Object]" and the dedup matches NOTHING.
    const taken = new Set(existing.map(v => vkey(v.name)));
    const toAdd = [];
    let dup = 0, blank = 0, badDays = 0, badTerms = 0;
    rows.forEach(r => {
      const name = (r.name || '').trim();
      if (!name) { blank++; return; }
      // Flatten punctuation and runs of whitespace for the dedup key only — the STORED name keeps
      // the operator's own spelling. `Sysco Foods.` and `Sysco  Foods` are one vendor, and products
      // link to vendors BY NAME, so a near-duplicate record owns nothing and confuses the list.
      const key = vkey(name);
      // Skip a name already on the list (or repeated in the file) so a re-drop
      // never creates duplicate vendors.
      if (taken.has(key)) { dup++; return; }
      taken.add(key);
      /* ⚠ A CELL HOLDING TWO NUMBERS IS REFUSED, not concatenated. `App.parseNum` joins digit runs
         (its own doc says it will not unpick a two-number cell), so "$250 or 5 cases" stored a
         **$2,505.00** minimum against a real $250 one, and "5 cases ($250)" stored $5,250.00.
         Refusing leaves the field blank, which the Order Sheet shows as no minimum — visibly
         missing rather than confidently wrong. Same rule `_sizeToOz` uses at the product door. */
      const oneNum = v => ((String(v == null ? '' : v).match(/[\d][\d,]*(?:\.\d+)?/g) || []).length > 1 ? null : v);
      const nonNeg = n => (n == null || n < 0) ? null : n;
      // Report a delivery-day or terms cell the file HAD and Bar Cop could not use. An ABSENT cell
      // is not a problem and must never be counted as one, or every name-and-phone list reads broken.
      const days = this._normDeliveryDays(r.delivery_days);
      if (String(r.delivery_days || '').trim() && !days) badDays++;
      const terms = this.normTerms(r.payment_terms);
      if (String(r.payment_terms || '').trim() && !terms) badTerms++;
      toAdd.push({
        id:             App.uid(),
        name,
        rep:            (r.rep || '').trim(),
        phone:          (r.phone || '').trim(),
        email:          (r.email || '').trim(),
        delivery_days:  days,
        payment_terms:  terms,
        account_number: (r.account_number || '').trim(),
        /* ⚠ App.parseNum, NOT parseFloat. `parseFloat('$1,500')` is NaN — the minimum vanished
           silently — and `parseFloat('2,500')` is **2**, so the Order Sheet printed "Meets the
           $2.00 minimum" on a $60 order against a real $2,500 one, and a `2,500.00` free-delivery
           threshold made every order over two dollars read "Free delivery". Excel's Currency and
           Comma formats emit exactly those strings through `raw:false`. Negatives are refused: a
           fee below zero is not a thing, and `_vendorInfo` gates on `> 0` so it would be lost
           anyway — better to not store it than to store a number no screen will show. */
        order_minimum:      nonNeg(App.parseNum(oneNum(r.order_minimum))),
        order_minimum_unit: this._minUnitOf(r.order_minimum, '$'),
        delivery_fee:       nonNeg(App.parseNum(oneNum(r.delivery_fee))),
        free_delivery_over: nonNeg(App.parseNum(oneNum(r.free_delivery_over))),
        notes:          '',
        imported:       true,
        created_at:     new Date().toISOString()
      });
    });

    /* Every bucket reaches the operator now. `blank` was counted at the top of this function and
       NEVER read again, and the zero-row headline named only duplicates — so a file of 2 known
       vendors and 3 spacer rows said "2 names were already on your list" and accounted for nothing
       else. An absolute claim may only fire when the other buckets are empty. */
    const notes = () => {
      const b = [];
      if (dup) b.push(dup + ' already on your list');
      if (blank) b.push(blank + ' row' + (blank === 1 ? '' : 's') + ' skipped with no vendor name');
      if (badDays) b.push(badDays + ' delivery-day cell' + (badDays === 1 ? '' : 's') + ' could not be read');
      if (badTerms) b.push(badTerms + ' terms value' + (badTerms === 1 ? '' : 's') + ' not on your Terms list');
      return b;
    };
    const result = document.getElementById('iv-imp-result');
    if (!toAdd.length) {
      const n = notes();
      const head = dup && !blank ? 'No new vendors imported. Every name in this file is already on your list.'
        : blank && !dup ? 'No vendors imported. No vendor names were found in the file.'
        : dup || blank ? 'No new vendors imported.'
        : 'No vendors imported. No vendor names were found in the file.';
      if (result) result.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + head + (n.length ? ' (' + n.join(' · ') + ')' : '') + '</div>';
      return;
    }

    this.vendors().push(...toAdd);
    const ok = await App.putRecordsBulk('ic', 'vendor', toAdd);   // row-per-record
    if (!ok) {
      App.inventoryData.ic_vendors = existing.filter(v => !toAdd.includes(v));
      if (result) result.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">Save failed. Try the import again.</div>';
      return;
    }
    // Re-render so the new vendors show in the list below, then drop the summary
    // into the freshly-mounted import result slot (stays in import mode).
    this.renderList();
    const res2 = document.getElementById('iv-imp-result');
    if (res2) res2.innerHTML = '<div style="font-size:13px;color:var(--gold);font-weight:700;margin-top:12px;">'
      + 'Imported ' + toAdd.length + ' vendor' + (toAdd.length === 1 ? '' : 's') + '.'
      + (notes().length ? ' <span style="color:var(--t3);font-weight:400;">(' + notes().join(' · ') + ')</span>' : '')
      + '</div>';
  },

  // ── Edit page (own page; same form + product/price cards; Cancel → landing) ──
  openEdit(id) {
    const v = this.vendorById(id);
    if (!v) { this.renderList(); return; }
    this.editId = id;
    this.actions.innerHTML = '';
    const prods = this.vendorProducts(v.name);
    this.container.innerHTML = '<div class="screen">'
      + this.editCard(v)
      + this.editActionsRow()
      + this.renderProductsCard(prods)
      + this.renderPriceHistoryCard(prods)
      + '</div>';
    this.wireEdit();
    // Jump to the edit form. The app scrolls inside .content (#content-area), not the
    // window, so window.scrollTo alone is a no-op on mobile — reset the real container.
    setTimeout(() => {
      const sc = document.getElementById('content-area');
      if (sc) sc.scrollTop = 0;
      if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
    }, 0);
  },

  editCard(v) {
    return '<div class="card form-card">'
      + '<div class="card-title">Editing ' + esc(v.name) + '</div>'
      + this.formFieldsHTML(v)
      + '</div>';
  },

  // Update Vendor + Cancel below the edit card, bottom-left.
  editActionsRow() {
    return '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="iv-save">Update Vendor</button>'
      + '<button class="btn btn-ghost" id="iv-cancel">Cancel</button>'
      + '<span id="iv-err" style="color:var(--red);font-size:12px;display:none;"></span>'
      + '</div>';
  },

  wireEdit() {
    this.container.onclick = ev => {
      if (ev.target.closest('#iv-cancel')) { this.editId = null; this.renderList(); return; }
      if (ev.target.closest('#iv-save'))   { this.saveVendor(); return; }
    };
    App.wireCustomSelects(this.container);
    this.wireDeliveryChips(this.container);
  },

  renderProductsCard(prods) {
    if (prods.length === 0) {
      return '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
        + '<th>Product</th><th>Size</th><th>Par</th><th>Unit Cost</th>'
        + '</tr></thead><tbody><tr><td colspan="4" style="color:var(--t3);padding:12px 8px;">No products are linked to this vendor yet. Set the Primary Vendor field on a product in the Products screen.</td></tr></tbody></table></div>';
    }
    const rowHtml = p => '<tr><td><div class="val">' + esc(p.name) + '</div>'
      + (p.brand ? '<div style="font-size:10px;color:var(--t3);">' + esc(p.brand) + '</div>' : '') + '</td>'
      + '<td>' + esc(this.sizeLabel(p)) + '</td>'
      + '<td>' + (p.par_level != null && p.par_level !== '' ? esc(p.par_level + ' ' + (App.productUnit(p) || '')) : '<span style="color:var(--t4);">-</span>') + '</td>'
      + '<td>' + (p.unit_cost != null ? App.fmtCurrency(p.unit_cost) : '<span style="color:var(--t4);">-</span>') + '</td></tr>';
    // Group by category like the Count History view: one table per category, the
    // category in the first header, a shared fixed colgroup so columns line up
    // down the page (the Category column drops into the header).
    const ORDER = ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
    const byCat = {};
    prods.forEach(p => { const c = p.category || 'Uncategorized'; (byCat[c] = byCat[c] || []).push(p); });
    const cats = Object.keys(byCat).sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      return ((ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)) || a.localeCompare(b);
    });
    const tables = cats.map(c => {
      const catProds = byCat[c].slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      return '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
        + '<colgroup><col style="width:240px;"/><col/><col/><col/></colgroup>'
        + '<thead><tr><th>' + esc(c) + '</th><th>Size</th><th>Par</th><th>Unit Cost</th></tr></thead>'
        + '<tbody>' + catProds.map(rowHtml).join('') + '</tbody></table></div>';
    }).join('');
    return '<div style="margin-top:24px;">' + tables + '</div>';
  },

  renderPriceHistoryCard(prods) {
    const priceRows = [];
    prods.forEach(p => {
      (p.cost_history || []).forEach(h => {
        priceRows.push({
          date: h.date || h.changed_at || '',
          product: p.name,
          category: p.category || '',
          old_cost: h.old_cost != null ? h.old_cost : (h.prior_cost != null ? h.prior_cost : null),
          new_cost: h.new_cost != null ? h.new_cost : null,
          source:   h.source || ''
        });
      });
    });
    priceRows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const recent = priceRows.slice(0, 5);

    const fmtDelta = (oldC, newC) => {
      if (oldC == null || newC == null) return '-';
      const delta = newC - oldC;
      const pct = oldC > 0 ? (delta / oldC) * 100 : 0;
      const sign = delta > 0 ? '+' : '';
      const cls = delta > 0 ? 'neg' : delta < 0 ? 'pos' : '';
      return '<span class="' + cls + '">' + sign + App.fmtCurrency(delta) + ' (' + sign + pct.toFixed(1) + '%)</span>';
    };
    const fmtDate = str => {
      if (!str) return '-';
      const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
      return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const heading = '<div class="sh" style="margin-top:24px;">Recent Price Changes</div>';
    if (recent.length === 0) {
      return heading + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Date</th><th>Product</th><th>Old Cost</th><th>New Cost</th><th>Change</th>'
        + '</tr></thead><tbody><tr><td colspan="5" style="color:var(--t3);padding:12px 8px;">No price changes recorded yet for this vendor. Bar Cop logs every cost change automatically when you apply price updates in Receive Delivery.</td></tr></tbody></table></div>';
    }
    return heading + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Date</th><th>Product</th><th>Old Cost</th><th>New Cost</th><th>Change</th>'
      + '</tr></thead><tbody>'
      + recent.map(r => '<tr>'
        + '<td>' + fmtDate(r.date) + '</td>'
        + '<td><div class="val">' + esc(r.product) + '</div>'
        + (r.category ? '<div style="font-size:10px;color:var(--t3);">' + esc(r.category) + '</div>' : '') + '</td>'
        + '<td>' + (r.old_cost != null ? App.fmtCurrency(r.old_cost) : '-') + '</td>'
        + '<td>' + (r.new_cost != null ? App.fmtCurrency(r.new_cost) : '-') + '</td>'
        + '<td class="val">' + fmtDelta(r.old_cost, r.new_cost) + '</td>'
        + '</tr>').join('')
      + '</tbody></table></div>';
  },

  async saveVendor() {
    const vendorId = this.editId;
    const name = document.getElementById('iv-name')?.value.trim();
    const err  = document.getElementById('iv-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (!name) { fail('Vendor name required.'); return; }
    const dup = this.vendors().some(v => v.id !== vendorId && v.name.toLowerCase() === name.toLowerCase());
    if (dup) { fail('A vendor with that name already exists.'); return; }

    const numOrNull = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };
    const fields = {
      name,
      rep:            document.getElementById('iv-rep')?.value.trim() || '',
      phone:          document.getElementById('iv-phone')?.value.trim() || '',
      email:          document.getElementById('iv-email')?.value.trim() || '',
      delivery_days:  this.collectDeliveryDays(),
      payment_terms:  document.getElementById('iv-terms')?.value || '',
      account_number: document.getElementById('iv-account')?.value.trim() || '',
      order_minimum:      numOrNull('iv-min'),
      order_minimum_unit: document.getElementById('iv-min-unit')?.value || '$',
      delivery_fee:       numOrNull('iv-fee'),
      free_delivery_over: numOrNull('iv-free'),
      notes:          document.getElementById('iv-notes')?.value.trim() || ''
    };

    let savedId = vendorId;
    const touched = [];   // products whose vendor name changed on a rename (row-per-record)
    const carried = [];   // other stores the rename touched: [{ mod, kind, recs }]
    let renamedFrom = null;   // the name this save is renaming AWAY from (null = no rename)
    let vendorRec = null;
    let vendorUndo = [];   // S164: the vendor record's full pre-edit state, for an exact rollback
    if (vendorId) {
      const v = this.vendorById(vendorId);
      if (v) {
        const old = v.name;
        // ⚠ S164. Object.assign overwrites EVERY field on the live record (terms, account number,
        // order minimum, delivery fee, notes...), and App.putRecord's own slot-revert is a NO-OP
        // here because we hand it the same object already in the list (see the revert note in
        // App.putRecord). So a rejected save left the whole form's worth of rejected values on
        // screen — and for a plain field edit (no rename) the old failure branch, gated on
        // renamedFrom, restored NOTHING at all. Snapshot before the assign, restore whole on failure.
        vendorUndo = App.snapshotRows([v]);
        Object.assign(v, fields);
        vendorRec = v;
        if (old !== name) {
          renamedFrom = old;
          this.products().forEach(p => {
            let hit = false;
            // ⚠ Snapshot BEFORE the first mutation and restore by IDENTITY (S164). A name-keyed
            // reverse ("if p.vendor === name -> old") is an UNSOUND inverse: a consolidation rename
            // (ABC Dist -> Acme, allowed because the dup guard only checks vendor RECORDS) can touch
            // a product already bought from "Acme" via a cross-vendor cost-history entry alone — the
            // forward pass leaves its vendor be, but the reverse would wrongly stamp it back to the
            // old name, a vendor it was never on. snapshotRows/restoreRows key on the object.
            const snap = () => { if (!hit) vendorUndo.push(...App.snapshotRows([p])); };
            if (p.vendor === old) { snap(); p.vendor = name; hit = true; }
            // Each cost-history entry carries the vendor NAME, and that is what the Vendor
            // Tracker filters on for Annual Drift and the Clean / Watch / High status. Left
            // behind, a renamed vendor's drift reads $0.00 forever and its status flips to
            // Clean — while the Price Changes tab, which reads deliveries, still shows every
            // increase. Note a product bought from someone else can still hold an entry from
            // this vendor, so this is not scoped to p.vendor.
            (p.cost_history || []).forEach(h => { if (h && h.vendor === old) { snap(); h.vendor = name; hit = true; } });
            if (hit) touched.push(p);
          });
          // Orders, deliveries and discrepancy claims name their vendor by NAME too, and every
          // lookup that closes a PO or scores a vendor matches on it (openOrderForVendor on the
          // Order Sheet, openOrdersForVendor in Receive Delivery, the Vendor Tracker). Leaving
          // them on the old name orphaned the open PO: the vendor dropped straight back into
          // "Still to Order" and the delivery could never be matched to it.
          const carry = (list, mod, kind) => {
            const hit = (list || []).filter(r => r && r.vendor === old);
            if (!hit.length) return;
            vendorUndo.push(...App.snapshotRows(hit));   // snapshot before renaming, restore by identity (S164)
            hit.forEach(r => { r.vendor = name; });
            carried.push({ mod, kind, recs: hit });
          };
          const inv = App.inventoryData || {};
          carry(inv.ic_orders,     'ic', 'order');
          carry(inv.ic_deliveries, 'ic', 'delivery');
          carry((App.data || {}).vendor_discrepancies, 'core', 'vendor_discrepancy');
        }
      }
    } else {
      savedId = App.uid();
      vendorRec = { id: savedId, ...fields, created_at: new Date().toISOString() };   // putRecord pushes it into memory
    }

    const btn = document.getElementById('iv-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    // Vendor record is row-per-record now; the rename cascade to the affected products,
    // orders, deliveries and claims persists as rows too. Every write result is checked —
    // a cascade that never reached storage must not be reported as a clean save, or the
    // rename looks done on screen and comes back on the next load.
    // ⚠ S165. The rename cascade must land WITH the vendor row, or the vendor's open PO is orphaned.
    // These writes are not one transaction, so two things guard a half-written rename:
    //   1. The cascade only fires once the VENDOR row has LANDED. Writing products under the new name
    //      while the vendor row failed leaves the reverse orphan — products naming a vendor the
    //      server no longer holds. The twin ic-locations.updateLocation gates its cascade the same
    //      way (S63). And on the first cascade miss we stop, so a partial spreads no further.
    //   2. A retry loop is deliberately NOT used. App.putRecord / putRecordsBulk already queue every
    //      offline / dropped-connection write as success, so the ONLY failures that reach here are
    //      non-transient (storageFull, viewer read-only, no account membership) — retrying replays
    //      the identical failure. (This is why the S11 seed-clear retry does not transfer: its
    //      lost-response DELETE ambiguity sits BELOW this queue absorption; here there is none.)
    let ok = vendorRec ? await App.putRecord('ic', 'vendor', vendorRec) : true;
    const vendorLanded = ok;   // used to describe a partial failure precisely
    if (ok && touched.length && !(await App.putRecordsBulk('ic', 'product', touched))) ok = false;
    for (const c of carried) {
      if (!ok) break;
      if (!(await App.putRecordsBulk(c.mod, c.kind, c.recs))) ok = false;
    }
    if (ok) {
      if (vendorId) this.openEdit(savedId);
      else { this.editId = null; this._draft = null; this.renderList(); }
    } else {
      // Put memory back the way it was, WHOLE and by IDENTITY — the vendor record AND every product,
      // order, delivery and claim the rename touched were snapshotted before mutating, so one
      // App.restoreRows restores them all (it deletes keys the assign added and reassigns the rest).
      // The rename happens in memory BEFORE any write; leave it and the operator's retry sees
      // old === name, skips the cascade entirely, and writes the vendor row under the new name with
      // its orders still on the old one — the orphaned open PO this cascade exists to prevent.
      App.restoreRows(vendorUndo);
      if (btn) { btn.disabled = false; btn.textContent = vendorId ? 'Update Vendor' : 'Save Vendor'; }
      // Say precisely what landed (S165). When the vendor row saved but its cascade did not, the
      // rename is half-applied ON THE SERVER even though the screen has been put back — the operator
      // needs to know a reload would show that split, and that saving again finishes it. A total
      // failure (nothing landed) keeps the plain message.
      fail(vendorLanded && renamedFrom != null
        ? 'The vendor saved but not everything linked to it did. The rename is only half saved. Save again to finish it.'
        : 'Save failed. Try again.');
    }
  },

  // ── Delete ────────────────────────────────────────────────────────────────
  async confirmDel(id) {
    if (!(await App.confirmDelete())) return;
    await App.removeRecord('ic', 'vendor', id);   // row-per-record
    this.renderList();
  },

};
