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
    this._setupFor = null;   // a fresh visit is an Add, whatever the last one was
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

    /* ⛔ THE CONFIRM SCREEN TAKES THE ADD FORM'S SLOT, and the vendor list below stays — the same
       shape the Add Products routing screen uses. Keeping the list visible is the point: "already on
       your list" is a verdict about that list, and the operator can see it from here. */
    this.container.innerHTML = '<div class="screen">'
      + (this._vendorReview ? this.vendorReviewHTML() : this.addFormCard())
      + this.pendingSectionHTML() + listSection + '</div>';
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
    /* ⛔ THE HEADING IS A CLAIM ABOUT WHICH ACTIVITY THIS IS ([[the-loop]] #79). Set Up reuses the
       add form, correctly — same fields, same save — but the operator pressed "Set Up" on a
       vendor 50 products already point at and landed under "ADD A VENDOR" (F27). `_setupFor`
       outlives `_setupName` (which wireAdd consumes the moment it prefills the box) so a
       re-render keeps the heading true while App.captureDraft keeps the name in the field. */
    return '<div class="card form-card">'
      + App.collapsibleCardTitle('ic-vendors', this._setupFor ? 'Set Up ' + this._setupFor : 'Add a Vendor')
      + '<div class="collapse-body">'
      + '<div class="seg-toggle">' + segBtn('manual', 'Enter Manually') + segBtn('import', 'Import File') + '</div>'
      + modeBody
      + '</div></div>'
      + actionRow;
  },

  wireList() {
    this.container.onclick = ev => {
      /* The confirm screen's two controls. Both write state and re-render, so the button's count,
         the rows and what gets written all read from the same place. */
      // A section head opens or closes its own table. A closed section renders no rows at all, so
      // this is what actually builds them.
      const vsec = ev.target.closest('[data-confirm-section]');
      if (vsec && this._vendorReview) {
        const k = vsec.dataset.confirmSection;
        this._vendorReview.open[k] = (k === 'needs') ? (this._vendorReview.open[k] === false) : !this._vendorReview.open[k];
        this.renderList(); return;
      }
      /* Remove takes a row out of the import. No confirm: nothing is written until Add, the row is
         named right beside the button, and Start Over re-drops the file. */
      const vrm = ev.target.closest('[data-confirm-remove]');
      if (vrm && this._vendorReview) {
        this._vendorReview.removed[vrm.dataset.confirmRemove] = true;
        this.renderList(); return;
      }
      if (ev.target.closest('[data-vendorreview-go]')) { this._runVendorReview(); return; }
      if (ev.target.closest('[data-vendorreview-back]')) {
        // Back to the drop zone, not out of the import. A mapping belongs to the file it was made
        // for, so the file is re-dropped from scratch — nothing was written to undo.
        this._vendorReview = null; this.renderList(); return;
      }
      const mode = ev.target.closest('.iv-mode');
      // Switching mode abandons a confirm in progress, which is safe: nothing has been written.
      if (mode) { this._vendorReview = null; this.entryMode = mode.dataset.mode; this.renderList(); return; }
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
    /* ⚠ NOT WHILE THE CONFIRM SCREEN IS UP. Its markup replaces the add-form card, so `#iv-csv` is
       gone and re-mounting would hand the operator a second file picker over a file they have not
       finished confirming. */
    if (this._vendorReview) return;
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
    this._setupFor = name;
    this._draft = null;
    try { localStorage.removeItem(App._collapseKey('ic-vendors')); } catch (e) {}
    this.renderList();
  },

  // Start Over on the add form: empty every field (and any prefilled Set Up name)
  // back to a clean form, the card stays open.
  startOver() {
    this._setupName = null;
    // The heading goes with the prefill: a stale "Set Up X" over an emptied form is the same
    // wrong claim pointing the other way.
    this._setupFor = null;
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
        // ⚠ REQUIRED. `Vendor ID | Legal Name | Contact` bound the ID as the vendor's name, because
        // `name` is EXACT_ONLY and "Legal Name" had no candidate. Precise spellings lead.
        { key: 'name',           label: 'Vendor Name',   required: true,  match: ['vendor name', 'supplier name', 'distributor name', 'company name', 'business name', 'legal name', 'display name', 'vendor', 'name', 'supplier', 'distributor', 'company', 'purveyor'] },
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
      /* ⛔ THE FILE DOES NOT WRITE ITSELF ANY MORE. It goes to the confirm screen, and the Add press
         there is what moves responsibility for what lands from Bar Cop to the operator. This door
         earns that screen more than most: its own comments record a delivery-FEE column landing in
         the delivery-DAYS field, a Vendor ID column binding as the vendor's NAME, and "$250 or 5
         cases" storing a $2,505 minimum. None of those is visible in a mapper preview; all of them
         are obvious in a list of what is about to be created. */
      onComplete: rows => this._openVendorReview(rows)
    });
  },

  /* ── The confirm screen ──────────────────────────────────────────────────────
     Door 3 of the rollout, and the first built ON `ImportConfirm` rather than beside it. This door
     owns its columns and its build; the shell owns the frame, the dim rule and — the one that
     matters — the button's count, which it derives from the rows rather than taking as an argument. */

  /* ⛔ THE ONE WALK. `importVendors` and the screen must decide "does this row land" in the same
     place, or the button and the write can disagree — the defect the reference screen was rebuilt
     to close. Pure: no DOM, no writes, safe to call on every render. */
  _buildVendorRows(rows) {
    /* ⚠ THE SEED IS FLATTENED THE SAME WAY THE INCOMING KEY IS, or the dedup only works for
       punctuation-free names. Distributor names carry periods and commas as a rule, products link
       to vendors BY NAME, and `_vendorInfo` takes the FIRST match — so a second "Ben E. Keith"
       means the Order Sheet keeps quoting the stale one. */
    const vkey = n => String(n || '').trim().toLowerCase().replace(/[\s.,]+/g, ' ').trim();
    const mine = new Set(this.vendors().map(v => vkey(v.name)));
    const seen = new Set();
    const list = [];
    (rows || []).forEach(r => {
      const name = (r.name || '').trim();
      if (!name) { list.push({ raw: r, name: '', status: 'blank', notes: [] }); return; }
      const key = vkey(name);
      /* ⛔ TWO REASONS, NOT ONE. Both used to be a single `dup` count, and they are different
         problems: a name you already own is a dead end, a name repeated inside the file is about
         the file. The operator can act on one of them and not the other. */
      if (mine.has(key)) { list.push({ raw: r, name: name, status: 'dup', notes: [] }); return; }
      if (seen.has(key)) { list.push({ raw: r, name: name, status: 'repeat', notes: [] }); return; }
      seen.add(key);
      /* ⚠ A CELL HOLDING TWO NUMBERS IS REFUSED, not concatenated. `App.parseNum` joins digit runs,
         so "$250 or 5 cases" stored a $2,505.00 minimum against a real $250 one. Refusing leaves the
         field blank, which the Order Sheet shows as no minimum — visibly missing rather than
         confidently wrong. */
      const oneNum = v => ((String(v == null ? '' : v).match(/[\d][\d,]*(?:\.\d+)?/g) || []).length > 1 ? null : v);
      const nonNeg = n => (n == null || n < 0) ? null : n;
      /* A cell the file HAD and Bar Cop could not use is reported. An ABSENT cell is not a problem
         and must never be counted as one, or every name-and-phone list reads broken.
         ⛔ AND THESE ARE NOTES ON A LANDING ROW, NOT REFUSALS. The vendor still imports; it simply
         arrives without that one field, and the row says so where the operator can still act on it.
         The old screen reported them in a sentence after the write, which is too late. */
      const days = this._normDeliveryDays(r.delivery_days);
      const terms = this.normTerms(r.payment_terms);
      /* ⚠ FLAGS, AND THE COPY IS DERIVED FROM THEM — never the other way round. The result line
         counts these, and counting them by matching the note's own wording means a reworded note
         silently zeroes the count ([[the-loop]] #25). */
      const badDays = !!(String(r.delivery_days || '').trim() && !days);
      const badTerms = !!(String(r.payment_terms || '').trim() && !terms);
      /* ⛔ THE MONEY FIELDS ARE REFUSED SILENTLY, AND THEY ARE THE DANGEROUS ONES. This function
         already refuses a two-number cell and a negative, for good reasons written above — but
         nothing told the operator it had happened, so "$250 or 5 cases" and a -$10 fee simply
         vanished and the vendor arrived with no minimum and no fee. Blank reads as "this vendor has
         none", which is a different fact from "your file said something Bar Cop would not use".
         Found by predicting a real file through the real door, not by any assertion: the days and
         terms notes were there and these three were not, on the same row.
         ⚠ Only when the file CARRIED something. An absent cell is not a problem and must never be
         counted as one, or every name-and-phone list reads broken. */
      const refused = (raw, stored) => !!(String(raw == null ? '' : raw).trim() && stored == null);
      const badMin  = refused(r.order_minimum, nonNeg(App.parseNum(oneNum(r.order_minimum))));
      const badFee  = refused(r.delivery_fee, nonNeg(App.parseNum(oneNum(r.delivery_fee))));
      const badFree = refused(r.free_delivery_over, nonNeg(App.parseNum(oneNum(r.free_delivery_over))));
      const notes = [];
      if (badDays) notes.push('Delivery days could not be read');
      if (badTerms) notes.push('Terms not on your Terms list');
      if (badMin) notes.push('Order minimum could not be read');
      if (badFee) notes.push('Delivery fee could not be read');
      if (badFree) notes.push('Free delivery over could not be read');
      list.push({
        raw: r, name: name, status: 'new', notes: notes, badDays: badDays, badTerms: badTerms,
        badMin: badMin, badFee: badFee, badFree: badFree,
        rec: {
          id:             App.uid(),
          name,
          rep:            (r.rep || '').trim(),
          phone:          (r.phone || '').trim(),
          email:          (r.email || '').trim(),
          delivery_days:  days,
          payment_terms:  terms,
          account_number: (r.account_number || '').trim(),
          /* ⚠ App.parseNum, NOT parseFloat. `parseFloat('$1,500')` is NaN and `parseFloat('2,500')`
             is 2 — the Order Sheet printed "Meets the $2.00 minimum" on a $60 order against a real
             $2,500 one. Excel's Currency and Comma formats emit exactly those strings. Negatives are
             refused: `_vendorInfo` gates on `> 0` so a negative would be lost anyway, and storing a
             number no screen will show is worse than not storing it. */
          order_minimum:      nonNeg(App.parseNum(oneNum(r.order_minimum))),
          order_minimum_unit: this._minUnitOf(r.order_minimum, '$'),
          delivery_fee:       nonNeg(App.parseNum(oneNum(r.delivery_fee))),
          free_delivery_over: nonNeg(App.parseNum(oneNum(r.free_delivery_over))),
          notes:          '',
          imported:       true,
          created_at:     new Date().toISOString()
        }
      });
    });
    return { list: list };
  },

  _openVendorReview(rows) {
    this._vendorReview = {
      // ⚠ A STABLE ID PER ROW, so Remove has something to remove BY. The build returns one
      // verdict per input row in the file's own order, so index is a real identity here.
      rows: (rows || []).map((r, i) => Object.assign({}, r, { _rid: 'r' + i })),
      open: {}, removed: {}
    };
    this.renderList();
  },

  /* ONE WALK produces the rows the screen shows AND the number the button prints, because they come
     out of the same `_buildVendorRows` the write uses. */
  _vendorReviewSummary() {
    const r = this._vendorReview;
    if (!r) return { rows: [], count: 0 };
    // A removed row is gone from the list, the counts and the write.
    const live = r.rows.filter(x => !r.removed[x._rid]);
    const built = this._buildVendorRows(live);
    // ⚠ Zipped by index: the build pushes exactly one entry per input row, in order.
    const rows = built.list.map((x, i) => this._vendorReviewRow(x, (live[i] || {})._rid));
    return { rows: rows, count: rows.filter(x => x.lands).length, built: built };
  },
  _vendorReviewCount() { return this._vendorReview ? this._vendorReviewSummary().count : 0; },

  /* One file row as an `ImportConfirm` row. `cells` is HTML this door escapes; `note` and `notes`
     are TEXT the shell escapes, and they are what the shell's one-line NOTE_BUDGET applies to. */
  _VENDOR_ROW_NOTE: null,
  _vendorReviewRow(x, rid) {
    const NOTE = {
      'new':  'Adding this vendor',
      dup:    'Already on your list',
      repeat: 'Repeated in this file',
      blank:  'No vendor name'
    };
    const rec = x.rec || {};
    const cell = v => esc(String(v == null || v === '' ? '' : v)) || '&mdash;';
    return {
      cells: [x.name ? esc(x.name) : '&mdash;',
              cell(x.status === 'new' ? rec.rep : (x.raw || {}).rep),
              cell(x.status === 'new' ? rec.delivery_days : (x.raw || {}).delivery_days),
              cell(x.status === 'new' ? rec.payment_terms : (x.raw || {}).payment_terms)],
      key: rid,
      note: NOTE[x.status] || '',
      notes: x.notes || [],
      lands: x.status === 'new'
    };
  },

  vendorReviewHTML() {
    const s = this._vendorReviewSummary();
    const n = s.rows.length;
    const bad = s.rows.filter(x => !x.lands).length;
    /* ⚠ EACH NUMBER NAMES ITS OWN COLLECTION: `n` is rows read out of the file, `bad` is rows that
       will not land, and the button counts what will be created. Reading the nearest one is how a
       screen ends up contradicting itself. And the lead names the button's own verb — renaming the
       button has to rewrite this sentence with it. */
    // ⚠ NO EM DASHES IN OPERATOR COPY. The first version put two in this sentence and the design
    // ratchet caught them on the same run, which is what that ratchet is for.
    const lead = 'Bar Cop read ' + n + ' row' + (n === 1 ? '' : 's') + ' out of this file. '
      + (bad
          ? (bad === 1 ? 'One of them is not going in. ' : bad + ' of them are not going in. ') + 'Check the rest, then add them. '
          : 'Check them, then add them. ')
      + 'Nothing is saved until you do.';
    return ImportConfirm.panel({
      label: 'Check your vendors',
      lead: lead,
      columns: [{ label: 'Vendor', width: 22 }, { label: 'Rep', width: 16 },
                { label: 'Delivery Days', width: 14 }, { label: 'Terms', width: 11 }],
      outcomeLabel: 'What Happens',
      rows: s.rows,
      verb: 'Add', noun: 'Vendor',
      removable: true,
      goAttr: 'data-vendorreview-go', backAttr: 'data-vendorreview-back', backLabel: 'Start Over',
      resultId: 'iv-imp-result',
      // The door owns which sections are open; a closed one builds no table at all.
      open: (this._vendorReview || {}).open,
      busy: !!this._vendorReviewWriting
    });
  },

  /* One press, one import. The button is rebuilt by every re-render, so a flag on the screen is the
     only thing a re-render cannot hand back. */
  async _runVendorReview() {
    const r = this._vendorReview;
    if (!r || this._vendorReviewWriting) return;
    this._vendorReviewWriting = true;
    const btn = this.container && this.container.querySelector('[data-vendorreview-go]');
    if (btn) { btn.disabled = true; btn.textContent = 'Adding...'; }
    try { await this.importVendors(r.rows.filter(x => !r.removed[x._rid]), { reviewed: true }); }
    finally {
      this._vendorReviewWriting = false;
      /* ⛔ ONLY SUCCESS CLEARS THE SCREEN, and `importVendors` is what clears it — a refused write
         keeps the whole screen so the operator can press again without re-dropping the file. Do NOT
         re-render here: the failure path writes into the result slot and a re-render destroys it. */
      if (this._vendorReview) {
        const b = this.container && this.container.querySelector('[data-vendorreview-go]');
        const n = this._vendorReviewCount();
        if (b) { b.disabled = false; b.textContent = 'Add ' + n + ' Vendor' + (n === 1 ? '' : 's'); }
      }
    }
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
  /* ⭐⭐ THE DELIVERY-DAYS READER. Rewritten after five rounds of guards, then hardened over three
     more adversarial rounds (6: six defects, 7: five, 8: eleven). Read this before touching it.

     ⚠⚠ THE ONE RULE THAT MATTERS, and it is what round 8 finally isolated: A SHORT DAY TOKEN IS
     ONLY A DAY IN A SHORTHAND CELL. The single letters (m/w/f) and two-letter forms (mo/tu/we/th/
     fr/sa/su) exist so "M/W/F" and "Tu/Th" work. In PROSE they are noise, and reading them as days
     is what produced almost every silent wrong answer:
       · "Tue & Thu w/24hr notice" -> the bare `w` became WEDNESDAY;
       · "We deliver Mon & Thu"    -> the English word `we` became Wednesday;
       · "Tue & Fri a/m"           -> a bare `m` became Monday;
       · "Tue & Thu - w/24hr"      -> worse, `thu ~ w` read as a RANGE and filled all seven days;
       · "Mon-Fri, S&D route"      -> a stray `s` set the ambiguity flag and refused the whole cell.
     So the cell is classified FIRST: a cell containing ordinary words is prose, and only full day
     NAMES (3+ letters) count in it. Short forms are read only when the cell is shorthand.

     THE SHAPE: classify -> strip times and known abbreviations -> split into clauses on [;,] ->
     within a clause a negator splits head/tail (it negates what FOLLOWS it, or what precedes it if
     nothing follows) -> split into segments -> per segment a `~` sitting BETWEEN two day tokens is
     a range, and exactly one such marker means range, more means list.
     Day sets are unioned; negated days are subtracted at the end.

     ⚠ WHAT IS DELIBERATELY REFUSED (and reported through the door's `badDays` count, so the operator
     is told and can set the chips by hand): a cadence the weekly chips cannot express when it IS the
     schedule ("Monthly", "1st & 3rd Monday"), and a genuinely ambiguous shorthand ("M/T/W" — T is
     Tuesday or Thursday). Refusing and naming beats guessing: the day COUNT drives the par cycle. */
  _normDeliveryDays(raw) {
    const src = String(raw == null ? '' : raw).trim();
    if (!src) return '';
    const D = this.DAY_NAMES;                                   // Mon..Sun, index 0..6

    let s = src.toLowerCase();
    /* Known dotted abbreviations only — NOT every dotted run. A blanket `(?:[a-z]\.){2,}` strip ate
       "M.W.F" down to "F", turning a three-day vendor into a one-day one. */
    s = s.replace(/\b(?:a\.m\.|p\.m\.|f\.o\.b\.|c\.o\.d\.|i\.e\.|e\.g\.|no\.)/g, ' ');
    /* Delivery HOURS are not a day range. Both endpoints may be worded ("open-close", "noon-close",
       "11a-close"), and `close` is a TIME word here, never a negator — "Mon-Fri until close" used to
       negate its own schedule and import nothing. */
    const TW = '(?:\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|a|p)?|open|opening|noon|midnight|lunch|dinner|clos(?:e|ing))';
    s = s.replace(new RegExp('\\b' + TW + '\\s*(?:[-\u2013\u2014]|to|until|til|till)\\s*' + TW + '\\b', 'g'), ' ');
    s = s.replace(/\b(?:until|til|till|before|after|by)\s+clos\w*/g, ' ');
    s = s.replace(/\b24\s*\/\s*7\b|\bseven\s+days(?:\s+a\s+week)?\b/g, ' daily ');

    const FULLDAY = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)\b/;
    /* PICKUP only when the cell is not also naming delivery days. "Mon-Fri, no pickup" and
       "Mon-Fri or will call" used to return Pickup outright — and the chip renderer then shows a
       deliberate-looking Pickup setting with every day chip off. */
    if (/pick\s*-?\s*up|will[\s-]*call|willcall/.test(s) && !FULLDAY.test(s)) return 'Pickup';

    /* ⚠ SHORTHAND vs PROSE. Shorthand is a cell built only from day tokens and separators —
       "M/W/F", "Tu/Th", "M-W-F", "MWF". Anything carrying an ordinary word is prose. */
    const SHORTHAND = /^[\s./,&+|-]*(?:(?:m|t|w|f|s|mo|tu|we|th|fr|sa|su|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)[\s./,&+|-]*)+$/;
    const shorthand = SHORTHAND.test(s);
    // "MWF" has no separators at all: split it into letters so the list logic can read it.
    // ⚠ ONLY when there is NO separator at all. Testing the letter-stripped copy also matched "M-F"
    // and split it into "m f", destroying the range — a 5-day vendor read as 2.
    if (shorthand && /^[mtwfs]{2,5}$/.test(s.trim())) s = s.trim().split('').join(' ');

    const LONG = { monday: 0, mondays: 0, mon: 0, mons: 0,
                   tuesday: 1, tuesdays: 1, tues: 1, tue: 1,
                   wednesday: 2, wednesdays: 2, weds: 2, wed: 2,
                   thursday: 3, thursdays: 3, thurs: 3, thur: 3, thu: 3,
                   friday: 4, fridays: 4, fri: 4, fris: 4,
                   saturday: 5, saturdays: 5, sat: 5, sats: 5,
                   sunday: 6, sundays: 6, sun: 6, suns: 6 };
    const SHORT = { m: 0, mo: 0, tu: 1, w: 2, we: 2, th: 3, f: 4, fr: 4, sa: 5, su: 6 };
    /* ⚠ A BARE `T` OR `S` IS ONLY AMBIGUOUS WHEN ITS TWIN IS ABSENT. In "T/Th" and "M, T, W, Th, F"
       Thursday is spelled out, so `T` can only be Tuesday — and refusing the whole cell threw away a
       schedule a human reads instantly. Same for `S` beside `Su` or `Sa`. */
    const hasTh = /\bth\b|\bthu/.test(s), hasSu = /\bsu\b|\bsun/.test(s), hasSa = /\bsa\b|\bsat/.test(s);
    const RESOLVED = {};
    if (hasTh) RESOLVED.t = 1;                       // Thursday named => bare T is Tuesday
    if (hasSu && !hasSa) RESOLVED.s = 5;             // Sunday named   => bare S is Saturday
    if (hasSa && !hasSu) RESOLVED.s = 6;             // Saturday named => bare S is Sunday
    const AMBIG = { t: 1, s: 1 };
    const SPAN = { weekday: [0, 4], weekdays: [0, 4], weekend: [5, 6], weekends: [5, 6] };
    const dayOf = w => (LONG[w] != null ? LONG[w]
      : (shorthand && SHORT[w] != null) ? SHORT[w]
      : (shorthand && RESOLVED[w] != null) ? RESOLVED[w] : null);

    const NEG = { closed: 1, closes: 1, except: 1, excepting: 1, excluding: 1, excl: 1, exc: 1, minus: 1,
                  no: 1, not: 1, but: 1 };
    const FILLER = { on: 1, in: 1, at: 1, the: 1, a: 1, of: 1, for: 1, and: 1, or: 1, plus: 1, also: 1,
                     delivery: 1, deliveries: 1, deliver: 1, delivers: 1, delivered: 1, we: 1,
                     day: 1, days: 1, only: 1, am: 1, pm: 1, morning: 1, afternoon: 1, evening: 1 };

    /* A cadence the weekly chips cannot express is refused ONLY when it IS the schedule. In a note
       beside a clear weekly base ("Mon-Fri, every other Sat"; "Mon-Fri except 1st Monday") the base
       is unambiguous, so the base is kept and the note ignored. */
    const CADENCE = /\b(?:monthly|bi-?monthly|bi-?weekly|biweekly|fortnight\w*|quarterly|semi-?monthly|every\s+other|alternating)\b/;
    const ORDINAL_DAY = /\b(?:1st|2nd|3rd|4th|first|second|third|fourth)\b[\s&,/and]*(?:1st|2nd|3rd|4th|first|second|third|fourth)?\s*\b(?:mon|tue|wed|thu|fri|sat|sun)/;
    const hasBase = /\b(?:mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|daily|weekday|weekend)\b[\s.]*(?:[-\u2013\u2014]|to|thru|through)[\s.]*\b(?:mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(s)
      || /\bdaily\b|\bweekday|\bweekend/.test(s)
      || (s.match(new RegExp(FULLDAY.source, 'g')) || []).length >= 2;
    if ((CADENCE.test(s) || ORDINAL_DAY.test(s)) && !hasBase) return '';
    /* ⚠ WHEN THERE IS A CLEAR WEEKLY BASE, THE CADENCE PHRASE IS REMOVED — not merely tolerated.
       Leaving it in let its day still be read: "Mon-Fri except 1st Monday" EXCLUDED Monday (it is a
       monthly exception, not a weekly one) and "Mon-Fri, every other Sat" ADDED Saturday as a weekly
       delivery. Both are cadences the chips cannot express, so neither may move the weekly set. */
    if (hasBase) {
      s = s.replace(/\b(?:except|excluding|excl)?\s*(?:1st|2nd|3rd|4th|first|second|third|fourth)\b[\s&,/]*(?:and\s+)?(?:1st|2nd|3rd|4th|first|second|third|fourth)?\s*\b(?:mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)\w*/g, ' ');
      s = s.replace(/\b(?:every\s+other|alternating|bi-?weekly|biweekly|monthly)\s+\b(?:mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)\w*/g, ' ');
    }

    const DAYWORD = /\b(?:mon|tue|wed|thu|fri|sat|sun|weekday|weekend)/;
    const STRONG = /\b(?:closed|closes|except|excepting|excluding|excl|exc|minus)\b/;
    const WEAK = /\b(?:no|not|but)\b(?=(?:\s+\w+){0,2}\s+(?:mon|tue|wed|thu|fri|sat|sun|weekend))/;
    const ALLWORD = /\bdaily\b|\bevery\s*day\b|\beveryday\b|\ball\s+days\b|\b7\s+days\b/;

    const clauses = s.split(/[;,]+/);
    let mode = 'pos', sawPositive = false, all = false, ambiguous = false;
    const pos = new Set(), neg = new Set();
    const segs = [];
    const pushSegs = (text, polarity) => {
      if (!text || !text.trim()) return;
      // ⚠ `all` is armed HERE as well as in the walk, so a plain "Daily" clause arms sawPositive —
      // without it "Daily, closed Sat, Sun" let Sunday flip back positive on the third clause.
      if (ALLWORD.test(text)) { all = true; if (polarity === 'pos') sawPositive = true; }
      if (polarity === 'pos' && DAYWORD.test(text)) sawPositive = true;
      text.split(/[&|+]+|\band\b|\bor\b|\/(?=\s*[a-z]{2,})/).forEach(seg => segs.push({ seg, polarity }));
    };
    clauses.forEach(cl => {
      const m = cl.match(STRONG) || cl.match(WEAK);
      if (!m && !sawPositive) mode = 'pos';
      if (!m) { pushSegs(cl, mode); return; }
      const at = cl.indexOf(m[0]);
      const head = cl.slice(0, at), tail = cl.slice(at + m[0].length);
      if (DAYWORD.test(tail)) { pushSegs(head, mode); pushSegs(tail, 'neg'); mode = 'neg'; }
      else {
        const backwards = !tail.trim() || !/[a-z]/.test(tail);
        pushSegs(head, backwards ? 'neg' : mode);
        if (backwards) mode = 'neg';
      }
    });

    segs.forEach(({ seg, polarity }) => {
      const toks = seg.replace(/[-\u2013\u2014]|\b(?:to|thru|through)\b/g, ' ~ ')
        .split(/[^a-z0-9~]+/).filter(Boolean);
      const isDay = w => !NEG[w] && !FILLER[w] && !SPAN[w] && dayOf(w) != null;
      // Only a `~` sitting BETWEEN two day tokens is a range marker; a hyphenated NOTE has none.
      const marks = [];
      for (let i = 1; i < toks.length - 1; i++) {
        if (toks[i] === '~' && isDay(toks[i - 1]) && isDay(toks[i + 1])) marks.push(i);
      }
      const set = polarity === 'neg' ? neg : pos;
      const addRange = (a, b) => { for (let i = a; ; i = (i + 1) % 7) { set.add(i); if (i === b) break; } };
      const consumed = new Set();
      // Exactly one day-adjacent marker is a RANGE; two or more means the dashes are delimiting a
      // list ("M-W-F"). Days outside the range still count, so "Mon-Fri plus Sat" keeps Saturday.
      if (marks.length === 1) {
        const k = marks[0];
        addRange(dayOf(toks[k - 1]), dayOf(toks[k + 1]));
        consumed.add(k - 1); consumed.add(k + 1);
      }
      toks.forEach((w, i) => {
        if (w === '~' || consumed.has(i)) return;
        if (ALLWORD.test(w) || (w === 'every' && toks[i + 1] === 'day')) { all = true; return; }
        if (SPAN[w]) { const r = SPAN[w]; for (let k = r[0]; ; k = (k + 1) % 7) { set.add(k); if (k === r[1]) break; } return; }
        if (NEG[w] || FILLER[w]) return;
        /* ⚠ AN AMBIGUOUS SINGLE LETTER ONLY REFUSES IN A SHORTHAND CELL. In prose a stray `s` or `t`
           is a fragment of a note ("S&D route", "Sat's"), and refusing the whole cell over it threw
           away perfectly good schedules. */
        if (w.length === 1 && AMBIG[w] && RESOLVED[w] == null) { if (shorthand) ambiguous = true; return; }
        const d = dayOf(w);
        if (d != null) set.add(d);
      });
    });

    /* ⭐⭐ STRICT MODE (Kyle, 2026-07-26: "strict mode or drop... this file drop may be used one time
       if even that. just pick one, fix it and let's move on.")
       ⚠ THE DECIDING FACT WAS REACH, NOT DIFFICULTY. This door is used once, if ever — so a parser
       that keeps needing rounds is the wrong shape of solution regardless of how good it gets.
       Measured: every other surface in the five-door batch converged and re-verified clean twice;
       this function went 6 -> 5 -> 11 findings, because free text has no end of phrasings.
       SO: THE CELL MUST BE ENTIRELY SCHEDULE VOCABULARY OR IT IS NOT READ. A single word this
       function does not know means the whole cell is refused and COUNTED in `badDays`, and the
       operator sets the day chips by hand — a ten-second job on the vendor page, and the manual form
       is chips-only anyway. That trades a few more reported cells for ZERO silent wrong answers.
       It matters because the day COUNT divides into the par cycle (`deliveryDaysPerWeek` ->
       `computeSuggestion`), so a wrong count moved Suggested Par by 36% to 440% — and a
       wrong-but-non-empty answer was never reported, because `badDays` only counts an EMPTY result.
       ⚠ This makes the whole "a note invented a day" class UNREACHABLE rather than guarded, which is
       the same move that finally settled `PosIngest.normDate`. Do not replace it with another guard. */
    const KNOWN = w => w === '~' || LONG[w] != null || SHORT[w] != null || AMBIG[w] || SPAN[w]
      || NEG[w] || FILLER[w] || ALLWORD.test(w) || /^\d+$/.test(w)
      || w === 'every' || w === 'all' || w === 'daily' || w === 'to' || w === 'thru' || w === 'through';
    const leftover = s.replace(/[-–—]|\b(?:to|thru|through)\b/g, ' ')
      .split(/[^a-z0-9]+/).filter(Boolean).filter(w => !KNOWN(w));
    if (leftover.length) return '';

    if (ambiguous) return '';
    const on = all ? new Set(D.map((_, i) => i)) : pos;
    neg.forEach(i => on.delete(i));
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

  async importVendors(rows, opts) {
    opts = opts || {};
    const existing = this.vendors();
    /* ⛔ ONE WALK, SHARED WITH THE SCREEN. The row-by-row decision — is this a new vendor, one
       you already have, a repeat inside the file, or a nameless row — now lives in
       `_buildVendorRows`, which the confirm screen calls to draw itself and this calls to write.
       Two copies of that decision is how a button ends up promising a number the write does not
       honour, which is the defect the whole rollout exists to close. Everything below is
       REPORTING; nothing below decides what lands. */
    const built = this._buildVendorRows(rows);
    const countOf = f => built.list.filter(f).length;
    const toAdd    = built.list.filter(x => x.status === 'new').map(x => x.rec);
    const dup      = countOf(x => x.status === 'dup');
    const repeated = countOf(x => x.status === 'repeat');
    const blank    = countOf(x => x.status === 'blank');
    const badDays  = countOf(x => x.badDays);
    const badTerms = countOf(x => x.badTerms);
    const badMoney = countOf(x => x.badMin || x.badFee || x.badFree);
    /* Every bucket reaches the operator now. `blank` was counted at the top of this function and
       NEVER read again, and the zero-row headline named only duplicates — so a file of 2 known
       vendors and 3 spacer rows said "2 names were already on your list" and accounted for nothing
       else. An absolute claim may only fire when the other buckets are empty. */
    const notes = () => {
      const b = [];
      if (dup) b.push(dup + ' already on your list');
      // A name repeated inside the FILE is a different problem from one you already own, and the
      // operator can act on one and not the other. They used to share a bucket.
      if (repeated) b.push(repeated + ' repeated in this file');
      if (blank) b.push(blank + ' row' + (blank === 1 ? '' : 's') + ' skipped with no vendor name');
      if (badDays) b.push(badDays + ' delivery-day cell' + (badDays === 1 ? '' : 's') + ' could not be read');
      if (badTerms) b.push(badTerms + ' terms value' + (badTerms === 1 ? '' : 's') + ' not on your Terms list');
      // The money cells the file carried and Bar Cop would not use. One clause, because three
      // separate ones would push this line past reading on a messy file.
      if (badMoney) b.push(badMoney + ' order minimum, delivery fee or free-delivery figure' + (badMoney === 1 ? '' : 's') + ' could not be read');
      return b;
    };
    const result = document.getElementById('iv-imp-result');
    if (!toAdd.length) {
      const n = notes();
      // ⚠ AN ABSOLUTE CLAIM NEEDS EVERY OTHER BUCKET EMPTY, `repeated` included now that it has its
      // own. (It cannot actually be non-zero here — a repeat implies a first occurrence that landed
      // — but a headline whose truth rests on that reasoning is one refactor from being false.)
      const head = dup && !blank && !repeated ? 'No new vendors imported. Every name in this file is already on your list.'
        : blank && !dup && !repeated ? 'No vendors imported. No vendor names were found in the file.'
        : dup || blank || repeated ? 'No new vendors imported.'
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
    /* ⛔ THE CONFIRM SCREEN CLEARS ON SUCCESS AND ONLY ON SUCCESS. A refused write returns above
       this line with the screen and every row still up, so the operator presses again rather than
       re-dropping the file. Cleared here because this is the only line that knows the write landed. */
    this._vendorReview = null;
    // Re-render so the new vendors show in the list below, then drop the summary
    // into the freshly-mounted import result slot (stays in import mode).
    this.renderList();
    const res2 = document.getElementById('iv-imp-result');
    /* ⛔ THE CLAUSE LIST IS FOR AN IMPORT NOBODY WAS SHOWN. Every one of those clauses — already on
       your list, repeated in this file, no vendor name, delivery days it could not read, terms not
       on your list — is now a row on the confirm screen, said once, where the operator read it and
       pressed Add. Repeating it afterwards is the second telling, and six parentheticals in gold is
       the shape Kyle called *"very hard to read and follow"* on the sales door.
       The full account survives for a caller with no screen in front of it.
       ⚠ "Added", not "Imported": the file was imported two screens ago, and the button they just
       pressed said Add. */
    if (res2) res2.innerHTML = '<div style="font-size:13px;color:var(--gold);font-weight:700;margin-top:12px;">'
      + 'Added ' + toAdd.length + ' vendor' + (toAdd.length === 1 ? '' : 's') + '.'
      + (!opts.reviewed && notes().length ? ' <span style="color:var(--t3);font-weight:400;">(' + notes().join(' · ') + ')</span>' : '')
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
      + '<td>' + (p.par_level != null && p.par_level !== '' ? esc(p.par_level + ' ' + (App.productUnit(p, p.par_level) || '')) : '<span style="color:var(--t4);">-</span>') + '</td>'
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
    /* ⚠⚠ THE TWO DOORS DISAGREED ON THE SAME THREE FIELDS (class D round 2). The vendor CSV
       importer in this same file wraps all three in `nonNeg = n => (n == null || n < 0) ? null : n`
       and this form stored whatever was typed. `min="0"` on the inputs stops nothing.
       ⚠ HONEST SIZE: this is NOT a money defect and should not be reported as one. Every reader on
       the order sheet already floors it — `(v.order_minimum != null && v.order_minimum > 0)`,
       `(v.delivery_fee > 0)`, `(v.free_delivery_over > 0)` — so a negative changes no number
       anywhere. What it does is get stored and then RENDERED BACK INTO THIS FORM on reopen, so the
       operator sees "-150" sitting in Order Minimum as though it were their setting while the order
       sheet quietly ignores it: a setting that reads as set and does nothing.
       ⚠ THE FORM REFUSES, THE IMPORT STILL CLAMPS, and that split is deliberate — the same one made
       for `weekly_covers` and `price`. An operator typing a value can be TOLD, and being told beats
       being silently corrected; a file of two hundred rows cannot stop on each one, so it clamps and
       reports in aggregate ([[the-loop]] #57).
       ⚠ ABOVE the `Object.assign(v, fields)` below, which overwrites EVERY field on the live vendor
       row — a refusal after it would leave the whole form's rejected values on screen, which is
       precisely the defect S164 fixed for the failed-write path (#49). */
    const negVendor = [
      ['Order Minimum', fields.order_minimum],
      ['Delivery Fee', fields.delivery_fee],
      ['Free Delivery Over', fields.free_delivery_over]
    ].filter(f => f[1] != null && f[1] < 0).map(f => f[0]);
    if (negVendor.length) { fail(negVendor.join(' and ') + ' cannot be negative.'); return; }

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
      else { this.editId = null; this._draft = null; this._setupFor = null; this.renderList(); }
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
  /* What still points at this vendor. Products and orders reference a vendor BY NAME
     ([[two-doors-same-data]]), not by id, which is exactly why deleting the record does not
     break them — and why the confirm has to explain that rather than leave the operator to
     guess. Open orders only: a received order is history, not a live commitment. */
  vendorReferences(name) {
    const key = String(name || '').trim().toLowerCase();
    const products = this.products().filter(p => p && String(p.vendor || '').trim().toLowerCase() === key);
    const orders = (App.inventoryData && App.inventoryData.ic_orders) || [];
    const openOrders = orders.filter(o => o && o.status === 'Open' && String(o.vendor || '').trim().toLowerCase() === key);
    return { products, openOrders, any: products.length > 0 || openOrders.length > 0 };
  },

  /* ⛔ THE CONFIRM ON THE MODULE'S ONE DESTRUCTIVE VENDOR ACTION SAID LEAST ABOUT THE MOST (F26).
     Deleting a vendor with 50 products attached showed the generic "Delete this?", while
     ic-product-setup's delete two screens away names every menu item, prep batch and open
     investigation at risk, and Cancel Order names the vendor and the amount.
     The two facts an operator needs are BOTH missing from the generic wording, and they point in
     opposite directions: what is LOST (rep, phone, terms, minimums, delivery days) and what
     SURVIVES (every product keeps its vendor name, keeps grouping on the Order Sheet, and the
     name comes back under Set Up From Your Products). Saying only "permanent and cannot be
     undone" over a vendor with 50 products reads as the worse of those two. */
  /* ⚠ PLAIN TEXT WITH REAL LINE BREAKS, NOT MARKUP. App.confirm renders its message through
     `esc(message)` — there is no html option — so a <div> here would print as literal angle
     brackets on the dialog. It does set `white-space:pre-line`, and app.js says in as many words
     that a message carrying its own breaks renders as written, so newlines are the supported
     shape. Checked in the source before writing this, not assumed. */
  _delVendorSummary(name, refs) {
    const n = refs.products.length;
    const bits = [];
    if (n > 0) bits.push(n + ' ' + (n === 1 ? 'product' : 'products'));
    if (refs.openOrders.length > 0) bits.push(refs.openOrders.length + ' open ' + (refs.openOrders.length === 1 ? 'order' : 'orders'));
    return name + ' is still on ' + bits.join(' and ') + '.\n\n'
      + 'Deleting removes the rep, phone, email, terms, account number, order minimum, delivery fee '
      + 'and delivery days you have on file. That part cannot be undone.\n\n'
      + 'Nothing on your products changes. ' + (n === 1 ? 'It keeps' : 'They keep') + ' the name '
      + name + ', ' + (n === 1 ? 'it still groups' : 'they still group') + ' together on the Order '
      + 'Sheet, and the name comes back under Set Up From Your Products so you can enter the '
      + 'details again.';
  },

  async confirmDel(id) {
    const v = this.vendors().find(x => x.id === id);
    const refs = v ? this.vendorReferences(v.name) : { products: [], openOrders: [], any: false };
    if (refs.any) {
      const ok = await App.confirm({
        title: 'Delete ' + v.name + '?',
        message: this._delVendorSummary(v.name, refs),
        confirmText: 'Delete Vendor',
        maxWidth: 480
      });
      if (!ok) return;
    } else if (!(await App.confirmDelete())) {
      return;
    }
    await App.removeRecord('ic', 'vendor', id);   // row-per-record
    this.renderList();
  },

};
