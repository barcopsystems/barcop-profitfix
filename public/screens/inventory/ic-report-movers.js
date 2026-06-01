'use strict';

/* ── Inventory Control — Movement Report (ic_counts + ic_deliveries) ──────────
   Velocity: fast and slow movers ranked by DOLLARS (so a cheap high-volume item
   and a pricey low-volume one compare fairly), trend versus the prior period,
   and usage spend by vendor. The only home for rankings — on-hand value lives in
   the Stock Report, raw consumption in the Usage Report. */

S.InventoryMoversReport = {
  tab: 'fast',
  endCountId: null,
  catFilter: '',

  TABS: [
    ['fast','Fast Movers','rpt-m-fast'],
    ['slow','Slow Movers','rpt-m-slow'],
    ['trend','Trend vs Prior','rpt-m-trend'],
    ['vendor','Vendor Spend','rpt-m-vendor']
  ],

  countsAsc() {
    return [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
  },
  deliveries() { return ((App.inventoryData && App.inventoryData.ic_deliveries) || []); },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  // "Used" floored at zero, in each product's container unit. usageCost drives
  // every ranking so cross-category comparison is in dollars, not raw units.
  computeForPair(startC, endC) {
    const base = App.computeUsagePair(startC, endC, this.deliveries());
    const rows = [];
    Object.keys(base).forEach(pid => {
      const b = base[pid];
      const used = Math.max(0, b.rawUsed);
      rows.push({
        pid, product: b.product, name: b.name, category: b.category,
        used, usageCost: b.unitCost != null ? used * b.unitCost : 0,
        poursMade: b.servingsPerUnit != null ? used * b.servingsPerUnit : null
      });
    });
    return rows;
  },

  pairs() {
    const asc = this.countsAsc();
    const out = [];
    for (let i = 1; i < asc.length; i++) out.push({ startC: asc[i - 1], endC: asc[i] });
    return out;
  },
  byCat(rows) { return this.catFilter ? rows.filter(r => r.category === this.catFilter) : rows; },

  showHowTo() {
    App.showHelpModal('How the Movement Report Works', [
      { p: ['Movement tells you what is flying off the shelf and what is collecting dust. Everything ranks by dollars, not raw units, so a 240-a-week bun does not outrank your scotch. Money is the fair comparison.'] },
      { h: 'Pick A Period', p: ['Use Count Period to choose which two counts to measure between, and Category to focus on one group, like just liquor. Both apply to every view.'] },
      { h: 'Fast And Slow', p: ['Fast Movers are your top products by usage dollars: where your money goes, what to never run out of, and what to watch for theft. Slow Movers are the bottom: cash tied up, spoilage risk, candidates to stop over-ordering or cut.'] },
      { h: 'Trend And Vendor', p: ['Trend vs Prior shows how each product moved this period against the period before, biggest swing first, so you catch an item taking off or falling off early. Vendor Spend groups your usage cost by vendor, which is your leverage when you sit down to negotiate.'] }
    ]);
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const pairs = this.pairs();
    if (pairs.length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Not enough counts yet</div>'
        + '<div class="empty-sub">Movement is measured between two inventory counts. '
        + 'Submit at least two counts in Take Inventory to see this report.</div>'
        + '<button class="btn btn-primary" id="mv-take">Take Inventory</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#mv-take')) App.navigate('ic-take-inventory'); };
      return;
    }

    let idx = pairs.findIndex(p => p.endC.id === this.endCountId);
    if (idx < 0) idx = pairs.length - 1;
    const cur = pairs[idx];
    const prior = idx > 0 ? pairs[idx - 1] : null;

    const periodOpts = pairs.map((p, i) =>
      '<option value="' + p.endC.id + '"' + (i === idx ? ' selected' : '') + '>'
      + this.fmtDate(p.startC.date) + ' &rarr; ' + this.fmtDate(p.endC.date) + '</option>').reverse().join('');
    const allRows = this.computeForPair(cur.startC, cur.endC);
    const cats = [...new Set(allRows.map(r => r.category).filter(Boolean))].sort();
    const catOpts = '<option value="">All categories</option>'
      + cats.map(c => '<option' + (this.catFilter === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');

    const controls = '<div class="card no-print"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Movement Report</span>'
      + '<button class="btn btn-ghost btn-sm" id="mv-how">How This Works</button></div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;flex-wrap:wrap;">'
      + '<div class="f" style="width:260px;"><label>Count Period</label><select id="mv-period">' + periodOpts + '</select></div>'
      + '<div class="f" style="width:180px;"><label>Category</label><select id="mv-cat">' + catOpts + '</select></div>'
      + '</div></div>';

    this.container.innerHTML = '<div class="screen">' + controls
      + App.reportTabBar(this.TABS, this.tab)
      + App.reportPanel(this.TABS, this.tab, 'mv-export', this.body(cur, prior)) + '</div>';

    this.container.onclick = ev => {
      const how = ev.target.closest('#mv-how');
      const exp = ev.target.closest('#mv-export');
      const tab = ev.target.closest('.rpt-tab');
      if (how) { this.showHowTo(); return; }
      if (exp) { App.exportPDF({ title: 'Movement Report' }); return; }
      if (tab) { this.tab = tab.dataset.tab; this.draw(); return; }
    };
    document.getElementById('mv-period')?.addEventListener('change', e => { this.endCountId = e.target.value; this.draw(); });
    document.getElementById('mv-cat')?.addEventListener('change', e => { this.catFilter = e.target.value; this.draw(); });
  },

  body(cur, prior) {
    const rows = this.byCat(this.computeForPair(cur.startC, cur.endC));
    if (this.tab === 'trend')  return this.tabTrend(rows, prior);
    if (this.tab === 'vendor') return this.tabVendor(rows);
    if (this.tab === 'slow')   return this.tabRank(rows, false);
    return this.tabRank(rows, true);
  },

  tabRank(rows, desc) {
    // Only products that actually moved (real dollar usage). A product with
    // zero usage is dead stock, not a slow mover — see the Stock Report.
    const ranked = [...rows].filter(r => r.usageCost != null && r.usageCost > 0)
      .sort((a, b) => desc ? b.usageCost - a.usageCost : a.usageCost - b.usageCost).slice(0, 10);
    if (!ranked.length) return this.emptyBody();
    const max = Math.max(...ranked.map(r => Math.abs(r.usageCost)), 1);
    const body = ranked.map(r => {
      const pct = Math.min(100, Math.abs(r.usageCost) / max * 100);
      return '<tr><td><div class="val">' + esc(r.name) + '</div>'
        + '<div style="font-size:10px;color:var(--t3);">' + esc(r.category || '') + '</div></td>'
        + '<td style="width:44%;"><div style="display:flex;align-items:center;gap:8px;">'
        + '<div style="flex:1;height:8px;background:var(--input);border-radius:4px;overflow:hidden;">'
        + '<div style="height:100%;width:' + pct + '%;background:var(--gold);"></div></div>'
        + '<span style="font-size:11px;color:var(--t2);white-space:nowrap;">' + App.fmtCurrency(r.usageCost) + '</span></div></td>'
        + '<td>' + esc(App.qtyWithUnit(r.product, r.used)) + '</td></tr>';
    }).join('');
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Usage Cost</th><th>Units Used</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  tabVendor(rows) {
    const byVendor = {};
    rows.forEach(r => {
      const v = (r.product && r.product.vendor) || 'Unassigned';
      byVendor[v] = byVendor[v] || { count: 0, cost: 0 };
      byVendor[v].count++; byVendor[v].cost += r.usageCost || 0;
    });
    const list = Object.keys(byVendor).map(v => ({ vendor: v, ...byVendor[v] }))
      .filter(x => x.cost > 0).sort((a, b) => b.cost - a.cost);
    if (!list.length) return this.emptyBody();
    const total = list.reduce((s, x) => s + x.cost, 0);
    const max = list[0].cost || 1;
    const body = list.map(x => {
      const pct = Math.min(100, x.cost / max * 100);
      return '<tr><td><div class="val">' + esc(x.vendor) + '</div></td>'
        + '<td>' + x.count + '</td>'
        + '<td style="width:34%;"><div style="display:flex;align-items:center;gap:8px;">'
        + '<div style="flex:1;height:8px;background:var(--input);border-radius:4px;overflow:hidden;">'
        + '<div style="height:100%;width:' + pct + '%;background:var(--gold);"></div></div></div></td>'
        + '<td class="val">' + App.fmtCurrency(x.cost) + '</td>'
        + '<td>' + (total ? (x.cost / total * 100).toFixed(1) : '0.0') + '%</td></tr>';
    }).join('');
    return '<div class="calc" style="margin-bottom:14px;"><div class="calc-item">'
      + '<div class="calc-label">Total Usage Cost</div><div class="calc-val good">' + App.fmtCurrency(total) + '</div></div></div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Vendor</th><th>Products</th><th>Spend</th><th>Usage Cost</th><th>% of Total</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  tabTrend(curRows, prior) {
    if (!prior) {
      return '<div style="font-size:12px;color:var(--t3);padding:20px 0;text-align:center;">'
        + 'Trend needs a prior count period. Submit a third count to compare two periods.</div>';
    }
    const priorRows = this.byCat(this.computeForPair(prior.startC, prior.endC));
    const priorMap = {};
    priorRows.forEach(r => priorMap[r.pid] = r.used);
    const rows = curRows.map(r => {
      const prev = priorMap[r.pid];
      const change = prev != null ? r.used - prev : null;
      const changePct = prev ? change / prev * 100 : null;
      return { name: r.name, category: r.category, unit: App.productUnit(r.product), prev: prev != null ? prev : null, cur: r.used, change, changePct };
    }).sort((a, b) => Math.abs(b.change || 0) - Math.abs(a.change || 0));
    if (!rows.length) return this.emptyBody();
    const body = rows.map(r => {
      const arrow = r.change == null ? '' : r.change > 0.05 ? '&#9650; ' : r.change < -0.05 ? '&#9660; ' : '';
      const cls = r.change == null ? '' : r.change > 0.05 ? 'pos' : r.change < -0.05 ? 'neg' : '';
      const u = r.unit ? ' ' + r.unit : '';
      return '<tr><td><div class="val">' + esc(r.name) + '</div></td>'
        + '<td>' + (r.prev != null ? esc(r.prev.toFixed(1) + u) : '<span style="color:var(--t4);">new</span>') + '</td>'
        + '<td>' + esc(r.cur.toFixed(1) + u) + '</td>'
        + '<td class="' + cls + '">' + arrow + (r.change != null ? (r.change >= 0 ? '+' : '') + r.change.toFixed(1) : '-') + '</td>'
        + '<td class="' + cls + '">' + (r.changePct != null ? (r.changePct >= 0 ? '+' : '') + r.changePct.toFixed(0) + '%' : '-') + '</td>'
        + '</tr>';
    }).join('');
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Prior Period</th><th>This Period</th><th>Change</th><th>Change %</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  emptyBody() {
    return '<div style="font-size:12px;color:var(--t3);padding:20px 0;text-align:center;">'
      + 'No products moved in this period and filter. Both counts must include the same products.</div>';
  }
};
