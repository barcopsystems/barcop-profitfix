'use strict';

/* ── Labor Control — Log Hours (writes lc_actuals) ────────────────────────────
   Records actual hours worked, by hand or by importing a timeclock CSV/Excel
   export through the shared csv-mapper component. lc_actuals feeds Revenue and
   Profit Recovery weekly labor, prime cost, and the RPLH Tracker.

   Landing = inline Log Hours form + an Import card + the logged-hours list.
   Clicking a row opens its edit page (same layout, minus How This Works). */

S.LaborLogHours = {
  editId: null,
  _pendingDelId: null,
  mode: 'list',
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
    return isNaN(d.getTime()) ? String(raw) : d.toISOString().slice(0, 10);
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  // The form cells shared by the inline log form and the edit page so they never
  // drift. All data cells (Date, Staff, Shift, Hours) on one row; Notes on its
  // own row; the live Wage / Labor Cost preview below.
  logFormCells(a) {
    const v = val => (val != null && val !== '') ? val : '';
    const shiftOpts = this.SHIFTS.map(s =>
      '<option value="' + s + '"' + (a && a.shift_type === s ? ' selected' : '') + '>' + (s || '-') + '</option>').join('');
    return '<div class="form-row data-row" style="gap:12px;">'
      + '<div class="f" style="flex:1 1 150px;min-width:0;"><label>Date</label>'
      + '<input type="date" id="lo-date" value="' + esc(a?.date || new Date().toISOString().slice(0, 10)) + '"/></div>'
      + '<div class="f" style="flex:1 1 200px;min-width:0;"><label>Staff</label>'
      + '<select id="lo-staff">' + App.staffOptions(a ? a.staff_id : '') + '</select></div>'
      + '<div class="f" style="flex:1 1 140px;min-width:0;"><label>Shift</label>'
      + '<select id="lo-shift">' + shiftOpts + '</select></div>'
      + '<div class="f" style="flex:1 1 110px;min-width:0;"><label>Hours</label>'
      + '<input type="number" id="lo-hours" min="0" step="0.25" value="' + v(a?.hours) + '"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="lo-notes" rows="1" placeholder="Optional">' + esc(a?.notes || '') + '</textarea></div></div>'
      + '<div class="calc" style="margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Wage</div><div class="calc-val" id="lo-c-wage">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor Cost</div><div class="calc-val" id="lo-c-cost">-</div></div>'
      + '</div>';
  },

  // Attach the live-calc listeners for whichever form is mounted (inline or edit).
  wireForm() {
    document.getElementById('lo-staff')?.addEventListener('change', () => this.calc());
    document.getElementById('lo-date')?.addEventListener('change', () => this.calc());
    document.getElementById('lo-hours')?.addEventListener('input', () => this.calc());
    this.calc();
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

    const addCard = '<div class="card">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Log Hours</span>'
      + '<div style="display:flex;align-items:center;gap:8px;">'
      + App.collapseToggle('lc-log-hours.form')
      + '<button class="btn btn-ghost btn-sm" id="lo-how">How This Works</button></div></div>'
      + '<div class="collapse-body">'
      + this.logFormCells(null)
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="lo-save">Save Hours</button>'
      + '<span id="lo-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    // Import card sits under the log form, so a new operator can drop a timeclock
    // export instead of entering by hand. No explainer text here on purpose; the
    // How This Works button carries it.
    const importCard = '<div class="card">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Import Hours</span>'
      + '<div style="display:flex;align-items:center;gap:8px;">'
      + App.collapseToggle('lc-log-hours.import')
      + '<button class="btn btn-ghost btn-sm" id="lo-imp-how">How This Works</button></div></div>'
      + '<div class="collapse-body"><div id="lo-csv"></div><div id="lo-imp-result"></div></div></div>';

    const list = [...this.actuals()].sort((a, b) =>
      new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());

    let listCard;
    if (list.length === 0) {
      listCard = '<div class="card"><div class="card-title">Logged Hours</div>'
        + '<div style="font-size:13px;color:var(--t3);">No hours logged yet. Log your first entry above, or import a '
        + 'timeclock export. Logged hours feed your weekly labor cost in Profit and Revenue Recovery.</div></div>';
    } else {
      const rows = list.slice(0, App.listLimit('lc', 'actual')).map(a => {
        const lockedBadge = a.locked ? ' <span style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--gold);">LOCKED</span>' : '';
        const actions = a.locked
          ? '<span style="font-size:10px;color:var(--t3);">Pay period closed</span>'
          : (App.canEdit('lc-log-hours') ? '<button class="btn btn-ghost btn-sm lo-edit" data-id="' + a.id + '">Edit</button>' : '')
            + (App.canEdit('lc-log-hours') ? '<button class="btn btn-danger btn-sm lo-del" data-id="' + a.id + '">Delete</button>' : '');
        return '<tr class="lo-row" data-id="' + a.id + '" style="cursor:' + (a.locked ? 'default' : 'pointer') + ';">'
        + '<td><div class="val">' + this.fmtDate(a.date) + lockedBadge + '</div></td>'
        + '<td>' + esc(a.name || '-') + '</td>'
        + '<td>' + esc(a.shift_type || '-') + '</td>'
        + '<td>' + (a.hours != null ? a.hours.toFixed(1) : '-') + '</td>'
        + '<td>' + (App.isSalaried(a.staff_id) ? '<span style="color:var(--t3);">Salary</span>' : (a.wage != null ? App.fmtCurrency(a.wage) + '/hr' : '-')) + '</td>'
        + '<td class="val">' + (App.isSalaried(a.staff_id) ? App.fmtCurrency(App.staffWeeklySalary(a.staff_id) / 7) : App.fmtCurrency(a.cost || 0)) + '</td>'
        + '<td><div class="row-actions">' + actions + '</div></td></tr>';
      }).join('');
      listCard = '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
        + '<span>Logged Hours</span>'
        + '<button class="btn btn-ghost btn-sm" id="lo-export">Export PDF</button></div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Staff</th><th>Shift</th><th>Hours</th><th>Wage</th><th>Cost</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('lc', 'actual', list, false) + '</div>';
    }

    const modal = '<div id="lo-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this hours entry?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="lo-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="lo-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + addCard + importCard + listCard + '</div>' + modal;
    this.container.onclick = ev => {
      const toggle = ev.target.closest('.card-collapse-toggle');
      if (toggle) { App.toggleCollapse(toggle); return; }
      if (ev.target.closest('#lo-how'))     { this.showHowTo(); return; }
      if (ev.target.closest('#lo-imp-how')) { this.showImportHelp(); return; }
      if (ev.target.closest('#lo-export'))  { this.exportLogged(); return; }
      if (ev.target.closest('#lo-save'))    { this.save(); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row = ev.target.closest('.lo-row');
      const edit = ev.target.closest('.lo-edit');
      const del = ev.target.closest('.lo-del');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row && App.canEdit('lc-log-hours')) this.showForm(row.dataset.id);
    };
    this.wireForm();
    this.mountImporter();
    App.applyCollapsed(this.container);
  },

  showForm(id) {
    if (id && !App.canEdit('lc-log-hours')) return;
    this.editId = id || null;
    const a = id ? this.actuals().find(x => x.id === id) : null;
    // Phase 5: locked records belong to a closed pay period. Refuse edits
    // and tell the operator to reopen the period first.
    if (a && a.locked) {
      App.confirm({
        title: 'This entry is locked.',
        message: 'This record is in a closed pay period. Reopen the period in Pay Periods first, then edit here.',
        confirmText: 'OK', cancelText: 'Cancel'
      });
      this.editId = null;
      return;
    }

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">Edit Hours</div>'
      + this.logFormCells(a)
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="lo-save">Update</button>'
      + '<button class="btn btn-ghost" id="lo-cancel">Cancel</button>'
      + '<span id="lo-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('lo-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('lo-save')?.addEventListener('click', () => this.save());
    this.wireForm();
  },

  calc() {
    const staff = this.staffById(document.getElementById('lo-staff')?.value);
    const date  = document.getElementById('lo-date')?.value || '';
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    // Salaried (exempt) staff are paid a fixed salary, so logged hours are
    // coverage only and carry no hourly cost.
    if (staff && App.isSalaried(staff)) {
      set('lo-c-wage', 'Salary');
      set('lo-c-cost', 'Salaried (no hourly cost)');
      return;
    }
    // Wage in effect on the entry's date — handles past-dated entries after
    // a raise (uses the wage that was in effect on that day, not today's).
    const wage  = staff ? (App.wageForStaffOn ? App.wageForStaffOn(staff.id, date) : (staff.wage || 0)) : null;
    const hours = parseFloat(document.getElementById('lo-hours')?.value) || 0;
    set('lo-c-wage', wage != null ? App.fmtCurrency(wage) + '/hr' : '-');
    set('lo-c-cost', wage != null ? App.fmtCurrency(hours * wage) : '-');
  },

  async save() {
    const err = document.getElementById('lo-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('lo-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const staff = this.staffById(document.getElementById('lo-staff')?.value);
    if (!staff) { fail('Choose a staff member.'); return; }
    const hours = parseFloat(document.getElementById('lo-hours')?.value);
    if (isNaN(hours) || hours <= 0) { fail('Enter hours worked.'); return; }

    // Resolve wage at the date the hours were worked (not today's wage)
    const wage = App.wageForStaffOn ? App.wageForStaffOn(staff.id, date) : (staff.wage || 0);
    const rec = {
      id:          this.editId || App.uid(),
      date,
      staff_id:    staff.id,
      name:        staff.name,
      position_id: staff.position_id || '',
      shift_type:  document.getElementById('lo-shift')?.value || '',
      hours,
      wage,
      cost:        hours * wage,
      notes:       document.getElementById('lo-notes')?.value.trim() || ''
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

    const btn = document.getElementById('lo-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('lc', 'actual', saved);
    this.editId = null;
    if (ok) {
      App.markSetupDone('gs_lc_hours');
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Hours'; }
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
    const list = [...this.actuals()].sort((a, b) =>
      new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());
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

  confirmDel(id) {
    const rec = this.actuals().find(x => x.id === id);
    if (rec && rec.locked) {
      App.confirm({
        title: 'This entry is locked.',
        message: 'This record is in a closed pay period. Reopen the period in Pay Periods first to delete it.',
        confirmText: 'OK', cancelText: 'Cancel'
      });
      return;
    }
    this._pendingDelId = id;
    const modal = document.getElementById('lo-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('lo-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('lo-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      await App.removeRecord('lc', 'actual', delId);
      this.renderList();
    };
  }
};
