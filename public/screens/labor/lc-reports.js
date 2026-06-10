'use strict';

/* ── Labor Control — Labor Reports (reads lc_actuals) ─────────────────────────
   Labor analysis over a date range: By Department and By Staff, with tips
   context. Read-only. Both breakdowns are short aggregated tables, so they sit
   on one page (no tabs): a stats card, a Filter heading with one Export that
   covers both sections, the controls-only filter card, then the two data cards.
   Salaried staff carry their fixed weekly salary across the range. */

S.LaborReports = {
  filterFrom: '',
  filterTo: '',

  actuals() { return ((App.laborData && App.laborData.lc_actuals) || []); },
  tips()    { return ((App.laborData && App.laborData.lc_tips) || []); },
  positionById(id) { return ((App.laborData && App.laborData.lc_positions) || []).find(p => p.id === id); },

  inRange(rec) {
    if (this.filterFrom && (rec.date || '') < this.filterFrom) return false;
    if (this.filterTo && (rec.date || '') > this.filterTo) return false;
    return true;
  },

  // Quick date-range presets for the filter (local-calendar based, never UTC).
  presetRange(key) {
    const today = App.todayLocal();
    const d = new Date(today + 'T00:00:00');
    const ymd = x => App.ymdLocal(x);
    const monday = new Date(d); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    if (key === 'this-week') return { from: ymd(monday), to: today };
    if (key === 'last-week') { const s = new Date(monday); s.setDate(s.getDate() - 7); const e = new Date(monday); e.setDate(e.getDate() - 1); return { from: ymd(s), to: ymd(e) }; }
    if (key === 'this-month') return { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: today };
    if (key === 'last-4') { const s = new Date(d); s.setDate(s.getDate() - 27); return { from: ymd(s), to: today }; }
    return { from: '', to: '' };
  },
  applyPreset(key) {
    const r = this.presetRange(key);
    this.filterFrom = r.from; this.filterTo = r.to;
    this.renderReport();
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    this.renderReport();
  },

  showHowTo() {
    App.showHelpModal('How Labor Reports Work', [
      { p: ['Labor Reports total your labor over a date range, two ways on one page: by department and by staff. Set the range and both update together.'] },
      { h: 'The Two Views', p: ['By Department rolls labor up by department so you can see where the dollars go. By Staff lists each person\'s hours, average wage, labor cost, and share of total labor, sorted by cost. Salaried staff carry their fixed weekly salary across the range; their logged hours are coverage only.'] },
      { h: 'Export', p: ['Export PDF saves the whole report, both the department and staff breakdowns, in one file.'] }
    ]);
  },

  // ── shared markup helpers (mirror Cash History / Tip History) ───────────────
  statItem(label, val, cls) {
    return '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg ' + (cls || '') + '">' + val + '</div></div>';
  },
  statsCard(items) {
    return '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">' + items + '</div></div>';
  },
  sectionHeading(title) {
    return '<div class="sh" style="margin:24px 0 10px;">' + esc(title) + '</div>';
  },
  dataCard(headers, rowsHtml) {
    return '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + headers + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>';
  },
  noRow(cols, msg) {
    return '<tr><td colspan="' + cols + '" style="color:var(--t3);padding:12px 8px;">' + esc(msg || 'No hours match the filter.') + '</td></tr>';
  },

  renderReport() {
    this.actions.innerHTML = '';

    if (this.actuals().length === 0) {
      App.setupCard(this.container, {
        title: 'Labor Reports',
        lead: 'Labor Reports break your labor down by department and by staff over any date range, with tips context.',
        steps: [
          { title: 'Log some hours', desc: 'Hours you log in Log Hours feed this report. Log some to get started.', btn: 'Go to Log Hours', screen: 'lc-log-hours', done: false }
        ]
      });
      return;
    }

    const rows = this.actuals().filter(a => this.inRange(a));
    const tips = this.tips().filter(t => this.inRange(t));

    // Salaried (exempt) cost over the report span (explicit range, or the span
    // of the logged data when the filter is open-ended).
    const datesInRange = rows.map(a => a.date).filter(Boolean).sort();
    const rFrom = this.filterFrom || datesInRange[0] || '';
    const rTo   = this.filterTo   || datesInRange[datesInRange.length - 1] || '';
    const salWeeks = (rFrom && rTo)
      ? (Math.floor((new Date(rTo + 'T00:00:00').getTime() - new Date(rFrom + 'T00:00:00').getTime()) / 86400000) + 1) / 7
      : 0;
    const salRange = (rFrom && rTo) ? App.salariedCost(rFrom, rTo) : { total: 0, bar: 0, food: 0 };

    // Weekly overtime premium (0.5x on hours over 40/week per non-salaried
    // person) summed across the range, so Labor Cost here reconciles with the
    // gross on Pay Periods and Payroll Export instead of showing straight-time.
    const ot = this.otPremiums(rows);
    const totHours = rows.reduce((t, a) => t + (a.hours || 0), 0);
    const totCost = rows.reduce((t, a) => t + (a.cost || 0), 0) + salRange.total + ot.total;
    const totTips = tips.reduce((t, x) => t + (x.total_tips || 0), 0);
    // Actual revenue logged in the range (Shift module) drives labor % and revenue
    // per labor hour, the numbers an operator manages to. Shown only when there's
    // revenue to divide by, so a partial-data range never prints a false rate.
    const periodRev = ((App.shiftData && App.shiftData.sc_shifts) || []).reduce((s, sh) => {
      const d = sh.date || '';
      if ((rFrom && d < rFrom) || (rTo && d > rTo)) return s;
      return s + (parseFloat(sh.total_revenue) || 0);
    }, 0);
    const laborPctVal = periodRev > 0 ? (totCost / periodRev * 100) : null;
    const rplhVal = (periodRev > 0 && totHours > 0) ? (periodRev / totHours) : null;

    const statsCard = this.statsCard(
      this.statItem('Total Hours', totHours.toFixed(1))
      + this.statItem('Labor Cost', App.fmtCurrency(totCost))
      + this.statItem('Labor %', laborPctVal != null ? App.fmtPct(laborPctVal) : '-')
      + this.statItem('Rev / Labor Hr', rplhVal != null ? App.fmtCurrency(rplhVal) : '-')
      + this.statItem('Avg Wage', App.fmtCurrency(totHours > 0 ? totCost / totHours : 0))
      + this.statItem('Tips Logged', App.fmtCurrency(totTips)));

    const filterHeading = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">Filter Labor</div>'
      + '<div style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" id="lr-export">Export PDF</button></div></div>';

    const presetBtns = [['this-week', 'This Week'], ['last-week', 'Last Week'], ['this-month', 'This Month'], ['last-4', 'Last 4 Weeks']]
      .map(([k, l]) => '<button class="btn btn-ghost btn-sm lr-preset" data-preset="' + k + '">' + l + '</button>').join('');
    const filterCard = '<div class="card no-print"><div class="form-row" style="gap:14px;align-items:flex-end;margin-bottom:0;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>From</label><input type="date" id="lr-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>To</label><input type="date" id="lr-to" value="' + esc(this.filterTo) + '"/></div>'
      + '<div class="f" style="flex-shrink:0;"><label>&nbsp;</label><button class="btn btn-ghost" id="lr-clear">Clear</button></div>'
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px;">'
      + '<span style="font-size:11px;color:var(--t3);">Quick range:</span>' + presetBtns + '</div></div>';

    this.container.innerHTML = '<div class="screen">'
      + statsCard
      + filterHeading
      + filterCard
      + this.sectionHeading('By Department')
      + this.byDept(rows, totCost, salWeeks, ot.byDept)
      + this.sectionHeading('By Staff')
      + this.byStaff(rows, totCost, salWeeks, ot.byStaff)
      + '</div>';

    this.container.onclick = ev => {
      if (ev.target.closest('#lr-export')) { App.exportPDF({ title: 'Labor Reports', root: this.container }); return; }
      if (ev.target.closest('#lr-clear')) { this.filterFrom = this.filterTo = ''; this.renderReport(); return; }
      const preset = ev.target.closest('.lr-preset');
      if (preset) { this.applyPreset(preset.dataset.preset); return; }
      const sRow = ev.target.closest('.lr-staff-row');
      if (sRow) { App._staffFocus = { staff_id: sRow.dataset.staff }; App.navigate('lc-staff-roster'); return; }
    };
    const bind = (id, prop) => document.getElementById(id)?.addEventListener('change', e => {
      this[prop] = e.target.value || '';
      this.renderReport();
    });
    bind('lr-from', 'filterFrom');
    bind('lr-to', 'filterTo');
  },

  // Weekly OT premium per non-salaried staff (0.5x on hours over 40 in a
  // Mon-Sun week), bucketed across the range and attributed to staff + dept so
  // the Labor Cost columns match gross. Returns { total, byStaff, byDept }.
  otPremiums(rows) {
    const wk = {};  // staffKey|weekStart -> { sk, dept, hours, cost }
    rows.forEach(a => {
      if (App.isSalaried(a.staff_id)) return;
      const sk = a.staff_id || a.name || '?';
      const ws = App.weekStartFor ? App.weekStartFor(a.date) : (a.date || '');
      const key = sk + '|' + ws;
      if (!wk[key]) {
        const pos = this.positionById(a.position_id);
        wk[key] = { sk, dept: pos ? (pos.department || 'Other') : 'Unassigned', hours: 0, cost: 0 };
      }
      wk[key].hours += (a.hours || 0);
      wk[key].cost  += (a.cost || 0);
    });
    const out = { total: 0, byStaff: {}, byDept: {} };
    Object.values(wk).forEach(b => {
      const otH = Math.max(0, b.hours - App.OT_THRESHOLD);
      if (otH <= 0 || b.hours <= 0) return;
      const prem = otH * (b.cost / b.hours) * 0.5;   // 0.5x on the effective base rate that week
      out.total += prem;
      out.byStaff[b.sk] = (out.byStaff[b.sk] || 0) + prem;
      out.byDept[b.dept] = (out.byDept[b.dept] || 0) + prem;
    });
    return out;
  },

  byStaff(rows, totCost, salWeeks, otByStaff) {
    otByStaff = otByStaff || {};
    const g = {};
    rows.forEach(a => {
      const k = a.staff_id || a.name || '?';
      if (!g[k]) g[k] = { name: a.name || '-', hours: 0, straight: 0 };
      g[k].hours += (a.hours || 0);
      g[k].straight += (a.cost || 0);
    });
    if (salWeeks > 0) {
      ((App.laborData && App.laborData.lc_staff) || []).forEach(st => {
        const wk = App.staffWeeklySalary(st);
        if (!wk) return;
        if (!g[st.id]) g[st.id] = { name: st.name || '-', hours: 0, straight: 0 };
        g[st.id].straight += wk * salWeeks;
      });
    }
    // Labor Cost = straight-time + OT premium; Avg Wage stays the base rate.
    const cost = k => g[k].straight + (otByStaff[k] || 0);
    const isStaffId = k => ((App.laborData && App.laborData.lc_staff) || []).some(st => st.id === k);
    const trs = Object.keys(g).sort((a, b) => cost(b) - cost(a)).map(k => {
      const s = g[k];
      const clickable = isStaffId(k);
      return '<tr' + (clickable ? ' class="lr-staff-row" data-staff="' + esc(k) + '" style="cursor:pointer;"' : '') + '>'
        + '<td><div class="val">' + esc(s.name) + '</div></td>'
        + '<td>' + s.hours.toFixed(1) + '</td>'
        + '<td>' + App.fmtCurrency(s.hours > 0 ? s.straight / s.hours : 0) + '</td>'
        + '<td class="val">' + App.fmtCurrency(cost(k)) + '</td>'
        + '<td>' + (totCost > 0 ? App.fmtPct(cost(k) / totCost * 100) : '-') + '</td></tr>';
    }).join('') || this.noRow(5);
    return this.dataCard('<th>Staff</th><th>Hours</th><th>Avg Wage</th><th>Labor Cost</th><th>% of Labor</th>', trs);
  },

  byDept(rows, totCost, salWeeks, otByDept) {
    otByDept = otByDept || {};
    const g = {};
    rows.forEach(a => {
      const pos = this.positionById(a.position_id);
      const dept = pos ? (pos.department || 'Other') : 'Unassigned';
      if (!g[dept]) g[dept] = { hours: 0, cost: 0 };
      g[dept].hours += (a.hours || 0);
      g[dept].cost += (a.cost || 0);
    });
    if (salWeeks > 0) {
      ((App.laborData && App.laborData.lc_staff) || []).forEach(st => {
        const wk = App.staffWeeklySalary(st);
        if (!wk) return;
        const pos = this.positionById(st.position_id);
        const dept = pos ? (pos.department || 'Other') : 'Unassigned';
        if (!g[dept]) g[dept] = { hours: 0, cost: 0 };
        g[dept].cost += wk * salWeeks;
      });
    }
    Object.keys(otByDept).forEach(d => { if (!g[d]) g[d] = { hours: 0, cost: 0 }; g[d].cost += otByDept[d]; });
    const trs = Object.keys(g).sort((a, b) => g[b].cost - g[a].cost).map(k =>
      '<tr><td><div class="val">' + esc(k) + '</div></td>'
      + '<td>' + g[k].hours.toFixed(1) + '</td>'
      + '<td class="val">' + App.fmtCurrency(g[k].cost) + '</td>'
      + '<td>' + (totCost > 0 ? App.fmtPct(g[k].cost / totCost * 100) : '-') + '</td></tr>').join('') || this.noRow(4);
    return this.dataCard('<th>Department</th><th>Hours</th><th>Labor Cost</th><th>% of Labor</th>', trs);
  }
};
