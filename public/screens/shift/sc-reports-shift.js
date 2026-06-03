'use strict';

/* ── Shift Control — Shift Reports (reads sc_shifts) ──────────────────────────
   Aggregates logged shifts into revenue and covers analysis: totals, by shift
   type, and by day of week, over a chosen date range. Export to PDF via the
   print stylesheet (Rule 10). */

S.ShiftReportsShift = {
  filterFrom: '',
  filterTo: '',
  DOW: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],

  shifts() {
    return ((App.shiftData && App.shiftData.sc_shifts) || []);
  },
  filtered() {
    return this.shifts().filter(s => {
      if (this.filterFrom && (s.date || '') < this.filterFrom) return false;
      if (this.filterTo && (s.date || '') > this.filterTo) return false;
      return true;
    });
  },
  dowOf(date) {
    const d = new Date(String(date).length <= 10 ? date + 'T00:00:00' : date);
    return isNaN(d.getTime()) ? -1 : d.getDay();
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderReport();
  },

  renderReport() {
    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="rs-export">Export PDF</button>';
    document.getElementById('rs-export')?.addEventListener('click', () => App.exportPDF({ title: 'Shift Reports', root: this.container }));

    const all = this.shifts();
    if (all.length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">No shift data yet</div>'
        + '<div class="empty-sub">Log shifts in Active Shift or Log a Shift and this report will summarize '
        + 'revenue, covers, and check average by shift type and day of week.</div></div></div>';
      this.container.onclick = null;
      return;
    }

    const rows = this.filtered();
    const filterCard = '<div class="card"><div class="card-title">Date Range</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label>'
      + '<input type="date" id="rs-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label>'
      + '<input type="date" id="rs-to" value="' + esc(this.filterTo) + '"/></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<button class="btn btn-ghost" id="rs-clear">Clear</button></div>'
      + '</div></div>';

    let body;
    if (rows.length === 0) {
      body = '<div class="empty"><div class="empty-title">No shifts in this range</div>'
        + '<div class="empty-sub">Adjust or clear the date range above.</div></div>';
    } else {
      const totRev = rows.reduce((t, s) => t + (s.total_revenue || 0), 0);
      const totCov = rows.reduce((t, s) => t + (s.covers || 0), 0);
      const avgChk = totCov > 0 ? totRev / totCov : null;
      const avgRev = rows.length ? totRev / rows.length : 0;

      const summary = '<div class="calc" style="margin-bottom:16px;">'
        + '<div class="calc-item"><div class="calc-label">Shifts</div><div class="calc-val">' + rows.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val">' + App.fmtCurrency(totRev) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Avg Revenue / Shift</div><div class="calc-val">' + App.fmtCurrency(avgRev) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Covers</div><div class="calc-val">' + totCov + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Avg Check</div><div class="calc-val">' + (avgChk != null ? App.fmtCurrency(avgChk) : '-') + '</div></div>'
        + '</div>';

      body = summary
        + this.groupTable('By Shift Type', rows, s => s.shift_type || 'Unspecified')
        + this.groupTable('By Day of Week', rows, s => { const d = this.dowOf(s.date); return d >= 0 ? this.DOW[d] : 'Unknown'; }, this.DOW);
    }

    this.container.innerHTML = '<div class="screen">' + filterCard + body + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#rs-clear')) {
        this.filterFrom = this.filterTo = '';
        this.renderReport();
      }
    };
    const bind = (id, prop) => document.getElementById(id)?.addEventListener('change', e => {
      this[prop] = e.target.value || '';
      this.renderReport();
    });
    bind('rs-from', 'filterFrom');
    bind('rs-to', 'filterTo');
  },

  // generic grouped breakdown table
  groupTable(title, rows, keyFn, order) {
    const groups = {};
    rows.forEach(s => {
      const k = keyFn(s);
      if (!groups[k]) groups[k] = { count: 0, rev: 0, cov: 0 };
      groups[k].count++;
      groups[k].rev += (s.total_revenue || 0);
      groups[k].cov += (s.covers || 0);
    });
    let keys = Object.keys(groups);
    keys = order
      ? order.filter(k => groups[k]).concat(keys.filter(k => order.indexOf(k) < 0))
      : keys.sort((a, b) => groups[b].rev - groups[a].rev);

    const trs = keys.map(k => {
      const g = groups[k];
      const avgRev = g.count ? g.rev / g.count : 0;
      const avgCov = g.count ? g.cov / g.count : 0;
      const avgChk = g.cov > 0 ? g.rev / g.cov : null;
      return '<tr><td><div class="val">' + esc(k) + '</div></td>'
        + '<td>' + g.count + '</td>'
        + '<td class="val">' + App.fmtCurrency(g.rev) + '</td>'
        + '<td>' + App.fmtCurrency(avgRev) + '</td>'
        + '<td>' + g.cov + '</td>'
        + '<td>' + avgCov.toFixed(1) + '</td>'
        + '<td>' + (avgChk != null ? App.fmtCurrency(avgChk) : '-') + '</td></tr>';
    }).join('');

    return '<div class="card"><div class="card-title">' + title + '</div>'
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>' + (title.indexOf('Day') > -1 ? 'Day' : 'Shift Type') + '</th><th>Shifts</th><th>Total Revenue</th>'
      + '<th>Avg Revenue</th><th>Covers</th><th>Avg Covers</th><th>Avg Check</th>'
      + '</tr></thead><tbody>' + trs + '</tbody></table></div></div>';
  }
};
