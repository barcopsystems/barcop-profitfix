'use strict';

/* ── Inventory Control — Products (master product list: ic_products) ──────────
   ic_products is the platform-wide product master. Profit Recovery Bar Products
   and Kitchen Products read from it. Stored in App.inventoryData (ic_data table,
   Rule 21) — saved via App.saveInventory(). */

S.InventoryProducts = {
  editId: null,
  _saving: false,
  _pendingDelIds: null,
  activeCat: 'Liquor',

  CATEGORIES: ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'],

  SIZES: [
    {g:'Spirits',l:'50ml (1.7 oz)',oz:1.7},{g:'Spirits',l:'200ml (6.8 oz)',oz:6.8},
    {g:'Spirits',l:'375ml (12.7 oz)',oz:12.7},{g:'Spirits',l:'750ml (25.4 oz)',oz:25.4},
    {g:'Spirits',l:'1L (33.8 oz)',oz:33.8},{g:'Spirits',l:'1.75L (59.2 oz)',oz:59.2},
    {g:'Wine',l:'187ml (6.3 oz)',oz:6.3},{g:'Wine',l:'375ml (12.7 oz)',oz:12.7},
    {g:'Wine',l:'750ml (25.4 oz)',oz:25.4},{g:'Wine',l:'1.5L (50.7 oz)',oz:50.7},
    {g:'Beer',l:'12 oz',oz:12},{g:'Beer',l:'16 oz',oz:16},{g:'Beer',l:'22 oz bomber',oz:22},
    {g:'Beer',l:'32 oz crowler',oz:32},{g:'Beer',l:'40 oz',oz:40},
    {g:'Draft Keg',l:'1/6 keg (661 oz)',oz:661},{g:'Draft Keg',l:'1/4 keg (992 oz)',oz:992},
    {g:'Draft Keg',l:'1/2 keg (1984 oz)',oz:1984},{g:'Other',l:'Custom (enter oz)',oz:null}
  ],

  // ── Helpers ───────────────────────────────────────────────────────────────
  isPourable(cat) { return cat !== 'Food' && cat !== 'Misc'; },

  isComplete(p) {
    if (!p.name || p.unit_cost == null || p.unit_cost === '') return false;
    if (this.isPourable(p.category)) return !!(p.container_size_oz && p.pour_size_oz && p.menu_price);
    return true;
  },

  products() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_products)) App.inventoryData.ic_products = [];
    return App.inventoryData.ic_products;
  },

  sizeOpts(sel) {
    let g = '', h = '<option value="">Select container size...</option>';
    this.SIZES.forEach(s => {
      if (s.g !== g) { if (g) h += '</optgroup>'; h += '<optgroup label="' + s.g + '">'; g = s.g; }
      const v = s.oz !== null ? s.oz : 'custom';
      h += '<option value="' + v + '"' + (sel != null && s.oz === sel ? ' selected' : '') + '>' + s.l + '</option>';
    });
    if (g) h += '</optgroup>';
    return h;
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = 'Add Product';
    addBtn.addEventListener('click', () => this.showForm());
    actions.appendChild(addBtn);

    const impBtn = document.createElement('button');
    impBtn.className = 'btn btn-ghost btn-sm';
    impBtn.style.marginLeft = '8px';
    impBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="margin-right:5px;"><path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Import';
    impBtn.addEventListener('click', () => this.showImport());
    actions.appendChild(impBtn);

    this.renderList();
  },

  catTabs() {
    const all = this.products();
    return '<div style="display:flex;gap:2px;border-bottom:1px solid var(--b2);margin-bottom:0;flex-wrap:wrap;">'
      + this.CATEGORIES.map(c => {
          const n = all.filter(p => (p.category || '') === c).length;
          const on = c === this.activeCat;
          return '<button class="ic-tab" data-cat="' + esc(c) + '" style="background:none;border:none;'
            + 'border-bottom:2px solid ' + (on ? 'var(--gold)' : 'transparent') + ';'
            + 'color:' + (on ? 'var(--gold)' : 'var(--t3)') + ';font-size:11px;font-weight:700;'
            + 'letter-spacing:0.5px;text-transform:uppercase;padding:9px 14px;cursor:pointer;">'
            + esc(c) + (n ? ' <span style="opacity:0.55;">' + n + '</span>' : '') + '</button>';
        }).join('')
      + '</div>';
  },

  renderList() {
    const all = this.products();
    const prods = all.filter(p => (p.category || '') === this.activeCat);
    const target = App.data?.settings?.targets?.bar_pour_cost_pct ?? 22;
    const incomplete = prods.filter(p => !this.isComplete(p));

    const syncNote = '<div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gold);margin:12px 0 14px;">'
      + 'SYNCED TO PROFIT RECOVERY &#10003;'
      + '<span style="color:var(--t3);font-weight:600;letter-spacing:0.5px;"> &nbsp; Bar categories feed Bar Products &middot; Food and Misc feed Kitchen Products</span></div>';

    let body;
    if (prods.length === 0) {
      body = syncNote
        + '<div class="empty"><div class="empty-title">No ' + esc(this.activeCat) + ' products yet</div>'
        + '<div class="empty-sub">Add products to this category to track cost, par levels, and inventory. '
        + 'Bar Products and Kitchen Products in Profit Recovery read from this master list.</div>'
        + '<div style="display:flex;gap:10px;justify-content:center;">'
        + '<button class="btn btn-primary" id="ip-add-first">Add Product</button>'
        + '<button class="btn btn-ghost" id="ip-imp-first">Import from File</button>'
        + '</div></div>';
    } else {
      const pourable = this.isPourable(this.activeCat);
      const rows = prods.map(p => {
        const complete = this.isComplete(p);
        const sz  = this.SIZES.find(s => s.oz === p.container_size_oz);
        const szL = sz ? sz.l : (p.container_size_oz ? p.container_size_oz + ' oz' : '-');
        const pc  = p.pour_cost_pct != null ? (p.pour_cost_pct > target ? 'neg' : 'pos') : '';
        const dim = p.active === false ? 'opacity:0.5;' : '';
        return '<tr style="' + dim + '">'
          + '<td style="width:36px;"><input type="checkbox" class="ip-chk" data-id="' + p.id + '" style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/></td>'
          + '<td><div class="val" style="' + (!complete ? 'color:var(--red);' : '') + '">' + esc(p.name)
          + (p.active === false ? ' <span class="badge badge-dim">Inactive</span>' : '') + '</div>'
          + (p.brand ? '<div style="font-size:10px;color:var(--t3);">' + esc(p.brand) + '</div>' : '')
          + (!complete ? '<div style="font-size:10px;color:var(--red);font-weight:600;letter-spacing:0.5px;">Incomplete</div>' : '') + '</td>'
          + '<td>' + esc(p.vendor || '-') + '</td>'
          + '<td>' + (pourable ? esc(szL) : '<span style="color:var(--t4);">-</span>') + '</td>'
          + '<td>' + (pourable ? (p.pour_size_oz ? p.pour_size_oz + ' oz' : '-') : '<span style="color:var(--t4);">-</span>') + '</td>'
          + '<td>' + (p.unit_cost != null ? App.fmtCurrency(p.unit_cost) : '<span style="color:var(--t4);">-</span>') + '</td>'
          + '<td>' + (pourable && p.cost_per_pour != null ? App.fmtCurrency(p.cost_per_pour) : '<span style="color:var(--t4);">-</span>') + '</td>'
          + '<td class="' + pc + '">' + (pourable && p.pour_cost_pct != null ? App.fmtPct(p.pour_cost_pct) : '<span style="color:var(--t4);">-</span>') + '</td>'
          + '<td>' + (p.par_level != null && p.par_level !== '' ? p.par_level : '<span style="color:var(--t4);">-</span>') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm ip-edit" data-id="' + p.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm ip-del" data-id="' + p.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');

      const alertBar = incomplete.length > 0
        ? '<div class="alert-bar" style="margin-bottom:14px;"><div class="alert-text">'
          + incomplete.length + ' product' + (incomplete.length > 1 ? 's have' : ' has')
          + ' incomplete data, highlighted red in the Product column.</div></div>'
        : '';

      body = syncNote + alertBar
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
        + '<button class="btn btn-ghost btn-sm" id="ip-sel-all">Select All</button>'
        + '<button class="btn btn-danger btn-sm" id="ip-del-sel" style="display:none;">Delete Selected</button>'
        + '<span id="ip-sel-count" style="font-size:11px;color:var(--t3);"></span>'
        + '</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th style="width:36px;"></th>'
        + '<th>Product</th><th>Vendor</th><th>Container</th><th>Pour</th>'
        + '<th>Unit Cost</th><th>Cost/Pour</th><th>Pour Cost %</th><th>Par</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="ip-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div id="ip-del-msg" style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this product?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="ip-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="ip-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + this.catTabs() + body + '</div>' + modal;
    this.wireList();
  },

  wireList() {
    this.container.onclick = ev => {
      const tab      = ev.target.closest('.ic-tab');
      const edit     = ev.target.closest('.ip-edit');
      const del      = ev.target.closest('.ip-del');
      const addFirst = ev.target.closest('#ip-add-first');
      const impFirst = ev.target.closest('#ip-imp-first');
      const cancel   = ev.target.closest('#ip-cancel');
      const save     = ev.target.closest('#ip-save');
      if (tab)      { ev.stopPropagation(); this.activeCat = tab.dataset.cat; this.renderList(); }
      if (edit)     { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      if (del)      { ev.stopPropagation(); this.confirmDel([del.dataset.id], 'Delete this product?'); }
      if (addFirst) { ev.stopPropagation(); this.showForm(); }
      if (impFirst) { ev.stopPropagation(); this.showImport(); }
      if (cancel)   { ev.stopPropagation(); this.renderList(); }
      if (save)     { ev.stopPropagation(); this.save(); }
    };

    const updateSel = () => {
      const checked = this.container.querySelectorAll('.ip-chk:checked');
      const btn = document.getElementById('ip-del-sel');
      const cnt = document.getElementById('ip-sel-count');
      if (btn) btn.style.display = checked.length > 0 ? '' : 'none';
      if (cnt) cnt.textContent   = checked.length > 0 ? checked.length + ' selected' : '';
    };
    this.container.addEventListener('change', ev => {
      if (ev.target.classList.contains('ip-chk')) updateSel();
    });
    document.getElementById('ip-sel-all')?.addEventListener('click', () => {
      const chks = document.querySelectorAll('.ip-chk');
      const allChecked = [...chks].every(c => c.checked);
      chks.forEach(c => { c.checked = !allChecked; });
      updateSel();
    });
    document.getElementById('ip-del-sel')?.addEventListener('click', () => {
      const ids = [...document.querySelectorAll('.ip-chk:checked')].map(c => c.dataset.id);
      if (!ids.length) return;
      this.confirmDel(ids, 'Delete ' + ids.length + ' product' + (ids.length > 1 ? 's' : '') + '?');
    });
  },

  // ── Form ──────────────────────────────────────────────────────────────────
  showForm(id) {
    this.editId = id || null;
    const p = id ? this.products().find(x => x.id === id) : null;
    const cat = p?.category || this.activeCat;
    const isCustom = p?.container_size_oz != null && !this.SIZES.find(s => s.oz === p.container_size_oz);
    const v = (val) => val != null && val !== '' ? val : '';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'New') + ' Product</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f w-lg"><label>Product Name</label><input type="text" id="ip-name" value="' + esc(p?.name || '') + '" placeholder="Tito\'s Handmade Vodka"/></div>'
      + '<div class="f w-md"><label>Brand</label><input type="text" id="ip-brand" value="' + esc(p?.brand || '') + '" placeholder="Tito\'s"/></div>'
      + '<div class="f w-md"><label>Category</label><select id="ip-cat">'
      + this.CATEGORIES.map(c => '<option' + (cat === c ? ' selected' : '') + '>' + c + '</option>').join('')
      + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f w-md"><label>Sub-Category</label><input type="text" id="ip-subcat" value="' + esc(p?.sub_category || '') + '" placeholder="Vodka"/></div>'
      + '<div class="f w-lg"><label>Primary Vendor</label><input type="text" id="ip-vendor" value="' + esc(p?.vendor || '') + '" placeholder="Republic National"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Status</label>'
      + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t1);cursor:pointer;height:36px;">'
      + '<input type="checkbox" id="ip-active"' + (p ? (p.active === false ? '' : ' checked') : ' checked') + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;"/>Active</label></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Container Size ' + tt('container-size') + '</label>'
      + '<select id="ip-size">' + this.sizeOpts(isCustom ? null : p?.container_size_oz) + '</select></div>'
      + '<div class="f" id="ip-cw" style="width:110px;flex-shrink:0;' + (isCustom ? '' : 'display:none;') + '"><label>Custom (oz)</label>'
      + '<div class="fw"><input class="suf" type="number" id="ip-coz" value="' + (isCustom ? p.container_size_oz : '') + '" step="0.1"/><span class="suf">oz</span></div></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Pour Size ' + tt('std-pour') + '</label>'
      + '<div class="fw"><input class="suf" type="number" id="ip-pour" value="' + v(p?.pour_size_oz) + '" step="0.25" placeholder="1.5"/><span class="suf">oz</span></div></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Unit Cost ' + tt('unit-cost') + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-cost" value="' + v(p?.unit_cost) + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Menu Price ' + tt('menu-price') + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ip-price" value="' + v(p?.menu_price) + '" step="0.25" placeholder="0.00"/></div></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Par Level ' + tt('ic-par-level') + '</label>'
      + '<input type="number" id="ip-par" value="' + v(p?.par_level) + '" step="1" min="0" placeholder="0"/></div>'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>Reorder Point ' + tt('ic-reorder-point') + '</label>'
      + '<input type="number" id="ip-reorder" value="' + v(p?.reorder_point) + '" step="1" min="0" placeholder="0"/></div>'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Primary Location</label>'
      + '<input type="text" id="ip-loc1" value="' + esc(p?.primary_location || '') + '" placeholder="Front Bar"/></div>'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Secondary Location</label>'
      + '<input type="text" id="ip-loc2" value="' + esc(p?.secondary_location || '') + '" placeholder="Walk-In Cooler"/></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="ip-notes" rows="2" placeholder="Optional">' + esc(p?.notes || '') + '</textarea></div>'
      + '</div>'

      + '<div class="calc" style="margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Pours/Container ' + tt('ic-pours-container') + '</div><div class="calc-val" id="ip-pours">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Cost/Pour ' + tt('cost-pour') + '</div><div class="calc-val" id="ip-cpp">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Pour Cost % ' + tt('pour-cost-pct') + '</div><div class="calc-val" id="ip-pct">-</div></div>'
      + '</div>'

      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="ip-save">' + (id ? 'Update' : 'Save') + '</button>'
      + '<button class="btn btn-ghost" id="ip-cancel">Cancel</button>'
      + '<span id="ip-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    document.getElementById('ip-size')?.addEventListener('change', () => {
      document.getElementById('ip-cw').style.display = document.getElementById('ip-size').value === 'custom' ? '' : 'none';
      this.calcProduct();
    });
    ['ip-coz','ip-pour','ip-cost','ip-price'].forEach(fid =>
      document.getElementById(fid)?.addEventListener('input', () => this.calcProduct())
    );
    if (p) this.calcProduct();
    document.getElementById('ip-name')?.focus();
    document.getElementById('ip-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('ip-save')?.addEventListener('click', () => this.save());
  },

  getOz() {
    const v = document.getElementById('ip-size')?.value;
    if (!v || v === '') return 0;
    if (v === 'custom') return parseFloat(document.getElementById('ip-coz')?.value) || 0;
    return parseFloat(v) || 0;
  },

  calcProduct() {
    const oz    = this.getOz();
    const pour  = parseFloat(document.getElementById('ip-pour')?.value) || 0;
    const cost  = parseFloat(document.getElementById('ip-cost')?.value) || 0;
    const price = parseFloat(document.getElementById('ip-price')?.value) || 0;
    const target = App.data?.settings?.targets?.bar_pour_cost_pct || 22;
    const pours = pour > 0 ? oz / pour : null;
    const cpp   = pours ? cost / pours : null;
    const pct   = cpp && price ? cpp / price * 100 : null;
    const set   = (id, val, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = val; el.className = 'calc-val' + (cls ? ' ' + cls : ''); };
    set('ip-pours', pours ? pours.toFixed(1) : '-');
    set('ip-cpp',   cpp   ? App.fmtCurrency(cpp) : '-');
    set('ip-pct',   pct   ? App.fmtPct(pct) : '-', pct ? (pct > target ? 'warn' : 'good') : '');
  },

  // ── Save ──────────────────────────────────────────────────────────────────
  async save() {
    if (this._saving) return;
    this._saving = true;
    setTimeout(() => { this._saving = false; }, 2000);

    const name = document.getElementById('ip-name')?.value.trim();
    const err  = document.getElementById('ip-err');
    if (!name) { if (err) { err.textContent = 'Product name required.'; err.style.display = 'inline'; } this._saving = false; return; }

    const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };
    const oz    = this.getOz() || null;
    const pour  = num('ip-pour');
    const cost  = num('ip-cost');
    const price = num('ip-price');
    const pours = oz && pour ? oz / pour : null;
    const cpp   = pours && cost != null ? cost / pours : null;
    const pct   = cpp != null && price ? cpp / price * 100 : null;

    const prod = {
      id:                  this.editId || App.uid(),
      name,
      brand:               document.getElementById('ip-brand')?.value.trim() || '',
      category:            document.getElementById('ip-cat')?.value || 'Misc',
      sub_category:        document.getElementById('ip-subcat')?.value.trim() || '',
      vendor:              document.getElementById('ip-vendor')?.value.trim() || '',
      container_size_oz:   oz,
      pour_size_oz:        pour,
      unit_cost:           cost,
      menu_price:          price,
      par_level:           num('ip-par'),
      reorder_point:       num('ip-reorder'),
      primary_location:    document.getElementById('ip-loc1')?.value.trim() || '',
      secondary_location:  document.getElementById('ip-loc2')?.value.trim() || '',
      active:              !!document.getElementById('ip-active')?.checked,
      notes:               document.getElementById('ip-notes')?.value.trim() || '',
      pours_per_container: pours,
      cost_per_pour:       cpp,
      pour_cost_pct:       pct,
      created_at:          this.editId ? undefined : new Date().toISOString()
    };

    const list = this.products();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...prod };
    } else {
      list.push(prod);
    }

    const btn = document.getElementById('ip-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    const ok = await App.saveInventory();
    this._saving = false;
    this.editId = null;
    if (ok) {
      App.markSetupDone('gs_ic_products');
      this.activeCat = prod.category;
      this.renderList();
    } else if (btn) {
      btn.disabled = false;
      btn.textContent = 'Save';
      if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; }
    }
  },

  // ── Delete ────────────────────────────────────────────────────────────────
  confirmDel(ids, msg) {
    this._pendingDelIds = ids;
    const modal = document.getElementById('ip-del-modal');
    const msgEl = document.getElementById('ip-del-msg');
    if (msgEl) msgEl.textContent = msg;
    if (modal) modal.style.display = 'flex';
    document.getElementById('ip-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelIds = null; };
    document.getElementById('ip-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const ids = this._pendingDelIds || [];
      App.inventoryData.ic_products = this.products().filter(p => !ids.includes(p.id));
      this._pendingDelIds = null;
      await App.saveInventory();
      this.renderList();
    };
  },

  // ── Import (CSV / Excel with column mapping) ──────────────────────────────
  showImport() {
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">Import Products from File</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:12px;">'
      + 'Upload a CSV or Excel file exported from your POS system or distributor price list. '
      + 'Bar Cop reads your columns and shows a mapping screen so you can match them to the right fields. '
      + 'Products import into the category you map, any missing data shows as Incomplete and can be filled in afterwards.</div>'
      + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Accepted formats: CSV, XLSX, XLS</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f"><label>Select File</label><input type="file" id="ip-imp-file" accept=".csv,.xlsx,.xls" style="background:var(--input);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:8px;font-size:12px;cursor:pointer;"/></div>'
      + '</div>'
      + '<div id="ip-imp-preview"></div>'
      + '<div class="card-actions"><button class="btn btn-ghost" id="ip-cancel">Cancel</button></div>'
      + '</div></div>';

    document.getElementById('ip-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('ip-imp-file')?.addEventListener('change', ev => {
      const file = ev.target.files[0];
      if (file) this.readImportFile(file);
    });
  },

  readImportFile(file) {
    const preview = document.getElementById('ip-imp-preview');
    if (preview) preview.innerHTML = '<div style="color:var(--t3);font-size:12px;margin-top:12px;">Reading file...</div>';
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = e => this.parseCSV(e.target.result);
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = e => this.parseXLSX(e.target.result);
      reader.readAsArrayBuffer(file);
    } else {
      this.showImportError('Unsupported file type. Please use CSV or Excel.');
    }
  },

  parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) { this.showImportError('File appears empty or has only one row.'); return; }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).filter(l => l.trim()).map(line => {
      const vals = [];
      let inQ = false, cur = '';
      for (const ch of line) {
        if (ch === '"') inQ = !inQ;
        else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      vals.push(cur.trim());
      return vals;
    });
    this.showColumnMapper(headers, rows);
  },

  parseXLSX(buffer) {
    const run = () => {
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (data.length < 2) { this.showImportError('File appears empty.'); return; }
      const headers = data[0].map(h => String(h).trim());
      const rows = data.slice(1).filter(r => r.some(c => c !== '')).map(r => r.map(c => String(c).trim()));
      this.showColumnMapper(headers, rows);
    };
    if (typeof XLSX === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      script.onload = run;
      script.onerror = () => this.showImportError('Could not load the Excel reader. Try saving as CSV instead.');
      document.head.appendChild(script);
    } else {
      run();
    }
  },

  showImportError(msg) {
    const preview = document.getElementById('ip-imp-preview');
    if (preview) preview.innerHTML = '<div style="color:var(--red);font-size:12px;margin-top:12px;">' + esc(msg) + '</div>';
  },

  autoMap(headers) {
    const map = {};
    const rules = {
      name:             ['name','item','product','description','item name','product name'],
      brand:            ['brand','make','label'],
      category:         ['category','type','group','dept','department'],
      sub_category:     ['sub-category','subcategory','sub category','subtype'],
      vendor:           ['vendor','supplier','distributor','source'],
      container_size_oz:['size','bottle size','container','volume','oz','ounces'],
      pour_size_oz:     ['pour','pour size','standard pour','std pour'],
      unit_cost:        ['cost','unit cost','cogs','item cost','wholesale','price paid'],
      menu_price:       ['price','menu price','sell price','retail','selling price'],
      par_level:        ['par','par level','target stock'],
      reorder_point:    ['reorder','reorder point','min','minimum'],
    };
    headers.forEach(h => {
      const hl = h.toLowerCase().trim();
      Object.entries(rules).forEach(([field, keywords]) => {
        if (!map[field] && keywords.some(k => hl === k || hl.includes(k))) map[field] = h;
      });
    });
    return map;
  },

  showColumnMapper(headers, rows) {
    const preview = document.getElementById('ip-imp-preview');
    if (!preview) return;
    this._importRows = rows;
    this._importHeaders = headers;
    const autoMap = this.autoMap(headers);
    const fields = [
      {key:'name',             label:'Product Name',       required:true},
      {key:'brand',            label:'Brand',              required:false},
      {key:'sub_category',     label:'Sub-Category',       required:false},
      {key:'vendor',           label:'Primary Vendor',     required:false},
      {key:'container_size_oz',label:'Container Size (oz)',required:false},
      {key:'pour_size_oz',     label:'Pour Size (oz)',     required:false},
      {key:'unit_cost',        label:'Unit Cost ($)',      required:false},
      {key:'menu_price',       label:'Menu Price ($)',     required:false},
      {key:'par_level',        label:'Par Level',          required:false},
      {key:'reorder_point',    label:'Reorder Point',      required:false},
    ];
    const optsFor = sel => '<option value="">(skip)</option>'
      + headers.map(h => '<option value="' + esc(h) + '"' + (h === sel ? ' selected' : '') + '>' + esc(h) + '</option>').join('');

    let html = '<div class="divider"></div><div class="card"><div class="card-title">Map Your Columns</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:16px;">'
      + 'We found <strong style="color:var(--w);">' + rows.length + ' rows</strong> in your file. '
      + 'Match each field to your column, then choose the category these products import into.</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f w-md"><label>Import Into Category</label><select id="ipm-category">'
      + this.CATEGORIES.map(c => '<option' + (c === this.activeCat ? ' selected' : '') + '>' + c + '</option>').join('')
      + '</select></div></div>'
      + '<div class="form-row" style="flex-wrap:wrap;gap:12px 20px;">';

    fields.forEach(f => {
      html += '<div class="f" style="width:200px;flex-shrink:0;">'
        + '<label>' + f.label + (f.required ? ' <span style="color:var(--red);">*</span>' : '') + '</label>'
        + '<select id="ipm-' + f.key + '">' + optsFor(autoMap[f.key] || '') + '</select></div>';
    });

    html += '</div>'
      + '<div id="ip-imp-msg" style="font-size:12px;margin-top:12px;"></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-ghost" id="ip-cancel">Cancel</button>'
      + '<button class="btn btn-primary" id="ip-imp-run">Import ' + rows.length + ' Products</button>'
      + '</div></div>';

    preview.innerHTML = html;
    document.getElementById('ip-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('ip-imp-run')?.addEventListener('click', () => this.runImport());
  },

  async runImport() {
    const rows = this._importRows || [];
    const headers = this._importHeaders || [];
    const getCol = key => document.getElementById('ipm-' + key)?.value || '';
    const nameCol = getCol('name');
    const msg = document.getElementById('ip-imp-msg');
    if (!nameCol) {
      if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Product Name column is required.'; }
      return;
    }
    const category = document.getElementById('ipm-category')?.value || 'Misc';
    const cell = (row, col) => { const i = headers.indexOf(col); return i >= 0 ? String(row[i] || '').trim() : ''; };
    const numOf = str => { if (!str) return null; const n = parseFloat(String(str).replace(/[^0-9.]/g, '')); return isNaN(n) ? null : n; };

    const imported = [];
    rows.forEach(row => {
      const name = cell(row, nameCol);
      if (!name) return;
      const oz    = numOf(cell(row, getCol('container_size_oz')));
      const pour  = numOf(cell(row, getCol('pour_size_oz')));
      const cost  = numOf(cell(row, getCol('unit_cost')));
      const price = numOf(cell(row, getCol('menu_price')));
      const pours = oz && pour ? oz / pour : null;
      const cpp   = pours && cost != null ? cost / pours : null;
      const pct   = cpp != null && price ? cpp / price * 100 : null;
      imported.push({
        id:                  App.uid(),
        name,
        brand:               cell(row, getCol('brand')),
        category,
        sub_category:        cell(row, getCol('sub_category')),
        vendor:              cell(row, getCol('vendor')),
        container_size_oz:   oz,
        pour_size_oz:        pour,
        unit_cost:           cost,
        menu_price:          price,
        par_level:           numOf(cell(row, getCol('par_level'))),
        reorder_point:       numOf(cell(row, getCol('reorder_point'))),
        primary_location:    '',
        secondary_location:  '',
        active:              true,
        notes:               '',
        pours_per_container: pours,
        cost_per_pour:       cpp,
        pour_cost_pct:       pct,
        created_at:          new Date().toISOString(),
        imported:            true
      });
    });

    if (!imported.length) {
      if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'No rows with a product name were found.'; }
      return;
    }

    this.products().push(...imported);
    const btn = document.getElementById('ip-imp-run');
    if (btn) { btn.disabled = true; btn.textContent = 'Importing...'; }

    const ok = await App.saveInventory();
    if (ok) {
      this.activeCat = category;
      this.editId = null;
      this.renderList();
    } else if (msg) {
      if (btn) { btn.disabled = false; btn.textContent = 'Import ' + imported.length + ' Products'; }
      msg.style.color = 'var(--red)';
      msg.textContent = 'Save failed. Try again.';
    }
  }
};
