'use strict';

/* ── Hub Annual Review — annual operations review deliverable ─────────────────
   Sits alongside Month-End Books and Weekly P&L on the Hub Accounting menu.
   Builds an annual XLSX workbook + a styled multi-page PDF Executive Summary
   from data Bar Cop already has: revenue_weeks, weeks, lc_actuals, sc_shifts,
   audits. Designed to fire alongside the December close but runnable for any
   year that has data, so the operator can also pull a historical review.

   Workbook sheets (in order):
     1. Annual Summary       — headline P&L + percentages + YOY delta if prior year
     2. P&L by Month         — 12-month columnar P&L + Total column
     3. Inventory Valuation  — beginning/ending count value + monthly purchases
     4. Labor Cost Trend     — by month: hours, OT, wages, labor %, RPLH
     5. Tip Allocation       — Form 8027 Worksheet for the whole year
     6. Cash Control Summary — variance totals by month + worst-offender shifts
     7. Audit History        — every audit run in the year with score + opportunity
     8. Operational Events   — voids/comps, walked tabs, call-outs, expired certs

   PDF Executive Summary (~4 pages):
     1. Headline numbers + YOY deltas
     2. Monthly trend table (revenue/COGS/labor/prime by month)
     3. Operational events + top 5 audit opportunities of the year
     4. Year-end notes — strongest month, weakest month, biggest leak

   Reuses S.HubBooks helpers (_aggregateMonth, _monthLabel, _monthEndDate,
   _blankRow, _lineRow, _pushFooter, _disclaimerLines, _finishSheet) so the
   aggregation and styling stay consistent across deliverables.

   Legal protection: footer disclaimer on every sheet, disclaimer in PDF
   footer, workbook Subject property carries the disclaimer too. */

S.HubYearEnd = {

  MONTHS_FULL: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  MONTHS_SHORT: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],

  // ── Entry point ────────────────────────────────────────────────────────────
  // Full-page Hub screen. Sidebar stays mounted, content area swaps, topbar
  // shows "ANNUAL REVIEW | Back to Dashboard". Action buttons live next to
  // the Year dropdown inside the picker card.
  open() {
    App.openHubFullPage('Annual Review', (mount) => this._render(mount), 'year-end');
  },

  // ── Render the picker screen ───────────────────────────────────────────────
  _render(mount) {
    // No confirmed weeks yet: a new user should not land on a review for a year
    // before they started. Show one clean guided card, the way the Weekly P&L
    // Brief does, until there is a year worth reviewing.
    if (!this._hasData()) {
      mount.innerHTML = '<div class="screen"><div class="card form-card">'
        + '<div class="card-title">Annual Review</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.7;">No weeks confirmed yet. Confirm your weeks from the Profit dashboard through the year, and your Annual Review builds here, ready to generate.</div>'
        // S271: it named the Profit dashboard and gave no way to get there.
        + '<div style="margin-top:14px;"><button class="btn btn-primary btn-sm" id="ye-go-confirm">Confirm a Week</button></div>'
        + '</div></div>';
      if (App.setHubTopbarActions) App.setHubTopbarActions('');
      document.getElementById('ye-go-confirm')?.addEventListener('click',
        () => App.openScreen('this-week'));
      return;
    }
    const years = this._availableYears();
    const defaultYear = years[0] || String(new Date().getFullYear() - 1);
    const yearOpts = years.map(y =>
      '<option value="' + y + '"' + (y === defaultYear ? ' selected' : '') + '>' + y + '</option>'
    ).join('') || '<option value="' + defaultYear + '" selected>' + defaultYear + '</option>';

    mount.innerHTML =
      '<div class="screen">'
      + '<div class="card form-card">'
        + '<div class="card-title">Annual Review</div>'
        + '<div class="form-row" style="gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:0;">'
          + '<div class="f" style="width:300px;"><label>Year</label><select id="hy-year">' + yearOpts + '</select></div>'
        + '</div>'
        + '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-top:18px;">'
          + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
          + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">Bar Cop assembles these numbers from what you log. It is a software tool, not a CPA, tax preparer, or legal advisor. This is a worksheet, not a filed tax return or audited financial statement. Your accountant should review and verify every figure before you file anything or make material decisions.</div>'
        + '</div>'
      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
        + '<button class="btn btn-primary" id="hy-generate">Generate File</button>'
        + '<button class="btn btn-ghost" id="hy-pdf">Executive Summary (PDF)</button>'
        + '<span id="hy-status" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-left:6px;display:none;"></span>'
      + '</div>'
      + this._whatsInsideCard()
      + '</div>';

    if (App.setHubTopbarActions) App.setHubTopbarActions('');

    document.getElementById('hy-generate')?.addEventListener('click', () => this._generate());
    document.getElementById('hy-pdf')?.addEventListener('click', () => this._openPdfSummary());
  },

  _whatsInsideCard() {
    const rows = [
      ['Annual Summary',       'Headline P&L. Total revenue, COGS, labor, prime cost. Year-over-year change if you have a prior year on file.'],
      ['P&L by Month',         'Twelve months side by side. Revenue, costs, percentages. Spot the months that ran lean and the ones that ran hot.'],
      ['Inventory Valuation',  'Year-start inventory value, year-end inventory value, total purchases. Schedule C ready.'],
      ['Labor Cost Trend',     'Hours, overtime, wages, labor percent, revenue per labor hour. Month by month.'],
      ['Tip Allocation',       'Annual Form 8027 Worksheet. Per-employee yearly totals. Your accountant transcribes to the actual IRS form.'],
      ['Cash Control Summary', 'Variance totals by month. Worst-offender shifts. The cash story for the whole year on one page.'],
      ['Audit History',        'Every audit you ran during the year. Score, monthly opportunity, top action items per audit.'],
      ['Operational Events',   'Voids and comps, walked tabs, call-outs, certifications that lapsed during the year.'],
      ['1099 Vendors',         'Vendors you paid 600 dollars or more this year, a starting point for 1099-NEC. Not the final list, your accountant confirms who actually needs one.']
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

  // Any confirmed weeks on the books at all. Drives the no-data empty state.
  _hasData() {
    return (App.data?.weeks || []).some(w => w && w.period_end);
  },

  // ── Year list — years with at least one saved week ─────────────────────────
  _availableYears() {
    const weeks = (App.data?.weeks || []).filter(w => w && w.period_end);
    if (!weeks.length) {
      return [String(new Date().getFullYear() - 1)];
    }
    const set = new Set();
    weeks.forEach(w => {
      const y = String(w.period_end).slice(0, 4);
      if (y) set.add(y);
    });
    return Array.from(set).sort().reverse();
  },

  _setStatus(text, color) {
    const el = document.getElementById('hy-status');
    if (!el) return;
    el.textContent = text;
    el.style.color = color || 'var(--t3)';
    el.style.display = 'block';
  },


  async _generate() {
    const year = document.getElementById('hy-year')?.value;
    if (!year) return;
    const btn = document.getElementById('hy-generate');

    if (typeof XLSX === 'undefined') {
      // One shared sentence across all five spreadsheet doors, and it logs (S292/S310).
      this._setStatus(App.excelMissing('hub-year-end'), 'var(--red)');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Building...';
    this._setStatus('Building your file...', 'var(--t3)');

    try {
      await new Promise(r => setTimeout(r, 50));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, this._buildAnnualSummary(year),     'Annual Summary');
      XLSX.utils.book_append_sheet(wb, this._buildPnlByMonth(year),        'P&L by Month');
      XLSX.utils.book_append_sheet(wb, this._buildInventoryValuation(year),'Inventory Valuation');
      XLSX.utils.book_append_sheet(wb, this._buildLaborCostTrend(year),    'Labor Cost Trend');
      XLSX.utils.book_append_sheet(wb, this._buildTipAllocation(year),     'Form 8027 Worksheet');
      XLSX.utils.book_append_sheet(wb, this._buildCashControlSummary(year),'Cash Control Summary');
      XLSX.utils.book_append_sheet(wb, this._buildAuditHistory(year),      'Audit History');
      XLSX.utils.book_append_sheet(wb, this._buildOperationalEvents(year), 'Operational Events');
      XLSX.utils.book_append_sheet(wb, this._build1099Vendors(year),       '1099 Vendors');

      const barName = (App.data?.settings?.bar_name) || 'Bar Cop';
      wb.Props = {
        Title:        barName + ' - Annual Review, ' + year,
        Subject:      App.deliverableFooter().workbookSubject,
        Author:       barName,
        Company:      'Bar Cop',
        CreatedDate:  new Date()
      };

      const filename = App.fileSafe(barName) + ' - Annual Review Worksheet - ' + year + '.xlsx';
      XLSX.writeFile(wb, filename);
      this._setStatus('Downloaded ' + filename, 'var(--gold)');
    } catch (e) {
      console.error('Year-end generation error:', e);
      this._setStatus('Could not build the file: ' + (e?.message || 'unknown error'), 'var(--red)');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate File';
    }
  },

  // ── Year-period aggregation ────────────────────────────────────────────────
  // Sums monthly aggregates from S.HubBooks (the same source Books uses), so
  // numbers tie back across deliverables. Returns annual totals + 12-month
  // breakout array.
  _aggregateYear(year) {
    const months = [];
    let agg = {
      barRev: 0, foodRev: 0, cateringRev: 0, otherRev: 0, totalRev: 0,
      barCogs: 0, foodCogs: 0, cateringCogs: 0, otherCogs: 0, totalCogs: 0,
      barLabor: 0, foodLabor: 0, cateringLabor: 0, totalLabor: 0,
      comps: 0, compsLoss: 0, compsPolicy: 0, maintenance: 0, platformFees: 0
    };
    // Annual OpEx by category. Operating Expenses log (App.data.operating_expenses)
    // is the canonical store; Books and Year-End both read from it via the
    // shared _opExSums helper. Repairs/Maintenance + Platform Fees come from
    // sc_maintenance + weekly platform_fees instead to avoid double-counting.
    const opexCategories = [
      'Occupancy (Rent, Property Tax)',
      'Utilities',
      'Insurance',
      'Marketing and Advertising',
      'Professional Fees',
      'Bank and Credit Card Fees',
      'Licenses and Permits',
      'Software and Subscriptions',
      'Other'
    ];
    const opex = {};
    opexCategories.forEach(c => { opex[c] = 0; });
    for (let m = 1; m <= 12; m++) {
      const monthKey = year + '-' + String(m).padStart(2, '0');
      const M = S.HubBooks._aggregateMonth(monthKey);
      const monthOpex = S.HubBooks._opExSums(monthKey, false);
      months.push({ key: monthKey, monthNum: m, ...M, opex: monthOpex });
      agg.barRev        += M.barRev;
      agg.foodRev       += M.foodRev;
      agg.cateringRev   += M.cateringRev   || 0;
      agg.otherRev      += M.otherRev      || 0;
      agg.totalRev      += M.totalRev;
      agg.barCogs       += M.barCogs;
      agg.foodCogs      += M.foodCogs;
      agg.cateringCogs  += M.cateringCogs  || 0;
      agg.otherCogs     += M.otherCogs     || 0;
      agg.totalCogs     += M.totalCogs;
      agg.barLabor      += M.barLabor;
      agg.foodLabor     += M.foodLabor;
      agg.cateringLabor += M.cateringLabor || 0;
      agg.totalLabor    += M.totalLabor;
      agg.comps         += M.comps         || 0;
      agg.compsLoss     += M.compsLoss     || 0;
      agg.compsPolicy   += M.compsPolicy   || 0;
      agg.maintenance   += M.maintenance   || 0;
      agg.platformFees  += M.platformFees  || 0;
      opexCategories.forEach(c => { opex[c] += monthOpex[c] || 0; });
    }
    return { months, ...agg, opex };
  },

  // ── Shared sheet helpers (borrow from HubBooks for styling cohesion) ───────
  _baseTitle(sheetName, year) {
    const barName = (App.data?.settings?.bar_name) || 'Bar Cop';
    return barName + ': ' + sheetName + ', ' + year;
  },
  _blankRow(c)   { return S.HubBooks._blankRow(c); },
  _lineRow(t, c) { return S.HubBooks._lineRow(t, c); },
  _pushFooter(rows, merges, sourceText, colCount) {
    return S.HubBooks._pushFooter(rows, merges, sourceText, colCount);
  },
  _finishSheet(ws, rowsLen, merges, colWidths) {
    return S.HubBooks._finishSheet(ws, rowsLen, merges, colWidths);
  },

  // ── 1099 Vendor Worksheet: vendors paid $600 or more this year, from the
  //    Operating Expenses log, a starting point for 1099-NEC. ─────────────────
  _build1099Vendors(year) {
    const COL_COUNT = 3;
    const rows = [], merges = [];
    rows.push(this._lineRow(this._baseTitle('1099 Vendor Worksheet', year), COL_COUNT));
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: COL_COUNT - 1 } });
    rows.push(this._blankRow(COL_COUNT));
    rows.push(['Vendor', 'Total Paid', 'Payments']);

    const byVendor = {};
    (App.data?.operating_expenses || []).forEach(r => {
      if (String(r.date || '').slice(0, 4) !== String(year)) return;
      const v = (r.vendor || '').trim(); if (!v) return;
      if (!byVendor[v]) byVendor[v] = { total: 0, count: 0 };
      byVendor[v].total += parseFloat(r.amount) || 0;
      byVendor[v].count++;
    });
    const list = Object.keys(byVendor).map(v => ({ vendor: v, total: byVendor[v].total, count: byVendor[v].count }))
      .filter(x => x.total >= 600).sort((a, b) => b.total - a.total);
    if (list.length) list.forEach(x => rows.push([x.vendor, x.total, x.count]));
    else rows.push(['No vendor was paid $600 or more this year.', '', '']);
    rows.push(this._blankRow(COL_COUNT));

    this._pushFooter(rows, merges,
      'Vendors paid $600 or more from your Operating Expenses log this year, a starting point for 1099-NEC. Not every vendor over $600 needs a 1099 (corporations and payments for goods are generally exempt), and a contractor under $600 in one log may still need one across all your records. Confirm each with your accountant before issuing.',
      COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    rows.forEach((row, i) => {
      const cell = ws[XLSX.utils.encode_cell({ r: i, c: 1 })];
      if (cell && typeof cell.v === 'number') cell.z = moneyFmt;
    });
    return this._finishSheet(ws, rows.length, merges, [{ wch: 44 }, { wch: 18 }, { wch: 12 }]);
  },

  // ── Sheet 1 — Annual Summary ──────────────────────────────────────────────
  _buildAnnualSummary(year) {
    const COL_COUNT = 4;
    const COL_WIDTHS = [{ wch: 42 }, { wch: 20 }, { wch: 20 }, { wch: 22 }];
    const Y = this._aggregateYear(year);
    const priorYear = String(parseInt(year, 10) - 1);
    const P = this._aggregateYear(priorYear);
    const hasPrior = P.totalRev > 0 || P.totalCogs > 0 || P.totalLabor > 0;

    const rows = [];
    const merges = [];
    const blank = () => this._blankRow(COL_COUNT);
    const mergeFull = (r) => merges.push({ s: { r, c: 0 }, e: { r, c: COL_COUNT - 1 } });

    rows.push(this._lineRow(this._baseTitle('Annual Summary', year), COL_COUNT));
    mergeFull(0);
    rows.push(blank());

    rows.push(['', year, hasPrior ? priorYear : '', hasPrior ? 'YOY Change' : '']);
    rows.push(blank());

    const deltaPct = (cur, prev) => (hasPrior && prev !== 0) ? ((cur - prev) / Math.abs(prev)) : null;
    const deltaCell = (cur, prev) => {
      if (!hasPrior) return '';
      const d = deltaPct(cur, prev);
      if (d == null) return '';
      const sign = d >= 0 ? '+' : '';
      return sign + (d * 100).toFixed(1) + '%';
    };

    const row = (label, cur, prev) => rows.push([label, cur, hasPrior ? prev : '', deltaCell(cur, prev)]);

    rows.push(['Revenue', '', '', '']);
    row('  Bar Revenue',      Y.barRev,      P.barRev);
    row('  Food Revenue',     Y.foodRev,     P.foodRev);
    row('  Catering Revenue', Y.cateringRev, P.cateringRev);
    row('  Other / Ancillary Revenue', Y.otherRev, P.otherRev);
    // Revenue is net sales (comps already excluded by the POS); do not re-subtract
    // comps or re-expense policy comps. Comps stay tracked in Shift Control.
    row('Total Revenue (net sales)', Y.totalRev, P.totalRev);
    rows.push(blank());

    rows.push(['Cost of Goods Sold', '', '', '']);
    row('  Bar COGS',      Y.barCogs,      P.barCogs);
    row('  Food COGS',     Y.foodCogs,     P.foodCogs);
    row('  Catering COGS', Y.cateringCogs, P.cateringCogs);
    row('  Other COGS',    Y.otherCogs,    P.otherCogs);
    row('Total COGS', Y.totalCogs, P.totalCogs);
    rows.push(blank());

    row('Gross Profit', Y.totalRev - Y.totalCogs, P.totalRev - P.totalCogs);
    rows.push(blank());

    rows.push(['Labor', '', '', '']);
    row('  Bar Labor',      Y.barLabor,      P.barLabor);
    row('  Food Labor',     Y.foodLabor,     P.foodLabor);
    row('  Catering Labor', Y.cateringLabor, P.cateringLabor);
    row('Total Labor', Y.totalLabor, P.totalLabor);
    rows.push(blank());

    row('Prime Cost (COGS + Labor)', Y.totalCogs + Y.totalLabor, P.totalCogs + P.totalLabor);
    rows.push(blank());

    // Operating Expenses — from the Operating Expenses log + Shift Control
    // maintenance + weekly platform fees. Books and Year-End share the same
    // category enum so the numbers tie back across both deliverables.
    const totalOpExY = Object.values(Y.opex || {}).reduce((s, v) => s + (v || 0), 0)
                      + (Y.maintenance || 0) + (Y.platformFees || 0);
    const totalOpExP = Object.values(P.opex || {}).reduce((s, v) => s + (v || 0), 0)
                      + (P.maintenance || 0) + (P.platformFees || 0);
    rows.push(['Operating Expenses', '', '', '']);
    row('  Occupancy (rent, property tax)',           (Y.opex?.['Occupancy (Rent, Property Tax)'] || 0), (P.opex?.['Occupancy (Rent, Property Tax)'] || 0));
    row('  Utilities',                                (Y.opex?.['Utilities']                      || 0), (P.opex?.['Utilities']                      || 0));
    row('  Insurance',                                (Y.opex?.['Insurance']                      || 0), (P.opex?.['Insurance']                      || 0));
    row('  Marketing and advertising',                (Y.opex?.['Marketing and Advertising']      || 0), (P.opex?.['Marketing and Advertising']      || 0));
    row('  Repairs and maintenance',                  Y.maintenance,                                    P.maintenance);
    row('  3rd-party platform fees',                  Y.platformFees,                                   P.platformFees);
    row('  Professional fees',                        (Y.opex?.['Professional Fees']              || 0), (P.opex?.['Professional Fees']              || 0));
    row('  Bank and credit card fees',                (Y.opex?.['Bank and Credit Card Fees']      || 0), (P.opex?.['Bank and Credit Card Fees']      || 0));
    row('  Licenses and permits',                     (Y.opex?.['Licenses and Permits']           || 0), (P.opex?.['Licenses and Permits']           || 0));
    row('  Software and subscriptions',               (Y.opex?.['Software and Subscriptions']     || 0), (P.opex?.['Software and Subscriptions']     || 0));
    row('  Other operating expenses',                 (Y.opex?.['Other']                          || 0), (P.opex?.['Other']                          || 0));
    row('Total Operating Expenses', totalOpExY, totalOpExP);
    rows.push(blank());

    row('Operating Income (before taxes)',
        Y.totalRev - Y.totalCogs - Y.totalLabor - totalOpExY,
        P.totalRev - P.totalCogs - P.totalLabor - totalOpExP);
    rows.push(blank());

    // Percentages
    const pct = (n, d) => d ? (n / d) : null;
    const pctRow = (label, n, d, pn, pd) => {
      const cur = pct(n, d);
      const prev = pct(pn, pd);
      const delta = (hasPrior && cur != null && prev != null) ? (cur - prev) : null;
      const deltaStr = delta == null ? '' : ((delta >= 0 ? '+' : '') + (delta * 100).toFixed(1) + ' pts');
      rows.push([label, cur, hasPrior ? prev : '', deltaStr]);
    };
    rows.push(['Key Cost Ratios', '', '', '']);
    pctRow('  Pour Cost %',  Y.barCogs,  Y.barRev,  P.barCogs,  P.barRev);
    pctRow('  Food Cost %',  Y.foodCogs, Y.foodRev, P.foodCogs, P.foodRev);
    pctRow('  Labor %',      Y.totalLabor, Y.totalRev, P.totalLabor, P.totalRev);
    pctRow('  Prime Cost %', Y.totalCogs + Y.totalLabor, Y.totalRev, P.totalCogs + P.totalLabor, P.totalRev);

    this._pushFooter(rows, merges,
      'Revenue from Shift Control. COGS from Inventory Control weekly counts. Labor from Labor Control actuals. Comps from Shift Control void and comp log.',
      COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    const pctFmt   = '0.0%';
    rows.forEach((r, i) => {
      const label = String(r[0] || '');
      const isPctRow = /%\s*$/.test(label) || /Cost Ratios/i.test(label);
      [1, 2].forEach(c => {
        const addr = XLSX.utils.encode_cell({ r: i, c });
        const cell = ws[addr];
        if (cell && typeof cell.v === 'number') cell.z = isPctRow ? pctFmt : moneyFmt;
      });
    });
    return this._finishSheet(ws, rows.length, merges, COL_WIDTHS);
  },

  // ── Sheet 2 — P&L by Month ────────────────────────────────────────────────
  _buildPnlByMonth(year) {
    const COL_COUNT = 14; // Item + 12 months + Total
    const COL_WIDTHS = [{ wch: 32 }];
    for (let i = 0; i < 12; i++) COL_WIDTHS.push({ wch: 13 });
    COL_WIDTHS.push({ wch: 15 });

    const Y = this._aggregateYear(year);
    const rows = [];
    const merges = [];
    const mergeFull = (r) => merges.push({ s: { r, c: 0 }, e: { r, c: COL_COUNT - 1 } });
    const blank = () => this._blankRow(COL_COUNT);

    rows.push(this._lineRow(this._baseTitle('P&L by Month', year), COL_COUNT));
    mergeFull(0);
    rows.push(blank());

    // Column headers
    const headerRow = ['']; // Item label column
    for (let i = 0; i < 12; i++) headerRow.push(this.MONTHS_SHORT[i]);
    headerRow.push('Total');
    rows.push(headerRow);
    rows.push(blank());

    const seriesRow = (label, fn) => {
      const r = [label];
      let total = 0;
      Y.months.forEach(M => { const v = fn(M); r.push(v); total += v; });
      r.push(total);
      rows.push(r);
    };
    const seriesPctRow = (label, numFn, denFn) => {
      const r = [label];
      let totalNum = 0, totalDen = 0;
      Y.months.forEach(M => {
        const n = numFn(M), d = denFn(M);
        totalNum += n; totalDen += d;
        r.push(d ? (n / d) : null);
      });
      r.push(totalDen ? (totalNum / totalDen) : null);
      rows.push(r);
    };

    rows.push(['Revenue', ...Array(13).fill('')]);
    seriesRow('  Bar Revenue',      M => M.barRev);
    seriesRow('  Food Revenue',     M => M.foodRev);
    seriesRow('  Catering Revenue', M => M.cateringRev || 0);
    seriesRow('  Other / Ancillary Revenue', M => M.otherRev || 0);
    // Revenue from the POS is already net sales (comps excluded), so do NOT
    // re-subtract comps here or re-expense policy comps below — either one
    // double-removed them and made this sheet disagree with the Annual Summary
    // sheet and the Income Statement. Comps stay tracked in Shift Control.
    seriesRow('Total Revenue (net sales)', M => M.totalRev);
    rows.push(blank());

    rows.push(['COGS', ...Array(13).fill('')]);
    seriesRow('  Bar COGS',      M => M.barCogs);
    seriesRow('  Food COGS',     M => M.foodCogs);
    seriesRow('  Catering COGS', M => M.cateringCogs || 0);
    seriesRow('  Other COGS',    M => M.otherCogs || 0);
    seriesRow('Total COGS', M => M.totalCogs);
    rows.push(blank());

    seriesRow('Gross Profit', M => M.totalRev - M.totalCogs);
    rows.push(blank());

    rows.push(['Labor', ...Array(13).fill('')]);
    seriesRow('  Bar Labor',      M => M.barLabor);
    seriesRow('  Food Labor',     M => M.foodLabor);
    seriesRow('  Catering Labor', M => M.cateringLabor || 0);
    seriesRow('Total Labor', M => M.totalLabor);
    rows.push(blank());

    seriesRow('Prime Cost (COGS + Labor)', M => M.totalCogs + M.totalLabor);
    rows.push(blank());

    rows.push(['Operating Expenses', ...Array(13).fill('')]);
    seriesRow('  Occupancy (rent, property tax)',   M => M.opex?.['Occupancy (Rent, Property Tax)'] || 0);
    seriesRow('  Utilities',                        M => M.opex?.['Utilities']                      || 0);
    seriesRow('  Insurance',                        M => M.opex?.['Insurance']                      || 0);
    seriesRow('  Marketing and advertising',        M => M.opex?.['Marketing and Advertising']      || 0);
    seriesRow('  Repairs and maintenance',          M => M.maintenance || 0);
    seriesRow('  3rd-party platform fees',          M => M.platformFees || 0);
    seriesRow('  Professional fees',                M => M.opex?.['Professional Fees']              || 0);
    seriesRow('  Bank and credit card fees',        M => M.opex?.['Bank and Credit Card Fees']      || 0);
    seriesRow('  Licenses and permits',             M => M.opex?.['Licenses and Permits']           || 0);
    seriesRow('  Software and subscriptions',       M => M.opex?.['Software and Subscriptions']     || 0);
    seriesRow('  Other operating expenses',         M => M.opex?.['Other']                          || 0);
    seriesRow('Total Operating Expenses', M => {
      const opexSum = Object.values(M.opex || {}).reduce((s, v) => s + (v || 0), 0);
      return opexSum + (M.maintenance || 0) + (M.platformFees || 0);
    });
    rows.push(blank());

    seriesRow('Operating Income', M => {
      const opexSum = Object.values(M.opex || {}).reduce((s, v) => s + (v || 0), 0);
      const totalOpEx = opexSum + (M.maintenance || 0) + (M.platformFees || 0);
      return M.totalRev - M.totalCogs - M.totalLabor - totalOpEx;
    });
    rows.push(blank());

    rows.push(['Key Cost Ratios', ...Array(13).fill('')]);
    seriesPctRow('  Pour Cost %',  M => M.barCogs,  M => M.barRev);
    seriesPctRow('  Food Cost %',  M => M.foodCogs, M => M.foodRev);
    seriesPctRow('  Labor %',      M => M.totalLabor, M => M.totalRev);
    seriesPctRow('  Prime %',      M => M.totalCogs + M.totalLabor, M => M.totalRev);

    this._pushFooter(rows, merges, 'Each month is the sum of Profit weekly rollups (period_end in that month). Pour Cost = Bar COGS / Bar Revenue. Food Cost = Food COGS / Food Revenue. Labor % = Total Labor / Total Revenue.', COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    const pctFmt   = '0.0%';
    rows.forEach((r, i) => {
      const label = String(r[0] || '');
      const isPctRow = /%\s*$/.test(label);
      for (let c = 1; c <= 13; c++) {
        const addr = XLSX.utils.encode_cell({ r: i, c });
        const cell = ws[addr];
        if (cell && typeof cell.v === 'number') cell.z = isPctRow ? pctFmt : moneyFmt;
      }
    });
    return this._finishSheet(ws, rows.length, merges, COL_WIDTHS);
  },

  // ── Sheet 3 — Inventory Valuation Trend ──────────────────────────────────
  _buildInventoryValuation(year) {
    const COL_COUNT = 4;
    const COL_WIDTHS = [{ wch: 32 }, { wch: 18 }, { wch: 18 }, { wch: 36 }];
    const yearStart = year + '-01-01';
    const yearEnd = year + '-12-31';
    const rows = [];
    const merges = [];
    const blank = () => this._blankRow(COL_COUNT);
    const mergeFull = (r) => merges.push({ s: { r, c: 0 }, e: { r, c: COL_COUNT - 1 } });

    rows.push(this._lineRow(this._baseTitle('Inventory Valuation', year), COL_COUNT));
    mergeFull(0);
    rows.push(blank());

    // ⚠ Boundary counts come from the reader (S96) — a second date-only derivation here could name
    // a different count than the figure actually came from. See hub-books._buildInventoryValuation.
    // ⚠ Valued through App.inventoryValueAsOf, not a count's stored `total_value`.
    // A count that SKIPPED products stores them at 0, so the ending figure read light
    // and Calculated COGS came out HIGH — overstating cost of goods and understating
    // taxable profit on a Schedule C worksheet. The as-of reader carries a skipped
    // product forward at its last counted value (Kyle's call 2026-07-21: carry forward
    // AND disclose), and the note pushed below names which ones and from when.
    const beginAsOf = App.inventoryValueAsOf(yearStart, true);
    const endAsOf   = App.inventoryValueAsOf(yearEnd);
    const beginCount = beginAsOf.count;
    const endCount   = endAsOf.count;
    const beginValue = beginAsOf.value;
    const endValue   = endAsOf.value;

    const inYear = (d) => d && String(d).slice(0, 4) === year;
    const yearDeliveries = (App.inventoryData?.ic_deliveries || []).filter(d => inYear(d.date));
    const totalPurchases = yearDeliveries.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);
    const calcCogs = (beginValue != null && endValue != null) ? (beginValue + totalPurchases - endValue) : null;

    rows.push(['Schedule C COGS Math', '', '', '']);
    rows.push(['  Beginning inventory value', beginValue, '', beginCount ? ('Count dated ' + beginCount.date) : 'No count on file before ' + yearStart]);
    rows.push(['  Total purchases',           totalPurchases, '', 'Sum of receive-delivery records for ' + year]);
    rows.push(['  Ending inventory value',    endValue, '', endCount ? ('Count dated ' + endCount.date) : 'No count on file at or before ' + yearEnd]);
    rows.push(['  Calculated COGS',           calcCogs, '', 'Begin + Purchases - End']);
    // The DISCLOSE half: name the products resting on an older count. Shared helper on
    // HubBooks so this sheet and the two in Books cannot drift apart.
    S.HubBooks._pushCarriedNote(rows, merges, beginAsOf, COL_COUNT, 'Beginning inventory');
    S.HubBooks._pushCarriedNote(rows, merges, endAsOf, COL_COUNT, 'Ending inventory');
    rows.push(blank());

    // Purchases by month
    rows.push(['Purchases by Month', '', '', '']);
    rows.push(['Month', 'Purchases', 'Deliveries Count', '']);
    for (let m = 1; m <= 12; m++) {
      const mk = year + '-' + String(m).padStart(2, '0');
      const monthly = yearDeliveries.filter(d => String(d.date).slice(0, 7) === mk);
      const monthlyTotal = monthly.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);
      rows.push([this.MONTHS_FULL[m - 1], monthlyTotal, monthly.length, '']);
    }
    rows.push(['Total', totalPurchases, yearDeliveries.length, '']);

    this._pushFooter(rows, merges, 'Beginning and ending counts from Inventory Control count history. Purchases from receive-delivery log. Used for Schedule C Part III (Cost of Goods Sold) line items 35, 36, 41, 42.', COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    rows.forEach((r, i) => {
      [1].forEach(c => {
        const addr = XLSX.utils.encode_cell({ r: i, c });
        const cell = ws[addr];
        if (cell && typeof cell.v === 'number') cell.z = moneyFmt;
      });
    });
    return this._finishSheet(ws, rows.length, merges, COL_WIDTHS);
  },

  // ── Sheet 4 — Labor Cost Trend ────────────────────────────────────────────
  _buildLaborCostTrend(year) {
    const COL_COUNT = 7;
    const COL_WIDTHS = [{ wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
    const rows = [];
    const merges = [];
    const blank = () => this._blankRow(COL_COUNT);
    const mergeFull = (r) => merges.push({ s: { r, c: 0 }, e: { r, c: COL_COUNT - 1 } });

    rows.push(this._lineRow(this._baseTitle('Labor Cost Trend', year), COL_COUNT));
    mergeFull(0);
    rows.push(blank());

    rows.push(['Month', 'Hours', 'OT Hours', 'Wages', 'Revenue', 'Labor %', 'RPLH']);

    const inYear = (d) => d && String(d).slice(0, 4) === year;
    const allActuals = (App.laborData?.lc_actuals || []);
    const yearActuals = allActuals.filter(a => inYear(a.date));
    const yearShifts = (App.shiftData?.sc_shifts || []).filter(s => inYear(s.date));

    let totalHours = 0, totalOt = 0, totalWages = 0, totalRev = 0;

    for (let m = 1; m <= 12; m++) {
      const mk = year + '-' + String(m).padStart(2, '0');
      const monthActuals = yearActuals.filter(a => String(a.date).slice(0, 7) === mk);
      const monthShifts  = yearShifts.filter(s => String(s.date).slice(0, 7) === mk);

      const mLastDay = new Date(parseInt(year, 10), m, 0).getDate();
      const mStart = mk + '-01', mEnd = mk + '-' + String(mLastDay).padStart(2, '0');

      // Straight time from each row's OWN cost. This used to capture one wage off the
      // first row of a staff-week and cost the whole week at it, which is wrong for a
      // cross-trained cook picking up a shift at a second-position rate, or anyone who
      // got a raise mid-week. lc_actuals carry straight time only; the premium is added
      // below (reg x w + ot x w x 1.5 is just hours x w + the 0.5x premium).
      let mHours = 0, mWages = 0;
      monthActuals.forEach(a => {
        const hrs = parseFloat(a.hours) || 0;
        mHours += hrs;
        // Salaried (exempt): hours count as coverage, but pay is the fixed
        // salary added below, never hours * wage and never overtime.
        if (App.isSalaried(a.staff_id)) return;
        mWages += parseFloat(a.cost) || (hrs * (parseFloat(a.wage) || 0));
      });
      // Overtime is a WEEKLY threshold, so it is measured over whole Mon-Sun weeks from
      // the FULL history and only then allocated to this month. Bucketing the
      // month-filtered rows split every straddling week into two part-weeks and tested
      // each against 40 on its own, so neither reached it: max(0,a-40) + max(0,b-40) is
      // always <= max(0,a+b-40), which means it could only ever UNDER-report. Up to 11
      // straddling weeks a year, on a tax-facing sheet whose own footer promises the
      // overtime is computed per staff per week. Reading the unfiltered actuals also
      // keeps the week straddling Dec 31 whole across both years' sheets.
      const otM = App.otPremiumInWindow(allActuals, mStart, mEnd);
      const mOt = otM.hours;
      mWages += otM.total;
      // Salaried (exempt) staff: fixed monthly salary (annual/52 by the weeks
      // the month spans), no overtime.
      mWages += App.salariedCost(mStart, mEnd).total;
      const mRev = monthShifts.reduce((s, sh) => s + (parseFloat(sh.total_revenue) || 0), 0);
      const laborPct = mRev ? (mWages / mRev) : null;
      const rplh = mHours ? (mRev / mHours) : null;

      rows.push([this.MONTHS_FULL[m - 1], mHours, mOt, mWages, mRev, laborPct, rplh]);
      totalHours += mHours; totalOt += mOt; totalWages += mWages; totalRev += mRev;
    }

    rows.push(blank());
    rows.push(['Total', totalHours, totalOt, totalWages, totalRev,
      totalRev ? (totalWages / totalRev) : null,
      totalHours ? (totalRev / totalHours) : null]);

    this._pushFooter(rows, merges, 'Hours and wages from Labor Control logged actuals. Overtime computed per staff per whole Mon-Sun week (hours over 40 = OT, paid at 1.5x the rate those hours were logged at), then allocated to the month by the share of that week worked in it, so a week spanning two months is never split and tested against 40 twice. Revenue from Shift Control shifts (bar and food only, excluding catering and ancillary), so Labor % and RPLH here can differ from the Annual Summary and P&L by Month sheets, which measure against net sales. RPLH = Revenue per Labor Hour. These wages are recomputed from logged hours and may not exactly match Total Labor on those sheets, which use your weekly booked labor.', COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    const pctFmt   = '0.0%';
    const hoursFmt = '#,##0.0';
    rows.forEach((r, i) => {
      const h = ws[XLSX.utils.encode_cell({ r: i, c: 1 })]; if (h && typeof h.v === 'number') h.z = hoursFmt;
      const o = ws[XLSX.utils.encode_cell({ r: i, c: 2 })]; if (o && typeof o.v === 'number') o.z = hoursFmt;
      const w = ws[XLSX.utils.encode_cell({ r: i, c: 3 })]; if (w && typeof w.v === 'number') w.z = moneyFmt;
      const v = ws[XLSX.utils.encode_cell({ r: i, c: 4 })]; if (v && typeof v.v === 'number') v.z = moneyFmt;
      const p = ws[XLSX.utils.encode_cell({ r: i, c: 5 })]; if (p && typeof p.v === 'number') p.z = pctFmt;
      const rp= ws[XLSX.utils.encode_cell({ r: i, c: 6 })]; if (rp&& typeof rp.v=== 'number') rp.z = moneyFmt;
    });
    return this._finishSheet(ws, rows.length, merges, COL_WIDTHS);
  },

  // (_weekKeyFor removed 2026-07-16: its only caller bucketed month-filtered rows,
  //  which is exactly the bug. Overtime now goes through App.otPremiumInWindow, which
  //  buckets whole Mon-Sun weeks off the unfiltered actuals. Use that, not a local
  //  week key over a pre-filtered set.)

  // ── Sheet 5 — Tip Allocation (Form 8027 Worksheet, annual) ───────────────
  _buildTipAllocation(year) {
    const COL_COUNT = 5;
    const COL_WIDTHS = [{ wch: 60 }, { wch: 18 }, { wch: 42 }, { wch: 16 }, { wch: 22 }];

    const inYear = (d) => d && String(d).slice(0, 4) === year;
    const tips   = (App.laborData?.lc_tips      || []).filter(t => inYear(t.date));
    const pools  = (App.laborData?.lc_tip_pools || []).filter(p => inYear(p.date));
    const shifts = (App.shiftData?.sc_shifts    || []).filter(s => inYear(s.date));

    const grossReceipts = shifts.reduce((s, sh) => s + (parseFloat(sh.total_revenue) || 0), 0);
    const totalChargedTips = tips.reduce((s, t) => s + (parseFloat(t.card_tips) || 0), 0);
    const totalCashTips    = tips.reduce((s, t) => s + (parseFloat(t.cash_tips) || 0), 0);
    const totalReported    = tips.reduce((s, t) => s + (parseFloat(t.total_tips) || (parseFloat(t.cash_tips) || 0) + (parseFloat(t.card_tips) || 0)), 0);
    const line7  = grossReceipts * 0.08;
    const line7a = Math.max(0, line7 - totalReported);

    const rows = [];
    const merges = [];
    const blank = () => this._blankRow(COL_COUNT);
    const mergeFull = (r) => merges.push({ s: { r, c: 0 }, e: { r, c: COL_COUNT - 1 } });

    rows.push(this._lineRow(this._baseTitle('Tip Allocation Worksheet (IRS Form 8027) Annual', year), COL_COUNT));
    mergeFull(0);
    rows.push(blank());

    rows.push(this._lineRow('This is a worksheet. It is not the IRS form. Your accountant moves these numbers onto the actual Form 8027 and signs it.', COL_COUNT));
    mergeFull(rows.length - 1);
    rows.push(this._lineRow('Form 8027 is required for restaurants with more than 10 employees on a typical business day where tipping happens. Confirm with your accountant whether you have to file.', COL_COUNT));
    mergeFull(rows.length - 1);
    rows.push(blank());

    rows.push(['Form 8027 Lines (figured for the year)', '', '', '', '']);
    rows.push(['  Line 1: Total charged tips for the year',                       totalChargedTips, '', '', '']);
    rows.push(['  Line 2: Total charge receipts on which charged tips were shown', null, '(your accountant fills. Bar Cop does not track this separately.)', '', '']);
    rows.push(['  Line 3: Total service charges less than 10% paid as wages',      null, '(your accountant fills if it applies.)', '', '']);
    rows.push(['  Line 4a: Tips reported by indirectly tipped employees',          null, '(your accountant sorts this. Bar Cop logs total tips per server.)', '', '']);
    rows.push(['  Line 4b: Tips reported by directly tipped employees',            null, '(your accountant sorts this. Bar Cop logs total tips per server.)', '', '']);
    rows.push(['  Line 5: Total tips reported (4a plus 4b)',                       totalReported, '', '', '']);
    rows.push(['  Line 6: Gross receipts from food and beverage',                  grossReceipts, '', '', '']);
    rows.push(['  Line 7: 8% of gross receipts (or your approved lower rate)',     line7,         '', '', '']);
    rows.push(['  Line 7a: Allocated tips (Line 7 minus Line 5, never below zero)', line7a,       '', '', '']);
    rows.push(blank());

    rows.push(['Reference Totals', '', '', '', '']);
    rows.push(['  Total Cash Tips logged',  totalCashTips,    '', '', '']);
    rows.push(['  Total Card Tips logged',  totalChargedTips, '', '', '']);
    rows.push(['  Combined Tips logged',    totalReported,    '', '', '']);
    rows.push(blank());

    // Per-employee annual totals + suggested allocation
    const byEmp = {};
    const shiftIdsWithPools = new Set(pools.map(p => p.shift_id).filter(Boolean));
    pools.forEach(p => {
      (p.participants || []).forEach(pt => {
        const name = pt.name || '(unnamed)';
        if (!byEmp[name]) byEmp[name] = { tips: 0, hours: 0 };
        byEmp[name].tips  += parseFloat(pt.share) || 0;
        byEmp[name].hours += parseFloat(pt.hours) || 0;
      });
    });
    tips.forEach(t => {
      if (t.shift_id && shiftIdsWithPools.has(t.shift_id)) return;
      const name = t.name || '(unnamed)';
      if (!byEmp[name]) byEmp[name] = { tips: 0, hours: 0 };
      byEmp[name].tips  += App.netTips(t);   // per-employee tips reported = net of tip-out
      byEmp[name].hours += parseFloat(t.hours) || 0;
    });
    if (Object.keys(byEmp).length) {
      rows.push(['Per-Employee Annual Totals', '', '', '', '']);
      rows.push(['Employee', 'Hours', 'Tips Reported', 'Share of Hours', 'Suggested Allocation (Line 7a x share)']);
      const totalHours = Object.values(byEmp).reduce((s, e) => s + e.hours, 0);
      Object.keys(byEmp).sort().forEach(name => {
        const e = byEmp[name];
        const share = totalHours > 0 ? (e.hours / totalHours) : 0;
        const suggested = line7a * share;
        rows.push([name, e.hours, e.tips, share, suggested]);
      });
      // TWIN of the monthly builder in hub-books — see the full note there. No hours on file
      // means no basis to split on, so every share is 0 and this column prints $0.00 for
      // everyone while Line 7a above still shows a real figure to allocate. Say why.
      // ⚠ DO NOT spread Line 7a evenly to make it foot: that invents an allocation basis on an
      // IRS worksheet.
      if (totalHours <= 0 && line7a > 0) {
        rows.push(this._lineRow('No tippable hours are on file for this year, so Bar Cop cannot suggest a split. Line 7a above still has to be allocated. Add hours on the Tip Log and this column fills in, or your accountant can allocate it another way.', COL_COUNT));
        mergeFull(rows.length - 1);
      }
    } else {
      rows.push(this._lineRow('(no tip records on file for this year)', COL_COUNT));
      mergeFull(rows.length - 1);
    }

    this._pushFooter(rows, merges, 'Source: Labor Control tip pool splits when saved per shift (taxable allocation per employee), tip log entries for shifts without a saved pool, and Shift Control shifts for gross receipts.', COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    const pctFmt   = '0.0%';
    const hoursFmt = '#,##0.0';
    rows.forEach((r, i) => {
      // Col 2 is the per-employee "Tips Reported" — MONEY, and it was the one money cell on this
      // sheet no format pass touched, so it rendered as a raw float on an IRS worksheet. Non-numeric
      // col-2 cells (the Line 2/3/4a/4b notes) are skipped by the typeof guard below.
      [1, 2, 4].forEach(c => {
        const addr = XLSX.utils.encode_cell({ r: i, c });
        const cell = ws[addr];
        if (!cell || typeof cell.v !== 'number') return;
        cell.z = moneyFmt;
      });
      // Hours column 1 and share column 3 specifically in the per-employee table
      const c1 = ws[XLSX.utils.encode_cell({ r: i, c: 1 })];
      const c3 = ws[XLSX.utils.encode_cell({ r: i, c: 3 })];
      if (c1 && typeof c1.v === 'number' && String(r[0] || '').match(/^[A-Za-z]/) && !String(r[0] || '').startsWith('Line') && !String(r[0] || '').startsWith('  ')) {
        // employee row — col 1 is hours
        c1.z = hoursFmt;
      }
      if (c3 && typeof c3.v === 'number') c3.z = pctFmt;
    });
    return this._finishSheet(ws, rows.length, merges, COL_WIDTHS);
  },

  // ── Sheet 6 — Cash Control Summary ────────────────────────────────────────
  _buildCashControlSummary(year) {
    const COL_COUNT = 6;
    const COL_WIDTHS = [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 }];
    const rows = [];
    const merges = [];
    const blank = () => this._blankRow(COL_COUNT);
    const mergeFull = (r) => merges.push({ s: { r, c: 0 }, e: { r, c: COL_COUNT - 1 } });

    rows.push(this._lineRow(this._baseTitle('Cash Control Summary', year), COL_COUNT));
    mergeFull(0);
    rows.push(blank());

    const inYear = (d) => d && String(d).slice(0, 4) === year;
    const variances = (App.shiftData?.sc_variances || []).filter(v => inYear(v.date));
    const drops     = (App.shiftData?.sc_cash_drops || []).filter(d => inYear(d.date));

    rows.push(['Month', 'Drops $', 'Drops Count', 'Variance Total', 'Over Count', 'Short Count']);
    let yrDrops = 0, yrVar = 0, yrOver = 0, yrShort = 0, yrDropCount = 0;
    for (let m = 1; m <= 12; m++) {
      const mk = year + '-' + String(m).padStart(2, '0');
      const monthVar = variances.filter(v => String(v.date).slice(0, 7) === mk);
      const monthDrops = drops.filter(d => String(d.date).slice(0, 7) === mk);
      const dropsSum = monthDrops.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
      const varSum = monthVar.reduce((s, v) => s + (parseFloat(v.variance) || 0), 0);
      // ⚠ COUNT BY STATUS, like every other screen. Raw sign ignores each register's tolerance, so a
      // bar counting four registers nightly (~1,400 counts a year, nearly all a few dollars off but
      // INSIDE tolerance) got "Short Count: 680" here while Cash History and Over-and-Short both
      // said 11 out of tolerance. Same words, wildly different numbers, and this is the sheet an
      // accountant reads. Sign is kept only as a fallback for a row with no status recorded.
      // ⚠ Over/Short still need telling apart for their two columns, so the sign half stays here —
      // but WHETHER a row counts at all now goes through the one shared predicate (S80), so this
      // sheet and the PDF beside it cannot answer the same question two ways again.
      const isOver  = v => App.varianceIsOut(v) && (v.status ? v.status === 'Over'  : (parseFloat(v.variance) || 0) > 0);
      const isShort = v => App.varianceIsOut(v) && (v.status ? v.status === 'Short' : (parseFloat(v.variance) || 0) < 0);
      const overCount  = monthVar.filter(isOver).length;
      const shortCount = monthVar.filter(isShort).length;
      rows.push([this.MONTHS_FULL[m - 1], dropsSum, monthDrops.length, varSum, overCount, shortCount]);
      yrDrops += dropsSum; yrDropCount += monthDrops.length;
      yrVar += varSum; yrOver += overCount; yrShort += shortCount;
    }
    rows.push(blank());
    rows.push(['Total', yrDrops, yrDropCount, yrVar, yrOver, yrShort]);
    rows.push(blank());

    // Worst-offender shifts (top 10 by absolute variance)
    rows.push(['Worst Variance Shifts (Top 10 by Absolute Variance)', '', '', '', '', '']);
    rows.push(['Date', 'Shift', 'Cashier', 'Expected', 'Counted', 'Variance']);
    const worst = variances.slice()
      .sort((a, b) => Math.abs(parseFloat(b.variance) || 0) - Math.abs(parseFloat(a.variance) || 0))
      .slice(0, 10);
    if (worst.length === 0) {
      rows.push(this._lineRow('(no cash variances logged this year)', COL_COUNT));
      mergeFull(rows.length - 1);
    } else {
      // A genuine $0.00 is DATA, not absence. `parseFloat(x) || null` collapsed both to
      // the same blank cell, so a drawer that balanced to the penny printed EMPTY on a
      // tax-facing sheet and read as "this shift was never counted" — the opposite of
      // what it means. Null now only for a value that is missing or not a number.
      // (Same class as the forecast-zero bug: `|| null` cannot tell zero from nothing.)
      const numCell = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
      worst.forEach(v => rows.push([
        v.date || '',
        v.shift_type || v.shift || '',
        v.cashier || v.name || '',
        numCell(v.expected_cash != null ? v.expected_cash : v.expected),
        numCell(v.counted_cash != null ? v.counted_cash : v.counted),
        numCell(v.variance)
      ]));
    }

    this._pushFooter(rows, merges, 'Drops from Shift Control cash drop log. Variances from Shift Control variance log. Over = counted more than expected. Short = counted less than expected.', COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    const intFmt = '#,##0';
    // The monthly table's cols 4/5 are Over/Short COUNTS (integers), but the
    // worst-offenders table's cols 3/4/5 are dollars. Format per table so a count
    // never renders as "$3.00".
    const worstHdr = rows.findIndex(r => r && r[0] === 'Date' && r[1] === 'Shift');
    const fmtCell = (i, c, z) => { const cell = ws[XLSX.utils.encode_cell({ r: i, c })]; if (cell && typeof cell.v === 'number') cell.z = z; };
    rows.forEach((r, i) => {
      if (worstHdr >= 0 && i > worstHdr) {
        [3, 4, 5].forEach(c => fmtCell(i, c, moneyFmt));   // Expected / Counted / Variance
      } else {
        [1, 3].forEach(c => fmtCell(i, c, moneyFmt));       // Drops / Variance dollars
        [2, 4, 5].forEach(c => fmtCell(i, c, intFmt));      // Drop count / Over count / Short count
      }
    });
    return this._finishSheet(ws, rows.length, merges, COL_WIDTHS);
  },

  // ── Sheet 7 — Audit History ───────────────────────────────────────────────
  _buildAuditHistory(year) {
    const COL_COUNT = 6;
    const COL_WIDTHS = [{ wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 48 }];
    const rows = [];
    const merges = [];
    const blank = () => this._blankRow(COL_COUNT);
    const mergeFull = (r) => merges.push({ s: { r, c: 0 }, e: { r, c: COL_COUNT - 1 } });

    rows.push(this._lineRow(this._baseTitle('Audit History', year), COL_COUNT));
    mergeFull(0);
    rows.push(blank());

    rows.push(['Date', 'System', 'Score', 'Monthly Opp $', 'Annual Opp $ (projected)', 'Top Action Item']);

    const inYear = (d) => d && String(d).slice(0, 4) === year;
    const buckets = [
      { label: 'Profit',  list: App.data?.audits || [] },
      { label: 'Revenue', list: App.data?.revenue_audits || [] },
      { label: 'Cash', list: App.data?.cash_audits || [] }
    ];
    const allAudits = [];
    buckets.forEach(b => {
      b.list.filter(a => inYear(a.date)).forEach(a => allAudits.push({ system: b.label, audit: a }));
    });
    allAudits.sort((a, b) => (a.audit.date || '').localeCompare(b.audit.date || ''));

    if (allAudits.length === 0) {
      rows.push(this._lineRow('(no audits run during ' + year + ')', COL_COUNT));
      mergeFull(rows.length - 1);
    } else {
      allAudits.forEach(({ system, audit }) => {
        const items = audit.action_items || [];
        const monthlyTotal = items.reduce((s, i) => s + (parseFloat(i.monthly_impact) || 0), 0);
        const top = items.slice().sort((a, b) => (parseFloat(b.monthly_impact) || 0) - (parseFloat(a.monthly_impact) || 0))[0];
        const topTitle = top ? (top.title || top.name || top.action || '(unnamed)') : '';
        rows.push([
          audit.date || '',
          system,
          audit.overall_score != null ? Number(audit.overall_score) : null,
          monthlyTotal,
          monthlyTotal * 12,
          topTitle
        ]);
      });
      // Annual roll-up by system
      rows.push(blank());
      rows.push(['Annual Totals by System', '', '', '', '', '']);
      buckets.forEach(b => {
        const yearList = b.list.filter(a => inYear(a.date));
        // Opportunity is a run-rate, not a cumulative: use the LATEST audit's monthly
        // gaps, NOT the sum across every weekly audit. Summing counted the same
        // recurring leak once per run and overstated the annual figure ~13x. Matches
        // the month-end books deliverable (one audit per system).
        const latest = yearList.slice().sort((a, c) => String(a.date || '').localeCompare(String(c.date || ''))).pop();
        const totalMonthly = latest ? (latest.action_items || []).reduce((s, i) => s + (parseFloat(i.monthly_impact) || 0), 0) : 0;
        rows.push(['', b.label, yearList.length + ' audits', totalMonthly, totalMonthly * 12, '']);
      });
    }

    this._pushFooter(rows, merges, 'Source: Profit Audit, Revenue Audit, Cash Audit records. Monthly Opportunity is your latest audit per system (a run-rate), not summed across every audit run.', COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    rows.forEach((r, i) => {
      [3, 4].forEach(c => {
        const addr = XLSX.utils.encode_cell({ r: i, c });
        const cell = ws[addr];
        if (cell && typeof cell.v === 'number') cell.z = moneyFmt;
      });
    });
    return this._finishSheet(ws, rows.length, merges, COL_WIDTHS);
  },

  // ── Sheet 8 — Operational Events ──────────────────────────────────────────
  _buildOperationalEvents(year) {
    const COL_COUNT = 4;
    const COL_WIDTHS = [{ wch: 32 }, { wch: 14 }, { wch: 16 }, { wch: 42 }];
    const rows = [];
    const merges = [];
    const blank = () => this._blankRow(COL_COUNT);
    const mergeFull = (r) => merges.push({ s: { r, c: 0 }, e: { r, c: COL_COUNT - 1 } });

    rows.push(this._lineRow(this._baseTitle('Operational Events', year), COL_COUNT));
    mergeFull(0);
    rows.push(blank());

    const inYear = (d) => d && String(d).slice(0, 4) === year;
    const voidComps = (App.shiftData?.sc_void_comps || []).filter(v => inYear(v.date));
    const voids = voidComps.filter(v => v.type === 'void' || v.type === 'Void');
    const comps = voidComps.filter(v => v.type === 'comp' || v.type === 'Comp');
    // Split comps by their reason's loss-vs-expense class. Customer-facing comps
    // are loss; Staff Meal and Shift Drink are policy expense, not loss.
    const lossComps   = comps.filter(c => App.compReasonIsLoss(c.reason || c.category));
    const staffMeals  = comps.filter(c => (c.reason || c.category) === 'Staff Meal');
    const shiftDrinks = comps.filter(c => (c.reason || c.category) === 'Shift Drink');
    const callouts = (App.laborData?.lc_callouts || []).filter(c => inYear(c.date));
    const walked = (App.shiftData?.sc_walked_tabs || []).filter(w => inYear(w.date));
    const certs = (App.laborData?.lc_certs || []).filter(c => inYear(c.expiration_date));

    const sum = (list, field) => list.reduce((s, r) => s + (parseFloat(r[field]) || 0), 0);

    rows.push(['Counts and Totals for ' + year, '', '', '']);
    rows.push(['Event', 'Count', 'Total $', 'Notes']);
    rows.push(['Voids',                voids.length, sum(voids, 'amount'),         'Reversed sales']);
    rows.push(['Comps to Guests',      lossComps.length, sum(lossComps, 'amount'),  'Loss-bearing comps given to guests']);
    rows.push(['Staff Meals',          staffMeals.length, sum(staffMeals, 'amount'),       'Policy expense, not loss']);
    rows.push(['Shift Drinks',         shiftDrinks.length, sum(shiftDrinks, 'amount'),     'Policy expense, not loss']);
    rows.push(['Walked Tabs',          walked.length, sum(walked, 'amount'),         'Unpaid checks, mis-bills, lost tickets']);
    rows.push(['Call-Outs',            callouts.length, '',                          'Staff call-outs and no-shows']);
    rows.push(['Certs Lapsed',         certs.length, '',                             'Certifications with expiration date in ' + year]);
    rows.push(blank());

    // Lapsed certifications detail
    if (certs.length > 0) {
      rows.push(['Certifications Lapsed', '', '', '']);
      rows.push(['Staff', 'Cert Type', 'Expiration Date', '']);
      certs.slice()
        .sort((a, b) => (a.expiration_date || '').localeCompare(b.expiration_date || ''))
        .forEach(c => rows.push([
          c.holder_name || (typeof App.staffById === 'function' ? (App.staffById(c.staff_id)?.name || '') : '') || '',
          c.cert_type || '',
          c.expiration_date || '',
          ''
        ]));
      rows.push(blank());
    }

    // Worst-offender call-out staff (top 5)
    if (callouts.length > 0) {
      rows.push(['Call-Outs by Staff (Top 5)', '', '', '']);
      const byStaff = {};
      callouts.forEach(c => {
        const name = c.name || (typeof App.staffById === 'function' ? (App.staffById(c.staff_id)?.name || 'Unknown') : 'Unknown');
        byStaff[name] = (byStaff[name] || 0) + 1;
      });
      Object.keys(byStaff)
        .sort((a, b) => byStaff[b] - byStaff[a])
        .slice(0, 5)
        .forEach(n => rows.push(['  ' + n, byStaff[n], '', '']));
    }

    this._pushFooter(rows, merges, 'Sources: Shift Control (voids, comps, walked tabs), Labor Control (call-outs, certifications).', COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    rows.forEach((r, i) => {
      [2].forEach(c => {
        const addr = XLSX.utils.encode_cell({ r: i, c });
        const cell = ws[addr];
        if (cell && typeof cell.v === 'number') cell.z = moneyFmt;
      });
    });
    return this._finishSheet(ws, rows.length, merges, COL_WIDTHS);
  },

  // ── PDF Executive Summary ─────────────────────────────────────────────────
  // Builds a clean, data-driven multi-section PDF via the shared App._pdfBuilder
  // (no browser print dialog). Same data as the XLSX so the numbers agree.
  async _openPdfSummary() {
    const year = document.getElementById('hy-year')?.value;
    if (!year) return;
    const Y = this._aggregateYear(year);
    const priorYear = String(parseInt(year, 10) - 1);
    const P = this._aggregateYear(priorYear);
    const hasPrior = P.totalRev > 0 || P.totalCogs > 0 || P.totalLabor > 0;

    const fmt$ = (v) => (v == null || isNaN(v)) ? '-' : (Number(Number(v).toFixed(2)) < 0 ? '-' : '') + '$' + Math.abs(Number(v)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });   // negative-safe: a loss-year Operating Income prints "-$45,000.00", not "$-45,000.00"
    const fmtPct = (v) => (v == null || isNaN(v)) ? '-' : (v * 100).toFixed(1) + '%';
    const fmtDeltaPct = (cur, prev) => {
      if (!hasPrior || prev === 0 || cur == null || prev == null) return '';
      const d = (cur - prev) / Math.abs(prev);
      const sign = d >= 0 ? '+' : '';
      return ' (' + sign + (d * 100).toFixed(1) + '% vs ' + priorYear + ')';
    };
    const fmtPtsDelta = (cur, prev) => {
      if (!hasPrior || cur == null || prev == null) return '';
      const d = cur - prev;
      const sign = d >= 0 ? '+' : '';
      return ' (' + sign + (d * 100).toFixed(1) + ' pts vs ' + priorYear + ')';
    };

    // Cost ratios
    const pourCost = Y.barRev  ? (Y.barCogs  / Y.barRev)  : null;
    const foodCost = Y.foodRev ? (Y.foodCogs / Y.foodRev) : null;
    const laborPct = Y.totalRev ? (Y.totalLabor / Y.totalRev) : null;
    const primeCost = Y.totalRev ? ((Y.totalCogs + Y.totalLabor) / Y.totalRev) : null;
    const prevPour  = P.barRev  ? (P.barCogs  / P.barRev)  : null;
    const prevFood  = P.foodRev ? (P.foodCogs / P.foodRev) : null;
    const prevLabor = P.totalRev ? (P.totalLabor / P.totalRev) : null;
    const prevPrime = P.totalRev ? ((P.totalCogs + P.totalLabor) / P.totalRev) : null;

    // Operational counts
    const inYear = (d) => d && String(d).slice(0, 4) === year;
    const voidComps = (App.shiftData?.sc_void_comps || []).filter(v => inYear(v.date));
    const voids = voidComps.filter(v => v.type === 'void' || v.type === 'Void');
    const comps = voidComps.filter(v => v.type === 'comp' || v.type === 'Comp');
    const variances = (App.shiftData?.sc_variances || []).filter(v => inYear(v.date));
    // The out-of-tolerance subset, through the same predicate the workbook sheet uses (S80).
    const variancesOut = variances.filter(v => App.varianceIsOut(v)).length;
    const callouts = (App.laborData?.lc_callouts || []).filter(c => inYear(c.date));
    const walked = (App.shiftData?.sc_walked_tabs || []).filter(w => inYear(w.date));
    const tips = (App.laborData?.lc_tips || []).filter(t => inYear(t.date));
    const totalTips = tips.reduce((s, t) => s + (parseFloat(t.total_tips) || (parseFloat(t.cash_tips) || 0) + (parseFloat(t.card_tips) || 0)), 0);

    // Strongest/weakest month. Revenue is already net sales (comps excluded), so
    // do NOT re-subtract comps here — doing so could rank a high-comp month below a
    // lower-revenue one and print the wrong "strongest month" + a understated figure.
    const netMonthlyRev = Y.months.map(M => M.totalRev);
    let strongIdx = -1, weakIdx = -1, strongVal = -Infinity, weakVal = Infinity;
    netMonthlyRev.forEach((v, i) => {
      if (v > strongVal) { strongVal = v; strongIdx = i; }
      // Only consider months that have data when picking weakest
      if (v > 0 && v < weakVal) { weakVal = v; weakIdx = i; }
    });

    // Audits — top opportunities of the year. Opportunity is a run-rate, not a
    // cumulative: take the LATEST audit per system (its action items), NOT every
    // weekly audit. Summing every run counted the same recurring leak once per audit
    // (~13x overstatement) and filled the top-5 with duplicates of one item.
    const _latestInYear = list => (list || []).filter(a => inYear(a.date))
      .slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).pop() || null;
    const allItems = [];
    [
      { label: 'Profit',  list: App.data?.audits || [] },
      { label: 'Revenue', list: App.data?.revenue_audits || [] },
      { label: 'Cash', list: App.data?.cash_audits || [] }
    ].forEach(bk => {
      const a = _latestInYear(bk.list);
      if (!a) return;
      (a.action_items || []).forEach(it => {
        allItems.push({
          system: bk.label,
          title: it.title || it.name || it.action || '(unnamed)',
          monthly: parseFloat(it.monthly_impact) || 0,
          date: a.date || ''
        });
      });
    });
    allItems.sort((a, b) => b.monthly - a.monthly);
    const topFive = allItems.slice(0, 5);
    const totalAnnualOpp = allItems.reduce((s, i) => s + i.monthly, 0) * 12;

    try { await App._ensurePDFLib(); }
    catch (e) { this._setStatus('Could not load the PDF engine. Check your connection and try again.', 'var(--red)'); return; }

    const b = App._pdfBuilder('Annual Review');
    b.header({ right: 'Annual Review', meta: year + (hasPrior ? ' (with ' + priorYear + ' comparison)' : '') });

    // ── Headline numbers ──
    // True operating income (matches the workbook Annual Summary sheet): revenue
    // is already net sales (comps excluded by the POS), so do NOT re-subtract
    // comps or re-expense policy comps — that double-removed them and made this
    // PDF disagree with the Annual Summary tab of the same file.
    const opExYpdf = Object.values(Y.opex || {}).reduce((s, v) => s + (v || 0), 0) + (Y.maintenance || 0) + (Y.platformFees || 0);
    const opIncomeYpdf = Y.totalRev - Y.totalCogs - Y.totalLabor - opExYpdf;
    b.sectionTitle('The Year in Dollars');
    b.table(null, [
      ['Total Revenue (net sales)', fmt$(Y.totalRev) + fmtDeltaPct(Y.totalRev, P.totalRev)],
      ['  Bar Revenue', fmt$(Y.barRev)],
      ['  Food Revenue', fmt$(Y.foodRev)],
      ['Cost of Goods Sold', fmt$(Y.totalCogs) + fmtDeltaPct(Y.totalCogs, P.totalCogs)],
      ['Labor', fmt$(Y.totalLabor) + fmtDeltaPct(Y.totalLabor, P.totalLabor)],
      ['Prime Cost (COGS + Labor)', fmt$(Y.totalCogs + Y.totalLabor) + fmtDeltaPct(Y.totalCogs + Y.totalLabor, P.totalCogs + P.totalLabor)],
      ['Operating Income (before taxes)', fmt$(opIncomeYpdf)]
    ], { columnStyles: { 1: { halign: 'right' } } });

    b.sectionTitle('The Year in Percentages');
    b.table(null, [
      ['Pour Cost', fmtPct(pourCost) + fmtPtsDelta(pourCost, prevPour)],
      ['Food Cost', fmtPct(foodCost) + fmtPtsDelta(foodCost, prevFood)],
      ['Labor %', fmtPct(laborPct) + fmtPtsDelta(laborPct, prevLabor)],
      ['Prime Cost %', fmtPct(primeCost) + fmtPtsDelta(primeCost, prevPrime)]
    ], { columnStyles: { 1: { halign: 'right' } } });

    // ── Monthly trend ──
    b.sectionTitle('Month by Month');
    b.table(['Month', 'Net Revenue', 'COGS', 'Labor', 'Prime', 'Prime %'],
      Y.months.map((M, i) => {
        const netRev = M.totalRev;
        const prime = M.totalCogs + M.totalLabor;
        const primePct = M.totalRev ? (prime / M.totalRev) : null;
        return [this.MONTHS_SHORT[i], fmt$(netRev), fmt$(M.totalCogs), fmt$(M.totalLabor), fmt$(prime), fmtPct(primePct)];
      }),
      { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } } });

    // ── Operational events + top opportunities ──
    b.sectionTitle('Operational Events');
    b.table(null, [
      ['Voids logged', String(voids.length)],
      ['Comps logged', comps.length + ' (' + fmt$(comps.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)) + ')'],
      ['Walked Tabs', walked.length + ' (' + fmt$(walked.reduce((s, w) => s + (parseFloat(w.amount) || 0), 0)) + ')'],
      /* ⚠ TWO FACTS, NOT ONE (S80). This printed `variances.length` — the raw row count of every
         drawer that was COUNTED — under the words "Cash variances logged", while the Cash Control
         Summary sheet in the same workbook counts Over and Short by status. Measured on the seed:
         sheet 6 said 37, this line said 364, in two documents an accountant reads side by side.
         Both numbers are worth having and they answer different questions, so both are printed and
         each says which one it is. */
      ['Cash counts logged', String(variances.length)],
      ['Cash variances (over or short)', String(variancesOut)],
      ['Call-outs logged', String(callouts.length)],
      ['Tips logged (total)', fmt$(totalTips)]
    ], { columnStyles: { 1: { halign: 'right' } } });

    b.sectionTitle('Top Opportunities Surfaced This Year');
    if (topFive.length === 0) {
      b.paragraph('No open audit action items on file for ' + year + '. Run a Profit, Revenue, or Cash audit to surface opportunities.', { gray: 100 });
    } else {
      b.paragraph('Total annualized opportunity from your latest audit in each system: ' + fmt$(totalAnnualOpp) + '.');
      b.table(['System', 'Opportunity', 'Monthly $', 'Annual $'],
        topFive.map(it => [it.system, it.title, fmt$(it.monthly), fmt$(it.monthly * 12)]),
        { columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } } });
    }

    // ── Year-end notes ──
    b.sectionTitle('The Year in a Few Lines');
    b.paragraph('Strongest revenue month: '
      + (strongIdx >= 0 ? (this.MONTHS_FULL[strongIdx] + ', net revenue ' + fmt$(strongVal)) : 'No data') + '.');
    b.paragraph('Weakest revenue month (with data): '
      + (weakIdx >= 0 ? (this.MONTHS_FULL[weakIdx] + ', net revenue ' + fmt$(weakVal)) : 'No data') + '.');
    b.paragraph('Prime cost ran at: ' + fmtPct(primeCost) + ' for the year. The target for a healthy operation is 60% to 65%. Numbers above that are where money is leaking; numbers below are where the operation is making real margin.');
    /* ⚠⚠ THE ZERO-BRANCH HAD TO MOVE WITH THE NUMBER (S80 / [[the-loop]] #24). It read
       `variances.length === 0 ? 'Either the year ran clean or the shifts did not get fully
       reconciled.'` — written when the number meant ROWS, where zero genuinely can mean nobody
       reconciled anything. Swapping in the out-of-tolerance count without moving this test would
       have told a bar that counted its drawers 364 times, every one inside tolerance, that its
       shifts "did not get fully reconciled" — the best possible result reported as the worst.
       So the sentence carries both numbers and each branch asks the one it is about: whether
       anything was counted (rows), and how it went (out of tolerance). */
    b.paragraph('Cash control: ' + variances.length + ' drawer count' + (variances.length === 1 ? '' : 's')
      + ' logged for the year, ' + variancesOut + ' of them over or short. '
      + (variances.length === 0
          ? 'Nothing was reconciled at all this year, so there is no cash control read to give. Worth a look.'
          : variancesOut === 0
            ? 'Every count came in inside tolerance, which is what you want to see.'
            : 'See the Cash Control Summary sheet in the workbook for the worst-offender shifts.'));
    if (topFive.length > 0) {
      b.paragraph('Biggest opportunity surfaced: ' + topFive[0].system + ' audit flagged "' + topFive[0].title + '" at ' + fmt$(topFive[0].monthly * 12) + ' annual. Worth running the corresponding Fix Process if it is still open.');
    }

    b.disclaimer(App.deliverableFooter().workbookSubject);

    await b.save(App.pdfFileName('Annual Review Worksheet', year));
  }
};
