'use strict';

/* ── Inventory Control — Locations (ic_locations) ─────────────────────────────
   User-defined storage locations. Products in ic_products reference a location
   by name via locations[] (a product can live in several). The first location a
   product is placed in becomes its primary_location (ordering/transfer home),
   derived automatically. Stored in App.inventoryData.

   Landing-form pattern: the add form (name + type + product checklist, one Save)
   lives on the landing above the locations list. Editing a location opens its
   own page — name/type plus the product list with drag-to-order and inline
   add/remove. Cancel exits back to the landing. */

S.InventoryLocations = {
  editId: null,
  DEFAULTS: ['Front Bar', 'Back Bar', 'Walk-In Cooler', 'Dry Storage', 'Office Storage'],
  BAR_CATS: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer'],

  locations() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_locations)) App.inventoryData.ic_locations = [];
    return App.inventoryData.ic_locations;
  },
  locationById(id) { return this.locations().find(l => l.id === id); },
  products() { return (App.inventoryData && App.inventoryData.ic_products) || []; },
  productCount(name) { return this.products().filter(p => App.productLocations(p).includes(name)).length; },

  // Which categories a location of a given type stocks.
  typeAllows(type) {
    if (type === 'bar')     return c => this.BAR_CATS.includes(c);
    if (type === 'kitchen') return c => !this.BAR_CATS.includes(c);
    return () => true;
  },
  typeProducts(type) {
    const ok = this.typeAllows(type);
    return this.products().filter(p => p.active !== false && ok(p.category))
      .slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  },
  typeLabel(t) { return t === 'bar' ? 'Bar' : t === 'kitchen' ? 'Kitchen' : 'Bar & Kitchen'; },

  // ── Entry ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    this.editId = null;
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Locations Work', [
      { p: ['Locations are the places you keep product: your bars, coolers, and storerooms. Set them up here, then assign which products live in each one. Take Inventory walks you through one location at a time, counting the products you put there in the order you arrange them.'] },
      { h: 'Add A Location', p: ['Name the spot, choose whether it holds bar product, kitchen product, or both, and check off the products stored there. Bar Cop only shows the products that match the type, so a bar location never lists food. Save and it is ready to count.'] },
      { h: 'Arrange For Counting', p: ['Open a location to drag its products into the order they sit on the shelf or rail. Counting follows that order, so the count sheet matches the way you actually walk the room. Reorder the locations themselves on the main list to set which one you count first.'] },
      { h: 'A Product Can Live In Several Places', p: ['Stock the same product in more than one location and it shows up at each during a count. The first location you put it in becomes its home for ordering. A product not yet placed anywhere is flagged "Needs a location" on the Products screen, because it will not be counted until it has one.'] }
    ]);
  },

  // ── Landing: add form on top, locations list below ─────────────────────────
  renderList() {
    this.actions.innerHTML = '';
    this.editId = null;
    const locs = this.locations();
    const active = locs.filter(l => !l.archived);
    const archived = locs.filter(l => l.archived);

    let listSection;
    if (!locs.length) {
      listSection = '<div style="margin-top:18px;font-size:12px;color:var(--t3);">No locations yet. Add one above, or '
        + '<button class="btn btn-ghost btn-sm" id="il-add-defaults">add the suggested defaults</button>.</div>';
    } else {
      const rows = active.map(l => {
        const n = this.productCount(l.name);
        return '<tr data-id="' + esc(l.id) + '">'
          + DragReorder.handleCellHTML()
          + '<td><button class="il-open" data-id="' + l.id + '" style="padding:0;border:none;background:none;color:var(--gold);font-weight:700;font-size:13px;cursor:pointer;">' + esc(l.name) + '</button></td>'
          + '<td>' + esc(this.typeLabel(l.type)) + '</td>'
          + '<td>' + n + ' product' + (n === 1 ? '' : 's') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm il-edit" data-id="' + l.id + '">Edit</button>'
          + '<button class="btn btn-ghost btn-sm il-archive" data-id="' + l.id + '" style="color:var(--red);">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      listSection = '<div class="card" style="margin-top:18px;"><div class="card-title">Your Locations</div>'
        + (active.length
            ? '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">Drag the &#x2630; handle to set the order operators count locations in.</div>'
              + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
              + '<th style="width:32px;"></th><th>Location</th><th>Holds</th><th>Products</th><th></th>'
              + '</tr></thead><tbody id="il-loc-body">' + rows + '</tbody></table></div>'
            : '<div style="font-size:12px;color:var(--t3);">No active locations.</div>')
        + (archived.length
            ? '<div class="sh" style="margin:20px 0 8px;">Deleted</div>'
              + '<div style="font-size:11px;color:var(--t3);margin-bottom:8px;">Restore any of these to bring them back. Product assignments are preserved.</div>'
              + archived.map(l => '<div style="display:flex;align-items:center;justify-content:space-between;opacity:0.7;font-size:12px;padding:6px 0;border-bottom:1px solid var(--b1);">'
                  + '<span>' + esc(l.name) + ' &middot; ' + this.productCount(l.name) + ' products</span>'
                  + '<button class="btn btn-ghost btn-sm il-unarchive" data-id="' + l.id + '">Restore</button></div>').join('')
            : '')
        + '</div>';
    }

    this.container.innerHTML = '<div class="screen">' + this.addFormCard() + listSection + '</div>';
    this.wireList();
  },

  addFormCard() {
    return '<div class="card">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
        + '<span>Add a Location</span>'
        + '<button class="btn btn-ghost btn-sm" id="il-how">How This Works</button>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:14px;flex-wrap:wrap;align-items:flex-end;">'
        + '<div class="f" style="width:240px;flex-shrink:0;"><label>Location Name</label>'
          + '<input type="text" id="il-new-name" placeholder="Walk-In Cooler"/></div>'
        + '<div class="f" style="width:180px;flex-shrink:0;"><label>What’s stored here ' + tt('il-type') + '</label>'
          + '<select id="il-new-type"><option value="both">Bar &amp; Kitchen</option><option value="bar">Bar only</option><option value="kitchen">Kitchen only</option></select></div>'
      + '</div>'
      + '<div class="sh" style="margin-top:4px;">Products Stored Here</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:8px;">Check the products kept at this location. The list matches the type above. You can change these any time by editing the location.</div>'
      + '<div id="il-new-products">' + this.checklistHTML('', 'both') + '</div>'
      + '<div class="card-actions" style="margin-top:14px;">'
        + '<button class="btn btn-primary" id="il-new-save">Save Location</button>'
        + '<button class="btn btn-ghost" id="il-new-clear">Clear</button>'
        + '<span id="il-new-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
  },

  // Product checklist for a location type. checkedFor (a location name) pre-checks
  // products already in that location; '' (add form) starts all unchecked.
  checklistHTML(checkedFor, type) {
    const prods = this.typeProducts(type);
    if (!prods.length) {
      return '<div style="font-size:12px;color:var(--t4);">No matching products yet. Add products on the Products screen first, then assign them here.</div>';
    }
    return '<div style="max-height:280px;overflow:auto;border:1px solid var(--b1);border-radius:6px;">'
      + prods.map(p => {
        const inLoc = checkedFor && App.productLocations(p).includes(checkedFor);
        return '<label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-bottom:1px solid var(--b1);font-size:13px;color:var(--t1);cursor:pointer;">'
          + '<input type="checkbox" class="il-cb" value="' + esc(p.id) + '"' + (inLoc ? ' checked' : '') + ' style="accent-color:var(--gold);width:15px;height:15px;"/>'
          + '<span style="flex:1;">' + esc(p.name) + '</span>'
          + '<span style="font-size:10px;color:var(--t3);">' + esc(p.category || '') + '</span></label>';
      }).join('')
      + '</div>';
  },

  wireList() {
    this.container.onclick = ev => {
      const how  = ev.target.closest('#il-how');
      const save = ev.target.closest('#il-new-save');
      const clr  = ev.target.closest('#il-new-clear');
      const open = ev.target.closest('.il-open');
      const edit = ev.target.closest('.il-edit');
      const arch = ev.target.closest('.il-archive');
      const un   = ev.target.closest('.il-unarchive');
      const addD = ev.target.closest('#il-add-defaults');
      if (how)       this.showHowTo();
      else if (save) this.saveNewLocation();
      else if (clr)  this.renderList();
      else if (open) this.openEdit(open.dataset.id);
      else if (edit) this.openEdit(edit.dataset.id);
      else if (arch) this.confirmDelete(arch.dataset.id);
      else if (un)   this.setArchived(un.dataset.id, false);
      else if (addD) this.addDefaults();
    };
    // Type change re-renders the add checklist (keeps the name input as typed).
    this.container.onchange = ev => {
      if (ev.target.id === 'il-new-type') {
        const el = document.getElementById('il-new-products');
        if (el) el.innerHTML = this.checklistHTML('', ev.target.value);
      }
    };
    const body = document.getElementById('il-loc-body');
    if (body) DragReorder.wire({ container: body, rowSelector: 'tr[data-id]', handleSelector: '.dr-handle', onCommit: ids => this._persistLocationOrder(ids) });
  },

  async saveNewLocation() {
    const name = document.getElementById('il-new-name')?.value.trim();
    const type = document.getElementById('il-new-type')?.value || 'both';
    const err = document.getElementById('il-new-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (!name) { fail('Enter a location name.'); return; }
    if (this.locations().some(l => l.name.toLowerCase() === name.toLowerCase())) { fail('A location with that name already exists.'); return; }

    this.locations().push({ id: App.uid(), name, type, archived: false });
    // Assign the checked products to the new location in one step.
    const checked = new Set([...this.container.querySelectorAll('.il-cb')].filter(cb => cb.checked).map(cb => cb.value));
    if (checked.size) {
      this.products().forEach(p => {
        if (!checked.has(p.id)) return;
        const set = new Set(App.productLocations(p)); set.add(name);
        p.locations = [...set];
        if (!p.primary_location || !p.locations.includes(p.primary_location)) p.primary_location = p.locations[0];
      });
    }
    const btn = document.getElementById('il-new-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveInventory();
    if (ok) { App.markSetupDone('gs_ic_locations'); this.renderList(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Save Location'; } fail('Save failed. Try again.'); }
  },

  // ── Edit page (own page; cohesive name + products; Cancel exits to landing) ─
  openEdit(id) {
    const l = this.locationById(id);
    if (!l) { this.renderList(); return; }
    this.editId = id;
    this.actions.innerHTML = '';
    this.container.innerHTML = '<div class="screen">' + this.editCard(l) + '</div>';
    this.wireEdit(l);
  },

  editCard(l) {
    const type = l.type || 'both';
    const assigned = this.sortedProductsForLocation(l.name);
    const assignedIds = new Set(assigned.map(p => p.id));
    const addable = this.typeProducts(type).filter(p => !assignedIds.has(p.id));

    const assignedTbl = assigned.length
      ? '<div style="font-size:11px;color:var(--t3);margin-bottom:8px;">Drag the &#x2630; handle to set the order Take Inventory counts these in.</div>'
        + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
        + '<th style="width:32px;"></th><th style="width:30px;">#</th><th>Product</th><th>Category</th><th></th>'
        + '</tr></thead><tbody id="il-arrange-body">'
        + assigned.map((p, i) => '<tr data-id="' + esc(p.id) + '">'
            + DragReorder.handleCellHTML()
            + '<td style="color:var(--t4);font-size:11px;">' + (i + 1) + '</td>'
            + '<td><div class="val">' + esc(p.name) + '</div>' + (p.brand ? '<div style="font-size:10px;color:var(--t3);">' + esc(p.brand) + '</div>' : '') + '</td>'
            + '<td>' + esc(p.category || '-') + '</td>'
            + '<td><button class="btn btn-ghost btn-sm il-remove" data-id="' + esc(p.id) + '" style="color:var(--red);">Remove</button></td>'
            + '</tr>').join('')
        + '</tbody></table></div>'
      : '<div style="font-size:12px;color:var(--t3);margin-bottom:4px;">No products here yet. Check products below to add them.</div>';

    const addSection = addable.length
      ? '<div class="sh" style="margin:18px 0 8px;">Add Products</div>'
        + '<div style="max-height:240px;overflow:auto;border:1px solid var(--b1);border-radius:6px;">'
        + addable.map(p => '<label style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-bottom:1px solid var(--b1);font-size:13px;color:var(--t1);cursor:pointer;">'
            + '<input type="checkbox" class="il-add-cb" value="' + esc(p.id) + '" style="accent-color:var(--gold);width:15px;height:15px;"/>'
            + '<span style="flex:1;">' + esc(p.name) + '</span><span style="font-size:10px;color:var(--t3);">' + esc(p.category || '') + '</span></label>').join('')
        + '</div>'
        + '<div style="margin-top:10px;"><button class="btn btn-ghost btn-sm" id="il-add-checked">+ Add checked products</button></div>'
      : '';

    return '<div class="card">'
      + '<div class="card-title">Editing ' + esc(l.name) + '</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end;">'
        + '<div class="f" style="width:240px;flex-shrink:0;"><label>Location Name</label><input type="text" id="il-name" value="' + esc(l.name) + '"/></div>'
        + '<div class="f" style="width:180px;flex-shrink:0;"><label>What’s stored here ' + tt('il-type') + '</label>'
          + '<select id="il-type"><option value="both"' + (type === 'both' ? ' selected' : '') + '>Bar &amp; Kitchen</option><option value="bar"' + (type === 'bar' ? ' selected' : '') + '>Bar only</option><option value="kitchen"' + (type === 'kitchen' ? ' selected' : '') + '>Kitchen only</option></select></div>'
        + '<div style="flex:1;min-width:10px;"></div>'
        + '<button class="btn btn-primary" id="il-save">Update Location</button>'
        + '<button class="btn btn-ghost" id="il-cancel">Cancel</button>'
        + '<span id="il-err" style="color:var(--red);font-size:12px;display:none;"></span>'
      + '</div>'
      + '<div class="sh" style="margin-top:4px;">Products In This Location</div>'
      + assignedTbl
      + addSection
      + '</div>';
  },

  wireEdit(l) {
    this.container.onchange = null;
    this.container.onclick = ev => {
      if (ev.target.closest('#il-cancel'))      { this.editId = null; this.renderList(); return; }
      if (ev.target.closest('#il-save'))        { this.saveLocationEdit(l.id); return; }
      if (ev.target.closest('#il-add-checked')) { this.addCheckedProducts(l.name); return; }
      const rm = ev.target.closest('.il-remove'); if (rm) { this.removeProduct(l.name, rm.dataset.id); return; }
    };
    document.getElementById('il-name')?.addEventListener('keydown', e => { if (e.key === 'Enter') this.saveLocationEdit(l.id); });
    const ab = document.getElementById('il-arrange-body');
    if (ab) DragReorder.wire({ container: ab, rowSelector: 'tr[data-id]', handleSelector: '.dr-handle', onCommit: ids => this._persistProductOrder(l.name, ids) });
  },

  async saveLocationEdit(id) {
    const name = document.getElementById('il-name')?.value.trim();
    const type = document.getElementById('il-type')?.value || 'both';
    const err  = document.getElementById('il-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (!name) { fail('Location name required.'); return; }
    if (this.locations().some(l => l.id !== id && l.name.toLowerCase() === name.toLowerCase())) { fail('That name already exists.'); return; }
    const l = this.locationById(id);
    if (l) {
      const old = l.name;
      l.name = name;
      l.type = type;
      if (old !== name) {
        this.products().forEach(p => {
          if (p.primary_location === old)   p.primary_location = name;
          if (p.secondary_location === old) p.secondary_location = name;
          if (Array.isArray(p.locations))   p.locations = p.locations.map(x => x === old ? name : x);
          if (p.location_sequences && p.location_sequences[old] != null) {
            p.location_sequences[name] = p.location_sequences[old];
            delete p.location_sequences[old];
          }
        });
      }
    }
    await App.saveInventory();
    App.markSetupDone('gs_ic_locations');
    this.openEdit(id);
  },

  async addCheckedProducts(locName) {
    const checked = new Set([...this.container.querySelectorAll('.il-add-cb')].filter(cb => cb.checked).map(cb => cb.value));
    if (!checked.size) return;
    this.products().forEach(p => {
      if (!checked.has(p.id)) return;
      const set = new Set(App.productLocations(p)); set.add(locName);
      p.locations = [...set];
      if (!p.primary_location || !p.locations.includes(p.primary_location)) p.primary_location = p.locations[0];
    });
    await App.saveInventory();
    this.openEdit(this.editId);
  },

  async removeProduct(locName, pid) {
    const p = this.products().find(x => x.id === pid);
    if (!p) return;
    p.locations = App.productLocations(p).filter(x => x !== locName);
    if (p.primary_location === locName) p.primary_location = p.locations[0] || '';
    if (p.location_sequences) delete p.location_sequences[locName];
    await App.saveInventory();
    this.openEdit(this.editId);
  },

  // ── Delete / archive / defaults ────────────────────────────────────────────
  confirmDelete(id) {
    const l = this.locations().find(x => x.id === id);
    if (!l) return;
    const n = this.productCount(l.name);
    const m = document.createElement('div');
    m.id = 'il-del-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;padding:40px 20px;background:rgba(0,0,0,0.65);';
    const productNote = n > 0
      ? '<div style="font-size:12px;color:var(--gold);line-height:1.7;margin-bottom:18px;background:var(--surface);border:1px solid var(--b1);border-radius:4px;padding:10px 12px;">'
        + n + ' product' + (n === 1 ? ' is' : 's are') + ' assigned to this location. Their assignment stays in place but the location is hidden from new flows (Take Inventory, Set Locations). Restore anytime.'
        + '</div>'
      : '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:18px;">No products are assigned here. Restore anytime from the Deleted section if you change your mind.</div>';
    m.innerHTML = '<div style="background:var(--bg);border:1px solid var(--b1);border-radius:8px;max-width:480px;width:100%;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,0.55);">'
      + '<div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--w);margin-bottom:14px;">Delete ' + esc(l.name) + '?</div>'
      + productNote
      + '<div style="display:flex;justify-content:flex-end;gap:10px;">'
        + '<button type="button" id="il-del-cancel" class="btn btn-ghost">Cancel</button>'
        + '<button type="button" id="il-del-confirm" class="btn btn-danger">Delete</button>'
      + '</div></div>';
    document.body.appendChild(m);
    const close = () => m.remove();
    m.addEventListener('click', ev => { if (ev.target === m) close(); });
    document.getElementById('il-del-cancel').addEventListener('click', close);
    document.getElementById('il-del-confirm').addEventListener('click', () => { close(); this.setArchived(id, true); });
  },

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
    const add = this.DEFAULTS.filter(n => !have.includes(n.toLowerCase()))
      .map(n => ({ id: App.uid(), name: n, type: 'both', archived: false }));
    if (add.length) { this.locations().push(...add); await App.saveInventory(); }
    this.renderList();
  },

  // Sort a location's products by their per-location sequence, then by name.
  sortedProductsForLocation(locationName) {
    const list = this.products().filter(p => App.productLocations(p).includes(locationName));
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
    this.openEdit(this.editId);
  }
};
