'use strict';

/* ── Inventory Control — Stock Report (reads ic_counts + ic_deliveries) ───────
   What you have and where your cash sits, from a chosen count: value by
   category, by location, versus the prior count, ranked high/low, plus dead
   stock (value on hand that did not move). Rankings by usage live in the
   Movement Report; consumption in the Usage Report. */

S.InventoryStockReport = {
  tab: 'category',
  countId: null,
  TABS: [
    ['category','By Category','rpt-s-category'],
    ['location','By Location','rpt-s-location'],
    ['vsprior','vs Last Count','rpt-s-prior'],
    ['highest','Highest Value','rpt-s-highest'],
    ['lowest','Lowest Value','rpt-s-lowest'],
    ['dead','Dead Stock','rpt-s-dead']
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
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  itemValue(it) {
    if (it.value != null) return it.value;
    const bc = App.unitCostFromCountItem(it);
    return bc != null ? (it.total || 0) * bc : 0;
  },
  itemLoc(it) {
    const p = this.productById(it.product_id);
    return (p && p.primary_location) ? p.primary_location : 'Unassigned';
  },
  selectedIdx(asc) {
    let i = asc.findIndex(c => c.id === this.countId);
    if (i < 0) i = asc.length - 1;
    return i;
  },

  showHowTo() {
    App.showHelpModal('How the Stock Report Works', [
      { p: ['The Stock Report is a snapshot of what you are holding and what it is worth, taken from one of your counts. It answers one question: where is my cash sitting right now.'] },
      { h: 'Pick A Count', p: ['Use the Count picker to choose which count to read. The whole page reflects that snapshot. Default is your latest.'] },
      { h: 'Where Your Cash Sits', p: ['By Category and By Location show how your stock value splits up, so you see how much is tied up in liquor versus food, or in the walk-in versus the back bar. vs Last Count shows whether your stock value is creeping up, which usually means over-ordering.'] },
      { h: 'Highest, Lowest, And Dead', p: ['Highest and Lowest Value rank the products holding the most and least cash on hand. Dead Stock is the one to watch: product you are holding value in that did not move at all this period. That is dead cash and spoilage risk, your cue to stop re-ordering it or cut it.'] }
    ]);
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
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">No counts yet</div>'
        + '<div class="empty-sub">Stock value is read from an inventory count. '
        + 'Submit a count in Take Inventory to see this report.</div>'
        + '<button class="btn btn-primary" id="sr-take">Take Inventory</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#sr-take')) App.navigate('ic-take-inventory'); };
      return;
    }

    const idx = this.selectedIdx(asc);
    const latest = asc[idx];
    const prior = idx > 0 ? asc[idx - 1] : null;

    const countOpts = asc.map((c, i) =>
      '<option value="' + c.id + '"' + (i === idx ? ' selected' : '') + '>'
      + this.fmtDate(c.date) + ' (' + esc(c.type || 'count') + ')</option>').reverse().join('');

    const controls = '<div class="card no-print"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Stock Report</span>'
      + '<button class="btn btn-ghost btn-sm" id="sr-how">How This Works</button></div>'
      + '<div class="form-row" style="margin-bottom:0;"><div class="f" style="width:260px;">'
      + '<label>Count</label><select id="sr-count">' + countOpts + '</select></div></div></div>';

    this.container.innerHTML = '<div class="screen">' + controls
      + App.reportTabBar(this.TABS, this.tab)
      + App.reportPanel(this.TABS, this.tab, 'sr-export', this.body(latest, prior)) + '</div>';

    this.container.onclick = ev => {
      const how = ev.target.closest('#sr-how');
      const exp = ev.target.closest('#sr-export');
      const tab = ev.target.closest('.rpt-tab');
      if (how) { this.showHowTo(); return; }
      if (exp) { window.print(); return; }
      if (tab) { this.tab = tab.dataset.tab; this.draw(); return; }
    };
    document.getElementById('sr-count')?.addEventListener('change', e => { this.countId = e.target.value; this.draw(); });
  },

  body(latest, prior) {
    const items = latest.items || [];
    switch (this.tab) {
      case 'category': return this.tabGroup(items, it => it.category || 'Uncategorized', 'Category');
      case 'location': return this.tabGroup(items, it => this.itemLoc(it), 'Location');
      case 'vsprior':  return this.tabVsPrior(latest, prior);
      case 'highest':  return this.tabRank(items, true);
      case 'lowest':   return this.tabRank(items, false);
      case 'dead':     return this.tabDead(latest, prior);
      default:         return '';
    }
  },

  tabGroup(items, keyFn, label) {
    if (!items.length) return this.emptyBody();
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
    return '<div class="calc" style="margin-bottom:14px;"><div class="calc-item">'
      + '<div class="calc-label">Total Stock Value</div><div class="calc-val good">' + App.fmtCurrency(total) + '</div></div></div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>' + label + '</th><th>Products</th><th>Total Value</th><th>% of Total</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  },

  tabVsPrior(latest, prior) {
    if (!prior) {
      return '<div style="font-size:12px;color:var(--t3);padding:20px 0;text-align:center;">'
        + 'No earlier count to compare against. Pick a count that has one before it.</div>';
    }
    const sum = c => (c.items || []).reduce((s, it) => s + this.itemValue(it), 0);
    const a = sum(latest), b = sum(prior), change = a - b;
    const catVal = c => {
      const m = {};
      (c.items || []).forEach(it => { const k = it.category || 'Uncategorized'; m[k] = (m[k] || 0) + this.itemValue(it); });
      return m;
    };
    const la = catVal(latest), pb = catVal(prior);
    const cats = [...new Set([...Object.keys(la), ...Object.keys(pb)])].sort();
    const rows = cats.map(c => {
      const av = la[c] || 0, bv = pb[c] || 0, d = av - bv;
      return '<tr><td><div class="val">' + esc(c) + '</div></td>'
        + '<td>' + App.fmtCurrency(bv) + '</td>'
        + '<td>' + App.fmtCurrency(av) + '</td>'
        + '<td class="' + (d > 0 ? 'pos' : d < 0 ? 'neg' : '') + '">' + (d >= 0 ? '+' : '') + App.fmtCurrency(d) + '</td></tr>';
    }).join('');
    return '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Last Count (' + this.fmtDate(prior.date) + ')</div><div class="calc-val">' + App.fmtCurrency(b) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">This Count (' + this.fmtDate(latest.date) + ')</div><div class="calc-val">' + App.fmtCurrency(a) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Change</div><div class="calc-val ' + (change >= 0 ? 'good' : 'warn') + '">' + (change >= 0 ? '+' : '') + App.fmtCurrency(change) + '</div></div>'
      + '</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Category</th><th>Last Count</th><th>This Count</th><th>Change</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  },

  tabRank(items, highest) {
    const ranked = items.map(it => ({ name: it.name, category: it.category, value: this.itemValue(it), total: it.total }))
      .sort((a, b) => highest ? b.value - a.value : a.value - b.value).slice(0, 10);
    if (!ranked.length) return this.emptyBody();
    const max = Math.max(...ranked.map(r => r.value), 1);
    const body = ranked.map(r => {
      const pct = Math.min(100, r.value / max * 100);
      return '<tr><td><div class="val">' + esc(r.name) + '</div>'
        + '<div style="font-size:10px;color:var(--t3);">' + esc(r.category || '') + '</div></td>'
        + '<td style="width:40%;"><div style="display:flex;align-items:center;gap:8px;">'
        + '<div style="flex:1;height:8px;background:var(--input);border-radius:4px;overflow:hidden;">'
        + '<div style="height:100%;width:' + pct + '%;background:var(--gold);"></div></div></div></td>'
        + '<td>' + (r.total != null ? r.total.toFixed(1) : '-') + '</td>'
        + '<td class="val">' + App.fmtCurrency(r.value) + '</td></tr>';
    }).join('');
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Value</th><th>On Hand</th><th>Value</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  tabDead(latest, prior) {
    if (!prior) {
      return '<div style="font-size:12px;color:var(--t3);padding:20px 0;text-align:center;">'
        + 'Dead stock needs a prior count to measure movement. Pick a count that has one before it.</div>';
    }
    const base = App.computeUsagePair(prior, latest, this.deliveries());
    const items = (latest.items || []).map(it => {
      const p = this.productById(it.product_id) || {};
      const used = base[it.product_id] ? Math.max(0, base[it.product_id].rawUsed) : 0;
      return { product: p, name: it.name, category: it.category, total: it.total, value: this.itemValue(it), used };
    }).filter(x => x.value > 0 && x.used <= 0.001).sort((a, b) => b.value - a.value);
    if (!items.length) {
      return '<div style="font-size:12px;color:var(--gold);padding:20px 0;text-align:center;">'
        + 'No dead stock. Everything you are holding value in moved this period.</div>';
    }
    const total = items.reduce((s, x) => s + x.value, 0);
    const body = items.map(x => '<tr><td><div class="val">' + esc(x.name) + '</div>'
      + '<div style="font-size:10px;color:var(--t3);">' + esc(x.category || '') + '</div></td>'
      + '<td>' + esc(App.qtyWithUnit(x.product, x.total)) + '</td>'
      + '<td>' + x.used.toFixed(1) + '</td>'
      + '<td class="val" style="color:var(--red);">' + App.fmtCurrency(x.value) + '</td></tr>').join('');
    return '<div class="calc" style="margin-bottom:14px;"><div class="calc-item">'
      + '<div class="calc-label">Dead Cash On Hand</div><div class="calc-val warn">' + App.fmtCurrency(total) + '</div></div></div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>On Hand</th><th>Used</th><th>Tied-Up Value</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  emptyBody() {
    return '<div style="font-size:12px;color:var(--t3);padding:20px 0;text-align:center;">'
      + 'This count has no items to report.</div>';
  }
};
