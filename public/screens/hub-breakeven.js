'use strict';

/* ── Break-Even — "Your Number" (Books section, Hub-level page) ────────────────
   The one number that runs the business: the sales you need to cover your costs,
   and how you're tracking against it. Bar Cop already holds every input, so it
   just draws the line. FIXED costs (the nut) = your recurring operating-expense
   bills PLUS salaried (exempt) pay, which does not flex with sales. VARIABLE costs
   = COGS + HOURLY labor as a share of sales (S.HubBooks labor includes salaried, so
   it is peeled back out here for the rate; salaried sits in the nut above).
   Break-even = nut / (1 - variable rate). Sidebar page, so it uses a plain top stats strip
   (not the landing-only Where You Stand card). Opened from the Hub Break-Even
   tile and the Books sidebar. */

S.HubBreakEven = {
  container: null,
  _wf: null,
  // Shared column layout so The Nut and The Last 8 Weeks line up column for
  // column: Per Month sits under Sales, Per Week under Break-Even.
  COLS: '<colgroup><col style="width:31%"><col style="width:23%"><col style="width:23%"><col style="width:23%"></colgroup>',

  open() {
    if (App._hubBlocked && App._hubBlocked('hub-books-home')) return;   // Books area gate
    App.openHubFullPage('Break-Even', (mount) => { this.container = mount; this._wf = null; this.render(mount); }, 'breakeven');
  },

  _statItem(label, val, colorStyle) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg"' + (colorStyle ? ' style="' + colorStyle + '"' : '') + '>' + val + '</div></div>';
  },
  _statsCard(items) {
    return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>';
  },
  _sh(t, right) {
    return right
      ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;"><div class="sh" style="margin:0;">' + t + '</div>' + right + '</div>'
      : '<div class="sh" style="margin:24px 0 10px;">' + t + '</div>';
  },

  _compute() {
    const HB = S.HubBooks;
    const curKey = (HB && HB._currentMonthKey) ? HB._currentMonthKey()
      : (new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'));
    const YTD = (HB && HB._aggregateYTD) ? HB._aggregateYTD(curKey) : null;
    const netRev = YTD ? (YTD.totalRev || 0) : 0;   // net sales (comps already excluded); includes catering + other
    const cogs   = YTD ? (YTD.totalCogs || 0) : 0;
    const labor  = YTD ? (YTD.totalLabor || 0) : 0;
    // Books labor includes salaried; the VARIABLE rate must reflect only the hourly
    // (schedulable) labor that flexes with sales. Prefer the hourly split Confirm the
    // Week already stored on each week (revenue_week.hourly_labor_cost, with salaried
    // peeled out at confirm time): summing it needs no roster reconstruction and stays
    // correct across a mid-year salaried hire, raise, or departure. The old code
    // re-derived salaried from TODAY's roster and applied it to every historical week,
    // so a roster change skewed the rate. Fall back to peeling salaried with the
    // current roster only for a week that predates the stored split.
    const _yr = curKey.slice(0, 4), _mn = parseInt(curKey.slice(5, 7), 10);
    const _inYTD = d => d && String(d).slice(0, 4) === _yr && parseInt(String(d).slice(5, 7), 10) <= _mn;
    // Catering labor per week lives on the profit `week` record (revenue_week's
    // hourly_labor_cost is bar+food only). Catering crew is a VARIABLE cost that
    // scales with catering revenue — which is already in netRev along with catering
    // COGS — so it belongs in the variable rate's numerator too.
    const _catLaborByPe = {};
    ((App.data && App.data.weeks) || []).forEach(w => {
      if (w && w.period_end) _catLaborByPe[String(w.period_end).slice(0, 10)] = (w.catering && parseFloat(w.catering.labor)) || 0;
    });
    let hourlyLabor = 0, catLabor = 0;
    ((App.data && App.data.revenue_weeks) || []).filter(w => _inYTD(w.period_end)).forEach(w => {
      const pe = String(w.period_end || '').slice(0, 10);
      const hl = parseFloat(w.hourly_labor_cost);
      if (!isNaN(hl)) {
        // Stored split (bar+food hourly, salaried already peeled): no roster
        // reconstruction, stays correct across a mid-year salaried change. Add the
        // week's catering crew for the rate.
        hourlyLabor += hl;
        catLabor += _catLaborByPe[pe] || 0;
      } else {
        // Pre-split week: total labor (already includes catering) minus salaried.
        const tl = parseFloat(w.total_labor_cost) || 0;
        const sal = App.salariedCost ? (App.salariedCost(App.weekStartFor(pe), pe).total || 0) : 0;
        hourlyLabor += Math.max(0, tl - sal);
      }
    });
    // "Hourly Labor" stat stays bar+food only (accurate label); the rate uses variable
    // labor = bar+food hourly + catering crew.
    const varLabor = hourlyLabor + catLabor;
    const varRate = netRev > 0 ? (cogs + varLabor) / netRev : null;

    const opex = (App.data && App.data.operating_expenses) || [];
    // Match CashEngine.weeklyFixedCosts: drop a recurring bill that has been STOPPED or
    // whose fixed TERM is fully paid, so the break-even nut agrees with Cash Position's
    // reserve target instead of carrying a paid-off loan or canceled bill forever.
    const curYm = App.todayLocal().slice(0, 7);
    const recurring = opex.filter(r => {
      if (!r || !r.recurring || r.recurring_parent) return false;
      if (r.stopped_ym && r.stopped_ym <= curYm) return false;
      const endYm = (window.CashEngine && CashEngine.recurringEndYm) ? CashEngine.recurringEndYm(r) : null;
      if (endYm && endYm < curYm) return false;
      if (String(r.date || '').slice(0, 7) > curYm) return false;   // not started yet — same as the engine
      return true;
    });
    // Normalize each recurring bill by its frequency (monthly/quarterly/annual) so
    // the weekly nut isn't over-weighted by a quarterly or annual bill.
    let annualOpex = recurring.reduce((s, r) => {
      const amt = parseFloat(r.amount) || 0;
      const perYear = r.frequency === 'quarterly' ? 4 : r.frequency === 'annual' ? 1 : 12;
      return s + amt * perYear;
    }, 0);
    /* ⚠⚠ DEBT SERVICE BELONGS IN THE NUT, AND THIS FILE COULD NOT SEE IT (round 4, F3). It built its
       whole fixed-cost figure from the operating-expense log, while loan and equipment payments live
       in the SEPARATE cash_outflows store — and the comment directly above claims this nut "agrees
       with Cash Position's reserve target", which round 3 taught to include them. Measured on the
       Anchor Bar's own data: Cash Position sized its reserve off $4,301.08/wk while this screen's
       Nut read $3,793.38 — the gap is the equipment loan exactly — and BREAK-EVEN SALES, the
       headline number of the page, printed $10,838/wk against a true $12,289/wk. Understated by
       $1,450/wk, which is $75,428 a year, on the one number the page exists to give.
       ⚠ THE JUDGMENT, STATED: loan PRINCIPAL is not a P&L expense, so a pure accounting break-even
       would exclude it. Bar Cop is an operator's tool answering "what do I have to ring to keep the
       doors open", and a bar that misses its equipment payment loses the equipment. It counts.
       ⚠ SAME RULE AND SAME EXCLUSIONS AS CashEngine.weeklyFixedCosts, deliberately: tax is
       collected money passing through (the cash tax hold already reserves it) and a draw is not a
       cost of opening the doors. Two screens, one definition. */
    const debtAnnual = ((App.data && App.data.cash_outflows) || []).reduce((s, o) => {
      if (!o || !o.recurring) return s;
      if (o.type !== 'loan' && o.type !== 'capital') return s;
      if (o.stopped_ym && o.stopped_ym <= curYm) return s;
      const endYm = (window.CashEngine && CashEngine.recurringEndYm) ? CashEngine.recurringEndYm(o) : null;
      if (endYm && endYm < curYm) return s;
      if (String(o.date || '').slice(0, 7) > curYm) return s;   // not started yet — same as the engine
      const perYear = o.frequency === 'quarterly' ? 4 : o.frequency === 'annual' ? 1 : 12;
      return s + (parseFloat(o.amount) || 0) * perYear;
    }, 0);
    annualOpex += debtAnnual;
    const monthlyOpex = annualOpex / 12;
    const weeklyOpex = annualOpex / 52;
    // The nut also carries salaried (exempt) pay: fixed every week like rent. One
    // full week through the canonical salariedCost so it ties to Labor and Cash.
    const beEnd = App.nextSunday ? App.nextSunday() : App.todayLocal();
    const weeklySalaried = (App.salariedCost ? App.salariedCost(App.weekStartFor(beEnd), beEnd).total : 0) || 0;
    const salariedMonthly = weeklySalaried * 52 / 12;
    const monthlyFixed = monthlyOpex + salariedMonthly;
    // ⚠ THE ROWS HAVE TO ADD UP TO THE TOTAL (round 5). The by-category rows are built from the
    // operating-expense list while the Total carries debtAnnual too, so the table printed rows
    // summing to $5,700 under a Total of $7,550 with nothing naming the missing $1,850 — and it
    // ships that way in the Break-Even PDF. The comment a few lines up records that this same
    // rows-do-not-add-up defect was already fixed once here, for frequency normalization.
    const debtMonthly = debtAnnual / 12;
    const weeklyNut = weeklyOpex + weeklySalaried;

    const breakEven = (varRate != null && varRate < 1 && weeklyNut > 0) ? weeklyNut / (1 - varRate) : null;

    // Break-even is a whole-operation number (varRate is measured on TOTAL revenue),
    // so compare against TOTAL revenue too — from the profit week records, which carry
    // catering + other (revenue_weeks store only bar + floor). Mixing bases made
    // "Cleared By / Short By / Break-Even Day" wrong for any bar that caters.
    const weeks = ((App.data && App.data.weeks) || []).slice()
      .sort((a, b) => String(a.period_end || '').localeCompare(String(b.period_end || '')));
    const salesOf = w => ((w.bar && w.bar.revenue) || 0) + ((w.food && w.food.revenue) || 0)
      + ((w.catering && w.catering.revenue) || 0) + ((w.other && w.other.revenue) || 0);
    const lastWk = weeks[weeks.length - 1] || null;
    const lastSales = lastWk ? salesOf(lastWk) : null;

    return {
      curKey, netRev, cogs, labor, hourlyLabor, varRate, recurring, debtMonthly,
      monthlyOpex, weeklyOpex, weeklySalaried, salariedMonthly, monthlyFixed, weeklyNut, breakEven,
      weeks, salesOf, lastWk, lastSales,
      hasOpex: monthlyOpex > 0, hasRev: netRev > 0
    };
  },

  summary() {
    const c = this._compute();
    if (!(c.breakEven > 0) || c.lastSales == null) return { hasData: false };
    const delta = c.lastSales - c.breakEven;
    return { hasData: true, breakEven: c.breakEven, lastSales: c.lastSales, delta, ok: delta >= 0 };
  },

  _breakEvenDay(breakEven, lastSales) {
    if (!(breakEven > 0) || !(lastSales > 0)) return null;
    const days = Math.ceil(breakEven / (lastSales / 7));
    if (days > 7) return { reached: false };
    return { reached: true, label: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][days - 1] };
  },

  render(mount) {
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    const c = this._compute();
    const f = v => App.fmtCurrency(v, 0);
    const f2 = v => App.fmtCurrency(v);

    if (!c.hasOpex) {
      App.setupCard(mount, {
        title: 'Break-Even',
        lead: 'Break-Even shows the sales you need to cover your costs and how you are tracking against it. It needs your fixed costs first, your recurring bills like rent, insurance, and utilities.',
        steps: [{ title: 'Log your operating expenses', desc: 'Add your recurring monthly bills in Operating Expenses. Those are the nut this number is built on.', btn: 'Operating Expenses', screen: 'operating-expenses', done: false }]
      });
      return;
    }
    if (!c.hasRev) {
      App.setupCard(mount, {
        title: 'Break-Even',
        lead: 'Your fixed costs are set. Break-Even needs a few logged weeks to read your cost structure, what share of every sales dollar goes to product and labor.',
        steps: [{ title: 'Close a few weeks', desc: 'Log your weekly sales and costs so Bar Cop can read your prime cost and draw the line.', btn: 'Close The Week', screen: 'dashboard', done: false }]
      });
      return;
    }
    if (c.breakEven == null) {
      mount.innerHTML = '<div class="screen"><div class="card"><div style="font-size:13px;color:var(--t2);line-height:1.7;">'
        + '<span style="color:var(--red);font-weight:700;">There is no break-even.</span> Your product and labor are eating ' + (c.varRate != null ? (c.varRate * 100).toFixed(0) + '%' : 'all') + ' of every dollar, so no sales number covers the nut. Fix the cost structure in Profit Recovery first.'
        + '</div></div></div>';
      return;
    }

    const defaults = { sales: Math.round(c.lastSales || c.breakEven || 0), nut: Math.round(c.weeklyNut), rate: +(c.varRate * 100).toFixed(1) };
    const wf = this._wf || defaults;
    this._wf = wf;

    const delta = (c.lastSales != null) ? c.lastSales - c.breakEven : null;
    const beDay = this._breakEvenDay(c.breakEven, c.lastSales);
    const mini = (label, val, color) => '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:600;line-height:1;color:' + (color || 'var(--t1)') + ';">' + val + '</div></div>';
    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 30px;"></div>';

    // ── 1. Top stats strip ─────────────────────────────────────────────────
    const topStrip = this._statsCard(
      this._statItem('Break-Even / Week', f(c.breakEven))
      + this._statItem('Last Week', c.lastSales != null ? f(c.lastSales) : '-')
      + this._statItem(delta != null && delta < 0 ? 'Short By' : 'Cleared By', delta != null ? f(Math.abs(delta)) : '-', delta != null ? (delta >= 0 ? 'color:var(--green);' : 'color:var(--red);') : '')
      + this._statItem('Break-Even Day', beDay ? (beDay.reached ? beDay.label : 'Not reached') : '-', beDay && !beDay.reached ? 'color:var(--red);' : '')
    );
    const readText = (delta == null) ? 'Log a week and Bar Cop shows how you tracked against your break-even.'
      : (delta >= 0 ? 'Last week you did ' + f(c.lastSales) + ' and cleared break-even by ' + f(delta) + '. That is your profit.'
                    : 'Last week you did ' + f(c.lastSales) + ', ' + f(Math.abs(delta)) + ' short of break-even.');

    // ── 2. What If (up top) ────────────────────────────────────────────────
    const wfInput = (id, label, val, suffix, pre) => '<div class="f" style="width:170px;flex-shrink:0;"><label>' + label + '</label>'
      + '<div class="fw">' + (pre ? '<span class="pre">' + pre + '</span>' : '') + '<input' + (pre ? ' class="pre"' : (suffix ? ' class="suf"' : '')) + ' type="number" id="' + id + '" value="' + val + '" step="' + (suffix ? '0.1' : '100') + '"/>' + (suffix ? '<span class="suf">' + suffix + '</span>' : '') + '</div></div>';
    const whatIfCard = '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">What If</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:14px;">Move any lever and watch break-even and your profit shift. Nothing here is saved.</div>'
      + '<div class="form-row" style="gap:16px 20px;flex-wrap:wrap;align-items:flex-end;">'
      +   wfInput('be-wf-sales', 'Weekly Sales', wf.sales, '', '$')
      +   wfInput('be-wf-nut', 'Weekly Nut', wf.nut, '', '$')
      +   wfInput('be-wf-rate', 'Variable Rate', wf.rate, '%')
      +   '<div class="f" style="width:auto;flex:0 0 auto;"><label style="visibility:hidden;">Reset</label>'
      +   '<div style="display:flex;align-items:center;min-height:36px;"><button class="btn btn-ghost btn-sm" id="be-wf-reset">Reset</button></div></div>'
      + '</div>'
      + '<div id="be-wf-out" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--b2);"></div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:14px;line-height:1.6;">' + readText + '</div>'
      + '</div>';

    // ── 3. Your Cost Structure (above The Nut) ─────────────────────────────
    const cents = Math.round(c.varRate * 100);
    const structCard = '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Your Cost Structure</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.7;">Of every sales dollar, <span style="color:var(--t1);font-weight:700;">' + cents + '&cent;</span> goes to product and hourly labor, leaving <span style="color:var(--green);font-weight:700;">' + (100 - cents) + '&cent;</span> to cover the nut and drop to profit. '
      + 'Salaried pay does not flex with sales, so it sits in the nut below, not here. That leftover is what has to add up to your ' + f(c.weeklyNut) + ' weekly nut before you make a dime.</div>'
      + '<div style="margin-top:12px;padding-top:14px;border-top:1px solid var(--b2);display:flex;flex-wrap:wrap;">'
      +   mini('COGS', c.netRev ? (c.cogs / c.netRev * 100).toFixed(1) + '%' : '-') + vdiv
      +   mini('Hourly Labor', c.netRev ? (c.hourlyLabor / c.netRev * 100).toFixed(1) + '%' : '-')
      + '</div></div>';

    // ── 4. The Nut (2nd to last) ───────────────────────────────────────────
    // Normalize every bill to a MONTHLY figure by its frequency, exactly as annualOpex
    // does. Summing raw amounts printed a quarterly bill at 4x and an annual one at 12x
    // its real monthly cost under a "Per Month" heading (a $12k annual insurance policy
    // read as a $12k monthly bill), and the rows then visibly did not add up to their own
    // Total, which was frequency-correct all along.
    const byCat = {};
    c.recurring.forEach(r => {
      const k = r.category || 'Other';
      const perYear = r.frequency === 'quarterly' ? 4 : r.frequency === 'annual' ? 1 : 12;
      byCat[k] = (byCat[k] || 0) + ((parseFloat(r.amount) || 0) * perYear / 12);
    });
    const salRow = c.weeklySalaried > 0
      ? '<tr><td><div class="val">Salaried Labor</div></td><td>' + f2(c.salariedMonthly) + '</td><td class="val">' + f2(c.weeklySalaried) + '</td><td></td></tr>'
      : '';
    /* ⚠ THE ROWS MUST ADD UP TO THE TOTAL, and debt service was missing from them (round 5). The
       rows are built from `c.recurring`, the operating-expense list, while the Total carries the
       recurring loan and equipment payments too — so the table printed rows summing to $5,700 under
       a Total of $7,550 with nothing on screen naming the missing $1,850, and shipped that way in
       the Break-Even PDF. The comment directly above records this same rows-do-not-add-up defect
       being fixed once already, for frequency normalization. */
    const debtRow = c.debtMonthly > 0
      ? '<tr><td><div class="val">Debt Service</div></td><td>' + f2(c.debtMonthly) + '</td><td class="val">' + f2(c.debtMonthly * 12 / 52) + '</td><td></td></tr>'
      : '';
    /* ⚠ THE PER-WEEK COLUMN HAS TO ADD UP TOO (round 6). Every row was rounded to cents and the
       Total was not, so eleven rows summed to $2,352.22 under a printed $2,352.21 — a table whose
       whole job is showing what the nut is made of, off by a cent, in the Break-Even PDF. Summing
       the ROUNDED row values is what makes the column true; weeklyNut keeps its full precision
       everywhere it is used as a number (Break-Even itself is computed from it, not from this). */
    let _wkShown = 0;
    const _wkCell = (v) => { const r = Math.round(v * 100) / 100; _wkShown += r; return f2(r); };
    const catRows = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]).map(k =>
      '<tr><td><div class="val">' + esc(k) + '</div></td><td>' + f2(byCat[k]) + '</td><td class="val">' + _wkCell(byCat[k] * 12 / 52) + '</td><td></td></tr>').join('');
    const debtRow2 = c.debtMonthly > 0
      ? '<tr><td><div class="val">Debt Service</div></td><td>' + f2(c.debtMonthly) + '</td><td class="val">' + _wkCell(c.debtMonthly * 12 / 52) + '</td><td></td></tr>'
      : '';
    const salRow2 = c.weeklySalaried > 0
      ? '<tr><td><div class="val">Salaried Labor</div></td><td>' + f2(c.salariedMonthly) + '</td><td class="val">' + _wkCell(c.weeklySalaried) + '</td><td></td></tr>'
      : '';
    const nutRows = catRows + debtRow2 + salRow2
      + '<tr><td><div class="val" style="font-weight:700;">Total</div></td><td style="font-weight:700;">' + f2(c.monthlyFixed) + '</td><td class="val" style="font-weight:700;">' + f2(_wkShown) + '</td><td></td></tr>';
    const exportBtn = '<button class="btn btn-ghost btn-sm no-print" id="be-export">Export PDF</button>';
    const nutCard = this._sh('The Nut', exportBtn)
      + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">' + this.COLS
      + '<thead><tr><th>Fixed Cost</th><th>Per Month</th><th>Per Week</th><th></th></tr></thead><tbody>' + nutRows + '</tbody></table></div>';

    // ── 5. The Last 8 Weeks (last) ─────────────────────────────────────────
    const recent = c.weeks.slice(-8);
    const trendRows = recent.map(w => {
      const s = c.salesOf(w);
      const d = s - c.breakEven;
      return '<tr><td><div class="val">' + esc(String(w.period_end || '').slice(0, 10)) + '</div></td>'
        + '<td>' + f(s) + '</td><td>' + f(c.breakEven) + '</td>'
        + '<td style="color:' + (d >= 0 ? 'var(--green)' : 'var(--red)') + ';font-weight:700;">' + (d >= 0 ? 'Cleared ' + f(d) : 'Short ' + f(Math.abs(d))) + '</td></tr>';
    }).join('');
    const trendCard = this._sh('The Last 8 Weeks')
      + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">' + this.COLS
      + '<thead><tr><th>Week Ending</th><th>Sales</th><th>Break-Even</th><th>Result</th></tr></thead>'
      + '<tbody>' + (trendRows || '<tr><td colspan="4" style="color:var(--t3);">No weeks logged yet.</td></tr>') + '</tbody></table></div>';

    mount.innerHTML = '<div class="screen">' + topStrip + whatIfCard + structCard
      + '<div id="be-export-root">' + nutCard + trendCard + '</div></div>';

    document.getElementById('be-export')?.addEventListener('click', () => App.exportPDF({ title: 'Break-Even', root: document.getElementById('be-export-root') }));

    const drawWf = () => {
      const sales = parseFloat(document.getElementById('be-wf-sales')?.value) || 0;
      const nut   = parseFloat(document.getElementById('be-wf-nut')?.value) || 0;
      const rate  = (parseFloat(document.getElementById('be-wf-rate')?.value) || 0) / 100;
      this._wf = { sales: Math.round(sales), nut: Math.round(nut), rate: +(rate * 100).toFixed(1) };
      const be = (rate < 1 && nut > 0) ? nut / (1 - rate) : null;
      const profit = (be != null) ? (sales - be) : null;
      const out = document.getElementById('be-wf-out');
      if (!out) return;
      if (be == null) { out.innerHTML = '<div style="font-size:13px;color:var(--red);">At that variable rate there is no break-even, product and labor eat every dollar.</div>'; return; }
      out.innerHTML = '<div style="display:flex;align-items:flex-start;flex-wrap:wrap;">'
        + mini('Break-Even / Week', f(be)) + vdiv
        + mini(profit >= 0 ? 'Profit at That Volume' : 'Shortfall', (profit >= 0 ? '' : '-') + f(Math.abs(profit)), profit >= 0 ? 'var(--green)' : 'var(--red)')
        + '</div>';
    };
    document.getElementById('be-wf-reset')?.addEventListener('click', () => {
      const si = document.getElementById('be-wf-sales'); if (si) si.value = defaults.sales;
      const ni = document.getElementById('be-wf-nut');   if (ni) ni.value = defaults.nut;
      const ri = document.getElementById('be-wf-rate');  if (ri) ri.value = defaults.rate;
      drawWf();
    });
    ['be-wf-sales', 'be-wf-nut', 'be-wf-rate'].forEach(id => document.getElementById(id)?.addEventListener('input', drawWf));
    drawWf();
  },

  showHowTo() {
    App.showHelpModal('How Break-Even Works', [
      { p: ['Break-Even is the one number that runs the business: the sales you need each week to cover your costs. Below it you are losing money, above it you are making it. Bar Cop already holds every input, so it just draws the line.'] },
      { h: 'How It Is Built', p: ['Your fixed costs, the nut, are your recurring operating-expense bills like rent, insurance, and utilities, plus your salaried (exempt) pay, which is the same every week no matter how sales move, spread to a weekly number. Your variable rate is the share of every sales dollar that goes to product and hourly labor, read from your real logged weeks. Break-even is the nut divided by the dollars left after variable costs. Keep your operating expenses, salaries, and weekly closes current and the number stays honest.'] },
      { h: 'Tracking Against It', p: ['The strip up top shows last week against the line, cleared it and the amount is your profit, short and that is your gap, plus the day of the week you cross break-even at last week\'s pace. The 8-week table at the bottom shows the streak.'] },
      { h: 'What If', p: ['The what-if is a sandbox. Move your weekly sales, cut the nut, or trim the variable rate and watch break-even and your profit move, so you can see what a price change or a rent cut actually buys you before you commit. Hit Reset to snap back to your real numbers.'] }
    ]);
  }
};
