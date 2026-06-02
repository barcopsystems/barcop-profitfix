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

    let html;
    if (list.length === 0) {
      html = '<div class="empty"><div class="empty-title">No schedules yet</div>'
        + '<div class="empty-sub">Schedules you save in Build Schedule are listed here, with labor cost, '
        + 'labor %, and RPLH.</div>'
        + '<button class="btn btn-primary" id="lh-build">Build a Schedule</button></div>';
    } else {
      const totCost = list.reduce((t, s) => t + (s.total_cost || 0), 0);
      const summary = '<div class="calc" style="margin-bottom:16px;">'
        + '<div class="calc-item"><div class="calc-label">Schedules</div><div class="calc-val">' + list.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Scheduled Labor</div><div class="calc-val">' + App.fmtCurrency(totCost) + '</div></div>'
        + '</div>';
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
      html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Week Starting</th><th>Shifts</th><th>Hours</th><th>Labor Cost</th>'
        + '<th>Labor %</th><th>RPLH</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('lc', 'schedule', list, false);
    }

    const modal = '<div id="lh-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this schedule?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="lh-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="lh-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row = ev.target.closest('.lh-row');
      const view = ev.target.closest('.lh-view');
      const edit = ev.target.closest('.lh-edit');
      const del = ev.target.closest('.lh-del');
      const build = ev.target.closest('#lh-build');
      if (del)        { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit)  { ev.stopPropagation(); this.editSchedule(edit.dataset.id); }
      else if (view)  { ev.stopPropagation(); this.renderDetail(view.dataset.id); }
      else if (row)   this.renderDetail(row.dataset.id);
      else if (build) App.navigate('lc-build-schedule');
    };
  },

  editSchedule(id) {
    if (S.LaborBuildSchedule) S.LaborBuildSchedule.editId = id;
    App.navigate('lc-build-schedule');
  },

  renderDetail(id) {
    const s = this.schedules().find(x => x.id === id);
    if (!s) { this.renderList(); return; }

    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="lh-export">Export PDF</button>';
    document.getElementById('lh-export')?.addEventListener('click', () => App.exportPDF({ title: 'Schedule History', root: this.container }));

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
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="lh-back">&#8592; Back to Schedule History</button></div>'
      + '<div class="card"><div class="card-title">Schedule &middot; Week of ' + this.fmtDate(s.week_start) + '</div>'
      + '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Revenue Forecast</div><div class="calc-val">' + App.fmtCurrency(s.revenue_forecast || 0) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor Hours</div><div class="calc-val">' + (s.total_hours != null ? s.total_hours.toFixed(1) : '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor Cost</div><div class="calc-val">' + App.fmtCurrency(s.total_cost || 0) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor %</div><div class="calc-val ' + (pct != null ? (pct > target ? 'warn' : 'good') : '') + '">'
      + (pct != null ? App.fmtPct(pct) : '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">RPLH</div><div class="calc-val">' + (s.rplh != null ? App.fmtCurrency(s.rplh) : '-') + '</div></div>'
      + '</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Staff</th><th>Day</th><th>Start</th><th>End</th><th>Hours</th><th>Wage</th><th>Cost</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + (s.notes ? '<div style="font-size:12px;color:var(--t3);margin-top:12px;">Notes: ' + esc(s.notes) + '</div>' : '')
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="lh-edit-detail">Edit in Build Schedule</button>'
      + '<button class="btn btn-ghost" id="lh-copy">Copy to New Week</button>'
      + '</div></div></div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#lh-back')) this.renderList();
      else if (ev.target.closest('#lh-edit-detail')) this.editSchedule(id);
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
    const nextWeek = isNaN(start.getTime()) ? '' : start.toISOString().slice(0, 10);
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

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('lh-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('lh-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('lh-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      await App.removeRecord('lc', 'schedule', delId);
      this.renderList();
    };
  }
};
