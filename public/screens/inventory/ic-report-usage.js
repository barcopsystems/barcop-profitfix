'use strict';

/* ── Inventory Control — Usage Report (reads ic_counts + ic_deliveries) ───────
   Usage = Starting Stock + Purchases − Ending Stock, measured between two
   consecutive inventory counts. Seven views over that computed data. */

S.InventoryUsageReport = {
  tab: 'usage',
  endCountId: null,
  catFilter: '',
  locFilter: '',

  TABS: [
    ['usage','Usage Data'], ['totals','Usage Totals'], ['stock','Stock Values'],
    ['most','Most Used'], ['least','Least Used'], ['history','Usage History'], ['check','Stock Check']
  ],

  countsAsc() {
    return [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
  },
  deliveries() { return ((App.inventoryData && App.inventoryData.ic_deliveries) || []); },
  productById(id) { return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id); },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  // ── Usage computation ─────────────────────────────────────────────────────
  computeForPair(startC, endC) {
    // Sum each product's lines (a product can be counted in multiple
    // locations) into one entry, keeping metadata from the first occurrence.
    const startMap = {}; (startC.items || []).forEach(it => {
      if (startMap[it.product_id]) startMap[it.product_id].total = (startMap[it.product_id].total || 0) + (it.total || 0);
      else startMap[it.product_id] = { ...it };
    });
    const endMap   = {}; (endC.items   || []).forEach(it => {
      if (endMap[it.product_id]) endMap[it.product_id].total = (endMap[it.product_id].total || 0) + (it.total || 0);
      else endMap[it.product_id] = { ...it };
    });
    const dels = this.deliveries().filter(d => d.date > startC.date && d.date <= endC.date);
    const purch = {};
    dels.forEach(d => (d.line_items || []).forEach(li => {
      purch[li.product_id] = (purch[li.product_id] || 0) + App.unitsFromDeliveryLine(li);
    }));
    const rows = [];
    Object.keys(endMap).forEach(pid => {
      if (!startMap[pid]) return;
      const si = startMap[pid], ei = endMap[pid];
      const p = this.productById(pid) || {};
      const starting = si.total || 0, ending = ei.total || 0, purchases = purch[pid] || 0;
      const used = starting + purchases - ending;
      // Servings per inventory unit: bottle beer is counted in cases (case_size
      // bottles per case); everything else by its container (pours_per_container).
      const isCaseBeer = p.category === 'Bottle Beer' && p.case_size > 0;
      const ppc = isCaseBeer ? p.case_size : (p.pours_per_container || null);
      // Per-CONTAINER cost (per case for beer). Live product first, else the
      // count-item snapshot.
      const costPerUnit = (p.unit_cost != null) ? App.unitCost(p) : App.unitCostFromCountItem(ei);
      const unitCost = (p.unit_cost != null) ? p.unit_cost : (ei.unit_cost != null ? ei.unit_cost : null);
      const poursMade = ppc != null ? used * ppc : null;
      const usageCost = costPerUnit != null ? used * costPerUnit : null;
      const theoSales = poursMade != null && p.menu_price ? poursMade * p.menu_price : null;
      const theoProfit = theoSales != null && usageCost != null ? theoSales - usageCost : null;
      rows.push({
        pid, name: ei.name, category: ei.category || p.category || '',
        location: p.primary_location || '', starting, purchases, ending, used,
        poursMade, usageCost, theoSales, theoProfit, unitCost,
        par: p.par_level, reorder: p.reorder_point
      });
    });
    return rows;
  },

  currentPeriod() {
    const asc = this.countsAsc();
    if (asc.length < 2) return null;
    let endIdx = asc.findIndex(c => c.id === this.endCountId);
    if (endIdx < 1) endIdx = asc.length - 1;
    return { startC: asc[endIdx - 1], endC: asc[endIdx], rows: this.computeForPair(asc[endIdx - 1], asc[endIdx]) };
  },

  filtered(rows) {
    return rows.filter(r =>
      (!this.catFilter || r.category === this.catFilter) &&
      (!this.locFilter || r.location === this.locFilter));
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="ur-export">Export PDF</button>';
    document.getElementById('ur-export')?.addEventListener('click', () => window.print());
    this.draw();
  },

  draw() {
    const asc = this.countsAsc();
    if (asc.length < 2) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Not enough counts yet</div>'
        + '<div class="empty-sub">Usage is measured between two inventory counts. '
        + 'Submit at least two counts in Take Inventory to see this report.</div>'
        + '<button class="btn btn-primary" id="ur-take">Take Inventory</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#ur-take')) App.navigate('ic-take-inventory'); };
      return;
    }

    const period = this.currentPeriod();
    const rows = this.filtered(period.rows);

    // controls — period selector + filters
    const periodOpts = asc.slice(1).map((c, i) => {
      const startC = asc[i];
      return '<option value="' + c.id + '"' + (c.id === period.endC.id ? ' selected' : '') + '>'
        + this.fmtDate(startC.date) + ' &rarr; ' + this.fmtDate(c.date) + '</option>';
    }).reverse().join('');
    const cats = [...new Set(period.rows.map(r => r.category).filter(Boolean))].sort();
    const locs = [...new Set(period.rows.map(r => r.location).filter(Boolean))].sort();
    const catOpts = '<option value="">All categories</option>'
      + cats.map(c => '<option' + (this.catFilter === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
    const locOpts = '<option value="">All locations</option>'
      + locs.map(l => '<option' + (this.locFilter === l ? ' selected' : '') + '>' + esc(l) + '</option>').join('');

    const controls = '<div class="form-row" style="gap:16px;margin-bottom:14px;">'
      + '<div class="f" style="width:230px;"><label>Count Period</label><select id="ur-period">' + periodOpts + '</select></div>'
      + '<div class="f" style="width:180px;"><label>Category</label><select id="ur-cat">' + catOpts + '</select></div>'
      + '<div class="f" style="width:180px;"><label>Location</label><select id="ur-loc">' + locOpts + '</select></div>'
      + '</div>';

    const tabs = '<div style="display:flex;gap:2px;border-bottom:1px solid var(--b2);margin-bottom:14px;flex-wrap:wrap;">'
      + this.TABS.map(([k, label]) => {
          const on = k === this.tab;
          return '<button class="ur-tab" data-tab="' + k + '" style="background:none;border:none;'
            + 'border-bottom:2px solid ' + (on ? 'var(--gold)' : 'transparent') + ';'
            + 'color:' + (on ? 'var(--gold)' : 'var(--t3)') + ';font-size:11px;font-weight:700;'
            + 'letter-spacing:0.5px;text-transform:uppercase;padding:9px 13px;cursor:pointer;">' + label + '</button>';
        }).join('') + '</div>';

    this.container.innerHTML = '<div class="screen">' + controls + tabs
      + '<div id="ur-body">' + this.tabBody(rows, period) + '</div></div>';

    this.container.onclick = ev => {
      const tab = ev.target.closest('.ur-tab');
      if (tab) { this.tab = tab.dataset.tab; this.draw(); }
    };
    document.getElementById('ur-period')?.addEventListener('change', e => { this.endCountId = e.target.value; this.catFilter = ''; this.locFilter = ''; this.draw(); });
    document.getElementById('ur-cat')?.addEventListener('change', e => { this.catFilter = e.target.value; this.draw(); });
    document.getElementById('ur-loc')?.addEventListener('change', e => { this.locFilter = e.target.value; this.draw(); });
  },

  // ── Tab bodies ────────────────────────────────────────────────────────────
  tabBody(rows, period) {
    switch (this.tab) {
      case 'usage':   return this.tabUsage(rows);
      case 'totals':  return this.tabTotals(rows);
      case 'stock':   return this.tabStock(period.endC, rows);
      case 'most':    return this.tabRank(rows, true);
      case 'least':   return this.tabRank(rows, false);
      case 'history': return this.tabHistory();
      case 'check':   return this.tabCheck(period.endC, rows);
      default:        return '';
    }
  },

  num(v, d) { return v == null ? '<span style="color:var(--t4);">-</span>' : Number(v).toFixed(d == null ? 1 : d); },
  cur(v) { return v == null ? '<span style="color:var(--t4);">-</span>' : App.fmtCurrency(v); },

  tabUsage(rows) {
    if (!rows.length) return this.emptyRows();
    const body = rows.map(r => '<tr>'
      + '<td><div class="val">' + esc(r.name) + '</div></td>'
      + '<td>' + this.num(r.starting) + '</td>'
      + '<td>' + this.num(r.purchases) + '</td>'
      + '<td>' + this.num(r.ending) + '</td>'
      + '<td class="val">' + this.num(r.used) + '</td>'
      + '<td>' + this.num(r.poursMade, 0) + '</td>'
      + '<td>' + this.cur(r.usageCost) + '</td>'
      + '<td>' + this.cur(r.theoSales) + '</td>'
      + '<td class="' + (r.theoProfit != null ? (r.theoProfit >= 0 ? 'pos' : 'neg') : '') + '">' + this.cur(r.theoProfit) + '</td>'
      + '</tr>').join('');
    return '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Start</th><th>Purch</th><th>End</th><th>Used</th>'
      + '<th>Pours Made</th><th>Usage Cost</th><th>Theo Sales</th><th>Theo Profit</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  tabTotals(rows) {
    if (!rows.length) return this.emptyRows();
    const sum = k => rows.reduce((s, r) => s + (r[k] || 0), 0);
    const totUsed = sum('used'), totCost = sum('usageCost'), totPours = sum('poursMade');
    const totSales = sum('theoSales'), totProfit = sum('theoProfit');
    const byCat = {};
    rows.forEach(r => {
      const c = r.category || 'Uncategorized';
      byCat[c] = byCat[c] || { cost: 0, sales: 0, profit: 0 };
      byCat[c].cost += r.usageCost || 0; byCat[c].sales += r.theoSales || 0; byCat[c].profit += r.theoProfit || 0;
    });
    const catRows = Object.keys(byCat).sort().map(c => '<tr><td><div class="val">' + esc(c) + '</div></td>'
      + '<td>' + this.cur(byCat[c].cost) + '</td><td>' + this.cur(byCat[c].sales) + '</td>'
      + '<td class="' + (byCat[c].profit >= 0 ? 'pos' : 'neg') + '">' + this.cur(byCat[c].profit) + '</td></tr>').join('');
    return '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Total Units Used</div><div class="calc-val">' + totUsed.toFixed(1) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Pours Made</div><div class="calc-val">' + Math.round(totPours) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Usage Cost</div><div class="calc-val">' + App.fmtCurrency(totCost) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Theoretical Sales</div><div class="calc-val">' + App.fmtCurrency(totSales) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Theoretical Profit</div><div class="calc-val ' + (totProfit >= 0 ? 'good' : 'warn') + '">' + App.fmtCurrency(totProfit) + '</div></div>'
      + '</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Category</th><th>Usage Cost</th><th>Theo Sales</th><th>Theo Profit</th></tr></thead><tbody>' + catRows + '</tbody></table></div>';
  },

  tabStock(endC, rows) {
    const ids = new Set(rows.map(r => r.pid));
    const items = (endC.items || []).filter(it => ids.has(it.product_id));
    if (!items.length) return this.emptyRows();
    let total = 0;
    const body = items.map(it => {
      const bc = App.unitCostFromCountItem(it);
      const val = it.value != null ? it.value : (bc != null ? (it.total || 0) * bc : null);
      total += val || 0;
      return '<tr><td><div class="val">' + esc(it.name) + '</div></td>'
        + '<td>' + esc(it.category || '-') + '</td>'
        + '<td>' + this.num(it.total) + '</td>'
        + '<td>' + this.cur(it.unit_cost) + '</td>'
        + '<td class="val">' + this.cur(val) + '</td></tr>';
    }).join('');
    return '<div class="calc" style="margin-bottom:14px;"><div class="calc-item">'
      + '<div class="calc-label">Total Stock Value (' + this.fmtDate(endC.date) + ' count)</div>'
      + '<div class="calc-val good">' + App.fmtCurrency(total) + '</div></div></div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Category</th><th>On Hand</th><th>Unit Cost</th><th>Value</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  tabRank(rows, most) {
    const ranked = [...rows].filter(r => r.used != null)
      .sort((a, b) => most ? b.used - a.used : a.used - b.used).slice(0, 10);
    if (!ranked.length) return this.emptyRows();
    const max = Math.max(...ranked.map(r => Math.abs(r.used)), 1);
    const body = ranked.map(r => {
      const pct = Math.min(100, Math.abs(r.used) / max * 100);
      return '<tr><td><div class="val">' + esc(r.name) + '</div></td>'
        + '<td style="width:38%;"><div style="display:flex;align-items:center;gap:8px;">'
        + '<div style="flex:1;height:8px;background:var(--input);border-radius:4px;overflow:hidden;">'
        + '<div style="height:100%;width:' + pct + '%;background:var(--gold);"></div></div>'
        + '<span style="font-size:11px;color:var(--t2);">' + r.used.toFixed(1) + '</span></div></td>'
        + '<td>' + this.cur(r.usageCost) + '</td></tr>';
    }).join('');
    return '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">'
      + (most ? 'Top 10 products by units used this period.' : 'Bottom 10 products by units used, your slowest movers.')
      + '</div><div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Units Used</th><th>Usage Cost</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  tabHistory() {
    const asc = this.countsAsc();
    const pairs = [];
    for (let i = 1; i < asc.length; i++) {
      const r = this.computeForPair(asc[i - 1], asc[i]);
      pairs.push({
        start: asc[i - 1], end: asc[i], count: r.length,
        cost: r.reduce((s, x) => s + (x.usageCost || 0), 0),
        profit: r.reduce((s, x) => s + (x.theoProfit || 0), 0)
      });
    }
    if (!pairs.length) return this.emptyRows();
    const body = pairs.reverse().map(p => '<tr>'
      + '<td><div class="val">' + this.fmtDate(p.start.start || p.start.date) + ' &rarr; ' + this.fmtDate(p.end.date) + '</div></td>'
      + '<td>' + p.count + '</td>'
      + '<td>' + App.fmtCurrency(p.cost) + '</td>'
      + '<td class="' + (p.profit >= 0 ? 'pos' : 'neg') + '">' + App.fmtCurrency(p.profit) + '</td></tr>').join('');
    return '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">Usage across every count period.</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Period</th><th>Products</th><th>Usage Cost</th><th>Theo Profit</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  tabCheck(endC, rows) {
    const ids = new Set(rows.map(r => r.pid));
    const items = (endC.items || []).filter(it => ids.has(it.product_id)).map(it => {
      const p = this.productById(it.product_id) || {};
      return { name: it.name, onHand: it.total || 0, par: p.par_level, reorder: p.reorder_point };
    });
    if (!items.length) return this.emptyRows();
    const body = items.map(it => {
      let status, cls;
      if (it.reorder != null && it.onHand <= it.reorder) { status = 'Below Reorder'; cls = 'badge-warn'; }
      else if (it.par != null && it.onHand < it.par)     { status = 'Below Par'; cls = 'badge-warn'; }
      else { status = 'OK'; cls = 'badge-ok'; }
      return '<tr><td><div class="val">' + esc(it.name) + '</div></td>'
        + '<td>' + it.onHand.toFixed(1) + '</td>'
        + '<td>' + (it.par != null ? it.par : '-') + '</td>'
        + '<td>' + (it.reorder != null ? it.reorder : '-') + '</td>'
        + '<td><span class="badge ' + cls + '">' + status + '</span></td></tr>';
    }).join('');
    return '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">'
      + 'On-hand from the latest count vs each product\'s par and reorder point.</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>On Hand</th><th>Par</th><th>Reorder</th><th>Status</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  emptyRows() {
    return '<div style="font-size:12px;color:var(--t3);padding:20px 0;text-align:center;">'
      + 'No products match this period and filter. Both counts must include the same products.</div>';
  }
};
