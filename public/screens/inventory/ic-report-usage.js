'use strict';

/* ── Inventory Control — Usage Report (reads ic_counts + ic_deliveries) ───────
   Usage = Starting Stock + Purchases − Ending Stock, measured between two
   consecutive inventory counts. Pure consumption: per-product data, category
   totals, and period-over-period history. Rankings live in the Movement Report,
   on-hand value in the Stock Report, leaks in the Variance Report.

   Tabbed shell mirrors Labor Tip History: a .ch-tabs switcher over a stats
   card, a Filter heading with Export, the controls-only filter card, then the
   data card. The period + category/location filters are global to the report,
   so they persist across tab switches. */

S.InventoryUsageReport = {
  tab: 'usage',
  endCountId: null,
  catFilter: '',
  locFilter: '',

  TABS: [['usage', 'Usage Data'], ['totals', 'Usage Totals'], ['history', 'Usage History']],

  countsAsc() {
    return [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort(App.cmpOldest);
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
      { p: ['Usage is what you actually burned through between two counts. Bar Cop figures it for you. Starting stock plus what you received minus what was left equals what you used. No POS needed, just your counts. Every product is measured in its own stock unit, so liquor and wine show up in bottles, draft in kegs, and bottle beer in cases.'] },
      { h: 'The Math, Spelled Out', p: ['Take a single product across one period. You counted forty bottles of Tito\'s at the front bar to start. A Republic National delivery brought in two cases, so twenty four bottles in. At the next count you had eighteen bottles left. Usage is forty plus twenty four minus eighteen, which is forty six bottles poured through. Bar Cop runs that for every product and every period off your counts and deliveries. A product only shows up for a period if it was in both the start and the end count; miss it on either one and it drops off that period, since there is no honest way to measure usage on a product you only counted once.'] },
      { h: 'Pick A Period', p: ['Step through your count periods with the arrows up top to choose which two counts to measure between, and the Latest button snaps back to your most recent. Everything on the page recomputes for what you pick. If you count weekly, each period is a week, and the report holds every period you have counted so you can compare a slow Tuesday-to-Tuesday against a festival week.'] },
      { h: 'The Three Views', p: ['Usage Data is the per-product breakdown, grouped by category, with the cost and theoretical sales behind each one. Usage Totals rolls the period up by category, so you see at a glance whether liquor or draft moved the most money. Usage History shows usage cost and theoretical profit for every period so you can watch the trend over time.'] },
      { h: 'What Theoretical Means', p: ['Theoretical sales and profit are what the product you used should have rung up at menu price, before comps and waste. It is the ceiling, the best case if every ounce sold and nothing got spilled, comped, or over-poured. The Variance Report compares it against your real POS sales to find the leaks. A 750ml bottle of Tito\'s poured at a 1.5 oz spec is about seventeen pours, so forty six bottles is your theoretical pour count times your well price. That is the number reality gets measured against.'] }
    ]);
  },

  // ── shared markup helpers (mirror Tip History) ──────────────────────────────
  tabBar() {
    return '<div class="ch-tabs no-print">'
      + this.TABS.map(([k, label]) => '<button class="ch-tab' + (this.tab === k ? ' on' : '') + '" data-tab="' + esc(k) + '">' + esc(label) + '</button>').join('')
      + '</div>';
  },
  statItem(label, val, cls) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
  },
  statsCard(items) {
    return '<div class="card"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">'
      + '<div style="flex:1;display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div>'
      + '</div></div>';
  },
  dataCard(headers, rowsHtml, fixedColgroup) {
    return '<div class="card" style="overflow-x:auto;"><table class="row-list"'
      + (fixedColgroup ? ' style="table-layout:fixed;width:100%;"' : '') + '>'
      + (fixedColgroup || '') + '<thead><tr>'
      + headers + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
  },
  // Product column fixed-wide; the nine data columns share the rest equally, so
  // every category table lines its columns up with the ones above and below it.
  usageColgroup() {
    let cols = '<col style="width:200px;"/>';
    for (let i = 1; i < 10; i++) cols += '<col/>';
    return '<colgroup>' + cols + '</colgroup>';
  },
  noRow(cols, msg) {
    return '<tr><td colspan="' + cols + '" style="color:var(--t3);padding:12px 8px;">'
      + esc(msg || 'No products match this period and filter. Both counts must include the same products.') + '</td></tr>';
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
      App.setupCard(this.container, {
        title: 'Usage Report',
        lead: 'Usage shows what you actually went through between two counts, with the cost and theoretical sales behind each product.',
        steps: [
          { title: 'Take two inventory counts', desc: 'Usage is measured between two counts. Submit at least two and this report fills in.', btn: 'Take Inventory', screen: 'ic-take-inventory', done: false }
        ]
      });
      return;
    }

    const period = this.currentPeriod();
    const rows = this.filtered(period.rows);

    const totCost = rows.reduce((s, r) => s + (r.usageCost || 0), 0);
    const totSales = rows.reduce((s, r) => s + (r.theoSales || 0), 0);
    const totProfit = rows.reduce((s, r) => s + (r.theoProfit || 0), 0);
    const statsCard = this.statsCard(
      this.statItem('Products', rows.length)
      + this.statItem('Usage Cost', App.fmtCurrency(totCost))
      + this.statItem('Theo Sales', App.fmtCurrency(totSales))
      + this.statItem('Theo Profit', App.fmtCurrency(totProfit), totProfit >= 0 ? 'good' : 'warn'));

    // Period = a windowed stepper (‹ prev · current · next ›, like the Build
    // Schedule week selector), so a long count history never becomes a wall of
    // chips. No category filter — the Usage Data list groups by category instead.
    // The History tab is all-periods, so it shows no period stepper.
    const filterArea = this.tab === 'history'
      ? '<div class="no-print" style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:24px 0 12px;">'
        + '<button class="btn btn-ghost btn-sm" id="ur-export">Export PDF</button></div>'
      : '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 12px;">'
        + this.periodStepper(period)
        + '<button class="btn btn-ghost btn-sm" id="ur-export">Export PDF</button>'
        + '</div>';

    this.container.innerHTML = '<div class="screen">'
      + this.tabBar()
      + statsCard
      + filterArea
      + this.tabBody(rows)
      + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#ur-export')) { App.exportPDF({ title: 'Usage Report', root: this.container }); return; }
      const tab = ev.target.closest('.ch-tab');
      if (tab) { this.tab = tab.dataset.tab; this.draw(); return; }
      if (ev.target.closest('#ur-period-prev')) { this.stepPeriod(-1); return; }
      if (ev.target.closest('#ur-period-next')) { this.stepPeriod(1); return; }
      if (ev.target.closest('#ur-period-latest')) { this.endCountId = null; this.catFilter = ''; this.locFilter = ''; this.draw(); return; }
    };
  },

  // Single-pill period selector, exactly like the Inventory cockpit week selector:
  // the selected period in one pill (newest tagged NOW), step arrows outside that
  // grey at each end, and a Latest snap once you've stepped back.
  periodStepper(period) {
    const ids = this.countsAsc().slice(1).map(c => c.id);   // end-count ids, oldest → newest
    const len = ids.length;
    let selIdx = ids.indexOf(period.endC.id);
    if (selIdx < 0) selIdx = len - 1;
    const isNewest = selIdx >= len - 1, atOldest = selIdx <= 0;
    const label = (this.fmtDate(period.startC.date) + ' - ' + this.fmtDate(period.endC.date)).toUpperCase();
    const nowBadge = isNewest ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const prevBtn = atOldest
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&lsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm" id="ur-period-prev" aria-label="Older period" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = isNewest
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm" id="ur-period-next" aria-label="Newer period" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + esc(label) + nowBadge + '</span>';
    const latestBtn = isNewest ? '' : '<button class="btn btn-ghost btn-sm" id="ur-period-latest" style="margin-left:4px;">Latest</button>';
    return '<div style="display:inline-flex;align-items:center;gap:8px;">' + prevBtn + pill + nextBtn + latestBtn + '</div>';
  },

  // Step the selected period one older (-1) or newer (+1) through the count list.
  stepPeriod(delta) {
    const asc = this.countsAsc();
    const ids = asc.slice(1).map(c => c.id);  // end-count ids, oldest → newest
    if (ids.length === 0) return;
    const period = this.currentPeriod();
    let selIdx = period ? ids.indexOf(period.endC.id) : ids.length - 1;
    if (selIdx < 0) selIdx = ids.length - 1;
    const ni = selIdx + delta;
    if (ni < 0 || ni >= ids.length) return;
    this.endCountId = ids[ni];
    this.catFilter = ''; this.locFilter = '';
    this.draw();
  },

  tabBody(rows) {
    if (this.tab === 'totals')  return this.tabTotals(rows);
    if (this.tab === 'history') return this.tabHistory();
    return this.tabUsage(rows);
  },

  num(v, d) { return v == null ? '<span style="color:var(--t4);">-</span>' : Number(v).toFixed(d == null ? 1 : d); },
  cur(v) { return v == null ? '<span style="color:var(--t4);">-</span>' : App.fmtCurrency(v); },

  tabUsage(rows) {
    const headers = '<th>Product</th><th>Unit</th><th>Start</th><th>Purch</th><th>End</th><th>Used</th><th>Servings</th><th>Usage Cost</th><th>Theo Sales</th><th>Theo Profit</th>';
    // Everything after the Product column; each category table puts the category
    // name into the first header ("Liquor", "Wine", ...).
    const restHeaders = '<th>Unit</th><th>Start</th><th>Purch</th><th>End</th><th>Used</th><th>Servings</th><th>Usage Cost</th><th>Theo Sales</th><th>Theo Profit</th>';
    if (!rows.length) return this.dataCard(headers, this.noRow(10));
    const rowHtml = r => '<tr>'
      + '<td><div class="val">' + esc(r.name) + '</div></td>'
      + '<td style="color:var(--t3);font-size:11px;">' + esc(App.unitAbbr(App.productUnit(r.product)) || '-') + '</td>'
      + '<td>' + this.num(r.starting) + '</td>'
      + '<td>' + this.num(r.purchases) + '</td>'
      + '<td>' + this.num(r.ending) + '</td>'
      + '<td class="val">' + this.num(r.used) + '</td>'
      + '<td>' + this.num(r.poursMade, 0) + '</td>'
      + '<td>' + this.cur(r.usageCost) + '</td>'
      + '<td>' + this.cur(r.theoSales) + '</td>'
      + '<td class="' + (r.theoProfit != null ? (r.theoProfit >= 0 ? 'pos' : 'neg') : '') + '">' + this.cur(r.theoProfit) + '</td>'
      + '</tr>';
    // Group the full list by category (CAT_ORDER first, extras after), products
    // name-sorted within each, a category subheading before each block.
    const ORDER = ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
    const byCat = {};
    rows.forEach(r => { const c = r.category || 'Uncategorized'; (byCat[c] = byCat[c] || []).push(r); });
    const cats = Object.keys(byCat).sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      return ((ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)) || a.localeCompare(b);
    });
    return cats.map(c => {
      const catRows = byCat[c].slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      return this.dataCard('<th>' + esc(c) + '</th>' + restHeaders, catRows.map(rowHtml).join(''), this.usageColgroup());
    }).join('');
  },

  tabTotals(rows) {
    const headers = '<th>Category</th><th>Usage Cost</th><th>Theo Sales</th><th>Theo Profit</th>';
    if (!rows.length) return this.dataCard(headers, this.noRow(4));
    const byCat = {};
    rows.forEach(r => {
      const c = r.category || 'Uncategorized';
      byCat[c] = byCat[c] || { cost: 0, sales: 0, profit: 0 };
      byCat[c].cost += r.usageCost || 0; byCat[c].sales += r.theoSales || 0; byCat[c].profit += r.theoProfit || 0;
    });
    const catRows = Object.keys(byCat).sort().map(c => '<tr><td><div class="val">' + esc(c) + '</div></td>'
      + '<td>' + this.cur(byCat[c].cost) + '</td><td>' + this.cur(byCat[c].sales) + '</td>'
      + '<td class="' + (byCat[c].profit >= 0 ? 'pos' : 'neg') + '">' + this.cur(byCat[c].profit) + '</td></tr>').join('');
    return this.dataCard(headers, catRows);
  },

  tabHistory() {
    const headers = '<th>Period</th><th>Products</th><th>Usage Cost</th><th>Theo Profit</th>';
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
    if (!pairs.length) return this.dataCard(headers, this.noRow(4));
    const body = pairs.reverse().map(p => '<tr>'
      + '<td><div class="val">' + this.fmtDate(p.start.date) + ' - ' +this.fmtDate(p.end.date) + '</div></td>'
      + '<td>' + p.count + '</td>'
      + '<td>' + App.fmtCurrency(p.cost) + '</td>'
      + '<td class="' + (p.profit >= 0 ? 'pos' : 'neg') + '">' + App.fmtCurrency(p.profit) + '</td></tr>').join('');
    return this.dataCard(headers, body);
  }
};
