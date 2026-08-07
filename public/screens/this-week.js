'use strict';

/* S.ThisWeek - the weekly CONTROL FEED for Confirm the Week.
   NOT A SCREEN. This was the old "Run This Week" confirm grid. Confirm the Week
   (components/confirm-week.js) replaced it as the single weekly-close writer, and
   App.navigate intercepts the 'this-week' id, so the grid has been unreachable for
   months. T1 retired it outright. What went with it: a `tw-pf` money input still
   writing the RETIRED `week.platform_fees` field, a second
   putRecord('core','week') save door beside Confirm the Week's, and the only
   removeRecord('core','week') in the app.

   WHAT IS LEFT IS THE FEED. Every member here is reached from another file, or by
   one that is:
     icCOGS, laborCost, cateringFromBookings  -> components/confirm-week.js
     currentWeekEnd                           -> app.js (the interception fallback)
     COGS_WEEK_TOL, offsiteBookings, offsiteEventStaffKeys
                                              -> reached only BY the four above
   !! Those last three have no external caller and read like render support, which is
   exactly how they get deleted. offsiteBookings is what the Events line is computed
   from, and offsiteEventStaffKeys is what stops event labor being counted twice. The
   survivor set is a FIXPOINT off the four entry points, not a list ([[the-loop]]
   #63/#140). Close it again before cutting anything here.

   !! THE app.js INTERCEPTION MUST STAY, and so must db.js SCREEN_GROUPS.
   Three live callers still say openScreen('this-week') (hub-books-home, hub-year-end,
   reports) and rely on the interception to land them on the Confirm the Week popup.
   openScreen reads the db.js mapping BEFORE navigate ever sees the id, for both the
   role gate and the shell swap, so removing it as a leftover locks a scoped Admin out
   of Confirm the Week. Both pinned by verify-this-week-grid-retired.js, block D.

   The file keeps its name: S.ThisWeek is what app.js, confirm-week.js and 13
   harnesses all spell, and renaming buys nothing an operator can see. */

S.ThisWeek = {
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
    if (!any) return null;
    /* ⚠⚠ S332 — A NEGATIVE TOTAL IS NOT A COST, IT IS A MISSING RECORD.
       `computeUsagePair` has no negative floor, so when the end count exceeds the start count plus
       deliveries the sum goes negative. That is never a real cost of goods: it says the bar has
       MORE than it started with and bought, which means an unrecorded delivery, an unrecorded
       transfer between locations, or a miscount (a case keyed as bottles). All ordinary.
       This mattered because `confirm-week.js` uses this as the Bar/Food COGS PREFILL, and that
       form's negative refusal covers revenue and covers but NOT cogs — so the figure saved into
       `week.bar.cogs` silently. MEASURED on the live seed: -$970.46 for the week ending 07-19,
       pullable through Week History -> Edit -> Refresh from Control.
       ⚠ DIRECTION is why it can sit unnoticed: a negative COGS INFLATES gross profit on the
       income statement and understates prime cost ([[the-loop]] #42 — the flattering direction is
       the one nobody reports).
       ⭐ NULL IS ALREADY THIS FUNCTION'S WORD FOR "I CANNOT MEASURE THIS HONESTLY" — see the
       `idx < 1` return above. A negative result is the same situation, so it gets the same answer
       rather than a new mechanism. Every caller already handles null by leaving the cell blank,
       and `cogsImpact` gates on `Number.isFinite`, so a null can never overwrite a signed-off week.
       ⚠ ZERO IS NOT REFUSED. Nothing moved is a legitimate reading; only a negative is impossible.
       ⚠ SCOPE: this refuses a negative TOTAL. A week where ONE product's usage is negative but the
       total stays positive is still wrong by that amount, and is NOT refused here — killing a
       whole week's COGS over one shelf is the refuses-too-much trap ([[the-loop]] "a guard that
       refuses too much is a defect with a support call attached"). Named on THE LIST instead. */
    return cogs < 0 ? null : cogs;
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

  currentWeekEnd() { return App.nextSunday ? App.nextSunday() : App.todayLocal(); },

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
};
