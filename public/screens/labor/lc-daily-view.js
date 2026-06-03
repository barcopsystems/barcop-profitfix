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
    return d.toISOString().slice(0, 10);
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
    if (!this.date) this.date = new Date().toISOString().slice(0, 10);
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How Day View Works', [
      { p: ['Day View is one day at a time: who worked, the hours and cost they put up, and how that day stacked up against what you planned. Pick any date to jump to it.'] },
      { h: 'The Numbers Up Top', p: ['Headcount, actual hours, and actual cost are what really happened that day. Scheduled Hours is what you planned in Build Schedule, and Hours vs Scheduled is the gap, green when you came in at or under the plan, amber when you ran over.'] },
      { h: 'Fixing An Entry', p: ['Click Edit Hours on any row to correct the hours or notes right here without leaving the page. Entries in a closed pay period show as locked. Reopen the period in Pay Periods first if you need to change one.'] },
      { h: 'Export', p: ['Use Export PDF to save a clean copy of the day for a manager, a payroll handoff, or your own records.'] }
    ]);
  },

  draw() {
    const dayActuals = this.actuals().filter(a => a.date === this.date);
    const actHours = dayActuals.reduce((t, a) => t + (a.hours || 0), 0);
    // Salaried (exempt) staff accrue a fixed daily share of salary (weekly / 7)
    // so the seven daily costs tie back to Weekly Summary's salaried total.
    const actCost = dayActuals.reduce((t, a) => t + (a.cost || 0), 0) + App.salariedCost(this.date, this.date).total;

    const sched = this.scheduledForDate(this.date);
    let schedHours = null, schedCost = null;
    if (sched) {
      schedHours = sched.reduce((t, s) => t + (s.hours || 0), 0);
      schedCost = sched.reduce((t, s) => t + (s.cost || 0), 0);
    }

    const hoursVar = schedHours != null ? actHours - schedHours : null;
    const summary = '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Headcount</div><div class="calc-val">' + dayActuals.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Actual Hours</div><div class="calc-val">' + actHours.toFixed(1) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Actual Cost</div><div class="calc-val">' + App.fmtCurrency(actCost) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Scheduled Hours</div><div class="calc-val dim">'
      + (schedHours != null ? schedHours.toFixed(1) : '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Hours vs Scheduled</div><div class="calc-val '
      + (hoursVar == null ? '' : hoursVar > 0 ? 'warn' : 'good') + '">'
      + (hoursVar != null ? (hoursVar > 0 ? '+' : '') + hoursVar.toFixed(1) : '-') + '</div></div>'
      + '</div>';

    const dateCard = '<div class="card">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Day View</span>'
      + App.helpButton('dv-how') + '</div>'
      + '<div class="form-row" style="gap:12px;margin-bottom:0;align-items:flex-end;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="dv-date" value="' + esc(this.date) + '"/></div>'
      + '<div style="display:flex;gap:6px;padding-bottom:2px;">'
      + '<button class="btn btn-ghost btn-sm" id="dv-prev" title="Previous day" aria-label="Previous day">&#8592;</button>'
      + '<button class="btn btn-ghost btn-sm" id="dv-next" title="Next day" aria-label="Next day">&#8594;</button>'
      + '</div>'
      + '</div>'
      + summary
      + '</div>';

    let actualsCard;
    if (dayActuals.length === 0) {
      actualsCard = '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
        + '<span>Logged Hours</span>'
        + '<button class="btn btn-ghost btn-sm" id="dv-export">Export PDF</button></div>'
        + '<div style="font-size:13px;color:var(--t3);">No hours logged for this day. Log them in Log Hours.</div></div>';
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
        const costCell = sal ? App.fmtCurrency(App.staffWeeklySalary(a.staff_id) / 7)
          : App.fmtCurrency(a.cost || 0);
        return '<tr><td><div class="val">' + esc(a.name || '-') + '</div></td>'
        + '<td>' + esc(a.shift_type || '-') + '</td>'
        + '<td>' + (a.hours != null ? a.hours.toFixed(1) : '-') + '</td>'
        + '<td>' + wageCell + '</td>'
        + '<td class="val">' + costCell + '</td>'
        + '<td>' + editBtn + '</td></tr>';
      }).join('');
      actualsCard = '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
        + '<span>Logged Hours</span>'
        + '<button class="btn btn-ghost btn-sm" id="dv-export">Export PDF</button></div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Staff</th><th>Shift</th><th>Hours</th><th>Wage</th><th>Cost</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    let schedCard = '';
    if (sched && sched.length) {
      const rows = [...sched].sort((a, b) => (a.start || '').localeCompare(b.start || '')).map(s =>
        '<tr><td><div class="val">' + esc(s.name || '-') + '</div></td>'
        + '<td>' + esc(s.start || '-') + '</td>'
        + '<td>' + esc(s.end || '-') + '</td>'
        + '<td>' + (s.hours != null ? s.hours.toFixed(1) : '-') + '</td>'
        + '<td class="val">' + App.fmtCurrency(s.cost || 0) + '</td></tr>').join('');
      schedCard = '<div class="card"><div class="card-title">Scheduled This Day</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Staff</th><th>Start</th><th>End</th><th>Hours</th><th>Cost</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + dateCard + actualsCard + schedCard + '</div>'
      + this.editModalHtml();
    document.getElementById('dv-how')?.addEventListener('click', () => this.showHowTo());
    document.getElementById('dv-export')?.addEventListener('click', () => App.exportPDF({ title: 'Daily View', root: this.container }));
    document.getElementById('dv-date')?.addEventListener('change', e => {
      this.date = e.target.value || this.date;
      this.draw();
    });
    document.getElementById('dv-prev')?.addEventListener('click', () => { this.date = this.addDays(this.date, -1); this.draw(); });
    document.getElementById('dv-next')?.addEventListener('click', () => { this.date = this.addDays(this.date, 1); this.draw(); });
    // Inline edit on logged hours rows — opens the actuals editor in a modal
    // so the operator never leaves Daily View.
    this.container.querySelectorAll('.dv-edit').forEach(btn => {
      btn.addEventListener('click', () => this.openEditModal(btn.dataset.id));
    });
  },

  // ── Inline Hours Edit Modal ────────────────────────────────────────────
  editModalHtml() {
    return '<div id="dv-edit-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;padding:20px;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:24px 28px;max-width:480px;width:100%;">'
      + '<div style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:14px;" id="dv-em-title">Edit Hours</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Hours</label>'
          + '<input type="number" id="dv-em-hours" min="0" step="0.25"/></div>'
        + '<div class="f" style="flex:1;min-width:160px;"><label>Notes</label>'
          + '<input type="text" id="dv-em-notes" placeholder="Optional"/></div>'
      + '</div>'
      + '<div id="dv-em-cost" style="font-size:11px;color:var(--t3);margin-top:6px;"></div>'
      + '<div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end;">'
        + '<button class="btn btn-ghost" id="dv-em-cancel">Cancel</button>'
        + '<button class="btn btn-primary" id="dv-em-save">Save</button>'
      + '</div></div></div>';
  },

  openEditModal(actualId) {
    const a = this.actuals().find(x => x.id === actualId);
    if (!a) return;
    const modal = document.getElementById('dv-edit-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('dv-em-title').textContent = 'Edit Hours · ' + (a.name || '');
    const hoursInp = document.getElementById('dv-em-hours');
    const notesInp = document.getElementById('dv-em-notes');
    const costEl   = document.getElementById('dv-em-cost');
    if (hoursInp) hoursInp.value = a.hours != null ? a.hours : '';
    if (notesInp) notesInp.value = a.notes || '';
    const wage = a.wage != null ? a.wage : (App.wageForStaffOn ? App.wageForStaffOn(a.staff_id, a.date) : 0);
    const updateCost = () => {
      const h = parseFloat(hoursInp?.value) || 0;
      if (costEl) costEl.textContent = wage > 0 ? 'Cost: ' + App.fmtCurrency(h * wage) + ' (' + App.fmtCurrency(wage) + '/hr)' : '';
    };
    updateCost();
    hoursInp?.addEventListener('input', updateCost);
    document.getElementById('dv-em-cancel').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('dv-em-save').onclick = async () => {
      const newHours = parseFloat(hoursInp?.value);
      if (isNaN(newHours) || newHours < 0) return;
      modal.style.display = 'none';
      await App.updateActual(a, { hours: newHours, notes: notesInp?.value || '' });
      this.draw();
    };
  }
};
