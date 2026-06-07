'use strict';

/* ── Labor Control — Log Hours (writes lc_actuals) ────────────────────────────
   Records actual hours worked, by hand or by importing a timeclock CSV/Excel
   export through the shared csv-mapper component. lc_actuals feeds Revenue and
   Profit Recovery weekly labor, prime cost, and the RPLH Tracker.

   Landing = inline Log Hours form + an Import card + the logged-hours list.
   Editing a row opens it in a focused pop-up. */

S.LaborLogHours = {
  editId: null,
  filterFrom: '',
  filterTo: '',
  filterShift: '',
  filterStaff: '',
  get SHIFTS() { return ['', ...(App.SHIFT_TYPES || [])]; },

  actuals() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_actuals)) App.laborData.lc_actuals = [];
    return App.laborData.lc_actuals;
  },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
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
    if (actions) actions.innerHTML = '';
    this.renderList();
  },

  // The form cells shared by the inline log form and the edit pop-up so they never
  // drift. p = element-id prefix ('lo-' inline add form, 'loe-' edit pop-up) so the
  // modal's inputs never collide with the inline form sitting behind it. All data
  // cells (Date, Staff, Shift, Hours) on one row; Notes on its own row; the live
  // Wage / Labor Cost preview below.
  logFormCells(a, p) {
    p = p || 'lo-';
    const v = val => (val != null && val !== '') ? val : '';
    const shiftOpts = this.SHIFTS.map(s =>
      '<option value="' + s + '"' + (a && a.shift_type === s ? ' selected' : '') + '>' + (s || 'Select shift...') + '</option>').join('');
    return '<div class="form-row data-row" style="gap:12px;">'
      + '<div class="f" style="flex:1 1 150px;min-width:0;"><label>Date</label>'
      + '<input type="date" id="' + p + 'date" value="' + esc(a?.date || App.todayLocal()) + '"/></div>'
      + '<div class="f" style="flex:1 1 200px;min-width:0;"><label>Staff</label>'
      + '<select id="' + p + 'staff">' + App.staffOptions(a ? a.staff_id : '') + '</select></div>'
      + '<div class="f" style="flex:1 1 140px;min-width:0;"><label>Shift</label>'
      + '<select id="' + p + 'shift">' + shiftOpts + '</select></div>'
      + '<div class="f" style="flex:1 1 110px;min-width:0;"><label>Hours</label>'
      + '<input type="number" id="' + p + 'hours" min="0" step="0.25" value="' + v(a?.hours) + '"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="' + p + 'notes" class="notes-ta" rows="2" placeholder="Optional">' + esc(a?.notes || '') + '</textarea></div></div>'
      + '<div class="calc" style="margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Wage</div><div class="calc-val" id="' + p + 'c-wage">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor Cost</div><div class="calc-val" id="' + p + 'c-cost">-</div></div>'
      + '</div>';
  },

  // Attach the live-calc listeners for whichever form is mounted (inline or edit).
  wireForm(p) {
    p = p || 'lo-';
    document.getElementById(p + 'staff')?.addEventListener('change', () => this.calc(p));
    document.getElementById(p + 'date')?.addEventListener('change', () => this.calc(p));
    document.getElementById(p + 'hours')?.addEventListener('input', () => this.calc(p));
    this.calc(p);
  },

  applyFilters(list) {
    return list.filter(a => {
      const date = a.date || '';
      if (this.filterFrom && date < this.filterFrom) return false;
      if (this.filterTo && date > this.filterTo) return false;
      if (this.filterShift && (a.shift_type || '') !== this.filterShift) return false;
      if (this.filterStaff && (a.staff_id || '') !== this.filterStaff) return false;
      return true;
    });
  },

  // Controls-only filter card. Export PDF lives on the heading row above it, not
  // in here. Export covers the full filtered set, not just the visible page.
  filterCard() {
    const staffOpts = '<option value="">All staff</option>'
      + this.staff().slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          .map(s => '<option value="' + s.id + '"' + (this.filterStaff === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
    const shiftOpts = '<option value="">All shifts</option>'
      + (App.SHIFT_TYPES || []).map(s => '<option value="' + esc(s) + '"' + (this.filterShift === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    return '<div class="card no-print">'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;align-items:flex-end;flex-wrap:wrap;">'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="lo-f-from" value="' + esc(this.filterFrom) + '"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="lo-f-to" value="' + esc(this.filterTo) + '"/></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Shift</label><select id="lo-f-shift">' + shiftOpts + '</select></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Staff</label><select id="lo-f-staff">' + staffOpts + '</select></div>'
        + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="lo-f-clear">Clear</button></div>'
      + '</div></div>';
  },

  renderList() {
    this.editId = null;
    this.actions.innerHTML = '';

    if (this.staff().length === 0) {
      App.setupCard(this.container, {
        title: 'Log Your First Hours',
        lead: 'Hours are logged against your roster and feed your weekly labor cost, prime cost, and revenue per labor hour. Add your staff and you can start logging.',
        steps: [
          { title: 'Add your staff', desc: 'Hours are logged against a staff member, so build your roster first.', btn: 'Go to Staff Roster', screen: 'lc-staff-roster', done: false }
        ]
      });
      return;
    }

    // One header on the Log Hours card governs the whole entry section: its own
    // form body plus the Import card below (tagged into the same group). Clicking
    // anywhere on the header opens/closes both, so the operator can tuck the entry
    // tools away in one click once they are mostly reviewing the list.
    const addCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('lc-log-hours', 'Log Hours', App.helpButton('lo-how'))
      + '<div class="collapse-body">'
      + this.logFormCells(null)
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="lo-save">Save Hours</button>'
      + '<span id="lo-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    // Import card sits under the log form, so a new operator can drop a timeclock
    // export instead of entering by hand. No explainer text here on purpose; the
    // How it works button carries it. No own header toggle: it collapses with the
    // form via the shared group key.
    const importCard = '<div class="card form-card" data-collapse-group="lc-log-hours">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Import Hours</span>'
      + App.helpButton('lo-imp-how') + '</div>'
      + '<div id="lo-csv"></div><div id="lo-imp-result"></div></div>';

    const all = [...this.actuals()].sort((a, b) =>
      new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());
    const filtered = this.applyFilters(all);
    const totHours = filtered.reduce((s, a) => s + (parseFloat(a.hours) || 0), 0);
    const totCost  = filtered.reduce((s, a) => s + (App.isSalaried(a.staff_id)
      ? (App.staffWeeklySalary(a.staff_id) / 7) : (parseFloat(a.cost) || 0)), 0);

    let below;
    if (all.length === 0) {
      below = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No hours logged yet. Log your first entry above, or import a '
        + 'timeclock export. Logged hours feed your weekly labor cost in Profit and Revenue Recovery.</div>';
    } else {
      const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val lg">' + filtered.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Hours</div><div class="calc-val lg">' + totHours.toFixed(1) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Labor Cost</div><div class="calc-val lg">' + App.fmtCurrency(totCost) + '</div></div>'
        + '</div></div>';

      let listHtml;
      if (filtered.length === 0) {
        listHtml = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No entries match the filters.</div>';
      } else {
        const rows = filtered.slice(0, App.listLimit('lc', 'actual')).map(a => {
          const lockedBadge = a.locked ? ' <span style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--gold);">LOCKED</span>' : '';
          const actions = a.locked
            ? '<span style="font-size:10px;color:var(--t3);">Pay period closed</span>'
            : (App.canEdit('lc-log-hours')
                ? '<button class="btn btn-ghost btn-sm lo-edit" data-id="' + a.id + '">Edit</button>'
                  + '<button class="btn btn-danger btn-sm lo-del" data-id="' + a.id + '">Delete</button>'
                : '');
          return '<tr class="lo-row" data-id="' + a.id + '" style="cursor:' + (a.locked ? 'default' : 'pointer') + ';">'
            + '<td><div class="val">' + this.fmtDate(a.date) + lockedBadge + '</div></td>'
            + '<td>' + esc(a.name || '-') + '</td>'
            + '<td>' + esc(a.shift_type || '-') + '</td>'
            + '<td>' + (a.hours != null ? a.hours.toFixed(1) : '-') + '</td>'
            + '<td>' + (App.isSalaried(a.staff_id) ? '<span style="color:var(--t3);">Salary</span>' : (a.wage != null ? App.fmtCurrency(a.wage) + '/hr' : '-')) + '</td>'
            + '<td class="val">' + (App.isSalaried(a.staff_id) ? App.fmtCurrency(App.staffWeeklySalary(a.staff_id) / 7) : App.fmtCurrency(a.cost || 0)) + '</td>'
            + '<td><div class="row-actions">' + actions + '</div></td></tr>';
        }).join('');
        listHtml = '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
          + '<th>Date</th><th>Staff</th><th>Shift</th><th>Hours</th><th>Wage</th><th>Cost</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>'
          + App.showOlderBar('lc', 'actual', filtered, !!(this.filterFrom || this.filterTo || this.filterShift || this.filterStaff));
      }

      const filterHeading = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
        + '<div class="sh" style="margin:0;">Filter Hours</div>'
        + '<div style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" id="lo-export">Export PDF</button></div></div>';

      below = statsCard + filterHeading + this.filterCard() + listHtml;
    }

    this.container.innerHTML = '<div class="screen">' + addCard + importCard + below + '</div>';
    this.container.onclick = ev => {
      if (ev.target.closest('#lo-how'))     { this.showHowTo(); return; }
      if (ev.target.closest('#lo-imp-how')) { this.showImportHelp(); return; }
      const head = ev.target.closest('.card-collapse-head');
      if (head) { App.toggleCollapse(head); return; }
      if (ev.target.closest('#lo-export'))  { this.exportLogged(); return; }
      if (ev.target.closest('#lo-f-clear')) { this.filterFrom = this.filterTo = this.filterShift = this.filterStaff = ''; this.renderList(); return; }
      if (ev.target.closest('#lo-save'))    { this.save('lo-'); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row  = ev.target.closest('.lo-row');
      const edit = ev.target.closest('.lo-edit');
      const del  = ev.target.closest('.lo-del');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.openEditModal(edit.dataset.id); }
      else if (row && App.canEdit('lc-log-hours')) this.openEditModal(row.dataset.id);
    };
    this.wireForm('lo-');
    this.mountImporter();
    document.getElementById('lo-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('lo-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });
    document.getElementById('lo-f-shift')?.addEventListener('change', e => { this.filterShift = e.target.value || ''; this.renderList(); });
    document.getElementById('lo-f-staff')?.addEventListener('change', e => { this.filterStaff = e.target.value || ''; this.renderList(); });
    App.applyCollapsed(this.container);
  },

  // Edit in a focused pop-up (own loe- ids). Cancel closes it; Delete is pushed
  // right. Locked records (closed pay period) refuse the edit.
  openEditModal(id) {
    if (!App.canEdit('lc-log-hours')) return;
    const a = this.actuals().find(x => x.id === id);
    if (!a) return;
    if (a.locked) {
      App.confirm({
        title: 'This entry is locked.',
        message: 'This record is in a closed pay period. Reopen the period in Pay Periods first, then edit here.',
        confirmText: 'OK', cancelText: 'Cancel'
      });
      return;
    }
    this.editId = id;
    const html = '<div class="card form-card" style="margin:0;"><div class="card-title">Edit Hours</div>'
      + this.logFormCells(a, 'loe-')
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="loe-save">Update</button>'
      + '<button class="btn btn-ghost" id="loe-cancel">Cancel</button>'
      + '<span id="loe-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '<button class="btn btn-danger" id="loe-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'lo-edit-modal', maxWidth: 680, noClose: true });
    document.getElementById('loe-cancel')?.addEventListener('click', () => { this.editId = null; App.closeModal('lo-edit-modal'); });
    document.getElementById('loe-save')?.addEventListener('click', () => this.save('loe-'));
    document.getElementById('loe-del')?.addEventListener('click', () => { this.editId = null; App.closeModal('lo-edit-modal'); this.confirmDel(id); });
    this.wireForm('loe-');
  },

  calc(p) {
    p = p || 'lo-';
    const staff = this.staffById(document.getElementById(p + 'staff')?.value);
    const date  = document.getElementById(p + 'date')?.value || '';
    const set = (id, v) => { const el = document.getElementById(p + id); if (el) el.textContent = v; };
    // Salaried (exempt) staff are paid a fixed salary, so logged hours are
    // coverage only and carry no hourly cost.
    if (staff && App.isSalaried(staff)) {
      set('c-wage', 'Salary');
      set('c-cost', 'Salaried (no hourly cost)');
      return;
    }
    // Wage in effect on the entry's date — handles past-dated entries after
    // a raise (uses the wage that was in effect on that day, not today's).
    const wage  = staff ? (App.wageForStaffOn ? App.wageForStaffOn(staff.id, date) : (staff.wage || 0)) : null;
    const hours = parseFloat(document.getElementById(p + 'hours')?.value) || 0;
    set('c-wage', wage != null ? App.fmtCurrency(wage) + '/hr' : '-');
    set('c-cost', wage != null ? App.fmtCurrency(hours * wage) : '-');
  },

  async save(p) {
    p = p || 'lo-';
    const isEdit = p === 'loe-';
    const err = document.getElementById(p + 'err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById(p + 'date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const staff = this.staffById(document.getElementById(p + 'staff')?.value);
    if (!staff) { fail('Choose a staff member.'); return; }
    const hours = parseFloat(document.getElementById(p + 'hours')?.value);
    if (isNaN(hours) || hours <= 0) { fail('Enter hours worked.'); return; }

    // Resolve wage at the date the hours were worked (not today's wage)
    const wage = App.wageForStaffOn ? App.wageForStaffOn(staff.id, date) : (staff.wage || 0);
    const rec = {
      id:          this.editId || App.uid(),
      date,
      staff_id:    staff.id,
      name:        staff.name,
      position_id: staff.position_id || '',
      shift_type:  document.getElementById(p + 'shift')?.value || '',
      hours,
      wage,
      cost:        hours * wage,
      notes:       document.getElementById(p + 'notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.actuals();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    } else {
      list.push(rec);
    }

    const btn = document.getElementById(p + 'save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('lc', 'actual', saved);
    this.editId = null;
    if (ok) {
      App.markSetupDone('gs_lc_hours');
      if (isEdit) App.closeModal('lo-edit-modal');
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = isEdit ? 'Update' : 'Save Hours'; }
      fail('Save failed. Try again.');
    }
  },

  // ── How This Works ──────────────────────────────────────────────────────────
  showHowTo() {
    App.showHelpModal('How Logging Hours Works', [
      { p: ['This is where actual hours worked get recorded. Logged hours feed your weekly labor cost, prime cost, and revenue per labor hour across Profit and Revenue Recovery, so what you enter here drives the numbers everywhere else.'] },
      { h: 'Logging An Entry', p: ['Fill the row at the top: date, staff member, shift, and hours worked, then Save Hours. Bar Cop costs it out at the wage in effect on that date, so a past-dated entry after a raise still uses the old wage, not today\'s. Salaried staff can be logged for coverage, but their hours carry no hourly cost because they are paid a fixed salary.'] },
      { h: 'Importing From A Timeclock', p: ['Instead of entering by hand, drop a timeclock or POS export into the Import card below and map the columns once. Rows are matched to your roster by name. It is the fast way to get a whole week in at once.'] },
      { h: 'Closed Pay Periods', p: ['Once a pay period is closed in Pay Periods, its entries lock so the payroll handoff stays clean. Reopen the period there if you need to correct a locked entry.'] }
    ]);
  },

  showImportHelp() {
    App.showHelpModal('How Importing Hours Works', [
      { p: ['Upload your timeclock or POS hours export as a CSV or Excel file. Bar Cop reads your column headers, matches them to the right fields, and lets you fix anything it guessed wrong before importing.'] },
      { h: 'The Columns', p: ['Staff Name, Date, and Hours are required. Shift is optional. Your headers do not need to match exactly; these common names are recognized:',
        'Staff Name: employee, employee name, name, staff',
        'Date: date, work date, shift date',
        'Hours: hours, total hours, hrs, worked',
        'Shift: shift, shift type'] },
      { h: 'Matching To Your Roster', p: ['Each row is matched to a staff member by name. A row that does not match anyone on the roster, or is missing hours, is skipped and reported so you can fix it. Each entry costs out at the wage in effect on the date worked, not today\'s rate.'] }
    ]);
  },

  // Export the COMPLETE entry log to PDF. The on-screen list paginates (Show
  // older), so we build an off-screen node holding every entry and hand that to
  // exportPDF — otherwise the PDF would silently drop older rows.
  exportLogged() {
    const all = [...this.actuals()].sort((a, b) =>
      new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());
    const list = this.applyFilters(all);
    if (list.length === 0) return;
    const rows = list.map(a => {
      const wageCell = App.isSalaried(a.staff_id) ? 'Salary' : (a.wage != null ? App.fmtCurrency(a.wage) + '/hr' : '-');
      const costCell = App.isSalaried(a.staff_id) ? App.fmtCurrency(App.staffWeeklySalary(a.staff_id) / 7) : App.fmtCurrency(a.cost || 0);
      return '<tr><td>' + this.fmtDate(a.date) + (a.locked ? ' (locked)' : '') + '</td>'
        + '<td>' + esc(a.name || '-') + '</td>'
        + '<td>' + esc(a.shift_type || '-') + '</td>'
        + '<td>' + (a.hours != null ? a.hours.toFixed(1) : '-') + '</td>'
        + '<td>' + wageCell + '</td>'
        + '<td>' + costCell + '</td></tr>';
    }).join('');
    const node = document.createElement('div');
    node.className = 'screen';
    node.style.cssText = 'position:absolute;left:-99999px;top:0;';
    node.innerHTML = '<div class="card"><div class="card-title">Logged Hours</div>'
      + '<div class="tbl-wrap"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Staff</th><th>Shift</th><th>Hours</th><th>Wage</th><th>Cost</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    document.body.appendChild(node);
    Promise.resolve(App.exportPDF({ title: 'Logged Hours', root: node })).finally(() => node.remove());
  },

  // ── CSV import (drag-drop + column mapping, mounted in the Import card) ───────
  mountImporter() {
    const el = document.getElementById('lo-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      fields: [
        { key: 'name',  label: 'Staff Name', required: true,  match: ['employee', 'employee name', 'name', 'staff'] },
        { key: 'date',  label: 'Date',       required: true,  match: ['date', 'work date', 'shift date'] },
        { key: 'hours', label: 'Hours',      required: true,  match: ['hours', 'total hours', 'hrs', 'worked'] },
        { key: 'shift', label: 'Shift',      required: false, match: ['shift', 'shift type'] }
      ],
      confirmLabel: 'Import',
      onComplete: rows => this.importRows(rows)
    });
  },

  async importRows(rows) {
    const staffByName = {};
    this.staff().forEach(s => { staffByName[(s.name || '').trim().toLowerCase()] = s; });

    const toAdd = [];
    const skipped = [];
    rows.forEach(r => {
      const staff = staffByName[(r.name || '').trim().toLowerCase()];
      const hours = parseFloat(r.hours);
      if (!staff || isNaN(hours) || hours <= 0) {
        skipped.push(r.name || '(blank)');
        return;
      }
      const recDate = this.normDate(r.date);
      const wage = App.wageForStaffOn ? App.wageForStaffOn(staff.id, recDate) : (staff.wage || 0);
      toAdd.push({
        id:          App.uid(),
        date:        recDate,
        staff_id:    staff.id,
        name:        staff.name,
        position_id: staff.position_id || '',
        shift_type:  (r.shift || '').trim(),
        hours,
        wage,
        cost:        hours * wage,
        notes:       '',
        imported:    true,
        created_at:  new Date().toISOString()
      });
    });

    const result = document.getElementById('lo-imp-result');
    const imported = toAdd.length;
    if (imported === 0) {
      if (result) result.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + 'No rows imported. No staff names matched the roster, or hours were missing.</div>';
      return;
    }
    // Each row persists as its own lc_actuals event; putRecord reverts its own
    // in-memory push on a hard failure, so no manual rollback is needed.
    let ok = true;
    for (const rec of toAdd) { ok = (await App.putRecord('lc', 'actual', rec)) && ok; }
    if (!ok) {
      if (result) result.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + 'Save failed. Try the import again.</div>';
      return;
    }
    App.markSetupDone('gs_lc_hours');
    // Re-render the landing so the imported hours show in the list below, then
    // drop the summary into the freshly-rendered import result slot.
    this.renderList();
    const res2 = document.getElementById('lo-imp-result');
    if (res2) res2.innerHTML = '<div style="font-size:13px;color:var(--gold);font-weight:700;margin-top:12px;">'
      + 'Imported ' + imported + ' hours entr' + (imported === 1 ? 'y' : 'ies') + '.'
      + (skipped.length ? ' <span style="color:var(--t3);font-weight:400;">' + skipped.length
          + ' row' + (skipped.length === 1 ? '' : 's') + ' skipped (no roster match or missing hours).</span>' : '') + '</div>';
  },

  async confirmDel(id) {
    const rec = this.actuals().find(x => x.id === id);
    if (rec && rec.locked) {
      App.confirm({
        title: 'This entry is locked.',
        message: 'This record is in a closed pay period. Reopen the period in Pay Periods first to delete it.',
        confirmText: 'OK', cancelText: 'Cancel'
      });
      return;
    }
    if (!(await App.confirmDelete())) return;
    await App.removeRecord('lc', 'actual', id);
    this.renderList();
  }
};
