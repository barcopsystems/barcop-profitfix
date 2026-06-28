'use strict';

/* ── Labor Control — Log Hours (writes lc_actuals) ────────────────────────────
   Records actual hours worked, by hand or by importing a timeclock CSV/Excel
   export through the shared csv-mapper component. lc_actuals feeds Revenue and
   Profit Recovery weekly labor, prime cost, and This Week's RPLH.

   Landing = inline Log Hours form + an Import card + the logged-hours list.
   Editing a row opens it in a focused pop-up. */

S.LaborLogHours = {
  editId: null,
  entryMode: 'schedule',   // 'schedule' = pull the posted week (default), 'manual' = type a row. The timeclock import lives on the Labor cockpit, not here.
  _modeOnce: null,         // one-shot mode override from a deep-link, consumed on the next render
  _fillWeek: '',           // Monday of the week being pulled from the schedule
  _fillModel: null,        // in-memory Fill-from-Schedule rows (week pulled into the modal)
  _draft: null,            // in-memory manual-entry draft (survives filter/leave-return)
  filterPreset: 'last-4',  // active range chip: this-week|last-week|this-month|last-4|all|custom
  _prevPreset: 'last-4',   // range to restore when Custom is toggled closed
  filterFrom: '',          // custom range only
  filterTo: '',            // custom range only
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
  // 24h "HH:MM" -> 12h ("16:00" -> "4p", "00:00" -> "12a").
  fmtTime(t) {
    if (!t) return '';
    const [h, m] = String(t).split(':').map(Number);
    if (isNaN(h)) return esc(t);
    const ap = h < 12 ? 'a' : 'p';
    let hr = h % 12; if (hr === 0) hr = 12;
    return hr + (m ? ':' + String(m).padStart(2, '0') : '') + ap;
  },
  normDate(raw) {
    if (!raw) return '';
    const d = new Date(String(raw).length <= 10 ? raw + 'T00:00:00' : raw);
    return isNaN(d.getTime()) ? String(raw) : App.ymdLocal(d);
  },

  // ── Schedule-pull helpers (Fill from Schedule mode) ──────────────────────────
  schedules() { return ((App.laborData && App.laborData.lc_schedules) || []); },
  mondayOf(ymd) {
    if (!ymd) return '';
    const d = new Date(ymd + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return App.ymdLocal(d);
  },
  weekDayYmd(weekStart, dayIdx) {
    if (!weekStart || dayIdx < 0) return '';
    const d = new Date(weekStart + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + dayIdx);
    return App.ymdLocal(d);
  },
  scheduleForWeek(ws) {
    const matches = this.schedules().filter(s => s.week_start === ws);
    if (!matches.length) return null;
    return matches.slice().sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
  },
  latestScheduleWeek() {
    const list = this.schedules();
    if (!list.length) return '';
    return (list.slice().sort((a, b) => (b.week_start || '').localeCompare(a.week_start || ''))[0] || {}).week_start || '';
  },
  actualExists(staffId, date) {
    return this.actuals().some(a => a.staff_id === staffId && a.date === date);
  },
  // Step the Fill-from-Schedule week by the arrow buttons (always lands on a Monday).
  // Forward is clamped at the current week: you can't log a week not yet worked.
  shiftFillWeek(n) {
    const cur = this.mondayOf(App.todayLocal());
    const base = this._fillWeek || cur;
    const d = new Date(base + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    d.setDate(d.getDate() + n);
    const next = this.mondayOf(App.ymdLocal(d));
    if (next > cur) return;   // never into the future
    this._fillWeek = next;
    this.renderList();
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    // A deep-link can force a mode for this one visit (shift close / a report jump
    // straight into Fill from Schedule). Otherwise STAY in whatever mode the
    // operator was last working in, so leaving and coming back returns them right
    // to it — including a half-done Fill from Schedule, whose rows persist. The
    // recent list shows in every mode now, so a sticky mode hides nothing.
    if (this._modeOnce) { this.entryMode = this._modeOnce; this._modeOnce = null; }
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
      + '<div class="f" style="flex:1 1 140px;min-width:0;"><label>Date</label>'
      + '<input type="date" id="' + p + 'date" value="' + esc(a?.date || App.todayLocal()) + '"/></div>'
      + '<div class="f" style="flex:1 1 170px;min-width:0;"><label>Staff</label>'
      + '<select id="' + p + 'staff">' + App.staffOptions(a ? a.staff_id : '') + '</select></div>'
      + '<div class="f" style="flex:1 1 130px;min-width:0;"><label>Shift</label>'
      + '<select id="' + p + 'shift">' + shiftOpts + '</select></div>'
      + '<div class="f" style="flex:1 1 90px;min-width:0;"><label>Hours</label>'
      + '<input type="number" id="' + p + 'hours" min="0" step="0.25" value="' + v(a?.hours) + '"/></div>'
      + '<div class="f" style="flex:1 1 110px;min-width:0;"><label>Wage</label>'
      + '<div class="f-display" style="color:var(--w);" id="' + p + 'c-wage">-</div></div>'
      + '<div class="f" style="flex:1 1 120px;min-width:0;"><label>Labor Cost</label>'
      + '<div class="f-display" style="color:var(--w);" id="' + p + 'c-cost">-</div></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="' + p + 'notes" class="notes-ta" rows="2" placeholder="Optional">' + esc(a?.notes || '') + '</textarea></div></div>';
  },

  // Attach the live-calc listeners for whichever form is mounted (inline or edit).
  wireForm(p) {
    p = p || 'lo-';
    document.getElementById(p + 'staff')?.addEventListener('change', () => this.calc(p));
    document.getElementById(p + 'date')?.addEventListener('change', () => this.calc(p));
    document.getElementById(p + 'hours')?.addEventListener('input', () => this.calc(p));
    this.calc(p);
  },

  // Effective date window from the active range chip. A preset recomputes off
  // "today" every render (so This Week always means the live current week);
  // Custom reads the From/To pickers; All clears the window.
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  applyFilters(list) {
    const { from, to } = this.effectiveRange();
    return list.filter(a => {
      const date = a.date || '';
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  },

  // The sort/filter row that sits directly above the data block: range chips on
  // the left, Export on the right (no filter card). Picking Custom reveals a bare
  // From/To row beneath it. Time is the only filter this log needs — at one bar's
  // volume a window of entries is small enough to read; narrow further via Export.
  RANGE_CHIPS: [
    { v: 'this-week', label: 'This Week' }, { v: 'last-week', label: 'Last Week' },
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'lo-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
        + '<button class="btn btn-ghost btn-sm" id="lo-export">Export PDF</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="lo-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="lo-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
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

    // One card, two ways in: type a row by hand, or drop a timeclock export. A
    // segmented toggle swaps the body between the manual form and the file import
    // so the operator picks a lane instead of staring at two separate boxes.
    const segBtn = (mode, label) => {
      const on = this.entryMode === mode;
      return '<button type="button" class="btn btn-sm lo-mode" data-mode="' + mode + '" style="'
        + (on ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    };
    // Primary action lives BELOW the card (bottom-left), collapse-group tagged so
    // it hides with the card. The card body is just the entry surface per mode.
    let modeBody, actionRow;
    const rowOpen = '<div data-collapse-group="lc-log-hours" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">';
    if (this.entryMode === 'schedule') {
      // The week-list workspace moved into a focused pop-up so the landing stays
      // short (stats + log right below). The card body is the launcher; the
      // Review & Log Week button sits BELOW the card like every other mode's action.
      modeBody = this.scheduleLauncherBody();
      actionRow = this.fillReviewCount() > 0
        ? rowOpen + '<button class="btn btn-primary" id="lo-fill-open">Review &amp; Log Week</button></div>'
        : '';
    } else {
      modeBody = this.logFormCells(null);
      actionRow = rowOpen
        + '<button class="btn btn-primary" id="lo-save">Save Hours</button>'
        + '<button class="btn btn-ghost" id="lo-startover">Start Over</button>'
        + '<span id="lo-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div>';
    }
    const addCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('lc-log-hours', 'Log Hours')
      + '<div class="collapse-body">'
      + '<div class="seg-toggle">' + segBtn('schedule', 'Fill from Schedule') + segBtn('manual', 'Enter Manually') + '</div>'
      + modeBody
      + '</div></div>';

    const all = [...this.actuals()].sort((a, b) =>
      new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());
    const filtered = this.applyFilters(all);
    const totHours = filtered.reduce((s, a) => s + (parseFloat(a.hours) || 0), 0);
    const totCost  = filtered.reduce((s, a) => s + (App.isSalaried(a.staff_id)
      ? (App.staffWeeklySalary(a.staff_id) / 7) : (parseFloat(a.cost) || 0)), 0);

    let below;
    if (all.length === 0) {
      below = '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
        + '<th>Date</th><th>Staff</th><th>Shift</th><th>Hours</th><th>Wage</th><th>Cost</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="7" style="color:var(--t3);">No hours logged yet. Fill them from your posted schedule or enter them by hand above.</td></tr></tbody></table></div>';
    } else {
      const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val lg">' + filtered.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Hours</div><div class="calc-val lg">' + totHours.toFixed(1) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Labor Cost</div><div class="calc-val lg">' + App.fmtCurrency(totCost) + '</div></div>'
        + '</div></div>';

      let listHtml;
      if (filtered.length === 0) {
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>Date</th><th>Staff</th><th>Shift</th><th>Hours</th><th>Wage</th><th>Cost</th><th></th>'
          + '</tr></thead><tbody><tr><td colspan="7" style="color:var(--t3);">No hours logged in this range. Pick a wider range above.</td></tr></tbody></table></div>';
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
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>Date</th><th>Staff</th><th>Shift</th><th>Hours</th><th>Wage</th><th>Cost</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          + App.showOlderBar('lc', 'actual', filtered, this.filterPreset !== 'all');
      }

      below = statsCard + this.filterRow() + listHtml;
    }

    this.container.innerHTML = '<div class="screen">' + addCard + actionRow + below + '</div>';
    this.container.onclick = ev => {
      const modeBtn = ev.target.closest('.lo-mode');
      if (modeBtn) { this.entryMode = modeBtn.dataset.mode; this.renderList(); return; }
      const head = ev.target.closest('.card-collapse-head');
      if (head) { App.toggleCollapse(head); return; }
      if (ev.target.closest('#lo-export'))  { this.exportLogged(); return; }
      const rangeChip = ev.target.closest('.lo-range-chip');
      if (rangeChip) {
        const v = rangeChip.dataset.v;
        if (v === 'custom') {
          // Custom is a toggle: a second click on it closes the pickers and
          // returns to whatever range was active before opening Custom.
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else {
          this.filterPreset = v; this.filterFrom = ''; this.filterTo = '';
        }
        this.renderList();
        return;
      }
      if (ev.target.closest('#lo-save'))    { this.save('lo-'); return; }
      if (ev.target.closest('#lo-startover')) { this._draft = null; this.renderList(); return; }
      if (ev.target.closest('#lo-fill-open')) { this.openFillModal(); return; }
      if (ev.target.closest('.lo-go-build')) { App.navigate('lc-build-schedule'); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row  = ev.target.closest('.lo-row');
      const edit = ev.target.closest('.lo-edit');
      const del  = ev.target.closest('.lo-del');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.openEditModal(edit.dataset.id); }
      else if (row && App.canEdit('lc-log-hours')) this.openEditModal(row.dataset.id);
    };
    if (this.entryMode === 'schedule') {
      document.getElementById('lo-fill-prev')?.addEventListener('click', () => this.shiftFillWeek(-7));
      document.getElementById('lo-fill-next')?.addEventListener('click', () => this.shiftFillWeek(7));
      document.getElementById('lo-fill-now')?.addEventListener('click', () => {
        const ws = this.mondayOf(App.todayLocal());
        if (ws === this._fillWeek) return;
        this._fillWeek = ws; this.renderList();
      });
    }
    else {
      // Manual: restore an in-progress draft before wiring so the live cost preview
      // reads the restored values; then capture on every input so it stays current.
      const formRoot = this.container.querySelector('.collapse-body');
      if (formRoot && this._draft) App.restoreDraft(formRoot, this._draft);
      this.wireForm('lo-');
      if (formRoot) {
        const cap = () => { this._draft = App.captureDraft(formRoot); };
        formRoot.addEventListener('input', cap);
        formRoot.addEventListener('change', cap);
      }
    }
    document.getElementById('lo-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('lo-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });
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
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Hours</div>'
      + this.logFormCells(a, 'loe-')
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="loe-save">Update</button>'
      + '<button class="btn btn-ghost" id="loe-cancel">Cancel</button>'
      + '<span id="loe-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '<button class="btn btn-danger" id="loe-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'lo-edit-modal', maxWidth: 540, noClose: true });
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
      set('c-cost', 'Salaried');
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
    const shiftType = document.getElementById(p + 'shift')?.value || '';

    // Duplicate guard (new entries only): if this staff member already has hours
    // logged for this date + shift, confirm before adding a second (catches a
    // re-log / double-entry; a real split shift can still be added on purpose).
    if (!this.editId) {
      const dup = this.actuals().find(x => x.staff_id === staff.id && x.date === date && (x.shift_type || '') === shiftType);
      if (dup) {
        const proceed = await App.confirm({
          title: 'Already logged',
          message: staff.name + ' already has ' + (dup.hours != null ? dup.hours : 0) + ' hours logged for ' + this.fmtDate(date) + (shiftType ? ' (' + shiftType + ')' : '') + '. Add another entry anyway?',
          confirmText: 'Add Anyway', cancelText: 'Cancel', danger: false
        });
        if (!proceed) return;
      }
    }

    // Resolve wage at the date the hours were worked (not today's wage).
    // Salaried (exempt) staff carry no hourly cost — pay is the fixed weekly
    // salary added elsewhere, so logged hours are coverage only (wage/cost 0).
    const sal = App.isSalaried(staff);
    const wage = sal ? null : (App.wageForStaffOn ? App.wageForStaffOn(staff.id, date) : (staff.wage || 0));
    const rec = {
      id:          this.editId || App.uid(),
      date,
      staff_id:    staff.id,
      name:        staff.name,
      position_id: staff.position_id || '',
      shift_type:  shiftType,
      hours,
      wage,
      cost:        sal ? 0 : hours * (wage || 0),
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
      if (!isEdit) this._draft = null;   // a saved manual entry clears its draft
      if (isEdit) App.closeModal('lo-edit-modal');
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = isEdit ? 'Update' : 'Save Hours'; }
      fail('Save failed. Try again.');
    }
  },

  // ── Fill from Schedule ───────────────────────────────────────────────────────
  // The card shows a compact launcher (week selector + a ready-to-log readout +
  // Review & Log Week). The actual week list lives in a focused pop-up so the
  // landing never grows: one scrollable list grouped by day, no per-day tabs. The
  // model holds every scheduled shift for the week; already-logged shifts are kept
  // out of the pop-up list, and anyone with a no-show / sick call-out logged for
  // that day comes in pre-unchecked (the Call-Out Log already knows).
  callouts() { return ((App.laborData && App.laborData.lc_callouts) || []); },
  ensureFillModel(ws) {
    if (!this._fillModel || this._fillModel.ws !== ws) this.buildFillModel(ws);
  },
  buildFillModel(ws) {
    const DAYS = App.DAYS_MON_FIRST || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const NO_WORK = ['No-Show', 'Called Out Sick'];   // call-out types that mean "did not work"
    const co = this.callouts();
    const sched = this.scheduleForWeek(ws);
    const rows = [];
    if (sched) {
      (sched.shifts || []).forEach(sh => {
        const di = DAYS.indexOf(sh.day);
        if (di < 0) return;
        const date = this.weekDayYmd(ws, di);
        if (!date) return;
        const staff = this.staffById(sh.staff_id);
        const already = this.actualExists(sh.staff_id, date);
        const call = co.find(c => c.staff_id === sh.staff_id && c.date === date && NO_WORK.indexOf(c.type) >= 0);
        rows.push({
          staff_id: sh.staff_id, name: sh.name || (staff ? staff.name : '-'),
          date, dayIdx: di, start: sh.start || '', end: sh.end || '',
          hours: (sh.hours != null ? String(sh.hours) : ''),
          checked: !already && !call, already, calloutNote: call ? call.type : ''
        });
      });
    }
    rows.sort((a, b) => (a.dayIdx - b.dayIdx) || (a.name || '').localeCompare(b.name || ''));
    rows.forEach((r, idx) => { r.i = idx; });
    this._fillModel = { ws, rows };
  },
  // Week selector for Fill from Schedule: ONE week range pill (active-selector
  // style, gold NOW on the current week) flanked by step arrows, plus a snap back
  // to This Week. Forward is INERT on the current week: you can't log hours for a
  // week that hasn't been worked yet.
  fillWeekSelector(ws) {
    const cur = this.mondayOf(App.todayLocal());
    const isCur = ws >= cur;
    const nowBadge = isCur ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">'
      + App.dateRangeLabel(ws, App.periodEndFor(ws)).toUpperCase() + nowBadge + '</span>';
    const nextBtn = isCur
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button type="button" class="btn btn-ghost btn-sm" id="lo-fill-next" aria-label="Next week" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:18px 0 14px;">'
      + '<button type="button" class="btn btn-ghost btn-sm" id="lo-fill-prev" aria-label="Previous week" style="margin:0;padding:3px 9px;">&lsaquo;</button>'
      + pill
      + nextBtn
      + (isCur ? '' : '<button type="button" class="btn btn-ghost btn-sm" id="lo-fill-now" style="margin-left:4px;">This Week</button>')
      + '</div>';
  },

  // Compact launcher shown in the card body when Fill from Schedule is the active
  // mode: the week selector, a one-line ready-to-log readout, and the button that
  // opens the week pop-up. Keeps the landing short.
  scheduleLauncherBody() {
    const cur = this.mondayOf(App.todayLocal());
    let ws = this._fillWeek || this.latestScheduleWeek() || cur;
    if (ws > cur) ws = cur;   // never land past the current week — nothing's been worked yet
    this._fillWeek = ws;
    const picker = this.fillWeekSelector(ws);
    this.ensureFillModel(ws);
    const model = this._fillModel;
    if (!model.rows.length) {
      return picker + '<div style="font-size:12px;color:var(--t3);padding:6px 2px;">No posted schedule for this week. '
        + '<span class="lo-go-build" style="color:var(--gold);cursor:pointer;text-decoration:underline;">Build the schedule</span> first, or pick another week.</div>';
    }
    const logged = model.rows.filter(r => r.already).length;
    const toReview = model.rows.length - logged;
    if (toReview === 0) {
      return picker + '<div style="font-size:12px;color:var(--t3);padding:6px 2px;">Every scheduled shift this week is already logged. Pick another week to fill.</div>';
    }
    const loggedNote = logged ? ' <span style="color:var(--t3);">(' + logged + ' already logged)</span>' : '';
    const readout = '<div style="font-size:13px;color:var(--t2);margin:18px 0 2px;">'
      + '<span style="color:var(--gold);font-weight:700;">' + toReview + ' shift' + (toReview === 1 ? '' : 's') + '</span> ready to log from the schedule, hours pre-filled.' + loggedNote + '</div>';
    return picker + readout;
  },

  // Shifts still to log for the active fill week (0 = no schedule or all logged).
  // Drives whether the below-card Review & Log Week button shows.
  fillReviewCount() {
    const m = this._fillModel;
    if (!m || !m.rows.length) return 0;
    return m.rows.filter(r => !r.already).length;
  },

  // The focused week pop-up: every still-to-log scheduled shift as one list grouped
  // by day, scrolling inside the modal. Uncheck no-shows, fix hours, log the week.
  openFillModal() {
    const ws = this._fillWeek;
    this.ensureFillModel(ws);
    const model = this._fillModel;
    const active = model.rows.filter(r => !r.already);
    const loggedCount = model.rows.length - active.length;
    const n = active.filter(r => r.checked && parseFloat(r.hours) > 0).length;
    const loggedLine = loggedCount
      ? ' <span style="color:var(--t3);">' + loggedCount + ' already logged ' + (loggedCount === 1 ? 'shift is' : 'shifts are') + ' not shown.</span>' : '';
    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">Log Hours &middot; ' + esc(App.dateRangeLabel(ws, App.periodEndFor(ws))) + '</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.5;margin-bottom:12px;">Uncheck anyone who did not work, fix any hours, then log.' + loggedLine + '</div>'
      + '<div id="lo-fmodal-list" style="max-height:52vh;overflow-y:auto;margin:0 -2px;padding:0 2px;">' + this.fillModalListHtml(active) + '</div>'
      + '<div class="card-actions" style="margin-top:16px;">'
      + '<button class="btn btn-primary" id="lo-fmodal-log"' + (n ? '' : ' disabled') + '>Log ' + n + ' Entr' + (n === 1 ? 'y' : 'ies') + '</button>'
      + '<button class="btn btn-ghost" id="lo-fmodal-cancel">Cancel</button>'
      + '<span id="lo-fmodal-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'lo-fill-modal', maxWidth: 620, noClose: true });
    const listEl = document.getElementById('lo-fmodal-list');
    if (listEl) {
      listEl.addEventListener('change', () => this.updateFillModalCount());
      listEl.addEventListener('input', () => this.updateFillModalCount());
    }
    document.getElementById('lo-fmodal-cancel')?.addEventListener('click', () => App.closeModal('lo-fill-modal'));
    document.getElementById('lo-fmodal-log')?.addEventListener('click', () => this.commitFillFromModal());
  },

  // The grouped-by-day rows inside the pop-up. One neutral subheader per day, then
  // its shifts (checkbox / name + call-out tag / scheduled time / hours).
  fillModalListHtml(rows) {
    const DAYS = App.DAYS_MON_FIRST || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const ws = this._fillWeek;
    const present = [...new Set(rows.map(r => r.dayIdx))].sort((a, b) => a - b);
    if (!present.length) return '<div class="card" style="padding:14px 20px;"><div style="font-size:12px;color:var(--t3);">Nothing left to log for this week. Every scheduled shift is already logged.</div></div>';
    return present.map(di => {
      const date = this.weekDayYmd(ws, di);
      const d = new Date((date || '') + 'T00:00:00');
      const lbl = isNaN(d.getTime()) ? (DAYS[di] || '')
        : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
      const trs = rows.filter(r => r.dayIdx === di).map(r => {
        const time = (r.start && r.end)
          ? '<span style="color:var(--t3);font-size:11px;">' + esc(this.fmtTime(r.start)) + '&ndash;' + esc(this.fmtTime(r.end)) + '</span>' : '';
        const note = r.calloutNote
          ? '<div style="color:var(--amber);font-size:10px;font-weight:600;">' + esc(r.calloutNote) + '</div>' : '';
        return '<tr class="lo-fmodal-row" data-mi="' + r.i + '">'
          + '<td style="width:34px;text-align:center;"><input type="checkbox" class="lo-fmodal-cb bc-check"' + (r.checked ? ' checked' : '') + '/></td>'
          + '<td><div class="val">' + esc(r.name) + '</div>' + note + '</td>'
          + '<td>' + time + '</td>'
          + '<td><input type="number" class="lo-fmodal-hours form-input" min="0" step="0.25" value="' + esc(r.hours) + '" style="width:80px;"/></td>'
          + '</tr>';
      }).join('');
      return '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin:14px 0 6px;">' + esc(lbl) + '</div>'
        + '<div style="overflow-x:auto;margin-bottom:6px;"><table class="ing-tbl pill" style="table-layout:fixed;"><tbody>' + trs + '</tbody></table></div>';
    }).join('');
  },

  // Sync the pop-up DOM back into the model (so checkbox + hours edits persist) and
  // refresh the Log button count.
  updateFillModalCount() {
    if (!this._fillModel) return;
    let n = 0;
    document.querySelectorAll('#lo-fmodal-list .lo-fmodal-row').forEach(tr => {
      const r = this._fillModel.rows[parseInt(tr.dataset.mi, 10)];
      if (!r) return;
      const cb = tr.querySelector('.lo-fmodal-cb');
      const h = tr.querySelector('.lo-fmodal-hours');
      if (cb) r.checked = cb.checked;
      if (h) r.hours = h.value;
      if (r.checked && !r.already && parseFloat(r.hours) > 0) n++;
    });
    const btn = document.getElementById('lo-fmodal-log');
    if (btn) { btn.disabled = n === 0; btn.textContent = 'Log ' + n + ' Entr' + (n === 1 ? 'y' : 'ies'); }
  },

  async commitFillFromModal() {
    this.updateFillModalCount();
    const err = document.getElementById('lo-fmodal-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const recs = [];
    (this._fillModel ? this._fillModel.rows : []).forEach(r => {
      if (r.already || !r.checked) return;
      if (this.actualExists(r.staff_id, r.date)) return;
      const staff = this.staffById(r.staff_id);
      if (!staff) return;
      const hours = parseFloat(r.hours);
      if (isNaN(hours) || hours <= 0) return;
      const sal = App.isSalaried(staff);
      const wage = sal ? null : (App.wageForStaffOn ? App.wageForStaffOn(r.staff_id, r.date) : (staff.wage || 0));
      recs.push({
        id: App.uid(), date: r.date, staff_id: r.staff_id, name: staff.name,
        position_id: staff.position_id || '', shift_type: '',
        hours, wage, cost: sal ? 0 : hours * (wage || 0),
        notes: '', from_schedule: true, created_at: new Date().toISOString()
      });
    });
    if (!recs.length) { fail('Nothing to log. Check at least one row with hours above zero.'); return; }
    const btn = document.getElementById('lo-fmodal-log');
    if (btn) { btn.disabled = true; btn.textContent = 'Logging...'; }
    let ok = true;
    for (const rec of recs) { this.actuals().push(rec); ok = (await App.putRecord('lc', 'actual', rec)) && ok; }
    if (ok) {
      App.markSetupDone('gs_lc_hours');
      this._fillModel = null;   // rebuild so the just-logged shifts drop off
      App.closeModal('lo-fill-modal');
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; this.updateFillModalCount(); }
      fail('Save failed. Try again.');
    }
  },

  // ── How This Works ──────────────────────────────────────────────────────────
  showHowTo() {
    App.showHelpModal('How Logging Hours Works', [
      { p: ['This is where actual hours worked get recorded. Logged hours feed your weekly labor cost, prime cost, and revenue per labor hour across Profit and Revenue Recovery, so what you enter here drives the numbers everywhere else.'] },
      { h: 'Logging An Entry', p: ['Pick Enter Manually, then fill the row: date, staff member, shift, and hours worked, and Save Hours. Bar Cop costs it out at the wage in effect on that date, so a past-dated entry after a raise still uses the old wage, not today\'s. Salaried staff can be logged for coverage, but their hours carry no hourly cost because they are paid a fixed salary.'] },
      { h: 'Filling From The Schedule', p: ['Pick Fill from Schedule to pull a posted week in instead of typing each row. Use the week chips and arrows to choose the week, then Review and Log Week opens it. Everyone scheduled comes in checked with their hours pre-filled, and anyone with a no-show or sick call-out logged for that day is unchecked for you. Uncheck anyone else who did not work, fix any hours, then log the whole week at once. Shifts already logged are kept out of the list so nothing double-counts.'] },
      { h: 'Importing A Timeclock Export', p: ['Got a timeclock or POS export? Drop it on Close The Week in Labor, where Bar Cop matches each row to your roster by name and costs it at the wage in effect on the date worked. Anything that does not match, or is missing hours, is reported so you can fix it. The imported hours land in the list here to review and edit.'] },
      { h: 'Closed Pay Periods', p: ['Once a pay period is closed in Pay Periods, its entries lock so the payroll handoff stays clean. Reopen the period there if you need to correct a locked entry.'] }
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
