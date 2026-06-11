'use strict';

/* ── Labor Control — Tip History (reads lc_tips) ──────────────────────────────
   Historical tip analysis over a date range, three connected-tab views: by
   staff, by shift, and by week. Read-only. A plain .ch-tabs switcher over a
   stats card, then a single row of time-range chips (Export on the right) sitting
   directly above the data card. The range is global to the report, so it persists
   across tab switches; time is the only filter (the Log Hours chip model). */

S.LaborTipHistory = {
  filterPreset: 'last-4',  // active range chip: this-week|last-week|this-month|last-4|all|custom
  _prevPreset: 'last-4',   // range to restore when Custom is toggled closed
  filterFrom: '',          // custom range only
  filterTo: '',            // custom range only
  tab: 'staff',
  TABS: [['staff', 'By Staff'], ['shift', 'By Shift'], ['week', 'By Week']],
  // Single-select time range chips (the only filter), daily cadence. Mirrors Log Hours.
  RANGE_CHIPS: [
    { v: 'this-week', label: 'This Week' }, { v: 'last-week', label: 'Last Week' },
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],

  tips() { return ((App.laborData && App.laborData.lc_tips) || []); },
  pools() { return ((App.laborData && App.laborData.lc_tip_pools) || []); },
  shifts() { return ((App.shiftData && App.shiftData.sc_shifts) || []); },
  shiftById(id) { return this.shifts().find(s => s.id === id); },
  // Effective date window from the active range chip (preset recomputed off "today"
  // each render so This Week stays live); Custom reads the From/To pickers.
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  inRange(t) {
    const { from, to } = this.effectiveRange();
    const date = t.date || '';
    if (from && date < from) return false;
    if (to && date > to) return false;
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

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderReport();
  },

  showHowTo() {
    App.showHelpModal('How Tip History Works', [
      { p: ['Tip History summarizes the tips you have logged over a date range, three ways: by staff, by shift, and by week. Pick a range with the chips above the table, then switch tabs to see each view.'] },
      { h: 'The Three Views', p: ['By Staff totals each person\'s cash and card; if you use tip-outs, it also shows their tip-out adjustment and net take-home. By Shift groups tips under the shift they were logged against and shows whether a pool split was saved for it. By Week rolls the range up week by week so you can watch the trend.'] },
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
    return '<tr><td colspan="' + cols + '" style="color:var(--t3);padding:12px 8px;">' + esc(msg || 'No tips in this range. Pick a wider range above.') + '</td></tr>';
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

    this.container.innerHTML = '<div class="screen">'
      + this.tabBar()
      + statsCard
      + this.filterRow()
      + this.tabBody(rows)
      + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#th-export')) { App.exportPDF({ title: 'Tip History', root: this.container }); return; }
      const tab = ev.target.closest('.ch-tab');
      if (tab) { this.tab = tab.dataset.tab; this.renderReport(); return; }
      const chip = ev.target.closest('.th-range-chip');
      if (chip) {
        const v = chip.dataset.v;
        if (v === 'custom') {
          // Custom toggles: a second click closes the pickers and restores the prior range.
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.renderReport();
        return;
      }
    };
    document.getElementById('th-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderReport(); });
    document.getElementById('th-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderReport(); });
  },

  // Range chips on the left, Export on the right (no filter card), directly above
  // the data block. Picking Custom reveals a bare From/To row. Mirrors Log Hours.
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'th-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
        + '<button class="btn btn-ghost btn-sm" id="th-export">Export PDF</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="th-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="th-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
  },

  tabBody(rows) {
    if (this.tab === 'shift') return this.byShift(rows);
    if (this.tab === 'week') return this.byWeek(rows);
    return this.byStaff(rows);
  },

  byStaff(rows) {
    const hasTipOut = rows.some(t => (t.tip_out_paid || 0) > 0 || (t.tip_out_received || 0) > 0);
    const g = {};
    rows.forEach(t => {
      const k = t.staff_id || t.name || '?';
      if (!g[k]) g[k] = { name: t.name || '-', count: 0, cash: 0, card: 0, tipout: 0, net: 0 };
      g[k].count++;
      g[k].cash += (t.cash_tips || 0);
      g[k].card += (t.card_tips || 0);
      g[k].tipout += (parseFloat(t.tip_out_received) || 0) - (parseFloat(t.tip_out_paid) || 0);
      g[k].net += App.netTips(t);
    });
    // When the range has tip-outs, show the tip-out adjustment + net take-home
    // instead of the gross total/average, since net is what actually matters.
    if (hasTipOut) {
      const trs = Object.keys(g).sort((a, b) => g[b].net - g[a].net).map(k => {
        const s = g[k];
        const toCell = Math.abs(s.tipout) < 0.005 ? '-' : (s.tipout > 0 ? '+' : '') + App.fmtCurrency(s.tipout, 2);
        return '<tr><td><div class="val">' + esc(s.name) + '</div></td>'
          + '<td>' + s.count + '</td>'
          + '<td>' + App.fmtCurrency(s.cash) + '</td>'
          + '<td>' + App.fmtCurrency(s.card) + '</td>'
          + '<td>' + toCell + '</td>'
          + '<td class="val">' + App.fmtCurrency(s.net) + '</td></tr>';
      }).join('') || this.noRow(6);
      return this.dataCard('<th>Staff</th><th>Entries</th><th>Cash</th><th>Card</th><th>Tip-Out</th><th>Net Tips</th>', trs);
    }
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
