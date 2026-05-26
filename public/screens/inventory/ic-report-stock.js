'use strict';

/* ── Inventory Control — Stock Report (reads ic_counts) ───────────────────────
   Current on-hand value from the latest inventory count, viewed by category,
   by location, against the prior count, and ranked highest / lowest value. */

S.InventoryStockReport = {
  tab: 'category',
  TABS: [
    ['category','By Category'], ['location','By Location'], ['vsprior','vs Last Count'],
    ['highest','Highest Value'], ['lowest','Lowest Value']
  ],

  countsAsc() {
    return [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
  },
  productById(id) { return ((App.inventoryData && App.inventoryData.ic_products) || []).find(p => p.id === id); },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  itemValue(it) {
    if (it.value != null) return it.value;
    const bc = App.bottleCostFromCountItem(it);
    return bc != null ? (it.total || 0) * bc : 0;
  },
  itemLoc(it) {
    const p = this.productById(it.product_id);
    return (p && p.primary_location) ? p.primary_location : 'Unassigned';
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="sr-export">Export PDF</button>';
    document.getElementById('sr-export')?.addEventListener('click', () => window.print());
    this.draw();
  },

  draw() {
    const asc = this.countsAsc();
    if (asc.length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">No counts yet</div>'
        + '<div class="empty-sub">Stock value is read from your most recent inventory count. '
        + 'Submit a count in Take Inventory to see this report.</div>'
        + '<button class="btn btn-primary" id="sr-take">Take Inventory</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#sr-take')) App.navigate('ic-take-inventory'); };
      return;
    }

    const latest = asc[asc.length - 1];
    const tabs = '<div style="display:flex;gap:2px;border-bottom:1px solid var(--b2);margin-bottom:14px;flex-wrap:wrap;">'
      + this.TABS.map(([k, label]) => {
          const on = k === this.tab;
          return '<button class="sr-tab" data-tab="' + k + '" style="background:none;border:none;'
            + 'border-bottom:2px solid ' + (on ? 'var(--gold)' : 'transparent') + ';'
            + 'color:' + (on ? 'var(--gold)' : 'var(--t3)') + ';font-size:11px;font-weight:700;'
            + 'letter-spacing:0.5px;text-transform:uppercase;padding:9px 13px;cursor:pointer;">' + label + '</button>';
        }).join('') + '</div>';

    const header = '<div style="font-size:11px;color:var(--t3);margin-bottom:12px;">'
      + 'Based on the ' + esc(latest.type || 'inventory') + ' count from ' + this.fmtDate(latest.date) + '.</div>';

    this.container.innerHTML = '<div class="screen">' + header + tabs
      + '<div id="sr-body">' + this.body(asc) + '</div></div>';

    this.container.onclick = ev => {
      const tab = ev.target.closest('.sr-tab');
      if (tab) { this.tab = tab.dataset.tab; this.draw(); }
    };
  },

  body(asc) {
    const latest = asc[asc.length - 1];
    const prior = asc.length > 1 ? asc[asc.length - 2] : null;
    const items = latest.items || [];
    switch (this.tab) {
      case 'category': return this.tabGroup(items, it => it.category || 'Uncategorized', 'Category');
      case 'location': return this.tabGroup(items, it => this.itemLoc(it), 'Location');
      case 'vsprior':  return this.tabVsPrior(latest, prior);
      case 'highest':  return this.tabRank(items, true);
      case 'lowest':   return this.tabRank(items, false);
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
        + 'Only one count exists. A second count will enable this comparison.</div>';
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
    return '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">'
      + (highest ? 'Top 10 products by current on-hand value.' : 'Bottom 10 products by current on-hand value.')
      + '</div><div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th></th><th>On Hand</th><th>Value</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  emptyBody() {
    return '<div style="font-size:12px;color:var(--t3);padding:20px 0;text-align:center;">'
      + 'The latest count has no items to report.</div>';
  }
};
