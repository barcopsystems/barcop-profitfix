'use strict';

/* ── Labor Control — Build Schedule (writes lc_schedules) ─────────────────────
   Builds a weekly staff schedule against a revenue forecast, with live labor
   cost, labor %, and RPLH versus target. Saved schedules go to lc_schedules and
   appear in Schedule History. */

S.LaborBuildSchedule = {
  draft: null,
  editId: null,
  DRAFT_KEY: 'lc_sched_draft',
  DAYS: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],

  schedules() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_schedules)) App.laborData.lc_schedules = [];
    return App.laborData.lc_schedules;
  },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
  positionById(id) { return ((App.laborData && App.laborData.lc_positions) || []).find(p => p.id === id); },

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

  // ── Draft lifecycle ─────────────────────────────────────────────────────────
  loadDraft() {
    if (this.editId) {
      const sched = this.schedules().find(s => s.id === this.editId);
      if (sched) {
        return {
          week_start: sched.week_start || '',
          revenue_forecast: sched.revenue_forecast != null ? String(sched.revenue_forecast) : '',
          shifts: (sched.shifts || []).map(sh => ({
            staff_id: sh.staff_id, day: sh.day, start: sh.start, end: sh.end
          })),
          notes: sched.notes || ''
        };
      }
    }
    try { const r = localStorage.getItem(this.DRAFT_KEY); if (r) return JSON.parse(r); } catch (e) {}
    return { week_start: '', revenue_forecast: '', shifts: [], notes: '' };
  },
  saveDraft() {
    if (this.editId) return;
    try { localStorage.setItem(this.DRAFT_KEY, JSON.stringify(this.draft)); } catch (e) {}
  },
  clearDraft() { try { localStorage.removeItem(this.DRAFT_KEY); } catch (e) {} },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.draft = this.loadDraft();

    if (this.staff().length === 0) {
      this.container.innerHTML = '<div class="screen"><div class="empty">'
        + '<div class="empty-title">Add staff first</div>'
        + '<div class="empty-sub">A schedule is built from your roster. Add staff in Staff Roster, then '
        + 'come back to build the week.</div>'
        + '<button class="btn btn-primary" id="bs-go-roster">Go to Staff Roster</button></div></div>';
      this.container.onclick = ev => { if (ev.target.closest('#bs-go-roster')) App.navigate('lc-staff-roster'); };
      return;
    }
    this.draw();
  },

  staffOptions(selId) {
    return '<option value="">Staff...</option>'
      + this.staff().filter(s => s.status !== 'Inactive' || s.id === selId).map(s =>
          '<option value="' + s.id + '"' + (s.id === selId ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
  },
  dayOptions(sel) {
    return this.DAYS.map(d => '<option' + (d === sel ? ' selected' : '') + '>' + d + '</option>').join('');
  },

  shiftRow(sh, idx) {
    return '<div class="bs-row" data-idx="' + idx + '" style="display:flex;gap:10px;align-items:flex-end;'
      + 'flex-wrap:wrap;padding:10px;border:1px solid var(--b1);border-radius:6px;margin-bottom:8px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Staff</label>'
      + '<select class="bs-staff">' + this.staffOptions(sh.staff_id) + '</select></div>'
      + '<div class="f" style="width:84px;flex-shrink:0;"><label>Day</label>'
      + '<select class="bs-day">' + this.dayOptions(sh.day) + '</select></div>'
      + '<div class="f" style="width:104px;flex-shrink:0;"><label>Start</label>'
      + '<input type="time" class="bs-start" value="' + esc(sh.start || '') + '"/></div>'
      + '<div class="f" style="width:104px;flex-shrink:0;"><label>End</label>'
      + '<input type="time" class="bs-end" value="' + esc(sh.end || '') + '"/></div>'
      + '<div class="f" style="flex:1;min-width:150px;"><label>&nbsp;</label>'
      + '<div class="bs-rowcalc" style="font-size:12px;color:var(--t3);padding-bottom:8px;">—</div></div>'
      + '<button class="btn btn-ghost btn-sm bs-remove" style="margin-bottom:6px;">Remove</button>'
      + '</div>';
  },

  draw() {
    const d = this.draft;
    const rows = d.shifts.length
      ? d.shifts.map((sh, i) => this.shiftRow(sh, i)).join('')
      : '<div style="font-size:12px;color:var(--t3);margin-bottom:8px;">No shifts yet. Add the first shift below.</div>';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="card"><div class="card-title">Schedule Period</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Week Starting</label>'
      + '<input type="date" id="bs-week" value="' + esc(d.week_start) + '" oninput="S.LaborBuildSchedule.onInput()"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Revenue Forecast</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="bs-forecast" min="0" step="0.01" '
      + 'value="' + esc(d.revenue_forecast) + '" oninput="S.LaborBuildSchedule.onInput()"/></div></div>'
      + '</div></div>'

      + '<div class="card"><div class="card-title">Shifts</div>'
      + '<div id="bs-rows">' + rows + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="bs-add">+ Add Shift</button>'
      + '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Labor Hours</div><div class="calc-val" id="bs-hours">—</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor Cost</div><div class="calc-val" id="bs-cost">—</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor %</div><div class="calc-val" id="bs-pct">—</div></div>'
      + '<div class="calc-item"><div class="calc-label">Target</div><div class="calc-val dim">' + App.fmtPct(this.laborTarget()) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">RPLH</div><div class="calc-val" id="bs-rplh">—</div></div>'
      + '</div></div>'

      + '<div class="card"><div class="card-title">Review</div>'
      + '<div class="f" style="margin-bottom:14px;"><label>Notes</label>'
      + '<textarea id="bs-notes" rows="2" placeholder="Optional" oninput="S.LaborBuildSchedule.onInput()">' + esc(d.notes || '') + '</textarea></div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary btn-lg" id="bs-save">' + (this.editId ? 'Update Schedule' : 'Save Schedule') + '</button>'
      + (this.editId ? '<button class="btn btn-ghost" id="bs-cancel">Cancel Edit</button>' : '')
      + '<span id="bs-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div></div>';

    const rowsEl = document.getElementById('bs-rows');
    rowsEl.addEventListener('input', () => this.onInput());
    rowsEl.addEventListener('change', () => this.onInput());
    rowsEl.addEventListener('click', ev => {
      if (ev.target.closest('.bs-remove')) {
        this.collect();
        const idx = parseInt(ev.target.closest('.bs-row').dataset.idx, 10);
        this.draft.shifts.splice(idx, 1);
        this.saveDraft();
        this.draw();
      }
    });
    document.getElementById('bs-add')?.addEventListener('click', () => {
      this.collect();
      this.draft.shifts.push({ staff_id: '', day: 'Mon', start: '', end: '' });
      this.saveDraft();
      this.draw();
    });
    document.getElementById('bs-save')?.addEventListener('click', () => this.save());
    document.getElementById('bs-cancel')?.addEventListener('click', () => {
      this.editId = null;
      App.navigate('lc-schedule-history');
    });
    this.recalc();
  },

  collect() {
    const d = this.draft;
    d.week_start = document.getElementById('bs-week')?.value || '';
    d.revenue_forecast = document.getElementById('bs-forecast')?.value || '';
    d.notes = document.getElementById('bs-notes')?.value || '';
    const rows = [...document.querySelectorAll('.bs-row')];
    if (rows.length) {
      d.shifts = rows.map(r => ({
        staff_id: r.querySelector('.bs-staff')?.value || '',
        day:      r.querySelector('.bs-day')?.value || 'Mon',
        start:    r.querySelector('.bs-start')?.value || '',
        end:      r.querySelector('.bs-end')?.value || ''
      }));
    }
  },

  onInput() {
    this.collect();
    this.saveDraft();
    this.recalc();
  },

  // compute one shift's hours, wage, cost
  shiftCalc(sh) {
    const staff = this.staffById(sh.staff_id);
    const hours = this.hoursOf(sh.start, sh.end);
    const wage = staff && staff.wage != null ? staff.wage : 0;
    return { staff, hours, wage, cost: hours * wage };
  },

  recalc() {
    let totalHours = 0, totalCost = 0;
    [...document.querySelectorAll('.bs-row')].forEach((row, i) => {
      const sh = this.draft.shifts[i];
      if (!sh) return;
      const c = this.shiftCalc(sh);
      totalHours += c.hours;
      totalCost += c.cost;
      const calcEl = row.querySelector('.bs-rowcalc');
      if (calcEl) {
        calcEl.textContent = c.hours > 0
          ? c.hours.toFixed(1) + ' hrs · ' + App.fmtCurrency(c.cost) + (c.staff ? ' @ ' + App.fmtCurrency(c.wage) + '/hr' : '')
          : (c.staff ? 'Set start and end times.' : 'Pick a staff member.');
      }
    });
    const forecast = parseFloat(document.getElementById('bs-forecast')?.value) || 0;
    const pct = forecast > 0 ? totalCost / forecast * 100 : null;
    const rplh = totalHours > 0 ? forecast / totalHours : null;
    const target = this.laborTarget();

    const set = (id, val, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = val; el.className = 'calc-val' + (cls ? ' ' + cls : ''); };
    set('bs-hours', totalHours.toFixed(1));
    set('bs-cost', App.fmtCurrency(totalCost));
    set('bs-pct', pct != null ? App.fmtPct(pct) : '—', pct != null ? (pct > target ? 'warn' : 'good') : '');
    set('bs-rplh', rplh != null ? App.fmtCurrency(rplh) : '—');
  },

  async save() {
    this.collect();
    const d = this.draft;
    const err = document.getElementById('bs-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (!d.week_start) { fail('Choose the week starting date.'); return; }
    const validShifts = d.shifts.filter(sh => sh.staff_id && sh.start && sh.end);
    if (validShifts.length === 0) { fail('Add at least one complete shift.'); return; }

    let totalHours = 0, totalCost = 0;
    const shifts = validShifts.map(sh => {
      const c = this.shiftCalc(sh);
      totalHours += c.hours;
      totalCost += c.cost;
      return {
        staff_id: sh.staff_id,
        name: c.staff ? c.staff.name : '',
        position_id: c.staff ? c.staff.position_id : '',
        day: sh.day, start: sh.start, end: sh.end,
        hours: c.hours, wage: c.wage, cost: c.cost
      };
    });
    const forecast = parseFloat(d.revenue_forecast) || 0;

    const rec = {
      id:               this.editId || App.uid(),
      week_start:       d.week_start,
      revenue_forecast: forecast,
      shifts,
      total_hours:      totalHours,
      total_cost:       totalCost,
      labor_pct:        forecast > 0 ? totalCost / forecast * 100 : null,
      rplh:             totalHours > 0 ? forecast / totalHours : null,
      notes:            d.notes || '',
      status:           'Posted'
    };
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.schedules();
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) list[i] = { ...list[i], ...rec };
    } else {
      list.push(rec);
    }

    const btn = document.getElementById('bs-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.saveLabor();
    if (ok) {
      this.editId = null;
      this.clearDraft();
      App.navigate('lc-schedule-history');
    } else {
      if (this.editId) { /* list item already replaced; leave for retry */ }
      else list.pop();
      if (btn) { btn.disabled = false; btn.textContent = 'Save Schedule'; }
      fail('Save failed. Try again.');
    }
  }
};
