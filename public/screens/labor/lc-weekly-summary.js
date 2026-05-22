'use strict';

/* ── Labor Control — Weekly Summary (reads lc_actuals, lc_schedules) ──────────
   A one-week labor rollup: actual hours and cost versus what was scheduled,
   broken down by staff and by day, with labor % against the week's forecast. */

S.LaborWeeklySummary = {
  weekStart: null,

  actuals()   { return ((App.laborData && App.laborData.lc_actuals) || []); },
  schedules() { return ((App.laborData && App.laborData.lc_schedules) || []); },
  laborTarget() { return (S.LaborBuildSchedule && S.LaborBuildSchedule.laborTarget()) || 29; },

  mondayOf(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    date.setDate(date.getDate() + diff);
    return date.toISOString().slice(0, 10);
  },
  addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  },
  fmtDay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  },
  fmtDate(str) {
    const d = new Date(str + 'T00:00:00');
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  scheduleCovering(dateStr) {
    const target = new Date(dateStr + 'T00:00:00').getTime();
    if (isNaN(target)) return null;
    for (const s of this.schedules()) {
      if (!s.week_start) continue;
      const start = new Date(s.week_start + 'T00:00:00').getTime();
      if (isNaN(start)) continue;
      if (target >= start && target <= start + 6 * 86400000) return s;
    }
    return null;
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    if (!this.weekStart) this.weekStart = this.mondayOf(new Date());
    this.draw();
  },

  draw() {
    const ws = this.weekStart;
    const we = this.addDays(ws, 6);
    const weekActuals = this.actuals().filter(a => a.date >= ws && a.date <= we);
    const actHours = weekActuals.reduce((t, a) => t + (a.hours || 0), 0);
    const actCost = weekActuals.reduce((t, a) => t + (a.cost || 0), 0);

    const sched = this.scheduleCovering(ws);
    const schedHours = sched ? (sched.total_hours || 0) : null;
    const schedCost = sched ? (sched.total_cost || 0) : null;
    const forecast = sched ? (sched.revenue_forecast || 0) : 0;
    const laborPct = forecast > 0 ? actCost / forecast * 100 : null;
    const rplh = actHours > 0 && forecast > 0 ? forecast / actHours : null;
    const target = this.laborTarget();

    const dateCard = '<div class="card"><div class="card-title">Week</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;align-items:center;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Week Starting</label>'
      + '<input type="date" id="ws-start" value="' + esc(ws) + '"/></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<div style="font-size:13px;color:var(--t2);padding-bottom:8px;">' + this.fmtDate(ws) + ' – ' + this.fmtDate(we) + '</div></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<button class="btn btn-ghost" id="ws-prev" style="margin-bottom:2px;">&#8592; Prev</button></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<button class="btn btn-ghost" id="ws-next" style="margin-bottom:2px;">Next &#8594;</button></div>'
      + '</div></div>';

    const hoursVar = schedHours != null ? actHours - schedHours : null;
    const summary = '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Actual Hours</div><div class="calc-val">' + actHours.toFixed(1) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Actual Labor Cost</div><div class="calc-val">' + App.fmtCurrency(actCost) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Scheduled Hours</div><div class="calc-val dim">'
      + (schedHours != null ? schedHours.toFixed(1) : '—') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Hours vs Scheduled</div><div class="calc-val '
      + (hoursVar == null ? '' : hoursVar > 0 ? 'warn' : 'good') + '">'
      + (hoursVar != null ? (hoursVar > 0 ? '+' : '') + hoursVar.toFixed(1) : '—') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor %</div><div class="calc-val '
      + (laborPct == null ? '' : laborPct > target ? 'warn' : 'good') + '">'
      + (laborPct != null ? App.fmtPct(laborPct) : '—') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">RPLH</div><div class="calc-val">'
      + (rplh != null ? App.fmtCurrency(rplh) : '—') + '</div></div>'
      + '</div>';

    // By staff
    const byStaff = {};
    weekActuals.forEach(a => {
      const k = a.staff_id || a.name || '?';
      if (!byStaff[k]) byStaff[k] = { name: a.name || '—', days: {}, hours: 0, cost: 0 };
      byStaff[k].days[a.date] = true;
      byStaff[k].hours += (a.hours || 0);
      byStaff[k].cost += (a.cost || 0);
    });
    let staffCard;
    const staffKeys = Object.keys(byStaff);
    if (staffKeys.length === 0) {
      staffCard = '<div class="card"><div class="card-title">By Staff</div>'
        + '<div style="font-size:13px;color:var(--t3);">No hours logged for this week.</div></div>';
    } else {
      const rows = staffKeys.sort((a, b) => byStaff[b].cost - byStaff[a].cost).map(k => {
        const s = byStaff[k];
        return '<tr><td><div class="val">' + esc(s.name) + '</div></td>'
          + '<td>' + Object.keys(s.days).length + '</td>'
          + '<td>' + s.hours.toFixed(1) + '</td>'
          + '<td class="val">' + App.fmtCurrency(s.cost) + '</td></tr>';
      }).join('');
      staffCard = '<div class="card"><div class="card-title">By Staff</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Staff</th><th>Days</th><th>Hours</th><th>Cost</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    // By day
    const dayRows = [];
    for (let i = 0; i < 7; i++) {
      const dStr = this.addDays(ws, i);
      const dayAct = weekActuals.filter(a => a.date === dStr);
      const h = dayAct.reduce((t, a) => t + (a.hours || 0), 0);
      const c = dayAct.reduce((t, a) => t + (a.cost || 0), 0);
      dayRows.push('<tr><td><div class="val">' + this.fmtDay(dStr) + '</div></td>'
        + '<td>' + dayAct.length + '</td>'
        + '<td>' + h.toFixed(1) + '</td>'
        + '<td class="val">' + App.fmtCurrency(c) + '</td></tr>');
    }
    const dayCard = '<div class="card"><div class="card-title">By Day</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Day</th><th>Headcount</th><th>Hours</th><th>Cost</th>'
      + '</tr></thead><tbody>' + dayRows.join('') + '</tbody></table></div></div>';

    this.container.innerHTML = '<div class="screen">' + dateCard + summary + staffCard + dayCard + '</div>';

    document.getElementById('ws-start')?.addEventListener('change', e => {
      this.weekStart = this.mondayOf(new Date(e.target.value + 'T00:00:00'));
      this.draw();
    });
    document.getElementById('ws-prev')?.addEventListener('click', () => {
      this.weekStart = this.addDays(this.weekStart, -7);
      this.draw();
    });
    document.getElementById('ws-next')?.addEventListener('click', () => {
      this.weekStart = this.addDays(this.weekStart, 7);
      this.draw();
    });
  }
};
