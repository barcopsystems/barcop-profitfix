'use strict';

/* ── Labor Control — Log Hours (writes lc_actuals) ────────────────────────────
   Records actual hours worked, by hand or by importing a timeclock CSV/Excel
   export through the shared csv-mapper component. lc_actuals feeds Revenue and
   Profit Recovery weekly labor, prime cost, and the RPLH Tracker. */

S.LaborLogHours = {
  editId: null,
  _pendingDelId: null,
  mode: 'list',
  SHIFTS: ['', 'Brunch', 'Lunch', 'Dinner', 'Late Night', 'Full Day'],

  actuals() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_actuals)) App.laborData.lc_actuals = [];
    return App.laborData.lc_actuals;
  },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
  fmtDate(str) {
    if (!str) return '—';
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

  renderList() {
    this.actions.innerHTML = '';
    if (this.staff().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Add staff first</div>'
        + '<div class="empty-sub">Hours are logged against your roster. Add staff in Staff Roster, then '
        + 'log or import their hours here.</div>'
        + '<button class="btn btn-primary" id="lo-go-roster">Go to Staff Roster</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#lo-go-roster')) App.navigate('lc-staff-roster'); };
      return;
    }

    const importBtn = document.createElement('button');
    importBtn.className = 'btn btn-ghost btn-sm';
    importBtn.textContent = 'Import CSV';
    importBtn.addEventListener('click', () => this.showImport());
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = 'Log Hours';
    addBtn.addEventListener('click', () => this.showForm());
    this.actions.appendChild(importBtn);
    this.actions.appendChild(addBtn);

    const list = [...this.actuals()].sort((a, b) =>
      new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());

    let html;
    if (list.length === 0) {
      html = '<div class="empty"><div class="empty-title">No hours logged yet</div>'
        + '<div class="empty-sub">Log hours by hand, or import a timeclock export. Logged hours feed your '
        + 'weekly labor cost in Profit and Revenue Recovery.</div>'
        + '<button class="btn btn-primary" id="lo-add-first">Log Hours</button></div>';
    } else {
      const totHours = list.reduce((t, a) => t + (a.hours || 0), 0);
      const totCost = list.reduce((t, a) => t + (a.cost || 0), 0);
      const summary = '<div class="calc" style="margin-bottom:16px;">'
        + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val">' + list.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Hours</div><div class="calc-val">' + totHours.toFixed(1) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Labor Cost</div><div class="calc-val">' + App.fmtCurrency(totCost) + '</div></div>'
        + '</div>';
      const rows = list.slice(0, 100).map(a => '<tr class="lo-row" data-id="' + a.id + '" style="cursor:pointer;">'
        + '<td><div class="val">' + this.fmtDate(a.date) + '</div></td>'
        + '<td>' + esc(a.name || '—') + '</td>'
        + '<td>' + esc(a.shift_type || '—') + '</td>'
        + '<td>' + (a.hours != null ? a.hours.toFixed(1) : '—') + '</td>'
        + '<td>' + (a.wage != null ? App.fmtCurrency(a.wage) + '/hr' : '—') + '</td>'
        + '<td class="val">' + App.fmtCurrency(a.cost || 0) + '</td>'
        + '<td><div class="row-actions">'
        + '<button class="btn btn-ghost btn-sm lo-edit" data-id="' + a.id + '">Edit</button>'
        + '<button class="btn btn-danger btn-sm lo-del" data-id="' + a.id + '">Delete</button>'
        + '</div></td></tr>').join('');
      html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Staff</th><th>Shift</th><th>Hours</th><th>Wage</th><th>Cost</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="lo-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this hours entry?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="lo-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="lo-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      const row = ev.target.closest('.lo-row');
      const edit = ev.target.closest('.lo-edit');
      const del = ev.target.closest('.lo-del');
      const addF = ev.target.closest('#lo-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row)  this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
  },

  staffOptions(selId) {
    return '<option value="">Select staff...</option>'
      + this.staff().filter(s => s.status !== 'Inactive' || s.id === selId).map(s =>
          '<option value="' + s.id + '"' + (s.id === selId ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
  },

  showForm(id) {
    this.editId = id || null;
    const a = id ? this.actuals().find(x => x.id === id) : null;
    const shiftOpts = this.SHIFTS.map(s =>
      '<option value="' + s + '"' + (a && a.shift_type === s ? ' selected' : '') + '>' + (s || '—') + '</option>').join('');
    const v = val => (val != null && val !== '') ? val : '';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'Log') + ' Hours</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="lo-date" value="' + esc(a?.date || new Date().toISOString().slice(0, 10)) + '"/></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Staff</label>'
      + '<select id="lo-staff">' + this.staffOptions(a ? a.staff_id : '') + '</select></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Shift</label>'
      + '<select id="lo-shift">' + shiftOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>Hours</label>'
      + '<input type="number" id="lo-hours" min="0" step="0.25" value="' + v(a?.hours) + '" '
      + 'oninput="S.LaborLogHours.calc()"/></div>'
      + '<div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="lo-notes" rows="2" placeholder="Optional">' + esc(a?.notes || '') + '</textarea></div>'
      + '</div>'
      + '<div class="calc" style="margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Wage</div><div class="calc-val" id="lo-c-wage">—</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor Cost</div><div class="calc-val" id="lo-c-cost">—</div></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="lo-save">' + (id ? 'Update' : 'Save Hours') + '</button>'
      + '<button class="btn btn-ghost" id="lo-cancel">Cancel</button>'
      + '<span id="lo-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('lo-staff')?.addEventListener('change', () => this.calc());
    document.getElementById('lo-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('lo-save')?.addEventListener('click', () => this.save());
    this.calc();
  },

  calc() {
    const staff = this.staffById(document.getElementById('lo-staff')?.value);
    const wage = staff && staff.wage != null ? staff.wage : null;
    const hours = parseFloat(document.getElementById('lo-hours')?.value) || 0;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('lo-c-wage', wage != null ? App.fmtCurrency(wage) + '/hr' : '—');
    set('lo-c-cost', wage != null ? App.fmtCurrency(hours * wage) : '—');
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

    const wage = staff.wage != null ? staff.wage : 0;
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
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('lo-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveLabor();
    this.editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Hours'; }
      fail('Save failed. Try again.');
    }
  },

  // ── CSV import ──────────────────────────────────────────────────────────────
  showImport() {
    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="lo-imp-back">&#8592; Back to Log Hours</button></div>'
      + '<div class="card"><div class="card-title">Import Timeclock Hours</div>'
      + '<div id="lo-csv"></div></div>'
      + '<div id="lo-imp-result"></div></div>';
    document.getElementById('lo-imp-back')?.addEventListener('click', () => this.renderList());

    CSVMapper.mount(document.getElementById('lo-csv'), {
      fields: [
        { key: 'name',  label: 'Staff Name', required: true,  match: ['employee', 'employee name', 'name', 'staff'] },
        { key: 'date',  label: 'Date',       required: true,  match: ['date', 'work date', 'shift date'] },
        { key: 'hours', label: 'Hours',      required: true,  match: ['hours', 'total hours', 'hrs', 'worked'] },
        { key: 'shift', label: 'Shift',      required: false, match: ['shift', 'shift type'] }
      ],
      hint: 'Upload your timeclock or POS hours export. Staff names are matched to your roster — '
        + 'rows that do not match a staff member are skipped.',
      confirmLabel: 'Import',
      onComplete: rows => this.importRows(rows)
    });
  },

  async importRows(rows) {
    const staffByName = {};
    this.staff().forEach(s => { staffByName[(s.name || '').trim().toLowerCase()] = s; });

    let imported = 0;
    const skipped = [];
    rows.forEach(r => {
      const staff = staffByName[(r.name || '').trim().toLowerCase()];
      const hours = parseFloat(r.hours);
      if (!staff || isNaN(hours) || hours <= 0) {
        skipped.push(r.name || '(blank)');
        return;
      }
      const wage = staff.wage != null ? staff.wage : 0;
      this.actuals().push({
        id:          App.uid(),
        date:        this.normDate(r.date),
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
      imported++;
    });

    const result = document.getElementById('lo-imp-result');
    if (imported === 0) {
      if (result) result.innerHTML = '<div class="card"><div style="font-size:13px;color:var(--red);">'
        + 'No rows imported — no staff names matched the roster, or hours were missing.</div></div>';
      return;
    }
    const ok = await App.saveLabor();
    if (!ok) {
      this.actuals().splice(this.actuals().length - imported, imported);
      if (result) result.innerHTML = '<div class="card"><div style="font-size:13px;color:var(--red);">'
        + 'Save failed. Try the import again.</div></div>';
      return;
    }
    if (result) {
      result.innerHTML = '<div class="card"><div style="text-align:center;padding:10px 0;">'
        + '<div style="font-size:15px;font-weight:800;color:var(--t1);margin-bottom:6px;">'
        + imported + ' hours entr' + (imported === 1 ? 'y' : 'ies') + ' imported</div>'
        + (skipped.length ? '<div style="font-size:11px;color:var(--t3);">' + skipped.length
            + ' row' + (skipped.length === 1 ? '' : 's') + ' skipped (no roster match or missing hours)</div>' : '')
        + '<div class="card-actions" style="justify-content:center;">'
        + '<button class="btn btn-primary" id="lo-imp-done">View Logged Hours</button></div></div></div>';
      document.getElementById('lo-imp-done')?.addEventListener('click', () => this.renderList());
    }
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('lo-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('lo-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('lo-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.laborData.lc_actuals = this.actuals().filter(x => x.id !== delId);
      await App.saveLabor();
      this.renderList();
    };
  }
};
