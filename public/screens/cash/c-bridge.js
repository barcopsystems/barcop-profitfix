'use strict';

/* ── Cash Recovery — Cash Bridge (profitable but broke, explained) ─────────────
   The keystone diagnostic. You earned a profit; the account barely moved. This
   shows exactly where the rest went: into more inventory, owner draws, loan
   principal, equipment, tax you remitted. Profit minus those is the cash you
   actually kept. This page is read-only analysis: outflows are entered in Books
   under Cash Outflows, and the bridge reads them back off CashEngine. Pick a
   period and the bridge reads Cash You Kept and where every dollar went. */

S.CashBridge = {
  _period: 'last-month',

  PERIODS: [['this-month', 'This Month'], ['last-month', 'Last Month'], ['this-quarter', 'This Quarter'], ['last-quarter', 'Last Quarter']],

  showHowTo() {
    App.showHelpModal('How the Cash Bridge Works', [
      { p: ['The question that haunts a profitable operator: I made money on paper, so why is the account always tight? This is the answer. Profit is not cash. Pick a period with the chips and the bridge takes your profit for that stretch and shows every place the money went instead of into the bank.'] },
      { h: 'Where Profit Goes', p: ['Four things eat profit without showing up as a cost. Money goes into more inventory when you buy more than you use. Owner draws come straight out of cash. Loan principal is a payment, not an expense. Capital buys are paid in cash but written off slowly. Add the tax you remit and you have the whole gap.'] },
      { h: 'Where The Outflows Come From', p: ['You log the draws, loan payments, capital buys, and tax remittances in Books under Cash Outflows. This page reads them back. Recurring ones carry forward every month until you stop them. Operating bills like rent and utilities are not outflows here, those live in Operating Expenses.'] },
      { h: 'Cash You Kept', p: ['Profit, minus what went into inventory, draws, loans, capital, and tax, is the cash that actually stayed. When that number is far below your profit, this screen tells you exactly which line to work on.'] }
    ]);
  },

  periodBounds(period) {
    period = period || this._period;
    const now = new Date();
    const ym = (y, m, d) => App.ymdLocal(new Date(y, m, d));
    if (period === 'this-month') return { s: ym(now.getFullYear(), now.getMonth(), 1), e: App.todayLocal(), label: 'this month' };
    if (period === 'this-quarter') { const q = Math.floor(now.getMonth() / 3); return { s: ym(now.getFullYear(), q * 3, 1), e: App.todayLocal(), label: 'this quarter' }; }
    if (period === 'last-quarter') { let q = Math.floor(now.getMonth() / 3) - 1; const y = q < 0 ? now.getFullYear() - 1 : now.getFullYear(); q = (q + 4) % 4; return { s: ym(y, q * 3, 1), e: ym(y, q * 3 + 3, 0), label: 'last quarter' }; }
    let m = now.getMonth() - 1; const y = m < 0 ? now.getFullYear() - 1 : now.getFullYear(); m = (m + 12) % 12;
    return { s: ym(y, m, 1), e: ym(y, m + 1, 0), label: 'last month' };
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  onSel(active) { return active ? 'background:var(--sel-active-bg);border-color:var(--b-edge);color:var(--t1);' : ''; },

  draw() {
    const b = this.periodBounds();
    const br = CashEngine.bridge(b.s, b.e);
    const chip = ([k, label]) => '<button class="btn btn-ghost btn-sm cb-period" data-p="' + k + '" style="' + this.onSel(this._period === k) + '">' + label + '</button>';
    const controlRow = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + this.PERIODS.map(chip).join('') + '</div>'
      + '<button class="btn btn-ghost btn-sm no-print" id="cb-export">Export PDF</button>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">'
      + (br.hasData
          ? this.headline(br, b) + controlRow + this.waterfall(br)
          : controlRow + '<div class="card"><div style="font-size:13px;color:var(--t2);line-height:1.7;">The bridge reads your profit off your weekly numbers. Once you have weeks confirmed in This Week for ' + esc(b.label) + ', it fills in here.</div></div>')
      + '<div class="no-print" style="font-size:11px;color:var(--t3);margin-top:16px;">Log draws, loan payments, capital buys, and tax in Books under Cash Outflows. This page reads them back as the bridge.</div>'
      + '</div>';
    this.wire();
  },

  // ── Cash You Kept hero ───────────────────────────────────────────────────────
  headline(br, b) {
    const kept = br.cashKept, diff = br.profit - kept;
    const keptCol = kept < 0 ? 'var(--red)' : 'var(--w)';
    let convTxt = '';
    if (br.profit > 0) {
      const pct = Math.round(kept / br.profit * 100);
      if (kept < 0) convTxt = 'You kept none of your profit ' + b.label + '. Cash went backward.';
      else if (pct > 100) convTxt = 'You kept every dollar of profit ' + b.label + ' and freed cash on top.';
      else convTxt = 'You kept ' + pct + '¢ of every profit dollar ' + b.label + '.';
    }
    const convLine = convTxt ? '<div style="font-size:12px;color:var(--t2);margin-top:8px;">' + convTxt + '</div>' : '';
    return '<div class="card form-card"><div class="card-title">Cash You Kept</div>'
      + '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">'
      +   '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:600;line-height:0.9;color:' + keptCol + ';">' + App.fmtCurrency(kept, 0) + '</span>'
      +   '<span style="font-size:13px;color:var(--t2);">of ' + App.fmtCurrency(br.profit, 0) + ' profit ' + b.label + '</span>'
      + '</div>'
      + convLine
      + '<div style="font-size:12px;color:var(--t3);margin-top:12px;">'
      +   (diff > 0.5
            ? '<strong style="color:var(--amber);">' + App.fmtCurrency(diff) + '</strong> went somewhere other than the bank. The bridge below shows where.'
            : 'You kept all of your profit this period. Nothing leaked out to inventory, draws, or capital.')
      + '</div>'
      // PDF-only summary (the hero number is a styled span the exporter skips).
      + '<div class="pdf-para" style="display:none;">' + App.fmtCurrency(kept, 0) + ' cash kept of ' + App.fmtCurrency(br.profit, 0) + ' profit ' + b.label + '.' + (diff > 0.5 ? ' ' + App.fmtCurrency(diff) + ' went somewhere other than the bank.' : ' You kept all of your profit this period.') + '</div>'
      + '</div>';
  },

  waterfall(br) {
    const pdfItems = [];
    const row = (label, amount, sub, isResult) => {
      pdfItems.push({ label, amount, isResult });
      const neg = amount < 0;
      const color = isResult ? (amount < 0 ? 'var(--red)' : 'var(--green)') : (neg ? 'var(--red)' : 'var(--green)');
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;' + (isResult ? '' : 'border-bottom:1px solid var(--b2);') + '">'
        + '<div><div style="font-size:13px;' + (isResult ? 'font-weight:700;' : '') + 'color:var(--t1);">' + label + '</div>' + (sub ? '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + sub + '</div>' : '') + '</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:' + (isResult ? '22px' : '18px') + ';font-weight:600;color:' + color + ';white-space:nowrap;">' + (neg ? '-' : isResult ? '' : '+') + App.fmtCurrency(Math.abs(amount)) + '</div></div>';
    };
    const invChange = br.inv.change, co = br.co;
    let rows = row('Profit you earned', br.profit, 'Revenue minus cost of goods, labor, and overhead');
    if (br.inv.hasData && Math.abs(invChange) >= 1) rows += row(invChange > 0 ? 'Into inventory' : 'Freed from inventory', -invChange, invChange > 0 ? 'You bought more than you used, cash onto the shelf' : 'You drew inventory down, cash came back');
    if (co.draw > 0) rows += row('Owner draws', -co.draw, 'Cash out, not a business expense');
    if (co.loan > 0) rows += row('Loan payments', -co.loan, 'Principal is a payment, not an expense');
    if (co.capital > 0) rows += row('Capital and equipment', -co.capital, 'Paid in cash, written off slowly');
    if (co.tax > 0) rows += row('Tax remitted', -co.tax, 'Money you collected and paid through');
    rows += '<div style="height:1px;background:var(--row-div);margin:4px 0;"></div>';
    rows += row('Cash you actually kept', br.cashKept, '', true);
    // PDF-only table (the on-screen waterfall is styled divs the exporter skips).
    const pdfTable = '<table class="row-list" style="display:none;"><thead><tr><th>Where Your Profit Went</th><th>Amount</th></tr></thead><tbody>'
      + pdfItems.map(it => '<tr><td>' + esc(it.label) + '</td><td>' + (it.amount < 0 ? '-' : (it.isResult ? '' : '+')) + App.fmtCurrency(Math.abs(it.amount)) + '</td></tr>').join('')
      + '</tbody></table>';
    return '<div class="card">' + rows + pdfTable + '</div>';
  },
  wire() {
    this.container.onclick = ev => {
      if (ev.target.closest('#cb-export')) { App.exportPDF({ title: 'Cash Bridge', root: this.container }); return; }
      const pc = ev.target.closest('.cb-period');
      if (pc) { this._period = pc.dataset.p; this.draw(); return; }
    };
  }
};
