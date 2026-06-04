'use strict';

/* ── Shift Control — Safe Log History (read-only) ─────────────────────────────
   A read-only, filterable, exportable ledger of cash moving in and out of the
   safe: drops, banks issued and returned, deposits, paid-outs. Each entry
   carries a running balance (computed over the full ledger, then filtered for
   display). Entries are logged and edited on the Cash Board (Cash Control),
   which writes through persistEntry. TYPES + dirOf are the canonical safe-move
   list the board reads. */

S.ShiftSafeLog = {
  fFrom: '', fTo: '', fType: '',
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
    if (actions) actions.innerHTML = '';
    this.renderList();
  },

  matches(e) {
    const date = e.date || '';
    if (this.fFrom && date < this.fFrom) return false;
    if (this.fTo && date > this.fTo) return false;
    if (this.fType && (e.txn_type || '') !== this.fType) return false;
    return true;
  },

  filterCard(stats) {
    const typeOpts = '<option value="">All types</option>'
      + this.TYPES.map(t => '<option' + (this.fType === t.name ? ' selected' : '') + '>' + t.name + '</option>').join('');
    return '<div class="card no-print"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Filter</span><button class="btn btn-ghost btn-sm" id="sl-export">Export PDF</button></div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:14px;flex-wrap:wrap;">'
      +   '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="sl-f-from" value="' + esc(this.fFrom) + '"/></div>'
      +   '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="sl-f-to" value="' + esc(this.fTo) + '"/></div>'
      +   '<div class="f" style="width:180px;flex-shrink:0;"><label>Type</label><select id="sl-f-type">' + typeOpts + '</select></div>'
      +   '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="sl-f-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div>' + (stats || '') + '</div>';
  },

  renderList() {
    const chrono = this.chrono();

    if (chrono.length === 0) {
      App.setupCard(this.container, {
        title: 'Safe Log History',
        lead: 'Every cash move in and out of the safe shows here with a running balance, read-only, filterable, and exportable. Log safe activity on the Cash Board.',
        steps: [{ title: 'Log safe activity', desc: 'Deposits, banks, and paid-outs are logged on the Cash Board.', btn: 'Go to Cash Board', screen: 'sc-cash-control' }]
      });
      return;
    }

    // Running balance over the FULL ledger, then keep only the filtered rows.
    let bal = 0;
    const withBal = chrono.map(e => {
      const signed = (e.direction === 'out' ? -1 : 1) * (e.amount || 0);
      bal += signed;
      return { e, signed, bal };
    });
    const lifetimeBal = bal;
    const shown = withBal.filter(r => this.matches(r.e));
    const totalIn = shown.filter(r => r.signed > 0).reduce((t, r) => t + r.signed, 0);
    const totalOut = shown.filter(r => r.signed < 0).reduce((t, r) => t - r.signed, 0);

    const stats = '<div class="calc" style="margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Safe Balance</div><div class="calc-val good">' + App.fmtCurrency(lifetimeBal) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total In</div><div class="calc-val">' + App.fmtCurrency(totalIn) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Out</div><div class="calc-val">' + App.fmtCurrency(totalOut) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val">' + shown.length + '</div></div>'
      + '</div>';

    let listHtml;
    if (shown.length === 0) {
      listHtml = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No safe activity matches the filter.</div>';
    } else {
      const ordered = shown.slice().reverse();
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
      listHtml = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Type</th><th>Performed By</th><th>Reference</th><th>Amount</th><th>Balance</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('sc', 'safe_log', ordered, false);
    }

    this.container.innerHTML = '<div class="screen">' + this.filterCard(stats) + listHtml
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">Read-only. Log, edit, or delete safe activity on the Cash Board.</div></div>';

    document.getElementById('sl-export')?.addEventListener('click', () => App.exportPDF({ title: 'Safe Log History', root: this.container }));
    document.getElementById('sl-f-from')?.addEventListener('change', e => { this.fFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('sl-f-to')?.addEventListener('change', e => { this.fTo = e.target.value || ''; this.renderList(); });
    document.getElementById('sl-f-type')?.addEventListener('change', e => { this.fType = e.target.value || ''; this.renderList(); });
    document.getElementById('sl-f-clear')?.addEventListener('click', () => { this.fFrom = this.fTo = this.fType = ''; this.renderList(); });
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
