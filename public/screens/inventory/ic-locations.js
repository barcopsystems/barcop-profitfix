'use strict';

/* ── Inventory Control — Locations (ic_locations) ─────────────────────────────
   User-defined storage locations. Products in ic_products reference a location
   by name via locations[] (a product can live in several). The first location a
   product is placed in becomes its primary_location (ordering/transfer home);
   that primary is what the Add Product form pre-selects. Assigning a product to
   another location here never overwrites an existing primary. Stored in
   App.inventoryData.

   Landing: a top stats strip (locations / products placed / need a location), a
   triage strip + modal for products not yet in any location, the collapsible
   add-a-location form (collapsed once locations exist so the list leads), and
   the locations list. Building a location uses a category-filtered product
   checklist with bulk helpers — Select all in a category, or Copy the whole
   product list from another location — so a bar or cooler gets built in a couple
   taps instead of one box at a time. Saving a new location drops straight into
   its arrange page so building and ordering are one flow. Editing a location is
   its own page: name, the products in it with drag-to-order (the count order),
   and the same checklist to add more. */

S.InventoryLocations = {
  editId: null,
  newCat: 'All',
  newChecked: null,    // Set<pid> checked in the add form (persists across tabs)
  editCat: 'All',
  editChecked: null,   // Set<pid> checked in the edit Add/Delete Products picker
  editMode: 'arrange', // edit screen middle section: 'arrange' or 'products'
  _nameDraft: null,    // typed location name on the edit screen, kept across re-renders
  triageCat: 'All',
  triageChecked: null, // Set<pid> checked in the "needs a location" triage modal
  _triageDest: '',     // destination location name picked in the triage modal
  pickerOpen: false,   // is the "+ Add products to location" picker expanded
  _newName: '',        // typed location name, kept so a re-render does not lose it
  _newNameError: false, // landing Name box flagged red (save attempted with no name)
  _justSavedCount: null,// "X products saved" feedback after Save Products (null = hide)
  DEFAULTS: ['Front Bar', 'Back Bar', 'Walk-In Cooler', 'Dry Storage', 'Office Storage'],

  locations() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_locations)) App.inventoryData.ic_locations = [];
    return App.inventoryData.ic_locations;
  },
  locationById(id) { return this.locations().find(l => l.id === id); },
  products() { return (App.inventoryData && App.inventoryData.ic_products) || []; },
  productCount(name) { return this.products().filter(p => App.productLocations(p).includes(name)).length; },

  // Active products not yet placed in any location — they will not be counted.
  unplacedProducts() {
    return this.products().filter(p => p.active !== false && App.productLocations(p).length === 0);
  },
  // Active products that live in at least one location.
  placedCount() {
    return this.products().filter(p => p.active !== false && App.productLocations(p).length > 0).length;
  },

  // Categories that have at least one active product, in canonical order.
  presentCats() {
    const have = new Set(this.products().filter(p => p.active !== false).map(p => p.category));
    return App.IC_CATEGORIES.filter(c => have.has(c));
  },
  // The category a picker lands on (no "All" tab; individual categories only, like
  // the Add Products screen).
  firstCat() { return this.presentCats()[0] || ''; },
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
    this._justSavedCount = null;
    // Keep a half-built location (typed name, service-bar flag, checked products,
    // open picker) alive across leaving the screen and coming back. In-memory, so
    // a full reload still starts fresh; saving the location clears it.
    if (!this.newChecked) this.newChecked = new Set();
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Locations Work', [
      { p: ['Locations are the places you keep product: your bars, coolers, and storerooms. Set them up here, then assign which products live in each one. Take Inventory walks you through one location at a time, counting the products you put there in the order you arrange them.'] },
      { h: 'Start With The Suggested Spots', p: ['Brand new with no locations yet? Hit add the suggested defaults to drop in a Front Bar, Back Bar, Walk-In Cooler, Dry Storage, and Office Storage in one tap. Rename or delete any that do not fit, then assign products. It saves you typing out the obvious spots before you can count anything.'] },
      { h: 'Add A Location', p: ['Name the spot, then check off the products stored there. Use the category tabs to jump straight to liquor, wine, beer, or food so you are not scrolling past everything else. To build a bar or cooler fast, hit Select all in a category. Your checks carry across the tabs and the running count shows how many you have picked. Save and you drop right into arranging it.'] },
      { h: 'Mark Your Service Bars', p: ['Check Location with Register (for spot check) on any spot that has a register and pours for guests, like your Front Bar or a patio well. That flag is what makes a location show up as a bar station when you run a Spot Check on a single shift. A stockroom or cooler stays unchecked. You can set it on a new location or toggle it later from the location\'s edit screen.'] },
      { h: 'Arrange For Counting', p: ['Open a location to add or pull products and drag them by the grip handle into the order they sit on the shelf or rail. Counting follows that order, so the count sheet matches the way you actually walk the room.'] },
      { h: 'The Numbers Up Top', p: ['The strip across the top reads Locations, Products Placed, and Need a Location at a glance. Locations is how many active spots you run. Products Placed is how many products sit in at least one of them. Need a Location turns amber when products are sitting nowhere and would count as zero, so chase that number down to nothing before you run a count.'] },
      { h: 'Products That Need A Location', p: ['A product not yet placed anywhere is flagged at the top of this screen as Need a Location, because it will not be counted until it has one. Tap Assign Products, pick where they live, and check them off. This is the quick way to place a batch you just imported.'] },
      { h: 'A Product Can Live In Several Places', p: ['Stock the same product in more than one location and it shows up at each during a count. The first location you put it in becomes its home for ordering, which is the Primary Location the Add Product form fills in.'] },
      { h: 'Archive And Restore', p: ['Archive on a location pulls it out of counts and the order flow but keeps it, so a closed-down well or a seasonal patio bar is never gone for good. Archived spots drop into an Archived list at the bottom; hit Restore to bring one back with its products intact, or Delete Permanently to remove it for good. Products that lived only there go back to Need a Location until you place them somewhere active.'] }
    ]);
  },

  // ── Shared: category tabs + checklist + bulk controls ──────────────────────
  catTabsHTML(activeCat, countFn, cats) {
    cats = cats || this.presentCats();
    return '<div class="ch-tabs">'
      + cats.map(c => {
          const on = c === activeCat;
          const n = countFn(c);
          return '<button class="ch-tab' + (on ? ' on' : '') + '" data-cat="' + esc(c) + '">'
            + esc(c) + (n ? ' <span style="opacity:0.55;">' + n + '</span>' : '') + '</button>';
        }).join('')
      + '</div>';
  },
  // A flat checklist on the form canvas (no nested card). Name + brand + size so a
  // row is identifiable, with the category right-aligned.
  checklistPanelHTML(prods, checkedSet, cbClass, emptyMsg, cat) {
    if (!prods.length) {
      return '<div style="font-size:12px;color:var(--t4);padding:8px 0;">' + emptyMsg + '</div>';
    }
    const rowHtml = p => '<label style="display:flex;align-items:center;gap:12px;padding:8px 2px;border-bottom:1px solid var(--b1);font-size:13px;color:var(--t1);cursor:pointer;">'
      + '<input type="checkbox" class="bc-check ' + cbClass + '" value="' + esc(p.id) + '"' + (checkedSet.has(p.id) ? ' checked' : '') + '/>'
      + '<span style="flex:1;min-width:0;">' + esc(p.name)
        + (p.brand ? ' <span style="color:var(--t3);">' + esc(p.brand) + '</span>' : '') + '</span>'
      + '<span style="font-size:11px;color:var(--t3);white-space:nowrap;">' + esc(this.sizeLabel(p)) + '</span>'
      + '<span style="font-size:10px;color:var(--t3);min-width:78px;text-align:right;">' + esc(p.category || '') + '</span></label>';
    // Sub-category sub-headers (sticky) so a long triage list scans by style.
    const inner = App.subcatGroups(prods, cat).map(g => {
      const hdr = (g.key ? esc(g.key) : 'Uncategorized') + ' (' + g.items.length + ')';
      return '<div style="position:sticky;top:0;background:var(--surface);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);padding:9px 2px 5px;border-bottom:1px solid var(--b1);">' + hdr + '</div>'
        + g.items.map(rowHtml).join('');
    }).join('');
    return '<div style="max-height:280px;overflow:auto;border-top:1px solid var(--b1);">' + inner + '</div>';
  },

  // Human size for a product, matching the Products list: container-size label for
  // pourables/beer, unit type for food/misc.
  sizeLabel(p) {
    if (!p) return '-';
    if (p.category === 'Food' || p.category === 'Misc') return p.unit_type || '-';
    const SIZES = (window.S && S.InventoryProducts && S.InventoryProducts.SIZES) || [];
    const sz = SIZES.find(s => s.oz === p.container_size_oz);
    if (sz) return sz.l;
    return p.container_size_oz != null ? p.container_size_oz + ' oz' : '-';
  },

  // Per-context handles so the bulk helpers (select-all / clear) work
  // identically on the add form, the edit add-box, and the triage modal.
  _bulkCtx(ctx) {
    const activeProds = this.products().filter(p => p.active !== false);
    if (ctx === 'edit') {
      return {
        set: this.editChecked, cat: this.editCat,
        eligible: new Set(activeProds.map(p => p.id)),
        inCat: () => this.catProducts(this.editCat),
        rerender: () => { const el = document.getElementById('il-edit-filter'); if (el) el.innerHTML = this.editProductsHTML(); },
        count: () => this.updateEditCount()
      };
    }
    if (ctx === 'triage') {
      const unplaced = this.unplacedProducts();
      return {
        set: this.triageChecked, cat: this.triageCat,
        eligible: new Set(unplaced.map(p => p.id)),
        inCat: () => this.triageCat === 'All' ? unplaced : unplaced.filter(p => p.category === this.triageCat),
        rerender: () => { const el = document.getElementById('il-triage-filter'); if (el) el.innerHTML = this.triageFilterHTML(); },
        count: () => this.updateTriageCount()
      };
    }
    return {
      set: this.newChecked, cat: this.newCat,
      eligible: new Set(activeProds.map(p => p.id)),
      inCat: () => this.catProducts(this.newCat),
      rerender: () => { const el = document.getElementById('il-new-filter'); if (el) el.innerHTML = this.newFilterHTML(); },
      count: () => this.updateNewCount()
    };
  },
  bulkControlsHTML(ctx) {
    const c = this._bulkCtx(ctx);
    const n = c.inCat().length;
    const label = c.cat ? 'Select all in ' + esc(c.cat) : 'Select all';
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0;">'
      + '<button type="button" class="btn btn-ghost btn-sm il-selall" data-ctx="' + ctx + '"' + (n ? '' : ' disabled') + '>' + label + ' (' + n + ')</button>'
      + '<button type="button" class="btn btn-ghost btn-sm il-clearsel" data-ctx="' + ctx + '">Clear</button>'
      + '</div>';
  },
  selectAllCtx(ctx) { const c = this._bulkCtx(ctx); c.inCat().forEach(p => c.set.add(p.id)); c.rerender(); c.count(); },
  clearSelCtx(ctx)  { const c = this._bulkCtx(ctx); c.set.clear(); c.rerender(); c.count(); },

  // ── Landing: stats + triage + add form + locations list ────────────────────
  renderList() {
    this.actions.innerHTML = '';
    this.editId = null;
    this.newCat = this.firstCat();
    const locs = this.locations();
    const active = locs.filter(l => !l.archived);
    const archived = locs.filter(l => l.archived);

    const unplaced = this.unplacedProducts().length;

    const statsCard = active.length
      ? '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
          + '<div class="calc-item"><div class="calc-label">Locations</div><div class="calc-val lg">' + active.length + '</div></div>'
          + '<div class="calc-item"><div class="calc-label">Products Placed</div><div class="calc-val lg">' + this.placedCount() + '</div></div>'
          + '<div class="calc-item"><div class="calc-label">Need a Location</div><div class="calc-val lg' + (unplaced ? ' warn' : '') + '">' + unplaced + '</div></div>'
        + '</div></div>'
      : '';

    const triageStrip = (active.length && unplaced)
      ? '<div class="card" style="margin-top:14px;border:1px solid var(--gold-tint-bord);background:var(--gold-tint);">'
          + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
          + '<div style="font-size:13px;color:var(--t1);"><strong>' + unplaced + ' product' + (unplaced === 1 ? '' : 's') + ' ' + (unplaced === 1 ? 'is' : 'are') + ' not in any location yet.</strong> They will not be counted until you place them.</div>'
          + '<button class="btn btn-ghost btn-sm" id="il-triage-open">Assign Products</button>'
        + '</div></div>'
      : '';

    let listSection;
    if (!locs.length) {
      listSection = '<div class="card" style="margin-top:18px;padding:14px 20px;"><div style="font-size:12px;color:var(--t3);line-height:1.6;">No locations yet. Add one above, or '
        + '<button class="btn btn-ghost btn-sm" id="il-add-defaults">add the suggested defaults</button>.</div></div>';
    } else {
      const rows = active.map(l => {
        const n = this.productCount(l.name);
        return '<tr data-id="' + esc(l.id) + '">'
          + '<td><button class="il-open" data-id="' + l.id + '" style="padding:0;border:none;background:none;color:var(--t1);font-weight:700;font-size:13px;cursor:pointer;">' + esc(l.name) + '</button></td>'
          + '<td>' + this.holdsLabel(l.name) + '</td>'
          + '<td>' + n + ' product' + (n === 1 ? '' : 's') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm il-edit" data-id="' + l.id + '">Edit</button>'
          + '<button class="btn btn-ghost btn-sm il-archive" data-id="' + l.id + '">Archive</button>'
          + '</div></td></tr>';
      }).join('');

      const listHeading = '';
      const listCard = active.length
        ? '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
            + '<th>Location</th><th>Holds</th><th>Products</th><th></th>'
            + '</tr></thead><tbody id="il-loc-body">' + rows + '</tbody></table></div>'
        : '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
            + '<th>Location</th><th>Holds</th><th>Products</th><th></th>'
            + '</tr></thead><tbody><tr><td colspan="4" style="color:var(--t3);padding:12px 8px;">No active locations. Restore one from Archived below, or add a new one above.</td></tr></tbody></table></div>';
      const archivedSection = archived.length
        ? '<div class="sh" style="margin:24px 0 10px;">Archived</div>'
          + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
            + '<th>Location</th><th>Holds</th><th>Products</th><th></th>'
            + '</tr></thead><tbody>'
            + archived.map(l => { const n = this.productCount(l.name); return '<tr data-id="' + esc(l.id) + '">'
                + '<td><div class="val">' + esc(l.name) + '</div></td>'
                + '<td>' + this.holdsLabel(l.name) + '</td>'
                + '<td>' + n + ' product' + (n === 1 ? '' : 's') + '</td>'
                + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm il-unarchive" data-id="' + esc(l.id) + '">Restore</button>'
                + '<button class="btn btn-danger btn-sm il-delperm" data-id="' + esc(l.id) + '">Delete Permanently</button></div></td>'
              + '</tr>'; }).join('')
            + '</tbody></table></div>'
        : '';
      listSection = listHeading + listCard + archivedSection;
    }

    this.container.innerHTML = '<div class="screen">' + statsCard + triageStrip + this.addFormCard() + this.pickerSection() + this.saveLocRow() + listSection + '</div>';
    this.wireList();
  },

  // The product picker that opens under the Add a Location card when "+ Add
  // products to location" is clicked: category tabs, bulk helpers, the product
  // data list, then Save Location / Clear.
  pickerSection() {
    if (!this.pickerOpen) return '';
    return '<div style="margin-top:8px;"><div id="il-new-filter">' + this.newFilterHTML() + '</div></div>';
  },

  addFormCard() {
    const linkLabel = this.pickerOpen ? '+ Save Products to Location' : '+ Add Products to Location';
    const n = this.newChecked.size;
    let counter = '';
    if (this.pickerOpen) {
      counter = '<span id="il-new-count" style="font-size:12px;color:var(--t3);margin-left:2px;">' + n + ' product' + (n === 1 ? '' : 's') + ' selected</span>';
    } else if (this._justSavedCount != null) {
      counter = '<span id="il-new-count" style="font-size:12px;color:var(--t3);margin-left:2px;">' + this._justSavedCount + ' product' + (this._justSavedCount === 1 ? '' : 's') + ' saved</span>';
    } else if (n > 0) {
      counter = '<span id="il-new-count" style="font-size:12px;color:var(--t3);margin-left:2px;">' + n + ' product' + (n === 1 ? '' : 's') + ' added</span>';
    }
    const nameErr = this._newNameError ? ' style="border-color:var(--red);"' : '';
    return '<div class="card form-card" style="margin-top:14px;">'
      + '<div class="card-title">Add a Location</div>'
      + '<div class="f" style="max-width:300px;margin:0;"><label>Name Location</label>'
        + '<input type="text" id="il-new-name" placeholder="Walk-In Cooler" value="' + esc(this._newName || '') + '"' + nameErr + '/></div>'
      + '<label style="display:inline-flex;align-items:center;gap:8px;margin-top:14px;font-size:12px;color:var(--t1);cursor:pointer;">'
        + '<input type="checkbox" class="bc-check" id="il-new-servicebar"' + (this._newServiceBar ? ' checked' : '') + '/>'
        + 'Location with Register (for spot check)</label>'
      + '<div style="display:flex;align-items:center;gap:8px;margin-top:24px;">'
        + '<span class="il-addprod-link" style="color:var(--gold);font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">' + linkLabel + '</span>'
        + counter
      + '</div></div>';
  },

  // Save Location button below the Add a Location card (and below the product
  // picker when it is open), bottom-left.
  saveLocRow() {
    return '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="il-new-save">Save Location</button>'
      + '<span id="il-new-err" style="color:var(--red);font-size:12px;display:none;"></span>'
      + '</div>';
  },

  newFilterHTML() {
    const prods = this.catProducts(this.newCat);
    return this.catTabsHTML(this.newCat, c => this.catProducts(c).length)
      + this.bulkControlsHTML('new')
      + this.productSelectTable(prods, this.newChecked, 'il-cb', 'il-prow', this.newCat);
  },

  // The product selection list as standard data-row tables, grouped by
  // Sub-Category (Misc Type for Misc, Category for the 'All' tab) into a card
  // per group — "Vodka Products (5)" — so a bar or cooler is easy to build by
  // style. Matches the grouped Products list on the Add Products screen.
  productSelectTable(prods, checkedSet, cbClass, rowClass, cat) {
    cbClass = cbClass || 'il-cb';
    rowClass = rowClass || 'il-prow';
    if (!prods.length) {
      return '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th></th><th>Product</th><th>Category</th><th>Size</th><th>Vendor</th>'
        + '</tr></thead><tbody><tr><td colspan="5" style="color:var(--t3);padding:12px 8px;">No matching products yet. Add products on the Products screen first, then assign them here.</td></tr></tbody></table></div>';
    }
    const rowHtml = p => '<tr class="' + rowClass + '" data-id="' + esc(p.id) + '" style="cursor:pointer;">'
      + '<td><input type="checkbox" class="bc-check ' + cbClass + '" value="' + esc(p.id) + '"' + (checkedSet.has(p.id) ? ' checked' : '') + '/></td>'
      + '<td><div class="val">' + esc(p.name) + '</div>' + (p.brand ? '<div style="font-size:10px;color:var(--t3);">' + esc(p.brand) + '</div>' : '') + '</td>'
      + '<td>' + esc(p.category || '-') + '</td>'
      + '<td>' + esc(this.sizeLabel(p)) + '</td>'
      + '<td>' + esc(p.vendor || '-') + '</td>'
      + '</tr>';
    const colgroup = '<colgroup><col style="width:40px;"/><col style="width:220px;"/><col/><col/><col/></colgroup>';
    return App.subcatGroups(prods, cat).map((g, gi) => {
      const hdr = (g.key ? esc(g.key) : 'Uncategorized') + ' (' + g.items.length + ')';
      return '<div class="card" style="overflow-x:auto;margin-top:' + (gi === 0 ? '0' : '16') + 'px;">'
        + '<table class="row-list" style="table-layout:fixed;width:100%;">' + colgroup + '<thead><tr>'
        + '<th></th><th>' + hdr + '</th><th>Category</th><th>Size</th><th>Vendor</th>'
        + '</tr></thead><tbody>' + g.items.map(rowHtml).join('') + '</tbody></table></div>';
    }).join('');
  },

  _toggleNew(id, on) {
    if (on) this.newChecked.add(id); else this.newChecked.delete(id);
    this.updateNewCount();
  },

  updateNewCount() {
    const el = document.getElementById('il-new-count');
    if (!el) return;
    const n = this.newChecked.size;
    el.textContent = n + ' product' + (n === 1 ? '' : 's') + ' selected';
  },

  wireList() {
    this.container.onclick = ev => {
      const tab = ev.target.closest('.ch-tab');
      if (tab) {
        this.newCat = tab.dataset.cat;
        const el = document.getElementById('il-new-filter');
        if (el) el.innerHTML = this.newFilterHTML();
        return;
      }
      if (ev.target.closest('.il-addprod-link')) {
        this._newName = document.getElementById('il-new-name')?.value || '';
        if (this.pickerOpen) { this.commitNewProducts(); }   // "✓ Save Products"
        else { this.pickerOpen = true; this._newNameError = false; this._justSavedCount = null; this.renderList(); }
        return;
      }
      const sa = ev.target.closest('.il-selall');   if (sa) { this.selectAllCtx(sa.dataset.ctx); return; }
      const cl = ev.target.closest('.il-clearsel'); if (cl) { this.clearSelCtx(cl.dataset.ctx); return; }
      if (ev.target.closest('#il-triage-open')) { this.openTriage(); return; }
      const prow = ev.target.closest('.il-prow');
      if (prow && !ev.target.closest('input')) {
        const cb = prow.querySelector('.il-cb');
        if (cb) { cb.checked = !cb.checked; this._toggleNew(cb.value, cb.checked); }
        return;
      }
      const save = ev.target.closest('#il-new-save');
      const open = ev.target.closest('.il-open');
      const edit = ev.target.closest('.il-edit');
      const arch = ev.target.closest('.il-archive');
      const un   = ev.target.closest('.il-unarchive');
      const dperm = ev.target.closest('.il-delperm');
      const addD = ev.target.closest('#il-add-defaults');
      if (save)       this.saveNewLocation();
      else if (open)  this.openEdit(open.dataset.id);
      else if (edit)  this.openEdit(edit.dataset.id);
      else if (arch)  this.setArchived(arch.dataset.id, true);
      else if (un)    this.setArchived(un.dataset.id, false);
      else if (dperm) this.deletePermanently(dperm.dataset.id);
      else if (addD)  this.addDefaults();
    };
    // Checkbox toggles accumulate into the running set so checks survive tab swaps.
    this.container.onchange = ev => {
      if (ev.target.id === 'il-new-servicebar') { this._newServiceBar = ev.target.checked; return; }
      if (ev.target.classList && ev.target.classList.contains('il-cb')) {
        this._toggleNew(ev.target.value, ev.target.checked);
      }
    };
    // Keep the typed name in state so opening the picker never loses it. Typing
    // also clears the red empty-name flag and the "saved" feedback.
    document.getElementById('il-new-name')?.addEventListener('input', e => {
      this._newName = e.target.value;
      this._justSavedCount = null;
      if (this._newNameError && e.target.value.trim()) { this._newNameError = false; e.target.style.borderColor = ''; }
    });
  },

  async saveNewLocation() {
    const name = (document.getElementById('il-new-name')?.value || '').trim();
    const err = document.getElementById('il-new-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (!name) { this._newNameError = true; this.renderList(); return; }   // empty -> red border, no save
    this._newNameError = false;
    if (this.locations().some(l => l.name.toLowerCase() === name.toLowerCase())) { fail('A location with that name already exists.'); return; }

    const id = App.uid();
    this.locations().push({ id, name, archived: false, service_bar: !!document.getElementById('il-new-servicebar')?.checked });
    this._reconcileProducts(name, this.newChecked);   // assign every checked product
    const btn = document.getElementById('il-new-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveInventory();
    // Drop straight into the new location's arrange page (build → order in one flow).
    if (ok) { App.markSetupDone('gs_ic_locations'); this.openEdit(id); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Save Location'; } fail('Save failed. Try again.'); }
  },

  // "✓ Save Products" link (picker open): create the location + assign the checked
  // products and persist, WITHOUT leaving the landing — no separate Save Location
  // click needed. Closes the picker and shows the "X products saved" feedback, then
  // resets the box for the next location. Empty name flags the Name box red.
  async commitNewProducts() {
    const name = (document.getElementById('il-new-name')?.value || '').trim();
    this._newName = name;
    const err = document.getElementById('il-new-err');
    if (!name) { this._newNameError = true; if (err) { err.textContent = ''; err.style.display = 'none'; } this.renderList(); return; }
    this._newNameError = false;
    if (this.locations().some(l => l.name.toLowerCase() === name.toLowerCase())) {
      if (err) { err.textContent = 'A location with that name already exists.'; err.style.display = 'inline'; }
      return;
    }
    const id = App.uid();
    this.locations().push({ id, name, archived: false, service_bar: !!document.getElementById('il-new-servicebar')?.checked });
    this._reconcileProducts(name, this.newChecked);
    const savedCount = this.newChecked.size;
    await App.saveInventory();
    App.markSetupDone('gs_ic_locations');
    // Reset the box for the next location; show the saved feedback until they start one.
    this.pickerOpen = false;
    this._newName = '';
    this._newServiceBar = false;
    this.newChecked = new Set();
    this._justSavedCount = savedCount;
    this.renderList();
  },

  // ── Edit page (own page; one Update Location button saves name + products) ──
  // Fresh entry from the list: reset mode, name draft, and the checked set.
  openEdit(id) {
    this.editMode = 'arrange';
    this.editCat = this.firstCat();
    this.editChecked = new Set();
    this._nameDraft = null;
    this._renderEdit(id);
  },
  // Re-render the edit screen in its CURRENT mode (keeps the name draft + mode).
  _renderEdit(id) {
    const l = this.locationById(id);
    if (!l) { this.renderList(); return; }
    this.editId = id;
    this.actions.innerHTML = '';
    this.container.innerHTML = '<div class="screen">' + this.editCard(l) + '</div>';
    this.wireEdit(l);
    if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
  },

  editCard(l) {
    const assigned = this.sortedProductsForLocation(l.name);
    const products = this.editMode === 'products';
    const nameVal = this._nameDraft != null ? this._nameDraft : l.name;

    const cnt = products ? this.editChecked.size : assigned.length;
    const cntWord = products ? 'selected' : 'added';
    const linkLabel = products ? '+ Save Product Changes' : '+ Add/Delete Products';

    const nameCard = '<div class="card form-card">'
      + '<div class="card-title">Editing ' + esc(l.name) + '</div>'
      + '<div class="f" style="max-width:300px;margin:0;"><label>Location Name</label><input type="text" id="il-name" value="' + esc(nameVal) + '"/></div>'
      + '<label style="display:inline-flex;align-items:center;gap:8px;margin-top:14px;font-size:12px;color:var(--t1);cursor:pointer;">'
        + '<input type="checkbox" class="bc-check" id="il-servicebar"' + (l.service_bar ? ' checked' : '') + '/>'
        + 'Location with Register (for spot check)</label>'
      + '<div style="display:flex;align-items:center;gap:8px;margin-top:24px;">'
        + '<span class="il-editprod-link" style="color:var(--gold);font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">' + linkLabel + '</span>'
        + '<span id="il-edit-count" style="font-size:12px;color:var(--t3);margin-left:2px;">' + cnt + ' product' + (cnt === 1 ? '' : 's') + ' ' + cntWord + '</span>'
      + '</div></div>';

    let middle;
    if (products) {
      // The same product menu/list as the landing, all current products pre-checked.
      middle = '<div style="margin-top:18px;"><div id="il-edit-filter">' + this.editProductsHTML() + '</div></div>';
    } else {
      const arrangeHeading = '<div class="no-print" style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:24px 0 10px;">'
        + '<div class="sh" style="margin:0;">Products In This Location</div>'
        + (assigned.length ? '<span style="font-size:10px;color:var(--t3);">Drag the handle to set the order Take Inventory counts these in.</span>' : '')
        + '</div>';
      const arrangeCard = assigned.length
        ? '<div class="card" style="overflow-x:auto;"><table class="row-list il-arrange"><thead><tr>'
            + '<th style="width:24px;"></th><th style="width:30px;">#</th><th>Product</th><th>Category</th><th>Size</th><th>Vendor</th><th style="text-align:right;"></th>'
            + '</tr></thead><tbody id="il-arrange-body">'
            + assigned.map((p, i) => '<tr data-id="' + esc(p.id) + '">'
                + DragReorder.handleCellHTML()
                + '<td style="color:var(--t4);font-size:11px;">' + (i + 1) + '</td>'
                + '<td><div class="val">' + esc(p.name) + '</div>' + (p.brand ? '<div style="font-size:10px;color:var(--t3);">' + esc(p.brand) + '</div>' : '') + '</td>'
                + '<td>' + esc(p.category || '-') + '</td>'
                + '<td>' + esc(this.sizeLabel(p)) + '</td>'
                + '<td>' + esc(p.vendor || '-') + '</td>'
                + '<td style="text-align:right;"><button class="btn btn-ghost btn-sm il-remove" data-id="' + esc(p.id) + '" style="color:var(--red);">Remove</button></td>'
                + '</tr>').join('')
            + '</tbody></table></div>'
        : '<div class="card" style="overflow-x:auto;"><table class="row-list il-arrange"><thead><tr>'
          + '<th style="width:24px;"></th><th style="width:30px;">#</th><th>Product</th><th>Category</th><th>Size</th><th>Vendor</th><th></th>'
          + '</tr></thead><tbody><tr><td colspan="7" style="color:var(--t3);padding:12px 8px;">No products here yet. Tap "+ Add/Delete Products" above to add some.</td></tr></tbody></table></div>';
      middle = arrangeHeading + arrangeCard;
    }

    const updateRow = '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="il-update-loc">Update Location</button>'
      + '<span id="il-err" style="color:var(--red);font-size:12px;display:none;"></span>'
      + '</div>';
    return nameCard + middle + updateRow;
  },

  // The edit screen's Add/Delete picker: every active product (category-tabbed),
  // with the products currently in this location pre-checked.
  editProductsHTML() {
    const prods = this.catProducts(this.editCat);
    return this.catTabsHTML(this.editCat, c => this.catProducts(c).length)
      + this.bulkControlsHTML('edit')
      + this.productSelectTable(prods, this.editChecked, 'il-edit-cb', 'il-eprow', this.editCat);
  },

  updateEditCount() {
    const el = document.getElementById('il-edit-count');
    if (!el) return;
    const n = this.editChecked.size;
    el.textContent = n + ' product' + (n === 1 ? '' : 's') + ' selected';
  },

  wireEdit(l) {
    this.container.onclick = ev => {
      const tab = ev.target.closest('.ch-tab');
      if (tab) {
        this.editCat = tab.dataset.cat;
        const el = document.getElementById('il-edit-filter');
        if (el) el.innerHTML = this.editProductsHTML();
        return;
      }
      if (ev.target.closest('.il-editprod-link')) {
        this._nameDraft = document.getElementById('il-name')?.value ?? l.name;
        if (this.editMode === 'products') {
          this.saveProducts(l.id);          // commit the add/deletes, return to arrange
        } else {
          this.editMode = 'products';       // open with current products pre-checked
          this.editCat = this.firstCat();
          this.editChecked = new Set(this.sortedProductsForLocation(l.name).map(p => p.id));
          this._renderEdit(l.id);
        }
        return;
      }
      const sa = ev.target.closest('.il-selall');   if (sa) { this.selectAllCtx(sa.dataset.ctx); return; }
      const cl = ev.target.closest('.il-clearsel'); if (cl) { this.clearSelCtx(cl.dataset.ctx); return; }
      if (ev.target.closest('#il-update-loc')) { this.updateLocation(l.id); return; }
      const eprow = ev.target.closest('.il-eprow');
      if (eprow && !ev.target.closest('input')) {
        const cb = eprow.querySelector('.il-edit-cb');
        if (cb) { cb.checked = !cb.checked; this._toggleEdit(cb.value, cb.checked); }
        return;
      }
      const rm = ev.target.closest('.il-remove'); if (rm) { this.removeProduct(l.name, rm.dataset.id); return; }
    };
    this.container.onchange = ev => {
      if (ev.target.classList && ev.target.classList.contains('il-edit-cb')) {
        this._toggleEdit(ev.target.value, ev.target.checked);
      }
    };
    document.getElementById('il-name')?.addEventListener('input', e => { this._nameDraft = e.target.value; });
    document.getElementById('il-name')?.addEventListener('keydown', e => { if (e.key === 'Enter') this.updateLocation(l.id); });
    const ab = document.getElementById('il-arrange-body');
    if (ab) DragReorder.wire({ container: ab, rowSelector: 'tr[data-id]', handleSelector: '.dr-handle', dragClass: 'il-drag', onCommit: ids => this._persistProductOrder(l.name, ids) });
  },

  _toggleEdit(id, on) {
    if (on) this.editChecked.add(id); else this.editChecked.delete(id);
    this.updateEditCount();
  },

  // Make the location's product set equal `want` (a Set of product ids): add the
  // checked ones that are not in it, drop the unchecked ones that are.
  _reconcileProducts(name, want) {
    this.products().forEach(p => {
      const has = App.productLocations(p).includes(name);
      const wanted = want.has(p.id);
      if (wanted && !has) {
        const set = new Set(App.productLocations(p)); set.add(name);
        p.locations = [...set];
        if (!p.primary_location || !p.locations.includes(p.primary_location)) p.primary_location = p.locations[0];
      } else if (!wanted && has) {
        p.locations = App.productLocations(p).filter(x => x !== name);
        if (p.primary_location === name) p.primary_location = p.locations[0] || '';
        if (p.location_sequences) delete p.location_sequences[name];
      }
    });
  },

  // Save Product Changes link: commit the add/deletes immediately and return to
  // the arrange view. Product changes persist even if the operator never clicks
  // Update Location.
  async saveProducts(id) {
    const l = this.locationById(id);
    if (!l) { this.renderList(); return; }
    this._reconcileProducts(l.name, this.editChecked);
    await App.saveInventory();
    App.markSetupDone('gs_ic_locations');
    this.editMode = 'arrange';
    this.editChecked = new Set();
    this._renderEdit(id);
  },

  // One button: saves the name AND (in products mode) reconciles the location's
  // products to whatever is checked, then returns to the arrange view.
  async updateLocation(id) {
    const name = document.getElementById('il-name')?.value.trim();
    const err  = document.getElementById('il-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (!name) { fail('Location name required.'); return; }
    if (this.locations().some(l => l.id !== id && l.name.toLowerCase() === name.toLowerCase())) { fail('That name already exists.'); return; }
    const l = this.locationById(id);
    if (!l) { this.renderList(); return; }
    const old = l.name;
    l.name = name;
    l.service_bar = !!document.getElementById('il-servicebar')?.checked;
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
    if (this.editMode === 'products') this._reconcileProducts(name, this.editChecked);
    const btn = document.getElementById('il-update-loc');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveInventory();
    if (ok) {
      App.markSetupDone('gs_ic_locations');
      this.editMode = 'arrange';
      this.editChecked = new Set();
      this._nameDraft = null;
      this._renderEdit(id);
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Update Location'; }
      fail('Save failed. Try again.');
    }
  },

  async removeProduct(locName, pid) {
    const p = this.products().find(x => x.id === pid);
    if (!p) return;
    p.locations = App.productLocations(p).filter(x => x !== locName);
    if (p.primary_location === locName) p.primary_location = p.locations[0] || '';
    if (p.location_sequences) delete p.location_sequences[locName];
    await App.saveInventory();
    this._renderEdit(this.editId);
  },

  // ── Triage: place products that are not in any location yet ─────────────────
  openTriage() {
    const ucats = App.IC_CATEGORIES.filter(cat => this.unplacedProducts().some(p => p.category === cat));
    this.triageCat = ucats[0] || '';
    this.triageChecked = new Set();
    const firstLoc = this.locations().find(l => !l.archived);
    this._triageDest = firstLoc ? firstLoc.name : '';
    App.openModal(this.triageModalHTML(), { id: 'il-triage', maxWidth: 600, onClose: () => { App.closeModal('il-triage'); this.renderList(); } });
    this.wireTriage();
  },

  triageModalHTML() {
    const destOpts = this.locations().filter(l => !l.archived)
      .map(l => '<option value="' + esc(l.name) + '"' + (l.name === this._triageDest ? ' selected' : '') + '>' + esc(l.name) + '</option>').join('');
    return '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">Assign Products to a Location</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;">Pick a location, check the products that live there, and assign.</div>'
      + '<div class="form-row" style="align-items:flex-end;gap:14px;margin-bottom:6px;">'
        + '<div class="f" style="width:260px;"><label>Add checked products to</label><select id="il-triage-dest">' + destOpts + '</select></div>'
      + '</div>'
      + '<div id="il-triage-filter">' + this.triageFilterHTML() + '</div>'
      + '<div class="card-actions" style="align-items:center;">'
        + '<button class="btn btn-primary" id="il-triage-assign">Assign to Location</button>'
        + '<span id="il-triage-count" style="font-size:12px;color:var(--t3);margin-left:4px;">0 products selected</span>'
      + '</div></div>';
  },

  triageFilterHTML() {
    const unplaced = this.unplacedProducts();
    const cats = App.IC_CATEGORIES.filter(cat => unplaced.some(p => p.category === cat));
    const inCat = unplaced.filter(p => p.category === this.triageCat);
    return this.catTabsHTML(this.triageCat, c => unplaced.filter(p => p.category === c).length, cats)
      + this.bulkControlsHTML('triage')
      + this.checklistPanelHTML(inCat, this.triageChecked, 'il-tri-cb', 'No products need a location.', this.triageCat);
  },

  updateTriageCount() {
    const el = document.getElementById('il-triage-count');
    if (!el) return;
    const n = this.triageChecked.size;
    el.textContent = n + ' product' + (n === 1 ? '' : 's') + ' selected';
  },

  wireTriage() {
    const m = document.getElementById('il-triage');
    if (!m) return;
    m.onclick = ev => {
      const tab = ev.target.closest('.ch-tab');
      if (tab) { this.triageCat = tab.dataset.cat; const el = document.getElementById('il-triage-filter'); if (el) el.innerHTML = this.triageFilterHTML(); return; }
      const sa = ev.target.closest('.il-selall');   if (sa) { this.selectAllCtx('triage'); return; }
      const cl = ev.target.closest('.il-clearsel'); if (cl) { this.clearSelCtx('triage'); return; }
      if (ev.target.closest('#il-triage-assign')) { this.assignTriage(); return; }
    };
    m.onchange = ev => {
      if (ev.target.id === 'il-triage-dest') { this._triageDest = ev.target.value; return; }
      if (ev.target.classList && ev.target.classList.contains('il-tri-cb')) {
        if (ev.target.checked) this.triageChecked.add(ev.target.value);
        else this.triageChecked.delete(ev.target.value);
        this.updateTriageCount();
      }
    };
  },

  async assignTriage() {
    const locName = this._triageDest;
    const checked = this.triageChecked;
    if (!locName || !checked || !checked.size) return;
    this.products().forEach(p => {
      if (!checked.has(p.id)) return;
      const set = new Set(App.productLocations(p)); set.add(locName);
      p.locations = [...set];
      if (!p.primary_location || !p.locations.includes(p.primary_location)) p.primary_location = p.locations[0];
    });
    this.triageChecked = new Set();
    await App.saveInventory();
    App.markSetupDone('gs_ic_locations');
    if (this.unplacedProducts().length) {
      const el = document.getElementById('il-triage-filter');
      if (el) el.innerHTML = this.triageFilterHTML();
      this.updateTriageCount();
    } else {
      App.closeModal('il-triage');
      this.renderList();
    }
  },

  // ── Archive / restore / permanent delete / defaults ─────────────────────────
  async setArchived(id, val) {
    const l = this.locations().find(x => x.id === id);
    if (!l) return;
    l.archived = val;
    await App.saveInventory();
    this.renderList();
  },

  // Remove a deleted location for good: strip its name off every product (so
  // nothing points at a vanished location) and drop the record. Products left
  // with no location fall back to Need a Location.
  async deletePermanently(id) {
    const l = this.locations().find(x => x.id === id);
    if (!l) return;
    const n = this.productCount(l.name);
    const ok = await App.confirm({
      title: 'Delete this location permanently?',
      message: '"' + l.name + '" will be removed for good'
        + (n ? ', and cleared off ' + n + ' product' + (n === 1 ? '' : 's') + ' (any left with no location go to Need a Location)' : '')
        + '. This cannot be undone.',
      confirmText: 'Delete Permanently', danger: true
    });
    if (!ok) return;
    this.products().forEach(p => {
      if (Array.isArray(p.locations) && p.locations.includes(l.name)) {
        p.locations = p.locations.filter(x => x !== l.name);
        if (p.primary_location === l.name) p.primary_location = p.locations[0] || '';
      } else if (p.primary_location === l.name) {
        p.primary_location = '';
      }
      if (p.location_sequences && p.location_sequences[l.name] != null) delete p.location_sequences[l.name];
    });
    App.inventoryData.ic_locations = this.locations().filter(x => x.id !== id);
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
    this._renderEdit(this.editId);
  }
};
