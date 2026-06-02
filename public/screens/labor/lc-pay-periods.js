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
    return date.toISOString().slice(0, 10);
  },
  addDays(d, n) {
    const date = new Date(d + 'T00:00:00');
    date.setDate(date.getDate() + n);
    return date.toISOString().slice(0, 10);
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
          hours: 0, cost: 0, wage: wageAtStart || a.wage || 0
        };
      }
      byStaff[key].hours += a.hours || 0;
      byStaff[key].cost  += a.cost  || 0;
    });
    const rows = Object.values(byStaff).map(r => {
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
    if (this.detailWeekStart) this.renderDetail(this.detailWeekStart);
    else this.renderList();
  },

  renderList() {
    this.detailWeekStart = null;
    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="pp-export-pdf">Export PDF</button>';
    document.getElementById('pp-export-pdf')?.addEventListener('click', () => App.exportPDF({ title: 'Pay Periods', root: this.container }));

    // Build the last 12 weeks ending with the current week
    const today = new Date().toISOString().slice(0, 10);
    const thisMon = this.mondayOf(today);
    const weeks = [];
    for (let i = 0; i < 12; i++) {
      weeks.push(this.addDays(thisMon, -7 * i));
    }

    const rows = weeks.map(ws => {
      const agg = this.aggregateWeek(ws);
      const saved = this.periods().find(p => p.week_start === ws);
      const isClosed = !!saved && saved.status === 'Closed';
      const statusBadge = isClosed
        ? '<span style="font-weight:700;letter-spacing:1px;color:var(--gold);">CLOSED</span>'
        : '<span style="font-weight:700;letter-spacing:1px;color:var(--t3);">OPEN</span>';
      const actions = isClosed
        ? '<button class="btn btn-ghost btn-sm pp-view" data-ws="' + ws + '">View</button>'
          + '<button class="btn btn-ghost btn-sm pp-csv" data-ws="' + ws + '">Payroll CSV</button>'
          + '<button class="btn btn-ghost btn-sm pp-reopen" data-ws="' + ws + '">Reopen</button>'
        : '<button class="btn btn-ghost btn-sm pp-view" data-ws="' + ws + '">View</button>'
          + '<button class="btn btn-ghost btn-sm pp-csv" data-ws="' + ws + '">Payroll CSV</button>'
          + (agg.totalCount > 0 ? '<button class="btn btn-primary btn-sm pp-close" data-ws="' + ws + '">Close &amp; Lock</button>' : '');
      return '<tr>'
        + '<td><div class="val">' + esc(this.fmtDateShort(ws)) + ' &ndash; ' + esc(this.fmtDateShort(agg.weekEnd)) + '</div></td>'
        + '<td>' + statusBadge + '</td>'
        + '<td>' + agg.totals.hours.toFixed(1) + '</td>'
        + '<td class="' + (agg.totals.ot_hours > 0 ? 'neg' : '') + '">' + (agg.totals.ot_hours > 0 ? agg.totals.ot_hours.toFixed(1) : '-') + '</td>'
        + '<td class="val">' + App.fmtCurrency(agg.totals.gross) + '</td>'
        + '<td>' + agg.totalCount + ' entr' + (agg.totalCount === 1 ? 'y' : 'ies') + '</td>'
        + '<td><div class="row-actions">' + actions + '</div></td>'
        + '</tr>';
    }).join('');

    const totals = weeks.reduce((t, ws) => {
      const a = this.aggregateWeek(ws).totals;
      t.hours += a.hours; t.gross += a.gross; t.ot_hours += a.ot_hours;
      return t;
    }, { hours: 0, gross: 0, ot_hours: 0 });

    const summary = '<div class="calc" style="margin-bottom:16px;">'
      + '<div class="calc-item"><div class="calc-label">Last 12 Weeks Hours</div><div class="calc-val">' + totals.hours.toFixed(1) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Last 12 Weeks OT Hours</div><div class="calc-val ' + (totals.ot_hours > 0 ? 'warn' : '') + '">' + totals.ot_hours.toFixed(1) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Last 12 Weeks Gross</div><div class="calc-val good">' + App.fmtCurrency(totals.gross) + '</div></div>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;line-height:1.55;">'
        + 'Weekly pay periods, Monday through Sunday. Closing a period locks every lc_actuals record in the range so Log Hours stops accepting edits. Payroll CSV exports the period as a one-row-per-employee file ready for your payroll provider. OT premium (half-time) is included in gross for hours over '
        + App.OT_THRESHOLD + '/week.'
      + '</div>'
      + summary
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Week</th><th>Status</th><th>Hours</th><th>OT Hours</th><th>Gross</th><th>Entries</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '</div>';

    this.container.querySelectorAll('.pp-view').forEach(b => b.addEventListener('click', () => { this.detailWeekStart = b.dataset.ws; this.renderDetail(b.dataset.ws); }));
    this.container.querySelectorAll('.pp-csv').forEach(b => b.addEventListener('click', () => this.exportCSV(b.dataset.ws)));
    this.container.querySelectorAll('.pp-close').forEach(b => b.addEventListener('click', () => this.closePeriod(b.dataset.ws)));
    this.container.querySelectorAll('.pp-reopen').forEach(b => b.addEventListener('click', () => this.reopenPeriod(b.dataset.ws)));
  },

  // ── Detail view ─────────────────────────────────────────────────────
  renderDetail(weekStart) {
    this.actions.innerHTML = '<button class="btn btn-ghost btn-sm" id="pp-export-pdf">Export PDF</button>';
    document.getElementById('pp-export-pdf')?.addEventListener('click', () => App.exportPDF({ title: 'Pay Periods', root: this.container }));
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
                : '<span style="color:var(--gold);font-weight:700;">OK &middot; $' + effectiveHourly.toFixed(2) + '/hr</span>')
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

    const statusInfo = isClosed
      ? '<div style="font-size:11px;color:var(--gold);margin-bottom:10px;">Closed ' + (saved.closed_at ? this.fmtDate(saved.closed_at.slice(0, 10)) : '') + '. ' + agg.lockedCount + ' record' + (agg.lockedCount === 1 ? '' : 's') + ' locked.</div>'
      : '<div style="font-size:11px;color:var(--t3);margin-bottom:10px;">Open. ' + agg.totalCount + ' record' + (agg.totalCount === 1 ? '' : 's') + ' in this period.</div>';

    this.container.innerHTML = '<div class="screen">'
      + '<div style="margin-bottom:14px;"><button class="btn btn-ghost btn-sm" id="pp-back">&#8592; Back to Pay Periods</button></div>'
      + '<div class="card"><div class="card-title">Pay Period &middot; ' + this.fmtDate(weekStart) + ' &ndash; ' + this.fmtDate(agg.weekEnd) + '</div>'
      + statusInfo
      + '<div class="calc" style="margin-bottom:14px;">'
        + '<div class="calc-item"><div class="calc-label">Total Hours</div><div class="calc-val">' + agg.totals.hours.toFixed(1) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">OT Hours</div><div class="calc-val ' + (agg.totals.ot_hours > 0 ? 'warn' : '') + '">' + agg.totals.ot_hours.toFixed(1) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Regular Cost</div><div class="calc-val">' + App.fmtCurrency(agg.totals.cost) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">OT Pay</div><div class="calc-val ' + (agg.totals.ot_cost > 0 ? 'warn' : '') + '">' + App.fmtCurrency(agg.totals.ot_cost) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Gross</div><div class="calc-val good">' + App.fmtCurrency(agg.totals.gross) + '</div></div>'
      + '</div>'
      + (belowMinCount > 0
          ? '<div style="font-size:11px;color:var(--red);font-weight:700;margin-bottom:10px;">' + belowMinCount + ' tipped employee' + (belowMinCount === 1 ? '' : 's') + ' fell below state minimum wage this week. Make up the difference before payroll runs.</div>'
          : '')
      + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Staff</th><th>Reg Hours</th><th>OT Hours</th><th>Wage</th><th>Reg Cost</th><th>OT Pay</th><th>Gross</th><th>Tip Credit</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="pp-csv-detail" data-ws="' + weekStart + '">Export Payroll CSV</button>'
        + (isClosed
            ? '<button class="btn btn-ghost" id="pp-reopen-detail" data-ws="' + weekStart + '">Reopen Period</button>'
            : (agg.totalCount > 0 ? '<button class="btn btn-primary" id="pp-close-detail" data-ws="' + weekStart + '">Close &amp; Lock Period</button>' : ''))
      + '</div>'
      + '</div></div>';

    document.getElementById('pp-back')?.addEventListener('click', () => { this.detailWeekStart = null; this.renderList(); });
    document.getElementById('pp-csv-detail')?.addEventListener('click', () => this.exportCSV(weekStart));
    document.getElementById('pp-close-detail')?.addEventListener('click', () => this.closePeriod(weekStart));
    document.getElementById('pp-reopen-detail')?.addEventListener('click', () => this.reopenPeriod(weekStart));
  },

  // ── Close / Reopen ──────────────────────────────────────────────────
  async closePeriod(weekStart) {
    const agg = this.aggregateWeek(weekStart);
    const ok = await App.confirm({
      title: 'Close and lock this period?',
      message: 'This stamps ' + agg.totalCount + ' lc_actuals record' + (agg.totalCount === 1 ? '' : 's') + ' as locked. Log Hours will refuse edits to those entries until you Reopen the period.',
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
    // Persist the period row plus every locked actual as its own event row.
    await App.putRecord('lc', 'pay_period', savedPeriod);
    for (const a of affected) { await App.putRecord('lc', 'actual', a); }
    this.detailWeekStart = weekStart;
    this.renderDetail(weekStart);
  },

  async reopenPeriod(weekStart) {
    const ok = await App.confirm({
      title: 'Reopen this pay period?',
      message: 'The lock on this period\'s lc_actuals records will be removed. Log Hours will accept edits again. The saved period summary stays as a record.',
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
    // Persist the reopened period plus every unlocked actual.
    if (existing) await App.putRecord('lc', 'pay_period', existing);
    for (const a of affected) { await App.putRecord('lc', 'actual', a); }
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
    return total;
  },

  // ── Payroll CSV export ──────────────────────────────────────────────
  exportCSV(weekStart) {
    const agg = this.aggregateWeek(weekStart);
    if (!agg.rows.length) {
      App.confirm({ title: 'No hours to export', message: 'No lc_actuals entries fall within this pay period.', confirmText: 'OK', cancelText: 'Cancel' });
      return;
    }
    const barName = (App.data?.settings?.bar_name) || 'Bar Cop';
    const stateMin = parseFloat((App.laborData?.settings || {}).state_min_wage);
    const stateMinValid = !isNaN(stateMin) && stateMin > 0;
    const header = [
      'Staff Name', 'Position', 'Week Start', 'Week End',
      'Regular Hours', 'OT Hours', 'Total Hours',
      'Wage Rate', 'Regular Cost', 'OT Pay', 'Gross Pay',
      'Tipped Position', 'Tip Share', 'Effective Hourly', 'Tip Credit Status'
    ];
    const rows = agg.rows.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(r => {
      const pos = this.positionById(r.position_id);
      const isTipped = !!(pos && pos.tipped);
      const tipShare = isTipped ? this.tipShareForStaffInWeek(r.staff_id, agg.weekStart, agg.weekEnd) : 0;
      const effectiveHourly = r.hours > 0 ? (r.gross + tipShare) / r.hours : 0;
      let status = '';
      if (!isTipped) status = '';
      else if (!stateMinValid) status = 'No State Min Wage set';
      else if (effectiveHourly < stateMin) status = 'BELOW: $' + (stateMin - effectiveHourly).toFixed(2) + '/hr owed';
      else status = 'OK';
      return [
        r.name,
        pos ? pos.name : '',
        agg.weekStart,
        agg.weekEnd,
        r.regular_hours.toFixed(2),
        r.ot_hours.toFixed(2),
        r.hours.toFixed(2),
        r.wage.toFixed(2),
        r.regular_cost.toFixed(2),
        r.ot_cost.toFixed(2),
        r.gross.toFixed(2),
        isTipped ? 'Yes' : 'No',
        isTipped ? tipShare.toFixed(2) : '',
        isTipped && r.hours > 0 ? effectiveHourly.toFixed(2) : '',
        status
      ];
    });
    rows.push([
      'TOTAL', '', '', '',
      agg.totals.regular_hours.toFixed(2), agg.totals.ot_hours.toFixed(2), agg.totals.hours.toFixed(2),
      '', agg.totals.regular_cost.toFixed(2), agg.totals.ot_cost.toFixed(2), agg.totals.gross.toFixed(2),
      '', '', '', ''
    ]);
    const escapeCell = (v) => {
      const s = String(v == null ? '' : v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [header, ...rows].map(r => r.map(escapeCell).join(','));
    // UTF-8 BOM + CRLF for Excel-friendliness
    const csv = '﻿' + lines.join('\r\n') + '\r\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const filename = barName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-payroll-' + weekStart + '.csv';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }
};
