'use strict';

/* ── Cash Recovery — Trapped Cash ─────────────────────────────────────────────
   The deep view behind the Close The Week "free up trapped cash" step. Working
   capital stuck on the shelf: dead stock that has not moved, and overstock above
   par. Ranked by the dollars you can free. One page, no tabs: a stats card up
   top, then Dead Stock and Overstock listed below in matching tables (a shared
   fixed colgroup so the columns line up card to card). It diagnoses; the moves
   happen in Dynamic Pars and the menu. Reads CashEngine, writes nothing. */

S.CashTrapped = {
  // Shared column layout, so Dead Stock and Overstock line up for easy reading.
  COLS: '<colgroup><col style="width:24%"><col style="width:15%"><col style="width:18%"><col style="width:17%"><col style="width:13%"><col style="width:13%"></colgroup>',
  HEADERS: '<th>Product</th><th>Category</th><th>Vendor</th><th>On Hand</th><th>Tied Up</th><th>To Free</th>',

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
  dataCard(rowsHtml) {
    return '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
      + this.COLS + '<thead><tr>' + this.HEADERS + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
  },

  rowHtml(it) {
    const unit = App.unitAbbr(App.productUnit(it.p));
    const ohNum = Math.round(it.oh * 10) / 10;
    const ohTxt = ohNum + (unit ? ' ' + esc(unit) : '')
      + (it.kind === 'over' && it.par != null ? ' <span style="color:var(--t4);">/ par ' + (Math.round(it.par * 10) / 10) + '</span>' : '');
    return '<tr>'
      + '<td data-label="Product"><span style="color:var(--t1);">' + esc(it.name) + '</span></td>'
      + '<td data-label="Category">' + esc(it.p.category || '-') + '</td>'
      + '<td data-label="Vendor">' + esc(it.p.vendor || '-') + '</td>'
      + '<td data-label="On Hand" class="val">' + ohTxt + '</td>'
      + '<td data-label="Tied Up" class="val">' + App.fmtCurrency(it.tied) + '</td>'
      + '<td data-label="To Free" class="num" style="color:var(--gold);font-weight:600;">' + App.fmtCurrency(it.free) + '</td>'
      + '</tr>';
  },
  section(title, items, emptyMsg, titleRight) {
    const rows = items.length
      ? items.map(it => this.rowHtml(it)).join('')
      : '<tr><td colspan="6" style="color:var(--t3);">' + emptyMsg + '</td></tr>';
    const head = titleRight
      ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;"><div class="sh" style="margin:0;">' + title + '</div>' + titleRight + '</div>'
      : '<div class="sh" style="margin:24px 0 10px;">' + title + '</div>';
    return head + this.dataCard(rows);
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

    const exportBtn = '<button class="btn btn-ghost btn-sm no-print" id="ct-export">Export PDF</button>';

    const dead = t.items.filter(it => it.kind === 'dead');
    const over = t.items.filter(it => it.kind === 'over');

    this.container.innerHTML = '<div class="screen">'
      + stats
      + this.section('Dead Stock', dead, 'No dead stock right now. Every product moved.', exportBtn)
      + this.section('Overstock', over, 'Nothing above par right now.')
      + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#ct-export')) { App.exportPDF({ title: 'Trapped Cash', root: this.container }); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
    };
  }
};
