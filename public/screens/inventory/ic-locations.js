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
        + '<div class="empty-sub">Add the storage areas where you keep product — bars, coolers, storerooms. '
        + 'Products are assigned to these locations, and inventory counts are organized by them.</div>'
        + '<div style="display:flex;gap:10px;justify-content:center;">'
        + '<button class="btn btn-primary" id="il-add-first">Add Location</button>'
        + '<button class="btn btn-ghost" id="il-add-defaults">Add Suggested Defaults</button>'
        + '</div></div>';
    } else {
      const rows = active.map((l, i) => {
        const n = this.productCount(l.name);
        return '<tr>'
          + '<td><button class="il-open" data-id="' + l.id + '" '
          + 'style="padding:0;border:none;background:none;color:var(--gold);font-weight:700;font-size:13px;cursor:pointer;">'
          + esc(l.name) + '</button></td>'
          + '<td>' + n + ' product' + (n === 1 ? '' : 's') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm il-up" data-id="' + l.id + '"' + (i === 0 ? ' disabled' : '') + '>&#8593;</button>'
          + '<button class="btn btn-ghost btn-sm il-down" data-id="' + l.id + '"' + (i === active.length - 1 ? ' disabled' : '') + '>&#8595;</button>'
          + '<button class="btn btn-ghost btn-sm il-edit" data-id="' + l.id + '">Edit</button>'
          + '<button class="btn btn-ghost btn-sm il-archive" data-id="' + l.id + '">Archive</button>'
          + '</div></td></tr>';
      }).join('');

      html = '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
        + '<th>Location</th><th>Assigned Products</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';

      if (archived.length) {
        html += '<div class="sh" style="margin:24px 0 8px;">Archived</div>'
          + '<div class="tbl-wrap"><table class="tbl"><tbody>'
          + archived.map(l => '<tr style="opacity:0.55;">'
              + '<td style="font-weight:700;color:var(--t2);">' + esc(l.name) + '</td>'
              + '<td>' + this.productCount(l.name) + ' products</td>'
              + '<td><div class="row-actions">'
              + '<button class="btn btn-ghost btn-sm il-unarchive" data-id="' + l.id + '">Unarchive</button>'
              + '</div></td></tr>').join('')
          + '</tbody></table></div>';
      }
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.container.onclick = ev => {
      const open = ev.target.closest('.il-open');
      const up   = ev.target.closest('.il-up');
      const down = ev.target.closest('.il-down');
      const edit = ev.target.closest('.il-edit');
      const arch = ev.target.closest('.il-archive');
      const un   = ev.target.closest('.il-unarchive');
      const addF = ev.target.closest('#il-add-first');
      const addD = ev.target.closest('#il-add-defaults');
      if (open)      this.showDetail(open.dataset.id);
      else if (up)   this.move(up.dataset.id, -1);
      else if (down) this.move(down.dataset.id, 1);
      else if (edit) this.showForm(edit.dataset.id);
      else if (arch) this.setArchived(arch.dataset.id, true);
      else if (un)   this.setArchived(un.dataset.id, false);
      else if (addF) this.showForm();
      else if (addD) this.addDefaults();
    };
  },

  // ── Reorder / archive / defaults ──────────────────────────────────────────
  async move(id, dir) {
    const all = this.locations();
    const active = all.filter(l => !l.archived);
    const archived = all.filter(l => l.archived);
    const i = active.findIndex(l => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= active.length) return;
    [active[i], active[j]] = [active[j], active[i]];
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
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
      fail('Save failed. Try again.');
    }
  },

  // ── Location detail (products assigned here) ──────────────────────────────
  showDetail(id) {
    const l = this.locations().find(x => x.id === id);
    if (!l) { this.renderList(); return; }
    const prods = this.products().filter(p => p.primary_location === l.name || p.secondary_location === l.name);

    let body;
    if (prods.length === 0) {
      body = '<div class="empty"><div class="empty-title">No products assigned here</div>'
        + '<div class="empty-sub">Assign products to ' + esc(l.name) + ' from the Products screen using the '
        + 'Primary Location or Secondary Location field.</div></div>';
    } else {
      const rows = prods.map(p => '<tr>'
        + '<td><div class="val">' + esc(p.name) + '</div>'
        + (p.brand ? '<div style="font-size:10px;color:var(--t3);">' + esc(p.brand) + '</div>' : '') + '</td>'
        + '<td>' + esc(p.category || '—') + '</td>'
        + '<td>' + (p.primary_location === l.name ? 'Primary' : 'Secondary') + '</td>'
        + '<td>' + (p.par_level != null && p.par_level !== '' ? p.par_level : '<span style="color:var(--t4);">—</span>') + '</td>'
        + '</tr>').join('');
      body = '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
        + '<th>Product</th><th>Category</th><th>Assigned As</th><th>Par</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:12px;">'
        + 'Live on-hand counts appear here once you record an inventory count in Take Inventory.</div>';
    }

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="il-back">&#8592; Back to Locations</button></div>'
      + '<div style="font-size:15px;font-weight:800;color:var(--t1);margin-bottom:14px;">' + esc(l.name) + '</div>'
      + body + '</div>';
    this.container.onclick = null;
    document.getElementById('il-back')?.addEventListener('click', () => this.renderList());
  }
};
