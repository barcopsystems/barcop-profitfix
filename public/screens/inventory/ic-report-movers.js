'use strict';

/* ── Inventory Control — Movement Report (ic_counts + ic_deliveries) ──────────
   Velocity: fast and slow movers ranked by DOLLARS (so a cheap high-volume item
   and a pricey low-volume one compare fairly), trend versus the prior period,
   and usage spend by vendor. The only home for rankings — on-hand value lives in
   the Stock Report, raw consumption in the Usage Report.

   Tabbed shell mirrors Labor Tip History: a .ch-tabs switcher over a stats
   card, a Filter heading with Export, the controls-only filter card, then the
   data card. Help lives on the nav "i" (see [[help-model]]); showHowTo is its
   content. */

S.InventoryMoversReport = {
  tab: 'fast',
  endCountId: null,

  TABS: [['fast', 'Fast Movers'], ['slow', 'Slow Movers'], ['trend', 'Trend vs Prior'], ['vendor', 'Vendor Spend']],

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
  // Quantity with the product's abbreviated container unit (cs / btls / kegs / lbs).
  qtyU(p, n) {
    if (n == null || isNaN(n)) return '-';
    const u = p ? App.unitAbbr(App.productUnit(p)) : '';
    const num = (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(1);
    return u ? (num + ' ' + u) : num;
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

  showHowTo() {
    App.showHelpModal('How the Movement Report Works', [
      { p: ['Movement tells you what is flying off the shelf and what is collecting dust. Everything ranks by dollars, not raw units, so a 240-a-week bun does not outrank your scotch. Money is the fair comparison.'] },
      { h: 'Pick A Period', p: ['Step through your count periods with the arrows up top to choose which two counts to measure between, and the Latest button snaps back to your most recent. Everything on the page recomputes for what you pick.'] },
      { h: 'Fast And Slow', p: ['Fast Movers are your top products by usage dollars: where your money goes, what to never run out of, and what to watch for theft. Slow Movers are the bottom: cash tied up, spoilage risk, candidates to stop over-ordering or cut. Both rank across every category so the comparison stays fair.'] },
      { h: 'Trend And Vendor', p: ['Trend vs Prior shows how each product moved this period against the period before, grouped by category with the biggest swing first, so you catch an item taking off or falling off early. Vendor Spend groups your usage cost by vendor, which is your edge when you sit down to negotiate.'] }
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
    return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>';
  },
  dataCard(headers, rowsHtml, fixedColgroup) {
    return '<div class="card" style="overflow-x:auto;"><table class="row-list"'
      + (fixedColgroup ? ' style="table-layout:fixed;width:100%;"' : '') + '>'
      + (fixedColgroup || '') + '<thead><tr>'
      + headers + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
  },
  // Trend tables group by category, so they share a fixed colgroup (Product wide,
  // the four data columns equal) and line their columns up down the page.
  trendColgroup() {
    let cols = '<col style="width:200px;"/>';
    for (let i = 1; i < 5; i++) cols += '<col/>';
    return '<colgroup>' + cols + '</colgroup>';
  },
  note(text) {
    return '<div class="card"><div style="font-size:12px;color:var(--t3);padding:8px 0;">' + esc(text) + '</div></div>';
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
      App.setupCard(this.container, {
        title: 'Movement Report',
        lead: 'Movement ranks what is selling fast, what is crawling, and what is sitting dead, so you can tighten ordering.',
        steps: [
          { title: 'Take two inventory counts', desc: 'Movement is measured between two counts. Submit at least two and this report fills in.', btn: 'Take Inventory', screen: 'ic-take-inventory', done: false }
        ]
      });
      return;
    }

    let idx = pairs.findIndex(p => p.endC.id === this.endCountId);
    if (idx < 0) idx = pairs.length - 1;
    const cur = pairs[idx];
    const prior = idx > 0 ? pairs[idx - 1] : null;

    const allRows = this.computeForPair(cur.startC, cur.endC);
    const moved = allRows.filter(r => r.usageCost > 0);
    const totalCost = moved.reduce((s, r) => s + r.usageCost, 0);
    const vendors = new Set(moved.map(r => (r.product && r.product.vendor) || 'Unassigned')).size;
    const statsCard = this.statsCard(
      this.statItem('Usage Cost', App.fmtCurrency(totalCost))
      + this.statItem('Products Moved', moved.length)
      + this.statItem('Vendors', vendors));

    // Period = a windowed stepper (‹ prev · current · next ›, like the Build
    // Schedule week selector / Usage Report), so a long count history never
    // becomes a wall of chips. No category filter — Trend vs Prior groups by
    // category instead, and the rankings compare across every category by design.
    const filterArea = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 12px;">'
      + this.periodStepper(cur)
      + '<button class="btn btn-ghost btn-sm" id="mv-export">Export PDF</button>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">'
      + this.tabBar() + statsCard + filterArea + this.body(cur, prior) + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#mv-export')) { App.exportPDF({ title: 'Movement Report', root: this.container }); return; }
      const tab = ev.target.closest('.ch-tab');
      if (tab) { this.tab = tab.dataset.tab; this.draw(); return; }
      if (ev.target.closest('#mv-period-prev')) { this.stepPeriod(-1); return; }
      if (ev.target.closest('#mv-period-next')) { this.stepPeriod(1); return; }
      if (ev.target.closest('#mv-period-latest')) { this.endCountId = null; this.draw(); return; }
    };
  },

  // Single-pill period selector, exactly like the Inventory cockpit week selector:
  // the selected period in one pill (newest tagged NOW), step arrows outside that
  // grey at each end, and a Latest snap once you've stepped back.
  periodStepper(cur) {
    const ids = this.pairs().map(p => p.endC.id);   // end-count ids, oldest → newest
    const len = ids.length;
    let selIdx = ids.indexOf(cur.endC.id);
    if (selIdx < 0) selIdx = len - 1;
    const isNewest = selIdx >= len - 1, atOldest = selIdx <= 0;
    const label = (this.fmtDate(cur.startC.date) + ' - ' + this.fmtDate(cur.endC.date)).toUpperCase();
    const nowBadge = isNewest ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const prevBtn = atOldest
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&lsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm" id="mv-period-prev" aria-label="Older period" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = isNewest
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm" id="mv-period-next" aria-label="Newer period" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + esc(label) + nowBadge + '</span>';
    const latestBtn = isNewest ? '' : '<button class="btn btn-ghost btn-sm" id="mv-period-latest" style="margin-left:4px;">Latest</button>';
    return '<div style="display:inline-flex;align-items:center;gap:8px;">' + prevBtn + pill + nextBtn + latestBtn + '</div>';
  },

  // Step the selected period one older (-1) or newer (+1) through the count list.
  stepPeriod(delta) {
    const ids = this.pairs().map(p => p.endC.id);  // end-count ids, oldest → newest
    if (!ids.length) return;
    let idx = ids.indexOf(this.endCountId);
    if (idx < 0) idx = ids.length - 1;
    const ni = idx + delta;
    if (ni < 0 || ni >= ids.length) return;
    this.endCountId = ids[ni];
    this.draw();
  },

  body(cur, prior) {
    const rows = this.computeForPair(cur.startC, cur.endC);
    if (this.tab === 'trend')  return this.tabTrend(rows, prior);
    if (this.tab === 'vendor') return this.tabVendor(rows);
    if (this.tab === 'slow')   return this.tabRank(rows, false);
    return this.tabRank(rows, true);
  },

  tabRank(rows, desc) {
    const headers = '<th>Product</th><th></th><th>Units Used</th><th>Usage Cost</th>';
    // Only products that actually moved (real dollar usage). Zero usage is dead
    // stock, not a slow mover — see the Stock Report.
    const ranked = [...rows].filter(r => r.usageCost != null && r.usageCost > 0)
      .sort((a, b) => desc ? b.usageCost - a.usageCost : a.usageCost - b.usageCost).slice(0, 10);
    if (!ranked.length) return this.dataCard(headers, '<tr><td colspan="4" style="color:var(--t3);padding:12px 8px;">No products moved in this period and filter. Both counts must include the same products.</td></tr>');
    const max = Math.max(...ranked.map(r => Math.abs(r.usageCost)), 1);
    const body = ranked.map(r => {
      const pct = Math.min(100, Math.abs(r.usageCost) / max * 100);
      return '<tr><td><div class="val">' + esc(r.name) + '</div>'
        + '<div style="font-size:10px;color:var(--t3);">' + esc(r.category || '') + '</div></td>'
        + '<td style="width:40%;"><div style="display:flex;align-items:center;gap:8px;">'
        + '<div style="flex:1;height:8px;background:var(--input);border-radius:4px;overflow:hidden;">'
        + '<div style="height:100%;width:' + pct + '%;background:var(--t3);"></div></div></div></td>'
        + '<td>' + this.qtyU(r.product, r.used) + '</td>'
        + '<td class="val">' + App.fmtCurrency(r.usageCost) + '</td></tr>';
    }).join('');
    return this.dataCard(headers, body);
  },

  tabVendor(rows) {
    const headers = '<th>Vendor</th><th>Products</th><th></th><th>Usage Cost</th><th>% of Total</th>';
    const byVendor = {};
    rows.forEach(r => {
      const v = (r.product && r.product.vendor) || 'Unassigned';
      byVendor[v] = byVendor[v] || { count: 0, cost: 0 };
      byVendor[v].count++; byVendor[v].cost += r.usageCost || 0;
    });
    const list = Object.keys(byVendor).map(v => ({ vendor: v, ...byVendor[v] }))
      .filter(x => x.cost > 0).sort((a, b) => b.cost - a.cost);
    if (!list.length) return this.dataCard(headers, '<tr><td colspan="5" style="color:var(--t3);padding:12px 8px;">No usage cost to attribute in this period and filter.</td></tr>');
    const total = list.reduce((s, x) => s + x.cost, 0);
    const max = list[0].cost || 1;
    const body = list.map(x => {
      const pct = Math.min(100, x.cost / max * 100);
      return '<tr><td><div class="val">' + esc(x.vendor) + '</div></td>'
        + '<td>' + x.count + '</td>'
        + '<td style="width:34%;"><div style="display:flex;align-items:center;gap:8px;">'
        + '<div style="flex:1;height:8px;background:var(--input);border-radius:4px;overflow:hidden;">'
        + '<div style="height:100%;width:' + pct + '%;background:var(--t3);"></div></div></div></td>'
        + '<td class="val">' + App.fmtCurrency(x.cost) + '</td>'
        + '<td>' + (total ? (x.cost / total * 100).toFixed(1) : '0.0') + '%</td></tr>';
    }).join('');
    return this.dataCard(headers, body);
  },

  tabTrend(curRows, prior) {
    const headers = '<th>Product</th><th>Prior Period</th><th>This Period</th><th>Change</th><th>Change %</th>';
    if (!prior) return this.note('Trend needs a prior count period. Submit a third count to compare two periods.');
    const priorRows = this.computeForPair(prior.startC, prior.endC);
    const priorMap = {};
    priorRows.forEach(r => priorMap[r.pid] = r.used);
    const rows = curRows.map(r => {
      const prev = priorMap[r.pid];
      const change = prev != null ? r.used - prev : null;
      const changePct = prev ? change / prev * 100 : null;
      return { name: r.name, category: r.category, unit: App.unitAbbr(App.productUnit(r.product)), prev: prev != null ? prev : null, cur: r.used, change, changePct };
    });
    if (!rows.length) return this.dataCard(headers, '<tr><td colspan="5" style="color:var(--t3);padding:12px 8px;">No products moved in this period.</td></tr>');
    // Direction shown by an arrow + sign; usage going up or down is an observation
    // to read, not inherently good or bad, so the value stays neutral (no color).
    const restHeaders = '<th>Prior Period</th><th>This Period</th><th>Change</th><th>Change %</th>';
    const rowHtml = r => {
      const arrow = r.change == null ? '' : r.change > 0.05 ? '&#9650; ' : r.change < -0.05 ? '&#9660; ' : '';
      const u = r.unit ? ' ' + r.unit : '';
      return '<tr><td><div class="val">' + esc(r.name) + '</div></td>'
        + '<td>' + (r.prev != null ? esc(r.prev.toFixed(1) + u) : '<span style="color:var(--t4);">new</span>') + '</td>'
        + '<td>' + esc(r.cur.toFixed(1) + u) + '</td>'
        + '<td>' + arrow + (r.change != null ? (r.change >= 0 ? '+' : '') + r.change.toFixed(1) : '-') + '</td>'
        + '<td>' + (r.changePct != null ? (r.changePct >= 0 ? '+' : '') + r.changePct.toFixed(0) + '%' : '-') + '</td>'
        + '</tr>';
    };
    // Group by category (CAT_ORDER first, extras after), biggest swing first
    // within each, the category name alone in the first header — mirrors Usage Data.
    const ORDER = ['Liquor', 'Wine', 'Bottle Beer', 'Draft Beer', 'Food', 'Misc'];
    const byCat = {};
    rows.forEach(r => { const c = r.category || 'Uncategorized'; (byCat[c] = byCat[c] || []).push(r); });
    const cats = Object.keys(byCat).sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      return ((ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)) || a.localeCompare(b);
    });
    return cats.map(c => {
      const catRows = byCat[c].slice().sort((a, b) => Math.abs(b.change || 0) - Math.abs(a.change || 0));
      return this.dataCard('<th>' + esc(c) + '</th>' + restHeaders, catRows.map(rowHtml).join(''), this.trendColgroup());
    }).join('');
  }
};
