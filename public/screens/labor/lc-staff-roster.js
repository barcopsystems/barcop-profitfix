'use strict';

/* ── Labor Control — Staff Roster (writes lc_staff) ───────────────────────────
   The team roster — each staff member, their position, wage, and status. Wage
   defaults from the position but is editable per person. The roster is the
   source for scheduling, hours, tips, and (per Rule 20) Revenue Recovery's
   server list. Stored in App.laborData (lc_data, Rule 21). */

S.LaborStaffRoster = {
  editId: null,
  _pendingDelId: null,

  staff() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_staff)) App.laborData.lc_staff = [];
    return App.laborData.lc_staff;
  },
  positions() {
    return ((App.laborData && App.laborData.lc_positions) || []);
  },
  positionById(id) {
    return this.positions().find(p => p.id === id);
  },
  fmtDate(str) {
    if (!str) return '—';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  renderList() {
    this.actions.innerHTML = '';
    if (this.positions().length > 0) {
      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn-primary btn-sm';
      addBtn.textContent = 'Add Staff';
      addBtn.addEventListener('click', () => this.showForm());
      this.actions.appendChild(addBtn);
    }

    if (this.positions().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Add positions first</div>'
        + '<div class="empty-sub">Each staff member is assigned a position. Set up your positions, then '
        + 'build the roster.</div>'
        + '<button class="btn btn-primary" id="sr-go-positions">Go to Positions</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#sr-go-positions')) App.navigate('lc-positions'); };
      return;
    }

    const list = [...this.staff()].sort((a, b) => {
      if ((a.status === 'Inactive') !== (b.status === 'Inactive')) return a.status === 'Inactive' ? 1 : -1;
      return (a.name || '').localeCompare(b.name || '');
    });

    let html;
    if (list.length === 0) {
      html = '<div class="empty"><div class="empty-title">No staff yet</div>'
        + '<div class="empty-sub">Add your team members and assign each a position. The roster feeds '
        + 'scheduling, hours, tips, and the Revenue Recovery server list.</div>'
        + '<button class="btn btn-primary" id="sr-add-first">Add Staff</button></div>';
    } else {
      const active = list.filter(s => s.status !== 'Inactive').length;
      const summary = '<div class="calc" style="margin-bottom:16px;">'
        + '<div class="calc-item"><div class="calc-label">Staff</div><div class="calc-val">' + list.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Active</div><div class="calc-val">' + active + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Inactive</div><div class="calc-val">' + (list.length - active) + '</div></div>'
        + '</div>';
      const rows = list.map(s => {
        const pos = this.positionById(s.position_id);
        return '<tr class="sr-row" data-id="' + s.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + esc(s.name || '—') + '</div></td>'
          + '<td>' + esc(pos ? pos.name : '—') + '</td>'
          + '<td>' + esc(pos ? (pos.department || '—') : '—') + '</td>'
          + '<td class="val">' + (s.wage != null ? App.fmtCurrency(s.wage) + '/hr' : '—') + '</td>'
          + '<td>' + (s.status === 'Inactive'
              ? '<span class="badge badge-dim">Inactive</span>'
              : '<span class="badge badge-ok">Active</span>') + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm sr-edit" data-id="' + s.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm sr-del" data-id="' + s.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Name</th><th>Position</th><th>Department</th><th>Wage</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="sr-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this staff member?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="sr-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="sr-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      const row = ev.target.closest('.sr-row');
      const edit = ev.target.closest('.sr-edit');
      const del = ev.target.closest('.sr-del');
      const addF = ev.target.closest('#sr-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row)  this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
  },

  showForm(id) {
    this.editId = id || null;
    const s = id ? this.staff().find(x => x.id === id) : null;
    const positions = this.positions();
    const posOpts = positions.map(p =>
      '<option value="' + p.id + '"' + (s && s.position_id === p.id ? ' selected' : '') + '>'
      + esc(p.name) + ' — ' + esc(p.department || '') + '</option>').join('');
    const defaultPos = s ? this.positionById(s.position_id) : positions[0];
    const v = val => (val != null && val !== '') ? val : '';
    const wage = s ? s.wage : (defaultPos ? defaultPos.default_wage : null);

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'Add') + ' Staff Member</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Name</label>'
      + '<input type="text" id="sr-name" value="' + esc(s?.name || '') + '" placeholder="Full name"/></div>'
      + '<div class="f" style="width:230px;flex-shrink:0;"><label>Position</label>'
      + '<select id="sr-pos">' + posOpts + '</select></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Wage</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="sr-wage" min="0" step="0.01" '
      + 'value="' + v(wage) + '" placeholder="0.00"/></div></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Status</label><select id="sr-status">'
      + '<option' + (!s || s.status !== 'Inactive' ? ' selected' : '') + '>Active</option>'
      + '<option' + (s && s.status === 'Inactive' ? ' selected' : '') + '>Inactive</option>'
      + '</select></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Hire Date</label>'
      + '<input type="date" id="sr-hire" value="' + esc(s?.hire_date || '') + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Phone</label>'
      + '<input type="text" id="sr-phone" value="' + esc(s?.phone || '') + '" placeholder="Optional"/></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Email</label>'
      + '<input type="text" id="sr-email" value="' + esc(s?.email || '') + '" placeholder="Optional"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="sr-notes" rows="2" placeholder="Optional">' + esc(s?.notes || '') + '</textarea></div></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="sr-save">' + (id ? 'Update' : 'Save Staff') + '</button>'
      + '<button class="btn btn-ghost" id="sr-cancel">Cancel</button>'
      + '<span id="sr-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    // Changing position resets wage to that position's default
    document.getElementById('sr-pos')?.addEventListener('change', e => {
      const p = this.positionById(e.target.value);
      const wEl = document.getElementById('sr-wage');
      if (p && wEl) wEl.value = p.default_wage != null ? p.default_wage : '';
    });
    document.getElementById('sr-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('sr-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const err = document.getElementById('sr-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const name = document.getElementById('sr-name')?.value.trim();
    if (!name) { fail('Name is required.'); return; }
    const posId = document.getElementById('sr-pos')?.value;
    if (!posId) { fail('Choose a position.'); return; }
    const wage = parseFloat(document.getElementById('sr-wage')?.value);

    const rec = {
      id:          this.editId || App.uid(),
      name,
      position_id: posId,
      wage:        isNaN(wage) ? null : wage,
      status:      document.getElementById('sr-status')?.value || 'Active',
      hire_date:   document.getElementById('sr-hire')?.value || '',
      phone:       document.getElementById('sr-phone')?.value.trim() || '',
      email:       document.getElementById('sr-email')?.value.trim() || '',
      notes:       document.getElementById('sr-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.staff();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('sr-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveLabor();
    this.editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Staff'; }
      fail('Save failed. Try again.');
    }
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('sr-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('sr-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('sr-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.laborData.lc_staff = this.staff().filter(x => x.id !== delId);
      await App.saveLabor();
      this.renderList();
    };
  }
};
