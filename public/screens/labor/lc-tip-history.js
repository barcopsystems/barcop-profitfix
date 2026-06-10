'use strict';

/* ── Labor Control — Tip History (reads lc_tips) ──────────────────────────────
   Historical tip analysis over a date range, three connected-tab views: by
   staff, by shift, and by week. Read-only. Same tabbed shell as Cash History:
   a plain .ch-tabs switcher over a stats card, a Filter heading with Export,
   the controls-only filter card, then the data card. The From/To/Staff filter
   is global to the report, so it persists across tab switches. */

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
    return App.ymdLocal(d);
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
      { h: 'Export', p: ['Export PDF saves whichever tab you are on, so you can hand someone just the view they need, like one server\'s totals for the month.'] }
    ]);
  },

  // ── shared markup helpers (mirror Cash History) ─────────────────────────────
  tabBar() {
    return '<div class="ch-tabs no-print">'
      + this.TABS.map(([k, label]) => '<button class="ch-tab' + (this.tab === k ? ' on' : '') + '" data-tab="' + esc(k) + '">' + esc(label) + '</button>').join('')
      + '</div>';
  },
  statItem(label, val, cls) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
  },
  statsCard(items) {
    return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>';
  },
  dataCard(headers, rowsHtml) {
    return '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + headers + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>';
  },
  noRow(cols, msg) {
    return '<tr><td colspan="' + cols + '" style="color:var(--t3);padding:12px 8px;">' + esc(msg || 'No tips match the filter.') + '</td></tr>';
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
    const cash = rows.reduce((t, x) => t + (x.cash_tips || 0), 0);
    const card = rows.reduce((t, x) => t + (x.card_tips || 0), 0);
    const total = cash + card;

    const statsCard = this.statsCard(
      this.statItem('Entries', rows.length)
      + this.statItem('Total Tips', App.fmtCurrency(total))
      + this.statItem('Cash', App.fmtCurrency(cash))
      + this.statItem('Card', App.fmtCurrency(card))
      + this.statItem('Avg / Entry', App.fmtCurrency(rows.length ? total / rows.length : 0)));

    const filterHeading = '<div class="no-print" style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:24px 0 10px;">'
      + '<button class="btn btn-ghost btn-sm" id="th-export">Export PDF</button></div>';

    const filterCard = '<div class="card no-print"><div class="form-row" style="gap:14px;align-items:flex-end;margin-bottom:0;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="th-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="th-to" value="' + esc(this.filterTo) + '"/></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Staff</label><select id="th-staff">' + this.staffFilterOptions() + '</select></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="th-clear">Clear</button></div>'
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px;">' + App.datePresetButtons('th-preset') + '</div></div>';

    this.container.innerHTML = '<div class="screen">'
      + this.tabBar()
      + statsCard
      + filterHeading
      + filterCard
      + this.tabBody(rows)
      + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#th-export')) { App.exportPDF({ title: 'Tip History', root: this.container }); return; }
      const tab = ev.target.closest('.ch-tab');
      if (tab) { this.tab = tab.dataset.tab; this.renderReport(); return; }
      if (ev.target.closest('#th-clear')) { this.filterFrom = this.filterTo = this.filterStaff = ''; this.renderReport(); return; }
      const thPreset = ev.target.closest('.th-preset');
      if (thPreset) { const r = App.datePresetRange(thPreset.dataset.preset); this.filterFrom = r.from; this.filterTo = r.to; this.renderReport(); return; }
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
      }).join('') || this.noRow(6);
    return this.dataCard('<th>Staff</th><th>Entries</th><th>Cash</th><th>Card</th><th>Total</th><th>Avg / Entry</th>', trs);
  },

  // Tip entries with a shift_id group under the matching shift. POOL column
  // shows whether a pool split was saved for that shift.
  byShift(rows) {
    const linked = rows.filter(t => t.shift_id);
    if (!linked.length) {
      return this.dataCard('<th>Shift</th><th>Entries</th><th>Cash</th><th>Card</th><th>Total</th><th>Pool</th>',
        this.noRow(6, 'No shift-linked tips in this range. Tips logged against a specific shift show up here.'));
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
          ? '<span style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--t2);">POOL ' + App.fmtCurrency(x.pool_amount) + '</span>'
          : '<span style="font-size:9px;color:var(--t4);text-transform:uppercase;letter-spacing:1px;">No pool saved</span>';
        return '<tr><td><div class="val">' + (x.date ? new Date(x.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '-') + '</div>'
          + (x.shift_type ? '<div style="font-size:10px;color:var(--t3);">' + esc(x.shift_type) + '</div>' : '') + '</td>'
          + '<td>' + x.count + '</td>'
          + '<td>' + App.fmtCurrency(x.cash) + '</td>'
          + '<td>' + App.fmtCurrency(x.card) + '</td>'
          + '<td class="val">' + App.fmtCurrency(total) + '</td>'
          + '<td>' + poolCell + '</td></tr>';
      }).join('');
    return this.dataCard('<th>Shift</th><th>Entries</th><th>Cash</th><th>Card</th><th>Total</th><th>Pool</th>', trs);
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
      + '<td class="val">' + App.fmtCurrency(g[wk].total) + '</td></tr>').join('') || this.noRow(3);
    return this.dataCard('<th>Week</th><th>Entries</th><th>Total Tips</th>', trs);
  }
};
