'use strict';

/* ── Shift Control — Maintenance Log (writes sc_maintenance) ──────────────────
   A status tracker for equipment and facility issues: what broke, priority,
   status (Open → In Progress → Resolved), repair cost. Open and urgent items
   feed the Hub alert strip so nothing gets lost between shifts. Filter/action
   card with a status filter on top, bare list below, the issue form in a
   focused pop-up. */

S.ShiftMaintenance = {
  editId: null,
  filterStatus: '',
  filterFrom: '',
  filterTo: '',
  PRIORITIES: ['Urgent', 'High', 'Normal', 'Low'],
  STATUSES: ['Open', 'In Progress', 'Resolved'],

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
      { h: 'Filter and Export', p: ['Filter by status or date to see just the open work or just this month. Export PDF saves the filtered list for a vendor or your records.'] }
    ]);
  },

  // Status + priority render as colored text, never badges.
  statusText(s) {
    if (s === 'Resolved') return '<span style="color:var(--green);font-weight:700;">Resolved</span>';
    if (s === 'In Progress') return '<span style="color:var(--steel);font-weight:700;">In Progress</span>';
    return '<span style="color:var(--amber);font-weight:700;">Open</span>';
  },
  priorityText(p) {
    if (p === 'Urgent') return '<span style="color:var(--red);font-weight:700;">Urgent</span>';
    if (p === 'High') return '<span style="color:var(--amber);font-weight:700;">High</span>';
    if (p === 'Low') return '<span style="color:var(--t3);">Low</span>';
    return '<span style="color:var(--t2);">' + esc(p || 'Normal') + '</span>';
  },

  applyFilters(list) {
    return list.filter(r => {
      if (this.filterStatus && (r.status || 'Open') !== this.filterStatus) return false;
      const d = r.date_reported || '';
      if (this.filterFrom && d < this.filterFrom) return false;
      if (this.filterTo && d > this.filterTo) return false;
      return true;
    });
  },

  renderList() {
    this.editId = null;
    const all = [...this.records()];
    const hasData = all.length > 0;
    const filtered = this.applyFilters(all).sort((a, b) => {
      const ao = a.status !== 'Resolved', bo = b.status !== 'Resolved';
      if (ao !== bo) return ao ? -1 : 1;                          // open before resolved
      if (ao) { const pr = this.priorityRank(a.priority) - this.priorityRank(b.priority); if (pr !== 0) return pr; }
      return new Date(b.created_at || b.date_reported).getTime() - new Date(a.created_at || a.date_reported).getTime();
    });

    const titleRight = '<div style="display:flex;gap:8px;">'
      + App.helpButton('mt-how')
      + (hasData ? '<button class="btn btn-ghost btn-sm" id="mt-export">Export PDF</button>' : '')
      + (App.canEdit('sc-maintenance') ? '<button class="btn btn-primary btn-sm" id="mt-add">Log Issue</button>' : '')
      + '</div>';

    let card;
    if (!hasData) {
      card = '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span>Maintenance Log</span>' + titleRight + '</div>'
        + '<div style="font-size:13px;color:var(--t3);padding:6px 2px;">No maintenance issues logged yet. Log broken equipment and facility issues here. Open and urgent items show up as alerts on the Hub so they carry across shifts.</div></div>';
    } else {
      const open = all.filter(r => r.status !== 'Resolved');
      const urgent = open.filter(r => r.priority === 'Urgent');
      const resolved = all.filter(r => r.status === 'Resolved');
      const totCost = filtered.reduce((t, r) => t + (r.cost || 0), 0);
      const stats = '<div class="calc" style="margin-bottom:0;">'
        + '<div class="calc-item"><div class="calc-label">Open</div><div class="calc-val ' + (open.length ? 'warn' : '') + '">' + open.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Urgent</div><div class="calc-val ' + (urgent.length ? 'warn' : '') + '">' + urgent.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Resolved</div><div class="calc-val">' + resolved.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Repair Cost</div><div class="calc-val">' + App.fmtCurrency(totCost) + '</div></div>'
        + '</div>';
      const statusOpts = ['', ...this.STATUSES].map(s => '<option value="' + esc(s) + '"' + (this.filterStatus === s ? ' selected' : '') + '>' + (s === '' ? 'All statuses' : esc(s)) + '</option>').join('');
      card = '<div class="card no-print"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span>Maintenance Log</span>' + titleRight + '</div>'
        + '<div class="form-row" style="gap:14px;margin-bottom:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Status</label><select id="mt-f-status">' + statusOpts + '</select></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="mt-f-from" value="' + esc(this.filterFrom) + '"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="mt-f-to" value="' + esc(this.filterTo) + '"/></div>'
        + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="mt-f-clear" style="margin-bottom:2px;">Clear</button></div>'
        + '</div>' + stats + '</div>';
    }

    let listHtml = '';
    if (hasData) {
      if (!filtered.length) {
        listHtml = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No issues match the filters.</div>';
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
        listHtml = '<div class="tbl-wrap" style="overflow-x:auto;margin-top:16px;"><table class="tbl"><thead><tr>'
          + '<th>Reported</th><th>Equipment</th><th>Location</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>Cost</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          + App.showOlderBar('sc', 'maintenance', filtered, !!(this.filterStatus || this.filterFrom || this.filterTo));
      }
    }

    this.container.innerHTML = '<div class="screen">' + card + listHtml + '</div>';
    this.wireList();
  },

  wireList() {
    this.container.onclick = ev => {
      if (ev.target.closest('#mt-how')) { this.showHowTo(); return; }
      if (ev.target.closest('#mt-export')) { App.exportPDF({ title: 'Maintenance Log', root: this.container }); return; }
      if (ev.target.closest('#mt-add')) { this.openFormModal(null); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const edit = ev.target.closest('.mt-edit');
      const del  = ev.target.closest('.mt-del');
      const row  = ev.target.closest('.mt-row');
      if (del)  { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (edit) { ev.stopPropagation(); this.openFormModal(edit.dataset.id); return; }
      if (row && App.canEdit('sc-maintenance')) this.openFormModal(row.dataset.id);
    };
    document.getElementById('mt-f-status')?.addEventListener('change', e => { this.filterStatus = e.target.value || ''; this.renderList(); });
    document.getElementById('mt-f-from')?.addEventListener('change',   e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('mt-f-to')?.addEventListener('change',     e => { this.filterTo = e.target.value || ''; this.renderList(); });
    document.getElementById('mt-f-clear')?.addEventListener('click', () => { this.filterStatus = this.filterFrom = this.filterTo = ''; this.renderList(); });
  },

  // ── Issue form (focused pop-up, new + edit). No Notes — the Issue field
  //    carries the description. ────────────────────────────────────────────────
  formFields(r) {
    const v = val => (val != null && val !== '') ? val : '';
    const prioOpts = this.PRIORITIES.map(p => '<option' + ((r ? r.priority : 'Normal') === p ? ' selected' : '') + '>' + p + '</option>').join('');
    const statOpts = this.STATUSES.map(s => '<option' + ((r ? r.status : 'Open') === s ? ' selected' : '') + '>' + s + '</option>').join('');
    const staffList = (App.laborData?.lc_staff || []).filter(s => s.status !== 'Inactive')
      .map(s => '<option value="' + esc(s.name || '') + '"></option>').join('');
    return '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date Reported</label><input type="date" id="mt-date" value="' + esc(r?.date_reported || new Date().toISOString().slice(0, 10)) + '"/></div>'
      + '<div class="f" style="flex:1;min-width:200px;"><label>Equipment / Item</label><input type="text" id="mt-equip" value="' + esc(r?.equipment || '') + '" placeholder="e.g. Walk-in cooler"/></div>'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Location</label><input type="text" id="mt-loc" value="' + esc(r?.location || '') + '" placeholder="e.g. Kitchen"/></div>'
      + '</div>'

      + '<div class="form-row" style="gap:12px;"><div class="f" style="width:100%;"><label>Issue</label>'
      + '<textarea id="mt-issue" rows="2" placeholder="Describe the problem">' + esc(r?.issue || '') + '</textarea></div></div>'

      + '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Priority</label><select id="mt-priority">' + prioOpts + '</select></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Status</label><select id="mt-status">' + statOpts + '</select></div>'
      + '<div class="f" style="width:190px;flex-shrink:0;"><label>Reported By</label><select id="mt-by">' + App.staffOptions(r?.reported_by_id || r?.reported_by, { placeholder: 'Select staff...' }) + '</select></div>'
      + '<div class="f" style="flex:1;min-width:200px;"><label>Assigned To</label>'
      + '<input type="text" id="mt-assigned" list="mt-assigned-list" value="' + esc(r?.assigned_to || '') + '" placeholder="Staff member or vendor name"/>'
      + '<datalist id="mt-assigned-list">' + staffList + '</datalist></div>'
      + '</div>'

      + '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date Resolved</label><input type="date" id="mt-resolved" value="' + esc(r?.date_resolved || '') + '"/></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Repair Cost</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="mt-cost" min="0" step="0.01" value="' + v(r?.cost) + '"/></div></div>'
      + '</div>';
  },

  openFormModal(id) {
    if (id && !App.canEdit('sc-maintenance')) return;
    if (!id && !App.canEdit('sc-maintenance')) return;
    this.editId = id || null;
    const r = id ? this.records().find(x => x.id === id) : null;
    const html = '<div class="card" style="margin:0;"><div class="card-title">' + (id ? 'Edit Maintenance Issue' : 'Log Maintenance Issue') + '</div>'
      + this.formFields(r)
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="mt-save">' + (id ? 'Update' : 'Save Issue') + '</button>'
      + '<button class="btn btn-ghost" id="mt-cancel">Cancel</button>'
      + '<span id="mt-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + (id ? '<button class="btn btn-danger" id="mt-modal-del" style="margin-left:auto;">Delete</button>' : '')
      + '</div></div>';
    App.openModal(html, { id: 'mt-form-modal', maxWidth: 760, noClose: true });
    document.getElementById('mt-cancel')?.addEventListener('click', () => { this.editId = null; App.closeModal('mt-form-modal'); });
    document.getElementById('mt-save')?.addEventListener('click', () => this.save(id));
    document.getElementById('mt-modal-del')?.addEventListener('click', () => { this.editId = null; App.closeModal('mt-form-modal'); this.confirmDel(id); });
    // Flipping status to Resolved auto-fills today's resolution date if blank.
    document.getElementById('mt-status')?.addEventListener('change', e => {
      if (e.target.value === 'Resolved') {
        const resEl = document.getElementById('mt-resolved');
        if (resEl && !resEl.value) resEl.value = new Date().toISOString().slice(0, 10);
      }
    });
  },

  async save(id) {
    const err = document.getElementById('mt-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('mt-date')?.value;
    if (!date) { fail('Date reported is required.'); return; }
    const equipment = document.getElementById('mt-equip')?.value.trim();
    if (!equipment) { fail('Equipment / item is required.'); return; }
    const status = document.getElementById('mt-status')?.value || 'Open';
    const dateResolved = document.getElementById('mt-resolved')?.value || '';
    if (status === 'Resolved' && !dateResolved) { fail('Resolved issues need a resolution date. Set Date Resolved or change the status.'); return; }
    const cost = parseFloat(document.getElementById('mt-cost')?.value);
    const byId = document.getElementById('mt-by')?.value || '';
    const patch = {
      date_reported: date,
      equipment,
      location:       document.getElementById('mt-loc')?.value.trim() || '',
      issue:          document.getElementById('mt-issue')?.value.trim() || '',
      priority:       document.getElementById('mt-priority')?.value || 'Normal',
      status,
      reported_by_id: byId,
      reported_by:    (App.staffById(byId) || {}).name || '',
      // Assigned To stays free text — maintenance is often handed to an outside
      // vendor (HVAC, plumber) who is not on the staff roster.
      assigned_to:    document.getElementById('mt-assigned')?.value.trim() || '',
      date_resolved:  dateResolved,
      cost:           isNaN(cost) ? null : cost
    };

    const list = this.records();
    let saved;
    if (id) {
      const i = list.findIndex(x => x.id === id);
      if (i < 0) { fail('Record not found.'); return; }
      list[i] = { ...list[i], ...patch };
      saved = list[i];
    } else {
      saved = { id: App.uid(), ...patch, created_at: new Date().toISOString() };
      list.push(saved);
    }

    const btn = document.getElementById('mt-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'maintenance', saved);
    if (ok) { this.editId = null; App.closeModal('mt-form-modal'); this.renderList(); }
    else { if (btn) { btn.disabled = false; btn.textContent = id ? 'Update' : 'Save Issue'; } fail('Save failed. Try again.'); }
  },

  async confirmDel(id) {
    const ok = await App.confirm({ title: 'Delete this issue?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;
    await App.removeRecord('sc', 'maintenance', id);
    this.renderList();
  }
};
