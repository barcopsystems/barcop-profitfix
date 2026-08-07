'use strict';

/* ── Books home — "Close Out Your Books" landing ─────────────────────────────
   The Books section landing, opened from the top-nav "Books" link. Mirrors the
   Control/Cash "Close The Week" pattern: a Where You Stand card (the headline
   P&L number on top, a secondary read below), the monthly Close Out Your Books
   step checklist (expandable steps + green progress bar), and an As Needed row.
   Monthly close, no week selector. Numbers roll up from the same S.HubBooks
   aggregators the Month-End file is built from, so they always agree; the work
   happens on the screens the steps link to. */

S.HubBooksHome = {

  _openStep: null,

  open() {
    if (App._hubBlocked && App._hubBlocked('hub-books-home')) return;   // Books area gate
    App.openHubFullPage('Books', (mount) => { this.container = mount; this.render(mount); }, 'books-home');
  },

  // Operating income is a LEVEL and it goes under zero on a down month or a down
  // year, which this file already knows (`ytdInc < 0` paints the hero red, `mInc < 0`
  // adds "still in the red"). App.fmtCurrency is '$' + v, so a raw negative printed
  // "$-45,000.00" in 46px on the landing, while the income statement one click away
  // rendered the SAME figure as "-$45,000.00" (hub-books _incomeStatementCard), on a
  // pair of screens whose own comment promises they always agree. App.fmtBal is the
  // canonical balance formatter; the null/NaN dash is this file's own contract.
  /* ⛔ A DRAW IS NOT A BILL. Since the one-ledger merge `operating_expenses` also holds owner
     draws, loan payments and tax remittances, and all three readers below counted them: the
     briefing stopped saying "log this month's bills first", the step read "1 bill logged this
     month" for a month with only a draw, and the day-one checklist ticked "Add your operating
     expenses" off one. One accessor so a fourth reader cannot disagree with these three. */
  _bills() {
    return ((App.data && App.data.operating_expenses) || [])
      .filter(r => !S.HubOperatingExpenses.isCashOnlyCategory(r && r.category));
  },
  _money(v)  { return (v == null || isNaN(v)) ? '-' : App.fmtBal(Number(v)); },
  _pct(v)    { return (v == null || isNaN(v)) ? '-' : (v * 100).toFixed(1) + '%'; },
  _dateLbl(iso) { try { const d = new Date(iso); return isNaN(d) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch (e) { return null; } },
  _lastRun(key) { try { const v = localStorage.getItem(key); return v ? this._dateLbl(v) : null; } catch (e) { return null; } },

  // ── Per-month "done" stamps (operator-controlled, local to the device) ──────
  /* ⭐⭐⭐ THE MONTH THE WHOLE PAGE IS ABOUT (Kyle, 2026-08-07). Every figure on this landing already
     descends from this ONE call — `_aggregateMonth`, `_aggregateYTD`, `_plParts`, `_monthLabel`, the
     bill count, `stepStatus` and `_doneKey` all take it as an argument — so a selector here moves the
     entire page and cannot move half of it.
     ⛔ THAT IS THE POINT, NOT A CONVENIENCE. The Money Out screen shipped the other shape: range chips
     that moved the LOG while the stat strip followed the tab, so an operator reading a chip as a
     page-wide filter misread every number on screen. Here the danger is worse — ticking off July's
     steps while reading August's income — and it is avoided by construction, because there is only
     one month on this page and this is it. `verify-books-month-selector` pins exactly that.
     ⚠ WHY A SELECTOR AT ALL: the done-map is keyed `books_close_done_<month>`, so at 00:00 on the 1st
     the steps went blank while the operator was still closing LAST month. The ticks were never lost —
     they sit under the old key — there was simply no door to them. Six weekly cockpits have that
     door; this was the one that needed it most, because you close July during August. */
  _curKey() { return this._monthKey || this._nowKey(); },

  // The wall-calendar month, ignoring the selector. `_curKey` falls back to it; `atCurrentMonth`
  // compares against it; nothing else should need it.
  _nowKey() {
    const HB = S.HubBooks;
    if (HB && HB._currentMonthKey) return HB._currentMonthKey();
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  },
  atCurrentMonth() { return this._curKey() === this._nowKey(); },

  /* ⛔⛔⛔ THE MONTH THIS PAGE REPORTS ON, WHICH IS NOT ALWAYS THE MONTH YOU ARE STANDING IN.
     Measured on a clean demo, 7 August: the strip read REVENUE $19,150.00 · PRIME COST 55.4% ·
     OPERATING INCOME **-$13,284.83**. The arithmetic was right and the number was a lie about the
     business: a FULL month of fixed bills is dated the 5th (rent $12,000, utilities $2,600,
     insurance $1,500 and the rest, ~$21.8k) while revenue accrues week by week, so until roughly
     the 20th every month reads as a heavy loss. Every operator, every month, on the landing page
     that tells them how the business is doing ([[output-honesty]]).
     ⭐ THE FIX IS A DECISION KYLE ALREADY MADE ELSEWHERE, NOT A NEW ONE. `_pctBasis` on the Money
     Out screen exists for exactly this: a partial month makes a ratio lie, so it reports the newest
     COMPLETE month and NAMES it. This is the same rule on the same problem, using the same
     ⛔ BUT NOT THE SAME COMPLETENESS TEST, AND THAT DISTINCTION IS THE WHOLE OF `_basisKey`'s note
     below. `_pctBasis` uses the DAY-COUNTING one because its ratio divides a month's money by that
     month's revenue day for day. Books books a week WHOLE to the month its `period_end` lands in, so
     it asks `_weeksComplete`. Same idea, two questions, two answers.
     ⚠ THE CEILING IS THE SELECTED MONTH, NOT THE CLOCK. `HubBooks._lastCompleteMonthKey` anchors
     itself to `_currentMonthKey()`, so it cannot answer "complete as of July" when the selector is
     on July. Hence a local one that takes the ceiling.
     ⚠ AND IT MAY RETURN THE CEILING ITSELF: a bar with no complete month yet (new, or weeks not
     confirmed) still has to see a page. `basisComplete` below is how the render says so rather than
     printing a part-month as if it were settled. */
  /* ⛔⛔⛔ `_weeksComplete`, NEVER `_monthRevenueComplete`, AND THE SOURCE SAID SO BEFORE I DID.
     `hub-books.js:472` carries the warning in bold: *"THIS IS NOT `hub-operating-expenses.
     _monthRevenueComplete`, AND MUST NEVER BE MERGED WITH IT."* That one counts DAYS COVERED, which
     is right for the OpEx ratio because that ratio divides one month's money by one month's revenue
     day for day. **Books does not slice by day** — it books a week WHOLE to the month its
     `period_end` falls in. Wiring this cockpit to the day-counter would nag every operator, every
     month, about a week that belongs to the NEXT month's books.
     ⚠ I RECOMMENDED THE FORBIDDEN ONE AND BUILT IT, and two things caught it: `_monthRevenueComplete`
     is not on `S.HubBooks` at all, so the guard fell through and the whole feature was a SILENT
     NO-OP; and the live check showed it. A source-text pin stayed green over all of it. */
  _basisKey(ceil) {
    const HB = S.HubBooks;
    if (!HB || !HB._weeksComplete) return ceil;
    /* ⛔⛔⛔ TWO CONDITIONS, AND MEASURING IS THE ONLY REASON I KNOW THAT. `_weeksComplete('2026-08')`
       returned TRUE on 7 August — correctly. It answers *"are any weeks MISSING from this month's
       books"*, and none are missing from August yet because the month has not got to them. It is a
       GAP test, not an is-it-over test, so on its own it left the basis on August and the whole fix
       did nothing.
       ⭐ A MONTH IS SETTLED WHEN IT HAS ENDED **AND** HAS NO HOLES. The first half is the calendar
       (`mk < nowKey`); the second is `_weeksComplete`, used for exactly what it is for — a past month
       missing a week understates its revenue and its operating income by that week, which is the
       defect `hub-books` already warns about at `_weeksComplete`. Either alone is wrong: the calendar
       alone reports a month with a hole in it as settled, the gap test alone reports today as settled. */
    const done = (mk) => mk < this._nowKey() && !!(HB._weeksComplete(mk) || {}).complete;
    if (done(ceil)) return ceil;
    const keys = Array.from(new Set(((App.data && App.data.weeks) || [])
      .map(w => String((w && w.period_end) || '').slice(0, 7))))
      .filter(mk => /^\d{4}-\d{2}$/.test(mk) && mk < ceil && done(mk))
      .sort();
    return keys.length ? keys[keys.length - 1] : ceil;
  },

  /* THE FLOOR: the first month this bar has anything in. Stepping back past it lands on empty pages
     forever, which reads as a broken button rather than as the end of the data. Both stores are
     asked because either one can be the earliest — a bar that logged bills before confirming a week,
     or the other way round. */
  _firstKey() {
    const mk = (v) => String(v || '').slice(0, 7);
    /* ⛔ `_bills()`, NOT THE RAW LEDGER. `verify-expense-readers-one-set` B2 caught this within a
       minute: every reader outside the owning screen must exclude the cash-only rows, or a draw
       starts counting as a bill somewhere. It is also the consistent answer — `stepStatus` and the
       banner count bills, so the floor of the selector should be the first month with a BILL. */
    const all = this._bills().map(r => mk(r && r.date))
      .concat(((App.data && App.data.weeks) || []).map(w => mk(w && w.period_end)))
      .filter(m => /^\d{4}-\d{2}$/.test(m));
    return all.length ? all.sort()[0] : this._nowKey();
  },

  // n months from the selected one, clamped to [first month with data, this month].
  _stepMonth(n) {
    const cur = this._curKey();
    const d = new Date(cur + '-01T00:00:00');
    if (isNaN(d.getTime())) return;
    d.setMonth(d.getMonth() + n);
    const next = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const floor = this._firstKey(), ceil = this._nowKey();
    if (next < floor || next > ceil) return;
    this._monthKey = (next === ceil) ? null : next;   // null keeps "now" following the clock
    this._openStep = null;
    this.render(this.container, this.actions);
  },

  /* The weekly cockpits' selector, in months. Same markup and same class names so the two read as
     one control; only the unit differs. */
  monthSelector() {
    const isCur = this.atCurrentMonth();
    const atFloor = this._curKey() <= this._firstKey();
    const HB = S.HubBooks;
    const label = (HB && HB._monthLabel) ? HB._monthLabel(this._curKey()) : this._curKey();
    const nowBadge = isCur ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const prevBtn = atFloor
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&lsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm bk-mo-prev" aria-label="Previous month" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = isCur
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm bk-mo-next" aria-label="Next month" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + esc(String(label).toUpperCase()) + nowBadge + '</span>';
    const nowBtn = isCur ? '' : '<button class="btn btn-ghost btn-sm bk-mo-now" style="margin-left:4px;">This Month</button>';
    return '<div style="display:inline-flex;align-items:center;gap:8px;">' + prevBtn + pill + nextBtn + nowBtn + '</div>';
  },
  _doneKey() { return 'books_close_done_' + this._curKey(); },   // account-synced (App.data), follows the user across devices; no per-browser suffix
  doneMap()  { return App.acctGet(this._doneKey(), {}); },
  setDone(step, val) { const m = { ...this.doneMap() }; m[step] = val; App.acctSet(this._doneKey(), m); },

  /* ⚠ THE POSITION IS THE NUMBER. `_META` carried `n: 1..4` as literals, so inserting a step meant
     hand-renumbering every one below it — the kind of edit that ships a "3" sitting in position 4.
     `stepRow` derives it from ORDER now, and verify-books-weeks-in.js refuses a hardcoded `n:`. */
  /* ⭐ FOUR STEPS. Kyle: *"remove the Generate your weekly P&L step.. so it is back to 4 steps..
     that step no longer fits."* He is right about the fit: the other four are the monthly CLOSE, in
     order, each one a thing that must be true before the next. The weekly brief is a between-closes
     export for a bookkeeper — useful, and not a step in closing a month. It stays reachable as its
     own As Needed button, which is what that row is for. */
  ORDER: ['expenses', 'weeks', 'review', 'generate'],
  _META: {
    /* ⚠ "operating expenses" WAS HALF THE DOOR (Kyle, 2026-08-07). This step logs everything that
       leaves the bank: bills AND cash outflows (owner draws, loan payments, tax, capital). The Log
       Type picker on the form is the whole point, and a title naming one of the two reads as if
       the other belongs somewhere else — which is the confusion the one-ledger rebuild removed. */
    expenses: { title: 'Log this month\'s money out', act: 'operating-expenses' },
    // Revenue on the income statement IS the confirmed weeks. See hub-books._weeksComplete.
    weeks:    { title: 'Make sure the weeks are all in',       act: 'this-week' },
    review:   { title: 'Review your income statement',         act: 'books' },
    generate: { title: 'Generate Month-End Books',             act: 'books' }
  },
  stepDone() { const dm = this.doneMap(); const r = {}; this.ORDER.forEach(k => { r[k] = !!dm[k]; }); return r; },

  render(mount) {
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    this.container = mount;

    const st = this._computeState();
    const gs = this.getStartedDone();
    const done = this.stepDone();
    const doneCount = this.ORDER.filter(k => done[k]).length;
    if (this._openStep == null) this._openStep = this.ORDER.find(k => !done[k]) || '';

    /* ⭐⭐⭐ THE IMPORT TAKES THE PAGE OVER, THE SAME WAY IT DOES ON ADD PRODUCTS.
       `ic-product-setup` splits its screen into an upper cards block and a lower area, and while an
       import is live the lower area becomes drop -> mapper -> routing panel in place of the product
       list. Here the lower area is the four step rows plus As Needed, and they are what a live
       Money Out import replaces. Where You Stand and the progress banner stay, so the operator
       keeps the context of what they are closing and how far along they are.
       ⛔ AS NEEDED GOES WITH THE STEPS. It is a row of buttons to other screens; leaving it sitting
       under a takeover reads like the page half-changed, and every one of those buttons navigates
       away from a file the operator is part-way through confirming.
       ⚠ Tried inline in the step first (2026-08-05) and Kyle walked it: a bank month runs to
       hundreds of rows across a dozen sections, and nesting that in an accordion buries the Add
       button. The sales confirm on sc-dashboard stays in its step because a week is seven rows. */
    const takeover = S.HubOperatingExpenses.moneyOutTakeover();
    mount.innerHTML = '<div class="screen">'
      + (gs.hasWeeks ? this.whereYouStand(st) : this.getStartedBox(gs))
      + this.banner(doneCount, this.ORDER.length)
      + (takeover
        ? '<div style="margin-top:18px;" id="bk-moneyout"></div>'
        : '<div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;">'
          +   this.ORDER.map(k => this.stepRow(k, done, st)).join('')
          + '</div>'
          + this.asNeeded(st))
      + '</div>';
    this._wire();
    /* ⛔⛔ RE-MOUNTED AFTER EVERY RENDER, and this is the whole reason the workspace resolves its
       mount by id. The line above replaces this page's innerHTML, so the div the expense screen was
       holding is now DETACHED — a repaint into it produces no output and no error, which reads on
       screen as a dead workspace. Toggling any step re-runs this, so the mount is fresh every time.
       ⭐ An in-progress review survives it: `_expenseReview` lives on the screen OBJECT, not in the
       DOM, so a file already dropped is still there after a toggle.
       ⚠ BARE CALL, deliberately ([[the-loop]] #40). `?.` here would mean "if the expense screen is
       missing, render an empty box quietly" — and `_bills()` above already calls into the same
       object bare, so guarding it here would be inconsistent as well as wrong. */
    if (takeover || this._openStep === 'expenses') S.HubOperatingExpenses.renderMoneyOut('bk-moneyout');
    /* ⭐ AND SCROLL TO IT, exactly as `ic-product-setup._openRouting` does. The takeover renders
       below Where You Stand and the banner, so on a short window the operator would press Import
       File and see nothing move. Only while the takeover is up: on the way back OUT the steps are
       what they want to see, and yanking the page down to them would be the wrong end. */
    if (takeover) setTimeout(() => document.getElementById('bk-moneyout')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  },

  // ── Heavy compute, once per render ──────────────────────────────────────────
  _computeState() {
    const HB = S.HubBooks;
    const curKey = this._curKey();
    /* ⭐ ONE SUBSTITUTION, AND IT MOVES THE WHOLE PAGE. Every figure below already took `curKey` as
       an argument, so pointing them at the BASIS month is the entire change — the strip, the YTD
       hero and its margin all move together and cannot disagree about which month they are about. */
    const basisKey = this._basisKey(curKey);
    // Settled = over AND no missing weeks. Same two conditions `_basisKey` uses; see its note.
    const basisComplete = !!(HB && HB._weeksComplete && basisKey < this._nowKey()
      && (HB._weeksComplete(basisKey) || {}).complete);
    const curM   = (HB && HB._aggregateMonth) ? HB._aggregateMonth(basisKey) : null;
    const monthName = (HB && HB._monthLabel) ? HB._monthLabel(basisKey) : basisKey;
    const YTD    = (HB && HB._aggregateYTD)  ? HB._aggregateYTD(basisKey) : null;

    // Revenue is already net sales (comps excluded by the POS), so do NOT
    // re-subtract comps or re-expense policy comps — that double-removed them and
    // made this landing disagree with the Income Statement it links to. Comps
    // stay tracked in Shift Control.
    // ⭐ ONE FORMULA, shared with the Income Statement and the workbook sheet (HB._plParts).
    // This landing used to build the same arithmetic by hand, which is what let it disagree
    // with the statement it links to.
    const P  = (HB && HB._plParts) ? HB._plParts(basisKey, false) : null;
    const PY = (HB && HB._plParts) ? HB._plParts(basisKey, true)  : null;
    const cmRev   = P ? P.netRev : 0;
    const cmCogs  = curM ? curM.totalCogs : 0;
    const cmLabor = curM ? curM.totalLabor : 0;
    const cmPrimePct = cmRev ? (cmCogs + cmLabor) / cmRev : null;
    const mInc = P ? P.opInc : 0;

    const ytdNet = PY ? PY.netRev : 0;
    const ytdInc = PY ? PY.opInc : 0;
    const ytdMargin = ytdNet ? ytdInc / ytdNet : null;

    const HP = S.HubPermits;
    const permits = (App.data && App.data.permits_compliance) || [];
    let dueCount = 0, expiredCt = 0;
    if (HP && HP._status) {
      permits.forEach(r => { const s = HP._status(r); if (s.key === 'expired' || s.key === 'critical' || s.key === 'warn') { dueCount++; if (s.key === 'expired') expiredCt++; } });
    }
    return { curKey, basisKey, basisComplete, monthName, cmRev, cmPrimePct, mInc, ytdInc, ytdNet, ytdMargin, dueCount, expiredCt };
  },

  // ── Where You Stand (hero + secondary, Cash-style) ──────────────────────────
  whereYouStand(st) {
    const incCol = st.ytdInc < 0 ? 'var(--red)' : 'var(--w)';
    const hero = '<div style="padding:2px 0;">'
      + '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">'
      +   '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:46px;font-weight:600;line-height:0.9;color:' + incCol + ';">' + this._money(st.ytdInc) + '</span>'
      +   '<span style="font-size:13px;color:var(--t2);">operating income, year to date</span>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:12px;">Through ' + esc(st.monthName) + (st.ytdMargin != null ? ' &middot; ' + this._pct(st.ytdMargin) + ' operating margin' : '') + '</div></div>';

    const vdiv = '<div style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 30px;"></div>';
    const mini = (label, val, col) => '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:600;line-height:1;color:' + (col || 'var(--t1)') + ';">' + val + '</div></div>';
    /* ⚠ THE LABEL FOLLOWS THE FACT. A settled month is named plainly; an incomplete one says so, in
       the words that describe the actual mismatch rather than the vague "so far" that let a
       full month of bills sit against one week of revenue without comment. */
    const stripNote = st.basisComplete
      ? ''
      : '<div style="font-size:11px;color:var(--t3);line-height:1.5;margin-top:8px;">'
        + 'No month is fully confirmed yet, so this is ' + esc(st.monthName) + ' to date: the bills are in full and the revenue is only the weeks you have confirmed.'
        + '</div>';
    const secondary = '<div style="margin-top:12px;padding-top:14px;border-top:1px solid var(--b2);">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">' + esc(st.monthName) + (st.basisComplete ? '' : ' So Far') + '</div>'
      + '<div style="display:flex;align-items:flex-start;flex-wrap:wrap;">'
      +   mini('Revenue', this._money(st.cmRev)) + vdiv
      +   mini('Prime Cost', this._pct(st.cmPrimePct)) + vdiv
      +   mini('Operating Income', this._money(st.mInc), st.mInc < 0 ? 'var(--red)' : 'var(--t1)')
      + '</div>'
      + stripNote
      + '<div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" data-act="books">Income Statement</button></div></div>';

    return '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span>Where You Stand</span>'
      + '<button class="btn btn-ghost btn-sm" data-act="briefing" style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Bar Cop Briefing</button></div>'
      + hero + secondary + '</div>';
  },

  // ── Bar Cop Briefing: a written read of the books. Code-generated (no API),
  //    same button the section dashboards carry. ───────────────────────────────
  showInsights() {
    if (!((App.data && App.data.weeks) || []).length) { DashUI.insightsModal('Bar Cop Briefing', 'Confirm a few weeks and add your operating expenses, and Bar Cop can read your books for you.'); return; }
    DashUI.insightsModal('Bar Cop Briefing', this._insBriefing(this._computeState()));
  },
  _insBriefing(st) {
    // Same rule as _money above: these are LEVELS, and the paragraph below adds
    // "still in the red for the month" off `mInc < 0`, so the value it prints beside
    // that clause is negative by construction.
    const m = v => (v == null || isNaN(v)) ? '-' : App.fmtBal(Number(v), 0);
    const pct = v => (v == null || isNaN(v)) ? '-' : (v * 100).toFixed(1) + '%';
    const paras = [];

    // 1 — year to date
    paras.push('Year to date you are at ' + m(st.ytdInc) + ' in operating income' + (st.ytdMargin != null ? ', a ' + pct(st.ytdMargin) + ' operating margin' : '') + '.');

    // 2 — this month so far
    paras.push(esc(st.monthName) + ' so far: ' + m(st.cmRev) + ' in revenue at a ' + pct(st.cmPrimePct) + ' prime cost, ' + m(st.mInc) + ' operating income' + (st.mInc < 0 ? ', still in the red for the month' : '') + '.');

    // 3 — the one move
    let move;
    const billsMonth = this._bills().filter(r => r && String(r.date || '').slice(0, 7) === st.curKey).length;
    if (billsMonth === 0) move = 'Log this month\'s bills first, so the operating income above is complete before you close.';
    else if (st.dueCount > 0) move = 'Clear the ' + st.dueCount + ' permit or license item' + (st.dueCount === 1 ? '' : 's') + ' flagged' + (st.expiredCt > 0 ? ', ' + st.expiredCt + ' already expired' : '') + '.';
    else move = 'The numbers are current. Generate Month-End Books when you are ready to hand it to your accountant.';
    paras.push(move);

    return paras.map(p => '<p style="margin:0 0 12px;">' + esc(p) + '</p>').join('');
  },

  // ── Close Out Your Books banner (Cash card pattern, no week selector) ────────
  banner(dc, total) {
    const allDone = dc === total;
    const pct = total ? Math.round(dc / total * 100) : 0;
    const doneLine = allDone
      ? '<span style="color:var(--green);font-weight:700;">&#10003; Your books are caught up</span>'
      /* ⚠ "this month" IS ONLY TRUE ON THE CURRENT ONE. With the selector back on July it would be
         the page telling the operator the wrong month while showing July's ticks. */
      : '<span style="color:var(--t2);"><span style="color:var(--t1);font-weight:800;">' + dc + '</span> of ' + total
          + (this.atCurrentMonth() ? ' done this month' : ' done') + '</span>';
    return '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);overflow:hidden;margin-bottom:16px;">'
      + '<div style="padding:11px 22px;border-bottom:1px solid var(--b2);">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);">Close Out Your Books</div>'
      + '</div>'
      /* ⚠ THE SELECTOR IS THE FIRST THING IN THE BODY, UNDER THE HEADER — not above the card's own
         title. Same position `dashboard.banner` puts the week selector in, because these two cards
         are the same control doing the same job in a different unit. My first attempt put it above
         "CLOSE OUT YOUR BOOKS", which read as a stray control floating over the card. */
      + '<div style="padding:18px 22px;">'
      +   this.monthSelector()
      +   '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:14px;">'
      +     '<div style="flex:1;min-width:160px;height:6px;background:var(--input);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--green);transition:width .2s;"></div></div>'
      +     '<div style="font-size:12px;">' + doneLine + '</div>'
      +   '</div>'
      +   (allDone ? '' : '<div style="font-size:11px;color:var(--t3);margin-top:12px;">A monthly pass: log your bills, check the numbers, and send the books to your accountant.</div>')
      + '</div>'
      + '</div>';
  },

  // ── Expandable step (Cash stepRow pattern) ──────────────────────────────────
  stepRow(k, done, st) {
    const m = this._META[k], isDone = done[k], isOpen = this._openStep === k;
    const num = this.ORDER.indexOf(k) + 1;   // the position IS the number — see _META
    const circle = isDone
      ? '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:13px;font-weight:800;">&#10003;</span>'
      : '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:11px;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,.45);">' + num + '</span>';
    const bg = isOpen ? 'var(--step-open)' : (isDone ? 'var(--input)' : 'var(--surface)');
    let html = '<div style="border:1px solid var(--b-edge);border-radius:var(--r);background:' + bg + ';overflow:hidden;">'
      + '<div class="bk-step-head' + (isOpen ? '' : ' collapsed') + '" data-step="' + k + '" style="display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;">'
      +   circle
      +   '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--t1);">' + m.title + '</div>'
      +     '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + this.stepStatus(k, st) + '</div></div>'
      +   '<span class="card-chevron" aria-hidden="true">&#9662;</span>'
      + '</div>';
    if (isOpen) html += '<div style="padding:2px 16px 18px;">' + this.workspace(k, isDone) + '</div>';
    return html + '</div>';
  },

  stepStatus(k, st) {
    if (k === 'expenses') {
      const n = this._bills().filter(r => r && r.date && String(r.date).slice(0, 7) === st.curKey).length;
      return n ? n + ' bill' + (n === 1 ? '' : 's') + ' logged this month' : 'No bills logged yet this month';
    }
    /* ⛔ THE MONTH BEING CLOSED, NEVER THE ONE YOU ARE STANDING IN. Step 3 shipped that defect once
       (it read the month-to-date figure and said "July 2026 operating income $9,982.19" while the
       button under it opened JUNE) so this gets the pin on day one instead of after a walk-through.
       ⚠ NO `st.curKey` FALLBACK, deliberately, and it differs from the `review` branch below for a
       reason: falling back to the current month means "if HubBooks has not loaded, talk confidently
       about the WRONG MONTH", which is that same defect wearing a guard ([[the-loop]] #40). With no
       closing month there is no true sentence to print, so it prints none. */
    if (k === 'weeks') {
      const HB = S.HubBooks;
      if (!HB || !HB._closingMonthKey || !HB._weeksComplete) return '';
      const key = HB._closingMonthKey();
      const W = HB._weeksComplete(key);
      const name = HB._monthLabel ? HB._monthLabel(key) : key;
      if (!W.count) return 'No weeks confirmed yet for ' + esc(name);
      const said = W.count + ' week' + (W.count === 1 ? '' : 's') + ' confirmed for ' + esc(name);
      return W.complete ? said : said + ', ' + W.missing + ' still to confirm';
    }
    /* ⛔ THE `pnl` BRANCH WENT WITH ITS STEP. `ORDER` no longer contains it, and this helper is only
       ever called with a key FROM `ORDER` — so the branch was reachable by nothing, which is the
       shape that reads as live to every later scan ([[the-loop]] #63, dead by fixpoint). The stamp
       it read (`books_report_run_weeklypnl`) is still written by the report itself; nothing here
       needs to print it now that the brief is an As Needed button rather than a tracked step. */
    /* ⛔ QUOTE THE MONTH THE BUTTON OPENS. This read the month-to-date figure (`st.mInc`), so in
       July it said "July 2026 operating income $9,982.19" and the Income Statement button under
       it opened JUNE at $7,837.90. Month-End Books defaults to the month being CLOSED, which is
       the right default — so this step has to speak about that month, off the same helper, or
       the cockpit names one month while linking to another. */
    if (k === 'review')   {
      const HB = S.HubBooks;
      const key = (HB && HB._closingMonthKey) ? HB._closingMonthKey() : st.curKey;
      const P = (HB && HB._plParts) ? HB._plParts(key, false) : null;
      const name = (HB && HB._monthLabel) ? HB._monthLabel(key) : key;
      return esc(name) + ' operating income ' + this._money(P ? P.opInc : 0);
    }
    if (k === 'generate') { const d = this._lastRun('books_report_run_monthend'); return d ? 'Report last run ' + d : 'Not run yet'; }
    return '';
  },

  workspace(k, isDone) {
    const explain = (txt) => '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">' + txt + '</div>';
    const markBtn = isDone
      ? '<button class="btn btn-ghost btn-sm" data-undone="' + k + '">Mark not done</button>'
      : '<button class="btn btn-primary btn-sm" data-done="' + k + '">Mark Done</button>';
    /* ⭐⭐⭐ STEP 1 IS THE WORK, NOT A LINK TO IT. Every other step opens a REPORT, which is a page;
       this one is data entry, and Kyle's objection was exactly that it sent you somewhere else to
       do it: *"one place.. that is the only place the user has to go to drop or enter an expense."*
       The card that renders into this mount is the SHIPPED Add Expense card from
       hub-operating-expenses (`_addCardHtml`), drop zone and manual form and the confirm/review
       screen included — not a copy of it. HubBooksHome.render() mounts it after every render; see
       the note there for why it has to be re-mounted rather than mounted once. */
    if (k === 'expenses') {
      /* ⛔⛔ THE TEXT MOVED INTO THE CARD (2026-08-07), and it had to. Kyle wants it UNDER the
         chips and CHANGING with the mode — and only `_addCardHtml` knows the mode. This is how
         `sc-dashboard.workspace('import')` has always done it: `seg + text + drop mount`, one
         builder, the line chosen per mode.
         ⚠ THE OLD LINE IS KEPT HERE AS THE RECORD OF WHAT WAS WRONG WITH IT: *"Bar Cop reads the
         BILLS off it"* and *"every EXPENSE you log here is what your INCOME STATEMENT reads from"*.
         Both are half-true. A draw or a loan payment logged at this same door gets NO income
         statement line by design — that is what cash-only categories are — so the sentence promised
         something the app deliberately does not do. */
      return '<div id="bk-moneyout"></div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">' + markBtn + '</div>';
    }
    /* ⭐ NAMING THE DEPENDENCY IS THE WHOLE POINT OF THIS STEP. Revenue on the income statement is
       the weeks you confirmed; the bills beside it come off a statement covering the whole month. A
       month short a week reads 20% light on revenue and the same dollars light on operating income,
       in the flattering direction, with nothing on screen saying so.
       ⚠ NO NEW VISUAL ELEMENT. The count and the shortfall go in the STATUS LINE, which is where
       every other step already speaks, and the body is the same `explain` + buttons shape. A warning
       box here would be a design change, and those get walked one at a time. */
    if (k === 'weeks') {
      const HB = S.HubBooks;
      const key = (HB && HB._closingMonthKey) ? HB._closingMonthKey() : '';
      const name = (key && HB && HB._monthLabel) ? HB._monthLabel(key) : 'the month you are closing';
      /* ⚠ THE COPY CLAIMS ONLY WHAT IS CERTAIN. An earlier draft said "while the bills you dropped
         cover the whole month" — which assumes they dropped a statement AND that it was complete,
         neither of which this screen knows ([[output-honesty]]). What IS certain is the direction:
         revenue missing means operating income reads low. */
      return explain('Revenue on your income statement is the weeks you confirmed. Any week of '
          + esc(name) + ' you have not confirmed is revenue Bar Cop cannot see, so operating income '
          + 'reads low until they are all in.')
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        + '<button class="btn btn-ghost btn-sm" data-act="this-week">Confirm the Week</button>'
        + markBtn + '</div>';
    }
    const M = {
      review:   ['Open the income statement and make sure revenue, costs, and operating income read right before anything goes out.', '<button class="btn btn-ghost btn-sm" data-act="books">Income Statement</button>'],
      generate: ['Build the full workbook and one-page summary for your accountant. Nothing to re-type, it pulls from everything you logged.', '<button class="btn btn-ghost btn-sm" data-act="books">Month-End Books</button>']
    };
    const cfg = M[k];
    return explain(cfg[0]) + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + cfg[1] + markBtn + '</div>';
  },

  /* ⭐ AS NEEDED, AFTER BUILD PIECE 5. Licensing left Books with its page — Kyle: *"the as needed
     under the steps has 'licensing' button .. change that to 'Break-Even' ghost button"* — and
     Break-Even is the right occupant: it is the other Books screen an operator opens BETWEEN closes
     rather than during one, which is exactly what this row is for.
     ⭐ THE WEEKLY P&L BRIEF LANDS HERE TOO, and that is where the removed step went. Kyle took it out
     of the close sequence because it does not fit there; it is still a real deliverable, so it keeps
     a door rather than disappearing.
     ⚠ THE PERMIT DUE-COUNT DID NOT LEAVE THIS FILE. `_state` still counts them and the "clear the N
     flagged" next-move line still names them; only this button changed. The tracker lives in Shift
     Control now and the Hub's three alert rows are its door. */
  asNeeded() {
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;">'
      + '<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-right:4px;">As needed</span>'
      + '<button class="btn btn-ghost btn-sm" data-act="breakeven">Break-Even</button>'
      + '<button class="btn btn-ghost btn-sm" data-act="weekly-pnl">Weekly P&amp;L Brief</button>'
      + '<button class="btn btn-ghost btn-sm" data-act="year-end">Annual Review</button>'
      + '</div>';
  },

  // ── Day one: four-step Get Started box (Cash Close The Week pattern). Each step
  // reads done off real data; once all four are done the Where You Stand card
  // takes its place. The Close Out Your Books steps and As Needed never change.
  getStartedDone() {
    const has = (a) => Array.isArray(a) && a.length > 0;
    const hasWeeks   = has(App.data && App.data.weeks);
    const hasOpex    = has(this._bills());
    const hasInv     = has(App.inventoryData && App.inventoryData.ic_products);
    const hasPermits = has(App.data && App.data.permits_compliance);
    return { hasWeeks, hasOpex, hasInv, hasPermits, all: hasWeeks && hasOpex && hasInv && hasPermits };
  },
  getStartedBox(d) {
    return DashUI.dayOneStrip(
      'Your books build themselves from what you log. Four steps and this card fills in with your operating income, month to date and year to date.',
      [
        { done: d.hasWeeks,   num: 1, label: 'Confirm your first week',          go: 'this-week' },
        { done: d.hasOpex,    num: 2, label: 'Add your operating expenses',     go: 'operating-expenses' },
        { done: d.hasInv,     num: 3, label: 'Set up Inventory Control',        go: 'ic-dashboard' },
        { done: d.hasPermits, num: 4, label: 'Enter your permits and licenses', go: 'permits' }
      ]);
  },

  _wire() {
    const go = (act) => {
      if (act === 'briefing')                this.showInsights();
      else if (act === 'books')              S.HubBooks?.open?.();
      else if (act === 'weekly-pnl')         S.Reports?._openQboModal?.();
      else if (act === 'year-end')           S.HubYearEnd?.open?.();
      else if (act === 'operating-expenses') S.HubOperatingExpenses?.open?.();
      /* ⛔ `breakeven` IS NEW AND I ALMOST SHIPPED IT DEAD. The As Needed row got a Break-Even button
         and this dispatcher has NO FALLBACK, so the click would have done nothing at all — the
         identical defect Kyle had just reported on the Licensing rows, in the same hour.
         `verify-action-key-wired` caught it: it compares every rendered `data-act` against what the
         dispatcher handles, which is the one check a source-text pin cannot fake. */
      else if (act === 'breakeven')          S.HubBreakEven?.open?.();
      // Still reached from the day-one get-started step, which points at the tracker in Shift Control.
      else if (act === 'permits')            S.HubPermits?.open?.();
      // 'this-week' is the CANONICAL id for "confirm the week": App.openScreen special-cases
      // it (app.js) to land the Profit dashboard AND pop the Confirm the Week modal, which is
      // the single weekly-close writer. Sending 'dashboard' here landed the dashboard with no
      // modal, so the step's own label went unanswered. Keep this key in step with the
      // day-one strip above — verify-action-key-wired.js pins that they agree (S260).
      else if (act === 'this-week')          App.openScreen('this-week');
      else if (act === 'ic-dashboard')       App.openScreen('ic-dashboard');
    };
    /* The month arrows, wired per element like everything else on this page. `_stepMonth` does the
       clamping, so neither arrow can walk off the end of the data. */
    this.container.querySelectorAll('.bk-mo-prev').forEach(b => b.addEventListener('click', () => this._stepMonth(-1)));
    this.container.querySelectorAll('.bk-mo-next').forEach(b => b.addEventListener('click', () => this._stepMonth(1)));
    this.container.querySelectorAll('.bk-mo-now').forEach(b => b.addEventListener('click', () => {
      this._monthKey = null; this._openStep = null; this.render(this.container, this.actions);
    }));
    this.container.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => go(el.dataset.act)));
    this.container.querySelectorAll('.db-go').forEach(el => el.addEventListener('click', () => go(el.dataset.go)));
    this.container.querySelectorAll('.bk-step-head').forEach(h => h.addEventListener('click', () => {
      const k = h.dataset.step; this._openStep = (this._openStep === k) ? '' : k; this.render(this.container);
    }));
    this.container.querySelectorAll('[data-done]').forEach(b => b.addEventListener('click', () => { this.setDone(b.dataset.done, true); this._openStep = null; this.render(this.container); }));
    this.container.querySelectorAll('[data-undone]').forEach(b => b.addEventListener('click', () => { this.setDone(b.dataset.undone, false); this.render(this.container); }));
  }

};
