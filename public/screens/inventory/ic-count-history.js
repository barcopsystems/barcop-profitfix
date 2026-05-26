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
          + '<td>' + status + '</td></tr>';
      }).join('');
      html = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Type</th><th>Counted By</th><th>Items</th>'
        + '<th>Total Value</th><th>Variance vs Prior</th><th>Status</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.container.onclick = ev => {
      const row = ev.target.closest('.ch-row');
      const take = ev.target.closest('#ch-take');
      if (row)  this.renderDetail(row.dataset.id);
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

    // Export to PDF — top-right, via the app's print stylesheet
    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="ch-export">Export PDF</button>';
    document.getElementById('ch-export')?.addEventListener('click', () => window.print());

    const meta = (label, val) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val">' + val + '</div></div>';

    // Case-aware columns: bottle beer items recorded with case_size show
    // "X cases" / "Y loose" / "Z btl" instead of fulls / partial / total.
    const itemRows = items.map(it => {
      const isCaseBeer = it.case_size_at_count && (it.cases != null || it.loose != null);
      const fullCol = isCaseBeer ? ((it.cases || 0) + ' cases') : (it.fulls || 0);
      const openCol = isCaseBeer ? ((it.loose || 0) + ' loose') : (it.partial || 0).toFixed(1);
      const totalCol = isCaseBeer
        ? ((it.total || 0) + ' btl')
        : (it.total || 0).toFixed(1);
      const unitCostCol = it.unit_cost != null
        ? (App.fmtCurrency(it.unit_cost) + (isCaseBeer ? '<div style="font-size:9px;color:var(--t3);">per case</div>' : ''))
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

    let compareCard = '';
    if (compare) {
      const map = {};
      (count.items || []).forEach(it => { map[it.product_id] = map[it.product_id] || { name: it.name }; map[it.product_id].a = it.total || 0; });
      (compare.items || []).forEach(it => { map[it.product_id] = map[it.product_id] || { name: it.name }; map[it.product_id].b = it.total || 0; });
      const older = new Date(compare.created_at || compare.date) < new Date(count.created_at || count.date);
      const cmpRows = Object.values(map).map(m => {
        const a = m.a || 0, b = m.b || 0, change = a - b;
        return '<tr><td><div class="val">' + esc(m.name) + '</div></td>'
          + '<td>' + b.toFixed(1) + '</td>'
          + '<td>' + a.toFixed(1) + '</td>'
          + '<td class="' + (change < 0 ? 'neg' : change > 0 ? 'pos' : '') + '">' + (change > 0 ? '+' : '') + change.toFixed(1) + '</td>'
          + '</tr>';
      }).join('');
      compareCard = '<div class="card"><div class="card-title">Comparison</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Product</th><th>' + esc(this.fmtDate(compare.date)) + '</th>'
        + '<th>' + esc(this.fmtDate(count.date)) + '</th><th>Change</th>'
        + '</tr></thead><tbody>' + cmpRows + '</tbody></table></div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">'
        + (older
            ? 'A negative change is product used between the two counts. A positive change is product received.'
            : 'Comparing against a more recent count, a positive change means this count held more on hand.')
        + '</div></div>';
    }

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="ch-back">&#8592; Back to Count History</button></div>'
      + '<div class="card"><div class="card-title">' + esc(count.type || 'Inventory') + ' Count &middot; ' + this.fmtDate(count.date) + '</div>'
      + '<div class="calc" style="margin-bottom:0;">'
      + meta('Counted By', esc(count.counted_by || '-'))
      + meta('Products', count.item_count || items.length)
      + meta('Total Value', App.fmtCurrency(count.total_value || 0))
      + meta('Locations', esc((count.locations || []).join(', ') || '-'))
      + '</div></div>'
      + '<div class="card"><div class="card-title">Counted Items</div>'
      + '<div class="form-row" style="margin-bottom:14px;"><div class="f" style="width:280px;">'
      + '<label>Side-by-Side Comparison</label><select id="ch-compare">' + cmpOpts + '</select></div></div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Category</th><th>Full</th><th>Open</th><th>Total</th><th>Unit Cost</th><th>Value</th>'
      + '</tr></thead><tbody>' + itemRows + '</tbody></table></div></div>'
      + compareCard
      + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#ch-back')) { this.compareId = null; this.renderList(); }
    };
    document.getElementById('ch-compare')?.addEventListener('change', e => {
      this.compareId = e.target.value || null;
      this.renderDetail(id);
    });
  }
};
