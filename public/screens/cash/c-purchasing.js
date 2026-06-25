'use strict';

/* ── Cash Recovery — Purchasing ───────────────────────────────────────────────
   The deep view behind the Close The Week "order to par" step. How many weeks of
   inventory you carry versus what you use, which categories are overstocked, and
   what the next order to par costs by vendor. Built to the report standard (stats
   card + .sh headings + .data-card). Reads CashEngine; the order is placed in the
   Order Sheet. */

S.CashPurchasing = {
  TARGET_WEEKS: 3,

  showHowTo() {
    App.showHelpModal('How Purchasing Works', [
      { p: ['Over-ordering is the quiet way cash gets trapped. Every case you buy ahead of when you need it is money off your account and onto the shelf. This view shows how many weeks of inventory you are carrying against what you actually use, so you order to par instead of to a number that feels safe.'] },
      { h: 'Weeks On Hand', p: ['Bar Cop divides what you are holding by what you use in a week. Around two to three weeks is healthy for most bars. Well above that and you have cash sitting still. The category table shows where the overstock is, so you know which order to tighten first.'] },
      { h: 'Order To Par', p: ['The reorder list is what it costs to bring everything to par this week, grouped by vendor. Place it in the Order Sheet. If a category keeps coming in overstocked, the par is too high; cut it in Dynamic Pars and the orders right-size themselves.'] },
      { h: 'Buy On Your Cash Cycle', p: ['Consolidating to fewer, fuller orders and timing them near when your sales come in keeps more cash in your account longer.'] }
    ]);
  },

  statItem(label, val, cls) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
  },
  statsCard(items) {
    return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>';
  },
  dataCard(headers, rowsHtml) {
    return '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + headers + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>';
  },
  sh(t) { return '<div class="sh" style="margin:24px 0 10px;">' + t + '</div>'; },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const o = CashEngine.overOrder(this.TARGET_WEEKS);
    if (!o.hasData) {
      App.setupCard(this.container, {
        title: 'Purchasing',
        lead: 'Purchasing shows how many weeks of inventory you are carrying against what you use, and what the next order to par costs.',
        steps: [
          { title: 'Take two inventory counts', desc: 'Weeks on hand reads off the usage between two counts. Take them and this fills in.', btn: 'Take Inventory', screen: 'ic-take-inventory', done: false }
        ]
      });
      return;
    }

    const cats = CashEngine.categoryBreakdown(this.TARGET_WEEKS);
    const reorder = CashEngine.reorderToPar();
    const woh = o.weeksOnHand != null ? o.weeksOnHand.toFixed(1) + 'w' : '-';

    const stats = this.statsCard(
      this.statItem('Weeks On Hand', woh, o.excess > 0 ? 'warn' : '')
      + this.statItem('Tied Beyond ' + this.TARGET_WEEKS + 'w', o.excess > 0 ? App.fmtCurrency(o.excess) : '$0.00')
      + this.statItem('Order to Par', reorder.total > 0 ? App.fmtCurrency(reorder.total) : '-'));

    const actionRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin:24px 0 12px;">'
      + '<button class="btn btn-ghost btn-sm" data-go="ic-order-sheet">Open Order Sheet</button>'
      + '<button class="btn btn-ghost btn-sm" data-go="ic-par-suggestions">Adjust Pars</button>'
      + '<button class="btn btn-ghost btn-sm" id="cp-export">Export PDF</button>'
      + '</div>';

    // Where you are overstocked, by category.
    const catHead = '<th>Category</th><th>On Hand</th><th>Weeks</th><th>Over</th>';
    const catRows = cats.length
      ? cats.map(c => {
          const w = c.weeksOnHand != null ? c.weeksOnHand.toFixed(1) : '-';
          const warn = c.excess > 0;
          return '<tr><td style="color:var(--t1);">' + esc(c.cat) + '</td>'
            + '<td class="val">' + App.fmtCurrency(c.value) + '</td>'
            + '<td class="val"' + (warn ? ' style="color:var(--amber);font-weight:600;"' : '') + '>' + w + '</td>'
            + '<td class="val"' + (warn ? ' style="color:var(--gold);font-weight:600;"' : '') + '>' + (c.excess > 0 ? App.fmtCurrency(c.excess) : '-') + '</td></tr>';
        }).join('')
      : '<tr><td colspan="4" style="color:var(--t3);">No category value yet.</td></tr>';

    // The order to par this week, by vendor.
    const venHead = '<th>Vendor</th><th>Below Par</th><th>Cost</th>';
    const venRows = reorder.count
      ? reorder.vendors.map(v => '<tr><td style="color:var(--t1);">' + esc(v.vendor) + '</td>'
          + '<td class="val">' + v.items + '</td>'
          + '<td class="val">' + App.fmtCurrency(v.cost) + '</td></tr>').join('')
      : '<tr><td colspan="3" style="color:var(--t3);">Everything is at or above par. Nothing to order to par right now.</td></tr>';

    this.container.innerHTML = '<div class="screen">'
      + stats + actionRow
      + this.sh('Where You Are Overstocked') + this.dataCard(catHead, catRows)
      + this.sh('Order to Par This Week') + this.dataCard(venHead, venRows)
      + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#cp-export')) { App.exportPDF({ title: 'Purchasing', root: this.container }); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
    };
  }
};
