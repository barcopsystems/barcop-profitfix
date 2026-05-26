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
        + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:18px;">Hand this to your accountant or bookkeeper each month. The workbook has every number they need to close your books — income statement, inventory valuation, cash reconciliation, void and comp log, tip allocation worksheet for IRS Form 8027, shrinkage report, and labor cost analysis. Built from what you have already logged in Bar Cop.</div>'
        + '<div class="form-row" style="gap:16px;align-items:flex-end;flex-wrap:wrap;">'
          + '<div class="f" style="width:240px;"><label>Close Month</label><select id="hb-month">' + monthOpts + '</select></div>'
          + '<div style="display:flex;align-items:flex-end;"><button class="btn btn-primary" id="hb-generate">Generate Package</button></div>'
        + '</div>'
        + '<div id="hb-status" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-top:14px;display:none;"></div>'
        + '<div style="font-size:10px;color:var(--t3);font-style:italic;line-height:1.6;margin-top:18px;padding-top:12px;border-top:1px solid var(--b2);">Generated from the data you have logged in Bar Cop. Bar Cop is a software tool, not a tax preparer, accountant, or CPA. Your accountant should review and verify before filing any tax form or closing your books.</div>'
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
      ['Inventory Valuation Report', 'Dollar value of inventory on hand at period end. Bottle-level. Ready for Schedule C.'],
      ['Cash Reconciliation Audit Trail', 'Every shift. POS revenue, expected vs counted cash, variance, reason.'],
      ['Void and Comp Compliance Log', 'Every void and comp with manager, server, amount, reason.'],
      ['Tip Allocation Worksheet', 'Pre-built worksheet for IRS Form 8027. Your accountant transcribes the figures onto the actual form.'],
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

      XLSX.utils.book_append_sheet(wb, this._buildIncomeStatement(monthKey),    'Income Statement');
      XLSX.utils.book_append_sheet(wb, this._buildInventoryValuation(monthKey), 'Inventory Valuation');
      XLSX.utils.book_append_sheet(wb, this._buildCashReconciliation(monthKey), 'Cash Reconciliation');
      XLSX.utils.book_append_sheet(wb, this._buildVoidCompLog(monthKey),        'Void and Comp Log');
      XLSX.utils.book_append_sheet(wb, this._buildTipAllocation(monthKey),      'Form 8027 Worksheet');

      // Workbook properties so the disclaimer is visible in Excel's File >
      // Properties pane too, not only in the sheet footers.
      wb.Props = {
        Title:        'Bar Cop Books — ' + this._monthLabel(monthKey),
        Subject:      'Monthly close package generated by Bar Cop from operator input data. Bar Cop is a software tool, not a tax preparer or CPA. The accountant or bookkeeper should review and verify before filing.',
        Author:       (App.data?.settings?.bar_name) || 'Bar Cop',
        Company:      'Bar Cop',
        CreatedDate:  new Date()
      };

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
      ['Generated by Bar Cop on ' + new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) + '.', '', ''],
      blank(),
      [this._disclaimer(), '', '']
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

  // ── Shared disclaimer line for every sheet footer ────────────────────────
  // Bar Cop is a software tool, not a tax preparer. Every output that an
  // accountant or regulator could mistake for a finished compliance artifact
  // carries this line in the deliverable itself, per the legal-protection
  // standing rule. Not buried in ToS — in the file.
  _disclaimer() {
    return 'Generated from your input data on ' + new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
      + '. Bar Cop is a software tool, not a tax preparer, accountant, or CPA. Your accountant should review and verify before filing or closing your books.';
  },

  // ── Sheet 2 — Inventory Valuation Report ─────────────────────────────────
  // Snapshot of inventory value at period end (or as close to it as the
  // operator's most recent count gets us), broken down bottle-by-bottle,
  // subtotaled by category and storage location. Includes the Schedule C
  // COGS math (beginning + purchases - ending = COGS for the period) when
  // both a prior-period count and the current count are present, plus
  // purchases summed from receive-delivery records.
  _buildInventoryValuation(monthKey) {
    const barName = (App.data?.settings?.bar_name) || 'Bar Cop';

    // Find the last count taken on or before the period end. That's our
    // "ending inventory" snapshot for the month.
    const periodEnd = this._monthEndDate(monthKey);
    const periodStart = this._monthStartDate(monthKey);
    const counts = (App.inventoryData?.ic_counts || [])
      .slice()
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    const endingCount = counts.filter(c => c.date && c.date <= periodEnd).slice(-1)[0] || null;
    // Beginning = last count taken before the period start. May be null.
    const beginningCount = counts.filter(c => c.date && c.date < periodStart).slice(-1)[0] || null;

    // Purchases = sum of ic_deliveries with date in the month.
    const inMonth = (d) => d && String(d).slice(0, 7) === monthKey;
    const purchases = (App.inventoryData?.ic_deliveries || [])
      .filter(d => inMonth(d.date))
      .reduce((s, d) => s + (parseFloat(d.total) || 0), 0);

    const blank = () => ['', '', '', '', ''];
    const rows = [];

    rows.push([barName + ' — Inventory Valuation', this._monthLabel(monthKey), '', '', '']);
    rows.push(blank());

    if (!endingCount) {
      rows.push(['No inventory count on file for this period.', '', '', '', '']);
      rows.push(['Take a count in Inventory Control before closing the month so this sheet can value your inventory.', '', '', '', '']);
      rows.push(blank());
      rows.push([this._disclaimer(), '', '', '', '']);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 56 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
      return ws;
    }

    // Schedule C COGS math (lines 35-42 on the IRS form).
    const beginValue  = beginningCount ? (parseFloat(beginningCount.total_value) || 0) : null;
    const endingValue = parseFloat(endingCount.total_value) || 0;
    const calcCogs    = (beginValue != null) ? (beginValue + purchases - endingValue) : null;

    rows.push(['Schedule C COGS Math (for the accountant)', '', '', '', '']);
    rows.push(['  Beginning Inventory (count dated ' + (beginningCount?.date || 'none on file') + ')', beginValue, '', '', '']);
    rows.push(['  Plus Purchases (from receive-delivery log this month)', purchases, '', '', '']);
    rows.push(['  Less Ending Inventory (count dated ' + endingCount.date + ')', endingValue != null ? -endingValue : null, '', '', '']);
    rows.push(['  Cost of Goods Sold (calculated)', calcCogs, '', '', '']);
    rows.push(blank());

    // Subtotal by category.
    const items = endingCount.items || [];
    const byCat = {};
    items.forEach(it => {
      const cat = it.category || 'Uncategorized';
      if (!byCat[cat]) byCat[cat] = { qty: 0, value: 0 };
      byCat[cat].qty   += parseFloat(it.total) || 0;
      byCat[cat].value += parseFloat(it.value) || 0;
    });
    rows.push(['Ending Inventory by Category', 'Units', 'Value', '', '']);
    Object.keys(byCat).sort().forEach(c => {
      rows.push(['  ' + c, byCat[c].qty, byCat[c].value, '', '']);
    });
    rows.push(['Total Ending Inventory', items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0), endingValue, '', '']);
    rows.push(blank());

    // Bottle-level detail.
    rows.push(['Bottle-Level Detail', '', '', '', '']);
    rows.push(['Product', 'Category', 'Units', 'Unit Cost', 'Extended Value']);
    items.slice().sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''))
      .forEach(it => {
        rows.push([it.name || '', it.category || '', parseFloat(it.total) || 0, parseFloat(it.unit_cost) || 0, parseFloat(it.value) || 0]);
      });

    rows.push(blank());
    rows.push(['Source: Inventory Control count dated ' + endingCount.date + ' (type: ' + (endingCount.type || 'Full') + ', counted by ' + (endingCount.counted_by || 'unrecorded') + ').', '', '', '', '']);
    rows.push([this._disclaimer(), '', '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    const qtyFmt   = '#,##0.00';
    // Format columns B-E as money for value rows, qty for unit rows.
    rows.forEach((row, i) => {
      const c1 = XLSX.utils.encode_cell({ r: i, c: 1 });
      const c2 = XLSX.utils.encode_cell({ r: i, c: 2 });
      const c3 = XLSX.utils.encode_cell({ r: i, c: 3 });
      const c4 = XLSX.utils.encode_cell({ r: i, c: 4 });
      const apply = (addr, fmt) => { const cell = ws[addr]; if (cell && typeof cell.v === 'number') cell.z = fmt; };
      // Bottle-level rows have qty in col 2, unit cost in col 3, ext value in col 4
      // Other rows have value in col 1 or 2. Use heuristic by column position.
      apply(c1, moneyFmt);
      apply(c2, /Units$/.test(String(row[1])) ? qtyFmt : moneyFmt);
      apply(c3, moneyFmt);
      apply(c4, moneyFmt);
    });
    ws['!cols'] = [{ wch: 42 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    return ws;
  },

  // ── Sheet 3 — Cash Reconciliation Audit Trail ─────────────────────────────
  // Per-shift table joining sc_shifts (total revenue) with sc_variances
  // (expected vs counted cash + reason). This is the documentation the IRS
  // looks for in a cash-heavy business audit. Monthly totals at the bottom.
  _buildCashReconciliation(monthKey) {
    const barName = (App.data?.settings?.bar_name) || 'Bar Cop';
    const inMonth = (d) => d && String(d).slice(0, 7) === monthKey;
    const shifts    = (App.shiftData?.sc_shifts    || []).filter(s => inMonth(s.date));
    const variances = (App.shiftData?.sc_variances || []).filter(v => inMonth(v.date));

    // Index variances by date + shift_type so we can join with the shift row.
    const vKey = (date, type) => (date || '') + '|' + (type || '');
    const vIndex = {};
    variances.forEach(v => {
      const k = vKey(v.date, v.shift_type);
      if (!vIndex[k]) vIndex[k] = [];
      vIndex[k].push(v);
    });

    const rows = [];
    rows.push([barName + ' — Cash Reconciliation Audit Trail', this._monthLabel(monthKey), '', '', '', '', '', '', '']);
    const blank = () => ['', '', '', '', '', '', '', '', ''];
    rows.push(blank());
    rows.push(['Date', 'Shift', 'Manager', 'Total Revenue', 'Expected Cash', 'Counted Cash', 'Variance', 'Status', 'Reason']);

    let totalRev = 0, totalExp = 0, totalCnt = 0, totalVar = 0;

    // One row per shift. If a matching variance exists, join it.
    const sortedShifts = shifts.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (sortedShifts.length === 0) {
      rows.push(['(no shifts logged this month)', '', '', '', '', '', '', '', '']);
    } else {
      sortedShifts.forEach(s => {
        const k = vKey(s.date, s.shift_type);
        const matches = vIndex[k] || [];
        const v = matches[0] || null;
        const rev = parseFloat(s.total_revenue) || 0;
        const exp = v ? (parseFloat(v.expected_cash) || 0) : null;
        const cnt = v ? (parseFloat(v.counted_cash)  || 0) : null;
        const varc = v ? (parseFloat(v.variance) || (cnt - exp)) : null;
        rows.push([
          s.date || '',
          s.shift_type || '',
          s.manager || '',
          rev,
          exp,
          cnt,
          varc,
          v ? (v.status || '') : '',
          v ? (v.reason || '') : ''
        ]);
        totalRev += rev;
        if (exp != null) totalExp += exp;
        if (cnt != null) totalCnt += cnt;
        if (varc != null) totalVar += varc;
      });

      // Orphan variances (variance recorded with no matching shift) — still
      // belongs on the audit trail.
      const accountedFor = new Set();
      sortedShifts.forEach(s => accountedFor.add(vKey(s.date, s.shift_type)));
      variances.forEach(v => {
        if (accountedFor.has(vKey(v.date, v.shift_type))) return;
        const exp = parseFloat(v.expected_cash) || 0;
        const cnt = parseFloat(v.counted_cash)  || 0;
        const varc = parseFloat(v.variance) || (cnt - exp);
        rows.push([v.date || '', v.shift_type || '', v.cashier || '', null, exp, cnt, varc, v.status || '', v.reason || '']);
        totalExp += exp;
        totalCnt += cnt;
        totalVar += varc;
      });
    }

    rows.push(blank());
    rows.push(['Monthly Totals', '', '', totalRev, totalExp, totalCnt, totalVar, '', '']);
    rows.push(blank());
    rows.push(['Source: Shift Control sc_shifts (revenue) and sc_variances (cash variance). Variance = counted minus expected. Status from your tolerance setting in App Settings.', '', '', '', '', '', '', '', '']);
    rows.push([this._disclaimer(), '', '', '', '', '', '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    rows.forEach((row, i) => {
      [3, 4, 5, 6].forEach(c => {
        const addr = XLSX.utils.encode_cell({ r: i, c });
        const cell = ws[addr];
        if (cell && typeof cell.v === 'number') cell.z = moneyFmt;
      });
    });
    ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 36 }];
    return ws;
  },

  // ── Sheet 4 — Void & Comp Compliance Log ──────────────────────────────────
  // Every void and comp in the month with full audit context: who, when,
  // what, how much, why, who authorized. Subtotals by type, by manager, by
  // reason. Required for sales-tax reconciliation in most states and for
  // internal-controls documentation during an audit.
  _buildVoidCompLog(monthKey) {
    const barName = (App.data?.settings?.bar_name) || 'Bar Cop';
    const inMonth = (d) => d && String(d).slice(0, 7) === monthKey;
    const records = (App.shiftData?.sc_void_comps || [])
      .filter(r => inMonth(r.date))
      .slice()
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.created_at || '').localeCompare(b.created_at || ''));

    const rows = [];
    const blank = () => ['', '', '', '', '', '', '', '', ''];
    rows.push([barName + ' — Void and Comp Compliance Log', this._monthLabel(monthKey), '', '', '', '', '', '', '']);
    rows.push(blank());
    rows.push(['Date', 'Type', 'Shift', 'Item', 'Amount', 'Server', 'Authorized By', 'Check #', 'Reason']);

    let totalVoids = 0, totalComps = 0;
    const byMgr = {}, byReason = {};

    if (records.length === 0) {
      rows.push(['(no voids or comps recorded this month)', '', '', '', '', '', '', '', '']);
    } else {
      records.forEach(r => {
        const amt = parseFloat(r.amount) || 0;
        rows.push([r.date || '', r.type || '', r.shift_type || '', r.item || '', amt, r.server || '', r.authorized_by || '', r.check_number || '', r.reason || '']);
        const type = (r.type || '').toLowerCase();
        if (type === 'void') totalVoids += amt;
        else if (type === 'comp') totalComps += amt;
        const mgr = r.authorized_by || '(none recorded)';
        byMgr[mgr] = (byMgr[mgr] || 0) + amt;
        const rea = r.reason || '(none recorded)';
        byReason[rea] = (byReason[rea] || 0) + amt;
      });
    }

    rows.push(blank());
    rows.push(['Monthly Totals by Type', '', '', '', '', '', '', '', '']);
    rows.push(['  Total Voids', '', '', '', totalVoids, '', '', '', '']);
    rows.push(['  Total Comps', '', '', '', totalComps, '', '', '', '']);
    rows.push(['  Combined', '', '', '', totalVoids + totalComps, '', '', '', '']);
    rows.push(blank());

    if (Object.keys(byMgr).length) {
      rows.push(['Subtotal by Authorizer', 'Amount', '', '', '', '', '', '', '']);
      Object.keys(byMgr).sort().forEach(mgr => {
        rows.push(['  ' + mgr, byMgr[mgr], '', '', '', '', '', '', '']);
      });
      rows.push(blank());
    }

    if (Object.keys(byReason).length) {
      rows.push(['Subtotal by Reason', 'Amount', '', '', '', '', '', '', '']);
      Object.keys(byReason).sort().forEach(rea => {
        rows.push(['  ' + rea, byReason[rea], '', '', '', '', '', '', '']);
      });
      rows.push(blank());
    }

    rows.push(['Source: Shift Control sc_void_comps. Required for sales-tax reconciliation and internal-controls documentation.', '', '', '', '', '', '', '', '']);
    rows.push([this._disclaimer(), '', '', '', '', '', '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    rows.forEach((row, i) => {
      [1, 4].forEach(c => {
        const addr = XLSX.utils.encode_cell({ r: i, c });
        const cell = ws[addr];
        if (cell && typeof cell.v === 'number') cell.z = moneyFmt;
      });
    });
    ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 30 }];
    return ws;
  },

  // ── Sheet 5 — Tip Allocation Worksheet (IRS Form 8027) ────────────────────
  // Worksheet, not the form itself. The operator (or their CPA) transcribes
  // these line values onto the actual IRS Form 8027 and signs it. Bar Cop
  // is a software tool, not a tax preparer.
  //
  // Form 8027 is required for "large food and beverage establishments" —
  // operators with more than 10 employees on a typical business day where
  // tipping is customary. Some operators do not need to file. We compute
  // the figures unconditionally so the accountant has the data either way.
  _buildTipAllocation(monthKey) {
    const barName = (App.data?.settings?.bar_name) || 'Bar Cop';
    const inMonth = (d) => d && String(d).slice(0, 7) === monthKey;
    const tips   = (App.laborData?.lc_tips   || []).filter(t => inMonth(t.date));
    const shifts = (App.shiftData?.sc_shifts || []).filter(s => inMonth(s.date));

    // Aggregate revenue for the month from shifts (all categories — Form 8027
    // line 6 is "Gross receipts from food, beverages, and other taxable
    // services").
    const grossReceipts = shifts.reduce((s, sh) => s + (parseFloat(sh.total_revenue) || 0), 0);

    // Total charged tips (Line 1) = sum of card_tips.
    // Total tips reported by employees (Line 4b proxy) = sum of total_tips.
    // We do not track "charged receipts on which tips were charged" (Line 2)
    // or service charges <10% paid as wages (Line 3) separately — those
    // are blank for the accountant to fill in.
    const totalChargedTips = tips.reduce((s, t) => s + (parseFloat(t.card_tips) || 0), 0);
    const totalCashTips    = tips.reduce((s, t) => s + (parseFloat(t.cash_tips) || 0), 0);
    const totalReported    = tips.reduce((s, t) => s + (parseFloat(t.total_tips) || (parseFloat(t.cash_tips) || 0) + (parseFloat(t.card_tips) || 0)), 0);

    // Line 7: 8% of gross receipts (the IRS default; some establishments
    // have an approved lower rate). Line 7a: allocated tips = max(0, L7 - L5).
    const line7  = grossReceipts * 0.08;
    const line7a = Math.max(0, line7 - totalReported);

    const rows = [];
    const blank = () => ['', '', '', '', ''];
    rows.push([barName + ' — Tip Allocation Worksheet (IRS Form 8027)', this._monthLabel(monthKey), '', '', '']);
    rows.push(blank());
    rows.push(['This is a WORKSHEET, not the IRS form itself. Your accountant transcribes these line values onto the actual Form 8027 and signs it.', '', '', '', '']);
    rows.push(['Form 8027 is required for "large food and beverage establishments" — more than 10 employees on a typical business day. Some operators do not need to file. Confirm with your accountant.', '', '', '', '']);
    rows.push(blank());

    rows.push(['Form 8027 Lines (calculated for the month)', '', '', '', '']);
    rows.push(['  Line 1  — Total charged tips for the month',                     totalChargedTips, '', '', '']);
    rows.push(['  Line 2  — Total charge receipts on which charged tips were shown', null,           '(your accountant fills — Bar Cop does not track separately)', '', '']);
    rows.push(['  Line 3  — Total service charges less than 10% paid as wages',     null,           '(your accountant fills if applicable)', '', '']);
    rows.push(['  Line 4a — Tips reported by indirectly tipped employees',          null,           '(your accountant categorizes; Bar Cop logs total)', '', '']);
    rows.push(['  Line 4b — Tips reported by directly tipped employees',            null,           '(your accountant categorizes; Bar Cop logs total)', '', '']);
    rows.push(['  Line 5  — Total tips reported (4a + 4b)',                         totalReported, '', '', '']);
    rows.push(['  Line 6  — Gross receipts from food and beverage',                 grossReceipts, '', '', '']);
    rows.push(['  Line 7  — 8% of gross receipts (or your approved lower rate)',    line7,         '', '', '']);
    rows.push(['  Line 7a — Allocated tips (Line 7 minus Line 5, but not below 0)', line7a,        '', '', '']);
    rows.push(blank());

    rows.push(['Reference Totals (informational)', '', '', '', '']);
    rows.push(['  Total Cash Tips logged',  totalCashTips,    '', '', '']);
    rows.push(['  Total Card Tips logged',  totalChargedTips, '', '', '']);
    rows.push(['  Combined Tips logged',    totalReported,    '', '', '']);
    rows.push(blank());

    // Per-employee, per-shift detail.
    rows.push(['Per-Employee Tip Detail', '', '', '', '']);
    rows.push(['Date', 'Employee', 'Shift', 'Hours', 'Total Tips']);
    const sortedTips = tips.slice().sort((a, b) =>
      (a.date || '').localeCompare(b.date || '') || (a.name || '').localeCompare(b.name || '')
    );
    if (sortedTips.length === 0) {
      rows.push(['(no tips logged this month)', '', '', '', '']);
    } else {
      sortedTips.forEach(t => {
        const total = parseFloat(t.total_tips) || ((parseFloat(t.cash_tips) || 0) + (parseFloat(t.card_tips) || 0));
        rows.push([t.date || '', t.name || '', t.shift_type || '', parseFloat(t.hours) || null, total]);
      });
    }

    // Per-employee totals (for proportional allocation if 7a > 0).
    const byEmp = {};
    sortedTips.forEach(t => {
      const name = t.name || '(unnamed)';
      if (!byEmp[name]) byEmp[name] = { tips: 0, hours: 0 };
      byEmp[name].tips  += parseFloat(t.total_tips) || ((parseFloat(t.cash_tips) || 0) + (parseFloat(t.card_tips) || 0));
      byEmp[name].hours += parseFloat(t.hours) || 0;
    });
    if (Object.keys(byEmp).length) {
      rows.push(blank());
      rows.push(['Per-Employee Monthly Totals', '', '', '', '']);
      rows.push(['Employee', 'Hours', 'Tips Reported', 'Share of Hours', 'Suggested Allocation (Line 7a × share)']);
      const totalHours = Object.values(byEmp).reduce((s, e) => s + e.hours, 0);
      Object.keys(byEmp).sort().forEach(name => {
        const e = byEmp[name];
        const share = totalHours > 0 ? (e.hours / totalHours) : 0;
        const suggested = line7a * share;
        rows.push([name, e.hours, e.tips, share, suggested]);
      });
    }

    rows.push(blank());
    rows.push(['Source: Labor Control lc_tips (per-shift tip log) and Shift Control sc_shifts (gross receipts).', '', '', '', '']);
    rows.push([this._disclaimer(), '', '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    const pctFmt   = '0.0%';
    rows.forEach((row, i) => {
      // Column 1 is mostly money.
      const c1 = XLSX.utils.encode_cell({ r: i, c: 1 });
      const cell1 = ws[c1];
      if (cell1 && typeof cell1.v === 'number') cell1.z = moneyFmt;
      // For the per-employee totals table, col 3 is a share (percent), col 4 is money.
      const isShareRow = String(row[0]).startsWith('Employee') === false && typeof row[3] === 'number' && row[3] < 1 && typeof row[4] === 'number';
      if (isShareRow) {
        const c3 = XLSX.utils.encode_cell({ r: i, c: 3 });
        const c4 = XLSX.utils.encode_cell({ r: i, c: 4 });
        if (ws[c3]) ws[c3].z = pctFmt;
        if (ws[c4]) ws[c4].z = moneyFmt;
      }
      // For per-employee detail rows, col 4 is total tips (money).
      const c4d = XLSX.utils.encode_cell({ r: i, c: 4 });
      if (ws[c4d] && typeof ws[c4d].v === 'number' && !isShareRow) ws[c4d].z = moneyFmt;
    });
    ws['!cols'] = [{ wch: 56 }, { wch: 18 }, { wch: 48 }, { wch: 18 }, { wch: 32 }];
    return ws;
  },

  // ── Period-bound helpers ──────────────────────────────────────────────────
  _monthStartDate(monthKey) {
    return monthKey + '-01';
  },
  _monthEndDate(monthKey) {
    const y = parseInt(monthKey.slice(0, 4), 10);
    const m = parseInt(monthKey.slice(5, 7), 10);
    // last day of month
    const d = new Date(y, m, 0);
    return d.toISOString().slice(0, 10);
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
