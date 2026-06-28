'use strict';

/* ── Labor Control — Call-Out Log (writes lc_callouts) ────────────────────────
   Tracks attendance exceptions — no-shows, sick calls, late arrivals — so
   reliability patterns surface. Staff with repeat call-outs are flagged.
   Inline log form on the landing; editing a row opens it in a focused pop-up. */

S.LaborCalloutLog = {
  editId: null,
  _draft: null,            // in-memory inline-log draft (survives leave/return)
  TYPES: ['No-Show', 'Called Out Sick', 'Late Arrival', 'Left Early', 'Other'],
  // Reads canonical SHIFT_TYPES from App with a leading '' for the optional
  // "no specific shift" choice. Getter so a future SHIFT_TYPES change is picked up.
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
  // 24h "HH:MM" -> 12h ("16:00" -> "4p", "00:00" -> "12a") so a scheduled shift
  // reads like the rest of Bar Cop instead of a confusing 00:00 midnight.
  fmtTime(t) {
    if (!t) return '';
    const [h, m] = String(t).split(':').map(Number);
    if (isNaN(h)) return esc(t);
    const ap = h < 12 ? 'a' : 'p';
    let hr = h % 12; if (hr === 0) hr = 12;
    return hr + (m ? ':' + String(m).padStart(2, '0') : '') + ap;
  },
  // call-outs for a staff member in the last 60 days
  repeatCount(staffId) {
    if (!staffId) return 0;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
    return this.callouts().filter(c =>
      c.staff_id === staffId && new Date((c.date || '') + 'T00:00:00') >= cutoff).length;
  },

  // ── Schedule connection ──────────────────────────────────────────────────────
  schedules() { return ((App.laborData && App.laborData.lc_schedules) || []); },
  get DAYS() { return App.DAYS_MON_FIRST || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; },
  mondayOf(ymd) {
    if (!ymd) return '';
    const d = new Date(ymd + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return App.ymdLocal(d);
  },
  // What a staff member was scheduled for on a date, from the posted schedule:
  // { shift, dayName } if found, { none:true } if scheduled-but-not-that-day,
  // { noSchedule:true } if no schedule is posted for that week, or null.
  scheduledShiftFor(staffId, date) {
    if (!staffId || !date) return null;
    const ws = this.mondayOf(date);
    const sched = this.schedules().filter(s => s.week_start === ws)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
    if (!sched) return { noSchedule: true };
    const d = new Date(date + 'T00:00:00');
    if (isNaN(d.getTime())) return { noSchedule: true };
    const dayName = this.DAYS[(d.getDay() + 6) % 7];
    const sh = (sched.shifts || []).find(x => x.staff_id === staffId && x.day === dayName);
    return sh ? { shift: sh, dayName } : { none: true };
  },
  updateSchedNote(p) {
    p = p || 'co-';
    const el = document.getElementById(p + 'sched-note');
    if (!el) return;
    const staffId = document.getElementById(p + 'staff')?.value || '';
    const date = document.getElementById(p + 'date')?.value || '';
    if (!staffId || !date) { el.innerHTML = ''; return; }
    const info = this.scheduledShiftFor(staffId, date);
    let html = '';
    if (info && info.shift) {
      const sh = info.shift;
      const time = (sh.start && sh.end) ? ' ' + this.fmtTime(sh.start) + '–' + this.fmtTime(sh.end) : '';
      html = '<span style="color:var(--amber);font-weight:600;">Scheduled ' + esc(info.dayName) + time + '. Needs cover.</span>';
    } else if (info && info.none) {
      html = '<span style="color:var(--t3);">Not on the posted schedule for this day.</span>';
    }
    // Heads-up if the chosen coverer is also on the schedule that day.
    const cb = document.getElementById(p + 'coveredby')?.value || '';
    if (cb) {
      const cbInfo = this.scheduledShiftFor(cb, date);
      if (cbInfo && cbInfo.shift) {
        const cbName = (App.staffById(cb) || {}).name || 'That person';
        html += (html ? ' ' : '') + '<span style="color:var(--amber);">' + esc(cbName) + ' is also scheduled that day.</span>';
      }
    }
    el.innerHTML = html;
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How the Call-Out Log Works', [
      { p: ['The Call-Out Log tracks attendance exceptions, no-shows, sick calls, late arrivals, and early-outs, so reliability patterns surface instead of living in your head.'] },
      { h: 'Logging A Call-Out', p: ['Fill the row at the top: date, staff member, what happened, the shift, and whether it got covered and by whom. Reason is optional but worth a line if it might matter later.'] },
      { h: 'Schedule Connection', p: ['Pick the staff member and the date and Bar Cop reads the posted schedule for that week. If they were on the floor that day it reads "Scheduled [day] [time]. Needs cover." in amber, so you can see at a glance what shift just opened up. If they were not on the schedule that day it says so. When you then name who is covering, Bar Cop checks the same schedule and warns "[name] is also scheduled that day" so you do not patch one hole by double-booking somebody already working.'] },
      { h: 'Repeat Flags', p: ['When someone has more than one call-out in the last 60 days, the list flags the count in red next to their name, so a pattern is easy to spot before it becomes a problem.'] },
      { h: 'Coverage', p: ['Set Shift Covered? to Covered or Not Covered, and pick the coverer from the Covered By list, which is your roster. That builds a record of who picks up the slack and who left you short, useful at review time and the spot where the double-booked warning fires.'] }
    ]);
  },

  // Form cells shared by the inline log form and the edit pop-up. p = element-id
  // prefix ('co-' inline, 'coe-' pop-up) so the modal's inputs never collide with
  // the inline form behind it. Six data cells on one row; Reason below.
  formCells(c, p) {
    p = p || 'co-';
    const staffOpts = '<option value="">Select staff...</option>'
      + this.staff().filter(s => s.status !== 'Inactive' || (c && c.staff_id === s.id)).map(s =>
          '<option value="' + s.id + '"' + (c && c.staff_id === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
    const typeOpts = this.TYPES.map(t =>
      '<option' + ((c ? c.type : 'No-Show') === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const shiftOpts = this.SHIFTS.map(s =>
      '<option value="' + s + '"' + (c && c.shift_type === s ? ' selected' : '') + '>' + (s || 'Select shift...') + '</option>').join('');
    return '<div class="form-row data-row" style="gap:12px;">'
      + '<div class="f" style="flex:1 1 130px;min-width:0;"><label>Date</label>'
        + '<input type="date" id="' + p + 'date" value="' + esc(c?.date || App.todayLocal()) + '"/></div>'
      + '<div class="f" style="flex:1.2 1 150px;min-width:0;"><label>Staff</label>'
        + '<select id="' + p + 'staff">' + staffOpts + '</select></div>'
      + '<div class="f" style="flex:1 1 130px;min-width:0;"><label>Type</label>'
        + '<select id="' + p + 'type">' + typeOpts + '</select></div>'
      + '<div class="f" style="flex:1 1 120px;min-width:0;"><label>Shift</label>'
        + '<select id="' + p + 'shift">' + shiftOpts + '</select></div>'
      + '<div class="f" style="flex:1 1 130px;min-width:0;"><label>Shift Covered?</label><select id="' + p + 'covered">'
        + '<option value="no"' + (!c || !c.covered ? ' selected' : '') + '>Not Covered</option>'
        + '<option value="yes"' + (c && c.covered ? ' selected' : '') + '>Covered</option></select></div>'
      + '<div class="f" style="flex:1.2 1 150px;min-width:0;"><label>Covered By</label>'
        + '<select id="' + p + 'coveredby">' + App.staffOptions(c?.covered_by_id || c?.covered_by, { placeholder: '(optional)' }) + '</select></div>'
      + '</div>'
      + '<div id="' + p + 'sched-note" class="co-sched-line" style="font-size:11px;line-height:1.5;"></div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;"><div class="f" style="width:100%;"><label>Reason</label>'
        + '<textarea id="' + p + 'reason" class="notes-ta" rows="2" placeholder="Optional">' + esc(c?.reason || '') + '</textarea></div></div>';
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

    const addCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('lc-callout-log', 'Log Call-Out')
      + '<div class="collapse-body">'
      + this.formCells(null)
      + '</div></div>'
      + '<div data-collapse-group="lc-callout-log" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="co-save">Save Call-Out</button>'
      + '<button class="btn btn-ghost" id="co-startover">Start Over</button>'
      + '<span id="co-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';

    const list = [...this.callouts()].sort((a, b) =>
      new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());

    let below;
    if (list.length === 0) {
      below = '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
        + '<th>Date</th><th>Staff</th><th>Type</th><th>Shift</th><th>Coverage</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="6" style="color:var(--t3);">No call-outs logged yet. Use the form above to log no-shows, sick calls, and late arrivals.</td></tr></tbody></table></div>';
    } else {
      const rows = list.slice(0, App.listLimit('lc', 'callout')).map(c => {
        const reps = this.repeatCount(c.staff_id);
        const repTag = reps > 1 ? ' <span style="color:var(--red);font-weight:700;">' + reps + '&times; / 60d</span>' : '';
        return '<tr class="co-row" data-id="' + c.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(c.date) + '</div></td>'
          + '<td>' + esc(c.name || '-') + repTag + '</td>'
          + '<td><span style="color:var(--t1);font-weight:600;">' + esc(c.type || '-') + '</span></td>'
          + '<td>' + esc(c.shift_type || '-') + '</td>'
          + '<td>' + (c.covered
              ? '<span style="color:var(--green);font-weight:700;">Covered</span>'
              : '<span style="color:var(--red);font-weight:700;">Not Covered</span>') + '</td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('lc-callout-log') ? '<button class="btn btn-ghost btn-sm co-edit" data-id="' + c.id + '">Edit</button>' : '')
          + (App.canEdit('lc-callout-log') ? '<button class="btn btn-danger btn-sm co-del" data-id="' + c.id + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');
      below = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Date</th><th>Staff</th><th>Type</th><th>Shift</th><th>Coverage</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('lc', 'callout', list, false);
    }

    this.container.innerHTML = '<div class="screen">' + addCard + below + '</div>';
    this.container.onclick = ev => {
      const head = ev.target.closest('.card-collapse-head');
      if (head) { App.toggleCollapse(head); return; }
      if (ev.target.closest('#co-startover')) { this._draft = null; this.renderList(); return; }
      if (ev.target.closest('#co-save')) { this.save('co-'); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row = ev.target.closest('.co-row');
      const edit = ev.target.closest('.co-edit');
      const del = ev.target.closest('.co-del');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.openEditModal(edit.dataset.id); }
      else if (row && App.canEdit('lc-callout-log')) this.openEditModal(row.dataset.id);
    };
    // Restore an in-progress draft before the schedule note recomputes off it;
    // then capture on every input so the draft stays current through a re-render.
    const formRoot = this.container.querySelector('.collapse-body');
    if (formRoot && this._draft) App.restoreDraft(formRoot, this._draft);
    ['co-staff', 'co-date', 'co-coveredby'].forEach(id =>
      document.getElementById(id)?.addEventListener('change', () => this.updateSchedNote('co-')));
    this.updateSchedNote('co-');
    if (formRoot) {
      const cap = () => { this._draft = App.captureDraft(formRoot); };
      formRoot.addEventListener('input', cap);
      formRoot.addEventListener('change', cap);
    }
    App.applyCollapsed(this.container);
  },

  // Edit in a focused pop-up (own coe- ids). Cancel closes it; Delete pushed right.
  openEditModal(id) {
    if (!App.canEdit('lc-callout-log')) return;
    const c = this.callouts().find(x => x.id === id);
    if (!c) return;
    this.editId = id;
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Call-Out</div>'
      + this.formCells(c, 'coe-')
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="coe-save">Update</button>'
      + '<button class="btn btn-ghost" id="coe-cancel">Cancel</button>'
      + '<span id="coe-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '<button class="btn btn-danger" id="coe-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'co-edit-modal', maxWidth: 540, noClose: true });
    document.getElementById('coe-save')?.addEventListener('click', () => this.save('coe-'));
    document.getElementById('coe-cancel')?.addEventListener('click', () => { this.editId = null; App.closeModal('co-edit-modal'); });
    document.getElementById('coe-del')?.addEventListener('click', () => { this.editId = null; App.closeModal('co-edit-modal'); this.confirmDel(id); });
    ['coe-staff', 'coe-date', 'coe-coveredby'].forEach(eid =>
      document.getElementById(eid)?.addEventListener('change', () => this.updateSchedNote('coe-')));
    this.updateSchedNote('coe-');
  },

  async save(p) {
    p = p || 'co-';
    const isEdit = p === 'coe-';
    const err = document.getElementById(p + 'err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById(p + 'date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const staff = this.staffById(document.getElementById(p + 'staff')?.value);
    if (!staff) { fail('Choose a staff member.'); return; }

    const coveredById = document.getElementById(p + 'coveredby')?.value || '';
    const rec = {
      id:            this.editId || App.uid(),
      date,
      staff_id:      staff.id,
      name:          staff.name,
      type:          document.getElementById(p + 'type')?.value || 'No-Show',
      shift_type:    document.getElementById(p + 'shift')?.value || '',
      covered:       document.getElementById(p + 'covered')?.value === 'yes',
      covered_by_id: coveredById,
      covered_by:    (App.staffById(coveredById) || {}).name || '',
      reason:        document.getElementById(p + 'reason')?.value.trim() || ''
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

    const btn = document.getElementById(p + 'save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('lc', 'callout', saved);
    this.editId = null;
    if (ok) {
      if (!isEdit) this._draft = null;   // a saved call-out clears its draft
      if (isEdit) App.closeModal('co-edit-modal');
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = isEdit ? 'Update' : 'Save Call-Out'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    if (!(await App.confirmDelete())) return;
    await App.removeRecord('lc', 'callout', id);
    this.renderList();
  }
};
