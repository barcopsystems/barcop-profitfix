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
  TYPES: [['draw', 'Owner draw'], ['loan', 'Loan payment'], ['capital', 'Capital / equipment'], ['tax', 'Tax remittance'], ['other', 'Other']],

  open() {
    // Books area gate, same as its siblings — see the note in hub-operating-expenses.open().
    if (App._hubBlocked && App._hubBlocked('hub-books-home')) return;   // Books area gate
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
  _recurTag(o) {
    const f = o && o.frequency && o.frequency !== 'monthly' ? ' · ' + o.frequency : '';
    return ' <span style="color:var(--t4);font-size:10px;white-space:nowrap;">recurring' + f + '</span>';
  },
  typeOptions(sel) { return this.TYPES.map(([k, label]) => '<option value="' + k + '"' + ((sel || 'draw') === k ? ' selected' : '') + '>' + label + '</option>').join(''); },

  draw() {
    const b = this.periodBounds();
    this.container.innerHTML = '<div class="screen">'
      + this.statsCard()
      + this.addCard()
      + this.recurringSection()
      + this.loggedSection(b)
      + '</div>';
    this.wire();
  },

  // Top stat box (This Month / Year to Date / Recurring per month), matching the
  // Operating Expenses page. Reads CashEngine.outflowsBetween, which folds in the
  // projected recurring occurrences, so the month and year totals are real cash out.
  statsCard() {
    const today = App.todayLocal();
    const monthStart = today.slice(0, 7) + '-01';
    const yearStart = today.slice(0, 4) + '-01-01';
    const sumBetween = (s, e) => (CashEngine.outflowsBetween(s, e) || []).reduce((a, o) => a + (o.amount || 0), 0);
    const monthTotal = sumBetween(monthStart, today);
    const ytdTotal = sumBetween(yearStart, today);
    const recurMonthly = this.activeRecurring().reduce((a, o) => {
      const amt = parseFloat(o.amount) || 0;
      return a + (o.frequency === 'quarterly' ? amt / 3 : o.frequency === 'annual' ? amt / 12 : amt);
    }, 0);
    const fmt$ = v => App.fmtCurrency(v || 0);
    const stat = (label, val) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg">' + val + '</div></div>';
    return '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + stat('This Month', fmt$(monthTotal)) + stat('Year to Date', fmt$(ytdTotal)) + stat('Recurring / mo', fmt$(recurMonthly))
      + '</div></div>';
  },

  // ── Log a Cash Outflow (collapsible) ─────────────────────────────────────────
  addCard() {
    const body = '<div class="collapse-body">'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      +   '<div class="f" style="width:150px;"><label>Date Submitted</label><input type="date" value="' + App.todayLocal() + '" disabled title="When you logged this. Always today."/></div>'
      +   '<div class="f" style="width:150px;"><label>Due Date</label><input type="date" id="cb-date" value="' + App.todayLocal() + '"/></div>'
      +   '<div class="f" style="width:200px;"><label>Type</label><select class="form-input" id="cb-type">' + this.typeOptions('draw') + '</select></div>'
      +   '<div class="f" style="width:160px;"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="cb-amt" step="0.01" min="0" placeholder="0.00"/></div></div>'
      + '</div>'
      + '<div style="margin-top:14px;"><label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--t1);cursor:pointer;"><input type="checkbox" class="bc-check" id="cb-recur"/> Recurring (same amount each time)</label></div>'
      + '<div id="cb-term-wrap" style="margin-top:12px;display:none;">'
      +   '<div style="font-size:11px;color:var(--gold);margin-bottom:12px;max-width:540px;line-height:1.5;">Set the <b>Due Date</b> above to when this is next actually due. The schedule repeats from that date, not from today.</div>'
      +   '<div class="f" style="max-width:540px;"><label>How often</label><select id="cb-frequency" style="width:200px;"><option value="monthly">Monthly</option><option value="quarterly">Quarterly (every 3 months)</option><option value="annual">Annually (once a year)</option></select></div>'
      +   '<div class="f" style="max-width:540px;margin-top:12px;"><label>Ends after (months)</label><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><input type="number" class="suf" id="cb-term" min="1" step="1" placeholder="Ongoing" style="width:170px;flex:0 0 170px;"/><div style="font-size:11px;color:var(--t3);line-height:1.5;flex:1 1 200px;min-width:180px;">Leave blank and it recurs until you stop it. Set this only for one with a fixed payoff, like a loan.</div></div></div>'
      + '</div>'
      + App.noteField({ id: 'cb-note', placeholder: 'e.g. SBA loan, March draw' })
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
      // ⚠ COMPARED TO THE CURRENT MONTH, like every other reader of this field (round 4, F4). Bare
      // truthiness hid a series the whole app still considered live, and hid it somewhere with no
      // way back. Legacy records stamped by the old Stop (a FUTURE month, recurring still true) are
      // recovered by this: they show until the month they actually stop.
      /* ⚠⚠ ANY STOP MEANS NOT ACTIVE — "has the stop month ARRIVED" is the wrong question here.
         stopped_ym does two jobs, and they only diverge when a stop takes effect NEXT month, which
         is exactly what happens when this month's payment has already gone out. Asking <= cur then
         left a series the operator had just stopped sitting in the Recurring Outflows table with
         "Recurring / mo" still counting it: press Stop, and NOTHING on the page changes. That reads
         as a broken button, and the rate claim is wrong too — there are no payments left.
         The MONEY still asks the month question, correctly and separately (outflowsBetween keeps
         every occurrence before the stop). This is a question about whether a series is live. */
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
          // The amount is the per-occurrence figure, so label it by the actual
          // frequency. A $3,000 quarterly loan payment is "$3,000 /qtr", not
          // "$3,000 /mo" (that read as 3x its real monthly cost and contradicted
          // the monthly-normalized "Recurring / mo" stat above).
          const freqSuf = o.frequency === 'quarterly' ? ' /qtr' : o.frequency === 'annual' ? ' /yr' : ' /mo';
          return '<tr>'
            + '<td data-label="Type" style="color:var(--t1);">' + esc(CashEngine._outflowLabel(o.type)) + this._recurTag(o) + '</td>'
            + '<td data-label="Note" style="color:var(--t2);">' + esc(o.notes || '') + '</td>'
            + '<td data-label="Status" style="color:var(--t3);">' + status + '</td>'
            + '<td data-label="Amount" style="font-weight:700;color:var(--t1);white-space:nowrap;">' + App.fmtCurrency(o.amount) + '<span style="color:var(--t3);font-weight:400;font-size:11px;">' + freqSuf + '</span></td>'
            + '<td class="no-print" style="text-align:right;white-space:nowrap;"><button class="btn btn-ghost btn-sm cb-stop" data-id="' + esc(o.id) + '">Stop</button> <button class="btn btn-ghost btn-sm cb-edit" data-id="' + esc(o.id) + '">Edit</button> <button class="btn btn-danger btn-sm cb-del" data-id="' + esc(o.id) + '">Delete</button></td>'
            + '</tr>';
        }).join('')
      : '<tr><td colspan="5" style="padding:12px;color:var(--t3);font-size:12px;text-align:center;">No recurring outflows. Check Recurring when you log a draw or loan that repeats.</td></tr>';
    const chip = ([k, label]) => '<button class="btn btn-ghost btn-sm cb-period" data-p="' + k + '" style="' + this.onSel(this._period === k) + '">' + label + '</button>';
    const controlRow = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + this.PERIODS.map(chip).join('') + '</div>'
      + '<button class="btn btn-ghost btn-sm no-print" id="cb-export">Export PDF</button>'
      + '</div>';
    return controlRow
      + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="width:100%;">'
      + '<thead><tr><th>Type</th><th>Note</th><th>Status</th><th>Amount</th><th class="no-print"></th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>';
  },

  // ── Logged Outflows: one-time outflows in the selected period ─────────────────
  loggedSection(b) {
    // ⚠ A STOPPED SERIES BELONGS HERE TOO, or it is in no table at all (round 4, F4). Covers both
    // the new shape (recurring:false) and any legacy row still carrying recurring:true with a
    // stopped_ym that has already arrived.
    /* ⚠⚠ A SERIES IS NOT A DATED PAYMENT, SO THE PERIOD CHIP MUST NOT HIDE IT (round 6 — the
       round-4 unreachable-record defect coming back through a different gate). A series' date is
       its FIRST due date, and the widest chip is Last Quarter, so any loan older than about three
       months fell out of every chip once it was stopped: measured, series started 4, 8 and 14 months
       ago all reachable from NOWHERE — no Edit, no Delete, no resume — while the engine still held
       the record. A series whose term simply RAN OUT did the same without anyone pressing Stop.
       ⚠ The pin that claimed this was fixed (S5c) is a source-text tripwire on the recurring clause
       and never exercised the date filter, so it passed on a false claim. Rewritten to run the real
       filters. */
    const _cur = App.todayLocal().slice(0, 7);
    const _ended = (o) => {
      const e = (window.CashEngine && CashEngine.recurringEndYm) ? CashEngine.recurringEndYm(o) : null;
      return !!(e && e < _cur);
    };
    // ⚠ AND THE MIRROR: anything that left the active list above has to land here, or it is in no
    // table at all. Same predicate, same reason — a stop stamp of any month means dormant.
    const _dormantSeries = (o) => !!(o.stopped_ym || (o.recurring && _ended(o)));
    const recs = this.records().filter(o => o && o.id
        && (!o.recurring || _dormantSeries(o))
        && (_dormantSeries(o) || ((o.date || '') >= b.s && (o.date || '') <= b.e)))
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
    return '<div class="sh" style="margin:24px 0 10px;">Logged Outflows</div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="width:100%;">'
      + '<thead><tr><th>Date</th><th>Type</th><th>Note</th><th>Amount</th><th class="no-print"></th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>';
  },

  /* ── ⭐⭐⭐ THE ONE WRITE PATH — PHASE 1 STEP 7 OF THE ONE-LEDGER REBUILD ──────────────────────
     Every dollar that leaves the bank belongs in ONE ledger. Phase 1 copied the existing outflows
     into `operating_expenses` under the five cash-only categories; these two helpers are what stop
     the store drifting apart again, by making every door on this screen write BOTH places.

     ⛔ WHY THE WRITE MOVES BEFORE THE READ, and it is the opposite of what the plan said. Pointing
     `CashEngine.cashOutflows()` at the ledger first would mean every outflow logged afterwards is
     written HERE, to the old store, and read from nowhere — it vanishes from the Cash Bridge, the
     13-week forecast and Safe to Spend, silently, with the screen still showing it. So the write
     moves first: the reader stays on `cash_outflows`, nothing on screen changes, and the ledger
     quietly becomes complete. The reader flips afterwards, against a ledger that is already whole.

     ⛔ ONE MAPPING, NEVER TWO. The ledger row is built by `migrateCashOutflowRow` — the same pure
     function the migration uses. A second hand-rolled shape here would agree with it today and
     diverge the first time either is touched, which is the exact drift this rebuild exists to end.

     ⛔⛔⛔ THE ORDER IS CHOSEN SO THERE IS ONLY EVER ONE DIRECTION OF DRIFT, AND MY FIRST VERSION
     GOT THIS WRONG. Two stores cannot be written in one request, so a refusal between the two
     halves is always reachable. The obvious answer — write the ledger first and roll it back if the
     old store refuses — DOES NOT WORK, because the rollback is a write to the same connection that
     just refused one: it fails exactly when it is needed. Pinned and measured: a refused EDIT left
     the ledger holding $9,999 while the old store kept $1,000, so a save the operator was TOLD had
     failed would have quietly become real at the cutover.

     So neither half rolls back. The order makes the residue harmless instead:
       · a WRITE does the old store FIRST — a refused ledger write leaves the ledger MISSING a row
       · a DELETE does the ledger FIRST — so a refused old-store delete also leaves the ledger
         MISSING a row, never holding one the operator deleted
     Every failure lands in the same state: the ledger is behind the old store, never ahead of it
     and never disagreeing in a direction that invents money. `reconcileCashOutflowLedger` repairs
     exactly that, additively, on the next load. Nothing has to undo anything.

     ⚠ A union read ("both stores, deduped by id") was considered instead and it RESURRECTS DELETED
     RECORDS — the delete removes the ledger row and the old-store row is picked straight back up.
     Maintaining both until the old store is dropped in Phase 5 is the only shape without that hole. */
  async _writePair(rec) {
    // The operator's record first, so what they see on screen is exactly what it was before this
    // step existed. Their save succeeds or fails on its own merits, never on the ledger's.
    if (!(await App.putRecord('core', 'cash_outflow', rec))) return false;   // it reported why
    /* Best effort, and QUIET on purpose: their outflow IS saved, so "save failed" would be a lie
       about a store they have never heard of. A refused write here leaves the ledger one row light
       and the reconcile puts it back on the next load. */
    await App.putRecord('core', 'operating_expense',
      S.HubOperatingExpenses.migrateCashOutflowRow(rec), { quiet: true });
    return true;
  },
  /* The mirror image, and the order is reversed for the same reason. Taking the ledger row out
     first means a refused old-store delete leaves the record whole in both places — the operator is
     told, the row is still on screen, and the reconcile restores the ledger twin. Deleting the old
     store first would leave a ledger row nobody can reach, and that row comes BACK at the cutover as
     an outflow the operator deleted. A row whose ledger twin was never created (a bar whose
     migration has not run — it refuses to run off a cache-served load) still deletes cleanly,
     because removing a row that is not there is a successful delete. */
  async _deletePair(id) {
    // Never delete somebody else's row on an id collision. `reconcileCashOutflowLedger` refuses to
    // REWRITE a row it did not create for the same reason, and the two should not disagree. A
    // missing twin is not an error: removing a row that is not there is a successful delete, which
    // is what a bar whose migration has not run depends on.
    const led = S.HubOperatingExpenses.records().find(r => r && r.id === id) || null;
    if (!led || led.migrated_from === 'cash_outflow') {
      if (!(await App.removeRecord('core', 'operating_expense', id))) return false;
    }
    return App.removeRecord('core', 'cash_outflow', id);
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
    /* ⚠ CLEAR IT FIRST. A refused save now returns without redrawing (so the typed values survive
       the retry), and nothing else hid this line — so the previous attempt's "Pick a date." sat on
       screen over a save that failed for an entirely different reason, with the real cause in a
       toast somewhere else. Every attempt starts from a clean slate. */
    const errEl = g('cb-err'); if (errEl) errEl.style.display = 'none';
    if (!date) { showErr('Pick a date.'); return; }
    if (isNaN(amount) || amount <= 0) { showErr('Enter an amount above zero.'); return; }
    if (recur && g('cb-term')?.value && (isNaN(term) || term < 1)) { showErr('A fixed term must be 1 month or more, or leave it blank to recur until you stop it.'); return; }
    const rec = { id: App.uid(), date, type, amount, notes: note, created_at: new Date().toISOString() };
    if (recur) { rec.recurring = true; rec.frequency = g('cb-frequency')?.value || 'monthly'; rec.recur_day = parseInt(String(date).slice(8, 10), 10) || 1; if (term && term > 0) rec.term_months = term; }
    // A refused save leaves the form exactly as typed — no redraw — so the retry is one press, not
    // a re-entry. putRecord has already said why.
    if (!(await this._writePair(rec))) return;
    if (!recur) this._setPeriodFor(date);
    this.draw();
  },
  clearAdd() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('cb-date', App.todayLocal()); set('cb-amt', ''); set('cb-note', ''); set('cb-term', '');
    const t = document.getElementById('cb-type'); if (t) t.selectedIndex = 0;
    const fq = document.getElementById('cb-frequency'); if (fq) fq.selectedIndex = 0;
    const r = document.getElementById('cb-recur'); if (r) r.checked = false;
    const w = document.getElementById('cb-term-wrap'); if (w) w.style.display = 'none';
    const e = document.getElementById('cb-err'); if (e) e.style.display = 'none';
  },

  // record = the row being edited; prefill = starting values for a new entry (Repeat).
  openModal(record, prefill) {
    const isEdit = !!record;
    const rec = record || prefill || { id: '', date: App.todayLocal(), type: 'draw', amount: '', notes: '', recurring: false };
    const id = 'cb-modal';
    /* ⚠⚠ A STOPPED SERIES MUST NOT OPEN WITH "RECURRING" STILL TICKED. Round 5 made Stop keep
       `recurring: true` and mark the month instead — right, because this store PROJECTS its history
       from the parent and clearing the flag deleted every payment ever made. But `seriesOn` still
       read the raw flag, so a series the operator had just stopped opened its edit form claiming to
       be live, while the page around it said the opposite: the row sits in Logged Outflows, the
       status column reads stopped, and Recurring / mo excludes it. `stopped_ym` is what "stopped"
       means on this door now, so the form has to read it too — and ticking the box then means what
       it says: resume. */
    const seriesOn = !!rec.recurring && !rec.stopped_ym;
    const freqOpt = (v, lbl) => '<option value="' + v + '"' + (rec.frequency === v || (!rec.frequency && v === 'monthly') ? ' selected' : '') + '>' + lbl + '</option>';
    const recurHtml = '<div style="margin-top:14px;"><label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--t1);cursor:pointer;"><input type="checkbox" class="bc-check" id="cb-f-recur"' + (seriesOn ? ' checked' : '') + '/> Recurring (same amount each time)</label></div>'
      + '<div id="cb-f-term-wrap" style="margin-top:12px;' + (seriesOn ? '' : 'display:none;') + '">'
      +   '<div style="font-size:11px;color:var(--gold);margin-bottom:12px;max-width:540px;line-height:1.5;">Set the <b>Due Date</b> above to when this is next due. The schedule repeats from that date.</div>'
      +   '<div class="f" style="max-width:540px;"><label>How often</label><select id="cb-f-frequency" style="width:200px;">' + freqOpt('monthly', 'Monthly') + freqOpt('quarterly', 'Quarterly (every 3 months)') + freqOpt('annual', 'Annually (once a year)') + '</select></div>'
      +   '<div class="f" style="max-width:540px;margin-top:12px;"><label>Ends after (months)</label><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><input type="number" class="suf" id="cb-f-term" min="1" step="1" value="' + esc(rec.term_months || '') + '" placeholder="Ongoing" style="width:170px;flex:0 0 170px;"/><div style="font-size:11px;color:var(--t3);line-height:1.5;flex:1 1 200px;min-width:180px;">Leave blank and it recurs until you stop it. Set this only for one with a fixed payoff, like a loan.</div></div></div>'
      + '</div>';
    const html = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">' + (isEdit ? 'Edit Outflow' : 'Repeat Outflow') + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      +   '<div class="f"><label>Date Submitted</label><input type="date" value="' + esc((rec.created_at || '').slice(0, 10) || rec.date || App.todayLocal()) + '" disabled/></div>'
      +   '<div class="f"><label>Due Date</label><input type="date" id="cb-f-date" value="' + esc(rec.date) + '"/></div>'
      +   '<div class="f"><label>Type</label><select class="form-input" id="cb-f-type">' + this.typeOptions(rec.type) + '</select></div>'
      +   '<div class="f"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="cb-f-amt" step="0.01" min="0" value="' + esc(rec.amount === '' ? '' : String(rec.amount)) + '" placeholder="0.00"/></div></div>'
      + '</div>'
      + recurHtml
      + App.noteField({ id: 'cb-f-note', value: rec.notes, placeholder: 'e.g. SBA loan, March draw' })
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
      // Same reason as the Add form: the modal now STAYS OPEN on a refusal, so a stale refusal
      // message would otherwise outlive the attempt it was about.
      const _e0 = document.getElementById('cb-f-err'); if (_e0) _e0.style.display = 'none';
      if (!date) { showErr('Pick a date.'); return; }
      if (isNaN(amount) || amount <= 0) { showErr('Enter an amount above zero.'); return; }
      if (recChecked && document.getElementById('cb-f-term')?.value && (isNaN(termV) || termV < 1)) { showErr('A fixed term must be 1 month or more, or leave it blank.'); return; }
      const base = isEdit ? (this.records().find(o => o.id === rec.id) || {}) : {};
      const out = Object.assign({}, base, { id: isEdit ? rec.id : App.uid(), date, type, amount, notes: note, created_at: base.created_at || new Date().toISOString() });
      if (recChecked) {
        /* ⚠⚠ TURNING A PAUSED OUTFLOW BACK ON MUST NOT RE-INVENT THE PAUSE (round 5, and the
           expense twin learned this three rounds ago). This store PROJECTS its past, so simply
           clearing stopped_ym re-created every month the series was suspended: measured, three
           paused months worth $5,550 reappearing in Year to Date and in the Cash Bridge, which then
           attributes profit to payments that were never made. `skip_months` is the mechanism the
           expense door already uses AND that CashEngine.outflowsBetween has been READING on this
           store the whole time with nothing to write it.
           ⚠ AND A RESUME THAT CAN GENERATE NOTHING MUST SAY SO, not close the modal on a record
           that then falls out of both tables — the round-4 unreachable-record defect coming back in
           through the Resume door. */
        /* ⚠ THE FIELD IS THE ANSWER, NOT THE STORED VALUE (round 6). Falling back to the stored term
           when the box is blank meant that CLEARING "Ends after" — which this refusal's own message
           tells the operator to do — re-derived the finished term and refused again. A dead end whose
           only escape was guessing that the other half of the sentence worked. Line 283 already
           treats a blank box as Ongoing; this now agrees with it, and with the expense twin. */
        /* ⚠⚠ ONLY ON A GENUINE RESUME — the same gate the expense twin got, and this door was
           written without it. The checkbox is PRE-TICKED for a live series, so an unguarded refusal
           fired on every ordinary edit to a series whose term had run out: change the note or the
           amount and the save is refused, with advice about a schedule the operator never touched.
           On this store "paused" means a stop stamp, not a cleared flag (see seriesOn above). */
        const _wasPaused = !base.recurring || !!base.stopped_ym;
        const _termNow = (termV && termV > 0) ? termV : 0;
        const _endYm = _termNow > 0 ? CashEngine.recurringEndYm(Object.assign({}, base, { date: date, term_months: _termNow })) : null;
        if (_wasPaused && _endYm && _endYm < App.todayLocal().slice(0, 7)) {
          showErr('That fixed term has already finished. Change the date to when it next starts, or clear "Ends after" to keep it going.');
          return;
        }
        out.recurring = true;
        out.frequency = document.getElementById('cb-f-frequency')?.value || 'monthly';
        out.recur_day = parseInt(String(date).slice(8, 10), 10) || 1;
        if (termV && termV > 0) out.term_months = termV; else delete out.term_months;
        // ⚠ SHAPE-CHECKED AND BOUNDED (round 6). A corrupt stamp of '0001-01' generated 24,306
        // skip entries — with unpadded year keys — and WROTE them to the record. A pause nobody
        // could have taken is not a pause; refuse the stamp rather than trusting it.
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(base.stopped_ym || ''))) {
          const idx = (mk) => parseInt(mk.slice(0, 4), 10) * 12 + (parseInt(mk.slice(5, 7), 10) - 1);
          const skips = Array.isArray(base.skip_months) ? base.skip_months.slice() : [];
          const from = idx(String(base.stopped_ym)), to = idx(App.todayLocal().slice(0, 7));
          for (let i = Math.max(from, to - 240); i < to; i++) {
            const m = Math.floor(i / 12) + '-' + String((i % 12) + 1).padStart(2, '0');
            if (skips.indexOf(m) < 0) skips.push(m);
          }
          out.skip_months = skips;
        }
        delete out.stopped_ym;
      }
      /* ⚠⚠ A PAUSE MUST NOT DESTROY WHAT THE SERIES IS (round 4, F2 — the same defect round 3 fixed
         on the Operating Expenses twin, still live here). Deleting frequency and term_months was
         harmless while turning a series off was terminal; the moment it can be turned back on, the
         re-opened form falls back to "Monthly" and blank. Measured on a $24,000 ANNUAL loan with a
         36-month term: the weekly nut went $461.54 -> $5,538.46 (12x), the reserve target $3,692 ->
         $44,308, Safe to Spend moved by $40,615, three months of forecast went $0 -> $72,000, and the
         status flipped from "Ends Apr 2029" to "Ongoing". The Anchor Bar seed ships exactly one
         record this bites: the 24-month equipment loan. */
      /* ⚠⚠ ONLY A ROW THAT WAS RECURRING GETS A STOP STAMP (round 6). This branch runs for EVERY
         non-recurring save — a plain logged payment, and the Repeat button — so an ordinary edit
         stamped stopped_ym on a one-off payment. CashEngine gates the "the operator already logged
         this" token on !o.stopped_ym, so the stamped row stopped counting as a payment and the
         matching series occurrence was projected on top of it: measured, a no-op Edit taking this
         month from $1,850 to $3,700. The expense twin already carries this exact guard, with the
         comment "a plain expense never had a series"; the outflow door was written without it. */
      else {
        const _wasRec = !!base.recurring;
        delete out.recurring; delete out.recur_day;
        if (_wasRec) out.stopped_ym = base.stopped_ym || App.todayLocal().slice(0, 7);
        else delete out.stopped_ym;
      }
      // The modal stays OPEN on a refusal, or the edit the operator just typed is gone and the only
      // record of it is a failure message over the old values.
      if (!(await this._writePair(out))) return;
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
    /* ⚠⚠ STOP LEFT THE RECORD UNREACHABLE (round 4, F4). It wrote stopped_ym while KEEPING
       recurring: true — and activeRecurring drops anything with a stopped_ym at all while the
       logged table shows only !o.recurring, so the row fell out of BOTH tables: no Edit, no
       Delete, no way to resume, "Recurring / mo" reading $0.00 — while CashEngine still held
       $507.69/wk of reserve against it and still charged this month's payment, because the engine
       correctly compares stopped_ym to the CURRENT month.
       Now identical to the Operating Expenses twin: recurring:false plus the current month. The
       row lands in the logged table, stays editable, and every engine reader already tests
       recurring first. */
    /* ⚠⚠⚠ recurring:false ERASES THE HISTORY ON THIS STORE, AND ROUND 4 COPIED IT ACROSS A BOUNDARY
       WHERE IT IS NOT SAFE. The two doors keep the past DIFFERENTLY: Operating Expenses writes a
       real child row for every elapsed month, so clearing the flag costs nothing — cash outflows
       write NOTHING and PROJECT the past from the parent, so clearing it deletes every payment the
       series ever made. Measured on an 8-month-old $1,850 loan: Year to Date $12,950 -> $0.00 and
       the Cash Bridge's "Cash You Kept" jumping $16,150 -> $18,000, on a screen whose whole job is
       showing where the profit went — under a confirm dialog that had just promised "the months
       already logged stay in your bridge and forecast".
       `stopped_ym` alone is the right marker here and every engine reader already honours it: the
       projection stops at that month and keeps everything before it. The round-4 defect was the two
       TABLES hiding the row, and those filters are fixed; the record shape did not need changing. */
    /* ⚠⚠ STOP FROM THE NEXT PAYMENT, NOT FROM THE START OF THIS MONTH (found on screen by Kyle,
       2026-07-28 — the last surviving piece of the round-4 error). The engine drops every occurrence
       in or after `stopped_ym`, so stamping the CURRENT month erased a payment that had already
       fallen due: measured on the Anchor Bar, a $2,200 loan due the 12th, stopped on the 28th, took
       Year to Date $39,000 → $36,800 and removed the "Loan payments" line from the Cash Bridge for
       this month while last month kept its own. Money that has left the bank is not undone by
       cancelling the schedule, and the confirm dialog above promises exactly that.
       ⚠ NEITHER FLAT RULE IS RIGHT. Stamping NEXT month (the pre-round-4 behaviour) keeps a payment
       that has NOT fallen due yet — press Stop on the 5th for a bill due the 12th and it still gets
       charged. The rule the dialog already states is the correct one: occurrences that have not
       happened yet stop, ones that have stay. So the stamp is next month only when this month's
       occurrence is already behind us. */
    const _today = App.todayLocal(), _cur = _today.slice(0, 7);
    const _y = parseInt(_cur.slice(0, 4), 10), _m0 = parseInt(_cur.slice(5, 7), 10) - 1;
    const _base = new Date(String(rec.date || '').length <= 10 ? rec.date + 'T00:00:00' : rec.date);
    const _step = rec.frequency === 'quarterly' ? 3 : rec.frequency === 'annual' ? 12 : 1;
    let _dueAlready = false;
    if (!isNaN(_base.getTime())) {
      const _startIdx = _base.getFullYear() * 12 + _base.getMonth(), _curIdx = _y * 12 + _m0;
      // Only a month this series actually recurs in can have an occurrence to protect.
      if (_curIdx >= _startIdx && (_curIdx - _startIdx) % _step === 0) {
        const _dim = new Date(_y, _m0 + 1, 0).getDate();
        const _day = Math.min(parseInt(rec.recur_day, 10) || _base.getDate() || 1, _dim);
        _dueAlready = (_cur + '-' + String(_day).padStart(2, '0')) <= _today;
      }
    }
    const _nextD = new Date(_y, _m0 + 1, 1);
    const _stopYm = _dueAlready ? App.ymdLocal(_nextD).slice(0, 7) : _cur;
    // A refused stop must not redraw as though it worked — the confirm dialog has just promised the
    // series is stopped. putRecord has already said why; the table still shows it active, correctly.
    if (!(await this._writePair(Object.assign({}, rec, { stopped_ym: _stopYm })))) return;
    this.draw();
  },
  async del(id) {
    const rec = this.records().find(o => o.id === id); if (!rec) return;
    if (!(await App.confirmDelete())) return;
    await this._deletePair(id);
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
      /* ⚠ THE PERIOD GOES IN `range` — the same defect as the Cash Bridge, in its twin. Both
         screens carry the identical four-chip period selector, and both wrote every view to
         "<Bar> - Cash Outflows - <today>.pdf", so saving This Month and then Last Quarter left
         one file. Found by widening verify-export-states-its-period's census, which had gated
         its whole sweep on App.filterChips( and could not see a hand-rolled selector at all. */
      if (ev.target.closest('#cb-export')) {
        const p = (this.PERIODS.find(([k]) => k === this._period) || [null, ''])[1];
        App.exportPDF({ title: 'Cash Outflows', root: this.container, range: p });
        return;
      }
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
