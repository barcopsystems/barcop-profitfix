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
      { key: 'card_tips', label: 'Card Tips',  required: false, match: ['card tips', 'credit tips', 'cc tips', 'card', 'credit card tips', 'charged tips', 'non-cash tips', 'non cash tips', 'noncash tips', 'charge tips', 'tips charged', 'electronic tips', 'card gratuity', 'auto gratuity', 'autograt'] },
      { key: 'cash_tips', label: 'Cash Tips',  required: false, match: ['cash tips', 'cash', 'declared cash tips', 'declared tips', 'declared', 'cash gratuity', 'cash tip', 'tips cash'] },
      { key: 'shift',     label: 'Shift',      required: false, match: ['shift', 'shift type', 'daypart', 'shift name', 'meal period'] }
    ],
    voids: [
      { key: 'amount', label: 'Amount',       required: true,  match: ['amount', 'total', 'value', 'comp amount', 'void amount', '$', 'amt', 'dollars', 'discount', 'discount amount', 'total amount', 'comp total', 'void total'] },
      { key: 'type',   label: 'Void or Comp', required: false, match: ['type', 'void/comp', 'void or comp', 'transaction', 'kind', 'adjustment type', 'category', 'action', 'reason type'] },
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
      { key: 'covers', label: 'Covers',     required: false, match: ['covers', 'covers count', 'guest count', 'guests', 'guest ct', 'headcount', 'heads', 'patrons', 'customers', 'checks', 'check count', 'tickets', 'transactions', 'orders', 'sales count'] }
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
      { key: 'covers', label: 'Covers',      required: true,  match: ['covers', 'guest count', 'guests', 'guest ct', 'headcount', 'customers', 'checks', 'check count', 'tickets', 'tables', 'transactions', 'orders'] },
      /* ⚠ NET BEFORE GROSS, and bare 'gross' is gone. Aloha, Lightspeed, TouchBistro and Square
         all print Gross Sales before Net Sales, so gross was winning — counting the comps and
         promos the operator already gave away as that server's own sales, which then drives the
         check average and the comp% signal. Bare 'amount'/'total' stay last: they are what an
         order-detail export calls its money column when it calls it nothing better. */
      { key: 'sales',  label: 'Total Sales', required: true,  match: ['net sales', 'net total', 'sales total', 'total sales', 'server sales', 'rung sales', 'sales', 'revenue', 'net', 'gross sales', 'total', 'amount', 'dollars'] },
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
      { key: 'units', label: 'Units Sold', required: true, match: ['units sold', 'quantity sold', 'qty sold', 'sold qty', 'total sold', 'number sold', 'item qty', 'units', 'sold', 'qty', 'units count', 'sales count', 'rung', 'quantity'] }
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

  // Normalize a POS date cell to canonical local YYYY-MM-DD (App.ymdLocal's
  // format), handling ISO, US MM/DD/YYYY, M/D/YY, and dash variants. The old code
  // only handled ISO (it appended 'T00:00:00' to everything), so MM/DD/YYYY became
  // Invalid Date and was stored raw — silently breaking dedup and week grouping.
  // Returns '' (not the raw string) when unparseable, so a bad row is skipped
  // rather than stored with a date that no comparison will ever match.
  normDate(raw) {
    if (!raw) return '';
    const s = String(raw).trim();
    if (!s) return '';
    const datePart = s.split(/[ T]/)[0];   // drop any trailing time component
    let m = datePart.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);   // ISO-ish YYYY-MM-DD
    if (m) return this._ymd(+m[1], +m[2], +m[3]);
    m = datePart.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);     // US MM/DD/YYYY (or DD/MM when the first field can't be a month)
    if (m) {
      let a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000;
      const mo = (a > 12 && b <= 12) ? b : a;
      const d  = (a > 12 && b <= 12) ? a : b;
      return this._ymd(y, mo, d);
    }
    const dt = new Date(s.length <= 10 ? s + 'T00:00:00' : s);   // "Jul 13 2026", ISO with time, etc.
    return isNaN(dt.getTime()) ? '' : App.ymdLocal(dt);
  },

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
  build(type, rows, opts) {
    if (type === 'hours') return this.buildHours(rows);
    if (type === 'tips')  return this.buildTips(rows);
    if (type === 'voids') return this.buildVoids(rows);
    if (type === 'sales') return this.buildSales(rows, opts);
    if (type === 'cash')  return this.buildCash(rows, opts);
    if (type === 'server') return this.buildServer(rows);
    if (type === 'pmix')  return this.buildPmix(rows);
    return { toAdd: [], skipped: [], dupCount: 0 };
  },

  buildHours(rows) {
    const staffByName = this._staffByName();
    const existing = (App.laborData && App.laborData.lc_actuals) || [];
    const toAdd = []; const skipped = []; let dupCount = 0; const used = new Set();
    (rows || []).forEach(r => {
      const staff = staffByName[(r.name || '').trim().toLowerCase()];
      const hours = this._hours(r.hours);
      if (!staff || isNaN(hours) || hours <= 0) { skipped.push(r.name || '(blank)'); return; }
      const recDate = this.normDate(r.date);
      // Skip an exact re-import (same staff + date + hours) so re-dropping a
      // timeclock file never double-counts hours into gross pay.
      if (this._isDup(existing, used, x => x.staff_id === staff.id && x.date === recDate && Math.abs((x.hours || 0) - hours) < 0.001)) {
        dupCount++; return;
      }
      const sal = App.isSalaried(staff);
      const wage = sal ? null : (App.wageForStaffOn ? App.wageForStaffOn(staff.id, recDate) : (staff.wage || 0));
      toAdd.push({
        id: App.uid(), date: recDate, staff_id: staff.id, name: staff.name,
        position_id: staff.position_id || '', shift_type: (r.shift || '').trim(),
        hours, wage, cost: sal ? 0 : hours * (wage || 0),
        notes: '', imported: true, created_at: new Date().toISOString()
      });
    });
    return { toAdd, skipped, dupCount };
  },

  buildTips(rows) {
    const staffByName = this._staffByName();
    const existing = (App.laborData && App.laborData.lc_tips) || [];
    const toAdd = []; const skipped = []; let dupCount = 0; const used = new Set();
    (rows || []).forEach(r => {
      const staff = staffByName[(r.name || '').trim().toLowerCase()];
      const cash = this._num(r.cash_tips);
      const card = this._num(r.card_tips);
      if (!staff || (cash + card) <= 0) { skipped.push(r.name || '(blank)'); return; }
      const recDate = this.normDate(r.date);
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
        shift_type: (r.shift || '').trim(),
        cash_tips: cash, card_tips: card, total_tips: cash + card,
        hours: null, notes: '', imported: true, created_at: new Date().toISOString()
      });
    });
    return { toAdd, skipped, dupCount };
  },

  buildVoids(rows) {
    const byName = this._staffByName();
    const existing = (App.shiftData && App.shiftData.sc_void_comps) || [];
    const today = App.todayLocal();
    const toAdd = []; const skipped = []; let dupCount = 0; const used = new Set();
    (rows || []).forEach(r => {
      // A void/comp is a LOSS magnitude. POS exports show it as a negative ("-15")
      // or accounting parens ("(15)") to signal it reduces sales; both are a $15
      // loss. Take the absolute value so those rows import instead of being dropped.
      const amount = Math.abs(this._num(r.amount));
      if (!(amount > 0)) { skipped.push('(no amount)'); return; }
      const t = (r.type || '').trim().toLowerCase();
      const type = (t.indexOf('comp') >= 0 || t === 'c') ? 'Comp' : 'Void';
      const serverName = (r.server || '').trim();
      const staff = serverName ? byName[serverName.toLowerCase()] : null;
      const server = staff ? staff.name : serverName;
      const item = (r.item || '').trim();
      const recDate = this.normDate(r.date) || today;
      // Skip an exact re-import (same date + amount + server + item) so re-dropping
      // a voids/comps export never double-counts loss.
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
    return { toAdd, skipped, dupCount };
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
    const skipped = []; const zeroSkipped = []; let dupCount = 0; let merged = 0; let keptManual = 0;
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
      const date = this.normDate(r.date);
      if (!date) { skipped.push('(no date)'); return; }
      const bar = this._num(r.bar), food = this._num(r.food), covers = covOf(r.covers);
      const c = carry.get(date) || { bar: false, food: false, covers: false };
      if (numeric(r.bar)) c.bar = true; if (numeric(r.food)) c.food = true; if (numeric(r.covers)) c.covers = true;
      carry.set(date, c);
      const prior = byDate.get(date);
      if (prior) { prior.bar = cents(prior.bar + bar); prior.food = cents(prior.food + food); prior.covers += covers; merged++; }
      else byDate.set(date, { bar, food, covers });
    });
    const toAdd = []; const conflicts = []; const covDropped = [];
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
      if ((c.bar && !barUsable) || (c.food && !foodUsable) || (c.covers && !covUsable)) covDropped.push(date);
      const barFor  = p => barUsable  ? agg.bar    : (p ? pv(p.bar_revenue)   : 0);
      const foodFor = p => foodUsable ? agg.food   : (p ? pv(p.floor_revenue) : 0);
      const covFor  = p => covUsable  ? agg.covers : (p ? (p.covers || 0)     : 0);
      // The grid writes straight through: an edit is the operator's own choice, so there is no
      // conflict to raise. It REUSES any prior record's id for the date (S147) so a re-save upserts
      // in place — a retry after a refused write can never double the day.
      if (manualEntry) {
        if (cents(agg.bar + agg.food) <= 0) { skipped.push(date); return; }
        toAdd.push(mkRec(date, barFor(prior), foodFor(prior), covFor(prior), true, prior && prior.id));
        return;
      }
      if (!prior) {   // a brand-new day: a column the file omits is genuinely 0 (nothing to preserve)
        if (cents(agg.bar + agg.food) <= 0) { zeroSkipped.push(date); return; }   // S189: a $0 day is a deliberate zero, not an unreadable row
        toAdd.push(mkRec(date, barFor(null), foodFor(null), covFor(null), false));
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
        conflicts.push({
          key: date, date,
          mine:   { bar_revenue: pv(prior.bar_revenue), floor_revenue: pv(prior.floor_revenue), covers: prior.covers || 0 },
          theirs: { bar_revenue: barUsable ? pv(agg.bar) : null, floor_revenue: foodUsable ? pv(agg.food) : null, covers: covUsable ? (agg.covers || 0) : null },
          useRec: useRec
        });
        return;
      }
      // Prior is an import / seed: replace it, carrying forward any column the file omits. Not a
      // user-vs-user conflict (replacing your own machine import), so no prompt.
      // (S189 is now checked ABOVE the manual branch so it covers a hand-closed prior too.)
      dupCount++;
      toAdd.push(useRec);
    });
    // `merged`, NOT dupCount — the same reasoning spelled out in buildPmix. dupCount means "rows
    // already logged" everywhere else and the cockpit renders it as "N replaced earlier figures";
    // rows FOLDED INTO a total are the opposite of that.
    return { toAdd, skipped, zeroSkipped, dupCount, merged, keptManual, conflicts, covDropped };
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
    // Which dates have a NAMED-register row? Used to recognise a column-less TOTALS line (S142).
    const namedDates = new Set();
    (rows || []).forEach(r => { if (String(r.drawer || '').trim()) { const d = this.normDate(r.date); if (d) namedDates.add(d); } });
    const toAdd = []; const skipped = []; const conflicts = []; let dupCount = 0; let keptManual = 0; let extraDropped = 0; let totalsLines = 0; const used = new Set();
    (rows || []).forEach(r => {
      const date = this.normDate(r.date);
      if (!date) { skipped.push('(no date)'); return; }
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
      const dName = (r.drawer || '').trim();
      const dRec = dName ? drawerByName[dName.toLowerCase()] : soleDrawer;
      const drawer = dRec ? dRec.name : dName;
      const drawerId = dRec ? dRec.id : '';
      // ⚠ SKIP A WHOLE-DAY TOTALS LINE (S142 + S190). A column-less row on a date that ALSO has
      // per-register rows is the day's TOTALS line; filing it beside the per-register rows
      // double-counts the day (consumers sum by date, not by register) in Drawer Net, the short
      // rate, Loss Prevention and the Books cash sheet. Skip + report it. This fires on BOTH a 2+
      // register bar (the blank stays day-level) AND a single-register bar (S190 — soleDrawer would
      // otherwise resolve the blank onto the one register and double it). A blank row on a date with
      // NO named rows is a legitimate whole-day count and is kept.
      if (!dName && namedDates.has(date)) { totalsLines++; return; }
      const cName = (r.cashier || '').trim();
      const staff = cName ? staffByName[cName.toLowerCase()] : null;
      const cashier = staff ? staff.name : cName;
      // ⚠ KEYED ON drawer_id, NOT the register NAME. The hand form dedupes on `drawer_id`
      // (sc-cash-control saveCountDrawer) and this side used to dedupe on `drawer`, so the two
      // halves of one check compared DIFFERENT FIELDS and a blank never lined up with a named
      // register — the collision went undetected in both directions.
      // Tolerance is the matched register's own (App.drawerTolerance); $10 when unrecognized.
      const tol = (window.App && App.drawerTolerance) ? App.drawerTolerance(dRec || null) : 10;
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
      if (prior) { dupCount++; rec.id = prior.id; }
      toAdd.push(rec);
    });
    // `dupCount` means REPLACED (an earlier import), `keptManual` counts register-days the file
    // matched a hand count on, `conflicts` are register-days the operator must choose on,
    // `extraDropped` counts later file rows dropped because their register-day was already handled,
    // and `totalsLines` counts column-less whole-day rows skipped as a totals line (S142).
    return { toAdd, skipped, dupCount, keptManual, conflicts, extraDropped, totalsLines };
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
  // staff + date + covers + sales so re-dropping the report never double-logs.
  buildServer(rows) {
    const staffByName = this._staffByName();
    const existing = (App.data && App.data.revenue_server_checks) || [];
    const toAdd = []; const skipped = []; const incomplete = []; const undated = []; let dupCount = 0; const used = new Set();
    (rows || []).forEach(r => {
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
      if (!covers || !(sales > 0)) { incomplete.push(r.name || '(blank)'); return; }
      const recDate = this.normDate(r.date);
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
      if (this._isDup(existing, used, x => x.staff_id === staff.id && x.date === recDate
            && (x.covers || 0) === covers && Math.abs((x.sales || 0) - sales) < 0.001)) { dupCount++; return; }
      toAdd.push({
        id: App.uid(), date: recDate, shift: (r.shift || '').trim(), shift_id: '',
        staff_id: staff.id, server_name: staff.name, covers, sales,
        imported: true, saved_at: new Date().toISOString()
      });
    });
    return { toAdd, skipped, incomplete, undated, dupCount };
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
