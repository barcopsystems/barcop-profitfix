'use strict';

/* ── Labor Control — Schedule Templates (writes lc_schedule_templates) ────────
   Reusable sets of shifts. Build a template once, then apply it in Build
   Schedule to pre-fill a week's shifts instead of starting from scratch. */

S.LaborScheduleTemplates = {
  editId: null,
  _shifts: [],
  _name: '',
  _pendingDelId: null,

  templates() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_schedule_templates)) App.laborData.lc_schedule_templates = [];
    return App.laborData.lc_schedule_templates;
  },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  bs() { return S.LaborBuildSchedule; },

  // Per-template rollup so each card is distinguishable at a glance: shift
  // count, total hours, a rough weekly cost (hourly at current wage + each
  // distinct salaried person's weekly salary), and headcount per day.
  templateStats(t) {
    const bs = this.bs();
    const days = App.DAYS_MON_FIRST || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const byDay = {}; days.forEach(d => byDay[d] = 0);
    const today = new Date().toISOString().slice(0, 10);
    let hours = 0, cost = 0;
    const salIds = new Set();
    (t.shifts || []).forEach(s => {
      const h = bs.hoursOf(s.start, s.end);
      hours += h;
      if (byDay[s.day] != null) byDay[s.day] += 1;
      const staff = bs.staffById(s.staff_id);
      if (staff && App.isSalaried(staff)) salIds.add(staff.id);
      else { const wage = App.wageForStaffOn ? App.wageForStaffOn(s.staff_id, today) : ((staff && staff.wage) || 0); cost += h * (wage || 0); }
    });
    salIds.forEach(id => { cost += App.staffWeeklySalary ? App.staffWeeklySalary(id) : 0; });
    return { count: (t.shifts || []).length, hours, cost, byDay };
  },
  dayStrip(byDay) {
    const days = App.DAYS_MON_FIRST || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map(d => {
      const n = byDay[d] || 0;
      return '<div style="text-align:center;min-width:34px;">'
        + '<div style="font-size:9px;letter-spacing:1px;color:var(--t4);text-transform:uppercase;">' + d + '</div>'
        + '<div style="font-size:14px;font-weight:600;color:' + (n > 0 ? 'var(--t1)' : 'var(--t4)') + ';">' + n + '</div></div>';
    }).join('');
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderList();
  },

  renderList() {
    this.actions.innerHTML = '';
    if (this.staff().length > 0) {
      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn-primary btn-sm';
      addBtn.textContent = 'New Template';
      addBtn.addEventListener('click', () => this.showForm());
      this.actions.appendChild(addBtn);
    }

    if (this.staff().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Add staff first</div>'
        + '<div class="empty-sub">Templates are built from your roster. Add staff in Staff Roster, then '
        + 'create reusable schedule templates here.</div>'
        + '<button class="btn btn-primary" id="lt-go-roster">Go to Staff Roster</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#lt-go-roster')) App.navigate('lc-staff-roster'); };
      return;
    }

    const list = this.templates();
    let html;
    if (list.length === 0) {
      html = '<div class="empty"><div class="empty-title">No schedule templates yet</div>'
        + '<div class="empty-sub">Build a template, a typical week of shifts, and apply it in Build '
        + 'Schedule to save time each week.</div>'
        + '<button class="btn btn-primary" id="lt-add-first">New Template</button></div>';
    } else {
      const intro = '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:14px;">A template is a typical week of shifts you can drop into any week. Apply one from Build Schedule, or build a week there and save it back here as a template.</div>';
      html = intro + list.map(t => {
        const st = this.templateStats(t);
        return '<div class="card lt-card" data-id="' + t.id + '" style="cursor:pointer;margin-bottom:12px;">'
          + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
          + '<div><div style="font-size:15px;font-weight:700;color:var(--t1);">' + esc(t.name) + '</div>'
          + '<div style="font-size:11px;color:var(--t3);margin-top:3px;">' + st.count + ' shift' + (st.count === 1 ? '' : 's')
          + ' &middot; ' + st.hours.toFixed(1) + ' hrs &middot; ~' + App.fmtCurrency(st.cost) + '/wk</div></div>'
          + '<div class="row-actions" style="flex-shrink:0;">'
          + '<button class="btn btn-primary btn-sm lt-use" data-id="' + t.id + '">Use</button>'
          + '<button class="btn btn-ghost btn-sm lt-edit" data-id="' + t.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm lt-del" data-id="' + t.id + '">Delete</button>'
          + '</div></div>'
          + '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid var(--b2);">'
          + this.dayStrip(st.byDay) + '</div></div>';
      }).join('');
    }

    const modal = '<div id="lt-del-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;align-items:center;justify-content:center;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:340px;width:90%;text-align:center;">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:18px;">Delete this template?</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;">'
      + '<button class="btn btn-ghost" id="lt-del-cancel">Cancel</button>'
      + '<button class="btn btn-danger" id="lt-del-confirm">Delete</button>'
      + '</div></div></div>';

    this.container.innerHTML = '<div class="screen">' + html + '</div>' + modal;
    this.container.onclick = ev => {
      const row = ev.target.closest('.lt-card');
      const use = ev.target.closest('.lt-use');
      const edit = ev.target.closest('.lt-edit');
      const del = ev.target.closest('.lt-del');
      const addF = ev.target.closest('#lt-add-first');
      if (use)       { ev.stopPropagation(); this.useTemplate(use.dataset.id); }
      else if (del)  { ev.stopPropagation(); this.confirmDel(del.dataset.id); }
      else if (edit) { ev.stopPropagation(); this.showForm(edit.dataset.id); }
      else if (row)  this.showForm(row.dataset.id);
      else if (addF) this.showForm();
    };
  },

  useTemplate(id) {
    const t = this.templates().find(x => x.id === id);
    if (!t || !this.bs()) return;
    const draft = {
      week_start: this.bs().mondayOf(new Date().toISOString().slice(0, 10)),
      shifts: (t.shifts || []).map(s => ({ staff_id: s.staff_id, day: s.day, start: s.start, end: s.end })),
      notes: ''
    };
    try { localStorage.setItem(this.bs().DRAFT_KEY, JSON.stringify(draft)); } catch (e) {}
    this.bs().editId = null;
    App.navigate('lc-build-schedule');
  },

  showForm(id) {
    this.editId = id || null;
    const t = id ? this.templates().find(x => x.id === id) : null;
    this._name = t ? t.name : '';
    this._shifts = t ? (t.shifts || []).map(s => ({ ...s })) : [];
    this.renderForm();
  },

  shiftRow(sh, idx) {
    const bs = this.bs();
    return '<div class="lt-line" data-idx="' + idx + '" style="display:flex;gap:10px;align-items:flex-end;'
      + 'flex-wrap:wrap;padding:10px;border:1px solid var(--b1);border-radius:6px;margin-bottom:8px;">'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Staff</label>'
      + '<select class="lt-staff">' + App.staffOptions(sh.staff_id, { placeholder: 'Staff...' }) + '</select></div>'
      + '<div class="f" style="width:90px;flex-shrink:0;"><label>Day</label>'
      + '<select class="lt-day">' + bs.dayOptions(sh.day) + '</select></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>Start</label>'
      + '<input type="time" class="lt-start" value="' + esc(sh.start || '') + '"/></div>'
      + '<div class="f" style="width:110px;flex-shrink:0;"><label>End</label>'
      + '<input type="time" class="lt-end" value="' + esc(sh.end || '') + '"/></div>'
      + '<button class="btn btn-danger btn-sm lt-remove" style="margin-bottom:6px;">Remove</button>'
      + '</div>';
  },

  renderForm() {
    const rows = this._shifts.length
      ? this._shifts.map((sh, i) => this.shiftRow(sh, i)).join('')
      : '<div style="font-size:12px;color:var(--t3);margin-bottom:8px;">No shifts yet. Add the first shift below.</div>';

    this.container.innerHTML = '<div class="screen"><div class="card">'
      + '<div class="card-title">' + (this.editId ? 'Edit' : 'New') + ' Schedule Template</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;">'
      + '<div class="f" style="width:280px;flex-shrink:0;"><label>Template Name</label>'
      + '<input type="text" id="lt-name" value="' + esc(this._name) + '" placeholder="e.g. Standard Week"/></div>'
      + '</div></div>'

      + '<div class="card"><div class="card-title">Shifts</div>'
      + '<div id="lt-lines">' + rows + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="lt-add-shift">+ Add Shift</button>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="lt-save">' + (this.editId ? 'Update Template' : 'Save Template') + '</button>'
      + '<button class="btn btn-ghost" id="lt-cancel">Cancel</button>'
      + '<span id="lt-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    this.container.onclick = null;
    document.getElementById('lt-lines')?.addEventListener('click', ev => {
      if (ev.target.closest('.lt-remove')) {
        this.syncShifts();
        const idx = parseInt(ev.target.closest('.lt-line').dataset.idx, 10);
        this._shifts.splice(idx, 1);
        this.renderForm();
      }
    });
    document.getElementById('lt-add-shift')?.addEventListener('click', () => {
      this.syncShifts();
      this._shifts.push({ staff_id: '', day: 'Mon', start: '', end: '' });
      this.renderForm();
    });
    document.getElementById('lt-cancel')?.addEventListener('click', () => this.renderList());
    document.getElementById('lt-save')?.addEventListener('click', () => this.save());
  },

  syncShifts() {
    this._name = document.getElementById('lt-name')?.value || '';
    const rows = [...document.querySelectorAll('.lt-line')];
    if (rows.length) {
      this._shifts = rows.map(r => ({
        staff_id: r.querySelector('.lt-staff')?.value || '',
        day:      r.querySelector('.lt-day')?.value || 'Mon',
        start:    r.querySelector('.lt-start')?.value || '',
        end:      r.querySelector('.lt-end')?.value || ''
      }));
    }
  },

  async save() {
    this.syncShifts();
    const err = document.getElementById('lt-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const name = (this._name || '').trim();
    if (!name) { fail('Template name is required.'); return; }
    const shifts = this._shifts.filter(s => s.staff_id && s.start && s.end);
    if (shifts.length === 0) { fail('Add at least one complete shift.'); return; }

    const rec = { id: this.editId || App.uid(), name, shifts };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.templates();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('lt-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveLabor();
    this.editId = null;
    if (ok) {
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Template'; }
      fail('Save failed. Try again.');
    }
  },

  confirmDel(id) {
    this._pendingDelId = id;
    const modal = document.getElementById('lt-del-modal');
    if (modal) modal.style.display = 'flex';
    document.getElementById('lt-del-cancel').onclick = () => { modal.style.display = 'none'; this._pendingDelId = null; };
    document.getElementById('lt-del-confirm').onclick = async () => {
      modal.style.display = 'none';
      const delId = this._pendingDelId;
      this._pendingDelId = null;
      App.laborData.lc_schedule_templates = this.templates().filter(x => x.id !== delId);
      await App.saveLabor();
      this.renderList();
    };
  }
};
