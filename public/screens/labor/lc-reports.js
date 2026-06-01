'use strict';

/* ── Labor Control — Labor Reports (reads lc_actuals) ─────────────────────────
   Labor analysis over a date range: hours and cost by staff and by department,
   with tips context. Export to PDF (Rule 10). */

S.LaborReports = {
  filterFrom: '',
  filterTo: '',

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

  renderReport() {
    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="lr-export">Export PDF</button>';
    document.getElementById('lr-export')?.addEventListener('click', () => App.exportPDF({ title: 'Labor Reports', root: this.container }));

    if (this.actuals().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">No labor data yet</div>'
        + '<div class="empty-sub">Log hours in Log Hours and this report will summarize labor cost by '
        + 'staff and department.</div></div></div>';
      this.container.onclick = null;
      return;
    }

    const rows = this.actuals().filter(a => this.inRange(a));
    const tips = this.tips().filter(t => this.inRange(t));

    const filterCard = '<div class="card"><div class="card-title">Date Range</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label>'
      + '<input type="date" id="lr-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label>'
      + '<input type="date" id="lr-to" value="' + esc(this.filterTo) + '"/></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<button class="btn btn-ghost" id="lr-clear">Clear</button></div>'
      + '</div></div>';

    let body;
    if (rows.length === 0) {
      body = '<div class="empty"><div class="empty-title">No hours in this range</div>'
        + '<div class="empty-sub">Adjust or clear the date range above.</div></div>';
    } else {
      const totHours = rows.reduce((t, a) => t + (a.hours || 0), 0);
      const totCost = rows.reduce((t, a) => t + (a.cost || 0), 0);
      const totTips = tips.reduce((t, x) => t + (x.total_tips || 0), 0);
      const summary = '<div class="calc" style="margin-bottom:16px;">'
        + '<div class="calc-item"><div class="calc-label">Hours Entries</div><div class="calc-val">' + rows.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Hours</div><div class="calc-val">' + totHours.toFixed(1) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Labor Cost</div><div class="calc-val">' + App.fmtCurrency(totCost) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Avg Wage</div><div class="calc-val">' + App.fmtCurrency(totHours > 0 ? totCost / totHours : 0) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Tips Logged</div><div class="calc-val">' + App.fmtCurrency(totTips) + '</div></div>'
        + '</div>';
      body = summary + this.byStaff(rows, totCost) + this.byDept(rows, totCost);
    }

    this.container.innerHTML = '<div class="screen">' + filterCard + body + '</div>';
    document.getElementById('lr-export')?.addEventListener('click', () => App.exportPDF({ title: 'Labor Reports', root: this.container }));
    this.container.onclick = ev => {
      if (ev.target.closest('#lr-clear')) {
        this.filterFrom = this.filterTo = '';
        this.renderReport();
      }
    };
    const bind = (id, prop) => document.getElementById(id)?.addEventListener('change', e => {
      this[prop] = e.target.value || '';
      this.renderReport();
    });
    bind('lr-from', 'filterFrom');
    bind('lr-to', 'filterTo');
  },

  byStaff(rows, totCost) {
    const g = {};
    rows.forEach(a => {
      const k = a.staff_id || a.name || '?';
      if (!g[k]) g[k] = { name: a.name || '-', hours: 0, cost: 0 };
      g[k].hours += (a.hours || 0);
      g[k].cost += (a.cost || 0);
    });
    const trs = Object.keys(g).sort((a, b) => g[b].cost - g[a].cost).map(k => {
      const s = g[k];
      return '<tr><td><div class="val">' + esc(s.name) + '</div></td>'
        + '<td>' + s.hours.toFixed(1) + '</td>'
        + '<td>' + App.fmtCurrency(s.hours > 0 ? s.cost / s.hours : 0) + '</td>'
        + '<td class="val">' + App.fmtCurrency(s.cost) + '</td>'
        + '<td>' + (totCost > 0 ? App.fmtPct(s.cost / totCost * 100) : '-') + '</td></tr>';
    }).join('');
    return '<div class="card"><div class="card-title">By Staff</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Staff</th><th>Hours</th><th>Avg Wage</th><th>Labor Cost</th><th>% of Labor</th>'
      + '</tr></thead><tbody>' + trs + '</tbody></table></div></div>';
  },

  byDept(rows, totCost) {
    const g = {};
    rows.forEach(a => {
      const pos = this.positionById(a.position_id);
      const dept = pos ? (pos.department || 'Other') : 'Unassigned';
      if (!g[dept]) g[dept] = { hours: 0, cost: 0 };
      g[dept].hours += (a.hours || 0);
      g[dept].cost += (a.cost || 0);
    });
    const trs = Object.keys(g).sort((a, b) => g[b].cost - g[a].cost).map(k =>
      '<tr><td><div class="val">' + esc(k) + '</div></td>'
      + '<td>' + g[k].hours.toFixed(1) + '</td>'
      + '<td class="val">' + App.fmtCurrency(g[k].cost) + '</td>'
      + '<td>' + (totCost > 0 ? App.fmtPct(g[k].cost / totCost * 100) : '-') + '</td></tr>').join('');
    return '<div class="card"><div class="card-title">By Department</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Department</th><th>Hours</th><th>Labor Cost</th><th>% of Labor</th>'
      + '</tr></thead><tbody>' + trs + '</tbody></table></div></div>';
  }
};
