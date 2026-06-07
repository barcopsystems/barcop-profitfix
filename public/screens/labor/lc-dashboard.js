'use strict';

/* ── Labor Control — Dashboard (landing screen) ───────────────────────────────
   Last-7-day labor cost and hours, overtime risk for the current week, roster
   size, plus alerts and recent activity. Same layout and card standard as the
   Shift dashboard: KPI tiles, a full-width banded hero, two equal-height rows of
   heading-outside panels, a data-card for the recent list, then Quick Actions,
   with a day-one Get Started state until hours are logged. */

S.LaborDashboard = {
  actuals()   { return ((App.laborData && App.laborData.lc_actuals) || []); },
  schedules() { return ((App.laborData && App.laborData.lc_schedules) || []); },
  staff()     { return ((App.laborData && App.laborData.lc_staff) || []); },
  positions() { return ((App.laborData && App.laborData.lc_positions) || []); },
  callouts()  { return ((App.laborData && App.laborData.lc_callouts) || []); },
  certs()     { return ((App.laborData && App.laborData.lc_certs) || []); },
  posDept(id) { const p = this.positions().find(x => x.id === id); return p ? (p.department || 'Other') : 'Unassigned'; },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  weekAgo() {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return App.ymdLocal(d);
  },
  mondayOf(d) {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return App.ymdLocal(date);
  },
  addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return App.ymdLocal(d);
  },

  // ── Shared bits (match the Shift dashboard card standard) ────────────────────
  metricCard(label, valHtml, target, cls) {
    return '<div class="metric-card"><div class="metric-label">' + label + '</div>'
      + '<div class="metric-val ' + (cls || '') + '">' + valHtml + '</div>'
      + '<div class="metric-target">' + target + '</div><div class="metric-trend"> </div></div>';
  },
  // Full-width hero: a .form-card with a banded title (optional right action).
  panelCard(title, bodyHtml, titleRight) {
    return '<div class="card form-card" style="height:100%;">'
      + '<div class="card-title"' + (titleRight ? ' style="display:flex;align-items:center;justify-content:space-between;gap:12px;"' : '') + '>'
      + '<span>' + title + '</span>' + (titleRight || '') + '</div>'
      + bodyHtml + '</div>';
  },
  // Grid panel: title OUTSIDE the card as a .sh heading so side-by-side panels
  // line up on top; the card flexes to fill its row column for equal height.
  shPanel(title, bodyHtml) {
    return '<div class="sh" style="margin:0 0 10px;">' + title + '</div>'
      + '<div class="card" style="flex:1;">' + bodyHtml + '</div>';
  },
  actionBtn(id, label) {
    return '<button class="btn btn-primary ld-act" data-go="' + id + '" style="flex:1;min-width:150px;">' + label + '</button>';
  },
  quickActions() {
    return '<div style="margin-top:20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Quick Actions</div>'
      + '<div style="border-top:1px solid var(--b2);padding-top:14px;display:flex;gap:10px;flex-wrap:wrap;">'
      + this.actionBtn('lc-build-schedule', 'Build Schedule')
      + this.actionBtn('lc-log-hours', 'Log Hours')
      + this.actionBtn('lc-staff-roster', 'Staff Roster')
      + this.actionBtn('lc-reports', 'Labor Reports')
      + '</div></div>';
  },
  // Two equal-height columns: each column is a flex-column so the card inside
  // (flex:1) grows to match its row-mate even with the .sh heading outside.
  row(a, b) {
    return '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;align-items:stretch;">'
      + '<div style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;">' + a + '</div>'
      + '<div style="flex:1 1 280px;min-width:0;display:flex;flex-direction:column;">' + b + '</div></div>';
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    if (this.actuals().length === 0) this.renderDayOne();
    else this.renderFull();
    this.container.onclick = ev => {
      const act = ev.target.closest('.ld-act');
      if (act && act.dataset.go) App.navigate(act.dataset.go);
    };
  },

  // ── Day-one: the real layout in placeholder form + Get Started ────────────────
  renderDayOne() {
    const hasPos = this.positions().length > 0;
    const totalStaff = this.staff().length;
    const activeStaff = this.staff().filter(s => s.status !== 'Inactive').length;
    const hasStaff = totalStaff > 0;

    const step = (done, label, screen, current) =>
      '<div class="ld-act" data-go="' + screen + '" style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;min-width:170px;padding:10px 12px;border:1px solid ' + (current ? 'var(--gold)' : 'var(--b2)') + ';border-radius:6px;background:var(--input);">'
      + '<span style="width:18px;height:18px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;'
      + (done ? 'background:var(--gold);color:var(--bg);' : 'border:1px solid var(--t3);color:var(--t3);') + '">' + (done ? '&#10003;' : '') + '</span>'
      + '<span style="font-size:12px;font-weight:600;color:' + (current ? 'var(--gold)' : 'var(--t1)') + ';">' + label + '</span></div>';

    const startStrip = '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Get Started</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">Three steps and this dashboard fills in with your labor cost, overtime risk, and coverage alerts.</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + step(hasPos, '1. Add positions', 'lc-positions', !hasPos)
      + step(hasStaff, '2. Add your staff', 'lc-staff-roster', hasPos && !hasStaff)
      + step(false, '3. Log hours', 'lc-log-hours', hasPos && hasStaff)
      + '</div></div>';

    const cards =
        this.metricCard('Labor Cost, Last 7 Days', '$0', 'After you log hours')
      + this.metricCard('Labor Hours, Last 7 Days', '&mdash;', 'After you log hours')
      + this.metricCard('Overtime Risk', '&mdash;', 'After you build a schedule')
      + this.metricCard('Active Staff', String(activeStaff), totalStaff + ' on the roster');

    const hero = this.panelCard('This Week',
      '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.6;">No schedule built for this week yet. Build one to set a labor budget and project overtime, then log hours as the week runs.</div>'
      + '<button class="btn btn-primary btn-sm ld-act" data-go="lc-build-schedule" style="margin:0;">Build Schedule</button></div>');

    const emptyBody = msg => '<div style="font-size:12px;color:var(--t3);line-height:1.6;">' + msg + '</div>';
    const deptCard  = this.shPanel('Labor Cost by Department', emptyBody('Once you log hours, your labor cost splits by department here.'));
    const hoursCard = this.shPanel('Hours This Week', emptyBody('Logged and scheduled hours project here against the ' + App.OT_THRESHOLD + '-hour overtime threshold.'));
    const recent    = this.shPanel('Recent Hours', emptyBody('The hours you log land here, newest first.'));
    const watchCard = this.shPanel('Labor Watch', emptyBody('Overtime risk, uncovered call-outs, and expiring certifications surface here once you build a schedule and log hours.'));

    this.container.innerHTML = '<div class="screen">'
      + startStrip
      + '<div class="metric-grid">' + cards + '</div>'
      + '<div style="margin-bottom:16px;">' + hero + '</div>'
      + this.row(deptCard, hoursCard)
      + this.row(recent, watchCard)
      + this.quickActions()
      + '</div>';
  },

  // ── Populated dashboard ──────────────────────────────────────────────────────
  renderFull() {
    const cutoff = this.weekAgo();
    const today = App.todayLocal();
    const wkActuals = this.actuals().filter(a => (a.date || '') >= cutoff);
    const wkHours = wkActuals.reduce((t, a) => t + (a.hours || 0), 0);
    const salWeek = App.salariedCost(cutoff, today).total;
    const wkCost = wkActuals.reduce((t, a) => t + (a.cost || 0), 0) + salWeek;
    const activeStaff = this.staff().filter(s => s.status !== 'Inactive').length;

    // Current-week window + per-staff overtime projection (greater of logged and
    // scheduled hours, the same basis as Overtime Watch).
    const wkStart = this.mondayOf(new Date()), wkEnd = this.addDays(wkStart, 6);
    const curWeek = this.actuals().filter(a => a.date >= wkStart && a.date <= wkEnd);
    const sched = this.schedules().find(s => s.week_start === wkStart) || null;
    const proj = {};
    const ensure = (id, name) => { if (!proj[id]) proj[id] = { id, name: name || '-', actual: 0, scheduled: 0 }; return proj[id]; };
    curWeek.forEach(a => { if (App.isSalaried(a.staff_id)) return; ensure(a.staff_id || a.name, a.name).actual += (a.hours || 0); });
    if (sched) (sched.shifts || []).forEach(sh => { if (App.isSalaried(sh.staff_id)) return; ensure(sh.staff_id || sh.name, sh.name).scheduled += (sh.hours || 0); });
    const projRows = Object.values(proj).map(e => {
      const wage = App.wageForStaffOn ? (App.wageForStaffOn(e.id, wkStart) || 0) : 0;
      const projected = Math.max(e.actual, e.scheduled);
      const otHours = Math.max(0, projected - App.OT_THRESHOLD);
      return { ...e, projected, otHours, otCost: otHours * wage * 0.5,
        status: projected > App.OT_THRESHOLD ? 'over' : projected >= App.OT_APPROACHING ? 'approaching' : 'ok' };
    }).sort((a, b) => b.projected - a.projected);
    const over = projRows.filter(r => r.status === 'over').length;
    const approaching = projRows.filter(r => r.status === 'approaching').length;
    const otPremium = projRows.reduce((t, r) => t + r.otCost, 0);

    // ── KPI tiles ──
    const cards =
        this.metricCard('Labor Cost, Last 7 Days', App.fmtCurrency(wkCost),
             wkActuals.length + ' hours entr' + (wkActuals.length === 1 ? 'y' : 'ies'))
      + this.metricCard('Labor Hours, Last 7 Days', wkHours.toFixed(1),
             wkHours > 0 ? App.fmtCurrency(wkHours > 0 ? wkCost / wkHours : 0) + ' avg wage' : 'No hours logged')
      + this.metricCard('Overtime Risk', String(over + approaching),
             over + ' over &middot; ' + approaching + ' approaching', (over + approaching) ? 'over-target' : 'on-target')
      + this.metricCard('Active Staff', String(activeStaff), this.staff().length + ' on the roster');

    // ── This Week hero (full width) ──
    let weekCard;
    if (!sched) {
      weekCard = this.panelCard('This Week',
        '<div style="font-size:13px;color:var(--t2);line-height:1.6;">No schedule built for this week yet. Build one to set a labor budget and project overtime.</div>',
        '<button class="btn btn-primary btn-sm ld-act" data-go="lc-build-schedule" style="margin:0;">Build Schedule</button>');
    } else {
      const loggedHours = curWeek.reduce((t, a) => t + (a.hours || 0), 0);
      const loggedCost = curWeek.reduce((t, a) => t + (a.cost || 0), 0) + App.salariedCost(wkStart, today).total;
      const fc = sched.revenue_forecast || 0;
      const planPct = fc > 0 ? (sched.total_cost || 0) / fc * 100 : null;
      weekCard = this.panelCard('This Week',
        '<div style="display:flex;gap:28px;flex-wrap:wrap;">'
        + '<div><div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">Scheduled</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:600;color:var(--t1);line-height:1;">' + App.fmtCurrency(sched.total_cost || 0) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (sched.total_hours || 0).toFixed(1) + ' hrs'
        + (planPct != null ? ' &middot; ' + App.fmtPct(planPct) + ' of forecast' : '') + '</div></div>'
        + '<div><div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">Logged So Far</div>'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:600;color:var(--gold);line-height:1;">' + App.fmtCurrency(loggedCost) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + loggedHours.toFixed(1) + ' hrs logged</div></div>'
        + '</div>',
        '<button class="btn btn-ghost btn-sm ld-act" data-go="lc-build-schedule" style="margin:0;">View Schedule</button>');
    }

    // ── Labor Cost by Department (last 7 days) — bar chart ──
    const deptCost = {};
    wkActuals.forEach(a => { if (App.isSalaried(a.staff_id)) return; const d = this.posDept(a.position_id); deptCost[d] = (deptCost[d] || 0) + (a.cost || 0); });
    if (salWeek > 0) deptCost['Salaried'] = (deptCost['Salaried'] || 0) + salWeek;
    const deptRows = Object.entries(deptCost).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);
    const deptMax = deptRows.length ? deptRows[0][1] : 1;
    const deptCard = this.shPanel('Labor Cost by Department',
      (deptRows.length
        ? deptRows.map(([d, c]) => {
            const pct = Math.max(2, Math.round(c / deptMax * 100));
            return '<div style="margin-bottom:11px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">'
              + '<span style="color:var(--t2);">' + esc(d) + '</span><span style="color:var(--t1);font-weight:600;">' + App.fmtCurrency(c) + '</span></div>'
              + '<div style="height:7px;background:var(--input);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--gold);"></div></div></div>';
          }).join('')
        : '<div style="font-size:12px;color:var(--t3);">No labor cost in the last 7 days.</div>'));

    // ── Hours This Week (per-staff projection) ──
    const hLine = (r) => {
      const col = r.status === 'over' ? 'var(--red)' : r.status === 'approaching' ? 'var(--amber)' : 'var(--t3)';
      const word = r.status === 'over' ? 'Over' : r.status === 'approaching' ? 'Approaching' : 'OK';
      return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;">'
        + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(r.name) + '</div>'
        + '<div style="font-size:12px;font-weight:600;color:var(--t1);white-space:nowrap;">' + r.projected.toFixed(1) + ' hrs</div>'
        + '<span style="font-size:11px;font-weight:700;color:' + col + ';white-space:nowrap;width:84px;text-align:right;">' + word + '</span></div>';
    };
    const hoursCard = this.shPanel('Hours This Week',
      (projRows.length
        ? projRows.slice(0, 6).map(hLine).join('')
          + '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Projected is the greater of logged and scheduled hours. Threshold ' + App.OT_THRESHOLD + ' hrs/week.</div>'
        : '<div style="font-size:12px;color:var(--t3);">No hourly staff logged or scheduled this week.</div>'));

    // ── Recent Hours (data-card table + .sh heading) ──
    const recent = [...this.actuals()]
      .sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime())
      .slice(0, 6);
    const recentRows = recent.map(a => '<tr><td><div class="val">' + this.fmtDate(a.date) + '</div></td>'
      + '<td>' + esc(a.name || '-') + '</td>'
      + '<td>' + (a.hours != null ? a.hours.toFixed(1) : '-') + '</td>'
      + '<td class="val">' + (App.isSalaried(a.staff_id) ? '<span style="color:var(--t3);">Salary</span>' : App.fmtCurrency(a.cost || 0)) + '</td></tr>').join('');
    const recentBlock = '<div class="sh" style="margin:0 0 10px;">Recent Hours</div>'
      + '<div class="card card-bleed data-card" style="flex:1;"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Staff</th><th>Hours</th><th>Cost</th>'
      + '</tr></thead><tbody>' + recentRows + '</tbody></table></div></div>';

    // ── Labor Watch (leaks-style, tappable) ──
    const uncovered = this.callouts().filter(c => (c.date || '') >= cutoff && !c.covered).length;
    const cutoff30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return App.ymdLocal(d); })();
    const activeIds = new Set(this.staff().filter(s => s.status !== 'Inactive').map(s => s.id));
    const expired = this.certs().filter(c => activeIds.has(c.staff_id) && c.expiration_date && c.expiration_date < today).length;
    const expiring = this.certs().filter(c => activeIds.has(c.staff_id) && c.expiration_date && c.expiration_date >= today && c.expiration_date <= cutoff30).length;
    const watchRow = (label, val, screen, warn) =>
      '<div class="ld-act" data-go="' + screen + '" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--b2);cursor:pointer;">'
      + '<span style="font-size:12px;color:var(--t2);">' + label + '</span>'
      + '<span style="font-size:13px;font-weight:600;color:' + (warn ? 'var(--red)' : 'var(--t1)') + ';">' + val + ' &rsaquo;</span></div>';
    const anyWatch = otPremium > 0 || uncovered > 0 || expired > 0 || expiring > 0;
    const watchCard = this.shPanel('Labor Watch',
      watchRow('Projected OT premium (this week)', App.fmtCurrency(otPremium), 'lc-overtime-watch', otPremium > 0)
      + watchRow('Uncovered call-outs (7d)', String(uncovered), 'lc-callout-log', uncovered > 0)
      + watchRow('Certifications expired (active staff)', String(expired), 'lc-staff-roster', expired > 0)
      + watchRow('Certifications expiring (30d)', String(expiring), 'lc-staff-roster', expiring > 0)
      + (anyWatch ? '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Tap any line to dig in.</div>'
                  : '<div style="font-size:11px;color:var(--gold);margin-top:8px;">All clear. No labor issues flagged.</div>'));

    this.container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + '<div style="margin-bottom:16px;">' + weekCard + '</div>'
      + this.row(deptCard, hoursCard)
      + this.row(recentBlock, watchCard)
      + this.quickActions()
      + '</div>';
  }
};
