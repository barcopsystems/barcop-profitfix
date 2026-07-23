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
      { key: 'covers', label: 'Covers',     required: false, match: ['covers', 'guests', 'guest count', 'customers', 'checks', 'check count', 'transactions', 'tickets', 'headcount', 'heads', 'patrons', 'guest ct', 'orders', 'sales count', 'covers count'] }
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
      { key: 'cashier',    label: 'Cashier',       required: false, match: ['cashier', 'server', 'employee', 'name', 'staff', 'bartender', 'clerk', 'operator', 'user', 'server name', 'employee name'] },
      // Expected = cash sales + starting bank - paid-outs. NOT 'cash sales' / 'net cash':
      // those are a different quantity, and mapping them makes buildVoids prefer a bogus
      // counted-minus-sales subtraction over the POS's own authoritative Over/Short.
      { key: 'expected',   label: 'Expected Cash', required: false, match: ['expected', 'expected cash', 'declared', 'system cash', 'pos cash', 'cash due', 'expected drawer', 'system total', 'expected total', 'sys cash', 'expected amount'] },
      // NOT 'bank': on a drawer report "Bank" is the opening float, not the count.
      { key: 'counted',    label: 'Counted Cash',  required: false, match: ['counted', 'counted cash', 'actual', 'actual cash', 'deposit', 'deposited', 'drawer count', 'actual drawer', 'counted total', 'cash counted', 'ending cash', 'deposit amount', 'cash in drawer', 'actual amount'] },
      { key: 'over_short', label: 'Over / Short',  required: false, match: ['over/short', 'over short', 'variance', 'difference', 'discrepancy', '+/-', 'short/over', 'over', 'short', 'cash variance', 'diff', 'variance amount'] }
    ],
    // A POS per-server sales report: one row per server (per day). Covers + sales
    // give the check average (Server Check). Matches the server to the roster by
    // name; writes revenue_server_check records. Comps/tips already auto-join from
    // the Void/Comp log and Tip Tracking, so they are not needed here.
    server: [
      { key: 'name',   label: 'Server',      required: true,  match: ['server', 'server name', 'employee', 'employee name', 'name', 'staff', 'bartender', 'staff name', 'waiter', 'sales rep', 'attendant'] },
      { key: 'date',   label: 'Date',        required: true,  match: ['date', 'business date', 'shift date', 'service date', 'day', 'business day'] },
      { key: 'covers', label: 'Covers',      required: true,  match: ['covers', 'guests', 'guest count', 'checks', 'customers', 'check count', 'tickets', 'tables', 'transactions', 'guest ct', 'orders', 'headcount'] },
      { key: 'sales',  label: 'Total Sales', required: true,  match: ['sales', 'net sales', 'total sales', 'gross sales', 'revenue', 'amount', 'net', 'total', 'gross', 'sales total', 'server sales', 'rung sales', 'dollars', 'net total'] },
      { key: 'shift',  label: 'Shift',       required: false, match: ['shift', 'shift type', 'daypart', 'meal period', 'shift name'] }
    ],
    // A POS product-mix (PMIX) report: one row per menu item with units sold for
    // the week. Matches the item to the menu by name and UPDATES weekly_covers in
    // place (no new records), so it has a custom commit (_commitPmix).
    pmix: [
      { key: 'name',  label: 'Item Name',  required: true, match: ['item', 'item name', 'menu item', 'menu item name', 'name', 'product', 'description', 'product name', 'menu', 'plu', 'plu name', 'item description', 'sku', 'item no'] },
      // NOT a bare 'each': it grabs an "Each Price" column, and $12.50 strips to 1250
      // units sold, which moves the item's whole Menu Engineering quadrant.
      { key: 'units', label: 'Units Sold', required: true, match: ['units', 'units sold', 'sold', 'qty', 'qty sold', 'quantity', 'covers', 'sales count', 'count', 'number sold', 'quantity sold', 'sold qty', 'orders', 'rung', 'total sold', 'units count'] }
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
  // ⚠ ONE COPY ON PURPOSE. _num and _count both parse signed POS cells and this test had already
  // drifted once — the paren form was fixed for "($15)" and never for "$(15)". A third copy would
  // drift again. _hours delegates to _num, so it is covered by the same door.
  _isNeg(s) {
    const t = String(s == null ? '' : s).replace(/[^0-9.,()\-]/g, '');
    return /^\(.*\)$/.test(t) || /^-/.test(t) || /-$/.test(t);
  },

  // Parse a POS number cleanly: strips $ and thousands commas AND handles a
  // NEGATIVE in any common export form — leading "-15", accounting "(15)", or
  // trailing "15-", with or without a currency symbol in front of the sign.
  _num(v) {
    if (v == null) return 0;
    const s = String(v).trim();
    if (!s) return 0;
    const neg = this._isNeg(s);
    const n = parseFloat(s.replace(/[^0-9.]/g, ''));
    if (isNaN(n)) return 0;
    return neg ? -n : n;
  },

  // Parse a POS COUNT cell (units sold) that may be NEGATIVE — a product return or void reports
  // "-3" / "(3)" / "3-". The old cleaner stripped [^0-9.], so a "-3" return read as +3 and INFLATED
  // the week's units instead of reducing them. Same sign handling as _num, but returns NaN (not 0)
  // for a non-numeric cell, so a junk row is SKIPPED rather than silently counted as zero. Keeps the
  // decimal point so "12.00" is 12, not 1200.
  _count(v) {
    const s = String(v == null ? '' : v).trim();
    if (!s) return NaN;
    const neg = this._isNeg(s);
    const n = parseFloat(s.replace(/[^0-9.]/g, ''));
    if (isNaN(n)) return NaN;
    return Math.round(neg ? -n : n);
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
    const skipped = []; let dupCount = 0; let merged = 0; let keptManual = 0;
    const keptDates = new Set();       // a kept hand day reported once, not once per row
    const cents = n => Math.round(n * 100) / 100;   // summing floats across services must not drift
    // A column "carries" a value only if the cell PARSES to a number. A junk cell ("N/A", "-", a
    // stray footer label) is non-blank but not a value — treating it as a carried 0 would raise a
    // FALSE conflict against a differing prior and, on "use the file", ZERO the column (S140 scan).
    // A real "0" DOES carry (the file says zero) and overwrites.
    const numeric = v => { if (v == null) return false; const s = String(v).trim(); return s !== '' && !isNaN(parseFloat(s.replace(/[^0-9.\-]/g, ''))); };
    const covOf = v => Math.round(parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, ''))) || 0;   // "12.00" is 12, not 1200
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
    const toAdd = []; const conflicts = [];
    const pv = v => Math.round((+v || 0) * 100) / 100;
    const mkRec = (date, bar, food, covers, manual) => ({
      id: App.uid(), date, bar_revenue: bar, floor_revenue: food, covers,
      total_revenue: cents(bar + food), shift_type: 'Full Day', status: 'Closed',
      source: manual ? 'manual' : 'import', imported: !manual, created_at: new Date().toISOString()
    });
    // "Did this day sell anything" is a question about the DAY (a refund line "(50)" REDUCES it),
    // asked once all of its services are in.
    byDate.forEach((agg, date) => {
      const c = carry.get(date) || {};
      // The grid writes straight through: an edit is the operator's own choice, so there is no
      // conflict to raise, and _commitSales retires whatever record held the date.
      if (manualEntry) {
        if (cents(agg.bar + agg.food) <= 0) { skipped.push(date); return; }
        toAdd.push(mkRec(date, agg.bar, agg.food, agg.covers, true));
        return;
      }
      const prior = priorByDate.get(date);
      if (!prior) {   // a brand-new day: a column the file omits is genuinely 0 (nothing to preserve)
        if (cents(agg.bar + agg.food) <= 0) { skipped.push(date); return; }
        toAdd.push(mkRec(date, agg.bar, agg.food, agg.covers, false));
        return;
      }
      // A record already exists for this date. NEVER zero a column the file does not carry (S140):
      // "Use the file" overlays ONLY the columns the file actually has onto the prior figures.
      const mBar  = c.bar    ? agg.bar    : pv(prior.bar_revenue);
      const mFood = c.food   ? agg.food   : pv(prior.floor_revenue);
      const mCov  = c.covers ? agg.covers : (prior.covers || 0);
      const useRec = mkRec(date, mBar, mFood, mCov, false);   // what "Use the file" would write
      if (prior.source === 'manual') {
        // Only a DIFFERING carried column is a conflict — never prompt when the numbers MATCH; the
        // hand close simply stands, reported as kept.
        const diff = (c.bar    && pv(agg.bar)    !== pv(prior.bar_revenue))
                  || (c.food   && pv(agg.food)   !== pv(prior.floor_revenue))
                  || (c.covers && (agg.covers || 0) !== (prior.covers || 0));
        if (!diff) { if (!keptDates.has(date)) { keptDates.add(date); keptManual++; } return; }
        conflicts.push({
          key: date, date,
          mine:   { bar_revenue: pv(prior.bar_revenue), floor_revenue: pv(prior.floor_revenue), covers: prior.covers || 0 },
          theirs: { bar_revenue: c.bar ? pv(agg.bar) : null, floor_revenue: c.food ? pv(agg.food) : null, covers: c.covers ? (agg.covers || 0) : null },
          useRec: useRec
        });
        return;
      }
      // Prior is an import / seed: replace it, carrying forward any column the file omits. Not a
      // user-vs-user conflict (replacing your own machine import), so no prompt.
      if (useRec.total_revenue <= 0) { skipped.push(date); return; }
      dupCount++;
      toAdd.push(useRec);
    });
    // `merged`, NOT dupCount — the same reasoning spelled out in buildPmix. dupCount means "rows
    // already logged" everywhere else and the cockpit renders it as "N replaced earlier figures";
    // rows FOLDED INTO a total are the opposite of that.
    return { toAdd, skipped, dupCount, merged, keptManual, conflicts };
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
    allDrawers.filter(d => d.active === false).concat(activeDrawers).forEach(d => {
      if (d.name) drawerByName[String(d.name).trim().toLowerCase()] = d;
      (d.pos_aliases || []).forEach(a => { if (a) drawerByName[String(a).trim().toLowerCase()] = d; });
    });
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
    const has = v => v != null && String(v).trim() !== '';
    const cents = n => Math.round(n * 100) / 100;
    const toAdd = []; const skipped = []; const conflicts = []; let dupCount = 0; let keptManual = 0; const used = new Set();
    (rows || []).forEach(r => {
      const date = this.normDate(r.date);
      if (!date) { skipped.push('(no date)'); return; }
      const exp = this._num(r.expected), cnt = this._num(r.counted), os = this._num(r.over_short);
      let expected_cash = null, counted_cash = null, variance;
      if (has(r.expected) && has(r.counted)) { expected_cash = exp; counted_cash = cnt; variance = cents(cnt - exp); }
      else if (has(r.over_short)) { variance = cents(os); }   // a "($50)" shortage now correctly reads -50, not +50
      else { skipped.push(date); return; }            // no over/short derivable
      const dName = (r.drawer || '').trim();
      const dRec = dName ? drawerByName[dName.toLowerCase()] : soleDrawer;
      const drawer = dRec ? dRec.name : dName;
      const drawerId = dRec ? dRec.id : '';
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
        if (conflictKeys.has(dayKey) || keptKeys.has(dayKey)) return;
        if (this._sameVariance(manual, rec)) { keptKeys.add(dayKey); keptManual++; return; }
        conflictKeys.add(dayKey);
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
      if (prior) dupCount++;
      toAdd.push(rec);
    });
    // `dupCount` means REPLACED (an earlier import), `keptManual` counts register-days the file
    // matched a hand count on, and `conflicts` are register-days the operator must choose on.
    return { toAdd, skipped, dupCount, keptManual, conflicts };
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
    const toAdd = []; const skipped = []; const incomplete = []; let dupCount = 0; const used = new Set();
    (rows || []).forEach(r => {
      const staff = staffByName[(r.name || '').trim().toLowerCase()];
      const covers = Math.round(parseFloat(String(r.covers == null ? '' : r.covers).replace(/[^0-9.]/g, ''))) || 0;   // keep the decimal point: "12.00" is 12, not 1200; strip only commas/currency
      const sales = this._num(r.sales);
      // Two different problems, two different lists. An unmatched NAME is a roster fix.
      // A server who IS on the roster but rang no covers or no sales is just a row with
      // nothing to log. Lumping them sent the operator to "add them in the Staff Roster"
      // for someone already on it, so they added a duplicate that fixed nothing and
      // corrupted the roster.
      if (!staff) { skipped.push(r.name || '(blank)'); return; }
      if (!covers || !(sales > 0)) { incomplete.push(r.name || '(blank)'); return; }
      const recDate = this.normDate(r.date);
      if (this._isDup(existing, used, x => x.staff_id === staff.id && x.date === recDate
            && (x.covers || 0) === covers && Math.abs((x.sales || 0) - sales) < 0.001)) { dupCount++; return; }
      toAdd.push({
        id: App.uid(), date: recDate, shift: (r.shift || '').trim(), shift_id: '',
        staff_id: staff.id, server_name: staff.name, covers, sales,
        imported: true, saved_at: new Date().toISOString()
      });
    });
    return { toAdd, skipped, incomplete, dupCount };
  },

  // A POS product-mix report: one row per item with units sold. Matches the item
  // to the menu by name; toAdd carries { item_id, covers } updates (not records),
  // applied in _commitPmix. Unmatched item names are skipped and surfaced.
  buildPmix(rows) {
    const items = (App.data && App.data.menu_items) || [];
    const byName = {};
    items.forEach(it => { if (it && it.name) byName[it.name.trim().toLowerCase()] = it; });
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
    const skipped = []; const dupCount = 0; let merged = 0;
    (rows || []).forEach(r => {
      const nm = (r.name || '').trim().toLowerCase();
      const units = this._count(r.units);   // signed: a "-3" return REDUCES the week's units; NaN (junk) is skipped below
      if (!nm || isNaN(units)) { skipped.push(r.name || '(blank)'); return; }
      const it = byName[nm];
      if (!it) { skipped.push(r.name); return; }
      const prior = byItem.get(it.id);
      if (prior) { prior.covers += units; merged++; }
      else byItem.set(it.id, { item_id: it.id, covers: units });
    });
    // Drop an item whose NET units come out NEGATIVE (returns exceeded sales in this file, or a
    // returns-only export dropped by mistake). _commitPmix REPLACES weekly_covers, so writing a
    // negative would overwrite the real prior figure and show "-3 sold/wk" on Menu Engineering,
    // dragging the category classification.
    // ⚠ ZERO IS KEPT, deliberately. An item listed at 0 units (or whose dayparts net to 0) genuinely
    // sold none this week, and that is a TRUE figure that must overwrite. Filtering it out left last
    // week's number on screen as if it were current — and a zero-seller is exactly what the Dog Test
    // exists to surface, so hiding it behind a stale figure is the worse lie. `> 0` was too greedy.
    const toAdd = [...byItem.values()].filter(u => u.covers >= 0);
    // `merged`, NOT dupCount. In every other builder in this file dupCount means rows SKIPPED
    // because they were already logged, and every screen renders it as "N already logged" — the
    // opposite of what happened here, where N rows were FOLDED INTO a total. Reusing the name
    // would have been a message waiting to lie the moment someone wired it up. dupCount stays 0
    // so the shared build() contract documented at the top of this file still holds.
    return { toAdd, skipped, dupCount, merged };
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
