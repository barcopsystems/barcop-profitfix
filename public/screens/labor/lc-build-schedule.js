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
  /* Departments the operator has collapsed. Lives HERE and not in the DOM: draw() rebuilds
     the whole grid through container.innerHTML on every edit, so markup state would be
     thrown away the moment a shift was added and every section would slam shut. */
  _closedDepts: null,

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
  // The effective forecast (saved override, else computed baseline plus any
  // events booked that week), so a week always builds toward a real, event-aware
  // number without a manual save.
  forecastTotal(weekStart) {
    if (!weekStart || !App.effectiveForecast) return 0;
    const f = App.effectiveForecast(weekStart);
    return f && f.total != null ? Number(f.total) || 0 : 0;
  },

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
  // The Monday-based week selector that replaces the calendar: ONE week range pill
  // (the active-selector style, gold NOW on the current week) flanked by step
  // arrows, plus a snap back to This Week once you step away. Forward IS allowed
  // here so you can build future weeks. Every step lands on a Monday, so there is
  // no calendar to open and no wrong day to pick.
  weekSelector() {
    const sel = this.draft.week_start || this.mondayOf(App.todayLocal());
    const cur = this.mondayOf(App.todayLocal());
    const isCur = sel === cur;
    const nowBadge = isCur ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">'
      + App.dateRangeLabel(sel, App.periodEndFor(sel)).toUpperCase() + nowBadge + '</span>';
    return '<div class="no-print" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-ghost btn-sm" id="bs-week-prev" title="Previous week" aria-label="Previous week" style="margin:0;padding:3px 9px;">&lsaquo;</button>'
      + pill
      + '<button class="btn btn-ghost btn-sm" id="bs-week-next" title="Next week" aria-label="Next week" style="margin:0;padding:3px 9px;">&rsaquo;</button>'
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
    // Newest wins if a week ever carries two schedules (see the duplicate-week guard in
    // save() below, which is why the single-device flow cannot make one). This sets
    // editId, so first-in-array would open the older record for editing while every
    // other screen reads the newer one.
    const posted = this.schedules().filter(s => s.week_start === wk).sort(App.cmpNewest)[0];
    if (posted) {
      this.editId = posted.id;
      this.draft = {
        week_start: posted.week_start || wk,
        /* ⛔⛔ `position_id` USED TO BE DROPPED HERE, AND IT IS A COST DEFECT, NOT A DISPLAY ONE
           (found 2026-09-04 while grouping shifts by role). `save` writes it, the grid reads it for
           the role tag, and `wageForStaffPosition` PRICES from it — so re-opening a posted week
           silently re-costed a cross-trained bartender's floor shift at her bartender rate, which
           is the exact variance the role picker was added to stop. A field a save writes and a
           reload discards is invisible until somebody compares two costs for one week. */
        shifts: (posted.shifts || []).map(sh => ({ staff_id: sh.staff_id, day: sh.day, start: sh.start, end: sh.end, event: sh.event || '', position_id: sh.position_id || '' })),
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
    /* ⚠⚠ THE EMPTY-ROSTER GUARD RUNS FIRST, ABOVE EVERY ONE-SHOT READ (S323a). It used to sit
       sixty lines lower, so a render that shows the setup card and draws NOTHING ELSE still spent
       the Events handoff on the way down: a new operator who booked an event and pressed "Schedule
       Staff for this Event" before adding any staff had `_eventStaffDate` and `_eventStaffTag`
       nulled, the banner never rendered, and after building the roster they had to walk back
       through Events to find the event again — with nothing on the setup card to say anything had
       been dropped. A render that cannot honour a handoff has no business consuming it.
       This is S311a's shape one screen over, never re-asked here ([[the-loop]] #55: the shape is a
       property of a SCREEN, not of a family). The flags are in-memory only, so an unhonoured
       handoff dies with the page rather than lurking to fire unbidden later (S288b). */
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
    // Events "Schedule Staff for this Event" jump: land on the event's week and
    // show a context banner. Reuses the one-shot _gotoWeek handoff below.
    /* ⚠ THE DERIVED VALUE HAS TO BE UNDONE TOO (S311). The two App flags are one-shot and are
       cleared correctly right here — but `_eventContext`, which is built FROM them, lived on the
       screen object with only one clear anywhere: the operator pressing Dismiss. So arriving from
       Events set the gold "Scheduling for <event> on <date>" banner, and opening Build Schedule from
       the NAV a week later still rendered it, pointing at shifts that are no longer on screen (the
       landing logic below correctly puts them on the current week). Clearing a one-shot flag is not
       the same as clearing what you computed from it ([[the-loop]] #25). */
    if (App._eventStaffDate) {
      this._gotoWeek = this.mondayOf(App._eventStaffDate);
      this._eventContext = { name: App._eventStaffTag || '', date: App._eventStaffDate };
      App._eventStaffDate = null; App._eventStaffTag = null;
    } else {
      this._eventContext = null;
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
      // Only resume a draft we can actually SHOW. A cell finds its shift by
      // sh.staff_id === staff.id, so a draft whose staff no longer exist (every
      // sample re-seed mints new ids; a live roster can have people deleted) renders
      // as a completely empty grid while still pinning the screen to that draft's old
      // week. That reads as "Build Schedule keeps opening on the previous week with
      // nothing in it". If nothing in the draft can render, drop it and land on the
      // current week's posted schedule instead.
      const resumable = saved && (saved.shifts || []).some(sh =>
        this.activeStaff().some(st => st.id === sh.staff_id));
      if (resumable) this.draft = saved;
      else { this.clearDraft(); this.loadWeek(this.mondayOf(App.todayLocal())); }
    }
    this.draw();
  },

  // ── Shift math + conflicts ──────────────────────────────────────────────────
  /* ⛔ A SHIFT IS PRICED BY THE ROLE IT IS WORKED IN, NOT BY WHOSE ROW IT SITS ON
     (2026-08-17). This used to call `wageForStaffOn`, which only ever answers for a person's
     PRIMARY position — so a cross-trained bartender picking up a server shift was costed at
     her bar rate. Log Hours already prices the same hours through `wageForStaffPosition` when
     the operator picks the secondary role, so the two screens disagreed by construction and
     Schedule History showed a variance nobody caused.
     ⚠ `wageForStaffPosition` falls back to `wageForStaffOn` for the primary, so a single-role
     person is byte-for-byte unchanged. */
  shiftCalc(sh) {
    const staff = this.staffById(sh.staff_id);
    const hours = this.hoursOf(sh.start, sh.end);
    const wkDate = this.draft.week_start || App.todayLocal();
    if (staff && App.isSalaried(staff)) return { staff, hours, wage: 0, cost: 0, salaried: true };
    const posId = sh.position_id || (staff && staff.position_id) || '';
    const wage = staff ? App.wageForStaffPosition(staff, posId, wkDate) : 0;
    return { staff, hours, wage, cost: hours * wage, position_id: posId };
  },
  /* The roles a person can be scheduled in, primary first. Deliberately the SAME rule Log
     Hours uses — a secondary position that differs from the primary AND carries a positive
     wage — because a picker that offers a role Log Hours will not accept is a door to a shift
     nobody can cost. Read off lc-log-hours so the two cannot drift apart. */
  _hasSecondary(staffId) {
    const s = this.staffById(staffId);
    return !!(s && s.secondary_position_id && s.secondary_position_id !== s.position_id
              && (parseFloat(s.secondary_wage) || 0) > 0);
  },
  roleOptionsFor(staffId, selectedPosId) {
    const s = this.staffById(staffId);
    if (!s) return '';
    const nameOf = id => { const p = this.positionById(id); return p ? p.name : ''; };
    const opts = [];
    if (s.position_id) opts.push({ id: s.position_id, label: nameOf(s.position_id) || 'Primary' });
    if (s.secondary_position_id && s.secondary_position_id !== s.position_id) {
      opts.push({ id: s.secondary_position_id, label: nameOf(s.secondary_position_id) || 'Secondary' });
    }
    if (!opts.length) return '';
    const sel = (selectedPosId != null && selectedPosId !== '') ? selectedPosId : s.position_id;
    return opts.map(o => '<option value="' + esc(o.id) + '"' + (o.id === sel ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('');
  },
  // The role label to badge on a block — blank when it is the person's primary, so the grid
  // only ever calls out the exception.
  shiftRoleTag(sh) {
    const s = this.staffById(sh.staff_id);
    if (!s || !sh.position_id || sh.position_id === s.position_id) return '';
    const p = this.positionById(sh.position_id);
    return p ? p.name : '';
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
    const byStaff = {};       // staff_id -> scheduled hours (hourly only; salaried get no OT)
    const byStaffCost = {};   // parallel base cost per hourly staff, for the OT premium
    let hours = 0, cost = 0, conflicts = 0, offConflicts = 0;
    this.draft.shifts.forEach((sh, i) => {
      if (!sh.staff_id || !sh.start || !sh.end) return;
      const c = this.shiftCalc(sh);
      hours += c.hours; cost += c.cost;
      if (byDay[sh.day]) { byDay[sh.day].hours += c.hours; byDay[sh.day].count += 1; }
      if (!c.salaried) {
        byStaff[sh.staff_id] = (byStaff[sh.staff_id] || 0) + c.hours;
        byStaffCost[sh.staff_id] = (byStaffCost[sh.staff_id] || 0) + c.cost;
      }
      if (this.isConflict(sh, i)) conflicts++;
      if (this.offReasonFor(sh.staff_id, sh.day)) offConflicts++;
    });
    // Add the overtime premium (0.5x on weekly hours over the threshold, at the
    // staff member's blended rate) so Scheduled Cost / Labor % / Budget Left match
    // what OT actually bills at Pay Periods and Payroll — the schedule used to omit
    // it, understating cost exactly when someone is scheduled into overtime.
    const OT = App.OT_THRESHOLD || 40;
    Object.keys(byStaff).forEach(sid => {
      const h = byStaff[sid];
      if (h > OT && byStaffCost[sid] > 0) cost += (h - OT) * App.otHourlyPremium(byStaffCost[sid] / h);
    });
    cost += this.salariedWeekCost(this.draft.week_start);
    return { hours, cost, byDay, byStaff, conflicts, offConflicts };
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

  /* ═══ THE SHIFT MODAL'S MODEL: ONE PERSON'S WEEK AS BLOCKS OF TIME ═══════════════════════════
     Kyle, 2026-09-04: *"the time modal has '+ Add Another Shift Time'... so a user can easily add a
     double shift on the same day in one click.. but also different shift times on different days on
     the same screen.. then if a shift is opened to edit that has different shift times on different
     days.. it is all on that box with the day pills selected for each shift time."*
     ⭐⭐⭐ THE MONEY IS HERE AND IT IS DELIBERATELY DOM-FREE. Three pure members — group, plan,
     summarise — so the reconcile can be pinned by running it, not by rendering it. Every defect this
     feature can have is a wrong SET of shifts, and a harness cannot click ([[the-loop]] #8).
     ⛔ AND THE SUMMARY READS THE SAME PLAN THE SAVE WRITES. The "removes 1" line an operator reads
     before pressing must be produced by the function that does the work, or the sentence and the
     write drift and the screen lies about what it is about to do ([[the-loop]] #54). */

  // The key that decides "these two shifts are the same kind of shift" and therefore share a block.
  // Role is IN it: the same hours worked in a different role is a different shift, priced differently.
  _blockKey(sh) { return [sh.start || '', sh.end || '', sh.position_id || ''].join('|'); },

  /* One person's draft shifts folded into blocks, in the order the week reads. Every shift lands in
     exactly one block, so the modal shows the whole week and nothing of theirs is off-screen. */
  _blocksFor(staffId) {
    const byKey = {}, order = [];
    this.DAYS.forEach(day => {
      this.shiftsFor(staffId, day).forEach(({ sh }) => {
        const k = this._blockKey(sh);
        if (!byKey[k]) { byKey[k] = { start: sh.start || '', end: sh.end || '', position_id: sh.position_id || '', days: [], events: {} }; order.push(k); }
        if (byKey[k].days.indexOf(day) < 0) byKey[k].days.push(day);
        if (sh.event) byKey[k].events[day] = sh.event;
      });
    });
    return order.map(k => byKey[k]);
  },

  /* What the blocks describe, as shift records. Returns errors rather than dropping a block: a block
     carrying a time and no days is a half-finished thought, and silently ignoring it is how an
     operator presses Save, sees nothing appear, and cannot tell why ([[the-loop]] #53 — a refusal
     must say why). An untouched empty block is not an error; it is just empty. */
  _planShifts(staffId, blocks) {
    const shifts = [], errors = [];
    (blocks || []).forEach(b => {
      const days = (b.days || []).filter(d => this.DAYS.indexOf(d) >= 0);
      const timed = !!(b.start && b.end);
      if (!timed && !days.length) return;
      if (!timed) { errors.push('Set a start and end time for every shift.'); return; }
      /* ⚠ THE REFUSAL NAMES THE WAY OUT. It used to say only "Pick at least one day", which was a
         dead end: unticking every day is how an operator says they do not want the shift, and the
         only reply was to put a day back. Delete is the other answer and the sentence says so
         ([[the-loop]] #53 — a refusal must point somewhere you can act). */
      if (!days.length) { errors.push('Either delete or pick at least one day for the ' + this._fmtTime(b.start) + ' shift.'); return; }
      days.forEach(day => shifts.push({
        staff_id: staffId, day: day, start: b.start, end: b.end,
        event: (b.events && b.events[day]) || '', position_id: b.position_id || ''
      }));
    });
    return { shifts: shifts, errors: errors };
  },

  /* What pressing Save will actually do, counted against what is already there. This is the sentence
     the operator reads, and it exists because unticking a day REMOVES that day's shift — the one
     thing about this modal that is destructive, so it may never be silent. */
  _planSummary(staffId, planned) {
    const key = s => [s.day, s.start, s.end, s.position_id || ''].join('|');
    const tally = arr => arr.reduce((m, s) => { const k = key(s); m[k] = (m[k] || 0) + 1; return m; }, {});
    const before = tally((this.draft.shifts || []).filter(s => s.staff_id === staffId));
    const after = tally(planned || []);
    let added = 0, removed = 0, kept = 0;
    Object.keys(after).forEach(k => { const b = before[k] || 0; kept += Math.min(b, after[k]); added += Math.max(0, after[k] - b); });
    Object.keys(before).forEach(k => { const a = after[k] || 0; removed += Math.max(0, before[k] - a); });
    return { added: added, removed: removed, kept: kept, total: (planned || []).length };
  },

  /* ⛔ ONE STAFF MEMBER ONLY. The modal owns this person's week and nothing else, so the rebuild
     drops their rows and re-adds the planned ones while every other row is carried across
     untouched. A reconcile that rebuilt the whole array would put one person's edit in a position to
     lose somebody else's shift, which no assertion about counts would notice. */
  _applyPlan(staffId, planned) {
    const others = (this.draft.shifts || []).filter(s => s.staff_id !== staffId);
    this.draft.shifts = others.concat(planned || []);
    return this.draft.shifts;
  },

  // ONE box for every scheduling issue in the current draft: overtime, overlapping
  // shifts, and shifts on a day off. Each is its own labelled section (amber for an
  // overridable watch, red for a real conflict) separated by a faint divider, so
  // the operator can scan everything before posting. Re-runs on every grid change
  // (draw() recomputes), so fixing an issue drops it out; no issues = no box.
  schedulingWarnings(T) {
    const OT = App.OT_THRESHOLD || 40;
    const sections = [];

    // Overtime: hourly staff at or near 40 this week.
    const ot = Object.keys(T.byStaff || {})
      .map(id => ({ id, hrs: T.byStaff[id] }))
      .filter(x => x.hrs >= OT - 2)
      .sort((a, b) => b.hrs - a.hrs)
      .map(x => {
        const st = this.staffById(x.id); const nm = st ? (st.name || 'Staff') : 'Staff';
        const tag = x.hrs > OT ? '(' + (x.hrs - OT).toFixed(1) + ' OT)' : '(near OT)';
        return '<span style="color:var(--t1);font-weight:600;">' + esc(nm) + '</span> ' + x.hrs.toFixed(1) + ' hrs ' + tag;
      });
    if (ot.length) sections.push({ label: 'Overtime Watch', color: 'var(--amber)', body: ot.join(' &middot; '),
      note: 'Hours over ' + OT + ' in a week are paid at time and a half. Trim a shift to stay under, or schedule it on purpose.' });

    // Overlapping shifts + shifts on a day off — distinct staff+day.
    const seenOv = new Set(), ov = [], seenOff = new Set(), off = [];
    this.draft.shifts.forEach((sh, i) => {
      if (!sh.staff_id || !sh.day) return;
      const st = this.staffById(sh.staff_id); const nm = st ? (st.name || 'Staff') : 'Staff';
      const k = sh.staff_id + '|' + sh.day;
      if (sh.start && sh.end && this.isConflict(sh, i) && !seenOv.has(k)) {
        seenOv.add(k); ov.push('<span style="color:var(--t1);font-weight:600;">' + esc(nm) + '</span> ' + esc(sh.day));
      }
      const offReason = this.offReasonFor(sh.staff_id, sh.day);
      if (offReason && !seenOff.has(k)) {
        seenOff.add(k); off.push('<span style="color:var(--t1);font-weight:600;">' + esc(nm) + '</span> ' + esc(sh.day) + ' <span style="color:var(--t4);">(' + esc(offReason) + ')</span>');
      }
    });
    if (ov.length) sections.push({ label: 'Overlapping Shifts', color: 'var(--red)', body: ov.join(' &middot; '),
      note: 'The same person is booked twice on the same day. Fix the times or remove a shift.' });
    if (off.length) sections.push({ label: 'Scheduled On A Day Off', color: 'var(--amber)', body: off.join(' &middot; '),
      note: 'On a requested or regular day off. Move it, or post it on purpose.' });

    if (!sections.length) return '';
    const rows = sections.map((s, i) => '<div style="' + (i ? 'border-top:1px solid var(--b2);margin-top:11px;padding-top:11px;' : '') + '">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + s.color + ';margin-bottom:5px;">' + s.label + '</div>'
      + '<div style="font-size:11px;color:var(--t2);line-height:1.7;">' + s.body + '</div>'
      + '<div style="color:var(--t4);font-size:10px;margin-top:3px;">' + s.note + '</div></div>').join('');
    return '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-top:12px;">' + rows + '</div>';
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
        + '<div style="font-size:13px;color:var(--t2);">No revenue history yet to project this week. Type a forecast to build a budget.</div>'
        + '<button class="btn btn-primary btn-sm" id="bs-fc">Set Forecast</button></div></div>';
    } else {
      const leftCls = left >= 0 ? 'good' : 'warn';
      /* ⚠⚠ EVERY FIGURE ON THIS CARD HAS TO BE ACCOUNTABLE FROM THIS CARD (L13, Kyle 2026-08-01).
         Stepping to a week with no shifts, Scheduled read $1,307.69 and nothing on screen explained
         it: `computeTotals` adds the salaried week cost unconditionally, so a salaried GM shows up
         in the total while never appearing as a rostered shift. The ARITHMETIC is right and worth
         keeping — he is paid that week regardless, so Budget Left is honestly what is left for the
         crew — but an operator staring at an empty grid could not reconcile the number to anything.
         Say what the salary is, and say what percent the budget was set at.
         ⚠ The salaried figure is the ONLY one here with no other source on screen. `pct` and
         `target` are both already printed in the totals strip lower down (Labor % / Target), which
         is why the first version of the Scheduled sub-line read as clutter the moment it rendered:
         it repeated a number the page already carried. Do not re-add it. */
      const salWk = this.salariedWeekCost(d.week_start);
      const sub = t => '<div style="font-size:10px;color:var(--t3);margin-top:3px;">' + t + '</div>';
      budgetCard = '<div class="card"><div style="display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Revenue Forecast</div><div class="calc-val lg">' + App.fmtCurrency(fc)
        + ' <button class="btn btn-ghost btn-sm" id="bs-fc" style="font-size:10px;letter-spacing:1px;padding:2px 8px;vertical-align:middle;">Edit</button></div></div>'
        + '<div class="calc-item"><div class="calc-label">Labor Budget</div><div class="calc-val lg">' + App.fmtCurrency(budget)
        + ' <button class="btn btn-ghost btn-sm" id="bs-lt" style="font-size:10px;letter-spacing:1px;padding:2px 8px;vertical-align:middle;">Edit</button></div>'
        + sub(App.fmtPct(target) + ' of forecast &middot; Edit to change') + '</div>'
        + '<div class="calc-item"><div class="calc-label">Target Hours</div><div class="calc-val lg">' + (targetHrs > 0 ? targetHrs.toFixed(1) + ' hrs' : '-') + '</div></div>'
        /* ⚠ THE SUB-LINE SAYS ONE THING (Kyle, on seeing it rendered). It first carried the
           scheduled percent AND the salaried note; two clauses under a tile is more text than the
           row can hold, and the percent is the one that was not asked for — Labor Budget already
           states the percent basis two tiles left, so repeating it here bought nothing. The
           salaried note is the whole point: it is the figure with no other source on screen.
           Nothing renders at all when there is no salaried cost. */
        + '<div class="calc-item"><div class="calc-label">Scheduled</div><div class="calc-val lg">' + App.fmtCurrency(T.cost) + '</div>'
        + (salWk > 0 ? sub('includes ' + App.fmtCurrency(salWk) + ' salaried') : '') + '</div>'
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

    /* ⭐ FIRST LANDING OPENS EXACTLY ONE, never none (Kyle). After that the operator owns it
       and may close all of them if they want to; only the DEFAULT is guaranteed.
       ⛔ AND THE SET IS PRUNED EVERY DRAW. A department only exists while some active staff
       member sits in a position carrying it, so renaming a position or deactivating the last
       person in one would otherwise leave a name stuck in the closed list forever, and if it
       ever came back it would return collapsed for no reason the operator could see. */
    if (!this._closedDepts) this._closedDepts = orderedDepts.slice(1);
    this._closedDepts = this._closedDepts.filter(x => orderedDepts.indexOf(x) >= 0);

    let body = '';
    orderedDepts.forEach(dep => {
      /* ⚠ THE HEADER KEEPS ITS OWN LOOK. Same 9px gold caps as before; the only additions are
         a chevron and a pointer. The clickable element is INLINE-flex so the chevron sits
         beside the word rather than at the far end of an eight-column row. */
      const depClosed = this._closedDepts.indexOf(dep) >= 0;
      body += '<tr><td colspan="' + (days.length + 1) + '" style="padding:10px 8px;border-top:1px solid var(--b2);">'
        + '<div class="bs-dept-head' + (depClosed ? ' collapsed' : '') + '" data-dept="' + esc(dep) + '"'
        + ' style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">'
        + esc(dep) + '<span class="card-chevron" aria-hidden="true">&#9662;</span>'
        /* The head count reads off the SAME array the rows are drawn from, so it can never
           disagree with what opening the section shows. Useful precisely when shut. */
        + '<span class="bs-dept-n">' + groups[dep].length + '</span></div></td></tr>';
      /* ⛔ A CLOSED SECTION RENDERS NO ROWS AT ALL, rather than hiding them with display:none.
         It matches Close The Week's lane bodies, and it means no click handler is ever bound
         to a cell nobody can see. It changes NOTHING about the numbers: computeTotals() walks
         draft.shifts and never reads the DOM, so day totals, labor hours, cost, %, RPLH and
         the warning box below the grid are all identical open or shut. */
      if (depClosed) return;
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
            /* A shift worked in the SECONDARY role names it on the block. Blank for a primary
               shift, so the grid only ever calls out the exception — a manager reading the week
               can see at a glance that Tuesday is a floor shift, without opening it. */
            const roleTag = this.shiftRoleTag(sh);
            cellInner += '<div class="bs-block" data-idx="' + i + '" title="' + (offReason ? esc(offReason) : 'Click to edit') + '"'
              + ' style="cursor:pointer;border:1px solid ' + border + ';border-radius:4px;padding:3px 5px;margin-bottom:3px;background:' + blockBg + ';">'
              + '<div style="font-size:11px;color:var(--t1);font-weight:600;">' + esc(this._fmtTime(sh.start)) + '–' + esc(this._fmtTime(sh.end)) + '</div>'
              + '<div style="font-size:9px;color:' + (flagged ? 'var(--red)' : 'var(--t3)') + ';">' + (sal ? 'salaried' : c.hours.toFixed(1) + 'h') + flagNote + '</div>'
              + (roleTag ? '<div style="font-size:9px;color:var(--gold);font-weight:700;">' + esc(roleTag) + '</div>' : '')
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
    let footer = '<tr><td style="padding:14px 8px 8px;font-size:10px;letter-spacing:1px;color:var(--t3);text-align:right;border-top:1px solid var(--b2);">Day total</td>';
    days.forEach(day => {
      const dd = T.byDay[day];
      footer += '<td style="padding:14px 6px 6px;text-align:center;border-top:1px solid var(--b2);border-left:1px solid var(--b2);">'
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

    const gridCard = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 14px;flex-wrap:wrap;">'
      + this.weekSelector()
      + '<div class="no-print" style="display:flex;gap:8px;">'
      + '<button class="btn btn-ghost btn-sm" id="bs-new">New Schedule</button>'
      + '<button class="btn btn-ghost btn-sm" id="bs-export">Export PDF</button>'
      + '<button class="btn btn-ghost btn-sm" id="bs-worksheet">Worksheet</button></div></div>'
      + lastWeekNudge
      + '<div class="bs-gridview"><div class="card" style="padding:0;overflow:hidden;"><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">'
      + '<thead><tr><th style="padding:8px;text-align:left;font-size:10px;letter-spacing:1px;color:var(--t3);">Staff</th>' + headCells + '</tr></thead>'
      + '<tbody>' + body + footer + '</tbody></table></div></div></div>'
      + this.dayViewHTML(d, T)
      + this.schedulingWarnings(T);

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
      + '<div class="form-row" style="gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:0;">'
      + '<div class="f" style="width:320px;max-width:100%;"><label>Template Name</label>'
      + '<input type="text" id="bs-tmpl-name" value="' + esc(d.from_template_name || '') + '" placeholder="Optional, name it to save as a template"/></div>'
      + '</div>'
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
    /* ⚠⚠ ONLY OVER THE WEEK IT DESCRIBES (S323b). Nothing reconciled this banner against the grid:
       the week picker moves `draft.week_start` and never touched the context, so stepping back
       three weeks left "Scheduling for Smith Wedding on Sat, Aug 15" sitting over a week that does
       not contain Aug 15, telling the operator to open "each person working that day" and tick a
       checkbox that is on none of the cells in front of them. Every clause of it was false on that
       screen ([[output-honesty]]).
       ⚠ HIDDEN, NOT CLEARED — and that is the whole point. Nulling the context on a week change
       would mean stepping away and back loses it for good, which is the same destroy-what-you-can-
       restore mistake S321 and S323a were both about. Dismiss still clears it outright.
       ⚠ A context with no date, or a screen with no week loaded yet, renders as before: there is no
       week for it to contradict, so suppressing it would hide a true banner. */
    if (c.date && this.draft && this.draft.week_start && this.mondayOf(c.date) !== this.draft.week_start) return '';
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
          const roleTag = this.shiftRoleTag(sh);      // same rule as the desktop grid
          blocks += '<div class="bs-mblock" data-staff="' + esc(s.id) + '" data-day="' + esc(day) + '" data-idx="' + i + '" style="cursor:pointer;border:1px solid ' + border + ';border-radius:4px;padding:5px 8px;background:' + blockBg + ';">'
            + '<div style="font-size:12px;color:var(--t1);font-weight:600;">' + esc(this._fmtTime(sh.start)) + '–' + esc(this._fmtTime(sh.end)) + '</div>'
            + '<div style="font-size:9px;color:' + (flagged ? 'var(--red)' : 'var(--t3)') + ';">' + (sal ? 'salaried' : c.hours.toFixed(1) + 'h') + flagNote + '</div>'
            + (roleTag ? '<div style="font-size:9px;color:var(--gold);font-weight:700;">' + esc(roleTag) + '</div>' : '') + '</div>';
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
    document.getElementById('bs-week-now')?.addEventListener('click', async () => {
      const target = this.mondayOf(App.todayLocal());
      if (target === (this.draft.week_start || '')) return;
      if (!(await this.confirmLeaveUnsaved())) return;
      this.loadWeek(target); this.draw();
    });
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
    document.getElementById('bs-export')?.addEventListener('click', () => this.exportSchedulePDF());
    document.getElementById('bs-worksheet')?.addEventListener('click', () => this.printWorksheet());

    /* Department headers. Each toggles on its own, deliberately NOT an accordion: building
       coverage means reading Kitchen against Front of House, and closing one to open another
       would fight that. Re-draws rather than toggling a class, because the rows for a closed
       section are not in the document at all. */
    this.container.querySelectorAll('.bs-dept-head').forEach(h => {
      h.addEventListener('click', () => {
        const dep = h.dataset.dept;
        if (!dep || !this._closedDepts) return;
        const at = this._closedDepts.indexOf(dep);
        if (at >= 0) this._closedDepts.splice(at, 1); else this._closedDepts.push(dep);
        this.draw();
      });
    });

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

  // Export the built schedule as a PDF (staff x days grid) the manager can print
  // and post. Built from the schedule data (not the interactive grid, whose cells
  // are buttons), rendered off-screen as a .tbl so App.exportPDF styles it like
  // every other export. Only staff with a shift this week appear.
  exportSchedulePDF() {
    const d = this.draft;
    if (!d.week_start) { alert('Pick a week first.'); return; }
    const days = this.DAYS;
    const cellFor = (id, day) => (d.shifts || [])
      .filter(x => x.staff_id === id && x.day === day && x.start && x.end)
      .map(x => this._fmtTime(x.start) + '-' + this._fmtTime(x.end)).join(', ');
    // Same order as the grid: department, then name — but only scheduled staff.
    const groups = {};
    this.activeStaff().forEach(s => { const dep = this.deptOf(s.id); (groups[dep] = groups[dep] || []).push(s); });
    const orderedDepts = this.DEPT_ORDER.filter(x => groups[x]).concat(Object.keys(groups).filter(x => this.DEPT_ORDER.indexOf(x) < 0));
    const rows = [];
    orderedDepts.forEach(dep => {
      groups[dep].sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(s => {
        if ((d.shifts || []).some(x => x.staff_id === s.id && x.start && x.end)) rows.push(s);
      });
    });
    if (!rows.length) { alert('No shifts on this schedule yet.'); return; }
    const head = '<tr><th>Staff</th>' + days.map((day, i) => { const dd = this.dayDate(d.week_start, i); return '<th>' + day + (dd ? ' ' + dd : '') + '</th>'; }).join('') + '</tr>';
    const bodyRows = rows.map(s => '<tr><td>' + esc(s.name || 'Staff') + '</td>'
      + days.map(day => '<td>' + esc(cellFor(s.id, day) || '-') + '</td>').join('') + '</tr>').join('');
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:1000px;';
    holder.innerHTML = '<div class="screen"><table class="tbl"><thead>' + head + '</thead><tbody>' + bodyRows + '</tbody></table></div>';
    document.body.appendChild(holder);
    App.exportPDF({ title: 'Schedule - Week of ' + this.weekLabel(d.week_start), root: holder, orientation: 'landscape' })
      .catch(() => {}).finally(() => holder.remove());
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
  /* ═══ THE SHIFT MODAL — ONE PERSON'S WEEK, NOT ONE DAY ═════════════════════════════════════
     Kyle, 2026-09-04: *"the time modal has '+ Add Another Shift Time'... so a user can easily add a
     double shift on the same day in one click.. but also different shift times on different days on
     the same screen.. then if a shift is opened to edit that has different shift times on different
     days.. it is all on that box with the day pills selected for each shift time.. the only thing
     that is unclickable is the same days off/time off."*
     ⭐⭐⭐ THE DESIGN THAT REMOVED A RULE RATHER THAN ADDING ONE. An earlier draft made a day
     carrying a DIFFERENT shift time unclickable, purely to stop a hidden overwrite. Once every one
     of the person's shift times is on screen as its own block there is nothing hidden, so that rule
     went and every day is clickable except a real day off.
     ⛔⛔ THE ONE DESTRUCTIVE THING IT CAN DO IS UNTICK, and it may never be quiet about it: the net
     line above the button counts what will be added and REMOVED, read from the same plan the save
     writes, so the sentence cannot drift from the write ([[the-loop]] #54).
     ⚠ AN OFF DAY THAT ALREADY CARRIES A SHIFT STAYS CLICKABLE. You may not ADD to a day off here,
     but a shift already sitting on one has to be removable or the operator is stuck with a mistake
     the single-day path let them make ([[lessons-paid-for]] #106 — a control that tells you to
     ignore it cannot be the safety net).
     ⚠ STATE LIVES ON THE SCREEN OBJECT, and the body is re-rendered whole on every structural
     change. Anything captured before that repaint is a detached node ([[lessons-paid-for]] #178). */
  openShiftModal(staffId, day, idx) {
    const staff = this.staffById(staffId);
    if (!staff) return;
    this._mStaff = staffId;
    this._mBlocks = this._blocksFor(staffId);
    /* Clicking an EMPTY cell opens a fresh block with that day already ticked, so the one-day path
       an operator has always used still takes the same number of presses. Clicking a day that
       already has a shift opens the week as it stands, that shift's block among them. */
    /* ⛔ ONE BLOCK ON OPEN UNLESS THE PERSON GENUINELY HAS TWO SHIFT TIMES (Kyle, 2026-09-04: *"it
       should still only open with one shift time and then the add another shift time.. the only time
       it should open with two.. is if a staff with two different shift times is being edited"*).
       The first version pushed a fresh block whenever the CLICKED CELL was empty, so anyone who
       already had a shift opened with their block plus a spare — two sections for one shift time.
       A blank block is only ever added when the person has nothing at all.
       ⚠ A NEW BLOCK CARRIES THE PRIMARY ROLE, not a blank. The old save stamped
       `staff.position_id` whenever there was no picker, and its comment says why: an absent role
       means the primary, and a blank would cost the shift at $0 for single-role staff. */
    if (!this._mBlocks.length) {
      this._mBlocks.push({ start: '', end: '', position_id: staff.position_id || '', days: [day], events: {} });
    }
    /* ⛔⛔ THE TITLE IS A DIRECT CHILD OF THE CARD AND MUST STAY ONE. `.card-title` is a card head
       BAND — `margin:-20px -20px` plus a top radius — and the modal's own override that flattens it
       is written `#app-modal-host .form-card > .card-title`, a DIRECT-CHILD selector. Rendering it
       one level deeper inside the body missed that override, so the band bled past the card and
       took the top border with it, which is exactly what Kyle saw ([[lessons-paid-for]] #11 — a
       class is a contract, and the pass that changes it does not know who is renting it).
       ⚠ SO THE TOTAL UPDATES IN PLACE instead of being re-rendered with the body. */
    App.openModal('<div class="card form-card" style="margin:0;">'
      + '<div class="card-title" style="display:flex;align-items:baseline;gap:14px;">'
      +   '<span>' + esc(staff.name || 'Staff') + '</span>'
      +   '<span id="bs-m-total" style="color:var(--t2);"></span>'
      + '</div>'
      + '<div id="bs-m-body"></div></div>',
      { id: 'bs-shift-modal', maxWidth: 520, confirmDirty: true });
    this._renderShiftModal();
  },

  _renderShiftModal() {
    const host = document.getElementById('bs-m-body');
    if (!host) return;
    host.innerHTML = this._shiftModalHTML(this._mStaff);
    // The head is outside the body (see openShiftModal), so its figure is written, not re-rendered.
    const tot = document.getElementById('bs-m-total');
    if (tot) tot.innerHTML = this._shiftTotalLine(this._mStaff);
    this._wireShiftModal();
  },

  /* The week being committed: every block, every day. A per-block figure understates what the
     operator is about to do, which is why Kyle asked for one number beside the name. */
  _shiftTotalLine(staffId) {
    const staff = this.staffById(staffId);
    if (!staff) return '';
    const sal = App.isSalaried(staff);
    let hrs = 0, cost = 0;
    (this._mBlocks || []).forEach(b => {
      const n = (b.days || []).length;
      if (!b.start || !b.end || !n) return;
      const h = this.hoursOf(b.start, b.end);
      hrs += h * n;
      if (!sal) cost += h * n * App.wageForStaffPosition(staff, b.position_id || staff.position_id || '', this.draft.week_start);
    });
    if (!hrs) return '';
    return hrs.toFixed(1) + ' hrs &middot; ' + (sal ? 'salaried (no hourly cost)' : App.fmtCurrency(cost));
  },

  // The event rows for ONE block, one per selected day that has a booking. An event belongs to a
  // DAY, so a block spanning Mon and Fri with a booking on Fri names Fri and says nothing about Mon.
  _eventRowsFor(staffId, bi, b) {
    return (b.days || []).map(d => {
      const evs = this.bookingsOnDate(this.dayIso(this.draft.week_start, this.DAYS.indexOf(d)));
      if (!evs.length) return '';
      const cur = (b.events && b.events[d]) || '';
      if (evs.length === 1) {
        return '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--t1);margin-top:8px;">'
          + '<input type="checkbox" class="bc-check bs-m-ev" data-b="' + bi + '" data-day="' + esc(d) + '" data-eid="' + esc(evs[0].id) + '"'
          + (cur === evs[0].id ? ' checked' : '') + '/> Working ' + esc(this.bookingName(evs[0])) + ' (' + esc(d) + ')</label>';
      }
      /* More than one booking on that day keeps the picker this screen already used, rather than
         inventing a third shape for the same question ([[the-loop]] #95 — the existing callers are
         the spec). */
      return '<div class="f" style="margin-top:8px;"><label>Working an event on ' + esc(d) + '?</label>'
        + '<select class="bs-m-evsel" data-b="' + bi + '" data-day="' + esc(d) + '"><option value="">No</option>'
        + evs.map(e => '<option value="' + esc(e.id) + '"' + (cur === e.id ? ' selected' : '') + '>' + esc(this.bookingName(e)) + '</option>').join('')
        + '</select></div>';
    }).join('');
  },

  _shiftModalHTML(staffId) {
    const staff = this.staffById(staffId);
    if (!staff) return '';
    const sal = App.isSalaried(staff);
    const roleable = !sal && this._hasSecondary(staffId);
    const blocks = this._mBlocks || [];

    const body = blocks.map((b, i) => {
      const role = roleable
        ? '<div class="f" style="margin-bottom:12px;"><label>Role</label>'
          + '<select class="bs-m-role" data-b="' + i + '">' + this.roleOptionsFor(staffId, b.position_id) + '</select></div>'
        : '';
      const pills = this.DAYS.map(d => {
        const off = this.offReasonFor(staffId, d);
        const on = (b.days || []).indexOf(d) >= 0;
        const locked = !!off && !on;
        return '<button type="button" class="bs-m-day btn btn-sm" data-b="' + i + '" data-day="' + esc(d) + '"'
          + (locked ? ' disabled title="' + esc(off) + '"' : (off ? ' title="' + esc(off) + '"' : ''))
          + ' style="' + (locked ? 'background:transparent;border:1px solid var(--b2);color:var(--t4);opacity:0.45;cursor:not-allowed;'
              : on ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
                   : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + esc(d) + '</button>';
      }).join('');
      /* ⛔⛔ DELETE IS WHAT MAKES THE MODAL COMPLETE, AND IT WAS MISSING (Kyle, 2026-09-04: *"unselect
         monday because i want to cancel that shift.. and it won't let me.. i have to pick at least
         one day for the shift.. what if i don't want that shift anymore?"*). Unticking every day was
         a dead end: the plan refuses a block with a time and no days, so there was no way out of a
         shift time at all. One control, on the chip row where the days it kills are.
         ⚠ AND IT REPLACES THE Add/Cancel TOGGLE rather than joining it. Two controls that both make
         a block go away is the clutter Kyle flagged on the first draft; Delete cancels a block you
         just opened and removes one you saved, which is the same act ([[the-loop]] #90 — remove the
         window, do not police it). */
      const evRows = this._eventRowsFor(staffId, i, b);
      return '<div class="bs-m-block" style="padding:14px 0;' + (i < blocks.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
        + role
        + '<div class="form-row" style="margin-bottom:12px;">' + this._timeSelectFields('bs-m-start-' + i, b.start, 'Start') + '</div>'
        + '<div class="form-row" style="margin-bottom:0;">' + this._timeSelectFields('bs-m-end-' + i, b.end, 'End') + '</div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:14px;">'
        +   pills
        +   '<button type="button" class="bs-m-del btn btn-sm" data-b="' + i + '" style="margin-left:auto;background:transparent;border:1px solid var(--red);color:var(--red);font-weight:700;">Delete</button>'
        + '</div>'
        // ⚠ the event rows need real air under the chips, or the checkbox reads as part of the row.
        + (evRows ? '<div style="margin-top:14px;">' + evRows + '</div>' : '')
        + '</div>';
    }).join('');

    const plan = this._planShifts(staffId, blocks);
    const sum = this._planSummary(staffId, plan.shifts);
    /* ⛔ THE REMOVAL IS NAMED AND IT IS RED. Everything else about this modal is additive; unticking
       is the one thing that destroys work, so it is the one thing the sentence leads with when it
       happens ([[output-honesty]] — the operator sees what is about to be true). */
    const bits = [];
    if (sum.added) bits.push(sum.added + ' to add');
    if (sum.removed) bits.push('<span style="color:var(--red);font-weight:700;">' + sum.removed + ' to remove</span>');
    /* ⛔ AN UNFINISHED BLOCK IS SAID OUT LOUD, NOT SAVED UP FOR THE BUTTON PRESS. `_planShifts`
       skips a block it cannot use, so the count read "Save 5 Shifts" while a block carrying a time
       and no days sat above it — a true number about a plan that was quietly ignoring part of the
       screen ([[output-honesty]]). The refusal belongs where the operator is looking. */
    const net = plan.errors.length
      ? '<span style="color:var(--red);font-weight:700;">' + esc(plan.errors[0]) + '</span>'
      : (bits.length ? bits.join(', ') + '.' : (sum.total ? 'No changes.' : 'No shifts set.'));
    const label = plan.shifts.length === 1 ? 'Save Shift' : 'Save ' + plan.shifts.length + ' Shifts';

    return body
      + '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--b2);">'
      +   '<button type="button" id="bs-m-add" style="background:none;border:0;padding:0;color:var(--gold);font-weight:700;font-size:12px;cursor:pointer;">+ Add Another Shift Time</button>'
      + '</div>'
      + '<div id="bs-m-net" style="font-size:12px;color:var(--t2);margin-top:14px;">' + net + '</div>'
      + '<div class="card-actions">'
      +   '<button class="btn btn-primary" id="bs-m-save">' + esc(label) + '</button>'
      +   '<span id="bs-m-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';
  },

  /* Read the DOM back into the blocks before any structural change, or a time typed just before
     pressing a pill is lost when the body re-renders. */
  _readModalBlocks() {
    const staff = this.staffById(this._mStaff) || {};
    (this._mBlocks || []).forEach((b, i) => {
      b.start = this._readTime('bs-m-start-' + i) || '';
      b.end = this._readTime('bs-m-end-' + i) || '';
      const r = document.querySelector('.bs-m-role[data-b="' + i + '"]');
      // `|| staff.position_id` is the old save's rule verbatim: an empty picker means the primary.
      if (r) b.position_id = r.value || staff.position_id || '';
      b.events = b.events || {};
      document.querySelectorAll('.bs-m-ev[data-b="' + i + '"]').forEach(cb => {
        if (cb.checked) b.events[cb.dataset.day] = cb.dataset.eid; else delete b.events[cb.dataset.day];
      });
      document.querySelectorAll('.bs-m-evsel[data-b="' + i + '"]').forEach(sel => {
        if (sel.value) b.events[sel.dataset.day] = sel.value; else delete b.events[sel.dataset.day];
      });
      /* An event only survives while its day is still selected — a booking tagged on Friday must not
         ride along after Friday is unticked ([[lessons-paid-for]] #15 — a companion field is cleared
         by whoever clears its principal). */
      Object.keys(b.events).forEach(d => { if ((b.days || []).indexOf(d) < 0) delete b.events[d]; });
    });
  },

  _wireShiftModal() {
    const staffId = this._mStaff;
    const errEl = document.getElementById('bs-m-err');
    const redraw = () => { this._readModalBlocks(); this._renderShiftModal(); };

    document.querySelectorAll('#bs-m-body select').forEach(el => el.addEventListener('change', redraw));
    document.querySelectorAll('#bs-m-body .bs-m-day').forEach(el => el.addEventListener('click', () => {
      this._readModalBlocks();
      const b = this._mBlocks[Number(el.dataset.b)];
      if (!b) return;
      const d = el.dataset.day;
      const at = (b.days || []).indexOf(d);
      if (at >= 0) b.days.splice(at, 1); else b.days.push(d);
      b.days.sort((x, y) => this.DAYS.indexOf(x) - this.DAYS.indexOf(y));
      this._renderShiftModal();
    }));
    /* Delete drops the block and everything in it. On save that block's shifts are simply not in the
       plan, so they go — which the net line has already counted as removals before the press. */
    document.querySelectorAll('#bs-m-body .bs-m-del').forEach(el => el.addEventListener('click', () => {
      this._readModalBlocks();
      this._mBlocks.splice(Number(el.dataset.b), 1);
      /* ⚠ NEVER LEAVE THE MODAL WITH NOTHING IN IT. Deleting the last block would render an empty
         card with no way to start again, so one blank block always survives — the same rule
         `openShiftModal` applies to a person with no shifts at all. */
      if (!this._mBlocks.length) {
        this._mBlocks.push({ start: '', end: '', position_id: (this.staffById(staffId) || {}).position_id || '', days: [], events: {} });
      }
      this._renderShiftModal();
    }));
    document.getElementById('bs-m-add')?.addEventListener('click', () => {
      this._readModalBlocks();
      this._mBlocks.push({ start: '', end: '', position_id: (this.staffById(staffId) || {}).position_id || '', days: [], events: {} });
      this._renderShiftModal();
    });
    document.getElementById('bs-m-save')?.addEventListener('click', () => {
      this._readModalBlocks();
      const plan = this._planShifts(staffId, this._mBlocks);
      if (plan.errors.length) {
        if (errEl) { errEl.textContent = plan.errors[0]; errEl.style.display = 'inline'; }
        return;
      }
      this._applyPlan(staffId, plan.shifts);
      this.saveDraft();
      App.closeModal('bs-shift-modal');
      this.draw();
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
      + '<span id="bs-lt-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'bs-lt-modal', maxWidth: 460, confirmDirty: true });
    document.getElementById('bs-lt-settings')?.addEventListener('click', () => { App.closeModal('bs-lt-modal'); if (window.S && S.HubSettings) S.HubSettings.open('recovery-targets'); });
    document.getElementById('bs-lt-save')?.addEventListener('click', async () => {
      const v = parseFloat(document.getElementById('bs-lt-val')?.value);
      const err = document.getElementById('bs-lt-err');
      // ⚠ THE UPPER BOUND MUST MATCH App Settings' Profit Targets, which writes this SAME
      // settings.targets.labor_cost_pct. Before SET-5 this door refused 0 and negatives while
      // Settings accepted them, and NEITHER door had a ceiling — so 250% saved from both.
      // verify-settings-numbers-refused.js X3 pins the two doors against each other on every
      // value rather than pinning either one's number ([[the-loop]] #54).
      if (isNaN(v) || v <= 0 || v > 100) { if (err) { err.textContent = 'Labor Cost % must be between 1 and 100.'; err.style.display = 'inline'; } return; }
      if (!App.data.settings) App.data.settings = {};
      if (!App.data.settings.targets) App.data.settings.targets = {};
      App.data.settings.targets.labor_cost_pct = Math.round(v * 10) / 10;
      await App.saveKey('settings');
      App.closeModal('bs-lt-modal');
      this.draw();
    });
  },

  // ── Forecast modal (writes revenue_forecasts) ────────────────────────────────
  // Bar Cop projects every week automatically (App.effectiveForecast: the 8-week
  // baseline plus any events booked that week). This is the one door to override
  // that number for a week, so it shows the forecast in effect, pre-filled, with
  // a one-click revert back to the automatic projection.
  openForecastModal() {
    if (!this.draft.week_start) return;
    const ws = this.draft.week_start;
    const rec = this.forecastForWeek(ws);
    const auto = (App.forecastDefaultsFor ? (App.forecastDefaultsFor(ws).total || 0) : 0)
               + (App.bookedEventRevenueForWeek ? (App.bookedEventRevenueForWeek(ws) || 0) : 0);
    const isOverride = !!(rec && rec.total != null);
    const shown = isOverride ? rec.total : (auto > 0 ? Math.round(auto) : '');
    const note = isOverride
      ? 'You set this number. Bar Cop calculates ' + App.fmtCurrency(auto) + ' from your recent weeks and booked events.'
      : (auto > 0
          ? 'Bar Cop calculates this from your recent weeks and booked events. Change it only for something it cannot see, like a holiday.'
          : 'No sales history yet. Enter your expected revenue for a labor budget; Bar Cop calculates it once you have a few weeks logged.');
    const html = '<div class="card form-card" style="margin:0;"><div class="card-title">Revenue Forecast</div>'
      + '<div class="form-row" style="gap:12px;"><div class="f" style="width:200px;"><label>Forecast for this week</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="bs-fc-val" min="0" step="100" value="' + (shown === '' ? '' : esc(String(shown))) + '" placeholder="0"/></div></div></div>'
      + '<div style="font-size:11px;color:' + (isOverride ? 'var(--amber)' : 'var(--t3)') + ';line-height:1.5;margin-top:8px;">' + note + '</div>'
      + '<div class="card-actions">'
      + '<button class="btn btn-primary" id="bs-fc-save">Save Forecast</button>'
      + (isOverride ? '<button class="btn btn-ghost" id="bs-fc-auto">Use Bar Cop\'s Number</button>' : '')
      + '<span id="bs-fc-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div></div>';
    App.openModal(html, { id: 'bs-fc-modal', maxWidth: 460, confirmDirty: true });
    document.getElementById('bs-fc-save')?.addEventListener('click', () => this.saveForecast());
    document.getElementById('bs-fc-auto')?.addEventListener('click', () => this.clearForecast());
  },

  async saveForecast() {
    const errEl = document.getElementById('bs-fc-err');
    const fail = m => { if (errEl) { errEl.textContent = m; errEl.style.display = 'inline'; } };
    const val = parseFloat(document.getElementById('bs-fc-val')?.value);
    if (isNaN(val) || val < 0) { fail('Enter the expected revenue for the week.'); return; }
    if (!Array.isArray(App.data.revenue_forecasts)) App.data.revenue_forecasts = [];
    const list = App.data.revenue_forecasts;
    const ws = this.draft.week_start;
    const tv = Math.round(val * 100) / 100;
    // Row-per-record: putRecord updates the in-memory array (match on id) AND writes the single
    // row. An edit merges onto the existing record so created_at/id survive.
    const existing = list.find(f => f.week_start === ws);
    const rec = existing
      ? Object.assign({}, existing, { total: tv, per_day: {}, method: 'total', updated_at: new Date().toISOString() })
      : { id: App.uid(), week_start: ws, total: tv, per_day: {}, method: 'total', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const ok = await App.putRecord('core', 'revenue_forecast', rec);
    if (!ok) { fail('Could not save the forecast. Try again.'); return; }
    App.closeModal('bs-fc-modal');
    this.draw();
  },

  // Drop this week's manual override so the week goes back to Bar Cop's automatic
  // projection (baseline + booked events).
  async clearForecast() {
    const ws = this.draft.week_start;
    // Remove EVERY record for this week, not just the first. The old blob code was
    // `filter(f => f.week_start !== ws)` — it dropped them all, and a whole-array save made
    // duplicates impossible anyway. Row-per-record removes that collapse: two devices saving a
    // forecast for the same untouched week each mint their own uid, so both rows now survive.
    // Deleting one would leave the other behind and "Use Bar Cop's Number" would close the
    // modal, redraw, and still show a manual override — reading as a broken button.
    const recs = (App.data.revenue_forecasts || []).filter(f => f && f.week_start === ws);
    for (const r of recs) { if (r.id != null) await App.removeRecord('core', 'revenue_forecast', r.id); }
    App.closeModal('bs-fc-modal');
    this.draw();
  },

  // ── How This Works ──────────────────────────────────────────────────────────
  showHowTo() {
    App.showHelpModal('How Build Schedule Works', [
      { p: ['Build Schedule is a weekly grid: your staff down the left, the seven days across the top. You fill it in by clicking, and Bar Cop costs it out live as you go.'] },
      { h: 'Picking the Week', p: ['Build Schedule opens on the current week. Use the week chips and the arrows above the grid to move between weeks, or This Week to snap back. A week you have already posted opens ready to edit; an empty week is ready to build. Worksheet prints a blank staff-by-day grid to pencil in before you enter it here.'] },
      { h: 'Adding and Editing Shifts', p: ['Click any day cell to open that person\'s week. Set a start and end time, then tap a day chip for every day they work that shift and save once. Three days on the same shift is one trip, not three.', 'For a second shift time, or a double on the same day, use Add Another Shift Time and fill in the next block. Opening a shift shows every shift time that person already has with their days already ticked, so moving a start time by an hour moves all of them together.', 'Unticking a day removes that day\'s shift. The line above the button says what is about to be added and what is about to be removed, so you see it before you press. If you double-book someone on the same day, the block turns red so you can fix it.'] },
      { h: 'Days Off', p: ['A cell reads Off when that person requested the day off (logged on Time Off and approved) or has it as a regular day off (set on their Staff Roster profile). Drop a shift on an Off day and the block turns red; you also get a warning before the schedule posts, so you never accidentally schedule someone you already gave the day off. You can still override and post it.', 'In the shift pop-up the day chips for those days are greyed out, so you cannot put someone on one by accident while filling in the rest of the week. To do it on purpose, click that Off cell in the grid and the day comes up ready to save.'] },
      { h: 'The Labor Budget', p: ['Bar Cop projects the week\'s revenue automatically from your recent weeks and any events booked, and turns it into a labor budget (your target percent of the forecast). It shows the Target Hours that forecast can support at your RPLH target, and live what you have scheduled and how much budget is left, green when you are under and red when you are over. Tap Edit on the forecast to set your own number for a week the projection cannot see, like a holiday, then Use Bar Cop\'s Number to hand it back. No sales history yet? Type a number to get a budget; Bar Cop takes over once you have a few weeks logged.'] },
      { h: 'Scheduling Warnings', p: ['As you build, one warnings box under the grid gathers anything to look at before you post: anyone in or near overtime (hours over 40 pay at time and a half), anyone double-booked with overlapping shifts, and anyone scheduled on a requested or regular day off. Each is its own labelled note. Fix an issue and it drops out of the box; when there is nothing to flag, the box does not show at all. You can always post as is and override a warning on purpose. Salaried staff never show in overtime, since they are exempt.'] },
      { h: 'Templates', p: ['To start from a typical week, Load one of your Saved Templates listed at the bottom of this page. To save the current grid as a reusable template, put a name in the Template Name box before you save, and it saves with the schedule. Loaded a template? Its name is already there: keep it to update that template, or change it to save a new one.'] },
      { h: 'New Schedule', p: ['New Schedule clears the grid so you can build a fresh week. Your saved schedules and templates are not touched. On an empty week that follows a posted one, a Start from last week button drops your most recent posted schedule onto the grid so you pencil in the changes instead of rebuilding a typical week shift by shift.'] },
      { h: 'Working an Event', p: ['When a booked event falls on a day, that day gets an EVENT tag in the header. Open anyone working it and check the "Working [event name]" box under that shift\'s day chips (a picker when more than one event lands that day) so only that person\'s logged hours flow to the booking\'s Event P&L. The box names the day it belongs to, so a shift covering several days only tags the one the event is on. Leave it unchecked for staff covering the regular floor that night.'] },
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
    if (!list.length) {
      return '<div style="font-size:13px;color:var(--t3);padding:4px 2px;margin-top:24px;">Name a schedule in the Save box above to save it as a reusable template. Your saved templates show up here to load any time.</div>';
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
    return '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
      + '<th>Saved Templates</th><th>Shifts</th><th>Hours</th><th>Est. Cost / wk</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
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
    await App.removeRecord('lc', 'schedule_template', id);   // row-per-record
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
    const otRows = [];
    const shifts = validShifts.map(sh => {
      const c = this.shiftCalc(sh);
      totalHours += c.hours; totalCost += c.cost;
      otRows.push({ staff_id: sh.staff_id, date: d.week_start, hours: c.hours, cost: c.cost });
      return {
        staff_id: sh.staff_id, name: c.staff ? c.staff.name : '',
        /* The role the shift was WORKED in, which shiftCalc already resolved (and priced).
           Stamping the person's primary here made a saved schedule disagree with the shift it
           came from: the cost was the secondary rate, the position said otherwise, and anything
           reading a posted schedule by position bucketed her into the wrong department. */
        position_id: c.position_id || (c.staff ? c.staff.position_id : ''),
        day: sh.day, start: sh.start, end: sh.end,
        hours: c.hours, wage: c.wage, cost: c.cost,
        event: sh.event || ''
      };
    });
    // The same overtime premium computeTotals puts on the card. Without it the saved
    // total_cost / labor_pct came out UNDER what the operator just read on screen, and
    // the over-budget guard below compared a premium-free number against the budget,
    // so it never fired on exactly the weeks overtime pushed the schedule over.
    totalCost += App.otPremiumForRows ? App.otPremiumForRows(otRows).total : 0;
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
    // Build `saved` as a FRESH object and let putRecord own the in-memory array. putRecord's
    // slot-revert can only undo a refused write if we hand it a DIFFERENT object than the one
    // already in the list (app.js:6216). Pre-inserting `saved` here made prev===rec, so a
    // refused schedule save was never reverted and a phantom "Posted" week stayed in memory
    // (Schedule History, the dashboard, and the retry's Replace prompt all read it) until reload.
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(x => x.id === this.editId);
      if (i > -1) saved = { ...list[i], ...rec };
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
        saved = rec;
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
        // Row-per-record: build a FRESH template object (an edit spreads the existing row) and let
        // putRecord own the in-memory replace/push. Mutating `ex` in place and handing it back made
        // prev===rec, so a refused template write was never reverted (app.js:6216) — the operator was
        // navigated to History with the refused shifts still in memory while the server kept the old.
        const tmpl = ex
          ? { ...ex, name: tmplName, shifts: tshifts, updated_at: new Date().toISOString() }
          : { id: App.uid(), name: tmplName, shifts: tshifts, created_at: new Date().toISOString() };
        await App.putRecord('lc', 'schedule_template', tmpl);
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
