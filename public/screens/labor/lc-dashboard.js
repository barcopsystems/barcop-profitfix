'use strict';

/* ── Labor Control — Dashboard (landing screen) ───────────────────────────────
   At-a-glance labor health: last-7-day labor cost and hours, overtime risk for
   the current week, roster size, plus alerts and recent activity. Day-one state
   mirrors the Inventory dashboard: a Get Started strip, placeholder tiles, and
   guided panels until hours are logged. */

S.LaborDashboard = {
  actuals()   { return ((App.laborData && App.laborData.lc_actuals) || []); },
  schedules() { return ((App.laborData && App.laborData.lc_schedules) || []); },
  staff()     { return ((App.laborData && App.laborData.lc_staff) || []); },
  positions() { return ((App.laborData && App.laborData.lc_positions) || []); },
  callouts()  { return ((App.laborData && App.laborData.lc_callouts) || []); },
  certs()     { return ((App.laborData && App.laborData.lc_certs) || []); },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  weekAgo() {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  },
  mondayOf(d) {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return date.toISOString().slice(0, 10);
  },
  addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  },

  // ── Shared bits (match the Inventory dashboard's design language) ────────────
  metricCard(label, valHtml, target, cls) {
    return '<div class="metric-card"><div class="metric-label">' + label + '</div>'
      + '<div class="metric-val ' + (cls || '') + '">' + valHtml + '</div>'
      + '<div class="metric-target">' + target + '</div><div class="metric-trend"> </div></div>';
  },
  actionBtn(id, label) {
    return '<button class="btn btn-primary ld-act" data-go="' + id + '" style="flex:1;min-width:150px;">' + label + '</button>';
  },
  // Quick Actions — no card box: label, divider, bare buttons on the background
  // (identical treatment to the Inventory dashboard).
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

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    actions.innerHTML = '';
    if (this.actuals().length === 0) this.renderDayOne();
    else this.renderFull();
    this.container.onclick = ev => {
      const act = ev.target.closest('.ld-act');
      if (act && act.dataset.go) App.navigate(act.dataset.go);
    };
  },

  // ── Day-one: the real dashboard layout in placeholder form + Get Started ─────
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

    const startStrip = '<div class="card" style="margin-bottom:16px;">'
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

    const emptyPanel = (title, msg, btns) =>
      '<div class="card" style="height:100%;"><div class="card-title">' + title + '</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.6;">' + msg + '</div>'
      + (btns || '') + '</div>';
    const row = (a, b) =>
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">'
      + '<div style="flex:1 1 300px;min-width:0;">' + a + '</div>'
      + '<div style="flex:1 1 280px;min-width:0;">' + b + '</div></div>';

    const alertsPanel = emptyPanel('Alerts', 'Overtime risk, uncovered call-outs, and expiring certifications surface here once you build a schedule and log hours.');
    const recentPanel = emptyPanel('Recent Hours', 'The hours you log show up here.',
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">'
        + this.actionBtn('lc-log-hours', 'Log Hours')
        + this.actionBtn('lc-staff-roster', 'Staff Roster') + '</div>');

    this.container.innerHTML = '<div class="screen">'
      + startStrip
      + '<div class="metric-grid">' + cards + '</div>'
      + row(alertsPanel, recentPanel)
      + '</div>';
  },

  // ── Populated dashboard ──────────────────────────────────────────────────────
  renderFull() {
    const cutoff = this.weekAgo();
    const today = new Date().toISOString().slice(0, 10);
    const wkActuals = this.actuals().filter(a => (a.date || '') >= cutoff);
    const wkHours = wkActuals.reduce((t, a) => t + (a.hours || 0), 0);
    const wkCost = wkActuals.reduce((t, a) => t + (a.cost || 0), 0) + App.salariedCost(cutoff, today).total;
    const activeStaff = this.staff().filter(s => s.status !== 'Inactive').length;

    // current-week overtime risk
    const wkStart = this.mondayOf(new Date()), wkEnd = this.addDays(wkStart, 6);
    const curWeek = this.actuals().filter(a => a.date >= wkStart && a.date <= wkEnd);
    const byStaff = {};
    curWeek.forEach(a => { byStaff[a.staff_id || a.name] = (byStaff[a.staff_id || a.name] || 0) + (a.hours || 0); });
    const over = Object.values(byStaff).filter(h => h > App.OT_THRESHOLD).length;
    const approaching = Object.values(byStaff).filter(h => h >= App.OT_APPROACHING && h <= App.OT_THRESHOLD).length;

    const recentCallouts = this.callouts().filter(c => (c.date || '') >= cutoff);
    const uncovered = recentCallouts.filter(c => !c.covered).length;

    const cards =
        this.metricCard('Labor Cost, Last 7 Days', App.fmtCurrency(wkCost),
             wkActuals.length + ' hours entr' + (wkActuals.length === 1 ? 'y' : 'ies'))
      + this.metricCard('Labor Hours, Last 7 Days', wkHours.toFixed(1),
             wkHours > 0 ? App.fmtCurrency(wkHours > 0 ? wkCost / wkHours : 0) + ' avg wage' : 'No hours logged')
      + this.metricCard('Overtime Risk', String(over + approaching),
             over + ' over &middot; ' + approaching + ' approaching this week', (over + approaching) ? 'over-target' : 'on-target')
      + this.metricCard('Active Staff', String(activeStaff), this.staff().length + ' on the roster');

    // Cert expiration sweep — expired or expiring within 30 days, active staff
    const cutoff30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();
    const activeStaffIds = new Set(this.staff().filter(s => s.status !== 'Inactive').map(s => s.id));
    const expiredCerts = this.certs().filter(c => activeStaffIds.has(c.staff_id) && c.expiration_date && c.expiration_date < today);
    const expiringCerts = this.certs().filter(c => activeStaffIds.has(c.staff_id) && c.expiration_date && c.expiration_date >= today && c.expiration_date <= cutoff30);

    const alerts = [];
    if (over) alerts.push({ sev: 'red', text: over + ' staff member' + (over === 1 ? '' : 's') + ' projected over 40 hours this week', go: 'lc-overtime-watch' });
    if (approaching) alerts.push({ sev: 'amber', text: approaching + ' staff member' + (approaching === 1 ? '' : 's') + ' approaching overtime', go: 'lc-overtime-watch' });
    if (uncovered) alerts.push({ sev: 'red', text: uncovered + ' uncovered call-out' + (uncovered === 1 ? '' : 's') + ' in the last 7 days', go: 'lc-callout-log' });
    const hasWeekSchedule = this.schedules().some(s => s.week_start === wkStart);
    if (!hasWeekSchedule) alerts.push({ sev: 'amber', text: 'No schedule built for the current week', go: 'lc-build-schedule' });
    if (expiredCerts.length) alerts.push({ sev: 'red', text: expiredCerts.length + ' certification' + (expiredCerts.length === 1 ? '' : 's') + ' expired on active staff. Review before the next shift.', go: 'lc-staff-roster' });
    if (expiringCerts.length) alerts.push({ sev: 'amber', text: expiringCerts.length + ' certification' + (expiringCerts.length === 1 ? '' : 's') + ' expiring within 30 days', go: 'lc-staff-roster' });

    let alertCard;
    if (alerts.length === 0) {
      alertCard = '<div class="card" style="height:100%;"><div class="card-title">Alerts</div>'
        + '<div style="font-size:13px;color:var(--gold);">All clear. No labor issues flagged.</div></div>';
    } else {
      alertCard = '<div class="card" style="height:100%;"><div class="card-title">Alerts</div>'
        + alerts.map((a, i) => '<div style="display:flex;align-items:center;gap:12px;padding:9px 0;'
            + (i < alerts.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:'
            + (a.sev === 'red' ? 'var(--red)' : 'var(--gold)') + ';"></span>'
            + '<div style="flex:1;font-size:13px;color:var(--t1);">' + esc(a.text) + '</div>'
            + '<button class="btn btn-ghost btn-sm ld-act" data-go="' + a.go + '" style="margin:0;">Fix It</button></div>').join('')
        + '</div>';
    }

    const recent = [...this.actuals()]
      .sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime())
      .slice(0, 5);
    let recentCard;
    if (recent.length) {
      const rows = recent.map(a => '<tr><td><div class="val">' + this.fmtDate(a.date) + '</div></td>'
        + '<td>' + esc(a.name || '-') + '</td>'
        + '<td>' + (a.hours != null ? a.hours.toFixed(1) : '-') + '</td>'
        + '<td class="val">' + (App.isSalaried(a.staff_id)
            ? App.fmtCurrency(App.staffWeeklySalary(a.staff_id) / 7)
            : App.fmtCurrency(a.cost || 0)) + '</td></tr>').join('');
      recentCard = '<div class="card" style="height:100%;"><div class="card-title">Recent Hours</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Staff</th><th>Hours</th><th>Cost</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    } else {
      recentCard = '<div class="card" style="height:100%;"><div class="card-title">Recent Hours</div>'
        + '<div style="font-size:12px;color:var(--t3);">The hours you log show up here.</div></div>';
    }

    const row = (a, b) =>
      '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">'
      + '<div style="flex:1 1 300px;min-width:0;">' + a + '</div>'
      + '<div style="flex:1 1 280px;min-width:0;">' + b + '</div></div>';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + row(alertCard, recentCard)
      + this.quickActions()
      + '</div>';
  }
};
