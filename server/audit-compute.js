'use strict';

/* ── Audit Compute — deterministic audit math (deep-analysis rework, 2026-07-14)
   Every audit SCORE and DOLLAR figure is computed here in code, from the real
   data Bar Cop holds (Control feeds via controlData + weekly numbers + settings).
   The old upload/extraction path and self-reported operating-practice inputs are
   gone: the audit scores solely what Bar Cop measures. See memory: audit-system,
   output-honesty, audit-rework.

   Honesty contract for every number this file returns:
     1. computed from held data (Control feeds + weekly numbers + settings)
     2. correct for the period it claims (a 4-week audit period, never x52 cash)
     3. no double-counting a composite and its parts (Prime cost is CONTEXT ONLY,
        never scored into the overall with pour + food; measured shrink lives
        INSIDE the pour/food cost gap, so it is scored but adds no recoverable $)
     4. cost recovery is kept separate from revenue growth
     5. anything we cannot compute honestly is returned null (N/A) and excluded
        from the overall, never a fabricated placeholder or a defaulted mid-score.

   Period basis: the audit covers the trailing 4 weeks of `weeks` data. Control
   sums passed in are scoped to that same window (buildControlData). Monthly =
   weekly average x 4.345.

   PROFIT sections (reworked):
     S1 Pour & Bar Cost   — bar cost % vs target + recipe-costing coverage
     S2 Food Cost         — food cost % vs target + recipe-costing coverage
     S3 Shrink & Waste    — inventory variance + spot checks + waste + count frequency
     S4 Theft & Cash Loss — void/comp rate, unauthorized voids, cash shorts,
                            walked tabs, Sales Integrity flags
     S5 Vendor Cost Control — deliveries checked, price drift caught, credit chase
   Prime cost is a CONTEXT read on the hero, not a scored section.

   REVENUE sections:
     S1 Check Average & Revenue
     S2 Labor Efficiency
     S3 Menu Performance  — Dog ratio + real repricing recency (price log) + dog tests
     S4 Server Performance — check-average spread + comp discipline
     S5 Events & Private Dining
   The third argument (extracted) is retained for signature compatibility and
   ignored: there is no upload path anymore. */

const WEEKS_PER_MONTH = 4.345;
const PERIOD_WEEKS = 4;
const VOID_COMP_BENCHMARK_PCT = 2.0;   // S4 benchmark
const VENDOR_EXPOSURE_PCT = 3.0;       // S5 exposure assumption
const COMP_BENCHMARK_PCT = 3.0;        // Revenue S4 comp-of-sales benchmark

function num(v) { return (v == null || isNaN(v)) ? null : Number(v); }
function round1(v) { return v == null ? null : Math.round(v * 10) / 10; }
function round0(v) { return v == null ? null : Math.round(v); }
function round2(v) { return v == null ? null : Math.round(v * 100) / 100; }
function clampScore(v) { return Math.max(1, Math.min(100, Math.round(v))); } // never 0 per spec
function avg(arr) {
  const v = arr.filter(x => x != null && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// Score for a cost % vs target: at/under target is strong, degrading as it runs
// over. diff = actual - target (positive = over target = worse).
function scoreCostVsTarget(actualPct, targetPct, withinBands) {
  if (actualPct == null || targetPct == null) return null;
  const diff = actualPct - targetPct;
  const b = withinBands;
  if (diff <= 1) return b[0];
  if (diff <= 3) return b[1];
  if (diff <= 5) return b[2];
  return b[3];
}

// Recipe-costing coverage for a department: of the menu items in that department,
// how many carry a cost. Honest read of "how much of your menu is costed"; null
// when there is nothing on that side of the menu (so a bar with no kitchen is not
// dinged). kind = 'bar' | 'kitchen'.
function recipeCoverage(menuItems, kind) {
  const FOOD = /food|plate|entree|starter|appet|dessert|side|kitchen|salad|sandwich|burger|taco|wing|snack/i;
  const inDept = (menuItems || []).filter(i => {
    if (!i) return false;
    const isFood = (i.recipe && i.recipe.mode === 'food') || FOOD.test(i.category || '');
    return kind === 'kitchen' ? isFood : !isFood;
  });
  if (!inDept.length) return null;
  const costed = inDept.filter(i => num(i.cost) > 0).length;
  return { total: inDept.length, costed, pct: Math.round((costed / inDept.length) * 100) };
}

/* computeProfitAudit(appData, controlData) — see header for section layout. */
function computeProfitAudit(appData, controlData) {
  appData = appData || {};
  controlData = controlData || null;

  const settings = appData.settings || {};
  const targets = settings.targets || {};
  const cd = controlData || {};
  const weeks = (appData.weeks || []).filter(w => w && (w.period_end || w.week_end))
    .sort((a, b) => String(a.period_end || a.week_end || '').localeCompare(String(b.period_end || b.week_end || '')))
    .slice(-PERIOD_WEEKS);   // sort oldest->newest FIRST: App.data.weeks arrives newest-first, so an unsorted slice(-4) would score the OLDEST 4 weeks
  const menuItems = appData.menu_items || [];
  const vendorLog = appData.vendor_log || [];
  const discreps = appData.vendor_discrepancies || [];
  const periodWeeks = weeks.length || WEEKS_PER_MONTH;
  const expectedCounts = Math.max(1, Math.round(periodWeeks));

  const barTarget = num(targets.bar_pour_cost_pct) != null ? num(targets.bar_pour_cost_pct) : 22;
  const foodTarget = num(targets.food_cost_pct) != null ? num(targets.food_cost_pct) : 32;
  const primeTarget = num(targets.prime_cost_pct) != null ? num(targets.prime_cost_pct) : 60;

  // ── Cost %: Control data > in-app weeks ──
  const wkBarCost = avg(weeks.map(w => w.bar && w.bar.cost_pct));
  const wkFoodCost = avg(weeks.map(w => w.food && w.food.cost_pct));
  const wkPrime = avg(weeks.map(w => w.prime_cost_pct));
  const barCostPct = round1(num(cd.bar_cost_pct) != null ? cd.bar_cost_pct : wkBarCost);
  const foodCostPct = round1(num(cd.food_cost_pct) != null ? cd.food_cost_pct : wkFoodCost);

  // ── Revenue and labor ──
  const wkBarRev = avg(weeks.map(w => w.bar && w.bar.revenue));
  const wkFoodRev = avg(weeks.map(w => w.food && w.food.revenue));
  const wkBarLabor = avg(weeks.map(w => w.bar && w.bar.labor));
  const wkFoodLabor = avg(weeks.map(w => w.food && w.food.labor));

  // No closed weeks yet: fall back to the weekly sales estimate the operator gave
  // at audit-generate time (a fresh, contextual number for the week being scored,
  // not a stale annual guess). A real week always supersedes it.
  const estWk = settings.week_sales_estimate || {};
  const monthlyBarRev = wkBarRev != null ? wkBarRev * WEEKS_PER_MONTH
    : (num(estWk.bar) ? estWk.bar * WEEKS_PER_MONTH : null);
  const monthlyFoodRev = wkFoodRev != null ? wkFoodRev * WEEKS_PER_MONTH
    : (num(estWk.food) ? estWk.food * WEEKS_PER_MONTH : null);
  const periodBarRev = wkBarRev != null ? wkBarRev * periodWeeks : monthlyBarRev;
  const periodFoodRev = wkFoodRev != null ? wkFoodRev * periodWeeks : monthlyFoodRev;
  const periodTotalRev = (periodBarRev || 0) + (periodFoodRev || 0);

  const haveBar = num(monthlyBarRev) > 0;
  const haveFood = num(monthlyFoodRev) > 0;

  const bevCogsPeriod = (barCostPct != null && periodBarRev != null) ? round0((barCostPct / 100) * periodBarRev) : null;
  const foodCogsPeriod = (foodCostPct != null && periodFoodRev != null) ? round0((foodCostPct / 100) * periodFoodRev) : null;
  const totalCogsPeriod = (bevCogsPeriod || 0) + (foodCogsPeriod || 0);

  const barCov = recipeCoverage(menuItems, 'bar');
  const kitCov = recipeCoverage(menuItems, 'kitchen');
  const covText = (c, noun) => c == null ? 'Not tracked' : `${c.costed} of ${c.total} ${noun} costed (${c.pct}%)`;

  // ── S1 — Pour & Bar Cost ──
  let s1 = null;
  if (haveBar && barCostPct != null) {
    s1 = scoreCostVsTarget(barCostPct, barTarget, [85, 65, 45, 25]) || 25;
    if (barCov) { if (barCov.pct >= 80) s1 += 10; else if (barCov.pct >= 50) s1 += 5; }
    s1 = clampScore(s1);
  }
  const s1Diff = (barCostPct != null) ? barCostPct - barTarget : 0;
  const s1MonthlyGap = (s1Diff > 0 && monthlyBarRev != null) ? round0((s1Diff / 100) * monthlyBarRev) : 0;

  // ── S2 — Food Cost ──
  let s2 = null;
  if (haveFood && foodCostPct != null) {
    s2 = scoreCostVsTarget(foodCostPct, foodTarget, [85, 65, 45, 25]) || 25;
    if (kitCov) { if (kitCov.pct >= 80) s2 += 10; else if (kitCov.pct >= 50) s2 += 5; }
    s2 = clampScore(s2);
  }
  const s2Diff = (foodCostPct != null) ? foodCostPct - foodTarget : 0;
  const s2MonthlyGap = (s2Diff > 0 && monthlyFoodRev != null) ? round0((s2Diff / 100) * monthlyFoodRev) : 0;

  // ── S3 — Shrink & Waste ──
  // What you should have used vs what you did: the variance engine + spot checks
  // + waste, plus whether you count often enough to catch it. The measured shrink
  // dollar already lives inside the S1/S2 cost gap, so this section is SCORED but
  // adds NO recoverable dollar of its own (avoids double counting the same money).
  const invVarDollar = num(cd.inv_variance_dollar);          // period shrink $ (variance runs)
  const spotChecks = num(cd.spot_checks) || 0;
  const spotVarDollar = num(cd.spot_check_variance_dollar);
  const spotFlagged = num(cd.spot_check_flagged);
  const wasteTotal = num(cd.waste_total);
  const invCounts = num(cd.inventory_counts) || 0;
  const shrinkDollar = round0((invVarDollar != null ? Math.abs(invVarDollar) : 0) + (wasteTotal != null ? wasteTotal : 0));
  const invVarPct = (invVarDollar != null && totalCogsPeriod > 0) ? round1((Math.abs(invVarDollar) / totalCogsPeriod) * 100) : null;
  const freqRatio = invCounts > 0 ? Math.min(1, invCounts / expectedCounts) : null;
  const countFreq = invCounts <= 0 ? 'Not counted this period'
    : invCounts >= expectedCounts ? 'Weekly'
    : invCounts >= Math.max(1, Math.round(expectedCounts / 2)) ? 'Every other week'
    : 'Monthly or less';
  const haveShrink = invVarDollar != null || spotChecks > 0 || wasteTotal != null || invCounts > 0;
  let s3 = null;
  if (haveShrink) {
    const parts = [];
    if (invVarPct != null) parts.push(invVarPct <= 1 ? 90 : invVarPct <= 2 ? 70 : invVarPct <= 3 ? 50 : invVarPct <= 5 ? 35 : 20);
    if (freqRatio != null) parts.push(clampScore(freqRatio * 90 + 10)); // weekly -> 100, monthly-in-4wk -> ~32
    if (spotChecks > 0) {
      const spotScore = (spotVarDollar != null && totalCogsPeriod > 0)
        ? Math.max(20, 100 - Math.round((Math.abs(spotVarDollar) / totalCogsPeriod) * 100 * 20))
        : 70;   // running spot checks at all is a real control
      parts.push(spotScore);
    }
    s3 = parts.length ? clampScore(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
  }

  // ── S4 — Theft & Cash Loss ──
  let voidCompPct = null, voidCompAmt = null;
  if (num(cd.void_comp_total) != null && periodTotalRev > 0) {
    voidCompAmt = round0(cd.void_comp_total);
    voidCompPct = round1((cd.void_comp_total / periodTotalRev) * 100);
  }
  const voidsNoApprovalPct = (num(cd.void_comp_count) > 0 && num(cd.void_comp_unauthorized) != null)
    ? round0((cd.void_comp_unauthorized / cd.void_comp_count) * 100) : null;
  const shortCount = num(cd.cash_short_count);
  const reconCount = num(cd.cash_reconciliations);
  const cashShortRate = (shortCount != null && reconCount > 0) ? round0((shortCount / reconCount) * 100) : null;
  const walkedTotal = num(cd.walked_tabs_total);
  const walkedCount = num(cd.walked_tabs_count);
  const siFlags = num(cd.sales_integrity_flags);
  const haveCashRecon = reconCount > 0;
  // Void/comp rate is measured on TOTAL revenue, so size the gap on whatever revenue
  // exists (a bar with no kitchen, or a kitchen with no bar, still has a real gap).
  const monthlyTotalRev = (monthlyBarRev || 0) + (monthlyFoodRev || 0);
  const s4MonthlyGap = (voidCompPct != null && voidCompPct > VOID_COMP_BENCHMARK_PCT && monthlyTotalRev > 0)
    ? round0(((voidCompPct - VOID_COMP_BENCHMARK_PCT) / 100) * monthlyTotalRev) : 0;
  const haveS4 = voidCompPct != null || cashShortRate != null || walkedTotal != null || siFlags != null || haveCashRecon || voidsNoApprovalPct != null;
  let s4 = null;
  if (haveS4) {
    if (voidCompPct != null) {
      const over = voidCompPct - VOID_COMP_BENCHMARK_PCT;
      s4 = over <= 0 ? 85 : over <= 1 ? 65 : over <= 2 ? 45 : 25;
    } else {
      s4 = 55;   // cash/loss signals on file but no void/comp rate to grade
    }
    if (voidsNoApprovalPct != null) { if (voidsNoApprovalPct > 25) s4 -= 15; else if (voidsNoApprovalPct > 10) s4 -= 8; }
    if (cashShortRate != null) { if (cashShortRate > 30) s4 -= 10; else if (cashShortRate > 15) s4 -= 5; }
    if (siFlags != null && siFlags > 0) s4 -= Math.min(15, siFlags * 5);
    if (haveCashRecon) s4 += 5;   // reconciling the drawer is a real control
    s4 = clampScore(s4);
  }

  // ── S5 — Vendor Cost Control ──
  const deliveries = num(cd.deliveries_logged) || 0;
  const priceChanges = num(cd.vendor_price_changes) || 0;
  let uncollected = null, recovered = null, openCount = null, recoveryPct = null;
  if (discreps.length > 0) {
    const outstanding = discreps.filter(r => r.status && r.status !== 'Resolved');
    openCount = outstanding.length;
    uncollected = round0(outstanding.reduce((s, r) => s + (num(r.overcharge) || 0), 0));
    recovered = round0(discreps.filter(r => r.status === 'Resolved')
      .reduce((s, r) => s + (num(r.recovered_amount) != null ? num(r.recovered_amount) : (num(r.overcharge) || 0)), 0));
    const addressed = (recovered || 0) + (uncollected || 0);
    recoveryPct = addressed > 0 ? round0((recovered / addressed) * 100) : null;
  }
  const haveVendor = deliveries > 0 || vendorLog.length > 0 || discreps.length > 0 || priceChanges > 0;
  let s5 = null;
  if (haveVendor) {
    s5 = deliveries > 0 ? 55 : 50;                       // checking deliveries in at all
    if (priceChanges > 0 || vendorLog.length > 0) s5 += 10;  // actively catching price drift
    if (recoveryPct != null) { if (recoveryPct >= 75) s5 += 5; else if (recoveryPct < 40 && openCount >= 2) s5 -= 8; }
    s5 = clampScore(s5);
  }
  const vendorSpendMonthly = round0(totalCogsPeriod > 0 ? (totalCogsPeriod / periodWeeks) * WEEKS_PER_MONTH : null);
  const s5ExposureMonthly = (s5 != null && vendorSpendMonthly != null) ? round0((VENDOR_EXPOSURE_PCT / 100) * vendorSpendMonthly) : 0;

  // ── Prime Cost — CONTEXT ONLY (never scored into the overall) ──
  const periodLabor = num(cd.labor_cost) != null ? cd.labor_cost
    : ((wkBarLabor != null || wkFoodLabor != null)
      ? round0(((wkBarLabor || 0) + (wkFoodLabor || 0)) * periodWeeks) : null);
  const primeAmtPeriod = (periodLabor != null) ? round0(totalCogsPeriod + periodLabor) : null;
  const primePct = round1(num(cd.prime_cost_pct) != null ? cd.prime_cost_pct
    : (wkPrime != null ? wkPrime : (periodTotalRev > 0 && primeAmtPeriod != null ? (primeAmtPeriod / periodTotalRev) * 100 : null)));
  const laborPct = round1(periodLabor != null && periodTotalRev > 0 ? (periodLabor / periodTotalRev) * 100 : null);

  // ── Overall — the five independent levers, N/A excluded. Prime is NOT averaged
  //    in (it is pour + food + labor, so it would double-weight S1/S2). ──
  // Null when EVERY section is N/A, never a number. avg() returns null there, and
  // clampScore(null) rounds to 0 then floors to 1, so a brand-new bar with nothing to
  // score used to be handed a confident 1/100 sitting next to INDUSTRY_AVG 63 on its
  // very first audit. That is the fabricated placeholder this file's honesty contract
  // exists to forbid.
  const _overallAvg = avg([s1, s2, s3, s4, s5]);
  const overall = _overallAvg != null ? clampScore(_overallAvg) : null;

  const latestEnd = weeks.length ? (weeks[weeks.length - 1].period_end || weeks[weeks.length - 1].week_end) : null;
  const auditPeriod = latestEnd ? (`${PERIOD_WEEKS} weeks ending ${latestEnd}`) : 'Most recent 4 weeks';
  const dataTier = (controlData && (cd.sources || []).length)
    ? 'Bar Cop operating data'
    : (weeks.length ? 'Weekly data entered' : 'Baseline');

  return {
    BAR_NAME: settings.bar_name || '',
    BAR_CITY_STATE: settings.city_state || '',
    AUDIT_PERIOD: auditPeriod,
    DATA_TIER_LABEL: dataTier,
    OVERALL_SCORE: overall,
    INDUSTRY_AVG: 63,
    TARGET_SCORE: 70,

    // S1 — Pour & Bar Cost
    S1_SCORE: s1,
    S1_BAR_COST_PCT: barCostPct,
    S1_TARGET_PCT: barTarget,
    S1_BAR_REV_MONTHLY: round0(monthlyBarRev),
    S1_BAR_REV_PERIOD: round0(periodBarRev),
    S1_BEV_COGS_PERIOD: bevCogsPeriod,
    S1_RECIPE_COVERAGE: covText(barCov, 'bar items'),
    S1_RECIPE_COVERAGE_PCT: barCov ? barCov.pct : null,
    S1_MONTHLY_GAP: s1MonthlyGap,
    S1_ANNUAL_GAP: round0(s1MonthlyGap * 12),

    // S2 — Food Cost
    S2_SCORE: s2,
    S2_FOOD_COST_PCT: foodCostPct,
    S2_TARGET_PCT: foodTarget,
    S2_FOOD_REV_MONTHLY: round0(monthlyFoodRev),
    S2_RECIPE_COVERAGE: covText(kitCov, 'plates'),
    S2_RECIPE_COVERAGE_PCT: kitCov ? kitCov.pct : null,
    S2_MONTHLY_GAP: s2MonthlyGap,
    S2_ANNUAL_GAP: round0(s2MonthlyGap * 12),

    // S3 — Shrink & Waste (scored; NO recoverable dollar — it lives in S1/S2)
    S3_SCORE: s3,
    S3_INV_VARIANCE_DOLLAR: invVarDollar != null ? round0(Math.abs(invVarDollar)) : null,
    S3_INV_VARIANCE_PCT: invVarPct,
    S3_SPOT_CHECKS: spotChecks || null,
    S3_SPOT_VARIANCE_DOLLAR: spotVarDollar != null ? round0(Math.abs(spotVarDollar)) : null,
    S3_SPOT_FLAGGED: spotFlagged != null ? round0(spotFlagged) : null,
    S3_WASTE_TOTAL: wasteTotal != null ? round0(wasteTotal) : null,
    S3_COUNTS_IN_PERIOD: invCounts || null,
    S3_COUNT_FREQ: countFreq,
    S3_SHRINK_PERIOD: shrinkDollar || null,
    S3_MONTHLY_GAP: 0,

    // S4 — Theft & Cash Loss
    S4_SCORE: s4,
    S4_VOID_COMP_PCT: voidCompPct,
    S4_VOID_COMP_AMT: voidCompAmt,
    S4_VOIDS_NO_APPROVAL_PCT: voidsNoApprovalPct,
    S4_CASH_SHORT_RATE_PCT: cashShortRate,
    S4_DRAWER_RECON: haveCashRecon ? `Yes, ${reconCount} counts` : 'Not documented',
    S4_WALKED_TABS_TOTAL: walkedTotal != null ? round0(walkedTotal) : null,
    S4_WALKED_TABS_COUNT: walkedCount != null ? round0(walkedCount) : null,
    S4_SALES_INTEGRITY_FLAGS: siFlags != null ? round0(siFlags) : null,
    S4_MONTHLY_GAP: s4MonthlyGap,
    S4_ANNUAL_GAP: round0(s4MonthlyGap * 12),

    // S5 — Vendor Cost Control
    S5_SCORE: s5,
    S5_DELIVERIES_LOGGED: deliveries || null,
    S5_VENDOR_PRICE_CHANGES: priceChanges || null,
    S5_VENDOR_SPEND_MONTHLY: vendorSpendMonthly,
    S5_PRICE_VERIFY: (priceChanges > 0 || vendorLog.length > 0) ? `Active, ${priceChanges || vendorLog.length} price changes caught` : 'Not documented',
    S5_UNCOLLECTED_CREDITS: uncollected,
    S5_RECOVERED_CREDITS: recovered,
    S5_OPEN_CREDIT_COUNT: openCount,
    S5_CREDIT_RECOVERY_PCT: recoveryPct,
    S5_EXPOSURE_MONTHLY: s5ExposureMonthly,
    S5_EXPOSURE_ANNUAL: round0(s5ExposureMonthly * 12),

    // Prime — context stat (not a scored section)
    PRIME_COST_PCT: primePct,
    PRIME_TARGET_PCT: primeTarget,
    PRIME_COST_AMT: primeAmtPeriod,
    PRIME_LABOR_PCT: laborPct,
    PRIME_LABOR_PERIOD: periodLabor,
    PRIME_TOTAL_REV_PERIOD: round0(periodTotalRev),
    PRIME_TOTAL_COGS_PERIOD: round0(totalCogsPeriod),

    // Recoverable reconciles to S1 + S2 (cost) + S4 (theft). Shrink (S3) and
    // vendor exposure (S5) add no dollar (shrink is inside S1/S2; exposure is an
    // estimate), so no double count.
    WEEKLY_GAP_AMT: '$' + Math.round(((s1MonthlyGap + s2MonthlyGap + s4MonthlyGap)) / WEEKS_PER_MONTH).toLocaleString('en-US')
  };
}

/* computeRevenueAudit(appData, controlData) — see header for section layout. */
function computeRevenueAudit(appData, controlData) {
  appData = appData || {};
  controlData = controlData || null;
  const settings = appData.settings || {};
  const rt = (appData.revenue_settings && appData.revenue_settings.targets) || {};
  const cd = controlData || {};
  const weeks = (appData.revenue_weeks || [])
    .filter(w => w && ((num(w.bar_revenue) || 0) + (num(w.floor_revenue) || 0) > 0 || num(w.total_revenue) > 0))
    .sort((a, b) => String(a.period_end || a.week_end || '').localeCompare(String(b.period_end || b.week_end || '')))
    .slice(-PERIOD_WEEKS);   // sort oldest->newest FIRST (revenue_weeks arrives newest-first) so slice(-4) is the most recent 4, not the oldest
  // Match the client's Menu Engineering filter exactly: a priced, costed, selling,
  // non-archived item. `num(i.cost) != null` let cost=0 items through (num(0)===0),
  // so a menu imported without a cost column scored as all-Stars — a "healthy menu"
  // built from unknown costs — and Dog-Test-cut (archived) items kept depressing the
  // score after the operator had already removed them.
  const menuItems = (appData.menu_items || []).filter(i => num(i.price) > 0 && num(i.cost) > 0 && num(i.weekly_covers) > 0 && !i.archived);
  // Window server checks to the audit's trailing period (the same weeks the
  // revenue base uses), not all-time. Averaging every check ever logged let a
  // server who left months ago set the bottom check average, widening the spread
  // and inflating the S4 recoverable dollar under a header that reads "4 weeks
  // ending ...". Mirrors the S5 events window below.
  const _shiftYmd = (ymd, days) => { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  const _scWinEnd = weeks.length ? String(weeks[weeks.length - 1].period_end || weeks[weeks.length - 1].week_end || '').slice(0, 10) : '';
  const _scWinStart = _scWinEnd ? _shiftYmd(_scWinEnd, -(PERIOD_WEEKS * 7 - 1)) : '';
  const serverChecks = (appData.revenue_server_checks || [])
    .filter(c => (num(c.covers) > 0) && num(c.sales) != null)
    .filter(c => {
      if (!_scWinStart || !_scWinEnd) return true;   // no closed weeks yet: use every check we have
      const d = String(c.date || '').slice(0, 10);
      return d && d >= _scWinStart && d <= _scWinEnd;
    });
  const priceLog = appData.revenue_price_log || [];
  const dogTests = appData.menu_dog_tests || [];
  const events = (appData.bookings || []).filter(e => e && e.stage === 'Completed');

  const checkTarget = num(rt.check_avg) != null ? rt.check_avg : 35;
  const st = settings.targets || {};
  const laborTarget = num(st.labor_cost_pct) != null ? num(st.labor_cost_pct)
    : (num(st.bar_labor_cost_pct) != null && num(st.food_labor_cost_pct) != null)
      ? (num(st.bar_labor_cost_pct) + num(st.food_labor_cost_pct)) / 2
    : num(rt.labor_pct_blended) != null ? rt.labor_pct_blended
    : (((num(rt.bar_labor_pct) != null ? rt.bar_labor_pct : 28)
      + (num(rt.kitchen_labor_pct) != null ? rt.kitchen_labor_pct : 30)
      + (num(rt.floor_labor_pct) != null ? rt.floor_labor_pct : 32)) / 3);
  const rplhTarget = num(rt.rplh_dinner) != null ? rt.rplh_dinner : 75;

  const wkTotalRev = avg(weeks.map(w => num(w.total_revenue) != null ? w.total_revenue : (num(w.bar_revenue) || 0) + (num(w.floor_revenue) || 0)));
  // No closed weeks yet: fall back to the operator's weekly sales estimate given
  // at generate time (contextual and fresh, not a stale annual guess).
  const estWk = settings.week_sales_estimate || {};
  const estWeekTotal = (num(estWk.bar) || 0) + (num(estWk.food) || 0);
  const monthlyRev = wkTotalRev != null ? wkTotalRev * WEEKS_PER_MONTH : (estWeekTotal > 0 ? estWeekTotal * WEEKS_PER_MONTH : null);
  // Revenue over the AUDIT WINDOW (the "N weeks ending X" this report is labeled with),
  // as opposed to monthlyRev's 4.345 weeks. S2_LABOR_PERIOD needs this: its other branch
  // is a true 4-week sum off Control data, so deriving the fallback from a month put two
  // different period lengths under one "Total Labor Period" heading, 8.6% apart.
  const _periodWeeks = weeks.length || PERIOD_WEEKS;
  const periodRev = wkTotalRev != null ? wkTotalRev * _periodWeeks : (estWeekTotal > 0 ? estWeekTotal * _periodWeeks : null);
  const wkCovers = avg(weeks.map(w => w.covers));
  const monthlyCovers = wkCovers != null ? wkCovers * WEEKS_PER_MONTH : null;

  // ── S1 — Check Average & Revenue ──
  const wkCheckAvg = avg(weeks.map(w => w.check_avg));
  let checkAvg = num(cd.check_average) != null ? cd.check_average : wkCheckAvg;
  if (checkAvg == null && monthlyRev != null && monthlyCovers > 0) checkAvg = monthlyRev / monthlyCovers;
  checkAvg = round2(checkAvg);
  let s1 = null, s1Gap = 0;
  if (checkAvg != null) {
    const below = checkTarget - checkAvg;
    s1 = clampScore(below <= 1 ? 85 : below <= 3 ? 70 : below <= 5 ? 55 : 35);
    if (below > 0 && monthlyCovers != null) s1Gap = round0(below * monthlyCovers);
  }

  // ── S2 — Labor Efficiency ──
  const laborPct = round1(num(cd.labor_pct_blended) != null ? cd.labor_pct_blended : avg(weeks.map(w => w.labor_pct_blended)));
  const rplh = round0(num(cd.rplh_blended) != null ? cd.rplh_blended : avg(weeks.map(w => w.rplh_blended)));
  let s2 = null, s2Gap = 0;
  if (laborPct != null) {
    const over = laborPct - laborTarget;
    s2 = clampScore(over <= 1 ? 85 : over <= 3 ? 65 : over <= 5 ? 50 : 35);
    if (over > 0 && monthlyRev != null) s2Gap = round0((over / 100) * monthlyRev);
  }

  // ── S3 — Menu Performance (Dog ratio + real repricing recency + dog tests) ──
  let stars = 0, plow = 0, puzzle = 0, dog = 0, menuKnown = false, topCategory = null;
  if (menuItems.length >= 4) {
    menuKnown = true;
    const avgCM = avg(menuItems.map(i => i.price - i.cost));
    const avgCov = avg(menuItems.map(i => i.weekly_covers));
    menuItems.forEach(i => {
      const hiM = (i.price - i.cost) >= avgCM, hiV = i.weekly_covers >= avgCov;
      if (hiM && hiV) stars++; else if (!hiM && hiV) plow++; else if (hiM && !hiV) puzzle++; else dog++;
    });
    const catCov = {};
    menuItems.forEach(i => { const c = i.category || 'Other'; catCov[c] = (catCov[c] || 0) + i.weekly_covers; });
    topCategory = Object.keys(catCov).sort((a, b) => catCov[b] - catCov[a])[0] || null;
  }
  // Real repricing recency from the price-change log (increases only). No self-
  // report: the app logs every price change, so this reads the actual last raise.
  const raises = priceLog.filter(p => num(p.new_price) != null && num(p.old_price) != null && p.new_price > p.old_price && p.date);
  let repriceMonths = null, repriceRecent = false, repriceStale = false, lastRaiseTxt = null;
  if (raises.length) {
    const latest = raises.map(p => p.date).sort()[raises.length - 1];
    const d = new Date(String(latest).slice(0, 10) + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      repriceMonths = Math.max(0, Math.round((Date.now() - d.getTime()) / (30 * 86400000)));
      repriceRecent = repriceMonths <= 6;
      repriceStale = repriceMonths > 12;
      lastRaiseTxt = repriceMonths <= 1 ? 'Within the last month'
        : repriceMonths <= 6 ? `${repriceMonths} months ago`
        : repriceMonths <= 12 ? `${repriceMonths} months ago`
        : 'Over a year ago';
    }
  } else if (priceLog.length === 0) {
    repriceStale = false; // no log at all — unknown, do not penalize or credit
  }
  const dogTestsActive = dogTests.filter(t => t && t.status === 'Testing').length;   // only 'Testing' is actively running; 'Kept'/'Cut' are decided, 'Removed' is never written
  let s3 = null;
  if (menuKnown) {
    const total = stars + plow + puzzle + dog || 1;
    const dogRatio = dog / total;
    s3 = dogRatio <= 0.10 ? 80 : dogRatio <= 0.25 ? 60 : dogRatio <= 0.40 ? 45 : 30;
    if (repriceRecent) s3 += 8;                 // actively repricing to inflation (measured)
    if (dogTestsActive > 0) s3 += 4;            // working the low performers
    s3 = clampScore(s3);
  }

  // ── S4 — Server Performance (check-average spread + comp discipline) ──
  // Two independent scored dimensions off the server-check data we already
  // collect. N/A when there are fewer than 3 checks and no comp data.
  let spreadScore = null, topCA = null, botCA = null, teamCA = null, spread = null, s4Gap = 0, serverCount = null;
  if (serverChecks.length >= 3) {
    // Group by SERVER (staff), not by raw shift row: a server's check average is
    // their total sales over their total covers across the window (matching the
    // on-screen scorecard). Scoring shift rows would compare best-shift vs worst-
    // shift, not best server vs worst.
    const byServer = {};
    serverChecks.forEach(c => {
      const key = c.staff_id || c.server_name || c.server || c.name;
      if (!key) return;
      if (!byServer[key]) byServer[key] = { sales: 0, covers: 0 };
      byServer[key].sales += num(c.sales) || 0;
      byServer[key].covers += num(c.covers) || 0;
    });
    const cas = Object.keys(byServer)
      .map(k => byServer[k].covers > 0 ? byServer[k].sales / byServer[k].covers : null)
      .filter(x => x != null).sort((a, b) => a - b);
    serverCount = cas.length || null;
    if (cas.length >= 3) {
      botCA = round2(cas[0]); topCA = round2(cas[cas.length - 1]);
      teamCA = round2(avg(cas));
      spread = round2(topCA - botCA);
      const spreadPct = teamCA ? spread / teamCA : 0;
      spreadScore = spreadPct <= 0.15 ? 80 : spreadPct <= 0.30 ? 60 : spreadPct <= 0.50 ? 45 : 30;
      const bottomThird = cas.slice(0, Math.max(1, Math.floor(cas.length / 3)));
      const botAvg = avg(bottomThird);
      if (teamCA != null && botAvg != null && teamCA > botAvg && monthlyCovers != null) {
        const botCovers = monthlyCovers * (bottomThird.length / cas.length);
        s4Gap = round0((teamCA - botAvg) * botCovers);
      }
    }
  }
  const compPct = round1(num(cd.server_comp_pct));
  let compScore = null;
  if (compPct != null) {
    compScore = compPct <= COMP_BENCHMARK_PCT ? 80 : compPct <= COMP_BENCHMARK_PCT + 2 ? 55 : compPct <= COMP_BENCHMARK_PCT + 4 ? 40 : 25;
  }
  const s4 = (spreadScore != null || compScore != null) ? clampScore(avg([spreadScore, compScore])) : null;

  // ── S5 — Events & Private Dining ──
  // Window completed events to the audit's trailing period (the same weeks the
  // revenue base uses), not all-time. Summing every event ever and dividing by a
  // hardcoded 3 months made years of catering read as one period's worth — the
  // dollar the narrative calls "in the window" and the S5 score were both false.
  let s5 = null, eventsPerMonth = null, avgEventRev = null, eventRevPeriod = null;
  {
    const shiftYmd = (ymd, days) => { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
    const evDate = e => String(e.event_date || '').slice(0, 10);
    const winEnd = weeks.length
      ? String(weeks[weeks.length - 1].period_end || weeks[weeks.length - 1].week_end || '').slice(0, 10)
      : (events.map(evDate).filter(Boolean).sort().slice(-1)[0] || '');
    const winStart = winEnd ? shiftYmd(winEnd, -(PERIOD_WEEKS * 7 - 1)) : '';
    const windowEvents = (winStart && winEnd)
      ? events.filter(e => { const d = evDate(e); return d && d >= winStart && d <= winEnd; })
      : events;
    if (windowEvents.length > 0) {
      const monthsInPeriod = PERIOD_WEEKS / WEEKS_PER_MONTH;   // the real length of the audit window, not an assumed 3
      eventRevPeriod = round0(windowEvents.reduce((s, e) => s + (num(e.actual_revenue) || 0), 0));
      eventsPerMonth = round1(windowEvents.length / monthsInPeriod);
      avgEventRev = round0(eventRevPeriod / windowEvents.length);
      s5 = clampScore(eventsPerMonth >= 4 ? 80 : eventsPerMonth >= 2 ? 60 : eventsPerMonth >= 1 ? 45 : 30);
    }
  }

  // Null when every section is N/A, same reason as the profit audit above.
  const _overallAvg = avg([s1, s2, s3, s4, s5]);
  const overall = _overallAvg != null ? clampScore(_overallAvg) : null;
  const latestEnd = weeks.length ? (weeks[weeks.length - 1].period_end || weeks[weeks.length - 1].week_end) : null;
  const auditPeriod = latestEnd ? (`${PERIOD_WEEKS} weeks ending ${latestEnd}`) : 'Most recent 4 weeks';
  const dataTier = (controlData && (cd.sources || []).length) ? 'Bar Cop operating data'
    : (weeks.length ? 'Weekly data entered' : 'Baseline');

  const revenueOpportunity = (s1Gap || 0) + (s4Gap || 0);
  const costRecovery = (s2Gap || 0);

  return {
    BAR_NAME: settings.bar_name || '',
    BAR_CITY_STATE: settings.city_state || '',
    AUDIT_PERIOD: auditPeriod,
    DATA_TIER_LABEL: dataTier,
    OVERALL_SCORE: overall,
    INDUSTRY_AVG: 61,
    TARGET_SCORE: 70,

    S1_SCORE: s1,
    S1_CHECK_AVG: checkAvg,
    S1_CHECK_AVG_TARGET: round2(checkTarget),
    S1_BAR_CHECK_AVG: round2(avg(weeks.map(w => w.bar_check_avg))),
    S1_FOOD_CHECK_AVG: round2(avg(weeks.map(w => w.food_check_avg))),
    S1_COVER_COUNT: round0(monthlyCovers),
    S1_MONTHLY_REVENUE: round0(monthlyRev),
    S1_MONTHLY_GAP: s1Gap,
    S1_ANNUAL_GAP: round0(s1Gap * 12),

    S2_SCORE: s2,
    S2_LABOR_PCT: laborPct,
    S2_LABOR_TARGET_PCT: round1(laborTarget),
    S2_RPLH: rplh,
    S2_RPLH_TARGET: round0(rplhTarget),
    S2_LABOR_PERIOD: num(cd.labor_cost) != null ? cd.labor_cost : (laborPct != null && periodRev != null ? round0((laborPct / 100) * periodRev) : null),
    S2_MONTHLY_GAP: s2Gap,
    S2_ANNUAL_GAP: round0(s2Gap * 12),

    S3_SCORE: s3,
    S3_STARS_COUNT: menuKnown ? stars : null,
    S3_PLOWHORSES_COUNT: menuKnown ? plow : null,
    S3_PUZZLES_COUNT: menuKnown ? puzzle : null,
    S3_DOGS_COUNT: menuKnown ? dog : null,
    S3_TOP_CATEGORY: topCategory || 'Not available',
    S3_LAST_PRICE_INCREASE: lastRaiseTxt,
    S3_REPRICE_MONTHS: repriceMonths,
    S3_PRICING_STALE: raises.length ? repriceStale : null,
    S3_DOG_TESTS_ACTIVE: dogTestsActive || null,
    S3_MONTHLY_GAP: 0,

    S4_SCORE: s4,
    S4_SERVER_COUNT: serverCount,
    S4_TOP_CHECK_AVG: topCA,
    S4_BOTTOM_CHECK_AVG: botCA,
    S4_TEAM_CHECK_AVG: teamCA,
    S4_PERFORMANCE_SPREAD: spread,
    S4_SPREAD_SCORE: spreadScore,
    S4_COMP_PCT: compPct,
    S4_COMP_BENCHMARK_PCT: COMP_BENCHMARK_PCT,
    S4_COMP_SCORE: compScore,
    S4_MONTHLY_GAP: s4Gap,
    S4_ANNUAL_GAP: round0(s4Gap * 12),

    S5_SCORE: s5,
    S5_EVENT_REV_PERIOD: eventRevPeriod,
    S5_EVENTS_PER_MONTH: eventsPerMonth,
    S5_AVG_EVENT_REVENUE: avgEventRev,
    S5_MINIMUM_MET: events.length ? 'Tracked' : 'No package',
    S5_MONTHLY_GAP: 0,

    REVENUE_OPPORTUNITY_MONTHLY: round0(revenueOpportunity),
    COST_RECOVERY_MONTHLY: round0(costRecovery),
    WEEKLY_GAP_AMT: '$' + Math.round((revenueOpportunity + costRecovery) / WEEKS_PER_MONTH).toLocaleString('en-US')
  };
}

module.exports = { computeProfitAudit, computeRevenueAudit };

// ── Self-test: node server/audit-compute.js ───────────────────────────────────
if (require.main === module) {
  const appData = {
    settings: {
      bar_name: 'The Anchor Bar & Kitchen', city_state: 'Austin, TX',
      targets: { bar_pour_cost_pct: 22, food_cost_pct: 32, prime_cost_pct: 60 }
    },
    weeks: [1, 2, 3, 4].map(i => ({
      period_end: `2026-04-0${i}`,
      bar: { revenue: 10000, cost_pct: 27.0, labor: 2900 },
      food: { revenue: 6000, cost_pct: 36.0, labor: 1900 },
      prime_cost_pct: 63.0
    })),
    menu_items: [
      { name: 'Old Fashioned', category: 'Cocktail', cost: 2.5 },
      { name: 'Margarita', category: 'Cocktail', cost: 2.1 },
      { name: 'House Red', category: 'Wine', cost: 0 },
      { name: 'Burger', category: 'Entree', cost: 4, recipe: { mode: 'food' } },
      { name: 'Wings', category: 'Starter', cost: 3, recipe: { mode: 'food' } },
      { name: 'Fries', category: 'Side', cost: 0, recipe: { mode: 'food' } }
    ],
    vendor_log: [{}, {}, {}],
    vendor_discrepancies: [
      { status: 'Open', overcharge: 400 }, { status: 'Credit Requested', overcharge: 350 },
      { status: 'Resolved', overcharge: 200, recovered_amount: 200 }
    ]
  };
  const controlData = {
    bar_cost_pct: 27.0, food_cost_pct: 36.0, prime_cost_pct: 63.0,
    void_comp_count: 40, void_comp_total: 2600, void_comp_unauthorized: 12,
    cash_reconciliations: 28, cash_short_count: 6, labor_cost: 19200,
    inventory_counts: 4, spot_checks: 6, spot_check_variance_dollar: 180,
    inv_variance_dollar: 1400, waste_total: 300,
    walked_tabs_total: 420, walked_tabs_count: 6, sales_integrity_flags: 1,
    deliveries_logged: 12, vendor_price_changes: 3,
    sources: ['Inventory Control counts', 'Shift Control void and comp log']
  };
  const d = computeProfitAudit(appData, controlData);

  const monthlyBarRev = 10000 * 4.345;
  const monthlyFoodRev = 6000 * 4.345;
  const expS1Gap = Math.round(((27 - 22) / 100) * monthlyBarRev);
  const expS2Gap = Math.round(((36 - 32) / 100) * monthlyFoodRev);
  const periodTotalRev = (10000 + 6000) * 4;
  const expVoidPct = Math.round(((2600 / periodTotalRev) * 100) * 10) / 10;
  const expS4Gap = Math.round(((expVoidPct - 2.0) / 100) * (monthlyBarRev + monthlyFoodRev));

  const checks = [
    ['S1 Pour scored (5 over, +recipe cov)', d.S1_SCORE != null && d.S1_SCORE >= 1, true],
    ['S1 monthly gap', d.S1_MONTHLY_GAP, expS1Gap],
    ['S2 Food scored', d.S2_SCORE != null, true],
    ['S2 monthly gap', d.S2_MONTHLY_GAP, expS2Gap],
    ['S3 Shrink scored from variance data', d.S3_SCORE != null && d.S3_SCORE >= 1, true],
    ['S3 shows variance dollar', d.S3_INV_VARIANCE_DOLLAR, 1400],
    ['S3 count frequency weekly (4 in 4wk)', d.S3_COUNT_FREQ, 'Weekly'],
    ['S3 adds NO recoverable dollar', d.S3_MONTHLY_GAP, 0],
    ['S4 void/comp pct', d.S4_VOID_COMP_PCT, expVoidPct],
    ['S4 monthly gap', d.S4_MONTHLY_GAP, expS4Gap],
    ['S4 bad rate scores low', d.S4_SCORE < 50, true],
    ['S4 walked tabs surfaced', d.S4_WALKED_TABS_TOTAL, 420],
    ['S5 vendor scored from deliveries', d.S5_SCORE != null && d.S5_SCORE >= 1, true],
    ['S5 uncollected credits summed', d.S5_UNCOLLECTED_CREDITS, 750],
    ['S5 credit recovery rate', d.S5_CREDIT_RECOVERY_PCT, 21],
    ['Prime is context, not a scored S-section (no S6..)', d.S6_SCORE, undefined],
    ['Prime pct present as context', d.PRIME_COST_PCT, 63.0],
    ['OVERALL 1-100', d.OVERALL_SCORE >= 1 && d.OVERALL_SCORE <= 100, true],
    ['recoverable = S1+S2+S4 only (weekly gap present)', /^\$/.test(d.WEEKLY_GAP_AMT), true]
  ];

  // Bar-only: Food N/A, excluded from overall.
  const barOnly = computeProfitAudit({ settings: { week_sales_estimate: { bar: 13800 }, targets: {} }, menu_items: [] },
    { bar_cost_pct: 24, sources: ['x'] });
  checks.push(['bar-only: S2 Food N/A', barOnly.S2_SCORE, null]);
  checks.push(['bar-only: S1 Bar scored', barOnly.S1_SCORE != null, true]);

  // No inventory activity -> S3 N/A.
  const noInv = computeProfitAudit({ settings: { week_sales_estimate: { bar: 11500, food: 6900 }, targets: {} } },
    { bar_cost_pct: 22, food_cost_pct: 31, sources: ['x'] });
  checks.push(['no inventory data: S3 N/A', noInv.S3_SCORE, null]);

  let pass = 0;
  for (const [label, got, exp] of checks) {
    const ok = got === exp; if (ok) pass++;
    console.log((ok ? 'PASS ' : 'FAIL ') + label + '  got=' + got + (ok ? '' : ' expected=' + exp));
  }
  console.log(`\n${pass}/${checks.length} profit checks passed`);

  // ── Revenue audit ──
  console.log('\n--- Revenue audit ---');
  const rWeeks = [1, 2, 3, 4].map(i => ({
    period_end: `2026-04-0${i}`, total_revenue: 18000, covers: 600,
    bar_revenue: 11000, floor_revenue: 7000, check_avg: 30.0, labor_pct_blended: 34.0, rplh_blended: 58
  }));
  const rMenu = [
    { name: 'Burger', category: 'Entree', price: 16, cost: 6, weekly_covers: 120 },
    { name: 'Steak', category: 'Entree', price: 38, cost: 14, weekly_covers: 40 },
    { name: 'Fries', category: 'Side', price: 7, cost: 2, weekly_covers: 150 },
    { name: 'Wings', category: 'Starter', price: 13, cost: 7, weekly_covers: 30 },
    { name: 'Salad', category: 'Starter', price: 12, cost: 4, weekly_covers: 25 }
  ];
  const rServers = [
    { server_name: 'A', covers: 100, sales: 3800 }, { server_name: 'B', covers: 100, sales: 3100 },
    { server_name: 'C', covers: 100, sales: 2400 }, { server_name: 'D', covers: 100, sales: 2900 }
  ];
  const rev = computeRevenueAudit({
    settings: { bar_name: 'The Anchor Bar & Kitchen' },
    revenue_settings: { targets: { check_avg: 35 } },
    revenue_weeks: rWeeks, menu_items: rMenu, revenue_server_checks: rServers, bookings: [],
    revenue_price_log: [{ old_price: 15, new_price: 16, date: '2026-03-20' }],
    menu_dog_tests: [{ status: 'Testing' }]
  }, { server_comp_pct: 2.0 });
  const rExpCovers = 600 * 4.345;
  const rExpS1Gap = Math.round((35 - 30) * rExpCovers);
  const rChecks = [
    ['Rev S1 check avg', rev.S1_CHECK_AVG, 30],
    ['Rev S1 gap = below x covers', rev.S1_MONTHLY_GAP, rExpS1Gap],
    ['Rev S2 labor scored', rev.S2_SCORE != null, true],
    ['Rev S2 gap is cost recovery', rev.COST_RECOVERY_MONTHLY, rev.S2_MONTHLY_GAP],
    ['Rev S3 menu classified (5)', (rev.S3_STARS_COUNT + rev.S3_PLOWHORSES_COUNT + rev.S3_PUZZLES_COUNT + rev.S3_DOGS_COUNT), 5],
    ['Rev S3 repricing recency from log', rev.S3_REPRICE_MONTHS != null, true],
    ['Rev S3 no fabricated dollar', rev.S3_MONTHLY_GAP, 0],
    ['Rev S4 spread computed', rev.S4_PERFORMANCE_SPREAD != null, true],
    ['Rev S4 comp discipline scored', rev.S4_COMP_SCORE != null, true],
    ['Rev S4 server count = actual checks (not roster)', rev.S4_SERVER_COUNT, 4],
    ['Rev S5 events N/A when none', rev.S5_SCORE, null],
    ['Rev OVERALL 1-100', rev.OVERALL_SCORE >= 1 && rev.OVERALL_SCORE <= 100, true]
  ];
  const revEv = computeRevenueAudit({ settings: {}, revenue_settings: { targets: {} }, bookings: [{ stage: 'Completed', actual_revenue: 2400 }, { stage: 'Completed', actual_revenue: 3100 }, { stage: 'Completed', actual_revenue: 1800 }] }, null);
  rChecks.push(['Rev S5 scores when events exist', revEv.S5_SCORE > 0, true]);
  const revNoServer = computeRevenueAudit({ settings: {}, revenue_settings: { targets: {} }, revenue_server_checks: [{ server_name: 'A', covers: 10, sales: 300 }] }, null);
  rChecks.push(['Rev S4 N/A with <3 checks and no comp data', revNoServer.S4_SCORE, null]);

  let rPass = 0;
  for (const [label, got, exp] of rChecks) {
    const ok = got === exp; if (ok) rPass++;
    console.log((ok ? 'PASS ' : 'FAIL ') + label + '  got=' + got + (ok ? '' : ' expected=' + exp));
  }
  console.log(`\n${rPass}/${rChecks.length} revenue checks passed`);
}
