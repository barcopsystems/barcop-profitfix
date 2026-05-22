'use strict';

/* ── Labor Control — Overtime Watch (reads lc_actuals, lc_schedules) ──────────
   Forward-looking overtime risk: for a week, each staff member's logged hours
   and scheduled hours project an end-of-week total against the 40-hour overtime
   threshold, with the extra OT premium cost quantified. */

S.LaborOvertimeWatch = {
  weekStart: null,
  OT_THRESHOLD: 40,
  APPROACHING: 35,

  actuals()   { return ((App.laborData && App.laborData.lc_actuals) || []); },
  schedules() { return ((App.laborData && App.laborData.lc_schedules) || []); },
  staff()     { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },

  mondayOf(d) {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return date.toISOString().slice(0, 10);
  },
  addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  },
  fmtDate(str) {
    const d = new Date(str + 'T00:00:00');
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    const ws = this.weekStart, we = this.addDays(ws, 6);
    const weekActuals = this.actuals().filter(a => a.date >= ws && a.date <= we);
    const sched = this.scheduleCovering(ws);

    // aggregate per staff
    const map = {};
    const ensure = (id, name) => {
      if (!map[id]) map[id] = { id, name: name || '—', actual: 0, scheduled: 0 };
      return map[id];
    };
    weekActuals.forEach(a => {
      const e = ensure(a.staff_id || a.name, a.name);
      e.actual += (a.hours || 0);
    });
    if (sched) {
      (sched.shifts || []).forEach(sh => {
        const e = ensure(sh.staff_id || sh.name, sh.name);
        e.scheduled += (sh.hours || 0);
      });
    }

    const rows = Object.values(map).map(e => {
      const staff = this.staffById(e.id);
      const wage = staff && staff.wage != null ? staff.wage
        : (weekActuals.find(a => (a.staff_id || a.name) === e.id) || {}).wage || 0;
      const projected = Math.max(e.actual, e.scheduled);
      const otHours = Math.max(0, projected - this.OT_THRESHOLD);
      const otCost = otHours * wage * 0.5; // the OT premium (extra half-time)
      let status = 'OK';
      if (projected > this.OT_THRESHOLD) status = 'Over';
      else if (projected >= this.APPROACHING) status = 'Approaching';
      return { ...e, wage, projected, otHours, otCost, status };
    }).sort((a, b) => b.projected - a.projected);

    const over = rows.filter(r => r.status === 'Over');
    const approaching = rows.filter(r => r.status === 'Approaching');
    const totalOtHours = rows.reduce((t, r) => t + r.otHours, 0);
    const totalOtCost = rows.reduce((t, r) => t + r.otCost, 0);

    const dateCard = '<div class="card"><div class="card-title">Week</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;align-items:center;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Week Starting</label>'
      + '<input type="date" id="ow-start" value="' + esc(ws) + '"/></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<div style="font-size:13px;color:var(--t2);padding-bottom:8px;">' + this.fmtDate(ws) + ' – ' + this.fmtDate(we) + '</div></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<button class="btn btn-ghost" id="ow-prev" style="margin-bottom:2px;">&#8592; Prev</button></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<button class="btn btn-ghost" id="ow-next" style="margin-bottom:2px;">Next &#8594;</button></div>'
      + '</div></div>';

    const summary = '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Projected Over OT</div><div class="calc-val ' + (over.length ? 'warn' : 'good') + '">' + over.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Approaching</div><div class="calc-val ' + (approaching.length ? 'warn' : '') + '">' + approaching.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Projected OT Hours</div><div class="calc-val">' + totalOtHours.toFixed(1) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Extra OT Cost</div><div class="calc-val ' + (totalOtCost > 0 ? 'warn' : '') + '">' + App.fmtCurrency(totalOtCost) + '</div></div>'
      + '</div>';

    let table;
    if (rows.length === 0) {
      table = '<div class="empty"><div class="empty-title">No hours this week</div>'
        + '<div class="empty-sub">Log hours or build a schedule for this week and Overtime Watch will '
        + 'project who is heading into overtime.</div></div>';
    } else {
      const trs = rows.map(r => {
        const badge = r.status === 'Over' ? '<span class="badge badge-warn">Over</span>'
          : r.status === 'Approaching' ? '<span class="badge badge-warn">Approaching</span>'
          : '<span class="badge badge-ok">OK</span>';
        return '<tr>'
          + '<td><div class="val">' + esc(r.name) + '</div></td>'
          + '<td>' + r.actual.toFixed(1) + '</td>'
          + '<td>' + r.scheduled.toFixed(1) + '</td>'
          + '<td class="' + (r.status === 'Over' ? 'neg' : '') + '">' + r.projected.toFixed(1) + '</td>'
          + '<td class="' + (r.otHours > 0 ? 'neg' : '') + '">' + (r.otHours > 0 ? r.otHours.toFixed(1) : '—') + '</td>'
          + '<td class="' + (r.otCost > 0 ? 'neg' : '') + '">' + (r.otCost > 0 ? App.fmtCurrency(r.otCost) : '—') + '</td>'
          + '<td>' + badge + '</td></tr>';
      }).join('');
      table = '<div class="card"><div class="card-title">Hours Projection</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Staff</th><th>Actual</th><th>Scheduled</th><th>Projected</th>'
        + '<th>Proj. OT Hrs</th><th>Extra OT Cost</th><th>Status</th>'
        + '</tr></thead><tbody>' + trs + '</tbody></table></div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">'
        + 'Projected is the greater of hours logged and hours scheduled. Overtime threshold ' + this.OT_THRESHOLD
        + ' hrs/week; extra OT cost is the half-time premium on projected overtime hours.</div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + dateCard + summary + table + '</div>';
    document.getElementById('ow-start')?.addEventListener('change', e => {
      this.weekStart = this.mondayOf(new Date(e.target.value + 'T00:00:00'));
      this.draw();
    });
    document.getElementById('ow-prev')?.addEventListener('click', () => { this.weekStart = this.addDays(this.weekStart, -7); this.draw(); });
    document.getElementById('ow-next')?.addEventListener('click', () => { this.weekStart = this.addDays(this.weekStart, 7); this.draw(); });
  }
};
