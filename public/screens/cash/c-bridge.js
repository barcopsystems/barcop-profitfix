'use strict';

/* ── Cash Recovery — Cash Bridge (profitable but broke, explained) ─────────────
   The keystone diagnostic. You earned a profit; the account barely moved. This
   shows exactly where the rest went: into more inventory, owner draws, loan
   principal, equipment, tax you remitted. Profit minus those is the cash you
   actually kept. Log a cash outflow up top, pick a period, and the bridge below
   reads Cash You Kept and where every dollar went. Recurring outflows carry
   forward each month until you stop them (same model as Operating Expenses) and
   are managed in the Recurring Outflows card. Reads CashEngine. */

S.CashBridge = {
  _period: 'last-month',
  _editId: null,

  PERIODS: [['this-month', 'This Month'], ['last-month', 'Last Month'], ['this-quarter', 'This Quarter'], ['last-quarter', 'Last Quarter']],
  TYPES: [['draw', 'Owner draw'], ['loan', 'Loan payment'], ['capital', 'Capital / equipment'], ['tax', 'Tax remittance']],

  showHowTo() {
    App.showHelpModal('How the Cash Bridge Works', [
      { p: ['The question that haunts a profitable operator: I made money on paper, so why is the account always tight? This is the answer. Profit is not cash. The bridge takes your profit for a period and shows every place the money went instead of into the bank.'] },
      { h: 'Where Profit Goes', p: ['Four things eat profit without showing up as a cost. Money goes into more inventory when you buy more than you use. Owner draws come straight out of cash. Loan principal is a payment, not an expense. Capital buys, an espresso machine, a build-out, are paid in cash but written off slowly. Add the tax you remit and you have the whole gap.'] },
      { h: 'Logging The Outflows', p: ['Profit and your inventory change read automatically off your numbers. The draws, loan payments, capital buys, and tax remittances you log here, and Bar Cop uses them in the bridge and on the Survival Forecast as scheduled cash out. Check Recurring monthly for a regular one, a monthly draw or loan, and it carries forward every month until you stop it. Set Ends after only for a fixed-term one, like a loan with a payoff date.'] },
      { h: 'Recurring Outflows', p: ['Your recurring series live in the Recurring Outflows card. Edit one to change the amount or term, or Stop it to end the series, the months already logged stay in your bridge and forecast, it just drops off going forward.'] },
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
  fmtYm(ym) { const d = new Date(ym + '-01T00:00:00'); return isNaN(d.getTime()) ? ym : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); },

  draw() {
    const b = this.periodBounds();
    const br = CashEngine.bridge(b.s, b.e);
    const chip = ([k, label]) => '<button class="btn btn-ghost btn-sm cb-period" data-p="' + k + '" style="' + this.onSel(this._period === k) + '">' + label + '</button>';
    const periodRow = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:28px 0 16px;">' + this.PERIODS.map(chip).join('') + '</div>';

    this.container.innerHTML = '<div class="screen">'
      + this.outflowForm()
      + periodRow
      + (br.hasData
          ? this.headline(br, b)
            + '<div class="sh" style="margin:24px 0 10px;">Where Your Profit Went</div>'
            + this.waterfall(br)
          : '<div class="card"><div style="font-size:13px;color:var(--t2);line-height:1.7;">The bridge reads your profit off your weekly numbers. Once you have weeks confirmed in This Week for ' + esc(b.label) + ', it fills in here.</div></div>')
      + this.recurringCard()
      + this.loggedTable(b)
      + '</div>';
    this.wire();
  },

  // ── Log / edit a cash outflow (top of page) ──────────────────────────────────
  outflowForm() {
    const editing = this._editId ? CashEngine.cashOutflows().find(o => o.id === this._editId) : null;
    const v = editing || {};
    const typeOpts = this.TYPES.map(([k, label]) => '<option value="' + k + '"' + ((v.type || 'draw') === k ? ' selected' : '') + '>' + label + '</option>').join('');
    return '<div><div class="card form-card"><div class="card-title">' + (editing ? 'Edit Recurring Outflow' : 'Log a Cash Outflow') + '</div>'
      + '<div class="form-row" style="margin-bottom:14px;">'
      +   '<div class="f" style="width:150px;"><label>Date</label><input type="date" id="cb-date" value="' + (v.date || App.todayLocal()) + '"/></div>'
      +   '<div class="f" style="width:180px;"><label>Type</label><select class="form-input" id="cb-type">' + typeOpts + '</select></div>'
      +   '<div class="f" style="width:140px;"><label>Amount</label><div class="fw"><span class="pre">$</span><input type="number" class="pre" id="cb-amt" placeholder="0.00" value="' + (v.amount != null ? v.amount : '') + '"/></div></div>'
      +   '<label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--t2);cursor:pointer;margin-bottom:7px;"><input type="checkbox" id="cb-recur" class="bc-check"' + (v.recurring ? ' checked' : '') + '/> Recurring monthly</label>'
      + '</div>'
      + '<div class="form-row">'
      +   '<div class="f" style="flex:1;min-width:200px;"><label>Note</label><input type="text" id="cb-note" placeholder="e.g. SBA loan, March draw" value="' + esc(v.notes || '') + '"/></div>'
      +   '<div class="f" style="width:150px;"><label>Ends after</label><div class="fw"><input type="number" class="suf" id="cb-term" placeholder="ongoing" value="' + (v.term_months || '') + '"/><span class="suf">mo</span></div></div>'
      + '</div>'
      + '</div>'
      + '<div style="margin:14px 0 4px;display:flex;align-items:center;gap:8px;">'
      +   '<button class="btn btn-primary btn-sm" id="cb-add">' + (editing ? 'Update Outflow' : 'Add Outflow') + '</button>'
      +   '<button class="btn btn-ghost btn-sm" id="cb-reset">' + (editing ? 'Cancel' : 'Start Over') + '</button>'
      + '</div></div>';
  },

  // ── Cash You Kept hero ───────────────────────────────────────────────────────
  headline(br, b) {
    const kept = br.cashKept, diff = br.profit - kept;
    const keptCol = kept < 0 ? 'var(--red)' : 'var(--w)';
    return '<div class="card form-card"><div class="card-title">Cash You Kept</div>'
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

  waterfall(br) {
    const row = (label, amount, sub, isResult) => {
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
    return '<div class="card">' + rows + '</div>';
  },

  // ── Recurring Outflows: the active series, managed in one place ───────────────
  activeRecurring() {
    const cur = App.todayLocal().slice(0, 7);
    return CashEngine.recurringOutflows().filter(o => {
      if (o.stopped_ym) return false;
      const end = CashEngine.recurringEndYm(o);
      return !(end && end < cur);
    });
  },
  recurringCard() {
    const recs = this.activeRecurring();
    let body;
    if (!recs.length) {
      body = '<div style="font-size:12px;color:var(--t3);">No recurring outflows. Check Recurring monthly when you log a draw, loan, or other outflow that repeats, and it carries forward each month until you stop it.</div>';
    } else {
      body = recs.map((o, i) => {
        const end = CashEngine.recurringEndYm(o);
        const status = end ? 'Ends ' + this.fmtYm(end) : 'Ongoing';
        const last = i < recs.length - 1;
        return '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:11px 0;' + (last ? 'border-bottom:1px solid var(--b2);' : '') + '">'
          + '<div style="flex:1;min-width:150px;"><div style="font-size:13px;color:var(--t1);">' + esc(CashEngine._outflowLabel(o.type)) + (o.notes ? ' <span style="color:var(--t3);font-weight:400;">&middot; ' + esc(o.notes) + '</span>' : '') + '</div>'
          +   '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + status + '</div></div>'
          + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:600;color:var(--t1);white-space:nowrap;">' + App.fmtCurrency(o.amount) + '<span style="font-size:11px;color:var(--t3);"> /mo</span></div>'
          + '<div style="display:flex;gap:6px;flex-shrink:0;">'
          +   '<button class="btn btn-ghost btn-sm cb-edit" data-id="' + esc(o.id) + '">Edit</button>'
          +   '<button class="btn btn-ghost btn-sm cb-stop" data-id="' + esc(o.id) + '">Stop</button>'
          + '</div></div>';
      }).join('');
    }
    return '<div class="sh" style="margin:24px 0 10px;">Recurring Outflows</div><div class="card">' + body + '</div>';
  },

  loggedTable(b) {
    const co = CashEngine.outflowsInPeriod(b.s, b.e);
    const rows = co.list.length
      ? co.list.slice().sort((a, b2) => (a.date < b2.date ? 1 : -1)).map(o =>
          '<tr><td data-label="Date">' + (o.date || '') + '</td><td data-label="Type">' + esc(CashEngine._outflowLabel(o.type)) + (o.projected ? ' <span style="color:var(--t4);font-size:10px;">recurring</span>' : '') + '</td>'
          + '<td data-label="Note">' + esc(o.label || '') + '</td><td data-label="Amount" class="val">' + App.fmtCurrency(o.amount) + '</td>'
          + '<td style="text-align:right;">' + (o.id ? '<button class="btn btn-ghost btn-sm cb-del" data-id="' + o.id + '">Delete</button>' : '') + '</td></tr>').join('')
      : '<tr><td colspan="5" style="color:var(--t3);">No cash outflows logged for ' + esc(b.label) + ' yet.</td></tr>';
    return '<div class="sh" style="margin:24px 0 10px;">Logged Outflows</div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr><th>Date</th><th>Type</th><th>Note</th><th>Amount</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  },

  async save() {
    const amt = parseFloat(document.getElementById('cb-amt').value);
    const date = document.getElementById('cb-date').value;
    if (isNaN(amt) || amt <= 0 || !date) return;
    const recur = document.getElementById('cb-recur').checked;
    const type = document.getElementById('cb-type').value || 'draw';
    const note = document.getElementById('cb-note').value || '';
    const term = parseInt(document.getElementById('cb-term').value, 10);
    const base = this._editId ? (CashEngine.cashOutflows().find(o => o.id === this._editId) || {}) : {};
    const rec = Object.assign({}, base, { id: this._editId || App.uid(), date: date, type: type, amount: amt, notes: note, recurring: recur, created_at: base.created_at || new Date().toISOString() });
    if (recur) {
      rec.recur_day = parseInt(date.slice(8, 10), 10) || 1;
      if (term > 0) rec.term_months = term; else delete rec.term_months;   // blank = ongoing
      delete rec.stopped_ym;                                                // editing re-activates
    } else {
      delete rec.recur_day; delete rec.term_months; delete rec.stopped_ym;
    }
    await App.putRecord('core', 'cash_outflow', rec);
    this._editId = null;
    this.draw();
  },
  resetForm() {
    if (this._editId) { this._editId = null; this.draw(); return; }
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('cb-date', App.todayLocal()); set('cb-amt', ''); set('cb-note', ''); set('cb-term', '');
    const t = document.getElementById('cb-type'); if (t) t.selectedIndex = 0;
    const r = document.getElementById('cb-recur'); if (r) r.checked = false;
  },
  async stop(id) {
    const rec = CashEngine.cashOutflows().find(o => o.id === id); if (!rec) return;
    if (!(await App.confirm({ title: 'Stop this recurring outflow?', message: 'It stops at the end of this month. The months already logged stay in your bridge and forecast, it just drops off going forward.', confirmText: 'Stop It' }))) return;
    const now = new Date(); const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await App.putRecord('core', 'cash_outflow', Object.assign({}, rec, { stopped_ym: App.ymdLocal(next).slice(0, 7) }));
    this.draw();
  },

  wire() {
    const add = document.getElementById('cb-add');
    if (add) add.addEventListener('click', () => this.save());
    const reset = document.getElementById('cb-reset');
    if (reset) reset.addEventListener('click', () => this.resetForm());
    this.container.onclick = async ev => {
      if (ev.target.closest('#cb-add') || ev.target.closest('#cb-reset')) return;
      const pc = ev.target.closest('.cb-period');
      if (pc) { this._period = pc.dataset.p; this.draw(); return; }
      const ed = ev.target.closest('.cb-edit');
      if (ed) { this._editId = ed.dataset.id; this.draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      const st = ev.target.closest('.cb-stop');
      if (st) { await this.stop(st.dataset.id); return; }
      const del = ev.target.closest('.cb-del');
      if (del) { if (await App.confirmDelete()) { await App.removeRecord('core', 'cash_outflow', del.dataset.id); this.draw(); } return; }
    };
  }
};
