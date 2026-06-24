'use strict';

/* ── Cash Recovery — Purchasing ───────────────────────────────────────────────
   The deep view behind the cockpit's "order to par, not to fear" step. How many
   weeks of inventory you are carrying versus what you actually use, which
   categories are overstocked, and what the next order to par costs by vendor.
   The point: buy what you use, not a number that feels safe, so cash stops
   piling up on the shelf. Reads CashEngine, writes nothing; the order itself is
   placed in the Order Sheet. */

S.CashPurchasing = {
  TARGET_WEEKS: 3,

  showHowTo() {
    App.showHelpModal('How Purchasing Works', [
      { p: ['Over-ordering is the quiet way cash gets trapped. Every case you buy ahead of when you need it is money off your account and onto the shelf. This view shows how many weeks of inventory you are carrying against what you actually use, so you can order to par instead of to a number that feels safe.'] },
      { h: 'Weeks On Hand', p: ['Bar Cop divides what you are holding by what you use in a week. Around two to three weeks is healthy for most bars. Well above that and you have cash sitting still that you could be using elsewhere. The category table shows where the overstock is, so you know which order to tighten first.'] },
      { h: 'Order To Par', p: ['The reorder list is what it costs to bring everything back to par this week, grouped by vendor. Place it in the Order Sheet. If a category keeps coming in overstocked, the par is too high; cut it in Dynamic Pars and the orders right-size themselves.'] },
      { h: 'Buy On Your Cash Cycle', p: ['Consolidating to fewer, fuller orders and timing them to land near when your sales come in keeps more cash in your account longer. The week-ahead read on the cockpit lines the buys up against the cash coming in.'] }
    ]);
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    const o = CashEngine.overOrder(this.TARGET_WEEKS);
    const cats = CashEngine.categoryBreakdown(this.TARGET_WEEKS);
    const reorder = CashEngine.reorderToPar();

    if (!o.hasData) {
      container.innerHTML = '<div class="screen">' + this.statStrip(o, reorder)
        + '<div class="card" style="margin-top:16px;"><div style="font-size:13px;color:var(--t2);line-height:1.7;">Once you have two counts, Bar Cop shows how many weeks of inventory you are carrying and flags the cash tied up beyond what you use.</div>'
        + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" data-go="ic-order-sheet">Open Order Sheet</button></div></div></div>';
      this.wire();
      return;
    }

    container.innerHTML = '<div class="screen">'
      + this.statStrip(o, reorder)
      + '<div class="sh" style="margin:20px 0 8px;">Where You Are Overstocked</div>'
      + this.catCard(cats)
      + '<div class="sh" style="margin:22px 0 8px;">Order to Par This Week</div>'
      + this.reorderCard(reorder)
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">'
      +   '<button class="btn btn-ghost btn-sm" data-go="ic-order-sheet">Open Order Sheet</button>'
      +   '<button class="btn btn-ghost btn-sm" data-go="ic-par-suggestions">Adjust Pars</button>'
      + '</div>'
      + '</div>';
    this.wire();
  },

  statStrip(o, reorder) {
    const item = (label, val, cls) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
    const div = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 20px;"></div>';
    const woh = o.weeksOnHand != null ? o.weeksOnHand.toFixed(1) + 'w' : '-';
    return '<div style="display:flex;align-items:center;flex-wrap:wrap;background:var(--bg);border:1px solid var(--b-edge);border-radius:var(--r);padding:18px 22px;">'
      + item('Weeks On Hand', woh, o.excess > 0 ? 'warn' : '')
      + div + item('Tied Beyond ' + this.TARGET_WEEKS + 'w', o.excess > 0 ? App.fmtCurrency(o.excess, 0) : '$0')
      + div + item('Order to Par', reorder.total > 0 ? App.fmtCurrency(reorder.total, 0) : '-')
      + '</div>';
  },

  catCard(cats) {
    const head = '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:10px;padding:9px 14px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);border-bottom:1px solid var(--b2);">'
      + '<div>Category</div><div style="text-align:right;">On Hand</div><div style="text-align:right;">Weeks</div><div style="text-align:right;">Over</div></div>';
    if (!cats.length) return '<div class="card" style="padding:0;overflow:hidden;">' + head + '<div style="padding:16px 14px;font-size:12px;color:var(--t3);">No category value yet.</div></div>';
    const rows = cats.map((c, i) => {
      const woh = c.weeksOnHand != null ? c.weeksOnHand.toFixed(1) : '-';
      const warn = c.excess > 0;
      return '<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:10px;padding:11px 14px;align-items:center;' + (i < cats.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + 'background:' + (i % 2 ? 'var(--bg)' : 'transparent') + ';">'
        + '<div style="font-size:13px;color:var(--t1);">' + esc(c.cat) + '</div>'
        + '<div style="text-align:right;font-size:12px;color:var(--t2);">' + App.fmtCurrency(c.value, 0) + '</div>'
        + '<div style="text-align:right;font-size:12px;font-weight:600;color:' + (warn ? 'var(--amber)' : 'var(--t2)') + ';">' + woh + '</div>'
        + '<div style="text-align:right;font-size:13px;font-weight:600;color:' + (warn ? 'var(--gold)' : 'var(--t4)') + ';">' + (c.excess > 0 ? App.fmtCurrency(c.excess, 0) : '-') + '</div>'
        + '</div>';
    }).join('');
    return '<div class="card" style="padding:0;overflow:hidden;">' + head + rows + '</div>';
  },

  reorderCard(reorder) {
    if (!reorder.count) {
      return '<div class="card"><div style="font-size:12px;color:var(--t2);">Everything is at or above par. Nothing to order to par right now, which is exactly where you want to be.</div></div>';
    }
    const rows = reorder.vendors.map((v, i) =>
      '<div style="display:flex;align-items:center;gap:12px;padding:11px 0;' + (i < reorder.vendors.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
      + '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;color:var(--t1);">' + esc(v.vendor) + '</div>'
      + '<div style="font-size:11px;color:var(--t3);">' + v.items + ' item' + (v.items === 1 ? '' : 's') + ' below par</div></div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:20px;font-weight:600;color:var(--t1);white-space:nowrap;">' + App.fmtCurrency(v.cost, 0) + '</div></div>').join('');
    return '<div class="card">'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:4px;">Bringing everything to par runs <strong style="color:var(--gold);">' + App.fmtCurrency(reorder.total, 0) + '</strong> across ' + reorder.count + ' item' + (reorder.count === 1 ? '' : 's') + '.</div>'
      + rows + '</div>';
  },

  wire() {
    this.container.onclick = ev => {
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
    };
  }
};
