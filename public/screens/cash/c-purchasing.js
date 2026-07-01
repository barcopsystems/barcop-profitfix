'use strict';

/* ── Cash Recovery — Purchasing ───────────────────────────────────────────────
   The deep view behind the Close The Week "order to par" step, and the one place
   that reads your buying BEHAVIOR over time (Trapped Cash shows the shelf right
   now, the cockpit shows this week's to-dos, the Order Sheet places the order).
   Buy vs Use up top (are you buying ahead of your sales, read over a labeled
   multi-week window), weeks on hand by category, then a vendor purchasing
   scorecard. The two tables share one fixed colgroup so the columns line up.
   Reads CashEngine; the order is placed in the Order Sheet. */

S.CashPurchasing = {
  TARGET_WEEKS: 3,
  // Shared column layout for both tables, so they line up for easy scanning.
  COLS: '<colgroup><col style="width:26%"><col style="width:14%"><col style="width:16%"><col style="width:15%"><col style="width:15%"><col style="width:14%"></colgroup>',

  showHowTo() {
    App.showHelpModal('How Purchasing Works', [
      { p: ['Over-ordering is the quiet way cash gets trapped. Every case you buy ahead of when you need it is money off your account and onto the shelf. This view reads how you buy, so you order to par instead of to a number that feels safe.'] },
      { h: 'Buy vs Use', p: ['Across your recent count periods, this is the dollars you bought against the dollars you used. Buy more than you use and the difference is cash sitting on your shelf. Reading it over a few weeks instead of one keeps a slow delivery week from looking like a problem, and a habit of buying ahead shows up before it ties up real money.'] },
      { h: 'Weeks On Hand By Category', p: ['Bar Cop divides what you are holding by what you use in a week. Around two to three weeks is healthy for most bars. The table shows where the cash is parked, the weekly burn, and how far each category sits over target, so you know which order to tighten first.'] },
      { h: 'Your Vendors', p: ['The scorecard reads off your deliveries: how often you order from each vendor, what you spend, the average order, the terms you have on file, and what it costs to bring their items to par this week. Use it to consolidate to fewer fuller orders and to get more vendors onto terms, both of which keep cash in your account longer.'] }
    ]);
  },

  statItem(label, val, cls) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
  },
  statsCard(items) {
    return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>';
  },
  fixedTable(headerCells, bodyRows) {
    return '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
      + this.COLS + '<thead><tr>' + headerCells + '</tr></thead><tbody>' + bodyRows + '</tbody></table></div>';
  },
  sh(t, right) {
    return right
      ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;"><div class="sh" style="margin:0;">' + t + '</div>' + right + '</div>'
      : '<div class="sh" style="margin:24px 0 10px;">' + t + '</div>';
  },
  fmtDay(ymd) { if (!ymd) return ''; const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); },

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
        lead: 'Purchasing reads how you buy: dollars purchased against dollars used, where you carry too much, and what your next order to par costs by vendor.',
        steps: [
          { title: 'Take two inventory counts', desc: 'Buy vs Use and weeks on hand read off the usage between two counts. Take them and this fills in.', btn: 'Take Inventory', screen: 'ic-take-inventory', done: false }
        ]
      });
      return;
    }

    const reorder = CashEngine.reorderToPar();
    const woh = o.weeksOnHand != null ? o.weeksOnHand.toFixed(1) + 'w' : '-';
    const stats = this.statsCard(
      this.statItem('Weeks On Hand', woh, o.excess > 0 ? 'warn' : '')
      + this.statItem('Tied Beyond ' + this.TARGET_WEEKS + 'w', o.excess > 0 ? App.fmtCurrency(o.excess) : '$0.00')
      + this.statItem('Order to Par', reorder.total > 0 ? App.fmtCurrency(reorder.total) : '-'));

    const exportBtn = '<button class="btn btn-ghost btn-sm no-print" id="cp-export">Export PDF</button>';
    const orderSheetBtn = '<button class="btn btn-ghost btn-sm no-print" data-go="ic-order-sheet">Open Order Sheet</button>';

    this.container.innerHTML = '<div class="screen">'
      + stats
      + this.buyVsUseCard()
      + this.sh('Weeks On Hand By Category', '<div style="display:flex;gap:8px;">' + orderSheetBtn + exportBtn + '</div>') + this.catCard()
      + this.sh('Vendor Purchasing') + this.vendorCard(CashEngine.vendorPurchasing(90))
      + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#cp-export')) { App.exportPDF({ title: 'Purchasing', root: this.container }); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
    };
  },

  // ── Buy vs Use: bought minus used over a labeled multi-week window (so one slow
  //    delivery week never reads as $0), plus paired Bought/Used bars per period. ─
  buyVsUseCard() {
    const bu = CashEngine.buyVsUse(6);
    if (!bu.hasData || !bu.periods.length) return '';
    const ps = bu.periods;
    const bought = ps.reduce((s, p) => s + p.bought, 0);
    const used = ps.reduce((s, p) => s + p.used, 0);
    const net = bought - used;
    const overBuy = net > 25, drawDown = net < -25;
    const netCol = overBuy ? 'var(--amber)' : drawDown ? 'var(--green)' : 'var(--t1)';
    const netLabel = net >= 0 ? 'Onto the Shelf' : 'Off the Shelf';
    const stat = (label, val, sub, cls) => '<div style="flex:0 0 auto;"><div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:28px;font-weight:600;line-height:1;color:' + (cls || 'var(--t1)') + ';">' + val + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:4px;">' + sub + '</div></div>';
    const op = sym => '<div style="align-self:center;font-size:20px;color:var(--t4);">' + sym + '</div>';
    const legKey = (col, label) => '<span style="display:inline-flex;align-items:center;gap:6px;font-size:10px;color:var(--t3);"><span style="width:9px;height:9px;border-radius:2px;background:' + col + ';"></span>' + label + '</span>';
    const legend = ps.length >= 2 ? '<div class="no-print" style="display:flex;gap:16px;flex-shrink:0;">' + legKey('var(--sel-active-bg)', 'Bought') + legKey('var(--t3)', 'Used') + '</div>' : '';
    const caption = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">'
      + '<div style="font-size:11px;color:var(--t3);">Your last ' + ps.length + ' count period' + (ps.length === 1 ? '' : 's') + ', ' + this.fmtDay(ps[0].start) + ' to ' + this.fmtDay(ps[ps.length - 1].end) + '.</div>'
      + legend + '</div>';
    const note = overBuy
      ? 'You bought <strong style="color:var(--amber);">' + App.fmtCurrency(net) + '</strong> more than you used over this stretch. That cash is sitting on your shelf. Order to par to close the gap.'
      : drawDown
        ? 'You used <strong style="color:var(--green);">' + App.fmtCurrency(Math.abs(net)) + '</strong> more than you bought over this stretch, drawing the shelf down and pulling cash back to your account. Keep ordering to par so you do not run short.'
        : 'You bought just about what you used over this stretch. Your buying is matching your sales.';
    return '<div class="card">' + caption
      + '<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Bought', App.fmtCurrency(bought), 'Purchases received')
      + op('&minus;')
      + stat('Used', App.fmtCurrency(used), 'Cost of goods sold')
      + op('=')
      + stat(netLabel, App.fmtCurrency(Math.abs(net)), 'Cash ' + (net >= 0 ? 'parked' : 'recovered'), netCol)
      + '</div>'
      + this.buyTrend(ps)
      + '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--b2);font-size:12px;color:var(--t2);line-height:1.6;">' + note + '</div>'
      // PDF-only summary (the Bought/Used/Net figures are styled spans the exporter skips).
      + '<div class="pdf-para" style="display:none;">Buy vs Use. Bought ' + App.fmtCurrency(bought) + ', Used ' + App.fmtCurrency(used) + ', ' + netLabel + ' ' + App.fmtCurrency(Math.abs(net)) + '. ' + note + '</div>'
      + '</div>';
  },
  // Paired Bought / Used bars per count period: compare the two side by side. A
  // period with no Bought bar is a week you took no delivery. Neutral tones, the
  // judgment lives in the headline net and the note.
  buyTrend(periods) {
    if (!periods || periods.length < 2) return '';
    const max = Math.max(1, ...periods.flatMap(p => [p.bought, p.used]));
    const H = 46, BOUGHT = 'var(--sel-active-bg)', USED = 'var(--t3)';
    const bar = (v, col) => '<div style="width:14px;height:' + (v > 0 ? Math.max(3, Math.round(v / max * H)) : 0) + 'px;background:' + col + ';border-radius:2px 2px 0 0;"></div>';
    const cols = periods.map(p =>
      '<div style="flex:1;min-width:0;text-align:center;">'
      + '<div style="height:' + H + 'px;display:flex;align-items:flex-end;justify-content:center;gap:5px;">' + bar(p.bought, BOUGHT) + bar(p.used, USED) + '</div>'
      + '<div style="height:1px;background:var(--b2);"></div>'
      + '<div style="font-size:9px;color:var(--t4);margin-top:6px;white-space:nowrap;">' + this.fmtDay(p.end) + '</div></div>').join('');
    return '<div class="no-print" style="margin-top:18px;">'
      + '<div style="display:flex;align-items:flex-end;gap:10px;">' + cols + '</div></div>';
  },

  // ── Weeks on hand by category: where the cash is parked, the weekly burn, the
  //    target supply, and what sits over it. ─────────────────────────────────────
  catCard() {
    const cats = CashEngine.categoryBreakdown(this.TARGET_WEEKS);
    const head = '<th>Category</th><th>On Hand</th><th>Weekly Use</th><th>Weeks</th><th>Target ' + this.TARGET_WEEKS + 'w</th><th>Over</th>';
    const rows = cats.length
      ? cats.map(c => {
          const w = c.weeksOnHand != null ? c.weeksOnHand.toFixed(1) : '-';
          const target = (c.weeklyCogs || 0) * this.TARGET_WEEKS;
          const over = c.excess > 0;
          return '<tr>'
            + '<td data-label="Category"><span style="color:var(--t1);">' + esc(c.cat) + '</span></td>'
            + '<td data-label="On Hand" class="val">' + App.fmtCurrency(c.value) + '</td>'
            + '<td data-label="Weekly Use" class="val">' + (c.weeklyCogs > 0 ? App.fmtCurrency(c.weeklyCogs) : '-') + '</td>'
            + '<td data-label="Weeks" class="val"' + (over ? ' style="color:var(--amber);font-weight:600;"' : '') + '>' + w + '</td>'
            + '<td data-label="Target" class="val">' + (target > 0 ? App.fmtCurrency(target) : '-') + '</td>'
            + '<td data-label="Over" class="num"' + (over ? ' style="color:var(--gold);font-weight:600;"' : '') + '>' + (over ? App.fmtCurrency(c.excess) : '-') + '</td>'
            + '</tr>';
        }).join('')
      : '<tr><td colspan="6" style="color:var(--t3);">No category value yet.</td></tr>';
    return this.fixedTable(head, rows);
  },

  // ── Vendor purchasing scorecard (shares the colgroup with the category table) ─
  vendorCard(rows) {
    const head = '<th>Vendor</th><th>Orders</th><th>Spend 90d</th><th>Avg Order</th><th>Terms</th><th>To Par (now)</th>';
    const body = rows.length
      ? rows.map(r => {
          const last = r.lastOrder ? '<div style="font-size:10px;color:var(--t4);margin-top:2px;">Last order ' + this.fmtDay(r.lastOrder) + '</div>' : '';
          const terms = r.terms ? esc(r.terms) : '<span style="color:var(--t4);">none</span>';
          return '<tr>'
            + '<td data-label="Vendor"><span style="color:var(--t1);">' + esc(r.vendor) + '</span>' + last + '</td>'
            + '<td data-label="Orders" class="val">' + (r.orders || '-') + '</td>'
            + '<td data-label="Spend 90d" class="val">' + (r.spend > 0 ? App.fmtCurrency(r.spend) : '-') + '</td>'
            + '<td data-label="Avg Order" class="val">' + (r.avg > 0 ? App.fmtCurrency(r.avg) : '-') + '</td>'
            + '<td data-label="Terms">' + terms + '</td>'
            + '<td data-label="To Par (now)" class="num"' + (r.toPar > 0 ? ' style="color:var(--gold);font-weight:600;"' : '') + '>' + (r.toPar > 0 ? App.fmtCurrency(r.toPar) : '-') + '</td>'
            + '</tr>';
        }).join('')
      : '<tr><td colspan="6" style="color:var(--t3);">No deliveries in the last 90 days. Receive a delivery and your vendor purchasing fills in.</td></tr>';
    return this.fixedTable(head, body);
  }
};
