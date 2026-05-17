'use strict';
S.BarProducts = {
  editId: null,
  _bound: false,
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
  sizeOpts(sel) {
    let g='',h='<option value="">Select container size...</option>';
    this.SIZES.forEach(s=>{
      if(s.g!==g){if(g)h+='</optgroup>';h+='<optgroup label="'+s.g+'">';g=s.g;}
      const v=s.oz!==null?s.oz:'custom';
      h+='<option value="'+v+'"'+(sel!=null&&s.oz===sel?' selected':'')+'>'+s.l+'</option>';
    });
    if(g)h+='</optgroup>';return h;
  },

  render(container, actions) {
    this.container = container;
    this._bound = false;
    actions.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-sm';
    btn.textContent = 'Add Product';
    btn.addEventListener('click', () => this.showForm());
    actions.appendChild(btn);
    this.renderList();
  },

  renderList() {
    const prods = App.data.bar_products || [];
    const target = App.data.settings.targets?.bar_pour_cost_pct ?? 22;
    let html = '';
    if (prods.length === 0) {
      html = '<div class="empty"><div class="empty-title">No bar products yet</div>'
        + '<div class="empty-sub">Add your spirits, beer, and wine to track pour cost and inventory.</div>'
        + '<button class="btn btn-primary" id="bp-add-first">Add Product</button></div>';
    } else {
      const rows = prods.map(p => {
        const sz = this.SIZES.find(s => s.oz === p.bottle_size_oz);
        const szL = sz ? sz.l : (p.bottle_size_oz ? p.bottle_size_oz + ' oz' : '—');
        const pc = p.pour_cost_pct != null ? (p.pour_cost_pct > target ? 'neg' : 'pos') : '';
        return '<tr><td class="val">' + esc(p.name) + '</td><td>' + esc(p.category || '—') + '</td>'
          + '<td>' + esc(szL) + '</td><td>' + (p.std_pour_oz || '—') + ' oz</td>'
          + '<td>' + App.fmtCurrency(p.cost_per_unit) + '</td>'
          + '<td>' + App.fmtCurrency(p.cost_per_pour) + '</td>'
          + '<td class="' + pc + '">' + (p.pour_cost_pct != null ? App.fmtPct(p.pour_cost_pct) : '—') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm bp-edit" data-id="' + p.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm bp-del" data-id="' + p.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      html = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Name</th><th>Category</th><th>Container</th><th>Std Pour</th>'
        + '<th>Unit Cost</th><th>Cost/Pour</th><th>Pour Cost %</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    // Inline delete confirmation UI (no confirm() dialog)
    const delModal = '<div id="bp-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this product?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="bp-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="bp-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '<div id="bp-form"></div></div>' + delModal;

    // Bind events ONCE using a named handler on the container
    if (!this._bound) {
      this._bound = true;
      this._handleClick = (ev) => {
        const edit = ev.target.closest('.bp-edit');
        const del  = ev.target.closest('.bp-del');
        const addFirst = ev.target.closest('#bp-add-first');
        const cancel = ev.target.closest('#bp-cancel');
        const save = ev.target.closest('#bp-save');

        if (edit)     { ev.stopPropagation(); this.showForm(edit.dataset.id); }
        if (del)      { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
        if (addFirst) { ev.stopPropagation(); this.showForm(); }
        if (cancel)   { ev.stopPropagation(); this.renderList(); }
        if (save)     { ev.stopPropagation(); this.save(); }
      };
    }
    this.container.onclick = this._handleClick;
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('bp-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('bp-del-cancel').onclick = () => {
      modal.style.display = 'none';
      this._pendingDelId = null;
    };
    document.getElementById('bp-del-confirm').onclick = () => {
      modal.style.display = 'none';
      this.del(this._pendingDelId);
      this._pendingDelId = null;
    };
  },

  showForm(id) {
    this.editId = id || null;
    const p = id ? (App.data.bar_products || []).find(p => p.id === id) : null;
    const fa = document.getElementById('bp-form');
    if (!fa) return;
    const isCustom = p?.bottle_size_oz != null && !this.SIZES.find(s => s.oz === p.bottle_size_oz);

    fa.innerHTML = '<div class="divider"></div><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'New') + ' Bar Product</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f w-lg"><label>Product Name</label><input type="text" id="bp-name" value="' + esc(p?.name || '') + '" placeholder="Tito\'s Handmade Vodka" /></div>'
      + '<div class="f w-md"><label>Category</label><select id="bp-cat">'
      + ['Spirits','Beer - Bottle','Beer - Draft','Wine','NA Beverage','Other'].map(c => '<option' + (p?.category === c ? ' selected' : '') + '>' + c + '</option>').join('')
      + '</select></div>'
      + '<div class="f w-lg"><label>Vendor</label><input type="text" id="bp-vendor" value="' + esc(p?.vendor || '') + '" placeholder="Republic National" /></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Container Size ' + tt('container-size') + '</label>'
      + '<select id="bp-size">' + this.sizeOpts(isCustom ? null : p?.bottle_size_oz) + '</select></div>'
      + '<div class="f" id="bp-cw" style="width:110px;flex-shrink:0;' + (isCustom ? '' : 'display:none;') + '"><label>Custom (oz)</label><div class="fw"><input class="suf" type="number" id="bp-coz" value="' + (isCustom ? p.bottle_size_oz : '') + '" step="0.1"/><span class="suf">oz</span></div></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Std Pour ' + tt('std-pour') + '</label><div class="fw"><input class="suf" type="number" id="bp-pour" value="' + (p?.std_pour_oz || '') + '" step="0.25" placeholder="1.5"/><span class="suf">oz</span></div></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Unit Cost ' + tt('unit-cost') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="bp-cost" value="' + (p?.cost_per_unit || '') + '" step="0.01" placeholder="0.00"/></div></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Menu Price ' + tt('menu-price') + '</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="bp-price" value="' + (p?.menu_price || '') + '" step="0.25" placeholder="0.00"/></div></div>'
      + '</div>'
      + '<div class="calc" style="margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Pours/Bottle ' + tt('pours-bottle') + '</div><div class="calc-val" id="bp-pours">—</div></div>'
      + '<div class="calc-item"><div class="calc-label">Cost/Pour ' + tt('cost-pour') + '</div><div class="calc-val" id="bp-cpp">—</div></div>'
      + '<div class="calc-item"><div class="calc-label">Pour Cost % ' + tt('pour-cost-pct') + '</div><div class="calc-val" id="bp-pct">—</div></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-ghost" id="bp-cancel">Cancel</button>'
      + '<button class="btn btn-primary" id="bp-save">' + (id ? 'Update' : 'Save') + '</button>'
      + '<span id="bp-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';

    document.getElementById('bp-size')?.addEventListener('change', () => {
      document.getElementById('bp-cw').style.display = document.getElementById('bp-size').value === 'custom' ? '' : 'none';
      this.calcProduct();
    });
    ['bp-coz','bp-pour','bp-cost','bp-price'].forEach(fid =>
      document.getElementById(fid)?.addEventListener('input', () => this.calcProduct())
    );
    if (p) this.calcProduct();
    document.getElementById('bp-name')?.focus();
  },

  getOz() {
    const v = document.getElementById('bp-size')?.value;
    if (!v || v === '') return 0;
    if (v === 'custom') return parseFloat(document.getElementById('bp-coz')?.value) || 0;
    return parseFloat(v) || 0;
  },

  calcProduct() {
    const oz = this.getOz();
    const pour = parseFloat(document.getElementById('bp-pour')?.value) || 0;
    const cost = parseFloat(document.getElementById('bp-cost')?.value) || 0;
    const price = parseFloat(document.getElementById('bp-price')?.value) || 0;
    const target = App.data.settings.targets?.bar_pour_cost_pct || 22;
    const pours = pour > 0 ? oz / pour : null;
    const cpp = pours ? cost / pours : null;
    const pct = cpp && price ? cpp / price * 100 : null;
    const set = (id, val, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = val; el.className = 'calc-val' + (cls ? ' ' + cls : ''); };
    set('bp-pours', pours ? pours.toFixed(1) : '—');
    set('bp-cpp', cpp ? App.fmtCurrency(cpp) : '—');
    set('bp-pct', pct ? App.fmtPct(pct) : '—', pct ? (pct > target ? 'warn' : 'good') : '');
  },

  _saving: false,
  save() {
    if (this._saving) return;
    this._saving = true;
    setTimeout(() => { this._saving = false; }, 2000);

    const name = document.getElementById('bp-name')?.value.trim();
    const err = document.getElementById('bp-err');
    if (!name) { if (err) { err.textContent = 'Name required.'; err.style.display = 'inline'; } this._saving = false; return; }
    const oz = this.getOz();
    if (!oz) { if (err) { err.textContent = 'Select container size.'; err.style.display = 'inline'; } this._saving = false; return; }

    const pour = parseFloat(document.getElementById('bp-pour')?.value) || 0;
    const cost = parseFloat(document.getElementById('bp-cost')?.value) || 0;
    const price = parseFloat(document.getElementById('bp-price')?.value) || 0;
    const pours = pour > 0 ? oz / pour : null;
    const cpp = pours ? cost / pours : null;
    const pct = cpp && price ? cpp / price * 100 : null;

    const prod = {
      id: this.editId || App.uid(),
      name,
      category: document.getElementById('bp-cat')?.value,
      vendor: document.getElementById('bp-vendor')?.value.trim(),
      bottle_size_oz: oz, std_pour_oz: pour, cost_per_unit: cost, menu_price: price,
      pours_per_bottle: pours, cost_per_pour: cpp, pour_cost_pct: pct,
      created_at: this.editId ? undefined : new Date().toISOString()
    };

    if (!App.data.bar_products) App.data.bar_products = [];
    if (this.editId) {
      const i = App.data.bar_products.findIndex(p => p.id === this.editId);
      if (i > -1) App.data.bar_products[i] = { ...App.data.bar_products[i], ...prod };
    } else {
      App.data.bar_products.push(prod);
    }

    const btn = document.getElementById('bp-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    App.saveKey('bar_products').then(() => {
      this._saving = false;
      this.editId = null;
      this.renderList();
    });
  },

  del(id) {
    App.data.bar_products = (App.data.bar_products || []).filter(p => p.id !== id);
    App.saveKey('bar_products').then(() => this.renderList());
  }
};
