'use strict';

/* ── PosIngest — one place that turns POS/timeclock export rows into records ───
   The three recurring POS imports (Hours, Tips, Voids/Comps) used to each carry
   their own parse -> match -> dedup -> save logic baked into the screen. That
   logic now lives here, ONCE, with no DOM. Both the per-page import lanes
   (Log Hours, Tip Log, Void/Comp) and the unified Import screen call these, so
   the two can never drift.

   Each type:
     FIELDS[type]  - the column-mapping field config (shared with CSVMapper)
     TYPES[type]   - { label, module, kind } for App.putRecord
   build(type, rows) -> { toAdd, skipped, dupCount }   (pure; rows already mapped
                          to {key:value} by CSVMapper or PosIngest.mapRows)
   commit(type, toAdd) -> bool                          (persists via putRecord)
   ingest(type, rows)  -> { imported, skipped, dupCount } (build + commit)        */

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
    ]
  },

  TYPES: {
    hours: { label: 'Hours',          module: 'lc', kind: 'actual'     },
    tips:  { label: 'Tips',           module: 'lc', kind: 'tip'        },
    voids: { label: 'Voids & Comps',  module: 'sc', kind: 'void_comp'  }
  },

  // A single dropped file can carry more than one kind. 'hours_tips' is the
  // common payroll export with both hours and tip columns; it feeds both stores.
  SUBTYPES: {
    hours:      ['hours'],
    tips:       ['tips'],
    voids:      ['voids'],
    hours_tips: ['hours', 'tips']
  },

  // UI label for a (possibly combined) detected type.
  typeLabel(type) {
    if (type === 'hours_tips') return 'Hours + Tips';
    return (this.TYPES[type] && this.TYPES[type].label) || '';
  },

  // The column-mapping fields for a UI type. For the combined hours+tips file the
  // two field sets are merged (shared keys like name/date/shift kept once).
  fieldsFor(type) {
    const subs = this.SUBTYPES[type] || [];
    const out = []; const seen = {};
    subs.forEach(t => (this.FIELDS[t] || []).forEach(f => {
      if (!seen[f.key]) { seen[f.key] = 1; out.push(f); }
    }));
    return out;
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

  // Map raw rows (array-of-arrays from a parsed file) to {key:value} objects
  // using a {fieldKey: headerName} mapping. CSVMapper.onComplete already returns
  // rows in this shape; the unified Import screen uses this to do its own mapping.
  mapRows(headers, rows, map) {
    const idx = {};
    Object.keys(map || {}).forEach(k => { idx[k] = headers.indexOf(map[k]); });
    return (rows || []).map(row => {
      const o = {};
      Object.keys(idx).forEach(k => { o[k] = idx[k] >= 0 ? (row[idx[k]] || '') : ''; });
      return o;
    });
  },

  // Auto-match a file's headers to a type's fields (delegates to CSVMapper so the
  // matching rules stay in one place). Returns {fieldKey: headerName}.
  autoMap(headers, type) {
    if (typeof CSVMapper === 'undefined') return {};
    return CSVMapper._autoMap(headers, this.fieldsFor(type));
  },

  // Decide what a file is from its headers alone. Returns one of
  // 'hours' | 'tips' | 'voids' | 'hours_tips' | '' (unknown -> operator picks).
  detect(headers) {
    const hs = (headers || []).map(h => String(h).toLowerCase().trim());
    const has = kws => hs.some(h => kws.some(k => h.indexOf(k) >= 0));
    const nameCol   = has(['name', 'employee', 'staff', 'server']);
    const hoursCol  = has(['hours', 'hrs', 'worked']);
    const tipCol    = has(['tip', 'gratuity']);
    const amountCol = has(['amount', 'total', 'value']);
    const voidSig   = has(['void', 'comp']);
    const hoursOK = nameCol && hoursCol;
    const tipsOK  = nameCol && tipCol;
    const voidsOK = voidSig && amountCol;
    if (hoursOK && tipsOK) return 'hours_tips';
    if (voidsOK) return 'voids';
    if (hoursOK) return 'hours';
    if (tipsOK) return 'tips';
    return '';
  },

  // ── Pure builders (no save) ────────────────────────────────────────────────
  build(type, rows) {
    if (type === 'hours') return this.buildHours(rows);
    if (type === 'tips')  return this.buildTips(rows);
    if (type === 'voids') return this.buildVoids(rows);
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
        reason: (r.reason || '').trim(), notes: '', auth_threshold_override: false,
        created_at: new Date().toISOString()
      });
    });
    return { toAdd, skipped, dupCount };
  },

  // ── Persist ──────────────────────────────────────────────────────────────
  async commit(type, toAdd) {
    const t = this.TYPES[type];
    if (!t) return false;
    let ok = true;
    for (const rec of (toAdd || [])) { ok = (await App.putRecord(t.module, t.kind, rec)) && ok; }
    return ok;
  },

  // build + commit convenience for the per-page import lanes.
  async ingest(type, rows) {
    const { toAdd, skipped, dupCount } = this.build(type, rows);
    const ok = toAdd.length ? await this.commit(type, toAdd) : true;
    return { ok, imported: ok ? toAdd.length : 0, skipped, dupCount };
  }
};

window.PosIngest = PosIngest;
