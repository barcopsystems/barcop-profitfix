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
    this.actions = actions;
    actions.innerHTML = '';
    if (this.actuals().length === 0) {
      App.setupCard(this.container, {
        title: 'Weekly Summary',
        lead: 'Weekly Summary rolls up a full week of labor: hours and cost by staff and by day, with labor percentage against your forecast.',
        steps: [
          { title: 'Log some hours', desc: 'Hours you log in Log Hours feed this weekly rollup. Log some to get started.', btn: 'Go to Log Hours', screen: 'lc-log-hours', done: false }
        ]
      });
      return;
    }
    if (!this.weekStart) this.weekStart = this.mondayOf(new Date());
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How Weekly Summary Works', [
      { p: ['Weekly Summary rolls up a full week of labor: total hours and cost, how that compares to what you scheduled, and your labor percentage against the week\'s revenue forecast. Use the arrows to step week to week, or pick a date.'] },
      { h: 'The Numbers Up Top', p: ['Actual Hours and Actual Labor Cost are what really happened. Scheduled Hours and Hours vs Scheduled compare it to your plan from Build Schedule. Labor % is your labor cost as a share of the forecast, green at or under your target, amber over it. RPLH is revenue per labor hour against that same forecast.'] },
      { h: 'By Staff And By Day', p: ['By Staff shows each person\'s days worked, hours, and cost for the week, sorted by who cost the most. By Day breaks the week into seven days so you can see where the hours stacked up. Salaried staff carry a fixed weekly share of their salary, so they show a cost even on a light week.'] },
      { h: 'Fixing Hours', p: ['Click Edit Hours on a staff row to correct that person\'s whole week at once, without leaving the page. Entries in a closed pay period show as locked; reopen the period in Pay Periods first.'] },
      { h: 'Export', p: ['Use Export PDF to save the week for a manager, a payroll handoff, or your own records.'] }
    ]);
  },

  draw() {
    const ws = this.weekStart;
    const we = this.addDays(ws, 6);
    const weekActuals = this.actuals().filter(a => a.date >= ws && a.date <= we);
    const actHours = weekActuals.reduce((t, a) => t + (a.hours || 0), 0);
    const salWk = App.salariedCost(ws, we);
    const actCost = weekActuals.reduce((t, a) => t + (a.cost || 0), 0) + salWk.total;

    const sched = this.scheduleCovering(ws);
    const schedHours = sched ? (sched.total_hours || 0) : null;
    const schedCost = sched ? (sched.total_cost || 0) : null;
    const forecast = sched ? (sched.revenue_forecast || 0) : 0;
    const laborPct = forecast > 0 ? actCost / forecast * 100 : null;
    const rplh = actHours > 0 && forecast > 0 ? forecast / actHours : null;
    const target = this.laborTarget();

    const hoursVar = schedHours != null ? actHours - schedHours : null;
    const summary = '<div class="calc" style="margin-top:14px;margin-bottom:0;flex-wrap:nowrap;gap:18px;overflow-x:auto;">'
      + '<div class="calc-item"><div class="calc-label">Actual Hours</div><div class="calc-val">' + actHours.toFixed(1) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Actual Labor Cost</div><div class="calc-val">' + App.fmtCurrency(actCost) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Scheduled Hours</div><div class="calc-val dim">'
      + (schedHours != null ? schedHours.toFixed(1) : '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Hours vs Scheduled</div><div class="calc-val '
      + (hoursVar == null ? '' : hoursVar > 0 ? 'warn' : 'good') + '">'
      + (hoursVar != null ? (hoursVar > 0 ? '+' : '') + hoursVar.toFixed(1) : '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor % (vs Forecast)</div><div class="calc-val '
      + (laborPct == null ? '' : laborPct > target ? 'warn' : 'good') + '">'
      + (laborPct != null ? App.fmtPct(laborPct) : '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">RPLH (vs Forecast)</div><div class="calc-val">'
      + (rplh != null ? App.fmtCurrency(rplh) : '-') + '</div></div>'
      + '</div>';

    const dateCard = '<div class="card">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Weekly Summary</span>'
      + App.helpButton('ws-how') + '</div>'
      + '<div class="form-row" style="gap:12px;margin-bottom:0;align-items:flex-end;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Week Starting</label>'
      + '<input type="date" id="ws-start" value="' + esc(ws) + '"/></div>'
      + '<div style="display:flex;gap:6px;padding-bottom:2px;">'
      + '<button class="btn btn-ghost btn-sm" id="ws-prev" title="Previous week" aria-label="Previous week">&#8592;</button>'
      + '<button class="btn btn-ghost btn-sm" id="ws-next" title="Next week" aria-label="Next week">&#8594;</button>'
      + '</div>'
      + '</div>'
      + summary
      + '</div>';

    // By staff
    const byStaff = {};
    weekActuals.forEach(a => {
      const k = a.staff_id || a.name || '?';
      if (!byStaff[k]) byStaff[k] = { name: a.name || '-', days: {}, hours: 0, cost: 0 };
      byStaff[k].days[a.date] = true;
      byStaff[k].hours += (a.hours || 0);
      byStaff[k].cost += (a.cost || 0);
    });
    // Salaried (exempt) staff carry a fixed weekly salary on top of any logged
    // hours (which stay as coverage). Inject them even if no hours were logged.
    ((App.laborData && App.laborData.lc_staff) || []).forEach(st => {
      if (!App.isSalaried(st) || st.status === 'Inactive') return;
      const annual = parseFloat(st.annual_salary);
      if (!annual || annual <= 0) return;
      if (!byStaff[st.id]) byStaff[st.id] = { name: st.name || '-', days: {}, hours: 0, cost: 0 };
      byStaff[st.id].cost += annual / 52;
    });
    let staffCard;
    const staffKeys = Object.keys(byStaff);
    if (staffKeys.length === 0) {
      staffCard = '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
        + '<span>By Staff</span>'
        + '<button class="btn btn-ghost btn-sm" id="ws-export">Export PDF</button></div>'
        + '<div style="font-size:13px;color:var(--t3);">No hours logged for this week.</div></div>';
    } else {
      const canEdit = App.canEdit && App.canEdit('lc-log-hours');
      const rows = staffKeys.sort((a, b) => byStaff[b].cost - byStaff[a].cost).map(k => {
        const s = byStaff[k];
        // Find this staff member's lc_actuals records this week for inline edit
        const recs = weekActuals.filter(a => (a.staff_id || a.name) === k);
        const anyLocked = recs.some(r => r.locked);
        const editBtn = canEdit && !anyLocked && recs.length > 0
          ? '<button class="btn btn-ghost btn-sm ws-edit" data-key="' + esc(k) + '">Edit Hours</button>'
          : anyLocked ? '<span style="font-size:9px;color:var(--gold);font-weight:700;letter-spacing:1px;">LOCKED</span>' : '';
        return '<tr><td><div class="val">' + esc(s.name) + '</div></td>'
          + '<td>' + Object.keys(s.days).length + '</td>'
          + '<td>' + s.hours.toFixed(1) + '</td>'
          + '<td class="val">' + App.fmtCurrency(s.cost) + '</td>'
          + '<td>' + editBtn + '</td></tr>';
      }).join('');
      staffCard = '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
        + '<span>By Staff</span>'
        + '<button class="btn btn-ghost btn-sm" id="ws-export">Export PDF</button></div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Staff</th><th>Days</th><th>Hours</th><th>Cost</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    // By day
    const dayRows = [];
    for (let i = 0; i < 7; i++) {
      const dStr = this.addDays(ws, i);
      const dayAct = weekActuals.filter(a => a.date === dStr);
      const h = dayAct.reduce((t, a) => t + (a.hours || 0), 0);
      const c = dayAct.reduce((t, a) => t + (a.cost || 0), 0) + App.salariedCost(dStr, dStr).total;
      dayRows.push('<tr><td><div class="val">' + this.fmtDay(dStr) + '</div></td>'
        + '<td>' + dayAct.length + '</td>'
        + '<td>' + h.toFixed(1) + '</td>'
        + '<td class="val">' + App.fmtCurrency(c) + '</td></tr>');
    }
    const dayCard = '<div class="card"><div class="card-title">By Day</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Day</th><th>Headcount</th><th>Hours</th><th>Cost</th>'
      + '</tr></thead><tbody>' + dayRows.join('') + '</tbody></table></div></div>';

    this.container.innerHTML = '<div class="screen">' + dateCard + staffCard + dayCard + '</div>'
      + this.editModalHtml();

    document.getElementById('ws-how')?.addEventListener('click', () => this.showHowTo());
    document.getElementById('ws-export')?.addEventListener('click', () => App.exportPDF({ title: 'Weekly Summary', root: this.container }));
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
    // Inline edit modal for a staff member's hours this week
    this.container.querySelectorAll('.ws-edit').forEach(btn => {
      btn.addEventListener('click', () => this.openEditModal(btn.dataset.key, weekActuals));
    });
  },

  // ── Inline Edit Modal (per-staff per-week list) ─────────────────────
  editModalHtml() {
    return '<div id="ws-edit-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;padding:20px;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:24px 28px;max-width:560px;width:100%;">'
      + '<div id="ws-em-title" style="font-size:14px;font-weight:700;color:var(--t1);margin-bottom:14px;">Edit Hours</div>'
      + '<div id="ws-em-body"></div>'
      + '<div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end;">'
        + '<button class="btn btn-ghost" id="ws-em-cancel">Cancel</button>'
        + '<button class="btn btn-primary" id="ws-em-save">Save All</button>'
      + '</div></div></div>';
  },

  openEditModal(key, weekActuals) {
    const recs = weekActuals.filter(a => (a.staff_id || a.name) === key && !a.locked);
    if (!recs.length) return;
    const modal = document.getElementById('ws-edit-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('ws-em-title').textContent = 'Edit Hours · ' + (recs[0].name || '');
    const body = document.getElementById('ws-em-body');
    body.innerHTML = recs.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((r, i) =>
      '<div class="form-row" style="gap:14px;align-items:flex-end;margin-bottom:10px;" data-id="' + r.id + '">'
        + '<div class="f" style="width:130px;flex-shrink:0;"><label>Date</label>'
          + '<div style="font-size:12px;color:var(--t2);padding:8px 0;">' + esc(this.fmtDay(r.date)) + '</div></div>'
        + '<div class="f" style="width:100px;flex-shrink:0;"><label>Hours</label>'
          + '<input type="number" class="ws-em-hours" min="0" step="0.25" value="' + (r.hours != null ? r.hours : '') + '"/></div>'
        + '<div class="f" style="flex:1;min-width:140px;"><label>Notes</label>'
          + '<input type="text" class="ws-em-notes" value="' + esc(r.notes || '') + '" placeholder="Optional"/></div>'
      + '</div>'
    ).join('');
    document.getElementById('ws-em-cancel').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('ws-em-save').onclick = async () => {
      const edits = [];
      body.querySelectorAll('.form-row').forEach(row => {
        const rec = this.actuals().find(a => a.id === row.dataset.id);
        if (rec) edits.push({ rec, hours: parseFloat(row.querySelector('.ws-em-hours')?.value), notes: row.querySelector('.ws-em-notes')?.value || '' });
      });
      modal.style.display = 'none';
      for (const e of edits) { await App.updateActual(e.rec, { hours: e.hours, notes: e.notes }); }
      this.draw();
    };
  }
};
