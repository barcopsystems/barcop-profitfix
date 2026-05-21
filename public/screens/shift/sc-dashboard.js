'use strict';

/* ── Shift Control — Dashboard (landing screen) ───────────────────────────────
   At-a-glance shift health: the running shift, last-7-day revenue and covers,
   cash variance, open operational items, plus alerts and recent shifts. */

S.ShiftDashboard = {
  shifts()    { return ((App.shiftData && App.shiftData.sc_shifts) || []); },
  drops()     { return ((App.shiftData && App.shiftData.sc_cash_drops) || []); },
  variances() { return ((App.shiftData && App.shiftData.sc_variances) || []); },
  list86()    { return ((App.shiftData && App.shiftData.sc_86_list) || []); },
  maint()     { return ((App.shiftData && App.shiftData.sc_maintenance) || []); },

  fmtDate(str) {
    if (!str) return '—';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  weekAgo() {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  },
  activeShift() {
    return [...this.shifts()]
      .filter(s => s.status === 'Open')
      .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())[0] || null;
  },

  render(container, actions) {
    this.container = container;
    actions.innerHTML = '';

    const cutoff = this.weekAgo();
    const wkShifts = this.shifts().filter(s => (s.date || '') >= cutoff);
    const wkRevenue = wkShifts.reduce((t, s) => t + (s.total_revenue || 0), 0);
    const wkCovers = wkShifts.reduce((t, s) => t + (s.covers || 0), 0);
    const wkVar = this.variances().filter(v => (v.date || '') >= cutoff);
    const netVar = wkVar.reduce((t, v) => t + (v.variance || 0), 0);
    const active86 = this.list86().filter(i => i.status !== 'Back');
    const openMaint = this.maint().filter(m => m.status !== 'Resolved');
    const active = this.activeShift();

    // ── Metric cards ──
    const card = (label, valHtml, target) =>
      '<div class="metric-card"><div class="metric-label">' + label + '</div>' + valHtml
      + '<div class="metric-target">' + target + '</div><div class="metric-trend"> </div></div>';
    const val = (txt, cls) => '<div class="metric-val ' + (cls || '') + '">' + txt + '</div>';

    const cards =
        card('Revenue — Last 7 Days', val(App.fmtCurrency(wkRevenue)),
             wkShifts.length + ' shift' + (wkShifts.length === 1 ? '' : 's') + ' logged')
      + card('Covers — Last 7 Days', val(String(wkCovers)),
             wkCovers > 0 ? App.fmtCurrency(wkRevenue / wkCovers) + ' avg check' : 'No covers logged')
      + card('Cash Over/Short — 7d', val((netVar >= 0 ? '+' : '') + App.fmtCurrency(netVar), netVar < 0 ? 'over-target' : 'on-target'),
             wkVar.length + ' variance' + (wkVar.length === 1 ? '' : 's') + ' logged')
      + card('Open Items', val(String(active86.length + openMaint.length), (active86.length + openMaint.length) ? 'over-target' : 'on-target'),
             active86.length + ' 86\'d · ' + openMaint.length + ' maintenance');

    // ── Active shift banner ──
    let activeCard;
    if (active) {
      activeCard = '<div class="card" id="sd-active" style="cursor:pointer;">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">'
        + '<span style="width:9px;height:9px;border-radius:50%;background:var(--gold);box-shadow:0 0 8px var(--gold);"></span>'
        + '<span style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">Shift Running</span></div>'
        + '<div style="font-size:16px;font-weight:800;color:var(--t1);">' + esc(active.shift_type || 'Shift') + ' &middot; ' + this.fmtDate(active.date) + '</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-top:3px;">'
        + (active.manager ? 'Manager: ' + esc(active.manager) + ' &middot; ' : '') + 'Tap to open the active shift</div>'
        + '</div>';
    } else {
      activeCard = '<div class="card"><div class="card-title">No Shift Running</div>'
        + '<div style="font-size:13px;color:var(--t3);margin-bottom:14px;">Start a shift to track cash, voids, '
        + 'and 86s live, then close it out with revenue.</div>'
        + '<button class="btn btn-primary sd-act" data-go="sc-active-shift">Start a Shift</button></div>';
    }

    // ── Alerts ──
    const alerts = [];
    openMaint.filter(m => m.priority === 'Urgent').forEach(m => alerts.push({
      sev: 'red', text: 'Urgent maintenance: ' + (m.equipment || 'issue') + (m.location ? ' (' + m.location + ')' : ''),
      go: 'sc-maintenance'
    }));
    wkVar.filter(v => v.status === 'Short').forEach(v => alerts.push({
      sev: 'red', text: 'Cash short ' + App.fmtCurrency(Math.abs(v.variance || 0))
        + (v.cashier ? ' — ' + v.cashier : '') + (v.drawer ? ' (' + v.drawer + ')' : ''),
      go: 'sc-variance-log'
    }));
    if (active86.length) alerts.push({
      sev: 'amber', text: active86.length + ' item' + (active86.length === 1 ? '' : 's') + ' currently 86\'d',
      go: 'sc-86-list'
    });
    if (openMaint.filter(m => m.priority !== 'Urgent').length) alerts.push({
      sev: 'amber', text: openMaint.filter(m => m.priority !== 'Urgent').length + ' open maintenance issue'
        + (openMaint.filter(m => m.priority !== 'Urgent').length === 1 ? '' : 's'),
      go: 'sc-maintenance'
    });

    let alertCard;
    if (alerts.length === 0) {
      alertCard = '<div class="card"><div class="card-title">Alerts</div>'
        + '<div style="font-size:13px;color:var(--gold);">All clear — no open shift issues.</div></div>';
    } else {
      alertCard = '<div class="card"><div class="card-title">Alerts</div>'
        + alerts.map((a, i) => '<div style="display:flex;align-items:center;gap:12px;padding:9px 0;'
            + (i < alerts.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
            + '<span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:'
            + (a.sev === 'red' ? 'var(--red)' : 'var(--gold)') + ';"></span>'
            + '<div style="flex:1;font-size:13px;color:var(--t1);">' + esc(a.text) + '</div>'
            + '<button class="btn btn-ghost btn-sm sd-act" data-go="' + a.go + '" style="margin:0;">Fix It</button></div>').join('')
        + '</div>';
    }

    // ── Recent shifts ──
    const recent = [...this.shifts()]
      .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())
      .slice(0, 5);
    let recentCard;
    if (recent.length === 0) {
      recentCard = '';
    } else {
      const rows = recent.map(s => '<tr class="sd-srow" data-id="' + s.id + '" style="cursor:pointer;">'
        + '<td><div class="val">' + this.fmtDate(s.date) + '</div></td>'
        + '<td>' + esc(s.shift_type || '—') + '</td>'
        + '<td class="val">' + App.fmtCurrency(s.total_revenue || 0) + '</td>'
        + '<td>' + (s.covers != null ? s.covers : '—') + '</td>'
        + '<td>' + (s.status === 'Open'
            ? '<span class="badge badge-ok">Open</span>'
            : '<span class="badge badge-dim">Closed</span>') + '</td></tr>').join('');
      recentCard = '<div class="card"><div class="card-title">Recent Shifts</div>'
        + '<div class="tbl-wrap" style="overflow-x:auto;"><table class="tbl"><thead><tr>'
        + '<th>Date</th><th>Shift</th><th>Revenue</th><th>Covers</th><th>Status</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    // ── Quick actions ──
    const actionBtn = (id, label) => '<button class="btn btn-primary sd-act" data-go="' + id + '" '
      + 'style="flex:1;min-width:150px;">' + label + '</button>';
    const quick = '<div class="card"><div class="card-title">Quick Actions</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + actionBtn('sc-log-shift', 'Log a Shift')
      + actionBtn('sc-cash-drop', 'Cash Drop')
      + actionBtn('sc-86-list', '86 List')
      + actionBtn('sc-reports-shift', 'Shift Reports')
      + '</div></div>';

    this.container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + activeCard + alertCard + recentCard + quick + '</div>';

    this.container.onclick = ev => {
      const act = ev.target.closest('.sd-act');
      const srow = ev.target.closest('.sd-srow');
      if (act) { App.navigate(act.dataset.go); return; }
      if (ev.target.closest('#sd-active')) { App.navigate('sc-active-shift'); return; }
      if (srow) App.navigate('sc-shift-history');
    };
  }
};
