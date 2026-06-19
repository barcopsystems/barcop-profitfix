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
  // Full-page Hub screen. Sidebar stays mounted, content area swaps, topbar
  // shows "MONTH-END BOOKS | Back to Dashboard". Action buttons live next to
  // the Close Month dropdown inside the picker card.
  open() {
    if (App.stampFixView) App.stampFixView('books');
    App.openHubFullPage('Month-End Books', (mount) => this._render(mount), 'books');
  },

  // ── Render the picker screen ───────────────────────────────────────────────
  _render(mount) {
    const months = this._availableMonths();
    const defaultMonth = months[0] || this._currentMonthKey();
    const monthOpts = months.map(m =>
      '<option value="' + m + '"' + (m === defaultMonth ? ' selected' : '') + '>' + this._monthLabel(m) + '</option>'
    ).join('');

    mount.innerHTML =
      '<div class="screen">'
      + '<div class="card form-card">'
        + '<div class="card-title">Month-End Books</div>'
        + '<div class="form-row" style="gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:0;">'
          + '<div class="f" style="width:300px;"><label>Close Month</label><select id="hb-month">' + monthOpts + '</select></div>'
        + '</div>'
        + '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-top:18px;">'
          + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
          + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">Bar Cop assembles these numbers from what you log. It is a software tool, not a CPA, tax preparer, or legal advisor. This is a worksheet, not your official financial statement. Your accountant should review and verify every figure before you file anything or close the books.</div>'
        + '</div>'
      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
        + '<button class="btn btn-primary" id="hb-generate">Generate File</button>'
        + '<button class="btn btn-ghost" id="hb-pdf">Owner Summary (PDF)</button>'
        + '<span id="hb-status" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-left:6px;display:none;"></span>'
      + '</div>'
      + this._whatsInsideCard()
      + '</div>';

    if (App.setHubTopbarActions) App.setHubTopbarActions('');

    document.getElementById('hb-generate')?.addEventListener('click', () => this._generate());
    document.getElementById('hb-pdf')?.addEventListener('click', () => this._openPdfSummary());
  },

  // ── PDF executive summary — owner-readable, 1-page snapshot ──────────────
  // Builds a clean, data-driven PDF via the shared App._pdfBuilder so it
  // matches every other Bar Cop deliverable (no browser print dialog). Built
  // from the same data as the XLSX so the numbers always agree.
  async _openPdfSummary() {
    const monthKey = document.getElementById('hb-month')?.value;
    if (!monthKey) return;
    if (!(await this._ackExport())) return;
    const monthLabel = this._monthLabel(monthKey);
    const M   = this._aggregateMonth(monthKey);
    const YTD = this._aggregateYTD(monthKey);

    // Prior month for the "vs last month" line
    const prevKey = this._priorMonthKey(monthKey);
    const PREV    = prevKey ? this._aggregateMonth(prevKey) : null;

    const fmt$ = (v) => (v == null || isNaN(v)) ? '-' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtPct = (v) => (v == null || isNaN(v)) ? '-' : (v * 100).toFixed(1) + '%';

    // Latest audits for the recommendations section
    const monthEnd = this._monthEndDate(monthKey);
    const latestBefore = (list) => {
      if (!Array.isArray(list)) return null;
      return list.filter(a => a && a.date && String(a.date).slice(0, 10) <= monthEnd)
        .slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        .slice(-1)[0] || null;
    };
    const audits = [
      { label: 'Profit',  audit: latestBefore(App.data?.audits) },
      { label: 'Revenue', audit: latestBefore(App.data?.revenue_audits) },
      { label: 'Traffic', audit: latestBefore(App.data?.traffic_audits) }
    ];
    const totalMonthlyOpp = audits.reduce((s, a) => {
      const items = a.audit?.action_items || [];
      return s + items.reduce((ss, i) => ss + (parseFloat(i.monthly_impact) || 0), 0);
    }, 0);

    // Top 5 action items across all systems by monthly impact
    const allItems = [];
    audits.forEach(({ label, audit }) => {
      (audit?.action_items || []).forEach(it => {
        allItems.push({
          system: label,
          title: it.title || it.name || it.action || '(unnamed)',
          monthly: parseFloat(it.monthly_impact) || 0
        });
      });
    });
    allItems.sort((a, b) => b.monthly - a.monthly);
    const topFive = allItems.slice(0, 5);

    // Counts of compliance/operational events
    const inMonth = (d) => d && String(d).slice(0, 7) === monthKey;
    const voidComps = (App.shiftData?.sc_void_comps || []).filter(r => inMonth(r.date));
    const variances = (App.shiftData?.sc_variances  || []).filter(r => inMonth(r.date));
    const callouts  = (App.laborData?.lc_callouts   || []).filter(r => inMonth(r.date));
    const tips      = (App.laborData?.lc_tips       || []).filter(r => inMonth(r.date));
    const totalTips = tips.reduce((s, t) => s + (parseFloat(t.total_tips) || (parseFloat(t.cash_tips) || 0) + (parseFloat(t.card_tips) || 0)), 0);

    // Cost ratios for the month
    const pourCost = M.barRev  ? (M.barCogs  / M.barRev)  : null;
    const foodCost = M.foodRev ? (M.foodCogs / M.foodRev) : null;
    const laborPct = M.totalRev ? (M.totalLabor / M.totalRev) : null;
    const primeCost = M.totalRev ? ((M.totalCogs + M.totalLabor) / M.totalRev) : null;
    const prevPour  = PREV && PREV.barRev  ? (PREV.barCogs  / PREV.barRev)  : null;
    const prevFood  = PREV && PREV.foodRev ? (PREV.foodCogs / PREV.foodRev) : null;
    const prevLabor = PREV && PREV.totalRev ? (PREV.totalLabor / PREV.totalRev) : null;
    const prevPrime = PREV && PREV.totalRev ? ((PREV.totalCogs + PREV.totalLabor) / PREV.totalRev) : null;

    try { await App._ensurePDFLib(); }
    catch (e) { this._setStatus('Could not load the PDF engine. Check your connection and try again.', 'var(--red)'); return; }

    const b = App._pdfBuilder('Books Summary');
    b.header({ right: 'Books Summary', meta: monthLabel });

    b.sectionTitle('The Month in Dollars');
    b.table(null, [
      ['Total Revenue (net of comps)', fmt$(M.totalRev - (M.compsLoss || 0))],
      ['  Bar Revenue', fmt$(M.barRev)],
      ['  Food Revenue', fmt$(M.foodRev)],
      ['Cost of Goods Sold', fmt$(M.totalCogs)],
      ['Labor', fmt$(M.totalLabor)],
      ['Prime Cost (COGS + Labor)', fmt$(M.totalCogs + M.totalLabor)]
    ], { columnStyles: { 1: { halign: 'right' } } });

    b.sectionTitle('The Month in Percentages');
    b.table(null, [
      ['Pour Cost', fmtPct(pourCost), this._pctDeltaLabel(pourCost, prevPour, prevKey, true)],
      ['Food Cost', fmtPct(foodCost), this._pctDeltaLabel(foodCost, prevFood, prevKey, true)],
      ['Labor %', fmtPct(laborPct), this._pctDeltaLabel(laborPct, prevLabor, prevKey, true)],
      ['Prime Cost %', fmtPct(primeCost), this._pctDeltaLabel(primeCost, prevPrime, prevKey, true)]
    ], { columnStyles: { 1: { halign: 'right' } } });

    b.sectionTitle('Year to Date');
    b.table(null, [
      ['Revenue (net of comps)', fmt$(YTD.totalRev - (YTD.compsLoss || 0))],
      ['COGS', fmt$(YTD.totalCogs)],
      ['Labor', fmt$(YTD.totalLabor)],
      ['Prime Cost', fmt$(YTD.totalCogs + YTD.totalLabor)]
    ], { columnStyles: { 1: { halign: 'right' } } });

    b.sectionTitle('Operational Events This Month');
    b.table(null, [
      ['Voids and Comps Logged', String(voidComps.length)],
      ['Cash Variances Logged', String(variances.length)],
      ['Tips Logged (total)', fmt$(totalTips)],
      ['Call-Outs Logged', String(callouts.length)]
    ], { columnStyles: { 1: { halign: 'right' } } });

    b.sectionTitle('Top Opportunities From Your Audits');
    if (topFive.length === 0) {
      b.paragraph('No open audit action items on file. Run a Profit, Revenue, or Traffic audit to surface opportunities.', { gray: 100 });
    } else {
      b.paragraph('Total monthly opportunity across all systems: ' + fmt$(totalMonthlyOpp)
        + '. Annualized: ' + fmt$(totalMonthlyOpp * 12) + '.');
      b.table(null, topFive.map(it => [it.system + ': ' + it.title, fmt$(it.monthly) + '/mo']),
        { columnStyles: { 1: { halign: 'right' } } });
    }

    b.disclaimer(App.deliverableFooter().workbookSubject);

    const period = String(monthKey).replace('-', '') || App._pdfDateStamp();
    await b.save('BarCop_MonthEndBooks_Worksheet_' + period + '.pdf');
  },

  // Helper for the PDF summary: format a "(% vs prior month)" label.
  // lowerBetter inverts the sign coloring assumption but here we just produce
  // text. Color is handled inline in the HTML.
  _pctDeltaLabel(current, previous, prevKey, lowerBetter) {
    if (current == null || previous == null || !prevKey) return '';
    const diff = current - previous;
    if (diff === 0) return 'flat vs ' + this._monthLabel(prevKey);
    const sign = diff >= 0 ? '+' : '';
    return sign + (diff * 100).toFixed(1) + ' pts vs ' + this._monthLabel(prevKey);
  },

  // Prior month key (returns YYYY-MM or null if would go before year 0).
  _priorMonthKey(monthKey) {
    const y = parseInt(monthKey.slice(0, 4), 10);
    const m = parseInt(monthKey.slice(5, 7), 10);
    let py = y, pm = m - 1;
    if (pm < 1) { pm = 12; py = y - 1; }
    if (py < 1900) return null;
    return py + '-' + String(pm).padStart(2, '0');
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
    return '<div class="card form-card">'
      + '<div class="card-title">What\'s In the File</div>'
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

  // Export-acknowledgment gate (once per visit) before a high-stakes Books
  // download. See [[legal-protection]].
  async _ackExport() {
    if (this._booksAckGiven) return true;
    const ok = await App.confirmExport({
      title: 'Before You Export Your Books',
      message: 'Month-End Books is built from the numbers you have logged in Bar Cop. It is a worksheet, not a filed financial statement. Your accountant should review and verify it before you file anything or close your books.',
      confirmText: 'I Understand, Continue',
      cancelText: 'Cancel'
    });
    if (ok) this._booksAckGiven = true;
    return ok;
  },

  // ── Generate the workbook ──────────────────────────────────────────────────
  async _generate() {
    const monthKey = document.getElementById('hb-month')?.value;
    if (!monthKey) return;
    if (!(await this._ackExport())) return;
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
      XLSX.utils.book_append_sheet(wb, this._buildVarianceShrinkage(monthKey),  'Variance and Shrinkage');
      XLSX.utils.book_append_sheet(wb, this._buildLaborCostAnalysis(monthKey),  'Labor Cost Analysis');
      XLSX.utils.book_append_sheet(wb, this._buildOperationalOpportunities(monthKey), 'Operational Opportunities');
      // Year-End Tax Helper appears only for December close (annual roll).
      if (monthKey.slice(5, 7) === '12') {
        XLSX.utils.book_append_sheet(wb, this._buildYearEndTaxHelper(monthKey), 'Year-End Tax Helper');
      }

      // Workbook properties so the disclaimer is visible in Excel's File >
      // Properties pane too, not only in the sheet footers.
      const barName = (App.data?.settings?.bar_name) || 'Bar Cop';
      wb.Props = {
        Title:        barName + ' - Books, ' + this._monthLabel(monthKey),
        Subject:      App.deliverableFooter().workbookSubject,
        Author:       barName,
        Company:      'Bar Cop',
        CreatedDate:  new Date()
      };

      const filename = barName + ' - Month-End Books Worksheet - ' + this._monthLabel(monthKey) + '.xlsx';
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
    rows.push(r('  Bar Revenue',      M.barRev,      YTD.barRev));
    rows.push(r('  Food Revenue',     M.foodRev,     YTD.foodRev));
    rows.push(r('  Catering Revenue', M.cateringRev, YTD.cateringRev));
    rows.push(r('  Other / Ancillary Revenue', M.otherRev, YTD.otherRev));
    rows.push(r('  Less: Comps',  M.compsLoss != null ? -Math.abs(M.compsLoss) : null, YTD.compsLoss != null ? -Math.abs(YTD.compsLoss) : null));
    rows.push(r('Total Revenue (net of comps)', M.totalRev - (M.compsLoss || 0), YTD.totalRev - (YTD.compsLoss || 0)));
    rows.push(blank());

    // COGS
    rows.push(['Cost of Goods Sold', '', '']);
    rows.push(r('  Bar COGS',      M.barCogs,      YTD.barCogs));
    rows.push(r('  Food COGS',     M.foodCogs,     YTD.foodCogs));
    rows.push(r('  Catering COGS', M.cateringCogs, YTD.cateringCogs));
    rows.push(r('  Other COGS',    M.otherCogs,    YTD.otherCogs));
    rows.push(r('Total COGS', M.totalCogs, YTD.totalCogs));
    rows.push(blank());

    rows.push(r('Gross Profit', M.totalRev - M.totalCogs - (M.compsLoss || 0), YTD.totalRev - YTD.totalCogs - (YTD.compsLoss || 0)));
    rows.push(blank());

    // Labor
    rows.push(['Labor', '', '']);
    rows.push(r('  Bar Labor',      M.barLabor,      YTD.barLabor));
    rows.push(r('  Food Labor',     M.foodLabor,     YTD.foodLabor));
    rows.push(r('  Catering Labor', M.cateringLabor, YTD.cateringLabor));
    rows.push(r('Total Labor', M.totalLabor, YTD.totalLabor));
    rows.push(blank());

    rows.push(r('Prime Cost (COGS + Labor)', M.totalCogs + M.totalLabor, YTD.totalCogs + YTD.totalLabor));
    rows.push(blank());

    // Operating Expenses (from the Operating Expenses log + sc_maintenance +
    // weekly platform fees). Operator logs each bill in Operating Expenses;
    // Books rolls it up by category. Maintenance and platform fees come from
    // their own canonical stores to avoid double-counting.
    const opexM = this._opExSums(monthKey, false);
    const opexY = this._opExSums(monthKey, true);
    const totalOpExM = Object.values(opexM).reduce((s, v) => s + (v || 0), 0)
                      + (M.maintenance || 0) + (M.platformFees || 0) + (M.compsPolicy || 0);
    const totalOpExY = Object.values(opexY).reduce((s, v) => s + (v || 0), 0)
                      + (YTD.maintenance || 0) + (YTD.platformFees || 0) + (YTD.compsPolicy || 0);
    const operatingIncomeM = (M.totalRev - (M.compsLoss || 0)) - M.totalCogs - M.totalLabor - totalOpExM;
    const operatingIncomeY = (YTD.totalRev - (YTD.compsLoss || 0)) - YTD.totalCogs - YTD.totalLabor - totalOpExY;

    rows.push(['Operating Expenses', '', '']);
    rows.push(r('  Occupancy (rent, property tax)',                 opexM['Occupancy (Rent, Property Tax)']    || 0, opexY['Occupancy (Rent, Property Tax)']    || 0));
    rows.push(r('  Utilities',                                      opexM['Utilities']                         || 0, opexY['Utilities']                         || 0));
    rows.push(r('  Insurance',                                      opexM['Insurance']                         || 0, opexY['Insurance']                         || 0));
    rows.push(r('  Marketing and advertising',                      opexM['Marketing and Advertising']         || 0, opexY['Marketing and Advertising']         || 0));
    rows.push(r('  Repairs and maintenance',                        M.maintenance,                                  YTD.maintenance));
    rows.push(r('  3rd-party platform fees (DoorDash, UberEats, etc.)', M.platformFees,                              YTD.platformFees));
    rows.push(r('  Staff meals and shift drinks',                   M.compsPolicy,                                  YTD.compsPolicy));
    rows.push(r('  Professional fees',                              opexM['Professional Fees']                 || 0, opexY['Professional Fees']                 || 0));
    rows.push(r('  Bank and credit card fees',                      opexM['Bank and Credit Card Fees']         || 0, opexY['Bank and Credit Card Fees']         || 0));
    rows.push(r('  Licenses and permits',                           opexM['Licenses and Permits']              || 0, opexY['Licenses and Permits']              || 0));
    rows.push(r('  Software and subscriptions',                     opexM['Software and Subscriptions']        || 0, opexY['Software and Subscriptions']        || 0));
    rows.push(r('  Other operating expenses',                       opexM['Other']                             || 0, opexY['Other']                             || 0));
    rows.push(r('Total Operating Expenses', totalOpExM, totalOpExY));
    rows.push(blank());

    rows.push(r('Operating Income (before taxes)', operatingIncomeM, operatingIncomeY));
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
    rows.push(this._lineRow('Guest comps reduce revenue; staff meals and shift drinks are booked as an operating expense, both from the Shift Control void and comp log. Maintenance from the maintenance log. Operating expenses from your Operating Expenses log.', COL_COUNT));
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

  // Disclaimer split into 3 short lines so each fits in a merged-row cell
  // without depending on wrap-text style (community SheetJS does not write
  // style). Reads from App.deliverableFooter() so every Bar Cop deliverable
  // (Books, Year-End, Weekly P&L Brief, Traffic Month End Brief, Bar Cop
  // Audit PDF) shares one canonical disclaimer.
  _disclaimerLines() {
    return App.deliverableFooter().disclaimerLines;
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
    rows.push(this._lineRow('Note: this is the count-based Schedule C COGS (beginning + purchases - ending). It will not exactly match the Total COGS on the Income Statement, which is summed from your weekly numbers. The count-based figure here is the more accurate physical cost of goods. Give your accountant both.', COL_COUNT));
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: COL_COUNT - 1 } });
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

    // Class column shows each Comp's loss-vs-expense classification, derived
    // from its reason (Staff Meal and Shift Drink are policy expense; every
    // customer-facing comp is loss). Voids leave it blank.
    rows.push(['Date', 'Type', 'Class', 'Shift', 'Item', 'Amount', 'Server', 'Authorized By', 'Reason']);

    let totalVoids = 0, totalComps = 0;
    const byMgr = {}, byReason = {}, byClass = {};

    if (records.length === 0) {
      rows.push(this._lineRow('(no voids or comps recorded this month)', COL_COUNT));
      merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: COL_COUNT - 1 } });
    } else {
      records.forEach(r => {
        const amt = parseFloat(r.amount) || 0;
        const type = (r.type || '').toLowerCase();
        const cls = type === 'comp' ? (App.compReasonIsLoss(r.reason || r.category) ? 'Loss' : 'Expense') : '';
        rows.push([r.date || '', r.type || '', cls, r.shift_type || '', r.item || '', amt, r.server || '', r.authorized_by || '', r.reason || '']);
        if (type === 'void') totalVoids += amt;
        else if (type === 'comp') totalComps += amt;
        const mgr = r.authorized_by || '(none recorded)';
        byMgr[mgr] = (byMgr[mgr] || 0) + amt;
        const rea = r.reason || '(none recorded)';
        byReason[rea] = (byReason[rea] || 0) + amt;
        if (cls) byClass[cls] = (byClass[cls] || 0) + amt;
      });
    }

    rows.push(blank());
    rows.push(['Monthly Totals by Type', '', '', '', '', '', '', '', '']);
    rows.push(['  Total Voids',  '', '', '', '', totalVoids, '', '', '']);
    rows.push(['  Total Comps',  '', '', '', '', totalComps, '', '', '']);
    rows.push(['  Combined',     '', '', '', '', totalVoids + totalComps, '', '', '']);

    if (Object.keys(byClass).length) {
      rows.push(blank());
      rows.push(['Subtotal by Comp Class (loss vs policy expense)', '', '', '', '', 'Amount', '', '', '']);
      Object.keys(byClass).sort().forEach(cls => {
        rows.push(['  ' + cls, '', '', '', '', byClass[cls], '', '', '']);
      });
    }

    if (Object.keys(byMgr).length) {
      rows.push(blank());
      rows.push(['Subtotal by Authorizer', '', '', '', '', 'Amount', '', '', '']);
      Object.keys(byMgr).sort().forEach(mgr => {
        rows.push(['  ' + mgr, '', '', '', '', byMgr[mgr], '', '', '']);
      });
    }

    if (Object.keys(byReason).length) {
      rows.push(blank());
      rows.push(['Subtotal by Reason', '', '', '', '', 'Amount', '', '', '']);
      Object.keys(byReason).sort().forEach(rea => {
        rows.push(['  ' + rea, '', '', '', '', byReason[rea], '', '', '']);
      });
    }

    this._pushFooter(rows, merges,
      'Source: Shift Control void and comp log. Used for sales tax reconciliation and internal controls documentation. Staff Meal and Shift Drink reasons are policy expense, not loss.',
      COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    rows.forEach((row, i) => {
      [5].forEach(c => {
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
    const tips   = (App.laborData?.lc_tips       || []).filter(t => inMonth(t.date));
    const pools  = (App.laborData?.lc_tip_pools  || []).filter(p => inMonth(p.date));
    const shifts = (App.shiftData?.sc_shifts     || []).filter(s => inMonth(s.date));

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

    // Per-employee monthly totals + suggested allocation.
    // Source priority per shift:
    //   1. lc_tip_pools (shift's saved pool split) — what each employee actually took home
    //   2. lc_tips (raw tip log) — only when no pool exists for the shift
    // This matches what Form 8027 should reflect: the taxable allocation per
    // employee, not just what came in across the bar.
    const byEmp = {};
    const shiftIdsWithPools = new Set(pools.map(p => p.shift_id).filter(Boolean));

    // Pool-based allocations (preferred)
    pools.forEach(p => {
      (p.participants || []).forEach(pt => {
        const name = pt.name || '(unnamed)';
        if (!byEmp[name]) byEmp[name] = { tips: 0, hours: 0, source: 'pool' };
        byEmp[name].tips  += parseFloat(pt.share) || 0;
        byEmp[name].hours += parseFloat(pt.hours) || 0;
      });
    });

    // Raw tip log — only count entries from shifts that DON'T have a pool
    sortedTips.forEach(t => {
      if (t.shift_id && shiftIdsWithPools.has(t.shift_id)) return; // covered by pool
      const name = t.name || '(unnamed)';
      if (!byEmp[name]) byEmp[name] = { tips: 0, hours: 0, source: 'log' };
      byEmp[name].tips  += App.netTips(t);   // taxable per-employee allocation = net of tip-out
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
      'Source: Labor Control tip pool splits when saved per shift (taxable allocation per employee), tip log entries for shifts without a saved pool, and Shift Control shifts for gross receipts.',
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

  // ── Sheet 6 — Variance and Shrinkage Report ──────────────────────────────
  // Per-product usage over the month, computed from inventory counts and
  // receive-delivery records: usage = startCount + monthDeliveries - endCount.
  // Bottle-level table sorted by extended usage dollars (the biggest movers
  // surface first, which is where shrinkage and overpouring show up).
  // True theft variance also needs POS sales detail, which Bar Cop does not
  // persist between sessions; see Inventory Control's Variance Report screen
  // for the POS-matched version. This sheet is the persistent-data view.
  _buildVarianceShrinkage(monthKey) {
    const COL_COUNT = 6;
    const COL_WIDTHS = [{ wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
    const periodStart = this._monthStartDate(monthKey);
    const periodEnd   = this._monthEndDate(monthKey);

    const counts = (App.inventoryData?.ic_counts || []).slice()
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    const startCount = counts.filter(c => c.date && c.date <  periodStart).slice(-1)[0] || null;
    const endCount   = counts.filter(c => c.date && c.date <= periodEnd).slice(-1)[0] || null;

    const blank = () => this._blankRow(COL_COUNT);
    const rows = [];
    const merges = [];
    const mergeFull = (r) => merges.push({ s: { r, c: 0 }, e: { r, c: COL_COUNT - 1 } });

    rows.push(this._lineRow(this._baseTitle('Variance and Shrinkage Report', monthKey), COL_COUNT));
    mergeFull(0);
    rows.push(blank());

    if (!startCount || !endCount || startCount.id === endCount.id) {
      rows.push(this._lineRow('Two counts on file are needed for a variance period. Bar Cop did not find a count before this month and a count on or before month end.', COL_COUNT));
      mergeFull(rows.length - 1);
      rows.push(this._lineRow('Take an end-of-month count in Inventory Control before closing the books so this report can compute usage.', COL_COUNT));
      mergeFull(rows.length - 1);
      this._pushFooter(rows, merges, null, COL_COUNT);
      const wsEmpty = XLSX.utils.aoa_to_sheet(rows);
      return this._finishSheet(wsEmpty, rows.length, merges, COL_WIDTHS);
    }

    // Build the usage map per product. A product can be counted in several
    // locations, so sum its lines into one entry (keep metadata from the first).
    const sMap = {}; (startCount.items || []).forEach(it => {
      if (sMap[it.product_id]) sMap[it.product_id].total = (sMap[it.product_id].total || 0) + (it.total || 0);
      else sMap[it.product_id] = { ...it };
    });
    const eMap = {}; (endCount.items   || []).forEach(it => {
      if (eMap[it.product_id]) eMap[it.product_id].total = (eMap[it.product_id].total || 0) + (it.total || 0);
      else eMap[it.product_id] = { ...it };
    });

    const purch = {};
    (App.inventoryData?.ic_deliveries || [])
      .filter(d => d.date && d.date > startCount.date && d.date <= endCount.date)
      .forEach(d => (d.line_items || []).forEach(li => {
        purch[li.product_id] = (purch[li.product_id] || 0) + App.unitsFromDeliveryLine(li);
      }));

    const products = (App.inventoryData?.ic_products || []);
    const productById = {};
    products.forEach(p => { productById[p.id] = p; });

    const detail = [];
    Object.keys(eMap).forEach(pid => {
      if (!sMap[pid]) return;
      const p = productById[pid] || {};
      const startQty = parseFloat(sMap[pid].total) || 0;
      const endQty   = parseFloat(eMap[pid].total) || 0;
      const purchQty = purch[pid] || 0;
      const usedQty  = startQty + purchQty - endQty;
      const unitCost = (p.unit_cost != null) ? App.unitCost(p) : App.unitCostFromCountItem(eMap[pid]);
      const usedValue = unitCost != null ? usedQty * unitCost : 0;
      detail.push({
        name: eMap[pid].name || p.name || '(unnamed)',
        category: eMap[pid].category || p.category || '',
        startQty, purchQty, endQty, usedQty, usedValue
      });
    });

    // Sort by used value, biggest first.
    detail.sort((a, b) => b.usedValue - a.usedValue);

    rows.push(['Period: ' + startCount.date + ' through ' + endCount.date, '', '', '', '', '']);
    mergeFull(rows.length - 1);
    rows.push(blank());

    rows.push(['Product', 'Category', 'Start Units', 'Delivered', 'End Units', 'Usage Value']);
    let totalUsage = 0;
    if (detail.length === 0) {
      rows.push(this._lineRow('(no products matched between the two counts)', COL_COUNT));
      mergeFull(rows.length - 1);
    } else {
      detail.forEach(d => {
        rows.push([d.name, d.category, d.startQty, d.purchQty, d.endQty, d.usedValue]);
        totalUsage += d.usedValue;
      });
      rows.push(['Total Period Usage', '', '', '', '', totalUsage]);
    }

    this._pushFooter(rows, merges,
      'Source: Inventory Control counts and receive-delivery records between ' + startCount.date + ' and ' + endCount.date + '. Recipe-based shrinkage detection requires POS sales detail, which is loaded on demand in the Variance Report screen inside Inventory Control.',
      COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    const qtyFmt   = '#,##0.00';
    rows.forEach((row, i) => {
      [2, 3, 4].forEach(c => {
        const addr = XLSX.utils.encode_cell({ r: i, c });
        if (ws[addr] && typeof ws[addr].v === 'number') ws[addr].z = qtyFmt;
      });
      const addrVal = XLSX.utils.encode_cell({ r: i, c: 5 });
      if (ws[addrVal] && typeof ws[addrVal].v === 'number') ws[addrVal].z = moneyFmt;
    });
    return this._finishSheet(ws, rows.length, merges, COL_WIDTHS);
  },

  // ── Sheet 7 — Labor Cost Analysis ─────────────────────────────────────────
  // Two breakdowns from lc_actuals filtered to the month:
  //  (1) By position: total hours, total wages, share of labor
  //  (2) By staff member: total hours, total wages, average wage realized
  // Plus monthly totals, labor percentage of revenue (from sc_shifts), and a
  // call-out count from lc_callouts.
  _buildLaborCostAnalysis(monthKey) {
    const COL_COUNT = 5;
    const COL_WIDTHS = [{ wch: 36 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    const inMonth = (d) => d && String(d).slice(0, 7) === monthKey;
    const actuals  = (App.laborData?.lc_actuals  || []).filter(a => inMonth(a.date));
    const positions = (App.laborData?.lc_positions || []);
    const staff     = (App.laborData?.lc_staff     || []);
    const callouts  = (App.laborData?.lc_callouts  || []).filter(c => inMonth(c.date));
    const shifts    = (App.shiftData?.sc_shifts    || []).filter(s => inMonth(s.date));

    const posName = (id) => (positions.find(p => p.id === id) || {}).name || '(no position)';
    const staffPosId = (sid) => (staff.find(s => s.id === sid) || {}).position_id || '';

    let totalHours = 0, totalWages = 0;
    const byPos = {}, byStaff = {};
    actuals.forEach(a => {
      const hours = parseFloat(a.hours) || 0;
      const cost  = parseFloat(a.cost)  || (hours * (parseFloat(a.wage) || 0));
      totalHours += hours;
      totalWages += cost;
      const pid = a.position_id || staffPosId(a.staff_id);
      const pname = posName(pid);
      if (!byPos[pname]) byPos[pname] = { hours: 0, wages: 0 };
      byPos[pname].hours += hours;
      byPos[pname].wages += cost;
      const sid = a.staff_id || a.name || '(unknown)';
      if (!byStaff[sid]) byStaff[sid] = { name: a.name || '(unknown)', position: pname, hours: 0, wages: 0 };
      byStaff[sid].hours += hours;
      byStaff[sid].wages += cost;
    });

    // Salaried (exempt) management is paid a fixed weekly salary with no
    // lc_actuals rows, so without this Total Wages Paid and Labor % of Revenue
    // understate the real spend and disagree with Payroll and the Revenue
    // dashboards for the same month. Accrued day-for-day across the month.
    const _ms = new Date(monthKey + '-01T00:00:00');
    const monthEnd = App.ymdLocal(new Date(_ms.getFullYear(), _ms.getMonth() + 1, 0));
    const salWeeks = (Math.floor((new Date(monthEnd + 'T00:00:00').getTime() - _ms.getTime()) / 86400000) + 1) / 7;
    staff.forEach(st => {
      const wk = App.staffWeeklySalary(st);
      if (!wk) return;
      const cost = wk * salWeeks;
      const pname = posName(st.position_id);
      totalWages += cost;
      if (!byPos[pname]) byPos[pname] = { hours: 0, wages: 0 };
      byPos[pname].wages += cost;
      if (!byStaff[st.id]) byStaff[st.id] = { name: st.name || '(unknown)', position: pname, hours: 0, wages: 0 };
      byStaff[st.id].wages += cost;
    });

    const totalRev = shifts.reduce((s, sh) => s + (parseFloat(sh.total_revenue) || 0), 0);
    const laborPct = totalRev > 0 ? (totalWages / totalRev) : null;

    const blank = () => this._blankRow(COL_COUNT);
    const rows = [];
    const merges = [];
    const mergeFull = (r) => merges.push({ s: { r, c: 0 }, e: { r, c: COL_COUNT - 1 } });

    rows.push(this._lineRow(this._baseTitle('Labor Cost Analysis', monthKey), COL_COUNT));
    mergeFull(0);
    rows.push(blank());

    rows.push(['Monthly Summary', '', '', '', '']);
    rows.push(['  Total Hours Worked', totalHours, '', '', '']);
    rows.push(['  Total Wages Paid',   totalWages, '', '', '']);
    rows.push(['  Total Revenue',      totalRev,   '', '', '']);
    rows.push(['  Labor as % of Revenue', laborPct, '', '', '']);
    rows.push(['  Call-Outs Logged',   callouts.length, '', '', '']);
    rows.push(blank());

    // By position
    rows.push(['By Position', 'Hours', 'Wages', 'Share of Wages', 'Avg Wage Per Hour']);
    if (Object.keys(byPos).length === 0) {
      rows.push(this._lineRow('(no hours logged this month)', COL_COUNT));
      mergeFull(rows.length - 1);
    } else {
      Object.keys(byPos).sort().forEach(name => {
        const p = byPos[name];
        const share = totalWages > 0 ? (p.wages / totalWages) : 0;
        const avg = p.hours > 0 ? (p.wages / p.hours) : null;
        rows.push(['  ' + name, p.hours, p.wages, share, avg]);
      });
      rows.push(['Total', totalHours, totalWages, 1, totalHours > 0 ? totalWages / totalHours : null]);
    }
    rows.push(blank());

    // By staff
    rows.push(['By Staff Member', 'Position', 'Hours', 'Wages', 'Avg Wage Per Hour']);
    const staffList = Object.values(byStaff).sort((a, b) => b.wages - a.wages);
    if (staffList.length === 0) {
      rows.push(this._lineRow('(no hours logged this month)', COL_COUNT));
      mergeFull(rows.length - 1);
    } else {
      staffList.forEach(s => {
        const avg = s.hours > 0 ? (s.wages / s.hours) : null;
        rows.push(['  ' + s.name, s.position, s.hours, s.wages, avg]);
      });
    }

    if (callouts.length > 0) {
      rows.push(blank());
      rows.push(['Call-Out Log', 'Staff', 'Reason', '', '']);
      callouts.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(c => {
        rows.push([c.date || '', c.name || c.staff_name || '(unrecorded)', c.reason || '', '', '']);
      });
    }

    this._pushFooter(rows, merges,
      'Source: Labor Control logged hours plus salaried staff pay, and the call-out log. Revenue from Shift Control. Overtime classification and tip credit treatment are your accountant\'s call based on your state and payroll setup.',
      COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    const qtyFmt   = '#,##0.00';
    const pctFmt   = '0.0%';
    rows.forEach((row, i) => {
      const label = String(row[0] || '');
      // Wages column position varies: Summary at col 1, By Position at col 2, By Staff at col 3.
      // Apply formats based on row context.
      if (/(Wages|Revenue|Wage Per Hour)/.test(label)) {
        const c1 = XLSX.utils.encode_cell({ r: i, c: 1 });
        if (ws[c1] && typeof ws[c1].v === 'number') ws[c1].z = moneyFmt;
      }
      if (/Hours/.test(label)) {
        const c1 = XLSX.utils.encode_cell({ r: i, c: 1 });
        if (ws[c1] && typeof ws[c1].v === 'number') ws[c1].z = qtyFmt;
      }
      if (/Labor as %/.test(label)) {
        const c1 = XLSX.utils.encode_cell({ r: i, c: 1 });
        if (ws[c1] && typeof ws[c1].v === 'number') ws[c1].z = pctFmt;
      }
      // By Position rows: col 1 = hours, col 2 = wages, col 3 = share %, col 4 = avg wage
      // By Staff rows:    col 2 = hours, col 3 = wages, col 4 = avg wage
      if (typeof row[1] === 'number' && typeof row[2] === 'number') {
        // Likely By Position detail row
        const c1 = XLSX.utils.encode_cell({ r: i, c: 1 });
        const c2 = XLSX.utils.encode_cell({ r: i, c: 2 });
        if (ws[c1] && ws[c1].v != null) ws[c1].z = qtyFmt;
        if (ws[c2] && ws[c2].v != null) ws[c2].z = moneyFmt;
      }
      const c3 = XLSX.utils.encode_cell({ r: i, c: 3 });
      const c4 = XLSX.utils.encode_cell({ r: i, c: 4 });
      if (ws[c3] && typeof ws[c3].v === 'number' && ws[c3].v >= 0 && ws[c3].v <= 1.0001) ws[c3].z = pctFmt;
      else if (ws[c3] && typeof ws[c3].v === 'number') ws[c3].z = moneyFmt;
      if (ws[c4] && typeof ws[c4].v === 'number') ws[c4].z = moneyFmt;
    });
    return this._finishSheet(ws, rows.length, merges, COL_WIDTHS);
  },

  // ── Sheet 8 — Operational Opportunities ───────────────────────────────────
  // The latest audit from each system, with score, gap dollar value, and the
  // open action items. The owner uses this with the accountant as a forward-
  // looking agenda: here is what we can still pull back next month.
  _buildOperationalOpportunities(monthKey) {
    const COL_COUNT = 4;
    const COL_WIDTHS = [{ wch: 56 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
    const monthEnd = this._monthEndDate(monthKey);

    const latestBefore = (list) => {
      if (!Array.isArray(list)) return null;
      return list.filter(a => a && a.date && String(a.date).slice(0, 10) <= monthEnd)
        .slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        .slice(-1)[0] || null;
    };

    const profitAudit  = latestBefore(App.data?.audits);
    const revenueAudit = latestBefore(App.data?.revenue_audits);
    const trafficAudit = latestBefore(App.data?.traffic_audits);

    const blank = () => this._blankRow(COL_COUNT);
    const rows = [];
    const merges = [];
    const mergeFull = (r) => merges.push({ s: { r, c: 0 }, e: { r, c: COL_COUNT - 1 } });

    rows.push(this._lineRow(this._baseTitle('Operational Opportunities', monthKey), COL_COUNT));
    mergeFull(0);
    rows.push(blank());

    rows.push(this._lineRow('Your latest audit from each system, translated into dollar opportunities to discuss with your accountant.', COL_COUNT));
    mergeFull(rows.length - 1);
    rows.push(blank());

    const renderAudit = (label, audit) => {
      rows.push([label, '', '', '']);
      if (!audit) {
        rows.push(['  (no audit on file at or before ' + monthEnd + ')', '', '', '']);
        rows.push(blank());
        return;
      }
      rows.push(['  Audit dated', (audit.date || '').slice(0, 10), '', '']);
      rows.push(['  Overall score', audit.overall_score != null ? audit.overall_score : '', '', '']);
      const items = audit.action_items || [];
      if (items.length === 0) {
        rows.push(['  (no open action items)', '', '', '']);
        rows.push(blank());
        return;
      }
      const monthlyTotal = items.reduce((s, a) => s + (parseFloat(a.monthly_impact) || 0), 0);
      rows.push(['  Total monthly opportunity', monthlyTotal, '', '']);
      rows.push(['  Total annual opportunity', monthlyTotal * 12, '', '']);
      rows.push(blank());
      rows.push(['  Action Items', 'Priority', 'Monthly $', 'Annual $']);
      items.slice().sort((a, b) => (parseFloat(b.monthly_impact) || 0) - (parseFloat(a.monthly_impact) || 0)).forEach(it => {
        const mon = parseFloat(it.monthly_impact) || 0;
        rows.push(['    ' + (it.title || it.name || it.action || '(unnamed item)'), it.priority || '', mon, mon * 12]);
      });
      rows.push(blank());
    };

    renderAudit('Profit Recovery',  profitAudit);
    renderAudit('Revenue Recovery', revenueAudit);
    renderAudit('Traffic Recovery', trafficAudit);

    this._pushFooter(rows, merges,
      'Source: latest Profit, Revenue, and Traffic audits at or before ' + monthEnd + '. Action items and their dollar impacts come from the audit you ran in Bar Cop.',
      COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    rows.forEach((row, i) => {
      [1, 2, 3].forEach(c => {
        const addr = XLSX.utils.encode_cell({ r: i, c });
        const cell = ws[addr];
        if (cell && typeof cell.v === 'number') {
          // Score values are 0-100 integers; leave as plain numbers. Anything else as money.
          const label = String(row[0] || '');
          if (/score/i.test(label)) {
            // leave as default
          } else {
            cell.z = moneyFmt;
          }
        }
      });
    });
    return this._finishSheet(ws, rows.length, merges, COL_WIDTHS);
  },

  // ── Sheet 9 — Year-End Tax Helper (annual roll, December only) ────────────
  // Lifts the year's beginning inventory, total purchases, ending inventory,
  // total revenue, total COGS, total labor, and operating expenses into the
  // Schedule C / Form 1120 line numbers an accountant maps to. Only generated
  // for December close (or any month ending in -12).
  _buildYearEndTaxHelper(monthKey) {
    const COL_COUNT = 4;
    const COL_WIDTHS = [{ wch: 56 }, { wch: 16 }, { wch: 18 }, { wch: 36 }];
    const year = monthKey.slice(0, 4);
    const yearStart = year + '-01-01';
    const yearEnd   = year + '-12-31';

    // Full-year aggregates from weeks
    const YTD = this._aggregateYTD(year + '-12');

    // Beginning and ending inventory from counts
    const counts = (App.inventoryData?.ic_counts || []).slice()
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    const beginCount = counts.filter(c => c.date && c.date < yearStart).slice(-1)[0] || null;
    const endCount   = counts.filter(c => c.date && c.date <= yearEnd).slice(-1)[0] || null;
    const beginValue = beginCount ? (parseFloat(beginCount.total_value) || 0) : null;
    const endValue   = endCount   ? (parseFloat(endCount.total_value)   || 0) : null;

    // Total purchases from receive-delivery log over the year
    const inYear = (d) => d && String(d).slice(0, 4) === year;
    const purchases = (App.inventoryData?.ic_deliveries || [])
      .filter(d => inYear(d.date))
      .reduce((s, d) => s + (parseFloat(d.total) || 0), 0);

    // Calculated COGS = begin + purchases - end
    const calcCogs = (beginValue != null && endValue != null) ? (beginValue + purchases - endValue) : null;

    const blank = () => this._blankRow(COL_COUNT);
    const rows = [];
    const merges = [];
    const mergeFull = (r) => merges.push({ s: { r, c: 0 }, e: { r, c: COL_COUNT - 1 } });

    rows.push(this._lineRow(this._baseTitle('Year-End Tax Helper', monthKey) + ' (' + year + ')', COL_COUNT));
    mergeFull(0);
    rows.push(blank());

    rows.push(this._lineRow('Annual totals lifted to the Schedule C line numbers an accountant transcribes. Your accountant should review and verify every figure.', COL_COUNT));
    mergeFull(rows.length - 1);
    rows.push(blank());

    rows.push(['Schedule C Line', 'Amount', 'Source', '']);
    rows.push(['Line 1: Gross receipts', YTD.totalRev, 'Sum of Profit weekly revenue for ' + year, '']);
    rows.push(['Line 2: Returns and allowances', YTD.compsLoss, 'Guest comps from Shift Control (staff meals and shift drinks are booked as an expense, not a return)', '']);
    rows.push(['Line 3: Subtract Line 2 from Line 1', YTD.totalRev - (YTD.compsLoss || 0), 'Calculated', '']);
    rows.push(['Line 4: Cost of goods sold', calcCogs != null ? calcCogs : YTD.totalCogs, calcCogs != null ? 'Begin + purchases - end' : 'Sum of Profit weekly COGS (no end-of-year count on file)', '']);
    rows.push(['Line 5: Gross profit (Line 3 minus Line 4)', (YTD.totalRev - (YTD.compsLoss || 0)) - (calcCogs != null ? calcCogs : YTD.totalCogs), 'Calculated', '']);
    rows.push(blank());
    rows.push(['Line 26: Wages (less employment credits)', YTD.totalLabor, 'Sum of Labor Control wages for ' + year, '']);
    rows.push(['Line 21: Repairs and maintenance', YTD.maintenance, 'Sum of Shift Control maintenance log for ' + year, '']);
    rows.push(blank());

    rows.push(['Part III: Cost of Goods Sold Detail', '', '', '']);
    rows.push(['Line 35: Beginning inventory', beginValue, beginCount ? ('Count dated ' + beginCount.date) : 'No count on file before ' + yearStart, '']);
    rows.push(['Line 36: Purchases', purchases, 'Sum of receive-delivery records for ' + year, '']);
    rows.push(['Line 41: Ending inventory', endValue, endCount ? ('Count dated ' + endCount.date) : 'No count on file at or before ' + yearEnd, '']);
    rows.push(['Line 42: Cost of goods sold (35 + 36 - 41)', calcCogs, 'Calculated', '']);

    this._pushFooter(rows, merges,
      'Line numbers match IRS Schedule C (Form 1040). For corporations, the equivalent Form 1120 line numbers should be mapped by your accountant. Bar Cop is a software tool, not a tax preparer.',
      COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    rows.forEach((row, i) => {
      const addr = XLSX.utils.encode_cell({ r: i, c: 1 });
      if (ws[addr] && typeof ws[addr].v === 'number') ws[addr].z = moneyFmt;
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
    return App.ymdLocal(d);
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
    const cc = this._sumCompsByClass(d => d && String(d).slice(0, 7) === monthKey);
    agg.comps = cc.total; agg.compsLoss = cc.loss; agg.compsPolicy = cc.policy;
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

    // Comps (split loss vs policy) and maintenance for the whole YTD window.
    const cc = this._sumCompsByClass(inYearThroughMonth);
    agg.comps = cc.total; agg.compsLoss = cc.loss; agg.compsPolicy = cc.policy;
    const mnts = (App.shiftData?.sc_maintenance || []).filter(m => inYearThroughMonth(m.date_reported || m.date));
    agg.maintenance = mnts.reduce((s, m) => s + (parseFloat(m.cost || m.amount) || 0), 0);
    return agg;
  },

  _sumWeeks(weeks) {
    let barRev = 0, foodRev = 0, cateringRev = 0, otherRev = 0;
    let barCogs = 0, foodCogs = 0, cateringCogs = 0, otherCogs = 0;
    let barLabor = 0, foodLabor = 0, cateringLabor = 0;
    let platformFees = 0;
    weeks.forEach(w => {
      barRev      += parseFloat(w.bar?.revenue)       || 0;
      foodRev     += parseFloat(w.food?.revenue)      || 0;
      cateringRev += parseFloat(w.catering?.revenue)  || 0;
      otherRev    += parseFloat(w.other?.revenue)     || 0;
      barCogs     += parseFloat(w.bar?.cogs)          || 0;
      foodCogs    += parseFloat(w.food?.cogs)         || 0;
      cateringCogs+= parseFloat(w.catering?.cogs)     || 0;
      otherCogs   += parseFloat(w.other?.cogs)        || 0;
      barLabor    += parseFloat(w.bar?.labor)         || 0;
      foodLabor   += parseFloat(w.food?.labor)        || 0;
      cateringLabor += parseFloat(w.catering?.labor)  || 0;
      platformFees+= parseFloat(w.platform_fees)      || 0;
    });
    return {
      barRev, foodRev, cateringRev, otherRev,
      totalRev: barRev + foodRev + cateringRev + otherRev,
      barCogs, foodCogs, cateringCogs, otherCogs,
      totalCogs: barCogs + foodCogs + cateringCogs + otherCogs,
      barLabor, foodLabor, cateringLabor,
      totalLabor: barLabor + foodLabor + cateringLabor,
      platformFees
    };
  },

  // Comps split by class for the income statement: guest comps (loss) reduce
  // revenue; staff meals and shift drinks (policy) are an operating expense.
  // Keeps the income statement consistent with the Void and Comp Log sheet.
  _sumCompsByClass(inWindow) {
    const vcs = (App.shiftData?.sc_void_comps || []).filter(v => (v.type === 'comp' || v.type === 'Comp') && inWindow(v.date));
    let loss = 0, policy = 0;
    vcs.forEach(v => {
      const amt = parseFloat(v.amount) || 0;
      if (App.compReasonIsLoss(v.reason || v.category)) loss += amt; else policy += amt;
    });
    return { loss, policy, total: loss + policy };
  },

  // Sum void+comp records (comps only — voids are not a cost line, they are
  _sumMaintenance(monthKey) {
    const inMonth = (dateStr) => dateStr && String(dateStr).slice(0, 7) === monthKey;
    const mnts = (App.shiftData?.sc_maintenance || []).filter(m => inMonth(m.date_reported || m.date));
    return mnts.reduce((s, m) => s + (parseFloat(m.cost || m.amount) || 0), 0);
  },

  // Operating Expenses by category. Reads App.data.operating_expenses (entered
  // by the operator in the Operating Expenses log under Accounting). When
  // ytd is true, sums the calendar year through monthKey; otherwise sums
  // just monthKey. Returns an object keyed by category name (matches the
  // locked enum in S.HubOperatingExpenses.CATEGORIES). Unknown / legacy
  // categories fold into 'Other' so nothing gets dropped from the rollup.
  _opExSums(monthKey, ytd) {
    const out = {};
    // One canonical category list, shared with the Operating Expenses log, so a
    // category change there can never silently mis-bucket here.
    const known = (window.S && S.HubOperatingExpenses && S.HubOperatingExpenses.CATEGORIES) || [
      'Occupancy (Rent, Property Tax)', 'Utilities', 'Insurance', 'Marketing and Advertising',
      'Professional Fees', 'Bank and Credit Card Fees', 'Licenses and Permits', 'Software and Subscriptions', 'Other'
    ];
    known.forEach(k => { out[k] = 0; });
    const records = App.data?.operating_expenses || [];
    const year = monthKey.slice(0, 4);
    records.forEach(r => {
      const mk = String(r.date || '').slice(0, 7);
      if (!mk) return;
      if (ytd) {
        if (mk.slice(0, 4) !== year || mk > monthKey) return;
      } else {
        if (mk !== monthKey) return;
      }
      const cat = known.includes(r.category) ? r.category : 'Other';
      out[cat] = (out[cat] || 0) + (parseFloat(r.amount) || 0);
    });
    return out;
  }
};
