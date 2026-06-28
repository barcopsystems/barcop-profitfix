'use strict';

/* ── Labor Control — Pay Periods (writes lc_pay_periods) ──────────────────────
   Phase 5: weekly pay-period close-out + bulk payroll export.

   Listing screen shows the last 12 weeks (Mon-Sun periods). Each row has:
     - week dates + status (Open / Closed)
     - total hours, total cost, OT hours, OT cost
     - actions: View Detail, Export Payroll CSV, Close & Lock (Open) or Reopen (Closed)

   Closing a period stamps `locked: true` on every lc_actuals record in the
   range so Log Hours won't let the operator edit it accidentally. A closed
   period saves to lc_pay_periods with the per-staff breakdown — a permanent
   record of what was paid out.

   Payroll CSV is Excel-friendly (UTF-8 BOM, CRLF). One row per staff member:
   name, position, regular hours, OT hours, regular wage, OT wage, gross. */

S.LaborPayPeriods = {
  detailWeekStart: null,

  actuals()  { return ((App.laborData && App.laborData.lc_actuals)     || []); },
  periods()  {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_pay_periods)) App.laborData.lc_pay_periods = [];
    return App.laborData.lc_pay_periods;
  },
  staff()    { return ((App.laborData && App.laborData.lc_staff)       || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
  positions(){ return ((App.laborData && App.laborData.lc_positions)   || []); },
  positionById(id) { return this.positions().find(p => p.id === id); },

  mondayOf(d) {
    const date = new Date(d + 'T00:00:00');
    if (isNaN(date.getTime())) return d;
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return App.ymdLocal(date);
  },
  addDays(d, n) {
    const date = new Date(d + 'T00:00:00');
    date.setDate(date.getDate() + n);
    return App.ymdLocal(date);
  },
  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(str + 'T00:00:00');
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  fmtDateShort(str) {
    if (!str) return '-';
    const d = new Date(str + 'T00:00:00');
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  // ── Aggregate one week's labor for the list view ──────────────────────
  aggregateWeek(weekStart) {
    const weekEnd = this.addDays(weekStart, 6);
    const range = this.actuals().filter(a => (a.date || '') >= weekStart && (a.date || '') <= weekEnd);
    const byStaff = {};
    range.forEach(a => {
      const key = a.staff_id || a.name || '?';
      if (!byStaff[key]) {
        // Resolve the wage in effect on the week's start date — wage_history
        // is the canonical source per Phase 5. Falling back to a.wage if no
        // wage_history is on file. Avoids the "last record wins" drift the
        // previous logic had when a wage change landed mid-week.
        const wageAtStart = (a.staff_id && App.wageForStaffOn)
          ? App.wageForStaffOn(a.staff_id, weekStart)
          : (a.wage || 0);
        byStaff[key] = {
          staff_id: a.staff_id || '',
          name: a.name || '(unknown)',
          position_id: a.position_id || '',
          hours: 0, cost: 0, wage: wageAtStart || a.wage || 0,
          salaried: App.isSalaried(a.staff_id)
        };
      }
      byStaff[key].hours += a.hours || 0;
      byStaff[key].cost  += a.cost  || 0;
    });
    // Salaried (exempt) staff are paid a fixed weekly salary with no overtime,
    // and they belong on payroll even if no hours were logged this period.
    ((App.laborData && App.laborData.lc_staff) || []).forEach(st => {
      if (!App.isSalaried(st) || st.status === 'Inactive' || !App.staffWeeklySalary(st)) return;
      if (!byStaff[st.id]) {
        byStaff[st.id] = {
          staff_id: st.id, name: st.name || '(unknown)',
          position_id: st.position_id || '', hours: 0, cost: 0, wage: 0, salaried: true
        };
      } else {
        byStaff[st.id].salaried = true;
      }
    });
    const rows = Object.values(byStaff).map(r => {
      if (r.salaried) {
        // Exempt: fixed weekly salary, no overtime. Logged hours stay as
        // coverage but do not drive pay.
        const salary = App.staffWeeklySalary(r.staff_id);
        return { ...r, cost: salary, regular_hours: r.hours, ot_hours: 0, wage: 0, regular_cost: salary, ot_cost: 0, gross: salary };
      }
      const regularHours = Math.min(r.hours, App.OT_THRESHOLD);
      const otHours      = Math.max(0, r.hours - App.OT_THRESHOLD);
      const wage         = r.wage || 0;
      const regularCost  = regularHours * wage;
      const otCost       = otHours * wage * 1.5;
      return { ...r, regular_hours: regularHours, ot_hours: otHours, regular_cost: regularCost, ot_cost: otCost, gross: regularCost + otCost };
    });
    const totals = rows.reduce((t, r) => {
      t.hours         += r.hours;
      t.regular_hours += r.regular_hours;
      t.ot_hours      += r.ot_hours;
      t.cost          += r.cost;
      t.regular_cost  += r.regular_cost;
      t.ot_cost       += r.ot_cost;
      t.gross         += r.gross;
      return t;
    }, { hours: 0, regular_hours: 0, ot_hours: 0, cost: 0, regular_cost: 0, ot_cost: 0, gross: 0 });
    return { weekStart, weekEnd, rows, totals, lockedCount: range.filter(a => a.locked).length, totalCount: range.length };
  },

  // ── Entry ───────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    this.actions = actions;
    // Entering the screen from the sidebar always lands on the list, not a stale
    // detail view. The detail is reached via View within the screen.
    this.detailWeekStart = null;
    if (this.actuals().length === 0) {
      this.actions.innerHTML = '';
      App.setupCard(this.container, {
        title: 'Pay Periods',
        lead: 'Pay Periods rolls each week into a payroll-ready summary you can close, lock, and hand off, with overtime and a tip-credit check.',
        steps: [
          { title: 'Log some hours', desc: 'Hours you log in Log Hours build each week here. Log some to get started.', btn: 'Go to Log Hours', screen: 'lc-log-hours', done: false }
        ]
      });
      return;
    }
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Pay Periods Work', [
      { p: ['Pay Periods rolls each week, Monday through Sunday, into a payroll-ready summary: total hours, overtime, and gross pay for everyone who worked. The last 12 weeks are listed, newest first.'] },
      { h: 'Closing A Period', p: ['When a week is final, Close and Lock it. That locks every logged-hours entry in the week so Log Hours stops accepting edits, and saves a permanent record of what was paid. Reopen it any time you need to fix something, then close it again.'] },
      { h: 'Overtime', p: ['Hours over ' + App.OT_THRESHOLD + ' in a week are treated as overtime and paid at time and a half in the gross figure. Salaried staff are exempt, so they carry a fixed weekly salary and never show overtime.'] },
      { h: 'Tip Credit Check', p: ['For tipped positions, the View screen compares each person\'s effective hourly, their wages plus tip-pool share divided by hours, against your state minimum wage and flags anyone who came up short so you can make up the difference before payroll runs. Set your state minimum in Wage Policy. This is a planning aid, not legal or payroll advice. Verify the wage and tip-credit rules for your jurisdiction.'] },
      { h: 'Payroll Export', p: ['Payroll Export turns any period into a formatted workbook or a clean import file for whoever runs your payroll. Open Payroll Export from the sidebar and pick the period there; it carries the same numbers you closed here.'] }
    ]);
  },

  renderList() {
    this.detailWeekStart = null;
    this.actions.innerHTML = '';

    // The trailing 12 weeks drive the "Open" list + the headline stats. Closed
    // periods are pulled from ALL saved closed records (any age), so an old
    // quarter-end period stays reachable to view + re-export, not just the last 12.
    const today = App.todayLocal();
    const thisMon = this.mondayOf(today);
    const trailing = [];
    for (let i = 0; i < 12; i++) trailing.push(this.addDays(thisMon, -7 * i));

    const closedWeeks = this.periods()
      .filter(p => p.status === 'Closed' && p.week_start)
      .sort((a, b) => (b.week_start || '').localeCompare(a.week_start || ''))
      .map(p => ({ ws: p.week_start, saved: p }));
    const closedSet = new Set(closedWeeks.map(c => c.ws));
    const openWeeks = trailing.filter(ws => !closedSet.has(ws)).map(ws => ({ ws }));

    const totals = trailing.reduce((t, ws) => {
      const a = this.aggregateWeek(ws).totals;
      t.hours += a.hours; t.gross += a.gross; t.ot_hours += a.ot_hours;
      return t;
    }, { hours: 0, gross: 0, ot_hours: 0 });

    const topCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Last 12 Weeks Hours</div><div class="calc-val lg">' + totals.hours.toFixed(1) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Last 12 Weeks OT Hours</div><div class="calc-val lg ' + (totals.ot_hours > 0 ? 'warn' : '') + '">' + totals.ot_hours.toFixed(1) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Last 12 Weeks Gross</div><div class="calc-val lg">' + App.fmtCurrency(totals.gross) + '</div></div>'
      + '</div></div>';

    // Open periods: View + Close & Lock. No Payroll Export button (reach it from
    // the View screen or the Payroll Export screen), no Status column (the card
    // heading carries the state).
    const openRow = ({ ws }) => {
      const agg = this.aggregateWeek(ws);
      const actions = '<button class="btn btn-ghost btn-sm pp-view" data-ws="' + ws + '">View</button>'
        + (agg.totalCount > 0 ? '<button class="btn btn-primary btn-sm pp-close" data-ws="' + ws + '">Close &amp; Lock</button>' : '');
      return '<tr>'
        + '<td><div class="val">' + esc(this.fmtDateShort(ws)) + ' &ndash; ' + esc(this.fmtDateShort(agg.weekEnd)) + '</div></td>'
        + '<td>' + agg.totals.hours.toFixed(1) + '</td>'
        + '<td class="' + (agg.totals.ot_hours > 0 ? 'neg' : '') + '">' + (agg.totals.ot_hours > 0 ? agg.totals.ot_hours.toFixed(1) : '-') + '</td>'
        + '<td class="val">' + App.fmtCurrency(agg.totals.gross) + '</td>'
        + '<td>' + agg.totalCount + ' entr' + (agg.totalCount === 1 ? 'y' : 'ies') + '</td>'
        + '<td><div class="row-actions">' + actions + '</div></td>'
        + '</tr>';
    };
    let openCard = '<div class="sh" style="margin:24px 0 10px;">Open Periods</div>';
    if (openWeeks.length === 0) {
      openCard += '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Week</th><th>Hours</th><th>OT Hours</th><th>Gross</th><th>Entries</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="6" style="color:var(--t3);">No open periods. Every week in range is closed and locked.</td></tr></tbody></table></div>';
    } else {
      openCard += '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Week</th><th>Hours</th><th>OT Hours</th><th>Gross</th><th>Entries</th><th></th>'
        + '</tr></thead><tbody>' + openWeeks.map(openRow).join('') + '</tbody></table></div>';
    }

    // Closed periods drop to their own card below with the Reopen button, the way
    // Back In Stock items split off the 86 List.
    let closedCard = '';
    if (closedWeeks.length > 0) {
      const closedRow = ({ ws, saved }) => {
        const agg = this.aggregateWeek(ws);
        let closedOn = '-';
        if (saved.closed_at) {
          const d = new Date(saved.closed_at);
          if (!isNaN(d.getTime())) closedOn = this.fmtDateShort(App.ymdLocal(d));
        }
        const actions = '<button class="btn btn-ghost btn-sm pp-view" data-ws="' + ws + '">View</button>'
          + '<button class="btn btn-ghost btn-sm pp-reopen" data-ws="' + ws + '">Reopen</button>';
        return '<tr>'
          + '<td><div class="val">' + esc(this.fmtDateShort(ws)) + ' &ndash; ' + esc(this.fmtDateShort(agg.weekEnd)) + '</div></td>'
          + '<td>' + agg.totals.hours.toFixed(1) + '</td>'
          + '<td class="' + (agg.totals.ot_hours > 0 ? 'neg' : '') + '">' + (agg.totals.ot_hours > 0 ? agg.totals.ot_hours.toFixed(1) : '-') + '</td>'
          + '<td class="val">' + App.fmtCurrency(agg.totals.gross) + '</td>'
          + '<td>' + closedOn + '</td>'
          + '<td><div class="row-actions">' + actions + '</div></td>'
          + '</tr>';
      };
      closedCard = '<div class="sh" style="margin:24px 0 10px;">Closed Periods</div>'
        + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
        + '<th>Week</th><th>Hours</th><th>OT Hours</th><th>Gross</th><th>Closed</th><th></th>'
        + '</tr></thead><tbody>' + closedWeeks.slice(0, App.listLimit('lc', 'pay_period')).map(closedRow).join('') + '</tbody></table></div>'
        + App.showOlderBar('lc', 'pay_period', closedWeeks, false);
    }

    this.container.innerHTML = '<div class="screen">' + topCard + openCard + closedCard + '</div>';

    this.container.querySelectorAll('.pp-view').forEach(b => b.addEventListener('click', () => { const ws = b.dataset.ws; this.detailWeekStart = ws; App.pushView(() => this.renderDetail(ws)); }));
    this.container.querySelectorAll('.pp-close').forEach(b => b.addEventListener('click', () => this.closePeriod(b.dataset.ws)));
    this.container.querySelectorAll('.pp-reopen').forEach(b => b.addEventListener('click', () => this.reopenPeriod(b.dataset.ws)));
    this.container.querySelectorAll('[data-show-older]').forEach(b => b.addEventListener('click', () => App.handleShowOlder(b, () => this.renderList())));
  },

  // ── Detail view ─────────────────────────────────────────────────────
  renderDetail(weekStart) {
    this.actions.innerHTML = '';
    const agg = this.aggregateWeek(weekStart);
    const saved = this.periods().find(p => p.week_start === weekStart);
    const isClosed = !!saved && saved.status === 'Closed';

    const stateMin = parseFloat((App.laborData?.settings || {}).state_min_wage);
    const stateMinValid = !isNaN(stateMin) && stateMin > 0;
    let belowMinCount = 0;
    const rows = agg.rows.sort((a, b) => b.gross - a.gross).map(r => {
      const pos = this.positionById(r.position_id);
      const isTipped = !!(pos && pos.tipped);
      const tipShare = isTipped ? this.tipShareForStaffInWeek(r.staff_id, agg.weekStart, agg.weekEnd) : 0;
      const effectiveHourly = r.hours > 0 ? (r.gross + tipShare) / r.hours : 0;
      const below = isTipped && stateMinValid && r.hours > 0 && effectiveHourly < stateMin;
      if (below) belowMinCount++;
      const tipCell = isTipped
        ? (stateMinValid
            ? (below
                ? '<span style="color:var(--red);font-weight:700;" title="Effective $' + effectiveHourly.toFixed(2) + '/hr, state min $' + stateMin.toFixed(2) + '">Below Min &middot; $' + (stateMin - effectiveHourly).toFixed(2) + '/hr owed</span>'
                : '<span style="color:var(--green);font-weight:700;">OK &middot; $' + effectiveHourly.toFixed(2) + '/hr</span>')
            : '<span style="color:var(--t3);font-weight:700;">Set State Min Wage</span>')
        : '<span style="color:var(--t4);font-size:11px;">Non-Tipped</span>';
      return '<tr>'
        + '<td><div class="val">' + esc(r.name) + '</div>'
        + (pos ? '<div style="font-size:10px;color:var(--t3);">' + esc(pos.name) + '</div>' : '') + '</td>'
        + '<td>' + r.regular_hours.toFixed(1) + '</td>'
        + '<td class="' + (r.ot_hours > 0 ? 'neg' : '') + '">' + (r.ot_hours > 0 ? r.ot_hours.toFixed(1) : '-') + '</td>'
        + '<td>' + App.fmtCurrency(r.wage) + '/hr</td>'
        + '<td>' + App.fmtCurrency(r.regular_cost) + '</td>'
        + '<td>' + (r.ot_cost > 0 ? App.fmtCurrency(r.ot_cost) : '-') + '</td>'
        + '<td class="val">' + App.fmtCurrency(r.gross) + '</td>'
        + '<td>' + tipCell + '</td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="8" style="color:var(--t3);text-align:center;padding:14px;">No hours logged this period.</td></tr>';

    // Close & Lock (open) or Reopen (closed) lives in the card title, top-right.
    const titleAction = isClosed
      ? '<button class="btn btn-ghost" id="pp-reopen-detail" data-ws="' + weekStart + '">Reopen Period</button>'
      : (agg.totalCount > 0 ? '<button class="btn btn-primary" id="pp-close-detail" data-ws="' + weekStart + '">Close &amp; Lock Period</button>' : '');

    const periodCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Total Hours</div><div class="calc-val lg">' + agg.totals.hours.toFixed(1) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">OT Hours</div><div class="calc-val lg ' + (agg.totals.ot_hours > 0 ? 'warn' : '') + '">' + agg.totals.ot_hours.toFixed(1) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Regular Cost</div><div class="calc-val lg">' + App.fmtCurrency(agg.totals.regular_cost) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">OT Pay</div><div class="calc-val lg ' + (agg.totals.ot_cost > 0 ? 'warn' : '') + '">' + App.fmtCurrency(agg.totals.ot_cost) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Gross</div><div class="calc-val lg">' + App.fmtCurrency(agg.totals.gross) + '</div></div>'
      + '</div></div>';

    const warnLine = belowMinCount > 0
      ? '<div style="font-size:11px;color:var(--red);font-weight:700;margin:14px 0 0;">' + belowMinCount + ' tipped employee' + (belowMinCount === 1 ? '' : 's') + ' fell below state minimum wage this week. Make up the difference before payroll runs.</div>'
      : '';

    const breakdownHeading = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Pay Period &middot; ' + this.fmtDate(weekStart) + ' &ndash; ' + this.fmtDate(agg.weekEnd) + '</div>'
      + '<div class="no-print" style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" id="pp-export-pdf">Export PDF</button></div></div>';

    const tableCard = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Staff</th><th>Reg Hours</th><th>OT Hours</th><th>Wage</th><th>Reg Cost</th><th>OT Pay</th><th>Gross</th><th>Tip Credit</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>';

    // Close & Lock (open) or Reopen (closed) lives bottom-left, under the breakdown.
    const actionRow = titleAction ? '<div class="no-print" style="margin:18px 0 24px;display:flex;gap:8px;">' + titleAction + '</div>' : '';

    this.container.innerHTML = '<div class="screen">' + periodCard + warnLine + breakdownHeading + tableCard + actionRow + '</div>';

    document.getElementById('pp-export-pdf')?.addEventListener('click', () => App.exportPDF({ title: 'Pay Period', root: this.container }));
    document.getElementById('pp-close-detail')?.addEventListener('click', () => this.closePeriod(weekStart));
    document.getElementById('pp-reopen-detail')?.addEventListener('click', () => this.reopenPeriod(weekStart));
  },

  // ── Close / Reopen ──────────────────────────────────────────────────
  async closePeriod(weekStart) {
    const agg = this.aggregateWeek(weekStart);
    const ok = await App.confirm({
      title: 'Close and lock this period?',
      message: 'This locks the ' + agg.totalCount + ' logged-hours entr' + (agg.totalCount === 1 ? 'y' : 'ies') + ' in this week so Log Hours stops accepting edits to them until you reopen the period.',
      confirmText: 'Close + Lock',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    const weekEnd = agg.weekEnd;
    const list = this.periods();
    const existing = list.find(p => p.week_start === weekStart);
    // Resolve the canonical period id first so each locked actual links to it.
    const periodId = (existing && existing.id) || App.uid();
    // Stamp locked + pay_period_id on each lc_actuals in range.
    const affected = this.actuals().filter(a => (a.date || '') >= weekStart && (a.date || '') <= weekEnd);
    affected.forEach(a => { a.locked = true; a.pay_period_id = periodId; });
    // Build the period record.
    const rec = {
      id:          periodId,
      week_start:  weekStart,
      week_end:    weekEnd,
      status:      'Closed',
      closed_at:   new Date().toISOString(),
      total_hours: agg.totals.hours,
      total_cost:  agg.totals.cost,
      ot_hours:    agg.totals.ot_hours,
      ot_cost:     agg.totals.ot_cost,
      gross:       agg.totals.gross,
      participants: agg.rows.map(r => ({
        staff_id: r.staff_id, name: r.name, position_id: r.position_id,
        regular_hours: r.regular_hours, ot_hours: r.ot_hours,
        wage: r.wage, regular_cost: r.regular_cost, ot_cost: r.ot_cost, gross: r.gross
      }))
    };
    if (existing) Object.assign(existing, rec);
    else list.push(rec);
    const savedPeriod = existing || rec;
    // Persist the period row, then every locked actual in one bulk write (one
    // round-trip instead of one per entry).
    await App.putRecord('lc', 'pay_period', savedPeriod);
    await App.putRecordsBulk('lc', 'actual', affected);
    this.detailWeekStart = weekStart;
    this.renderDetail(weekStart);
  },

  async reopenPeriod(weekStart) {
    const ok = await App.confirm({
      title: 'Reopen this pay period?',
      message: 'This unlocks the logged-hours entries in this period so Log Hours accepts edits again. The saved period summary stays as a record.',
      confirmText: 'Reopen',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    const agg = this.aggregateWeek(weekStart);
    const weekEnd = agg.weekEnd;
    const affected = this.actuals().filter(a => (a.date || '') >= weekStart && (a.date || '') <= weekEnd);
    affected.forEach(a => { a.locked = false; });
    const list = this.periods();
    const existing = list.find(p => p.week_start === weekStart);
    if (existing) {
      existing.status = 'Open';
      existing.reopened_at = new Date().toISOString();
    }
    // Persist the reopened period, then every unlocked actual in one bulk write.
    if (existing) await App.putRecord('lc', 'pay_period', existing);
    await App.putRecordsBulk('lc', 'actual', affected);
    if (this.detailWeekStart) this.renderDetail(weekStart);
    else this.renderList();
  },

  // Sum tip-pool shares for a staff member in a given week. Reads
  // lc_tip_pools where shift_id is set to a shift in the range; falls back
  // to date-keyed pools for off-shift entries. Used by the tip credit
  // compliance check.
  tipShareForStaffInWeek(staffId, weekStart, weekEnd) {
    const pools = ((App.laborData && App.laborData.lc_tip_pools) || []);
    const shifts = ((App.shiftData && App.shiftData.sc_shifts) || []);
    let total = 0;
    pools.forEach(p => {
      const inRange = (p.date && p.date >= weekStart && p.date <= weekEnd)
        || (p.shift_id && shifts.find(s => s.id === p.shift_id && s.date >= weekStart && s.date <= weekEnd));
      if (!inRange) return;
      (p.participants || []).forEach(part => {
        if (part.staff_id === staffId) total += parseFloat(part.share) || 0;
      });
    });
    if (total > 0) return total;
    // No pool share for this person this week — fall back to their own logged
    // tips so a house that logs tips without saving a pool split still gets a
    // real tip-credit number instead of a false $0 / "Below Min" flag. Uses NET
    // tips (after tip-out paid, plus tip-out received) so the figure is honest.
    const tips = ((App.laborData && App.laborData.lc_tips) || []);
    return tips.reduce((s, t) => (t.staff_id === staffId && t.date >= weekStart && t.date <= weekEnd)
      ? s + App.netTips(t) : s, 0);
  }
};
