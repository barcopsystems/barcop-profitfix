'use strict';

/* ── Labor Control — Time Off (writes lc_time_off) ────────────────────────────
   Planned, forward-looking absences: requested days off, vacation, sick, etc.,
   with a date range and an approve/deny status. The opposite of the Call-Out Log
   (which records absences after the fact). An APPROVED entry feeds Build Schedule:
   placing a shift on someone during their approved time off flags it, so nobody
   gets scheduled on a day they already have off. Inline add form on the landing;
   editing a row opens it in a focused pop-up. */

S.LaborTimeOff = {
  editId: null,
  _draft: null,
  TYPES: ['Requested Off', 'Vacation', 'Sick', 'Personal', 'Unpaid', 'Other'],
  STATUSES: ['Requested', 'Approved', 'Denied'],

  records() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_time_off)) App.laborData.lc_time_off = [];
    return App.laborData.lc_time_off;
  },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  // A range reads "Jun 20" for one day, "Jun 20 – Jun 22" for several.
  fmtRange(a, b) {
    if (!a) return '-';
    return (!b || b === a) ? this.fmtDate(a) : this.fmtDate(a) + ' – ' + this.fmtDate(b);
  },
  dayCount(a, b) {
    if (!a) return 0;
    const s = new Date(a + 'T00:00:00'), e = new Date((b || a) + 'T00:00:00');
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    return Math.max(1, Math.round((e - s) / 86400000) + 1);
  },
  statusColor(st) { return st === 'Approved' ? 'var(--green)' : st === 'Denied' ? 'var(--t3)' : 'var(--amber)'; },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Time Off Works', [
      { p: ['Time Off is where requested and planned absences live before they happen: a day off someone asked for, vacation, a medical leave. It is the forward-looking partner to the Call-Out Log, which records absences after the fact.'] },
      { h: 'Logging Time Off', p: ['Fill the row at the top: the staff member, the From and To dates (use the same date for a single day), the type, and the status. Set the status to Approved once you grant it. A note is optional but worth a line for context.'] },
      { h: 'It Protects The Schedule', p: ['An Approved entry feeds Build Schedule. When you try to put a shift on someone during their approved time off, the cell flags and you get a warning before you post, so you never accidentally schedule a person you already gave the day off. Requested and Denied entries sit in the log but do not block the schedule until you approve them.'] },
      { h: 'Recurring Days Off', p: ['For a standing day someone never works (a server who is always off Sundays), set their Regular Days Off on the Staff Roster instead. That blocks every one of those weekdays automatically without logging each week here.'] }
    ]);
  },

  // Shared form cells. p = id prefix ('to-' inline, 'toe-' pop-up).
  formCells(r, p) {
    p = p || 'to-';
    const staffOpts = '<option value="">Select staff...</option>'
      + this.staff().filter(s => s.status !== 'Inactive' || (r && r.staff_id === s.id)).map(s =>
          '<option value="' + s.id + '"' + (r && r.staff_id === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
    const typeOpts = this.TYPES.map(t =>
      '<option' + ((r ? r.type : 'Requested Off') === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const statusOpts = this.STATUSES.map(st =>
      '<option' + ((r ? r.status : 'Approved') === st ? ' selected' : '') + '>' + st + '</option>').join('');
    return '<div class="form-row data-row" style="gap:12px;">'
      + '<div class="f" style="flex:1.2 1 150px;min-width:0;"><label>Staff</label>'
        + '<select id="' + p + 'staff">' + staffOpts + '</select></div>'
      + '<div class="f" style="flex:1 1 130px;min-width:0;"><label>From</label>'
        + '<input type="date" id="' + p + 'from" value="' + esc(r?.start_date || App.todayLocal()) + '"/></div>'
      + '<div class="f" style="flex:1 1 130px;min-width:0;"><label>To</label>'
        + '<input type="date" id="' + p + 'to" value="' + esc(r?.end_date || r?.start_date || App.todayLocal()) + '"/></div>'
      + '<div class="f" style="flex:1 1 130px;min-width:0;"><label>Type</label>'
        + '<select id="' + p + 'type">' + typeOpts + '</select></div>'
      + '<div class="f" style="flex:1 1 120px;min-width:0;"><label>Status</label>'
        + '<select id="' + p + 'status">' + statusOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;"><div class="f" style="width:100%;"><label>Notes</label>'
        + '<textarea id="' + p + 'notes" class="notes-ta" rows="2" placeholder="Optional">' + esc(r?.notes || '') + '</textarea></div></div>';
  },

  renderList() {
    this.editId = null;
    if (this.actions) this.actions.innerHTML = '';

    if (this.staff().length === 0) {
      App.setupCard(this.container, {
        title: 'Log Your First Time Off',
        lead: 'Time off is logged against your roster and protects the schedule from double-booking. Add your staff and you can start tracking requested days off.',
        steps: [
          { title: 'Add your staff', desc: 'Time off is logged against a staff member, so build your roster first.', btn: 'Go to Staff Roster', screen: 'lc-staff-roster', done: false }
        ]
      });
      return;
    }

    const addCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('lc-time-off', 'Log Time Off')
      + '<div class="collapse-body">'
      + this.formCells(null)
      + '</div></div>'
      + '<div data-collapse-group="lc-time-off" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="to-save">Save Time Off</button>'
      + '<button class="btn btn-ghost" id="to-startover">Start Over</button>'
      + '<span id="to-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';

    const today = App.todayLocal();
    // Upcoming + active first (end date today or later), newest start first; past after.
    const list = [...this.records()].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
    const upcoming = list.filter(r => (r.end_date || r.start_date || '') >= today);
    const past = list.filter(r => (r.end_date || r.start_date || '') < today);
    const ordered = upcoming.concat(past);

    let below;
    if (ordered.length === 0) {
      below = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No time off logged yet. Use the form above to record requested days off, vacation, and sick leave so nobody gets scheduled on a day they have off.</div>';
    } else {
      const rows = ordered.slice(0, App.listLimit('lc', 'time_off')).map(r => {
        const days = this.dayCount(r.start_date, r.end_date);
        return '<tr class="to-row" data-id="' + r.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + esc(r.name || '-') + '</div></td>'
          + '<td>' + this.fmtRange(r.start_date, r.end_date) + '<div style="font-size:10px;color:var(--t4);">' + days + ' day' + (days === 1 ? '' : 's') + '</div></td>'
          + '<td>' + esc(r.type || '-') + '</td>'
          + '<td><span style="color:' + this.statusColor(r.status) + ';font-weight:700;">' + esc(r.status || '-') + '</span></td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('lc-time-off') ? '<button class="btn btn-ghost btn-sm to-edit" data-id="' + r.id + '">Edit</button>' : '')
          + (App.canEdit('lc-time-off') ? '<button class="btn btn-danger btn-sm to-del" data-id="' + r.id + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');
      below = '<div class="sh" style="margin-top:24px;">Time Off</div>'
        + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Staff</th><th>Dates</th><th>Type</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>'
        + App.showOlderBar('lc', 'time_off', ordered, false);
    }

    this.container.innerHTML = '<div class="screen">' + addCard + below + '</div>';
    this.container.onclick = ev => {
      const head = ev.target.closest('.card-collapse-head');
      if (head) { App.toggleCollapse(head); return; }
      if (ev.target.closest('#to-startover')) { this._draft = null; this.renderList(); return; }
      if (ev.target.closest('#to-save')) { this.save('to-'); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row = ev.target.closest('.to-row');
      const edit = ev.target.closest('.to-edit');
      const del = ev.target.closest('.to-del');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.openEditModal(edit.dataset.id); }
      else if (row && App.canEdit('lc-time-off')) this.openEditModal(row.dataset.id);
    };
    const formRoot = this.container.querySelector('.collapse-body');
    if (formRoot) {
      if (this._draft) App.restoreDraft(formRoot, this._draft);
      const cap = () => { this._draft = App.captureDraft(formRoot); };
      formRoot.addEventListener('input', cap);
      formRoot.addEventListener('change', cap);
    }
    App.applyCollapsed(this.container);
  },

  openEditModal(id) {
    if (!App.canEdit('lc-time-off')) return;
    const r = this.records().find(x => x.id === id);
    if (!r) return;
    this.editId = id;
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Time Off</div>'
      + this.formCells(r, 'toe-')
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="toe-save">Update</button>'
      + '<button class="btn btn-ghost" id="toe-cancel">Cancel</button>'
      + '<span id="toe-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '<button class="btn btn-danger" id="toe-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'to-edit-modal', maxWidth: 560, noClose: true });
    document.getElementById('toe-save')?.addEventListener('click', () => this.save('toe-'));
    document.getElementById('toe-cancel')?.addEventListener('click', () => { this.editId = null; App.closeModal('to-edit-modal'); });
    document.getElementById('toe-del')?.addEventListener('click', () => { this.editId = null; App.closeModal('to-edit-modal'); this.confirmDel(id); });
  },

  async save(p) {
    p = p || 'to-';
    const isEdit = p === 'toe-';
    const err = document.getElementById(p + 'err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const staff = this.staffById(document.getElementById(p + 'staff')?.value);
    if (!staff) { fail('Choose a staff member.'); return; }
    const from = document.getElementById(p + 'from')?.value;
    if (!from) { fail('Set the From date.'); return; }
    let to = document.getElementById(p + 'to')?.value || from;
    if (to < from) to = from;   // a backwards range collapses to one day, no silent error

    const rec = {
      id:         this.editId || App.uid(),
      staff_id:   staff.id,
      name:       staff.name,
      start_date: from,
      end_date:   to,
      type:       document.getElementById(p + 'type')?.value || 'Requested Off',
      status:     document.getElementById(p + 'status')?.value || 'Approved',
      notes:      document.getElementById(p + 'notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.records();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    } else { list.push(rec); }

    const btn = document.getElementById(p + 'save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('lc', 'time_off', saved);
    this.editId = null;
    if (ok) {
      if (!isEdit) this._draft = null;
      if (isEdit) App.closeModal('to-edit-modal');
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = isEdit ? 'Update' : 'Save Time Off'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    if (!(await App.confirmDelete())) return;
    await App.removeRecord('lc', 'time_off', id);
    this.renderList();
  }
};
