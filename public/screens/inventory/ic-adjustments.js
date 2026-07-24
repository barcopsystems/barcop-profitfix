'use strict';

/* ── Inventory Control — Adjustment Log (writes ic_adjustments) ───────────────
   Captures every documented inventory adjustment — damaged in storage, theft
   confirmed, expired, found later, or other one-off corrections — so the
   operator can reconcile counts to physical reality without destroying the
   count history.

   Reason codes drive intent:
     - Damage     (decrease)
     - Theft      (decrease, also feeds Theft Risk)
     - Expiration (decrease)
     - Found      (increase — discovered stock not previously counted)
     - Other      (operator picks direction)

   Entry is a BATCH builder (a shared header over a stack of line rows, Add Line,
   one Save All) matching the Waste / Void-Comp logs. Each line saves as its own
   record. Edit a past one in a focused pop-up. Variance math does NOT
   auto-subtract these — the report surfaces them separately so the operator sees
   the attribution. */

S.InventoryAdjustments = {
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

  REASONS: ['Damage', 'Theft', 'Expiration', 'Found', 'Other'],
  // Default direction per reason — operator can override on Other.
  _dirFor(reason) {
    if (reason === 'Found') return 'in';
    return 'out';
  },

  adjustments() {
    if (!App.inventoryData) App.inventoryData = {};
    if (!Array.isArray(App.inventoryData.ic_adjustments)) App.inventoryData.ic_adjustments = [];
    return App.inventoryData.ic_adjustments;
  },
  products() {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
  },
  productById(id) {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
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

  // Per-unit cost for the chosen unit (case-tracked beer reads per-case in
  // 'cases', per-bottle otherwise). Drives the per-line Value + the snapshot.
  perUnitCostFor(p, unit) {
    if (!p) return 0;
    if (unit === 'oz') { const c = App.costPerOz(p); return c != null ? c : 0; }
    if (p.category === 'Bottle Beer' && p.case_size) return (unit === 'cases') ? (App.unitCost(p) || 0) : (App.bottleCost(p) || 0);
    // 'each' is ONE PIECE out of a pack-bought container (a wing from a 45-count bag),
    // never the container itself. Costing it at unit_cost booked a 12-wing drop as
    // $270 instead of $6 and carried that 45x into the Adjustment Log's Total Loss,
    // the Shrinkage tile and the Briefing. piecePrice returns the unit cost by itself
    // when there is no pack size (the unit already IS the piece, like each or lb).
    if (unit === 'each') {
      const pc = App.piecePrice ? App.piecePrice(p) : null;
      return pc != null ? pc : (App.unitCost(p) || 0);
    }
    return App.unitCost(p) || 0;
  },
  costFor(p, qty, unit) { return (qty > 0 ? qty : 0) * this.perUnitCostFor(p, unit); },

  // Effective window from the active range chip; Custom reads From/To; All clears.
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'adj-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
        + '<button class="btn btn-ghost btn-sm" id="adj-export">Export PDF</button>'
      + '</div></div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="adj-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="adj-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    this.renderList();
  },

  // ── List ────────────────────────────────────────────────────────────
  renderList() {
    this.editId = null;
    this.actions.innerHTML = '';

    if (this.products().length === 0) {
      App.setupCard(this.container, {
        title: 'Set Up Adjustments',
        lead: 'An adjustment writes off or finds a documented quantity of a real product, so your counts stay clean and every loss has a cause. Add your products first.',
        steps: [
          { title: 'Add your products', desc: 'An adjustment is logged against a real product, so add what you stock first.', btn: 'Add Products', screen: 'ic-product-setup', done: this.products().length > 0 }
        ]
      });
      return;
    }

    const all = this.adjustments();
    const formCard = this.builderCard();

    let below;
    if (all.length === 0) {
      below = '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
        + '<th>When</th><th>Product</th><th>Quantity</th><th>Reason</th><th>Value</th><th>By</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="7" style="color:var(--t3);">No adjustments logged yet. Use the form above to log the first one.</td></tr></tbody></table></div>';
    } else {
      const { from, to } = this.effectiveRange();
      const filtered = all.filter(r => {
        const date = (r.date_time || '').slice(0, 10);
        return (!from || date >= from) && (!to || date <= to);
      }).sort((a, b) => new Date(b.date_time || b.created_at || 0).getTime() - new Date(a.date_time || a.created_at || 0).getTime());

      let totalLoss = 0, totalFound = 0, lastDate = '';
      all.forEach(r => {
        const val = Math.abs(r.value || 0);
        if (r.direction === 'in') totalFound += val; else totalLoss += val;
        const d = r.date_time || r.created_at || '';
        if (!lastDate || new Date(d).getTime() > new Date(lastDate).getTime()) lastDate = d;
      });

      const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Adjustments</div><div class="calc-val lg">' + all.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Loss</div><div class="calc-val lg" style="color:var(--red);">' + App.fmtCurrency(totalLoss) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Found</div><div class="calc-val lg" style="color:var(--green);">' + App.fmtCurrency(totalFound) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Last Entry</div><div class="calc-val lg">' + this.fmtDate((lastDate || '').slice(0, 10)) + '</div></div>'
        + '</div></div>';

      let listHtml;
      if (filtered.length === 0) {
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>When</th><th>Product</th><th>Quantity</th><th>Reason</th><th>Value</th><th>By</th><th></th>'
          + '</tr></thead><tbody><tr><td colspan="7" style="color:var(--t3);">No adjustments in this range. Pick a wider range above.</td></tr></tbody></table></div>';
      } else {
        const rows = filtered.slice(0, App.listLimit('ic', 'adjustment')).map(r => {
          // Direction reads off the signed, colored Value (red loss / green
          // found), so the Reason column carries the reason alone.
          const valStr = r.direction === 'in'
            ? '<span style="color:var(--green);">+' + App.fmtCurrency(Math.abs(r.value || 0)) + '</span>'
            : '<span style="color:var(--red);">-' + App.fmtCurrency(Math.abs(r.value || 0)) + '</span>';
          return '<tr class="adj-row" data-id="' + r.id + '" style="cursor:pointer;">'
            + '<td><div class="val">' + this.fmtDateTime(r.date_time) + '</div></td>'
            + '<td><div class="val">' + esc(r.product_name || '-') + '</div>'
            + (r.category ? '<div style="font-size:10px;color:var(--t3);">' + esc(r.category) + '</div>' : '') + '</td>'
            + '<td>' + (r.quantity != null ? r.quantity : '-') + ' ' + esc(r.unit || '') + '</td>'
            + '<td>' + esc(r.reason || '-') + '</td>'
            + '<td class="val">' + valStr + '</td>'
            + '<td>' + esc(r.performed_by || '-') + '</td>'
            + '<td><div class="row-actions">'
            + (App.canEdit('ic-adjustments') ? '<button class="btn btn-ghost btn-sm adj-edit" data-id="' + r.id + '">Edit</button>' : '')
            + (App.canEdit('ic-adjustments') ? '<button class="btn btn-danger btn-sm adj-del" data-id="' + r.id + '">Delete</button>' : '')
            + '</div></td></tr>';
        }).join('');
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>When</th><th>Product</th><th>Quantity</th><th>Reason</th><th>Value</th><th>By</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          + App.showOlderBar('ic', 'adjustment', filtered, this.filterPreset !== 'all');
      }
      below = statsCard + this.filterRow() + listHtml;
    }

    this.container.innerHTML = '<div class="screen">' + formCard + below + '</div>';
    App.applyCollapsed(this.container);
    this.wireList();
  },

  showHowTo() {
    App.showHelpModal('How the Adjustment Log Works', [
      { p: ['An adjustment documents stock that left or came back into inventory outside of a normal sale, like product damaged in storage, theft you confirmed, product that expired, or stock you found that was never counted. It keeps your counts clean while attributing the loss to a real cause. Without it, every broken bottle and dumped keg shows up as mystery shrinkage and looks like theft.'] },
      { h: 'Logging Adjustments', p: ['Set the date, time, and who did it up top, then add a line for each adjustment off your sheet: pick the reason, confirm the direction (Loss for product that left, Found for stock that came back), then the product, quantity, and unit. Bar Cop shows the dollar value per line as you go, so you see what each loss actually cost you. Add a witness when a high-value write-off should have a second set of eyes on it. Add Line for another, and Save All writes them in one shot. Start Over clears the form.'] },
      { h: 'Reasons And Direction', p: ['Damage, Theft, and Expiration default to a Loss. Found defaults to an increase. Other lets you set the direction yourself. Use the right reason, because a write-off labeled Theft feeds your Loss Prevention picture while one labeled Damage does not. Honest reasons keep that signal clean.'] },
      { h: 'A Real Example', p: ['A barback at The Anchor drops a full bottle of Hennessy on the way to the well and it shatters. Add a line: reason Damage, direction Loss, product Hennessy, quantity one bottle. Bar Cop prices it off your cost, say a 750ml bottle that runs you about thirty dollars, and books a thirty dollar documented loss. Now when you run variance for the period, that thirty dollars is accounted for and does not get mistaken for product walking out the door.'] },
      { h: 'It Does Not Touch Your Counts', p: ['Logging an adjustment does not change your last count or auto-subtract from variance. The Variance Report surfaces adjustments separately so you can see real shrinkage versus a documented cause. Your bookkeeper gets a clean shrinkage trail they can stand behind at tax time.'] },
      { h: 'Filtering And History', p: ['Every adjustment drops into the list below. Use the range chips to pull up this month, the last few weeks, twelve weeks, or all of it, and edit or delete any entry to fix a mistake. The Worksheet button prints a clean grid you can carry into the storeroom during a damage or expiration walk-through, then enter the rows here after.'] }
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
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Date / Time</label>'
          + '<input type="datetime-local" id="ajb-when" value="' + esc(this.nowDateTime().slice(0, 16)) + '"/></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Performed By</label>'
          + '<select id="ajb-by">' + App.staffOptions(defaultBy, { placeholder: 'Select staff...' }) + '</select></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Witnessed By <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
          + '<select id="ajb-witness">' + App.staffOptions('', { placeholder: 'Optional' }) + '</select></div>'
      + '</div>'
      + '<div class="pill-wrap" style="margin-bottom:12px;">'
      + '<table class="ing-tbl pill"><thead><tr>'
      + '<th style="min-width:170px;">Product</th><th style="width:80px;">Qty</th><th style="width:100px;">Unit</th>'
      + '<th style="min-width:130px;">Reason</th><th style="width:110px;">Direction</th><th style="width:90px;">Value</th><th style="width:80px;"></th>'
      + '</tr></thead><tbody id="ajb-rows">' + rowsHtml + '</tbody></table></div>'
      + '<button class="btn btn-ghost btn-sm" id="ajb-add" type="button" style="margin-bottom:14px;">+ Add Line</button>'
      + App.noteField({ id: 'ajb-notes' });
  },

  builderCard() {
    const wsBtn = '<button class="btn btn-ghost btn-sm no-print" id="adj-print-blank" type="button">Worksheet</button>';
    return '<div class="card form-card no-print">'
      + App.collapsibleCardTitle('ic-adjustments', 'Log an Adjustment', wsBtn)
      + '<div class="collapse-body">'
      + this.builderInner(true)
      + '</div></div>'
      + '<div data-collapse-group="ic-adjustments" class="no-print" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary" id="ajb-save">Save All</button>'
        + '<button class="btn btn-ghost" id="ajb-startover">Start Over</button>'
        + '<span id="ajb-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';
  },

  reasonOptions(selected) {
    return this.REASONS.map(r => '<option' + (r === selected ? ' selected' : '') + '>' + esc(r) + '</option>').join('');
  },

  // One adjustment line = one table row. Reason drives the default Direction;
  // Product drives the Unit options; Product + Qty + Unit drive the Value cell.
  lineHtml(row) {
    row = row || {};
    const cat = row.product_id ? (this.productById(row.product_id)?.category || '') : '';
    const reason = row.reason || 'Damage';
    const dir = row.direction || this._dirFor(reason);
    const unitDefault = row.unit || (cat === 'Bottle Beer' ? 'cases' : cat === 'Draft Beer' ? 'kegs' : 'bottles');
    return '<tr class="adj-line">'
      + '<td><select class="form-input ajl-prod" style="width:100%;">' + this.productOptions(row.product_id || '') + '</select></td>'
      + '<td><input class="form-input ajl-qty" type="number" min="0" step="0.5" value="' + (row.quantity != null && row.quantity !== '' ? esc(String(row.quantity)) : '') + '" placeholder="0" style="width:100%;"/></td>'
      + '<td><select class="form-input ajl-unit" style="width:100%;">' + this.unitOptions(cat, unitDefault, !!((this.productById(row.product_id) || {}).container_size_oz)) + '</select></td>'
      + '<td><select class="form-input ajl-reason" style="width:100%;">' + this.reasonOptions(reason) + '</select></td>'
      + '<td><select class="form-input ajl-dir" style="width:100%;"><option value="out"' + (dir === 'out' ? ' selected' : '') + '>Loss</option><option value="in"' + (dir === 'in' ? ' selected' : '') + '>Found</option></select></td>'
      + '<td class="ajl-val val" style="font-size:12px;">-</td>'
      + '<td><button class="btn btn-danger btn-sm ajl-del" type="button">Delete</button></td>'
      + '</tr>';
  },

  addLine() {
    const wrap = document.getElementById('ajb-rows');
    if (wrap) wrap.insertAdjacentHTML('beforeend', this.lineHtml());
  },
  removeLine(line) {
    const wrap = document.getElementById('ajb-rows');
    if (!wrap || !line) return;
    if (wrap.querySelectorAll('.adj-line').length <= 1) wrap.innerHTML = this.lineHtml();
    else line.remove();
  },

  // Refresh a line's Value cell from its current product + qty + unit.
  refreshLineCalc(line) {
    if (!line) return;
    const p = this.productById(line.querySelector('.ajl-prod')?.value || '');
    const qty = parseFloat(line.querySelector('.ajl-qty')?.value);
    const unit = line.querySelector('.ajl-unit')?.value || '';
    const cell = line.querySelector('.ajl-val');
    if (!cell) return;
    const val = (p && qty > 0) ? this.costFor(p, qty, unit) : 0;
    cell.textContent = val > 0 ? App.fmtCurrency(val) : '-';
  },

  // Per-line: Reason sets the default Direction; Product re-pops the Unit
  // options; any of Product / Qty / Unit refreshes the Value.
  onLineChange(ev) {
    const line = ev.target.closest('.adj-line');
    if (!line) return;
    if (ev.target.classList.contains('ajl-reason')) {
      const dirSel = line.querySelector('.ajl-dir');
      if (dirSel) dirSel.value = this._dirFor(ev.target.value);
    }
    if (ev.target.classList.contains('ajl-prod')) {
      const p = this.productById(ev.target.value);
      const unitSel = line.querySelector('.ajl-unit');
      if (unitSel) unitSel.innerHTML = this.unitOptions(p ? p.category : '', p && p.category === 'Bottle Beer' ? 'cases' : (p && p.category === 'Draft Beer' ? 'kegs' : 'bottles'), !!(p && p.container_size_oz));
    }
    this.refreshLineCalc(line);
  },

  async saveBatch(after) {
    const err = document.getElementById('ajb-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const dateTime = document.getElementById('ajb-when')?.value;
    if (!dateTime) { fail('Date and time are required.'); return; }
    const byId = document.getElementById('ajb-by')?.value || '';
    if (!byId) { fail('Pick who logged the adjustment.'); return; }
    const byName = (this.staffById(byId) || {}).name || '';
    const witId = document.getElementById('ajb-witness')?.value || '';
    const witName = witId ? ((this.staffById(witId) || {}).name || '') : '';
    const notes = document.getElementById('ajb-notes')?.value.trim() || '';

    const recs = [];
    const rowsWrap = document.getElementById('ajb-rows');
    for (const line of (rowsWrap ? [...rowsWrap.querySelectorAll('.adj-line')] : [])) {
      const productId = line.querySelector('.ajl-prod')?.value || '';
      const qtyRaw    = line.querySelector('.ajl-qty')?.value;
      // Skip a line the manager added but never filled (reason/dir always have a
      // default, so a blank line is one with no product and no quantity).
      if (!productId && (qtyRaw === '' || qtyRaw == null)) continue;
      if (!productId) { fail('Pick a product on every line, or remove the blank line.'); return; }
      const product = this.productById(productId);
      if (!product) { fail('A line has a product that no longer exists. Remove it.'); return; }
      const quantity = parseFloat(qtyRaw);
      if (isNaN(quantity) || quantity <= 0) { fail('Enter a quantity above zero on every line.'); return; }
      const reason = line.querySelector('.ajl-reason')?.value || '';
      if (!reason) { fail('Pick a reason on every line.'); return; }
      const direction = line.querySelector('.ajl-dir')?.value || this._dirFor(reason);
      const unit = line.querySelector('.ajl-unit')?.value || '';
      const perUnitCost = this.perUnitCostFor(product, unit);
      recs.push({
        id: App.uid(), date_time: dateTime,
        product_id: product.id, product_name: product.name, category: product.category || '',
        quantity, unit, direction, reason,
        unit_cost_at_adjustment: perUnitCost, value: quantity * perUnitCost,
        performed_by_id: byId, performed_by: byName,
        witnessed_by_id: witId, witnessed_by: witName,
        notes, created_at: new Date().toISOString()
      });
    }
    if (!recs.length) { fail('Fill in at least one line.'); return; }

    const btn = document.getElementById('ajb-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    let ok = true;
    for (const r of recs) { ok = (await App.putRecord('ic', 'adjustment', r)) && ok; }
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
      const chip = ev.target.closest('.adj-range-chip');
      if (chip) {
        const v = chip.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.renderList();
        return;
      }
      if (ev.target.closest('#adj-export')) { App.exportPDF({ title: 'Adjustment Log', root: this.container }); return; }
      if (ev.target.closest('#adj-print-blank')) { this.printBlank(); return; }
      if (ev.target.closest('#ajb-add')) { this.addLine(); return; }
      if (ev.target.closest('#ajb-save')) { this.saveBatch(); return; }
      if (ev.target.closest('#ajb-startover')) { this.startOver(); return; }
      const rm = ev.target.closest('.ajl-del');
      if (rm) { this.removeLine(rm.closest('.adj-line')); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const edit = ev.target.closest('.adj-edit');
      const del  = ev.target.closest('.adj-del');
      const row  = ev.target.closest('.adj-row');
      if (del)  { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (edit) { ev.stopPropagation(); this.openEdit(edit.dataset.id); return; }
      if (row && App.canEdit('ic-adjustments')) this.openEdit(row.dataset.id);
    };
    // Per-line conditional handler (reason → direction, product → unit, recalc).
    this.container.onchange = ev => this.onLineChange(ev);
    document.getElementById('adj-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('adj-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });

    // Hold the in-progress batch through leave/return.
    const formRoot = this.container.querySelector('.form-card');
    if (formRoot) {
      if (this._draft) App.restoreDraft(formRoot, this._draft);
      formRoot.querySelectorAll('.adj-line').forEach(line => this.refreshLineCalc(line));
      const cap = () => {
        this._draft = App.captureDraft(formRoot);
        this._draftRows = [...formRoot.querySelectorAll('.adj-line')].map(line => ({
          product_id: line.querySelector('.ajl-prod')?.value || '',
          quantity:   line.querySelector('.ajl-qty')?.value || '',
          unit:       line.querySelector('.ajl-unit')?.value || '',
          reason:     line.querySelector('.ajl-reason')?.value || '',
          direction:  line.querySelector('.ajl-dir')?.value || ''
        }));
      };
      formRoot.addEventListener('input', cap);
      formRoot.addEventListener('change', cap);
    }
  },

  // ── Edit a single past adjustment in a focused pop-up ───────────────────────
  // Single-record field layout (with the live Estimated Value calc). `idp`
  // ('adje-') prefixes every field id.
  formRows(r, idp) {
    const v = val => (val != null && val !== '') ? val : '';
    const initialProdId = r?.product_id || '';
    const initialCat = initialProdId ? (this.productById(initialProdId)?.category || '') : '';
    const initialUnit = r?.unit || (initialCat === 'Bottle Beer' ? 'cases' : initialCat === 'Draft Beer' ? 'kegs' : 'bottles');
    const initialReason = r?.reason || 'Damage';
    const initialDir = r?.direction || this._dirFor(initialReason);

    return '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:210px;flex-shrink:0;"><label>Date / Time</label>'
          + '<input type="datetime-local" id="' + idp + 'when" value="' + esc((r?.date_time || this.nowDateTime()).slice(0, 16)) + '"/></div>'
        + '<div class="f" style="flex:1;min-width:180px;"><label>Product</label>'
          + '<select id="' + idp + 'prod">' + this.productOptions(initialProdId) + '</select></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Quantity</label>'
          + '<input type="number" id="' + idp + 'qty" min="0" step="0.5" value="' + v(r?.quantity) + '" placeholder="0"/></div>'
        + '<div class="f" style="width:110px;flex-shrink:0;"><label>Unit</label>'
          + '<select id="' + idp + 'unit">' + this.unitOptions(initialCat, initialUnit, !!((this.productById(initialProdId) || {}).container_size_oz)) + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Reason</label>'
          + '<select id="' + idp + 'reason">' + this.reasonOptions(initialReason) + '</select></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>Direction</label>'
          + '<select id="' + idp + 'dir">'
            + '<option value="out"' + (initialDir === 'out' ? ' selected' : '') + '>Loss (out)</option>'
            + '<option value="in"'  + (initialDir === 'in'  ? ' selected' : '') + '>Found (in)</option>'
          + '</select></div>'
        + '<div class="f" style="flex:1;min-width:170px;"><label>Performed By</label>'
          + '<select id="' + idp + 'by">' + App.staffOptions(r?.performed_by_id || App.activeManagerId(), { placeholder: 'Select staff...' }) + '</select></div>'
        + '<div class="f" style="flex:1;min-width:170px;"><label>Witnessed By <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
          + '<select id="' + idp + 'witness">' + App.staffOptions(r?.witnessed_by_id || '', { placeholder: 'Optional' }) + '</select></div>'
      + '</div>'
      + '<div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;margin-top:10px;background:var(--input);border:1px solid var(--b-edge);border-radius:var(--r2);padding:14px 18px;">'
        + '<div class="calc-item"><div class="calc-label">Estimated Value</div><div class="calc-val" id="' + idp + 'c-value">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Unit Cost</div><div class="calc-val dim" id="' + idp + 'c-unitcost">-</div></div>'
      + '</div>'
      + App.noteField({ id: idp + 'notes', value: r?.notes, mt: 10 });
  },

  // Reason → default direction, product → unit options, and live value recalc,
  // for the edit pop-up.
  wireFormFields(idp) {
    document.getElementById(idp + 'reason')?.addEventListener('change', e => {
      const dirSel = document.getElementById(idp + 'dir');
      if (dirSel) dirSel.value = this._dirFor(e.target.value);
      this.recalc(idp);
    });
    document.getElementById(idp + 'prod')?.addEventListener('change', e => {
      const p = this.productById(e.target.value);
      const unitSel = document.getElementById(idp + 'unit');
      if (unitSel && p) unitSel.innerHTML = this.unitOptions(p.category, p.category === 'Bottle Beer' ? 'cases' : (p.category === 'Draft Beer' ? 'kegs' : 'bottles'), !!(p && p.container_size_oz));
      this.recalc(idp);
    });
    [idp + 'qty', idp + 'unit', idp + 'dir'].forEach(fid =>
      document.getElementById(fid)?.addEventListener('input', () => this.recalc(idp)));
    this.recalc(idp);
  },

  // Live calc for the edit pop-up: estimated value = qty × per-unit cost.
  recalc(idp) {
    const product = this.productById(document.getElementById(idp + 'prod')?.value);
    const qty = parseFloat(document.getElementById(idp + 'qty')?.value) || 0;
    const unit = document.getElementById(idp + 'unit')?.value || '';
    const set = (id, txt, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = txt; el.className = 'calc-val' + (cls ? ' ' + cls : ''); };

    if (!product || qty <= 0) {
      set(idp + 'c-value', '-');
      set(idp + 'c-unitcost', product ? (product.unit_cost != null ? App.fmtCurrency(product.unit_cost) : '-') : '-', 'dim');
      return;
    }
    const perUnitCost = this.perUnitCostFor(product, unit);
    const unitLabel = unit === 'oz' ? '/oz' : (unit === 'cases' ? '/case' : unit === 'bottles' ? '/bottle' : '/unit');
    const value = qty * perUnitCost;
    set(idp + 'c-value', value > 0 ? App.fmtCurrency(value) : '-');
    set(idp + 'c-unitcost', perUnitCost > 0 ? App.fmtCurrency(perUnitCost) + unitLabel : '-', 'dim');
  },

  openEdit(id) {
    if (!App.canEdit('ic-adjustments')) return;
    const r = this.adjustments().find(x => x.id === id);
    if (!r) return;
    this.editId = id;
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Adjustment</div>'
      + this.formRows(r, 'adje-')
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="adje-save">Update Adjustment</button>'
        + '<span id="adje-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
        + '<button class="btn btn-danger" id="adje-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'adj-edit-modal', maxWidth: 540, noClose: true });
    document.getElementById('adje-save')?.addEventListener('click', () => this.saveEdit('adje-', 'adj-edit-modal'));
    document.getElementById('adje-del')?.addEventListener('click', async () => {
      if (!(await App.confirmDelete())) return;
      await App.removeRecord('ic', 'adjustment', id);
      this.editId = null;
      App.closeModal('adj-edit-modal');
      this.renderList();
    });
    this.wireFormFields('adje-');
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
    const reason = document.getElementById(idp + 'reason')?.value;
    if (!reason) { fail('Pick a reason.'); return; }
    const direction = document.getElementById(idp + 'dir')?.value || this._dirFor(reason);
    const unit = document.getElementById(idp + 'unit')?.value || '';
    const performedById = document.getElementById(idp + 'by')?.value;
    if (!performedById) { fail('Pick who logged the adjustment.'); return; }
    const performedBy = (this.staffById(performedById) || {}).name || '';
    const witnessedById = document.getElementById(idp + 'witness')?.value || '';
    const witnessedBy   = witnessedById ? ((this.staffById(witnessedById) || {}).name || '') : '';
    const perUnitCost = this.perUnitCostFor(product, unit);

    const rec = {
      id:                       this.editId,
      date_time:                dateTime,
      product_id:               product.id,
      product_name:             product.name,
      category:                 product.category || '',
      quantity,
      unit,
      direction,
      reason,
      unit_cost_at_adjustment:  perUnitCost,
      value:                    quantity * perUnitCost,
      performed_by_id:          performedById,
      performed_by:             performedBy,
      witnessed_by_id:          witnessedById,
      witnessed_by:             witnessedBy,
      notes:                    document.getElementById(idp + 'notes')?.value.trim() || '',
      updated_at:               new Date().toISOString()
    };
    const ex = this.adjustments().find(x => x.id === this.editId);
    const saveRec = ex ? { ...ex, ...rec } : rec;

    const btn = document.getElementById(idp + 'save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('ic', 'adjustment', saveRec);
    this.editId = null;
    if (ok) { if (modalId) App.closeModal(modalId); this.renderList(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Update Adjustment'; } fail('Save failed. Try again.'); }
  },

  // ── Form options ────────────────────────────────────────────────────
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

  unitOptions(productCategory, selected, hasOz) {
    let opts = ['bottles', 'units'];
    if (productCategory === 'Bottle Beer') opts = ['cases', 'bottles'];
    else if (productCategory === 'Draft Beer') opts = ['kegs', 'oz'];
    // Food/Misc: offer 'oz' ONLY for a liquid (container_size_oz set, where costPerOz works).
    // A solid (lb/each, no container_size_oz) has no fluid-oz cost, so 'oz' booked $0 — use lbs.
    else if (productCategory === 'Food' || productCategory === 'Misc') opts = hasOz ? ['units', 'each', 'lbs', 'oz'] : ['units', 'each', 'lbs'];
    else if (productCategory === 'Liquor' || productCategory === 'Wine') opts = ['bottles', 'oz'];
    return opts.map(o => '<option' + (o === selected ? ' selected' : '') + '>' + esc(o) + '</option>').join('');
  },

  async confirmDel(id) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    await App.removeRecord('ic', 'adjustment', id);
    this.renderList();
  },

  // ── Print blank sheet — for a damage / expiration / found walk-through ────
  printBlank() {
    App.printBlankSheet({
      title: 'Adjustment Log',
      subtitle: 'Document stock written off or found outside of normal sale: damage, theft, expiration, or stock you found that was never counted. Manager enters each row into Bar Cop after the walk-through.',
      columns: [
        { label: 'Date',         width: '12%' },
        { label: 'Product',      width: '26%' },
        { label: 'Qty',          width: '7%' },
        { label: 'Unit',         width: '8%' },
        { label: 'Reason',       width: '13%' },
        { label: 'Loss / Found', width: '12%' },
        { label: 'By',           width: '12%' },
        { label: 'Witnessed',    width: '10%' }
      ],
      rows: 20
    });
  }
};
