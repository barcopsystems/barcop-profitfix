'use strict';

/* ── Hub Operating Expenses Log ──────────────────────────────────────────────
   A Hub-owned view under Accounting. Per-entry log of operating expenses
   (rent, utilities, insurance, marketing, professional fees, bank/CC fees,
   licenses/permits, software/subscriptions, other). Books reads this log
   to fill the Income Statement Operating Expenses placeholder lines so the
   operator's accountant does not have to type them in by hand.

   ⭐ THE TWO-DOORS NOTE THAT USED TO SIT HERE IS DEAD, AND SAYING SO IS THE POINT. It read
   "Repairs and Maintenance lives in Shift Control's sc_maintenance log; 3rd-Party Platform Fees
   live in the weekly P&L roll; this log does NOT include those categories." Both are ordinary
   categories on this one ledger now (Phase 2 item 12, and build piece 2), so this log is every
   dollar of money out and nothing is counted anywhere else.

   Sample data deferred per the pre-launch sample-data overhaul. */

S.HubOperatingExpenses = {
  /* !! FIVE RECURRING MEMBERS WERE DELETED HERE (2026-08-06): _duplicate, _isSeriesEnding,
     _seriesAny, _seriesOf and _stopRecurring. They were the handlers behind the Renew, Stop and
     Repeat row buttons and the 'recurring' row tag, all of which came off _logRowHtml when
     recurrence became something DERIVED off the ledger rather than a flag an operator manages.
     They were a closed cluster: _seriesOf's only caller was _isSeriesEnding, itself unreached.
     Deleting them also removed the last callers of S.HubCashOutflows.stop and .repeat, which is
     what lets that retired screen's whole render tree close out by fixpoint. */

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
       ⭐⭐ BUILD PIECE 2 FINISHED THE JOB: the weekly roll no longer holds it. Item 9 left the week
       as the source with the ledger MIRRORING it, and a mirror is a second source — measured, it
       was already being subtracted twice on the Cash Bridge and in the Profit Forecast. It is typed
       here now, at the one Money Out door, like every other bill. */
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

  /* ⭐⭐ A WEEK'S TYPED DELIVERY COMMISSION BECOMES A LEDGER ROW. PURE.
     ⚠ THIS IS HISTORY'S DOOR, NOT A LIVE ONE. Nothing types `week.platform_fees` any more (build
     piece 2); this exists so `migratePlatformFeesOnce` can carry the figures already on file across
     to the ledger, once, on the account's next login. It is the ONLY thing left in the tree that
     reads the retired field, which `verify-platform-fees-one-source.js` A5 pins deliberately — or
     A4 could one day be satisfied by deleting the migration and losing the history with it.
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

  /* ⛔ `migrateCashOutflowsOnce` AND `reconcileCashOutflowLedger` WERE DELETED HERE (build order E).
     Both existed to keep the legacy `cash_outflow` store and the ledger honest with each other: the
     one-time pass copied every outflow across, and the reconcile ran on every load to repair a
     refused half-write. E drops the old store, so there is no second store to reconcile with and
     nothing left to migrate — every cash row now IS the ledger row, written once.
     ⭐ THE MAPPING ITSELF STAYS, right above: the door and the seed both build their rows with it,
     and it is what keeps `category` derived from `type` in one place.
     ⚠ THE MARKER WENT TOO (`migrated_kinds.cash_outflow_to_ledger`). It is still sitting in the
     `migrated_kinds` map on every live account, harmlessly — nothing reads it, and clearing it would
     be a write to every operator's data for no benefit. */
  /* ⭐ PHASE 2, the same job for the maintenance log. `App.shiftData`, not `App.data` — the
     maintenance tracker lives in the Shift Control module, which is a different store entirely. */
  async reconcileMaintenanceLedger() {
    return this._reconcileLedgerFrom(App.shiftData && App.shiftData.sc_maintenance,
      this.migrateMaintenanceRow, 'maintenance');
  },
  /* ⭐⭐⭐ BUILD PIECE 2 — THE MIRROR BECOMES A ONE-TIME MIGRATION, AND THE LEDGER IS THE SOURCE.
     `reconcilePlatformFeesLedger` lived here and ran on EVERY load, keeping the ledger a pure
     function of `week.platform_fees`. Two sources for one dollar is exactly what the rebuild exists
     to end, and it had already cost real money: `CashEngine.bills()` excludes only CASH-ONLY
     categories, so `billsDue` picked the mirror row up as overhead while `profitForPeriod` went on
     subtracting the weekly field beside it. MEASURED on the deployed build over Jun-Aug, by running
     what a login runs: Cash Bridge profit $35,831.59 -> $33,003.49 and Cash You Kept
     -$3,168.41 -> -$5,996.51, a gap of exactly $2,828.10, which is the period's commission. The
     Profit Forecast had the same shape at `opexTot = (avgWeeklyOpex + avgWeeklyPF) * hw`.

     ⛔ IT IS A MIGRATION, NOT A DELETION, AND THAT IS THE SAFETY ARGUMENT. Deleting the reconcile
     outright is safe only for an account that logged in between 2026-08-05 (when the mirror
     shipped) and this push. One that did not would have every week of typed commission dropped off
     its Income Statement for good, silently. So this runs once, writes the rows the reconcile would
     have written, and marks itself done.

     ⛔ IT NEVER REWRITES A ROW ALREADY ON FILE. The reconcile did — it existed to keep a mirror in
     step — and that was right while the week was the source. It is wrong now: once the ledger owns
     the figure, an operator may correct it, and a migration that "repairs" their correction back to
     the retired weekly field would be the two-doors defect wearing a helpful hat.

     ⛔ THE MARKER IS WRITTEN AND PERSISTED ONLY AFTER THE ROWS LAND. app.js persists
     `migrated_kinds` earlier in the load than this runs, so this saves its own key or the marker
     never survives the session and the migration re-runs for ever ([[test-the-retry]] — the retry
     is where a failed migration becomes permanent damage; here it is id-preserving and skips what
     it finds, so a retry writes nothing).
     ⛔ NEVER OFF A CACHE-SERVED READ: a partial ledger would make a migrated week look unmigrated. */
  async migratePlatformFeesOnce() {
    if (typeof App === 'undefined' || !App.data) return 0;
    if (typeof DB !== 'undefined' && DB._loadDegraded) return 0;
    if (!App.data.migrated_kinds || typeof App.data.migrated_kinds !== 'object') App.data.migrated_kinds = {};
    const marks = App.data.migrated_kinds;
    if (marks.platform_fees_to_ledger) return 0;
    const weeks = Array.isArray(App.data && App.data.weeks) ? App.data.weeks : [];
    const arr = this.records();
    const have = {};
    arr.forEach(r => { if (r && r.id != null) have[r.id] = r; });
    const rows = [];
    weeks.forEach(w => {
      const row = this.migratePlatformFeesRow(w);
      if (!row || have[row.id]) return;      // no fee, or the row is already on file — leave it alone
      rows.push(row);
    });
    if (rows.length) {
      rows.forEach(r => arr.push(r));
      let ok = false;
      try { ok = await App.putRecordsBulk('core', 'operating_expense', rows, { quiet: true }); }
      catch (e) { ok = false; }
      /* A refused write puts memory back and leaves NO marker, so the next login tries again
         against a ledger that never saw the rows. Silent: the operator did not ask for this and
         nothing they can see is wrong. */
      if (!ok) {
        rows.forEach(r => { const i = arr.indexOf(r); if (i >= 0) arr.splice(i, 1); });
        return 0;
      }
    }
    marks.platform_fees_to_ledger = new Date().toISOString();
    try { if (App.saveKey) await App.saveKey('migrated_kinds'); } catch (e) { /* retried next login */ }
    return rows.length;
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

  /* ⛔ `_tab: 'current'` WAS DELETED HERE (build order B). It was the last vestige of a tab UI this
     screen has not had for a long time: declared, and read in exactly zero places tree-wide. A field
     that is written and never read is a fix that never shipped, or in this case a feature that never
     left ([[the-loop]] #25). No slicer can see a data property, so nothing would ever have told us. */
  _entryMode:      'manual',   // manual | import — the FULL Money Out screen's add form
  /* ⭐⭐ THE STEP HAS ITS OWN MODE, AND IT DEFAULTS TO IMPORT (Kyle, 2026-08-07).
     `null`/'import' = the drop zone, 'manual' = the typed form. Deliberately a SECOND field rather
     than a new default on `_entryMode`: that one is the full screen's, and flipping it would open
     the Money Out page on a drop zone nobody asked for. Two surfaces, two answers, one resolver.
     ⭐ THE SHAPE IS COPIED FROM THE SCREEN KYLE NAMED: `sc-dashboard._salesMode` is `null` and its
     `on()` treats anything that is not 'manual' as import, so the step lands on the drop zone with
     the Import File chip lit. `verify-money-out-one-door` G4 pins the two together. */
  _stepMode:       null,       // null|'import' = drop zone inline · 'manual' = the typed form
  /* The LIVE mapper node. Set at the handover (`_onImportState`) and held for the LIFE of the
     takeover, not just across the one re-render that opens it — that is what lets an operator leave
     Close The Books mid-map and come back to their file instead of a fresh drop zone. Released by
     every path that ends a takeover: Cancel, Start Over, and a landed import. */
  _carryCsv:       null,
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

  /* ⭐ THE TAB ORDER IS KYLE'S, AND IT IS THE ORDER HE NAMED THEM IN: *"Three tabs: Bills · Cash
     Outflows · All Money Out."* It was All-first while these were CHIPS, where the widest set
     reasonably leads. As tabs the first one is the DEFAULT the page opens on, and that is Bills —
     the set this screen has always opened on. */
  _kindChipOpts() {
    return [
      { v: 'operating', label: 'Bills' },
      { v: 'cash',      label: 'Cash Outflows' },
      { v: 'all',       label: 'All Money Out' }
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

  /* ⛔⛔ THE EDIT READS THE LEDGER NOW (build order E). It used to look the record up in
     `App.data.cash_outflows`, because that store was the source and the ledger row was DERIVED from
     it — editing the twin directly meant the boot reconcile rewrote it and the edit silently
     reverted. With one store the source IS the ledger row, and reading it from anywhere else is the
     drift this rebuild exists to end.
     ⭐⭐ AND IT CLOSED A REAL HOLE, which is why the change is worth more than a tidy-up.
     `operating_expense` is NONWINDOWED and `cash_outflow` never was (db.js), so the ledger loads in
     full forever while the old store loaded 24 months. This screen lists LEDGER rows — so a cash row
     older than the window rendered with an Edit button, and the lookup above found nothing and
     returned false. A live button that silently did nothing. Nothing has aged out yet (outflows only
     reached the ledger on 2026-08-04), so it was a hole rather than a live defect. Pinned as block F
     of `verify-cash-doors-equality.js`, which reproduces the old refusal and proves the new reach.
     ⛔ THE STAMP IS THE FILTER, NOT THE CATEGORY. An expense the operator filed under a category
     they named "Owner Draw" is THEIR bill; editing it as a cash row would restate their P&L
     ([[the-loop]] #115). Same discriminator the engine's reader uses.
     ⚠ It still writes through `_writeCashRow`, so the row goes back through the ONE mapping and
     `category` cannot drift away from `type`. Returning its boolean is what lets the caller keep the
     form open on a refusal instead of claiming a save that did not happen ([[test-the-retry]]). */
  async _editCashRow(id, patch) {
    const cur = this.records().find(r => r && r.id === id && r.migrated_from === 'cash_outflow');
    if (!cur) return false;
    const next = Object.assign({}, cur);
    if (patch.date != null)   next.date = patch.date;
    if (patch.amount != null) next.amount = patch.amount;
    if (patch.notes != null)  next.notes = patch.notes;
    // A category change is a TYPE change: the mapping derives the category back from it, so the two
    // can never disagree. `_typeForCashCategory` returns '' for a bill category, leaving type alone.
    if (patch.category != null) {
      const t = this._typeForCashCategory(patch.category);
      if (t) next.type = t;
    }
    return await S.HubCashOutflows._writeCashRow(next);
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

  /* ⛔ `_monthsBetween` WAS DELETED HERE (2026-08-06). Its only caller was the edit modal's RESUME
     branch: turning a paused series back on, it converted every month the bill had been switched off
     into `skip_months` so the catch-up would not back-fill them. There is no checkbox to pause with,
     no resume, and no catch-up, so it had nothing left to answer. `verify-no-retired-code` is what
     found it — the fixpoint working, not a judgement call. */

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
    /* ⛔⛔⛔ THE SAME-DAY TIEBREAK, AND THE HISTORY LOG NEVER HAD IT UNTIL NOW.
       This sorted by DATE ALONE, so rows sharing a day came out in whatever order the records
       happened to sit in — and that visibly reshuffled after a re-seed. The month cards fixed
       exactly this and kept the fix to themselves; when item T5 deleted `_monthCardHtml` the log
       became the only renderer and inherited the original defect.
       ⭐ FOUND BY A HARNESS THROWING, NOT BY READING THE DIFF: `verify-opex-series-chrome` W5-W7
       lifted the month card to prove "biggest first within a day, stable however the records are
       stored". Chasing that throw is what showed the property had no home left — which is [[the-loop]]
       #123's whole point, that a retirement drops coverage unless every assertion is checked for
       something that survives.
       ⚠ THE COMPARATOR IS THE SHIPPED ONE, lifted from the deleted card rather than re-invented, so
       the order an operator already knows does not change: newest day first, then biggest amount,
       then category to settle a true tie. */
    recs.sort((a, b) => (b.date || '').localeCompare(a.date || '')
      || ((parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0))
      || String(a.category || '').localeCompare(String(b.category || '')));
    return recs;
  },

  // ── Main render ────────────────────────────────────────────────────────
  renderMain() {
    this._view = 'current';
    /* ⭐⭐⭐ BUILD PIECES 3 + 4 — THE PAGE KYLE SPECIFIED. He rejected what build order D produced:
       *"we aren't using chips stacked on chips to sort this down in the middle of the page... the
       entire money out page is a big mess."* What replaced it, in his words:
         · STANDARD TABS like the rest of the app — Bills · Cash Outflows · All Money Out
         · *"the stat box is basically a summary total of each of the by category cards"*
         · *"add Last month total to stat card"*
         · *"neither moves with chips"* — the stat card and By Category follow the TAB
         · *"keep chips as they are above the history card and export pdf same row as chips aligned
           rightside"*, and *"export only exports what the history chips is selected on"*
         · *"the history card columns need to be aligned with the category card columns"*
         · *"no repeat... no recurring"* — the operator drops a file or types it in

       ⛔⛔ THE STAT BOX NOW FOLLOWS THE TAB, AND THE COMMENT THAT USED TO FORBID THAT WAS RIGHT AT
       THE TIME. It read: *"they feed the CURRENT tab's headline, and the chip only renders on the
       HISTORY tab — so a chip set on one tab silently moved the other tab's numbers."* That whole
       argument rested on there being two tabs with one chip between them. There is one page with
       one tab bar now, so the tab IS the page's context and a stat box that ignores it is the
       contradiction: measured on the deployed build, the Cash Outflows chip showed $5,455.83 of
       BILLS above a By Category card of draws and loans. A reason that expires has to be re-derived,
       not inherited ([[the-loop]] #137/#138).
       ⭐ AND THE OPEN COPY QUESTION IT CARRIED IS ANSWERED BY THE SAME CHANGE. "This Month" on a page
       headed Money Out was ambiguous because the figure was bills-only whatever the page said. Each
       tab's stat card now means that tab's money, so the label is true on all three.

       ⛔ THE FIGURES ARE THE BY CATEGORY CARD'S COLUMN TOTALS, not a second computation of the same
       quantity. `_byCatRows()` is the one walk; the card renders it and the stat card sums it. Two
       computations of one number is the $108,820.04-under-$69,820.04 shape, and pinning either
       figure instead of the EQUALITY is what let it happen ([[the-loop]] #54/#109). */
    this.container.innerHTML = '<div class="screen">' + this._tabBarHtml() + this._renderCurrent() + this._renderHistory() + '</div>';
    /* ⭐⭐ BUILD ORDER B — THE WAY TO THE ONE DOOR. This screen no longer takes an entry, so without
       a control it is a page the operator has always used to log a bill with nothing on it: the
       feature would read as LOST rather than moved ([[the-loop]] #106 — a control that tells the
       user nothing is worse than no control, and a screen with no way forward is its worst case).
       ⛔ A BUTTON, NOT A SENTENCE, AND THAT IS NOT A STYLE CHOICE. `verify-design-code` ratchets
       RULE 2b card prose and it only ever goes DOWN, so an explainer paragraph here is a design
       change Kyle walks one at a time. The hub topbar actions slot already exists for exactly this
       and this line was already calling it with an empty string.
       ⚠ WIRED AGAINST `document`, NOT `this.container` — the topbar is the hub's, outside our mount.
       `hub-bar-cop-audit` does the same thing the same way. */
    if (App.setHubTopbarActions) {
      App.setHubTopbarActions('<button class="btn btn-ghost btn-sm" id="oex-go-enter">Enter Money Out</button>');
      document.getElementById('oex-go-enter')?.addEventListener('click', () => this._goEnterMoneyOut());
    }
    this._wireTabs();
    this._wireCurrent();
    // ⛔ BOTH, or every control the history half draws — the range chips, Show Older, Export — is on
    // screen and dead. One page means one wiring pass over all of it.
    this._wireHistory();
  },

  /* ⭐ THE TAB BAR. The app's own `ch-tabs` / `ch-tab` markup, which is what vendor-tracker's three
     tabs use and what Kyle named as the reference. The labels come from `_kindChipOpts()` so the bar
     and every other reader of that list cannot drift apart. */
  _tabBarHtml() {
    return '<div class="ch-tabs no-print">'
      + this._kindChipOpts().map(o => '<button class="ch-tab' + (this._filterKind === o.v ? ' on' : '')
          + '" data-motab="' + esc(o.v) + '">' + esc(o.label) + '</button>').join('')
      + '</div>';
  },
  _wireTabs() {
    this.container.querySelectorAll('.ch-tab[data-motab]').forEach(b =>
      b.addEventListener('click', () => {
        this._filterKind = b.dataset.motab;
        /* ⚠ THE HISTORY WINDOW RESETS ITS PAGE, NOT ITS RANGE. vendor-tracker's own rule is that the
           window carries across tabs, so an operator who set "Last 12 Months" keeps it. What must
           NOT carry is the Show Older count: 200 rows of All Money Out then one click to Bills left
           a page size belonging to a set that no longer exists. */
        this._histShown = 0;
        this._rerender();
      }));
  },

  /* ⭐⭐ ONE COLUMN GEOMETRY FOR BOTH TABLES. Kyle: *"the history card columns need to be aligned
     with the category card columns.. so vendor column aligns under last month and amount column
     aligns under YTD."* They already had five columns each and DIFFERENT widths
     (22/19.5/19.5/19.5/19.5 against 22/26/18/18/16), so nothing lined up.
     ⛔ A METHOD, NOT A SIBLING CONSTANT. Two members need it, so it cannot be folded into either —
     and a data property is invisible to every slicer in the harness suite, which this file has paid
     for twice ([[the-loop]] #16/#120). `_rangeChipOpts` is a method for the identical reason. */
  _colGroupHtml() {
    return '<colgroup><col style="width:22%"><col style="width:19.5%"><col style="width:19.5%">'
      + '<col style="width:19.5%"><col style="width:19.5%"></colgroup>';
  },

  /* ⛔ IT NAMES THE STEP. `hub-books-home._openStep` defaults to "the first step not done", so a bar
     that has already ticked Money Out would be dropped on Weeks or the P&L — the operator presses
     "Enter Money Out" and lands somewhere else, which is the shape S330b's guard-loop was made of.
     Setting it before `open()` is the destination's own contract: the field is only defaulted when
     it is null ([[the-loop]] #102 — read the contract, the existing callers are the spec). */
  _goEnterMoneyOut() {
    const BH = S.HubBooksHome;
    if (!BH) return;
    BH._openStep = 'expenses';
    BH.open();
  },

  /* ⛔ `renderHistory(mount)` AND `_historyStats()` WERE DELETED HERE, with the Expense History
     route (2026-08-06). Build order D merged this screen's three sidebar rows into one Money Out
     page, which left that page reachable by nothing: no nav row emits its action, and BOTH dispatch
     tables are fed from the rendered sidebar, so removing the row removed the only source of the
     action. `S.HubExpenseHistory`, the help topic and both action-map entries went at the same time.
     ⭐ `_historyStats` was not on the item's list — it was orphaned by the deletion. Its only call
     site was inside `renderHistory`, and D had already ruled it OFF the merged page deliberately:
     two stat boxes for one quantity is the $108,820.04-under-$69,820.04 shape. The bills-only
     figures it printed are still computed by `_sumMonth` / `_sumYTD`, which the merged page draws.
     ⛔ NOT TO BE CONFUSED WITH `_renderHistory` (underscore), one character apart and very much
     alive — it draws the log on the merged page. `verify-expense-history-route-gone.js` block D is
     the tripwire that stops a sweep for "renderHistory" taking both. */
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
  /* Which mode a given surface is in. The STEP (inline) defaults to import; the full screen keeps
     its own `_entryMode`. Every reader goes through here so the two can never drift. */
  _entryModeFor(inline) {
    if (!inline) return this._entryMode;
    return this._stepMode === 'manual' ? 'manual' : 'import';
  },

  /* ⛔⛔⛔ THE HANDOVER, AND THE ONE THING IT MUST NOT DO IS REBUILD THE MAPPER.
     `CSVMapper.mount()` opens with `container.innerHTML = <drop zone>`. So escalating by
     re-rendering and re-mounting would throw the operator's parsed file away and put them back on
     an empty drop zone — work lost, silently, which is the expensive class of defect here.
     ⭐ SO THE LIVE NODE IS DETACHED AND CARRIED. `_wireCurrent` re-attaches that same element into
     the takeover's slot, listeners and parsed rows intact, and deliberately does NOT re-mount.
     Pinned by `verify-money-out-one-door` H4/H5.
     ⚠ `onState('map')` is CSVMapper's existing hook — it fires the moment a file is parsed and the
     mapper replaces the drop zone. No new hook was needed; four other screens already use it. */
  _onImportState(state) {
    if (state !== 'map') return;
    // Only from the STEP, and only while it is still inline — never re-enter once taken over.
    if (this._view !== 'moneyout' || this.moneyOutTakeover()) return;
    const node = document.getElementById('oexa-csv');
    if (!node) return;
    /* ⛔⛔⛔ CARRY THE ACTIONS SLOT TOO, OR THE IMPORT BUTTON IS GONE AND THE FILE IS A DEAD END.
       CSVMapper renders its confirm button into a SEPARATE element — `actionsEl: '#oexa-imp-actions'`
       — not into `#oexa-csv`. The first version of this handover carried only the mapper, so the
       re-render destroyed the node holding Import and painted a fresh empty one: the operator
       dropped a file, got the column mapper, and had nothing but Cancel. Found by Kyle on the live
       build; H4/H5 pinned the mapper node and never asked about the button beside it.
       ⚠ THE LESSON, and it is the same one twice in two days: when you move state across a rebuild,
       enumerate EVERY node the component owns, not the one you were thinking about. */
    const acts = document.getElementById('oexa-imp-actions');
    this._carryCsv = node;
    this._carryActs = acts || null;
    node.remove();
    if (acts) acts.remove();
    this._moTakeover = true;
    this._rerenderHost();
  },

  moneyOutTakeover() {
    /* ⚠ READS THE FIELD, NOT THE RESOLVER. Calling `_entryModeFor` here broke three hand-built stubs
       at once with "not a function" — integrity #13, and a throw prints no summary at all. The
       question is the same either way (is the step still in import?) and `_stepMode` answers it
       without adding a dependency to every fixture that lifts this one member. */
    return !!this._moTakeover && (this._stepMode !== 'manual' || !!this._expenseReview);
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
  /* ⚠ THE `history` BRANCH WAS DELETED HERE with the Expense History route. It looked like a live
     caller of `renderHistory` and it never was: the ONLY writer of `_view = 'history'` sat inside
     `renderHistory` itself, so the branch could only be reached by code that was already dead — a
     fixpoint, not a single pass ([[the-loop]] #63). Two views remain and both are live. */
  _rerender() {
    if (this._view === 'moneyout') return this.renderMoneyOut();
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

  /* ⛔ THE NEXT-MONTH KEY HELPER WAS DELETED HERE (item T5). Its only caller built the Next Month
     card, which Kyle removed at build pieces 3+4 — generator-era furniture for a generator that no
     longer exists. Dead by fixpoint, exactly like the card builder above it. */

  // True when this entry's recurring series ends within ~2 months (or has ended).

  /* The series a row belongs to, or null. An orphaned child — one whose parent was deleted before
     _delete learned to detach them (S226h) — is not part of any series, and treating it as one is
     what put a Stop button on it that returns before it even asks for confirmation. Existing
     accounts can already hold these rows, so the display has to answer this too, not just the
     delete path that stops new ones being made. */

  /* The series a row came from, whether or not it is still running. _seriesOf answers the narrower
     question ("is there a LIVE series here"), because that is what decides the row's buttons — this
     one answers "did this row come from a recurring bill at all", which is what its LABEL has to say.
     A row with neither flag nor parent was never part of a series. */

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
    /* ⛔⛔ NO RECURRING CHROME ON A LEDGER ROW (2026-08-06). This member had three action branches:
       `minimal` (Edit + Delete), a series branch (Renew + Stop + Edit + Delete) and an else branch
       (Repeat + Edit + Delete) — plus a "recurring" tag in the category cell. Its ONLY caller has
       always passed `{minimal: true}`, so Renew, Stop and Repeat were never rendered by anything;
       walked live across 57 Bills rows, 5 real series and a planted legacy cash row, and every one
       showed Edit and Delete alone. The tag was the only part an operator ever saw, and it described
       a stored flag nothing writes any more.
       Kyle, 2026-08-06: *"no recurring tracking, no stopping recurring... get rid of everything that
       was part of the old process."* Recurrence is DERIVED off the ledger now
       (`recurringBills` / `deriveRecurringOutflows`); there is nothing on a row for an operator to
       manage, so there is nothing to render. The branches and the tag are gone, and with them the
       last callers of `S.HubCashOutflows.stop` and `.repeat`. */
    const edit = '<button class="btn btn-ghost btn-sm oex-edit" data-id="' + esc(r.id) + '">Edit</button>';
    const del  = '<button class="btn btn-danger btn-sm oex-del" data-id="' + esc(r.id) + '">Delete</button>';
    const actions = edit + del;
    return '<tr>'
      + '<td data-label="Date" style="color:var(--t1);white-space:nowrap;">' + esc(r.date || '') + '</td>'
      + '<td style="color:var(--t2);">' + esc(r.category || '') + '</td>'
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
  /* ⛔ `_monthCardHtml` WAS DELETED HERE (item T5). It built the This Month / Next Month
     cards, and Kyle removed those at build pieces 3+4 — generator-era furniture for a generator
     that no longer exists. Nothing else ever called it, so it went with its own render. */

  // ── The top of the page: the import banner, the tab's stat card, and the two month notes ──
  _renderCurrent() {
    const mk = this._currentMonthKey();
    /* ⭐⭐ THE STAT CARD IS BUILT FROM THE BY CATEGORY WALK, NOT FROM A SECOND COMPUTATION. It used to
       be assembled here out of `_sumMonth` / `_sumYTD` and a MONTH-basis ratio, which meant two
       independent answers to "what did this page's money add up to" — one of them bills-only for
       ever, whatever tab the operator was on. See `_statCardHtml`.
       ⚠ THE S226d LESSON SURVIVES THE MOVE, and it is worth restating because the old note lived
       here: a ratio needs one period on BOTH sides. The figure divided a whole booked month by the
       weeks confirmed so far and read 35.0% against a truth of 8.7%. Its replacement is the % column
       total, and that column stops at the last COMPLETE month on both sides — so the fix is
       inherited rather than re-made. */
    const statsCard = this._statCardHtml();

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

    /* ⛔⛔⛔ BUILD ORDER B — THE ENTRY CARD IS GONE FROM THIS SCREEN. THERE IS ONE PLACE TO ENTER
       MONEY OUT AND IT IS THE CLOSE THE BOOKS STEP. Kyle, seeing what had been built: *"why does
       money out have a form or drop? ... isn't that what we built on the #1 spot in close the
       books? ... we aren't having two drop places for the same thing a click away from each other."*
       The plan said one door from the start; `_addCardHtml` shipped in two places because the card
       was already here and keeping it felt like losing nothing. That sentence is the tell, and
       [[one-ledger-rebuild]] records the identical slip on the maintenance Repair Cost box one
       phase earlier.
       ⭐ WHAT THIS SCREEN IS NOW: read-only history for every kind of money out, with Edit and
       Delete on every row. Read-only means no ENTRY POINT, never no correction path — a record an
       operator cannot re-open is a defect whether or not anything is arithmetically wrong.
       ⚠ THE WAY TO THE DOOR IS IN THE TOPBAR, NOT IN A SENTENCE HERE. See `renderMain`. */
    /* ⛔⛔⛔ BOTH MONTH CARDS ARE GONE, AND SO IS EVERYTHING THAT ONLY EXISTED TO FILL THEM.
       Kyle: *"no repeat... the user drop files or manually enters .. no repeat.. no recuring.."*
       They were generator-era furniture: This Month / Next Month, split Recurring against Variable,
       with an "Expected" list of rows Bar Cop was about to mint. Nothing mints a row any more
       (Phase 3), so a card promising next month's bills is a forecast wearing a ledger's clothes —
       the same reasoning that killed the Expected CARD, applied to the cards that fed it.
       ⚠ MEASURED ON THE DEPLOYED BUILD BEFORE THE CUT, and it is why he called the page a mess:
       under EVERY chip, identically, 7 Repeat buttons · 5 Expected rows · 2 Variable tables · 8 uses
       of "recurring" · 2 export buttons. None of it followed the chip, so choosing Cash Outflows
       showed seven Repeat buttons belonging to bills.
       ⭐ WHAT SURVIVES, AND IT IS THE PART THAT WAS DOING WORK: the import banner, the stat card and
       the two notes. `_monthNotes` still answers "already logged" and "looks logged twice" — those
       are about money ALREADY ON FILE, not about a schedule, and they are the operator's only
       warning that one bill is on the books twice. */
    return this._importBannerHtml() + statsCard + coveredNote;
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
    /* ⚠ THE NOTE ABOVE USED TO SAY THE STEP FORCES MANUAL, and that was right until 2026-08-07:
       it stopped an operator who left the FULL screen in import mode arriving at Close The Books to
       a drop zone they never asked for. The step has its own mode now, so nothing carries over — and
       Kyle's call is that the drop zone IS what step 1 should open on. */
    /* ⛔ THREE SURFACES, THREE ANSWERS, AND THE TAKEOVER IS NOT THE STEP. My first version asked the
       resolver for all of them, so a step left in MANUAL made the takeover render the typed form —
       and the takeover only exists because a file was already dropped. It is import by definition.
         · step        (inline + stepBody) — its own mode, default import
         · takeover    (inline, no stepBody) — always import; `_expenseReview` handles the confirm
         · full screen (not inline) — its own `_entryMode`, untouched by any of this
       Caught by `verify-money-out-step` I0b/I2 before it shipped. */
    const mode = inline ? (stepBody ? this._entryModeFor(true) : 'import') : this._entryMode;
    const importMode = mode === 'import';
    /* Same shape sc-dashboard uses for its step lines, so the two steps read as one product. */
    const intro = (t) => '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin:12px 0;">' + t + '</div>';
    const curMode = mode;
    const segBtn = (mode, label) => '<button type="button" class="btn btn-sm oexa-mode" data-mode="' + mode + '" style="'
      + (curMode === mode ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;' : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    /* ⭐ IMPORT FILE FIRST (Kyle, 2026-08-07): *"step 1 needs import file to become the 1st option
       and enter manually the second option.. basically like the import pos weeks sales in shift is
       setup."* The reference is `sc-dashboard._salesSeg`, which renders `import` then `manual`, and
       the two are pinned AGAINST EACH OTHER by `verify-money-out-one-door` G4 — so if the sales step
       is ever reordered, this one is asked the same question rather than quietly drifting.
       ⚠ ORDER ONLY. Which button is LIT still follows `_entryMode`, and on the Close The Books step
       the body stays the manual form because there Import File is a DOOR to a takeover, not an
       inline mode (see the note above and at the `oexa-mode` handler). The sales step toggles two
       inline bodies; this one does not, and that difference is deliberate.
       ⚠ THIS RENDERS ON BOTH SURFACES the add card appears on — the cockpit step AND the Money Out
       full-screen add form. One card, one order; they are the same control and must not disagree. */
    const segToggle = '<div class="seg-toggle">' + segBtn('import', 'Import File') + segBtn('manual', 'Enter Manually') + '</div>';

    let bodyInner, addButtons = '';
    if (importMode) {
      /* ⚠ NO SEG TOGGLE IN THE TAKEOVER, AND NO HEADING. The toggle lives on the page you came
         from; here the way back is Cancel, exactly as `ic-product-setup.importPanelHTML` does it.
         CSVMapper already prints its own "Drop your expenses file here" and its own column-mapping
         heading, so anything we add over the top says the same thing twice. */
      /* ⛔⛔ THE STEP KEEPS ITS TOGGLE; ONLY THE TAKEOVER DROPS IT (2026-08-07).
         This read `inline ? '' : segToggle`, which was right when `inline` meant "the takeover" —
         there the way back is Cancel, exactly as `ic-product-setup.importPanelHTML` does it. Now the
         STEP is inline too and renders the drop zone, so that test hid both chips and left the
         operator on a drop zone with no way to reach Enter Manually. Caught by
         `verify-money-out-one-door` H3 before it shipped. `stepBody` is what separates the two. */
      /* ⭐ CHIPS → TEXT → DROP, copied from `sc-dashboard.workspace('import')`. The line sits UNDER
         the chips and belongs to the MODE, so switching to Enter Manually swaps it for one about
         typing rather than dropping. */
      bodyInner = (inline && !stepBody ? '' : segToggle)
        + (stepBody ? intro('One file, the whole month. Drop your bank or card statement and Bar Cop reads every line off it: bills and cash outflows both. Re-importing replaces rows already in.') : '')
        + '<div id="oexa-csv"></div>';
      /* ⛔ NO CANCEL IN THE STEP (Kyle, 2026-08-07). Cancel is the way OUT of the takeover, which is
         the only place there is anything to back out of. In the step the chips are the way out, and
         a Cancel under an inline drop zone asks the operator to cancel something they have not
         started. `sc-dashboard`'s sales step has no Cancel either. */
      /* ⛔⛔ ONE CANCEL, AND IT LIVES BESIDE IMPORT (Kyle, 2026-08-07): *"don't need two cancel
         buttons... should be import button and right next to it the cancel button."* Ours used to
         render as a lone button ABOVE the mapper while CSVMapper drew its own beside Import — two
         Cancels, doing different things. The mapper's is now the only one, and `onCancel` below
         gives it OUR meaning: leave the takeover, do not just reset the file. */
      addButtons = '<div id="oexa-imp-actions" style="margin:0 0 ' + (inline ? '0' : '24px') + ';"></div>';
    } else {
      bodyInner = segToggle
        + (stepBody ? intro('No statement to drop? Key it in by hand. Pick the log type first: an operating expense lands on your income statement, a cash outflow does not. Then the amount, and save.') : '')
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
        /* ⛔ `addCustom: false` — THE FIVE ARE A CLOSED SET, NOT A LIST TO EXTEND. They map to the
           stored outflow `type`, so a typed-in kind has no type to become. Measured on the live app
           before this flag existed: "Equipment Lease" saved `type: ''` and came back as "Other Cash
           Outflow" — the name gone, the record degraded. */
        +   '<div class="f" id="oexa-kind-wrap" style="width:230px;display:none;"><label>Kind</label>' + App.customSelect({ id: 'oexa-kind', builtin: this.CASH_ONLY_CATEGORIES.map(c => c.name), blank: true, blankLabel: 'Select kind...', addCustom: false }) + '</div>'
        // ⚠ VENDOR IS AN EXPENSE FIELD. A draw has no vendor, and leaving the box on the cash branch
        // would collect something the outflow record has nowhere to put — silent loss on save.
        +   '<div class="f" id="oexa-vendor-wrap" style="width:240px;display:none;"><label>Vendor</label><input type="text" id="oexa-vendor" placeholder="Who did you pay"/></div>'
        +   '<div class="f" style="width:140px;"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="oexa-amount" step="0.01" min="0" placeholder="0.00"/></div></div>'
        + '</div>'
        /* ⭐⭐⭐ BUILD ORDER C — RECURRING IS A CASH-OUTFLOW CONTROL NOW, AND ONLY THAT. A BILL is
           recurring because it keeps happening: `deriveRecurringBills` reads it off the ledger and
           `recurringBills` stale-checks it, so a checkbox is a second source claiming the same fact
           and the operator has to keep it true by hand forever.
           ⛔⛔ IT IS GATED, NOT DELETED, AND THAT IS FORCED BY THE DATA. `deriveRecurringBills`
           reads `expenseRows()`, which excludes every cash row by construction — a recurring owner
           draw or loan payment is projected from its own parent and stores NOTHING
           ([[the-loop]] #51: `recurring` means two different things in the two stores). Deleting
           this for cash as well would empty months of the 13-week forecast with nothing replacing
           it, which is the silent direction. Bills lose it; cash keeps it.
           ⚠ THE WRAPPER IS WHAT `_applyLogType` GOVERNS, and it CLEARS on the way out — a bill that
           inherited a ticked box the operator could not see is the exact defect that function was
           written to prevent for the category picker. */
        /* ⛔⛔⛔ BUILD ORDER C2 — THE RECURRING BLOCK IS GONE FROM THIS FORM TOO. C removed it for
           BILLS on the argument that the ledger answers the question; `deriveRecurringOutflows`
           is what makes that true for cash as well, so the last reason to keep it here is gone.
           ⭐ Kyle's own argument closed it: the two-occurrence delay applies to bills identically,
           so keeping a cash checkbox for that reason was two standards. The full note and the
           $18,600 measurement are on `hub-cash-outflows`' add form.
           ⛔⛔ AND REMOVING IT FIXES A LIVE BREAK I SHIPPED IN C. The wrapper this block sat in was
           opened and never closed — one `</div>` for two divs — so it swallowed the notes field,
           the elsewhere notice, the error slot AND the Add Expense button. `_applyLogType` hides
           that wrapper whenever Log Type is Operating Expense, so on v109 picking Operating
           Expense made the Add button disappear. Measured, not reasoned. Block E of
           `verify-no-new-typed-series` is the structural pin that makes it unrepeatable. */
        + App.noteField({ id: 'oexa-notes', placeholder: 'Optional context for the bookkeeper' })
        /* ⛔ NO "THIS BELONGS SOMEWHERE ELSE" NOTICE. There used to be an `oexa-elsewhere` slot here
           that watched the vendor as they typed and told them an owner draw, a loan payment or a
           tax payment belonged on the Cash Outflows screen, with a Go There button to it.
           Kyle, 2026-08-06: *"they are manually choosing the log type between operating expense or
           cash outflow from the same form... that is their choice to log what they want, where they
           want... that entire prompt needs to be deleted."* He is right, and the notice had outlived
           its premise anyway: there IS no other place to send them. Cash Outflows is a TAB on this
           page over the same ledger, and Log Type on this very form is how the operator says which
           one it is. A prompt that second-guesses a choice the form just asked them to make is
           noise, and its button opened a screen that no longer should exist. */
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
        /* ⛔⛔⛔ NO CARD AROUND THE STEP'S DROP ZONE (Kyle, 2026-08-07): *"you have the drop file box
           and chips in a card inside the step 1 card... they should be directly on the step 1
           background."* He is right, and the manual branch beside this one was ALREADY flat — only
           import wrapped itself, so the two modes of the same step sat on different backgrounds.
           ⭐ COPIED FROM THE STEP HE NAMED, not invented: `sc-dashboard.workspace('import')` returns
           `seg + text + drop mount`, no card and no shell. A cockpit step IS the card; a second one
           inside it is a box inside a box.
           ⚠ THE TAKEOVER KEEPS ITS CARD — there it is the whole page, not a step body. `stepBody` is
           the same distinction that decides the toggle and the Cancel. */
        ? (importMode && !stepBody ? '<div class="card form-card">' + bodyInner + '</div>' + addButtons
                      : bodyInner + addButtons)
        : '<div class="card form-card">'
          + App.collapsibleCardTitle('oex-add', 'Add Expense')
          + '<div class="collapse-body">' + bodyInner + '</div>'
          + '</div>' + addButtons;

    return this._importBannerHtml() + addCard;
  },

  /* What the last import actually did. An expense import used to report NOTHING — not even a count —
     so rows it skipped (a credit, an unreadable amount, a missing date) simply were not there
     afterwards. A row the operator can see in their own file and cannot find in Bar Cop is what
     makes them stop trusting the total.

     ⛔⛔ ITS OWN MEMBER SINCE BUILD ORDER B, AND THE PIN IS WHAT FOUND WHY. This lived inside
     `_addCardHtml`, which was the only thing that consumed `_importMsg` — so the moment B took the
     entry card off this screen, an import finishing with `_view === 'current'` had nowhere to
     report. `_importRows` still writes a FULL account there for a call with no screen in front of
     it, and that account would have been computed and thrown away ([[the-loop]] #25).
     ⚠ ONE RENDER ONLY, and the clear stays here with the read: a message that survives a navigation
     is how the screen once greeted an operator days later with "1 expense imported." about a file
     they had already walked away from. */
  _importBannerHtml() {
    const imp = this._importMsg;
    this._importMsg = null;
    return imp
      ? '<div style="background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:6px;padding:11px 16px;margin:16px 0;font-size:12px;color:var(--t1);line-height:1.6;">'
        + esc(imp) + '</div>'
      : '';
  },

  _wireCurrent() {
    document.getElementById('oexa-save')?.addEventListener('click', () => this._saveAdd());
    /* `input`, not `change`: `change` on a text field waits for blur, so an operator who types the
       vendor and goes straight to the amount would not be told until they had left the field. */
    document.getElementById('oexa-clear')?.addEventListener('click', () => this._clearAdd());
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
      /* ⛔ FROM THE STEP THIS IS A MODE, NOT A DOOR (2026-08-07). It used to set `_moTakeover` and
         jump straight to the full-page importer. Now Import File shows the DROP ZONE in the step and
         the takeover waits until a file is actually parsed (`_onImportState`). */
      if (this._view === 'moneyout') { this._stepMode = b.dataset.mode; this._moTakeover = false; return this._rerenderHost(); }
      this._rerender();
    }));
    // The takeover's own way back, the same control ic-product-setup's import panel carries.
    /* ⚠ THE `#oexa-imp-cancel` HANDLER WENT WITH ITS BUTTON (2026-08-07). It was the second of two
       Cancels; the mapper's own is the only one now and `_mountImporter`'s `onCancel` carries this
       exact reset. A handler kept for an element nothing renders is dead code that reads as live. */
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
      // Put Back, from the Removed section. The exact inverse, and the reason Remove is safe to
      // press at all: nothing on this screen destroys anything until the button at the bottom.
      this.container.querySelectorAll('[data-confirm-restore]').forEach(b => b.addEventListener('click', () => {
        if (!this._expenseReview) return;
        delete this._expenseReview.removed[b.dataset.confirmRestore];
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
      /* The chosen type and name live on the review, not in the DOM, so a re-render cannot lose
         them — and the operator can tick, move, tick again without re-choosing.
         ⛔ ONE PLACE DECIDES WHICH BRANCH IS SHOWING, and the branch that is NOT in play is HIDDEN
         AND CLEARED — the same rule as `_applyLogType` on the manual form, for the same reason: a
         stale value left in a hidden control is how a Move To files a batch under a category the
         operator cannot see. */
      this.container.querySelector('#oex-rt-logtype')?.addEventListener('change', (e) => {
        const r = this._expenseReview;
        if (!r) return;
        r.moveType = e.target.value;
        r.moveCat = '';
        r.moveNote = '';
        const show = (id, on) => { const el = this.container.querySelector(id); if (el) el.style.display = on ? '' : 'none'; };
        const clear = (id) => { const el = this.container.querySelector(id); if (el) el.value = ''; };
        show('#oex-rt-cat-wrap', r.moveType === 'expense');
        show('#oex-rt-kind-wrap', r.moveType === 'cash');
        clear('#oex-rt-cat'); clear('#oex-rt-kind');
      });
      this.container.querySelector('#oex-rt-cat')?.addEventListener('change', (e) => {
        if (this._expenseReview) this._expenseReview.moveCat = e.target.value;
      });
      this.container.querySelector('#oex-rt-kind')?.addEventListener('change', (e) => {
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
      this.container.querySelector('[data-oexreview-back]')?.addEventListener('click', () => this._backFromExpenseReview());
    }
    App.wireCustomSelects(this.container);
    this.container.querySelector('.card-collapse-head')?.addEventListener('click', (e) => App.toggleCollapse(e.currentTarget));
    App.applyCollapsed(this.container);
    /* ⛔ THE SECOND EXPORT WENT WITH THE MONTH CARD IT BELONGED TO (pieces 3+4). Kyle: *"no two
       export buttons.. one export above the category that exports category and history."* This one
       exported the This Month card; there is one Export on the chip row now and it carries both
       cards. ⭐ ITS ONE LESSON MOVED RATHER THAN DYING WITH IT: the period goes in the PERIOD slot
       in words, not in `fileTag`, or `pdfFileName` fills the slot with today and the file saves as
       "Operating Expenses 2026-07 - 2026-07-31.pdf". The surviving export passes `range` for
       exactly that reason. */
    this._wireRows(this.container);
    // ⚠ NOT WHILE THE CONFIRM SCREEN IS UP: the drop zone is not on the page, so CSVMapper would be
    // mounting into an element that no longer exists.
    /* ⛔⛔ THE CARRIED NODE WINS OVER A FRESH MOUNT. If `_onImportState` handed us the live mapper,
       put THAT element back — calling `_mountImporter()` here would reset it to an empty drop zone
       and lose the operator's file, which is the whole hazard this path exists to avoid. */
    /* ⛔⛔⛔ THE CARRY LIVES FOR AS LONG AS THE TAKEOVER DOES — IT IS NOT CONSUMED BY ONE RE-ATTACH.
       This used to null both nodes the moment it put them back, which is fine for the ONE render the
       handover triggers and wrong for every render after it. Kyle found what that costs
       (2026-08-07): *"if you drop a file and it takes over page... and then you click and go to
       another page and come back.. the drop file has no cancel button so the only way to get back to
       the full page is to refresh it."* On the way back in there was nothing left to put back, so the
       `else` below mounted a FRESH drop zone under a page still claimed by the import — steps gone,
       and `#oexa-imp-actions` empty, because CSVMapper draws no buttons at all in its drop state.
       ⭐ MEASURED ON THE SHIPPED COCKPIT BEFORE COPYING IT: `sc-dashboard`'s `_ckCarry` is never
       nulled, which is why a round trip there comes back with "Found 7 rows", the column mapper and
       Import/Cancel all intact. Holding the reference is what makes the file survive; releasing the
       page was only ever the fallback for having lost it.
       ⚠ SCOPED TO THE VIEW IT BELONGS TO. `_wireCurrent` also serves the full Operating Expenses
       screen, and a held node would otherwise be moved into THAT screen's drop zone the next time it
       painted in import mode — a file dropped on Close The Books turning up on a different page.
       ⚠ AND THE VIEW TEST IS THE ONLY ONE NEEDED. My first version also asked `moneyOutTakeover()`,
       which reads as prudence and is unreachable: every path that ends a takeover drops both nodes in
       the same breath, so a held carry already implies a live takeover. A mutation removing it broke
       nothing, which is the fixture saying the condition does no work ([[the-loop]] #20 — when a fix
       makes a state unreachable, assert the unreachability rather than guarding it twice). Block F
       is that assertion. */
    if (this._carryCsv && this._view === 'moneyout') {
      /* ⛔ BOTH NODES, OR THE IMPORT BUTTON DOES NOT COME ACROSS. `#oexa-csv` holds the mapper;
         `#oexa-imp-actions` holds the button that commits it. Carrying one and rebuilding the other
         is what left a dropped file with nothing but Cancel. See `_onImportState`. */
      const put = (live, sel) => { if (!live) return;
        const slot = this.container.querySelector(sel);
        if (slot && slot.parentNode) slot.parentNode.replaceChild(live, slot); };
      put(this._carryCsv, '#oexa-csv');
      put(this._carryActs, '#oexa-imp-actions');
      /* ⚠ NOT CLEARED HERE. Every path that ENDS the takeover drops them together with the flag —
         Cancel, Start Over and a landed import — so "taken over with nothing to put back" is
         unreachable rather than guarded. `verify-money-out-takeover.js` block F walks every exit and
         asserts it, which is the honest shape when a fix makes a state impossible ([[the-loop]] #20). */
    } else if (this._entryModeFor(this._view === 'moneyout') === 'import' && !this._expenseReview) {
      this._mountImporter();
    }
  },

  _mountImporter() {
    const el = document.getElementById('oexa-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      // ⚠ "expenses" named half of what this door takes; a bank statement carries both.
      dropTitle: 'Drop your bank or card statement here',
      /* ⛔ A7 — THE "import as Other" SENTENCE IS GONE, AND IT HAD BEEN FALSE SINCE ITEM 15. That
         fallback was deleted on purpose: 'Other' is a category the operator PICKS, which Books
         prints and Schedule C deducts on 27a, so a row Bar Cop could not read and a row they chose
         were the same record. An unplaceable row now carries NO category and is held off the P&L
         until somebody sorts it. Copy outliving the feature it describes ([[the-loop]] #61) — and
         this one was worse than stale, because it told the operator not to bother looking. */
      dropSub: 'Needs columns for date and amount; category, vendor, and notes come in if your file has them.',
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
      onState: st => this._onImportState(st),
      /* Cancel LEAVES the takeover. Same reset the old `#oexa-imp-cancel` did, in the one place
         the operator now sees a Cancel at all. */
      onCancel: () => {
        this._expenseReview = null; this._stepMode = null;
        this._carryCsv = null; this._carryActs = null;
        this._entryMode = 'manual'; this._moTakeover = false;
        this._rerenderHost();
      },
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

  /* ⭐⭐⭐ A4 — THE BANK SUFFIX, AND IT IS THE OPEN `_vendorKey` QUESTION ANSWERED BY A REAL FILE.
     Measured on a Chase export dropped on the live demo: the seed knows `Austin Energy`, the bank
     writes `AUSTIN ENERGY UTILITY PMT`, and `_vendorKey` compares them as strings, so NOTHING
     matched. Same for ALSCO, SYSCO and TEXAS MUTUAL — five of five expense rows landed unsorted on
     a file whose vendors the operator had already categorised. It is not a trailing store number,
     it is a SUFFIX, and an equality test cannot see past one.

     ⛔ THE PLURAL IS THE OTHER HALF AND CONTAINMENT ALONE DOES NOT REACH IT. The operator's vendor
     list says `Sysco Foods`; the bank says `SYSCO FOOD SERVICES`. Neither string contains the
     other and neither token set contains the other — {sysco, foods} is not inside
     {sysco, food, services}. Only singularising both sides puts them together.
     ⚠ SO THE TWO RULES SHIP TOGETHER, and V7 is the assertion that says so: half of this is not a
     fix, it is a fix for Austin Energy that still misses the distributor. */
  _singular(w) {
    const s = String(w == null ? '' : w);
    // "utilities" -> "utility", "supplies" -> "supply". The rule that makes UTILITY meet Utilities.
    if (/ies$/.test(s) && s.length > 4) return s.slice(0, -3) + 'y';
    // ⛔ "business" and "express" are ordinary words in a vendor name, not plurals.
    if (/ss$/.test(s)) return s;
    /* ⛔ AND NOTHING SHORTER THAN FOUR IS TOUCHED. `gas` must not become `ga`: Kyle named GAS, ADS
       and INS as real business words, and a stemmer that chews them is a fragment match arriving
       through the back door ([[the-loop]] #26). */
    if (/s$/.test(s) && s.length > 3) return s.slice(0, -1);
    return s;
  },
  // One vendor name as comparable whole words. Punctuation is not the question; "Ben E. Keith Co."
  // and "BEN E KEITH CO" are the same four tokens.
  _vendorTokens(n) {
    return String(n == null ? '' : n).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      .split(' ').filter(Boolean).map(t => this._singular(t));
  },
  /* ⭐ ONE NAME CONTAINS THE OTHER, AS WHOLE TOKENS, IN EITHER DIRECTION.
     ⛔ TOKENS, NEVER SUBSTRINGS. `indexOf` would match KEITHLEY against Keith and SYSCOM against
     Sysco — the fragment class this codebase has been bitten by three times.
     ⛔ AND THE SHORTER NAME NEEDS FOUR LETTERS OF ITS OWN. A vendor the operator saved as "A" would
     otherwise be inside every name in the file, which is worse than no match at all: it files real
     money under a stranger's category. */
  _vendorMatches(a, b) {
    const A = this._vendorTokens(a), B = this._vendorTokens(b);
    if (!A.length || !B.length) return false;
    const small = A.length <= B.length ? A : B, big = A.length <= B.length ? B : A;
    if (small.join('').length < 4) return false;
    const have = {};
    big.forEach(t => { have[t] = true; });
    return small.every(t => !!have[t]);
  },

  /* ⭐⭐⭐ A3 — READ A CATEGORY WORD OUT OF THE VENDOR NAME (Kyle: *"if the name has a category word
     in it.. shouldn't we be able to sort that automatically?"*). `AUSTIN ENERGY UTILITY PMT`
     contains UTILITY. This is the DAY-ONE half: A4 needs a history to learn from, and a bar
     dropping its first statement has none.

     ⛔⛔ WHOLE WORDS ONLY, AND EVERY WORD CHECKED AGAINST "COULD THIS BE SOMEBODY'S ACTUAL NAME"
     ([[the-loop]] #26 — a name vocabulary has eaten a real person three times). INSURANCE yes;
     INS no (Instacart, Insight, Installation). GAS no (gastropub). ADS no. RENT no (Rent-A-Center).
     ⭐ THE FLOOR DOES THAT WORK STRUCTURALLY RATHER THAN BY MY JUDGEMENT: a derived word must be at
     least FIVE letters, which removes ins / gas / ads / rent / tax / bank / card / fee / 3rd on its
     own, from any category the operator adds later as well as from the eleven built in. A hand-kept
     ban list would only ever hold the words I thought of.
     ⛔ AND A STOP LIST FOR THE LONG ONES THAT ARE STILL NOT ABOUT THE CATEGORY: `other` is a
     category the operator PICKS and guessing it is the exact defect item 15 closed; `party` comes
     out of "3rd-Party" and a bar buys from Party City; `credit` would call a card payoff a bank
     fee; `service` would type ALSCO LINEN SERVICE off a category named "Professional Services".

     ⭐ IT IS A SUGGESTION IN A REVIEW, NOT A VERDICT, which is what makes it safe at all: the
     operator sees the section it landed in and moves it before a row is written. A wrong guess
     costs one dropdown; no guess costs sorting a whole bank month by hand.
     ⚠ AND IT IS THE WEAKEST OF THE FOUR SOURCES — see `_buildExpenseRows`. Anything the operator
     said themselves outranks it. */
  _categoryWordIndex() {
    /* ⚠ FOLDED IN, NOT A SIBLING CONSTANT. A data property beside a method is invisible to every
       slicer in the harness suite and this file has already paid for that twice
       ([[the-loop]] #16/#120). */
    /* ⭐⭐ `supply` AND `platform` WERE ADDED BY THE REAL-NAMES CONTROL, BEFORE THIS SHIPPED, and
       both are the same shape: a word that reads like a category and is a TRADE word first. Supply
       is what a bar's food and smallwares vendors are called — Restaurant Supply, Chef Supply,
       Gastropub Supply — and almost never a cleaning company. Platform is a brewery before it is a
       delivery app, and a real delivery commission is already held back by BRAND in `_elsewhereFor`,
       so the word bought nothing and risked typing a beer invoice as a platform fee. That leaves
       "3rd-Party Platform Fees" contributing no words at all, which is correct. */
    const STOP = {
      other: 1, party: 1, credit: 1, service: 1, general: 1, expense: 1, payment: 1, charge: 1,
      monthly: 1, weekly: 1, annual: 1, total: 1, business: 1, company: 1, group: 1, center: 1,
      store: 1, account: 1, thing: 1, miscellaneou: 1, misc: 1, supply: 1, platform: 1
    };
    const idx = {};
    this.categoryList().forEach(c => {
      String(c).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
        .forEach(raw => {
          const w = this._singular(raw);
          if (w.length < 5 || STOP[w]) return;
          // First category to claim a word keeps it, so the answer cannot depend on iteration luck
          // the day two categories share one.
          if (idx[w] === undefined) idx[w] = c;
        });
    });
    return idx;
  },
  _categoryFromVendorWords(name) {
    /* ⭐⭐ THE FOUR DELIVERY BRANDS, TYPED RATHER THAN HELD BACK (build piece 2). `_elsewhereFor`
       used to excuse these rows from the import because the commission was typed weekly in Confirm
       the Week and importing it would have doubled it. It is not typed there any more, so the rule
       died with its source — and the brands moved HERE, where they place the row on the line Books
       already prints instead of leaving it blank for the operator to sort by hand.
       ⚠ THE SAME FOUR NAMES, NOT A WIDER LIST. Deliberately absent, exactly as before: `caviar` (a
       food a bar buys, and Caviar House is a supplier), `slice` (Slice of Life Pizza) and `seamless`
       (Seamless Gutters) — each a real business name before it is a platform ([[the-loop]] #26: a
       vocabulary that classifies a name has eaten a real one three times in this codebase).
       ⚠ IT SITS ABOVE THE WORD INDEX AND BELOW EVERYTHING ELSE. This is still the WEAKEST of the
       four sources in `_buildExpenseRows` — anything the operator said themselves outranks it — so
       a bar that files DoorDash somewhere else keeps its own answer from the next drop onward. */
    const t = ' ' + String(name == null ? '' : name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
    if (/ doordash | grubhub | ubereats | uber eats | postmates | delivery commission /.test(t)
        && this.categoryList().indexOf('3rd-Party Platform Fees') >= 0) return '3rd-Party Platform Fees';
    const idx = this._categoryWordIndex();
    const toks = this._vendorTokens(name);
    for (let i = 0; i < toks.length; i++) { if (idx[toks[i]] !== undefined) return idx[toks[i]]; }
    return '';
  },

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
    const answered = this.expenseRows().filter(r => r && String(r.category || '').trim());
    const newest = (list) => {
      if (!list.length) return '';
      const s = list.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      return String(s[s.length - 1].category).trim();
    };
    /* ⭐⭐ EXACT FIRST, THEN CONTAINMENT (A4). The two passes are not interchangeable and the order
       is the decision: with three logged vendors all containing `SYSCO FOOD SERVICES`, one of them
       IS that name. Merging the passes and taking newest-by-date across both lets a stale near
       match overrule the answer the operator gave about this exact spelling. */
    const exact = answered.filter(r => this._vendorKey(r.vendor) === k);
    if (exact.length) return newest(exact);
    return newest(answered.filter(r => this._vendorMatches(r.vendor, name)));
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
  /* ⭐⭐ WHEN DID THIS SERIES LAST ACTUALLY HAPPEN? Not "when was it set up", which is what the
     parent row's own date says. A series shows up in the ledger three ways and all three count:
     the parent itself, the children the old generator minted under `recurring_parent`, and any row
     for the same vendor that arrived by import or by hand. The newest of those is the answer.
     ⛔ A VENDORLESS TYPED BILL FALLS BACK TO ITS OWN LINE, never to a shared key. Three lines of
     fixed overhead entered with no vendor would otherwise all match each other and each other's
     dates — the collapsed-keyspace defect [[the-loop]] #50 records, which once read a $12,000 nut
     against a truth of $16,100. */
  _seriesLastDate(parent, rows) {
    if (!parent) return '';
    const own = String(parent.date || '').slice(0, 10);
    const all = Array.isArray(rows) ? rows : this.expenseRows();
    const k = this._vendorKey(parent.vendor);
    let best = own;
    all.forEach(r => {
      if (!r || !r.date) return;
      const mine = (r.id === parent.id) || (r.recurring_parent === parent.id)
        || (!!k && this._vendorKey(r.vendor) === k);
      if (!mine) return;
      const d = String(r.date).slice(0, 10);
      if (d > best) best = d;
    });
    return best;
  },

  recurringBills(rows) {
    const CYCLE_DAYS = { weekly: 7, fortnightly: 14, monthly: 31, quarterly: 92, annual: 366 };
    const decisions = this.recurringDecisions();
    const today = (App.todayLocal ? App.todayLocal() : '') || '';
    const dayNo = (ymd) => Date.UTC(parseInt(String(ymd).slice(0, 4), 10),
      parseInt(String(ymd).slice(5, 7), 10) - 1, parseInt(String(ymd).slice(8, 10), 10)) / 86400000;
    const now = dayNo(today);
    /* ⭐⭐⭐ THE CLOCK FOR STALENESS IS THE LEDGER, NOT TODAY — AND A HARNESS FIXTURE IS WHAT FOUND
       THAT (build order C). "This bill has not been paid for two cycles" and "this operator has not
       logged ANYTHING for two months" look identical against the wall clock, and they mean opposite
       things. Judged against today, an operator who types their rent and then goes quiet loses that
       rent out of break-even, the reserve target and Safe to Spend — the silent under-statement the
       typed branch exists to prevent, reintroduced by the very rule meant to tidy it up.
       ⭐ THE DISCRIMINATOR IS MEASURABLE AND HAS NO NUMBER IN IT ([[the-loop]] #28/#30 — state what
       the data can actually distinguish): a series is stale when the operator KEPT LOGGING and this
       bill stopped appearing. If the whole ledger is quiet, Bar Cop has no evidence either way and
       the safe reading is to keep what it was told.
       ⚠ ONE TEST FOR BOTH LISTS. Derived bills were judged against `today` and typed ones would have
       needed the same question answered a second way — two answers to one question is the drift this
       rebuild exists to end. It also takes the wall clock out of the comparison entirely, which ends
       a whole class of fixture shelf-life ([[the-loop]] #39/#100).
       ⚠ Capped at today so a bill dated into the FUTURE cannot push the reference past now and make
       everything else look stale. */
    const _rowsForClock = Array.isArray(rows) ? rows : this.expenseRows();
    let _ledgerLast = -Infinity;
    _rowsForClock.forEach(r => {
      if (!r || !r.date) return;
      const d = dayNo(String(r.date).slice(0, 10));
      if (!isNaN(d) && d > _ledgerLast) _ledgerLast = d;
    });
    if (!isFinite(_ledgerLast)) _ledgerLast = now;
    const ref = isNaN(now) ? _ledgerLast : Math.min(_ledgerLast, now);
    const _current = (lastDate, frequency) => {
      if (isNaN(ref)) return true;    // no readable clock at all: never drop on a bad reading
      const span = CYCLE_DAYS[frequency] || 31;
      return (ref - dayNo(lastDate)) <= span * 2;
    };
    const derived = this.deriveRecurringBills(rows).filter(b => {
      if (decisions[b.vendorKey] === 'no') return false;
      return _current(b.lastDate, b.frequency);
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
    /* ⭐⭐⭐ BUILD ORDER C — A TYPED SERIES IS STALE ON THE SAME TERMS AS A DERIVED ONE, AND THIS IS
       WHAT LETS THE STOP BUTTON GO. Until now staleness was applied to DERIVED bills only, so a
       typed parent projected forever unless `stopped_ym` was set — and the only thing that set it
       was Stop. Take the button away without this and every typed series on every live account runs
       to the end of time with no way to end it.
       ⛔⛔ IT READS THE SERIES, NOT THE RECORD, AND THAT DISTINCTION IS THE WHOLE THING. A typed
       parent's own `date` is the day the series was SET UP — the children carry the later dates and
       the filter above excludes them. Measured: rent paid through this month has a parent row six
       months old, so a staleness test on the record's own date kills live rent. `_seriesLastDate`
       asks when the series last actually happened.
       ⭐ MEASURED ON ONE REALISTIC ACCOUNT: today $6,336.19/month, which carries a $189 subscription
       last paid seven months ago that nobody pressed Stop on. Derived-only would read $5,042.19 and
       drop a $1,105 bill entered today — the quiet direction. This reads $6,147.19. */
    const typedAll = (Array.isArray(rows) ? rows : this.expenseRows()).filter(r =>
      r && r.recurring && !r.recurring_parent && r.date && !this.isCashOnlyCategory(r.category));
    const typed = typedAll.filter(r => _current(this._seriesLastDate(r, rows), r.frequency));
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
     ⚠ `where` is prose and `screen` is an `App.openScreen` id. NOT every destination has one: a
     transfer between the operator's own accounts is not tracked anywhere at all. Inventing an id
     for it would be a dead button ([[the-loop]] #106), so it carries `where` and no `screen`.
     ⚠ THIS NOTE USED TO NAME PLATFORM FEES AS THE OTHER EXAMPLE ("entered in the Confirm the Week
     popup"). That rule and that cell both went at build piece 2; the transfer is the only one left,
     and `verify-expense-import-review` P1e now proves the property on it. */
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
         holding a dollar.
         ⛔⛔ AND THE DELIVERY-FEE RULE HAS NOW GONE THE SAME WAY, FOR THE SAME REASON (build piece 2).
         It read "Delivery app fees have their own line" and sent the operator to *"the weekly
         Confirm the Week figures"*. That cell no longer exists — the commission is an ordinary
         `3rd-Party Platform Fees` row on this ledger — so the rule had become a sentence pointing at
         a deleted field, which is precisely the state the repairs rule was deleted for. Its whole
         justification was "that figure is still typed weekly, so importing it would double it", and
         the second half of that sentence stopped being true with the first.
         ⭐ THE BRANDS DID NOT GO, THEY MOVED: `_categoryFromVendorWords` now TYPES those four names
         as 3rd-Party Platform Fees instead of holding their rows back, so a DoorDash debit lands on
         the right line rather than landing blank. Same move item 12 made for repairs — the row goes
         from ELSEWHERE to BELONGS HERE, and the old assertion becomes its own control. */
    ];
    for (let i = 0; i < RULES.length; i++) {
      if (RULES[i][0].test(t)) return { note: RULES[i][1], where: RULES[i][2], screen: RULES[i][3] };
    }
    /* The operator's OWN inventory vendor list. Not a guess at all: if they buy product from this
       name, a debit to it is a delivery, and deliveries are COGS through Inventory.
       ⛔⛔ A5 — AND IT COMPARED THE TWO NAMES AS STRINGS, WHICH IS WHY THE RULE HAS NEVER FIRED ON A
       REAL FILE. Measured on the live demo: `Sysco Foods` is on the vendor list, the bank writes
       `SYSCO FOOD SERVICES`, `_vendorKey` says they are different vendors, and a $3,120.88
       distributor invoice imported as an OPERATING EXPENSE while COGS was already coming from
       counts — a double deduction on the Income Statement.
       ⭐ THE HARNESS COULD NOT SEE IT because block N of `verify-expense-import-review` writes the
       list entry and the file row with the IDENTICAL spelling, so the equality passed. [[the-loop]]
       #32: a fixture only ever contains the shapes somebody thought of. `_vendorMatches` is the same
       comparison the learned category uses, so the two doors cannot drift apart on "is this the same
       vendor". */
    const vend = (App.inventoryData && Array.isArray(App.inventoryData.ic_vendors))
      ? App.inventoryData.ic_vendors : [];
    const k = this._vendorKey(vendor);
    if (k && vend.some(v => v && this._vendorMatches(v.name, vendor))) {
      return { note: 'This vendor is on your Inventory list',
        where: 'Inventory, under Receive Delivery', screen: 'ic-receive-delivery' };
    }
    return null;
  },
  // What the import screen reads. The sentence only; the destination is for the hand-typed form.
  _belongsElsewhere(vendor) { const e = this._elsewhereFor(vendor); return e ? e.note : ''; },

  /* ⭐⭐ A1 — ONE IMPORTED ROW AS THE OPERATOR'S OWN CASH-OUTFLOW RECORD. PURE, like every other
     mapping in this rebuild, so the whole write can be rehearsed and pinned before it touches an
     account. Returns null for anything that is not a cash-only category, so the caller can just ask.
     ⛔ THE ID IS THE LEDGER ROW'S. `_writeCashRow` builds the twin with `migrateCashOutflowRow`, which
     preserves the id — so the outflow and its ledger row are one record with one identity, exactly
     as a hand-typed one is. A fresh id here would mint a second copy the reconcile could never
     match up. */
  _outflowFromLedgerRow(rec) {
    if (!rec) return null;
    const type = this._typeForCashCategory(rec.category);
    if (!type) return null;
    return {
      id: rec.id, date: rec.date, type: type, amount: rec.amount,
      notes: rec.notes || '', created_at: rec.created_at || new Date().toISOString()
    };
  },

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
    /* ⛔⛔ THE WHOLE LEDGER, NOT `expenseRows()`. That accessor means THE BILLS and excludes every
       cash row by construction — so the moment the operator can type a row as a draw, a re-drop of
       the same bank month banks it again, invisibly, straight into the cash forecast. Widening it
       cannot cross-match: the predicate compares the CATEGORY too, and a bill's category is never a
       cash-only name (`listReservedWhy` refuses those at both the add and the read door). */
    const _pre = this.records();
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
      /* ⭐ A3 — THE FOURTH SOURCE, AND IT IS DELIBERATELY LAST. A category word inside the vendor
         name is Bar Cop reading a hint off a string; the three above it are the operator speaking.
         A bar dropping its FIRST statement has no history at all, so without this every row on
         their first file sorts by hand — and with it, a decision they later make about that vendor
         overrules the hint from the next drop onward. */
      const worded = (picked || named || learned) ? '' : this._categoryFromVendorWords(vendor);
      /* ⛔⛔ THE FALLBACK IS EMPTY, NOT 'Other' (Phase 3 item 15). 'Other' is a category the operator
         deliberately picks, and Books prints it as "Other operating expenses" while Schedule C
         deducts it on 27a — so filing an unplaceable row there made a row Bar Cop could not read
         and a row the operator chose into the SAME RECORD. Press Add without sorting the Not Sorted
         Yet section and unclassified money became a real deduction, silently. An empty category is
         the honest answer: it says "we do not know" by the absence of a value, and
         `isUncategorizedRow` is what keeps it off the P&L until somebody sorts it. */
      const category = picked || named || learned || worded || '';
      // Did anything actually place this row? That is the whole question "Need a Type" asks, so the
      // walk answers it rather than the render guessing.
      const placed = !!(picked || named || learned || worded);
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
      /* ⭐⭐⭐ A CASH ROW IS STORED IN THE SHAPE THE OUTFLOW MAPPING WILL REBUILD, OR IT IS SILENTLY
         REWRITTEN AT THE NEXT LOGIN. `migrateCashOutflowRow` sets `vendor: ''` unconditionally — an
         outflow record has no vendor field — and `_reconcileLedgerFrom` REWRITES any twin that
         differs from what the mapping produces. So a bank descriptor kept in `vendor` survives
         exactly until the operator next logs in, and then vanishes with nothing on screen saying so.
         Folding it into the NOTE is the only place it lives, and the note is what Cash Outflows
         shows. The review table still prints the descriptor in its Vendor column, because that
         reads the FILE's row, not the record.
         ⛔ AND THE DEDUP HAS TO ASK THE SAME QUESTION THE WRITE ANSWERS, or a re-drop of the same
         statement banks the draw a second time. */
      const _cash = this.isCashOnlyCategory(category);
      const storeVendor = _cash ? '' : vendor;
      const storeNotes = _cash ? [vendor, notes].filter(Boolean).join(' · ') : notes;
      if (_dup(date, amount, storeVendor, category)) {
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
               vendor: storeVendor, amount: amount, notes: storeNotes, created_at: new Date().toISOString() }
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
    /* ⚠ THE REFUSAL NAMES THE STEP THEY ARE ACTUALLY ON. With a two-step control, "pick a category"
       is wrong advice for somebody who has not chosen a Log Type yet — and a refusal that describes
       the wrong control reads as a broken button ([[the-loop]] #53). */
    if (!r.moveType) { r.moveNote = 'Pick a log type first, then press Move To.'; this._rerender(); return; }
    if (!r.moveCat) {
      r.moveNote = (r.moveType === 'cash' ? 'Pick a kind first' : 'Pick a category first') + ', then press Move To.';
      this._rerender(); return;
    }
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
       as though that category is still "current" when the rows it holds are already placed.
       ⚠ THE LOG TYPE DOES NOT RESET WITH IT, and that is the difference between the two controls. A
       bank month is sorted in batches of the SAME type — eight passes of Operating Expense, then
       perhaps one draw — so clearing the type would make them re-answer the same question eight
       times. The NAME is what could file money by accident; the type only decides which picker is
       on screen, and it is visible while they do it. */
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
    /* ⭐ A2 — "NEED A TYPE", NOT "NOT SORTED YET" (Kyle). With a two-step control the TYPE is what is
       missing first: until the operator says Operating Expense or Cash Outflow, there is no list of
       categories to be unsorted within. The old title named the second question. */
    if (unsorted.length) groups.push({ key: 'unsorted', title: 'Need a Type',
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
    /* ⭐⭐ A1 — THE CASH KINDS GET SECTIONS TOO, AND WITHOUT THIS THE FEATURE IS A TRAPDOOR. The loop
       above walks `categoryList()`, which deliberately contains NO cash-only name — so a row the
       operator moved into "Owner Draw" would be `placed`, would be counted by the button, would be
       written on Add, and would match NO section: it disappears off the screen between the press
       and the write. Exactly the complaint Move To's open-the-target rule exists to answer.
       ⚠ AND THE HEAD SAYS "cash outflow", not "expense". A draw is not a cost of running the bar,
       it never reaches the Income Statement, and a section promising otherwise on the screen where
       they are deciding is the wrong sentence in the one place it matters. */
    this.CASH_ONLY_CATEGORIES.forEach(k => {
      const rows = landing.filter(x => x.placed && x.cat === k.name);
      if (!rows.length) return;
      groups.push({ key: k.name, title: k.name,
        sub: rows.length + ' cash outflow' + (rows.length === 1 ? '' : 's') + ' going into ' + k.name,
        rows: rows, open: !!r.open[k.name] });
    });
    if (elsewhere.length) {
      // The head says what to do, because unlike Not Going In this one is answerable.
      // ⛔ A REPORT: these rows do not land, so Remove changes nothing on them. The way to answer this
      // card is Move To, which is why the tick box stays and only the button goes.
      groups.push({ report: true, key: '__elsewhere', title: 'Not Operating Expenses',
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
      // ⛔ A REPORT, and the one the operator cannot overrule at all: Bar Cop's certainty. Nothing to
      // press, so nothing is offered.
      groups.push({ report: true, key: '__skip', title: 'Not Going In',
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

  /* ⭐⭐⭐ A1 — THE SAME `Log Type -> Category | Kind` PAIR THE MANUAL FORM HAS (Kyle, 2026-08-05:
     *"wouldn't having the same steps on the manual form replace the choose the category selector
     work?"*). One control, two screens, and it closes four findings at once:
       · a DRAW can finally be filed from an import. "Owner Draw" is not a bank word — a statement
         says `ONLINE TRANSFER TO CHK ...4471`, `CHECK #1042`, `ATM WITHDRAWAL` — so no amount of
         name-reading will ever place one. Only the operator knows, and now they can say.
       · the excluded TRANSFER gets a home instead of vanishing. `_elsewhereFor` correctly holds a
         self-transfer back ("the money never left the business") and that is WRONG for a draw, which
         did leave. Nothing in the descriptor separates them. A Kind is the answer.
       · "+ Add your own" comes along free on the category branch, so an operator who never opens the
         manual form can still add a category.
       · the section above renames to "Need a Type", which is truer than "Need a Category".

     ⛔ REUSE THE EXACT CONTROLS, and the two branches are deliberately DIFFERENT KINDS of control.
     The category branch is KEYED, so it pulls through `App.listOptions` and inherits its refusal of
     the five reserved cash names ([[the-loop]] #115). The Kind branch is UNKEYED with the five and
     `addCustom: false` — keyed would offer NONE of them, measured on the real control when v101
     tried it, precisely because `listOptions` refuses reserved names at READ time. A typed-in kind
     has no `type` to become, so the set is closed.
     ⚠ SHOW/HIDE, NOT A RE-RENDER, same as `_applyLogType` on the form: nothing chosen can be lost if
     nothing is rebuilt, and at 2,000 rows a repaint of this panel costs ~460ms. */
  _expenseToolbarHtml() {
    const r = this._expenseReview || {};
    const t = r.moveType || '';
    /* ⚠ ASKED ONCE. `_expenseCheckedIds` walks `_expenseGroups`, which walks the whole file through
       `_buildExpenseRows` — so reading it three times in one label is three full walks per render,
       and this panel already carries a ~460ms-at-2,000-rows note. Found scanning my own diff: the
       version this replaced took it once into a `const` and I inlined it. */
    const n = this._expenseCheckedIds().length;
    const hide = on => on ? '' : 'display:none;';
    /* ⚠ THE REFERENCE'S OWN MARKUP, down to the wrapper. Kyle: *"the drop down isn't styled
       correctly."* A bare `<select>` misses `.form-input`, and without the `.f` wrapper it does not
       sit against the middle of the button beside it. Copied from `ic-product-setup`'s route
       toolbar, including `no-print` and the centre alignment its comment argues for. */
    return '<div class="no-print" style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px;">'
      + '<div class="f" style="width:180px;"><label>Log Type</label>'
      +   '<select class="form-input" id="oex-rt-logtype">'
      +     '<option value=""' + (t ? '' : ' selected') + '>Select Type...</option>'
      +     '<option value="expense"' + (t === 'expense' ? ' selected' : '') + '>Operating Expense</option>'
      +     '<option value="cash"' + (t === 'cash' ? ' selected' : '') + '>Cash Outflow</option>'
      +   '</select></div>'
      + '<div class="f" id="oex-rt-cat-wrap" style="width:230px;' + hide(t === 'expense') + '">'
      +   '<label>Category' + App.manageListLink('expense_category') + '</label>'
      +   App.customSelect({ id: 'oex-rt-cat', key: 'expense_category', builtin: this.CATEGORIES,
            selected: t === 'expense' ? (r.moveCat || '') : '', blank: true, blankLabel: 'Select category...' })
      + '</div>'
      + '<div class="f" id="oex-rt-kind-wrap" style="width:230px;' + hide(t === 'cash') + '">'
      +   '<label>Kind</label>'
      +   App.customSelect({ id: 'oex-rt-kind', builtin: this.CASH_ONLY_CATEGORIES.map(c => c.name),
            selected: t === 'cash' ? (r.moveCat || '') : '', blank: true, blankLabel: 'Select kind...',
            addCustom: false })
      + '</div>'
      /* ⚠ THE COUNT IS ON THE BUTTON, so a press can never move a number the operator did not see.
         Disabled at zero for the same reason the Add button is.
         ⭐ THE `.f` + SPACER LABEL IS THE APP'S OWN CONVENTION for a button standing in a labelled
         form row (`ic-report-variance`'s Reset), not something invented here. Kyle, walking the
         pushed build: *"the 'move to' button needs vertically centered with the drop down cell."*
         The row is bottom-aligned, so a 22px button against a 34px picker is flush at the bottom and
         exactly (34−22)/2 = 6px low through the middle.
         ⛔⛔ THE BOX IS 34px, THE BUTTON IS NOT — and that distinction is the whole correction. My
         first version fixed the alignment by GROWING the button to 34px, which centred it and made
         it a different button. Kyle: *"change the move to button back to the smaller height size
         that it was.. that button size was right it just needed to be vertically centered."* He is
         right: `btn-sm` is correct here because Move To is a step INSIDE the review, not the press
         that commits it — and the two must not read as equals. So the WRAPPER matches the picker's
         box and centres a small button in it.
         ⚠ 34px is `.form-input`'s own box: 7px padding top and bottom, 1px border each side, an 18px
         line box at 13px Barlow. If that padding ever changes this line has to follow it, and G7b
         is what will say so. */
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      +   '<div style="height:34px;display:flex;align-items:center;">'
      +   '<button type="button" class="btn btn-primary btn-sm" id="oex-rt-move"'
      +   (n ? '' : ' disabled') + '>Move To' + (n ? ' (' + n + ')' : '') + '</button></div></div>'
      + (r.moveNote ? '<span style="font-size:11px;color:var(--gold);align-self:center;">' + esc(r.moveNote) + '</span>' : '')
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

  /* The rows the operator took out. Built through the SAME walk and the SAME row mapper as the rest,
     so a removed row looks exactly as it did when they removed it — which is what makes Put Back
     legible; a row rendering as a blank line is one nobody can decide about.
     ⛔ HANDED THE SAME `verdicts` THE SCREEN WAS DRAWN WITH. They are settled from the WHOLE file at
     the drop — date order, which sign means money out, whether a Debit/Credit column exists — so
     re-deriving them over the removed subset would answer a question about the FILE using four rows,
     and a bank register's remaining debits can flip that verdict outright.
     ⚠ A SEPARATE WALK, so a removed row stops taking part in the live one; its verdicts are
     therefore never read, only its cells. */
  _expenseReviewRemoved() {
    const r = this._expenseReview;
    if (!r) return [];
    const gone = r.rows.filter(x => r.removed[x._rid]);
    if (!gone.length) return [];
    return this._buildExpenseRows(gone, r.verdicts, r.assign).list.map((x, i) => Object.assign(
      this._expenseReviewRow(x, (gone[i] || {})._rid),
      { note: 'Taken out of this import', notes: [], lands: false }));
  },
  /* ⛔ `_expenseReviewCount()` WAS DELETED HERE, 2026-08-06, and the retired-code ratchet is what
     found it. It read `this._expenseReview ? this._expenseReviewSummary().count : 0` and its one
     app caller was the refused-write relabel, which now asks `ImportConfirm.goLabel` so the two
     copies of the label rule cannot drift. That left it with zero app callers and nine HARNESS
     callers — a wrapper kept alive by its own tests ([[the-loop]] #66). Those assertions read the
     number off the rendered button now, which is what they always claimed to measure. */

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
      /* ⭐⭐⭐ THE COLUMN SAYS WHAT HAPPENS TO **THIS** ROW (Kyle, 2026-08-06, walking the pushed
         build): *"the 'what happens' column is blank for almost everything.. so either get rid of it
         or make it actually useful... saying 'what happens' on a column header and then it tells the
         user nothing.. makes no sense."*
         ⛔ HE IS OVERRULING THIS FUNCTION'S OWN PREVIOUS REASONING, AND HE IS RIGHT. It said the
         column should stay QUIET on a landing row because "the section head already names the
         category, and saying it again is the section said twice." That argument assumes the section
         head is on screen — and every category section renders COLLAPSED, so the head is one line
         above a card the operator has to open, while the column header sits over every row of every
         card promising to tell them something.
         ⛔⛔ AND THE UNPLACED WORDING IS NOT "logs as Other". Kyle offered that spelling and it is
         FALSE: item 15 made the unplaceable fallback EMPTY on purpose, precisely so a row Bar Cop
         could not read and a row the operator chose stop being one record on Schedule C line 27a.
         The row really does go in, really does carry no category, and really is held off the P&L
         until somebody sorts it — so the note says untyped, and says what to do about it.
         ⚠ THE HELD-BACK AND NOT-GOING-IN SENTENCES ARE UNCHANGED. Those were already the useful
         half of this column and they are the reason it exists at all. */
      note: x.status !== 'new' ? (NOTE[x.status] || '')
        : x.excluded ? (x.elsewhere || '')
        : x.placed ? ('Logs to ' + x.category)
        : 'Logs untyped, pick a type',
      notes: x.notes || [],
      lands: x.status === 'new' && !x.excluded,
      /* ⭐ A6 — GOING IN, BUT NOT ANSWERED. The shell counts these onto the button so a press can
         never bank money into limbo silently. `placed` is the walk's own answer to "did anything
         file this row", so nothing new is being decided here — it is being SAID. */
      unset: !x.placed
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
    /* ⚠ ONE OPTIONS OBJECT, TWO CALLERS. `_runExpenseReview` rebuilds the go button IN PLACE after a
       refused write (a re-render there would destroy the result slot holding the error), and it used
       to hand-build the label. Once A1 gave the noun a condition and A6 gave it a tail, that copy
       started printing something the shell would never render. Both ask `ImportConfirm.goLabel` off
       THIS object now, so they cannot disagree ([[the-loop]] #54). */
    return ImportConfirm.panel(this._expensePanelOpts(s, lead));
  },
  _expensePanelOpts(s, lead) {
    return {
      label: 'Check your expenses',
      lead: lead,
      /* ⚠ NARROWER VENDOR PULLS AMOUNT LEFT (Kyle: *"too big of a gap from vendor to amount"*). A
         34% vendor column against short bank descriptions left the figure stranded at the far right
         of its own cell. Every section shares one colgroup, so the columns line up card to card by
         construction; what was wrong was the split, not the alignment. */
      columns: [{ label: 'Date', width: 13 }, { label: 'Vendor', width: 27 }, { label: 'Amount', width: 12 }],
      outcomeLabel: 'What Happens',
      rows: s.rows,
      /* ⚠ THE NOUN FOLLOWS WHAT IS ACTUALLY GOING IN, AND A1 IS WHAT MADE THAT NECESSARY. Before
         the Log Type pair, every row this button wrote was an operating expense and "Add 5
         Expenses" was simply true. Now a draw can be among them — and the section head above it
         says "cash outflow", the result line afterwards says "3 expenses and 2 cash outflows", and
         the button in between would still have claimed five expenses. A gap I walked into building
         A1, not one that was here before.
         ⭐ "Rows" is this screen's own word, not a new one: the lead already reads "Bar Cop read 6
         rows out of this file". The common case — a file with no cash in it — is unchanged. */
      verb: 'Add', noun: s.rows.some(x => x.lands && this.isCashOnlyCategory(x.cat)) ? 'Row' : 'Expense',
      // A6. The shell counts the rows; this door supplies the words. See ImportConfirm.panel.
      unsetNoun: 'with no type',
      // Grouped by where each row is going. See ImportConfirm.panel and _expenseGroups.
      groups: this._expenseGroups(),
      toolbar: this._expenseToolbarHtml(),
      selectable: true,
      checked: (this._expenseReview || {}).checked || {},
      removable: true,
      // Removed rows are never part of `rows`, which is what keeps them out of the count, out of
      // the needs/settled split and out of the "All N of these" lift with no special case anywhere.
      removedRows: this._expenseReviewRemoved(),
      goAttr: 'data-oexreview-go', backAttr: 'data-oexreview-back', backLabel: 'Start Over',
      resultId: 'oex-imp-result',
      // The door owns which sections are open; a closed one builds no table at all.
      open: (this._expenseReview || {}).open,
      busy: !!this._expenseReviewWriting
    };
  },

  /* ⛔⛔ START OVER GIVES THE PAGE BACK, NOT JUST THE SCREEN (2026-08-07).
     It read `this._expenseReview = null; this._rerender();`, which drops the confirm screen and
     leaves `_moTakeover` set — and the mapper that fed it was spent two renders earlier. Measured on
     the live build: the operator lands on a bare drop zone with the four steps gone and no control
     that returns the page. **That is the same dead state Kyle found by navigating away, reached in
     one press, on a button Bar Cop draws itself.**
     ⭐ `sc-dashboard` already answers this at its own Start Over — *"the carried mapper is spent once
     its rows have gone to the confirm screen, so leaving the takeover set would re-attach a dead node
     over the step"* — and it clears the takeover with the review. Same call here.
     ⚠ ONE PATH FOR BOTH SURFACES. On the full Operating Expenses screen there is no takeover to end,
     `_moTakeover` is already false, and `_rerenderHost` falls through to `_rerender()` — so this is
     byte-identical to the old behaviour there. On the step it repaints the HOST, which is what brings
     the four steps back; `_rerender()` alone would repaint the card inside a page that no longer has
     one. */
  _backFromExpenseReview() {
    this._expenseReview = null;
    this._moTakeover = false;
    this._carryCsv = null; this._carryActs = null;
    this._rerenderHost();
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
      /* ⛔ THE LABEL COMES FROM THE SHELL, NOT FROM A SECOND COPY OF ITS RULE. This read
         `'Add ' + n + ' Expense'`, which was true until A1 gave the noun a condition (a draw is not
         an expense) and A6 gave it a "(N with no type)" tail — so a refused write relabelled the
         button to something `ImportConfirm.panel` would never render, on the screen where the
         operator is deciding whether to press it again. */
      if (this._expenseReview) {
        const b = this.container && this.container.querySelector('[data-oexreview-go]');
        if (b) {
          b.disabled = false;
          b.textContent = ImportConfirm.goLabel(this._expensePanelOpts(this._expenseReviewSummary(), ''));
        }
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
    /* ⭐⭐⭐ A1 — THE LANDING ROWS SPLIT BY WHAT THE OPERATOR TYPED THEM AS, and the two halves take
       DIFFERENT WRITE PATHS. A cash-only row cannot go through the bulk expense write: it would land
       in the ledger with no `migrated_from`, which `_isOperatingRow` reads as a BILL and
       `CashEngine.cashOutflows()` cannot see at all — so the draw would sit on the Money Out screen
       as a fixed cost and never reach the forecast. The orphan shape ([[the-loop]] #115), and E4 of
       `verify-money-out-write-doors` has been pinning that constraint since the day cash rows became
       reachable. The answer is not a new path, it is the EXISTING one: `_writeCashRow`. */
    const _landing    = built.list.filter(x => x.status === 'new' && !x.excluded);
    const _cashPicks  = _landing.filter(x => this.isCashOnlyCategory(x.rec.category));
    const toAdd       = _landing.filter(x => !this.isCashOnlyCategory(x.rec.category)).map(x => x.rec);
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
        + 'Could not save the import. Nothing was changed. Check your connection and try again.</div>';
      return;
    }
    /* ⭐⭐⭐ THE CASH ROWS, AFTER THE BILLS AND ONLY IF THE BILLS LANDED, THROUGH `_writeCashRow`.
       ⛔ THE ORDER IS THE DESIGN: pick the order that makes every failure land somewhere repairable.
       Bills first means a refused bulk aborts before a single cash row exists — nothing to duplicate
       on the retry. Cash after means a refused cash write leaves the bills in, and the retry finds
       them ALREADY LOGGED because `_dup` reads the whole ledger, so pressing Add again re-attempts
       only what failed. [[test-the-retry]]: a failed write is recoverable, the SECOND attempt is what
       makes damage permanent.
       ⚠ THE ORIGINAL REASON WAS "two stores cannot be written in one request" — true until build
       order E dropped the second store. The order still matters for the retry argument above, which
       never depended on there being two.
       ⭐ AND E MADE `cashFailed` HONEST. `_writePair` returned TRUE as soon as the operator's own
       store took the row, so a refused LEDGER write counted as SAVED — the operator was told the row
       landed while the forecast could not see it until the next boot reconcile repaired it. One
       store means the count below is what actually reached the server.
       ⛔ BARE CALL, NOT GUARDED. A guard would mean "if the outflow screen has not loaded, write
       half a record" ([[the-loop]] #40) — and the screen object is always loaded, which is exactly
       why item 19 stage 2 wrote that constraint down. The manual form's cash branch calls it the
       same way. */
    let cashSaved = 0, cashFailed = 0;
    for (let i = 0; i < _cashPicks.length; i++) {
      const out = this._outflowFromLedgerRow(_cashPicks[i].rec);
      if (!out) { cashFailed++; continue; }
      let landed = false;
      try { landed = await S.HubCashOutflows._writeCashRow(out); } catch (e) { landed = false; }
      if (landed) cashSaved++; else cashFailed++;
    }
    /* ⛔ A REFUSED CASH WRITE KEEPS THE SCREEN, exactly as a refused bulk does. The bills that DID
       land re-read as "Already logged" on the next walk, so the operator can press Add again and
       only the refused rows are attempted. Clearing the screen here would leave them with no way
       back except re-dropping the file — and no account of which rows are missing. */
    if (cashFailed && opts.reviewed) {
      const el = document.getElementById('oex-imp-result');
      if (el) el.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + 'Could not save ' + cashFailed + ' cash outflow' + (cashFailed === 1 ? '' : 's')
        + '. Everything else went in. Check your connection and press Add again.</div>';
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
    /* ⛔ AND THE CARRIED NODES GO WITH IT. They are held for the LIFE of the takeover now (see
       `_wireCurrent`), so every path that ends one has to drop them in the same breath — a reference
       to a mapper whose file has already been written is a dead node waiting to be re-attached over
       a fresh drop zone. Enumerate the teardown, not just the new code ([[the-loop]] #44). */
    this._carryCsv = null; this._carryActs = null;
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
       view is actually open, so it cannot draw one screen over another. [[the-loop]] #24 — after a
       value gains a third possibility, every test written against two is now pointing at the wrong
       set.
       ⚠ THE `history` EXCLUSION WAS DELETED HERE with the Expense History route (2026-08-06). It
       existed because that page had no import surface, so a drop finishing while it was open had
       nothing to say to it. There is no such view any longer; the two that remain both host the
       import, so neither is excluded. */
    if (!saved) {
      this._importMsg = 'Could not save the import. Nothing was changed. Check your connection and try again.';
    } else if (opts.reviewed) {
      /* ⭐⭐ A REVIEWED IMPORT GETS THE HEADLINE ALONE. Every clause below was written when the drop
         wrote straight through and this line was the operator's ONLY account of it. Now each one is
         a row on the confirm screen, said once, where they read it and pressed Add — and repeating
         it afterwards is the second telling. Kyle on the sales door: *"all that green text is very
         hard to read and follow.. it is just repeating what the user just saw on screen."*
         ⛔ PRECONDITION, and it is the whole rule: a clause may only be dropped once its FACT is on
         the screen. Every bucket here is a row with its own note, the two file-level caveats are in
         the lead, and the rows the operator took out went out by their own hand. */
      /* ⚠ TWO COLLECTIONS, SO TWO COUNTS ([[the-loop]] #86 — every plural names a collection; say
         which one). A draw is not an expense: calling three bills and two draws "5 expenses
         imported" would be the screen contradicting the sections the operator just sorted them
         into, on the one line that reports what happened. */
      /* ⛔⛔⛔ NAME THE MONTH THE ROWS LANDED IN (Kyle, 2026-08-07, found on the live build).
         He dropped a JULY statement while the step was closing AUGUST, 53 rows imported cleanly,
         and the step still read "12 bills logged this month" — correctly, because it counts the
         month being CLOSED. Nothing on screen said where the 53 went, so a successful import looked
         like nothing had happened.
         ⭐ THE COUNT STAYS ON THE CLOSING MONTH (Kyle's call). Re-pointing it at whatever file was
         last dropped would make that number mean something different every time, on the one step
         whose job is closing a specific month. The MESSAGE carries the fact instead. */
      const _n = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
      const _months = Array.from(new Set((_added || []).map(r => String((r && r.date) || '').slice(0, 7))
        .filter(m => m.length === 7))).sort();
      const _where = _months.length === 1
        ? ' into ' + this._monthLabel(_months[0])
        : (_months.length > 1 ? ' across ' + _months.length + ' months, ' + this._monthLabel(_months[0])
            + ' to ' + this._monthLabel(_months[_months.length - 1]) : '');
      this._importMsg = (_added.length ? _n(_added.length, 'expense') : '')
        + (_added.length && cashSaved ? ' and ' : '')
        + (cashSaved ? _n(cashSaved, 'cash outflow') : '')
        + ((_added.length || cashSaved) ? ' imported' + _where + '.' : 'Nothing new to import.');
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
      if (v.conv.contradictory) bits.push('some dates read day-first and others month-first, so day-and-month order could not be settled. Check any date where both numbers are 12 or under');
      // ⚠ ONLY WHEN THE SIGN WAS ACTUALLY CONSULTED. With a Debit/Credit column present nothing was
      // inferred, so warning that Bar Cop "could not tell" would describe a decision it never made.
      if (v.sign.contradictory && !v.hasDir) bits.push(v.sign.negVotes + ' amounts are negative and ' + v.sign.posVotes
        + ' positive, so Bar Cop could not tell which sign means money out (it read the positive rows as expenses; check the amount column)');
      this._importMsg = bits.join(' · ') + '.';
    }
    this._rerenderHost();
  },

  // By Category row-list (current month, last month, YTD, YTD % of revenue).
  /* ⭐⭐⭐ THE ONE WALK BEHIND BOTH CARDS. Kyle: *"the stat box is basically a summary total of each
     of the by category cards."* That is an EQUALITY, and the cheapest way to guarantee an equality
     is one implementation — the card renders these rows and the stat card sums them, so a fourth
     reader cannot quietly disagree with the other three ([[the-loop]] #54/#109, which cost three
     rounds when it was learned the other way round).
     ⛔ IT FOLLOWS THE TAB AND NEVER THE RANGE CHIPS. Its periods are fixed by name — this month,
     last month, year to date — so a chip reading "Last 12 Months" cannot move a column headed
     "This Month". The chips govern the History card, and only that.
     ⛔ ONLY CATEGORIES WITH MONEY IN THIS TAB'S SET. Measured on the deployed build before this
     changed: the Cash Outflows chip drew FOURTEEN rows of which ELEVEN were bill categories reading
     $0.00 / $0.00 / $0.00 — a card whose job is showing where the money went, padded with eleven
     lines saying it went nowhere. `_cardCategoryList()` is still what ORDERS them, so the operator's
     own list and the Uncategorized-first rule both survive; this only drops the empties.
     ⚠ AND UNCATEGORISED STAYS EVEN AT ZERO, because a row nobody can see is a row nobody fixes
     ([[the-loop]] #115) — it is the one bucket whose presence is the message. */
  _byCatRows() {
    const mk = this._currentMonthKey();
    const prevMk = this._priorMonthKey(mk);
    const byCatMonth = this._sumMonthByCategory(mk);
    const byCatLast  = this._sumMonthByCategory(prevMk);
    const byCatYTD   = this._sumYTDByCategory(mk);
    const pctB       = this._pctBasis();
    const pctMk      = (pctB && pctB.mk.slice(0, 4) === mk.slice(0, 4)) ? pctB.mk : '';
    const byCatPct   = pctMk ? this._sumYTDByCategory(pctMk) : null;
    const ytdRev     = pctMk ? pctB.ytdRev : 0;
    const uncat      = this._catOf({});
    const rows = [];
    this._cardCategoryList().forEach(c => {
      const tm = byCatMonth[c] || 0, lm = byCatLast[c] || 0, ytd = byCatYTD[c] || 0;
      if (tm === 0 && lm === 0 && ytd === 0 && c !== uncat) return;
      rows.push({
        cat: c, month: tm, last: lm, ytd: ytd,
        pctBase: (byCatPct && ytdRev > 0) ? (byCatPct[c] || 0) : null
      });
    });
    return { rows, pctMk, ytdRev };
  },

  /* ⭐⭐ THE STAT CARD, WHICH IS THE COLUMN TOTALS AND NOTHING ELSE. Four figures, because Kyle asked
     for Last Month beside the other two: *"add Last month total to stat card."*
     ⛔ THE % IS THE YTD RATIO, MATCHING THE COLUMN IT SUMMARISES. It used to be a MONTH ratio
     (that month's opex over that month's revenue) sitting above a column headed "% of Revenue, YTD
     thru July" — two different quantities under one word. Summing the column makes them one, and it
     inherits the S226d fix rather than reopening it: both sides stop at the last COMPLETE month, so
     it is still one period on both sides. The basis moves onto THIS label, which is what lets the
     column header be short — his other complaint, solved by the same edit. */
  _statCardHtml() {
    const { rows, pctMk, ytdRev } = this._byCatRows();
    const fmt$ = (v) => App.fmtCurrency(v || 0);
    const sum = (k) => rows.reduce((t, r) => t + (r[k] || 0), 0);
    const pctBaseTotal = rows.reduce((t, r) => t + (r.pctBase || 0), 0);
    const pct = (pctMk && ytdRev > 0) ? (pctBaseTotal / ytdRev) : null;
    const stat = (label, val) => '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg">' + val + '</div></div>';
    return '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + stat('This Month', fmt$(sum('month')))
      + stat('Last Month', fmt$(sum('last')))
      + stat('Year to Date', fmt$(sum('ytd')))
      + stat('% of Revenue' + (pctMk ? ' &middot; YTD thru ' + esc(this._monthLabel(pctMk)) : ''),
             pct == null ? '—' : (pct * 100).toFixed(1) + '%')
      + '</div></div>';
  },

  _byCatCardHtml() {
    const fmt$ = (v) => App.fmtCurrency(v || 0);
    const fmtPct = (v) => v == null ? '—' : (v * 100).toFixed(1) + '%';
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
    const { rows, pctMk, ytdRev } = this._byCatRows();
    /* ⭐ THE HEADER IS SHORT NOW, AND THE BASIS DID NOT VANISH — IT MOVED. Kyle: *"short the last
       column '% of revenue, ytd thru...' that is way too long for a column header."* It was 31
       characters. The month it stops at is a fact about the whole column, so it belongs on the stat
       card's own label where it is stated once, not repeated in a table heading. */
    const catRows = rows.map(r => {
      const ytdRevPct = (r.pctBase != null && ytdRev > 0) ? (r.pctBase / ytdRev) : null;
      return '<tr>'
        + '<td style="color:var(--t1);">' + esc(r.cat) + '</td>'
        + '<td style="font-weight:700;color:var(--t1);">' + fmt$(r.month) + '</td>'
        + '<td style="color:var(--t3);">' + fmt$(r.last) + '</td>'
        + '<td style="color:var(--t2);">' + fmt$(r.ytd) + '</td>'
        + '<td style="color:var(--t3);text-align:left;">' + fmtPct(ytdRevPct) + '</td>'
        + '</tr>';
    }).join('');
    const empty = '<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--t3);font-size:12px;">'
      + 'Nothing logged yet for ' + esc(this._kindExportTitle().toLowerCase()) + '.</td></tr>';
    return '<div class="card" style="overflow-x:auto;">'
      + '<table class="row-list">'
      +   this._colGroupHtml()
      +   '<thead><tr><th>Category</th><th>This Month</th><th>Last Month</th><th>YTD</th>'
      +     '<th>% of Revenue</th></tr></thead>'
      +   '<tbody>' + (catRows || empty) + '</tbody>'
      + '</table></div>';
  },

  // The log row-list for a given set of records (optional id).
  _logTableHtml(recs, id) {
    const logRows = recs.length === 0
      ? '<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--t3);font-size:12px;">No expenses in this range.</td></tr>'
      : recs.map(r => this._logRowHtml(r, { minimal: true })).join('');
    return '<div class="card"' + (id ? ' id="' + id + '"' : '') + ' style="overflow-x:auto;">'
      + '<table class="row-list">'
      /* ⭐ THE SAME GEOMETRY AS THE BY CATEGORY CARD, so Vendor sits under Last Month and Amount
         under YTD, which is what Kyle asked for. It carried its own widths (22/26/18/18/16) and
         nothing lined up. */
      +   this._colGroupHtml()
      +   '<thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Amount</th><th class="no-print"></th></tr></thead>'
      +   '<tbody>' + logRows + '</tbody>'
      + '</table></div>';
  },

  // ── History tab: By Category + the filterable log (paged 50 at a time) ────
  _renderHistory() {
    const PAGE = App.LIST_PAGE || 50;
    if (!this._histShown) this._histShown = PAGE;
    const rangeChips = App.filterChips(this._filterRange, this._rangeChipOpts());
    /* ⛔ THE KIND CHIPS WERE BUILT HERE AND THEY ARE THE TAB BAR NOW (`_tabBarHtml`). They carried
       their own `mo-chip` class so the two chip wirings could not cross — a single `.fc-chip`
       handler would have set the RANGE to 'all' when the operator clicked All Money Out, because
       both vocabularies contain that word ([[the-loop]] #50). The hazard goes with them: one chip
       row on the page now, and the tabs dispatch on `data-motab`. */
    const recs = this._filteredRecords();
    const shown = recs.slice(0, this._histShown);

    /* ⭐⭐ ONE CONTROL ROW: CHIPS LEFT, ONE EXPORT RIGHT. Kyle: *"keep chips as they are above the
       history card and export pdf same row as chips aligned rightside"*, and *"no two export
       buttons"*. The page carried two, one on the This Month card and one on the By Category
       heading, and BOTH exported bills whatever the chip said.
       ⭐ IT IS ALSO THE SHAPE HIS REFERENCE ALREADY USES: `vendor-tracker.rangeFilterRow(exportId)`
       is chips-left / one-Export-right, shared across all three of its tabs.
       ⛔ THE KIND CHIPS ARE GONE FROM HERE — they are the TAB BAR at the top of the page now. Two
       chip rows asking two different questions, stacked in the middle of the page, is the thing he
       rejected by name. */
    const filterRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + rangeChips + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="oex-export">Export PDF</button>'
      + '</div>';
    const byCatHeading = '<div class="sh" style="margin:0 0 10px;">By Category</div>';
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
    /* ⛔ THE `.mo-chip` WIRING WENT WITH THE KIND CHIPS (pieces 3+4). It set `_filterKind` from a
       second chip row; that job belongs to `_wireTabs` now, dispatching on `data-motab`. The reason
       the two were kept on separate classes still holds and is why the tabs got an attribute of
       their own rather than joining `.fc-chip`: both vocabularies contain the word 'all', so one
       shared handler would set the RANGE to all-time when the operator picked All Money Out
       ([[the-loop]] #50 — a key two different things can produce is not a key). */
    this.container.querySelectorAll('.fc-chip').forEach(chip => {
      chip.addEventListener('click', () => { this._filterRange = chip.dataset.v; this._histShown = PAGE; this._rerender(); });
    });
    document.getElementById('oex-older')?.addEventListener('click', () => { this._histShown = (this._histShown || PAGE) + PAGE; this._rerender(); });
    this._wireRows(this.container);
  },

  /* Shared row-action wiring for both halves of the page.
     ⛔⛔⛔ IT BINDS EACH BUTTON ONCE, AND THAT GUARD IS LOAD-BEARING — BUILD ORDER D MADE IT SO.
     D merged the three sidebar rows into one page, so `renderMain` draws `_renderCurrent()` +
     `_renderHistory()` and wires BOTH — and each of those wirings ends by calling this with
     `this.container`, the WHOLE screen, not its own half. Before D they were separate SCREENS and
     each wired only what it had drawn, so scoping to the container was free.
     MEASURED ON THE DEPLOYED BUILD: every row button carried TWO listeners, `_delete` ran twice on
     one click, and one press of Delete opened TWO confirm dialogs — confirm one and the second sits
     there asking about a record that is already gone. Edit and Repeat double too; they survive only
     because `App.openModal` REPLACES its modal while `App.confirm` APPENDS, so the damage shows on
     the confirm doors: Delete and Stop.
     ⭐ THE FLAG, NOT "CALL IT ONCE". Removing one of the two calls is the obvious fix and it breaks
     half the page: MEASURED on the live build, `_renderCurrent()` emits 6 Edit and 6 Delete buttons
     and `_renderHistory()` emits 6 more of each — BOTH halves carry row actions — so whichever
     `_wireRows` call was deleted would leave one half's rows dead on click. Marking the element
     makes this idempotent however many wiring passes run, which is the property rather than the
     case ([[the-loop]] #52). A re-render replaces the markup, so fresh buttons arrive unmarked and
     are wired normally.
     ⚠ THIS COMMENT FIRST GAVE THE WRONG REASON — it said the Close The Books takeover would lose
     its rows, because `renderMoneyOut` calls `_wireCurrent()` alone. Measured on the deployed build:
     the takeover renders `_addCardHtml` and NOTHING ELSE — no rows at all, so `_wireRows` is a no-op
     there and that argument was worthless. The fix was right and the justification was false, which
     is the shape [[harness-review-like-code]] #35 records: a justification is a claim, so measure it
     before writing it down. */
  _wireRows(scope) {
    const openEdit = (b) => { const r = this.records().find(x => x.id === b.dataset.id); if (r) this._openModal(r); };
    const once = (b) => { if (b._oexRowWired) return false; b._oexRowWired = 1; return true; };
    /* Edit and Delete are the only row actions. The `.oex-renew`, `.oex-dup` and `.oex-stop`
       listeners were removed with the branches that rendered those buttons: nothing has emitted one
       since the log moved to `{minimal: true}`, and recurrence is derived now, so there is no series
       for an operator to renew, repeat or stop. */
    scope.querySelectorAll('.oex-edit').forEach(b => { if (once(b)) b.addEventListener('click', () => openEdit(b)); });
    scope.querySelectorAll('.oex-del').forEach(b => { if (once(b)) b.addEventListener('click', () => this._delete(b.dataset.id)); });
  },

  // ── Inline add form save / start over ────────────────────────────────────
  /* ⛔ `_manualElsewhereNotice` WAS DELETED HERE (2026-08-06). It watched the vendor as the operator
     typed and raised a gold notice saying the row belonged on the Cash Outflows screen, with a
     Go There button that opened it. Both are gone, along with the screen. The operator picks Log
     Type on this form; that IS the answer the notice was trying to give them. See the note where
     the `oexa-elsewhere` slot used to be, in the form builder above. */

  async _saveAdd() {
    const g = (id) => document.getElementById(id);
    const date     = g('oexa-date')?.value || '';
    const category = g('oexa-cat')?.value || '';
    const vendor   = (g('oexa-vendor')?.value || '').trim();
    const amount   = parseFloat(g('oexa-amount')?.value || '');
    const notes    = (g('oexa-notes')?.value || '').trim();
    const showErr = (m) => { const e = g('oexa-err'); if (e) { e.textContent = m; e.style.display = 'block'; } };
    /* ⭐⭐ ITEM 19 STAGE 2 — THE CASH BRANCH, AND IT GOES FIRST SO THE EXPENSE PATH BELOW IS
       UNTOUCHED. The operator declared the type, so nothing is inferred from a category name here.
       ⛔ IT WRITES THROUGH `_writeCashRow`, WHICH IS THE ONLY SANCTIONED PATH. A plain
       `putRecord('operating_expense', ...)` would create a cash-only row with no `migrated_from`,
       which `_isOperatingRow` counts as a BILL and `CashEngine.cashOutflows` cannot see — the
       orphan shape ([[the-loop]] #115). `_writeCashRow` writes the operator's store first and the
       ledger twin after, so a refused half leaves the ledger LAGGING, which the boot reconcile
       repairs. Bare call, not guarded: a guard would mean "if the outflow screen has not loaded,
       write half a record" ([[the-loop]] #40).
       ⚠ THE REFUSAL IS REPORTED. `_writeCashRow` returns false when the operator's own store refuses,
       and saying so keeps the typed values on screen instead of claiming a save that did not
       happen ([[test-the-retry]] — the retry is where a half-save becomes permanent). */
    const logType = g('oexa-logtype')?.value || '';
    if (!logType) { showErr('Pick a log type.'); return; }
    if (logType === 'cash') {
      const kind = g('oexa-kind')?.value || '';
      if (!date) { showErr('Pick a date.'); return; }
      if (!kind) { showErr('Pick a kind.'); return; }
      if (isNaN(amount) || amount <= 0) { showErr('Enter an amount above zero.'); return; }
      const out = {
        id: App.uid ? App.uid() : ('cof-' + Date.now()),
        date: date, type: this._typeForCashCategory(kind), amount: amount, notes: notes,
        created_at: new Date().toISOString()
      };
      /* ⛔ NO SCHEDULE IS WRITTEN ONTO A NEW OUTFLOW (build order C2). A stored `recurring` flag is
         an instruction to every forward reader and outranks the ledger for as long as it sits there.
         `CashEngine.deriveRecurringOutflows` recognises a commitment from what actually happened. */
      if (!(await S.HubCashOutflows._writeCashRow(out))) {
        showErr('Could not save. Check your connection and try again.');
        return;
      }
      this._rerenderHost();
      return;
    }
    if (!date) { showErr('Pick a date.'); return; }
    if (!category) { showErr('Pick a category.'); return; }
    if (isNaN(amount) || amount <= 0) { showErr('Enter an amount above zero.'); return; }
    /* ⛔ NO "THIS LOOKS LIKE IT BELONGS SOMEWHERE ELSE" CONFIRM (deleted 2026-08-06). This asked
       "Add it to Operating Expenses anyway?" whenever the vendor matched a draw / loan / tax /
       payroll rule, on the reasoning that the override should be a decision rather than an accident.
       That reasoning assumed the operator had not already been asked. They have: Log Type on this
       form is where they choose Operating Expense or Cash Outflow, so the confirm was second-
       guessing the answer to a question the form itself puts in front of them
       (Kyle, 2026-08-06: *"that is their choice to log what they want, where they want"*).
       ⚠ THIS IS THE MANUAL DOOR ONLY. The IMPORT still holds a flagged row back, and for a reason
       that does not apply here: on an import nobody picks a type row by row, and the default there
       is that doing nothing BOOKS it. */
    const rec = {
      id: App.uid ? App.uid() : ('oex-' + Date.now()),
      date, category, vendor, amount, notes,
      created_at: new Date().toISOString()
    };
    /* ⛔⛔⛔ BUILD ORDER C — A BILL IS WRITTEN WITH NO SCHEDULE ON IT. `recurring`, `frequency`,
       `term_months` and `recur_day` are gone from this record: a stored flag is an INSTRUCTION to
       every forward reader, and the whole point of C is that a bill recurs because it keeps
       happening. `deriveRecurringBills` reads that off the ledger and `recurringBills` stale-checks
       it, so a second source claiming the same fact is the drift this rebuild exists to end.
       ⚠ THE STATED COST, and Kyle accepted it: a brand-new fixed cost needs TWO occurrences before
       the derivation sees it, so it reaches break-even a month or two late and then self-corrects.
       ⚠ THE CASH BRANCH ABOVE STILL WRITES THEM, and must. Nothing derives a cash outflow. */
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
    /* ⛔ C GAVE CASH ITS OWN RECURRING WRAPPER HERE AND C2 DELETED IT. There is no schedule control
       on either branch now: `CashEngine.deriveRecurringOutflows` reads a commitment off the ledger
       for cash exactly as `deriveRecurringBills` does for bills, so nothing is left to show or hide.
       ⚠ AND THE WRAPPER WAS A LIVE BREAK WHILE IT EXISTED — it was opened and never closed, so
       hiding it took the notes field, the error slot and the Add Expense button with it whenever
       Log Type was Operating Expense. See the note where the block used to be. */
    if (t !== 'expense') { clear('oexa-cat'); clear('oexa-vendor'); }
    if (t !== 'cash') clear('oexa-kind');
    // (There used to be an "it belongs elsewhere" notice to clear here. It is gone with the prompt.)
  },

  _clearAdd() {
    const d = document.getElementById('oexa-date'); if (d) d.value = App.todayLocal();
    const c = document.getElementById('oexa-cat');  if (c) c.selectedIndex = 0;
    ['oexa-vendor', 'oexa-amount', 'oexa-notes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
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
    /* ⛔ THE RECURRING CHECKBOX, FREQUENCY AND TERM WERE REMOVED FROM THIS MODAL (2026-08-06).
       Build order C established that a bill recurs because it KEEPS HAPPENING, and removed the
       control from both ADD forms — but the EDIT door was still writing a typed schedule, so a
       bill could still be declared recurring by ticking a box. Kyle spotted it on the live build.
       ⛔⛔ THE SAVE BRANCH WENT WITH IT, AND THAT IS THE LOAD-BEARING HALF. Removing only the
       control would leave `recChecked` permanently false, so the save's ELSE branch would stamp
       `recurring: false` + `stopped_ym` on the series parent — and the first vendor-typo fix would
       stop EVERY declared series on the account, silently, taking it out of the forecast, the
       reserve and Safe to Spend. This form now neither SETS nor CLEARS a schedule; it edits the
       row in front of it and leaves the series alone. Stop is the only thing that ends one. */

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
        ? '<div class="f"><label>Kind</label>' + App.customSelect({ id: 'oex-f-cat', builtin: this.CASH_ONLY_CATEGORIES.map(c => c.name), selected: rec.category, blank: false, addCustom: false }) + '</div>'
        : '<div class="f"><label>Category' + App.manageListLink('expense_category') + '</label>' + App.customSelect({ id: 'oex-f-cat', key: 'expense_category', builtin: this.CATEGORIES, selected: rec.category, blank: true, blankLabel: 'Select category...' }) + '</div>')
      +   '<div class="f"><label>Vendor</label><input type="text" id="oex-f-vendor" value="' + esc(rec.vendor) + '" placeholder="Who did you pay"/></div>'
      +   '<div class="f"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="oex-f-amount" step="0.01" min="0" value="' + esc(rec.amount === '' ? '' : String(rec.amount)) + '" placeholder="0.00"/></div></div>'
      + '</div>'
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
         It used to be that the ledger row was DERIVED — a boot reconcile rewrote it from the
         separate `cash_outflows` store on every load, so writing the edit here looked right and
         silently reverted on the next login. Build order E dropped that store, so the reason has
         changed but the rule has not: `_editCashRow` re-derives the row through the ONE mapping, so
         `category` cannot drift away from `type`. It also has no series machinery — a draw has no recurring parent, no term, no skip
         months — so every branch below is about a shape this row does not have.
         ⚠ THE REFUSAL IS REPORTED, NOT SWALLOWED: `_writeCashRow` returns false when the operator's own
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
      const touched = [];
      // ⚠ This branch REPLACES array slots (arr[idx] = Object.assign({}, ...)) rather than mutating
      // the records, so snapshotting the record objects would capture the new ones. Snapshot the
      // ARRAY instead. A bulk write cannot revert itself, and this one was discarded — so a failed
      // save left the edited bill on screen and in Books while the server kept the old one.
      const undoArr = arr.slice();
      if (isEdit) {
        const idx = arr.findIndex(r => r.id === rec.id);
        if (idx >= 0) arr[idx] = Object.assign({}, arr[idx], updates);
        if (idx >= 0) touched.push(arr[idx]);
      } else {
        const newRec = Object.assign({ id: App.uid ? App.uid() : ('oex-' + Date.now()), created_at: new Date().toISOString() }, updates);
        arr.push(newRec);
        touched.push(newRec);
      }
      if (!(await App.putRecordsBulk('core', 'operating_expense', touched))) {
        arr.length = 0; arr.push(...undoArr);
        showErr('Could not save. Nothing was changed. Check your connection and try again.');
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

  // ── Duplicate ──────────────────────────────────────────────────────────
  // Opens the form pre-filled from the row, dated next month, as a NEW entry.
  // Nothing is booked until the operator reviews the amount and saves, so an
  // accidental click can never log an unconfirmed expense ([[output-honesty]]).

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
       here renders Edit and Delete. When a cash row lived in a second store, removing only the
       ledger row left the operator's own record behind and the additive boot reconcile put the
       ledger row straight back — MEASURED end to end: the Delete button did nothing, permanently,
       which is S226a's exact defect in a new costume.
       ⚠ Build order E dropped that store, so a delete cannot half-happen any more. What `_deleteCashRow`
       still carries is the guard that matters MORE now than it did: the ledger holds the operator's
       real BILLS alongside these, so a delete keyed on the id alone would take one. Bare call,
       not guarded: a guard here would mean "if the outflow screen has not loaded, delete half a
       record", which is the silent-wrong-state trade this codebase gets wrong most often
       ([[the-loop]] #40). Pinned by verify-money-out-write-doors.js section A. */
    if (rec.migrated_from === 'cash_outflow') {
      await S.HubCashOutflows._deleteCashRow(id);
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

/* ⛔ `S.HubExpenseHistory` WAS DELETED HERE (2026-08-06). It was a thin screen that opened its own
   Hub full page and delegated to `renderHistory`. Build order D merged the three Money Out sidebar
   rows into one, and that removed the only thing that could reach it: the sidebar handler dispatches
   on `item.dataset.hubAction` (set by `row(action, …)`), and app.js's `routePage` table is built by
   PARSING THE RENDERED SIDEBAR for `.nav-item` elements — so both dispatch entries were fed from the
   row D deleted, and nothing called `open()` directly. The log those months lived in is on the
   merged Money Out page now, with the same chips and the same Show Older. */
