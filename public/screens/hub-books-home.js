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
  _curKey() {
    const HB = S.HubBooks;
    if (HB && HB._currentMonthKey) return HB._currentMonthKey();
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  },
  _doneKey() { return 'books_close_done_' + this._curKey(); },   // account-synced (App.data), follows the user across devices; no per-browser suffix
  doneMap()  { return App.acctGet(this._doneKey(), {}); },
  setDone(step, val) { const m = { ...this.doneMap() }; m[step] = val; App.acctSet(this._doneKey(), m); },

  /* ⚠ THE POSITION IS THE NUMBER. `_META` carried `n: 1..4` as literals, so inserting a step meant
     hand-renumbering every one below it — the kind of edit that ships a "3" sitting in position 4.
     `stepRow` derives it from ORDER now, and verify-books-weeks-in.js refuses a hardcoded `n:`. */
  ORDER: ['expenses', 'weeks', 'pnl', 'review', 'generate'],
  _META: {
    expenses: { title: 'Log this month\'s operating expenses', act: 'operating-expenses' },
    // Revenue on the income statement IS the confirmed weeks. See hub-books._weeksComplete.
    weeks:    { title: 'Make sure the weeks are all in',       act: 'this-week' },
    pnl:      { title: 'Generate your weekly P&L brief',       act: 'weekly-pnl' },
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
    const curM   = (HB && HB._aggregateMonth) ? HB._aggregateMonth(curKey) : null;
    const monthName = (HB && HB._monthLabel) ? HB._monthLabel(curKey) : curKey;
    const YTD    = (HB && HB._aggregateYTD)  ? HB._aggregateYTD(curKey) : null;

    // Revenue is already net sales (comps excluded by the POS), so do NOT
    // re-subtract comps or re-expense policy comps — that double-removed them and
    // made this landing disagree with the Income Statement it links to. Comps
    // stay tracked in Shift Control.
    // ⭐ ONE FORMULA, shared with the Income Statement and the workbook sheet (HB._plParts).
    // This landing used to build the same arithmetic by hand, which is what let it disagree
    // with the statement it links to.
    const P  = (HB && HB._plParts) ? HB._plParts(curKey, false) : null;
    const PY = (HB && HB._plParts) ? HB._plParts(curKey, true)  : null;
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
    return { curKey, monthName, cmRev, cmPrimePct, mInc, ytdInc, ytdNet, ytdMargin, dueCount, expiredCt };
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
    const secondary = '<div style="margin-top:12px;padding-top:14px;border-top:1px solid var(--b2);">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">' + esc(st.monthName) + ' So Far</div>'
      + '<div style="display:flex;align-items:flex-start;flex-wrap:wrap;">'
      +   mini('Revenue', this._money(st.cmRev)) + vdiv
      +   mini('Prime Cost', this._pct(st.cmPrimePct)) + vdiv
      +   mini('Operating Income', this._money(st.mInc), st.mInc < 0 ? 'var(--red)' : 'var(--t1)')
      + '</div>'
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
      : '<span style="color:var(--t2);"><span style="color:var(--t1);font-weight:800;">' + dc + '</span> of ' + total + ' done this month</span>';
    return '<div style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);overflow:hidden;margin-bottom:16px;">'
      + '<div style="padding:11px 22px;border-bottom:1px solid var(--b2);">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);">Close Out Your Books</div>'
      + '</div>'
      + '<div style="padding:18px 22px;">'
      +   '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">'
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
    if (k === 'pnl')      { const d = this._lastRun('books_report_run_weeklypnl'); return d ? 'Report last run ' + d : 'Not run yet'; }
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
      return explain('Drop your bank or card statement and Bar Cop reads the bills off it, or enter one by hand. Every expense you log here is what your income statement reads from.')
        + '<div id="bk-moneyout"></div>'
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
      pnl:      ['A one-page profit and loss for any week range, the brief you keep for yourself or hand to your bookkeeper.', '<button class="btn btn-ghost btn-sm" data-act="weekly-pnl">Weekly P&amp;L Brief</button>'],
      review:   ['Open the income statement and make sure revenue, costs, and operating income read right before anything goes out.', '<button class="btn btn-ghost btn-sm" data-act="books">Income Statement</button>'],
      generate: ['Build the full workbook and one-page summary for your accountant. Nothing to re-type, it pulls from everything you logged.', '<button class="btn btn-ghost btn-sm" data-act="books">Month-End Books</button>']
    };
    const cfg = M[k];
    return explain(cfg[0]) + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + cfg[1] + markBtn + '</div>';
  },

  asNeeded(st) {
    const dueLabel = st.dueCount ? 'Licensing (' + st.dueCount + ' due)' : 'Licensing';
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;">'
      + '<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-right:4px;">As needed</span>'
      + '<button class="btn btn-ghost btn-sm" data-act="permits">' + dueLabel + '</button>'
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
      else if (act === 'permits')            S.HubPermits?.open?.();
      // 'this-week' is the CANONICAL id for "confirm the week": App.openScreen special-cases
      // it (app.js) to land the Profit dashboard AND pop the Confirm the Week modal, which is
      // the single weekly-close writer. Sending 'dashboard' here landed the dashboard with no
      // modal, so the step's own label went unanswered. Keep this key in step with the
      // day-one strip above — verify-action-key-wired.js pins that they agree (S260).
      else if (act === 'this-week')          App.openScreen('this-week');
      else if (act === 'ic-dashboard')       App.openScreen('ic-dashboard');
    };
    this.container.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => go(el.dataset.act)));
    this.container.querySelectorAll('.db-go').forEach(el => el.addEventListener('click', () => go(el.dataset.go)));
    this.container.querySelectorAll('.bk-step-head').forEach(h => h.addEventListener('click', () => {
      const k = h.dataset.step; this._openStep = (this._openStep === k) ? '' : k; this.render(this.container);
    }));
    this.container.querySelectorAll('[data-done]').forEach(b => b.addEventListener('click', () => { this.setDone(b.dataset.done, true); this._openStep = null; this.render(this.container); }));
    this.container.querySelectorAll('[data-undone]').forEach(b => b.addEventListener('click', () => { this.setDone(b.dataset.undone, false); this.render(this.container); }));
  }

};
