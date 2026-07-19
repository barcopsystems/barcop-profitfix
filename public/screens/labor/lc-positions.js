'use strict';

/* ── Labor Control — Positions (writes lc_positions) ──────────────────────────
   The job positions used to build schedules and log hours. Each position has a
   department, a default hourly wage, and whether it is tipped. Stored in
   App.laborData (lc_data table, Rule 21) — saved via App.saveLabor(). Inline add
   form on the landing; editing a row opens it in a focused pop-up. */

S.LaborPositions = {
  editId: null,
  _draft: null,            // in-memory inline-add draft (survives filter/leave-return)
  DEPARTMENTS: ['Bar', 'Front of House', 'Kitchen', 'Management', 'Other'],

  positions() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_positions)) App.laborData.lc_positions = [];
    return App.laborData.lc_positions;
  },

  // ── Starter positions ───────────────────────────────────────────────────────
  // A fresh account should not land on an empty page that also blocks the roster
  // and the schedule builder. Seed the roles every bar and kitchen runs so the
  // operator can staff up on day one, then edit the wage, tip-out, or names to
  // fit the house. Wage is left blank on purpose (the operator sets their own
  // number) and tip-out defaults to zero (their policy to set). Fires once per
  // account (flagged), so a deleted starter never comes back and an account that
  // already has positions (the demo, or a returning user) is left untouched.
  // Tipped roles start Tipped with no tip-out set (percent 0 = receives). The
  // operator decides who pays tip out, at what percent, and on what basis (a
  // percent of sales or a percent of tips), because that policy is theirs to set.
  STARTER_POSITIONS: [
    { name: 'Bartender',        department: 'Bar',            tipped: true  },
    { name: 'Barback',          department: 'Bar',            tipped: true  },
    { name: 'Server',           department: 'Front of House', tipped: true  },
    { name: 'Busser',           department: 'Front of House', tipped: true  },
    { name: 'Host',             department: 'Front of House', tipped: false },
    { name: 'Line Cook',        department: 'Kitchen',        tipped: false },
    { name: 'Prep Cook',        department: 'Kitchen',        tipped: false },
    { name: 'Dishwasher',       department: 'Kitchen',        tipped: false },
    { name: 'Kitchen Manager',   department: 'Management',     tipped: false },
    { name: 'Assistant Manager', department: 'Management',     tipped: false },
    { name: 'General Manager',   department: 'Management',     tipped: false }
  ],
  ensureStarters() {
    if (!App.laborData) App.laborData = {};
    if (App.laborData.lc_positions_seeded) return;
    const list = this.positions();
    if (list.length > 0) { App.laborData.lc_positions_seeded = true; return; }   // already has positions
    const seeded = this.STARTER_POSITIONS.map(p => ({
      id: App.uid(), name: p.name, department: p.department,
      default_wage: null, tipped: !!p.tipped, tip_out_pct: 0, notes: '',
      created_at: new Date().toISOString()
    }));
    seeded.forEach(p => list.push(p));
    App.laborData.lc_positions_seeded = true;
    App.saveLabor();                                       // the lc_positions_seeded flag stays in the blob
    App.putRecordsBulk('lc', 'position', seeded);          // the positions are rows now
  },

  render(container, actions) {
    this.ensureStarters();
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.editId = null;
    this.renderList();
  },

  // Full form body (Name, Department, Default Wage, Type, Notes) shared by the
  // inline add form and the edit pop-up. p = element-id prefix ('lp-' inline,
  // 'lpe-' pop-up) so the modal's inputs never collide with the inline form.
  // narrow=true lays the four cells out 2-per-row (for the taller, focused edit
  // pop-up); the inline add form keeps the wide single-row layout.
  formBody(item, p, narrow) {
    p = p || 'lp-';
    // Progressive disclosure: Tipped reveals Pays Tip Out; Pays = Yes reveals the %.
    const tipped = !!(item && item.tipped);
    const pays = tipped && (parseFloat(item.tip_out_pct) || 0) > 0;
    const basis = (item && item.tip_out_basis === 'tips') ? 'tips' : 'sales';
    const deptOpts = this.DEPARTMENTS.map(d =>
      '<option' + ((item ? item.department : 'Bar') === d ? ' selected' : '') + '>' + d + '</option>').join('');
    // Pay Type matches the roster: Hourly shows a Default Wage, Salary a Default
    // Salary. The staff roster pre-fills a new hire's pay type + figure from this.
    const isSalPos = (item && item.pay_type === 'Salary');
    const payVal = isSalPos
      ? ((item && item.default_salary != null && item.default_salary !== '') ? item.default_salary : '')
      : ((item && item.default_wage != null && item.default_wage !== '') ? item.default_wage : '');
    const cs = w => narrow ? 'flex:0 1 calc(50% - 8px);min-width:140px;' : 'width:' + w + 'px;flex-shrink:0;';
    return '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
      + '<div class="f" style="' + cs(200) + '"><label>Position Name</label>'
      + '<input type="text" id="' + p + 'name" value="' + esc(item?.name || '') + '" placeholder="e.g. Bartender"/></div>'
      + '<div class="f" style="' + cs(170) + '"><label>Department' + App.manageListLink('department') + '</label>'
      + App.customSelect({ id: p + 'dept', key: 'department', builtin: this.DEPARTMENTS, selected: (item ? item.department : 'Bar'), blank: true, blankLabel: 'Select department...' }) + '</div>'
      + '<div class="f" style="' + cs(130) + '"><label>Pay Type</label>'
      + '<select id="' + p + 'paytype">'
      + '<option' + (isSalPos ? '' : ' selected') + '>Hourly</option>'
      + '<option' + (isSalPos ? ' selected' : '') + '>Salary</option>'
      + '</select></div>'
      + '<div class="f" style="' + cs(150) + '"><label id="' + p + 'pay-label">' + (isSalPos ? 'Default Salary' : 'Default Wage') + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + p + 'wage" min="0" step="0.01" '
      + 'value="' + payVal + '" placeholder="0.00"/></div></div>'
      + '<div class="f" style="' + cs(150) + '"><label>Type</label>'
      + '<select id="' + p + 'tipped">'
      + '<option value="no"' + (tipped ? '' : ' selected') + '>Non-Tipped</option>'
      + '<option value="yes"' + (tipped ? ' selected' : '') + '>Tipped</option>'
      + '</select></div>'
      + '<div class="f" id="' + p + 'pays-wrap" style="' + cs(150) + (tipped ? '' : 'display:none;') + '"><label>Pays Tip Out</label>'
      + '<select id="' + p + 'pays">'
      + '<option value="no"' + (pays ? '' : ' selected') + '>No</option>'
      + '<option value="yes"' + (pays ? ' selected' : '') + '>Yes</option>'
      + '</select></div>'
      + '<div class="f" id="' + p + 'basis-wrap" style="' + cs(160) + ((tipped && pays) ? '' : 'display:none;') + '"><label>Tip Out On</label>'
      + '<select id="' + p + 'basis">'
      + '<option value="sales"' + (basis === 'tips' ? '' : ' selected') + '>% of Sales</option>'
      + '<option value="tips"' + (basis === 'tips' ? ' selected' : '') + '>% of Tips</option>'
      + '</select></div>'
      + '<div class="f" id="' + p + 'tipout-wrap" style="' + cs(150) + ((tipped && pays) ? '' : 'display:none;') + '"><label>Tip Out %</label>'
      + '<div class="fw"><input class="suf" type="number" id="' + p + 'tipout" min="0" step="0.1" value="' + (item && item.tip_out_pct != null ? item.tip_out_pct : '') + '" placeholder="0"/><span class="suf">%</span></div></div>'
      + '</div>'
      + App.noteField({ id: p + 'notes', value: item?.notes });
  },

  // Show Pays Tip Out only when Tipped; show the Tip Out % only when Pays = Yes.
  wireTipFields(p) {
    p = p || 'lp-';
    const typeEl = document.getElementById(p + 'tipped');
    const paysEl = document.getElementById(p + 'pays');
    const paysWrap = document.getElementById(p + 'pays-wrap');
    const basisWrap = document.getElementById(p + 'basis-wrap');
    const tipoutWrap = document.getElementById(p + 'tipout-wrap');
    const refresh = () => {
      const tipped = typeEl?.value === 'yes';
      const pays = paysEl?.value === 'yes';
      if (paysWrap) paysWrap.style.display = tipped ? '' : 'none';
      if (basisWrap) basisWrap.style.display = (tipped && pays) ? '' : 'none';
      if (tipoutWrap) tipoutWrap.style.display = (tipped && pays) ? '' : 'none';
    };
    typeEl?.addEventListener('change', refresh);
    paysEl?.addEventListener('change', refresh);
    refresh();
    // Pay Type swaps the pay field label between an hourly wage and an annual salary.
    const payTypeEl = document.getElementById(p + 'paytype');
    const payLabelEl = document.getElementById(p + 'pay-label');
    payTypeEl?.addEventListener('change', () => {
      if (payLabelEl) payLabelEl.textContent = payTypeEl.value === 'Salary' ? 'Default Salary' : 'Default Wage';
    });
  },

  renderList() {
    this.editId = null;
    const list = [...this.positions()].sort((a, b) => {
      const da = this.DEPARTMENTS.indexOf(a.department), db = this.DEPARTMENTS.indexOf(b.department);
      if (da !== db) return (da < 0 ? 99 : da) - (db < 0 ? 99 : db);
      return (a.name || '').localeCompare(b.name || '');
    });

    const addCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('lc-positions', 'Add Position')
      + '<div class="collapse-body">'
      + this.formBody(null)
      + '</div></div>'
      + '<div data-collapse-group="lc-positions" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="lp-save">Add Position</button>'
      + '<button class="btn btn-ghost" id="lp-startover">Start Over</button>'
      + '<span id="lp-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';

    const headHtml = '<thead><tr>'
      + '<th>Position</th><th>Department</th><th>Default Pay</th><th>Type</th><th></th>'
      + '</tr></thead>';
    let bodyHtml;
    if (list.length === 0) {
      bodyHtml = '<tbody><tr><td colspan="5" style="color:var(--t3);">No positions yet. Add your first one above.</td></tr></tbody>';
    } else {
      const rows = list.map(p => '<tr class="lp-row" data-id="' + p.id + '" style="cursor:pointer;">'
        + '<td><div class="val">' + esc(p.name || '-') + '</div></td>'
        + '<td>' + esc(p.department || '-') + '</td>'
        + '<td class="val">' + (p.pay_type === 'Salary'
            ? (p.default_salary != null ? App.fmtCurrency(p.default_salary) + '/yr' : 'Salary')
            : (p.default_wage != null ? App.fmtCurrency(p.default_wage) + '/hr' : '-')) + '</td>'
        + '<td>' + (p.tipped
            ? '<span style="color:var(--t1);font-weight:700;">Tipped</span><span style="color:var(--t3);"> &middot; ' + ((parseFloat(p.tip_out_pct) || 0) > 0 ? 'tips out ' + App.fmtPct(p.tip_out_pct) + ' of ' + (p.tip_out_basis === 'tips' ? 'tips' : 'sales') : 'receives') + '</span>'
            : '<span style="color:var(--t3);font-weight:700;">Non-Tipped</span>') + '</td>'
        + '<td><div class="row-actions">'
        + (App.canEdit('lc-positions') ? '<button class="btn btn-ghost btn-sm lp-edit" data-id="' + p.id + '">Edit</button>' : '')
        + (App.canEdit('lc-positions') ? '<button class="btn btn-danger btn-sm lp-del" data-id="' + p.id + '">Delete</button>' : '')
        + '</div></td></tr>').join('');
      bodyHtml = '<tbody>' + rows + '</tbody>';
    }
    const below = '<div class="card" style="overflow-x:auto;margin-top:24px;">'
      + '<table class="row-list">' + headHtml + bodyHtml + '</table></div>';

    this.container.innerHTML = '<div class="screen">' + addCard + below + '</div>';
    this.container.onclick = ev => {
      const head = ev.target.closest('.card-collapse-head');
      if (head) { App.toggleCollapse(head); return; }
      if (ev.target.closest('#lp-startover')) { this._draft = null; this.renderList(); return; }
      if (ev.target.closest('#lp-save')) { this.editId = null; this.save('lp-'); return; }
      const edit = ev.target.closest('.lp-edit');
      const del = ev.target.closest('.lp-del');
      const row = ev.target.closest('.lp-row');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.openEditModal(edit.dataset.id); }
      else if (row)  this.openEditModal(row.dataset.id);
    };
    App.applyCollapsed(this.container);
    App.wireCustomSelects(this.container);
    // Restore an in-progress draft before wiring so the tip-field disclosure reads
    // the restored values; then capture on every input so the draft stays current.
    const formRoot = this.container.querySelector('.form-card');
    if (formRoot && this._draft) App.restoreDraft(formRoot, this._draft);
    this.wireTipFields('lp-');
    if (formRoot) {
      const cap = () => { this._draft = App.captureDraft(formRoot); };
      formRoot.addEventListener('input', cap);
      formRoot.addEventListener('change', cap);
    }
  },

  // Edit in a focused pop-up (own lpe- ids). Cancel closes it; Delete pushed right.
  openEditModal(id) {
    if (!App.canEdit('lc-positions')) return;
    const item = this.positions().find(x => x.id === id);
    if (!item) return;
    this.editId = id;
    const html = '<div class="card form-card" style="margin:0;"><div class="card-title">Edit Position</div>'
      + this.formBody(item, 'lpe-', true)
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="lpe-save">Update</button>'
      + '<span id="lpe-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '<button class="btn btn-danger" id="lpe-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'lp-edit-modal', maxWidth: 540, noClose: true });
    App.wireCustomSelects(document);
    this.wireTipFields('lpe-');
    document.getElementById('lpe-save')?.addEventListener('click', () => this.save('lpe-'));
    document.getElementById('lpe-del')?.addEventListener('click', () => { this.editId = null; App.closeModal('lp-edit-modal'); this.confirmDel(id); });
  },

  async save(p) {
    p = p || 'lp-';
    const isEdit = p === 'lpe-';
    const err = document.getElementById(p + 'err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const name = document.getElementById(p + 'name')?.value.trim();
    if (!name) { fail('Position name is required.'); return; }
    const payType = (document.getElementById(p + 'paytype')?.value === 'Salary') ? 'Salary' : 'Hourly';
    const payNum = parseFloat(document.getElementById(p + 'wage')?.value);

    const isTipped = (document.getElementById(p + 'tipped')?.value || 'no') === 'yes';
    const pays = isTipped && (document.getElementById(p + 'pays')?.value || 'no') === 'yes';
    const tipoutRaw = parseFloat(document.getElementById(p + 'tipout')?.value);
    if (pays && (isNaN(tipoutRaw) || tipoutRaw <= 0)) { fail('Enter the tip-out percent, or set Pays Tip Out to No.'); return; }
    const rec = {
      id:            this.editId || App.uid(),
      name,
      department:    document.getElementById(p + 'dept')?.value || 'Other',
      pay_type:      payType,
      default_wage:   payType === 'Hourly' ? (isNaN(payNum) ? null : payNum) : null,
      default_salary: payType === 'Salary' ? (isNaN(payNum) ? null : payNum) : null,
      tipped:        isTipped,
      tip_out_pct:  pays ? tipoutRaw : 0,
      tip_out_basis: pays ? ((document.getElementById(p + 'basis')?.value === 'tips') ? 'tips' : 'sales') : 'sales',
      notes:        document.getElementById(p + 'notes')?.value.trim() || ''
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    // Row-per-record: build the record to persist (merge onto the existing position on edit
    // so created_at etc. survive) and write just that row.
    const list = this.positions();
    let out = rec;
    if (this.editId) { const i = list.findIndex(x => x.id === this.editId); if (i > -1) out = { ...list[i], ...rec }; }

    const btn = document.getElementById(p + 'save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('lc', 'position', out);
    this.editId = null;
    if (ok) {
      App.markSetupDone('gs_lc_positions');
      if (!isEdit) this._draft = null;   // a saved add clears its draft
      if (isEdit) App.closeModal('lp-edit-modal');
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = isEdit ? 'Update' : 'Add Position'; }
      fail('Save failed. Try again.');
    }
  },

  showHowTo() {
    App.showHelpModal('How Positions Work', [
      { p: ['Positions are the job roles you schedule and pay: bartender, server, line cook, and so on. Every shift you build and every hour you log is tied to a position, so this is the list that drives your whole labor cost.'] },
      { h: 'Department and Default Pay', p: ['Each position belongs to a department (Bar, Front of House, Kitchen, Management) and carries a default pay setup: a Pay Type of Hourly with a default wage, or Salary with a default annual figure (the way you would set a manager). When you add a staff member in the role, their pay type and figure pre-fill from here, so you set it once instead of on every hire, and you can still override it per person.'] },
      { h: 'Tipped Roles and Tip-Out', p: ['Mark a position Tipped if the role earns tip income. Then choose whether it Pays Tip Out: Yes for a role that rings sales and tips out (servers, bartenders), which opens a Tip Out % field; No for a role that only receives tip-out (bussers, barbacks, runners). Different roles can tip out different percents. Bar Cop uses this in Tip Tracking: roles that pay get a Sales column and tip out that percent of their sales, roles that do not get an editable Received amount, and a role that both pays and receives (a bartender taking the bar share from servers) gets both. It all feeds the Pay Periods tip-credit check.'] },
      { h: 'Where Positions Show Up', p: ['Add a position once and it is available everywhere: the staff roster, the schedule builder, the hours log, and every labor report. Edit a position any time and the change carries forward without touching past records.'] }
    ]);
  },

  async confirmDel(id) {
    const pos = this.positions().find(x => x.id === id);
    const staffUsing = ((App.laborData && App.laborData.lc_staff) || []).filter(s => s.position_id === id);
    if (staffUsing.length) {
      const ok = await App.confirm({
        title: 'Delete this position?',
        message: staffUsing.length + ' staff ' + (staffUsing.length === 1 ? 'member is' : 'members are') + ' assigned to ' + (pos ? pos.name : 'this position') + '. Deleting it leaves them with no position and drops their logged hours into Unassigned on reports. Reassign them first, or delete anyway.',
        confirmText: 'Delete Anyway',
        cancelText: 'Cancel',
        danger: true
      });
      if (!ok) return;
    } else if (!(await App.confirmDelete())) {
      return;
    }
    await App.removeRecord('lc', 'position', id);   // row-per-record
    App.markSetupDone('gs_lc_positions');   // a real delete counts as working the list
    this.renderList();
  }
};
