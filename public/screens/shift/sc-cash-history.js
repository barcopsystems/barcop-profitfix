'use strict';

/* ── Shift Control — Cash History (read-only reference) ───────────────────────
   One page, three connected tabs (Cash Drops / Safe Log / Variances), the same
   shell as the Inventory reports. Read-only: filter, view, export. All logging
   and editing happens on the Cash Board (Cash Control), which writes through the
   shared helpers on S.ShiftCashDrop / S.ShiftSafeLog / S.ShiftVarianceLog. This
   screen just reads those stores. */

S.ShiftCashHistory = {
  tab: 'drops',
  f: {},
  TABS: [['drops', 'Cash Drops'], ['safe', 'Safe Log'], ['variances', 'Variances']],

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

  draw() {
    const parts = this.tab === 'drops' ? this.bodyDrops()
      : this.tab === 'safe' ? this.bodySafe()
      : this.bodyVariances();
    const tabLabel = (this.TABS.find(t => t[0] === this.tab) || ['', ''])[1];
    // Tabs are a plain switcher; under them the page follows the standard stack:
    // stats card, a Filter heading, the controls-only filter card, then the data card.
    let body;
    if (parts.empty) {
      body = parts.empty;
    } else {
      body = parts.stats
        + '<div class="sh no-print" style="margin:24px 0 10px;">Filter ' + esc(tabLabel) + '</div>'
        + '<div class="card no-print"><div class="form-row" style="gap:14px;align-items:flex-end;margin-bottom:0;flex-wrap:wrap;">'
          + parts.controls
          + '<button class="btn btn-ghost btn-sm" id="ch-export" style="margin-left:auto;align-self:center;">Export PDF</button>'
        + '</div></div>'
        + parts.table;
    }
    this.container.innerHTML = '<div class="screen">' + this.tabBar() + body + '</div>';
    this.wire();
  },

  wire() {
    this.container.onclick = ev => {
      const tab = ev.target.closest('.ch-tab');
      if (tab) { this.tab = tab.dataset.tab; this.f = {}; this.draw(); return; }
      if (ev.target.closest('#ch-export')) { App.exportPDF({ title: 'Cash History', root: this.container }); return; }
      if (ev.target.closest('#ch-go-board')) { App.navigate('sc-cash-control'); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.draw()); return; }
    };
    const bind = (id, key) => { const el = document.getElementById(id); if (el) el.addEventListener('change', e => { this.f[key] = e.target.value || ''; this.draw(); }); };
    bind('ch-from', 'from'); bind('ch-to', 'to'); bind('ch-a', 'a'); bind('ch-b', 'b');
    document.getElementById('ch-clear')?.addEventListener('click', () => { this.f = {}; this.draw(); });
  },

  // ── shared markup helpers ───────────────────────────────────────────────────
  dateInputs() {
    return '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="ch-from" value="' + esc(this.f.from || '') + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="ch-to" value="' + esc(this.f.to || '') + '"/></div>';
  },
  selInput(key, label, allLabel, names) {
    const opts = '<option value="">' + esc(allLabel) + '</option>'
      + names.map(n => '<option' + ((this.f[key] || '') === n ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
    return '<div class="f" style="width:180px;flex-shrink:0;"><label>' + esc(label) + '</label><select id="ch-' + esc(key) + '">' + opts + '</select></div>';
  },
  clearBtn() {
    return '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="ch-clear" style="margin-bottom:2px;">Clear</button></div>';
  },
  statItem(label, val, cls) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val ' + (cls || '') + '">' + val + '</div></div>';
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
    return '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + headers + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>';
  },
  noMatchRow(cols) {
    return '<tr><td colspan="' + cols + '" style="color:var(--t3);padding:12px 8px;">No records match the filter.</td></tr>';
  },
  emptyTab(line1, line2) {
    return '<div style="padding:18px 4px;font-size:13px;color:var(--t3);">' + esc(line1) + ' ' + esc(line2)
      + ' <button class="btn btn-ghost btn-sm" id="ch-go-board" style="margin-left:8px;">Go to Cash Board</button></div>';
  },

  // ── Cash Drops tab ──────────────────────────────────────────────────────────
  bodyDrops() {
    const all = [...S.ShiftCashDrop.drops()].sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
    if (!all.length) return { empty: this.emptyTab('No cash drops logged yet.', 'Log a drop on the Cash Board.') };
    const drawerNames = [...new Set(all.map(d => d.drawer).filter(Boolean))].sort();
    const byNames = [...new Set(all.map(d => d.performed_by).filter(Boolean))].sort();
    const filtered = all.filter(d => {
      if (this.f.from && (d.date || '') < this.f.from) return false;
      if (this.f.to && (d.date || '') > this.f.to) return false;
      if (this.f.a && (d.drawer || '') !== this.f.a) return false;
      if (this.f.b && (d.performed_by || '') !== this.f.b) return false;
      return true;
    });
    const total = filtered.reduce((t, d) => t + (d.amount || 0), 0);
    const controls = this.dateInputs() + this.selInput('a', 'Drawer', 'All drawers', drawerNames) + this.selInput('b', 'Performed By', 'All staff', byNames) + this.clearBtn();
    const stats = this.statsCard(this.statItem('Drops', filtered.length) + this.statItem('Total Dropped', App.fmtCurrency(total)));
    const rows = filtered.length
      ? filtered.slice(0, App.listLimit('sc', 'cash_drop')).map(d => '<tr>'
          + '<td><div class="val">' + this.fmtDate(d.date) + '</div></td>'
          + '<td>' + esc(d.shift_type || '-') + '</td>'
          + '<td>' + esc(d.drawer || '-') + '</td>'
          + '<td>' + esc(d.performed_by || '-') + '</td>'
          + '<td class="val">' + App.fmtCurrency(d.amount || 0) + '</td></tr>').join('')
      : this.noMatchRow(5);
    const table = this.dataCard('<th>Date</th><th>Shift</th><th>Drawer</th><th>Performed By</th><th>Amount</th>', rows)
      + App.showOlderBar('sc', 'cash_drop', filtered, false);
    return { stats, controls, table };
  },

  // ── Safe Log tab ────────────────────────────────────────────────────────────
  bodySafe() {
    const chrono = S.ShiftSafeLog.chrono();
    if (!chrono.length) return { empty: this.emptyTab('No safe activity logged yet.', 'Log safe activity on the Cash Board.') };
    const byNames = [...new Set(chrono.map(e => e.performed_by).filter(Boolean))].sort();
    let bal = 0;
    const withBal = chrono.map(e => { const signed = (e.direction === 'out' ? -1 : 1) * (e.amount || 0); bal += signed; return { e, signed, bal }; });
    const lifetime = bal;
    const match = e => {
      if (this.f.from && (e.date || '') < this.f.from) return false;
      if (this.f.to && (e.date || '') > this.f.to) return false;
      if (this.f.a && (e.txn_type || '') !== this.f.a) return false;
      if (this.f.b && (e.performed_by || '') !== this.f.b) return false;
      return true;
    };
    const shown = withBal.filter(r => match(r.e));
    const totalIn = shown.filter(r => r.signed > 0).reduce((t, r) => t + r.signed, 0);
    const totalOut = shown.filter(r => r.signed < 0).reduce((t, r) => t - r.signed, 0);
    const controls = this.dateInputs() + this.selInput('a', 'Type', 'All types', S.ShiftSafeLog.TYPES.map(t => t.name)) + this.selInput('b', 'Performed By', 'All staff', byNames) + this.clearBtn();
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
        const amt = r.signed < 0 ? '<span class="neg">' + App.fmtCurrency(r.signed) + '</span>' : '<span class="pos">+' + App.fmtCurrency(r.signed) + '</span>';
        return '<tr><td><div class="val">' + this.fmtDate(e.date) + '</div>'
          + (e.time ? '<div style="font-size:10px;color:var(--t3);">' + esc(e.time) + '</div>' : '') + '</td>'
          + '<td>' + esc(e.txn_type || '-') + '</td><td>' + esc(e.performed_by || '-') + '</td>'
          + '<td>' + esc(e.reference || '-') + '</td><td>' + amt + '</td>'
          + '<td class="val">' + App.fmtCurrency(r.bal) + '</td></tr>';
      }).join('');
    }
    const table = this.dataCard('<th>Date</th><th>Type</th><th>Performed By</th><th>Reference</th><th>Amount</th><th>Balance</th>', rows)
      + (shown.length ? App.showOlderBar('sc', 'safe_log', shown, false) : '');
    return { stats, controls, table };
  },

  // ── Variances tab ───────────────────────────────────────────────────────────
  bodyVariances() {
    const all = [...S.ShiftVarianceLog.variances()].sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
    if (!all.length) return { empty: this.emptyTab('No variances logged yet.', 'Count a drawer on the Cash Board.') };
    const drawerNames = [...new Set(all.map(v => v.drawer).filter(Boolean))].sort();
    const cashierNames = [...new Set(all.map(v => v.cashier).filter(Boolean))].sort();
    const filtered = all.filter(v => {
      if (this.f.from && (v.date || '') < this.f.from) return false;
      if (this.f.to && (v.date || '') > this.f.to) return false;
      if (this.f.a && (v.drawer || '') !== this.f.a) return false;
      if (this.f.b && (v.cashier || '') !== this.f.b) return false;
      return true;
    });
    const net = filtered.reduce((t, v) => t + (v.variance || 0), 0);
    const flagged = filtered.filter(v => v.status === 'Over' || v.status === 'Short').length;
    const controls = this.dateInputs() + this.selInput('a', 'Drawer', 'All drawers', drawerNames) + this.selInput('b', 'Cashier', 'All cashiers', cashierNames) + this.clearBtn();
    const stats = this.statsCard(
      this.statItem('Variances', filtered.length)
      + this.statItem('Net Over/Short', (net >= 0 ? '+' : '') + App.fmtCurrency(net), net < 0 ? 'warn' : '')
      + this.statItem('Out of Tolerance', flagged, flagged ? 'warn' : ''));
    let rows;
    if (!filtered.length) rows = this.noMatchRow(8);
    else rows = filtered.slice(0, App.listLimit('sc', 'variance')).map(v => {
      const vr = v.variance || 0;
      const nc = v.status === 'Not Counted';
      const cls = nc ? '' : v.status === 'Short' ? 'neg' : v.status === 'Over' ? '' : 'pos';
      const vc = nc ? '-' : (vr >= 0 ? '+' : '') + App.fmtCurrency(vr);
      return '<tr><td><div class="val">' + this.fmtDate(v.date) + '</div></td>'
        + '<td>' + esc(v.shift_type || '-') + '</td><td>' + esc(v.drawer || '-') + '</td>'
        + '<td>' + esc(v.cashier || '-') + '</td><td>' + App.fmtCurrency(v.expected_cash || 0) + '</td>'
        + '<td>' + App.fmtCurrency(v.counted_cash || 0) + '</td><td class="' + cls + '">' + vc + '</td>'
        + '<td>' + S.ShiftVarianceLog.statusBadge(v.status) + '</td></tr>';
    }).join('');
    const table = this.dataCard('<th>Date</th><th>Shift</th><th>Drawer</th><th>Cashier</th><th>Expected</th><th>Counted</th><th>Variance</th><th>Status</th>', rows)
      + App.showOlderBar('sc', 'variance', filtered, false);
    return { stats, controls, table };
  }
};
