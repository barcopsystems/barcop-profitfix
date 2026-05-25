'use strict';

/* ── Labor Control — Call-Out Log (writes lc_callouts) ────────────────────────
   Tracks attendance exceptions — no-shows, sick calls, late arrivals — so
   reliability patterns surface. Staff with repeat call-outs are flagged. */

S.LaborCalloutLog = {
  editId: null,
  _pendingDelId: null,
  TYPES: ['No-Show', 'Called Out Sick', 'Late Arrival', 'Left Early', 'Other'],
  SHIFTS: ['', 'Brunch', 'Lunch', 'Dinner', 'Late Night', 'Full Day'],

  callouts() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_callouts)) App.laborData.lc_callouts = [];
    return App.laborData.lc_callouts;
  },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  // call-outs for a staff member in the last 60 days
  repeatCount(staffId) {
    if (!staffId) return 0;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
    return this.callouts().filter(c =>
      c.staff_id === staffId && new Date((c.date || '') + 'T00:00:00') >= cutoff).length;
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  renderList() {
    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="co-export">Export PDF</button>';
    document.getElementById('co-export')?.addEventListener('click', () => window.print());
    if (this.staff().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Add staff first</div>'
        + '<div class="empty-sub">Call-outs are logged against your roster. Add staff in Staff Roster, '
        + 'then track attendance here.</div>'
        + '<button class="btn btn-primary" id="co-go-roster">Go to Staff Roster</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#co-go-roster')) App.navigate('lc-staff-roster'); };
      return;
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = 'Log Call-Out';
    addBtn.addEventListener('click', () => this.showForm());
    this.actions.appendChild(addBtn);

    const list = [...this.callouts()].sort((a, b) =>
      new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());

    let html;
    if (list.length === 0) {
      html = '<div class="empty"><div class="empty-title">No call-outs logged</div>'
        + '<div class="empty-sub">Log no-shows, sick calls, and late arrivals here. Repeat call-outs from '
        + 'one person get flagged so patterns are easy to spot.</div>'
        + '<button class="btn btn-primary" id="co-add-first">Log Call-Out</button></div>';
    } else {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
      const last30 = list.filter(c => new Date((c.date || '') + 'T00:00:00') >= cutoff).length;
      const noShows = list.filter(c => c.type === 'No-Show').length;
      const uncovered = list.filter(c => !c.covered).length;
      const summary = '<div class="calc" style="margin-bottom:16px;">'
        + '<div class="calc-item"><div class="calc-label">Total Call-Outs</div><div class="calc-val">' + list.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Last 30 Days</div><div class="calc-val">' + last30 + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">No-Shows</div><div class="calc-val ' + (noShows ? 'warn' : '') + '">' + noShows + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Uncovered</div><div class="calc-val ' + (uncovered ? 'warn' : '') + '">' + uncovered + '</div></div>'
        + '</div>';
      const rows = list.map(c => {
        const reps = this.repeatCount(c.staff_id);
        const repTag = reps > 1 ? ' <span class="badge badge-warn">' + reps + '&times; / 60d</span>' : '';
        return '<tr class="co-row" data-id="' + c.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(c.date) + '</div></td>'
          + '<td>' + esc(c.name || '-') + repTag + '</td>'
          + '<td>' + (c.type === 'No-Show'
              ? '<span class="badge badge-warn">No-Show</span>'
              : '<span class="badge badge-dim">' + esc(c.type || '-') + '</span>') + '</td>'
          + '<td>' + esc(c.shift_type || '-') + '</td>'
          + '<td>' + (c.covered
              ? '<span class="badge badge-ok">Covered</span>'
              : '<span class="badge badge-warn">Not Covered</span>') + '</td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('lc-callout-log') ? '<button class="btn btn-ghost btn-sm co-edit" data-id="' + c.id + '">Edit</button>' : '')
          + (App.canEdit('lc-callout-log') ? '<button class="btn btn-danger btn-sm co-del" data-id="' + c.id + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');
      html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Staff</th><th>Type</th><th>Shift</th><th>Coverage</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="co-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this call-out?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="co-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="co-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      const row = ev.target.closest('.co-row');
      const edit = ev.target.closest('.co-edit');
      const del = ev.target.closest('.co-del');
      const addF = ev.target.closest('#co-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row && App.canEdit('lc-callout-log')) this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
  },

  showForm(id) {
    if (id && !App.canEdit('lc-callout-log')) return;
    this.editId = id || null;
    const c = id ? this.callouts().find(x => x.id === id) : null;
    const staffOpts = '<option value="">Select staff...</option>'
      + this.staff().filter(s => s.status !== 'Inactive' || (c && c.staff_id === s.id)).map(s =>
          '<option value="' + s.id + '"' + (c && c.staff_id === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
    const typeOpts = this.TYPES.map(t =>
      '<option' + ((c ? c.type : 'No-Show') === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const shiftOpts = this.SHIFTS.map(s =>
      '<option value="' + s + '"' + (c && c.shift_type === s ? ' selected' : '') + '>' + (s || '-') + '</option>').join('');

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'Log') + ' Call-Out</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="co-date" value="' + esc(c?.date || new Date().toISOString().slice(0, 10)) + '"/></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Staff</label>'
      + '<select id="co-staff">' + staffOpts + '</select></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Type</label>'
      + '<select id="co-type">' + typeOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Shift</label>'
      + '<select id="co-shift">' + shiftOpts + '</select></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Shift Covered?</label><select id="co-covered">'
      + '<option value="no"' + (!c || !c.covered ? ' selected' : '') + '>Not Covered</option>'
      + '<option value="yes"' + (c && c.covered ? ' selected' : '') + '>Covered</option>'
      + '</select></div>'
      + '<div class="f" style="width:180px;flex-shrink:0;"><label>Covered By</label>'
      + '<input type="text" id="co-coveredby" value="' + esc(c?.covered_by || '') + '" placeholder="Optional"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Reason</label>'
      + '<input type="text" id="co-reason" value="' + esc(c?.reason || '') + '" placeholder="Optional"/></div></div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="co-notes" rows="2" placeholder="Optional">' + esc(c?.notes || '') + '</textarea></div></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="co-save">' + (id ? 'Update' : 'Save Call-Out') + '</button>'
      + '<button class="btn btn-ghost" id="co-cancel">Cancel</button>'
      + '<span id="co-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('co-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('co-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const err = document.getElementById('co-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('co-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const staff = this.staffById(document.getElementById('co-staff')?.value);
    if (!staff) { fail('Choose a staff member.'); return; }

    const rec = {
      id:          this.editId || App.uid(),
      date,
      staff_id:    staff.id,
      name:        staff.name,
      type:        document.getElementById('co-type')?.value || 'No-Show',
      shift_type:  document.getElementById('co-shift')?.value || '',
      covered:     document.getElementById('co-covered')?.value === 'yes',
      covered_by:  document.getElementById('co-coveredby')?.value.trim() || '',
      reason:      document.getElementById('co-reason')?.value.trim() || '',
      notes:       document.getElementById('co-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.callouts();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('co-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveLabor();
    this.editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Call-Out'; }
      fail('Save failed. Try again.');
    }
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('co-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('co-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('co-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.laborData.lc_callouts = this.callouts().filter(x => x.id !== delId);
      await App.saveLabor();
      this.renderList();
    };
  }
};
