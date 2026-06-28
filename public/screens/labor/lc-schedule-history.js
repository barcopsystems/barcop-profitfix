'use strict';

/* ── Labor Control — Schedule History (reads lc_schedules) ────────────────────
   Every saved weekly schedule with its labor metrics. Open one for the full
   shift detail, edit it back in Build Schedule, or delete it. PDF export. */

S.LaborScheduleHistory = {
  _pendingDelId: null,
  get DAYS() { return App.DAYS_MON_FIRST || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; },

  schedules() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_schedules)) App.laborData.lc_schedules = [];
    return App.laborData.lc_schedules;
  },
  sorted() {
    return [...this.schedules()].sort((a, b) =>
      new Date((b.week_start || b.created_at || 0)).getTime() - new Date((a.week_start || a.created_at || 0)).getTime());
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  laborTarget() {
    return (S.LaborBuildSchedule && S.LaborBuildSchedule.laborTarget()) || 29;
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  renderList() {
    this.actions.innerHTML = '';
    const list = this.sorted();
    if (list.length === 0) {
      App.setupCard(this.container, {
        title: 'Schedule History',
        lead: 'Schedule History lists every weekly schedule you save, with labor cost, labor percentage, and revenue per labor hour.',
        steps: [
          { title: 'Build a schedule', desc: 'Schedules you save in Build Schedule show up here. Build your first to get started.', btn: 'Build a Schedule', screen: 'lc-build-schedule', done: false }
        ]
      });
      return;
    }
    let html;
    {
      const target = this.laborTarget();
      const rows = list.slice(0, App.listLimit('lc', 'schedule')).map(s => {
        const pct = s.labor_pct;
        return '<tr class="lh-row" data-id="' + s.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(s.week_start) + '</div></td>'
          + '<td>' + ((s.shifts || []).length) + '</td>'
          + '<td>' + (s.total_hours != null ? s.total_hours.toFixed(1) : '-') + '</td>'
          + '<td class="val">' + App.fmtCurrency(s.total_cost || 0) + '</td>'
          + '<td class="' + (pct != null ? (pct > target ? 'neg' : 'pos') : '') + '">'
          + (pct != null ? App.fmtPct(pct) : '-') + '</td>'
          + '<td>' + (s.rplh != null ? App.fmtCurrency(s.rplh) : '-') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm lh-view" data-id="' + s.id + '">View</button>'
          + '<button class="btn btn-ghost btn-sm lh-edit" data-id="' + s.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm lh-del" data-id="' + s.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      const withPct = list.filter(x => x.labor_pct != null);
      const avgPct = withPct.length ? withPct.reduce((t, x) => t + x.labor_pct, 0) / withPct.length : null;
      const avgCost = list.length ? list.reduce((t, x) => t + (x.total_cost || 0), 0) / list.length : 0;
      const withRplh = list.filter(x => x.rplh != null);
      const avgRplh = withRplh.length ? withRplh.reduce((t, x) => t + x.rplh, 0) / withRplh.length : null;
      const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Schedules</div><div class="calc-val lg">' + list.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Avg Labor Cost</div><div class="calc-val lg">' + App.fmtCurrency(avgCost) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Avg Labor %</div><div class="calc-val lg ' + (avgPct != null ? (avgPct > target ? 'warn' : 'good') : '') + '">' + (avgPct != null ? App.fmtPct(avgPct) : '-') + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Avg RPLH</div><div class="calc-val lg">' + (avgRplh != null ? App.fmtCurrency(avgRplh) : '-') + '</div></div>'
        + '</div></div>';
      html = statsCard
        + '<div class="sh" style="margin:24px 0 10px;">Schedule History</div>'
        + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Week Starting</th><th>Shifts</th><th>Hours</th><th>Labor Cost</th>'
        + '<th>Labor %</th><th>RPLH</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('lc', 'schedule', list, false);
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row = ev.target.closest('.lh-row');
      const view = ev.target.closest('.lh-view');
      const edit = ev.target.closest('.lh-edit');
      const del = ev.target.closest('.lh-del');
      const build = ev.target.closest('#lh-build');
      if (del)        { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit)  { ev.stopPropagation(); this.editSchedule(edit.dataset.id); }
      else if (view)  { ev.stopPropagation(); const id = view.dataset.id; App.pushView(() => this.renderDetail(id)); }
      else if (row)   { const id = row.dataset.id; App.pushView(() => this.renderDetail(id)); }
      else if (build) App.navigate('lc-build-schedule');
    };
  },

  editSchedule(id) {
    if (S.LaborBuildSchedule) { S.LaborBuildSchedule.editId = id; S.LaborBuildSchedule._enterEdit = true; }
    App.navigate('lc-build-schedule');
  },

  showHowTo() {
    App.showHelpModal('How Schedule History Works', [
      { p: ['Every schedule you post in Build Schedule lands here, newest first, with its labor cost, labor percent, and revenue per labor hour, so you can see how each week was staffed and what it cost.'] },
      { h: 'Open a Week', p: ['Click a row, or View, to see the full shift detail and export it as a PDF. Edit opens that week back in the Build Schedule grid. Copy to New Week, inside a week\'s detail, carries the same shifts forward so you are not rebuilding a typical week from scratch.'] }
    ]);
  },

  renderDetail(id) {
    const s = this.schedules().find(x => x.id === id);
    if (!s) { this.renderList(); return; }

    this.actions.innerHTML = '';

    const shifts = [...(s.shifts || [])].sort((a, b) => {
      const da = this.DAYS.indexOf(a.day), db = this.DAYS.indexOf(b.day);
      if (da !== db) return da - db;
      return (a.start || '').localeCompare(b.start || '');
    });
    const rows = shifts.map(sh => '<tr>'
      + '<td><div class="val">' + esc(sh.name || '-') + '</div></td>'
      + '<td>' + esc(sh.day || '-') + '</td>'
      + '<td>' + esc(sh.start || '-') + '</td>'
      + '<td>' + esc(sh.end || '-') + '</td>'
      + '<td>' + (sh.hours != null ? sh.hours.toFixed(1) : '-') + '</td>'
      + '<td>' + (sh.wage != null ? App.fmtCurrency(sh.wage) + '/hr' : '-') + '</td>'
      + '<td class="val">' + App.fmtCurrency(sh.cost || 0) + '</td>'
      + '</tr>').join('');

    const target = this.laborTarget();
    const pct = s.labor_pct;

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Revenue Forecast</div><div class="calc-val lg">' + App.fmtCurrency(s.revenue_forecast || 0) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor Hours</div><div class="calc-val lg">' + (s.total_hours != null ? s.total_hours.toFixed(1) : '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor Cost</div><div class="calc-val lg">' + App.fmtCurrency(s.total_cost || 0) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor %</div><div class="calc-val lg ' + (pct != null ? (pct > target ? 'warn' : 'good') : '') + '">'
      + (pct != null ? App.fmtPct(pct) : '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">RPLH</div><div class="calc-val lg">' + (s.rplh != null ? App.fmtCurrency(s.rplh) : '-') + '</div></div>'
      + '</div></div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Shift Schedule &middot; Week of ' + this.fmtDate(s.week_start) + '</div>'
      + '<div class="no-print" style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" id="lh-export">Export PDF</button></div></div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Staff</th><th>Day</th><th>Start</th><th>End</th><th>Hours</th><th>Wage</th><th>Cost</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + (s.notes ? '<div style="font-size:12px;color:var(--t3);margin-top:14px;">Notes: ' + esc(s.notes) + '</div>' : '')
      + '<div class="no-print" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px;">'
      + '<button class="btn btn-primary" id="lh-edit-detail">Edit in Build Schedule</button>'
      + '<button class="btn btn-ghost" id="lh-copy">Copy to New Week</button>'
      + '</div></div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#lh-export')) { App.exportPDF({ title: 'Schedule History', root: this.container }); return; }
      if (ev.target.closest('#lh-edit-detail')) this.editSchedule(id);
      else if (ev.target.closest('#lh-copy')) this.copyToNewWeek(s);
    };
  },

  // Hydrate a fresh Build Schedule draft from an existing schedule's shifts,
  // shifted forward by 7 days. Saves the operator from rebuilding a typical
  // week shift-by-shift when this week looks like last week.
  copyToNewWeek(src) {
    if (!src) return;
    const start = new Date((src.week_start || '') + 'T00:00:00');
    if (!isNaN(start.getTime())) start.setDate(start.getDate() + 7);
    const nextWeek = isNaN(start.getTime()) ? '' : App.ymdLocal(start);
    const draft = {
      week_start: nextWeek,
      shifts: (src.shifts || []).map(sh => ({
        staff_id: sh.staff_id || '',
        day: sh.day || 'Mon',
        start: sh.start || '',
        end: sh.end || ''
      })),
      notes: ''
    };
    // Push into Build Schedule's draft localStorage so a fresh entry hydrates
    // from the copy. editId stays null because this is a new schedule.
    try { localStorage.setItem(S.LaborBuildSchedule.DRAFT_KEY, JSON.stringify(draft)); } catch (e) {}
    if (S.LaborBuildSchedule) S.LaborBuildSchedule.editId = null;
    App.navigate('lc-build-schedule');
  },

  async confirmDel(id) {
    if (!(await App.confirmDelete())) return;
    await App.removeRecord('lc', 'schedule', id);
    this.renderList();
  }
};
