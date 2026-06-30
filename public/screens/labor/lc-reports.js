'use strict';

/* ── Labor Control — Labor Reports (reads lc_actuals, lc_schedules, lc_tips) ───
   One home for viewing logged labor, three lenses on a tab switcher:
     Day   — one day (was Daily Snapshot): who worked, hours, cost, vs schedule.
     Week  — one week (was Weekly Summary): by staff + by day, labor % vs forecast.
     Range — any date range (was Labor Reports): by department + by staff, tips.
   Read-only except the inline Edit Hours pop-ups on the Day and Week lenses.
   Replaces the standalone lc-daily-view + lc-weekly-summary screens. */

S.LaborReports = {
  tab: 'week',
  date: null,              // Day lens
  weekStart: null,         // Week lens
  filterPreset: 'last-4',  // Range lens active chip: this-week|last-week|this-month|last-4|all|custom
  _prevPreset: 'last-4',   // range to restore when Custom is toggled closed
  filterFrom: '',          // Range lens, custom range only
  filterTo: '',
  DAYS: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  TABS: [['day', 'Day'], ['week', 'Week'], ['range', 'Range']],
  // Range lens time chips (the only Range filter), daily cadence. Mirrors Log Hours.
  RANGE_CHIPS: [
    { v: 'this-week', label: 'This Week' }, { v: 'last-week', label: 'Last Week' },
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],

  actuals()   { return ((App.laborData && App.laborData.lc_actuals) || []); },
  tips()      { return ((App.laborData && App.laborData.lc_tips) || []); },
  schedules() { return ((App.laborData && App.laborData.lc_schedules) || []); },
  positionById(id) { return ((App.laborData && App.laborData.lc_positions) || []).find(p => p.id === id); },
  laborTarget() { return App.laborTargetPct(); },

  // ── date helpers ────────────────────────────────────────────────────────────
  dayName(dateStr) {
    const d = new Date(String(dateStr).length <= 10 ? dateStr + 'T00:00:00' : dateStr);
    return isNaN(d.getTime()) ? '' : this.DAYS[d.getDay()];
  },
  addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return App.ymdLocal(d);
  },
  mondayOf(d) {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return App.ymdLocal(date);
  },
  fmtDay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  },
  // Compact Monday-date label for the Week lens chips ("Jun 9").
  weekLabel(ws) {
    const d = new Date((ws || '') + 'T00:00:00');
    return isNaN(d.getTime()) ? esc(ws || '') : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },
  // Monday week selector for the Week lens (mirrors Build Schedule / Log Hours
  // Fill): a window of week chips by Monday date (live week tagged NOW, selected
  // gold-tint) + step arrows + a snap to the current week. No native calendar.
  weekSelector(ws) {
    const cur = this.mondayOf(new Date());
    const isCur = ws >= cur;
    const nowBadge = isCur ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">'
      + App.dateRangeLabel(ws, App.periodEndFor(ws)).toUpperCase() + nowBadge + '</span>';
    const nextBtn = isCur
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button type="button" class="btn btn-ghost btn-sm" id="ws-next" aria-label="Next week" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    return '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button type="button" class="btn btn-ghost btn-sm" id="ws-prev" aria-label="Previous week" style="margin:0;padding:3px 9px;">&lsaquo;</button>'
      + pill + nextBtn
      + (isCur ? '' : '<button type="button" class="btn btn-ghost btn-sm" id="ws-now" style="margin-left:4px;">This Week</button>')
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
      + '<button class="btn btn-ghost btn-sm" id="ws-export">Export PDF</button></div>'
      + '</div>';
  },
  // Scheduled shifts for one date (Day lens)
  scheduledForDate(dateStr) {
    const target = new Date(dateStr + 'T00:00:00').getTime();
    if (isNaN(target)) return null;
    const day = this.dayName(dateStr);
    for (const sched of this.schedules()) {
      if (!sched.week_start) continue;
      const start = new Date(sched.week_start + 'T00:00:00').getTime();
      if (isNaN(start)) continue;
      if (target >= start && target <= start + 6 * 86400000) return (sched.shifts || []).filter(sh => sh.day === day);
    }
    return null;
  },
  // The schedule covering a date (Week lens)
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

  // Effective Range-lens window from the active chip (preset recomputed off "today"
  // each render so This Week stays live); Custom reads the From/To pickers.
  rangeWindow() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  inRange(rec) {
    const { from, to } = this.rangeWindow();
    const d = rec.date || '';
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  },

  // ── shared markup ─────────────────────────────────────────────────────────
  statItem(label, val, cls) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
  },
  statsCard(items) {
    return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>';
  },
  dataCard(headers, rowsHtml) {
    return '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;"><thead><tr>'
      + headers + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
  },
  noRow(cols, msg) {
    return '<tr><td colspan="' + cols + '" style="color:var(--t3);padding:12px 8px;">' + esc(msg || 'No hours match the filter.') + '</td></tr>';
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderReport();
  },

  showHowTo() {
    App.showHelpModal('How Labor History Works', [
      { p: ['Labor History is one place to see your logged labor, three ways. Switch the tab at the top: Day for a single day, Week for a full week, Range for any stretch of dates.'] },
      { h: 'Day', p: ['One day at a time: who worked, their hours and cost, and how the day compared to the schedule. Move between days with the date box or the arrows, and Today snaps back to the current day. The Scheduled This Day table flags anyone who was scheduled but has no hours logged yet, so a missed entry never slips by. Click Edit Hours to fix an entry without leaving the page.'] },
      { h: 'Week', p: ['A full week rolled up by staff and by day, with labor percentage and revenue per labor hour against the week\'s forecast. Pick the week from the chips or the arrows; This Week snaps back to the current one. Use it Monday morning before building the next week. Salaried staff carry their fixed weekly salary.'] },
      { h: 'Range', p: ['Any date range, broken down by department and by staff, with labor cost (straight time plus overtime premium), labor percent and revenue per labor hour from logged shift revenue, and tips. Pick a range with the chips, or Custom to set your own dates. Click a staff row to open their page.'] },
      { h: 'Editing And Export', p: ['Day and Week let you correct hours inline. Entries in a closed pay period show as locked; reopen the period in Pay Periods first. Export PDF saves whichever lens you are on.'] }
    ]);
  },

  renderReport() {
    this.actions.innerHTML = '';
    if (this.actuals().length === 0) {
      App.setupCard(this.container, {
        title: 'Labor History',
        lead: 'Labor History shows your logged labor by day, by week, and over any range, with cost, labor percentage, and tips.',
        steps: [
          { title: 'Log some hours', desc: 'Hours you log in Log Hours feed every view here. Log some to get started.', btn: 'Go to Log Hours', screen: 'lc-log-hours', done: false }
        ]
      });
      return;
    }
    if (!this.date) this.date = App.todayLocal();
    if (!this.weekStart) this.weekStart = this.mondayOf(new Date());

    const tabBar = '<div class="ch-tabs no-print">'
      + this.TABS.map(([k, l]) => '<button class="ch-tab' + (this.tab === k ? ' on' : '') + '" data-tab="' + k + '">' + l + '</button>').join('')
      + '</div>';
    const body = this.tab === 'day' ? this.dayBody() : this.tab === 'week' ? this.weekBody() : this.rangeBody();

    this.container.innerHTML = '<div class="screen">' + tabBar + body + '</div>';
    this.wire();
  },

  wire() {
    this.container.onclick = ev => {
      const tab = ev.target.closest('.ch-tab');
      if (tab) { this.tab = tab.dataset.tab; this.renderReport(); return; }
      // Day lens
      if (ev.target.closest('#dv-export')) { App.exportPDF({ title: 'Labor Report - Day', root: this.container }); return; }
      if (ev.target.closest('#dv-prev')) { this.date = this.addDays(this.date, -1); this.renderReport(); return; }
      if (ev.target.closest('#dv-next')) { this.date = this.addDays(this.date, 1); this.renderReport(); return; }
      if (ev.target.closest('#dv-today')) { this.date = App.todayLocal(); this.renderReport(); return; }
      if (ev.target.closest('#dv-log-missing')) { this.logMissing(this.date, false); return; }
      const dvEdit = ev.target.closest('.dv-edit'); if (dvEdit) { this.openDayEdit(dvEdit.dataset.id); return; }
      // Week lens
      if (ev.target.closest('#ws-export')) { App.exportPDF({ title: 'Labor Report - Week', root: this.container }); return; }
      if (ev.target.closest('#ws-prev')) { this.weekStart = this.addDays(this.weekStart, -7); this.renderReport(); return; }
      if (ev.target.closest('#ws-next')) { const nw = this.addDays(this.weekStart, 7); if (nw > this.mondayOf(new Date())) return; this.weekStart = nw; this.renderReport(); return; }
      if (ev.target.closest('#ws-now')) { this.weekStart = this.mondayOf(new Date()); this.renderReport(); return; }
      if (ev.target.closest('#ws-log-missing')) { this.logMissing(this.weekStart, true); return; }
      const wsEdit = ev.target.closest('.ws-edit'); if (wsEdit) { this.openWeekEdit(wsEdit.dataset.key); return; }
      // Range lens
      if (ev.target.closest('#lr-export')) { App.exportPDF({ title: 'Labor Report - Range', root: this.container }); return; }
      const lrChip = ev.target.closest('.lr-range-chip');
      if (lrChip) {
        const v = lrChip.dataset.v;
        if (v === 'custom') {
          // Custom toggles: a second click closes the pickers and restores the prior range.
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.renderReport();
        return;
      }
      const sRow = ev.target.closest('.lr-staff-row'); if (sRow) { App._staffFocus = { staff_id: sRow.dataset.staff }; App.navigate('lc-staff-roster'); return; }
    };
    document.getElementById('dv-date')?.addEventListener('change', e => { this.date = e.target.value || this.date; this.renderReport(); });
    document.getElementById('lr-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderReport(); });
    document.getElementById('lr-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderReport(); });
  },

  // Hand off to Log Hours in Fill-from-Schedule mode (one-shot) for the right week.
  logMissing(anchor, isWeek) {
    let ws = anchor;
    if (!isWeek) {
      const d = new Date(anchor + 'T00:00:00');
      if (!isNaN(d.getTime())) d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      ws = isNaN(d.getTime()) ? '' : App.ymdLocal(d);
    }
    if (S.LaborLogHours) { S.LaborLogHours._modeOnce = 'schedule'; S.LaborLogHours._fillWeek = ws; }
    App.navigate('lc-log-hours');
  },

  // ── DAY lens ────────────────────────────────────────────────────────────────
  dayBody() {
    const dayActuals = this.actuals().filter(a => a.date === this.date);
    const actHours = dayActuals.reduce((t, a) => t + (a.hours || 0), 0);
    // Day cost is the hourly labor that happened this day (reconciles to the table
    // below). Salaried pay is a fixed weekly cost, shown on the Week and Range
    // lenses, not split across days.
    const actCost = dayActuals.reduce((t, a) => t + (a.cost || 0), 0);

    const sched = this.scheduledForDate(this.date);
    let schedHours = null;
    if (sched) schedHours = sched.reduce((t, s) => t + (s.hours || 0), 0);
    const hoursVar = schedHours != null ? actHours - schedHours : null;

    const isToday = this.date === App.todayLocal();
    // Day selector styled like the Week lens pill: prev / DAY pill (TODAY badge) /
    // next + Today snap on the left, Export on the right. Step by day with the
    // arrows; next is capped at today.
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const dayNow = isToday ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">TODAY</span>' : '';
    const dayPill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + this.fmtDay(this.date).toUpperCase() + dayNow + '</span>';
    const nextDayBtn = isToday
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm" id="dv-next" title="Next day" aria-label="Next day" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pickerRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-ghost btn-sm" id="dv-prev" title="Previous day" aria-label="Previous day" style="margin:0;padding:3px 9px;">&lsaquo;</button>'
      + dayPill + nextDayBtn
      + (isToday ? '' : '<button class="btn btn-ghost btn-sm" id="dv-today">Today</button>')
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
      + '<button class="btn btn-ghost btn-sm" id="dv-export">Export PDF</button></div>'
      + '</div>';

    const summaryCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + this.statItem('Headcount', String(dayActuals.length))
      + this.statItem('Actual Hours', actHours.toFixed(1))
      + this.statItem('Actual Cost', App.fmtCurrency(actCost))
      + this.statItem('Scheduled Hours', schedHours != null ? schedHours.toFixed(1) : '-', 'dim')
      + this.statItem('Hours vs Scheduled', hoursVar != null ? ((hoursVar > 0 ? '+' : '') + hoursVar.toFixed(1)) : '-', hoursVar == null ? '' : hoursVar > 0 ? 'warn' : 'good')
      + '</div></div>';

    let actualsCard;
    if (dayActuals.length === 0) {
      actualsCard = '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;"><thead><tr>'
        + '<th style="width:28%;">Staff</th><th style="width:15%;">Shift</th><th style="width:14%;">Hours</th><th style="width:15%;">Wage</th><th style="width:14%;">Cost</th><th style="width:14%;"></th>'
        + '</tr></thead><tbody>' + this.noRow(6, 'No hours logged for this day. Log them in Log Hours.') + '</tbody></table></div>';
    } else {
      const canEdit = App.canEdit && App.canEdit('lc-log-hours');
      const rows = [...dayActuals].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(a => {
        const locked = !!a.locked;
        const editBtn = canEdit && !locked
          ? '<button class="btn btn-ghost btn-sm dv-edit" data-id="' + a.id + '">Edit Hours</button>'
          : locked ? '<span style="font-size:9px;color:var(--gold);font-weight:700;letter-spacing:1px;">LOCKED</span>' : '';
        const sal = App.isSalaried(a.staff_id);
        const wageCell = sal ? '<span style="color:var(--t3);">Salary</span>' : (a.wage != null ? App.fmtCurrency(a.wage) + '/hr' : '-');
        const costCell = sal ? '<span style="color:var(--t3);">Salary</span>' : App.fmtCurrency(a.cost || 0);
        return '<tr><td><div class="val">' + esc(a.name || '-') + '</div></td>'
          + '<td>' + esc(a.shift_type || '-') + '</td>'
          + '<td>' + (a.hours != null ? a.hours.toFixed(1) : '-') + '</td>'
          + '<td>' + wageCell + '</td>'
          + '<td class="val">' + costCell + '</td>'
          + '<td><div class="row-actions">' + editBtn + '</div></td></tr>';
      }).join('');
      actualsCard = '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;"><thead><tr>'
        + '<th style="width:28%;">Staff</th><th style="width:15%;">Shift</th><th style="width:14%;">Hours</th><th style="width:15%;">Wage</th><th style="width:14%;">Cost</th><th style="width:14%;"></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    let schedCard = '';
    if (sched && sched.length) {
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
        + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;"><thead><tr>'
        + '<th style="width:28%;">Staff</th><th style="width:15%;">Start</th><th style="width:14%;">End</th><th style="width:15%;">Hours</th><th style="width:14%;">Cost</th><th style="width:14%;">Status</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    return summaryCard + pickerRow + actualsCard + schedCard;
  },

  openDayEdit(actualId) {
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
        + '<span id="dv-em-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'dv-edit-modal', maxWidth: 540, noClose: true });
    const hoursInp = document.getElementById('dv-em-hours');
    const notesInp = document.getElementById('dv-em-notes');
    const costEl = document.getElementById('dv-em-cost');
    const updateCost = () => {
      const h = parseFloat(hoursInp?.value) || 0;
      if (costEl) costEl.textContent = wage > 0 ? 'Cost: ' + App.fmtCurrency(h * wage) + ' (' + App.fmtCurrency(wage) + '/hr)' : '';
    };
    updateCost();
    hoursInp?.addEventListener('input', updateCost);
    document.getElementById('dv-em-save')?.addEventListener('click', async () => {
      const newHours = parseFloat(hoursInp?.value);
      const err = document.getElementById('dv-em-err');
      if (isNaN(newHours) || newHours < 0) { if (err) { err.textContent = 'Enter the hours worked.'; err.style.display = 'inline'; } return; }
      App.closeModal('dv-edit-modal');
      await App.updateActual(a, { hours: newHours, notes: notesInp?.value || '' });
      this.renderReport();
    });
  },

  // ── WEEK lens ─────────────────────────────────────────────────────────────
  weekBody() {
    const ws = this.weekStart;
    const we = this.addDays(ws, 6);
    const weekActuals = this.actuals().filter(a => a.date >= ws && a.date <= we);
    const actHours = weekActuals.reduce((t, a) => t + (a.hours || 0), 0);
    const salWk = App.salariedCost(ws, we);
    // Salaried pay accrues every week regardless of hourly activity, so it is always
    // in the week total (and itemized in the By Staff table below).
    const actCost = weekActuals.reduce((t, a) => t + (a.cost || 0), 0) + salWk.total;

    const sched = this.scheduleCovering(ws);
    const schedHours = sched ? (sched.total_hours || 0) : null;
    const forecast = sched ? (sched.revenue_forecast || 0) : 0;
    const laborPct = forecast > 0 ? actCost / forecast * 100 : null;
    const rplh = actHours > 0 && forecast > 0 ? forecast / actHours : null;
    const target = this.laborTarget();
    const hoursVar = schedHours != null ? actHours - schedHours : null;

    const summaryCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + this.statItem('Actual Hours', actHours.toFixed(1))
      + this.statItem('Actual Labor Cost', App.fmtCurrency(actCost))
      + this.statItem('Scheduled Hours', schedHours != null ? schedHours.toFixed(1) : '-', 'dim')
      + this.statItem('Hours vs Scheduled', hoursVar != null ? ((hoursVar > 0 ? '+' : '') + hoursVar.toFixed(1)) : '-', hoursVar == null ? '' : hoursVar > 0 ? 'warn' : 'good')
      + this.statItem('Labor % (vs Forecast)', laborPct != null ? App.fmtPct(laborPct) : '-', laborPct == null ? '' : laborPct > target ? 'warn' : 'good')
      + this.statItem('RPLH (vs Forecast)', rplh != null ? App.fmtCurrency(rplh) : '-')
      + '</div></div>';

    // By staff
    const byStaff = {};
    weekActuals.forEach(a => {
      const k = a.staff_id || a.name || '?';
      if (!byStaff[k]) byStaff[k] = { name: a.name || '-', days: {}, hours: 0, cost: 0 };
      byStaff[k].days[a.date] = true;
      byStaff[k].hours += (a.hours || 0);
      byStaff[k].cost += (a.cost || 0);
    });
    ((App.laborData && App.laborData.lc_staff) || []).forEach(st => {
      if (!App.isSalaried(st) || st.status === 'Inactive') return;
      const annual = parseFloat(st.annual_salary);
      if (!annual || annual <= 0) return;
      if (!byStaff[st.id]) byStaff[st.id] = { name: st.name || '-', days: {}, hours: 0, cost: 0 };
      byStaff[st.id].cost += annual / 52;
    });
    let staffBody;
    const staffKeys = Object.keys(byStaff);
    if (staffKeys.length === 0) {
      staffBody = '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;"><thead><tr>'
        + '<th style="width:34%;">Staff</th><th style="width:16%;">Days</th><th style="width:16%;">Hours</th><th style="width:18%;">Cost</th><th style="width:16%;"></th>'
        + '</tr></thead><tbody><tr><td colspan="5" style="color:var(--t3);">No hours logged for this week.</td></tr></tbody></table></div>';
    } else {
      const canEdit = App.canEdit && App.canEdit('lc-log-hours');
      const rows = staffKeys.sort((a, b) => byStaff[b].cost - byStaff[a].cost).map(k => {
        const s = byStaff[k];
        const recs = weekActuals.filter(a => (a.staff_id || a.name) === k);
        const anyLocked = recs.some(r => r.locked);
        const editBtn = canEdit && !anyLocked && recs.length > 0
          ? '<button class="btn btn-ghost btn-sm ws-edit" data-key="' + esc(k) + '">Edit Hours</button>'
          : anyLocked ? '<span style="font-size:9px;color:var(--gold);font-weight:700;letter-spacing:1px;">LOCKED</span>' : '';
        return '<tr><td><div class="val">' + esc(s.name) + '</div></td>'
          + '<td>' + Object.keys(s.days).length + '</td>'
          + '<td>' + s.hours.toFixed(1) + '</td>'
          + '<td class="val">' + App.fmtCurrency(s.cost) + '</td>'
          + '<td><div class="row-actions">' + editBtn + '</div></td></tr>';
      }).join('');
      staffBody = '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;"><thead><tr>'
        + '<th style="width:34%;">Staff</th><th style="width:16%;">Days</th><th style="width:16%;">Hours</th><th style="width:18%;">Cost</th><th style="width:16%;"></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    // By day
    const dayRows = [];
    for (let i = 0; i < 7; i++) {
      const dStr = this.addDays(ws, i);
      const dayAct = weekActuals.filter(a => a.date === dStr);
      const h = dayAct.reduce((t, a) => t + (a.hours || 0), 0);
      const c = dayAct.reduce((t, a) => t + (a.cost || 0), 0);  // hourly only; salary is weekly-fixed (in the total + By Staff)
      dayRows.push('<tr><td><div class="val">' + this.fmtDay(dStr) + '</div></td>'
        + '<td>' + dayAct.length + '</td>'
        + '<td>' + h.toFixed(1) + '</td>'
        + '<td class="val">' + App.fmtCurrency(c) + '</td><td></td></tr>');
    }
    const dayCard = '<div class="sh" style="margin:24px 0 10px;">By Day</div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;"><thead><tr>'
      + '<th style="width:34%;">Day</th><th style="width:16%;">Headcount</th><th style="width:16%;">Hours</th><th style="width:18%;">Hourly Cost</th><th style="width:16%;"></th>'
      + '</tr></thead><tbody>' + dayRows.join('') + '</tbody></table></div>';

    // Scheduled-but-not-logged nudge
    let notLoggedNames = [];
    if (sched && (sched.shifts || []).length) {
      const loggedKeys = new Set(weekActuals.map(a => a.staff_id || a.name));
      const seen = new Set();
      (sched.shifts || []).forEach(sh => {
        const k = sh.staff_id || sh.name;
        if (!k || loggedKeys.has(k) || seen.has(k) || App.isSalaried(sh.staff_id)) return;
        seen.add(k);
        notLoggedNames.push(sh.name || '-');
      });
    }
    const schedNudge = notLoggedNames.length
      ? '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:11px 14px;margin:16px 0 0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
        + '<div style="font-size:12px;color:var(--t2);"><span style="color:var(--amber);font-weight:700;">' + notLoggedNames.length + '</span> scheduled but not logged this week: <span style="color:var(--t2);">'
        + notLoggedNames.slice(0, 6).map(esc).join(', ') + (notLoggedNames.length > 6 ? ', and more' : '') + '</span>.</div>'
        + '<button class="btn btn-ghost btn-sm" id="ws-log-missing">Log Hours</button></div>'
      : '';

    return summaryCard + schedNudge + this.weekSelector(ws) + staffBody + dayCard;
  },

  openWeekEdit(key) {
    const ws = this.weekStart, we = this.addDays(ws, 6);
    const weekActuals = this.actuals().filter(a => a.date >= ws && a.date <= we);
    const recs = weekActuals.filter(a => (a.staff_id || a.name) === key && !a.locked);
    if (!recs.length) return;
    const sorted = recs.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const bodyRows = '<div style="overflow-x:auto;margin-bottom:2px;"><table class="ing-tbl pill" style="table-layout:fixed;"><thead><tr>'
      + '<th>Date</th><th style="width:110px;">Hours</th><th>Notes</th>'
      + '</tr></thead><tbody>'
      + sorted.map(r =>
          '<tr class="wsem-line" data-id="' + r.id + '">'
            + '<td><div class="val">' + esc(this.fmtDay(r.date)) + '</div></td>'
            + '<td><input type="number" class="ws-em-hours form-input" min="0" step="0.25" value="' + (r.hours != null ? r.hours : '') + '" style="width:100%;"/></td>'
            + '<td><input type="text" class="ws-em-notes form-input" value="' + esc(r.notes || '') + '" placeholder="Optional" style="width:100%;"/></td>'
          + '</tr>'
        ).join('')
      + '</tbody></table></div>';
    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">Edit Hours' + (recs[0].name ? ' &middot; ' + esc(recs[0].name) : '') + '</div>'
      + bodyRows
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="ws-em-save">Save All</button>'
      + '</div></div>';
    App.openModal(html, { id: 'ws-edit-modal', maxWidth: 600, noClose: true });
    document.getElementById('ws-em-save')?.addEventListener('click', async () => {
      const edits = [];
      document.querySelectorAll('#ws-edit-modal .wsem-line[data-id]').forEach(row => {
        const rec = this.actuals().find(a => a.id === row.dataset.id);
        if (rec) edits.push({ rec, hours: parseFloat(row.querySelector('.ws-em-hours')?.value), notes: row.querySelector('.ws-em-notes')?.value || '' });
      });
      App.closeModal('ws-edit-modal');
      for (const e of edits) { await App.updateActual(e.rec, { hours: e.hours, notes: e.notes }); }
      this.renderReport();
    });
  },

  // ── RANGE lens ──────────────────────────────────────────────────────────────
  rangeBody() {
    const rows = this.actuals().filter(a => this.inRange(a));
    const tips = this.tips().filter(t => this.inRange(t));

    const { from: winFrom, to: winTo } = this.rangeWindow();
    const datesInRange = rows.map(a => a.date).filter(Boolean).sort();
    const rFrom = winFrom || datesInRange[0] || '';
    const rTo = winTo || datesInRange[datesInRange.length - 1] || '';
    const salWeeks = (rFrom && rTo)
      ? (Math.floor((new Date(rTo + 'T00:00:00').getTime() - new Date(rFrom + 'T00:00:00').getTime()) / 86400000) + 1) / 7
      : 0;
    const salRange = (rFrom && rTo) ? App.salariedCost(rFrom, rTo) : { total: 0 };

    const ot = this.otPremiums(rows);
    const totHours = rows.reduce((t, a) => t + (a.hours || 0), 0);
    const totCost = rows.reduce((t, a) => t + (a.cost || 0), 0) + salRange.total + ot.total;
    const totTips = tips.reduce((t, x) => t + (x.total_tips || 0), 0);
    const periodRev = ((App.shiftData && App.shiftData.sc_shifts) || []).reduce((s, sh) => {
      const d = sh.date || '';
      if ((rFrom && d < rFrom) || (rTo && d > rTo)) return s;
      return s + (parseFloat(sh.total_revenue) || 0);
    }, 0);
    const laborPctVal = periodRev > 0 ? (totCost / periodRev * 100) : null;
    const rplhVal = (periodRev > 0 && totHours > 0) ? (periodRev / totHours) : null;

    const statsCard = this.statsCard(
      this.statItem('Total Hours', totHours.toFixed(1))
      + this.statItem('Labor Cost', App.fmtCurrency(totCost))
      + this.statItem('Labor %', laborPctVal != null ? App.fmtPct(laborPctVal) : '-')
      + this.statItem('Rev / Labor Hr', rplhVal != null ? App.fmtCurrency(rplhVal) : '-')
      + this.statItem('Avg Wage', App.fmtCurrency(totHours > 0 ? totCost / totHours : 0))
      + this.statItem('Tips Logged', App.fmtCurrency(totTips)));

    return statsCard + this.rangeFilterRow()
      + this.byDept(rows, totCost, salWeeks, ot.byDept)
      + '<div class="sh" style="margin:24px 0 10px;">By Staff</div>'
      + this.byStaff(rows, totCost, salWeeks, ot.byStaff);
  },

  // Range chips left, Export right (no filter card), above the data block. Custom
  // reveals a bare From/To row. Mirrors Tip History / Log Hours.
  rangeFilterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'lr-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
        + '<button class="btn btn-ghost btn-sm" id="lr-export">Export PDF</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="lr-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="lr-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
  },

  // Weekly OT premium per non-salaried staff (0.5x on hours over 40/week),
  // bucketed across the range and attributed to staff + dept so Labor Cost
  // reconciles with gross. Returns { total, byStaff, byDept }.
  otPremiums(rows) {
    const wk = {};
    rows.forEach(a => {
      if (App.isSalaried(a.staff_id)) return;
      const sk = a.staff_id || a.name || '?';
      const ws = App.weekStartFor ? App.weekStartFor(a.date) : (a.date || '');
      const key = sk + '|' + ws;
      if (!wk[key]) {
        const pos = this.positionById(a.position_id);
        wk[key] = { sk, dept: pos ? (pos.department || 'Other') : 'Unassigned', hours: 0, cost: 0 };
      }
      wk[key].hours += (a.hours || 0);
      wk[key].cost += (a.cost || 0);
    });
    const out = { total: 0, byStaff: {}, byDept: {} };
    Object.values(wk).forEach(b => {
      const otH = Math.max(0, b.hours - App.OT_THRESHOLD);
      if (otH <= 0 || b.hours <= 0) return;
      const prem = otH * (b.cost / b.hours) * 0.5;
      out.total += prem;
      out.byStaff[b.sk] = (out.byStaff[b.sk] || 0) + prem;
      out.byDept[b.dept] = (out.byDept[b.dept] || 0) + prem;
    });
    return out;
  },

  byStaff(rows, totCost, salWeeks, otByStaff) {
    otByStaff = otByStaff || {};
    const g = {};
    rows.forEach(a => {
      const k = a.staff_id || a.name || '?';
      if (!g[k]) g[k] = { name: a.name || '-', hours: 0, straight: 0 };
      g[k].hours += (a.hours || 0);
      g[k].straight += (a.cost || 0);
    });
    if (salWeeks > 0) {
      ((App.laborData && App.laborData.lc_staff) || []).forEach(st => {
        const wk = App.staffWeeklySalary(st);
        if (!wk) return;
        if (!g[st.id]) g[st.id] = { name: st.name || '-', hours: 0, straight: 0 };
        g[st.id].straight += wk * salWeeks;
      });
    }
    const cost = k => g[k].straight + (otByStaff[k] || 0);
    const isStaffId = k => ((App.laborData && App.laborData.lc_staff) || []).some(st => st.id === k);
    const trs = Object.keys(g).sort((a, b) => cost(b) - cost(a)).map(k => {
      const s = g[k];
      const clickable = isStaffId(k);
      return '<tr' + (clickable ? ' class="lr-staff-row" data-staff="' + esc(k) + '" style="cursor:pointer;"' : '') + '>'
        + '<td><div class="val">' + esc(s.name) + '</div></td>'
        + '<td>' + s.hours.toFixed(1) + '</td>'
        + '<td>' + App.fmtCurrency(s.hours > 0 ? s.straight / s.hours : 0) + '</td>'
        + '<td class="val">' + App.fmtCurrency(cost(k)) + '</td>'
        + '<td>' + (totCost > 0 ? App.fmtPct(cost(k) / totCost * 100) : '-') + '</td></tr>';
    }).join('') || this.noRow(5);
    return this.dataCard('<th style="width:30%;">Staff</th><th style="width:15%;">Hours</th><th style="width:18%;">Avg Wage</th><th style="width:19%;">Labor Cost</th><th style="width:18%;">% of Labor</th>', trs);
  },

  byDept(rows, totCost, salWeeks, otByDept) {
    otByDept = otByDept || {};
    const g = {};
    rows.forEach(a => {
      const pos = this.positionById(a.position_id);
      const dept = pos ? (pos.department || 'Other') : 'Unassigned';
      if (!g[dept]) g[dept] = { hours: 0, cost: 0 };
      g[dept].hours += (a.hours || 0);
      g[dept].cost += (a.cost || 0);
    });
    if (salWeeks > 0) {
      ((App.laborData && App.laborData.lc_staff) || []).forEach(st => {
        const wk = App.staffWeeklySalary(st);
        if (!wk) return;
        const pos = this.positionById(st.position_id);
        const dept = pos ? (pos.department || 'Other') : 'Unassigned';
        if (!g[dept]) g[dept] = { hours: 0, cost: 0 };
        g[dept].cost += wk * salWeeks;
      });
    }
    Object.keys(otByDept).forEach(d => { if (!g[d]) g[d] = { hours: 0, cost: 0 }; g[d].cost += otByDept[d]; });
    const trs = Object.keys(g).sort((a, b) => g[b].cost - g[a].cost).map(k =>
      '<tr><td><div class="val">' + esc(k) + '</div></td>'
      + '<td>' + g[k].hours.toFixed(1) + '</td>'
      + '<td>' + App.fmtCurrency(g[k].hours > 0 ? g[k].cost / g[k].hours : 0) + '</td>'
      + '<td class="val">' + App.fmtCurrency(g[k].cost) + '</td>'
      + '<td>' + (totCost > 0 ? App.fmtPct(g[k].cost / totCost * 100) : '-') + '</td></tr>').join('') || this.noRow(5);
    return this.dataCard('<th style="width:30%;">Department</th><th style="width:15%;">Hours</th><th style="width:18%;">Avg Wage</th><th style="width:19%;">Labor Cost</th><th style="width:18%;">% of Labor</th>', trs);
  }
};
