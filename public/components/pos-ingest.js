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
      // NOT a bare 'time': every timeclock export leads with "Time In" / "Time Out",
      // which would import a clock time as hours worked ("17:00" -> 17.0 hours) and
      // flag the whole roster for overtime. Only whole-phrase time columns match; a
      // file with no single total column stays unmapped so the operator picks it.
      { key: 'hours', label: 'Hours',      required: true,  match: ['hours', 'total hours', 'hrs', 'worked', 'hours worked', 'total hrs', 'reg hours', 'regular hours', 'hrs worked', 'labor hours', 'paid hours', 'net hours', 'duration', 'total time'] },
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

  // Parse a POS number cleanly: strips $ and thousands commas AND handles a
  // NEGATIVE in any common export form — leading "-15", accounting "(15)", or
  // trailing "15-". The old cleaner kept "-" but stripped "()", so a "($50)"
  // drawer shortage read as +50 (a shortage stored as a surplus).
  _num(v) {
    if (v == null) return 0;
    const s = String(v).trim();
    if (!s) return 0;
    const neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /-\s*$/.test(s);
    const n = parseFloat(s.replace(/[^0-9.]/g, ''));
    if (isNaN(n)) return 0;
    return neg ? -n : n;
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
      const p = s.split(':');
      const h = parseInt(p[0], 10), mn = parseInt(p[1], 10);
      if (isNaN(h) || isNaN(mn)) return NaN;
      return h + mn / 60;
    }
    return this._num(s);
  },

  _ymd(y, mo, d) { const p = n => String(n).padStart(2, '0'); return y + '-' + p(mo) + '-' + p(d); },

  // Content-dedup that consumes each existing record AT MOST ONCE, so a file with
  // two legitimately-identical rows (a split shift, two same-value sittings) isn't
  // collapsed to one, while a full re-import of the same file still dedups cleanly.
  _isDup(existing, used, pred) {
    for (const x of existing) {
      if (used.has(x.id) || !pred(x)) continue;
      used.add(x.id); return true;
    }
    return false;
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
  build(type, rows) {
    if (type === 'hours') return this.buildHours(rows);
    if (type === 'tips')  return this.buildTips(rows);
    if (type === 'voids') return this.buildVoids(rows);
    if (type === 'sales') return this.buildSales(rows);
    if (type === 'cash')  return this.buildCash(rows);
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

  buildSales(rows) {
    const existingShifts = ((App.shiftData && App.shiftData.sc_shifts) || []);
    // A hand-entered close (imported !== true) is richer + authoritative; never
    // let a bulk sales import overwrite it. Only a prior IMPORTED day is replaced.
    const manualDates   = new Set(existingShifts.filter(s => s && s.imported !== true).map(s => s.date));
    const importedDates = new Set(existingShifts.filter(s => s && s.imported === true).map(s => s.date));
    const toAdd = []; const skipped = []; let dupCount = 0; const seen = new Set();
    (rows || []).forEach(r => {
      const date = this.normDate(r.date);
      if (!date) { skipped.push('(no date)'); return; }
      if (manualDates.has(date)) { skipped.push(date + ' (manual close kept)'); return; }
      const bar = this._num(r.bar), food = this._num(r.food);
      if (bar + food <= 0) { skipped.push(date); return; }
      if (seen.has(date)) return;          // one row per day; ignore a repeat date in the file
      seen.add(date);
      if (importedDates.has(date)) dupCount++;   // this day already has an imported record — it gets replaced
      const covers = parseInt(String(r.covers == null ? '' : r.covers).replace(/[^0-9]/g, ''), 10) || 0;
      toAdd.push({
        id: App.uid(), date, bar_revenue: bar, floor_revenue: food, covers,
        total_revenue: bar + food, shift_type: 'Full Day', status: 'Closed',
        imported: true, created_at: new Date().toISOString()
      });
    });
    return { toAdd, skipped, dupCount };
  },

  // A row is one drawer's (or the day's) over/short. Resolves Register + Cashier
  // against the roster/registers by name so the by-cashier and by-register
  // patterns still build from an import. Dedup on date + register + variance so a
  // re-dropped cash report never double-logs. source:'import' tags it apart from
  // a hand reconcile. Writes sc_variances.
  buildCash(rows) {
    const VL = (window.S && S.ShiftVarianceLog) || null;
    // Match by the register's name OR any saved POS alias (a report calls a
    // register "Main Bar" that the operator named "Bar 1" — the alias links them).
    const drawerByName = {};
    ((App.shiftData && App.shiftData.sc_drawers) || []).forEach(d => {
      if (!d || d.active === false) return;
      if (d.name) drawerByName[String(d.name).trim().toLowerCase()] = d;
      (d.pos_aliases || []).forEach(a => { if (a) drawerByName[String(a).trim().toLowerCase()] = d; });
    });
    const staffByName = this._staffByName();
    const existing = (App.shiftData && App.shiftData.sc_variances) || [];
    const has = v => v != null && String(v).trim() !== '';
    const toAdd = []; const skipped = []; let dupCount = 0; const used = new Set();
    (rows || []).forEach(r => {
      const date = this.normDate(r.date);
      if (!date) { skipped.push('(no date)'); return; }
      const exp = this._num(r.expected), cnt = this._num(r.counted), os = this._num(r.over_short);
      let expected_cash = null, counted_cash = null, variance;
      if (has(r.expected) && has(r.counted)) { expected_cash = exp; counted_cash = cnt; variance = Math.round((cnt - exp) * 100) / 100; }
      else if (has(r.over_short)) { variance = Math.round(os * 100) / 100; }   // a "($50)" shortage now correctly reads -50, not +50
      else { skipped.push(date); return; }            // no over/short derivable
      const dName = (r.drawer || '').trim();
      const dRec = dName ? drawerByName[dName.toLowerCase()] : null;
      const drawer = dRec ? dRec.name : dName;
      const cName = (r.cashier || '').trim();
      const staff = cName ? staffByName[cName.toLowerCase()] : null;
      const cashier = staff ? staff.name : cName;
      if (this._isDup(existing, used, x => x.date === date && (x.drawer || '') === drawer
            && Math.abs((x.variance || 0) - variance) < 0.001)) { dupCount++; return; }
      // Tolerance is the matched register's own (App.drawerTolerance); $10 when
      // the register is unrecognized or unmapped.
      const tol = (window.App && App.drawerTolerance) ? App.drawerTolerance(dRec || null) : 10;
      const status = (expected_cash != null && VL) ? VL.statusOf(variance, expected_cash, counted_cash, dRec ? dRec.id : null)
                   : (Math.abs(variance) <= tol ? 'Within Tolerance' : variance < 0 ? 'Short' : 'Over');
      toAdd.push({
        id: App.uid(), date, shift_type: '',
        drawer_id: dRec ? dRec.id : '', drawer,
        cashier_id: staff ? staff.id : '', cashier,
        source: 'import', expected_cash, counted_cash, variance,
        tolerance: tol, status, reason: '', notes: '',
        imported: true, created_at: new Date().toISOString()
      });
    });
    return { toAdd, skipped, dupCount };
  },

  // A POS per-server sales report: one row per server (per day) with covers +
  // sales. Matches the server to the roster by name; writes revenue_server_check
  // records so Server Check reads it the same as a hand-entered check. Dedup on
  // staff + date + covers + sales so re-dropping the report never double-logs.
  buildServer(rows) {
    const staffByName = this._staffByName();
    const existing = (App.data && App.data.revenue_server_checks) || [];
    const toAdd = []; const skipped = []; let dupCount = 0; const used = new Set();
    (rows || []).forEach(r => {
      const staff = staffByName[(r.name || '').trim().toLowerCase()];
      const covers = parseInt(String(r.covers == null ? '' : r.covers).replace(/[^0-9]/g, ''), 10) || 0;
      const sales = this._num(r.sales);
      if (!staff || !covers || !(sales > 0)) { skipped.push(r.name || '(blank)'); return; }
      const recDate = this.normDate(r.date);
      if (this._isDup(existing, used, x => x.staff_id === staff.id && x.date === recDate
            && (x.covers || 0) === covers && Math.abs((x.sales || 0) - sales) < 0.001)) { dupCount++; return; }
      toAdd.push({
        id: App.uid(), date: recDate, shift: (r.shift || '').trim(), shift_id: '',
        staff_id: staff.id, server_name: staff.name, covers, sales,
        imported: true, saved_at: new Date().toISOString()
      });
    });
    return { toAdd, skipped, dupCount };
  },

  // A POS product-mix report: one row per item with units sold. Matches the item
  // to the menu by name; toAdd carries { item_id, covers } updates (not records),
  // applied in _commitPmix. Unmatched item names are skipped and surfaced.
  buildPmix(rows) {
    const items = (App.data && App.data.menu_items) || [];
    const byName = {};
    items.forEach(it => { if (it && it.name) byName[it.name.trim().toLowerCase()] = it; });
    const toAdd = []; const skipped = []; let dupCount = 0;
    (rows || []).forEach(r => {
      const nm = (r.name || '').trim().toLowerCase();
      const units = parseInt(String(r.units == null ? '' : r.units).replace(/[^0-9]/g, ''), 10);
      if (!nm || isNaN(units)) { skipped.push(r.name || '(blank)'); return; }
      const it = byName[nm];
      if (!it) { skipped.push(r.name); return; }
      toAdd.push({ item_id: it.id, covers: units });
    });
    return { toAdd, skipped, dupCount };
  },

  // ── Persist ──────────────────────────────────────────────────────────────
  async commit(type, toAdd) {
    if (type === 'sales') return this._commitSales(toAdd);
    if (type === 'pmix')  return this._commitPmix(toAdd);
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
    (toAdd || []).forEach(u => {
      const it = byId[u.item_id]; if (!it) return;
      if (it.weekly_covers != null && u.covers !== it.weekly_covers) {
        it.prev_weekly_covers = it.weekly_covers;
        it.weekly_covers_updated_at = new Date().toISOString();
      }
      it.weekly_covers = u.covers;
    });
    return App.saveKey('menu_items');
  },

  // Sales upserts by DATE: a re-import of the same week replaces those days'
  // figures (one record per day), so it never double-counts and supersedes any
  // older record for the day.
  async _commitSales(toAdd) {
    const dates = new Set((toAdd || []).map(r => r.date));
    // Replace only prior IMPORTED days for these dates — never a hand-entered
    // manual close (buildSales already skips those dates). Insert the new records
    // FIRST, then remove the superseded imports, so a failure mid-way never leaves
    // a date with no record at all.
    const stale = (((App.shiftData && App.shiftData.sc_shifts) || []))
      .filter(s => s && dates.has(s.date) && s.imported === true);
    let ok = true;
    try {
      for (const rec of (toAdd || [])) { ok = (await App.putRecord('sc', 'shift', rec)) && ok; }
      for (const e of stale) { ok = (await App.removeRecord('sc', 'shift', e.id)) && ok; }
    } catch (e) { return false; }
    return ok;
  }
};

window.PosIngest = PosIngest;
