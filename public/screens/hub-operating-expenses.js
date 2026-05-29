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
    });
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
    const largest    = this._largestCategory(byCatMonth);

    // Summary tiles
    const fmt$ = (v) => App.fmtCurrency(v || 0, 0);
    const fmtPct = (v) => v == null ? '—' : (v * 100).toFixed(1) + '%';

    const summaryCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--b2);">'
      +   '<div><div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Operating Expenses</div>'
      +     '<div style="font-size:11px;color:var(--t3);margin-top:3px;">' + esc(this._monthLabel(mk)) + ' summary plus YTD. Add an expense each time a bill is paid. Books rolls these into the monthly Income Statement automatically.</div></div>'
      +   '<button class="btn btn-primary btn-sm" id="oex-add">+ Add Expense</button>'
      + '</div>'
      + '<div class="calc">'
      +   '<div class="calc-item"><div class="calc-label">This Month</div><div class="calc-val">' + fmt$(monthTotal) + '</div></div>'
      +   '<div class="calc-item"><div class="calc-label">Year to Date</div><div class="calc-val">' + fmt$(ytdTotal) + '</div></div>'
      +   '<div class="calc-item"><div class="calc-label">OpEx % of Revenue (This Month)</div><div class="calc-val">' + fmtPct(monthOpExPct) + '</div></div>'
      +   '<div class="calc-item"><div class="calc-label">Largest Category This Month</div><div class="calc-val" style="font-size:14px;">' + (largest ? esc(largest.name.replace(/\s*\(.*\)/, '')) + ' <span style="color:var(--t3);">' + fmt$(largest.amount) + '</span>' : '—') + '</div></div>'
      + '</div>'
      + '</div>';

    // By-category table
    const catRows = this.CATEGORIES.map(c => {
      const tm  = byCatMonth[c] || 0;
      const lm  = byCatLast[c]  || 0;
      const ytd = byCatYTD[c]   || 0;
      const ytdRevPct = ytdRev > 0 ? (ytd / ytdRev) : null;
      const dim = (tm === 0 && lm === 0 && ytd === 0);
      return '<tr style="' + (dim ? 'opacity:0.55;' : '') + '">'
        + '<td style="padding:8px 10px;color:var(--t1);">' + esc(c) + '</td>'
        + '<td style="padding:8px 10px;text-align:right;font-family:\'Barlow Condensed\',sans-serif;font-size:16px;font-weight:700;color:var(--w);">' + fmt$(tm) + '</td>'
        + '<td style="padding:8px 10px;text-align:right;color:var(--t3);">' + fmt$(lm) + '</td>'
        + '<td style="padding:8px 10px;text-align:right;color:var(--t2);">' + fmt$(ytd) + '</td>'
        + '<td style="padding:8px 10px;text-align:right;color:var(--t3);">' + fmtPct(ytdRevPct) + '</td>'
        + '</tr>';
    }).join('');
    const byCatCard = '<div class="card" style="margin-bottom:16px;">'
      + '<div class="card-title">By Category</div>'
      + '<div class="tbl-wrap"><table class="tbl">'
      +   '<thead><tr>'
      +     '<th>Category</th>'
      +     '<th style="text-align:right;">This Month</th>'
      +     '<th style="text-align:right;">Last Month</th>'
      +     '<th style="text-align:right;">YTD</th>'
      +     '<th style="text-align:right;">YTD % of Revenue</th>'
      +   '</tr></thead>'
      +   '<tbody>' + catRows + '</tbody>'
      + '</table></div>'
      + '</div>';

    // Trend chart (12-month OpEx as % of Revenue)
    const trendCard = this._renderTrendCard(mk);

    // Filter + log table
    const filterCatOpts = ['<option value="all">All Categories</option>']
      .concat(this.CATEGORIES.map(c => '<option value="' + esc(c) + '"' + (this._filterCategory === c ? ' selected' : '') + '>' + esc(c) + '</option>'))
      .join('');
    const filterRangeOpts = [
      ['this-month', 'This Month'],
      ['last-month', 'Last Month'],
      ['ytd',        'Year to Date'],
      ['last-12',    'Last 12 Months'],
      ['all',        'All Time']
    ].map(([v, l]) => '<option value="' + v + '"' + (this._filterRange === v ? ' selected' : '') + '>' + l + '</option>').join('');

    const recs = this._filteredRecords();
    const logRows = recs.length === 0
      ? '<tr><td colspan="6" style="padding:24px;text-align:center;color:var(--t3);font-size:12px;">No expenses logged in this view. Use + Add Expense to log your first one.</td></tr>'
      : recs.map(r => '<tr>'
          + '<td style="padding:8px 10px;color:var(--t1);white-space:nowrap;">' + esc(r.date || '') + '</td>'
          + '<td style="padding:8px 10px;color:var(--t2);">' + esc(r.category || '') + '</td>'
          + '<td style="padding:8px 10px;color:var(--t2);">' + esc(r.vendor || '') + '</td>'
          + '<td style="padding:8px 10px;text-align:right;font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:700;color:var(--w);">' + fmt$(r.amount) + '</td>'
          + '<td style="padding:8px 10px;color:var(--t3);font-size:11px;">' + esc(r.notes || '') + '</td>'
          + '<td style="padding:8px 10px;text-align:right;white-space:nowrap;">'
          +   '<button class="btn btn-ghost btn-sm oex-edit" data-id="' + esc(r.id) + '" style="font-size:10px;padding:3px 9px;">Edit</button> '
          +   '<button class="btn btn-ghost btn-sm oex-dup"  data-id="' + esc(r.id) + '" style="font-size:10px;padding:3px 9px;">Duplicate</button> '
          +   '<button class="btn btn-ghost btn-sm oex-del"  data-id="' + esc(r.id) + '" style="font-size:10px;padding:3px 9px;color:var(--red);">Delete</button>'
          + '</td>'
        + '</tr>').join('');
    const logCard = '<div class="card">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px;">'
      +   '<div class="card-title" style="margin:0;">Expense Log</div>'
      +   '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
      +     '<select id="oex-filter-cat" style="font-size:12px;padding:5px 8px;">' + filterCatOpts + '</select>'
      +     '<select id="oex-filter-range" style="font-size:12px;padding:5px 8px;">' + filterRangeOpts + '</select>'
      +   '</div>'
      + '</div>'
      + '<div class="tbl-wrap"><table class="tbl">'
      +   '<thead><tr>'
      +     '<th>Date</th><th>Category</th><th>Vendor</th>'
      +     '<th style="text-align:right;">Amount</th>'
      +     '<th>Notes</th><th></th>'
      +   '</tr></thead>'
      +   '<tbody>' + logRows + '</tbody>'
      + '</table></div>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">' + summaryCard + byCatCard + trendCard + logCard + '</div>';
    if (App.setHubTopbarActions) App.setHubTopbarActions('');

    // Wire
    document.getElementById('oex-add')?.addEventListener('click', () => this._openModal(null));
    document.getElementById('oex-filter-cat')?.addEventListener('change', (e) => {
      this._filterCategory = e.target.value;
      this.renderMain();
    });
    document.getElementById('oex-filter-range')?.addEventListener('change', (e) => {
      this._filterRange = e.target.value;
      this.renderMain();
    });
    this.container.querySelectorAll('.oex-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const rec = this.records().find(r => r.id === btn.dataset.id);
        if (rec) this._openModal(rec);
      });
    });
    this.container.querySelectorAll('.oex-dup').forEach(btn => {
      btn.addEventListener('click', () => this._duplicate(btn.dataset.id));
    });
    this.container.querySelectorAll('.oex-del').forEach(btn => {
      btn.addEventListener('click', () => this._delete(btn.dataset.id));
    });
  },

  // ── Trend chart: OpEx as % of Revenue over last 12 months ───────────────
  _renderTrendCard(currentMk) {
    // Build last 12 calendar months ending at currentMk.
    const months = [];
    const y = parseInt(currentMk.slice(0, 4), 10);
    const m = parseInt(currentMk.slice(5, 7), 10);
    for (let i = 11; i >= 0; i--) {
      let yy = y, mm = m - i;
      while (mm < 1) { mm += 12; yy -= 1; }
      months.push(yy + '-' + String(mm).padStart(2, '0'));
    }
    const points = months.map(mk => {
      const opex = this._sumMonth(mk);
      const rev  = this._revenueForMonth(mk);
      const pct  = rev > 0 ? (opex / rev) : null;
      return { mk, opex, rev, pct };
    });

    const hasAny = points.some(p => p.opex > 0);
    if (!hasAny) {
      return '<div class="card" style="margin-bottom:16px;">'
        + '<div class="card-title">OpEx as % of Revenue, 12-Month Trend</div>'
        + '<div style="padding:18px 0;font-size:12px;color:var(--t3);line-height:1.6;">Trend appears after at least one month of expenses and revenue are logged. Add an expense above to start the chart.</div>'
        + '</div>';
    }

    const W = 700, H = 180, PAD = { t: 24, r: 20, b: 36, l: 40 };
    const cw = W - PAD.l - PAD.r, ch = H - PAD.t - PAD.b;
    const pcts = points.map(p => p.pct).filter(v => v != null);
    const minY = 0;
    const maxY = pcts.length ? Math.max(0.05, Math.max(...pcts) * 1.15) : 0.1;
    const xs = i => PAD.l + (points.length > 1 ? (i / (points.length - 1)) * cw : cw / 2);
    const ys = v => PAD.t + ch - ((v - minY) / (maxY - minY || 1)) * ch;

    const smoothPath = pts => {
      const valid = pts.map((v, i) => v != null ? { x: xs(i), y: ys(v) } : null).filter(Boolean);
      if (valid.length < 2) return valid.length === 1 ? 'M' + valid[0].x + ',' + valid[0].y : '';
      let d = 'M' + valid[0].x.toFixed(1) + ',' + valid[0].y.toFixed(1);
      for (let i = 1; i < valid.length; i++) {
        const cp = (valid[i].x - valid[i - 1].x) * 0.35;
        d += ' C' + (valid[i - 1].x + cp).toFixed(1) + ',' + valid[i - 1].y.toFixed(1) + ' '
          + (valid[i].x - cp).toFixed(1) + ',' + valid[i].y.toFixed(1) + ' '
          + valid[i].x.toFixed(1) + ',' + valid[i].y.toFixed(1);
      }
      return d;
    };
    const areaPath = pts => {
      const valid = pts.map((v, i) => v != null ? { x: xs(i), y: ys(v) } : null).filter(Boolean);
      if (valid.length < 2) return '';
      let d = 'M' + valid[0].x.toFixed(1) + ',' + ys(minY).toFixed(1) + ' L' + valid[0].x.toFixed(1) + ',' + valid[0].y.toFixed(1);
      for (let i = 1; i < valid.length; i++) {
        const cp = (valid[i].x - valid[i - 1].x) * 0.35;
        d += ' C' + (valid[i - 1].x + cp).toFixed(1) + ',' + valid[i - 1].y.toFixed(1) + ' '
          + (valid[i].x - cp).toFixed(1) + ',' + valid[i].y.toFixed(1) + ' '
          + valid[i].x.toFixed(1) + ',' + valid[i].y.toFixed(1);
      }
      d += ' L' + valid[valid.length - 1].x.toFixed(1) + ',' + ys(minY).toFixed(1) + ' Z';
      return d;
    };

    const ticks = [minY, maxY / 2, maxY];
    const uid = 'oextr' + Math.random().toString(36).slice(2, 6);
    const pctsArr = points.map(p => p.pct);
    const linePath = smoothPath(pctsArr);
    const fillPath = areaPath(pctsArr);
    const xLabels = points.map((p, i) =>
      '<text x="' + xs(i).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">' + p.mk.slice(5, 7) + '/' + p.mk.slice(2, 4) + '</text>'
    ).join('');
    const dots = points.map((p, i) => {
      if (p.pct == null) return '';
      const val = (p.pct * 100).toFixed(1) + '%';
      return '<circle cx="' + xs(i).toFixed(1) + '" cy="' + ys(p.pct).toFixed(1) + '" r="4" fill="#0A1520" stroke="#DBAB46" stroke-width="2"/>'
        + '<text x="' + xs(i).toFixed(1) + '" y="' + (ys(p.pct) - 9).toFixed(1) + '" text-anchor="middle" fill="#DBAB46" font-family="\'Barlow Condensed\',sans-serif" font-size="11" font-weight="700">' + val + '</text>';
    }).join('');

    return '<div class="card" style="margin-bottom:16px;padding:20px 24px 16px;">'
      + '<div class="card-title">OpEx as % of Revenue, 12-Month Trend</div>'
      + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;overflow:visible;">'
      +   '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#DBAB46" stop-opacity="0.18"/><stop offset="100%" stop-color="#DBAB46" stop-opacity="0.01"/></linearGradient></defs>'
      +   ticks.map(v => '<line x1="' + PAD.l + '" y1="' + ys(v).toFixed(1) + '" x2="' + (W - PAD.r) + '" y2="' + ys(v).toFixed(1) + '" stroke="rgba(255,255,255,0.06)" stroke-width="1"/><text x="' + (PAD.l - 6) + '" y="' + (ys(v) + 4).toFixed(1) + '" text-anchor="end" fill="rgba(255,255,255,0.25)" font-family="Barlow,sans-serif" font-size="10" font-weight="600">' + (v * 100).toFixed(0) + '%</text>').join('')
      +   (fillPath ? '<path d="' + fillPath + '" fill="url(#' + uid + ')"/>' : '')
      +   (linePath ? '<path d="' + linePath + '" fill="none" stroke="#DBAB46" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' : '')
      +   dots + xLabels
      + '</svg></div>';
  },

  // ── Add / Edit modal ────────────────────────────────────────────────────
  _openModal(record) {
    const isEdit = !!record;
    const rec = record || {
      id:    '',
      date:  new Date().toISOString().slice(0, 10),
      category: this.CATEGORIES[0],
      vendor: '',
      amount: '',
      notes:  ''
    };
    const vendorList = this._vendorList();
    const dataListId = 'oex-vendor-list';
    const dlOpts = vendorList.map(v => '<option value="' + esc(v) + '"></option>').join('');
    const catOpts = this.CATEGORIES.map(c => '<option value="' + esc(c) + '"' + (rec.category === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:24px 28px;max-width:540px;width:100%;max-height:90vh;overflow-y:auto;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:16px;">' + (isEdit ? 'Edit Expense' : 'Add Expense') + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      +   '<div class="f" style="width:180px;"><label>Date</label><input type="date" id="oex-f-date" value="' + esc(rec.date) + '"/></div>'
      +   '<div class="f" style="flex:1;min-width:200px;"><label>Category</label><select id="oex-f-cat">' + catOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;margin-top:14px;">'
      +   '<div class="f" style="flex:1;min-width:200px;"><label>Vendor</label>'
      +     '<input type="text" id="oex-f-vendor" list="' + dataListId + '" value="' + esc(rec.vendor) + '" placeholder="Who did you pay"/>'
      +     '<datalist id="' + dataListId + '">' + dlOpts + '</datalist>'
      +   '</div>'
      +   '<div class="f" style="width:160px;"><label>Amount ($)</label><input type="number" id="oex-f-amount" step="0.01" min="0" value="' + esc(rec.amount === '' ? '' : String(rec.amount)) + '" placeholder="0.00"/></div>'
      + '</div>'
      + '<div class="form-row" style="margin-top:14px;">'
      +   '<div class="f" style="flex:1;"><label>Notes</label><textarea id="oex-f-notes" rows="3" placeholder="Optional context for the bookkeeper">' + esc(rec.notes || '') + '</textarea></div>'
      + '</div>'
      + '<div id="oex-f-err" style="display:none;font-size:11px;color:var(--red);margin-top:10px;"></div>'
      + '<div style="display:flex;justify-content:space-between;gap:10px;margin-top:20px;">'
      +   '<div>' + (isEdit ? '<button class="btn btn-ghost" data-act="delete" style="color:var(--red);">Delete</button>' : '') + '</div>'
      +   '<div style="display:flex;gap:10px;">'
      +     '<button class="btn btn-ghost" data-act="cancel">Cancel</button>'
      +     '<button class="btn btn-primary" data-act="save">' + (isEdit ? 'Save Changes' : 'Add Expense') + '</button>'
      +   '</div>'
      + '</div>'
      + '</div>';
    document.body.appendChild(overlay);
    const close = () => document.body.removeChild(overlay);
    const showErr = (m) => { const e = document.getElementById('oex-f-err'); if (e) { e.textContent = m; e.style.display = 'block'; } };

    overlay.addEventListener('click', async (ev) => {
      const act = ev.target.closest('[data-act]')?.dataset.act;
      if (!act) {
        if (ev.target === overlay) close();
        return;
      }
      if (act === 'cancel') { close(); return; }
      if (act === 'delete') {
        close();
        if (isEdit) await this._delete(rec.id);
        return;
      }
      if (act === 'save') {
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
          if (idx >= 0) {
            arr[idx] = Object.assign({}, arr[idx], { date, category, vendor, amount, notes });
          }
        } else {
          arr.push({
            id:         App.uid ? App.uid() : ('oex-' + Date.now()),
            date, category, vendor, amount, notes,
            created_at: new Date().toISOString()
          });
        }
        await App.saveKey('operating_expenses');
        close();
        this.renderMain();
      }
    });

    const onKey = (e) => { if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(); } };
    document.addEventListener('keydown', onKey);
  },

  // ── Duplicate ──────────────────────────────────────────────────────────
  async _duplicate(id) {
    const arr = this.records();
    const src = arr.find(r => r.id === id);
    if (!src) return;
    arr.push({
      id:         App.uid ? App.uid() : ('oex-' + Date.now()),
      date:       new Date().toISOString().slice(0, 10),
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
    const ok = await App.confirm({
      title: 'Delete this expense?',
      message: rec.category + (rec.vendor ? ' — ' + rec.vendor : '') + ' for ' + App.fmtCurrency(rec.amount || 0, 0) + ' on ' + (rec.date || '') + '. Once deleted, it is gone from the log and the Books rollup.',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    const idx = arr.findIndex(r => r.id === id);
    if (idx >= 0) arr.splice(idx, 1);
    await App.saveKey('operating_expenses');
    this.renderMain();
  }
};
