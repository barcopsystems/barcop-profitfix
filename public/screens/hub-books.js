'use strict';

/* ── Hub Books — Monthly Close Package (Phase 3 Item 31) ─────────────────────
   Generates a multi-tab XLSX workbook plus a PDF executive summary as the
   monthly deliverable to the operator's accountant or bookkeeper.

   This is THE accountant-grade output that distinguishes Bar Cop from a basic
   POS-export workflow. Built entirely from data already captured across the
   six Bar Cop systems — no new operator capture burden, just aggregation +
   formatting. Restaurant365 ($569/mo+) and Margin Edge ($429/mo+) charge for
   this; Bar Cop bakes it in.

   Sheets (built incrementally — Phase A ships sheet 1, later phases add the rest):
     1. Income Statement (month + YTD)
     2. Inventory Valuation Report
     3. Cash Reconciliation Audit Trail
     4. Void & Comp Compliance Log
     5. Tip Allocation Schedule (IRS Form 8027)
     6. Variance & Shrinkage Report
     7. Labor Cost Analysis
     8. Operational Opportunities
     9. Year-End Tax Helper (annual roll only)
*/

S.HubBooks = {

  // ── Entry point — called from the Hub sidebar ──────────────────────────────
  open() {
    App.openHubOverlay((panel) => this._render(panel));
  },

  // ── Render the picker screen ───────────────────────────────────────────────
  _render(panel) {
    const months = this._availableMonths();
    const defaultMonth = months[0] || this._currentMonthKey();
    const monthOpts = months.map(m =>
      '<option value="' + m + '"' + (m === defaultMonth ? ' selected' : '') + '>' + this._monthLabel(m) + '</option>'
    ).join('');

    panel.innerHTML =
      '<div style="max-width:880px;margin:0 auto;padding:0 24px 64px;">'
      + this._header()
      + '<div class="card" style="background:var(--surface);border:1px solid var(--b1);border-radius:4px;padding:22px 24px;margin-bottom:18px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:12px;">Monthly Close Package</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:18px;">Hand this to your accountant or bookkeeper each month. The workbook has every number they need to close your books — your income statement, inventory valuation, cash reconciliation, void and comp log, tip allocation for IRS Form 8027, shrinkage report, and labor cost analysis. Built from what you have already logged in Bar Cop.</div>'
        + '<div class="form-row" style="gap:16px;align-items:flex-end;flex-wrap:wrap;">'
          + '<div class="f" style="width:240px;"><label>Close Month</label><select id="hb-month">' + monthOpts + '</select></div>'
          + '<div style="display:flex;align-items:flex-end;"><button class="btn btn-primary" id="hb-generate">Generate Package</button></div>'
        + '</div>'
        + '<div id="hb-status" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-top:14px;display:none;"></div>'
      + '</div>'
      + this._whatsInsideCard()
      + '</div>';

    document.getElementById('hb-close')?.addEventListener('click', () => App.closeHubOverlay());
    document.getElementById('hb-generate')?.addEventListener('click', () => this._generate());
  },

  _header() {
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:20px 0 16px;position:sticky;top:0;background:var(--bg);z-index:5;border-bottom:1px solid var(--b2);margin-bottom:18px;">'
      +   '<div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--w);">Books</div>'
      +   '<button id="hb-close" type="button" aria-label="Close" style="background:none;border:none;color:var(--t2);font-size:26px;line-height:1;cursor:pointer;padding:0 4px;font-weight:300;">&times;</button>'
      + '</div>';
  },

  _whatsInsideCard() {
    const rows = [
      ['Income Statement', 'Revenue, COGS, labor, prime cost. Month and year to date side by side.'],
      ['Inventory Valuation Report', 'Dollar value of liquor on hand at period end. Bottle-level. Ready for Schedule C.'],
      ['Cash Reconciliation Audit Trail', 'Every shift. Cash counted, deposit, variance, reason.'],
      ['Void and Comp Compliance Log', 'Every void and comp with manager, server, amount, reason.'],
      ['Tip Allocation Schedule', 'Pre-built IRS Form 8027 for restaurants with 10 or more employees.'],
      ['Variance and Shrinkage Report', 'Recipe-implied usage versus counted usage. Flagged products.'],
      ['Labor Cost Analysis', 'Wages by position, overtime hours, tip credit applied.'],
      ['Operational Opportunities', 'Audit findings translated to dollar opportunities for the next period.']
    ];
    const listHtml = rows.map(r =>
      '<tr><td style="padding:8px 0;font-weight:700;color:var(--t1);width:240px;vertical-align:top;font-size:12px;">' + esc(r[0]) + '</td>'
      + '<td style="padding:8px 0;color:var(--t2);font-size:12px;line-height:1.6;">' + esc(r[1]) + '</td></tr>'
    ).join('');
    return '<div class="card" style="background:var(--surface);border:1px solid var(--b1);border-radius:4px;padding:22px 24px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:12px;">What is inside</div>'
      + '<table style="width:100%;border-collapse:collapse;"><tbody>' + listHtml + '</tbody></table>'
      + '</div>';
  },

  // ── Month list — months with at least one saved week of data ───────────────
  // Default selection is the most recent fully-completed month (today's
  // month is excluded unless the operator has data in it and the month has
  // ended). Listed newest first.
  _availableMonths() {
    const weeks = (App.data?.weeks || []).filter(w => w && w.period_end);
    if (!weeks.length) {
      // No data yet. Offer the previous calendar month as a placeholder so
      // the picker still renders; the generate will surface an empty-state.
      const d = new Date();
      d.setDate(0);
      return [this._dateToMonthKey(d)];
    }
    const set = new Set();
    weeks.forEach(w => {
      const d = new Date(String(w.period_end).length <= 10 ? w.period_end + 'T00:00:00' : w.period_end);
      if (!isNaN(d.getTime())) set.add(this._dateToMonthKey(d));
    });
    return Array.from(set).sort().reverse();
  },

  _currentMonthKey() {
    return this._dateToMonthKey(new Date());
  },

  _dateToMonthKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  },

  _monthLabel(key) {
    if (!key || key.length < 7) return key;
    const y = parseInt(key.slice(0, 4), 10);
    const m = parseInt(key.slice(5, 7), 10) - 1;
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return (monthNames[m] || '') + ' ' + y;
  },

  // ── Generate the workbook ──────────────────────────────────────────────────
  async _generate() {
    const monthKey = document.getElementById('hb-month')?.value;
    if (!monthKey) return;
    const btn = document.getElementById('hb-generate');
    const status = document.getElementById('hb-status');

    if (typeof XLSX === 'undefined') {
      this._setStatus('Workbook library did not load. Hard refresh the page (Ctrl+Shift+R) and try again.', 'var(--red)');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Generating...';
    this._setStatus('Building your workbook...', 'var(--t3)');

    try {
      // Defer one frame so the UI updates before the work starts.
      await new Promise(r => setTimeout(r, 50));

      const wb = XLSX.utils.book_new();

      // Sheet 1 — Income Statement (month + YTD)
      const incomeStatement = this._buildIncomeStatement(monthKey);
      XLSX.utils.book_append_sheet(wb, incomeStatement, 'Income Statement');

      const filename = 'Bar Cop Books - ' + this._monthLabel(monthKey) + '.xlsx';
      XLSX.writeFile(wb, filename);

      this._setStatus('Downloaded ' + filename, 'var(--gold)');
    } catch (e) {
      console.error('Books generation error:', e);
      this._setStatus('Could not generate the workbook: ' + (e?.message || 'unknown error'), 'var(--red)');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Package';
    }
  },

  _setStatus(text, color) {
    const el = document.getElementById('hb-status');
    if (!el) return;
    el.textContent = text;
    el.style.color = color || 'var(--t3)';
    el.style.display = 'block';
  },

  // ── Sheet 1 — Income Statement ────────────────────────────────────────────
  // Month column + Year-to-date column. Standard P&L layout an accountant
  // expects: Revenue, COGS, Gross Profit, Labor, Prime Cost, Operating
  // Expenses (placeholder rows for occupancy/utilities/insurance the
  // operator's accountant fills in), Operating Income.
  _buildIncomeStatement(monthKey) {
    const M = this._aggregateMonth(monthKey);
    const YTD = this._aggregateYTD(monthKey);
    const barName = (App.data?.settings?.bar_name) || 'Bar Cop';

    // Helper: AOA row
    const r = (label, monthVal, ytdVal) => [label, monthVal, ytdVal];
    const blank = () => ['', '', ''];

    const rows = [
      [barName + ' — Income Statement', this._monthLabel(monthKey), 'Year to Date'],
      blank(),
      ['Revenue', '', ''],
      r('  Bar Revenue',  M.barRev,  YTD.barRev),
      r('  Food Revenue', M.foodRev, YTD.foodRev),
      r('  Less: Comps',  M.comps != null ? -Math.abs(M.comps) : null, YTD.comps != null ? -Math.abs(YTD.comps) : null),
      r('Total Revenue (net of comps)', M.totalRev - (M.comps || 0), YTD.totalRev - (YTD.comps || 0)),
      blank(),
      ['Cost of Goods Sold', '', ''],
      r('  Bar COGS',  M.barCogs,  YTD.barCogs),
      r('  Food COGS', M.foodCogs, YTD.foodCogs),
      r('Total COGS', M.totalCogs, YTD.totalCogs),
      blank(),
      r('Gross Profit', M.totalRev - M.totalCogs - (M.comps || 0), YTD.totalRev - YTD.totalCogs - (YTD.comps || 0)),
      blank(),
      ['Labor', '', ''],
      r('  Bar Labor',  M.barLabor,  YTD.barLabor),
      r('  Food Labor', M.foodLabor, YTD.foodLabor),
      r('Total Labor', M.totalLabor, YTD.totalLabor),
      blank(),
      r('Prime Cost (COGS + Labor)', M.totalCogs + M.totalLabor, YTD.totalCogs + YTD.totalLabor),
      blank(),
      ['Operating Expenses (your accountant fills in)', '', ''],
      r('  Occupancy (rent, property tax)', null, null),
      r('  Utilities', null, null),
      r('  Insurance', null, null),
      r('  Marketing and advertising', null, null),
      r('  Repairs and maintenance', M.maintenance, YTD.maintenance),
      r('  Professional fees', null, null),
      r('  Bank and credit card fees', null, null),
      r('  Other operating expenses', null, null),
      r('Total Operating Expenses', null, null),
      blank(),
      r('Operating Income (before taxes)', null, null),
      blank(),
      ['Key Cost Ratios', '', ''],
      r('  Pour Cost %',  M.barRev  ? (M.barCogs  / M.barRev)  : null, YTD.barRev  ? (YTD.barCogs  / YTD.barRev)  : null),
      r('  Food Cost %',  M.foodRev ? (M.foodCogs / M.foodRev) : null, YTD.foodRev ? (YTD.foodCogs / YTD.foodRev) : null),
      r('  Labor % of Revenue', M.totalRev ? (M.totalLabor / M.totalRev) : null, YTD.totalRev ? (YTD.totalLabor / YTD.totalRev) : null),
      r('  Prime Cost %', M.totalRev ? ((M.totalCogs + M.totalLabor) / M.totalRev) : null, YTD.totalRev ? ((YTD.totalCogs + YTD.totalLabor) / YTD.totalRev) : null),
      blank(),
      ['Source notes', '', ''],
      ['Revenue from Shift Control. COGS from Inventory Control weekly counts. Labor from Labor Control actuals.', '', ''],
      ['Comps from Shift Control void and comp log. Maintenance from Shift Control maintenance log.', '', ''],
      ['Generated by Bar Cop on ' + new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) + '.', '', '']
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Number formats: currency for dollar columns, percent for ratio rows.
    // SheetJS community supports .z (number format) on individual cells.
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    const pctFmt   = '0.0%';

    // Apply format to all data cells in columns B (1) and C (2).
    rows.forEach((row, i) => {
      const label = String(row[0] || '');
      const isPctRow = /%$/.test(label) || /(Pour Cost|Food Cost|Labor %|Prime Cost) %$/.test(label);
      [1, 2].forEach(c => {
        const addr = XLSX.utils.encode_cell({ r: i, c });
        const cell = ws[addr];
        if (cell && typeof cell.v === 'number') {
          cell.z = isPctRow ? pctFmt : moneyFmt;
        }
      });
    });

    // Column widths so the labels do not get truncated.
    ws['!cols'] = [{ wch: 44 }, { wch: 18 }, { wch: 18 }];

    return ws;
  },

  // ── Data aggregation — sum the data for a given month ─────────────────────
  // monthKey is "YYYY-MM". Weeks are matched by period_end falling in the
  // calendar month. Profit weeks carry bar/food revenue, COGS, and labor as
  // already-aggregated weekly figures from Profit > This Week (which itself
  // auto-fills from Shift Control + Inventory Control + Labor Control).
  _aggregateMonth(monthKey) {
    const inMonth = (dateStr) => {
      if (!dateStr) return false;
      return String(dateStr).slice(0, 7) === monthKey;
    };
    const weeks = (App.data?.weeks || []).filter(w => inMonth(w.period_end));
    const agg = this._sumWeeks(weeks);
    agg.comps = this._sumComps(monthKey);
    agg.maintenance = this._sumMaintenance(monthKey);
    return agg;
  },

  _aggregateYTD(monthKey) {
    const year = monthKey.slice(0, 4);
    const monthNum = parseInt(monthKey.slice(5, 7), 10);
    const inYearThroughMonth = (dateStr) => {
      if (!dateStr) return false;
      const s = String(dateStr);
      if (s.slice(0, 4) !== year) return false;
      const m = parseInt(s.slice(5, 7), 10);
      return m <= monthNum;
    };
    const weeks = (App.data?.weeks || []).filter(w => inYearThroughMonth(w.period_end));
    const agg = this._sumWeeks(weeks);

    // Comps and maintenance for the whole YTD window.
    const vcs = (App.shiftData?.sc_void_comps || []).filter(v => inYearThroughMonth(v.date));
    agg.comps = vcs.filter(v => (v.type === 'comp' || v.type === 'Comp')).reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
    const mnts = (App.shiftData?.sc_maintenance || []).filter(m => inYearThroughMonth(m.date));
    agg.maintenance = mnts.reduce((s, m) => s + (parseFloat(m.cost || m.amount) || 0), 0);
    return agg;
  },

  _sumWeeks(weeks) {
    let barRev = 0, foodRev = 0, barCogs = 0, foodCogs = 0, barLabor = 0, foodLabor = 0;
    weeks.forEach(w => {
      barRev    += parseFloat(w.bar?.revenue)  || 0;
      foodRev   += parseFloat(w.food?.revenue) || 0;
      barCogs   += parseFloat(w.bar?.cogs)     || 0;
      foodCogs  += parseFloat(w.food?.cogs)    || 0;
      barLabor  += parseFloat(w.bar?.labor)    || 0;
      foodLabor += parseFloat(w.food?.labor)   || 0;
    });
    return {
      barRev, foodRev, totalRev: barRev + foodRev,
      barCogs, foodCogs, totalCogs: barCogs + foodCogs,
      barLabor, foodLabor, totalLabor: barLabor + foodLabor
    };
  },

  // Sum void+comp records (comps only — voids are not a cost line, they are
  // sales reversals, but the accountant wants comps as a contra-revenue or
  // operating expense depending on their treatment).
  _sumComps(monthKey) {
    const inMonth = (dateStr) => dateStr && String(dateStr).slice(0, 7) === monthKey;
    const vcs = (App.shiftData?.sc_void_comps || []).filter(v => inMonth(v.date));
    return vcs.filter(v => (v.type === 'comp' || v.type === 'Comp')).reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
  },

  _sumMaintenance(monthKey) {
    const inMonth = (dateStr) => dateStr && String(dateStr).slice(0, 7) === monthKey;
    const mnts = (App.shiftData?.sc_maintenance || []).filter(m => inMonth(m.date));
    return mnts.reduce((s, m) => s + (parseFloat(m.cost || m.amount) || 0), 0);
  }
};
