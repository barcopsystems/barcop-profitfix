'use strict';

/* ── Cash Recovery — Trapped Cash ─────────────────────────────────────────────
   The deep view behind the cockpit's "free up trapped cash" step. Working
   capital stuck on the shelf: dead stock that has not moved at all, and
   overstock sitting above par. Ranked by the dollars you can free. It diagnoses;
   the actual moves (cut a par, run a dog down) happen one click away in Dynamic
   Pars and the menu. Reads CashEngine, writes nothing. */

S.CashTrapped = {
  _filter: 'all',   // all | dead | over

  showHowTo() {
    App.showHelpModal('How Trapped Cash Works', [
      { p: ['Trapped cash is working capital sitting on your shelf instead of in your account. Bar Cop reads it off your counts and ranks every product by the dollars you can free, so you work the biggest ones first.'] },
      { h: 'Two Kinds', p: ['Dead stock is product that did not move at all between your last two counts. Its full on-hand value is cash sitting still, and it is also a spoilage risk. Overstock is product you are holding above its par; the cash in the extra is money you spent ahead of when you needed to. Each product counts once, as whichever it is.'] },
      { h: 'What To Do', p: ['For dead stock, move it: feature it, put it on a special, work it into a cocktail, or eighty-six it and stop reordering. For overstock, cut the par so you stop buying ahead of your real usage. The buttons take you straight to Dynamic Pars to cut a par and to the movement report to find the slow ones.'] },
      { h: 'It Sharpens As You Count', p: ['This reads off your last two counts, so the more regularly you count the cleaner it gets. A product with only one count yet does not have the usage history to call dead, so count on a schedule and the trapped number gets honest fast.'] }
    ]);
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    const t = CashEngine.trapped();

    if (!t.hasData) {
      container.innerHTML = '<div class="screen">' + this.statStrip(t)
        + '<div class="card" style="margin-top:16px;"><div style="font-size:13px;color:var(--t2);line-height:1.7;">Bar Cop reads trapped cash off your counts. Take a couple of weekly counts and your dead stock and overstock show up here, ranked by the cash you can free.</div>'
        + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" data-go="ic-take-inventory">Take Inventory</button></div></div></div>';
      this.wire();
      return;
    }

    const items = t.items.filter(it => this._filter === 'all' || it.kind === this._filter);
    const chips = [['all', 'All', t.items.length], ['dead', 'Dead Stock', t.items.filter(i => i.kind === 'dead').length], ['over', 'Overstock', t.items.filter(i => i.kind === 'over').length]];
    const chipRow = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 14px;">'
      + chips.map(([k, label, n]) => '<button class="c-chip btn btn-ghost btn-sm" data-filter="' + k + '" style="' + (this._filter === k ? 'background:var(--gold-tint);border-color:var(--gold);color:var(--t1);' : '') + '">' + label + ' <span style="opacity:.6;">' + n + '</span></button>').join('')
      + '</div>';

    container.innerHTML = '<div class="screen">'
      + this.statStrip(t)
      + '<div class="sh" style="margin:20px 0 8px;">What Is Trapped</div>'
      + chipRow
      + this.listCard(items)
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">'
      +   '<button class="btn btn-ghost btn-sm" data-go="ic-par-suggestions">Cut Pars in Dynamic Pars</button>'
      +   '<button class="btn btn-ghost btn-sm" data-go="ic-report-movers">Dead Stock Report</button>'
      + '</div>'
      + '</div>';
    this.wire();
  },

  statStrip(t) {
    const item = (label, val, cls) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
    const div = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 20px;"></div>';
    return '<div style="display:flex;align-items:center;flex-wrap:wrap;background:var(--bg);border:1px solid var(--b-edge);border-radius:var(--r);padding:18px 22px;">'
      + item('Trapped Cash', t.hasData ? App.fmtCurrency(t.total, 0) : '-', t.total > 0 ? 'warn' : '')
      + div + item('Dead Stock', App.fmtCurrency(t.dead, 0))
      + div + item('Above Par', App.fmtCurrency(t.overPar, 0))
      + '</div>';
  },

  listCard(items) {
    const head = '<div class="tbl-row tbl-head" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:10px;padding:9px 14px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);border-bottom:1px solid var(--b2);">'
      + '<div>Product</div><div style="text-align:right;">On Hand</div><div style="text-align:right;">Tied Up</div><div style="text-align:right;">To Free</div></div>';
    if (!items.length) {
      return '<div class="card" style="padding:0;overflow:hidden;">' + head
        + '<div style="padding:16px 14px;font-size:12px;color:var(--t3);">Nothing in this group right now.</div></div>';
    }
    const rows = items.map((it, i) => {
      const tag = it.kind === 'dead'
        ? '<span style="font-size:9px;font-weight:700;letter-spacing:.5px;color:var(--red);">NOT MOVING</span>'
        : '<span style="font-size:9px;font-weight:700;letter-spacing:.5px;color:var(--amber);">OVER PAR</span>';
      return '<div class="tbl-row" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:10px;padding:11px 14px;align-items:center;' + (i < items.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + 'background:' + (i % 2 ? 'var(--bg)' : 'transparent') + ';">'
        + '<div style="min-width:0;"><div style="font-size:13px;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(it.name) + '</div><div style="margin-top:2px;">' + tag + '</div></div>'
        + '<div style="text-align:right;font-size:12px;color:var(--t2);">' + (Math.round(it.oh * 10) / 10) + (it.kind === 'over' && it.par != null ? ' <span style="color:var(--t4);">/ par ' + it.par + '</span>' : '') + '</div>'
        + '<div style="text-align:right;font-size:12px;color:var(--t2);">' + App.fmtCurrency(it.tied, 0) + '</div>'
        + '<div style="text-align:right;font-size:13px;font-weight:600;color:var(--gold);">' + App.fmtCurrency(it.free, 0) + '</div>'
        + '</div>';
    }).join('');
    return '<div class="card" style="padding:0;overflow:hidden;">' + head + rows + '</div>';
  },

  wire() {
    this.container.onclick = ev => {
      const chip = ev.target.closest('[data-filter]');
      if (chip) { this._filter = chip.dataset.filter; this.render(this.container, this.actions); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
    };
  }
};
