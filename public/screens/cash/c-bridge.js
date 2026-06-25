'use strict';

/* ── Cash Recovery — Cash Bridge (profitable but broke, explained) ─────────────
   The keystone diagnostic. You earned a profit; the account barely moved. This
   shows exactly where the rest went: into more inventory, owner draws, loan
   principal, equipment, tax you remitted. Profit minus those is the cash you
   actually kept. It is the single screen that makes "profitable on paper, always
   tight" finally make sense. Profit and inventory change compute automatically;
   the cash outflows (draws, loans, capital, tax) you log here, and they feed the
   Survival Forecast too. Built to the standard. Reads CashEngine. */

S.CashBridge = {
  _period: 'last-month',
  _addType: 'draw',

  PERIODS: [['this-month', 'This Month'], ['last-month', 'Last Month'], ['this-quarter', 'This Quarter'], ['last-quarter', 'Last Quarter']],
  TYPES: [['draw', 'Owner draw'], ['loan', 'Loan payment'], ['capital', 'Capital / equipment'], ['tax', 'Tax remittance']],

  showHowTo() {
    App.showHelpModal('How the Cash Bridge Works', [
      { p: ['The question that haunts a profitable operator: I made money on paper, so why is the account always tight? This is the answer. Profit is not cash. The bridge takes your profit for a period and shows every place the money went instead of into the bank.'] },
      { h: 'Where Profit Goes', p: ['Four things eat profit without showing up as a cost. Money goes into more inventory when you buy more than you use. Owner draws come straight out of cash. Loan principal is a payment, not an expense. Capital buys, an espresso machine, a build-out, are paid in cash but written off slowly. Add the tax you remit and you have the whole gap.'] },
      { h: 'Logging The Outflows', p: ['Profit and your inventory change read automatically off your numbers. The draws, loan payments, capital buys, and tax remittances you log here, once, and Bar Cop uses them in the bridge and on the Survival Forecast as scheduled cash out. Mark a regular one, a monthly draw or loan, as recurring and it carries forward.'] },
      { h: 'Cash You Kept', p: ['Profit, minus what went into inventory, draws, loans, capital, and tax, is the cash that actually stayed. When that number is far below your profit, this screen tells you exactly which line to work on.'] }
    ]);
  },

  statItem(label, val, cls) { return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>'; },
  statsCard(items) { return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>'; },

  periodBounds() {
    const now = new Date();
    const ym = (y, m, d) => App.ymdLocal(new Date(y, m, d));
    if (this._period === 'this-month') return { s: ym(now.getFullYear(), now.getMonth(), 1), e: App.todayLocal(), label: 'this month' };
    if (this._period === 'this-quarter') { const q = Math.floor(now.getMonth() / 3); return { s: ym(now.getFullYear(), q * 3, 1), e: App.todayLocal(), label: 'this quarter' }; }
    if (this._period === 'last-quarter') { let q = Math.floor(now.getMonth() / 3) - 1; const y = q < 0 ? now.getFullYear() - 1 : now.getFullYear(); q = (q + 4) % 4; return { s: ym(y, q * 3, 1), e: ym(y, q * 3 + 3, 0), label: 'last quarter' }; }
    let m = now.getMonth() - 1; const y = m < 0 ? now.getFullYear() - 1 : now.getFullYear(); m = (m + 12) % 12;
    return { s: ym(y, m, 1), e: ym(y, m + 1, 0), label: 'last month' };
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  draw() {
    const b = this.periodBounds();
    const br = CashEngine.bridge(b.s, b.e);
    const chip = ([k, label]) => '<button class="btn btn-ghost btn-sm cb-period" data-p="' + k + '" style="' + (this._period === k ? 'background:var(--gold-tint);border-color:var(--gold);color:var(--t1);' : '') + '">' + label + '</button>';
    const periodRow = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">' + this.PERIODS.map(chip).join('') + '</div>';

    if (!br.hasData) {
      this.container.innerHTML = '<div class="screen">' + periodRow
        + '<div class="card"><div style="font-size:13px;color:var(--t2);line-height:1.7;">The bridge reads your profit off your weekly numbers. Once you have weeks confirmed in This Week for ' + esc(b.label) + ', it fills in here.</div></div></div>';
      this.wire();
      return;
    }

    this.container.innerHTML = '<div class="screen">'
      + periodRow
      + this.headline(br, b)
      + '<div class="sh" style="margin:24px 0 10px;">Where Your Profit Went</div>'
      + this.waterfall(br)
      + this.outflowLog(b)
      + '</div>';
    this.wire();
  },

  headline(br, b) {
    const kept = br.cashKept;
    const cls = kept < 0 ? 'warn' : '';
    return this.statsCard(
      this.statItem('Profit ' + b.label, App.fmtCurrency(br.profit))
      + this.statItem('Cash You Kept', App.fmtCurrency(kept), cls)
      + this.statItem('The Difference', App.fmtCurrency(br.profit - kept), (br.profit - kept) > 0 ? 'warn' : ''));
  },

  waterfall(br) {
    const row = (label, amount, sub, isResult) => {
      const neg = amount < 0;
      const color = isResult ? (amount < 0 ? 'var(--red)' : 'var(--green)') : (neg ? 'var(--red)' : 'var(--green)');
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid var(--b2);' + (isResult ? 'border-bottom:none;' : '') + '">'
        + '<div><div style="font-size:13px;' + (isResult ? 'font-weight:700;' : '') + 'color:var(--t1);">' + label + '</div>' + (sub ? '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + sub + '</div>' : '') + '</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:' + (isResult ? '22px' : '18px') + ';font-weight:600;color:' + color + ';white-space:nowrap;">' + (neg ? '-' : isResult ? '' : '+') + App.fmtCurrency(Math.abs(amount)) + '</div></div>';
    };
    const invChange = br.inv.change;
    const co = br.co;
    let rows = row('Profit you earned', br.profit, 'Revenue minus cost of goods, labor, and overhead');
    if (br.inv.hasData && Math.abs(invChange) >= 1) rows += row(invChange > 0 ? 'Into inventory' : 'Freed from inventory', -invChange, invChange > 0 ? 'You bought more than you used, cash onto the shelf' : 'You drew inventory down, cash came back');
    if (co.draw > 0) rows += row('Owner draws', -co.draw, 'Cash out, not a business expense');
    if (co.loan > 0) rows += row('Loan payments', -co.loan, 'Principal is a payment, not an expense');
    if (co.capital > 0) rows += row('Capital and equipment', -co.capital, 'Paid in cash, written off slowly');
    if (co.tax > 0) rows += row('Tax remitted', -co.tax, 'Money you collected and paid through');
    rows += '<div style="height:1px;background:var(--row-div);margin:4px 0;"></div>';
    rows += row('Cash you actually kept', br.cashKept, '', true);
    return '<div class="card">' + rows + '</div>';
  },

  outflowLog(b) {
    const co = CashEngine.outflowsInPeriod(b.s, b.e);
    const typeBtn = ([k, label]) => '<button class="btn btn-ghost btn-sm cb-type" data-t="' + k + '" style="' + (this._addType === k ? 'background:var(--gold-tint);border-color:var(--gold);color:var(--t1);' : '') + '">' + label + '</button>';
    const form = '<div class="card form-card" style="margin-top:6px;"><div class="card-title">Log a Cash Outflow</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">' + this.TYPES.map(typeBtn).join('') + '</div>'
      + '<div class="form-row">'
      +   '<div class="f" style="width:150px;"><label>Date</label><input type="date" id="cb-date" value="' + App.todayLocal() + '"/></div>'
      +   '<div class="f" style="width:140px;"><label>Amount</label><div class="fw"><span class="pre">$</span><input type="number" id="cb-amt" placeholder="0.00"/></div></div>'
      +   '<div class="f" style="flex:1;min-width:160px;"><label>Note (optional)</label><input type="text" id="cb-note" placeholder="e.g. SBA loan, March draw"/></div>'
      + '</div>'
      + '<label class="bc-check" style="margin-top:10px;display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--t2);cursor:pointer;"><input type="checkbox" id="cb-recur" class="bc-check"/> Recurring monthly</label>'
      + '</div>'
      + '<div style="margin:16px 0 4px;display:flex;align-items:center;gap:8px;"><button class="btn btn-primary btn-sm" id="cb-add">Add Outflow</button></div>';

    const listRows = co.list.length
      ? co.list.slice().sort((a, b2) => (a.date < b2.date ? 1 : -1)).map(o =>
          '<tr><td>' + (o.date || '') + '</td><td>' + esc(CashEngine._outflowLabel(o.type)) + (o.projected ? ' <span style="color:var(--t4);font-size:10px;">recurring</span>' : '') + '</td>'
          + '<td>' + esc(o.label || '') + '</td><td class="val">' + App.fmtCurrency(o.amount) + '</td>'
          + '<td style="text-align:right;">' + (o.id ? '<button class="btn btn-ghost btn-sm cb-del" data-id="' + o.id + '">Delete</button>' : '') + '</td></tr>').join('')
      : '<tr><td colspan="5" style="color:var(--t3);">No cash outflows logged for ' + esc(b.label) + ' yet.</td></tr>';
    const list = '<div class="sh" style="margin:24px 0 10px;">Logged Outflows</div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr><th>Date</th><th>Type</th><th>Note</th><th>Amount</th><th></th></tr></thead><tbody>' + listRows + '</tbody></table></div></div>';

    return form + list;
  },

  wire() {
    const add = document.getElementById('cb-add');
    if (add) add.addEventListener('click', async () => {
      const amt = parseFloat(document.getElementById('cb-amt').value);
      const date = document.getElementById('cb-date').value;
      if (isNaN(amt) || amt <= 0 || !date) return;
      const recur = document.getElementById('cb-recur').checked;
      const rec = { id: App.uid(), date: date, type: this._addType, amount: amt, notes: document.getElementById('cb-note').value || '', recurring: recur, created_at: new Date().toISOString() };
      if (recur) { rec.recur_day = parseInt(date.slice(8, 10), 10) || 1; rec.term_months = 12; }
      await App.putRecord('core', 'cash_outflow', rec);
      this.draw();
    });
    this.container.onclick = async ev => {
      if (ev.target.closest('#cb-add')) return;
      const pc = ev.target.closest('.cb-period');
      if (pc) { this._period = pc.dataset.p; this.draw(); return; }
      const tb = ev.target.closest('.cb-type');
      if (tb) { this._addType = tb.dataset.t; this.draw(); return; }
      const del = ev.target.closest('.cb-del');
      if (del) { if (await App.confirmDelete()) { await App.removeRecord('core', 'cash_outflow', del.dataset.id); this.draw(); } return; }
    };
  }
};
