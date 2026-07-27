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
  _impFlash: null,   // one-shot result line for the per-server import
  _entryMode: 'manual',   // New Shift Check card: 'manual' form or 'import' drop
  _window: '30',
  WINDOW_CHIPS: [
    { v: '7', label: 'Last 7 Days' },
    { v: '30', label: 'Last 30 Days' },
    { v: '90', label: 'Last 90 Days' },
    { v: 'all', label: 'All Time' }
  ],
  windowDays() { return this._window === 'all' ? 36500 : (parseInt(this._window) || 30); },
  // Covers a server needs before they can win/lose the Top Performer and Spread TILES. Not a
  // scoring rule — every server is listed in the scorecard table regardless. See statStrip.
  MIN_TILE_COVERS: 10,
  // The chip label, so the PDF can say which window it covers. One source, so the export can
  // never name a different period than the chips do.
  windowLabel() {
    const chip = (this.WINDOW_CHIPS || []).find(w => w.v === this._window);
    return chip ? chip.label : 'Last 30 Days';
  },

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
    /* ⚠⚠ EVERY WINDOW NEEDS AN UPPER BOUND. The filter was `date >= cutoff` and nothing else, so a
       row dated in the FUTURE sat inside every window at once — the 7-day chip, the 90-day chip and
       All Time all counted it. Measured on this fixture: one mistyped year (2027) at 40 covers /
       $4,000 moved the Last 7 Days team average from a true $35.00 to $56.67 and team sales from
       $2,800 to $6,800. A single wrong character in one cell should not be able to move the whole
       scorecard, and the operator has no way to tell from the tiles that it did.
       ⚠ The row is EXCLUDED FROM THE MATH BUT STAYS IN THE LOG (see draw()), because a row that
       cannot be seen cannot be corrected — the same reasoning the dateless-save guard carries. */
    const todayStr = App.todayLocal();
    const inWin = d => { const s = d || ''; return s >= cutoffStr && s <= todayStr; };
    const allChecks = (App.data.revenue_server_checks || []);
    const checks = allChecks.filter(c => inWin(c.date));
    const future = allChecks.filter(c => (c.date || '') > todayStr).length;
    const voids  = ((App.shiftData && App.shiftData.sc_void_comps) || []).filter(r => r.type === 'Comp' && App.compReasonIsLoss(r.reason || r.category) && inWin(r.date));   // give-away comps only, not Staff Meal/Shift Drink (policy expense) — matches the Void/Comp Log's % and Theft Risk
    const pools  = ((App.laborData && App.laborData.lc_tip_pools)  || []).filter(p => inWin(p.date));
    const tips   = ((App.laborData && App.laborData.lc_tips)       || []).filter(t => inWin(t.date));

    const byId = {};
    const pushTo = (map, key, fn) => { if (!map[key]) map[key] = fn(); return map[key]; };

    /* ⚠ A CHECK WITH NO staff_id IS DROPPED HERE AND KEPT BY THE LOG, so the two halves of one
       screen disagreed and nothing said so: a legacy or restored row printed its covers and sales
       in the Server Shift list while being in NONE of the tiles above it. It stays out of the math
       (there is no server to attribute it to), but the count now travels so the screen can say so
       instead of leaving the operator to reconcile two numbers that cannot be reconciled. */
    let unattributed = 0;
    checks.forEach(c => {
      const id = c.staff_id;
      if (!id) { unattributed++; return; }  // pre-Rule 20 entries without staff_id are not scored
      const name = (this.staffById(id)?.name) || c.server_name || '(unknown)';
      const rec  = pushTo(byId, id, () => ({ staff_id: id, name, entries: 0, covers: 0, sales: 0, comp_total: 0, tip_total: 0, checks: [] }));
      rec.entries++;
      rec.covers += parseFloat(c.covers) || 0;
      rec.sales  += parseFloat(c.sales)  || 0;
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

    /* ⚠⚠ THE TREND MUST NOT BE READ OUT OF THE CHOSEN WINDOW. `rec.checks` was filled from the
       WINDOWED rows, and the prior-7 bucket (today-14 .. today-7) falls ENTIRELY OUTSIDE a 7-day
       window — so on the 7 chip `priorAvg` was always 0, `lastAvg > 0 && priorAvg > 0` never passed,
       and the arrow was pinned flat. Measured: three servers each halving their check average week
       over week produced 0 "Trending Down" on the 7 chip and 3 on every other chip, under a help
       line that promises "a trend arrow comparing the last 7 days to the prior 7" and a tile that
       reads "off pace last 7 days". The chip the operator is most likely to be on was the one chip
       that could not report a decline.
       The trend IS that fixed comparison at every chip, so it is built from its own 14-day slice.
       Who gets LISTED is still decided by the window; this only decides their arrow. */
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const lastWeekCutoff = new Date(today); lastWeekCutoff.setDate(lastWeekCutoff.getDate() - 7);
    const priorWeekCutoff = new Date(today); priorWeekCutoff.setDate(priorWeekCutoff.getDate() - 14);
    const trendFrom = App.ymdLocal(priorWeekCutoff);
    allChecks.forEach(c => {
      const rec = c.staff_id && byId[c.staff_id];
      if (!rec) return;
      const d = c.date || '';
      if (d < trendFrom || d > todayStr) return;   // same upper bound: a future row trends nothing
      rec.checks.push({ date: d, covers: parseFloat(c.covers) || 0, sales: parseFloat(c.sales) || 0 });
    });
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
    // `future` and `unattributed` are rows this scorecard deliberately did not count. Both are
    // RENDERED (draw + scorecardSection) — a field computed and read nowhere is a fix that never
    // shipped, so grep either name for its second occurrence before changing this line.
    return { rows: all, teamAvg, teamCovers, teamSales, windowDays: windowDays || 30, future, unattributed };
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
      { h: 'Logging a Check', p: ['Pick the date, shift and server, enter covers and total sales, and the check average shows live against target before you save. An open shift for that date and service period links automatically. If your POS exports a per-server sales report, you can skip the hand entry: drop it right here on this page or at your Shift weekly close and every server\'s covers and sales land at once. Worksheet prints a blank sheet to capture checks on paper during service and enter after close. Every logged check lists in the Server Shift log below: Edit loads one back into the form to correct it, and Delete removes a row.'] },
      { h: 'The Scorecard', p: ['Per server: check average against target and against the team, covers, sales, comps and tips as a percent of sales, and a trend arrow comparing the last 7 days to the prior 7. TOP and DOWN call out the leader and anyone slipping. Add a coaching note on any row to log it on that server in Labor Control.'] }
    ]);
  },

  // ── Stat strip ──────────────────────────────────────────────────────────────
  statStrip(sc, targetCA) {
    const has = sc.rows.length;
    /* ⚠ TOP PERFORMER AND SPREAD RANKED ON CHECK AVERAGE WITH NO MATERIALITY FLOOR, so one thin row
       won both tiles. Measured: a single 1-cover / $240 walk-in tab printed Top Performer $240.00
       and a Spread of $211.99 against a real leader of $40.10. A tile is a COMPARISON, and a
       comparison needs a shift rather than one table. Everyone still appears in the scorecard TABLE
       below; only these two tiles apply the floor, and the Spread sub-label says so.
       ⚠ AND THE FLOOR HAS A FLOOR: if fewer than two servers clear it the tiles fall back to every
       row, so a quiet night or a two-person bar still gets numbers instead of dashes. A guard that
       refuses real data is a defect with a support call attached; this one degrades instead. */
    const ranked = sc.rows.filter(r => r.covers >= this.MIN_TILE_COVERS);
    const use = ranked.length > 1 ? ranked : sc.rows;
    const floored = use.length !== sc.rows.length;
    const top = use.length ? use[0] : null;
    const downCount = sc.rows.filter(r => r.trend === 'down').length;
    const spread = use.length > 1 ? (use[0].checkAvg - use[use.length - 1].checkAvg) : 0;
    const item = (label, val, sub, color) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div>'
      + '<div class="calc-val lg"' + (color ? ' style="color:' + color + ';"' : '') + '>' + val + '</div>'
      + (sub ? '<div style="font-size:11px;color:var(--t3);margin-top:3px;">' + sub + '</div>' : '') + '</div>';
    return '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + item('Team Average', has ? App.fmtCurrency(sc.teamAvg) : '-', 'target ' + App.fmtCurrency(targetCA), has ? (sc.teamAvg >= targetCA ? null : 'var(--red)') : null)
      + item('Top Performer', top ? App.fmtCurrency(top.checkAvg) : '-', top ? esc(top.name) : 'no data yet', null)
      + item('Trending Down', has ? String(downCount) : '-', downCount > 0 ? 'off pace last 7 days' : 'none off pace', downCount > 0 ? 'var(--red)' : null)
      + item('Spread', has ? App.fmtCurrency(spread) : '-', 'top vs bottom' + (floored ? ', ' + this.MIN_TILE_COVERS + '+ covers' : ''), spread > 10 ? 'var(--red)' : null)
      + '</div></div>';
  },

  // ── Shared form body (fields + live check-average box), id-prefixed so the
  //    always-on New form (rsc) and the Edit modal (rscm) never clash. ──────────
  formBody(f, targetCA, p, narrow) {
    const hasServers = this.staff().some(s => s.status !== 'Inactive' && App.isService && App.isService(s));
    const serverOpts = App.staffOptions(f.server || '', { audience: 'service', placeholder: hasServers ? 'Select server...' : 'Add Bar or Front of House staff in Labor Control' });
    /* ⚠⚠ EDITING AN IMPORTED CHECK SILENTLY REWROTE ITS SHIFT. `selected` was set only on an EXACT
       match and nothing preserved an off-list value — so a check imported carrying whatever the POS
       calls the daypart ("Happy Hour") rendered with NO option selected, the browser fell back to
       the FIRST one, and saving the edit wrote "Brunch". The operator corrects a cover count and
       Bar Cop changes the service period underneath them, with no message either way. It fires
       app-wide the day a service period is RENAMED, for every historical record on the old name.
       The sibling Server picker in this very form already handles this (App.staffOptions keeps an
       off-roster value rather than dropping the link, app.js) — the shift picker was the one door
       that did not. Step 0.5: same job, same hole, one line apart. */
    const periods = (App.SHIFT_TYPES || ['Brunch', 'Lunch', 'Dinner', 'Late Night', 'Full Day']);
    const curShift = f.shift || '';
    const shiftOpts = periods.map(tp => '<option' + (curShift === tp ? ' selected' : '') + '>' + esc(tp) + '</option>').join('')
      + (curShift && periods.indexOf(curShift) === -1
          ? '<option value="' + esc(curShift) + '" selected>' + esc(curShift) + ' (not on your shift list)</option>' : '');
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
            + '<div class="calc-item"><div class="calc-label">Target</div><div class="calc-val lg" style="color:var(--t3);">' + App.fmtCurrency(targetCA) + '</div></div>'
            + '<div class="calc-item"><div class="calc-label">vs Target</div><div class="calc-val lg" id="' + p + '-var">-</div></div>'
            + '<div style="margin-left:auto;"><div id="' + p + '-badge" style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;"></div></div>'
          + '</div>'
        + '</div>'
      + '</div>';
  },

  // ── New Shift Check form (always-on, top of page; editing happens in a modal) ─
  // Standard Enter Manually / Import File toggle: manual logs one check, import
  // drops a per-server file (same one the Shift close accepts) for the whole team.
  renderForm(targetCA) {
    const seg = this._checkSeg();
    if (this._entryMode === 'import') {
      return '<div class="card form-card">'
        + App.collapsibleCardTitle('rsc-newcheck', 'New Shift Check')
        + '<div class="collapse-body">' + seg
          + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px;">Drop a per-server sales export to build the whole team\'s scorecard at once, one row per server with covers and total sales. You can also drop it at your Shift weekly close.</div>'
          + '<div id="rsc-imp-csv"></div>' + this._impFlashHtml() + '</div>'
        + '</div>'
        + '<div id="rsc-imp-actions" style="margin:16px 0 24px;"></div>';
    }
    return '<div class="card form-card">'
      + App.collapsibleCardTitle('rsc-newcheck', 'New Shift Check')
      + '<div class="collapse-body">' + seg + this.formBody(this._form, targetCA, 'rsc') + '</div>'
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
    /* The rows this scorecard deliberately did NOT count, said out loud. Both kinds are still
       listed in the Server Shift log directly below — which is the only place they can be
       corrected — so without this line the tiles and the log simply disagree and nothing explains
       why. A future-dated row is a typo the operator can fix; an unattributed row cannot be
       attributed by Bar Cop, only re-entered. */
    const excl = [];
    if (sc.future) excl.push(sc.future + ' dated in the future');
    if (sc.unattributed) excl.push(sc.unattributed + ' with no server on the record');
    const exclNote = excl.length
      ? '<div class="no-print" style="font-size:11px;color:var(--amber);margin:-2px 0 10px;">'
        + 'Not counted in the scorecard: ' + excl.join(', ') + '. Fix them in the Server Shift log below.'
        + '</div>'
      : '';
    if (!sc.rows.length) {
      return headingRow + exclNote + '<div class="card"><div style="text-align:center;padding:22px;color:var(--t4);">No server data in this range. Log a shift check above, or drop a per-server sales report here or at your Shift weekly close, to build the scorecard.</div></div>';
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
        /* ⚠ `App.fmtCurrency` PREFIXES THE DOLLAR SIGN, so a raw negative renders "$-2.55" — the
           sign on the WRONG SIDE of it, in the same column that prints "+$11.33" for a positive.
           Seen live on a real import, in this exact column. `App.fmtBal` exists for precisely this
           and is what the audit screens already use. */
        + '<td style="color:' + (vsT >= 0 ? 'var(--t2)' : 'var(--red)') + ';">' + (vsT >= 0 ? '+' : '') + App.fmtBal(vsT) + '</td>'
        + '<td style="color:var(--t2);">' + (vsTeam >= 0 ? '+' : '') + App.fmtBal(vsTeam) + '</td>'
        + '<td>' + Math.round(r.covers) + '</td>'
        + '<td class="val">' + App.fmtCurrency(r.sales) + '</td>'
        + '<td>' + (r.compsPct > 0 ? r.compsPct.toFixed(1) + '%' : '-') + '</td>'
        + '<td>' + (r.tipsPct > 0 ? r.tipsPct.toFixed(1) + '%' : '-') + '</td>'
        + '<td class="no-print"><div class="row-actions">' + coachBtn + '</div></td>'
        + '</tr>';
    }).join('');
    return headingRow + exclNote
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
        + '<td style="color:' + color + ';">' + (diff >= 0 ? '+' : '') + App.fmtBal(diff) + '</td>'
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

  // Only reads fields that are actually on screen. In Import mode the rsc-* inputs are
  // not rendered at all, so reading them as '' wiped the in-progress entry: a date chip
  // clicked while importing blanked the date, and the check then saved dated '' and was
  // invisible in every window, forever. Keep whatever we already hold for a field the
  // current mode does not render.
  captureForm() {
    const f = this._form || {};
    const v = (id, cur) => { const el = document.getElementById(id); return el ? el.value : (cur ?? ''); };
    this._form = {
      date:   v('rsc-date',   f.date),
      shift:  v('rsc-shift',  f.shift),
      server: v('rsc-server', f.server),
      cov:    v('rsc-cov',    f.cov),
      sales:  v('rsc-sales',  f.sales)
    };
  },

  // ── Per-server import: the toggle helper + result line ───────────────────────
  // PosIngest matches each row to the roster by name (same path the Shift close uses).
  _checkSeg() {
    const on = m => (this._entryMode === m || (m === 'manual' && this._entryMode !== 'import'));
    const btn = (m, label) => '<button type="button" class="btn btn-sm rsc-mode" data-mode="' + m + '" style="'
      + (on(m) ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;' : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    return '<div class="seg-toggle" style="margin-bottom:14px;">' + btn('manual', 'Enter Manually') + btn('import', 'Import File') + '</div>';
  },
  _impFlashHtml() {
    const fl = this._impFlash; this._impFlash = null;
    if (!fl) return '';
    // Say what actually happened. This used to print the file-is-wrong message for every
    // zero-row outcome, so re-dropping a good report whose rows were already logged read
    // as "check that the file has server, covers, and sales columns".
    // Counts come from the BUILDER (see nSkipped/nIncomplete/nUndated on the flash); the name lists
    // below are the display subset, so they can be shorter and must never drive a claim.
    const nSkip = fl.nSkipped || 0, nInc = fl.nIncomplete || 0, nUnd = fl.nUndated || 0;
    const nOther = nSkip + nInc + nUnd;
    let head;
    /* ⚠ THE SENTENCE WAS HAND-ROLLED AND FIXED-PLURAL, so landed=1 printed "1 of 2 server checks
       WERE saved". Five import doors already share App.partialSaveNote for exactly this, and it
       carries both noun forms because total===1 is the commonest failure shape ("The server check
       was not saved"). This door was the one still writing its own. */
    if (fl.failed)      head = App.partialSaveNote(fl.landed, fl.total, 'server check', 'server checks');
    else if (fl.added)  head = fl.added + ' server check' + (fl.added === 1 ? '' : 's') + ' imported'
                               + (fl.dupCount ? ', ' + fl.dupCount + ' already logged' : '') + '.';
    // ⚠ "All" ONLY WHEN NOTHING ELSE WAS DROPPED. This branch fired on any non-zero dupCount, so a
    // re-drop where 5 rows deduped and 3 more were undated printed "All 5 rows were already logged"
    // above a "Skipped, no readable date" note — and made both branches below unreachable.
    else if (fl.dupCount && !nOther) head = 'No new checks. All ' + fl.dupCount + ' row' + (fl.dupCount === 1 ? ' was' : 's were') + ' already logged.';
    else if (fl.dupCount) head = 'No new checks. ' + fl.dupCount + ' row' + (fl.dupCount === 1 ? ' was' : 's were') + ' already logged; the rest could not be used.';
    /* ⚠ DO NOT BLAME COLUMNS THAT WERE FINE, and do not contradict the note printed directly below.
       This was the only zero-row sentence, so a file whose Date cells read "Jul 24" (no year) was
       told to check the server, covers and sales columns — with "Skipped, no readable date: Maria
       Lopez" sitting underneath it — and a file where every server rang zero sent the operator to
       the Staff Roster to add people already on it. Same fix as the PMIX door one screen over.
       Anything involving a genuinely unmatched name still falls through to the column message. */
    else if (nUnd && !nSkip && !nInc)
      head = 'No rows imported. Bar Cop could not read a date on any row — check the date column in your export.';
    else if (nInc && !nSkip && !nUnd)
      head = 'No rows imported. Every name matched your roster, but no row had both covers and sales.';
    // ⚠ THE MIXED CASE. Each branch above demands the other two buckets be empty, so a file with
    // some undated rows AND some that rang nothing fell through to the column message — with the
    // notes underneath naming only dates and covers. Every combination needs a true headline.
    else if (!nSkip && (nUnd || nInc))
      head = 'No rows imported. Every name matched your roster — see below for what stopped each row.';
    /* ⚠ AND THE FALLBACK BLAMED COLUMNS THAT WERE FINE. Every branch above demands `nSkip` be zero,
       so ANY unmatched or blank name sent a mixed file here — printing "check that the file has
       server, covers, and sales columns" directly above "Not matched to your roster: …" and
       "Skipped, no readable date: Sam P.", which name the real causes. The twin door
       (sc-dashboard) already words this as the ROW requirement rather than a column fault, which is
       true in every combination; this door kept the older wording. Same sentence now. */
    else                head = 'No rows imported. Each row needs a server name Bar Cop can match, a date, covers, and sales.';
    const note = t => '<div style="font-size:11px;color:var(--t3);line-height:1.5;margin-top:6px;">' + t + '</div>';
    const list = a => a.slice(0, 8).map(esc).join(', ') + (a.length > 8 ? ', and ' + (a.length - 8) + ' more' : '');
    return '<div style="font-size:13px;margin-top:12px;font-weight:700;color:' + ((fl.added && !fl.failed) ? 'var(--gold)' : (fl.dupCount && !fl.failed) ? 'var(--t2)' : 'var(--red)') + ';">' + head + '</div>'
      + (fl.unmatched && fl.unmatched.length ? note('Not matched to your roster: ' + list(fl.unmatched) + '. Add them in the Staff Roster or rename to match.') : '')
      + (fl.incomplete && fl.incomplete.length ? note('Skipped, no covers or sales rung: ' + list(fl.incomplete) + '. These are on your roster, nothing to fix.') : '')
      /* Two buckets the builder now separates, and both used to land in 'Not matched to your
         roster' — which told the operator to ADD A POS TOTALS LINE as a staff member, and to add
         a line cook who is already on the roster. Neither is a roster fix, so neither says so. */
      + (fl.summaryRows && fl.summaryRows.length ? note('Skipped, this is your export' + String.fromCharCode(8217) + 's own totals line: ' + list(fl.summaryRows) + '. Nothing to fix.') : '')
      + (fl.notService && fl.notService.length ? note('Skipped, not on the service floor: ' + list(fl.notService) + '. Server checks only cover active Bar and Front of House staff.') : '')
      // ⚠ THE THIRD LIST. buildServer stopped writing a record with a blank date and started
      // reporting those rows in `undated` — the cockpit door says so, this one never destructured it,
      // so at THIS door the row vanished with no word at all. It is the one skip an operator can
      // actually fix in the file (a date cell like "Jul 24" with no year), so it has to be named.
      + (fl.undated && fl.undated.length ? note('Skipped, no readable date: ' + list(fl.undated) + '. Check the date column in your export.') : '')
      // ⚠ THE ROWS WITH NO NAME TO PRINT. A subtotal or section line with an empty Server cell is a
      // real dropped row, and it was rendered NOWHERE because every list above prints names and it
      // has none. Report it as a count so the totals an operator adds up actually reconcile.
      + ((nSkip - (fl.unmatched || []).length) > 0
          ? note((nSkip - fl.unmatched.length) + ' row' + ((nSkip - fl.unmatched.length) === 1 ? '' : 's')
                 + ' skipped with no server name — usually a subtotal or section line in the export.') : '');
  },
  mountServerImport() {
    const el = document.getElementById('rsc-imp-csv');
    if (!el || typeof CSVMapper === 'undefined' || typeof PosIngest === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your POS per-server sales report here',
      dropSub: 'One row per server with covers and total sales. Bar Cop matches each row to your roster by name.',
      actionsEl: '#rsc-imp-actions',
      fields: PosIngest.FIELDS.server,
      confirmLabel: 'Import',
      onComplete: rows => this.applyServerImport(rows)
    });
  },
  async applyServerImport(rows) {
    const { toAdd, skipped, incomplete, undated, dupCount, summaryRows, notService } = PosIngest.build('server', rows);
    let added = 0, failed = false, landed = 0;
    if (toAdd.length) {
      // Honor the commit result. Discarding it reported "N server checks imported" in
      // gold after a save the server rejected and reverted (viewer role), while the
      // scorecard right below re-rendered with no new rows.
      const ok = await PosIngest.commit('server', toAdd);
      /* ⚠ A PARTIAL SAVE IS NOT A FAILED SAVE, and at THIS door the contradiction is on screen. The
         generic commit path writes row by row, does not stop at the first refusal, and ANDs one
         boolean — so eleven of twelve saved still returns false. draw() then re-renders the Server
         Shift log straight from App.data.revenue_server_checks, so the operator gets a red
         "Save failed. Try the import again." sitting directly above the eleven rows that saved.
         The natural next move is to key them in by hand, and the roster ends up holding each twice.
         App.putRecord reverts the array slot on a genuine refusal, so what is still in memory IS
         what landed; re-running is safe because buildServer dedupes on staff + date + covers + sales.
         (The cockpit door does the same probe — sc-dashboard.importServer.) */
      if (ok) added = toAdd.length;
      else {
        // IDENTITY, not id: App.putRecord assigns the exact object on success and restores the
        // previous one (or splices it out) on a genuine refusal.
        const live = ((App.data && App.data.revenue_server_checks) || []);
        landed = toAdd.filter(r => live.indexOf(r) !== -1).length;
        failed = true;
      }
    }
    this._impFlash = {
      added, failed, landed, total: toAdd.length, dupCount: dupCount || 0,
      unmatched: (skipped || []).filter(s => s && s !== '(blank)'),
      incomplete: (incomplete || []).filter(s => s && s !== '(blank)'),
      undated: (undated || []).filter(s => s && s !== '(blank)'),
      /* ⚠ RAW COUNTS FOR THE HEADLINE — the display lists above strip '(blank)' rows, and the
         headline must never assert something those lists cannot see. A subtotal or section line
         with an empty Server cell and a populated Covers cell survives CSVMapper's all-cells-empty
         filter, lands in `skipped` as '(blank)', and is then filtered out here — so `unmatched`
         came out EMPTY and the headline claimed "Every name matched your roster" about a file that
         had an unmatched row, which was also rendered nowhere. Branch on what the BUILDER counted;
         list only what can be named; report the difference as a count. */
      summaryRows: (summaryRows || []).filter(Boolean),
      notService: (notService || []).filter(Boolean),
      nSkipped: (skipped || []).length,
      nIncomplete: (incomplete || []).length,
      nUndated: (undated || []).length
    };
    this.draw();
  },

  // ── Wiring (re-run each draw; per-element listeners, no container stacking) ───
  wire() {
    const c = this.container;
    const collapseHead = c.querySelector('.card-collapse-head');
    if (collapseHead) collapseHead.addEventListener('click', () => App.toggleCollapse(collapseHead));
    App.applyCollapsed(c);
    c.querySelectorAll('.rsc-mode').forEach(b => b.addEventListener('click', () => { if (this._entryMode !== 'import') this.captureForm(); this._entryMode = b.dataset.mode; this.draw(); }));
    if (this._entryMode === 'import') this.mountServerImport();
    c.querySelectorAll('.rsc-range-chip').forEach(b => b.addEventListener('click', () => { this.captureForm(); this._window = b.dataset.v; this.draw(); }));
    c.querySelectorAll('[data-show-older]').forEach(b => b.addEventListener('click', () => App.handleShowOlder(b, () => this.draw())));
    document.getElementById('rsc-worksheet')?.addEventListener('click', () => this.printBlank());
    /* ⚠ THE EXPORT NAMED NEITHER THE WINDOW NOR THE TARGET. A "Last 7 Days" PDF and an "All Time"
       PDF were byte-indistinguishable once printed, and the "vs Target" column graded every server
       against a number that appeared nowhere on the page — an owner reading it later cannot tell
       what period it covers or what bar it was measured against. Both now ride in the subtitle.
       ⚠ AND `lists`/`reRender` WERE INERT, not merely redundant: exportListPDF expands a truncated
       list only when it finds a [data-show-older] INSIDE the export root, and the root here is the
       scorecard table — the Server Shift log lives outside it. `saved` was therefore always empty
       and `reRender` was never called. Dropped rather than left looking like it does something. */
    document.getElementById('rsc-export')?.addEventListener('click', () => App.exportPDF({
      title: 'Server Performance',
      subtitle: this.windowLabel() + ' · check average target ' + App.fmtCurrency(App.data.revenue_settings?.targets?.check_avg || 35),
      root: document.getElementById('rsc-sc-export') || c
    }));

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
    if (vEl) { vEl.textContent = (diff >= 0 ? '+' : '') + App.fmtBal(diff); vEl.style.color = color; }
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
    // A check saved without a date sorts below every window cutoff, so it never shows
    // in the log or the scorecard again. Guard it like every other save in Shift does.
    if (!f.date) { fail('Pick the date before saving.'); return; }
    /* ⚠⚠ THE FORM ACCEPTED WHAT THE IMPORT REFUSES — two doors writing the same record on two
       different rules. `!cov` is false for a NEGATIVE, so -35 covers and -$700 both saved.
       Measured: one -35-cover row dragged the Team Average tile to $420.00 against a truth of
       $40.00, and a live entry of -5 covers / -$700 printed a $140.00 check average under an
       "On Target" badge. The same rows feed the Revenue audit's server-sales figure.
       Also guarded here: INFINITY (a number input accepts 1e400 and `!Infinity` is false, so it
       saved and printed **$∞** on the scorecard), and FRACTIONAL covers — the import rounds them
       and the form did not, so a 12.5-cover entry printed "13 covers" beside a check average
       computed on 12.5, and the row did not tie out. `PosIngest.buildServer` is the reference
       for all three. */
    if (!isFinite(cov) || !isFinite(sales)) { fail('Those numbers are too large to record.'); return; }
    if (cov < 0 || sales < 0) { fail('Covers and total sales cannot be negative.'); return; }
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
      covers:      Math.round(cov),
      sales,
      saved_at:    new Date().toISOString()
    };
    /* ⚠ THE WRITE RESULT WAS DISCARDED. A refused write (viewer role, or localStorage full after
       eviction — putRecord reverts the array slot and returns false for both) still cleared the
       form, reset the entry id and redrew, so the operator's typed check was GONE and the
       scorecard simply did not contain it. App._reportWriteFail still toasts, so it is not silent
       app-wide, but losing the typed entry is the part that costs them the shift.
       The import lane on this same screen honours its commit result carefully; the hand-entry lane
       threw it away. Keep the form populated on a refusal so the entry is retryable. */
    App.putRecord('core', 'revenue_server_check', entry).then(saved => {
      if (!saved) { fail('That did not save. Your entry is still here — try again.'); return; }
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
    /* ⚠⚠ AND THE EDIT DOOR HAD NEITHER GUARD NOR A DATE CHECK. `save()` refuses a dateless entry,
       with a comment explaining that it "sorts below every window cutoff, so it never shows in the
       log or the scorecard again" — and Edit let you CLEAR the date. Measured: the record then
       renders in no window and on no chip, and since Edit and Delete only exist IN the log, it is
       unreachable forever. Step 0.5: the twin needed the same four tests. */
    const date = v('rscm-date'), shift = v('rscm-shift');
    if (!date) return fail('Pick the date before saving.');
    if (!isFinite(cov) || !isFinite(sales)) return fail('Those numbers are too large to record.');
    if (cov < 0 || sales < 0) return fail('Covers and total sales cannot be negative.');
    if (!cov || !sales) return fail('Enter covers and total sales before saving.');
    const staff = this.staffById(v('rscm-server'));
    if (!staff) return fail('Pick a server.');
    const c = (App.data.revenue_server_checks || []).find(x => x.id === id);
    if (!c) return;
    const matchShift = this.activeShiftFor(date, shift);
    const entry = {
      ...c,
      date, shift,
      shift_id:    matchShift ? matchShift.id : (c.shift_id || ''),
      staff_id:    staff.id,
      server_name: staff.name,
      covers:      Math.round(cov),
      sales,
      saved_at:    new Date().toISOString()
    };
    // Step 0.5: the twin needs the same result check. Closing the modal on a refused write threw
    // the operator's corrections away and left the old figures on screen looking accepted.
    App.putRecord('core', 'revenue_server_check', entry).then(saved => {
      if (!saved) return fail('That did not save. Your changes are still here — try again.');
      App.closeModal('rsc-edit-modal'); this.draw();
    });
  }
};
