'use strict';
S.KitchenProducts = {
  editId: null,
  _saving: false,
  _pendingDelIds: null,

  isComplete(p) {
    return !!(p.name && p.unit && p.cost_per_unit);
  },

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

  renderList() {
    const prods = App.data.kitchen_products || [];
    const incomplete = prods.filter(p => !this.isComplete(p));
    let html = '';

    if (prods.length === 0) {
      html = '<div class="empty"><div class="empty-title">No kitchen products yet</div>'
        + '<div class="empty-sub">Add food ingredients and bar mixers. Or import from a CSV file exported from your POS or inventory system.</div>'
        + '<div style="display:flex;gap:10px;justify-content:center;">'
        + '<button class="btn btn-primary" id="kp-add-first">Add Product</button>'
        + '<button class="btn btn-ghost" id="kp-imp-first">Import from File</button>'
        + '</div></div>';
    } else {
      const rows = prods.map(p => {
        const complete = this.isComplete(p);
        return '<tr>'
          + '<td style="width:36px;"><input type="checkbox" class="kp-chk" data-id="' + p.id + '" style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/></td>'
          + '<td><div class="val" style="' + (!complete ? 'color:var(--red);' : '') + '">' + esc(p.name) + '</div>'
          + (!complete ? '<div style="font-size:10px;color:var(--red);font-weight:600;letter-spacing:0.5px;">Incomplete</div>' : '') + '</td>'
          + '<td>' + esc(p.category || '—') + '</td>'
          + '<td>' + esc(p.unit || '<span style="color:var(--t4);">—</span>') + '</td>'
          + '<td>' + (p.cost_per_unit ? App.fmtCurrency(p.cost_per_unit) : '<span style="color:var(--t4);">—</span>') + '</td>'
          + '<td>' + esc(p.vendor || '—') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm kp-edit" data-id="' + p.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm kp-del" data-id="' + p.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');

      const alertBar = incomplete.length > 0
        ? '<div class="alert-bar" style="margin-bottom:14px;"><div class="alert-text">'
          + incomplete.length + ' product' + (incomplete.length > 1 ? 's have' : ' has')
          + ' incomplete data — highlighted red in the Product column.</div></div>'
        : '';

      html = alertBar
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
        + '<button class="btn btn-ghost btn-sm" id="kp-sel-all">Select All</button>'
        + '<button class="btn btn-danger btn-sm" id="kp-del-sel" style="display:none;">Delete Selected</button>'
        + '<span id="kp-sel-count" style="font-size:11px;color:var(--t3);"></span>'
        + '</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th style="width:36px;"><input type="checkbox" id="kp-chk-all" style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/></th>'
        + '<th>Product</th><th>Category</th><th>Unit</th><th>Unit Cost</th><th>Vendor</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="kp-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div id="kp-del-msg" style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this product?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="kp-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="kp-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;

    this.container.onclick = ev => {
      const edit     = ev.target.closest('.kp-edit');
      const del      = ev.target.closest('.kp-del');
      const addFirst = ev.target.closest('#kp-add-first');
      const impFirst = ev.target.closest('#kp-imp-first');
      const cancel   = ev.target.closest('#kp-cancel');
      const save     = ev.target.closest('#kp-save');
      if (edit)     { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      if (del)      { ev.stopPropagation(); this.confirmDel([del.dataset.id], 'Delete this product?'); }
      if (addFirst) { ev.stopPropagation(); this.showForm(); }
      if (impFirst) { ev.stopPropagation(); this.showImport(); }
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
      const ca = document.getElementById('kp-chk-all');
      if (ca) ca.checked = !allChecked;
      updateSel();
    });
    document.getElementById('kp-del-sel')?.addEventListener('click', () => {
      const ids = [...document.querySelectorAll('.kp-chk:checked')].map(c => c.dataset.id);
      if (!ids.length) return;
      this.confirmDel(ids, 'Delete ' + ids.length + ' product' + (ids.length > 1 ? 's' : '') + '?');
    });
  },

  // ── Import ──────────────────────────────────────────────────────────────
  showImport() {
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">Import Kitchen Products from File</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:16px;">'
      + 'Upload a CSV or Excel file from your POS, inventory system, or supplier. The app reads your columns and shows a mapping screen so you can match them to the right fields. Products import instantly — any missing data shows as Incomplete and can be filled in afterwards.</div>'      + '<details style="margin-bottom:16px;"><summary style="font-size:11px;color:var(--t3);cursor:pointer;font-weight:700;letter-spacing:0.5px;">What should my file look like?</summary>'      + '<div style="font-size:11px;color:var(--t2);line-height:1.7;margin-top:8px;padding:10px 12px;background:var(--input);border-radius:3px;">'      + '<strong style="color:var(--t1);">First row must be column headers.</strong> One row per product or ingredient.<br><br>'      + '<strong style="color:var(--t1);">Columns the app recognizes automatically:</strong><br>'      + '&bull; <strong>Name / Item / Product / Ingredient / Description</strong> — required<br>'      + '&bull; <strong>Category / Type / Group / Dept</strong> — optional<br>'      + '&bull; <strong>Vendor / Supplier / Distributor</strong> — optional<br>'      + '&bull; <strong>Unit / UOM / Unit of Measure / Measure / Pack</strong> — optional (lb, oz, each, case, qt, etc.)<br>'      + '&bull; <strong>Cost / Unit Cost / Price / Purchase Price / Item Cost</strong> — optional<br><br>'      + '<strong style="color:var(--t1);">Only Name is required.</strong> Import with just names if that is all you have — add costs and units afterwards. Incomplete products are flagged in red so you know what still needs to be entered.<br><br>'      + '<strong style="color:var(--t1);">Accepted formats:</strong> CSV, Excel (.xlsx, .xls)<br><br>'      + '<strong style="color:var(--t1);">Where to export from:</strong><br>'      + '&bull; <strong>Your inventory system</strong> (MarketMan, Craftable, BlueCart, Compeat) — look for Product List or Item Master export<br>'      + '&bull; <strong>Sysco / US Foods / PFG portal</strong> — your order guide is usually downloadable as Excel. Use it as your product list.<br>'      + '&bull; <strong>Your POS</strong> — Menu Items or Item Library export, filter by Food or Kitchen category<br>'      + '&bull; <strong>A spreadsheet you already maintain</strong> — save as CSV and import directly'      + '</div></details>'
      + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Accepted formats: CSV, XLSX, XLS</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f"><label>Select File</label><input type="file" id="kp-imp-file" accept=".csv,.xlsx,.xls" style="background:var(--input);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:8px;font-size:12px;cursor:pointer;"/></div>'
      + '</div>'
      + '<div id="kp-imp-preview"></div>'
      + '<div class="card-actions"><button class="btn btn-ghost" id="kp-cancel">Cancel</button></div></div>';

    document.getElementById('kp-cancel')?.addEventListener('click', () => this.render(this.container, this.actions));
    document.getElementById('kp-imp-file')?.addEventListener('change', ev => {
      const file = ev.target.files[0];
      if (file) this.readImportFile(file);
    });
  },

  readImportFile(file) {
    const preview = document.getElementById('kp-imp-preview');
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
      if (preview) preview.innerHTML = '<div style="color:var(--red);font-size:12px;margin-top:12px;">Unsupported file type.</div>';
    }
  },

  parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) { this.showImportError('File appears empty.'); return; }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).filter(l => l.trim()).map(line => {
      const vals = []; let inQ = false, cur = '';
      for (const ch of line) {
        if (ch === '"') inQ = !inQ;
        else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      vals.push(cur.trim()); return vals;
    });
    this.showColumnMapper(headers, rows);
  },

  parseXLSX(buffer) {
    const load = () => {
      const wb = XLSX.read(buffer, {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      if (data.length < 2) { this.showImportError('File appears empty.'); return; }
      const headers = data[0].map(h => String(h).trim());
      const rows = data.slice(1).filter(r => r.some(c => c !== '')).map(r => r.map(c => String(c).trim()));
      this.showColumnMapper(headers, rows);
    };
    if (typeof XLSX === 'undefined') {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = load; s.onerror = () => this.showImportError('Could not load Excel reader. Try CSV.');
      document.head.appendChild(s);
    } else load();
  },

  showImportError(msg) {
    const preview = document.getElementById('kp-imp-preview');
    if (preview) preview.innerHTML = '<div style="color:var(--red);font-size:12px;margin-top:12px;">' + esc(msg) + '</div>';
  },

  autoMap(headers) {
    const map = {name:'', category:'', vendor:'', unit:'', cost_per_unit:''};
    const rules = {
      name:         ['name','item','product','description','item name','ingredient'],
      category:     ['category','type','group','dept','department'],
      vendor:       ['vendor','supplier','distributor'],
      unit:         ['unit','uom','unit of measure','measure','pack','size'],
      cost_per_unit:['cost','unit cost','price','purchase price','item cost'],
    };
    headers.forEach(h => {
      const hl = h.toLowerCase().trim();
      Object.entries(rules).forEach(([field, keywords]) => {
        if (!map[field] && keywords.some(k => hl.includes(k))) map[field] = h;
      });
    });
    return map;
  },

  showColumnMapper(headers, rows) {
    const preview = document.getElementById('kp-imp-preview');
    if (!preview) return;
    this._importRows = rows;
    this._importHeaders = headers;
    const autoMap = this.autoMap(headers);
    const fields = [
      {key:'name',         label:'Product Name',  required:true},
      {key:'category',     label:'Category',       required:false},
      {key:'vendor',       label:'Vendor',         required:false},
      {key:'unit',         label:'Unit (lb, oz, each...)', required:false},
      {key:'cost_per_unit',label:'Unit Cost ($)',  required:false},
    ];
    const opts = '<option value="">(skip)</option>' + headers.map(h => '<option value="' + esc(h) + '">' + esc(h) + '</option>').join('');
    let html = '<div class="divider"></div><div class="card"><div class="card-title">Map Your Columns</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:16px;">Found <strong style="color:var(--w);">' + rows.length + ' products</strong>. Match your columns below.</div>'
      + '<div class="form-row" style="flex-wrap:wrap;gap:12px 20px;">';
    fields.forEach(f => {
      const val = autoMap[f.key] || '';
      html += '<div class="f" style="width:200px;flex-shrink:0;"><label>' + f.label + (f.required ? ' <span style="color:var(--red);">*</span>' : '') + '</label>'
        + '<select id="kpm-' + f.key + '">' + opts.replace('value="' + val + '"', 'value="' + val + '" selected') + '</select></div>';
    });
    html += '</div><div id="kp-imp-msg" style="font-size:12px;margin-top:12px;"></div>'
      + '<div class="card-actions"><button class="btn btn-ghost" id="kp-cancel">Cancel</button>'
      + '<button class="btn btn-primary" id="kp-imp-run">Import ' + rows.length + ' Products</button></div></div>';
    preview.innerHTML = html;
    document.getElementById('kp-imp-run')?.addEventListener('click', () => this.runImport());
  },

  runImport() {
    const rows = this._importRows || [];
    const headers = this._importHeaders || [];
    const getCol = key => document.getElementById('kpm-' + key)?.value || '';
    const nameCol = getCol('name');
    if (!nameCol) {
      const msg = document.getElementById('kp-imp-msg');
      if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Product Name column is required.'; }
      return;
    }
    const colIdx = col => headers.indexOf(col);
    const get = (row, col) => { const i = colIdx(col); return i >= 0 ? (row[i] || '').toString().trim() : ''; };
    const parseDollar = str => { if (!str) return null; const n = parseFloat(str.replace(/[^0-9.]/g,'')); return isNaN(n)?null:n; };

    const imported = rows.map(row => {
      const name = get(row, nameCol);
      if (!name) return null;
      return {
        id: App.uid(), name,
        category:      get(row, getCol('category')) || '',
        vendor:        get(row, getCol('vendor')) || '',
        unit:          get(row, getCol('unit')) || '',
        cost_per_unit: parseDollar(get(row, getCol('cost_per_unit'))),
        created_at:    new Date().toISOString(),
        imported:      true
      };
    }).filter(Boolean);

    if (!App.data.kitchen_products) App.data.kitchen_products = [];
    App.data.kitchen_products.push(...imported);
    const btn = document.getElementById('kp-imp-run');
    if (btn) { btn.disabled = true; btn.textContent = 'Importing...'; }
    App.saveKey('kitchen_products').then(() => { this.editId = null; this.renderList(); });
  },

  confirmDel(ids, msg) {
    this._pendingDelIds = ids;
    const modal = document.getElementById('kp-del-modal');
    const msgEl = document.getElementById('kp-del-msg');
    if (msgEl) msgEl.textContent = msg;
    if (modal) modal.style.display = 'flex';
    document.getElementById('kp-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelIds = null; };
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
    const missing = p ? { unit: !p.unit, cost_per_unit: !p.cost_per_unit } : {};
    const rb = f => missing[f] ? 'border-color:var(--red);' : '';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'New') + ' Kitchen Product</div>'
      + (p && !this.isComplete(p) ? '<div style="font-size:11px;color:var(--red);margin-bottom:12px;font-weight:600;">Fields highlighted in red are required.</div>' : '')
      + '<div class="form-row">'
      + '<div class="f w-lg"><label>Product Name</label><input type="text" id="kp-name" value="' + esc(p?.name || '') + '" placeholder="Chicken Breast" /></div>'
      + '<div class="f w-md"><label>Category</label><select id="kp-cat">'
      + ['Protein','Produce','Dairy','Dry Goods','Frozen','Mixer/Supply','Other'].map(c => '<option' + (p?.category === c ? ' selected' : '') + '>' + c + '</option>').join('')
      + '</select></div>'
      + '<div class="f w-md"><label>Vendor</label><input type="text" id="kp-vendor" value="' + esc(p?.vendor || '') + '" placeholder="Sysco" /></div>'
      + '<div class="f" style="width:90px;flex-shrink:0;"><label>Unit ' + tt('kitchen-unit') + '</label>'
      + '<input type="text" id="kp-unit" value="' + esc(p?.unit || '') + '" placeholder="lb" style="' + rb('unit') + '"/></div>'
      + '<div class="f" style="width:90px;flex-shrink:0;"><label>Unit Cost ' + tt('kitchen-cost') + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="kp-cost" value="' + (p?.cost_per_unit || '') + '" step="0.01" placeholder="0.00" style="' + rb('cost_per_unit') + '"/></div></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="kp-save">' + (id ? 'Update' : 'Save') + '</button>'
      + '<button class="btn btn-ghost" id="kp-cancel">Cancel</button>'
      + '<span id="kp-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    document.getElementById('kp-name')?.focus();
    document.getElementById('kp-cancel')?.addEventListener('click', () => this.render(this.container, this.actions));
    document.getElementById('kp-save')?.addEventListener('click', () => this.save());
  },

  save() {
    if (this._saving) return;
    this._saving = true;
    setTimeout(() => { this._saving = false; }, 2000);
    const name = document.getElementById('kp-name')?.value.trim();
    const err  = document.getElementById('kp-err');
    if (!name) { if (err) { err.textContent = 'Name required.'; err.style.display = 'inline'; } this._saving = false; return; }
    const prod = {
      id: this.editId || App.uid(), name,
      category:      document.getElementById('kp-cat')?.value,
      vendor:        document.getElementById('kp-vendor')?.value.trim(),
      unit:          document.getElementById('kp-unit')?.value.trim() || null,
      cost_per_unit: parseFloat(document.getElementById('kp-cost')?.value) || null,
      created_at:    this.editId ? undefined : new Date().toISOString()
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
    App.saveKey('kitchen_products').then(() => { this._saving = false; this.editId = null; this.render(this.container, this.actions); });
  }
};
