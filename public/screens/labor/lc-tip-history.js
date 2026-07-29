'use strict';

/* ── Labor Control — Tip History (reads lc_tips + lc_tip_pools) ───────────────
   Read-only history over a date range, three connected-tab views: tips By Staff,
   tips By Week, and the saved Tip Pools (with a per-person split View). A plain
   .ch-tabs switcher over a stats card, then a single row of time-range chips
   (Export on the right) directly above the data card. The range is global to the
   report, so it persists across tab switches; time is the only filter. */

S.LaborTipHistory = {
  filterPreset: 'last-4',  // active range chip: this-week|last-week|this-month|last-4|all|custom
  _prevPreset: 'last-4',   // range to restore when Custom is toggled closed
  filterFrom: '',          // custom range only
  filterTo: '',            // custom range only
  tab: 'staff',
  TABS: [['staff', 'By Staff'], ['week', 'By Week'], ['pools', 'Tip Pools']],
  // Single-select time range chips (the only filter), daily cadence. Mirrors Log Hours.
  RANGE_CHIPS: [
    { v: 'this-week', label: 'This Week' }, { v: 'last-week', label: 'Last Week' },
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],

  tips() { return ((App.laborData && App.laborData.lc_tips) || []); },
  pools() { return ((App.laborData && App.laborData.lc_tip_pools) || []); },
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
  // Hours were printed RAW here (the only numbers in the app that were), so a stored sum of decimal
  // hours surfaced its floating-point tail: 8.1 + 8.2 rendered as 16.299999999999999. Matches the
  // tip-log convention: 2dp, with a whole number left clean.
  fmtHours(n) {
    const v = Number(n);
    if (!isFinite(v)) return '-';
    return v.toFixed(2).replace(/\.00$/, '');
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderReport();
  },

  showHowTo() {
    App.showHelpModal('How Tip History Works', [
      { p: ['Tip History summarizes what you logged over a date range: tips By Staff, tips By Week, and your saved Tip Pools. Pick a range with the chips above the table, then switch tabs to see each view.'] },
      { h: 'The Three Views', p: ['By Staff totals each person\'s cash and card; with tip-outs on it also shows their tip-out adjustment and net take-home. By Week rolls the range up week by week with the same cash, card, and net breakdown so you can watch the trend. Tip Pools lists every pool you saved in the range, and View opens its per-person split.'] },
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
    return '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + headers + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
  },
  noRow(cols, msg) {
    return '<tr><td colspan="' + cols + '" style="color:var(--t3);padding:12px 8px;">' + esc(msg || 'No tips in this range. Pick a wider range above.') + '</td></tr>';
  },

  renderReport() {
    this.actions.innerHTML = '';

    if (this.tips().length === 0 && this.pools().length === 0) {
      App.setupCard(this.container, {
        title: 'Tip History',
        lead: 'Tip History summarizes the tips you log, by staff and by week, plus the tip pools you save, over any date range.',
        steps: [
          { title: 'Log your first tips', desc: 'Tips and pools you record in Tip Tracking show up here. Log some to get started.', btn: 'Go to Tip Tracking', screen: 'lc-tip-log', done: false }
        ]
      });
      return;
    }

    const rows = this.tips().filter(t => this.inRange(t));
    const poolRows = this.pools().filter(p => this.inRange(p));

    let statsCard;
    if (this.tab === 'pools') {
      const poolTotal = poolRows.reduce((s, p) => s + (p.pool_amount || 0), 0);
      statsCard = this.statsCard(
        this.statItem('Pools', poolRows.length)
        + this.statItem('Total Pooled', App.fmtCurrency(poolTotal))
        + this.statItem('Avg Pool', App.fmtCurrency(poolRows.length ? poolTotal / poolRows.length : 0)));
    } else {
      const cash = rows.reduce((t, x) => t + (x.cash_tips || 0), 0);
      const card = rows.reduce((t, x) => t + (x.card_tips || 0), 0);
      const total = cash + card;
      statsCard = this.statsCard(
        this.statItem('Entries', rows.length)
        + this.statItem('Total Tips', App.fmtCurrency(total))
        + this.statItem('Cash', App.fmtCurrency(cash))
        + this.statItem('Card', App.fmtCurrency(card))
        + this.statItem('Avg / Entry', App.fmtCurrency(rows.length ? total / rows.length : 0)));
    }

    this.container.innerHTML = '<div class="screen">'
      + this.tabBar()
      + statsCard
      + this.filterRow()
      + this.tabBody(rows, poolRows)
      + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#th-export')) {
        // Range chips + custom From/To are all inside `no-print` rows, so a tip history handed
        // to a bookkeeper could not say which weeks it covered. (The Tip Pool export below is a
        // single pool's detail: the record is its identity, so it needs no range.)
        const r = this.effectiveRange();
        App.exportPDF({ title: 'Tip History', root: this.container,
          range: App.chipRangeLabel(this.RANGE_CHIPS, this.filterPreset, r.from, r.to) });
        return;
      }
      const pview = ev.target.closest('.th-pview');
      if (pview) { this.openPoolView(pview.dataset.id); return; }
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

  tabBody(rows, poolRows) {
    if (this.tab === 'pools') return this.byPools(poolRows);
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

  // Weekly roll-up with the same cash / card / net breakdown as By Staff, so the
  // view carries real detail (not just one total column).
  byWeek(rows) {
    const hasTipOut = rows.some(t => (t.tip_out_paid || 0) > 0 || (t.tip_out_received || 0) > 0);
    const g = {};
    rows.forEach(t => {
      const wk = this.mondayOf(t.date);
      if (!g[wk]) g[wk] = { count: 0, cash: 0, card: 0, tipout: 0, net: 0 };
      g[wk].count++;
      g[wk].cash += (t.cash_tips || 0);
      g[wk].card += (t.card_tips || 0);
      g[wk].tipout += (parseFloat(t.tip_out_received) || 0) - (parseFloat(t.tip_out_paid) || 0);
      g[wk].net += App.netTips(t);
    });
    const keys = Object.keys(g).sort((a, b) => b.localeCompare(a));
    if (hasTipOut) {
      const trs = keys.map(wk => {
        const s = g[wk];
        const toCell = Math.abs(s.tipout) < 0.005 ? '-' : (s.tipout > 0 ? '+' : '') + App.fmtCurrency(s.tipout, 2);
        return '<tr><td><div class="val">Week of ' + this.fmtDate(wk) + '</div></td>'
          + '<td>' + s.count + '</td>'
          + '<td>' + App.fmtCurrency(s.cash) + '</td>'
          + '<td>' + App.fmtCurrency(s.card) + '</td>'
          + '<td>' + toCell + '</td>'
          + '<td class="val">' + App.fmtCurrency(s.net) + '</td></tr>';
      }).join('') || this.noRow(6);
      return this.dataCard('<th>Week</th><th>Entries</th><th>Cash</th><th>Card</th><th>Tip-Out</th><th>Net Tips</th>', trs);
    }
    const trs = keys.map(wk => {
      const s = g[wk], tot = s.cash + s.card;
      return '<tr><td><div class="val">Week of ' + this.fmtDate(wk) + '</div></td>'
        + '<td>' + s.count + '</td>'
        + '<td>' + App.fmtCurrency(s.cash) + '</td>'
        + '<td>' + App.fmtCurrency(s.card) + '</td>'
        + '<td class="val">' + App.fmtCurrency(tot) + '</td>'
        + '<td>' + App.fmtCurrency(s.count ? tot / s.count : 0) + '</td></tr>';
    }).join('') || this.noRow(6);
    return this.dataCard('<th>Week</th><th>Entries</th><th>Cash</th><th>Card</th><th>Total</th><th>Avg / Entry</th>', trs);
  },

  // Every saved tip pool in the range; View opens its per-person split.
  byPools(poolRows) {
    if (!poolRows.length) {
      return this.dataCard('<th>Date</th><th>Method</th><th>Pool</th><th>Participants</th><th></th>',
        this.noRow(5, 'No tip pools saved in this range. Pools you save in Tip Pool mode show up here.'));
    }
    const trs = [...poolRows].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(p =>
      '<tr><td><div class="val">' + this.fmtDate(p.date) + '</div></td>'
      + '<td>' + (p.method === 'equal' ? 'Equal Split' : 'By Hours') + '</td>'
      + '<td class="val">' + App.fmtCurrency(p.pool_amount || 0) + '</td>'
      + '<td>' + ((p.participants || []).length) + '</td>'
      + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm th-pview" data-id="' + esc(p.id) + '">View</button></div></td></tr>').join('');
    return this.dataCard('<th>Date</th><th>Method</th><th>Pool</th><th>Participants</th><th></th>', trs);
  },

  // Read-only per-person split for a saved pool, in a pop-up (matches the edit pop-up).
  openPoolView(id) {
    const p = this.pools().find(x => x.id === id);
    if (!p) return;
    const rows = (p.participants || []).map(pt => '<tr>'
      + '<td><div class="val">' + esc(pt.name || '-') + '</div></td>'
      + '<td>' + (pt.hours != null ? this.fmtHours(pt.hours) : '-') + '</td>'
      + '<td class="val">' + App.fmtCurrency(pt.share || 0, 2) + '</td></tr>').join('');
    const html = '<div class="card form-card" id="th-pview-card" style="margin:0;">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
        + '<span>Tip Pool &middot; ' + this.fmtDate(p.date) + '</span>'
        + '<button class="btn btn-ghost btn-sm no-print" id="th-pview-export">Export PDF</button>'
      + '</div>'
      + '<div class="calc" style="margin-bottom:14px;">'
        + '<div class="calc-item"><div class="calc-label">Method</div><div class="calc-val">' + (p.method === 'equal' ? 'Equal Split' : 'By Hours') + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Pool Amount</div><div class="calc-val">' + App.fmtCurrency(p.pool_amount || 0, 2) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Hours</div><div class="calc-val">' + this.fmtHours(p.total_hours || 0) + '</div></div>'
      + '</div>'
      + '<div style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Staff</th><th>Hours</th><th>Tip Share</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';
    App.openModal(html, { id: 'th-pview-modal', maxWidth: 520, noClose: true });
    // This one pool's split and lc-tip-log's whole Tip Pool LOG both saved as
    // BarCop_TipPool_<today>.pdf, from two different screens. Name it after the pool.
    document.getElementById('th-pview-export')?.addEventListener('click', () => App.exportPDF({
      title: 'Tip Pool', root: document.getElementById('th-pview-card'),
      fileTag: 'Tip Pool ' + (String(p.date || '').slice(0, 10) || 'Detail')
    }));
  }
};
