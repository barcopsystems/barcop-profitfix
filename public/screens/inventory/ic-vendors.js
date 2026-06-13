'use strict';

/* ── Inventory Control — Vendors (ic_vendors) ─────────────────────────────────
   Distributor / supplier contacts and terms. Products in ic_products reference
   a vendor by name. Vendor pricing auto-feeds Profit Recovery Vendor Watch.
   Stored in App.inventoryData (ic_data table).

   Landing-form pattern: the add form (all vendor fields on one row + notes, one
   Save) lives on the landing above the vendor list. Editing a vendor opens its
   own page (not a popup — it lists the products + recent price changes for the
   vendor). Return to the list via the sidebar. */

S.InventoryVendors = {
  editId: null,
  _pendingDelId: null,
  entryMode: 'manual',     // 'manual' = type a vendor, 'import' = drop a vendor list file
  TERMS: ['', 'COD', 'Net 7', 'Net 15', 'Net 30', 'Net 60'],

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
      { h: 'Add A Vendor', p: ['Fill in the vendor name and whatever contact details you have. Only the name is required. Payment terms and delivery days help you plan orders and spot a vendor who slips on either. Save and the vendor is ready to attach to products.'] },
      { h: 'Upload A Vendor List', p: ['Already have your vendors in a spreadsheet or a distributor list? Switch the Add a Vendor card to Import File and drop in a CSV or Excel file. The first row is your column headers, one vendor per row. Only the vendor name is required; rep, phone, email, delivery days, terms, and account number all come in too if your file has them. Bar Cop shows the columns it found, auto-matched, with a preview so you can confirm before importing. A name already on your list is skipped so you never get a duplicate.'] },
      { h: 'Edit A Vendor', p: ['Open a vendor to update its details and see two things at a glance: every product you buy from them, and the most recent cost changes on those products. Rename a vendor and every product pointing at the old name follows automatically.'] },
      { h: 'Pricing Feeds Profit Recovery', p: ['Each time you apply a cost change in Receive Delivery, Bar Cop logs it against the vendor. That same history feeds Profit Recovery Vendor Watch and the Vendor Scorecard, so a vendor quietly raising prices shows up before it eats your margin.'] }
    ]);
  },

  // ── Shared form: all fields on one row + notes. Used by add and edit. ───────
  formFieldsHTML(v) {
    const termOpts = this.TERMS.map(t =>
      '<option value="' + t + '"' + (v && v.payment_terms === t ? ' selected' : '') + '>' + (t || '-') + '</option>').join('');
    return '<div class="form-row" style="gap:12px;">'
      + '<div class="f" style="flex:1.7 1 160px;"><label>Vendor Name</label><input type="text" id="iv-name" value="' + esc(v?.name || '') + '" placeholder="Republic National"/></div>'
      + '<div class="f" style="flex:1 1 100px;"><label>Rep Name</label><input type="text" id="iv-rep" value="' + esc(v?.rep || '') + '" placeholder="Sales rep"/></div>'
      + '<div class="f" style="flex:1 1 110px;"><label>Phone</label><input type="text" id="iv-phone" value="' + esc(v?.phone || '') + '" placeholder="(555) 123-4567"/></div>'
      + '<div class="f" style="flex:1.4 1 140px;"><label>Email</label><input type="email" id="iv-email" value="' + esc(v?.email || '') + '" placeholder="rep@distributor.com"/></div>'
      + '<div class="f" style="flex:1 1 100px;"><label>Delivery Days</label><input type="text" id="iv-days" value="' + esc(v?.delivery_days || '') + '" placeholder="Mon, Thu"/></div>'
      + '<div class="f" style="flex:0.7 1 78px;"><label>Terms</label><select id="iv-terms">' + termOpts + '</select></div>'
      + '<div class="f" style="flex:1 1 100px;"><label>Account #</label><input type="text" id="iv-account" value="' + esc(v?.account_number || '') + '" placeholder="Account #"/></div>'
      + '</div>'
      + '<div class="form-row" style="margin-top:12px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="iv-notes" class="notes-ta" rows="2" placeholder="Optional">' + esc(v?.notes || '') + '</textarea></div></div>';
  },

  // ── Landing: add form on top, vendor list below ────────────────────────────
  renderList() {
    this.actions.innerHTML = '';
    this.editId = null;
    const vendors = this.vendors();

    let listSection;
    if (vendors.length === 0) {
      listSection = '<div style="margin-top:18px;font-size:12px;color:var(--t3);">No vendors yet. Add one above. '
        + 'Products link to a vendor, and vendor pricing feeds Profit Recovery Vendor Watch.</div>';
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
      listSection = '<div class="sh" style="margin-top:24px;">Your Vendors</div>'
        + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Vendor</th><th>Rep</th><th>Phone</th><th>Terms</th><th>Products</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + this.addFormCard() + listSection + '</div>';
    this.wireList();
  },

  // A segmented toggle swaps the card body between typing one vendor and dropping
  // a whole vendor list, so the operator picks a lane instead of facing two boxes
  // ([[unified-import-pattern]]). The import lane mounts the shared CSVMapper.
  addFormCard() {
    const segBtn = (mode, label) => {
      const on = this.entryMode === mode;
      return '<button type="button" class="btn btn-sm iv-mode" data-mode="' + mode + '" style="'
        + (on ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
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
      const save = ev.target.closest('#iv-save');
      const open = ev.target.closest('.iv-open');
      const edit = ev.target.closest('.iv-edit');
      const del  = ev.target.closest('.iv-del');
      if (save)      this.saveVendor();
      else if (open) this.openEdit(open.dataset.id);
      else if (edit) this.openEdit(edit.dataset.id);
      else if (del)  this.confirmDel(del.dataset.id);
    };
    App.applyCollapsed(this.container);
    if (this.entryMode === 'import') this.mountImporter();
  },

  // ── CSV / Excel vendor-list import (drag-drop + column mapping) ──────────────
  mountImporter() {
    const el = document.getElementById('iv-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your vendor list here',
      dropSub: 'Needs a column for vendor name. Rep, phone, email, delivery days, terms, and account number come in too if your file has them.',
      actionsEl: '#iv-imp-actions',
      fields: [
        { key: 'name',           label: 'Vendor Name',   required: true,  match: ['vendor', 'vendor name', 'name', 'supplier', 'distributor', 'company', 'company name'] },
        { key: 'rep',            label: 'Rep Name',      required: false, match: ['rep', 'rep name', 'sales rep', 'salesperson', 'contact', 'contact name'] },
        { key: 'phone',          label: 'Phone',         required: false, match: ['phone', 'phone number', 'telephone', 'tel', 'contact phone'] },
        { key: 'email',          label: 'Email',         required: false, match: ['email', 'e-mail', 'email address'] },
        { key: 'delivery_days',  label: 'Delivery Days', required: false, match: ['delivery days', 'delivery', 'days', 'delivery day'] },
        { key: 'payment_terms',  label: 'Terms',         required: false, match: ['terms', 'payment terms', 'net terms', 'payment'] },
        { key: 'account_number', label: 'Account #',     required: false, match: ['account', 'account number', 'account #', 'acct', 'acct #', 'account no'] }
      ],
      confirmLabel: 'Import',
      onComplete: rows => this.importVendors(rows)
    });
  },

  // Map a free-text terms cell onto one of the known terms, else leave it blank
  // (the edit form's Terms dropdown only offers the known set, so an unrecognized
  // value would be silently unselectable).
  normTerms(raw) {
    const s = (raw || '').trim();
    if (!s) return '';
    const flat = x => String(x).toLowerCase().replace(/\s+/g, '');
    const hit = this.TERMS.find(t => t && flat(t) === flat(s));
    return hit || '';
  },

  async importVendors(rows) {
    const existing = this.vendors();
    const taken = new Set(existing.map(v => (v.name || '').trim().toLowerCase()));
    const toAdd = [];
    let dup = 0, blank = 0;
    rows.forEach(r => {
      const name = (r.name || '').trim();
      if (!name) { blank++; return; }
      const key = name.toLowerCase();
      // Skip a name already on the list (or repeated in the file) so a re-drop
      // never creates duplicate vendors.
      if (taken.has(key)) { dup++; return; }
      taken.add(key);
      toAdd.push({
        id:             App.uid(),
        name,
        rep:            (r.rep || '').trim(),
        phone:          (r.phone || '').trim(),
        email:          (r.email || '').trim(),
        delivery_days:  (r.delivery_days || '').trim(),
        payment_terms:  this.normTerms(r.payment_terms),
        account_number: (r.account_number || '').trim(),
        notes:          '',
        imported:       true,
        created_at:     new Date().toISOString()
      });
    });

    const result = document.getElementById('iv-imp-result');
    if (!toAdd.length) {
      if (result) result.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + (dup ? 'No new vendors imported. ' + dup + ' ' + (dup === 1 ? 'name was' : 'names were') + ' already on your list.'
               : 'No vendors imported. No vendor names were found in the file.') + '</div>';
      return;
    }

    this.vendors().push(...toAdd);
    const ok = await App.saveInventory();
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
      + (dup ? ' Skipped ' + dup + ' already on your list.' : '')
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
    if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
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
  },

  renderProductsCard(prods) {
    const heading = '<div class="sh" style="margin-top:24px;">Products from this Vendor</div>';
    if (prods.length === 0) {
      return heading + '<div style="font-size:12px;color:var(--t3);">No products are linked to this vendor yet. '
        + 'Set the Primary Vendor field on a product in the Products screen.</div>';
    }
    return heading + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Category</th><th>Size</th><th>Par</th><th>Unit Cost</th>'
      + '</tr></thead><tbody>'
      + prods.map(p => '<tr><td><div class="val">' + esc(p.name) + '</div>'
          + (p.brand ? '<div style="font-size:10px;color:var(--t3);">' + esc(p.brand) + '</div>' : '') + '</td>'
          + '<td>' + esc(p.category || '-') + '</td>'
          + '<td>' + esc(this.sizeLabel(p)) + '</td>'
          + '<td>' + (p.par_level != null && p.par_level !== '' ? esc(p.par_level + ' ' + (App.productUnit(p) || '')) : '<span style="color:var(--t4);">-</span>') + '</td>'
          + '<td>' + (p.unit_cost != null ? App.fmtCurrency(p.unit_cost) : '<span style="color:var(--t4);">-</span>') + '</td></tr>').join('')
      + '</tbody></table></div></div>';
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
      return heading + '<div style="font-size:12px;color:var(--t3);">No price changes recorded yet for this vendor. '
        + 'Bar Cop logs every cost change automatically when you apply price updates in Receive Delivery.</div>';
    }
    return heading + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
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
      + '</tbody></table></div></div>'
      + '<div style="font-size:10px;color:var(--t3);margin-top:8px;">Same data feeds Profit Recovery Vendor Watch and the Vendor Scorecard.</div>';
  },

  async saveVendor() {
    const vendorId = this.editId;
    const name = document.getElementById('iv-name')?.value.trim();
    const err  = document.getElementById('iv-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (!name) { fail('Vendor name required.'); return; }
    const dup = this.vendors().some(v => v.id !== vendorId && v.name.toLowerCase() === name.toLowerCase());
    if (dup) { fail('A vendor with that name already exists.'); return; }

    const fields = {
      name,
      rep:            document.getElementById('iv-rep')?.value.trim() || '',
      phone:          document.getElementById('iv-phone')?.value.trim() || '',
      email:          document.getElementById('iv-email')?.value.trim() || '',
      delivery_days:  document.getElementById('iv-days')?.value.trim() || '',
      payment_terms:  document.getElementById('iv-terms')?.value || '',
      account_number: document.getElementById('iv-account')?.value.trim() || '',
      notes:          document.getElementById('iv-notes')?.value.trim() || ''
    };

    let savedId = vendorId;
    if (vendorId) {
      const v = this.vendorById(vendorId);
      if (v) {
        const old = v.name;
        Object.assign(v, fields);
        if (old !== name) {
          this.products().forEach(p => { if (p.vendor === old) p.vendor = name; });
        }
      }
    } else {
      savedId = App.uid();
      this.vendors().push({ id: savedId, ...fields, created_at: new Date().toISOString() });
    }

    const btn = document.getElementById('iv-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveInventory();
    if (ok) {
      if (vendorId) this.openEdit(savedId);
      else { this.editId = null; this.renderList(); }
    } else {
      if (btn) { btn.disabled = false; btn.textContent = vendorId ? 'Update Vendor' : 'Save Vendor'; }
      fail('Save failed. Try again.');
    }
  },

  // ── Delete ────────────────────────────────────────────────────────────────
  async confirmDel(id) {
    if (!(await App.confirmDelete())) return;
    App.inventoryData.ic_vendors = this.vendors().filter(x => x.id !== id);
    await App.saveInventory();
    this.renderList();
  },

};
