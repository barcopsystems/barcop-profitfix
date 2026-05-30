'use strict';

/* ── Shift Control — Cash Control (unified cash dashboard) ────────────────────
   One screen merges everything cash: running safe balance from sc_safe_log,
   drawer reconciliations from sc_variances, drops from sc_cash_drops, plus
   safe activity (banks issued, bank deposits, paid-outs). Read-only by
   design — the operator still logs each event on its dedicated screen, this
   screen just shows the assembled picture. Cash Drop saves auto-mirror into
   sc_safe_log (Chunk A) so the running safe balance is always honest. */

S.ShiftCashControl = {
  range: '30',   // '7' | '30' | '90' | '365' | 'all'

  drops()     { return ((App.shiftData && App.shiftData.sc_cash_drops) || []); },
  variances() { return ((App.shiftData && App.shiftData.sc_variances)  || []); },
  safeLog()   { return ((App.shiftData && App.shiftData.sc_safe_log)   || []); },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  startDate() {
    if (this.range === 'all') return '';
    const days = parseInt(this.range, 10) || 30;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  },

  // Running safe balance from EVERY safe log entry on file (not date-bound;
  // the current safe balance is the lifetime running total, not a window).
  // In direction adds, out direction subtracts.
  currentSafeBalance() {
    return this.safeLog().reduce((bal, e) => {
      const amt = parseFloat(e.amount) || 0;
      return bal + (e.direction === 'out' ? -amt : amt);
    }, 0);
  },

  // Net safe movement inside the active date range. Lifetime balance stays
  // the headline number; this sub-figure shows how the safe shifted during
  // the window the operator is filtering to.
  netInWindow() {
    const start = this.startDate();
    return this.safeLog().reduce((sum, e) => {
      if (start && e.date < start) return sum;
      const amt = parseFloat(e.amount) || 0;
      return sum + (e.direction === 'out' ? -amt : amt);
    }, 0);
  },

  // Merge drops + variances + safe entries into one chronological activity
  // stream, filtered to the active range, newest first. Each row carries the
  // metadata needed to jump back to its source screen for edit.
  activityStream() {
    const start = this.startDate();
    const out = [];

    // Safe log: every entry is a real cash movement. Use as primary source
    // for safe balance changes. Cash drops are already mirrored here (Chunk A),
    // so reading from safe_log already covers them.
    this.safeLog().forEach(e => {
      if (start && e.date < start) return;
      out.push({
        date:      e.date,
        time:      e.time || '',
        sortKey:   (e.date || '') + 'T' + (e.time || '00:00') + '|' + (e.created_at || ''),
        type:      e.txn_type || 'Safe Activity',
        category:  'safe',
        ref:       e.reference || '',
        by:        e.performed_by || '',
        amount:    parseFloat(e.amount) || 0,
        direction: e.direction || 'in',
        status:    '',
        source_screen: e.source === 'cash-drop' ? 'sc-cash-drop' : 'sc-safe-log',
        source_id:     e.source === 'cash-drop' ? e.source_id : e.id
      });
    });

    // Variances: drawer reconciliations. They don't move cash in/out of the
    // safe (they reconcile the drawer count to POS expected), but they're
    // part of the cash picture and feed Cash Reconciliation.
    this.variances().forEach(v => {
      if (start && v.date < start) return;
      const variance = parseFloat(v.variance) || 0;
      out.push({
        date:      v.date,
        time:      '',
        sortKey:   (v.date || '') + '|' + (v.created_at || ''),
        type:      'Drawer Reconcile',
        category:  'variance',
        ref:       (v.drawer || '-') + (v.cashier ? ' / ' + v.cashier : ''),
        by:        v.cashier || '',
        amount:    Math.abs(variance),
        direction: 'none',
        variance,
        status:    v.status || (Math.abs(variance) <= (v.tolerance || 10) ? 'Within Tolerance' : variance < 0 ? 'Short' : 'Over'),
        source_screen: 'sc-variance-log',
        source_id:     v.id
      });
    });

    return out.sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0));
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="cc-export">Export PDF</button>';
    document.getElementById('cc-export')?.addEventListener('click', () => window.print());
    this.draw();
  },

  rangeOptions() {
    const opts = [['7', 'Last 7 Days'], ['30', 'Last 30 Days'], ['90', 'Last 90 Days'], ['365', 'Last 12 Months'], ['all', 'All Time']];
    return opts.map(([v, l]) => '<option value="' + v + '"' + (this.range === v ? ' selected' : '') + '>' + l + '</option>').join('');
  },

  draw() {
    const balance     = this.currentSafeBalance();
    const netWin      = this.netInWindow();
    const stream      = this.activityStream();
    const drops       = stream.filter(s => s.category === 'safe' && s.type === 'Cash Drop');
    const safeOut     = stream.filter(s => s.category === 'safe' && s.direction === 'out');
    const variances   = stream.filter(s => s.category === 'variance');
    const flagged     = variances.filter(v => v.status === 'Over' || v.status === 'Short');
    const netVariance = variances.reduce((s, v) => s + (v.variance || 0), 0);

    const headerBalance = '<div class="card" style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;">'
      + '<div>'
        + '<div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Current Safe Balance</div>'
        + '<div style="font-size:32px;font-weight:800;color:var(--gold);letter-spacing:0.5px;">' + App.fmtCurrency(balance) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:4px;">Running total from every Safe Log entry on file. Cash drops mirror into the safe automatically.</div>'
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
        + '<button class="btn btn-primary btn-sm" id="cc-new-drop">+ Log Cash Drop</button>'
        + '<button class="btn btn-ghost btn-sm" id="cc-new-variance">+ Log Variance</button>'
        + '<button class="btn btn-ghost btn-sm" id="cc-new-safe">+ Safe Activity</button>'
      + '</div>'
    + '</div>';

    const totDrops = drops.reduce((s, d) => s + d.amount, 0);
    const totOut   = safeOut.reduce((s, e) => s + e.amount, 0);

    const tiles = '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Drops In</div><div class="calc-val">' + App.fmtCurrency(totDrops) + '</div><div style="font-size:10px;color:var(--t3);">' + drops.length + ' drop' + (drops.length === 1 ? '' : 's') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Safe Out</div><div class="calc-val">' + App.fmtCurrency(totOut) + '</div><div style="font-size:10px;color:var(--t3);">' + safeOut.length + ' entr' + (safeOut.length === 1 ? 'y' : 'ies') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Drawer Net</div><div class="calc-val ' + (netVariance < 0 ? 'warn' : netVariance > 0 ? '' : '') + '">' + (netVariance >= 0 ? '+' : '') + App.fmtCurrency(netVariance) + '</div><div style="font-size:10px;color:var(--t3);">' + variances.length + ' reconcil' + (variances.length === 1 ? 'iation' : 'iations') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Out of Tolerance</div><div class="calc-val ' + (flagged.length > 0 ? 'warn' : '') + '">' + flagged.length + '</div><div style="font-size:10px;color:var(--t3);">flagged variances</div></div>'
    + '</div>';

    const netColor = netWin > 0 ? 'var(--gold)' : netWin < 0 ? 'var(--red)' : 'var(--t3)';
    const netLabel = this.range === 'all' ? 'Net All Time' : 'Net In Window';
    const controls = '<div class="form-row" style="margin-bottom:14px;align-items:center;gap:14px;flex-wrap:wrap;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Date Range</label>'
      + '<select id="cc-range">' + this.rangeOptions() + '</select></div>'
      + '<div style="font-size:11px;color:var(--t3);align-self:flex-end;padding-bottom:10px;flex:1;min-width:180px;">'
        + (this.range === 'all' ? 'All cash activity on file.' : 'Activity from ' + this.fmtDate(this.startDate()) + ' to today.')
      + '</div>'
      + '<div style="align-self:flex-end;padding-bottom:6px;text-align:right;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);">' + netLabel + '</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:20px;font-weight:600;color:' + netColor + ';line-height:1.1;">'
        + (netWin >= 0 ? '+' : '') + App.fmtCurrency(netWin) + '</div>'
      + '</div>'
      + '</div>';

    let body;
    if (stream.length === 0) {
      body = '<div class="empty">'
        + '<div class="empty-title">No cash activity in this range</div>'
        + '<div class="empty-sub">Cash drops, drawer reconciliations, and safe activity all show here once they are logged.</div>'
      + '</div>';
    } else {
      const rows = stream.map(s => {
        let amountCell, statusCell;
        if (s.category === 'variance') {
          // Variance: signed delta with status badge
          const sign = s.variance > 0 ? '+' : s.variance < 0 ? '-' : '';
          const isFlag = s.status === 'Over' || s.status === 'Short';
          const cls  = isFlag ? 'neg' : 'pos';
          amountCell = '<span class="' + cls + '">' + sign + App.fmtCurrency(Math.abs(s.variance)) + '</span>';
          const sColor = isFlag ? 'var(--red)' : 'var(--gold)';
          statusCell = '<span style="font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:' + sColor + ';border:1px solid ' + sColor + ';border-radius:3px;padding:2px 6px;">' + esc(s.status) + '</span>';
        } else {
          // Safe activity (in/out)
          const sign = s.direction === 'out' ? '-' : '+';
          const cls  = s.direction === 'out' ? 'neg' : 'pos';
          amountCell = '<span class="' + cls + '">' + sign + App.fmtCurrency(s.amount) + '</span>';
          statusCell = s.direction === 'out'
            ? '<span style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">OUT</span>'
            : '<span style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gold);">IN</span>';
        }
        return '<tr class="cc-row" data-screen="' + esc(s.source_screen) + '" data-id="' + esc(s.source_id || '') + '" style="cursor:pointer;">'
          + '<td>' + this.fmtDate(s.date) + (s.time ? '<div style="font-size:10px;color:var(--t3);">' + esc(s.time) + '</div>' : '') + '</td>'
          + '<td><div class="val">' + esc(s.type) + '</div></td>'
          + '<td>' + esc(s.ref || '-') + '</td>'
          + '<td>' + esc(s.by || '-') + '</td>'
          + '<td class="val">' + amountCell + '</td>'
          + '<td>' + statusCell + '</td>'
        + '</tr>';
      }).join('');
      body = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Type</th><th>Reference</th><th>By</th><th>Amount</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">' + headerBalance + tiles + controls + body + '</div>';

    document.getElementById('cc-range')?.addEventListener('change', e => { this.range = e.target.value; this.draw(); });
    document.getElementById('cc-new-drop')?.addEventListener('click', () => App.navigate('sc-cash-drop'));
    document.getElementById('cc-new-variance')?.addEventListener('click', () => App.navigate('sc-variance-log'));
    document.getElementById('cc-new-safe')?.addEventListener('click', () => App.navigate('sc-safe-log'));
    this.container.onclick = ev => {
      const row = ev.target.closest('.cc-row');
      if (row && row.dataset.screen) App.navigate(row.dataset.screen);
    };
  }
};
