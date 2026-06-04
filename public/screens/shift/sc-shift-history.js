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
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Shift History Works', [
      { p: ['Every shift lands here: the ones you close out in Active Shift and any you back-fill with the Log a Past Shift form at the top. Click a row, or View, to open the full recap: revenue, covers, cash reconciliation, tips, exceptions, and the notes from that night.'] },
      { h: 'Logging a Past Shift', p: ['Missed a shift, or running shifts from before Bar Cop? Fill in the form at the top: date, type, manager, revenue, covers, and cash. It lands in the list like any other shift and feeds your weekly Profit and Revenue numbers.'] },
      { h: 'Filter and Export', p: ['Use the Filter card to pull up a shift type, a status, or a date range; the totals update to match. Export PDF saves the filtered list.'] },
      { h: 'View, Edit, Delete', p: ['View opens the shift recap. Edit reopens that shift in the form. Delete removes it. Keep these accurate, because the revenue flows straight into Profit and Revenue Recovery.'] }
    ]);
  },

  // ── Card 1: inline Log a Past Shift form (collapsible) ──────────────────────
  logFormCard() {
    return '<div class="card no-print">'
      + App.collapsibleCardTitle('sc-shift-history', 'Log a Past Shift', App.helpButton('sh-how'))
      + '<div class="collapse-body">'
      + this.formRows(null)
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="sf-save">Save Shift</button>'
        + '<span id="sf-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';
  },

  // Shared shift fields on two rows + the live calc + Notes. Pass a record for
  // edit, or null for a new log.
  formRows(s) {
    const v = val => (val != null && val !== '') ? val : '';
    const typeOpts = App.SHIFT_TYPES.map(t => '<option' + (s && s.shift_type === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const firstDrawer = ((App.shiftData && App.shiftData.sc_drawers) || []).find(d => d.active !== false);
    const defaultBank = (firstDrawer && firstDrawer.default_opening_bank != null) ? firstDrawer.default_opening_bank : '';
    return '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      + '<div class="f" style="flex:1;min-width:140px;"><label>Date</label><input type="date" id="sf-date" value="' + esc(s?.date || new Date().toISOString().slice(0, 10)) + '"/></div>'
      + '<div class="f" style="flex:1;min-width:130px;"><label>Shift Type</label><select id="sf-type">' + typeOpts + '</select></div>'
      + '<div class="f" style="flex:1;min-width:160px;"><label>Manager on Duty</label><select id="sf-mgr">' + App.staffOptions(s?.manager_id || s?.manager, { placeholder: 'Select staff...' }) + '</select></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Bar Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="sf-bar" step="0.01" value="' + v(s?.bar_revenue) + '" oninput="S.ShiftHistory.calc()"/></div></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Floor Revenue</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="sf-floor" step="0.01" value="' + v(s?.floor_revenue) + '" oninput="S.ShiftHistory.calc()"/></div></div>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;flex-wrap:wrap;">'
      + '<div class="f" style="flex:1;min-width:110px;"><label>Covers</label><input type="number" id="sf-covers" min="0" value="' + v(s?.covers) + '" oninput="S.ShiftHistory.calc()"/></div>'
      + '<div class="f" style="flex:1;min-width:110px;"><label>Walkouts</label><input type="number" id="sf-walkouts" min="0" value="' + v(s?.walkouts) + '" placeholder="0"/></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Opening Bank</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="sf-bank" step="0.01" value="' + v(s?.opening_bank != null ? s.opening_bank : defaultBank) + '"/></div></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Staff on Floor</label><input type="number" id="sf-staff" min="0" value="' + v(s?.staff_on_floor) + '"/></div>'
      + '<div class="f" style="flex:1;min-width:120px;"><label>Status</label><select id="sf-status"><option' + (s && s.status === 'Open' ? ' selected' : '') + '>Open</option><option' + (!s || s.status !== 'Open' ? ' selected' : '') + '>Closed</option></select></div>'
      + '</div>'
      + '<div class="calc" style="margin-top:6px;">'
        + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val" id="sf-total">-</div></div>'
        + '<div class="calc-item"><div class="calc-label">Check Average</div><div class="calc-val" id="sf-checkavg">-</div></div>'
      + '</div>'
      + '<div class="f" style="margin-top:6px;margin-bottom:0;"><label>Notes</label><textarea id="sf-notes" rows="2" placeholder="Optional">' + esc(s?.notes || '') + '</textarea></div>';
  },

  calc() {
    const num = id => parseFloat(document.getElementById(id)?.value) || 0;
    const total = num('sf-bar') + num('sf-floor');
    const covers = num('sf-covers');
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('sf-total', App.fmtCurrency(total));
    set('sf-checkavg', covers > 0 ? App.fmtCurrency(total / covers) : '-');
  },

  // ── Card 2: Filter + totals ─────────────────────────────────────────────────
  filterCard(count, totRev, totCov, avgChk) {
    const typeOpts = '<option value="">All shift types</option>'
      + App.SHIFT_TYPES.map(t => '<option' + (this.filterType === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const statusOpts = ['', 'Open', 'Closed'].map(x =>
      '<option value="' + x + '"' + (this.filterStatus === x ? ' selected' : '') + '>' + (x === '' ? 'All statuses' : x) + '</option>').join('');
    return '<div class="card no-print"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Filter</span>'
      + '<button class="btn btn-ghost btn-sm" id="sh-export">Export PDF</button>'
      + '</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Shift Type</label><select id="sh-f-type">' + typeOpts + '</select></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Status</label><select id="sh-f-status">' + statusOpts + '</select></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="sh-f-from" value="' + esc(this.filterFrom) + '"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="sh-f-to" value="' + esc(this.filterTo) + '"/></div>'
        + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="sh-f-clear">Clear</button></div>'
      + '</div>'
      + '<div class="calc" style="margin-bottom:0;">'
        + '<div class="calc-item"><div class="calc-label">Shifts</div><div class="calc-val">' + count + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val">' + App.fmtCurrency(totRev) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Covers</div><div class="calc-val">' + totCov + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Avg Check</div><div class="calc-val">' + (avgChk != null ? App.fmtCurrency(avgChk) : '-') + '</div></div>'
      + '</div></div>';
  },

  renderList() {
    this.editId = null;
    this.actions.innerHTML = '';

    const all = this.shifts();
    const rows = this.filtered();
    const totRev = rows.reduce((t, s) => t + (s.total_revenue || 0), 0);
    const totCov = rows.reduce((t, s) => t + (s.covers || 0), 0);
    const avgChk = totCov > 0 ? totRev / totCov : null;
    const canEdit = App.canEdit && App.canEdit('sc-log-shift');

    let rowsBody;
    if (all.length === 0) {
      rowsBody = '<div style="font-size:13px;color:var(--t3);padding:4px 2px;">No shifts logged yet. Log a past shift above, or run one in Active Shift and it lands here when you close it.</div>';
    } else if (rows.length === 0) {
      rowsBody = '<div style="font-size:13px;color:var(--t3);padding:4px 2px;">No shifts match these filters. Adjust or clear them above.</div>';
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
      rowsBody = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Shift</th><th>Manager</th><th>Revenue</th>'
        + '<th>Covers</th><th>Check Avg</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + trs + '</tbody></table></div>'
        + App.showOlderBar('sc', 'shift', rows, !!(this.filterType || this.filterStatus || this.filterFrom || this.filterTo));
    }

    const rowsCard = '<div class="card"><div class="card-title">Shift History</div>' + rowsBody + '</div>';

    this.container.innerHTML = '<div class="screen">'
      + this.logFormCard()
      + this.filterCard(rows.length, totRev, totCov, avgChk)
      + rowsCard
      + '</div>';
    App.applyCollapsed(this.container);
    this.wireList();
    this.wireForm();
  },

  wireForm() {
    document.getElementById('sh-how')?.addEventListener('click', () => this.showHowTo());
    document.getElementById('sf-save')?.addEventListener('click', () => this.save());
    const head = this.container.querySelector('.card-collapse-head');
    if (head) head.addEventListener('click', ev => { if (!ev.target.closest('.btn')) App.toggleCollapse(head); });
    this.calc();
  },

  wireList() {
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const del = ev.target.closest('.sh-del');
      const edit = ev.target.closest('.sh-edit');
      const view = ev.target.closest('.sh-view');
      const row = ev.target.closest('.sh-row');
      if (del) { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); return; }
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

  // Edit a shift on its own page (same two-row form). Cancel returns to the list.
  showForm(id) {
    if (id && App.canEdit && !App.canEdit('sc-log-shift')) return;
    this.editId = id || null;
    const s = id ? this.shifts().find(x => x.id === id) : null;
    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit Shift' : 'Log a Past Shift') + '</div>'
      + this.formRows(s)
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="sf-save">' + (id ? 'Update' : 'Save Shift') + '</button>'
        + '<button class="btn btn-ghost" id="sf-cancel">Cancel</button>'
        + '<span id="sf-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';
    this.container.onclick = null;
    document.getElementById('sf-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('sf-save')?.addEventListener('click', () => this.save());
    this.calc();
  },

  async save() {
    const err = document.getElementById('sf-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('sf-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };
    const bar = num('sf-bar') || 0, floor = num('sf-floor') || 0;
    const mgrId = document.getElementById('sf-mgr')?.value || '';

    const rec = {
      id:             this.editId || App.uid(),
      date,
      shift_type:     document.getElementById('sf-type')?.value || '',
      manager_id:     mgrId,
      manager:        (App.staffById(mgrId) || {}).name || '',
      bar_revenue:    bar,
      floor_revenue:  floor,
      total_revenue:  bar + floor,
      covers:         num('sf-covers'),
      walkouts:       num('sf-walkouts'),
      opening_bank:   num('sf-bank'),
      staff_on_floor: num('sf-staff'),
      status:         document.getElementById('sf-status')?.value || 'Closed',
      notes:          document.getElementById('sf-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.shifts();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('sf-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'shift', saved);
    this.editId = null;
    if (ok) {
      if (App.markSetupDone) App.markSetupDone('gs_sc_shift');
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Shift'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const ok = await App.confirm({ title: 'Delete this shift?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;
    await App.removeRecord('sc', 'shift', id);
    this.renderList();
  },

  // ── Detail (recap) ───────────────────────────────────────────────────────────
  // Hero + KPI tiles + per-drawer cash + exceptions/notes. View opens it; Edit
  // reopens the shift in the form. Back to the list is the sidebar.
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
        cashCard = '<div class="card"><div class="card-title">Cash Reconciliation</div>'
          + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
          + '<th>Drawer</th><th>Opening</th><th>Drops</th><th>POS Cash</th><th>Expected</th><th>Counted</th><th>Variance</th><th>Status</th>'
          + '</tr></thead><tbody>' + rows + totalRow + '</tbody></table></div></div>';
      } else {
        const skipped = cr.skipped;
        const variance = cr.variance;
        const statusColor = skipped ? 'var(--t3)' : (variance == null ? 'var(--t3)' : (Math.abs(variance) <= tol ? 'var(--gold)' : 'var(--red)'));
        const statusText = skipped ? 'SKIPPED' : (variance == null ? 'NOT COUNTED' : (Math.abs(variance) <= tol ? 'OK' : variance < 0 ? 'SHORT' : 'OVER'));
        cashCard = '<div class="card"><div class="card-title">Cash Reconciliation</div>'
          + '<div class="calc" style="margin-bottom:0;">'
          + meta('Opening Bank', fmt(cr.opening_bank))
          + meta('POS Cash Sales', cr.sales_cash != null ? App.fmtCurrency(cr.sales_cash) : '-')
          + meta('Drops Out', fmt(cr.drops_total))
          + meta('Expected', fmt(cr.expected))
          + meta('Counted', cr.counted_cash != null ? App.fmtCurrency(cr.counted_cash) : '-')
          + meta('Variance', skipped ? '-' : (variance != null ? ((variance >= 0 ? '+' : '') + App.fmtCurrency(variance)) : '-'))
          + meta('Status', '<span style="color:' + statusColor + ';font-weight:700;">' + statusText + '</span>')
          + '</div></div>';
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
      + '<button class="btn btn-ghost btn-sm" id="sh-edit">Edit</button>'
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
      if (ev.target.closest('#sh-edit')) { this.showForm(id); return; }
    };
  }
};
