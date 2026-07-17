'use strict';

/* ── Inventory Control — Count History (reads ic_counts) ──────────────────────
   Every submitted inventory count, with value, variance vs the prior count,
   a full per-product detail view, side-by-side comparison against any other
   count, and print-to-PDF export. */

S.InventoryCountHistory = {
  viewId: null,
  compareId: null,
  filterPreset: 'last-4',  // active range chip (weekly cadence)
  _prevPreset: 'last-4',   // range to restore when Custom is toggled closed
  filterFrom: '',          // custom range only
  filterTo: '',
  RANGE_CHIPS: [
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'last-12', label: 'Last 12 Weeks' }, { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],

  counts() {
    return ((App.inventoryData && App.inventoryData.ic_counts) || []);
  },
  sorted() {
    return [...this.counts()].sort(App.cmpOldest);
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // Effective window from the active range chip (preset recomputed off "today" each
  // render); Custom reads the From/To pickers; All clears it.
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  // Range chips left, Export right, directly above the list (the accepted filter
  // model). Custom reveals a bare From/To row. Weekly cadence for inventory counts.
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'ch-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><button class="btn btn-ghost btn-sm" id="ch-list-export">Export PDF</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="ch-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="ch-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
  },

  showHowTo() {
    App.showHelpModal('How Count History Works', [
      { p: ['Count History is the record of every inventory count you have finalized. Each row is one count, with its value, how it moved versus the count before it, and a full breakdown you can open. This is where you come to prove what your stock was worth on any given day and to see how it is trending week over week.'] },
      { h: 'Reading The List', p: [
        'Total Value is what your stock was worth at that count, priced out at your unit cost. Variance vs Prior is the change in value from the count before it. A positive number means you were holding more on hand than the last time you counted, usually right after a big delivery. A negative number means you drew the shelves down, which is normal heading into a busy weekend.',
        'The newest count is tagged Latest. That is the one your dashboard, usage reports, and reorder list are reading from, so keep it current.'
      ] },
      { h: 'Watch The Trend, Not One Row', p: ['One count is a photo. The list is the movie. If The Anchor counts every Sunday night and the total value climbs steadily while sales are flat, cash is piling up on the shelves and you are over-ordering. If it drops faster than your sales can explain, that is the first place a leak shows up. Count on the same day and the same way every week so the trend means something.'] },
      { h: 'The Detail View', p: ['Open any count with View to see every product, what you counted, its unit cost, and its value. Bottle beer shows in cases, liquor and wine in bottles, draft in kegs, and food in its own unit. Any note your counter left on a product rides along under the name, so if someone flagged a cracked case of Modelo or a half keg that read low, you see it here.'] },
      { h: 'Comparing Two Counts', p: [
        'Inside a count, pick another count from the compare dropdown at the top and the table switches to show what changed product by product. A drop is product you used between the two counts. A rise is product you received.',
        'Say you compare last Sunday to this Sunday and a 750ml of your house bourbon shows a drop of four bottles. At 1.5 oz a pour that is roughly 67 pours that should match what the register rang. If the bottles moved but the sales did not, that gap is the conversation you need to have.'
      ] },
      { h: 'Deleting A Count', p: ['Deleting a count is behind the edit permission for a reason. A finalized count feeds your cost of goods, usage, and variance, so pulling one out moves all of those numbers. Only delete a count that was entered wrong and cannot be trusted. If a single product was off, it is cleaner to recount than to throw out the whole record.'] },
      { h: 'Export', p: ['Use Export PDF to save a clean PDF of any count for your accountant at month end, your insurance file, or a new manager who needs to see where the stock stands.'] }
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
      App.setupCard(this.container, {
        title: 'Count History',
        lead: 'Count History is the record of every count you finalize, with its value, how it moved versus the count before, and a full breakdown you can open.',
        steps: [
          { title: 'Take your first count', desc: 'Counts you submit in Take Inventory show up here. Take one to get started.', btn: 'Take Inventory', screen: 'ic-take-inventory', done: false }
        ]
      });
      return;
    } else {
      const { from, to } = this.effectiveRange();
      const ordered = asc.map((c, i) => {
        const prior = i > 0 ? asc[i - 1] : null;
        const variance = prior ? (c.total_value || 0) - (prior.total_value || 0) : null;
        const isLatest = i === asc.length - 1;
        return { c, variance, isLatest };
      }).reverse()
        .filter(r => (!from || (r.c.date || '') >= from) && (!to || (r.c.date || '') <= to));

      const latest = asc[asc.length - 1];
      const statsCard = '<div class="card"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">'
        + '<div style="flex:1;display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Counts</div><div class="calc-val lg">' + asc.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Latest Value</div><div class="calc-val lg">' + App.fmtCurrency(latest.total_value || 0) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Last Count</div><div class="calc-val lg">' + this.fmtDate(latest.date) + '</div></div>'
        + '</div></div></div>';

      const rows = ordered.slice(0, App.listLimit('ic', 'count')).map(r => {
        const c = r.c;
        const varCell = r.variance == null
          ? '<span style="color:var(--t4);">-</span>'
          : (r.variance > 0 ? '+' : '') + App.fmtCurrency(r.variance);
        const status = r.isLatest
          ? '<span style="color:var(--gold);font-weight:700;">Latest</span>'
          : '<span style="color:var(--t3);font-weight:600;">Past</span>';
        return '<tr class="ch-row" data-id="' + c.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(c.date) + '</div></td>'
          + '<td>' + esc(c.type || '-') + '</td>'
          + '<td>' + esc(c.counted_by || '-') + '</td>'
          + '<td>' + (c.item_count || (c.items ? c.items.length : 0)) + '</td>'
          + '<td class="val">' + App.fmtCurrency(c.total_value || 0) + '</td>'
          + '<td>' + varCell + '</td>'
          + '<td>' + status + '</td>'
          + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm ch-view" data-id="' + c.id + '">View</button>'
          + (App.canEdit('ic-count-history') ? '<button class="btn btn-danger btn-sm ch-del" data-id="' + c.id + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');
      const listCard = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Date</th><th>Type</th><th>Counted By</th><th>Items</th>'
        + '<th>Total Value</th><th>Variance vs Prior</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + (rows || '<tr><td colspan="8" style="color:var(--t3);padding:12px 8px;">No counts in this range. Pick a wider range above.</td></tr>') + '</tbody></table></div>'
        + App.showOlderBar('ic', 'count', ordered, this.filterPreset !== 'all');

      html = statsCard + this.filterRow() + listCard;
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const chip = ev.target.closest('.ch-range-chip');
      if (chip) {
        const v = chip.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.renderList();
        return;
      }
      if (ev.target.closest('#ch-list-export')) { this.exportList(); return; }
      const del = ev.target.closest('.ch-del');
      const view = ev.target.closest('.ch-view');
      const row = ev.target.closest('.ch-row');
      const take = ev.target.closest('#ch-take');
      if (del)  { ev.stopPropagation(); this.confirmDelete(del.dataset.id); return; }
      if (view) { const id = view.dataset.id; App.pushView(() => this.renderDetail(id)); return; }
      if (row)  { const id = row.dataset.id;  App.pushView(() => this.renderDetail(id)); return; }
      if (take) App.navigate('ic-take-inventory');
    };
    document.getElementById('ch-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('ch-to')?.addEventListener('change', e => { this.filterTo = e.target.value || ''; this.renderList(); });
  },

  // Export the COMPLETE count list to PDF (every count, not just the on-screen
  // window, which paginates via Show older). Built from an off-screen node.
  exportList() {
    const asc = this.sorted();
    if (asc.length === 0) return;
    const ordered = asc.map((c, i) => {
      const prior = i > 0 ? asc[i - 1] : null;
      const variance = prior ? (c.total_value || 0) - (prior.total_value || 0) : null;
      const isLatest = i === asc.length - 1;
      return { c, variance, isLatest };
    }).reverse();
    const rows = ordered.map(r => {
      const c = r.c;
      const varCell = r.variance == null ? '-' : (r.variance >= 0 ? '+' : '') + App.fmtCurrency(r.variance);
      return '<tr><td>' + this.fmtDate(c.date) + '</td>'
        + '<td>' + esc(c.type || '-') + '</td>'
        + '<td>' + esc(c.counted_by || '-') + '</td>'
        + '<td>' + (c.item_count || (c.items ? c.items.length : 0)) + '</td>'
        + '<td>' + App.fmtCurrency(c.total_value || 0) + '</td>'
        + '<td>' + varCell + '</td>'
        + '<td>' + (r.isLatest ? 'Latest' : 'Past') + '</td></tr>';
    }).join('');
    const node = document.createElement('div');
    node.className = 'screen';
    node.style.cssText = 'position:absolute;left:-99999px;top:0;';
    node.innerHTML = '<div class="card"><div class="card-title">Count History</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Type</th><th>Counted By</th><th>Items</th><th>Total Value</th><th>Variance vs Prior</th><th>Status</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    document.body.appendChild(node);
    Promise.resolve(App.exportPDF({ title: 'Count History', root: node })).finally(() => node.remove());
  },

  // Guarded delete: a count is a finalized record, so removing one is behind
  // the edit permission and an honest confirm because it moves COGS, usage,
  // and variance. The correction path matters more than strict immutability.
  async confirmDelete(id) {
    if (!App.canEdit('ic-count-history')) return;
    if (!(await App.confirmDelete())) return;
    if (!App.inventoryData) return;
    await App.removeRecord('ic', 'count', id);
    this.renderList();
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
    // One count row. The category is the table header (the count groups by
    // category), so there is no Category column here.
    const rowHtml = it => {
      const p = prodFor(it.product_id);
      const caseSize = it.case_size_at_count || (p && p.case_size) || 0;
      // Full / Open / Total via the shared App.countCols so this reads exactly
      // the same as the Take Inventory review and every other inventory section.
      const cols = App.countCols(p, { category: it.category, unit_type: it.unit_type, caseSize, fulls: it.fulls, partial: it.partial, total: it.total, cases: it.cases, loose: it.loose });
      const unitCostCol = it.unit_cost != null
        ? App.fmtCurrency(it.unit_cost)
        : '<span style="color:var(--t4);">-</span>';
      return '<tr>'
        + '<td><div class="val">' + esc(it.name) + '</div>'
        + (it.notes ? '<div style="font-size:10px;color:var(--t3);">' + esc(it.notes) + '</div>' : '') + '</td>'
        + '<td>' + cols.full + '</td>'
        + '<td>' + cols.open + '</td>'
        + '<td class="val">' + cols.total + '</td>'
        + '<td>' + unitCostCol + '</td>'
        + '<td>' + (it.value != null ? App.fmtCurrency(it.value) : '<span style="color:var(--t4);">-</span>') + '</td>'
        + '</tr>';
    };

    // Compare dropdown — the 10 most recent other counts, newest first.
    const others = [...asc].reverse().filter(c => c.id !== id).slice(0, 10);
    const cmpOpts = '<option value="">Compare Count</option>'
      + others.map(c => '<option value="' + c.id + '"' + (this.compareId === c.id ? ' selected' : '') + '>'
          + esc(c.type) + ', ' + this.fmtDate(c.date) + '</option>').join('');

    // When a comparison count is picked, the Counted Items card swaps its table
    // for the side-by-side comparison in place (the dropdown stays at the top), so
    // the action happens right where the operator selected it.
    let bodyTable, bodyNote = '';
    if (compare) {
      const prodForCmp = pid => ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === pid);
      const catFor = (pid, it) => (it && it.category) || (prodForCmp(pid) || {}).category || 'Uncategorized';
      const map = {};
      (count.items || []).forEach(it => { map[it.product_id] = map[it.product_id] || { name: it.name, unit: App.productUnit(prodForCmp(it.product_id)), category: catFor(it.product_id, it) }; map[it.product_id].a = (map[it.product_id].a || 0) + (it.total || 0); });
      (compare.items || []).forEach(it => { map[it.product_id] = map[it.product_id] || { name: it.name, unit: App.productUnit(prodForCmp(it.product_id)), category: catFor(it.product_id, it) }; map[it.product_id].b = (map[it.product_id].b || 0) + (it.total || 0); });
      const older = new Date(compare.created_at || compare.date) < new Date(count.created_at || count.date);
      const cmpRowHtml = m => {
        const a = m.a || 0, b = m.b || 0, change = a - b;
        const u = m.unit ? ' ' + App.unitAbbr(m.unit) : '';
        return '<tr><td><div class="val">' + esc(m.name) + '</div></td>'
          + '<td>' + esc(b.toFixed(1) + u) + '</td>'
          + '<td>' + esc(a.toFixed(1) + u) + '</td>'
          + '<td class="' + (change < 0 ? 'neg' : change > 0 ? 'pos' : '') + '">' + (change > 0 ? '+' : '') + esc(change.toFixed(1) + u) + '</td>'
          + '</tr>';
      };
      // Group the comparison by category too, matching the count view: one table
      // per category, the category in the first header, a shared colgroup.
      const dateB = esc(this.fmtDate(compare.date)), dateA = esc(this.fmtDate(count.date));
      const ORDER = ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
      const byCat = {};
      Object.values(map).forEach(m => { const c = m.category || 'Uncategorized'; (byCat[c] = byCat[c] || []).push(m); });
      const cats = Object.keys(byCat).sort((x, y) => {
        const ix = ORDER.indexOf(x), iy = ORDER.indexOf(y);
        return ((ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy)) || x.localeCompare(y);
      });
      bodyTable = cats.map(c => {
        const ms = byCat[c].slice().sort((x, y) => (x.name || '').localeCompare(y.name || ''));
        return '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
          + '<colgroup><col style="width:260px;"/><col/><col/><col/></colgroup>'
          + '<thead><tr><th>' + esc(c) + '</th><th>' + dateB + '</th><th>' + dateA + '</th><th>Change</th></tr></thead>'
          + '<tbody>' + ms.map(cmpRowHtml).join('') + '</tbody></table></div>';
      }).join('');
      bodyNote = '<div style="font-size:11px;color:var(--t3);margin-top:10px;">'
        + (older
            ? 'A negative change is product used between the two counts. A positive change is product received.'
            : 'Comparing against a more recent count, a positive change means this count held more on hand.')
        + '</div>';
    } else {
      // Organize the count by category: one table per category, the category in
      // the first column header, a shared fixed colgroup so columns stay aligned.
      const ORDER = ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
      const byCat = {};
      items.forEach(it => { const c = it.category || 'Uncategorized'; (byCat[c] = byCat[c] || []).push(it); });
      const cats = Object.keys(byCat).sort((a, b) => {
        const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
        return ((ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)) || a.localeCompare(b);
      });
      bodyTable = cats.map(c => {
        const catItems = byCat[c].slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
          + '<colgroup><col style="width:240px;"/><col/><col/><col/><col/><col/></colgroup>'
          + '<thead><tr><th>' + esc(c) + '</th><th>Full</th><th>Open</th><th>Total</th><th>Unit Cost</th><th>Value</th></tr></thead>'
          + '<tbody>' + catItems.map(rowHtml).join('') + '</tbody></table></div>';
      }).join('');
    }

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + meta('Counted By', esc(count.counted_by || '-'))
      + meta('Products', count.item_count || items.length)
      + meta('Total Value', App.fmtCurrency(count.total_value || 0))
      + meta('Locations', esc((count.locations || []).join(', ') || '-'))
      + meta('Count Date', this.fmtDate(count.date))
      + '</div></div>'
      + '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;flex-wrap:wrap;">'
      + '<select id="ch-compare" class="il-copysel" style="max-width:240px;">' + cmpOpts + '</select>'
      + '<button class="btn btn-ghost btn-sm" id="ch-export">Export PDF</button></div>'
      + bodyTable + bodyNote
      + '</div>';

    this.container.onclick = null;
    document.getElementById('ch-export')?.addEventListener('click', () => App.exportPDF({ title: 'Count History', root: this.container }));
    document.getElementById('ch-compare')?.addEventListener('change', e => {
      this.compareId = e.target.value || null;
      this.renderDetail(id);
    });
  }
};
