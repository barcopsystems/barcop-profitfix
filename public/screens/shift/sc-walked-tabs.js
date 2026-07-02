'use strict';

/* ── Shift Control — Walked Tabs Log (writes sc_walked_tabs) ──────────────────
   Tracks customers who leave without paying: walked tabs, dine-and-dash,
   mis-billed checks, lost-check write-offs. Real dollar losses that today
   evaporate into "I think we lost $73 somewhere on Saturday." Inline add form
   on the landing, filter card with totals, bare list. The log feeds Books
   shrinkage attribution and a server walk-rate trend. */

S.ShiftWalkedTabs = {
  editId: null,
  _draft: null,            // in-memory inline-form draft (survives leave/return)
  filterPreset: 'last-4',  // active range chip
  _prevPreset: 'last-4',
  filterFrom: '',          // custom range only
  filterTo: '',

  REASONS: ['Walked', 'Mis-bill', 'Refused to Pay', 'Lost Check', 'Other'],
  RANGE_CHIPS: [
    { v: 'this-week', label: 'This Week' }, { v: 'last-week', label: 'Last Week' },
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],

  tabs() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_walked_tabs)) App.shiftData.sc_walked_tabs = [];
    return App.shiftData.sc_walked_tabs;
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  nowTime() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How the Walked Tabs Log Works', [
      { p: ['A walked tab is real money out the door: a customer who leaves without paying, a mis-billed check, a lost ticket. Log it while it is fresh so the loss lands on the right server and shift instead of evaporating into the weekly total.'] },
      { h: 'Logging one', p: ['Pick the server who had the table, the amount, the reason, and the manager who absorbed the loss. The reason codes (Walked, Mis-bill, Refused to Pay, Lost Check, Other) let you tell a dine-and-dash from a billing mistake.'] },
      { h: 'What it feeds', p: ['The log attributes losses to the right server and shift and surfaces a server walk-rate trend over time. It also feeds Books shrinkage attribution.'] },
      { h: 'Filter and Export', p: ['Use the range chips (This Week, Last Week, This Month, Last 4 Weeks, All) or a custom date range, and the entry count and total loss update to match. Export PDF saves the filtered list.'] }
    ]);
  },

  // Shared fields: all data cells on one row, Notes on its own row. r=record (edit)
  // or null (add). p = element-id prefix ('wt-' inline add form, 'wte-' edit
  // pop-up) so the modal's inputs never collide with the inline form behind it.
  formFields(r, p) {
    p = p || 'wt-';
    const v = val => (val != null && val !== '') ? val : '';
    const reasonOpts = this.REASONS.map(rs => '<option' + (r && r.reason === rs ? ' selected' : '') + '>' + esc(rs) + '</option>').join('');
    const inline = p === 'wt-';
    const dateCell   = '<div class="f" style="width:140px;flex-shrink:0;"><label>Date</label><input type="date" id="' + p + 'date" value="' + esc(r?.date || App.todayLocal()) + '"/></div>';
    const timeCell   = '<div class="f" style="width:110px;flex-shrink:0;"><label>Time</label><input type="time" id="' + p + 'time" value="' + esc(r?.time || this.nowTime()) + '"/></div>';
    const serverCell = '<div class="f" style="flex:1;min-width:140px;"><label>Server</label><select id="' + p + 'server">' + App.staffOptions(r?.server_id || r?.server, { placeholder: 'Select staff...', audience: 'service' }) + '</select></div>';
    const amountCell = '<div class="f" style="width:120px;flex-shrink:0;"><label>Amount</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + p + 'amount" min="0" step="0.01" value="' + v(r?.amount) + '" placeholder="0.00"/></div></div>';
    const checkCell  = '<div class="f" style="width:110px;flex-shrink:0;"><label>Check #</label><input type="text" id="' + p + 'check" value="' + esc(r?.check_ref || '') + '" placeholder="Optional"/></div>';
    const reasonCell = '<div class="f" style="width:145px;flex-shrink:0;"><label>Reason</label><select id="' + p + 'reason">' + reasonOpts + '</select></div>';
    const mgrCell    = '<div class="f" style="width:165px;flex-shrink:0;"><label>Manager</label><select id="' + p + 'mgr">' + App.staffOptions(r?.manager_id || App.activeManagerId(), { placeholder: 'Select staff...', audience: 'supervisor' }) + '</select></div>';
    const notesRow   = App.noteField({ id: p + 'notes', value: r?.notes, placeholder: 'What happened. Did the customer leave during a rush? Anything that helps you spot patterns later.' });
    // Inline log form: every data cell on one row (wraps when narrow). The edit
    // pop-up is a narrower modal, so it keeps a two-row split.
    if (inline) {
      return '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
        + dateCell + timeCell + serverCell + amountCell + checkCell + reasonCell + mgrCell
        + '</div>' + notesRow;
    }
    return '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + dateCell + timeCell + serverCell + amountCell
      + '</div>'
      + '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + checkCell + reasonCell + mgrCell
      + '</div>' + notesRow;
  },

  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  // Range chips left, Export right, directly above the list; Custom reveals a bare
  // From/To row. The accepted filter model (no filter card, no categorical dropdowns).
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'wt-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><button class="btn btn-ghost btn-sm" id="wt-export">Export PDF</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="wt-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="wt-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
  },

  applyFilters(list) {
    const { from, to } = this.effectiveRange();
    return list.filter(r => {
      const date = r.date || '';
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  },

  renderList() {
    this.editId = null;
    const all = this.tabs();
    const filtered = this.applyFilters(all);
    filtered.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));
    const totalLoss = filtered.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    const formCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('sc-walked-tabs', 'Log a Walked Tab')
      + '<div class="collapse-body">'
      + this.formFields(null)
      + '</div></div>'
      // Log + Start Over below the card (bottom-left), hidden with the card on collapse.
      + '<div data-collapse-group="sc-walked-tabs" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary" id="wt-save">Log Walked Tab</button>'
        + '<button class="btn btn-ghost" id="wt-startover">Start Over</button>'
        + '<span id="wt-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';

    let below;
    if (all.length === 0) {
      below = '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
        + '<th>When</th><th>Server</th><th>Check #</th><th>Amount</th><th>Reason</th><th>Manager</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="7" style="color:var(--t3);">No walked tabs logged yet. Use the form above to log the first one.</td></tr></tbody></table></div>';
    } else {
      const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val lg">' + filtered.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Loss</div><div class="calc-val lg warn">' + App.fmtCurrency(totalLoss) + '</div></div>'
        + '</div></div>';
      let listHtml;
      if (filtered.length === 0) {
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>When</th><th>Server</th><th>Check #</th><th>Amount</th><th>Reason</th><th>Manager</th><th></th>'
          + '</tr></thead><tbody><tr><td colspan="7" style="color:var(--t3);">No walked tabs in this range. Pick a wider range above.</td></tr></tbody></table></div>';
      } else {
        const rows = filtered.slice(0, App.listLimit('sc', 'walked_tab')).map(r => '<tr class="wt-row" data-id="' + r.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(r.date) + '</div>'
          + (r.time ? '<div style="font-size:10px;color:var(--t3);">' + esc(r.time) + '</div>' : '') + '</td>'
          + '<td>' + esc(r.server || '-') + '</td>'
          + '<td>' + esc(r.check_ref || '-') + '</td>'
          + '<td class="val neg">' + App.fmtCurrency(r.amount || 0) + '</td>'
          + '<td>' + esc(r.reason || '-') + '</td>'
          + '<td>' + esc(r.manager || '-') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm wt-edit" data-id="' + r.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm wt-del" data-id="' + r.id + '">Delete</button>'
          + '</div></td></tr>').join('');
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>When</th><th>Server</th><th>Check #</th><th>Amount</th><th>Reason</th><th>Manager</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          + App.showOlderBar('sc', 'walked_tab', filtered, this.filterPreset !== 'all');
      }
      below = statsCard + this.filterRow() + listHtml;
    }

    this.container.innerHTML = '<div class="screen">' + formCard + below + '</div>';
    App.applyCollapsed(this.container);
    this.wireList();
  },

  wireList() {
    this.container.onclick = ev => {
      const head = ev.target.closest('.card-collapse-head');
      if (head && !ev.target.closest('.btn')) { App.toggleCollapse(head); return; }
      const chip = ev.target.closest('.wt-range-chip');
      if (chip) {
        const v = chip.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.renderList();
        return;
      }
      if (ev.target.closest('#wt-export')) { App.exportPDF({ title: 'Walked Tabs', root: this.container }); return; }
      if (ev.target.closest('#wt-save')) { this.save(); return; }
      if (ev.target.closest('#wt-startover')) { this.startOver(); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const edit = ev.target.closest('.wt-edit');
      const del  = ev.target.closest('.wt-del');
      const row  = ev.target.closest('.wt-row');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (edit)      { ev.stopPropagation(); this.openEditModal(edit.dataset.id); return; }
      if (row) this.openEditModal(row.dataset.id);
    };
    document.getElementById('wt-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('wt-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });

    // Hold the in-progress inline form through leave/return: restore the draft,
    // then capture on every input so a re-render rebuilds from it.
    const formRoot = this.container.querySelector('.form-card');
    if (formRoot) {
      if (this._draft) App.restoreDraft(formRoot, this._draft);
      const cap = () => { this._draft = App.captureDraft(formRoot); };
      formRoot.addEventListener('input', cap);
      formRoot.addEventListener('change', cap);
    }
  },

  // Reset the inline log form to a fresh blank walked tab.
  startOver() {
    this.editId = null;
    this._draft = null;
    this.renderList();
  },

  // Edit in a focused pop-up (own wte- ids). Cancel closes it.
  openEditModal(id) {
    const r = this.tabs().find(x => x.id === id);
    if (!r) return;
    this.editId = id;
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Walked Tab</div>'
      + this.formFields(r, 'wte-')
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="wte-save">Update</button>'
      + '<span id="wte-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '<button class="btn btn-danger" id="wte-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'wt-edit-modal', maxWidth: 540, noClose: true });
    document.getElementById('wte-save')?.addEventListener('click', () => this.saveEdit(id));
    document.getElementById('wte-del')?.addEventListener('click', () => { this.editId = null; App.closeModal('wt-edit-modal'); this.confirmDel(id); });
  },

  async saveEdit(id) {
    const err = document.getElementById('wte-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('wte-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const amount = parseFloat(document.getElementById('wte-amount')?.value);
    if (isNaN(amount) || amount <= 0) { fail('Enter the dollar amount lost.'); return; }
    const serverId = document.getElementById('wte-server')?.value || '';
    if (!serverId) { fail('Pick the server.'); return; }
    const managerId = document.getElementById('wte-mgr')?.value || '';
    if (!managerId) { fail('Pick the manager.'); return; }
    const list = this.tabs();
    const i = list.findIndex(x => x.id === id);
    if (i < 0) { fail('Record not found.'); return; }
    const patch = {
      date,
      time:       document.getElementById('wte-time')?.value || '',
      server_id:  serverId,
      server:     (App.staffById(serverId) || {}).name || '',
      check_ref:  document.getElementById('wte-check')?.value.trim() || '',
      amount,
      reason:     document.getElementById('wte-reason')?.value || 'Walked',
      manager_id: managerId,
      manager:    (App.staffById(managerId) || {}).name || '',
      notes:      document.getElementById('wte-notes')?.value.trim() || '',
      updated_at: new Date().toISOString()
    };
    list[i] = { ...list[i], ...patch };
    const btn = document.getElementById('wte-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'walked_tab', list[i]);
    if (ok) { this.editId = null; App.closeModal('wt-edit-modal'); this.renderList(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Update'; } fail('Save failed. Try again.'); }
  },

  async save() {
    const err = document.getElementById('wt-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('wt-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const amount = parseFloat(document.getElementById('wt-amount')?.value);
    if (isNaN(amount) || amount <= 0) { fail('Enter the dollar amount lost.'); return; }
    const serverId = document.getElementById('wt-server')?.value || '';
    if (!serverId) { fail('Pick the server.'); return; }
    const managerId = document.getElementById('wt-mgr')?.value || '';
    if (!managerId) { fail('Pick the manager.'); return; }

    const rec = {
      id:          this.editId || App.uid(),
      date,
      time:        document.getElementById('wt-time')?.value || '',
      server_id:   serverId,
      server:      (App.staffById(serverId) || {}).name || '',
      check_ref:   document.getElementById('wt-check')?.value.trim() || '',
      amount,
      reason:      document.getElementById('wt-reason')?.value || 'Walked',
      manager_id:  managerId,
      manager:     (App.staffById(managerId) || {}).name || '',
      notes:       document.getElementById('wt-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();
    else rec.updated_at = new Date().toISOString();

    const list = this.tabs();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('wt-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'walked_tab', saved);
    this.editId = null;
    if (ok) { this._draft = null; this.renderList(); }
    else {
      if (btn) { btn.disabled = false; btn.textContent = 'Log Walked Tab'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    await App.removeRecord('sc', 'walked_tab', id);
    this.renderList();
  }
};
