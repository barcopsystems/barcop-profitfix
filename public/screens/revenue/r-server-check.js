'use strict';

/* ── Revenue Recovery — Server Check + Server Scorecard ───────────────────────
   One screen owns server-side performance end-to-end. A window selector (on the
   scorecard heading row) drives the stat strip + per-server scorecard + the
   Server Shift list. Top is the stat strip, then the New Shift Check form (logs
   one server's covers and sales, with auto staff_id + shift_id capture), then the
   per-server Scorecard (data-card, exportable), then the Server Shift list.

   Roster comes from lc_staff via App.staffOptions (audience 'service'). Comps
   flow in from sc_void_comps via staff_id; tips from lc_tip_pools / lc_tips via
   staff_id + shift_id. The operator never enters the same thing twice. */

S.RevenueServerCheck = {
  _calc: null,
  _entryId: null,
  _saving: false,
  _form: null,
  _window: '30',
  WINDOW_CHIPS: [
    { v: '7', label: 'Last 7 Days' },
    { v: '30', label: 'Last 30 Days' },
    { v: '90', label: 'Last 90 Days' },
    { v: 'all', label: 'All Time' }
  ],
  windowDays() { return this._window === 'all' ? 36500 : (parseInt(this._window) || 30); },

  // Shared 9-column layout so the scorecard and the Server Shift log line up
  // column-for-column: 8 even data columns plus a wider trailing action column.
  COLGROUP: '<colgroup><col style="width:10.75%;"/><col style="width:10.75%;"/><col style="width:10.75%;"/><col style="width:10.75%;"/><col style="width:10.75%;"/><col style="width:10.75%;"/><col style="width:10.75%;"/><col style="width:10.75%;"/><col style="width:14%;"/></colgroup>',

  printBlank() {
    App.printBlankSheet({
      title: 'Server Shift Check Sheet',
      subtitle: 'Capture server covers and sales during shift. Manager enters into Bar Cop after close.',
      columns: [
        { label: 'Date',         width: '10%' },
        { label: 'Shift',        width: '10%' },
        { label: 'Server',       width: '20%' },
        { label: 'Covers',       width: '10%' },
        { label: 'Total Sales',  width: '15%' },
        { label: 'Check Avg',    width: '10%' },
        { label: 'Notes',        width: '25%' }
      ],
      rows: 14
    });
  },

  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
  shifts() { return ((App.shiftData && App.shiftData.sc_shifts) || []); },

  // Active shift on a given date (most recent open). Used for shift_id capture.
  activeShiftFor(date, shiftType) {
    return this.shifts().filter(s => s.date === date && (!shiftType || s.shift_type === shiftType))
      .sort(App.cmpNewest)[0] || null;
  },

  // ── Scorecard computation (per-server metrics over the last N days) ──────────
  computeScorecard(windowDays) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - (windowDays || 30));
    const cutoffStr = App.ymdLocal(cutoff);
    const checks = (App.data.revenue_server_checks || []).filter(c => (c.date || '') >= cutoffStr);
    const voids  = ((App.shiftData && App.shiftData.sc_void_comps) || []).filter(r => r.type === 'Comp' && (r.date || '') >= cutoffStr);
    const pools  = ((App.laborData && App.laborData.lc_tip_pools)  || []).filter(p => (p.date || '') >= cutoffStr);
    const tips   = ((App.laborData && App.laborData.lc_tips)       || []).filter(t => (t.date || '') >= cutoffStr);

    const byId = {};
    const pushTo = (map, key, fn) => { if (!map[key]) map[key] = fn(); return map[key]; };

    checks.forEach(c => {
      const id = c.staff_id;
      if (!id) return;  // pre-Rule 20 entries without staff_id are dropped
      const name = (this.staffById(id)?.name) || c.server_name || '(unknown)';
      const rec  = pushTo(byId, id, () => ({ staff_id: id, name, entries: 0, covers: 0, sales: 0, comp_total: 0, tip_total: 0, checks: [] }));
      rec.entries++;
      rec.covers += parseFloat(c.covers) || 0;
      rec.sales  += parseFloat(c.sales)  || 0;
      rec.checks.push({ date: c.date, covers: parseFloat(c.covers) || 0, sales: parseFloat(c.sales) || 0 });
    });

    voids.forEach(v => { if (v.staff_id && byId[v.staff_id]) byId[v.staff_id].comp_total += parseFloat(v.amount) || 0; });

    // Tips: pools first (preferred), then lc_tips for staff whose tips didn't go
    // through a pool. Same priority as Form 8027.
    const poolStaffIds = new Set();
    pools.forEach(p => (p.participants || []).forEach(pt => {
      if (pt.staff_id && byId[pt.staff_id]) { byId[pt.staff_id].tip_total += parseFloat(pt.share) || 0; poolStaffIds.add(pt.staff_id + '|' + p.date); }
    }));
    tips.forEach(t => {
      if (!t.staff_id || !byId[t.staff_id]) return;
      if (poolStaffIds.has(t.staff_id + '|' + t.date)) return;
      byId[t.staff_id].tip_total += parseFloat(t.total_tips) || ((parseFloat(t.cash_tips) || 0) + (parseFloat(t.card_tips) || 0));
    });

    // Derived stats + trend (last-7 vs prior-7 check avg).
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const lastWeekCutoff = new Date(today); lastWeekCutoff.setDate(lastWeekCutoff.getDate() - 7);
    const priorWeekCutoff = new Date(today); priorWeekCutoff.setDate(priorWeekCutoff.getDate() - 14);
    const all = Object.values(byId).map(rec => {
      const checkAvg = rec.covers > 0 ? rec.sales / rec.covers : 0;
      const compsPct = rec.sales > 0 ? (rec.comp_total / rec.sales) * 100 : 0;
      const tipsPct  = rec.sales > 0 ? (rec.tip_total  / rec.sales) * 100 : 0;
      const lastWeek = rec.checks.filter(c => new Date((c.date || '') + 'T00:00:00') >= lastWeekCutoff);
      const priorWeek = rec.checks.filter(c => { const d = new Date((c.date || '') + 'T00:00:00'); return d >= priorWeekCutoff && d < lastWeekCutoff; });
      const avgOf = arr => { const cov = arr.reduce((s, c) => s + c.covers, 0); const sal = arr.reduce((s, c) => s + c.sales, 0); return cov > 0 ? sal / cov : 0; };
      const lastAvg = avgOf(lastWeek), priorAvg = avgOf(priorWeek);
      let trend = 'flat';
      if (lastAvg > 0 && priorAvg > 0) { const diff = (lastAvg - priorAvg) / priorAvg; if (diff <= -0.10) trend = 'down'; else if (diff >= 0.10) trend = 'up'; }
      return { ...rec, checkAvg, compsPct, tipsPct, lastAvg, priorAvg, trend };
    }).sort((a, b) => b.checkAvg - a.checkAvg);

    const teamCovers = all.reduce((s, r) => s + r.covers, 0);
    const teamSales  = all.reduce((s, r) => s + r.sales,  0);
    const teamAvg    = teamCovers > 0 ? teamSales / teamCovers : 0;
    return { rows: all, teamAvg, teamCovers, teamSales, windowDays: windowDays || 30 };
  },

  freshForm() {
    const active = (App.activeShift && App.activeShift()) || null;
    const byTime = App.servicePeriodByTime ? App.servicePeriodByTime() : null;
    const shift = active && active.shift_type ? active.shift_type : (byTime ? byTime.name : (App.SHIFT_TYPES[0] || 'Dinner'));
    return { date: App.todayLocal(), shift, server: '', cov: '', sales: '' };
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    if (actions) actions.innerHTML = '';
    if (!this._window) this._window = '30';
    if (!this._entryId) this._entryId = App.uid();
    if (!this._form) this._form = this.freshForm();
    this._calc = null;
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How Server Check Works', [
      { p: ['Log each server\'s covers and sales for a shift; Bar Cop turns it into a check average and tracks every server against your target. Comps pull in from Shift Control\'s Void and Comp log and tips from Tip Tracking, so you never enter the same number twice.'] },
      { h: 'The Window', p: ['The chips set the window for the scorecard and the Server Shift list: the last 7, 30 or 90 days, or all time. The team average, top performer, who is trending down, and the spread top to bottom all reflect the window you pick.'] },
      { h: 'Logging a Check', p: ['Pick the date, shift and server, enter covers and total sales, and the check average shows live against target before you save. An open shift for that date and service period links automatically. If your POS exports a per-server sales report, you can skip the hand entry: drop it at your Shift weekly close and every server\'s covers and sales land here at once. Worksheet prints a blank sheet to capture checks on paper during service and enter after close. Every logged check lists in the Server Shift log below: Edit loads one back into the form to correct it, and Delete removes a row.'] },
      { h: 'The Scorecard', p: ['Per server: check average against target and against the team, covers, sales, comps and tips as a percent of sales, and a trend arrow comparing the last 7 days to the prior 7. TOP and DOWN call out the leader and anyone slipping. Add a coaching note on any row to log it on that server in Labor Control.'] }
    ]);
  },

  // ── Stat strip ──────────────────────────────────────────────────────────────
  statStrip(sc, targetCA) {
    const has = sc.rows.length;
    const top = has ? sc.rows[0] : null;
    const downCount = sc.rows.filter(r => r.trend === 'down').length;
    const spread = sc.rows.length > 1 ? (sc.rows[0].checkAvg - sc.rows[sc.rows.length - 1].checkAvg) : 0;
    const item = (label, val, sub, color) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg"' + (color ? ' style="color:' + color + ';"' : '') + '>' + val + '</div>'
      + (sub ? '<div style="font-size:11px;color:var(--t3);margin-top:3px;">' + sub + '</div>' : '') + '</div>';
    return '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + item('Team Average', has ? App.fmtCurrency(sc.teamAvg) : '-', 'target ' + App.fmtCurrency(targetCA), has ? (sc.teamAvg >= targetCA ? null : 'var(--red)') : null)
      + item('Top Performer', top ? App.fmtCurrency(top.checkAvg) : '-', top ? esc(top.name) : 'no data yet', null)
      + item('Trending Down', has ? String(downCount) : '-', downCount > 0 ? 'off pace last 7 days' : 'none off pace', downCount > 0 ? 'var(--red)' : null)
      + item('Spread', has ? App.fmtCurrency(spread) : '-', 'top vs bottom', spread > 10 ? 'var(--red)' : null)
      + '</div></div>';
  },

  // ── Shared form body (fields + live check-average box), id-prefixed so the
  //    always-on New form (rsc) and the Edit modal (rscm) never clash. ──────────
  formBody(f, targetCA, p, narrow) {
    const hasServers = this.staff().some(s => s.status !== 'Inactive' && App.isService && App.isService(s));
    const serverOpts = App.staffOptions(f.server || '', { audience: 'service', placeholder: hasServers ? 'Select server...' : 'Add Bar or Front of House staff in Labor Control' });
    const shiftOpts = (App.SHIFT_TYPES || ['Brunch', 'Lunch', 'Dinner', 'Late Night', 'Full Day'])
      .map(tp => '<option' + (f.shift === tp ? ' selected' : '') + '>' + esc(tp) + '</option>').join('');
    // narrow = the two-column modal layout (widths come from .narrow-form CSS);
    // otherwise the always-on page form flows as one fixed-width horizontal row.
    const w = px => narrow ? '' : (' style="width:' + px + ';flex-shrink:0;"');
    const rowOpen = narrow ? '<div class="form-row">' : '<div class="form-row" style="gap:14px;align-items:flex-end;flex-wrap:wrap;">';
    return rowOpen
        + '<div class="f"' + w('148px') + '><label>Date</label><input class="form-input" type="date" id="' + p + '-date" value="' + esc(f.date || '') + '"/></div>'
        + '<div class="f"' + w('150px') + '><label>Shift</label><select class="form-input" id="' + p + '-shift">' + shiftOpts + '</select></div>'
        + '<div class="f"' + w('220px') + '><label>Server</label><select class="form-input" id="' + p + '-server">' + serverOpts + '</select></div>'
        + '<div class="f"' + w('110px') + '><label>Covers</label><input class="form-input" type="number" id="' + p + '-cov" value="' + esc(f.cov || '') + '"/></div>'
        + '<div class="f"' + w('150px') + '><label>Total Sales</label><div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="' + p + '-sales" value="' + esc(f.sales || '') + '"/></div></div>'
      + '</div>'
      + '<div id="' + p + '-result" style="margin-top:16px;">'
        + '<div style="background:var(--input);border:1px solid var(--b-edge);border-radius:8px;padding:14px 18px;">'
          + '<div style="display:flex;align-items:center;gap:36px;flex-wrap:wrap;">'
            + '<div class="calc-item"><div class="calc-label">Check Average</div><div class="calc-val lg" id="' + p + '-ca">-</div></div>'
            + '<div class="calc-item"><div class="calc-label">Target</div><div class="calc-val lg" style="color:var(--t3);">$' + targetCA + '</div></div>'
            + '<div class="calc-item"><div class="calc-label">vs Target</div><div class="calc-val lg" id="' + p + '-var">-</div></div>'
            + '<div style="margin-left:auto;"><div id="' + p + '-badge" style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;"></div></div>'
          + '</div>'
        + '</div>'
      + '</div>';
  },

  // ── New Shift Check form (always-on, top of page; editing happens in a modal) ─
  renderForm(targetCA) {
    return '<div class="card form-card">'
      + App.collapsibleCardTitle('rsc-newcheck', 'New Shift Check')
      + '<div class="collapse-body">' + this.formBody(this._form, targetCA, 'rsc') + '</div>'
      + '</div>'
      + '<div data-collapse-group="rsc-newcheck" style="margin:16px 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="rsc-submit">Log Check</button>'
      + '<button class="btn btn-ghost" id="rsc-startover">Start Over</button>'
      + '<span id="rsc-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';
  },

  // Edit a logged check in a modal (not back up in the New form).
  openEditModal(id) {
    const c = (App.data.revenue_server_checks || []).find(x => x.id === id);
    if (!c) return;
    const targetCA = (App.data.revenue_settings?.targets || {}).check_avg || 35;
    const f = { date: c.date || '', shift: c.shift || '', server: c.staff_id || '', cov: c.covers != null ? String(c.covers) : '', sales: c.sales != null ? String(c.sales) : '' };
    const html = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">Edit Shift Check</div>'
      + this.formBody(f, targetCA, 'rscm', true)
      + '<div class="card-actions" style="margin-top:18px;"><button class="btn btn-primary" id="rscm-save">Update Check</button>'
      + '<span id="rscm-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span></div>'
      + '</div>';
    App.openModal(html, { id: 'rsc-edit-modal', maxWidth: 540 });
    document.getElementById('rscm-cov')?.addEventListener('input', () => this.calc('rscm'));
    document.getElementById('rscm-sales')?.addEventListener('input', () => this.calc('rscm'));
    document.getElementById('rscm-save')?.addEventListener('click', () => this.saveEdit(id));
    this.calc('rscm');
  },

  // ── Per-server scorecard (data-card, exportable) ─────────────────────────────
  scorecardSection(sc, targetCA) {
    const headingRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + App.filterChips(this._window, this.WINDOW_CHIPS, 'rsc-range-chip') + '</div>'
      + '<div style="display:flex;gap:8px;">'
        + '<button class="btn btn-ghost btn-sm" id="rsc-export">Export PDF</button>'
        + '<button class="btn btn-ghost btn-sm" id="rsc-worksheet">Worksheet</button>'
      + '</div></div>';
    if (!sc.rows.length) {
      return headingRow + '<div class="card"><div style="text-align:center;padding:22px;color:var(--t4);">No server data in this range. Log a shift check above, or import a per-server sales report at your Shift weekly close, to build the scorecard.</div></div>';
    }
    const rows = sc.rows.map((r, i) => {
      const vsT = r.checkAvg - targetCA;
      const vsTeam = r.checkAvg - sc.teamAvg;
      const isTop = i === 0;
      const isDown = r.trend === 'down';
      const tag = isTop ? ' <span style="font-size:9px;font-weight:800;letter-spacing:1px;color:var(--t3);">TOP</span>'
        : (isDown ? ' <span style="font-size:9px;font-weight:800;letter-spacing:1px;color:var(--red);">DOWN</span>' : '');
      // A small, unobtrusive "+ note" link on every row logs a manager note on
      // that server's record in Labor Control.
      const coachBtn = r.staff_id
        ? '<span class="rsc-coach" data-sid="' + esc(r.staff_id) + '" style="font-size:11px;color:var(--t3);cursor:pointer;white-space:nowrap;">+ coaching note</span>' : '';
      return '<tr>'
        + '<td style="font-weight:700;color:var(--t1);">' + esc(r.name) + tag + '</td>'
        + '<td class="val" style="color:' + (r.checkAvg >= targetCA ? 'var(--t1)' : 'var(--red)') + ';">' + App.fmtCurrency(r.checkAvg) + '</td>'
        + '<td style="color:' + (vsT >= 0 ? 'var(--t2)' : 'var(--red)') + ';">' + (vsT >= 0 ? '+' : '') + App.fmtCurrency(vsT) + '</td>'
        + '<td style="color:var(--t2);">' + (vsTeam >= 0 ? '+' : '') + App.fmtCurrency(vsTeam) + '</td>'
        + '<td>' + Math.round(r.covers) + '</td>'
        + '<td class="val">' + App.fmtCurrency(r.sales) + '</td>'
        + '<td>' + (r.compsPct > 0 ? r.compsPct.toFixed(1) + '%' : '-') + '</td>'
        + '<td>' + (r.tipsPct > 0 ? r.tipsPct.toFixed(1) + '%' : '-') + '</td>'
        + '<td class="no-print"><div class="row-actions">' + coachBtn + '</div></td>'
        + '</tr>';
    }).join('');
    return headingRow
      + '<div id="rsc-sc-export"><div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
      + this.COLGROUP
      + '<thead><tr>'
      + '<th>Server</th><th>Check Avg</th><th>vs Target</th><th>vs Team</th><th>Covers</th><th>Sales</th><th>Comps %</th><th>Tips %</th><th class="no-print"></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  },

  // ── Shift log (data-card) ────────────────────────────────────────────────────
  logSection(log, targetCA) {
    const shown = log.slice(0, App.listLimit('core', 'revenue_server_check'));
    return '<div class="sh" style="margin:24px 0 10px;">Server Shift</div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list" style="table-layout:fixed;width:100%;">'
      + this.COLGROUP
      + '<thead><tr>'
      + '<th>Date</th><th>Shift</th><th>Server</th><th>Covers</th><th>Sales</th><th>Check Avg</th><th>vs Target</th><th>Status</th><th class="no-print"></th>'
      + '</tr></thead><tbody id="rsc-log">' + this._buildRows(shown, targetCA) + '</tbody></table></div>'
      + App.showOlderBar('core', 'revenue_server_check', log, this._window !== 'all');
  },

  _buildRows(log, targetCA) {
    if (!log.length) return '<tr><td colspan="9" style="text-align:center;padding:28px;color:var(--t4);">No shift checks in this range.</td></tr>';
    return log.map(c => {
      const ca = c.covers > 0 ? c.sales / c.covers : 0;
      const diff = ca - targetCA;
      const color = diff >= 0 ? 'var(--t2)' : diff >= -5 ? 'var(--amber)' : 'var(--red)';
      const status = diff >= 0 ? 'On Target' : diff >= -5 ? 'Watch' : 'Below Standard';
      return '<tr>'
        + '<td>' + (c.date || '').slice(0, 10) + '</td>'
        + '<td>' + esc(c.shift || '') + '</td>'
        + '<td>' + esc(c.server_name || '') + '</td>'
        + '<td>' + Math.round(c.covers || 0) + '</td>'
        + '<td class="val">' + App.fmtCurrency(c.sales || 0) + '</td>'
        + '<td class="val">' + App.fmtCurrency(ca) + '</td>'
        + '<td style="color:' + color + ';">' + (diff >= 0 ? '+' : '') + App.fmtCurrency(diff) + '</td>'
        + '<td style="color:' + color + ';font-weight:600;">' + status + '</td>'
        + '<td class="no-print"><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm rsc-edit" data-id="' + c.id + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm rsc-del" data-id="' + c.id + '">Delete</button>'
        + '</div></td>'
        + '</tr>';
    }).join('');
  },

  draw() {
    const t = App.data.revenue_settings?.targets || {};
    const targetCA = t.check_avg || 35;
    const win = this.windowDays();
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - win);
    const cutoffStr = App.ymdLocal(cutoff);
    const scorecard = this.computeScorecard(win);
    const log = (App.data.revenue_server_checks || [])
      .filter(c => (c.date || '') >= cutoffStr)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    this.container.innerHTML = '<div class="screen">'
      + this.statStrip(scorecard, targetCA)
      + this.renderForm(targetCA)
      + this.scorecardSection(scorecard, targetCA)
      + this.logSection(log, targetCA)
      + '</div>';

    this.wire();
    this.calc();
  },

  captureForm() {
    const v = id => document.getElementById(id)?.value ?? '';
    this._form = { date: v('rsc-date'), shift: v('rsc-shift'), server: v('rsc-server'), cov: v('rsc-cov'), sales: v('rsc-sales') };
  },

  // ── Wiring (re-run each draw; per-element listeners, no container stacking) ───
  wire() {
    const c = this.container;
    const collapseHead = c.querySelector('.card-collapse-head');
    if (collapseHead) collapseHead.addEventListener('click', () => App.toggleCollapse(collapseHead));
    App.applyCollapsed(c);
    c.querySelectorAll('.rsc-range-chip').forEach(b => b.addEventListener('click', () => { this.captureForm(); this._window = b.dataset.v; this.draw(); }));
    c.querySelectorAll('[data-show-older]').forEach(b => b.addEventListener('click', () => App.handleShowOlder(b, () => this.draw())));
    document.getElementById('rsc-worksheet')?.addEventListener('click', () => this.printBlank());
    document.getElementById('rsc-export')?.addEventListener('click', () => App.exportPDF({ title: 'Server Performance', root: document.getElementById('rsc-sc-export') || c }));

    ['rsc-date', 'rsc-shift', 'rsc-server'].forEach(id => document.getElementById(id)?.addEventListener('change', () => this.captureForm()));
    document.getElementById('rsc-cov')?.addEventListener('input', () => { this.captureForm(); this.calc(); });
    document.getElementById('rsc-sales')?.addEventListener('input', () => { this.captureForm(); this.calc(); });
    document.getElementById('rsc-submit')?.addEventListener('click', () => {
      if (this._saving) return;
      this._saving = true; setTimeout(() => { this._saving = false; }, 1500);
      this.captureForm(); this.calc(); this.save();
    });
    document.getElementById('rsc-startover')?.addEventListener('click', () => { this._form = this.freshForm(); this._entryId = App.uid(); this._calc = null; this.draw(); });

    c.querySelectorAll('.rsc-coach').forEach(btn => btn.addEventListener('click', () => {
      // Open the canonical coaching-note form in place (writes to this server's
      // coaching log in Labor); re-draw Server Check on save. No section jump.
      if (!S.LaborStaffRoster) return;
      S.LaborStaffRoster.noteEditId = null;
      S.LaborStaffRoster.openNoteModal(btn.dataset.sid, { onSaved: () => this.draw() });
    }));
    c.querySelectorAll('.rsc-edit').forEach(btn => btn.addEventListener('click', () => this.openEditModal(btn.dataset.id)));
    c.querySelectorAll('.rsc-del').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await App.confirmDelete();
      if (!ok) return;
      await App.removeRecord('core', 'revenue_server_check', btn.dataset.id);
      this.draw();
    }));
  },

  calc(p) {
    p = p || 'rsc';
    const cov = parseFloat(document.getElementById(p + '-cov')?.value) || 0;
    const sales = parseFloat(document.getElementById(p + '-sales')?.value) || 0;
    const target = App.data.revenue_settings?.targets?.check_avg || 35;
    const caEl = document.getElementById(p + '-ca');
    const vEl  = document.getElementById(p + '-var');
    const bEl  = document.getElementById(p + '-badge');
    if (!caEl) return;
    // The box is always visible; it reads "-" until covers and sales are entered.
    if (cov === 0 || sales === 0) {
      caEl.textContent = '-'; caEl.style.color = 'var(--t1)';
      if (vEl) { vEl.textContent = '-'; vEl.style.color = 'var(--t1)'; }
      if (bEl) bEl.textContent = '';
      this._calc = null;
      return;
    }
    const ca = sales / cov;
    const diff = ca - target;
    let status, color;
    if (diff >= 0)       { status = 'On Target';      color = 'var(--t2)'; }
    else if (diff >= -5) { status = 'Watch';          color = 'var(--amber)'; }
    else                 { status = 'Below Standard'; color = 'var(--red)'; }
    caEl.textContent = App.fmtCurrency(ca); caEl.style.color = color;
    if (vEl) { vEl.textContent = (diff >= 0 ? '+' : '') + App.fmtCurrency(diff); vEl.style.color = color; }
    if (bEl) { bEl.textContent = status; bEl.style.color = color; }
    this._calc = { ca, diff, status };
  },

  save() {
    const f = this._form || {};
    const err = document.getElementById('rsc-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (err) err.style.display = 'none';
    const cov = parseFloat(f.cov) || 0;
    const sales = parseFloat(f.sales) || 0;
    if (!cov || !sales) { fail('Enter covers and total sales before saving.'); return; }
    const byId = this.staffById(f.server);
    if (!byId) { fail('Pick a server.'); return; }

    const matchShift = this.activeShiftFor(f.date, f.shift);
    const entry = {
      id:          this._entryId,
      date:        f.date,
      shift:       f.shift,
      shift_id:    matchShift ? matchShift.id : '',
      staff_id:    byId.id,
      server_name: byId.name,
      covers:      cov,
      sales,
      saved_at:    new Date().toISOString()
    };
    App.putRecord('core', 'revenue_server_check', entry).then(() => {
      this._form = this.freshForm();
      this._entryId = App.uid();
      this._calc = null;
      this.draw();
    });
  },

  // Save an edit made in the modal (reads the rscm-* fields directly).
  saveEdit(id) {
    const v = k => document.getElementById(k)?.value ?? '';
    const err = document.getElementById('rscm-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (err) err.style.display = 'none';
    const cov = parseFloat(v('rscm-cov')) || 0;
    const sales = parseFloat(v('rscm-sales')) || 0;
    if (!cov || !sales) return fail('Enter covers and total sales before saving.');
    const staff = this.staffById(v('rscm-server'));
    if (!staff) return fail('Pick a server.');
    const c = (App.data.revenue_server_checks || []).find(x => x.id === id);
    if (!c) return;
    const date = v('rscm-date'), shift = v('rscm-shift');
    const matchShift = this.activeShiftFor(date, shift);
    const entry = {
      ...c,
      date, shift,
      shift_id:    matchShift ? matchShift.id : (c.shift_id || ''),
      staff_id:    staff.id,
      server_name: staff.name,
      covers:      cov,
      sales,
      saved_at:    new Date().toISOString()
    };
    App.putRecord('core', 'revenue_server_check', entry).then(() => { App.closeModal('rsc-edit-modal'); this.draw(); });
  }
};
