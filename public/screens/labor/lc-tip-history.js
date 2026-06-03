'use strict';

/* ── Labor Control — Tip History (reads lc_tips) ──────────────────────────────
   Historical tip analysis over a date range, three connected-tab views: by
   staff, by shift, and by week. Each tab exports its own PDF. */

S.LaborTipHistory = {
  filterFrom: '',
  filterTo: '',
  filterStaff: '',
  tab: 'staff',
  TABS: [['staff', 'By Staff'], ['shift', 'By Shift'], ['week', 'By Week']],

  tips() { return ((App.laborData && App.laborData.lc_tips) || []); },
  pools() { return ((App.laborData && App.laborData.lc_tip_pools) || []); },
  shifts() { return ((App.shiftData && App.shiftData.sc_shifts) || []); },
  shiftById(id) { return this.shifts().find(s => s.id === id); },
  inRange(t) {
    if (this.filterFrom && (t.date || '') < this.filterFrom) return false;
    if (this.filterTo && (t.date || '') > this.filterTo) return false;
    if (this.filterStaff && (t.staff_id || '') !== this.filterStaff) return false;
    return true;
  },
  mondayOf(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d.toISOString().slice(0, 10);
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(str + 'T00:00:00');
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // Staff who actually have tip entries (plus the current selection), so the
  // filter dropdown stays relevant.
  staffFilterOptions() {
    const seen = {};
    this.tips().forEach(t => { if (t.staff_id && !(t.staff_id in seen)) seen[t.staff_id] = t.name || '-'; });
    const list = Object.keys(seen).map(id => ({ id, name: seen[id] }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return '<option value="">All staff</option>'
      + list.map(o => '<option value="' + o.id + '"' + (this.filterStaff === o.id ? ' selected' : '') + '>' + esc(o.name) + '</option>').join('');
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderReport();
  },

  showHowTo() {
    App.showHelpModal('How Tip History Works', [
      { p: ['Tip History summarizes the tips you have logged over a date range, three ways: by staff, by shift, and by week. Set the range, and a staff member if you want just one person, then switch tabs to see each view.'] },
      { h: 'The Three Views', p: ['By Staff totals each person\'s cash, card, and average per entry. By Shift groups tips under the shift they were logged against and shows whether a pool split was saved for it. By Week rolls the range up week by week so you can watch the trend.'] },
      { h: 'Export', p: ['Each tab has its own Export PDF, so you can hand someone just the view they need, like one server\'s totals for the month.'] }
    ]);
  },

  renderReport() {
    this.actions.innerHTML = '';

    if (this.tips().length === 0) {
      App.setupCard(this.container, {
        title: 'Tip History',
        lead: 'Tip History summarizes the tips you log, by staff, by shift, and by week over any date range.',
        steps: [
          { title: 'Log your first tips', desc: 'Tips you log in the Tip Log show up here. Log some to get started.', btn: 'Go to Tip Log', screen: 'lc-tip-log', done: false }
        ]
      });
      return;
    }

    const rows = this.tips().filter(t => this.inRange(t));

    let summaryHtml = '';
    if (rows.length) {
      const cash = rows.reduce((t, x) => t + (x.cash_tips || 0), 0);
      const card = rows.reduce((t, x) => t + (x.card_tips || 0), 0);
      const total = cash + card;
      summaryHtml = '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
        + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val">' + rows.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Tips</div><div class="calc-val good">' + App.fmtCurrency(total) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Cash</div><div class="calc-val">' + App.fmtCurrency(cash) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Card</div><div class="calc-val">' + App.fmtCurrency(card) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Avg / Entry</div><div class="calc-val">' + App.fmtCurrency(rows.length ? total / rows.length : 0) + '</div></div>'
        + '</div>';
    }

    const filterCard = '<div class="card">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Date Range</span>'
      + App.helpButton('th-how') + '</div>'
      + '<div class="form-row no-print" style="gap:16px;margin-bottom:0;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label>'
      + '<input type="date" id="th-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label>'
      + '<input type="date" id="th-to" value="' + esc(this.filterTo) + '"/></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Staff</label>'
      + '<select id="th-staff">' + this.staffFilterOptions() + '</select></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<button class="btn btn-ghost" id="th-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div>'
      + summaryHtml
      + '</div>';

    if (rows.length === 0) {
      this.container.innerHTML = '<div class="screen">' + filterCard
        + '<div class="card"><div class="empty"><div class="empty-title">No tips in this range</div>'
        + '<div class="empty-sub">Adjust or clear the filters above.</div></div></div></div>';
    } else {
      this.container.innerHTML = '<div class="screen">' + filterCard
        + App.reportTabBar(this.TABS, this.tab)
        + App.reportPanel(this.TABS, this.tab, 'th-export', this.tabBody(rows)) + '</div>';
    }

    this.container.onclick = ev => {
      if (ev.target.closest('#th-how'))    { this.showHowTo(); return; }
      if (ev.target.closest('#th-export')) { App.exportPDF({ title: 'Tip History', root: this.container }); return; }
      const tab = ev.target.closest('.rpt-tab');
      if (tab) { this.tab = tab.dataset.tab; this.renderReport(); return; }
      if (ev.target.closest('#th-clear')) { this.filterFrom = this.filterTo = this.filterStaff = ''; this.renderReport(); return; }
    };
    const bind = (id, prop) => document.getElementById(id)?.addEventListener('change', e => {
      this[prop] = e.target.value || '';
      this.renderReport();
    });
    bind('th-from', 'filterFrom');
    bind('th-to', 'filterTo');
    bind('th-staff', 'filterStaff');
  },

  tabBody(rows) {
    if (this.tab === 'shift') return this.byShift(rows);
    if (this.tab === 'week') return this.byWeek(rows);
    return this.byStaff(rows);
  },

  byStaff(rows) {
    const g = {};
    rows.forEach(t => {
      const k = t.staff_id || t.name || '?';
      if (!g[k]) g[k] = { name: t.name || '-', count: 0, cash: 0, card: 0 };
      g[k].count++;
      g[k].cash += (t.cash_tips || 0);
      g[k].card += (t.card_tips || 0);
    });
    const trs = Object.keys(g)
      .sort((a, b) => (g[b].cash + g[b].card) - (g[a].cash + g[a].card))
      .map(k => {
        const s = g[k];
        const tot = s.cash + s.card;
        return '<tr><td><div class="val">' + esc(s.name) + '</div></td>'
          + '<td>' + s.count + '</td>'
          + '<td>' + App.fmtCurrency(s.cash) + '</td>'
          + '<td>' + App.fmtCurrency(s.card) + '</td>'
          + '<td class="val">' + App.fmtCurrency(tot) + '</td>'
          + '<td>' + App.fmtCurrency(s.count ? tot / s.count : 0) + '</td></tr>';
      }).join('');
    return '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Staff</th><th>Entries</th><th>Cash</th><th>Card</th><th>Total</th><th>Avg / Entry</th>'
      + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
  },

  // Tip entries with a shift_id group under the matching shift. POOL column
  // shows whether a pool split was saved for that shift.
  byShift(rows) {
    const linked = rows.filter(t => t.shift_id);
    if (!linked.length) {
      return '<div class="empty"><div class="empty-title">No shift-linked tips in this range</div>'
        + '<div class="empty-sub">Tips logged against a specific shift show up here.</div></div>';
    }
    const g = {};
    linked.forEach(t => {
      const k = t.shift_id;
      if (!g[k]) {
        const s = this.shiftById(k);
        g[k] = { shift_id: k, date: t.date, shift_type: t.shift_type || (s ? s.shift_type : '') || '', count: 0, cash: 0, card: 0, pool_amount: null };
      }
      g[k].count++;
      g[k].cash += (t.cash_tips || 0);
      g[k].card += (t.card_tips || 0);
    });
    this.pools().forEach(p => { if (g[p.shift_id]) g[p.shift_id].pool_amount = p.pool_amount; });
    const trs = Object.keys(g)
      .sort((a, b) => (g[b].date || '').localeCompare(g[a].date || ''))
      .map(k => {
        const x = g[k];
        const total = x.cash + x.card;
        const poolCell = x.pool_amount != null
          ? '<span style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--gold);">POOL ' + App.fmtCurrency(x.pool_amount) + '</span>'
          : '<span style="font-size:9px;color:var(--t4);text-transform:uppercase;letter-spacing:1px;">No pool saved</span>';
        return '<tr><td><div class="val">' + (x.date ? new Date(x.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '-') + '</div>'
          + (x.shift_type ? '<div style="font-size:10px;color:var(--t3);">' + esc(x.shift_type) + '</div>' : '') + '</td>'
          + '<td>' + x.count + '</td>'
          + '<td>' + App.fmtCurrency(x.cash) + '</td>'
          + '<td>' + App.fmtCurrency(x.card) + '</td>'
          + '<td class="val">' + App.fmtCurrency(total) + '</td>'
          + '<td>' + poolCell + '</td></tr>';
      }).join('');
    return '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Shift</th><th>Entries</th><th>Cash</th><th>Card</th><th>Total</th><th>Pool</th>'
      + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
  },

  byWeek(rows) {
    const g = {};
    rows.forEach(t => {
      const wk = this.mondayOf(t.date);
      if (!g[wk]) g[wk] = { count: 0, total: 0 };
      g[wk].count++;
      g[wk].total += (t.total_tips || 0);
    });
    const trs = Object.keys(g).sort((a, b) => b.localeCompare(a)).map(wk =>
      '<tr><td><div class="val">Week of ' + this.fmtDate(wk) + '</div></td>'
      + '<td>' + g[wk].count + '</td>'
      + '<td class="val">' + App.fmtCurrency(g[wk].total) + '</td></tr>').join('');
    return '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Week</th><th>Entries</th><th>Total Tips</th>'
      + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
  }
};
