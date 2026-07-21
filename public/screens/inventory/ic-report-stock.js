'use strict';

/* ── Inventory Control — Stock Report (reads ic_counts + ic_deliveries) ───────
   What you have and where your cash sits, from a chosen count: value by
   category, by location, versus the prior count, ranked high/low, plus dead
   stock (value on hand that did not move). Rankings by usage and consumption
   live in the Usage Report.

   Tabbed shell mirrors Labor Tip History: a .ch-tabs switcher over a stats
   card, a Filter heading with Export, the controls-only filter card, then the
   data card. Help lives on the nav "i" (see [[help-model]]); showHowTo is its
   content. */

S.InventoryStockReport = {
  tab: 'category',
  countId: null,
  TABS: [
    ['category', 'By Category'], ['location', 'By Location'], ['vsprior', 'vs Last Count'],
    ['highest', 'Highest Value'], ['lowest', 'Lowest Value'], ['dead', 'Dead Stock']
  ],

  countsAsc() {
    return [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort(App.cmpOldest);
  },
  deliveries() { return ((App.inventoryData && App.inventoryData.ic_deliveries) || []); },
  productById(id) { return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id); },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  itemValue(it) {
    if (it.value != null) return it.value;
    const bc = App.unitCostFromCountItem(it);
    return bc != null ? (it.total || 0) * bc : 0;
  },
  itemLoc(it) {
    if (it.location) return it.location;
    const p = this.productById(it.product_id);
    return (p && p.primary_location) ? p.primary_location : 'Unassigned';
  },
  // A count stores one item line PER product PER location. Roll them up to one
  // entry per product (summed value + on-hand) for the per-product views
  // (Products tile, By Category, Highest/Lowest, Dead Stock); By Location keeps
  // the raw per-line data so each location shows its own share.
  // The items of a count that were actually COUNTED. A skipped product stores counted:false with
  // total:0, meaning "I did not touch this shelf" — carrying it here made it a real $0 product in
  // the Products stat, in By Category / By Location, and at the top of "Lowest Value".
  countedItems(c) {
    return ((c && c.items) || []).filter(it => it && it.counted !== false);
  },
  itemsByProduct(items) {
    const m = {};
    (items || []).filter(it => it && it.counted !== false).forEach(it => {
      const k = it.product_id || it.name;
      if (!m[k]) m[k] = { product_id: it.product_id, name: it.name, category: it.category, total: 0, value: 0 };
      m[k].total += (it.total || 0);
      m[k].value += this.itemValue(it);
    });
    return Object.values(m);
  },
  // Quantity with the product's abbreviated container unit (cs / btls / kegs / lbs).
  qtyU(p, n) {
    if (n == null || isNaN(n)) return '-';
    const u = p ? App.unitAbbr(App.productUnit(p)) : '';
    const num = (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(1);
    return u ? (num + ' ' + u) : num;
  },
  selectedIdx(asc) {
    let i = asc.findIndex(c => c.id === this.countId);
    if (i < 0) i = asc.length - 1;
    return i;
  },

  // Single-pill count selector, exactly like the Inventory cockpit week selector:
  // the selected count in one pill (newest tagged NOW), step arrows outside that
  // grey at each end, and a Latest snap once you've stepped back.
  countStepper() {
    const asc = this.countsAsc();
    const len = asc.length;
    const selIdx = this.selectedIdx(asc);
    const isNewest = selIdx >= len - 1, atOldest = selIdx <= 0;
    const label = this.fmtDate(asc[selIdx].date).toUpperCase();
    const nowBadge = isNewest ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const prevBtn = atOldest
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&lsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm" id="sr-count-prev" aria-label="Older count" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = isNewest
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm" id="sr-count-next" aria-label="Newer count" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + esc(label) + nowBadge + '</span>';
    const latestBtn = isNewest ? '' : '<button class="btn btn-ghost btn-sm" id="sr-count-latest" style="margin-left:4px;">Latest</button>';
    return '<div style="display:inline-flex;align-items:center;gap:8px;">' + prevBtn + pill + nextBtn + latestBtn + '</div>';
  },
  stepCount(delta) {
    const asc = this.countsAsc();
    if (!asc.length) return;
    const ni = this.selectedIdx(asc) + delta;
    if (ni < 0 || ni >= asc.length) return;
    this.countId = asc[ni].id;
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How the Stock Report Works', [
      { p: ['The Stock Report is a snapshot of what you are holding and what it is worth, taken from one of your counts. It answers one question: where is my cash sitting right now.'] },
      { h: 'Pick A Count', p: ['Use the arrows up top to step through your counts, or the Latest button to jump to your most recent. The whole page reflects that snapshot.'] },
      { h: 'Where Your Cash Sits', p: ['By Category and By Location show how your stock value splits up, so you see how much is tied up in liquor versus food, or in the walk-in versus the back bar. vs Last Count shows whether your stock value is creeping up, which usually means over-ordering.'] },
      { h: 'Highest, Lowest, And Dead', p: ['Highest and Lowest Value rank the products holding the most and least cash on hand. Dead Stock is the one to watch: product you are holding value in that did not move at all this period. That is dead cash and spoilage risk, your cue to stop re-ordering it or cut it.'] }
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
  dataCard(headers, rowsHtml) {
    return '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + headers + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
  },
  note(text, color) {
    return '<div class="card"><div style="font-size:12px;color:' + (color || 'var(--t3)') + ';padding:8px 0;">' + esc(text) + '</div></div>';
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const asc = this.countsAsc();
    if (asc.length === 0) {
      App.setupCard(this.container, {
        title: 'Stock Report',
        lead: 'The Stock Report shows what your inventory is worth right now and where that cash is sitting.',
        steps: [
          { title: 'Take an inventory count', desc: 'Stock value is read from a count. Take one and this report fills in.', btn: 'Take Inventory', screen: 'ic-take-inventory', done: false }
        ]
      });
      return;
    }

    const idx = this.selectedIdx(asc);
    const latest = asc[idx];
    const prior = idx > 0 ? asc[idx - 1] : null;
    const items = this.countedItems(latest);

    const totalValue = items.reduce((s, it) => s + this.itemValue(it), 0);
    let changeStat = '';
    if (prior) {
      const priorVal = this.countedItems(prior).reduce((s, it) => s + this.itemValue(it), 0);
      const change = totalValue - priorVal;
      changeStat = this.statItem('vs Last Count', (change > 0 ? '+' : '') + App.fmtCurrency(change));
    }
    const statsCard = this.statsCard(
      this.statItem('Stock Value', App.fmtCurrency(totalValue))
      + this.statItem('Products', this.itemsByProduct(items).length)
      + changeStat
      + this.statItem('Count Date', this.fmtDate(latest.date)));

    // Count selector = a two-count scroller (like the Usage/Variance reports),
    // not a dropdown card.
    const filterArea = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 12px;">'
      + this.countStepper()
      + '<button class="btn btn-ghost btn-sm" id="sr-export">Export PDF</button>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">'
      + this.tabBar() + statsCard + filterArea + this.body(latest, prior) + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#sr-export')) { App.exportPDF({ title: 'Stock Report', root: this.container }); return; }
      const tab = ev.target.closest('.ch-tab');
      if (tab) { this.tab = tab.dataset.tab; this.draw(); return; }
      if (ev.target.closest('#sr-count-prev')) { this.stepCount(-1); return; }
      if (ev.target.closest('#sr-count-next')) { this.stepCount(1); return; }
      if (ev.target.closest('#sr-count-latest')) { this.countId = null; this.draw(); return; }
    };
  },

  body(latest, prior) {
    const items = this.countedItems(latest);
    switch (this.tab) {
      case 'location': return this.tabGroup(items, it => this.itemLoc(it), 'Location');
      case 'vsprior':  return this.tabVsPrior(latest, prior);
      case 'highest':  return this.tabRank(this.itemsByProduct(items), true);
      case 'lowest':   return this.tabRank(this.itemsByProduct(items), false);
      case 'dead':     return this.tabDead(latest, prior);
      default:         return this.tabGroup(this.itemsByProduct(items), it => it.category || 'Uncategorized', 'Category');
    }
  },

  tabGroup(items, keyFn, label) {
    const headers = '<th>' + label + '</th><th>Products</th><th>Total Value</th><th>% of Total</th>';
    if (!items.length) return this.dataCard(headers, '<tr><td colspan="4" style="color:var(--t3);padding:12px 8px;">This count has no items to report.</td></tr>');
    const groups = {};
    items.forEach(it => {
      const k = keyFn(it);
      groups[k] = groups[k] || { count: 0, value: 0 };
      groups[k].count++; groups[k].value += this.itemValue(it);
    });
    const total = Object.values(groups).reduce((s, g) => s + g.value, 0);
    const rows = Object.keys(groups).sort((a, b) => groups[b].value - groups[a].value).map(k =>
      '<tr><td><div class="val">' + esc(k) + '</div></td>'
      + '<td>' + groups[k].count + '</td>'
      + '<td class="val">' + App.fmtCurrency(groups[k].value) + '</td>'
      + '<td>' + (total ? (groups[k].value / total * 100).toFixed(1) : '0.0') + '%</td></tr>').join('');
    return this.dataCard(headers, rows);
  },

  tabVsPrior(latest, prior) {
    if (!prior) return this.note('No earlier count to compare against. Pick a count that has one before it.');
    const catVal = c => {
      const m = {};
      this.countedItems(c).forEach(it => { const k = it.category || 'Uncategorized'; m[k] = (m[k] || 0) + this.itemValue(it); });
      return m;
    };
    const la = catVal(latest), pb = catVal(prior);
    const cats = [...new Set([...Object.keys(la), ...Object.keys(pb)])].sort();
    // Stock-value change is neutral: rising value can mean over-ordering, falling
    // can mean running low. The sign carries it; no good/bad color.
    const rows = cats.map(c => {
      const av = la[c] || 0, bv = pb[c] || 0, d = av - bv;
      return '<tr><td><div class="val">' + esc(c) + '</div></td>'
        + '<td>' + App.fmtCurrency(bv) + '</td>'
        + '<td>' + App.fmtCurrency(av) + '</td>'
        + '<td>' + (d > 0 ? '+' : '') + App.fmtCurrency(d) + '</td></tr>';
    }).join('');
    return this.dataCard('<th>Category</th><th>Last Count</th><th>This Count</th><th>Change</th>', rows);
  },

  tabRank(items, highest) {
    const ranked = items.map(it => ({ name: it.name, category: it.category, value: this.itemValue(it), total: it.total, product: this.productById(it.product_id) }))
      .sort((a, b) => highest ? b.value - a.value : a.value - b.value).slice(0, 10);
    const headers = '<th>Product</th><th></th><th>On Hand</th><th>Value</th>';
    if (!ranked.length) return this.dataCard(headers, '<tr><td colspan="4" style="color:var(--t3);padding:12px 8px;">This count has no items to report.</td></tr>');
    const max = Math.max(...ranked.map(r => r.value), 1);
    const body = ranked.map(r => {
      const pct = Math.min(100, r.value / max * 100);
      return '<tr><td><div class="val">' + esc(r.name) + '</div>'
        + '<div style="font-size:10px;color:var(--t3);">' + esc(r.category || '') + '</div></td>'
        + '<td style="width:40%;"><div style="display:flex;align-items:center;gap:8px;">'
        + '<div style="flex:1;height:8px;background:var(--input);border-radius:4px;overflow:hidden;">'
        + '<div style="height:100%;width:' + pct + '%;background:#283742;"></div></div></div></td>'
        + '<td>' + this.qtyU(r.product, r.total) + '</td>'
        + '<td class="val">' + App.fmtCurrency(r.value) + '</td></tr>';
    }).join('');
    return this.dataCard(headers, body);
  },

  tabDead(latest, prior) {
    if (!prior) return this.note('Dead stock needs a prior count to measure movement. Pick a count that has one before it.');
    const base = App.computeUsagePair(prior, latest, this.deliveries());
    const items = this.itemsByProduct(this.countedItems(latest)).map(it => {
      const p = this.productById(it.product_id) || {};
      const b = base[it.product_id];
      // Only products counted in BOTH periods have measurable usage; a product
      // absent from the prior count can't be called dead, so leave it out.
      const used = b ? Math.max(0, b.rawUsed) : null;
      return { product: p, name: it.name, category: it.category, total: it.total, value: this.itemValue(it), used };
    }).filter(x => x.value > 0 && x.used != null && x.used <= 0.001).sort((a, b) => b.value - a.value);
    if (!items.length) return this.note('No dead stock. Everything you are holding value in moved this period.', 'var(--green)');
    const total = items.reduce((s, x) => s + x.value, 0);
    const deadLine = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + this.statItem('Dead Cash On Hand', App.fmtCurrency(total), 'warn') + '</div></div>';
    const body = items.map(x => '<tr><td><div class="val">' + esc(x.name) + '</div>'
      + '<div style="font-size:10px;color:var(--t3);">' + esc(x.category || '') + '</div></td>'
      + '<td>' + this.qtyU(x.product, x.total) + '</td>'
      + '<td>' + x.used.toFixed(1) + '</td>'
      + '<td class="val" style="color:var(--red);">' + App.fmtCurrency(x.value) + '</td></tr>').join('');
    return deadLine + this.dataCard('<th>Product</th><th>On Hand</th><th>Used</th><th>Tied-Up Value</th>', body);
  }
};
