'use strict';

/* S.HubCashOutflows - the two CASH WRITE DOORS. NOT A SCREEN.
   This file was the standalone Cash Outflows page from before the one-ledger rebuild. Cash Outflows
   is a TAB on Money Out now, over the same ledger, and the page was retired outright in 2026-08:
   its last door was the "Go There" button on the Money Out add form, and the page it opened
   disagreed with the tab it duplicated -- its stat card summed a PROJECTION under labels identical
   to the tab's ledger totals ($4,000 / $30,000 against $6,800 / $26,600 on the same data). It also
   still rendered a Recurring checkbox, How often and Ends after, long after recurrence stopped
   being something an operator declares.

   WHAT IS LEFT IS THE WRITE PATH, and both members are called from hub-operating-expenses.js:
     _writeCashRow   - the ONLY sanctioned way to create or update a cash row
     _deleteCashRow  - the ONLY sanctioned way to remove one
   Money Out's own doors delegate to these for cash rows. Pinned by verify-outflow-write-path.js
   and by verify-money-out-write-doors.js sections A and B.

   !! 25 members were cut with the screen: open, draw, wire, statsCard, addCard, loggedSection,
   recurringSection, activeRecurring, saveAdd, clearAdd, openModal, del, repeat, stop, typeOptions,
   onSel, records, periodBounds, _period, _periodForDate, _setPeriodFor, _recurTag, fmtYm, PERIODS,
   TYPES. They were a FIXPOINT off these two, not a list: `stop` and `repeat` looked live right up
   until the five orphaned recurring members were deleted from hub-operating-expenses.js, and those
   two alone were holding the entire render tree alive. Delete order mattered.

   !! DO NOT re-add an `open()` here. app.js has no 'cash-outflows' route, hub.js has no action for
   it, and the help topic is gone; the operating-expenses topic covers the tab instead. */

S.HubCashOutflows = {
  async _writeCashRow(rec) {
    /* ⛔ THE MAPPING IS IDEMPOTENT OVER ITS OWN OUTPUT, WHICH IS WHY THIS TAKES EITHER SHAPE. Every
       caller here reads `records()` — `CashEngine.cashOutflows()`, i.e. LEDGER rows — so `stop` and
       the modal save were already handing ledger rows to this mapping before E. It reads
       id/date/type/amount/notes/created_at plus the recurring fields and sets `category` and
       `migrated_from` FRESH every time, so a row fed back through comes out unchanged. Measured,
       not assumed: block A of `verify-cash-doors-equality.js`.
       ⭐ AND IT MUST STAY THE ONE MAPPING. Patching the ledger row in place is the obvious shortcut
       and it drifts — `category` is DERIVED from `type`, so the two stop agreeing the first time
       either is edited, and a draw ends up printed on the Income Statement. */
    return App.putRecord('core', 'operating_expense',
      S.HubOperatingExpenses.migrateCashOutflowRow(rec));
  },

  async _deleteCashRow(id) {
    /* ⛔ NEVER DELETE SOMEBODY ELSE'S ROW ON AN ID COLLISION, and this guard matters MORE now than it
       did with two stores: the ledger holds the operator's real bills alongside these, so an id that
       is not a cash row belongs to a bill they typed. The stamp is the only safe discriminator — the
       CATEGORY is a name they can type, so an expense they filed under a category called "Owner
       Draw" is their bill and must survive this. Same predicate the engine's reader uses, from the
       other side, so a row is on exactly one of the two lists.
       ⚠ A row that is not there at all is not an error: removing nothing is a successful delete. */
    const led = S.HubOperatingExpenses.records().find(r => r && r.id === id) || null;
    if (led && led.migrated_from !== 'cash_outflow') return false;
    return App.removeRecord('core', 'operating_expense', id);
  }
};
