'use strict';

/* ── Shift Control — Variance History (read-only) ─────────────────────────────
   A read-only, filterable, exportable record of cash over/short per drawer:
   expected (POS) cash vs counted cash. Drawer counts are logged and edited on
   the Cash Board (Cash Control) via Count Drawer, which writes through
   persistVariance. statusOf / tolerance / REASONS are the canonical bits the
   board reads. sc_variances feeds Profit Recovery's Cash Reconciliation and
   Theft Risk. */

S.ShiftVarianceLog = {
  fFrom: '', fTo: '', fDrawer: '', fStatus: '',
  REASONS: ['Miscount at count', 'Change-making error', 'Voids/comps not rung',
            'Tip-out error', 'Suspected theft', 'Unknown'],
  STATUSES: ['Within Tolerance', 'Over', 'Short', 'Not Counted'],

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
    if (actions) actions.innerHTML = '';
    this.renderList();
  },

  applyFilters(list) {
    return list.filter(v => {
      const date = v.date || '';
      if (this.fFrom && date < this.fFrom) return false;
      if (this.fTo && date > this.fTo) return false;
      if (this.fDrawer && (v.drawer || '') !== this.fDrawer) return false;
      if (this.fStatus && (v.status || '') !== this.fStatus) return false;
      return true;
    });
  },

  filterCard(stats) {
    const drawerNames = [...new Set(this.variances().map(v => v.drawer).filter(Boolean))].sort();
    const drawerOpts = '<option value="">All drawers</option>' + drawerNames.map(n => '<option' + (this.fDrawer === n ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
    const statusOpts = '<option value="">All statuses</option>' + this.STATUSES.map(s => '<option' + (this.fStatus === s ? ' selected' : '') + '>' + s + '</option>').join('');
    return '<div class="card no-print"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Filter</span><button class="btn btn-ghost btn-sm" id="vl-export">Export PDF</button></div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:14px;flex-wrap:wrap;">'
      +   '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="vl-f-from" value="' + esc(this.fFrom) + '"/></div>'
      +   '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="vl-f-to" value="' + esc(this.fTo) + '"/></div>'
      +   '<div class="f" style="width:180px;flex-shrink:0;"><label>Drawer</label><select id="vl-f-drawer">' + drawerOpts + '</select></div>'
      +   '<div class="f" style="width:170px;flex-shrink:0;"><label>Status</label><select id="vl-f-status">' + statusOpts + '</select></div>'
      +   '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="vl-f-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div>' + (stats || '') + '</div>';
  },

  renderList() {
    const all = [...this.variances()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

    if (all.length === 0) {
      App.setupCard(this.container, {
        title: 'Variance History',
        lead: 'Every drawer reconcile (expected cash vs counted) shows here, read-only, filterable, and exportable. Count a drawer on the Cash Board.',
        steps: [{ title: 'Count a drawer', desc: 'Reconcile a drawer count against the POS on the Cash Board.', btn: 'Go to Cash Board', screen: 'sc-cash-control' }]
      });
      return;
    }

    const filtered = this.applyFilters(all);
    const net = filtered.reduce((t, v) => t + (v.variance || 0), 0);
    const flagged = filtered.filter(v => v.status === 'Over' || v.status === 'Short').length;
    const stats = '<div class="calc" style="margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Variances</div><div class="calc-val">' + filtered.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Net Over/Short</div><div class="calc-val ' + (net < 0 ? 'warn' : '') + '">'
      + (net >= 0 ? '+' : '') + App.fmtCurrency(net) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Out of Tolerance</div><div class="calc-val ' + (flagged ? 'warn' : '') + '">' + flagged + '</div></div>'
      + '</div>';

    let listHtml;
    if (filtered.length === 0) {
      listHtml = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No variances match the filter.</div>';
    } else {
      const rows = filtered.slice(0, App.listLimit('sc', 'variance')).map(v => {
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
      listHtml = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Shift</th><th>Drawer</th><th>Cashier</th>'
        + '<th>Expected</th><th>Counted</th><th>Variance</th><th>Status</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('sc', 'variance', filtered, false);
    }

    this.container.innerHTML = '<div class="screen">' + this.filterCard(stats) + listHtml
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">Read-only. Count, edit, or delete drawer reconciles on the Cash Board.</div></div>';

    document.getElementById('vl-export')?.addEventListener('click', () => App.exportPDF({ title: 'Variance History', root: this.container }));
    document.getElementById('vl-f-from')?.addEventListener('change', e => { this.fFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('vl-f-to')?.addEventListener('change', e => { this.fTo = e.target.value || ''; this.renderList(); });
    document.getElementById('vl-f-drawer')?.addEventListener('change', e => { this.fDrawer = e.target.value || ''; this.renderList(); });
    document.getElementById('vl-f-status')?.addEventListener('change', e => { this.fStatus = e.target.value || ''; this.renderList(); });
    document.getElementById('vl-f-clear')?.addEventListener('click', () => { this.fFrom = this.fTo = this.fDrawer = this.fStatus = ''; this.renderList(); });
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
