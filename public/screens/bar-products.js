'use strict';
S.BarProducts = {
  editId: null,
  _saving: false,
  _pendingDelIds: null,
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
    let g='', h='<option value="">Select container size...</option>';
    this.SIZES.forEach(s => {
      if (s.g !== g) { if (g) h += '</optgroup>'; h += '<optgroup label="' + s.g + '">'; g = s.g; }
      const v = s.oz !== null ? s.oz : 'custom';
      h += '<option value="' + v + '"' + (sel != null && s.oz === sel ? ' selected' : '') + '>' + s.l + '</option>';
    });
    if (g) h += '</optgroup>';
    return h;
  },

  isComplete(p) {
    return !!(p.name && p.bottle_size_oz && p.std_pour_oz && p.cost_per_unit && p.menu_price);
  },

  render(container, actions) {
    this.container = container;
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
    const prods = App.data.bar_products || [];
    const target = App.data.settings.targets?.bar_pour_cost_pct ?? 22;
    const incomplete = prods.filter(p => !this.isComplete(p));
    let html = '';

    if (prods.length === 0) {
      html = '<div class="empty"><div class="empty-title">No bar products yet</div>'
        + '<div class="empty-sub">Add your spirits, beer, and wine to track pour cost and inventory. Or import from a CSV file exported from your POS system.</div>'
        + '<div style="display:flex;gap:10px;justify-content:center;">'
        + '<button class="btn btn-primary" id="bp-add-first">Add Product</button>'
        + '<button class="btn btn-ghost" id="bp-imp-first">Import from File</button>'
        + '</div></div>';
    } else {
      const rows = prods.map(p => {
        const complete = this.isComplete(p);
        const sz  = this.SIZES.find(s => s.oz === p.bottle_size_oz);
        const szL = sz ? sz.l : (p.bottle_size_oz ? p.bottle_size_oz + ' oz' : '—');
        const pc  = p.pour_cost_pct != null ? (p.pour_cost_pct > target ? 'neg' : 'pos') : '';
        return '<tr>'
          + '<td style="width:36px;"><input type="checkbox" class="bp-chk" data-id="' + p.id + '" style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/></td>'
          + '<td><div class="val" style="' + (!complete ? 'color:var(--red);' : '') + '">' + esc(p.name) + '</div>'
          + (!complete ? '<div style="font-size:10px;color:var(--red);font-weight:600;letter-spacing:0.5px;">Incomplete</div>' : '') + '</td>'
          + '<td>' + esc(p.category || '—') + '</td>'
          + '<td>' + esc(szL) + '</td>'
          + '<td>' + (p.std_pour_oz || '—') + ' oz</td>'
          + '<td>' + (p.cost_per_unit ? App.fmtCurrency(p.cost_per_unit) : '<span style="color:var(--t4);">—</span>') + '</td>'
          + '<td>' + (p.cost_per_pour ? App.fmtCurrency(p.cost_per_pour) : '<span style="color:var(--t4);">—</span>') + '</td>'
          + '<td class="' + pc + '">' + (p.pour_cost_pct != null ? App.fmtPct(p.pour_cost_pct) : '<span style="color:var(--t4);">—</span>') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm bp-edit" data-id="' + p.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm bp-del" data-id="' + p.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');

      const alertBar = incomplete.length > 0
        ? '<div class="alert-bar" style="margin-bottom:14px;"><div class="alert-text">'
          + incomplete.length + ' product' + (incomplete.length > 1 ? 's have' : ' has')
          + ' incomplete data — highlighted red in the Product column.</div></div>'
        : '';

      html = alertBar
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
        + '<button class="btn btn-ghost btn-sm" id="bp-sel-all">Select All</button>'
        + '<button class="btn btn-danger btn-sm" id="bp-del-sel" style="display:none;">Delete Selected</button>'
        + '<span id="bp-sel-count" style="font-size:11px;color:var(--t3);"></span>'
        + '</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th style="width:36px;"><input type="checkbox" id="bp-chk-all" style="cursor:pointer;accent-color:var(--gold);width:15px;height:15px;"/></th>'
        + '<th>Product</th><th>Category</th><th>Container</th><th>Std Pour</th>'
        + '<th>Unit Cost</th><th>Cost/Pour</th><th>Pour Cost %</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="bp-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div id="bp-del-msg" style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this product?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="bp-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="bp-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '<div id="bp-form"></div></div>' + modal;

    this.container.onclick = ev => {
      const edit     = ev.target.closest('.bp-edit');
      const del      = ev.target.closest('.bp-del');
      const addFirst = ev.target.closest('#bp-add-first');
      const impFirst = ev.target.closest('#bp-imp-first');
      const cancel   = ev.target.closest('#bp-cancel');
      const save     = ev.target.closest('#bp-save');
      if (edit)     { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      if (del)      { ev.stopPropagation(); this.confirmDel([del.dataset.id], 'Delete this product?'); }
      if (addFirst) { ev.stopPropagation(); this.showForm(); }
      if (impFirst) { ev.stopPropagation(); this.showImport(); }
      if (cancel)   { ev.stopPropagation(); this.renderList(); }
      if (save)     { ev.stopPropagation(); this.save(); }
    };

    const updateSel = () => {
      const checked = this.container.querySelectorAll('.bp-chk:checked');
      const btn = document.getElementById('bp-del-sel');
      const cnt = document.getElementById('bp-sel-count');
      if (btn) btn.style.display = checked.length > 0 ? '' : 'none';
      if (cnt) cnt.textContent   = checked.length > 0 ? checked.length + ' selected' : '';
    };
    document.getElementById('bp-chk-all')?.addEventListener('change', function() {
      document.querySelectorAll('.bp-chk').forEach(c => { c.checked = this.checked; });
      updateSel();
    });
    this.container.addEventListener('change', ev => {
      if (ev.target.classList.contains('bp-chk')) updateSel();
    });
    document.getElementById('bp-sel-all')?.addEventListener('click', () => {
      const chks = document.querySelectorAll('.bp-chk');
      const allChecked = [...chks].every(c => c.checked);
      chks.forEach(c => { c.checked = !allChecked; });
      const ca = document.getElementById('bp-chk-all');
      if (ca) ca.checked = !allChecked;
      updateSel();
    });
    document.getElementById('bp-del-sel')?.addEventListener('click', () => {
      const ids = [...document.querySelectorAll('.bp-chk:checked')].map(c => c.dataset.id);
      if (!ids.length) return;
      this.confirmDel(ids, 'Delete ' + ids.length + ' product' + (ids.length > 1 ? 's' : '') + '?');
    });
  },

  // ── Import ──────────────────────────────────────────────────────────────
  showImport() {
    const fa = document.getElementById('bp-form');
    if (!fa) return;
    fa.innerHTML = '<div class="divider"></div><div class="card">'
      + '<div class="card-title">Import Bar Products from File</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:12px;">'      + 'Upload a CSV or Excel file exported from your POS system or a spreadsheet you already maintain. '      + 'The app reads your columns and shows a mapping screen so you can match them to the right fields. '      + 'Products import instantly — any missing data shows as Incomplete and can be filled in afterwards.</div>'      + '<details style="margin-bottom:16px;"><summary style="font-size:11px;color:var(--t3);cursor:pointer;font-weight:700;letter-spacing:0.5px;">What should my file look like?</summary>'      + '<div style="font-size:11px;color:var(--t2);line-height:1.7;margin-top:8px;padding:10px 12px;background:var(--input);border-radius:3px;">'      + '<strong style="color:var(--t1);">First row must be column headers.</strong> One row per product.<br><br>'      + '<strong style="color:var(--t1);">Columns the app recognizes automatically:</strong><br>'      + '&bull; <strong>Name / Item / Product / Description</strong> — required<br>'      + '&bull; <strong>Category / Type / Group / Dept</strong> — optional<br>'      + '&bull; <strong>Vendor / Supplier / Distributor</strong> — optional<br>'      + '&bull; <strong>Size / Bottle Size / Container / Volume / Oz</strong> — optional, in ounces<br>'      + '&bull; <strong>Pour / Pour Size / Standard Pour / Std Pour</strong> — optional, in ounces<br>'      + '&bull; <strong>Cost / Unit Cost / COGS / Item Cost / Wholesale / Price Paid</strong> — optional<br>'      + '&bull; <strong>Price / Menu Price / Sell Price / Retail / Selling Price</strong> — optional<br><br>'      + '<strong style="color:var(--t1);">Only Name is truly required.</strong> Import with just names and categories if that is all you have — then fill in costs and pour sizes afterwards. The app flags incomplete products so you know exactly what still needs to be entered.<br><br>'      + '<strong style="color:var(--t1);">Accepted formats:</strong> CSV, Excel (.xlsx, .xls)<br><br>'      + '<strong style="color:var(--t1);">Where to export from your POS:</strong><br>'      + '&bull; Toast: Menu → Menu Items → Export<br>'      + '&bull; Square: Items → Item Library → Export CSV<br>'      + '&bull; Lightspeed: Menu → Products → Export<br>'      + '&bull; Aloha: Maintenance → Menu → Items → Export<br>'      + '&bull; Any system: look for Menu Items, Item List, or Product List export. Your distributor may also provide a product/price list in Excel.'      + '</div></details>'
      + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Accepted formats: CSV, XLSX, XLS</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f"><label>Select File</label><input type="file" id="bp-imp-file" accept=".csv,.xlsx,.xls" style="background:var(--input);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:8px;font-size:12px;cursor:pointer;"/></div>'
      + '</div>'
      + '<div id="bp-imp-preview"></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-ghost" id="bp-cancel">Cancel</button>'
      + '</div></div>';

    document.getElementById('bp-imp-file')?.addEventListener('change', ev => {
      const file = ev.target.files[0];
      if (file) this.readImportFile(file);
    });
  },

  readImportFile(file) {
    const preview = document.getElementById('bp-imp-preview');
    if (preview) { preview.innerHTML = '<div style="color:var(--t3);font-size:12px;margin-top:12px;">Reading file...</div>'; }

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
      if (preview) preview.innerHTML = '<div style="color:var(--red);font-size:12px;margin-top:12px;">Unsupported file type. Please use CSV or Excel.</div>';
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
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      vals.push(cur.trim());
      return vals;
    });
    this.showColumnMapper(headers, rows, 'csv');
  },

  parseXLSX(buffer) {
    // Use SheetJS if available, else show error
    if (typeof XLSX === 'undefined') {
      // Load SheetJS dynamically
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      script.onload = () => {
        const wb = XLSX.read(buffer, {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
        if (data.length < 2) { this.showImportError('File appears empty.'); return; }
        const headers = data[0].map(h => String(h).trim());
        const rows = data.slice(1).filter(r => r.some(c => c !== '')).map(r => r.map(c => String(c).trim()));
        this.showColumnMapper(headers, rows, 'xlsx');
      };
      script.onerror = () => this.showImportError('Could not load Excel reader. Try saving as CSV instead.');
      document.head.appendChild(script);
    } else {
      const wb = XLSX.read(buffer, {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      if (data.length < 2) { this.showImportError('File appears empty.'); return; }
      const headers = data[0].map(h => String(h).trim());
      const rows = data.slice(1).filter(r => r.some(c => c !== '')).map(r => r.map(c => String(c).trim()));
      this.showColumnMapper(headers, rows, 'xlsx');
    }
  },

  showImportError(msg) {
    const preview = document.getElementById('bp-imp-preview');
    if (preview) preview.innerHTML = '<div style="color:var(--red);font-size:12px;margin-top:12px;">' + esc(msg) + '</div>';
  },

  // Auto-detect column mapping from common POS export header names
  autoMap(headers) {
    const map = {name:'', category:'', vendor:'', bottle_size_oz:'', std_pour_oz:'', cost_per_unit:'', menu_price:''};
    const rules = {
      name:          ['name','item','product','description','item name','product name','menu item','item description'],
      category:      ['category','type','group','item type','item category','dept','department'],
      vendor:        ['vendor','supplier','distributor','source'],
      bottle_size_oz:['size','bottle size','container','volume','oz','ounces','bottle'],
      std_pour_oz:   ['pour','pour size','standard pour','std pour','pour oz'],
      cost_per_unit: ['cost','unit cost','cogs','item cost','purchase cost','price paid','wholesale'],
      menu_price:    ['price','sell price','menu price','sales price','retail','selling price','menu'],
    };
    headers.forEach(h => {
      const hl = h.toLowerCase().trim();
      Object.entries(rules).forEach(([field, keywords]) => {
        if (!map[field] && keywords.some(k => hl.includes(k))) map[field] = h;
      });
    });
    return map;
  },

  showColumnMapper(headers, rows, fmt) {
    const preview = document.getElementById('bp-imp-preview');
    if (!preview) return;
    this._importRows = rows;
    this._importHeaders = headers;
    const autoMap = this.autoMap(headers);
    const fields = [
      {key:'name',          label:'Product Name',   required:true},
      {key:'category',      label:'Category',        required:false},
      {key:'vendor',        label:'Vendor',          required:false},
      {key:'bottle_size_oz',label:'Container Size (oz)', required:false},
      {key:'std_pour_oz',   label:'Standard Pour (oz)',  required:false},
      {key:'cost_per_unit', label:'Unit Cost ($)',    required:false},
      {key:'menu_price',    label:'Menu Price ($)',   required:false},
    ];
    const opts = ['<option value="">(skip)</option>'] + headers.map(h => '<option value="' + esc(h) + '">' + esc(h) + '</option>').join('');

    let html = '<div class="divider"></div><div class="card"><div class="card-title">Map Your Columns</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:16px;">'
      + 'We found <strong style="color:var(--w);">' + rows.length + ' products</strong> in your file. '
      + 'Match each field to your column. Fields we detected are pre-selected — correct any that are wrong.</div>'
      + '<div class="form-row" style="flex-wrap:wrap;gap:12px 20px;">';

    fields.forEach(f => {
      const val = autoMap[f.key] || '';
      html += '<div class="f" style="width:200px;flex-shrink:0;">'
        + '<label>' + f.label + (f.required ? ' <span style="color:var(--red);">*</span>' : '') + '</label>'
        + '<select id="bpm-' + f.key + '">' + opts.replace('value="' + val + '"', 'value="' + val + '" selected') + '</select>'
        + '</div>';
    });

    html += '</div>'
      + '<div id="bp-imp-msg" style="font-size:12px;margin-top:12px;"></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-ghost" id="bp-cancel">Cancel</button>'
      + '<button class="btn btn-primary" id="bp-imp-run">Import ' + rows.length + ' Products</button>'
      + '</div></div>';

    preview.innerHTML = html;

    document.getElementById('bp-imp-run')?.addEventListener('click', () => this.runImport());
  },

  runImport() {
    const rows = this._importRows || [];
    const headers = this._importHeaders || [];
    const getCol = key => {
      const sel = document.getElementById('bpm-' + key);
      return sel?.value || '';
    };
    const nameCol = getCol('name');
    if (!nameCol) {
      const msg = document.getElementById('bp-imp-msg');
      if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Product Name column is required.'; }
      return;
    }

    const colIdx = col => headers.indexOf(col);
    const get = (row, col) => { const i = colIdx(col); return i >= 0 ? (row[i] || '').toString().trim() : ''; };

    const parseOz = str => {
      if (!str) return null;
      const n = parseFloat(str.replace(/[^0-9.]/g, ''));
      return isNaN(n) ? null : n;
    };
    const parseDollar = str => {
      if (!str) return null;
      const n = parseFloat(str.replace(/[^0-9.]/g, ''));
      return isNaN(n) ? null : n;
    };

    const imported = [];
    rows.forEach(row => {
      const name = get(row, nameCol);
      if (!name) return;
      const oz     = parseOz(get(row, getCol('bottle_size_oz')));
      const pour   = parseOz(get(row, getCol('std_pour_oz')));
      const cost   = parseDollar(get(row, getCol('cost_per_unit')));
      const price  = parseDollar(get(row, getCol('menu_price')));
      const pours  = oz && pour ? oz / pour : null;
      const cpp    = pours && cost ? cost / pours : null;
      const pct    = cpp && price ? cpp / price * 100 : null;

      imported.push({
        id: App.uid(),
        name,
        category:        get(row, getCol('category')) || '',
        vendor:          get(row, getCol('vendor')) || '',
        bottle_size_oz:  oz,
        std_pour_oz:     pour,
        cost_per_unit:   cost,
        menu_price:      price,
        pours_per_bottle: pours,
        cost_per_pour:   cpp,
        pour_cost_pct:   pct,
        created_at:      new Date().toISOString(),
        imported:        true
      });
    });

    if (!App.data.bar_products) App.data.bar_products = [];
    App.data.bar_products.push(...imported);

    const btn = document.getElementById('bp-imp-run');
    if (btn) { btn.disabled = true; btn.textContent = 'Importing...'; }

    App.saveKey('bar_products').then(() => {
      this.editId = null;
      this.renderList();
    });
  },

  // ── Delete confirm ────────────────────────────────────────────────────
  confirmDel(ids, msg) {
    this._pendingDelIds = ids;
    const modal = document.getElementById('bp-del-modal');
    const msgEl = document.getElementById('bp-del-msg');
    if (msgEl) msgEl.textContent = msg;
    if (modal) modal.style.display = 'flex';
    document.getElementById('bp-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelIds = null; };
    document.getElementById('bp-del-confirm').onclick = () => {
      modal.style.display = 'none';
      const ids = this._pendingDelIds || [];
      App.data.bar_products = (App.data.bar_products || []).filter(p => !ids.includes(p.id));
      App.saveKey('bar_products').then(() => this.renderList());
      this._pendingDelIds = null;
    };
  },

  // ── Form ─────────────────────────────────────────────────────────────
  showForm(id) {
    this.editId = id || null;
    const p = id ? (App.data.bar_products || []).find(p => p.id === id) : null;
    const fa = document.getElementById('bp-form');
    if (!fa) return;
    const isCustom = p?.bottle_size_oz != null && !this.SIZES.find(s => s.oz === p.bottle_size_oz);
    const missing = p ? {
      bottle_size_oz: !p.bottle_size_oz,
      std_pour_oz:    !p.std_pour_oz,
      cost_per_unit:  !p.cost_per_unit,
      menu_price:     !p.menu_price
    } : {};
    const rb = f => missing[f] ? 'border-color:var(--red);' : '';

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
      + '<select id="bp-size" style="' + rb('bottle_size_oz') + '">' + this.sizeOpts(isCustom ? null : p?.bottle_size_oz) + '</select></div>'
      + '<div class="f" id="bp-cw" style="width:110px;flex-shrink:0;' + (isCustom ? '' : 'display:none;') + '"><label>Custom (oz)</label>'
      + '<div class="fw"><input class="suf" type="number" id="bp-coz" value="' + (isCustom ? p.bottle_size_oz : '') + '" step="0.1"/><span class="suf">oz</span></div></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Std Pour ' + tt('std-pour') + '</label>'
      + '<div class="fw"><input class="suf" type="number" id="bp-pour" value="' + (p?.std_pour_oz || '') + '" step="0.25" placeholder="1.5" style="' + rb('std_pour_oz') + '"/><span class="suf">oz</span></div></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Unit Cost ' + tt('unit-cost') + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="bp-cost" value="' + (p?.cost_per_unit || '') + '" step="0.01" placeholder="0.00" style="' + rb('cost_per_unit') + '"/></div></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Menu Price ' + tt('menu-price') + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="bp-price" value="' + (p?.menu_price || '') + '" step="0.25" placeholder="0.00" style="' + rb('menu_price') + '"/></div></div>'
      + '</div>'
      + (p && !this.isComplete(p) ? '<div style="font-size:11px;color:var(--red);margin-bottom:12px;font-weight:600;">Fields highlighted in red are required to calculate pour cost and variance.</div>' : '')
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
    const oz    = this.getOz();
    const pour  = parseFloat(document.getElementById('bp-pour')?.value) || 0;
    const cost  = parseFloat(document.getElementById('bp-cost')?.value) || 0;
    const price = parseFloat(document.getElementById('bp-price')?.value) || 0;
    const target = App.data.settings.targets?.bar_pour_cost_pct || 22;
    const pours = pour > 0 ? oz / pour : null;
    const cpp   = pours ? cost / pours : null;
    const pct   = cpp && price ? cpp / price * 100 : null;
    const set   = (id, val, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = val; el.className = 'calc-val' + (cls ? ' ' + cls : ''); };
    set('bp-pours', pours ? pours.toFixed(1) : '—');
    set('bp-cpp',   cpp   ? App.fmtCurrency(cpp) : '—');
    set('bp-pct',   pct   ? App.fmtPct(pct) : '—', pct ? (pct > target ? 'warn' : 'good') : '');
  },

  save() {
    if (this._saving) return;
    this._saving = true;
    setTimeout(() => { this._saving = false; }, 2000);

    const name = document.getElementById('bp-name')?.value.trim();
    const err  = document.getElementById('bp-err');
    if (!name) { if (err) { err.textContent = 'Name required.'; err.style.display = 'inline'; } this._saving = false; return; }

    const oz    = this.getOz();
    const pour  = parseFloat(document.getElementById('bp-pour')?.value) || 0;
    const cost  = parseFloat(document.getElementById('bp-cost')?.value) || 0;
    const price = parseFloat(document.getElementById('bp-price')?.value) || 0;
    const pours = pour > 0 && oz > 0 ? oz / pour : null;
    const cpp   = pours && cost ? cost / pours : null;
    const pct   = cpp && price ? cpp / price * 100 : null;

    const prod = {
      id: this.editId || App.uid(),
      name,
      category:        document.getElementById('bp-cat')?.value,
      vendor:          document.getElementById('bp-vendor')?.value.trim(),
      bottle_size_oz:  oz || null,
      std_pour_oz:     pour || null,
      cost_per_unit:   cost || null,
      menu_price:      price || null,
      pours_per_bottle: pours,
      cost_per_pour:   cpp,
      pour_cost_pct:   pct,
      created_at:      this.editId ? undefined : new Date().toISOString()
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
      this.editId  = null;
      this.renderList();
    });
  }
};
