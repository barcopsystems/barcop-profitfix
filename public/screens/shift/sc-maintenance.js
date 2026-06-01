'use strict';

/* ── Shift Control — Maintenance Log (writes sc_maintenance) ──────────────────
   Tracks equipment and facility issues: what broke, priority, status, repair
   cost. Open and urgent items feed the Hub alert strip so nothing gets lost
   between shifts. */

S.ShiftMaintenance = {
  editId: null,
  _pendingDelId: null,
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
  priorityRank(p) {
    const i = this.PRIORITIES.indexOf(p);
    return i < 0 ? 99 : i;
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = 'Log Issue';
    addBtn.addEventListener('click', () => this.showForm());
    actions.appendChild(addBtn);
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-ghost btn-sm';
    exportBtn.textContent = 'Export PDF';
    exportBtn.addEventListener('click', () => App.exportPDF({ title: 'Maintenance Log', root: this.container }));
    actions.appendChild(exportBtn);
    this.renderList();
  },

  priorityBadge(p) {
    return (p === 'Urgent' || p === 'High')
      ? '<span class="badge badge-warn">' + esc(p) + '</span>'
      : '<span class="badge badge-dim">' + esc(p || 'Normal') + '</span>';
  },
  statusBadge(s) {
    if (s === 'Resolved') return '<span class="badge badge-ok">Resolved</span>';
    if (s === 'In Progress') return '<span class="badge badge-dim">In Progress</span>';
    return '<span class="badge badge-dim">Open</span>';
  },

  renderList() {
    const recs = [...this.records()].sort((a, b) => {
      const ao = a.status !== 'Resolved', bo = b.status !== 'Resolved';
      if (ao !== bo) return ao ? -1 : 1;                         // open before resolved
      if (ao) {                                                   // both open — by priority
        const pr = this.priorityRank(a.priority) - this.priorityRank(b.priority);
        if (pr !== 0) return pr;
      }
      return new Date(b.created_at || b.date_reported).getTime() - new Date(a.created_at || a.date_reported).getTime();
    });

    let html;
    if (recs.length === 0) {
      html = '<div class="empty"><div class="empty-title">No maintenance issues logged</div>'
        + '<div class="empty-sub">Log broken equipment and facility issues here. Open and urgent items '
        + 'show up as alerts on the Hub so they carry across shifts.</div>'
        + '<button class="btn btn-primary" id="mt-add-first">Log Issue</button></div>';
    } else {
      const open = recs.filter(r => r.status !== 'Resolved');
      const urgent = open.filter(r => r.priority === 'Urgent');
      const resolved = recs.filter(r => r.status === 'Resolved');
      const totCost = recs.reduce((t, r) => t + (r.cost || 0), 0);
      const summary = '<div class="calc" style="margin-bottom:16px;">'
        + '<div class="calc-item"><div class="calc-label">Open</div><div class="calc-val ' + (open.length ? 'warn' : '') + '">' + open.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Urgent</div><div class="calc-val ' + (urgent.length ? 'warn' : '') + '">' + urgent.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Resolved</div><div class="calc-val">' + resolved.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Repair Cost</div><div class="calc-val">' + App.fmtCurrency(totCost) + '</div></div>'
        + '</div>';
      const rows = recs.map(r => '<tr class="mt-row" data-id="' + r.id + '" style="cursor:pointer;">'
        + '<td><div class="val">' + this.fmtDate(r.date_reported) + '</div></td>'
        + '<td><div class="val">' + esc(r.equipment || '-') + '</div>'
        + (r.issue ? '<div style="font-size:10px;color:var(--t3);">' + esc(r.issue) + '</div>' : '') + '</td>'
        + '<td>' + esc(r.location || '-') + '</td>'
        + '<td>' + this.priorityBadge(r.priority) + '</td>'
        + '<td>' + this.statusBadge(r.status) + '</td>'
        + '<td>' + esc(r.assigned_to || '-') + '</td>'
        + '<td>' + (r.cost ? App.fmtCurrency(r.cost) : '<span style="color:var(--t4);">-</span>') + '</td>'
        + '<td><div class="row-actions">'
        + (App.canEdit('sc-maintenance') ? '<button class="btn btn-ghost btn-sm mt-edit" data-id="' + r.id + '">Edit</button>' : '')
        + (App.canEdit('sc-maintenance') ? '<button class="btn btn-danger btn-sm mt-del" data-id="' + r.id + '">Delete</button>' : '')
        + '</div></td></tr>').join('');
      html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Reported</th><th>Equipment</th><th>Location</th><th>Priority</th>'
        + '<th>Status</th><th>Assigned To</th><th>Cost</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="mt-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this issue?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="mt-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="mt-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      const row = ev.target.closest('.mt-row');
      const edit = ev.target.closest('.mt-edit');
      const del = ev.target.closest('.mt-del');
      const addF = ev.target.closest('#mt-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row && App.canEdit('sc-maintenance')) this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
  },

  showForm(id) {
    if (id && !App.canEdit('sc-maintenance')) return;
    this.editId = id || null;
    const r = id ? this.records().find(x => x.id === id) : null;
    const prioOpts = this.PRIORITIES.map(p =>
      '<option' + ((r ? r.priority : 'Normal') === p ? ' selected' : '') + '>' + p + '</option>').join('');
    const statOpts = this.STATUSES.map(s =>
      '<option' + ((r ? r.status : 'Open') === s ? ' selected' : '') + '>' + s + '</option>').join('');
    const v = val => (val != null && val !== '') ? val : '';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'Log') + ' Maintenance Issue</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date Reported</label>'
      + '<input type="date" id="mt-date" value="' + esc(r?.date_reported || new Date().toISOString().slice(0, 10)) + '"/></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Equipment / Item</label>'
      + '<input type="text" id="mt-equip" value="' + esc(r?.equipment || '') + '" placeholder="e.g. Walk-in cooler"/></div>'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Location</label>'
      + '<input type="text" id="mt-loc" value="' + esc(r?.location || '') + '" placeholder="e.g. Kitchen"/></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Issue</label>'
      + '<textarea id="mt-issue" rows="2" placeholder="Describe the problem">' + esc(r?.issue || '') + '</textarea></div></div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Priority</label>'
      + '<select id="mt-priority">' + prioOpts + '</select></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Status</label>'
      + '<select id="mt-status">' + statOpts + '</select></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Reported By</label>'
      + '<select id="mt-by">' + App.staffOptions(r?.reported_by_id || r?.reported_by, { placeholder: 'Select staff...' }) + '</select></div>'
      + '<div class="f" style="width:240px;flex-shrink:0;"><label>Assigned To</label>'
      + '<input type="text" id="mt-assigned" list="mt-assigned-list" value="' + esc(r?.assigned_to || '') + '" placeholder="Staff member or vendor name"/>'
      + '<datalist id="mt-assigned-list">'
      + ((App.laborData?.lc_staff || []).filter(s => s.status !== 'Inactive')
          .map(s => '<option value="' + esc(s.name || '') + '"></option>').join(''))
      + '</datalist>'
      + '</div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date Resolved</label>'
      + '<input type="date" id="mt-resolved" value="' + esc(r?.date_resolved || '') + '"/></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Repair Cost</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="mt-cost" min="0" step="0.01" value="' + v(r?.cost) + '"/></div></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="mt-notes" rows="2" placeholder="Optional">' + esc(r?.notes || '') + '</textarea></div></div>'

      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="mt-save">' + (id ? 'Update' : 'Save Issue') + '</button>'
      + '<button class="btn btn-ghost" id="mt-cancel">Cancel</button>'
      + '<span id="mt-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('mt-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('mt-save')?.addEventListener('click', () => this.save());
    // When the operator flips status to Resolved, auto-fill today's date if
    // the resolution date is blank. Operator can override before saving.
    document.getElementById('mt-status')?.addEventListener('change', e => {
      if (e.target.value === 'Resolved') {
        const resEl = document.getElementById('mt-resolved');
        if (resEl && !resEl.value) resEl.value = new Date().toISOString().slice(0, 10);
      }
    });
  },

  async save() {
    const err = document.getElementById('mt-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('mt-date')?.value;
    if (!date) { fail('Date reported is required.'); return; }
    const equipment = document.getElementById('mt-equip')?.value.trim();
    if (!equipment) { fail('Equipment / item is required.'); return; }

    const status = document.getElementById('mt-status')?.value || 'Open';
    const dateResolved = document.getElementById('mt-resolved')?.value || '';
    if (status === 'Resolved' && !dateResolved) {
      fail('Resolved issues need a resolution date. Set Date Resolved or change the status.');
      return;
    }
    const cost = parseFloat(document.getElementById('mt-cost')?.value);
    const rec = {
      id:            this.editId || App.uid(),
      date_reported: date,
      equipment,
      location:      document.getElementById('mt-loc')?.value.trim() || '',
      issue:         document.getElementById('mt-issue')?.value.trim() || '',
      priority:      document.getElementById('mt-priority')?.value || 'Normal',
      status,
      reported_by_id: document.getElementById('mt-by')?.value || '',
      reported_by:    (App.staffById(document.getElementById('mt-by')?.value) || {}).name || '',
      // Assigned To stays free text because maintenance is often assigned to
      // an external vendor (HVAC repair, plumber) who is not on staff roster.
      assigned_to:    document.getElementById('mt-assigned')?.value.trim() || '',
      date_resolved: dateResolved,
      cost:          isNaN(cost) ? null : cost,
      notes:         document.getElementById('mt-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.records();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('mt-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveShift();
    this.editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Issue'; }
      fail('Save failed. Try again.');
    }
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('mt-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('mt-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('mt-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.shiftData.sc_maintenance = this.records().filter(x => x.id !== delId);
      await App.saveShift();
      this.renderList();
    };
  }
};
