'use strict';

/* ── Profit Recovery — Profit Forecast ────────────────────────────────────────
   A forward projection of profit, run-rated from your real saved weeks. Two
   scenarios side by side: at your CURRENT pace (recent prime cost %) and at
   YOUR cost TARGETS. The swing between them is what tightening up is worth, and
   it points straight at Profit Fix. Mirrors Books' profit basis so the two
   never disagree: Profit = Sales − Prime Cost (COGS + Labor) − Operating Costs
   (operating expenses + platform fees). Everything is a clearly-labeled
   estimate, never actuals. Whole dollars (projection precision). */

S.ProfitForecast = {
  horizon: 'half',
  HORIZONS: [
    { v: 'month',   label: 'Next Month',    weeks: 52 / 12 },
    { v: 'quarter', label: 'Next Quarter',  weeks: 13 },
    { v: 'half',    label: 'Next 6 Months', weeks: 26 },
    { v: 'year',    label: 'Next Year',     weeks: 52 }
  ],
  RUN_WEEKS: 12,   // recent window for the sales + prime-cost run-rate
  MIN_WEEKS: 3,    // honesty gate — need a few weeks for a real run-rate
  MIN_OPEX_WEEKS: 4,  // need about a month of opex history before projecting lumpy bills

  weeks()   { return (App.data.weeks || []).filter(w => w.period_end); },
  /* ⛔ OPERATING expenses only. Since the one-ledger merge this array also holds owner draws, loan
     payments, capital buys and tax remittances — money that leaves the bank but is NOT an operating
     cost. Unfiltered, every one of them was averaged into `avgWeeklyOpex` in `runRates()` and
     subtracted from both projection scenarios, so the projected Operating Profit was low by the
     whole of an owner's draw. Same predicate the P&L, break-even and the cash engine use. */
  opexLog() {
    const rows = (App.data.operating_expenses || []);
    return rows.filter(r => !S.HubOperatingExpenses.isCashOnlyCategory(r && r.category));
  },
  targets() { return (App.data.settings.targets || {}); },
  horizonWeeks() { return (this.HORIZONS.find(h => h.v === this.horizon) || this.HORIZONS[2]).weeks; },

  // Build run-rates from real held history.
  runRates() {
    const recent = this.weeks().slice()
      .sort((a, b) => (b.period_end || '').localeCompare(a.period_end || ''))
      .slice(0, this.RUN_WEEKS);
    const nW = recent.length;
    /* ⛔⛔ `sumPF` / `avgWeeklyPF` CAME OUT HERE (build piece 2), AND THEY WERE A LIVE DOUBLE COUNT.
       The weekly `platform_fees` field was mirrored into the ledger as a `3rd-Party Platform Fees`
       expense row, and `opexLog()` excludes only cash-only categories — so the commission was
       already inside `avgWeeklyOpex` while `opexTot` added `avgWeeklyPF` on top of it. Measured on
       the deployed build: avg weekly opex $2,846.59 -> $3,147.16 the moment a login's reconcile
       ran, with avgWeeklyPF unchanged at $308.98 beside it. One source now: the ledger. */
    let sumRev = 0, sumCogs = 0, sumLabor = 0;
    // Every line Books' income statement carries: bar + food + catering + ancillary,
    // matching hub-books' totalRev / totalCogs / totalLabor exactly. This summed bar+food
    // ONLY while comparing the result against prime_cost_pct, which is a TOTAL-SALES
    // basis target, and while the header above promised it "mirrors Books' profit basis
    // so the two never disagree". On a catering bar it read 52.0% here against 50.5% on
    // Confirm the Week, the dashboard and Books, and Projected Sales run-rated the bar
    // and kitchen alone. (Ancillary has revenue and COGS but no labor line, same as
    // Books.) See [[labor-cost-model]] DENOMINATORS: a % is only comparable to a target
    // measured on the same denominator.
    recent.forEach(w => {
      sumRev   += (w.bar?.revenue || 0) + (w.food?.revenue || 0) + (w.catering?.revenue || 0) + (w.other?.revenue || 0);
      sumCogs  += (w.bar?.cogs   || 0) + (w.food?.cogs   || 0) + (w.catering?.cogs   || 0) + (w.other?.cogs || 0);
      sumLabor += (w.bar?.labor  || 0) + (w.food?.labor  || 0) + (w.catering?.labor  || 0);
    });
    const avgWeeklyRev    = nW ? sumRev / nW : 0;
    const primePctCurrent = sumRev ? (sumCogs + sumLabor) / sumRev : 0;   // 0..1

    // Operating expenses: average per week across the span you have logged them
    // (trailing 12 months). Lumpy bills (rent monthly, insurance annual) smooth
    // out over the span. Books reads these same records.
    const today   = App.todayLocal();
    const yearAgo = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - 364); return App.ymdLocal(d); })();
    const ox = this.opexLog().filter(r => r && r.date && r.amount != null && String(r.date).slice(0, 10) >= yearAgo);
    // Operating costs are lumpy (rent monthly, insurance annual). A run-rate from
    // only a week or two of history would treat one big bill as if it repeated
    // every week and blow up the projection, so opex is included only once there
    // is enough span to average it honestly; below that we project profit BEFORE
    // operating costs and say so.
    let avgWeeklyOpex = 0, opexLogged = false, opexShort = false;
    if (ox.length > 0) {
      const sumOx    = ox.reduce((t, r) => t + (parseFloat(r.amount) || 0), 0);
      const earliest = ox.reduce((m, r) => { const d = String(r.date).slice(0, 10); return d < m ? d : m; }, '9999-12-31');
      const spanWeeks = (new Date(today + 'T00:00:00') - new Date(earliest + 'T00:00:00')) / 86400000 / 7;
      if (spanWeeks >= this.MIN_OPEX_WEEKS) { avgWeeklyOpex = sumOx / spanWeeks; opexLogged = true; }
      else opexShort = true;
    }
    return { nW, avgWeeklyRev, primePctCurrent, avgWeeklyOpex, opexLogged, opexShort };
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';   // header off; actions live in the page
    this.renderMain();
  },

  renderMain() {
    const rr = this.runRates();

    // Day-one / honesty gate: not enough confirmed weeks for a run-rate.
    if (rr.nW < this.MIN_WEEKS) {
      App.setupCard(this.container, {
        title: 'Profit Forecast',
        lead: 'Once you have a few weeks confirmed, Bar Cop projects your profit forward at your current pace and at your cost targets, so you can see what tightening up is worth. You have ' + rr.nW + ' week' + (rr.nW === 1 ? '' : 's') + ' saved so far.',
        steps: [
          { title: 'Confirm your weeks', desc: 'Confirm each week from the Profit dashboard. A few weeks gives an honest run-rate.', btn: 'Confirm the Week', screen: 'dashboard', done: rr.nW > 0 },
          { title: 'Set your cost targets', desc: 'Your prime cost target drives the at-target scenario.', btn: 'App Settings', screen: 'settings', done: false }
        ]
      });
      this.container.onclick = ev => { const go = ev.target.closest('.setup-go'); if (go && go.dataset.go) App.openScreen(go.dataset.go); };
      return;
    }

    const hw       = this.horizonWeeks();
    const targetP  = (this.targets().prime_cost_pct ?? 60) / 100;
    const sales    = rr.avgWeeklyRev * hw;
    // ONE operating-cost term. It used to read `(rr.avgWeeklyOpex + rr.avgWeeklyPF)`, and the
    // commission was already inside the first — see `runRates` above.
    const opexTot  = rr.avgWeeklyOpex * hw;
    const primeCur = sales * rr.primePctCurrent;
    const primeTgt = sales * targetP;
    const profitCur = sales - primeCur - opexTot;
    const profitTgt = sales - primeTgt - opexTot;
    const swing     = Math.max(0, profitTgt - profitCur);
    const profitLabel = rr.opexLogged ? 'Operating Profit' : 'Profit Before Operating Costs';
    const money = n => App.fmtCurrency(n, 0);

    // ── Stat strip ──
    const stat = (label, val, cls, style) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg' + (cls ? ' ' + cls : '') + '"' + (style || '') + '>' + val + '</div></div>';
    const statStrip = '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Projected Sales', money(sales))
      + stat('Profit at Current Pace', money(profitCur), profitCur < 0 ? 'warn' : '')
      + stat('Profit at Targets', money(profitTgt), profitTgt < 0 ? 'warn' : '')
      /* ⚠ "+$0" IS NOT AN ANSWER. `swing` is clamped at zero, so a bar already running BETTER
         than its targets printed "Target Upside +$0" next to two columns $8,777 apart, which
         reads as broken rather than as good news. Three genuinely different states, three
         labels: money on the table (gold, it is a call to action), already ahead (neutral —
         gold is for opportunity, not for doing well), and exactly on target. */
      + (swing > 0
          ? stat('Target Upside', '+' + money(swing), '', ' style="color:var(--gold);"')
          : (profitCur > profitTgt
              ? stat('Ahead of Target', money(profitCur - profitTgt))
              : stat('Target Upside', 'On target')))
      + '</div></div>';

    // ── Horizon chips (left) + Export (right) ──
    const chips = App.filterChips(this.horizon, this.HORIZONS.map(h => ({ v: h.v, label: h.label })), 'pf-horizon-chip');
    const chipRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 14px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="pf-export">Export PDF</button></div>';

    // ── Breakdown (Current Pace vs At Your Targets) ──
    const pctTxt = f => (f * 100).toFixed(1) + '%';
    const bRow = (line, cur, tgt, opts) => {
      const o = opts || {};
      return '<tr><td><div class="val"' + (o.bold ? ' style="font-weight:600;"' : '') + '>' + line + '</div></td>'
        + '<td' + (o.bold ? ' style="font-weight:600;"' : '') + (o.curCls ? ' class="' + o.curCls + '"' : '') + '>' + cur + '</td>'
        + '<td' + (o.bold ? ' style="font-weight:600;"' : '') + (o.tgtCls ? ' class="' + o.tgtCls + '"' : '') + '>' + tgt + '</td></tr>';
    };
    const breakdown = '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
      + '<colgroup><col style="width:40%"/><col style="width:30%"/><col style="width:30%"/></colgroup>'
      + '<thead><tr><th>Line</th><th>At Current Pace</th><th>At Your Targets</th></tr></thead><tbody>'
      + bRow('Projected Sales', money(sales), money(sales))
      + bRow('Prime Cost (COGS + Labor)', money(primeCur) + '<span style="color:var(--t3);margin-left:12px;">' + pctTxt(rr.primePctCurrent) + '</span>', money(primeTgt) + '<span style="color:var(--t3);margin-left:12px;">' + pctTxt(targetP) + '</span>')
      + bRow('Operating Costs', money(opexTot), money(opexTot))
      + bRow(profitLabel, money(profitCur), money(profitTgt), { bold: true, curCls: profitCur < 0 ? 'neg' : '', tgtCls: profitTgt < 0 ? 'neg' : '' })
      + '</tbody></table></div>';

    // ── Heads Up: assumptions + disclaimer (standard opaque gold-tint box) ──
    const opexNote = rr.opexLogged ? ''
      : rr.opexShort ? ' You have under a month of operating costs logged, not enough history to project them honestly yet, so this shows profit before operating costs. It fills in as more bills land under Accounting, Operating Expenses.'
      : ' No operating costs are logged yet, so this shows profit before operating costs; add rent, utilities, and the like under Accounting, Operating Expenses, for a true net profit.';
    const assumeTxt = 'Projected from your last ' + rr.nW + ' week' + (rr.nW === 1 ? '' : 's') + ': about ' + money(rr.avgWeeklyRev) + ' a week in sales at a ' + pctTxt(rr.primePctCurrent) + ' prime cost'
      + (rr.opexLogged ? ', plus about ' + money(rr.avgWeeklyOpex) + ' a week in operating costs.' : '.')
      + opexNote
      + ' These are projections in whole dollars built from your own averages, an estimate to plan against, not a guarantee or financial advice.';
    const headsUp = '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-top:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
      + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">' + assumeTxt + '</div>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">' + statStrip + chipRow + breakdown + headsUp + '</div>';

    this.container.querySelectorAll('.pf-horizon-chip').forEach(b => b.addEventListener('click', () => { this.horizon = b.dataset.v; this.renderMain(); }));
    /* ⚠ THE HORIZON DRIVES EVERY NUMBER IN THIS DOCUMENT and it lived only in the `no-print`
       chip row, which the PDF collector skips. Nothing in the body carries a date either (no
       dated weeks are rendered), so a Next Month forecast and a Next Year forecast saved as two
       identical-looking files. Name it in the header. */
    document.getElementById('pf-export')?.addEventListener('click', () => App.exportPDF({
      title: 'Profit Forecast', root: this.container,
      range: App.chipRangeLabel(this.HORIZONS.map(h => ({ v: h.v, label: h.label })), this.horizon)
    }));
  },

  showHowTo() {
    App.showHelpModal('How Profit Forecast Works', [
      { p: ['A look ahead at your profit, projected from the weeks you have already confirmed. It runs two scenarios side by side: where you land at your current pace, and where you would land at your cost targets. The gap between them is what cleaning up is worth.'] },
      { h: 'How the Projection Is Built', p: ['Bar Cop takes your recent weekly sales and prime cost percentage, holds them forward across the window you pick, and subtracts your operating costs (the same expenses Books uses). It is a run-rate estimate from real history, not a promise. Pick Next Month, Quarter, 6 Months, or Year.'] },
      { h: 'Current Pace vs Your Targets', p: ['Current Pace uses your recent prime cost. At Your Targets swaps in your target prime cost from App Settings. The Target Upside up top is the profit difference, the money on the table if you hit your targets. That is exactly what Profit Fix is for. If you are already running better than your targets, that tile reads Ahead of Target and shows by how much instead, which is usually a sign your targets are due a look in App Settings.'] },
      { h: 'Reaching True Profit', p: ['Profit here is sales minus prime cost minus operating costs. If you have not logged operating costs yet, it shows profit before operating costs and tells you so. Log them under Accounting, Operating Expenses, to get the full net number.'] },
      { h: 'Honesty', p: ['Every figure is a projection in whole dollars, built from your own averages. It needs a few weeks of history before it will show. It is a planning tool, not financial advice.'] }
    ]);
  }
};
