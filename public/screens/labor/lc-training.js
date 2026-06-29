'use strict';

/* ── Labor Control — Training (writes lc_training_templates + lc_training) ─────
   Tracks that each staff member completed their training and onboarding, with a
   record. This is TRACKING, not a course library: a "menu test passed, signed
   off by a manager on this date" checklist, not a quiz or video.

   Two stores, both in App.laborData (saved via App.saveLabor, like certs and the
   coaching log, no event-store kind):
     lc_training_templates = reusable checklists {id, name, position_id, items[], created_at}
     lc_training           = one assignment per person {id, staff_id, name, template_id,
                             items[{text,done,done_date}], signed_off_by_id, signed_off_by,
                             completed_date, notes, created_at}

   This screen (the Training sidebar item) is the templates maker plus a team
   status overview. Assigning and checking off a person's training lives on their
   Staff Roster page, in a Training section that calls the helpers here so the two
   doors never drift. */

S.LaborTraining = {
  // Template-maker state (kept in-memory so an in-progress template survives
  // navigating away and back; only Save, Cancel, or Start Over resets it).
  editId: null,
  _name: '',
  _posId: '',
  _items: [],

  // ── Stores ──────────────────────────────────────────────────────────────
  templates() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_training_templates)) App.laborData.lc_training_templates = [];
    return App.laborData.lc_training_templates;
  },
  records() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_training)) App.laborData.lc_training = [];
    return App.laborData.lc_training;
  },
  recordsForStaff(staffId) {
    return this.records().filter(r => r.staff_id === staffId).slice()
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },
  templateById(id) { return this.templates().find(t => t.id === id); },

  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
  positions() { return ((App.laborData && App.laborData.lc_positions) || []); },
  positionById(id) { return this.positions().find(p => p.id === id); },
  posLabel(id) { const p = this.positionById(id); return p ? p.name : ''; },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // Shared column widths so the Saved Templates and Team Training Status tables
  // line up column-for-column down the page (Position under Position, the middle
  // column and actions aligned), for easier reading. Both tables run fixed layout.
  _COLGROUP: '<colgroup><col style="width:30%"/><col style="width:22%"/><col style="width:23%"/><col style="width:25%"/></colgroup>',

  // A record's checklist progress and whether it counts as complete. An item-based
  // record completes when every item is checked; a no-item record (a plain "they
  // were trained, signed off" attestation) completes once it has a sign-off.
  recProgress(rec) {
    const items = (rec && rec.items) || [];
    return { done: items.filter(i => i.done).length, total: items.length };
  },
  recComplete(rec) {
    const { done, total } = this.recProgress(rec);
    return total > 0 ? done >= total : !!(rec && rec.signed_off_by_id);
  },
  // Roll a person's records into one status for the team overview.
  trainingStatusFor(staffId) {
    const recs = this.recordsForStaff(staffId);
    if (!recs.length) return { state: 'none', done: 0, total: 0 };
    let done = 0, total = 0;
    recs.forEach(r => { const p = this.recProgress(r); done += p.done; total += p.total; });
    const allComplete = recs.every(r => this.recComplete(r));
    if (allComplete) {
      const dates = recs.map(r => r.completed_date).filter(Boolean).sort();
      return { state: 'complete', done, total, completed_date: dates.length ? dates[dates.length - 1] : '' };
    }
    return { state: 'progress', done, total };
  },

  // ════════════════════════════════════════════════════════════════════════
  //  SCREEN — Training Templates maker + Team Training Status
  // ════════════════════════════════════════════════════════════════════════
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (this.actions) this.actions.innerHTML = '';
    if (this.editId) this.renderForm();
    else this.renderMain();
  },

  _resetForm() { this.editId = null; this._name = ''; this._posId = ''; this._items = []; },

  showHowTo() {
    App.showHelpModal('How Training Works', [
      { p: ['Training tracks that each person actually completed their onboarding, with a record you can show. It is for tracking, not teaching: a checklist you sign off and date, not videos or quizzes. Build a template once, assign it to a person, check the items off as they finish, and sign it.'] },
      { h: 'Build a template', p: ['Name it (Bartender Onboarding, Server Onboarding, New POS Rollout), set a Position if it is role specific, and add the steps in the order they should happen. Drag the handle to reorder. Templates are reusable, so you build each one once and assign it to every new hire in that role.'] },
      { h: 'Assign and sign off', p: ['Go to a person on the Staff Roster and use Assign Training in their Training section. Pick a template and a start date (so you can see who has been onboarding too long), and the steps load onto their own record. As they finish each step you check it off; when every step is done the record stamps its completion date. Pick who signed off so there is a name on the record.'] },
      { h: 'Print a blank sheet', p: ['Each template has an Export PDF that prints a clean onboarding sheet with empty checkboxes and blank date and sign-off lines, for a trainer to mark up by hand and drop in the binder.'] },
      { h: 'Team Training Status', p: ['The status list shows every active staff member and where they stand: Not Started, In Progress with a count, or Complete. Tap a row to jump to that person and pick up where their training left off. This is a record-keeping aid, not legal or HR advice.'] }
    ]);
  },

  // ── The template form (inline for a new template, own page for an edit) ─────
  formBlock(isEdit) {
    const posOpts = '<option value="">Any position</option>'
      + this.positions().map(p => '<option value="' + p.id + '"' + (this._posId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
    const itemRows = this._items.map((it, idx) =>
      '<div class="tr-line" data-id="' + idx + '" data-idx="' + idx + '" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">'
      + DragReorder.handleDivHTML()
      + '<input type="text" class="tr-item-input" data-idx="' + idx + '" value="' + esc(it) + '" placeholder="Training step" style="flex:1;padding:9px 11px;"/>'
      + '<button type="button" class="btn btn-danger btn-sm tr-remove" data-idx="' + idx + '">Remove</button>'
      + '</div>').join('');
    const itemsBlock = this._items.length === 0
      ? '<div style="font-size:12px;color:var(--t3);margin-bottom:10px;">No steps yet. Add the training steps below, in the order they should happen.</div>'
      : itemRows;

    return '<div class="card form-card">'
      + '<div class="card-title">' + (isEdit ? 'Edit' : 'New') + ' Training Template</div>'
      + '<div class="form-row" style="gap:16px;">'
      + '<div class="f" style="width:280px;flex-shrink:0;"><label>Template Name</label>'
      + '<input type="text" id="tr-name" value="' + esc(this._name) + '" placeholder="e.g. Bartender Onboarding"/></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Position <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
      + '<select id="tr-pos">' + posOpts + '</select></div>'
      + '</div>'
      + '<div class="divider"></div>'
      + '<div class="sh" style="margin-bottom:10px;">Training Steps</div>'
      + '<div id="tr-items">' + itemsBlock + '</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">'
      + '<button class="btn btn-ghost btn-sm" id="tr-add-item">+ Add Step</button>'
      + '</div>'
      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="tr-save">' + (isEdit ? 'Update Template' : 'Save Template') + '</button>'
      + (isEdit
          ? '<button class="btn btn-ghost" id="tr-cancel">Cancel</button>'
          : '<button class="btn btn-ghost" id="tr-startover">Start Over</button>')
      + '<span id="tr-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';
  },

  savedTemplatesSection() {
    const list = this.templates();
    const head = '<table class="row-list" style="table-layout:fixed;width:100%;">' + this._COLGROUP
      + '<thead><tr><th>Saved Templates</th><th>Position</th><th>Steps</th><th></th></tr></thead>';
    if (list.length === 0) {
      return '<div class="card" style="overflow-x:auto;margin-top:24px;">' + head
        + '<tbody><tr><td colspan="4" style="color:var(--t3);">No templates yet. Build one above to assign to your team.</td></tr></tbody></table></div>';
    }
    const rows = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(t =>
      '<tr class="tr-tpl-row" data-id="' + t.id + '" style="cursor:pointer;">'
      + '<td><div class="val">' + esc(t.name) + '</div></td>'
      + '<td>' + (t.position_id ? esc(this.posLabel(t.position_id)) : '<span style="color:var(--t3);">Any</span>') + '</td>'
      + '<td>' + ((t.items && t.items.length) || 0) + ' steps</td>'
      + '<td><div class="row-actions">'
      + '<button class="btn btn-ghost btn-sm tr-tpl-export" data-id="' + t.id + '">Export PDF</button>'
      + (App.canEdit('lc-training') ? '<button class="btn btn-ghost btn-sm tr-tpl-edit" data-id="' + t.id + '">Edit</button>' : '')
      + (App.canEdit('lc-training') ? '<button class="btn btn-danger btn-sm tr-tpl-del" data-id="' + t.id + '">Delete</button>' : '')
      + '</div></td></tr>').join('');
    return '<div class="card" style="overflow-x:auto;margin-top:24px;">' + head
      + '<tbody>' + rows + '</tbody></table></div>';
  },

  teamStatusSection() {
    const list = [...this.staff()].filter(s => s.status !== 'Inactive')
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const heading = '<div class="sh" style="margin:24px 0 10px;">Team Training Status</div>';
    const head = '<table class="row-list" style="table-layout:fixed;width:100%;">' + this._COLGROUP
      + '<thead><tr><th>Staff Name</th><th>Position</th><th>Status</th><th></th></tr></thead>';
    if (list.length === 0) {
      return heading + '<div class="card" style="overflow-x:auto;">' + head
        + '<tbody><tr><td colspan="4" style="color:var(--t3);">No active staff yet. Build your roster first.</td></tr></tbody></table></div>';
    }
    const rows = list.map(s => {
      const st = this.trainingStatusFor(s.id);
      const statusCell = st.state === 'complete'
          ? '<span style="color:var(--t2);">Complete' + (st.completed_date ? ' ' + this.fmtDate(st.completed_date) : '') + '</span>'
        : st.state === 'progress'
          ? '<span style="color:var(--amber);font-weight:700;">In Progress ' + st.done + ' of ' + st.total + '</span>'
          : '<span style="color:var(--t3);">Not Started</span>';
      return '<tr class="tr-team-row" data-id="' + s.id + '" style="cursor:pointer;">'
        + '<td><div class="val">' + esc(s.name || '-') + '</div></td>'
        + '<td>' + esc(this.posLabel(s.position_id) || '-') + '</td>'
        + '<td>' + statusCell + '</td>'
        + '<td><div class="row-actions"><button class="btn btn-ghost btn-sm tr-team-view" data-id="' + s.id + '">View</button></div></td>'
        + '</tr>';
    }).join('');
    return heading + '<div class="card" style="overflow-x:auto;">' + head
      + '<tbody>' + rows + '</tbody></table></div>';
  },

  renderMain() {
    this.editId = null;
    if (this.actions) this.actions.innerHTML = '';
    this.container.innerHTML = '<div class="screen">'
      + this.formBlock(false)
      + this.savedTemplatesSection()
      + this.teamStatusSection()
      + '</div>';
    this.container.onclick = ev => {
      const exp = ev.target.closest('.tr-tpl-export');
      if (exp) { ev.stopPropagation(); this.exportTemplate(exp.dataset.id); return; }
      const tEdit = ev.target.closest('.tr-tpl-edit');
      const tDel = ev.target.closest('.tr-tpl-del');
      const tRow = ev.target.closest('.tr-tpl-row');
      if (tDel) { ev.stopPropagation(); this.confirmDelTemplate(tDel.dataset.id); return; }
      if (tEdit) { ev.stopPropagation(); this.showForm(tEdit.dataset.id); return; }
      if (tRow) { this.showForm(tRow.dataset.id); return; }
      const view = ev.target.closest('.tr-team-view') || ev.target.closest('.tr-team-row');
      if (view) { App._staffFocus = { staff_id: view.dataset.id }; App.navigate('lc-staff-roster'); return; }
    };
    this._bindForm(() => this.renderMain());
  },

  showForm(id) {
    this.editId = id || null;
    const t = id ? this.templateById(id) : null;
    this._items = t ? (t.items || []).slice() : [];
    this._name = t ? t.name : '';
    this._posId = t ? (t.position_id || '') : '';
    this.renderForm();
  },

  renderForm() {
    this.container.innerHTML = '<div class="screen">' + this.formBlock(true) + '</div>';
    this.container.onclick = null;
    this._bindForm(() => this.renderForm());
  },

  // Pull current values from the DOM into state so stepping off keeps the draft.
  syncItems() {
    const nameEl = document.getElementById('tr-name');
    const posEl = document.getElementById('tr-pos');
    if (nameEl) this._name = nameEl.value || '';
    if (posEl) this._posId = posEl.value || '';
    const inputs = [...document.querySelectorAll('.tr-item-input')];
    if (inputs.length) this._items = inputs.map(i => i.value);
  },

  _bindForm(reRender) {
    document.getElementById('tr-add-item')?.addEventListener('click', () => { this.syncItems(); this._items.push(''); reRender(); });
    document.getElementById('tr-name')?.addEventListener('input', () => this.syncItems());
    document.getElementById('tr-pos')?.addEventListener('change', () => this.syncItems());
    document.getElementById('tr-items')?.addEventListener('input', ev => { if (ev.target.classList.contains('tr-item-input')) this.syncItems(); });
    document.getElementById('tr-items')?.addEventListener('click', ev => {
      const rm = ev.target.closest('.tr-remove');
      if (!rm) return;
      this.syncItems();
      this._items.splice(parseInt(rm.dataset.idx, 10), 1);
      reRender();
    });
    const itemsHost = document.getElementById('tr-items');
    if (itemsHost) {
      DragReorder.wire({
        container: itemsHost, rowSelector: '.tr-line', handleSelector: '.dr-handle',
        onCommit: () => { this.syncItems(); reRender(); }
      });
    }
    document.getElementById('tr-cancel')?.addEventListener('click', () => { this._resetForm(); this.renderMain(); });
    document.getElementById('tr-startover')?.addEventListener('click', () => { this._resetForm(); this.renderMain(); });
    document.getElementById('tr-save')?.addEventListener('click', () => this.saveTemplate());
  },

  async saveTemplate() {
    this.syncItems();
    const err = document.getElementById('tr-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const name = (this._name || '').trim();
    if (!name) { fail('Template name is required.'); return; }
    const items = this._items.map(i => i.trim()).filter(Boolean);
    if (items.length === 0) { fail('Add at least one training step.'); return; }

    const rec = { id: this.editId || App.uid(), name, position_id: this._posId || '', items };
    if (!this.editId) rec.created_at = new Date().toISOString();
    const list = this.templates();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('tr-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveLabor();
    if (ok) { this._resetForm(); this.renderMain(); }
    else {
      if (btn) { btn.disabled = false; btn.textContent = this.editId ? 'Update Template' : 'Save Template'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDelTemplate(id) {
    const t = this.templateById(id);
    const inUse = this.records().filter(r => r.template_id === id).length;
    if (inUse > 0) {
      const ok = await App.confirm({
        title: 'Delete ' + (t ? t.name : 'this template') + '?',
        message: 'This template was used to assign training to ' + inUse + ' ' + (inUse === 1 ? 'person' : 'people') + '. Deleting it removes the template only. Their assigned records and sign-offs stay intact. Delete the template?',
        confirmText: 'Delete', cancelText: 'Cancel', danger: true
      });
      if (!ok) return;
    } else if (!(await App.confirmDelete())) {
      return;
    }
    App.laborData.lc_training_templates = this.templates().filter(x => x.id !== id);
    await App.saveLabor();
    this.renderMain();
  },

  // Blank printable onboarding sheet for a template: empty checkboxes, blank date
  // and sign-off lines for a trainer to mark up by hand. Print only, no record.
  async exportTemplate(id) {
    const t = this.templateById(id);
    if (!t) return;
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const items = (t.items || []);
    const b = App._pdfBuilder(t.name);
    b.header({ right: t.name, meta: 'Training Worksheet' });
    b.kv('Staff Member', '________________');
    if (t.position_id) b.kv('Position', this.posLabel(t.position_id));
    b.kv('Start Date', '________________');
    b.spacer(6);
    b.sectionTitle('Check off each step as it is completed');
    b.table(['Done', 'Step', 'Date'], items.map(x => ['[   ]', x, '__________']), { columnStyles: { 0: { cellWidth: 45 }, 2: { cellWidth: 80 } } });
    b.spacer(8);
    b.kv('Signed Off By', '________________');
    b.kv('Date Completed', '________________');
    b.spacer(6);
    b.sectionTitle('Notes');
    b.paragraph(' ');
    await b.save('BarCop_' + App.fileSafe(t.name) + '_TrainingWorksheet.pdf');
  },

  // ════════════════════════════════════════════════════════════════════════
  //  STAFF ROSTER section — assign + check off a person's training. Rendered and
  //  wired by lc-staff-roster (Screen A) through these helpers, so the templates
  //  store and the assignment records have one home.
  // ════════════════════════════════════════════════════════════════════════
  rosterSectionHTML(staffId) {
    const list = this.recordsForStaff(staffId);
    const addBtn = '<div class="no-print" style="margin:12px 0 24px;"><button class="btn btn-ghost btn-sm" id="tr-assign">+ Assign Training</button></div>';
    // Shares the roster's DETAIL_COLGROUP so Training lines up with Certifications
    // and Coaching Log down the page.
    const cg = (S.LaborStaffRoster && S.LaborStaffRoster.DETAIL_COLGROUP) || '';
    const head = '<table class="row-list" style="table-layout:fixed;width:100%;">' + cg
      + '<thead><tr><th>Training</th><th>Start Date</th><th>Progress</th><th>Status</th><th>Signed Off By</th><th></th></tr></thead>';
    if (list.length === 0) {
      return '<div class="card" style="overflow-x:auto;margin-top:24px;">' + head
        + '<tbody><tr><td colspan="6" style="color:var(--t3);padding:12px 8px;">No training on file yet. Assign an onboarding template and check the steps off as they finish.</td></tr></tbody></table></div>' + addBtn;
    }
    const rows = list.map(r => {
      const { done, total } = this.recProgress(r);
      const complete = this.recComplete(r);
      const statusCell = complete
          ? '<span style="color:var(--t2);">Complete' + (r.completed_date ? ' ' + this.fmtDate(r.completed_date) : '') + '</span>'
        : done > 0
          ? '<span style="color:var(--amber);font-weight:700;">In Progress</span>'
          : '<span style="color:var(--t3);">Not Started</span>';
      return '<tr>'
        + '<td><div class="val">' + esc(r.name || '-') + '</div></td>'
        + '<td>' + (r.start_date ? this.fmtDate(r.start_date) : '<span style="color:var(--t3);">-</span>') + '</td>'
        + '<td>' + (total > 0 ? done + ' of ' + total : '<span style="color:var(--t3);">-</span>') + '</td>'
        + '<td>' + statusCell + '</td>'
        + '<td>' + (r.signed_off_by ? esc(r.signed_off_by) : '<span style="color:var(--t3);">-</span>') + '</td>'
        + '<td><div class="row-actions">'
        + '<button class="btn btn-ghost btn-sm tr-rec-open" data-id="' + r.id + '">Open</button>'
        + '<button class="btn btn-danger btn-sm tr-rec-del" data-id="' + r.id + '">Delete</button>'
        + '</div></td></tr>';
    }).join('');
    return '<div class="card" style="overflow-x:auto;margin-top:24px;">' + head
      + '<tbody>' + rows + '</tbody></table></div>' + addBtn;
  },

  // Bind the roster Training section's buttons. reRender re-renders the staff page.
  wireRosterSection(container, staffId, reRender) {
    container.querySelector('#tr-assign')?.addEventListener('click', () => this.openAssignModal(staffId, reRender));
    container.querySelectorAll('.tr-rec-open').forEach(b => b.addEventListener('click', () => this.openRecordModal(staffId, b.dataset.id, reRender)));
    container.querySelectorAll('.tr-rec-del').forEach(b => b.addEventListener('click', () => this.confirmDelRecord(b.dataset.id, staffId, reRender)));
  },

  // Assign a template (or a blank attestation) to a person. The template's steps
  // load onto the person's own record; the name defaults to the template name.
  openAssignModal(staffId, onSaved) {
    const s = this.staffById(staffId);
    const tpls = [...this.templates()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    // Auto-pick a template that matches this person's position, else the first.
    const match = tpls.find(t => t.position_id && s && t.position_id === s.position_id);
    const defId = match ? match.id : (tpls[0] ? tpls[0].id : '');
    const defName = (this.templateById(defId) || {}).name || '';
    const tplOpts = tpls.map(t => '<option value="' + t.id + '"' + (t.id === defId ? ' selected' : '') + '>' + esc(t.name)
      + (t.position_id ? ' (' + esc(this.posLabel(t.position_id)) + ')' : '') + '</option>').join('')
      + '<option value="">Blank (sign-off only)</option>';
    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">Assign Training' + (s ? ' to ' + esc(s.name) : '') + '</div>'
      + '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
        + '<div class="f" style="flex:0 1 calc(50% - 8px);min-width:180px;"><label>Template</label>'
          + '<select id="tr-a-tpl">' + tplOpts + '</select></div>'
        + '<div class="f" style="flex:0 1 calc(50% - 8px);min-width:180px;"><label>Name</label>'
          + '<input type="text" id="tr-a-name" value="' + esc(defName) + '" placeholder="e.g. Bartender Onboarding"/></div>'
        + '<div class="f" style="flex:0 1 calc(50% - 8px);min-width:180px;"><label>Start Date</label>'
          + '<input type="date" id="tr-a-start" value="' + esc(App.todayLocal()) + '"/></div>'
      + '</div>'
      + '<div id="tr-a-info" style="font-size:12px;color:var(--t3);margin-top:2px;"></div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="tr-a-save">Assign</button>'
        + '<button class="btn btn-ghost" id="tr-a-cancel">Cancel</button>'
        + '<span id="tr-a-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'tr-assign-modal', maxWidth: 540, noClose: true });

    const tplEl = document.getElementById('tr-a-tpl');
    const nameEl = document.getElementById('tr-a-name');
    const infoEl = document.getElementById('tr-a-info');
    let nameTouched = false;
    nameEl?.addEventListener('input', () => { nameTouched = true; });
    const syncInfo = () => {
      const t = this.templateById(tplEl.value);
      if (infoEl) infoEl.textContent = t ? ((t.items || []).length + ' step' + ((t.items || []).length === 1 ? '' : 's') + ' will load onto this record.')
        : 'A blank record with no steps. Sign it off to mark the person trained.';
    };
    tplEl?.addEventListener('change', () => {
      const t = this.templateById(tplEl.value);
      if (!nameTouched) nameEl.value = t ? t.name : '';
      syncInfo();
    });
    syncInfo();
    document.getElementById('tr-a-cancel')?.addEventListener('click', () => App.closeModal('tr-assign-modal'));
    document.getElementById('tr-a-save')?.addEventListener('click', () => this.saveAssign(staffId, onSaved));
  },

  async saveAssign(staffId, onSaved) {
    const err = document.getElementById('tr-a-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const tplId = document.getElementById('tr-a-tpl')?.value || '';
    const name = (document.getElementById('tr-a-name')?.value || '').trim();
    if (!name) { fail('Give this training a name.'); return; }
    const tpl = this.templateById(tplId);
    const items = (tpl ? (tpl.items || []) : []).map(text => ({ text, done: false, done_date: '' }));
    const rec = {
      id: App.uid(),
      staff_id: staffId,
      name,
      template_id: tplId,
      start_date: document.getElementById('tr-a-start')?.value || App.todayLocal(),
      items,
      signed_off_by_id: '',
      signed_off_by: '',
      completed_date: '',
      notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.records().push(rec);
    const ok = await App.saveLabor();
    if (ok) { App.closeModal('tr-assign-modal'); if (onSaved) onSaved(); }
    else { this.records().pop(); fail('Save failed. Try again.'); }
  },

  // Open a record to check steps off, sign it, and add notes. The steps + progress
  // re-render in place on each tap; the sign-off and notes fields are untouched.
  openRecordModal(staffId, recId, onSaved) {
    const rec = this.records().find(r => r.id === recId);
    if (!rec) return;
    this._recWork = {
      items: (rec.items || []).map(i => ({ text: i.text, done: !!i.done, done_date: i.done_date || '' }))
    };
    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">' + esc(rec.name || 'Training') + '</div>'
      + '<div id="tr-rec-body">' + this._recBodyHTML() + '</div>'
      + '<div class="form-row" style="gap:16px;margin-top:14px;flex-wrap:wrap;">'
        + '<div class="f" style="flex:0 1 calc(50% - 8px);min-width:180px;"><label>Start Date</label>'
          + '<input type="date" id="tr-rec-start" value="' + esc(rec.start_date || '') + '"/></div>'
        + '<div class="f" style="flex:0 1 calc(50% - 8px);min-width:180px;"><label>Signed Off By</label>'
          + '<select id="tr-rec-by">' + App.staffOptions(rec.signed_off_by_id || rec.signed_off_by, { placeholder: 'Select supervisor...', audience: 'supervisor' }) + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
        + '<textarea id="tr-rec-notes" class="notes-ta" rows="2" placeholder="Optional">' + esc(rec.notes || '') + '</textarea></div></div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="tr-rec-save">Save</button>'
        + '<button class="btn btn-ghost" id="tr-rec-cancel">Cancel</button>'
        + '<span id="tr-rec-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
        + '<button class="btn btn-danger" id="tr-rec-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'tr-rec-modal', maxWidth: 540, noClose: true });
    this._bindRecordModal(staffId, recId, onSaved);
  },

  _recBodyHTML() {
    const items = this._recWork.items;
    if (!items.length) {
      return '<div style="font-size:13px;color:var(--t3);line-height:1.5;">No steps on this record. Pick who signed off below and save to mark this person trained.</div>';
    }
    const done = items.filter(i => i.done).length;
    const pct = items.length ? Math.round(done / items.length * 100) : 0;
    const itemRows = items.map((it, idx) =>
      '<div class="tr-citem" data-idx="' + idx + '" style="display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--b2);cursor:pointer;">'
      + (it.done
          ? '<span style="flex-shrink:0;width:16px;height:16px;border-radius:3px;background:var(--green);color:var(--bg);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;">&#10003;</span>'
          : '<span style="flex-shrink:0;width:16px;height:16px;border-radius:3px;border:1.5px solid var(--b1);"></span>')
      + '<span style="font-size:14px;color:' + (it.done ? 'var(--t3)' : 'var(--t1)') + ';' + (it.done ? 'text-decoration:line-through;' : '') + '">' + esc(it.text) + '</span>'
      + '</div>').join('');
    return '<div style="margin:0 0 14px;">'
      + '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--t3);margin-bottom:6px;"><span>' + done + ' of ' + items.length + ' complete</span><span>' + pct + '%</span></div>'
      + '<div style="height:6px;background:var(--input);border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--green);transition:width 0.2s;"></div></div></div>'
      + itemRows;
  },

  _bindRecordModal(staffId, recId, onSaved) {
    const body = document.getElementById('tr-rec-body');
    body?.addEventListener('click', ev => {
      const row = ev.target.closest('.tr-citem');
      if (!row) return;
      const idx = parseInt(row.dataset.idx, 10);
      const it = this._recWork.items[idx];
      it.done = !it.done;
      it.done_date = it.done ? App.todayLocal() : '';
      body.innerHTML = this._recBodyHTML();
    });
    document.getElementById('tr-rec-cancel')?.addEventListener('click', () => App.closeModal('tr-rec-modal'));
    document.getElementById('tr-rec-save')?.addEventListener('click', () => this.saveRecord(staffId, recId, onSaved));
    document.getElementById('tr-rec-del')?.addEventListener('click', () => this.confirmDelRecord(recId, staffId, onSaved, true));
  },

  async saveRecord(staffId, recId, onSaved) {
    const list = this.records();
    const i = list.findIndex(r => r.id === recId);
    if (i < 0) { App.closeModal('tr-rec-modal'); return; }
    const items = this._recWork.items.map(it => ({ text: it.text, done: !!it.done, done_date: it.done ? (it.done_date || App.todayLocal()) : '' }));
    const byId = document.getElementById('tr-rec-by')?.value || '';
    const byName = (this.staffById(byId) || {}).name || '';
    const notes = (document.getElementById('tr-rec-notes')?.value || '').trim();
    const start_date = document.getElementById('tr-rec-start')?.value || '';

    const total = items.length;
    const allDone = total > 0 && items.every(it => it.done);
    const complete = total > 0 ? allDone : !!byId;
    const prev = list[i];
    const completed_date = complete ? (prev.completed_date || App.todayLocal()) : '';

    list[i] = { ...prev, items, start_date, signed_off_by_id: byId, signed_off_by: byName, notes, completed_date, updated_at: new Date().toISOString() };
    const ok = await App.saveLabor();
    if (ok) { App.closeModal('tr-rec-modal'); if (onSaved) onSaved(); }
    else {
      const err = document.getElementById('tr-rec-err');
      if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; }
    }
  },

  async confirmDelRecord(recId, staffId, onSaved, fromModal) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    App.laborData.lc_training = this.records().filter(r => r.id !== recId);
    await App.saveLabor();
    if (fromModal) App.closeModal('tr-rec-modal');
    if (onSaved) onSaved();
  }
};
