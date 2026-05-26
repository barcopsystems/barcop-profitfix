'use strict';

/* ── Inventory Control — Locations (ic_locations) ─────────────────────────────
   User-defined storage locations. Products in ic_products reference a location
   by name (Primary / Secondary Location). Stored in App.inventoryData. */

S.InventoryLocations = {
  editId: null,
  DEFAULTS: ['Front Bar', 'Back Bar', 'Walk-In Cooler', 'Dry Storage', 'Office Storage'],

  locations() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_locations)) App.inventoryData.ic_locations = [];
    return App.inventoryData.ic_locations;
  },
  products() { return (App.inventoryData && App.inventoryData.ic_products) || []; },
  productCount(name) {
    return this.products().filter(p => p.primary_location === name || p.secondary_location === name).length;
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = 'Add Location';
    addBtn.addEventListener('click', () => this.showForm());
    actions.appendChild(addBtn);
    this.renderList();
  },

  renderList() {
    const locs = this.locations();
    const active = locs.filter(l => !l.archived);
    const archived = locs.filter(l => l.archived);
    let html;

    if (locs.length === 0) {
      html = '<div class="empty"><div class="empty-title">No locations yet</div>'
        + '<div class="empty-sub">Add the storage areas where you keep product: bars, coolers, storerooms. '
        + 'Products are assigned to these locations, and inventory counts are organized by them.</div>'
        + '<div style="display:flex;gap:10px;justify-content:center;">'
        + '<button class="btn btn-primary" id="il-add-first">Add Location</button>'
        + '<button class="btn btn-ghost" id="il-add-defaults">Add Suggested Defaults</button>'
        + '</div></div>';
    } else {
      const rows = active.map(l => {
        const n = this.productCount(l.name);
        return '<tr data-id="' + esc(l.id) + '">'
          + DragReorder.handleCellHTML()
          + '<td><button class="il-open" data-id="' + l.id + '" '
          + 'style="padding:0;border:none;background:none;color:var(--gold);font-weight:700;font-size:13px;cursor:pointer;">'
          + esc(l.name) + '</button></td>'
          + '<td>' + n + ' product' + (n === 1 ? '' : 's') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm il-arrange" data-id="' + l.id + '">Arrange Products</button>'
          + '<button class="btn btn-ghost btn-sm il-edit" data-id="' + l.id + '">Edit</button>'
          + '<button class="btn btn-ghost btn-sm il-archive" data-id="' + l.id + '" style="color:var(--red);">Delete</button>'
          + '</div></td></tr>';
      }).join('');

      html = '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.6;">'
        + 'Drag the &#x2630; handle on the left to reorder locations. This is the order operators see when picking locations to count.'
        + '</div>'
        + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
        + '<th style="width:32px;"></th><th>Location</th><th>Assigned Products</th><th></th>'
        + '</tr></thead><tbody id="il-loc-body">' + rows + '</tbody></table></div>';

      if (archived.length) {
        html += '<div class="sh" style="margin:24px 0 8px;">Deleted</div>'
          + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">Restore any of these to bring them back. Product assignments are preserved.</div>'
          + '<div class="tbl-wrap"><table class="tbl"><tbody>'
          + archived.map(l => '<tr style="opacity:0.55;">'
              + '<td style="font-weight:700;color:var(--t2);">' + esc(l.name) + '</td>'
              + '<td>' + this.productCount(l.name) + ' products</td>'
              + '<td><div class="row-actions">'
              + '<button class="btn btn-ghost btn-sm il-unarchive" data-id="' + l.id + '">Restore</button>'
              + '</div></td></tr>').join('')
          + '</tbody></table></div>';
      }
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.container.onclick = ev => {
      const open = ev.target.closest('.il-open');
      const arr  = ev.target.closest('.il-arrange');
      const edit = ev.target.closest('.il-edit');
      const arch = ev.target.closest('.il-archive');
      const un   = ev.target.closest('.il-unarchive');
      const addF = ev.target.closest('#il-add-first');
      const addD = ev.target.closest('#il-add-defaults');
      if (open)      this.showDetail(open.dataset.id);
      else if (arr)  this.showDetail(arr.dataset.id);
      else if (edit) this.showForm(edit.dataset.id);
      else if (arch) this.confirmDelete(arch.dataset.id);
      else if (un)   this.setArchived(un.dataset.id, false);
      else if (addF) this.showForm();
      else if (addD) this.addDefaults();
    };

    const body = document.getElementById('il-loc-body');
    if (body) {
      DragReorder.wire({
        container:      body,
        rowSelector:    'tr[data-id]',
        handleSelector: '.dr-handle',
        onCommit:       (newOrderIds) => this._persistLocationOrder(newOrderIds)
      });
    }
  },

  // Soft-delete a location. If products are assigned, prompt with a count so
  // the operator knows what they are about to disconnect. Soft-delete keeps
  // the record in the Deleted section for one-click restore.
  confirmDelete(id) {
    const l = this.locations().find(x => x.id === id);
    if (!l) return;
    const n = this.productCount(l.name);
    const m = document.createElement('div');
    m.id = 'il-del-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;padding:40px 20px;background:rgba(0,0,0,0.65);';
    const productNote = n > 0
      ? '<div style="font-size:12px;color:var(--gold);line-height:1.7;margin-bottom:18px;background:var(--surface);border:1px solid var(--b1);border-radius:4px;padding:10px 12px;">'
        + n + ' product' + (n === 1 ? ' is' : 's are') + ' assigned to this location. Their assignment stays in place but the location will be hidden from new flows (Take Inventory, Product Setup). Restore anytime to bring it back.'
        + '</div>'
      : '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:18px;">No products are assigned here. Restore anytime from the Deleted section if you change your mind.</div>';
    m.innerHTML = '<div style="background:var(--bg);border:1px solid var(--b1);border-radius:8px;max-width:480px;width:100%;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,0.55);">'
      + '<div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--w);margin-bottom:14px;">Delete ' + esc(l.name) + '?</div>'
      + productNote
      + '<div style="display:flex;justify-content:flex-end;gap:10px;">'
        + '<button type="button" id="il-del-cancel" class="btn btn-ghost">Cancel</button>'
        + '<button type="button" id="il-del-confirm" class="btn btn-danger">Delete</button>'
      + '</div>'
    + '</div>';
    document.body.appendChild(m);
    const close = () => m.remove();
    m.addEventListener('click', ev => { if (ev.target === m) close(); });
    document.getElementById('il-del-cancel').addEventListener('click', close);
    document.getElementById('il-del-confirm').addEventListener('click', () => {
      close();
      this.setArchived(id, true);
    });
  },

  // ── Archive / defaults ────────────────────────────────────────────────────
  async _persistLocationOrder(newActiveOrderIds) {
    const all = this.locations();
    const archived = all.filter(l => l.archived);
    const byId = new Map(all.map(l => [l.id, l]));
    const active = newActiveOrderIds.map(id => byId.get(id)).filter(Boolean);
    App.inventoryData.ic_locations = [...active, ...archived];
    await App.saveInventory();
    this.renderList();
  },

  async setArchived(id, val) {
    const l = this.locations().find(x => x.id === id);
    if (!l) return;
    l.archived = val;
    await App.saveInventory();
    this.renderList();
  },

  async addDefaults() {
    const have = this.locations().map(l => l.name.toLowerCase());
    const add = this.DEFAULTS
      .filter(n => !have.includes(n.toLowerCase()))
      .map(n => ({ id: App.uid(), name: n, archived: false }));
    if (add.length) {
      this.locations().push(...add);
      await App.saveInventory();
    }
    this.renderList();
  },

  // ── Add / edit form ───────────────────────────────────────────────────────
  showForm(id) {
    this.editId = id || null;
    const l = id ? this.locations().find(x => x.id === id) : null;
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'New') + ' Location</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f w-lg"><label>Location Name</label>'
      + '<input type="text" id="il-name" value="' + esc(l?.name || '') + '" placeholder="Walk-In Cooler"/></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="il-save">' + (id ? 'Update' : 'Save') + '</button>'
      + '<button class="btn btn-ghost" id="il-cancel">Cancel</button>'
      + '<span id="il-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';
    this.container.onclick = null;
    const nameEl = document.getElementById('il-name');
    nameEl?.focus();
    nameEl?.addEventListener('keydown', e => { if (e.key === 'Enter') this.save(); });
    document.getElementById('il-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('il-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const name = document.getElementById('il-name')?.value.trim();
    const err  = document.getElementById('il-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (!name) { fail('Location name required.'); return; }
    const dup = this.locations().some(l => l.id !== this.editId && l.name.toLowerCase() === name.toLowerCase());
    if (dup) { fail('A location with that name already exists.'); return; }

    if (this.editId) {
      const l = this.locations().find(x => x.id === this.editId);
      if (l) {
        const old = l.name;
        l.name = name;
        // Keep product location references in sync with the rename
        if (old !== name) {
          this.products().forEach(p => {
            if (p.primary_location === old)   p.primary_location = name;
            if (p.secondary_location === old) p.secondary_location = name;
          });
        }
      }
    } else {
      this.locations().push({ id: App.uid(), name, archived: false });
    }

    const btn = document.getElementById('il-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveInventory();
    this.editId = null;
    if (ok) {
      App.markSetupDone('gs_ic_locations');
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
      fail('Save failed. Try again.');
    }
  },

  // ── Location detail (products assigned here, in inventory-count order) ───
  // Products are shown in the order they will appear during Take Inventory
  // at this location. Operator drags rows by the grip handle on the left to
  // match the physical shelf/rail order so counting flows the way they walk
  // the bar instead of alphabetical.
  showDetail(id) {
    const l = this.locations().find(x => x.id === id);
    if (!l) { this.renderList(); return; }
    const prods = this.sortedProductsForLocation(l.name);

    let body;
    if (prods.length === 0) {
      body = '<div class="empty"><div class="empty-title">No products assigned here</div>'
        + '<div class="empty-sub">Assign products to ' + esc(l.name) + ' from the Products screen using the '
        + 'Primary Location field.</div></div>';
    } else {
      const rows = prods.map((p, i) => '<tr data-id="' + esc(p.id) + '">'
        + DragReorder.handleCellHTML()
        + '<td style="width:36px;color:var(--t4);font-size:11px;">' + (i + 1) + '</td>'
        + '<td><div class="val">' + esc(p.name) + '</div>'
        + (p.brand ? '<div style="font-size:10px;color:var(--t3);">' + esc(p.brand) + '</div>' : '') + '</td>'
        + '<td>' + esc(p.category || '-') + '</td>'
        + '<td>' + (p.par_level != null && p.par_level !== '' ? p.par_level : '<span style="color:var(--t4);">-</span>') + '</td>'
        + '</tr>').join('');
      body = '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.6;">'
        + 'Grab the &#x2630; handle on the left and drag a product up or down to put it where it sits on the shelf or rail at this location. Take Inventory at ' + esc(l.name) + ' will count them in this order.'
        + '</div>'
        + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
        + '<th style="width:32px;"></th><th style="width:36px;">#</th><th>Product</th><th>Category</th><th>Par</th>'
        + '</tr></thead><tbody id="il-arrange-body">' + rows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="il-back">&#8592; Back to Locations</button></div>'
      + '<div style="font-size:15px;font-weight:800;color:var(--t1);margin-bottom:14px;">' + esc(l.name) + '</div>'
      + body + '</div>';

    this.container.onclick = ev => {
      const back = ev.target.closest('#il-back');
      if (back) this.renderList();
    };

    if (prods.length) {
      const arrangeBody = document.getElementById('il-arrange-body');
      if (arrangeBody) {
        DragReorder.wire({
          container:      arrangeBody,
          rowSelector:    'tr[data-id]',
          handleSelector: '.dr-handle',
          onCommit:       (newOrderIds) => this._persistProductOrder(l.name, newOrderIds)
        });
      }
    }
  },

  // Sort products at a given location by their per-location sequence, then
  // by name. Products with no recorded sequence sort to the end so new
  // products do not jump above the operator's curated order.
  sortedProductsForLocation(locationName) {
    const list = this.products().filter(p => p.primary_location === locationName);
    return list.slice().sort((a, b) => {
      const sa = (a.location_sequences && a.location_sequences[locationName] != null) ? a.location_sequences[locationName] : Number.MAX_SAFE_INTEGER;
      const sb = (b.location_sequences && b.location_sequences[locationName] != null) ? b.location_sequences[locationName] : Number.MAX_SAFE_INTEGER;
      if (sa !== sb) return sa - sb;
      return (a.name || '').localeCompare(b.name || '');
    });
  },

  async _persistProductOrder(locationName, idsInOrder) {
    const prods = this.products();
    idsInOrder.forEach((pid, i) => {
      const p = prods.find(x => x.id === pid);
      if (!p) return;
      if (!p.location_sequences) p.location_sequences = {};
      p.location_sequences[locationName] = i + 1;
    });
    await App.saveInventory();
    this.showDetail((this.locations().find(l => l.name === locationName) || {}).id);
  }
};
