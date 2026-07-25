'use strict';

/* ── Inventory Control — Transfer Log (writes ic_transfers) ───────────────────
   Logs every movement of inventory between operator-defined locations
   (stockroom → front bar, walk-in → kitchen line, etc). The log is an audit
   trail and accountability record — variance math is NOT affected because
   product totals don't change on a transfer (only location does).

   Entry is a BATCH builder (a shared header over a stack of line rows, Add Line,
   one Save All) matching the Waste / Void-Comp logs, so a whole restock run goes
   in on one submission. Each line saves as its own record. Edit a past one in a
   focused pop-up.

   Each record: { id, date_time, from_location, to_location, product_id,
   product_name, category, quantity, unit, performed_by_id, performed_by,
   witnessed_by_id, witnessed_by, notes, created_at }. */

S.InventoryTransfers = {
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

  transfers() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_transfers)) App.inventoryData.ic_transfers = [];
    return App.inventoryData.ic_transfers;
  },
  products() {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
  },
  productById(id) {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
  },
  locations() {
    return ((App.inventoryData && App.inventoryData.ic_locations) || []).filter(l => !l.archived);
  },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
  activeShift() {
    const list = (App.shiftData && App.shiftData.sc_shifts) || [];
    return list.filter(s => s.status === 'Open')
      .sort(App.cmpNewest)[0] || null;
  },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  fmtDateTime(str) {
    if (!str) return '-';
    const d = new Date(str);
    if (isNaN(d.getTime())) return esc(str);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  },
  nowDateTime() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  },

  // Effective window from the active range chip (preset recomputed off "today"
  // each render); Custom reads the From/To pickers; All clears it.
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  // Range chips left, Export + Worksheet right, directly above the list (the
  // accepted filter model). Custom reveals a bare From/To row. Weekly cadence.
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'tr-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
        + '<button class="btn btn-ghost btn-sm" id="tr-export">Export PDF</button>'
      + '</div></div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="tr-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="tr-f-to" value="' + esc(this.filterTo) + '"/></div>'
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

    if (this.products().length === 0 || this.locations().length < 2) {
      App.setupCard(this.container, {
        title: 'Set Up Transfers',
        lead: 'Transfers move product between locations and build a clean record of every move. Two quick setup steps and you can start logging.',
        steps: [
          { title: 'Add your products', desc: 'Add the products you stock so a transfer has something to move.', btn: 'Add Products', screen: 'ic-product-setup', done: this.products().length > 0 },
          { title: 'Set your locations', desc: 'You need at least two storage locations to move product between, like a stockroom and the front bar.', btn: 'Set Locations', screen: 'ic-locations', done: this.locations().length >= 2 }
        ]
      });
      return;
    }

    const all = this.transfers();
    const formCard = this.builderCard();

    let below;
    if (all.length === 0) {
      below = '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
        + '<th>When</th><th>From &rarr; To</th><th>Product</th><th>Quantity</th><th>By</th><th>Witnessed By</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="7" style="color:var(--t3);">No transfers logged yet. Use the form above to log the first one.</td></tr></tbody></table></div>';
    } else {
      const { from, to } = this.effectiveRange();
      const filtered = all.filter(t => {
        const date = (t.date_time || '').slice(0, 10);
        return (!from || date >= from) && (!to || date <= to);
      }).sort((a, b) => new Date(b.date_time || b.created_at || 0).getTime() - new Date(a.date_time || a.created_at || 0).getTime());

      // The strip describes the list under it, so both figures follow the date chips. Off
      // `all` they showed an all-time count over a four-week list on the default chip.
      const lastDate = filtered.reduce((m, t) => {
        const d = t.date_time || t.created_at || '';
        return (!m || new Date(d).getTime() > new Date(m).getTime()) ? d : m;
      }, '');
      const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Transfers</div><div class="calc-val lg">' + filtered.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Last Transfer</div><div class="calc-val lg">' + this.fmtDate((lastDate || '').slice(0, 10)) + '</div></div>'
        + '</div></div>';

      let listHtml;
      if (filtered.length === 0) {
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>When</th><th>From &rarr; To</th><th>Product</th><th>Quantity</th><th>By</th><th>Witnessed By</th><th></th>'
          + '</tr></thead><tbody><tr><td colspan="7" style="color:var(--t3);">No transfers in this range. Pick a wider range above.</td></tr></tbody></table></div>';
      } else {
        const rows = filtered.slice(0, App.listLimit('ic', 'transfer')).map(t => {
          const p = this.productById(t.product_id);
          return '<tr class="tr-row" data-id="' + t.id + '" style="cursor:pointer;">'
            + '<td><div class="val">' + this.fmtDateTime(t.date_time) + '</div></td>'
            + '<td>' + esc(t.from_location || '-') + ' <span style="color:var(--t3);">&rarr;</span> ' + esc(t.to_location || '-') + '</td>'
            + '<td><div class="val">' + esc(t.product_name || (p ? p.name : '-')) + '</div>'
            + (t.category ? '<div style="font-size:10px;color:var(--t3);">' + esc(t.category) + '</div>' : '') + '</td>'
            + '<td>' + (t.quantity != null ? t.quantity : '-') + ' ' + esc(t.unit || '') + '</td>'
            + '<td>' + esc(t.performed_by || '-') + '</td>'
            + '<td>' + esc(t.witnessed_by || '-') + '</td>'
            + '<td><div class="row-actions">'
            + (App.canEdit('ic-transfers') ? '<button class="btn btn-ghost btn-sm tr-edit" data-id="' + t.id + '">Edit</button>' : '')
            + (App.canEdit('ic-transfers') ? '<button class="btn btn-danger btn-sm tr-del" data-id="' + t.id + '">Delete</button>' : '')
            + '</div></td></tr>';
        }).join('');
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>When</th><th>From &rarr; To</th><th>Product</th><th>Quantity</th><th>By</th><th>Witnessed By</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          + App.showOlderBar('ic', 'transfer', filtered, this.filterPreset !== 'all');
      }
      below = statsCard + this.filterRow() + listHtml;
    }

    this.container.innerHTML = '<div class="screen">' + formCard + below + '</div>';
    App.applyCollapsed(this.container);
    this.wireList();
  },

  showHowTo() {
    App.showHelpModal('How the Transfer Log Works', [
      { p: ['The Transfer Log records every time product moves from one of your locations to another, like stockroom to the front bar or walk-in to the kitchen line. It is an accountability trail, so you always know who moved what and where it went. When a bottle goes missing from the front bar, the first question is whether it ever left the back. This log answers it.'] },
      { h: 'When You Run Multiple Locations', p: ['The Transfer Log earns its keep the moment your stock lives in more than one place. At The Anchor the well liquor is counted at the front bar and the service bar separately, with the backup cases in the stockroom. If a manager grabs three bottles of house tequila off the stockroom shelf and walks them to the service bar on a busy Friday, that move gets logged here so each location count still ties out.'] },
      { h: 'Logging A Transfer Run', p: ['Set the date, time, and who did the move up top, then add a line for each product you moved: pick the product, how much, the unit, and the From and To locations. When you pick a product, Bar Cop fills From with its home location and limits the From list to where that product is actually stocked, while To offers every other location, so you are choosing from real options instead of the whole list. If a product has no location set yet, every location shows in From until you place it on Set Locations. Each line can go a different direction, so a whole restock run enters on one form. Draft moves by the keg, bottle beer by the case, liquor and wine by the bottle. Add a witness when two people should sign off on a high-value move, and a note if the move is out of the ordinary. Save All writes every line in one shot, and Start Over clears the form.'] },
      { h: 'It Does Not Change Your Counts', p: ['A transfer only changes where product sits, not how much you have in the building. Your total on-hand, usage, and variance stay untouched. This log is purely about tracking movement between locations, so logging one never throws off your numbers.'] },
      { h: 'A Real Example', p: ['Say the front bar runs dry on Tito\'s in the middle of dinner service and your bartender pulls a fresh case from the stockroom. Add a line: product Tito\'s, quantity one case if you moved it by the case or the loose bottle count if you broke one out, from Stockroom, to Front Bar. Now when you count the front bar at close and the stockroom on Sunday, both reconcile and nobody is left wondering where the vodka went.'] },
      { h: 'Filtering And History', p: ['Every transfer you log drops into the list below. Use the range chips to pull up this month, the last few weeks, twelve weeks, or all of it. Edit or delete any entry if you need to fix a mistake.'] },
      { h: 'Worksheet', p: ['The Worksheet button gives you a clean PDF grid to print and carry on the floor during a shift. Jot down moves as they happen, then enter them here after close. That beats trying to remember at the end of the night.'] }
    ]);
  },

  // ── Batch entry builder (mirrors the Waste / Void-Comp logs) ───────────────
  // The builder body: a shared header (Date/Time, Performed By, Witnessed By)
  // over a line table, Add Line, and a shared Notes. useDraft rebuilds the saved
  // line rows on a re-render.
  builderInner(useDraft) {
    const active = this.activeShift();
    const defaultBy = active ? (active.manager_id || '') : '';
    const rowsHtml = (useDraft && this._draftRows && this._draftRows.length)
      ? this._draftRows.map(r => this.lineHtml(r)).join('')
      : this.lineHtml();
    return '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Date / Time</label>'
          + '<input type="datetime-local" id="trb-when" value="' + esc(this.nowDateTime().slice(0, 16)) + '"/></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Performed By</label>'
          + '<select id="trb-by">' + App.staffOptions(defaultBy, { placeholder: 'Select staff...' }) + '</select></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Witnessed By <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
          + '<select id="trb-witness">' + App.staffOptions('', { placeholder: 'Optional' }) + '</select></div>'
      + '</div>'
      + '<div class="pill-wrap" style="margin-bottom:12px;">'
      + '<table class="ing-tbl pill"><thead><tr>'
      + '<th style="min-width:180px;">Product</th><th style="width:90px;">Qty</th><th style="width:120px;">Unit</th>'
      + '<th style="min-width:150px;">From</th><th style="min-width:150px;">To</th><th style="width:90px;"></th>'
      + '</tr></thead><tbody id="trb-rows">' + rowsHtml + '</tbody></table></div>'
      + '<button class="btn btn-ghost btn-sm" id="trb-add" type="button" style="margin-bottom:14px;">+ Add Line</button>'
      + App.noteField({ id: 'trb-notes' });
  },

  builderCard() {
    const wsBtn = '<button class="btn btn-ghost btn-sm no-print" id="tr-print-blank" type="button">Worksheet</button>';
    return '<div class="card form-card no-print">'
      + App.collapsibleCardTitle('ic-transfers', 'Log a Transfer', wsBtn)
      + '<div class="collapse-body">'
      + this.builderInner(true)
      + '</div></div>'
      + '<div data-collapse-group="ic-transfers" class="no-print" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary" id="trb-save">Save All</button>'
        + '<button class="btn btn-ghost" id="trb-startover">Start Over</button>'
        + '<span id="trb-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';
  },

  // One transfer line = one table row. Product drives the Unit options and, when
  // From is still empty, the default From location.
  lineHtml(row) {
    row = row || {};
    const cat = row.product_id ? (this.productById(row.product_id)?.category || '') : '';
    const unitDefault = row.unit || (cat === 'Bottle Beer' ? 'cases' : cat === 'Draft Beer' ? 'kegs' : 'bottles');
    return '<tr class="tr-line">'
      + '<td><select class="form-input trl-prod" style="width:100%;">' + this.productOptions(row.product_id || '') + '</select></td>'
      + '<td><input class="form-input trl-qty" type="number" min="0" step="0.5" value="' + (row.quantity != null && row.quantity !== '' ? esc(String(row.quantity)) : '') + '" placeholder="0" style="width:100%;"/></td>'
      + '<td><select class="form-input trl-unit" style="width:100%;">' + this.unitOptions(cat, unitDefault) + '</select></td>'
      + '<td><select class="form-input trl-from" style="width:100%;">' + this.fromOptions(row.product_id ? this.productById(row.product_id) : null, row.from_location || '') + '</select></td>'
      + '<td><select class="form-input trl-to" style="width:100%;">' + this.toOptions(row.from_location || '', row.to_location || '') + '</select></td>'
      + '<td><button class="btn btn-danger btn-sm trl-del" type="button">Delete</button></td>'
      + '</tr>';
  },

  addLine() {
    const wrap = document.getElementById('trb-rows');
    if (wrap) wrap.insertAdjacentHTML('beforeend', this.lineHtml());
  },
  removeLine(line) {
    const wrap = document.getElementById('trb-rows');
    if (!wrap || !line) return;
    if (wrap.querySelectorAll('.tr-line').length <= 1) wrap.innerHTML = this.lineHtml();
    else line.remove();
  },

  // Product picked on a line: repopulate Unit, scope From to where the product is
  // stocked and default it to the product's home (re-defaulting even if a stale
  // location was filled for the previous product), and rebuild To to exclude that
  // From. From change alone also rebuilds To.
  onLineChange(ev) {
    const line = ev.target.closest('.tr-line');
    if (!line) return;
    if (ev.target.classList.contains('trl-prod')) {
      const p = this.productById(ev.target.value);
      const unitSel = line.querySelector('.trl-unit');
      if (unitSel) unitSel.innerHTML = this.unitOptions(p ? p.category : '', p && p.category === 'Bottle Beer' ? 'cases' : (p && p.category === 'Draft Beer' ? 'kegs' : 'bottles'));
      const newFrom = this.defaultFromFor(p);
      const fromSel = line.querySelector('.trl-from');
      if (fromSel) fromSel.innerHTML = this.fromOptions(p, newFrom);
      const toSel = line.querySelector('.trl-to');
      if (toSel) toSel.innerHTML = this.toOptions(newFrom, (toSel.value && toSel.value !== newFrom) ? toSel.value : '');
      this._captureBatch();
      return;
    }
    if (ev.target.classList.contains('trl-from')) {
      const fromVal = ev.target.value;
      const toSel = line.querySelector('.trl-to');
      if (toSel) toSel.innerHTML = this.toOptions(fromVal, (toSel.value && toSel.value !== fromVal) ? toSel.value : '');
      this._captureBatch();
      return;
    }
  },

  // Snapshot the batch builder (header + every line) for leave/return persistence.
  _captureBatch() {
    const formRoot = this.container.querySelector('.form-card');
    if (!formRoot) return;
    this._draft = App.captureDraft(formRoot);
    this._draftRows = [...formRoot.querySelectorAll('.tr-line')].map(line => ({
      product_id:    line.querySelector('.trl-prod')?.value || '',
      quantity:      line.querySelector('.trl-qty')?.value || '',
      unit:          line.querySelector('.trl-unit')?.value || '',
      from_location: line.querySelector('.trl-from')?.value || '',
      to_location:   line.querySelector('.trl-to')?.value || ''
    }));
  },

  async saveBatch(after) {
    const err = document.getElementById('trb-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const dateTime = document.getElementById('trb-when')?.value;
    if (!dateTime) { fail('Date and time are required.'); return; }
    const byId = document.getElementById('trb-by')?.value || '';
    if (!byId) { fail('Pick who performed the transfer.'); return; }
    const byName = (this.staffById(byId) || {}).name || '';
    const witId = document.getElementById('trb-witness')?.value || '';
    const witName = witId ? ((this.staffById(witId) || {}).name || '') : '';
    const notes = document.getElementById('trb-notes')?.value.trim() || '';

    const recs = [];
    const rowsWrap = document.getElementById('trb-rows');
    for (const line of (rowsWrap ? [...rowsWrap.querySelectorAll('.tr-line')] : [])) {
      const productId = line.querySelector('.trl-prod')?.value || '';
      const qtyRaw    = line.querySelector('.trl-qty')?.value;
      const unit      = line.querySelector('.trl-unit')?.value || '';
      const fromLoc   = line.querySelector('.trl-from')?.value || '';
      const toLoc     = line.querySelector('.trl-to')?.value || '';
      // Skip a line the manager added but never filled.
      if (!productId && (qtyRaw === '' || qtyRaw == null) && !fromLoc && !toLoc) continue;
      if (!productId) { fail('Pick a product on every line, or remove the blank line.'); return; }
      const product = this.productById(productId);
      if (!product) { fail('A line has a product that no longer exists. Remove it.'); return; }
      const quantity = parseFloat(qtyRaw);
      if (isNaN(quantity) || quantity <= 0) { fail('Enter a quantity above zero on every line.'); return; }
      if (!fromLoc) { fail('Pick a From location on every line.'); return; }
      if (!toLoc)   { fail('Pick a To location on every line.'); return; }
      if (fromLoc === toLoc) { fail('From and To must be different on every line.'); return; }
      recs.push({
        id: App.uid(), date_time: dateTime,
        from_location: fromLoc, to_location: toLoc,
        product_id: product.id, product_name: product.name, category: product.category || '',
        quantity, unit,
        performed_by_id: byId, performed_by: byName,
        witnessed_by_id: witId, witnessed_by: witName,
        notes, created_at: new Date().toISOString()
      });
    }
    if (!recs.length) { fail('Fill in at least one line.'); return; }

    const btn = document.getElementById('trb-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    let ok = true;
    for (const r of recs) { ok = (await App.putRecord('ic', 'transfer', r)) && ok; }
    if (ok) { this._draft = null; this._draftRows = null; (typeof after === 'function' ? after : () => this.renderList())(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Save All'; } fail('Save failed. Try again.'); }
  },

  // Reset the batch builder to a fresh blank line.
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
      const chip = ev.target.closest('.tr-range-chip');
      if (chip) {
        const v = chip.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.renderList();
        return;
      }
      if (ev.target.closest('#tr-export')) { const r = this.effectiveRange(); App.exportListPDF({ title: 'Transfer Log', root: this.container, lists: [['ic', 'transfer']], reRender: () => this.renderList(), range: App.chipRangeLabel(this.RANGE_CHIPS, this.filterPreset, r.from, r.to) }); return; }
      if (ev.target.closest('#tr-print-blank')) { this.printBlank(); return; }
      if (ev.target.closest('#trb-add')) { this.addLine(); return; }
      if (ev.target.closest('#trb-save')) { this.saveBatch(); return; }
      if (ev.target.closest('#trb-startover')) { this.startOver(); return; }
      const rm = ev.target.closest('.trl-del');
      if (rm) { this.removeLine(rm.closest('.tr-line')); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const edit = ev.target.closest('.tr-edit');
      const del  = ev.target.closest('.tr-del');
      const row  = ev.target.closest('.tr-row');
      if (del)  { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (edit) { ev.stopPropagation(); this.openEdit(edit.dataset.id); return; }
      if (row && App.canEdit('ic-transfers')) this.openEdit(row.dataset.id);
    };
    // Per-line: product drives the Unit options + the From default.
    this.container.onchange = ev => this.onLineChange(ev);
    document.getElementById('tr-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('tr-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });

    // Hold the in-progress batch through leave/return: restore the header, then
    // capture header + line rows on every input/change.
    const formRoot = this.container.querySelector('.form-card');
    if (formRoot) {
      if (this._draft) App.restoreDraft(formRoot, this._draft);
      formRoot.addEventListener('input', () => this._captureBatch());
      formRoot.addEventListener('change', () => this._captureBatch());
    }
  },

  // ── Edit a single past transfer in a focused pop-up ─────────────────────────
  // Shared single-record field layout for the edit popup. `idp` ('tre-')
  // prefixes every field id.
  formRows(t, idp) {
    const v = val => (val != null && val !== '') ? val : '';
    const active = this.activeShift();
    const defaultManagerId = active ? (active.manager_id || '') : '';
    let initialProdId = t?.product_id || '';
    let initialFrom = t?.from_location || '';
    const initialTo = t?.to_location || '';
    const initialUnit = t?.unit || '';
    if (!t && initialProdId) {
      const p = this.productById(initialProdId);
      if (p && p.primary_location) initialFrom = p.primary_location;
    }
    const initialCat = initialProdId ? (this.productById(initialProdId)?.category || '') : '';

    return '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
        + '<div class="f" style="width:220px;flex-shrink:0;"><label>Date / Time</label>'
          + '<input type="datetime-local" id="' + idp + 'when" value="' + esc((t?.date_time || this.nowDateTime()).slice(0, 16)) + '"/></div>'
        + '<div class="f" style="flex:1;min-width:200px;"><label>Product</label>'
          + '<select id="' + idp + 'prod">' + this.productOptions(initialProdId) + '</select></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Quantity</label>'
          + '<input type="number" id="' + idp + 'qty" min="0" step="0.5" value="' + v(t?.quantity) + '" placeholder="0"/></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Unit</label>'
          + '<select id="' + idp + 'unit">' + this.unitOptions(initialCat, initialUnit || (initialCat === 'Bottle Beer' ? 'cases' : initialCat === 'Draft Beer' ? 'kegs' : 'bottles')) + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
        + '<div class="f" style="flex:1;min-width:160px;"><label>From Location</label>'
          + '<select id="' + idp + 'from">' + this.fromOptions(initialProdId ? this.productById(initialProdId) : null, initialFrom) + '</select></div>'
        + '<div class="f" style="flex:1;min-width:160px;"><label>To Location</label>'
          + '<select id="' + idp + 'to">' + this.toOptions(initialFrom, initialTo) + '</select></div>'
        + '<div class="f" style="flex:1;min-width:160px;"><label>Performed By</label>'
          + '<select id="' + idp + 'by">' + App.staffOptions(t?.performed_by_id || defaultManagerId, { placeholder: 'Select staff...' }) + '</select></div>'
        + '<div class="f" style="flex:1;min-width:160px;"><label>Witnessed By <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
          + '<select id="' + idp + 'witness">' + App.staffOptions(t?.witnessed_by_id || '', { placeholder: 'Optional' }) + '</select></div>'
      + '</div>'
      + App.noteField({ id: idp + 'notes', value: t?.notes, mt: 6 });
  },

  // Product change in the edit popup: re-pop unit, scope + re-default From, and
  // rebuild To to exclude the From. From change alone also rebuilds To.
  wireProdChange(idp) {
    document.getElementById(idp + 'prod')?.addEventListener('change', e => {
      const p = this.productById(e.target.value);
      const unitSel = document.getElementById(idp + 'unit');
      if (unitSel) unitSel.innerHTML = this.unitOptions(p ? p.category : '', p && p.category === 'Bottle Beer' ? 'cases' : (p && p.category === 'Draft Beer' ? 'kegs' : 'units'));
      const newFrom = this.defaultFromFor(p);
      const fromSel = document.getElementById(idp + 'from');
      if (fromSel) fromSel.innerHTML = this.fromOptions(p, newFrom);
      const toSel = document.getElementById(idp + 'to');
      if (toSel) toSel.innerHTML = this.toOptions(newFrom, (toSel.value && toSel.value !== newFrom) ? toSel.value : '');
    });
    document.getElementById(idp + 'from')?.addEventListener('change', e => {
      const toSel = document.getElementById(idp + 'to');
      if (toSel) toSel.innerHTML = this.toOptions(e.target.value, (toSel.value && toSel.value !== e.target.value) ? toSel.value : '');
    });
  },

  openEdit(id) {
    if (!App.canEdit('ic-transfers')) return;
    const t = this.transfers().find(x => x.id === id);
    if (!t) return;
    this.editId = id;
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Transfer</div>'
      + this.formRows(t, 'tre-')
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="tre-save">Update Transfer</button>'
        + '<span id="tre-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
        + '<button class="btn btn-danger" id="tre-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'tr-edit-modal', maxWidth: 540, noClose: true });
    document.getElementById('tre-save')?.addEventListener('click', () => this.saveEdit('tre-', 'tr-edit-modal'));
    document.getElementById('tre-del')?.addEventListener('click', async () => {
      if (!(await App.confirmDelete())) return;
      await App.removeRecord('ic', 'transfer', id);
      this.editId = null;
      App.closeModal('tr-edit-modal');
      this.renderList();
    });
    this.wireProdChange('tre-');
  },

  async saveEdit(idp, modalId) {
    const err = document.getElementById(idp + 'err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };

    const dateTime = document.getElementById(idp + 'when')?.value;
    if (!dateTime) { fail('Date and time are required.'); return; }
    const productId = document.getElementById(idp + 'prod')?.value;
    if (!productId) { fail('Pick a product.'); return; }
    const product = this.productById(productId);
    if (!product) { fail('Product not found.'); return; }
    const quantity = parseFloat(document.getElementById(idp + 'qty')?.value);
    if (isNaN(quantity) || quantity <= 0) { fail('Enter a quantity greater than zero.'); return; }
    const from = document.getElementById(idp + 'from')?.value;
    const to   = document.getElementById(idp + 'to')?.value;
    if (!from)       { fail('Pick a From location.'); return; }
    if (!to)         { fail('Pick a To location.'); return; }
    if (from === to) { fail('From and To must be different locations.'); return; }
    const performedById = document.getElementById(idp + 'by')?.value;
    if (!performedById) { fail('Pick who performed the transfer.'); return; }
    const performedBy = (this.staffById(performedById) || {}).name || '';
    const witnessedById = document.getElementById(idp + 'witness')?.value || '';
    const witnessedBy   = witnessedById ? ((this.staffById(witnessedById) || {}).name || '') : '';

    const rec = {
      id:               this.editId,
      date_time:        dateTime,
      from_location:    from,
      to_location:      to,
      product_id:       product.id,
      product_name:     product.name,
      category:         product.category || '',
      quantity,
      unit:             document.getElementById(idp + 'unit')?.value || '',
      performed_by_id:  performedById,
      performed_by:     performedBy,
      witnessed_by_id:  witnessedById,
      witnessed_by:     witnessedBy,
      notes:            document.getElementById(idp + 'notes')?.value.trim() || '',
      updated_at:       new Date().toISOString()
    };
    const ex = this.transfers().find(x => x.id === this.editId);
    const saveRec = ex ? { ...ex, ...rec } : rec;

    const btn = document.getElementById(idp + 'save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('ic', 'transfer', saveRec);
    this.editId = null;
    if (ok) { if (modalId) App.closeModal(modalId); this.renderList(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Update Transfer'; } fail('Save failed. Try again.'); }
  },

  // ── Form options ────────────────────────────────────────────────────
  // Locations a product is actually stocked in (drives the From dropdown). Falls
  // back to all locations when the product has none placed yet, so the form is
  // never stuck (the product still shows "Needs a location" on Set Locations).
  fromLocationsFor(p) {
    if (!p) return this.locations();
    const names = (App.productLocations ? App.productLocations(p) : []) || [];
    const stocked = this.locations().filter(l => names.includes(l.name));
    return stocked.length ? stocked : this.locations();
  },
  // Best-guess source: the product's home (primary) location if it is stocked
  // there, else the first place it is stocked. A product can live in several
  // places, so this is only a default the operator can change.
  defaultFromFor(p) {
    if (!p) return '';
    const names = (App.productLocations ? App.productLocations(p) : []) || [];
    if (p.primary_location && names.includes(p.primary_location)) return p.primary_location;
    return names.length ? names[0] : '';
  },
  // From options scoped to where the product is stocked (keeps a saved value that
  // is no longer in scope so an edit never silently drops it).
  fromOptions(p, selected) {
    const locs = this.fromLocationsFor(p);
    const names = locs.map(l => l.name);
    let h = '<option value="">Select location...</option>';
    if (selected && !names.includes(selected)) h += '<option value="' + esc(selected) + '" selected>' + esc(selected) + '</option>';
    h += locs.map(l => '<option value="' + esc(l.name) + '"' + (l.name === selected ? ' selected' : '') + '>' + esc(l.name) + '</option>').join('');
    return h;
  },
  // To options = every location except the one chosen in From (you can move
  // product anywhere, even a spot that does not stock it yet, but never to the
  // same place you took it from).
  toOptions(fromName, selected) {
    const locs = this.locations().filter(l => l.name !== fromName);
    const names = locs.map(l => l.name);
    let h = '<option value="">Select location...</option>';
    if (selected && selected !== fromName && !names.includes(selected)) h += '<option value="' + esc(selected) + '" selected>' + esc(selected) + '</option>';
    h += locs.map(l => '<option value="' + esc(l.name) + '"' + (l.name === selected ? ' selected' : '') + '>' + esc(l.name) + '</option>').join('');
    return h;
  },

  productOptions(selectedId) {
    const prods = this.products();
    // S193: a selected product the filter would drop (inactive) stays visible + labelled — never blank the row.
    const _cur = selectedId ? ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p && p.id === selectedId) : null;
    const _curDropped = !!_cur && !prods.some(p => p && p.id === selectedId);
    if (!prods.length && !_curDropped) return '<option value="">No products set up</option>';
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
    return h + (_curDropped ? '<optgroup label="Current selection"><option value="' + _cur.id + '" selected>' + esc(_cur.name || '') + (_cur.active === false ? ' (inactive)' : '') + '</option></optgroup>' : '');
  },

  locationOptions(selected) {
    return '<option value="">Select location...</option>'
      + this.locations().map(l => '<option value="' + esc(l.name) + '"' + (l.name === selected ? ' selected' : '') + '>' + esc(l.name) + '</option>').join('');
  },

  unitOptions(productCategory, selected) {
    let opts = ['bottles', 'units'];
    if (productCategory === 'Bottle Beer') opts = ['cases', 'bottles'];
    else if (productCategory === 'Draft Beer') opts = ['kegs'];
    else if (productCategory === 'Food' || productCategory === 'Misc') opts = ['units', 'each', 'lbs', 'oz'];
    return opts.map(o => '<option' + (o === selected ? ' selected' : '') + '>' + esc(o) + '</option>').join('');
  },

  async confirmDel(id) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    await App.removeRecord('ic', 'transfer', id);
    this.renderList();
  },

  // ── Print blank sheet — for shift use ─────────────────────────────────
  printBlank() {
    App.printBlankSheet({
      title: 'Transfer Log',
      subtitle: 'Log every product moved between locations during the shift. Manager enters each row into Bar Cop after close.',
      columns: [
        { label: 'Time',          width: '10%' },
        { label: 'Product',       width: '24%' },
        { label: 'Qty',           width: '8%' },
        { label: 'Unit',          width: '8%' },
        { label: 'From',          width: '15%' },
        { label: 'To',            width: '15%' },
        { label: 'By',            width: '12%' },
        { label: 'Witnessed',     width: '8%' }
      ],
      rows: 20
    });
  }
};
