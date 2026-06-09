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
  TERMS: ['', 'COD', 'Net 7', 'Net 15', 'Net 30', 'Net 60'],

  vendors() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_vendors)) App.inventoryData.ic_vendors = [];
    return App.inventoryData.ic_vendors;
  },
  vendorById(id) { return this.vendors().find(v => v.id === id); },
  products() { return (App.inventoryData && App.inventoryData.ic_products) || []; },
  vendorProducts(name) { return this.products().filter(p => p.vendor === name); },

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
          + 'style="padding:0;border:none;background:none;color:var(--gold);font-weight:700;font-size:13px;cursor:pointer;">'
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

  addFormCard() {
    return '<div class="card form-card">'
      + App.collapsibleCardTitle('ic-vendors', 'Add a Vendor')
      + '<div class="collapse-body">'
      + this.formFieldsHTML(null)
      + '<div class="card-actions" style="align-items:center;">'
        + '<button class="btn btn-primary" id="iv-save">Save Vendor</button>'
        + '<span id="iv-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';
  },

  wireList() {
    this.container.onclick = ev => {
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
      + this.renderProductsCard(prods)
      + this.renderPriceHistoryCard(prods)
      + '</div>';
    this.wireEdit();
    if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
  },

  editCard(v) {
    return '<div class="card form-card">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
        + '<span>Editing ' + esc(v.name) + '</span>'
        + '<span style="display:flex;align-items:center;gap:10px;">'
          + '<span id="iv-err" style="color:var(--red);font-size:12px;display:none;text-transform:none;letter-spacing:0;font-weight:400;"></span>'
          + '<button class="btn btn-primary btn-sm" id="iv-save">Update Vendor</button>'
        + '</span>'
      + '</div>'
      + this.formFieldsHTML(v)
      + '</div>';
  },

  wireEdit() {
    this.container.onclick = ev => {
      if (ev.target.closest('#iv-save')) { this.saveVendor(); return; }
    };
  },

  renderProductsCard(prods) {
    const heading = '<div class="sh" style="margin-top:24px;">Products from this Vendor</div>';
    if (prods.length === 0) {
      return heading + '<div style="font-size:12px;color:var(--t3);">No products are linked to this vendor yet. '
        + 'Set the Primary Vendor field on a product in the Products screen.</div>';
    }
    return heading + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Category</th><th>Unit Cost</th>'
      + '</tr></thead><tbody>'
      + prods.map(p => '<tr><td><div class="val">' + esc(p.name) + '</div></td>'
          + '<td>' + esc(p.category || '-') + '</td>'
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
