'use strict';

/* ── Labor Control — Daily View (reads lc_actuals, lc_schedules) ──────────────
   One day at a time: who worked, their hours and cost, and how the day's actual
   labor compares to what was scheduled. */

S.LaborDailyView = {
  date: null,
  DAYS: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],

  actuals()   { return ((App.laborData && App.laborData.lc_actuals) || []); },
  schedules() { return ((App.laborData && App.laborData.lc_schedules) || []); },

  dayName(dateStr) {
    const d = new Date(String(dateStr).length <= 10 ? dateStr + 'T00:00:00' : dateStr);
    return isNaN(d.getTime()) ? '' : this.DAYS[d.getDay()];
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  },
  addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return App.ymdLocal(d);
  },

  // the schedule covering a date, and that day's scheduled shifts
  scheduledForDate(dateStr) {
    const target = new Date(dateStr + 'T00:00:00').getTime();
    if (isNaN(target)) return null;
    const day = this.dayName(dateStr);
    for (const sched of this.schedules()) {
      if (!sched.week_start) continue;
      const start = new Date(sched.week_start + 'T00:00:00').getTime();
      if (isNaN(start)) continue;
      const end = start + 6 * 86400000;
      if (target >= start && target <= end) {
        return (sched.shifts || []).filter(sh => sh.day === day);
      }
    }
    return null;
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    if (this.actuals().length === 0) {
      App.setupCard(this.container, {
        title: 'Daily Snapshot',
        lead: 'Daily Snapshot shows one day at a time: who worked, their hours and cost, and how the day compared to the schedule.',
        steps: [
          { title: 'Log some hours', desc: 'Hours you log in Log Hours show up here, day by day. Log some to get started.', btn: 'Go to Log Hours', screen: 'lc-log-hours', done: false }
        ]
      });
      return;
    }
    if (!this.date) this.date = App.todayLocal();
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How Daily Snapshot Works', [
      { p: ['Daily Snapshot is one day at a time: who worked, the hours and cost they put up, and how that day stacked up against what you planned. Pick any date to jump to it.'] },
      { h: 'The Numbers Up Top', p: ['Headcount, actual hours, and actual cost are what really happened that day. Scheduled Hours is what you planned in Build Schedule, and Hours vs Scheduled is the gap, green when you came in at or under the plan, amber when you ran over.'] },
      { h: 'Fixing An Entry', p: ['Click Edit Hours on any row to correct the hours or notes right here without leaving the page. Entries in a closed pay period show as locked. Reopen the period in Pay Periods first if you need to change one.'] },
      { h: 'Export', p: ['Use Export PDF to save a clean copy of the day for a manager, a payroll handoff, or your own records.'] }
    ]);
  },

  draw() {
    const dayActuals = this.actuals().filter(a => a.date === this.date);
    const actHours = dayActuals.reduce((t, a) => t + (a.hours || 0), 0);
    // Salaried (exempt) staff accrue a fixed daily share of salary (weekly / 7),
    // but only attribute it to days the operation actually ran (something was
    // logged). On an empty or future day with nothing logged, Actual Cost stays
    // at the real hourly total instead of showing a phantom salary accrual.
    const actCost = dayActuals.reduce((t, a) => t + (a.cost || 0), 0)
      + (dayActuals.length ? App.salariedCost(this.date, this.date).total : 0);

    const sched = this.scheduledForDate(this.date);
    let schedHours = null, schedCost = null;
    if (sched) {
      schedHours = sched.reduce((t, s) => t + (s.hours || 0), 0);
      schedCost = sched.reduce((t, s) => t + (s.cost || 0), 0);
    }

    const hoursVar = schedHours != null ? actHours - schedHours : null;
    const summaryCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Headcount</div><div class="calc-val lg">' + dayActuals.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Actual Hours</div><div class="calc-val lg">' + actHours.toFixed(1) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Actual Cost</div><div class="calc-val lg">' + App.fmtCurrency(actCost) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Scheduled Hours</div><div class="calc-val lg dim">'
      + (schedHours != null ? schedHours.toFixed(1) : '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Hours vs Scheduled</div><div class="calc-val lg '
      + (hoursVar == null ? '' : hoursVar > 0 ? 'warn' : 'good') + '">'
      + (hoursVar != null ? (hoursVar > 0 ? '+' : '') + hoursVar.toFixed(1) : '-') + '</div></div>'
      + '</div></div>';

    const dateCard = '<div class="card form-card">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Daily Snapshot</span>'
      + App.helpButton('dv-how') + '</div>'
      + '<div class="form-row" style="gap:10px;margin-bottom:0;align-items:flex-end;">'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="dv-date" value="' + esc(this.date) + '"/></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><div style="display:flex;gap:6px;">'
      + '<button class="btn btn-ghost btn-sm" id="dv-prev" title="Previous day" aria-label="Previous day">&lsaquo;</button>'
      + '<button class="btn btn-ghost btn-sm" id="dv-next" title="Next day" aria-label="Next day">&rsaquo;</button></div></div>'
      + '</div></div>';

    const loggedHeading = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Logged Hours</div>'
      + '<div class="no-print" style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" id="dv-export">Export PDF</button></div></div>';

    let actualsCard;
    if (dayActuals.length === 0) {
      actualsCard = loggedHeading
        + '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No hours logged for this day. Log them in Log Hours.</div>';
    } else {
      const canEdit = App.canEdit && App.canEdit('lc-log-hours');
      const rows = [...dayActuals].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(a => {
        const locked = !!a.locked;
        const editBtn = canEdit && !locked
          ? '<button class="btn btn-ghost btn-sm dv-edit" data-id="' + a.id + '">Edit Hours</button>'
          : locked ? '<span style="font-size:9px;color:var(--gold);font-weight:700;letter-spacing:1px;">LOCKED</span>' : '';
        const sal = App.isSalaried(a.staff_id);
        const wageCell = sal ? '<span style="color:var(--t3);">Salary</span>'
          : (a.wage != null ? App.fmtCurrency(a.wage) + '/hr' : '-');
        const costCell = sal ? '<span style="color:var(--t3);">Salary</span>'
          : App.fmtCurrency(a.cost || 0);
        return '<tr><td><div class="val">' + esc(a.name || '-') + '</div></td>'
        + '<td>' + esc(a.shift_type || '-') + '</td>'
        + '<td>' + (a.hours != null ? a.hours.toFixed(1) : '-') + '</td>'
        + '<td>' + wageCell + '</td>'
        + '<td class="val">' + costCell + '</td>'
        + '<td><div class="row-actions">' + editBtn + '</div></td></tr>';
      }).join('');
      actualsCard = loggedHeading
        + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Staff</th><th>Shift</th><th>Hours</th><th>Wage</th><th>Cost</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    let schedCard = '';
    if (sched && sched.length) {
      // Who was scheduled but has no logged hours yet — the end-of-day "still
      // owed an entry" signal. Salaried staff are coverage only, so a missing
      // log for them is not an hours gap.
      const loggedKeys = new Set(dayActuals.map(a => a.staff_id || a.name));
      const notLogged = sched.filter(s => !loggedKeys.has(s.staff_id || s.name) && !App.isSalaried(s.staff_id));
      const rows = [...sched].sort((a, b) => (a.start || '').localeCompare(b.start || '')).map(s => {
        const isLogged = loggedKeys.has(s.staff_id || s.name);
        const statusCell = isLogged
          ? '<span style="color:var(--green);font-weight:700;">Logged</span>'
          : App.isSalaried(s.staff_id)
            ? '<span style="color:var(--t3);">Salary</span>'
            : '<span style="color:var(--amber);font-weight:700;">Not logged</span>';
        return '<tr><td><div class="val">' + esc(s.name || '-') + '</div></td>'
        + '<td>' + esc(s.start || '-') + '</td>'
        + '<td>' + esc(s.end || '-') + '</td>'
        + '<td>' + (s.hours != null ? s.hours.toFixed(1) : '-') + '</td>'
        + '<td class="val">' + App.fmtCurrency(s.cost || 0) + '</td>'
        + '<td>' + statusCell + '</td></tr>';
      }).join('');
      const nudge = notLogged.length
        ? '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:11px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">'
          + '<div style="font-size:12px;color:var(--t2);"><span style="color:var(--amber);font-weight:700;">' + notLogged.length + '</span> scheduled but not logged yet for this day.</div>'
          + '<button class="btn btn-ghost btn-sm" id="dv-log-missing">Log Hours</button></div>'
        : '';
      schedCard = '<div class="sh" style="margin:24px 0 10px;">Scheduled This Day</div>'
        + nudge
        + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Staff</th><th>Start</th><th>End</th><th>Hours</th><th>Cost</th><th>Status</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + dateCard + summaryCard + actualsCard + schedCard + '</div>';
    document.getElementById('dv-how')?.addEventListener('click', () => this.showHowTo());
    document.getElementById('dv-export')?.addEventListener('click', () => App.exportPDF({ title: 'Daily Snapshot', root: this.container }));
    document.getElementById('dv-date')?.addEventListener('change', e => {
      this.date = e.target.value || this.date;
      this.draw();
    });
    document.getElementById('dv-prev')?.addEventListener('click', () => { this.date = this.addDays(this.date, -1); this.draw(); });
    document.getElementById('dv-next')?.addEventListener('click', () => { this.date = this.addDays(this.date, 1); this.draw(); });
    document.getElementById('dv-log-missing')?.addEventListener('click', () => this.logMissing());
    // Inline edit on logged hours rows — opens the actuals editor in a modal
    // so the operator never leaves Daily View.
    this.container.querySelectorAll('.dv-edit').forEach(btn => {
      btn.addEventListener('click', () => this.openEditModal(btn.dataset.id));
    });
  },

  // Jump to Log Hours in Fill-from-Schedule mode for this day's week, so the
  // scheduled-but-unlogged shifts come up pre-filled to confirm in one place.
  logMissing() {
    const d = new Date(this.date + 'T00:00:00');
    if (!isNaN(d.getTime())) d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const ws = isNaN(d.getTime()) ? '' : App.ymdLocal(d);
    if (S.LaborLogHours) { S.LaborLogHours.entryMode = 'schedule'; S.LaborLogHours._fillWeek = ws; }
    App.navigate('lc-log-hours');
  },

  // ── Hours edit pop-up (standard form-card modal) ───────────────────────────
  openEditModal(actualId) {
    const a = this.actuals().find(x => x.id === actualId);
    if (!a) return;
    const wage = a.wage != null ? a.wage : (App.wageForStaffOn ? App.wageForStaffOn(a.staff_id, a.date) : 0);
    const html = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">Edit Hours' + (a.name ? ' &middot; ' + esc(a.name) : '') + '</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Hours</label>'
          + '<input type="number" id="dv-em-hours" min="0" step="0.25" value="' + (a.hours != null ? a.hours : '') + '"/></div>'
        + '<div class="f" style="flex:1;min-width:180px;"><label>Notes</label>'
          + '<input type="text" id="dv-em-notes" value="' + esc(a.notes || '') + '" placeholder="Optional"/></div>'
      + '</div>'
      + '<div id="dv-em-cost" style="font-size:11px;color:var(--t3);margin-top:8px;"></div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="dv-em-save">Save</button>'
        + '<button class="btn btn-ghost" id="dv-em-cancel">Cancel</button>'
        + '<span id="dv-em-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'dv-edit-modal', maxWidth: 540, noClose: true });

    const hoursInp = document.getElementById('dv-em-hours');
    const notesInp = document.getElementById('dv-em-notes');
    const costEl   = document.getElementById('dv-em-cost');
    const updateCost = () => {
      const h = parseFloat(hoursInp?.value) || 0;
      if (costEl) costEl.textContent = wage > 0 ? 'Cost: ' + App.fmtCurrency(h * wage) + ' (' + App.fmtCurrency(wage) + '/hr)' : '';
    };
    updateCost();
    hoursInp?.addEventListener('input', updateCost);
    document.getElementById('dv-em-cancel')?.addEventListener('click', () => App.closeModal('dv-edit-modal'));
    document.getElementById('dv-em-save')?.addEventListener('click', async () => {
      const newHours = parseFloat(hoursInp?.value);
      const err = document.getElementById('dv-em-err');
      if (isNaN(newHours) || newHours < 0) {
        if (err) { err.textContent = 'Enter the hours worked.'; err.style.display = 'inline'; }
        return;
      }
      App.closeModal('dv-edit-modal');
      await App.updateActual(a, { hours: newHours, notes: notesInp?.value || '' });
      this.draw();
    });
  }
};
