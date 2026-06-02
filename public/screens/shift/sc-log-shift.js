'use strict';

/* ── Shift Control — Log a Shift (writes sc_shifts) ───────────────────────────
   Records a shift: type, manager, revenue, covers, cash. Shift revenue is the
   single source of weekly revenue for Profit and Revenue Recovery; covers feed
   check average. Stored in App.shiftData (sc_data table, Rule 21). */

S.ShiftLogShift = {
  editId: null,
  _pendingDelId: null,
  // SHIFT_TYPES kept as a backward-compat alias to App.SHIFT_TYPES. The
  // canonical list lives on App.SHIFT_TYPES now; consumers should read from
  // there. Old call sites that hit S.ShiftLogShift.SHIFT_TYPES still work.
  get SHIFT_TYPES() { return App.SHIFT_TYPES; },

  shifts() {
    if (!App.shiftData) App.shiftData = {};
    if (!Array.isArray(App.shiftData.sc_shifts)) App.shiftData.sc_shifts = [];
    return App.shiftData.sc_shifts;
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = 'Log a Shift';
    addBtn.addEventListener('click', () => this.showForm());
    actions.appendChild(addBtn);
    this.renderList();
  },

  renderList() {
    const shifts = [...this.shifts()].sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());

    let html;
    if (shifts.length === 0) {
      html = '<div class="empty"><div class="empty-title">No shifts logged yet</div>'
        + '<div class="empty-sub">Log each shift\'s revenue, covers, and cash. Shift revenue is what '
        + 'feeds your weekly Profit and Revenue numbers automatically.</div>'
        + '<button class="btn btn-primary" id="ls-add-first">Log a Shift</button></div>';
    } else {
      const rows = shifts.map(s => '<tr class="ls-row" data-id="' + s.id + '" style="cursor:pointer;">'
        + '<td><div class="val">' + this.fmtDate(s.date) + '</div></td>'
        + '<td>' + esc(s.shift_type || '-') + '</td>'
        + '<td>' + esc(s.manager || '-') + '</td>'
        + '<td class="val">' + App.fmtCurrency(s.total_revenue || 0) + '</td>'
        + '<td>' + (s.covers != null ? s.covers : '-') + '</td>'
        + '<td>' + (s.status === 'Open'
            ? '<span class="badge badge-ok">Open</span>'
            : '<span class="badge badge-dim">Closed</span>') + '</td>'
        + '<td><div class="row-actions">'
        + (App.canEdit('sc-log-shift') ? '<button class="btn btn-ghost btn-sm ls-edit" data-id="' + s.id + '">Edit</button>' : '')
        + (App.canEdit('sc-log-shift') ? '<button class="btn btn-danger btn-sm ls-del" data-id="' + s.id + '">Delete</button>' : '')
        + '</div></td></tr>').join('');
      html = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Shift</th><th>Manager</th><th>Revenue</th><th>Covers</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="ls-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this shift?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="ls-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="ls-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      const row = ev.target.closest('.ls-row');
      const edit = ev.target.closest('.ls-edit');
      const del = ev.target.closest('.ls-del');
      const addF = ev.target.closest('#ls-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row && App.canEdit('sc-log-shift')) this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
  },

  showForm(id) {
    if (id && !App.canEdit('sc-log-shift')) return;
    this.editId = id || null;
    const s = id ? this.shifts().find(x => x.id === id) : null;
    const typeOpts = this.SHIFT_TYPES.map(t => '<option' + (s && s.shift_type === t ? ' selected' : '') + '>' + t + '</option>').join('');
    const v = val => (val != null && val !== '') ? val : '';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'Log a') + ' Shift</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="ls-date" value="' + esc(s?.date || new Date().toISOString().slice(0, 10)) + '"/></div>'
      + '<div class="f w-md"><label>Shift Type</label><select id="ls-type">' + typeOpts + '</select></div>'
      + '<div class="f w-md"><label>Manager on Duty</label><select id="ls-mgr">' + App.staffOptions(s?.manager_id || s?.manager, { placeholder: 'Select staff...' }) + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Bar Revenue</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ls-bar" value="' + v(s?.bar_revenue) + '" step="0.01" oninput="S.ShiftLogShift.calc()"/></div></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Floor Revenue</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ls-floor" value="' + v(s?.floor_revenue) + '" step="0.01" oninput="S.ShiftLogShift.calc()"/></div></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Covers</label>'
      + '<input type="number" id="ls-covers" value="' + v(s?.covers) + '" min="0" oninput="S.ShiftLogShift.calc()"/></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Walkouts</label>'
      + '<input type="number" id="ls-walkouts" value="' + v(s?.walkouts) + '" min="0" placeholder="0"/></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Opening Bank</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ls-bank" value="' + v(s?.opening_bank || (() => { const firstDrawer = ((App.shiftData && App.shiftData.sc_drawers) || []).find(d => d.active !== false); return firstDrawer && firstDrawer.default_opening_bank != null ? firstDrawer.default_opening_bank : ''; })()) + '" step="0.01"/></div></div>'
      + '<div class="f" style="width:120px;flex-shrink:0;"><label>Staff on Floor</label>'
      + '<input type="number" id="ls-staff" value="' + v(s?.staff_on_floor) + '" min="0"/></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Status</label><select id="ls-status">'
      + '<option' + (s && s.status === 'Open' ? ' selected' : '') + '>Open</option>'
      + '<option' + (!s || s.status !== 'Open' ? ' selected' : '') + '>Closed</option>'
      + '</select></div>'
      + '</div>'

      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="ls-notes" rows="2" placeholder="Optional">' + esc(s?.notes || '') + '</textarea></div></div>'

      + '<div class="calc" style="margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val" id="ls-total">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Check Average</div><div class="calc-val" id="ls-checkavg">-</div></div>'
      + '</div>'

      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="ls-save">' + (id ? 'Update' : 'Save Shift') + '</button>'
      + '<button class="btn btn-ghost" id="ls-cancel">Cancel</button>'
      + '<span id="ls-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('ls-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('ls-save')?.addEventListener('click', () => this.save());
    this.calc();
  },

  calc() {
    const num = id => parseFloat(document.getElementById(id)?.value) || 0;
    const total = num('ls-bar') + num('ls-floor');
    const covers = num('ls-covers');
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('ls-total', App.fmtCurrency(total));
    set('ls-checkavg', covers > 0 ? App.fmtCurrency(total / covers) : '-');
  },

  async save() {
    const err = document.getElementById('ls-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('ls-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };
    const bar = num('ls-bar') || 0, floor = num('ls-floor') || 0;

    const rec = {
      id:             this.editId || App.uid(),
      date,
      shift_type:     document.getElementById('ls-type')?.value || '',
      manager_id:     document.getElementById('ls-mgr')?.value || '',
      manager:        (App.staffById(document.getElementById('ls-mgr')?.value) || {}).name || '',
      bar_revenue:    bar,
      floor_revenue:  floor,
      total_revenue:  bar + floor,
      covers:         num('ls-covers'),
      walkouts:       num('ls-walkouts'),
      opening_bank:   num('ls-bank'),
      staff_on_floor: num('ls-staff'),
      status:         document.getElementById('ls-status')?.value || 'Closed',
      notes:          document.getElementById('ls-notes')?.value.trim() || ''
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

    const btn = document.getElementById('ls-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('sc', 'shift', saved);
    this.editId = null;
    if (ok) {
      App.markSetupDone('gs_sc_shift');
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Shift'; }
      fail('Save failed. Try again.');
    }
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('ls-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('ls-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('ls-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      await App.removeRecord('sc', 'shift', delId);
      this.renderList();
    };
  }
};
