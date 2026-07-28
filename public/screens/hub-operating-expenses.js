'use strict';

/* ── Hub Operating Expenses Log ──────────────────────────────────────────────
   A Hub-owned view under Accounting. Per-entry log of operating expenses
   (rent, utilities, insurance, marketing, professional fees, bank/CC fees,
   licenses/permits, software/subscriptions, other). Books reads this log
   to fill the Income Statement Operating Expenses placeholder lines so the
   operator's accountant does not have to type them in by hand.

   Two-doors call: Repairs and Maintenance lives in Shift Control's
   sc_maintenance log. 3rd-Party Platform Fees live in the weekly P&L roll.
   Operating Expenses Log does NOT include those categories to avoid
   double-counting in Books.

   Sample data deferred per the pre-launch sample-data overhaul. */

S.HubOperatingExpenses = {

  // Locked category enum. Dropdown-only on the entry form. Books pulls from
  // these names by exact match — do not rename without updating Books too.
  CATEGORIES: [
    'Occupancy (Rent, Property Tax)',
    'Utilities',
    'Insurance',
    'Marketing and Advertising',
    'Professional Fees',
    'Bank and Credit Card Fees',
    'Licenses and Permits',
    'Software and Subscriptions',
    'Other'
  ],

  _tab:            'current',
  _entryMode:      'manual',   // manual | import (Add Expense form)
  _histShown:      0,          // History log window (0 = default to LIST_PAGE)
  _filterCategory: 'all',
  _filterRange:    'this-month',

  records() {
    if (!Array.isArray(App.data.operating_expenses)) App.data.operating_expenses = [];
    return App.data.operating_expenses;
  },

  // ── Entry ───────────────────────────────────────────────────────────────
  // Is this page still the one on screen? See the note in App._mountSeq — the Hub content host is
  // permanent, so isConnected can never answer this.
  _catchUpStillCurrent() { return this._mountedAt === App._mountSeq; },

  open() {
    App.openHubFullPage('Operating Expenses', (mount) => {
      this.container = mount;
      this._mountedAt = App._mountSeq;   // stamped inside the mount callback, AFTER openHubFullPage bumps it
      this.renderMain();
    }, 'operating-expenses');
  },

  // ── Period helpers ──────────────────────────────────────────────────────
  _monthKey(dateStr) {
    if (!dateStr) return '';
    return String(dateStr).slice(0, 7);
  },
  _currentMonthKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  },
  _priorMonthKey(monthKey) {
    const y = parseInt(monthKey.slice(0, 4), 10);
    const m = parseInt(monthKey.slice(5, 7), 10);
    let py = y, pm = m - 1;
    if (pm < 1) { pm = 12; py = y - 1; }
    return py + '-' + String(pm).padStart(2, '0');
  },
  _monthLabel(monthKey) {
    if (!monthKey || monthKey.length < 7) return monthKey;
    const y = parseInt(monthKey.slice(0, 4), 10);
    const m = parseInt(monthKey.slice(5, 7), 10) - 1;
    const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return (names[m] || '') + ' ' + y;
  },

  // Total revenue for a calendar month from the weekly rolls. Matches the
  // income statement's revenue base (bar + food + catering + other) so the
  // "% of Revenue" reads here agree with Books.
  _weekRev(w) {
    return (parseFloat(w.bar?.revenue) || 0) + (parseFloat(w.food?.revenue) || 0)
      + (parseFloat(w.catering?.revenue) || 0) + (parseFloat(w.other?.revenue) || 0);
  },
  _revenueForMonth(monthKey) {
    return (App.data?.weeks || []).filter(w => this._monthKey(w.period_end) === monthKey)
      .reduce((s, w) => s + this._weekRev(w), 0);
  },

  // Revenue year-to-date through the given month.
  _revenueYTD(monthKey) {
    const year = monthKey.slice(0, 4);
    return (App.data?.weeks || []).filter(w => {
      const mk = this._monthKey(w.period_end);
      return mk && mk.slice(0, 4) === year && mk <= monthKey;
    }).reduce((s, w) => s + this._weekRev(w), 0);
  },

  // ── Aggregation ────────────────────────────────────────────────────────
  _sumMonth(monthKey) {
    return this.records().filter(r => this._monthKey(r.date) === monthKey)
      .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  },
  _sumYTD(monthKey) {
    const year = monthKey.slice(0, 4);
    return this.records().filter(r => {
      const mk = this._monthKey(r.date);
      return mk && mk.slice(0, 4) === year && mk <= monthKey;
    }).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  },
  _sumMonthByCategory(monthKey) {
    const out = {};
    this.CATEGORIES.forEach(c => { out[c] = 0; });
    this.records().filter(r => this._monthKey(r.date) === monthKey).forEach(r => {
      const c = this.CATEGORIES.includes(r.category) ? r.category : 'Other';
      out[c] = (out[c] || 0) + (parseFloat(r.amount) || 0);
    });
    return out;
  },
  _sumYTDByCategory(monthKey) {
    const year = monthKey.slice(0, 4);
    const out = {};
    this.CATEGORIES.forEach(c => { out[c] = 0; });
    this.records().filter(r => {
      const mk = this._monthKey(r.date);
      return mk && mk.slice(0, 4) === year && mk <= monthKey;
    }).forEach(r => {
      const c = this.CATEGORIES.includes(r.category) ? r.category : 'Other';
      out[c] = (out[c] || 0) + (parseFloat(r.amount) || 0);
    });
    return out;
  },

  /* ⚠⚠ "HAS A WEEK IN IT" IS NOT "IS COMPLETE" — MY OWN FIRST VERSION OF THIS TOOK THE FORMER AND
     LEFT THE DEFECT LIVE, ONE MONTH BACK. Accepting any month with at least one confirmed week
     still divided a WHOLE month's booked expenses by PART of a month's revenue: measured 30.0%
     against a truth of 7.5% with one week of four confirmed, 15.0% with two, 10.0% with three.
     An operator behind on Confirm the Week, or one who signed up mid-month, got the identical
     whole-over-part shape the change was made to remove — now under a named, finished-looking month,
     which reads as settled fact rather than a partial reading.
     ⚠ COUNT DAYS COVERED, NOT WEEKS. A week record stands for the seven days ending on its
     period_end, so covering every day of the month is the honest test — it needs no assumption
     about the operator's week cadence, and unlike counting weeks it handles a GAP in the middle
     and a month with five week-ends rather than four.
     ⚠ AND THE COMMENT THIS REPLACES CITED A CONVENTION THAT DOES NOT EXIST. I wrote that this
     matched hub-books._availableMonths, "the most recent fully-completed month". That is what that
     function's COMMENT says; its CODE has no such filter and its picker offers today's partial
     month. Reading a comment and calling it the app's behaviour is the mistake this codebase has
     paid for repeatedly — the reasoning below stands on its own instead. */
  _monthRevenueComplete(monthKey) {
    if (!monthKey || monthKey.length < 7) return false;
    const y = parseInt(monthKey.slice(0, 4), 10), m = parseInt(monthKey.slice(5, 7), 10) - 1;
    const dim = this._daysInMonth(y, m);
    const covered = new Set();
    (App.data?.weeks || []).forEach(w => {
      const pe = String((w && w.period_end) || '').slice(0, 10);
      if (!pe) return;
      const end = new Date(pe + 'T00:00:00');
      if (isNaN(end.getTime())) return;
      for (let i = 0; i < 7; i++) {
        const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
        if (d.getFullYear() === y && d.getMonth() === m) covered.add(d.getDate());
      }
    });
    return covered.size >= dim;
  },

  // The most recent month whose revenue is genuinely all in. Today's month is excluded because it
  // cannot be complete, and every earlier month must pass _monthRevenueComplete.
  _lastCompleteMonthKey() {
    const cur = this._currentMonthKey();
    const keys = [...new Set((App.data?.weeks || []).map(w => this._monthKey(w && w.period_end)))]
      .filter(mk => mk && mk.length === 7 && mk < cur && this._monthRevenueComplete(mk));
    return keys.length ? keys.sort().pop() : '';
  },

  /* ⚠ ONE BASIS FOR BOTH "% OF REVENUE" FIGURES ON THIS SCREEN, so they cannot disagree about
     whether a usable period even exists. They did: with a confirmed ZERO-revenue week in the named
     month, the stat printed "—" with no month named while the By Category card headed its column
     "% of Revenue, YTD thru June 2026" and printed live percentages. One screen, two answers to
     "do we have June?". Both now ask this. */
  _pctBasis() {
    const mk = this._lastCompleteMonthKey();
    if (!mk) return null;
    const monthRev = this._revenueForMonth(mk);
    if (!(monthRev > 0)) return null;
    return { mk: mk, monthRev: monthRev, ytdRev: this._revenueYTD(mk) };
  },

  /* ⚠⚠ DOES THIS SERIES OWE A BILL FOR THIS MONTH AT ALL? ONE DEFINITION (S226 round 2, F3a). The
     catch-up loop and the "already logged" note both need this answer and the note re-derived a
     looser version of it — so it told the operator Bar Cop had suppressed a QUARTERLY bill in a
     month that bill was never due, an ANNUAL one likewise, a term that ended two months ago, a
     series that has not started yet, and a month the operator had DELETED, which has its own cause
     entirely. Five false claims, every one measured. */
  _owesMonth(p, monthKey) {
    if (!p || !p.recurring || p.recurring_parent || !p.date || !monthKey) return false;
    const s = new Date(String(p.date).length <= 10 ? p.date + 'T00:00:00' : p.date);
    if (isNaN(s.getTime())) return false;
    const startIdx = s.getFullYear() * 12 + s.getMonth();
    const idx = parseInt(monthKey.slice(0, 4), 10) * 12 + (parseInt(monthKey.slice(5, 7), 10) - 1);
    const term = parseInt(p.term_months, 10);
    const step = p.frequency === 'quarterly' ? 3 : p.frequency === 'annual' ? 12 : 1;
    if (idx <= startIdx) return false;                              // the start month is the parent's own row
    if (term > 0 && idx > startIdx + term - 1) return false;        // the fixed term is paid off
    if ((idx - startIdx) % step !== 0) return false;                // not a month this bill recurs in
    // A month the operator DELETED is a decision that has to outlive the re-render (S226a) — and
    // the same list carries the months a series was PAUSED for (see _stopRecurring / the resume in
    // the edit form). Array.isArray, not a bare `||`: a non-array here throws in four places.
    if (this._skips(p).some(m => String(m) === monthKey)) return false;
    return true;
  },

  // Months this series must not bill: ones the operator deleted, and ones it was paused for.
  _skips(p) { return (p && Array.isArray(p.skip_months)) ? p.skip_months : []; },

  // Every month from `from` up to but NOT including the current month. The resume month itself bills
  // normally — turning a bill back on means you are paying it again from now.
  _monthsBetween(from, toExclusive) {
    const idx = (mk) => parseInt(mk.slice(0, 4), 10) * 12 + (parseInt(mk.slice(5, 7), 10) - 1);
    const out = [];
    if (!from || !toExclusive) return out;
    for (let i = idx(from); i < idx(toExclusive); i++) {
      out.push(Math.floor(i / 12) + '-' + String((i % 12) + 1).padStart(2, '0'));
    }
    return out;
  },

  /* ⚠⚠ A BILL THE OPERATOR LOGGED THEMSELVES ALREADY COVERS THAT MONTH (S226c). The catch-up only
     ever recognised its OWN generated children, so an operator who set up a recurring rent bill AND
     logged the rent — by hand, or off a bank register through the importer, which S227's review box
     explicitly invites them to do — got BOTH: measured $8,400 against a truth of $4,200 for the
     month, straight into Books' operating-expense lines, This Month, YTD, By Category and breakeven.
     ⚠ AND IT WAS NEVER SILENT-FIXABLE BEFORE (S226a): deleting the generated copy re-minted it in
     the same breath, so the operator had no escape but Stop, which drops the bill out of break-even
     and the cash forecast entirely.
     ⚠ NOT SILENT. Suppressing a row the operator can see in their own file is exactly the thing that
     makes them stop trusting the total, so _renderCurrent NAMES every month this covered.
     ⚠ SAME KEY AS THE CASH FORECAST. App.billIdentityKey is the one definition; CashEngine
     .projectedBills had the identical blind spot and now asks the same question the same way. */
  _ownCover(p, monthKey, used) {
    if (!p || !monthKey) return null;
    const key = App.billIdentityKey(p);
    const hit = this.records().find(r => r && r.date && !r.recurring && !r.recurring_parent
      && String(r.date).slice(0, 7) === monthKey && App.billIdentityKey(r) === key
      && !(used && used.has(r.id))) || null;
    if (hit && used) used.add(hit.id);   // one logged bill stands down one series, not all of them
    return hit;
  },

  // A generated row already standing for this month of this series.
  _generatedFor(p, monthKey) {
    return this.records().find(r => r && r.recurring_parent === p.id
      && String(r.recurring_month || String(r.date || '').slice(0, 7)) === monthKey) || null;
  },

  /* Series where a bill the operator logged themselves STOPPED Bar Cop generating one this month.
     ⚠ Only where it genuinely would have: the same _owesMonth schedule test the catch-up uses, and
     only where nothing has been generated for that month already. Without the second clause this
     claimed credit for a suppression that never happened — see _doubleBookedThisMonth, which is the
     case that was hiding behind it. */
  _ownCoveredThisMonth() {
    const mk = this._currentMonthKey();
    return this.records()
      .filter(p => p && this._owesMonth(p, mk) && !this._generatedFor(p, mk) && this._ownCover(p, mk))
      .map(p => (p.vendor || p.category || 'A recurring bill'));
  },

  /* ⚠⚠ THE MONTH REALLY IS BOOKED TWICE, AND THE OLD NOTE SAT ON TOP OF IT SAYING THE OPPOSITE.
     Order matters: if the operator logs the bill BEFORE the month is generated, _ownCover stops the
     generation and there is nothing to report but the fact. If the row is generated FIRST — which
     is the ordinary case, it happens the day the month arrives — and the same bill then arrives off
     a bank register dated the day it CLEARED, the importer cannot see it (its dedup needs an exact
     date match) and the month reads double. Measured: $1,624.80 for an $812.40 bill, under a banner
     reading "Bar Cop did not add it again from your recurring bills."
     Suppressing one of them is not Bar Cop's call — two payments to one vendor in a month happen —
     so this NAMES it and leaves the decision where it belongs ([[user-chooses-conflicts]]). */
  /* ⚠ STRICT FOR THE ACTION, LOOSE FOR THE WARNING — and that asymmetry is the point. Suppression
     changes a number, so it demands an exact identity match (category + vendor + AMOUNT). This only
     PRINTS A SENTENCE, so it matches on category + vendor and ignores the amount: correcting the
     bill you logged from $4,200 to $4,250 used to re-open the slot silently and book a second
     $4,200 on top, and a strict test could not see that at all because the amounts no longer agree.
     A false positive here costs a sentence; a false negative costs a doubled month. */
  _doubleBookedThisMonth() {
    const mk = this._currentMonthKey();
    const arr = this.records();
    const loose = (r) => String(r.category || '') + '|' + String(r.vendor || '').trim().toLowerCase();
    const cents = (r) => Math.round((parseFloat(r.amount) || 0) * 100);
    return arr
      .filter(p => p && p.recurring && !p.recurring_parent && this._generatedFor(p, mk)
        && arr.some(r => r && r.date && !r.recurring && !r.recurring_parent
          && String(r.date).slice(0, 7) === mk
          // Either half is enough, and they cover different doors — see the note above.
          && (loose(r) === loose(p) || (cents(r) === cents(p) && cents(p) !== 0))))
      .map(p => (p.vendor || p.category || 'A recurring bill'));
  },

  // ── Recurring bills ──────────────────────────────────────────────────────
  // A recurring bill is the parent record (recurring:true). It is ongoing by
  // default (recurs every month until the operator stops it); an optional
  // term_months makes it stop after a fixed number of payments. Each elapsed
  // month gets a generated child entry (recurring_parent) with the same cost.
  // Only months that have actually arrived are created, never future months, so
  // Books only ever shows recurring costs through this month. Honest by
  // [[output-honesty]]: the operator confirmed a fixed monthly cost, so filling in
  // each elapsed month is calculating from what they entered.
  _daysInMonth(y, m0) { return new Date(y, m0 + 1, 0).getDate(); },

  // ⚠ Generated rows are NOT put into memory until the server has them. What shipped pushed each
  // child into the live list and then fired the write without awaiting or checking it — so a
  // failed write left Books, the P&L and breakeven counting operating expenses the server never
  // received, until the next reload silently removed them. This runs from App.boot(), so it is
  // every login. These rows are derived (regenerated from the parent on any later load), which is
  // exactly why waiting for confirmation costs nothing.
  // No caller uses the return value, so making this async is safe.
  //
  // ⚠ SERIALIZED, and it has to be. The dedupe set `have` below is built from `arr`, but the
  // generated rows deliberately do not reach `arr` until the server confirms them — so for the whole
  // round-trip the dedupe is BLIND to them. All three callers fire without awaiting (App.boot():676
  // at every login, plus renderMain / renderHistory), so a second pass entered inside that window
  // saw an empty `have` and regenerated every owed month with fresh App.uid()s. Both sets persist
  // (the server key is the id) and the rows are byte-identical apart from it, so a $4,200 rent with
  // three owed months landed in Books, the P&L, breakeven and prime cost as $25,200 instead of
  // $12,600, permanently and invisibly. One click inside the round-trip on the first login of a new
  // month is enough: Expense History, saving, deleting, or stopping a bill all reach _rerender.
  // CHAINING, not dropping the second call: an operator who adds a back-dated bill while the boot
  // pass is still in flight must still get that bill's months. Each pass reads `arr` only after the
  // previous one has pushed into it, so overlap is impossible and nothing is skipped.
  catchUpRecurring() {
    const run = () => this._catchUpOnce();
    const chain = this._catchUpChain ? this._catchUpChain.then(run) : run();
    // A rejected pass must not become an unhandledrejection: App.boot() (app.js:682) fires this
    // without awaiting or catching, and a call with nothing chained after it has no other handler.
    // Swallow+log at the tail; the caught promise is what the next call chains onto, so a failed
    // pass still lets a later back-dated bill catch up, and passes stay serialized (never overlap).
    this._catchUpChain = chain.catch(e => { try { DB.logClientError('opex_catchup', (e && e.message) || String(e), (e && e.stack) || '', 'hub-operating-expenses'); } catch (e2) {} });
    return this._catchUpChain;
  },
  _catchUpChain: null,

  async _catchUpOnce() {
    // Never generate derived rows from a picture the app admits is incomplete. Its peers already
    // refuse to (profit-fix.js:101 and r-fix.js open with the same _dataReady test, and
    // App._maybeAutoBackup bails on _loadDegraded); this one checked neither. A degraded load is
    // served from a cache that can be months stale and is missing the children, so the dedupe cannot
    // see them and would mint new ids for months that already exist — the same double-booking by a
    // different door. Nothing is lost by waiting: these rows are derived and regenerate from the
    // parent on any later clean load.
    if (!App.data || !DB._dataReady || DB._loadDegraded) return false;
    const arr = this.records();
    const now = new Date();
    const curIdx = now.getFullYear() * 12 + now.getMonth();
    const parents = arr.filter(r => r && r.recurring && !r.recurring_parent && r.date);
    let added = false; const newRecs = [];
    // ⚠ ONE LOGGED BILL SUPPRESSES ONE SERIES, NOT EVERY SERIES IT MATCHES (S226 round 2). Two
    // identical parents both found the same hand-entered row and both stood down. Same consume-once
    // shape the importer's dedup uses.
    const usedOwn = new Set();
    parents.forEach(p => {
      const start = new Date(String(p.date).length <= 10 ? p.date + 'T00:00:00' : p.date);
      if (isNaN(start.getTime())) return;
      const startIdx = start.getFullYear() * 12 + start.getMonth();
      const term = parseInt(p.term_months, 10);
      const recurDay = p.recur_day || start.getDate();
      // Recurrence interval in months: monthly (1), quarterly (3), annual (12).
      const step = p.frequency === 'quarterly' ? 3 : p.frequency === 'annual' ? 12 : 1;
      // Ongoing (no term) fills through the current month; a fixed term stops at its end.
      const lastIdx = term > 0 ? Math.min(curIdx, startIdx + term - 1) : curIdx;
      const have = new Set([start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0')]);
      /* ⚠⚠ A DELETED MONTH IS A DECISION, AND IT HAS TO BE RECORDED SOMEWHERE THE CATCH-UP CAN SEE
         (S226a). The dedupe was built ONLY from the months this parent's own children occupy, so
         removing a child removed the very evidence that stopped it being re-created: _delete ->
         _rerender -> renderMain -> catchUpRecurring re-minted it with a fresh id in the same breath.
         Measured: a July rent row deleted and back, id gen3 -> gen4, total unmoved at $16,800. The
         Delete button on a generated row did nothing at all, permanently, and the only escape was
         Stop — which drops the bill out of break-even and the cash forecast. */
      /* ⚠⚠ THE MONTH A CHILD SATISFIES IS A FACT ABOUT THE SCHEDULE, NOT ABOUT THE DATE TYPED IN IT
         (S226b). Keying on the date's month meant that moving a generated row's due date across a
         month boundary FREED ITS SLOT, and the next catch-up minted a replacement: measured 4 rows /
         $16,800 -> 5 rows / $21,000, in BOTH directions (forward to next month, and backward onto a
         month that already had a child). Rescheduling when a bill is paid is not ordering another
         one. `recurring_month` is stamped at generation below; children written before this fall back to
         the date, which is what they were keyed on anyway.
         Same shape as [[the-loop]] #37: if a field means "how did this row get here", ask what an
         EDIT does to it. */
      arr.forEach(r => { if (r && r.recurring_parent === p.id && r.date) have.add(String(r.recurring_month || String(r.date).slice(0, 7))); });
      for (let idx = startIdx + step; idx <= lastIdx; idx += step) {
        const yy = Math.floor(idx / 12), mm = idx % 12;
        const mk = yy + '-' + String(mm + 1).padStart(2, '0');
        // Schedule + the months the operator deleted, in ONE place both this and the note read.
        if (!this._owesMonth(p, mk)) continue;
        if (have.has(mk)) continue;
        // The operator already logged this month's bill themselves — see _ownCover.
        if (this._ownCover(p, mk, usedOwn)) continue;
        const dd = Math.min(recurDay, this._daysInMonth(yy, mm));
        const child = {
          id: App.uid ? App.uid() : ('oex-' + idx + '-' + p.id),
          date: mk + '-' + String(dd).padStart(2, '0'),
          category: p.category, vendor: p.vendor, amount: p.amount, notes: p.notes,
          recurring_parent: p.id,
          recurring_month: mk,   // the month this child SATISFIES — see the dedupe note above (S226b)
          created_at: new Date().toISOString()
        };
        newRecs.push(child);   // NOT pushed into arr yet — see the note on this function
        have.add(mk);
        added = true;
      }
    });
    if (!newRecs.length) return false;
    // quiet: this fires from a boot and from a render, never from something the operator did.
    if (!(await App.putRecordsBulk('core', 'operating_expense', newRecs, { quiet: true }))) return false;
    arr.push(...newRecs);
    // Re-render once, and only on success, so the screen picks up the caught-up months. Cannot
    // loop: the dedupe above finds them already present next time and generates nothing.
    // ⚠ This USED to ask `this.container.isConnected`, which can never be false: `.hub-app .content`
    // is a permanent host that navigation merely empties and refills. So a catch-up that landed
    // after the operator clicked Permits repainted Operating Expenses over it, with the sidebar
    // still highlighting Permits. App._mountSeq is bumped on every mount, so a changed value means
    // this page is no longer the one on screen.
    if (this._catchUpStillCurrent()) {
      if (this._view === 'history') this.renderHistory(); else this.renderMain();
    }
    return added;
  },

  // Banner for recurring terms within ~2 months of ending or already ended.
  _termWarning() {
    const now = new Date();
    const curIdx = now.getFullYear() * 12 + now.getMonth();
    const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const lbl = (idx) => MON[idx % 12] + ' ' + Math.floor(idx / 12);
    const ending = this.records().filter(r => r && r.recurring && !r.recurring_parent && r.date && parseInt(r.term_months, 10) > 0).map(p => {
      const s = new Date(String(p.date).length <= 10 ? p.date + 'T00:00:00' : p.date);
      if (isNaN(s.getTime())) return null;
      const endIdx = s.getFullYear() * 12 + s.getMonth() + parseInt(p.term_months, 10) - 1;
      const rem = endIdx - curIdx;
      /* ⚠ A FLOOR, NOT JUST A CEILING (S226e). There was no lower bound, so a fixed term that ended
         years ago warned FOREVER: measured, a 12-month bill that finished in Jun 2020 still printed
         "Landlord LLC (ended Jun 2020)" in the amber "Recurring Terms Ending" banner on every open,
         with a permanent Renew button beside it. A standing "needs attention" claim about a decision
         the operator made years ago is how a banner gets ignored, including the times it is real.
         The series itself is already correctly out of the numbers — CashEngine.weeklyFixedCosts and
         hub-breakeven both drop a term that is fully paid — so the banner was the only thing lying.
         Two months either side: long enough to prompt a renewal, short enough to mean something. */
      if (rem > 2 || rem < -2) return null;
      return (p.vendor || p.category || 'Recurring bill') + (rem < 0 ? ' (ended ' + lbl(endIdx) + ')' : ' (ends ' + lbl(endIdx) + ')');
    }).filter(Boolean);
    if (!ending.length) return '';
    return '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Recurring Terms Ending</div>'
      + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">' + esc(ending.join(', ')) + '. Renew or update the term in the edit form, or it stops adding after the end month.</div>'
      + '</div>';
  },

  // ── Filter ─────────────────────────────────────────────────────────────
  _filteredRecords() {
    let recs = this.records().slice();
    if (this._filterCategory && this._filterCategory !== 'all') {
      recs = recs.filter(r => r.category === this._filterCategory);
    }
    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = App.todayLocal();
    if (this._filterRange === 'this-month') {
      const mk = this._currentMonthKey();
      recs = recs.filter(r => this._monthKey(r.date) === mk);
    } else if (this._filterRange === 'last-month') {
      const mk = this._priorMonthKey(this._currentMonthKey());
      recs = recs.filter(r => this._monthKey(r.date) === mk);
    /* ⚠⚠ BOTH BACKWARD-LOOKING RANGES ARE BOUNDED AT THE TOP (S222). Neither was, so a future-dated
       expense — a mistyped year on a bill, or one typed forward on purpose — appeared under a chip
       that says "Year to DATE" or "Last 12 Months", and flowed from there into the By Category card
       and that range's export PDF.
       Demonstrated with BARCOP-TEST-E: a row dated 2027-03-01 showed under **Last 12 Months**.
       ⚠ `this-month` and `next-month` are deliberately NOT bounded — this screen shows the month
       ahead on purpose (that is what the Next Month card is for). Only the ranges whose LABEL says
       "to date" or "last" are backward-looking claims.
       ⚠ 12 months is not 365 days, so the month arithmetic stays and this cannot use App.inWindow;
       the upper bound is added explicitly. */
    } else if (this._filterRange === 'ytd') {
      /* ⚠⚠ YEAR-ONLY, NOT DAY-BOUNDED — I ADDED A DAY BOUND HERE AND IT WAS WRONG (S222 → S224).
         Operating expenses are carried on a MONTH basis everywhere else: `_sumYTD` and
         `hub-books._opExSums` both use `mk <= monthKey`, so a bill dated later THIS month is already
         part of this month's YTD. Day-bounding this chip made it disagree with the By Category card
         sitting directly above it on the same screen — $1,200 under $2,180 — which is the exact
         "two numbers for one claim" defect it was meant to prevent.
         A future-dated row is still excluded from the wrong YEAR, which is what TEST-E's 2027 row
         needed. `last-12` below keeps its ceiling: nothing else computes "last 12 months", and a
         row eight months ahead is not in it by any reading. */
      /* ⚠ CAPPED AT THE CURRENT MONTH, exactly like `_sumYTD` and `hub-books._opExSums` (`mk <=
         monthKey`). Year-only was the ORIGINAL rule and it already disagreed with those two for a
         row dated a LATER MONTH of this year — a bill pre-entered for September while it is July
         counted here and not in Books. Surfaced by a control that went red when the clock rolled
         past its fixture. The three YTD figures on this screen are now one number by construction. */
      const mkNow = this._currentMonthKey();
      recs = recs.filter(r => { const mk = this._monthKey(r.date); return mk && mk.slice(0, 4) === String(today.getFullYear()) && mk <= mkNow; });
    } else if (this._filterRange === 'last-12') {
      const cutoff = new Date(today); cutoff.setMonth(cutoff.getMonth() - 12);
      recs = recs.filter(r => r.date && r.date <= todayStr && new Date(r.date + 'T00:00:00') >= cutoff);
    }
    // Newest first.
    recs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return recs;
  },

  // ── Main render ────────────────────────────────────────────────────────
  renderMain() {
    this.catchUpRecurring();   // fill in any elapsed months for recurring bills
    this._view = 'current';
    this.container.innerHTML = '<div class="screen">' + this._renderCurrent() + '</div>';
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    this._wireCurrent();
  },

  // ── Expense History (its own Books page; the read-only log of past months) ──
  renderHistory(mount) {
    // ⚠ A `mount` argument means this is a FRESH mount (openHubFullPage has just
    // bumped App._mountSeq), so the token is stamped HERE, exactly as open() does at
    // :52. S.HubExpenseHistory.open() delegated straight into this function without
    // stamping, so `_mountedAt` was permanently stale and `_catchUpStillCurrent()`
    // could only ever be FALSE — the catch-up repaint below was refused 100% of the
    // time. The operator opened Expense History on the first login of a new month,
    // this month's rent was written to the server and pushed into memory, and the
    // page they were looking at never showed it. Adding it by hand then double-booked
    // it into Books, the P&L, breakeven and prime cost. Stamping at the mount entry
    // point rather than in the caller covers any future door into this page.
    // (It also un-deadened `:230`'s history branch, which was unreachable because
    // `_view` only becomes 'history' by way of this never-stamped mount.)
    if (mount) { this.container = mount; this._mountedAt = App._mountSeq; }
    this.catchUpRecurring();
    this._view = 'history';
    this.container.innerHTML = '<div class="screen">' + this._historyStats() + this._renderHistory() + '</div>';
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    this._wireHistory();
  },
  _historyStats() {
    const fmt$ = (v) => App.fmtCurrency(v || 0);
    const recs = this.records();
    const yr = String(new Date().getFullYear());
    const total = recs.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    // ⚠ YEAR-ONLY, matching `_sumYTD` and `hub-books._opExSums` (S224). I briefly day-bounded this
    // and it put $1,200 directly under a By Category card reading $2,180 for the same period — a
    // recurring bill due on the 28th is "future" for most of every month, so it fired monthly.
    // Operating expenses are carried on a MONTH basis app-wide; this figure follows that.
    const mkNow = this._currentMonthKey();
    const ytd = recs.filter(r => { const mk = this._monthKey(r.date); return mk && mk.slice(0, 4) === yr && mk <= mkNow; })
      .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const stat = (label, val) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg">' + val + '</div></div>';
    return '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + stat('Logged This Year', fmt$(ytd)) + stat('Logged All Time', fmt$(total)) + stat('Entries', String(recs.length))
      + '</div></div>';
  },
  // Re-render whichever view is active (Operating Expenses or Expense History),
  // so an edit / delete / stop redraws the page the operator is actually on.
  _rerender() { if (this._view === 'history') this.renderHistory(); else this.renderMain(); },

  _nextMonthKey(mk) {
    const y = parseInt(mk.slice(0, 4), 10);
    let m = parseInt(mk.slice(5, 7), 10) + 1, ny = y;
    if (m > 12) { m = 1; ny = y + 1; }
    return ny + '-' + String(m).padStart(2, '0');
  },

  // True when this entry's recurring series ends within ~2 months (or has ended).
  _isSeriesEnding(r) {
    const arr = this.records();
    const p = this._seriesOf(r);
    if (!p || !p.recurring || !(parseInt(p.term_months, 10) > 0) || !p.date) return false;
    const s = new Date(String(p.date).length <= 10 ? p.date + 'T00:00:00' : p.date);
    if (isNaN(s.getTime())) return false;
    const now = new Date();
    const endIdx = s.getFullYear() * 12 + s.getMonth() + parseInt(p.term_months, 10) - 1;
    // Same window as _termWarning's banner, both ends (S226e) — the Renew button and the banner that
    // tells you to press it must appear and disappear together.
    const rem = endIdx - (now.getFullYear() * 12 + now.getMonth());
    return rem <= 2 && rem >= -2;
  },

  /* The series a row belongs to, or null. An orphaned child — one whose parent was deleted before
     _delete learned to detach them (S226h) — is not part of any series, and treating it as one is
     what put a Stop button on it that returns before it even asks for confirmation. Existing
     accounts can already hold these rows, so the display has to answer this too, not just the
     delete path that stops new ones being made. */
  _seriesOf(r) {
    if (!r) return null;
    if (!r.recurring_parent) return r.recurring ? r : null;
    // ⚠ A LIVE series only. A stopped parent correctly renders Repeat/Edit/Delete, but its children
    // went on rendering the "recurring" tag and a Stop button for a series that is already stopped —
    // one row disagreeing with another about the same bill, on the same card.
    const p = this.records().find(x => x && x.id === r.recurring_parent) || null;
    return (p && p.recurring) ? p : null;
  },

  _recurTag(rec) {
    const p = rec && rec.recurring_parent ? this.records().find(x => x.id === rec.recurring_parent) : rec;
    const f = p && p.frequency && p.frequency !== 'monthly' ? ' · ' + p.frequency : '';
    return ' <span style="color:var(--t4);font-size:10px;white-space:nowrap;">recurring' + f + '</span>';
  },

  // One real-record row: Date, Category (+Recurring tag), Vendor, Amount, actions.
  // opts.minimal (History) = Edit + Delete only — Duplicate and Renew are
  // forward-looking, so they live on the Current tab (this/next month) only.
  _logRowHtml(r, opts) {
    opts = opts || {};
    const fmt$ = (v) => App.fmtCurrency(v || 0);
    const isRec = !!this._seriesOf(r);   // an orphan is not a series — see _seriesOf (S226h)
    const edit = '<button class="btn btn-ghost btn-sm oex-edit" data-id="' + esc(r.id) + '">Edit</button>';
    const del  = '<button class="btn btn-danger btn-sm oex-del" data-id="' + esc(r.id) + '">Delete</button>';
    let actions = '';
    if (opts.minimal) {
      actions = edit + del;
    } else if (isRec) {
      if (this._isSeriesEnding(r)) actions += '<button class="btn btn-ghost btn-sm oex-renew" data-id="' + esc(r.id) + '" style="color:var(--gold);">Renew</button>';
      actions += '<button class="btn btn-ghost btn-sm oex-stop" data-id="' + esc(r.id) + '">Stop</button>' + edit + del;
    } else {
      actions += '<button class="btn btn-ghost btn-sm oex-dup" data-id="' + esc(r.id) + '">Repeat</button>' + edit + del;
    }
    return '<tr>'
      + '<td data-label="Date" style="color:var(--t1);white-space:nowrap;">' + esc(r.date || '') + '</td>'
      + '<td style="color:var(--t2);">' + esc(r.category || '') + (isRec ? this._recurTag(r) : '') + '</td>'
      + '<td style="color:var(--t2);">' + esc(r.vendor || '') + '</td>'
      + '<td style="font-weight:700;color:var(--t1);">' + fmt$(r.amount) + '</td>'
      + '<td class="no-print" style="text-align:right;white-space:nowrap;">' + actions + '</td>'
      + '</tr>';
  },

  // Expected (not-yet-booked) recurring rows for a future month: a forecast only.
  _expectedRecurring(monthKey) {
    const arr = this.records();
    const idx = parseInt(monthKey.slice(0, 4), 10) * 12 + (parseInt(monthKey.slice(5, 7), 10) - 1);
    const out = [];
    arr.filter(p => p.recurring && !p.recurring_parent && p.date).forEach(p => {
      const s = new Date(String(p.date).length <= 10 ? p.date + 'T00:00:00' : p.date);
      if (isNaN(s.getTime())) return;
      // Start / step / term / skipped months: the SAME test the catch-up uses, so the Next Month
      // card and the months actually generated cannot disagree about the schedule.
      if (!this._owesMonth(p, monthKey)) return;
      // ⚠ A CHILD IS MATCHED ON THE MONTH IT SATISFIES (S226b); only the parent row itself is
      // matched on its date. Keying both on the date meant a re-dated row claimed a month it does
      // not pay for, and the Expected line for the month it moved INTO disappeared.
      if (arr.some(r => r && (r.id === p.id
            ? String(r.date || '').slice(0, 7) === monthKey
            : (r.recurring_parent === p.id && String(r.recurring_month || String(r.date || '').slice(0, 7)) === monthKey)))) return;
      // And a bill they already logged themselves — without this the card printed an Expected rent
      // directly underneath the rent they had entered (S226c).
      if (this._ownCover(p, monthKey)) return;
      out.push(p);
    });
    return out;
  },

  // One month's expenses, split into a Recurring card and a Variable card. The
  // section name is the first column header (no separate header row), so the
  // header reads "Recurring | Category | Vendor | Amount". opts.next = the
  // next-month card (recurring shows as Expected, not booked).
  _monthCardHtml(monthKey, opts) {
    opts = opts || {};
    const fmt$ = (v) => App.fmtCurrency(v || 0);
    const recs = this.records().filter(r => String(r.date || '').slice(0, 7) === monthKey);
    const byDate = (a, b) => String(a.date || '').localeCompare(String(b.date || ''));
    const recurring = recs.filter(r => r.recurring || r.recurring_parent).sort(byDate);
    const variable  = recs.filter(r => !(r.recurring || r.recurring_parent)).sort(byDate);
    const expected  = opts.next ? this._expectedRecurring(monthKey) : [];

    const emptyRow = (txt) => '<tr><td colspan="5" style="padding:12px;color:var(--t3);font-size:12px;text-align:center;">' + txt + '</td></tr>';
    const expectedRow = (p) => '<tr style="opacity:0.6;">'
      + '<td data-label="Date" style="color:var(--t3);white-space:nowrap;">Expected</td>'
      + '<td style="color:var(--t2);">' + esc(p.category || '') + this._recurTag(p) + '</td>'
      + '<td style="color:var(--t2);">' + esc(p.vendor || '') + '</td>'
      + '<td style="color:var(--t2);">' + fmt$(p.amount) + '</td>'
      + '<td class="no-print" style="text-align:right;white-space:nowrap;"><button class="btn btn-ghost btn-sm oex-stop" data-id="' + esc(p.id) + '">Stop</button></td></tr>';
    // The first column header carries the section name; the rest are the columns.
    const sectionCard = (name, rowsHtml) => '<div class="card" style="margin-bottom:14px;overflow-x:auto;">'
      + '<table class="row-list">'
      +   '<colgroup><col style="width:13%"><col style="width:27%"><col style="width:24%"><col style="width:14%"><col style="width:22%"></colgroup>'
      +   '<thead><tr><th>' + name + '</th><th>Category</th><th>Vendor</th><th>Amount</th><th class="no-print"></th></tr></thead>'
      +   '<tbody>' + rowsHtml + '</tbody>'
      + '</table></div>';

    const recRows = (recurring.length || expected.length)
      ? recurring.map(r => this._logRowHtml(r)).join('') + expected.map(expectedRow).join('')
      : emptyRow('No recurring bills ' + (opts.next ? 'expected next month.' : 'this month.'));
    const varRows = variable.length
      ? variable.map(r => this._logRowHtml(r)).join('')
      : emptyRow(opts.next ? 'Nothing logged for next month yet.' : 'No variable expenses logged this month yet.');

    const heading = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">' + (opts.next ? 'Next Month' : 'This Month') + ' · ' + esc(this._monthLabel(monthKey)) + '</div>'
      + (opts.exportId ? '<button class="btn btn-ghost btn-sm no-print" id="' + opts.exportId + '">Export PDF</button>' : '')
      + '</div>';
    const wrap = opts.wrapId ? ' id="' + opts.wrapId + '"' : '';
    return heading + '<div' + wrap + '>' + sectionCard('Recurring', recRows) + sectionCard('Variable', varRows) + '</div>';
  },

  // ── Current tab: stats + add form + This Month / Next Month cards ─────────
  _renderCurrent() {
    const mk = this._currentMonthKey();
    const monthTotal = this._sumMonth(mk);
    const ytdTotal   = this._sumYTD(mk);
    /* ⚠⚠ A RATIO NEEDS ONE PERIOD ON BOTH SIDES, AND THIS ONE HAD TWO (S226d). It divided the
       month's WHOLE booked nut — recurring bills are generated in full the day the month arrives,
       and a bill dated the 28th is booked from the 1st — by revenue from the weeks CONFIRMED SO FAR.
       Measured on one month: 35.0% in week one against 8.7% for the same completed month, under a
       label with no period on it at all, sitting beside two stats that genuinely are "this month".
       Roughly 4x every time, always in the alarming direction, and it corrected itself as the month
       filled up — which is worse than being steadily wrong, because it looks like a trend.
       THE BASIS IS BOOKS' OWN: the most recent fully-completed month, today's month excluded
       (hub-books._availableMonths). The label now says which month it is. */
    const pctB       = this._pctBasis();
    const pctMk      = pctB ? pctB.mk : '';
    const monthOpExPct = pctB ? (this._sumMonth(pctB.mk) / pctB.monthRev) : null;
    const fmt$ = (v) => App.fmtCurrency(v || 0);
    const fmtPct = (v) => v == null ? '—' : (v * 100).toFixed(1) + '%';

    const stat = (label, val) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg">' + val + '</div></div>';
    const statsCard = '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + stat('This Month', fmt$(monthTotal)) + stat('Year to Date', fmt$(ytdTotal))
      + stat('OpEx % of Revenue' + (pctMk ? ' &middot; ' + esc(this._monthLabel(pctMk)) : ''), fmtPct(monthOpExPct))
      + '</div></div>';

    const warnBanner = this._termWarning();

    /* ⚠ NEVER SILENTLY. _ownCover stops a recurring month being generated on top of a bill the
       operator logged themselves (S226c) — which is right, and is exactly the kind of thing that
       must be said out loud rather than left as a row they expected to see and cannot find. */
    const noteBox = (body) => '<div style="background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:6px;padding:11px 16px;margin:16px 0;font-size:12px;color:var(--t1);line-height:1.6;">'
      + body + '</div>';
    const covered = this._ownCoveredThisMonth();
    const doubled = this._doubleBookedThisMonth();
    const coveredNote = (covered.length
      ? noteBox(esc(covered.join(', ')) + (covered.length === 1 ? ' is already logged for ' : ' are already logged for ')
        + esc(this._monthLabel(mk)) + ', so Bar Cop did not add ' + (covered.length === 1 ? 'it' : 'them')
        + ' again from your recurring bills.')
      : '')
      // The action note comes SECOND and reads as an action, because it is one.
      + (doubled.length
      ? noteBox(esc(doubled.join(', ')) + (doubled.length === 1 ? ' is booked twice for ' : ' are booked twice for ')
        + esc(this._monthLabel(mk)) + ' &mdash; once from your recurring bill and once from a bill you logged. '
        + 'Delete whichever is not real.')
      : '');

    const catOpts = this.CATEGORIES.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
    const segBtn = (mode, label) => '<button type="button" class="btn btn-sm oexa-mode" data-mode="' + mode + '" style="'
      + (this._entryMode === mode ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;' : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    const segToggle = '<div class="seg-toggle">' + segBtn('manual', 'Enter Manually') + segBtn('import', 'Import File') + '</div>';

    let bodyInner, addButtons = '';
    if (this._entryMode === 'import') {
      bodyInner = segToggle + '<div id="oexa-csv"></div>';
      addButtons = '<div id="oexa-imp-actions" style="margin:16px 0 24px;"></div>';
    } else {
      bodyInner = segToggle
        + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
        +   '<div class="f" style="width:150px;"><label>Date Submitted</label><input type="date" value="' + App.todayLocal() + '" disabled title="When you logged this. Always today."/></div>'
        +   '<div class="f" style="width:150px;"><label>Due Date</label><input type="date" id="oexa-date" value="' + App.todayLocal() + '"/></div>'
        +   '<div class="f" style="width:230px;"><label>Category' + App.manageListLink('expense_category') + '</label>' + App.customSelect({ id: 'oexa-cat', key: 'expense_category', builtin: this.CATEGORIES, blank: true, blankLabel: 'Select category...' }) + '</div>'
        +   '<div class="f" style="width:240px;"><label>Vendor</label><input type="text" id="oexa-vendor" placeholder="Who did you pay"/></div>'
        +   '<div class="f" style="width:140px;"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="oexa-amount" step="0.01" min="0" placeholder="0.00"/></div></div>'
        + '</div>'
        + '<div style="margin-top:14px;"><label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--t1);cursor:pointer;"><input type="checkbox" class="bc-check" id="oexa-recurring"/> Recurring bill (same cost each time)</label></div>'
        + '<div id="oexa-term-wrap" style="margin-top:12px;display:none;">'
        +   '<div style="font-size:11px;color:var(--gold);margin-bottom:12px;max-width:540px;line-height:1.5;">Set the <b>Due Date</b> above to when this bill is next actually due. The schedule repeats from that date, not from today.</div>'
        +   '<div class="f" style="max-width:540px;"><label>How often</label><select id="oexa-frequency" style="width:200px;"><option value="monthly">Monthly</option><option value="quarterly">Quarterly (every 3 months)</option><option value="annual">Annually (once a year)</option></select></div>'
        +   '<div class="f" style="max-width:540px;margin-top:12px;"><label>Ends after (months)</label><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><input type="number" id="oexa-term" min="1" step="1" placeholder="Ongoing" style="width:170px;flex:0 0 170px;"/><div style="font-size:11px;color:var(--t3);line-height:1.5;flex:1 1 200px;min-width:180px;">Leave blank and it recurs until you stop it. Set this only for a bill that ends after a fixed number of months.</div></div></div>'
        + '</div>'
        + App.noteField({ id: 'oexa-notes', placeholder: 'Optional context for the bookkeeper' })
        + '<div id="oexa-err" style="display:none;font-size:11px;color:var(--red);margin-top:10px;"></div>';
      addButtons = '<div data-collapse-group="oex-add" style="margin:16px 0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
        + '<button class="btn btn-primary" id="oexa-save">Add Expense</button>'
        + '<button class="btn btn-ghost" id="oexa-clear">Start Over</button>'
        + '</div>';
    }
    const addCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('oex-add', 'Add Expense')
      + '<div class="collapse-body">' + bodyInner + '</div>'
      + '</div>' + addButtons;

    // What the last import actually did. An expense import used to report NOTHING — not even a
    // count — so rows it skipped (a credit, an unreadable amount, a missing date) simply were not
    // there afterwards. A row the operator can see in their own file and cannot find in Bar Cop is
    // what makes them stop trusting the total.
    const imp = this._importMsg;
    this._importMsg = null;   // one render only; it must not survive a navigation
    const importBanner = imp
      ? '<div style="background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:6px;padding:11px 16px;margin:16px 0;font-size:12px;color:var(--t1);line-height:1.6;">'
        + esc(imp) + '</div>'
      : '';
    return statsCard + warnBanner + coveredNote + importBanner + addCard
      + this._monthCardHtml(mk, { next: false, exportId: 'oex-export-this', wrapId: 'oex-thismonth' })
      + this._monthCardHtml(this._nextMonthKey(mk), { next: true });
  },

  _wireCurrent() {
    document.getElementById('oexa-save')?.addEventListener('click', () => this._saveAdd());
    document.getElementById('oexa-clear')?.addEventListener('click', () => this._clearAdd());
    document.getElementById('oexa-recurring')?.addEventListener('change', (e) => {
      const w = document.getElementById('oexa-term-wrap');
      if (w) w.style.display = e.target.checked ? '' : 'none';
    });
    this.container.querySelectorAll('.oexa-mode').forEach(b => b.addEventListener('click', () => { this._entryMode = b.dataset.mode; this.renderMain(); }));
    App.wireCustomSelects(this.container);
    this.container.querySelector('.card-collapse-head')?.addEventListener('click', (e) => App.toggleCollapse(e.currentTarget));
    App.applyCollapsed(this.container);
    document.getElementById('oex-export-this')?.addEventListener('click', () => {
      const el = document.getElementById('oex-thismonth');
      if (el) App.exportPDF({ title: 'Operating Expenses', root: el });
    });
    this._wireRows(this.container);
    if (this._entryMode === 'import') this._mountImporter();
  },

  _mountImporter() {
    const el = document.getElementById('oexa-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your expenses file here',
      dropSub: 'Needs columns for date and amount; category, vendor, and notes come in if your file has them. Categories that do not match yours import as Other.',
      actionsEl: '#oexa-imp-actions',
      fields: [
        /* ⚠ REQUIRED, so a missing candidate REFUSES THE WHOLE IMPORT. Chase business checking — the
           most common bank CSV in America — heads its column "Posting Date", which `posted` does not
           reach. Same for "Post Date", "Statement Date", "Settlement Date" and Xero's "InvoiceDate".
           ⚠ AND `bill date`/`invoice date` NOW OUTRANK `due date`: a QuickBooks bill export and a
           Sysco invoice both carry both, and dating the expense to when it is DUE books a 28 Jan
           bill on Net 30 into February. */
        { key: 'date',     label: 'Date',     required: true,  match: ['date', 'bill date', 'invoice date', 'invoicedate', 'transaction date', 'business date', 'posting date', 'post date', 'posted date', 'date posted', 'statement date', 'settlement date', 'expense date', 'purchase date', 'charge date', 'payment date', 'batch date', 'due date', 'date paid', 'trans date', 'entry date', 'paid', 'posted', 'day'] },
        /* ⚠⚠ THE FILE OFTEN SAYS WHICH WAY THE MONEY WENT — READ IT (S225). Kyle's bank export heads
           this "Transaction Type" and fills it with Debit / Credit, and it was reaching this door
           NOWHERE: measured against the real _autoMap, his header row bound date←Posting Date,
           amount←Amount, vendor←Description, notes←Memo, category←Type, and the actual direction
           marker went unmapped. So the importer was left inferring from the amount sign a fact the
           file states outright.
           ⚠ ORDER-SAFE, CHECKED: `type` is EXACT_ONLY so it cannot reach "Transaction Type" and
           steal it from `category`, and `transaction date` is not a substring of it either.
           ⚠ `details` is deliberately NOT a candidate. Chase heads its DEBIT/CREDIT column that way,
           but `details` is already how a genuine memo column reaches `notes`, and stealing a memo
           to gain a direction is the wrong trade. A Chase operator maps it in one dropdown. */
        { key: 'direction', label: 'Debit / Credit', required: false, match: ['transaction type', 'debit/credit', 'credit/debit', 'debit or credit', 'dr/cr', 'debit credit', 'trans type', 'entry type', 'direction'] },
        /* ⚠ THE GL ACCOUNT OUTRANKS THE TRANSACTION TYPE (S226f). `type` sat at priority 2 and
           `account` at 3, so QuickBooks Desktop — whose transaction reports head those two columns
           exactly "Type" and "Account" — bound the CATEGORY to a column holding Bill / Check /
           Credit Card Charge. None of those is a category, so _matchCat returned '' and EVERY ROW
           IMPORTED AS "Other" while the real expense account sat unread one column over. The By
           Category card, the YTD % column and Books' category lines were all blank-by-default for
           anyone exporting from QuickBooks Desktop.
           ⚠ MEASURED ACROSS 14 REAL HEADER ROWS BEFORE SHIPPING (QuickBooks Desktop x2, QBO, Chase
           checking + card, BofA, Wells, Xero, Bill.com, Sysco, Expensify, Ramp, Brex, and a file
           carrying both columns): the swap changes 2 rows, both QuickBooks Desktop, both from wrong
           to right. No other row moves and NO OTHER FIELD moves on any row. Chase and Wells keep
           binding "Type" (they carry no account column), and every file with a real Category column
           is untouched, because `category` still leads.
           ⚠ QuickBooks ONLINE was never affected — it heads the column "Transaction Type", which the
           `direction` field above claims first, so category already reached Account there. That is
           why this only ever showed up on the Desktop exports.
           `type` stays in the list, last: it is still the best guess on a file that has nothing else. */
        { key: 'category', label: 'Category', required: false, match: ['category', 'account', 'gl account', 'account name', 'expense category', 'expense type', 'class', 'gl code', 'type'] },
        { key: 'vendor',   label: 'Vendor',   required: false, match: ['vendor', 'payee', 'merchant', 'description', 'name', 'paid to', 'supplier', 'company', 'vendor name', 'payee name', 'biller'] },
        /* ⚠ COMMENTS GO ABOVE THE ARRAY, NEVER INSIDE A FIELD LITERAL — a comment placed mid-entry
           broke `verify-reference-import-doors`' field slicer twice in one session.
           `charge amount`/`charge total` are explicit because bare `charge` is EXACT_ONLY now, and
           `amount due` / `invoice total` / `charges` were never candidates at all — so a supplier
           bill or a card statement headed any of those left this REQUIRED field unmapped and
           refused the whole import. */
        /* ⚠ `invoice total` BEFORE `amount due`: on a partly-paid bill those are different numbers,
           and the expense is what the bill COST, not what is still owed on it. A US Foods invoice
           prints both columns side by side.
           ⚠⚠ AND THE COMMENT LIVES HERE, NOT INSIDE THE ARRAY — a mid-line `//` truncated the field
           for `verify-reference-import-doors`' line-based slicer. Third time this session. */
        { key: 'amount',   label: 'Amount',   required: true,  match: ['amount', 'total', 'cost', 'debit', 'amt', 'value', 'expense', 'payment', 'charge amount', 'charge total', 'invoice total', 'invoice amount', 'amount due', 'charges', 'charge', 'dollars', 'total amount', 'amount paid'] },
        { key: 'notes',    label: 'Notes',    required: false, match: ['notes', 'memo', 'note', 'comment', 'details', 'remark'] }
      ],
      confirmLabel: 'Import Expenses',
      onComplete: rows => this._importRows(rows)
    });
  },

  /* ⚠ AN UNREADABLE DATE MUST COME BACK EMPTY SO THE ROW IS SKIPPED AND COUNTED, never stored.
     Two shapes got through and produced rows that "imported successfully" and then existed in a
     month no view can open — invisible in This Month and Year to Date, but counted in History's
     all-time total, so two figures on the same screen disagreed:
       - a bare integer: `new Date("45845")` is year 45845, and an Excel date column whose format
         was reset to General exports exactly that serial (raw:false hands the text straight over);
       - an impossible ISO date: the fast path returned "2026-13-45" untouched. */
  /* ⚠⚠ ONE DATE READER FOR THE WHOLE APP. This door had its OWN copy, and it ended in the exact
     line six scan rounds were spent removing from the shared one: `new Date(str)`, which hands free
     text to V8's legacy parser. So every failure mode that was eliminated in PosIngest.normDate was
     still live HERE — an Excel `d-mmm` cell ("20-Jul") booked to 2001, a UTC marker lost a day,
     "06.07.2026" transposed, "Feb 29 2026" rolled into March, "Jul 2026" became the 1st, and a
     1899 or 3000 date was accepted verbatim. On a three-row rent/utilities file that put $7,340 of
     $8,540 into July 2001 — invisible in This Month and Year to Date (which filter on the date's
     first seven characters) while still counting in History's all-time total. Books reads this log
     for the Income Statement's operating-expense lines.
     This is the second-consumer miss in its purest form: the shared reader was rewritten and nobody
     grepped for OTHER readers. Delegating is the fix — a private copy is a copy that drifts.
     ⚠ Before adding a date format here, add it to PosIngest.normDate; it is pinned by
     verify-import-date-year.js and shared by every import door in the app. */
  /* `opts` carries the FILE-LEVEL date verdict (S199). This door reads its own column rather than
     going through PosIngest.build, so it has to ask for the verdict itself — see _importRows. */
  _normDate(s, opts) {
    return (typeof PosIngest !== 'undefined' && PosIngest.normDate) ? PosIngest.normDate(s, opts) : '';
  },

  // ⚠ MATCHES THE OPERATOR'S OWN LIST TOO, not just the nine builtins. The manual Category field is
  // built from App.listOptions('expense_category') and invites them to add their own — so a file
  // whose column said "Waste Removal" was silently rewritten to "Other" on import while typing the
  // same word by hand kept it. Worse, "Other" is a value listOptions deliberately strips, so they
  // could not even select it back afterwards.
  _matchCat(s) {
    if (!s) return '';
    const t = String(s).toLowerCase().trim();
    const hit = this.CATEGORIES.find(c => c.toLowerCase() === t);
    if (hit) return hit;
    const own = (App.listOptions ? App.listOptions('expense_category') : []) || [];
    return own.find(c => String(c).toLowerCase() === t) || '';
  },

  /* ⚠⚠ THE FILE-LEVEL SIGN VERDICT (S225). Deliberately mirrors `PosIngest.dateConvention` — the
     same vote/dominance shape, for the same reason: a whole-file ambiguity settled once from the
     file's own evidence beats a per-row guess.
     WHY A MAJORITY IS THE RIGHT EVIDENCE HERE (and this differs from dates): a single date cell can
     be undecidable on its own, but a single AMOUNT never is — a negative is equally consistent with
     "a refund in a positive-charge file" and "a charge in a negative-debit file". Only the balance
     of the column distinguishes them. A bar's statement is overwhelmingly money OUT either way, so
     the majority is a strong signal.
     THE 3x DOMINANCE AND THE lose===1 ESCAPE ARE COPIED VERBATIM from dateConvention, including its
     reasoning: ONE dissenting row is always a stray at any scale (a single refund on a card
     statement), while three rows agreeing with each other are a second convention.
     ⚠ WHEN IT CANNOT TELL, IT DOES NOT FLIP. `contradictory` keeps today's positive-charge rule and
     the door SAYS SO — a silent flip on weak evidence is how you turn a working import into a wrong
     one. Kept local to this door on purpose: it is the only importer that treats a negative as a
     credit to skip (buildVoidComp takes the magnitude, buildPmix needs the sign for returns). */
  /* One row's stated direction, or '' when the file does not say. Strict on purpose: this decides
     whether money is skipped, so it reads only the markers a bank actually writes. */
  _directionOf(v) {
    const s = String(v == null ? '' : v).trim().toLowerCase();
    if (!s) return '';
    if (/^cr(edit)?\b/.test(s) || s === 'c') return 'credit';
    if (/^de?b(it)?\b/.test(s) || s === 'd') return 'debit';
    return '';
  },
  _amountConvention(rows) {
    let neg = 0, pos = 0;
    (rows || []).forEach(r => {
      const v = App.parseNum(r && r.amount);
      if (v == null || v === 0) return;   // a zero row is not evidence of either convention
      if (v < 0) neg++; else pos++;
    });
    const DOMINANCE = 3;
    const win = Math.max(neg, pos), lose = Math.min(neg, pos);
    const decisive = lose === 0 || (win > lose && (lose === 1 || win >= lose * DOMINANCE));
    const contradictory = lose > 0 && !decisive;
    return { negativeIsCharge: decisive && neg > pos, contradictory, negVotes: neg, posVotes: pos };
  },

  async _importRows(rows) {
    const arr = this.records();
    const _added = [];   // rows appended here, so a failed write can take them back out
    /* ⚠⚠ DEDUP AGAINST WHAT WAS ALREADY LOGGED — A SNAPSHOT — NOT AGAINST THE LIST THIS LOOP IS
       APPENDING TO. The old test was `arr.some(...)` where `arr` is the LIVE log, and rows are
       pushed into `arr` inside the same loop. So the second genuinely-separate expense that happened
       to match the first COLLAPSED INTO IT: three $89 rows on one Saturday (two ice deliveries and a
       linen drop — a card statement lists each) imported as ONE. **$89.00 banked against $267.00 in
       the file**, and the result line said "2 already logged", which was false — they were in the
       same file and had never been logged at all. Same-day repeats from one vendor for one amount
       are ORDINARY in a bar: two ice runs, two kegs, the same delivery fee twice.
       This log feeds the Books Income Statement's operating-expense lines, This Month, Year to Date,
       By Category and breakeven, so the money went missing from all of them at once.
       ⚠ THE CONSUME-ONCE SET IS THE HALF THAT KEEPS THE RE-DROP HONEST. Snapshot alone would let a
       re-dropped file import everything twice; `_used` lets each already-logged row absorb exactly
       ONE incoming row, so a genuine re-drop still dedupes in full while three-of-a-kind in one file
       all land. Snapshotting WITHOUT consume-once, or consume-once against the LIVE array, each
       still lose a row — both were tried and both are wrong.
       `PosIngest._isDup` is the shared implementation every POS builder already uses for exactly
       this; door 17 was the one place hand-rolling it. */
    /* ⚠ READ THE DATE COLUMN ONCE, BEFORE ANY ROW (S199). A DD/MM/YYYY expense file used to land
       its 1st-to-12th rows in the wrong MONTH while its 13th-to-31st rows read correctly, so a
       month of rent and utilities scattered and the totals on this very screen disagreed with each
       other. This door does not go through PosIngest.build, so it asks for the verdict itself. */
    const _conv = (typeof PosIngest !== 'undefined' && PosIngest.dateConvention)
      ? PosIngest.dateConvention(rows, 'date') : { dayFirst: false, contradictory: false };
    // A self-contradicting file refuses its coin-toss rows rather than guessing; they land in the
    // `undated` bucket this door already counts and names.
    const _dopts = { dayFirst: _conv.dayFirst, dateAmbiguous: _conv.contradictory };
    const _candidates = [];   // rows that pass every guard; the operator ticks which of these land
    const _pre = arr.slice();
    const _used = new Set();
    const _dup = (date, amount, vendor, category) => {
      const pred = x => x.date === date && Math.abs((parseFloat(x.amount) || 0) - amount) < 0.005
        && (x.vendor || '') === vendor && (x.category || '') === category;
      if (typeof PosIngest !== 'undefined' && PosIngest._isDup) return PosIngest._isDup(_pre, _used, pred);
      // Backstop with the same consume-once semantics, never the old any-match test.
      const hit = _pre.find(x => !_used.has(x.id) && pred(x));
      if (hit) { _used.add(hit.id); return true; }
      return false;
    };
    /* ⚠⚠⚠ WHICH SIGN MEANS "MONEY OUT"? THE FILE DECIDES, NOT US (S225). Chase business checking —
       named in this door's own date-field comment as an intended input — writes DEBITS NEGATIVE and
       deposits positive, as do BofA, Wells Fargo and Chase credit cards. The old rule was a flat
       `amount < 0 -> credit, skip`, so on those files it imported the DEPOSITS as expenses and threw
       every real bill away.
       MEASURED end to end, and reachability is total: the real CSVMapper._autoMap binds every
       required field from Chase's real header row with NO operator input, and then 4 bills
       ($17,340.55 of Sysco, Austin Energy, the lease, Texas Mutual) were discarded while 2 merchant
       deposits ($16,364.85) were booked as operating expenses — under a banner reading "2 expenses
       imported · 4 credits or refunds skipped", which is exactly inverted. Books took revenue as
       expense while every real opex line read $0.
       ⭐ SAME SHAPE AS `dateConvention`, which this door already calls three lines down for exactly
       this reason: settle a FILE-LEVEL ambiguity once, from the file's own evidence, instead of
       guessing per row. One flip below and every downstream guard is untouched. */
    const _sign = this._amountConvention(rows);
    /* ⚠⚠ AND IF THE FILE STATES THE DIRECTION, THAT BEATS EVERY INFERENCE ABOVE (S225). A stated
       fact is not a heuristic: where a Debit/Credit column is present and populated, `_sign` is not
       consulted at all — credits are money IN and skipped, everything else is money OUT and imported
       at its magnitude, whatever sign the file wrote it with. Kyle's `-123.62` debit becomes
       $123.62. This is the whole reason the middle case stopped needing a guess. */
    const _hasDir = (rows || []).some(r => this._directionOf(r && r.direction));
    let credits = 0, unreadable = 0, undated = 0, zeroed = 0, totalsLines = 0;
    (rows || []).forEach((r, i) => {
      const date = this._normDate(r.date, _dopts);
      // ⚠ App.parseNum, not a private parseFloat strip. This read a card export's refund row —
      // "(125.00)" or "125.00-" — as +125 and BOOKED IT AS A $125 EXPENSE, while the same file's
      // "-125.00" rows parsed to -125 and were dropped by the guard below. One file, two opposite
      // wrong answers, $250 apart. Credits are still not imported (an operating-expense ledger of
      // positive amounts is the existing model), but they are now COUNTED and reported rather than
      // vanishing — a row the operator can see in their file and cannot find in Bar Cop is the
      // thing that makes them stop trusting the total.
      const _raw = App.parseNum(r.amount);
      if (_raw == null) { unreadable++; return; }
      /* ONE FLIP, DECIDED ONCE FOR THE WHOLE FILE. Under the negative-debit convention a charge is
         -1240.55 and becomes +1240.55 (imports); a deposit is +8420.11 and becomes -8420.11, which
         the existing credit guard below then skips. Every downstream test is unchanged. */
      const amount = _hasDir
        ? (this._directionOf(r.direction) === 'credit' ? -Math.abs(_raw) : Math.abs(_raw))
        : (_sign.negativeIsCharge ? -_raw : _raw);
      // A $0.00 line (a voided bill, a zero-dollar subscription row) is not a credit and must not
      // be reported as one — it is simply nothing to log.
      if (amount < 0)     { credits++;    return; }
      if (amount === 0)   { zeroed++;     return; }
      if (!date)          { undated++;    return; }
      const category = this.CATEGORIES.includes(r.category) ? r.category : (this._matchCat(r.category) || 'Other');
      const vendor = (r.vendor || '').trim();
      /* ⚠⚠ A DATED "TOTAL" ROW IS NOT AN EXPENSE — IT IS THE FILE'S OWN SUBTOTAL, AND IMPORTING IT
         MAKES THE MONTH READ EXACTLY DOUBLE (S223). Measured: Utilities $812.40 + Insurance
         $1,450.00 + a TOTAL row dated 07/31 for $2,262.40 imported as three rows and **$4,524.80**,
         with the banner reading "3 expenses imported" and flagging nothing. It feeds Books'
         operating-expense lines, This Month, YTD, By Category and breakeven, so the whole set
         doubles at once.
         ⭐ THIS IS THE THIRD DOOR TO NEED THE SHARED GATE. `isSummaryName` lives in PosIngest and its
         own comment says it belongs there "because the same summary line lands on doors 4, 11 and
         12" — door 12 called it, door 11 was fixed to call it, door 17 never did.
         ⚠ AN UNDATED total row was already caught (it lands in `undated`), so this only closes the
         case where the export dates its total line — which QuickBooks and most bank exports do.
         ⚠ VERIFIED AGAINST REAL VENDOR NAMES BEFORE SHIPPING ([[the-loop]] #26 — this vocabulary has
         eaten a real name three times): "Total Wine & More", "Total Wine", "Total Beverage
         Solutions", "Totally Bread Co", "Grand Rapids Linen" and "Summit Beverage" all come back
         FALSE, while TOTAL / Total / Grand Total / Sub Total / Subtotal / TOTALS / Month Total /
         Report Total all come back true. The qualifier machinery is what makes that safe. */
      if (vendor && typeof PosIngest !== 'undefined' && PosIngest.isSummaryName
          && PosIngest.isSummaryName(vendor)) { totalsLines++; return; }
      const notes = (r.notes || '').trim();
      // Skip a row ALREADY LOGGED (same date, amount, vendor, category) — see the snapshot note above.
      if (_dup(date, amount, vendor, category)) return;
      const row = { id: App.uid ? App.uid() : ('oex-' + Date.now() + '-' + i), date, category, vendor, amount, notes, created_at: new Date().toISOString() };
      _candidates.push(row);
    });

    /* ⚠⚠ THE OPERATOR PICKS, BECAUSE THE FILE CANNOT SAY (Kyle's call, 2026-07-27). Every debit on a
       bank register is money out, but only some are OPERATING expenses — the rest are food and
       liquor purchases, payroll runs, card-processor settlements, transfers and owner draws. Several
       of those Bar Cop ALREADY tracks elsewhere (COGS through Inventory, wages through Labor), so
       importing the lot double-counts them straight into the Books Income Statement. Nothing in the
       file distinguishes them and no rule could.
       ⚠ It runs AFTER every other guard, so the list shown is exactly what would have been written —
       unreadable, zero, undated, totals and already-logged rows never reach it. Everything starts
       ticked, so a clean card or bill export stays one click. */
    let unticked = 0;
    if (_candidates.length) {
      const pick = await App.promptImportReview({
        title: 'Pick what to import',
        intro: 'These are the rows Bar Cop can log. Untick anything that is not an operating expense'
             + ' — food and liquor purchases, payroll and card-processor fees are tracked elsewhere in'
             + ' Bar Cop, so importing them here would count them twice.',
        rowLabel: 'Description',
        rows: _candidates.map(c => ({ key: c.id, date: c.date, label: c.vendor || '(no description)',
          category: c.category, amount: App.fmtCurrency(c.amount) }))
      });
      if (!pick.confirmed) {
        this._importMsg = 'Import cancelled. Nothing was changed.';
        this._entryMode = 'manual';
        if (this._catchUpStillCurrent()) { if (this._view !== 'current') this._rerender(); else this.renderMain(); }
        return;
      }
      const chosen = _candidates.filter(c => pick.keep.has(c.id));
      unticked = _candidates.length - chosen.length;
      chosen.forEach(row => { arr.push(row); _added.push(row); });
    }

    // Imported rows were pushed into the live list before the write, and a bulk write cannot revert
    // itself — take them back out rather than showing an import Books counts and the server lacks.
    /* ⚠ THE NEW ROWS, NOT THE WHOLE LEDGER (S226g). This wrote `this.records()` — every operating
       expense the account has ever had — on every import, where every peer door writes only what it
       just added. The claimed chunk-boundary hazard does NOT reproduce (putEventsBulk queues the
       whole list on a chunk error and the upsert is idempotent by id), so this is not a data-loss
       fix; it removes a needless rewrite of untouched rows and, with it, the window where a stale
       in-memory copy overwrites a newer row saved from another device.
       An empty `_added` returns true from putRecordsBulk, so a file that was entirely duplicates or
       entirely unticked still reports honestly instead of failing. */
    const saved = await App.putRecordsBulk('core', 'operating_expense', _added);
    if (!saved) App.dropRows(arr, _added);
    this._entryMode = 'manual';
    /* ⚠ THE GUARD COMES BEFORE THE MESSAGE, NOT AFTER IT. Placed after, it stopped the repaint but
       left `_importMsg` banked — and nothing else consumes it, so the next time the operator opened
       Operating Expenses, days later, it greeted them with "1 expense imported." about an import
       they had already navigated away from. The failure text was worse: an unprompted "Could not
       save the import. Nothing was changed" on a page they just opened. If nobody is on the screen
       there is nobody to tell; a failed write already raises its own alert at the time. */
    /* ⚠ THE TOKEN ALONE IS NOT ENOUGH — CHECK `_view` TOO. Expense History mounts through this
       same object and re-stamps the SAME `_mountedAt` slot, so the token still matches and the
       repaint went ahead, painting Operating Expenses over the History page the operator had just
       opened (sidebar still highlighting History). `_catchUpOnce` survives the identical race only
       because it branches on `_view`; this did not. */
    if (!this._catchUpStillCurrent()) return;
    /* ⚠ EXPENSE HISTORY NEEDS THE NUMBERS REFRESHED, JUST NOT THE PAGE HIJACKED. It mounts through
       this same object, so a bare `_view !== 'current'` return left it showing "Logged This Year"
       and a log table built from rows that — on a FAILED write — had already been spliced back out
       of memory a few lines above. Right answer for both: re-render whichever view is actually on
       screen. `_rerender` is the function that already exists for this. */
    if (this._view !== 'current') { this._rerender(); return; }
    // Say what happened, including what was NOT taken and why.
    if (!saved) {
      this._importMsg = 'Could not save the import. Nothing was changed — check your connection and try again.';
    } else {
      const bits = [_added.length + ' expense' + (_added.length === 1 ? '' : 's') + ' imported'];
      /* ⚠ THE SENTENCE FOLLOWS THE VERDICT. Under the negative-debit convention the skipped rows are
         DEPOSITS, not refunds — saying "credits or refunds skipped (Bar Cop tracks expenses as
         positive amounts)" about a Chase file was not merely unhelpful, it described the opposite of
         what happened and would have sent the operator hunting for refunds that do not exist. */
      if (credits)    bits.push(credits + (_hasDir
        // The file SAID they were credits, so say that — no inference to explain.
        ? ' row' + (credits === 1 ? '' : 's') + ' skipped, marked as credits in your file (money in, not an expense)'
        : _sign.negativeIsCharge
          ? ' deposit' + (credits === 1 ? '' : 's') + ' or credit' + (credits === 1 ? '' : 's')
            + ' skipped (this file marks charges as negative, so Bar Cop imported the charges)'
          : ' credit' + (credits === 1 ? '' : 's') + ' or refund' + (credits === 1 ? '' : 's')
            + ' skipped (Bar Cop tracks expenses as positive amounts)'));
      if (undated)    bits.push(undated + ' row' + (undated === 1 ? '' : 's') + ' skipped with no readable date');
      if (unreadable) bits.push(unreadable + ' row' + (unreadable === 1 ? '' : 's') + ' skipped with no readable amount');
      if (zeroed) bits.push(zeroed + ' zero-dollar row' + (zeroed === 1 ? '' : 's') + ' skipped');
      // The file's own subtotal line, named rather than silently dropped (S223).
      if (totalsLines) bits.push(totalsLines + ' totals row' + (totalsLines === 1 ? '' : 's')
        + ' skipped (your file' + String.fromCharCode(8217) + 's own subtotal, not an expense)');
      /* ⚠ EVERY BUCKET MUST BE SUBTRACTED HERE OR `dupes` ABSORBS IT. This residual is how "already
         logged" is derived — it is not counted directly — so a new early-return that is not
         subtracted silently inflates it and the operator is told rows were already logged when they
         were skipped for another reason entirely. */
      // The rows the operator chose to leave out — their own decision, echoed back.
      if (unticked) bits.push(unticked + ' row' + (unticked === 1 ? '' : 's') + ' left out');
      // ⚠ `unticked` joins the subtraction for the same reason every other bucket does: this figure
      // is DERIVED, so anything not subtracted is silently reported as "already logged".
      const dupes = rows.length - _added.length - credits - undated - unreadable - zeroed - totalsLines - unticked;
      if (dupes > 0) bits.push(dupes + ' already logged');
      /* ⚠ ONLY THE CONTRADICTORY FILE IS WORTH SAYING OUT LOUD. A day-first file that Bar Cop read
         correctly needs no announcement — it is simply right, and a US file can never trigger the
         detection at all. What the operator DOES need is the case Bar Cop could not decide: some
         rows in the file can only be day-first and others can only be month-first, so the rows where
         both numbers are 12 or under are a coin toss. Those are read US-style and named here rather
         than guessed at in silence. */
      if (_conv.contradictory) bits.push('some dates read day-first and others month-first, so day-and-month order could not be settled — check any date where both numbers are 12 or under');
      /* ⚠ NAMED, NOT GUESSED (S225). A file too evenly split to call keeps the positive-charge rule
         — the safe, unchanged behaviour — and says so with the counts, so the operator can settle in
         one glance what Bar Cop could not. Same posture as the date verdict directly above. */
      // ⚠ ONLY WHEN THE SIGN WAS ACTUALLY CONSULTED. With a Debit/Credit column present nothing was
      // inferred, so warning that Bar Cop "could not tell" would be describing a decision it never
      // had to make — a false caveat is as misleading as a false figure.
      if (_sign.contradictory && !_hasDir) bits.push(_sign.negVotes + ' amounts are negative and ' + _sign.posVotes
        + ' positive, so Bar Cop could not tell which sign means money out — it read the positive rows as expenses; check the amount column');
      this._importMsg = bits.join(' · ') + '.';
    }
    this.renderMain();
  },

  // By Category row-list (current month, last month, YTD, YTD % of revenue).
  _byCatCardHtml() {
    const fmt$ = (v) => App.fmtCurrency(v || 0);
    const fmtPct = (v) => v == null ? '—' : (v * 100).toFixed(1) + '%';
    const mk = this._currentMonthKey();
    const prevMk = this._priorMonthKey(mk);
    const byCatMonth = this._sumMonthByCategory(mk);
    const byCatLast  = this._sumMonthByCategory(prevMk);
    const byCatYTD   = this._sumYTDByCategory(mk);
    /* ⚠ THE SECOND CONSUMER OF THE SAME MIXED BASIS ([[the-loop]] step 0.6, S226d/i). This column's
       numerator ran through the CURRENT month (mk <= monthKey, so a whole month of rent) while
       _revenueYTD counted only the weeks confirmed so far — the same whole-over-part shape as the
       OpEx % stat above, diluted by the earlier months but wrong in the same direction. Both sides
       now stop at the last complete month, and the header says so. The YTD DOLLARS column beside it
       is unchanged and still runs through today: it is a total, not a ratio. */
    /* ⚠⚠ AND IT HAS TO BE THE SAME YEAR AS THE DOLLARS BESIDE IT (S226 round 2, F2). Every January
       the last complete month is DECEMBER, so this column would have printed last year's YTD ratio
       against this year's YTD dollars — two adjacent columns both headed "YTD", covering different
       years, with rows showing $0.00 YTD next to a live percentage and $900 YTD next to 0.0%.
       Guaranteed annually for every account, and self-correcting on Feb 1, which is exactly the kind
       of defect nobody ever reports. No complete month in the current year means there is no
       year-to-date ratio yet, and a dash says that honestly. */
    const pctB       = this._pctBasis();
    const pctMk      = (pctB && pctB.mk.slice(0, 4) === mk.slice(0, 4)) ? pctB.mk : '';
    const byCatPct   = pctMk ? this._sumYTDByCategory(pctMk) : null;
    const ytdRev     = pctMk ? pctB.ytdRev : 0;
    const catRows = this.CATEGORIES.map(c => {
      const tm = byCatMonth[c] || 0, lm = byCatLast[c] || 0, ytd = byCatYTD[c] || 0;
      const ytdRevPct = (byCatPct && ytdRev > 0) ? ((byCatPct[c] || 0) / ytdRev) : null;
      const dim = (tm === 0 && lm === 0 && ytd === 0);
      return '<tr style="' + (dim ? 'opacity:0.55;' : '') + '">'
        + '<td style="color:var(--t1);">' + esc(c) + '</td>'
        + '<td style="font-weight:700;color:var(--t1);">' + fmt$(tm) + '</td>'
        + '<td style="color:var(--t3);">' + fmt$(lm) + '</td>'
        + '<td style="color:var(--t2);">' + fmt$(ytd) + '</td>'
        + '<td style="color:var(--t3);text-align:left;">' + fmtPct(ytdRevPct) + '</td>'
        + '</tr>';
    }).join('');
    return '<div class="card" style="overflow-x:auto;">'
      + '<table class="row-list">'
      +   '<colgroup><col style="width:22%"><col style="width:19.5%"><col style="width:19.5%"><col style="width:19.5%"><col style="width:19.5%"></colgroup>'
      +   '<thead><tr><th>Category</th><th>This Month</th><th>Last Month</th><th>YTD</th><th>'
      +     (pctMk && ytdRev > 0 ? '% of Revenue, YTD thru ' + esc(this._monthLabel(pctMk)) : '% of Revenue') + '</th></tr></thead>'
      +   '<tbody>' + catRows + '</tbody>'
      + '</table></div>';
  },

  // The log row-list for a given set of records (optional id).
  _logTableHtml(recs, id) {
    const logRows = recs.length === 0
      ? '<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--t3);font-size:12px;">No expenses in this range.</td></tr>'
      : recs.map(r => this._logRowHtml(r, { minimal: true })).join('');
    return '<div class="card"' + (id ? ' id="' + id + '"' : '') + ' style="overflow-x:auto;">'
      + '<table class="row-list">'
      +   '<colgroup><col style="width:22%"><col style="width:26%"><col style="width:18%"><col style="width:18%"><col style="width:16%"></colgroup>'
      +   '<thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Amount</th><th class="no-print"></th></tr></thead>'
      +   '<tbody>' + logRows + '</tbody>'
      + '</table></div>';
  },

  // ── History tab: By Category + the filterable log (paged 50 at a time) ────
  _renderHistory() {
    const PAGE = App.LIST_PAGE || 50;
    if (!this._histShown) this._histShown = PAGE;
    const rangeChipOpts = [
      { v: 'this-month', label: 'This Month' },
      { v: 'last-month', label: 'Last Month' },
      { v: 'ytd',        label: 'Year to Date' },
      { v: 'last-12',    label: 'Last 12 Months' },
      { v: 'all',        label: 'All Time' }
    ];
    const rangeChips = App.filterChips(this._filterRange, rangeChipOpts);
    const recs = this._filteredRecords();
    const shown = recs.slice(0, this._histShown);

    const filterRow = '<div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap;margin:24px 0 10px;">' + rangeChips + '</div>';
    const byCatHeading = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;">'
      + '<div class="sh" style="margin:0;">By Category</div>'
      + '<button class="btn btn-ghost btn-sm no-print" id="oex-export">Export PDF</button>'
      + '</div>';
    const olderBar = recs.length > this._histShown
      ? '<div class="no-print" style="text-align:center;padding:14px 0 4px;"><button class="btn btn-ghost btn-sm" id="oex-older">Show older (' + (recs.length - this._histShown) + ' more)</button></div>'
      : '';

    return '<div id="oex-export-area">'
      + byCatHeading + this._byCatCardHtml()
      + filterRow + this._logTableHtml(shown, 'oex-log')
      + '</div>' + olderBar;
  },

  _wireHistory() {
    const PAGE = App.LIST_PAGE || 50;
    document.getElementById('oex-export')?.addEventListener('click', () => {
      // Export the FULL filtered list (not just the on-screen 50), built off-screen.
      const node = document.createElement('div');
      node.style.cssText = 'position:absolute;left:-99999px;top:0;width:900px;';
      node.innerHTML = this._byCatCardHtml() + this._logTableHtml(this._filteredRecords());
      document.body.appendChild(node);
      Promise.resolve(App.exportPDF({ title: 'Operating Expenses', root: node })).finally(() => node.remove());
    });
    this.container.querySelectorAll('.fc-chip').forEach(chip => {
      chip.addEventListener('click', () => { this._filterRange = chip.dataset.v; this._histShown = PAGE; this._rerender(); });
    });
    document.getElementById('oex-older')?.addEventListener('click', () => { this._histShown = (this._histShown || PAGE) + PAGE; this._rerender(); });
    this._wireRows(this.container);
  },

  // Shared row-action wiring for both tabs.
  _wireRows(scope) {
    const openEdit = (b) => { const r = this.records().find(x => x.id === b.dataset.id); if (r) this._openModal(r); };
    scope.querySelectorAll('.oex-edit').forEach(b => b.addEventListener('click', () => openEdit(b)));
    scope.querySelectorAll('.oex-renew').forEach(b => b.addEventListener('click', () => openEdit(b)));
    scope.querySelectorAll('.oex-dup').forEach(b => b.addEventListener('click', () => this._duplicate(b.dataset.id)));
    scope.querySelectorAll('.oex-del').forEach(b => b.addEventListener('click', () => this._delete(b.dataset.id)));
    scope.querySelectorAll('.oex-stop').forEach(b => b.addEventListener('click', () => this._stopRecurring(b.dataset.id)));
  },

  // ── Inline add form save / start over ────────────────────────────────────
  async _saveAdd() {
    const g = (id) => document.getElementById(id);
    const date     = g('oexa-date')?.value || '';
    const category = g('oexa-cat')?.value || '';
    const vendor   = (g('oexa-vendor')?.value || '').trim();
    const amount   = parseFloat(g('oexa-amount')?.value || '');
    const notes    = (g('oexa-notes')?.value || '').trim();
    const recurring = !!g('oexa-recurring')?.checked;
    const term      = parseInt(g('oexa-term')?.value, 10);
    const showErr = (m) => { const e = g('oexa-err'); if (e) { e.textContent = m; e.style.display = 'block'; } };
    if (!date) { showErr('Pick a date.'); return; }
    if (!category) { showErr('Pick a category.'); return; }
    if (isNaN(amount) || amount <= 0) { showErr('Enter an amount above zero.'); return; }
    if (recurring && g('oexa-term')?.value && (isNaN(term) || term < 1)) { showErr('A fixed term must be 1 month or more, or leave it blank to recur until you stop it.'); return; }
    const rec = {
      id: App.uid ? App.uid() : ('oex-' + Date.now()),
      date, category, vendor, amount, notes,
      created_at: new Date().toISOString()
    };
    if (recurring) {
      rec.recurring = true;
      rec.frequency = document.getElementById('oexa-frequency')?.value || 'monthly';
      rec.term_months = (term && term > 0) ? term : null;
      rec.recur_day = parseInt(String(date).slice(8, 10), 10) || 1;
    }
    await App.putRecord('core', 'operating_expense', rec);
    this.renderMain();
  },

  _clearAdd() {
    const d = document.getElementById('oexa-date'); if (d) d.value = App.todayLocal();
    const c = document.getElementById('oexa-cat');  if (c) c.selectedIndex = 0;
    ['oexa-vendor', 'oexa-amount', 'oexa-notes', 'oexa-term'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const rc = document.getElementById('oexa-recurring'); if (rc) rc.checked = false;
    const fq = document.getElementById('oexa-frequency'); if (fq) fq.selectedIndex = 0;
    const tw = document.getElementById('oexa-term-wrap'); if (tw) tw.style.display = 'none';
    const e = document.getElementById('oexa-err');  if (e) e.style.display = 'none';
  },

  // ── Add (from Duplicate) / Edit modal ────────────────────────────────────
  // record = the row being edited (edit mode). prefill = starting values for a
  // brand-new entry (used by Duplicate, which never books a row until you save).
  _openModal(record, prefill) {
    const isEdit = !!record;
    const arr = this.records();
    const rec = record || prefill || {
      id:    '',
      date:  App.todayLocal(),
      category: this.CATEGORIES[0],
      vendor: '',
      amount: '',
      notes:  ''
    };
    const catOpts = this.CATEGORIES.map(c => '<option value="' + esc(c) + '"' + (rec.category === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
    const id = 'oex-modal';
    // The recurring rule lives on the series parent, but it can be managed from
    // ANY entry in the series (no hunting for the original 12-month-old row).
    const parent = rec.recurring_parent ? (arr.find(r => r.id === rec.recurring_parent) || rec) : rec;
    const seriesOn = !!parent.recurring;
    const freqOpt = (v, lbl) => '<option value="' + v + '"' + (parent.frequency === v || (!parent.frequency && v === 'monthly') ? ' selected' : '') + '>' + lbl + '</option>';
    const recurHtml = '<div style="margin-top:14px;"><label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--t1);cursor:pointer;"><input type="checkbox" class="bc-check" id="oex-f-recurring"' + (seriesOn ? ' checked' : '') + '/> Recurring bill (same cost each time)</label></div>'
      + '<div id="oex-f-term-wrap" style="margin-top:12px;' + (seriesOn ? '' : 'display:none;') + '">'
      +   '<div style="font-size:11px;color:var(--gold);margin-bottom:12px;max-width:540px;line-height:1.5;">Set the <b>Due Date</b> above to when this bill is next due. The schedule repeats from that date.</div>'
      +   '<div class="f" style="max-width:540px;"><label>How often</label><select id="oex-f-frequency" style="width:200px;">' + freqOpt('monthly', 'Monthly') + freqOpt('quarterly', 'Quarterly (every 3 months)') + freqOpt('annual', 'Annually (once a year)') + '</select></div>'
      +   '<div class="f" style="max-width:540px;margin-top:12px;"><label>Ends after (months)</label><input type="number" id="oex-f-term" min="1" step="1" value="' + esc(parent.term_months || '') + '" placeholder="Ongoing" style="width:170px;"/></div>'
      + '</div>';

    const html = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">' + (isEdit ? 'Edit Expense' : 'Add Expense') + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      +   '<div class="f"><label>Date Submitted</label><input type="date" value="' + esc((rec.created_at || '').slice(0, 10) || rec.date || App.todayLocal()) + '" disabled/></div>'
      +   '<div class="f"><label>Due Date</label><input type="date" id="oex-f-date" value="' + esc(rec.date) + '"/></div>'
      +   '<div class="f"><label>Category' + App.manageListLink('expense_category') + '</label>' + App.customSelect({ id: 'oex-f-cat', key: 'expense_category', builtin: this.CATEGORIES, selected: rec.category, blank: true, blankLabel: 'Select category...' }) + '</div>'
      +   '<div class="f"><label>Vendor</label><input type="text" id="oex-f-vendor" value="' + esc(rec.vendor) + '" placeholder="Who did you pay"/></div>'
      +   '<div class="f"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="oex-f-amount" step="0.01" min="0" value="' + esc(rec.amount === '' ? '' : String(rec.amount)) + '" placeholder="0.00"/></div></div>'
      + '</div>'
      + recurHtml
      + App.noteField({ id: 'oex-f-notes', value: rec.notes, placeholder: 'Optional context for the bookkeeper' })
      + '<div class="card-actions">'
      +   '<button class="btn btn-primary" id="oex-save">' + (isEdit ? 'Save Changes' : 'Add Expense') + '</button>'
      +   '<span id="oex-f-err" style="display:none;font-size:11px;color:var(--red);align-self:center;"></span>'
      +   (isEdit ? '<button class="btn btn-danger" id="oex-modal-del" style="margin-left:auto;">Delete</button>' : '')
      + '</div></div>';
    App.openModal(html, { id, maxWidth: 540, noClose: true });
    App.wireCustomSelects(document);
    const showErr = (m) => { const e = document.getElementById('oex-f-err'); if (e) { e.textContent = m; e.style.display = 'inline'; } };

    if (isEdit) document.getElementById('oex-modal-del')?.addEventListener('click', async () => { App.closeModal(id); await this._delete(rec.id); });
    document.getElementById('oex-f-recurring')?.addEventListener('change', (e) => {
      const w = document.getElementById('oex-f-term-wrap');
      if (w) w.style.display = e.target.checked ? '' : 'none';
    });
    document.getElementById('oex-save')?.addEventListener('click', async () => {
      const date     = document.getElementById('oex-f-date')?.value || '';
      const category = document.getElementById('oex-f-cat')?.value || '';
      const vendor   = (document.getElementById('oex-f-vendor')?.value || '').trim();
      const amount   = parseFloat(document.getElementById('oex-f-amount')?.value || '');
      const notes    = (document.getElementById('oex-f-notes')?.value || '').trim();
      if (!date) { showErr('Pick a date.'); return; }
      if (!category) { showErr('Pick a category.'); return; }
      if (isNaN(amount) || amount <= 0) { showErr('Enter an amount above zero.'); return; }
      const updates = { date, category, vendor, amount, notes };
      const recChecked = !!document.getElementById('oex-f-recurring')?.checked;
      const freqV = document.getElementById('oex-f-frequency')?.value || 'monthly';
      const termV = parseInt(document.getElementById('oex-f-term')?.value, 10);
      if (recChecked && document.getElementById('oex-f-term')?.value && (isNaN(termV) || termV < 1)) { showErr('A fixed term must be 1 month or more, or leave it blank to recur until you stop it.'); return; }
      const touched = [];
      // ⚠ This branch REPLACES array slots (arr[idx] = Object.assign({}, ...)) rather than mutating
      // the records, so snapshotting the record objects would capture the new ones. Snapshot the
      // ARRAY instead. A bulk write cannot revert itself, and this one was discarded — so a failed
      // save left the edited bill on screen and in Books while the server kept the old one.
      const undoArr = arr.slice();
      if (isEdit) {
        const idx = arr.findIndex(r => r.id === rec.id);
        if (idx >= 0) arr[idx] = Object.assign({}, arr[idx], updates);
        // Recurring on/off + frequency + term are series-level, so they always land
        // on the series parent no matter which entry you edited.
        const parentId = rec.recurring_parent || rec.id;
        const pIdx = arr.findIndex(r => r.id === parentId);
        if (pIdx >= 0) {
          if (recChecked) {
            /* ⚠ TURNING A PAUSED BILL BACK ON MUST NOT INVENT THE PAUSE (S226 round 2, F2). The
               catch-up fills from the series START, so without this it generated every month the
               bill was switched off. The months between the stop and today become skipped months —
               the same list a deleted month uses, so there is one mechanism, not two. The resume
               month itself bills normally: turning it back on means you are paying it again now. */
            const wasStopped = arr[pIdx].stopped_ym;
            const skips = this._skips(arr[pIdx]).slice();
            if (wasStopped) {
              this._monthsBetween(String(wasStopped), this._currentMonthKey())
                .forEach(m => { if (skips.indexOf(m) < 0) skips.push(m); });
            }
            arr[pIdx] = Object.assign({}, arr[pIdx], { recurring: true, frequency: freqV,
              term_months: (termV && termV > 0) ? termV : null,
              /* ⚠ THE SCHEDULE FOLLOWS THE DUE DATE, BECAUSE THE FORM SAYS IT DOES. This read
                 `arr[pIdx].recur_day || …`, and every creation path sets recur_day — so the `||`
                 fallback could only fire when the field was missing and the edit form could never
                 change the day at all. Directly under a line of its own help text reading "Set the
                 Due Date above to when this bill is next due. The schedule repeats from that date."
                 ⚠ Only when the row BEING EDITED is the series parent: changing one generated
                 month's date reschedules that month, not the series. */
              recur_day: (pIdx === idx ? (parseInt(String(date).slice(8, 10), 10) || arr[pIdx].recur_day || 1)
                                       : (arr[pIdx].recur_day || (parseInt(String(arr[pIdx].date).slice(8, 10), 10) || 1))),
              skip_months: skips, stopped_ym: null });
          } else {
            arr[pIdx] = Object.assign({}, arr[pIdx], { recurring: false, frequency: undefined, term_months: null,
              stopped_ym: arr[pIdx].stopped_ym || this._currentMonthKey() });
          }
        }
        if (idx >= 0) touched.push(arr[idx]);
        if (pIdx >= 0 && pIdx !== idx) touched.push(arr[pIdx]);
      } else {
        const newRec = Object.assign({ id: App.uid ? App.uid() : ('oex-' + Date.now()), created_at: new Date().toISOString() }, updates);
        if (recChecked) { newRec.recurring = true; newRec.frequency = freqV; newRec.term_months = (termV && termV > 0) ? termV : null; newRec.recur_day = parseInt(String(date).slice(8, 10), 10) || 1; }
        arr.push(newRec);
        touched.push(newRec);
      }
      if (!(await App.putRecordsBulk('core', 'operating_expense', touched))) {
        arr.length = 0; arr.push(...undoArr);
        showErr('Could not save. Nothing was changed — check your connection and try again.');
        return;
      }
      App.closeModal(id);
      this._rerender();
    });
  },

  // ── Stop a recurring series ──────────────────────────────────────────────
  // Turns recurring off on the series parent: past months stay on the books, but
  // it stops projecting into next month and the Cash Forecast. This is the "until
  // you cancel" end for an ongoing bill (or an early stop on a fixed-term one).
  async _stopRecurring(id) {
    const arr = this.records();
    const r = arr.find(x => x.id === id);
    if (!r) return;
    const parentId = r.recurring_parent || r.id;
    const pIdx = arr.findIndex(x => x.id === parentId);
    if (pIdx < 0) return;
    const p = arr[pIdx];
    const who = p.vendor || p.category || 'This bill';
    const ok = await App.confirm({
      title: 'Stop this recurring bill?',
      message: who + ' will stop recurring. Past months stay on your books, and it drops off next month and the Cash Forecast.',
      confirmText: 'Stop Recurring', cancelText: 'Keep It'
    });
    if (!ok) return;
    /* ⚠⚠ RECORD *WHEN* IT STOPPED, NOT JUST THAT IT DID (S226 round 2, F2). Nothing wrote
       `stopped_ym` — and CashEngine.projectedBills and hub-breakeven have both READ it all along, so
       this is a field two other systems already expected and never received. Without it a paused
       bill has no memory of the pause: re-ticking Recurring in the edit form sent the catch-up back
       to the series START and it invented every month the operator did not pay. Measured on a $289
       subscription paused four months: $1,156 of phantom expense appearing at once in Books,
       breakeven and the P&L. The resume in _openModal turns this into skipped months.
       ⚠ AND THE WRITE IS CHECKED NOW. This was the only writer in the family that ignored its
       result — _delete and the edit form both roll back. A failed stop left the row showing Repeat
       instead of Stop, dropped the Expected line and the forecast entry, and then came back
       generating on the next login, because the server still had recurring:true. */
    arr[pIdx] = Object.assign({}, p, { recurring: false, term_months: null, stopped_ym: this._currentMonthKey() });
    if (!(await App.putRecord('core', 'operating_expense', arr[pIdx]))) { arr[pIdx] = p; return; }
    this._rerender();
  },

  // ── Duplicate ──────────────────────────────────────────────────────────
  // Opens the form pre-filled from the row, dated next month, as a NEW entry.
  // Nothing is booked until the operator reviews the amount and saves, so an
  // accidental click can never log an unconfirmed expense ([[output-honesty]]).
  _duplicate(id) {
    const src = this.records().find(r => r.id === id);
    if (!src) return;
    let date = App.todayLocal();
    const d = new Date(String(src.date).length <= 10 ? src.date + 'T00:00:00' : src.date);
    if (!isNaN(d.getTime())) {
      const base = new Date(d.getFullYear(), d.getMonth() + 1, 1);   // first of next month
      const dim = this._daysInMonth(base.getFullYear(), base.getMonth());
      date = App.ymdLocal(new Date(base.getFullYear(), base.getMonth(), Math.min(d.getDate(), dim)));
    }
    this._openModal(null, { date, category: src.category, vendor: src.vendor, amount: src.amount, notes: src.notes });
  },

  // ── Delete ─────────────────────────────────────────────────────────────
  async _delete(id) {
    const arr = this.records();
    const rec = arr.find(r => r.id === id);
    if (!rec) return;
    const ok = await App.confirmDelete();
    if (!ok) return;
    /* ⚠⚠ DELETING A GENERATED MONTH HAS TO BE RECORDED, OR IT IS NOT A DELETE (S226a). These rows
       are DERIVED — the catch-up regenerates them from the parent on any later load — so removing
       the row alone left no trace of the decision and _rerender re-minted it in the same breath.
       The month goes on the PARENT, which is the thing that survives. Written BEFORE the removal:
       if this write fails the row stays, which is recoverable, where the reverse order would delete
       a row that is about to come back. */
    if (rec.recurring_parent) {
      const pIdx = arr.findIndex(x => x && x.id === rec.recurring_parent);
      if (pIdx >= 0) {
        const mk = String(rec.recurring_month || String(rec.date || '').slice(0, 7));
        const skips = Array.isArray(arr[pIdx].skip_months) ? arr[pIdx].skip_months.slice() : [];
        if (mk && skips.indexOf(mk) < 0) skips.push(mk);
        const prior = arr[pIdx];
        arr[pIdx] = Object.assign({}, prior, { skip_months: skips });
        if (!(await App.putRecord('core', 'operating_expense', arr[pIdx]))) { arr[pIdx] = prior; return; }
      }
    }
    /* ⚠ DELETING THE SERIES PARENT LEFT ITS GENERATED MONTHS ORPHANED, AND ONE OF THEIR BUTTONS WAS
       DEAD (S226h). The children keep recurring_parent pointing at a record that no longer exists,
       so they still render the "recurring" tag and a Stop button — and _stopRecurring returns on
       `pIdx < 0` BEFORE it asks for confirmation, so the click did nothing at all, silently.
       Detaching them is what Stop already promises for the money ("past months stay on your books"):
       the expenses remain, they simply stop claiming to belong to a series that is gone. */
    /* ⚠⚠ THE REMOVAL GOES FIRST, AND IT IS CHECKED. It used to send the irreversible detach and
       then call removeRecord without looking at the result — so a refused delete (a viewer, a full
       disk) left the parent present, still recurring, with its children already stripped of
       recurring_parent on the server. The dedupe set was then empty and the next catch-up
       regenerated the lot: measured 4 rows -> 7 rows and $17,100 -> $30,600, made permanent by the
       natural retry. Removing first is recoverable in the one direction that matters: the real
       removeRecord puts the row back and says why, and nothing else has been touched yet.
       ⚠ AND THE GATE IS "DOES ANYTHING POINT AT THIS ROW", not "is it recurring" (F4). A STOPPED
       series has recurring:false, so deleting it skipped the detach entirely and left orphans — and
       an orphan cannot cover its own month, so re-creating the bill regenerated every one of them
       on top: $8,400 for a $4,200 month. */
    if (!(await App.removeRecord('core', 'operating_expense', id))) return;
    const kidIdx = [];
    arr.forEach((x, i) => { if (x && x.recurring_parent === rec.id) kidIdx.push(i); });
    if (kidIdx.length) {
      const detached = kidIdx.map(i => {
        const c = Object.assign({}, arr[i]);
        delete c.recurring_parent; delete c.recurring_month;
        return c;
      });
      const undoKids = kidIdx.map(i => arr[i]);
      kidIdx.forEach((i, n) => { arr[i] = detached[n]; });
      /* ⚠ CHECKED, and the revert puts memory back in step with the SERVER — not because the orphan
         state is harmful (the parent is gone, so nothing regenerates and _seriesOf renders them as
         ordinary rows either way) but because leaving memory saying "detached" over a server that
         still says "attached" is the divergence every other bulk site in the app is required to
         avoid. A tree-wide pin enforces that rule and correctly caught this one. */
      if (!(await App.putRecordsBulk('core', 'operating_expense', detached))) {
        kidIdx.forEach((i, n) => { arr[i] = undoKids[n]; });
      }
    }
    this._rerender();
  }
};

/* ── Expense History — the Books "Expense History" page ──────────────────────
   A thin screen that opens its own Hub full-page and delegates rendering to
   S.HubOperatingExpenses.renderHistory (the read-only-ish log of past months,
   with its own stat box). Lives here so it shares all the same row helpers. */
S.HubExpenseHistory = {
  open() {
    App.openHubFullPage('Expense History', (mount) => { S.HubOperatingExpenses.renderHistory(mount); }, 'expense-history');
  }
};
