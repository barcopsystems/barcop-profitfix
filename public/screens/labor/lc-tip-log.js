'use strict';

/* ── Labor Control — Tip Log (writes lc_tips) ─────────────────────────────────
   Records tips by SHIFT and staff member — cash and card, totalled.
   shift_id is the anchor. Picking a shift pre-fills date, shift_type, and the
   active manager. Staff dropdown filters to that shift's logged staff (with full
   roster fallback). Hours pull from lc_actuals when staff + shift are both set.

   Landing = one Log Tips card with an Enter Manually / Import File toggle, then
   the stats, filter, and tip list. Editing a row opens it in a focused pop-up. */

S.LaborTipLog = {
  editId: null,
  entryMode: 'manual',     // 'manual' = type a row, 'import' = drop a POS tips file
  filterFrom: '',
  filterTo: '',
  filterShift: '',
  filterStaff: '',

  tips() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_tips)) App.laborData.lc_tips = [];
    return App.laborData.lc_tips;
  },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
  shifts() { return ((App.shiftData && App.shiftData.sc_shifts) || []); },
  shiftById(id) { return this.shifts().find(s => s.id === id); },
  actuals() { return ((App.laborData && App.laborData.lc_actuals) || []); },

  // Shift dropdown options. Open shifts first, then closed shifts from the last
  // 14 days, then a Manual escape hatch for off-cycle entries.
  shiftOptions(selectedId) {
    const all = this.shifts().slice().sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
    const open = all.filter(s => s.status === 'Open');
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
    const closed = all.filter(s => s.status !== 'Open' && new Date(s.date || s.created_at) >= cutoff);

    const label = s => {
      const d = s.date ? new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const parts = [d, s.shift_type || ''].filter(Boolean).join(' · ');
      return parts || 'Shift';
    };

    let h = '<option value="">Select a shift...</option>';
    if (open.length) {
      h += '<optgroup label="Open Shifts">';
      open.forEach(s => { h += '<option value="' + s.id + '"' + (s.id === selectedId ? ' selected' : '') + '>' + esc(label(s)) + '</option>'; });
      h += '</optgroup>';
    }
    if (closed.length) {
      h += '<optgroup label="Recent Closed Shifts">';
      closed.forEach(s => { h += '<option value="' + s.id + '"' + (s.id === selectedId ? ' selected' : '') + '>' + esc(label(s)) + '</option>'; });
      h += '</optgroup>';
    }
    h += '<optgroup label="Other"><option value="__manual"' + (selectedId === '__manual' ? ' selected' : '') + '>Manual entry (no specific shift)</option></optgroup>';
    return h;
  },

  // Active shift for the current session — defaults the form to it
  activeShift() {
    return this.shifts().filter(s => s.status === 'Open')
      .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())[0] || null;
  },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  normDate(raw) {
    if (!raw) return '';
    const d = new Date(String(raw).length <= 10 ? raw + 'T00:00:00' : raw);
    return isNaN(d.getTime()) ? String(raw) : App.ymdLocal(d);
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How the Tip Log Works', [
      { p: ['The Tip Log records cash and card tips by shift and staff member. Pick the shift first and Bar Cop fills in the date, shift type, and the staff who worked it, so you mostly just type the tip amounts.'] },
      { h: 'Logging Tips', p: ['Choose Enter Manually, pick the shift, then the staff member (the dropdown lists who worked that shift first), then enter cash and card tips. Tippable hours pull from logged hours automatically, and you can override them. Pick Manual entry instead of a shift for an off-cycle entry where you set the date and shift type yourself.'] },
      { h: 'Importing From A POS Export', p: ['Switch to Import File and drop a tips export, CSV or Excel. Map the columns once and Bar Cop remembers it. Staff Name and Date are required; Card Tips and Cash Tips are each optional but a row needs at least one. Headers do not need to match exactly: Staff Name reads employee / server / name / staff, Card Tips reads card / credit / cc tips, Cash Tips reads cash / declared tips. Rows match your roster by name; a row with no match or no tip amount is skipped and reported. Imported tips come in as date entries not linked to a shift, which you can adjust by opening any entry.'] },
      { h: 'Where Tips Go', p: ['Tips feed the Tip Pool calculator and the tip-credit check on Pay Periods, which compares a tipped employee\'s wage plus tips against your state minimum. Logging accurately here keeps those honest.'] },
      { h: 'Worksheet', p: ['The Worksheet button prints a clean grid to tally tips per server on the floor during the shift, then enter the rows here after close.'] }
    ]);
  },

  // The shift to default the dropdown to: an existing record's shift, an existing
  // manual entry, the active shift, or none.
  initialShiftIdFor(x) {
    if (x) {
      if (x.shift_id) return x.shift_id;
      if (x.date) return '__manual';
      return '';
    }
    const a = this.activeShift();
    return a ? a.id : '';
  },

  // Shared form fields used by the inline add form and the edit pop-up. p =
  // element-id prefix ('tl-' inline, 'tle-' edit pop-up) so the modal's inputs
  // never collide with the inline form sitting behind it. All entry cells on one
  // row; the manual date/shift-type row and the shift summary are conditional,
  // and Notes sits on its own row. Pass the record for edit, or null for new.
  formBody(x, p) {
    p = p || 'tl-';
    const v = val => (val != null && val !== '') ? val : '';
    const initialShiftId = this.initialShiftIdFor(x);
    const isManual = initialShiftId === '__manual';
    const initialShift = initialShiftId && initialShiftId !== '__manual' ? this.shiftById(initialShiftId) : null;
    const defaultDate = x?.date || initialShift?.date || App.todayLocal();
    const defaultShiftType = x?.shift_type || initialShift?.shift_type || '';

    return '<div class="form-row data-row" style="gap:12px;">'
        + '<div class="f" style="flex:1.5 1 180px;min-width:0;"><label>Shift</label>'
          + '<select id="' + p + 'shift">' + this.shiftOptions(initialShiftId) + '</select></div>'
        + '<div class="f" style="flex:1.2 1 150px;min-width:0;"><label>Staff</label>'
          + '<select id="' + p + 'staff"></select></div>'
        + '<div class="f" style="flex:0.9 1 110px;min-width:0;"><label>Tippable Hours</label>'
          + '<input type="number" id="' + p + 'hours" min="0" step="0.25" value="' + v(x?.hours) + '" placeholder="Auto"/></div>'
        + '<div class="f" style="flex:0.9 1 110px;min-width:0;"><label>Cash Tips</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + p + 'cash" min="0" step="0.01" value="' + v(x?.cash_tips) + '"/></div></div>'
        + '<div class="f" style="flex:0.9 1 110px;min-width:0;"><label>Card Tips</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + p + 'card" min="0" step="0.01" value="' + v(x?.card_tips) + '"/></div></div>'
        + '<div class="f" style="flex:0.8 1 100px;min-width:0;"><label>Total</label>'
          + '<div class="f-display" id="' + p + 'c-total">-</div></div>'
      + '</div>'

      // Manual mode reveals date + shift type (a shift pick derives them instead).
      + '<div id="' + p + 'manual-row" class="form-row" style="gap:16px;' + (isManual ? '' : 'display:none;') + '">'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Date</label>'
          + '<input type="date" id="' + p + 'date" value="' + esc(defaultDate) + '"/></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Shift Type</label>'
          + '<select id="' + p + 'shift-type">' + (App.SHIFT_TYPES || []).map(t =>
              '<option value="' + esc(t) + '"' + (defaultShiftType === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></div>'
      + '</div>'

      + '<div id="' + p + 'shift-summary" style="margin-bottom:14px;"></div>'

      + '<div class="form-row" style="gap:16px;margin-bottom:0;"><div class="f" style="width:100%;"><label>Notes</label>'
        + '<textarea id="' + p + 'notes" class="notes-ta" rows="2" placeholder="Optional">' + esc(x?.notes || '') + '</textarea></div></div>';
  },

  // Wire the form field interactions (inline add OR edit pop-up). Save/Cancel are
  // wired by the caller. p = element-id prefix. x = the record (null for new).
  wireForm(x, p) {
    p = p || 'tl-';
    const initialShiftId = this.initialShiftIdFor(x);
    document.getElementById(p + 'shift')?.addEventListener('change', e => this.onShiftChange(e.target.value, x, p));
    document.getElementById(p + 'staff')?.addEventListener('change', () => this.onStaffChange(x, p));
    document.getElementById(p + 'cash')?.addEventListener('input', () => this.calc(p));
    document.getElementById(p + 'card')?.addEventListener('input', () => this.calc(p));
    this.populateStaffList(initialShiftId, x, p);
    this.renderShiftSummary(initialShiftId, p);
    this.calc(p);
  },

  renderList() {
    this.editId = null;
    this.actions.innerHTML = '';

    if (this.staff().length === 0) {
      App.setupCard(this.container, {
        title: 'Log Your First Tips',
        lead: 'Tips are logged against your roster, by shift and staff member. Add your staff and you can start logging.',
        steps: [
          { title: 'Add your staff', desc: 'Tips are logged against a staff member, so build your roster first.', btn: 'Go to Staff Roster', screen: 'lc-staff-roster', done: false }
        ]
      });
      return;
    }

    // One card, two ways in: type a row by hand, or drop a POS tips export. A
    // segmented toggle swaps the body. Same pattern as Log Hours.
    const segBtn = (mode, label) => {
      const on = this.entryMode === mode;
      return '<button type="button" class="btn btn-sm tl-mode" data-mode="' + mode + '" style="'
        + (on ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    };
    const modeBody = this.entryMode === 'import'
      ? '<div id="tl-imp-csv"></div><div id="tl-imp-result"></div>'
      : this.formBody(null)
        + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="tl-save">Save Tips</button>'
        + '<span id="tl-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
        + '</div>';
    const addCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('lc-tip-log', 'Log Tips', App.helpButton('tl-how'))
      + '<div class="collapse-body">'
      + '<div style="display:inline-flex;gap:6px;margin-bottom:18px;">' + segBtn('manual', 'Enter Manually') + segBtn('import', 'Import File') + '</div>'
      + modeBody
      + '</div></div>';

    const all = [...this.tips()].sort((a, b) =>
      new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());
    const filtered = this.applyFilters(all);

    let below;
    if (all.length === 0) {
      below = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No tips logged yet. Log your first entry above, or import a POS tips export. Pick the shift and the rest auto-fills.</div>';
    } else {
      const cash = filtered.reduce((t, x) => t + (x.cash_tips || 0), 0);
      const card = filtered.reduce((t, x) => t + (x.card_tips || 0), 0);
      const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val lg">' + filtered.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Cash Tips</div><div class="calc-val lg">' + App.fmtCurrency(cash) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Card Tips</div><div class="calc-val lg">' + App.fmtCurrency(card) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Tips</div><div class="calc-val lg">' + App.fmtCurrency(cash + card) + '</div></div>'
        + '</div></div>';

      let listHtml;
      if (filtered.length === 0) {
        listHtml = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No tips match the filters.</div>';
      } else {
        const rows = filtered.slice(0, App.listLimit('lc', 'tip')).map(x =>
          '<tr class="tl-row" data-id="' + x.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(x.date) + '</div></td>'
          + '<td>' + esc(x.name || '-') + '</td>'
          + '<td>' + esc(x.shift_type || '-') + '</td>'
          + '<td>' + App.fmtCurrency(x.cash_tips || 0) + '</td>'
          + '<td>' + App.fmtCurrency(x.card_tips || 0) + '</td>'
          + '<td class="val">' + App.fmtCurrency(x.total_tips || 0) + '</td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('lc-tip-log') ? '<button class="btn btn-ghost btn-sm tl-edit" data-id="' + x.id + '">Edit</button>' : '')
          + (App.canEdit('lc-tip-log') ? '<button class="btn btn-danger btn-sm tl-del" data-id="' + x.id + '">Delete</button>' : '')
          + '</div></td></tr>').join('');
        listHtml = '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
          + '<th>Date</th><th>Staff</th><th>Shift</th><th>Cash</th><th>Card</th><th>Total</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>'
          + App.showOlderBar('lc', 'tip', filtered, !!(this.filterFrom || this.filterTo || this.filterShift || this.filterStaff));
      }

      const filterHeading = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
        + '<div class="sh" style="margin:0;">Filter Tips</div>'
        + '<div style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" id="tl-export">Export PDF</button>'
        + '<button class="btn btn-ghost btn-sm" id="tl-print-blank">Worksheet</button></div></div>';

      below = statsCard + filterHeading + this.filterCard() + listHtml;
    }

    this.container.innerHTML = '<div class="screen">' + addCard + below + '</div>';
    App.applyCollapsed(this.container);
    this.container.onclick = ev => {
      if (ev.target.closest('#tl-how')) { this.showHowTo(); return; }
      if (ev.target.closest('.tl-imp-how')) { this.showHowTo(); return; }
      const modeBtn = ev.target.closest('.tl-mode');
      if (modeBtn) { this.entryMode = modeBtn.dataset.mode; this.renderList(); return; }
      const head = ev.target.closest('.card-collapse-head');
      if (head && !ev.target.closest('.btn')) { App.toggleCollapse(head); return; }
      if (ev.target.closest('#tl-export')) { App.exportPDF({ title: 'Tip Log', root: this.container }); return; }
      if (ev.target.closest('#tl-print-blank')) { this.printBlank(); return; }
      if (ev.target.closest('#tl-save')) { this.save('tl-'); return; }
      if (ev.target.closest('#tl-f-clear')) { this.filterFrom = this.filterTo = this.filterShift = this.filterStaff = ''; this.renderList(); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row = ev.target.closest('.tl-row');
      const edit = ev.target.closest('.tl-edit');
      const del = ev.target.closest('.tl-del');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (edit)      { ev.stopPropagation(); this.openEditModal(edit.dataset.id); return; }
      if (row && App.canEdit('lc-tip-log')) this.openEditModal(row.dataset.id);
    };

    if (this.entryMode === 'import') {
      this.mountTipImporter();
    } else {
      this.wireForm(null, 'tl-');
    }
    document.getElementById('tl-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('tl-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });
    document.getElementById('tl-f-shift')?.addEventListener('change', e => { this.filterShift = e.target.value || ''; this.renderList(); });
    document.getElementById('tl-f-staff')?.addEventListener('change', e => { this.filterStaff = e.target.value || ''; this.renderList(); });
  },

  mountTipImporter() {
    const el = document.getElementById('tl-imp-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      hint: 'Drop a POS tips export: <span class="tl-imp-how" style="color:var(--gold);cursor:pointer;text-decoration:underline;">How it works</span>',
      fields: [
        { key: 'name',      label: 'Staff Name', required: true,  match: ['employee', 'employee name', 'name', 'staff', 'server', 'server name'] },
        { key: 'date',      label: 'Date',       required: true,  match: ['date', 'business date', 'work date', 'shift date'] },
        { key: 'card_tips', label: 'Card Tips',  required: false, match: ['card tips', 'credit tips', 'cc tips', 'card', 'credit card tips', 'charged tips', 'non-cash tips'] },
        { key: 'cash_tips', label: 'Cash Tips',  required: false, match: ['cash tips', 'cash', 'declared cash tips', 'declared tips'] },
        { key: 'shift',     label: 'Shift',      required: false, match: ['shift', 'shift type', 'daypart'] }
      ],
      confirmLabel: 'Import',
      onComplete: rows => this.importTipRows(rows)
    });
  },

  async importTipRows(rows) {
    const staffByName = {};
    this.staff().forEach(s => { staffByName[(s.name || '').trim().toLowerCase()] = s; });
    const toAdd = [];
    const skipped = [];
    (rows || []).forEach(r => {
      const staff = staffByName[(r.name || '').trim().toLowerCase()];
      const cash = parseFloat(r.cash_tips) || 0;
      const card = parseFloat(r.card_tips) || 0;
      if (!staff || (cash + card) <= 0) { skipped.push(r.name || '(blank)'); return; }
      toAdd.push({
        id:          App.uid(),
        shift_id:    '',
        manager_id:  '',
        date:        this.normDate(r.date),
        staff_id:    staff.id,
        name:        staff.name,
        position_id: staff.position_id || '',
        shift_type:  (r.shift || '').trim(),
        cash_tips:   cash,
        card_tips:   card,
        total_tips:  cash + card,
        hours:       null,
        notes:       '',
        imported:    true,
        created_at:  new Date().toISOString()
      });
    });

    const result = document.getElementById('tl-imp-result');
    const imported = toAdd.length;
    if (imported === 0) {
      if (result) result.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + 'No rows imported. No staff names matched the roster, or no tip amounts were found.</div>';
      return;
    }
    let ok = true;
    for (const rec of toAdd) { ok = (await App.putRecord('lc', 'tip', rec)) && ok; }
    if (!ok) {
      if (result) result.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">Save failed. Try the import again.</div>';
      return;
    }
    this.renderList();
    const res2 = document.getElementById('tl-imp-result');
    if (res2) res2.innerHTML = '<div style="font-size:13px;color:var(--gold);font-weight:700;margin-top:12px;">'
      + 'Imported ' + imported + ' tip entr' + (imported === 1 ? 'y' : 'ies') + '.'
      + (skipped.length ? ' <span style="color:var(--t3);font-weight:400;">' + skipped.length
          + ' row' + (skipped.length === 1 ? '' : 's') + ' skipped (no roster match or no tip amount).</span>' : '') + '</div>';
  },

  // Controls-only filter card. Export PDF + Worksheet live on the heading row.
  filterCard() {
    // Only staff who actually have tip entries (plus the current selection), so
    // the dropdown stays relevant — non-tipped staff who never got tips never
    // clutter it, and a tip-out to a support role still shows up.
    const withTips = new Set(this.tips().map(t => t.staff_id).filter(Boolean));
    const staffOpts = '<option value="">All staff</option>'
      + this.staff().filter(s => withTips.has(s.id) || s.id === this.filterStaff)
          .slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          .map(s => '<option value="' + s.id + '"' + (this.filterStaff === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
    const shiftOpts = '<option value="">All shifts</option>'
      + (App.SHIFT_TYPES || []).map(s => '<option value="' + esc(s) + '"' + (this.filterShift === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    return '<div class="card no-print">'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;align-items:flex-end;flex-wrap:wrap;">'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="tl-f-from" value="' + esc(this.filterFrom) + '"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="tl-f-to" value="' + esc(this.filterTo) + '"/></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Shift</label><select id="tl-f-shift">' + shiftOpts + '</select></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Staff</label><select id="tl-f-staff">' + staffOpts + '</select></div>'
        + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="tl-f-clear">Clear</button></div>'
      + '</div></div>';
  },

  applyFilters(list) {
    return list.filter(t => {
      const date = t.date || '';
      if (this.filterFrom && date < this.filterFrom) return false;
      if (this.filterTo && date > this.filterTo) return false;
      if (this.filterShift && (t.shift_type || '') !== this.filterShift) return false;
      if (this.filterStaff && (t.staff_id || '') !== this.filterStaff) return false;
      return true;
    });
  },

  // ── Edit in a focused pop-up (same form, own tle- ids) ──────────────────────
  openEditModal(id) {
    if (!App.canEdit('lc-tip-log')) return;
    const x = this.tips().find(t => t.id === id);
    if (!x) return;
    this.editId = id;
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Tips</div>'
      + this.formBody(x, 'tle-')
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="tle-save">Update</button>'
        + '<button class="btn btn-ghost" id="tle-cancel">Cancel</button>'
        + '<span id="tle-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
        + '<button class="btn btn-danger" id="tle-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'tl-edit-modal', maxWidth: 540, noClose: true });
    this.wireForm(x, 'tle-');
    document.getElementById('tle-save')?.addEventListener('click', () => this.save('tle-'));
    document.getElementById('tle-cancel')?.addEventListener('click', () => { this.editId = null; App.closeModal('tl-edit-modal'); });
    document.getElementById('tle-del')?.addEventListener('click', () => { this.editId = null; App.closeModal('tl-edit-modal'); this.confirmDel(id); });
  },

  // When the shift dropdown changes — reveal/hide manual fields, refresh staff
  // list + shift summary, auto-fill hours if staff already picked.
  onShiftChange(shiftId, existingRec, p) {
    p = p || 'tl-';
    const manualRow = document.getElementById(p + 'manual-row');
    if (shiftId === '__manual') {
      if (manualRow) manualRow.style.display = '';
    } else {
      if (manualRow) manualRow.style.display = 'none';
      const s = this.shiftById(shiftId);
      if (s) {
        const dateInp = document.getElementById(p + 'date');
        if (dateInp) dateInp.value = s.date || dateInp.value;
        const stInp = document.getElementById(p + 'shift-type');
        if (stInp && s.shift_type) stInp.value = s.shift_type;
      }
    }
    this.populateStaffList(shiftId, existingRec, p);
    this.renderShiftSummary(shiftId, p);
    this.onStaffChange(existingRec, p);
  },

  // Populate staff dropdown. When a shift is picked, default to that shift's
  // logged staff first (an optgroup), then the rest of the roster.
  populateStaffList(shiftId, existingRec, p) {
    p = p || 'tl-';
    const sel = document.getElementById(p + 'staff');
    if (!sel) return;
    const shift = shiftId && shiftId !== '__manual' ? this.shiftById(shiftId) : null;
    const shiftDate = shift?.date || document.getElementById(p + 'date')?.value || '';
    const shiftStaffIds = new Set();
    if (shift && shiftDate) {
      this.actuals().filter(a => a.date === shiftDate).forEach(a => { if (a.staff_id) shiftStaffIds.add(a.staff_id); });
    }
    const selectedId = existingRec?.staff_id || sel.value || '';
    const all = this.staff().filter(s => s.status !== 'Inactive' || s.id === selectedId);
    const onShift = all.filter(s => shiftStaffIds.has(s.id));
    const offShift = all.filter(s => !shiftStaffIds.has(s.id));
    let h = '<option value="">Select staff...</option>';
    if (onShift.length) {
      h += '<optgroup label="Worked This Shift">';
      onShift.forEach(s => { h += '<option value="' + s.id + '"' + (s.id === selectedId ? ' selected' : '') + '>' + esc(s.name) + '</option>'; });
      h += '</optgroup>';
    }
    if (offShift.length) {
      h += '<optgroup label="' + (onShift.length ? 'Other Staff' : 'Roster') + '">';
      offShift.forEach(s => { h += '<option value="' + s.id + '"' + (s.id === selectedId ? ' selected' : '') + '>' + esc(s.name) + '</option>'; });
      h += '</optgroup>';
    }
    sel.innerHTML = h;
  },

  // When staff dropdown changes — auto-fill hours from lc_actuals for this
  // staff member + shift date. Operator can still override.
  onStaffChange(existingRec, p) {
    p = p || 'tl-';
    const staffId = document.getElementById(p + 'staff')?.value || '';
    const date = document.getElementById(p + 'date')?.value || '';
    const hoursInp = document.getElementById(p + 'hours');
    if (!hoursInp) return;
    if (existingRec && hoursInp.value && parseFloat(hoursInp.value) > 0) return;
    const hrs = App.hoursFor(staffId, date);
    if (hrs != null && hrs > 0) hoursInp.value = hrs;
  },

  renderShiftSummary(shiftId, p) {
    p = p || 'tl-';
    const box = document.getElementById(p + 'shift-summary');
    if (!box) return;
    if (!shiftId || shiftId === '__manual') { box.innerHTML = ''; return; }
    const s = this.shiftById(shiftId);
    if (!s) { box.innerHTML = ''; return; }
    const dateLabel = s.date ? new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : '-';
    const managerName = s.manager_id ? ((this.staffById(s.manager_id) || {}).name || '') : '';
    box.innerHTML = '<div style="font-size:11px;color:var(--t3);padding:10px 14px;background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:4px;line-height:1.6;">'
      + '<div style="font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:1px;font-size:9px;margin-bottom:4px;">Shift</div>'
      + esc(dateLabel) + (s.shift_type ? ' &middot; ' + esc(s.shift_type) : '')
      + (managerName ? ' &middot; ' + esc(managerName) : '')
      + (s.status === 'Open' ? ' <span style="color:var(--gold);font-weight:700;">(open)</span>' : '')
      + '</div>';
  },

  calc(p) {
    p = p || 'tl-';
    const num = id => parseFloat(document.getElementById(p + id)?.value) || 0;
    const total = num('cash') + num('card');
    const el = document.getElementById(p + 'c-total');
    if (el) el.textContent = App.fmtCurrency(total);
  },

  async save(p) {
    p = p || 'tl-';
    const isEdit = p === 'tle-';
    const err = document.getElementById(p + 'err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const shiftPick = document.getElementById(p + 'shift')?.value || '';
    if (!shiftPick) { fail('Pick a shift or choose Manual entry.'); return; }

    let date, shiftType, shiftId = '', managerId = '';
    if (shiftPick === '__manual') {
      date      = document.getElementById(p + 'date')?.value;
      shiftType = document.getElementById(p + 'shift-type')?.value || '';
      if (!date) { fail('Date is required for manual entry.'); return; }
      managerId = App.activeManagerId ? App.activeManagerId() : '';
    } else {
      const s = this.shiftById(shiftPick);
      if (!s) { fail('Shift not found.'); return; }
      shiftId   = s.id;
      date      = s.date || App.todayLocal();
      shiftType = s.shift_type || '';
      managerId = s.manager_id || '';
    }

    const staff = this.staffById(document.getElementById(p + 'staff')?.value);
    if (!staff) { fail('Choose a staff member.'); return; }
    const num = id => { const n = parseFloat(document.getElementById(p + id)?.value); return isNaN(n) ? null : n; };
    const cash = num('cash') || 0, card = num('card') || 0;
    if (cash + card <= 0) { fail('Enter cash or card tips.'); return; }

    const rec = {
      id:          this.editId || App.uid(),
      shift_id:    shiftId,
      manager_id:  managerId,
      date,
      staff_id:    staff.id,
      name:        staff.name,
      position_id: staff.position_id || '',
      shift_type:  shiftType,
      cash_tips:   cash,
      card_tips:   card,
      total_tips:  cash + card,
      hours:       num('hours'),
      notes:       document.getElementById(p + 'notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.tips();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(t => t.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    } else {
      list.push(rec);
    }

    const btn = document.getElementById(p + 'save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('lc', 'tip', saved);
    this.editId = null;
    if (ok) {
      if (isEdit) App.closeModal('tl-edit-modal');
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = isEdit ? 'Update' : 'Save Tips'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    await App.removeRecord('lc', 'tip', id);
    this.renderList();
  },

  // Paper-at-close workflow. Managers tally cash + card tips per server on a
  // printed sheet during the shift, then enter into Bar Cop after close.
  printBlank() {
    App.printBlankSheet({
      title: 'Tip Sheet',
      subtitle: 'Tally tips per server during the shift. Manager enters each row into Bar Cop after close.',
      columns: [
        { label: 'Server Name', width: '28%' },
        { label: 'Cash Tips',   width: '14%' },
        { label: 'Card Tips',   width: '14%' },
        { label: 'Total',       width: '12%' },
        { label: 'Hours',       width: '12%' },
        { label: 'Notes',       width: '20%' }
      ],
      rows: 14
    });
  }
};
