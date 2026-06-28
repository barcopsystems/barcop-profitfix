'use strict';

/* ── Inventory Control — Empties Log (writes ic_empties) ──────────────────────
   Tracks empty container disposition for compliance (some states/cities
   require recyclable/redeemable container logs by law) and deposit
   redemption tracking. Standalone — does not affect inventory math.

   Entry is a BATCH builder (a shared header over a stack of line rows, Add Line,
   one Save All) matching the Waste / Void-Comp logs. Each line saves as its own
   record. Edit a past one in a focused pop-up.

   Each record: { id, date, product_id, product_name, category, quantity,
   unit, deposit_amount, disposition (Recycle/Return for Deposit/Trash),
   performed_by_id, performed_by, notes, created_at }. */

S.InventoryEmpties = {
  editId: null,
  _draft: null,            // in-memory header draft (survives leave/return)
  _draftRows: null,        // in-memory line rows
  filterPreset: 'last-4',  // active range chip (weekly cadence)
  _prevPreset: 'last-4',   // range to restore when Custom is toggled closed
  filterFrom: '',          // custom range only
  filterTo: '',
  RANGE_CHIPS: [
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'last-12', label: 'Last 12 Weeks' }, { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],

  DISPOSITIONS: ['Recycle', 'Return for Deposit', 'Trash'],

  empties() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_empties)) App.inventoryData.ic_empties = [];
    return App.inventoryData.ic_empties;
  },
  products() {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
  },
  // Empties are bar containers (bottles, cans, kegs). Food and Misc are excluded
  // from every product picker on this screen.
  barProducts() {
    const bar = App.BAR_CATS || ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer'];
    return this.products().filter(p => bar.includes(p.category));
  },
  productById(id) {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
  },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
  activeShift() {
    const list = (App.shiftData && App.shiftData.sc_shifts) || [];
    return list.filter(s => s.status === 'Open')
      .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())[0] || null;
  },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // The empties unit is implied by the product: draft is by the keg, everything
  // else (liquor, wine, bottle beer) is by the bottle.
  unitFor(category) { return category === 'Draft Beer' ? 'kegs' : 'bottles'; },

  // Effective window from the active range chip; Custom reads From/To; All clears.
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'em-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
        + '<button class="btn btn-ghost btn-sm" id="em-export">Export PDF</button>'
      + '</div></div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="em-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="em-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
  },

  // ── Entry ───────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    this.renderList();
  },

  renderList() {
    this.editId = null;
    this.actions.innerHTML = '';

    if (this.products().length === 0) {
      App.setupCard(this.container, {
        title: 'Set Up the Empties Log',
        lead: 'The Empties Log tracks empty containers as you clear them, for deposit redemption and the container record some states require. Add your products first.',
        steps: [
          { title: 'Add your products', desc: 'Empties are tracked against your products, so add what you stock first.', btn: 'Add Products', screen: 'ic-product-setup', done: this.products().length > 0 }
        ]
      });
      return;
    }

    const all = this.empties();
    const formCard = this.builderCard();

    let below;
    if (all.length === 0) {
      below = '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
        + '<th>Date</th><th>Product</th><th>Quantity</th><th>Disposition</th><th>Deposit Value</th><th>By</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="7" style="color:var(--t3);">No empties logged yet. Use the form above to log the first one.</td></tr></tbody></table></div>';
    } else {
      const { from, to } = this.effectiveRange();
      const filtered = all.filter(e => {
        const date = e.date || '';
        return (!from || date >= from) && (!to || date <= to);
      }).sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());

      let depositOwed = 0, lastDate = '';
      all.forEach(e => {
        if (e.disposition === 'Return for Deposit') depositOwed += (parseFloat(e.deposit_amount) || 0) * (parseFloat(e.quantity) || 0);
        const d = e.date || e.created_at || '';
        if (!lastDate || new Date(d).getTime() > new Date(lastDate).getTime()) lastDate = d;
      });
      const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val lg">' + all.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Deposit Owed</div><div class="calc-val lg">' + App.fmtCurrency(depositOwed) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Last Entry</div><div class="calc-val lg">' + this.fmtDate((lastDate || '').slice(0, 10)) + '</div></div>'
        + '</div></div>';

      let listHtml;
      if (filtered.length === 0) {
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>Date</th><th>Product</th><th>Quantity</th><th>Disposition</th><th>Deposit Value</th><th>By</th><th></th>'
          + '</tr></thead><tbody><tr><td colspan="7" style="color:var(--t3);">No empties in this range. Pick a wider range above.</td></tr></tbody></table></div>';
      } else {
        const rows = filtered.slice(0, App.listLimit('ic', 'empty')).map(e => {
          const deposit = (parseFloat(e.deposit_amount) || 0) * (parseFloat(e.quantity) || 0);
          return '<tr class="em-row" data-id="' + e.id + '" style="cursor:pointer;">'
            + '<td><div class="val">' + this.fmtDate(e.date) + '</div></td>'
            + '<td><div class="val">' + esc(e.product_name || '-') + '</div>'
            + (e.category ? '<div style="font-size:10px;color:var(--t3);">' + esc(e.category) + '</div>' : '') + '</td>'
            + '<td>' + (e.quantity != null ? e.quantity : '-') + ' ' + esc(e.unit || '') + '</td>'
            + '<td>' + esc(e.disposition || '-') + '</td>'
            + '<td>' + (deposit > 0 ? App.fmtCurrency(deposit) : '<span style="color:var(--t4);">-</span>') + '</td>'
            + '<td>' + esc(e.performed_by || '-') + '</td>'
            + '<td><div class="row-actions">'
            + (App.canEdit('ic-empties') ? '<button class="btn btn-ghost btn-sm em-edit" data-id="' + e.id + '">Edit</button>' : '')
            + (App.canEdit('ic-empties') ? '<button class="btn btn-danger btn-sm em-del" data-id="' + e.id + '">Delete</button>' : '')
            + '</div></td></tr>';
        }).join('');
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>Date</th><th>Product</th><th>Quantity</th><th>Disposition</th><th>Deposit Value</th><th>By</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          + App.showOlderBar('ic', 'empty', filtered, this.filterPreset !== 'all');
      }
      below = statsCard + this.filterRow() + listHtml;
    }

    this.container.innerHTML = '<div class="screen">' + formCard + below + '</div>';
    App.applyCollapsed(this.container);
    this.wireList();
  },

  showHowTo() {
    App.showHelpModal('How the Empties Log Works', [
      { p: ['The Empties Log records empty containers as you clear them, like spent kegs, bottles, and cans. Some states and cities require a container log by law, and it is how you track deposit money you can claim back. That deposit money adds up over a year and most operators leave it on the table because nobody is counting it.'] },
      { h: 'Logging Empties', p: ['Set the date and who is logging up top, then add a line for each kind of empty: pick the product, how many containers, and what happened to them, Recycle, Return for Deposit, or Trash. The unit follows the product, draft by the keg and everything else by the bottle. Add the deposit per container when there is money on them and Bar Cop totals it per line. Add Line for another, and Save All writes them in one shot. Start Over clears the form.'] },
      { h: 'Deposits And Compliance', p: ['When you mark containers Return for Deposit and set a deposit amount, Bar Cop multiplies it by the quantity and tracks the money owed back to you. The log doubles as your compliance record if an inspector ever asks for one, so you are covered on both fronts from a single entry.'] },
      { h: 'A Real Example', p: ['Saturday night The Anchor goes through two cases of Modelo, twenty four cans each, and a half keg of a local lager. The next morning your barback clears the empties. Log the Modelo cans as forty eight bottles, Return for Deposit, ten cents each, which Bar Cop books as four dollars and eighty cents owed back. Log the keg as one keg, Return for Deposit at the distributor keg deposit. Come the next Republic National delivery you hand back the empties and collect, with the log to prove what is owed.'] },
      { h: 'It Does Not Change Your Counts', p: ['Logging an empty does not touch your inventory totals, usage, or variance. The product was already used and counted when it poured. This log is purely about where the empty container went.'] },
      { h: 'Filtering And History', p: ['Every entry drops into the list below. Use the range chips to pull up this month, the last few weeks, twelve weeks, or all of it, and edit or delete any entry to fix a mistake. The Worksheet button gives you a clean PDF grid to print and fill on the floor, then enter after close.'] }
    ]);
  },

  // ── Batch entry builder (mirrors the Waste / Void-Comp logs) ───────────────
  builderInner(useDraft) {
    const active = this.activeShift();
    const defaultBy = active ? (active.manager_id || '') : '';
    const rowsHtml = (useDraft && this._draftRows && this._draftRows.length)
      ? this._draftRows.map(r => this.lineHtml(r)).join('')
      : this.lineHtml();
    return '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Date</label>'
          + '<input type="date" id="emb-date" value="' + esc(App.todayLocal()) + '"/></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Performed By</label>'
          + '<select id="emb-by">' + App.staffOptions(defaultBy, { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'
      + '<div class="pill-wrap" style="margin-bottom:12px;">'
      + '<table class="ing-tbl pill"><thead><tr>'
      + '<th style="min-width:170px;">Product</th><th style="width:80px;">Qty</th><th style="width:60px;">Unit</th>'
      + '<th style="width:90px;">Deposit</th><th style="min-width:150px;">Disposition</th><th style="width:90px;">Value</th><th style="width:80px;"></th>'
      + '</tr></thead><tbody id="emb-rows">' + rowsHtml + '</tbody></table></div>'
      + '<button class="btn btn-ghost btn-sm" id="emb-add" type="button" style="margin-bottom:14px;">+ Add Line</button>'
      + '<div class="form-row" style="gap:12px;"><div class="f" style="width:100%;"><label>Notes</label><textarea id="emb-notes" class="notes-ta" rows="2" placeholder="Optional"></textarea></div></div>';
  },

  builderCard() {
    return '<div class="card form-card no-print">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
        + '<span>Log Empties</span>'
        + '<button class="btn btn-ghost btn-sm" id="em-print-blank" type="button">Worksheet</button>'
      + '</div>'
      + this.builderInner(true)
      + '</div>'
      + '<div class="no-print" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary" id="emb-save">Save All</button>'
        + '<button class="btn btn-ghost" id="emb-startover">Start Over</button>'
        + '<span id="emb-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';
  },

  dispositionOptions(selected) {
    return '<option value="">Select...</option>'
      + this.DISPOSITIONS.map(d => '<option' + (d === selected ? ' selected' : '') + '>' + esc(d) + '</option>').join('');
  },

  // One empties line = one table row. Product drives the Unit label; Qty +
  // Deposit drive the read-only deposit Value cell.
  lineHtml(row) {
    row = row || {};
    const cat = row.product_id ? (this.productById(row.product_id)?.category || '') : '';
    const unitLabel = row.product_id ? this.unitFor(cat) : '-';
    return '<tr class="em-line">'
      + '<td><select class="form-input eml-prod" style="width:100%;">' + this.productOptions(row.product_id || '') + '</select></td>'
      + '<td><input class="form-input eml-qty" type="number" min="0" step="1" value="' + (row.quantity != null && row.quantity !== '' ? esc(String(row.quantity)) : '') + '" placeholder="0" style="width:100%;"/></td>'
      + '<td class="eml-unit" style="color:var(--t2);font-size:12px;">' + esc(unitLabel) + '</td>'
      + '<td><div class="fw"><span class="pre">$</span><input class="form-input pre eml-deposit" type="number" min="0" step="0.01" value="' + (row.deposit_amount != null && row.deposit_amount !== '' ? esc(String(row.deposit_amount)) : '') + '" placeholder="0.05" style="width:100%;"/></div></td>'
      + '<td><select class="form-input eml-disp" style="width:100%;">' + this.dispositionOptions(row.disposition || '') + '</select></td>'
      + '<td class="eml-val val" style="font-size:12px;">-</td>'
      + '<td><button class="btn btn-danger btn-sm eml-del" type="button">Delete</button></td>'
      + '</tr>';
  },

  addLine() {
    const wrap = document.getElementById('emb-rows');
    if (wrap) wrap.insertAdjacentHTML('beforeend', this.lineHtml());
  },
  removeLine(line) {
    const wrap = document.getElementById('emb-rows');
    if (!wrap || !line) return;
    if (wrap.querySelectorAll('.em-line').length <= 1) wrap.innerHTML = this.lineHtml();
    else line.remove();
  },

  // Refresh a line's Unit label + deposit Value from its current product, qty,
  // and deposit.
  refreshLineCalc(line) {
    if (!line) return;
    const p = this.productById(line.querySelector('.eml-prod')?.value || '');
    const unitCell = line.querySelector('.eml-unit');
    if (unitCell) unitCell.textContent = p ? this.unitFor(p.category) : '-';
    const qty = parseFloat(line.querySelector('.eml-qty')?.value);
    const dep = parseFloat(line.querySelector('.eml-deposit')?.value);
    const cell = line.querySelector('.eml-val');
    if (cell) {
      const val = (qty > 0 && dep > 0) ? qty * dep : 0;
      cell.textContent = val > 0 ? App.fmtCurrency(val) : '-';
    }
  },

  onLineChange(ev) {
    const line = ev.target.closest('.em-line');
    if (!line) return;
    if (ev.target.classList.contains('eml-prod') || ev.target.classList.contains('eml-qty') || ev.target.classList.contains('eml-deposit')) this.refreshLineCalc(line);
  },

  async saveBatch(after) {
    const err = document.getElementById('emb-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('emb-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const byId = document.getElementById('emb-by')?.value || '';
    if (!byId) { fail('Pick who logged this.'); return; }
    const byName = (this.staffById(byId) || {}).name || '';
    const notes = document.getElementById('emb-notes')?.value.trim() || '';

    const recs = [];
    const rowsWrap = document.getElementById('emb-rows');
    for (const line of (rowsWrap ? [...rowsWrap.querySelectorAll('.em-line')] : [])) {
      const productId = line.querySelector('.eml-prod')?.value || '';
      const qtyRaw    = line.querySelector('.eml-qty')?.value;
      const disp      = line.querySelector('.eml-disp')?.value || '';
      // Skip a line the manager added but never filled.
      if (!productId && (qtyRaw === '' || qtyRaw == null) && !disp) continue;
      if (!productId) { fail('Pick a product on every line, or remove the blank line.'); return; }
      const product = this.productById(productId);
      if (!product) { fail('A line has a product that no longer exists. Remove it.'); return; }
      const quantity = parseFloat(qtyRaw);
      if (isNaN(quantity) || quantity <= 0) { fail('Enter a quantity above zero on every line.'); return; }
      if (!disp) { fail('Pick a disposition on every line.'); return; }
      recs.push({
        id: App.uid(), date,
        product_id: product.id, product_name: product.name, category: product.category || '',
        quantity, unit: this.unitFor(product.category),
        deposit_amount: parseFloat(line.querySelector('.eml-deposit')?.value) || 0,
        disposition: disp,
        performed_by_id: byId, performed_by: byName,
        notes, created_at: new Date().toISOString()
      });
    }
    if (!recs.length) { fail('Fill in at least one line.'); return; }

    const btn = document.getElementById('emb-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    let ok = true;
    for (const r of recs) { ok = (await App.putRecord('ic', 'empty', r)) && ok; }
    if (ok) { this._draft = null; this._draftRows = null; (typeof after === 'function' ? after : () => this.renderList())(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Save All'; } fail('Save failed. Try again.'); }
  },

  startOver() {
    this.editId = null;
    this._draft = null;
    this._draftRows = null;
    this.renderList();
  },

  wireList() {
    this.container.onclick = ev => {
      const head = ev.target.closest('.card-collapse-head');
      if (head && !ev.target.closest('.btn')) { App.toggleCollapse(head); return; }
      const chip = ev.target.closest('.em-range-chip');
      if (chip) {
        const v = chip.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.renderList();
        return;
      }
      if (ev.target.closest('#em-export')) { App.exportPDF({ title: 'Empties Log', root: this.container }); return; }
      if (ev.target.closest('#em-print-blank')) { this.printBlank(); return; }
      if (ev.target.closest('#emb-add')) { this.addLine(); return; }
      if (ev.target.closest('#emb-save')) { this.saveBatch(); return; }
      if (ev.target.closest('#emb-startover')) { this.startOver(); return; }
      const rm = ev.target.closest('.eml-del');
      if (rm) { this.removeLine(rm.closest('.em-line')); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const edit = ev.target.closest('.em-edit');
      const del  = ev.target.closest('.em-del');
      const row  = ev.target.closest('.em-row');
      if (del)  { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (edit) { ev.stopPropagation(); this.openEdit(edit.dataset.id); return; }
      if (row && App.canEdit('ic-empties')) this.openEdit(row.dataset.id);
    };
    // Per-line: product drives the Unit label, qty + deposit drive the Value.
    this.container.onchange = ev => this.onLineChange(ev);
    document.getElementById('em-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('em-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });

    // Hold the in-progress batch through leave/return.
    const formRoot = this.container.querySelector('.form-card');
    if (formRoot) {
      if (this._draft) App.restoreDraft(formRoot, this._draft);
      formRoot.querySelectorAll('.em-line').forEach(line => this.refreshLineCalc(line));
      const cap = () => {
        this._draft = App.captureDraft(formRoot);
        this._draftRows = [...formRoot.querySelectorAll('.em-line')].map(line => ({
          product_id:     line.querySelector('.eml-prod')?.value || '',
          quantity:       line.querySelector('.eml-qty')?.value || '',
          deposit_amount: line.querySelector('.eml-deposit')?.value || '',
          disposition:    line.querySelector('.eml-disp')?.value || ''
        }));
      };
      formRoot.addEventListener('input', cap);
      formRoot.addEventListener('change', cap);
    }
  },

  // ── Edit a single past entry in a focused pop-up ────────────────────────────
  // Single-record field layout. `idp` ('eme-') prefixes every field id.
  formRows(e, idp) {
    const v = val => (val != null && val !== '') ? val : '';
    const active = this.activeShift();
    const defaultMgrId = active ? (active.manager_id || '') : '';
    const initialProdId = e?.product_id || '';
    const initialCat = initialProdId ? (this.productById(initialProdId)?.category || '') : '';
    const dispOpts = this.DISPOSITIONS.map(d =>
      '<option' + (e?.disposition === d ? ' selected' : '') + '>' + esc(d) + '</option>').join('');

    return '<div class="form-row" style="gap:10px;flex-wrap:wrap;">'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Date</label>'
          + '<input type="date" id="' + idp + 'date" value="' + esc(e?.date || App.todayLocal()) + '"/></div>'
        + '<div class="f" style="flex:1.4;min-width:150px;"><label>Product</label>'
          + '<select id="' + idp + 'prod">' + this.productOptions(initialProdId) + '</select></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Qty</label>'
          + '<div class="fw"><input class="suf" type="number" id="' + idp + 'qty" min="0" step="1" value="' + v(e?.quantity) + '" placeholder="0"/><span class="suf" id="' + idp + 'qty-unit">' + (initialCat ? this.unitFor(initialCat) : 'bottles') + '</span></div></div>'
        + '<div class="f" style="width:86px;flex-shrink:0;"><label>Deposit</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + idp + 'deposit" min="0" step="0.01" value="' + v(e?.deposit_amount) + '" placeholder="0.05"/></div></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Disposition</label>'
          + '<select id="' + idp + 'disp"><option value="">Select...</option>' + dispOpts + '</select></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Performed By</label>'
          + '<select id="' + idp + 'by">' + App.staffOptions(e?.performed_by_id || defaultMgrId, { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'
      + '<div class="f" style="margin-top:6px;margin-bottom:0;"><label>Notes</label>'
        + '<textarea id="' + idp + 'notes" class="notes-ta" rows="2" placeholder="Optional">' + esc(e?.notes || '') + '</textarea></div>';
  },

  // Product change in the edit popup updates the Qty unit suffix.
  wireProdChange(idp) {
    document.getElementById(idp + 'prod')?.addEventListener('change', ev => {
      const p = this.productById(ev.target.value);
      const hint = document.getElementById(idp + 'qty-unit');
      if (hint) hint.textContent = p ? this.unitFor(p.category) : 'bottles';
    });
  },

  openEdit(id) {
    if (!App.canEdit('ic-empties')) return;
    const e = this.empties().find(x => x.id === id);
    if (!e) return;
    this.editId = id;
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Empties Entry</div>'
      + this.formRows(e, 'eme-')
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="eme-save">Update Entry</button>'
        + '<button class="btn btn-ghost" id="eme-cancel">Cancel</button>'
        + '<span id="eme-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
        + '<button class="btn btn-danger" id="eme-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'em-edit-modal', maxWidth: 540, noClose: true });
    document.getElementById('eme-save')?.addEventListener('click', () => this.saveEdit('eme-', 'em-edit-modal'));
    document.getElementById('eme-cancel')?.addEventListener('click', () => { this.editId = null; App.closeModal('em-edit-modal'); });
    document.getElementById('eme-del')?.addEventListener('click', async () => {
      if (!(await App.confirmDelete())) return;
      await App.removeRecord('ic', 'empty', id);
      this.editId = null;
      App.closeModal('em-edit-modal');
      this.renderList();
    });
    this.wireProdChange('eme-');
  },

  async saveEdit(idp, modalId) {
    const err = document.getElementById(idp + 'err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById(idp + 'date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const productId = document.getElementById(idp + 'prod')?.value;
    if (!productId) { fail('Pick a product.'); return; }
    const product = this.productById(productId);
    if (!product) { fail('Product not found.'); return; }
    const quantity = parseFloat(document.getElementById(idp + 'qty')?.value);
    if (isNaN(quantity) || quantity <= 0) { fail('Enter a quantity greater than zero.'); return; }
    const disposition = document.getElementById(idp + 'disp')?.value;
    if (!disposition) { fail('Pick a disposition (Recycle, Return for Deposit, or Trash).'); return; }
    const performedById = document.getElementById(idp + 'by')?.value;
    if (!performedById) { fail('Pick who logged this.'); return; }
    const performedBy = (this.staffById(performedById) || {}).name || '';

    const rec = {
      id:               this.editId,
      date,
      product_id:       product.id,
      product_name:     product.name,
      category:         product.category || '',
      quantity,
      unit:             this.unitFor(product.category),
      deposit_amount:   parseFloat(document.getElementById(idp + 'deposit')?.value) || 0,
      disposition,
      performed_by_id:  performedById,
      performed_by:     performedBy,
      notes:            document.getElementById(idp + 'notes')?.value.trim() || '',
      updated_at:       new Date().toISOString()
    };
    const ex = this.empties().find(x => x.id === this.editId);
    const saveRec = ex ? { ...ex, ...rec } : rec;

    const btn = document.getElementById(idp + 'save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('ic', 'empty', saveRec);
    this.editId = null;
    if (ok) { if (modalId) App.closeModal(modalId); this.renderList(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Update Entry'; } fail('Save failed. Try again.'); }
  },

  // ── Form options ────────────────────────────────────────────────────
  productOptions(selectedId) {
    const prods = this.barProducts();
    if (!prods.length) return '<option value="">No products set up</option>';
    const cats = (S.InventoryProducts && S.InventoryProducts.CATEGORIES) || ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
    let h = '<option value="">Select product...</option>';
    cats.forEach(cat => {
      const inCat = prods.filter(p => (p.category || '') === cat).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (!inCat.length) return;
      h += '<optgroup label="' + esc(cat) + '">';
      inCat.forEach(p => {
        h += '<option value="' + p.id + '"' + (p.id === selectedId ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      });
      h += '</optgroup>';
    });
    return h;
  },

  async confirmDel(id) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    await App.removeRecord('ic', 'empty', id);
    this.renderList();
  },

  // ── Print blank sheet — for shift use ─────────────────────────────────
  printBlank() {
    App.printBlankSheet({
      title: 'Empties Log',
      subtitle: 'Log every empty container removed during the shift. Required by law in some states for compliance and deposit redemption.',
      columns: [
        { label: 'Time',          width: '12%' },
        { label: 'Product',       width: '30%' },
        { label: 'Qty',           width: '10%' },
        { label: 'Unit',          width: '10%' },
        { label: 'Disposition',   width: '15%' },
        { label: 'Logged By',     width: '15%' },
        { label: 'Initials',      width: '8%' }
      ],
      rows: 20
    });
  }
};
