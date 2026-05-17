'use strict';
S.KitchenProducts = {
  editId: null,
  _saving: false,
  _pendingDelIds: null,

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-sm';
    btn.textContent = 'Add Product';
    btn.addEventListener('click', () => this.showForm());
    actions.appendChild(btn);
    this.renderList();
  },

  renderList() {
    const prods = App.data.kitchen_products || [];
    let html = '';

    if (prods.length === 0) {
      html = '<div class="empty"><div class="empty-title">No kitchen products yet</div>'
        + '<div class="empty-sub">Add food ingredients and bar mixers — syrups, juices, powders — here.</div>'
        + '<button class="btn btn-primary" id="kp-add-first">Add Product</button></div>';
    } else {
      const rows = prods.map(p =>
        '<tr>'
        + '<td style="width:36px;"><input type="checkbox" class="kp-chk" data-id="' + p.id + '" style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/></td>'
        + '<td class="val">' + esc(p.name) + '</td>'
        + '<td>' + esc(p.category || '—') + '</td>'
        + '<td>' + esc(p.unit || '—') + '</td>'
        + '<td>' + App.fmtCurrency(p.cost_per_unit) + '</td>'
        + '<td>' + esc(p.vendor || '—') + '</td>'
        + '<td><div class="row-actions">'
        + '<button class="btn btn-ghost btn-sm kp-edit" data-id="' + p.id + '">Edit</button>'
        + '<button class="btn btn-danger btn-sm kp-del" data-id="' + p.id + '">Delete</button>'
        + '</div></td></tr>'
      ).join('');

      html = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
        + '<button class="btn btn-ghost btn-sm" id="kp-sel-all">Select All</button>'
        + '<button class="btn btn-danger btn-sm" id="kp-del-sel" style="display:none;">Delete Selected</button>'
        + '<span id="kp-sel-count" style="font-size:11px;color:var(--t3);"></span>'
        + '</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th style="width:36px;"><input type="checkbox" id="kp-chk-all" style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/></th>'
        + '<th>Name</th><th>Category</th><th>Unit</th><th>Unit Cost</th><th>Vendor</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="kp-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div id="kp-del-msg" style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this product?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="kp-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="kp-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '<div id="kp-form"></div></div>' + modal;

    this.container.onclick = ev => {
      const edit     = ev.target.closest('.kp-edit');
      const del      = ev.target.closest('.kp-del');
      const addFirst = ev.target.closest('#kp-add-first');
      const cancel   = ev.target.closest('#kp-cancel');
      const save     = ev.target.closest('#kp-save');
      if (edit)     { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      if (del)      { ev.stopPropagation(); this.confirmDel([del.dataset.id], 'Delete this product?'); }
      if (addFirst) { ev.stopPropagation(); this.showForm(); }
      if (cancel)   { ev.stopPropagation(); this.renderList(); }
      if (save)     { ev.stopPropagation(); this.save(); }
    };

    const updateSel = () => {
      const checked = this.container.querySelectorAll('.kp-chk:checked');
      const btn = document.getElementById('kp-del-sel');
      const cnt = document.getElementById('kp-sel-count');
      if (btn) btn.style.display = checked.length > 0 ? '' : 'none';
      if (cnt) cnt.textContent   = checked.length > 0 ? checked.length + ' selected' : '';
    };

    document.getElementById('kp-chk-all')?.addEventListener('change', function() {
      document.querySelectorAll('.kp-chk').forEach(c => { c.checked = this.checked; });
      updateSel();
    });
    this.container.addEventListener('change', ev => {
      if (ev.target.classList.contains('kp-chk')) updateSel();
    });
    document.getElementById('kp-sel-all')?.addEventListener('click', () => {
      const chks = document.querySelectorAll('.kp-chk');
      const allChecked = [...chks].every(c => c.checked);
      chks.forEach(c => { c.checked = !allChecked; });
      const chkAll = document.getElementById('kp-chk-all');
      if (chkAll) chkAll.checked = !allChecked;
      updateSel();
    });
    document.getElementById('kp-del-sel')?.addEventListener('click', () => {
      const ids = [...document.querySelectorAll('.kp-chk:checked')].map(c => c.dataset.id);
      if (ids.length === 0) return;
      this.confirmDel(ids, 'Delete ' + ids.length + ' product' + (ids.length > 1 ? 's' : '') + '?');
    });
  },

  confirmDel(ids, msg) {
    this._pendingDelIds = ids;
    const modal = document.getElementById('kp-del-modal');
    const msgEl = document.getElementById('kp-del-msg');
    if (msgEl) msgEl.textContent = msg;
    if (modal) modal.style.display = 'flex';
    document.getElementById('kp-del-cancel').onclick = () => {
      modal.style.display = 'none';
      this._pendingDelIds = null;
    };
    document.getElementById('kp-del-confirm').onclick = () => {
      modal.style.display = 'none';
      const ids = this._pendingDelIds || [];
      App.data.kitchen_products = (App.data.kitchen_products || []).filter(p => !ids.includes(p.id));
      App.saveKey('kitchen_products').then(() => this.renderList());
      this._pendingDelIds = null;
    };
  },

  showForm(id) {
    this.editId = id || null;
    const p = id ? (App.data.kitchen_products || []).find(p => p.id === id) : null;
    const fa = document.getElementById('kp-form');
    if (!fa) return;
    fa.innerHTML = '<div class="divider"></div><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'New') + ' Kitchen Product</div>'
      + '<div class="form-row">'
      + '<div class="f w-lg"><label>Product Name</label><input type="text" id="kp-name" value="' + esc(p?.name || '') + '" placeholder="Chicken Breast" /></div>'
      + '<div class="f w-md"><label>Category</label><select id="kp-cat">'
      + ['Protein','Produce','Dairy','Dry Goods','Frozen','Mixer/Supply','Other'].map(c => '<option' + (p?.category === c ? ' selected' : '') + '>' + c + '</option>').join('')
      + '</select></div>'
      + '<div class="f w-md"><label>Vendor</label><input type="text" id="kp-vendor" value="' + esc(p?.vendor || '') + '" placeholder="Sysco" /></div>'
      + '<div class="f" style="width:90px;flex-shrink:0;"><label>Unit ' + tt('kitchen-unit') + '</label><input type="text" id="kp-unit" value="' + esc(p?.unit || '') + '" placeholder="lb" /></div>'
      + '<div class="f" style="width:90px;flex-shrink:0;"><label>Unit Cost ' + tt('kitchen-cost') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="kp-cost" value="' + (p?.cost_per_unit || '') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-ghost" id="kp-cancel">Cancel</button>'
      + '<button class="btn btn-primary" id="kp-save">' + (id ? 'Update' : 'Save') + '</button>'
      + '<span id="kp-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    document.getElementById('kp-name')?.focus();
  },

  save() {
    if (this._saving) return;
    this._saving = true;
    setTimeout(() => { this._saving = false; }, 2000);

    const name = document.getElementById('kp-name')?.value.trim();
    const err  = document.getElementById('kp-err');
    if (!name) { if (err) { err.textContent = 'Name required.'; err.style.display = 'inline'; } this._saving = false; return; }

    const prod = {
      id: this.editId || App.uid(),
      name,
      category:     document.getElementById('kp-cat')?.value,
      vendor:       document.getElementById('kp-vendor')?.value.trim(),
      unit:         document.getElementById('kp-unit')?.value.trim(),
      cost_per_unit: parseFloat(document.getElementById('kp-cost')?.value) || 0,
      created_at:   this.editId ? undefined : new Date().toISOString()
    };

    if (!App.data.kitchen_products) App.data.kitchen_products = [];
    if (this.editId) {
      const i = App.data.kitchen_products.findIndex(p => p.id === this.editId);
      if (i > -1) App.data.kitchen_products[i] = { ...App.data.kitchen_products[i], ...prod };
    } else {
      App.data.kitchen_products.push(prod);
    }

    const btn = document.getElementById('kp-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    App.saveKey('kitchen_products').then(() => {
      this._saving = false;
      this.editId  = null;
      this.renderList();
    });
  }
};
