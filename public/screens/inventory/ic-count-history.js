'use strict';

/* ── Inventory Control — Count History (reads ic_counts) ──────────────────────
   Every submitted inventory count, with value, variance vs the prior count,
   a full per-product detail view, side-by-side comparison against any other
   count, and print-to-PDF export. */

S.InventoryCountHistory = {
  viewId: null,
  compareId: null,

  counts() {
    return ((App.inventoryData && App.inventoryData.ic_counts) || []);
  },
  sorted() {
    return [...this.counts()].sort((a, b) =>
      new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  showHowTo() {
    App.showHelpModal('How Count History Works', [
      { p: ['Count History is the record of every inventory count you have finalized. Each row is one count, with its value, how it moved versus the count before it, and a full breakdown you can open.'] },
      { h: 'Reading The List', p: ['Total Value is what your stock was worth at that count. Variance vs Prior is the change in value from the count before it, so you can watch your inventory rise or fall over time. The newest count is tagged Latest.'] },
      { h: 'The Detail View', p: ['Open any count with View to see every product, what you counted, its unit cost, and its value. Bottle beer shows in cases, liquor and wine in bottles, draft in kegs, and food in its own unit.'] },
      { h: 'Comparing Two Counts', p: ['Inside a count, pick another count from the Side-by-Side Comparison menu and the table switches to show what changed product by product. A drop is product you used, a rise is product you received.'] },
      { h: 'Export', p: ['Use Export PDF to print or save a clean copy of any count for your accountant, your insurance file, or a new manager.'] }
    ]);
  },

  // ── Entry ─────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.compareId = null;
    this.renderList();
  },

  renderList() {
    this.actions.innerHTML = '';
    const asc = this.sorted();

    let html;
    if (asc.length === 0) {
      html = '<div class="empty"><div class="empty-title">No counts yet</div>'
        + '<div class="empty-sub">Inventory counts you submit in Take Inventory are listed here, '
        + 'with value, variance, and side-by-side comparison.</div>'
        + '<button class="btn btn-primary" id="ch-take">Take Inventory</button></div>';
    } else {
      const rows = asc.map((c, i) => {
        const prior = i > 0 ? asc[i - 1] : null;
        const variance = prior ? (c.total_value || 0) - (prior.total_value || 0) : null;
        const isLatest = i === asc.length - 1;
        return { c, variance, isLatest };
      }).reverse().map(r => {
        const c = r.c;
        const varCell = r.variance == null
          ? '<span style="color:var(--t4);">-</span>'
          : (r.variance >= 0 ? '+' : '') + App.fmtCurrency(r.variance);
        const status = r.isLatest
          ? '<span class="badge badge-ok">Latest</span>'
          : '<span class="badge badge-dim">Past</span>';
        return '<tr class="ch-row" data-id="' + c.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(c.date) + '</div></td>'
          + '<td>' + esc(c.type || '-') + '</td>'
          + '<td>' + esc(c.counted_by || '-') + '</td>'
          + '<td>' + (c.item_count || (c.items ? c.items.length : 0)) + '</td>'
          + '<td class="val">' + App.fmtCurrency(c.total_value || 0) + '</td>'
          + '<td>' + varCell + '</td>'
          + '<td>' + status + '</td>'
          + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm ch-view" data-id="' + c.id + '">View</button></div></td></tr>';
      }).join('');
      html = '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
        + '<span>Count History</span>'
        + '<button class="btn btn-ghost btn-sm" id="ch-how">How This Works</button></div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Type</th><th>Counted By</th><th>Items</th>'
        + '<th>Total Value</th><th>Variance vs Prior</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.container.onclick = ev => {
      const how = ev.target.closest('#ch-how');
      const view = ev.target.closest('.ch-view');
      const row = ev.target.closest('.ch-row');
      const take = ev.target.closest('#ch-take');
      if (how)  { this.showHowTo(); return; }
      if (view) { this.renderDetail(view.dataset.id); return; }
      if (row)  { this.renderDetail(row.dataset.id); return; }
      if (take) App.navigate('ic-take-inventory');
    };
  },

  // ── Detail ────────────────────────────────────────────────────────────────
  renderDetail(id) {
    const asc = this.sorted();
    const count = asc.find(c => c.id === id);
    if (!count) { this.renderList(); return; }
    this.viewId = id;
    const items = count.items || [];
    const compare = this.compareId ? asc.find(c => c.id === this.compareId) : null;

    this.actions.innerHTML = '';

    const meta = (label, val) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val">' + val + '</div></div>';

    // Case-aware columns: bottle beer is counted and stored in CASES (decimal),
    // shown as full cases / loose bottles / total cases. case_size comes from the
    // snapshot or the live product so older or seeded counts still resolve.
    const prodFor = id => ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id);
    const itemRows = items.map(it => {
      const p = prodFor(it.product_id);
      const caseSize = it.case_size_at_count || (p && p.case_size) || 0;
      const isCaseBeer = (it.category === 'Bottle Beer' || (p && p.category === 'Bottle Beer')) && caseSize > 0;
      const totalCases = it.total || 0;
      const whole = isCaseBeer ? (it.cases != null ? it.cases : Math.floor(totalCases)) : 0;
      const loose = isCaseBeer ? (it.loose != null ? it.loose : Math.round((totalCases - Math.floor(totalCases)) * caseSize)) : 0;
      const fullCol = isCaseBeer ? (whole + ' cases') : (it.fulls || 0);
      const openCol = isCaseBeer ? (loose + ' loose') : (it.partial || 0).toFixed(1);
      const totalCol = isCaseBeer
        ? (totalCases.toFixed(2) + ' cases')
        : (totalCases.toFixed(1) + (p ? ' ' + (App.productUnit(p) || '') : ''));
      const unitCostCol = it.unit_cost != null
        ? App.fmtCurrency(it.unit_cost)
        : '<span style="color:var(--t4);">-</span>';
      return '<tr>'
        + '<td><div class="val">' + esc(it.name) + '</div>'
        + (it.notes ? '<div style="font-size:10px;color:var(--t3);">' + esc(it.notes) + '</div>' : '') + '</td>'
        + '<td>' + esc(it.category || '-') + '</td>'
        + '<td>' + fullCol + '</td>'
        + '<td>' + openCol + '</td>'
        + '<td class="val">' + totalCol + '</td>'
        + '<td>' + unitCostCol + '</td>'
        + '<td>' + (it.value != null ? App.fmtCurrency(it.value) : '<span style="color:var(--t4);">-</span>') + '</td>'
        + '</tr>';
    }).join('');

    // Compare dropdown — every other count
    const others = asc.filter(c => c.id !== id);
    const cmpOpts = '<option value="">Compare to another count...</option>'
      + others.map(c => '<option value="' + c.id + '"' + (this.compareId === c.id ? ' selected' : '') + '>'
          + esc(c.type) + ', ' + this.fmtDate(c.date) + '</option>').join('');

    // When a comparison count is picked, the Counted Items card swaps its table
    // for the side-by-side comparison in place (the dropdown stays at the top), so
    // the action happens right where the operator selected it.
    let bodyTable, bodyNote = '';
    if (compare) {
      const prodForCmp = pid => ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === pid);
      const map = {};
      (count.items || []).forEach(it => { map[it.product_id] = map[it.product_id] || { name: it.name, unit: App.productUnit(prodForCmp(it.product_id)) }; map[it.product_id].a = (map[it.product_id].a || 0) + (it.total || 0); });
      (compare.items || []).forEach(it => { map[it.product_id] = map[it.product_id] || { name: it.name, unit: App.productUnit(prodForCmp(it.product_id)) }; map[it.product_id].b = (map[it.product_id].b || 0) + (it.total || 0); });
      const older = new Date(compare.created_at || compare.date) < new Date(count.created_at || count.date);
      const cmpRows = Object.values(map).map(m => {
        const a = m.a || 0, b = m.b || 0, change = a - b;
        const u = m.unit ? ' ' + m.unit : '';
        return '<tr><td><div class="val">' + esc(m.name) + '</div></td>'
          + '<td>' + esc(b.toFixed(1) + u) + '</td>'
          + '<td>' + esc(a.toFixed(1) + u) + '</td>'
          + '<td class="' + (change < 0 ? 'neg' : change > 0 ? 'pos' : '') + '">' + (change > 0 ? '+' : '') + esc(change.toFixed(1) + u) + '</td>'
          + '</tr>';
      }).join('');
      bodyTable = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Product</th><th>' + esc(this.fmtDate(compare.date)) + '</th>'
        + '<th>' + esc(this.fmtDate(count.date)) + '</th><th>Change</th>'
        + '</tr></thead><tbody>' + cmpRows + '</tbody></table></div>';
      bodyNote = '<div style="font-size:11px;color:var(--t3);margin-top:10px;">'
        + (older
            ? 'A negative change is product used between the two counts. A positive change is product received.'
            : 'Comparing against a more recent count, a positive change means this count held more on hand.')
        + '</div>';
    } else {
      bodyTable = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Product</th><th>Category</th><th>Full</th><th>Open</th><th>Total</th><th>Unit Cost</th><th>Value</th>'
        + '</tr></thead><tbody>' + itemRows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>' + esc(count.type || 'Inventory') + ' Count &middot; ' + this.fmtDate(count.date) + '</span>'
      + '<button class="btn btn-ghost btn-sm" id="ch-export">Export PDF</button></div>'
      + '<div class="calc" style="margin-bottom:0;">'
      + meta('Counted By', esc(count.counted_by || '-'))
      + meta('Products', count.item_count || items.length)
      + meta('Total Value', App.fmtCurrency(count.total_value || 0))
      + meta('Locations', esc((count.locations || []).join(', ') || '-'))
      + '</div></div>'
      + '<div class="card"><div class="card-title">' + (compare ? 'Comparison' : 'Counted Items') + '</div>'
      + '<div class="form-row" style="margin-bottom:14px;"><div class="f" style="width:280px;">'
      + '<label>Side-by-Side Comparison</label><select id="ch-compare">' + cmpOpts + '</select></div></div>'
      + bodyTable + bodyNote + '</div>'
      + '</div>';

    this.container.onclick = null;
    document.getElementById('ch-export')?.addEventListener('click', () => window.print());
    document.getElementById('ch-compare')?.addEventListener('change', e => {
      this.compareId = e.target.value || null;
      this.renderDetail(id);
    });
  }
};
