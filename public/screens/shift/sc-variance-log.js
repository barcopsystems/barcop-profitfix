'use strict';

/* ── Shift Control — Variance History (read-only) ─────────────────────────────
   A read-only, exportable record of cash over/short per drawer: expected (POS)
   cash vs counted cash. Drawer counts are logged and edited on the Cash Board
   (Cash Control) via Count Drawer, which writes through persistVariance here.
   statusOf / tolerance / REASONS are the canonical bits the board reads.
   sc_variances feeds Profit Recovery's Cash Reconciliation and Theft Risk. */

S.ShiftVarianceLog = {
  REASONS: ['Miscount at count', 'Change-making error', 'Voids/comps not rung',
            'Tip-out error', 'Suspected theft', 'Unknown'],

  variances() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_variances)) App.shiftData.sc_variances = [];
    return App.shiftData.sc_variances;
  },
  shiftTypes() { return App.SHIFT_TYPES; },
  tolerance() {
    const t = App.cashToleranceForShift(null);
    return (t != null && !isNaN(t)) ? Number(t) : 10;
  },
  // "Not Counted" when both expected and counted are blank/zero (a row that
  // slipped through). Within tolerance wins on a true 0 net.
  statusOf(variance, expected, counted) {
    if ((expected === 0 || expected == null) && (counted === 0 || counted == null)) return 'Not Counted';
    const tol = this.tolerance();
    if (Math.abs(variance) <= tol) return 'Within Tolerance';
    return variance > 0 ? 'Over' : 'Short';
  },
  statusBadge(status) {
    const col = status === 'Short' ? 'var(--red)' : status === 'Over' ? 'var(--amber)'
      : status === 'Not Counted' ? 'var(--t3)' : 'var(--green)';
    return '<span style="color:' + col + ';font-weight:700;">' + esc(status || '') + '</span>';
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
    exportBtn.addEventListener('click', () => App.exportPDF({ title: 'Variance History', root: this.container }));
    actions.appendChild(exportBtn);
    this.renderList();
  },

  renderList() {
    const variances = [...this.variances()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

    if (variances.length === 0) {
      App.setupCard(this.container, {
        title: 'Variance History',
        lead: 'Every drawer reconcile (expected cash vs counted) shows here, read-only and exportable. Count a drawer on the Cash Board.',
        steps: [{ title: 'Count a drawer', desc: 'Reconcile a drawer count against the POS on the Cash Board.', btn: 'Go to Cash Board', screen: 'sc-cash-control' }]
      });
      return;
    }

    const net = variances.reduce((t, v) => t + (v.variance || 0), 0);
    const flagged = variances.filter(v => v.status === 'Over' || v.status === 'Short').length;
    const summary = '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Variances</div><div class="calc-val">' + variances.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Net Over/Short</div><div class="calc-val ' + (net < 0 ? 'warn' : '') + '">'
      + (net >= 0 ? '+' : '') + App.fmtCurrency(net) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Out of Tolerance</div><div class="calc-val ' + (flagged ? 'warn' : '') + '">' + flagged + '</div></div>'
      + '</div>';
    const rows = variances.slice(0, App.listLimit('sc', 'variance')).map(v => {
      const vr = v.variance || 0;
      const notCounted = v.status === 'Not Counted';
      const cls = notCounted ? '' : v.status === 'Short' ? 'neg' : v.status === 'Over' ? '' : 'pos';
      const varCell = notCounted ? '-' : (vr >= 0 ? '+' : '') + App.fmtCurrency(vr);
      return '<tr>'
        + '<td><div class="val">' + this.fmtDate(v.date) + '</div></td>'
        + '<td>' + esc(v.shift_type || '-') + '</td>'
        + '<td>' + esc(v.drawer || '-') + '</td>'
        + '<td>' + esc(v.cashier || '-') + '</td>'
        + '<td>' + App.fmtCurrency(v.expected_cash || 0) + '</td>'
        + '<td>' + App.fmtCurrency(v.counted_cash || 0) + '</td>'
        + '<td class="' + cls + '">' + varCell + '</td>'
        + '<td>' + this.statusBadge(v.status) + '</td>'
        + '</tr>';
    }).join('');
    const html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Shift</th><th>Drawer</th><th>Cashier</th>'
      + '<th>Expected</th><th>Counted</th><th>Variance</th><th>Status</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + App.showOlderBar('sc', 'variance', variances, false)
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">Read-only. Count, edit, or delete drawer reconciles on the Cash Board.</div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); }
    };
  },

  // ── Shared write path (called by the Cash Board) ────────────────────────────
  async persistVariance(rec) {
    const list = this.variances();
    const i = list.findIndex(x => x.id === rec.id);
    if (i > -1) list[i] = { ...list[i], ...rec }; else list.push(rec);
    const saved = i > -1 ? list[i] : rec;
    return await App.putRecord('sc', 'variance', saved);
  },

  async removeVariance(id) {
    return await App.removeRecord('sc', 'variance', id);
  }
};
