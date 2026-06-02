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
    actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="ws-export">Export PDF</button>';
    document.getElementById('ws-export')?.addEventListener('click', () => App.exportPDF({ title: 'Weekly Summary', root: this.container }));
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

    // By staff
    const byStaff = {};
    weekActuals.forEach(a => {
      const k = a.staff_id || a.name || '?';
      if (!byStaff[k]) byStaff[k] = { name: a.name || '-', days: {}, hours: 0, cost: 0 };
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
      staffCard = '<div class="card"><div class="card-title">By Staff</div>'
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

    this.container.innerHTML = '<div class="screen">' + dateCard + summary + staffCard + dayCard + '</div>'
      + this.editModalHtml();

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
