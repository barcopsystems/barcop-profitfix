'use strict';

/* ── Profit Recovery — This Week (weekly confirm + history) ───────────────────
   Matches the Control entry-page standard (Build Schedule / Log Hours / Receive
   Delivery): a stat strip up top, a week-chip selector row (chips left, page
   actions right), the confirm grid, Save + Start Over below the card, then a
   filter-chip row and a view/edit history table. Revenue rolls up from the
   week's imported POS sales (the Shift cockpit's weekly "sales by day" import),
   COGS from Inventory, labor from Labor Control; the operator confirms. Stepping
   the selector to a saved week loads it for edit; Save updates that record. Saves
   to App.data.weeks. */

S.ThisWeek = {
  draft: null,
  _weekEnd: null,
  _editId: null,
  _msg: '',
  DRAFT_KEY: 'pf_draft',
  filterPreset: 'last-12',
  _prevPreset: 'last-12',
  filterFrom: '',
  filterTo: '',
  RANGE_CHIPS: [
    { v: 'this-month', label: 'This Month' },
    { v: 'last-4', label: 'Last 4 Weeks' },
    { v: 'last-12', label: 'Last 12 Weeks' },
    { v: 'all', label: 'All' },
    { v: 'custom', label: 'Custom' }
  ],
  get BAR_CATS()     { return App.BAR_CATS; },
  get KITCHEN_CATS() { return App.KITCHEN_CATS; },

  // Days of slop allowed on what should be a 7-day count span. Wide enough for an
  // operator who counts Saturday one week and Monday the next, tight enough that a
  // half-week or a month can never be booked as a week.
  COGS_WEEK_TOL: 2,

  // ── Inventory Control COGS feed ───────────────────────────────────────────
  icCOGS(cats, periodEnd) {
    const counts = [...((App.inventoryData && App.inventoryData.ic_counts) || [])]
      .sort(App.cmpOldest);
    if (counts.length < 2) return null;
    const cdate = c => String((c && (c.date || c.created_at)) || '').slice(0, 10);
    // Scope to the count pair ending on or before the selected week, so loading a
    // past week pulls THAT week's usage, not the most recent counts. With no
    // periodEnd (or no count pair on/before it) fall back to the latest pair.
    let endIdx = counts.length - 1;
    if (periodEnd) {
      let idx = -1;
      for (let i = counts.length - 1; i >= 0; i--) { if (cdate(counts[i]) <= periodEnd) { idx = i; break; } }
      if (idx < 1) return null;   // no count pair on or before this week → no honest COGS
      endIdx = idx;
    }
    const startC = counts[endIdx - 1], endC = counts[endIdx];
    // The pair has to approximately COVER this week or its usage is not this week's
    // usage. Nothing above constrained it to 7 days: an operator who counts MONTHLY has
    // counts on Apr 30 and May 31, so confirming the week ending Jun 8 picked that pair
    // and booked ALL OF MAY'S usage onto that one week. Prime read about 4x and carried
    // into Books and the annual sheets as an actual, while the readiness check went
    // green (it only tests != null). Same stance as the "no count pair" return above:
    // with no honest weekly COGS, say nothing rather than invent a number. The cell is
    // still there to type into.
    if (periodEnd) {
      const gap = (a, b) => Math.round((new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime()) / 86400000);
      const eD = cdate(endC), sD = cdate(startC);
      if (!eD || !sD) return null;
      const TOL = this.COGS_WEEK_TOL;
      // 1. The pair spans about a week. Not a month, and not a half week either.
      if (Math.abs(gap(eD, sD) - 7) > TOL) return null;
      // 2. It is recent enough to BE this week. Test the span, never the alignment to
      //    periodEnd: the current week's end is in the FUTURE (Dashboard.weekEnd is
      //    App.nextSunday), so the closing count cannot land on it while the week is
      //    still running. Allow up to a week back, which covers both an operator who
      //    counted today and one who counts every Sunday and has last week's close as
      //    their newest count. Beyond that the pair belongs to an earlier week.
      if (gap(periodEnd, eD) > 7 + TOL) return null;
    }
    // ⚠ This was a hand-rolled copy of the usage math and it had drifted TWICE from
    // App.computeUsagePair, the canonical reader every other usage screen goes through:
    //   1. it read a product the operator SKIPPED in the closing count (counted:false, stored
    //      total:0) as a real zero, so used = starting + purchases billed the WHOLE SHELF as
    //      consumed — and partial counts are the normal case, not the edge case;
    //   2. `sMap[pid] = it` kept only the LAST row for a product counted in several locations,
    //      so both ends were understated, and not symmetrically.
    // This is weekly COGS and prime cost on the Dashboard, and it is what Confirm the Week writes
    // down. It goes through the same door as everything else now. computeUsagePair also drops any
    // product without a real value at BOTH ends, which is the same "say nothing rather than invent
    // a number" stance as the guards above.
    const pair = App.computeUsagePair(startC, endC, (App.inventoryData && App.inventoryData.ic_deliveries) || []);
    let cogs = 0, any = false;
    Object.keys(pair).forEach(pid => {
      const u = pair[pid];
      // Live product category first (a recategorised product buckets where it lives NOW), falling
      // back to the category the count itself recorded so a since-deleted product still counts —
      // its stock was poured either way, and every other usage screen already includes it.
      const cat = (u.product && u.product.category) || u.category || '';
      if (!cats.includes(cat) || u.unitCost == null) return;
      cogs += u.rawUsed * u.unitCost;
      any = true;
    });
    return any ? cogs : null;
  },

  // ── Weekly sales feed: the per-day POS sales imported in Shift (sc_shifts) ──
  // Revenue lands in sc_shifts via the weekly "sales by day" import on the Shift
  // cockpit (the POS is the system of record for sales), and rolls up to the
  // week here. The operator confirms it; nothing is captured live.
  salesRevenue(periodEnd) {
    const days = (App.shiftData && App.shiftData.sc_shifts) || [];
    if (!days.length || !periodEnd) return null;
    const startD = new Date(periodEnd + 'T00:00:00');
    if (isNaN(startD.getTime())) return null;
    startD.setDate(startD.getDate() - 6);
    const start = App.ymdLocal(startD);
    let bar = 0, food = 0, any = false;
    days.forEach(s => {
      if (!s.date || s.date < start || s.date > periodEnd) return;
      bar += s.bar_revenue || 0;
      food += s.floor_revenue || 0;
      any = true;
    });
    return any ? { bar, food } : { bar: 0, food: 0 };
  },

  // ── Labor Control labor feed (7-day week ending periodEnd) ────────────────
  // Prime-cost labor is the hourly floor/BOH/FOH labor that scales with volume.
  // Salaried management is a fixed cost that lands in Books as an operating
  // expense, so it is deliberately NOT folded into prime cost here (keeps This
  // Week's prime in step with the booked weekly P&L and the dashboard).
  laborCost(periodEnd) {
    if (!periodEnd) return null;
    const actuals = (App.laborData && App.laborData.lc_actuals) || [];
    const startD = new Date(periodEnd + 'T00:00:00');
    if (isNaN(startD.getTime())) return null;
    startD.setDate(startD.getDate() - 6);
    const start = App.ymdLocal(startD);
    const posDept = {};
    ((App.laborData && App.laborData.lc_positions) || []).forEach(p => { posDept[p.id] = p.department; });
    // Staff hours charged to an offsite event this week belong on the Events line,
    // not bar/food, so skip them here to avoid double-counting that labor.
    const evKeys = this.offsiteEventStaffKeys(periodEnd);
    let bar = 0, food = 0, any = false;
    const wkRows = [];
    actuals.forEach(a => {
      if (!a.date || a.date < start || a.date > periodEnd) return;
      // EVERY row this week feeds the overtime test, event days included: overtime is
      // a weekly, whole-person threshold, so an offsite Saturday still counts toward
      // that person's 40. Only the Bar/Food money split skips event rows (below).
      wkRows.push(a);
      if (evKeys.has(a.staff_id + '|' + String(a.date).slice(0, 10))) return;
      any = true;
      if (posDept[a.position_id] === 'Bar') bar += a.cost || 0;
      else food += a.cost || 0;
    });
    // Overtime premium (0.5x on weekly hours over 40) is NOT stored in a.cost
    // (straight time only), so add it here or the booked weekly P&L and prime cost
    // understate labor exactly on the weeks someone runs into overtime. Split it
    // across Bar/Food by their share of this week's hourly cost, same as salary.
    // It is measured on wkRows = the FULL week. Measuring it on the bar/food rows
    // alone tested a partial week: a bartender with 35 floor hours plus a 10-hour
    // offsite event read 35, drew no premium, and the event day came back through
    // cateringFromBookings at straight time, so the premium vanished from the week
    // entirely. r-this-week.laborFeed has always run OT over all rows; the two feeds
    // disagreed on the same week.
    // The premium lands on Bar/Food because it is a payroll consequence of the whole
    // week's schedule, not a cost of one booking: a weekly threshold cannot be
    // attributed to a single event, which is why EB.bookingLabor stays straight time
    // and the per-event margin on the Events screen must not move. Prime cost sums
    // every line, so the week's total is right either way.
    const otPrem = App.otPremiumForRows ? App.otPremiumForRows(wkRows).total : 0;
    if (otPrem > 0) {
      const h = bar + food;
      if (h > 0) { bar += otPrem * (bar / h); food += otPrem * (food / h); }
      else { food += otPrem; }
      any = true;   // a real premium means real labor this week, same as salary below
    }
    // Salaried (exempt) pay is fixed weekly labor on top of hourly wages, same as
    // Revenue's feed. Bar Cop can stand behind it (annual / 52), so it belongs in the
    // week's labor. Split across Bar and Food by their share of this week's hourly
    // labor so overhead management pay does not distort either line.
    const sal = App.salariedCost ? (App.salariedCost(start, periodEnd).total || 0) : 0;
    if (sal > 0) {
      const h = bar + food;
      if (h > 0) { bar += sal * (bar / h); food += sal * (food / h); }
      else { food += sal; }
      any = true;
    }
    return any ? { bar, food } : { bar: 0, food: 0 };
  },

  // ── Dates ───────────────────────────────────────────────────────────────
  currentWeekEnd() { return App.nextSunday ? App.nextSunday() : App.todayLocal(); },
  addDays(ymd, n) { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return App.ymdLocal(d); },
  fmtChip(ymd) { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); },
  fmtDate(ymd) { if (!ymd) return '-'; const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? esc(ymd) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); },
  savedWeek(periodEnd) { return (App.data.weeks || []).find(w => w.period_end === periodEnd) || null; },
  // The period_end of the most recent saved week (This Week opens here, so it
  // lands on real numbers instead of the in-progress, partial current week).
  mostRecentSavedEnd() {
    const ends = (App.data.weeks || []).map(w => w.period_end).filter(Boolean).sort();
    return ends.length ? ends[ends.length - 1] : null;
  },
  // "Jun 15 - Jun 21" for the 7-day week ending on `end` (Sunday). Uses the
  // shared App.dateRangeLabel so the format matches every other week selector.
  weekRangeLabel(end) { return App.dateRangeLabel(App.weekStartFor(end), end); },

  // The Events line for this week, read straight from the Events section. Offsite
  // jobs ONLY: an in-house event runs inside a normal shift, so its revenue is
  // already in bar/food above and counting it here too would double it. Revenue,
  // COGS, and labor all come from the booking, so the row is read-only, never
  // hand-typed. Labor is the event staff you checked in Build Schedule, the same
  // figure the Event P&L shows (and excluded from bar/food labor above).
  cateringFromBookings(periodEnd) {
    const blank = { revenue: '', cogs: '', labor: '' };
    if (!periodEnd) return blank;
    const EB = window.S && S.EventsBookings;
    let rev = 0, cogs = 0, labor = 0;
    this.offsiteBookings(periodEnd).forEach(b => {
      rev   += parseFloat(b.actual_revenue) || 0;
      // Include event_other_cost so this catering COGS matches the Event P&L cost basis
      // (ev-bookings margin = food + bar + other + labor). Omitting it overstated Books
      // catering margin and dropped that cost from prime entirely.
      cogs  += (parseFloat(b.event_food_cost) || 0) + (parseFloat(b.event_bar_cost) || 0) + (parseFloat(b.event_other_cost) || 0);
      labor += EB ? (EB.bookingLabor(b) || 0) : 0;
    });
    return (rev > 0 || cogs > 0 || labor > 0)
      ? { revenue: rev ? rev.toFixed(2) : '', cogs: cogs ? cogs.toFixed(2) : '', labor: labor ? labor.toFixed(2) : '' }
      : blank;
  },

  // Completed offsite bookings whose event date falls in the selected week.
  offsiteBookings(periodEnd) {
    if (!periodEnd) return [];
    const start = App.weekStartFor(periodEnd);
    return (App.data.bookings || []).filter(b => {
      if (b.stage !== 'Completed' || !b.event_date) return false;
      const ed = String(b.event_date).slice(0, 10);
      if (ed < start || ed > periodEnd) return false;
      return b.event_type === 'Catering (Offsite)' || /offsite/i.test(b.space || '');
    });
  },

  // (staff_id|date) pairs charged to an offsite event this week, so bar/food labor
  // can skip them (their cost lands on the Events line instead, never twice).
  offsiteEventStaffKeys(periodEnd) {
    const keys = new Set();
    const EB = window.S && S.EventsBookings;
    if (!EB || typeof EB.eventStaffShifts !== 'function') return keys;
    this.offsiteBookings(periodEnd).forEach(b => {
      EB.eventStaffShifts(b).forEach(sh => { if (sh.staff_id && sh._iso) keys.add(sh.staff_id + '|' + sh._iso); });
    });
    return keys;
  },

  // ── Draft (localStorage; only the unsaved current-week confirm persists) ──
  freshDraft(periodEnd) {
    const bc = this.icCOGS(this.BAR_CATS, periodEnd), fc = this.icCOGS(this.KITCHEN_CATS, periodEnd);
    const sr = this.salesRevenue(periodEnd);
    const lc = this.laborCost(periodEnd);
    // Revenue rolls up from the week's imported POS sales (Shift), COGS from
    // Inventory counts, labor from logged hours. The operator confirms.
    return {
      period_end: periodEnd,
      bar:  { revenue: sr && sr.bar ? sr.bar.toFixed(2) : '', labor: lc && lc.bar ? lc.bar.toFixed(2) : '', cogs: bc != null ? bc.toFixed(2) : '' },
      food: { revenue: sr && sr.food ? sr.food.toFixed(2) : '', labor: lc && lc.food ? lc.food.toFixed(2) : '', cogs: fc != null ? fc.toFixed(2) : '' },
      catering: this.cateringFromBookings(periodEnd),
      other: { revenue: '', cogs: '' },
      platform_fees: '',
      notes: ''
    };
  },
  draftFromWeek(w) {
    const s = v => (v == null || v === '' ? '' : Number(v).toFixed(2));
    return {
      period_end: w.period_end,
      bar:  { revenue: s(w.bar?.revenue),  labor: s(w.bar?.labor),  cogs: s(w.bar?.cogs) },
      food: { revenue: s(w.food?.revenue), labor: s(w.food?.labor), cogs: s(w.food?.cogs) },
      catering: { revenue: s(w.catering?.revenue), cogs: s(w.catering?.cogs), labor: s(w.catering?.labor) },
      other: { revenue: s(w.other?.revenue), cogs: s(w.other?.cogs) },
      platform_fees: s(w.platform_fees),
      notes: w.notes || ''
    };
  },
  saveDraft() { if (this._editId) return; try { localStorage.setItem(this.DRAFT_KEY, JSON.stringify({ weekEnd: this._weekEnd, draft: this.draft })); } catch (e) {} },
  clearDraft() { try { localStorage.removeItem(this.DRAFT_KEY); } catch (e) {} },
  readDraft(weekEnd) {
    try { const r = localStorage.getItem(this.DRAFT_KEY); if (r) { const o = JSON.parse(r); if (o && o.weekEnd === weekEnd && o.draft) return o.draft; } } catch (e) {}
    return null;
  },

  // Load a week into the grid: saved → editable (carry its id), else a fresh
  // Control pull (with the current-week localStorage draft restored if present).
  loadWeek(weekEnd) {
    this._weekEnd = weekEnd;
    const saved = this.savedWeek(weekEnd);
    if (saved) {
      this.draft = this.draftFromWeek(saved);
      this._editId = saved.id;
    } else {
      this._editId = null;
      const dr = (weekEnd === this.currentWeekEnd()) ? this.readDraft(weekEnd) : null;
      this.draft = dr || this.freshDraft(weekEnd);
    }
    // The Events line is always read-only and pulled live from the Events section,
    // so it reflects current bookings on every load (saved weeks included).
    this.draft.catering = this.cateringFromBookings(weekEnd);
  },

  // ── History filter range ──────────────────────────────────────────────────
  effectiveRange() {
    if (this.filterPreset === 'custom') return { from: this.filterFrom || '', to: this.filterTo || '' };
    return App.datePresetRange(this.filterPreset);
  },

  // ── Render ────────────────────────────────────────────────────────────────
  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    if (!this._weekEnd) this.loadWeek(this.currentWeekEnd());
    // One-shot deep-link from Reports and History "Edit in This Week": load the
    // requested saved week into the grid for editing, then clear the handoff.
    if (this._focusWeekId) {
      const fw = (App.data.weeks || []).find(x => x.id === this._focusWeekId);
      this._focusWeekId = null;
      if (fw) this.loadWeek(fw.period_end);
    }
    this.draw();
  },

  showHowTo() {
    App.showHelpModal('How Run This Week Works', [
      { p: ['This is the weekly confirm. Bar Cop pulls the week in from Control: revenue from your weekly POS sales import in Shift, COGS from Inventory Control, labor from Labor Control. You read the money picture up top, confirm the grid, and save.'] },
      { h: 'The Week Selector', p: ['Each chip shows a week as its date range, for example Jun 15 - Jun 21. This Week opens on the current week, tagged NOW. Step back with the arrows to review or correct an earlier week, and This Week snaps you back to the current week. The numbers below always reflect the week you have selected. Stepping to a past week you already saved loads it back into the grid so you can correct it, and saving updates that week instead of creating a new one. A small marker by the selector tells you where the week stands: Building from your logs while it is still a draft, or Saved once you have closed it out.'] },
      { h: 'The Money Picture', p: ['Total revenue, prime cost against your target, how the week tracked versus forecast, and the total dollars running over target this week, all live. Prime cost is the headline number, and labor is folded into it.'] },
      { h: 'The Confirm Grid', p: ['Three rows: Bar, Food, and Catering. Bar and Food revenue fills from your weekly POS sales import; COGS and labor pre-fill from Inventory and Labor Control. You confirm or correct against your POS. The Catering row is read-only and pulls offsite catering and event revenue, cost, and labor straight from the Events section (the staff you checked to the event in Build Schedule), so it is never hand-typed. Cost percent and dollars over or under target compute live. Refresh This Week re-pulls the latest imported sales, COGS, and labor and refills those cells; if you have edited one by hand it asks before overwriting.'] },
      { h: 'Other Revenue', p: ['Merch, vending, ticketed events, anything outside bar and food, goes in the Other / Ancillary Revenue box with its cost. It stays out of your prime cost but rolls into Books as its own income line.'] },
      { h: 'Operating Costs', p: ['Third-party platform fees, delivery commissions and the like, are an operating cost, not COGS or labor, so they sit in their own box and do not move the prime cost numbers above. Bar Cop captures the weekly figure here and Books reads it as an operating expense toward your true profit.'] },
      { h: 'Weekly History', p: ['Every week you save lands in the history list, newest first. The Cost vs Target column shows the real dollars that week ran over or under your bar and food cost targets combined. Edit loads a week back into the grid; Delete removes it. The range chips filter the list and Export PDF saves it.'] }
    ]);
  },

  // ── Stat strip (the selected week's money picture) ──────────────────────────
  heroStrip() {
    return '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + '<div class="calc-item"><div class="calc-label">Total Revenue</div><div class="calc-val lg" id="tw-totrev">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Prime Cost</div><div class="calc-val lg" id="tw-prime">-</div><div style="font-size:11px;color:var(--t3);margin-top:3px;" id="tw-prime-sub">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">vs Forecast</div><div class="calc-val lg" id="tw-fcgap">-</div></div>'
      + '<div class="calc-item"><div class="calc-label">Over Target</div><div class="calc-val lg" id="tw-over">-</div></div>'
      + '</div></div>';
  },

  // ── Week selector row — the exact Close The Week pill stepper (one pill, arrows
  // outside, gold NOW, This Week snap), plus the lifecycle pill + Refresh. ──────
  selectorRow() {
    const now = this.currentWeekEnd();
    const sel = this._weekEnd;
    const isCur = sel >= now;
    // Lifecycle marker so it reads as a week-in-progress, not a static form:
    // "Building from your logs" until the week is saved (closed out), then "Saved."
    const saved = !!this.savedWeek(sel);
    const statePill = '<span style="font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:6px;color:' + (saved ? 'var(--green)' : 'var(--t3)') + ';">'
      + '<span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:' + (saved ? 'var(--green)' : 'var(--t4)') + ';"></span>'
      + (saved ? 'Saved' : 'Building from your logs') + '</span>';
    const fmt = ymd => { const dt = new Date(ymd + 'T00:00:00'); return isNaN(dt.getTime()) ? ymd : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(); };
    const range = fmt(App.weekStartFor(sel)) + ' - ' + fmt(sel);
    const nowBadge = isCur ? ' <span style="color:var(--gold);font-weight:800;font-size:11px;letter-spacing:0.5px;margin-left:6px;">NOW</span>' : '';
    const prevBtn = '<button class="btn btn-ghost btn-sm tw-wk-prev" aria-label="Previous week" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = isCur
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm tw-wk-next" aria-label="Next week" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pillBase = 'display:inline-flex;align-items:center;border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;white-space:nowrap;';
    const pill = '<span style="' + pillBase + 'border:1px solid var(--b-edge);background:var(--sel-active-bg);color:var(--t1);">' + esc(range) + nowBadge + '</span>';
    const nowBtn = isCur ? '' : '<button class="btn btn-ghost btn-sm tw-wk-now" style="margin-left:4px;">This Week</button>';
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">'
      + '<div style="display:inline-flex;align-items:center;gap:8px;">' + prevBtn + pill + nextBtn + nowBtn + '</div>'
      + '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' + statePill
      + '<button class="btn btn-ghost btn-sm" id="tw-pull">Refresh This Week</button>'
      + '</div></div>';
  },

  // ── Confirm grid card ───────────────────────────────────────────────────────
  cell(id, val) {
    return '<div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="tw-' + id + '" value="' + esc(String(val || '')) + '" step="0.01" inputmode="decimal" style="width:100%;" oninput="S.ThisWeek.onInput()"/></div>';
  },
  // Read-only money cell — the Events line, pulled from bookings, never typed.
  roCell(id, val) {
    return '<div class="fw"><span class="pre" style="color:var(--t4);">$</span><input class="form-input pre" type="text" id="tw-' + id + '" value="' + esc(val ? Number(val).toFixed(2) : '0.00') + '" readonly tabindex="-1" style="width:100%;background:transparent;border-color:transparent;color:var(--t3);cursor:default;"/></div>';
  },
  lineRow(label, p, data, readonly) {
    const c = (id, val) => readonly ? this.roCell(id, val) : this.cell(id, val);
    return '<tr class="tw-line">'
      + '<td><div class="val">' + label + '</div></td>'
      + '<td>' + c(p + 'r', data.revenue) + '</td>'
      + '<td>' + c(p + 'l', data.labor) + '</td>'
      + '<td>' + c(p + 'c', data.cogs) + '</td>'
      + '<td id="tw-' + p + 'pct">-</td>'
      + '<td id="tw-' + p + 'vd">-</td>'
      + '</tr>';
  },
  // ── The week form — one card, sections split by dividers so it all reads as one
  // form: the confirm grid, then Other Revenue, Operating Costs, and Notes last
  // (notes at the bottom, like every other form). Other Revenue and Operating
  // Costs are below-the-line, so they do NOT move the prime-cost grid above. ────
  formCard(d) {
    const o = d.other || { revenue: '', cogs: '' };
    const subhead = t => '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin:0 0 12px;">' + t + '</div>';
    const moneyField = (id, label, val) => '<div class="f" style="width:200px;flex-shrink:0;"><label>' + label + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="' + id + '" value="' + esc(String(val || '')) + '" step="0.01" oninput="S.ThisWeek.onInput()"/></div></div>';
    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title">Confirm the Week</div>'
      + '<div class="pill-wrap" style="margin-bottom:14px;">'
      + '<table class="ing-tbl pill" style="table-layout:fixed;"><thead><tr>'
      + '<th style="width:92px;">Section</th><th>Revenue</th><th>Labor</th><th>COGS</th><th style="width:80px;">Cost %</th><th style="width:112px;">vs Target</th>'
      + '</tr></thead><tbody>'
      + this.lineRow('Bar', 'b', d.bar)
      + this.lineRow('Food', 'f', d.food)
      + this.lineRow('Catering', 'c', d.catering || { revenue: '', cogs: '', labor: '' }, true)
      + '</tbody></table></div>'
      + '<div class="divider"></div>'
      + subhead('Other / Ancillary Revenue')
      + '<div class="form-row" style="align-items:flex-end;gap:18px;">' + moneyField('tw-or', 'Revenue', o.revenue) + moneyField('tw-oc', 'Cost of Goods', o.cogs) + '</div>'
      + '<div class="divider"></div>'
      + subhead('Operating Costs')
      + '<div class="form-row" style="align-items:flex-end;gap:18px;">' + moneyField('tw-pf', '3rd-Party Platform Fees', d.platform_fees) + '</div>'
      + '</div>';
  },

  // ── Weekly history (filter chips + data-card table) ─────────────────────────
  historyBlock() {
    const r = this.effectiveRange();
    const all = (App.data.weeks || []).slice()
      .filter(w => w.period_end)
      .filter(w => (!r.from || w.period_end >= r.from) && (!r.to || w.period_end <= r.to))
      .sort((a, b) => (b.period_end || '').localeCompare(a.period_end || ''));
    const t = App.data.settings.targets || {};
    const bT = t.bar_pour_cost_pct ?? 22, fT = t.food_cost_pct ?? 32, pT = t.prime_cost_pct ?? 60;
    const cls = (v, tgt) => v == null ? '' : (v > tgt ? 'neg' : 'pos');

    const customRow = this.filterPreset === 'custom'
      ? '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">'
        + '<div class="f" style="width:180px;"><label>From</label><input type="date" id="tw-from" value="' + esc(this.filterFrom) + '"/></div>'
        + '<div class="f" style="width:180px;"><label>To</label><input type="date" id="tw-to" value="' + esc(this.filterTo) + '"/></div></div>'
      : '';

    const rows = all.length
      ? all.slice(0, App.listLimit('core', 'week')).map(w => {
          // Cost vs Target $: real dollars this week ran over (or under) the bar
          // and food cost targets combined. Computable from data every saved week
          // carries.
          const barGap  = ((w.bar?.cost_pct  - bT) / 100) * (w.bar?.revenue  || 0);
          const foodGap = ((w.food?.cost_pct - fT) / 100) * (w.food?.revenue || 0);
          const costGap = (isFinite(barGap) ? barGap : 0) + (isFinite(foodGap) ? foodGap : 0);
          const gapStr  = (costGap > 0 ? '+' : costGap < 0 ? '-' : '') + App.fmtCurrency(Math.abs(costGap));
          return '<tr>'
          + '<td><div class="val">' + this.fmtDate(w.period_end) + '</div></td>'
          + '<td>Week ' + (w.week_num != null ? w.week_num : '-') + '</td>'
          + '<td>' + App.fmtCurrency(w.bar?.revenue || 0) + '</td>'
          + '<td class="' + cls(w.bar?.cost_pct, bT) + '">' + App.fmtPct(w.bar?.cost_pct) + '</td>'
          + '<td>' + App.fmtCurrency(w.food?.revenue || 0) + '</td>'
          + '<td class="' + cls(w.food?.cost_pct, fT) + '">' + App.fmtPct(w.food?.cost_pct) + '</td>'
          + '<td class="' + cls(w.prime_cost_pct, pT) + '">' + App.fmtPct(w.prime_cost_pct) + '</td>'
          + '<td class="' + (costGap > 0 ? 'neg' : costGap < 0 ? 'pos' : '') + '">' + gapStr + '</td>'
          + '<td><div class="row-actions">'
          + '<button class="btn btn-ghost btn-sm tw-edit" data-id="' + esc(w.id) + '">Edit</button>'
          + '<button class="btn btn-danger btn-sm tw-del" data-id="' + esc(w.id) + '">Delete</button>'
          + '</div></td></tr>';
        }).join('')
      : '<tr><td colspan="9" style="text-align:center;padding:22px;color:var(--t4);">No weeks saved in this range. Pick a wider range above.</td></tr>';

    return '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 12px;">'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + App.filterChips(this.filterPreset, this.RANGE_CHIPS, 'tw-range-chip') + '</div>'
      + '<button class="btn btn-ghost btn-sm" id="tw-export">Export PDF</button>'
      + '</div>'
      + customRow
      + '<div class="card" style="overflow-x:auto;"><table class="row-list"><thead><tr>'
      + '<th>Week Ending</th><th>Week</th><th>Bar Rev</th><th>Bar %</th><th>Food Rev</th><th>Food %</th><th>Prime %</th><th>Cost vs Tgt $</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + App.showOlderBar('core', 'week', all, this.filterPreset !== 'all');
  },

  draw() {
    const d = this.draft;
    const editing = !!this._editId;
    this.container.innerHTML = '<div class="screen">'
      + this.heroStrip()
      + this.selectorRow()
      + this.formCard(d)
      + '<div style="margin:16px 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="tw-save">' + (editing ? 'Update Week' : 'Save Week') + '</button>'
      + '<button class="btn btn-ghost" id="tw-start-over">Start Over</button>'
      + '<span id="tw-err" style="color:var(--red);font-size:12px;margin-left:8px;display:none;"></span>'
      + '<span id="tw-msg" style="color:var(--gold);font-size:12px;font-weight:700;margin-left:8px;display:' + (this._msg ? 'inline' : 'none') + ';">' + esc(this._msg) + '</span>'
      + '</div>'
      + this.historyBlock()
      + '</div>';
    this._msg = '';
    this.wire();
    this.calc();
  },

  wire() {
    document.getElementById('tw-save')?.addEventListener('click', () => this.saveWeek());
    document.getElementById('tw-start-over')?.addEventListener('click', () => this.startOver());
    document.getElementById('tw-pull')?.addEventListener('click', () => this.pullAll());
    this.container.querySelectorAll('.tw-wk-chip').forEach(b => b.addEventListener('click', () => this.gotoWeek(b.dataset.end)));
    this.container.querySelector('.tw-wk-prev')?.addEventListener('click', () => this.gotoWeek(this.addDays(this._weekEnd, -7)));
    this.container.querySelector('.tw-wk-next')?.addEventListener('click', () => this.gotoWeek(this.addDays(this._weekEnd, 7)));
    this.container.querySelector('.tw-wk-now')?.addEventListener('click', () => this.gotoWeek(this.currentWeekEnd()));
    this.container.querySelectorAll('.tw-range-chip').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.v;
      if (v === 'custom') { this.filterPreset = (this.filterPreset === 'custom') ? this._prevPreset : 'custom'; }
      else { this._prevPreset = v; this.filterPreset = v; }
      this.draw();
    }));
    document.getElementById('tw-from')?.addEventListener('change', e => { this.filterFrom = e.target.value; this.draw(); });
    document.getElementById('tw-to')?.addEventListener('change', e => { this.filterTo = e.target.value; this.draw(); });
    /* Weekly History exports the WHOLE chip selection, not the page on screen. historyBlock()
       renders `all.slice(0, App.listLimit('core','week'))` behind a Show older button, and
       exportPDF builds the document by walking the rendered DOM — so this used to stop at
       LIST_PAGE (50) rows with nothing in the PDF saying so. Fifty weeks is about a year of
       confirmed weeks, after which the saved file quietly stopped being the whole history.
       `range` matters just as much: without it the document could be one month or five years
       and the file itself could not tell you which. Safe to re-render: every money input calls
       onInput() -> collect() -> saveDraft(), and draw() rebuilds the form from this.draft, so a
       half-typed week survives exactly as it does on a filter-chip click. */
    document.getElementById('tw-export')?.addEventListener('click', () => {
      const r = this.effectiveRange();
      /* ⚠ Revenue's `r-this-week.js` also titles its export "Weekly History", and the filename is
         `BarCop_<fileTag || subtitle || title>_<date>.pdf` — so two documents from two different
         sections, with different numbers, saved under one name. Both now carry a fileTag. */
      App.exportListPDF({
        title: 'Weekly History', fileTag: 'Weekly History - Profit',
        root: this.container, lists: [['core', 'week']],
        reRender: () => this.draw(),
        range: App.chipRangeLabel(this.RANGE_CHIPS, this.filterPreset, r.from, r.to)
      });
    });
    this.container.querySelectorAll('.tw-edit').forEach(b => b.addEventListener('click', () => this.editWeek(b.dataset.id)));
    this.container.querySelectorAll('.tw-del').forEach(b => b.addEventListener('click', () => this.deleteWeek(b.dataset.id)));
    this.container.querySelectorAll('[data-show-older]').forEach(b => b.addEventListener('click', () => App.handleShowOlder(b, () => this.draw())));
  },

  gotoWeek(weekEnd) {
    if (!this._editId) { this.collect(); this.saveDraft(); }
    this.loadWeek(weekEnd);
    this.draw();
  },

  editWeek(id) {
    const w = (App.data.weeks || []).find(x => x.id === id);
    if (!w) return;
    this.loadWeek(w.period_end);
    this.draw();
    // Jump back to the confirm grid at the top — the app scrolls its .content
    // element, so scrolling the container itself would not move the view.
    const el = App._activeContentEl ? App._activeContentEl() : null;
    if (el && el.scrollTo) el.scrollTo({ top: 0, behavior: 'smooth' });
    else if (el) el.scrollTop = 0;
    if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  deleteWeek(id) {
    App.confirmDelete().then(ok => {
      if (!ok) return;
      App.removeRecord('core', 'week', id).then(() => {
        if (this._editId === id) this.loadWeek(this._weekEnd);
        this.draw();
      });
    });
  },

  onInput() { this.collect(); this.saveDraft(); this.calc(); },

  collect() {
    const v = id => document.getElementById(id)?.value ?? '';
    const d = this.draft;
    d.bar.revenue = v('tw-br'); d.bar.cogs = v('tw-bc'); d.bar.labor = v('tw-bl');
    d.food.revenue = v('tw-fr'); d.food.cogs = v('tw-fc'); d.food.labor = v('tw-fl');
    // Events line is read-only, pulled live from the Events section, never typed.
    d.catering = this.cateringFromBookings(this._weekEnd);
    if (!d.other) d.other = { revenue: '', cogs: '' };
    d.other.revenue = v('tw-or'); d.other.cogs = v('tw-oc');
    d.platform_fees = v('tw-pf');
    d.notes = v('tw-notes');
  },

  _isOverride(id, incoming) {
    const cur = parseFloat(document.getElementById(id)?.value);
    if (isNaN(cur) || cur === 0) return false;
    const inc = parseFloat(incoming);
    if (isNaN(inc)) return false;
    return Math.abs(cur - inc) > 0.5;
  },

  async pullAll() {
    const pe = this._weekEnd;
    const bc = this.icCOGS(this.BAR_CATS, pe), fc = this.icCOGS(this.KITCHEN_CATS, pe);
    const sr = this.salesRevenue(pe);
    const lc = this.laborCost(pe);
    // Refresh re-pulls every Control-owned figure: revenue from the week's
    // imported POS sales, COGS from Inventory counts, labor from logged hours.
    const incoming = {};
    if (sr) { incoming['tw-br'] = sr.bar; incoming['tw-fr'] = sr.food; }
    if (lc) { incoming['tw-bl'] = lc.bar; incoming['tw-fl'] = lc.food; }
    if (bc != null) incoming['tw-bc'] = bc;
    if (fc != null) incoming['tw-fc'] = fc;
    if (!Object.keys(incoming).length) {
      await App.confirm({ title: 'Nothing to pull yet', message: 'No sales, counts, or hours are logged for this week yet. Import your sales in Shift, log counts in Inventory and hours in Labor, or enter the numbers here by hand.', confirmText: 'OK', cancelText: '' });
      return;
    }
    const conflicted = Object.entries(incoming).some(([id, val]) => this._isOverride(id, val));
    if (conflicted) {
      const ok = await App.confirm({ title: 'Overwrite your numbers?', message: 'Some cells you edited do not match what Control just computed. Loading will replace them with the logged figures.', confirmText: 'Overwrite', cancelText: 'Keep Mine' });
      if (!ok) return;
    }
    Object.entries(incoming).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = (Number(val) || 0).toFixed(2); });
    this.onInput();
  },

  calc() {
    const d = this.draft;
    const num = id => parseFloat(document.getElementById(id)?.value) || 0;
    const t = (App.data.settings && App.data.settings.targets) || {};
    const put = (id, str, color) => { const el = document.getElementById(id); if (!el) return; el.textContent = str; if (color !== undefined) el.style.color = color; };

    const sections = [
      { p: 'b', target: t.bar_pour_cost_pct ?? 22 },
      { p: 'f', target: t.food_cost_pct ?? 32 }
    ];
    sections.push({ p: 'c', target: null });   // Events line (read-only, from bookings)

    let totRev = 0, totCost = 0, overTarget = 0;
    sections.forEach(s => {
      const rev = num('tw-' + s.p + 'r'), labor = num('tw-' + s.p + 'l'), cogs = num('tw-' + s.p + 'c');
      totRev += rev; totCost += cogs + labor;
      const pct = rev > 0 ? cogs / rev * 100 : null;
      if (s.target == null) {
        put('tw-' + s.p + 'pct', pct != null ? App.fmtPct(pct) : '-', pct != null ? 'var(--t2)' : 'var(--t3)');
        put('tw-' + s.p + 'vd', '-', 'var(--t3)');
      } else {
        const vd = pct != null ? ((pct - s.target) / 100) * rev : null;
        const over = pct != null && pct > s.target;
        if (vd != null && vd > 0) overTarget += vd;
        put('tw-' + s.p + 'pct', pct != null ? App.fmtPct(pct) : '-', pct == null ? 'var(--t3)' : (over ? 'var(--red)' : 'var(--gold)'));
        put('tw-' + s.p + 'vd', vd != null ? ((vd > 0 ? '+' : '') + App.fmtCurrency(vd)) : '-', vd == null ? 'var(--t3)' : (vd > 0 ? 'var(--red)' : 'var(--green)'));
      }
    });

    const primeTarget = t.prime_cost_pct ?? 60;
    const prime = totRev > 0 ? totCost / totRev * 100 : null;
    put('tw-totrev', totRev > 0 ? App.fmtCurrency(totRev) : '-', 'var(--t1)');
    put('tw-prime', prime != null ? App.fmtPct(prime) : '-', prime == null ? 'var(--t3)' : (prime > primeTarget ? 'var(--red)' : 'var(--gold)'));
    put('tw-prime-sub', 'target ' + primeTarget + '%' + (prime != null ? (prime > primeTarget ? ' · over' : ' · on target') : ''), prime != null && prime > primeTarget ? 'var(--red)' : 'var(--t3)');
    put('tw-over', totRev > 0 ? App.fmtCurrency(overTarget) : '-', overTarget > 0 ? 'var(--red)' : 'var(--gold)');

    const fc = (this._weekEnd && App.effectiveForecast) ? App.effectiveForecast(this._weekEnd) : null;
    const fcTotal = fc && fc.total != null ? Number(fc.total) || 0 : 0;
    const fcGap = fcTotal > 0 && totRev > 0 ? totRev - fcTotal : null;
    put('tw-fcgap', fcGap != null ? ((fcGap >= 0 ? '+' : '') + App.fmtCurrency(fcGap)) : '-', fcGap == null ? 'var(--t3)' : (fcGap >= 0 ? 'var(--green)' : 'var(--red)'));
  },

  startOver() {
    App.confirm({ title: 'Start over?', message: this._editId ? 'This drops your unsaved changes to this week and reloads what is saved.' : 'This clears the numbers entered for this week and re-pulls a fresh copy from Control.', confirmText: 'Start Over', cancelText: 'Keep' }).then(ok => {
      if (!ok) return;
      if (!this._editId) this.clearDraft();
      this.loadWeek(this._weekEnd);
      this.draw();
    });
  },

  async saveWeek() {
    this.collect();
    const d = this.draft;
    const err = document.getElementById('tw-err');
    const numF = v => parseFloat(v) || 0;
    const bRev = numF(d.bar.revenue), bCogs = numF(d.bar.cogs), bLab = numF(d.bar.labor);
    const fRev = numF(d.food.revenue), fCogs = numF(d.food.cogs), fLab = numF(d.food.labor);
    const cRev = numF(d.catering?.revenue), cCogs = numF(d.catering?.cogs), cLab = numF(d.catering?.labor);
    const oRev = numF(d.other?.revenue), oCogs = numF(d.other?.cogs);
    const pFees = numF(d.platform_fees);
    if (bRev + fRev + cRev === 0) {
      if (err) { err.textContent = 'Enter at least one revenue figure before saving.'; err.style.display = 'inline'; }
      return;
    }
    const t = App.data.settings.targets || {};
    const bTarget = t.bar_pour_cost_pct ?? 22, fTarget = t.food_cost_pct ?? 32;
    const tRev = bRev + fRev + cRev;
    const tCost = bCogs + fCogs + bLab + fLab + cCogs + cLab;
    const bPct = bRev > 0 ? bCogs / bRev * 100 : 0;
    const fPct = fRev > 0 ? fCogs / fRev * 100 : 0;

    const existing = this._editId ? (App.data.weeks || []).find(w => w.id === this._editId) : null;
    const week = {
      id: this._editId || App.uid(),
      week_num: existing ? existing.week_num : (App.nextWeekNum ? App.nextWeekNum() : 1),
      period_end: this._weekEnd,
      saved_at: new Date().toISOString(),
      bar: { revenue: bRev, cogs: bCogs, labor: bLab, cost_pct: bPct, labor_pct: bRev > 0 ? bLab / bRev * 100 : 0, vs_target_pct: bPct - bTarget, vs_target_dollar: ((bPct - bTarget) / 100) * bRev },
      food: { revenue: fRev, cogs: fCogs, labor: fLab, cost_pct: fPct, labor_pct: fRev > 0 ? fLab / fRev * 100 : 0, vs_target_pct: fPct - fTarget, vs_target_dollar: ((fPct - fTarget) / 100) * fRev },
      catering: { revenue: cRev, cogs: cCogs, labor: cLab, cost_pct: cRev > 0 ? cCogs / cRev * 100 : 0, labor_pct: cRev > 0 ? cLab / cRev * 100 : 0 },
      other: { revenue: oRev, cogs: oCogs },
      platform_fees: pFees,
      prime_cost_pct: tRev > 0 ? tCost / tRev * 100 : 0,
      notes: d.notes || ''
    };

    const btn = document.getElementById('tw-save');
    const wasEditing = !!this._editId;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    const ok = await App.putRecord('core', 'week', week);
    if (ok) {
      if (!wasEditing) this.clearDraft();
      if (App.updatePeriod) App.updatePeriod();
      App.markSetupDone('gs_p_week');
      this._msg = wasEditing ? 'Week updated.' : 'Week saved.';
      this.loadWeek(this._weekEnd);   // reload the now-saved week (becomes editable)
      this.draw();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = wasEditing ? 'Update Week' : 'Save Week'; }
      if (err) { err.textContent = 'Save failed. Try again.'; err.style.display = 'inline'; }
    }
  }
};
