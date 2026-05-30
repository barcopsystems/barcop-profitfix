'use strict';

/* ── Inventory Control — Top Movers (reads ic_counts + ic_deliveries) ─────────
   Ranks products by how much moved (units used and usage cost) over a count
   period, and trends each product against the prior period. */

S.InventoryMoversReport = {
  tab: 'units',
  endCountId: null,
  TABS: [['units','Top by Units'], ['cost','Top by Cost'], ['slow','Slow Movers'], ['trend','Trend vs Prior']],

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

  // Built on App.computeUsagePair. "Used" is floored at zero (a restock/recount
  // period can't show negative usage), in each product's container unit.
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

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="mv-export">Export PDF</button>';
    document.getElementById('mv-export')?.addEventListener('click', () => window.print());
    this.draw();
  },

  draw() {
    const pairs = this.pairs();
    if (pairs.length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Not enough counts yet</div>'
        + '<div class="empty-sub">Movers are measured between two inventory counts. '
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

    const tabs = '<div style="display:flex;gap:2px;border-bottom:1px solid var(--b2);margin-bottom:14px;flex-wrap:wrap;">'
      + this.TABS.map(([k, label]) => {
          const on = k === this.tab;
          return '<button class="mv-tab" data-tab="' + k + '" style="background:none;border:none;'
            + 'border-bottom:2px solid ' + (on ? 'var(--gold)' : 'transparent') + ';'
            + 'color:' + (on ? 'var(--gold)' : 'var(--t3)') + ';font-size:11px;font-weight:700;'
            + 'letter-spacing:0.5px;text-transform:uppercase;padding:9px 13px;cursor:pointer;">' + label + '</button>';
        }).join('') + '</div>';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="form-row" style="margin-bottom:14px;"><div class="f" style="width:260px;">'
      + '<label>Count Period</label><select id="mv-period">' + periodOpts + '</select></div></div>'
      + tabs + '<div id="mv-body">' + this.body(cur, prior) + '</div></div>';

    this.container.onclick = ev => {
      const tab = ev.target.closest('.mv-tab');
      if (tab) { this.tab = tab.dataset.tab; this.draw(); }
    };
    document.getElementById('mv-period')?.addEventListener('change', e => { this.endCountId = e.target.value; this.draw(); });
  },

  body(cur, prior) {
    const rows = this.computeForPair(cur.startC, cur.endC);
    if (this.tab === 'trend') return this.tabTrend(rows, prior);
    if (this.tab === 'cost')  return this.tabRank(rows, 'usageCost', true, 'Top 10 products by usage cost this period.');
    if (this.tab === 'slow')  return this.tabRank(rows, 'used', false, 'Bottom 10 products by units used, your slowest movers.');
    return this.tabRank(rows, 'used', true, 'Top 10 products by units used this period.');
  },

  tabRank(rows, key, desc, caption) {
    const ranked = [...rows].sort((a, b) => desc ? b[key] - a[key] : a[key] - b[key]).slice(0, 10);
    if (!ranked.length) return this.emptyBody();
    const max = Math.max(...ranked.map(r => Math.abs(r[key])), 1);
    const isCost = key === 'usageCost';
    const body = ranked.map(r => {
      const pct = Math.min(100, Math.abs(r[key]) / max * 100);
      const val = isCost ? App.fmtCurrency(r[key]) : esc(App.qtyWithUnit(r.product, r[key]));
      return '<tr><td><div class="val">' + esc(r.name) + '</div>'
        + '<div style="font-size:10px;color:var(--t3);">' + esc(r.category || '') + '</div></td>'
        + '<td style="width:42%;"><div style="display:flex;align-items:center;gap:8px;">'
        + '<div style="flex:1;height:8px;background:var(--input);border-radius:4px;overflow:hidden;">'
        + '<div style="height:100%;width:' + pct + '%;background:var(--gold);"></div></div>'
        + '<span style="font-size:11px;color:var(--t2);white-space:nowrap;">' + val + '</span></div></td>'
        + '<td>' + esc(App.qtyWithUnit(r.product, r.used)) + '</td>'
        + '<td>' + App.fmtCurrency(r.usageCost || 0) + '</td></tr>';
    }).join('');
    return '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">' + caption + '</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>' + (isCost ? 'Usage Cost' : 'Units Used') + '</th><th>Units Used</th><th>Usage Cost</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  tabTrend(curRows, prior) {
    if (!prior) {
      return '<div style="font-size:12px;color:var(--t3);padding:20px 0;text-align:center;">'
        + 'Trend needs a prior count period. Submit a third count to compare two periods.</div>';
    }
    const priorRows = this.computeForPair(prior.startC, prior.endC);
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
    return '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">'
      + 'Units used this period vs the prior period, biggest movement first.</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Product</th><th>Prior Period</th><th>This Period</th><th>Change</th><th>Change %</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  },

  emptyBody() {
    return '<div style="font-size:12px;color:var(--t3);padding:20px 0;text-align:center;">'
      + 'No products were used in this period. Both counts must include the same products.</div>';
  }
};
