'use strict';

/* ── Shift Control — Incident Log (writes sc_incidents) ───────────────────────
   The written record for anything that happens on the floor that you would want
   documented later: an injury or slip, an altercation or ejection, a guest cut
   off or refused service (dram-shop protection), theft or a break-in, property
   damage, a customer complaint or illness claim, police or EMS called. Same page
   shape as the other Shift logs: inline collapsible form, filter chips, a row
   list, and the form again in a focused pop-up to edit a past one. It is a
   record-keeping aid, not legal advice. */

S.ShiftIncidents = {
  editId: null,
  _draft: null,            // in-memory inline-form draft (survives leave/return)
  filterPreset: 'last-4',
  _prevPreset: 'last-4',
  filterFrom: '',
  filterTo: '',
  TYPES: ['Injury', 'Altercation / Fight', 'Refused / Cut Off Service', 'Theft / Break-In',
    'Property Damage', 'Customer Complaint', 'Illness Claim', 'Police / EMS Called', 'Other'],
  SEVERITIES: ['Low', 'Medium', 'High'],
  STATUSES: ['Open', 'Resolved'],
  RANGE_CHIPS: [
    { v: 'this-week', label: 'This Week' }, { v: 'last-week', label: 'Last Week' },
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],

  records() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_incidents)) App.shiftData.sc_incidents = [];
    return App.shiftData.sc_incidents;
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  severityRank(s) { const i = this.SEVERITIES.indexOf(s); return i < 0 ? 99 : (this.SEVERITIES.length - i); },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How the Incident Log Works', [
      { p: ['When something happens on the floor that you would want a record of later, log it here while it is fresh. A written account with the date, who was involved, who saw it, and what you did is what protects you if it ever becomes a claim, a lawsuit, or an insurance question. This is a record-keeping aid, not legal advice.'] },
      { h: 'What to log', p: ['An injury or slip, a fight or an ejection, a guest you cut off or refused service (your dram-shop record), theft or a break-in, property damage, a customer complaint or illness claim, or any time police or EMS were called. When in doubt, write it down. The details you capture in the moment are the ones you will wish you had.'] },
      { h: 'Log it', p: ['Set the date and time it happened, pick the type and how serious it was, and write what happened in plain language: who was involved, who witnessed it, and exactly what was said or done. Record the action you took, like cutting someone off, calling a cab, giving first aid, or calling police. Note an estimated cost for theft or damage.'] },
      { h: 'Open vs Resolved', p: ['Leave an incident Open while it still needs follow-up, like an injury claim or an insurance call, so it stays at the top of the list. Mark it Resolved with the date once it is closed out. Resolved incidents drop to the bottom but stay on the permanent record.'] },
      { h: 'Filter and Export', p: ['Narrow the list with the range chips or a custom date range. Export PDF saves the filtered log for your binder, your insurer, or your attorney. Worksheet prints a blank incident sheet to fill out by hand in the moment, then enter here after.'] }
    ]);
  },

  // Status + severity render as colored text, never badges.
  statusText(s) {
    if (s === 'Resolved') return '<span style="color:var(--green);font-weight:700;">Resolved</span>';
    return '<span style="color:var(--t2);font-weight:700;">' + esc(s || 'Open') + '</span>';
  },
  severityText(s) {
    if (s === 'High') return '<span style="color:var(--red);font-weight:700;">High</span>';
    if (s === 'Medium') return '<span style="color:var(--amber);font-weight:700;">Medium</span>';
    return '<span style="color:var(--t3);">' + esc(s || 'Low') + '</span>';
  },

  // Shared form fields (inline form p='in-', edit pop-up p='ine-').
  formFields(r, p) {
    p = p || 'in-';
    const v = val => (val != null && val !== '') ? val : '';
    const typeOpts = this.TYPES.map(x => '<option' + ((r ? r.type : '') === x ? ' selected' : '') + '>' + x + '</option>').join('');
    const sevOpts = this.SEVERITIES.map(x => '<option' + ((r ? r.severity : 'Medium') === x ? ' selected' : '') + '>' + x + '</option>').join('');
    const statOpts = this.STATUSES.map(s => '<option' + ((r ? r.status : 'Open') === s ? ' selected' : '') + '>' + s + '</option>').join('');
    return '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label><input type="date" id="' + p + 'date" value="' + esc(r?.date || App.todayLocal()) + '"/></div>'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>Time</label><input type="time" id="' + p + 'time" value="' + esc(r?.time || '') + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Location</label><input type="text" id="' + p + 'loc" autocomplete="off" value="' + esc(r?.location || '') + '" placeholder="e.g. Main bar"/></div>'
      + '<div class="f" style="flex:1;min-width:160px;"><label>Type' + App.manageListLink('incident_type') + '</label>' + App.customSelect({ id: p + 'type', key: 'incident_type', builtin: this.TYPES, selected: (r ? r.type : ''), blank: true, blankLabel: 'Select type...' }) + '</div>'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>Severity</label><select id="' + p + 'severity">' + sevOpts + '</select></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Status</label><select id="' + p + 'status">' + statOpts + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="flex:1;min-width:150px;"><label>Reported By</label><select id="' + p + 'by">' + App.staffOptions(r?.reported_by_id || r?.reported_by, { placeholder: 'Select staff...' }) + '</select></div>'
      + '<div class="f" style="flex:1;min-width:150px;"><label>Confirmed By</label><select id="' + p + 'confirm">' + App.staffOptions(r?.confirmed_by_id || r?.confirmed_by, { placeholder: 'Select manager...', audience: 'supervisor' }) + '</select></div>'
      + '<div class="f" style="flex:1;min-width:150px;"><label>People Involved</label><input type="text" id="' + p + 'people" autocomplete="off" value="' + esc(r?.people_involved || '') + '" placeholder="Guests and / or staff"/></div>'
      + '<div class="f" style="flex:1;min-width:140px;"><label>Witnesses <span style="color:var(--t4);font-weight:400;">(optional)</span></label><input type="text" id="' + p + 'witnesses" autocomplete="off" value="' + esc(r?.witnesses || '') + '" placeholder="Who saw it"/></div>'
      + '</div>'

      + '<div class="form-row" style="gap:12px;"><div class="f" style="width:100%;"><label>What Happened</label>'
      + '<textarea id="' + p + 'desc" class="notes-ta" rows="2" placeholder="Plain account: who, what, when, where, what was said or done">' + esc(r?.description || '') + '</textarea></div></div>'

      + '<div class="form-row" style="gap:12px;"><div class="f" style="width:100%;"><label>Action Taken</label>'
      + '<textarea id="' + p + 'action" class="notes-ta" rows="2" placeholder="Cut off, called a cab, first aid, called police, etc.">' + esc(r?.action_taken || '') + '</textarea></div></div>'

      + '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date Resolved</label><input type="date" id="' + p + 'resolved" value="' + esc(r?.date_resolved || '') + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Estimated Cost <span style="color:var(--t4);font-weight:400;">(optional)</span></label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + p + 'cost" min="0" step="0.01" value="' + v(r?.cost) + '"/></div></div>'
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
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'in-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><button class="btn btn-ghost btn-sm" id="in-export">Export PDF</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="in-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="in-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + App.rangeWarning(this.filterFrom, this.filterTo)
      + '</div>';
    return row + custom;
  },

  applyFilters(list) {
    const { from, to } = this.effectiveRange();
    return list.filter(r => {
      const d = r.date || '';
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
      if (ao !== bo) return ao ? -1 : 1;                       // open before resolved
      if (ao) { const sr = this.severityRank(a.severity) - this.severityRank(b.severity); if (sr !== 0) return sr; }
      return App.cmpNewest(a, b);
    });

    const formCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('sc-incidents', 'Log an Incident', '<button class="btn btn-ghost btn-sm no-print" id="in-print-blank" type="button">Worksheet</button>')
      + '<div class="collapse-body">'
      + this.formFields(null, 'in-')
      + '</div></div>'
      + '<div data-collapse-group="sc-incidents" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary" id="in-save">Save Incident</button>'
        + '<button class="btn btn-ghost" id="in-startover">Start Over</button>'
        + '<span id="in-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';

    let below;
    if (all.length === 0) {
      below = '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
        + '<th>Date</th><th>Type</th><th>Severity</th><th>Involved</th><th>Status</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="6" style="color:var(--t3);">No incidents logged yet. Use the form above to log the first one.</td></tr></tbody></table></div>';
    } else {
      const open = all.filter(r => r.status !== 'Resolved');
      const high = open.filter(r => r.severity === 'High');
      const resolved = all.filter(r => r.status === 'Resolved');
      const totCost = filtered.reduce((t, r) => t + (r.cost || 0), 0);
      const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Open</div><div class="calc-val lg">' + open.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">High Severity</div><div class="calc-val lg ' + (high.length ? 'warn' : '') + '">' + high.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Resolved</div><div class="calc-val lg">' + resolved.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Logged Cost</div><div class="calc-val lg">' + App.fmtCurrency(totCost) + '</div></div>'
        + '</div></div>';

      let listHtml;
      if (!filtered.length) {
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>Date</th><th>Type</th><th>Severity</th><th>Involved</th><th>Status</th><th></th>'
          + '</tr></thead><tbody><tr><td colspan="6" style="color:var(--t3);">No incidents in this range. Pick a wider range above.</td></tr></tbody></table></div>';
      } else {
        const rows = filtered.slice(0, App.listLimit('sc', 'incident')).map(r => '<tr class="in-row" data-id="' + r.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(r.date) + '</div>'
          + (r.time ? '<div style="font-size:10px;color:var(--t3);">' + esc(r.time) + '</div>' : '') + '</td>'
          + '<td><div class="val">' + esc(r.type || '-') + '</div>'
          + (r.description ? '<div style="font-size:10px;color:var(--t3);">' + esc(r.description) + '</div>' : '') + '</td>'
          + '<td>' + this.severityText(r.severity) + '</td>'
          + '<td>' + esc(r.people_involved || '-') + '</td>'
          + '<td>' + this.statusText(r.status) + '</td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('sc-incidents') ? '<button class="btn btn-ghost btn-sm in-edit" data-id="' + r.id + '">Edit</button>' : '')
          + (App.canEdit('sc-incidents') ? '<button class="btn btn-danger btn-sm in-del" data-id="' + r.id + '">Delete</button>' : '')
          + '</div></td></tr>').join('');
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>Date</th><th>Type</th><th>Severity</th><th>Involved</th><th>Status</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          + App.showOlderBar('sc', 'incident', filtered, this.filterPreset !== 'all');
      }
      below = statsCard + this.filterRow() + listHtml;
    }

    this.container.innerHTML = '<div class="screen">' + formCard + below + '</div>';
    App.applyCollapsed(this.container);
    App.wireCustomSelects(this.container);
    this.wireList();
  },

  wireList() {
    this.container.onclick = ev => {
      const head = ev.target.closest('.card-collapse-head');
      if (head && !ev.target.closest('.btn')) { App.toggleCollapse(head); return; }
      const chip = ev.target.closest('.in-range-chip');
      if (chip) {
        const v = chip.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.renderList();
        return;
      }
      if (ev.target.closest('#in-export')) { const r = this.effectiveRange(); App.exportListPDF({ title: 'Incident Log', root: this.container, footer: 'A record-keeping aid, not legal advice. Verify details before relying on this document.', lists: [['sc', 'incident']], reRender: () => this.renderList(), range: App.chipRangeLabel(this.RANGE_CHIPS, this.filterPreset, r.from, r.to) }); return; }
      if (ev.target.closest('#in-print-blank')) { this.printBlank(); return; }
      if (ev.target.closest('#in-save')) { this.saveNew(); return; }
      if (ev.target.closest('#in-startover')) { this.startOver(); return; }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const edit = ev.target.closest('.in-edit');
      const del  = ev.target.closest('.in-del');
      const row  = ev.target.closest('.in-row');
      if (del)  { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (edit) { ev.stopPropagation(); this.openEditModal(edit.dataset.id); return; }
      if (row && App.canEdit('sc-incidents')) this.openEditModal(row.dataset.id);
    };
    this.wireResolvedAutofill('in-');
    document.getElementById('in-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('in-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });

    // Hold the in-progress inline form through leave/return.
    const formRoot = this.container.querySelector('.form-card');
    if (formRoot) {
      if (this._draft) App.restoreDraft(formRoot, this._draft);
      const cap = () => { this._draft = App.captureDraft(formRoot); };
      formRoot.addEventListener('input', cap);
      formRoot.addEventListener('change', cap);
    }
  },

  startOver() {
    this.editId = null;
    this._draft = null;
    this.renderList();
  },

  // Paper-in-the-moment workflow: a blank incident sheet for the binder.
  printBlank() {
    App.printBlankSheet({
      title: 'Incident Report',
      subtitle: 'Document an incident as it happens. Manager enters it into Bar Cop after the shift. A record-keeping aid, not legal advice.',
      columns: [
        { label: 'Date / Time',     width: '14%' },
        { label: 'Type',            width: '16%' },
        { label: 'Severity',        width: '10%' },
        { label: 'Location',        width: '12%' },
        { label: 'People Involved', width: '16%' },
        { label: 'What Happened',   width: '32%' }
      ],
      rows: 12
    });
  },

  // Edit a logged incident in a focused pop-up (same fields, own ine- ids).
  openEditModal(id) {
    if (!App.canEdit('sc-incidents')) return;
    const r = this.records().find(x => x.id === id);
    if (!r) return;
    this.editId = id;
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Incident</div>'
      + this.formFields(r, 'ine-')
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="ine-save">Update</button>'
      + '<span id="ine-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '<button class="btn btn-danger" id="ine-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'in-edit-modal', maxWidth: 600, noClose: true });
    App.wireCustomSelects(document);
    this.wireResolvedAutofill('ine-');
    document.getElementById('ine-save')?.addEventListener('click', () => this.saveEdit(id));
    document.getElementById('ine-del')?.addEventListener('click', () => { this.editId = null; App.closeModal('in-edit-modal'); this.confirmDel(id); });
  },

  // Collect the form (prefix p) into a record body, or null after an error.
  _collect(p) {
    const err = document.getElementById(p + 'err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById(p + 'date')?.value;
    if (!date) { fail('Date is required.'); return null; }
    const type = document.getElementById(p + 'type')?.value || '';
    if (!type) { fail('Pick a type.'); return null; }
    const description = document.getElementById(p + 'desc')?.value.trim();
    if (!description) { fail('Write what happened before saving.'); return null; }
    const status = document.getElementById(p + 'status')?.value || 'Open';
    const dateResolved = document.getElementById(p + 'resolved')?.value || '';
    if (status === 'Resolved' && !dateResolved) { fail('Resolved incidents need a resolution date. Set Date Resolved or change the status.'); return null; }
    const cost = parseFloat(document.getElementById(p + 'cost')?.value);
    // ⚠ The twin of sc-maintenance's guard, and it failed the same way (SH5): -125 saved silently
    // and Logged Cost read $450 -> $325. Blank stays optional; an explicit 0 is a real answer.
    if (!isNaN(cost) && cost < 0) { fail('Estimated cost cannot be negative.'); return null; }
    const byId = document.getElementById(p + 'by')?.value || '';
    const confirmId = document.getElementById(p + 'confirm')?.value || '';
    return {
      date,
      time:           document.getElementById(p + 'time')?.value || '',
      type,
      severity:       document.getElementById(p + 'severity')?.value || 'Medium',
      status,
      location:       document.getElementById(p + 'loc')?.value.trim() || '',
      reported_by_id: byId,
      reported_by:    (App.staffById(byId) || {}).name || '',
      confirmed_by_id: confirmId,
      confirmed_by:   (App.staffById(confirmId) || {}).name || '',
      people_involved: document.getElementById(p + 'people')?.value.trim() || '',
      witnesses:      document.getElementById(p + 'witnesses')?.value.trim() || '',
      description,
      action_taken:   document.getElementById(p + 'action')?.value.trim() || '',
      date_resolved:  dateResolved,
      cost:           isNaN(cost) ? null : cost
    };
  },

  async saveNew() {
    const body = this._collect('in-');
    if (!body) return;
    const rec = { id: App.uid(), ...body, created_at: new Date().toISOString() };
    const list = this.records();
    list.push(rec);
    const btn = document.getElementById('in-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'incident', rec);
    if (ok) { this._draft = null; this.renderList(); }
    else {
      const i = list.findIndex(x => x.id === rec.id); if (i > -1) list.splice(i, 1);
      if (btn) { btn.disabled = false; btn.textContent = 'Save Incident'; }
      const err = document.getElementById('in-err'); if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; }
    }
  },

  async saveEdit(id) {
    const body = this._collect('ine-');
    if (!body) return;
    const list = this.records();
    const i = list.findIndex(x => x.id === id);
    if (i < 0) { const err = document.getElementById('ine-err'); if (err) { err.textContent = 'Record not found.'; err.style.display = 'inline'; } return; }
    list[i] = { ...list[i], ...body };
    const btn = document.getElementById('ine-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'incident', list[i]);
    if (ok) { this.editId = null; App.closeModal('in-edit-modal'); this.renderList(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Update'; } const err = document.getElementById('ine-err'); if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; } }
  },

  async confirmDel(id) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    await App.removeRecord('sc', 'incident', id);
    this.renderList();
  }
};
