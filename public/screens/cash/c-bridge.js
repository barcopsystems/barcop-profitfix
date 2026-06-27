'use strict';

/* ── Cash Recovery — Cash Bridge (profitable but broke, explained) ─────────────
   The keystone diagnostic. You earned a profit; the account barely moved. This
   shows exactly where the rest went: into more inventory, owner draws, loan
   principal, equipment, tax you remitted. Profit minus those is the cash you
   actually kept. Log a cash outflow up top, pick a period, and the bridge below
   reads Cash You Kept and the line-item table of where every dollar went. Profit
   and inventory change compute automatically; the outflows you log here feed the
   Survival Forecast too. Reads CashEngine. */

S.CashBridge = {
  _period: 'last-month',

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

  onSel(active) { return active ? 'background:var(--sel-active-bg);border-color:var(--b-edge);color:var(--t1);' : ''; },
  sectionHead(title, right) {
    return right
      ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;"><div class="sh" style="margin:0;">' + title + '</div>' + right + '</div>'
      : '<div class="sh" style="margin:24px 0 10px;">' + title + '</div>';
  },

  draw() {
    const b = this.periodBounds();
    const br = CashEngine.bridge(b.s, b.e);
    const chip = ([k, label]) => '<button class="btn btn-ghost btn-sm cb-period" data-p="' + k + '" style="' + this.onSel(this._period === k) + '">' + label + '</button>';
    const periodRow = '<div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">' + this.PERIODS.map(chip).join('') + '</div>';
    const exportBtn = '<button class="btn btn-ghost btn-sm no-print" id="cb-export">Export PDF</button>';

    this.container.innerHTML = '<div class="screen">'
      + this.outflowForm()
      + periodRow
      + (br.hasData
          ? this.headline(br, b) + this.sectionHead('Where Your Profit Went', exportBtn) + this.waterfallTable(br)
          : '<div class="card"><div style="font-size:13px;color:var(--t2);line-height:1.7;">The bridge reads your profit off your weekly numbers. Once you have weeks confirmed in This Week for ' + esc(b.label) + ', it fills in here.</div></div>')
      + this.loggedTable(b)
      + '</div>';
    this.wire();
  },

  // ── Log a Cash Outflow (top of page, screen-only) ────────────────────────────
  outflowForm() {
    const typeOpts = this.TYPES.map(([k, label]) => '<option value="' + k + '">' + label + '</option>').join('');
    return '<div class="no-print"><div class="card form-card"><div class="card-title">Log a Cash Outflow</div>'
      + '<div class="form-row" style="margin-bottom:14px;">'
      +   '<div class="f" style="width:150px;"><label>Date</label><input type="date" id="cb-date" value="' + App.todayLocal() + '"/></div>'
      +   '<div class="f" style="width:180px;"><label>Type</label><select class="form-input" id="cb-type">' + typeOpts + '</select></div>'
      +   '<div class="f" style="width:140px;"><label>Amount</label><div class="fw"><span class="pre">$</span><input type="number" class="pre" id="cb-amt" placeholder="0.00"/></div></div>'
      +   '<label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--t2);cursor:pointer;margin-bottom:7px;"><input type="checkbox" id="cb-recur" class="bc-check"/> Recurring monthly</label>'
      + '</div>'
      + '<div class="form-row">'
      +   '<div class="f" style="flex:1;min-width:200px;"><label>Note</label><input type="text" id="cb-note" placeholder="e.g. SBA loan, March draw"/></div>'
      + '</div>'
      + '</div>'
      + '<div style="margin:14px 0 4px;display:flex;align-items:center;gap:8px;">'
      +   '<button class="btn btn-primary btn-sm" id="cb-add">Add Outflow</button>'
      +   '<button class="btn btn-ghost btn-sm" id="cb-reset">Start Over</button>'
      + '</div></div>';
  },

  // ── Cash You Kept hero (screen-only; the bridge table carries the PDF) ────────
  headline(br, b) {
    const kept = br.cashKept, diff = br.profit - kept;
    const keptCol = kept < 0 ? 'var(--red)' : 'var(--w)';
    return '<div class="card form-card no-print"><div class="card-title">Cash You Kept</div>'
      + '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">'
      +   '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:600;line-height:0.9;color:' + keptCol + ';">' + App.fmtCurrency(kept, 0) + '</span>'
      +   '<span style="font-size:13px;color:var(--t2);">of ' + App.fmtCurrency(br.profit, 0) + ' profit ' + b.label + '</span>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:12px;">'
      +   (diff > 0.5
            ? '<strong style="color:var(--amber);">' + App.fmtCurrency(diff) + '</strong> went somewhere other than the bank. The bridge below shows where.'
            : 'You kept all of your profit this period. Nothing leaked out to inventory, draws, or capital.')
      + '</div></div>';
  },

  // ── The bridge as a line-item table (prints; aligns clean) ───────────────────
  waterfallTable(br) {
    const invChange = br.inv.change, co = br.co;
    const lines = [{ label: 'Profit you earned', amt: br.profit }];
    if (br.inv.hasData && Math.abs(invChange) >= 1) lines.push({ label: invChange > 0 ? 'Into inventory' : 'Freed from inventory', amt: -invChange });
    if (co.draw > 0) lines.push({ label: 'Owner draws', amt: -co.draw });
    if (co.loan > 0) lines.push({ label: 'Loan payments', amt: -co.loan });
    if (co.capital > 0) lines.push({ label: 'Capital and equipment', amt: -co.capital });
    if (co.tax > 0) lines.push({ label: 'Tax remitted', amt: -co.tax });
    const body = lines.map(l => {
      const neg = l.amt < 0;
      return '<tr><td data-label="Item">' + l.label + '</td>'
        + '<td data-label="Amount" class="val" style="color:' + (neg ? 'var(--red)' : 'var(--green)') + ';font-weight:600;">' + (neg ? '-' : '+') + App.fmtCurrency(Math.abs(l.amt)) + '</td></tr>';
    }).join('');
    const keptNeg = br.cashKept < 0;
    const result = '<tr><td data-label="Item" style="border-top:2px solid var(--row-div);font-weight:700;color:var(--t1);">Cash you actually kept</td>'
      + '<td data-label="Amount" class="val" style="border-top:2px solid var(--row-div);font-weight:700;font-size:15px;color:' + (keptNeg ? 'var(--red)' : 'var(--green)') + ';">' + App.fmtCurrency(br.cashKept) + '</td></tr>';
    return '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl">'
      + '<thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody>' + body + result + '</tbody></table></div></div>';
  },

  // ── Logged outflows for the period (screen-only) ─────────────────────────────
  loggedTable(b) {
    const co = CashEngine.outflowsInPeriod(b.s, b.e);
    const rows = co.list.length
      ? co.list.slice().sort((a, b2) => (a.date < b2.date ? 1 : -1)).map(o =>
          '<tr><td data-label="Date">' + (o.date || '') + '</td><td data-label="Type">' + esc(CashEngine._outflowLabel(o.type)) + (o.projected ? ' <span style="color:var(--t4);font-size:10px;">recurring</span>' : '') + '</td>'
          + '<td data-label="Note">' + esc(o.label || '') + '</td><td data-label="Amount" class="val">' + App.fmtCurrency(o.amount) + '</td>'
          + '<td style="text-align:right;">' + (o.id ? '<button class="btn btn-ghost btn-sm cb-del" data-id="' + o.id + '">Delete</button>' : '') + '</td></tr>').join('')
      : '<tr><td colspan="5" style="color:var(--t3);">No cash outflows logged for ' + esc(b.label) + ' yet.</td></tr>';
    return '<div class="no-print">' + this.sectionHead('Logged Outflows')
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr><th>Date</th><th>Type</th><th>Note</th><th>Amount</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div></div>';
  },

  wire() {
    const add = document.getElementById('cb-add');
    if (add) add.addEventListener('click', async () => {
      const amt = parseFloat(document.getElementById('cb-amt').value);
      const date = document.getElementById('cb-date').value;
      if (isNaN(amt) || amt <= 0 || !date) return;
      const recur = document.getElementById('cb-recur').checked;
      const type = document.getElementById('cb-type').value || 'draw';
      const rec = { id: App.uid(), date: date, type: type, amount: amt, notes: document.getElementById('cb-note').value || '', recurring: recur, created_at: new Date().toISOString() };
      if (recur) { rec.recur_day = parseInt(date.slice(8, 10), 10) || 1; rec.term_months = 12; }
      await App.putRecord('core', 'cash_outflow', rec);
      this.draw();
    });
    const reset = document.getElementById('cb-reset');
    if (reset) reset.addEventListener('click', () => {
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      set('cb-date', App.todayLocal()); set('cb-amt', ''); set('cb-note', '');
      const t = document.getElementById('cb-type'); if (t) t.selectedIndex = 0;
      const r = document.getElementById('cb-recur'); if (r) r.checked = false;
    });
    this.container.onclick = async ev => {
      if (ev.target.closest('#cb-add') || ev.target.closest('#cb-reset')) return;
      if (ev.target.closest('#cb-export')) { const pl = (this.PERIODS.find(x => x[0] === this._period) || [])[1] || ''; App.exportPDF({ title: 'Cash Bridge, ' + pl, root: this.container }); return; }
      const pc = ev.target.closest('.cb-period');
      if (pc) { this._period = pc.dataset.p; this.draw(); return; }
      const del = ev.target.closest('.cb-del');
      if (del) { if (await App.confirmDelete()) { await App.removeRecord('core', 'cash_outflow', del.dataset.id); this.draw(); } return; }
    };
  }
};
