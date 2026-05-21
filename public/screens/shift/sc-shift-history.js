'use strict';

/* ── Shift Control — Shift History (reads sc_shifts) ──────────────────────────
   Read-only review of every logged shift. Summary strip, filters (shift type,
   status, date range), a per-shift detail view, and print-to-PDF export. Editing
   happens in Log a Shift — this screen only reads. */

S.ShiftHistory = {
  filterType: '',
  filterStatus: '',
  filterFrom: '',
  filterTo: '',

  shifts() {
    return ((App.shiftData && App.shiftData.sc_shifts) || []);
  },
  sorted() {
    return [...this.shifts()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
  },
  fmtDate(str) {
    if (!str) return '—';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  filtered() {
    return this.sorted().filter(s => {
      if (this.filterType && s.shift_type !== this.filterType) return false;
      if (this.filterStatus && (s.status || 'Closed') !== this.filterStatus) return false;
      if (this.filterFrom && (s.date || '') < this.filterFrom) return false;
      if (this.filterTo && (s.date || '') > this.filterTo) return false;
      return true;
    });
  },

  // ── Entry ───────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  renderList() {
    const all = this.shifts();
    this.actions.innerHTML = '';

    if (all.length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">No shifts logged yet</div>'
        + '<div class="empty-sub">Shifts you record in Log a Shift appear here, with revenue, '
        + 'covers, and check average. Shift revenue is what feeds your weekly Profit and Revenue numbers.</div>'
        + '<button class="btn btn-primary" id="sh-log">Log a Shift</button></div></div>';
      this.container.onclick = ev => {
        if (ev.target.closest('#sh-log')) App.navigate('sc-log-shift');
      };
      return;
    }

    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="sh-export">Export PDF</button>';

    const rows = this.filtered();
    const totRev = rows.reduce((t, s) => t + (s.total_revenue || 0), 0);
    const totCov = rows.reduce((t, s) => t + (s.covers || 0), 0);
    const avgChk = totCov > 0 ? totRev / totCov : null;

    const SHIFT_TYPES = (S.ShiftLogShift && S.ShiftLogShift.SHIFT_TYPES) || ['Brunch', 'Lunch', 'Dinner', 'Late Night', 'Full Day'];
    const typeOpts = '<option value="">All shift types</option>'
      + SHIFT_TYPES.map(t => '<option' + (this.filterType === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const statusOpts = ['', 'Open', 'Closed'].map(s =>
      '<option value="' + s + '"' + (this.filterStatus === s ? ' selected' : '') + '>'
      + (s === '' ? 'All statuses' : s) + '</option>').join('');

    const summary = '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Shifts</div><div class="calc-val">' + rows.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val">' + App.fmtCurrency(totRev) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Covers</div><div class="calc-val">' + totCov + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Avg Check</div><div class="calc-val">' + (avgChk != null ? App.fmtCurrency(avgChk) : '—') + '</div></div>'
      + '</div>';

    const filters = '<div class="card"><div class="card-title">Filter</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;">'
      + '<div class="f" style="width:180px;flex-shrink:0;"><label>Shift Type</label>'
      + '<select id="sh-f-type">' + typeOpts + '</select></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Status</label>'
      + '<select id="sh-f-status">' + statusOpts + '</select></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label>'
      + '<input type="date" id="sh-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label>'
      + '<input type="date" id="sh-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<button class="btn btn-ghost" id="sh-f-clear">Clear</button></div>'
      + '</div></div>';

    let table;
    if (rows.length === 0) {
      table = '<div class="empty"><div class="empty-title">No shifts match these filters</div>'
        + '<div class="empty-sub">Adjust or clear the filters above to see logged shifts.</div></div>';
    } else {
      const trs = rows.map(s => {
        const checkAvg = (s.covers && s.covers > 0) ? (s.total_revenue || 0) / s.covers : null;
        const status = (s.status === 'Open')
          ? '<span class="badge badge-ok">Open</span>'
          : '<span class="badge badge-dim">Closed</span>';
        return '<tr class="sh-row" data-id="' + s.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(s.date) + '</div></td>'
          + '<td>' + esc(s.shift_type || '—') + '</td>'
          + '<td>' + esc(s.manager || '—') + '</td>'
          + '<td class="val">' + App.fmtCurrency(s.total_revenue || 0) + '</td>'
          + '<td>' + (s.covers != null ? s.covers : '—') + '</td>'
          + '<td>' + (checkAvg != null ? App.fmtCurrency(checkAvg) : '—') + '</td>'
          + '<td>' + status + '</td></tr>';
      }).join('');
      table = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Shift</th><th>Manager</th><th>Revenue</th>'
        + '<th>Covers</th><th>Check Avg</th><th>Status</th>'
        + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">' + summary + filters + table + '</div>';

    document.getElementById('sh-export')?.addEventListener('click', () => window.print());
    this.container.onclick = ev => {
      const row = ev.target.closest('.sh-row');
      if (ev.target.closest('#sh-f-clear')) {
        this.filterType = this.filterStatus = this.filterFrom = this.filterTo = '';
        this.renderList();
      } else if (row) {
        this.renderDetail(row.dataset.id);
      }
    };
    const bind = (id, prop) => document.getElementById(id)?.addEventListener('change', e => {
      this[prop] = e.target.value || '';
      this.renderList();
    });
    bind('sh-f-type', 'filterType');
    bind('sh-f-status', 'filterStatus');
    bind('sh-f-from', 'filterFrom');
    bind('sh-f-to', 'filterTo');
  },

  // ── Detail ──────────────────────────────────────────────────────────────────
  renderDetail(id) {
    const s = this.shifts().find(x => x.id === id);
    if (!s) { this.renderList(); return; }

    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="sh-export">Export PDF</button>';
    document.getElementById('sh-export')?.addEventListener('click', () => window.print());

    const checkAvg = (s.covers && s.covers > 0) ? (s.total_revenue || 0) / s.covers : null;
    const meta = (label, val) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val">' + val + '</div></div>';
    const field = (label, val) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val">' + val + '</div></div>';

    const notesCard = s.notes
      ? '<div class="card"><div class="card-title">Notes</div>'
        + '<div style="font-size:13px;color:var(--t1);white-space:pre-wrap;">' + esc(s.notes) + '</div></div>'
      : '';

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="sh-back">&#8592; Back to Shift History</button></div>'
      + '<div class="card"><div class="card-title">'
      + esc(s.shift_type || 'Shift') + ' &middot; ' + this.fmtDate(s.date) + '</div>'
      + '<div class="calc" style="margin-bottom:0;">'
      + meta('Manager', esc(s.manager || '—'))
      + meta('Status', s.status === 'Open' ? 'Open' : 'Closed')
      + meta('Staff on Floor', s.staff_on_floor != null ? s.staff_on_floor : '—')
      + meta('Opening Bank', s.opening_bank != null ? App.fmtCurrency(s.opening_bank) : '—')
      + '</div></div>'
      + '<div class="card"><div class="card-title">Revenue</div>'
      + '<div class="calc" style="margin-bottom:0;">'
      + field('Bar Revenue', App.fmtCurrency(s.bar_revenue || 0))
      + field('Floor Revenue', App.fmtCurrency(s.floor_revenue || 0))
      + field('Total Revenue', App.fmtCurrency(s.total_revenue || 0))
      + field('Covers', s.covers != null ? s.covers : '—')
      + field('Check Average', checkAvg != null ? App.fmtCurrency(checkAvg) : '—')
      + '</div></div>'
      + notesCard
      + '<div class="card-actions" style="margin-top:4px;">'
      + '<button class="btn btn-ghost" id="sh-edit">Edit in Log a Shift</button></div>'
      + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#sh-back')) this.renderList();
      else if (ev.target.closest('#sh-edit')) App.navigate('sc-log-shift');
    };
  }
};
