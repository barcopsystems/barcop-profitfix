'use strict';

/* ── Labor Control — Tip Log (writes lc_tips) ─────────────────────────────────
   Records tips by SHIFT and staff member — cash and card, totalled.
   shift_id is the anchor. Picking a shift pre-fills date, shift_type, and the
   active manager. Staff dropdown filters to that shift's logged staff (with full
   roster fallback). Hours pull from lc_actuals when staff + shift are both set.

   Landing = inline Log Tips form on top, a filter card, then the tip list.
   Clicking a row opens its edit page (same form, minus How it works). */

S.LaborTipLog = {
  editId: null,
  _pendingDelId: null,
  filterFrom: '',
  filterTo: '',
  filterStaff: '',

  tips() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_tips)) App.laborData.lc_tips = [];
    return App.laborData.lc_tips;
  },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
  shifts() { return ((App.shiftData && App.shiftData.sc_shifts) || []); },
  shiftById(id) { return this.shifts().find(s => s.id === id); },
  actuals() { return ((App.laborData && App.laborData.lc_actuals) || []); },

  // Shift dropdown options. Open shifts first, then closed shifts from the last
  // 14 days, then a Manual escape hatch for off-cycle entries.
  shiftOptions(selectedId) {
    const all = this.shifts().slice().sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
    const open = all.filter(s => s.status === 'Open');
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
    const closed = all.filter(s => s.status !== 'Open' && new Date(s.date || s.created_at) >= cutoff);

    const label = s => {
      const d = s.date ? new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const parts = [d, s.shift_type || ''].filter(Boolean).join(' · ');
      return parts || 'Shift';
    };

    let h = '<option value="">Select a shift...</option>';
    if (open.length) {
      h += '<optgroup label="Open Shifts">';
      open.forEach(s => { h += '<option value="' + s.id + '"' + (s.id === selectedId ? ' selected' : '') + '>' + esc(label(s)) + '</option>'; });
      h += '</optgroup>';
    }
    if (closed.length) {
      h += '<optgroup label="Recent Closed Shifts">';
      closed.forEach(s => { h += '<option value="' + s.id + '"' + (s.id === selectedId ? ' selected' : '') + '>' + esc(label(s)) + '</option>'; });
      h += '</optgroup>';
    }
    h += '<optgroup label="Other"><option value="__manual"' + (selectedId === '__manual' ? ' selected' : '') + '>Manual entry (no specific shift)</option></optgroup>';
    return h;
  },

  // Active shift for the current session — defaults the form to it
  activeShift() {
    return this.shifts().filter(s => s.status === 'Open')
      .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())[0] || null;
  },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How the Tip Log Works', [
      { p: ['The Tip Log records cash and card tips by shift and staff member. Pick the shift first and Bar Cop fills in the date, shift type, and the staff who worked it, so you mostly just type the tip amounts.'] },
      { h: 'Logging Tips', p: ['Choose the shift, pick the staff member (the dropdown lists who worked that shift first), then enter cash and card tips. Tippable hours pull from logged hours automatically, and you can override them. Pick Manual entry instead of a shift for an off-cycle entry where you set the date and shift type yourself.'] },
      { h: 'Where Tips Go', p: ['Tips feed the Tip Pool calculator and the tip-credit check on Pay Periods, which compares a tipped employee\'s wage plus tips against your state minimum. Logging accurately here keeps those honest.'] },
      { h: 'Worksheet', p: ['The Worksheet button prints a clean grid to tally tips per server on the floor during the shift, then enter the rows here after close.'] }
    ]);
  },

  // The shift to default the dropdown to: an existing record's shift, an existing
  // manual entry, the active shift, or none.
  initialShiftIdFor(x) {
    if (x) {
      if (x.shift_id) return x.shift_id;
      if (x.date) return '__manual';
      return '';
    }
    const a = this.activeShift();
    return a ? a.id : '';
  },

  // Shared form fields used by the inline add form and the edit page. All entry
  // cells on one row (Shift, Staff, Tippable Hours, Cash, Card, Total); the
  // manual date/shift-type row and the shift summary are conditional, and Notes
  // sits on its own row. Pass the record for edit, or null for a new entry.
  formBody(x) {
    const v = val => (val != null && val !== '') ? val : '';
    const initialShiftId = this.initialShiftIdFor(x);
    const isManual = initialShiftId === '__manual';
    const initialShift = initialShiftId && initialShiftId !== '__manual' ? this.shiftById(initialShiftId) : null;
    const defaultDate = x?.date || initialShift?.date || new Date().toISOString().slice(0, 10);
    const defaultShiftType = x?.shift_type || initialShift?.shift_type || '';

    return '<div class="form-row data-row" style="gap:12px;">'
        + '<div class="f" style="flex:1.5 1 180px;min-width:0;"><label>Shift</label>'
          + '<select id="tl-shift">' + this.shiftOptions(initialShiftId) + '</select></div>'
        + '<div class="f" style="flex:1.2 1 150px;min-width:0;"><label>Staff</label>'
          + '<select id="tl-staff"></select></div>'
        + '<div class="f" style="flex:0.9 1 110px;min-width:0;"><label>Tippable Hours</label>'
          + '<input type="number" id="tl-hours" min="0" step="0.25" value="' + v(x?.hours) + '" placeholder="Auto"/></div>'
        + '<div class="f" style="flex:0.9 1 110px;min-width:0;"><label>Cash Tips</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tl-cash" min="0" step="0.01" value="' + v(x?.cash_tips) + '"/></div></div>'
        + '<div class="f" style="flex:0.9 1 110px;min-width:0;"><label>Card Tips</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tl-card" min="0" step="0.01" value="' + v(x?.card_tips) + '"/></div></div>'
        + '<div class="f" style="flex:0.8 1 100px;min-width:0;"><label>Total</label>'
          + '<div class="f-display" id="tl-c-total">-</div></div>'
      + '</div>'

      // Manual mode reveals date + shift type (a shift pick derives them instead).
      + '<div id="tl-manual-row" class="form-row" style="gap:16px;' + (isManual ? '' : 'display:none;') + '">'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Date</label>'
          + '<input type="date" id="tl-date" value="' + esc(defaultDate) + '"/></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Shift Type</label>'
          + '<select id="tl-shift-type">' + (App.SHIFT_TYPES || []).map(t =>
              '<option value="' + esc(t) + '"' + (defaultShiftType === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></div>'
      + '</div>'

      + '<div id="tl-shift-summary" style="margin-bottom:14px;"></div>'

      + '<div class="form-row" style="gap:16px;margin-bottom:0;"><div class="f" style="width:100%;"><label>Notes</label>'
        + '<textarea id="tl-notes" rows="2" placeholder="Optional">' + esc(x?.notes || '') + '</textarea></div></div>';
  },

  // Wire the form (inline add OR edit page). Uses element-level listeners so they
  // never stack across re-renders. x = the record (null for a new entry).
  wireForm(x) {
    const initialShiftId = this.initialShiftIdFor(x);
    document.getElementById('tl-shift')?.addEventListener('change', e => this.onShiftChange(e.target.value, x));
    document.getElementById('tl-staff')?.addEventListener('change', () => this.onStaffChange(x));
    document.getElementById('tl-cash')?.addEventListener('input', () => this.calc());
    document.getElementById('tl-card')?.addEventListener('input', () => this.calc());
    document.getElementById('tl-save')?.addEventListener('click', () => this.save());
    document.getElementById('tl-cancel')?.addEventListener('click', () => this.renderList());
    this.populateStaffList(initialShiftId, x);
    this.renderShiftSummary(initialShiftId);
    this.calc();
  },

  renderList() {
    this.editId = null;
    this.actions.innerHTML = '';

    if (this.staff().length === 0) {
      App.setupCard(this.container, {
        title: 'Log Your First Tips',
        lead: 'Tips are logged against your roster, by shift and staff member. Add your staff and you can start logging.',
        steps: [
          { title: 'Add your staff', desc: 'Tips are logged against a staff member, so build your roster first.', btn: 'Go to Staff Roster', screen: 'lc-staff-roster', done: false }
        ]
      });
      return;
    }

    const addCard = '<div class="card">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Log Tips</span>'
      + App.helpButton('tl-how') + '</div>'
      + this.formBody(null)
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="tl-save">Save Tips</button>'
      + '<span id="tl-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';

    const all = [...this.tips()].sort((a, b) =>
      new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());
    const filtered = this.applyFilters(all);

    let summaryHtml = '';
    let listHtml;
    if (all.length === 0) {
      listHtml = '<div class="card"><div class="card-title">Logged Tips</div>'
        + '<div style="font-size:13px;color:var(--t3);">No tips logged yet. Log your first entry above. Pick the shift and the rest auto-fills.</div></div>';
    } else {
      const cash = filtered.reduce((t, x) => t + (x.cash_tips || 0), 0);
      const card = filtered.reduce((t, x) => t + (x.card_tips || 0), 0);
      summaryHtml = '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
        + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val">' + filtered.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Cash Tips</div><div class="calc-val">' + App.fmtCurrency(cash) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Card Tips</div><div class="calc-val">' + App.fmtCurrency(card) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Tips</div><div class="calc-val good">' + App.fmtCurrency(cash + card) + '</div></div>'
        + '</div>';
      if (filtered.length === 0) {
        listHtml = '<div class="empty"><div class="empty-title">No tips match the filters</div>'
          + '<div class="empty-sub">Adjust or clear the filters above.</div></div>';
      } else {
        const rows = filtered.slice(0, App.listLimit('lc', 'tip')).map(x => {
          return '<tr class="tl-row" data-id="' + x.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(x.date) + '</div></td>'
          + '<td>' + esc(x.name || '-') + '</td>'
          + '<td>' + esc(x.shift_type || '-') + '</td>'
          + '<td>' + App.fmtCurrency(x.cash_tips || 0) + '</td>'
          + '<td>' + App.fmtCurrency(x.card_tips || 0) + '</td>'
          + '<td class="val">' + App.fmtCurrency(x.total_tips || 0) + '</td>'
          + '<td><div class="row-actions">'
          + (App.canEdit('lc-tip-log') ? '<button class="btn btn-ghost btn-sm tl-edit" data-id="' + x.id + '">Edit</button>' : '')
          + (App.canEdit('lc-tip-log') ? '<button class="btn btn-danger btn-sm tl-del" data-id="' + x.id + '">Delete</button>' : '')
          + '</div></td></tr>';
        }).join('');
        listHtml = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
          + '<th>Date</th><th>Staff</th><th>Shift</th><th>Cash</th><th>Card</th><th>Total</th><th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          + App.showOlderBar('lc', 'tip', filtered, !!(this.filterFrom || this.filterTo || this.filterStaff));
      }
    }

    this.container.innerHTML = '<div class="screen">' + addCard + this.filterCard(summaryHtml) + listHtml + '</div>';
    this.wireForm(null);
    this.wireList();
  },

  filterCard(summaryHtml) {
    const staffOpts = '<option value="">All staff</option>'
      + this.staff().slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          .map(s => '<option value="' + s.id + '"' + (this.filterStaff === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
    return '<div class="card no-print"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Filter</span>'
      + '<div style="display:flex;gap:8px;">'
        + '<button class="btn btn-ghost btn-sm" id="tl-export">Export PDF</button>'
        + '<button class="btn btn-ghost btn-sm" id="tl-print-blank">Worksheet</button>'
      + '</div></div>'
      + '<div class="form-row" style="gap:14px;margin-bottom:0;flex-wrap:wrap;">'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="tl-f-from" value="' + esc(this.filterFrom) + '"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="tl-f-to" value="' + esc(this.filterTo) + '"/></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Staff</label><select id="tl-f-staff">' + staffOpts + '</select></div>'
        + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="tl-f-clear" style="margin-bottom:2px;">Clear</button></div>'
      + '</div>'
      + (summaryHtml || '')
      + '</div>';
  },

  applyFilters(list) {
    return list.filter(t => {
      const date = t.date || '';
      if (this.filterFrom && date < this.filterFrom) return false;
      if (this.filterTo && date > this.filterTo) return false;
      if (this.filterStaff && (t.staff_id || '') !== this.filterStaff) return false;
      return true;
    });
  },

  wireList() {
    this.container.onclick = ev => {
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row = ev.target.closest('.tl-row');
      const edit = ev.target.closest('.tl-edit');
      const del = ev.target.closest('.tl-del');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (edit)      { ev.stopPropagation(); this.showForm(edit.dataset.id); return; }
      if (row && App.canEdit('lc-tip-log')) this.showForm(row.dataset.id);
    };
    document.getElementById('tl-how')?.addEventListener('click', () => this.showHowTo());
    document.getElementById('tl-export')?.addEventListener('click', () => App.exportPDF({ title: 'Tip Log', root: this.container }));
    document.getElementById('tl-print-blank')?.addEventListener('click', () => this.printBlank());
    document.getElementById('tl-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('tl-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });
    document.getElementById('tl-f-staff')?.addEventListener('change', e => { this.filterStaff = e.target.value || ''; this.renderList(); });
    document.getElementById('tl-f-clear')?.addEventListener('click', () => {
      this.filterFrom = this.filterTo = this.filterStaff = '';
      this.renderList();
    });
  },

  // ── Edit page (same form, minus How it works) ──────────────────────────────
  showForm(id) {
    if (id && !App.canEdit('lc-tip-log')) return;
    this.editId = id || null;
    const x = id ? this.tips().find(t => t.id === id) : null;

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">Edit Tips</div>'
      + this.formBody(x)
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="tl-save">Update</button>'
        + '<button class="btn btn-ghost" id="tl-cancel">Cancel</button>'
        + '<span id="tl-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    this.wireForm(x);
  },

  // When the shift dropdown changes — reveal/hide manual fields, refresh staff
  // list + shift summary, auto-fill hours if staff already picked.
  onShiftChange(shiftId, existingRec) {
    const manualRow = document.getElementById('tl-manual-row');
    if (shiftId === '__manual') {
      if (manualRow) manualRow.style.display = '';
    } else {
      if (manualRow) manualRow.style.display = 'none';
      const s = this.shiftById(shiftId);
      if (s) {
        const dateInp = document.getElementById('tl-date');
        if (dateInp) dateInp.value = s.date || dateInp.value;
        const stInp = document.getElementById('tl-shift-type');
        if (stInp && s.shift_type) stInp.value = s.shift_type;
      }
    }
    this.populateStaffList(shiftId, existingRec);
    this.renderShiftSummary(shiftId);
    this.onStaffChange(existingRec);
  },

  // Populate staff dropdown. When a shift is picked, default to that shift's
  // logged staff first (an optgroup), then the rest of the roster.
  populateStaffList(shiftId, existingRec) {
    const sel = document.getElementById('tl-staff');
    if (!sel) return;
    const shift = shiftId && shiftId !== '__manual' ? this.shiftById(shiftId) : null;
    const shiftDate = shift?.date || document.getElementById('tl-date')?.value || '';
    const shiftStaffIds = new Set();
    if (shift && shiftDate) {
      this.actuals().filter(a => a.date === shiftDate).forEach(a => { if (a.staff_id) shiftStaffIds.add(a.staff_id); });
    }
    const selectedId = existingRec?.staff_id || sel.value || '';
    const all = this.staff().filter(s => s.status !== 'Inactive' || s.id === selectedId);
    const onShift = all.filter(s => shiftStaffIds.has(s.id));
    const offShift = all.filter(s => !shiftStaffIds.has(s.id));
    let h = '<option value="">Select staff...</option>';
    if (onShift.length) {
      h += '<optgroup label="Worked This Shift">';
      onShift.forEach(s => { h += '<option value="' + s.id + '"' + (s.id === selectedId ? ' selected' : '') + '>' + esc(s.name) + '</option>'; });
      h += '</optgroup>';
    }
    if (offShift.length) {
      h += '<optgroup label="' + (onShift.length ? 'Other Staff' : 'Roster') + '">';
      offShift.forEach(s => { h += '<option value="' + s.id + '"' + (s.id === selectedId ? ' selected' : '') + '>' + esc(s.name) + '</option>'; });
      h += '</optgroup>';
    }
    sel.innerHTML = h;
  },

  // When staff dropdown changes — auto-fill hours from lc_actuals for this
  // staff member + shift date. Operator can still override.
  onStaffChange(existingRec) {
    const staffId = document.getElementById('tl-staff')?.value || '';
    const date = document.getElementById('tl-date')?.value || '';
    const hoursInp = document.getElementById('tl-hours');
    if (!hoursInp) return;
    if (existingRec && hoursInp.value && parseFloat(hoursInp.value) > 0) return;
    const hrs = App.hoursFor(staffId, date);
    if (hrs != null && hrs > 0) hoursInp.value = hrs;
  },

  renderShiftSummary(shiftId) {
    const box = document.getElementById('tl-shift-summary');
    if (!box) return;
    if (!shiftId || shiftId === '__manual') { box.innerHTML = ''; return; }
    const s = this.shiftById(shiftId);
    if (!s) { box.innerHTML = ''; return; }
    const dateLabel = s.date ? new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : '-';
    const managerName = s.manager_id ? ((this.staffById(s.manager_id) || {}).name || '') : '';
    box.innerHTML = '<div style="font-size:11px;color:var(--t3);padding:10px 14px;background:rgba(218,171,70,0.06);border:1px solid rgba(218,171,70,0.25);border-radius:4px;line-height:1.6;">'
      + '<div style="font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:1px;font-size:9px;margin-bottom:4px;">Shift</div>'
      + esc(dateLabel) + (s.shift_type ? ' &middot; ' + esc(s.shift_type) : '')
      + (managerName ? ' &middot; ' + esc(managerName) : '')
      + (s.status === 'Open' ? ' <span style="color:var(--gold);font-weight:700;">(open)</span>' : '')
      + '</div>';
  },

  calc() {
    const num = id => parseFloat(document.getElementById(id)?.value) || 0;
    const total = num('tl-cash') + num('tl-card');
    const el = document.getElementById('tl-c-total');
    if (el) el.textContent = App.fmtCurrency(total);
  },

  async save() {
    const err = document.getElementById('tl-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const shiftPick = document.getElementById('tl-shift')?.value || '';
    if (!shiftPick) { fail('Pick a shift or choose Manual entry.'); return; }

    let date, shiftType, shiftId = '', managerId = '';
    if (shiftPick === '__manual') {
      date      = document.getElementById('tl-date')?.value;
      shiftType = document.getElementById('tl-shift-type')?.value || '';
      if (!date) { fail('Date is required for manual entry.'); return; }
      managerId = App.activeManagerId ? App.activeManagerId() : '';
    } else {
      const s = this.shiftById(shiftPick);
      if (!s) { fail('Shift not found.'); return; }
      shiftId   = s.id;
      date      = s.date || new Date().toISOString().slice(0, 10);
      shiftType = s.shift_type || '';
      managerId = s.manager_id || '';
    }

    const staff = this.staffById(document.getElementById('tl-staff')?.value);
    if (!staff) { fail('Choose a staff member.'); return; }
    const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };
    const cash = num('tl-cash') || 0, card = num('tl-card') || 0;
    if (cash + card <= 0) { fail('Enter cash or card tips.'); return; }

    const rec = {
      id:          this.editId || App.uid(),
      shift_id:    shiftId,
      manager_id:  managerId,
      date,
      staff_id:    staff.id,
      name:        staff.name,
      position_id: staff.position_id || '',
      shift_type:  shiftType,
      cash_tips:   cash,
      card_tips:   card,
      total_tips:  cash + card,
      hours:       num('tl-hours'),
      notes:       document.getElementById('tl-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.tips();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(t => t.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('tl-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('lc', 'tip', saved);
    this.editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Tips'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const ok = await App.confirm({ title: 'Delete this tip entry?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;
    await App.removeRecord('lc', 'tip', id);
    this.renderList();
  },

  // Paper-at-close workflow. Managers tally cash + card tips per server on a
  // printed sheet during the shift, then enter into Bar Cop after close.
  printBlank() {
    App.printBlankSheet({
      title: 'Tip Sheet',
      subtitle: 'Tally tips per server during the shift. Manager enters each row into Bar Cop after close.',
      columns: [
        { label: 'Server Name', width: '28%' },
        { label: 'Cash Tips',   width: '14%' },
        { label: 'Card Tips',   width: '14%' },
        { label: 'Total',       width: '12%' },
        { label: 'Hours',       width: '12%' },
        { label: 'Notes',       width: '20%' }
      ],
      rows: 14
    });
  }
};
