'use strict';

/* ── Labor Control — Labor Reports (reads lc_actuals) ─────────────────────────
   Labor analysis over a date range, connected-tab views: by staff and by
   department, with tips context. Each tab exports its own PDF. */

S.LaborReports = {
  filterFrom: '',
  filterTo: '',
  tab: 'staff',
  TABS: [['staff', 'By Staff'], ['dept', 'By Department']],

  actuals() { return ((App.laborData && App.laborData.lc_actuals) || []); },
  tips()    { return ((App.laborData && App.laborData.lc_tips) || []); },
  positionById(id) { return ((App.laborData && App.laborData.lc_positions) || []).find(p => p.id === id); },

  inRange(rec) {
    if (this.filterFrom && (rec.date || '') < this.filterFrom) return false;
    if (this.filterTo && (rec.date || '') > this.filterTo) return false;
    return true;
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderReport();
  },

  showHowTo() {
    App.showHelpModal('How Labor Reports Work', [
      { p: ['Labor Reports total your labor over a date range, two ways: by staff and by department. Set the range and switch tabs to see each view.'] },
      { h: 'The Two Views', p: ['By Staff lists each person\'s hours, average wage, labor cost, and share of total labor, sorted by cost. By Department rolls the same up by department so you can see where the dollars go. Salaried staff carry their fixed weekly salary across the range; their logged hours are coverage only.'] },
      { h: 'Export', p: ['Each tab has its own Export PDF, so you can hand off just the staff view or just the department view.'] }
    ]);
  },

  renderReport() {
    this.actions.innerHTML = '';

    if (this.actuals().length === 0) {
      App.setupCard(this.container, {
        title: 'Labor Reports',
        lead: 'Labor Reports break your labor down by staff and by department over any date range, with tips context.',
        steps: [
          { title: 'Log some hours', desc: 'Hours you log in Log Hours feed this report. Log some to get started.', btn: 'Go to Log Hours', screen: 'lc-log-hours', done: false }
        ]
      });
      return;
    }

    const rows = this.actuals().filter(a => this.inRange(a));
    const tips = this.tips().filter(t => this.inRange(t));

    // Salaried (exempt) cost over the report span (explicit range, or the span
    // of the logged data when the filter is open-ended).
    const datesInRange = rows.map(a => a.date).filter(Boolean).sort();
    const rFrom = this.filterFrom || datesInRange[0] || '';
    const rTo   = this.filterTo   || datesInRange[datesInRange.length - 1] || '';
    const salWeeks = (rFrom && rTo)
      ? (Math.floor((new Date(rTo + 'T00:00:00').getTime() - new Date(rFrom + 'T00:00:00').getTime()) / 86400000) + 1) / 7
      : 0;
    const salRange = (rFrom && rTo) ? App.salariedCost(rFrom, rTo) : { total: 0, bar: 0, food: 0 };
    const totHours = rows.reduce((t, a) => t + (a.hours || 0), 0);
    const totCost = rows.reduce((t, a) => t + (a.cost || 0), 0) + salRange.total;
    const totTips = tips.reduce((t, x) => t + (x.total_tips || 0), 0);

    let summaryHtml = '';
    if (rows.length) {
      summaryHtml = '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
        + '<div class="calc-item"><div class="calc-label">Hours Entries</div><div class="calc-val">' + rows.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Hours</div><div class="calc-val">' + totHours.toFixed(1) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Labor Cost</div><div class="calc-val">' + App.fmtCurrency(totCost) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Avg Wage</div><div class="calc-val">' + App.fmtCurrency(totHours > 0 ? totCost / totHours : 0) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Tips Logged</div><div class="calc-val">' + App.fmtCurrency(totTips) + '</div></div>'
        + '</div>';
    }

    const filterCard = '<div class="card">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Date Range</span>'
      + App.helpButton('lr-how') + '</div>'
      + '<div class="form-row no-print" style="gap:16px;margin-bottom:0;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label>'
      + '<input type="date" id="lr-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label>'
      + '<input type="date" id="lr-to" value="' + esc(this.filterTo) + '"/></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<button class="btn btn-ghost" id="lr-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div>'
      + summaryHtml
      + '</div>';

    if (rows.length === 0) {
      this.container.innerHTML = '<div class="screen">' + filterCard
        + '<div class="card"><div class="empty"><div class="empty-title">No hours in this range</div>'
        + '<div class="empty-sub">Adjust or clear the date range above.</div></div></div></div>';
    } else {
      this.container.innerHTML = '<div class="screen">' + filterCard
        + App.reportTabBar(this.TABS, this.tab)
        + App.reportPanel(this.TABS, this.tab, 'lr-export', this.tabBody(rows, totCost, salWeeks)) + '</div>';
    }

    this.container.onclick = ev => {
      if (ev.target.closest('#lr-how'))    { this.showHowTo(); return; }
      if (ev.target.closest('#lr-export')) { App.exportPDF({ title: 'Labor Reports', root: this.container }); return; }
      const tab = ev.target.closest('.rpt-tab');
      if (tab) { this.tab = tab.dataset.tab; this.renderReport(); return; }
      if (ev.target.closest('#lr-clear')) { this.filterFrom = this.filterTo = ''; this.renderReport(); return; }
    };
    const bind = (id, prop) => document.getElementById(id)?.addEventListener('change', e => {
      this[prop] = e.target.value || '';
      this.renderReport();
    });
    bind('lr-from', 'filterFrom');
    bind('lr-to', 'filterTo');
  },

  tabBody(rows, totCost, salWeeks) {
    if (this.tab === 'dept') return this.byDept(rows, totCost, salWeeks);
    return this.byStaff(rows, totCost, salWeeks);
  },

  byStaff(rows, totCost, salWeeks) {
    const g = {};
    rows.forEach(a => {
      const k = a.staff_id || a.name || '?';
      if (!g[k]) g[k] = { name: a.name || '-', hours: 0, cost: 0 };
      g[k].hours += (a.hours || 0);
      g[k].cost += (a.cost || 0);
    });
    if (salWeeks > 0) {
      ((App.laborData && App.laborData.lc_staff) || []).forEach(st => {
        const wk = App.staffWeeklySalary(st);
        if (!wk) return;
        if (!g[st.id]) g[st.id] = { name: st.name || '-', hours: 0, cost: 0 };
        g[st.id].cost += wk * salWeeks;
      });
    }
    const trs = Object.keys(g).sort((a, b) => g[b].cost - g[a].cost).map(k => {
      const s = g[k];
      return '<tr><td><div class="val">' + esc(s.name) + '</div></td>'
        + '<td>' + s.hours.toFixed(1) + '</td>'
        + '<td>' + App.fmtCurrency(s.hours > 0 ? s.cost / s.hours : 0) + '</td>'
        + '<td class="val">' + App.fmtCurrency(s.cost) + '</td>'
        + '<td>' + (totCost > 0 ? App.fmtPct(s.cost / totCost * 100) : '-') + '</td></tr>';
    }).join('');
    return '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Staff</th><th>Hours</th><th>Avg Wage</th><th>Labor Cost</th><th>% of Labor</th>'
      + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
  },

  byDept(rows, totCost, salWeeks) {
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
    const trs = Object.keys(g).sort((a, b) => g[b].cost - g[a].cost).map(k =>
      '<tr><td><div class="val">' + esc(k) + '</div></td>'
      + '<td>' + g[k].hours.toFixed(1) + '</td>'
      + '<td class="val">' + App.fmtCurrency(g[k].cost) + '</td>'
      + '<td>' + (totCost > 0 ? App.fmtPct(g[k].cost / totCost * 100) : '-') + '</td></tr>').join('');
    return '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Department</th><th>Hours</th><th>Labor Cost</th><th>% of Labor</th>'
      + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
  }
};
