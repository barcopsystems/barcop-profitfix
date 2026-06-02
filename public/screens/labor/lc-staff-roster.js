'use strict';

/* ── Labor Control — Staff Roster (writes lc_staff) ───────────────────────────
   The team roster — each staff member, their position, wage, and status. Wage
   defaults from the position but is editable per person. The roster is the
   source for scheduling, hours, tips, and (per Rule 20) Revenue Recovery's
   server list. Stored in App.laborData (lc_data, Rule 21).

   Landing = inline Add Staff form (profile only) + the roster list. Clicking a
   staff member opens their page: an editable profile plus Certifications and
   the Coaching Log (those two live only on the staff page). */

S.LaborStaffRoster = {
  detailId: null,
  certEditId: null,
  noteEditId: null,
  noteFilterCategory: '',
  _pendingDelId: null,

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
  positions() { return ((App.laborData && App.laborData.lc_positions) || []); },
  positionById(id) { return this.positions().find(p => p.id === id); },

  certs() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_certs)) App.laborData.lc_certs = [];
    return App.laborData.lc_certs;
  },
  certsForStaff(staffId) {
    return this.certs().filter(c => c.staff_id === staffId).slice()
      .sort((a, b) => (a.expiration_date || '').localeCompare(b.expiration_date || ''));
  },
  certStatus(cert) {
    if (!cert || !cert.expiration_date) return 'ok';
    const today = new Date().toISOString().slice(0, 10);
    if (cert.expiration_date < today) return 'expired';
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 30);
    if (cert.expiration_date <= cutoff.toISOString().slice(0, 10)) return 'expiring';
    return 'ok';
  },
  // Roster-row rollup across all of a staff member's certs: any expired wins,
  // else any expiring, else current; 'none' when nothing is on file.
  certRollup(staffId) {
    const list = this.certsForStaff(staffId);
    if (list.length === 0) return 'none';
    let worst = 'ok';
    for (const c of list) {
      const st = this.certStatus(c);
      if (st === 'expired') return 'expired';
      if (st === 'expiring') worst = 'expiring';
    }
    return worst;
  },

  notes() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_staff_notes)) App.laborData.lc_staff_notes = [];
    return App.laborData.lc_staff_notes;
  },
  notesForStaff(staffId) {
    return this.notes().filter(n => n.staff_id === staffId).slice()
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
    // Cross-system focus: Server Scorecard "+ Coaching Note" sets
    // App._coachingFocus = { staff_id } and navigates here. Open the staff page
    // and pre-pop the note form so the manager writes it in one click.
    if (App._coachingFocus && App._coachingFocus.staff_id) {
      const sid = App._coachingFocus.staff_id;
      App._coachingFocus = null;
      this.detailId = sid;
      this.renderUnified(sid);
      this.noteEditId = null;
      this.renderNoteForm(sid);
      return;
    }
    this.renderList();
  },

  // The seven profile cells shared by the inline add form and the edit profile
  // form so they never drift. First row (Name, Position, Wage, Status, Hire Date)
  // grows to span the form; Phone and Email sit on a second row.
  profileFormCells(s) {
    const positions = this.positions();
    const posOpts = positions.map(p =>
      '<option value="' + p.id + '"' + (s && s.position_id === p.id ? ' selected' : '') + '>'
      + esc(p.name) + ', ' + esc(p.department || '') + '</option>').join('');
    const defaultPos = s ? this.positionById(s.position_id) : positions[0];
    const wage = s ? s.wage : (defaultPos ? defaultPos.default_wage : null);
    const wv = (wage != null && wage !== '') ? wage : '';
    return '<div class="form-row" style="gap:12px;flex-wrap:nowrap;">'
      + '<div class="f" style="flex:1 1 150px;min-width:0;"><label>Name</label>'
      + '<input type="text" id="sr-name" value="' + esc(s?.name || '') + '" placeholder="Full name"/></div>'
      + '<div class="f" style="flex:1 1 175px;min-width:0;"><label>Position</label>'
      + '<select id="sr-pos">' + posOpts + '</select></div>'
      + '<div class="f" style="flex:1 1 84px;min-width:0;"><label>Wage</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="sr-wage" min="0" step="0.01" '
      + 'value="' + wv + '" placeholder="0.00"/></div></div>'
      + '<div class="f" style="flex:1 1 92px;min-width:0;"><label>Status</label><select id="sr-status">'
      + '<option' + (!s || s.status !== 'Inactive' ? ' selected' : '') + '>Active</option>'
      + '<option' + (s && s.status === 'Inactive' ? ' selected' : '') + '>Inactive</option></select></div>'
      + '<div class="f" style="flex:1 1 140px;min-width:0;"><label>Hire Date</label>'
      + '<input type="date" id="sr-hire" value="' + esc(s?.hire_date || '') + '"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:12px;flex-wrap:nowrap;">'
      + '<div class="f" style="width:100px;min-width:0;"><label>Phone</label>'
      + '<input type="text" id="sr-phone" value="' + esc(s?.phone || '') + '" placeholder="Optional"/></div>'
      + '<div class="f" style="width:128px;min-width:0;"><label>Email</label>'
      + '<input type="text" id="sr-email" value="' + esc(s?.email || '') + '" placeholder="Optional"/></div>'
      + '</div>';
  },

  renderList() {
    this.detailId = null;
    this.actions.innerHTML = '';

    if (this.positions().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Add positions first</div>'
        + '<div class="empty-sub">Each staff member is assigned a position. Set up your positions, then '
        + 'build the roster.</div>'
        + '<button class="btn btn-primary" id="sr-go-positions">Go to Positions</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#sr-go-positions')) App.navigate('lc-positions'); };
      return;
    }

    const addForm = '<div class="card">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Add Staff Member</span>'
      + '<button class="btn btn-ghost btn-sm" id="sr-how">How This Works</button></div>'
      + this.profileFormCells(null)
      + '<div class="form-row" style="gap:16px;margin-bottom:0;"><div class="f" style="width:100%;">'
      + '<label>Notes</label><textarea id="sr-notes" rows="2" placeholder="Optional"></textarea></div></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="sr-save">Add Staff</button>'
      + '<span id="sr-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';

    const list = [...this.staff()].sort((a, b) => {
      if ((a.status === 'Inactive') !== (b.status === 'Inactive')) return a.status === 'Inactive' ? 1 : -1;
      return (a.name || '').localeCompare(b.name || '');
    });

    let listCard;
    if (list.length === 0) {
      listCard = '<div class="card"><div class="card-title">Roster</div>'
        + '<div style="font-size:13px;color:var(--t3);">No staff yet. Add your first team member above. The roster '
        + 'feeds scheduling, hours, tips, and the Revenue Recovery server list.</div></div>';
    } else {
      const rows = list.map(s => {
        const pos = this.positionById(s.position_id);
        const roll = this.certRollup(s.id);
        const certCell = roll === 'expired'  ? '<span style="color:var(--red);font-weight:700;">Expired</span>'
                       : roll === 'expiring' ? '<span style="color:var(--amber);font-weight:700;">Expiring</span>'
                       : roll === 'ok'       ? '<span style="color:var(--blue);font-weight:700;">Current</span>'
                       : '<span style="color:var(--t3);">&mdash;</span>';
        return '<tr class="sr-row" data-id="' + s.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + esc(s.name || '-') + '</div></td>'
          + '<td>' + esc(pos ? pos.name : '-') + '</td>'
          + '<td>' + esc(pos ? (pos.department || '-') : '-') + '</td>'
          + '<td class="val">' + (s.wage != null ? App.fmtCurrency(s.wage) + '/hr' : '-') + '</td>'
          + '<td>' + (s.status === 'Inactive'
              ? '<span style="color:var(--t3);font-weight:700;">Inactive</span>'
              : '<span style="color:var(--gold);font-weight:700;">Active</span>') + '</td>'
          + '<td>' + certCell + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm sr-edit" data-id="' + s.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm sr-del" data-id="' + s.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      listCard = '<div class="card"><div class="card-title">Roster</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Name</th><th>Position</th><th>Department</th><th>Wage</th><th>Status</th><th>Certs</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    const modal = '<div id="sr-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this staff member?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="sr-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="sr-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + addForm + listCard + '</div>' + modal;
    this.container.onclick = ev => {
      if (ev.target.closest('#sr-how'))  { this.showHowTo(); return; }
      if (ev.target.closest('#sr-save')) { this.saveProfile(null); return; }
      const edit = ev.target.closest('.sr-edit');
      const del = ev.target.closest('.sr-del');
      const row = ev.target.closest('.sr-row');
      if (del)        { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit)  { ev.stopPropagation(); this.renderUnified(edit.dataset.id); }
      else if (row)   this.renderUnified(row.dataset.id);
    };
    document.getElementById('sr-pos')?.addEventListener('change', e => {
      const p = this.positionById(e.target.value);
      const wEl = document.getElementById('sr-wage');
      if (p && wEl && !wEl.value) wEl.value = p.default_wage != null ? p.default_wage : '';
    });
  },

  showHowTo() {
    App.showHelpModal('How the Staff Roster Works', [
      { p: ['The roster is your team: every staff member, their position, wage, and status. It is the source for scheduling, hours, tips, and the Revenue Recovery server list, so getting it right here means it is right everywhere.'] },
      { h: 'Adding Someone', p: ['Fill the row at the top and click Add Staff. The position sets the default wage, which you can override per person. Wage changes are tracked with history, so past hours always cost out at the wage in effect on that day, not today\'s rate.'] },
      { h: 'Certifications and Coaching', p: ['Click any staff member to open their page. That is where you add certifications (TABC, food handler, ServSafe, and the rest, with expiration dates Bar Cop flags before they lapse) and the coaching log (praise, coaching, concern, and warning notes that protect you if a tough HR moment ever lands).'] },
      { h: 'Active or Inactive', p: ['Set a staff member Inactive when they leave instead of deleting them, so their past hours, tips, and records stay intact. Inactive staff drop off the schedule and tip pickers but keep their history.'] }
    ]);
  },

  // ── Staff page — editable profile + Certifications + Coaching Log ──────────
  renderUnified(staffId) {
    const s = this.staffById(staffId);
    if (!s) { this.renderList(); return; }
    this.detailId = staffId;
    this.actions.innerHTML = '';

    this.container.innerHTML = '<div class="screen">'
      + this.renderProfileEditCard(s)
      + this.renderCertsCard(staffId)
      + this.renderNotesCard(staffId)
      + '</div>';
    this.wireUnified(staffId);
  },
  // Backwards-compat alias for callers that still reference renderDetail.
  renderDetail(staffId) { this.renderUnified(staffId); },

  renderProfileEditCard(s) {
    return '<div class="card"><div class="card-title">Edit ' + esc(s.name || 'Profile') + '</div>'
      + this.profileFormCells(s)
      + '<div class="form-row" style="gap:16px;margin-bottom:0;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="sr-notes" rows="2" placeholder="Optional">' + esc(s?.notes || '') + '</textarea></div></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="sr-save">Update Profile</button>'
      + '<button class="btn btn-ghost" id="sr-cancel">Cancel</button>'
      + '<span id="sr-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
  },

  wireUnified(staffId) {
    this.container.onclick = null;
    document.getElementById('sr-pos')?.addEventListener('change', e => {
      const p = this.positionById(e.target.value);
      const wEl = document.getElementById('sr-wage');
      if (p && wEl) wEl.value = p.default_wage != null ? p.default_wage : '';
    });
    document.getElementById('sr-cancel')?.addEventListener('click', () => { this.detailId = null; this.renderList(); });
    document.getElementById('sr-save')?.addEventListener('click', () => this.saveProfile(staffId));
    // Certifications
    document.getElementById('cert-add')?.addEventListener('click', () => { this.certEditId = null; this.renderCertForm(staffId); });
    this.container.querySelectorAll('.cert-edit').forEach(b => b.addEventListener('click', () => { this.certEditId = b.dataset.id; this.renderCertForm(staffId); }));
    this.container.querySelectorAll('.cert-del').forEach(b => b.addEventListener('click', () => this.confirmDelCert(b.dataset.id, staffId)));
    // Coaching notes
    document.getElementById('note-add')?.addEventListener('click', () => { this.noteEditId = null; this.renderNoteForm(staffId); });
    this.container.querySelectorAll('.note-edit').forEach(b => b.addEventListener('click', () => { this.noteEditId = b.dataset.id; this.renderNoteForm(staffId); }));
    this.container.querySelectorAll('.note-del').forEach(b => b.addEventListener('click', () => this.confirmDelNote(b.dataset.id, staffId)));
    document.getElementById('note-filter')?.addEventListener('change', e => {
      this.noteFilterCategory = e.target.value || '';
      this.renderUnified(staffId);
    });
  },

  // ── Certifications card + form ───────────────────────────────────────
  renderCertsCard(staffId) {
    const list = this.certsForStaff(staffId);
    let body;
    if (list.length === 0) {
      body = '<div style="font-size:12px;color:var(--t3);">No certifications on file yet. Add cert types, expiration dates, and Bar Cop will flag any expiring within 30 days on the dashboard.</div>';
    } else {
      const rows = list.map(c => {
        const status = this.certStatus(c);
        const badge = status === 'expired' ? '<span style="color:var(--red);font-weight:700;">Expired</span>'
                   : status === 'expiring' ? '<span style="color:var(--amber);font-weight:700;">Expiring</span>'
                   : '<span style="color:var(--blue);font-weight:700;">Current</span>';
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
      + '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
        + '<div class="f" style="width:190px;flex-shrink:0;"><label>Certification Type</label>'
          + '<select id="cert-type">' + typeOpts + '</select></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>Cert Number <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
          + '<input type="text" id="cert-number" value="' + esc(c?.cert_number || '') + '" placeholder="Optional"/></div>'
        + '<div class="f" style="width:170px;flex-shrink:0;"><label>Issuer <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
          + '<input type="text" id="cert-issuer" value="' + esc(c?.issuer || '') + '" placeholder="State, school, etc."/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>Issue Date</label>'
          + '<input type="date" id="cert-issued" value="' + esc(c?.issue_date || '') + '"/></div>'
        + '<div class="f" style="width:150px;flex-shrink:0;"><label>Expiration Date</label>'
          + '<input type="date" id="cert-expires" value="' + esc(c?.expiration_date || '') + '"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;"><div class="f" style="width:100%;"><label>Notes</label>'
        + '<textarea id="cert-notes" rows="2" placeholder="Optional context">' + esc(c?.notes || '') + '</textarea></div></div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="cert-save">' + (this.certEditId ? 'Update' : 'Save Certification') + '</button>'
        + '<button class="btn btn-ghost" id="cert-cancel">Cancel</button>'
        + '<span id="cert-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('cert-cancel')?.addEventListener('click', () => this.renderUnified(staffId));
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
    if (ok) this.renderUnified(staffId);
    else fail('Save failed. Try again.');
  },

  async confirmDelCert(id, staffId) {
    const ok = await App.confirm({ title: 'Delete this certification?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;
    App.laborData.lc_certs = this.certs().filter(x => x.id !== id);
    await App.saveLabor();
    this.renderUnified(staffId);
  },

  // ── Coaching / notes card + form ─────────────────────────────────────
  renderNotesCard(staffId) {
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
                       : n.category === 'Concern' ? 'var(--amber)'
                       : 'var(--red)';
        return '<div style="padding:14px;border:1px solid var(--b2);border-radius:4px;margin-bottom:8px;">'
          + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:6px;">'
            + '<div style="display:flex;align-items:center;gap:10px;">'
              + '<span style="font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:' + catColor + ';">' + esc(n.category || 'Note') + '</span>'
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
    document.getElementById('note-cancel')?.addEventListener('click', () => this.renderUnified(staffId));
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
    if (ok) this.renderUnified(staffId);
    else fail('Save failed. Try again.');
  },

  async confirmDelNote(id, staffId) {
    const ok = await App.confirm({ title: 'Delete this note?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;
    App.laborData.lc_staff_notes = this.notes().filter(x => x.id !== id);
    await App.saveLabor();
    this.renderUnified(staffId);
  },

  // Profile save — feeds the inline Add Staff button (staffId null) and the edit
  // page's Update Profile button (staffId set). New staff lands back on the
  // roster list; an edit re-renders the staff page.
  async saveProfile(staffId) {
    const err = document.getElementById('sr-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const name = document.getElementById('sr-name')?.value.trim();
    if (!name) { fail('Name is required.'); return; }
    const posId = document.getElementById('sr-pos')?.value;
    if (!posId) { fail('Choose a position.'); return; }
    const wage = parseFloat(document.getElementById('sr-wage')?.value);
    const newWage = isNaN(wage) ? null : wage;

    // Maintain wage_history: when the wage changes on an existing staff member,
    // append a row with the prior wage and the effective date so past-dated
    // entries cost out at the wage in effect on that date.
    const existing = staffId ? this.staff().find(x => x.id === staffId) : null;
    const today = new Date().toISOString().slice(0, 10);
    let wageHistory = Array.isArray(existing?.wage_history) ? existing.wage_history.slice() : [];
    if (existing && existing.wage != null && newWage != null && existing.wage !== newWage) {
      wageHistory.push({ prior_wage: existing.wage, new_wage: newWage, effective_date: today, changed_at: new Date().toISOString() });
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
    if (ok) {
      App.markSetupDone('gs_lc_roster');
      if (staffId) this.renderUnified(staffId);
      else { this.detailId = null; this.renderList(); }
    } else {
      if (btn) { btn.disabled = false; btn.textContent = staffId ? 'Update Profile' : 'Add Staff'; }
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
