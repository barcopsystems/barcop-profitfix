'use strict';

/* ── Shift Control — Incident Log (writes sc_incidents) ───────────────────────
   The manager's insurance/legal logbook for the rare-but-real moments that
   happen in a bar: customer slip-and-fall, altercation between guests,
   refusal of service, employee injury, theft observed, police visit, property
   damage. Documented in real time, with date/time/people/description/action,
   signed by the manager on duty.

   When a claim or legal matter comes back months later, this is the record
   the operator hands to their insurance broker or attorney. Independent
   operators without HR or risk-management software keep this on paper, and
   the paper inevitably disappears. Bar Cop keeps it forever. */

S.ShiftIncidentLog = {
  editId: null,
  filterFrom: '',
  filterTo: '',
  filterType: '',
  filterSeverity: '',

  TYPES: ['Slip / Fall', 'Customer Altercation', 'Refusal of Service', 'Employee Injury',
    'Theft Observed', 'Property Damage', 'Police Visit', 'Health Inspector Visit',
    'ABC / Liquor Authority Visit', 'Fire Marshal Visit', 'Other'],
  SEVERITIES: ['Low', 'Medium', 'High', 'Critical'],

  incidents() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_incidents)) App.shiftData.sc_incidents = [];
    return App.shiftData.sc_incidents;
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
    this.renderList();
  },

  renderList() {
    this.editId = null;
    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="in-export">Export PDF</button>';
    document.getElementById('in-export')?.addEventListener('click', () => App.exportPDF({ title: 'Incident Log', root: this.container }));

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = '+ Log Incident';
    addBtn.addEventListener('click', () => this.showForm());
    this.actions.appendChild(addBtn);

    const all = this.incidents();
    const filtered = this.applyFilters(all);
    filtered.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''));

    const followUpCount = filtered.filter(r => r.follow_up_needed).length;
    const summary = '<div class="calc" style="margin-bottom:14px;">'
      + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val">' + filtered.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Follow-up Needed</div><div class="calc-val ' + (followUpCount ? 'warn' : '') + '">' + followUpCount + '</div></div>'
      + '</div>';

    let html;
    if (all.length === 0) {
      html = '<div class="empty"><div class="empty-title">No incidents logged yet</div>'
        + '<div class="empty-sub">Slip-and-fall, customer altercations, refusal of service, employee injuries, theft, regulatory visits. Whenever something happens that you or your insurance broker would want a paper trail for, log it here. Documented the same night beats trying to reconstruct it months later when a claim hits.</div>'
        + '<button class="btn btn-primary" id="in-add-first">Log Your First Incident</button></div>';
    } else if (filtered.length === 0) {
      html = summary + this.filterCard() + '<div class="empty"><div class="empty-title">No incidents match the filters</div>'
        + '<div class="empty-sub">Adjust or clear the filters above.</div></div>';
    } else {
      const rows = filtered.slice(0, App.listLimit('sc', 'incident')).map(r => {
        const sevColor = r.severity === 'Critical' ? 'var(--red)'
                      : r.severity === 'High' ? 'var(--red)'
                      : r.severity === 'Medium' ? 'var(--gold)'
                      : 'var(--t3)';
        const sevBadge = '<span style="font-size:9px;font-weight:800;letter-spacing:1px;color:' + sevColor + ';border:1px solid ' + sevColor + ';border-radius:3px;padding:2px 6px;">' + esc(r.severity || 'Low') + '</span>';
        return '<tr class="in-row" data-id="' + r.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(r.date) + '</div>'
          + (r.time ? '<div style="font-size:10px;color:var(--t3);">' + esc(r.time) + '</div>' : '') + '</td>'
          + '<td><div class="val">' + esc(r.type || '-') + '</div></td>'
          + '<td>' + sevBadge + '</td>'
          + '<td>' + esc(r.manager || '-') + '</td>'
          + '<td>' + (r.follow_up_needed ? '<span class="badge badge-warn">Follow-up</span>' : '<span style="color:var(--t4);font-size:11px;">-</span>') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm in-edit" data-id="' + r.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm in-del" data-id="' + r.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      html = summary + this.filterCard()
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>When</th><th>Type</th><th>Severity</th><th>Manager</th><th></th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + App.showOlderBar('sc', 'incident', filtered, !!(this.filterFrom || this.filterTo || this.filterType || this.filterSeverity))
        + '<div style="font-size:10px;color:var(--t3);margin-top:10px;line-height:1.6;">Generated from your input data. Not legal or insurance advice. Coordinate with your broker or attorney on any claim or matter.</div>';
    }

    this.container.innerHTML = '<div class="screen">' + html + '</div>';
    this.wireList();
  },

  filterCard() {
    const typeOpts = '<option value="">All types</option>'
      + this.TYPES.map(t => '<option value="' + esc(t) + '"' + (this.filterType === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const sevOpts = '<option value="">All severities</option>'
      + this.SEVERITIES.map(s => '<option value="' + esc(s) + '"' + (this.filterSeverity === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    return '<div class="card"><div class="card-title">Filter</div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="in-f-from" value="' + esc(this.filterFrom) + '"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="in-f-to" value="' + esc(this.filterTo) + '"/></div>'
        + '<div class="f" style="width:220px;flex-shrink:0;"><label>Type</label><select id="in-f-type">' + typeOpts + '</select></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Severity</label><select id="in-f-sev">' + sevOpts + '</select></div>'
        + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="in-f-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div></div>';
  },

  applyFilters(list) {
    return list.filter(r => {
      const date = r.date || '';
      if (this.filterFrom && date < this.filterFrom) return false;
      if (this.filterTo && date > this.filterTo) return false;
      if (this.filterType && r.type !== this.filterType) return false;
      if (this.filterSeverity && r.severity !== this.filterSeverity) return false;
      return true;
    });
  },

  wireList() {
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row  = ev.target.closest('.in-row');
      const edit = ev.target.closest('.in-edit');
      const del  = ev.target.closest('.in-del');
      const addF = ev.target.closest('#in-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row)  this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
    document.getElementById('in-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('in-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });
    document.getElementById('in-f-type')?.addEventListener('change', e => { this.filterType = e.target.value || ''; this.renderList(); });
    document.getElementById('in-f-sev')?.addEventListener('change',  e => { this.filterSeverity = e.target.value || ''; this.renderList(); });
    document.getElementById('in-f-clear')?.addEventListener('click', () => {
      this.filterFrom = this.filterTo = this.filterType = this.filterSeverity = '';
      this.renderList();
    });
  },

  showForm(id) {
    this.editId = id || null;
    const r = id ? this.incidents().find(x => x.id === id) : null;
    const typeOpts = this.TYPES.map(t =>
      '<option' + (r && r.type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const sevOpts = this.SEVERITIES.map(s =>
      '<option' + (r && r.severity === s ? ' selected' : (!r && s === 'Low' ? ' selected' : '')) + '>' + esc(s) + '</option>').join('');

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit Incident' : 'Log an Incident') + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.55;">Document the incident while it\'s fresh. Date, time, what happened, who was involved, what you did about it. Specifics matter when a claim or legal matter comes back months later.</div>'

      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
          + '<input type="date" id="in-date" value="' + esc(r?.date || new Date().toISOString().slice(0, 10)) + '"/></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Time</label>'
          + '<input type="time" id="in-time" value="' + esc(r?.time || this.nowTime()) + '"/></div>'
        + '<div class="f" style="width:220px;flex-shrink:0;"><label>Type</label>'
          + '<select id="in-type">' + typeOpts + '</select></div>'
        + '<div class="f" style="width:140px;flex-shrink:0;"><label>Severity</label>'
          + '<select id="in-severity">' + sevOpts + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:240px;flex-shrink:0;"><label>Manager on Duty</label>'
          + '<select id="in-mgr">' + App.staffOptions(r?.manager_id || App.activeManagerId(), { placeholder: 'Select staff...' }) + '</select></div>'
        + '<div class="f" style="flex:1;min-width:220px;"><label>Location in Building</label>'
          + '<input type="text" id="in-location" value="' + esc(r?.location || '') + '" placeholder="Main bar, dining room, restroom, etc."/></div>'
      + '</div>'

      + '<div class="f" style="margin-top:6px;"><label>People Involved</label>'
        + '<input type="text" id="in-people" value="' + esc(r?.people_involved || '') + '" placeholder="Customer name, employee, witnesses..."/></div>'

      + '<div class="f" style="margin-top:6px;"><label>Description (what happened)</label>'
        + '<textarea id="in-description" rows="5" placeholder="Specifics: who was there, what was said, what was done. Plain operator voice. Avoid speculation; stick to what you saw or what staff reported.">' + esc(r?.description || '') + '</textarea></div>'

      + '<div class="f" style="margin-top:6px;"><label>Witnesses</label>'
        + '<textarea id="in-witnesses" rows="2" placeholder="Names and contact info for any witnesses (staff and customers).">' + esc(r?.witnesses || '') + '</textarea></div>'

      + '<div class="f" style="margin-top:6px;"><label>Action Taken</label>'
        + '<textarea id="in-action" rows="3" placeholder="What you did at the time: called 911, refused service, asked customer to leave, offered first aid, called the owner.">' + esc(r?.action_taken || '') + '</textarea></div>'

      + '<div class="f" style="margin-top:6px;"><label>Follow-Up / Notes</label>'
        + '<textarea id="in-notes" rows="3" placeholder="Anything left to do: file a police report, contact insurance, schedule a coaching session.">' + esc(r?.notes || '') + '</textarea></div>'

      + '<div style="margin-top:6px;">'
        + '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t2);cursor:pointer;">'
          + '<input type="checkbox" id="in-followup" ' + (r?.follow_up_needed ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;"/>'
          + 'Follow-up needed'
        + '</label>'
      + '</div>'

      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="in-save">' + (id ? 'Update' : 'Log Incident') + '</button>'
        + '<button class="btn btn-ghost" id="in-cancel">Cancel</button>'
        + '<button class="btn btn-ghost" id="in-print" style="margin-left:auto;"' + (id ? '' : ' disabled style="margin-left:auto;opacity:0.5;cursor:not-allowed;"') + '>Print Insurance Report</button>'
        + '<span id="in-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('in-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('in-save')?.addEventListener('click', () => this.save());
    if (id) document.getElementById('in-print')?.addEventListener('click', () => this.printReport(id));
  },

  async save() {
    const err = document.getElementById('in-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('in-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const description = document.getElementById('in-description')?.value.trim();
    if (!description) { fail('Description is required.'); return; }
    const managerId = document.getElementById('in-mgr')?.value || '';
    if (!managerId) { fail('Manager on Duty is required.'); return; }

    const rec = {
      id:                this.editId || App.uid(),
      date,
      time:              document.getElementById('in-time')?.value || '',
      type:              document.getElementById('in-type')?.value || 'Other',
      severity:          document.getElementById('in-severity')?.value || 'Low',
      manager_id:        managerId,
      manager:           (App.staffById(managerId) || {}).name || '',
      location:          document.getElementById('in-location')?.value.trim() || '',
      people_involved:   document.getElementById('in-people')?.value.trim() || '',
      description,
      witnesses:         document.getElementById('in-witnesses')?.value.trim() || '',
      action_taken:      document.getElementById('in-action')?.value.trim() || '',
      notes:             document.getElementById('in-notes')?.value.trim() || '',
      follow_up_needed:  !!document.getElementById('in-followup')?.checked
    };
    if (!this.editId) rec.created_at = new Date().toISOString();
    else rec.updated_at = new Date().toISOString();

    const list = this.incidents();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('in-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'incident', saved);
    this.editId = null;
    if (ok) this.renderList();
    else {
      if (btn) { btn.disabled = false; btn.textContent = 'Log Incident'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const ok = await App.confirm({ title: 'Delete this incident entry?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;
    await App.removeRecord('sc', 'incident', id);
    this.renderList();
  },

  // Insurance-ready report: one-page printable record for handing to a broker
  // or attorney. Operator voice + the legal-protection disclaimer.
  printReport(id) {
    const r = this.incidents().find(x => x.id === id);
    if (!r) return;
    const barName = (App.data?.settings?.bar_name) || '';
    const bar = (App.data?.settings || {});
    const when = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const escH = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const line = (label, val) => '<div style="display:flex;padding:6px 0;border-bottom:1px solid #e5e5e5;"><div style="width:170px;font-weight:700;color:#555;font-size:11px;letter-spacing:1px;text-transform:uppercase;">' + escH(label) + '</div><div style="font-size:13px;color:#111;">' + escH(val || '-') + '</div></div>';
    const block = (label, val) => '<div style="margin-top:14px;"><div style="font-weight:700;color:#555;font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">' + escH(label) + '</div><div style="font-size:13px;color:#111;line-height:1.6;white-space:pre-wrap;">' + escH(val || '(none)') + '</div></div>';
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>Incident Report</title>'
      + '<style>body{font-family:Georgia,serif;color:#111;max-width:780px;margin:30px auto;padding:0 24px;}h1{font-size:20px;margin:0 0 4px;}.sub{color:#666;font-size:12px;margin-bottom:18px;}.footer{margin-top:30px;padding-top:14px;border-top:1px solid #ccc;font-size:10px;color:#666;line-height:1.6;}@media print{body{margin:0;}}</style>'
      + '</head><body>'
      + '<h1>Incident Report</h1>'
      + '<div class="sub">' + escH(barName) + (bar.city_state ? ' &middot; ' + escH(bar.city_state) : '') + ' &middot; Report printed ' + escH(when) + '</div>'
      + line('Date of Incident', this.fmtDate(r.date))
      + line('Time', r.time)
      + line('Type', r.type)
      + line('Severity', r.severity)
      + line('Manager on Duty', r.manager)
      + line('Location in Building', r.location)
      + line('People Involved', r.people_involved)
      + block('Description', r.description)
      + block('Witnesses', r.witnesses)
      + block('Action Taken at the Time', r.action_taken)
      + block('Follow-Up Needed', (r.follow_up_needed ? 'Yes. ' : 'No. ') + (r.notes || ''))
      + '<div class="footer">Generated from your input data on ' + escH(when) + '. This is the operator\'s record of events at the time, not legal or insurance advice. Coordinate with your broker or attorney on any claim or matter that arises from this incident.</div>'
      + '</body></html>';
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => { try { w.print(); } catch (e) {} }, 300);
  }
};
