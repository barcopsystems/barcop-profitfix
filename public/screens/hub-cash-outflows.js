'use strict';

/* ── Books — Cash Outflows ────────────────────────────────────────────────────
   The entry door for the money that leaves the bank but never lands on the P&L
   as a cost: owner draws, loan principal, capital and equipment buys, and tax
   remittances. Lives in Books next to Operating Expenses so every dollar out is
   entered in one section. Bar Cop reads these into the Cash Bridge (where the
   profit went) and the Survival Forecast (scheduled cash out). The bridge and
   forecast read the cash_outflows store, not this screen, so the analysis on the
   Cash side keeps working no matter where the operator types it in.

   Operating bills (rent, utilities, insurance) are NOT outflows here; those go in
   Operating Expenses so they stay on the P&L and are not double-counted. */

S.HubCashOutflows = {
  _period: 'last-month',

  PERIODS: [['this-month', 'This Month'], ['last-month', 'Last Month'], ['this-quarter', 'This Quarter'], ['last-quarter', 'Last Quarter']],
  TYPES: [['draw', 'Owner draw'], ['loan', 'Loan payment'], ['capital', 'Capital / equipment'], ['tax', 'Tax remittance']],

  open() {
    App.openHubFullPage('Cash Outflows', (mount) => {
      this.container = mount;
      this.draw();
    }, 'cash-outflows');
  },

  records() { return CashEngine.cashOutflows(); },
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
  // After a save, if the selected period would hide the saved outflow, switch to
  // the period that shows it (the narrowest match) so the operator sees it land.
  _periodForDate(ymd) {
    for (let i = 0; i < this.PERIODS.length; i++) {
      const b = this.periodBounds(this.PERIODS[i][0]);
      if (ymd >= b.s && ymd <= b.e) return this.PERIODS[i][0];
    }
    return null;
  },
  _setPeriodFor(ymd) {
    const cur = this.periodBounds();
    if (ymd >= cur.s && ymd <= cur.e) return;   // current period already shows it
    const p = this._periodForDate(ymd);
    if (p) this._period = p;
  },

  onSel(active) { return active ? 'background:var(--sel-active-bg);border-color:var(--b-edge);color:var(--t1);' : ''; },
  fmtYm(ym) { const d = new Date(ym + '-01T00:00:00'); return isNaN(d.getTime()) ? ym : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); },
  _recurTag() { return ' <span style="color:var(--t4);font-size:10px;white-space:nowrap;">recurring</span>'; },
  typeOptions(sel) { return this.TYPES.map(([k, label]) => '<option value="' + k + '"' + ((sel || 'draw') === k ? ' selected' : '') + '>' + label + '</option>').join(''); },

  draw() {
    const b = this.periodBounds();
    this.container.innerHTML = '<div class="screen">'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.7;max-width:760px;margin-bottom:4px;">Log the money that leaves the bank but never hits your P&L as a cost: owner draws, loan principal, capital buys, and tax you remit. Bar Cop reads these into the Cash Bridge and Survival Forecast. Rent, utilities, and other operating bills go in Operating Expenses.</div>'
      + this.addCard()
      + this.recurringSection()
      + this.loggedSection(b)
      + '</div>';
    this.wire();
  },

  // ── Log a Cash Outflow (collapsible) ─────────────────────────────────────────
  addCard() {
    const body = '<div class="collapse-body">'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      +   '<div class="f" style="width:160px;"><label>Date</label><input type="date" id="cb-date" value="' + App.todayLocal() + '"/></div>'
      +   '<div class="f" style="width:200px;"><label>Type</label><select class="form-input" id="cb-type">' + this.typeOptions('draw') + '</select></div>'
      +   '<div class="f" style="width:160px;"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="cb-amt" step="0.01" min="0" placeholder="0.00"/></div></div>'
      + '</div>'
      + '<div style="margin-top:14px;"><label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--t1);cursor:pointer;"><input type="checkbox" class="bc-check" id="cb-recur"/> Recurring monthly (same amount each month)</label></div>'
      + '<div id="cb-term-wrap" style="margin-top:12px;display:none;"><div class="f" style="max-width:540px;"><label>Ends after (months)</label><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><input type="number" class="suf" id="cb-term" min="1" step="1" placeholder="Ongoing" style="width:170px;flex:0 0 170px;"/><div style="font-size:11px;color:var(--t3);line-height:1.5;flex:1 1 200px;min-width:180px;">Leave blank and it recurs every month until you stop it. Only set this for one with a fixed payoff, like a loan.</div></div></div></div>'
      + '<div class="form-row" style="margin-top:14px;margin-bottom:0;"><div class="f" style="width:100%;"><label>Note</label><textarea class="notes-ta" rows="2" id="cb-note" placeholder="e.g. SBA loan, March draw"></textarea></div></div>'
      + '<div id="cb-err" style="display:none;font-size:11px;color:var(--red);margin-top:10px;"></div>'
      + '</div>';
    const buttons = '<div data-collapse-group="cb-add" style="margin:16px 0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="cb-save">Add Outflow</button>'
      + '<button class="btn btn-ghost" id="cb-clear">Start Over</button>'
      + '</div>';
    return '<div class="card form-card">' + App.collapsibleCardTitle('cb-add', 'Log a Cash Outflow') + body + '</div>' + buttons;
  },

  // ── Recurring Outflows: active series, managed in one place ───────────────────
  activeRecurring() {
    const cur = App.todayLocal().slice(0, 7);
    return CashEngine.recurringOutflows().filter(o => {
      if (o.stopped_ym) return false;
      const end = CashEngine.recurringEndYm(o);
      return !(end && end < cur);
    });
  },
  recurringSection() {
    const recs = this.activeRecurring();
    const rows = recs.length
      ? recs.map(o => {
          const end = CashEngine.recurringEndYm(o);
          const status = end ? 'Ends ' + this.fmtYm(end) : 'Ongoing';
          return '<tr>'
            + '<td data-label="Type" style="color:var(--t1);">' + esc(CashEngine._outflowLabel(o.type)) + this._recurTag() + '</td>'
            + '<td data-label="Note" style="color:var(--t2);">' + esc(o.notes || '') + '</td>'
            + '<td data-label="Status" style="color:var(--t3);">' + status + '</td>'
            + '<td data-label="Amount" style="font-weight:700;color:var(--t1);white-space:nowrap;">' + App.fmtCurrency(o.amount) + '<span style="color:var(--t3);font-weight:400;font-size:11px;"> /mo</span></td>'
            + '<td class="no-print" style="text-align:right;white-space:nowrap;"><button class="btn btn-ghost btn-sm cb-stop" data-id="' + esc(o.id) + '">Stop</button> <button class="btn btn-ghost btn-sm cb-edit" data-id="' + esc(o.id) + '">Edit</button> <button class="btn btn-danger btn-sm cb-del" data-id="' + esc(o.id) + '">Delete</button></td>'
            + '</tr>';
        }).join('')
      : '<tr><td colspan="5" style="padding:12px;color:var(--t3);font-size:12px;text-align:center;">No recurring outflows. Check Recurring monthly when you log a draw or loan that repeats.</td></tr>';
    return '<div class="sh" style="margin:24px 0 10px;">Recurring Outflows</div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="width:100%;">'
      + '<thead><tr><th>Type</th><th>Note</th><th>Status</th><th>Amount</th><th class="no-print"></th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>';
  },

  // ── Logged Outflows: one-time outflows in the selected period ─────────────────
  loggedSection(b) {
    const recs = this.records().filter(o => o && o.id && !o.recurring && (o.date || '') >= b.s && (o.date || '') <= b.e)
      .sort((a, c) => (String(a.date) < String(c.date) ? 1 : -1));
    const rows = recs.length
      ? recs.map(o => '<tr>'
          + '<td data-label="Date" style="color:var(--t1);white-space:nowrap;">' + esc(o.date || '') + '</td>'
          + '<td data-label="Type" style="color:var(--t2);">' + esc(CashEngine._outflowLabel(o.type)) + '</td>'
          + '<td data-label="Note" style="color:var(--t2);">' + esc(o.notes || '') + '</td>'
          + '<td data-label="Amount" style="font-weight:700;color:var(--t1);">' + App.fmtCurrency(o.amount) + '</td>'
          + '<td class="no-print" style="text-align:right;white-space:nowrap;"><button class="btn btn-ghost btn-sm cb-repeat" data-id="' + esc(o.id) + '">Repeat</button> <button class="btn btn-ghost btn-sm cb-edit" data-id="' + esc(o.id) + '">Edit</button> <button class="btn btn-danger btn-sm cb-del" data-id="' + esc(o.id) + '">Delete</button></td>'
          + '</tr>').join('')
      : '<tr><td colspan="5" style="padding:12px;color:var(--t3);font-size:12px;text-align:center;">No one-time outflows logged for ' + esc(b.label) + '.</td></tr>';
    const chip = ([k, label]) => '<button class="btn btn-ghost btn-sm cb-period" data-p="' + k + '" style="' + this.onSel(this._period === k) + '">' + label + '</button>';
    const headRow = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Logged Outflows</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' + this.PERIODS.map(chip).join('') + '<button class="btn btn-ghost btn-sm no-print" id="cb-export">Export PDF</button></div>'
      + '</div>';
    return headRow
      + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="width:100%;">'
      + '<thead><tr><th>Date</th><th>Type</th><th>Note</th><th>Amount</th><th class="no-print"></th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>';
  },

  // ── Add / edit / repeat ──────────────────────────────────────────────────────
  async saveAdd() {
    const g = (id) => document.getElementById(id);
    const date = g('cb-date')?.value || '';
    const type = g('cb-type')?.value || 'draw';
    const amount = parseFloat(g('cb-amt')?.value || '');
    const note = (g('cb-note')?.value || '').trim();
    const recur = !!g('cb-recur')?.checked;
    const term = parseInt(g('cb-term')?.value, 10);
    const showErr = (m) => { const e = g('cb-err'); if (e) { e.textContent = m; e.style.display = 'block'; } };
    if (!date) { showErr('Pick a date.'); return; }
    if (isNaN(amount) || amount <= 0) { showErr('Enter an amount above zero.'); return; }
    if (recur && g('cb-term')?.value && (isNaN(term) || term < 1)) { showErr('A fixed term must be 1 month or more, or leave it blank to recur until you stop it.'); return; }
    const rec = { id: App.uid(), date, type, amount, notes: note, created_at: new Date().toISOString() };
    if (recur) { rec.recurring = true; rec.recur_day = parseInt(String(date).slice(8, 10), 10) || 1; if (term && term > 0) rec.term_months = term; }
    await App.putRecord('core', 'cash_outflow', rec);
    if (!recur) this._setPeriodFor(date);
    this.draw();
  },
  clearAdd() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('cb-date', App.todayLocal()); set('cb-amt', ''); set('cb-note', ''); set('cb-term', '');
    const t = document.getElementById('cb-type'); if (t) t.selectedIndex = 0;
    const r = document.getElementById('cb-recur'); if (r) r.checked = false;
    const w = document.getElementById('cb-term-wrap'); if (w) w.style.display = 'none';
    const e = document.getElementById('cb-err'); if (e) e.style.display = 'none';
  },

  // record = the row being edited; prefill = starting values for a new entry (Repeat).
  openModal(record, prefill) {
    const isEdit = !!record;
    const rec = record || prefill || { id: '', date: App.todayLocal(), type: 'draw', amount: '', notes: '', recurring: false };
    const id = 'cb-modal';
    const seriesOn = !!rec.recurring;
    const recurHtml = '<div style="margin-top:14px;"><label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--t1);cursor:pointer;"><input type="checkbox" class="bc-check" id="cb-f-recur"' + (seriesOn ? ' checked' : '') + '/> Recurring monthly (same amount each month)</label></div>'
      + '<div id="cb-f-term-wrap" style="margin-top:12px;' + (seriesOn ? '' : 'display:none;') + '"><div class="f" style="max-width:540px;"><label>Ends after (months)</label><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><input type="number" class="suf" id="cb-f-term" min="1" step="1" value="' + esc(rec.term_months || '') + '" placeholder="Ongoing" style="width:170px;flex:0 0 170px;"/><div style="font-size:11px;color:var(--t3);line-height:1.5;flex:1 1 200px;min-width:180px;">Leave blank and it recurs every month until you stop it. Only set this for one with a fixed payoff, like a loan.</div></div></div></div>';
    const html = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">' + (isEdit ? 'Edit Outflow' : 'Repeat Outflow') + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      +   '<div class="f"><label>Date</label><input type="date" id="cb-f-date" value="' + esc(rec.date) + '"/></div>'
      +   '<div class="f"><label>Type</label><select class="form-input" id="cb-f-type">' + this.typeOptions(rec.type) + '</select></div>'
      +   '<div class="f"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="cb-f-amt" step="0.01" min="0" value="' + esc(rec.amount === '' ? '' : String(rec.amount)) + '" placeholder="0.00"/></div></div>'
      + '</div>'
      + recurHtml
      + '<div class="form-row" style="margin-top:14px;"><div class="f" style="width:100%;"><label>Note</label><textarea class="notes-ta" rows="2" id="cb-f-note" placeholder="e.g. SBA loan, March draw">' + esc(rec.notes || '') + '</textarea></div></div>'
      + '<div class="card-actions">'
      +   '<button class="btn btn-primary" id="cb-f-save">' + (isEdit ? 'Save Changes' : 'Add Outflow') + '</button>'
      +   '<button class="btn btn-ghost" id="cb-f-cancel">Cancel</button>'
      +   '<span id="cb-f-err" style="display:none;font-size:11px;color:var(--red);align-self:center;"></span>'
      +   (isEdit ? '<button class="btn btn-danger" id="cb-f-del" style="margin-left:auto;">Delete</button>' : '')
      + '</div></div>';
    App.openModal(html, { id, maxWidth: 540, noClose: true });
    const showErr = (m) => { const e = document.getElementById('cb-f-err'); if (e) { e.textContent = m; e.style.display = 'inline'; } };
    document.getElementById('cb-f-cancel')?.addEventListener('click', () => App.closeModal(id));
    if (isEdit) document.getElementById('cb-f-del')?.addEventListener('click', async () => { App.closeModal(id); await this.del(rec.id); });
    document.getElementById('cb-f-recur')?.addEventListener('change', (e) => { const w = document.getElementById('cb-f-term-wrap'); if (w) w.style.display = e.target.checked ? '' : 'none'; });
    document.getElementById('cb-f-save')?.addEventListener('click', async () => {
      const date = document.getElementById('cb-f-date')?.value || '';
      const type = document.getElementById('cb-f-type')?.value || 'draw';
      const amount = parseFloat(document.getElementById('cb-f-amt')?.value || '');
      const note = (document.getElementById('cb-f-note')?.value || '').trim();
      const recChecked = !!document.getElementById('cb-f-recur')?.checked;
      const termV = parseInt(document.getElementById('cb-f-term')?.value, 10);
      if (!date) { showErr('Pick a date.'); return; }
      if (isNaN(amount) || amount <= 0) { showErr('Enter an amount above zero.'); return; }
      if (recChecked && document.getElementById('cb-f-term')?.value && (isNaN(termV) || termV < 1)) { showErr('A fixed term must be 1 month or more, or leave it blank.'); return; }
      const base = isEdit ? (this.records().find(o => o.id === rec.id) || {}) : {};
      const out = Object.assign({}, base, { id: isEdit ? rec.id : App.uid(), date, type, amount, notes: note, created_at: base.created_at || new Date().toISOString() });
      if (recChecked) { out.recurring = true; out.recur_day = parseInt(String(date).slice(8, 10), 10) || 1; if (termV && termV > 0) out.term_months = termV; else delete out.term_months; delete out.stopped_ym; }
      else { delete out.recurring; delete out.recur_day; delete out.term_months; delete out.stopped_ym; }
      await App.putRecord('core', 'cash_outflow', out);
      if (!recChecked) this._setPeriodFor(date);
      App.closeModal(id);
      this.draw();
    });
  },
  repeat(id) {
    const src = this.records().find(o => o.id === id); if (!src) return;
    this.openModal(null, { date: App.todayLocal(), type: src.type, amount: src.amount, notes: src.notes });
  },

  async stop(id) {
    const rec = this.records().find(o => o.id === id); if (!rec) return;
    const ok = await App.confirm({ title: 'Stop this recurring outflow?', message: CashEngine._outflowLabel(rec.type) + ' will stop recurring. The months already logged stay in your bridge and forecast, it drops off going forward.', confirmText: 'Stop It', cancelText: 'Keep It' });
    if (!ok) return;
    const now = new Date(); const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await App.putRecord('core', 'cash_outflow', Object.assign({}, rec, { stopped_ym: App.ymdLocal(next).slice(0, 7) }));
    this.draw();
  },
  async del(id) {
    const rec = this.records().find(o => o.id === id); if (!rec) return;
    if (!(await App.confirmDelete())) return;
    await App.removeRecord('core', 'cash_outflow', id);
    this.draw();
  },

  wire() {
    document.getElementById('cb-save')?.addEventListener('click', () => this.saveAdd());
    document.getElementById('cb-clear')?.addEventListener('click', () => this.clearAdd());
    document.getElementById('cb-recur')?.addEventListener('change', (e) => { const w = document.getElementById('cb-term-wrap'); if (w) w.style.display = e.target.checked ? '' : 'none'; });
    this.container.querySelector('.card-collapse-head')?.addEventListener('click', (e) => App.toggleCollapse(e.currentTarget));
    App.applyCollapsed(this.container);
    this.container.onclick = async ev => {
      if (ev.target.closest('#cb-save') || ev.target.closest('#cb-clear') || ev.target.closest('.card-collapse-head')) return;
      if (ev.target.closest('#cb-export')) { App.exportPDF({ title: 'Cash Outflows', root: this.container }); return; }
      const pc = ev.target.closest('.cb-period');
      if (pc) { this._period = pc.dataset.p; this.draw(); return; }
      const ed = ev.target.closest('.cb-edit');
      if (ed) { const r = this.records().find(o => o.id === ed.dataset.id); if (r) this.openModal(r); return; }
      const rp = ev.target.closest('.cb-repeat');
      if (rp) { this.repeat(rp.dataset.id); return; }
      const st = ev.target.closest('.cb-stop');
      if (st) { await this.stop(st.dataset.id); return; }
      const dl = ev.target.closest('.cb-del');
      if (dl) { await this.del(dl.dataset.id); return; }
    };
  }
};
