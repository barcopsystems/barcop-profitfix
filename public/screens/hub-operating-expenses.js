'use strict';

/* ── Hub Operating Expenses Log ──────────────────────────────────────────────
   A Hub-owned view under Accounting. Per-entry log of operating expenses
   (rent, utilities, insurance, marketing, professional fees, bank/CC fees,
   licenses/permits, software/subscriptions, other). Books reads this log
   to fill the Income Statement Operating Expenses placeholder lines so the
   operator's accountant does not have to type them in by hand.

   Two-doors call: Repairs and Maintenance lives in Shift Control's
   sc_maintenance log. 3rd-Party Platform Fees live in the weekly P&L roll.
   Operating Expenses Log does NOT include those categories to avoid
   double-counting in Books.

   Sample data deferred per the pre-launch sample-data overhaul. */

S.HubOperatingExpenses = {

  // Locked category enum. Dropdown-only on the entry form. Books pulls from
  // these names by exact match — do not rename without updating Books too.
  CATEGORIES: [
    'Occupancy (Rent, Property Tax)',
    'Utilities',
    'Insurance',
    'Marketing and Advertising',
    'Professional Fees',
    'Bank and Credit Card Fees',
    'Licenses and Permits',
    'Software and Subscriptions',
    'Other'
  ],

  _tab:            'current',
  _entryMode:      'manual',   // manual | import (Add Expense form)
  _histShown:      0,          // History log window (0 = default to LIST_PAGE)
  _filterCategory: 'all',
  _filterRange:    'this-month',

  records() {
    if (!Array.isArray(App.data.operating_expenses)) App.data.operating_expenses = [];
    return App.data.operating_expenses;
  },

  // ── Entry ───────────────────────────────────────────────────────────────
  // Is this page still the one on screen? See the note in App._mountSeq — the Hub content host is
  // permanent, so isConnected can never answer this.
  _catchUpStillCurrent() { return this._mountedAt === App._mountSeq; },

  open() {
    App.openHubFullPage('Operating Expenses', (mount) => {
      this.container = mount;
      this._mountedAt = App._mountSeq;   // stamped inside the mount callback, AFTER openHubFullPage bumps it
      this.renderMain();
    }, 'operating-expenses');
  },

  // ── Period helpers ──────────────────────────────────────────────────────
  _monthKey(dateStr) {
    if (!dateStr) return '';
    return String(dateStr).slice(0, 7);
  },
  _currentMonthKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  },
  _priorMonthKey(monthKey) {
    const y = parseInt(monthKey.slice(0, 4), 10);
    const m = parseInt(monthKey.slice(5, 7), 10);
    let py = y, pm = m - 1;
    if (pm < 1) { pm = 12; py = y - 1; }
    return py + '-' + String(pm).padStart(2, '0');
  },
  _monthLabel(monthKey) {
    if (!monthKey || monthKey.length < 7) return monthKey;
    const y = parseInt(monthKey.slice(0, 4), 10);
    const m = parseInt(monthKey.slice(5, 7), 10) - 1;
    const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return (names[m] || '') + ' ' + y;
  },

  // Total revenue for a calendar month from the weekly rolls. Matches the
  // income statement's revenue base (bar + food + catering + other) so the
  // "% of Revenue" reads here agree with Books.
  _weekRev(w) {
    return (parseFloat(w.bar?.revenue) || 0) + (parseFloat(w.food?.revenue) || 0)
      + (parseFloat(w.catering?.revenue) || 0) + (parseFloat(w.other?.revenue) || 0);
  },
  _revenueForMonth(monthKey) {
    return (App.data?.weeks || []).filter(w => this._monthKey(w.period_end) === monthKey)
      .reduce((s, w) => s + this._weekRev(w), 0);
  },

  // Revenue year-to-date through the given month.
  _revenueYTD(monthKey) {
    const year = monthKey.slice(0, 4);
    return (App.data?.weeks || []).filter(w => {
      const mk = this._monthKey(w.period_end);
      return mk && mk.slice(0, 4) === year && mk <= monthKey;
    }).reduce((s, w) => s + this._weekRev(w), 0);
  },

  // ── Aggregation ────────────────────────────────────────────────────────
  _sumMonth(monthKey) {
    return this.records().filter(r => this._monthKey(r.date) === monthKey)
      .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  },
  _sumYTD(monthKey) {
    const year = monthKey.slice(0, 4);
    return this.records().filter(r => {
      const mk = this._monthKey(r.date);
      return mk && mk.slice(0, 4) === year && mk <= monthKey;
    }).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  },
  _sumMonthByCategory(monthKey) {
    const out = {};
    this.CATEGORIES.forEach(c => { out[c] = 0; });
    this.records().filter(r => this._monthKey(r.date) === monthKey).forEach(r => {
      const c = this.CATEGORIES.includes(r.category) ? r.category : 'Other';
      out[c] = (out[c] || 0) + (parseFloat(r.amount) || 0);
    });
    return out;
  },
  _sumYTDByCategory(monthKey) {
    const year = monthKey.slice(0, 4);
    const out = {};
    this.CATEGORIES.forEach(c => { out[c] = 0; });
    this.records().filter(r => {
      const mk = this._monthKey(r.date);
      return mk && mk.slice(0, 4) === year && mk <= monthKey;
    }).forEach(r => {
      const c = this.CATEGORIES.includes(r.category) ? r.category : 'Other';
      out[c] = (out[c] || 0) + (parseFloat(r.amount) || 0);
    });
    return out;
  },

  // ── Recurring bills ──────────────────────────────────────────────────────
  // A recurring bill is the parent record (recurring:true). It is ongoing by
  // default (recurs every month until the operator stops it); an optional
  // term_months makes it stop after a fixed number of payments. Each elapsed
  // month gets a generated child entry (recurring_parent) with the same cost.
  // Only months that have actually arrived are created, never future months, so
  // Books only ever shows recurring costs through this month. Honest by
  // [[output-honesty]]: the operator confirmed a fixed monthly cost, so filling in
  // each elapsed month is calculating from what they entered.
  _daysInMonth(y, m0) { return new Date(y, m0 + 1, 0).getDate(); },

  // ⚠ Generated rows are NOT put into memory until the server has them. What shipped pushed each
  // child into the live list and then fired the write without awaiting or checking it — so a
  // failed write left Books, the P&L and breakeven counting operating expenses the server never
  // received, until the next reload silently removed them. This runs from App.boot(), so it is
  // every login. These rows are derived (regenerated from the parent on any later load), which is
  // exactly why waiting for confirmation costs nothing.
  // No caller uses the return value, so making this async is safe.
  //
  // ⚠ SERIALIZED, and it has to be. The dedupe set `have` below is built from `arr`, but the
  // generated rows deliberately do not reach `arr` until the server confirms them — so for the whole
  // round-trip the dedupe is BLIND to them. All three callers fire without awaiting (App.boot():676
  // at every login, plus renderMain / renderHistory), so a second pass entered inside that window
  // saw an empty `have` and regenerated every owed month with fresh App.uid()s. Both sets persist
  // (the server key is the id) and the rows are byte-identical apart from it, so a $4,200 rent with
  // three owed months landed in Books, the P&L, breakeven and prime cost as $25,200 instead of
  // $12,600, permanently and invisibly. One click inside the round-trip on the first login of a new
  // month is enough: Expense History, saving, deleting, or stopping a bill all reach _rerender.
  // CHAINING, not dropping the second call: an operator who adds a back-dated bill while the boot
  // pass is still in flight must still get that bill's months. Each pass reads `arr` only after the
  // previous one has pushed into it, so overlap is impossible and nothing is skipped.
  catchUpRecurring() {
    const run = () => this._catchUpOnce();
    const chain = this._catchUpChain ? this._catchUpChain.then(run) : run();
    // A rejected pass must not become an unhandledrejection: App.boot() (app.js:682) fires this
    // without awaiting or catching, and a call with nothing chained after it has no other handler.
    // Swallow+log at the tail; the caught promise is what the next call chains onto, so a failed
    // pass still lets a later back-dated bill catch up, and passes stay serialized (never overlap).
    this._catchUpChain = chain.catch(e => { try { DB.logClientError('opex_catchup', (e && e.message) || String(e), (e && e.stack) || '', 'hub-operating-expenses'); } catch (e2) {} });
    return this._catchUpChain;
  },
  _catchUpChain: null,

  async _catchUpOnce() {
    // Never generate derived rows from a picture the app admits is incomplete. Its peers already
    // refuse to (profit-fix.js:101 and r-fix.js open with the same _dataReady test, and
    // App._maybeAutoBackup bails on _loadDegraded); this one checked neither. A degraded load is
    // served from a cache that can be months stale and is missing the children, so the dedupe cannot
    // see them and would mint new ids for months that already exist — the same double-booking by a
    // different door. Nothing is lost by waiting: these rows are derived and regenerate from the
    // parent on any later clean load.
    if (!App.data || !DB._dataReady || DB._loadDegraded) return false;
    const arr = this.records();
    const now = new Date();
    const curIdx = now.getFullYear() * 12 + now.getMonth();
    const parents = arr.filter(r => r && r.recurring && !r.recurring_parent && r.date);
    let added = false; const newRecs = [];
    parents.forEach(p => {
      const start = new Date(String(p.date).length <= 10 ? p.date + 'T00:00:00' : p.date);
      if (isNaN(start.getTime())) return;
      const startIdx = start.getFullYear() * 12 + start.getMonth();
      const term = parseInt(p.term_months, 10);
      const recurDay = p.recur_day || start.getDate();
      // Recurrence interval in months: monthly (1), quarterly (3), annual (12).
      const step = p.frequency === 'quarterly' ? 3 : p.frequency === 'annual' ? 12 : 1;
      // Ongoing (no term) fills through the current month; a fixed term stops at its end.
      const lastIdx = term > 0 ? Math.min(curIdx, startIdx + term - 1) : curIdx;
      const have = new Set([start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0')]);
      arr.forEach(r => { if (r.recurring_parent === p.id && r.date) have.add(String(r.date).slice(0, 7)); });
      for (let idx = startIdx + step; idx <= lastIdx; idx += step) {
        const yy = Math.floor(idx / 12), mm = idx % 12;
        const mk = yy + '-' + String(mm + 1).padStart(2, '0');
        if (have.has(mk)) continue;
        const dd = Math.min(recurDay, this._daysInMonth(yy, mm));
        const child = {
          id: App.uid ? App.uid() : ('oex-' + idx + '-' + p.id),
          date: mk + '-' + String(dd).padStart(2, '0'),
          category: p.category, vendor: p.vendor, amount: p.amount, notes: p.notes,
          recurring_parent: p.id,
          created_at: new Date().toISOString()
        };
        newRecs.push(child);   // NOT pushed into arr yet — see the note on this function
        have.add(mk);
        added = true;
      }
    });
    if (!newRecs.length) return false;
    // quiet: this fires from a boot and from a render, never from something the operator did.
    if (!(await App.putRecordsBulk('core', 'operating_expense', newRecs, { quiet: true }))) return false;
    arr.push(...newRecs);
    // Re-render once, and only on success, so the screen picks up the caught-up months. Cannot
    // loop: the dedupe above finds them already present next time and generates nothing.
    // ⚠ This USED to ask `this.container.isConnected`, which can never be false: `.hub-app .content`
    // is a permanent host that navigation merely empties and refills. So a catch-up that landed
    // after the operator clicked Permits repainted Operating Expenses over it, with the sidebar
    // still highlighting Permits. App._mountSeq is bumped on every mount, so a changed value means
    // this page is no longer the one on screen.
    if (this._catchUpStillCurrent()) {
      if (this._view === 'history') this.renderHistory(); else this.renderMain();
    }
    return added;
  },

  // Banner for recurring terms within ~2 months of ending or already ended.
  _termWarning() {
    const now = new Date();
    const curIdx = now.getFullYear() * 12 + now.getMonth();
    const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const lbl = (idx) => MON[idx % 12] + ' ' + Math.floor(idx / 12);
    const ending = this.records().filter(r => r && r.recurring && !r.recurring_parent && r.date && parseInt(r.term_months, 10) > 0).map(p => {
      const s = new Date(String(p.date).length <= 10 ? p.date + 'T00:00:00' : p.date);
      if (isNaN(s.getTime())) return null;
      const endIdx = s.getFullYear() * 12 + s.getMonth() + parseInt(p.term_months, 10) - 1;
      const rem = endIdx - curIdx;
      if (rem > 2) return null;
      return (p.vendor || p.category || 'Recurring bill') + (rem < 0 ? ' (ended ' + lbl(endIdx) + ')' : ' (ends ' + lbl(endIdx) + ')');
    }).filter(Boolean);
    if (!ending.length) return '';
    return '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Recurring Terms Ending</div>'
      + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">' + esc(ending.join(', ')) + '. Renew or update the term in the edit form, or it stops adding after the end month.</div>'
      + '</div>';
  },

  // ── Filter ─────────────────────────────────────────────────────────────
  _filteredRecords() {
    let recs = this.records().slice();
    if (this._filterCategory && this._filterCategory !== 'all') {
      recs = recs.filter(r => r.category === this._filterCategory);
    }
    const today = new Date(); today.setHours(0,0,0,0);
    if (this._filterRange === 'this-month') {
      const mk = this._currentMonthKey();
      recs = recs.filter(r => this._monthKey(r.date) === mk);
    } else if (this._filterRange === 'last-month') {
      const mk = this._priorMonthKey(this._currentMonthKey());
      recs = recs.filter(r => this._monthKey(r.date) === mk);
    } else if (this._filterRange === 'ytd') {
      const year = String(today.getFullYear());
      recs = recs.filter(r => (r.date || '').slice(0, 4) === year);
    } else if (this._filterRange === 'last-12') {
      const cutoff = new Date(today); cutoff.setMonth(cutoff.getMonth() - 12);
      recs = recs.filter(r => r.date && new Date(r.date + 'T00:00:00') >= cutoff);
    }
    // Newest first.
    recs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return recs;
  },

  // ── Main render ────────────────────────────────────────────────────────
  renderMain() {
    this.catchUpRecurring();   // fill in any elapsed months for recurring bills
    this._view = 'current';
    this.container.innerHTML = '<div class="screen">' + this._renderCurrent() + '</div>';
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    this._wireCurrent();
  },

  // ── Expense History (its own Books page; the read-only log of past months) ──
  renderHistory(mount) {
    // ⚠ A `mount` argument means this is a FRESH mount (openHubFullPage has just
    // bumped App._mountSeq), so the token is stamped HERE, exactly as open() does at
    // :52. S.HubExpenseHistory.open() delegated straight into this function without
    // stamping, so `_mountedAt` was permanently stale and `_catchUpStillCurrent()`
    // could only ever be FALSE — the catch-up repaint below was refused 100% of the
    // time. The operator opened Expense History on the first login of a new month,
    // this month's rent was written to the server and pushed into memory, and the
    // page they were looking at never showed it. Adding it by hand then double-booked
    // it into Books, the P&L, breakeven and prime cost. Stamping at the mount entry
    // point rather than in the caller covers any future door into this page.
    // (It also un-deadened `:230`'s history branch, which was unreachable because
    // `_view` only becomes 'history' by way of this never-stamped mount.)
    if (mount) { this.container = mount; this._mountedAt = App._mountSeq; }
    this.catchUpRecurring();
    this._view = 'history';
    this.container.innerHTML = '<div class="screen">' + this._historyStats() + this._renderHistory() + '</div>';
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    this._wireHistory();
  },
  _historyStats() {
    const fmt$ = (v) => App.fmtCurrency(v || 0);
    const recs = this.records();
    const yr = String(new Date().getFullYear());
    const total = recs.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const ytd = recs.filter(r => String(r.date || '').slice(0, 4) === yr).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const stat = (label, val) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg">' + val + '</div></div>';
    return '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + stat('Logged This Year', fmt$(ytd)) + stat('Logged All Time', fmt$(total)) + stat('Entries', String(recs.length))
      + '</div></div>';
  },
  // Re-render whichever view is active (Operating Expenses or Expense History),
  // so an edit / delete / stop redraws the page the operator is actually on.
  _rerender() { if (this._view === 'history') this.renderHistory(); else this.renderMain(); },

  _nextMonthKey(mk) {
    const y = parseInt(mk.slice(0, 4), 10);
    let m = parseInt(mk.slice(5, 7), 10) + 1, ny = y;
    if (m > 12) { m = 1; ny = y + 1; }
    return ny + '-' + String(m).padStart(2, '0');
  },

  // True when this entry's recurring series ends within ~2 months (or has ended).
  _isSeriesEnding(r) {
    const arr = this.records();
    const p = r.recurring_parent ? arr.find(x => x.id === r.recurring_parent) : r;
    if (!p || !p.recurring || !(parseInt(p.term_months, 10) > 0) || !p.date) return false;
    const s = new Date(String(p.date).length <= 10 ? p.date + 'T00:00:00' : p.date);
    if (isNaN(s.getTime())) return false;
    const now = new Date();
    const endIdx = s.getFullYear() * 12 + s.getMonth() + parseInt(p.term_months, 10) - 1;
    return (endIdx - (now.getFullYear() * 12 + now.getMonth())) <= 2;
  },

  _recurTag(rec) {
    const p = rec && rec.recurring_parent ? this.records().find(x => x.id === rec.recurring_parent) : rec;
    const f = p && p.frequency && p.frequency !== 'monthly' ? ' · ' + p.frequency : '';
    return ' <span style="color:var(--t4);font-size:10px;white-space:nowrap;">recurring' + f + '</span>';
  },

  // One real-record row: Date, Category (+Recurring tag), Vendor, Amount, actions.
  // opts.minimal (History) = Edit + Delete only — Duplicate and Renew are
  // forward-looking, so they live on the Current tab (this/next month) only.
  _logRowHtml(r, opts) {
    opts = opts || {};
    const fmt$ = (v) => App.fmtCurrency(v || 0);
    const isRec = !!(r.recurring || r.recurring_parent);
    const edit = '<button class="btn btn-ghost btn-sm oex-edit" data-id="' + esc(r.id) + '">Edit</button>';
    const del  = '<button class="btn btn-danger btn-sm oex-del" data-id="' + esc(r.id) + '">Delete</button>';
    let actions = '';
    if (opts.minimal) {
      actions = edit + del;
    } else if (isRec) {
      if (this._isSeriesEnding(r)) actions += '<button class="btn btn-ghost btn-sm oex-renew" data-id="' + esc(r.id) + '" style="color:var(--gold);">Renew</button>';
      actions += '<button class="btn btn-ghost btn-sm oex-stop" data-id="' + esc(r.id) + '">Stop</button>' + edit + del;
    } else {
      actions += '<button class="btn btn-ghost btn-sm oex-dup" data-id="' + esc(r.id) + '">Repeat</button>' + edit + del;
    }
    return '<tr>'
      + '<td data-label="Date" style="color:var(--t1);white-space:nowrap;">' + esc(r.date || '') + '</td>'
      + '<td style="color:var(--t2);">' + esc(r.category || '') + (isRec ? this._recurTag(r) : '') + '</td>'
      + '<td style="color:var(--t2);">' + esc(r.vendor || '') + '</td>'
      + '<td style="font-weight:700;color:var(--t1);">' + fmt$(r.amount) + '</td>'
      + '<td class="no-print" style="text-align:right;white-space:nowrap;">' + actions + '</td>'
      + '</tr>';
  },

  // Expected (not-yet-booked) recurring rows for a future month: a forecast only.
  _expectedRecurring(monthKey) {
    const arr = this.records();
    const idx = parseInt(monthKey.slice(0, 4), 10) * 12 + (parseInt(monthKey.slice(5, 7), 10) - 1);
    const out = [];
    arr.filter(p => p.recurring && !p.recurring_parent && p.date).forEach(p => {
      const s = new Date(String(p.date).length <= 10 ? p.date + 'T00:00:00' : p.date);
      if (isNaN(s.getTime())) return;
      const startIdx = s.getFullYear() * 12 + s.getMonth();
      const term = parseInt(p.term_months, 10);
      const step = p.frequency === 'quarterly' ? 3 : p.frequency === 'annual' ? 12 : 1;
      const endIdx = term > 0 ? startIdx + term - 1 : Infinity;   // no term = ongoing
      if (idx < startIdx || idx > endIdx) return;
      if ((idx - startIdx) % step !== 0) return;                   // only the months this bill actually recurs in
      if (arr.some(r => (r.id === p.id || r.recurring_parent === p.id) && String(r.date || '').slice(0, 7) === monthKey)) return;
      out.push(p);
    });
    return out;
  },

  // One month's expenses, split into a Recurring card and a Variable card. The
  // section name is the first column header (no separate header row), so the
  // header reads "Recurring | Category | Vendor | Amount". opts.next = the
  // next-month card (recurring shows as Expected, not booked).
  _monthCardHtml(monthKey, opts) {
    opts = opts || {};
    const fmt$ = (v) => App.fmtCurrency(v || 0);
    const recs = this.records().filter(r => String(r.date || '').slice(0, 7) === monthKey);
    const byDate = (a, b) => String(a.date || '').localeCompare(String(b.date || ''));
    const recurring = recs.filter(r => r.recurring || r.recurring_parent).sort(byDate);
    const variable  = recs.filter(r => !(r.recurring || r.recurring_parent)).sort(byDate);
    const expected  = opts.next ? this._expectedRecurring(monthKey) : [];

    const emptyRow = (txt) => '<tr><td colspan="5" style="padding:12px;color:var(--t3);font-size:12px;text-align:center;">' + txt + '</td></tr>';
    const expectedRow = (p) => '<tr style="opacity:0.6;">'
      + '<td data-label="Date" style="color:var(--t3);white-space:nowrap;">Expected</td>'
      + '<td style="color:var(--t2);">' + esc(p.category || '') + this._recurTag(p) + '</td>'
      + '<td style="color:var(--t2);">' + esc(p.vendor || '') + '</td>'
      + '<td style="color:var(--t2);">' + fmt$(p.amount) + '</td>'
      + '<td class="no-print" style="text-align:right;white-space:nowrap;"><button class="btn btn-ghost btn-sm oex-stop" data-id="' + esc(p.id) + '">Stop</button></td></tr>';
    // The first column header carries the section name; the rest are the columns.
    const sectionCard = (name, rowsHtml) => '<div class="card" style="margin-bottom:14px;overflow-x:auto;">'
      + '<table class="row-list">'
      +   '<colgroup><col style="width:13%"><col style="width:27%"><col style="width:24%"><col style="width:14%"><col style="width:22%"></colgroup>'
      +   '<thead><tr><th>' + name + '</th><th>Category</th><th>Vendor</th><th>Amount</th><th class="no-print"></th></tr></thead>'
      +   '<tbody>' + rowsHtml + '</tbody>'
      + '</table></div>';

    const recRows = (recurring.length || expected.length)
      ? recurring.map(r => this._logRowHtml(r)).join('') + expected.map(expectedRow).join('')
      : emptyRow('No recurring bills ' + (opts.next ? 'expected next month.' : 'this month.'));
    const varRows = variable.length
      ? variable.map(r => this._logRowHtml(r)).join('')
      : emptyRow(opts.next ? 'Nothing logged for next month yet.' : 'No variable expenses logged this month yet.');

    const heading = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">' + (opts.next ? 'Next Month' : 'This Month') + ' · ' + esc(this._monthLabel(monthKey)) + '</div>'
      + (opts.exportId ? '<button class="btn btn-ghost btn-sm no-print" id="' + opts.exportId + '">Export PDF</button>' : '')
      + '</div>';
    const wrap = opts.wrapId ? ' id="' + opts.wrapId + '"' : '';
    return heading + '<div' + wrap + '>' + sectionCard('Recurring', recRows) + sectionCard('Variable', varRows) + '</div>';
  },

  // ── Current tab: stats + add form + This Month / Next Month cards ─────────
  _renderCurrent() {
    const mk = this._currentMonthKey();
    const monthTotal = this._sumMonth(mk);
    const ytdTotal   = this._sumYTD(mk);
    const monthRev   = this._revenueForMonth(mk);
    const monthOpExPct = monthRev > 0 ? (monthTotal / monthRev) : null;
    const fmt$ = (v) => App.fmtCurrency(v || 0);
    const fmtPct = (v) => v == null ? '—' : (v * 100).toFixed(1) + '%';

    const stat = (label, val) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg">' + val + '</div></div>';
    const statsCard = '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + stat('This Month', fmt$(monthTotal)) + stat('Year to Date', fmt$(ytdTotal)) + stat('OpEx % of Revenue', fmtPct(monthOpExPct))
      + '</div></div>';

    const warnBanner = this._termWarning();

    const catOpts = this.CATEGORIES.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
    const segBtn = (mode, label) => '<button type="button" class="btn btn-sm oexa-mode" data-mode="' + mode + '" style="'
      + (this._entryMode === mode ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;' : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    const segToggle = '<div class="seg-toggle">' + segBtn('manual', 'Enter Manually') + segBtn('import', 'Import File') + '</div>';

    let bodyInner, addButtons = '';
    if (this._entryMode === 'import') {
      bodyInner = segToggle + '<div id="oexa-csv"></div>';
      addButtons = '<div id="oexa-imp-actions" style="margin:16px 0 24px;"></div>';
    } else {
      bodyInner = segToggle
        + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
        +   '<div class="f" style="width:150px;"><label>Date Submitted</label><input type="date" value="' + App.todayLocal() + '" disabled title="When you logged this. Always today."/></div>'
        +   '<div class="f" style="width:150px;"><label>Due Date</label><input type="date" id="oexa-date" value="' + App.todayLocal() + '"/></div>'
        +   '<div class="f" style="width:230px;"><label>Category' + App.manageListLink('expense_category') + '</label>' + App.customSelect({ id: 'oexa-cat', key: 'expense_category', builtin: this.CATEGORIES, blank: true, blankLabel: 'Select category...' }) + '</div>'
        +   '<div class="f" style="width:240px;"><label>Vendor</label><input type="text" id="oexa-vendor" placeholder="Who did you pay"/></div>'
        +   '<div class="f" style="width:140px;"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="oexa-amount" step="0.01" min="0" placeholder="0.00"/></div></div>'
        + '</div>'
        + '<div style="margin-top:14px;"><label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--t1);cursor:pointer;"><input type="checkbox" class="bc-check" id="oexa-recurring"/> Recurring bill (same cost each time)</label></div>'
        + '<div id="oexa-term-wrap" style="margin-top:12px;display:none;">'
        +   '<div style="font-size:11px;color:var(--gold);margin-bottom:12px;max-width:540px;line-height:1.5;">Set the <b>Due Date</b> above to when this bill is next actually due. The schedule repeats from that date, not from today.</div>'
        +   '<div class="f" style="max-width:540px;"><label>How often</label><select id="oexa-frequency" style="width:200px;"><option value="monthly">Monthly</option><option value="quarterly">Quarterly (every 3 months)</option><option value="annual">Annually (once a year)</option></select></div>'
        +   '<div class="f" style="max-width:540px;margin-top:12px;"><label>Ends after (months)</label><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><input type="number" id="oexa-term" min="1" step="1" placeholder="Ongoing" style="width:170px;flex:0 0 170px;"/><div style="font-size:11px;color:var(--t3);line-height:1.5;flex:1 1 200px;min-width:180px;">Leave blank and it recurs until you stop it. Set this only for a bill that ends after a fixed number of months.</div></div></div>'
        + '</div>'
        + App.noteField({ id: 'oexa-notes', placeholder: 'Optional context for the bookkeeper' })
        + '<div id="oexa-err" style="display:none;font-size:11px;color:var(--red);margin-top:10px;"></div>';
      addButtons = '<div data-collapse-group="oex-add" style="margin:16px 0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
        + '<button class="btn btn-primary" id="oexa-save">Add Expense</button>'
        + '<button class="btn btn-ghost" id="oexa-clear">Start Over</button>'
        + '</div>';
    }
    const addCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('oex-add', 'Add Expense')
      + '<div class="collapse-body">' + bodyInner + '</div>'
      + '</div>' + addButtons;

    // What the last import actually did. An expense import used to report NOTHING — not even a
    // count — so rows it skipped (a credit, an unreadable amount, a missing date) simply were not
    // there afterwards. A row the operator can see in their own file and cannot find in Bar Cop is
    // what makes them stop trusting the total.
    const imp = this._importMsg;
    this._importMsg = null;   // one render only; it must not survive a navigation
    const importBanner = imp
      ? '<div style="background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:6px;padding:11px 16px;margin:16px 0;font-size:12px;color:var(--t1);line-height:1.6;">'
        + esc(imp) + '</div>'
      : '';
    return statsCard + warnBanner + importBanner + addCard
      + this._monthCardHtml(mk, { next: false, exportId: 'oex-export-this', wrapId: 'oex-thismonth' })
      + this._monthCardHtml(this._nextMonthKey(mk), { next: true });
  },

  _wireCurrent() {
    document.getElementById('oexa-save')?.addEventListener('click', () => this._saveAdd());
    document.getElementById('oexa-clear')?.addEventListener('click', () => this._clearAdd());
    document.getElementById('oexa-recurring')?.addEventListener('change', (e) => {
      const w = document.getElementById('oexa-term-wrap');
      if (w) w.style.display = e.target.checked ? '' : 'none';
    });
    this.container.querySelectorAll('.oexa-mode').forEach(b => b.addEventListener('click', () => { this._entryMode = b.dataset.mode; this.renderMain(); }));
    App.wireCustomSelects(this.container);
    this.container.querySelector('.card-collapse-head')?.addEventListener('click', (e) => App.toggleCollapse(e.currentTarget));
    App.applyCollapsed(this.container);
    document.getElementById('oex-export-this')?.addEventListener('click', () => {
      const el = document.getElementById('oex-thismonth');
      if (el) App.exportPDF({ title: 'Operating Expenses', root: el });
    });
    this._wireRows(this.container);
    if (this._entryMode === 'import') this._mountImporter();
  },

  _mountImporter() {
    const el = document.getElementById('oexa-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your expenses file here',
      dropSub: 'Needs columns for date and amount; category, vendor, and notes come in if your file has them. Categories that do not match yours import as Other.',
      actionsEl: '#oexa-imp-actions',
      fields: [
        { key: 'date',     label: 'Date',     required: true,  match: ['date', 'paid', 'posted', 'transaction date', 'business date', 'day', 'due date', 'bill date', 'invoice date', 'date paid', 'trans date', 'entry date'] },
        { key: 'category', label: 'Category', required: false, match: ['category', 'type', 'account', 'expense type', 'expense category', 'gl account', 'account name', 'class', 'gl code'] },
        { key: 'vendor',   label: 'Vendor',   required: false, match: ['vendor', 'payee', 'merchant', 'description', 'name', 'paid to', 'supplier', 'company', 'vendor name', 'payee name', 'biller'] },
        { key: 'amount',   label: 'Amount',   required: true,  match: ['amount', 'total', 'cost', 'debit', 'amt', 'value', 'expense', 'payment', 'charge', 'dollars', 'total amount', 'amount paid'] },
        { key: 'notes',    label: 'Notes',    required: false, match: ['notes', 'memo', 'note', 'comment', 'details', 'remark'] }
      ],
      confirmLabel: 'Import Expenses',
      onComplete: rows => this._importRows(rows)
    });
  },

  /* ⚠ AN UNREADABLE DATE MUST COME BACK EMPTY SO THE ROW IS SKIPPED AND COUNTED, never stored.
     Two shapes got through and produced rows that "imported successfully" and then existed in a
     month no view can open — invisible in This Month and Year to Date, but counted in History's
     all-time total, so two figures on the same screen disagreed:
       - a bare integer: `new Date("45845")` is year 45845, and an Excel date column whose format
         was reset to General exports exactly that serial (raw:false hands the text straight over);
       - an impossible ISO date: the fast path returned "2026-13-45" untouched. */
  _normDate(s) {
    if (!s) return '';
    const str = String(s).trim();
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const y = +iso[1], m = +iso[2], dd = +iso[3];
      const probe = new Date(y, m - 1, dd);
      const real = probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === dd;
      return real ? str : '';
    }
    if (/^\d+$/.test(str)) return '';   // a bare number is a spreadsheet serial, not a date
    const d = new Date(str);
    return isNaN(d.getTime()) ? '' : App.ymdLocal(d);
  },

  // ⚠ MATCHES THE OPERATOR'S OWN LIST TOO, not just the nine builtins. The manual Category field is
  // built from App.listOptions('expense_category') and invites them to add their own — so a file
  // whose column said "Waste Removal" was silently rewritten to "Other" on import while typing the
  // same word by hand kept it. Worse, "Other" is a value listOptions deliberately strips, so they
  // could not even select it back afterwards.
  _matchCat(s) {
    if (!s) return '';
    const t = String(s).toLowerCase().trim();
    const hit = this.CATEGORIES.find(c => c.toLowerCase() === t);
    if (hit) return hit;
    const own = (App.listOptions ? App.listOptions('expense_category') : []) || [];
    return own.find(c => String(c).toLowerCase() === t) || '';
  },

  async _importRows(rows) {
    const arr = this.records();
    const _added = [];   // rows appended here, so a failed write can take them back out
    let credits = 0, unreadable = 0, undated = 0, zeroed = 0;
    (rows || []).forEach((r, i) => {
      const date = this._normDate(r.date);
      // ⚠ App.parseNum, not a private parseFloat strip. This read a card export's refund row —
      // "(125.00)" or "125.00-" — as +125 and BOOKED IT AS A $125 EXPENSE, while the same file's
      // "-125.00" rows parsed to -125 and were dropped by the guard below. One file, two opposite
      // wrong answers, $250 apart. Credits are still not imported (an operating-expense ledger of
      // positive amounts is the existing model), but they are now COUNTED and reported rather than
      // vanishing — a row the operator can see in their file and cannot find in Bar Cop is the
      // thing that makes them stop trusting the total.
      const amount = App.parseNum(r.amount);
      if (amount == null) { unreadable++; return; }
      // A $0.00 line (a voided bill, a zero-dollar subscription row) is not a credit and must not
      // be reported as one — it is simply nothing to log.
      if (amount < 0)     { credits++;    return; }
      if (amount === 0)   { zeroed++;     return; }
      if (!date)          { undated++;    return; }
      const category = this.CATEGORIES.includes(r.category) ? r.category : (this._matchCat(r.category) || 'Other');
      const vendor = (r.vendor || '').trim();
      const notes = (r.notes || '').trim();
      // Skip a row already logged (same date, amount, vendor, category).
      if (arr.some(x => x.date === date && Math.abs((parseFloat(x.amount) || 0) - amount) < 0.005 && (x.vendor || '') === vendor && (x.category || '') === category)) return;
      const row = { id: App.uid ? App.uid() : ('oex-' + Date.now() + '-' + i), date, category, vendor, amount, notes, created_at: new Date().toISOString() };
      arr.push(row); _added.push(row);
    });
    // Imported rows were pushed into the live list before the write, and a bulk write cannot revert
    // itself — take them back out rather than showing an import Books counts and the server lacks.
    const saved = await App.putRecordsBulk('core', 'operating_expense', this.records());
    if (!saved) App.dropRows(arr, _added);
    this._entryMode = 'manual';
    /* ⚠ THE GUARD COMES BEFORE THE MESSAGE, NOT AFTER IT. Placed after, it stopped the repaint but
       left `_importMsg` banked — and nothing else consumes it, so the next time the operator opened
       Operating Expenses, days later, it greeted them with "1 expense imported." about an import
       they had already navigated away from. The failure text was worse: an unprompted "Could not
       save the import. Nothing was changed" on a page they just opened. If nobody is on the screen
       there is nobody to tell; a failed write already raises its own alert at the time. */
    /* ⚠ THE TOKEN ALONE IS NOT ENOUGH — CHECK `_view` TOO. Expense History mounts through this
       same object and re-stamps the SAME `_mountedAt` slot, so the token still matches and the
       repaint went ahead, painting Operating Expenses over the History page the operator had just
       opened (sidebar still highlighting History). `_catchUpOnce` survives the identical race only
       because it branches on `_view`; this did not. */
    if (!this._catchUpStillCurrent()) return;
    /* ⚠ EXPENSE HISTORY NEEDS THE NUMBERS REFRESHED, JUST NOT THE PAGE HIJACKED. It mounts through
       this same object, so a bare `_view !== 'current'` return left it showing "Logged This Year"
       and a log table built from rows that — on a FAILED write — had already been spliced back out
       of memory a few lines above. Right answer for both: re-render whichever view is actually on
       screen. `_rerender` is the function that already exists for this. */
    if (this._view !== 'current') { this._rerender(); return; }
    // Say what happened, including what was NOT taken and why.
    if (!saved) {
      this._importMsg = 'Could not save the import. Nothing was changed — check your connection and try again.';
    } else {
      const bits = [_added.length + ' expense' + (_added.length === 1 ? '' : 's') + ' imported'];
      if (credits)    bits.push(credits + ' credit' + (credits === 1 ? '' : 's') + ' or refund' + (credits === 1 ? '' : 's') + ' skipped (Bar Cop tracks expenses as positive amounts)');
      if (undated)    bits.push(undated + ' row' + (undated === 1 ? '' : 's') + ' skipped with no readable date');
      if (unreadable) bits.push(unreadable + ' row' + (unreadable === 1 ? '' : 's') + ' skipped with no readable amount');
      if (zeroed) bits.push(zeroed + ' zero-dollar row' + (zeroed === 1 ? '' : 's') + ' skipped');
      const dupes = rows.length - _added.length - credits - undated - unreadable - zeroed;
      if (dupes > 0) bits.push(dupes + ' already logged');
      this._importMsg = bits.join(' · ') + '.';
    }
    this.renderMain();
  },

  // By Category row-list (current month, last month, YTD, YTD % of revenue).
  _byCatCardHtml() {
    const fmt$ = (v) => App.fmtCurrency(v || 0);
    const fmtPct = (v) => v == null ? '—' : (v * 100).toFixed(1) + '%';
    const mk = this._currentMonthKey();
    const prevMk = this._priorMonthKey(mk);
    const byCatMonth = this._sumMonthByCategory(mk);
    const byCatLast  = this._sumMonthByCategory(prevMk);
    const byCatYTD   = this._sumYTDByCategory(mk);
    const ytdRev     = this._revenueYTD(mk);
    const catRows = this.CATEGORIES.map(c => {
      const tm = byCatMonth[c] || 0, lm = byCatLast[c] || 0, ytd = byCatYTD[c] || 0;
      const ytdRevPct = ytdRev > 0 ? (ytd / ytdRev) : null;
      const dim = (tm === 0 && lm === 0 && ytd === 0);
      return '<tr style="' + (dim ? 'opacity:0.55;' : '') + '">'
        + '<td style="color:var(--t1);">' + esc(c) + '</td>'
        + '<td style="font-weight:700;color:var(--t1);">' + fmt$(tm) + '</td>'
        + '<td style="color:var(--t3);">' + fmt$(lm) + '</td>'
        + '<td style="color:var(--t2);">' + fmt$(ytd) + '</td>'
        + '<td style="color:var(--t3);text-align:left;">' + fmtPct(ytdRevPct) + '</td>'
        + '</tr>';
    }).join('');
    return '<div class="card" style="overflow-x:auto;">'
      + '<table class="row-list">'
      +   '<colgroup><col style="width:22%"><col style="width:19.5%"><col style="width:19.5%"><col style="width:19.5%"><col style="width:19.5%"></colgroup>'
      +   '<thead><tr><th>Category</th><th>This Month</th><th>Last Month</th><th>YTD</th><th>YTD % of Revenue</th></tr></thead>'
      +   '<tbody>' + catRows + '</tbody>'
      + '</table></div>';
  },

  // The log row-list for a given set of records (optional id).
  _logTableHtml(recs, id) {
    const logRows = recs.length === 0
      ? '<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--t3);font-size:12px;">No expenses in this range.</td></tr>'
      : recs.map(r => this._logRowHtml(r, { minimal: true })).join('');
    return '<div class="card"' + (id ? ' id="' + id + '"' : '') + ' style="overflow-x:auto;">'
      + '<table class="row-list">'
      +   '<colgroup><col style="width:22%"><col style="width:26%"><col style="width:18%"><col style="width:18%"><col style="width:16%"></colgroup>'
      +   '<thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Amount</th><th class="no-print"></th></tr></thead>'
      +   '<tbody>' + logRows + '</tbody>'
      + '</table></div>';
  },

  // ── History tab: By Category + the filterable log (paged 50 at a time) ────
  _renderHistory() {
    const PAGE = App.LIST_PAGE || 50;
    if (!this._histShown) this._histShown = PAGE;
    const rangeChipOpts = [
      { v: 'this-month', label: 'This Month' },
      { v: 'last-month', label: 'Last Month' },
      { v: 'ytd',        label: 'Year to Date' },
      { v: 'last-12',    label: 'Last 12 Months' },
      { v: 'all',        label: 'All Time' }
    ];
    const rangeChips = App.filterChips(this._filterRange, rangeChipOpts);
    const recs = this._filteredRecords();
    const shown = recs.slice(0, this._histShown);

    const filterRow = '<div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap;margin:24px 0 10px;">' + rangeChips + '</div>';
    const byCatHeading = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;">'
      + '<div class="sh" style="margin:0;">By Category</div>'
      + '<button class="btn btn-ghost btn-sm no-print" id="oex-export">Export PDF</button>'
      + '</div>';
    const olderBar = recs.length > this._histShown
      ? '<div class="no-print" style="text-align:center;padding:14px 0 4px;"><button class="btn btn-ghost btn-sm" id="oex-older">Show older (' + (recs.length - this._histShown) + ' more)</button></div>'
      : '';

    return '<div id="oex-export-area">'
      + byCatHeading + this._byCatCardHtml()
      + filterRow + this._logTableHtml(shown, 'oex-log')
      + '</div>' + olderBar;
  },

  _wireHistory() {
    const PAGE = App.LIST_PAGE || 50;
    document.getElementById('oex-export')?.addEventListener('click', () => {
      // Export the FULL filtered list (not just the on-screen 50), built off-screen.
      const node = document.createElement('div');
      node.style.cssText = 'position:absolute;left:-99999px;top:0;width:900px;';
      node.innerHTML = this._byCatCardHtml() + this._logTableHtml(this._filteredRecords());
      document.body.appendChild(node);
      Promise.resolve(App.exportPDF({ title: 'Operating Expenses', root: node })).finally(() => node.remove());
    });
    this.container.querySelectorAll('.fc-chip').forEach(chip => {
      chip.addEventListener('click', () => { this._filterRange = chip.dataset.v; this._histShown = PAGE; this._rerender(); });
    });
    document.getElementById('oex-older')?.addEventListener('click', () => { this._histShown = (this._histShown || PAGE) + PAGE; this._rerender(); });
    this._wireRows(this.container);
  },

  // Shared row-action wiring for both tabs.
  _wireRows(scope) {
    const openEdit = (b) => { const r = this.records().find(x => x.id === b.dataset.id); if (r) this._openModal(r); };
    scope.querySelectorAll('.oex-edit').forEach(b => b.addEventListener('click', () => openEdit(b)));
    scope.querySelectorAll('.oex-renew').forEach(b => b.addEventListener('click', () => openEdit(b)));
    scope.querySelectorAll('.oex-dup').forEach(b => b.addEventListener('click', () => this._duplicate(b.dataset.id)));
    scope.querySelectorAll('.oex-del').forEach(b => b.addEventListener('click', () => this._delete(b.dataset.id)));
    scope.querySelectorAll('.oex-stop').forEach(b => b.addEventListener('click', () => this._stopRecurring(b.dataset.id)));
  },

  // ── Inline add form save / start over ────────────────────────────────────
  async _saveAdd() {
    const g = (id) => document.getElementById(id);
    const date     = g('oexa-date')?.value || '';
    const category = g('oexa-cat')?.value || '';
    const vendor   = (g('oexa-vendor')?.value || '').trim();
    const amount   = parseFloat(g('oexa-amount')?.value || '');
    const notes    = (g('oexa-notes')?.value || '').trim();
    const recurring = !!g('oexa-recurring')?.checked;
    const term      = parseInt(g('oexa-term')?.value, 10);
    const showErr = (m) => { const e = g('oexa-err'); if (e) { e.textContent = m; e.style.display = 'block'; } };
    if (!date) { showErr('Pick a date.'); return; }
    if (!category) { showErr('Pick a category.'); return; }
    if (isNaN(amount) || amount <= 0) { showErr('Enter an amount above zero.'); return; }
    if (recurring && g('oexa-term')?.value && (isNaN(term) || term < 1)) { showErr('A fixed term must be 1 month or more, or leave it blank to recur until you stop it.'); return; }
    const rec = {
      id: App.uid ? App.uid() : ('oex-' + Date.now()),
      date, category, vendor, amount, notes,
      created_at: new Date().toISOString()
    };
    if (recurring) {
      rec.recurring = true;
      rec.frequency = document.getElementById('oexa-frequency')?.value || 'monthly';
      rec.term_months = (term && term > 0) ? term : null;
      rec.recur_day = parseInt(String(date).slice(8, 10), 10) || 1;
    }
    await App.putRecord('core', 'operating_expense', rec);
    this.renderMain();
  },

  _clearAdd() {
    const d = document.getElementById('oexa-date'); if (d) d.value = App.todayLocal();
    const c = document.getElementById('oexa-cat');  if (c) c.selectedIndex = 0;
    ['oexa-vendor', 'oexa-amount', 'oexa-notes', 'oexa-term'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const rc = document.getElementById('oexa-recurring'); if (rc) rc.checked = false;
    const fq = document.getElementById('oexa-frequency'); if (fq) fq.selectedIndex = 0;
    const tw = document.getElementById('oexa-term-wrap'); if (tw) tw.style.display = 'none';
    const e = document.getElementById('oexa-err');  if (e) e.style.display = 'none';
  },

  // ── Add (from Duplicate) / Edit modal ────────────────────────────────────
  // record = the row being edited (edit mode). prefill = starting values for a
  // brand-new entry (used by Duplicate, which never books a row until you save).
  _openModal(record, prefill) {
    const isEdit = !!record;
    const arr = this.records();
    const rec = record || prefill || {
      id:    '',
      date:  App.todayLocal(),
      category: this.CATEGORIES[0],
      vendor: '',
      amount: '',
      notes:  ''
    };
    const catOpts = this.CATEGORIES.map(c => '<option value="' + esc(c) + '"' + (rec.category === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
    const id = 'oex-modal';
    // The recurring rule lives on the series parent, but it can be managed from
    // ANY entry in the series (no hunting for the original 12-month-old row).
    const parent = rec.recurring_parent ? (arr.find(r => r.id === rec.recurring_parent) || rec) : rec;
    const seriesOn = !!parent.recurring;
    const freqOpt = (v, lbl) => '<option value="' + v + '"' + (parent.frequency === v || (!parent.frequency && v === 'monthly') ? ' selected' : '') + '>' + lbl + '</option>';
    const recurHtml = '<div style="margin-top:14px;"><label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--t1);cursor:pointer;"><input type="checkbox" class="bc-check" id="oex-f-recurring"' + (seriesOn ? ' checked' : '') + '/> Recurring bill (same cost each time)</label></div>'
      + '<div id="oex-f-term-wrap" style="margin-top:12px;' + (seriesOn ? '' : 'display:none;') + '">'
      +   '<div style="font-size:11px;color:var(--gold);margin-bottom:12px;max-width:540px;line-height:1.5;">Set the <b>Due Date</b> above to when this bill is next due. The schedule repeats from that date.</div>'
      +   '<div class="f" style="max-width:540px;"><label>How often</label><select id="oex-f-frequency" style="width:200px;">' + freqOpt('monthly', 'Monthly') + freqOpt('quarterly', 'Quarterly (every 3 months)') + freqOpt('annual', 'Annually (once a year)') + '</select></div>'
      +   '<div class="f" style="max-width:540px;margin-top:12px;"><label>Ends after (months)</label><input type="number" id="oex-f-term" min="1" step="1" value="' + esc(parent.term_months || '') + '" placeholder="Ongoing" style="width:170px;"/></div>'
      + '</div>';

    const html = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">' + (isEdit ? 'Edit Expense' : 'Add Expense') + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      +   '<div class="f"><label>Date Submitted</label><input type="date" value="' + esc((rec.created_at || '').slice(0, 10) || rec.date || App.todayLocal()) + '" disabled/></div>'
      +   '<div class="f"><label>Due Date</label><input type="date" id="oex-f-date" value="' + esc(rec.date) + '"/></div>'
      +   '<div class="f"><label>Category' + App.manageListLink('expense_category') + '</label>' + App.customSelect({ id: 'oex-f-cat', key: 'expense_category', builtin: this.CATEGORIES, selected: rec.category, blank: true, blankLabel: 'Select category...' }) + '</div>'
      +   '<div class="f"><label>Vendor</label><input type="text" id="oex-f-vendor" value="' + esc(rec.vendor) + '" placeholder="Who did you pay"/></div>'
      +   '<div class="f"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="oex-f-amount" step="0.01" min="0" value="' + esc(rec.amount === '' ? '' : String(rec.amount)) + '" placeholder="0.00"/></div></div>'
      + '</div>'
      + recurHtml
      + App.noteField({ id: 'oex-f-notes', value: rec.notes, placeholder: 'Optional context for the bookkeeper' })
      + '<div class="card-actions">'
      +   '<button class="btn btn-primary" id="oex-save">' + (isEdit ? 'Save Changes' : 'Add Expense') + '</button>'
      +   '<span id="oex-f-err" style="display:none;font-size:11px;color:var(--red);align-self:center;"></span>'
      +   (isEdit ? '<button class="btn btn-danger" id="oex-modal-del" style="margin-left:auto;">Delete</button>' : '')
      + '</div></div>';
    App.openModal(html, { id, maxWidth: 540, noClose: true });
    App.wireCustomSelects(document);
    const showErr = (m) => { const e = document.getElementById('oex-f-err'); if (e) { e.textContent = m; e.style.display = 'inline'; } };

    if (isEdit) document.getElementById('oex-modal-del')?.addEventListener('click', async () => { App.closeModal(id); await this._delete(rec.id); });
    document.getElementById('oex-f-recurring')?.addEventListener('change', (e) => {
      const w = document.getElementById('oex-f-term-wrap');
      if (w) w.style.display = e.target.checked ? '' : 'none';
    });
    document.getElementById('oex-save')?.addEventListener('click', async () => {
      const date     = document.getElementById('oex-f-date')?.value || '';
      const category = document.getElementById('oex-f-cat')?.value || '';
      const vendor   = (document.getElementById('oex-f-vendor')?.value || '').trim();
      const amount   = parseFloat(document.getElementById('oex-f-amount')?.value || '');
      const notes    = (document.getElementById('oex-f-notes')?.value || '').trim();
      if (!date) { showErr('Pick a date.'); return; }
      if (!category) { showErr('Pick a category.'); return; }
      if (isNaN(amount) || amount <= 0) { showErr('Enter an amount above zero.'); return; }
      const updates = { date, category, vendor, amount, notes };
      const recChecked = !!document.getElementById('oex-f-recurring')?.checked;
      const freqV = document.getElementById('oex-f-frequency')?.value || 'monthly';
      const termV = parseInt(document.getElementById('oex-f-term')?.value, 10);
      if (recChecked && document.getElementById('oex-f-term')?.value && (isNaN(termV) || termV < 1)) { showErr('A fixed term must be 1 month or more, or leave it blank to recur until you stop it.'); return; }
      const touched = [];
      // ⚠ This branch REPLACES array slots (arr[idx] = Object.assign({}, ...)) rather than mutating
      // the records, so snapshotting the record objects would capture the new ones. Snapshot the
      // ARRAY instead. A bulk write cannot revert itself, and this one was discarded — so a failed
      // save left the edited bill on screen and in Books while the server kept the old one.
      const undoArr = arr.slice();
      if (isEdit) {
        const idx = arr.findIndex(r => r.id === rec.id);
        if (idx >= 0) arr[idx] = Object.assign({}, arr[idx], updates);
        // Recurring on/off + frequency + term are series-level, so they always land
        // on the series parent no matter which entry you edited.
        const parentId = rec.recurring_parent || rec.id;
        const pIdx = arr.findIndex(r => r.id === parentId);
        if (pIdx >= 0) {
          arr[pIdx] = recChecked
            ? Object.assign({}, arr[pIdx], { recurring: true, frequency: freqV, term_months: (termV && termV > 0) ? termV : null, recur_day: arr[pIdx].recur_day || (parseInt(String(arr[pIdx].date).slice(8, 10), 10) || 1) })
            : Object.assign({}, arr[pIdx], { recurring: false, frequency: undefined, term_months: null });
        }
        if (idx >= 0) touched.push(arr[idx]);
        if (pIdx >= 0 && pIdx !== idx) touched.push(arr[pIdx]);
      } else {
        const newRec = Object.assign({ id: App.uid ? App.uid() : ('oex-' + Date.now()), created_at: new Date().toISOString() }, updates);
        if (recChecked) { newRec.recurring = true; newRec.frequency = freqV; newRec.term_months = (termV && termV > 0) ? termV : null; newRec.recur_day = parseInt(String(date).slice(8, 10), 10) || 1; }
        arr.push(newRec);
        touched.push(newRec);
      }
      if (!(await App.putRecordsBulk('core', 'operating_expense', touched))) {
        arr.length = 0; arr.push(...undoArr);
        showErr('Could not save. Nothing was changed — check your connection and try again.');
        return;
      }
      App.closeModal(id);
      this._rerender();
    });
  },

  // ── Stop a recurring series ──────────────────────────────────────────────
  // Turns recurring off on the series parent: past months stay on the books, but
  // it stops projecting into next month and the Cash Forecast. This is the "until
  // you cancel" end for an ongoing bill (or an early stop on a fixed-term one).
  async _stopRecurring(id) {
    const arr = this.records();
    const r = arr.find(x => x.id === id);
    if (!r) return;
    const parentId = r.recurring_parent || r.id;
    const pIdx = arr.findIndex(x => x.id === parentId);
    if (pIdx < 0) return;
    const p = arr[pIdx];
    const who = p.vendor || p.category || 'This bill';
    const ok = await App.confirm({
      title: 'Stop this recurring bill?',
      message: who + ' will stop recurring. Past months stay on your books, and it drops off next month and the Cash Forecast.',
      confirmText: 'Stop Recurring', cancelText: 'Keep It'
    });
    if (!ok) return;
    arr[pIdx] = Object.assign({}, p, { recurring: false, term_months: null });
    await App.putRecord('core', 'operating_expense', arr[pIdx]);
    this._rerender();
  },

  // ── Duplicate ──────────────────────────────────────────────────────────
  // Opens the form pre-filled from the row, dated next month, as a NEW entry.
  // Nothing is booked until the operator reviews the amount and saves, so an
  // accidental click can never log an unconfirmed expense ([[output-honesty]]).
  _duplicate(id) {
    const src = this.records().find(r => r.id === id);
    if (!src) return;
    let date = App.todayLocal();
    const d = new Date(String(src.date).length <= 10 ? src.date + 'T00:00:00' : src.date);
    if (!isNaN(d.getTime())) {
      const base = new Date(d.getFullYear(), d.getMonth() + 1, 1);   // first of next month
      const dim = this._daysInMonth(base.getFullYear(), base.getMonth());
      date = App.ymdLocal(new Date(base.getFullYear(), base.getMonth(), Math.min(d.getDate(), dim)));
    }
    this._openModal(null, { date, category: src.category, vendor: src.vendor, amount: src.amount, notes: src.notes });
  },

  // ── Delete ─────────────────────────────────────────────────────────────
  async _delete(id) {
    const arr = this.records();
    const rec = arr.find(r => r.id === id);
    if (!rec) return;
    const ok = await App.confirmDelete();
    if (!ok) return;
    await App.removeRecord('core', 'operating_expense', id);
    this._rerender();
  }
};

/* ── Expense History — the Books "Expense History" page ──────────────────────
   A thin screen that opens its own Hub full-page and delegates rendering to
   S.HubOperatingExpenses.renderHistory (the read-only-ish log of past months,
   with its own stat box). Lives here so it shares all the same row helpers. */
S.HubExpenseHistory = {
  open() {
    App.openHubFullPage('Expense History', (mount) => { S.HubOperatingExpenses.renderHistory(mount); }, 'expense-history');
  }
};
