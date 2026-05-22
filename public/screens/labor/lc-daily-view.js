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
    if (!str) return '—';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
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
    actions.innerHTML = '';
    if (!this.date) this.date = new Date().toISOString().slice(0, 10);
    this.draw();
  },

  draw() {
    const dayActuals = this.actuals().filter(a => a.date === this.date);
    const actHours = dayActuals.reduce((t, a) => t + (a.hours || 0), 0);
    const actCost = dayActuals.reduce((t, a) => t + (a.cost || 0), 0);

    const sched = this.scheduledForDate(this.date);
    let schedHours = null, schedCost = null;
    if (sched) {
      schedHours = sched.reduce((t, s) => t + (s.hours || 0), 0);
      schedCost = sched.reduce((t, s) => t + (s.cost || 0), 0);
    }

    const dateCard = '<div class="card"><div class="card-title">Day</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;align-items:center;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="dv-date" value="' + esc(this.date) + '"/></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<div style="font-size:13px;color:var(--t2);padding-bottom:8px;">' + esc(this.fmtDate(this.date)) + '</div></div>'
      + '</div></div>';

    const hoursVar = schedHours != null ? actHours - schedHours : null;
    const summary = '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Headcount</div><div class="calc-val">' + dayActuals.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Actual Hours</div><div class="calc-val">' + actHours.toFixed(1) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Actual Cost</div><div class="calc-val">' + App.fmtCurrency(actCost) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Scheduled Hours</div><div class="calc-val dim">'
      + (schedHours != null ? schedHours.toFixed(1) : '—') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Hours vs Scheduled</div><div class="calc-val '
      + (hoursVar == null ? '' : hoursVar > 0 ? 'warn' : 'good') + '">'
      + (hoursVar != null ? (hoursVar > 0 ? '+' : '') + hoursVar.toFixed(1) : '—') + '</div></div>'
      + '</div>';

    let actualsCard;
    if (dayActuals.length === 0) {
      actualsCard = '<div class="card"><div class="card-title">Logged Hours</div>'
        + '<div style="font-size:13px;color:var(--t3);">No hours logged for this day. Log them in Log Hours.</div></div>';
    } else {
      const rows = [...dayActuals].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(a =>
        '<tr><td><div class="val">' + esc(a.name || '—') + '</div></td>'
        + '<td>' + esc(a.shift_type || '—') + '</td>'
        + '<td>' + (a.hours != null ? a.hours.toFixed(1) : '—') + '</td>'
        + '<td>' + (a.wage != null ? App.fmtCurrency(a.wage) + '/hr' : '—') + '</td>'
        + '<td class="val">' + App.fmtCurrency(a.cost || 0) + '</td></tr>').join('');
      actualsCard = '<div class="card"><div class="card-title">Logged Hours</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Staff</th><th>Shift</th><th>Hours</th><th>Wage</th><th>Cost</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    let schedCard = '';
    if (sched && sched.length) {
      const rows = [...sched].sort((a, b) => (a.start || '').localeCompare(b.start || '')).map(s =>
        '<tr><td><div class="val">' + esc(s.name || '—') + '</div></td>'
        + '<td>' + esc(s.start || '—') + '</td>'
        + '<td>' + esc(s.end || '—') + '</td>'
        + '<td>' + (s.hours != null ? s.hours.toFixed(1) : '—') + '</td>'
        + '<td class="val">' + App.fmtCurrency(s.cost || 0) + '</td></tr>').join('');
      schedCard = '<div class="card"><div class="card-title">Scheduled This Day</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Staff</th><th>Start</th><th>End</th><th>Hours</th><th>Cost</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + dateCard + summary + actualsCard + schedCard + '</div>';
    document.getElementById('dv-date')?.addEventListener('change', e => {
      this.date = e.target.value || this.date;
      this.draw();
    });
  }
};
