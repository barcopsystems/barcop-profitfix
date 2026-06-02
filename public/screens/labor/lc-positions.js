'use strict';

/* ── Labor Control — Positions (writes lc_positions) ──────────────────────────
   The job positions used to build schedules and log hours. Each position has a
   department, a default hourly wage, and whether it is tipped. Stored in
   App.laborData (lc_data table, Rule 21) — saved via App.saveLabor(). */

S.LaborPositions = {
  editId: null,
  _pendingDelId: null,
  DEPARTMENTS: ['Bar', 'Front of House', 'Kitchen', 'Management', 'Other'],

  positions() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_positions)) App.laborData.lc_positions = [];
    return App.laborData.lc_positions;
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary btn-sm';
    addBtn.textContent = 'Add Position';
    addBtn.addEventListener('click', () => this.showForm());
    actions.appendChild(addBtn);
    this.renderList();
  },

  renderList() {
    const list = [...this.positions()].sort((a, b) => {
      const da = this.DEPARTMENTS.indexOf(a.department), db = this.DEPARTMENTS.indexOf(b.department);
      if (da !== db) return (da < 0 ? 99 : da) - (db < 0 ? 99 : db);
      return (a.name || '').localeCompare(b.name || '');
    });

    let html;
    if (list.length === 0) {
      html = '<div class="empty"><div class="empty-title">No positions yet</div>'
        + '<div class="empty-sub">Add the job positions you schedule: bartender, server, line cook, '
        + 'and so on. Positions drive scheduling, hours, and labor cost.</div>'
        + '<button class="btn btn-primary" id="lp-add-first">Add Position</button></div>';
    } else {
      const tipped = list.filter(p => p.tipped).length;
      const summary = '<div class="calc" style="margin-bottom:16px;">'
        + '<div class="calc-item"><div class="calc-label">Positions</div><div class="calc-val">' + list.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Tipped</div><div class="calc-val">' + tipped + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Non-Tipped</div><div class="calc-val">' + (list.length - tipped) + '</div></div>'
        + '</div>';
      const rows = list.map(p => '<tr class="lp-row" data-id="' + p.id + '" style="cursor:pointer;">'
        + '<td><div class="val">' + esc(p.name || '-') + '</div></td>'
        + '<td>' + esc(p.department || '-') + '</td>'
        + '<td class="val">' + (p.default_wage != null ? App.fmtCurrency(p.default_wage) + '/hr' : '-') + '</td>'
        + '<td>' + (p.tipped
            ? '<span style="color:var(--gold);font-weight:700;">Tipped</span>'
            : '<span style="color:var(--t3);font-weight:700;">Non-Tipped</span>') + '</td>'
        + '<td><div class="row-actions">'
        + '<button class="btn btn-ghost btn-sm lp-edit" data-id="' + p.id + '">Edit</button>'
        + '<button class="btn btn-danger btn-sm lp-del" data-id="' + p.id + '">Delete</button>'
        + '</div></td></tr>').join('');
      html = summary + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Position</th><th>Department</th><th>Default Wage</th><th>Type</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    const modal = '<div id="lp-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this position?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="lp-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="lp-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      const row = ev.target.closest('.lp-row');
      const edit = ev.target.closest('.lp-edit');
      const del = ev.target.closest('.lp-del');
      const addF = ev.target.closest('#lp-add-first');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row)  this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
  },

  showForm(id) {
    this.editId = id || null;
    const p = id ? this.positions().find(x => x.id === id) : null;
    const deptOpts = this.DEPARTMENTS.map(d =>
      '<option' + ((p ? p.department : 'Bar') === d ? ' selected' : '') + '>' + d + '</option>').join('');
    const tippedSel = t => '<option value="yes"' + (t ? ' selected' : '') + '>Tipped</option>'
      + '<option value="no"' + (!t ? ' selected' : '') + '>Non-Tipped</option>';
    const v = val => (val != null && val !== '') ? val : '';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (id ? 'Edit' : 'Add') + ' Position</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Position Name</label>'
      + '<input type="text" id="lp-name" value="' + esc(p?.name || '') + '" placeholder="e.g. Bartender"/></div>'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Department</label>'
      + '<select id="lp-dept">' + deptOpts + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:140px;flex-shrink:0;"><label>Default Wage</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="lp-wage" min="0" step="0.01" '
      + 'value="' + v(p?.default_wage) + '" placeholder="0.00"/></div></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Type</label>'
      + '<select id="lp-tipped">' + tippedSel(p ? p.tipped : false) + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="lp-notes" rows="2" placeholder="Optional">' + esc(p?.notes || '') + '</textarea></div></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="lp-save">' + (id ? 'Update' : 'Save Position') + '</button>'
      + '<button class="btn btn-ghost" id="lp-cancel">Cancel</button>'
      + '<span id="lp-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('lp-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('lp-save')?.addEventListener('click', () => this.save());
  },

  async save() {
    const err = document.getElementById('lp-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const name = document.getElementById('lp-name')?.value.trim();
    if (!name) { fail('Position name is required.'); return; }
    const wage = parseFloat(document.getElementById('lp-wage')?.value);

    const rec = {
      id:           this.editId || App.uid(),
      name,
      department:   document.getElementById('lp-dept')?.value || 'Other',
      default_wage: isNaN(wage) ? null : wage,
      tipped:       document.getElementById('lp-tipped')?.value === 'yes',
      notes:        document.getElementById('lp-notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.positions();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('lp-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveLabor();
    this.editId = null;
    if (ok) {
      App.markSetupDone('gs_lc_positions');
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Position'; }
      fail('Save failed. Try again.');
    }
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('lp-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('lp-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('lp-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.laborData.lc_positions = this.positions().filter(x => x.id !== delId);
      await App.saveLabor();
      this.renderList();
    };
  }
};
