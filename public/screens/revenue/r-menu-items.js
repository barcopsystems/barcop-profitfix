'use strict';

/* ── Revenue Recovery — Menu Items (writes App.data.menu_items) ───────────────
   Canonical store of every sellable menu item. Each item may OPTIONALLY have
   a recipe attached (ingredient breakdown) — when present, cost auto-
   computes from current product prices via App.menuItemCost. Without a
   recipe, the manually-entered cost field is used.

   Same data is editable from Recipe Library (Profit Recovery) for cost-out
   workflows. Both screens read/write App.data.menu_items so the menu stays
   consistent. Menu Engineering reads from here and uses App.menuItemCost
   for live cost calc. */

S.RevenueMenuItems = {
  editing: null,

  items() {
    if (!App.data.menu_items) App.data.menu_items = [];
    return App.data.menu_items;
  },

  // Menu categories — what the operator puts on their menu. Distinct from
  // product categories (which are how Bar Cop organizes raw inventory).
  CATEGORIES: ['Appetizers', 'Entrees', 'Desserts', 'Cocktails', 'Beer', 'Wine', 'NA Beverages', 'Specials', 'Other'],

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = '+ Add Item';
    addBtn.addEventListener('click', () => this.showForm(null));
    actions.appendChild(addBtn);
    const impBtn = document.createElement('button');
    impBtn.className = 'btn btn-ghost btn-sm';
    impBtn.style.marginLeft = '8px';
    impBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="margin-right:5px;"><path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Import';
    impBtn.addEventListener('click', () => this.showImport());
    actions.appendChild(impBtn);
    this.renderList();
  },

  renderList() {
    const items = this.items();
    const incomplete = items.filter(i => !i.price || (App.menuItemCost(i) || 0) === 0).length;

    const rows = items.map((item, idx) => {
      const cost = App.menuItemCost(item) || 0;
      const cm   = (item.price && cost) ? (item.price - cost) : null;
      const pct  = (item.price && cost) ? (cost / item.price * 100).toFixed(1) : null;
      const ok   = item.price && cost;
      const hasRecipe = !!(item.recipe && Array.isArray(item.recipe.ingredients) && item.recipe.ingredients.length);
      const recipeBadge = hasRecipe
        ? '<span style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gold);border:1px solid var(--gold);border-radius:3px;padding:1px 5px;margin-left:6px;">RECIPE</span>'
        : '';
      return '<tr class="' + (!ok ? 'row-incomplete' : '') + '">'
        + '<td style="width:36px;"><input type="checkbox" class="ri-chk" data-id="' + item.id + '" style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/></td>'
        + '<td style="font-weight:600;color:' + (ok ? 'var(--t1)' : 'var(--red)') + ';">' + esc(item.name) + recipeBadge + (!ok ? ' <span style="font-size:10px;font-weight:700;color:var(--red);">INCOMPLETE</span>' : '') + '</td>'
        + '<td>' + esc(item.category || '') + '</td>'
        + '<td>' + (item.price ? App.fmtCurrency(item.price) : '-') + '</td>'
        + '<td>' + (cost ? App.fmtCurrency(cost) : '-') + (hasRecipe ? '<div style="font-size:9px;color:var(--t3);">from recipe</div>' : '') + '</td>'
        + '<td>' + (pct ? pct + '%' : '-') + '</td>'
        + '<td>' + (cm ? App.fmtCurrency(cm) : '-') + '</td>'
        + '<td>' + (item.weekly_covers ? item.weekly_covers : '-') + '</td>'
        + '<td style="white-space:nowrap;">'
        + '<button class="btn btn-ghost btn-sm ri-edit" data-idx="' + idx + '" style="margin-right:4px;">Edit</button>'
        + '<button class="btn btn-ghost btn-sm ri-recipe" data-id="' + item.id + '" style="margin-right:4px;">' + (hasRecipe ? 'Edit Recipe' : '+ Recipe') + '</button>'
        + '<button class="btn btn-danger btn-sm ri-del" data-idx="' + idx + '">Del</button>'
        + '</td></tr>';
    }).join('') || '<tr><td colspan="9" style="color:var(--t3);text-align:center;padding:14px;">No menu items yet. Add your first item to get started.</td></tr>';

    this.container.innerHTML = '<div class="screen">'
      + (incomplete > 0 ? '<div class="alert-bar"><div class="alert-text">' + incomplete + ' item' + (incomplete > 1 ? 's' : '') + ' missing price or cost. Incomplete items cannot be used in Menu Engineering.</div></div>' : '')
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.6;">'
        + 'Items with a recipe attached have their cost auto-computed from current product prices in Inventory Control. Add or edit a recipe to switch from manual cost entry to live ingredient costing.'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
      + '<button class="btn btn-ghost btn-sm" id="ri-sel-all">Select All</button>'
      + '<button class="btn btn-danger btn-sm" id="ri-del-sel" style="display:none;">Delete Selected</button>'
      + '<span id="ri-sel-count" style="font-size:11px;color:var(--t3);"></span>'
      + '</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th style="width:36px;"></th>'
      + '<th>Item Name</th><th>Category</th><th>Price</th><th>Cost</th><th>Cost %</th><th>Contrib. Margin</th><th>Wkly Covers</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';

    this.container.querySelectorAll('.ri-edit').forEach(btn => {
      btn.addEventListener('click', () => this.showForm(parseInt(btn.dataset.idx)));
    });
    this.container.querySelectorAll('.ri-recipe').forEach(btn => {
      btn.addEventListener('click', () => {
        // Door 2 into the same data: jump to Recipe Library focused on this
        // item's recipe editor.
        App._recipeFocus = btn.dataset.id;
        App.navigate('recipe-library');
      });
    });
    this.container.querySelectorAll('.ri-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this item?')) return;
        this.items().splice(parseInt(btn.dataset.idx), 1);
        await App.saveKey('menu_items');
        this.render(this.container, this.actions);
      });
    });

    const updateSel = () => {
      const checked = this.container.querySelectorAll('.ri-chk:checked');
      const delBtn  = document.getElementById('ri-del-sel');
      const count   = document.getElementById('ri-sel-count');
      if (delBtn) delBtn.style.display = checked.length ? '' : 'none';
      if (count)  count.textContent    = checked.length ? checked.length + ' selected' : '';
    };
    document.getElementById('ri-sel-all')?.addEventListener('click', () => {
      const all = this.container.querySelectorAll('.ri-chk');
      const anyUnchecked = [...all].some(c => !c.checked);
      all.forEach(c => { c.checked = anyUnchecked; });
      updateSel();
    });
    this.container.addEventListener('change', e => { if (e.target.classList.contains('ri-chk')) updateSel(); });
    document.getElementById('ri-del-sel')?.addEventListener('click', async () => {
      const ids = [...this.container.querySelectorAll('.ri-chk:checked')].map(c => c.dataset.id);
      if (!ids.length) return;
      App.data.menu_items = this.items().filter(i => !ids.includes(i.id));
      await App.saveKey('menu_items');
      this.render(this.container, this.actions);
    });
  },

  showForm(idx) {
    const items = this.items();
    const item  = idx !== null && idx >= 0 ? items[idx] : null;
    const catOpts = this.CATEGORIES.map(c =>
      '<option' + (item?.category === c ? ' selected' : '') + '>' + c + '</option>').join('');
    const hasRecipe = !!(item?.recipe && Array.isArray(item.recipe.ingredients) && item.recipe.ingredients.length);

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="sh">' + (item ? 'Edit Item' : 'Add Menu Item') + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
      + '<div class="f w-lg"><label>Item Name</label><input type="text" id="ri-name" value="' + esc(item?.name || '') + '" placeholder="House Burger"/></div>'
      + '<div class="f w-md"><label>Category</label><select id="ri-cat" style="background:var(--input);border:1px solid var(--b1);border-radius:var(--r2);color:var(--t1);padding:8px 10px;font-size:13px;width:100%;"><option value="">Select...</option>' + catOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
      + '<div class="f w-md"><label>Menu Price</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ri-price" value="' + (item?.price || '') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f w-md"><label>' + (hasRecipe ? 'Cost <span style="color:var(--t4);font-weight:400;">(auto from recipe)</span>' : 'Food / Pour Cost') + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ri-cost" value="' + ((hasRecipe ? App.menuItemCost(item) : item?.cost) || '') + '" step="0.01" placeholder="0.00"' + (hasRecipe ? ' disabled' : '') + '/></div></div>'
      + '<div class="f w-md"><label>Avg Weekly Covers</label><input type="number" id="ri-cov" value="' + (item?.weekly_covers || '') + '" placeholder=""/></div>'
      + '</div>'
      + (hasRecipe
          ? '<div style="font-size:11px;color:var(--gold);margin-bottom:14px;">'
            + 'Recipe attached with ' + item.recipe.ingredients.length + ' ingredient' + (item.recipe.ingredients.length === 1 ? '' : 's') + '. '
            + '<a href="#" id="ri-edit-recipe" style="color:var(--gold);">Edit recipe</a> &middot; '
            + '<a href="#" id="ri-remove-recipe" style="color:var(--red);">Remove recipe (switch to manual cost)</a>'
            + '</div>'
          : (item ? '<div style="font-size:11px;color:var(--t3);margin-bottom:14px;"><a href="#" id="ri-add-recipe" style="color:var(--gold);">+ Build a recipe for this item</a> for live ingredient-based costing</div>' : ''))
      + '<div id="ri-calc" style="margin-bottom:16px;"></div>'
      + '<div class="f" style="margin-bottom:16px;"><label>Notes</label><input type="text" id="ri-notes" value="' + esc(item?.notes || '') + '" placeholder="Optional"/></div>'
      + '<div style="display:flex;gap:10px;">'
      + '<button class="btn btn-primary" id="ri-save">Save Item</button>'
      + '<button class="btn btn-ghost" id="ri-cancel">Cancel</button>'
      + '</div></div></div>';

    const calc = () => {
      const price = parseFloat(document.getElementById('ri-price')?.value) || 0;
      const cost  = hasRecipe ? (App.menuItemCost(item) || 0) : (parseFloat(document.getElementById('ri-cost')?.value) || 0);
      const el    = document.getElementById('ri-calc');
      if (!el || !price || !cost) { if (el) el.innerHTML = ''; return; }
      const pct = (cost / price * 100).toFixed(1);
      const cm  = (price - cost).toFixed(2);
      el.innerHTML = '<div style="background:var(--input);border-radius:6px;padding:10px 16px;display:flex;gap:20px;">'
        + '<div><div style="font-size:10px;color:var(--t3);">Cost %</div><div style="font-size:16px;font-weight:700;color:var(--t1);">' + pct + '%</div></div>'
        + '<div><div style="font-size:10px;color:var(--t3);">Contribution Margin</div><div style="font-size:16px;font-weight:700;color:var(--gold);">' + App.fmtCurrency(parseFloat(cm)) + '</div></div>'
        + '</div>';
    };
    ['ri-price', 'ri-cost'].forEach(id => document.getElementById(id)?.addEventListener('input', calc));
    if (item) calc();

    document.getElementById('ri-cancel')?.addEventListener('click', () => this.render(this.container, this.actions));
    document.getElementById('ri-edit-recipe')?.addEventListener('click', ev => {
      ev.preventDefault();
      App._recipeFocus = item.id;
      App.navigate('recipe-library');
    });
    document.getElementById('ri-add-recipe')?.addEventListener('click', async ev => {
      ev.preventDefault();
      // Save current edits first then jump to Recipe Library to build the recipe.
      await this._save(item, idx);
      const saved = this.items()[idx >= 0 ? idx : this.items().length - 1];
      App._recipeFocus = saved.id;
      App.navigate('recipe-library');
    });
    document.getElementById('ri-remove-recipe')?.addEventListener('click', async ev => {
      ev.preventDefault();
      if (!confirm('Remove the recipe? Cost will fall back to manual entry.')) return;
      item.recipe = null;
      await App.saveKey('menu_items');
      this.showForm(idx);
    });
    document.getElementById('ri-save')?.addEventListener('click', () => this._save(item, idx));
  },

  async _save(existing, idx) {
    const name = document.getElementById('ri-name')?.value.trim();
    if (!name) return;
    const hasRecipe = !!(existing?.recipe && Array.isArray(existing.recipe.ingredients) && existing.recipe.ingredients.length);
    const cost = hasRecipe ? (App.menuItemCost(existing) || 0)
      : (parseFloat(document.getElementById('ri-cost')?.value) || 0);
    const entry = {
      id:            existing?.id || App.uid(),
      name,
      category:      document.getElementById('ri-cat')?.value    || '',
      price:         parseFloat(document.getElementById('ri-price')?.value) || 0,
      cost,
      weekly_covers: parseFloat(document.getElementById('ri-cov')?.value) || 0,
      notes:         document.getElementById('ri-notes')?.value   || '',
      recipe:        existing?.recipe || null,
      target_cost_pct: existing?.target_cost_pct,
      created_at:    existing?.created_at || new Date().toISOString(),
      updated_at:    new Date().toISOString()
    };
    if (idx !== null && idx >= 0) this.items()[idx] = entry;
    else this.items().push(entry);
    await App.saveKey('menu_items');
    App.markSetupDone('gs_r_menu');
    this.render(this.container, this.actions);
  },

  // ── Import (CSV/Excel) ────────────────────────────────────────────────────
  showImport() {
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">Import Menu Items from File</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:12px;">Upload a CSV or Excel file with your menu items. Bar Cop reads your columns and maps them. Items import without recipes attached; you can build recipes for cost-out after import.</div>'
      + '<details style="margin-bottom:16px;"><summary style="font-size:11px;color:var(--t3);cursor:pointer;font-weight:700;letter-spacing:0.5px;">What should my file look like?</summary>'
      + '<div style="font-size:11px;color:var(--t2);line-height:1.7;margin-top:8px;padding:10px 12px;background:var(--input);border-radius:3px;">'
      + '<strong style="color:var(--t1);">First row must be column headers.</strong> One row per item.<br><br>'
      + '<strong style="color:var(--t1);">Columns Bar Cop recognizes:</strong><br>'
      + '&bull; <strong>Name / Item / Product / Description</strong> required<br>'
      + '&bull; <strong>Category / Type / Group</strong> optional<br>'
      + '&bull; <strong>Price / Menu Price / Sell Price</strong> optional<br>'
      + '&bull; <strong>Cost / Item Cost / COGS</strong> optional<br>'
      + '&bull; <strong>Covers / Weekly Covers / Volume / Qty</strong> optional<br><br>'
      + '<strong style="color:var(--t1);">Accepted formats:</strong> CSV, Excel (.xlsx, .xls)'
      + '</div></details>'
      + '<input type="file" id="rmi-imp-file" accept=".csv,.xlsx,.xls" style="background:var(--input);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:6px;font-size:11px;cursor:pointer;width:100%;margin-bottom:12px;"/>'
      + '<div id="rmi-imp-status" style="font-size:12px;color:var(--t2);margin-bottom:12px;display:none;"></div>'
      + '<div style="display:flex;gap:10px;">'
      + '<button class="btn btn-primary" id="rmi-imp-btn">Import Items</button>'
      + '<button class="btn btn-ghost" id="rmi-imp-cancel">Cancel</button>'
      + '</div></div></div>';

    document.getElementById('rmi-imp-cancel')?.addEventListener('click', () => this.render(this.container, this.actions));
    document.getElementById('rmi-imp-btn')?.addEventListener('click', async () => {
      const file = document.getElementById('rmi-imp-file')?.files?.[0];
      const status = document.getElementById('rmi-imp-status');
      if (!file) { if (status) { status.style.display = 'block'; status.textContent = 'Select a file first.'; } return; }
      if (status) { status.style.display = 'block'; status.textContent = 'Reading file...'; }
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { status.textContent = 'File appears empty.'; return; }
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
      const nameIdx  = headers.findIndex(h => ['name', 'item', 'product', 'description'].some(k => h.includes(k)));
      const catIdx   = headers.findIndex(h => ['category', 'type', 'group'].some(k => h.includes(k)));
      const priceIdx = headers.findIndex(h => ['price', 'menu price', 'sell'].some(k => h.includes(k)));
      const costIdx  = headers.findIndex(h => ['cost', 'cogs'].some(k => h.includes(k)));
      const covIdx   = headers.findIndex(h => ['cover', 'volume', 'qty', 'count'].some(k => h.includes(k)));
      if (nameIdx < 0) { status.textContent = 'Could not find a Name column. Make sure row 1 has headers.'; return; }
      const imported = [];
      lines.slice(1).forEach(line => {
        const cols = line.split(',').map(c => c.replace(/"/g, '').trim());
        const name = cols[nameIdx];
        if (!name) return;
        imported.push({
          id: App.uid(), name,
          category:      catIdx  >= 0 ? cols[catIdx]  : '',
          price:         priceIdx >= 0 ? parseFloat(cols[priceIdx]) || 0 : 0,
          cost:          costIdx  >= 0 ? parseFloat(cols[costIdx])  || 0 : 0,
          weekly_covers: covIdx   >= 0 ? parseFloat(cols[covIdx])   || 0 : 0,
          notes:         '',
          recipe:        null,
          created_at:    new Date().toISOString(),
          updated_at:    new Date().toISOString()
        });
      });
      this.items().push(...imported);
      await App.saveKey('menu_items');
      App.markSetupDone('gs_r_menu');
      status.textContent = imported.length + ' items imported.';
      setTimeout(() => this.render(this.container, this.actions), 1000);
    });
  }
};
