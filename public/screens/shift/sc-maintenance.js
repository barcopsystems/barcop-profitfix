'use strict';

/* ── Shift Control — Maintenance Log (writes sc_maintenance) ──────────────────
   A status tracker for equipment and facility issues: what broke, priority,
   status (Open → In Progress → Resolved), repair cost. Open and urgent items
   feed the Hub alert strip so nothing gets lost between shifts. Same page shape
   as the other Shift logs: inline collapsible form on the landing, filter card
   with a status filter, bare list, the issue form again in a focused pop-up to
   edit a past one. */

S.ShiftMaintenance = {
  editId: null,
  _draft: null,            // in-memory inline-form draft (survives leave/return)
  filterPreset: 'last-4',  // active range chip
  _prevPreset: 'last-4',
  filterFrom: '',          // custom range only
  filterTo: '',
  PRIORITIES: ['Urgent', 'High', 'Normal', 'Low'],
  STATUSES: ['Open', 'In Progress', 'Resolved'],
  RANGE_CHIPS: [
    { v: 'this-week', label: 'This Week' }, { v: 'last-week', label: 'Last Week' },
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],

  records() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_maintenance)) App.shiftData.sc_maintenance = [];
    return App.shiftData.sc_maintenance;
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  priorityRank(p) { const i = this.PRIORITIES.indexOf(p); return i < 0 ? 99 : i; },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How the Maintenance Log Works', [
      { p: ['Equipment breaks and falls through the cracks between shifts. Log it here and it carries forward until someone fixes it. Open and urgent items show up as alerts on the Hub so the next manager sees them.'] },
      { h: 'Log an issue', p: ['Capture what broke, where, how urgent it is, and a short description. Assign it to a staff member or an outside vendor (an HVAC tech, a plumber), whoever is handling the fix.'] },
      { h: 'Work it to closed', p: ['Move the status from Open to In Progress to Resolved as the repair happens. When you mark it Resolved, set the date it was fixed and the repair cost. Resolved drops to the bottom of the list so the open work stays up top.'] },
      { h: 'Filter and Export', p: ['Use the range chips or a custom date range to narrow the list to this week or this month. Open work always sorts to the top, urgent first, with resolved issues below. Export PDF saves the filtered list, and Worksheet prints a blank sheet to mark issues by hand during the shift.'] }
    ]);
  },

  // Status + priority render as colored text, never badges.
  statusText(s) {
    // Resolved = green (done); Open / In Progress stay neutral (the Priority
    // column carries urgency). No gold/blue category colors.
    if (s === 'Resolved') return '<span style="color:var(--green);font-weight:700;">Resolved</span>';
    return '<span style="color:var(--t2);font-weight:700;">' + esc(s || 'Open') + '</span>';
  },
  priorityText(p) {
    if (p === 'Urgent') return '<span style="color:var(--red);font-weight:700;">Urgent</span>';
    if (p === 'High') return '<span style="color:var(--amber);font-weight:700;">High</span>';
    if (p === 'Low') return '<span style="color:var(--t3);">Low</span>';
    return '<span style="color:var(--t2);">' + esc(p || 'Normal') + '</span>';
  },

  // ── Shared form fields (inline form p='mt-', edit pop-up p='mte-'). No Notes:
  //    the Issue field carries the description. ────────────────────────────────
  formFields(r, p) {
    p = p || 'mt-';
    const v = val => (val != null && val !== '') ? val : '';
    const prioOpts = this.PRIORITIES.map(x => '<option' + ((r ? r.priority : 'Normal') === x ? ' selected' : '') + '>' + x + '</option>').join('');
    const statOpts = this.STATUSES.map(s => '<option' + ((r ? r.status : 'Open') === s ? ' selected' : '') + '>' + s + '</option>').join('');
    // Row 1: the metadata (date, equipment, location, priority, status, who).
    // Row 2: the Issue description, two rows tall. Row 3: the resolution.
    return '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date Reported</label><input type="date" id="' + p + 'date" value="' + esc(r?.date_reported || App.todayLocal()) + '"/></div>'
      + '<div class="f" style="flex:1;min-width:150px;"><label>Equipment / Item</label><input type="text" id="' + p + 'equip" autocomplete="off" value="' + esc(r?.equipment || '') + '" placeholder="e.g. Walk-in cooler"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Location</label><input type="text" id="' + p + 'loc" autocomplete="off" value="' + esc(r?.location || '') + '" placeholder="e.g. Kitchen"/></div>'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>Priority</label><select id="' + p + 'priority">' + prioOpts + '</select></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Status</label><select id="' + p + 'status">' + statOpts + '</select></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Reported By</label><select id="' + p + 'by">' + App.staffOptions(r?.reported_by_id || r?.reported_by, { placeholder: 'Select staff...' }) + '</select></div>'
      + '<div class="f" style="flex:1;min-width:160px;"><label>Assigned To</label><input type="text" id="' + p + 'assigned" autocomplete="off" value="' + esc(r?.assigned_to || '') + '" placeholder="Staff member or vendor name"/></div>'
      + '</div>'

      + '<div class="form-row" style="gap:12px;"><div class="f" style="width:100%;"><label>Issue</label>'
      + '<textarea id="' + p + 'issue" class="notes-ta" rows="2" placeholder="Describe the problem">' + esc(r?.issue || '') + '</textarea></div></div>'

      + '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date Resolved</label><input type="date" id="' + p + 'resolved" value="' + esc(r?.date_resolved || '') + '"/></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Repair Cost</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + p + 'cost" min="0" step="0.01" value="' + v(r?.cost) + '"/></div></div>'
      + '</div>';
  },

  // Flipping status to Resolved auto-fills today's resolution date if blank.
  wireResolvedAutofill(p) {
    document.getElementById(p + 'status')?.addEventListener('change', e => {
      if (e.target.value === 'Resolved') {
        const resEl = document.getElementById(p + 'resolved');
        if (resEl && !resEl.value) resEl.value = App.todayLocal();
      }
    });
  },

  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  // Range chips left, Export + Worksheet right, directly above the list; Custom
  // reveals a bare From/To row. The accepted filter model (no filter card).
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'mt-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><button class="btn btn-ghost btn-sm" id="mt-export">Export PDF</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="mt-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="mt-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + App.rangeWarning(this.filterFrom, this.filterTo)
      + '</div>';
    return row + custom;
  },

  applyFilters(list) {
    const { from, to } = this.effectiveRange();
    return list.filter(r => {
      const d = r.date_reported || '';
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  },

  renderList() {
    this.editId = null;
    const all = [...this.records()];
    const filtered = this.applyFilters(all).sort((a, b) => {
      const ao = a.status !== 'Resolved', bo = b.status !== 'Resolved';
      if (ao !== bo) return ao ? -1 : 1;                          // open before resolved
      if (ao) { const pr = this.priorityRank(a.priority) - this.priorityRank(b.priority); if (pr !== 0) return pr; }
      return App.cmpNewest(a, b);
    });

    const formCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('sc-maintenance', 'Log Maintenance Issue', '<button class="btn btn-ghost btn-sm no-print" id="mt-print-blank" type="button">Worksheet</button>')
      + '<div class="collapse-body">'
      + this.formFields(null, 'mt-')
      + '</div></div>'
      + '<div data-collapse-group="sc-maintenance" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary" id="mt-save">Save Issue</button>'
        + '<button class="btn btn-ghost" id="mt-startover">Start Over</button>'
        + '<span id="mt-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';

    let below;
    if (all.length === 0) {
      below = '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
        + '<th>Reported</th><th>Equipment</th><th>Location</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>Cost</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="8" style="color:var(--t3);">No maintenance issues logged yet. Use the form above to log the first one.</td></tr></tbody></table></div>';
    } else {
      const open = all.filter(r => r.status !== 'Resolved');
      const urgent = open.filter(r => r.priority === 'Urgent');
      const resolved = all.filter(r => r.status === 'Resolved');
      const totCost = filtered.reduce((t, r) => t + (r.cost || 0), 0);
      const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Open</div><div class="calc-val lg">' + open.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Urgent</div><div class="calc-val lg ' + (urgent.length ? 'warn' : '') + '">' + urgent.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Resolved</div><div class="calc-val lg">' + resolved.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Repair Cost</div><div class="calc-val lg">' + App.fmtCurrency(totCost) + '</div></div>'
        + '</div></div>';

      let listHtml;
      if (!filtered.length) {
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>Reported</th><th>Equipment</th><th>Location</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>Cost</th><th></th>'
          + '</tr></thead><tbody><tr><td colspan="8" style="color:var(--t3);">No issues in this range. Pick a wider range above.</td></tr></tbody></table></div>';
      } else {
        const rows = filtered.slice(0, App.listLimit('sc', 'maintenance')).map(r => '<tr class="mt-row" data-id="' + r.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(r.date_reported) + '</div></td>'
          + '<td><div class="val">' + esc(r.equipment || '-') + '</div>'
          + (r.issue ? '<div style="font-size:10px;color:var(--t3);">' + esc(r.issue) + '</div>' : '') + '</td>'
          + '<td>' + esc(r.location || '-') + '</td>'
          + '<td>' + this.priorityText(r.priority) + '</td>'
          + '<td>' + this.statusText(r.status) + '</td>'
          + '<td>' + esc(r.assigned_to || '-') + '</td>'
          + '<td>' + (r.cost ? App.fmtCurrency(r.cost) : '<span style="color:var(--t4);">-</span>') + '</td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('sc-maintenance') ? '<button class="btn btn-ghost btn-sm mt-edit" data-id="' + r.id + '">Edit</button>' : '')
          + (App.canEdit('sc-maintenance') ? '<button class="btn btn-danger btn-sm mt-del" data-id="' + r.id + '">Delete</button>' : '')
          + '</div></td></tr>').join('');
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>Reported</th><th>Equipment</th><th>Location</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>Cost</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          + App.showOlderBar('sc', 'maintenance', filtered, this.filterPreset !== 'all');
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
      const chip = ev.target.closest('.mt-range-chip');
      if (chip) {
        const v = chip.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.renderList();
        return;
      }
      if (ev.target.closest('#mt-export')) { const r = this.effectiveRange(); App.exportListPDF({ title: 'Maintenance Log', root: this.container, lists: [['sc', 'maintenance']], reRender: () => this.renderList(), range: App.chipRangeLabel(this.RANGE_CHIPS, this.filterPreset, r.from, r.to) }); return; }
      if (ev.target.closest('#mt-print-blank')) { this.printBlank(); return; }
      if (ev.target.closest('#mt-save')) { this.saveNew(); return; }
      if (ev.target.closest('#mt-startover')) { this.startOver(); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const edit = ev.target.closest('.mt-edit');
      const del  = ev.target.closest('.mt-del');
      const row  = ev.target.closest('.mt-row');
      if (del)  { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (edit) { ev.stopPropagation(); this.openEditModal(edit.dataset.id); return; }
      if (row && App.canEdit('sc-maintenance')) this.openEditModal(row.dataset.id);
    };
    this.wireResolvedAutofill('mt-');
    document.getElementById('mt-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('mt-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });

    // Hold the in-progress inline form through leave/return.
    const formRoot = this.container.querySelector('.form-card');
    if (formRoot) {
      if (this._draft) App.restoreDraft(formRoot, this._draft);
      const cap = () => { this._draft = App.captureDraft(formRoot); };
      formRoot.addEventListener('input', cap);
      formRoot.addEventListener('change', cap);
    }
  },

  // Reset the inline log form to a fresh blank issue.
  startOver() {
    this.editId = null;
    this._draft = null;
    this.renderList();
  },

  // Paper-at-bar workflow: print a blank sheet to mark issues during the shift.
  printBlank() {
    App.printBlankSheet({
      title: 'Maintenance Log',
      subtitle: 'Log equipment and facility issues during the shift. Manager enters each row into Bar Cop after close.',
      columns: [
        { label: 'Date',        width: '12%' },
        { label: 'Equipment',   width: '22%' },
        { label: 'Location',    width: '14%' },
        { label: 'Priority',    width: '12%' },
        { label: 'Issue',       width: '26%' },
        { label: 'Assigned To', width: '14%' }
      ],
      rows: 16
    });
  },

  // Edit a logged issue in a focused pop-up (same fields, own mte- ids).
  openEditModal(id) {
    if (!App.canEdit('sc-maintenance')) return;
    const r = this.records().find(x => x.id === id);
    if (!r) return;
    this.editId = id;
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Maintenance Issue</div>'
      + this.formFields(r, 'mte-')
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="mte-save">Update</button>'
      + '<span id="mte-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '<button class="btn btn-danger" id="mte-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'mt-edit-modal', maxWidth: 540, noClose: true });
    this.wireResolvedAutofill('mte-');
    document.getElementById('mte-save')?.addEventListener('click', () => this.saveEdit(id));
    document.getElementById('mte-del')?.addEventListener('click', () => { this.editId = null; App.closeModal('mt-edit-modal'); this.confirmDel(id); });
  },

  // Log a maintenance issue from the running shift in a focused pop-up (no nav
  // away). preset pre-fills the reported date from the open shift.
  openLogModal(onDone, preset) {
    if (!App.canEdit('sc-maintenance')) return;
    this.editId = null;
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Log Maintenance Issue</div>'
      + this.formFields(preset || null, 'mte-')
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="mte-save">Save</button>'
      + '<span id="mte-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'mt-edit-modal', maxWidth: 540, noClose: true });
    this.wireResolvedAutofill('mte-');
    document.getElementById('mte-save')?.addEventListener('click', () => this.saveLog(onDone));
  },

  async saveLog(onDone) {
    const body = this._collect('mte-');
    if (!body) return;
    const rec = { id: App.uid(), ...body, created_at: new Date().toISOString() };
    const btn = document.getElementById('mte-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'maintenance', rec);
    if (ok) { App.closeModal('mt-edit-modal'); if (typeof onDone === 'function') onDone(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Save'; } const err = document.getElementById('mte-err'); if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; } }
  },

  // Collect the form (prefix p) into a record body, or null after an error.
  _collect(p) {
    const err = document.getElementById(p + 'err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById(p + 'date')?.value;
    if (!date) { fail('Date reported is required.'); return null; }
    const equipment = document.getElementById(p + 'equip')?.value.trim();
    if (!equipment) { fail('Equipment / item is required.'); return null; }
    const status = document.getElementById(p + 'status')?.value || 'Open';
    const dateResolved = document.getElementById(p + 'resolved')?.value || '';
    if (status === 'Resolved' && !dateResolved) { fail('Resolved issues need a resolution date. Set Date Resolved or change the status.'); return null; }
    const cost = parseFloat(document.getElementById(p + 'cost')?.value);
    /* ⚠ A NEGATIVE REPAIR COST SUBTRACTS FROM WHAT THE BAR HAS SPENT (SH5). This stored -50 in
       silence and the Repair Cost tile read $755 -> $705, so the screen UNDER-reported the spend
       with nothing on it saying why. `min="0"` on the input does not stop it: a number input still
       hands back "-50" and nothing calls checkValidity. Blank stays optional and an explicit 0 is a
       real answer (a warranty call), so only a genuine negative is refused. Add Registers in this
       same section already words it this way. */
    if (!isNaN(cost) && cost < 0) { fail('Repair cost cannot be negative.'); return null; }
    const byId = document.getElementById(p + 'by')?.value || '';
    return {
      date_reported: date,
      equipment,
      location:       document.getElementById(p + 'loc')?.value.trim() || '',
      issue:          document.getElementById(p + 'issue')?.value.trim() || '',
      priority:       document.getElementById(p + 'priority')?.value || 'Normal',
      status,
      reported_by_id: byId,
      reported_by:    (App.staffById(byId) || {}).name || '',
      // Assigned To stays free text — maintenance is often handed to an outside
      // vendor (HVAC, plumber) who is not on the staff roster.
      assigned_to:    document.getElementById(p + 'assigned')?.value.trim() || '',
      date_resolved:  dateResolved,
      cost:           isNaN(cost) ? null : cost
    };
  },

  async saveNew() {
    const body = this._collect('mt-');
    if (!body) return;
    const rec = { id: App.uid(), ...body, created_at: new Date().toISOString() };
    const list = this.records();
    list.push(rec);
    const btn = document.getElementById('mt-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'maintenance', rec);
    if (ok) { this._draft = null; this.renderList(); }
    else {
      const i = list.findIndex(x => x.id === rec.id); if (i > -1) list.splice(i, 1);
      if (btn) { btn.disabled = false; btn.textContent = 'Save Issue'; }
      const err = document.getElementById('mt-err'); if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; }
    }
  },

  async saveEdit(id) {
    const body = this._collect('mte-');
    if (!body) return;
    const list = this.records();
    const i = list.findIndex(x => x.id === id);
    if (i < 0) { const err = document.getElementById('mte-err'); if (err) { err.textContent = 'Record not found.'; err.style.display = 'inline'; } return; }
    list[i] = { ...list[i], ...body };
    const btn = document.getElementById('mte-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'maintenance', list[i]);
    if (ok) { this.editId = null; App.closeModal('mt-edit-modal'); this.renderList(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Update'; } const err = document.getElementById('mte-err'); if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; } }
  },

  async confirmDel(id) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    await App.removeRecord('sc', 'maintenance', id);
    this.renderList();
  }
};
