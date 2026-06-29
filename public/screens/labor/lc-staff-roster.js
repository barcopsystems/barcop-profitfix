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
  entryMode: 'manual',     // landing card: type a profile (default) vs import a staff file. Roster is setup data, not a recurring POS export, so manual-first (matches Vendors).
  _draft: null,            // in-memory Add-Staff draft (survives leave/return)

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
    // Cross-screen focus: Labor Reports (and others) set App._staffFocus =
    // { staff_id } and navigate here to open that person's page directly.
    if (App._staffFocus && App._staffFocus.staff_id) {
      const sid = App._staffFocus.staff_id;
      App._staffFocus = null;
      if (this.staffById(sid)) { this.detailId = sid; App.pushView(() => this.renderUnified(sid)); return; }
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
      // One row: Secondary Role + Wage, then Phone, Email, Shift Lead. Secondary is
      // a cross-trained employee who works a second position at a different wage;
      // logging hours in that role costs at this rate (App.wageForStaffPosition),
      // and the wage auto-fills from the role's default. Shift Lead lives OUTSIDE a
      // .f wrapper on purpose: the global `.f input` rule forces appearance:none,
      // which kills the native checkbox; a plain div keeps it rendering normally.
      + '<div class="form-row data-row" style="gap:12px;">'
      + '<div class="f" style="flex:1 1 150px;min-width:0;"><label>Secondary Role <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
      + '<select id="sr-pos2"><option value="">None</option>'
      + positions.map(p => '<option value="' + p.id + '"' + (s && s.secondary_position_id === p.id ? ' selected' : '') + '>' + esc(posLabel(p)) + '</option>').join('')
      + '</select></div>'
      + '<div class="f" style="flex:1 1 110px;min-width:0;"><label>Secondary Wage</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="sr-wage2" min="0" step="0.01" value="' + (s && s.secondary_wage != null && s.secondary_wage !== '' ? s.secondary_wage : '') + '" placeholder="0.00"/></div></div>'
      + '<div class="f" style="flex:1 1 130px;min-width:0;"><label>Phone</label>'
      + '<input type="text" id="sr-phone" value="' + esc(s?.phone || '') + '" placeholder="Optional"/></div>'
      + '<div class="f" style="flex:1 1 150px;min-width:0;"><label>Email</label>'
      + '<input type="text" id="sr-email" value="' + esc(s?.email || '') + '" placeholder="Optional"/></div>'
      + '<div style="flex:1 1 200px;min-width:0;display:flex;flex-direction:column;gap:5px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);">Shift Lead</div>'
      + '<label style="display:flex;align-items:center;gap:8px;min-height:38px;font-size:12px;color:var(--t2);cursor:pointer;">'
      + '<input type="checkbox" class="bc-check" id="sr-lead"' + (s && s.shift_lead ? ' checked' : '') + '/>'
      + '<span style="min-width:0;color:var(--t3);font-size:11px;line-height:1.3;overflow-wrap:anywhere;">Can run shifts and authorize like a manager, even if hourly.</span></label></div>'
      + '</div>'
      + '<div class="form-row" style="gap:12px;margin-bottom:18px;"><div style="flex:1 1 100%;min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:7px;">Regular Days Off</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;">'
      + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(dn => {
          const on = !!(s && Array.isArray(s.off_days) && s.off_days.indexOf(dn) >= 0);
          return '<button type="button" class="sr-off-chip btn btn-sm" data-day="' + dn + '" data-on="' + (on ? '1' : '0') + '" style="'
            + (on ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
                  : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + dn + '</button>';
        }).join('')
      + '</div></div></div>';
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
    // Regular-days-off chips: plain selectable chip (no checkbox), gold-tint when on.
    document.querySelectorAll('.sr-off-chip').forEach(chip => chip.addEventListener('click', () => {
      const on = chip.dataset.on === '1';
      chip.dataset.on = on ? '0' : '1';
      chip.style.background = on ? 'transparent' : 'var(--sel-active-bg)';
      chip.style.borderColor = on ? 'var(--b1)' : 'var(--gold-tint-bord)';
      chip.style.color = on ? 'var(--t2)' : 'var(--t1)';
      chip.style.fontWeight = on ? '' : '700';
    }));
    // Secondary wage auto-fills from the secondary role's default wage, mirroring
    // the primary. Touched-detection seeds off any wage already on file so an
    // existing custom secondary wage is not overwritten when the role changes;
    // clearing the role (None) empties the wage and re-arms the auto-fill.
    const pos2El = document.getElementById('sr-pos2');
    const wage2El = document.getElementById('sr-wage2');
    if (pos2El && wage2El) {
      let wage2Touched = !!(wage2El.value && parseFloat(wage2El.value) > 0);
      wage2El.addEventListener('input', () => { wage2Touched = true; });
      pos2El.addEventListener('change', e => {
        if (!e.target.value) { wage2El.value = ''; wage2Touched = false; return; }
        if (wage2Touched) return;
        const p = this.positionById(e.target.value);
        wage2El.value = (p && p.default_wage != null) ? p.default_wage : '';
      });
    }
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
        + (on ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    };
    // Primary actions live BELOW the card (bottom-left), collapse-group tagged so
    // they hide with the card. Import mode's Import / Cancel render into the same
    // out-of-card slot via the CSVMapper actionsEl. Mirrors Log Hours / Tip Log.
    let modeBody, actionRow;
    if (this.entryMode === 'import') {
      modeBody = '<div id="sr-csv"></div><div id="sr-imp-result"></div>';
      actionRow = '<div id="sr-imp-actions" data-collapse-group="lc-staff-roster" style="margin-bottom:24px;"></div>';
    } else {
      modeBody = this.profileFormCells(null)
        + '<div class="form-row" style="gap:16px;margin-bottom:0;"><div class="f" style="width:100%;">'
        + '<label>Notes</label><textarea id="sr-notes" class="notes-ta" rows="2" placeholder="Optional"></textarea></div></div>';
      actionRow = '<div data-collapse-group="lc-staff-roster" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary" id="sr-save">Add Staff</button>'
        + '<button class="btn btn-ghost" id="sr-startover">Start Over</button>'
        + '<span id="sr-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
        + '</div>';
    }
    const addCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('lc-staff-roster', 'Add Staff Member')
      + '<div class="collapse-body">'
      + '<div class="seg-toggle">' + segBtn('manual', 'Enter Manually') + segBtn('import', 'Import File') + '</div>'
      + modeBody
      + '</div></div>'
      + actionRow;

    const list = [...this.staff()].sort((a, b) => {
      if ((a.status === 'Inactive') !== (b.status === 'Inactive')) return a.status === 'Inactive' ? 1 : -1;
      return (a.name || '').localeCompare(b.name || '');
    });

    // Fixed column widths so the roster columns space evenly instead of bunching
    // to the left around the longest cell.
    const rosterCols = '<colgroup><col style="width:17%"/><col style="width:14%"/><col style="width:16%"/><col style="width:13%"/><col style="width:11%"/><col style="width:11%"/><col style="width:18%"/></colgroup>';
    let below;
    if (list.length === 0) {
      below = '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list" style="table-layout:fixed;width:100%;">' + rosterCols + '<thead><tr>'
        + '<th>Name</th><th>Position</th><th>Department</th><th>Wage</th><th>Status</th><th>Certs</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="7" style="color:var(--t3);">No staff yet. Add your first team member above, or import a staff list.</td></tr></tbody></table></div>';
    } else {
      const rows = list.map(s => {
        const pos = this.positionById(s.position_id);
        const roll = this.certRollup(s.id);
        const certCell = roll === 'expired'  ? '<span style="color:var(--red);font-weight:700;">Expired</span>'
                       : roll === 'expiring' ? '<span style="color:var(--amber);font-weight:700;">Expiring</span>'
                       : roll === 'ok'       ? '<span style="color:var(--t2);">Current</span>'
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
          + (App.canEdit('lc-staff-roster') ? '<button class="btn btn-ghost btn-sm sr-edit" data-id="' + s.id + '">Edit</button>' : '')
          + (App.canEdit('lc-staff-roster') ? '<button class="btn btn-danger btn-sm sr-del" data-id="' + s.id + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');
      below = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
        + '<div class="sh" style="margin:0;">Staff Roster</div>'
        + '<button class="btn btn-ghost btn-sm" id="sr-export">Export PDF</button></div>'
        + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">' + rosterCols + '<thead><tr>'
        + '<th>Name</th><th>Position</th><th>Department</th><th>Wage</th><th>Status</th><th>Certs</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    this.container.innerHTML = '<div class="screen">' + addCard + below + '</div>';
    this.container.onclick = ev => {
      const modeBtn = ev.target.closest('.sr-mode');
      if (modeBtn) { this.entryMode = modeBtn.dataset.mode; this.renderList(); return; }
      const head = ev.target.closest('.card-collapse-head');
      if (head) { App.toggleCollapse(head); return; }
      if (ev.target.closest('#sr-startover')) { this._draft = null; this.renderList(); return; }
      if (ev.target.closest('#sr-export'))    { App.exportPDF({ title: 'Staff Roster', root: this.container }); return; }
      if (ev.target.closest('#sr-save'))     { this.saveProfile(null); return; }
      const edit = ev.target.closest('.sr-edit');
      const del = ev.target.closest('.sr-del');
      const row = ev.target.closest('.sr-row');
      if (del)        { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit)  { ev.stopPropagation(); const id = edit.dataset.id; App.pushView(() => this.renderUnified(id)); }
      else if (row)   { const id = row.dataset.id; App.pushView(() => this.renderUnified(id)); }
    };
    if (this.entryMode === 'import') this.mountImporter();
    else {
      // Restore an in-progress Add-Staff draft, then sync the pay label to the
      // restored Pay Type (a synthetic change event would wipe the pay value).
      const formRoot = this.container.querySelector('.collapse-body');
      if (formRoot && this._draft) {
        App.restoreDraft(formRoot, this._draft);
        const typeEl = document.getElementById('sr-paytype'), labelEl = document.getElementById('sr-pay-label');
        if (typeEl && labelEl) labelEl.textContent = typeEl.value === 'Salary' ? 'Annual Salary' : 'Wage';
      }
      this.wirePayFields(false);
      if (formRoot) {
        const cap = () => { this._draft = App.captureDraft(formRoot); };
        formRoot.addEventListener('input', cap);
        formRoot.addEventListener('change', cap);
      }
    }
    App.applyCollapsed(this.container);
  },

  // Mount the drag-drop + column mapper into the landing's import body.
  mountImporter() {
    const el = document.getElementById('sr-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your staff list here',
      dropSub: 'Only Name is required; position, pay, status, phone, and email come in if your file has them.',
      actionsEl: '#sr-imp-actions',
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
      { h: 'Adding Someone', p: ['Pick Enter Manually, fill the row, and click Add Staff. The position sets the default hourly wage, which you can override per person. Wage changes are tracked with history, so past hours always cost out at the wage in effect on that day, not today\'s rate. Check Shift Lead on anyone who can run shifts and authorize like a manager even when they are hourly; Management already counts as a supervisor without it. If someone works a second role at a different rate, like a server who picks up bar shifts, set a Secondary Role and its wage; logging hours in that role then costs at the secondary rate, and a Role picker shows up on Log Hours for them.'] },
      { h: 'Fixing A Wage Change', p: ['Open a person and a Wage History table shows every raise and cut with the date it took effect. If a change landed on the wrong day, those shifts cost out at the wrong rate, so Edit the change to correct its effective date, or Delete one entered in error. To change the current wage, edit the profile up top; that records a fresh change here on its own.'] },
      { h: 'Regular Days Off', p: ['Tap the weekday chips to mark a standing day someone never works, like a server who is always off Sundays. Build Schedule blocks every one of those weekdays automatically, so you do not have to remember it each week. For a one-time request (a vacation week, a day off), use Time Off instead.'] },
      { h: 'Importing A Staff List', p: ['Switch to Import File and drop a CSV or Excel file. Map the columns once and Bar Cop remembers it. Only Name is required; Position, Pay Type, Wage, Annual Salary, Status, Phone, and Email are matched if your file has them, and anything missing imports blank to fill in later. Each person\'s position matches your existing positions by name (set those up first for the cleanest import); an unmatched or blank position still imports, just open the person and pick one.'] },
      { h: 'Hourly or Salaried', p: ['Set Pay Type to Salary for an exempt manager or any fixed-salary role, then enter the annual salary. Bar Cop spreads that salary evenly across the year (salary divided by 52 each week) as a fixed labor cost, and salaried staff never show overtime. You can still log their hours so they count toward coverage and revenue per labor hour, but those hours never add an hourly cost. If a salaried employee is overtime eligible (non-exempt), set them to Hourly instead. How you classify staff under wage and hour law is your call. Bar Cop is a tool, not legal or payroll advice.'] },
      { h: 'Certifications and Coaching', p: ['Click any staff member to open their page. That is where you add certifications (TABC, food handler, ServSafe, and the rest, with expiration dates Bar Cop flags before they lapse) and the coaching log (praise, coaching, concern, and warning notes that protect you if a tough HR moment ever lands).'] },
      { h: 'Training', p: ['Each person\'s page also has a Training section. Use Assign Training to load an onboarding template onto them, check the steps off as they finish, and pick who signed off. Build the templates themselves on the Training screen, which also shows where every staff member stands at a glance.'] },
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
      + this.renderWageHistoryCard(s)
      + this.renderCertsCard(staffId)
      + this.renderNotesCard(staffId)
      + (S.LaborTraining ? S.LaborTraining.rosterSectionHTML(staffId) : '')
      + '</div>';
    this.wireUnified(staffId);
  },
  renderDetail(staffId) { this.renderUnified(staffId); },

  renderProfileEditCard(s) {
    return '<div class="card form-card"><div class="card-title">Edit ' + esc(s.name || 'Profile') + '</div>'
      + this.profileFormCells(s)
      + '<div class="form-row" style="gap:16px;margin-bottom:0;"><div class="f" style="width:100%;"><label>Notes</label>'
      + '<textarea id="sr-notes" class="notes-ta" rows="2" placeholder="Optional">' + esc(s?.notes || '') + '</textarea></div></div>'
      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="sr-save">Update Profile</button>'
      + '<button class="btn btn-ghost" id="sr-cancel">Cancel</button>'
      + '<span id="sr-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';
  },

  // ── Wage History section ─────────────────────────────────────────────
  // Visible + correctable. Each profile wage change is auto-recorded, and
  // App.wageForStaffOn costs past hours at the wage in effect on the day worked,
  // so an effective date logged on the wrong day mis-costs those shifts. The
  // operator can fix the date here, or delete a change recorded in error. Only
  // shows once there is at least one change on file (so it never clutters a
  // brand-new profile). Salaried staff never accrue wage history.
  renderWageHistoryCard(s) {
    const hist = Array.isArray(s.wage_history) ? s.wage_history : [];
    if (!hist.length) return '';
    const heading = '<div class="sh" style="margin:24px 0 10px;">Wage History</div>';
    const canEdit = App.canEdit('lc-staff-roster');
    const rows = hist.map((h, idx) => ({ h, idx }))
      .sort((a, b) => (b.h.effective_date || '').localeCompare(a.h.effective_date || ''))
      .map(({ h, idx }) => {
        const delta = (h.new_wage != null && h.prior_wage != null) ? h.new_wage - h.prior_wage : null;
        const deltaCell = delta == null ? '<span style="color:var(--t3);">-</span>'
          : '<span style="color:' + (delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--amber)' : 'var(--t3)') + ';font-weight:600;">'
            + (delta > 0 ? '+' : '') + App.fmtCurrency(delta) + '/hr</span>';
        return '<tr>'
          + '<td><div class="val">' + this.fmtDate(h.effective_date) + '</div></td>'
          + '<td>' + (h.prior_wage != null ? App.fmtCurrency(h.prior_wage) + '/hr' : '-') + '</td>'
          + '<td class="val">' + (h.new_wage != null ? App.fmtCurrency(h.new_wage) + '/hr' : '-') + '</td>'
          + '<td>' + deltaCell + '</td>'
          + '<td><div class="row-actions">'
          + (canEdit ? '<button class="btn btn-ghost btn-sm wh-edit" data-idx="' + idx + '">Edit</button>'
            + '<button class="btn btn-danger btn-sm wh-del" data-idx="' + idx + '">Delete</button>' : '')
          + '</div></td></tr>';
      }).join('');
    return heading
      + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Effective</th><th>Was</th><th>New Wage</th><th>Change</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Past hours cost out at the wage in effect on the day worked. Fix an effective date here if a change was recorded on the wrong day. To change the current wage, edit the profile above; that records a new change here.</div>';
  },

  // Edit a wage change's effective date (the field that drives past-hour costing).
  openWageEditModal(staffId, idx) {
    const s = this.staffById(staffId);
    const h = (s && Array.isArray(s.wage_history)) ? s.wage_history[idx] : null;
    if (!h) return;
    const html = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">Edit Wage Change</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">'
      + (h.prior_wage != null ? App.fmtCurrency(h.prior_wage) + '/hr' : 'Prior wage') + ' to '
      + (h.new_wage != null ? App.fmtCurrency(h.new_wage) + '/hr' : 'new wage')
      + '. Correct the date this change actually took effect so past hours cost out at the right rate.</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f" style="width:180px;flex-shrink:0;"><label>Effective Date</label>'
          + '<input type="date" id="wh-date" value="' + esc(h.effective_date || '') + '"/></div>'
      + '</div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="wh-save">Save</button>'
        + '<button class="btn btn-ghost" id="wh-cancel">Cancel</button>'
        + '<span id="wh-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'wh-modal', maxWidth: 460, noClose: true });
    document.getElementById('wh-cancel')?.addEventListener('click', () => App.closeModal('wh-modal'));
    document.getElementById('wh-save')?.addEventListener('click', async () => {
      const v = document.getElementById('wh-date')?.value;
      const err = document.getElementById('wh-err');
      if (!v) { if (err) { err.textContent = 'Pick the effective date.'; err.style.display = 'inline'; } return; }
      const list = this.staff();
      const i = list.findIndex(x => x.id === staffId);
      if (i > -1 && Array.isArray(list[i].wage_history) && list[i].wage_history[idx]) {
        list[i].wage_history[idx].effective_date = v;
        list[i].wage_history[idx].updated_at = new Date().toISOString();
        await App.saveLabor();
      }
      App.closeModal('wh-modal');
      this.renderUnified(staffId);
    });
  },

  async confirmDelWage(staffId, idx) {
    const ok = await App.confirm({
      title: 'Delete this wage change?',
      message: 'This removes the recorded change from the wage history. Past hours will then cost out at the wage in effect before it. The current wage on the profile does not change.',
      confirmText: 'Delete', cancelText: 'Cancel', danger: true
    });
    if (!ok) return;
    const list = this.staff();
    const i = list.findIndex(x => x.id === staffId);
    if (i > -1 && Array.isArray(list[i].wage_history)) {
      list[i].wage_history.splice(idx, 1);
      await App.saveLabor();
    }
    this.renderUnified(staffId);
  },

  wireUnified(staffId) {
    this.container.onclick = null;
    this.wirePayFields(true);
    document.getElementById('sr-cancel')?.addEventListener('click', () => { this.detailId = null; App.goBack(); });
    document.getElementById('sr-save')?.addEventListener('click', () => this.saveProfile(staffId));
    // Wage history (correct an effective date, or delete a change logged in error)
    this.container.querySelectorAll('.wh-edit').forEach(b => b.addEventListener('click', () => this.openWageEditModal(staffId, parseInt(b.dataset.idx, 10))));
    this.container.querySelectorAll('.wh-del').forEach(b => b.addEventListener('click', () => this.confirmDelWage(staffId, parseInt(b.dataset.idx, 10))));
    // Certifications
    document.getElementById('cert-add')?.addEventListener('click', () => { this.certEditId = null; this.openCertModal(staffId); });
    this.container.querySelectorAll('.cert-edit').forEach(b => b.addEventListener('click', () => { this.certEditId = b.dataset.id; this.openCertModal(staffId); }));
    this.container.querySelectorAll('.cert-del').forEach(b => b.addEventListener('click', () => this.confirmDelCert(b.dataset.id, staffId)));
    // Coaching notes
    document.getElementById('note-add')?.addEventListener('click', () => { this.noteEditId = null; this.openNoteModal(staffId); });
    this.container.querySelectorAll('.note-edit').forEach(b => b.addEventListener('click', () => { this.noteEditId = b.dataset.id; this.openNoteModal(staffId); }));
    this.container.querySelectorAll('.note-del').forEach(b => b.addEventListener('click', () => this.confirmDelNote(b.dataset.id, staffId)));
    // Training (assign + check off) — rendered and wired by S.LaborTraining so the
    // template store and assignment records have one home (two doors, one store).
    if (S.LaborTraining) S.LaborTraining.wireRosterSection(this.container, staffId, () => this.renderUnified(staffId));
  },

  // ── Certifications section ───────────────────────────────────────────
  renderCertsCard(staffId) {
    const list = this.certsForStaff(staffId);
    const heading = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Certifications &amp; Licenses</div>'
      + '<div class="no-print" style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" id="cert-add">+ Add Certification</button></div></div>';
    if (list.length === 0) {
      return heading + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Certification</th><th>Issuer</th><th>Issued</th><th>Expires</th><th>Status</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="6" style="color:var(--t3);padding:12px 8px;">No certifications on file yet. Add cert types and expiration dates, and Bar Cop will flag any expiring within 30 days on the dashboard.</td></tr></tbody></table></div>';
    }
    const rows = list.map(c => {
      const status = this.certStatus(c);
      const badge = status === 'expired' ? '<span style="color:var(--red);font-weight:700;">Expired</span>'
                 : status === 'expiring' ? '<span style="color:var(--amber);font-weight:700;">Expiring</span>'
                 : '<span style="color:var(--t2);">Current</span>';
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
      + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Certification</th><th>Issuer</th><th>Issued</th><th>Expires</th><th>Status</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
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
        + '<div class="f" style="flex:0 1 calc(50% - 8px);min-width:150px;"><label>Certification Type</label>'
          + '<select id="cert-type">' + typeOpts + '</select></div>'
        + '<div class="f" style="flex:0 1 calc(50% - 8px);min-width:150px;"><label>Cert Number <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
          + '<input type="text" id="cert-number" value="' + esc(c?.cert_number || '') + '" placeholder="Optional"/></div>'
        + '<div class="f" style="flex:0 1 calc(50% - 8px);min-width:150px;"><label>Issuer <span style="color:var(--t4);font-weight:400;">(optional)</span></label>'
          + '<input type="text" id="cert-issuer" value="' + esc(c?.issuer || '') + '" placeholder="State, school, etc."/></div>'
        + '<div class="f" style="flex:0 1 calc(50% - 8px);min-width:150px;"><label>Issue Date</label>'
          + '<input type="date" id="cert-issued" value="' + esc(c?.issue_date || '') + '"/></div>'
        + '<div class="f" style="flex:0 1 calc(50% - 8px);min-width:150px;"><label>Expiration Date</label>'
          + '<input type="date" id="cert-expires" value="' + esc(c?.expiration_date || '') + '"/></div>'
      + '</div>'
      + '<div class="form-row" style="gap:16px;"><div class="f" style="width:100%;"><label>Notes</label>'
        + '<textarea id="cert-notes" class="notes-ta" rows="2" placeholder="Optional context">' + esc(c?.notes || '') + '</textarea></div></div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="cert-save">' + (this.certEditId ? 'Update' : 'Save Certification') + '</button>'
        + '<button class="btn btn-ghost" id="cert-cancel">Cancel</button>'
        + '<span id="cert-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'cert-modal', maxWidth: 540, noClose: true });
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
  // Heading-outside + ONE card with the notes as divider-separated rows (no
  // per-note bordered box, which read as a card inside a card).
  renderNotesCard(staffId) {
    const list = this.notesForStaff(staffId);
    const heading = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Coaching Log</div>'
      + '<div class="no-print" style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" id="note-add">+ Add Note</button></div></div>';
    if (list.length === 0) {
      return heading + '<div class="card" style="padding:14px 20px;"><div style="font-size:13px;color:var(--t3);line-height:1.5;">No coaching notes on file yet. Document praise, coaching moments, concerns, and warnings here. A written record is what protects the operator if a tough HR moment ever lands.</div></div>';
    }
    const rows = list.map((n, i) => {
      const catColor = n.category === 'Praise' ? 'var(--green)'
                     : n.category === 'Coaching' ? 'var(--steel)'
                     : n.category === 'Concern' ? 'var(--amber)'
                     : 'var(--red)';
      return '<div style="padding:14px 0;' + (i ? 'border-top:1px solid var(--b2);' : '') + '">'
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
    return heading + '<div class="card" style="padding:6px 20px;">' + rows + '</div>';
  },

  // Note add/edit in a focused pop-up (own note- ids; no collision with the
  // coaching filter select behind it).
  openNoteModal(staffId, opts) {
    // opts.onSaved lets another screen (Server Check) open this same canonical
    // coaching-note form in place and return to its own page on save, instead of
    // re-rendering the staff page — two doors, one coaching log.
    this._noteOnSaved = (opts && opts.onSaved) || null;
    const n = this.noteEditId ? this.notes().find(x => x.id === this.noteEditId) : null;
    const today = App.todayLocal();
    const catOpts = this.NOTE_CATEGORIES.map(c =>
      '<option' + (n && n.category === c ? ' selected' : (!n && c === 'Coaching' ? ' selected' : '')) + '>' + esc(c) + '</option>').join('');
    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">' + (this.noteEditId ? 'Edit Note' : 'Add Coaching Note') + '</div>'
      + '<div class="form-row" style="gap:16px;flex-wrap:wrap;">'
        + '<div class="f" style="flex:0 1 calc(50% - 8px);min-width:150px;"><label>Date</label>'
          + '<input type="date" id="note-date" value="' + esc(n?.date || today) + '"/></div>'
        + '<div class="f" style="flex:0 1 calc(50% - 8px);min-width:150px;"><label>Category</label>'
          + '<select id="note-cat">' + catOpts + '</select></div>'
        + '<div class="f" style="flex:0 1 calc(50% - 8px);min-width:150px;"><label>Manager</label>'
          + '<select id="note-mgr">' + App.staffOptions(n?.manager_id || App.activeManagerId(), { placeholder: 'Select manager...', audience: 'supervisor' }) + '</select></div>'
      + '</div>'
      + '<div class="f" style="margin-top:6px;margin-bottom:0;"><label>Note</label>'
        + '<textarea id="note-text" rows="5" placeholder="What happened, when, who was around, what was said. Specifics matter if this becomes a personnel matter later.">' + esc(n?.text || '') + '</textarea></div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="note-save">' + (this.noteEditId ? 'Update Note' : 'Save Note') + '</button>'
        + '<button class="btn btn-ghost" id="note-cancel">Cancel</button>'
        + '<span id="note-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'note-modal', maxWidth: 540, noClose: true });
    document.getElementById('note-cancel')?.addEventListener('click', () => { this.noteEditId = null; this._noteOnSaved = null; App.closeModal('note-modal'); });
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
    if (ok) {
      App.closeModal('note-modal');
      const cb = this._noteOnSaved; this._noteOnSaved = null;
      if (cb) cb(); else this.renderUnified(staffId);
    }
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
      off_days:      [...document.querySelectorAll('.sr-off-chip')].filter(c => c.dataset.on === '1').map(c => c.dataset.day),
      phone:         document.getElementById('sr-phone')?.value.trim() || '',
      email:         document.getElementById('sr-email')?.value.trim() || '',
      notes:         document.getElementById('sr-notes')?.value.trim() || '',
      // Secondary role + rate (cleared together when no secondary role is set).
      secondary_position_id: document.getElementById('sr-pos2')?.value || '',
      secondary_wage:        (function () { const sp = document.getElementById('sr-pos2')?.value || ''; const w = parseFloat(document.getElementById('sr-wage2')?.value); return sp ? (isNaN(w) ? null : w) : null; })()
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
      else { this.detailId = null; this._draft = null; this.renderList(); }   // a saved add clears its draft
    } else {
      if (btn) { btn.disabled = false; btn.textContent = staffId ? 'Update Profile' : 'Add Staff'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const s = this.staffById(id);
    const hours = ((App.laborData && App.laborData.lc_actuals) || []).filter(a => a.staff_id === id).length;
    const tips  = ((App.laborData && App.laborData.lc_tips)    || []).filter(t => t.staff_id === id).length;
    const certN = this.certs().filter(c => c.staff_id === id).length;
    const noteN = this.notes().filter(n => n.staff_id === id).length;
    // If the person has any history, steer hard to Inactive (which keeps it all);
    // deleting wipes their certs + coaching notes and leaves hours/tips nameless.
    if (hours + tips + certN + noteN > 0) {
      const ok = await App.confirm({
        title: 'Delete ' + (s ? s.name : 'this staff member') + '?',
        message: 'This person has logged history (hours, tips, certifications, or coaching notes). Deleting removes them and erases their certifications and coaching notes, and leaves their logged hours and tips with no name attached. Set them Inactive instead to keep every record intact. Delete anyway?',
        confirmText: 'Delete Anyway',
        cancelText: 'Cancel',
        danger: true
      });
      if (!ok) return;
    } else if (!(await App.confirmDelete())) {
      return;
    }
    App.laborData.lc_staff = this.staff().filter(x => x.id !== id);
    // Clean up the person's certs + coaching notes so they don't orphan.
    App.laborData.lc_certs = this.certs().filter(c => c.staff_id !== id);
    App.laborData.lc_staff_notes = this.notes().filter(n => n.staff_id !== id);
    await App.saveLabor();
    this.renderList();
  }
};
