'use strict';

/* ── Shift Control — Shift History (writes sc_shifts) ─────────────────────────
   The one home for every shift. Card 1 is the inline Log a Past Shift form
   (collapsible), Card 2 is the filter + totals, Card 3 is the list. Live-closed
   shifts from Active Shift and back-filled past shifts both land here. View
   opens the full recap; Edit reopens the shift in the form. Mirrors the
   Inventory Transfer Log layout. */

S.ShiftHistory = {
  filterType: '',
  filterStatus: '',
  filterFrom: '',
  filterTo: '',
  editId: null,

  shifts() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_shifts)) App.shiftData.sc_shifts = [];
    return App.shiftData.sc_shifts;
  },
  sorted() {
    return [...this.shifts()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  filtered() {
    return this.sorted().filter(s => {
      if (this.filterType && s.shift_type !== this.filterType) return false;
      if (this.filterStatus && (s.status || 'Closed') !== this.filterStatus) return false;
      if (this.filterFrom && (s.date || '') < this.filterFrom) return false;
      if (this.filterTo && (s.date || '') > this.filterTo) return false;
      return true;
    });
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (this._openDetailId) { const id = this._openDetailId; this._openDetailId = null; this.renderDetail(id); return; }
    this.renderList();
  },

  // ── Stats strip (top, card background) ──────────────────────────────────────
  statsStrip(count, totRev, totCov, avgChk) {
    const item = (label, val) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val">' + val + '</div></div>';
    return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + item('Shifts', count)
      + item('Total Revenue', App.fmtCurrency(totRev))
      + item('Total Covers', totCov)
      + item('Avg Check', avgChk != null ? App.fmtCurrency(avgChk) : '-')
      + '</div></div>';
  },

  // ── Filter (controls only; the heading + Export sit above it in renderList) ──
  filterCard() {
    const typeOpts = '<option value="">All shift types</option>'
      + App.SHIFT_TYPES.map(t => '<option' + (this.filterType === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const statusOpts = ['', 'Open', 'Closed'].map(x =>
      '<option value="' + x + '"' + (this.filterStatus === x ? ' selected' : '') + '>' + (x === '' ? 'All statuses' : x) + '</option>').join('');
    return '<div class="card no-print">'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Shift Type</label><select id="sh-f-type">' + typeOpts + '</select></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Status</label><select id="sh-f-status">' + statusOpts + '</select></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="sh-f-from" value="' + esc(this.filterFrom) + '"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="sh-f-to" value="' + esc(this.filterTo) + '"/></div>'
        + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="sh-f-clear">Clear</button></div>'
        + '<button class="btn btn-ghost btn-sm" id="sh-export" style="margin-left:auto;align-self:center;">Export PDF</button>'
      + '</div></div>';
  },

  renderList() {
    this.actions.innerHTML = '';

    const all = this.shifts();
    if (all.length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty"><div class="empty-title">No shifts logged yet</div>'
        + '<div class="empty-sub">Run a shift in Active Shift, or log a past one there under Recent Shifts. It lands here when closed.</div></div></div>';
      this.wireList();
      return;
    }

    const rows = this.filtered();
    const totRev = rows.reduce((t, s) => t + (s.total_revenue || 0), 0);
    const totCov = rows.reduce((t, s) => t + (s.covers || 0), 0);
    const avgChk = totCov > 0 ? totRev / totCov : null;

    let rowsBody;
    if (rows.length === 0) {
      rowsBody = '<div class="empty"><div class="empty-title">No shifts match these filters</div>'
        + '<div class="empty-sub">Adjust or clear them above.</div></div>';
    } else {
      const displayRows = rows.slice(0, App.listLimit('sc', 'shift'));
      const trs = displayRows.map(s => {
        const checkAvg = (s.covers && s.covers > 0) ? (s.total_revenue || 0) / s.covers : null;
        const statusText = (s.status === 'Open')
          ? '<span style="color:var(--gold);font-weight:700;">Open</span>'
          : '<span style="color:var(--t3);font-weight:700;">Closed</span>';
        return '<tr class="sh-row" data-id="' + s.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(s.date) + '</div></td>'
          + '<td>' + esc(s.shift_type || '-') + '</td>'
          + '<td>' + esc(s.manager || '-') + '</td>'
          + '<td class="val">' + App.fmtCurrency(s.total_revenue || 0) + '</td>'
          + '<td>' + (s.covers != null ? s.covers : '-') + '</td>'
          + '<td>' + (checkAvg != null ? App.fmtCurrency(checkAvg) : '-') + '</td>'
          + '<td>' + statusText + '</td>'
          + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm sh-view" data-id="' + s.id + '">View</button></div></td>'
        + '</tr>';
      }).join('');
      rowsBody = '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Shift</th><th>Manager</th><th>Revenue</th>'
        + '<th>Covers</th><th>Check Avg</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + trs + '</tbody></table></div></div>'
        + App.showOlderBar('sc', 'shift', rows, !!(this.filterType || this.filterStatus || this.filterFrom || this.filterTo));
    }

    this.container.innerHTML = '<div class="screen">'
      + this.statsStrip(rows.length, totRev, totCov, avgChk)
      + '<div class="sh no-print" style="margin:24px 0 10px;">Filter Shift History</div>'
      + this.filterCard()
      + rowsBody
      + '</div>';
    this.wireList();
  },

  wireList() {
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const view = ev.target.closest('.sh-view');
      const row = ev.target.closest('.sh-row');
      if (view) { ev.stopPropagation(); this.renderDetail(view.dataset.id); return; }
      if (row) this.renderDetail(row.dataset.id);
    };
    document.getElementById('sh-export')?.addEventListener('click', () => App.exportPDF({ title: 'Shift History', root: this.container }));
    document.getElementById('sh-f-clear')?.addEventListener('click', () => {
      this.filterType = this.filterStatus = this.filterFrom = this.filterTo = '';
      this.renderList();
    });
    const bind = (id, prop) => document.getElementById(id)?.addEventListener('change', e => { this[prop] = e.target.value || ''; this.renderList(); });
    bind('sh-f-type', 'filterType');
    bind('sh-f-status', 'filterStatus');
    bind('sh-f-from', 'filterFrom');
    bind('sh-f-to', 'filterTo');
  },

  // ── Detail (recap) — read-only ────────────────────────────────────────────────
  // Hero + KPI tiles + per-drawer cash + exceptions/notes. Read-only: editing a
  // shift happens in Active Shift (Recent Shifts). Back to the list is the sidebar.
  renderDetail(id) {
    const s = this.shifts().find(x => x.id === id);
    if (!s) { this.renderList(); return; }

    this.actions.innerHTML = '';

    const checkAvg = (s.covers && s.covers > 0) ? (s.total_revenue || 0) / s.covers : null;
    const meta = (label, val) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val">' + val + '</div></div>';

    // ── Cash Reconciliation card ─────────────────────────────────────────
    let cashCard = '';
    if (s.cash_recon) {
      const cr = s.cash_recon;
      const tol = App.cashToleranceForShift ? App.cashToleranceForShift(s) : 10;
      const fmt = x => x != null ? App.fmtCurrency(x) : '-';
      const vCell = (vr, sk, ct) => {
        if (sk || vr == null || ct == null) return '<span style="color:var(--t4);">-</span>';
        const col = Math.abs(vr) <= tol ? 'var(--gold)' : 'var(--red)';
        return '<span style="color:' + col + ';font-weight:700;">' + (vr >= 0 ? '+' : '') + App.fmtCurrency(vr) + '</span>';
      };
      const statusCell = st => {
        const col = st === 'Within Tolerance' ? 'var(--gold)' : (st === 'Short' || st === 'Over') ? 'var(--red)' : 'var(--t3)';
        return '<span style="color:' + col + ';font-weight:700;">' + esc(st || '-') + '</span>';
      };
      if (Array.isArray(cr.drawers) && cr.drawers.length) {
        const rows = cr.drawers.map(c => '<tr>'
          + '<td><div class="val">' + esc(c.name || 'Register') + '</div></td>'
          + '<td>' + fmt(c.opening_bank) + '</td><td>' + fmt(c.drops_total) + '</td>'
          + '<td>' + (c.sales_cash != null ? fmt(c.sales_cash) : '-') + '</td>'
          + '<td>' + fmt(c.expected) + '</td>'
          + '<td>' + (c.counted_cash != null ? fmt(c.counted_cash) : '-') + '</td>'
          + '<td>' + vCell(c.variance, cr.skipped, c.counted_cash) + '</td>'
          + '<td>' + statusCell(c.status) + '</td></tr>').join('');
        const totalRow = '<tr style="border-top:2px solid var(--b1);">'
          + '<td><div class="val" style="font-weight:800;">Total</div></td>'
          + '<td>' + fmt(cr.opening_bank) + '</td><td>' + fmt(cr.drops_total) + '</td>'
          + '<td>' + (cr.sales_cash != null ? fmt(cr.sales_cash) : '-') + '</td>'
          + '<td>' + fmt(cr.expected) + '</td>'
          + '<td>' + (cr.counted_cash != null ? fmt(cr.counted_cash) : '-') + '</td>'
          + '<td>' + vCell(cr.variance, cr.skipped, cr.counted_cash) + '</td><td></td></tr>';
        cashCard = '<div class="sh" style="margin-top:24px;">Cash Reconciliation</div>'
          + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
          + '<th>Drawer</th><th>Opening</th><th>Drops</th><th>POS Cash</th><th>Expected</th><th>Counted</th><th>Variance</th><th>Status</th>'
          + '</tr></thead><tbody>' + rows + totalRow + '</tbody></table></div></div>';
      } else {
        const skipped = cr.skipped;
        const variance = cr.variance;
        const statusColor = skipped ? 'var(--t3)' : (variance == null ? 'var(--t3)' : (Math.abs(variance) <= tol ? 'var(--gold)' : 'var(--red)'));
        const statusText = skipped ? 'SKIPPED' : (variance == null ? 'NOT COUNTED' : (Math.abs(variance) <= tol ? 'OK' : variance < 0 ? 'SHORT' : 'OVER'));
        cashCard = '<div class="sh" style="margin-top:24px;">Cash Reconciliation</div>'
          + '<div class="calc" style="margin-bottom:16px;">'
          + meta('Opening Bank', fmt(cr.opening_bank))
          + meta('POS Cash Sales', cr.sales_cash != null ? App.fmtCurrency(cr.sales_cash) : '-')
          + meta('Drops Out', fmt(cr.drops_total))
          + meta('Expected', fmt(cr.expected))
          + meta('Counted', cr.counted_cash != null ? App.fmtCurrency(cr.counted_cash) : '-')
          + meta('Variance', skipped ? '-' : (variance != null ? ((variance >= 0 ? '+' : '') + App.fmtCurrency(variance)) : '-'))
          + meta('Status', '<span style="color:' + statusColor + ';font-weight:700;">' + statusText + '</span>')
          + '</div>';
      }
    }

    // ── Exception Review acknowledgments ─────────────────────────────────
    let exCard = '';
    if (s.exception_ack && Object.keys(s.exception_ack).length) {
      const labels = { e86: '86\'d Items', vc: 'Big Voids & Comps', mt: 'Open Maintenance', cl: 'Closing Checklist' };
      const ackRows = Object.entries(s.exception_ack)
        .filter(([, v]) => v === true)
        .map(([k]) => '<div style="font-size:12px;color:var(--t1);padding:6px 0;border-bottom:1px solid var(--b2);">&#10003; ' + esc(labels[k] || k) + ' acknowledged</div>')
        .join('');
      if (ackRows) {
        exCard = '<div class="card form-card"><div class="card-title">Exception Review</div>' + ackRows + '</div>';
      }
    }

    // ── Mid-shift notes ──────────────────────────────────────────────────
    let midNotesCard = '';
    if (Array.isArray(s.shift_notes) && s.shift_notes.length) {
      const fmtTime = iso => {
        if (!iso) return '';
        const d = new Date(iso);
        return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      };
      midNotesCard = '<div class="card form-card"><div class="card-title">Shift Notes</div>'
        + s.shift_notes.slice().reverse().map(n =>
            '<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--b2);">'
            + '<div style="font-size:10px;color:var(--gold);font-weight:700;letter-spacing:1px;min-width:55px;padding-top:2px;">' + esc(fmtTime(n.at)) + '</div>'
            + '<div style="flex:1;font-size:13px;color:var(--t1);line-height:1.5;white-space:pre-wrap;">' + esc(n.text || '') + '</div>'
            + '</div>').join('')
        + '</div>';
    }

    // ── Closing notes and handoff ────────────────────────────────────────
    const notesCard = s.notes
      ? '<div class="card form-card"><div class="card-title">Notes</div>'
        + '<div style="font-size:13px;color:var(--t1);white-space:pre-wrap;">' + esc(s.notes) + '</div></div>'
      : '';
    const handoffCard = s.handoff_notes
      ? '<div class="card form-card"><div class="card-title">Handoff Notes for the Opener</div>'
        + '<div style="font-size:13px;color:var(--t1);white-space:pre-wrap;">' + esc(s.handoff_notes) + '</div></div>'
      : '';

    const statTile = (label, val, sub, color) =>
      '<div style="flex:1;min-width:150px;background:var(--input);border:1px solid var(--b2);border-radius:8px;padding:14px 16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:30px;font-weight:600;line-height:1.15;color:' + (color || 'var(--t1)') + ';">' + val + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (sub || '') + '</div></div>';

    let cashVar = '-', cashVarColor = 'var(--t1)', cashVarSub = 'No registers';
    if (s.cash_recon) {
      const cr = s.cash_recon;
      const tol = App.cashToleranceForShift ? App.cashToleranceForShift(s) : 10;
      if (cr.skipped) { cashVarSub = 'Skipped'; cashVarColor = 'var(--t3)'; }
      else if (cr.variance == null) { cashVarSub = 'Not counted'; cashVarColor = 'var(--t3)'; }
      else { cashVar = (cr.variance >= 0 ? '+' : '') + App.fmtCurrency(cr.variance); cashVarColor = Math.abs(cr.variance) <= tol ? 'var(--gold)' : 'var(--red)'; cashVarSub = Math.abs(cr.variance) <= tol ? 'Within tolerance' : cr.variance < 0 ? 'Short' : 'Over'; }
    }
    const tipsVal = (s.tip_recon && s.tip_recon.logged_total != null) ? App.fmtCurrency(s.tip_recon.logged_total) : '-';
    const tipsSub = (s.tip_recon && s.tip_recon.variance != null) ? ((s.tip_recon.variance >= 0 ? '+' : '') + App.fmtCurrency(s.tip_recon.variance) + ' vs POS') : 'logged tips';
    const statusPill = s.status === 'Open'
      ? '<span style="font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--gold);border:1px solid var(--gold);border-radius:3px;padding:2px 7px;">Open</span>'
      : '<span style="font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--t3);border:1px solid var(--b1);border-radius:3px;padding:2px 7px;">Closed</span>';
    const heroMeta = [];
    if (s.manager) heroMeta.push('Manager: ' + esc(s.manager));
    if (s.staff_on_floor != null) heroMeta.push(s.staff_on_floor + ' on floor');

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;"><div>'
      + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><span style="font-size:22px;font-weight:800;color:var(--t1);">' + esc(s.shift_type || 'Shift') + ' &middot; ' + this.fmtDate(s.date) + '</span>' + statusPill + '</div>'
      + (heroMeta.length ? '<div style="font-size:12px;color:var(--t3);margin-top:4px;">' + heroMeta.join(' &middot; ') + '</div>' : '')
      + '</div>'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
      + '<button class="btn btn-ghost btn-sm" id="sh-handoff">Save Handoff PDF</button>'
      + '</div></div></div>'

      + '<div class="card"><div style="display:flex;gap:12px;flex-wrap:wrap;">'
      + statTile('Revenue', App.fmtCurrency(s.total_revenue || 0), App.fmtCurrency(s.bar_revenue || 0) + ' bar &middot; ' + App.fmtCurrency(s.floor_revenue || 0) + ' floor')
      + statTile('Covers', s.covers != null ? s.covers : '-', checkAvg != null ? App.fmtCurrency(checkAvg) + ' check avg' : 'No covers')
      + statTile('Cash Variance', cashVar, cashVarSub, cashVarColor)
      + statTile('Tips', tipsVal, tipsSub)
      + '</div></div>'

      + cashCard
      + exCard
      + midNotesCard
      + notesCard
      + handoffCard
      + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#sh-handoff')) { if (S.ShiftHandoff && S.ShiftHandoff.openForShift) S.ShiftHandoff.openForShift(id); return; }
    };
  }
};
