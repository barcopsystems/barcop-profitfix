'use strict';

/* ── Profit Recovery — Cash Reconciliation (read-only view) ───────────────────
   Restructured per the platform map: cash is captured in Shift Control (Cash
   Drop + Variance Log) and flows here automatically. This screen no longer
   takes manual entry — it is the Profit Recovery read-out of sc_cash_drops and
   sc_variances. The Shift Control feed is always shown (Rule 14). */

S.CashRecon = {
  drops()     { return ((App.shiftData && App.shiftData.sc_cash_drops) || []); },
  variances() { return ((App.shiftData && App.shiftData.sc_variances) || []); },
  tolerance() {
    const t = App.data && App.data.settings && App.data.settings.cash_tolerance;
    return (t != null && !isNaN(t)) ? Number(t) : 10;
  },
  fmtDate(str) {
    if (!str) return '—';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    const exp = document.createElement('button');
    exp.className = 'btn btn-ghost btn-sm';
    exp.textContent = 'Export PDF';
    exp.addEventListener('click', () => window.print());
    actions.appendChild(exp);
    this.renderMain();
  },

  renderMain() {
    const drops = [...this.drops()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
    const variances = [...this.variances()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

    // ── Always-on feed indicator (Rule 14) ──
    const feedCard = '<div class="card"><div class="card-title">Cash Feed &middot; Shift Control</div>'
      + '<div style="display:flex;align-items:center;gap:10px;">'
      + '<span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:var(--gold);"></span>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;">'
      + 'Cash drops and end-of-shift variances are captured in Shift Control and flow here automatically — '
      + 'no double entry. ' + drops.length + ' drop' + (drops.length === 1 ? '' : 's') + ' and '
      + variances.length + ' variance' + (variances.length === 1 ? '' : 's') + ' synced.'
      + '</div></div></div>';

    // ── Summary ──
    const netVar = variances.reduce((t, v) => t + (v.variance || 0), 0);
    const flagged = variances.filter(v => v.status && v.status !== 'Within Tolerance').length;
    const dropTotal = drops.reduce((t, d) => t + (d.amount || 0), 0);

    const summary = '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Variances Logged</div><div class="calc-val">' + variances.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Net Over / Short</div><div class="calc-val ' + (netVar < 0 ? 'warn' : '') + '">'
      + (netVar >= 0 ? '+' : '') + App.fmtCurrency(netVar) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Out of Tolerance</div><div class="calc-val ' + (flagged ? 'warn' : '') + '">' + flagged + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Cash Dropped</div><div class="calc-val">' + App.fmtCurrency(dropTotal) + '</div></div>'
      + '</div>';

    // ── Variances table ──
    let varCard;
    if (variances.length === 0) {
      varCard = '<div class="card"><div class="card-title">Cash Variances</div>'
        + '<div style="font-size:13px;color:var(--t3);">No variances logged yet. End-of-shift cash counts '
        + 'recorded in Shift Control\'s Variance Log will appear here.</div></div>';
    } else {
      const rows = variances.map(v => {
        const vr = v.variance || 0;
        const cls = v.status === 'Short' ? 'neg' : v.status === 'Over' ? '' : 'pos';
        const badge = v.status === 'Within Tolerance'
          ? '<span class="badge badge-ok">Within Tolerance</span>'
          : v.status === 'Over'
            ? '<span class="badge badge-dim">Over</span>'
            : '<span class="badge badge-warn">Short</span>';
        return '<tr><td><div class="val">' + this.fmtDate(v.date) + '</div></td>'
          + '<td>' + esc(v.shift_type || '—') + '</td>'
          + '<td>' + esc(v.drawer || '—') + '</td>'
          + '<td>' + esc(v.cashier || '—') + '</td>'
          + '<td>' + App.fmtCurrency(v.expected_cash || 0) + '</td>'
          + '<td>' + App.fmtCurrency(v.counted_cash || 0) + '</td>'
          + '<td class="' + cls + '">' + (vr >= 0 ? '+' : '') + App.fmtCurrency(vr) + '</td>'
          + '<td>' + badge + '</td></tr>';
      }).join('');
      varCard = '<div class="card"><div class="card-title">Cash Variances</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Shift</th><th>Drawer</th><th>Cashier</th>'
        + '<th>Expected</th><th>Counted</th><th>Over/Short</th><th>Status</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">'
        + 'Tolerance &plusmn;' + App.fmtCurrency(this.tolerance()) + ' (set in Hub Settings). '
        + 'Repeated shortages feed the Theft Risk scorecard.</div></div>';
    }

    // ── Cash drops table ──
    let dropCard;
    if (drops.length === 0) {
      dropCard = '<div class="card"><div class="card-title">Cash Drops</div>'
        + '<div style="font-size:13px;color:var(--t3);">No cash drops logged yet. Drops recorded in Shift '
        + 'Control will appear here.</div></div>';
    } else {
      const rows = drops.slice(0, 40).map(d => '<tr><td><div class="val">' + this.fmtDate(d.date) + '</div></td>'
        + '<td>' + esc(d.shift_type || '—') + '</td>'
        + '<td>' + esc(d.drawer || '—') + '</td>'
        + '<td>' + esc(d.performed_by || '—') + '</td>'
        + '<td class="val">' + App.fmtCurrency(d.amount || 0) + '</td></tr>').join('');
      dropCard = '<div class="card"><div class="card-title">Cash Drops</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Shift</th><th>Drawer</th><th>Performed By</th><th>Amount</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + feedCard + summary + varCard + dropCard + '</div>';
  }
};
