'use strict';

/* ── Shift Control — Waste / Spill Log (writes sc_waste) ──────────────────────
   Records product that left inventory without producing revenue: spills,
   broken bottles, dumped drinks, expired food. Each entry links to an
   ic_product by id and captures units consumed so the Inventory Variance
   Report can subtract waste from "used" before comparing against POS sales.
   Otherwise legit waste shows up as false-positive theft variance.

   Entry is a batch builder (header Date / Shift / Recorded By over a stack of
   lines, Add Line, one Save All) matching the Void/Comp log, since waste is
   the same end-of-shift, off-a-sheet batch job. Each line saves as its own
   record. Edit a past one in a focused pop-up.

   Feeds: Inventory Variance Report adjustments, Profit Audit shrinkage
   section, Theft Risk score (large unexplained waste is a signal). */

S.ShiftWaste = {
  editId: null,
  filterFrom: '',
  filterTo: '',
  filterReason: '',
  REASONS: ['Spill', 'Broken', 'Bad Pour / Customer Dissatisfied', 'Dumped / Tasted Bad', 'Expired / Past Date', 'Training', 'Other'],

  records() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_waste)) App.shiftData.sc_waste = [];
    return App.shiftData.sc_waste;
  },
  products() {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
  },
  productById(id) {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
  },
  shiftTypes() { return App.SHIFT_TYPES; },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // Per-product unit label so the operator sees what the Units field means for
  // the picked product (case beer counts in btls, draft in oz on partial keg
  // loss, food in whatever unit was set on Product Setup).
  unitLabel(p) {
    if (!p) return 'units';
    if (p.category === 'Bottle Beer') return 'btls';
    if (p.category === 'Draft Beer')  return 'oz';
    if (p.category === 'Food' || p.category === 'Misc') return (p.unit_type || 'units');
    return 'btls';
  },

  // Dollar value of the waste line. App.bottleCost for per-bottle cost on
  // case-tracked beer, ounces / container × unit_cost for draft, units ×
  // unit_cost for food/misc.
  costFor(p, units) {
    if (!p || !units) return 0;
    if (p.category === 'Draft Beer') {
      if (!p.container_size_oz || p.unit_cost == null) return 0;
      return (units / p.container_size_oz) * p.unit_cost;
    }
    if (p.category === 'Food' || p.category === 'Misc') {
      return (p.unit_cost != null) ? units * p.unit_cost : 0;
    }
    const bc = App.bottleCost(p);
    return bc != null ? units * bc : 0;
  },

  productOptions(selectedId) {
    const prods = this.products();
    const order = ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
    const cats = [...new Set(prods.map(p => p.category || 'Other'))]
      .sort((a, b) => { const ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    let h = '<option value="">Select product...</option>';
    cats.forEach(cat => {
      h += '<optgroup label="' + esc(cat) + '">';
      prods.filter(p => (p.category || 'Other') === cat).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .forEach(p => { h += '<option value="' + p.id + '"' + (selectedId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; });
      h += '</optgroup>';
    });
    return h;
  },
  reasonOptions(selected) {
    return '<option value="">Select reason...</option>'
      + this.REASONS.map(r => '<option' + (r === selected ? ' selected' : '') + '>' + esc(r) + '</option>').join('');
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';   // Export / Worksheet live on the filter card
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How the Waste and Spill Log Works', [
      { p: ['Waste is product that left the building without making you a dime: a spill, a broken bottle, a dumped drink, an expired item. Log it and Bar Cop pulls it out of your inventory variance so a real loss does not read as theft.'] },
      { h: 'Enter the whole shift at once', p: ['Set the date, shift, and who is recording up top, then add a line for each waste item off your sheet. Pick the product and how many units were lost. Bar Cop shows the unit and the cost as you go. Add Line for another, and Save All writes them in one shot.'] },
      { h: 'Units and cost', p: ['Units are in the product\'s own unit: bottles for liquor, wine, and case beer, ounces for a partial keg, the set unit for food. Cost is the product cost times units, the honest dollar weight of the waste.'] },
      { h: 'What it feeds', p: ['Logged waste is subtracted from used product in the Variance Report so it does not show up as theft signal, and it rolls into the Profit Audit shrinkage section. Large unexplained waste still moves the Theft Risk score, so log honestly.'] },
      { h: 'Filter, Export, Worksheet', p: ['Filter by date or reason and the totals update. Export PDF saves the filtered list. Worksheet prints a blank sheet to mark waste by hand during the rush.'] }
    ]);
  },

  // ── Batch entry builder (mirrors the Void/Comp log) ─────────────────────────
  builderCard() {
    const today = App.todayLocal();
    const shiftOpts = '<option value="">Select shift...</option>'
      + this.shiftTypes().map(t => '<option>' + esc(t) + '</option>').join('');
    return '<div class="card">'
      + App.collapsibleCardTitle('sc-waste', 'Log Waste / Spill', App.helpButton('wl-how'))
      + '<div class="collapse-body">'
      + '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Date</label><input type="date" id="wlb-date" value="' + today + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Shift Type</label><select id="wlb-shift">' + shiftOpts + '</select></div>'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Recorded By</label><select id="wlb-by">' + App.staffOptions('', { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'
      + '<div class="card" style="padding:0;overflow:hidden;margin-bottom:12px;">'
      + '<table class="ing-tbl"><thead><tr>'
      + '<th style="min-width:200px;">Product</th><th style="width:90px;">Units</th><th style="width:70px;">Unit</th>'
      + '<th style="width:90px;">Cost</th><th style="min-width:180px;">Reason</th><th style="width:90px;"></th>'
      + '</tr></thead><tbody id="wlb-rows">' + this.lineHtml() + '</tbody></table></div>'
      + '<button class="btn btn-ghost btn-sm" id="wlb-add" type="button" style="margin-bottom:14px;">+ Add Line</button>'
      + '<div class="card-actions"><button class="btn btn-primary" id="wlb-save">Save All</button>'
      + '<span id="wlb-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div>'
      + '</div></div>';
  },

  // One waste line = one table row. Product drives the Unit label; Product and
  // Units together drive the read-only Cost cell.
  lineHtml() {
    return '<tr class="wl-line">'
      + '<td><select class="form-input wll-prod" style="width:100%;">' + this.productOptions('') + '</select></td>'
      + '<td><input class="form-input wll-units" type="number" min="0" step="0.01" placeholder="0" style="width:100%;"/></td>'
      + '<td class="wll-unit" style="color:var(--t2);font-size:12px;">-</td>'
      + '<td class="wll-cost val" style="font-size:12px;">-</td>'
      + '<td><select class="form-input wll-reason" style="width:100%;">' + this.reasonOptions('') + '</select></td>'
      + '<td><button class="btn btn-danger btn-sm wll-del" type="button">Delete</button></td>'
      + '</tr>';
  },

  addLine() {
    const wrap = document.getElementById('wlb-rows');
    if (wrap) wrap.insertAdjacentHTML('beforeend', this.lineHtml());
  },
  removeLine(line) {
    const wrap = document.getElementById('wlb-rows');
    if (!wrap || !line) return;
    if (wrap.querySelectorAll('.wl-line').length <= 1) wrap.innerHTML = this.lineHtml();
    else line.remove();
  },

  // Refresh a line's Unit + Cost cells from its current product + units.
  refreshLineCalc(line) {
    if (!line) return;
    const p = this.productById(line.querySelector('.wll-prod')?.value || '');
    const units = parseFloat(line.querySelector('.wll-units')?.value);
    const unitCell = line.querySelector('.wll-unit');
    const costCell = line.querySelector('.wll-cost');
    if (unitCell) unitCell.textContent = p ? this.unitLabel(p) : '-';
    if (costCell) {
      const c = (p && units > 0) ? this.costFor(p, units) : 0;
      costCell.textContent = c > 0 ? App.fmtCurrency(c) : '-';
    }
  },

  async saveBatch() {
    const err = document.getElementById('wlb-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('wlb-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const shift = document.getElementById('wlb-shift')?.value || '';
    const byId = document.getElementById('wlb-by')?.value || '';
    const byName = (App.staffById(byId) || {}).name || '';

    const recs = [];
    for (const line of [...this.container.querySelectorAll('.wl-line')]) {
      const product_id = line.querySelector('.wll-prod')?.value || '';
      const unitsRaw   = line.querySelector('.wll-units')?.value;
      const reason     = line.querySelector('.wll-reason')?.value || '';
      // Skip a line the manager added but never filled.
      if (!product_id && (unitsRaw === '' || unitsRaw == null) && !reason) continue;
      if (!product_id) { fail('Pick a product on every line, or remove the blank line.'); return; }
      const units = parseFloat(unitsRaw);
      if (isNaN(units) || units <= 0) { fail('Enter the units lost on every line.'); return; }
      if (!reason) { fail('Pick a reason on every line.'); return; }
      const p = this.productById(product_id);
      recs.push({
        id: App.uid(), date, shift_type: shift,
        product_id, product_name: p?.name || '', product_category: p?.category || '',
        unit: this.unitLabel(p), units, cost: this.costFor(p, units), reason,
        recorded_by_id: byId, recorded_by: byName, notes: '',
        created_at: new Date().toISOString()
      });
    }
    if (!recs.length) { fail('Fill in at least one line.'); return; }

    const btn = document.getElementById('wlb-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const list = this.records();
    let ok = true;
    for (const r of recs) { list.push(r); ok = (await App.putRecord('sc', 'waste', r)) && ok; }
    if (ok) this.renderList();
    else { if (btn) { btn.disabled = false; btn.textContent = 'Save All'; } fail('Save failed. Try again.'); }
  },

  // ── Filter ──────────────────────────────────────────────────────────────────
  filterCard(stats) {
    const reasonOpts = '<option value="">All reasons</option>'
      + this.REASONS.map(r => '<option value="' + esc(r) + '"' + (this.filterReason === r ? ' selected' : '') + '>' + esc(r) + '</option>').join('');
    return '<div class="card no-print"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Filter</span><div style="display:flex;gap:8px;">'
      + '<button class="btn btn-ghost btn-sm" id="wl-export">Export PDF</button>'
      + '<button class="btn btn-ghost btn-sm" id="wl-print-blank">Worksheet</button></div></div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:14px;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="wl-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="wl-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Reason</label><select id="wl-f-reason">' + reasonOpts + '</select></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="wl-f-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div>' + (stats || '') + '</div>';
  },

  applyFilters(list) {
    return list.filter(r => {
      const date = r.date || '';
      if (this.filterFrom && date < this.filterFrom) return false;
      if (this.filterTo && date > this.filterTo) return false;
      if (this.filterReason && r.reason !== this.filterReason) return false;
      return true;
    });
  },

  renderList() {
    this.editId = null;
    const all = [...this.records()];
    const filtered = this.applyFilters(all).sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

    const formCard = this.builderCard();

    let below;
    if (all.length === 0) {
      below = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No waste logged yet. Use the form above. Logged waste is subtracted from inventory variance so a real loss does not read as theft.</div>';
    } else {
      const totalCost = filtered.reduce((t, r) => t + (r.cost || 0), 0);
      // No "Total Units" tile — waste rows mix unit types (bottles, ounces, food
      // units), so summing them is apples-to-oranges. Cost is the honest total.
      const stats = '<div class="calc" style="margin-bottom:0;">'
        + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val">' + filtered.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Cost</div><div class="calc-val warn">' + App.fmtCurrency(totalCost) + '</div></div>'
        + '</div>';

      let listHtml;
      if (filtered.length === 0) {
        listHtml = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No entries match the filters.</div>';
      } else {
        const rows = filtered.slice(0, App.listLimit('sc', 'waste')).map(r => {
          const p = this.productById(r.product_id);
          const unit = p ? this.unitLabel(p) : (r.unit || 'units');
          return '<tr class="wl-row" data-id="' + r.id + '" style="cursor:pointer;">'
            + '<td><div class="val">' + this.fmtDate(r.date) + '</div></td>'
            + '<td>' + esc(r.shift_type || '-') + '</td>'
            + '<td>' + esc(p?.name || r.product_name || '-') + (p?.category ? '<div style="font-size:10px;color:var(--t3);">' + esc(p.category) + '</div>' : '') + '</td>'
            + '<td class="val">' + (r.units || 0) + ' ' + esc(unit) + '</td>'
            + '<td>' + App.fmtCurrency(r.cost || 0) + '</td>'
            + '<td>' + esc(r.reason || '-') + '</td>'
            + '<td>' + esc(r.recorded_by || '-') + '</td>'
            + '<td><div class="row-actions">'
            + (App.canEdit('sc-waste') ? '<button class="btn btn-ghost btn-sm wl-edit" data-id="' + r.id + '">Edit</button>' : '')
            + (App.canEdit('sc-waste') ? '<button class="btn btn-danger btn-sm wl-del" data-id="' + r.id + '">Delete</button>' : '')
            + '</div></td></tr>';
        }).join('');
        listHtml = '<div class="tbl-wrap" style="overflow-x:auto;margin-top:16px;"><table class="tbl"><thead><tr>'
          + '<th>Date</th><th>Shift</th><th>Product</th><th>Units</th><th>Cost</th><th>Reason</th><th>Recorded By</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          + App.showOlderBar('sc', 'waste', filtered, !!(this.filterFrom || this.filterTo || this.filterReason));
      }
      below = this.filterCard(stats) + listHtml;
    }

    this.container.innerHTML = '<div class="screen">' + formCard + below + '</div>';
    App.applyCollapsed(this.container);
    this.wireList();
  },

  wireList() {
    this.container.onclick = ev => {
      if (ev.target.closest('#wl-how')) { this.showHowTo(); return; }
      const head = ev.target.closest('.card-collapse-head');
      if (head && !ev.target.closest('.btn')) { App.toggleCollapse(head); return; }
      if (ev.target.closest('#wl-export')) { App.exportPDF({ title: 'Waste / Spill Log', root: this.container }); return; }
      if (ev.target.closest('#wl-print-blank')) { this.printBlank(); return; }
      if (ev.target.closest('#wlb-add')) { this.addLine(); return; }
      if (ev.target.closest('#wlb-save')) { this.saveBatch(); return; }
      const rm = ev.target.closest('.wll-del');
      if (rm) { this.removeLine(rm.closest('.wl-line')); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const edit = ev.target.closest('.wl-edit');
      const del  = ev.target.closest('.wl-del');
      const row  = ev.target.closest('.wl-row');
      if (del)  { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (edit) { ev.stopPropagation(); this.openEditModal(edit.dataset.id); return; }
      if (row && App.canEdit('sc-waste')) this.openEditModal(row.dataset.id);
    };
    // Per-line: product drives the Unit label, product + units drive Cost.
    this.container.onchange = ev => {
      const line = ev.target.closest('.wl-line');
      if (!line) return;
      if (ev.target.classList.contains('wll-prod') || ev.target.classList.contains('wll-units')) this.refreshLineCalc(line);
    };
    document.getElementById('wl-f-from')?.addEventListener('change',   e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('wl-f-to')?.addEventListener('change',     e => { this.filterTo   = e.target.value || ''; this.renderList(); });
    document.getElementById('wl-f-reason')?.addEventListener('change', e => { this.filterReason = e.target.value || ''; this.renderList(); });
    document.getElementById('wl-f-clear')?.addEventListener('click', () => {
      this.filterFrom = this.filterTo = this.filterReason = '';
      this.renderList();
    });
  },

  // ── Edit a logged waste line in a focused pop-up ────────────────────────────
  editFields(r) {
    const v = val => (val != null && val !== '') ? val : '';
    const shiftOpts = '<option value="">Select shift...</option>'
      + this.shiftTypes().map(t => '<option' + (r && r.shift_type === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const p = r ? this.productById(r.product_id) : null;
    const unit = p ? this.unitLabel(p) : 'units';
    return '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label><input type="date" id="wle-date" value="' + esc(r?.date || '') + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Shift Type</label><select id="wle-shift">' + shiftOpts + '</select></div>'
      + '<div class="f" style="flex:1;min-width:240px;"><label>Product</label><select id="wle-product">' + this.productOptions(r?.product_id) + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Units Lost</label><div class="fw"><input class="suf" type="number" id="wle-units" min="0" step="0.01" value="' + v(r?.units) + '" placeholder="0"/><span class="suf" id="wle-unit-label">' + esc(unit) + '</span></div></div>'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Reason</label><select id="wle-reason">' + this.reasonOptions(r?.reason) + '</select></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Recorded By</label><select id="wle-by">' + App.staffOptions(r?.recorded_by_id || r?.recorded_by, { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:12px;"><div class="f" style="width:100%;"><label>Notes</label><textarea id="wle-notes" rows="2" placeholder="Optional">' + esc(r?.notes || '') + '</textarea></div></div>';
  },

  openEditModal(id) {
    if (!App.canEdit('sc-waste')) return;
    const r = this.records().find(x => x.id === id);
    if (!r) return;
    this.editId = id;
    const html = '<div class="card" style="margin:0;"><div class="card-title">Edit Waste / Spill</div>'
      + this.editFields(r)
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="wle-save">Update</button>'
      + '<button class="btn btn-ghost" id="wle-cancel">Cancel</button>'
      + '<span id="wle-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '<button class="btn btn-danger" id="wle-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'wl-edit-modal', maxWidth: 700, noClose: true });
    document.getElementById('wle-product')?.addEventListener('change', e => {
      const lbl = document.getElementById('wle-unit-label');
      if (lbl) lbl.textContent = this.unitLabel(this.productById(e.target.value));
    });
    document.getElementById('wle-cancel')?.addEventListener('click', () => { this.editId = null; App.closeModal('wl-edit-modal'); });
    document.getElementById('wle-save')?.addEventListener('click', () => this.saveEdit(id));
    document.getElementById('wle-del')?.addEventListener('click', () => { this.editId = null; App.closeModal('wl-edit-modal'); this.confirmDel(id); });
  },

  // Collect the edit / log pop-up form (wle- ids) into a record body, or null
  // after an error. Shared by saveEdit and the running-shift saveLog.
  _collect() {
    const err = document.getElementById('wle-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('wle-date')?.value;
    if (!date) { fail('Date is required.'); return null; }
    const product_id = document.getElementById('wle-product')?.value || '';
    if (!product_id) { fail('Pick a product.'); return null; }
    const units = parseFloat(document.getElementById('wle-units')?.value);
    if (isNaN(units) || units <= 0) { fail('Enter the units lost.'); return null; }
    const reason = document.getElementById('wle-reason')?.value || '';
    if (!reason) { fail('Pick a reason.'); return null; }
    const p = this.productById(product_id);
    const byId = document.getElementById('wle-by')?.value || '';
    return {
      date, shift_type: document.getElementById('wle-shift')?.value || '',
      product_id, product_name: p?.name || '', product_category: p?.category || '',
      unit: this.unitLabel(p), units, cost: this.costFor(p, units), reason,
      recorded_by_id: byId, recorded_by: (App.staffById(byId) || {}).name || '',
      notes: document.getElementById('wle-notes')?.value.trim() || ''
    };
  },

  async saveEdit(id) {
    const body = this._collect();
    if (!body) return;
    const err = document.getElementById('wle-err');
    const list = this.records();
    const i = list.findIndex(x => x.id === id);
    if (i < 0) { if (err) { err.textContent = 'Record not found.'; err.style.display = 'inline'; } return; }
    list[i] = { ...list[i], ...body };
    const btn = document.getElementById('wle-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'waste', list[i]);
    if (ok) { this.editId = null; App.closeModal('wl-edit-modal'); this.renderList(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Update'; } if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; } }
  },

  // Log one waste line from the running shift in a focused pop-up (no nav away).
  // preset pre-fills date/shift from the open shift.
  openLogModal(onDone, preset) {
    if (!App.canEdit('sc-waste')) return;
    this.editId = null;
    const html = '<div class="card" style="margin:0;"><div class="card-title">Log Waste / Spill</div>'
      + this.editFields(preset || {})
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="wle-save">Save</button>'
      + '<button class="btn btn-ghost" id="wle-cancel">Cancel</button>'
      + '<span id="wle-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'wl-edit-modal', maxWidth: 700, noClose: true });
    document.getElementById('wle-product')?.addEventListener('change', e => {
      const lbl = document.getElementById('wle-unit-label');
      if (lbl) lbl.textContent = this.unitLabel(this.productById(e.target.value));
    });
    document.getElementById('wle-cancel')?.addEventListener('click', () => App.closeModal('wl-edit-modal'));
    document.getElementById('wle-save')?.addEventListener('click', () => this.saveLog(onDone));
  },

  async saveLog(onDone) {
    const body = this._collect();
    if (!body) return;
    const rec = { id: App.uid(), ...body, created_at: new Date().toISOString() };
    const btn = document.getElementById('wle-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'waste', rec);
    if (ok) { App.closeModal('wl-edit-modal'); if (typeof onDone === 'function') onDone(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Save'; } const err = document.getElementById('wle-err'); if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; } }
  },

  async confirmDel(id) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    await App.removeRecord('sc', 'waste', id);
    this.renderList();
  },

  // Paper-at-bar workflow.
  printBlank() {
    App.printBlankSheet({
      title: 'Waste and Spill Log',
      subtitle: 'Log every spill, broken bottle, dumped drink, or expired item. Manager enters each row into Bar Cop after shift close.',
      columns: [
        { label: 'Time',     width: '10%' },
        { label: 'Product',  width: '30%' },
        { label: 'Qty',      width: '9%' },
        { label: 'Unit',     width: '9%' },
        { label: 'Reason',   width: '24%' },
        { label: 'By',       width: '18%' }
      ],
      rows: 18
    });
  }
};
