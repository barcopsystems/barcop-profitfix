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

  // One canonical labor-cost target, shared with Revenue Recovery (App.laborTargetPct).
  laborTarget() { return App.laborTargetPct(); },
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
    return App.ymdLocal(d);
  },
  // Date label for a given day column, derived from the (Monday) week_start.
  dayDate(weekStart, dayIdx) {
    if (!weekStart) return '';
    const d = new Date(weekStart + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + dayIdx);
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  },
  // The ISO (YYYY-MM-DD) date for a day column, used to match a day to a booking.
  dayIso(weekStart, dayIdx) {
    if (!weekStart) return '';
    const d = new Date(weekStart + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + dayIdx);
    return App.ymdLocal(d);
  },
  // Confirmed events (Booked / Completed) falling on a given calendar day.
  bookingsOnDate(iso) {
    if (!iso) return [];
    return ((App.data && App.data.bookings) || []).filter(b =>
      (b.stage === 'Booked' || b.stage === 'Completed') && String(b.event_date || '').slice(0, 10) === iso);
  },
  bookingName(b) { return (window.S && S.EventsBookings) ? S.EventsBookings.title(b) : (b.event_name || b.contact_name || 'the event'); },
  // A new, unsaved build (no editId, has shifts) would be discarded by loading
  // another week, so confirm first. Viewing/editing a posted week needs no
  // confirm — switching just re-reads the target week.
  confirmLeaveUnsaved() {
    if (this.editId || !(this.draft.shifts || []).length) return Promise.resolve(true);
    return App.confirm({
      title: 'Leave this unsaved schedule?',
      message: 'You have a schedule started for this week that has not been saved. Switching weeks clears it. Save it first if you want to keep it.',
      confirmText: 'Switch Weeks', cancelText: 'Stay', danger: false
    });
  },
  // Jump the schedule a week back/forward from the arrow buttons, loading the
  // target week's posted schedule or a fresh grid.
  async shiftWeek(days) {
    const base = this.draft.week_start || this.mondayOf(App.todayLocal());
    const d = new Date(base + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    d.setDate(d.getDate() + days);
    const target = this.mondayOf(App.ymdLocal(d));
    if (!(await this.confirmLeaveUnsaved())) return;
    this.loadWeek(target);
    this.draw();
  },
  weekLabel(ws) {
    const dt = new Date((ws || '') + 'T00:00:00');
    return isNaN(dt.getTime()) ? esc(ws || '') : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },
  // Step a Monday week_start by n weeks, returning the resulting Monday.
  addWeeks(ws, n) {
    const base = ws || this.mondayOf(App.todayLocal());
    const d = new Date(base + 'T00:00:00');
    if (isNaN(d.getTime())) return base;
    d.setDate(d.getDate() + n * 7);
    return this.mondayOf(App.ymdLocal(d));
  },
  // The Monday-based week selector that replaces the calendar: a window of week
  // chips (each labeled by its Monday date, the live current week tagged NOW, the
  // selected week gold-tint) flanked by step arrows, plus a snap back to the
  // current week. Every option is already a Monday, so there is no calendar to
  // open and no wrong day to pick.
  weekSelector() {
    const sel = this.draft.week_start || this.mondayOf(App.todayLocal());
    const cur = this.mondayOf(App.todayLocal());
    const chip = ws => {
      const on = ws === sel, isCur = ws === cur;
      return '<button type="button" class="bs-week-chip btn btn-sm" data-ws="' + ws + '" style="'
        + (on ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">'
        + App.dateRangeLabel(ws, App.periodEndFor(ws))
        + (isCur ? ' <span style="font-size:8px;font-weight:700;letter-spacing:1px;color:var(--gold);">NOW</span>' : '')
        + '</button>';
    };
    let chips = '';
    for (let i = -1; i <= 0; i++) chips += chip(this.addWeeks(sel, i));
    return '<div class="no-print" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
      + '<button class="btn btn-ghost btn-sm" id="bs-week-prev" title="Previous week" aria-label="Previous week">&lsaquo;</button>'
      + chips
      + '<button class="btn btn-ghost btn-sm" id="bs-week-next" title="Next week" aria-label="Next week">&rsaquo;</button>'
      + (sel !== cur ? '<button type="button" class="btn btn-ghost btn-sm" id="bs-week-now" style="margin-left:4px;">This Week</button>' : '')
      + '</div>';
  },
  // The most recent posted schedule strictly before the current week, used to
  // offer "Start from last week" on an empty grid.
  priorSchedule() {
    const ws = this.draft && this.draft.week_start;
    if (!ws) return null;
    return this.schedules()
      .filter(s => (s.week_start || '') < ws && (s.shifts || []).length)
      .sort((a, b) => (b.week_start || '').localeCompare(a.week_start || ''))[0] || null;
  },

  // ── Draft lifecycle ─────────────────────────────────────────────────────────
  loadDraft() {
    if (this.editId) {
      const sched = this.schedules().find(s => s.id === this.editId);
      if (sched) {
        return {
          week_start: sched.week_start || '',
          shifts: (sched.shifts || []).map(sh => ({ staff_id: sh.staff_id, day: sh.day, start: sh.start, end: sh.end, event: sh.event || '' })),
          notes: sched.notes || ''
        };
      }
    }
    try { const r = localStorage.getItem(this.DRAFT_KEY); if (r) return JSON.parse(r); } catch (e) {}
    return { week_start: this.mondayOf(App.todayLocal()), shifts: [], notes: '' };
  },
  saveDraft() { if (this.editId) return; try { localStorage.setItem(this.DRAFT_KEY, JSON.stringify(this.draft)); } catch (e) {} },
  clearDraft() { try { localStorage.removeItem(this.DRAFT_KEY); } catch (e) {} },
  savedDraft() { try { const r = localStorage.getItem(this.DRAFT_KEY); if (r) return JSON.parse(r); } catch (e) {} return null; },

  // Point the grid at a given week: its posted schedule (editable, editId set) if
  // one exists, otherwise an empty grid for that week (editId null, ready to
  // build). editId always tracks the displayed week so a save targets the right
  // record (or hits the duplicate-week guard for a brand-new week).
  loadWeek(wk) {
    const posted = this.schedules().find(s => s.week_start === wk);
    if (posted) {
      this.editId = posted.id;
      this.draft = {
        week_start: posted.week_start || wk,
        shifts: (posted.shifts || []).map(sh => ({ staff_id: sh.staff_id, day: sh.day, start: sh.start, end: sh.end, event: sh.event || '' })),
        notes: posted.notes || ''
      };
    } else {
      this.editId = null;
      this.draft = { week_start: wk, shifts: [], notes: '' };
    }
    this.saveDraft();
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    // Events "Schedule Staff for this Event" jump: land on the event's week and
    // show a context banner. Reuses the one-shot _gotoWeek handoff below.
    if (App._eventStaffDate) {
      this._gotoWeek = this.mondayOf(App._eventStaffDate);
      this._eventContext = { name: App._eventStaffTag || '', date: App._eventStaffDate };
      App._eventStaffDate = null; App._eventStaffTag = null;
    }
    // Landing behavior. Every week change re-resolves editId to that week's
    // posted schedule (or null), so editId always matches the displayed week and
    // a save can never overwrite the wrong week.
    if (this._enterEdit) {
      // Explicit Edit handoff from Schedule History: resume that posted schedule
      // by id (loadDraft reads it because editId is already set).
      this._enterEdit = false;
      this.draft = this.loadDraft();
    } else if (this._gotoWeek) {
      // One-shot "go to this week" (e.g. Overtime Watch → View Schedule).
      const gw = this._gotoWeek; this._gotoWeek = null;
      this.editId = null;
      this.loadWeek(gw);
    } else {
      // Plain visit: resume an in-progress unsaved build if there is one, else
      // land on the CURRENT week, showing its posted schedule (editable) or an
      // empty grid ready to build. Landing on a populated current week saves the
      // trip through Schedule History to make a quick change to this week.
      this.editId = null;
      const saved = this.savedDraft();
      if (saved && (saved.shifts || []).length) this.draft = saved;
      else this.loadWeek(this.mondayOf(App.todayLocal()));
    }
    if (this.activeStaff().length === 0) {
      App.setupCard(this.container, {
        title: 'Build Your First Schedule',
        lead: 'A schedule is built from your roster. Add your staff and you can lay out the week on a grid with a live labor budget.',
        steps: [
          { title: 'Add your staff', desc: 'A schedule is built from your roster, so build it first.', btn: 'Go to Staff Roster', screen: 'lc-staff-roster', done: false }
        ]
      });
      return;
    }
    this.draw();
  },

  // ── Shift math + conflicts ──────────────────────────────────────────────────
  shiftCalc(sh) {
    const staff = this.staffById(sh.staff_id);
    const hours = this.hoursOf(sh.start, sh.end);
    const wkDate = this.draft.week_start || App.todayLocal();
    if (staff && App.isSalaried(staff)) return { staff, hours, wage: 0, cost: 0, salaried: true };
    const wage = staff ? (App.wageForStaffOn ? App.wageForStaffOn(staff.id, wkDate) : (staff.wage || 0)) : 0;
    return { staff, hours, wage, cost: hours * wage };
  },
  salariedWeekCost(weekStart) {
    if (!weekStart) return 0;
    const we = new Date(weekStart + 'T00:00:00');
    if (isNaN(we.getTime())) return 0;
    we.setDate(we.getDate() + 6);
    return App.salariedCost(weekStart, App.ymdLocal(we)).total;
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
    let hours = 0, cost = 0, conflicts = 0, offConflicts = 0;
    this.draft.shifts.forEach((sh, i) => {
      if (!sh.staff_id || !sh.start || !sh.end) return;
      const c = this.shiftCalc(sh);
      hours += c.hours; cost += c.cost;
      if (byDay[sh.day]) { byDay[sh.day].hours += c.hours; byDay[sh.day].count += 1; }
      if (this.isConflict(sh, i)) conflicts++;
      if (this.offReasonFor(sh.staff_id, sh.day)) offConflicts++;
    });
    cost += this.salariedWeekCost(this.draft.week_start);
    return { hours, cost, byDay, conflicts, offConflicts };
  },
  // Why a staff member is off on a day column of the current draft week (a time-off
  // entry or a recurring day off), or null. Wraps App.staffOffOn with the column→date.
  offReasonFor(staffId, day) {
    return App.staffOffOn(staffId, this.dayIso(this.draft.week_start, this.DAYS.indexOf(day)));
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
    // Target Hours = the labor hours this forecast can support at the RPLH target
    // (the old Optimal Staffing Calculator, folded into the live budget card).
    const rt = (App.data.revenue_settings && App.data.revenue_settings.targets) || {};
    const rplhTgt = ((rt.rplh_lunch || 50) + (rt.rplh_dinner || 75) + (rt.rplh_bar || 65)) / 3;
    const targetHrs = (fc > 0 && rplhTgt > 0) ? fc / rplhTgt : 0;

    // The budget numbers live in their own standalone card. It is ALWAYS
    // rendered in the same slot: the four budget stats once a forecast is set,
    // or a short set-forecast prompt when there is none, so cycling weeks never
    // jumps the page or strands the prompt under the date picker.
    let budgetCard;
    if (!d.week_start) {
      budgetCard = '<div class="card"><div style="font-size:13px;color:var(--t3);">Use the week selector below to pick a week, then set a forecast and labor budget.</div></div>';
    } else if (fc <= 0) {
      budgetCard = '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
        + '<div style="font-size:13px;color:var(--t2);">No revenue forecast set for this week.</div>'
        + '<button class="btn btn-primary btn-sm" id="bs-fc">Set Forecast</button></div></div>';
    } else {
      const leftCls = left >= 0 ? 'good' : 'warn';
      budgetCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Revenue Forecast</div><div class="calc-val lg">' + App.fmtCurrency(fc)
        + ' <button class="btn btn-ghost btn-sm" id="bs-fc" style="font-size:10px;letter-spacing:1px;padding:2px 8px;vertical-align:middle;">Edit</button></div></div>'
        + '<div class="calc-item"><div class="calc-label">Labor Budget</div><div class="calc-val lg">' + App.fmtCurrency(budget)
        + ' <button class="btn btn-ghost btn-sm" id="bs-lt" style="font-size:10px;letter-spacing:1px;padding:2px 8px;vertical-align:middle;">Edit</button></div></div>'
        + '<div class="calc-item"><div class="calc-label">Target Hours</div><div class="calc-val lg">' + (targetHrs > 0 ? targetHrs.toFixed(1) + ' hrs' : '-') + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Scheduled</div><div class="calc-val lg">' + App.fmtCurrency(T.cost) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">' + (left >= 0 ? 'Budget Left' : 'Over Budget') + '</div><div class="calc-val lg ' + leftCls + '">' + App.fmtCurrency(Math.abs(left)) + '</div></div>'
        + '</div></div>';
    }

    // Grid
    const days = this.DAYS;
    const headCells = days.map((day, i) => {
      const dd = this.dayDate(d.week_start, i);
      const ev = this.bookingsOnDate(this.dayIso(d.week_start, i));
      const evChip = ev.length ? '<div style="margin-top:3px;"><span title="' + esc(ev.map(e => this.bookingName(e)).join(', ')) + '" style="font-size:8px;font-weight:800;letter-spacing:1px;color:var(--gold);background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:3px;padding:1px 5px;">EVENT</span></div>' : '';
      return '<th style="padding:8px 6px;text-align:center;font-size:10px;letter-spacing:1px;color:var(--t3);min-width:104px;">'
        + day + (dd ? '<div style="font-size:10px;color:var(--t4);font-weight:400;letter-spacing:0;">' + dd + '</div>' : '') + evChip + '</th>';
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
        days.forEach((day, di) => {
          const offReason = App.staffOffOn(s.id, this.dayIso(d.week_start, di));
          const items = this.shiftsFor(s.id, day);
          let cellInner = '';
          items.forEach(({ sh, i }) => {
            const c = this.shiftCalc(sh);
            const conflict = this.isConflict(sh, i);
            const flagged = conflict || !!offReason;
            const border = flagged ? 'var(--red)' : 'var(--gold-tint-bord)';
            const blockBg = flagged ? 'var(--surface)' : 'var(--gold-tint)';
            const flagNote = conflict ? ' · overlap' : (offReason ? ' · off' : '');
            cellInner += '<div class="bs-block" data-idx="' + i + '" title="' + (offReason ? esc(offReason) : 'Click to edit') + '"'
              + ' style="cursor:pointer;border:1px solid ' + border + ';border-radius:4px;padding:3px 5px;margin-bottom:3px;background:' + blockBg + ';">'
              + '<div style="font-size:11px;color:var(--t1);font-weight:600;">' + esc(this._fmtTime(sh.start)) + '–' + esc(this._fmtTime(sh.end)) + '</div>'
              + '<div style="font-size:9px;color:' + (flagged ? 'var(--red)' : 'var(--t3)') + ';">' + (sal ? 'salaried' : c.hours.toFixed(1) + 'h') + flagNote + '</div>'
              + '</div>';
          });
          const offTag = (offReason && !items.length) ? '<div title="' + esc(offReason) + '" style="font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--red);text-align:center;opacity:.85;">Off</div>' : '';
          cellInner += offTag + '<div class="bs-add-cell" style="text-align:center;color:var(--t4);font-size:14px;cursor:pointer;line-height:1.2;padding:' + (items.length ? '0' : (offTag ? '2px' : '8px')) + ' 0;">+</div>';
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

    // On an empty grid (fresh week, not editing), offer to carry last week's
    // posted schedule forward so a typical week is not rebuilt shift by shift.
    const prior = (!this.editId && this.draft.shifts.length === 0) ? this.priorSchedule() : null;
    const lastWeekNudge = prior
      ? '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">'
        + '<div style="font-size:12px;color:var(--t2);">Start this week from your schedule for the week of <span style="color:var(--t1);font-weight:600;">' + this.weekLabel(prior.week_start) + '</span>?</div>'
        + '<button class="btn btn-ghost btn-sm" id="bs-from-last">Start from last week</button></div>'
      : '';

    const gridCard = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:6px 0 14px;flex-wrap:wrap;">'
      + this.weekSelector()
      + '<div class="no-print" style="display:flex;gap:8px;">'
      + '<button class="btn btn-ghost btn-sm" id="bs-new">New Schedule</button>'
      + '<button class="btn btn-ghost btn-sm" id="bs-worksheet">Worksheet</button></div></div>'
      + lastWeekNudge
      + '<div class="bs-gridview"><div class="card" style="padding:0;overflow:hidden;"><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">'
      + '<thead><tr><th style="padding:8px;text-align:left;font-size:10px;letter-spacing:1px;color:var(--t3);">Staff</th>' + headCells + '</tr></thead>'
      + '<tbody>' + body + footer + '</tbody></table></div></div></div>'
      + this.dayViewHTML(d, T)
      + (T.conflicts > 0 ? '<div style="font-size:11px;color:var(--red);font-weight:700;margin-top:10px;">' + T.conflicts + ' overlapping shift' + (T.conflicts === 1 ? '' : 's') + ' on the same person and day. The red blocks need fixing.</div>' : '')
      + (T.offConflicts > 0 ? '<div style="font-size:11px;color:var(--red);font-weight:700;margin-top:6px;">' + T.offConflicts + ' shift' + (T.offConflicts === 1 ? '' : 's') + ' on a day someone is off (requested time off or a regular day off). The red blocks are the conflicts.</div>' : '');

    // Totals strip
    const totalsCard = '<div class="card" style="margin-top:16px;"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Labor Hours</div><div class="calc-val lg">' + T.hours.toFixed(1) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor Cost</div><div class="calc-val lg">' + App.fmtCurrency(T.cost) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Labor %</div><div class="calc-val lg ' + (pct != null ? (pct > target ? 'warn' : 'good') : '') + '">' + (pct != null ? App.fmtPct(pct) : '-') + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Target</div><div class="calc-val lg dim">' + App.fmtPct(target) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">RPLH</div><div class="calc-val lg">' + (rplh != null ? App.fmtCurrency(rplh) : '-') + '</div></div>'
      + '</div></div>';

    // Save card — name it to also save a reusable template (optional).
    const actionsCard = '<div class="card form-card"><div class="card-title">Save</div>'
      + '<div class="form-row" style="gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px;">'
      + '<div class="f" style="width:320px;max-width:100%;"><label>Template Name</label>'
      + '<input type="text" id="bs-tmpl-name" value="' + esc(d.from_template_name || '') + '" placeholder="Optional, name it to save as a template"/></div>'
      + '</div>'
      + '<div class="f" style="margin-bottom:0;"><label>Notes</label><textarea id="bs-notes" class="notes-ta" rows="2" placeholder="Optional">' + esc(d.notes || '') + '</textarea></div>'
      + '</div>'
      + '<div style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary btn-lg" id="bs-save">' + (this.editId ? 'Update Schedule' : 'Save Schedule') + '</button>'
      + (this.editId ? '<button class="btn btn-ghost" id="bs-cancel">Cancel Edit</button>' : '')
      + '<span id="bs-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">'
      + this._eventBanner()
      + budgetCard
      + gridCard + totalsCard + actionsCard
      + this.templatesSection()
      + '</div>';

    this._wire();
    document.getElementById('bs-ev-dismiss')?.addEventListener('click', () => { this._eventContext = null; this.draw(); });
  },

  // Context banner shown when arriving from an Events "Schedule Staff" jump.
  _eventBanner() {
    const c = this._eventContext;
    if (!c) return '';
    const dt = new Date((c.date || '') + 'T00:00:00');
    const dStr = isNaN(dt.getTime()) ? esc(c.date || '') : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return '<div class="no-print" style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:11px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
      + '<div style="font-size:12px;color:var(--t1);line-height:1.5;">Scheduling for <span style="font-weight:700;">' + esc(c.name || 'an event') + '</span>' + (c.date ? ' on ' + dStr : '') + '. Open each person working that day and check "Working ' + esc(c.name || 'the event') + '" so only their hours land on the Event P&amp;L.</div>'
      + '<button class="btn btn-ghost btn-sm" id="bs-ev-dismiss">Dismiss</button></div>';
  },

  _fmtTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h)) return esc(t);
    const ap = h < 12 ? 'a' : 'p';
    let hr = h % 12; if (hr === 0) hr = 12;
    return hr + (m ? ':' + String(m).padStart(2, '0') : '') + ap;
  },

  // ── Mobile day-view (revertible) ────────────────────────────────────────────
  // Below the hamburger breakpoint the 7-day grid scrolls sideways, so a CSS
  // toggle (.bs-gridview / .bs-dayview in style.css) swaps it for a one-day-at-a-
  // time view: a day selector + every active staff member's shifts for that day,
  // tap to add or edit. Reuses the grid's data + openShiftModal. To revert to
  // scroll-only, remove this method, its call in the grid card, the day-view
  // wiring in _wire(), and the .bs-dayview/.bs-gridview CSS block.
  dayViewHTML(d, T) {
    if (!this._mobileDay || this.DAYS.indexOf(this._mobileDay) < 0) {
      const todayName = new Date(App.todayLocal() + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
      this._mobileDay = this.DAYS.indexOf(todayName) >= 0 ? todayName : this.DAYS[0];
    }
    const day = this._mobileDay;
    const dd = this.dayDate(d.week_start, this.DAYS.indexOf(day));
    const dayEvents = this.bookingsOnDate(this.dayIso(d.week_start, this.DAYS.indexOf(day)));

    const chips = this.DAYS.map(dy => {
      const on = dy === day;
      return '<button type="button" class="btn btn-sm bs-day-chip" data-day="' + esc(dy) + '" style="flex:1 1 0;min-width:0;padding:7px 2px;'
        + (on ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + esc(dy) + '</button>';
    }).join('');

    const groups = {};
    this.activeStaff().forEach(s => { const dep = this.deptOf(s.id); (groups[dep] = groups[dep] || []).push(s); });
    const orderedDepts = this.DEPT_ORDER.filter(x => groups[x]).concat(Object.keys(groups).filter(x => this.DEPT_ORDER.indexOf(x) < 0));

    let rows = '';
    orderedDepts.forEach(dep => {
      rows += '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);padding:14px 0 4px;">' + esc(dep) + '</div>';
      groups[dep].sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(s => {
        const sal = App.isSalaried(s);
        const offReason = this.offReasonFor(s.id, day);
        let blocks = '';
        this.shiftsFor(s.id, day).forEach(({ sh, i }) => {
          const c = this.shiftCalc(sh);
          const conflict = this.isConflict(sh, i);
          const flagged = conflict || !!offReason;
          const border = flagged ? 'var(--red)' : 'var(--gold-tint-bord)';
          const blockBg = flagged ? 'var(--surface)' : 'var(--gold-tint)';
          const flagNote = conflict ? ' · overlap' : (offReason ? ' · off' : '');
          blocks += '<div class="bs-mblock" data-staff="' + esc(s.id) + '" data-day="' + esc(day) + '" data-idx="' + i + '" style="cursor:pointer;border:1px solid ' + border + ';border-radius:4px;padding:5px 8px;background:' + blockBg + ';">'
            + '<div style="font-size:12px;color:var(--t1);font-weight:600;">' + esc(this._fmtTime(sh.start)) + '–' + esc(this._fmtTime(sh.end)) + '</div>'
            + '<div style="font-size:9px;color:' + (flagged ? 'var(--red)' : 'var(--t3)') + ';">' + (sal ? 'salaried' : c.hours.toFixed(1) + 'h') + flagNote + '</div></div>';
        });
        const offBadge = offReason ? ' <span title="' + esc(offReason) + '" style="font-size:9px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--red);">Off</span>' : '';
        rows += '<div style="display:flex;align-items:flex-start;gap:12px;border-top:1px solid var(--b2);padding:9px 0;">'
          + '<div style="flex:1;min-width:0;"><div style="font-size:13px;color:var(--t1);font-weight:600;">' + esc(s.name || '-') + offBadge + '</div>'
          + '<div style="font-size:10px;color:var(--t4);">' + esc(sal ? 'Salary' : (s.wage != null ? App.fmtCurrency(s.wage) + '/hr' : '')) + '</div></div>'
          + '<div style="display:flex;flex-direction:column;gap:4px;flex:0 0 132px;max-width:132px;">' + blocks
          + '<button type="button" class="btn btn-ghost btn-sm bs-madd" data-staff="' + esc(s.id) + '" data-day="' + esc(day) + '">+ Add</button></div>'
          + '</div>';
      });
    });

    const ddTot = (T.byDay && T.byDay[day]) || { hours: 0, count: 0 };
    const evChip = dayEvents.length ? ' <span style="font-size:8px;font-weight:800;letter-spacing:1px;color:var(--gold);background:var(--gold-tint);border:1px solid var(--gold-tint-bord);border-radius:3px;padding:1px 5px;vertical-align:middle;">EVENT</span>' : '';
    const header = '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:6px;">'
      + '<div style="font-size:13px;color:var(--t1);font-weight:700;">' + esc(day) + (dd ? ' <span style="color:var(--t4);font-weight:400;">' + esc(dd) + '</span>' : '') + evChip + '</div>'
      + '<div style="font-size:11px;color:var(--t3);">' + ddTot.hours.toFixed(1) + 'h · ' + ddTot.count + ' shift' + (ddTot.count === 1 ? '' : 's') + '</div></div>';

    return '<div class="bs-dayview">'
      + '<div style="display:flex;gap:5px;margin-bottom:12px;">' + chips + '</div>'
      + '<div class="card">' + header + rows + '</div>'
      + '</div>';
  },

  _wire() {
    document.getElementById('bs-week-prev')?.addEventListener('click', () => this.shiftWeek(-7));
    document.getElementById('bs-week-next')?.addEventListener('click', () => this.shiftWeek(7));
    this.container.querySelectorAll('.bs-week-chip').forEach(b => b.addEventListener('click', async () => {
      const target = b.dataset.ws;
      if (!target || target === (this.draft.week_start || '')) return;
      if (!(await this.confirmLeaveUnsaved())) return;
      this.loadWeek(target); this.draw();
    }));
    document.getElementById('bs-week-now')?.addEventListener('click', async () => {
      const target = this.mondayOf(App.todayLocal());
      if (target === (this.draft.week_start || '')) return;
      if (!(await this.confirmLeaveUnsaved())) return;
      this.loadWeek(target); this.draw();
    });
    document.getElementById('bs-notes')?.addEventListener('input', e => { this.draft.notes = e.target.value || ''; this.saveDraft(); });
    document.getElementById('bs-fc')?.addEventListener('click', () => this.openForecastModal());
    document.getElementById('bs-lt')?.addEventListener('click', () => this.openLaborTargetModal());
    document.getElementById('bs-save')?.addEventListener('click', () => this.save());
    document.getElementById('bs-new')?.addEventListener('click', async () => {
      if (this.draft.shifts.length) {
        const ok = await App.confirm({ title: 'Start a new schedule?', message: 'This clears the grid so you can build a fresh week. Saved schedules and templates are not affected.', confirmText: 'Start New', cancelText: 'Cancel' });
        if (!ok) return;
      }
      this.editId = null;
      this.draft = { week_start: this.draft.week_start || this.mondayOf(App.todayLocal()), shifts: [], notes: '' };
      this.saveDraft(); this.draw();
    });
    document.getElementById('bs-cancel')?.addEventListener('click', () => { this.editId = null; App.navigate('lc-schedule-history'); });
    document.getElementById('bs-from-last')?.addEventListener('click', () => this.startFromLastWeek());
    document.getElementById('bs-worksheet')?.addEventListener('click', () => this.printWorksheet());

    // Grid cell clicks: edit a block, or add to a cell.
    this.container.querySelectorAll('.bs-cell').forEach(cell => {
      cell.addEventListener('click', ev => {
        const block = ev.target.closest('.bs-block');
        if (block) { ev.stopPropagation(); this.openShiftModal(cell.dataset.staff, cell.dataset.day, parseInt(block.dataset.idx, 10)); return; }
        this.openShiftModal(cell.dataset.staff, cell.dataset.day, null);
      });
    });

    // Mobile day-view: switch the day, or add/edit a shift (mirrors the grid).
    this.container.querySelectorAll('.bs-day-chip').forEach(b => b.addEventListener('click', () => { this._mobileDay = b.dataset.day; this.draw(); }));
    this.container.querySelectorAll('.bs-mblock').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); this.openShiftModal(b.dataset.staff, b.dataset.day, parseInt(b.dataset.idx, 10)); }));
    this.container.querySelectorAll('.bs-madd').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); this.openShiftModal(b.dataset.staff, b.dataset.day, null); }));

    // Saved-template rows: load (click row or Load), or delete.
    this.container.querySelectorAll('.bs-tmpl-load').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); this.loadTemplate(b.dataset.id); }));
    this.container.querySelectorAll('.bs-tmpl-del').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); this.confirmDelTemplate(b.dataset.id); }));
    this.container.querySelectorAll('.bs-tmpl-row').forEach(r => r.addEventListener('click', ev => { if (!ev.target.closest('.btn')) this.loadTemplate(r.dataset.id); }));
  },

  // Blank weekly grid to pencil in before entering — staff down the left, the
  // seven days across, quarter-hour cells. Same paper-to-digital pattern as the
  // Tip Log / 86 List worksheets (printBlankSheet auto-lands landscape for 8 cols).
  printWorksheet() {
    App.printBlankSheet({
      title: 'Schedule Worksheet',
      subtitle: 'Week of ____________________.   Write each person and their shift times in the day cells, then enter the week in Build Schedule.',
      columns: [{ label: 'Staff', width: '20%' },
        { label: 'Mon' }, { label: 'Tue' }, { label: 'Wed' }, { label: 'Thu' }, { label: 'Fri' }, { label: 'Sat' }, { label: 'Sun' }]
    });
  },

  // Carry the most recent prior posted schedule's shifts onto the current
  // (empty) week. No confirm: the grid is empty by precondition, so nothing is
  // overwritten. The week and forecast stay on the current week.
  startFromLastWeek() {
    const prior = this.priorSchedule();
    if (!prior) return;
    this.editId = null;
    this.draft.shifts = (prior.shifts || []).map(s => ({ staff_id: s.staff_id, day: s.day, start: s.start, end: s.end, event: s.event || '' }));
    this.draft.from_template_name = '';
    this.saveDraft();
    this.draw();
  },

  // ── Shift add/edit modal (standard App.openModal + form-card) ───────────────
  openShiftModal(staffId, day, idx) {
    const staff = this.staffById(staffId);
    if (!staff) return;
    const editing = idx != null && this.draft.shifts[idx];
    const sh = editing ? this.draft.shifts[idx] : { staff_id: staffId, day, start: '', end: '', event: '' };
    const sal = App.isSalaried(staff);
    // Event tagging: only when a confirmed booking falls on this day. Checking it
    // sends this person's hours to that event's P&L (and nobody else's).
    const evs = this.bookingsOnDate(this.dayIso(this.draft.week_start, this.DAYS.indexOf(day)));
    let eventField = '';
    if (evs.length === 1) {
      eventField = '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--t1);margin-top:12px;padding-top:12px;border-top:1px solid var(--b2);">'
        + '<input type="checkbox" id="bs-m-event" data-eid="' + esc(evs[0].id) + '"' + (sh.event === evs[0].id ? ' checked' : '') + ' style="appearance:auto;accent-color:var(--gold);width:15px;height:15px;margin:0;cursor:pointer;"/> Working ' + esc(this.bookingName(evs[0])) + '</label>';
    } else if (evs.length > 1) {
      eventField = '<div class="f" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--b2);"><label>Working an Event?</label><select id="bs-m-event-sel"><option value="">No</option>'
        + evs.map(e => '<option value="' + esc(e.id) + '"' + (sh.event === e.id ? ' selected' : '') + '>' + esc(this.bookingName(e)) + '</option>').join('') + '</select></div>';
    }
    const offReason = this.offReasonFor(staffId, day);
    const offBanner = offReason
      ? '<div style="border:1px solid var(--red);border-radius:6px;padding:9px 12px;margin-bottom:14px;font-size:12px;color:var(--red);font-weight:600;">' + esc(offReason) + '. Scheduling a shift here will flag it.</div>'
      : '';
    const html = '<div class="card form-card" style="margin:0;"><div class="card-title">' + esc(staff.name || 'Staff') + ' &middot; ' + esc(day) + '</div>'
      + offBanner
      + '<div class="form-row" style="gap:18px;flex-wrap:wrap;">'
      + this._timeSelectFields('bs-m-start', sh.start, 'Start')
      + this._timeSelectFields('bs-m-end', sh.end, 'End')
      + '</div>'
      + '<div id="bs-m-calc" style="font-size:11px;color:var(--t3);margin-top:6px;min-height:14px;"></div>'
      + eventField
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="bs-m-save">Save Shift</button>'
      + '<button class="btn btn-ghost" id="bs-m-cancel">Cancel</button>'
      + '<span id="bs-m-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + (editing ? '<button class="btn btn-danger" id="bs-m-remove" style="margin-left:auto;">Remove</button>' : '')
      + '</div></div>';
    App.openModal(html, { id: 'bs-shift-modal', maxWidth: 460, noClose: true });
    const calcEl = document.getElementById('bs-m-calc');
    const errEl = document.getElementById('bs-m-err');
    const updateCalc = () => {
      const start = this._readTime('bs-m-start'), end = this._readTime('bs-m-end');
      if (!start || !end) { calcEl.textContent = ''; return; }
      const h = this.hoursOf(start, end);
      if (sal) { calcEl.textContent = h.toFixed(1) + ' hrs · salaried (no hourly cost)'; return; }
      const wage = App.wageForStaffOn ? App.wageForStaffOn(staff.id, this.draft.week_start) : (staff.wage || 0);
      calcEl.textContent = h.toFixed(1) + ' hrs · ' + App.fmtCurrency(h * wage) + (wage ? ' @ ' + App.fmtCurrency(wage) + '/hr' : '');
    };
    updateCalc();
    document.querySelectorAll('#bs-shift-modal select').forEach(el => el.addEventListener('change', updateCalc));
    document.getElementById('bs-m-cancel')?.addEventListener('click', () => App.closeModal('bs-shift-modal'));
    document.getElementById('bs-m-remove')?.addEventListener('click', () => {
      if (editing) { this.draft.shifts.splice(idx, 1); this.saveDraft(); }
      App.closeModal('bs-shift-modal'); this.draw();
    });
    document.getElementById('bs-m-save')?.addEventListener('click', () => {
      const start = this._readTime('bs-m-start'), end = this._readTime('bs-m-end');
      if (!start || !end) { errEl.textContent = 'Set a start and end time.'; errEl.style.display = 'inline'; return; }
      let event = sh.event || '';
      const cb = document.getElementById('bs-m-event'), sel = document.getElementById('bs-m-event-sel');
      if (cb) event = cb.checked ? cb.dataset.eid : '';
      else if (sel) event = sel.value || '';
      if (editing) { this.draft.shifts[idx] = { staff_id: staffId, day, start, end, event }; }
      else { this.draft.shifts.push({ staff_id: staffId, day, start, end, event }); }
      this.saveDraft(); App.closeModal('bs-shift-modal'); this.draw();
    });
  },

  // Hour / Minute(00,15,30,45) / AM-PM selects for a shift time. The native
  // <input type=time> step does not reliably limit the minute list across
  // browsers (some show every minute), so we build explicit selects — the only
  // minute choices are quarter-hours. Stores/reads "HH:MM" 24h so the grid math
  // (hoursOf, conflicts, cost) is unchanged.
  _timeSelectFields(idp, val, label) {
    let h12 = '', mm = '', ap = 'AM';
    if (val && /^\d{1,2}:\d{2}/.test(val)) {
      const [H, M] = val.split(':').map(Number);
      ap = H >= 12 ? 'PM' : 'AM';
      let hh = H % 12; if (hh === 0) hh = 12;
      h12 = String(hh); mm = String(M).padStart(2, '0');
    }
    const hourOpts = '<option value="">--</option>'
      + Array.from({ length: 12 }, (_, i) => { const hh = i + 1; return '<option value="' + hh + '"' + (String(hh) === h12 ? ' selected' : '') + '>' + hh + '</option>'; }).join('');
    const minOpts = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => '<option value="' + m + '"' + (m === mm ? ' selected' : '') + '>' + m + '</option>').join('');
    const apOpts = ['AM', 'PM'].map(a => '<option' + (a === ap ? ' selected' : '') + '>' + a + '</option>').join('');
    return '<div class="f" style="flex:1 1 200px;min-width:0;margin-bottom:0;"><label>' + label + '</label>'
      + '<div style="display:flex;gap:8px;align-items:center;">'
      + '<select id="' + idp + '-h" style="flex:1;min-width:0;">' + hourOpts + '</select>'
      + '<span style="color:var(--t3);flex-shrink:0;">:</span>'
      + '<select id="' + idp + '-m" style="flex:1;min-width:0;">' + minOpts + '</select>'
      + '<select id="' + idp + '-ap" style="flex:1;min-width:0;">' + apOpts + '</select>'
      + '</div></div>';
  },
  _readTime(idp) {
    const h = document.getElementById(idp + '-h')?.value;
    const m = document.getElementById(idp + '-m')?.value || '00';
    const ap = document.getElementById(idp + '-ap')?.value || 'AM';
    if (!h) return '';
    let H = parseInt(h, 10) % 12; if (ap === 'PM') H += 12;
    return String(H).padStart(2, '0') + ':' + m;
  },

  // ── Labor Cost Target modal (writes the ONE settings.targets.labor_cost_pct) ──
  // Edits the global labor-cost target inline, since a new user has no idea the
  // budget % comes from App Settings. Changing it here moves the target across
  // Bar Cop (schedule budget + Profit/Revenue Recovery) — it is one setting.
  openLaborTargetModal() {
    const cur = App.laborTargetPct();
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Labor Cost Target</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:16px;">Your target labor cost as a share of sales. Used across Bar Cop.</div>'
      + '<div class="form-row" style="gap:14px;"><div class="f" style="width:170px;"><label>Labor Cost Target</label>'
      + '<div class="fw"><input class="suf" type="number" id="bs-lt-val" min="0" step="0.1" value="' + esc(String(cur)) + '"/><span class="suf">%</span></div></div></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:10px;">Adjust all your targets in <span id="bs-lt-settings" style="color:var(--gold);cursor:pointer;text-decoration:underline;">App Settings</span>.</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="bs-lt-save">Save</button>'
      + '<button class="btn btn-ghost" id="bs-lt-cancel">Cancel</button>'
      + '<span id="bs-lt-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'bs-lt-modal', maxWidth: 460, noClose: true });
    document.getElementById('bs-lt-cancel')?.addEventListener('click', () => App.closeModal('bs-lt-modal'));
    document.getElementById('bs-lt-settings')?.addEventListener('click', () => { App.closeModal('bs-lt-modal'); if (window.S && S.HubSettings) S.HubSettings.open('recovery-targets'); });
    document.getElementById('bs-lt-save')?.addEventListener('click', async () => {
      const v = parseFloat(document.getElementById('bs-lt-val')?.value);
      const err = document.getElementById('bs-lt-err');
      if (isNaN(v) || v <= 0) { if (err) { err.textContent = 'Enter a labor cost target percent.'; err.style.display = 'inline'; } return; }
      if (!App.data.settings) App.data.settings = {};
      if (!App.data.settings.targets) App.data.settings.targets = {};
      App.data.settings.targets.labor_cost_pct = Math.round(v * 10) / 10;
      await App.saveKey('settings');
      App.closeModal('bs-lt-modal');
      this.draw();
    });
  },

  // ── Forecast modal (writes revenue_forecasts) ────────────────────────────────
  openForecastModal() {
    if (!this.draft.week_start) return;
    const rec = this.forecastForWeek(this.draft.week_start);
    const cur = rec && rec.total != null ? rec.total : '';
    const sug = App.forecastDefaultsFor ? (App.forecastDefaultsFor(this.draft.week_start).total || 0) : 0;
    const hasDetail = !!(rec && rec.per_day && Object.values(rec.per_day).some(v => Number(v) > 0));
    const html = '<div class="card form-card" style="margin:0;"><div class="card-title">Revenue Forecast</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:16px;">Your expected sales for this week. Bar Cop turns it into a labor budget (' + App.fmtPct(this.laborTarget()) + ' of forecast) so you can see if the schedule fits before you post it.</div>'
      + (sug > 0
          ? '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">'
            + '<div style="font-size:12px;color:var(--t2);">From your recent weeks: <span style="color:var(--gold);font-weight:700;">' + App.fmtCurrency(sug) + '</span></div>'
            + '<button class="btn btn-ghost btn-sm" id="bs-fc-use">Use this</button></div>'
          : '<div style="font-size:11px;color:var(--t4);line-height:1.5;margin-bottom:16px;">Not enough sales history yet for a suggestion. Enter your own number to get a labor budget today; Bar Cop starts suggesting once you have a few weeks logged.</div>')
      + '<div class="form-row" style="gap:12px;"><div class="f" style="width:200px;"><label>' + (sug > 0 ? 'Or enter your own' : 'Expected Revenue') + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="bs-fc-val" min="0" step="100" value="' + (cur === '' ? '' : esc(String(cur))) + '" placeholder="0"/></div></div></div>'
      + (hasDetail ? '<div style="font-size:11px;color:var(--amber);margin-top:6px;line-height:1.5;">This week has a day-by-day forecast. Saving a single total here replaces it.</div>' : '')
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="bs-fc-save">Save Forecast</button>'
      + '<button class="btn btn-ghost" id="bs-fc-cancel">Cancel</button>'
      + '<span id="bs-fc-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'bs-fc-modal', maxWidth: 460, noClose: true });
    document.getElementById('bs-fc-use')?.addEventListener('click', () => { const i = document.getElementById('bs-fc-val'); if (i) i.value = sug; });
    document.getElementById('bs-fc-cancel')?.addEventListener('click', () => App.closeModal('bs-fc-modal'));
    document.getElementById('bs-fc-save')?.addEventListener('click', () => this.saveForecast(hasDetail));
  },

  async saveForecast(hasDetail) {
    const errEl = document.getElementById('bs-fc-err');
    const fail = m => { if (errEl) { errEl.textContent = m; errEl.style.display = 'inline'; } };
    const val = parseFloat(document.getElementById('bs-fc-val')?.value);
    if (isNaN(val) || val < 0) { fail('Enter the expected revenue for the week.'); return; }
    if (hasDetail) {
      const okOv = await App.confirm({ title: 'Replace day-by-day forecast?', message: 'This week has a detailed day-by-day forecast. Saving a single weekly total replaces it. You can rebuild the detailed version later in Revenue Recovery.', confirmText: 'Replace', cancelText: 'Cancel' });
      if (!okOv) return;
    }
    if (!Array.isArray(App.data.revenue_forecasts)) App.data.revenue_forecasts = [];
    const list = App.data.revenue_forecasts;
    const ws = this.draft.week_start;
    const tv = Math.round(val * 100) / 100;
    const existing = list.find(f => f.week_start === ws);
    if (existing) { existing.total = tv; existing.per_day = {}; existing.method = 'total'; existing.updated_at = new Date().toISOString(); }
    else list.push({ id: App.uid(), week_start: ws, total: tv, per_day: {}, method: 'total', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    await App.saveKey('revenue_forecasts');
    App.closeModal('bs-fc-modal');
    this.draw();
  },

  // ── How This Works ──────────────────────────────────────────────────────────
  showHowTo() {
    App.showHelpModal('How Build Schedule Works', [
      { p: ['Build Schedule is a weekly grid: your staff down the left, the seven days across the top. You fill it in by clicking, and Bar Cop costs it out live as you go.'] },
      { h: 'Picking the Week', p: ['Build Schedule opens on the current week. Use the week chips and the arrows above the grid to move between weeks, or This Week to snap back. A week you have already posted opens ready to edit; an empty week is ready to build. Worksheet prints a blank staff-by-day grid to pencil in before you enter it here.'] },
      { h: 'Adding and Editing Shifts', p: ['Click any empty day cell to add a shift for that person, then set a start and end time. Click an existing shift block to change its time or remove it. If you double-book someone on the same day, the block turns red so you can fix it.'] },
      { h: 'Days Off', p: ['A cell reads Off when that person requested the day off (logged on Time Off and approved) or has it as a regular day off (set on their Staff Roster profile). Drop a shift on an Off day and the block turns red; you also get a warning before the schedule posts, so you never accidentally schedule someone you already gave the day off. You can still override and post it.'] },
      { h: 'The Labor Budget', p: ['Set the week\'s revenue forecast at the top. Bar Cop turns it into a labor budget (your target percent of the forecast), shows the Target Hours that forecast can support at your RPLH target, and shows live what you have scheduled and how much budget is left, green when you are under and red when you are over. No history yet? Type a number; Bar Cop starts suggesting one once you have a few weeks logged.'] },
      { h: 'Templates', p: ['To start from a typical week, Load one of your Saved Templates listed at the bottom of this page. To save the current grid as a reusable template, put a name in the Template Name box before you save, and it saves with the schedule. Loaded a template? Its name is already there: keep it to update that template, or change it to save a new one.'] },
      { h: 'New Schedule', p: ['New Schedule clears the grid so you can build a fresh week. Your saved schedules and templates are not touched. On an empty week that follows a posted one, a Start from last week button drops your most recent posted schedule onto the grid so you pencil in the changes instead of rebuilding a typical week shift by shift.'] },
      { h: 'Working an Event', p: ['When a booked event falls on a day, that day gets an EVENT tag in the header. Open anyone working it and check the "Working [event name]" box in the shift pop-up (a picker when more than one event lands that day) so only that person\'s logged hours flow to the booking\'s Event P&L. Leave it unchecked for staff covering the regular floor that night.'] },
      { h: 'Salaried Staff', p: ['Salaried managers show their shift times in the grid, but their pay is a fixed weekly salary, not an hourly cost, so it counts toward the budget as a flat amount no matter how many hours you schedule.'] }
    ]);
  },

  // ── Saved templates (load / delete, inline under the Save box) ───────────────
  templateStats(t) {
    let hours = 0, cost = 0;
    const salIds = new Set();
    const today = App.todayLocal();
    (t.shifts || []).forEach(s => {
      const h = this.hoursOf(s.start, s.end);
      hours += h;
      const staff = this.staffById(s.staff_id);
      if (staff && App.isSalaried(staff)) salIds.add(staff.id);
      else { const wage = App.wageForStaffOn ? App.wageForStaffOn(s.staff_id, today) : ((staff && staff.wage) || 0); cost += h * (wage || 0); }
    });
    salIds.forEach(id => { cost += App.staffWeeklySalary ? App.staffWeeklySalary(id) : 0; });
    return { count: (t.shifts || []).length, hours, cost };
  },

  templatesSection() {
    const list = this.templates();
    const heading = '<div class="sh" style="margin:24px 0 10px;">Saved Templates</div>';
    if (!list.length) {
      return heading + '<div style="font-size:13px;color:var(--t3);padding:4px 2px;">Name a schedule in the Save box above to save it as a reusable template. Your saved templates show up here to load any time.</div>';
    }
    const rows = list.map(t => {
      const st = this.templateStats(t);
      return '<tr class="bs-tmpl-row" data-id="' + esc(t.id) + '" style="cursor:pointer;">'
        + '<td><div class="val">' + esc(t.name) + '</div></td>'
        + '<td>' + st.count + '</td>'
        + '<td>' + st.hours.toFixed(1) + '</td>'
        + '<td class="val">~' + App.fmtCurrency(st.cost) + '</td>'
        + '<td><div class="row-actions">'
        + '<button class="btn btn-ghost btn-sm bs-tmpl-load" data-id="' + esc(t.id) + '">Load</button>'
        + '<button class="btn btn-danger btn-sm bs-tmpl-del" data-id="' + esc(t.id) + '">Delete</button>'
        + '</div></td></tr>';
    }).join('');
    return heading + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Template</th><th>Shifts</th><th>Hours</th><th>Est. Cost / wk</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  },

  // Load a template's shifts onto the current week, in place. Confirms first if
  // the grid already has unsaved shifts.
  async loadTemplate(id) {
    const t = this.templates().find(x => x.id === id);
    if (!t) return;
    if (this.draft.shifts.length) {
      const ok = await App.confirm({ title: 'Load this template?', message: 'This replaces the shifts in the current grid with the template. The week and forecast stay the same. Your saved schedules and templates are not affected.', confirmText: 'Load Template', cancelText: 'Cancel' });
      if (!ok) return;
    }
    this.editId = null;
    this.draft.shifts = (t.shifts || []).map(s => ({ staff_id: s.staff_id, day: s.day, start: s.start, end: s.end }));
    this.draft.from_template_name = t.name;
    this.saveDraft();
    this.draw();
  },

  async confirmDelTemplate(id) {
    if (!(await App.confirmDelete())) return;
    App.laborData.lc_schedule_templates = this.templates().filter(x => x.id !== id);
    await App.saveLabor();
    this.draw();
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
        hours: c.hours, wage: c.wage, cost: c.cost,
        event: sh.event || ''
      };
    });
    totalCost += this.salariedWeekCost(d.week_start);
    const forecast = this.forecastTotal(d.week_start);

    // Day-off guard: warn before posting anyone onto a day they requested off or
    // never work, so it is a deliberate override, not an accident.
    const offCount = validShifts.filter(sh => this.offReasonFor(sh.staff_id, sh.day)).length;
    if (offCount > 0) {
      const okOff = await App.confirm({
        title: 'Scheduling someone on a day off?',
        message: offCount + ' shift' + (offCount === 1 ? ' is' : 's are') + ' placed on a day someone requested off or does not work. Post the schedule anyway?',
        confirmText: 'Post Anyway', cancelText: 'Keep Editing'
      });
      if (!okOff) return;
    }

    // Over-budget guard: if a forecast is set and the schedule blows past the
    // labor budget, make posting a deliberate call instead of a surprise the
    // operator only notices on the dashboard later in the week.
    const target = this.laborTarget();
    const budget = forecast > 0 ? forecast * target / 100 : 0;
    if (budget > 0 && totalCost > budget) {
      const okOver = await App.confirm({
        title: 'Over your labor budget?',
        message: 'This schedule is ' + App.fmtCurrency(totalCost - budget) + ' over your labor budget of '
          + App.fmtCurrency(budget) + ' for the week (' + App.fmtPct(totalCost / forecast * 100)
          + ' labor vs your ' + App.fmtPct(target) + ' target). Post it anyway?',
        confirmText: 'Post Anyway', cancelText: 'Keep Editing', danger: false
      });
      if (!okOver) return;
    }

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
      // Duplicate-week guard: a second schedule for the same week would make the
      // compare screens (Daily, Weekly, OT, Pay Periods) pick one at random. Offer
      // to replace the existing one in place instead of creating a duplicate.
      const existing = list.find(x => x.week_start === d.week_start);
      if (existing) {
        const dt = new Date(d.week_start + 'T00:00:00');
        const wkLabel = isNaN(dt.getTime()) ? d.week_start : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const replace = await App.confirm({
          title: 'Replace this week\'s schedule?',
          message: 'You already have a posted schedule for the week of ' + wkLabel + '. Saving will replace it. Your saved templates are not affected.',
          confirmText: 'Replace', cancelText: 'Cancel', danger: false
        });
        if (!replace) return;
        rec.id = existing.id;
        rec.created_at = existing.created_at || rec.created_at;
        rec.updated_at = new Date().toISOString();
        const i = list.findIndex(x => x.id === existing.id);
        if (i > -1) list[i] = rec; else list.push(rec);
        saved = rec;
      } else {
        list.push(rec);
      }
    }

    const btn = document.getElementById('bs-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('lc', 'schedule', saved);
    if (ok) {
      App.markSetupDone('gs_lc_schedule');
      // A name in the Template Name box also saves/updates a reusable template
      // (same name updates it, a new name creates one).
      const tmplName = (document.getElementById('bs-tmpl-name')?.value || '').trim();
      if (tmplName) {
        if (!Array.isArray(App.laborData.lc_schedule_templates)) App.laborData.lc_schedule_templates = [];
        const tmpls = App.laborData.lc_schedule_templates;
        const tshifts = validShifts.map(s => ({ staff_id: s.staff_id, day: s.day, start: s.start, end: s.end }));
        const ex = tmpls.find(x => (x.name || '').trim().toLowerCase() === tmplName.toLowerCase());
        if (ex) { ex.shifts = tshifts; ex.name = tmplName; ex.updated_at = new Date().toISOString(); }
        else tmpls.push({ id: App.uid(), name: tmplName, shifts: tshifts, created_at: new Date().toISOString() });
        await App.saveLabor();
      }
      this.editId = null;
      this.clearDraft();
      App.navigate('lc-schedule-history');
    } else {
      if (btn) { btn.disabled = false; btn.textContent = this.editId ? 'Update Schedule' : 'Save Schedule'; }
      fail('Save failed. Try again.');
    }
  }
};
