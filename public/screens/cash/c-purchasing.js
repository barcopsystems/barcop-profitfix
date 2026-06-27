'use strict';

/* ── Cash Recovery — Purchasing ───────────────────────────────────────────────
   The deep view behind the Close The Week "order to par" step, and the one place
   that reads your buying BEHAVIOR over time (Trapped Cash shows the shelf right
   now, the cockpit shows this week's to-dos, the Order Sheet places the order).
   Buy vs Use up top (are you buying ahead of your sales), then where you are
   overstocked by category, then a vendor purchasing scorecard (orders, spend,
   terms, what each owes to par). Reads CashEngine; the order is placed in the
   Order Sheet. */

S.CashPurchasing = {
  TARGET_WEEKS: 3,

  showHowTo() {
    App.showHelpModal('How Purchasing Works', [
      { p: ['Over-ordering is the quiet way cash gets trapped. Every case you buy ahead of when you need it is money off your account and onto the shelf. This view reads how you buy, so you order to par instead of to a number that feels safe.'] },
      { h: 'Buy vs Use', p: ['Between your last two counts, this is the dollars you bought against the dollars you used. Buy more than you use and the difference is cash sitting on your shelf. The strip traces it across your recent count periods, so a habit of buying ahead shows up before it ties up real money.'] },
      { h: 'Where You Are Overstocked', p: ['Bar Cop divides what you are holding by what you use in a week. Around two to three weeks is healthy for most bars. The category table shows where the cash is parked, so you know which order to tighten first.'] },
      { h: 'Your Vendors', p: ['The scorecard reads off your deliveries: how often you order from each vendor, what you spend, the average order, the terms you have on file, and what it costs to bring their items to par this week. Use it to consolidate to fewer fuller orders and to get more vendors onto terms, both of which keep cash in your account longer.'] }
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
        lead: 'Purchasing reads how you buy: dollars purchased against dollars used, where you are overstocked, and what your next order to par costs by vendor.',
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

    // Where you are overstocked, by category.
    const cats = CashEngine.categoryBreakdown(this.TARGET_WEEKS);
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

    const exportBtn = '<button class="btn btn-ghost btn-sm no-print" id="cp-export">Export PDF</button>';
    const bottomRow = '<div class="no-print" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:18px;">'
      + '<button class="btn btn-ghost btn-sm" data-go="ic-order-sheet">Open Order Sheet</button>'
      + '<button class="btn btn-ghost btn-sm" data-go="ic-par-suggestions">Adjust Pars</button>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">'
      + stats
      + this.buyVsUseCard()
      + this.sh('Where You Are Overstocked', exportBtn) + this.dataCard(catHead, catRows)
      + this.sh('Vendor Purchasing') + this.vendorCard(CashEngine.vendorPurchasing(90))
      + bottomRow
      + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#cp-export')) { App.exportPDF({ title: 'Purchasing', root: this.container }); return; }
      const go = ev.target.closest('[data-go]');
      if (go && go.dataset.go) { App.openScreen(go.dataset.go); return; }
    };
  },

  // ── Buy vs Use: bought minus used equals what landed on the shelf, plus a
  //    net-by-period strip so a habit of buying ahead reads at a glance. ─────────
  buyVsUseCard() {
    const bu = CashEngine.buyVsUse(6);
    if (!bu.hasData || !bu.latest) return '';
    const l = bu.latest;
    const stat = (label, val, sub, cls) => '<div style="flex:0 0 auto;"><div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:28px;font-weight:600;line-height:1;color:' + (cls || 'var(--t1)') + ';">' + val + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:4px;">' + sub + '</div></div>';
    const op = sym => '<div style="align-self:center;font-size:20px;color:var(--t4);">' + sym + '</div>';
    const overBuy = l.net > 25, drawDown = l.net < -25;
    const netCol = overBuy ? 'var(--amber)' : drawDown ? 'var(--green)' : 'var(--t1)';
    const netLabel = l.net >= 0 ? 'Onto the Shelf' : 'Off the Shelf';
    const note = overBuy
      ? 'You bought <strong style="color:var(--amber);">' + App.fmtCurrency(l.net) + '</strong> more than you used between ' + this.fmtDay(l.start) + ' and ' + this.fmtDay(l.end) + '. That cash is sitting on your shelf. Order to par to close the gap.'
      : drawDown
        ? 'You used <strong style="color:var(--green);">' + App.fmtCurrency(Math.abs(l.net)) + '</strong> more than you bought, drawing the shelf down and pulling cash back to your account. Stay on par so you do not run short.'
        : 'You bought just about what you used between ' + this.fmtDay(l.start) + ' and ' + this.fmtDay(l.end) + '. Your buying is matching your sales.';
    return this.sh('Buy vs Use')
      + '<div class="card"><div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Bought', App.fmtCurrency(l.bought), 'Delivered this period')
      + op('&minus;')
      + stat('Used', App.fmtCurrency(l.used), 'Cost of goods sold')
      + op('=')
      + stat(netLabel, App.fmtCurrency(Math.abs(l.net)), 'Cash ' + (l.net >= 0 ? 'parked' : 'recovered'), netCol)
      + '</div>'
      + this.buyTrend(bu.periods)
      + '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--b2);font-size:12px;color:var(--t2);line-height:1.6;">' + note + '</div>'
      + '</div>';
  },
  // Zero-baseline net-by-period bars: above the line (amber) is cash buying ahead
  // onto the shelf, below (green) is the shelf drawn down. Meaning-only color.
  buyTrend(periods) {
    if (!periods || periods.length < 2) return '';
    const maxAbs = Math.max(1, ...periods.map(p => Math.abs(p.net)));
    const H = 40;
    const cols = periods.map(p => {
      const h = Math.max(2, Math.round(Math.abs(p.net) / maxAbs * H));
      const up = p.net >= 0;
      const col = p.net > 25 ? 'var(--amber)' : p.net < -25 ? 'var(--green)' : 'var(--t4)';
      const top = '<div style="height:' + H + 'px;display:flex;align-items:flex-end;justify-content:center;">'
        + (up ? '<div style="width:16px;height:' + h + 'px;background:' + col + ';border-radius:2px 2px 0 0;"></div>' : '') + '</div>';
      const bottom = '<div style="height:' + H + 'px;display:flex;align-items:flex-start;justify-content:center;">'
        + (!up ? '<div style="width:16px;height:' + h + 'px;background:' + col + ';border-radius:0 0 2px 2px;"></div>' : '') + '</div>';
      return '<div style="flex:1;min-width:0;text-align:center;">'
        + top + '<div style="height:1px;background:var(--b2);"></div>' + bottom
        + '<div style="font-size:9px;color:var(--t4);margin-top:6px;white-space:nowrap;">' + this.fmtDay(p.end) + '</div></div>';
    }).join('');
    return '<div class="no-print" style="margin-top:18px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:12px;">Net Onto The Shelf, By Count Period</div>'
      + '<div style="display:flex;align-items:stretch;gap:10px;">' + cols + '</div></div>';
  },

  // ── Vendor purchasing scorecard ──────────────────────────────────────────────
  vendorCard(rows) {
    const head = '<colgroup><col style="width:28%"><col style="width:11%"><col style="width:16%"><col style="width:16%"><col style="width:15%"><col style="width:14%"></colgroup>'
      + '<thead><tr><th>Vendor</th><th>Orders</th><th>Spend 90d</th><th>Avg Order</th><th>Terms</th><th>To Par</th></tr></thead>';
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
            + '<td data-label="To Par" class="num"' + (r.toPar > 0 ? ' style="color:var(--gold);font-weight:600;"' : '') + '>' + (r.toPar > 0 ? App.fmtCurrency(r.toPar) : '-') + '</td>'
            + '</tr>';
        }).join('')
      : '<tr><td colspan="6" style="color:var(--t3);">No deliveries logged yet. Receive a delivery and your vendor purchasing fills in.</td></tr>';
    return '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl" style="table-layout:fixed;">' + head + '<tbody>' + body + '</tbody></table></div></div>';
  }
};
