'use strict';

/* ── Shift Control — Shift History (reads sc_shifts) ──────────────────────────
   Read-only review of every logged shift. Summary strip, filters (shift type,
   status, date range), a per-shift detail view, and print-to-PDF export. Editing
   happens in Log a Shift — this screen only reads. */

S.ShiftHistory = {
  filterType: '',
  filterStatus: '',
  filterFrom: '',
  filterTo: '',

  shifts() {
    return ((App.shiftData && App.shiftData.sc_shifts) || []);
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

  // ── Entry ───────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Shift History Works', [
      { p: ['Every shift you run lands here: the ones you close out in Active Shift and any you back-fill with Log a Past Shift. Click a row, or View, to open the full detail: revenue, covers, cash reconciliation, tips, exceptions, and the notes from that night.'] },
      { h: 'Logging a Past Shift', p: ['Missed one, or running shifts from before Bar Cop? Log a Past Shift opens the shift form so you can enter it by hand. It lands in this list like any other shift.'] },
      { h: 'Editing', p: ['Edit on any row opens that shift in the same form. Changes flow straight into your weekly Profit and Revenue numbers, so keep them accurate.'] },
      { h: 'Export and Handoff', p: ['Export PDF saves the filtered list. Open a shift and use Save Handoff PDF or Email Handoff to send the one-page handoff to the next manager.'] }
    ]);
  },

  renderList() {
    const all = this.shifts();
    this.actions.innerHTML = '';

    if (all.length === 0) {
      App.setupCard(this.container, {
        title: 'Shift History',
        lead: 'Every shift shows up here with revenue, covers, check average, cash, and tips. Shift revenue is what feeds your weekly Profit and Revenue numbers.',
        steps: [
          { title: 'Run a shift', desc: 'Start a shift in Active Shift when service begins. Close it out and it lands here.', btn: 'Open Active Shift', screen: 'sc-active-shift', done: false },
          { title: 'Or log a past shift', desc: 'Back-fill a shift that was missed or run before Bar Cop.', btn: 'Log a Past Shift', screen: 'sc-log-shift', done: false }
        ]
      });
      return;
    }

    const rows = this.filtered();
    const totRev = rows.reduce((t, s) => t + (s.total_revenue || 0), 0);
    const totCov = rows.reduce((t, s) => t + (s.covers || 0), 0);
    const avgChk = totCov > 0 ? totRev / totCov : null;
    const canEdit = App.canEdit && App.canEdit('sc-log-shift');

    const SHIFT_TYPES = App.SHIFT_TYPES;
    const typeOpts = '<option value="">All shift types</option>'
      + SHIFT_TYPES.map(t => '<option' + (this.filterType === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const statusOpts = ['', 'Open', 'Closed'].map(s =>
      '<option value="' + s + '"' + (this.filterStatus === s ? ' selected' : '') + '>'
      + (s === '' ? 'All statuses' : s) + '</option>').join('');

    let table;
    if (rows.length === 0) {
      table = '<div style="font-size:13px;color:var(--t3);padding:6px 2px;">No shifts match these filters. Adjust or clear them above.</div>';
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
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm sh-view" data-id="' + s.id + '">View</button>'
          + (canEdit ? '<button class="btn btn-ghost btn-sm sh-edit" data-id="' + s.id + '">Edit</button>' : '')
          + (canEdit ? '<button class="btn btn-danger btn-sm sh-del" data-id="' + s.id + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');
      table = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Shift</th><th>Manager</th><th>Revenue</th>'
        + '<th>Covers</th><th>Check Avg</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + trs + '</tbody></table></div>'
        + App.showOlderBar('sc', 'shift', rows, !!(this.filterType || this.filterStatus || this.filterFrom || this.filterTo));
    }

    const card = '<div class="card">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;"><span>Shift History</span>'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
      + '<button class="btn btn-ghost btn-sm" id="sh-log-missed">Log a Past Shift</button>'
      + '<button class="btn btn-ghost btn-sm no-print" id="sh-export">Export PDF</button>'
      + App.helpButton('sh-how')
      + '</div></div>'
      + '<div class="form-row no-print" style="gap:16px;margin-bottom:14px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Shift Type</label>'
      + '<select id="sh-f-type">' + typeOpts + '</select></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Status</label>'
      + '<select id="sh-f-status">' + statusOpts + '</select></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label>'
      + '<input type="date" id="sh-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label>'
      + '<input type="date" id="sh-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label>'
      + '<button class="btn btn-ghost" id="sh-f-clear">Clear</button></div>'
      + '</div>'
      + '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Shifts</div><div class="calc-val">' + rows.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val">' + App.fmtCurrency(totRev) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Covers</div><div class="calc-val">' + totCov + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Avg Check</div><div class="calc-val">' + (avgChk != null ? App.fmtCurrency(avgChk) : '-') + '</div></div>'
      + '</div>'
      + table
      + '</div>';

    this.container.innerHTML = '<div class="screen">' + card + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#sh-how')) { this.showHowTo(); return; }
      if (ev.target.closest('#sh-log-missed')) { if (S.ShiftLogShift) S.ShiftLogShift._openEditId = null; App.navigate('sc-log-shift'); return; }
      if (ev.target.closest('#sh-export')) { App.exportPDF({ title: 'Shift History', root: this.container }); return; }
      if (ev.target.closest('#sh-f-clear')) { this.filterType = this.filterStatus = this.filterFrom = this.filterTo = ''; this.renderList(); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const del = ev.target.closest('.sh-del');
      const edit = ev.target.closest('.sh-edit');
      const view = ev.target.closest('.sh-view');
      const row = ev.target.closest('.sh-row');
      if (del) { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (edit) { ev.stopPropagation(); if (S.ShiftLogShift) S.ShiftLogShift._openEditId = edit.dataset.id; App.navigate('sc-log-shift'); return; }
      if (view) { ev.stopPropagation(); this.renderDetail(view.dataset.id); return; }
      if (row) { this.renderDetail(row.dataset.id); return; }
    };
    const bind = (id, prop) => document.getElementById(id)?.addEventListener('change', e => {
      this[prop] = e.target.value || '';
      this.renderList();
    });
    bind('sh-f-type', 'filterType');
    bind('sh-f-status', 'filterStatus');
    bind('sh-f-from', 'filterFrom');
    bind('sh-f-to', 'filterTo');
  },

  async confirmDel(id) {
    const ok = await App.confirm({ title: 'Delete this shift?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;
    await App.removeRecord('sc', 'shift', id);
    this.renderList();
  },

  // ── Detail ──────────────────────────────────────────────────────────────────
  // Unified detail page — shows every section of the shift on first open:
  // Profile/Revenue, Cash Reconciliation, Tip Reconciliation, Exceptions
  // acknowledged, Mid-Shift Notes, Handoff Notes. No hidden data.
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
      const skipped = cr.skipped;
      const variance = cr.variance;
      const statusColor = skipped
        ? 'var(--t3)'
        : (variance == null ? 'var(--t3)'
          : (Math.abs(variance) <= (App.cashToleranceForShift ? App.cashToleranceForShift(s) : 10) ? 'var(--gold)' : 'var(--red)'));
      const statusText = skipped ? 'SKIPPED'
        : (variance == null ? 'NOT COUNTED'
          : (Math.abs(variance) <= (App.cashToleranceForShift ? App.cashToleranceForShift(s) : 10) ? 'OK'
            : variance < 0 ? 'SHORT' : 'OVER'));
      cashCard = '<div class="card"><div class="card-title">Cash Reconciliation</div>'
        + '<div class="calc" style="margin-bottom:0;">'
        + meta('Opening Bank', cr.opening_bank != null ? App.fmtCurrency(cr.opening_bank) : '-')
        + meta('POS Cash Sales', cr.sales_cash != null ? App.fmtCurrency(cr.sales_cash) : '-')
        + meta('Drops Out', cr.drops_total != null ? App.fmtCurrency(cr.drops_total) : '-')
        + meta('Expected', cr.expected != null ? App.fmtCurrency(cr.expected) : '-')
        + meta('Counted', cr.counted_cash != null ? App.fmtCurrency(cr.counted_cash) : '-')
        + meta('Variance', skipped ? '-' : (variance != null ? ((variance >= 0 ? '+' : '') + App.fmtCurrency(variance)) : '-'))
        + meta('Status', '<span style="color:' + statusColor + ';font-weight:700;">' + statusText + '</span>')
        + '</div></div>';
    }

    // ── Tip Reconciliation card ──────────────────────────────────────────
    let tipCard = '';
    if (s.tip_recon) {
      const tr = s.tip_recon;
      const variance = tr.variance;
      tipCard = '<div class="card"><div class="card-title">Tip Reconciliation</div>'
        + '<div class="calc" style="margin-bottom:0;">'
        + meta('Logged Total', tr.logged_total != null ? App.fmtCurrency(tr.logged_total) : '-')
        + meta('POS Reported', tr.pos_reported != null ? App.fmtCurrency(tr.pos_reported) : '-')
        + meta('Variance', variance != null ? ((variance >= 0 ? '+' : '') + App.fmtCurrency(variance)) : '-')
        + '</div></div>';
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
        exCard = '<div class="card"><div class="card-title">Exception Review</div>' + ackRows + '</div>';
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
      midNotesCard = '<div class="card"><div class="card-title">Shift Notes</div>'
        + s.shift_notes.slice().reverse().map(n =>
            '<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--b2);">'
            + '<div style="font-size:10px;color:var(--gold);font-weight:700;letter-spacing:1px;min-width:55px;padding-top:2px;">' + esc(fmtTime(n.at)) + '</div>'
            + '<div style="flex:1;font-size:13px;color:var(--t1);line-height:1.5;white-space:pre-wrap;">' + esc(n.text || '') + '</div>'
            + '</div>').join('')
        + '</div>';
    }

    // ── Closing notes and handoff ────────────────────────────────────────
    const notesCard = s.notes
      ? '<div class="card"><div class="card-title">Notes</div>'
        + '<div style="font-size:13px;color:var(--t1);white-space:pre-wrap;">' + esc(s.notes) + '</div></div>'
      : '';
    const handoffCard = s.handoff_notes
      ? '<div class="card"><div class="card-title">Handoff Notes for the Opener</div>'
        + '<div style="font-size:13px;color:var(--t1);white-space:pre-wrap;">' + esc(s.handoff_notes) + '</div></div>'
      : '';

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="sh-back">&laquo; Back to Shift History</button></div>'
      + '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;"><span>'
      + esc(s.shift_type || 'Shift') + ' &middot; ' + this.fmtDate(s.date) + '</span>'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
      + '<button class="btn btn-ghost btn-sm" id="sh-handoff">Save Handoff PDF</button>'
      + '<button class="btn btn-ghost btn-sm no-print" id="sh-export">Export PDF</button>'
      + '</div></div>'
      + '<div class="calc" style="margin-bottom:0;">'
      + meta('Manager', esc(s.manager || '-'))
      + meta('Status', s.status === 'Open' ? 'Open' : 'Closed')
      + meta('Staff on Floor', s.staff_on_floor != null ? s.staff_on_floor : '-')
      + meta('Drawer', esc(s.drawer || '-'))
      + meta('Opening Bank', s.opening_bank != null ? App.fmtCurrency(s.opening_bank) : '-')
      + '</div></div>'
      + '<div class="card"><div class="card-title">Revenue</div>'
      + '<div class="calc" style="margin-bottom:0;">'
      + meta('Bar Revenue', App.fmtCurrency(s.bar_revenue || 0))
      + meta('Floor Revenue', App.fmtCurrency(s.floor_revenue || 0))
      + meta('Total Revenue', App.fmtCurrency(s.total_revenue || 0))
      + meta('Covers', s.covers != null ? s.covers : '-')
      + meta('Check Average', checkAvg != null ? App.fmtCurrency(checkAvg) : '-')
      + '</div></div>'
      + cashCard
      + tipCard
      + exCard
      + midNotesCard
      + notesCard
      + handoffCard
      + '<div class="card-actions" style="margin-top:4px;">'
      + '<button class="btn btn-ghost" id="sh-edit">Edit</button></div>'
      + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#sh-back')) { this.renderList(); return; }
      if (ev.target.closest('#sh-handoff')) { if (S.ShiftHandoff && S.ShiftHandoff.openForShift) S.ShiftHandoff.openForShift(id); return; }
      if (ev.target.closest('#sh-export')) { App.exportPDF({ title: 'Shift History', root: this.container }); return; }
      if (ev.target.closest('#sh-edit')) {
        // Hand the shift id to the form's edit flow so it opens with this shift
        // already loaded, no manual navigation back to find it.
        if (S.ShiftLogShift) S.ShiftLogShift._openEditId = id;
        App.navigate('sc-log-shift');
      }
    };
  }
};
