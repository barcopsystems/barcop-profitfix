'use strict';

/* ── Revenue Recovery — the weekly labor feed ─────────────────────────────────
   ⛔ THE SCREEN THAT USED TO LIVE HERE IS RETIRED (T19, 2026-08-18). `openScreen`
   intercepts `r-this-week` into Close The Week plus the Confirm the Week popup, there
   is no Revenue sidebar row and no `navigate` door, so the page could never render and
   its help topic could never be shown. 487 lines went; this is what was load-bearing.

   ⭐ WHY THE OBJECT SURVIVES AT ALL: `confirm-week.js` calls `S.RevenueThisWeek
   .laborFeed(pe)` TWICE, and that is the live weekly close. Deleting the file would
   have broken the most important flow in the app — which is why the classification
   came before the cut ([[the-loop]] #123/#125). Same shape T1 used on the profit twin:
   `this-week.js` kept `icCOGS`, `laborCost` and `cateringFromBookings` the same way.

   ⚠ THIS FEED CARRIES BOTH ADJUSTMENTS THAT LIVE OUTSIDE `lc_actuals` — the overtime
   premium and the tip-credit makeup. A weekly rollup that drops either understates
   labor on exactly the weeks it matters. Never price an OT hour at a call site. */

S.RevenueThisWeek = {
  laborFeed(periodEnd) {
    if (!periodEnd) return null;
    const actuals = (App.laborData && App.laborData.lc_actuals) || [];
    const startD = new Date(periodEnd + 'T00:00:00');
    if (isNaN(startD.getTime())) return null;
    startD.setDate(startD.getDate() - 6);
    const start = App.ymdLocal(startD);
    let cost = 0, hours = 0, any = false;
    const wkRows = [];
    actuals.forEach(a => {
      if (!a.date || a.date < start || a.date > periodEnd) return;
      wkRows.push(a);
      cost += a.cost || 0;
      // RPLH counts every labor hour worked, salaried managers included.
      hours += a.hours || 0;
      any = true;
    });
    // Overtime premium (0.5x on weekly hours over 40) is NOT in a.cost (straight
    // time only), so add it or labor % and RPLH understate labor on overtime weeks.
    cost += App.otPremiumForRows ? App.otPremiumForRows(wkRows).total : 0;
    cost += App.tipMakeupForRows ? App.tipMakeupForRows(wkRows).total : 0;
    // Salaried (exempt) labor is a fixed weekly cost on top of hourly wages.
    const sal = App.salariedCost(start, periodEnd);
    cost += sal.total;
    if (sal.total > 0) any = true;
    return any ? { cost, hours } : { cost: 0, hours: 0 };
  }
};
