'use strict';

/* ── PosIngest — one place that turns POS/timeclock export rows into records ───
   The three recurring POS imports (Hours, Tips, Voids/Comps) each used to carry
   their own parse -> match -> dedup -> save logic baked into the screen. That
   logic now lives here, ONCE, with no DOM, so the three per-page import lanes
   (Log Hours, Tip Log, Void/Comp) match, dedup, and save identically and can
   never drift.

   Each type:
     FIELDS[type] - the column-mapping field config handed to CSVMapper.mount
     TYPES[type]  - { label, module, kind } for App.putRecord
   build(type, rows) -> { toAdd, skipped, dupCount }   (pure; rows already mapped
                          to {key:value} by CSVMapper.onComplete)
   commit(type, toAdd) -> bool                          (persists via putRecord)   */

const PosIngest = {
  FIELDS: {
    hours: [
      { key: 'name',  label: 'Staff Name', required: true,  match: ['employee', 'employee name', 'name', 'staff', 'staff name', 'server', 'server name', 'team member', 'worker', 'crew', 'associate', 'full name', 'first name', 'last name'] },
      { key: 'date',  label: 'Date',       required: true,  match: ['date', 'work date', 'shift date', 'business date', 'day', 'clock date', 'worked date', 'date worked', 'pay date', 'shift day'] },
      // This field is TOTAL hours worked. Two classes of string are banned from it:
      //  - a bare 'time': every timeclock export leads with "Time In" / "Time Out", so it
      //    imported a clock time as hours worked ("17:00" -> 17.0 hours) and flagged the
      //    whole roster for overtime.
      //  - 'reg hours' / 'regular hours': a payroll export (ADP, Paychex, Toast) lists
      //    Regular Hours, Overtime Hours, THEN Total Hours, and the matcher takes the
      //    first header it matches in file order. A 45-hour week imported as 40, and
      //    App.otPremiumForRows then saw 40 and computed a ZERO premium, silently
      //    undoing the overtime work everywhere else. Regular hours are not total hours.
      // A file with no single total column stays unmapped so the operator picks it.
      { key: 'hours', label: 'Hours',      required: true,  match: ['hours', 'total hours', 'hrs', 'worked', 'hours worked', 'total hrs', 'hrs worked', 'labor hours', 'paid hours', 'net hours', 'duration', 'total time'] },
      { key: 'shift', label: 'Shift',      required: false, match: ['shift', 'shift type', 'daypart', 'shift name', 'department', 'am/pm', 'meal period'] }
    ],
    tips: [
      { key: 'name',      label: 'Staff Name', required: true,  match: ['employee', 'employee name', 'name', 'staff', 'staff name', 'server', 'server name', 'bartender', 'team member', 'waiter', 'full name', 'first name', 'last name'] },
      { key: 'date',      label: 'Date',       required: true,  match: ['date', 'business date', 'work date', 'shift date', 'day', 'service date', 'pay date'] },
      { key: 'card_tips', label: 'Card Tips',  required: false, /* ⚠ `credit card` is explicit because `card` became EXACT_ONLY (see csv-mapper). Before that, bare
         `card` word-matched INSIDE "Credit Card" and bound it by accident; the moment it stopped
         hunting, a tips export headed just "Credit Card" silently stopped importing card tips.
         Caught in the blast-radius run of that change, not after it — this is the one regression in
         1,242 door × header bindings, and the other 15 were all wrong bindings going away. */
/* ⚠ AND THE SINGULAR AND PREFIXED FORMS TOO. Adding bare `credit card` fixed only a header that IS
         exactly "Credit Card" — because `credit card` is itself EXACT_ONLY. "Credit Card Tip"
         (singular), "Card Tip", "Tips - Credit Card" and "Tips (Credit Card)" were all still lost,
         and a lost tips column imports $0.00 in silence: measured, a $300 tip day became $40. */
        match: ['card tips', 'card tip', 'credit tips', 'credit tip', 'cc tips', 'card', 'credit card tips', 'credit card tip', 'credit card', 'tips - credit card', 'tips (credit card)', 'tips - card', 'charged tips', 'non-cash tips', 'non cash tips', 'noncash tips', 'charge tips', 'charge tip', 'tips charged', 'electronic tips', 'card gratuity', 'credit card gratuity', 'auto gratuity', 'autograt'] },
      { key: 'cash_tips', label: 'Cash Tips',  required: false, match: ['cash tips', 'cash tip', 'cash', 'declared cash tips', 'declared tips', 'declared', 'cash gratuity', 'tips cash', 'tips - cash', 'tips (cash)'] },
      { key: 'shift',     label: 'Shift',      required: false, match: ['shift', 'shift type', 'daypart', 'shift name', 'meal period'] }
    ],
    voids: [
      { key: 'amount', label: 'Amount',       required: true,  match: ['amount', 'total', 'value', 'comp amount', 'void amount', '$', 'amt', 'dollars', 'discount', 'discount amount', 'total amount', 'comp total', 'void total'] },
      /* ⚠ THE TYPE COLUMN HAS TO BIND ON A DISCOUNT/COMP EXPORT, or the whole comp-vs-void split is
         inert on the files it exists for. Real header rows:
             Business Date | Discount Name | Discount Type | Discount Amount | Employee
             Date | Employee Name | Comp/Promo Name | Amount | Reason | Approved By
         `type` is EXACT-ONLY (it word-matches "Item Type", "Payment Type"), so it cannot reach
         inside "Discount Type" — and none of the other candidates matched either, so the field came
         through UNMAPPED, every row defaulted to Void, and a $840 discount export imported as $840
         of Voids and $0 of Comps: Comp Total $0, Given Away $0, "% of Sales" a dash, and Server
         Check's per-server comp% theft signal reading zero.
         The precise terms go FIRST (a match array is a priority list). 'category' stays LAST — on a
         void report it is usually the MENU category, not void-vs-comp. */
      { key: 'type',   label: 'Void or Comp', required: false, match: ['void/comp', 'void or comp', 'discount type', 'comp type', 'void type', 'adjustment type', 'reason type', 'discount name', 'comp/promo name', 'promo name', 'comp name', 'type', 'transaction type', 'transaction', 'kind', 'action', 'category'] },
      { key: 'item',   label: 'Item',         required: false, match: ['item', 'item name', 'product', 'product name', 'menu item', 'description', 'sku', 'plu'] },
      { key: 'server', label: 'Server',       required: false, match: ['server', 'server name', 'employee', 'employee name', 'name', 'staff', 'bartender', 'cashier', 'authorized by', 'approved by', 'voided by', 'comped by', 'manager'] },
      { key: 'reason', label: 'Reason',       required: false, match: ['reason', 'comp reason', 'void reason', 'note', 'notes', 'memo', 'comment', 'explanation'] },
      { key: 'date',   label: 'Date',         required: false, match: ['date', 'business date', 'shift date', 'day', 'transaction date', 'service date'] }
    ],
    // A POS "sales by day" report: one row per day. Bar/food (revenue centers)
    // optional but at least one is needed; covers optional. Writes one per-day
    // record into sc_shifts (revenue/covers, no live-shift cruft).
    sales: [
      { key: 'date',   label: 'Date',       required: true,  match: ['date', 'business date', 'day', 'service date', 'business day', 'sales date', 'trans date', 'date of sale'] },
      { key: 'bar',    label: 'Bar Sales',  required: false, match: ['bar sales', 'bar revenue', 'bar', 'beverage', 'liquor sales', 'beverage sales', 'drink sales', 'drinks', 'drink', 'liquor', 'alcohol', 'wet sales', 'beverage revenue', 'drink revenue', 'bar total', 'beverage total', 'alcohol sales'] },
      { key: 'food',   label: 'Food Sales', required: false, match: ['food sales', 'food revenue', 'food', 'kitchen', 'floor', 'floor sales', 'kitchen sales', 'food total', 'dining', 'dining sales', 'meal sales', 'dry sales', 'kitchen revenue', 'entree sales'] },
      { key: 'covers', label: 'Covers',     required: false, notLoss: true, match: ['covers', 'covers count', 'guest count', 'guests', 'guest ct', 'headcount', 'heads', 'patrons', 'customers', 'checks', 'check count', 'tickets', 'transactions', 'orders', 'sales count'] }
    ],
    // A POS cash / drawer report: per-day, optionally per-register. The POS blind
    // close already computed over/short, so the cash-variance pattern recovery
    // reads comes from this import, not a hand reconcile. Takes Over/Short
    // directly, OR Expected + Counted. Writes sc_variances.
    cash: [
      { key: 'date',       label: 'Date',          required: true,  match: ['date', 'business date', 'day', 'service date', 'shift date', 'business day'] },
      // NOT a bare 'pos': it eats the "POS Cash" column, which is this file's Expected
      // Cash, and files a dollar amount as the register name.
      { key: 'drawer',     label: 'Register',      required: false, match: ['drawer', 'register', 'till', 'station', 'terminal', 'device', 'workstation', 'reg', 'register name', 'till id', 'drawer id', 'terminal id'] },
      { key: 'cashier',    label: 'Cashier',       required: false, match: ['cashier', 'server name', 'server', 'employee name', 'employee', 'team member', 'staff name', 'staff', 'bartender', 'clerk', 'operator', 'user', 'name'] },
      // Expected = cash sales + starting bank - paid-outs. NOT 'cash sales' / 'net cash':
      // those are a different quantity, and mapping them makes buildVoids prefer a bogus
      // counted-minus-sales subtraction over the POS's own authoritative Over/Short.
      { key: 'expected',   label: 'Expected Cash', required: false, match: ['expected cash', 'expected drawer', 'expected total', 'expected amount', 'expected', 'system cash', 'system total', 'sys cash', 'pos cash', 'cash due'] },
      // NOT 'bank': on a drawer report "Bank" is the opening float, not the count.
      { key: 'counted',    label: 'Counted Cash',  required: false, match: ['counted cash', 'cash counted', 'counted total', 'drawer count', 'actual drawer', 'actual cash', 'actual amount', 'cash in drawer', 'ending cash', 'deposit amount', 'cash deposited', 'counted', 'actual', 'deposited'] },
      { key: 'over_short', label: 'Over / Short',  required: false, match: ['over/short', 'over short', 'variance', 'difference', 'discrepancy', '+/-', 'short/over', 'over', 'short', 'cash variance', 'diff', 'variance amount'] }
    ],
    // A POS per-server sales report: one row per server (per day). Covers + sales
    // give the check average (Server Check). Matches the server to the roster by
    // name; writes revenue_server_check records. Comps/tips already auto-join from
    // the Void/Comp log and Tip Tracking, so they are not needed here.
    server: [
      { key: 'name',   label: 'Server',      required: true,  match: ['server name', 'server', 'employee name', 'employee', 'team member', 'team member name', 'staff name', 'staff', 'bartender', 'name', 'staff name', 'waiter', 'sales rep', 'attendant'] },
      { key: 'date',   label: 'Date',        required: true,  match: ['date', 'business date', 'shift date', 'service date', 'day', 'business day'] },
      /* ⚠ GUEST COUNT FIRST. A check/order/ticket count is a DIFFERENT QUANTITY and every one of
         Aloha, Revel, Clover and SpotOn prints it to the LEFT of the guest count — so under the
         old column-order matching it won, and a real Revel row (52 orders / 118 guests / $3,800)
         put every server on the scorecard at a $73.08 check average against a true $32.20. The
         contract is spelled out in confirm-week.js: check average is per-GUEST, so the numerator
         and the cover population have to match. They stay as last-resort candidates because some
         exports carry nothing else. */
      { key: 'covers', label: 'Covers',      required: true,  notLoss: true, match: ['covers', 'guest count', 'guests', 'guest ct', 'headcount', 'customers', 'checks', 'check count', 'tickets', 'tables', 'transactions', 'orders'] },
      /* ⚠ NET BEFORE GROSS, and bare 'gross' is gone. Aloha, Lightspeed, TouchBistro and Square
         all print Gross Sales before Net Sales, so gross was winning — counting the comps and
         promos the operator already gave away as that server's own sales, which then drives the
         check average and the comp% signal. Bare 'amount'/'total' stay last: they are what an
         order-detail export calls its money column when it calls it nothing better. */
      // ⚠ `sales amount`/`sales $`/`sales value` explicit: bare `sales` is EXACT_ONLY now (it was
      // reading "Sales Tax" and "Cash Sales" as a server's whole sales figure), so these real
      // headers bound nothing. REQUIRED here, so the import blocks rather than importing zeros —
      // loud and recoverable, but still a file the operator could not import.
      { key: 'sales',  label: 'Total Sales', required: true,  match: ['net sales', 'net total', 'sales total', 'total sales', 'sales amount', 'sales value', 'sales $', 'server sales', 'rung sales', 'sales', 'revenue', 'net', 'gross sales', 'total', 'amount', 'dollars'] },
      { key: 'shift',  label: 'Shift',       required: false, match: ['shift', 'shift type', 'daypart', 'meal period', 'shift name'] }
    ],
    // A POS product-mix (PMIX) report: one row per menu item with units sold for
    // the week. Matches the item to the menu by name and UPDATES weekly_covers in
    // place (no new records), so it has a custom commit (_commitPmix).
    pmix: [
      /* ⚠ 'sku' AND 'plu' ARE GONE, and bare 'menu' with them. Toast's ItemSelectionDetails.csv
         prints SKU and PLU columns BEFORE "Menu Item" and leaves them blank unless the operator
         fills them in, so the importer bound the name to an empty column and read ZERO rows off a
         file whose item names were right there. Bare 'menu' is the surviving half of the same
         incident: on a product mix grouped by menu it bound "Menu Name", which holds Dinner /
         Brunch / Bar, and reported those as unmatched item names. An identifier is not a name. */
      { key: 'name',  label: 'Item Name',  required: true, match: ['menu item name', 'menu item', 'item name', 'product name', 'item description', 'description', 'item', 'product', 'name'] },
      /* ⚠ EXPLICIT SOLD-TERMS FIRST. NOT a bare 'each': it grabs an "Each Price" column, and
         $12.50 strips to 1250 units sold, which moves the item's whole Menu Engineering quadrant.
         'count' is gone: it claimed a "Count Date" column on a stock-count export and stored the
         date as units. Toast prints "Item Qty (incl voids)" to the LEFT of the net "Item Qty", so
         the precise terms have to come first or voided plates count as sold.
         ⚠ KNOWN LIMIT, not solvable by name: 'quantity' is the units-sold column on a Clover or
         Lightspeed ITEM SALES report and the on-hand column on the same vendors' INVENTORY export.
         Same word, two meanings, so an inventory file dropped on this door still needs the
         operator to read the preview. It sits last so any real sold-column wins it. */
      /* ⚠ `'rung'` REMOVED — it is a DOLLAR term, not a units one. It word-matches "Rung Sales", a
         real Aloha/NCR header this file asks for by name in FIELDS.server, so on
         `Item Name | Rung Sales | Net Sales` the units field took the money column and Menu
         Engineering's `weekly_covers` was fed dollars. Same removal at the variance door. */
      { key: 'units', label: 'Units Sold', required: true, match: ['units sold', 'quantity sold', 'qty sold', 'sold qty', 'total sold', 'number sold', 'item qty', 'units', 'sold', 'qty', 'units count', 'sales count', 'quantity'] }
    ]
  },

  TYPES: {
    hours: { label: 'Hours',         module: 'lc', kind: 'actual'    },
    tips:  { label: 'Tips',          module: 'lc', kind: 'tip'       },
    voids: { label: 'Voids & Comps', module: 'sc', kind: 'void_comp' },
    sales: { label: 'Daily Sales',   module: 'sc', kind: 'shift'     },
    cash:  { label: 'Cash Variances', module: 'sc', kind: 'variance' },
    server:{ label: 'Server Sales',  module: 'core', kind: 'revenue_server_check' },
    pmix:  { label: 'Menu Sales Mix', module: 'core', kind: 'menu_item' }
  },

  // Is this cell NEGATIVE? Accounting "(15)", leading "-15", or trailing "15-".
  // ⚠ THE SYMBOL IS STRIPPED BEFORE THE TEST, NOT AFTER (S139). Every branch is anchored to the
  // START or the END of the cell, so ANY character in front of the sign defeats all three — and
  // "$" is always there. "($50)" worked while "$(50.00)" did not, and `$(1,234.56)` is EXCEL'S
  // DEFAULT Accounting format for a negative, i.e. what a POS export becomes the moment it is
  // opened and re-saved. A -$75 drawer stored as +$75 is a $150-wide error that also flips Short
  // to Over, so it reads green everywhere and Loss Prevention never sees it.
  // ⚠ ITS ONLY CALLER IS NOW _hours. _num and _count used to parse signed POS cells through this
  // test; both now delegate to App.parseNum, which does its own sign detection. So this is a
  // SECOND sign implementation with nothing holding it to the first — it survives only because
  // _hours parses "8:30" itself and cannot go through parseNum. Keep them in step by hand, or
  // fold the colon case into parseNum and delete this. verify-pos-number-sign.js covers both.
  _isNeg(s) {
    const t = String(s == null ? '' : s).replace(/[^0-9.,()\-]/g, '');
    return /^\(.*\)$/.test(t) || /^-/.test(t) || /-$/.test(t);
  },

  // Parse a POS number cleanly: strips $ and thousands commas AND handles a
  // NEGATIVE in any common export form — leading "-15", accounting "(15)", or
  // trailing "15-", with or without a currency symbol in front of the sign.
  // Delegates to App.parseNum, the ONE coercion. This file's sign handling was the only correct
  // one in the app and is now the shared behaviour; six other screens booked a "(125.00)" refund
  // as a POSITIVE amount. Keeps this caller's own contract of 0 for a cell with no number, because
  // its callers sum these.
  _num(v) { const n = App.parseNum(v); return n == null ? 0 : n; },

  // Parse a POS COUNT cell (units sold) that may be NEGATIVE — a product return or void reports
  // "-3" / "(3)" / "3-". The old cleaner stripped [^0-9.], so a "-3" return read as +3 and INFLATED
  // the week's units instead of reducing them. Same sign handling as _num, but returns NaN (not 0)
  // for a non-numeric cell, so a junk row is SKIPPED rather than silently counted as zero. Keeps the
  // decimal point so "12.00" is 12, not 1200.
  _count(v) {
    // Same shared coercion, but NaN (not 0) for a junk cell so the row is SKIPPED rather than
    // silently counted as zero, and rounded because this is a unit count.
    const n = App.parseNum(v);
    return n == null ? NaN : Math.round(n);
  },

  // Parse a POS HOURS cell. Timeclock exports commonly give "8:30" (8 hours 30
  // minutes); plain parseFloat("8:30") returned 8 and silently dropped the 30
  // minutes off gross pay, and _num would strip the colon to 830. Handle H:MM
  // explicitly; otherwise fall back to the money-safe cleaner ($/comma tolerant).
  _hours(v) {
    if (v == null) return NaN;
    const s = String(v).trim();
    if (!s) return NaN;
    if (s.indexOf(':') !== -1) {
      // ⚠ THE SIGN BELONGS TO THE WHOLE VALUE, NOT THE HOURS HALF (S139, the twin inside this
      // function). This branch does its own parse, so it never saw _isNeg: parseInt('-8') + 30/60
      // returned -7.5 for minus eight and a half hours, wrong by a full hour on a payroll figure,
      // and the accounting form '(8:30)' was NaN. Strip to digits and the colon, then apply the
      // sign once — which also fixes '$8:30', where parseInt('$8') was already NaN.
      const neg = this._isNeg(s);
      const p = s.replace(/[^0-9:.]/g, '').split(':');
      const h = parseInt(p[0], 10), mn = parseInt(p[1], 10);
      if (isNaN(h) || isNaN(mn)) return NaN;
      const val = h + mn / 60;
      return neg ? -val : val;
    }
    return this._num(s);
  },

  _ymd(y, mo, d) { const p = n => String(n).padStart(2, '0'); return y + '-' + p(mo) + '-' + p(d); },

  // Content-dedup that consumes each existing record AT MOST ONCE, so a file with
  // two legitimately-identical rows (a split shift, two same-value sittings) isn't
  // collapsed to one, while a full re-import of the same file still dedups cleanly.
  _isDup(existing, used, pred) {
    return !!this._findDup(existing, used, pred);
  },
  // Same consume-once search, but hands back the RECORD it matched. buildCash needs
  // to read the match's `source` to decide replace-or-protect, and a bare boolean
  // cannot carry that. _isDup delegates so every other builder is untouched.
  _findDup(existing, used, pred) {
    for (const x of existing) {
      if (used.has(x.id) || !pred(x)) continue;
      used.add(x.id); return x;
    }
    return null;
  },

  /* ⚠ IS THIS NAME A PERSON, OR THE EXPORT'S OWN SUMMARY LINE? Micros, Toast and Aloha all append a
     totals row to a per-server report, and its name cell reads "Total" / "Grand Total" / "All
     Servers". Scored as a person it does real damage in BOTH directions, measured at door 12:
       · its no_sales / voids are the SUM of the floor's, so it drags every team average up and the
         real outlier stops clearing `v > avg * 2` — a bartender at 9 no-sale opens against a floor
         of 2 went from High Risk to CLEAN and the screen printed the green all-clear;
       · it counts toward `reviewed`, so it lifted a two-bartender bar over MIN_TEAM and bought the
         all-clear that the MIN_TEAM caveat exists to prevent;
       · and it can itself be FLAGGED — "TOTAL (High Risk)" printed as a named employee into the PDF
         handed to an owner.
     ⚠ A WHITELIST OF WHOLE-CELL NAMES, NOT A SUBSTRING TEST. "Total" as a token would eat a real
     person ("Total Wine rep", a server nicknamed "Subtotal"), and this project has been burned four
     times by a stem test matching a word inside a longer one ("Monthly" read as Monday). The cell
     must BE one of these, punctuation and case aside, or it is a person.
     ⚠ Lives here, not privately at one door: the same summary line lands on every per-server sales
     door (4, 11 and 12), and a private copy is a copy that has already drifted. */
  SUMMARY_NAMES: ['total', 'totals', 'grand total', 'grand totals', 'sum', 'sums', 'subtotal',
    'subtotals', 'all servers', 'all employees', 'all staff', 'report total', 'report totals',
    'overall total', 'total all', 'totals all', 'summary', 'net total', 'gross total',
    'total sales', 'total revenue', 'totals sales',
    /* ⚠ THE SPACED AND HYPHENATED FORMS. `subtotal` was whitelisted and "Sub Total" / "Sub-Total"
       were not, because the strip splits them into two words and the closed-up entry no longer
       matches. Measured on the Anchor file plus one "Sub Total" row: "Servers reviewed 7" for a
       six-person bar, the real skimmer's peer floor lifted 1.2 → 3.2 opens a shift, and a card and
       a PDF section headed **"Sub Total (Watch)"**. On a two-bartender bar the same row cleared
       MIN_TEAM and replaced the honest caveat with the green all-clear. */
    'sub total', 'sub totals', 'combined total', 'combined totals', 'overall', 'grand sum',
    'total all servers', 'totals all servers', 'all servers total', 'all servers totals',
    'total for all servers', 'totals for all', 'total for all', 'total all employees',
    'all employees total'],
  /* ⚠ A QUALIFIER IN FRONT OF "TOTAL" IS STILL A TOTALS LINE. The bare-forms-only whitelist let
     "Bar Total", "Server Total", "Employee Total" and "Grand Total (All)" through as PEOPLE, and one
     of them flipped a verdict: adding a single "Bar Total" row to a clean five-server file lifted
     the team mean past the real outlier's `v > avg * 2` and the screen printed the GREEN ALL-CLEAR
     over a named skimmer. On a two-bartender bar it also pushed `reviewed` from 2 to 3, clearing
     MIN_TEAM and replacing the team caveat with the all-clear. Both are verbatim the damage this
     function exists to prevent. The qualifier list is CLOSED — a fixed vocabulary of things a POS
     groups a subtotal by — so it can never eat a person's name. */
  SUMMARY_QUALIFIERS: ['bar', 'house', 'kitchen', 'floor', 'patio', 'restaurant', 'venue',
    'server', 'servers', 'employee', 'employees', 'staff', 'cashier',
    'cashiers', 'bartender', 'bartenders', 'team', 'section', 'department', 'dept', 'store',
    'location', 'shift', 'day', 'daily',
    'weekly', 'monthly', 'period', 'revenue centre', 'revenue center', 'terminal', 'register',
    /* ⚠ `daily`/`weekly`/`monthly` were here and their BARE NOUNS were not, so "Weekly Total" was
       caught and **"Week Total" / "Month Total" / "Year Total" were scored as people**. Adding the
       nouns also fixes "Total for the Week", which a comment one round ago claimed was handled and
       measurement showed was not. `page` joins for the paginated "Page 1 Total" shape. None of these
       is a surname on its own, and a qualifier only ever matches BESIDE a total word, so a person
       called Page or Day is untouched. */
    'week', 'month', 'year', 'quarter', 'page', 'job', 'category', 'group', 'sales', 'revenue'],
  /* The role words a POS groups an "All <role>" or "Total All <role>" line by. Kept as its own
     closed vocabulary because three separate tests below need the same list, and when they were
     spelled out inline they drifted: two of them accepted only servers/employees/staff, so
     "All Cashiers" and "Total All Cashiers" were scored as people. */
  /* ⚠⚠ `crew` WAS IN THIS LIST FOR ONE ROUND AND IT IS A REAL SURNAME (Crew, Crewe). Removed.
     A role word only belongs here when NO ONE IS NAMED IT — which is why the PLURALS are safe and
     the singulars mostly are not. The singular forms that remain are the ones already proven safe as
     repeated mid-file HEADERS in `SUMMARY_HEADERS`; they are not new exposure. */
  SUMMARY_ROLES: ['servers', 'server', 'employees', 'employee', 'staff', 'cashiers', 'cashier',
    'bartenders', 'bartender', 'team members', 'team member', 'personnel'],
  /* ⚠ AND A ROW THAT IS NOT A NAME AT ALL IS NOT A PERSON EITHER. A separator ("-----", "===") or a
     repeated mid-file HEADER ("Server") was scored as a server: the report then printed
     "Not enough data to score: -----, Server, ===" to the operator, and three junk names were enough
     to trip the not-enough-scored caveat over an otherwise clean file. */
  SUMMARY_HEADERS: ['server', 'servers', 'employee', 'employee name', 'name', 'staff', 'cashier',
    'bartender', 'team member', 'server name', 'staff name'],
  isSummaryName(name) {
    const raw = String(name == null ? '' : name);
    /* ⚠⚠ THE SEPARATOR TEST MUST ASK ABOUT LETTERS IN ANY SCRIPT, NOT ASCII ONES. Stripping to
       `[^a-z0-9\s]` reduced 王伟, Дмитрий, محمد, Ελένη, あきら and 김민 to EMPTY, and the separator
       branch then classified each of them as a totals line — so a server with a non-Latin name was
       deleted from a theft report outright: never scored, never flagged, never listed as unscored,
       and the intake note told the operator their shifts were "totals rows skipped". Measured: the
       same file with the name spelled "Dmitri" flagged him High Risk with $678 of exposure.
       This is the worst thing in the door and it was mine, from a guard added an hour earlier. */
    const hasWordChar = /[\p{L}\p{N}]/u.test(raw);
    if (!hasWordChar) return /\S/.test(raw);   // a rule of dashes or equals signs is not a person
    // Only ASCII-normalisable cells can be summary vocabulary; anything else is a name.
    const n = raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!n) return false;
    if (this.SUMMARY_NAMES.indexOf(n) >= 0) return true;
    if (this.SUMMARY_HEADERS.indexOf(n) >= 0) return true;
    /* ⚠ BOTH WORD ORDERS. The qualifier vocabulary was consulted only for "<qualifier> Total", so
       "Bar Total" was caught and **"Total Bar" was not** — and "Total Bar" / "Total (Bar)" is the
       spelling Aloha, Micros and Toast use for a revenue-centre subtotal. One such row added to a
       five-server file printed "Servers reviewed 6" for a five-person bar and dropped the real
       skimmer from High Risk to Watch; on a two-bartender bar it cleared MIN_TEAM and replaced the
       honest caveat with a green all-clear listing "Total Bar" as a scored server. */
    const q = '(?:' + this.SUMMARY_QUALIFIERS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')';
    // `running`/`page`/`cumulative` join the lead words: "Running Total" and "Page Total" are what a
    // paginated Micros or Aloha export prints at every page break, and both were scored as people.
    const lead = '(?:grand|report|overall|final|net|gross|sum|running|page|cumulative|closing|ending)';
    const scope = '(?:all|combined|everyone|everything)';
    if (new RegExp('^' + lead + '?\\s*(?:total|totals)(?:\\s+' + scope + ')?$').test(n)) return true;
    if (new RegExp('^' + q + '\\s+(?:total|totals)$').test(n)) return true;             // "Bar Total"
    /* ⚠ `per` WAS GIVEN TO THE STATISTICS TEST AND NOT TO THIS ONE, three lines apart in the same
       edit — so "Average per Server" was caught and **"Total per Server" was scored as a PERSON**.
       Measured: adding one "Total per Server" row to a two-bartender file took `reviewed` from 2 to
       3, which clears MIN_TEAM, engaged scoring, replaced the team-too-small caveat, and listed the
       row itself as a scored server. That is verbatim the failure the qualifier block above exists
       to prevent, still open through one preposition. The two tests take the same prepositions now. */
    if (new RegExp('^(?:total|totals)(?:\\s+(?:for|by|per))?\\s+' + q + '$').test(n)) return true;  // "Total Bar", "Total for Bar", "Totals per Server"
    if (new RegExp('^' + q + '\\s+\\d+\\s+(?:total|totals)$').test(n)) return true;     // "Store 3 Total"
    /* ⚠ THE LEAD AND SCOPE WORDS HAVE TO COMBINE. "Grand Total" was caught and **"Grand Total (All
       Servers)"** was not, because the leading-qualifier regex and the `all servers` phrases were
       two separate tests that could not meet. Measured: that one row made a real outlier read CLEAN
       and was itself listed as a scored server. Same for "Totals All Employees". */
    const role = '(?:' + this.SUMMARY_ROLES.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')';
    if (new RegExp('^' + lead + '?\\s*(?:total|totals)\\s+(?:for\\s+)?all\\s+' + role + '$').test(n)) return true;
    if (new RegExp('^all\\s+' + role + '(?:\\s+(?:total|totals))?$').test(n)) return true;
    /* "Totals for the Day", "Total for the Week" — the article is what stopped the qualifier test.
       ⚠ THE PREVIOUS VERSION OF THIS COMMENT NAMED "Total for the Week" AND THE CODE DID NOT CATCH
       IT, because `week` was not a qualifier. A comment asserting coverage the code lacks is worse
       than no comment: it is an instruction to the next reader not to check. Both are measured now. */
    if (new RegExp('^(?:total|totals|subtotal|subtotals)\\s+(?:for|by|per)\\s+the\\s+' + q + '$').test(n)) return true;
    /* The remaining real spellings a paginated or grouped export prints, all measured as scored
       PEOPLE before this line existed: "Page 1 Total", "Page Subtotal", "Total of All",
       "End of Report", "Report Total". */
    if (new RegExp('^' + q + '\\s+\\d+\\s+(?:sub)?(?:total|totals)$').test(n)) return true;
    if (new RegExp('^' + q + '\\s+(?:sub)?(?:total|totals)$').test(n)) return true;
    if (new RegExp('^' + lead + '?\\s*(?:sub)?(?:total|totals)\\s+of\\s+' + scope + '$').test(n)) return true;
    if (/^end of (?:report|file|data|list)$/.test(n)) return true;
    // A bare plural role word is the export's own roll-up line, not somebody's name.
    if (new RegExp('^' + role + '$').test(n)) return true;
    /* ⚠⚠ THE AVERAGE ROW HAD NONE OF THE QUALIFIER MACHINERY THE TOTAL ROW HAD — a flat alternation
       of five bare words, while "total" got five combining tests. Measured, every one of these was
       scored as a PERSON: Bar Average · Server Average · Daily Average · Shift Average · Weekly
       Average · Grand Average · Overall Average · Average by Server · Team Average · Average per
       Server · Avg per Shift. And an average row is WORSE here than a totals row: its values sit at
       the team mean by construction, so it does not merely lift `reviewed` past MIN_TEAM — it drags
       the floor toward itself, which is the direction that makes a real outlier read clean. Verified
       reaching door 12: appending one "Team Average" row took `reviewed` from 5 to 6 with
       `summaryRows` still 0, and the row was listed on screen as a scored server. */
    /* ⚠⚠ `means` WAS HERE FOR EXACTLY ONE ROUND AND IT DELETED A REAL PERSON. **Means is a US
       surname** (Russell Means, Gardiner Means; ~12,000 US bearers), so a server named Means was
       classified as a statistics row: never scored, never flagged, never listed as unscored, and the
       intake note told the operator "1 totals row skipped". Measured on the identical file with only
       the name changed — "Brianna K." flagged High Risk on four signals, "Means" produced
       **flagged 0, reviewed 5, summaryRows 1** and a green all-clear over 9 drawer opens, $90 of
       voids and a 47% cash mix.
       This is the THIRD time this function has eaten a person: the ASCII separator guard took every
       non-Latin name, bare `grand` took a surname, and now `means`. **Every word added here is a
       policy about whose name counts.** No POS writes a bare "Means" as a statistics label; it
       writes "Mean" or "Average". `avgs` and `summaries` stay — nobody is named those. */
    const stat = '(?:average|averages|avg|avgs|mean|median|summary|summaries|report summary|summary total)';
    if (new RegExp('^' + lead + '?\\s*' + stat + '(?:\\s+' + scope + ')?$').test(n)) return true;
    if (new RegExp('^' + q + '\\s+' + stat + '$').test(n)) return true;                            // "Bar Average"
    if (new RegExp('^' + stat + '(?:\\s+(?:for|by|per))?\\s+' + q + '$').test(n)) return true;     // "Average by Server", "Avg per Shift"
    if (new RegExp('^' + q + '\\s+\\d+\\s+' + stat + '$').test(n)) return true;                    // "Store 3 Average"
    if (new RegExp('^' + lead + '?\\s*' + stat + '\\s+all\\s+' + role + '$').test(n)) return true;
    /* ⚠⚠ "GRAND" IS A REAL SURNAME AND THIS DELETED THE PERSON WHO HAS IT. A bare `grand` was
       whitelisted as a totals row, so a server named Grand was dropped before scoring — never
       flagged, never listed as unscored — and the intake note told the operator their shifts were
       "totals rows skipped". That is the same disappearance the non-Latin-script guard above was
       written for, arriving through the vocabulary instead of the character class. No POS writes a
       bare "Grand" as a subtotal; it writes "Grand Total", which every test above already catches.
       ⚠ Measured across 90 person names, this was the ONLY false positive in the function. */
    return /^all$/.test(n);
  },

  // Normalize a POS date cell to canonical local YYYY-MM-DD (App.ymdLocal's
  // format), handling ISO, US MM/DD/YYYY, M/D/YY, and dash variants. The old code
  // only handled ISO (it appended 'T00:00:00' to everything), so MM/DD/YYYY became
  // Invalid Date and was stored raw — silently breaking dedup and week grouping.
  // Returns '' (not the raw string) when unparseable, so a bad row is skipped
  // rather than stored with a date that no comparison will ever match.
  /* Normalize a POS date cell to canonical local YYYY-MM-DD (App.ymdLocal's format).

     ⚠⚠ THIS PARSES EXPLICITLY. IT NEVER HANDS FREE TEXT TO `new Date()`. That is the whole point of
     the rewrite, and it was earned the hard way: five consecutive scan rounds each found that the
     PREVIOUS round's guard was itself writing wrong data, because every one of them was patching a
     fallback that let V8's legacy parser guess. That parser is unspecified, month-first, silently
     lenient, and it invents what it cannot read. What it did to real files:
       · a MISSING YEAR became 2001, so Excel's built-in d-mmm format ("20-Jul") imported a week
         25 years into the past and no undated guard could catch it, because the parse "succeeded";
       · a DAY-FIRST numeric export ("06.07.2026") was read month-first with no swap, scattering one
         week of hours across seven months, four of them in the future;
       · an IMPOSSIBLE date ROLLED OVER instead of being refused — "Feb 29 2026" became 1 March and
         "Apr 31 2026" became 1 May, so a 31-row sheet for a 30-day month banked two people's hours
         onto one day and reported it as a clean import;
       · a UTC marker moved the business date back a day (`ymdLocal` of a UTC-anchored instant);
       · a month-labelled column ("Jul 2026") silently became the 1st.
     Each of those was invisible: the row imported, so nothing was ever reported as skipped.

     THE RULE NOW: a date is read only if it matches one of four explicit shapes AND the y/m/d it
     yields is a date that actually exists. Anything else returns '' and the door reports the row.
     Refusing a shape is cheap — the operator re-exports. Guessing it is not: every consumer windows
     by date, so a wrong date is silently missing money in one week and invented money in another.

     ⚠ DOT-SEPARATED ALL-NUMERIC DATES ARE DELIBERATELY REFUSED. "06.07.2026" is the European
     day-first convention, and Bar Cop reads slash/dash numerics month-first (the US convention).
     Reading dots month-first would be wrong more often than right, and there is nothing in the cell
     to disambiguate — so it is refused and named, rather than guessed. Do not "fix" this by adding
     '.' to the numeric branch without deciding the day-first question first.

     Handles: ISO YYYY-MM-DD, US M/D/YYYY and M/D/YY (with a day-first swap when the first field
     cannot be a month), and both word-month orders (20-Jul-2026, Jul 20 2026, "July 20, 2026"),
     each with an optional trailing time or timezone, and an optional leading weekday. */
  MONTHS: { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 },

  /* ⭐ S199 — DAY-FIRST IS A PROPERTY OF THE FILE, NOT OF THE CELL. Read the date column ONCE and
     hand the verdict to normDate; normDate itself stays per-cell and pure.

     THE DEFECT THIS EXISTS FOR: normDate's own `a > 12 && b <= 12` is a per-cell rescue, so in ONE
     DD/MM/YYYY file the rows dated 13-31 flipped and read correctly while the rows dated 1-12 stayed
     month-first and transposed. A real week, Mon 29 Jun to Sun 5 Jul 2026, landed as
     Jun 29 · Jun 30 · JAN 7 · FEB 7 · MAR 7 · APR 7 · MAY 7 — five of seven rows in the wrong month,
     nothing skipped, nothing reported, and buildSales aggregates by date so the money went with
     them. Because two rows DID read correctly, the import looked like it worked.
     ⚠ The tell that this was a bug rather than the documented US-month-first policy: Bar Cop already
     REFUSES the dotted day-first form ("06.07.2026") and NAMES it, on the stated grounds that there
     is nothing in the cell to disambiguate. There is nothing in the SLASH cell either.

     THREE VERDICTS, and the third is the one that keeps this honest:
       · 'day'   — some row's FIRST field is >12, so it cannot be a month. The file is day-first.
       · 'month' — some row's SECOND field is >12. Month-first, which is also the default.
       · 'none'  — no row disambiguates (a window of 12 days or fewer). Genuinely undecidable, so it
                   stays month-first: unchanged from today, and the US reading is the right default.
       · 'both'  — the file contradicts ITSELF. Not guessable, so nothing is forced: the per-cell
                   reading is kept (every row that can only be read one way still is) and the door
                   REPORTS it rather than picking a side.
     ⚠ A US EXPORT MUST COME OUT BYTE-IDENTICAL. Detection that fired on a US file would be far worse
     than the bug it fixes — see THE LOOP, "a guard is a change, not a safety net". Only the
     all-numeric slash/dash shape is ambiguous at all, so ISO and word-month rows cast NO vote. */
  dateConvention(rows, key, opts) {
    const k = key || 'date';
    // ⚠ NUMBERS, NOT BOOLEANS. These stayed `false` when the votes became counts, so a file with no
    // day votes returned `dayVotes: false` — `=== 0` is false against it and it renders as "false"
    // in any message. Nothing read them yet, which is the only reason it was harmless.
    let day = 0, month = 0;
    /* ⚠⚠ ONLY A CELL THAT WILL ACTUALLY IMPORT MAY VOTE — AND THE ONLY HONEST WAY TO ASK THAT IS TO
       ASK normDate ITSELF. The first version of this function matched a regex with a permissive
       `(?:[T\s,].*)?$` tail, while normDate's `tailOk` accepts only a clock or a zone. Everything in
       that gap voted and then imported as NOTHING: a period/range header row ("30/06/2026 -
       06/07/2026" — named in normDate's own comment as a very common export header), "15/07/2026
       EST", "15/07/2026 (adj)", even the impossible "99/1/2026".
       ⛔ THAT WAS A NEW WAY TO CORRUPT A US FILE, which is the one thing this whole change exists to
       be safe about. Measured: a clean US week 07/01-07/03 with ONE range header row on top imported
       as 2026-01-07, 2026-02-07, 2026-03-07 — January, February and March — while the header row
       itself imported as nothing at all. A row that contributes NO DATA must never decide how every
       other row is read.
       Probing with the real reader (rather than copying tailOk here) is also what stops the two from
       drifting apart the next time either is touched. */
    /* ⚠ ONE PROBE, NOT TWO. This asked `probe(s,false) || probe(s,true)`. Measured exhaustively over
       all 1,089 `a/b/2026` shapes: there is NO cell that fails month-first and parses day-first,
       because normDate's own per-cell `a > 12 && b <= 12` rescue already reads day-first whenever
       month-first is impossible. The second call was dead code in a per-row loop. */
    const probe = s => this.normDate(s, Object.assign({}, opts, { dayFirst: false }));
    (rows || []).forEach(r => {
      if (!r) return;
      const s = String(r[k] == null ? '' : r[k]).trim();
      if (!s) return;
      /* Same weekday strip as normDate, or "Mon 20/07/2026" would cast no vote.
         ⚠ THE YEAR IS OPTIONAL IN THIS PATTERN (S200). It used to require three fields, so a
         year-less birthday column — the entire reason yearOptional exists — cast ZERO votes and the
         numeric branch fell back to month-first. Measured: a day-first birthday column
         ["25/12","01/07","03/11","06/09","30/06"] stored 3 of 5 in the WRONG MONTH and said nothing,
         which is the S199 defect reproduced verbatim inside the S200 fix. */
      const m = s.replace(/^(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?,?\s+/i, '')
        .match(/^(\d{1,2})[-/](\d{1,2})(?:[-/]\d{2,4})?(?:[T\s,].*)?$/i);
      if (!m) return;
      if (!probe(s)) return;                 // it imports as nothing: no vote
      const a = +m[1], b = +m[2];
      if (a > 12 && b <= 12) day++;          // field 1 cannot be a month
      if (b > 12 && a <= 12) month++;        // field 2 cannot be a month
    });
    /* ⚠⚠ VOTES ARE COUNTED AND THE MAJORITY WINS. THEY USED TO BE BOOLEANS, AND THAT WAS A GUARD
       THAT REFUSED REAL DATA — the same failure that once destroyed a week of payroll.
       ⛔ MEASURED: a clean 31-row US July file with ONE stray day-first row scored 19 month-first
       votes against 1 day-first, was declared "contradictory", and **refused 07/01 through 07/12 —
       12 days and $18,000 — of a file every one of whose rows had a single correct reading.** At the
       expense door the same shape stopped $8,740 of a $9,139 statement from importing.
       One dissenting row is a typo, not a convention. The majority IS the file's convention, and a
       row that cannot be read that way then fails validation on its own and is reported — which is
       the honest outcome for the odd row rather than a reason to punish the other thirty.
       ⚠ `contradictory` is now reserved for a genuine TIE with evidence on both sides: the only case
       where the file really does not say what convention it uses. Everything else has an answer. */
    /* ⚠⚠ THE MAJORITY MUST BE A MAJORITY OVER A STRAY, NOT OVER A BLOC. Plain `day > month` was the
       round-9 fix for a guard that refused too much, and it then failed the other way: a hand-kept
       expense sheet with 14 day-first rows and 3 hand-typed US rows scored 2 votes to 3, declared
       itself month-first, and put **11 rows / $5,500 into eleven wrong months with nothing refused
       and no warning**. One row disagreeing is a typo; three rows agreeing with each other are a
       second convention, and a file carrying two conventions genuinely does not say which it uses.
       THE 3x RULE IS A JUDGEMENT CALL AND IS WRITTEN DOWN AS ONE: the winner must out-vote the loser
       at least three to one. 19-vs-1 and 30-vs-2 are strays and the file imports whole; 3-vs-2 and
       2-vs-3 are blocs and the coin-toss rows refuse and get named. Rows that can only be read one
       way always import either way — the refusal only ever touches cells where BOTH numbers are 12
       or under, which are the only genuinely undecidable ones.
       ⚠ Unreachable from any single-convention POS export: a DD/MM cell cannot cast a month vote and
       an MM/DD cell cannot cast a day vote, so a clean file of either convention has exactly one
       kind of evidence. This rule only ever fires on a hand-assembled sheet — which is precisely
       what the Operating Expenses door is for. */
    /* TWO WAYS TO BE A STRAY, because one test alone fails at one end or the other:
         · EXACTLY ONE dissenting row is always a typo, at any scale. A ratio test alone breaks here:
           a 14-day window only contains 2 disambiguating rows, so one stray US row makes it 2-vs-1
           and a pure 3x rule would refuse 12 of the 15 rows — the round-9 defect all over again.
         · A ratio for everything else, so two or three typos in a long file are still strays
           (14-vs-2 imports whole) while a genuine second convention is not (3-vs-2 refuses).
       A TIE is never decisive, which is why `win > lose` is required. */
    const DOMINANCE = 3;
    const win = Math.max(day, month), lose = Math.min(day, month);
    const decisive = lose === 0 || (win > lose && (lose === 1 || win >= lose * DOMINANCE));
    const contradictory = lose > 0 && !decisive;
    return {
      dayFirst: day > month && !contradictory,
      contradictory,
      dayVotes: day,
      monthVotes: month,
      evidence: contradictory ? 'both' : (day > month ? 'day' : (month > day ? 'month' : 'none'))

    };
  },
  /* `opts.minYear` exists for ONE caller: ev-regulars imports BIRTHDAYS, which are legitimately
     decades before any business date. Everything else takes the default. */
  normDate(raw, opts) {
    if (raw == null) return '';
    let s = String(raw).trim();
    if (!s) return '';
    const minYear = (opts && opts.minYear) || 1990;
    // A leading weekday carries no date information and defeats every pattern below.
    s = s.replace(/^(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?,?\s+/i, '').trim();

    /* ⚠ A SHAPE THAT MATCHES THE PATTERN IS NOT A DATE THAT EXISTS. Both regex branches used to
       hand their captures straight to _ymd, which only pads and joins — so `0000-00-00` (a database
       null date) stored as "0-00-00" and `2026-13-01` stored verbatim, both counted as imported.
       The round-trip is what refuses 31 April and a non-leap 29 February instead of rolling them
       over into the next month. */
    const ok = (y, mo, d) => {
      if (!(y >= minYear && y <= 2100) || !(mo >= 1 && mo <= 12) || !(d >= 1 && d <= 31)) return '';
      const t = new Date(y, mo - 1, d);
      return (t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d) ? this._ymd(y, mo, d) : '';
    };
    /* ⚠ A TWO-DIGIT YEAR PIVOTS AT 50. It used to be a flat `y + 2000`, which put every two-digit
       year in the 2000s — so at the REGULARS door, where `{minYear:1900}` exists precisely because
       birthdays predate the business, a guest born `06/15/65` was stored as **2065-06-15**: a
       birthday 39 years in the FUTURE, rendered straight into the edit form's <input type="date">.
       The option that door passes to say "my dates are old" could not do anything, because nothing
       downstream of `yr4` ever consulted it.
       50-99 -> 1900s, 00-49 -> 2000s is the universal convention (POSIX, Excel, Java) and it is a
       strict improvement at the business doors too: `7/20/98` used to bank as **2098**, 72 years in
       the future and inside the 2100 ceiling, so nothing caught it. It now reads 1998 — and a
       genuinely absurd one like `7/20/50` resolves to 1950 and is then REFUSED by the default
       minYear of 1990 and reported, instead of silently banking a 2050 expense.
       ⚠ Verified against the suite: the only two-digit years anywhere in the harnesses are `26` and
       `01`, both below the pivot, so every pinned shape is byte-identical. */
    const yr4 = y => (y >= 100 ? y : (y <= 49 ? y + 2000 : y + 1900));
    /* ⚠⚠ THE TAIL IS CAPTURED AND VALIDATED, NOT WAVED THROUGH. Two failures, opposite directions:
       · TOO STRICT — it only allowed a tail starting with `T` or whitespace, so a COMMA refused the
         whole file. A comma is what JavaScript itself emits: `toLocaleString('en-US')` produces
         "7/20/2026, 6:00:00 PM". Every date-reading builder returned ZERO rows on such a file while
         telling the operator to go check a date column that was perfectly correct.
       · TOO LOOSE — `.*` swallowed anything, so a PERIOD/RANGE cell ("07/20/2026 - 07/26/2026", a
         very common export header value) read as its FIRST date. buildSales aggregates by date, so
         a week-total row landed ON TOP of Monday: $26,500 banked against a true $6,800 and the week
         written as exactly DOUBLE — with nothing skipped, nothing undated, and the only trace a
         "(1 extra row combined into day totals)" note that is the expected message for a legitimate
         daypart-split export. Silent doubling reading as a clean import.
       So a tail may only be a CLOCK or a ZONE. A tail carrying a second date makes the cell
       ambiguous, and an ambiguous cell is refused and reported — never guessed. */
    const TAIL = '([T\\s,].*)?$';
    const tailOk = t => {
      if (!t) return true;
      // Strip the separators that introduce a tail — a comma, whitespace, or ISO's `T` when a clock
      // follows it. What is LEFT has to look like a time or a zone and nothing else.
      const x = t.trim().replace(/^[,\s]+/, '').replace(/^T(?=\d)/i, '');
      if (!x) return true;
      if (/^\d{1,2}:\d{2}/.test(x)) return true;                       // a clock
      if (/^(z|utc|gmt|[+-]\d{2}:?\d{2})\b/i.test(x)) return true;     // a zone
      return false;
    };

    /* ⚠ THE `i` FLAG BELONGS ON ALL FOUR BRANCHES, and it was on only two. Branches 3 and 4 carried
       it (they must — they match month WORDS), branches 1 and 2 did not, so `TAIL`'s `[T\s,]` was
       uppercase-only here. Result: `2026-07-20t18:00:00` was refused while `20 Jul 2026t18:00`
       parsed — the same date, the same lowercase `t`, two different answers, purely from an
       inconsistent flag. RFC 3339 explicitly permits the lowercase `t` and some SQL/API exporters
       emit it, and a refused date drops the row out of every total. The branches are all-digit
       patterns, so the flag changes nothing else about what they match.
       ⚠ A TRAILING PERIOD ("2026-07-20.") IS STILL REFUSED, DELIBERATELY. Allowing it means widening
       the tail character class, and the tail is the one part of this function that has already
       failed in BOTH directions — too strict refused a whole file over a comma, too loose read a
       week-range cell as its first date and wrote the week DOUBLE. No POS has been named that emits
       it. Not worth reopening a twice-burned surface for a shape nobody can point at. */
    // 1. ISO-ish YYYY-MM-DD (or with slashes), optionally followed by a time.
    let m = s.match(new RegExp('^(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})' + TAIL, 'i'));
    if (m) return tailOk(m[4]) ? ok(+m[1], +m[2], +m[3]) : '';

    /* 2. All-numeric M/D/Y — US order, with the day-first swap when the first field cannot be a
       month. Slash and dash ONLY; see the dot note above. */
    m = s.match(new RegExp('^(\\d{1,2})[-/](\\d{1,2})[-/](\\d{2,4})' + TAIL, 'i'));
    if (m) {
      if (!tailOk(m[4])) return '';
      const a = +m[1], b = +m[2], y = yr4(+m[3]);
      /* ⚠ THE FILE'S VERDICT WINS OVER THE PER-CELL GUESS (S199). `a > 12` is still honoured as a
         fallback so a single pasted cell with no file around it reads sensibly, but when the caller
         has read the whole column (PosIngest.dateConvention) that answer is the one that counts —
         it is the only one that can be right for the rows where BOTH fields are 12 or under, which
         is exactly the half of a day-first file that used to transpose in silence. */
      /* ⚠⚠ A SELF-CONTRADICTING FILE REFUSES ITS AMBIGUOUS ROWS RATHER THAN GUESSING. When the
         column holds BOTH a row that can only be day-first and a row that can only be month-first,
         there is no verdict to apply, and a row where both numbers are 12 or under is a genuine coin
         toss. Refusing sends it to the door's `undated` bucket, which EVERY door already reports —
         so the operator is told, using reporting that already exists, instead of money landing in a
         silently-guessed month. This is the same policy the dotted form has had all along: refuse
         the ambiguity and name it, never guess. Rows that CAN only be read one way still import. */
      if (opts && opts.dateAmbiguous && a <= 12 && b <= 12) return '';
      const dayFirst = (opts && opts.dayFirst) || (a > 12 && b <= 12);
      return ok(y, dayFirst ? b : a, dayFirst ? a : b);
    }

    /* 3. Word month, DAY first: 20-Jul-2026, 20 Jul 26, "20 July 2026", 20th Jul 2026, 20JUL2026.
       The separators are optional here ONLY because letters and digits cannot run together
       ambiguously — "20JUL2026" splits exactly one way. Ordinal suffixes are accepted; a
       hand-maintained sheet writes them and a whole column of them used to refuse. */
    m = s.match(new RegExp('^(\\d{1,2})(?:st|nd|rd|th)?[-\\s.]*([a-z]{3,})[-\\s.,]*(\\d{2,4})' + TAIL, 'i'));
    if (m) {
      const mo = this.MONTHS[m[2].slice(0, 3).toLowerCase()];
      return (mo && tailOk(m[4])) ? ok(yr4(+m[3]), mo, +m[1]) : '';
    }

    /* 4. Word month, MONTH first: Jul 20 2026, "July 20, 2026", Jul-20-2026, "July 20th, 2026".
       ⚠ The day/year separator stays REQUIRED here. Making it optional would let "JUL202026" split
       two ways, and guessing between them is the whole habit this rewrite exists to end. */
    m = s.match(new RegExp('^([a-z]{3,})[-\\s.]*(\\d{1,2})(?:st|nd|rd|th)?[-\\s.,]+(\\d{2,4})' + TAIL, 'i'));
    if (m) {
      const mo = this.MONTHS[m[1].slice(0, 3).toLowerCase()];
      return (mo && tailOk(m[4])) ? ok(yr4(+m[3]), mo, +m[2]) : '';
    }

    /* ⭐ S200 — A DATE WITH NO YEAR, ACCEPTED ONLY WHERE THE YEAR IS NOT DATA.
       `opts.yearOptional` is set by ONE caller: ev-regulars, importing BIRTHDAYS and ANNIVERSARIES.
       Everywhere else a year-less cell stays refused, which is correct — a sales day with no year is
       genuinely unusable, and inventing one is what six scan rounds were spent stamping out.

       WHY THIS DOOR IS DIFFERENT: the birth YEAR is the one field a guest never gives, and Bar Cop
       never displays it. The list column renders `fmtMD` (month and day), the stat tile and both
       filter chips read `monthOf`. So refusing "1-Jul" did not protect anything — it emptied the
       feature: `birthday` stored '', `monthOf('')` returns -1, and "Birthdays This Month" read 0 on
       a file full of birthdays. The OLD private parser here stored 2001-07-01, a junk year with the
       RIGHT month and day, which is why outreach worked before the delegation.

       THE YEAR IS STAMPED 1900 AND THAT IS DELIBERATE. It is not a guess dressed as data: nobody in
       a bar was born in 1900, it is this door's own `minYear` floor, and it reads as "no year given"
       to anyone who opens the record. The alternative — inventing the current year — would make a
       70-year-old's birthday look like a newborn's and would be a real number, silently wrong.
       ⚠ ONLY UNAMBIGUOUS SHAPES ARE ACCEPTED WITHOUT A YEAR. A word month cannot be confused with a
       day, so "1-Jul" / "Jul 8" / "July 27th" are safe in either order. A bare "7/19" is NOT safe on
       its own, so it follows the file's day-first verdict exactly like every other numeric cell. */
    if (opts && opts.yearOptional) {
      /* ⚠ 1904, NOT 1900, AND THE REASON IS A REAL GUEST. The sentinel has to satisfy three things:
         it must be a year no living person was born in (so it can never be mistaken for real data),
         it must clear this door's own minYear floor of 1900, and — the one that was missed — IT MUST
         BE A LEAP YEAR. 1900 is not (divisible by 100, not by 400), so `ok()`'s round-trip refused
         **29 February outright**: a guest born on the leap day imported with a BLANK birthday and
         vanished from February outreach forever. Roughly 1 guest in 1,461, permanently invisible.
         1904 is the first leap year that keeps all three properties. The value is never displayed —
         the list renders month/day and the tile reads the month — so this only ever shows in the
         edit form, where 1904 reads exactly as "no year given" does. */
      const NOYEAR = 1904;
      // Word month with the day first: 1-Jul, "20 July", 3rd Mar
      m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[-\s.]*([a-z]{3,})$/i);
      if (m) { const mo = this.MONTHS[m[2].slice(0, 3).toLowerCase()]; if (mo) return ok(NOYEAR, mo, +m[1]); }
      // Word month first: Jul 8, "July 27th", Mar-3
      m = s.match(/^([a-z]{3,})[-\s.]*(\d{1,2})(?:st|nd|rd|th)?$/i);
      if (m) { const mo = this.MONTHS[m[1].slice(0, 3).toLowerCase()]; if (mo) return ok(NOYEAR, mo, +m[2]); }
      // All-numeric month/day — ambiguous, so it obeys the file's verdict, never a private guess.
      m = s.match(/^(\d{1,2})[-/](\d{1,2})$/);
      if (m) {
        const a = +m[1], b = +m[2];
        // Same ambiguity rule as the dated branch: a contradicting file refuses its coin-toss rows.
        if (opts.dateAmbiguous && a <= 12 && b <= 12) return '';
        const df = (opts.dayFirst) || (a > 12 && b <= 12);
        return ok(NOYEAR, df ? b : a, df ? a : b);
      }
    }

    // Anything else is not a date Bar Cop is willing to guess at. The door reports the row.
    return '';
  },
  /* ⚠⚠ THIS MAP RELIES ON AN INVARIANT ENFORCED ELSEWHERE: STAFF NAMES ARE UNIQUE (S215k).
     It is `m[name] = s`, so two staff sharing a name collapse into whichever sits later in the
     array — and this is the shared matcher for FIVE builders (hours, tips, voids, server, cash), so
     the loser can never receive a single imported row. Measured: two "Chris M." records, and every
     imported shift lands on the second one at the wrong wage.
     ⭐ THE INVARIANT IS HELD AT THE SOURCE, NOT HERE, and deliberately: `lc-staff-roster`'s import
     has always refused a duplicate name (whole roster, Inactive included) and `saveProfile` now
     refuses one too, on both ADD and RENAME. That makes the ambiguous state unreachable through the
     app instead of asking five builders to resolve an ambiguity the file cannot settle
     ([[the-loop]] #20: when the fix moves the bug out of reach, assert the unreachability —
     `verify-roster-name-unique.js`).
     ⛔ SO: ANY NEW WRITER OF lc_staff MUST ENFORCE IT. Adding a second door that can mint a
     duplicate name silently re-opens all five builders at once. */
  _staffByName() {
    const m = {};
    ((App.laborData && App.laborData.lc_staff) || []).forEach(s => {
      if (s && s.name) m[String(s.name).trim().toLowerCase()] = s;
    });
    return m;
  },

  // ── Pure builders (no save) ────────────────────────────────────────────────
  // `opts` is threaded to the two builders that need it: buildSales reads opts.manual to know the
  // Enter-Manually grid from a POS file (a hand entry is source:'manual' and never raises a
  // conflict against itself), and the signature is uniform so any builder can grow one.
  /* ⚠ EVERY DATED BUILDER NOW TAKES `opts`, and it is not optional plumbing: `opts.dayFirst` is the
     file-level date verdict (S199) and a builder that drops it reads a day-first week into six
     different months. buildPmix is the one builder with no date column, so it is the one that does
     not need it. If the caller passed no verdict, `build` reads the column itself — a door that
     forgets to call dateConvention still gets the right answer rather than the old silent scatter. */
  build(type, rows, opts) {
    const o = Object.assign({}, opts);
    /* ⚠ BOTH HALVES OF THE VERDICT TRAVEL, not just `dayFirst`. Taking only `dayFirst` and dropping
       `contradictory` made this function's own promise false at six of the eight doors: a
       self-contradicting file quietly picked month-first and scattered money across eleven wrong
       months with nothing skipped and no message. `dateAmbiguous` makes the coin-toss rows refuse,
       so they land in `undated` — a bucket every door on this path already reports. */
    let conv = null;
    if (o.dayFirst === undefined && type !== 'pmix') {
      conv = this.dateConvention(rows, 'date', o);
      o.dayFirst = conv.dayFirst;
      if (o.dateAmbiguous === undefined) o.dateAmbiguous = conv.contradictory;
    }
    /* The verdict rides OUT on the result so a door CAN name the cause. Be precise about what that
       does and does not buy today, because the first version of this comment claimed more:
         · the refused rows themselves DO reach the operator — they land in `undated`, and all six
           doors on this path render that bucket;
         · but no door reads `dateAmbiguous` yet, so those rows are still described as "no readable
           date" when the real cause is that the file carries two date conventions. Wiring the six
           messages is S203 on THE LIST, deliberately not done in the same session that rewrote this
           logic three times.
       ⚠ Reachability keeps that honest rather than urgent: a clean POS export cannot produce mixed
       evidence at all (a DD/MM cell cannot cast a month vote, an MM/DD cell cannot cast a day vote),
       so this only fires on a hand-assembled sheet — and the two doors that actually receive those,
       Operating Expenses and Regulars, call dateConvention directly and already print the sentence. */
    const tag = r => (conv && r && typeof r === 'object'
      ? Object.assign(r, { dateAmbiguous: conv.contradictory, dayFirst: conv.dayFirst }) : r);
    if (type === 'hours') return tag(this.buildHours(rows, o));
    if (type === 'tips')  return tag(this.buildTips(rows, o));
    if (type === 'voids') return tag(this.buildVoids(rows, o));
    if (type === 'sales') return tag(this.buildSales(rows, o));
    if (type === 'cash')  return tag(this.buildCash(rows, o));
    if (type === 'server') return tag(this.buildServer(rows, o));
    if (type === 'pmix')  return this.buildPmix(rows);
    return { toAdd: [], skipped: [], dupCount: 0 };
  },

  buildHours(rows, opts) {
    const staffByName = this._staffByName();
    const existing = (App.laborData && App.laborData.lc_actuals) || [];
    const toAdd = []; const skipped = []; const incomplete = []; const undated = []; let dupCount = 0; const used = new Set();
    const fileSeen = new Set(); let fileRepeats = 0;   // exact repeats WITHIN this one file (S218)
    (rows || []).forEach(r => {
      const staff = staffByName[(r.name || '').trim().toLowerCase()];
      const hours = this._hours(r.hours);
      /* ⚠ TWO PROBLEMS, TWO LISTS — the same split buildServer and buildPmix already have, and for
         the same reason. Lumping them meant the screen said "no roster match" about people who ARE
         on the roster and simply had no usable hours that row (a `--` cell, a $0.00 line, a day
         off), which sends the operator to add a staff member who already exists — "they added a
         duplicate that fixed nothing and corrupted the roster". An unmatched NAME is a roster fix;
         an unusable FIGURE is a file fix. */
      if (!staff) { skipped.push(r.name || '(blank)'); return; }
      if (isNaN(hours) || hours <= 0) { incomplete.push(r.name || '(blank)'); return; }
      const recDate = this.normDate(r.date, opts);
      /* ⚠⚠ A TIMECLOCK ROW WITH NO READABLE DATE IS A SKIP, NOT A BLANK-DATED RECORD. This wrote
         `date: ''` and counted it as imported — and because the dedup key is staff + date + hours,
         EVERY undated row of EVERY week collapses onto the same empty date. So week one imported,
         and week two — same crew, same shift lengths — deduped away in full and reported "6 already
         logged" about six rows that had never been logged. Half a month of payroll hours, gone,
         under a message that says everything is fine.
         The four dated builders (sales, cash, per-server, voids) all refuse an unreadable date;
         these two were the last writing blanks. Pay is the worst place for it: gross pay, labour %,
         RPLH, overtime and the payroll export all read these rows, and all of them window by date. */
      if (!recDate) { undated.push(r.name || '(blank)'); return; }
      const shiftType = (r.shift || '').trim();
      /* ⚠⚠ A LINE REPEATED INSIDE ONE FILE (S218). `_isDup` only searches what is ALREADY SAVED, so
         on a FIRST import there is nothing to dedup against and a byte-identical repeat was written
         TWICE — straight into gross pay, labor %, RPLH, overtime and the payroll export. This is the
         worst of the four doors that had it.
         ⭐ THE DISCRIMINATOR IS NOT A GUESS, IT IS THIS DOOR'S OWN FORM: Log Hours refuses to create
         a second record with the same staff + date + shift_type (lc-log-hours.js), and `hoursFor`'s
         comment states the model — "a SPLIT SHIFT is two records ... lunch and dinner are separate
         rows by design". So two rows matching on all three PLUS the hours describe a record the
         operator could not have made by hand, which is the "two doors, one record, two rules"
         defect. Two rows differing in shift_type are a real split shift and BOTH still import —
         getting that wrong once reported 4 hours for a 9-hour day and, because it is the tip-pool
         denominator, short-paid that person and over-paid everyone else.
         ⚠ Reported, never silent, so an operator whose export really does repeat a line can see it. */
      const fileKey = staff.id + '|' + recDate + '|' + shiftType + '|' + hours.toFixed(3);
      if (fileSeen.has(fileKey)) { fileRepeats++; return; }
      fileSeen.add(fileKey);
      // Skip an exact re-import (same staff + date + hours) so re-dropping a
      // timeclock file never double-counts hours into gross pay.
      if (this._isDup(existing, used, x => x.staff_id === staff.id && x.date === recDate && Math.abs((x.hours || 0) - hours) < 0.001)) {
        dupCount++; return;
      }
      const sal = App.isSalaried(staff);
      const wage = sal ? null : (App.wageForStaffOn ? App.wageForStaffOn(staff.id, recDate) : (staff.wage || 0));
      toAdd.push({
        id: App.uid(), date: recDate, staff_id: staff.id, name: staff.name,
        position_id: staff.position_id || '', shift_type: shiftType,
        hours, wage, cost: sal ? 0 : hours * (wage || 0),
        notes: '', imported: true, created_at: new Date().toISOString()
      });
    });
    // `undated` = the file gave a date this row could not be read from; `skipped` = no staff
    // match or no usable figure. Different problems, different fixes, never one list.
    // `fileRepeats` = lines this file repeated verbatim; counted once, and REPORTED by the door.
    return { toAdd, skipped, incomplete, undated, dupCount, fileRepeats };
  },

  buildTips(rows, opts) {
    const staffByName = this._staffByName();
    const existing = (App.laborData && App.laborData.lc_tips) || [];
    const toAdd = []; const skipped = []; const incomplete = []; const undated = []; let dupCount = 0; const used = new Set();
    const fileSeen = new Set(); let fileRepeats = 0;   // exact repeats WITHIN this one file (S218)
    (rows || []).forEach(r => {
      const staff = staffByName[(r.name || '').trim().toLowerCase()];
      const cash = this._num(r.cash_tips);
      const card = this._num(r.card_tips);
      // ⚠ The twin of buildHours' split. A $0.00 tips row is an ORDINARY line in a POS tips export
      // (barbacks, kitchen, someone's day off) — telling the operator those people are not on the
      // roster is both false and an instruction to corrupt the roster.
      if (!staff) { skipped.push(r.name || '(blank)'); return; }
      if ((cash + card) <= 0) { incomplete.push(r.name || '(blank)'); return; }
      const recDate = this.normDate(r.date, opts);
      // ⚠ The twin of buildHours' guard above, and it fails the same way: the dedup key is
      // staff + date + amounts, so undated rows all share one key and a second week deduped away
      // in full. Tips feed Form 8027, the tip-out basis and the payroll export, all date-windowed.
      if (!recDate) { undated.push(r.name || '(blank)'); return; }
      const tipShift = (r.shift || '').trim();
      /* ⚠⚠ THE TWIN OF buildHours' FILE-REPEAT GUARD (S218), and the same reasoning applies without
         change: nothing compared a file row against the rows beside it, so a byte-identical repeat
         was written twice on a first import — into declared tips, the tip-out basis, Form 8027 and
         the payroll export. Log Tips refuses a second entry for the same staff + date + service
         period (`lc-tip-log.js` tests `App.tipShiftKey(t.date, t.shift_type)`), so two rows matching
         on those PLUS both tip figures describe a record the operator could not enter by hand.
         Two service periods on one day still both import — tips are logged per period. */
      const fileKey = staff.id + '|' + recDate + '|' + tipShift + '|' + cash.toFixed(2) + '|' + card.toFixed(2);
      if (fileSeen.has(fileKey)) { fileRepeats++; return; }
      fileSeen.add(fileKey);
      // Skip an exact re-import (same staff + date + the same cash and card tips)
      // so re-dropping a tips export never double-counts tip income.
      if (this._isDup(existing, used, x => x.staff_id === staff.id && x.date === recDate
            && Math.abs((x.cash_tips || 0) - cash) < 0.001
            && Math.abs((x.card_tips || 0) - card) < 0.001)) {
        dupCount++; return;
      }
      toAdd.push({
        id: App.uid(), shift_id: '', manager_id: '', date: recDate,
        staff_id: staff.id, name: staff.name, position_id: staff.position_id || '',
        shift_type: tipShift,
        cash_tips: cash, card_tips: card, total_tips: cash + card,
        hours: null, notes: '', imported: true, created_at: new Date().toISOString()
      });
    });
    // `undated` = the file gave a date this row could not be read from; `skipped` = no staff
    // match or no usable figure. Different problems, different fixes, never one list.
    // `fileRepeats` = lines this file repeated verbatim; counted once, and REPORTED by the door.
    return { toAdd, skipped, incomplete, undated, dupCount, fileRepeats };
  },

  /* What a POS calls a comp. Anything here in the Type cell means revenue GIVEN AWAY, which is a
     Comp in Bar Cop's model; everything else is a Void (an item rung and taken back off).
     Drawn from App.SC_COMP_REASONS — the app's single source for what a comp is, which already
     lists 'Marketing / Promo', 'Customer Goodwill' and 'Staff Meal' — plus the words the exports
     themselves use. Deliberately NOT here: 'manager' on its own (a Type column can hold a manager's
     NAME) and 'free'/'house' as bare tokens; 'manager comp' and 'on the house' already hit. */
  COMP_WORDS: ['comp', 'discount', 'promo', 'coupon', 'goodwill', 'courtesy', 'on the house',
               'staff meal', 'shift drink', 'employee meal', 'giveaway', 'marketing'],

  buildVoids(rows, opts) {
    const COMP_WORDS = this.COMP_WORDS;
    const byName = this._staffByName();
    const existing = (App.shiftData && App.shiftData.sc_void_comps) || [];
    const today = App.todayLocal();
    const toAdd = []; const skipped = []; const undated = []; let dupCount = 0; const used = new Set();
    // S218: repeats here are COUNTED, not dropped — see the guard below for why this door differs.
    const fileSeen = new Set(); let fileRepeats = 0;
    (rows || []).forEach(r => {
      // A void/comp is a LOSS magnitude. POS exports show it as a negative ("-15")
      // or accounting parens ("(15)") to signal it reduces sales; both are a $15
      // loss. Take the absolute value so those rows import instead of being dropped.
      const amount = Math.abs(this._num(r.amount));
      if (!(amount > 0)) { skipped.push('(no amount)'); return; }
      const t = (r.type || '').trim().toLowerCase();
      /* ⚠ A DISCOUNT IS NOT A VOID. This asked only whether the cell contained "comp", so anything
         else — Discount, Promo, Coupon, Courtesy — became a Void. Bar Cop's own model disagrees:
         App.SC_COMP_REASONS lists 'Marketing / Promo' as a COMP reason, while this screen's
         REASONS.Void are all ring-in errors ('Rung in error', 'Wrong item', 'Sent back'). A void is
         an item rung and taken off; a comp is revenue GIVEN AWAY. This door's own `amount` match
         list invites discount exports ('discount', 'discount amount'), and they were all landing on
         the wrong side — understating Comps, overstating Voids, and dropping out of the per-server
         comp% signal on Server Check entirely, which filters `type === 'Comp'` and is a THEFT
         signal. This can only ever turn a Void into a Comp; nothing the old test called a Comp
         changes. A BLANK type still defaults to Void, which is what the help copy promises. */
      /* ⚠ AN EXPLICIT "VOID" WINS. Where a POS names the transaction by what it REVERSED
         ("Void Discount", "Promo Void", "Discount Removed"), a comp word is present but the row is
         a genuine void — and calling it a Comp inflates Comp Total, Given Away and comp % of sales,
         which is the exact inverse of the harm this classifier was widened to fix. The word the file
         chose for the ACTION beats a word that only names what the action was performed on. */
      // ⚠ STEMS, NOT EXACT FORMS. The first version matched `void` but not `voided`, and
      // `removed` but not `removal` — so "Void Discount" was a Void while "Discount Voided", the
      // same transaction written the other way round, was a $200 Comp. Word-START anchored, so
      // "Unavoidable" is still not a void.
      const type = /(^|[^a-z])(void|remov|revers|cancel)[a-z]*([^a-z]|$)/.test(t)
        ? 'Void'
        : (COMP_WORDS.some(w => t.indexOf(w) >= 0) || t === 'c') ? 'Comp' : 'Void';
      const serverName = (r.server || '').trim();
      const staff = serverName ? byName[serverName.toLowerCase()] : null;
      const server = staff ? staff.name : serverName;
      const item = (r.item || '').trim();
      /* ⚠⚠ A DATE THE FILE GAVE AND BAR COP COULD NOT READ IS NEVER RESTAMPED TO TODAY. This was
         `this.normDate(r.date, opts) || today`, so a voids export dated "Jul 24" (no year — an ordinary
         export shape, and the exact case that produced buildServer's `undated` fix) landed EVERY
         ROW on today. A whole week of losses collapsed onto one day in the WRONG week, silently.
         That figure drives the Void/Comp log's date-filtered totals, void % and comp %, the
         per-server comp total on Server Check (a theft signal, cut off by date), Theft Risk and the
         Books comp split — so the week being closed reads clean and the current week reads like
         someone is giving the place away. Every sibling builder refuses an unreadable date; this
         one invented one.
         ⚠ A SPLIT, NOT A REFUSAL: `date` is genuinely OPTIONAL at this door and the drop copy says
         so, so a file with NO date column (or a blank cell) must still date its rows today — that
         is the documented contract, and it is uniform across the file. The dishonest case is the
         narrow one: a NON-EMPTY cell that will not parse. The file said something; we could not
         read it; inventing today is the one answer that is certainly wrong. */
      const rawDate = String(r.date == null ? '' : r.date).trim();
      const parsed = this.normDate(rawDate, opts);
      if (rawDate && !parsed) { undated.push(rawDate); return; }
      const recDate = parsed || today;
      // Skip an exact re-import (same date + amount + server + item) so re-dropping
      // a voids/comps export never double-counts loss.
      /* ⚠⚠ THIS DOOR REPORTS A REPEATED LINE AND IMPORTS IT ANYWAY, AND THE DIFFERENCE IS THE WHOLE
         POINT OF S218 (2026-07-27). At the hours, tips and cash doors the hand FORM refuses to
         create a second record with the same identity, so a repeat in the file is data the operator
         could never have entered and collapsing it is safe. **Nothing in the Void/Comp form says
         that here.** Two $75 order errors on the same item in one night is an ordinary evening, and
         dropping the second would silently delete real money — the payroll mistake wearing a
         different hat ([[the-loop]] #30: do not infer a fact the file does not carry).
         So Bar Cop says what it saw and the operator decides. Counted, never returned early. */
      const fileKey = recDate + '|' + server + '|' + item + '|' + type + '|' + amount.toFixed(2);
      if (fileSeen.has(fileKey)) fileRepeats++; else fileSeen.add(fileKey);
      if (this._isDup(existing, used, x => x.date === recDate && Math.abs((x.amount || 0) - amount) < 0.001
            && (x.server || '') === server && (x.item || '') === item)) {
        dupCount++; return;
      }
      toAdd.push({
        id: App.uid(), date: recDate, type, shift_type: '',
        item, amount,
        product_id: '', product_name: '', menu_item_id: '', units: null,
        staff_id: staff ? staff.id : '', server,
        authorized_by_id: '', authorized_by: '', check_number: '',
        reason: (r.reason || '').trim(), notes: '',
        created_at: new Date().toISOString()
      });
    });
    // `skipped` is rows with no usable AMOUNT; `undated` is rows whose date the file gave and Bar
    // Cop could not read. Two different problems with two different fixes — never one list.
    // `fileRepeats` here means "the file repeated a line" — NOT that anything was dropped. Both rows
    // are in `toAdd`. The door words it as something to look at, never as a collapse.
    return { toAdd, skipped, undated, dupCount, fileRepeats };
  },

  // rows -> one per-day sc_shifts record. `opts.manual` = the Enter-Manually grid (a hand entry,
  // stamped source:'manual'); otherwise a POS import (source:'import'). Returns the usual
  // { toAdd, skipped, dupCount, merged, keptManual } PLUS `conflicts` — days already entered BY
  // HAND that the file DISAGREES with. Bar Cop never silently decides between two figures the
  // operator entered themselves ([[user-chooses-conflicts]]): a conflict is handed to the screen,
  // which prompts, and only the operator's choice is written. See _commitSales for the retire rule.
  buildSales(rows, opts) {
    opts = opts || {};
    const manualEntry = !!opts.manual;   // the grid is an EDIT — the operator IS choosing — never a conflict
    const existingShifts = ((App.shiftData && App.shiftData.sc_shifts) || []);
    // Provenance is `source` now, NOT the old `imported !== true` guard (S140). Every writer
    // stamped imported:true, so that guard was DEAD — a bulk sales import silently overwrote a hand
    // close, and worse PARTIALLY (a bar-only file zeroed the typed food + covers). sc_shifts is one
    // record per date, so keep the prior record for a date to compare against.
    const priorByDate = new Map();
    existingShifts.forEach(s => { if (s && s.date != null) priorByDate.set(String(s.date), s); });
    // AGGREGATE BY DATE — never one record per CSV row. A sales export split by daypart, revenue
    // centre or service period lists the same date several times, which is an ordinary export
    // shape, and the day's sales are their SUM. The old line was a bare `if (seen.has(date))
    // return;` — every service after the FIRST was discarded in silence while the cockpit reported
    // "7 days imported". A real $18,200 / $18,340 week imported as $2,940 / $6,860. Same bug and
    // fix as buildPmix (that one is units; this one is money). Aggregating HERE also guarantees one
    // record per date, which _commitSales depends on (a duplicate id in one ON CONFLICT chunk is
    // rejected whole).
    const byDate = new Map();          // date -> aggregated { bar, food, covers } from the file
    const carry  = new Map();          // date -> { bar, food, covers } booleans: which columns the file CARRIES
    const skipped = []; const zeroSkipped = []; const unchanged = []; const undated = []; let dupCount = 0; let merged = 0; let keptManual = 0;
    const keptDates = new Set();       // a kept hand day reported once, not once per row
    const cents = n => Math.round(n * 100) / 100;   // summing floats across services must not drift
    // A column "carries" a value only if the cell PARSES to a number. A junk cell ("N/A", "-", a
    // stray footer label) is non-blank but not a value — treating it as a carried 0 would raise a
    // FALSE conflict against a differing prior and, on "use the file", ZERO the column (S140 scan).
    // A real "0" DOES carry (the file says zero) and overwrites.
    // ⚠ MUST ASK THE SAME QUESTION AS _num/covOf BELOW, or this guard inverts into the bug it
    // exists to stop. It kept its own parse through the coercion unification, so for a cell like
    // "07/01-07/07" or "5-11" it said "this column carries a value" while _num returned 0 — and
    // "use the file" then wrote that 0 over a real day's sales, reporting "1 replaced earlier
    // figures", with nothing in skipped and no conflict raised. That is exactly the S140 failure
    // this helper was added to prevent. One coercion, one answer: it carries iff parseNum can read it.
    const numeric = v => App.parseNum(v) != null;
    const covOf = v => Math.round(App.parseNum(v) ?? 0);   // one coercion; keeps the decimal point so "12.00" is 12, not 1200
    (rows || []).forEach(r => {
      const date = this.normDate(r.date, opts);
      /* ⚠ AN UNREADABLE DATE IS ITS OWN OUTCOME — the same split buildCash got, arriving late here.
         `skipped` carried BOTH "this row's date is gibberish" and "this row had no usable figure",
         and the cockpit gates its red "Check that the file has a Date column and sales values" on
         that one list. So a file whose dates all parsed perfectly, dropped on a week that already
         had records, could produce a red message blaming the Date column. Two problems, two lists,
         two sentences. (`undated` counts ROWS; `skipped` is keyed per DATE, because the day is the
         unit once the file's rows have been aggregated — the door's copy says so.) */
      if (!date) { undated.push('(no date)'); return; }
      const bar = this._num(r.bar), food = this._num(r.food), covers = covOf(r.covers);
      const c = carry.get(date) || { bar: false, food: false, covers: false };
      if (numeric(r.bar)) c.bar = true; if (numeric(r.food)) c.food = true; if (numeric(r.covers)) c.covers = true;
      carry.set(date, c);
      const prior = byDate.get(date);
      if (prior) { prior.bar = cents(prior.bar + bar); prior.food = cents(prior.food + food); prior.covers += covers; merged++; }
      else byDate.set(date, { bar, food, covers });
    });
    const toAdd = []; const conflicts = [];
    /* ⚠ WHICH COLUMN, AND WHAT HAPPENED TO IT — one list was never enough. This was a flat
       `covDropped` array of dates, born when the mechanism only fired for covers, and the cockpit
       still renders it as "covers could not be read... sales still came in". The test underneath it
       has since widened to bar and food, so on a bad BAR column all three of those claims are false
       and the worst of them ("sales still came in") is the exact thing that did not happen.
       There are also TWO different outcomes, and they need different words:
         kept   — the day already had a record, so the column keeps the figure already saved;
         zeroed — a BRAND-NEW day, so the column is written as 0 and presented as the day's takings.
       The second one was reported NOWHERE AT ALL: not here (covDropped needed the column to be
       carried-but-unreadable), not in `skipped`, not in `zeroSkipped`. A file whose Food cell is
       empty on Tuesday wrote Tuesday's total_revenue as bar-only and called it the day's full
       takings — which then feeds Confirm the Week, the cash-forecast baseline and the sales-tax
       hold, all of them under-stated, with nothing on screen to say so. */
    const colGaps = { kept: { bar: [], food: [], covers: [] }, zeroed: { bar: [], food: [], covers: [] } };
    /* Does the FILE carry this column at all? A column that appears NOWHERE in the export is a
       mapping decision the operator made and can see in the preview — a bar with no food service
       would otherwise be told about its missing Food column on every single import, which is how a
       result line stops being read. A column that is carried on SOME days and blank on this one is
       the real gap, and that is what gets reported.
       ⚠ KNOWN LIMIT, documented not fixed: a Food column present in the file but never MAPPED is
       indistinguishable from one that does not exist, so it is not flagged either. */
    // ⚠ OVER THE RAW ROWS, NOT OVER `carry`. `carry` is only populated for rows with a READABLE
    // DATE, so one undated row was enough to make the whole file look like it had no Food column —
    // and then a real gap on a dated day went unreported. Whether the export CARRIES a column is a
    // fact about the file, and has nothing to do with whether a given row's date parsed.
    const anywhere = { bar: false, food: false, covers: false };
    (rows || []).forEach(r => {
      if (numeric(r.bar)) anywhere.bar = true;
      if (numeric(r.food)) anywhere.food = true;
      if (numeric(r.covers)) anywhere.covers = true;
    });
    const pv = v => Math.round((+v || 0) * 100) / 100;
    // ⚠ COVERS IS CLAMPED AT THE DAY, NOT AT THE ROW. Bar and food each get a day-level
    // non-positive guard; covers had none anywhere, so an accounting-negative covers cell — and
    // the column matches `checks`, `tickets`, `orders`, exactly where a refund-heavy day gets
    // written as "(12)" — stored a NEGATIVE day. That reaches Confirm the Week's prefill, weekly
    // covers, check average (a $-175.00 check average), and next week's cover goal. It also bricked
    // the OTHER door: the manual grid prefills from the import, so the new negative-input refusal
    // then blocked every Save of that week over a -12 the operator never typed.
    // The clamp belongs HERE and not in covOf: a per-ROW negative is legitimate, the daypart rows
    // above aggregate and a refund row should reduce the day the same way it does bar and food.
    const mkRec = (date, bar, food, covers, manual, reuseId) => ({
      id: reuseId || App.uid(), date, bar_revenue: bar, floor_revenue: food, covers: Math.max(0, covers || 0),
      total_revenue: cents(bar + food), shift_type: 'Full Day', status: 'Closed',
      source: manual ? 'manual' : 'import', imported: !manual, created_at: new Date().toISOString()
    });
    // "Did this day sell anything" is a question about the DAY (a refund line "(50)" REDUCES it),
    // asked once all of its services are in.
    byDate.forEach((agg, date) => {
      const c = carry.get(date) || {};
      const prior = priorByDate.get(date);
      /* ⚠ HOISTED ABOVE EVERY BRANCH, and it has to be. A negative covers aggregate means the file
         is wrong about covers for this day, so the column is NOT CARRIED — the prior stands, and a
         brand-new day gets nothing rather than an invented 0. This test first went in on the
         prior-exists path only, so the two branches drew opposite conclusions from the SAME bad
         column: a day with history kept its 220 covers while a new day was hard-written to 0, both
         silently, in one import.
         And it is REPORTED. Bar and food already report a dropped day through zeroSkipped, which
         is the precedent the first version cited and then did not follow — the operator was told
         "7 days imported" with no way to know covers never came from the file at all. */
      /* ⚠ ALL THREE COLUMNS, not just covers. A negative AGGREGATE means the file is wrong about
         that column for this day, whichever column it is — and the first version of this tested
         covers alone. Bar and food kept writing raw, so a day whose bar came in as "($4,500.00)"
         against $6,000 of food NETTED POSITIVE, passed the day-total guard, and stored
         bar_revenue: -4500. Confirm the Week then reported the week's bar as $1,500 on a $6,000
         bar, and — the part that hurts most — the manual grid prefills from the import, so the
         operator's next Save of ANY day that week was refused for a negative they never typed.
         That is the exact "it bricked the OTHER door" failure the covers fix was written to stop,
         left standing on its two siblings. */
      const colUsable = (has, v) => !!has && (v || 0) >= 0;
      const barUsable  = colUsable(c.bar,    agg.bar);
      const foodUsable = colUsable(c.food,   agg.food);
      const covUsable  = colUsable(c.covers, agg.covers);
      // Record the gap only for a day that actually produces a record — a day about to be
      // zero-skipped is already reported as its own outcome and must not be counted twice.
      /* ⚠ BOTH BUCKETS ASK THE SAME QUESTION. `kept` used to test `carried` alone — which is the
         very test the header comment above calls the flaw being fixed — so the half of this with
         the STALE-NUMBER outcome stayed silent. A file whose Food cell is blank on Tuesday reported
         the gap on a brand-new day and said nothing on a day that already had a record, where the
         day is written with LAST import's food figure and counted as "1 replaced earlier figures".
         Worse, a row whose every cell reads "N/A" against an existing day reported "1 day imported
         (1 replaced earlier figures)" with nothing whatsoever from the file landing. Same file,
         same blank cell, reported or not depending only on whether the day already existed. */
      const noteGaps = isNew => {
        [['bar', c.bar, barUsable], ['food', c.food, foodUsable], ['covers', c.covers, covUsable]]
          .forEach(g => {
            const col = g[0], carried = g[1], usable = g[2];
            if (usable || !(carried || anywhere[col])) return;
            (isNew ? colGaps.zeroed : colGaps.kept)[col].push(date);
          });
      };
      const barFor  = p => barUsable  ? agg.bar    : (p ? pv(p.bar_revenue)   : 0);
      const foodFor = p => foodUsable ? agg.food   : (p ? pv(p.floor_revenue) : 0);
      const covFor  = p => covUsable  ? agg.covers : (p ? (p.covers || 0)     : 0);
      // The grid writes straight through: an edit is the operator's own choice, so there is no
      // conflict to raise. It REUSES any prior record's id for the date (S147) so a re-save upserts
      // in place — a retry after a refused write can never double the day.
      if (manualEntry) {
        if (cents(agg.bar + agg.food) <= 0) { skipped.push(date); return; }
        noteGaps(!prior);
        toAdd.push(mkRec(date, barFor(prior), foodFor(prior), covFor(prior), true, prior && prior.id));
        return;
      }
      if (!prior) {   // a brand-new day: a column the file omits is genuinely 0 (nothing to preserve)
        /* ⚠ ASK THE USABLE FIGURES, NOT THE RAW AGGREGATE. This summed `agg`, which still holds the
           value the column guard above just refused — so a day reading bar 100 against food "(150)"
           netted -50, was dropped, and the cockpit said "1 day came in at $0 and was skipped — use
           Enter Manually to record a zero day". The file's Bar column said 100, the day's real
           sales were thrown away, and the column that actually broke it was never named. Scales:
           bar 4,200 against food "(4,500)" loses $4,200 the same way.
           The day-with-history branch below already asks the CLAMPED figures (`useRec`), so the two
           branches were drawing opposite conclusions from one bad column — the exact split the
           covers hoist further up was written to stop, left standing on this guard. */
        const newBar = barFor(null), newFood = foodFor(null);
        if (cents(newBar + newFood) <= 0) {
          /* NOTHING READABLE IS NOT A ZERO DAY, AND NEITHER IS A REFUSED COLUMN. S189's copy sends
             the operator to Enter Manually to RECORD A ZERO — actively wrong advice for a day the
             file had real money on. The first version of this only caught "neither column usable",
             so a row reading bar "($4,500.00)" against a food column of exactly 0 still landed in
             zeroSkipped: foodUsable was true, the sum was 0, and the operator was told the day came
             in at $0 and pointed at the manual grid, with $4,500 of bar sitting in the file and the
             Bar column named nowhere. `zeroSkipped` may only mean "every sales column the file
             carries was READ, and they sum to zero". */
          /* ⚠ ASK THE SAME QUESTION `noteGaps` ASKS: does the FILE carry this column at all. Testing
             the per-DATE `c.bar`/`c.food` alone missed the commonest shape of it — a file that
             carries a Food column and simply leaves it blank on one day. bar '0' with food blank
             then read as barUsable-and-zero, foodBad false, and the day was reported as "came in at
             $0 — use Enter Manually to record a zero day". The file never said that day's food was
             zero. Following the advice writes a $0 day over an unknown one, and moving the SAME
             blank cell to a day whose bar reads 10 makes it get named properly, which is the tell
             that the test, not the data, was wrong. `zeroSkipped` may only ever mean "every sales
             column this export carries was READ for this day, and they sum to zero". */
          const barBad = (c.bar || anywhere.bar) && !barUsable;
          const foodBad = (c.food || anywhere.food) && !foodUsable;
          if (barBad || foodBad || (!barUsable && !foodUsable)) { skipped.push(date); return; }
          zeroSkipped.push(date); return;   // S189: a $0 day is a deliberate zero, not an unreadable row
        }
        noteGaps(true);
        toAdd.push(mkRec(date, newBar, newFood, covFor(null), false));
        return;
      }
      // A record already exists for this date. NEVER zero a column the file does not carry (S140):
      // "Use the file" overlays ONLY the columns the file actually has onto the prior figures.
      // ⚠ REUSE the prior record's id (S147): an import-replace / "use the file" is an UPSERT in
      // place, so a retry after a refused write re-upserts the same id instead of doubling the day.
      const mBar  = barFor(prior);
      const mFood = foodFor(prior);
      /* ⚠ A NEGATIVE COVERS AGGREGATE MEANS THE FILE IS WRONG ABOUT COVERS FOR THIS DAY, so the
         column is NOT CARRIED — the prior stands. mkRec clamps what it stores, and treating -12 as
         "carried" therefore wrote a 0 over a day that had 220 covers, counted it as "1 replaced
         earlier figures", and put nothing in skipped: a real count destroyed silently, which then
         flows into Confirm the Week's prefill, weekly covers, check average and next week's goal.
         Bar and food already work this way one branch down — a day that comes out non-positive is
         reported, never written. Nothing is invented here and nothing is lost.
         It also keeps the CONFLICT PROMPT honest: `theirs` below is built from the same test, so
         it can no longer offer "-12 covers" as a choice that would actually write 0, and a day
         whose only "difference" is an unusable covers cell stops raising a prompt where both
         answers produce the identical record. */
      const mCov  = covFor(prior);
      const useRec = mkRec(date, mBar, mFood, mCov, false, prior.id);   // what "Use the file" would write
      /* ⚠ S189 RUNS BEFORE THE MANUAL BRANCH, NOT AFTER IT. This guard ("never write $0 over real
         sales") sat below the conflict branch, so it protected a prior written by an earlier
         IMPORT and left the operator's own HAND-CLOSED day exposed: the same file that was safely
         zero-skipped over a machine figure instead raised a conflict whose "Use the file" wrote
         $0/$0/$0 over a typed $4,300 day, reusing its id. And the conflict modal carries a
         "Set all to → Use the file" control, so one click did it to every hand-closed day in the
         export. The figure with a person behind it was the less protected of the two. */
      if (useRec.total_revenue <= 0) { zeroSkipped.push(date); return; }
      if (prior.source === 'manual') {
        // Only a DIFFERING carried column is a conflict — never prompt when the numbers MATCH; the
        // hand close simply stands, reported as kept.
        const diff = (barUsable && pv(agg.bar)  !== pv(prior.bar_revenue))
                  || (foodUsable && pv(agg.food) !== pv(prior.floor_revenue))
                  || (covUsable && (agg.covers || 0) !== (prior.covers || 0));
        if (!diff) { if (!keptDates.has(date)) { keptDates.add(date); keptManual++; } return; }
        // ⚠ noteGaps SITS BELOW EVERY "this day was not touched" RETURN. It used to run above the
        // whole manual branch, so a hand-closed day the file simply MATCHED was reported twice —
        // "1 day kept as you entered it" AND "Covers had no usable figure on 1 day, so that day
        // kept the figures already saved" — for a day the import ignored end to end. Both true,
        // and together they read like two separate things happened.
        noteGaps(false);
        conflicts.push({
          key: date, date,
          mine:   { bar_revenue: pv(prior.bar_revenue), floor_revenue: pv(prior.floor_revenue), covers: prior.covers || 0 },
          theirs: { bar_revenue: barUsable ? pv(agg.bar) : null, floor_revenue: foodUsable ? pv(agg.food) : null, covers: covUsable ? (agg.covers || 0) : null },
          useRec: useRec
        });
        return;
      }
      /* ⚠ THIS FILE CHANGED NOTHING FOR THIS DAY — say that, do not call it a replace. Rebuilding a
         record whose three figures already match the prior and counting it as `dupCount` reported
         "1 day imported (1 replaced earlier figures)" for a row that contributed nothing: an
         all-"N/A" row (what a POS prints for a service that did not run), a covers-only export whose
         covers already match, or simply the same file dropped twice.
         ⚠ AND IT SITS BELOW THE MANUAL BRANCH ON PURPOSE. The first version of this guard tested
         "no usable column" and ran ABOVE it, which stole the hand-closed day's own outcome: a
         manual prior against an all-"--" row stopped being reported as "1 day kept as you entered
         it by hand" and became a red "No days imported. Check that the file has a Date column" —
         pointing at a column that had parsed perfectly. A hand close the file has nothing for is
         KEPT, and that is the one thing the operator needs to hear. Testing the RESULT rather than
         the inputs also catches the cases "no usable column" missed, where one column is usable and
         identical to what is already saved. */
      const same = pv(useRec.bar_revenue) === pv(prior.bar_revenue)
                && pv(useRec.floor_revenue) === pv(prior.floor_revenue)
                && (useRec.covers || 0) === (prior.covers || 0);
      /* ⚠ THREE OUTCOMES HIDE IN "the record came out identical", and collapsing them lied twice.
         A column the file CARRIED but Bar Cop REFUSED means we cannot say the file matched — we
         could not read it. Reporting that day as "already matched what is saved" swallowed the one
         thing worth acting on (your export's Covers column is unreadable), so a refused column
         always falls through to the replace path below, where noteGaps names it.
         And a row that carried NOTHING readable at all did not "match" anything either — the file
         simply had nothing for that day, which is what `skipped` already means. Only a day where
         every column the file carried was READ and AGREED is genuinely unchanged. */
      const carriedAny = !!(c.bar || c.food || c.covers);
      const anyRefused = (c.bar && !barUsable) || (c.food && !foodUsable) || (c.covers && !covUsable);
      if (same && !anyRefused) { (carriedAny ? unchanged : skipped).push(date); return; }
      // Prior is an import / seed: replace it, carrying forward any column the file omits. Not a
      // user-vs-user conflict (replacing your own machine import), so no prompt.
      // (S189 is now checked ABOVE the manual branch so it covers a hand-closed prior too.)
      noteGaps(false);
      dupCount++;
      toAdd.push(useRec);
    });
    // `merged`, NOT dupCount — the same reasoning spelled out in buildPmix. dupCount means "rows
    // already logged" everywhere else and the cockpit renders it as "N replaced earlier figures";
    // rows FOLDED INTO a total are the opposite of that.
    return { toAdd, skipped, zeroSkipped, unchanged, undated, dupCount, merged, keptManual, conflicts, colGaps };
  },

  // A row is one drawer's (or the day's) over/short. Resolves Register + Cashier
  // against the roster/registers by name so the by-cashier and by-register
  // patterns still build from an import. Dedup on date + register + variance so a
  // re-dropped cash report never double-logs. source:'import' tags it apart from
  // a hand reconcile. Writes sc_variances.
  buildCash(rows, opts) {
    opts = opts || {};
    const VL = (window.S && S.ShiftVarianceLog) || null;
    // Match by the register's name OR any saved POS alias (a report calls a
    // register "Main Bar" that the operator named "Bar 1" — the alias links them).
    const drawerByName = {};
    const allDrawers = ((App.shiftData && App.shiftData.sc_drawers) || []).filter(Boolean);
    const activeDrawers = allDrawers.filter(d => d.active !== false);
    // ⚠ NAME MATCHING USES EVERY REGISTER, ARCHIVED ONES INCLUDED (S104). Archiving a register
    // does not erase its history: matching only active registers made a file still naming it
    // resolve to drawer_id '' — a day-level row that no longer shared a key with that register's
    // own prior rows, so the register-day DUPLICATED instead of replacing. Same rule as S33 and
    // S54: a filter that is right for "what may I PICK for new work" is wrong for "what already
    // EXISTS". Archived first, then active, so a live register always wins a name collision.
    // ⚠ TWO PASSES so a register's real NAME always beats another register's ALIAS for the same
    // string (S145 — a row naming "Main Bar" was filing against a "Patio" that merely listed
    // "Main Bar" as an alias, because the single pass let a later register's alias overwrite an
    // earlier register's name, last write wins). Aliases first (weakest), then names (strongest);
    // each still archived-then-active so a live register wins a same-kind collision. A name is a
    // stronger identity signal than an alias, so even an archived register keeps its own name over
    // another register's alias — which also keeps that register's history matchable (the S104 goal).
    const ordered = allDrawers.filter(d => d.active === false).concat(activeDrawers);
    ordered.forEach(d => (d.pos_aliases || []).forEach(a => { if (a) drawerByName[String(a).trim().toLowerCase()] = d; }));
    ordered.forEach(d => { if (d.name) drawerByName[String(d.name).trim().toLowerCase()] = d; });
    // A cash report with no Register column, on a bar that runs exactly ONE register,
    // is unambiguously that register. Resolving it is what lets the import recognise
    // the operator's own hand count of the same register-day: the two sides used to
    // compare a blank against 'Main Bar' and never match, so the day was counted twice
    // in Drawer Net, the short rate, Loss Prevention and the Books cash sheet.
    // With TWO OR MORE registers a column-less row is a whole-day figure and is
    // deliberately left day-level — attributing it to one register would invent data.
    // ⚠ soleDrawer DELIBERATELY counts ACTIVE registers only — do NOT widen it to allDrawers.
    // A bar now running one register (having archived a second) would go back to writing
    // day-level rows that do not match its own hand counts, which is the S42 DOUBLE-COUNT: a
    // wrong TOTAL in Drawer Net, the short rate, Loss Prevention and the Books cash sheet.
    // Attributing a column-less whole-day figure to the surviving register can only get the
    // per-register SPLIT wrong, while the total and the dedupe stay right — and nothing records
    // WHEN the other register was archived, so the split is unknowable either way. A wrong total
    // is worse than a wrong split. Pinned by verify-cash-archived-register.js case D.
    const soleDrawer = activeDrawers.length === 1 ? activeDrawers[0] : null;
    const staffByName = this._staffByName();
    const existing = (App.shiftData && App.shiftData.sc_variances) || [];
    // ⚠⚠ THE HAND COUNT IS FOUND BY KEY, NOT A _findDup SEARCH (S99/S103). _findDup CONSUMES its
    // match, so it could only ever test the FIRST file row that landed on a register-day — an
    // AM/PM or daypart-split cash report (buildSales calls that "an ordinary export shape") had
    // every later row find nothing unused. And it returned the FIRST ARRAY MATCH, so array order
    // decided protect-vs-replace. This map is order-independent, re-consulted for every row.
    // S140: a hand count is no longer SILENTLY protected. If the file's figure for the
    // register-day DIFFERS from the hand count it becomes a conflict the operator resolves (keep
    // mine / use the file); if it MATCHES, the hand count simply stands (keptManual). Bar Cop never
    // picks between two figures the operator entered themselves ([[user-chooses-conflicts]]).
    const manualByKey = new Map();
    existing.forEach(x => { if (x && x.source === 'manual') manualByKey.set(x.date + '|' + (x.drawer_id || ''), x); });
    const keptKeys = new Set();       // register-DAYS reported as kept (file matched), N counts days not rows
    const conflictKeys = new Set();   // register-days already raised as a conflict (first file row establishes it)
    /* ⚠ "IS THERE A FIGURE HERE" MUST ASK App.parseNum, NOT "IS THE CELL NON-BLANK". This was a
       bare non-empty-string test, so a POS placeholder — `-`, `--`, `N/A`, `#DIV/0!`, `#REF!`, and
       a drawer nobody closed prints exactly that — passed as a real value, `_num` turned it into
       0, and the row stored as **$0.00, Within Tolerance**.
       That is not a wrong number in one cell. It converts the honest "Not counted" state into a
       CLEAN BILL OF HEALTH across the Hub shift card, Where You Stand, the loss-flag rows and the
       Bar Cop Briefing ("The register is clean this week... Nothing walking this week"), on a week
       where nobody counted a drawer. A loss-prevention screen reading all-clear because the file
       had a dash in it is the worst failure this app can have.
       It also stops a junk Expected or Counted cell from becoming 0 INSIDE the subtraction below
       and fabricating a full-magnitude Short (`#REF!` against $1,000 expected read as a $1,000
       Short) — with `has` honest, that row falls through to `skipped` and is reported.
       This is the twin of the sales door's `numeric` test (`App.parseNum(v) != null`), which was
       fixed for exactly this and never carried across to cash. */
    const has = v => App.parseNum(v) != null;
    const cents = n => Math.round(n * 100) / 100;
    /* ⚠⚠ NEVER ZERO A COLUMN THE FILE CANNOT CARRY — S140's rule, finally stated for cash (SH2).
       A replacement REUSES the prior row's id, so it overwrites the whole record, and the record
       this door builds is blank in every operator-authored field. Of the six keys FIELDS.cash can
       map (date, drawer, cashier, expected, counted, over_short) only `cashier` is one of these:
       `reason`, `notes` and `shift_type` can NEVER arrive in a file, so a file can only ever
       DESTROY them.
       Measured on the live app: a re-drop turned the BY column from "Maria G." into "-", and
       choosing "Use the file" at the conflict prompt erased the manager's reason AND their note —
       under a modal whose own words promise only "Pick which FIGURES to keep." On the screen loss
       prevention runs on, who counted the drawer and why it was short is the evidence.
       ⚠ `cashier` is the one field a file CAN carry, so it is only preserved when the row did not
       name one. Carrying is not freezing. */
    const carryPrior = (rec, prior, fileNamedCashier) => {
      if (!prior) return rec;
      if (!fileNamedCashier) {
        rec.cashier = prior.cashier || '';
        rec.cashier_id = prior.cashier_id || '';
      }
      rec.reason = prior.reason || '';
      rec.notes = prior.notes || '';
      rec.shift_type = prior.shift_type || '';
      return rec;
    };
    /* Which dates have a NAMED-register row? Used to recognise a column-less TOTALS line (S142).
       ⚠ ONLY A ROW THAT WILL ACTUALLY IMPORT COUNTS. This asked "is there a named row on this
       date", not "is there a named row that produces a FIGURE" — so a report whose per-register
       rows all printed `--` for a drawer nobody closed made the date look covered, and the
       column-less row carrying the day's ONLY readable over/short was thrown away as a duplicate
       of two rows that imported nothing. The day ended with no cash record at all, which is the
       precise opposite of what the totals-line skip exists to protect (a DOUBLE count). */
    const namedDates = new Set();
    (rows || []).forEach(r => {
      if (!String(r.drawer || '').trim()) return;
      if (!(has(r.over_short) || (has(r.expected) && has(r.counted)))) return;
      const d = this.normDate(r.date, opts); if (d) namedDates.add(d);
    });
    const toAdd = []; const skipped = []; const undated = []; const conflicts = []; let dupCount = 0; let keptManual = 0; let extraDropped = 0; let totalsLines = 0; const used = new Set();
    const fileSeen = new Set(); let fileRepeats = 0;   // exact repeats WITHIN this one file (S218)
    (rows || []).forEach(r => {
      const date = this.normDate(r.date, opts);
      /* ⚠ AN UNREADABLE DATE IS ITS OWN OUTCOME, NOT "no over/short figure". Both skips went into
         one `skipped` list and the cockpit renders that list as "N rows skipped, no over/short
         figure" — so a file whose date cell reads "Jul 24" (no year, an ordinary export shape) sent
         the operator to stare at an Over/Short column that was perfectly fine. The two sibling
         doors already split this: buildServer has its own `undated`, buildSales says "no usable
         date or sales figure". Cash was the only one that named the wrong column. */
      if (!date) { undated.push((r.drawer || '').trim() || '(no date)'); return; }
      const dName = (r.drawer || '').trim();
      /* ⚠ SKIP A WHOLE-DAY TOTALS LINE (S142 + S190). A column-less row on a date that ALSO has
         per-register rows is the day's TOTALS line; filing it beside the per-register rows
         double-counts the day (consumers sum by date, not by register) in Drawer Net, the short
         rate, Loss Prevention and the Books cash sheet. Skip + report it. This fires on BOTH a 2+
         register bar (the blank stays day-level) AND a single-register bar (S190 — soleDrawer would
         otherwise resolve the blank onto the one register and double it). A blank row on a date with
         NO named rows is a legitimate whole-day count and is kept.
         ⚠ THIS TEST RUNS BEFORE THE OVER/SHORT DERIVATION, NOT AFTER IT. Below the derivation, a
         totals row whose own Over/Short read `N/A` fell out through `skipped` instead and the
         cockpit printed "1 row skipped, no over/short figure" — sending the operator to a column
         that was never going to be used, which is the same mis-naming the `undated` split directly
         above was just written to stop. What the row IS does not depend on what its cells say. */
      if (!dName && namedDates.has(date)) { totalsLines++; return; }
      const exp = this._num(r.expected), cnt = this._num(r.counted), os = this._num(r.over_short);
      let expected_cash = null, counted_cash = null, variance;
      // ⚠ THE POS'S OWN OVER/SHORT IS AUTHORITATIVE (S144). When the file carries it, use it —
      // deriving counted-minus-expected instead lost to a divergent basis (Counted often matches
      // "deposit" / "ending cash", which includes an opening bank the Expected column omits), so a
      // drawer the POS reported CLEAN stored as $200 Over. If a Counted figure came with it,
      // reconstruct a CONSISTENT Expected (counted - over/short) so the stored triple balances and
      // the row stays editable in the hand form. Only with NO over/short do we derive it.
      // (Sign of a "($50)" shortage is handled in _num/_isNeg — S139.)
      if (has(r.over_short)) {
        variance = cents(os);
        if (has(r.counted)) { counted_cash = cnt; expected_cash = cents(cnt - os); }
      } else if (has(r.expected) && has(r.counted)) {
        expected_cash = exp; counted_cash = cnt; variance = cents(cnt - exp);
      } else { skipped.push(date); return; }            // no over/short derivable
      const dRec = dName ? drawerByName[dName.toLowerCase()] : soleDrawer;
      const drawer = dRec ? dRec.name : dName;
      const drawerId = dRec ? dRec.id : '';
      // (The whole-day totals-line skip now runs ABOVE the over/short derivation — see the note there.)
      const cName = (r.cashier || '').trim();
      const staff = cName ? staffByName[cName.toLowerCase()] : null;
      const cashier = staff ? staff.name : cName;
      // ⚠ KEYED ON drawer_id, NOT the register NAME. The hand form dedupes on `drawer_id`
      // (sc-cash-control saveCountDrawer) and this side used to dedupe on `drawer`, so the two
      // halves of one check compared DIFFERENT FIELDS and a blank never lined up with a named
      // register — the collision went undetected in both directions.
      // Tolerance is the matched register's own (App.drawerTolerance); $10 when unrecognized.
      /* ⚠⚠ BARE `App`, NOT `window.App` (S320). `App` is a top-level `const` in app.js and is NEVER
         assigned to `window`, so `window.App` is undefined and this whole condition was ALWAYS FALSE.
         Every drawer in every bar was judged against the hardcoded 10 on the right, and an operator
         who set their own cash tolerance had it silently ignored — a $20-tolerance bar getting drawers
         called Short and Over that are inside its own policy. `recovery.js:42` carries a comment
         warning about this exact mistake. The `: 10` was redundant besides: `App.drawerTolerance`
         already returns 10 when the drawer has no tolerance of its own, so the guard was duplicating
         the default while suppressing the real answer ([[the-loop]] #40). */
      const tol = App.drawerTolerance(dRec || null);
      const status = (expected_cash != null && VL) ? VL.statusOf(variance, expected_cash, counted_cash, dRec ? dRec.id : null)
                   : (Math.abs(variance) <= tol ? 'Within Tolerance' : variance < 0 ? 'Short' : 'Over');
      const rec = {
        id: App.uid(), date, shift_type: '',
        drawer_id: drawerId, drawer,
        cashier_id: staff ? staff.id : '', cashier,
        source: 'import', expected_cash, counted_cash, variance,
        tolerance: tol, status, reason: '', notes: '',
        imported: true, created_at: new Date().toISOString()
      };
      const dayKey = date + '|' + drawerId;
      /* ⚠⚠ A LINE REPEATED INSIDE ONE FILE (S218). Nothing compared a file row against the rows
         beside it, so a byte-identical repeat was written twice on a first import — two counts for
         one register-day, doubling the over/short. This door's own comment 30 lines up states the
         identity: "KEYED ON drawer_id, NOT the register NAME. The hand form dedupes on drawer_id" —
         one count per register per day, which is what a drawer count IS. So a second row with the
         same register, day AND the same two figures is a repeated line, not a second count.
         ⚠ Two DIFFERENT registers with identical figures still both import (the key carries
         drawer_id), and so does a genuine recount with a different figure — that falls through to
         the conflict/replace logic below, where the operator is asked. */
      /* ⚠⚠ AND IT KEYS ON THE NAME WHEN THERE IS NO ID — my first version used `dayKey` and a
         CONTROL caught it inside a minute. A register the operator has not set up in Bar Cop
         resolves to `drawer_id: ''` (see `dRec` above), so EVERY unrecognized register shares one
         key: "Bar 1" and "Bar 2" with the same figures collapsed into one and a real count was
         silently dropped. That is the guard-refuses-real-data failure this whole item exists to
         avoid, introduced by the fix for it. Recognized registers key on their id (canonical, so a
         rename cannot split them); unrecognized ones key on the name the file used. */
      /* ⚠⚠ AND THE VARIANCE IS IN THE KEY, NOT JUST expected/counted — an existing pin caught this
         and it would have destroyed real counts. A cash row may carry ONLY an over/short figure
         (`r.over_short`), in which case expected_cash and counted_cash are both null and every row
         for that register-day looked identical to a key built on them: two genuine sittings at
         -$20.00 and -$27.00 collapsed into one. The variance is the figure those rows actually
         carry, so it decides. Second time in this one guard that a key was too narrow; the controls
         found both. */
      const fileKey = date + '|' + (drawerId || 'name:' + drawer.toLowerCase())
        + '|' + (expected_cash == null ? '' : expected_cash) + '|' + counted_cash + '|' + variance;
      if (fileSeen.has(fileKey)) { fileRepeats++; return; }
      fileSeen.add(fileKey);
      const manual = manualByKey.get(dayKey);
      if (manual) {
        // The operator counted this register-day by hand. Only a DIFFERING figure is a conflict; an
        // identical one is not — never prompt when they match. The FIRST file row per register-day
        // establishes the comparison (the same per-day scope S99/S103 already use; a file that
        // lists the register-day twice is S141, deliberately still scoped per-day here).
        // A LATER file row for a register-day already kept-or-conflicted is dropped — the per-day
        // scope is deliberate (S99/S103) — but it must NOT be dropped in SILENCE (S141): a shift-
        // split cash file lists a register-day more than once, and the operator has to know a row
        // was not imported. Count it so the cockpit can say so.
        if (conflictKeys.has(dayKey) || keptKeys.has(dayKey)) { extraDropped++; return; }
        if (this._sameVariance(manual, rec)) { keptKeys.add(dayKey); keptManual++; return; }
        conflictKeys.add(dayKey);
        rec.id = manual.id;   // "use the file" replaces the hand count IN PLACE (idempotent retry, S147)
        carryPrior(rec, manual, !!cName);   // SH2 — the figures are the choice; the note is not
        conflicts.push({
          key: dayKey, date, drawer_id: drawerId, drawer,
          mine:   { variance: cents(+manual.variance || 0),
                    expected_cash: manual.expected_cash != null ? cents(+manual.expected_cash) : null,
                    counted_cash:  manual.counted_cash  != null ? cents(+manual.counted_cash)  : null },
          theirs: { variance: variance, expected_cash: expected_cash, counted_cash: counted_cash },
          useRec: rec
        });
        return;
      }
      // ⚠ REPLACE a prior IMPORT so a CORRECTED drawer report actually lands (this used to `return`
      // and DISCARD the correction while the screen said "already logged"). Only IMPORTED rows are
      // candidates: a manual row is handled above, so array order cannot change the verdict. The
      // search stays CONSUME-ONCE on purpose — a file that legitimately lists a register-day twice
      // must import both rows, and only the first replaces anything. The superseded imported row is
      // deleted in _commitCashRows, mirroring _commitSales.
      const prior = this._findDup(existing, used, x => x.date === date && (x.drawer_id || '') === drawerId && x.source !== 'manual');
      // ⚠ REUSE the superseded row's id (S147): a replacement is an UPSERT-in-place, so a retry
      // (after a refused write) re-upserts the SAME id instead of inserting another row — the retry
      // is idempotent and a register-day can never grow unbounded. _commitCashRows still retires any
      // EXTRA prior for the key (a re-import with fewer rows than before) as the backstop.
      if (prior) { dupCount++; rec.id = prior.id; carryPrior(rec, prior, !!cName); }   // SH2
      toAdd.push(rec);
    });
    // `dupCount` means REPLACED (an earlier import), `keptManual` counts register-days the file
    // matched a hand count on, `conflicts` are register-days the operator must choose on,
    // `extraDropped` counts later file rows dropped because their register-day was already handled,
    // `totalsLines` counts column-less whole-day rows skipped as a totals line (S142), `skipped`
    // is rows with NO over/short derivable, and `undated` is rows whose DATE could not be read.
    // The last two are different problems with different fixes and must never be reported as one.
    // `fileRepeats` = register-days this file listed twice with identical figures; counted once.
    return { toAdd, skipped, undated, dupCount, keptManual, conflicts, extraDropped, totalsLines, fileRepeats };
  },

  // Two drawer figures are "the same" for conflict purposes when their over/short agrees to the
  // cent AND — where BOTH sides carry expected + counted — those agree too. A file that reports
  // only an over/short (no expected/counted) is compared on the over/short alone.
  _sameVariance(a, b) {
    const c = n => Math.round((+n || 0) * 100) / 100;
    if (c(a.variance) !== c(b.variance)) return false;
    if (a.expected_cash != null && b.expected_cash != null && c(a.expected_cash) !== c(b.expected_cash)) return false;
    if (a.counted_cash  != null && b.counted_cash  != null && c(a.counted_cash)  !== c(b.counted_cash))  return false;
    return true;
  },

  // A POS per-server sales report: one row per server (per day) with covers +
  // sales. Matches the server to the roster by name; writes revenue_server_check
  // records so Server Check reads it the same as a hand-entered check. Dedup on
  // staff + date + SHIFT so re-dropping the report never double-logs. The figures are deliberately
  // NOT in the key — see the comment on the dedup itself; a hand-corrected row must still be the
  // same check. (Was staff + date + covers + sales until 2026-07-27, which broke exactly that.)
  buildServer(rows, opts) {
    const staffByName = this._staffByName();
    const existing = (App.data && App.data.revenue_server_checks) || [];
    const toAdd = []; const skipped = []; const incomplete = []; const undated = []; let dupCount = 0; const used = new Set();
    const summaryRows = []; const notService = []; const conflicts = []; let replaced = 0;
    const fileSeen = new Set(); let fileRepeats = 0;   // exact repeats WITHIN this one file
    (rows || []).forEach(r => {
      /* ⚠⚠ A POS TOTALS LINE IS NOT A PERSON, AND TELLING THE OPERATOR TO ADD IT TO THE ROSTER IS
         THE WORST ADVICE THIS DOOR COULD GIVE. `isSummaryName` was never called here, so
         "Grand Total" fell through to `skipped` — which this door renders as *"Not matched to your
         roster: Grand Total. Add them in the Staff Roster or rename to match."* Measured on what
         happens if an operator follows that instruction: the totals line becomes the #2 server on
         the scorecard and the Revenue audit reads **$9,219.00 of server sales against a truth of
         $4,609.50** — exactly double, because the file's own subtotal is counted alongside the rows
         it totals. `isSummaryName` lives in this file and its own comment says it belongs here
         rather than privately at one door, "because the same summary line lands on doors 4, 11 and
         12". Door 12 calls it; this one did not. */
      if (this.isSummaryName(r.name)) { summaryRows.push(String(r.name || '').trim()); return; }
      const staff = staffByName[(r.name || '').trim().toLowerCase()];
      // ⚠ Math.max(0, ...): the coercion now reads a sign, and a server cannot ring NEGATIVE
      // covers. Left signed, "(12)" stored -12, which r-server-check prints and sums into the
      // team total. The `!covers` guard below catches 0 and NaN but not a negative.
      const covers = Math.max(0, Math.round(App.parseNum(r.covers) ?? 0));
      const sales = this._num(r.sales);
      // Two different problems, two different lists. An unmatched NAME is a roster fix.
      // A server who IS on the roster but rang no covers or no sales is just a row with
      // nothing to log. Lumping them sent the operator to "add them in the Staff Roster"
      // for someone already on it, so they added a duplicate that fixed nothing and
      // corrupted the roster.
      if (!staff) { skipped.push(r.name || '(blank)'); return; }
      /* ⚠⚠ AND THE IMPORT WROTE SERVER CHECKS FOR PEOPLE THE MANUAL FORM WILL NOT EVEN OFFER. The
         form builds its picker from `App.staffOptions(..., {audience:'service'})` — active staff in
         Bar or Front of House. This matched the WHOLE roster, with no status and no department test.
         Measured: a Line Cook, the salaried Manager and an INACTIVE bartender all had server checks
         written for them, and one kitchen row at 5 covers / $40 dragged the Team Average tile from
         $40.00 to $36.44. Two doors writing one record on two different rules is the defect, and the
         form's rule is the right one, so this reads the same predicate. */
      if (staff.status === 'Inactive' || (App.isService && !App.isService(staff))) { notService.push(staff.name); return; }
      if (!covers || !(sales > 0)) { incomplete.push(r.name || '(blank)'); return; }
      const recDate = this.normDate(r.date, opts);
      /* ⚠ A ROW WITH NO READABLE DATE IS NOT AN IMPORT, IT IS A SKIP. This wrote the record with
         `date: ''` and counted it as imported. Every consumer of a server check filters by date
         (r-server-check's scorecard is `(c.date || '') >= cutoff`), so the row was invisible
         everywhere the operator would look for it — while the audit's readiness count, which does
         NOT date-filter when there are no closed weeks, still counted it. "2 server checks
         imported" for two rows that appear on no screen.
         The two sibling doors already refuse this: buildSales says "No days imported. Check that
         the file has a Date column", buildCash says "Each row needs a date". Only server accepted
         it. A per-server export with a date cell like "Jul 24" or "7/24" (no year) hits this. */
      if (!recDate) { undated.push(r.name || '(blank)'); return; }
      /* ⚠⚠ THE DEDUP KEY INCLUDED THE FIGURES, SO CORRECTING A ROW DESTROYED ITS OWN IDENTITY.
         The key was staff + date + covers + sales — so a row the operator FIXED BY HAND no longer
         matched the file it came from, and re-dropping the same export wrote it a second time.
         Measured: Maria at 66 covers / $3,368 against a truth of 24 / $1,684.
         A server check's identity is WHO, WHEN and WHICH SERVICE PERIOD. The figures are the
         PAYLOAD, and a payload that disagrees is a CONFLICT, not a different record. buildSales has
         worked this way since S140 ([[user-chooses-conflicts]]) and buildCash since S99; this door
         was the last one still keying on its own values.
         ⚠ `shift` is IN the identity because a server legitimately works Lunch and Dinner on one
         date — keying on staff + date alone would refuse the second service as a duplicate. A file
         with no shift column leaves it '' on both sides, collapsing to staff + date, which is right
         for the one-row-per-server-per-day export that shape comes from. */
      const shiftName = (r.shift || '').trim();
      /* ⚠⚠ A LINE REPEATED INSIDE ONE FILE — FOUND BY A REAL DROP, NOT BY A SCAN (2026-07-27).
         `_findDup` searches only what is ALREADY SAVED, and its `used` set exists to stop one saved
         record absorbing two file rows. NOTHING compared a file row against the rows beside it, so
         a byte-identical repeat was written twice on the FIRST import, before there was anything to
         dedup against. Measured on Kyle's own test file, whose last line repeats its second:
         "9 server checks imported" for 8 real checks, Jessica M. listed twice for Jul 25 Dinner, and
         her scorecard overstated by 42 covers and $2,145.50 — which also lifted her check average
         and put her on top of the board.
         ⚠ ONLY AN EXACT REPEAT IS DROPPED — same server, same date, same service period AND the
         same covers and sales to the cent. Two rows that share an identity but differ (a shift split
         across revenue centres) still both import, which is right: they sum to the same covers,
         sales and check average on the scorecard. Matching to the cent is not a coincidence.
         ⚠ AND IT IS REPORTED, never silent, so an operator who really did have two identical rows
         can see that one was collapsed.
         ⛔ DO NOT COPY THIS TO buildHours WITHOUT DECIDING IT THERE. Measured 2026-07-27: hours,
         tips, voids and cash double the same way, but a repeated 4-hour line is just as likely a
         genuine split shift, and dropping it is the payroll version of this bug. See S218. */
      const fileKey = staff.id + '|' + recDate + '|' + shiftName + '|' + covers + '|' + sales.toFixed(2);
      if (fileSeen.has(fileKey)) { fileRepeats++; return; }
      fileSeen.add(fileKey);
      const rec = {
        id: App.uid(), date: recDate, shift: shiftName, shift_id: '',
        staff_id: staff.id, server_name: staff.name, covers, sales,
        imported: true, source: 'import', saved_at: new Date().toISOString()
      };
      const prior = this._findDup(existing, used, x => x.staff_id === staff.id && x.date === recDate
            && (x.shift || '').trim() === shiftName);
      if (prior) {
        // Identical row: already logged, exactly as before.
        if ((prior.covers || 0) === covers && Math.abs((prior.sales || 0) - sales) < 0.001) { dupCount++; return; }
        /* ⚠ PROVENANCE DECIDES, AND `imported` ALONE IS NOT IT — S140's exact trap. `saveEdit`
           spreads the prior record, so a HAND CORRECTION to an imported row keeps `imported:true`;
           testing that flag would silently overwrite the very correction this fix exists to
           protect. `source` is the field ([[user-chooses-conflicts]]), and the edit doors stamp
           'manual'. Legacy rows carry neither, so fall back to `imported` and treat everything else
           — including the seed, which stamps no provenance — as the operator's own. */
        const mine = prior.source === 'manual'
          || (prior.source == null && prior.imported !== true);
        if (!mine) { rec.id = prior.id; replaced++; toAdd.push(rec); return; }   // replacing our own earlier import
        conflicts.push({
          key: prior.id, date: recDate, shift: shiftName, name: staff.name,
          mine:   { covers: prior.covers || 0, sales: prior.sales || 0 },
          theirs: { covers, sales },
          useRec: Object.assign({}, rec, { id: prior.id })
        });
        return;
      }
      toAdd.push(rec);
    });
    // `replaced` is NOT `dupCount`: this door renders dupCount as "already logged", which is false
    // of a row whose figures we just overwrote. Different events, different words.
    return { toAdd, skipped, incomplete, undated, dupCount, replaced, conflicts, fileRepeats, summaryRows, notService };
  },

  // A POS product-mix report: one row per item with units sold. Matches the item
  // to the menu by name; toAdd carries { item_id, covers } updates (not records),
  // applied in _commitPmix. Unmatched item names are skipped and surfaced.
  buildPmix(rows) {
    const items = (App.data && App.data.menu_items) || [];
    /* ⚠ TWO PASSES, ARCHIVED FIRST, SO A LIVE ITEM ALWAYS WINS ITS NAME. This was one pass over
       every item including archived ones, so which copy received the units was decided by ARRAY
       POSITION. An item the operator rebuilt (old one archived, new one live) could take its
       week's sales onto the archived row, which Menu Engineering filters out of every board — the
       message said "1 menu item updated from sales mix" and the number appeared nowhere.
       The cash door already does exactly this two-pass ordering for registers (S145); PMIX never
       got it. Archived items are still indexed, so a POS still selling a retired item matches
       rather than reporting a false "name not matched". */
    const byName = {};
    items.forEach(it => { if (it && it.name && it.archived) byName[it.name.trim().toLowerCase()] = it; });
    items.forEach(it => { if (it && it.name && !it.archived) byName[it.name.trim().toLowerCase()] = it; });
    // AGGREGATE BY ITEM — never one entry per CSV row. A PMIX split by daypart, revenue centre or
    // order type lists the same item several times, which is an ordinary export shape, and the
    // week's units sold is their SUM. One-entry-per-row meant the LAST row won (lunch silently
    // discarded), _commitPmix walked the same object twice so prev_weekly_covers was overwritten
    // with an intermediate figure that never existed (corrupting the mix-delta), and the same
    // object went into the bulk upsert twice — Postgres rejects a duplicate id in one ON CONFLICT
    // chunk, so the whole batch fell to the offline queue while the screen said "imported".
    // sc-dashboard.js dedupes with a Map for exactly that last reason.
    // Aggregating HERE rather than at commit means the PREVIEW shows the combined figure, so the
    // operator approves the number that will actually be saved.
    const byItem = new Map();
    // ⚠ TWO LISTS, NOT ONE. `skipped` used to hold both "this name is not on your menu" and "this
    // row's Units cell is unreadable", and the screen renders it as "N names not matched" — so an
    // item that IS on the menu with a junk Units cell sent the operator off to rename a menu item
    // that was already correct. buildServer split exactly this into skipped vs incomplete for
    // exactly this reason; PMIX never got the split.
    const skipped = []; const incomplete = []; const dupCount = 0; let merged = 0;
    (rows || []).forEach(r => {
      const nm = (r.name || '').trim().toLowerCase();
      const units = this._count(r.units);   // signed: a "-3" return REDUCES the week's units; NaN (junk) is skipped below
      if (!nm) { skipped.push(r.name || '(blank)'); return; }
      const it = byName[nm];
      if (!it) { skipped.push(r.name); return; }
      if (isNaN(units)) { incomplete.push(r.name); return; }
      const prior = byItem.get(it.id);
      if (prior) { prior.covers += units; merged++; }
      else byItem.set(it.id, { item_id: it.id, name: it.name, covers: units });
    });
    // Drop an item whose NET units come out NEGATIVE (returns exceeded sales in this file, or a
    // returns-only export dropped by mistake). _commitPmix REPLACES weekly_covers, so writing a
    // negative would overwrite the real prior figure and show "-3 sold/wk" on Menu Engineering,
    // dragging the category classification.
    // ⚠ ZERO IS KEPT, deliberately. An item listed at 0 units (or whose dayparts net to 0) genuinely
    // sold none this week, and that is a TRUE figure that must overwrite. Filtering it out left last
    // week's number on screen as if it were current — and a zero-seller is exactly what the Dog Test
    // exists to surface, so hiding it behind a stale figure is the worse lie. `> 0` was too greedy.
    // ⚠ A DROPPED ITEM IS REPORTED. This filter is right — writing a negative would overwrite the
    // real prior figure and show "-3 sold/wk" — but the item vanished in TOTAL SILENCE: not in
    // toAdd, not in skipped, and the message still read "1 menu item updated from sales mix". The
    // item then kept LAST week's units and presented them as this week's mix on Menu Engineering,
    // driving its Star/Dog call, its suggested price and the weekly upside. Same reporting rule
    // the sales door got for a column it could not read.
    const toAdd = [];
    const netNegative = [];
    byItem.forEach(u => { if (u.covers >= 0) toAdd.push(u); else netNegative.push(u.name || u.item_id); });
    // `merged`, NOT dupCount. In every other builder in this file dupCount means rows SKIPPED
    // because they were already logged, and every screen renders it as "N already logged" — the
    // opposite of what happened here, where N rows were FOLDED INTO a total. Reusing the name
    // would have been a message waiting to lie the moment someone wired it up. dupCount stays 0
    // so the shared build() contract documented at the top of this file still holds.
    return { toAdd, skipped, incomplete, netNegative, dupCount, merged };
  },

  // ── Persist ──────────────────────────────────────────────────────────────
  async commit(type, toAdd) {
    if (type === 'sales') return this._commitSales(toAdd);
    if (type === 'pmix')  return this._commitPmix(toAdd);
    if (type === 'cash')  return this._commitCashRows(toAdd);
    const t = this.TYPES[type];
    if (!t) return false;
    let ok = true;
    try {
      for (const rec of (toAdd || [])) { ok = (await App.putRecord(t.module, t.kind, rec)) && ok; }
    } catch (e) { return false; }
    return ok;
  },

  // PMIX upserts weekly_covers on the matched menu items in place (no new
  // records), snapshotting the prior covers for the mix-delta when it changes.
  async _commitPmix(toAdd) {
    const items = (App.data && App.data.menu_items) || [];
    const byId = {};
    items.forEach(it => { if (it) byId[it.id] = it; });
    const touched = [], undo = [], seen = new Set();
    (toAdd || []).forEach(u => {
      const it = byId[u.item_id]; if (!it) return;
      // ⚠ Snapshot BEFORE this item's first mutation, and only ONCE. A second snapshot would capture
      // the already-changed values and "restore" the wrong number. buildPmix aggregates, so a
      // duplicate row for one item should not reach here, but the guard costs nothing and that
      // failure would be silent.
      if (!seen.has(it.id)) { seen.add(it.id); undo.push(...App.snapshotRows([it])); }
      if (it.weekly_covers != null && u.covers !== it.weekly_covers) {
        it.prev_weekly_covers = it.weekly_covers;
        it.weekly_covers_updated_at = new Date().toISOString();
      }
      it.weekly_covers = u.covers;
      touched.push(it);
    });
    // ⚠ These are LIVE menu_items rows, so putRecordsBulk cannot revert them (by contract the caller
    // has already mutated in place), and both callers redraw off memory the moment this returns.
    // The result was RETURNED and honoured — so the operator did see "Save failed" — but nothing put
    // the numbers back, so the whole Menu Engineering board (Star / Plowhorse / Dog, suggested
    // prices, the reprice count, the weekly upside) sat there recomputed from covers the server had
    // rejected. Marking those prices live then succeeds for real and is permanent, while the volume
    // that justified them existed only in that tab.
    const ok = await App.putRecordsBulk('core', 'menu_item', touched);
    if (!ok) App.restoreRows(undo);
    return ok;
  },

  // Sales upserts by DATE: a re-import of the same week replaces those days'
  // figures (one record per day), so it never double-counts and supersedes any
  // older record for the day.
  // Cash re-import: the MIRROR of _commitSales. A corrected drawer report has to
  // land, so a register-day that was previously written is replaced rather than
  // skipped. Insert the new records FIRST, then remove the superseded ones, so a
  // failure mid-way never leaves a register-day with no record at all.
  // ⚠ `stale` is computed BEFORE the inserts: putRecord pushes the new row into the
  // same array, and it shares the key, so computing it afterwards would delete the
  // row that was just written.
  // ⚠ RETIRE REGARDLESS OF SOURCE (S140). This no longer skips `source:'manual'`. In the ordinary
  // import path buildCash only lets a register-day reach toAdd if it had NO hand count (a differing
  // hand count becomes a conflict the operator resolves, a matching one is kept — neither reaches
  // here), so the only 'manual' row this can retire is one the operator EXPLICITLY chose to
  // overwrite with the file (its resolved row is in toAdd). Retiring it is exactly that choice.
  async _commitCashRows(toAdd) {
    const keys = new Set((toAdd || []).map(r => r.date + '|' + (r.drawer_id || '')));
    const fresh = new Set((toAdd || []).map(r => r.id));
    const stale = (((App.shiftData && App.shiftData.sc_variances) || []))
      .filter(v => v && !fresh.has(v.id)
        && keys.has(v.date + '|' + (v.drawer_id || '')));
    let ok = true;
    const landed = new Set();
    try {
      for (const rec of (toAdd || [])) {
        const good = await App.putRecord('sc', 'variance', rec);
        if (good) landed.add(rec.date + '|' + (rec.drawer_id || ''));
        ok = good && ok;
      }
      // ⚠ RETIRE PER REGISTER-DAY, not all-or-nothing (S102) — the same correction as _commitSales
      // above, and for the same reason. Retiring unconditionally left a register-day with NO
      // record when every insert was refused; retiring behind one shared `ok` meant a single
      // refused insert stopped every retirement, so each register-day whose insert DID land held
      // the old figure beside the new one and was counted twice in Drawer Net, the short rate,
      // Loss Prevention and the Books cash sheet. Keyed on what actually landed, the worst case is
      // the refused register-day keeping its OLD figure — visible and re-importable.
      for (const e of stale) {
        if (!landed.has(e.date + '|' + (e.drawer_id || ''))) continue;
        ok = (await App.removeRecord('sc', 'variance', e.id)) && ok;
      }
    } catch (e) { return false; }
    return ok;
  },

  async _commitSales(toAdd) {
    const dates = new Set((toAdd || []).map(r => r.date));
    const fresh = new Set((toAdd || []).map(r => r.id));
    // sc_shifts is ONE record per date. RETIRE REGARDLESS OF SOURCE (S140): a manual re-save (now
    // source:'manual', imported:false) or a resolved "use the file over my hand entry" must not
    // leave the old row beside the new one and double the day. Only a date being WRITTEN is touched
    // (`dates`), so a hand day the operator KEPT — never in toAdd — is never retired. `!fresh`
    // guards the rows we are writing. Insert the new records FIRST, then remove the superseded ones,
    // so a failure mid-way never leaves a date with no record at all.
    const stale = (((App.shiftData && App.shiftData.sc_shifts) || []))
      .filter(s => s && dates.has(s.date) && !fresh.has(s.id));
    let ok = true;
    const landed = new Set();
    try {
      for (const rec of (toAdd || [])) {
        const good = await App.putRecord('sc', 'shift', rec);
        if (good) landed.add(rec.date);
        ok = good && ok;
      }
      // ⚠ RETIRE PER DATE, not all-or-nothing (S102). Two earlier shapes were both wrong:
      //   unconditional  — every insert refused still DELETED the prior record, leaving the date
      //                    EMPTY (fixed 2026-07-21, S86);
      //   behind one `ok` — one refused insert stopped EVERY retirement, so each date whose
      //                    insert DID land kept the old record beside the new one and was counted
      //                    TWICE. Every consumer sums the window (Confirm the Week's auto-fill,
      //                    the cash-forecast baseline, the sales-tax hold), so a $3,100 week
      //                    reported $4,600 while the screen said only "Save failed".
      // Keyed on what actually landed, the worst case is the refused date keeping its OLD figure —
      // visible, re-importable, and never empty or doubled.
      for (const e of stale) {
        if (!landed.has(e.date)) continue;   // its replacement never arrived — leave it alone
        ok = (await App.removeRecord('sc', 'shift', e.id)) && ok;
      }
    } catch (e) { return false; }
    return ok;
  }
};

window.PosIngest = PosIngest;
