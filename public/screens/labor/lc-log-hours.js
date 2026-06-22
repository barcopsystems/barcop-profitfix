'use strict';

/* ── Labor Control — Log Hours (writes lc_actuals) ────────────────────────────
   Records actual hours worked, by hand or by importing a timeclock CSV/Excel
   export through the shared csv-mapper component. lc_actuals feeds Revenue and
   Profit Recovery weekly labor, prime cost, and This Week's RPLH.

   Landing = inline Log Hours form + an Import card + the logged-hours list.
   Editing a row opens it in a focused pop-up. */

S.LaborLogHours = {
  editId: null,
  entryMode: 'manual',     // 'manual' = type a row, 'schedule' = pull the posted week, 'import' = drop a timeclock file
  _modeOnce: null,         // one-shot mode override from a deep-link, consumed on the next render
  _fillWeek: '',           // Monday of the week being pulled from the schedule
  _fillModel: null,        // in-memory Fill-from-Schedule rows (survive day-tab switches)
  _fillTab: null,          // active day tab (Mon-first index) in Fill from Schedule
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
  // Day-block header for the Fill-from-Schedule table ("Monday, Jun 9").
  fmtDayHeader(str) {
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
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
  shiftFillWeek(n) {
    const base = this._fillWeek || this.latestScheduleWeek() || this.mondayOf(App.todayLocal());
    const d = new Date(base + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    d.setDate(d.getDate() + n);
    this._fillWeek = this.mondayOf(App.ymdLocal(d));
    this._fillTab = null;
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
    if (this._modeOnce) { this.entryMode = this._modeOnce; this._modeOnce = null; this._fillTab = null; }
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
        + (on ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    };
    // Primary action lives BELOW the card (bottom-left), collapse-group tagged so
    // it hides with the card. The card body is just the entry surface per mode.
    let modeBody, actionRow;
    const rowOpen = '<div data-collapse-group="lc-log-hours" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">';
    if (this.entryMode === 'import') {
      modeBody = '<div id="lo-csv"></div><div id="lo-imp-result"></div>';
      // Empty until a file is dropped; CSVMapper then renders its own spaced
      // Import / Cancel row here (below the card), so no empty gap beforehand.
      actionRow = '<div id="lo-imp-actions" data-collapse-group="lc-log-hours" style="margin-bottom:24px;"></div>';
    } else if (this.entryMode === 'schedule') {
      modeBody = this.scheduleFillBody();
      const total = this.fillToLog().length;
      actionRow = rowOpen
        + '<button class="btn btn-primary" id="lo-fill-save"' + (total ? '' : ' disabled') + '>Log ' + total + ' Entr' + (total === 1 ? 'y' : 'ies') + '</button>'
        + '<button class="btn btn-ghost" id="lo-fill-reset">Start Over</button>'
        + '<span id="lo-fill-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div>';
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
      + '<div class="seg-toggle">' + segBtn('manual', 'Enter Manually') + segBtn('schedule', 'Fill from Schedule') + segBtn('import', 'Import File') + '</div>'
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
        listHtml = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No hours logged in this range. Pick a wider range above.</div>';
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
      if (ev.target.closest('#lo-fill-save')) { this.commitFill(); return; }
      if (ev.target.closest('#lo-fill-reset')) { this._fillModel = null; this._fillTab = null; this.renderList(); return; }
      if (ev.target.closest('.lo-go-build')) { App.navigate('lc-build-schedule'); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row  = ev.target.closest('.lo-row');
      const edit = ev.target.closest('.lo-edit');
      const del  = ev.target.closest('.lo-del');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.openEditModal(edit.dataset.id); }
      else if (row && App.canEdit('lc-log-hours')) this.openEditModal(row.dataset.id);
    };
    if (this.entryMode === 'import') this.mountImporter();
    else if (this.entryMode === 'schedule') {
      document.getElementById('lo-fill-prev')?.addEventListener('click', () => this.shiftFillWeek(-7));
      document.getElementById('lo-fill-next')?.addEventListener('click', () => this.shiftFillWeek(7));
      this.container.querySelectorAll('.lo-fill-week-chip').forEach(b => b.addEventListener('click', () => {
        const ws = b.dataset.ws;
        if (!ws || ws === this._fillWeek) return;
        this._fillWeek = ws; this._fillTab = null; this.renderList();
      }));
      document.getElementById('lo-fill-now')?.addEventListener('click', () => {
        const ws = this.mondayOf(App.todayLocal());
        if (ws === this._fillWeek) return;
        this._fillWeek = ws; this._fillTab = null; this.renderList();
      });
      this.container.querySelectorAll('.lo-fill-tab').forEach(b => b.addEventListener('click', () => { this.captureFill(); this._fillTab = parseInt(b.dataset.day, 10); this.renderList(); }));
      const tbl = document.getElementById('lo-fill-body');
      if (tbl) tbl.addEventListener('change', () => this.updateFillCount());
      if (tbl) tbl.addEventListener('input', () => this.updateFillCount());
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
  // Seed editable actuals rows from the posted schedule for a week, on per-day TABS
  // so a long week never blurs into one list. The operator edits the few that ran
  // different and unchecks no-shows on each day's tab, then logs the whole week at
  // once. Edits + checkboxes live in an in-memory model (this._fillModel) so they
  // survive tab switches (only the active day's rows are in the DOM). Pre-filled
  // hours are scheduled-as-actual until confirmed; already-logged days are skipped.
  ensureFillModel(ws) {
    if (!this._fillModel || this._fillModel.ws !== ws) this.buildFillModel(ws);
  },
  buildFillModel(ws) {
    const DAYS = App.DAYS_MON_FIRST || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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
        rows.push({
          staff_id: sh.staff_id, name: sh.name || (staff ? staff.name : '-'),
          date, dayIdx: di, start: sh.start || '', end: sh.end || '',
          hours: (sh.hours != null ? String(sh.hours) : ''),
          checked: !already, already
        });
      });
    }
    rows.sort((a, b) => (a.dayIdx - b.dayIdx) || (a.name || '').localeCompare(b.name || ''));
    rows.forEach((r, idx) => { r.i = idx; });
    this._fillModel = { ws, rows };
  },
  // Read the visible day's checkbox + hours back into the model so edits survive a
  // tab switch or commit (only the active day is in the DOM at any time).
  captureFill() {
    if (!this._fillModel) return;
    document.querySelectorAll('#lo-fill-body .lo-fill-row').forEach(tr => {
      const r = this._fillModel.rows[parseInt(tr.dataset.mi, 10)];
      if (!r || r.already) return;
      const cb = tr.querySelector('.lo-fill-cb');
      const h = tr.querySelector('.lo-fill-hours');
      if (cb) r.checked = cb.checked;
      if (h) r.hours = h.value;
    });
  },
  fillToLog() {
    return (this._fillModel ? this._fillModel.rows : []).filter(r => !r.already && r.checked && parseFloat(r.hours) > 0);
  },

  // Compact week label for the fill week chips ("Jun 9").
  weekLabel(ws) {
    const d = new Date((ws || '') + 'T00:00:00');
    return isNaN(d.getTime()) ? esc(ws || '') : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },
  // Monday-based week selector for Fill from Schedule (mirrors Build Schedule):
  // a window of week chips by Monday date (live week tagged NOW, selected
  // gold-tint) + step arrows + a snap to the current week. No calendar to hunt a
  // Monday in.
  fillWeekSelector(ws) {
    const cur = this.mondayOf(App.todayLocal());
    const step = (base, n) => {
      const d = new Date((base || cur) + 'T00:00:00');
      if (isNaN(d.getTime())) return base;
      d.setDate(d.getDate() + n * 7);
      return this.mondayOf(App.ymdLocal(d));
    };
    const chip = w => {
      const on = w === ws, isCur = w === cur;
      return '<button type="button" class="lo-fill-week-chip btn btn-sm" data-ws="' + w + '" style="'
        + (on ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">'
        + App.dateRangeLabel(w, App.periodEndFor(w))
        + (isCur ? ' <span style="font-size:8px;font-weight:700;letter-spacing:1px;color:var(--gold);">NOW</span>' : '')
        + '</button>';
    };
    let chips = '';
    for (let i = -1; i <= 0; i++) chips += chip(step(ws, i));
    return '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:14px;">'
      + '<button type="button" class="btn btn-ghost btn-sm" id="lo-fill-prev" title="Previous week" aria-label="Previous week">&lsaquo;</button>'
      + chips
      + '<button type="button" class="btn btn-ghost btn-sm" id="lo-fill-next" title="Next week" aria-label="Next week">&rsaquo;</button>'
      + (ws !== cur ? '<button type="button" class="btn btn-ghost btn-sm" id="lo-fill-now" style="margin-left:4px;">This Week</button>' : '')
      + '</div>';
  },

  scheduleFillBody() {
    const DAYS = App.DAYS_MON_FIRST || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const ws = this._fillWeek || this.latestScheduleWeek() || this.mondayOf(App.todayLocal());
    this._fillWeek = ws;
    const picker = this.fillWeekSelector(ws);
    this.ensureFillModel(ws);
    const model = this._fillModel;
    if (!model.rows.length) {
      return picker + '<div style="font-size:12px;color:var(--t3);padding:6px 2px;">No posted schedule for this week. '
        + '<span class="lo-go-build" style="color:var(--gold);cursor:pointer;text-decoration:underline;">Build the schedule</span> first, or pick another week.</div>';
    }
    // One tab per day that has shifts; the badge is that day's not-yet-logged count.
    const presentDays = [...new Set(model.rows.map(r => r.dayIdx))].sort((a, b) => a - b);
    if (this._fillTab == null || presentDays.indexOf(this._fillTab) < 0) this._fillTab = presentDays[0];
    const tabs = '<div class="ch-tabs no-print">' + presentDays.map(di => {
      const unlogged = model.rows.filter(r => r.dayIdx === di && !r.already).length;
      return '<button class="ch-tab lo-fill-tab' + (di === this._fillTab ? ' on' : '') + '" data-day="' + di + '">'
        + (DAYS[di] || '') + (unlogged ? ' <span style="color:var(--t3);font-weight:400;font-size:9px;letter-spacing:0;">(' + unlogged + ' to log)</span>' : '')
        + '</button>';
    }).join('') + '</div>';

    const trs = model.rows.filter(r => r.dayIdx === this._fillTab).map(r => {
      const time = (r.start && r.end)
        ? '<span style="color:var(--t3);font-size:11px;">' + esc(this.fmtTime(r.start)) + '&ndash;' + esc(this.fmtTime(r.end)) + '</span>'
        : '';
      return '<tr class="lo-fill-row" data-mi="' + r.i + '">'
        + '<td style="width:36px;text-align:center;"><input type="checkbox" class="lo-fill-cb"' + (r.already ? ' disabled' : (r.checked ? ' checked' : '')) + ' style="accent-color:var(--gold);width:16px;height:16px;cursor:pointer;margin:0;"/></td>'
        + '<td><div class="val">' + esc(r.name) + '</div></td>'
        + '<td>' + time + '</td>'
        + '<td><input type="number" class="lo-fill-hours form-input" min="0" step="0.25" value="' + esc(r.hours) + '"' + (r.already ? ' disabled' : '') + ' style="width:80px;"/></td>'
        + '<td>' + (r.already ? '<span style="color:var(--t3);font-size:11px;">Already logged</span>' : '') + '</td>'
        + '</tr>';
    }).join('');
    const dayLabel = this.fmtDayHeader(this.weekDayYmd(ws, this._fillTab));

    return picker
      + tabs
      + '<div style="font-size:11px;color:var(--t3);margin:2px 0 10px;">' + esc(dayLabel) + '</div>'
      + '<div class="card" style="padding:0;overflow:hidden;margin-bottom:12px;"><table class="ing-tbl" style="table-layout:fixed;"><thead><tr>'
      + '<th style="width:36px;"></th><th>Staff</th><th style="width:150px;">Shift</th><th style="width:90px;">Hours</th><th style="width:120px;"></th>'
      + '</tr></thead><tbody id="lo-fill-body">' + trs + '</tbody></table></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:0;">Pre-filled from the schedule. Edit or uncheck, then log. Covers every checked day, not just this tab.</div>';
  },

  updateFillCount() {
    this.captureFill();
    const n = this.fillToLog().length;
    const btn = document.getElementById('lo-fill-save');
    if (btn) { btn.disabled = n === 0; btn.textContent = 'Log ' + n + ' Entr' + (n === 1 ? 'y' : 'ies'); }
  },

  async commitFill() {
    this.captureFill();
    const err = document.getElementById('lo-fill-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const recs = [];
    this.fillToLog().forEach(r => {
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
    const btn = document.getElementById('lo-fill-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Logging...'; }
    let ok = true;
    for (const rec of recs) { this.actuals().push(rec); ok = (await App.putRecord('lc', 'actual', rec)) && ok; }
    if (ok) {
      App.markSetupDone('gs_lc_hours');
      this._fillModel = null;   // rebuild so the just-logged rows flip to "Already logged"
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; this.updateFillCount(); }
      fail('Save failed. Try again.');
    }
  },

  // ── How This Works ──────────────────────────────────────────────────────────
  showHowTo() {
    App.showHelpModal('How Logging Hours Works', [
      { p: ['This is where actual hours worked get recorded. Logged hours feed your weekly labor cost, prime cost, and revenue per labor hour across Profit and Revenue Recovery, so what you enter here drives the numbers everywhere else.'] },
      { h: 'Logging An Entry', p: ['Pick Enter Manually, then fill the row: date, staff member, shift, and hours worked, and Save Hours. Bar Cop costs it out at the wage in effect on that date, so a past-dated entry after a raise still uses the old wage, not today\'s. Salaried staff can be logged for coverage, but their hours carry no hourly cost because they are paid a fixed salary.'] },
      { h: 'Filling From The Schedule', p: ['Pick Fill from Schedule to pull a posted week in instead of typing each row. Use the week chips and arrows to choose the week; each day with shifts becomes a tab showing who was scheduled with their hours pre-filled. Edit anything that ran different, uncheck a no-show, then Log the whole week at once. Days already logged are flagged and skipped so nothing double-counts.'] },
      { h: 'Importing From A Timeclock', p: ['Switch to Import File and drop a timeclock or POS export, CSV or Excel. Map the columns once and Bar Cop remembers it. Staff Name, Date, and Hours are required; Shift is optional. Your headers do not need to match exactly: Staff Name reads employee / name / staff, Date reads date / work date / shift date, Hours reads hours / total hours / hrs / worked.'] },
      { h: 'Matching To Your Roster', p: ['Each imported row is matched to a staff member by name and costs out at the wage in effect on the date worked. A row that does not match anyone on the roster, or is missing hours, is skipped and reported so you can fix it.'] },
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

  // ── CSV import (drag-drop + column mapping, mounted in the Import card) ───────
  mountImporter() {
    const el = document.getElementById('lo-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your timeclock export here',
      dropSub: 'Needs columns for staff name, date, and hours worked.',
      actionsEl: '#lo-imp-actions',
      fields: PosIngest.FIELDS.hours,
      confirmLabel: 'Import',
      onComplete: rows => this.importRows(rows)
    });
  },

  async importRows(rows) {
    // Match / dedup / build / save all live in the shared PosIngest so this lane
    // and the unified Import screen never drift; the UI message stays here.
    const { toAdd, skipped, dupCount } = PosIngest.build('hours', rows);

    const result = document.getElementById('lo-imp-result');
    const imported = toAdd.length;
    if (imported === 0) {
      if (result) result.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + (dupCount ? 'No new rows imported. ' + dupCount + ' row' + (dupCount === 1 ? ' was' : 's were') + ' already logged.'
                    : 'No rows imported. No staff names matched the roster, or hours were missing.') + '</div>';
      return;
    }
    const ok = await PosIngest.commit('hours', toAdd);
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
          + ' row' + (skipped.length === 1 ? '' : 's') + ' skipped (no roster match or missing hours).</span>' : '')
      + (dupCount ? ' <span style="color:var(--t3);font-weight:400;">' + dupCount
          + ' already logged, skipped.</span>' : '') + '</div>';
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
