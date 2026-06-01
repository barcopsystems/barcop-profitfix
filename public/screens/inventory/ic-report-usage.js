'use strict';

/* ── Inventory Control — Usage Report (reads ic_counts + ic_deliveries) ───────
   Usage = Starting Stock + Purchases − Ending Stock, measured between two
   consecutive inventory counts. Pure consumption: per-product data, category
   totals, and period-over-period history. Rankings live in the Movement Report,
   on-hand value in the Stock Report, leaks in the Variance Report. */

S.InventoryUsageReport = {
  tab: 'usage',
  endCountId: null,
  catFilter: '',
  locFilter: '',

  TABS: [
    ['usage','Usage Data','rpt-u-usage'],
    ['totals','Usage Totals','rpt-u-totals'],
    ['history','Usage History','rpt-u-history']
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

  // ── Usage computation (shared container-unit helper) ──────────────────────
  computeForPair(startC, endC) {
    const base = App.computeUsagePair(startC, endC, this.deliveries());
    const rows = [];
    Object.keys(base).forEach(pid => {
      const b = base[pid];
      const p = b.product || {};
      const used = Math.max(0, b.rawUsed);
      const poursMade = b.servingsPerUnit != null ? used * b.servingsPerUnit : null;
      const usageCost = b.unitCost != null ? used * b.unitCost : null;
      const theoSales = poursMade != null && p.menu_price ? poursMade * p.menu_price : null;
      const theoProfit = theoSales != null && usageCost != null ? theoSales - usageCost : null;
      rows.push({
        pid, product: p, name: b.name, category: b.category,
        locations: (App.productLocations ? App.productLocations(p) : [p.primary_location].filter(Boolean)),
        starting: b.starting, purchases: b.purchases, ending: b.ending, used,
        poursMade, usageCost, theoSales, theoProfit,
        unitCost: (p.unit_cost != null ? p.unit_cost : (b.unitCost != null ? b.unitCost : null)),
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
      (!this.locFilter || (r.locations || []).includes(this.locFilter)));
  },

  showHowTo() {
    App.showHelpModal('How the Usage Report Works', [
      { p: ['Usage is what you actually burned through between two counts. Bar Cop figures it for you: starting stock plus what you received minus what was left equals what you used. No POS needed, just your counts.'] },
      { h: 'Pick A Period', p: ['Use Count Period to choose which two counts to measure between. Filter by Category or Location to narrow it down. Everything on the page recomputes for what you pick.'] },
      { h: 'The Three Views', p: ['Usage Data is the per-product breakdown with the cost and theoretical sales behind each one. Usage Totals rolls the whole period up by category. Usage History shows usage cost and theoretical profit for every period so you can watch the trend.'] },
      { h: 'What Theoretical Means', p: ['Theoretical sales and profit are what the product you used should have rung up at menu price, before comps and waste. It is the ceiling. The Variance Report compares it against your real POS sales to find the leaks.'] }
    ]);
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
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

    const periodOpts = asc.slice(1).map((c, i) => {
      const startC = asc[i];
      return '<option value="' + c.id + '"' + (c.id === period.endC.id ? ' selected' : '') + '>'
        + this.fmtDate(startC.date) + ' &rarr; ' + this.fmtDate(c.date) + '</option>';
    }).reverse().join('');
    const cats = [...new Set(period.rows.map(r => r.category).filter(Boolean))].sort();
    const locs = [...new Set(period.rows.flatMap(r => r.locations || []).filter(Boolean))].sort();
    const catOpts = '<option value="">All categories</option>'
      + cats.map(c => '<option' + (this.catFilter === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
    const locOpts = '<option value="">All locations</option>'
      + locs.map(l => '<option' + (this.locFilter === l ? ' selected' : '') + '>' + esc(l) + '</option>').join('');

    const controls = '<div class="card no-print"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Usage Report</span>'
      + '<button class="btn btn-ghost btn-sm" id="ur-how">How This Works</button></div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;flex-wrap:wrap;">'
      + '<div class="f" style="width:230px;"><label>Count Period</label><select id="ur-period">' + periodOpts + '</select></div>'
      + '<div class="f" style="width:180px;"><label>Category</label><select id="ur-cat">' + catOpts + '</select></div>'
      + '<div class="f" style="width:180px;"><label>Location</label><select id="ur-loc">' + locOpts + '</select></div>'
      + '</div></div>';

    this.container.innerHTML = '<div class="screen">' + controls
      + App.reportTabBar(this.TABS, this.tab)
      + App.reportPanel(this.TABS, this.tab, 'ur-export', this.tabBody(rows, period)) + '</div>';

    this.container.onclick = ev => {
      const how = ev.target.closest('#ur-how');
      const exp = ev.target.closest('#ur-export');
      const tab = ev.target.closest('.rpt-tab');
      if (how) { this.showHowTo(); return; }
      if (exp) { window.print(); return; }
      if (tab) { this.tab = tab.dataset.tab; this.draw(); return; }
    };
    document.getElementById('ur-period')?.addEventListener('change', e => { this.endCountId = e.target.value; this.catFilter = ''; this.locFilter = ''; this.draw(); });
    document.getElementById('ur-cat')?.addEventListener('change', e => { this.catFilter = e.target.value; this.draw(); });
    document.getElementById('ur-loc')?.addEventListener('change', e => { this.locFilter = e.target.value; this.draw(); });
  },

  tabBody(rows, period) {
    switch (this.tab) {
      case 'usage':   return this.tabUsage(rows);
      case 'totals':  return this.tabTotals(rows);
      case 'history': return this.tabHistory();
      default:        return '';
    }
  },

  num(v, d) { return v == null ? '<span style="color:var(--t4);">-</span>' : Number(v).toFixed(d == null ? 1 : d); },
  cur(v) { return v == null ? '<span style="color:var(--t4);">-</span>' : App.fmtCurrency(v); },

  tabUsage(rows) {
    if (!rows.length) return this.emptyRows();
    const body = rows.map(r => '<tr>'
      + '<td><div class="val">' + esc(r.name) + '</div></td>'
      + '<td style="color:var(--t3);font-size:11px;">' + esc(App.productUnit(r.product) || '-') + '</td>'
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
      + '<th>Product</th><th>Unit</th><th>Start</th><th>Purch</th><th>End</th><th>Used</th>'
      + '<th>Servings</th><th>Usage Cost</th><th>Theo Sales</th><th>Theo Profit</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  tabTotals(rows) {
    if (!rows.length) return this.emptyRows();
    const sum = k => rows.reduce((s, r) => s + (r[k] || 0), 0);
    const totCost = sum('usageCost');
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
      + '<div class="calc-item"><div class="calc-label">Total Usage Cost</div><div class="calc-val">' + App.fmtCurrency(totCost) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Theoretical Sales</div><div class="calc-val">' + App.fmtCurrency(totSales) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Theoretical Profit</div><div class="calc-val ' + (totProfit >= 0 ? 'good' : 'warn') + '">' + App.fmtCurrency(totProfit) + '</div></div>'
      + '</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Category</th><th>Usage Cost</th><th>Theo Sales</th><th>Theo Profit</th></tr></thead><tbody>' + catRows + '</tbody></table></div>';
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
      + '<td><div class="val">' + this.fmtDate(p.start.date) + ' &rarr; ' + this.fmtDate(p.end.date) + '</div></td>'
      + '<td>' + p.count + '</td>'
      + '<td>' + App.fmtCurrency(p.cost) + '</td>'
      + '<td class="' + (p.profit >= 0 ? 'pos' : 'neg') + '">' + App.fmtCurrency(p.profit) + '</td></tr>').join('');
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Period</th><th>Products</th><th>Usage Cost</th><th>Theo Profit</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  emptyRows() {
    return '<div style="font-size:12px;color:var(--t3);padding:20px 0;text-align:center;">'
      + 'No products match this period and filter. Both counts must include the same products.</div>';
  }
};
