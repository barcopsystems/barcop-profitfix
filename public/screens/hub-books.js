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
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:12px;">Month-End Books</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:18px;">Pick a month. Bar Cop pulls every number together into one file your accountant or bookkeeper can work from. Income statement, inventory value, cash variance, voids and comps, tip allocation worksheet for IRS Form 8027, shrinkage, and labor cost. All built from what you log in Bar Cop. Nothing to re-enter.</div>'
        + '<div class="form-row" style="gap:16px;align-items:flex-end;flex-wrap:wrap;">'
          + '<div class="f" style="width:240px;"><label>Close Month</label><select id="hb-month">' + monthOpts + '</select></div>'
          + '<div style="display:flex;align-items:flex-end;"><button class="btn btn-primary" id="hb-generate">Generate File</button></div>'
        + '</div>'
        + '<div id="hb-status" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-top:14px;display:none;"></div>'
        + '<div style="font-size:10px;color:var(--t3);font-style:italic;line-height:1.6;margin-top:18px;padding-top:12px;border-top:1px solid var(--b2);">Bar Cop pulls these numbers from what you have logged. It is a software tool, not a CPA or tax preparer. Your accountant should look it over before filing anything or closing the books.</div>'
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
      ['Inventory Valuation', 'Dollar value of what is on the shelf at month end. Bottle by bottle. Ready for Schedule C.'],
      ['Cash Reconciliation', 'Every shift. POS revenue, expected cash, counted cash, variance, reason.'],
      ['Void and Comp Log', 'Every void and comp with the manager who signed off, the server, the amount, the reason.'],
      ['Tip Allocation Worksheet', 'Numbers for IRS Form 8027. Your accountant transcribes them onto the actual form.'],
      ['Variance and Shrinkage', 'What the recipes say you sold versus what the count says you have. Flags the gaps.'],
      ['Labor Cost Analysis', 'Wages by position, overtime hours, tip credit applied.'],
      ['Operational Opportunities', 'Your audits turned into dollars you can pull back next month.']
    ];
    const listHtml = rows.map(r =>
      '<tr><td style="padding:8px 0;font-weight:700;color:var(--t1);width:240px;vertical-align:top;font-size:12px;">' + esc(r[0]) + '</td>'
      + '<td style="padding:8px 0;color:var(--t2);font-size:12px;line-height:1.6;">' + esc(r[1]) + '</td></tr>'
    ).join('');
    return '<div class="card" style="background:var(--surface);border:1px solid var(--b1);border-radius:4px;padding:22px 24px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:12px;">What is in the file</div>'
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
      this._setStatus('The file builder did not load. Hard refresh the page (Ctrl+Shift+R) and try again.', 'var(--red)');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Building...';
    this._setStatus('Building your file...', 'var(--t3)');

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
        Title:        'Bar Cop Books, ' + this._monthLabel(monthKey),
        Subject:      'Month-end books generated by Bar Cop from operator input data. Bar Cop is a software tool, not a tax preparer or CPA. The accountant or bookkeeper should review and verify before filing.',
        Author:       (App.data?.settings?.bar_name) || 'Bar Cop',
        Company:      'Bar Cop',
        CreatedDate:  new Date()
      };

      const filename = 'Bar Cop Books - ' + this._monthLabel(monthKey) + '.xlsx';
      XLSX.writeFile(wb, filename);

      this._setStatus('Downloaded ' + filename, 'var(--gold)');
    } catch (e) {
      console.error('Books generation error:', e);
      this._setStatus('Could not build the file: ' + (e?.message || 'unknown error'), 'var(--red)');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate File';
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
    const COL_COUNT = 3;

    const r = (label, monthVal, ytdVal) => [label, monthVal, ytdVal];
    const blank = () => this._blankRow(COL_COUNT);

    const rows = [];
    const merges = [];

    // Row 1: Title (merged A:C)
    rows.push(this._lineRow(this._baseTitle('Income Statement', monthKey), COL_COUNT));
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: COL_COUNT - 1 } });
    rows.push(blank());

    // Column header row
    rows.push(['', this._monthLabel(monthKey), 'Year to Date']);
    rows.push(blank());

    // Revenue
    rows.push(['Revenue', '', '']);
    rows.push(r('  Bar Revenue',  M.barRev,  YTD.barRev));
    rows.push(r('  Food Revenue', M.foodRev, YTD.foodRev));
    rows.push(r('  Less: Comps',  M.comps != null ? -Math.abs(M.comps) : null, YTD.comps != null ? -Math.abs(YTD.comps) : null));
    rows.push(r('Total Revenue (net of comps)', M.totalRev - (M.comps || 0), YTD.totalRev - (YTD.comps || 0)));
    rows.push(blank());

    // COGS
    rows.push(['Cost of Goods Sold', '', '']);
    rows.push(r('  Bar COGS',  M.barCogs,  YTD.barCogs));
    rows.push(r('  Food COGS', M.foodCogs, YTD.foodCogs));
    rows.push(r('Total COGS', M.totalCogs, YTD.totalCogs));
    rows.push(blank());

    rows.push(r('Gross Profit', M.totalRev - M.totalCogs - (M.comps || 0), YTD.totalRev - YTD.totalCogs - (YTD.comps || 0)));
    rows.push(blank());

    // Labor
    rows.push(['Labor', '', '']);
    rows.push(r('  Bar Labor',  M.barLabor,  YTD.barLabor));
    rows.push(r('  Food Labor', M.foodLabor, YTD.foodLabor));
    rows.push(r('Total Labor', M.totalLabor, YTD.totalLabor));
    rows.push(blank());

    rows.push(r('Prime Cost (COGS + Labor)', M.totalCogs + M.totalLabor, YTD.totalCogs + YTD.totalLabor));
    rows.push(blank());

    // Operating Expenses
    rows.push(['Operating Expenses (your accountant fills in)', '', '']);
    rows.push(r('  Occupancy (rent, property tax)', null, null));
    rows.push(r('  Utilities', null, null));
    rows.push(r('  Insurance', null, null));
    rows.push(r('  Marketing and advertising', null, null));
    rows.push(r('  Repairs and maintenance', M.maintenance, YTD.maintenance));
    rows.push(r('  Professional fees', null, null));
    rows.push(r('  Bank and credit card fees', null, null));
    rows.push(r('  Other operating expenses', null, null));
    rows.push(r('Total Operating Expenses', null, null));
    rows.push(blank());

    rows.push(r('Operating Income (before taxes)', null, null));
    rows.push(blank());

    // Key Ratios
    rows.push(['Key Cost Ratios', '', '']);
    rows.push(r('  Pour Cost %',  M.barRev  ? (M.barCogs  / M.barRev)  : null, YTD.barRev  ? (YTD.barCogs  / YTD.barRev)  : null));
    rows.push(r('  Food Cost %',  M.foodRev ? (M.foodCogs / M.foodRev) : null, YTD.foodRev ? (YTD.foodCogs / YTD.foodRev) : null));
    rows.push(r('  Labor % of Revenue', M.totalRev ? (M.totalLabor / M.totalRev) : null, YTD.totalRev ? (YTD.totalLabor / YTD.totalRev) : null));
    rows.push(r('  Prime Cost %', M.totalRev ? ((M.totalCogs + M.totalLabor) / M.totalRev) : null, YTD.totalRev ? ((YTD.totalCogs + YTD.totalLabor) / YTD.totalRev) : null));

    // Source notes (each line as its own merged row)
    rows.push(blank());
    rows.push(this._lineRow('Revenue from Shift Control. COGS from Inventory Control weekly counts. Labor from Labor Control actuals.', COL_COUNT));
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: COL_COUNT - 1 } });
    rows.push(this._lineRow('Comps from Shift Control void and comp log. Maintenance from Shift Control maintenance log.', COL_COUNT));
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: COL_COUNT - 1 } });

    // Footer + disclaimer
    this._pushFooter(rows, merges, null, COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    const pctFmt   = '0.0%';
    rows.forEach((row, i) => {
      const label = String(row[0] || '');
      const isPctRow = /%$/.test(label);
      [1, 2].forEach(c => {
        const addr = XLSX.utils.encode_cell({ r: i, c });
        const cell = ws[addr];
        if (cell && typeof cell.v === 'number') cell.z = isPctRow ? pctFmt : moneyFmt;
      });
    });

    return this._finishSheet(ws, rows.length, merges, [{ wch: 56 }, { wch: 20 }, { wch: 20 }]);
  },

  // ── Shared formatting helpers for cohesion across every sheet ────────────
  // The 5 sheets share a layout pattern so the deliverable feels consistent:
  // Row 1: title (merged across all columns, taller row height)
  // Row 2: blank
  // Row 3+: column header row, then data
  // Footer: blank, source note (merged), then 3 disclaimer lines (each merged)
  //
  // SheetJS community does not write cell styles (bold/colors), but it does
  // write column widths, row heights, and cell merges. Merges across the
  // full row are the trick that keeps long text from being clipped by an
  // adjacent narrow column.

  // Title shown in row 1 of every sheet.
  _baseTitle(sheetName, monthKey) {
    const barName = (App.data?.settings?.bar_name) || 'Bar Cop';
    return barName + ': ' + sheetName + ', ' + this._monthLabel(monthKey);
  },

  // The disclaimer is split into 3 short lines so each fits in a merged-row
  // cell without depending on wrap-text style (community SheetJS does not
  // write style). Each line is pushed as its own row and merged across.
  _disclaimerLines() {
    return [
      'Generated from your input data on ' + new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) + '.',
      'Bar Cop is a software tool, not a tax preparer, accountant, or CPA.',
      'Your accountant should review and verify before filing or closing your books.'
    ];
  },

  // Push a standard footer: blank row, source note (one line, merged across
  // the full column range), then the 3 disclaimer lines (each merged).
  // colCount is the total number of columns in the sheet.
  _pushFooter(rows, merges, sourceText, colCount) {
    rows.push(this._blankRow(colCount));
    if (sourceText) {
      rows.push(this._lineRow(sourceText, colCount));
      merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: colCount - 1 } });
    }
    this._disclaimerLines().forEach(line => {
      rows.push(this._lineRow(line, colCount));
      merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: colCount - 1 } });
    });
  },

  // Make a blank row with the right column count.
  _blankRow(colCount) {
    const r = [];
    for (let i = 0; i < colCount; i++) r.push('');
    return r;
  },

  // Make a row whose first cell holds text and the rest are blank (so a
  // full-row merge displays the text cleanly).
  _lineRow(text, colCount) {
    const r = [text];
    for (let i = 1; i < colCount; i++) r.push('');
    return r;
  },

  // Apply all the standard finishing to a worksheet: title row merge + row
  // height, column widths, the rest of the merges, and number formats.
  _finishSheet(ws, rowsLength, mergesIn, colWidths) {
    ws['!cols']   = colWidths;
    ws['!merges'] = mergesIn;
    const rowHeights = [];
    rowHeights[0] = { hpt: 22 }; // taller title row for visual weight
    ws['!rows'] = rowHeights;
    return ws;
  },

  // ── Sheet 2 — Inventory Valuation Report ─────────────────────────────────
  // Snapshot of inventory value at period end (or as close to it as the
  // operator's most recent count gets us), broken down bottle-by-bottle,
  // subtotaled by category and storage location. Includes the Schedule C
  // COGS math (beginning + purchases - ending = COGS for the period) when
  // both a prior-period count and the current count are present, plus
  // purchases summed from receive-delivery records.
  _buildInventoryValuation(monthKey) {
    const COL_COUNT = 5;
    const COL_WIDTHS = [{ wch: 50 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];

    const periodEnd = this._monthEndDate(monthKey);
    const periodStart = this._monthStartDate(monthKey);
    const counts = (App.inventoryData?.ic_counts || [])
      .slice()
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    const endingCount    = counts.filter(c => c.date && c.date <= periodEnd).slice(-1)[0] || null;
    const beginningCount = counts.filter(c => c.date && c.date <  periodStart).slice(-1)[0] || null;

    const inMonth = (d) => d && String(d).slice(0, 7) === monthKey;
    const purchases = (App.inventoryData?.ic_deliveries || [])
      .filter(d => inMonth(d.date))
      .reduce((s, d) => s + (parseFloat(d.total) || 0), 0);

    const blank = () => this._blankRow(COL_COUNT);
    const rows = [];
    const merges = [];

    // Row 1: Title (merged across)
    rows.push(this._lineRow(this._baseTitle('Inventory Valuation', monthKey), COL_COUNT));
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: COL_COUNT - 1 } });
    rows.push(blank());

    if (!endingCount) {
      rows.push(this._lineRow('No inventory count on file for this period.', COL_COUNT));
      merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: COL_COUNT - 1 } });
      rows.push(this._lineRow('Take a count in Inventory Control before closing the month so this sheet can value your inventory.', COL_COUNT));
      merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: COL_COUNT - 1 } });
      this._pushFooter(rows, merges, null, COL_COUNT);
      const wsEmpty = XLSX.utils.aoa_to_sheet(rows);
      return this._finishSheet(wsEmpty, rows.length, merges, COL_WIDTHS);
    }

    // Schedule C COGS math
    const beginValue  = beginningCount ? (parseFloat(beginningCount.total_value) || 0) : null;
    const endingValue = parseFloat(endingCount.total_value) || 0;
    const calcCogs    = (beginValue != null) ? (beginValue + purchases - endingValue) : null;

    rows.push(['Schedule C COGS Math (for the accountant)', '', '', '', '']);
    rows.push(['  Beginning Inventory (count dated ' + (beginningCount?.date || 'none on file') + ')', beginValue, '', '', '']);
    rows.push(['  Plus Purchases (from receive-delivery log this month)', purchases, '', '', '']);
    rows.push(['  Less Ending Inventory (count dated ' + endingCount.date + ')', endingValue != null ? -endingValue : null, '', '', '']);
    rows.push(['  Cost of Goods Sold (calculated)', calcCogs, '', '', '']);
    rows.push(blank());

    // Subtotal by category
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

    // Bottle-level detail
    rows.push(['Bottle Detail', '', '', '', '']);
    rows.push(['Product', 'Category', 'Units', 'Unit Cost', 'Extended Value']);
    items.slice().sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''))
      .forEach(it => {
        rows.push([it.name || '', it.category || '', parseFloat(it.total) || 0, parseFloat(it.unit_cost) || 0, parseFloat(it.value) || 0]);
      });

    // Source + disclaimer footer
    this._pushFooter(rows, merges,
      'Source: Inventory Control count dated ' + endingCount.date + ' (type: ' + (endingCount.type || 'Full') + ', counted by ' + (endingCount.counted_by || 'unrecorded') + ').',
      COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    const qtyFmt   = '#,##0.00';
    rows.forEach((row, i) => {
      const apply = (addr, fmt) => { const cell = ws[addr]; if (cell && typeof cell.v === 'number') cell.z = fmt; };
      apply(XLSX.utils.encode_cell({ r: i, c: 1 }), /Units$/.test(String(row[1])) ? qtyFmt : moneyFmt);
      apply(XLSX.utils.encode_cell({ r: i, c: 2 }), /Units$/.test(String(row[1])) ? qtyFmt : moneyFmt);
      apply(XLSX.utils.encode_cell({ r: i, c: 3 }), moneyFmt);
      apply(XLSX.utils.encode_cell({ r: i, c: 4 }), moneyFmt);
    });
    return this._finishSheet(ws, rows.length, merges, COL_WIDTHS);
  },

  // ── Sheet 3 — Cash Reconciliation Audit Trail ─────────────────────────────
  // Per-shift table joining sc_shifts (total revenue) with sc_variances
  // (expected vs counted cash + reason). This is the documentation the IRS
  // looks for in a cash-heavy business audit. Monthly totals at the bottom.
  _buildCashReconciliation(monthKey) {
    const COL_COUNT = 9;
    const COL_WIDTHS = [{ wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 40 }];

    const inMonth = (d) => d && String(d).slice(0, 7) === monthKey;
    const shifts    = (App.shiftData?.sc_shifts    || []).filter(s => inMonth(s.date));
    const variances = (App.shiftData?.sc_variances || []).filter(v => inMonth(v.date));

    const vKey = (date, type) => (date || '') + '|' + (type || '');
    const vIndex = {};
    variances.forEach(v => {
      const k = vKey(v.date, v.shift_type);
      if (!vIndex[k]) vIndex[k] = [];
      vIndex[k].push(v);
    });

    const blank = () => this._blankRow(COL_COUNT);
    const rows = [];
    const merges = [];

    // Row 1: Title merged across all 9 columns so the bar name never gets clipped
    rows.push(this._lineRow(this._baseTitle('Cash Reconciliation', monthKey), COL_COUNT));
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: COL_COUNT - 1 } });
    rows.push(blank());

    rows.push(['Date', 'Shift', 'Manager', 'Total Revenue', 'Expected Cash', 'Counted Cash', 'Variance', 'Status', 'Reason']);

    let totalRev = 0, totalExp = 0, totalCnt = 0, totalVar = 0;
    const sortedShifts = shifts.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (sortedShifts.length === 0 && variances.length === 0) {
      rows.push(this._lineRow('(no shifts or cash variances logged this month)', COL_COUNT));
      merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: COL_COUNT - 1 } });
    } else {
      sortedShifts.forEach(s => {
        const k = vKey(s.date, s.shift_type);
        const v = (vIndex[k] || [])[0] || null;
        const rev = parseFloat(s.total_revenue) || 0;
        const exp = v ? (parseFloat(v.expected_cash) || 0) : null;
        const cnt = v ? (parseFloat(v.counted_cash)  || 0) : null;
        const varc = v ? (parseFloat(v.variance) || (cnt - exp)) : null;
        rows.push([s.date || '', s.shift_type || '', s.manager || '', rev, exp, cnt, varc, v ? (v.status || '') : '', v ? (v.reason || '') : '']);
        totalRev += rev;
        if (exp  != null) totalExp += exp;
        if (cnt  != null) totalCnt += cnt;
        if (varc != null) totalVar += varc;
      });

      // Orphan variances (no matching shift)
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

    this._pushFooter(rows, merges,
      'Source: Shift Control. Variance equals counted cash minus expected cash. Status comes from your tolerance setting in App Settings.',
      COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    rows.forEach((row, i) => {
      [3, 4, 5, 6].forEach(c => {
        const addr = XLSX.utils.encode_cell({ r: i, c });
        const cell = ws[addr];
        if (cell && typeof cell.v === 'number') cell.z = moneyFmt;
      });
    });
    return this._finishSheet(ws, rows.length, merges, COL_WIDTHS);
  },

  // ── Sheet 4 — Void & Comp Compliance Log ──────────────────────────────────
  // Every void and comp in the month with full audit context: who, when,
  // what, how much, why, who authorized. Subtotals by type, by manager, by
  // reason. Required for sales-tax reconciliation in most states and for
  // internal-controls documentation during an audit.
  _buildVoidCompLog(monthKey) {
    const COL_COUNT = 9;
    const COL_WIDTHS = [{ wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 12 }, { wch: 32 }];

    const inMonth = (d) => d && String(d).slice(0, 7) === monthKey;
    const records = (App.shiftData?.sc_void_comps || [])
      .filter(r => inMonth(r.date))
      .slice()
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.created_at || '').localeCompare(b.created_at || ''));

    const blank = () => this._blankRow(COL_COUNT);
    const rows = [];
    const merges = [];

    rows.push(this._lineRow(this._baseTitle('Void and Comp Log', monthKey), COL_COUNT));
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: COL_COUNT - 1 } });
    rows.push(blank());

    rows.push(['Date', 'Type', 'Shift', 'Item', 'Amount', 'Server', 'Authorized By', 'Check #', 'Reason']);

    let totalVoids = 0, totalComps = 0;
    const byMgr = {}, byReason = {};

    if (records.length === 0) {
      rows.push(this._lineRow('(no voids or comps recorded this month)', COL_COUNT));
      merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: COL_COUNT - 1 } });
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
    rows.push(['  Total Voids',  '', '', '', totalVoids, '', '', '', '']);
    rows.push(['  Total Comps',  '', '', '', totalComps, '', '', '', '']);
    rows.push(['  Combined',     '', '', '', totalVoids + totalComps, '', '', '', '']);

    if (Object.keys(byMgr).length) {
      rows.push(blank());
      rows.push(['Subtotal by Authorizer', 'Amount', '', '', '', '', '', '', '']);
      Object.keys(byMgr).sort().forEach(mgr => {
        rows.push(['  ' + mgr, byMgr[mgr], '', '', '', '', '', '', '']);
      });
    }

    if (Object.keys(byReason).length) {
      rows.push(blank());
      rows.push(['Subtotal by Reason', 'Amount', '', '', '', '', '', '', '']);
      Object.keys(byReason).sort().forEach(rea => {
        rows.push(['  ' + rea, byReason[rea], '', '', '', '', '', '', '']);
      });
    }

    this._pushFooter(rows, merges,
      'Source: Shift Control void and comp log. Used for sales tax reconciliation and internal controls documentation.',
      COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    rows.forEach((row, i) => {
      [1, 4].forEach(c => {
        const addr = XLSX.utils.encode_cell({ r: i, c });
        const cell = ws[addr];
        if (cell && typeof cell.v === 'number') cell.z = moneyFmt;
      });
    });
    return this._finishSheet(ws, rows.length, merges, COL_WIDTHS);
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
    const COL_COUNT = 5;
    const COL_WIDTHS = [{ wch: 60 }, { wch: 18 }, { wch: 42 }, { wch: 16 }, { wch: 22 }];

    const inMonth = (d) => d && String(d).slice(0, 7) === monthKey;
    const tips   = (App.laborData?.lc_tips   || []).filter(t => inMonth(t.date));
    const shifts = (App.shiftData?.sc_shifts || []).filter(s => inMonth(s.date));

    const grossReceipts = shifts.reduce((s, sh) => s + (parseFloat(sh.total_revenue) || 0), 0);
    const totalChargedTips = tips.reduce((s, t) => s + (parseFloat(t.card_tips) || 0), 0);
    const totalCashTips    = tips.reduce((s, t) => s + (parseFloat(t.cash_tips) || 0), 0);
    const totalReported    = tips.reduce((s, t) => s + (parseFloat(t.total_tips) || (parseFloat(t.cash_tips) || 0) + (parseFloat(t.card_tips) || 0)), 0);
    const line7  = grossReceipts * 0.08;
    const line7a = Math.max(0, line7 - totalReported);

    const blank = () => this._blankRow(COL_COUNT);
    const rows = [];
    const merges = [];
    const mergeFull = (rowIdx) => merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: COL_COUNT - 1 } });

    // Title (merged)
    rows.push(this._lineRow(this._baseTitle('Tip Allocation Worksheet (IRS Form 8027)', monthKey), COL_COUNT));
    mergeFull(0);
    rows.push(blank());

    // Banner rows (merged across full width so the long sentences are not clipped)
    rows.push(this._lineRow('This is a worksheet. It is not the IRS form. Your accountant moves these numbers onto the actual Form 8027 and signs it.', COL_COUNT));
    mergeFull(rows.length - 1);
    rows.push(this._lineRow('Form 8027 is required for restaurants with more than 10 employees on a typical business day where tipping happens. Some operators do not have to file. Confirm with your accountant.', COL_COUNT));
    mergeFull(rows.length - 1);
    rows.push(blank());

    rows.push(['Form 8027 Lines (figured for the month)', '', '', '', '']);
    rows.push(['  Line 1: Total charged tips for the month',                     totalChargedTips, '', '', '']);
    rows.push(['  Line 2: Total charge receipts on which charged tips were shown', null,           '(your accountant fills. Bar Cop does not track this separately.)', '', '']);
    rows.push(['  Line 3: Total service charges less than 10% paid as wages',     null,           '(your accountant fills if it applies.)', '', '']);
    rows.push(['  Line 4a: Tips reported by indirectly tipped employees',         null,           '(your accountant sorts this. Bar Cop logs total tips per server.)', '', '']);
    rows.push(['  Line 4b: Tips reported by directly tipped employees',           null,           '(your accountant sorts this. Bar Cop logs total tips per server.)', '', '']);
    rows.push(['  Line 5: Total tips reported (4a plus 4b)',                      totalReported, '', '', '']);
    rows.push(['  Line 6: Gross receipts from food and beverage',                 grossReceipts, '', '', '']);
    rows.push(['  Line 7: 8% of gross receipts (or your approved lower rate)',    line7,         '', '', '']);
    rows.push(['  Line 7a: Allocated tips (Line 7 minus Line 5, never below zero)', line7a,      '', '', '']);
    rows.push(blank());

    rows.push(['Reference Totals', '', '', '', '']);
    rows.push(['  Total Cash Tips logged',  totalCashTips,    '', '', '']);
    rows.push(['  Total Card Tips logged',  totalChargedTips, '', '', '']);
    rows.push(['  Combined Tips logged',    totalReported,    '', '', '']);
    rows.push(blank());

    // Per-employee, per-shift detail
    rows.push(['Per-Employee Tip Detail', '', '', '', '']);
    rows.push(['Date', 'Employee', 'Shift', 'Hours', 'Total Tips']);
    const sortedTips = tips.slice().sort((a, b) =>
      (a.date || '').localeCompare(b.date || '') || (a.name || '').localeCompare(b.name || '')
    );
    if (sortedTips.length === 0) {
      rows.push(this._lineRow('(no tips logged this month)', COL_COUNT));
      mergeFull(rows.length - 1);
    } else {
      sortedTips.forEach(t => {
        const total = parseFloat(t.total_tips) || ((parseFloat(t.cash_tips) || 0) + (parseFloat(t.card_tips) || 0));
        rows.push([t.date || '', t.name || '', t.shift_type || '', parseFloat(t.hours) || null, total]);
      });
    }

    // Per-employee monthly totals + suggested allocation
    const byEmp = {};
    sortedTips.forEach(t => {
      const name = t.name || '(unnamed)';
      if (!byEmp[name]) byEmp[name] = { tips: 0, hours: 0 };
      byEmp[name].tips  += parseFloat(t.total_tips) || ((parseFloat(t.cash_tips) || 0) + (parseFloat(t.card_tips) || 0));
      byEmp[name].hours += parseFloat(t.hours) || 0;
    });
    const allocStartIdx = rows.length;
    if (Object.keys(byEmp).length) {
      rows.push(blank());
      rows.push(['Per-Employee Monthly Totals', '', '', '', '']);
      rows.push(['Employee', 'Hours', 'Tips Reported', 'Share of Hours', 'Suggested Allocation (Line 7a x share)']);
      const totalHours = Object.values(byEmp).reduce((s, e) => s + e.hours, 0);
      Object.keys(byEmp).sort().forEach(name => {
        const e = byEmp[name];
        const share = totalHours > 0 ? (e.hours / totalHours) : 0;
        const suggested = line7a * share;
        rows.push([name, e.hours, e.tips, share, suggested]);
      });
    }

    this._pushFooter(rows, merges,
      'Source: Labor Control tip log (per-shift tip entries) and Shift Control shifts (gross receipts).',
      COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    const pctFmt   = '0.0%';
    rows.forEach((row, i) => {
      // Line value column (col 1) is money on Form 8027 line rows
      const c1 = XLSX.utils.encode_cell({ r: i, c: 1 });
      if (ws[c1] && typeof ws[c1].v === 'number') ws[c1].z = moneyFmt;
      // For per-employee allocation rows (col 3 = share <= 1, col 4 = money)
      if (i > allocStartIdx && typeof row[3] === 'number' && row[3] >= 0 && row[3] <= 1 && typeof row[4] === 'number') {
        const c3 = XLSX.utils.encode_cell({ r: i, c: 3 });
        const c4 = XLSX.utils.encode_cell({ r: i, c: 4 });
        if (ws[c3]) ws[c3].z = pctFmt;
        if (ws[c4]) ws[c4].z = moneyFmt;
      } else {
        // Per-employee detail rows (col 4 = total tips)
        const c4 = XLSX.utils.encode_cell({ r: i, c: 4 });
        if (ws[c4] && typeof ws[c4].v === 'number') ws[c4].z = moneyFmt;
      }
    });
    return this._finishSheet(ws, rows.length, merges, COL_WIDTHS);
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
