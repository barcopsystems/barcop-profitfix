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
  open() {
    App.openHubFullPage('Operating Expenses', (mount) => {
      this.container = mount;
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

  catchUpRecurring() {
    const arr = this.records();
    const now = new Date();
    const curIdx = now.getFullYear() * 12 + now.getMonth();
    const parents = arr.filter(r => r && r.recurring && !r.recurring_parent && r.date);
    let added = false;
    parents.forEach(p => {
      const start = new Date(String(p.date).length <= 10 ? p.date + 'T00:00:00' : p.date);
      if (isNaN(start.getTime())) return;
      const startIdx = start.getFullYear() * 12 + start.getMonth();
      const term = parseInt(p.term_months, 10);
      const recurDay = p.recur_day || start.getDate();
      // Ongoing (no term) fills through the current month; a fixed term stops at its end.
      const lastIdx = term > 0 ? Math.min(curIdx, startIdx + term - 1) : curIdx;
      const have = new Set([start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0')]);
      arr.forEach(r => { if (r.recurring_parent === p.id && r.date) have.add(String(r.date).slice(0, 7)); });
      for (let idx = startIdx + 1; idx <= lastIdx; idx++) {
        const yy = Math.floor(idx / 12), mm = idx % 12;
        const mk = yy + '-' + String(mm + 1).padStart(2, '0');
        if (have.has(mk)) continue;
        const dd = Math.min(recurDay, this._daysInMonth(yy, mm));
        arr.push({
          id: App.uid ? App.uid() : ('oex-' + idx + '-' + p.id),
          date: mk + '-' + String(dd).padStart(2, '0'),
          category: p.category, vendor: p.vendor, amount: p.amount, notes: p.notes,
          recurring_parent: p.id,
          created_at: new Date().toISOString()
        });
        have.add(mk);
        added = true;
      }
    });
    if (added) App.saveKey('operating_expenses');
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
    if (mount) this.container = mount;
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

  _recurTag() {
    return ' <span style="color:var(--t4);font-size:10px;white-space:nowrap;">recurring</span>';
  },

  // One real-record row: Date, Category (+Recurring tag), Vendor, Amount, actions.
  // opts.minimal (History) = Edit + Delete only — Duplicate and Renew are
  // forward-looking, so they live on the Current tab (this/next month) only.
  _logRowHtml(r, opts) {
    opts = opts || {};
    const fmt$ = (v) => App.fmtCurrency(v || 0);
    const isRec = !!(r.recurring || r.recurring_parent);
    const edit = '<button class="btn btn-ghost btn-sm oex-edit" data-id="' + esc(r.id) + '">Edit</button> ';
    const del  = '<button class="btn btn-danger btn-sm oex-del" data-id="' + esc(r.id) + '">Delete</button>';
    let actions = '';
    if (opts.minimal) {
      actions = edit + del;
    } else if (isRec) {
      if (this._isSeriesEnding(r)) actions += '<button class="btn btn-ghost btn-sm oex-renew" data-id="' + esc(r.id) + '" style="color:var(--gold);">Renew</button> ';
      actions += '<button class="btn btn-ghost btn-sm oex-stop" data-id="' + esc(r.id) + '">Stop</button> ' + edit + del;
    } else {
      actions += '<button class="btn btn-ghost btn-sm oex-dup" data-id="' + esc(r.id) + '">Repeat</button> ' + edit + del;
    }
    return '<tr>'
      + '<td style="color:var(--t1);white-space:nowrap;">' + esc(r.date || '') + '</td>'
      + '<td style="color:var(--t2);">' + esc(r.category || '') + (isRec ? this._recurTag() : '') + '</td>'
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
      const endIdx = term > 0 ? startIdx + term - 1 : Infinity;   // no term = ongoing
      if (idx < startIdx || idx > endIdx) return;
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
      + '<td style="color:var(--t3);white-space:nowrap;">Expected</td>'
      + '<td style="color:var(--t2);">' + esc(p.category || '') + this._recurTag() + '</td>'
      + '<td style="color:var(--t2);">' + esc(p.vendor || '') + '</td>'
      + '<td style="color:var(--t2);">' + fmt$(p.amount) + '</td>'
      + '<td class="no-print" style="text-align:right;white-space:nowrap;"><button class="btn btn-ghost btn-sm oex-stop" data-id="' + esc(p.id) + '">Stop</button></td></tr>';
    // The first column header carries the section name; the rest are the columns.
    const sectionCard = (name, rowsHtml) => '<div class="card card-bleed data-card" style="margin-bottom:14px;">'
      + '<div class="card-bleed-tbl"><table class="tbl">'
      +   '<colgroup><col style="width:13%"><col style="width:27%"><col style="width:24%"><col style="width:14%"><col style="width:22%"></colgroup>'
      +   '<thead><tr><th>' + name + '</th><th>Category</th><th>Vendor</th><th>Amount</th><th class="no-print"></th></tr></thead>'
      +   '<tbody>' + rowsHtml + '</tbody>'
      + '</table></div></div>';

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
        +   '<div class="f" style="width:160px;"><label>Date</label><input type="date" id="oexa-date" value="' + App.todayLocal() + '"/></div>'
        +   '<div class="f" style="width:230px;"><label>Category</label><select id="oexa-cat">' + catOpts + '</select></div>'
        +   '<div class="f" style="flex:1 1 200px;min-width:160px;"><label>Vendor</label><input type="text" id="oexa-vendor" placeholder="Who did you pay"/></div>'
        +   '<div class="f" style="width:140px;"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="oexa-amount" step="0.01" min="0" placeholder="0.00"/></div></div>'
        + '</div>'
        + '<div style="margin-top:14px;"><label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--t1);cursor:pointer;"><input type="checkbox" id="oexa-recurring" style="accent-color:var(--gold);width:16px;height:16px;"/> Recurring monthly bill (same cost each month)</label></div>'
        + '<div id="oexa-term-wrap" style="margin-top:12px;display:none;"><div class="f" style="max-width:540px;"><label>Ends after (months)</label><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><input type="number" id="oexa-term" min="1" step="1" placeholder="Ongoing" style="width:170px;flex:0 0 170px;"/><div style="font-size:11px;color:var(--t3);line-height:1.5;flex:1 1 200px;min-width:180px;">Leave blank and it recurs every month until you stop it. Only set this for a bill that ends after a fixed number of payments.</div></div></div></div>'
        + '<div class="form-row" style="margin-top:14px;"><div class="f" style="width:100%;"><label>Notes</label><textarea class="notes-ta" rows="2" id="oexa-notes" placeholder="Optional context for the bookkeeper"></textarea></div></div>'
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

    return statsCard + warnBanner + addCard
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
        { key: 'date',     label: 'Date',     required: true,  match: ['date', 'paid', 'posted', 'transaction date'] },
        { key: 'category', label: 'Category', required: false, match: ['category', 'type', 'account'] },
        { key: 'vendor',   label: 'Vendor',   required: false, match: ['vendor', 'payee', 'merchant', 'description', 'name'] },
        { key: 'amount',   label: 'Amount',   required: true,  match: ['amount', 'total', 'cost', 'debit'] },
        { key: 'notes',    label: 'Notes',    required: false, match: ['notes', 'memo', 'note'] }
      ],
      confirmLabel: 'Import Expenses',
      onComplete: rows => this._importRows(rows)
    });
  },

  _normDate(s) {
    if (!s) return '';
    const str = String(s).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = new Date(str);
    return isNaN(d.getTime()) ? '' : App.ymdLocal(d);
  },

  _matchCat(s) {
    if (!s) return '';
    const t = String(s).toLowerCase().trim();
    return this.CATEGORIES.find(c => c.toLowerCase() === t) || '';
  },

  async _importRows(rows) {
    const arr = this.records();
    (rows || []).forEach((r, i) => {
      const date = this._normDate(r.date);
      const amount = parseFloat(String(r.amount || '').replace(/[^0-9.\-]/g, ''));
      if (!date || isNaN(amount) || amount <= 0) return;
      const category = this.CATEGORIES.includes(r.category) ? r.category : (this._matchCat(r.category) || 'Other');
      const vendor = (r.vendor || '').trim();
      const notes = (r.notes || '').trim();
      // Skip a row already logged (same date, amount, vendor, category).
      if (arr.some(x => x.date === date && Math.abs((parseFloat(x.amount) || 0) - amount) < 0.005 && (x.vendor || '') === vendor && (x.category || '') === category)) return;
      arr.push({ id: App.uid ? App.uid() : ('oex-' + Date.now() + '-' + i), date, category, vendor, amount, notes, created_at: new Date().toISOString() });
    });
    await App.saveKey('operating_expenses');
    this._entryMode = 'manual';
    this.renderMain();
  },

  // By Category data-card (current month, last month, YTD, YTD % of revenue).
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
        + '<td style="color:var(--t3);">' + fmtPct(ytdRevPct) + '</td>'
        + '</tr>';
    }).join('');
    return '<div class="card card-bleed data-card">'
      + '<div class="card-bleed-tbl"><table class="tbl">'
      +   '<colgroup><col style="width:22%"><col style="width:19.5%"><col style="width:19.5%"><col style="width:19.5%"><col style="width:19.5%"></colgroup>'
      +   '<thead><tr><th>Category</th><th>This Month</th><th>Last Month</th><th>YTD</th><th>YTD % of Revenue</th></tr></thead>'
      +   '<tbody>' + catRows + '</tbody>'
      + '</table></div></div>';
  },

  // The log data-card for a given set of records (optional id).
  _logTableHtml(recs, id) {
    const logRows = recs.length === 0
      ? '<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--t3);font-size:12px;">No expenses in this range.</td></tr>'
      : recs.map(r => this._logRowHtml(r, { minimal: true })).join('');
    return '<div class="card card-bleed data-card"' + (id ? ' id="' + id + '"' : '') + '>'
      + '<div class="card-bleed-tbl"><table class="tbl">'
      +   '<colgroup><col style="width:22%"><col style="width:26%"><col style="width:18%"><col style="width:18%"><col style="width:16%"></colgroup>'
      +   '<thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Amount</th><th class="no-print"></th></tr></thead>'
      +   '<tbody>' + logRows + '</tbody>'
      + '</table></div></div>';
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
    if (recurring) { rec.recurring = true; rec.term_months = (term && term > 0) ? term : null; rec.recur_day = parseInt(String(date).slice(8, 10), 10) || 1; }
    this.records().push(rec);
    await App.saveKey('operating_expenses');
    this.renderMain();
  },

  _clearAdd() {
    const d = document.getElementById('oexa-date'); if (d) d.value = App.todayLocal();
    const c = document.getElementById('oexa-cat');  if (c) c.selectedIndex = 0;
    ['oexa-vendor', 'oexa-amount', 'oexa-notes', 'oexa-term'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const rc = document.getElementById('oexa-recurring'); if (rc) rc.checked = false;
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
    const recurHtml = '<div style="margin-top:14px;"><label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--t1);cursor:pointer;"><input type="checkbox" id="oex-f-recurring"' + (seriesOn ? ' checked' : '') + ' style="accent-color:var(--gold);width:16px;height:16px;"/> Recurring monthly bill (same cost each month)</label></div>'
      + '<div class="form-row" id="oex-f-term-wrap" style="margin-top:12px;' + (seriesOn ? '' : 'display:none;') + 'align-items:flex-end;gap:12px;flex-wrap:wrap;"><div class="f" style="width:170px;"><label>Ends after (months)</label><input type="number" id="oex-f-term" min="1" step="1" value="' + esc(parent.term_months || '') + '" placeholder="Ongoing"/></div></div>';

    const html = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">' + (isEdit ? 'Edit Expense' : 'Add Expense') + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      +   '<div class="f"><label>Date</label><input type="date" id="oex-f-date" value="' + esc(rec.date) + '"/></div>'
      +   '<div class="f"><label>Category</label><select id="oex-f-cat">' + catOpts + '</select></div>'
      +   '<div class="f"><label>Vendor</label><input type="text" id="oex-f-vendor" value="' + esc(rec.vendor) + '" placeholder="Who did you pay"/></div>'
      +   '<div class="f"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="oex-f-amount" step="0.01" min="0" value="' + esc(rec.amount === '' ? '' : String(rec.amount)) + '" placeholder="0.00"/></div></div>'
      + '</div>'
      + recurHtml
      + '<div class="form-row" style="margin-top:14px;"><div class="f" style="width:100%;"><label>Notes</label><textarea class="notes-ta" rows="2" id="oex-f-notes" placeholder="Optional context for the bookkeeper">' + esc(rec.notes || '') + '</textarea></div></div>'
      + '<div class="card-actions">'
      +   '<button class="btn btn-primary" id="oex-save">' + (isEdit ? 'Save Changes' : 'Add Expense') + '</button>'
      +   '<button class="btn btn-ghost" id="oex-cancel">Cancel</button>'
      +   '<span id="oex-f-err" style="display:none;font-size:11px;color:var(--red);align-self:center;"></span>'
      +   (isEdit ? '<button class="btn btn-danger" id="oex-modal-del" style="margin-left:auto;">Delete</button>' : '')
      + '</div></div>';
    App.openModal(html, { id, maxWidth: 540, noClose: true });
    const showErr = (m) => { const e = document.getElementById('oex-f-err'); if (e) { e.textContent = m; e.style.display = 'inline'; } };

    document.getElementById('oex-cancel')?.addEventListener('click', () => App.closeModal(id));
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
      const termV = parseInt(document.getElementById('oex-f-term')?.value, 10);
      if (recChecked && document.getElementById('oex-f-term')?.value && (isNaN(termV) || termV < 1)) { showErr('A fixed term must be 1 month or more, or leave it blank to recur until you stop it.'); return; }
      if (isEdit) {
        const idx = arr.findIndex(r => r.id === rec.id);
        if (idx >= 0) arr[idx] = Object.assign({}, arr[idx], updates);
        // Recurring on/off + term are series-level, so they always land on the
        // series parent no matter which entry you edited.
        const parentId = rec.recurring_parent || rec.id;
        const pIdx = arr.findIndex(r => r.id === parentId);
        if (pIdx >= 0) {
          arr[pIdx] = recChecked
            ? Object.assign({}, arr[pIdx], { recurring: true, term_months: (termV && termV > 0) ? termV : null, recur_day: arr[pIdx].recur_day || (parseInt(String(arr[pIdx].date).slice(8, 10), 10) || 1) })
            : Object.assign({}, arr[pIdx], { recurring: false, term_months: null });
        }
      } else {
        const newRec = Object.assign({ id: App.uid ? App.uid() : ('oex-' + Date.now()), created_at: new Date().toISOString() }, updates);
        if (recChecked) { newRec.recurring = true; newRec.term_months = (termV && termV > 0) ? termV : null; newRec.recur_day = parseInt(String(date).slice(8, 10), 10) || 1; }
        arr.push(newRec);
      }
      await App.saveKey('operating_expenses');
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
    await App.saveKey('operating_expenses');
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
    const idx = arr.findIndex(r => r.id === id);
    if (idx >= 0) arr.splice(idx, 1);
    await App.saveKey('operating_expenses');
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
