'use strict';

/* ── Shift Control — 86 List (writes sc_86_list) ──────────────────────────────
   Mobile-first running list of items 86'd during service. Single unified
   entry form at the top with TWO pickers side by side:
     - Menu Item  — full menu list from Revenue Recovery
     - Inventory Item — products + prep batches from Inventory Control
   Pickers are mutually exclusive (one 86 record per save). Custom escape
   hatch for items Bar Cop doesn't track.

   Cross-reference: when an Inventory Item is picked, the form surfaces
   the menu items and prep batches that USE it, with checkboxes to also
   86 them in the same save. When a Menu Item is picked, the recipe
   ingredients show as informational chips (those products stay on the
   shelf for other items). */

S.Shift86List = {
  editId: null,
  customMode: false,
  alsoIds: {},          // { itemKey: true } for dependents checked to also-86
  _pendingDelId: null,
  _draft: null,         // in-memory inline-form draft (survives leave/return)

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
  menuItems() { return (App.menuItems && App.menuItems()) || []; },
  menuItemById(id) { return this.menuItems().find(m => m.id === id) || null; },
  prepBatches() { return (App.prepBatches && App.prepBatches()) || []; },
  prepBatchById(id) { return this.prepBatches().find(b => b.id === id) || null; },

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
  repeatCount(name) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const key = (name || '').trim().toLowerCase();
    return this.items().filter(i =>
      (i.item || '').trim().toLowerCase() === key
      && new Date((i.date_86 || '') + 'T00:00:00') >= cutoff).length;
  },

  // ── Picker option builders ──────────────────────────────────────────────
  menuItemOptions(selectedId) {
    const items = this.menuItems();
    let h = '<option value="">Select menu item...</option>';
    if (!items.length) {
      h += '<option value="" disabled>No menu items set up</option>';
      return h;
    }
    const byCat = {};
    items.forEach(m => {
      const c = m.category || 'Other';
      if (!byCat[c]) byCat[c] = [];
      byCat[c].push(m);
    });
    Object.keys(byCat).sort().forEach(c => {
      h += '<optgroup label="' + esc(c) + '">';
      byCat[c].sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(m => {
        h += '<option value="' + m.id + '"' + (selectedId === m.id ? ' selected' : '') + '>' + esc(m.name) + '</option>';
      });
      h += '</optgroup>';
    });
    return h;
  },

  // Inventory Item picker: products grouped by IC category, then prep batches.
  // Selected value is prefixed: "p:<id>" for product, "b:<id>" for batch.
  inventoryItemOptions(selectedKey) {
    const prods = this.products();
    const batches = this.prepBatches();
    let h = '<option value="">Select inventory item...</option>';
    if (!prods.length && !batches.length) {
      h += '<option value="" disabled>No inventory items set up</option>';
      return h;
    }
    this.categories().forEach(cat => {
      const inCat = prods.filter(p => (p.category || '') === cat)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (!inCat.length) return;
      h += '<optgroup label="' + esc(cat) + '">';
      inCat.forEach(p => {
        const v = 'p:' + p.id;
        h += '<option value="' + v + '"' + (selectedKey === v ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      });
      h += '</optgroup>';
    });
    if (batches.length) {
      h += '<optgroup label="Prep Batches">';
      batches.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(b => {
        const v = 'b:' + b.id;
        h += '<option value="' + v + '"' + (selectedKey === v ? ' selected' : '') + '>' + esc(b.name) + '</option>';
      });
      h += '</optgroup>';
    }
    return h;
  },

  // ── Dependency lookups ──────────────────────────────────────────────────
  // Each recipe ingredient row: { source: 'product'|'batch', id, quantity }
  // (legacy shape { product_id, quantity } also accepted)
  ingredientMatches(ing, kind, id) {
    const ingSrc = ing.source || (ing.product_id ? 'product' : null);
    const ingId  = ing.id || ing.product_id;
    return ingSrc === kind && ingId === id;
  },
  menuItemsUsingProduct(productId) {
    return this.menuItems().filter(m =>
      m.recipe && Array.isArray(m.recipe.ingredients)
      && m.recipe.ingredients.some(ing => this.ingredientMatches(ing, 'product', productId))
    );
  },
  prepBatchesUsingProduct(productId) {
    return this.prepBatches().filter(b =>
      Array.isArray(b.ingredients)
      && b.ingredients.some(ing => (ing.product_id || ing.id) === productId)
    );
  },
  menuItemsUsingBatch(batchId) {
    return this.menuItems().filter(m =>
      m.recipe && Array.isArray(m.recipe.ingredients)
      && m.recipe.ingredients.some(ing => this.ingredientMatches(ing, 'batch', batchId))
    );
  },
  recipeIngredientsOf(menuItem) {
    if (!menuItem?.recipe?.ingredients) return [];
    return menuItem.recipe.ingredients.map(ing => {
      const src = ing.source || (ing.product_id ? 'product' : null);
      const id  = ing.id || ing.product_id;
      if (src === 'batch') {
        const b = this.prepBatchById(id);
        return b ? { kind: 'batch', id, name: b.name } : null;
      }
      const p = this.productById(id);
      return p ? { kind: 'product', id, name: p.name } : null;
    }).filter(Boolean);
  },

  // Is this item already 86'd and currently active (not Back)?
  isCurrently86(kind, id, name) {
    return this.items().some(it => {
      if (it.status === 'Back') return false;
      if (kind === 'menu_item' && it.menu_item_id === id) return true;
      if (kind === 'product'   && it.product_id   === id) return true;
      if (kind === 'batch'     && it.batch_id     === id) return true;
      if (kind === 'custom' && name && (it.item || '').toLowerCase() === name.toLowerCase()) return true;
      return false;
    });
  },

  // ── Entry ──────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';   // Export / Worksheet live on the Currently 86'd card now
    this.editId = null;
    // Keep the custom toggle + also-86 checks when returning to an unsaved draft;
    // only a clean visit starts fresh.
    if (!this._draft) { this.customMode = false; this.alsoIds = {}; }
    this.renderMain();
  },

  showHowTo() {
    App.showHelpModal('How the 86 List Works', [
      { p: ['The 86 List is your running list of what ran out during service. 86 an item the moment it is gone so the next bartender, the servers, and the kitchen all see it, and so the par-alert and the audit catch the repeat offenders.'] },
      { h: '86 an item', p: ['Pick a menu item OR an inventory item (products and prep batches). If Bar Cop does not track it, add it as a custom item. When you pick an inventory item, Bar Cop flags the menu items and batches that use it so you can 86 those in the same save.'] },
      { h: 'Currently 86\'d', p: ['Everything that is out right now. Back In Stock clears it and drops it to the Back In Stock list below; if it runs out again before close, hit Re-86 on that row to put it right back up. An item 86\'d more than once in 30 days gets flagged so you can chase the real cause.'] },
      { h: 'Worksheet and Export', p: ['Worksheet prints a blank sheet to mark 86s by hand during the rush, then enter them after close. Export PDF saves the current list.'] }
    ]);
  },

  catText(cat) {
    return '<span style="color:var(--t3);font-size:12px;font-weight:600;">' + esc(cat || 'Other') + '</span>';
  },
  srcText(srcType) {
    const map = { menu_item: 'Menu', batch: 'Batch', product: 'Product', custom: 'Custom' };
    const lbl = map[srcType];
    return lbl ? '<span style="color:var(--t3);font-size:11px;">' + lbl + '</span>' : '';
  },

  // ── Entry form ─────────────────────────────────────────────────────────
  // Shared 86 field body (pickers, custom toggle, cross-ref slot, when/who,
  // reason, notes). Used by the landing card and the running-shift log pop-up.
  // i = a record/preset for defaults, or null for a blank new 86.
  entryFields(i) {
    const editing = !!(i && i.id);
    const activeMgr = (this.activeShift() || {}).manager_id || '';

    // Resolve saved record back to picker state.
    const savedSourceType = i?.source_type || (i?.product_id ? 'product' : '');
    const initialMenuItemId = i?.menu_item_id || (savedSourceType === 'menu_item' ? '' : '');
    let initialInventoryKey = '';
    if (i?.product_id) initialInventoryKey = 'p:' + i.product_id;
    else if (i?.batch_id) initialInventoryKey = 'b:' + i.batch_id;
    const savedItemName = i?.item || '';
    const isCustomItem = editing && !initialMenuItemId && !initialInventoryKey && !!savedItemName;
    if (editing) this.customMode = isCustomItem;

    const dateVal = i?.date_86 || App.todayLocal();
    const timeVal = i?.time_86 || this.nowTime();
    const reportedBy = i?.reported_by_id || i?.reported_by || activeMgr;

    return ''

      // Row 1: Menu Item, Inventory Item, Date, Time, Reported By
      + '<div class="form-row" style="gap:14px;align-items:flex-end;">'
        + '<div class="f" style="flex:1;min-width:200px;"><label>Menu Item</label>'
          + '<select id="qa-menu">' + this.menuItemOptions(initialMenuItemId) + '</select></div>'
        + '<div class="f" style="flex:1;min-width:200px;"><label>Inventory Item</label>'
          + '<select id="qa-inv">' + this.inventoryItemOptions(initialInventoryKey) + '</select></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
          + '<input type="date" id="qa-date" value="' + esc(dateVal) + '"/></div>'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Time</label>'
          + '<input type="time" id="qa-time" value="' + esc(timeVal) + '"/></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Reported By</label>'
          + '<select id="qa-by">' + App.staffOptions(reportedBy, { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'

      // Custom escape link + reveal panel
      + '<div style="margin:8px 0 0 0;font-size:11px;color:var(--t3);">'
        + (isCustomItem
            ? '<a href="#" id="qa-custom-cancel" style="color:var(--gold);">Cancel custom item</a>'
            : '<a href="#" id="qa-custom-toggle" style="color:var(--gold);">+ Item not tracked? Add as custom</a>')
      + '</div>'
      + '<div id="qa-custom-wrap" class="form-row" style="gap:14px;margin-top:10px;' + (isCustomItem ? '' : 'display:none;') + '">'
        + '<div class="f" style="flex:1;min-width:240px;"><label>Custom Item Name</label>'
          + '<input type="text" id="qa-custom" value="' + esc(isCustomItem ? savedItemName : '') + '" placeholder="What ran out?"/></div>'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Category</label>'
          + '<select id="qa-custom-cat">'
            + this.categories().map(c => '<option' + ((isCustomItem && i?.category === c) ? ' selected' : '') + '>' + esc(c) + '</option>').join('')
          + '</select></div>'
      + '</div>'

      // Cross-reference panel — populated by recomputeCrossRef()
      + '<div id="qa-xref" style="margin:14px 0;"></div>'

      + '<div class="form-row" style="gap:14px;"><div class="f" style="width:100%;"><label>Reason <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
        + '<input type="text" id="qa-reason" value="' + esc(i?.reason || '') + '" placeholder="Ran the case, delivery short, equipment down, etc."/></div></div>'

      + '<div class="form-row" style="gap:14px;"><div class="f" style="width:100%;"><label>Notes <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
        + '<textarea id="qa-notes" class="notes-ta" rows="2" placeholder="Anything the next shift needs to know">' + esc(i?.notes || '') + '</textarea></div></div>';
  },

  entryFormHTML() {
    return '<div class="card form-card no-print">'
      + App.collapsibleCardTitle('sc-86-list', '86 An Item')
      + '<div class="collapse-body">'
      + this.entryFields(null)
      + '</div></div>'
      // Primary action + Start Over below the card (bottom-left), hidden with the
      // card on collapse.
      + '<div data-collapse-group="sc-86-list" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary" id="qa-go">86 It</button>'
        + '<button class="btn btn-ghost" id="qa-startover">Start Over</button>'
        + '<span id="qa-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';
  },

  // ── Cross-reference panel ──────────────────────────────────────────────
  recomputeCrossRef() {
    const wrap = document.getElementById('qa-xref');
    if (!wrap) return;
    const menuId = document.getElementById('qa-menu')?.value || '';
    const invKey = document.getElementById('qa-inv')?.value || '';
    const isCustom = this.customMode;

    if (isCustom || (!menuId && !invKey)) { wrap.innerHTML = ''; return; }

    if (menuId) {
      // Menu item picked — show recipe ingredients (informational, no checkboxes)
      const item = this.menuItemById(menuId);
      if (!item) { wrap.innerHTML = ''; return; }
      const ings = this.recipeIngredientsOf(item);
      if (!ings.length) {
        wrap.innerHTML = '<div style="font-size:11px;color:var(--t3);padding:10px 12px;background:var(--input);border-radius:4px;line-height:1.6;">'
          + '<strong style="color:var(--t1);">Heads-up.</strong> No recipe attached to ' + esc(item.name) + '. Add one in Menu Items so you get full cross-reference next time.'
          + '</div>';
        return;
      }
      const chips = ings.map(g =>
        '<span style="display:inline-block;background:var(--input);border:1px solid var(--b2);border-radius:14px;padding:4px 10px;font-size:11px;color:var(--t2);margin:0 6px 6px 0;">'
        + esc(g.name) + ' <span style="color:var(--t4);font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-left:4px;">' + (g.kind === 'batch' ? 'batch' : 'product') + '</span>'
        + '</span>'
      ).join('');
      wrap.innerHTML = '<div style="font-size:11px;color:var(--t3);padding:12px 14px;background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:4px;line-height:1.6;">'
        + '<div style="font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:1px;font-size:9px;margin-bottom:6px;">Recipe references</div>'
        + '<div>' + chips + '</div>'
        + '<div style="margin-top:6px;color:var(--t3);">These stay available for other menu items. 86 them separately if any of them ran out.</div>'
      + '</div>';
      return;
    }

    if (invKey) {
      // Inventory item picked — show dependents with checkboxes
      const kind = invKey.startsWith('b:') ? 'batch' : 'product';
      const id   = invKey.slice(2);
      let dependents = [];
      if (kind === 'product') {
        const menuDeps = this.menuItemsUsingProduct(id).map(m => ({ kind: 'menu_item', id: m.id, name: m.name }));
        const batchDeps = this.prepBatchesUsingProduct(id).map(b => ({ kind: 'batch', id: b.id, name: b.name }));
        dependents = [...menuDeps, ...batchDeps];
      } else {
        dependents = this.menuItemsUsingBatch(id).map(m => ({ kind: 'menu_item', id: m.id, name: m.name }));
      }
      // Filter out anything already 86'd and active
      dependents = dependents.filter(d => !this.isCurrently86(d.kind, d.id));

      if (!dependents.length) {
        wrap.innerHTML = '<div style="font-size:11px;color:var(--t3);padding:10px 12px;background:var(--input);border-radius:4px;line-height:1.6;">'
          + 'No other menu items or batches use this. Clean 86 — no cross-impact.'
        + '</div>';
        return;
      }

      const checks = dependents.map(d => {
        const key = d.kind + ':' + d.id;
        const checked = this.alsoIds[key] ? ' checked' : '';
        const label = d.kind === 'batch' ? 'batch' : 'menu item';
        return '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;">'
          + '<input type="checkbox" class="qa-also" data-key="' + esc(key) + '" data-kind="' + d.kind + '" data-id="' + esc(d.id) + '" data-name="' + esc(d.name) + '"' + checked + ' style="accent-color:var(--gold);width:16px;height:16px;cursor:pointer;"/>'
          + '<span style="font-size:13px;color:var(--t1);font-weight:600;">' + esc(d.name) + '</span>'
          + '<span style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:1px;">' + label + '</span>'
        + '</label>';
      }).join('');

      wrap.innerHTML = '<div style="font-size:12px;color:var(--t1);padding:12px 14px;background:rgba(218,171,70,0.08);border:1px solid rgba(218,171,70,0.4);border-radius:4px;line-height:1.6;">'
        + '<div style="font-weight:700;text-transform:uppercase;letter-spacing:1px;font-size:10px;color:var(--gold);margin-bottom:8px;">Heads-up &middot; also 86?</div>'
        + '<div style="font-size:11px;color:var(--t2);margin-bottom:6px;">This product / batch is used in:</div>'
        + checks
        + '<div style="margin-top:8px;font-size:10px;color:var(--t3);">Check any that need 86\'d too. Saving creates one 86 entry per checkbox plus the primary.</div>'
      + '</div>';

      // Wire checkboxes
      wrap.querySelectorAll('.qa-also').forEach(cb => {
        cb.addEventListener('change', e => {
          const key = e.target.dataset.key;
          if (e.target.checked) this.alsoIds[key] = { kind: e.target.dataset.kind, id: e.target.dataset.id, name: e.target.dataset.name };
          else delete this.alsoIds[key];
        });
      });
    }
  },

  renderMain() {
    const all = this.items();
    const active = all.filter(i => i.status !== 'Back')
      .sort((a, b) => new Date(b.created_at || b.date_86).getTime() - new Date(a.created_at || a.date_86).getTime());
    const back = all.filter(i => i.status === 'Back')
      .sort((a, b) => new Date(b.date_back || b.created_at || 0).getTime() - new Date(a.date_back || a.created_at || 0).getTime())
      .slice(0, 50);

    const canEdit = App.canEdit('sc-86-list');
    const ew = '<div style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" id="el-export">Export PDF</button><button class="btn btn-ghost btn-sm" id="el-print-blank">Worksheet</button></div>';
    const activeHeading = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Currently 86\'d' + (active.length ? ' &middot; ' + active.length : '') + '</div>' + ew + '</div>';

    let activeBody;
    if (active.length === 0) {
      activeBody = '<div style="font-size:13px;color:var(--t3);padding:6px 2px;">Nothing is 86\'d right now. The full bar and kitchen are available.</div>';
    } else {
      const rows = active.map(i => {
        const reps = this.repeatCount(i.item);
        const repText = reps > 1 ? ' <span style="color:var(--amber);font-size:11px;font-weight:700;">86\'d ' + reps + '&times;/30d</span>' : '';
        const srcTxt = this.srcText(i.source_type);
        return '<tr>'
          + '<td><div class="val">' + esc(i.item) + repText + '</div>' + (srcTxt ? '<div>' + srcTxt + '</div>' : '') + '</td>'
          + '<td>' + esc(i.category || '-') + '</td>'
          + '<td>' + this.fmtDate(i.date_86) + (i.time_86 ? '<div style="font-size:10px;color:var(--t3);">' + esc(i.time_86) + '</div>' : '') + '</td>'
          + '<td>' + esc(i.reported_by || '-') + '</td>'
          + '<td>' + esc(i.reason || '-') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-primary btn-sm ei-back" data-id="' + i.id + '">Back In Stock</button>'
          + (canEdit ? '<button class="btn btn-ghost btn-sm ei-edit" data-id="' + i.id + '">Edit</button>' : '')
          + (canEdit ? '<button class="btn btn-danger btn-sm ei-del" data-id="' + i.id + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');
      activeBody = '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Item</th><th>Category</th><th>86\'d</th><th>Reported By</th><th>Reason</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    let backBody = '';
    if (back.length > 0) {
      const rows = back.map(i => '<tr><td><div class="val">' + esc(i.item) + '</div></td>'
        + '<td>' + esc(i.category || '-') + '</td>'
        + '<td>' + this.fmtDate(i.date_86) + '</td>'
        + '<td>' + this.fmtDate(i.date_back) + '</td>'
        + '<td><div class="row-actions">'
        + '<button class="btn btn-ghost btn-sm ei-re86" data-id="' + i.id + '">Re-86</button>'
        + (canEdit ? '<button class="btn btn-danger btn-sm ei-del" data-id="' + i.id + '">Delete</button>' : '')
        + '</div></td></tr>').join('');
      backBody = '<div class="sh" style="margin:24px 0 10px;">Back In Stock</div>'
        + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Item</th><th>Category</th><th>86\'d</th><th>Back</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + this.entryFormHTML() + activeHeading + activeBody + backBody + '</div>';
    App.applyCollapsed(this.container);
    this.wireMain();
    this.recomputeCrossRef();
  },

  wireMain() {
    this.container.onclick = ev => {
      const head = ev.target.closest('.card-collapse-head');
      if (head && !ev.target.closest('.btn')) { App.toggleCollapse(head); return; }
      if (ev.target.closest('#el-export')) { App.exportPDF({ title: '86 List', root: this.container }); return; }
      if (ev.target.closest('#el-print-blank')) { this.printBlank(); return; }
      const back = ev.target.closest('.ei-back');
      const edit = ev.target.closest('.ei-edit');
      const del = ev.target.closest('.ei-del');
      const re86 = ev.target.closest('.ei-re86');
      if (ev.target.closest('#qa-go')) this.save();
      else if (ev.target.closest('#qa-startover')) this.startOver();
      else if (ev.target.closest('#qa-custom-toggle')) { ev.preventDefault(); this.toggleCustom(true); }
      else if (ev.target.closest('#qa-custom-cancel'))  { ev.preventDefault(); this.toggleCustom(false); }
      else if (back) this.markBack(back.dataset.id);
      else if (edit) this.openEditModal(edit.dataset.id);
      else if (re86) this.re86(re86.dataset.id);
      else if (del)  this.confirmDel(del.dataset.id);
    };

    this.wireFormInputs();

    // Hold the in-progress 86 through leave/return: restore the id'd fields, re-
    // reveal the custom panel if it was open, then capture on every input. The
    // cross-ref panel recomputes right after this in renderMain.
    const formRoot = this.container.querySelector('.collapse-body');
    if (formRoot) {
      if (this._draft) {
        App.restoreDraft(formRoot, this._draft);
        if (this.customMode) this.toggleCustom(true, true);
      }
      const cap = () => { this._draft = App.captureDraft(formRoot); };
      formRoot.addEventListener('input', cap);
      formRoot.addEventListener('change', cap);
    }
  },

  // Reset the entry form to a fresh blank 86 (clears pickers, custom mode, the
  // also-86 checks, reason/notes, and resets the date/time to now).
  startOver() {
    this.editId = null;
    this.customMode = false;
    this.alsoIds = {};
    this._draft = null;
    this.renderMain();
  },

  // Picker mutex (Menu vs Inventory) + cross-ref refresh. Shared by the landing
  // form and the running-shift log pop-up.
  wireFormInputs() {
    document.getElementById('qa-menu')?.addEventListener('change', e => {
      if (e.target.value) {
        // Clear inventory picker
        const inv = document.getElementById('qa-inv');
        if (inv) inv.value = '';
        // Clear custom mode
        if (this.customMode) this.toggleCustom(false, true);
      }
      this.alsoIds = {};
      this.recomputeCrossRef();
    });
    document.getElementById('qa-inv')?.addEventListener('change', e => {
      if (e.target.value) {
        const menu = document.getElementById('qa-menu');
        if (menu) menu.value = '';
        if (this.customMode) this.toggleCustom(false, true);
      }
      this.alsoIds = {};
      this.recomputeCrossRef();
    });
  },

  toggleCustom(on, skipRecompute) {
    this.customMode = on;
    const wrap = document.getElementById('qa-custom-wrap');
    if (wrap) wrap.style.display = on ? '' : 'none';
    if (on) {
      // Clear dropdowns
      const menu = document.getElementById('qa-menu'); if (menu) menu.value = '';
      const inv  = document.getElementById('qa-inv');  if (inv)  inv.value  = '';
      this.alsoIds = {};
      setTimeout(() => document.getElementById('qa-custom')?.focus(), 50);
    }
    // Swap the link label without re-rendering the whole form
    const linkArea = wrap?.parentElement?.querySelector('a');
    // Simpler: just re-render main if state diverged enough
    if (!skipRecompute) this.recomputeCrossRef();
    // Update the toggle/cancel link text
    const toggle = document.getElementById('qa-custom-toggle');
    const cancel = document.getElementById('qa-custom-cancel');
    if (on) {
      if (toggle) {
        toggle.id = 'qa-custom-cancel';
        toggle.textContent = 'Cancel custom item';
      }
    } else {
      if (cancel) {
        cancel.id = 'qa-custom-toggle';
        cancel.textContent = '+ Item not tracked? Add as custom';
      }
    }
  },

  // ── Save ────────────────────────────────────────────────────────────────
  // after() runs on success (defaults to re-rendering the landing). The
  // running-shift log pop-up passes a callback that closes the modal instead.
  async save(after) {
    const err = document.getElementById('qa-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };

    const date = document.getElementById('qa-date')?.value || App.todayLocal();
    const time = document.getElementById('qa-time')?.value || this.nowTime();
    const reportedById = document.getElementById('qa-by')?.value || '';
    const reportedBy   = (App.staffById(reportedById) || {}).name || '';
    const reason = document.getElementById('qa-reason')?.value.trim() || '';
    const notes  = document.getElementById('qa-notes')?.value.trim() || '';

    // Resolve primary 86 target
    const menuId = document.getElementById('qa-menu')?.value || '';
    const invKey = document.getElementById('qa-inv')?.value || '';
    const customName = (document.getElementById('qa-custom')?.value || '').trim();
    const customCat  = document.getElementById('qa-custom-cat')?.value || 'Misc';

    let primary = null;
    if (this.customMode || (!menuId && !invKey && customName)) {
      if (!customName) { fail('Type a custom item name.'); return; }
      primary = { kind: 'custom', name: customName, category: customCat };
    } else if (menuId) {
      const m = this.menuItemById(menuId);
      if (!m) { fail('Pick a menu item.'); return; }
      primary = { kind: 'menu_item', id: m.id, name: m.name, category: m.category || 'Menu Item' };
    } else if (invKey) {
      if (invKey.startsWith('b:')) {
        const b = this.prepBatchById(invKey.slice(2));
        if (!b) { fail('Pick an inventory item.'); return; }
        primary = { kind: 'batch', id: b.id, name: b.name, category: b.category || 'Batch' };
      } else {
        const p = this.productById(invKey.slice(2));
        if (!p) { fail('Pick an inventory item.'); return; }
        primary = { kind: 'product', id: p.id, name: p.name, category: p.category || 'Misc' };
      }
    } else {
      fail('Pick an item to 86 or add a custom name.');
      return;
    }

    const baseShared = {
      date_86: date, time_86: time,
      reported_by_id: reportedById, reported_by: reportedBy,
      reason, notes
    };

    const recordFromTarget = (t) => {
      const fields = {
        item: t.name, category: t.category,
        product_id:   t.kind === 'product' ? t.id : '',
        menu_item_id: t.kind === 'menu_item' ? t.id : '',
        batch_id:     t.kind === 'batch' ? t.id : '',
        source_type:  t.kind,
        ...baseShared
      };
      return fields;
    };

    const list = this.items();

    const toSave = [];
    if (this.editId) {
      // Edit mode — update the one record (no batch saves on edit)
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...recordFromTarget(primary) }; toSave.push(list[i]); }
    } else {
      // Save primary
      const primaryRec = { id: App.uid(), ...recordFromTarget(primary), status: '86', date_back: '', created_at: new Date().toISOString() };
      list.push(primaryRec);
      toSave.push(primaryRec);
      // Save each checked "also 86" dependent
      const alsoKeys = Object.keys(this.alsoIds);
      alsoKeys.forEach(k => {
        const d = this.alsoIds[k];
        const target = { kind: d.kind, id: d.id, name: d.name, category: d.kind === 'menu_item' ? (this.menuItemById(d.id)?.category || 'Menu Item') : d.kind === 'batch' ? (this.prepBatchById(d.id)?.category || 'Batch') : (this.productById(d.id)?.category || 'Misc') };
        // Reason carries forward but flagged as a knock-on
        const sharedWithReason = { ...baseShared, reason: baseShared.reason ? baseShared.reason + ' (knock-on)' : 'Knock-on from ' + primary.name, notes: baseShared.notes };
        const rec = { ...recordFromTarget(target), ...sharedWithReason };
        const knockRec = { id: App.uid(), ...rec, status: '86', date_back: '', created_at: new Date().toISOString() };
        list.push(knockRec);
        toSave.push(knockRec);
      });
    }

    const btn = document.getElementById('qa-go');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    let ok = true;
    for (const r of toSave) { ok = (await App.putRecord('sc', 'eighty_six', r)) && ok; }
    this.editId = null;
    this.customMode = false;
    this.alsoIds = {};
    if (ok) { this._draft = null; (typeof after === 'function' ? after : () => this.renderMain())(); }
    else {
      if (btn) { btn.disabled = false; btn.textContent = '86 It'; }
      fail('Save failed. Try again.');
    }
  },

  // Log an 86 from the running shift in a focused pop-up (full picker + cross-
  // reference, no nav away). preset pre-fills the 86 date from the open shift.
  openLogModal(onDone, preset) {
    if (!App.canEdit('sc-86-list')) return;
    this.editId = null; this.customMode = false; this.alsoIds = {};
    const html = '<div class="card form-card" style="margin:0;"><div class="card-title">86 An Item</div>'
      + this.entryFields(preset || null)
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="qa-go">86 It</button>'
      + '<button class="btn btn-ghost" id="qa-cancel">Cancel</button>'
      + '<span id="qa-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    const modal = App.openModal(html, { id: 'el-log-modal', maxWidth: 820, noClose: true });
    this.wireFormInputs();
    this.recomputeCrossRef();
    if (modal) modal.addEventListener('click', ev => {
      if (ev.target.closest('#qa-go')) this.save(() => { App.closeModal('el-log-modal'); if (typeof onDone === 'function') onDone(); });
      else if (ev.target.closest('#qa-cancel')) App.closeModal('el-log-modal');
      else if (ev.target.closest('#qa-custom-toggle')) { ev.preventDefault(); this.toggleCustom(true); }
      else if (ev.target.closest('#qa-custom-cancel'))  { ev.preventDefault(); this.toggleCustom(false); }
    });
  },

  async markBack(id) {
    const it = this.items().find(x => x.id === id);
    if (!it) return;
    it.status = 'Back';
    it.date_back = App.todayLocal();
    it.time_back = this.nowTime();
    await App.putRecord('sc', 'eighty_six', it);
    this.renderMain();
  },

  async re86(id) {
    const it = this.items().find(x => x.id === id);
    if (!it) return;
    it.status = '86';
    it.date_86 = App.todayLocal();
    it.time_86 = this.nowTime();
    it.date_back = '';
    it.time_back = '';
    await App.putRecord('sc', 'eighty_six', it);
    this.renderMain();
  },

  async confirmDel(id) {
    if (!(await App.confirmDelete())) return;
    if (this.editId === id) { this.editId = null; this.customMode = false; this.alsoIds = {}; }
    await App.removeRecord('sc', 'eighty_six', id);
    this.renderMain();
  },

  // Edit a logged 86 in a focused pop-up (just this item's info, no pickers).
  openEditModal(id) {
    if (!App.canEdit('sc-86-list')) return;
    const it = this.items().find(x => x.id === id);
    if (!it) return;
    const isCustom = it.source_type === 'custom';
    const catOpts = this.categories().map(c => '<option' + (it.category === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
    const srcTxt = this.srcText(it.source_type);
    const itemField = isCustom
      ? '<div class="f" style="flex:1;min-width:200px;"><label>Item</label><input type="text" id="qe-item" value="' + esc(it.item || '') + '" style="height:44px;"/></div>'
      : '<div class="f" style="flex:1;min-width:200px;"><label>Item</label><div class="f-display" style="height:44px;display:flex;align-items:center;gap:8px;">' + esc(it.item || '') + (srcTxt || '') + '</div></div>';

    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit 86 Item</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      + itemField
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Category</label><select id="qe-cat" style="height:44px;">' + catOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Date 86\'d</label><input type="date" id="qe-date" value="' + esc(it.date_86 || '') + '" style="height:44px;"/></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Time</label><input type="time" id="qe-time" value="' + esc(it.time_86 || '') + '" style="height:44px;"/></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Reported By</label><select id="qe-by" style="height:44px;">' + App.staffOptions(it.reported_by_id || it.reported_by, { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;"><div class="f" style="width:100%;"><label>Reason</label><input type="text" id="qe-reason" value="' + esc(it.reason || '') + '" placeholder="Optional"/></div></div>'
      + '<div class="form-row" style="gap:14px;"><div class="f" style="width:100%;"><label>Notes</label><textarea id="qe-notes" class="notes-ta" rows="2" placeholder="Optional">' + esc(it.notes || '') + '</textarea></div></div>'
      + '<div class="card-actions"><button class="btn btn-primary" id="qe-save">Update</button><button class="btn btn-ghost" id="qe-cancel">Cancel</button>'
      + '<span id="qe-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '<button class="btn btn-danger" id="qe-del" style="margin-left:auto;">Delete</button></div></div>';

    App.openModal(html, { id: 'ei-edit-modal', maxWidth: 540, noClose: true });
    document.getElementById('qe-cancel')?.addEventListener('click', () => App.closeModal('ei-edit-modal'));
    document.getElementById('qe-save')?.addEventListener('click', () => this.saveEdit(id, isCustom));
    document.getElementById('qe-del')?.addEventListener('click', () => { App.closeModal('ei-edit-modal'); this.confirmDel(id); });
  },

  async saveEdit(id, isCustom) {
    const it = this.items().find(x => x.id === id);
    if (!it) return;
    const err = document.getElementById('qe-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('qe-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    if (isCustom) {
      const nm = document.getElementById('qe-item')?.value.trim();
      if (!nm) { fail('Item name is required.'); return; }
      it.item = nm;
    }
    it.category = document.getElementById('qe-cat')?.value || it.category;
    it.date_86 = date;
    it.time_86 = document.getElementById('qe-time')?.value || '';
    const byId = document.getElementById('qe-by')?.value || '';
    it.reported_by_id = byId;
    it.reported_by = (App.staffById(byId) || {}).name || '';
    it.reason = document.getElementById('qe-reason')?.value.trim() || '';
    it.notes = document.getElementById('qe-notes')?.value.trim() || '';

    const btn = document.getElementById('qe-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'eighty_six', it);
    if (ok) { App.closeModal('ei-edit-modal'); this.renderMain(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Update'; } fail('Save failed. Try again.'); }
  },

  // Paper-at-bar workflow. Bartenders + managers commonly mark 86s on a
  // whiteboard or clipboard mid-service, then enter into Bar Cop after close.
  printBlank() {
    App.printBlankSheet({
      title: '86 List',
      subtitle: 'Mark every item 86\'d during the shift. Manager enters each row into Bar Cop after close.',
      columns: [
        { label: 'Time',         width: '10%' },
        { label: 'Item',         width: '26%' },
        { label: 'Category',     width: '14%' },
        { label: 'Reason',       width: '24%' },
        { label: 'Reported By',  width: '14%' },
        { label: 'Notes',        width: '12%' }
      ],
      rows: 14
    });
  }
};
