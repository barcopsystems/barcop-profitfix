'use strict';

/* ── Shift Control — 86 List (writes sc_86_list) ──────────────────────────────
   Mobile-first running list of items 86'd during service. Single unified
   entry form at the top: Item (pulled from ic_products with auto-category),
   Date/Time (pre-filled), Reported By (staff dropdown), Reason, Notes.
   New entries and edits use the same form so the operator never has to
   "click Edit to see the rest of the fields." Active cards below with
   one-tap Back-In-Stock. Repeat 86s feed Inventory Control's par alerts. */

S.Shift86List = {
  editId: null,
  customMode: false,
  _pendingDelId: null,

  // Canonical product categories live in Inventory Control's Product Setup.
  // 86 list reads from there so the lists never drift apart. Fallback only
  // if Inventory Control hasn't loaded yet (defensive).
  categories() {
    return (S.InventoryProducts && S.InventoryProducts.CATEGORIES)
      || ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
  },

  items() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_86_list)) App.shiftData.sc_86_list = [];
    return App.shiftData.sc_86_list;
  },
  products() {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
  },
  productById(id) {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
  },
  activeShift() {
    const list = (App.shiftData && App.shiftData.sc_shifts) || [];
    return list.filter(s => s.status === 'Open')
      .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())[0] || null;
  },
  nowTime() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },
  // Count of times this item name has been 86'd in the last 30 days. Used
  // to flag chronic out-of-stock items so they surface as a real signal,
  // not a one-off slammed-night event.
  repeatCount(name) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const key = (name || '').trim().toLowerCase();
    return this.items().filter(i =>
      (i.item || '').trim().toLowerCase() === key
      && new Date((i.date_86 || '') + 'T00:00:00') >= cutoff).length;
  },

  // Item dropdown: Menu Items first (most common 86 case — chef 86's the
  // specialty cocktail or daily special), then Raw Products, then Batches,
  // then a Custom entry as the escape hatch for anything Bar Cop does not
  // track yet. Selected value can be a product id, menu_item id (prefixed
  // "mi:"), batch id (prefixed "b:"), or "__custom".
  productOptions(selectedId) {
    const prods = this.products();
    const menuItems = (App.menuItems && App.menuItems()) || [];
    const batches = (App.batches && App.batches()) || [];
    const cats = this.categories();
    let h = '<option value="">Select item...</option>';

    // Menu Items first — most operators 86 menu items (a specialty cocktail,
    // a special, an entree). Grouped by menu category.
    if (menuItems.length) {
      const byMenuCat = {};
      menuItems.forEach(m => {
        const c = m.category || 'Other';
        if (!byMenuCat[c]) byMenuCat[c] = [];
        byMenuCat[c].push(m);
      });
      Object.keys(byMenuCat).sort().forEach(c => {
        h += '<optgroup label="Menu &middot; ' + esc(c) + '">';
        byMenuCat[c].sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(m => {
          const v = 'mi:' + m.id;
          h += '<option value="' + v + '"' + (selectedId === v ? ' selected' : '') + '>' + esc(m.name) + '</option>';
        });
        h += '</optgroup>';
      });
    }

    // Raw products — for ingredient-level 86s ("Tito's bottle ran out").
    cats.forEach(cat => {
      const inCat = prods.filter(p => (p.category || '') === cat)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (!inCat.length) return;
      h += '<optgroup label="Product &middot; ' + esc(cat) + '">';
      inCat.forEach(p => {
        h += '<option value="' + p.id + '"' + (selectedId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      });
      h += '</optgroup>';
    });

    // Batches — frozen margarita mix, simple syrup, etc.
    if (batches.length) {
      h += '<optgroup label="Batches">';
      batches.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(b => {
        const v = 'b:' + b.id;
        h += '<option value="' + v + '"' + (selectedId === v ? ' selected' : '') + '>' + esc(b.name) + '</option>';
      });
      h += '</optgroup>';
    }

    // Custom escape hatch — operator types a name for anything else.
    h += '<optgroup label="Custom"><option value="__custom"' + (this.customMode ? ' selected' : '') + '>Type a custom item</option></optgroup>';
    return h;
  },

  // ── Entry ──────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="el-export">Export PDF</button>';
    document.getElementById('el-export')?.addEventListener('click', () => window.print());
    this.editId = null;
    this.customMode = false;
    this.renderMain();
  },

  catBadge(cat) {
    return '<span class="badge badge-dim">' + esc(cat || 'Other') + '</span>';
  },

  // ── Unified entry form ────────────────────────────────────────────────────
  // Used for both NEW and EDIT. State is on this.editId (null = new, id = edit).
  // All fields shown from the start so the operator never has to "click Edit
  // to see the rest." Date/time/reported-by pre-fill with sensible defaults
  // so the fast path (slammed shift, log it now) is still one click.
  entryFormHTML() {
    const editing = !!this.editId;
    const i = editing ? this.items().find(x => x.id === this.editId) : null;
    const activeMgr = (this.activeShift() || {}).manager_id || '';

    // Resolve the saved item back to its source (menu item, product, batch).
    // Legacy items saved as free text get matched by name to a product or
    // menu item; new items have a typed source_id.
    const savedSourceType = i?.source_type || (i?.product_id ? 'product' : '');
    const savedSourceId   = i?.menu_item_id || i?.product_id || i?.batch_id || '';
    const savedItemName   = i?.item || '';
    let initialPickedValue = '';
    if (savedSourceType === 'menu_item' || (i?.menu_item_id)) initialPickedValue = 'mi:' + (i.menu_item_id || savedSourceId);
    else if (savedSourceType === 'batch' || (i?.batch_id))    initialPickedValue = 'b:' + (i.batch_id || savedSourceId);
    else if (savedSourceId)                                    initialPickedValue = savedSourceId;
    else if (savedItemName) {
      // Legacy: try to match free-text name to a menu item, then a product
      const mi = ((App.menuItems && App.menuItems()) || []).find(m => m.name === savedItemName);
      if (mi) initialPickedValue = 'mi:' + mi.id;
      else {
        const p = this.products().find(x => x.name === savedItemName);
        if (p) initialPickedValue = p.id;
      }
    }
    const isCustomItem = editing && !initialPickedValue && !!savedItemName;
    this.customMode = isCustomItem;

    const dateVal = i?.date_86 || new Date().toISOString().slice(0, 10);
    const timeVal = i?.time_86 || this.nowTime();
    const reportedBy = i?.reported_by_id || i?.reported_by || activeMgr;

    return '<div class="card">'
      + '<div class="card-title">' + (editing ? 'Edit 86 Entry' : '86 An Item') + '</div>'
      + (editing ? '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">Editing the entry below. Save to apply or Cancel to go back to logging new items.</div>' : '')

      // Row 1: item picker (full width) — biggest cell because this is the
      // primary action. Custom text field appears below when "Custom" picked.
      + '<div class="form-row" style="gap:14px;align-items:flex-end;">'
        + '<div class="f" style="flex:1;min-width:240px;"><label>Item</label>'
        + '<select id="qa-item" style="height:48px;font-size:15px;">' + this.productOptions(initialPickedValue) + '</select></div>'
      + '</div>'
      + '<div id="qa-custom-wrap" class="form-row" style="gap:14px;' + (isCustomItem ? '' : 'display:none;') + '">'
        + '<div class="f" style="flex:1;min-width:240px;"><label>Custom Item Name</label>'
        + '<input type="text" id="qa-custom" value="' + esc(isCustomItem ? savedItemName : '') + '" placeholder="What ran out?" style="height:48px;font-size:15px;"/></div>'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Category</label>'
        + '<select id="qa-custom-cat" style="height:48px;">'
          + this.categories().map(c => '<option' + ((isCustomItem && i?.category === c) ? ' selected' : '') + '>' + esc(c) + '</option>').join('')
        + '</select></div>'
      + '</div>'

      // Row 2: when / who. Pre-filled so fast path stays fast.
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Date</label>'
        + '<input type="date" id="qa-date" value="' + esc(dateVal) + '" style="height:48px;"/></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Time</label>'
        + '<input type="time" id="qa-time" value="' + esc(timeVal) + '" style="height:48px;"/></div>'
        + '<div class="f" style="width:220px;flex-shrink:0;"><label>Reported By</label>'
        + '<select id="qa-by" style="height:48px;">' + App.staffOptions(reportedBy, { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'

      // Row 3: reason (full width). Common reasons hinted in placeholder.
      + '<div class="form-row" style="gap:14px;"><div class="f" style="width:100%;"><label>Reason <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
        + '<input type="text" id="qa-reason" value="' + esc(i?.reason || '') + '" placeholder="Ran the case, delivery short, equipment down, etc."/></div></div>'

      // Row 4: notes (full width).
      + '<div class="form-row" style="gap:14px;"><div class="f" style="width:100%;"><label>Notes <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
        + '<textarea id="qa-notes" rows="2" placeholder="Anything the next shift needs to know">' + esc(i?.notes || '') + '</textarea></div></div>'

      + '<div class="card-actions">'
        + '<button class="btn btn-primary btn-lg" id="qa-go">' + (editing ? 'Update' : '86 It') + '</button>'
        + (editing ? '<button class="btn btn-ghost" id="qa-cancel">Cancel</button>' : '')
        + '<span id="qa-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>'
    + '</div>';
  },

  renderMain() {
    const all = this.items();
    const active = all.filter(i => i.status !== 'Back')
      .sort((a, b) => new Date(b.created_at || b.date_86).getTime() - new Date(a.created_at || a.date_86).getTime());
    const back = all.filter(i => i.status === 'Back')
      .sort((a, b) => new Date(b.date_back || b.created_at || 0).getTime() - new Date(a.date_back || a.created_at || 0).getTime())
      .slice(0, 12);

    let activeCards;
    if (active.length === 0) {
      activeCards = '<div class="card"><div class="card-title">Currently 86\'d</div>'
        + '<div style="font-size:13px;color:var(--t3);padding:6px 0;">Nothing is 86\'d right now. The full bar and kitchen are available.</div></div>';
    } else {
      activeCards = '<div class="card"><div class="card-title">Currently 86\'d &middot; ' + active.length + '</div>'
        + active.map(i => {
          const reps = this.repeatCount(i.item);
          const repTag = reps > 1
            ? '<span class="badge badge-warn" style="margin-left:8px;">86\'d ' + reps + '&times; / 30d</span>'
            : '';
          const isEditing = this.editId === i.id;
          return '<div class="ei-86" data-id="' + i.id + '" style="border:1px solid ' + (isEditing ? 'var(--gold)' : 'var(--b1)') + ';border-radius:6px;padding:14px;margin-bottom:10px;' + (isEditing ? 'background:rgba(218,171,70,0.06);' : '') + '">'
            + '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px;">'
            + '<span style="font-size:16px;font-weight:700;color:var(--t1);">' + esc(i.item) + '</span>'
            + this.catBadge(i.category) + repTag
            + (isEditing ? '<span style="font-size:9px;font-weight:800;letter-spacing:1.5px;color:var(--gold);">EDITING</span>' : '')
            + '</div>'
            + '<div style="font-size:12px;color:var(--t3);margin-bottom:12px;">86\'d ' + this.fmtDate(i.date_86)
            + (i.time_86 ? ' at ' + esc(i.time_86) : '')
            + (i.reason ? ' &middot; ' + esc(i.reason) : '')
            + (i.reported_by ? ' &middot; by ' + esc(i.reported_by) : '') + '</div>'
            + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
            + '<button class="btn btn-primary ei-back" data-id="' + i.id + '" style="height:44px;">Back In Stock</button>'
            + (App.canEdit('sc-86-list') ? '<button class="btn btn-ghost ei-edit" data-id="' + i.id + '" style="height:44px;">Edit</button>' : '')
            + (App.canEdit('sc-86-list') ? '<button class="btn btn-danger ei-del" data-id="' + i.id + '" style="height:44px;">Delete</button>' : '')
            + '</div></div>';
        }).join('') + '</div>';
    }

    let backCard = '';
    if (back.length > 0) {
      const rows = back.map(i => '<tr><td><div class="val">' + esc(i.item) + '</div></td>'
        + '<td>' + esc(i.category || '-') + '</td>'
        + '<td>' + this.fmtDate(i.date_86) + '</td>'
        + '<td>' + this.fmtDate(i.date_back) + '</td>'
        + '<td><div class="row-actions">'
        + '<button class="btn btn-ghost btn-sm ei-re86" data-id="' + i.id + '">Re-86</button>'
        + (App.canEdit('sc-86-list') ? '<button class="btn btn-danger btn-sm ei-del" data-id="' + i.id + '">Delete</button>' : '')
        + '</div></td></tr>').join('');
      backCard = '<div class="card"><div class="card-title">Recently Back In Stock</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Item</th><th>Category</th><th>86\'d</th><th>Back</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    const modal = '<div id="ei-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this 86 entry?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="ei-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="ei-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + this.entryFormHTML() + activeCards + backCard + '</div>' + modal;
    this.wireMain();
  },

  wireMain() {
    this.container.onclick = ev => {
      const back = ev.target.closest('.ei-back');
      const edit = ev.target.closest('.ei-edit');
      const del = ev.target.closest('.ei-del');
      const re86 = ev.target.closest('.ei-re86');
      if (ev.target.closest('#qa-go')) this.save();
      else if (ev.target.closest('#qa-cancel')) { this.editId = null; this.customMode = false; this.renderMain(); }
      else if (back) this.markBack(back.dataset.id);
      else if (edit) {
        this.editId = edit.dataset.id;
        this.customMode = false;
        this.renderMain();
        // Scroll the entry form into view since it's where the editing happens.
        const form = this.container.querySelector('.card');
        if (form && form.scrollIntoView) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      else if (re86) this.re86(re86.dataset.id);
      else if (del)  this.confirmDel(del.dataset.id);
    };

    // Item picker change: show/hide the custom text field. When a real
    // product is picked, the category is implicit (no operator-set category
    // needed — comes from the product master).
    document.getElementById('qa-item')?.addEventListener('change', e => {
      const isCustom = e.target.value === '__custom';
      this.customMode = isCustom;
      const wrap = document.getElementById('qa-custom-wrap');
      if (wrap) wrap.style.display = isCustom ? '' : 'none';
      if (isCustom) document.getElementById('qa-custom')?.focus();
    });

    // Enter key on item picker / custom text → save (fast path for slammed shifts)
    document.getElementById('qa-custom')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.save();
    });
  },

  async save() {
    const err = document.getElementById('qa-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };

    let itemName = '';
    let category = '';
    let productId = '';
    let menuItemId = '';
    let batchId = '';
    let sourceType = '';

    const pickedValue = document.getElementById('qa-item')?.value || '';
    if (pickedValue === '__custom' || this.customMode) {
      itemName = document.getElementById('qa-custom')?.value.trim() || '';
      category = document.getElementById('qa-custom-cat')?.value || 'Misc';
      sourceType = 'custom';
      if (!itemName) { fail('Type a custom item name.'); return; }
    } else if (pickedValue.startsWith('mi:')) {
      const id = pickedValue.slice(3);
      const m = (App.menuItems && App.menuItems().find(x => x.id === id)) || null;
      if (!m) { fail('Pick a menu item.'); return; }
      itemName    = m.name;
      category    = m.category || 'Menu Item';
      menuItemId  = m.id;
      sourceType  = 'menu_item';
    } else if (pickedValue.startsWith('b:')) {
      const id = pickedValue.slice(2);
      const b = (App.batches && App.batches().find(x => x.id === id)) || null;
      if (!b) { fail('Pick a batch.'); return; }
      itemName   = b.name;
      category   = b.category || 'Batch';
      batchId    = b.id;
      sourceType = 'batch';
    } else if (pickedValue) {
      const p = this.productById(pickedValue);
      if (!p) { fail('Pick a product.'); return; }
      itemName   = p.name;
      category   = p.category || 'Misc';
      productId  = p.id;
      sourceType = 'product';
    } else {
      fail('Pick an item to 86.');
      return;
    }

    const date = document.getElementById('qa-date')?.value || new Date().toISOString().slice(0, 10);
    const time = document.getElementById('qa-time')?.value || this.nowTime();
    const reportedById = document.getElementById('qa-by')?.value || '';
    const reportedBy   = (App.staffById(reportedById) || {}).name || '';
    const reason = document.getElementById('qa-reason')?.value.trim() || '';
    const notes  = document.getElementById('qa-notes')?.value.trim() || '';

    const list = this.items();
    const baseFields = {
      item: itemName, category,
      product_id:   productId,
      menu_item_id: menuItemId,
      batch_id:     batchId,
      source_type:  sourceType,
      date_86: date, time_86: time,
      reported_by_id: reportedById, reported_by: reportedBy,
      reason, notes
    };
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...baseFields };
    } else {
      list.push({
        id:           App.uid(),
        ...baseFields,
        status:       '86',
        date_back:    '',
        created_at:   new Date().toISOString()
      });
    }

    const btn = document.getElementById('qa-go');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveShift();
    this.editId = null;
    this.customMode = false;
    if (ok) this.renderMain();
    else {
      if (btn) { btn.disabled = false; btn.textContent = '86 It'; }
      fail('Save failed. Try again.');
    }
  },

  async markBack(id) {
    const it = this.items().find(x => x.id === id);
    if (!it) return;
    it.status = 'Back';
    it.date_back = new Date().toISOString().slice(0, 10);
    it.time_back = this.nowTime();
    await App.saveShift();
    this.renderMain();
  },

  async re86(id) {
    const it = this.items().find(x => x.id === id);
    if (!it) return;
    it.status = '86';
    it.date_86 = new Date().toISOString().slice(0, 10);
    it.time_86 = this.nowTime();
    it.date_back = '';
    it.time_back = '';
    await App.saveShift();
    this.renderMain();
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('ei-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('ei-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('ei-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.shiftData.sc_86_list = this.items().filter(x => x.id !== delId);
      if (this.editId === delId) { this.editId = null; this.customMode = false; }
      await App.saveShift();
      this.renderMain();
    };
  }
};
