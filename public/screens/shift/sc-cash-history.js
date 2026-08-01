'use strict';

/* ── Shift Control — Cash History (read-only reference) ───────────────────────
   One page, three connected tabs (Cash Drops / Safe Log / Variances), the same
   shell as the Inventory reports. Read-only: filter, view, export. All logging
   and editing happens on the Cash Board (Cash Control), which writes through the
   shared helpers on S.ShiftCashDrop / S.ShiftSafeLog / S.ShiftVarianceLog. This
   screen just reads those stores. */

S.ShiftCashHistory = {
  tab: 'drops',
  filterPreset: 'last-4',  // active range chip, shared across the tabs
  _prevPreset: 'last-4',
  filterFrom: '',
  filterTo: '',
  TABS: [['drops', 'Cash Drops'], ['safe', 'Safe Log'], ['variances', 'Variances']],
  RANGE_CHIPS: [
    { v: 'this-week', label: 'This Week' }, { v: 'last-week', label: 'Last Week' },
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],
  // Effective date window from the active range chip (recomputed off "today" each
  // draw); Custom reads the From/To pickers; All clears it.
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  inRange(date) {
    const { from, to } = this.effectiveRange();
    const d = date || '';
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How Cash History Works', [
      { p: ['The read-only record of every cash move: drops, safe activity, and drawer variances. You log cash in Cash Control; it shows up here for review, filtering, and export. Nothing is entered or edited on this page.'] },
      { h: 'The Three Tabs', p: ['Cash Drops lists every mid-shift drop with the drawer and who pulled it. Safe Log is the running ledger of safe activity with a balance after each move. Variances lists every drawer count against expected cash, with the over or short and the status.'] },
      { h: 'Setting the range', p: ['The chips pick the window: This Week, Last Week, This Month, Last 4 Weeks, or All. Custom opens a From and To picker. The stats and the list both update to match, and the range carries across the tabs.'] },
      { h: 'Reading variances', p: ['Within Tolerance is green, Short is red, Over is amber, and Not Counted is grey. A bartender who runs a few dollars short every shift is a pattern worth watching even when each count is inside tolerance.'] },
      { h: 'Export', p: ['Export PDF saves the tab you are looking at, with the current range, for your records.'] }
    ]);
  },

  draw() {
    if (!(S.ShiftCashDrop.drops().length || S.ShiftSafeLog.chrono().length || S.ShiftVarianceLog.variances().length)) {
      const hasRegisters = ((App.shiftData && App.shiftData.sc_drawers) || []).some(d => d.active !== false);
      App.setupCard(this.container, {
        title: 'Cash History',
        lead: 'Cash History is the read-only record of every drop, safe move, and drawer count. Log cash in Cash Control and it shows up here.',
        steps: [
          { title: 'Set up registers', desc: 'Add your drawers and registers so you can log drops and count drawers.', btn: 'Set Up Registers', screen: 'sc-drawers', done: hasRegisters },
          { title: 'Log cash in Cash Control', desc: 'Log a drop, a safe move, or count a drawer. Every entry lands here.', btn: 'Go to Cash Control', screen: 'sc-cash-control', done: false }
        ]
      });
      return;
    }
    const parts = this.tab === 'drops' ? this.bodyDrops()
      : this.tab === 'safe' ? this.bodySafe()
      : this.bodyVariances();
    // Tabs are a plain switcher; under them: stats card, the range chips + Export,
    // then the data card (the accepted filter model, no filter box).
    const body = parts.empty ? parts.empty : (parts.stats + this.filterRow() + parts.table);
    this.container.innerHTML = '<div class="screen">' + this.tabBar() + body + '</div>';
    this.wire();
  },

  wire() {
    this.container.onclick = ev => {
      const tab = ev.target.closest('.ch-tab');
      if (tab) { this.tab = tab.dataset.tab; this.draw(); return; }   // keep the range across tabs
      const chip = ev.target.closest('.ch-range-chip');
      if (chip) {
        const v = chip.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.draw();
        return;
      }
      if (ev.target.closest('#ch-export')) { const r = this.effectiveRange(); App.exportListPDF({ title: 'Cash History', root: this.container, lists: [['sc', 'cash_drop'], ['sc', 'safe_log'], ['sc', 'variance']], reRender: () => this.draw(), range: App.chipRangeLabel(this.RANGE_CHIPS, this.filterPreset, r.from, r.to) }); return; }
      if (ev.target.closest('#ch-go-board')) { App.navigate('sc-cash-control'); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.draw()); return; }
    };
    document.getElementById('ch-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.draw(); });
    document.getElementById('ch-to')?.addEventListener('change', e => { this.filterTo = e.target.value || ''; this.draw(); });
  },

  // ── shared markup helpers ───────────────────────────────────────────────────
  // Range chips left, Export right, directly above the data block; Custom reveals
  // a bare From/To row. Same accepted model as the other histories.
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'ch-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><button class="btn btn-ghost btn-sm" id="ch-export">Export PDF</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="ch-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="ch-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
  },
  statItem(label, val, cls) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
  },
  tabBar() {
    return '<div class="ch-tabs no-print">'
      + this.TABS.map(([k, label]) => '<button class="ch-tab' + (this.tab === k ? ' on' : '') + '" data-tab="' + esc(k) + '">' + esc(label) + '</button>').join('')
      + '</div>';
  },
  statsCard(items) {
    return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>';
  },
  dataCard(headers, rowsHtml) {
    return '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + headers + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
  },
  noMatchRow(cols) {
    return '<tr><td colspan="' + cols + '" style="color:var(--t3);padding:12px 8px;">No records in this range. Pick a wider range above.</td></tr>';
  },
  emptyTab(line1, line2, headers, cols) {
    const msg = esc(line1) + ' ' + esc(line2)
      + ' <button class="btn btn-ghost btn-sm" id="ch-go-board" style="margin-left:8px;">Go to Cash Control</button>';
    return '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
      + headers + '</tr></thead><tbody><tr><td colspan="' + cols + '" style="color:var(--t3);">' + msg + '</td></tr></tbody></table></div>';
  },

  // ── Cash Drops tab ──────────────────────────────────────────────────────────
  bodyDrops() {
    const all = [...S.ShiftCashDrop.drops()].sort(App.cmpNewest);
    if (!all.length) return { empty: this.emptyTab('No cash drops logged yet.', 'Log a drop on Cash Control.', '<th>Date</th><th>Drawer</th><th>Performed By</th><th>Amount</th>', 4) };
    const filtered = all.filter(d => this.inRange(d.date));
    const total = filtered.reduce((t, d) => t + (d.amount || 0), 0);
    const stats = this.statsCard(this.statItem('Drops', filtered.length) + this.statItem('Total Dropped', App.fmtCurrency(total)));
    const rows = filtered.length
      ? filtered.slice(0, App.listLimit('sc', 'cash_drop')).map(d => '<tr>'
          + '<td><div class="val">' + this.fmtDate(d.date) + '</div></td>'
          + '<td>' + esc(d.drawer || '-') + '</td>'
          + '<td>' + esc(d.performed_by || '-') + '</td>'
          + '<td class="val">' + App.fmtCurrency(d.amount || 0) + '</td></tr>').join('')
      : this.noMatchRow(4);
    const table = this.dataCard('<th>Date</th><th>Drawer</th><th>Performed By</th><th>Amount</th>', rows)
      + App.showOlderBar('sc', 'cash_drop', filtered, this.filterPreset !== 'all');
    return { stats, table };
  },

  // ── Safe Log tab ────────────────────────────────────────────────────────────
  bodySafe() {
    const chrono = S.ShiftSafeLog.chrono();
    if (!chrono.length) return { empty: this.emptyTab('No safe activity logged yet.', 'Log safe activity on Cash Control.', '<th>Date</th><th>Type</th><th>Performed By</th><th>Reference</th><th>Amount</th><th>Balance</th>', 6) };
    let bal = 0;
    const withBal = chrono.map(e => { const signed = (e.direction === 'out' ? -1 : 1) * (e.amount || 0); bal += signed; return { e, signed, bal }; });
    const lifetime = bal;
    const shown = withBal.filter(r => this.inRange(r.e.date));
    const totalIn = shown.filter(r => r.signed > 0).reduce((t, r) => t + r.signed, 0);
    const totalOut = shown.filter(r => r.signed < 0).reduce((t, r) => t - r.signed, 0);
    const stats = this.statsCard(
      this.statItem('Safe Balance', App.fmtCurrency(lifetime), 'good')
      + this.statItem('Total In', App.fmtCurrency(totalIn))
      + this.statItem('Total Out', App.fmtCurrency(totalOut))
      + this.statItem('Entries', shown.length));
    let rows;
    if (!shown.length) rows = this.noMatchRow(6);
    else {
      const ordered = shown.slice().reverse();
      rows = ordered.slice(0, App.listLimit('sc', 'safe_log')).map(r => {
        const e = r.e;
        // Direction is neutral; the +/- sign carries In vs Out (matches Cash Control).
        const amt = '<span style="color:var(--t1);">' + (r.signed < 0 ? App.fmtCurrency(r.signed) : '+' + App.fmtCurrency(r.signed)) + '</span>';
        return '<tr><td><div class="val">' + this.fmtDate(e.date) + '</div>'
          + (e.time ? '<div style="font-size:10px;color:var(--t3);">' + esc(e.time) + '</div>' : '') + '</td>'
          + '<td>' + esc(e.txn_type || '-') + '</td><td>' + esc(e.performed_by || '-') + '</td>'
          + '<td>' + esc(e.reference || '-') + '</td><td>' + amt + '</td>'
          + '<td class="val">' + App.fmtCurrency(r.bal) + '</td></tr>';
      }).join('');
    }
    const table = this.dataCard('<th>Date</th><th>Type</th><th>Performed By</th><th>Reference</th><th>Amount</th><th>Balance</th>', rows)
      + (shown.length ? App.showOlderBar('sc', 'safe_log', shown, this.filterPreset !== 'all') : '');
    return { stats, table };
  },

  // ── Variances tab ───────────────────────────────────────────────────────────
  bodyVariances() {
    const all = [...S.ShiftVarianceLog.variances()].sort(App.cmpNewest);
    if (!all.length) return { empty: this.emptyTab('No variances logged yet.', 'Count a drawer on Cash Control.', '<th>Date</th><th>Drawer</th><th>Cashier</th><th>Expected</th><th>Counted</th><th>Variance</th><th>Status</th>', 7) };
    const filtered = all.filter(v => this.inRange(v.date));
    const net = filtered.reduce((t, v) => t + (v.variance || 0), 0);
    const flagged = filtered.filter(v => v.status === 'Over' || v.status === 'Short').length;
    const stats = this.statsCard(
      this.statItem('Variances', filtered.length)
      // SH4/R6 — minus outside the '$'; warn off the ROUNDED sign so a to-the-cent balance is not red.
      + this.statItem('Net Over/Short', (App.fmtSigned(net, 2).sign > 0 ? '+' : '') + App.fmtBal(net), App.fmtSigned(net, 2).sign < 0 ? 'warn' : '')
      + this.statItem('Out of Tolerance', flagged, flagged ? 'warn' : ''));
    let rows;
    if (!filtered.length) rows = this.noMatchRow(7);
    else rows = filtered.slice(0, App.listLimit('sc', 'variance')).map(v => {
      const vr = v.variance || 0;
      const nc = v.status === 'Not Counted';
      // Variance value follows the status scheme, same as the badge: Within = green,
      // Short = red, Over = amber, Not Counted = grey.
      const col = v.status === 'Short' ? 'var(--red)' : v.status === 'Over' ? 'var(--amber)' : nc ? 'var(--t3)' : 'var(--green)';
      // SH4/R6 — minus outside the '$'. This is the whole Variance column, negative exactly when
      // it matters, and it printed "$-12.00" on every short drawer in the log.
      const vc = nc ? '-' : (App.fmtSigned(vr, 2).sign > 0 ? '+' : '') + App.fmtBal(vr);
      return '<tr><td><div class="val">' + this.fmtDate(v.date) + '</div></td>'
        + '<td>' + esc(v.drawer || '-') + '</td>'
        // ⚠ buildCash leaves these NULL when the POS report carried only an Over/Short column — a
        // supported shape. `|| 0` turned that into "Counted $0.00", which reads as an EMPTY DRAWER
        // for a register that took $900 and came up $45 light. A figure we do not have is a dash.
        + '<td>' + esc(v.cashier || '-') + '</td><td>' + (v.expected_cash != null ? App.fmtCurrency(v.expected_cash) : '-') + '</td>'
        + '<td>' + (v.counted_cash != null ? App.fmtCurrency(v.counted_cash) : '-') + '</td><td><span style="color:' + col + ';">' + vc + '</span></td>'
        + '<td>' + S.ShiftVarianceLog.statusBadge(v.status) + '</td></tr>';
    }).join('');
    const table = this.dataCard('<th>Date</th><th>Drawer</th><th>Cashier</th><th>Expected</th><th>Counted</th><th>Variance</th><th>Status</th>', rows)
      + App.showOlderBar('sc', 'variance', filtered, this.filterPreset !== 'all');
    return { stats, table };
  }
};
