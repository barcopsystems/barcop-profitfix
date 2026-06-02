'use strict';

/* ── Labor Control — Build Schedule (weekly grid) — writes lc_schedules ───────
   A staff-by-day grid you fill by clicking cells. Each cell holds that person's
   shift for that day. Live labor cost, labor %, RPLH, and a dollar labor budget
   derived from the week's revenue forecast, so you build toward a target instead
   of guessing. Apply a saved template into the week, or save the current week as
   a template. Saved schedules go to Schedule History. */

S.LaborBuildSchedule = {
  draft: null,
  editId: null,
  DRAFT_KEY: 'lc_sched_draft',

  get DAYS() { return App.DAYS_MON_FIRST || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; },
  DEPT_ORDER: ['Bar', 'Kitchen', 'Front of House', 'Management'],

  schedules() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_schedules)) App.laborData.lc_schedules = [];
    return App.laborData.lc_schedules;
  },
  templates() { return ((App.laborData && App.laborData.lc_schedule_templates) || []); },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  activeStaff() { return this.staff().filter(s => s.status !== 'Inactive'); },
  staffById(id) { return this.staff().find(s => s.id === id); },
  positionById(id) { return ((App.laborData && App.laborData.lc_positions) || []).find(p => p.id === id); },
  deptOf(staffId) { const p = this.positionById((this.staffById(staffId) || {}).position_id); return (p && p.department) || 'Other'; },
  // Still used by the Schedule Templates form.
  dayOptions(sel) { return this.DAYS.map(d => '<option' + (d === sel ? ' selected' : '') + '>' + d + '</option>').join(''); },

  laborTarget() {
    const t = (App.data && App.data.settings && App.data.settings.targets) || {};
    if (t.labor_cost_pct != null) return Number(t.labor_cost_pct);
    if (t.bar_labor_cost_pct != null && t.food_labor_cost_pct != null)
      return (Number(t.bar_labor_cost_pct) + Number(t.food_labor_cost_pct)) / 2;
    return 29;
  },
  hoursOf(start, end) {
    if (!start || !end) return 0;
    const ps = start.split(':'), pe = end.split(':');
    if (ps.length < 2 || pe.length < 2) return 0;
    let mins = (parseInt(pe[0], 10) * 60 + parseInt(pe[1], 10)) - (parseInt(ps[0], 10) * 60 + parseInt(ps[1], 10));
    if (isNaN(mins)) return 0;
    if (mins <= 0) mins += 1440;
    return mins / 60;
  },

  // Forecast lives in Revenue Recovery (one canonical store, revenue_forecasts).
  forecastForWeek(weekStart) { return (weekStart && App.forecastForWeek) ? App.forecastForWeek(weekStart) : null; },
  forecastTotal(weekStart) { const f = this.forecastForWeek(weekStart); return f && f.total != null ? Number(f.total) || 0 : 0; },

  // ── Week helpers ──────────────────────────────────────────────────────────
  mondayOf(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    const wd = (d.getDay() + 6) % 7; // 0 = Monday
    d.setDate(d.getDate() - wd);
    return d.toISOString().slice(0, 10);
  },
  // Date label for a given day column, derived from the (Monday) week_start.
  dayDate(weekStart, dayIdx) {
    if (!weekStart) return '';
    const d = new Date(weekStart + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + dayIdx);
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  },

  // ── Draft lifecycle ─────────────────────────────────────────────────────────
  loadDraft() {
    if (this.editId) {
      const sched = this.schedules().find(s => s.id === this.editId);
      if (sched) {
        return {
          week_start: sched.week_start || '',
          shifts: (sched.shifts || []).map(sh => ({ staff_id: sh.staff_id, day: sh.day, start: sh.start, end: sh.end })),
          notes: sched.notes || ''
        };
      }
    }
    try { const r = localStorage.getItem(this.DRAFT_KEY); if (r) return JSON.parse(r); } catch (e) {}
    return { week_start: this.mondayOf(new Date().toISOString().slice(0, 10)), shifts: [], notes: '' };
  },
  saveDraft() { if (this.editId) return; try { localStorage.setItem(this.DRAFT_KEY, JSON.stringify(this.draft)); } catch (e) {} },
  clearDraft() { try { localStorage.removeItem(this.DRAFT_KEY); } catch (e) {} },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draft = this.loadDraft();
    if (this.activeStaff().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Add staff first</div>'
        + '<div class="empty-sub">A schedule is built from your roster. Add staff in Staff Roster, then come back to build the week.</div>'
        + '<button class="btn btn-primary" id="bs-go-roster">Go to Staff Roster</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#bs-go-roster')) App.navigate('lc-staff-roster'); };
      return;
    }
    this.draw();
  },

  // ── Shift math + conflicts ──────────────────────────────────────────────────
  shiftCalc(sh) {
    const staff = this.staffById(sh.staff_id);
    const hours = this.hoursOf(sh.start, sh.end);
    const wkDate = this.draft.week_start || new Date().toISOString().slice(0, 10);
    if (staff && App.isSalaried(staff)) return { staff, hours, wage: 0, cost: 0, salaried: true };
    const wage = staff ? (App.wageForStaffOn ? App.wageForStaffOn(staff.id, wkDate) : (staff.wage || 0)) : 0;
    return { staff, hours, wage, cost: hours * wage };
  },
  salariedWeekCost(weekStart) {
    if (!weekStart) return 0;
    const we = new Date(weekStart + 'T00:00:00');
    if (isNaN(we.getTime())) return 0;
    we.setDate(we.getDate() + 6);
    return App.salariedCost(weekStart, we.toISOString().slice(0, 10)).total;
  },
  _min(t) { const [h, m] = (t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); },
  // True if this shift overlaps another shift for the same staff on the same day.
  isConflict(shift, idx) {
    if (!shift.start || !shift.end) return false;
    const ms = this._min(shift.start), me0 = this._min(shift.end);
    const me = me0 <= ms ? me0 + 1440 : me0;
    return this.draft.shifts.some((o, i) => {
      if (i === idx || o.staff_id !== shift.staff_id || o.day !== shift.day || !o.start || !o.end) return false;
      const os = this._min(o.start); let oe = this._min(o.end); if (oe <= os) oe += 1440;
      return os < me && oe > ms;
    });
  },

  // Pure totals over the current draft. Returns hours/cost/day rollups so the
  // grid footer and the budget bar always agree.
  computeTotals() {
    const byDay = {};
    this.DAYS.forEach(d => byDay[d] = { hours: 0, count: 0 });
    let hours = 0, cost = 0, conflicts = 0;
    this.draft.shifts.forEach((sh, i) => {
      if (!sh.staff_id || !sh.start || !sh.end) return;
      const c = this.shiftCalc(sh);
      hours += c.hours; cost += c.cost;
      if (byDay[sh.day]) { byDay[sh.day].hours += c.hours; byDay[sh.day].count += 1; }
      if (this.isConflict(sh, i)) conflicts++;
    });
    cost += this.salariedWeekCost(this.draft.week_start);
    return { hours, cost, byDay, conflicts };
  },

  shiftsFor(staffId, day) {
    const out = [];
    this.draft.shifts.forEach((sh, i) => { if (sh.staff_id === staffId && sh.day === day) out.push({ sh, i }); });
    return out;
  },

  // ── Render ────────────────────────────────────────────────────────────────
  draw() {
    const d = this.draft;
    const T = this.computeTotals();
    const target = this.laborTarget();
    const fc = this.forecastTotal(d.week_start);
    const budget = fc > 0 ? fc * target / 100 : 0;
    const left = budget - T.cost;
    const pct = fc > 0 ? T.cost / fc * 100 : null;
    const rplh = T.hours > 0 && fc > 0 ? fc / T.hours : null;

    // Forecast / labor-budget bar
    let budgetBar;
    if (!d.week_start) {
      budgetBar = '<div style="font-size:12px;color:var(--t3);">Pick the week starting date to set a forecast and labor budget.</div>';
    } else if (fc <= 0) {
      budgetBar = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">'
        + '<div style="font-size:12px;color:var(--t2);">Set this week\'s revenue forecast to schedule against a labor budget.</div>'
        + '<button class="btn btn-primary btn-sm" id="bs-fc">Set Forecast</button></div>';
    } else {
      const leftCls = left >= 0 ? 'good' : 'warn';
      budgetBar = '<div class="calc" style="margin-bottom:0;">'
        + '<div class="calc-item"><div class="calc-label">Revenue Forecast</div><div class="calc-val">' + App.fmtCurrency(fc)
        + ' <button class="btn btn-ghost btn-sm" id="bs-fc" style="font-size:10px;letter-spacing:1px;padding:2px 8px;vertical-align:middle;">Edit</button></div></div>'
        + '<div class="calc-item"><div class="calc-label">Labor Budget (' + App.fmtPct(target) + ')</div><div class="calc-val">' + App.fmtCurrency(budget) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Scheduled</div><div class="calc-val">' + App.fmtCurrency(T.cost) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">' + (left >= 0 ? 'Budget Left' : 'Over Budget') + '</div><div class="calc-val ' + leftCls + '">' + App.fmtCurrency(Math.abs(left)) + '</div></div>'
        + '</div>';
    }

    // Grid
    const days = this.DAYS;
    const headCells = days.map((day, i) => {
      const dd = this.dayDate(d.week_start, i);
      return '<th style="padding:8px 6px;text-align:center;font-size:10px;letter-spacing:1px;color:var(--t3);min-width:104px;">'
        + day + (dd ? '<div style="font-size:10px;color:var(--t4);font-weight:400;letter-spacing:0;">' + dd + '</div>' : '') + '</th>';
    }).join('');

    // Group active staff by department
    const groups = {};
    this.activeStaff().forEach(s => { const dep = this.deptOf(s.id); (groups[dep] = groups[dep] || []).push(s); });
    const orderedDepts = this.DEPT_ORDER.filter(x => groups[x]).concat(Object.keys(groups).filter(x => this.DEPT_ORDER.indexOf(x) < 0));

    let body = '';
    orderedDepts.forEach(dep => {
      body += '<tr><td colspan="' + (days.length + 1) + '" style="padding:10px 8px 4px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">' + esc(dep) + '</td></tr>';
      groups[dep].sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(s => {
        const sal = App.isSalaried(s);
        const wageLabel = sal ? 'Salary' : (s.wage != null ? App.fmtCurrency(s.wage) + '/hr' : '');
        let row = '<tr>'
          + '<td style="padding:6px 8px;border-top:1px solid var(--b2);white-space:nowrap;">'
          + '<div style="font-size:13px;color:var(--t1);font-weight:600;">' + esc(s.name || '-') + '</div>'
          + '<div style="font-size:10px;color:var(--t4);">' + esc(wageLabel) + '</div></td>';
        days.forEach(day => {
          const items = this.shiftsFor(s.id, day);
          let cellInner = '';
          items.forEach(({ sh, i }) => {
            const c = this.shiftCalc(sh);
            const conflict = this.isConflict(sh, i);
            const border = conflict ? 'var(--red)' : 'var(--gold)';
            cellInner += '<div class="bs-block" data-idx="' + i + '" title="Click to edit"'
              + ' style="cursor:pointer;border:1px solid ' + border + ';border-radius:4px;padding:3px 5px;margin-bottom:3px;background:var(--surface);">'
              + '<div style="font-size:11px;color:var(--t1);font-weight:600;">' + esc(this._fmtTime(sh.start)) + '–' + esc(this._fmtTime(sh.end)) + '</div>'
              + '<div style="font-size:9px;color:var(--t3);">' + (sal ? 'salaried' : c.hours.toFixed(1) + 'h') + (conflict ? ' · overlap' : '') + '</div>'
              + '</div>';
          });
          cellInner += '<div class="bs-add-cell" style="text-align:center;color:var(--t4);font-size:14px;cursor:pointer;line-height:1.2;padding:' + (items.length ? '0' : '8px') + ' 0;">+</div>';
          row += '<td class="bs-cell" data-staff="' + esc(s.id) + '" data-day="' + day + '" style="padding:4px;border-top:1px solid var(--b2);vertical-align:top;border-left:1px solid var(--b2);">' + cellInner + '</td>';
        });
        row += '</tr>';
        body += row;
      });
    });

    // Per-day footer (coverage)
    let footer = '<tr><td style="padding:8px;font-size:10px;letter-spacing:1px;color:var(--t3);text-align:right;border-top:1px solid var(--b1);">Day total</td>';
    days.forEach(day => {
      const dd = T.byDay[day];
      footer += '<td style="padding:6px;text-align:center;border-top:1px solid var(--b1);border-left:1px solid var(--b2);">'
        + '<div style="font-size:12px;color:var(--t1);font-weight:600;">' + dd.hours.toFixed(1) + 'h</div>'
        + '<div style="font-size:9px;color:var(--t4);">' + dd.count + ' shift' + (dd.count === 1 ? '' : 's') + '</div></td>';
    });
    footer += '</tr>';

    const gridCard = '<div class="card"><div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<span>Weekly Grid</span>'
      + '<span style="font-size:11px;color:var(--t3);font-weight:400;">Click a day cell to add a shift</span></div>'
      + (this.activeStaff().length === 0 ? '' : '')
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">'
      + '<thead><tr><th style="padding:8px;text-align:left;font-size:10px;letter-spacing:1px;color:var(--t3);">Staff</th>' + headCells + '</tr></thead>'
      + '<tbody>' + body + footer + '</tbody></table></div>'
      + (T.conflicts > 0 ? '<div style="font-size:11px;color:var(--red);font-weight:700;margin-top:10px;">' + T.conflicts + ' overlapping shift' + (T.conflicts === 1 ? '' : 's') + ' on the same person and day. The red blocks need fixing.</div>' : '')
      + '</div>';

    // Totals strip
    const totalsCard = '<div class="card"><div class="calc" style="margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Labor Hours</div><div class="calc-val">' + T.hours.toFixed(1) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor Cost</div><div class="calc-val">' + App.fmtCurrency(T.cost) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor %</div><div class="calc-val ' + (pct != null ? (pct > target ? 'warn' : 'good') : '') + '">' + (pct != null ? App.fmtPct(pct) : '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Target</div><div class="calc-val dim">' + App.fmtPct(target) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">RPLH</div><div class="calc-val">' + (rplh != null ? App.fmtCurrency(rplh) : '-') + '</div></div>'
      + '</div></div>';

    // Template + save actions
    const tmpls = this.templates();
    const tmplOpts = tmpls.length
      ? '<option value="">Apply a template...</option>' + tmpls.map(t => '<option value="' + esc(t.id) + '">' + esc(t.name) + ' (' + ((t.shifts || []).length) + ' shifts)</option>').join('')
      : '';
    const actionsCard = '<div class="card"><div class="card-title">Templates and Save</div>'
      + '<div class="form-row" style="gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px;">'
      + (tmpls.length
          ? '<div class="f" style="width:260px;"><label>Apply Template</label><select id="bs-tmpl">' + tmplOpts + '</select></div>'
            + '<button class="btn btn-ghost" id="bs-tmpl-apply" style="margin-bottom:2px;">Apply</button>'
          : '<div style="font-size:11px;color:var(--t3);padding-bottom:10px;">No templates yet. Build a week, then save it as a template to reuse it.</div>')
      + '<button class="btn btn-ghost" id="bs-save-tmpl" style="margin-bottom:2px;">Save Week as Template</button>'
      + '</div>'
      + '<div class="f" style="margin-bottom:14px;"><label>Notes</label><textarea id="bs-notes" rows="2" placeholder="Optional">' + esc(d.notes || '') + '</textarea></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary btn-lg" id="bs-save">' + (this.editId ? 'Update Schedule' : 'Save Schedule') + '</button>'
      + (this.editId ? '<button class="btn btn-ghost" id="bs-cancel">Cancel Edit</button>' : '')
      + '<span id="bs-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div class="card-title">Week and Labor Budget</div>'
      + '<div class="form-row" style="gap:16px;align-items:flex-end;margin-bottom:14px;">'
      + '<div class="f" style="width:170px;flex-shrink:0;"><label>Week Starting (Monday)</label>'
      + '<input type="date" id="bs-week" value="' + esc(d.week_start) + '"/></div>'
      + '</div>' + budgetBar + '</div>'
      + gridCard + totalsCard + actionsCard
      + '</div>'
      + this._modalHtml();

    this._wire();
  },

  _fmtTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h)) return esc(t);
    const ap = h < 12 ? 'a' : 'p';
    let hr = h % 12; if (hr === 0) hr = 12;
    return hr + (m ? ':' + String(m).padStart(2, '0') : '') + ap;
  },

  _wire() {
    document.getElementById('bs-week')?.addEventListener('change', e => {
      this.draft.week_start = this.mondayOf(e.target.value) || '';
      this.saveDraft(); this.draw();
    });
    document.getElementById('bs-notes')?.addEventListener('input', e => { this.draft.notes = e.target.value || ''; this.saveDraft(); });
    document.getElementById('bs-fc')?.addEventListener('click', () => this.openForecastModal());
    document.getElementById('bs-save')?.addEventListener('click', () => this.save());
    document.getElementById('bs-cancel')?.addEventListener('click', () => { this.editId = null; App.navigate('lc-schedule-history'); });
    document.getElementById('bs-tmpl-apply')?.addEventListener('click', () => this.applyTemplate(document.getElementById('bs-tmpl')?.value));
    document.getElementById('bs-save-tmpl')?.addEventListener('click', () => this.openSaveTemplateModal());

    // Grid cell clicks: edit a block, or add to a cell.
    this.container.querySelectorAll('.bs-cell').forEach(cell => {
      cell.addEventListener('click', ev => {
        const block = ev.target.closest('.bs-block');
        if (block) { ev.stopPropagation(); this.openShiftModal(cell.dataset.staff, cell.dataset.day, parseInt(block.dataset.idx, 10)); return; }
        this.openShiftModal(cell.dataset.staff, cell.dataset.day, null);
      });
    });
  },

  // ── Shift add/edit modal ────────────────────────────────────────────────────
  _modalHtml() {
    return '<div id="bs-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9500;align-items:center;justify-content:center;padding:20px;">'
      + '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:24px 28px;max-width:420px;width:100%;">'
      + '<div id="bs-m-title" style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:14px;"></div>'
      + '<div class="form-row" style="gap:14px;">'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>Start</label><input type="time" id="bs-m-start"/></div>'
      + '<div class="f" style="width:130px;flex-shrink:0;"><label>End</label><input type="time" id="bs-m-end"/></div>'
      + '</div>'
      + '<div id="bs-m-calc" style="font-size:11px;color:var(--t3);margin-top:6px;min-height:14px;"></div>'
      + '<div id="bs-m-err" style="display:none;font-size:11px;color:var(--red);margin-top:8px;"></div>'
      + '<div style="display:flex;justify-content:space-between;gap:10px;margin-top:18px;">'
      + '<div><button class="btn btn-ghost" id="bs-m-remove" style="color:var(--red);display:none;">Remove</button></div>'
      + '<div style="display:flex;gap:10px;"><button class="btn btn-ghost" id="bs-m-cancel">Cancel</button>'
      + '<button class="btn btn-primary" id="bs-m-save">Save Shift</button></div>'
      + '</div></div></div>';
  },

  openShiftModal(staffId, day, idx) {
    const staff = this.staffById(staffId);
    if (!staff) return;
    const editing = idx != null && this.draft.shifts[idx];
    const sh = editing ? this.draft.shifts[idx] : { staff_id: staffId, day, start: '', end: '' };
    const modal = document.getElementById('bs-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('bs-m-title').textContent = (staff.name || 'Staff') + ' · ' + day;
    const startEl = document.getElementById('bs-m-start');
    const endEl = document.getElementById('bs-m-end');
    const calcEl = document.getElementById('bs-m-calc');
    const errEl = document.getElementById('bs-m-err');
    const removeBtn = document.getElementById('bs-m-remove');
    startEl.value = sh.start || '';
    endEl.value = sh.end || '';
    errEl.style.display = 'none';
    removeBtn.style.display = editing ? 'inline-block' : 'none';
    const sal = App.isSalaried(staff);
    const updateCalc = () => {
      const h = this.hoursOf(startEl.value, endEl.value);
      if (!startEl.value || !endEl.value) { calcEl.textContent = ''; return; }
      if (sal) { calcEl.textContent = h.toFixed(1) + ' hrs · salaried (no hourly cost)'; return; }
      const wage = App.wageForStaffOn ? App.wageForStaffOn(staff.id, this.draft.week_start) : (staff.wage || 0);
      calcEl.textContent = h.toFixed(1) + ' hrs · ' + App.fmtCurrency(h * wage) + (wage ? ' @ ' + App.fmtCurrency(wage) + '/hr' : '');
    };
    updateCalc();
    startEl.oninput = updateCalc;
    endEl.oninput = updateCalc;
    const close = () => { modal.style.display = 'none'; startEl.oninput = null; endEl.oninput = null; };
    document.getElementById('bs-m-cancel').onclick = close;
    modal.onclick = ev => { if (ev.target === modal) close(); };
    removeBtn.onclick = () => { if (editing) { this.draft.shifts.splice(idx, 1); this.saveDraft(); } close(); this.draw(); };
    document.getElementById('bs-m-save').onclick = () => {
      const start = startEl.value, end = endEl.value;
      if (!start || !end) { errEl.textContent = 'Set a start and end time.'; errEl.style.display = 'block'; return; }
      if (editing) { this.draft.shifts[idx] = { staff_id: staffId, day, start, end }; }
      else { this.draft.shifts.push({ staff_id: staffId, day, start, end }); }
      this.saveDraft(); close(); this.draw();
    };
  },

  // ── Forecast modal (writes revenue_forecasts) ────────────────────────────────
  openForecastModal() {
    if (!this.draft.week_start) return;
    const rec = this.forecastForWeek(this.draft.week_start);
    const cur = rec && rec.total != null ? rec.total : '';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:24px 28px;max-width:440px;width:100%;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:6px;">Revenue Forecast</div>'
      + '<div style="font-size:11px;color:var(--t3);line-height:1.6;margin-bottom:14px;">Your expected sales for this week. Bar Cop turns it into a labor budget (' + App.fmtPct(this.laborTarget()) + ' of forecast) so you can see whether the schedule fits before you post it. For a detailed day-by-day forecast, use Revenue Recovery.</div>'
      + '<div class="f" style="width:200px;"><label>Expected Revenue ($)</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="bs-fc-val" min="0" step="100" value="' + (cur === '' ? '' : esc(String(cur))) + '" placeholder="0"/></div></div>'
      + '<div id="bs-fc-err" style="display:none;font-size:11px;color:var(--red);margin-top:8px;"></div>'
      + '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;">'
      + '<button class="btn btn-ghost" data-act="cancel">Cancel</button>'
      + '<button class="btn btn-primary" data-act="save">Save Forecast</button></div></div>';
    document.body.appendChild(overlay);
    const close = () => document.body.removeChild(overlay);
    overlay.addEventListener('click', async ev => {
      const act = ev.target.closest('[data-act]')?.dataset.act;
      if (!act) { if (ev.target === overlay) close(); return; }
      if (act === 'cancel') { close(); return; }
      const raw = document.getElementById('bs-fc-val')?.value;
      const val = parseFloat(raw);
      const errEl = document.getElementById('bs-fc-err');
      if (isNaN(val) || val < 0) { errEl.textContent = 'Enter the expected revenue for the week.'; errEl.style.display = 'block'; return; }
      if (!Array.isArray(App.data.revenue_forecasts)) App.data.revenue_forecasts = [];
      const list = App.data.revenue_forecasts;
      const ws = this.draft.week_start;
      const existing = list.find(f => f.week_start === ws);
      if (existing) { existing.total = Math.round(val * 100) / 100; existing.updated_at = new Date().toISOString(); }
      else list.push({ id: App.uid(), week_start: ws, total: Math.round(val * 100) / 100, per_day: {}, method: 'manual', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      await App.saveKey('revenue_forecasts');
      close(); this.draw();
    });
  },

  // ── Templates ────────────────────────────────────────────────────────────────
  async applyTemplate(id) {
    if (!id) return;
    const t = this.templates().find(x => x.id === id);
    if (!t) return;
    if (this.draft.shifts.length) {
      const ok = await App.confirm({ title: 'Apply template?', message: 'This replaces the shifts currently in the grid with the template\'s shifts.', confirmText: 'Apply', cancelText: 'Cancel' });
      if (!ok) return;
    }
    this.draft.shifts = (t.shifts || []).map(s => ({ staff_id: s.staff_id, day: s.day, start: s.start, end: s.end }));
    this.saveDraft(); this.draw();
  },

  openSaveTemplateModal() {
    const validShifts = this.draft.shifts.filter(sh => sh.staff_id && sh.start && sh.end);
    if (validShifts.length === 0) { const e = document.getElementById('bs-err'); if (e) { e.textContent = 'Add some shifts before saving a template.'; e.style.display = 'inline'; } return; }
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:24px 28px;max-width:420px;width:100%;">'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:6px;">Save Week as Template</div>'
      + '<div style="font-size:11px;color:var(--t3);line-height:1.6;margin-bottom:14px;">Saves the ' + validShifts.length + ' shifts in the grid as a reusable template you can apply to any week.</div>'
      + '<div class="f"><label>Template Name</label><input type="text" id="bs-tmpl-name" placeholder="e.g. Standard Week"/></div>'
      + '<div id="bs-tmpl-err" style="display:none;font-size:11px;color:var(--red);margin-top:8px;"></div>'
      + '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;">'
      + '<button class="btn btn-ghost" data-act="cancel">Cancel</button>'
      + '<button class="btn btn-primary" data-act="save">Save Template</button></div></div>';
    document.body.appendChild(overlay);
    const close = () => document.body.removeChild(overlay);
    overlay.addEventListener('click', async ev => {
      const act = ev.target.closest('[data-act]')?.dataset.act;
      if (!act) { if (ev.target === overlay) close(); return; }
      if (act === 'cancel') { close(); return; }
      const name = (document.getElementById('bs-tmpl-name')?.value || '').trim();
      const errEl = document.getElementById('bs-tmpl-err');
      if (!name) { errEl.textContent = 'Give the template a name.'; errEl.style.display = 'block'; return; }
      if (!App.laborData) App.laborData = {};
      if (!Array.isArray(App.laborData.lc_schedule_templates)) App.laborData.lc_schedule_templates = [];
      App.laborData.lc_schedule_templates.push({
        id: App.uid(), name,
        shifts: validShifts.map(s => ({ staff_id: s.staff_id, day: s.day, start: s.start, end: s.end })),
        created_at: new Date().toISOString()
      });
      await App.saveLabor();
      close(); this.draw();
    });
  },

  // ── Save schedule ────────────────────────────────────────────────────────────
  async save() {
    const d = this.draft;
    const err = document.getElementById('bs-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (!d.week_start) { fail('Choose the week starting date.'); return; }
    const validShifts = d.shifts.filter(sh => sh.staff_id && sh.start && sh.end);
    if (validShifts.length === 0) { fail('Add at least one complete shift.'); return; }

    let totalHours = 0, totalCost = 0;
    const shifts = validShifts.map(sh => {
      const c = this.shiftCalc(sh);
      totalHours += c.hours; totalCost += c.cost;
      return {
        staff_id: sh.staff_id, name: c.staff ? c.staff.name : '',
        position_id: c.staff ? c.staff.position_id : '',
        day: sh.day, start: sh.start, end: sh.end,
        hours: c.hours, wage: c.wage, cost: c.cost
      };
    });
    totalCost += this.salariedWeekCost(d.week_start);
    const forecast = this.forecastTotal(d.week_start);

    const rec = {
      id:               this.editId || App.uid(),
      week_start:       d.week_start,
      revenue_forecast: forecast,
      shifts,
      total_hours:      totalHours,
      total_cost:       totalCost,
      labor_pct:        forecast > 0 ? totalCost / forecast * 100 : null,
      rplh:             totalHours > 0 && forecast > 0 ? forecast / totalHours : null,
      notes:            d.notes || '',
      status:           'Posted'
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.schedules();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
      else list.push(rec);
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('bs-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('lc', 'schedule', saved);
    if (ok) {
      App.markSetupDone('gs_lc_schedule');
      this.editId = null;
      this.clearDraft();
      App.navigate('lc-schedule-history');
    } else {
      if (btn) { btn.disabled = false; btn.textContent = this.editId ? 'Update Schedule' : 'Save Schedule'; }
      fail('Save failed. Try again.');
    }
  }
};
