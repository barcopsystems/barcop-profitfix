'use strict';

/* ── Labor Control — Staff Roster (writes lc_staff) ───────────────────────────
   The team roster — each staff member, their position, wage, and status. Wage
   defaults from the position but is editable per person. The roster is the
   source for scheduling, hours, tips, and (per Rule 20) Revenue Recovery's
   server list. Stored in App.laborData (lc_data, Rule 21). */

S.LaborStaffRoster = {
  editId: null,
  detailId: null,
  certEditId: null,
  noteEditId: null,
  noteFilterCategory: '',
  _pendingDelId: null,

  // Common bar/restaurant certifications. Custom escape hatch covers anything
  // not on the standard list (state-specific permits, vendor trainings, etc).
  CERT_TYPES: ['TABC (Texas)', 'RBS (California)', 'RAMP (Pennsylvania)', 'ServSafe Food Handler',
    'ServSafe Manager', 'Allergen Awareness', 'CPR / First Aid', 'Food Handler Permit',
    'ABC On-Premise', 'Health Card', 'Other'],
  NOTE_CATEGORIES: ['Praise', 'Coaching', 'Concern', 'Warning'],

  staff() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_staff)) App.laborData.lc_staff = [];
    return App.laborData.lc_staff;
  },
  staffById(id) { return this.staff().find(s => s.id === id); },
  positions() {
    return ((App.laborData && App.laborData.lc_positions) || []);
  },
  positionById(id) {
    return this.positions().find(p => p.id === id);
  },

  // ── Certifications data ──────────────────────────────────────────────
  certs() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_certs)) App.laborData.lc_certs = [];
    return App.laborData.lc_certs;
  },
  certsForStaff(staffId) {
    return this.certs()
      .filter(c => c.staff_id === staffId)
      .slice()
      .sort((a, b) => (a.expiration_date || '').localeCompare(b.expiration_date || ''));
  },
  // Returns 'expired' | 'expiring' (within 30 days) | 'ok'
  certStatus(cert) {
    if (!cert || !cert.expiration_date) return 'ok';
    const today = new Date().toISOString().slice(0, 10);
    if (cert.expiration_date < today) return 'expired';
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    if (cert.expiration_date <= cutoffStr) return 'expiring';
    return 'ok';
  },

  // ── Coaching / staff notes data ──────────────────────────────────────
  notes() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_staff_notes)) App.laborData.lc_staff_notes = [];
    return App.laborData.lc_staff_notes;
  },
  notesForStaff(staffId) {
    return this.notes()
      .filter(n => n.staff_id === staffId)
      .slice()
      .sort((a, b) => (b.date || b.created_at || '').localeCompare(a.date || a.created_at || ''));
  },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    // Cross-system focus: when Server Scorecard fires "+ Coaching Note" on a
    // row, it sets App._coachingFocus = { staff_id } and navigates here.
    // Open the staff detail and pre-pop the Add Coaching Note form so the
    // manager can write the note in one click instead of navigating to the
    // staff member first.
    if (App._coachingFocus && App._coachingFocus.staff_id) {
      const sid = App._coachingFocus.staff_id;
      App._coachingFocus = null;
      this.detailId = sid;
      this.renderUnified(sid, 'view');
      this.noteEditId = null;
      this.renderNoteForm(sid);
      return;
    }
    this.renderList();
  },

  renderList() {
    this.actions.innerHTML = '';
    if (this.positions().length > 0) {
      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn-primary btn-sm';
      addBtn.textContent = 'Add Staff';
      addBtn.addEventListener('click', () => this.renderUnified(null, 'edit'));
      this.actions.appendChild(addBtn);
    }
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-ghost btn-sm';
    exportBtn.textContent = 'Export PDF';
    exportBtn.addEventListener('click', () => window.print());
    this.actions.appendChild(exportBtn);

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
      // Row Edit button drops directly into edit mode on the unified page;
      // row click lands in view mode. Both reach the same page — every staff
      // section (profile, certifications, coaching) is visible on first open.
      const rows = list.map(s => {
        const pos = this.positionById(s.position_id);
        return '<tr class="sr-row" data-id="' + s.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + esc(s.name || '-') + '</div></td>'
          + '<td>' + esc(pos ? pos.name : '-') + '</td>'
          + '<td>' + esc(pos ? (pos.department || '-') : '-') + '</td>'
          + '<td class="val">' + (s.wage != null ? App.fmtCurrency(s.wage) + '/hr' : '-') + '</td>'
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
      if (del)        { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit)  { ev.stopPropagation(); this.renderUnified(edit.dataset.id, 'edit'); }
      else if (row)   this.renderUnified(row.dataset.id, 'view');
      else if (addF)  this.renderUnified(null, 'edit');
    };
  },

  // ── Staff detail page (unified) — Profile + Certifications + Coaching Log
  // One page, every section visible after first click. profileMode controls
  // the Profile card's render: 'view' (read-only kv pairs) or 'edit' (inputs).
  // For a brand-new staff member (staffId null), profileMode is 'edit' and the
  // Cert + Coaching cards still render so the operator sees what they'll be
  // able to add once the profile saves.
  renderUnified(staffId, profileMode) {
    profileMode = profileMode || 'view';
    const isNew = !staffId;
    const s = isNew ? null : this.staffById(staffId);
    if (!isNew && !s) { this.renderList(); return; }

    this.detailId = staffId || null;
    this.profileMode = profileMode;
    this.actions.innerHTML = '';
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-ghost btn-sm';
    exportBtn.textContent = 'Export PDF';
    exportBtn.addEventListener('click', () => window.print());
    this.actions.appendChild(exportBtn);

    const profileCard = (profileMode === 'edit')
      ? this.renderProfileEditCard(s, isNew)
      : this.renderProfileViewCard(s);
    const certsCard = this.renderCertsCard(staffId, isNew);
    const notesCard = this.renderNotesCard(staffId, isNew);

    this.container.innerHTML = '<div class="screen">' + profileCard + certsCard + notesCard + '</div>';
    this.wireUnified(staffId, profileMode);
  },

  // Backwards-compat alias for any caller that still references renderDetail.
  renderDetail(staffId) { this.renderUnified(staffId, 'view'); },

  renderProfileViewCard(s) {
    const pos = this.positionById(s.position_id);
    return '<div class="card">'
      + '<div class="card-title">' + esc(s.name || '-') + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:20px;font-size:13px;color:var(--t2);">'
      + this._kv('Position', pos ? pos.name : '-')
      + this._kv('Department', pos ? (pos.department || '-') : '-')
      + this._kv('Wage', s.wage != null ? App.fmtCurrency(s.wage) + '/hr' : '-')
      + this._kv('Status', s.status || 'Active')
      + this._kv('Hire Date', this.fmtDate(s.hire_date))
      + this._kv('Phone', s.phone || '-')
      + this._kv('Email', s.email || '-')
      + '</div>'
      + (s.notes ? '<div style="margin-top:12px;font-size:12px;color:var(--t3);line-height:1.6;"><strong style="color:var(--t2);">Notes:</strong> ' + esc(s.notes) + '</div>' : '')
      + '<div class="card-actions">'
        + '<button class="btn btn-primary btn-sm sr-edit-profile">Edit Profile</button>'
        + '<button class="btn btn-ghost btn-sm sr-back">&laquo; Back to Roster</button>'
      + '</div></div>';
  },

  renderProfileEditCard(s, isNew) {
    const positions = this.positions();
    const posOpts = positions.map(p =>
      '<option value="' + p.id + '"' + (s && s.position_id === p.id ? ' selected' : '') + '>'
      + esc(p.name) + ', ' + esc(p.department || '') + '</option>').join('');
    const defaultPos = s ? this.positionById(s.position_id) : positions[0];
    const v = val => (val != null && val !== '') ? val : '';
    const wage = s ? s.wage : (defaultPos ? defaultPos.default_wage : null);

    return '<div class="card"><div class="card-title">' + (isNew ? 'Add Staff Member' : 'Edit Profile') + '</div>'
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
      + '<button class="btn btn-primary" id="sr-save">' + (isNew ? 'Save Staff' : 'Update Profile') + '</button>'
      + '<button class="btn btn-ghost" id="sr-cancel">Cancel</button>'
      + '<span id="sr-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
  },

  _kv(label, val) {
    return '<div style="min-width:160px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:2px;">' + esc(label) + '</div>'
      + '<div style="font-size:13px;color:var(--t1);">' + esc(val) + '</div>'
      + '</div>';
  },

  wireUnified(staffId, profileMode) {
    this.container.onclick = null;
    // Profile card buttons
    this.container.querySelector('.sr-back')?.addEventListener('click', () => { this.detailId = null; this.renderList(); });
    this.container.querySelector('.sr-edit-profile')?.addEventListener('click', () => this.renderUnified(staffId, 'edit'));
    this.container.querySelector('#sr-pos')?.addEventListener('change', e => {
      const p = this.positionById(e.target.value);
      const wEl = document.getElementById('sr-wage');
      if (p && wEl) wEl.value = p.default_wage != null ? p.default_wage : '';
    });
    this.container.querySelector('#sr-cancel')?.addEventListener('click', () => {
      if (staffId) this.renderUnified(staffId, 'view');
      else { this.detailId = null; this.renderList(); }
    });
    this.container.querySelector('#sr-save')?.addEventListener('click', () => this.saveProfile(staffId));
    // Certs (active only on existing staff records)
    this.container.querySelector('#cert-add')?.addEventListener('click', () => { this.certEditId = null; this.renderCertForm(staffId); });
    this.container.querySelectorAll('.cert-edit').forEach(b => b.addEventListener('click', () => { this.certEditId = b.dataset.id; this.renderCertForm(staffId); }));
    this.container.querySelectorAll('.cert-del').forEach(b => b.addEventListener('click', () => this.confirmDelCert(b.dataset.id, staffId)));
    // Notes (active only on existing staff records)
    this.container.querySelector('#note-add')?.addEventListener('click', () => { this.noteEditId = null; this.renderNoteForm(staffId); });
    this.container.querySelectorAll('.note-edit').forEach(b => b.addEventListener('click', () => { this.noteEditId = b.dataset.id; this.renderNoteForm(staffId); }));
    this.container.querySelectorAll('.note-del').forEach(b => b.addEventListener('click', () => this.confirmDelNote(b.dataset.id, staffId)));
    this.container.querySelector('#note-filter')?.addEventListener('change', e => {
      this.noteFilterCategory = e.target.value || '';
      this.renderUnified(staffId, profileMode);
    });
  },

  // ── Certifications card + form ───────────────────────────────────────
  renderCertsCard(staffId, isNew) {
    if (isNew) {
      return '<div class="card"><div class="card-title">Certifications &amp; Licenses</div>'
        + '<div style="font-size:12px;color:var(--t3);">Save the profile above first. Once the staff record exists you can add TABC, food handler, RBS, ServSafe, and any other certs with expiration dates here. Bar Cop flags any expiring within 30 days on the dashboard.</div>'
        + '<div style="margin-top:10px;"><button class="btn btn-ghost btn-sm" disabled style="opacity:0.5;cursor:not-allowed;">+ Add Certification</button></div>'
        + '</div>';
    }
    const list = this.certsForStaff(staffId);
    let body;
    if (list.length === 0) {
      body = '<div style="font-size:12px;color:var(--t3);">No certifications on file yet. Add cert types, expiration dates, and Bar Cop will flag any expiring within 30 days on the dashboard.</div>';
    } else {
      const rows = list.map(c => {
        const status = this.certStatus(c);
        const badge = status === 'expired' ? '<span class="badge badge-warn">Expired</span>'
                   : status === 'expiring' ? '<span class="badge badge-warn">Expiring Soon</span>'
                   : '<span class="badge badge-ok">Active</span>';
        return '<tr>'
          + '<td><div class="val">' + esc(c.cert_type || '-') + '</div>'
          + (c.cert_number ? '<div style="font-size:10px;color:var(--t3);">#' + esc(c.cert_number) + '</div>' : '') + '</td>'
          + '<td>' + esc(c.issuer || '-') + '</td>'
          + '<td>' + this.fmtDate(c.issue_date) + '</td>'
          + '<td>' + this.fmtDate(c.expiration_date) + '</td>'
          + '<td>' + badge + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm cert-edit" data-id="' + c.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm cert-del" data-id="' + c.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      body = '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Certification</th><th>Issuer</th><th>Issued</th><th>Expires</th><th>Status</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    return '<div class="card"><div class="card-title">Certifications &amp; Licenses</div>'
      + body
      + '<div style="margin-top:10px;"><button class="btn btn-ghost btn-sm" id="cert-add">+ Add Certification</button></div>'
      + '</div>';
  },

  renderCertForm(staffId) {
    const c = this.certEditId ? this.certs().find(x => x.id === this.certEditId) : null;
    const typeOpts = this.CERT_TYPES.map(t =>
      '<option' + (c && c.cert_type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (this.certEditId ? 'Edit Certification' : 'Add Certification') + '</div>'
      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:220px;flex-shrink:0;"><label>Certification Type</label>'
          + '<select id="cert-type">' + typeOpts + '</select></div>'
        + '<div class="f" style="width:180px;flex-shrink:0;"><label>Cert Number <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
          + '<input type="text" id="cert-number" value="' + esc(c?.cert_number || '') + '" placeholder="Optional"/></div>'
        + '<div class="f" style="width:200px;flex-shrink:0;"><label>Issuer <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
          + '<input type="text" id="cert-issuer" value="' + esc(c?.issuer || '') + '" placeholder="State, school, etc."/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Issue Date</label>'
          + '<input type="date" id="cert-issued" value="' + esc(c?.issue_date || '') + '"/></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Expiration Date</label>'
          + '<input type="date" id="cert-expires" value="' + esc(c?.expiration_date || '') + '"/></div>'
      + '</div>'
      + '<div class="f" style="margin-top:6px;margin-bottom:0;"><label>Notes</label>'
        + '<textarea id="cert-notes" rows="2" placeholder="Optional context">' + esc(c?.notes || '') + '</textarea></div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="cert-save">' + (this.certEditId ? 'Update' : 'Save Certification') + '</button>'
        + '<button class="btn btn-ghost" id="cert-cancel">Cancel</button>'
        + '<span id="cert-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('cert-cancel')?.addEventListener('click', () => this.renderDetail(staffId));
    document.getElementById('cert-save')?.addEventListener('click', () => this.saveCert(staffId));
  },

  async saveCert(staffId) {
    const err = document.getElementById('cert-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const cert_type = document.getElementById('cert-type')?.value;
    if (!cert_type) { fail('Pick a certification type.'); return; }
    const expiration_date = document.getElementById('cert-expires')?.value;
    if (!expiration_date) { fail('Expiration date is required so Bar Cop can flag it before it lapses.'); return; }

    const rec = {
      id:              this.certEditId || App.uid(),
      staff_id:        staffId,
      cert_type,
      cert_number:     document.getElementById('cert-number')?.value.trim() || '',
      issuer:          document.getElementById('cert-issuer')?.value.trim() || '',
      issue_date:      document.getElementById('cert-issued')?.value || '',
      expiration_date,
      notes:           document.getElementById('cert-notes')?.value.trim() || '',
      updated_at:      new Date().toISOString()
    };
    if (!this.certEditId) rec.created_at = new Date().toISOString();

    const list = this.certs();
    if (this.certEditId) {
      const i = list.findIndex(x => x.id === this.certEditId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }
    const ok = await App.saveLabor();
    this.certEditId = null;
    if (ok) this.renderDetail(staffId);
    else fail('Save failed. Try again.');
  },

  async confirmDelCert(id, staffId) {
    const ok = await App.confirm({ title: 'Delete this certification?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;
    App.laborData.lc_certs = this.certs().filter(x => x.id !== id);
    await App.saveLabor();
    this.renderDetail(staffId);
  },

  // ── Coaching / notes card + form ─────────────────────────────────────
  renderNotesCard(staffId, isNew) {
    if (isNew) {
      return '<div class="card"><div class="card-title">Coaching Log</div>'
        + '<div style="font-size:12px;color:var(--t3);">Save the profile above first. Once the staff record exists you can log praise, coaching moments, concerns, and warnings here. A written record is what protects the operator if a tough HR moment ever lands.</div>'
        + '<div style="margin-top:10px;"><button class="btn btn-ghost btn-sm" disabled style="opacity:0.5;cursor:not-allowed;">+ Add Note</button></div>'
        + '</div>';
    }
    const all = this.notesForStaff(staffId);
    const list = this.noteFilterCategory ? all.filter(n => n.category === this.noteFilterCategory) : all;
    const filterOpts = '<option value="">All categories</option>'
      + this.NOTE_CATEGORIES.map(c => '<option value="' + esc(c) + '"' + (this.noteFilterCategory === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');

    let body;
    if (all.length === 0) {
      body = '<div style="font-size:12px;color:var(--t3);">No coaching notes on file yet. Document praise, coaching moments, concerns, and warnings here. A written record is what protects the operator if a tough HR moment ever lands.</div>';
    } else if (list.length === 0) {
      body = '<div style="font-size:12px;color:var(--t3);">No notes match this category. Clear the filter to see everything.</div>';
    } else {
      const rows = list.map(n => {
        const catColor = n.category === 'Praise' ? 'var(--gold)'
                       : n.category === 'Coaching' ? 'var(--blue)'
                       : n.category === 'Concern' ? 'var(--gold)'
                       : 'var(--red)';
        return '<div style="padding:14px;border:1px solid var(--b2);border-radius:4px;margin-bottom:8px;">'
          + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:6px;">'
            + '<div style="display:flex;align-items:center;gap:10px;">'
              + '<span style="font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:' + catColor + ';border:1px solid ' + catColor + ';border-radius:3px;padding:2px 6px;">' + esc(n.category || 'Note') + '</span>'
              + '<span style="font-size:12px;color:var(--t2);">' + this.fmtDate(n.date) + '</span>'
              + (n.manager_name ? '<span style="font-size:11px;color:var(--t3);">by ' + esc(n.manager_name) + '</span>' : '')
            + '</div>'
            + '<div class="row-actions">'
              + '<button class="btn btn-ghost btn-sm note-edit" data-id="' + n.id + '">Edit</button>'
              + '<button class="btn btn-danger btn-sm note-del" data-id="' + n.id + '">Delete</button>'
            + '</div>'
          + '</div>'
          + '<div style="font-size:13px;color:var(--t1);line-height:1.6;white-space:pre-wrap;">' + esc(n.text || '') + '</div>'
          + '</div>';
      }).join('');
      body = rows;
    }

    return '<div class="card"><div class="card-title">Coaching Log</div>'
      + '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;flex-wrap:wrap;">'
        + '<div class="f" style="width:200px;flex-shrink:0;margin-bottom:0;"><label>Filter by Category</label>'
          + '<select id="note-filter">' + filterOpts + '</select></div>'
      + '</div>'
      + body
      + '<div style="margin-top:10px;"><button class="btn btn-ghost btn-sm" id="note-add">+ Add Note</button></div>'
      + '</div>';
  },

  renderNoteForm(staffId) {
    const n = this.noteEditId ? this.notes().find(x => x.id === this.noteEditId) : null;
    const today = new Date().toISOString().slice(0, 10);
    const catOpts = this.NOTE_CATEGORIES.map(c =>
      '<option' + (n && n.category === c ? ' selected' : (!n && c === 'Coaching' ? ' selected' : '')) + '>' + esc(c) + '</option>').join('');

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (this.noteEditId ? 'Edit Note' : 'Add Coaching Note') + '</div>'
      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Date</label>'
          + '<input type="date" id="note-date" value="' + esc(n?.date || today) + '"/></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Category</label>'
          + '<select id="note-cat">' + catOpts + '</select></div>'
        + '<div class="f" style="width:220px;flex-shrink:0;"><label>Manager</label>'
          + '<select id="note-mgr">' + App.staffOptions(n?.manager_id || App.activeManagerId(), { placeholder: 'Select manager...' }) + '</select></div>'
      + '</div>'
      + '<div class="f" style="margin-top:6px;margin-bottom:0;"><label>Note</label>'
        + '<textarea id="note-text" rows="5" placeholder="What happened, when, who was around, what was said. Specifics matter if this becomes a personnel matter later.">' + esc(n?.text || '') + '</textarea></div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="note-save">' + (this.noteEditId ? 'Update Note' : 'Save Note') + '</button>'
        + '<button class="btn btn-ghost" id="note-cancel">Cancel</button>'
        + '<span id="note-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('note-cancel')?.addEventListener('click', () => this.renderDetail(staffId));
    document.getElementById('note-save')?.addEventListener('click', () => this.saveNote(staffId));
  },

  async saveNote(staffId) {
    const err = document.getElementById('note-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const text = document.getElementById('note-text')?.value.trim();
    if (!text) { fail('Write the note before saving.'); return; }
    const managerId = document.getElementById('note-mgr')?.value || '';
    const managerName = (this.staffById(managerId) || {}).name || '';

    const rec = {
      id:           this.noteEditId || App.uid(),
      staff_id:     staffId,
      date:         document.getElementById('note-date')?.value || new Date().toISOString().slice(0, 10),
      category:     document.getElementById('note-cat')?.value || 'Coaching',
      manager_id:   managerId,
      manager_name: managerName,
      text,
      updated_at:   new Date().toISOString()
    };
    if (!this.noteEditId) rec.created_at = new Date().toISOString();

    const list = this.notes();
    if (this.noteEditId) {
      const i = list.findIndex(x => x.id === this.noteEditId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }
    const ok = await App.saveLabor();
    this.noteEditId = null;
    if (ok) this.renderDetail(staffId);
    else fail('Save failed. Try again.');
  },

  async confirmDelNote(id, staffId) {
    const ok = await App.confirm({ title: 'Delete this note?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;
    App.laborData.lc_staff_notes = this.notes().filter(x => x.id !== id);
    await App.saveLabor();
    this.renderDetail(staffId);
  },

  // Profile save — feeds the unified page's Save Staff / Update Profile button.
  // Existing staff: lands back on the same page in 'view' mode. New staff:
  // creates the record and lands on the same page (now with a staffId) in
  // 'view' mode, with the Cert + Coaching cards now actionable.
  async saveProfile(staffId) {
    const err = document.getElementById('sr-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const name = document.getElementById('sr-name')?.value.trim();
    if (!name) { fail('Name is required.'); return; }
    const posId = document.getElementById('sr-pos')?.value;
    if (!posId) { fail('Choose a position.'); return; }
    const wage = parseFloat(document.getElementById('sr-wage')?.value);
    const newWage = isNaN(wage) ? null : wage;

    // Phase 5: maintain wage_history. When the wage changes on an existing
    // staff member, append a row to wage_history with the prior wage and the
    // effective date of the new wage. App.wageForStaffOn(staffId, date) reads
    // this history so past-dated entries cost out at the wage in effect on
    // that date, not the current rate.
    const existing = staffId ? this.staff().find(x => x.id === staffId) : null;
    const today = new Date().toISOString().slice(0, 10);
    let wageHistory = Array.isArray(existing?.wage_history) ? existing.wage_history.slice() : [];
    if (existing && existing.wage != null && newWage != null && existing.wage !== newWage) {
      wageHistory.push({
        prior_wage:     existing.wage,
        new_wage:       newWage,
        effective_date: today,
        changed_at:     new Date().toISOString()
      });
    }

    const rec = {
      id:           staffId || App.uid(),
      name,
      position_id:  posId,
      wage:         newWage,
      wage_history: wageHistory,
      status:       document.getElementById('sr-status')?.value || 'Active',
      hire_date:    document.getElementById('sr-hire')?.value || '',
      phone:        document.getElementById('sr-phone')?.value.trim() || '',
      email:        document.getElementById('sr-email')?.value.trim() || '',
      notes:        document.getElementById('sr-notes')?.value.trim() || ''
    };
    if (!staffId) rec.created_at = new Date().toISOString();

    const list = this.staff();
    if (staffId) {
      const i = list.findIndex(x => x.id === staffId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('sr-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveLabor();
    const savedId = rec.id;
    if (ok) {
      App.markSetupDone('gs_lc_roster');
      this.renderUnified(savedId, 'view');
    } else {
      if (btn) { btn.disabled = false; btn.textContent = staffId ? 'Update Profile' : 'Save Staff'; }
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
