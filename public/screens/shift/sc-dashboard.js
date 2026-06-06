'use strict';

/* ── Shift Control — Dashboard (landing screen) ───────────────────────────────
   Same layout as the Inventory and Labor dashboards (KPI tiles, a full-width
   hero, two rows of two, then Quick Actions), built for shift data and dressed
   in the Shift card standard: .form-card banded titles on the panels, a
   .data-card table for Recent Shifts, status as colored text, meaning-only
   colors. Day-one state mirrors the other dashboards: a Get Started strip,
   placeholder tiles, and guided panels until a shift is logged. */

S.ShiftDashboard = {
  shifts()     { return ((App.shiftData && App.shiftData.sc_shifts) || []); },
  drops()      { return ((App.shiftData && App.shiftData.sc_cash_drops) || []); },
  variances()  { return ((App.shiftData && App.shiftData.sc_variances) || []); },
  list86()     { return ((App.shiftData && App.shiftData.sc_86_list) || []); },
  maint()      { return ((App.shiftData && App.shiftData.sc_maintenance) || []); },
  voidComps()  { return ((App.shiftData && App.shiftData.sc_void_comps) || []); },
  walkedTabs() { return ((App.shiftData && App.shiftData.sc_walked_tabs) || []); },
  drawers()    { return ((App.shiftData && App.shiftData.sc_drawers) || []); },
  templates()  { return ((App.shiftData && App.shiftData.sc_checklist_templates) || []); },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  weekAgo() {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return App.ymdLocal(d);
  },
  activeShift() {
    return [...this.shifts()]
      .filter(s => s.status === 'Open')
      .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())[0] || null;
  },

  // ── Shared bits (match the Inventory + Labor dashboards, in the Shift standard) ─
  metricCard(label, valHtml, target, cls) {
    return '<div class="metric-card"><div class="metric-label">' + label + '</div>'
      + '<div class="metric-val ' + (cls || '') + '">' + valHtml + '</div>'
      + '<div class="metric-target">' + target + '</div><div class="metric-trend"> </div></div>';
  },
  // A standard panel: a .form-card with a banded title (optionally a right-aligned
  // action in the title bar).
  panelCard(title, bodyHtml, titleRight) {
    return '<div class="card form-card" style="height:100%;">'
      + '<div class="card-title"' + (titleRight ? ' style="display:flex;align-items:center;justify-content:space-between;gap:12px;"' : '') + '>'
      + '<span>' + title + '</span>' + (titleRight || '') + '</div>'
      + bodyHtml + '</div>';
  },
  actionBtn(id, label) {
    return '<button class="btn btn-primary sd-act" data-go="' + id + '" style="flex:1;min-width:150px;">' + label + '</button>';
  },
  quickActions() {
    return '<div style="margin-top:20px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Quick Actions</div>'
      + '<div style="border-top:1px solid var(--b2);padding-top:14px;display:flex;gap:10px;flex-wrap:wrap;">'
      + this.actionBtn('sc-active-shift', 'Open the Floor')
      + this.actionBtn('sc-cash-control', 'Cash Board')
      + this.actionBtn('sc-86-list', '86 List')
      + this.actionBtn('sc-reports', 'Reports')
      + '</div></div>';
  },
  row(a, b) {
    return '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">'
      + '<div style="flex:1 1 300px;min-width:0;">' + a + '</div>'
      + '<div style="flex:1 1 280px;min-width:0;">' + b + '</div></div>';
  },

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    if (this.shifts().length === 0) this.renderDayOne();
    else this.renderFull();
    this.container.onclick = ev => {
      const act = ev.target.closest('.sd-act');
      if (act && act.dataset.go) { App.navigate(act.dataset.go); return; }
      const srow = ev.target.closest('.sd-srow');
      if (srow) App.navigate('sc-shift-history');
    };
  },

  // ── Day-one: the real layout in placeholder form + Get Started ────────────────
  renderDayOne() {
    const hasRegisters = this.drawers().filter(d => d.active !== false).length > 0;
    const hasTemplates = this.templates().length > 0;

    const step = (done, label, screen, current) =>
      '<div class="sd-act" data-go="' + screen + '" style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;min-width:170px;padding:10px 12px;border:1px solid ' + (current ? 'var(--gold)' : 'var(--b2)') + ';border-radius:6px;background:var(--input);">'
      + '<span style="width:18px;height:18px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;'
      + (done ? 'background:var(--gold);color:var(--bg);' : 'border:1px solid var(--t3);color:var(--t3);') + '">' + (done ? '&#10003;' : '') + '</span>'
      + '<span style="font-size:12px;font-weight:600;color:' + (current ? 'var(--gold)' : 'var(--t1)') + ';">' + label + '</span></div>';

    const startStrip = '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Get Started</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">Three steps and this dashboard fills in with your shift revenue, cash variance, and open operational items.</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;">'
      + step(hasRegisters, '1. Set up registers', 'sc-drawers', !hasRegisters)
      + step(hasTemplates, '2. Build checklists', 'sc-checklist-templates', hasRegisters && !hasTemplates)
      + step(false, '3. Open the floor', 'sc-active-shift', hasRegisters && hasTemplates)
      + '</div></div>';

    const cards =
        this.metricCard('Revenue, Last 7 Days', '$0', 'After your first shift')
      + this.metricCard('Covers, Last 7 Days', '&mdash;', 'After your first shift')
      + this.metricCard('Cash Over/Short, 7d', '&mdash;', 'After you count a drawer')
      + this.metricCard('Open Items', '0', 'Nothing 86\'d or open');

    const heroBody = '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.6;">No shift running yet. Open the floor to track cash, voids, and 86s live, then close it out with revenue and covers.</div>'
      + '<button class="btn btn-primary btn-sm sd-act" data-go="sc-active-shift" style="margin:0;">Open the Floor</button></div>';
    const hero = this.panelCard('Active Shift', heroBody);

    const emptyBody = msg => '<div style="font-size:12px;color:var(--t3);line-height:1.6;">' + msg + '</div>';
    const revCard   = this.panelCard('Revenue by Daypart', emptyBody('Once shifts are logged, your revenue splits by daypart here.'));
    const excCard   = this.panelCard('Exceptions This Week', emptyBody('Voids, comps, and walked tabs roll up here as you log them.'));
    const recent    = this.panelCard('Recent Shifts', emptyBody('Every shift you run lands here, newest first.'));
    const watchCard = this.panelCard('Shift Watch', emptyBody('Cash shorts, out-of-tolerance drawers, urgent maintenance, and 86\'d items surface here.'));

    this.container.innerHTML = '<div class="screen">'
      + startStrip
      + '<div class="metric-grid">' + cards + '</div>'
      + '<div style="margin-bottom:16px;">' + hero + '</div>'
      + this.row(revCard, excCard)
      + this.row(recent, watchCard)
      + this.quickActions()
      + '</div>';
  },

  // ── Populated dashboard ──────────────────────────────────────────────────────
  renderFull() {
    const cutoff = this.weekAgo();
    const wkShifts = this.shifts().filter(s => (s.date || '') >= cutoff);
    const wkRevenue = wkShifts.reduce((t, s) => t + (s.total_revenue || 0), 0);
    const wkCovers = wkShifts.reduce((t, s) => t + (s.covers || 0), 0);
    const wkVar = this.variances().filter(v => (v.date || '') >= cutoff);
    const netVar = wkVar.reduce((t, v) => t + (v.variance || 0), 0);
    const shortCount = wkVar.filter(v => v.status === 'Short').length;
    const ootCount = wkVar.filter(v => v.status === 'Over' || v.status === 'Short').length;
    const active86 = this.list86().filter(i => i.status !== 'Back');
    const openMaint = this.maint().filter(m => m.status !== 'Resolved');
    const urgentMaint = openMaint.filter(m => m.priority === 'Urgent');
    const active = this.activeShift();

    // Exceptions in the last 7 days.
    const wkVC = this.voidComps().filter(r => (r.date || '') >= cutoff);
    const voids = wkVC.filter(r => r.type === 'Void');
    const comps = wkVC.filter(r => r.type === 'Comp');
    const voidTot = voids.reduce((t, r) => t + (r.amount || 0), 0);
    const compTot = comps.reduce((t, r) => t + (r.amount || 0), 0);
    const wkWalked = this.walkedTabs().filter(r => (r.date || '') >= cutoff);
    const walkedTot = wkWalked.reduce((t, r) => t + (parseFloat(r.amount) || 0), 0);

    // ── KPI tiles ──
    const cards =
        this.metricCard('Revenue, Last 7 Days', App.fmtCurrency(wkRevenue),
             wkShifts.length + ' shift' + (wkShifts.length === 1 ? '' : 's') + ' logged')
      + this.metricCard('Covers, Last 7 Days', String(wkCovers),
             wkCovers > 0 ? App.fmtCurrency(wkRevenue / wkCovers) + ' avg check' : 'No covers logged')
      + this.metricCard('Cash Over/Short, 7d', (netVar >= 0 ? '+' : '') + App.fmtCurrency(netVar),
             wkVar.length + ' variance' + (wkVar.length === 1 ? '' : 's') + ' logged', netVar < 0 ? 'over-target' : 'on-target')
      + this.metricCard('Open Items', String(active86.length + openMaint.length),
             active86.length + ' 86\'d &middot; ' + openMaint.length + ' maintenance', (active86.length + openMaint.length) ? 'over-target' : 'on-target');

    // ── Active Shift hero (full width) ──
    let hero;
    if (active) {
      const right = '<button class="btn btn-primary btn-sm sd-act" data-go="sc-active-shift" style="margin:0;">Open Active Shift</button>';
      const body = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">'
        + '<span style="width:9px;height:9px;border-radius:50%;background:var(--gold);box-shadow:0 0 8px var(--gold);"></span>'
        + '<span style="font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">Shift Running</span></div>'
        + '<div style="font-size:18px;font-weight:800;color:var(--t1);">' + esc(active.shift_type || 'Shift') + ' &middot; ' + this.fmtDate(active.date) + '</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-top:3px;">' + (active.manager ? 'Manager: ' + esc(active.manager) : 'Open the active shift to manage the floor') + '</div>';
      hero = this.panelCard('Active Shift', body, right);
    } else {
      const right = '<button class="btn btn-primary btn-sm sd-act" data-go="sc-active-shift" style="margin:0;">Open the Floor</button>';
      const body = '<div style="font-size:13px;color:var(--t2);line-height:1.6;">No shift running right now. Open the floor to track cash, voids, and 86s live, then close it out with revenue and covers.</div>';
      hero = this.panelCard('Active Shift', body, right);
    }

    // ── Revenue by Daypart (bar chart, last 7 days) ──
    const byDaypart = {};
    wkShifts.forEach(s => { const k = s.shift_type || 'Unspecified'; byDaypart[k] = (byDaypart[k] || 0) + (s.total_revenue || 0); });
    const dpRows = Object.entries(byDaypart).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);
    const dpMax = dpRows.length ? dpRows[0][1] : 1;
    const revBody = dpRows.length
      ? dpRows.map(([k, v]) => {
          const pct = Math.max(2, Math.round(v / dpMax * 100));
          return '<div style="margin-bottom:11px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">'
            + '<span style="color:var(--t2);">' + esc(k) + '</span><span style="color:var(--t1);font-weight:600;">' + App.fmtCurrency(v) + '</span></div>'
            + '<div style="height:7px;background:var(--input);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--gold);"></div></div></div>';
        }).join('')
      : '<div style="font-size:12px;color:var(--t3);">No revenue logged in the last 7 days.</div>';
    const revCard = this.panelCard('Revenue by Daypart', revBody);

    // ── Exceptions This Week (info list) ──
    const excLine = (label, val, sub) =>
      '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;">'
      + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t1);">' + label + (sub ? '<span style="color:var(--t3);"> &middot; ' + sub + '</span>' : '') + '</div>'
      + '<div style="font-size:13px;font-weight:600;color:var(--t1);white-space:nowrap;">' + val + '</div></div>';
    const anyExc = voids.length || comps.length || wkWalked.length;
    const excBody = anyExc
      ? excLine('Voids', App.fmtCurrency(voidTot), voids.length + ' logged')
        + excLine('Comps', App.fmtCurrency(compTot), comps.length + ' logged')
        + excLine('Walked Tabs', App.fmtCurrency(walkedTot), wkWalked.length + ' logged')
      : '<div style="font-size:12px;color:var(--gold);">No voids, comps, or walked tabs this week. Clean.</div>';
    const excCard = this.panelCard('Exceptions This Week', excBody);

    // ── Recent Shifts (data-card table + .sh heading) ──
    const recent = [...this.shifts()]
      .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())
      .slice(0, 6);
    const recentRows = recent.map(s => '<tr class="sd-srow" data-id="' + s.id + '" style="cursor:pointer;">'
      + '<td><div class="val">' + this.fmtDate(s.date) + '</div></td>'
      + '<td>' + esc(s.shift_type || '-') + '</td>'
      + '<td class="val">' + App.fmtCurrency(s.total_revenue || 0) + '</td>'
      + '<td>' + (s.covers != null ? s.covers : '-') + '</td>'
      + '<td>' + (s.status === 'Open'
          ? '<span style="color:var(--gold);font-weight:700;">Open</span>'
          : '<span style="color:var(--t3);font-weight:700;">Closed</span>') + '</td></tr>').join('');
    const recentBlock = '<div class="sh" style="margin:0 0 10px;">Recent Shifts</div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Shift</th><th>Revenue</th><th>Covers</th><th>Status</th>'
      + '</tr></thead><tbody>' + recentRows + '</tbody></table></div></div>';

    // ── Shift Watch (leaks-style, tappable) ──
    const watchRow = (label, val, screen, warn) =>
      '<div class="sd-act" data-go="' + screen + '" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--b2);cursor:pointer;">'
      + '<span style="font-size:12px;color:var(--t2);">' + label + '</span>'
      + '<span style="font-size:13px;font-weight:600;color:' + (warn ? 'var(--red)' : 'var(--t1)') + ';">' + val + ' &rsaquo;</span></div>';
    const anyWatch = shortCount > 0 || ootCount > 0 || urgentMaint.length > 0 || openMaint.length > 0 || active86.length > 0;
    const watchBody = watchRow('Cash short (7d)', String(shortCount), 'sc-cash-history', shortCount > 0)
      + watchRow('Out of tolerance (7d)', String(ootCount), 'sc-cash-history', ootCount > 0)
      + watchRow('Urgent maintenance (open)', String(urgentMaint.length), 'sc-maintenance', urgentMaint.length > 0)
      + watchRow('Open maintenance', String(openMaint.length), 'sc-maintenance', openMaint.length > 0)
      + watchRow('Currently 86\'d', String(active86.length), 'sc-86-list', active86.length > 0)
      + (anyWatch ? '<div style="font-size:11px;color:var(--t3);margin-top:8px;">Tap any line to dig in.</div>'
                  : '<div style="font-size:11px;color:var(--gold);margin-top:8px;">All clear. No open shift issues.</div>');
    const watchCard = this.panelCard('Shift Watch', watchBody);

    this.container.innerHTML = '<div class="screen">'
      + '<div class="metric-grid">' + cards + '</div>'
      + '<div style="margin-bottom:16px;">' + hero + '</div>'
      + this.row(revCard, excCard)
      + this.row(recentBlock, watchCard)
      + this.quickActions()
      + '</div>';
  }
};
