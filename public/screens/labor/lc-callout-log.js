'use strict';

/* ── Labor Control — Call-Out Log (writes lc_callouts) ────────────────────────
   Tracks attendance exceptions — no-shows, sick calls, late arrivals — so
   reliability patterns surface. Staff with repeat call-outs are flagged. */

S.LaborCalloutLog = {
  editId: null,
  _pendingDelId: null,
  TYPES: ['No-Show', 'Called Out Sick', 'Late Arrival', 'Left Early', 'Other'],
  // Reads canonical SHIFT_TYPES from App with a leading '' for "all shifts"
  // filter option. Defined as a getter so any future change to App.SHIFT_TYPES
  // is picked up automatically.
  get SHIFTS() { return ['', ...(App.SHIFT_TYPES || [])]; },

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

  showHowTo() {
    App.showHelpModal('How the Call-Out Log Works', [
      { p: ['The Call-Out Log tracks attendance exceptions, no-shows, sick calls, late arrivals, and early-outs, so reliability patterns surface instead of living in your head.'] },
      { h: 'Logging A Call-Out', p: ['Fill the row at the top: date, staff member, what happened, the shift, and whether it got covered and by whom. Reason and notes are optional but worth a line if it might matter later.'] },
      { h: 'Repeat Flags', p: ['When someone has more than one call-out in the last 60 days, the list flags the count in red next to their name, so a pattern is easy to spot before it becomes a problem.'] },
      { h: 'Coverage', p: ['Marking whether a call-out was covered, and by whom, builds a record of who picks up the slack, which is useful at review time.'] }
    ]);
  },

  // Form cells shared by the inline log form and the edit page. The six data
  // cells (Date, Staff, Type, Shift, Shift Covered, Covered By) on one row;
  // Reason and Notes on their own rows. Pass the record for edit, or null.
  formCells(c) {
    const staffOpts = '<option value="">Select staff...</option>'
      + this.staff().filter(s => s.status !== 'Inactive' || (c && c.staff_id === s.id)).map(s =>
          '<option value="' + s.id + '"' + (c && c.staff_id === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
    const typeOpts = this.TYPES.map(t =>
      '<option' + ((c ? c.type : 'No-Show') === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const shiftOpts = this.SHIFTS.map(s =>
      '<option value="' + s + '"' + (c && c.shift_type === s ? ' selected' : '') + '>' + (s || '-') + '</option>').join('');
    return '<div class="form-row data-row" style="gap:12px;">'
      + '<div class="f" style="flex:1 1 130px;min-width:0;"><label>Date</label>'
        + '<input type="date" id="co-date" value="' + esc(c?.date || App.todayLocal()) + '"/></div>'
      + '<div class="f" style="flex:1.2 1 150px;min-width:0;"><label>Staff</label>'
        + '<select id="co-staff">' + staffOpts + '</select></div>'
      + '<div class="f" style="flex:1 1 130px;min-width:0;"><label>Type</label>'
        + '<select id="co-type">' + typeOpts + '</select></div>'
      + '<div class="f" style="flex:1 1 120px;min-width:0;"><label>Shift</label>'
        + '<select id="co-shift">' + shiftOpts + '</select></div>'
      + '<div class="f" style="flex:1 1 130px;min-width:0;"><label>Shift Covered?</label><select id="co-covered">'
        + '<option value="no"' + (!c || !c.covered ? ' selected' : '') + '>Not Covered</option>'
        + '<option value="yes"' + (c && c.covered ? ' selected' : '') + '>Covered</option></select></div>'
      + '<div class="f" style="flex:1.2 1 150px;min-width:0;"><label>Covered By</label>'
        + '<select id="co-coveredby">' + App.staffOptions(c?.covered_by_id || c?.covered_by, { placeholder: '(optional)' }) + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Reason</label>'
        + '<input type="text" id="co-reason" value="' + esc(c?.reason || '') + '" placeholder="Optional"/></div></div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;"><div class="f" style="width:100%;"><label>Notes</label>'
        + '<textarea id="co-notes" rows="2" placeholder="Optional">' + esc(c?.notes || '') + '</textarea></div></div>';
  },

  renderList() {
    this.editId = null;
    this.actions.innerHTML = '';

    if (this.staff().length === 0) {
      App.setupCard(this.container, {
        title: 'Log Your First Call-Out',
        lead: 'Call-outs are logged against your roster so reliability patterns surface. Add your staff and you can start tracking attendance.',
        steps: [
          { title: 'Add your staff', desc: 'Call-outs are logged against a staff member, so build your roster first.', btn: 'Go to Staff Roster', screen: 'lc-staff-roster', done: false }
        ]
      });
      return;
    }

    const addCard = '<div class="card">'
      + App.collapsibleCardTitle('lc-callout-log', 'Log Call-Out', App.helpButton('co-how'))
      + '<div class="collapse-body">'
      + this.formCells(null)
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="co-save">Save Call-Out</button>'
      + '<span id="co-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    const list = [...this.callouts()].sort((a, b) =>
      new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());

    let listCard;
    if (list.length === 0) {
      listCard = '<div class="card"><div class="card-title">Call-Out Log</div>'
        + '<div style="font-size:13px;color:var(--t3);">No call-outs logged yet. Log no-shows, sick calls, and late '
        + 'arrivals above. Repeat call-outs from one person get flagged so patterns are easy to spot.</div></div>';
    } else {
      const rows = list.slice(0, App.listLimit('lc', 'callout')).map(c => {
        const reps = this.repeatCount(c.staff_id);
        const repTag = reps > 1 ? ' <span style="color:var(--red);font-weight:700;">' + reps + '&times; / 60d</span>' : '';
        return '<tr class="co-row" data-id="' + c.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(c.date) + '</div></td>'
          + '<td>' + esc(c.name || '-') + repTag + '</td>'
          + '<td>' + (c.type === 'No-Show'
              ? '<span style="color:var(--red);font-weight:700;">No-Show</span>'
              : '<span style="color:var(--t3);font-weight:700;">' + esc(c.type || '-') + '</span>') + '</td>'
          + '<td>' + esc(c.shift_type || '-') + '</td>'
          + '<td>' + (c.covered
              ? '<span style="color:var(--gold);font-weight:700;">Covered</span>'
              : '<span style="color:var(--red);font-weight:700;">Not Covered</span>') + '</td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('lc-callout-log') ? '<button class="btn btn-ghost btn-sm co-edit" data-id="' + c.id + '">Edit</button>' : '')
          + (App.canEdit('lc-callout-log') ? '<button class="btn btn-danger btn-sm co-del" data-id="' + c.id + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');
      listCard = '<div class="card"><div class="card-title">Call-Out Log</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Staff</th><th>Type</th><th>Shift</th><th>Coverage</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('lc', 'callout', list, false) + '</div>';
    }

    this.container.innerHTML = '<div class="screen">' + addCard + listCard + '</div>';
    this.container.onclick = ev => {
      if (ev.target.closest('#co-how'))  { this.showHowTo(); return; }
      const head = ev.target.closest('.card-collapse-head');
      if (head) { App.toggleCollapse(head); return; }
      if (ev.target.closest('#co-save')) { this.save(); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row = ev.target.closest('.co-row');
      const edit = ev.target.closest('.co-edit');
      const del = ev.target.closest('.co-del');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row && App.canEdit('lc-callout-log')) this.showForm(row.dataset.id);
    };
    App.applyCollapsed(this.container);
  },

  showForm(id) {
    if (id && !App.canEdit('lc-callout-log')) return;
    this.editId = id || null;
    const c = id ? this.callouts().find(x => x.id === id) : null;

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">Edit Call-Out</div>'
      + this.formCells(c)
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="co-save">Update</button>'
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
      covered_by_id: document.getElementById('co-coveredby')?.value || '',
      covered_by:    (App.staffById(document.getElementById('co-coveredby')?.value) || {}).name || '',
      reason:      document.getElementById('co-reason')?.value.trim() || '',
      notes:       document.getElementById('co-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.callouts();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('co-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('lc', 'callout', saved);
    this.editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Call-Out'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    if (!(await App.confirmDelete())) return;
    await App.removeRecord('lc', 'callout', id);
    this.renderList();
  }
};
