'use strict';

/* ── Inventory Control — Locations (ic_locations) ─────────────────────────────
   User-defined storage locations. Products in ic_products reference a location
   by name via locations[] (a product can live in several). The first location a
   product is placed in becomes its primary_location (ordering/transfer home);
   that primary is what the Add Product form pre-selects. Assigning a product to
   another location here never overwrites an existing primary. Stored in
   App.inventoryData.

   Landing-form pattern: the add form (name + a category-filtered product
   checklist, one Save) lives on the landing above the locations list. Category
   tabs filter the checklist so a bottle-beer cooler gets built without scrolling
   past liquor; checks accumulate across tabs and a running count shows the total.
   A location's "Holds" is derived from the categories of the products assigned to
   it. Editing a location opens its own page — name plus the product list with
   drag-to-order and the same category-filtered add box. Cancel exits to landing. */

S.InventoryLocations = {
  editId: null,
  newCat: 'All',
  newChecked: null,    // Set<pid> checked in the add form (persists across tabs)
  editCat: 'All',
  editChecked: null,   // Set<pid> checked in the edit "Add Products" box
  DEFAULTS: ['Front Bar', 'Back Bar', 'Walk-In Cooler', 'Dry Storage', 'Office Storage'],

  locations() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_locations)) App.inventoryData.ic_locations = [];
    return App.inventoryData.ic_locations;
  },
  locationById(id) { return this.locations().find(l => l.id === id); },
  products() { return (App.inventoryData && App.inventoryData.ic_products) || []; },
  productCount(name) { return this.products().filter(p => App.productLocations(p).includes(name)).length; },

  // Categories that have at least one active product, in canonical order.
  presentCats() {
    const have = new Set(this.products().filter(p => p.active !== false).map(p => p.category));
    return App.IC_CATEGORIES.filter(c => have.has(c));
  },
  // Active products in a category ('All' = every category), sorted by name.
  catProducts(cat) {
    return this.products()
      .filter(p => p.active !== false && (cat === 'All' || p.category === cat))
      .slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  },
  // Distinct categories of the products assigned to a location, canonical order.
  locationCats(name) {
    const have = new Set(this.products().filter(p => App.productLocations(p).includes(name)).map(p => p.category));
    return App.IC_CATEGORIES.filter(c => have.has(c));
  },
  // The "Holds" cell: the categories stored in this location, or Empty.
  holdsLabel(name) {
    const cats = this.locationCats(name);
    if (!cats.length) return '<span style="color:var(--t4);">Empty</span>';
    if (cats.length <= 3) return esc(cats.join(', '));
    return esc(cats.slice(0, 3).join(', ')) + ' <span style="color:var(--t3);">+' + (cats.length - 3) + '</span>';
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
    App.showHelpModal('How Locations Work', [
      { p: ['Locations are the places you keep product: your bars, coolers, and storerooms. Set them up here, then assign which products live in each one. Take Inventory walks you through one location at a time, counting the products you put there in the order you arrange them.'] },
      { h: 'Add A Location', p: ['Name the spot, then check off the products stored there. Use the category tabs to jump straight to liquor, wine, beer, or food so you are not scrolling past everything else. Your checks carry across the tabs and the running count shows how many you have picked. Save and it is ready to count.'] },
      { h: 'Arrange For Counting', p: ['Open a location to drag its products into the order they sit on the shelf or rail. Counting follows that order, so the count sheet matches the way you actually walk the room. Reorder the locations themselves on the main list to set which one you count first.'] },
      { h: 'A Product Can Live In Several Places', p: ['Stock the same product in more than one location and it shows up at each during a count. The first location you put it in becomes its home for ordering, which is the Primary Location the Add Product form fills in. A product not yet placed anywhere is flagged "Needs a location" on the Products screen, because it will not be counted until it has one.'] }
    ]);
  },

  // ── Shared: category tabs + checklist panel ────────────────────────────────
  catTabsHTML(activeCat, countFn) {
    const cats = ['All', ...this.presentCats()];
    return '<div class="rpt-tabs">'
      + cats.map(c => {
          const on = c === activeCat;
          const n = countFn(c);
          return '<button class="rpt-tab' + (on ? ' on' : '') + '" data-cat="' + esc(c) + '">'
            + esc(c) + (n ? ' <span style="opacity:0.55;">' + n + '</span>' : '') + '</button>';
        }).join('')
      + '</div>';
  },
  checklistPanelHTML(prods, checkedSet, cbClass, emptyMsg) {
    if (!prods.length) {
      return '<div class="rpt-panel" style="font-size:12px;color:var(--t4);">' + emptyMsg + '</div>';
    }
    return '<div class="rpt-panel" style="padding:0;overflow:hidden;">'
      + '<div style="max-height:280px;overflow:auto;">'
      + prods.map(p => '<label style="display:flex;align-items:center;gap:10px;padding:7px 14px;border-bottom:1px solid var(--b1);font-size:13px;color:var(--t1);cursor:pointer;">'
          + '<input type="checkbox" class="' + cbClass + '" value="' + esc(p.id) + '"' + (checkedSet.has(p.id) ? ' checked' : '') + ' style="accent-color:var(--gold);width:15px;height:15px;"/>'
          + '<span style="flex:1;">' + esc(p.name) + '</span>'
          + '<span style="font-size:10px;color:var(--t3);">' + esc(p.category || '') + '</span></label>').join('')
      + '</div></div>';
  },

  // ── Landing: add form on top, locations list below ─────────────────────────
  renderList() {
    this.actions.innerHTML = '';
    this.editId = null;
    this.newCat = 'All';
    this.newChecked = new Set();
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
          + '<td>' + this.holdsLabel(l.name) + '</td>'
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
      + '</div>'
      + '<div class="sh" style="margin-top:4px;">Products Stored Here</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:8px;">Check the products kept at this location. Use the category tabs to filter the list so you are not hunting through everything.</div>'
      + '<div id="il-new-filter">' + this.newFilterHTML() + '</div>'
      + '<div class="card-actions" style="margin-top:14px;align-items:center;">'
        + '<button class="btn btn-primary" id="il-new-save">Save Location</button>'
        + '<button class="btn btn-ghost" id="il-new-clear">Clear</button>'
        + '<span id="il-new-count" style="font-size:12px;color:var(--t3);margin-left:4px;">0 products selected</span>'
        + '<span id="il-new-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
  },

  newFilterHTML() {
    const prods = this.catProducts(this.newCat);
    return this.catTabsHTML(this.newCat, c => this.catProducts(c).length)
      + this.checklistPanelHTML(prods, this.newChecked, 'il-cb',
          'No matching products yet. Add products on the Products screen first, then assign them here.');
  },

  updateNewCount() {
    const el = document.getElementById('il-new-count');
    if (!el) return;
    const n = this.newChecked.size;
    el.textContent = n + ' product' + (n === 1 ? '' : 's') + ' selected';
  },

  wireList() {
    this.container.onclick = ev => {
      const tab = ev.target.closest('.rpt-tab');
      if (tab) {
        this.newCat = tab.dataset.cat;
        const el = document.getElementById('il-new-filter');
        if (el) el.innerHTML = this.newFilterHTML();
        return;
      }
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
    // Checkbox toggles accumulate into the running set so checks survive tab swaps.
    this.container.onchange = ev => {
      if (ev.target.classList && ev.target.classList.contains('il-cb')) {
        if (ev.target.checked) this.newChecked.add(ev.target.value);
        else this.newChecked.delete(ev.target.value);
        this.updateNewCount();
      }
    };
    const body = document.getElementById('il-loc-body');
    if (body) DragReorder.wire({ container: body, rowSelector: 'tr[data-id]', handleSelector: '.dr-handle', onCommit: ids => this._persistLocationOrder(ids) });
  },

  async saveNewLocation() {
    const name = document.getElementById('il-new-name')?.value.trim();
    const err = document.getElementById('il-new-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (!name) { fail('Enter a location name.'); return; }
    if (this.locations().some(l => l.name.toLowerCase() === name.toLowerCase())) { fail('A location with that name already exists.'); return; }

    this.locations().push({ id: App.uid(), name, archived: false });
    // Assign every checked product (across all category tabs) to the new location.
    const checked = this.newChecked;
    if (checked && checked.size) {
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

  // ── Edit page (own page; name + products; Cancel exits to landing) ──────────
  openEdit(id) {
    const l = this.locationById(id);
    if (!l) { this.renderList(); return; }
    this.editId = id;
    this.editCat = 'All';
    this.editChecked = new Set();
    this.actions.innerHTML = '';
    this.container.innerHTML = '<div class="screen">' + this.editCard(l) + '</div>';
    this.wireEdit(l);
  },

  editCard(l) {
    const assigned = this.sortedProductsForLocation(l.name);

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

    return '<div class="card">'
      + '<div class="card-title">Editing ' + esc(l.name) + '</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end;">'
        + '<div class="f" style="width:240px;flex-shrink:0;"><label>Location Name</label><input type="text" id="il-name" value="' + esc(l.name) + '"/></div>'
        + '<div style="flex:1;min-width:10px;"></div>'
        + '<button class="btn btn-primary" id="il-save">Update Location</button>'
        + '<button class="btn btn-ghost" id="il-cancel">Cancel</button>'
        + '<span id="il-err" style="color:var(--red);font-size:12px;display:none;"></span>'
      + '</div>'
      + '<div class="sh" style="margin-top:4px;">Products In This Location</div>'
      + assignedTbl
      + '<div class="sh" style="margin:18px 0 8px;">Add Products</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:8px;">Check products to add them to this location. Use the category tabs to filter.</div>'
      + '<div id="il-edit-filter">' + this.editAddFilterHTML(l.name) + '</div>'
      + '<div class="card-actions" style="margin-top:12px;align-items:center;">'
        + '<button class="btn btn-ghost btn-sm" id="il-add-checked">+ Add checked products</button>'
        + '<span id="il-edit-count" style="font-size:12px;color:var(--t3);margin-left:4px;">0 products selected</span>'
      + '</div>'
      + '</div>';
  },

  // The add box on the edit page: same tabs + checklist, scoped to products not
  // already in this location.
  editAddFilterHTML(locName) {
    const assignedIds = new Set(this.products().filter(p => App.productLocations(p).includes(locName)).map(p => p.id));
    const avail = c => this.catProducts(c).filter(p => !assignedIds.has(p.id));
    return this.catTabsHTML(this.editCat, c => avail(c).length)
      + this.checklistPanelHTML(avail(this.editCat), this.editChecked, 'il-add-cb',
          'Every matching product is already in this location.');
  },

  updateEditCount() {
    const el = document.getElementById('il-edit-count');
    if (!el) return;
    const n = this.editChecked.size;
    el.textContent = n + ' product' + (n === 1 ? '' : 's') + ' selected';
  },

  wireEdit(l) {
    this.container.onclick = ev => {
      const tab = ev.target.closest('.rpt-tab');
      if (tab) {
        this.editCat = tab.dataset.cat;
        const el = document.getElementById('il-edit-filter');
        if (el) el.innerHTML = this.editAddFilterHTML(l.name);
        return;
      }
      if (ev.target.closest('#il-cancel'))      { this.editId = null; this.renderList(); return; }
      if (ev.target.closest('#il-save'))        { this.saveLocationEdit(l.id); return; }
      if (ev.target.closest('#il-add-checked')) { this.addCheckedProducts(l.name); return; }
      const rm = ev.target.closest('.il-remove'); if (rm) { this.removeProduct(l.name, rm.dataset.id); return; }
    };
    this.container.onchange = ev => {
      if (ev.target.classList && ev.target.classList.contains('il-add-cb')) {
        if (ev.target.checked) this.editChecked.add(ev.target.value);
        else this.editChecked.delete(ev.target.value);
        this.updateEditCount();
      }
    };
    document.getElementById('il-name')?.addEventListener('keydown', e => { if (e.key === 'Enter') this.saveLocationEdit(l.id); });
    const ab = document.getElementById('il-arrange-body');
    if (ab) DragReorder.wire({ container: ab, rowSelector: 'tr[data-id]', handleSelector: '.dr-handle', onCommit: ids => this._persistProductOrder(l.name, ids) });
  },

  async saveLocationEdit(id) {
    const name = document.getElementById('il-name')?.value.trim();
    const err  = document.getElementById('il-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (!name) { fail('Location name required.'); return; }
    if (this.locations().some(l => l.id !== id && l.name.toLowerCase() === name.toLowerCase())) { fail('That name already exists.'); return; }
    const l = this.locationById(id);
    if (l) {
      const old = l.name;
      l.name = name;
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
    const checked = this.editChecked;
    if (!checked || !checked.size) return;
    this.products().forEach(p => {
      if (!checked.has(p.id)) return;
      const set = new Set(App.productLocations(p)); set.add(locName);
      p.locations = [...set];
      if (!p.primary_location || !p.locations.includes(p.primary_location)) p.primary_location = p.locations[0];
    });
    this.editChecked = new Set();
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
      .map(n => ({ id: App.uid(), name: n, archived: false }));
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
