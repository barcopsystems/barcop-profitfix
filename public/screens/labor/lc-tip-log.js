'use strict';

/* ── Labor Control — Tip Log (writes lc_tips) ─────────────────────────────────
   Records tips by DAY + service period and staff member — cash and card, totalled.
   The anchor is a week-stepper with day-of-week and service-period chips; shift_id
   is a synthetic join key, App.tipShiftKey(date, period). Staff preload from the
   posted schedule for the tapped day (with full roster fallback). Hours pull from
   lc_actuals when staff + day are both set.

   Landing = one Log Tips card with an Enter Manually / Import File toggle, then
   the stats, filter, and tip list. Editing a row opens it in a focused pop-up. */

S.LaborTipLog = {
  editId: null,
  entryMode: 'manual',     // 'manual' = batch-enter rows, 'import' = drop a POS tips file
  filterPreset: 'last-4',  // active range chip: this-week|last-week|this-month|last-4|all|custom
  _prevPreset: 'last-4',   // range to restore when Custom is toggled closed
  filterFrom: '',          // custom range only
  filterTo: '',            // custom range only
  // Batch manual-entry state (preloaded from the picked day's posted schedule).
  _addWeekStart: '',       // Monday of the week shown in the day picker
  _addDate: '',            // selected day (ymd)
  _addShiftType: '',       // selected service period (the daypart / shift_type)
  _addRows: null,          // [{ staff_id, hours, cash, card, sales, received }]
  _savedNote: null,        // count to confirm after a save (shown once)
  // Edit pop-up anchor state (one record at a time).
  _eWeekStart: '', _eDate: '', _ePeriod: '',

  tips() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_tips)) App.laborData.lc_tips = [];
    return App.laborData.lc_tips;
  },
  staff() { return ((App.laborData && App.laborData.lc_staff) || []); },
  staffById(id) { return this.staff().find(s => s.id === id); },
  actuals() { return ((App.laborData && App.laborData.lc_actuals) || []); },
  schedules() { return ((App.laborData && App.laborData.lc_schedules) || []); },
  callouts() { return ((App.laborData && App.laborData.lc_callouts) || []); },
  get DAYS() { return App.DAYS_MON_FIRST || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; },
  mondayOf(ymd) {
    if (!ymd) return '';
    const d = new Date(ymd + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return App.ymdLocal(d);
  },
  dayNameFor(ymd) {
    const d = new Date((ymd || '') + 'T00:00:00');
    return isNaN(d.getTime()) ? '' : this.DAYS[(d.getDay() + 6) % 7];
  },
  // Posted schedule covering a date (most recent for that week).
  scheduleForDate(date) {
    const ws = this.mondayOf(date);
    return this.schedules().filter(s => s.week_start === ws)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;
  },
  // Hours for a scheduled shift: its stored hours, else computed from start/end.
  schedHours(sh) {
    if (sh.hours != null && sh.hours !== '') return parseFloat(sh.hours) || 0;
    if (!sh.start || !sh.end) return 0;
    const ps = sh.start.split(':').map(Number), pe = sh.end.split(':').map(Number);
    let mins = (pe[0] * 60 + (pe[1] || 0)) - (ps[0] * 60 + (ps[1] || 0));
    if (isNaN(mins)) return 0;
    if (mins <= 0) mins += 1440;
    return mins / 60;
  },

  // ── Day + Service-Period anchor (replaces the old sc_shifts picker) ──────────
  // A week stepper + day-of-week chips + service-period chips, shared by the Tip
  // Log batch builder, the edit pop-up, and the Tip Pool. The real date printed on
  // each chip kills the misclick a bare date field invited. prefix scopes the
  // class names so two hosts never collide.
  defaultPeriod() {
    const p = App.servicePeriodByTime && App.servicePeriodByTime();
    return (p && p.name) || (App.SHIFT_TYPES || [])[0] || '';
  },
  addDaysYmd(ymd, n) {
    const d = new Date((ymd || App.todayLocal()) + 'T00:00:00');
    if (isNaN(d.getTime())) return ymd;
    d.setDate(d.getDate() + n);
    return App.ymdLocal(d);
  },
  anchorHtml(prefix, weekStart, selDate, selPeriod) {
    const ws = weekStart || this.mondayOf(App.todayLocal());
    const start = new Date(ws + 'T00:00:00');
    const days = [];
    for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(App.ymdLocal(d)); }
    const mLabel = ymd => new Date(ymd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const chip = (cls, on, attr, label) => '<button type="button" class="btn btn-sm ' + cls + '" ' + attr + ' style="'
      + (on ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
            : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    const dayChips = days.map(ymd => {
      const d = new Date(ymd + 'T00:00:00');
      const wd = this.DAYS[(d.getDay() + 6) % 7];
      return chip(prefix + '-day', ymd === selDate, 'data-ymd="' + ymd + '"', wd + ' ' + d.getDate());
    }).join('');
    const perChips = (App.SHIFT_TYPES || []).map(per =>
      chip(prefix + '-period', per === selPeriod, 'data-period="' + esc(per) + '"', esc(per))).join('');
    return '<div style="margin-bottom:14px;">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'
      +   '<button type="button" class="btn btn-ghost btn-sm ' + prefix + '-wk-prev" aria-label="Previous week" style="margin:0;">&lsaquo;</button>'
      +   '<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">Week of ' + mLabel(days[0]) + ' &ndash; ' + mLabel(days[6]) + '</div>'
      +   '<button type="button" class="btn btn-ghost btn-sm ' + prefix + '-wk-next" aria-label="Next week" style="margin:0;">&rsaquo;</button>'
      + '</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">' + dayChips + '</div>'
      + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
      +   '<span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-right:2px;">Service Period</span>' + perChips
      + '</div>'
    + '</div>';
  },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  normDate(raw) {
    if (!raw) return '';
    const d = new Date(String(raw).length <= 10 ? raw + 'T00:00:00' : raw);
    return isNaN(d.getTime()) ? String(raw) : App.ymdLocal(d);
  },

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    // Keep any unsaved in-progress entry so leaving the screen and coming back (or
    // clicking a filter) never wipes it — only Save or Start Over resets it. A
    // "fresh" visit (no entered amounts) defaults to the open shift, preloads crew.
    const hasWork = (this._addRows || []).some(r => r && (r.cash || r.card || r.sales || r.received));
    if (!hasWork) {
      const today = App.todayLocal();
      this._addWeekStart = this.mondayOf(today);
      this._addDate = today;
      this._addShiftType = this._addShiftType || this.defaultPeriod();
      this._addRows = [];
      this.preloadFromDate(today, this._addShiftType);
    }
    this._savedNote = null;
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How the Tip Log Works', [
      { p: ['The Tip Log records cash and card tips by day, service period, and staff member. Tap the day and the period and Bar Cop loads the staff who were scheduled, so you mostly just type the tip amounts. Most weeks you import this straight off your POS export instead.'] },
      { h: 'Logging Tips', p: ['Choose Enter Manually, tap the day on the week strip, then the service period. Bar Cop loads a row for every tipped employee scheduled to work it, adjusted by the Call-Out Log so a no-show drops off and whoever covered shows up. Each person\'s tippable hours fill in from their logged hours, or their scheduled hours if those are not in yet, and you can override them. Type each person\'s cash and card off your tip sheet and save the whole period at once. Use Add Staff for anyone the schedule missed. Step the week arrows to enter a prior week.'] },
      { h: 'Tip-Outs', p: ['Set each role\'s tip-out percent in Positions: servers and bartenders tip out a percent of their sales, while bussers and barbacks stay at 0 and only receive. The Tip Log then splits into two sections. The Pays / Receives Tip-Out section is where staff enter cash tips, card tips, and total sales, and Bar Cop figures their tip-out at their role\'s percent; if a tipped role also gets a cut (a bartender taking the bar share from servers), they get a Received cell too. The Receives Tip-Out section gives each support person one cell: enter what they actually received, because the real distribution is yours to make, not Bar Cop\'s. The Collected vs Distributed line flags any gap, and each person\'s net take-home carries into the tip-credit check and payroll worksheet. Bar Cop calculates the amounts only; how a tip-out is paid out is your call and your payroll provider\'s.'] },
      { h: 'Importing From A POS Export', p: ['Switch to Import File and drop a tips export, CSV or Excel. Map the columns once and Bar Cop remembers it. Staff Name and Date are required; Card Tips and Cash Tips are each optional but a row needs at least one. Headers do not need to match exactly: Staff Name reads employee / server / name / staff, Card Tips reads card / credit / cc tips, Cash Tips reads cash / declared tips. Rows match your roster by name; a row with no match or no tip amount is skipped and reported. Imported tips come in as date entries not linked to a shift, which you can adjust by opening any entry.'] },
      { h: 'Where Tips Go', p: ['Tips feed the Tip Pool Log and the tip-credit check on Pay Periods, which compares a tipped employee\'s wage plus tips against your state minimum. Logging accurately here keeps those honest.'] },
      { h: 'Worksheet', p: ['The Worksheet button prints a clean grid to tally tips per server on the floor during the shift, then enter the rows here after close.'] }
    ]);
  },

  // Shared form fields for the edit pop-up. p = element-id prefix ('tle-'). The
  // day/period anchor sits up top (seeded from this._e* state), then Staff, hours,
  // amounts, the tip-out row, and Notes. Pass the record being edited.
  formBody(x, p) {
    p = p || 'tle-';
    const v = val => (val != null && val !== '') ? val : '';
    const pre = p.replace(/-$/, '');
    return '<div id="' + p + 'anchor">' + this.anchorHtml(pre, this._eWeekStart, this._eDate, this._ePeriod) + '</div>'
      + '<div class="form-row data-row" style="gap:12px;">'
        + '<div class="f" style="flex:1.2 1 150px;min-width:0;"><label>Staff</label>'
          + '<select id="' + p + 'staff"></select></div>'
        + '<div class="f" style="flex:0.9 1 110px;min-width:0;"><label>Tippable Hours</label>'
          + '<input type="number" id="' + p + 'hours" min="0" step="0.25" value="' + v(x?.hours) + '" placeholder="Auto"/></div>'
        + '<div class="f" style="flex:0.9 1 110px;min-width:0;"><label>Cash Tips</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + p + 'cash" min="0" step="0.01" value="' + v(x?.cash_tips) + '"/></div></div>'
        + '<div class="f" style="flex:0.9 1 110px;min-width:0;"><label>Card Tips</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + p + 'card" min="0" step="0.01" value="' + v(x?.card_tips) + '"/></div></div>'
        + '<div class="f" style="flex:0.8 1 100px;min-width:0;"><label>Total</label>'
          + '<div class="f-display" id="' + p + 'c-total">-</div></div>'
      + '</div>'
      + '<div id="' + p + 'tipout-wrap">' + (x ? this.tipoutRowHtml(x.staff_id, p, x.sales, x.tip_out_received) : '') + '</div>'
      + '<div class="form-row" style="gap:16px;margin-bottom:0;"><div class="f" style="width:100%;"><label>Notes</label>'
        + '<textarea id="' + p + 'notes" class="notes-ta" rows="2" placeholder="Optional">' + esc(x?.notes || '') + '</textarea></div></div>';
  },

  // Wire the edit-form field interactions. Save/Cancel/anchor are wired by the
  // caller. p = element-id prefix. x = the record being edited.
  wireForm(x, p) {
    p = p || 'tle-';
    document.getElementById(p + 'staff')?.addEventListener('change', () => this.onStaffChange(x, p));
    document.getElementById(p + 'cash')?.addEventListener('input', () => this.calc(p));
    document.getElementById(p + 'card')?.addEventListener('input', () => this.calc(p));
    // Earner edit row: tip-out = sales x %, live.
    const updTipout = () => {
      const el = document.getElementById(p + 'c-tipout');
      if (!el) return;
      const sales = parseFloat(document.getElementById(p + 'sales')?.value) || 0;
      el.textContent = sales > 0 ? '-' + App.fmtCurrency(sales * App.tipOutPctFor(x ? x.staff_id : '') / 100, 2) : '-';
    };
    document.getElementById(p + 'sales')?.addEventListener('input', updTipout);
    updTipout();
    this.populateStaffList(x, p);
    this.calc(p);
  },

  // The edit-modal tip-out row markup for a given staff: an earner gets Sales +
  // a live Tip-Out preview + Received; a support role gets just Received. Built
  // here so onStaffChange can rebuild it when the staff (and thus role) changes.
  tipoutRowHtml(staffId, p, salesVal, receivedVal) {
    p = p || 'tl-';
    if (!App.tipOutEnabled() || !staffId) return '';
    const v = val => (val != null && val !== '') ? val : '';
    const toPct = App.tipOutPctFor(staffId);
    const role = App.tipRole(staffId) || 'earner';
    const receivedCell = '<div class="f" style="width:170px;flex-shrink:0;"><label>Tip-Out Received</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + p + 'received" min="0" step="0.01" value="' + v(receivedVal) + '"/></div></div>';
    return role === 'support'
      ? '<div class="form-row" style="gap:16px;">' + receivedCell + '</div>'
      : '<div class="form-row" style="gap:16px;flex-wrap:wrap;"><div class="f" style="width:170px;flex-shrink:0;"><label>Sales</label>'
        + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="' + p + 'sales" min="0" step="0.01" value="' + v(salesVal) + '"/></div></div>'
        + '<div class="f" style="flex-shrink:0;"><label>Tip-Out (' + App.fmtPct(toPct) + ')</label><div class="f-display" id="' + p + 'c-tipout">-</div></div>'
        + receivedCell + '</div>';
  },

  // Rebuild the tip-out row from the currently selected staff (edit modal), keeping
  // any sales/received already typed, and rewire the live tip-out preview.
  refreshTipoutRow(p) {
    p = p || 'tl-';
    const wrap = document.getElementById(p + 'tipout-wrap');
    if (!wrap) return;
    const staffId = document.getElementById(p + 'staff')?.value || '';
    const sales = document.getElementById(p + 'sales')?.value;
    const received = document.getElementById(p + 'received')?.value;
    wrap.innerHTML = this.tipoutRowHtml(staffId, p, sales, received);
    const upd = () => {
      const el = document.getElementById(p + 'c-tipout');
      if (!el) return;
      const s = parseFloat(document.getElementById(p + 'sales')?.value) || 0;
      el.textContent = s > 0 ? '-' + App.fmtCurrency(s * App.tipOutPctFor(staffId) / 100, 2) : '-';
    };
    document.getElementById(p + 'sales')?.addEventListener('input', upd);
    upd();
  },

  renderList() {
    this.editId = null;
    this.actions.innerHTML = '';

    if (this.staff().length === 0) {
      App.setupCard(this.container, {
        title: 'Log Your First Tips',
        lead: 'Tips are logged against your roster, by shift and staff member. Add your staff and you can start logging.',
        steps: [
          { title: 'Add your staff', desc: 'Tips are logged against a staff member, so build your roster first.', btn: 'Go to Staff Roster', screen: 'lc-staff-roster', done: false }
        ]
      });
      return;
    }

    // One card, two ways in: type a row by hand, or drop a POS tips export. A
    // segmented toggle swaps the body. Same pattern as Log Hours.
    const segBtn = (mode, label) => {
      const on = this.entryMode === mode;
      return '<button type="button" class="btn btn-sm tl-mode" data-mode="' + mode + '" style="'
        + (on ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + label + '</button>';
    };
    // Primary action lives BELOW the card (bottom-left), collapse-group tagged so
    // it hides with the card. Import mode's Import/Cancel render into the same
    // out-of-card slot via the CSVMapper actionsEl. Mirrors Log Hours.
    let modeBody, actionRow;
    if (this.entryMode === 'import') {
      modeBody = '<div id="tl-imp-csv"></div><div id="tl-imp-result"></div>';
      actionRow = '<div id="tl-imp-actions" data-collapse-group="lc-tip-log" style="margin-bottom:24px;"></div>';
    } else {
      modeBody = this.batchBody();
      const note = this._savedNote; this._savedNote = null;   // show once, after a save
      actionRow = '<div data-collapse-group="lc-tip-log" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
        + '<button class="btn btn-primary" id="tl-save-all">Save Tips</button>'
        + '<button class="btn btn-ghost" id="tl-startover">Start Over</button>'
        + '<span id="tl-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
        + (note ? '<span style="color:var(--gold);font-size:12px;margin-left:8px;">Saved ' + note + ' tip entr' + (note === 1 ? 'y' : 'ies') + '. See the list below.</span>' : '')
        + '</div>';
    }
    const addCard = '<div class="card form-card">'
      + App.collapsibleCardTitle('lc-tip-log', 'Log Tips')
      + '<div class="collapse-body">'
      + '<div class="seg-toggle">' + segBtn('manual', 'Enter Manually') + segBtn('import', 'Import File') + '</div>'
      + modeBody
      + '</div></div>';

    const all = [...this.tips()].sort((a, b) =>
      new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());
    const filtered = this.applyFilters(all);

    let below;
    if (all.length === 0) {
      below = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No tips logged yet. Log your first entry above, or import a POS tips export. Tap the day and period and the crew auto-fills.</div>';
    } else {
      const cash = filtered.reduce((t, x) => t + (x.cash_tips || 0), 0);
      const card = filtered.reduce((t, x) => t + (x.card_tips || 0), 0);
      const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
        + '<div class="calc-item"><div class="calc-label">Entries</div><div class="calc-val lg">' + filtered.length + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Cash Tips</div><div class="calc-val lg">' + App.fmtCurrency(cash) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Card Tips</div><div class="calc-val lg">' + App.fmtCurrency(card) + '</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Tips</div><div class="calc-val lg">' + App.fmtCurrency(cash + card) + '</div></div>'
        + '</div></div>';

      let listHtml;
      if (filtered.length === 0) {
        listHtml = '<div style="font-size:13px;color:var(--t3);padding:8px 2px;">No tips logged in this range. Pick a wider range above.</div>';
      } else {
        const hasTipOut = filtered.some(x => (x.tip_out_paid || 0) > 0 || (x.tip_out_received || 0) > 0);
        const rows = filtered.slice(0, App.listLimit('lc', 'tip')).map(x => {
          let extra = '';
          if (hasTipOut) {
            const adj = (parseFloat(x.tip_out_received) || 0) - (parseFloat(x.tip_out_paid) || 0);
            const adjTxt = Math.abs(adj) < 0.005 ? '-' : (adj > 0 ? '+' : '') + App.fmtCurrency(adj, 2);
            extra = '<td>' + adjTxt + '</td><td class="val">' + App.fmtCurrency(App.netTips(x)) + '</td>';
          }
          return '<tr class="tl-row" data-id="' + x.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(x.date) + '</div></td>'
          + '<td>' + esc(x.name || '-') + '</td>'
          + '<td>' + esc(x.shift_type || '-') + '</td>'
          + '<td>' + App.fmtCurrency(x.cash_tips || 0) + '</td>'
          + '<td>' + App.fmtCurrency(x.card_tips || 0) + '</td>'
          + '<td' + (hasTipOut ? '' : ' class="val"') + '>' + App.fmtCurrency(x.total_tips || 0) + '</td>'
          + extra
          + '<td><div class="row-actions">'
          + (App.canEdit('lc-tip-log') ? '<button class="btn btn-ghost btn-sm tl-edit" data-id="' + x.id + '">Edit</button>' : '')
          + (App.canEdit('lc-tip-log') ? '<button class="btn btn-danger btn-sm tl-del" data-id="' + x.id + '">Delete</button>' : '')
          + '</div></td></tr>';
        }).join('');
        listHtml = '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
          + '<th>Date</th><th>Staff</th><th>Shift</th><th>Cash</th><th>Card</th><th>' + (hasTipOut ? 'Gross' : 'Total') + '</th>'
          + (hasTipOut ? '<th>Tip-Out</th><th>Net</th>' : '')
          + '<th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>'
          + App.showOlderBar('lc', 'tip', filtered, this.filterPreset !== 'all');
      }

      below = statsCard + this.filterRow() + listHtml;
    }

    this.container.innerHTML = '<div class="screen">' + addCard + actionRow + below + '</div>';
    App.applyCollapsed(this.container);
    this.container.onclick = ev => {
      const modeBtn = ev.target.closest('.tl-mode');
      if (modeBtn) { this.entryMode = modeBtn.dataset.mode; this.renderList(); return; }
      const head = ev.target.closest('.card-collapse-head');
      if (head && !ev.target.closest('.btn')) { App.toggleCollapse(head); return; }
      // Day + period anchor (batch builder).
      if (ev.target.closest('.tl-b-wk-prev')) { this._addWeekStart = this.addDaysYmd(this._addWeekStart, -7); this.renderList(); return; }
      if (ev.target.closest('.tl-b-wk-next')) { this._addWeekStart = this.addDaysYmd(this._addWeekStart, 7); this.renderList(); return; }
      const dayChip = ev.target.closest('.tl-b-day');
      if (dayChip) { this._addDate = dayChip.dataset.ymd; this._addWeekStart = this.mondayOf(this._addDate); this.preloadFromDate(this._addDate, this._addShiftType); this.renderList(); return; }
      const perChip = ev.target.closest('.tl-b-period');
      if (perChip) { this.collectBatch(); this._addShiftType = perChip.dataset.period; this.renderList(); return; }
      if (ev.target.closest('#tl-export')) { App.exportPDF({ title: 'Tip Log', root: this.container }); return; }
      if (ev.target.closest('#tl-print-blank')) { this.printBlank(); return; }
      if (ev.target.closest('#tl-save-all')) { this.saveBatch(); return; }
      if (ev.target.closest('#tl-startover')) { this._addRows = []; this._savedNote = null; this.renderList(); return; }
      const tlRange = ev.target.closest('.tl-range-chip');
      if (tlRange) {
        const v = tlRange.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.renderList();
        return;
      }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderList()); return; }
      const row = ev.target.closest('.tl-row');
      const edit = ev.target.closest('.tl-edit');
      const del = ev.target.closest('.tl-del');
      if (del)       { ev.stopPropagation(); this.confirmDel(del.dataset.id); return; }
      if (edit)      { ev.stopPropagation(); this.openEditModal(edit.dataset.id); return; }
      if (row && App.canEdit('lc-tip-log')) this.openEditModal(row.dataset.id);
    };

    if (this.entryMode === 'import') {
      this.mountTipImporter();
    } else {
      this.wireBatch();
    }
    document.getElementById('tl-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('tl-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });
  },

  // ── Batch manual entry (preloaded from the shift) ────────────────────────────
  // The manual lane is a multi-row builder: tap the day + period up top and Bar Cop
  // loads a row for every TIPPED employee who worked it (hours pre-filled), so the
  // manager types each person's cash/card off the tip sheet and saves the whole
  // shift at once. Mirrors the Void/Comp + Waste builders. The single-record form
  // (formBody) is still used for the edit pop-up.
  batchBody() {
    const on = App.tipOutEnabled();
    const header = '<div id="tl-b-anchor">' + this.anchorHtml('tl-b', this._addWeekStart, this._addDate, this._addShiftType) + '</div>';
    const addBtn = '<button type="button" class="btn btn-ghost btn-sm" id="tl-b-add">+ Add Staff</button>';
    const rows = this._addRows || [];
    if (!rows.length) {
      return header + '<div id="tl-b-rows" style="font-size:12px;color:var(--t3);margin:4px 0 12px;">'
        + (this._addDate
            ? 'No tipped staff scheduled for this day still need tips entered. Add staff below.'
            : 'Pick a day above to load its scheduled tipped staff, or add staff by hand.') + '</div>' + addBtn;
    }
    const tbl = (head, body) => '<div class="card" style="padding:0;overflow:hidden;margin-bottom:12px;"><table class="ing-tbl" style="table-layout:fixed;"><thead><tr>'
      + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';

    if (!on) {
      const body = rows.map((r, i) => this.batchRowHtml(r, i)).join('');
      const table = '<div id="tl-b-rows">' + tbl('<th style="width:200px;">Staff</th><th style="width:110px;">Tippable Hours</th><th style="width:110px;">Cash Tips</th><th style="width:110px;">Card Tips</th><th style="width:100px;">Total</th><th style="width:90px;"></th>', body) + '</div>';
      return header + table + addBtn;
    }

    // Tip-out on: two sections, EARNERS first then SUPPORT, so the form reads
    // cleanly instead of mixing roles. Partition keeps data-idx aligned with DOM
    // order; a row jumps to its section the moment its staff is picked.
    const isSupport = r => App.tipRole(r.staff_id) === 'support';
    const earners = rows.filter(r => !isSupport(r));
    const support = rows.filter(r => isSupport(r));
    this._addRows = earners.concat(support);
    const eBody = earners.map((r, i) => this.batchEarnerRow(r, i)).join('');
    const sBody = support.map((r, j) => this.batchSupportRow(r, earners.length + j)).join('')
      || '<tr><td colspan="9" style="color:var(--t3);font-size:12px;padding:8px 10px;">No staff on schedule. Add staff below if one worked.</td></tr>';
    const grid = '<th style="width:150px;">Staff</th><th style="width:70px;">Hours</th><th style="width:90px;">Cash Tips</th><th style="width:90px;">Card Tips</th><th style="width:100px;">Total Sales</th><th style="width:90px;">Tip-Out</th><th style="width:90px;">Received</th><th style="width:90px;">Net</th><th style="width:70px;"></th>';
    const sGrid = '<th style="width:150px;">Staff</th><th style="width:70px;">Hours</th><th style="width:90px;"></th><th style="width:90px;"></th><th style="width:100px;"></th><th style="width:90px;"></th><th style="width:90px;">Received</th><th style="width:90px;"></th><th style="width:70px;"></th>';
    const eTable = '<div class="sh" style="margin:0 0 8px;">Pays / Receives Tip-Out</div>' + tbl(grid, eBody);
    const sTable = '<div class="sh" style="margin:14px 0 8px;">Receives Tip-Out</div>' + tbl(sGrid, sBody);
    const tables = '<div id="tl-b-rows">' + eTable + sTable + '</div>';
    const recon = this.tipOutRecon(this._addRows);
    // Reconciliation stats (a .calc box, same as the Pool Calculator) + the tip-out
    // disclaimer below, UNDER the Add Staff button. Stays visible the whole time
    // tip-out is on so the Not Distributed gap shows whether a support row is listed
    // or not; recalcBatch keeps the numbers live as sales are typed.
    const gapCls = Math.abs(recon.gap) > 0.01 ? 'warn' : 'good';
    const reconBox = '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Collected</div><div class="calc-val" id="tl-b-collected">' + App.fmtCurrency(recon.collected, 2) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Distributed</div><div class="calc-val" id="tl-b-distributed">' + App.fmtCurrency(recon.distributed, 2) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Not Distributed</div><div class="calc-val ' + gapCls + '" id="tl-b-gap">' + App.fmtCurrency(recon.gap, 2) + '</div></div>'
      + '</div>'
      + '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-top:16px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
        + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">Bar Cop figures each tip-out at the percent of sales you set per role, and tracks what you record as distributed. It is a calculator, not legal or payroll advice. How a tip-out is collected and paid out, who must participate, and tip-credit rules vary by jurisdiction and change over time. Verify the rules for your area, and confirm the actual amounts with your payroll provider.</div>'
      + '</div>';
    return header + tables + addBtn + reconBox;
  },

  // Simple row (tip-out off): Staff / Tippable Hours / Cash / Card / Total.
  batchRowHtml(r, i) {
    r = r || {};
    const total = (parseFloat(r.cash) || 0) + (parseFloat(r.card) || 0);
    return '<tr class="tl-line" data-idx="' + i + '">'
      + '<td><select class="form-input tl-b-staff" style="width:100%;">' + App.staffOptions(r.staff_id) + '</select></td>'
      + '<td><input class="form-input tl-b-hours" type="number" min="0" step="0.25" value="' + (r.hours != null && r.hours !== '' ? r.hours : '') + '" placeholder="Auto" style="width:100%;"/></td>'
      + '<td><input class="form-input tl-b-cash" type="number" min="0" step="0.01" value="' + (r.cash != null ? r.cash : '') + '" placeholder="0.00" style="width:100%;"/></td>'
      + '<td><input class="form-input tl-b-card" type="number" min="0" step="0.01" value="' + (r.card != null ? r.card : '') + '" placeholder="0.00" style="width:100%;"/></td>'
      + '<td><div class="tl-b-total" style="font-weight:600;color:var(--t1);">' + (total > 0 ? App.fmtCurrency(total, 2) : '-') + '</div></td>'
      + '<td style="text-align:right;"><button type="button" class="btn btn-ghost btn-sm tl-b-remove">Remove</button></td>'
      + '</tr>';
  },
  // Earner row: Staff / Hours / Cash Tips / Card Tips / Total Sales / Tip-Out
  // (computed) / Received / Net. Received is for an earner who also gets a cut (a
  // bartender taking the bar tip-out from servers); a server just leaves it blank.
  batchEarnerRow(r, i) {
    r = r || {};
    return '<tr class="tl-line" data-idx="' + i + '">'
      + '<td><select class="form-input tl-b-staff" style="width:100%;">' + App.staffOptions(r.staff_id) + '</select></td>'
      + '<td><input class="form-input tl-b-hours" type="number" min="0" step="0.25" value="' + (r.hours != null && r.hours !== '' ? r.hours : '') + '" placeholder="Auto" style="width:100%;"/></td>'
      + '<td><input class="form-input tl-b-cash" type="number" min="0" step="0.01" value="' + (r.cash != null ? r.cash : '') + '" placeholder="0.00" style="width:100%;"/></td>'
      + '<td><input class="form-input tl-b-card" type="number" min="0" step="0.01" value="' + (r.card != null ? r.card : '') + '" placeholder="0.00" style="width:100%;"/></td>'
      + '<td><input class="form-input tl-b-sales" type="number" min="0" step="0.01" value="' + (r.sales != null && r.sales !== '' ? r.sales : '') + '" placeholder="0.00" style="width:100%;"/></td>'
      + '<td><div class="tl-b-tipout" style="font-weight:600;color:var(--t3);">-</div></td>'
      + '<td><input class="form-input tl-b-received" type="number" min="0" step="0.01" value="' + (r.received != null && r.received !== '' ? r.received : '') + '" placeholder="0.00" style="width:100%;"/></td>'
      + '<td><div class="tl-b-total" style="font-weight:600;color:var(--t1);">-</div></td>'
      + '<td style="text-align:right;"><button type="button" class="btn btn-ghost btn-sm tl-b-remove">Remove</button></td>'
      + '</tr>';
  },
  // Support row on the SAME 9-column grid as the earner row (Staff/Hours line up
  // exactly). Cash/Card/Sales/Tip-Out/Net cells stay blank; the operator-entered
  // Received sits under the Received column.
  batchSupportRow(r, i) {
    r = r || {};
    return '<tr class="tl-line" data-idx="' + i + '">'
      + '<td><select class="form-input tl-b-staff" style="width:100%;">' + App.staffOptions(r.staff_id) + '</select></td>'
      + '<td><input class="form-input tl-b-hours" type="number" min="0" step="0.25" value="' + (r.hours != null && r.hours !== '' ? r.hours : '') + '" placeholder="Auto" style="width:100%;"/></td>'
      + '<td></td><td></td><td></td><td></td>'
      + '<td><input class="form-input tl-b-received" type="number" min="0" step="0.01" value="' + (r.received != null && r.received !== '' ? r.received : '') + '" placeholder="0.00" style="width:100%;"/></td>'
      + '<td></td>'
      + '<td style="text-align:right;"><button type="button" class="btn btn-ghost btn-sm tl-b-remove">Remove</button></td>'
      + '</tr>';
  },

  // Tip-out math. Each EARNER (tipped-earner role) pays sales x % — a number Bar
  // Cop can stand behind. Each SUPPORT row's `received` is the operator-ENTERED
  // actual (not computed), because the real distribution is the manager's and Bar
  // Cop can't verify it. Net = cash + card - paid (earner) or + received (support).
  computeTipOut(rows) {
    const on = App.tipOutEnabled();
    const out = (rows || []).map(r => {
      const role = App.tipRole(r.staff_id) || 'earner';
      const sup = on && role === 'support';   // support has no cash/card/sales
      return {
        staff_id: r.staff_id || '', role,
        cash: sup ? 0 : (parseFloat(r.cash) || 0),
        card: sup ? 0 : (parseFloat(r.card) || 0),
        sales: sup ? 0 : (parseFloat(r.sales) || 0),
        hours: parseFloat(r.hours) || 0,
        received: on ? (parseFloat(r.received) || 0) : 0,   // earners (a bartender) can receive too
        pct: on ? App.tipOutPctFor(r.staff_id) : 0,         // this role's tip-out % of sales
        paid: 0
      };
    });
    if (on) out.forEach(o => { if (o.staff_id && o.role === 'earner' && o.sales > 0) o.paid = o.sales * o.pct / 100; });
    out.forEach(o => { o.net = o.cash + o.card - o.paid + o.received; });
    return out;
  },
  // Collected (everyone's tip-out paid) vs distributed (everyone's received, incl.
  // a bartender getting the bar share) + the gap.
  tipOutRecon(rows) {
    const out = this.computeTipOut(rows);
    const collected = out.reduce((s, o) => s + o.paid, 0);
    const distributed = out.reduce((s, o) => s + o.received, 0);
    return { collected, distributed, gap: collected - distributed,
      hasSupport: out.some(o => o.role === 'support' && o.staff_id),
      hasEarner: out.some(o => o.paid > 0) };
  },

  // The effective date the batch logs against: the day picked in the anchor.
  batchDate() {
    return this._addDate || '';
  },

  // Read the batch rows back into state for re-renders and save (the day + period
  // come from the anchor chips, not a form field).
  collectBatch() {
    const rowEls = [...document.querySelectorAll('#tl-b-rows .tl-line')];
    if (rowEls.length) {
      this._addRows = rowEls.map(el => ({
        staff_id: el.querySelector('.tl-b-staff')?.value || '',
        hours:    el.querySelector('.tl-b-hours')?.value || '',
        cash:     el.querySelector('.tl-b-cash')?.value || '',
        card:     el.querySelector('.tl-b-card')?.value || '',
        sales:    el.querySelector('.tl-b-sales')?.value || '',
        received: el.querySelector('.tl-b-received')?.value || ''
      }));
    }
  },

  // Build participant rows for a picked DAY from the POSTED SCHEDULE — who was
  // scheduled that day (tipped only) — adjusted by the Call-Out Log: drop anyone
  // who called out, add a tipped person who covered. Tippable hours come from
  // logged actuals when they exist, otherwise the scheduled hours (an estimate you
  // can override). Schedule, not logged hours, because tips are entered at close
  // before hours are usually logged.
  preloadFromDate(date, period) {
    this._addDate = date || '';
    if (period != null) this._addShiftType = period;
    if (!date) { this._addRows = []; return; }
    // Scheduled tipped staff for that day -> scheduled hours (the hours fallback).
    const schedHrs = new Map();
    const sched = this.scheduleForDate(date);
    if (sched) {
      const dayName = this.dayNameFor(date);
      (sched.shifts || []).forEach(sh => {
        if (sh.day !== dayName || !sh.staff_id) return;
        const st = this.staffById(sh.staff_id);
        if (!st || !App.isTipped(st)) return;
        schedHrs.set(sh.staff_id, (schedHrs.get(sh.staff_id) || 0) + this.schedHours(sh));
      });
    }
    // Call-out adjustments for this date (loosely matched on period): a caller-out
    // didn't work; a tipped cover did.
    const per = this._addShiftType || '';
    this.callouts().filter(c => c.date === date && (!c.shift_type || !per || c.shift_type === per)).forEach(c => {
      if (c.staff_id) schedHrs.delete(c.staff_id);
      if (c.covered && c.covered_by_id) {
        const cov = this.staffById(c.covered_by_id);
        if (cov && App.isTipped(cov) && !schedHrs.has(c.covered_by_id)) schedHrs.set(c.covered_by_id, 0);
      }
    });
    // Skip anyone already tip-logged for this day + period, fill hours from actuals else schedule.
    const key = App.tipShiftKey(date, per);
    const already = new Set(this.tips().filter(t => App.tipShiftKey(t.date, t.shift_type) === key).map(t => t.staff_id));
    const rows = [];
    [...schedHrs.keys()].forEach(id => {
      if (already.has(id)) return;
      const logged = App.hoursFor(id, date);
      const hours = (logged != null && logged > 0) ? logged : (schedHrs.get(id) || '');
      rows.push({ staff_id: id, hours: hours || '', cash: '', card: '', sales: '', received: '' });
    });
    rows.sort((a, b) => { const sa = this.staffById(a.staff_id), sb = this.staffById(b.staff_id); return ((sa && sa.name) || '').localeCompare((sb && sb.name) || ''); });
    this._addRows = rows;
  },

  // Read the current rows from the DOM (shared by recalc + ready count).
  batchDomRows() {
    return [...document.querySelectorAll('#tl-b-rows .tl-line')].map(el => ({
      staff_id: el.querySelector('.tl-b-staff')?.value || '',
      hours: el.querySelector('.tl-b-hours')?.value || '',
      cash: el.querySelector('.tl-b-cash')?.value || '',
      card: el.querySelector('.tl-b-card')?.value || '',
      sales: el.querySelector('.tl-b-sales')?.value || '',
      received: el.querySelector('.tl-b-received')?.value || ''
    }));
  },
  // Live per-row Tip-Out (earner only) + Net (or Total when off) + reconciliation
  // + the Save All count. The support Received input is the operator's, never
  // overwritten here.
  recalcBatch() {
    const on = App.tipOutEnabled();
    const els = [...document.querySelectorAll('#tl-b-rows .tl-line')];
    const rows = this.batchDomRows();
    const out = this.computeTipOut(rows);
    els.forEach((el, i) => {
      const o = out[i]; if (!o) return;
      if (on) {
        const toEl = el.querySelector('.tl-b-tipout');  // earner rows only
        if (toEl) toEl.textContent = o.paid > 0 ? '-' + App.fmtCurrency(o.paid, 2) : '-';
        const nEl = el.querySelector('.tl-b-total');
        if (nEl) nEl.textContent = (o.staff_id && (o.cash + o.card > 0 || o.received > 0 || o.paid > 0)) ? App.fmtCurrency(o.net, 2) : '-';
      } else {
        const t = o.cash + o.card;
        const tEl = el.querySelector('.tl-b-total');
        if (tEl) tEl.textContent = t > 0 ? App.fmtCurrency(t, 2) : '-';
      }
    });
    if (on) {
      const recon = this.tipOutRecon(rows);
      const set = (id, v, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = v; if (cls !== undefined) el.className = 'calc-val' + (cls ? ' ' + cls : ''); };
      set('tl-b-collected', App.fmtCurrency(recon.collected, 2));
      set('tl-b-distributed', App.fmtCurrency(recon.distributed, 2));
      set('tl-b-gap', App.fmtCurrency(recon.gap, 2), Math.abs(recon.gap) > 0.01 ? 'warn' : 'good');
    }
    const n = this.batchReadyCount();
    const btn = document.getElementById('tl-save-all');
    if (btn && !btn.disabled) btn.textContent = n > 0 ? 'Save ' + n + ' Entr' + (n === 1 ? 'y' : 'ies') : 'Save Tips';
  },
  batchReadyCount() {
    return this.computeTipOut(this.batchDomRows()).filter(o => o.staff_id && (o.cash + o.card > 0 || o.received > 0)).length;
  },

  wireBatch() {
    // The day + period anchor chips are handled by the screen-level click handler
    // in renderList (they sit outside #tl-b-rows). Here we wire the rows + Add Staff.
    document.getElementById('tl-b-add')?.addEventListener('click', () => {
      this.collectBatch();
      this._addRows = this._addRows || [];
      this._addRows.push({ staff_id: '', hours: '', cash: '', card: '', sales: '', received: '' });
      this.renderList();
    });
    const rowsEl = document.getElementById('tl-b-rows');
    if (rowsEl) {
      rowsEl.addEventListener('input', () => { this.collectBatch(); this.recalcBatch(); });
      rowsEl.addEventListener('change', ev => {
        // Picking a staff member auto-fills that row's hours from logged hours.
        if (ev.target.classList && ev.target.classList.contains('tl-b-staff')) {
          const hoursInp = ev.target.closest('.tl-line')?.querySelector('.tl-b-hours');
          const date = this.batchDate();
          if (hoursInp && !hoursInp.value && date) {
            const hrs = App.hoursFor(ev.target.value, date);
            if (hrs != null && hrs > 0) hoursInp.value = hrs;
          }
          // Reshape the row to the picked staff's role (earner = Sales box,
          // support = Received box) by re-rendering, preserving entered values.
          if (App.tipOutEnabled()) { this.collectBatch(); this.renderList(); return; }
        }
        this.recalcBatch();
      });
      rowsEl.addEventListener('click', ev => {
        if (ev.target.closest('.tl-b-remove')) {
          this.collectBatch();
          const idx = parseInt(ev.target.closest('.tl-line').dataset.idx, 10);
          if (this._addRows && idx >= 0) this._addRows.splice(idx, 1);
          this.renderList();
        }
      });
    }
    this.recalcBatch();
  },

  // Save every row that has a staff member and a tip amount as its own lc_tips
  // record, skipping anyone already logged for the shift (no double-count).
  async saveBatch() {
    this.collectBatch();
    const err = document.getElementById('tl-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = this._addDate || '';
    if (!date) { fail('Pick a day.'); return; }
    const shiftType = this._addShiftType || '';
    const shiftId = App.tipShiftKey(date, shiftType);
    const managerId = App.activeManagerId ? App.activeManagerId() : '';

    const tipOutOn = App.tipOutEnabled();
    const out = this.computeTipOut(this._addRows || []);
    const recs = [];
    let dupCount = 0;
    (this._addRows || []).forEach((r, i) => {
      const staff = this.staffById(r.staff_id);
      if (!staff) return;
      const o = out[i];
      if ((o.cash + o.card) <= 0 && o.received <= 0) return;
      if (this.tips().some(t => t.staff_id === staff.id && App.tipShiftKey(t.date, t.shift_type) === shiftId)) { dupCount++; return; }
      const h = (r.hours !== '' && r.hours != null) ? parseFloat(r.hours) : null;
      const r2 = n => Math.round((n || 0) * 100) / 100;
      recs.push({
        id: App.uid(), shift_id: shiftId, manager_id: managerId, date,
        staff_id: staff.id, name: staff.name, position_id: staff.position_id || '',
        shift_type: shiftType, cash_tips: o.cash, card_tips: o.card, total_tips: o.cash + o.card,
        sales: tipOutOn ? r2(o.sales) : 0,
        tip_out_paid: tipOutOn ? r2(o.paid) : 0,
        tip_out_received: tipOutOn ? r2(o.received) : 0,
        hours: (h != null && !isNaN(h)) ? h : null, notes: '', created_at: new Date().toISOString()
      });
    });
    if (!recs.length) { fail(dupCount ? 'Those entries are already logged for this day and period.' : 'Enter cash or card tips for at least one person.'); return; }

    const btn = document.getElementById('tl-save-all');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    let ok = true;
    for (const rec of recs) { ok = (await App.putRecord('lc', 'tip', rec)) && ok; }
    if (ok) {
      // Clear the form and confirm. We do NOT re-load the rest of the crew — people
      // with no tips (hostess, left early) don't need an entry, and re-shoving them
      // in read like the form was demanding them. The saved tips show in the list
      // below; re-pick the shift only if you actually need to add more.
      this._addRows = [];
      this._savedNote = recs.length;
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; this.recalcBatch(); }
      fail('Save failed. Try again.');
    }
  },

  mountTipImporter() {
    const el = document.getElementById('tl-imp-csv');
    if (!el || typeof CSVMapper === 'undefined') return;
    CSVMapper.mount(el, {
      dropTitle: 'Drop your POS tips export here',
      dropSub: 'Needs columns for staff name, date, and card or cash tips.',
      actionsEl: '#tl-imp-actions',
      fields: PosIngest.FIELDS.tips,
      confirmLabel: 'Import',
      onComplete: rows => this.importTipRows(rows)
    });
  },

  async importTipRows(rows) {
    // Match / dedup / build / save live in the shared PosIngest (dedup added so a
    // re-dropped tips export never double-counts). UI message stays here.
    const { toAdd, skipped, dupCount } = PosIngest.build('tips', rows);

    const result = document.getElementById('tl-imp-result');
    const imported = toAdd.length;
    if (imported === 0) {
      if (result) result.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">'
        + (dupCount ? 'No new rows imported. ' + dupCount + ' row' + (dupCount === 1 ? ' was' : 's were') + ' already logged.'
                    : 'No rows imported. No staff names matched the roster, or no tip amounts were found.') + '</div>';
      return;
    }
    const ok = await PosIngest.commit('tips', toAdd);
    if (!ok) {
      if (result) result.innerHTML = '<div style="font-size:13px;color:var(--red);margin-top:12px;">Save failed. Try the import again.</div>';
      return;
    }
    this.renderList();
    const res2 = document.getElementById('tl-imp-result');
    if (res2) res2.innerHTML = '<div style="font-size:13px;color:var(--gold);font-weight:700;margin-top:12px;">'
      + 'Imported ' + imported + ' tip entr' + (imported === 1 ? 'y' : 'ies') + '.'
      + (skipped.length ? ' <span style="color:var(--t3);font-weight:400;">' + skipped.length
          + ' row' + (skipped.length === 1 ? '' : 's') + ' skipped (no roster match or no tip amount).</span>' : '')
      + (dupCount ? ' <span style="color:var(--t3);font-weight:400;">' + dupCount
          + ' already logged, skipped.</span>' : '') + '</div>';
  },

  // Effective date window from the active range chip (recomputed off "today" each
  // render so This Week stays live); Custom reads the From/To pickers; All clears it.
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom, to: this.filterTo };
    return App.datePresetRange(this.filterPreset);
  },
  applyFilters(list) {
    const { from, to } = this.effectiveRange();
    return list.filter(t => {
      const date = t.date || '';
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  },

  // Sort/filter row above the data block: range chips left, Export + Worksheet
  // right (no filter card). Custom reveals a bare From/To row. Same as Log Hours.
  RANGE_CHIPS: [
    { v: 'this-week', label: 'This Week' }, { v: 'last-week', label: 'Last Week' },
    { v: 'this-month', label: 'This Month' }, { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'all', label: 'All' }, { v: 'custom', label: 'Custom' }
  ],
  filterRow() {
    const chips = App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'tl-range-chip');
    const row = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + chips + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
        + '<button class="btn btn-ghost btn-sm" id="tl-export">Export PDF</button>'
        + '<button class="btn btn-ghost btn-sm" id="tl-print-blank">Worksheet</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="tl-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="tl-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
  },

  // ── Edit in a focused pop-up (day/period anchor + own tle- ids) ─────────────
  openEditModal(id) {
    if (!App.canEdit('lc-tip-log')) return;
    const x = this.tips().find(t => t.id === id);
    if (!x) return;
    this.editId = id;
    this._eDate = x.date || App.todayLocal();
    this._ePeriod = x.shift_type || this.defaultPeriod();
    this._eWeekStart = this.mondayOf(this._eDate);
    const html = '<div class="card form-card narrow-form" style="margin:0;"><div class="card-title">Edit Tips</div>'
      + this.formBody(x, 'tle-')
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="tle-save">Update</button>'
        + '<button class="btn btn-ghost" id="tle-cancel">Cancel</button>'
        + '<span id="tle-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
        + '<button class="btn btn-danger" id="tle-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    const modal = App.openModal(html, { id: 'tl-edit-modal', maxWidth: 540, noClose: true });
    this.wireForm(x, 'tle-');
    document.getElementById('tle-save')?.addEventListener('click', () => this.save('tle-'));
    document.getElementById('tle-cancel')?.addEventListener('click', () => { this.editId = null; App.closeModal('tl-edit-modal'); });
    document.getElementById('tle-del')?.addEventListener('click', () => { this.editId = null; App.closeModal('tl-edit-modal'); this.confirmDel(id); });
    // Anchor chips re-render just the anchor block (typed amounts are preserved);
    // a day change also refreshes the "worked this day" staff list.
    if (modal) modal.addEventListener('click', ev => {
      const reanchor = () => { const a = document.getElementById('tle-anchor'); if (a) a.innerHTML = this.anchorHtml('tle', this._eWeekStart, this._eDate, this._ePeriod); };
      if (ev.target.closest('.tle-wk-prev')) { this._eWeekStart = this.addDaysYmd(this._eWeekStart, -7); reanchor(); return; }
      if (ev.target.closest('.tle-wk-next')) { this._eWeekStart = this.addDaysYmd(this._eWeekStart, 7); reanchor(); return; }
      const dc = ev.target.closest('.tle-day');
      if (dc) { this._eDate = dc.dataset.ymd; this._eWeekStart = this.mondayOf(this._eDate); reanchor(); this.populateStaffList(x, 'tle-'); return; }
      const pc = ev.target.closest('.tle-period');
      if (pc) { this._ePeriod = pc.dataset.period; reanchor(); return; }
    });
  },

  // Populate the staff dropdown: who logged hours on the picked day first (an
  // optgroup), then the rest of the roster.
  populateStaffList(existingRec, p) {
    p = p || 'tle-';
    const sel = document.getElementById(p + 'staff');
    if (!sel) return;
    const date = this._eDate || '';
    const workedIds = new Set();
    if (date) this.actuals().filter(a => a.date === date).forEach(a => { if (a.staff_id) workedIds.add(a.staff_id); });
    const selectedId = existingRec?.staff_id || sel.value || '';
    const all = this.staff().filter(s => s.status !== 'Inactive' || s.id === selectedId);
    const onShift = all.filter(s => workedIds.has(s.id));
    const offShift = all.filter(s => !workedIds.has(s.id));
    let h = '<option value="">Select staff...</option>';
    if (onShift.length) {
      h += '<optgroup label="Worked This Day">';
      onShift.forEach(s => { h += '<option value="' + s.id + '"' + (s.id === selectedId ? ' selected' : '') + '>' + esc(s.name) + '</option>'; });
      h += '</optgroup>';
    }
    if (offShift.length) {
      h += '<optgroup label="' + (onShift.length ? 'Other Staff' : 'Roster') + '">';
      offShift.forEach(s => { h += '<option value="' + s.id + '"' + (s.id === selectedId ? ' selected' : '') + '>' + esc(s.name) + '</option>'; });
      h += '</optgroup>';
    }
    sel.innerHTML = h;
  },

  // When the staff dropdown changes — auto-fill hours from lc_actuals for this
  // staff member + the picked day. Operator can still override.
  onStaffChange(existingRec, p) {
    p = p || 'tle-';
    const staffId = document.getElementById(p + 'staff')?.value || '';
    const date = this._eDate || '';
    // Reshape the tip-out row to the newly selected staff's role.
    if (existingRec && App.tipOutEnabled()) this.refreshTipoutRow(p);
    const hoursInp = document.getElementById(p + 'hours');
    if (!hoursInp) return;
    if (existingRec && hoursInp.value && parseFloat(hoursInp.value) > 0) return;
    const hrs = App.hoursFor(staffId, date);
    if (hrs != null && hrs > 0) hoursInp.value = hrs;
  },

  calc(p) {
    p = p || 'tl-';
    const num = id => parseFloat(document.getElementById(p + id)?.value) || 0;
    const total = num('cash') + num('card');
    const el = document.getElementById(p + 'c-total');
    if (el) el.textContent = App.fmtCurrency(total);
  },

  async save(p) {
    p = p || 'tl-';
    const isEdit = p === 'tle-';
    const err = document.getElementById(p + 'err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = this._eDate || '';
    if (!date) { fail('Pick a day.'); return; }
    const shiftType = this._ePeriod || '';
    const shiftId = App.tipShiftKey(date, shiftType);
    const managerId = App.activeManagerId ? App.activeManagerId() : '';

    const staff = this.staffById(document.getElementById(p + 'staff')?.value);
    if (!staff) { fail('Choose a staff member.'); return; }
    const num = id => { const n = parseFloat(document.getElementById(p + id)?.value); return isNaN(n) ? null : n; };
    const cash = num('cash') || 0, card = num('card') || 0;
    // Tip-out side (edit pop-up). Earner pays sales x their role's %; anyone can
    // have an operator-entered Received (a bartender takes the bar share). A row
    // can be valid on received alone (support).
    const tipOn = App.tipOutEnabled();
    const role = App.tipRole(staff) || 'earner';
    const myPct = App.tipOutPctFor(staff);
    const r2 = n => Math.round((n || 0) * 100) / 100;
    let salesV = 0, paidV = 0, receivedV = 0;
    if (tipOn) {
      receivedV = num('received') || 0;
      if (role !== 'support') { salesV = num('sales') || 0; paidV = salesV * myPct / 100; }
    }
    if (cash + card <= 0 && receivedV <= 0) { fail('Enter cash or card tips.'); return; }

    const rec = {
      id:          this.editId || App.uid(),
      shift_id:    shiftId,
      manager_id:  managerId,
      date,
      staff_id:    staff.id,
      name:        staff.name,
      position_id: staff.position_id || '',
      shift_type:  shiftType,
      cash_tips:   cash,
      card_tips:   card,
      total_tips:  cash + card,
      hours:       num('hours'),
      notes:       document.getElementById(p + 'notes')?.value.trim() || ''
    };
    if (tipOn) {
      rec.sales = role === 'support' ? 0 : r2(salesV);
      rec.tip_out_paid = role === 'support' ? 0 : r2(paidV);
      rec.tip_out_received = r2(receivedV);
    }
    if (!this.editId) rec.created_at = new Date().toISOString();

    const list = this.tips();
    let saved = rec;
    if (this.editId) {
      const i = list.findIndex(t => t.id === this.editId);
      if (i > -1) { list[i] = { ...list[i], ...rec }; saved = list[i]; }
    } else {
      list.push(rec);
    }

    const btn = document.getElementById(p + 'save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('lc', 'tip', saved);
    this.editId = null;
    if (ok) {
      if (isEdit) App.closeModal('tl-edit-modal');
      this.renderList();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = isEdit ? 'Update' : 'Save Tips'; }
      fail('Save failed. Try again.');
    }
  },

  async confirmDel(id) {
    const ok = await App.confirmDelete();
    if (!ok) return;
    await App.removeRecord('lc', 'tip', id);
    this.renderList();
  },

  // Paper-at-close workflow. Managers tally cash + card tips per server on a
  // printed sheet during the shift, then enter into Bar Cop after close.
  printBlank() {
    App.printBlankSheet({
      title: 'Tip Sheet',
      subtitle: 'Tally tips per server during the shift. Manager enters each row into Bar Cop after close.',
      columns: [
        { label: 'Server Name', width: '28%' },
        { label: 'Cash Tips',   width: '14%' },
        { label: 'Card Tips',   width: '14%' },
        { label: 'Total',       width: '12%' },
        { label: 'Hours',       width: '12%' },
        { label: 'Notes',       width: '20%' }
      ],
      rows: 14
    });
  }
};
