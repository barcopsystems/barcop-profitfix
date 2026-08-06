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
    /* ⭐⭐⭐ PHASE 2: THE TRACKER LOSES ITS MONEY, SO THIS BECOMES A CATEGORY AN OPERATOR CAN PICK.
       Kyle, on the maintenance screen: *"i had no idea that the cost entered there goes in separate
       as an expense.. and neither would the user."* He was right. `sc_maintenance.cost` was summed
       straight onto the Income Statement's Repairs and maintenance line and onto Schedule C Line 21
       — while THIS screen actively routed repairs away ("Repairs go in Shift Control"). The money
       was on the P&L, the operator was told not to log it where the P&L is, and nothing anywhere
       said the number they typed was an expense. Now it is one category, on one ledger, and the
       maintenance log reads its repair spend back from here instead of storing it. */
    'Repairs and Maintenance',
    /* ⭐⭐⭐ PHASE 2 ITEM 9 — THE LAST P&L LINE FED FROM OUTSIDE THE LEDGER.
       Delivery commissions are NET-SETTLED: DoorDash deposits sales minus its cut, so the fee never
       leaves the bank as its own debit and can never be read off a statement. That makes it one of
       the very few figures an operator legitimately has to TYPE — and that exempts it from "never
       type what Bar Cop can read", not from "one ledger for money out". It is an operating expense
       and it belongs here. It is NOT a cash outflow: no money left the bank.
       The weekly roll stays the place it is typed; the ledger mirrors it. */
    '3rd-Party Platform Fees',
    'Other'
  ],

  /* ⭐⭐ THE CASH-ONLY CATEGORIES — PHASE 1 OF THE ONE-LEDGER REBUILD (2026-08-04).
     Money that genuinely left the bank but is NOT a cost of running the bar: an owner draw is a
     distribution of profit, a loan payment is principal, a tax remittance is money passing through,
     a transfer never left the business at all. They belong in the same ledger as every other dollar
     out — one place to look, one place to type — and Books excludes them from the Income Statement
     by name rather than by living in a separate store nobody could see the boundary of.

     ⛔ DECLARED NOW, EXPOSED TO NOBODY YET. These are deliberately NOT in `CATEGORIES`, so the entry
     form does not offer them and `_matchCat` cannot bind an imported row to one. Adding them to the
     picker before the screens merge would let an operator file a draw as an operating expense, which
     is the exact defect this rebuild exists to close, introduced by the fix for it. They start being
     offered when Cash Outflows folds in; until then they exist so that Books already knows to
     exclude them when the migration writes the first one.

     ⛔⛔ AND THE `other` COLLISION IS THE REASON THIS IS A MAPPING AND NOT A LIST.
     `hub-cash-outflows.TYPES` ends with `['other', 'Other']` and this log's ninth category is also
     `Other`. Mapping type `other` onto category `Other` would turn every miscellaneous cash outflow
     into an operating expense on the Income Statement the moment the migration ran — silently,
     because both names are correct inside their own screen. `Other Cash Outflow` is a name of its
     own, and `verify-cash-only-categories.js` block B pins that none of the five can ever collide. */
  CASH_ONLY_CATEGORIES: [
    { type: 'draw',     name: 'Owner Draw' },
    { type: 'loan',     name: 'Loan Payment' },
    { type: 'capital',  name: 'Capital and Equipment' },
    { type: 'tax',      name: 'Tax Remittance' },
    { type: 'other',    name: 'Other Cash Outflow' }
  ],
  // Is this category money out that is NOT an operating cost? Read by Books, which gives it no line.
  isCashOnlyCategory(c) {
    const t = String(c == null ? '' : c).trim().toLowerCase();
    return !!t && this.CASH_ONLY_CATEGORIES.some(x => x.name.toLowerCase() === t);
  },

  /* ⭐⭐ ONE CASH OUTFLOW AS A LEDGER ROW. PURE — it converts a record, it never writes one, which
     is what lets the whole migration be rehearsed and proved before it touches a real account
     (`verify-outflow-migration-equality.js`).

     ⛔ `type` IS CARRIED THROUGH, AND THAT IS THE WHOLE REASON THIS IS SAFE. Every consumer of an
     outflow branches on it: the reserve wants loan and capital, the tax projection wants tax,
     break-even's debt figure wants loan and capital, the labels want all five. Keeping the field
     means nothing downstream has to learn anything in this phase — Books excludes by CATEGORY, the
     engine still reads TYPE, and the two are the same record. `type` comes out in Phase 5, once
     every consumer has been converted and the equality harness has watched each one move. A
     migration that also rewrites its consumers is two changes wearing one name and neither can be
     proved.

     ⛔ THE ID IS PRESERVED. `putRecordsBulk` upserts by id, so a migration that minted new ids would
     double every outflow the second time it ran — and the second run is exactly what happens when a
     marker write fails ([[test-the-retry]]).

     ⚠ An unknown type falls to `Other Cash Outflow` rather than to the expense category `Other`,
     which is the collision block B of the category pin exists to stop. Falling to a real operating
     expense would put it on the Income Statement. */
  /* ⭐⭐⭐ PHASE 2 — A REPAIR BECOMES A LEDGER ROW. PURE, like its cash-outflow sibling.
     ⛔ THE DATE IS `date_reported`, AND THAT IS NOT AN ACCIDENT. Books has always booked a repair by
     `date_reported || date` — when it was REPORTED, not when it was resolved or paid. Dating the
     ledger row any other way moves money between months, and months that are already closed would
     silently restate. Equality means the same dollar in the same month; if that convention should
     change, it changes ONCE, visibly, as its own decision.
     ⛔ NO COST YET IS NOT AN EXPENSE. An open ticket with a null cost makes no row at all — the
     tracker goes on tracking it. A ZERO cost DOES make a row (a warranty repair really did cost
     nothing, and the operator recorded that on purpose). */
  migrateMaintenanceRow(m) {
    if (!m || m.id == null) return null;
    const cost = parseFloat(m.cost != null ? m.cost : m.amount);
    if (isNaN(cost)) return null;
    return {
      id:         m.id,
      date:       m.date_reported || m.date || '',
      category:   'Repairs and Maintenance',
      vendor:     m.assigned_to || '',
      amount:     cost,
      notes:      m.issue || '',
      created_at: m.created_at || new Date().toISOString(),
      migrated_from: 'maintenance'
    };
  },

  /* ⭐⭐ PHASE 2 ITEM 9 — A WEEK'S DELIVERY COMMISSION BECOMES A LEDGER ROW. PURE.
     ⛔ DATED AT `period_end`, so it lands in the month the week closed — which is the month Books
     has always counted it in. Any other date restates a closed period.
     ⛔ NO FEE, NO ROW. A bar that did not run delivery this week has nothing to expense, and a $0
     row per week would bury the expense log in noise. (Maintenance differs on purpose: a ZERO-cost
     repair is a fact the operator recorded deliberately. Here a zero means "no delivery".) */
  migratePlatformFeesRow(w) {
    if (!w || w.id == null) return null;
    const fee = parseFloat(w.platform_fees);
    if (!(fee > 0)) return null;
    return {
      id:         w.id,
      date:       w.period_end || '',
      category:   '3rd-Party Platform Fees',
      vendor:     '',
      amount:     fee,
      notes:      'Delivery and pickup commissions for the week',
      created_at: w.created_at || new Date().toISOString(),
      migrated_from: 'platform_fees'
    };
  },

  migrateCashOutflowRow(o) {
    if (!o || o.id == null) return null;
    const hit = this.CASH_ONLY_CATEGORIES.find(c => c.type === o.type);
    const row = {
      id:         o.id,
      date:       o.date || '',
      category:   (hit || this.CASH_ONLY_CATEGORIES.find(c => c.type === 'other')).name,
      vendor:     '',
      amount:     o.amount,
      notes:      o.notes || '',
      type:       o.type,
      created_at: o.created_at || new Date().toISOString(),
      // Where it came from, so Phase 5 can find these rows again without guessing.
      migrated_from: 'cash_outflow'
    };
    /* ⚠ THE RECURRING FIELDS TRAVEL OR A SERIES STOPS PROJECTING. `recurring`, `frequency`,
       `recur_day`, `term_months` and `stopped_ym` are what the forecast reads to know a loan is
       still being paid; losing any one of them silently empties months of the 13-week projection.
       Copied only when present, so a one-off never gains a recurring flag it did not have. */
    ['recurring', 'frequency', 'recur_day', 'term_months', 'stopped_ym', 'skip_months', 'recurring_parent']
      .forEach(k => { if (o[k] !== undefined) row[k] = o[k]; });
    return row;
  },

  /* ⭐⭐⭐ THE MIGRATION — PHASE 1, AND IT IS DELIBERATELY INVISIBLE.
     Every cash outflow becomes a ledger row. Nothing reads those rows as outflows yet: the engine
     still reads `App.data.cash_outflows`, Books excludes their categories from the Income
     Statement, and `_sumMonth`/`_sumYTD` exclude them from anything headed "operating expenses".
     So a successful run changes not one figure anywhere in the app, which is exactly what
     `verify-outflow-migration-equality.js` proves across eight numbers from the cash engine and
     break-even. The CUTOVER — pointing `CashEngine.cashOutflows()` at the ledger — is a separate
     one-line change made only after this has run and been looked at.

     ⛔ ADDITIVE. `App.data.cash_outflows` is not touched, not emptied and not deleted. The old
     store stays readable for as long as it takes to trust this, and Phase 5 removes it.

     ⛔ RE-RUNNABLE WITHOUT DAMAGE, WHICH IS THE PROPERTY THAT MATTERS MOST. The marker is written
     only AFTER the write lands, so a refused write leaves it unset and the whole thing retries on
     the next login — and that retry is the dangerous moment ([[test-the-retry]]). Two things make it
     safe: ids are preserved, so `putRecordsBulk` upserts rather than duplicating, and any row whose
     id is already in the ledger is skipped outright. A migration that minted new ids would double
     every outflow on the second attempt.

     ⛔ NEVER OFF A CACHE-SERVED LOAD. `DB._loadDegraded` is set whenever any array this login came
     from the offline cache, and app.js's own comment explains why that must block a permanent
     marker: a cached read is indistinguishable from a real one, so migrating off a partial picture
     would mark the job done having converted only the records the cache happened to hold. */
  async migrateCashOutflowsOnce() {
    if (typeof App === 'undefined' || !App.data) return false;
    const marks = App.data.migrated_kinds = App.data.migrated_kinds || {};
    if (marks.cash_outflow_to_ledger) return false;
    if (typeof DB !== 'undefined' && DB._loadDegraded) return false;
    const src = Array.isArray(App.data.cash_outflows) ? App.data.cash_outflows : [];
    const arr = this.records();
    const have = {};
    arr.forEach(r => { if (r && r.id != null) have[r.id] = true; });
    const rows = src.map(o => this.migrateCashOutflowRow(o)).filter(r => r && !have[r.id]);
    /* Nothing to move is a real, successful outcome — a bar that never logged an outflow, or a
       second login after the first run. Marking it done is what stops this walking the store on
       every load forever. */
    if (!rows.length) { marks.cash_outflow_to_ledger = true; await App.saveKey('migrated_kinds'); return false; }
    arr.push.apply(arr, rows);
    let ok = false;
    // quiet: this fires from a boot, never from something the operator did — the same policy the
    // reconcile below states for the identical situation, and the catch-up above already uses.
    // A red "save failed" toast at login, for a background job nobody asked for, is not actionable.
    try { ok = await App.putRecordsBulk('core', 'operating_expense', rows, { quiet: true }); }
    catch (e) { ok = false; }
    // A refused write takes the rows back out of memory and leaves the marker unset, so the next
    // login tries again against a store that never saw them.
    if (!ok) { App.dropRows(arr, rows); return false; }
    marks.cash_outflow_to_ledger = true;
    await App.saveKey('migrated_kinds');
    return true;
  },

  /* ⭐⭐⭐ THE RECONCILE — PHASE 1 STEP 7. THE LEDGER'S CASH ROWS ARE A PURE FUNCTION OF THE OLD
     STORE, AND THIS IS WHAT KEEPS THEM THAT WAY.
     The migration above is one-time and marked. This runs on EVERY load, right after it, and is the
     repair for everything the one-time pass cannot cover:
       · a live write whose ledger half was refused (the door writes the old store first on purpose)
       · a delete whose old-store half was refused, which restores the twin
       · outflows that arrived by a path the migration never saw — the sample-data seed, or an
         account whose migration was skipped because that login was served from cache
     Without it, "the ledger holds every dollar out" is true only until the first refused write, and
     nothing would ever say so.

     ⛔ ADDITIVE, AND THAT IS THE WHOLE SAFETY ARGUMENT. It only ever writes rows INTO the ledger —
     it never deletes one. A pass that removed ledger rows with no matching outflow would be correct
     on paper and catastrophic on a login where `cash_outflows` came back empty for any reason other
     than the operator emptying it. The door's delete order is what makes a removal pass unnecessary:
     the ledger row goes first, so an orphan is never created.

     ⛔ NEVER OFF A CACHE-SERVED LOAD, for the same reason the migration refuses one: a partial
     picture would rewrite ledger rows from outflows that are not all there.
     ⚠ A row already in the ledger under a DIFFERENT origin is left alone. Only rows this mechanism
     created (`migrated_from: 'cash_outflow'`) may be rewritten, so an id collision with a real
     operating expense can never overwrite the operator's own bill.
     ⚠ `created_at` is provenance, not money: the mapping mints one when the source has none, so
     comparing it would make every load rewrite every row forever. The stored one is kept. */
  async reconcileCashOutflowLedger() {
    return this._reconcileLedgerFrom(App.data && App.data.cash_outflows,
      this.migrateCashOutflowRow, 'cash_outflow');
  },
  /* ⭐ PHASE 2, the same job for the maintenance log. `App.shiftData`, not `App.data` — the
     maintenance tracker lives in the Shift Control module, which is a different store entirely. */
  async reconcileMaintenanceLedger() {
    return this._reconcileLedgerFrom(App.shiftData && App.shiftData.sc_maintenance,
      this.migrateMaintenanceRow, 'maintenance');
  },
  /* ⭐ PHASE 2 ITEM 9. The weekly roll is where a delivery commission is typed; the ledger mirrors
     it, so Books reads one place and `cash-engine.weeklyProfit` / `profit-forecast` go on reading
     the weekly field untouched. */
  async reconcilePlatformFeesLedger() {
    return this._reconcileLedgerFrom(App.data && App.data.weeks,
      this.migratePlatformFeesRow, 'platform_fees');
  },

  /* ⭐⭐ ONE RECONCILE, TWO SOURCES. Phase 2 needs the identical job for the maintenance log, and a
     second near-identical copy is exactly the drift this rebuild exists to end — the two would agree
     today and diverge the first time either is touched. `origin` is both the stamp the mapping
     writes and the guard that stops this rewriting a row it did not create. */
  async _reconcileLedgerFrom(source, mapFn, origin) {
    if (typeof App === 'undefined' || !App.data) return 0;
    if (typeof DB !== 'undefined' && DB._loadDegraded) return 0;
    const src = Array.isArray(source) ? source : [];
    if (!src.length) return 0;
    const arr = this.records();
    const by = {};
    arr.forEach(r => { if (r && r.id != null) by[r.id] = r; });
    // Key-order-independent, so a row that came back from the server in a different order than the
    // mapping builds it is not mistaken for a difference and rewritten on every single load.
    /* Key-order-independent, so a row that came back from the server in a different order than the
       mapping builds it is not mistaken for a difference and rewritten on every single load.
       ⚠ AND UNDEFINED-BLIND, which is the other half. `JSON.stringify` DROPS an undefined value from
       an object but renders it as `null` inside an array — so a source row missing `amount` or
       `type` stores a payload with no such key, while the freshly mapped row carries
       `["type",null]`. That compares unequal forever: a silent rewrite of the same bytes on every
       login for the life of the account. Treating undefined as absent is what the storage does. */
    const norm = (r) => JSON.stringify(Object.keys(r).filter(k => r[k] !== undefined).sort().map(k => [k, r[k]]));
    const rows = [];
    src.forEach(o => {
      const want = mapFn.call(this, o);
      if (!want) return;
      const have = by[want.id];
      if (have && have.migrated_from !== origin) return;   // somebody else's row — never touch it
      if (have) want.created_at = have.created_at || want.created_at;
      if (have && norm(have) === norm(want)) return;               // already in step
      rows.push(want);
    });
    if (!rows.length) return 0;
    rows.forEach(w => { const i = arr.findIndex(r => r && r.id === w.id); if (i >= 0) arr[i] = w; else arr.push(w); });
    let ok = false;
    try { ok = await App.putRecordsBulk('core', 'operating_expense', rows, { quiet: true }); }
    catch (e) { ok = false; }
    /* A refused repair puts memory back exactly as putRecord does for a single row, and stays
       silent — the operator did not ask for this and nothing they can see is wrong. The next login
       tries again, against a ledger that never saw the rows. */
    if (!ok) {
      rows.forEach(w => {
        const i = arr.findIndex(r => r && r.id === w.id);
        if (i < 0) return;
        if (by[w.id]) arr[i] = by[w.id]; else arr.splice(i, 1);
      });
      return 0;
    }
    return rows.length;
  },

  /* ⭐⭐⭐ THE REPAIR — REMOVE THE ROWS THE APP ITSELF SHOULD NEVER HAVE WRITTEN.
     `catchUpRecurring` used to adopt every migrated recurring outflow as a recurring BILL parent and
     generate a real child row per elapsed month, on every login, forever. That is fixed at source,
     but the rows already written are sitting in real accounts. They are invisible today (they carry
     the parent's cash-only category) and they are POISON at the cutover: the moment
     `CashEngine.cashOutflows()` reads the ledger, each one becomes a second copy of a payment the
     engine already projects from the series. A $4,000 monthly draw migrated three months ago would
     be charged four times.

     ⛔ THE DISCRIMINATOR IS EXACT, WHICH IS THE ONLY REASON A DELETE IS ACCEPTABLE HERE. A generated
     row has `recurring_parent` and NO `migrated_from`. Every genuine twin carries
     `migrated_from: 'cash_outflow'`, because `migrateCashOutflowRow` always sets it and nothing else
     writes one. And a row the OPERATOR typed under a cash-only category name has neither mark, so
     this cannot reach their money — that case is handled by `_isOperatingRow`, which makes it
     visible again rather than deleting it.

     ⛔ IT DELETES NOTHING IT CANNOT NAME. No date range, no "everything cash-only", no count-based
     heuristic: one predicate, three clauses, each provable from the row itself.
     ⛔ NEVER OFF A CACHE-SERVED LOAD — a partial picture could make a real twin look parentless.
     ⛔ A REFUSED DELETE LEAVES THE ROW IN MEMORY so the next login retries against the truth, and
     `_isOperatingRow` keeps it hidden meanwhile, so a failed repair changes no figure. */
  _isGeneratedCashRow(r) {
    return !!r && this.isCashOnlyCategory(r.category) && !!r.recurring_parent && !r.migrated_from;
  },
  async repairGeneratedCashRows() {
    if (typeof App === 'undefined' || !App.data) return 0;
    if (typeof DB !== 'undefined' && DB._loadDegraded) return 0;
    const arr = this.records();
    const doomed = arr.filter(r => this._isGeneratedCashRow(r));
    if (!doomed.length) return 0;
    let removed = 0;
    for (let i = 0; i < doomed.length; i++) {
      // Awaited one at a time: a refusal must stop counting, not be swallowed by a bulk boolean.
      if (await App.removeRecord('core', 'operating_expense', doomed[i].id)) removed++;
    }
    return removed;
  },

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
  _mountStillCurrent() { return this._mountedAt === App._mountSeq; },

  open() {
    /* ⚠ THE BOOKS-AREA GATE, which the three sibling Books pages already carry
       (hub-books-home, hub-books, hub-breakeven) and these two did not. Surfaced 2026-08-01
       when the Cash Playbook's "Review Bills" buttons were retargeted off 'books' (gated) onto
       this screen: that would have moved two doors from behind the gate to in front of it.
       The bills ARE Books data, so a member without Books access should be refused here for
       the same reason they are refused on the P&L. Demo and any session before the role
       resolves still pass — _hubBlocked returns false when there is no role. */
    if (App._hubBlocked && App._hubBlocked('hub-books-home')) return;   // Books area gate
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
  // ⚠ r && to match _catchUpOnce and the note builders, which already carry it. Nothing writes a
  // null into this array today; three functions guarding and three not is how that stops being true.
  /* ⛔⛔ THESE TWO SAY "OPERATING EXPENSES", SO A CASH-ONLY ROW IS NOT IN THEM. Without this the
     outflow migration would not be invisible: the moment a draw became a ledger row, the stat
     headed "This Month" on a screen headed Operating Expenses would jump by every draw, loan
     payment and tax remittance in the month — while Books, which excludes them, kept the old
     figure. Two screens disagreeing about one quantity, caused by a migration that was supposed to
     change nothing anyone could see.
     One rule, `isCashOnlyCategory`, applied everywhere the words "operating expenses" appear. When
     the screens merge and this page becomes Money Out, the stat gets a name that covers both and
     this exclusion is what makes that a labelling change rather than an arithmetic one. */
  /* ⭐⭐⭐ THREE THINGS CAN WEAR A CASH-ONLY CATEGORY, AND ONLY TWO OF THEM ARE MONEY OUT.
     Keying purely on the NAME was wrong in one direction that cost the operator their own money:
       · a MIGRATED TWIN     — cash-only name + `migrated_from` .......... money out, hide it
       · a PHANTOM CHILD     — cash-only name + `recurring_parent` ....... damage, hide it
       · an OPERATOR'S ROW   — cash-only name and NEITHER mark .......... THEIR EXPENSE, show it
     The third exists because `isCashOnlyCategory` matches a string the operator could type into the
     list manager. An expense filed under a category they named "Owner Draw" was excluded from the
     month total, the year total AND the log, so it had no Edit and no Delete button on ANY screen —
     while the By Category card printed "Owner Draw $0.00", which reads as *no draws* rather than
     *$750 missing*. The name is refused now (App.listReservedWhy, both doors), but rows already
     filed under one have to become reachable again, and deleting them was never an option.
     ⛔ THE TEST IS ORDER-INDEPENDENT ON PURPOSE. A phantom child stays hidden by its own
     `recurring_parent`, whether or not `repairGeneratedCashRows` has managed to delete it yet — so a
     refused repair can never put phantom money on the P&L. */
  /* ⭐⭐⭐ PHASE 3 ITEM 15. AN UNCATEGORISED EXPENSE IS A ROW WITH NO CATEGORY. Nothing is stored to
     say so, and that is deliberate: the app already renders **"Uncategorized"** as a synthetic
     heading for a record with no category (`App.groupByCategory`, app.js), so this follows a
     convention rather than inventing a reserved name for an operator to collide with, and it needs
     no migration.
     ⛔ WHY IT EXISTS. The importer used to end `picked || named || learned || 'Other'`, and 'Other'
     is ALSO the ninth category an operator deliberately picks, which Books prints as "Other
     operating expenses" and Schedule C deducts on 27a. So a row Bar Cop could not place and a row
     the operator filed under Other were the same record, and nothing downstream could tell them
     apart. Unclassified money became a real deduction on the one document carrying IRS line numbers.
     ⭐ IT IS A THIRD STATE, NOT A SECOND CASH-ONLY, and the difference is the whole design:
       operating      counts on the P&L      shows on this screen
       cash-only      no                     no, it belongs to Cash Outflows
       uncategorised  NO                     YES, loudly, because somebody has to come back and fix it
     A row nobody can see is a row nobody fixes ([[the-loop]] #115). */
  isUncategorizedRow(r) { return !String((r && r.category) || '').trim(); },
  _isOperatingRow(r) {
    if (!r) return false;
    if (!this.isCashOnlyCategory(r.category)) return true;
    return !r.migrated_from && !r.recurring_parent;
  },

  /* ══ PHASE 4 ITEM 19, STAGE 1 — ONE SCREEN FOR MONEY OUT ════════════════════════════════════
     Cash Outflows, Operating Expenses and Expense History were three sidebar rows over ONE store:
     Phase 1 migrated every outflow into `operating_expenses` under a cash-only category, and
     `_isOperatingRow` was the only thing keeping them apart on screen. This is the chip that
     un-keeps them. `_filteredRecords`' own comment has named this fold since Phase 1.

     ⛔⛔ THE SEAM IS DELIBERATELY NARROW, AND THE NARROWNESS IS THE SAFETY ARGUMENT. Exactly THREE
     things follow the chip: the headline totals, the By Category card and the log. `expenseRows()`
     goes on meaning "the bills" and every bill-specific reader is untouched — the recurring notes,
     the Expected list, the terms banner, `recurringBills`. A draw is not a bill and must never
     become one because a chip is lit, or the screen starts telling the operator their owner draw is
     already logged and the forecast projects it as a fixed cost.

     ⛔ AND NOTHING OUTSIDE THIS SCREEN READS ANY OF IT. Measured tree-wide before building:
     `_sumMonth`, `_sumYTD`, `_filteredRecords`, `_sumMonthByCategory`, `_sumYTDByCategory` and
     `expenseRows` have ZERO callers in any other file. Books reads its own `_opExSums`, break-even
     reads `recurringBills`, the cash engine reads `bills()`. So no chip can move a number on
     another screen. `verify-money-out-kind.js` section C proves the DEFAULT changes nothing at all.

     ⚠ `categoryList()` DELIBERATELY DOES NOT FOLLOW THE CHIP. `hub-books._opExSums` reads it to
     build the Income Statement's lines, and the Add form reads it for the category picker — so
     making it chip-aware would let a display filter on this screen change the P&L on another. The
     CARD gets its own list instead (`_cardCategoryList`). */
  _filterKind: 'operating',   // operating | cash | all — the default is what the screen showed before

  _kindChipOpts() {
    return [
      { v: 'all',       label: 'All Money Out' },
      { v: 'operating', label: 'Bills' },
      { v: 'cash',      label: 'Cash Outflows' }
    ];
  },
  /* Written as a PARTITION, not as two independent tests: `cash` is exactly "not operating", so no
     row can fall in both buckets or in neither, whatever shapes arrive later. */
  _kindMatches(r, kind) {
    if (!r) return false;
    if (kind === 'all') return true;
    return kind === 'cash' ? !this._isOperatingRow(r) : this._isOperatingRow(r);
  },
  /* ⭐ THE INVERSE OF `CASH_ONLY_CATEGORIES`, and the ONLY place a category name becomes a type.
     `migrateCashOutflowRow` maps type → name; this maps name → type, so a row edited or added from
     the Money Out screen can be written back as the outflow it is. Two hand-rolled directions of
     one mapping is how they drift, which is why this reads the same table rather than repeating it.
     Returns '' for anything that is not a cash-only category, so the callers can just ask. */
  _typeForCashCategory(name) {
    const t = String(name == null ? '' : name).trim().toLowerCase();
    if (!t) return '';
    const hit = this.CASH_ONLY_CATEGORIES.find(x => x.name.toLowerCase() === t);
    return hit ? hit.type : '';
  },

  /* ⛔⛔ EDITING A CASH ROW GOES TO THE OPERATOR'S OWN RECORD, NOT TO THE LEDGER TWIN. Same defect
     as the delete above and found the same way: the twin is DERIVED, so `reconcileCashOutflowLedger`
     rewrites it from `cash_outflows` on the next load and the edit silently reverts. The edit has to
     land on the source; the twin follows.
     ⚠ `_writePair` writes the operator's store FIRST and the ledger best-effort, so a refused save
     is reported on the store they can see, and a refused TWIN write leaves the ledger lagging where
     the reconcile repairs it. Returning its boolean means the caller can keep the form open on a
     refusal instead of claiming a save that did not happen ([[test-the-retry]]). */
  async _editCashRow(id, patch) {
    const src = (App.data && Array.isArray(App.data.cash_outflows)) ? App.data.cash_outflows : [];
    const cur = src.find(o => o && o.id === id);
    if (!cur) return false;
    const next = Object.assign({}, cur);
    if (patch.date != null)   next.date = patch.date;
    if (patch.amount != null) next.amount = patch.amount;
    if (patch.notes != null)  next.notes = patch.notes;
    // A category change is a TYPE change on this store — the twin's category is derived from it.
    if (patch.category != null) {
      const t = this._typeForCashCategory(patch.category);
      if (t) next.type = t;
    }
    return await S.HubCashOutflows._writePair(next);
  },

  /* What the exported PDF is called. It must name the SET the export contains, because the chip
     that chose it is in a `no-print` row and never reaches the file. Derived from the chip's own
     label so the two cannot drift apart, with the operating case keeping the name the accountant
     has always seen on it. */
  _kindExportTitle() {
    const kind = this._filterKind || 'operating';
    if (kind === 'operating') return 'Operating Expenses';
    const hit = this._kindChipOpts().find(o => o.v === kind);
    return hit ? hit.label : 'Money Out';
  },
  // The rows this screen is SHOWING. The log, the headline and the By Category card, and nothing else.
  moneyOutRows() {
    const kind = this._filterKind || 'operating';
    return this.records().filter(r => this._kindMatches(r, kind));
  },
  /* The By Category card's OWN row list. Money bucketed into a category the card never draws is
     money nobody can see — the exact defect item 15 fixed, where rows summing to $712.55 were
     computed and never rendered. So when the chip admits cash-only rows, their categories get rows.
     'Other' stays last, same rule as `categoryList()`. */
  _cardCategoryList() {
    const out = this.categoryList().slice();
    if ((this._filterKind || 'operating') !== 'operating') {
      this.moneyOutRows().forEach(r => {
        const c = String((r && r.category) || '').trim();
        if (c && !out.some(x => x.toLowerCase() === c.toLowerCase())) out.push(c);
      });
      const oi = out.findIndex(c => c.toLowerCase() === 'other');
      if (oi >= 0 && oi !== out.length - 1) out.push(out.splice(oi, 1)[0]);
    }
    return out;
  },
  /* ⭐⭐⭐ THE ROWS THIS SCREEN IS ABOUT — USE THIS, NOT `records()`, IN EVERY READER.
     `records()` is the LIVE array and must stay that way: writers push into it, and the migration
     and the reconcile have to see every row including the cash-only ones. But since Phase 1 that
     array also holds owner draws, loan payments and tax remittances, and TEN readers on this screen
     were still asking it "which rows are bills?" — `_catchUpOnce`, `_expectedRecurring`,
     `_termWarning`, `_monthNotes`, `_monthCardHtml`, `_ownCover`, `_sumMonthByCategory`,
     `_sumYTDByCategory`, `_categoryForVendor` and `_buildExpenseRows`. The first six were the
     scan's; the last four the PIN found, which is the point of having one.

     ⛔⛔ THE WORST OF THEM MINTED MONEY. `_catchUpOnce` adopted every migrated recurring outflow as
     a recurring BILL parent and generated a real child row per elapsed month, on every login,
     forever — because `recurring` means two different things in the two stores. Operating expenses
     STORE their history as child rows; cash outflows PROJECT theirs from the parent and store
     nothing. The migration copied the field verbatim across that boundary, which is exactly what
     [[the-loop]] #51 says to check before copying a record shape to its twin. Stop did not stop it
     either: `_owesMonth` never reads `stopped_ym`, and the outflow door's Stop deliberately keeps
     `recurring: true`. The children were invisible — they inherit the cash-only category, so every
     figure that filters excluded them — and at the cutover each one becomes a second copy of an
     outflow the engine already projects.

     ⚠ Fixing them one at a time is what produced three rounds last chat ([[the-loop]] #109). One
     accessor, and `verify-expense-readers-one-set.js` fails the build if an eleventh reader appears
     that asks `records()` a question about bills. */
  expenseRows() { return this.records().filter(r => this._isOperatingRow(r)); },
  /* ⛔⛔ THESE TWO DELIBERATELY DO **NOT** FOLLOW THE MONEY OUT CHIP, and my first version of item 19
     had them doing so. Two things broke, both found by reading the diff rather than by any pin:
       · they feed the CURRENT tab's headline, and the chip only renders on the HISTORY tab — so a
         chip set on one tab silently moved the other tab's numbers with nothing on screen to
         explain it;
       · they feed the OpEx % of Revenue ratio, a named accounting measure that an owner draw has no
         business in ([[output-honesty]]).
     The Current tab is about BILLS by construction — it carries the Add form, the recurring notes,
     the Expected list and the terms banner, every one of them a bill concept. The chip belongs to
     the History tab, and exactly three readers there follow it: `_historyStats`, the By Category
     roll-ups and `_filteredRecords`. */
  _sumMonth(monthKey) {
    return this.expenseRows().filter(r => this._monthKey(r.date) === monthKey)
      .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  },
  _sumYTD(monthKey) {
    const year = monthKey.slice(0, 4);
    return this.expenseRows().filter(r => {
      const mk = this._monthKey(r.date);
      return mk && mk.slice(0, 4) === year && mk <= monthKey;
    }).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  },
  /* ⭐⭐ THE CATEGORY ROLL-UP FOLLOWS THE OPERATOR'S OWN LIST (Kyle, 2026-08-04, found by using the
     app): *"if i customize my category list in the operating expense form.. the by category does not
     change with it."* Both roll-ups asked `CATEGORIES.includes(r.category) ? r.category : 'Other'`,
     which does not merely fail to RENDER an added category, it SILENTLY REASSIGNS its money. Add
     "Delivery App Fees" through the list manager, log $4,000 against it, and the card showed $0.00
     on that line and $4,000 sitting in Other, while This Month and Year to Date directly above it
     counted the same $4,000 correctly. Two figures on one screen disagreeing.
     THE LIST IS: what the operator's own list offers, PLUS anything that actually has money on file.
     The second half is the one that matters — a category they later HID, or a legacy value from an
     old import, must never take its money off the card with it. `App.listOptions` already applies
     hidden/added/`other` correctly, so this door does not re-implement any of that.
     ⚠ ONE LIST, TWO SCREENS. `hub-books._opExSums` reads the same log for the Income Statement and
     carried the identical fold, under a comment claiming a category change here "can never silently
     mis-bucket" there. It now calls this ([[the-loop]] #54: pin the equality, not either number). */
  categoryList() {
    const out = [];
    const push = c => {
      const v = String(c == null ? '' : c).trim();
      if (v && !out.some(x => x.toLowerCase() === v.toLowerCase())) out.push(v);
    };
    (App.listOptions ? (App.listOptions('expense_category') || []) : []).forEach(push);
    // A blank list (the entry form has never rendered, so nothing registered the builtins yet)
    // must still give a full card rather than an empty one.
    if (!out.length) this.CATEGORIES.forEach(push);
    /* Anything with money on file, whatever the list says today — EXCEPT a cash-only category.
       ⛔ Those are what the migration wrote, and a row for Owner Draw on a card headed By Category,
       on a page headed Operating Expenses, is the migration changing something an operator reads.
       They are fully visible on Cash Outflows, which still shows every one unchanged. */
    this.records().forEach(r => {
      if (r && String(r.category || '').trim() && !this.isCashOnlyCategory(r.category)) push(r.category);
    });
    // 'Other' is a real category the operator picks, and the card has always ended with it.
    push('Other');
    /* ⚠ AND IT IS ALWAYS THE LAST ROW. Other is the catch-all, the card has always ended with it,
       and a real category printed underneath it reads like a subtotal line that is not one. Added
       categories and revived hidden ones both append, so without this they land after it. Caught by
       reading a passing assertion's `got=`, not by any assertion. */
    const oi = out.findIndex(c => c.toLowerCase() === 'other');
    if (oi >= 0 && oi !== out.length - 1) out.push(out.splice(oi, 1)[0]);
    /* ⛔⛔ AND UNCATEGORISED MONEY GETS A ROW, AT THE TOP, WHENEVER ANY EXISTS (Phase 3 item 15).
       Found scanning this change: `_byCatCardHtml` builds its rows from THIS list, so a bucket that
       is computed but not listed is money the card silently drops — and the card sits directly under
       "This Month", which DOES count it. That is the same shape as "Logged This Year" reading
       $108,820.04 against a $69,820.04 page: two figures on one screen covering different sets, with
       nothing saying so ([[the-loop]] #109).
       ⭐ FIRST, not last, because it is the only row on the card that is a JOB. Everything else is a
       record of what happened; this one is a question waiting for an answer, and the confirm screen
       already orders itself that way ("what Bar Cop could not place sits at the top").
       ⚠ Only when some exists, so a tidy account never sees the row at all. */
    if (this.records().some(r => this.isUncategorizedRow(r) && !this.isCashOnlyCategory(r && r.category))) {
      out.unshift('Uncategorized');
    }
    return out;
  },
  /* ⛔ BUCKET BY THE RECORD'S OWN CATEGORY. Only a record with NO category falls to Other — that is
     the one thing Other is for, and it is what the importer's own fallback writes. */
  /* ⭐ THE DISPLAY BUCKET. A row with no category reads as **Uncategorized**, the same synthetic
     heading `App.groupByCategory` already gives a record with no category everywhere else in the
     app — never a stored value. It used to fall to 'Other', which is what let unclassified money
     hide inside a real, deductible P&L line.
     ⛔ ONE RULE, SHARED. Books' roll-up buckets through this same member, so the By Category card
     and the Income Statement cannot disagree about where a dollar went.
     ⚠ THE LABEL IS INSIDE THE FUNCTION, NOT A SIBLING CONSTANT (integrity #16). Every slicer in the
     harness suite lifts METHODS by name, so a `UNCATEGORIZED_LABEL:` data property beside this one
     would be invisible to all of them and kill the stub on correct code. Nothing else needs the
     string: everything buckets through this member. */
  _catOf(r) { return String((r && r.category) || '').trim() || 'Uncategorized'; },
  // ⚠ CARD-LOCAL, and it follows the chip (item 19). `_cardCategoryList` seeds the rows so money
  // admitted by the chip always has a row to land in — see the note there.
  _sumMonthByCategory(monthKey) {
    const out = {};
    this._cardCategoryList().forEach(c => { out[c] = 0; });
    this.moneyOutRows().filter(r => r && this._monthKey(r.date) === monthKey).forEach(r => {
      const c = this._catOf(r);
      out[c] = (out[c] || 0) + (parseFloat(r.amount) || 0);
    });
    return out;
  },
  // Same list and same bucketing rule as _sumMonthByCategory above, for the same reason.
  _sumYTDByCategory(monthKey) {
    const year = monthKey.slice(0, 4);
    const out = {};
    this._cardCategoryList().forEach(c => { out[c] = 0; });
    this.moneyOutRows().filter(r => {
      if (!r) return false;
      const mk = this._monthKey(r.date);
      return mk && mk.slice(0, 4) === year && mk <= monthKey;
    }).forEach(r => {
      const c = this._catOf(r);
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

  /* ⚠ ONE BASIS MONTH FOR BOTH "% OF REVENUE" FIGURES ON THIS SCREEN. They used to pick it
     separately, so with a confirmed ZERO-revenue week in the named month the stat printed "—" with
     no month named while the By Category card headed its column "% of Revenue, YTD thru June 2026"
     and printed live percentages. One screen, two answers to "do we have June?".
     ⚠ WHAT THIS DOES *NOT* GUARANTEE, so nobody reads more into it than it says: the By Category
     column additionally requires the basis month to be in the CURRENT year (a year-to-date ratio
     cannot be last year's), so every January the stat correctly names December while that column
     correctly falls back to a plain header and prints nothing. Both readings are honest and both are
     labelled; they are answering two different questions, not disagreeing about one. */
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
  /* ⚠⚠ AND A PAYMENT CANNOT SETTLE A BILL THAT IS NOT DUE YET (round 4, F1). CashEngine learned this
     in round 3 and this door did not — while the comment on the shared key claimed the two now "ask
     the same question the same way". Measured: a rent series due on the 25th, with last month's rent
     logged late on the 3rd, made the LOG read $4,200 for the month while the FORECAST correctly read
     $8,400 — the 25th had not been paid. The log is what Books, the P&L, YTD, By Category and the
     1099 worksheet all read, so the understatement is the one that reaches the accountant.
     A fact about time, not a threshold: a logged row may only stand for an occurrence dated on or
     BEFORE it. dueDay is the series' own recurrence day, clamped to the month like the catch-up. */
  _ownCover(p, monthKey, used) {
    if (!p || !monthKey) return null;
    const key = App.billIdentityKey(p);
    const y = parseInt(monthKey.slice(0, 4), 10), m0 = parseInt(monthKey.slice(5, 7), 10) - 1;
    const start = new Date(String(p.date).length <= 10 ? p.date + 'T00:00:00' : p.date);
    const rawDay = parseInt(p.recur_day, 10) || (isNaN(start.getTime()) ? 1 : start.getDate());
    const dueDay = Math.min(rawDay, this._daysInMonth(y, m0));
    const due = monthKey + '-' + String(dueDay).padStart(2, '0');
    const hit = this.expenseRows().find(r => r && r.date && !r.recurring && !r.recurring_parent
      && String(r.date).slice(0, 7) === monthKey && String(r.date).slice(0, 10) >= due
      && App.billIdentityKey(r) === key
      && !(used && used.has(r.id))) || null;
    if (hit && used) used.add(hit.id);   // one logged bill stands down one series, not all of them
    return hit;
  },

  // A generated row already standing for this month of this series.
  _generatedFor(p, monthKey) {
    return this.records().find(r => r && r.recurring_parent === p.id
      && String(r.recurring_month || String(r.date || '').slice(0, 7)) === monthKey) || null;
  },

  /* ⚠⚠ BOTH NOTES COME OUT OF ONE PASS, IN THE ORDER THE CATCH-UP ITSELF USES, because they are two
     answers to the same question and they were contradicting each other on screen: two series with
     the same vendor produced "already logged" and "booked twice" side by side over a month whose
     money was CORRECT. A standalone row is claimed by at most ONE series here, exactly as the
     catch-up claims it at most once — and the suppression pass runs FIRST so the notes follow what
     the catch-up actually did rather than re-deriving it and disagreeing.
     ⚠ THE WARNING'S MATCH IS STRICT PLUS ONE NARROW EXCEPTION, and the exception is the whole reason
     it exists. A bill that arrives through the IMPORTER cannot match strictly: the importer stores
     the raw bank description as the vendor and falls back to the category "Other". So an amount-only
     match is allowed ONLY against an "Other" row. An earlier version allowed amount-only against
     anything and it named the wrong bill: two unrelated $500 expenses (a CPA fee and an ad spend)
     produced "Marsh CPA is booked twice", and matching on category+vendor alone flagged an electric
     bill and a gas bill from one utility as a duplicate. Round numbers are everywhere in a bar.
     ⚠ KNOWN AND ACCEPTED LIMITATION: if the operator logs the bill and then CORRECTS its amount, the
     suppression lapses and the resulting double is NOT flagged — no rule can separate "the same bill,
     corrected" from "a second, different bill" without a threshold fitted to a fixture
     ([[the-loop]] #30). Stated here rather than guessed at. */
  _monthNotes() {
    const mk = this._currentMonthKey();
    const arr = this.expenseRows();
    const pool = arr.filter(r => r && r.date && !r.recurring && !r.recurring_parent
      && String(r.date).slice(0, 7) === mk);
    const used = new Set();
    const series = arr.filter(p => p && p.recurring && !p.recurring_parent);
    const nameOf = (p) => (p.vendor || p.category || 'A recurring bill');
    const withAmt = (p) => nameOf(p) + ' (' + App.fmtCurrency(parseFloat(p.amount) || 0) + ')';
    const covered = [], doubled = [];
    // PASS 1 — mirrors the catch-up: a series that owes this month and has no generated row.
    series.forEach(p => {
      if (this._generatedFor(p, mk) || !this._owesMonth(p, mk)) return;
      /* ⚠⚠ THROUGH _ownCover, NOT BY HAND (round 5, F5). This was a raw identity match with no
         due-day test, so it disagreed with the catch-up that actually made the decision — the exact
         divergence S1 fixed one function away. It claimed "Bar Cop did not add it again" about a
         payment made for the PREVIOUS month, on a bill still unpaid. One question, one implementation. */
      const hit = this._ownCover(p, mk, used);
      if (hit) covered.push({ name: nameOf(p), key: App.billIdentityKey(p) });
    });
    // PASS 2 — a Bar Cop row already stands for this month AND an unclaimed logged row looks like
    // the same bill. ⚠ The series' own START month counts as generated: the parent IS that month's
    // row, so it is the one month _owesMonth deliberately skips — and it is the likeliest month of
    // all to be imported as well, because setting the bill up is what puts the operator there.
    series.forEach(p => {
      const gen = this._generatedFor(p, mk) || (String(p.date || '').slice(0, 7) === mk ? p : null);
      if (!gen) return;
      const cents = (r) => Math.round((parseFloat(r.amount) || 0) * 100);
      const same = (r) => String(r.category || '') === String(p.category || '')
        && String(r.vendor || '').trim().toLowerCase() === String(p.vendor || '').trim().toLowerCase();
      /* ⚠⚠ THE DUE-DAY RULE REACHES HERE TOO (round 5). PASS 1 was taught it via _ownCover and this
         was left deciding by hand — so a rent paid LATE on the 3rd, for the previous month, made
         this print "looks logged twice" over a month the day rule certifies as CORRECT. Harmless as
         a sentence and dangerous the moment the operator acts on it: deleting the generated row
         drops the month $4,200 into Books, the P&L, By Category and Break-Even.
         ⚠⚠ WHAT THIS DELIBERATELY GIVES UP, so it is not re-opened as an omission ([[the-loop]] #29
         and #30). A payment logged BEFORE the due day now neither suppresses nor warns — so if it
         really was this month's bill paid early, the month reads double and nothing says so. That is
         ACCEPTED, because the two cases are INDISTINGUISHABLE: "last month's bill paid late" and
         "this month's bill paid early" are the same row, and nothing in the data separates them.
         Treating it as the late payment is right far more often (a bill is paid after it is issued),
         it is what the catch-up already assumes, and the alternative — warning on every early
         payment — puts a "check which is real" prompt over months that are correct. Guessing would
         need a threshold fitted to a fixture, which is the one thing this file has learned not to do. */
      const _rawDay = parseInt(p.recur_day, 10) || (() => {
        const s0 = new Date(String(p.date).length <= 10 ? p.date + 'T00:00:00' : p.date);
        return isNaN(s0.getTime()) ? 1 : s0.getDate();
      })();
      const _due = mk + '-' + String(Math.min(_rawDay, this._daysInMonth(
        parseInt(mk.slice(0, 4), 10), parseInt(mk.slice(5, 7), 10) - 1))).padStart(2, '0');
      const hit = pool.find(r => !used.has(r.id) && String(r.date).slice(0, 10) >= _due
        && cents(r) === cents(p) && cents(p) !== 0
        && (same(r) || String(r.category || '') === 'Other'));
      if (hit) { used.add(hit.id); doubled.push({ name: nameOf(p), label: withAmt(p),
        key: App.billIdentityKey(p),
        other: (hit.vendor || hit.category || 'a bill you logged') }); }
    });
    /* ⚠ ONE NAME, ONE CLAIM (round 4). Two DIFFERENT bills that share a vendor — a utility's
       electric and gas — could land in opposite lists, printing "did not add it again" and "logged
       twice" about the same string, with `other` naming that same string so there was nothing to go
       and find. Both sentences were individually true and the pair was useless. The actionable one
       wins, and it carries the AMOUNT so the operator can tell the two bills apart. */
    /* ⚠ DEDUPE ON THE SERIES IDENTITY, NOT ON THE DISPLAY NAME (round 5, F4). Keyed on the vendor
       string, one utility's electric bill being double-booked SILENCED the true "already logged"
       note about that utility's separate GAS bill — the only difference between firing and not was
       that the two bills share a vendor. The operator was left with no explanation for why the gas
       series produced no row, and the obvious response is to enter it again. */
    const loud = new Set(doubled.map(d => d.key));
    return { covered: covered.filter(c => !loud.has(c.key)).map(c => c.name), doubled: doubled };
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


  // Banner for recurring terms within ~2 months of ending or already ended.
  _termWarning() {
    const now = new Date();
    const curIdx = now.getFullYear() * 12 + now.getMonth();
    const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const lbl = (idx) => MON[idx % 12] + ' ' + Math.floor(idx / 12);
    const ending = this.expenseRows().filter(r => r && r.recurring && !r.recurring_parent && r.date && parseInt(r.term_months, 10) > 0).map(p => {
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
    /* ⛔ ONE SET OF RECORDS DRIVES THIS WHOLE SCREEN. The headline, the By Category card and this
       log all have to cover the SAME rows, or the page contradicts itself — which it did the moment
       the outflow migration landed: By Category grew rows for Owner Draw, Loan Payment and Tax
       Remittance, and "Logged This Year" grew by $39,000 to match, on a page headed Expense History.
       ✅ ITEM 19 STAGE 1: THE FOLD HAS HAPPENED. The kind chip decides which rows this page is
       about, and `moneyOutRows()` is the one place that answers it — so the headline, the By
       Category card and this log cannot disagree about the set they cover, whichever chip is lit.
       With the default chip this is byte-identical to the `_isOperatingRow` filter it replaces. */
    let recs = this.moneyOutRows();
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
    // stamping, so `_mountedAt` was permanently stale and `_mountStillCurrent()`
    // could only ever be FALSE — the catch-up repaint below was refused 100% of the
    // time. The operator opened Expense History on the first login of a new month,
    // this month's rent was written to the server and pushed into memory, and the
    // page they were looking at never showed it. Adding it by hand then double-booked
    // it into Books, the P&L, breakeven and prime cost. Stamping at the mount entry
    // point rather than in the caller covers any future door into this page.
    // (It also un-deadened `:230`'s history branch, which was unreachable because
    // `_view` only becomes 'history' by way of this never-stamped mount.)
    if (mount) { this.container = mount; this._mountedAt = App._mountSeq; }
    this._view = 'history';
    this.container.innerHTML = '<div class="screen">' + this._historyStats() + this._renderHistory() + '</div>';
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    this._wireHistory();
  },
  _historyStats() {
    const fmt$ = (v) => App.fmtCurrency(v || 0);
    /* ⛔ SAME SET AS THE CARD AND THE LOG BELOW IT. Kyle caught this from the screen itself: after
       the outflow migration, "Logged This Year" read $108,820.04, which is exactly the By Category
       column INCLUDING $39,000 of draws, loan payments and tax remittances. The honest figure for a
       page headed Expense History is $69,820.04. `Entries` was counting them too.
       ✅ ITEM 19 STAGE 1: this stat box, the By Category card and the log are the THREE readers on
       this tab, and all three now go through `moneyOutRows()` — so the chip cannot move one without
       moving the other two. My first version of item 19 left this line on the bills-only filter
       while the card and the log followed the chip, which is the identical defect above wearing the
       fix's own name. With the default chip this is byte-identical to what it replaced. */
    const recs = this.moneyOutRows();
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
  /* ── Money Out: the same entry card, mounted INSIDE the Close The Books step ──
     ⭐ THE THIRD VIEW, built on `renderHistory`'s shape rather than invented: take a mount, stamp
     the mount sequence, set `_view`, share the wiring. Kyle: *"one place.. that is the only place
     the user has to go to drop or enter an expense."* Step 1 used to be a button that navigated
     here; now the card renders there and this screen keeps the month cards and the history.

     ⛔⛔ RESOLVED BY ID ON EVERY PAINT, NEVER FROM A HELD NODE. `hub-books-home.render()` rewrites
     its own innerHTML every time a step is toggled, so a node captured at mount time is DETACHED by
     the next toggle — and a repaint into a detached node produces no output and no error, which on
     screen is a dead workspace. Looking the id up each time makes that unreachable rather than
     guarded, and the null return is the honest answer to "the operator navigated away".
     ⚠ It does NOT touch the hub topbar the way renderMain does: this is a card inside somebody
     else's page, and clearing their actions would be reaching outside the mount. */
  /* ⭐⭐⭐ THE QUESTION CLOSE THE BOOKS ASKS BEFORE IT DECIDES ITS LAYOUT: is a Money Out import in
     progress? True means the drop / mapper / confirm replaces the four step rows; false means the
     steps render with the manual form inside step 1.
     ⛔ `_moTakeover` IS ITS OWN FLAG AND IT HAS TO BE. The obvious shortcut is to read `_entryMode`
     — but that field is shared with the full Operating Expenses screen and it PERSISTS, so an
     operator who left that screen in import mode would walk into Close The Books and find the page
     already taken over by a drop zone they never asked for. The flag means "the operator opened
     this from the step", which is the fact the layout actually depends on.
     ⚠ `_expenseReview` holds it open too: a file already dropped and waiting to be confirmed must
     not lose the page out from under it. */
  _moTakeover: false,
  moneyOutTakeover() {
    return !!this._moTakeover && (this._entryMode === 'import' || !!this._expenseReview);
  },

  renderMoneyOut(mountId) {
    if (mountId) { this._moMountId = mountId; this._mountedAt = App._mountSeq; }
    const el = document.getElementById(this._moMountId || '');
    if (!el) return;
    /* ⚠ VIEW AND CONTAINER SET BEFORE THE CATCH-UP, NOT AFTER. The catch-up repaints through
       `_rerender`, which reads `_view` to decide where to paint. It resolves on a later microtask
       so today's order could not actually race — but leaving the two lines below the call means the
       correctness depends on that fact staying true, and it is free not to. */
    this.container = el;
    this._view = 'moneyout';
    // The step body and the takeover come out of the same builder; the flag picks which shape.
    el.innerHTML = this._addCardHtml({ inline: true, stepBody: !this.moneyOutTakeover() });
    this._wireCurrent();
  },

  // Re-render whichever view is active (Operating Expenses, Expense History, or the Money Out card
  // on Close The Books), so an edit / delete / stop / import redraws the page the operator is
  // actually on. ⛔ EVERY operator-facing repaint goes through here — a bare renderMain() from a
  // review action would paint the WHOLE expense screen, stats and month cards and all, into a
  // cockpit accordion. verify-money-out-step.js block B sweeps every call site for that.
  _rerender() {
    if (this._view === 'moneyout') return this.renderMoneyOut();
    if (this._view === 'history') return this.renderHistory();
    this.renderMain();
  },

  /* ⛔⛔ A WRITE FROM INSIDE THE STEP CHANGES THE PAGE AROUND THE STEP, AND ONLY THE STEP REPAINTED.
     `_rerender` above repaints the card and nothing else, which is right for a Move To or a section
     toggle — they change no data and a full cockpit repaint would cost the ~460ms-per-tick this
     screen already fights. But an ADD or an IMPORT does change data, and everything the cockpit
     prints is derived from it: the step head reads "No bills logged yet this month", the Where You
     Stand hero reads operating income, the progress bar counts done steps. Repainting only the card
     left the operator looking at a bill they had just logged, sitting directly under a sentence
     saying none was logged. Two things on screen disagreeing, and the wrong one is the headline.
     ⚠ No loop: HubBooksHome.render() ends by calling renderMoneyOut(), which never calls back.
     ⭐ IT ALSO SERVES A LAYOUT CHANGE, which is why it is named for the HOST rather than for the
     write: opening or closing the import takeover swaps the four step rows for the drop panel, and
     that decision belongs to the cockpit, so the cockpit has to re-render to make it. */
  _rerenderHost() {
    const BH = S.HubBooksHome;
    if (this._view === 'moneyout' && BH && BH.container) return BH.render(BH.container);
    this._rerender();
  },

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

  /* The series a row came from, whether or not it is still running. _seriesOf answers the narrower
     question ("is there a LIVE series here"), because that is what decides the row's buttons — this
     one answers "did this row come from a recurring bill at all", which is what its LABEL has to say.
     A row with neither flag nor parent was never part of a series. */
  _seriesAny(r) {
    if (!r) return null;
    if (r.recurring_parent) return this.records().find(x => x && x.id === r.recurring_parent) || null;
    return (r.recurring || r.stopped_ym || r.frequency) ? r : null;
  },

  /* ⚠ A STOPPED SERIES' MONTHS SAY SO (S229). After Stop, a generated month kept sitting under the
     "Recurring" header with no tag at all and a Repeat button — the section and the row telling the
     operator two different things about the same bill. The buttons are right (there is no live
     series to stop), so it is the LABEL that was missing. */
  _recurTag(rec, stopped) {
    const p = rec && rec.recurring_parent ? this.records().find(x => x.id === rec.recurring_parent) : rec;
    const f = p && p.frequency && p.frequency !== 'monthly' ? ' · ' + p.frequency : '';
    return ' <span style="color:var(--t4);font-size:10px;white-space:nowrap;">recurring' + f + (stopped ? ' · stopped' : '') + '</span>';
  },

  // One real-record row: Date, Category (+Recurring tag), Vendor, Amount, actions.
  // opts.minimal (History) = Edit + Delete only — Duplicate and Renew are
  // forward-looking, so they live on the Current tab (this/next month) only.
  _logRowHtml(r, opts) {
    opts = opts || {};
    const fmt$ = (v) => App.fmtCurrency(v || 0);
    const isRec = !!this._seriesOf(r);   // an orphan is not a series — see _seriesOf (S226h)
    // Came from a series that has since been stopped: keep the tag, mark it, keep the plain buttons.
    const wasRec = !isRec && !!this._seriesAny(r);
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
      + '<td style="color:var(--t2);">' + esc(r.category || '')
      + (isRec ? this._recurTag(r) : wasRec ? this._recurTag(r, true) : '') + '</td>'
      + '<td style="color:var(--t2);">' + esc(r.vendor || '') + '</td>'
      + '<td style="font-weight:700;color:var(--t1);">' + fmt$(r.amount) + '</td>'
      + '<td class="no-print" style="text-align:right;white-space:nowrap;">' + actions + '</td>'
      + '</tr>';
  },

  // Expected (not-yet-booked) recurring rows for a future month: a forecast only.
  _expectedRecurring(monthKey) {
    const arr = this.expenseRows();
    const _usedNext = new Set();   // one logged bill stands down one series — see _ownCover
    const idx = parseInt(monthKey.slice(0, 4), 10) * 12 + (parseInt(monthKey.slice(5, 7), 10) - 1);
    const out = [];
    arr.filter(p => p && p.recurring && !p.recurring_parent && p.date).forEach(p => {
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
      // ⚠ THE used SET, which this call was missing (round 4, F5) — so two identical series both
      // stood down against ONE logged payment and the Next Month card showed no Expected row for a
      // bill that is genuinely still owed. The catch-up already threads it; this did not.
      if (this._ownCover(p, monthKey, _usedNext)) return;
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
    // ⛔ `expenseRows`, not `records` — this card printed Owner Draw and Loan Payment rows with
    // working Edit / Delete / Stop buttons, under a headline (`_sumMonth`) that correctly excluded
    // them, so the list did not add up to its own total. Worse, those buttons write only the ledger
    // half, and the reconcile silently reverted the operator's edit on the next login.
    const recs = this.expenseRows().filter(r => r && String(r.date || '').slice(0, 7) === monthKey);
    /* ⚠ A TIEBREAK, because recurring bills all fall on the same day and the order was then whatever
       order the records happened to sit in — it visibly reshuffled after a re-seed. Biggest first
       within a day is what an operator scans for; category settles a true tie so the list is stable
       between renders. */
    const byDate = (a, b) => String(a.date || '').localeCompare(String(b.date || ''))
      || ((parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0))
      || String(a.category || '').localeCompare(String(b.category || ''));
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
    // ⛔ BILLS ONLY, ALWAYS. `_sumMonth` is bills-only by construction and stays that way — see the
    // note on it. This is a named accounting ratio and an owner draw is not an operating expense.
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
    const _notes = this._monthNotes();
    const covered = _notes.covered, doubled = _notes.doubled;
    const coveredNote = (covered.length
      ? noteBox(esc(covered.join(', ')) + (covered.length === 1 ? ' is already logged for ' : ' are already logged for ')
        + esc(this._monthLabel(mk)) + ', so Bar Cop did not add ' + (covered.length === 1 ? 'it' : 'them')
        + ' again from your recurring bills.')
      : '')
      // The action note comes SECOND and reads as an action, because it is one.
      /* ⚠ IT ASKS, IT DOES NOT INSTRUCT. This used to end "Delete whichever is not real" — an
         instruction to destroy a real expense, printed on the strength of a match Bar Cop cannot be
         certain about. It also names BOTH rows now, because naming only the recurring one sent the
         operator looking for a row under the wrong description. */
      + (doubled.length
      ? noteBox(esc(this._monthLabel(mk)) + ' has ' + (doubled.length === 1 ? 'a bill that looks' : 'bills that look')
        + ' logged twice: '
        + esc(doubled.map(d => (d.label || d.name) + (d.other && d.other !== d.name ? ' (also logged as "' + d.other + '")' : '')).join(', '))
        + '. One came from your recurring bill and one you entered. Check which is real before it counts twice.')
      : '');

    return statsCard + warnBanner + coveredNote + this._addCardHtml()
      + this._monthCardHtml(mk, { next: false, exportId: 'oex-export-this', wrapId: 'oex-thismonth' })
      + this._monthCardHtml(this._nextMonthKey(mk), { next: true });
  },

  /* ⭐ THE ADD CARD IS ITS OWN MEMBER, because it now has TWO homes: this screen and the Money Out
     step on Close The Books. ONE implementation, so the two doors cannot drift apart — the entire
     point of putting the drop on the cockpit is that there is one place to enter money out, and two
     copies of the entry card is precisely the shape this rebuild exists to end.
     ⚠ A dead `catOpts` was declared here and read nowhere ([[the-loop]] #25 — a value computed and
     never consumed). The manual form builds its picker through App.customSelect. Dropped rather
     than carried into the new member.

     ⛔⛔ `opts.inline` DROPS THE CARD SHELL AND THE COLLAPSE, AND THAT IS NOT COSMETIC. The full
     screen wraps this in a `.card` with a collapsible "Add Expense" header, and the collapse state
     is remembered in localStorage under `barcop_collapse_oex-add`, per device, forever. Mounted
     inside a cockpit step that state travels with it: an operator who had ever collapsed Add
     Expense on the Operating Expenses screen would open the Money Out step and find **an empty
     box** — `applyCollapsed` hides the `.collapse-body` AND the `data-collapse-group="oex-add"`
     button row, so the drop zone, the form and the Add Expense button all go at once, silently, on
     the one screen whose entire job is being the place you enter money out. A step is already an
     accordion; a second chevron inside it does the same job twice and can only disagree.
     ⚠ Flat is also the house pattern for a cockpit step — `sc-dashboard.workspace` renders its five
     drops with no card and no collapse. */
  _addCardHtml(opts) {
    const inline = !!(opts && opts.inline);
    /* ⭐⭐ THREE SHAPES, ONE BUILDER.
       - full screen (`{}`)                   card shell + collapse, mode swaps the card in place
       - Close The Books STEP (`stepBody`)     manual form only; Import File opens the takeover
       - Close The Books TAKEOVER (`inline`)   drop + mapper + review, in place of the four steps
       ⛔ THE STEP NEVER RENDERS A DROP ZONE. Kyle walked the inline version and it does not work for
       a bank month: the confirm panel runs to hundreds of rows across up to a dozen sections, and
       nesting that inside an accordion inside a page buries the Add button under all of it. The
       sales confirm on `sc-dashboard` DOES live in a step and is fine, because that file is a week
       of days: seven rows, no sections. The difference is size, not principle.
       ⚠ `_entryMode` is shared with the full screen and it persists. Forcing manual here is what
       stops an operator who left that screen in import mode from arriving at Close The Books to
       find a drop zone in step 1 they never asked for. */
    const stepBody = !!(opts && opts.stepBody);
    const importMode = !stepBody && this._entryMode === 'import';
    const segBtn = (mode, label) => '<button type="button" class="btn btn-sm oexa-mode" data-mode="' + mode + '" style="'
      + (this._entryMode === mode ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;' : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    const segToggle = '<div class="seg-toggle">' + segBtn('manual', 'Enter Manually') + segBtn('import', 'Import File') + '</div>';

    let bodyInner, addButtons = '';
    if (importMode) {
      /* ⚠ NO SEG TOGGLE IN THE TAKEOVER, AND NO HEADING. The toggle lives on the page you came
         from; here the way back is Cancel, exactly as `ic-product-setup.importPanelHTML` does it.
         CSVMapper already prints its own "Drop your expenses file here" and its own column-mapping
         heading, so anything we add over the top says the same thing twice. */
      bodyInner = (inline ? '' : segToggle) + '<div id="oexa-csv"></div>';
      addButtons = (inline
          ? '<div class="no-print" style="margin:16px 0 24px;"><button type="button" class="btn btn-ghost" id="oexa-imp-cancel">Cancel</button></div>'
          : '')
        + '<div id="oexa-imp-actions" style="margin:0 0 ' + (inline ? '0' : '24px') + ';"></div>';
    } else {
      bodyInner = segToggle
        + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
        +   '<div class="f" style="width:150px;"><label>Date Submitted</label><input type="date" value="' + App.todayLocal() + '" disabled title="When you logged this. Always today."/></div>'
        +   '<div class="f" style="width:150px;"><label>Due Date</label><input type="date" id="oexa-date" value="' + App.todayLocal() + '"/></div>'
        /* ⭐⭐ ITEM 19 STAGE 2 — LOG TYPE DECIDES WHICH STORE THIS ROW GOES TO, AND THE OPERATOR SAYS
           SO INSTEAD OF BAR COP GUESSING. Until now "is this a cash outflow?" was worked out by
           READING THE CATEGORY NAME, which is the collision that produced the worst defect on this
           screen: nothing stopped someone typing a category called "Owner Draw", and a row filed
           under it was excluded from every total AND from the log, so it had no Edit and no Delete
           anywhere ([[the-loop]] #115). This control IS the `type` field on the record.
           ⛔ AND IT KEEPS THE TWO VOCABULARIES APART, which is what lets the cash kinds be offered
           at all. They must never enter `listOptions` — `_matchCat` reads it (an imported cash row
           would carry no `migrated_from` and count as a BILL) and `categoryList()` reads it to build
           the Income Statement's LINES. The cash branch is its own UNKEYED control holding only the
           five, so nothing of it can reach the shared list.
           ⚠ SHOW/HIDE, NOT A RE-RENDER. Nothing typed can be lost if nothing is rebuilt, which is
           simpler and safer than capturing and restoring a draft on every change of type. */
        +   '<div class="f" style="width:190px;"><label>Log Type</label><select id="oexa-logtype" class="form-input">'
        +     '<option value="">Select Type...</option>'
        +     '<option value="expense">Operating Expense</option>'
        +     '<option value="cash">Cash Outflow</option>'
        +   '</select></div>'
        +   '<div class="f" id="oexa-cat-wrap" style="width:230px;display:none;"><label>Category' + App.manageListLink('expense_category') + '</label>' + App.customSelect({ id: 'oexa-cat', key: 'expense_category', builtin: this.CATEGORIES, blank: true, blankLabel: 'Select category...' }) + '</div>'
        +   '<div class="f" id="oexa-kind-wrap" style="width:230px;display:none;"><label>Kind</label>' + App.customSelect({ id: 'oexa-kind', builtin: this.CASH_ONLY_CATEGORIES.map(c => c.name), blank: true, blankLabel: 'Select kind...' }) + '</div>'
        // ⚠ VENDOR IS AN EXPENSE FIELD. A draw has no vendor, and leaving the box on the cash branch
        // would collect something the outflow record has nowhere to put — silent loss on save.
        +   '<div class="f" id="oexa-vendor-wrap" style="width:240px;display:none;"><label>Vendor</label><input type="text" id="oexa-vendor" placeholder="Who did you pay"/></div>'
        +   '<div class="f" style="width:140px;"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="oexa-amount" step="0.01" min="0" placeholder="0.00"/></div></div>'
        + '</div>'
        + '<div style="margin-top:14px;"><label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--t1);cursor:pointer;"><input type="checkbox" class="bc-check" id="oexa-recurring"/> Recurring bill (same cost each time)</label></div>'
        + '<div id="oexa-term-wrap" style="margin-top:12px;display:none;">'
        +   '<div style="font-size:11px;color:var(--gold);margin-bottom:12px;max-width:540px;line-height:1.5;">Set the <b>Due Date</b> above to when this bill is next actually due. The schedule repeats from that date, not from today.</div>'
        +   '<div class="f" style="max-width:540px;"><label>How often</label><select id="oexa-frequency" style="width:200px;"><option value="monthly">Monthly</option><option value="quarterly">Quarterly (every 3 months)</option><option value="annual">Annually (once a year)</option></select></div>'
        +   '<div class="f" style="max-width:540px;margin-top:12px;"><label>Ends after (months)</label><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><input type="number" id="oexa-term" min="1" step="1" placeholder="Ongoing" style="width:170px;flex:0 0 170px;"/><div style="font-size:11px;color:var(--t3);line-height:1.5;flex:1 1 200px;min-width:180px;">Leave blank and it recurs until you stop it. Set this only for a bill that ends after a fixed number of months.</div></div></div>'
        + '</div>'
        + App.noteField({ id: 'oexa-notes', placeholder: 'Optional context for the bookkeeper' })
        // Fires as they type the vendor. See _manualElsewhereNotice.
        + '<div id="oexa-elsewhere"></div>'
        + '<div id="oexa-err" style="display:none;font-size:11px;color:var(--red);margin-top:10px;"></div>';
      // ⛔ NO data-collapse-group WHEN INLINE — that attribute is what applyCollapsed uses to hide
      // this row, and inline there is no header to un-hide it with. See the note on _addCardHtml.
      addButtons = '<div ' + (inline ? '' : 'data-collapse-group="oex-add" ')
        + 'style="margin:16px 0 ' + (inline ? '0' : '24px') + ';display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
        + '<button class="btn btn-primary" id="oexa-save">Add Expense</button>'
        + '<button class="btn btn-ghost" id="oexa-clear">Start Over</button>'
        + '</div>';
    }
    /* ⛔ THE CONFIRM SCREEN REPLACES THE WHOLE CARD, IT DOES NOT SIT INSIDE IT. The Add Expense card
       is collapsible, and a collapsed card would hide the confirm screen and its Add button
       completely — the operator would have dropped a file and landed on a page with nothing on it. */
    const addCard = this._expenseReview
      ? '<div style="margin:' + (inline ? '0 0 4px' : '16px 0 24px') + ';">'
        + this._recurringProposalsHtml() + this.expenseReviewHTML() + '</div>'
      // In the STEP the step IS the card and the step head IS the collapse control, so neither is
      // drawn a second time. In the TAKEOVER the drop sits in its own card, matching
      // `ic-product-setup.importPanelHTML`, because it is page content again rather than a step body.
      // Same ids and same wiring in all three; only the shell differs.
      : inline
        ? (importMode ? '<div class="card form-card">' + bodyInner + '</div>' + addButtons
                      : bodyInner + addButtons)
        : '<div class="card form-card">'
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
    return importBanner + addCard;
  },

  _wireCurrent() {
    document.getElementById('oexa-save')?.addEventListener('click', () => this._saveAdd());
    /* `input`, not `change`: `change` on a text field waits for blur, so an operator who types the
       vendor and goes straight to the amount would not be told until they had left the field. */
    document.getElementById('oexa-vendor')?.addEventListener('input', () => this._manualElsewhereNotice());
    document.getElementById('oexa-clear')?.addEventListener('click', () => this._clearAdd());
    document.getElementById('oexa-recurring')?.addEventListener('change', (e) => {
      const w = document.getElementById('oexa-term-wrap');
      if (w) w.style.display = e.target.checked ? '' : 'none';
    });
    // ⭐ ITEM 19 STAGE 2: Log Type reveals the selector that matches it. One place decides, so the
    // two branches cannot both be on screen (which would leave the save reading a stale one).
    document.getElementById('oexa-logtype')?.addEventListener('change', () => this._applyLogType());
    // Switching entry mode abandons a confirm screen, the same as Start Over does.
    this.container.querySelectorAll('.oexa-mode').forEach(b => b.addEventListener('click', () => {
      this._expenseReview = null;
      this._entryMode = b.dataset.mode;
      /* ⭐ FROM THE STEP, "Import File" IS NOT A MODE SWITCH, IT IS A DOOR. It takes the page over
         (drop -> mapper -> confirm in place of the four steps) and "Enter Manually" closes it
         again. On the full Operating Expenses screen neither happens: the card swaps in place,
         exactly as it always has. */
      if (this._view === 'moneyout') { this._moTakeover = (b.dataset.mode === 'import'); return this._rerenderHost(); }
      this._rerender();
    }));
    // The takeover's own way back, the same control ic-product-setup's import panel carries.
    this.container.querySelector('#oexa-imp-cancel')?.addEventListener('click', () => {
      this._expenseReview = null; this._entryMode = 'manual'; this._moTakeover = false; this._rerenderHost();
    });
    /* ⚠ WIRED ON THE FRESH CHILD NODES, NEVER ON `this.container`. `renderMain` replaces the
       container's innerHTML but the container element itself is permanent, so a listener attached to
       it would stack one copy per render and the Add button would fire N times on the Nth repaint.
       Every node below is created by the render that is wiring it. */
    if (this._expenseReview) {
      this.container.querySelectorAll('[data-confirm-section]').forEach(h => h.addEventListener('click', () => {
        if (!this._expenseReview) return;
        const k = h.dataset.confirmSection;
        // "Needs a look" defaults OPEN and "going in" defaults closed, so the needs toggle is the
        // inverted one. The shell reads `open.needs !== false` and `!!open.settled`.
        this._expenseReview.open[k] = (k === 'needs') ? (this._expenseReview.open[k] === false) : !this._expenseReview.open[k];
        this._rerender();
      }));
      /* ⛔ REMOVAL IS PER ROW, BY NAME. Add Products once had a BULK "not a product" button and it
         took Kyle's entire import, because it reached past what was on screen. */
      this.container.querySelectorAll('[data-confirm-remove]').forEach(b => b.addEventListener('click', () => {
        if (!this._expenseReview) return;
        this._expenseReview.removed[b.dataset.confirmRemove] = true;
        this._rerender();
      }));
      /* The category picker. Keyed by vendor, so one change moves every row for that vendor and the
         re-render shows it happening. `change`, not `input`: a native select fires change on commit. */
      /* ⛔ A TICK MUST NOT REPAINT THE PANEL. At 2000 rows a full re-render costs ~460ms per tick,
         which is the one performance note left open on the reference door. The state is recorded and
         only the Move To button's own label is refreshed in place. */
      this.container.querySelectorAll('[data-confirm-check]').forEach(cb => cb.addEventListener('change', () => {
        if (!this._expenseReview) return;
        const k = cb.dataset.confirmCheck;
        if (cb.checked) this._expenseReview.checked[k] = true; else delete this._expenseReview.checked[k];
        const btn = this.container.querySelector('#oex-rt-move');
        const n = this._expenseCheckedIds().length;
        if (btn) { btn.disabled = !n; btn.textContent = 'Move To' + (n ? ' (' + n + ')' : ''); }
      }));
      /* The chosen category lives on the review, not in the DOM, so a re-render cannot lose it —
         and the operator can tick, move, tick again without re-choosing. */
      this.container.querySelector('#oex-rt-cat')?.addEventListener('change', (e) => {
        if (this._expenseReview) this._expenseReview.moveCat = e.target.value;
      });
      /* ⛔ A TICK RECORDS STATE AND REPAINTS NOTHING. The same rule as the row checkboxes above: a
         full re-render on every tick costs ~460ms at 2000 rows, and the proposals card sits on the
         same screen. State lives on the review, so a later repaint renders the ticks as they were. */
      this.container.querySelectorAll('.oex-rec-tick').forEach(cb => cb.addEventListener('change', () => {
        const r = this._expenseReview;
        if (!r || !r.recurring) return;
        const k = cb.dataset.veno;
        if (cb.checked) delete r.recurring.off[k]; else r.recurring.off[k] = true;
      }));
      this.container.querySelector('#oex-rt-move')?.addEventListener('click', () => this._moveCheckedExpenses());
      this.container.querySelector('[data-oexreview-go]')?.addEventListener('click', () => this._runExpenseReview());
      this.container.querySelector('[data-oexreview-back]')?.addEventListener('click', () => {
        this._expenseReview = null; this._rerender();
      });
    }
    App.wireCustomSelects(this.container);
    this.container.querySelector('.card-collapse-head')?.addEventListener('click', (e) => App.toggleCollapse(e.currentTarget));
    App.applyCollapsed(this.container);
    document.getElementById('oex-export-this')?.addEventListener('click', () => {
      const el = document.getElementById('oex-thismonth');
      /* ⚠ THE MONTH GOES IN THE PERIOD SLOT, IN WORDS (B7). Putting it in `fileTag` left the
         PERIOD slot empty, which pdfFileName fills with today — so this saved as
         "Operating Expenses 2026-07 - 2026-07-31.pdf": two dates, one of them a machine key,
         against a convention of `<Bar> - <What> - <Period>.pdf`. The History export below
         already passes `range` for exactly this reason. */
      if (el) App.exportPDF({ title: 'Operating Expenses', root: el,
        range: this._monthLabel(this._currentMonthKey()) });
    });
    this._wireRows(this.container);
    // ⚠ NOT WHILE THE CONFIRM SCREEN IS UP: the drop zone is not on the page, so CSVMapper would be
    // mounting into an element that no longer exists.
    if (this._entryMode === 'import' && !this._expenseReview) this._mountImporter();
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
        /* ⚠ THIS FIELD IS REQUIRED, SO AN UNMATCHED HEADER REFUSES THE WHOLE IMPORT — and two real
           exports were being refused: Mercury heads its column "Date (UTC)" and Expensify heads its
           "Timestamp" (S228e). Both are named EXPLICITLY here rather than by widening the shared
           normExact vocabulary, whose own comment records what that cost last time: it once stripped
           any parenthetical with no lowercase letters, which collapsed "Total (%)" onto "Total ($)"
           and put a PERCENT into a required money field. A door-local candidate has no blast radius;
           a change to normExact reaches all 23 doors. */
        { key: 'date',     label: 'Date',     required: true,  match: ['date', 'bill date', 'invoice date', 'invoicedate', 'transaction date', 'business date', 'posting date', 'post date', 'posted date', 'date posted', 'statement date', 'settlement date', 'expense date', 'purchase date', 'charge date', 'payment date', 'batch date', 'due date', 'date paid', 'trans date', 'entry date', 'date (utc)', 'timestamp', 'order date', 'delivery date', 'service date', 'paid', 'posted', 'day'] },
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
        /* ⚠ ALSO REQUIRED, ALSO REFUSING REAL FILES (S228e): PNC splits its register into
           "Withdrawals" and "Deposits" with no single amount column, and Sysco, GFS and PFG all head
           the line total "Extended Price". Named explicitly for the same reason as the date field
           above — 'price' as a bare word is NOT added, because it would reach a unit price on a
           distributor guide and book one bottle as the whole invoice. */
        { key: 'amount',   label: 'Amount',   required: true,  match: ['amount', 'total', 'cost', 'debit', 'amt', 'value', 'expense', 'payment', 'charge amount', 'charge total', 'invoice total', 'invoice amount', 'amount due', 'charges', 'charge', 'dollars', 'total amount', 'amount paid', 'extended price', 'withdrawals', 'withdrawal'] },
        { key: 'notes',    label: 'Notes',    required: false, match: ['notes', 'memo', 'note', 'comment', 'details', 'remark'] }
      ],
      /* ⚠ THE MAPPER NO LONGER COMMITS, so its button no longer says it will. It hands the file to
         the confirm screen, which is where the operator presses Add. Same word as the reference
         door and three of the four already converted. */
      confirmLabel: 'Import',
      onComplete: rows => this._openExpenseReview(rows)
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

  /* ── The confirm screen ──────────────────────────────────────────────────────
     Door 6 of the rollout, and the only CONVERSION in it: this door already stopped before writing,
     at `App.promptImportReview` — a "Pick what to import" popup with every candidate ticked. That
     popup answered a question no other door has (a bank debit is not automatically an OPERATING
     expense: COGS, payroll and card-processor settlements are tracked elsewhere in Bar Cop, so
     importing them here counts them twice), and it is the only reason a per-row control exists here
     at all. What it could NOT do is show the rows the door threw away — an unreadable amount, a $0
     line, a date it could not read, the file's own subtotal, a row already logged. Those reached the
     operator in a sentence printed AFTER the write, which is the shape this rollout exists to end.
     ⛔ `App.promptImportReview` now has no callers. Left in app.js deliberately, out of scope here. */

  /* ⭐⭐ THE THREE FILE-LEVEL VERDICTS, TAKEN ONCE, FROM THE WHOLE FILE.
     This is the first door in the rollout whose reading of a row depends on the OTHER rows: which
     day-and-month order the date column uses, which SIGN means money out, and whether the file
     states Debit/Credit outright (which beats both). A confirm screen re-walks on every render, and
     it re-walks the rows the operator has NOT removed — so deriving these inside the walk asks a
     question about the FILE over whatever subset survives Remove.
     MEASURED on a Chase register: removing four bills leaves 1 debit and 2 deposits, which no longer
     votes negative-is-charge, so the fifth bill flips from "Adding this expense" to skipped while
     the operator is looking at it, and the two deposits become expenses. Same shape as
     [[the-loop]] #47/#52 — a question asked over the caller's window instead of its own.
     So the verdict is taken at the DROP, held on the review, and handed to every later walk AND to
     the write, which is what makes the screen and the store agree. */
  // One spelling of a vendor name, so "Ben E. Keith" and "BEN E KEITH" are one vendor.
  _vendorKey(n) { return String(n == null ? '' : n).trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); },

  /* ⭐⭐ THE CATEGORY THIS VENDOR WAS LAST LOGGED UNDER (Kyle, 2026-08-04): *"all defaulted to
     other... a user would have to go in and manually edit all of those?"* Yes, and that was the
     wrong answer. `_matchCat` only ever read the file's own category column, and a bank register has
     no category column: Kyle's Chase file had `Type`, holding ACH_DEBIT and DEBIT_CARD.
     THIS HALF DOES NO GUESSING AT ALL. It reads the operator's own log, so the answer is a decision
     they already made, and a bank register is dropped every month with the same vendors: the second
     drop onward, AUSTIN ENERGY already reads Utilities. The first drop is what the picker is for.
     ⚠ NEWEST BY DATE, NEVER BY ARRAY POSITION ([[event-store-gotchas]]). And 'Other' is not an
     answer, it is the absence of one, so it never teaches. */
  _categoryForVendor(name) {
    const k = this._vendorKey(name);
    if (!k) return '';
    /* ⭐⭐ 'Other' TEACHES NOW, AND ITEM 15 IS WHAT CHANGED THAT (2026-08-05). This used to exclude it,
       with the reason *"'Other' is not an answer, it is the absence of one, so it never teaches"* —
       correct at the time, because 'Other' was the IMPORTER'S OWN FALLBACK. A row saying Other meant
       "Bar Cop could not tell", and learning from it would have cemented Bar Cop's guess as the
       operator's decision. Item 15 made the fallback EMPTY, so a stored 'Other' can now only have
       come from the operator picking it. It is an answer.
       ⛔ MEASURED COST OF LEAVING IT: on a second drop of a real bank month, 5 of 8 vendors
       auto-placed and the 3 that did not were the distributor, filed under Other — the highest
       frequency vendor a bar has. It came back unsorted every month, forever, on rows that carry an
       IRS line number, so the one month somebody skips it a real deduction drops off the tax sheet.
       ⚠ THE EMPTY TEST STAYS, and it is doing the original job now: a row with NO category really is
       the absence of an answer, and it must never teach. */
    const hits = this.expenseRows().filter(r => r && this._vendorKey(r.vendor) === k
      && String(r.category || '').trim());
    if (!hits.length) return '';
    hits.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    return String(hits[hits.length - 1].category).trim();
  },

  /* ⭐⭐⭐ PHASE 3 ITEM 16a — THE FORWARD NUMBERS READ THE LEDGER, NOT A CHECKBOX.
     Kyle: *"they drop in their expenses and a recurring expense is either there or it isn't."* That
     is rule 3 of the rebuild — you never type a number Bar Cop can compute — and rent hitting the
     1st for $4,200 three months running IS in the dropped data.

     ⛔⛔ THE LIVE DEFECT IT CLOSES, MEASURED on a drop-only operator with three clean months on file
     and $5,652.55/month of real fixed costs: break-even found 0 recurring bills, a $0.00 weekly nut
     and a NULL break-even, and the forecast projected NO bills at all. The importer's record is
     `{id,date,category,vendor,amount,notes,created_at}` — it has never carried `recurring`, so every
     forward-looking number was fed only by a checkbox the primary flow never touches. It failed
     OPTIMISTIC, which is the direction nobody reports.

     ⛔ WHAT IT WILL NOT DO ([[the-loop]] #30 — a heuristic that infers a fact the file does not
     contain is wrong in BOTH directions, and its blast radius is everyone who is merely different).
     One occurrence is not a pattern. An irregular gap is not a pattern. The five cadences Bar Cop
     projects are weekly, fortnightly, monthly, quarterly and annual — anything else (a 3-day
     delivery run, a bill on the 15th and the last day, a posting that drifts a day) is REFUSED
     rather than rounded to the nearest one it knows. Where the data cannot answer, this returns
     nothing and the operator answers instead. Every proposal carries its occurrence count so the
     screen can show what it is standing on, and the operator confirms before anything uses it.

     ⚠ NO FITTED THRESHOLD ANYWHERE ([[the-loop]] #28: state the discriminator in words first).
     "Identical to the cent every time" is a fact about the data, not a magic number — that is the
     whole fixed-vs-varies test. A varying bill reports the AVERAGE of what was actually observed and
     says `varies: true`, so the forecast can be honest about the precision it has. */
  /* ⚠ `rows` IS OPTIONAL AND THE CALLER SHOULD PASS IT. Left to default, this reads the screen's own
     `expenseRows()` — which means a CONSUMER asking this question gets the answer through a screen
     object's view of the data rather than through its own reader. That is a second path to the same
     array, and it is exactly what broke three assertions on the first cutover attempt: the cash
     engine has `bills()`, its own filtered reader, and asking the screen instead made the answer
     depend on which `App` the screen happened to close over. Pass the rows you already have. */
  deriveRecurringBills(rows) {
    /* ⛔⛔ TWO DETECTORS, AND THEY CANNOT BE ONE. Found by running Kyle's real bank register rather
       than any fixture ([[the-loop]] #32): the first version keyed on MONTH indices alone, which is
       right for rent, insurance and subscriptions and structurally blind to everything shorter.
       Measured on that file, after the shipped rules route payroll to Labor and draws and transfers
       to Cash Outflows: 7 vendors on an exact 7-day cadence ($21,531.70) and 4 on an exact 14-day
       one ($18,537.30) — 11 vendors, $40,069.00, **24.6% of everything that lands as an operating
       expense**. Ads, linen, ice, disposal, pest control and first aid are as fixed as rent, and
       every one of them has a month-gap of ZERO, so `MONTH_FREQ[0]` refused all of them forever.
       A quarter of the recurring spend missing makes the forecast read LOW, which is the direction
       nobody reports.
       ⭐ WHY NOT ONE RULE: a monthly bill's DAY gaps are 28/30/31, unequal by nature — that is the
       whole reason month indices exist. A weekly bill's MONTH gaps are 0. Each rule is blind to the
       other's shape, so both run and the short cadence is asked first. */
    const MONTH_FREQ = { 1: 'monthly', 3: 'quarterly', 12: 'annual' };
    const DAY_FREQ = { 7: 'weekly', 14: 'fortnightly' };
    /* Cash-only rows are excluded: draws, loans and tax remittances are projected by the Cash
       Outflows side already, and deriving them here would double them in the forecast. */
    const groups = {};
    (Array.isArray(rows) ? rows : this.expenseRows()).forEach(r => {
      if (!r || this.isCashOnlyCategory(r && r.category)) return;
      const k = this._vendorKey(r.vendor);
      if (!k) return;
      const d = String(r.date || '');
      // An unreadable date is skipped, never repaired into a guess — a wrong month invents a gap.
      if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return;
      (groups[k] = groups[k] || []).push(r);
    });
    const out = [];
    Object.keys(groups).forEach(k => {
      const g = groups[k].slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
      if (g.length < 2) return;                       // one occurrence is not a pattern
      const diffs = (a) => { const o = []; for (let i = 1; i < a.length; i++) o.push(a[i] - a[i - 1]); return o; };
      const same = (a) => a.length > 0 && a.every(x => x === a[0]);
      /* ⚠ REAL DAY NUMBERS, NOT DAY-OF-MONTH. A weekly bill on the 25th recurs on the 1st, and
         day-of-month arithmetic goes NEGATIVE across that boundary. `Date.UTC` on the already-parsed
         components is pure arithmetic — it never hands a string to the Date parser, so there is no
         timezone or format behaviour to get wrong ([[local-date-convention]]). */
      const dayNo = g.map(r => Date.UTC(parseInt(String(r.date).slice(0, 4), 10),
        parseInt(String(r.date).slice(5, 7), 10) - 1, parseInt(String(r.date).slice(8, 10), 10)) / 86400000);
      const monthIdx = g.map(r => (parseInt(String(r.date).slice(0, 4), 10) * 12)
        + parseInt(String(r.date).slice(5, 7), 10) - 1);
      const dayGaps = diffs(dayNo), monthGaps = diffs(monthIdx);

      let frequency = '', day = null, weekday = null;
      /* SHORT CADENCE ASKED FIRST. A weekly series would be refused by the month rule anyway (its
         month gaps are 0), but asking in this order makes the two rules explicitly disjoint rather
         than accidentally so.
         ⛔ EXACTLY 7 OR EXACTLY 14, no tolerance ([[the-loop]] #28 — no threshold fitted to a
         fixture). The real file posts on exact sevens. A posting that drifts a day is REFUSED, and
         refusing is the safe direction: a refusal is visible on the confirm screen and a smoothed
         guess is not. */
      if (same(dayGaps) && DAY_FREQ[dayGaps[0]]) {
        frequency = DAY_FREQ[dayGaps[0]];
        /* It repeats on a WEEKDAY, and saying `day: 4` for a Saturday linen service would put it on
           the 4th of every month in the forecast. Taken off the last occurrence, which is the one
           the projector steps forward from. */
        weekday = new Date(dayNo[dayNo.length - 1] * 86400000).getUTCDay();
      } else if (same(monthGaps) && MONTH_FREQ[monthGaps[0]]) {
        frequency = MONTH_FREQ[monthGaps[0]];
      }
      // Two rows in one month give a month gap of 0 and a day gap that is neither 7 nor 14, so an
      // irregular vendor falls out of both rules rather than being forced into one.
      if (!frequency) return;
      const amts = g.map(r => parseFloat(r.amount) || 0);
      const varies = !amts.every(a => Math.abs(a - amts[0]) < 0.005);
      const amount = varies
        ? Math.round((amts.reduce((s, a) => s + a, 0) / amts.length) * 100) / 100
        : amts[0];
      /* The day of the month it usually lands, for the MONTH-anchored cadences only. A debit pushed
         off a weekend moves a day or two, so the most common wins and the earliest breaks a tie
         rather than an arbitrary pick. A weekly bill has no meaningful day-of-month — it carries a
         weekday instead — so this stays null there rather than reporting a number that would send
         the projector to the 4th of every month. */
      if (weekday === null) {
        const tally = {};
        g.forEach(r => { const d = parseInt(String(r.date).slice(8, 10), 10) || 1; tally[d] = (tally[d] || 0) + 1; });
        day = parseInt(Object.keys(tally).sort((a, b) => (tally[b] - tally[a]) || (a - b))[0], 10);
      }
      const last = g[g.length - 1];
      out.push({
        vendorKey: k,
        vendor: last.vendor || '',
        // The operator's own decision, through the shared rule — so a confirmed proposal never
        // re-asks a category they have already answered.
        category: this._categoryForVendor(last.vendor) || '',
        frequency: frequency,
        /* EXACTLY ONE OF THESE IS SET, and which one says what the bill repeats ON: a day of the
           month for monthly/quarterly/annual, a weekday for weekly/fortnightly. A projector that
           read the wrong one would put a Saturday linen service on the 4th of every month. */
        day: day,
        weekday: weekday,
        amount: amount,
        varies: varies,
        occurrences: g.length,
        lastDate: String(last.date).slice(0, 10)
      });
    });
    return out;
  },

  /* ── The operator's answer to a proposal, per vendor ────────────────────────
     ⭐ ACCOUNT CONFIG, NOT A RECORD. This holds no money and describes no event; it is one word per
     vendor about a decision, so it belongs in `account_state` beside the cockpit's done-stamps
     rather than in a store of its own ([[storage-architecture]] — config stays in the blob).
     ⚠ KEYED ON `_vendorKey`, the same normalised key the derivation and the category learning use.
     A bank writes the same vendor three ways across three months; anything else and the answer stops
     applying the moment the spelling moves. */
  /* ⚠ THE KEY IS A LITERAL IN BOTH MEMBERS, NOT A SIBLING CONSTANT (integrity #16, and I made this
     exact slip twice in one session). Every slicer in the harness suite lifts METHODS by name, so a
     `RECURRING_DECISIONS_KEY:` data property beside these is invisible to all of them — the lifted
     object read `undefined` and wrote the whole decision map under the key "undefined". It failed
     loudly here; on a screen it would have been a setting that silently never loaded. */
  recurringDecisions() { return App.acctGet('recurring_decisions', {}) || {}; },
  /* Takes one vendor key, or a whole `{ vendorKey: keep }` map for the confirm screen — which
     answers a dozen at once and must not queue a dozen separate account writes. One save either
     way, and one place that knows the storage key. */
  setRecurringDecision(vendorKey, keep) {
    const m = Object.assign({}, this.recurringDecisions());
    if (vendorKey && typeof vendorKey === 'object') {
      Object.keys(vendorKey).forEach(k => { if (String(k).trim()) m[k] = vendorKey[k] ? 'yes' : 'no'; });
    } else {
      const k = String(vendorKey || '').trim();
      if (!k) return Promise.resolve(false);
      m[k] = keep ? 'yes' : 'no';
    }
    return App.acctSet('recurring_decisions', m);
  },

  /* ⭐⭐⭐ WHAT BREAK-EVEN AND THE FORECAST ARE ALLOWED TO COUNT. `deriveRecurringBills` PROPOSES;
     this decides. Two things stand between a proposal and a fixed cost:

     1. THE OPERATOR'S ANSWER, and the default is COUNT. Leaving proposals off until somebody opts
        in recreates the exact defect this item exists to close — a drop-only operator ignores the
        section and break-even reads $0.00 again. These are facts out of their own ledger, not
        guesses, and Add Products set the precedent: every row ticked, unticking is how you say no.

     2. ⛔⛔ STALENESS, WHICH IS NOT OPTIONAL. `operating_expense` is in `NONWINDOWED_KINDS`, so the
        ledger holds every row ever written — a gym membership cancelled in March goes on deriving
        from those three old rows forever, and break-even quietly carries a cost the operator does
        not pay. THE RULE, IN WORDS FIRST ([[the-loop]] #28): a bill that has missed MORE THAN ONE
        FULL CYCLE is not current. One missed cycle is a late payment; two is a bill that stopped.
        The window is the cadence's own length twice over, so no number is fitted to anything.

     ⚠ THE CLOCK IS READ THROUGH `App.todayLocal()`, never `new Date()` ([[local-date-convention]]),
     which is also what lets a harness pin the clock instead of anchoring to a literal day. */
  /* ⭐⭐ HOW MANY TIMES A YEAR EACH CADENCE HAPPENS, DEFINED ONCE. There were already two copies of
     `quarterly ? 4 : annual ? 1 : 12` in `hub-breakeven` alone (the nut and the by-category table)
     and a third in `cash-engine.weeklyFixedCosts` — and the moment `weekly` and `fortnightly` became
     possible, every one of them silently counted a weekly bill as monthly: **4.3x low** on the
     number break-even exists to give ([[the-loop]] #24 — after a vocabulary gains cases, every
     counter derived from it is pointing at the wrong set).
     ⚠ The default is 12, so an unknown or missing cadence behaves exactly as it did before rather
     than collapsing to zero and quietly removing a bill from the nut. */
  recurringPerYear(frequency) {
    return { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, annual: 1 }[frequency] || 12;
  },

  /* ⛔⛔⛔ THE GENERATOR IS GONE (Phase 3 item 16, 2026-08-05). `catchUpRecurring` /
     `_catchUpOnce` ran at every boot and every render and MINTED A REAL EXPENSE ROW per elapsed
     month, the current one included, in full, on day 1. Those rows were indistinguishable from a
     bill the operator had actually paid — Books counted them, Schedule C deducted them.
     ⭐ KYLE'S FRAMING IS WHAT KILLED IT: *"they drop in their expenses and a recurring expense is
     either there or it isn't."* The drop is the record. A schedule is a forecast input, and
     `recurringBills()` is where it lives now — break-even and the cash forecast read it, and the
     Income Statement STATES what is expected and not yet logged rather than booking it.
     ⭐ MEASURED AT THE CUT, seeded shape at 5 August: it was carrying **$16,378.00** of expenses
     nobody had paid. Every cent is still named on the statement, just not deducted.
     ⚠ IT WAS THE SINGLE LARGEST SOURCE OF DEFECTS IN THIS FILE. Deleted with it: a deleted month
     re-minting on the next render, a re-dated row freeing its slot and double-booking, Stop not
     stopping, a resumed quarterly bill re-billing monthly from the series start, a refused save
     being persisted by the catch-up, and migrated cash outflows becoming bill parents forever.
     ⚠ `_ownCover` went with it — it existed only to decide whether to MINT. `projectedBills`
     keeps its own own-cover, which suppresses a PROJECTION rather than a write.
     ⛔ Children already written stay on the account: they are history, and deleting them would
     restate closed months. That is a separate, destructive call. */
  recurringBills(rows) {
    const CYCLE_DAYS = { weekly: 7, fortnightly: 14, monthly: 31, quarterly: 92, annual: 366 };
    const decisions = this.recurringDecisions();
    const today = (App.todayLocal ? App.todayLocal() : '') || '';
    const dayNo = (ymd) => Date.UTC(parseInt(String(ymd).slice(0, 4), 10),
      parseInt(String(ymd).slice(5, 7), 10) - 1, parseInt(String(ymd).slice(8, 10), 10)) / 86400000;
    const now = dayNo(today);
    const derived = this.deriveRecurringBills(rows).filter(b => {
      if (decisions[b.vendorKey] === 'no') return false;
      if (isNaN(now)) return true;    // no clock to compare against: never drop on a bad reading
      const span = CYCLE_DAYS[b.frequency] || 31;
      return (now - dayNo(b.lastDate)) <= span * 2;
    });

    /* ⭐⭐⭐ AND THE BILLS THE OPERATOR TYPED, WHICH THE DERIVATION CANNOT ALWAYS SEE.
       ⛔ WHY THIS IS NOT REDUNDANT, and the measurement that settles it: the derivation groups a
       typed parent together with its OWN generated children — same vendor key — so on an account
       that has been running a while it already returns one bill per vendor and the typed record adds
       nothing. THE GAP IS THE OPPOSITE ONE. Two occurrences is the derivation's minimum, so a bill
       entered TODAY, or one whose series was stopped and restarted, or any cadence outside the five,
       has a single row and derives to NOTHING. Cutting over to derived-only would silently drop a
       real fixed cost out of break-even, the reserve target and Safe to Spend — the quiet direction
       nobody reports.
       ⛔⛔ THE DEDUPE IS THE WHOLE CONTRACT. Where BOTH can see a bill, the typed record wins and the
       derived one is dropped: measured on the seeded account, a naive union reads $32,756.00 against
       a truth of $16,378.00 — every bill twice. Keyed on `_vendorKey`, the same normalised key the
       derivation and the category learning already share.
       ⭐ TYPED WINS RATHER THAN DERIVED because the typed record carries the operator's own term,
       `stopped_ym` and `skip_months`, and the consumers apply those rules to it. A derived stand-in
       has none of that history, so preferring it would quietly resurrect a stopped series.
       ⚠ `derived: false` is stamped explicitly, never left undefined — a consumer testing `!b.derived`
       would read a missing field as "typed" and the two cases would be indistinguishable. */
    const typed = (Array.isArray(rows) ? rows : this.expenseRows()).filter(r =>
      r && r.recurring && !r.recurring_parent && r.date && !this.isCashOnlyCategory(r.category));
    /* ⛔⛔ TYPED BILLS ARE NEVER DEDUPED AGAINST EACH OTHER — ONLY AGAINST DERIVED ONES. Two bills
       from one vendor are two bills: an equipment loan and a second equipment loan, a stopped series
       and its replacement, three lines of fixed overhead a bar entered without vendors at all.
       ⛔ MEASURED, and it is [[the-loop]] #50 in a new costume ("a discriminator that can be empty is
       not a discriminator"). My first version skipped a typed bill whose key was already claimed,
       and fell back to `'id:' + r.id` for a vendorless one — which is `'id:undefined'` for EVERY bill
       that has neither. Three vendorless fixed costs collapsed into one and the weekly nut read
       $12,000/month against a truth of $16,100: break-even, the reserve target and Safe to Spend all
       low, silently, in the dangerous direction. `verify-reserve-weeks-floor` caught it.
       ⭐ So `claimed` exists for ONE purpose: telling a derived bill that a typed one already speaks
       for that vendor. It never gates a typed bill. */
    const claimed = {};
    const out = [];
    typed.forEach((r, i) => {
      const k = this._vendorKey(r.vendor);
      if (k) claimed[k] = true;
      out.push({
        // Its own identity, unique per bill — never a shared fallback. A derived bill can only be
        // suppressed by a vendor key, which a vendorless typed bill does not have and does not need.
        vendorKey: k || ('typed:' + (r.id || i)),
        vendor: r.vendor || r.category || 'Bill', category: r.category || '',
        frequency: r.frequency === 'quarterly' ? 'quarterly' : r.frequency === 'annual' ? 'annual' : 'monthly',
        day: parseInt(r.recur_day, 10) || parseInt(String(r.date).slice(8, 10), 10) || 1,
        weekday: null, amount: parseFloat(r.amount) || 0, varies: false,
        occurrences: null, lastDate: String(r.date).slice(0, 10), derived: false, row: r
      });
    });
    derived.forEach(b => {
      if (claimed[b.vendorKey]) return;
      out.push(Object.assign({}, b, { derived: true, row: null }));
    });
    return out;
  },

  /* ⛔⛔ WHAT BAR COP CAN RECOGNISE AS BELONGING SOMEWHERE ELSE (Kyle, 2026-08-04, by using the app):
     *"owner draw is going into operating expenses.... i thought that was a cash outflow?"* He is
     right. `hub-cash-outflows` has Owner draw as a first-class TYPE, so Bar Cop already knows what
     one is and where it goes, and this door booked it as an operating expense anyway. A draw is a
     distribution of PROFIT, so it understates profit by its own amount on the Income Statement, and
     it lands in This Month, Year to Date and By Category with it.

     ⭐ EVERY TERM HAS AN APP-SIDE ANCHOR, NOT A LIST I INVENTED: the `hub-cash-outflows` types
     (draw, loan, tax), Labor for payroll, the operator's OWN inventory vendor list for deliveries,
     and the two exclusions this file's own header has always named (Repairs and Maintenance, which
     live in sc_maintenance). A transfer between the operator's own accounts is not an expense at all.

     ⛔ A MATCH NEVER DECIDES ANYTHING — the row still lands, with the note and Remove beside it.
     On a confirm screen a guess is a suggestion, so a false positive costs one note and a false
     negative costs what the operator was going to do anyway. That is the whole reason a vocabulary
     is defensible here, and it inverts [[the-loop]] #30's risk: nothing is inferred into a stored
     value, only into a sentence the operator can overrule by doing nothing.

     ⚠ [[the-loop]] #26 — this class of vocabulary has eaten a real name three times, so every term
     is phrase-anchored or word-bounded and pinned against a list of real businesses. The sharp one
     is `\birs\b`: F-I-R-S-T contains the literal substring "irs", so an unbounded match would call
     every FIRST NATIONAL a tax remittance. Also deliberately absent: a bare `tax` (Taxidermy, and
     PROPERTY TAX is inside this door's OWN "Occupancy (Rent, Property Tax)" category), a bare
     `capital` (Capital Grille, Capital City Beverage), a bare `draw` (Drawbridge Brewing) and a bare
     `transfer` (Transferrin Labs). `payroll` is word-bounded so Payrolling Solutions stays quiet.
     ⚠ The table is folded INTO this function on purpose: a data property sibling is invisible to
     every slicer in the harness suite ([[the-loop]] #16). */
  /* ⭐ ONE WALK, TWO CALLERS, AND IT CARRIES A DESTINATION. The import screen only ever needed the
     sentence; the hand-typed form needs somewhere to send them, and deriving the destination from
     the sentence would mean a reworded note silently breaks the route ([[the-loop]] #25). So the
     table holds all three and `_belongsElsewhere` is the thin reader the import already uses —
     two doors flagging different things is the drift this shape exists to prevent.
     ⚠ `where` is prose and `screen` is an `App.openScreen` id. NOT every destination has one:
     platform fees are entered in the Confirm the Week popup and a transfer between the operator's
     own accounts is not tracked anywhere at all. Inventing an id for either would be a dead button
     ([[the-loop]] #106), so those carry `where` and no `screen`. */
  _elsewhereFor(vendor) {
    const t = ' ' + String(vendor == null ? '' : vendor).toLowerCase()
      .replace(/'/g, '').replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
    if (t.trim() === '') return null;
    const RULES = [
      [/\bowners? draw\b|\bmember draw\b|\bpartner draw\b|\bshareholder distribution\b|\bdistribution to owner\b/,
        'An owner draw belongs in Cash Outflows', 'Cash Outflows', 'cash-outflows'],
      [/\btransfer to\b|\btransfer from\b|\bonline transfer\b|\bacct xfer\b|\baccount transfer\b/,
        'A transfer between your own accounts', 'nowhere: the money never left the business', ''],
      [/\bloan (payment|pmt|repayment)\b|\bsba loan\b|\bprincipal payment\b|\bnote payment\b/,
        'A loan payment belongs in Cash Outflows', 'Cash Outflows', 'cash-outflows'],
      [/\bpayroll taxe?s?\b|\bestimated taxe?s?\b|\bsales tax\b|\bfranchise tax\b|\b941\b|\birs\b/,
        'A tax payment belongs in Cash Outflows', 'Cash Outflows', 'cash-outflows'],
      [/\bpayroll\b/, 'Payroll is tracked in Labor', 'Labor, under Log Hours', 'lc-log-hours'],
      /* ⛔ THE REPAIRS RULE IS GONE, AND IT HAD TO GO WITH ITS SOURCE (Phase 2 item 12). It excluded a
         repair on a bank statement by default and sent the operator to Shift Control, which was
         correct for as long as the tracker owned the money. It does not any more: the Maintenance
         log writes its cost straight into THIS ledger under Repairs and Maintenance. Leaving the
         rule would send them to a screen that no longer stores it and keep a real deduction off the
         books — a routing rule outlives its usefulness the moment the store it routes to stops
         holding a dollar. ⚠ The DELIVERY-FEE rule below stays: that figure is still typed weekly in
         Confirm the Week, so importing it as well really would double it. */
      /* ⛔ THE P&L LINE IS THE ANCHOR, NOT THE BRAND LIST. Books prints "3rd-party platform fees
         (DoorDash, UberEats, etc.)" as its OWN line, fed from the weekly roll's `platform_fees` —
         so a delivery commission booked here is counted twice on one statement, exactly like a
         repair. I left this out on the reasoning that it needed a brand list with no app-side
         anchor; the anchor was Books' own label the whole time, and the structural pin
         (`verify-expense-import-review` block N) is what surfaced it.
         ⚠ FOUR BRANDS, ALL UNAMBIGUOUS. Deliberately absent: `caviar` (a food a bar buys, and a
         supplier could be Caviar House), `slice` (Slice of Life Pizza) and `seamless` (Seamless
         Gutters) — every one of them a real business name before it is a platform. */
      [/\bdoordash\b|\bgrubhub\b|\bubereats\b|\buber eats\b|\bpostmates\b|\bdelivery commission\b/,
        'Delivery app fees have their own line', 'the weekly Confirm the Week figures', '']
    ];
    for (let i = 0; i < RULES.length; i++) {
      if (RULES[i][0].test(t)) return { note: RULES[i][1], where: RULES[i][2], screen: RULES[i][3] };
    }
    /* The operator's OWN inventory vendor list. Not a guess at all: if they buy product from this
       name, a debit to it is a delivery, and deliveries are COGS through Inventory. */
    const vend = (App.inventoryData && Array.isArray(App.inventoryData.ic_vendors))
      ? App.inventoryData.ic_vendors : [];
    const k = this._vendorKey(vendor);
    if (k && vend.some(v => v && this._vendorKey(v.name) === k)) {
      return { note: 'This vendor is on your Inventory list',
        where: 'Inventory, under Receive Delivery', screen: 'ic-receive-delivery' };
    }
    return null;
  },
  // What the import screen reads. The sentence only; the destination is for the hand-typed form.
  _belongsElsewhere(vendor) { const e = this._elsewhereFor(vendor); return e ? e.note : ''; },

  _expenseVerdicts(rows) {
    const conv = (typeof PosIngest !== 'undefined' && PosIngest.dateConvention)
      ? PosIngest.dateConvention(rows, 'date') : { dayFirst: false, contradictory: false };
    const sign = this._amountConvention(rows);
    /* ⚠ A STATED FACT BEATS EVERY INFERENCE (S225). Where a Debit/Credit column is present and
       populated, `sign` is not consulted at all. Asked over the whole file for the same reason as
       the other two: a file HAS a direction column or it does not, and removing the rows that fill
       it in must not turn a stated fact back into a guess. */
    const hasDir = (rows || []).some(r => this._directionOf(r && r.direction));
    return { conv: conv, sign: sign, hasDir: hasDir,
      dopts: { dayFirst: conv.dayFirst, dateAmbiguous: conv.contradictory } };
  },

  /* ⛔ THE ONE WALK. The screen and `_importRows` must decide "does this row land" in the same
     place, or the button and the write can disagree — the defect the reference screen was rebuilt to
     close. PURE: no DOM, no writes, no mutation of the log, safe to call on every render.
     ⚠ THE GUARD ORDER IS LOAD-BEARING and is unchanged from the version that wrote on the press:
     unreadable amount, then credit, then $0, then undated, then the file's own subtotal, then
     already-logged. Each one is a different sentence to the operator and they are not
     interchangeable — a $0 row is not a credit, and a dated TOTAL line is not a bill. */
  _buildExpenseRows(rows, v, picks) {
    v = v || this._expenseVerdicts(rows || []);
    /* ⚠⚠ DEDUP AGAINST A SNAPSHOT, WITH CONSUME-ONCE — AND BOTH ARE REBUILT PER CALL.
       The snapshot half: the old test ran against the LIVE log while the loop appended to it, so
       three $89 rows on one Saturday (two ice deliveries and a linen drop, which a card statement
       lists separately) imported as ONE — $89.00 banked against $267.00 in the file.
       The consume-once half is what keeps a genuine RE-DROP honest: each already-logged row absorbs
       exactly one incoming row.
       ⛔ AND `_used` MUST BE LOCAL TO THIS CALL. The screen re-walks on every render; a Set that
       survived between calls would mark the same logged row as spent, so the second repaint would
       show it as new and the button would climb by one per render. */
    const _pre = this.expenseRows();
    const _used = new Set();
    const _dup = (date, amount, vendor, category) => {
      const pred = x => x.date === date && Math.abs((parseFloat(x.amount) || 0) - amount) < 0.005
        && (x.vendor || '') === vendor && (x.category || '') === category;
      if (typeof PosIngest !== 'undefined' && PosIngest._isDup) return PosIngest._isDup(_pre, _used, pred);
      const hit = _pre.find(x => !_used.has(x.id) && pred(x));
      if (hit) { _used.add(hit.id); return true; }
      return false;
    };
    const list = [];
    (rows || []).forEach((r, i) => {
      const date = this._normDate(r.date, v.dopts);
      // App.parseNum, not a private parseFloat strip: a card export's refund row — "(125.00)" or
      // "125.00-" — read as +125 and BOOKED AS A $125 EXPENSE while the same file's "-125.00" rows
      // parsed to -125 and were dropped. One file, two opposite wrong answers, $250 apart.
      const _raw = App.parseNum(r.amount);
      if (_raw == null) { list.push({ raw: r, status: 'unreadable', date: date, notes: [] }); return; }
      // ONE FLIP, DECIDED ONCE FOR THE WHOLE FILE (see _expenseVerdicts). Under the negative-debit
      // convention a charge is -1240.55 and becomes +1240.55; a deposit is +8420.11 and becomes
      // -8420.11, which the credit test below then skips. Every downstream test is unchanged.
      const amount = v.hasDir
        ? (this._directionOf(r.direction) === 'credit' ? -Math.abs(_raw) : Math.abs(_raw))
        : (v.sign.negativeIsCharge ? -_raw : _raw);
      /* ⚠ `fileAmount` IS THE FIGURE THE FILE ACTUALLY WROTE, kept alongside the flipped one because
         a row that will NOT land has one job: let the operator find it in their own file. Under the
         negative-debit convention a $8,420.11 merchant deposit flips to -8420.11, and printing that
         puts "$-8,420.11" on screen against a file cell reading 8,420.11 — a number they cannot
         search for, with the sign inverted. See `_expenseReviewRow`. */
      if (amount < 0)   { list.push({ raw: r, status: 'credit', date: date, amount: amount, fileAmount: _raw, notes: [] }); return; }
      // A $0.00 line (a voided bill, a zero-dollar subscription row) is not a credit and must not be
      // reported as one — it is simply nothing to log.
      if (amount === 0) { list.push({ raw: r, status: 'zero', date: date, amount: 0, fileAmount: _raw, notes: [] }); return; }
      if (!date)        { list.push({ raw: r, status: 'undated', amount: amount, fileAmount: _raw, notes: [] }); return; }
      const vendor = (r.vendor || '').trim();
      /* ⭐ FOUR SOURCES, IN THIS ORDER, AND ONLY THE FIRST TWO ARE THE OPERATOR SPEAKING DIRECTLY:
         what they picked on this screen, what the file itself said (matched against their list),
         what this vendor was last logged under, and finally Other. */
      const named  = this.CATEGORIES.includes(r.category) ? r.category : this._matchCat(r.category);
      /* ⚠ THE OPERATOR'S ASSIGNMENT IS KEYED BY `_rid`, THE ROW THEY CHECKED. It was keyed by vendor
         while the screen had a per-row dropdown; Move To acts on the rows they ticked, so the key is
         the row. The durable per-vendor memory did not move: `_categoryForVendor` reads their own log
         on the NEXT drop, which is the half that compounds. */
      const picked = (picks && r && r._rid != null) ? (picks[r._rid] || '') : '';
      const learned = (picked || named) ? '' : this._categoryForVendor(vendor);
      /* ⛔⛔ THE FALLBACK IS EMPTY, NOT 'Other' (Phase 3 item 15). 'Other' is a category the operator
         deliberately picks, and Books prints it as "Other operating expenses" while Schedule C
         deducts it on 27a — so filing an unplaceable row there made a row Bar Cop could not read
         and a row the operator chose into the SAME RECORD. Press Add without sorting the Not Sorted
         Yet section and unclassified money became a real deduction, silently. An empty category is
         the honest answer: it says "we do not know" by the absence of a value, and
         `isUncategorizedRow` is what keeps it off the P&L until somebody sorts it. */
      const category = picked || named || learned || '';
      // Did anything actually place this row, or did it fall through to Other? That is the whole
      // question "Not Sorted Yet" asks, so the walk answers it rather than the render guessing.
      const placed = !!(picked || named || learned);
      /* ⚠ A CATEGORY THE FILE CARRIED AND BAR COP COULD NOT PLACE IS A NOTE ON A LANDING ROW.
         The row still imports — the operator wants the expense logged and will fix the category on
         the row below — but "Other" arriving silently is how a QuickBooks Desktop export once put
         EVERY row into Other with the real expense account sitting unread one column over, blanking
         the By Category card, the YTD % column and Books' category lines. An ABSENT category cell is
         not a problem and must never be flagged, or every bank register reads broken. */
      const badCat = !!(String(r.category == null ? '' : r.category).trim() && !named);
      /* ⚠⚠ A DATED "TOTAL" ROW IS NOT AN EXPENSE — it is the file's own subtotal, and importing it
         makes the month read exactly double (S223). `isSummaryName` is the shared gate; it is
         verified against real vendor names ("Total Wine & More", "Grand Rapids Linen") in
         pos-ingest's own pins, because this vocabulary has eaten a real name three times. */
      if (vendor && typeof PosIngest !== 'undefined' && PosIngest.isSummaryName
          && PosIngest.isSummaryName(vendor)) {
        list.push({ raw: r, status: 'totals', date: date, amount: amount, fileAmount: _raw, vendor: vendor, notes: [] });
        return;
      }
      const notes = (r.notes || '').trim();
      if (_dup(date, amount, vendor, category)) {
        list.push({ raw: r, status: 'dup', date: date, amount: amount, vendor: vendor,
          category: category, notes: [] });
        return;
      }
      /* ⛔ THE SECTION IS THE CATEGORY, SO THE ROW DOES NOT REPEAT IT. Every "pick one" note is gone:
         a row sitting in Not Sorted Yet IS that sentence, and one in a category section has already
         been answered. The old screen said it three ways at once (a Category column, a dropdown and
         a note) and none of them could agree. */
      const elsewhere = this._belongsElsewhere(vendor);
      /* ⛔⛔⛔ A NOTE THAT DOES NOT CHANGE THE DEFAULT IS NOT A GUARD (Kyle, 2026-08-04, correcting a
         call I argued for). The flag was a suggestion on the reasoning that a guess must never
         delete a real expense. That was right about REMOVAL and wrong about the DEFAULT: doing
         nothing BOOKED the row. *"even if the user sees the note and they don't add them to a
         category and think they are good, they still get added to expenses as 'other'."* An owner
         draw, a payroll run and a Sysco delivery landing here double-count straight into Books'
         Income Statement, and the operator's most likely action — read it, agree, move on — was the
         one that caused it.
         THE FIX KEEPS BOTH PROPERTIES AND NEEDS NO NEW CONTROL: a flagged row does not land, and if
         Bar Cop guessed wrong the operator moves it into a category, which is already how "this IS
         an operating expense" is said. `picked` is exactly that overrule, so it clears the block. */
      const excluded = !!elsewhere && !picked;
      list.push({
        raw: r, status: 'new', excluded: excluded, date: date, amount: amount, vendor: vendor,
        category: category, placed: placed, badCat: badCat, elsewhere: elsewhere, notes: [],
        rec: { id: App.uid ? App.uid() : ('oex-' + Date.now() + '-' + i), date: date, category: category,
               vendor: vendor, amount: amount, notes: notes, created_at: new Date().toISOString() }
      });
    });
    return { list: list };
  },

  _openExpenseReview(rows) {
    this._expenseReview = {
      // A STABLE ID PER ROW, so Remove has something to remove BY. The build returns one verdict per
      // input row in the file's own order, so index is a real identity here.
      rows: (rows || []).map((r, i) => Object.assign({}, r, { _rid: 'r' + i })),
      // Taken from the WHOLE file, once. See _expenseVerdicts.
      verdicts: this._expenseVerdicts(rows || []),
      // Categories the operator assigns with Move To, keyed by `_rid`. See _moveCheckedExpenses.
      assign: {},
      checked: {}, moveCat: '', moveNote: '',
      open: {}, removed: {},
      /* ⭐ TAKEN ONCE, WHEN THE REVIEW OPENS, not on every repaint. The proposals are derived from
         the ledger as it stands BEFORE this file lands, which is the honest basis for "these are
         bills you already pay" — and it also means a Move To or a section toggle cannot make the
         list shift under the operator mid-decision.
         ⚠ Already-answered vendors are dropped: an answer is asked once and remembered, so a
         confirmed linen service does not come back for re-ticking every month. */
      recurring: (() => {
        const answered = this.recurringDecisions();
        return { proposals: this.deriveRecurringBills().filter(p => !answered[p.vendorKey]), off: {} };
      })()
    };
    this._rerender();
  },

  /* ⛔⛔ ONLY WHAT IS ON SCREEN CAN BE MOVED. A collapsed section renders no rows at all, so a row
     ticked and then hidden is still in `checked` — and acting on it would be a bulk verb reaching
     past what the operator can see. Add Products once had exactly that, as a bulk "Not a product"
     button, and it took Kyle's entire import. Scoping to the visible set is what makes the control
     auditable: whatever moves, he was looking at. */
  _expenseCheckedIds() {
    const r = this._expenseReview;
    if (!r) return [];
    const visible = {};
    this._expenseGroups().forEach(g => { if (g.open) (g.rows || []).forEach(row => { visible[row.key] = true; }); });
    return Object.keys(r.checked).filter(k => r.checked[k] && visible[k]);
  },

  /* Check some rows, choose a category, press Move To. The section for that category is created if
     it does not exist and is OPENED, because Kyle's complaint about the old screen was that a row
     he touched disappeared with no sign of where it went. */
  _moveCheckedExpenses() {
    const r = this._expenseReview;
    if (!r) return;
    if (!r.moveCat) { r.moveNote = 'Pick a category first, then press Move To.'; this._rerender(); return; }
    const ids = this._expenseCheckedIds();
    if (!ids.length) { r.moveNote = 'Tick the rows you want to move first.'; this._rerender(); return; }
    ids.forEach(id => { r.assign[id] = r.moveCat; delete r.checked[id]; });
    /* ⛔ THE SECTION JUST MOVED INTO OPENS, AND EVERY OTHER CATEGORY SECTION CLOSES.
       Add Products opens the target and leaves the rest as they were, which is right when one small
       batch is being placed. Measured on a real bank month it is not: eight passes left all eight
       sections open and put all 64 rows back above the Add button, which is the exact
       below-the-fold defect collapsing was introduced to fix. Kyle asked for the other extreme
       (*"all new categories created are collapsed"*), but that reintroduces his FIRST complaint —
       *"the row disappears and as a user i can't see that the row just added"*. Opening only the
       latest target answers both: the move is always visible, and the screen never grows. */
    Object.keys(r.open).forEach(k => { if (k !== 'unsorted' && k !== '__skip' && k !== '__elsewhere') delete r.open[k]; });
    r.open[r.moveCat] = true;
    r.moveNote = ids.length + ' row' + (ids.length === 1 ? '' : 's') + ' moved into ' + r.moveCat + '.';
    /* ⚠ THE SELECTOR RESETS (Kyle, 2026-08-04). Leaving the last category selected makes the NEXT
       Move To a single click away from filing a different batch under it by accident, and it reads
       as though that category is still "current" when the rows it holds are already placed. */
    r.moveCat = '';
    this._rerender();
  },

  /* ⭐ THE SECTIONS, AND THE ORDER IS THE JOB. What Bar Cop could not place sits at the top, open,
     and is the only part the operator has to do. What it did place sits in a closed section per
     category with the count on the head, so one can be opened and checked. What is not going in at
     all sits at the bottom, closed, with every row still accounted for and costing no screen space
     (Kyle: *"if we know it is a credit/deposit... why even list it and take up all screen space?"*).
     ⛔ NOT DELETED, THOUGH. The one promise this screen makes is that every row in the file says what
     happened to it; a row an operator can see in their file and cannot find in Bar Cop is what makes
     them stop trusting the total. Collapsed answers the complaint and keeps the promise. */
  _expenseGroups() {
    const s = this._expenseReviewSummary();
    const r = this._expenseReview || { open: {} };
    const landing = s.rows.filter(x => x.lands);
    const unsorted = landing.filter(x => !x.placed);
    /* ⛔ TWO CARDS, NOT ONE, AND THE DIFFERENCE IS WHO GETS THE LAST WORD. "Not Going In" is Bar
       Cop's CERTAINTY — a deposit is money in, a subtotal is not a bill, that amount could not be
       read — and the operator cannot overrule any of it. This one is Bar Cop's JUDGEMENT about where
       a row belongs in the app, and they overrule it by moving the row into a category. Folding them
       together would tell the operator a decision they can change is one they cannot. */
    const elsewhere = s.rows.filter(x => !x.lands && x.status === 'new');
    const skipped = s.rows.filter(x => !x.lands && x.status !== 'new');
    const groups = [];
    if (unsorted.length) groups.push({ key: 'unsorted', title: 'Not Sorted Yet',
      sub: unsorted.length + ' row' + (unsorted.length === 1 ? '' : 's') + ' Bar Cop could not work out',
      rows: unsorted, open: r.open.unsorted !== false });
    // Category order follows the operator's own list, so the sections read the way their card does.
    this.categoryList().forEach(c => {
      const rows = landing.filter(x => x.placed && x.cat === c);
      if (!rows.length) return;
      groups.push({ key: c, title: c,
        sub: rows.length + ' expense' + (rows.length === 1 ? '' : 's') + ' going into ' + c,
        rows: rows, open: !!r.open[c] });
    });
    if (elsewhere.length) {
      // The head says what to do, because unlike Not Going In this one is answerable.
      groups.push({ key: '__elsewhere', title: 'Not Operating Expenses',
        sub: elsewhere.length + ' row' + (elsewhere.length === 1 ? '' : 's')
          + ' Bar Cop tracks elsewhere. Move any into a category to include it anyway',
        rows: elsewhere, open: !!r.open.__elsewhere });
    }
    if (skipped.length) {
      /* The head carries the reasons, so a closed section still answers "what happened to the rest".
         ⛔ BUILT FROM THE STATUS, NOT FROM THE ROW NOTE. My first version lowercased each row's full
         sentence and comma-joined them, which produced "15 rows: 11 a deposit, not an expense, 1
         zero dollars, nothing to log, 1 date could not be read" — a sentence fragment salad. A row
         note is written to be read ON a row; a head needs a countable noun. */
      const NOUN = { credit: ['deposit', 'deposits'], zero: ['zero-dollar row', 'zero-dollar rows'],
        undated: ['with no date', 'with no date'], unreadable: ['with no amount', 'with no amount'],
        totals: ['subtotal row', 'subtotal rows'], dup: ['already logged', 'already logged'] };
      const by = {};
      skipped.forEach(x => { by[x.status] = (by[x.status] || 0) + 1; });
      const why = Object.keys(by).map(k => {
        const n = by[k], w = NOUN[k] || ['row', 'rows'];
        return n + ' ' + (n === 1 ? w[0] : w[1]);
      }).join(', ');
      groups.push({ key: '__skip', title: 'Not Going In',
        sub: skipped.length + ' row' + (skipped.length === 1 ? '' : 's') + ': ' + why,
        rows: skipped, open: !!r.open.__skip });
    }
    /* ⛔ SOMETHING IS ALWAYS OPEN. A file where NOT ONE row can be imported — every amount
       unreadable, or a statement of nothing but deposits — otherwise lands the operator on a single
       collapsed card and a dead button, with the reason one click away and nothing saying so: the
       whole screen refusing to explain itself. Structural, and it needs no per-card special case —
       if nothing would be open, open the first card, whichever one that turns out to be. */
    if (groups.length && !groups.some(g => g.open)) groups[0].open = true;
    return groups;
  },

  // Choose a category, then Move To. One control, above the sections it acts on.
  _expenseToolbarHtml() {
    const r = this._expenseReview || {};
    const n = this._expenseCheckedIds().length;
    const opts = this.categoryList().map(c => '<option value="' + esc(c) + '"'
      + (c === r.moveCat ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
    /* ⚠ THE REFERENCE'S OWN MARKUP, down to the wrapper. Kyle: *"the drop down isn't styled
       correctly."* A bare `<select>` misses `.form-input`, and without the `.f` wrapper it does not
       sit against the middle of the button beside it. Copied from `ic-product-setup`'s route
       toolbar, including `no-print` and the centre alignment its comment argues for. */
    return '<div class="no-print" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px;">'
      + '<div class="f" style="max-width:220px;">'
      + '<select class="form-input" id="oex-rt-cat"><option value="">Choose a category...</option>'
      + opts + '</select></div>'
      /* ⚠ THE COUNT IS ON THE BUTTON, so a press can never move a number the operator did not see.
         Disabled at zero for the same reason the Add button is. */
      + '<button type="button" class="btn btn-primary btn-sm" id="oex-rt-move"'
      + (n ? '' : ' disabled') + '>Move To' + (n ? ' (' + n + ')' : '') + '</button>'
      + (r.moveNote ? '<span style="font-size:11px;color:var(--gold);">' + esc(r.moveNote) + '</span>' : '')
      + '</div>';
  },

  /* ONE WALK produces the rows the screen shows AND the number the button prints, because they come
     out of the same `_buildExpenseRows` the write uses. */
  _expenseReviewSummary() {
    const r = this._expenseReview;
    if (!r) return { rows: [], count: 0 };
    // A removed row is gone from the list, the count and the write.
    const live = r.rows.filter(x => !r.removed[x._rid]);
    const built = this._buildExpenseRows(live, r.verdicts, r.assign);
    // ⚠ Zipped by index: the build pushes exactly one entry per input row, in order.
    const rows = built.list.map((x, i) => this._expenseReviewRow(x, (live[i] || {})._rid));
    return { rows: rows, count: rows.filter(x => x.lands).length, built: built };
  },
  _expenseReviewCount() { return this._expenseReview ? this._expenseReviewSummary().count : 0; },

  /* One file row as an `ImportConfirm` row. `cells` is HTML this door escapes; `note` and `notes`
     are TEXT the shell escapes, and they are what the shell's one-line NOTE_BUDGET applies to. */
  _expenseReviewRow(x, rid) {
    const v = (this._expenseReview || {}).verdicts || {};
    /* ⚠ THE CREDIT ROW'S WORDING FOLLOWS THE VERDICT, exactly as the result sentence already does.
       Under the negative-debit convention the skipped rows are DEPOSITS, not refunds; saying
       "credit or refund" about a Chase file describes the opposite of what happened and sends the
       operator hunting for refunds that do not exist. */
    const creditNote = v.hasDir ? 'Marked a credit in your file'
      : v.sign && v.sign.negativeIsCharge ? 'A deposit, not an expense'
      : 'A credit or refund, not an expense';
    const NOTE = {
      'new':      'Adding this expense',
      dup:        'Already logged',
      totals:     'Your file' + String.fromCharCode(8217) + 's own subtotal, not a bill',
      zero:       'Zero dollars, nothing to log',
      undated:    'Date could not be read',
      unreadable: 'Amount could not be read',
      credit:     creditNote
    };
    const raw = x.raw || {};
    const cell = s => esc(String(s == null ? '' : s).trim()) || '&mdash;';
    /* ⛔ A ROW THAT LANDS SHOWS WHAT WILL BE STORED. EVERY OTHER ROW SHOWS WHAT THE FILE SAID.
       One sentence, and it is the whole rule. A landing row's amount is the point of the flip
       (Kyle's -123.62 debit becomes the $123.62 that gets banked), and an already-logged row shows
       the figure that is on file. But a row that will NOT land exists so the operator can find it in
       their own file, and under the negative-debit convention the flipped figure is not in their
       file at all: an $8,420.11 merchant deposit would have printed "$-8,420.11".
       Same reasoning for the date: an unreadable cell prints as the file wrote it, because a dash
       there would hide the only thing identifying the row. */
    const dateCell   = x.date ? esc(x.date) : cell(raw.date);
    const amountCell = (x.status === 'new' || x.status === 'dup')
      ? esc(App.fmtCurrency(x.amount))
      : (x.fileAmount != null ? esc(App.fmtCurrency(x.fileAmount)) : cell(raw.amount));
    /* ⛔ NO CATEGORY COLUMN. The section the row sits in IS its category, so a column repeating it is
       the duplication that made the old screen unreadable. `cat` and `placed` travel on the row for
       the grouper, never for the render. */
    return {
      cells: [dateCell, cell(x.vendor != null ? x.vendor : raw.vendor), amountCell],
      key: rid,
      cat: x.category || 'Other',
      placed: !!x.placed,
      // Carried for the grouper's head, which needs a countable noun rather than the row's sentence.
      status: x.status,
      /* ⚠ THE OUTCOME COLUMN IS QUIET UNLESS THERE IS SOMETHING TO SAY. "Adding this expense" on
         every row of a section headed "9 expenses going into Utilities" is the section said twice.
         ⛔ AND IT IS WHERE THE ELSEWHERE REASON LIVES. Kyle: *"the column 'what happens', what is it
         for now? it stays empty on everything except the not going in... at least put the 'tracked
         in labor' or 'belongs in cash outflows' in the what happens column so it is used."* It was a
         grey sub-note under the date, which is both the wrong place and the reason it read as
         advisory rather than as what the screen is going to do. */
      note: x.status === 'new' ? (x.excluded ? (x.elsewhere || '') : '') : (NOTE[x.status] || ''),
      notes: x.notes || [],
      lands: x.status === 'new' && !x.excluded
    };
  },

  /* ⭐⭐⭐ THE PROPOSALS, IN THE SAME REVIEW (Kyle: *"same review"*). A second screen after the one
     they just finished is the one they stop reading, so this sits ABOVE the row table and the single
     Add button at the bottom commits both: the rows AND the answers about what recurs.
     ⛔ TICKED BY DEFAULT, and that is the whole design. Off-by-default recreates the defect the item
     exists to close — a drop-only operator ignores the section and break-even reads $0.00 again.
     These are facts out of their own ledger. Unticking is how they say no, exactly as Add Products
     works, and the answer is remembered per vendor so it is asked once and never again.
     ⚠ RENDERS NOTHING WHEN THERE IS NOTHING TO SAY. On a first drop with no repeats there are no
     proposals, and an empty card headed "recurring bills" would just be noise on the busiest screen
     in the app. */
  _recurringProposalsHtml() {
    const r = this._expenseReview;
    if (!r || !r.recurring || !r.recurring.proposals.length) return '';
    const off = r.recurring.off || {};
    const EVERY = { weekly: 'every week', fortnightly: 'every 2 weeks', monthly: 'every month',
                    quarterly: 'every 3 months', annual: 'once a year' };
    const rows = r.recurring.proposals.map(p => {
      const on = !off[p.vendorKey];
      /* ⚠ SAY WHAT IT IS STANDING ON. Two occurrences is the minimum this can act on, and an
         operator deciding whether to trust a line needs to know it is two and not twelve. */
      const basis = p.occurrences + ' time' + (p.occurrences === 1 ? '' : 's') + ' on file'
        + (p.varies ? ', amount varies so this is the average' : '');
      return '<tr>'
        + '<td style="width:34px;"><input type="checkbox" class="bc-check oex-rec-tick" data-veno="'
        +   esc(p.vendorKey) + '"' + (on ? ' checked' : '') + '/></td>'
        + '<td style="color:var(--t1);">' + esc(p.vendor)
        +   '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + esc(basis) + '</div></td>'
        + '<td style="color:var(--t2);">' + esc(EVERY[p.frequency] || p.frequency) + '</td>'
        + '<td style="font-weight:700;color:var(--t1);">' + App.fmtCurrency(p.amount) + '</td>'
        + '</tr>';
    }).join('');
    const n = r.recurring.proposals.length;
    return '<div class="card" style="margin-bottom:16px;">'
      + '<div class="card-title">Bills that look like they repeat</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">'
      +   'Bar Cop found ' + n + ' cost' + (n === 1 ? '' : 's') + ' you pay on a regular cycle. '
      +   'These feed your break-even and your cash forecast, so they are not on your income '
      +   'statement twice. Untick anything that is not a standing cost.</div>'
      + '<table class="row-list"><tbody>' + rows + '</tbody></table></div>';
  },

  expenseReviewHTML() {
    const s = this._expenseReviewSummary();
    const n = s.rows.length;
    const bad = s.rows.filter(x => !x.lands).length;
    const v = (this._expenseReview || {}).verdicts || {};
    /* ⚠ EACH NUMBER NAMES ITS OWN COLLECTION: `n` is rows read out of the file, `bad` is rows that
       will not land, and the button counts what will be written. Reading the nearest one is how a
       screen ends up contradicting itself. And the lead names the button's own verb — renaming the
       button has to rewrite this sentence with it. */
    /* ⛔ SHORT. Kyle on the first walk: *"explainer text under check your expenses is way too
       long."* It was four sentences doing the work of one, and the fourth was a list of examples
       that now belongs where the examples actually are: on the rows themselves, where the ones Bar
       Cop can recognise say so by name. The double-count WARNING survives, because it is the only
       place in the app that says a bank debit is not automatically an operating expense, and it is
       the whole reason this door has a per-row control. The examples went; the fact did not. */
    const lead = 'Bar Cop read ' + n + ' row' + (n === 1 ? '' : 's') + ' out of this file'
      + (bad ? ', ' + bad + ' of them not going in' : '')
      + '. Remove anything tracked elsewhere in Bar Cop or it counts twice.'
      /* ⚠ THE TWO FILE-LEVEL CAVEATS BELONG ON THE SCREEN, NOT IN A SENTENCE PRINTED AFTERWARDS.
         They are facts about how EVERY row was read, so they cannot live on a row, and the operator
         needs them BEFORE they press Add rather than once the money is in. Only the case Bar Cop
         could not decide is worth saying: a file it read correctly needs no announcement. */
      + (v.conv && v.conv.contradictory
          ? ' Some dates read day-first and others month-first, so day-and-month order could not be'
            + ' settled: check any date where both numbers are 12 or under.' : '')
      + (v.sign && v.sign.contradictory && !v.hasDir
          ? ' ' + v.sign.negVotes + ' amounts are negative and ' + v.sign.posVotes + ' positive, so'
            + ' Bar Cop could not tell which sign means money out: it read the positive rows as'
            + ' expenses. Check the amount column.' : '');
    return ImportConfirm.panel({
      label: 'Check your expenses',
      lead: lead,
      /* ⚠ NARROWER VENDOR PULLS AMOUNT LEFT (Kyle: *"too big of a gap from vendor to amount"*). A
         34% vendor column against short bank descriptions left the figure stranded at the far right
         of its own cell. Every section shares one colgroup, so the columns line up card to card by
         construction; what was wrong was the split, not the alignment. */
      columns: [{ label: 'Date', width: 13 }, { label: 'Vendor', width: 27 }, { label: 'Amount', width: 12 }],
      outcomeLabel: 'What Happens',
      rows: s.rows,
      verb: 'Add', noun: 'Expense',
      // Grouped by where each row is going. See ImportConfirm.panel and _expenseGroups.
      groups: this._expenseGroups(),
      toolbar: this._expenseToolbarHtml(),
      selectable: true,
      checked: (this._expenseReview || {}).checked || {},
      removable: true,
      goAttr: 'data-oexreview-go', backAttr: 'data-oexreview-back', backLabel: 'Start Over',
      resultId: 'oex-imp-result',
      // The door owns which sections are open; a closed one builds no table at all.
      open: (this._expenseReview || {}).open,
      busy: !!this._expenseReviewWriting
    });
  },

  /* One press, one import. The button is rebuilt by every re-render, so a flag on the screen is the
     only thing a re-render cannot hand back. */
  async _runExpenseReview() {
    const r = this._expenseReview;
    if (!r || this._expenseReviewWriting) return;
    this._expenseReviewWriting = true;
    const btn = this.container && this.container.querySelector('[data-oexreview-go]');
    if (btn) { btn.disabled = true; btn.textContent = 'Adding...'; }
    // Captured BEFORE the write, because a successful `_importRows` clears the whole review.
    const rec = r.recurring;
    try {
      /* ⛔ THE SAME VERDICTS THE SCREEN DREW WITH. Letting the write re-derive them from the
         surviving rows is the defect `_expenseVerdicts` exists to close, and it would show up only
         as a number that disagreed with the button. */
      await this._importRows(r.rows.filter(x => !r.removed[x._rid]),
        { reviewed: true, verdicts: r.verdicts, picks: r.assign });
    } finally {
      this._expenseReviewWriting = false;
      /* ⛔⛔ THE ANSWERS ARE RECORDED ONLY ON SUCCESS, and `this._expenseReview` having been cleared
         is what says the write landed. A refused import that answered the proposals anyway would be
         the worst of both: the rows did not go in, and the questions never come back — the operator
         re-drops the file and the recurring section is silently empty. Same rule as every other exit
         on this handler ([[the-loop]] #49: a refusal must leave nothing behind).
         ⚠ ONE account write for the whole set, not one per proposal. */
      if (!this._expenseReview && rec && rec.proposals.length) {
        const answers = {};
        rec.proposals.forEach(p => { answers[p.vendorKey] = !rec.off[p.vendorKey]; });
        this.setRecurringDecision(answers);
      }
      /* ⛔ ONLY SUCCESS CLEARS THE SCREEN, and `_importRows` is what clears it — a refused write
         keeps the whole screen so the operator can press again without re-dropping the file. Do NOT
         re-render here: the failure path writes into the result slot and a re-render destroys it. */
      if (this._expenseReview) {
        const b = this.container && this.container.querySelector('[data-oexreview-go]');
        const n = this._expenseReviewCount();
        if (b) { b.disabled = false; b.textContent = 'Add ' + n + ' Expense' + (n === 1 ? '' : 's'); }
      }
    }
  },

  async _importRows(rows, opts) {
    opts = opts || {};
    const arr = this.records();
    const _added = [];   // rows appended here, so a failed write can take them back out
    /* ⛔ ONE WALK, SHARED WITH THE SCREEN. The row-by-row decision — unreadable amount, credit,
       $0, undated, the file's own subtotal, already logged, or a real new expense — now lives in
       `_buildExpenseRows`, which the confirm screen calls to draw itself and this calls to write.
       Two copies of that decision is how a button ends up promising a number the write does not
       honour, which is the defect the whole rollout exists to close. Everything below is REPORTING;
       nothing below decides what lands. */
    /* ⚠ THE VERDICTS COME FROM THE CALLER WHEN THERE IS A SCREEN. `_runExpenseReview` hands over
       the ones taken from the WHOLE file at the drop, so removing rows cannot re-read the
       survivors. A call with no screen in front of it takes its own. */
    const v = opts.verdicts || this._expenseVerdicts(rows || []);
    // ⛔ THE SAME PICKS THE SCREEN DREW WITH, for the same reason as the verdicts: a category the
    // operator chose and then did not see stored is the worst possible outcome of asking them.
    const built = this._buildExpenseRows(rows, v, opts.picks);
    const countOf = f => built.list.filter(f).length;
    /* ⛔ `excluded` IS PART OF "DOES THIS ROW LAND", so it is filtered here and not only on the
       screen. A guard that lives in the render is a guard that a direct import walks straight past,
       and this door's whole failure history is money reaching Books that should not have. */
    const toAdd       = built.list.filter(x => x.status === 'new' && !x.excluded).map(x => x.rec);
    const elsewhere   = countOf(x => x.status === 'new' && x.excluded);
    const credits     = countOf(x => x.status === 'credit');
    const undated     = countOf(x => x.status === 'undated');
    const unreadable  = countOf(x => x.status === 'unreadable');
    const zeroed      = countOf(x => x.status === 'zero');
    const totalsLines = countOf(x => x.status === 'totals');
    /* ⭐ `dupes` IS COUNTED NOW, NOT DERIVED. It used to be `rows.length` minus every other bucket,
       under a comment warning that any new early return which forgot to subtract itself would
       silently inflate it and tell the operator rows were already logged when they were skipped for
       something else entirely. The walk gives every row a status, so the count is a filter. */
    const dupes = countOf(x => x.status === 'dup');
    toAdd.forEach(row => { arr.push(row); _added.push(row); });

    // Imported rows were pushed into the live list before the write, and a bulk write cannot revert
    // itself — take them back out rather than showing an import Books counts and the server lacks.
    /* ⚠ THE NEW ROWS, NOT THE WHOLE LEDGER (S226g). This wrote `this.records()` — every operating
       expense the account has ever had — on every import, where every peer door writes only what it
       just added. An empty `_added` returns true from putRecordsBulk, so a file that was entirely
       duplicates still reports honestly instead of failing. */
    /* ⛔⛔ A THROW IS A FAILED WRITE AND MUST TAKE THE SAME PATH AS A FALSE RETURN — and this became
       load-bearing the day the confirm screen landed. Before it, a refused import dropped the
       operator back to the manual form and the only way forward was re-dropping the file. Now the
       screen STAYS UP and invites a second press, so a `putRecordsBulk` that REJECTS rather than
       returning false would skip `dropRows` entirely, leave N unsaved rows sitting in
       `App.data.operating_expenses` (counted by This Month, Year to Date, By Category, breakeven and
       Books) and then bank a second copy of every one of them on the retry.
       [[test-the-retry]]: a failed write is recoverable, the SECOND attempt is what makes it
       permanent. Catching here rather than at the caller means the rollback, the message and the
       kept screen are all the one existing path. */
    let saved = false;
    try {
      saved = await App.putRecordsBulk('core', 'operating_expense', _added);
    } catch (e) {
      saved = false;
    }
    if (!saved) App.dropRows(arr, _added);
    /* ⛔ A REFUSED WRITE KEEPS THE CONFIRM SCREEN, and reports into the shell's own result slot so
       the operator can press again without re-dropping the file. Returning here is what stops
       `_entryMode` dropping them back to the manual form with the whole review gone. */
    if (!saved && opts.reviewed) {
      const el = document.getElementById('oex-imp-result');
      if (el) el.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + 'Could not save the import. Nothing was changed, check your connection and try again.</div>';
      return;
    }
    /* ⛔ THE CONFIRM SCREEN CLEARS ON SUCCESS AND ONLY ON SUCCESS. The refusal returned above with
       every row still up; this line is the only one that knows the write landed. */
    this._expenseReview = null;
    this._entryMode = 'manual';
    // ⭐ AND THE TAKEOVER CLOSES ON A LANDED IMPORT, so the operator comes back to the four steps
    // with step 1 now reading the bills that just went in, rather than being left on a spent drop
    // zone. The import banner rides back with them; `_addCardHtml` consumes it on that render.
    this._moTakeover = false;
    /* ⚠ THE GUARD COMES BEFORE THE MESSAGE, NOT AFTER IT. Placed after, it stopped the repaint but
       left `_importMsg` banked — and nothing else consumes it, so the next time the operator opened
       Operating Expenses, days later, it greeted them with "1 expense imported." about an import
       they had already navigated away from. If nobody is on the screen there is nobody to tell; a
       failed write already raises its own alert at the time. */
    /* ⚠ THE TOKEN ALONE IS NOT ENOUGH — CHECK `_view` TOO. Expense History mounts through this
       same object and re-stamps the SAME `_mountedAt` slot, so the token still matches and the
       repaint went ahead, painting Operating Expenses over the History page the operator had just
       opened. */
    if (!this._mountStillCurrent()) return;
    /* ⛔⛔ NAMES THE ONE VIEW THAT SUPPRESSES THE MESSAGE, RATHER THAN "anything but current".
       This read `_view !== 'current'`, which was correct while Expense History was the only other
       view — a read-only log is no place for an import banner. Adding the Money Out card made
       `moneyout` a third value, and it fell straight into the same branch: an import dropped on
       Close The Books would have repainted and said NOTHING about what happened to the file. That
       is the defect the comment on `_importMsg` was written about — *"a row the operator can see in
       their own file and cannot find in Bar Cop is what makes them stop trusting the total"* — and
       it would have hit on the one screen built to be where you drop the statement.
       ⚠ The page-hijack worry the old guard also carried is gone: `_rerender` now paints whichever
       view is actually open, so it cannot draw one screen over another. History is the only
       exclusion left, so it is the only one named. [[the-loop]] #24 — after a value gains a third
       possibility, every test written against two is now pointing at the wrong set. */
    if (this._view === 'history') { this._rerender(); return; }
    if (!saved) {
      this._importMsg = 'Could not save the import. Nothing was changed — check your connection and try again.';
    } else if (opts.reviewed) {
      /* ⭐⭐ A REVIEWED IMPORT GETS THE HEADLINE ALONE. Every clause below was written when the drop
         wrote straight through and this line was the operator's ONLY account of it. Now each one is
         a row on the confirm screen, said once, where they read it and pressed Add — and repeating
         it afterwards is the second telling. Kyle on the sales door: *"all that green text is very
         hard to read and follow.. it is just repeating what the user just saw on screen."*
         ⛔ PRECONDITION, and it is the whole rule: a clause may only be dropped once its FACT is on
         the screen. Every bucket here is a row with its own note, the two file-level caveats are in
         the lead, and the rows the operator took out went out by their own hand. */
      this._importMsg = _added.length + ' expense' + (_added.length === 1 ? '' : 's') + ' imported.';
    } else {
      /* The full account, for a call with no screen in front of it. This is the path a direct
         `_importRows` takes, and it is the only reason these clauses still exist. */
      const bits = [_added.length + ' expense' + (_added.length === 1 ? '' : 's') + ' imported'];
      /* ⚠ THE SENTENCE FOLLOWS THE VERDICT. Under the negative-debit convention the skipped rows are
         DEPOSITS, not refunds — saying "credits or refunds skipped" about a Chase file describes the
         opposite of what happened and sends the operator hunting for refunds that do not exist. */
      if (credits)    bits.push(credits + (v.hasDir
        ? ' row' + (credits === 1 ? '' : 's') + ' skipped, marked as credits in your file (money in, not an expense)'
        : v.sign.negativeIsCharge
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
      if (dupes > 0) bits.push(dupes + ' already logged');
      // Named, never silent: a row Bar Cop declined to book is a row the operator can see in their
      // file and cannot find here, which is exactly what makes them stop trusting the total.
      if (elsewhere) bits.push(elsewhere + ' row' + (elsewhere === 1 ? '' : 's')
        + ' left out, tracked elsewhere in Bar Cop (payroll, deliveries, draws, transfers)');
      /* ⚠ ONLY THE CONTRADICTORY FILE IS WORTH SAYING OUT LOUD. A day-first file that Bar Cop read
         correctly needs no announcement. What the operator DOES need is the case Bar Cop could not
         decide: the rows where both numbers are 12 or under are a coin toss. */
      if (v.conv.contradictory) bits.push('some dates read day-first and others month-first, so day-and-month order could not be settled — check any date where both numbers are 12 or under');
      // ⚠ ONLY WHEN THE SIGN WAS ACTUALLY CONSULTED. With a Debit/Credit column present nothing was
      // inferred, so warning that Bar Cop "could not tell" would describe a decision it never made.
      if (v.sign.contradictory && !v.hasDir) bits.push(v.sign.negVotes + ' amounts are negative and ' + v.sign.posVotes
        + ' positive, so Bar Cop could not tell which sign means money out — it read the positive rows as expenses; check the amount column');
      this._importMsg = bits.join(' · ') + '.';
    }
    this._rerenderHost();
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
    // The operator's own list, plus anything with money on file, plus the cash-only categories
    // when the chip admits them. See _cardCategoryList().
    const catRows = this._cardCategoryList().map(c => {
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
    const rangeChips = App.filterChips(this._filterRange, this._rangeChipOpts());
    /* ⭐ ITEM 19 STAGE 1 — THE KIND CHIPS. Two chip rows, two questions: WHICH MONEY (kind) and
       WHEN (range). They get their own class so the two wirings cannot cross — one shared
       `.fc-chip` handler would have set `_filterRange` to 'all' when the operator clicked the
       All Money Out chip, because both vocabularies contain 'all' ([[the-loop]] #50: a key that
       two different things can produce is not a key). */
    const kindChips = App.filterChips(this._filterKind, this._kindChipOpts(), 'mo-chip');
    const recs = this._filteredRecords();
    const shown = recs.slice(0, this._histShown);

    const filterRow = '<div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap;margin:24px 0 10px;">' + kindChips + '</div>'
      + '<div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px;">' + rangeChips + '</div>';
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

  /* The History range chips, as a METHOD so the render and the PDF header read one list.
     Deliberately not a data property: 21 harnesses lift methods out of this file by name and a
     sibling constant is invisible to every one of those slicers ([[the-loop]] #16). */
  _rangeChipOpts() {
    return [
      { v: 'this-month', label: 'This Month' },
      { v: 'last-month', label: 'Last Month' },
      { v: 'ytd',        label: 'Year to Date' },
      { v: 'last-12',    label: 'Last 12 Months' },
      { v: 'all',        label: 'All Time' }
    ];
  },

  _wireHistory() {
    const PAGE = App.LIST_PAGE || 50;
    document.getElementById('oex-export')?.addEventListener('click', () => {
      // Export the FULL filtered list (not just the on-screen 50), built off-screen.
      const node = document.createElement('div');
      node.style.cssText = 'position:absolute;left:-99999px;top:0;width:900px;';
      node.innerHTML = this._byCatCardHtml() + this._logTableHtml(this._filteredRecords());
      document.body.appendChild(node);
      /* ⚠ The range chips are in a `no-print` row AND this exports an OFF-SCREEN node that never
         contained them, so the accountant-facing expense history had no way to say whether it
         was one month or all time. The "This Month" card export above needs none: its own
         heading prints "This Month - July 2026" inside the exported root. */
      /* ⛔⛔ THE TITLE FOLLOWS THE KIND CHIP (item 19). This exports `_filteredRecords()`, which the
         chip now drives — so a fixed title of "Operating Expenses" would send the accountant a PDF
         of owner draws and loan payments under a heading that says they are operating expenses.
         The range already followed its chip for the same reason; the kind has to as well.
         [[the-loop]] step 0.6: the PDF is the artefact that actually leaves the building, and a
         caveat that goes on the screen and not on the export is half a fix. */
      Promise.resolve(App.exportPDF({ title: this._kindExportTitle(), root: node,
        range: App.chipRangeLabel(this._rangeChipOpts(), this._filterRange) }))
        .finally(() => node.remove());
    });
    // ⭐ ITEM 19: the kind chips are wired SEPARATELY, on their own class — see the note at the
    // render. Both vocabularies contain 'all', so one shared handler would cross the two filters.
    this.container.querySelectorAll('.mo-chip').forEach(chip => {
      chip.addEventListener('click', () => { this._filterKind = chip.dataset.v; this._histShown = PAGE; this._rerender(); });
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
  /* ⛔ IT FIRES AS THEY TYPE THE VENDOR, WHICH IS THE MOMENT ITS INPUT EXISTS ([[the-loop]] #78: a
     check that CAN run before the work MUST run before the work). Waiting for Add would mean they
     had already picked a date, chosen a category and typed an amount before being told the row
     belongs on a different screen entirely.
     ⚠ AND IT OFFERS THE WAY THERE, because a notice that names a screen without opening it is a
     chore. Only where a destination HAS a screen: platform fees live in the Confirm the Week popup
     and a transfer between their own accounts is tracked nowhere, so those say so and offer no
     button rather than a dead one. */
  _manualElsewhereNotice() {
    const host = document.getElementById('oexa-elsewhere');
    if (!host) return;
    const v = (document.getElementById('oexa-vendor') || {}).value || '';
    const e = this._elsewhereFor(v);
    if (!e) { host.innerHTML = ''; return; }
    host.innerHTML = '<div style="background:var(--gold-tint);border:1px solid var(--gold-tint-bord);'
      + 'border-radius:6px;padding:10px 14px;margin-top:12px;font-size:12px;color:var(--t1);'
      + 'line-height:1.6;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
      + '<span style="flex:1;min-width:200px;">' + esc(e.note) + '. Logging it here as well would'
      + ' count it twice. It belongs in ' + esc(e.where) + '.</span>'
      + (e.screen ? '<button type="button" class="btn btn-ghost btn-sm" id="oexa-elsewhere-go">Go There</button>' : '')
      + '</div>';
    const go = document.getElementById('oexa-elsewhere-go');
    if (go && e.screen) go.addEventListener('click', () => App.openScreen(e.screen));
  },

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
    /* ⭐⭐ ITEM 19 STAGE 2 — THE CASH BRANCH, AND IT GOES FIRST SO THE EXPENSE PATH BELOW IS
       UNTOUCHED. The operator declared the type, so nothing is inferred from a category name here.
       ⛔ IT WRITES THROUGH `_writePair`, WHICH IS THE ONLY SANCTIONED PATH. A plain
       `putRecord('operating_expense', ...)` would create a cash-only row with no `migrated_from`,
       which `_isOperatingRow` counts as a BILL and `CashEngine.cashOutflows` cannot see — the
       orphan shape ([[the-loop]] #115). `_writePair` writes the operator's store first and the
       ledger twin after, so a refused half leaves the ledger LAGGING, which the boot reconcile
       repairs. Bare call, not guarded: a guard would mean "if the outflow screen has not loaded,
       write half a record" ([[the-loop]] #40).
       ⚠ THE REFUSAL IS REPORTED. `_writePair` returns false when the operator's own store refuses,
       and saying so keeps the typed values on screen instead of claiming a save that did not
       happen ([[test-the-retry]] — the retry is where a half-save becomes permanent). */
    const logType = g('oexa-logtype')?.value || '';
    if (!logType) { showErr('Pick a log type.'); return; }
    if (logType === 'cash') {
      const kind = g('oexa-kind')?.value || '';
      if (!date) { showErr('Pick a date.'); return; }
      if (!kind) { showErr('Pick a kind.'); return; }
      if (isNaN(amount) || amount <= 0) { showErr('Enter an amount above zero.'); return; }
      if (recurring && g('oexa-term')?.value && (isNaN(term) || term < 1)) { showErr('A fixed term must be 1 month or more, or leave it blank to recur until you stop it.'); return; }
      const out = {
        id: App.uid ? App.uid() : ('cof-' + Date.now()),
        date: date, type: this._typeForCashCategory(kind), amount: amount, notes: notes,
        created_at: new Date().toISOString()
      };
      if (recurring) {
        out.recurring = true;
        out.frequency = g('oexa-frequency')?.value || 'monthly';
        out.term_months = (term && term > 0) ? term : null;
        out.recur_day = parseInt(String(date).slice(8, 10), 10) || 1;
      }
      if (!(await S.HubCashOutflows._writePair(out))) {
        showErr('Could not save. Check your connection and try again.');
        return;
      }
      this._rerenderHost();
      return;
    }
    if (!date) { showErr('Pick a date.'); return; }
    if (!category) { showErr('Pick a category.'); return; }
    if (isNaN(amount) || amount <= 0) { showErr('Enter an amount above zero.'); return; }
    if (recurring && g('oexa-term')?.value && (isNaN(term) || term < 1)) { showErr('A fixed term must be 1 month or more, or leave it blank to recur until you stop it.'); return; }
    /* ⛔ ASK ONCE, DO NOT REFUSE. The import HOLDS a flagged row back because there the default —
       doing nothing — booked it. Here nothing happens until this button is pressed, so refusing a
       row the operator deliberately typed would be the app overruling them on a guess, and Bar Cop
       can be wrong. What the confirm buys is that the override is a DECISION rather than an
       accident: the notice already told them while they were typing the name.
       ⚠ It cannot become a wall of skip — it only exists when a rule actually matched, which for an
       ordinary expense is never. */
    const _elsewhere = this._elsewhereFor(vendor);
    if (_elsewhere) {
      const goOn = await App.confirm({
        title: 'This looks like it belongs somewhere else',
        message: _elsewhere.note + '. Bar Cop already counts it from ' + _elsewhere.where
          + ', so logging it here as well would count it twice on your Income Statement.'
          + ' Add it to Operating Expenses anyway?',
        confirmText: 'Add It Anyway', cancelText: 'Cancel'
      });
      if (!goOn) return;
    }
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
    this._rerenderHost();
  },

  /* ⭐ ONE PLACE DECIDES WHAT THE FORM IS SHOWING. Called on every change of Log Type and by
     `_clearAdd`, so the revealed selector always matches the type — and, just as important, the
     branch that is NOT in play is HIDDEN AND CLEARED. Leaving a stale value in the hidden control
     is how a save reads a category the operator cannot see: pick Operating Expense, choose
     Utilities, switch to Cash Outflow, save — without the clear, `oexa-cat` still says Utilities.
     ⚠ Vendor rides with the expense branch: an outflow record has nowhere to put one, so
     collecting it there would be silent loss on save. */
  _applyLogType() {
    const t = document.getElementById('oexa-logtype')?.value || '';
    const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
    const clear = (id) => { const el = document.getElementById(id); if (el) el.value = ''; };
    show('oexa-cat-wrap', t === 'expense');
    show('oexa-vendor-wrap', t === 'expense');
    show('oexa-kind-wrap', t === 'cash');
    if (t !== 'expense') { clear('oexa-cat'); clear('oexa-vendor'); }
    if (t !== 'cash') clear('oexa-kind');
    // The "looks like it belongs elsewhere" notice is keyed off the vendor, which only the expense
    // branch has. Clear it too, or it outlives the branch that raised it.
    const el = document.getElementById('oexa-elsewhere'); if (el && t !== 'expense') el.innerHTML = '';
  },

  _clearAdd() {
    const d = document.getElementById('oexa-date'); if (d) d.value = App.todayLocal();
    const c = document.getElementById('oexa-cat');  if (c) c.selectedIndex = 0;
    ['oexa-vendor', 'oexa-amount', 'oexa-notes', 'oexa-term'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const rc = document.getElementById('oexa-recurring'); if (rc) rc.checked = false;
    const fq = document.getElementById('oexa-frequency'); if (fq) fq.selectedIndex = 0;
    const tw = document.getElementById('oexa-term-wrap'); if (tw) tw.style.display = 'none';
    const e = document.getElementById('oexa-err');  if (e) e.style.display = 'none';
    const lt = document.getElementById('oexa-logtype'); if (lt) lt.value = '';
    this._applyLogType();
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
      /* ⛔⛔ A CASH ROW GETS AN UNKEYED PICKER HOLDING EXACTLY THE FIVE CASH KINDS, AND THE REASON IS
         MEASURED. A KEYED select pulls its options through `App.listOptions`, which REFUSES the
         cash-only names at read time — a deliberate guard, so an account that once typed "Owner
         Draw" into the list manager cannot file a bill under it. So passing them as `builtin` on a
         keyed control does nothing: only the row's CURRENT category survives, via `push(sel)`.
         Measured on the real `customSelect`: keyed offered NONE of the five, unkeyed offered all.
         That left the editor accepting a category change it then threw away — `_typeForCashCategory`
         returns '' for a bill category and `_editCashRow` leaves the type alone, so picking
         "Utilities" on a draw looked like it saved and changed nothing. A form must not accept a
         change it discards.
         ⚠ UNKEYED ALSO KEEPS IT OUT OF `App._listBuiltins`, which a keyed call writes GLOBALLY under
         the key — and `_matchCat` and `categoryList()` both read that family. `categoryList()` is
         what `hub-books` uses to build the Income Statement's lines, so a leak there would put
         "Owner Draw" on the P&L.
         ⚠ NO MANAGE LINK on this branch: the five are a fixed vocabulary tied to the outflow TYPE,
         not a list the operator curates. */
      +   (rec.migrated_from === 'cash_outflow'
        ? '<div class="f"><label>Kind</label>' + App.customSelect({ id: 'oex-f-cat', builtin: this.CASH_ONLY_CATEGORIES.map(c => c.name), selected: rec.category, blank: false }) + '</div>'
        : '<div class="f"><label>Category' + App.manageListLink('expense_category') + '</label>' + App.customSelect({ id: 'oex-f-cat', key: 'expense_category', builtin: this.CATEGORIES, selected: rec.category, blank: true, blankLabel: 'Select category...' }) + '</div>')
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
      /* ⛔⛔ A CASH ROW IS EDITED AT ITS SOURCE, AND THE REST OF THIS HANDLER MUST NOT RUN ON ONE.
         The ledger row is DERIVED: `reconcileCashOutflowLedger` rewrites it from `cash_outflows` on
         every load, so writing the edit here would look right and silently revert on the next
         login. It also has no series machinery — a draw has no recurring parent, no term, no skip
         months — so every branch below is about a shape this row does not have.
         ⚠ THE REFUSAL IS REPORTED, NOT SWALLOWED: `_writePair` returns false when the operator's own
         store refuses, and keeping the form open with the message is what makes the retry safe
         ([[test-the-retry]] — the second attempt is where a half-save becomes permanent).
         Pinned by verify-money-out-write-doors.js section B. */
      if (isEdit && rec && rec.migrated_from === 'cash_outflow') {
        if (!(await this._editCashRow(rec.id, { date, amount, notes, category }))) {
          showErr('Could not save. Check your connection and try again.');
          return;
        }
        App.closeModal();
        this._rerender();
        return;
      }
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
            /* ⚠⚠ A RESUME THAT CANNOT GENERATE ANYTHING MUST SAY SO (round 4). Round 3 made the
               term survive a pause — right — but the term is measured from the series' ORIGINAL
               start, so a term that ran out DURING the pause makes Resume a silent no-op: the row
               keeps its "recurring" tag and its Stop button, generates nothing, and contributes $0
               to Books, Break-Even and the forecast. The one message that would explain it is the
               Terms Ending banner, and its +/-2 month floor (S226e) means it is silent too.
               Refusing with a sentence is the honest answer: the operator can extend the term or
               move the Due Date, and either is a decision only they can make. */
            /* ⚠⚠⚠ A REFUSAL MUST PUT MEMORY BACK. This returned without restoring undoArr, and the
               slots above had ALREADY been overwritten — so a refused save left the operator's edit
               live in memory, and catchUpRecurring then read the amount off that dirty parent and
               WROTE the generated months at it. Measured: a refused save persisted $300 of a raise
               the app had just declined, and on a series with months still to generate it scaled —
               $58,500 booked against a truth of $54,600. The two OTHER exits from this handler both
               restore; this one was added later and did not.
               ⚠⚠ AND IT ONLY FIRES ON A RESUME (round 5, F2). Sitting inside if (recChecked) it
               fired on EVERY edit to EVERY row of a finished-term series — measured, 10 of 10 rows
               refused a plain vendor-typo fix — and the advice it gave ("change the Due Date") is
               inert from a child row, because the term lives on the parent. The only case that
               genuinely needs refusing is the one it was written for: turning a PAUSED series back
               on when its term has already run out, where the save would otherwise do nothing at
               all, silently. A series that is already recurring is not being restarted. */
            const _wasPaused = !arr[pIdx].recurring;
            const _startIdx = (() => {
              const s0 = new Date(String(arr[pIdx].date).length <= 10 ? arr[pIdx].date + 'T00:00:00' : arr[pIdx].date);
              return isNaN(s0.getTime()) ? null : s0.getFullYear() * 12 + s0.getMonth();
            })();
            const _nowIdx = (new Date()).getFullYear() * 12 + (new Date()).getMonth();
            if (_wasPaused && termV && termV > 0 && _startIdx != null && _startIdx + termV - 1 < _nowIdx) {
              arr.length = 0; arr.push(...undoArr);
              showErr('That fixed term has already finished. Change the Due Date to when it next starts, or clear "Ends after" to keep it going.');
              return;
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
            /* ⚠⚠ A PAUSE MUST NOT DESTROY WHAT THE SERIES IS (round 3, F1/F2). This used to clear
               frequency and term_months, which was harmless while turning a bill off was TERMINAL —
               and round 2 made it reversible, so the same two lines became a money defect. The
               re-opened form falls back to "Monthly" and blank when those fields are missing, so
               resuming a QUARTERLY bill re-billed it every month retroactively from the series
               start: measured 5 rows / $12,000 becoming 12 / $28,800, and an ANNUAL one 3 / $3,300
               becoming 24 / $26,400. Both also reach hub-breakeven and the cash forecast, which read
               frequency directly, so the fixed-cost nut carried a quarterly bill at 4x.
               And a cleared term made the bill recur FOREVER, with both things built to catch that —
               the Terms Ending banner and the Renew button — going silent because there was no term
               left to read. Frequency and term describe the SERIES; pausing it changes neither. */
            arr[pIdx] = Object.assign({}, arr[pIdx], { recurring: false },
              // Only a row that WAS recurring gets a stop stamp; a plain expense never had a series.
              arr[pIdx].recurring ? { stopped_ym: arr[pIdx].stopped_ym || this._currentMonthKey() } : {});
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
    // ⚠ term_months SURVIVES THE STOP (round 3, F2). Clearing it made a paused fixed-term contract
    // recur forever once resumed, and silenced the banner and the Renew button that exist to catch
    // exactly that. It is inert while paused — every reader tests recurring first.
    arr[pIdx] = Object.assign({}, p, { recurring: false, stopped_ym: this._currentMonthKey() });
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
  /* ⛔ NAME THE BILL, AND SAY WHAT ELSE GOES WITH IT (B6).
     This door showed the generic "Delete this? Deleting this data is a permanent action and
     cannot be undone." on a record that feeds the Income Statement, the Books landing, the Cash
     Forecast and the workbook an accountant opens. Two sections away a PRODUCT delete names every
     menu item and prep batch at risk, a VENDOR delete names its products and open orders, and
     Cancel Order names the vendor and the amount. This was the odd one out, on money.
     And the generic sentence was actively WRONG for two of the three paths _delete takes:
       · a SERIES PARENT   -> its children are detached and every past month STAYS on the books,
                              which is the opposite of "cannot be undone" as an operator reads it
       · a GENERATED month -> a skip is recorded so the catch-up cannot re-mint it
       · a plain bill      -> it simply goes
     Returns {title, message} so the wording is testable without a browser. */
  _delExpenseSummary(rec) {
    const money = App.fmtCurrency(rec.amount || 0);
    const who = rec.vendor ? rec.vendor : rec.category;
    const title = 'Delete ' + who + ' ' + money + '?';
    const head = (rec.vendor ? rec.category + ' · ' : '') + (rec.date || '');
    if (rec.recurring_parent) {
      return { title, message: head + '\n\nThis is one generated month of a recurring bill. '
        + 'Deleting it records the month as skipped, so it will not come back on the next load. '
        + 'The rest of the series is untouched.' };
    }
    const kids = this.records().filter(r => r && r.recurring_parent === rec.id).length;
    if (kids > 0 || rec.recurring) {
      return { title, message: head + '\n\n'
        + (kids > 0
            ? 'This is the parent of a recurring bill. Its ' + kids + ' generated '
              + (kids === 1 ? 'month stays' : 'months stay') + ' on your books, because that is money '
              + 'you already spent. They stop being tied to a series.\n\n'
            : 'This is a recurring bill.\n\n')
        + 'Nothing new will be generated for it again.' };
    }
    return { title, message: head + '\n\nThis removes it from your operating expenses, your '
      + 'income statement and your month-end file. It cannot be undone.' };
  },

  async _delete(id) {
    const arr = this.records();
    const rec = arr.find(r => r.id === id);
    if (!rec) return;
    const s = this._delExpenseSummary(rec);
    const ok = await App.confirm({ title: s.title, message: s.message, confirmText: 'Delete', maxWidth: 460 });
    if (!ok) return;
    /* ⛔⛔ A CASH ROW IS NOT OURS TO DELETE ALONE, AND STAGE 1 IS WHAT MADE THIS REACHABLE. The
       Money Out chip put owner draws, loan payments and tax remittances in this log, and every row
       here renders Edit and Delete. Removing only the ledger row leaves the operator's own record
       in `cash_outflows`, and `reconcileCashOutflowLedger` runs on EVERY load and is additive — so
       MEASURED end to end: the row came straight back on the next login. The Delete button did
       nothing, permanently, which is S226a's exact defect in a new costume.
       `_deletePair` is the sanctioned path and carries the order contract (ledger first, so a
       refused old-store delete leaves the ledger LAGGING and the reconcile repairs it). Bare call,
       not guarded: a guard here would mean "if the outflow screen has not loaded, delete half a
       record", which is the silent-wrong-state trade this codebase gets wrong most often
       ([[the-loop]] #40). Pinned by verify-money-out-write-doors.js section A. */
    if (rec.migrated_from === 'cash_outflow') {
      await S.HubCashOutflows._deletePair(id);
      this._rerender();
      return;
    }
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
