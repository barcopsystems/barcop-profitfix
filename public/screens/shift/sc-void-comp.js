'use strict';

/* ── Shift Control — Void and Comp Log (writes sc_void_comps) ─────────────────
   Logs voided and comped items during service. One Item dropdown (menu items +
   inventory products, with a Custom option) identifies what it was; picking an
   inventory product links it for variance. sc_void_comps feeds Profit Recovery's
   Theft Risk and the Profit Audit. Inline add form on the landing, filter card
   with totals, bare list. */

S.ShiftVoidComp = {
  editId: null,
  entryMode: 'import',     // landing card: import-first ('import' = drop a POS export, 'manual' = batch builder)
  _modalMode: 'import',    // log pop-up: same two modes
  _draft: null,            // in-memory header draft (survives leave/return)
  _draftRows: null,        // in-memory line rows
  filterPreset: 'last-4',  // active range chip
  _prevPreset: 'last-4',
  filterFrom: '',          // custom range only
  filterTo: '',
  RANGE_CHIPS: [
    { v: 'this-week', label: 'This Week' }, { v: 'last-week', label: 'Last Week' },
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],

  // Void reasons. Comp reasons live in App.SC_COMP_REASONS (each tagged loss vs
  // policy expense) so the operator picks ONE thing and Theft Risk, Books, and
  // Year-End all classify a comp from that single source.
  REASONS: {
    Void: ['Rung in error', 'Wrong item', 'Changed mind', 'Kitchen error', 'Sent back', 'Other']
  },

  records() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_void_comps)) App.shiftData.sc_void_comps = [];
    return App.shiftData.sc_void_comps;
  },
  products() {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
  },
  productById(id) {
    return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
  },
  menuItems() { return (App.menuItems && App.menuItems()) || []; },
  menuItemById(id) { return this.menuItems().find(m => m.id === id) || null; },
  // Sale price for the auto-fill: menu items carry .price, inventory products
  // carry .menu_price (the per-serving sale price set in Product Setup). Returns
  // a positive number, or null when the item has no price (then Amount is manual).
  itemPrice(itemKey) {
    if (!itemKey) return null;
    let p = null;
    if (itemKey.startsWith('m:')) { const m = this.menuItemById(itemKey.slice(2)); p = m && parseFloat(m.price); }
    else if (itemKey.startsWith('p:')) { const pr = this.productById(itemKey.slice(2)); p = pr && parseFloat(pr.menu_price); }
    return (p && p > 0) ? p : null;
  },
  shiftTypes() { return App.SHIFT_TYPES; },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // ── Item picker: menu items + inventory products + custom, one dropdown ─────
  itemOptions(selectedKey, includeCustom) {
    if (includeCustom == null) includeCustom = true;
    let h = '<option value="">No item</option>'
      + (includeCustom ? '<option value="custom"' + (selectedKey === 'custom' ? ' selected' : '') + '>Custom / not tracked</option>' : '');
    const menu = this.menuItems();
    if (menu.length) {
      h += '<optgroup label="Menu Items">';
      menu.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(m => {
        const v = 'm:' + m.id;
        h += '<option value="' + v + '"' + (selectedKey === v ? ' selected' : '') + '>' + esc(m.name) + '</option>';
      });
      h += '</optgroup>';
    }
    const order = ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
    const cats = [...new Set(this.products().map(p => p.category || 'Other'))]
      .sort((a, b) => { const ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    cats.forEach(cat => {
      const inCat = this.products().filter(p => (p.category || 'Other') === cat).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (!inCat.length) return;
      h += '<optgroup label="' + esc(cat) + '">';
      inCat.forEach(p => { const v = 'p:' + p.id; h += '<option value="' + v + '"' + (selectedKey === v ? ' selected' : '') + '>' + esc(p.name) + '</option>'; });
      h += '</optgroup>';
    });
    // S193: keep a selected inventory product the active-only filter dropped (deactivated) visible + labelled.
    if (selectedKey && selectedKey.slice(0, 2) === 'p:' && !this.products().some(p => p.id === selectedKey.slice(2))) {
      const _cur = this.productById(selectedKey.slice(2));
      if (_cur) h += '<optgroup label="Current selection"><option value="p:' + _cur.id + '" selected>' + esc(_cur.name || '') + (_cur.active === false ? ' (inactive)' : '') + '</option></optgroup>';
    }
    return h;
  },
  // Resolve a saved record back to its picker key.
  itemKeyOf(r) {
    if (!r) return '';
    if (r.product_id) return 'p:' + r.product_id;
    if (r.menu_item_id) return 'm:' + r.menu_item_id;
    if (r.item) return 'custom';
    return '';
  },
  reasonOptions(type, selected) {
    const list = type === 'Comp'
      ? (App.SC_COMP_REASONS || []).map(x => x.value)
      : (this.REASONS.Void || []);
    return '<option value="">Select reason...</option>'
      + list.map(r => '<option' + (r === selected ? ' selected' : '') + '>' + esc(r) + '</option>').join('');
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How the Void and Comp Log Works', [
      { p: ['Voids and comps are your exception transactions. Logging every one feeds the loss total on Loss Prevention and the Bar Cop Audit, and keeps Books honest on comp cost. For the per-server read, who comps far more than the rest of the floor, drop your POS per-server report on Sales Integrity in Profit Recovery.'] },
      { h: 'One record, the dollar amount', p: ['A void or comp is logged by the amount, not item by item. Comp a whole table\'s meal and you log one line for the total. The amount is what matters. The item is optional.'] },
      { h: 'Enter the whole shift at once', p: ['Set the date and shift up top, then add a line for each void or comp off your sheet or POS list. Authorized By up top applies to your comps. Add Line for another, and Save All writes them in one shot, no running to Bar Cop every time one happens. Need a check number, a custom item, or a note on one? Save it, then Edit that row.'] },
      { h: 'Void vs Comp', p: ['A void reverses a sale that should not have been rung (wrong item, rung in error). A comp is a sale you gave away.'] },
      { h: 'The Reason carries the classification', p: ['On a comp, the reason tells Bar Cop whether it is a loss or a policy expense. Service Recovery, Customer Goodwill, Manager Comp, Regular / VIP, and Marketing / Promo are give-aways and feed Loss Prevention. Staff Meal and Shift Drink are policy expense, tracked as cost lines in Books and the Annual Review, not a loss. Pick honestly and the loss read stays real.'] },
      { h: 'Linking a tracked item (Units)', p: ['Most comps need no item. But if you give away a tracked inventory product, a bottle of wine off the shelf, a six-pack, pick it under Item and set how many Units you gave away. The Inventory Variance Report subtracts that known comp from usage so it does not read as shrinkage.'] },
      { h: 'Import from a POS export', p: ['Switch to Import File and drop your POS voids/comps export, CSV or Excel. Map the columns once and Bar Cop remembers it. Amount is required; Void-or-Comp, Item, Server, Reason, and Date are matched if your export has them. Servers match your roster by name. A row whose type says comp, discount, promo, coupon, courtesy or on the house lands as a Comp, because all of those are revenue given away; everything else lands as a Void, and so does a row that names a void explicitly. If your export has no type column at all, every row lands as a Void and you can change any of them by editing the row. If your export has a date column and Bar Cop cannot read a date in it, that row is skipped and counted in the result line rather than being dated today; a date with no year in it, like "20-Jul", cannot be read, because the year is not in the file to read. With no date column at all, every row is dated today. Each row lands as its own record, so the list, edits, Variance, and Loss Prevention all keep working. Fill anything missing by editing the row after import.'] },
      { h: 'Filter, Export, Worksheet', p: ['Filter by date range and the void and comp totals update. Export PDF saves the filtered list. Worksheet prints a blank sheet to tally voids and comps by hand during the rush.'] }
    ]);
  },

  // ── Shared form fields (inline log form p='vc-', edit pop-up p='vce-') ──────
  // Amount-driven: a comp is ONE record (a whole comped meal is one line, not one
  // per item). Item is optional; Units shows only when a tracked inventory product
  // is linked, right beside the Item picker, so nothing lands alone on a row.
  formFields(r, p) {
    p = p || 'vc-';
    const v = val => (val != null && val !== '') ? val : '';
    const type = (r && r.type) || 'Void';
    const typeOpts = ['Void', 'Comp'].map(t => '<option' + (type === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const shiftOpts = this.shiftTypes().map(t => '<option' + (r && r.shift_type === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const itemKey = this.itemKeyOf(r);
    const isCustom = itemKey === 'custom';
    const isProduct = itemKey.startsWith('p:');

    return '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="flex:1;min-width:110px;"><label>Date</label><input type="date" id="' + p + 'date" value="' + esc(r?.date || App.todayLocal()) + '"/></div>'
      + '<div class="f" style="flex:1;min-width:90px;"><label>Type</label><select id="' + p + 'type">' + typeOpts + '</select></div>'
      + '<div class="f" style="flex:1;min-width:110px;"><label>Shift Type</label><select id="' + p + 'shift">' + shiftOpts + '</select></div>'
      + '<div class="f" style="flex:1;min-width:95px;"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + p + 'amount" min="0" step="0.01" value="' + v(r?.amount) + '"/></div></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Server</label><select id="' + p + 'server">' + App.staffOptions(r?.staff_id || r?.server, { placeholder: 'Select staff...', audience: 'service' }) + '</select></div>'
      // Authorized By / Reason / Check # / Item continue in the same row (the
      // narrow pop-up reflows them 2-up); Units or Custom Name appear after Item.
      + '<div class="f" style="flex:1;min-width:120px;"><label>Authorized By</label><select id="' + p + 'auth">' + App.staffOptions(r?.authorized_by_id || r?.authorized_by, { placeholder: 'Select manager...', audience: 'supervisor' }) + '</select></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Reason</label><select id="' + p + 'reason">' + this.reasonOptions(type, r?.reason) + '</select></div>'
      + '<div class="f" style="flex:1;min-width:90px;"><label>Check #</label><input type="text" id="' + p + 'check" value="' + esc(r?.check_number || '') + '" placeholder="Optional"/></div>'
      + '<div class="f" style="flex:1;min-width:140px;"><label>Item <span style="color:var(--t4);font-weight:400;">(optional)</span></label><select id="' + p + 'item-sel">' + this.itemOptions(itemKey) + '</select></div>'
      + '<div class="f" id="' + p + 'units-wrap" style="width:90px;flex-shrink:0;' + (isProduct ? '' : 'display:none;') + '"><label>Units</label><input type="number" id="' + p + 'units" min="0" step="0.01" value="' + v(r?.units != null ? r.units : '') + '" placeholder="1"/></div>'
      + '<div class="f" id="' + p + 'custom-wrap" style="flex:1;min-width:130px;' + (isCustom ? '' : 'display:none;') + '"><label>Custom Item Name</label><input type="text" id="' + p + 'custom" value="' + esc(isCustom ? (r?.item || '') : '') + '" placeholder="What was it?"/></div>'
      + '</div>'

      + App.noteField({ id: p + 'notes', value: r?.notes });
  },

  // Type + item change handlers. p = id prefix ('vc-' inline form, 'vce-' modal).
  wireFormFields(p) {
    p = p || 'vc-';
    document.getElementById(p + 'type')?.addEventListener('change', e => {
      const sel = document.getElementById(p + 'reason');
      if (sel) sel.innerHTML = this.reasonOptions(e.target.value, '');
    });
    document.getElementById(p + 'item-sel')?.addEventListener('change', e => {
      const k = e.target.value;
      const uw = document.getElementById(p + 'units-wrap'); if (uw) uw.style.display = k.startsWith('p:') ? '' : 'none';
      const cw = document.getElementById(p + 'custom-wrap'); if (cw) cw.style.display = k === 'custom' ? '' : 'none';
    });
  },

  statusText(type) {
    return '<span style="color:var(--t1);font-weight:700;">' + esc(type || '-') + '</span>';
  },

  // ── Filter ──────────────────────────────────────────────────────────────────
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'vc-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><button class="btn btn-ghost btn-sm" id="vc-export">Export PDF</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="vc-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="vc-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
  },

  applyFilters(list) {
    const { from, to } = this.effectiveRange();
    return list.filter(r => {
      const date = r.date || '';
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  },

  renderList() {
    this.editId = null;
    const all = [...this.records()];
    const filtered = this.applyFilters(all).sort(App.cmpNewest);

    const formCard = this.builderCard();

    let below;
    if (all.length === 0) {
      below = '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
        + '<th>Date</th><th>Type</th><th>Item</th><th>Amount</th><th>Server</th><th>Authorized By</th><th>Reason</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="8" style="color:var(--t3);">No voids or comps logged yet. Use the form above to log the first one.</td></tr></tbody></table></div>';
    } else {
      const voids = filtered.filter(r => r.type === 'Void');
      const comps = filtered.filter(r => r.type === 'Comp');
      const voidTot = voids.reduce((t, r) => t + (r.amount || 0), 0);
      const compTot = comps.reduce((t, r) => t + (r.amount || 0), 0);
      // Given Away = the customer-facing comps (App.compReasonIsLoss), read against
      // sales for this SAME date range so the operator sees what they hand out on
      // purpose as a share of the top line, not just a raw total. Staff meals and
      // shift drinks are policy expense, not a give-away, so they drop out here.
      const { from: rFrom, to: rTo } = this.effectiveRange();
      const giveAway = comps.filter(r => App.compReasonIsLoss(r.reason)).reduce((t, r) => t + (r.amount || 0), 0);
      const rangeSales = ((App.data && App.data.revenue_weeks) || []).reduce((t, w) => {
        const end = String(w.period_end || '').slice(0, 10);
        if (!end || (rFrom && end < rFrom) || (rTo && end > rTo)) return t;
        return t + (w.bar_revenue || 0) + (w.floor_revenue || 0);
      }, 0);
      const compTarget = parseFloat(App.data.revenue_settings && App.data.revenue_settings.targets && App.data.revenue_settings.targets.comp_pct) || 3;
      const compPct = rangeSales > 0 ? giveAway / rangeSales * 100 : null;
      const pctCol = compPct == null ? 'var(--t3)' : compPct > compTarget + 0.3 ? 'var(--red)' : compPct >= compTarget - 1 ? 'var(--amber)' : 'var(--green)';
      const compRead = giveAway > 0
        ? '<div style="margin-top:14px;border:1px solid var(--b-edge);background:var(--surface);border-radius:var(--r2);padding:11px 14px;font-size:12px;color:var(--t3);line-height:1.6;">' + App.fmtCurrency(giveAway) + ' in customer comps this range'
          + (compPct != null ? ', ' + compPct.toFixed(1) + '% of sales, ' + (compPct > compTarget + 0.3 ? 'over' : compPct >= compTarget - 1 ? 'right around' : 'under') + ' your ' + compTarget + '% line' : ', log your weekly sales to read this as a share of the top line')
          + '. Not every comp is a leak; the question is whether it is buying loyalty or giving away margin.</div>'
        : '';
      const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Voids</div><div class="calc-val lg">' + voids.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Void Total</div><div class="calc-val lg warn">' + App.fmtCurrency(voidTot) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Comps</div><div class="calc-val lg">' + comps.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Comp Total</div><div class="calc-val lg warn">' + App.fmtCurrency(compTot) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Given Away</div><div class="calc-val lg">' + App.fmtCurrency(giveAway) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">% of Sales</div><div class="calc-val lg" style="color:' + pctCol + ';">' + (compPct == null ? '-' : compPct.toFixed(1) + '%') + '</div></div>'
        + '</div>' + compRead + '</div>';

      let listHtml;
      if (filtered.length === 0) {
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>Date</th><th>Type</th><th>Item</th><th>Amount</th><th>Server</th><th>Authorized By</th><th>Reason</th><th></th>'
          + '</tr></thead><tbody><tr><td colspan="8" style="color:var(--t3);">No voids or comps in this range. Pick a wider range above.</td></tr></tbody></table></div>';
      } else {
        const rows = filtered.slice(0, App.listLimit('sc', 'void_comp')).map(r => '<tr class="vc-row" data-id="' + r.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(r.date) + '</div></td>'
          + '<td>' + this.statusText(r.type) + '</td>'
          + '<td>' + esc(r.item || '-') + '</td>'
          + '<td class="val">' + App.fmtCurrency(r.amount || 0) + '</td>'
          + '<td>' + esc(r.server || '-') + '</td>'
          + '<td>' + esc(r.authorized_by || '-') + '</td>'
          + '<td>' + esc(r.reason || '-') + '</td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('sc-void-comp') ? '<button class="btn btn-ghost btn-sm vc-edit" data-id="' + r.id + '">Edit</button>' : '')
          + (App.canEdit('sc-void-comp') ? '<button class="btn btn-danger btn-sm vc-del" data-id="' + r.id + '">Delete</button>' : '')
          + '</div></td></tr>').join('');
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>Date</th><th>Type</th><th>Item</th><th>Amount</th><th>Server</th><th>Authorized By</th><th>Reason</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          + App.showOlderBar('sc', 'void_comp', filtered, this.filterPreset !== 'all');
      }
      below = statsCard + this.filterRow() + listHtml;
    }

    this.container.innerHTML = '<div class="screen">' + formCard + below + '</div>';
    App.applyCollapsed(this.container);
    this.wireList();
    if (this.entryMode === 'import') this.mountImporter('vc-csv');
  },

  wireList() {
    this.container.onclick = ev => {
      const modeBtn = ev.target.closest('.vc-mode');
      if (modeBtn) { this.entryMode = modeBtn.dataset.mode; this.renderList(); return; }
      const head = ev.target.closest('.card-collapse-head');
      if (head && !ev.target.closest('.btn')) { App.toggleCollapse(head); return; }
      const chip = ev.target.closest('.vc-range-chip');
      if (chip) {
        const v = chip.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.renderList();
        return;
      }
      if (ev.target.closest('#vc-export')) { const r = this.effectiveRange(); App.exportListPDF({ title: 'Void and Comp Log', root: this.container, lists: [['sc', 'void_comp']], reRender: () => this.renderList(), range: App.chipRangeLabel(this.RANGE_CHIPS, this.filterPreset, r.from, r.to) }); return; }
      if (ev.target.closest('#vc-print-blank')) { this.printBlank(); return; }
      if (ev.target.closest('#vcb-add')) { this.addLine(); return; }
      if (ev.target.closest('#vcb-save')) { this.saveBatch(); return; }
      if (ev.target.closest('#vcb-startover')) { this.startOver(); return; }
      const rm = ev.target.closest('.vcl-del');
      if (rm) { this.removeLine(rm.closest('.vc-line')); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const edit = ev.target.closest('.vc-edit');
      const del  = ev.target.closest('.vc-del');
      const row  = ev.target.closest('.vc-row');
      if (del)  { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (edit) { ev.stopPropagation(); this.openEditModal(edit.dataset.id); return; }
      if (row && App.canEdit('sc-void-comp')) this.openEditModal(row.dataset.id);
    };
    // Per-line conditional fields (delegated so new lines work without rewiring).
    this.container.onchange = ev => this.onLineChange(ev);
    document.getElementById('vc-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('vc-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });

    // Hold the in-progress batch through leave/return (manual builder only; import
    // mode has no form to hold). Restore the header, then capture header + line rows.
    const formRoot = this.container.querySelector('.form-card');
    if (formRoot && document.getElementById('vcb-rows')) {
      if (this._draft) App.restoreDraft(formRoot, this._draft);
      const cap = () => {
        this._draft = App.captureDraft(formRoot);
        this._draftRows = [...formRoot.querySelectorAll('.vc-line')].map(line => ({
          type:      line.querySelector('.vcl-type')?.value || 'Void',
          item_key:  line.querySelector('.vcl-item')?.value || '',
          amount:    line.querySelector('.vcl-amount')?.value || '',
          units:     line.querySelector('.vcl-units')?.value || '',
          server_id: line.querySelector('.vcl-server')?.value || '',
          reason:    line.querySelector('.vcl-reason')?.value || ''
        }));
      };
      formRoot.addEventListener('input', cap);
      formRoot.addEventListener('change', cap);
    }
  },

  // Per-line conditional handler for the batch builder, shared by the landing
  // and the running-shift log pop-up. Type drives the Reason list; a priced
  // item auto-fills Amount; changing Units recomputes Amount.
  onLineChange(ev) {
    const line = ev.target.closest('.vc-line');
    if (!line) return;
    if (ev.target.classList.contains('vcl-type')) {
      const reason = line.querySelector('.vcl-reason');
      if (reason) reason.innerHTML = this.reasonOptions(ev.target.value, '');
    } else if (ev.target.classList.contains('vcl-item')) {
      const price = this.itemPrice(ev.target.value);
      const units = line.querySelector('.vcl-units');
      const amt = line.querySelector('.vcl-amount');
      if (price != null) {
        if (units && !(parseFloat(units.value) > 0)) units.value = '1';
        if (amt) amt.value = (price * (parseFloat(units && units.value) || 1)).toFixed(2);
      }
    } else if (ev.target.classList.contains('vcl-units')) {
      const itemSel = line.querySelector('.vcl-item');
      const price = this.itemPrice(itemSel ? itemSel.value : '');
      const amt = line.querySelector('.vcl-amount');
      if (price != null && amt) amt.value = (price * (parseFloat(ev.target.value) || 0)).toFixed(2);
    }
  },

  // ── Edit in a focused pop-up (same unified form as the landing) ─────────────
  openEditModal(id) {
    if (!App.canEdit('sc-void-comp')) return;
    const r = this.records().find(x => x.id === id);
    if (!r) return;
    this.editId = id;
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Void / Comp</div>'
      + this.formFields(r, 'vce-')
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="vce-save">Update</button>'
      + '<span id="vce-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '<button class="btn btn-danger" id="vce-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'vc-edit-modal', maxWidth: 540, noClose: true });
    this.wireFormFields('vce-');
    document.getElementById('vce-save')?.addEventListener('click', () => this.saveEdit(id));
    document.getElementById('vce-del')?.addEventListener('click', () => { this.editId = null; App.closeModal('vc-edit-modal'); this.confirmDel(id); });
  },

  // Log voids/comps from the running shift in a focused pop-up using the SAME
  // multi-line batch builder as the landing (header + lines + Save All), so a
  // manager can enter several at once. onDone re-renders the active shift.
  // preset pre-fills date/shift from the open shift.
  openLogModal(onDone, preset) {
    if (!App.canEdit('sc-void-comp')) return;
    this.editId = null;
    this._modalMode = 'manual';
    const done = () => { App.closeModal('vc-log-modal'); if (typeof onDone === 'function') onDone(); };
    // Re-render the pop-up in place on a mode flip. openModal replaces by id, so
    // toggling swaps the body cleanly and re-wires the fresh overlay.
    const mount = () => {
      const body = this._modalMode === 'import'
        ? '<div id="vc-csv-m"></div><div id="vc-imp-result-m"></div>'
        : this.builderInner(preset)
          + '<div class="card-actions">'
          + '<button class="btn btn-primary" id="vcb-save">Save All</button>'
          + '<span id="vcb-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
          + '</div>';
      const html = '<div class="card form-card" style="margin:0;">'
        + '<div class="card-title">Log Voids / Comps</div>'
        + this.modeToggleHtml(this._modalMode, 'vc-mmode')
        + body
        + '</div>';
      const modal = App.openModal(html, { id: 'vc-log-modal', maxWidth: 880, noClose: true });
      if (!modal) return;
      modal.addEventListener('change', ev => this.onLineChange(ev));
      modal.addEventListener('click', ev => {
        const mb = ev.target.closest('.vc-mmode');
        if (mb) { this._modalMode = mb.dataset.mode; mount(); return; }
        if (ev.target.closest('#vcb-add')) { this.addLine(); return; }
        const rm = ev.target.closest('.vcl-del');
        if (rm) { this.removeLine(rm.closest('.vc-line')); return; }
        if (ev.target.closest('#vcb-cancel')) { App.closeModal('vc-log-modal'); return; }
        if (ev.target.closest('#vcb-save')) { this.saveBatch(done); return; }
      });
      if (this._modalMode === 'import') this.mountImporter('vc-csv-m', done);
    };
    mount();
  },

  // Collect the form (prefix p) into a record body, or null after an error.
  // One place so the log form and the edit pop-up never drift apart.
  async _collect(p) {
    const err = document.getElementById(p + 'err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById(p + 'date')?.value;
    if (!date) { fail('Date is required.'); return null; }
    const amount = parseFloat(document.getElementById(p + 'amount')?.value);
    if (isNaN(amount) || amount < 0) { fail('Enter the amount.'); return null; }

    // Item is optional. Resolve from the single picker; blank = a whole-check
    // comp or an untracked void.
    const itemKey = document.getElementById(p + 'item-sel')?.value || '';
    let item = '', productId = '', productName = '', menuItemId = '', units = null;
    if (itemKey === 'custom') {
      item = (document.getElementById(p + 'custom')?.value || '').trim();
      if (!item) { fail('Name the custom item, or set Item to No item.'); return null; }
    } else if (itemKey.startsWith('m:')) {
      const m = this.menuItemById(itemKey.slice(2));
      if (!m) { fail('Pick an item or set Item to No item.'); return null; }
      item = m.name; menuItemId = m.id;
    } else if (itemKey.startsWith('p:')) {
      const pr = this.productById(itemKey.slice(2));
      if (!pr) { fail('Pick an item or set Item to No item.'); return null; }
      item = pr.name; productId = pr.id; productName = pr.name;
      const u = parseFloat(document.getElementById(p + 'units')?.value);
      units = isNaN(u) ? null : u;
    }

    const type = document.getElementById(p + 'type')?.value || 'Void';
    // Authorized By is an optional record of who cleared a comp. It is not
    // enforced and does not drive any theft signal (comp authorization is a
    // POS-native control); the honest comp-theft read is comp volume by server.
    const authBy = document.getElementById(p + 'auth')?.value || '';
    const serverId = document.getElementById(p + 'server')?.value || '';
    return {
      date,
      type,
      shift_type:    document.getElementById(p + 'shift')?.value || '',
      item,
      amount,
      product_id:    productId,
      product_name:  productName,
      menu_item_id:  menuItemId,
      units,
      staff_id:         serverId,
      server:           (App.staffById(serverId) || {}).name || '',
      authorized_by_id: authBy,
      authorized_by:    (App.staffById(authBy) || {}).name || '',
      check_number:  document.getElementById(p + 'check')?.value.trim() || '',
      reason:        document.getElementById(p + 'reason')?.value || '',
      notes:         document.getElementById(p + 'notes')?.value.trim() || ''
    };
  },

  // ── Batch entry builder ─────────────────────────────────────────────────────
  // A header (Date / Shift / Authorized By) over a stack of lines, Add Line for
  // more, one Save All. Matches how a manager actually enters a shift's voids
  // and comps at close, off a written sheet or a POS list, instead of one at a
  // time. Each saved line is its own record, so the list, edits, Variance, and
  // Theft Risk all keep working unchanged.
  // The builder body (header + line table + Add Line), shared by the landing
  // card and the running-shift log pop-up. preset pre-fills date / shift.
  builderInner(preset, useDraft) {
    const date = (preset && preset.date) || App.todayLocal();
    const shiftSel = (preset && preset.shift_type) || '';
    const shiftOpts = this.shiftTypes().map(t => '<option' + (shiftSel === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    // On the landing, rebuild the saved line rows from the draft; the pop-up starts blank.
    const rowsHtml = (useDraft && this._draftRows && this._draftRows.length)
      ? this._draftRows.map(r => this.lineHtml(r)).join('')
      : this.lineHtml();
    return '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Date</label><input type="date" id="vcb-date" value="' + esc(date) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Shift Type</label><select id="vcb-shift">' + shiftOpts + '</select></div>'
      + '<div class="f" style="width:220px;flex-shrink:0;"><label>Authorized By <span style="color:var(--t4);font-weight:400;">(comps)</span></label><select id="vcb-auth">' + App.staffOptions('', { placeholder: 'Select manager...', audience: 'supervisor' }) + '</select></div>'
      + '</div>'
      + '<div class="pill-wrap" style="margin-bottom:12px;">'
      + '<table class="ing-tbl pill" style="table-layout:fixed;"><thead><tr>'
      + '<th style="width:12%;">Type</th><th style="width:21%;">Item <span style="color:var(--t4);">(optional)</span></th>'
      + '<th style="width:12%;">Amount</th><th style="width:9%;">Units</th>'
      + '<th style="width:17%;">Server</th><th style="width:18%;">Reason</th><th style="width:11%;"></th>'
      + '</tr></thead><tbody id="vcb-rows">' + rowsHtml + '</tbody></table></div>'
      + '<button class="btn btn-ghost btn-sm" id="vcb-add" type="button" style="margin-bottom:14px;">+ Add Line</button>'
      + App.noteField({ id: 'vcb-notes' });
  },

  // One card, two ways in: enter the shift's voids and comps by hand in the batch
  // builder, or drop a POS export. A segmented toggle swaps the body so the
  // operator picks a lane instead of two stacked boxes. Same pattern as Log Hours.
  modeToggleHtml(activeMode, cls) {
    const segBtn = (mode, label) => {
      const on = activeMode === mode;
      return '<button type="button" class="btn btn-sm ' + cls + '" data-mode="' + mode + '" style="'
        + (on ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    };
    return '<div style="display:inline-flex;gap:6px;margin-bottom:18px;">'
      + segBtn('import', 'Import File') + segBtn('manual', 'Enter Manually') + '</div>';
  },

  builderCard() {
    const isImport = this.entryMode === 'import';
    const body = isImport
      ? '<div id="vc-csv"></div><div id="vc-imp-result"></div>'
      : this.builderInner(null, true);
    // Manual mode: Save All + Start Over live below the card (bottom-left), hidden
    // with the card on collapse. Import mode has no Save (the importer confirms).
    const belowBtns = isImport
      ? '<div id="vc-imp-actions" data-collapse-group="sc-void-comp" style="margin:16px 0 24px;"></div>'
      : '<div data-collapse-group="sc-void-comp" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary" id="vcb-save">Save All</button>'
        + '<button class="btn btn-ghost" id="vcb-startover">Start Over</button>'
        + '<span id="vcb-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
        + '</div>';
    return '<div class="card form-card">'
      + App.collapsibleCardTitle('sc-void-comp', 'Log Voids / Comps', '<button class="btn btn-ghost btn-sm no-print" id="vc-print-blank" type="button">Worksheet</button>')
      + '<div class="collapse-body">'
      + this.modeToggleHtml(this.entryMode, 'vc-mode')
      + body
      + '</div></div>'
      + belowBtns;
  },

  // One entry line = one table row. Type drives the Reason list; a tracked
  // product reveals the Units input (else the cell shows a dash). The Item
  // picker omits Custom here to keep lines lean (use a row's Edit for a custom
  // item, a check number, or notes).
  lineHtml(row) {
    row = row || {};
    const type = row.type || 'Void';
    const typeOpts = ['Void', 'Comp'].map(t => '<option' + (t === type ? ' selected' : '') + '>' + t + '</option>').join('');
    return '<tr class="vc-line">'
      + '<td><select class="form-input vcl-type" style="width:100%;">' + typeOpts + '</select></td>'
      + '<td><select class="form-input vcl-item" style="width:100%;">' + this.itemOptions(row.item_key || '', false) + '</select></td>'
      + '<td><input class="form-input vcl-amount" type="number" min="0" step="0.01" value="' + (row.amount != null && row.amount !== '' ? esc(String(row.amount)) : '') + '" placeholder="0.00" style="width:100%;"/></td>'
      + '<td><input class="form-input vcl-units" type="number" min="0" step="0.01" value="' + (row.units != null && row.units !== '' ? esc(String(row.units)) : '') + '" placeholder="1" style="width:100%;"/></td>'
      + '<td><select class="form-input vcl-server" style="width:100%;">' + App.staffOptions(row.server_id || '', { placeholder: 'Select staff...', audience: 'service' }) + '</select></td>'
      + '<td><select class="form-input vcl-reason" style="width:100%;">' + this.reasonOptions(type, row.reason || '') + '</select></td>'
      + '<td><button class="btn btn-danger btn-sm vcl-del" type="button">Delete</button></td>'
      + '</tr>';
  },

  addLine() {
    const wrap = document.getElementById('vcb-rows');
    if (wrap) wrap.insertAdjacentHTML('beforeend', this.lineHtml());
  },

  removeLine(line) {
    const wrap = document.getElementById('vcb-rows');
    if (!wrap || !line) return;
    // Keep at least one row; clearing the last one just resets it.
    if (wrap.querySelectorAll('.vc-line').length <= 1) wrap.innerHTML = this.lineHtml();
    else line.remove();
  },

  // Reset the manual batch builder to a fresh blank line.
  startOver() {
    this.editId = null;
    this._draft = null;
    this._draftRows = null;
    this.renderList();
  },

  async saveBatch(after) {
    const err = document.getElementById('vcb-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('vcb-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const shift = document.getElementById('vcb-shift')?.value || '';
    const authBy = document.getElementById('vcb-auth')?.value || '';
    const authName = (App.staffById(authBy) || {}).name || '';
    const batchNotes = document.getElementById('vcb-notes')?.value.trim() || '';

    const recs = [];
    const rowsWrap = document.getElementById('vcb-rows');
    for (const line of (rowsWrap ? [...rowsWrap.querySelectorAll('.vc-line')] : [])) {
      const amtRaw   = line.querySelector('.vcl-amount')?.value;
      const itemKey  = line.querySelector('.vcl-item')?.value || '';
      const serverId = line.querySelector('.vcl-server')?.value || '';
      const reason   = line.querySelector('.vcl-reason')?.value || '';
      const type     = line.querySelector('.vcl-type')?.value || 'Void';
      // Skip a line the manager added but never filled.
      if ((amtRaw === '' || amtRaw == null) && !itemKey && !serverId && !reason) continue;
      const amount = parseFloat(amtRaw);
      if (isNaN(amount) || amount < 0) { fail('Enter the amount on every line, or remove the blank line.'); return; }
      let item = '', productId = '', productName = '', menuItemId = '', units = null;
      if (itemKey.startsWith('m:')) {
        const m = this.menuItemById(itemKey.slice(2)); if (m) { item = m.name; menuItemId = m.id; }
      } else if (itemKey.startsWith('p:')) {
        const pr = this.productById(itemKey.slice(2));
        if (pr) { item = pr.name; productId = pr.id; productName = pr.name; const u = parseFloat(line.querySelector('.vcl-units')?.value); units = isNaN(u) ? null : u; }
      }
      const isComp = type === 'Comp';
      recs.push({
        id: App.uid(), date, type, shift_type: shift, item, amount,
        product_id: productId, product_name: productName, menu_item_id: menuItemId, units,
        staff_id: serverId, server: (App.staffById(serverId) || {}).name || '',
        authorized_by_id: isComp ? authBy : '', authorized_by: isComp ? authName : '',
        check_number: '', reason, notes: batchNotes,
        created_at: new Date().toISOString()
      });
    }
    if (!recs.length) { fail('Fill in at least one line.'); return; }

    const btn = document.getElementById('vcb-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const list = this.records();
    let ok = true;
    for (const r of recs) { list.push(r); ok = (await App.putRecord('sc', 'void_comp', r)) && ok; }
    if (ok) { this._draft = null; this._draftRows = null; (typeof after === 'function' ? after : () => this.renderList())(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Save All'; } fail('Save failed. Try again.'); }
  },

  async saveEdit(id) {
    const body = await this._collect('vce-');
    if (!body) return;
    const list = this.records();
    const i = list.findIndex(x => x.id === id);
    if (i < 0) { const err = document.getElementById('vce-err'); if (err) { err.textContent = 'Record not found.'; err.style.display = 'inline'; } return; }
    list[i] = { ...list[i], ...body };
    const btn = document.getElementById('vce-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'void_comp', list[i]);
    if (ok) { this.editId = null; App.closeModal('vc-edit-modal'); this.renderList(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Update'; } const err = document.getElementById('vce-err'); if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; } }
  },

  async confirmDel(id) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    await App.removeRecord('sc', 'void_comp', id);
    this.renderList();
  },

  // ── CSV import (drag-drop + column mapping, same setup as Labor Log Hours) ────
  /* ⚠⚠ A PRIVATE `normDate` USED TO SIT HERE, DIRECTLY ABOVE mountImporter, AND IT WAS DEAD.
     Zero callers — the import path goes through PosIngest.build('voids'), which uses the shared
     PosIngest.normDate — so it changed no number. It is deleted rather than left alone because of
     what it was: a verbatim copy of the shape six scan rounds were spent removing, carrying BOTH
     eliminated bugs at once. `new Date(<free text>)` hands the string to V8's legacy parser (an
     Excel `d-mmm` cell books to 2001, a UTC marker loses a day, "06.07.2026" transposes, "Feb 29
     2026" rolls into March); and `length <= 10` appends 'T00:00:00' one character too early, so
     "Jul 4 2026" (exactly 10) died while "Jul 04 2026" (11) parsed — days 1-9 of every month.
     Dead code in an import door is a landmine, not a neutral: it is named the obvious thing and
     sits in the obvious place, so the next person wiring a date column here reaches for it and
     reintroduces the whole class. The shared reader is the only one.
     ⚠ Before adding a date format anywhere, add it to PosIngest.normDate. verify-import-date-year.js
     case C6 now scans EVERY CSVMapper door file for a private date parser, not the two it already
     knew about — which is the only reason this copy was found. */
  mountImporter(elId, after) {
    const el = document.getElementById(elId);
    if (!el || typeof CSVMapper === 'undefined') return;
    const resultId = elId === 'vc-csv-m' ? 'vc-imp-result-m' : 'vc-imp-result';
    CSVMapper.mount(el, {
      dropTitle: 'Drop your POS voids and comps export here',
      dropSub: 'Needs an Amount column. Void-or-comp, item, server, reason, and date are matched if your export has them.',
      actionsEl: elId === 'vc-csv' ? '#vc-imp-actions' : undefined,
      fields: PosIngest.FIELDS.voids,
      confirmLabel: 'Import',
      onComplete: rows => this.importRows(rows, resultId, after)
    });
  },
  async importRows(rows, resultId, after) {
    // Match / dedup / build / save live in the shared PosIngest (dedup added so a
    // re-dropped voids/comps export never double-counts). UI message stays here.
    const { toAdd, skipped, undated, dupCount, fileRepeats } = PosIngest.build('voids', rows);
    const setResult = html => { const r = resultId && document.getElementById(resultId); if (r) r.innerHTML = html; };
    const nUnd = (undated || []).length;
    /* Everything this import found besides the rows it wrote, built ONCE and appended to every
       outcome — the zero-row message, the failure message and the success line. A refused write is
       when the operator reads hardest, and `undated` is a problem they can actually fix in the file.
       ⚠ TWO LISTS, TWO SENTENCES. `skipped` is "no usable amount"; `undated` is "the file gave a
       date I could not read". Reporting them as one would send the operator at the Amount column
       over a date problem — the same mis-naming already fixed at the cash and sales doors. */
    const dim = t => ' <span style="color:var(--t3);font-weight:400;">' + t + '</span>';
    const outcomes = (skipped.length ? dim(skipped.length + ' row' + (skipped.length === 1 ? '' : 's') + ' skipped (no amount).') : '')
      + (nUnd ? dim(nUnd + ' row' + (nUnd === 1 ? '' : 's') + ' skipped (no readable date).') : '')
      + (dupCount ? dim(dupCount + ' already logged, skipped.') : '')
      /* ⚠ WORDED AS "LOOK AT THIS", NOT AS A COLLAPSE — this door imports BOTH rows on purpose
         (S218). At the hours, tips and cash doors the hand form forbids a second record with the
         same identity, so a repeat there is data the operator could not have entered and is safely
         counted once. Nothing in the Void/Comp form says that: two $75 order errors on the same item
         in one night is an ordinary evening, and dropping the second would delete real money. So
         Bar Cop reports what it saw and leaves the decision where it belongs. */
      + ((fileRepeats || 0) ? dim(fileRepeats + ' repeated line' + (fileRepeats === 1 ? '' : 's')
          + ' in your file — both imported, delete one if it is a duplicate.') : '');
    if (!toAdd.length) {
      // ⚠ NAME THE REAL REASON. One sentence used to cover every zero-row outcome, so a file whose
      // dates could not be read was told "Every row was missing a valid amount" — about amounts that
      // were fine. An absolute claim only fires when the other buckets are empty.
      // ⚠ AN ABSOLUTE HEADLINE MUST EXCLUDE **EVERY** OTHER BUCKET, dupCount included. These two
      // excluded only each other, so a file with two already-logged rows beside one bad amount read
      // "Every row was missing a valid amount. 1 row skipped (no amount). 2 already logged" —
      // contradicted by its own clause, one line down. Same trap the sales door hit twice.
      setResult('<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + (dupCount && !skipped.length && !nUnd ? 'No new rows imported. All ' + dupCount + ' row' + (dupCount === 1 ? ' was' : 's were') + ' already logged.'
         : nUnd && !skipped.length && !dupCount ? 'No rows imported. Bar Cop could not read a date on ' + (nUnd === 1 ? 'the row' : 'any row') + ' — check the date column in your export.'
         : skipped.length && !nUnd && !dupCount ? 'No rows imported. Every row was missing a valid amount.'
         : 'No new rows imported.')
        + outcomes + '</div>');
      return;
    }
    const ok = await PosIngest.commit('voids', toAdd);
    if (!ok) {
      // A partial save is not a failed save — the same lie already closed at the sales, cash and
      // per-server doors. App.landedOf/partialSaveNote carry the contract; do not re-word it here.
      setResult('<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + App.partialSaveNote(App.landedOf(toAdd, App.shiftData && App.shiftData.sc_void_comps),
                              toAdd.length, 'row', 'rows')
        + outcomes + '</div>');
      return;
    }
    /* ⚠⚠ WRITE THE REPORT AFTER THE REDRAW, NEVER BEFORE IT — AND NEVER INTO THE POPUP.
       The success line is the one message on this door that has to survive a re-render, and both
       exits destroy the element it goes in:
         inline — `renderList()` reassigns `container.innerHTML`, so #vc-imp-result is REPLACED by a
                  fresh empty one and anything written first is gone;
         popup  — `after` is the modal's `done`, which calls App.closeModal → el.remove(), taking
                  #vc-imp-result-m with it.
       Writing it first (the obvious reading of "report before you close") put the report on screen
       for a single tick and then wiped it, on EVERY partially-successful import — which is the
       common case and exactly when the new `undated` count matters. Only the zero-row and failure
       paths stayed visible, because those `return` without redrawing.
       So: redraw first, then write into a FRESHLY QUERIED slot. The popup's own slot is gone by
       then, so its report goes to the inline one — which is the screen the operator is looking at
       the moment the modal closes. */
    const msg = '<div style="font-size:13px;color:var(--gold);font-weight:700;margin-top:12px;">Imported '
      + toAdd.length + ' record' + (toAdd.length === 1 ? '' : 's') + '.' + outcomes + '</div>';
    if (typeof after === 'function') after();   // popup: close + re-render the shift underneath
    else this.renderList();
    const slot = document.getElementById('vc-imp-result');
    if (slot) slot.innerHTML = msg;
  },
  // Paper-at-bar workflow.
  printBlank() {
    App.printBlankSheet({
      title: 'Void / Comp Sheet',
      subtitle: 'Log every void and comp during the shift. Manager enters each row into Bar Cop after close.',
      columns: [
        { label: 'Time',          width: '8%'  },
        { label: 'Type',          width: '10%' },
        { label: 'Item',          width: '20%' },
        { label: 'Amount',        width: '10%' },
        { label: 'Server',        width: '13%' },
        { label: 'Authorized By', width: '13%' },
        { label: 'Reason',        width: '16%' },
        { label: 'Notes',         width: '10%' }
      ],
      rows: 16
    });
  }
};
