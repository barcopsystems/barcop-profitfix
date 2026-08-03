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
    if (App._hubBlocked && App._hubBlocked('hub-books-home')) return;   // Books area gate
    if (App.stampFixView) App.stampFixView('books');
    App.openHubFullPage('Month-End Books', (mount) => this._render(mount), 'books');
  },

  // ── Render the picker screen ───────────────────────────────────────────────
  _render(mount) {
    // No confirmed weeks yet: a new user should not land on a close-the-month
    // picker for a month before they started. Show one clean guided card, the
    // way the Weekly P&L Brief does, until there is something to close.
    if (!(App.data?.weeks || []).some(w => w && w.period_end)) {
      mount.innerHTML = '<div class="screen"><div class="card form-card">'
        + '<div class="card-title">Month-End Books</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.7;">No weeks confirmed yet. Confirm your weeks from the Profit dashboard and log your operating expenses, and your Month-End Books build here, ready to close.</div>'
        + '</div></div>';
      if (App.setHubTopbarActions) App.setHubTopbarActions('');
      return;
    }
    const months = this._availableMonths();
    // The newest month that is not the one we are standing in — see _availableMonths (S228d).
    // Every month stays selectable; only the default steps back. The rule lives in
    // _closingMonthKey so the Close-The-Books cockpit quotes the month this screen will open.
    const defaultMonth = this._closingMonthKey();
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
      + '<div id="hb-review-wrap">' + this._reviewBlock(defaultMonth) + '</div>'
      + '</div>';

    if (App.setHubTopbarActions) App.setHubTopbarActions('');

    document.getElementById('hb-generate')?.addEventListener('click', () => this._generate());
    document.getElementById('hb-pdf')?.addEventListener('click', () => this._openPdfSummary());
    document.getElementById('hb-month')?.addEventListener('change', (e) => {
      const w = document.getElementById('hb-review-wrap'); if (w) { w.innerHTML = this._reviewBlock(e.target.value); }
    });
  },

  // ── On-screen review block: the Income Statement and Sales Tax, below the
  //    generate workflow. A visual snapshot only; the sanctioned download is the
  //    Generate File worksheet (gated by the export acknowledgment). Rebuilt when
  //    the month changes. ──────────────────────────────────────────────────────
  _reviewBlock(monthKey) {
    return '<div id="hb-is-content">' + this._incomeStatementCard(monthKey) + this._salesTaxCard(monthKey) + '</div>';
  },

  // ── On-screen Income Statement (the same numbers as the export, readable
  //    without opening Excel). Month and YTD side by side, off the shared
  //    aggregators so it always agrees with the Month-End file. ───────────────
  _incomeStatementCard(monthKey) {
    const M = this._aggregateMonth(monthKey), YTD = this._aggregateYTD(monthKey);
    const opexM = this._opExSums(monthKey, false), opexY = this._opExSums(monthKey, true);
    // Was a 4th hand-rolled balance formatter. It was already negative-safe and right,
    // but it is the same rule as App.fmtBal, and hub-books-home renders these very
    // figures through the same helper now, which is what makes the landing and this
    // statement agree on a down month. The null/NaN dash stays: that is this card's
    // contract, not fmtBal's.
    const f = v => (v == null || isNaN(v)) ? '-' : App.fmtBal(v);
    const pct = v => (v == null || isNaN(v)) ? '-' : (v * 100).toFixed(1) + '%';
    const opexSum = o => Object.values(o).reduce((s, v) => s + (v || 0), 0);
    // Revenue entered from the POS is NET sales (comps/discounts already excluded),
    // so the P&L must NOT re-subtract comps from revenue or re-expense policy comps
    // — either one double-removed them. Comps stay tracked in Shift Control for
    // discipline (comp %, theft signal). See the net-sales note on the statement.
    // One formula for the whole statement — see _plParts. This card used to build it inline,
    // as did the workbook sheet and the Books landing.
    const P = this._plParts(monthKey, false), PY = this._plParts(monthKey, true);
    const totalOpExM = P.totalOpEx, totalOpExY = PY.totalOpEx;
    const netRevM = P.netRev, netRevY = PY.netRev;
    const grossM = P.gross, grossY = PY.gross;
    const opIncM = P.opInc, opIncY = PY.opInc;

    const sec = t => '<tr class="pnl-sec"><td colspan="3">' + t + '</td></tr>';
    const line = (label, m, y, o) => {
      o = o || {};
      const fmt = o.pct ? pct : f;
      const wt = o.bold ? 'font-weight:700;' : '';
      const lblCol = o.bold ? 'color:var(--t1);' : '';
      const valCol = 'color:' + (o.col || (o.neg ? 'var(--red)' : (o.bold ? 'var(--t1)' : 'var(--t2)'))) + ';';
      return '<tr><td style="' + wt + lblCol + '">' + label + '</td>'
        + '<td style="' + wt + valCol + '">' + fmt(m) + '</td>'
        + '<td style="' + wt + valCol + '">' + fmt(y) + '</td></tr>';
    };
    const opIncCol = opIncM >= 0 ? 'var(--green)' : 'var(--red)';

    const rows = sec('Revenue')
      + line('Bar Revenue', M.barRev, YTD.barRev, { sub: 1 })
      + line('Food Revenue', M.foodRev, YTD.foodRev, { sub: 1 })
      + line('Catering Revenue', M.cateringRev, YTD.cateringRev, { sub: 1 })
      + line('Other / Ancillary Revenue', M.otherRev, YTD.otherRev, { sub: 1 })
      + line('Total Revenue (net sales)', netRevM, netRevY, { bold: 1, border: 1 })
      + sec('Cost of Goods Sold')
      + line('Bar COGS', M.barCogs, YTD.barCogs, { sub: 1 })
      + line('Food COGS', M.foodCogs, YTD.foodCogs, { sub: 1 })
      + line('Catering COGS', M.cateringCogs, YTD.cateringCogs, { sub: 1 })
      + line('Other COGS', M.otherCogs, YTD.otherCogs, { sub: 1 })
      + line('Total COGS', M.totalCogs, YTD.totalCogs, { bold: 1, border: 1 })
      + line('Gross Profit', grossM, grossY, { bold: 1, border: 1 })
      + sec('Labor')
      + line('Bar Labor', M.barLabor, YTD.barLabor, { sub: 1 })
      + line('Food Labor', M.foodLabor, YTD.foodLabor, { sub: 1 })
      + line('Catering Labor', M.cateringLabor, YTD.cateringLabor, { sub: 1 })
      + line('Total Labor', M.totalLabor, YTD.totalLabor, { bold: 1, border: 1 })
      + line('Prime Cost (COGS + Labor)', M.totalCogs + M.totalLabor, YTD.totalCogs + YTD.totalLabor, { bold: 1, border: 1 })
      + sec('Operating Expenses')
      + line('Occupancy (rent, property tax)', opexM['Occupancy (Rent, Property Tax)'] || 0, opexY['Occupancy (Rent, Property Tax)'] || 0, { sub: 1 })
      + line('Utilities', opexM['Utilities'] || 0, opexY['Utilities'] || 0, { sub: 1 })
      + line('Insurance', opexM['Insurance'] || 0, opexY['Insurance'] || 0, { sub: 1 })
      + line('Marketing and advertising', opexM['Marketing and Advertising'] || 0, opexY['Marketing and Advertising'] || 0, { sub: 1 })
      + line('Repairs and maintenance', M.maintenance, YTD.maintenance, { sub: 1 })
      + line('3rd-party platform fees', M.platformFees, YTD.platformFees, { sub: 1 })
      + line('Professional fees', opexM['Professional Fees'] || 0, opexY['Professional Fees'] || 0, { sub: 1 })
      + line('Bank and credit card fees', opexM['Bank and Credit Card Fees'] || 0, opexY['Bank and Credit Card Fees'] || 0, { sub: 1 })
      + line('Licenses and permits', opexM['Licenses and Permits'] || 0, opexY['Licenses and Permits'] || 0, { sub: 1 })
      + line('Software and subscriptions', opexM['Software and Subscriptions'] || 0, opexY['Software and Subscriptions'] || 0, { sub: 1 })
      + line('Other operating expenses', opexM['Other'] || 0, opexY['Other'] || 0, { sub: 1 })
      + line('Total Operating Expenses', totalOpExM, totalOpExY, { bold: 1, border: 1 })
      + line('Operating Income (before taxes)', opIncM, opIncY, { bold: 1, border: 1, col: opIncCol })
      + sec('Key Cost Ratios')
      + line('Pour Cost %', M.barRev ? (M.barCogs / M.barRev) : null, YTD.barRev ? (YTD.barCogs / YTD.barRev) : null, { sub: 1, pct: 1 })
      + line('Food Cost %', M.foodRev ? (M.foodCogs / M.foodRev) : null, YTD.foodRev ? (YTD.foodCogs / YTD.foodRev) : null, { sub: 1, pct: 1 })
      + line('Labor % of Revenue', M.totalRev ? (M.totalLabor / M.totalRev) : null, YTD.totalRev ? (YTD.totalLabor / YTD.totalRev) : null, { sub: 1, pct: 1 })
      + line('Prime Cost %', M.totalRev ? ((M.totalCogs + M.totalLabor) / M.totalRev) : null, YTD.totalRev ? ((YTD.totalCogs + YTD.totalLabor) / YTD.totalRev) : null, { sub: 1, pct: 1 });

    return '<div class="sh" style="margin:24px 0 10px;">' + esc(this._monthLabel(monthKey)) + ' Snapshot</div>'
      + '<div class="card"><table class="pnl-list" style="table-layout:fixed;">'
      + '<colgroup><col style="width:50%"><col style="width:25%"><col style="width:25%"></colgroup>'
      + '<thead><tr><th>Income Statement</th><th>' + esc(this._monthLabel(monthKey)) + '</th><th>Year to Date</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>';
  },

  // ── Sales Tax Worksheet: the tax you collected this period off your taxable
  //    sales, by your filing frequency. An estimate (rate x sales); confirm
  //    against your POS tax report before filing. ─────────────────────────────
  _salesTaxRate() { return (window.CashEngine && CashEngine.salesTaxRate) ? CashEngine.salesTaxRate() : 0; },
  _salesTaxFreq() { return (window.CashEngine && CashEngine.taxFrequency) ? CashEngine.taxFrequency() : 'monthly'; },
  // Taxable sales = revenue net of comps (comped product was never charged, so
  // it is not a taxable sale), which also keeps this in step with the
  // net-of-comps revenue on the Income Statement directly above it.
  // Taxable base = bar + food + catering (net sales). Excludes Other/Ancillary
  // revenue (gift-card sales, cover charges, service charges are commonly NON-
  // taxable) and does not re-subtract comps (revenue is already net). An estimate
  // to confirm against the POS / a tax pro.
  _taxableSales(monthKey) { const a = this._aggregateMonth(monthKey); return (a.barRev || 0) + (a.foodRev || 0) + (a.cateringRev || 0); },
  _quarterToDate(monthKey) {
    const year = monthKey.slice(0, 4), mNum = parseInt(monthKey.slice(5, 7), 10);
    const qStart = Math.floor((mNum - 1) / 3) * 3 + 1;
    let sales = 0;
    for (let m = qStart; m <= mNum; m++) sales += this._taxableSales(year + '-' + String(m).padStart(2, '0'));
    return sales;
  },
  _salesTaxCard(monthKey) {
    const rate = this._salesTaxRate(), freq = this._salesTaxFreq();
    if (!rate) {
      return '<div class="sh" style="margin:24px 0 10px;">Sales Tax</div>'
        + '<div class="card"><div style="font-size:12px;color:var(--t3);line-height:1.6;">Set your sales tax rate in App Settings, under Business Profile, and Bar Cop estimates the tax you collected, by month and quarter, off your taxable sales.</div></div>';
    }
    const f = v => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const rateTxt = rate.toLocaleString('en-US', { maximumFractionDigits: 3 }) + '%';
    const monthSales = this._taxableSales(monthKey), monthTax = monthSales * rate / 100;
    const qSales = this._quarterToDate(monthKey), qTax = qSales * rate / 100;
    const row = (period, sales, tax) => '<tr>'
      + '<td style="color:var(--t1);">' + period + '</td>'
      + '<td style="color:var(--t2);">' + f(sales) + '</td>'
      + '<td style="color:var(--t2);">' + rateTxt + '</td>'
      + '<td style="color:var(--t1);font-weight:700;">' + f(tax) + '</td></tr>';
    const rows = row(esc(this._monthLabel(monthKey)), monthSales, monthTax)
      + (freq === 'quarterly' ? row('Quarter to date', qSales, qTax) : '');
    return '<div class="sh" style="margin:24px 0 10px;">Sales Tax</div>'
      + '<div class="card"><table class="pnl-list" style="table-layout:fixed;">'
      + '<colgroup><col style="width:34%"><col style="width:24%"><col style="width:18%"><col style="width:24%"></colgroup>'
      /* "Estimated Tax", not "Tax Due". The figure is rate x taxable sales, which is an
         approximation by construction: several states use tax BRACKET tables rather than a flat
         multiplication, and even at a flat rate per-ticket rounding moves the register's total.
         The caveat under the table has always said so, but it renders in --t4 at 11px while a
         header sitting directly over the number reads as a claim about what is owed.
         ⛔ The XLSX sheet header must say the same thing — pinned in
         verify-sales-tax-estimated-label.js, which asserts the two against each other. */
      + '<thead><tr><th>Period</th><th>Taxable Sales</th><th>Rate</th><th>Estimated Tax</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>'
      + '<div style="font-size:11px;color:var(--t4);margin-top:8px;line-height:1.5;">Estimated at your ' + rateTxt + ' rate on your taxable sales. The exact tax collected is on your POS tax report, confirm against it before you file. You file ' + (freq === 'quarterly' ? 'quarterly' : 'monthly') + '.</div>';
  },

  // ── PDF executive summary — owner-readable, 1-page snapshot ──────────────
  // Builds a clean, data-driven PDF via the shared App._pdfBuilder so it
  // matches every other Bar Cop deliverable (no browser print dialog). Built
  // from the same data as the XLSX so the numbers always agree.
  async _openPdfSummary() {
    const monthKey = document.getElementById('hb-month')?.value;
    if (!monthKey) return;
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
      { label: 'Cash', audit: latestBefore(App.data?.cash_audits) }
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
      ['Total Revenue (net sales)', fmt$(M.totalRev)],
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
      ['Revenue (net sales)', fmt$(YTD.totalRev)],
      ['COGS', fmt$(YTD.totalCogs)],
      ['Labor', fmt$(YTD.totalLabor)],
      ['Prime Cost', fmt$(YTD.totalCogs + YTD.totalLabor)]
    ], { columnStyles: { 1: { halign: 'right' } } });

    b.sectionTitle('Operational Events This Month');
    b.table(null, [
      ['Voids and Comps Logged', String(voidComps.length)],
      // ⚠ TWO FACTS, NOT ONE (S80), same as the Year-End PDF and for the same reason: this printed
      // the raw count of every drawer COUNTED under the words "Cash Variances Logged", while the
      // Year-End workbook counts the out-of-tolerance ones by status. One shared predicate now.
      ['Cash Counts Logged', String(variances.length)],
      ['Cash Variances (Over or Short)', String(variances.filter(v => App.varianceIsOut(v)).length)],
      ['Tips Logged (total)', fmt$(totalTips)],
      ['Call-Outs Logged', String(callouts.length)]
    ], { columnStyles: { 1: { halign: 'right' } } });

    b.sectionTitle('Top Opportunities From Your Audits');
    if (topFive.length === 0) {
      b.paragraph('No open audit action items on file. Run a Profit, Revenue, or Cash audit to surface opportunities.', { gray: 100 });
    } else {
      b.paragraph('Total monthly opportunity across all systems: ' + fmt$(totalMonthlyOpp)
        + '. Annualized: ' + fmt$(totalMonthlyOpp * 12) + '.');
      b.table(null, topFive.map(it => [it.system + ': ' + it.title, fmt$(it.monthly) + '/mo']),
        { columnStyles: { 1: { halign: 'right' } } });
    }

    b.disclaimer(App.deliverableFooter().workbookSubject);

    /* ⚠ THE SAME PERIOD SPELLING AS THE WORKBOOK. This was `String(monthKey).replace('-','')`,
       so one button row produced "…Worksheet - July 2026.xlsx" beside "…Worksheet - 202607.pdf"
       — the accountant getting the machine key. `_monthLabel` is what the XLSX already used,
       two lines away in this file. */
    const period = this._monthLabel(monthKey) || App._pdfDateStamp();
    await b.save(App.pdfFileName('Month-End Books Worksheet', period));
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
      ['Sales Tax Worksheet', 'Estimated sales tax on your taxable sales for the month, and the quarter if you file quarterly. Confirm against your POS tax report.'],
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
  /* ⚠⚠ THIS COMMENT USED TO DESCRIBE A FILTER THAT DOES NOT EXIST, AND IT MISLED A LATER CHANGE
     INTO CITING IT AS THE APP'S CONVENTION (S228d). It claimed "today's month is excluded unless
     the month has ended"; the code below returns EVERY month that has a week, so months[0] — the
     default selection — was today's PARTIAL month whenever a week had landed in it, and an operator
     generating a monthly close got a part-month income statement by default.
     The LIST still offers every month (closing a partial month on purpose is legitimate); only the
     DEFAULT now steps back past the current one, which is what this comment always claimed. */
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

  /* ⛔ THE MONTH BEING CLOSED — ONE ANSWER, READ BY BOTH SCREENS.
     You close the month that ENDED, so this steps back off the one you are standing in; a bar in
     its first month has nothing to step back to and closes the current one.
     It was an inline expression here, and the Close-The-Books cockpit answered the same question
     for itself off the CURRENT month — so step 3 read "July 2026 operating income $9,982.19" and
     the button under it opened June at $7,837.90. Two screens, one question, two answers
     ([[the-loop]] #54: the moment a quantity appears on two screens, the test is the equality).
     Pinned by verify-books-month-agrees.js. */
  _closingMonthKey() {
    const months = this._availableMonths();
    return months.find(m => m !== this._currentMonthKey()) || months[0] || this._currentMonthKey();
  },

  /* ⛔ THE P&L, COMPUTED ONCE. Four places built this same arithmetic by hand — the on-screen
     Income Statement, the Income Statement SHEET in the workbook, the Books landing's hero, and
     (as of the fix that added this) the cockpit's review step. They agreed today; four copies of
     one formula is how they stop agreeing, and the two that disagreed already cost a finding.
     Revenue entered from the POS is NET sales, so this must NOT re-subtract comps or re-expense
     policy comps — either one double-removes them. Comps stay tracked in Shift Control.
     Returns the PARTS as well as the total, so a caller printing "Total Operating Expenses"
     beside "Operating Income" cannot sum the line one way and the total another.
     Pinned by verify-books-month-agrees.js. */
  _plParts(monthKey, ytd) {
    const A = ytd ? this._aggregateYTD(monthKey) : this._aggregateMonth(monthKey);
    const opex = this._opExSums(monthKey, !!ytd);
    const totalOpEx = Object.values(opex).reduce((s, v) => s + (v || 0), 0)
      + (A.maintenance || 0) + (A.platformFees || 0);
    const netRev = A.totalRev;
    const gross = netRev - A.totalCogs;
    return { A, opex, totalOpEx, netRev, gross, opInc: gross - A.totalLabor - totalOpEx };
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
      // One shared sentence across all five spreadsheet doors, and it logs (S292/S310).
      this._setStatus(App.excelMissing('hub-books'), 'var(--red)');
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
      if (this._salesTaxRate() > 0) XLSX.utils.book_append_sheet(wb, this._buildSalesTax(monthKey), 'Sales Tax');
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

      const filename = App.fileSafe(barName) + ' - Month-End Books Worksheet - ' + this._monthLabel(monthKey) + '.xlsx';
      XLSX.writeFile(wb, filename);
      try { localStorage.setItem('books_report_run_monthend', new Date().toISOString()); } catch (e) {}

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
    rows.push(r('Total Revenue (net sales)', M.totalRev, YTD.totalRev));
    rows.push(['  Revenue is net sales as entered; comps and discounts are tracked in Shift Control.', '', '']);
    rows.push(blank());

    // COGS
    rows.push(['Cost of Goods Sold', '', '']);
    rows.push(r('  Bar COGS',      M.barCogs,      YTD.barCogs));
    rows.push(r('  Food COGS',     M.foodCogs,     YTD.foodCogs));
    rows.push(r('  Catering COGS', M.cateringCogs, YTD.cateringCogs));
    rows.push(r('  Other COGS',    M.otherCogs,    YTD.otherCogs));
    rows.push(r('Total COGS', M.totalCogs, YTD.totalCogs));
    rows.push(blank());

    rows.push(r('Gross Profit', M.totalRev - M.totalCogs, YTD.totalRev - YTD.totalCogs));
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
    // The workbook sheet reads the SAME _plParts the on-screen statement does, so the file an
    // accountant opens cannot disagree with the screen it was generated from.
    const _P = this._plParts(monthKey, false), _PY = this._plParts(monthKey, true);
    const totalOpExM = _P.totalOpEx, totalOpExY = _PY.totalOpEx;
    const operatingIncomeM = _P.opInc, operatingIncomeY = _PY.opInc;

    rows.push(['Operating Expenses', '', '']);
    rows.push(r('  Occupancy (rent, property tax)',                 opexM['Occupancy (Rent, Property Tax)']    || 0, opexY['Occupancy (Rent, Property Tax)']    || 0));
    rows.push(r('  Utilities',                                      opexM['Utilities']                         || 0, opexY['Utilities']                         || 0));
    rows.push(r('  Insurance',                                      opexM['Insurance']                         || 0, opexY['Insurance']                         || 0));
    rows.push(r('  Marketing and advertising',                      opexM['Marketing and Advertising']         || 0, opexY['Marketing and Advertising']         || 0));
    rows.push(r('  Repairs and maintenance',                        M.maintenance,                                  YTD.maintenance));
    rows.push(r('  3rd-party platform fees (DoorDash, UberEats, etc.)', M.platformFees,                              YTD.platformFees));
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
    rows.push(r('  Labor %', M.totalRev ? (M.totalLabor / M.totalRev) : null, YTD.totalRev ? (YTD.totalLabor / YTD.totalRev) : null));   // label must end in "%" so the pct-format pass (isPctRow) catches it, else it prints $0.29 instead of 29.0%
    rows.push(r('  Prime Cost %', M.totalRev ? ((M.totalCogs + M.totalLabor) / M.totalRev) : null, YTD.totalRev ? ((YTD.totalCogs + YTD.totalLabor) / YTD.totalRev) : null));

    // Source notes (each line as its own merged row)
    rows.push(blank());
    rows.push(this._lineRow('Revenue from Shift Control. COGS from Inventory Control weekly counts. Labor from Labor Control actuals.', COL_COUNT));
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: COL_COUNT - 1 } });
    rows.push(this._lineRow('Revenue is net sales as entered; comps and discounts are tracked in Shift Control, not re-subtracted here. Maintenance from the maintenance log. Operating expenses from your Operating Expenses log.', COL_COUNT));
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

  // ── Sheet — Sales Tax Worksheet (estimate; confirm against the POS) ──────────
  _buildSalesTax(monthKey) {
    const COL_COUNT = 4;
    const rate = this._salesTaxRate(), freq = this._salesTaxFreq(), rateFrac = rate / 100;
    const rows = [], merges = [];
    rows.push(this._lineRow(this._baseTitle('Sales Tax Worksheet', monthKey), COL_COUNT));
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: COL_COUNT - 1 } });
    rows.push(this._blankRow(COL_COUNT));
    // Same label as the screen table above, deliberately. This sheet is the one that reaches
    // an accountant, so it is the worst place for the number to look more certain than it is.
    rows.push(['Period', 'Taxable Sales', 'Rate', 'Estimated Tax']);
    const monthSales = this._taxableSales(monthKey);
    rows.push([this._monthLabel(monthKey), monthSales, rateFrac, monthSales * rateFrac]);
    if (freq === 'quarterly') {
      const qSales = this._quarterToDate(monthKey);
      rows.push(['Quarter to date', qSales, rateFrac, qSales * rateFrac]);
    }
    rows.push(this._blankRow(COL_COUNT));
    this._pushFooter(rows, merges,
      'Estimated sales tax at your ' + rate + '% rate on your taxable sales (Shift Control revenue). The exact tax you collected is on your POS sales tax report; confirm against it before filing. You file ' + (freq === 'quarterly' ? 'quarterly' : 'monthly') + '.',
      COL_COUNT);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    rows.forEach((row, i) => {
      [1, 3].forEach(c => { const cell = ws[XLSX.utils.encode_cell({ r: i, c })]; if (cell && typeof cell.v === 'number') cell.z = moneyFmt; });
      const rc = ws[XLSX.utils.encode_cell({ r: i, c: 2 })]; if (rc && typeof rc.v === 'number') rc.z = '0.000%';
    });
    return this._finishSheet(ws, rows.length, merges, [{ wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 18 }]);
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
  // (Books, Year-End, Weekly P&L Brief, Bar Cop Audit PDF) shares one
  // canonical disclaimer.
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

  // ── Carried-forward disclosure ────────────────────────────────────────────
  // Kyle's rule 2026-07-21 is "carry forward AND disclose": a skipped product keeps
  // its last counted value so the shelf still counts, and the sheet SAYS which
  // products those are and when each was last counted. Silently carrying a value
  // into a tax figure would be its own dishonesty. Emits nothing when a count
  // covered everything, so a clean month reads exactly as it did before.
  // Shared by the Books monthly sheet, the Books Year-End Tax Helper and the Year
  // End export, so the three cannot drift.
  // ⚠ LABELLED, because a sheet carries TWO of these (S94). COGS = beginning + purchases -
  // ending, so a carried BEGINNING figure is exactly as material as a carried ending one, on the
  // opposite side of the subtraction — and it was disclosed on none of the three sheets. Two
  // unlabelled "Carried forward:" blocks on one page would be unreadable, so each names its end.
  _pushCarriedNote(rows, merges, asOf, colCount, label) {
    const carried = (asOf && asOf.carried) || [];
    const uncosted = (asOf && asOf.uncosted) || [];
    if (!carried.length && !uncosted.length) return;
    const which = label || 'Ending inventory';
    const mergeFull = (r) => merges.push({ s: { r, c: 0 }, e: { r, c: colCount - 1 } });
    rows.push(this._blankRow(colCount));
    if (carried.length) {
      // ⚠ THREE DIFFERENT REASONS, said separately (S89 + S134/S135). Fully NOT counted ("nobody got
      // to it on the night") is actionable — count it. A PARTLY-carried product WAS counted (at
      // another shelf on the boundary) with only part of its figure resting on an older count, so it
      // must not be announced as "not counted". Hidden from operations is not actionable —
      // take-inventory will never list it again. Rolling any into the others misled the accountant.
      const hidden  = carried.filter(c => c.inactive);
      const missed  = carried.filter(c => !c.inactive && c.full);
      const partial = carried.filter(c => !c.inactive && !c.full);
      const bits = [];
      if (missed.length)  bits.push(missed.length + ' product' + (missed.length === 1 ? ' was' : 's were')
        + ' not counted on ' + asOf.countDate);
      if (partial.length) bits.push(partial.length + ' product' + (partial.length === 1 ? ' was' : 's were')
        + ' partly carried forward from an earlier count');
      if (hidden.length)  bits.push(hidden.length + ' product' + (hidden.length === 1 ? ' is' : 's are')
        + ' hidden from operations and can no longer be counted');
      rows.push(this._lineRow('Carried forward - ' + which + ': ' + bits.join(', and ')
        + '. The last counted figure was used for ' + (carried.length === 1 ? 'it' : 'each')
        + '. Everything else is from that count.', colCount));
      mergeFull(rows.length - 1);
      carried.forEach(c => {
        const how = c.inactive ? ' - hidden from operations, last counted '
                  : c.full     ? ' - carried forward from '
                  :              ' - partly carried forward from ';
        rows.push(['  ' + (c.name || 'Unnamed product') + how + c.date, c.value, '', '', ''].slice(0, colCount));
      });
    }
    if (uncosted.length) {
      // ⚠ UNCOSTED PRODUCTS (S136): real units on the shelf with no unit cost recorded, so they sum
      // to $0 here. Disclose them, or the sheet silently understates ending inventory (Line 41).
      // ⚠ LABELLED with `which` (S94, round-N+1 scan): _pushCarriedNote is called twice (Beginning +
      // Ending), so an unlabelled uncosted block printed two identical unreadable copies — the exact
      // failure the carried headline was labelled to stop.
      rows.push(this._lineRow('Uncosted - ' + which + ': ' + uncosted.length + ' product' + (uncosted.length === 1 ? ' has' : 's have')
        + ' units on hand but no unit cost recorded, so ' + (uncosted.length === 1 ? 'it is' : 'they are')
        + ' valued at $0 here. Enter ' + (uncosted.length === 1 ? 'its' : 'their')
        + ' cost in Product Setup to include ' + (uncosted.length === 1 ? 'it' : 'them') + '.', colCount));
      mergeFull(rows.length - 1);
      uncosted.forEach(u => {
        rows.push(['  ' + (u.name || 'Unnamed product') + ' - no unit cost, ' + (u.onHand || 0) + ' on hand at $0',
          0, '', '', ''].slice(0, colCount));
      });
    }
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
    const inMonth = (d) => d && String(d).slice(0, 7) === monthKey;
    const purchases = (App.inventoryData?.ic_deliveries || [])
      .filter(d => inMonth(d.date))
      .reduce((s, d) => s + (parseFloat(d.total) || 0), 0);

    // ⚠ THE BOUNDARY COUNTS COME FROM THE READER, NOT FROM A SECOND DERIVATION HERE (S96). This
    // used to re-sort ic_counts by date alone and take `.slice(-1)[0]`, which ties on two counts
    // sharing a date and returns whichever sat last in the array, while inventoryValueAsOf sorts
    // with cmpNewest and tiebreaks on created_at — so the figure and the Source footer could name
    // DIFFERENT counts. One door, the same lesson as App.computeUsagePair.
    const beginAsOf   = App.inventoryValueAsOf(periodStart, true);   // strictly BEFORE the period
    const endAsOf     = App.inventoryValueAsOf(periodEnd);
    const endingCount    = endAsOf.count;
    const beginningCount = beginAsOf.count;

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

    // Schedule C COGS math.
    // ⚠ Valued through App.inventoryValueAsOf, NOT a count's stored `total_value`.
    // A count that SKIPPED products stores them at 0 (ic-take-inventory gives a skipped
    // row total 0, so value 0, and total_value is a flat sum over every item), so the
    // ending figure read light and COGS came out HIGH — overstating cost of goods and
    // understating taxable profit, on the sheet an accountant transcribes. The as-of
    // reader carries a skipped product forward at its last counted value, which is what
    // the Inventory dashboard has always done, so the two finally agree.
    const beginValue  = beginAsOf.value;
    const endingValue = endAsOf.value != null ? endAsOf.value : 0;
    const calcCogs    = (beginValue != null) ? (beginValue + purchases - endingValue) : null;

    rows.push(['Schedule C COGS Math (for the accountant)', '', '', '', '']);
    rows.push(['  Beginning Inventory (count dated ' + (beginningCount?.date || 'none on file') + ')', beginValue, '', '', '']);
    rows.push(['  Plus Purchases (from receive-delivery log this month)', purchases, '', '', '']);
    rows.push(['  Less Ending Inventory (count dated ' + endingCount.date + ')', endingValue != null ? -endingValue : null, '', '', '']);
    rows.push(['  Cost of Goods Sold (calculated)', calcCogs, '', '', '']);
    // The DISCLOSE half of the rule: a carried-forward figure is honest only if the
    // accountant can see which products rest on an older count, and how old.
    this._pushCarriedNote(rows, merges, beginAsOf, COL_COUNT, 'Beginning inventory');
    this._pushCarriedNote(rows, merges, endAsOf, COL_COUNT, 'Ending inventory');
    rows.push(this._lineRow('Note: this is the count-based Schedule C COGS (beginning + purchases - ending). It will not exactly match the Total COGS on the Income Statement, which is summed from your weekly numbers. The count-based figure here is the more accurate physical cost of goods. Give your accountant both.', COL_COUNT));
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: COL_COUNT - 1 } });
    rows.push(blank());

    // Subtotal by category.
    // ⚠ Built from the SAME as-of picture as the COGS math above, not from
    // `endingCount.items` raw. Reading the raw list summed every SKIPPED product in as
    // a real 0, so a category subtotal silently lost the value of anything the operator
    // did not get to — and the subtotals then disagreed with the Total Ending Inventory
    // printed directly beneath them.
    const prodById = {};
    ((App.inventoryData?.ic_products) || []).forEach(p => { if (p && p.id) prodById[p.id] = p; });
    // S134: keep the whole carried ENTRY (not just the id) so the Bottle Detail can say whether the
    // product is FULLY or only PARTLY carried — labelling a part-carried product's whole figure as
    // "carried forward" contradicted the carried note four rows above it. S136: the uncosted set.
    const carriedById = {};
    ((endAsOf.carried) || []).forEach(c => { if (c && c.id) carriedById[c.id] = c; });
    const uncostedIds = new Set(((endAsOf.uncosted) || []).map(u => u.id));
    const items = Object.keys(endAsOf.byProduct || {}).map(pid => {
      const r = endAsOf.byProduct[pid];
      const p = prodById[pid] || {};
      const src = (endingCount.items || []).find(i => i && i.product_id === pid) || {};
      return {
        product_id: pid,
        // ⚠ `r.name` / `r.category` are the LAST fallback and they matter: a carried-only product
        // is in neither ic_products (deleted) nor this count, so both other lookups come back
        // empty and the row printed blank under an "Uncategorized" subtotal (S95).
        name:      p.name || src.name || r.name || '',
        category:  p.category || src.category || r.category || '',
        total:     r.onHand || 0,
        // ⚠ DERIVED from the figures actually printed on this row (S91). `value` comes from the
        // count, so reading unit cost off the LIVE product made Units x Unit Cost stop equalling
        // Extended Value after any vendor price move — every extension on the supporting schedule
        // failing to foot, which is what an accountant spot-checks first. Deriving it also gives a
        // carried-only product a real unit cost instead of $0.00 beside a real extended value.
        unit_cost: r.onHand ? (r.value / r.onHand)
                   : (r.unitCost != null ? r.unitCost
                      : (p.unit_cost != null ? p.unit_cost : src.unit_cost)),
        value:     r.value || 0,
        carried:     !!carriedById[pid],
        carriedFull: carriedById[pid] ? !!carriedById[pid].full : false,
        carriedFrom: (carriedById[pid] || {}).date || '',
        uncosted:    uncostedIds.has(pid)
      };
    });
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
    // No grand-total Units: each category counts in its own unit (cases, bottles,
    // kegs, lbs), so summing them is a meaningless number. Only the dollar value
    // totals across categories.
    rows.push(['Total Ending Inventory', '', endingValue, '', '']);
    rows.push(blank());

    // Bottle-level detail.
    // ⚠ A product the count SKIPPED used to print here as "0 units - $0.00", which
    // reads as counted-and-found-empty rather than not-counted. It now shows its
    // carried-forward figure with the date it was last counted appended to the name,
    // so no line on this sheet claims a measurement that was never taken.
    rows.push(['Bottle Detail', '', '', '', '']);
    rows.push(['Product', 'Category', 'Units', 'Unit Cost', 'Extended Value']);
    items.slice().sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''))
      .forEach(it => {
        // S134/S136: FULLY carried vs PARTLY carried vs uncosted are three different facts and the
        // row must not overstate any of them (a part-carried row used to claim the whole figure was
        // carried, contradicting the note).
        let tag = '';
        if (it.uncosted) tag = ' (no unit cost recorded)';
        else if (it.carried) tag = it.carriedFull ? ' (carried forward from ' + it.carriedFrom + ')'
                                                   : ' (partly carried forward from ' + it.carriedFrom + ')';
        const label = (it.name || '') + tag;
        rows.push([label, it.category || '', parseFloat(it.total) || 0, parseFloat(it.unit_cost) || 0, parseFloat(it.value) || 0]);
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

    // ⚠⚠ KEYED ON DATE ALONE (S27f / S81 / S44). This used to be `date|shift_type`, and shift_type
    // is DEAD on the variance side: every sc_shifts row is stamped 'Full Day' (pos-ingest.js:376,
    // settings.js:2524/2544) while every sc_variances row is '' (pos-ingest.js:500) or never set at
    // all (the hand path). So the key compared 'date|Full Day' against 'date|' and the join NEVER
    // matched — measured 0 of 2 rows. Every shift row printed blank Expected / Counted / Variance /
    // Status / Reason, and every count was re-listed underneath with a blank Total Revenue: a
    // four-register bar got five rows a day that never lined up, on the sheet this file calls the
    // documentation the IRS looks for in a cash-heavy business.
    // The relationship is ONE-TO-MANY anyway — one shift row a day, one count per REGISTER — so no
    // single shared key could have joined them one-to-one even with shift_type alive.
    const vIndex = {};
    variances.forEach(v => {
      const k = v.date || '';
      if (!vIndex[k]) vIndex[k] = [];
      vIndex[k].push(v);
    });
    // Which variance RECORDS the shift block below has already printed. Tracked by id, not by key:
    // the block consumes every count for a date it printed, and a key-based test would either
    // re-print them or hide a genuinely orphaned one.
    const accounted = new Set();

    const blank = () => this._blankRow(COL_COUNT);
    const rows = [];
    const merges = [];

    // Row 1: Title merged across all 9 columns so the bar name never gets clipped
    rows.push(this._lineRow(this._baseTitle('Cash Reconciliation', monthKey), COL_COUNT));
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: COL_COUNT - 1 } });
    rows.push(blank());

    // "Shift / Register": the rows are now one per REGISTER, and shift_type is 'Full Day' on every
    // row it could come from, so labelling the column "Shift" alone named the least useful of the
    // two things it can hold.
    rows.push(['Date', 'Shift / Register', 'Manager', 'Total Revenue', 'Expected Cash', 'Counted Cash', 'Variance', 'Status', 'Reason']);

    let totalRev = 0, totalExp = 0, totalCnt = 0, totalVar = 0;
    const sortedShifts = shifts.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (sortedShifts.length === 0 && variances.length === 0) {
      rows.push(this._lineRow('(no shifts or cash variances logged this month)', COL_COUNT));
      merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: COL_COUNT - 1 } });
    } else {
      sortedShifts.forEach(s => {
        const rev = parseFloat(s.total_revenue) || 0;
        const vs = vIndex[s.date || ''] || [];
        totalRev += rev;   // once per DAY, never once per register
        if (!vs.length) {
          // A day that was traded but never counted. BLANK cash cells, not 0.00 — printing zero
          // states the drawer was counted and found empty, which is the same lie the orphan branch
          // below was fixed for (S27d).
          rows.push([s.date || '', s.shift_type || '', s.manager || '', rev, null, null, null, '', '']);
          return;
        }
        // ⚠ ONE ROW PER REGISTER, not `(vIndex[k] || [])[0]`. A day carries one count per register,
        // so taking the first silently dropped every other drawer off the reconciliation. The day's
        // revenue rides on the FIRST row only, or a four-register day multiplies it by four.
        vs.forEach((v, i) => {
          // The null-safe shape the orphan branch already uses: buildCash leaves expected/counted
          // absent when the POS report carried only an Over/Short column, and `|| 0` would print
          // $0.00 for a figure we simply do not have. The VARIANCE is always real, so it still totals.
          const exp = v.expected_cash != null ? (parseFloat(v.expected_cash) || 0) : null;
          const cnt = v.counted_cash  != null ? (parseFloat(v.counted_cash)  || 0) : null;
          const varc = parseFloat(v.variance) || ((cnt != null && exp != null) ? (cnt - exp) : 0);
          rows.push([s.date || '', v.drawer || s.shift_type || '', v.cashier || s.manager || '',
                     i === 0 ? rev : null, exp, cnt, varc, v.status || '', v.reason || '']);
          if (exp  != null) totalExp += exp;
          if (cnt  != null) totalCnt += cnt;
          if (varc != null) totalVar += varc;
          if (v.id != null) accounted.add(v.id);
        });
      });

      // Counts with no shift row for that date. Tested by RECORD ID against what the block above
      // actually printed — the old key-based test could not survive the join being keyed on date.
      variances.forEach(v => {
        if (v.id != null && accounted.has(v.id)) return;
        // ⚠ NULL, not 0. buildCash leaves expected/counted absent when the POS report carried only
        // an Over/Short column. Printing $0.00 on the Cash Reconciliation sheet — the one this file
        // calls "the documentation the IRS looks for in a cash-heavy business" — states that the
        // drawer was empty. hub-year-end.js:871 already uses `|| null` for these same fields.
        // The VARIANCE is always real, so it still totals; only the two figures we may not have are
        // withheld, and they only reach the totals when they exist.
        const exp = v.expected_cash != null ? (parseFloat(v.expected_cash) || 0) : null;
        const cnt = v.counted_cash  != null ? (parseFloat(v.counted_cash)  || 0) : null;
        const varc = parseFloat(v.variance) || ((cnt != null && exp != null) ? (cnt - exp) : 0);
        rows.push([v.date || '', v.shift_type || '', v.cashier || '', null, exp, cnt, varc, v.status || '', v.reason || '']);
        // Same guards the shift-joined block above already uses: a figure we do not have does not
        // enter the totals (and must not turn them into NaN).
        if (exp  != null) totalExp += exp;
        if (cnt  != null) totalCnt += cnt;
        if (varc != null) totalVar += varc;
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
        // Hours: a logged 0 is data, not absence. `parseFloat(x) || null` blanked both
        // (twin of the Year-End Cash Control fix) — on an 8027-facing sheet a blank Hours
        // cell reads as "not recorded" when the log actually says zero.
        const hrs = parseFloat(t.hours);
        rows.push([t.date || '', t.name || '', t.shift_type || '', isNaN(hrs) ? null : hrs, total]);
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
      rows.push(this._lineRow('Tips Reported here is net of tip-out, what each person keeps after tipping out support staff. The Per-Employee Tip Detail above is gross, before tip-out.', COL_COUNT));
      mergeFull(rows.length - 1);
      rows.push(['Employee', 'Hours', 'Tips Reported', 'Share of Hours', 'Suggested Allocation (Line 7a x share)']);
      const totalHours = Object.values(byEmp).reduce((s, e) => s + e.hours, 0);
      Object.keys(byEmp).sort().forEach(name => {
        const e = byEmp[name];
        const share = totalHours > 0 ? (e.hours / totalHours) : 0;
        const suggested = line7a * share;
        rows.push([name, e.hours, e.tips, share, suggested]);
      });
      // NO HOURS ON FILE = NO BASIS TO SPLIT ON, and the sheet has to say so. Every share
      // falls to 0, so this column prints $0.00 for everyone while Line 7a above still shows
      // a real figure that has to be allocated — an accountant gets told to allocate $1,020
      // and handed a column that adds to nothing, with nothing on the page explaining why.
      // Reachable day one: hours auto-fill from logged or scheduled hours, so an operator who
      // logs tips before setting up Labor has none.
      // ⚠ DO NOT "fix" this by spreading Line 7a evenly. Inventing an allocation basis on an
      // IRS worksheet is worse than an empty column that says why it is empty.
      if (totalHours <= 0 && line7a > 0) {
        rows.push(this._lineRow('No tippable hours are on file for this month, so Bar Cop cannot suggest a split. Line 7a above still has to be allocated. Add hours on the Tip Log and this column fills in, or your accountant can allocate it another way.', COL_COUNT));
        mergeFull(rows.length - 1);
      }
    }

    this._pushFooter(rows, merges,
      'Source: Labor Control tip pool splits when saved per shift (taxable allocation per employee), tip log entries for shifts without a saved pool, and Shift Control shifts for gross receipts.',
      COL_COUNT);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const moneyFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
    const pctFmt   = '0.0%';
    const hoursFmt = '#,##0.0';
    rows.forEach((row, i) => {
      // Per-employee monthly-totals rows have col1 = HOURS (not money), col3 = share
      // (0..1), col4 = money. Everything before them is Form 8027 line rows (col1 = money).
      const isEmpRow = i > allocStartIdx && typeof row[3] === 'number' && row[3] >= 0 && row[3] <= 1 && typeof row[4] === 'number';
      // Col 1 is money on the 8027 line rows but HOURS on the per-employee rows — never
      // stamp "$" on an hours cell (the annual builder guards this the same way).
      const c1 = XLSX.utils.encode_cell({ r: i, c: 1 });
      if (ws[c1] && typeof ws[c1].v === 'number') ws[c1].z = isEmpRow ? hoursFmt : moneyFmt;
      // For per-employee allocation rows (col 3 = share <= 1, col 4 = money)
      if (isEmpRow) {
        // Col 2 is "Tips Reported" — MONEY, and it was the one money cell on this sheet that no
        // format pass touched, so it rendered as a raw float (1234.5600000000002) on an IRS
        // worksheet. Same gap existed in the annual builder; both fixed together.
        const c2 = XLSX.utils.encode_cell({ r: i, c: 2 });
        if (ws[c2] && typeof ws[c2].v === 'number') ws[c2].z = moneyFmt;
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

    // Usage per product via App.computeUsagePair, the canonical reader. This was a local copy that
    // summed multiple locations correctly but ignored counted:false, so a product the operator
    // SKIPPED in the closing count read as a real zero and its whole shelf was exported to the
    // accountant as usage. computeUsagePair also drops any product without a real value at BOTH
    // ends, which is what an honest variance period needs.
    const pair = App.computeUsagePair(startCount, endCount, App.inventoryData?.ic_deliveries || []);
    const detail = Object.keys(pair).map(pid => {
      const u = pair[pid];
      return {
        name: u.name, category: u.category,
        startQty: u.starting, purchQty: u.purchases, endQty: u.ending, usedQty: u.rawUsed,
        usedValue: u.unitCost != null ? u.rawUsed * u.unitCost : 0
      };
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
    const byPos = {}, byStaff = {}, posBySid = {};
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
      // Key exactly the way otPremiumForRows/otPremiumInWindow bucket, or a row with no
      // staff_id AND no name keys here as '(unknown)' and there as '?', the premium
      // attaches to no staff row and no position, and Total Wages Paid ends up larger
      // than the sum of its own breakdowns on a sheet handed to an accountant.
      const sid = App.otStaffKey(a);
      posBySid[sid] = pname;
      if (!byStaff[sid]) byStaff[sid] = { name: a.name || '(unknown)', position: pname, hours: 0, wages: 0 };
      byStaff[sid].hours += hours;
      byStaff[sid].wages += cost;
    });

    // lc_actuals hold straight time only (cost = hours x wage), so the 0.5x weekly
    // overtime premium has to be added here or Total Wages Paid hands the accountant a
    // payroll figure light by the whole premium on any week someone crossed 40 hours.
    // Attributed back to the same staff and position that carried the hours.
    // Measured over WHOLE weeks from the UNFILTERED actuals, then allocated to this
    // month. `actuals` is already cut to the calendar month, and overtime is a weekly
    // threshold: a week straddling the month boundary was split into two part-weeks,
    // each tested against 40 on its own, so neither drew a premium and the month came
    // back light. Up to two straddling weeks every month, on the accountant's sheet.
    const allActuals = (App.laborData?.lc_actuals || []);
    const monthStart = this._monthStartDate(monthKey);
    const monthEnd   = this._monthEndDate(monthKey);
    const otPrem = App.otPremiumInWindow ? App.otPremiumInWindow(allActuals, monthStart, monthEnd) : { total: 0, byStaff: {} };
    Object.keys(otPrem.byStaff || {}).forEach(sid => {
      const prem = otPrem.byStaff[sid] || 0;
      const pname = posBySid[sid];
      if (pname && byPos[pname]) byPos[pname].wages += prem;
      if (byStaff[sid]) byStaff[sid].wages += prem;
    });
    totalWages += otPrem.total;

    // Salaried (exempt) management is paid a fixed weekly salary with no
    // lc_actuals rows, so without this Total Wages Paid and Labor % of Revenue
    // understate the real spend and disagree with Payroll and the Revenue
    // dashboards for the same month. Accrued day-for-day across the month.
    const _ms = new Date(monthStart + 'T00:00:00');   // monthStart/monthEnd hoisted above
    const salWeeks = (Math.round((new Date(monthEnd + 'T00:00:00').getTime() - _ms.getTime()) / 86400000) + 1) / 7;
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
    rows.push(this._lineRow('This sheet totals wages from logged hours by calendar month and accrues salary by days-in-month, measured against POS shift revenue (bar and food). The Income Statement labor is built from confirmed weekly records (a week is booked whole to the month it ends in) and its labor percent is measured against net sales, which also includes catering and ancillary revenue. So the two Total Labor figures can differ by a partial straddling week and the salary accrual method, and the two Labor Percent figures can differ by that revenue base. Both are correct on their own basis.', COL_COUNT));
    mergeFull(rows.length - 1);
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
    const cashAudit = latestBefore(App.data?.cash_audits);

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
    renderAudit('Cash Recovery', cashAudit);

    this._pushFooter(rows, merges,
      'Source: latest Profit, Revenue, and Cash audits at or before ' + monthEnd + '. Action items and their dollar impacts come from the audit you ran in Bar Cop.',
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
    // ⚠ Boundary counts come from the reader (S96) — see _buildInventoryValuation for why a second
    // date-only derivation here could name a different count than the figure came from.
    // Same as-of basis as the monthly sheet — a skipped product carries forward rather
    // than reading as an empty shelf. See _buildInventoryValuation for why.
    const beginAsOfY = App.inventoryValueAsOf(yearStart, true);
    const endAsOfY   = App.inventoryValueAsOf(yearEnd);
    const beginCount = beginAsOfY.count;
    const endCount   = endAsOfY.count;
    const beginValue = beginAsOfY.value;
    const endValue   = endAsOfY.value;

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
    rows.push(['Line 2: Returns and allowances', 0, 'Line 1 is net sales; comps are tracked in Shift Control, not income or a return', '']);
    rows.push(['Line 3: Subtract Line 2 from Line 1', YTD.totalRev, 'Calculated', '']);
    rows.push(['Line 4: Cost of goods sold', calcCogs != null ? calcCogs : YTD.totalCogs, calcCogs != null ? 'Begin + purchases - end' : 'Sum of Profit weekly COGS (no end-of-year count on file)', '']);
    rows.push(['Line 5: Gross profit (Line 3 minus Line 4)', YTD.totalRev - (calcCogs != null ? calcCogs : YTD.totalCogs), 'Calculated', '']);
    rows.push(blank());
    // Operating-expense deductions by Schedule C line, from the Operating Expenses
    // log by category (the header promised these; they were previously omitted, so an
    // accountant transcribing this sheet lost every deduction except wages and
    // repairs). Listed in IRS line-number order.
    const opexY = (this._opExSums ? this._opExSums(year + '-12', true) : {}) || {};
    const ov = k => opexY[k] || 0;
    rows.push(['Line 8: Advertising', ov('Marketing and Advertising'), 'Operating Expenses: Marketing and Advertising', '']);
    rows.push(['Line 10: Commissions and fees', ov('Bank and Credit Card Fees') + (YTD.platformFees || 0), 'Operating Expenses: bank / credit card fees + 3rd-party platform fees', '']);
    rows.push(['Line 15: Insurance (other than health)', ov('Insurance'), 'Operating Expenses: Insurance', '']);
    rows.push(['Line 17: Legal and professional services', ov('Professional Fees'), 'Operating Expenses: Professional Fees', '']);
    rows.push(['Line 20b: Rent or lease (other business property)', ov('Occupancy (Rent, Property Tax)'), 'Operating Expenses: Occupancy (rent, property tax)', '']);
    rows.push(['Line 21: Repairs and maintenance', YTD.maintenance, 'Sum of Shift Control maintenance log for ' + year, '']);
    rows.push(['Line 23: Taxes and licenses', ov('Licenses and Permits'), 'Operating Expenses: Licenses and Permits', '']);
    rows.push(['Line 25: Utilities', ov('Utilities'), 'Operating Expenses: Utilities', '']);
    rows.push(['Line 26: Wages (less employment credits)', YTD.totalLabor, 'Sum of Labor Control wages for ' + year, '']);
    rows.push(['Line 27a: Other expenses', ov('Software and Subscriptions') + ov('Other'), 'Operating Expenses: software / subscriptions + other', '']);
    rows.push(blank());

    rows.push(['Part III: Cost of Goods Sold Detail', '', '', '']);
    rows.push(['Line 35: Beginning inventory', beginValue, beginCount ? ('Count dated ' + beginCount.date) : 'No count on file before ' + yearStart, '']);
    rows.push(['Line 36: Purchases', purchases, 'Sum of receive-delivery records for ' + year, '']);
    rows.push(['Line 41: Ending inventory', endValue, endCount ? ('Count dated ' + endCount.date) : 'No count on file at or before ' + yearEnd, '']);
    rows.push(['Line 42: Cost of goods sold (35 + 36 - 41)', calcCogs,
      calcCogs != null ? 'Calculated'
        : 'Cannot be computed without a beginning-of-year count; Line 4 uses weekly-summed COGS instead', '']);
    // ⚠ FOOTING DISCLOSURE (S138, Kyle's call 2026-07-25: keep both + disclose). With no beginning
    // count the count-based COGS (35 + 36 - 41) is uncomputable, so Line 42 is left blank while Line 4
    // falls back to the weekly-summed figure — Part III then does not foot to Part I. Say so plainly
    // rather than force a false consistency (mirroring Line 42 to the weekly figure would break Part
    // III's own 35 + 36 - 41 = 42 math instead).
    if (calcCogs == null) {
      rows.push(this._lineRow('Note: with no inventory count on file before ' + yearStart
        + ', the count-based Cost of Goods Sold (Line 42 = Line 35 + Line 36 - Line 41) cannot be computed and is left blank. Line 4 above instead uses your weekly-summed COGS so Part I still carries a figure; Part I and Part III will not foot until a beginning-of-year count exists. Give your accountant both.', COL_COUNT));
      mergeFull(rows.length - 1);
    }

    // ⚠ THE DISCLOSE HALF (S90). Lines 35 and 41 route through App.inventoryValueAsOf, which
    // carries a skipped product forward at its last counted value — and this sheet said nothing
    // about it, on the one document whose rows are labelled with literal Schedule C line numbers
    // and transcribed straight onto a tax return. Worse, _pushCarriedNote's own comment claimed
    // it was "Shared by the Books monthly sheet, the Books Year-End Tax Helper and the Year End
    // export, so the three cannot drift" — it was never called from here at all.
    this._pushCarriedNote(rows, merges, beginAsOfY, COL_COUNT, 'Beginning inventory');
    this._pushCarriedNote(rows, merges, endAsOfY, COL_COUNT, 'Ending inventory');

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
