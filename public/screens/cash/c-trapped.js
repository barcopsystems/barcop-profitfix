'use strict';

/* ── Cash Recovery — Trapped Cash ─────────────────────────────────────────────
   The deep view behind the Close The Week "free up trapped cash" step. Working
   capital stuck on the shelf: dead stock that has not moved, and overstock above
   par. Ranked by the dollars you can free. Built to the report standard (stats
   card + .ch-tabs + .data-card). It diagnoses; the moves happen in Dynamic Pars
   and the menu. Reads CashEngine, writes nothing. */

S.CashTrapped = {
  tab: 'all',

  TABS: [['all', 'All'], ['dead', 'Dead Stock'], ['over', 'Overstock']],

  showHowTo() {
    App.showHelpModal('How Trapped Cash Works', [
      { p: ['Trapped cash is working capital sitting on your shelf instead of in your account. Bar Cop reads it off your counts and ranks every product by the dollars you can free, so you work the biggest ones first.'] },
      { h: 'Two Kinds', p: ['Dead stock is product that did not move at all between your last two counts. Its full on-hand value is cash sitting still, and a spoilage risk. Overstock is product you are holding above its par; the cash in the extra is money you spent ahead of when you needed to. Each product counts once, as whichever it is.'] },
      { h: 'What To Do', p: ['For dead stock, move it: feature it, put it on a special, work it into a cocktail, or eighty-six it and stop reordering. For overstock, cut the par so you stop buying ahead of your real usage. The buttons take you straight to Dynamic Pars and the movement report.'] },
      { h: 'It Sharpens As You Count', p: ['This reads off your last two counts, so the more regularly you count the cleaner it gets. A product with only one count does not have the usage history to call dead, so count on a schedule and the trapped number gets honest fast.'] }
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
  tabBar() {
    return '<div class="ch-tabs no-print">'
      + this.TABS.map(([k, label]) => '<button class="ch-tab' + (this.tab === k ? ' on' : '') + '" data-tab="' + esc(k) + '">' + esc(label) + '</button>').join('')
      + '</div>';
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const t = CashEngine.trapped();
    if (!t.hasData) {
      App.setupCard(this.container, {
        title: 'Trapped Cash',
        lead: 'Trapped Cash shows the working capital sitting on your shelf in dead stock and overstock, ranked by the dollars you can free.',
        steps: [
          { title: 'Take an inventory count', desc: 'Trapped cash reads off your counts. Take a couple and this fills in.', btn: 'Take Inventory', screen: 'ic-take-inventory', done: false }
        ]
      });
      return;
    }

    const stats = this.statsCard(
      this.statItem('Trapped Cash', App.fmtCurrency(t.total), t.total > 0 ? 'warn' : '')
      + this.statItem('Dead Stock', App.fmtCurrency(t.dead))
      + this.statItem('Above Par', App.fmtCurrency(t.overPar)));

    const filterArea = '<div class="no-print" style="display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin:24px 0 12px;">'
      + '<button class="btn btn-ghost btn-sm" data-go="ic-par-suggestions">Cut Pars</button>'
      + '<button class="btn btn-ghost btn-sm" data-go="ic-report-stock">Dead Stock Report</button>'
      + '<button class="btn btn-ghost btn-sm" id="ct-export">Export PDF</button>'
      + '</div>';

    const items = t.items.filter(it => this.tab === 'all' || it.kind === this.tab);
    const headers = '<th>Product</th><th>On Hand</th><th>Tied Up</th><th>To Free</th>';
    const rows = items.length
      ? items.map(it => {
          const tag = it.kind === 'dead'
            ? '<span style="font-size:9px;font-weight:700;letter-spacing:.5px;color:var(--red);">NOT MOVING</span>'
            : '<span style="font-size:9px;font-weight:700;letter-spacing:.5px;color:var(--amber);">OVER PAR</span>';
          const oh = (Math.round(it.oh * 10) / 10) + (it.kind === 'over' && it.par != null ? ' <span style="color:var(--t4);">/ par ' + it.par + '</span>' : '');
          return '<tr><td><div style="color:var(--t1);">' + esc(it.name) + '</div><div style="margin-top:2px;">' + tag + '</div></td>'
            + '<td class="val">' + oh + '</td>'
            + '<td class="val">' + App.fmtCurrency(it.tied) + '</td>'
            + '<td class="num" style="color:var(--gold);font-weight:600;">' + App.fmtCurrency(it.free) + '</td></tr>';
        }).join('')
      : '<tr><td colspan="4" style="color:var(--t3);">Nothing in this group right now.</td></tr>';

    this.container.innerHTML = '<div class="screen">' + this.tabBar() + stats + filterArea + this.dataCard(headers, rows) + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#ct-export')) { App.exportPDF({ title: 'Trapped Cash', root: this.container }); return; }
      const tab = ev.target.closest('.ch-tab');
      if (tab) { this.tab = tab.dataset.tab; this.draw(); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
    };
  }
};
