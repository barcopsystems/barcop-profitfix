'use strict';

/* ── Labor Control — Staff Roster (writes lc_staff) ───────────────────────────
   The team roster — each staff member, their position, wage, and status. Wage
   defaults from the position but is editable per person. The roster is the
   source for scheduling, hours, tips, and (per Rule 20) Revenue Recovery's
   server list. Stored in App.laborData (lc_data, Rule 21).

   Landing = one Add Staff card with an Enter Manually / Import File toggle, then
   the roster list. Clicking a staff member opens their page: an editable profile
   plus Certifications and the Coaching Log (each added/edited in a pop-up). */

S.LaborStaffRoster = {
  detailId: null,
  certEditId: null,
  noteEditId: null,
  entryMode: 'manual',     // landing card: type a profile vs import a staff file

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
    const today = App.todayLocal();
    if (cert.expiration_date < today) return 'expired';
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 30);
    if (cert.expiration_date <= App.ymdLocal(cutoff)) return 'expiring';
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
    // and pop the note form so the manager writes it in one click.
    if (App._coachingFocus && App._coachingFocus.staff_id) {
      const sid = App._coachingFocus.staff_id;
      App._coachingFocus = null;
      this.detailId = sid;
      this.renderUnified(sid);
      this.noteEditId = null;
      this.openNoteModal(sid);
      return;
    }
    this.renderList();
  },

  // The profile cells shared by the inline add form and the edit profile form
  // so they never drift. One data row (Name, Position, Pay Type, Wage/Salary,
  // Status) plus a second row (Phone, Email, Shift Lead). Pay Type swaps the pay
  // field between an hourly Wage and an Annual Salary; salaried = exempt.
  profileFormCells(s) {
    const positions = this.positions();
    const deptShort = { 'Management': 'Mgmt', 'Front of House': 'FOH' };
    const posLabel = p => (p.name || '').replace(/\bAssistant\b/gi, 'Asst.') + ', ' + (deptShort[p.department] || p.department || '');
    const posOpts = positions.map(p =>
      '<option value="' + p.id + '"' + (s && s.position_id === p.id ? ' selected' : '') + '>'
      + esc(posLabel(p)) + '</option>').join('');
    const defaultPos = s ? this.positionById(s.position_id) : positions[0];
    const isSal = !!(s && s.pay_type === 'Salary');
    const hourly = s ? s.wage : (defaultPos ? defaultPos.default_wage : null);
    const payVal = isSal
      ? ((s && s.annual_salary != null && s.annual_salary !== '') ? s.annual_salary : '')
      : ((hourly != null && hourly !== '') ? hourly : '');
    return '<div class="form-row data-row" style="gap:12px;">'
      + '<div class="f" style="flex:1 1 140px;min-width:0;"><label>Name</label>'
      + '<input type="text" id="sr-name" value="' + esc(s?.name || '') + '" placeholder="Full name"/></div>'
      + '<div class="f" style="flex:1 1 150px;min-width:0;"><label>Position</label>'
      + '<select id="sr-pos">' + posOpts + '</select></div>'
      + '<div class="f" style="flex:1 1 92px;min-width:0;"><label>Pay Type</label><select id="sr-paytype">'
      + '<option' + (!isSal ? ' selected' : '') + '>Hourly</option>'
      + '<option' + (isSal ? ' selected' : '') + '>Salary</option></select></div>'
      + '<div class="f" style="flex:1 1 110px;min-width:0;"><label id="sr-pay-label">' + (isSal ? 'Annual Salary' : 'Wage') + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="sr-pay" min="0" step="0.01" '
      + 'value="' + payVal + '" placeholder="0.00"/></div></div>'
      + '<div class="f" style="flex:1 1 92px;min-width:0;"><label>Status</label><select id="sr-status">'
      + '<option' + (!s || s.status !== 'Inactive' ? ' selected' : '') + '>Active</option>'
      + '<option' + (s && s.status === 'Inactive' ? ' selected' : '') + '>Inactive</option></select></div>'
      + '</div>'
      // Shift Lead lives OUTSIDE a .f wrapper on purpose: the global `.f input`
      // rule forces appearance:none, which kills the native checkbox. A plain div
      // keeps the checkbox rendering normally (gold via accent-color).
      + '<div class="form-row" style="gap:12px;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Phone</label>'
      + '<input type="text" id="sr-phone" value="' + esc(s?.phone || '') + '" placeholder="Optional"/></div>'
      + '<div class="f" style="width:200px;flex-shrink:0;"><label>Email</label>'
      + '<input type="text" id="sr-email" value="' + esc(s?.email || '') + '" placeholder="Optional"/></div>'
      + '<div style="flex:1 1 220px;min-width:0;display:flex;flex-direction:column;gap:5px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);">Shift Lead</div>'
      + '<label style="display:flex;align-items:center;gap:8px;min-height:38px;font-size:12px;color:var(--t2);cursor:pointer;">'
      + '<input type="checkbox" id="sr-lead"' + (s && s.shift_lead ? ' checked' : '') + ' style="width:16px;height:16px;accent-color:var(--gold);cursor:pointer;flex-shrink:0;"/>'
      + '<span style="min-width:0;color:var(--t3);font-size:11px;line-height:1.3;overflow-wrap:anywhere;">Can run shifts and authorize like a manager, even if hourly. Management is always a supervisor.</span></label></div>'
      + '</div>';
  },

  // Wire the Pay Type + pay field for whichever profile form is mounted.
  wirePayFields(editing) {
    const posEl = document.getElementById('sr-pos');
    const payEl = document.getElementById('sr-pay');
    const typeEl = document.getElementById('sr-paytype');
    const labelEl = document.getElementById('sr-pay-label');
    if (!posEl || !payEl || !typeEl) return;
    let wageTouched = !!editing;
    payEl.addEventListener('input', () => { wageTouched = true; });
    posEl.addEventListener('change', e => {
      if (typeEl.value === 'Salary') return;
      if (wageTouched) return;
      const p = this.positionById(e.target.value);
      payEl.value = (p && p.default_wage != null) ? p.default_wage : '';
    });
    typeEl.addEventListener('change', () => {
      const sal = typeEl.value === 'Salary';
      if (labelEl) labelEl.textContent = sal ? 'Annual Salary' : 'Wage';
      payEl.value = '';
      wageTouched = false;
      if (!sal) {
        const p = this.positionById(posEl.value);
        if (p && p.default_wage != null) payEl.value = p.default_wage;
      }
    });
  },

  renderList() {
    this.detailId = null;
    this.actions.innerHTML = '';

    if (this.positions().length === 0) {
      App.setupCard(this.container, {
        title: 'Build Your Roster',
        lead: 'Each staff member is assigned a position, which sets their department and default wage. Add your positions first, then build the roster.',
        steps: [
          { title: 'Add your positions', desc: 'Set up the job roles you staff, like bartender and server, before adding people.', btn: 'Go to Positions', screen: 'lc-positions', done: false }
        ]
      });
      return;
    }

    // One card, two ways in: type a profile by hand, or drop a staff list. A
    // segmented toggle swaps the body. Same pattern as Log Hours / Tip Log.
    const segBtn = (mode, label) => {
      const on = this.entryMode === mode;
      return '<button type="button" class="btn btn-sm sr-mode" data-mode="' + mode + '" style="'
        + (on ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    };
    const modeBody = this.entryMode === 'import'
      ? '<div id="sr-csv"></div><div id="sr-imp-result"></div>'
      : this.profileFormCells(null)
        + '<div class="form-row" style="gap:16px;margin-bottom:0;"><div class="f" style="width:100%;">'
        + '<label>Notes</label><textarea id="sr-notes" class="notes-ta" rows="2" placeholder="Optional"></textarea></div></div>'
        + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="sr-save">Add Staff</button>'
        + '<span id="sr-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
        + '</div>';
    const addCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('lc-staff-roster', 'Add Staff Member', App.helpButton('sr-how'))
      + '<div class="collapse-body">'
      + '<div style="display:inline-flex;gap:6px;margin-bottom:18px;">' + segBtn('manual', 'Enter Manually') + segBtn('import', 'Import File') + '</div>'
      + modeBody
      + '</div></div>';

    const list = [...this.staff()].sort((a, b) => {
      if ((a.status === 'Inactive') !== (b.status === 'Inactive')) return a.status === 'Inactive' ? 1 : -1;
      return (a.name || '').localeCompare(b.name || '');
    });

    let below;
    if (list.length === 0) {
      below = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No staff yet. Add your first team member above, or import a staff list. The roster feeds scheduling, hours, tips, and the Revenue Recovery server list.</div>';
    } else {
      const rows = list.map(s => {
        const pos = this.positionById(s.position_id);
        const roll = this.certRollup(s.id);
        const certCell = roll === 'expired'  ? '<span style="color:var(--red);font-weight:700;">Expired</span>'
                       : roll === 'expiring' ? '<span style="color:var(--amber);font-weight:700;">Expiring</span>'
                       : roll === 'ok'       ? '<span style="color:var(--green);font-weight:700;">Current</span>'
                       : '<span style="color:var(--t3);">&mdash;</span>';
        return '<tr class="sr-row" data-id="' + s.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + esc(s.name || '-')
            + (s.shift_lead ? ' <span style="color:var(--t2);font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Lead</span>' : '') + '</div></td>'
          + '<td>' + esc(pos ? pos.name : '-') + '</td>'
          + '<td>' + esc(pos ? (pos.department || '-') : '-') + '</td>'
          + '<td class="val">' + (s.wage != null ? App.fmtCurrency(s.wage) + '/hr'
              : (App.isSalaried(s) ? App.fmtCurrency(s.annual_salary || 0) + '/yr' : '-')) + '</td>'
          + '<td>' + (s.status === 'Inactive'
              ? '<span style="color:var(--t3);font-weight:700;">Inactive</span>'
              : '<span style="color:var(--t1);font-weight:700;">Active</span>') + '</td>'
          + '<td>' + certCell + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm sr-edit" data-id="' + s.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm sr-del" data-id="' + s.id + '">Delete</button>'
          + '</div></td></tr>';
      }).join('');
      below = '<div class="sh" style="margin-top:24px;">Roster</div>'
        + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
        + '<th>Name</th><th>Position</th><th>Department</th><th>Wage</th><th>Status</th><th>Certs</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    this.container.innerHTML = '<div class="screen">' + addCard + below + '</div>';
    this.container.onclick = ev => {
      if (ev.target.closest('#sr-how'))      { this.showHowTo(); return; }
      if (ev.target.closest('.sr-imp-how'))  { this.showHowTo(); return; }
      const modeBtn = ev.target.closest('.sr-mode');
      if (modeBtn) { this.entryMode = modeBtn.dataset.mode; this.renderList(); return; }
      const head = ev.target.closest('.card-collapse-head');
      if (head) { App.toggleCollapse(head); return; }
      if (ev.target.closest('#sr-save'))     { this.saveProfile(null); return; }
      const edit = ev.target.closest('.sr-edit');
      const del = ev.target.closest('.sr-del');
      const row = ev.target.closest('.sr-row');
      if (del)        { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit)  { ev.stopPropagation(); this.renderUnified(edit.dataset.id); }
      else if (row)   this.renderUnified(row.dataset.id);
    };
    if (this.entryMode === 'import') this.mountImporter();
    else this.wirePayFields(false);
    App.applyCollapsed(this.container);
  },

  // Mount the drag-drop + column mapper into the landing's import body.
  mountImporter() {
    const el = document.getElementById('sr-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      hint: 'Drop a staff list export: <span class="sr-imp-how" style="color:var(--gold);cursor:pointer;text-decoration:underline;">How it works</span>',
      fields: [
        { key: 'name',          label: 'Name',          required: true,  match: ['name', 'employee', 'employee name', 'staff', 'full name'] },
        { key: 'position',      label: 'Position',      required: false, match: ['position', 'role', 'title', 'job', 'job title'] },
        { key: 'pay_type',      label: 'Pay Type',      required: false, match: ['pay type', 'type', 'pay'] },
        { key: 'wage',          label: 'Wage ($/hr)',   required: false, match: ['wage', 'rate', 'hourly', 'pay rate', 'hourly rate'] },
        { key: 'annual_salary', label: 'Annual Salary', required: false, match: ['salary', 'annual salary', 'annual'] },
        { key: 'status',        label: 'Status',        required: false, match: ['status', 'active'] },
        { key: 'phone',         label: 'Phone',         required: false, match: ['phone', 'mobile', 'cell', 'phone number'] },
        { key: 'email',         label: 'Email',         required: false, match: ['email', 'e-mail', 'email address'] }
      ],
      confirmLabel: 'Import Staff',
      onComplete: rows => this.importStaffRows(rows)
    });
  },

  showHowTo() {
    App.showHelpModal('How the Staff Roster Works', [
      { p: ['The roster is your team: every staff member, their position, wage, and status. It is the source for scheduling, hours, tips, and the Revenue Recovery server list, so getting it right here means it is right everywhere.'] },
      { h: 'Adding Someone', p: ['Pick Enter Manually, fill the row, and click Add Staff. The position sets the default hourly wage, which you can override per person. Wage changes are tracked with history, so past hours always cost out at the wage in effect on that day, not today\'s rate.'] },
      { h: 'Importing A Staff List', p: ['Switch to Import File and drop a CSV or Excel file. Map the columns once and Bar Cop remembers it. Only Name is required; Position, Pay Type, Wage, Annual Salary, Status, Phone, and Email are matched if your file has them, and anything missing imports blank to fill in later. Each person\'s position matches your existing positions by name (set those up first for the cleanest import); an unmatched or blank position still imports, just open the person and pick one.'] },
      { h: 'Hourly or Salaried', p: ['Set Pay Type to Salary for an exempt manager or any fixed-salary role, then enter the annual salary. Bar Cop spreads that salary evenly across the year (salary divided by 52 each week) as a fixed labor cost, and salaried staff never show overtime. You can still log their hours so they count toward coverage and revenue per labor hour, but those hours never add an hourly cost. If a salaried employee is overtime eligible (non-exempt), set them to Hourly instead. How you classify staff under wage and hour law is your call. Bar Cop is a tool, not legal or payroll advice.'] },
      { h: 'Certifications and Coaching', p: ['Click any staff member to open their page. That is where you add certifications (TABC, food handler, ServSafe, and the rest, with expiration dates Bar Cop flags before they lapse) and the coaching log (praise, coaching, concern, and warning notes that protect you if a tough HR moment ever lands).'] },
      { h: 'Active or Inactive', p: ['Set a staff member Inactive when they leave instead of deleting them, so their past hours, tips, and records stay intact. Inactive staff drop off the schedule and tip pickers but keep their history.'] }
    ]);
  },

  async importStaffRows(rows) {
    const posByName = {};
    this.positions().forEach(p => { posByName[(p.name || '').trim().toLowerCase()] = p; });
    const toAdd = [];
    (rows || []).forEach(r => {
      const name = (r.name || '').trim();
      if (!name) return;
      const pos = posByName[(r.position || '').trim().toLowerCase()] || null;
      const salaried = /salar|exempt/i.test((r.pay_type || '').trim());
      const wageNum = parseFloat(r.wage);
      const salNum = parseFloat(r.annual_salary);
      const inactive = /inactive|term/i.test((r.status || '').trim());
      toAdd.push({
        id:            App.uid(),
        name,
        position_id:   pos ? pos.id : '',
        pay_type:      salaried ? 'Salary' : 'Hourly',
        wage:          salaried ? null : (isNaN(wageNum) ? null : wageNum),
        annual_salary: salaried ? (isNaN(salNum) ? null : salNum) : null,
        wage_history:  [],
        status:        inactive ? 'Inactive' : 'Active',
        phone:         (r.phone || '').trim(),
        email:         (r.email || '').trim(),
        notes:         '',
        created_at:    new Date().toISOString()
      });
    });

    const result = document.getElementById('sr-imp-result');
    if (toAdd.length === 0) {
      if (result) result.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">No rows imported. Each row needs a Name.</div>';
      return;
    }
    this.staff().push(...toAdd);
    const ok = await App.saveLabor();
    if (ok) {
      App.markSetupDone('gs_lc_roster');
      const noPos = toAdd.filter(s => !s.position_id).length;
      this.renderList();
      const res2 = document.getElementById('sr-imp-result');
      if (res2) res2.innerHTML = '<div style="font-size:13px;color:var(--gold);font-weight:700;margin-top:12px;">Imported ' + toAdd.length + ' staff member' + (toAdd.length === 1 ? '' : 's') + '.'
        + (noPos > 0 ? ' <span style="color:var(--t3);font-weight:400;">' + noPos + ' need a position set; open them on the roster below.</span>' : '') + '</div>';
    } else {
      const ids = new Set(toAdd.map(s => s.id));
      App.laborData.lc_staff = this.staff().filter(s => !ids.has(s.id));
      if (result) result.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">Save failed. Try again.</div>';
    }
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
  renderDetail(staffId) { this.renderUnified(staffId); },

  renderProfileEditCard(s) {
    return '<div class="card form-card"><div class="card-title">Edit ' + esc(s.name || 'Profile') + '</div>'
      + this.profileFormCells(s)
      + '<div class="form-row" style="gap:16px;margin-bottom:0;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="sr-notes" class="notes-ta" rows="2" placeholder="Optional">' + esc(s?.notes || '') + '</textarea></div></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="sr-save">Update Profile</button>'
      + '<button class="btn btn-ghost" id="sr-cancel">Cancel</button>'
      + '<span id="sr-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
  },

  wireUnified(staffId) {
    this.container.onclick = null;
    this.wirePayFields(true);
    document.getElementById('sr-cancel')?.addEventListener('click', () => { this.detailId = null; this.renderList(); });
    document.getElementById('sr-save')?.addEventListener('click', () => this.saveProfile(staffId));
    // Certifications
    document.getElementById('cert-add')?.addEventListener('click', () => { this.certEditId = null; this.openCertModal(staffId); });
    this.container.querySelectorAll('.cert-edit').forEach(b => b.addEventListener('click', () => { this.certEditId = b.dataset.id; this.openCertModal(staffId); }));
    this.container.querySelectorAll('.cert-del').forEach(b => b.addEventListener('click', () => this.confirmDelCert(b.dataset.id, staffId)));
    // Coaching notes
    document.getElementById('note-add')?.addEventListener('click', () => { this.noteEditId = null; this.openNoteModal(staffId); });
    this.container.querySelectorAll('.note-edit').forEach(b => b.addEventListener('click', () => { this.noteEditId = b.dataset.id; this.openNoteModal(staffId); }));
    this.container.querySelectorAll('.note-del').forEach(b => b.addEventListener('click', () => this.confirmDelNote(b.dataset.id, staffId)));
  },

  // ── Certifications section ───────────────────────────────────────────
  renderCertsCard(staffId) {
    const list = this.certsForStaff(staffId);
    const heading = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Certifications &amp; Licenses</div>'
      + '<div class="no-print" style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" id="cert-add">+ Add Certification</button></div></div>';
    if (list.length === 0) {
      return heading + '<div style="font-size:12px;color:var(--t3);padding:4px 2px;">No certifications on file yet. Add cert types and expiration dates, and Bar Cop will flag any expiring within 30 days on the dashboard.</div>';
    }
    const rows = list.map(c => {
      const status = this.certStatus(c);
      const badge = status === 'expired' ? '<span style="color:var(--red);font-weight:700;">Expired</span>'
                 : status === 'expiring' ? '<span style="color:var(--amber);font-weight:700;">Expiring</span>'
                 : '<span style="color:var(--green);font-weight:700;">Current</span>';
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
    return heading
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Certification</th><th>Issuer</th><th>Issued</th><th>Expires</th><th>Status</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  },

  // Cert add/edit in a focused pop-up (own cert- ids; no collision with the
  // profile form behind it).
  openCertModal(staffId) {
    const c = this.certEditId ? this.certs().find(x => x.id === this.certEditId) : null;
    const typeOpts = this.CERT_TYPES.map(t =>
      '<option' + (c && c.cert_type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const html = '<div class="card form-card" style="margin:0;">'
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
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
        + '<textarea id="cert-notes" class="notes-ta" rows="2" placeholder="Optional context">' + esc(c?.notes || '') + '</textarea></div></div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="cert-save">' + (this.certEditId ? 'Update' : 'Save Certification') + '</button>'
        + '<button class="btn btn-ghost" id="cert-cancel">Cancel</button>'
        + '<span id="cert-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'cert-modal', maxWidth: 820, noClose: true });
    document.getElementById('cert-cancel')?.addEventListener('click', () => { this.certEditId = null; App.closeModal('cert-modal'); });
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
    if (ok) { App.closeModal('cert-modal'); this.renderUnified(staffId); }
    else fail('Save failed. Try again.');
  },

  async confirmDelCert(id, staffId) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    App.laborData.lc_certs = this.certs().filter(x => x.id !== id);
    await App.saveLabor();
    this.renderUnified(staffId);
  },

  // ── Coaching Log section ─────────────────────────────────────────────
  renderNotesCard(staffId) {
    const list = this.notesForStaff(staffId);

    let body;
    if (list.length === 0) {
      body = '<div style="font-size:12px;color:var(--t3);">No coaching notes on file yet. Document praise, coaching moments, concerns, and warnings here. A written record is what protects the operator if a tough HR moment ever lands.</div>';
    } else {
      body = list.map(n => {
        const catColor = n.category === 'Praise' ? 'var(--green)'
                       : n.category === 'Coaching' ? 'var(--steel)'
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
    }

    return '<div class="card form-card"><div class="card-title">Coaching Log</div>'
      + body
      + '<div class="card-actions"><button class="btn btn-ghost btn-sm" id="note-add">+ Add Note</button></div>'
      + '</div>';
  },

  // Note add/edit in a focused pop-up (own note- ids; no collision with the
  // coaching filter select behind it).
  openNoteModal(staffId) {
    const n = this.noteEditId ? this.notes().find(x => x.id === this.noteEditId) : null;
    const today = App.todayLocal();
    const catOpts = this.NOTE_CATEGORIES.map(c =>
      '<option' + (n && n.category === c ? ' selected' : (!n && c === 'Coaching' ? ' selected' : '')) + '>' + esc(c) + '</option>').join('');
    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">' + (this.noteEditId ? 'Edit Note' : 'Add Coaching Note') + '</div>'
      + '<div class="form-row" style="gap:16px;">'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Date</label>'
          + '<input type="date" id="note-date" value="' + esc(n?.date || today) + '"/></div>'
        + '<div class="f" style="width:160px;flex-shrink:0;"><label>Category</label>'
          + '<select id="note-cat">' + catOpts + '</select></div>'
        + '<div class="f" style="width:220px;flex-shrink:0;"><label>Manager</label>'
          + '<select id="note-mgr">' + App.staffOptions(n?.manager_id || App.activeManagerId(), { placeholder: 'Select manager...', audience: 'supervisor' }) + '</select></div>'
      + '</div>'
      + '<div class="f" style="margin-top:6px;margin-bottom:0;"><label>Note</label>'
        + '<textarea id="note-text" rows="5" placeholder="What happened, when, who was around, what was said. Specifics matter if this becomes a personnel matter later.">' + esc(n?.text || '') + '</textarea></div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="note-save">' + (this.noteEditId ? 'Update Note' : 'Save Note') + '</button>'
        + '<button class="btn btn-ghost" id="note-cancel">Cancel</button>'
        + '<span id="note-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'note-modal', maxWidth: 720, noClose: true });
    document.getElementById('note-cancel')?.addEventListener('click', () => { this.noteEditId = null; App.closeModal('note-modal'); });
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
      date:         document.getElementById('note-date')?.value || App.todayLocal(),
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
    if (ok) { App.closeModal('note-modal'); this.renderUnified(staffId); }
    else fail('Save failed. Try again.');
  },

  async confirmDelNote(id, staffId) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    App.laborData.lc_staff_notes = this.notes().filter(x => x.id !== id);
    await App.saveLabor();
    this.renderUnified(staffId);
  },

  // Profile save — feeds the inline Add Staff button (staffId null) and the staff
  // page's Update Profile button (staffId set).
  async saveProfile(staffId) {
    const err = document.getElementById('sr-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const name = document.getElementById('sr-name')?.value.trim();
    if (!name) { fail('Name is required.'); return; }
    const posId = document.getElementById('sr-pos')?.value;
    if (!posId) { fail('Choose a position.'); return; }
    const payType = document.getElementById('sr-paytype')?.value === 'Salary' ? 'Salary' : 'Hourly';
    const payRaw = parseFloat(document.getElementById('sr-pay')?.value);
    const payVal = isNaN(payRaw) ? null : payRaw;
    const newWage = payType === 'Salary' ? null : payVal;
    const annualSalary = payType === 'Salary' ? payVal : null;

    const existing = staffId ? this.staff().find(x => x.id === staffId) : null;
    const today = App.todayLocal();
    let wageHistory = Array.isArray(existing?.wage_history) ? existing.wage_history.slice() : [];
    if (existing && existing.wage != null && newWage != null && existing.wage !== newWage) {
      wageHistory.push({ prior_wage: existing.wage, new_wage: newWage, effective_date: today, changed_at: new Date().toISOString() });
    }

    const rec = {
      id:            staffId || App.uid(),
      name,
      position_id:   posId,
      pay_type:      payType,
      wage:          newWage,
      annual_salary: annualSalary,
      wage_history:  wageHistory,
      status:        document.getElementById('sr-status')?.value || 'Active',
      shift_lead:    !!document.getElementById('sr-lead')?.checked,
      phone:         document.getElementById('sr-phone')?.value.trim() || '',
      email:         document.getElementById('sr-email')?.value.trim() || '',
      notes:         document.getElementById('sr-notes')?.value.trim() || ''
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

  async confirmDel(id) {
    if (!(await App.confirmDelete())) return;
    App.laborData.lc_staff = this.staff().filter(x => x.id !== id);
    await App.saveLabor();
    this.renderList();
  }
};
