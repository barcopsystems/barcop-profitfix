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
      { key: 'name',  label: 'Staff Name', required: true,  match: ['employee', 'employee name', 'name', 'staff'] },
      { key: 'date',  label: 'Date',       required: true,  match: ['date', 'work date', 'shift date'] },
      { key: 'hours', label: 'Hours',      required: true,  match: ['hours', 'total hours', 'hrs', 'worked'] },
      { key: 'shift', label: 'Shift',      required: false, match: ['shift', 'shift type'] }
    ],
    tips: [
      { key: 'name',      label: 'Staff Name', required: true,  match: ['employee', 'employee name', 'name', 'staff', 'server', 'server name'] },
      { key: 'date',      label: 'Date',       required: true,  match: ['date', 'business date', 'work date', 'shift date'] },
      { key: 'card_tips', label: 'Card Tips',  required: false, match: ['card tips', 'credit tips', 'cc tips', 'card', 'credit card tips', 'charged tips', 'non-cash tips'] },
      { key: 'cash_tips', label: 'Cash Tips',  required: false, match: ['cash tips', 'cash', 'declared cash tips', 'declared tips'] },
      { key: 'shift',     label: 'Shift',      required: false, match: ['shift', 'shift type', 'daypart'] }
    ],
    voids: [
      { key: 'amount', label: 'Amount',       required: true,  match: ['amount', 'total', 'value', 'comp amount', 'void amount', '$'] },
      { key: 'type',   label: 'Void or Comp', required: false, match: ['type', 'void/comp', 'transaction', 'kind'] },
      { key: 'item',   label: 'Item',         required: false, match: ['item', 'item name', 'product', 'menu item', 'description'] },
      { key: 'server', label: 'Server',       required: false, match: ['server', 'employee', 'name', 'staff', 'bartender', 'cashier'] },
      { key: 'reason', label: 'Reason',       required: false, match: ['reason', 'comp reason', 'void reason', 'note'] },
      { key: 'date',   label: 'Date',         required: false, match: ['date', 'business date', 'shift date'] }
    ],
    // A POS "sales by day" report: one row per day. Bar/food (revenue centers)
    // optional but at least one is needed; covers optional. Writes one per-day
    // record into sc_shifts (revenue/covers, no live-shift cruft).
    sales: [
      { key: 'date',   label: 'Date',       required: true,  match: ['date', 'business date', 'day', 'service date'] },
      { key: 'bar',    label: 'Bar Sales',  required: false, match: ['bar sales', 'bar revenue', 'bar', 'beverage', 'liquor sales', 'beverage sales'] },
      { key: 'food',   label: 'Food Sales', required: false, match: ['food sales', 'food revenue', 'food', 'kitchen', 'floor', 'floor sales', 'kitchen sales'] },
      { key: 'covers', label: 'Covers',     required: false, match: ['covers', 'guests', 'guest count', 'customers', 'count'] }
    ],
    // A POS cash / drawer report: per-day, optionally per-register. The POS blind
    // close already computed over/short, so the cash-variance pattern recovery
    // reads comes from this import, not a hand reconcile. Takes Over/Short
    // directly, OR Expected + Counted. Writes sc_variances.
    cash: [
      { key: 'date',       label: 'Date',          required: true,  match: ['date', 'business date', 'day', 'service date', 'shift date'] },
      { key: 'drawer',     label: 'Register',      required: false, match: ['drawer', 'register', 'till', 'station', 'terminal'] },
      { key: 'cashier',    label: 'Cashier',       required: false, match: ['cashier', 'server', 'employee', 'name', 'staff', 'bartender'] },
      { key: 'expected',   label: 'Expected Cash', required: false, match: ['expected', 'expected cash', 'declared', 'system cash', 'pos cash', 'cash due'] },
      { key: 'counted',    label: 'Counted Cash',  required: false, match: ['counted', 'counted cash', 'actual', 'actual cash', 'deposit', 'deposited', 'drawer count'] },
      { key: 'over_short', label: 'Over / Short',  required: false, match: ['over/short', 'over short', 'variance', 'difference', 'discrepancy', '+/-'] }
    ],
    // A POS per-server sales report: one row per server (per day). Covers + sales
    // give the check average (Server Check). Matches the server to the roster by
    // name; writes revenue_server_check records. Comps/tips already auto-join from
    // the Void/Comp log and Tip Tracking, so they are not needed here.
    server: [
      { key: 'name',   label: 'Server',      required: true,  match: ['server', 'server name', 'employee', 'employee name', 'name', 'staff', 'bartender'] },
      { key: 'date',   label: 'Date',        required: true,  match: ['date', 'business date', 'shift date', 'service date'] },
      { key: 'covers', label: 'Covers',      required: true,  match: ['covers', 'guests', 'guest count', 'checks', 'customers', 'count'] },
      { key: 'sales',  label: 'Total Sales', required: true,  match: ['sales', 'net sales', 'total sales', 'gross sales', 'revenue', 'amount'] },
      { key: 'shift',  label: 'Shift',       required: false, match: ['shift', 'shift type', 'daypart'] }
    ],
    // A POS product-mix (PMIX) report: one row per menu item with units sold for
    // the week. Matches the item to the menu by name and UPDATES weekly_covers in
    // place (no new records), so it has a custom commit (_commitPmix).
    pmix: [
      { key: 'name',  label: 'Item Name',  required: true, match: ['item', 'item name', 'menu item', 'menu item name', 'name', 'product', 'description'] },
      { key: 'units', label: 'Units Sold', required: true, match: ['units', 'units sold', 'sold', 'qty', 'qty sold', 'quantity', 'covers', 'count', 'sales count'] }
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

  normDate(raw) {
    if (!raw) return '';
    const d = new Date(String(raw).length <= 10 ? raw + 'T00:00:00' : raw);
    return isNaN(d.getTime()) ? String(raw) : App.ymdLocal(d);
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
    const toAdd = []; const skipped = []; let dupCount = 0;
    (rows || []).forEach(r => {
      const staff = staffByName[(r.name || '').trim().toLowerCase()];
      const hours = parseFloat(r.hours);
      if (!staff || isNaN(hours) || hours <= 0) { skipped.push(r.name || '(blank)'); return; }
      const recDate = this.normDate(r.date);
      // Skip an exact re-import (same staff + date + hours) so re-dropping a
      // timeclock file never double-counts hours into gross pay.
      if (existing.some(x => x.staff_id === staff.id && x.date === recDate && Math.abs((x.hours || 0) - hours) < 0.001)) {
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
    const toAdd = []; const skipped = []; let dupCount = 0;
    (rows || []).forEach(r => {
      const staff = staffByName[(r.name || '').trim().toLowerCase()];
      const cash = parseFloat(r.cash_tips) || 0;
      const card = parseFloat(r.card_tips) || 0;
      if (!staff || (cash + card) <= 0) { skipped.push(r.name || '(blank)'); return; }
      const recDate = this.normDate(r.date);
      // Skip an exact re-import (same staff + date + the same cash and card tips)
      // so re-dropping a tips export never double-counts tip income.
      if (existing.some(x => x.staff_id === staff.id && x.date === recDate
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
    const toAdd = []; const skipped = []; let dupCount = 0;
    (rows || []).forEach(r => {
      const amount = parseFloat(String(r.amount == null ? '' : r.amount).replace(/[^0-9.\-]/g, ''));
      if (isNaN(amount) || amount < 0) { skipped.push('(no amount)'); return; }
      const t = (r.type || '').trim().toLowerCase();
      const type = (t.indexOf('comp') >= 0 || t === 'c') ? 'Comp' : 'Void';
      const serverName = (r.server || '').trim();
      const staff = serverName ? byName[serverName.toLowerCase()] : null;
      const server = staff ? staff.name : serverName;
      const item = (r.item || '').trim();
      const recDate = this.normDate(r.date) || today;
      // Skip an exact re-import (same date + amount + server + item) so re-dropping
      // a voids/comps export never double-counts loss.
      if (existing.some(x => x.date === recDate && Math.abs((x.amount || 0) - amount) < 0.001
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
    const existingDates = new Set((((App.shiftData && App.shiftData.sc_shifts) || [])).map(s => s.date));
    const num = v => parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0;
    const toAdd = []; const skipped = []; let dupCount = 0; const seen = new Set();
    (rows || []).forEach(r => {
      const date = this.normDate(r.date);
      if (!date) { skipped.push('(no date)'); return; }
      const bar = num(r.bar), food = num(r.food);
      if (bar + food <= 0) { skipped.push(date); return; }
      if (seen.has(date)) return;          // one row per day; ignore a repeat date in the file
      seen.add(date);
      if (existingDates.has(date)) dupCount++;   // this day already has a record — it gets replaced
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
    const num = v => parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    const toAdd = []; const skipped = []; let dupCount = 0;
    (rows || []).forEach(r => {
      const date = this.normDate(r.date);
      if (!date) { skipped.push('(no date)'); return; }
      const exp = num(r.expected), cnt = num(r.counted), os = num(r.over_short);
      let expected_cash = null, counted_cash = null, variance;
      if (!isNaN(exp) && !isNaN(cnt)) { expected_cash = exp; counted_cash = cnt; variance = Math.round((cnt - exp) * 100) / 100; }
      else if (!isNaN(os)) { variance = Math.round(os * 100) / 100; }
      else { skipped.push(date); return; }            // no over/short derivable
      const dName = (r.drawer || '').trim();
      const dRec = dName ? drawerByName[dName.toLowerCase()] : null;
      const drawer = dRec ? dRec.name : dName;
      const cName = (r.cashier || '').trim();
      const staff = cName ? staffByName[cName.toLowerCase()] : null;
      const cashier = staff ? staff.name : cName;
      if (existing.some(x => x.date === date && (x.drawer || '') === drawer
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
    const num = v => parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    const toAdd = []; const skipped = []; let dupCount = 0;
    (rows || []).forEach(r => {
      const staff = staffByName[(r.name || '').trim().toLowerCase()];
      const covers = parseInt(String(r.covers == null ? '' : r.covers).replace(/[^0-9]/g, ''), 10) || 0;
      const sales = num(r.sales);
      if (!staff || !covers || isNaN(sales) || sales <= 0) { skipped.push(r.name || '(blank)'); return; }
      const recDate = this.normDate(r.date);
      if (existing.some(x => x.staff_id === staff.id && x.date === recDate
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
    for (const rec of (toAdd || [])) { ok = (await App.putRecord(t.module, t.kind, rec)) && ok; }
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
    const existing = (((App.shiftData && App.shiftData.sc_shifts) || [])).filter(s => dates.has(s.date));
    let ok = true;
    for (const e of existing) { ok = (await App.removeRecord('sc', 'shift', e.id)) && ok; }
    for (const rec of (toAdd || [])) { ok = (await App.putRecord('sc', 'shift', rec)) && ok; }
    return ok;
  }
};

window.PosIngest = PosIngest;
