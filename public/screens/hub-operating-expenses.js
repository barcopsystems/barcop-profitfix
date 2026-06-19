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

  // Revenue in a given calendar month from the Profit weekly rolls.
  _revenueForMonth(monthKey) {
    const weeks = (App.data?.weeks || []).filter(w => this._monthKey(w.period_end) === monthKey);
    return weeks.reduce((s, w) => s + (parseFloat(w.bar?.revenue) || 0) + (parseFloat(w.food?.revenue) || 0), 0);
  },

  // Revenue year-to-date through the given month.
  _revenueYTD(monthKey) {
    const year = monthKey.slice(0, 4);
    const cutoff = monthKey;
    const weeks = (App.data?.weeks || []).filter(w => {
      const mk = this._monthKey(w.period_end);
      return mk && mk.slice(0, 4) === year && mk <= cutoff;
    });
    return weeks.reduce((s, w) => s + (parseFloat(w.bar?.revenue) || 0) + (parseFloat(w.food?.revenue) || 0), 0);
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
  _largestCategory(byCat) {
    let top = null, topVal = 0;
    Object.entries(byCat).forEach(([k, v]) => { if (v > topVal) { top = k; topVal = v; } });
    return top ? { name: top, amount: topVal } : null;
  },

  // Distinct vendor names from the log, for autocomplete in the form.
  _vendorList() {
    const set = new Set();
    this.records().forEach(r => { if (r.vendor) set.add(r.vendor); });
    return Array.from(set).sort();
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
      recs = recs.filter(r => r.date && new Date(r.date) >= cutoff);
    }
    // Newest first.
    recs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return recs;
  },

  // ── Main render ────────────────────────────────────────────────────────
  renderMain() {
    const mk = this._currentMonthKey();
    const prevMk = this._priorMonthKey(mk);
    const monthTotal = this._sumMonth(mk);
    const ytdTotal   = this._sumYTD(mk);
    const byCatMonth = this._sumMonthByCategory(mk);
    const byCatLast  = this._sumMonthByCategory(prevMk);
    const byCatYTD   = this._sumYTDByCategory(mk);
    const monthRev   = this._revenueForMonth(mk);
    const ytdRev     = this._revenueYTD(mk);
    const monthOpExPct = monthRev > 0 ? (monthTotal / monthRev) : null;

    const fmt$ = (v) => App.fmtCurrency(v || 0);
    const fmtPct = (v) => v == null ? '—' : (v * 100).toFixed(1) + '%';

    // Stats strip — plain card + flex calc-items (calc-val lg).
    const stat = (label, val) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg">' + val + '</div></div>';
    const statsCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      +   stat('This Month', fmt$(monthTotal))
      +   stat('Year to Date', fmt$(ytdTotal))
      +   stat('OpEx % of Revenue', fmtPct(monthOpExPct))
      + '</div></div>';

    // Inline Add Expense form on the page under the stats.
    const catOpts = this.CATEGORIES.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
    const dlOpts = this._vendorList().map(v => '<option value="' + esc(v) + '"></option>').join('');
    const addCard = '<div class="card form-card">'
      + '<div class="card-title">Add Expense</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      +   '<div class="f" style="width:160px;"><label>Date</label><input type="date" id="oexa-date" value="' + App.todayLocal() + '"/></div>'
      +   '<div class="f" style="width:230px;"><label>Category</label><select id="oexa-cat">' + catOpts + '</select></div>'
      +   '<div class="f" style="flex:1 1 200px;min-width:160px;"><label>Vendor</label><input type="text" id="oexa-vendor" list="oexa-vendor-list" placeholder="Who did you pay"/><datalist id="oexa-vendor-list">' + dlOpts + '</datalist></div>'
      +   '<div class="f" style="width:140px;"><label>Amount ($)</label><input type="number" id="oexa-amount" step="0.01" min="0" placeholder="0.00"/></div>'
      + '</div>'
      + '<div class="form-row" style="margin-top:14px;"><div class="f" style="width:100%;"><label>Notes</label><textarea class="notes-ta" rows="2" id="oexa-notes" placeholder="Optional context for the bookkeeper"></textarea></div></div>'
      + '<div id="oexa-err" style="display:none;font-size:11px;color:var(--red);margin-top:10px;"></div>'
      + '</div>';
    const addButtons = '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="oexa-save">Add Expense</button>'
      + '<button class="btn btn-ghost" id="oexa-clear">Start Over</button>'
      + '</div>';

    // By Category — current month, last month, YTD, YTD % of revenue.
    const catRows = this.CATEGORIES.map(c => {
      const tm  = byCatMonth[c] || 0;
      const lm  = byCatLast[c]  || 0;
      const ytd = byCatYTD[c]   || 0;
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
    const byCatCard = '<div class="card card-bleed data-card">'
      + '<div class="card-bleed-tbl"><table class="tbl">'
      +   '<colgroup><col style="width:36%"><col style="width:16%"><col style="width:16%"><col style="width:16%"><col style="width:16%"></colgroup>'
      +   '<thead><tr>'
      +     '<th>Category</th>'
      +     '<th>This Month</th>'
      +     '<th>Last Month</th>'
      +     '<th>YTD</th>'
      +     '<th>YTD % of Revenue</th>'
      +   '</tr></thead>'
      +   '<tbody>' + catRows + '</tbody>'
      + '</table></div>'
      + '</div>';

    // Export PDF on a title-less row above the category card; exports the
    // summary plus the detail log together.
    const exportRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:24px 0 10px;">'
      + '<button class="btn btn-ghost btn-sm" id="oex-export">Export PDF</button>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">' + statsCard + addCard + addButtons + exportRow
      + '<div id="oex-export-area">' + byCatCard + '<div id="oex-list-region"></div></div>'
      + '</div>';
    if (App.setHubTopbarActions) App.setHubTopbarActions('');

    // Wire the inline add form + export; the chips + log re-render on their own.
    document.getElementById('oexa-save')?.addEventListener('click', () => this._saveAdd());
    document.getElementById('oexa-clear')?.addEventListener('click', () => this._clearAdd());
    document.getElementById('oex-export')?.addEventListener('click', () => {
      const el = document.getElementById('oex-export-area');
      if (el) App.exportPDF({ title: 'Operating Expenses', root: el });
    });
    this._renderListRegion();
  },

  // Range filter chips + the data-card log. Re-rendered alone on a filter
  // change so the inline Add form keeps any in-progress entry.
  _renderListRegion() {
    const region = document.getElementById('oex-list-region');
    if (!region) return;
    const fmt$ = (v) => App.fmtCurrency(v || 0);

    const rangeChipOpts = [
      { v: 'this-month', label: 'This Month' },
      { v: 'last-month', label: 'Last Month' },
      { v: 'ytd',        label: 'Year to Date' },
      { v: 'last-12',    label: 'Last 12 Months' },
      { v: 'all',        label: 'All Time' }
    ];
    const rangeChips = App.filterChips(this._filterRange, rangeChipOpts);

    const recs = this._filteredRecords();
    const logRows = recs.length === 0
      ? '<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--t3);font-size:12px;">No expenses in this view. Use the form above to add one.</td></tr>'
      : recs.map(r => '<tr>'
          + '<td style="color:var(--t1);white-space:nowrap;">' + esc(r.date || '') + '</td>'
          + '<td style="color:var(--t2);">' + esc(r.category || '') + '</td>'
          + '<td style="color:var(--t2);">' + esc(r.vendor || '') + '</td>'
          + '<td style="font-weight:700;color:var(--t1);">' + fmt$(r.amount) + '</td>'
          + '<td class="no-print" style="text-align:right;white-space:nowrap;">'
          +   '<button class="btn btn-ghost btn-sm oex-edit" data-id="' + esc(r.id) + '">Edit</button> '
          +   '<button class="btn btn-ghost btn-sm oex-dup"  data-id="' + esc(r.id) + '">Duplicate</button> '
          +   '<button class="btn btn-ghost btn-sm oex-del"  data-id="' + esc(r.id) + '" style="color:var(--red);">Delete</button>'
          + '</td>'
        + '</tr>').join('');

    const rangeRow = '<div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">' + rangeChips + '</div>';
    const logCard = '<div class="card card-bleed data-card" id="oex-log">'
      + '<div class="card-bleed-tbl"><table class="tbl">'
      +   '<colgroup><col style="width:13%"><col style="width:25%"><col style="width:26%"><col style="width:14%"><col style="width:22%"></colgroup>'
      +   '<thead><tr>'
      +     '<th>Date</th><th>Category</th><th>Vendor</th>'
      +     '<th>Amount</th>'
      +     '<th class="no-print"></th>'
      +   '</tr></thead>'
      +   '<tbody>' + logRows + '</tbody>'
      + '</table></div>'
      + '</div>';

    region.innerHTML = rangeRow + logCard;

    region.querySelectorAll('.fc-chip').forEach(chip => {
      chip.addEventListener('click', () => { this._filterRange = chip.dataset.v; this._renderListRegion(); });
    });
    region.querySelectorAll('.oex-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const rec = this.records().find(r => r.id === btn.dataset.id);
        if (rec) this._openModal(rec);
      });
    });
    region.querySelectorAll('.oex-dup').forEach(btn => {
      btn.addEventListener('click', () => this._duplicate(btn.dataset.id));
    });
    region.querySelectorAll('.oex-del').forEach(btn => {
      btn.addEventListener('click', () => this._delete(btn.dataset.id));
    });
  },

  // ── Inline add form save / start over ────────────────────────────────────
  async _saveAdd() {
    const g = (id) => document.getElementById(id);
    const date     = g('oexa-date')?.value || '';
    const category = g('oexa-cat')?.value || '';
    const vendor   = (g('oexa-vendor')?.value || '').trim();
    const amount   = parseFloat(g('oexa-amount')?.value || '');
    const notes    = (g('oexa-notes')?.value || '').trim();
    const showErr = (m) => { const e = g('oexa-err'); if (e) { e.textContent = m; e.style.display = 'block'; } };
    if (!date) { showErr('Pick a date.'); return; }
    if (!category) { showErr('Pick a category.'); return; }
    if (isNaN(amount) || amount <= 0) { showErr('Enter an amount above zero.'); return; }
    this.records().push({
      id: App.uid ? App.uid() : ('oex-' + Date.now()),
      date, category, vendor, amount, notes,
      created_at: new Date().toISOString()
    });
    await App.saveKey('operating_expenses');
    this.renderMain();
  },

  _clearAdd() {
    const d = document.getElementById('oexa-date'); if (d) d.value = App.todayLocal();
    const c = document.getElementById('oexa-cat');  if (c) c.selectedIndex = 0;
    ['oexa-vendor', 'oexa-amount', 'oexa-notes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const e = document.getElementById('oexa-err');  if (e) e.style.display = 'none';
  },

  // ── Add / Edit modal ────────────────────────────────────────────────────
  _openModal(record) {
    const isEdit = !!record;
    const rec = record || {
      id:    '',
      date:  App.todayLocal(),
      category: this.CATEGORIES[0],
      vendor: '',
      amount: '',
      notes:  ''
    };
    const dlOpts = this._vendorList().map(v => '<option value="' + esc(v) + '"></option>').join('');
    const catOpts = this.CATEGORIES.map(c => '<option value="' + esc(c) + '"' + (rec.category === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
    const id = 'oex-modal';

    const html = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">' + (isEdit ? 'Edit Expense' : 'Add Expense') + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      +   '<div class="f"><label>Date</label><input type="date" id="oex-f-date" value="' + esc(rec.date) + '"/></div>'
      +   '<div class="f"><label>Category</label><select id="oex-f-cat">' + catOpts + '</select></div>'
      +   '<div class="f"><label>Vendor</label><input type="text" id="oex-f-vendor" list="oex-f-vlist" value="' + esc(rec.vendor) + '" placeholder="Who did you pay"/><datalist id="oex-f-vlist">' + dlOpts + '</datalist></div>'
      +   '<div class="f"><label>Amount ($)</label><input type="number" id="oex-f-amount" step="0.01" min="0" value="' + esc(rec.amount === '' ? '' : String(rec.amount)) + '" placeholder="0.00"/></div>'
      +   '<div class="f" style="width:100%;"><label>Notes</label><textarea class="notes-ta" rows="2" id="oex-f-notes" placeholder="Optional context for the bookkeeper">' + esc(rec.notes || '') + '</textarea></div>'
      + '</div>'
      + '<div class="card-actions">'
      +   '<button class="btn btn-primary" id="oex-save">' + (isEdit ? 'Save Changes' : 'Add Expense') + '</button>'
      +   '<button class="btn btn-ghost" id="oex-cancel">Cancel</button>'
      +   '<span id="oex-f-err" style="display:none;font-size:11px;color:var(--red);align-self:center;"></span>'
      +   (isEdit ? '<button class="btn btn-ghost" id="oex-modal-del" style="margin-left:auto;color:var(--red);">Delete</button>' : '')
      + '</div></div>';
    App.openModal(html, { id, maxWidth: 540, noClose: true });
    const showErr = (m) => { const e = document.getElementById('oex-f-err'); if (e) { e.textContent = m; e.style.display = 'inline'; } };

    document.getElementById('oex-cancel')?.addEventListener('click', () => App.closeModal(id));
    if (isEdit) document.getElementById('oex-modal-del')?.addEventListener('click', async () => { App.closeModal(id); await this._delete(rec.id); });
    document.getElementById('oex-save')?.addEventListener('click', async () => {
      const date     = document.getElementById('oex-f-date')?.value || '';
      const category = document.getElementById('oex-f-cat')?.value || '';
      const vendor   = (document.getElementById('oex-f-vendor')?.value || '').trim();
      const amount   = parseFloat(document.getElementById('oex-f-amount')?.value || '');
      const notes    = (document.getElementById('oex-f-notes')?.value || '').trim();
      if (!date) { showErr('Pick a date.'); return; }
      if (!category) { showErr('Pick a category.'); return; }
      if (isNaN(amount) || amount <= 0) { showErr('Enter an amount above zero.'); return; }
      const arr = this.records();
      if (isEdit) {
        const idx = arr.findIndex(r => r.id === rec.id);
        if (idx >= 0) arr[idx] = Object.assign({}, arr[idx], { date, category, vendor, amount, notes });
      } else {
        arr.push({
          id:         App.uid ? App.uid() : ('oex-' + Date.now()),
          date, category, vendor, amount, notes,
          created_at: new Date().toISOString()
        });
      }
      await App.saveKey('operating_expenses');
      App.closeModal(id);
      this.renderMain();
    });
  },

  // ── Duplicate ──────────────────────────────────────────────────────────
  async _duplicate(id) {
    const arr = this.records();
    const src = arr.find(r => r.id === id);
    if (!src) return;
    arr.push({
      id:         App.uid ? App.uid() : ('oex-' + Date.now()),
      date:       App.todayLocal(),
      category:   src.category,
      vendor:     src.vendor,
      amount:     src.amount,
      notes:      src.notes,
      created_at: new Date().toISOString()
    });
    await App.saveKey('operating_expenses');
    this.renderMain();
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
    this.renderMain();
  }
};
