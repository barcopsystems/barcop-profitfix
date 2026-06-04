'use strict';

/* ── Shift Control — Safe Log History (read-only) ─────────────────────────────
   A read-only, exportable ledger of cash moving in and out of the safe: drops,
   banks issued and returned, deposits, paid-outs. Each entry carries a running
   balance. Entries are logged and edited on the Cash Board (Cash Control), which
   writes through persistEntry here. TYPES + dirOf are the canonical safe-move
   list the board reads. */

S.ShiftSafeLog = {
  TYPES: [
    { name: 'Opening Balance', dir: 'in' },
    { name: 'Cash Drop',       dir: 'in' },
    { name: 'Bank Returned',   dir: 'in' },
    { name: 'Cash Added',      dir: 'in' },
    { name: 'Bank Issued',     dir: 'out' },
    { name: 'Bank Deposit',    dir: 'out' },
    { name: 'Paid Out',        dir: 'out' }
  ],

  entries() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_safe_log)) App.shiftData.sc_safe_log = [];
    return App.shiftData.sc_safe_log;
  },
  dirOf(typeName) {
    const t = this.TYPES.find(x => x.name === typeName);
    return t ? t.dir : 'in';
  },
  // chronological, oldest first — running balance accumulates in order
  chrono() {
    return [...this.entries()].sort((a, b) => {
      const ka = (a.date || '') + 'T' + (a.time || '00:00') + '|' + (a.created_at || '');
      const kb = (b.date || '') + 'T' + (b.time || '00:00') + '|' + (b.created_at || '');
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-ghost btn-sm';
    exportBtn.textContent = 'Export PDF';
    exportBtn.addEventListener('click', () => App.exportPDF({ title: 'Safe Log History', root: this.container }));
    actions.appendChild(exportBtn);
    this.renderList();
  },

  renderList() {
    const chrono = this.chrono();

    if (chrono.length === 0) {
      App.setupCard(this.container, {
        title: 'Safe Log History',
        lead: 'Every cash move in and out of the safe shows here with a running balance, read-only and exportable. Log safe activity on the Cash Board.',
        steps: [{ title: 'Log safe activity', desc: 'Deposits, banks, and paid-outs are logged on the Cash Board.', btn: 'Go to Cash Board', screen: 'sc-cash-control' }]
      });
      return;
    }

    let bal = 0;
    const withBal = chrono.map(e => {
      const signed = (e.direction === 'out' ? -1 : 1) * (e.amount || 0);
      bal += signed;
      return { e, signed, bal };
    });
    const totalIn = withBal.filter(r => r.signed > 0).reduce((t, r) => t + r.signed, 0);
    const totalOut = withBal.filter(r => r.signed < 0).reduce((t, r) => t - r.signed, 0);

    const summary = '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Safe Balance</div><div class="calc-val good">' + App.fmtCurrency(bal) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total In</div><div class="calc-val">' + App.fmtCurrency(totalIn) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Out</div><div class="calc-val">' + App.fmtCurrency(totalOut) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val">' + chrono.length + '</div></div>'
      + '</div>';

    const ordered = withBal.reverse();
    const rows = ordered.slice(0, App.listLimit('sc', 'safe_log')).map(r => {
      const e = r.e;
      const amtCell = r.signed < 0
        ? '<span class="neg">' + App.fmtCurrency(r.signed) + '</span>'
        : '<span class="pos">+' + App.fmtCurrency(r.signed) + '</span>';
      return '<tr>'
        + '<td><div class="val">' + this.fmtDate(e.date) + '</div>'
        + (e.time ? '<div style="font-size:10px;color:var(--t3);">' + esc(e.time) + '</div>' : '') + '</td>'
        + '<td>' + esc(e.txn_type || '-') + '</td>'
        + '<td>' + esc(e.performed_by || '-') + '</td>'
        + '<td>' + esc(e.reference || '-') + '</td>'
        + '<td>' + amtCell + '</td>'
        + '<td class="val">' + App.fmtCurrency(r.bal) + '</td>'
        + '</tr>';
    }).join('');
    const html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Type</th><th>Performed By</th><th>Reference</th><th>Amount</th><th>Balance</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + App.showOlderBar('sc', 'safe_log', ordered, false)
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">Read-only. Log, edit, or delete safe activity on the Cash Board.</div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); }
    };
  },

  // ── Shared write path (called by the Cash Board) ────────────────────────────
  async persistEntry(rec) {
    const list = this.entries();
    const i = list.findIndex(x => x.id === rec.id);
    if (i > -1) list[i] = { ...list[i], ...rec }; else list.push(rec);
    const saved = i > -1 ? list[i] : rec;
    return await App.putRecord('sc', 'safe_log', saved);
  },

  async removeEntry(id) {
    return await App.removeRecord('sc', 'safe_log', id);
  }
};
