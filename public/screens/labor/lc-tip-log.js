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
  _mode: 'log',            // 'log' = per-person tip log, 'pool' = tip pool split (toggle at top)
  filterPreset: 'last-4',  // active range chip: this-week|last-week|this-month|last-4|all|custom
  _prevPreset: 'last-4',   // range to restore when Custom is toggled closed
  filterFrom: '',          // custom range only
  filterTo: '',            // custom range only
  // Batch manual-entry state (preloaded from the picked day's posted schedule).
  // The week + day anchor (_addWeekStart / _addDate) is SHARED by both modes.
  _addWeekStart: '',       // Monday of the week shown in the day picker
  _addDate: '',            // selected day (ymd)
  _addShiftType: '',       // selected service period (the daypart / shift_type)
  _addRows: null,          // [{ staff_id, hours, cash, card, sales, received }]
  _savedNote: null,        // count to confirm after a save (shown once)
  // Edit pop-up anchor state (one record at a time).
  // Tip Pool mode state (shares the anchor above; own crew rows + amount + method).
  _poolRows: null,         // [{ staff_id, name, hours }]
  _poolAmount: '',         // pool dollar amount (operator-entered)
  _poolMethod: 'hours',    // 'hours' | 'equal'
  _poolEditId: null,       // id of a saved pool being edited (null = building a new one)
  // Tip-pool EDIT pop-up state ('tpe-' ids; separate from the on-page builder).
  _peEditId: null, _peDate: '', _peAmount: '', _peMethod: 'hours', _peRows: null,

  pools() {
    if (!App.laborData) App.laborData = {};
    if (!Array.isArray(App.laborData.lc_tip_pools)) App.laborData.lc_tip_pools = [];
    return App.laborData.lc_tip_pools;
  },
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
      .sort(App.cmpNewest)[0] || null;
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
  addDaysYmd(ymd, n) {
    const d = new Date((ymd || App.todayLocal()) + 'T00:00:00');
    if (isNaN(d.getTime())) return ymd;
    d.setDate(d.getDate() + n);
    return App.ymdLocal(d);
  },

  // Day-only anchor for the Tip Log (tips log per day now, no service-period split):
  // ONE week range pill matching the app's other selectors (gold NOW, no future)
  // over a row of day chips, with breathing room between the two. prefix scopes the
  // class names so the batch builder ('tl-b') and the edit pop-up ('tle') never
  // collide. Tip Pool keeps the period-aware anchorHtml above.
  tlAnchor(prefix, weekStart, selDate) {
    const cur = this.mondayOf(App.todayLocal());
    const ws = weekStart || cur;
    const isCur = ws >= cur;
    const nowBadge = isCur ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">'
      + App.dateRangeLabel(ws, App.periodEndFor(ws)).toUpperCase() + nowBadge + '</span>';
    const nextBtn = isCur
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button type="button" class="btn btn-ghost btn-sm ' + prefix + '-wk-next" aria-label="Next week" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const weekRow = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button type="button" class="btn btn-ghost btn-sm ' + prefix + '-wk-prev" aria-label="Previous week" style="margin:0;padding:3px 9px;">&lsaquo;</button>'
      + pill + nextBtn
      + (isCur ? '' : '<button type="button" class="btn btn-ghost btn-sm ' + prefix + '-wk-now" style="margin-left:4px;">This Week</button>')
      + '</div>';
    const start = new Date(ws + 'T00:00:00');
    let dayChips = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const ymd = App.ymdLocal(d);
      const wd = this.DAYS[(d.getDay() + 6) % 7];
      const on = ymd === selDate;
      dayChips += '<button type="button" class="btn btn-sm ' + prefix + '-day" data-ymd="' + ymd + '" style="'
        + (on ? 'background:var(--sel-active-bg);border:1px solid var(--b-edge);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t2);') + '">' + wd + ' ' + d.getDate() + '</button>';
    }
    /* ⛔ NO DAYPART ROW. Tips track per DAY (Kyle, 2026-09-05), so the anchor is the week and the
       day, and nothing else. A per-shift build sat here for a day: four chips, four crews and
       four close-outs a night. It reconciled, and it was more accurate about who was owed what.
       It was also confusing on a screen whose whole job is one envelope at the end of the night,
       and a house that counts once should not be asked to count four times.
       ⚠ `shift_type` STAYS ON THE RECORD, BLANK, and `App.tipShiftKey(date, '')` still groups on
       it — the same shape every row written before the selector existed already carries. Nothing
       to migrate, and if a per-shift option is ever wanted again it is a chip, not a rebuild. */
    return '<div style="margin-bottom:16px;">' + weekRow
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:18px;">' + dayChips + '</div>'
      + '</div>';
  },

  fmtDate(str) {
    if (!str) return '-';
    const d = new Date(String(str).length <= 10 ? str + 'T00:00:00' : str);
    return isNaN(d.getTime()) ? esc(str) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  /* ⚠⚠ A DEAD PRIVATE `normDate` WAS DELETED HERE — the twin of the one in lc-log-hours.js, byte for
     byte, plus a third in sc-void-comp.js. Zero callers anywhere in `public/`, so no operator number
     moved. Removed because it was the exact shape six rounds were spent eliminating: a free-text
     `new Date()` (2001 invention, UTC day loss, day-first transposition, Feb-29 rollover), a
     `length <= 10` test that ate days 1-9 of every month, and a failure path that returned the RAW
     CELL instead of refusing — the one thing the shared reader promises never to do.
     ⚠ `fmtDate` directly above is NOT the same thing and is correct: it reads an already-stored
     `YYYY-MM-DD` and returns a display string. Parsing for STORAGE is what belongs to
     PosIngest.normDate, and only there. verify-import-date-year.js case C6 now sweeps all of
     public/ and tells the two apart. */

  render(container, actions) {
    this.container = container;
    this.actions = actions;
    // Keep any unsaved in-progress entry so leaving the screen and coming back (or
    // clicking a filter) never wipes it — only Save or Start Over resets it. A
    // "fresh" visit (no entered amounts/pool) lands on today with that day's crew
    // already loaded, for whichever mode is active.
    const today = App.todayLocal();
    if (this._mode === 'pool') {
      const poolWork = this._poolEditId || (this._poolAmount !== '' && this._poolAmount != null);
      if (!poolWork) {
        this._addWeekStart = this.mondayOf(today);
        this._addDate = today;
        this._poolAmount = ''; this._poolMethod = 'hours'; this._poolEditId = null;
        this._poolRows = this.crewForDate(today);
      }
    } else {
      const logWork = (this._addRows || []).some(r => r && (r.cash || r.card || r.sales || r.received));
      if (!logWork) {
        this._addWeekStart = this.mondayOf(today);
        this._addDate = today;
        // Landing on All Day. A house that runs one close a night never touches the shift row, and
        // it is the period every pre-2026-09-05 record carries, so it is the honest default.
        this._addShiftType = '';
        this._addRows = [];
        this.preloadFromDate(today, this._addShiftType);
      }
    }
    this._savedNote = null;
    this.renderList();
  },

  /* PAGE TABS that pick the mode. They sit ABOVE the card, as the screen's first child.
     ⭐ THIS IS THE APP'S EXISTING PAGE-TAB SHELL, NOT A NEW ONE (Kyle, 2026-09-05: *"can the Log
     Tips and Tip Pool be moved out of the card and become tab selections at the top?"* once the
     shift selector made the card too crowded). `.ch-tabs` is used on twenty screens including
     `lc-tip-history` next door, and `style.css` already positions a strip in this exact spot with
     a rule scoped BY SHAPE rather than by a list of screens: `.screen > .ch-tabs:first-child`.
     ⚠ IT ALSO HAD TO LEAVE THE CARD FOR A SECOND REASON. The old segmented toggle lived inside
     `collapse-body`, so collapsing the Tips card took the mode switch with it.
     ⛔⛔ THE CLASS RENDERED HERE AND THE SELECTOR THE WIRING READS ARE ONE FACT IN TWO PLACES, and
     this codebase has already paid for getting it wrong: every tab in the Menu Builder was dead on
     click because the markup said `ch-tab` and the handler asked for `.mi-tab`, with both halves
     independently asserted and green ([[the-loop]] integrity #11). They are pinned AGAINST EACH
     OTHER in verify-tip-shift-tabs.js. */
  TABS: [['log', 'Log Tips'], ['pool', 'Tip Pool']],
  modeToggle() {
    return '<div class="ch-tabs no-print">'
      + this.TABS.map(([k, label]) =>
          '<button type="button" class="ch-tab' + (this._mode === k ? ' on' : '') + '" data-tab="' + esc(k) + '">'
          + esc(label) + '</button>').join('')
      + '</div>';
  },
  switchMode(mode) {
    if (mode === this._mode) return;
    this._mode = mode;
    const date = this._addDate || App.todayLocal();
    if (mode === 'pool') {
      const poolWork = this._poolEditId || (this._poolAmount !== '' && this._poolAmount != null);
      if (!poolWork) { this._poolAmount = ''; this._poolMethod = 'hours'; this._poolEditId = null; this._poolRows = this.crewForDate(date); }
    } else {
      const logWork = (this._addRows || []).some(r => r && (r.cash || r.card || r.sales || r.received));
      if (!logWork) { this._addShiftType = ''; this._addRows = []; this.preloadFromDate(date, ''); }
    }
    this.renderList();
  },

  showHowTo() {
    App.showHelpModal('How Tips Work', [
      { p: ['This screen handles a day\'s tips two ways: the toggle up top picks Log Tips to record each person\'s actual cash and card tips, or Tip Pool to split a shared pool across the crew. Both share the same week and day picker, so pick the day once and switch as you need.'] },
      { h: 'Logging Tips', p: ['On Log Tips, tap the day on the week strip. Bar Cop loads a row for every tipped employee scheduled to work it, adjusted by the Call-Out Log so a no-show drops off and whoever covered shows up. Each person\'s tippable hours fill in from their logged hours, or their scheduled hours if those are not in yet, and you can override them. Type each person\'s cash and card off your tip sheet. Use Add Staff for anyone the schedule missed. Step the week arrows to enter a prior week. Most weeks you import this off your POS export on Close The Week in Labor instead.'] },
      /* The two actions are not the same thing, and the difference is what reaches your books, so
         it is stated in the directions rather than on the card ([[the-loop]]: cards carry data and
         controls, the "i" carries the explanation). */
      { h: 'Saving As You Go, Then Closing The Shift', p: ['Save Tips banks whoever you have entered so far, so you can check a server out when she leaves and come back to the rest at close. Everybody on the shift stays on the screen the whole time, both the staff paying a tip-out and the staff receiving one, so you can see what each person owes and who is still to be paid. Collected is what the earners handed over and Distributed is what you have given out, and the two should match the envelope in your hand. When the cash reconciles, Close Shift closes every person at once. Until you close it, the shift stays out of your books, your reports and the tip-credit check, so a half-counted night never reaches a tax worksheet. A closed shift is locked; Re-open Shift if you need to fix a number.'] },
      { h: 'Tip-Outs', p: ['Set each role\'s tip-out in Positions: set Pays Tip Out to Yes, then set Tip Out On to % of Sales (usually 1 to 2 percent) or % of Tips (usually 10 to 20 percent), and set the number. Support roles like bussers and barbacks stay at No and only receive. The Tip Log then splits into two sections. The Pays / Receives Tip-Out section is where staff enter cash tips, card tips, and total sales, and Bar Cop figures their tip-out on whichever basis you set; if a tipped role also gets a cut (a bartender taking the bar share from servers), they get a Received cell too. The Receives Tip-Out section gives each support person one cell: enter what they actually received, because the real distribution is yours to make, not Bar Cop\'s. The Collected vs Distributed line flags any gap, and each person\'s net take-home carries into the tip-credit check and payroll worksheet. Bar Cop calculates the amounts only; how a tip-out is paid out is your call and your payroll provider\'s.'] },
      { h: 'Importing From A POS Export', p: ['Got a tips export? Drop it on Close The Week in Labor. Bar Cop matches each row to your roster by name; Staff Name and Date are required and a row needs at least one of Card Tips or Cash Tips. Rows with no roster match or no tip amount are reported. Imported tips land in the list here to review and edit.'] },
      { h: 'Splitting A Tip Pool', p: ['Switch the toggle to Tip Pool to split one pool across the crew. Tap the day to preload who worked it (the same crew Log Tips loads), enter the pool amount, and pick By Hours Worked or Equal Split. Bar Cop works out each person\'s share live; watch the Unallocated figure, it should land at zero when the whole pool is distributed. Add or remove a person and adjust hours, and the shares recompute. Save Tip Pool stores the split and feeds the tip-credit check on Pay Periods.'] },
      { h: 'Saved Tip Pools', p: ['Every split you save lands in the Saved Tip Pools list at the bottom of Tip Pool mode. The stats up top total the pools in the range you pick with the chips, and Export PDF saves the list. Edit reopens a pool in a pop-up to fix a number (Update writes back to the same record, no duplicate) and Delete removes one you logged in error. To review a pool\'s per-person split, open the Tip Pools tab in Tip History.'] },
      { h: 'Where Tips Go', p: ['Tips and pool splits feed the tip-credit check on Pay Periods, which compares a tipped employee\'s wage plus tips against your state minimum, and the Form 8027 worksheet in Books. Logging accurately here keeps those honest.'] },
      { h: 'Worksheet', p: ['On Log Tips, the Worksheet button prints a clean grid to tally tips per server on the floor during the shift, then enter the rows here after close. On Tip Pool, it prints a blank pool sheet to tally each person\'s hours and split the pool by hand, then enter the result here.'] }
    ]);
  },


  // Live tip-out preview: the payer's percent on their basis (their sales, or the
  // tips they made). Reads whichever cells are present.


  renderList() {
    this.actions.innerHTML = '';

    if (this.staff().length === 0) {
      App.setupCard(this.container, {
        title: 'Log Your First Tips',
        lead: 'Tips are logged against your roster, by day and staff member. Add your staff and you can start logging.',
        steps: [
          { title: 'Add your staff', desc: 'Tips are logged against a staff member, so build your roster first.', btn: 'Go to Staff Roster', screen: 'lc-staff-roster', done: false }
        ]
      });
      return;
    }

    if (this._mode === 'pool') { this.renderPool(); return; }

    // The manual batch builder is the whole card now: the tips import lives on the
    // Labor cockpit (one import door), so there is no Manual/Import toggle here. The
    // Log Tips / Tip Pool toggle sits at the top of the card, above the anchor.
    // Primary action lives BELOW the card (bottom-left), collapse-group tagged so
    // it hides with the card.
    const modeBody = this.batchBody();
    const note = this._savedNote; this._savedNote = null;   // show once, after a save
    /* ⛔⛔⛔ ONE BUTTON. Kyle, 2026-09-05, after using a build that had Save, Close Shift and
       Re-open: *"get rid of the locked screens, and make it just like tip pool is now: you click
       save, it saves the record; if I change something and click save it gives a prompt to
       override what is already saved, and it changes the new entry. That is easier and less
       friction for the user."*
       ⚠ FOUR OF HIS SEVEN COMPLAINTS WERE ONE DEFECT. Edit landed on a locked form and could not
       be typed in; closing after a re-open printed "Shift closed." twice (a persistent label AND
       a one-shot banner, both rendering); and a re-opened shift showed Save beside Close with no
       way to tell which one ended the night. A lock nobody asked for produced all of it.
       ⭐ SAVING IS THE ONLY STATE-CHANGING ACT NOW, and it is the same act the Tip Pool tab has
       always used: press it, the record exists; press it again and it asks before overwriting. */
    const actionRow = '<div data-collapse-group="lc-tip-log" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="tl-save-all">Save Log Tips</button>'
      + '<button class="btn btn-ghost" id="tl-startover">Clear Amounts</button>'
      + '<span id="tl-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + (note ? '<span style="color:var(--gold);font-size:12px;margin-left:8px;">Saved ' + note + ' tip entr' + (note === 1 ? 'y' : 'ies') + '.</span>' : '')
      + '</div>';
    const wsBtn = '<button class="btn btn-ghost btn-sm no-print" id="tl-print-blank" type="button">Worksheet</button>';
    // Tabs OUTSIDE the card, so they are the screen's first child (which is what
    // `.screen > .ch-tabs:first-child` styles) and survive the card being collapsed.
    const addCard = this.modeToggle()
      + '<div class="card form-card">'
      + App.collapsibleCardTitle('lc-tip-log', 'Tips', wsBtn)
      + '<div class="collapse-body">'
      + modeBody
      + '</div></div>';

    const all = [...this.tips()].sort((a, b) =>
      new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());
    const filtered = this.applyFilters(all);

    let below;
    if (all.length === 0) {
      below = '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
        + '<th>Date</th><th>Staff</th><th>Cash</th><th>Card</th><th>Total</th><th></th>'
        + '</tr></thead><tbody><tr><td colspan="6" style="color:var(--t3);">No tips logged yet. Tap a day above and the crew auto-fills, or import a POS tips export on Close The Week in Labor.</td></tr></tbody></table></div>';
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
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>Date</th><th>Staff</th><th>Cash</th><th>Card</th><th>Total</th><th></th>'
          + '</tr></thead><tbody><tr><td colspan="6" style="color:var(--t3);">No tips logged in this range. Pick a wider range above.</td></tr></tbody></table></div>';
      } else {
        const hasTipOut = filtered.some(x => (x.tip_out_paid || 0) > 0 || (x.tip_out_received || 0) > 0);
        const rows = filtered.slice(0, App.listLimit('lc', 'tip')).map(x => {
          let extra = '';
          if (hasTipOut) {
            const adj = (parseFloat(x.tip_out_received) || 0) - (parseFloat(x.tip_out_paid) || 0);
            const adjTxt = Math.abs(adj) < 0.005 ? '-' : (App.fmtSigned(adj, 2).sign > 0 ? '+' : '') + App.fmtBal(adj, 2);
            extra = '<td>' + adjTxt + '</td><td class="val">' + App.fmtCurrency(App.netTips(x)) + '</td>';
          }
          return '<tr class="tl-row" data-id="' + x.id + '" style="cursor:pointer;">'
          + '<td><div class="val">' + this.fmtDate(x.date) + '</div></td>'
          + '<td>' + esc(x.name || '-') + '</td>'
          + '<td>' + App.fmtCurrency(x.cash_tips || 0) + '</td>'
          + '<td>' + App.fmtCurrency(x.card_tips || 0) + '</td>'
          + '<td' + (hasTipOut ? '' : ' class="val"') + '>' + App.fmtCurrency(x.total_tips || 0) + '</td>'
          + extra
          + '<td><div class="row-actions">'
          + (App.canEdit('lc-tip-log') ? '<button class="btn btn-ghost btn-sm tl-edit" data-id="' + x.id + '">Edit</button>' : '')
          + (App.canEdit('lc-tip-log') ? '<button class="btn btn-danger btn-sm tl-del" data-id="' + x.id + '">Delete</button>' : '')
          + '</div></td></tr>';
        }).join('');
        listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
          + '<th>Date</th><th>Staff</th><th>Cash</th><th>Card</th><th>' + (hasTipOut ? 'Gross' : 'Total') + '</th>'
          + (hasTipOut ? '<th>Tip-Out</th><th>Net</th>' : '')
          + '<th></th>'
          + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          + App.showOlderBar('lc', 'tip', filtered, this.filterPreset !== 'all');
      }

      below = statsCard + this.filterRow() + listHtml;
    }

    this.container.innerHTML = '<div class="screen">' + addCard + actionRow + below + '</div>';
    /* A closed shift reads rather than edits. This is the COURTESY, not the guard: a re-render
       rebuilds a disabled control enabled ([[the-loop]] #85), so `saveBatch` refuses a closed shift
       on its own and this only stops the operator typing into something that will not be taken. */
    if (closed) {
      const scope = this.container.querySelector('#tl-b-rows');
      if (scope) scope.querySelectorAll('input, select, button').forEach(el => {
        el.disabled = true;
        el.setAttribute('aria-disabled', 'true');
        if (el.style) el.style.opacity = '0.6';
      });
    }
    App.applyCollapsed(this.container);
    this.container.onclick = ev => {
      // ⛔ `.ch-tab` / `data-tab` must match what `modeToggle()` renders. See the note there.
      const modeSel = ev.target.closest('.ch-tab');
      if (modeSel) { this.switchMode(modeSel.dataset.tab); return; }
      const head = ev.target.closest('.card-collapse-head');
      if (head && !ev.target.closest('.btn')) { App.toggleCollapse(head); return; }
      // Day anchor (batch builder) — week pill + day chips, no future.
      if (ev.target.closest('.tl-b-wk-prev')) { this._addWeekStart = this.addDaysYmd(this._addWeekStart, -7); this.renderList(); return; }
      if (ev.target.closest('.tl-b-wk-next')) { const nw = this.addDaysYmd(this._addWeekStart, 7); if (nw > this.mondayOf(App.todayLocal())) return; this._addWeekStart = nw; this.renderList(); return; }
      if (ev.target.closest('.tl-b-wk-now')) { this._addWeekStart = this.mondayOf(App.todayLocal()); this.renderList(); return; }
      const dayChip = ev.target.closest('.tl-b-day');
      if (dayChip) { this._addDate = dayChip.dataset.ymd; this._addWeekStart = this.mondayOf(this._addDate); this.preloadFromDate(this._addDate, this._addShiftType); this.renderList(); return; }
      /* ⚠ SWITCHING SHIFT RELOADS THE CREW, it does not filter what is on screen. A different
         daypart is a different set of people, different hours and a different saved record, so
         anything typed and not saved belongs to the shift it was typed on and does not travel. */

      if (ev.target.closest('#tl-export')) { const r = this.effectiveRange(); App.exportListPDF({ title: 'Tip Log', root: this.container, lists: [['lc', 'tip']], reRender: () => this.renderList(), range: App.chipRangeLabel(this.RANGE_CHIPS, this.filterPreset, r.from, r.to) }); return; }
      if (ev.target.closest('#tl-print-blank')) { this.printBlank(); return; }
      if (ev.target.closest('#tl-save-all')) { this.saveBatch(); return; }
      /* ⛔ IT CLEARS THE AMOUNTS, NOT THE CREW. Kyle: *"the start over button clears the entire
         list of staff and you have to click the day pill again to reload them, I thought start
         over was just supposed to clear the entered tips/sales."* It emptied `_addRows`, which is
         the crew, so the fix is to keep every row and blank what was typed into it. Renamed with
         it, because "Start Over" is what described the old behaviour. */
      if (ev.target.closest('#tl-startover')) {
        this.collectBatch();
        (this._addRows || []).forEach(r => { r.cash = ''; r.card = ''; r.sales = ''; r.received = ''; });
        this._savedNote = null; this.renderList(); return;
      }
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
      if (edit)      { ev.stopPropagation(); this.goToShift(edit.dataset.id); return; }
      if (row && App.canEdit('lc-tip-log')) this.goToShift(row.dataset.id);
    };

    this.wireBatch();
    document.getElementById('tl-f-from')?.addEventListener('change', e => { this.filterFrom = e.target.value || ''; this.renderList(); });
    document.getElementById('tl-f-to')?.addEventListener('change',   e => { this.filterTo   = e.target.value || ''; this.renderList(); });
  },

  // ── Batch manual entry (preloaded from the day) ──────────────────────────────
  // The builder is a multi-row table: tap the day up top and Bar Cop loads a row for
  // every TIPPED employee who worked it (hours pre-filled), so the manager types
  // each person's cash/card off the tip sheet as they check out.
  // Mirrors the Void/Comp + Waste builders. It is the ONLY editor now: the
  // per-person pop-up was retired 2026-09-05, and a saved row opens its shift here.
  batchBody() {
    const on = App.tipOutEnabled();
    // Two inset divider lines (not full-bleed) separate the three parts: the
    // toggle, the day picker, and the entry below. No boxes around each part.
    const divLine = '<div style="border-top:1px solid var(--b2);margin:14px 0 16px;"></div>';
    const header = divLine + '<div id="tl-b-anchor">' + this.tlAnchor('tl-b', this._addWeekStart, this._addDate) + '</div>' + divLine;
    const addBtn = '<button type="button" class="btn btn-ghost btn-sm" id="tl-b-add">+ Add Staff</button>';
    const rows = this._addRows || [];
    /* ⛔ THE "N ALREADY ENTERED" NOTE IS GONE, and so is the "still need tips entered" wording.
       Both existed only to explain a list that had people missing from it. The list is the whole
       shift now, so a note about who is absent from it would be describing nothing. That note was
       the wrong answer to a right complaint: Kyle read a one-name Saturday as missing data, and the
       fix was to stop hiding the other nine, not to caption their absence. */
    if (!rows.length) {
      return header + '<div id="tl-b-rows" style="font-size:12px;color:var(--t3);margin:4px 0 12px;">'
        + (this._addDate
            ? 'No tipped staff were scheduled for this day. Add staff below if somebody worked.'
            : 'Pick a day above to load its scheduled tipped staff, or add staff by hand.') + '</div>' + addBtn;
    }
    const tbl = (head, body) => '<div class="pill-wrap" style="margin-bottom:12px;"><table class="ing-tbl pill" style="table-layout:fixed;"><thead><tr>'
      + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';

    /* ⚠ THE SPLIT-SHIFT NOTE WENT WITH THE DAYPARTS. It named anyone who appeared on two shifts
       the same day and gave their day total, which mattered when a night could be closed out four
       times. A day is the shift now, so a person cannot be on two of them and the note could only
       ever render empty — a line of dead markup pretending to be a feature. */
    const splitNote = '';

    if (!on) {
      const body = rows.map((r, i) => this.batchRowHtml(r, i)).join('');
      const table = '<div id="tl-b-rows">' + tbl('<th style="width:200px;">Staff</th><th style="width:110px;">Tippable Hours</th><th style="width:110px;">Cash Tips</th><th style="width:110px;">Card Tips</th><th style="width:100px;">Total</th><th style="width:90px;"></th>', body) + '</div>';
      return header + table + addBtn + splitNote;
    }

    // Tip-out on: two sections, EARNERS first then SUPPORT, so the form reads
    // cleanly instead of mixing roles. Partition keeps data-idx aligned with DOM
    // order; a row jumps to its section the moment its staff is picked.
    const isSupport = r => App.tipRole(r.staff_id) === 'support';
    const earners = rows.filter(r => !isSupport(r));
    const support = rows.filter(r => isSupport(r));
    this._addRows = earners.concat(support);
    const eBody = earners.map((r, i) => this.batchEarnerRow(r, i)).join('');
    /* ⭐ THIS SENTENCE IS TRUE AGAIN. It read "No staff on schedule" while the support crew WERE
       scheduled and merely filtered out for being entered, which is what made a live tip-out look
       impossible to hand over. Now that nobody is filtered, an empty support table means exactly
       what it says, so the original wording is the honest one and the "already entered" variant it
       briefly carried has gone with the filter. */
    const sBody = support.map((r, j) => this.batchSupportRow(r, earners.length + j)).join('')
      || '<tr><td colspan="9" style="color:var(--t3);font-size:12px;padding:8px 10px;">No staff on schedule. Add staff below if one worked.</td></tr>';
    const grid = '<th style="width:150px;">Pays / Receives Tip-Out</th><th style="width:70px;">Hours</th><th style="width:90px;">Cash Tips</th><th style="width:90px;">Card Tips</th><th style="width:100px;">Total Sales</th><th style="width:90px;">Tip-Out</th><th style="width:90px;">Received</th><th style="width:90px;">Net</th><th style="width:70px;"></th>';
    const sGrid = '<th style="width:150px;">Receives Tip-Out</th><th style="width:70px;">Hours</th><th style="width:90px;"></th><th style="width:90px;"></th><th style="width:100px;"></th><th style="width:90px;"></th><th style="width:90px;">Received</th><th style="width:90px;"></th><th style="width:70px;"></th>';
    const eTable = tbl(grid, eBody);
    const sTable = tbl(sGrid, sBody);
    const tables = '<div id="tl-b-rows">' + eTable + sTable + '</div>';
    const recon = this.tipOutRecon(this._addRows);
    const gapCls = Math.abs(recon.gap) > 0.01 ? 'warn' : 'good';
    const reconBox = '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
      + '<div class="calc-item"><div class="calc-label">Collected</div><div class="calc-val" id="tl-b-collected">' + App.fmtCurrency(recon.collected, 2) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Distributed</div><div class="calc-val" id="tl-b-distributed">' + App.fmtCurrency(recon.distributed, 2) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Not Distributed</div><div class="calc-val ' + gapCls + '" id="tl-b-gap">' + App.fmtCurrency(recon.gap, 2) + '</div></div>'
      + '</div>'
      + '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-top:16px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
        + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">Bar Cop figures each tip-out at the percent you set per role, on their sales or on the tips they made, and tracks what you record as distributed. It is a calculator, not legal or payroll advice. How a tip-out is collected and paid out, who must participate, and tip-credit rules vary by jurisdiction and change over time. Verify the rules for your area, and confirm the actual amounts with your payroll provider.</div>'
      + '</div>';
    // The split-shift day total sits below the reconciliation, because it is the second thing the
    // manager checks: Collected against the envelope, then each person's night against their bank.
    return header + tables + addBtn + reconBox + splitNote;
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
        pct: on ? App.tipOutPctFor(r.staff_id) : 0,         // this role's tip-out %
        paid: 0
      };
    });
    // Payer's tip-out = their percent on their basis (sales, or the tips they made).
    if (on) out.forEach(o => { if (o.staff_id && o.role === 'earner') o.paid = App.tipOutPaid(o.staff_id, o.sales, o.cash + o.card); });
    out.forEach(o => { o.net = o.cash + o.card - o.paid + o.received; });
    return out;
  },
  /* Collected (everyone's tip-out paid) vs distributed (everyone's received, incl. a bartender
     getting the bar share) + the gap.
     ⛔⛔ THESE THREE FIGURES ARE ABOUT THE SHIFT, AND THE ROWS *ARE* THE SHIFT NOW, so this reads
     the rows and nothing else. It briefly also folded in the day's saved records, which was the
     right answer to the wrong shape: at the time the rows were only the people NOT yet entered, so
     a partly-entered day printed $0.00 collected on a day that had taken $345.00. Once the whole
     crew stays on screen with their saved figures loaded, adding the records back would count every
     saved person TWICE.
     ⭐ SO THE FIX FOR THAT DEFECT IS THE CREW, NOT THIS FUNCTION. Reconciling against the envelope
     is what the manager does with it, and that only works if what is on screen is the whole shift
     ([[output-honesty]] — a figure must be true of the label it sits under). */
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

  /* ── CLOSING A SHIFT ────────────────────────────────────────────────────────────────────────
     Kyle, 2026-09-05: *"once he has reconciled the actual cash with the screen he can click Save
     Tips or Close Tips, that closes all the staff at one time and done."*
     Save is per person as they check out; CLOSE is the one action at the end that turns the whole
     shift into a settled record. Until then nothing downstream counts it. */
  /* A saved row opens its SHIFT rather than a private editor. There is one way to change a tip
     record now: land on its day and period, Re-open if it is closed, and fix it in the same
     table the night was entered on. Kyle: "keeping two ways to edit would be confusing." */
  goToShift(id) {
    const t = this.tips().find(x => x.id === id);
    if (!t || !t.date) return;
    this._mode = 'log';
    this._addDate = t.date;
    this._addWeekStart = this.mondayOf(t.date);
    this._addShiftType = '';
    this.preloadFromDate(this._addDate, '');
    this.renderList();
    /* ⚠ THE FORM IS ABOVE THE LIST, AND THE LIST IS WHERE EDIT WAS PRESSED. Kyle: *"when you
       click edit on a staff it should jump back up to the form so you can see it."* Without this
       the day loads correctly and the screen does not move, so the only visible effect of Edit is
       that a chip changed colour somewhere off-screen.
       ⚠ AFTER the render, or it scrolls to the element the render is about to replace. */
    const card = this.container && this.container.querySelector('.form-card');
    if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  /* ⛔⛔⛔ THE WHOLE SHIFT STAYS ON SCREEN. NOBODY IS FILTERED OUT FOR HAVING BEEN ENTERED.
     This used to drop anyone already tip-logged for the day, and an `includeLogged` option existed
     so the Tip Pool could opt out of that. Both are gone, because the filter was the defect.

     Kyle, 2026-09-05, describing how a shift close actually runs: *"a manager is on dinner shift...
     if a server gets off early he counts her bank, enters her tips and collects what she owes in
     tip outs... at the end of the night he closes the other staff out one at a time... all staff on
     shift names are on the screen... the number collected should match the amount in the envelope
     ... you can't close staff off the screen before all are done, it makes no sense. If Priya still
     has $200 to tip out but the staff that receive tips are no longer on the screen, how do they
     get the correct tip amount?"*

     ⛔ TWO MEASURED FAILURES CAME OUT OF THAT FILTER, and only the second was visible:
       · THE POOL. A pool is DIVIDED across the crew it is handed, so an excluded person does not
         vanish, their share goes to everyone else. On the demo, nine of ten were already logged, so
         the crew came back as ONE person and a $1,000 pool split $1,000.00 to her alone.
       · THE CLOSE. With the support crew filtered out there was nobody on screen to hand the
         tip-out to, and the reconciliation read $0.00 on a day that had collected $345.00.

     ⭐ A PERSON ALREADY SAVED LOADS WITH THEIR FIGURES, so the screen is the shift rather than the
     remainder of it, and `saveBatch` updates their record instead of refusing it as a duplicate. */
  /* ⛔ THE CREW IS EVERYONE SCHEDULED THAT DAY. Tips track per day (Kyle, 2026-09-05), so there
     is no period to filter on and the hours are the whole scheduled shift.
     ⚠ WHAT THIS REPLACED, BECAUSE THE REASONING STILL HOLDS IF DAYPARTS EVER COME BACK: the crew
     was filtered to the people whose shift touched the picked period, and their hours were the
     OVERLAP, not the whole shift. A pool divides by hours, so charging a five-hour lunch with
     somebody's eight-hour day pays them for dinner out of the lunch crew's pot. `period` is kept
     in the signature and ignored: every call site passes it, and a silent arity change is how a
     caller ends up passing a date into a slot that used to hold something else.
     ⚠ A SHIFT WITH NO TIMES still counts — `start`/`end` are optional on a schedule row, and
     dropping those people would silently shrink the crew on exactly the bars that do not fill
     times in ([[the-loop]] #30 — when the data cannot answer, do not infer; include them). */
  preloadFromDate(date, period) {
    this._addDate = date || '';
    this._addShiftType = '';                 // tips track per day; the daypart stays blank
    void period;
    if (!date) { this._addRows = []; return; }
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
    // What is already saved for this day + period, keyed by person. NOT a filter any more: it is
    // what each row is PRE-FILLED from, so re-opening a shift shows the figures that were entered
    // rather than an empty grid or a shorter list.
    const key = App.tipShiftKey(date, per);
    const savedBy = new Map();
    this.tips().forEach(t => { if (App.tipShiftKey(t.date, t.shift_type) === key) savedBy.set(t.staff_id, t); });
    const rows = [];
    const addRow = (id, schedFallback) => {
      const rec = savedBy.get(id);
      // Scoped to the period being logged: `period` is '' for the whole-day Tip Pool (which is how
      // crewForDate calls in), and a service period for a per-period Log Tips batch. Filling a
      // lunch row with a split shift's dinner hours is the same lie as filling the pool with one leg.
      const logged = App.hoursFor(id, date, period);
      const hours = rec && rec.hours != null && rec.hours !== '' ? rec.hours
                  : ((logged != null && logged > 0) ? logged : (schedFallback || ''));
      /* ⚠ NO RECORD ID RIDES ON THE ROW, DELIBERATELY. `collectBatch` rebuilds `_addRows` out of the
         DOM inputs on every keystroke, so anything not in an input is dropped — and an id that DID
         survive would go stale the moment the operator changed that row's staff picker, writing one
         person's tips onto another's record. `saveBatch` resolves the existing record by PERSON and
         SHIFT at save time instead, which cannot go stale and needs nothing carried. */
      rows.push(rec
        ? { staff_id: id, hours: hours || '', cash: rec.cash_tips != null ? rec.cash_tips : '',
            card: rec.card_tips != null ? rec.card_tips : '', sales: rec.sales != null ? rec.sales : '',
            received: rec.tip_out_received != null ? rec.tip_out_received : '' }
        : { staff_id: id, hours: hours || '', cash: '', card: '', sales: '', received: '' });
    };
    [...schedHrs.keys()].forEach(id => addRow(id, schedHrs.get(id)));
    /* ⛔ AND ANYONE ALREADY SAVED WHO IS NOT ON THE SCHEDULE. Add Staff exists precisely for the
       person the schedule missed, so leaving them out here would lose their entry the moment the
       day was re-opened — the row would vanish and its record would sit unreachable. */
    savedBy.forEach((rec, id) => { if (!schedHrs.has(id)) addRow(id, ''); });
    rows.sort((a, b) => { const sa = this.staffById(a.staff_id), sb = this.staffById(b.staff_id); return ((sa && sa.name) || '').localeCompare((sb && sb.name) || ''); });
    this._addRows = rows;
  },

  // Read the current rows from the DOM (shared by recalc + ready count).
  /* What a person's hours are on a given day: what they LOGGED, else what they were SCHEDULED.
     Two callers need the same answer — the day's preload and the row's staff picker — and having
     them disagree is how a row ends up showing one person's hours under another person's name. */
  hoursForStaffOnDate(staffId, date) {
    if (!staffId || !date) return null;
    const logged = App.hoursFor(staffId, date);
    if (logged != null && logged > 0) return logged;
    const sched = this.scheduleForDate(date);
    if (!sched) return null;
    const dayName = this.dayNameFor(date);
    let h = 0;
    (sched.shifts || []).forEach(sh => {
      if (sh.day === dayName && sh.staff_id === staffId) h += this.schedHours(sh);
    });
    return h > 0 ? +h.toFixed(2) : null;
  },
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
    if (btn && !btn.disabled) btn.textContent = n > 0 ? 'Save ' + n + ' Entr' + (n === 1 ? 'y' : 'ies') : 'Save Log Tips';
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
        /* ⛔ THE HOURS FOLLOW THE PERSON, ALWAYS. Kyle: *"it loads a staff hours but if you
           change the staff name the hours don't change with it, and some staff just says 'auto'
           and never does anything."* Both came from one condition: `!hoursInp.value` meant the
           lookup only ran on an EMPTY box, and every preloaded row already has hours — so picking
           a different person left the previous person's hours sitting under their name, which is
           what a pool divides by. The "Auto" placeholder was the other half: it promised a fill
           that never came for anyone whose box was already full.
           ⭐ AND IT FALLS BACK TO THE SCHEDULE. `App.hoursFor` only knows what was LOGGED, so
           somebody rostered but not yet clocked returned null and the row stayed blank. The
           schedule is the honest second answer and it is what the day's own preload uses. */
        if (ev.target.classList && ev.target.classList.contains('tl-b-staff')) {
          const hoursInp = ev.target.closest('.tl-line')?.querySelector('.tl-b-hours');
          const date = this.batchDate();
          if (hoursInp && date) {
            const hrs = this.hoursForStaffOnDate(ev.target.value, date);
            hoursInp.value = (hrs != null && hrs > 0) ? hrs : '';
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
  /* `opts.silent` is how Close Shift saves the screen before closing it: no "nothing to save"
     refusal when everybody is already in, and no re-render, because the caller renders once at the
     end. It is not a quieter save, it is the same save without the two things that only make sense
     when a human pressed the button. */
  async saveBatch(opts) {
    opts = opts || {};
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
    const recs = [], overwrites = [];
    /* ⛔⛔⛔ THIS UPSERTS. It used to REFUSE anyone already logged for the day and period, counting
       them as duplicates, which is what made the crew have to be filtered off the screen in the
       first place. With the whole shift on screen, pressing Save with nine people already entered
       would have refused all nine and told the manager *"Those entries are already logged"*.
       ⭐ THE EXISTING RECORD IS RESOLVED BY PERSON AND SHIFT, HERE, not carried on the row. A row
       cannot hold it: `collectBatch` rebuilds `_addRows` from the DOM inputs on every keystroke, and
       an id that did survive would go stale the moment somebody changed that row's staff picker and
       would then write one person's tips onto another's record.
       ⚠ THE ID AND `created_at` ARE KEPT FROM THE ORIGINAL on an update. Minting a new id makes a
       second row for one person in one shift, which double-counts on Form 8027 and inflates the
       tip-credit check that decides makeup pay. */
    (this._addRows || []).forEach((r, i) => {
      const staff = this.staffById(r.staff_id);
      if (!staff) return;
      const o = out[i];
      // Nothing to record for somebody who took nothing and was handed nothing. They still SIT on
      // the screen all night (Kyle: they stay until closed out); they simply leave no row behind.
      if ((o.cash + o.card) <= 0 && o.received <= 0) return;
      const prior = this.tips().find(t => t.staff_id === staff.id && App.tipShiftKey(t.date, t.shift_type) === shiftId);
      if (prior) overwrites.push(staff.name);
      const h = (r.hours !== '' && r.hours != null) ? parseFloat(r.hours) : null;
      const r2 = n => Math.round((n || 0) * 100) / 100;
      recs.push({
        id: prior ? prior.id : App.uid(), shift_id: shiftId, manager_id: managerId, date,
        staff_id: staff.id, name: staff.name, position_id: staff.position_id || '',
        shift_type: shiftType, cash_tips: o.cash, card_tips: o.card, total_tips: o.cash + o.card,
        sales: tipOutOn ? r2(o.sales) : 0,
        tip_out_paid: tipOutOn ? r2(o.paid) : 0,
        tip_out_received: tipOutOn ? r2(o.received) : 0,
        /* ⛔⛔ NOTHING WRITES `tip_shift_open` ANY MORE, AND REMOVING THE BUTTON WITHOUT REMOVING
           THIS WOULD HAVE SHIPPED A SILENT HOLE. Six screens read `App.settledTips` — Books twice,
           Week in Review, Year End twice, Labor Reports — and it drops any row flagged open. With
           the row still stamped `true` and no Close button left to clear it, every tip saved from
           today would have been invisible to all six, forever, with nothing on screen to say so.
           ⭐ `App.settledTips` AND `App.tipShiftOpen` STAY. An absent flag reads as settled, which
           is what every record written before the lock existed already does, so the six callers
           keep working unchanged and the door survives if a close step is ever wanted again. */
        hours: (h != null && !isNaN(h)) ? h : null, notes: (prior && prior.notes) || '',
        created_at: (prior && prior.created_at) || new Date().toISOString()
      });
    });
    if (!recs.length) { if (!opts.silent) fail('Enter cash or card tips for at least one person.'); return; }

    /* ⭐ ASK BEFORE REPLACING, WHICH IS WHAT THE POOL TAB ALREADY DOES. Kyle, 2026-09-05: *"if I
       change something and click save it gives a prompt to override what is already saved, and it
       changes the new entry. That is easier and less friction for the user."* This is what stands
       in for the lock: one confirm at the moment something is actually about to be rewritten,
       rather than a mode the whole screen sits in.
       ⚠ IT ASKS ONLY WHEN THERE IS SOMETHING TO OVERWRITE. A first save, or a save that only adds
       people to a day already part-entered, goes straight through — a prompt on every press is
       the friction he asked me to remove, not the guard he asked for.
       ⚠ AND IT RUNS BEFORE THE BUTTON IS DISABLED, so cancelling leaves nothing to restore. */
    if (!opts.silent && overwrites.length) {
      const okOver = await App.confirm({
        title: 'Replace what is already saved?',
        message: overwrites.length + ' entr' + (overwrites.length === 1 ? 'y is' : 'ies are') + ' already saved for '
          + this.fmtDate(date) + ' (' + overwrites.slice(0, 4).join(', ')
          + (overwrites.length > 4 ? ' and ' + (overwrites.length - 4) + ' more' : '')
          + '). Saving replaces what is on file with what is on screen.',
        confirmText: 'Replace', cancelText: 'Cancel', danger: false
      });
      if (!okOver) return;
    }

    const btn = document.getElementById('tl-save-all');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    let ok = true;
    for (const rec of recs) { ok = (await App.putRecord('lc', 'tip', rec)) && ok; }
    if (ok) {
      /* ⛔ THE FORM NO LONGER CLEARS ITSELF. It used to blank `_addRows` on every save, with the
         reasoning that people who earned nothing "don't need an entry and re-shoving them in read
         like the form was demanding them". That is true of a form you fill once and leave; it is
         wrong for a shift close, which is entered a person at a time across a whole night and
         reconciled against the cash at the end. Clearing it after the first server checked out took
         the rest of the crew off the screen, which is the defect the unfiltered loader fixes.
         ⭐ RELOAD instead: the shift comes back with every saved figure in place, so the manager can
         keep going, check Collected against the envelope, and see who is still owed. */
      this.preloadFromDate(this._addDate, this._addShiftType);
      if (!opts.silent) { this._savedNote = recs.length; this.renderList(); }
    } else {
      if (btn) { btn.disabled = false; this.recalcBatch(); }
      fail('Save failed. Try again.');
    }
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
        + '<button class="btn btn-ghost btn-sm" id="tl-export">Export PDF</button></div>'
      + '</div>';
    const custom = this.filterPreset !== 'custom' ? '' :
      '<div class="no-print" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 16px;">'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>From</label><input type="date" id="tl-f-from" value="' + esc(this.filterFrom) + '"/></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>To</label><input type="date" id="tl-f-to" value="' + esc(this.filterTo) + '"/></div>'
      + '</div>';
    return row + custom;
  },

  // ── Edit in a focused pop-up (day/period anchor + own tle- ids) ─────────────

  // Populate the staff dropdown: who logged hours on the picked day first (an
  // optgroup), then the rest of the roster.

  // When the staff dropdown changes — auto-fill hours from lc_actuals for this
  // staff member + the picked day. Operator can still override.



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
  },

  // ══ Tip Pool mode ════════════════════════════════════════════════════════════
  // The pool splits one amount across the day's crew by hours or equally. It shares
  // the week + day anchor with Log Tips (the toggle picks the mode); its own state
  // is _poolRows / _poolAmount / _poolMethod / _poolEditId, and it writes lc_tip_pools.

  // Preload the crew for a day from the posted schedule (call-out adjusted, hours
  // from logged-actuals-else-scheduled) via preloadFromDate, restoring the Log Tips
  // in-progress rows so a pool preload never clobbers a half-finished log entry.
  crewForDate(date) {
    if (!date) return [];
    const savedRows = this._addRows, savedDate = this._addDate, savedShift = this._addShiftType;
    /* ⛔ THE POOL NEEDS EVERYONE WHO WORKED, AND IT IS ABOUT MONEY, NOT DISPLAY: a pool is DIVIDED
       across the crew handed to it, so a missing person is not a missing row, it is a bigger share
       for everybody else. That used to need an `includeLogged` opt-out because the loader filtered;
       the filter is gone for both callers now, so this is a plain call again. */
    /* ⚠ THE PICKED SHIFT, not a hardcoded whole day. It passed '' while tips were per-day; with a
       shift row on the anchor, asking for the whole day would hand a lunch pool the dinner crew's
       hours and split the pot across people who were not there. `hoursFor` is period-scoped, so
       this also gives each person the hours they worked IN that shift, which is the denominator. */
    this.preloadFromDate(date, savedShift || '');
    const crew = (this._addRows || []).map(r => { const st = this.staffById(r.staff_id); return { staff_id: r.staff_id, name: st ? st.name : '', hours: (r.hours != null ? r.hours : '') }; });
    this._addRows = savedRows; this._addDate = savedDate; this._addShiftType = savedShift;
    return crew;
  },

  renderPool() {
    const equal = this._poolMethod === 'equal';
    const rows = this._poolRows || [];
    const rowHtml = rows.map((r, i) => this.poolRowHtml(r, i, equal)).join('');
    const rowsBlock = rows.length
      ? '<div class="pill-wrap" style="margin-bottom:12px;">'
        + '<table class="ing-tbl pill" style="table-layout:fixed;"><thead><tr>'
        + '<th style="width:240px;">Staff</th><th style="width:120px;">Hours</th>'
        + '<th style="width:130px;">Tip Share</th><th></th><th style="width:100px;"></th>'
        + '</tr></thead><tbody id="tp-rows">' + rowHtml + '</tbody></table></div>'
      : '<div class="card" style="padding:14px 20px;margin-bottom:12px;"><div id="tp-rows" style="font-size:12px;color:var(--t3);">No participants yet. Pick a day above to load the crew, or add one below.</div></div>';
    const calcAndHeads = rows.length
      ? '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
        + '<div class="calc-item"><div class="calc-label">Participants</div><div class="calc-val" id="tp-c-count">0</div></div>'
        + '<div class="calc-item"><div class="calc-label">Total Hours</div><div class="calc-val" id="tp-c-hours">0</div></div>'
        + '<div class="calc-item"><div class="calc-label">Allocated</div><div class="calc-val" id="tp-c-alloc">$0</div></div>'
        + '<div class="calc-item"><div class="calc-label">Unallocated</div><div class="calc-val" id="tp-c-rem">$0</div></div>'
        + '</div>'
        + '<div style="border:1px solid var(--gold-tint-bord);background:var(--gold-tint);border-radius:6px;padding:12px 14px;margin-top:16px;">'
          + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--amber);margin-bottom:5px;">Heads Up</div>'
          + '<div style="font-size:11px;color:var(--t2);line-height:1.6;">Bar Cop splits the pool by the method and hours you enter. It is a calculator, not legal or payroll advice. Tip pool eligibility, mandatory versus voluntary pooling, tip credit, and distribution rules vary by jurisdiction and change over time. Managers, owners, and some non-tipped roles may be barred from a pool. Verify who can participate and the rules for your jurisdiction before distributing tips.</div>'
        + '</div>'
      : '';
    // Two inset divider lines (not full-bleed) separate the three parts: the
    // toggle, the day picker, and the entry below. No boxes around each part.
    const divLine = '<div style="border-top:1px solid var(--b2);margin:14px 0 16px;"></div>';
    const wsBtn = '<button class="btn btn-ghost btn-sm no-print" id="tl-print-blank" type="button">Worksheet</button>';
    // Same move as the Log Tips card: the tabs sit above it, not inside its collapse body.
    const card = this.modeToggle()
      + '<div class="card form-card">'
      + App.collapsibleCardTitle('lc-tip-log', 'Tips', wsBtn)
      + '<div class="collapse-body">'
      + divLine
      + '<div id="tp-anchor">' + this.tlAnchor('tp', this._addWeekStart, this._addDate) + '</div>'
      + divLine
      + '<div class="form-row" style="gap:16px;margin-bottom:14px;flex-wrap:wrap;">'
      + '<div class="f" style="width:150px;flex-shrink:0;"><label>Pool Amount</label>'
      + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tp-pool" min="0" step="0.01" '
      + 'value="' + esc(this._poolAmount) + '"/></div></div>'
      + '<div class="f" style="width:160px;flex-shrink:0;"><label>Method</label>'
      + '<select id="tp-method"><option value="hours"' + (equal ? '' : ' selected') + '>By Hours Worked</option>'
      + '<option value="equal"' + (equal ? ' selected' : '') + '>Equal Split</option></select></div>'
      + '</div>'
      + rowsBlock
      + '<button class="btn btn-ghost btn-sm" id="tp-add">+ Add Participant</button>'
      + calcAndHeads
      + '</div></div>';
    const actionsRow = '<div data-collapse-group="lc-tip-log" style="margin:16px 0 24px;display:flex;align-items:center;gap:8px;">'
      + '<button class="btn btn-primary" id="tp-save">' + (this._poolEditId ? 'Update Tip Pool' : 'Save Tip Pool') + '</button>'
      + '<button class="btn btn-ghost" id="tp-clear">Start Over</button>'
      + '<span id="tp-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '</div>';

    this.container.innerHTML = '<div class="screen">' + card + actionsRow + this.poolBelow() + '</div>';

    const rowsEl = document.getElementById('tp-rows');
    if (rowsEl) {
      rowsEl.addEventListener('input', () => { this.collectPool(); this.recalcPool(); });
      rowsEl.addEventListener('change', ev => {
        this.collectPool();
        if (ev.target.classList && ev.target.classList.contains('tp-staff')) {
          const row = ev.target.closest('.tp-row');
          const idx = row ? parseInt(row.dataset.idx, 10) : -1;
          const hoursInp = row && row.querySelector('.tp-hours');
          if (idx >= 0 && hoursInp && !hoursInp.value && this._addDate) {
            const hrs = App.hoursFor(ev.target.value, this._addDate);
            if (hrs != null && hrs > 0) { hoursInp.value = hrs; if (this._poolRows[idx]) this._poolRows[idx].hours = hrs; }
          }
        }
        this.recalcPool();
      });
      rowsEl.addEventListener('click', ev => {
        if (ev.target.closest('.tp-remove')) {
          this.collectPool();
          this._poolRows.splice(parseInt(ev.target.closest('.tp-row').dataset.idx, 10), 1);
          this.renderPool();
        }
      });
    }
    document.getElementById('tp-add')?.addEventListener('click', () => { this.collectPool(); this._poolRows = this._poolRows || []; this._poolRows.push({ staff_id: '', hours: '' }); this.renderPool(); });
    document.getElementById('tp-method')?.addEventListener('change', e => { this.collectPool(); this._poolMethod = e.target.value; this.renderPool(); });
    document.getElementById('tp-save')?.addEventListener('click', () => this.savePool());
    document.getElementById('tp-clear')?.addEventListener('click', () => { this._poolEditId = null; this._poolAmount = ''; this._poolMethod = 'hours'; this._addDate = App.todayLocal(); this._addWeekStart = this.mondayOf(this._addDate); this._poolRows = this.crewForDate(this._addDate); this.renderPool(); });
    document.getElementById('tp-pool')?.addEventListener('input', () => this.onPoolInput());
    this.container.onclick = ev => {
      // ⛔ `.ch-tab` / `data-tab` must match what `modeToggle()` renders. See the note there.
      const modeSel = ev.target.closest('.ch-tab');
      if (modeSel) { this.switchMode(modeSel.dataset.tab); return; }
      const head = ev.target.closest('.card-collapse-head');
      if (head && !ev.target.closest('.btn')) { App.toggleCollapse(head); return; }
      if (ev.target.closest('.tp-wk-prev')) { this.collectPool(); this._addWeekStart = this.addDaysYmd(this._addWeekStart, -7); this.renderPool(); return; }
      if (ev.target.closest('.tp-wk-next')) { const nw = this.addDaysYmd(this._addWeekStart, 7); if (nw > this.mondayOf(App.todayLocal())) return; this.collectPool(); this._addWeekStart = nw; this.renderPool(); return; }
      if (ev.target.closest('.tp-wk-now')) { this.collectPool(); this._addWeekStart = this.mondayOf(App.todayLocal()); this.renderPool(); return; }
      const dayChip = ev.target.closest('.tp-day');
      if (dayChip) { this.loadPoolDay(dayChip.dataset.ymd); return; }

      if (ev.target.closest('#tl-export')) { const r = this.effectiveRange(); App.exportListPDF({ title: 'Tip Pool', root: this.container, lists: [['lc', 'tip_pool']], reRender: () => this.renderPool(), range: App.chipRangeLabel(this.RANGE_CHIPS, this.filterPreset, r.from, r.to) }); return; }
      if (ev.target.closest('#tl-print-blank')) { this.printBlankPool(); return; }
      const tpRange = ev.target.closest('.tl-range-chip');
      if (tpRange) {
        this.collectPool();
        const v = tpRange.dataset.v;
        if (v === 'custom') {
          if (this.filterPreset === 'custom') { this.filterPreset = this._prevPreset || 'last-4'; this.filterFrom = ''; this.filterTo = ''; }
          else { this._prevPreset = this.filterPreset; this.filterPreset = 'custom'; }
        } else { this.filterPreset = v; this.filterFrom = ''; this.filterTo = ''; }
        this.renderPool();
        return;
      }
      if (ev.target.closest('[data-show-older]')) { App.handleShowOlder(ev.target, () => this.renderPool()); return; }
      const hedit = ev.target.closest('.tp-hedit');
      const hdel = ev.target.closest('.tp-hdel');
      if (hdel) { ev.stopPropagation(); this.confirmDelPool(hdel.dataset.id); }
      else if (hedit) { ev.stopPropagation(); this.openPoolEditModal(hedit.dataset.id); }
    };
    App.applyCollapsed(this.container);
    document.getElementById('tl-f-from')?.addEventListener('change', e => { this.collectPool(); this.filterFrom = e.target.value || ''; this.renderPool(); });
    document.getElementById('tl-f-to')?.addEventListener('change',   e => { this.collectPool(); this.filterTo   = e.target.value || ''; this.renderPool(); });
    this.recalcPool();
  },

  poolRowHtml(r, i, equal) {
    r = r || {};
    return '<tr class="tp-row" data-idx="' + i + '">'
      + '<td><select class="form-input tp-staff" style="width:100%;">' + App.staffOptions(r.staff_id) + '</select></td>'
      + '<td><input class="form-input tp-hours" type="number" min="0" step="0.25" value="' + (r.hours != null && r.hours !== '' ? r.hours : '') + '"' + (equal ? ' disabled' : '') + ' style="width:100%;"/></td>'
      + '<td><div class="tp-share" style="font-weight:600;color:var(--t1);">-</div></td>'
      + '<td></td>'
      + '<td><button class="btn btn-ghost btn-sm tp-remove" type="button">Remove</button></td>'
      + '</tr>';
  },

  onPoolInput() {
    this._poolAmount = document.getElementById('tp-pool')?.value || '';
    this.recalcPool();
  },

  collectPool() {
    this._poolAmount = document.getElementById('tp-pool')?.value || '';
    const rows = [...document.querySelectorAll('.tp-row')];
    if (rows.length) {
      this._poolRows = rows.map(r => ({
        staff_id: r.querySelector('.tp-staff')?.value || '',
        hours: r.querySelector('.tp-hours')?.value || ''
      }));
    }
  },

  // Pick a day -> preload the participants. The pool amount stays operator-entered.
  loadPoolDay(date) {
    this.collectPool();
    this._addDate = date || this._addDate || App.todayLocal();
    this._addWeekStart = this.mondayOf(this._addDate);
    this._poolRows = this.crewForDate(this._addDate);
    this.renderPool();
  },

  // Shares for a set of rows. Defaults to the on-page builder's state; the edit
  // pop-up passes its own rows/amount/method.
  computeShares(rows, amount, method) {
    rows = rows || this._poolRows || [];
    const pool = parseFloat(amount != null ? amount : this._poolAmount) || 0;
    method = method || this._poolMethod;
    let totalHours = 0;
    rows.forEach(r => { totalHours += parseFloat(r.hours) || 0; });
    const valid = rows.filter(r => r.staff_id);
    return rows.map(r => {
      let share = 0;
      if (method === 'equal') { share = valid.length ? pool / valid.length : 0; }
      else { const h = parseFloat(r.hours) || 0; share = totalHours > 0 ? pool * (h / totalHours) : 0; }
      return { staff_id: r.staff_id, hours: parseFloat(r.hours) || 0, share: r.staff_id ? share : 0 };
    });
  },

  recalcPool() {
    const shares = this.computeShares();
    const rowEls = [...document.querySelectorAll('.tp-row')];
    let alloc = 0, totalHours = 0, count = 0;
    rowEls.forEach((el, i) => {
      const s = shares[i]; if (!s) return;
      const shareEl = el.querySelector('.tp-share');
      if (shareEl) shareEl.textContent = s.staff_id ? App.fmtCurrency(s.share, 2) : '-';
      alloc += s.share; totalHours += s.hours; if (s.staff_id) count++;
    });
    const pool = parseFloat(this._poolAmount) || 0;
    const set = (id, v, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = v; if (cls !== undefined) el.className = 'calc-val' + (cls ? ' ' + cls : ''); };
    set('tp-c-count', count);
    set('tp-c-hours', totalHours.toFixed(2).replace(/\.00$/, ''));
    set('tp-c-alloc', App.fmtCurrency(alloc, 2));
    const rem = pool - alloc;
    set('tp-c-rem', App.fmtCurrency(rem, 2), Math.abs(rem) > 0.01 ? 'warn' : 'good');
  },

  async savePool() {
    this.collectPool();
    const err = document.getElementById('tp-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    if (!this._addDate) { fail('Date is required.'); return; }
    const pool = parseFloat(this._poolAmount);
    if (isNaN(pool) || pool <= 0) { fail('Enter the pool amount.'); return; }
    const shares = this.computeShares().filter(s => s.staff_id);
    if (shares.length === 0) { fail('Add at least one participant.'); return; }
    if (this._poolMethod === 'hours' && shares.every(s => s.hours <= 0)) { fail('Enter hours for the hours-based split.'); return; }

    /* ⚠⚠ ONE POOL PER DAY, OR SAY WHY NOT (L7). Nothing checked, and `tipShareForStaffInWeek` adds
       EVERY pool in the week straight into the tip-credit basis — so a second pool on one date
       double-counts silently into a legal-adjacent number and into the payroll worksheet. Measured
       on the live app: a barback's week read $410.65 in tips ($110.65 + $300 from two pools on one
       day) against $378 of wages, and it exported that way.
       The Log Tips half of this very screen already guards its own duplicate and says so out loud;
       the pool had nothing. ASK rather than refuse — a house that runs a lunch and a dinner pot is
       real — and name the pool already on file, the way the drawer-count guard names the count. */
    const priorPool = this.pools().find(x => x && x.id !== this._poolEditId && x.date === this._addDate);
    if (priorPool) {
      const okDup = await App.confirm({
        title: 'A tip pool is already saved for that day',
        message: 'That day already has a pool of ' + App.fmtCurrency(priorPool.pool_amount || 0)
          + ' split between ' + ((priorPool.participants || []).length) + ' people. Tips are tracked per DAY, so a'
          + ' second pool adds to everyone\'s tip income for the week, including the tip-credit check and the'
          + ' payroll worksheet. Cancel and edit the existing pool unless this really was a separate pot.',
        confirmText: 'Save anyway', cancelText: 'Cancel', danger: true
      });
      if (!okDup) return;   // runs before the Save button is disabled, so there is nothing to restore
    }

    let totalHours = 0;
    const participants = shares.map(s => { totalHours += s.hours; const staff = this.staffById(s.staff_id); return { staff_id: s.staff_id, name: staff ? staff.name : '', hours: s.hours, share: s.share }; });

    // Anchor the pool to its day via the shared per-day key, so Form 8027 + Tip
    // History group pool splits together with the matching Tip Log entries.
    const existing = this._poolEditId ? this.pools().find(x => x.id === this._poolEditId) : null;
    const rec = {
      id:          this._poolEditId || App.uid(),
      /* ⛔ THE POOL IS PER SHIFT FOR THE SAME REASON THE LOG IS: a lunch crew's pool is not split
         with the dinner crew. These were hardcoded blank when tips were flattened to per-day; the
         shift row on the anchor now feeds them, and `App.tipShiftKey` has always been what joins a
         pool to its Tip Log entries in Books and Tip History. */
      shift_id:    App.tipShiftKey(this._addDate, this._addShiftType || ''),
      date:        this._addDate,
      shift_type:  this._addShiftType || '',
      method:      this._poolMethod,
      pool_amount: pool,
      total_hours: totalHours,
      participants,
      created_at:  (existing && existing.created_at) ? existing.created_at : new Date().toISOString()
    };
    if (this._poolEditId) rec.updated_at = new Date().toISOString();

    const btn = document.getElementById('tp-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const idx = this._poolEditId ? this.pools().findIndex(x => x.id === this._poolEditId) : -1;
    if (idx >= 0) this.pools()[idx] = rec; else this.pools().push(rec);
    const ok = await App.putRecord('lc', 'tip_pool', rec);
    if (ok) {
      // Reset to a fresh, ready pool for today (matches the Log Tips post-save feel).
      this._poolEditId = null; this._poolAmount = ''; this._poolMethod = 'hours';
      this._addDate = App.todayLocal(); this._addWeekStart = this.mondayOf(this._addDate);
      this._poolRows = this.crewForDate(this._addDate);
      this.renderPool();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = this._poolEditId ? 'Update Tip Pool' : 'Save Tip Pool'; }
      fail('Save failed. Try again.');
    }
  },

  // Edit a saved pool in a focused pop-up (matches the Log Tips edit), own 'tpe-'
  // ids so the modal's rows never collide with the on-page builder behind it.
  openPoolEditModal(id) {
    if (!App.canEdit('lc-tip-log')) return;
    const p = this.pools().find(x => x.id === id);
    if (!p) return;
    this._peEditId = id;
    this._peDate = p.date || App.todayLocal();
    this._peAmount = (p.pool_amount != null) ? String(p.pool_amount) : '';
    this._peMethod = p.method || 'hours';
    this._peRows = (p.participants || []).map(pt => ({ staff_id: pt.staff_id || '', hours: (pt.hours != null ? pt.hours : '') }));
    this.renderPoolEditModal();
  },
  renderPoolEditModal() {
    const equal = this._peMethod === 'equal';
    const rows = this._peRows || [];
    const rowHtml = rows.map((r, i) => this.poolEditRowHtml(r, i, equal)).join('');
    const html = '<div class="card form-card" style="margin:0;"><div class="card-title">Edit Tip Pool</div>'
      + '<div class="form-row" style="gap:14px;">'
        + '<div class="f" style="flex:1 1 0;min-width:0;"><label>Date</label>'
          + '<input type="date" id="tpe-date" value="' + esc(this._peDate || App.todayLocal()) + '"/></div>'
        + '<div class="f" style="flex:1 1 0;min-width:0;"><label>Pool Amount</label>'
          + '<div class="fw"><span class="pre">$</span><input class="pre" type="number" id="tpe-pool" min="0" step="0.01" value="' + esc(this._peAmount) + '"/></div></div>'
        + '<div class="f" style="flex:1 1 0;min-width:0;"><label>Method</label>'
          + '<select id="tpe-method"><option value="hours"' + (equal ? '' : ' selected') + '>By Hours Worked</option>'
          + '<option value="equal"' + (equal ? ' selected' : '') + '>Equal Split</option></select></div>'
      + '</div>'
      + '<div style="max-height:38vh;overflow-y:auto;padding-right:8px;">'
        + '<div style="overflow-x:auto;margin-bottom:12px;"><table class="ing-tbl pill" style="table-layout:fixed;"><thead><tr>'
        + '<th>Staff</th><th style="width:80px;">Hours</th><th style="width:100px;">Tip Share</th><th style="width:96px;"></th>'
        + '</tr></thead><tbody id="tpe-rows">' + rowHtml + '</tbody></table></div></div>'
      + '<button class="btn btn-ghost btn-sm" id="tpe-add">+ Add Participant</button>'
      + '<div class="calc" style="margin-top:14px;margin-bottom:0;">'
        + '<div class="calc-item"><div class="calc-label">Allocated</div><div class="calc-val" id="tpe-c-alloc">$0</div></div>'
        + '<div class="calc-item"><div class="calc-label">Unallocated</div><div class="calc-val" id="tpe-c-rem">$0</div></div>'
      + '</div>'
      + '<div class="card-actions">'
        + '<button class="btn btn-primary" id="tpe-save">Update</button>'
        + '<span id="tpe-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
        + '<button class="btn btn-danger" id="tpe-del" style="margin-left:auto;">Delete</button>'
      + '</div></div>';
    App.openModal(html, { id: 'tp-edit-modal', maxWidth: 560, noClose: true });
    const rowsEl = document.getElementById('tpe-rows');
    if (rowsEl) {
      rowsEl.addEventListener('input', () => { this.collectPoolEdit(); this.recalcPoolEdit(); });
      rowsEl.addEventListener('change', ev => {
        this.collectPoolEdit();
        if (ev.target.classList && ev.target.classList.contains('tpe-staff')) {
          const row = ev.target.closest('.tpe-row');
          const idx = row ? parseInt(row.dataset.idx, 10) : -1;
          const hoursInp = row && row.querySelector('.tpe-hours');
          if (idx >= 0 && hoursInp && !hoursInp.value && this._peDate) {
            const hrs = App.hoursFor(ev.target.value, this._peDate);
            if (hrs != null && hrs > 0) { hoursInp.value = hrs; if (this._peRows[idx]) this._peRows[idx].hours = hrs; }
          }
        }
        this.recalcPoolEdit();
      });
      rowsEl.addEventListener('click', ev => {
        if (ev.target.closest('.tpe-remove')) { this.collectPoolEdit(); this._peRows.splice(parseInt(ev.target.closest('.tpe-row').dataset.idx, 10), 1); this.renderPoolEditModal(); }
      });
    }
    document.getElementById('tpe-add')?.addEventListener('click', () => { this.collectPoolEdit(); this._peRows = this._peRows || []; this._peRows.push({ staff_id: '', hours: '' }); this.renderPoolEditModal(); });
    document.getElementById('tpe-method')?.addEventListener('change', e => { this.collectPoolEdit(); this._peMethod = e.target.value; this.renderPoolEditModal(); });
    document.getElementById('tpe-pool')?.addEventListener('input', () => { this._peAmount = document.getElementById('tpe-pool')?.value || ''; this.recalcPoolEdit(); });
    document.getElementById('tpe-date')?.addEventListener('change', e => { this._peDate = e.target.value || this._peDate; });
    document.getElementById('tpe-save')?.addEventListener('click', () => this.savePoolEdit());
    document.getElementById('tpe-del')?.addEventListener('click', () => { const id = this._peEditId; this._peEditId = null; App.closeModal('tp-edit-modal'); this.confirmDelPool(id); });
    this.recalcPoolEdit();
  },
  poolEditRowHtml(r, i, equal) {
    r = r || {};
    return '<tr class="tpe-row" data-idx="' + i + '">'
      + '<td><select class="form-input tpe-staff" style="width:100%;">' + App.staffOptions(r.staff_id) + '</select></td>'
      + '<td><input class="form-input tpe-hours" type="number" min="0" step="0.25" value="' + (r.hours != null && r.hours !== '' ? r.hours : '') + '"' + (equal ? ' disabled' : '') + ' style="width:100%;"/></td>'
      + '<td><div class="tpe-share" style="font-weight:600;color:var(--t1);">-</div></td>'
      + '<td style="text-align:right;padding-right:12px;"><button class="btn btn-ghost btn-sm tpe-remove" type="button">Remove</button></td>'
      + '</tr>';
  },
  collectPoolEdit() {
    this._peAmount = document.getElementById('tpe-pool')?.value || '';
    const rows = [...document.querySelectorAll('.tpe-row')];
    if (rows.length) {
      this._peRows = rows.map(r => ({ staff_id: r.querySelector('.tpe-staff')?.value || '', hours: r.querySelector('.tpe-hours')?.value || '' }));
    }
  },
  recalcPoolEdit() {
    const shares = this.computeShares(this._peRows, this._peAmount, this._peMethod);
    const rowEls = [...document.querySelectorAll('.tpe-row')];
    let alloc = 0;
    rowEls.forEach((el, i) => { const s = shares[i]; if (!s) return; const shareEl = el.querySelector('.tpe-share'); if (shareEl) shareEl.textContent = s.staff_id ? App.fmtCurrency(s.share, 2) : '-'; alloc += s.share; });
    const pool = parseFloat(this._peAmount) || 0;
    const set = (id, v, cls) => { const el = document.getElementById(id); if (!el) return; el.textContent = v; if (cls !== undefined) el.className = 'calc-val' + (cls ? ' ' + cls : ''); };
    set('tpe-c-alloc', App.fmtCurrency(alloc, 2));
    const rem = pool - alloc;
    set('tpe-c-rem', App.fmtCurrency(rem, 2), Math.abs(rem) > 0.01 ? 'warn' : 'good');
  },
  async savePoolEdit() {
    this.collectPoolEdit();
    const err = document.getElementById('tpe-err');
    const fail = m => { if (err) { err.textContent = m; err.style.display = 'inline'; } };
    const date = document.getElementById('tpe-date')?.value || this._peDate || '';
    if (!date) { fail('Date is required.'); return; }
    const pool = parseFloat(this._peAmount);
    if (isNaN(pool) || pool <= 0) { fail('Enter the pool amount.'); return; }
    const shares = this.computeShares(this._peRows, this._peAmount, this._peMethod).filter(s => s.staff_id);
    if (shares.length === 0) { fail('Add at least one participant.'); return; }
    if (this._peMethod === 'hours' && shares.every(s => s.hours <= 0)) { fail('Enter hours for the hours-based split.'); return; }
    let totalHours = 0;
    const participants = shares.map(s => { totalHours += s.hours; const staff = this.staffById(s.staff_id); return { staff_id: s.staff_id, name: staff ? staff.name : '', hours: s.hours, share: s.share }; });
    const existing = this.pools().find(x => x.id === this._peEditId);
    const rec = {
      id: this._peEditId, shift_id: App.tipShiftKey(date, ''), date, shift_type: '',
      method: this._peMethod, pool_amount: pool, total_hours: totalHours, participants,
      created_at: (existing && existing.created_at) ? existing.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const btn = document.getElementById('tpe-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const idx = this.pools().findIndex(x => x.id === this._peEditId);
    if (idx >= 0) this.pools()[idx] = rec; else this.pools().push(rec);
    const ok = await App.putRecord('lc', 'tip_pool', rec);
    if (ok) { this._peEditId = null; App.closeModal('tp-edit-modal'); this.renderPool(); }
    else { if (btn) { btn.disabled = false; btn.textContent = 'Update'; } fail('Save failed. Try again.'); }
  },

  // Saved Tip Pools: a stats strip + range filter (the same chips/Export/Worksheet
  // row Log Tips carries) sitting on top of the pool history list. Filter state is
  // shared with Log Tips, so the range you pick holds across both modes.
  poolBelow() {
    const all = [...this.pools()].sort((a, b) =>
      new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());
    const emptyList = msg => '<div class="card" style="overflow-x:auto;margin-top:24px;"><table class="row-list"><thead><tr>'
      + '<th>Date</th><th>Method</th><th>Pool</th><th>Participants</th><th></th>'
      + '</tr></thead><tbody><tr><td colspan="5" style="color:var(--t3);">' + msg + '</td></tr></tbody></table></div>';
    if (all.length === 0) return emptyList('No tip pools logged yet. Build one above and Save Tip Pool.');

    const filtered = this.applyFilters(all);
    const totalPooled = filtered.reduce((t, p) => t + (parseFloat(p.pool_amount) || 0), 0);
    const avgPool = filtered.length ? totalPooled / filtered.length : 0;
    const statsCard = '<div class="card"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + '<div class="calc-item"><div class="calc-label">Pools</div><div class="calc-val lg">' + filtered.length + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Total Pooled</div><div class="calc-val lg">' + App.fmtCurrency(totalPooled) + '</div></div>'
      + '<div class="calc-item"><div class="calc-label">Avg Pool</div><div class="calc-val lg">' + App.fmtCurrency(avgPool) + '</div></div>'
      + '</div></div>';

    if (filtered.length === 0) return statsCard + this.filterRow() + emptyList('No tip pools in this range. Pick a wider range above.');

    const rows = filtered.slice(0, App.listLimit('lc', 'tip_pool')).map(p => '<tr data-id="' + p.id + '">'
      + '<td><div class="val">' + this.fmtDate(p.date) + '</div></td>'
      + '<td>' + (p.method === 'equal' ? 'Equal Split' : 'By Hours') + '</td>'
      + '<td class="val">' + App.fmtCurrency(p.pool_amount || 0, 2) + '</td>'
      + '<td>' + ((p.participants || []).length) + '</td>'
      + '<td><div class="row-actions">'
      + '<button class="btn btn-ghost btn-sm tp-hedit" data-id="' + p.id + '">Edit</button>'
      + '<button class="btn btn-danger btn-sm tp-hdel" data-id="' + p.id + '">Delete</button>'
      + '</div></td></tr>').join('');
    const listHtml = '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Date</th><th>Method</th><th>Pool</th><th>Participants</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + App.showOlderBar('lc', 'tip_pool', filtered, this.filterPreset !== 'all');
    return statsCard + this.filterRow() + listHtml;
  },

  // Blank pool worksheet (the Worksheet button in Tip Pool mode): tally hours per
  // person and split the pool by hand, then enter the result into Bar Cop.
  printBlankPool() {
    App.printBlankSheet({
      title: 'Tip Pool Worksheet',
      subtitle: 'Tally each person\'s hours, then split the pool. Manager enters the result into Bar Cop after close.',
      columns: [
        { label: 'Staff Name', width: '34%' },
        { label: 'Hours',      width: '16%' },
        { label: 'Pool Share', width: '20%' },
        { label: 'Notes',      width: '30%' }
      ],
      rows: 14
    });
  },


  async confirmDelPool(id) {
    if (!(await App.confirmDelete())) return;
    await App.removeRecord('lc', 'tip_pool', id);
    this.renderPool();
  }
};
