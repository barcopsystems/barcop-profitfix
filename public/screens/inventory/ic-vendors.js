'use strict';

/* ── Inventory Control — Vendors (ic_vendors) ─────────────────────────────────
   Distributor / supplier contacts and terms. Products in ic_products reference
   a vendor by name. Vendor pricing auto-feeds Profit Recovery Vendor Watch.
   Stored in App.inventoryData (ic_data table). */

S.InventoryVendors = {
  detailId: null,
  profileMode: 'view',
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

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = 'Add Vendor';
    addBtn.addEventListener('click', () => this.renderUnified(null, 'edit'));
    actions.appendChild(addBtn);
    this.renderList();
  },

  renderList() {
    const vendors = this.vendors();
    let html;

    if (vendors.length === 0) {
      html = '<div class="empty"><div class="empty-title">No vendors yet</div>'
        + '<div class="empty-sub">Add the distributors and suppliers you order from. '
        + 'Products link to a vendor, and vendor pricing feeds Profit Recovery Vendor Watch.</div>'
        + '<div style="display:flex;gap:10px;justify-content:center;">'
        + '<button class="btn btn-primary" id="iv-add-first">Add Vendor</button></div></div>';
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
          + '<button class="btn btn-danger btn-sm iv-del" data-id="' + v.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      html = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Vendor</th><th>Rep</th><th>Phone</th><th>Terms</th><th>Products</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="iv-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:360px;width:90%;text-align:center;">'
      + '<div id="iv-del-msg" style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this vendor?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="iv-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="iv-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      const open = ev.target.closest('.iv-open');
      const edit = ev.target.closest('.iv-edit');
      const del  = ev.target.closest('.iv-del');
      const addF = ev.target.closest('#iv-add-first');
      if (open)      this.renderUnified(open.dataset.id, 'view');
      else if (edit) this.renderUnified(edit.dataset.id, 'edit');
      else if (del)  this.confirmDel(del.dataset.id);
      else if (addF) this.renderUnified(null, 'edit');
    };
  },

  // Unified vendor detail page. profileMode 'view' renders Vendor Details as
  // labeled rows with an Edit button; 'edit' renders inputs with Save/Cancel.
  // Products + Recent Price Changes cards render on both modes, so the operator
  // sees every section on first open. For a new vendor (vendorId null) those
  // cards show empty-state messaging until the profile saves.
  renderUnified(vendorId, profileMode) {
    profileMode = profileMode || 'view';
    const isNew = !vendorId;
    const v = isNew ? null : this.vendorById(vendorId);
    if (!isNew && !v) { this.renderList(); return; }

    this.detailId = vendorId || null;
    this.profileMode = profileMode;

    const detailsCard = (profileMode === 'edit')
      ? this.renderDetailsEditCard(v, isNew)
      : this.renderDetailsViewCard(v);
    const prods = isNew ? [] : this.vendorProducts(v.name);
    const productsCard = isNew
      ? '<div class="card"><div class="card-title">Products from this Vendor</div>'
        + '<div style="font-size:12px;color:var(--t3);">Save the vendor above first. Once the record exists, every product you set this vendor as the Primary Vendor on will appear here.</div></div>'
      : this.renderProductsCard(prods);
    const priceCard = isNew
      ? '<div class="card"><div class="card-title">Recent Price Changes</div>'
        + '<div style="font-size:12px;color:var(--t3);">Save the vendor above first. Price changes get logged here automatically when you apply cost updates in Receive Delivery.</div></div>'
      : this.renderPriceHistoryCard(prods);

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="iv-back">&laquo; Back to Vendors</button></div>'
      + '<div style="font-size:15px;font-weight:800;color:var(--t1);margin-bottom:14px;">' + esc(isNew ? 'Add Vendor' : v.name) + '</div>'
      + detailsCard + productsCard + priceCard
      + '</div>';
    this.wireUnified(vendorId, profileMode);
  },

  // Backwards-compat aliases — any caller that still references the old
  // method names routes into the unified page.
  showDetail(id) { this.renderUnified(id, 'view'); },
  showForm(id) { this.renderUnified(id || null, 'edit'); },

  renderDetailsViewCard(v) {
    const info = (label, val) =>
      '<div style="display:flex;padding:8px 0;border-bottom:1px solid var(--b2);">'
      + '<div style="width:150px;flex-shrink:0;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);padding-top:2px;">' + label + '</div>'
      + '<div style="font-size:13px;color:var(--t2);">' + esc(val || '-') + '</div></div>';
    return '<div class="card"><div class="card-title">Vendor Details</div>'
      + info('Rep', v.rep) + info('Phone', v.phone) + info('Email', v.email)
      + info('Delivery Days', v.delivery_days) + info('Payment Terms', v.payment_terms)
      + info('Account #', v.account_number) + info('Notes', v.notes)
      + '<div class="card-actions">'
        + '<button class="btn btn-primary btn-sm iv-edit-profile">Edit Vendor</button>'
      + '</div></div>';
  },

  renderDetailsEditCard(v, isNew) {
    const termOpts = this.TERMS.map(t =>
      '<option value="' + t + '"' + (v && v.payment_terms === t ? ' selected' : '') + '>' + (t || '-') + '</option>').join('');
    return '<div class="card"><div class="card-title">' + (isNew ? 'New Vendor' : 'Edit Vendor') + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f w-lg"><label>Vendor Name</label><input type="text" id="iv-name" value="' + esc(v?.name || '') + '" placeholder="Republic National"/></div>'
      + '<div class="f w-md"><label>Rep Name</label><input type="text" id="iv-rep" value="' + esc(v?.rep || '') + '" placeholder="Sales rep"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f w-md"><label>Phone</label><input type="text" id="iv-phone" value="' + esc(v?.phone || '') + '" placeholder="(555) 123-4567"/></div>'
      + '<div class="f w-lg"><label>Email</label><input type="email" id="iv-email" value="' + esc(v?.email || '') + '" placeholder="rep@distributor.com"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f w-md"><label>Delivery Days</label><input type="text" id="iv-days" value="' + esc(v?.delivery_days || '') + '" placeholder="Mon, Thu"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Payment Terms</label><select id="iv-terms">' + termOpts + '</select></div>'
      + '<div class="f w-md"><label>Account #</label><input type="text" id="iv-account" value="' + esc(v?.account_number || '') + '" placeholder="Account number"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="iv-notes" rows="2" placeholder="Optional">' + esc(v?.notes || '') + '</textarea></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="iv-save">' + (isNew ? 'Save Vendor' : 'Update Vendor') + '</button>'
      + '<button class="btn btn-ghost" id="iv-cancel">Cancel</button>'
      + '<span id="iv-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
  },

  renderProductsCard(prods) {
    return '<div class="card"><div class="card-title">Products from this Vendor</div>'
      + (prods.length === 0
          ? '<div style="font-size:12px;color:var(--t3);">No products are linked to this vendor yet. '
            + 'Set the Primary Vendor field on a product in the Products screen.</div>'
          : '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
            + '<th>Product</th><th>Category</th><th>Unit Cost</th>'
            + '</tr></thead><tbody>'
            + prods.map(p => '<tr><td><div class="val">' + esc(p.name) + '</div></td>'
                + '<td>' + esc(p.category || '-') + '</td>'
                + '<td>' + (p.unit_cost != null ? App.fmtCurrency(p.unit_cost) : '<span style="color:var(--t4);">-</span>') + '</td></tr>').join('')
            + '</tbody></table></div>')
      + '</div>';
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
      const sign = delta >= 0 ? '+' : '';
      const cls = delta > 0 ? 'neg' : delta < 0 ? 'pos' : '';
      return '<span class="' + cls + '">' + sign + App.fmtCurrency(delta) + ' (' + sign + pct.toFixed(1) + '%)</span>';
    };
    const fmtDate = str => {
      if (!str) return '-';
      const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
      return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return '<div class="card"><div class="card-title">Recent Price Changes</div>'
      + (recent.length === 0
        ? '<div style="font-size:12px;color:var(--t3);">No price changes recorded yet for this vendor. '
          + 'Bar Cop logs every cost change automatically when you apply price updates in Receive Delivery.</div>'
        : '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
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
          + '</tbody></table></div>'
          + '<div style="font-size:10px;color:var(--t3);margin-top:8px;">Same data feeds Profit Recovery Vendor Watch and the Vendor Scorecard.</div>')
      + '</div>';
  },

  wireUnified(vendorId, profileMode) {
    this.container.onclick = null;
    document.getElementById('iv-back')?.addEventListener('click', () => { this.detailId = null; this.renderList(); });
    this.container.querySelector('.iv-edit-profile')?.addEventListener('click', () => this.renderUnified(vendorId, 'edit'));
    document.getElementById('iv-cancel')?.addEventListener('click', () => {
      if (vendorId) this.renderUnified(vendorId, 'view');
      else { this.detailId = null; this.renderList(); }
    });
    document.getElementById('iv-save')?.addEventListener('click', () => this.saveVendor(vendorId));
    if (profileMode === 'edit') document.getElementById('iv-name')?.focus();
  },

  async saveVendor(vendorId) {
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
      this.renderUnified(savedId, 'view');
    } else {
      if (btn) { btn.disabled = false; btn.textContent = vendorId ? 'Update Vendor' : 'Save Vendor'; }
      fail('Save failed. Try again.');
    }
  },

  // ── Delete ────────────────────────────────────────────────────────────────
  confirmDel(id) {
    const v = this.vendors().find(x => x.id === id);
    if (!v) return;
    this._pendingDelId = id;
    const n = this.vendorProducts(v.name).length;
    const modal = document.getElementById('iv-del-modal');
    const msgEl = document.getElementById('iv-del-msg');
    if (msgEl) msgEl.innerHTML = 'Delete <strong>' + esc(v.name) + '</strong>?'
      + (n ? '<div style="font-size:11px;font-weight:600;color:var(--t3);margin-top:6px;">'
        + n + ' product' + (n === 1 ? '' : 's') + ' reference this vendor and will keep the vendor name.</div>' : '');
    if (modal) modal.style.display = 'flex';
    document.getElementById('iv-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('iv-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.inventoryData.ic_vendors = this.vendors().filter(x => x.id !== delId);
      await App.saveInventory();
      this.renderList();
    };
  },

};
