'use strict';

/* ── Labor Control — Tip Log (writes lc_tips) ─────────────────────────────────
   Records tips by shift and staff member — cash and card, totalled. The log
   feeds Tip History and is the raw input the Tip Pool Calculator distributes. */

S.LaborTipLog = {
  editId: null,
  _pendingDelId: null,
  get SHIFTS() { return ['', ...(App.SHIFT_TYPES || [])]; },

  tips() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_tips)) App.laborData.lc_tips = [];
    return App.laborData.lc_tips;
  },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
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

  renderList() {
    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="tl-export">Export PDF</button>';
    document.getElementById('tl-export')?.addEventListener('click', () => window.print());
    if (this.staff().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Add staff first</div>'
        + '<div class="empty-sub">Tips are logged against your roster. Add staff in Staff Roster, then '
        + 'log tips here.</div>'
        + '<button class="btn btn-primary" id="tl-go-roster">Go to Staff Roster</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#tl-go-roster')) App.navigate('lc-staff-roster'); };
      return;
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = 'Log Tips';
    addBtn.addEventListener('click', () => this.showForm());
    this.actions.appendChild(addBtn);

    const list = [...this.tips()].sort((a, b) =>
      new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());

    let html;
    if (list.length === 0) {
      html = '<div class="empty"><div class="empty-title">No tips logged yet</div>'
        + '<div class="empty-sub">Log cash and card tips by shift. The Tip Pool Calculator uses these '
        + 'entries to split a pool across the team.</div>'
        + '<button class="btn btn-primary" id="tl-add-first">Log Tips</button></div>';
    } else {
      const cash = list.reduce((t, x) => t + (x.cash_tips || 0), 0);
      const card = list.reduce((t, x) => t + (x.card_tips || 0), 0);
      const summary = '<div class="calc" style="margin-bottom:16px;">'
        + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val">' + list.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Cash Tips</div><div class="calc-val">' + App.fmtCurrency(cash) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Card Tips</div><div class="calc-val">' + App.fmtCurrency(card) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Tips</div><div class="calc-val good">' + App.fmtCurrency(cash + card) + '</div></div>'
        + '</div>';
      const rows = list.slice(0, 100).map(x => '<tr class="tl-row" data-id="' + x.id + '" style="cursor:pointer;">'
        + '<td><div class="val">' + this.fmtDate(x.date) + '</div></td>'
        + '<td>' + esc(x.name || '-') + '</td>'
        + '<td>' + esc(x.shift_type || '-') + '</td>'
        + '<td>' + App.fmtCurrency(x.cash_tips || 0) + '</td>'
        + '<td>' + App.fmtCurrency(x.card_tips || 0) + '</td>'
        + '<td class="val">' + App.fmtCurrency(x.total_tips || 0) + '</td>'
        + '<td><div class="row-actions">'
        + (App.canEdit('lc-tip-log') ? '<button class="btn btn-ghost btn-sm tl-edit" data-id="' + x.id + '">Edit</button>' : '')
        + (App.canEdit('lc-tip-log') ? '<button class="btn btn-danger btn-sm tl-del" data-id="' + x.id + '">Delete</button>' : '')
        + '</div></td></tr>').join('');
      html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Staff</th><th>Shift</th><th>Cash</th><th>Card</th><th>Total</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="tl-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this tip entry?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="tl-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="tl-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      const row = ev.target.closest('.tl-row');
      const edit = ev.target.closest('.tl-edit');
      const del = ev.target.closest('.tl-del');
      const addF = ev.target.closest('#tl-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row && App.canEdit('lc-tip-log')) this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
  },

  showForm(id) {
    if (id && !App.canEdit('lc-tip-log')) return;
    this.editId = id || null;
    const x = id ? this.tips().find(t => t.id === id) : null;
    const staffOpts = '<option value="">Select staff...</option>'
      + this.staff().filter(s => s.status !== 'Inactive' || (x && x.staff_id === s.id)).map(s =>
          '<option value="' + s.id + '"' + (x && x.staff_id === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
    const shiftOpts = this.SHIFTS.map(s =>
      '<option value="' + s + '"' + (x && x.shift_type === s ? ' selected' : '') + '>' + (s || '-') + '</option>').join('');
    const v = val => (val != null && val !== '') ? val : '';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'Log') + ' Tips</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Date</label>'
      + '<input type="date" id="tl-date" value="' + esc(x?.date || new Date().toISOString().slice(0, 10)) + '"/></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Staff</label>'
      + '<select id="tl-staff">' + staffOpts + '</select></div>'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Shift</label>'
      + '<select id="tl-shift">' + shiftOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Cash Tips</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tl-cash" min="0" step="0.01" '
      + 'value="' + v(x?.cash_tips) + '" oninput="S.LaborTipLog.calc()"/></div></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Card Tips</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tl-card" min="0" step="0.01" '
      + 'value="' + v(x?.card_tips) + '" oninput="S.LaborTipLog.calc()"/></div></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Tippable Hours</label>'
      + '<input type="number" id="tl-hours" min="0" step="0.25" value="' + v(x?.hours) + '" placeholder="Optional"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="tl-notes" rows="2" placeholder="Optional">' + esc(x?.notes || '') + '</textarea></div></div>'
      + '<div class="calc" style="margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Total Tips</div><div class="calc-val good" id="tl-c-total">-</div></div>'
      + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="tl-save">' + (id ? 'Update' : 'Save Tips') + '</button>'
      + '<button class="btn btn-ghost" id="tl-cancel">Cancel</button>'
      + '<span id="tl-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('tl-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('tl-save')?.addEventListener('click', () => this.save());
    this.calc();
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
    const date = document.getElementById('tl-date')?.value;
    if (!date) { fail('Date is required.'); return; }
    const staff = this.staffById(document.getElementById('tl-staff')?.value);
    if (!staff) { fail('Choose a staff member.'); return; }
    const num = id => { const n = parseFloat(document.getElementById(id)?.value); return isNaN(n) ? null : n; };
    const cash = num('tl-cash') || 0, card = num('tl-card') || 0;
    if (cash + card <= 0) { fail('Enter cash or card tips.'); return; }

    const rec = {
      id:          this.editId || App.uid(),
      date,
      staff_id:    staff.id,
      name:        staff.name,
      position_id: staff.position_id || '',
      shift_type:  document.getElementById('tl-shift')?.value || '',
      cash_tips:   cash,
      card_tips:   card,
      total_tips:  cash + card,
      hours:       num('tl-hours'),
      notes:       document.getElementById('tl-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.tips();
    if (this.editId) {
      const i = list.findIndex(t => t.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('tl-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveLabor();
    this.editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Tips'; }
      fail('Save failed. Try again.');
    }
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('tl-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('tl-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('tl-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.laborData.lc_tips = this.tips().filter(t => t.id !== delId);
      await App.saveLabor();
      this.renderList();
    };
  }
};
