'use strict';

/* ── Labor Control — Overtime Watch (reads lc_actuals, lc_schedules) ──────────
   Forward-looking overtime risk: for a week, each staff member's logged hours
   and scheduled hours project an end-of-week total against the 40-hour overtime
   threshold, with the extra OT premium cost quantified. */

S.LaborOvertimeWatch = {
  weekStart: null,

  actuals()   { return ((App.laborData && App.laborData.lc_actuals) || []); },
  schedules() { return ((App.laborData && App.laborData.lc_schedules) || []); },
  staff()     { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },

  mondayOf(d) {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return App.ymdLocal(date);
  },
  addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return App.ymdLocal(d);
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
    this.actions = actions;
    actions.innerHTML = '';
    if (this.actuals().length === 0 && this.schedules().length === 0) {
      App.setupCard(this.container, {
        title: 'Overtime Watch',
        lead: 'Overtime Watch looks ahead at a week and flags who is heading into overtime before it happens, from the greater of logged and scheduled hours.',
        steps: [
          { title: 'Build a schedule', desc: 'Build a week in the schedule and Overtime Watch projects who is heading toward overtime. Logging hours feeds it too.', btn: 'Build Schedule', screen: 'lc-build-schedule', done: false }
        ]
      });
      return;
    }
    if (!this.weekStart) this.weekStart = this.mondayOf(new Date());
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How Overtime Watch Works', [
      { p: ['Overtime Watch looks ahead at a week and flags who is heading into overtime before it happens, so you can adjust the schedule while there is still time. Step week to week with the arrows.'] },
      { h: 'How The Projection Works', p: ['For each hourly staff member, Projected is the greater of hours already logged and hours still scheduled this week. Anything over ' + App.OT_THRESHOLD + ' hours is overtime, and Extra OT Cost is the half-time premium on those hours. Salaried staff are exempt and never appear.'] },
      { h: 'The Suggested Action', p: ['When someone is projected over, the Suggested Action column shows the exact hours to cut from their remaining shifts to clear the threshold. Open the week\'s schedule to make the change.'] },
      { h: 'Export', p: ['Export PDF saves the week\'s projection for a manager or your own records.'] }
    ]);
  },

  draw() {
    const ws = this.weekStart, we = this.addDays(ws, 6);
    const weekActuals = this.actuals().filter(a => a.date >= ws && a.date <= we);
    const sched = this.scheduleCovering(ws);

    // aggregate per staff
    const map = {};
    const ensure = (id, name) => {
      if (!map[id]) map[id] = { id, name: name || '-', actual: 0, scheduled: 0 };
      return map[id];
    };
    weekActuals.forEach(a => {
      if (App.isSalaried(a.staff_id)) return; // salaried = exempt, no overtime
      const e = ensure(a.staff_id || a.name, a.name);
      e.actual += (a.hours || 0);
    });
    if (sched) {
      (sched.shifts || []).forEach(sh => {
        if (App.isSalaried(sh.staff_id)) return; // salaried = exempt, no overtime
        const e = ensure(sh.staff_id || sh.name, sh.name);
        e.scheduled += (sh.hours || 0);
      });
    }

    const rows = Object.values(map).map(e => {
      // Wage in effect at the start of the week — covers wage changes mid-week
      const wage = App.wageForStaffOn ? App.wageForStaffOn(e.id, ws)
        : ((this.staffById(e.id) || {}).wage || (weekActuals.find(a => (a.staff_id || a.name) === e.id) || {}).wage || 0);
      const projected = Math.max(e.actual, e.scheduled);
      const otHours = Math.max(0, projected - App.OT_THRESHOLD);
      const otCost = otHours * wage * 0.5; // the OT premium (extra half-time)
      let status = 'OK';
      if (projected > App.OT_THRESHOLD) status = 'Over';
      else if (projected >= App.OT_APPROACHING) status = 'Approaching';
      // Actionable: how many hours to cut from remaining shifts to clear OT.
      // Only meaningful when projection includes future scheduled hours that
      // can actually be reduced. cutHours = projected - 40 (must cut at least
      // this many from the remaining schedule).
      const cutHours = otHours;
      return { ...e, wage, projected, otHours, otCost, status, cutHours };
    }).sort((a, b) => b.projected - a.projected);

    const over = rows.filter(r => r.status === 'Over');
    const approaching = rows.filter(r => r.status === 'Approaching');
    const totalOtHours = rows.reduce((t, r) => t + r.otHours, 0);
    const totalOtCost = rows.reduce((t, r) => t + r.otCost, 0);

    const summaryCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Projected Over OT</div><div class="calc-val lg ' + (over.length ? 'warn' : 'good') + '">' + over.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Approaching</div><div class="calc-val lg ' + (approaching.length ? 'warn' : '') + '">' + approaching.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Projected OT Hours</div><div class="calc-val lg">' + totalOtHours.toFixed(1) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Extra OT Cost</div><div class="calc-val lg ' + (totalOtCost > 0 ? 'warn' : '') + '">' + App.fmtCurrency(totalOtCost) + '</div></div>'
      + '</div></div>';

    const dateCard = '<div class="card form-card">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Overtime Watch</span>'
      + App.helpButton('ow-how') + '</div>'
      + '<div class="form-row" style="gap:10px;margin-bottom:0;align-items:flex-end;">'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Week Starting</label>'
      + '<input type="date" id="ow-start" value="' + esc(ws) + '"/></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><div style="display:flex;gap:6px;">'
      + '<button class="btn btn-ghost btn-sm" id="ow-prev" title="Previous week" aria-label="Previous week">&lsaquo;</button>'
      + '<button class="btn btn-ghost btn-sm" id="ow-next" title="Next week" aria-label="Next week">&rsaquo;</button></div></div>'
      + '</div></div>';

    let projHeading, projBody;
    if (rows.length === 0) {
      projHeading = '<div class="sh" style="margin:24px 0 10px;">Hours Projection</div>';
      projBody = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No hours this week. Log hours or build a schedule for this week and Overtime Watch will project who is heading into overtime.</div>'
        + '<div class="no-print" style="margin-top:12px;"><button class="btn btn-ghost btn-sm" id="ow-view-schedule">View Schedule for This Week</button></div>';
    } else {
      const trs = rows.map(r => {
        const badge = r.status === 'Over' ? '<span style="color:var(--red);font-weight:700;">Over</span>'
          : r.status === 'Approaching' ? '<span style="color:var(--amber);font-weight:700;">Approaching</span>'
          : '<span style="color:var(--green);font-weight:700;">OK</span>';
        // Actionable suggestion: when over OT, tell the operator the exact
        // cut needed to clear the threshold. Saves them doing the math.
        const action = r.status === 'Over'
          ? '<span style="color:var(--red);font-weight:700;">Cut ' + r.cutHours.toFixed(1) + ' hr</span>'
          : r.status === 'Approaching'
            ? '<span style="color:var(--amber);">Watch, ' + (App.OT_THRESHOLD - r.projected).toFixed(1) + ' hr to OT</span>'
            : '<span style="color:var(--t3);">-</span>';
        return '<tr>'
          + '<td><div class="val">' + esc(r.name) + '</div></td>'
          + '<td>' + r.actual.toFixed(1) + '</td>'
          + '<td>' + r.scheduled.toFixed(1) + '</td>'
          + '<td class="' + (r.status === 'Over' ? 'neg' : '') + '">' + r.projected.toFixed(1) + '</td>'
          + '<td class="' + (r.otHours > 0 ? 'neg' : '') + '">' + (r.otHours > 0 ? r.otHours.toFixed(1) : '-') + '</td>'
          + '<td class="' + (r.otCost > 0 ? 'neg' : '') + '">' + (r.otCost > 0 ? App.fmtCurrency(r.otCost) : '-') + '</td>'
          + '<td>' + badge + '</td>'
          + '<td>' + action + '</td></tr>';
      }).join('');
      projHeading = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
        + '<div class="sh" style="margin:0;">Hours Projection</div>'
        + '<div class="no-print" style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" id="ow-export">Export PDF</button></div></div>';
      projBody = '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Staff</th><th>Actual</th><th>Scheduled</th><th>Projected</th>'
        + '<th>Proj. OT Hrs</th><th>Extra OT Cost</th><th>Status</th><th>Suggested Action</th>'
        + '</tr></thead><tbody>' + trs + '</tbody></table></div></div>'
        + '<div class="no-print" style="margin-top:12px;"><button class="btn btn-ghost btn-sm" id="ow-view-schedule">View Schedule for This Week</button></div>';
    }

    this.container.innerHTML = '<div class="screen">' + dateCard + summaryCard + projHeading + projBody + '</div>';
    document.getElementById('ow-how')?.addEventListener('click', () => this.showHowTo());
    document.getElementById('ow-export')?.addEventListener('click', () => App.exportPDF({ title: 'Overtime Watch', root: this.container }));
    document.getElementById('ow-start')?.addEventListener('change', e => {
      this.weekStart = this.mondayOf(new Date(e.target.value + 'T00:00:00'));
      this.draw();
    });
    document.getElementById('ow-prev')?.addEventListener('click', () => { this.weekStart = this.addDays(this.weekStart, -7); this.draw(); });
    document.getElementById('ow-next')?.addEventListener('click', () => { this.weekStart = this.addDays(this.weekStart, 7); this.draw(); });
    document.getElementById('ow-view-schedule')?.addEventListener('click', () => App.navigate('lc-build-schedule'));
  }
};
