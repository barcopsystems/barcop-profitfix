'use strict';

/* ── Labor Control — Dashboard (landing screen) ───────────────────────────────
   At-a-glance labor health: last-7-day labor cost and hours, overtime risk for
   the current week, roster size, plus alerts and recent activity. */

S.LaborDashboard = {
  actuals()   { return ((App.laborData && App.laborData.lc_actuals) || []); },
  schedules() { return ((App.laborData && App.laborData.lc_schedules) || []); },
  staff()     { return ((App.laborData && App.laborData.lc_staff) || []); },
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

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';

    const cutoff = this.weekAgo();
    const wkActuals = this.actuals().filter(a => (a.date || '') >= cutoff);
    const wkHours = wkActuals.reduce((t, a) => t + (a.hours || 0), 0);
    const wkCost = wkActuals.reduce((t, a) => t + (a.cost || 0), 0);
    const activeStaff = this.staff().filter(s => s.status !== 'Inactive').length;

    // current-week overtime risk
    const wkStart = this.mondayOf(new Date()), wkEnd = this.addDays(wkStart, 6);
    const curWeek = this.actuals().filter(a => a.date >= wkStart && a.date <= wkEnd);
    const byStaff = {};
    curWeek.forEach(a => { byStaff[a.staff_id || a.name] = (byStaff[a.staff_id || a.name] || 0) + (a.hours || 0); });
    const over = Object.values(byStaff).filter(h => h > App.OT_THRESHOLD).length;
    const approaching = Object.values(byStaff).filter(h => h >= App.OT_APPROACHING && h <= App.OT_THRESHOLD).length;

    // recent call-outs
    const recentCallouts = this.callouts().filter(c => (c.date || '') >= cutoff);
    const uncovered = recentCallouts.filter(c => !c.covered).length;

    // ── Metric cards ──
    const card = (label, valHtml, target) =>
      '<div class="metric-card"><div class="metric-label">' + label + '</div>' + valHtml
      + '<div class="metric-target">' + target + '</div><div class="metric-trend"> </div></div>';
    const val = (txt, cls) => '<div class="metric-val ' + (cls || '') + '">' + txt + '</div>';

    const cards =
        card('Labor Cost, Last 7 Days', val(App.fmtCurrency(wkCost)),
             wkActuals.length + ' hours entr' + (wkActuals.length === 1 ? 'y' : 'ies'))
      + card('Labor Hours, Last 7 Days', val(wkHours.toFixed(1)),
             wkHours > 0 ? App.fmtCurrency(wkHours > 0 ? wkCost / wkHours : 0) + ' avg wage' : 'No hours logged')
      + card('Overtime Risk', val(String(over + approaching), (over + approaching) ? 'over-target' : 'on-target'),
             over + ' over · ' + approaching + ' approaching this week')
      + card('Active Staff', val(String(activeStaff)),
             this.staff().length + ' on the roster');

    // Cert expiration sweep — anything expired or expiring within 30 days
    const today = new Date().toISOString().slice(0, 10);
    const cutoff30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();
    const activeStaffIds = new Set(this.staff().filter(s => s.status !== 'Inactive').map(s => s.id));
    const expiredCerts = this.certs().filter(c => activeStaffIds.has(c.staff_id) && c.expiration_date && c.expiration_date < today);
    const expiringCerts = this.certs().filter(c => activeStaffIds.has(c.staff_id) && c.expiration_date && c.expiration_date >= today && c.expiration_date <= cutoff30);

    // ── Alerts ──
    const alerts = [];
    if (over) alerts.push({ sev: 'red', text: over + ' staff member' + (over === 1 ? '' : 's') + ' projected over 40 hours this week', go: 'lc-overtime-watch' });
    if (approaching) alerts.push({ sev: 'amber', text: approaching + ' staff member' + (approaching === 1 ? '' : 's') + ' approaching overtime', go: 'lc-overtime-watch' });
    if (uncovered) alerts.push({ sev: 'red', text: uncovered + ' uncovered call-out' + (uncovered === 1 ? '' : 's') + ' in the last 7 days', go: 'lc-callout-log' });
    const hasWeekSchedule = this.schedules().some(s => s.week_start === wkStart);
    if (!hasWeekSchedule) alerts.push({ sev: 'amber', text: 'No schedule built for the current week', go: 'lc-build-schedule' });
    if (expiredCerts.length) alerts.push({ sev: 'red', text: expiredCerts.length + ' certification' + (expiredCerts.length === 1 ? '' : 's') + ' expired on active staff. Fix before next shift to avoid a fine.', go: 'lc-staff-roster' });
    if (expiringCerts.length) alerts.push({ sev: 'amber', text: expiringCerts.length + ' certification' + (expiringCerts.length === 1 ? '' : 's') + ' expiring within 30 days', go: 'lc-staff-roster' });

    let alertCard;
    if (alerts.length === 0) {
      alertCard = '<div class="card"><div class="card-title">Alerts</div>'
        + '<div style="font-size:13px;color:var(--gold);">All clear. No labor issues flagged.</div></div>';
    } else {
      alertCard = '<div class="card"><div class="card-title">Alerts</div>'
        + alerts.map((a, i) => '<div style="display:flex;align-items:center;gap:12px;padding:9px 0;'
            + (i < alerts.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:'
            + (a.sev === 'red' ? 'var(--red)' : 'var(--gold)') + ';"></span>'
            + '<div style="flex:1;font-size:13px;color:var(--t1);">' + esc(a.text) + '</div>'
            + '<button class="btn btn-ghost btn-sm ld-act" data-go="' + a.go + '" style="margin:0;">Fix It</button></div>').join('')
        + '</div>';
    }

    // ── Recent hours ──
    const recent = [...this.actuals()]
      .sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime())
      .slice(0, 5);
    let recentCard = '';
    if (recent.length) {
      const rows = recent.map(a => '<tr><td><div class="val">' + this.fmtDate(a.date) + '</div></td>'
        + '<td>' + esc(a.name || '-') + '</td>'
        + '<td>' + (a.hours != null ? a.hours.toFixed(1) : '-') + '</td>'
        + '<td class="val">' + App.fmtCurrency(a.cost || 0) + '</td></tr>').join('');
      recentCard = '<div class="card"><div class="card-title">Recent Hours</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Staff</th><th>Hours</th><th>Cost</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    // ── Quick actions ──
    const actionBtn = (id, label) => '<button class="btn btn-primary ld-act" data-go="' + id + '" '
      + 'style="flex:1;min-width:150px;">' + label + '</button>';
    const quick = '<div class="card"><div class="card-title">Quick Actions</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + actionBtn('lc-build-schedule', 'Build Schedule')
      + actionBtn('lc-log-hours', 'Log Hours')
      + actionBtn('lc-staff-roster', 'Staff Roster')
      + actionBtn('lc-reports', 'Labor Reports')
      + '</div></div>';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + alertCard + recentCard + quick + '</div>';

    this.container.onclick = ev => {
      const act = ev.target.closest('.ld-act');
      if (act) App.navigate(act.dataset.go);
    };
  }
};
