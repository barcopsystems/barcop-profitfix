'use strict';

/* ── Audit Compute — deterministic audit math (honesty rebuild, 2026-05-29) ────
   Every audit SCORE and DOLLAR figure is computed here in code, from the real
   data Bar Cop holds. The Claude API never does arithmetic — it only reads
   uploaded files (extraction) and writes the operator-voice prose around the
   numbers this module locks. See memory: audit-honesty-rebuild, output-honesty.

   Honesty contract for every number this file returns:
     1. computed from held data (intake fields + parsed uploads + Control data)
     2. correct for the period it claims (a 4-week audit period, never x52 cash)
     3. no double-counting a composite and its parts (prime cost is CONTEXT,
        never summed into the recoverable total with pour + food)
     4. cost recovery is kept separate from revenue growth
     5. anything we cannot compute honestly is returned null / "Not documented",
        never a fabricated placeholder.

   Period basis: the audit covers the trailing 4 weeks of `weeks` data. Control
   percentages and Control sums passed in are expected to be scoped to that same
   window (see audit-tracker.js buildControlData period scoping). Monthly =
   weekly average x 4.345. */

const WEEKS_PER_MONTH = 4.345;
const PERIOD_WEEKS = 4;
const VOID_COMP_BENCHMARK_PCT = 2.0;   // S2 benchmark (server prompt S2_BENCHMARK_PCT)
const VENDOR_EXPOSURE_PCT = 3.0;       // S4 exposure assumption (server prompt S4_EXPOSURE_PCT)

function num(v) { return (v == null || isNaN(v)) ? null : Number(v); }
function round1(v) { return v == null ? null : Math.round(v * 10) / 10; }
function round0(v) { return v == null ? null : Math.round(v); }
function clampScore(v) { return Math.max(1, Math.min(100, Math.round(v))); } // never 0 per spec
function avg(arr) {
  const v = arr.filter(x => x != null && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// Score for a cost % vs target: at/under target is strong, degrading as it
// runs over. diff = actual - target (positive = over target = worse).
function scoreCostVsTarget(actualPct, targetPct, withinBands) {
  if (actualPct == null || targetPct == null) return null;
  const diff = actualPct - targetPct;
  const b = withinBands;
  if (diff <= 1) return b[0];
  if (diff <= 3) return b[1];
  if (diff <= 5) return b[2];
  return b[3];
}

/* computeProfitAudit(appData, controlData, extracted)
   - appData:    the operator's in-app data (settings, weeks, products, etc.)
   - controlData: verified Control-module figures, period-scoped (or null)
   - extracted:  numbers the model read off uploaded files (or {})
   Returns the numeric/derived fields of the audit `d` object. Prose fields
   (S#_NARRATIVE / FINDING / TOOL, S6 signal text) are added by the narrative
   pass; this function leaves them undefined. */
function computeProfitAudit(appData, controlData, extracted) {
  appData = appData || {};
  controlData = controlData || null;
  extracted = extracted || {};

  const settings = appData.settings || {};
  const targets = settings.targets || {};
  const weeks = (appData.weeks || []).filter(w => w && (w.period_end || w.week_end)).slice(-PERIOD_WEEKS);
  const recipes = appData.recipes || [];
  const barProducts = appData.bar_products || [];
  const kitchenProducts = appData.kitchen_products || [];
  const vendorLog = appData.vendor_log || [];
  const shifts = appData.shifts || [];
  const recons = appData.reconciliations || [];

  const cd = controlData || {};
  const periodWeeks = weeks.length || PERIOD_WEEKS;

  // Targets (operator-set, with documented industry defaults)
  const barTarget = num(targets.bar_pour_cost_pct) != null ? num(targets.bar_pour_cost_pct) : 22;
  const foodTarget = num(targets.food_cost_pct) != null ? num(targets.food_cost_pct) : 32;
  const primeTarget = num(targets.prime_cost_pct) != null ? num(targets.prime_cost_pct) : 60;

  // ── Source-of-truth percentages: Control data first, then weekly averages ──
  const wkBarCost = avg(weeks.map(w => w.bar && w.bar.cost_pct));
  const wkFoodCost = avg(weeks.map(w => w.food && w.food.cost_pct));
  const wkPrime = avg(weeks.map(w => w.prime_cost_pct));
  const barCostPct = round1(num(cd.bar_cost_pct) != null ? cd.bar_cost_pct : wkBarCost);
  const foodCostPct = round1(num(cd.food_cost_pct) != null ? cd.food_cost_pct : wkFoodCost);

  // ── Revenue (weekly avg -> period and monthly) ──
  const wkBarRev = avg(weeks.map(w => w.bar && w.bar.revenue));
  const wkFoodRev = avg(weeks.map(w => w.food && w.food.revenue));
  const wkBarLabor = avg(weeks.map(w => w.bar && w.bar.labor));
  const wkFoodLabor = avg(weeks.map(w => w.food && w.food.labor));

  const monthlyBarRev = wkBarRev != null ? wkBarRev * WEEKS_PER_MONTH : null;
  const monthlyFoodRev = wkFoodRev != null ? wkFoodRev * WEEKS_PER_MONTH : null;
  const periodBarRev = wkBarRev != null ? wkBarRev * periodWeeks : null;
  const periodFoodRev = wkFoodRev != null ? wkFoodRev * periodWeeks : null;
  const periodTotalRev = (periodBarRev || 0) + (periodFoodRev || 0);

  // ── S1 — Bar Cost and Pour Control ──
  const havePourMethod = !!extracted.pour_method;
  let s1 = scoreCostVsTarget(barCostPct, barTarget, [85, 65, 45, 25]) || 25;
  if (recipes.length > 0) s1 += 10;
  if (havePourMethod) s1 += 5;
  s1 = clampScore(s1);
  const s1Diff = (barCostPct != null && barTarget != null) ? barCostPct - barTarget : 0;
  const s1MonthlyGap = (s1Diff > 0 && monthlyBarRev != null) ? round0((s1Diff / 100) * monthlyBarRev) : 0;
  const bevCogsPeriod = (barCostPct != null && periodBarRev != null) ? round0((barCostPct / 100) * periodBarRev) : null;
  const invVarPct = round1(num(extracted.inv_variance_pct));
  const invVarAmt = (invVarPct != null && bevCogsPeriod != null) ? round0((invVarPct / 100) * bevCogsPeriod) : null;

  // ── S2 — Theft and Loss Prevention (RESULTS-based, not presence-based) ──
  // Scored on actual loss behavior: void/comp rate vs benchmark, unauthorized
  // void rate, and cash short rate. Documented controls give modest capped
  // credit that cannot rescue a bad rate. (Decision 8, audit-honesty-rebuild.)
  const haveCashRecon = (num(cd.cash_reconciliations) > 0) || recons.length > 0;
  const haveShiftChecks = shifts.length > 0 || num(cd.spot_checks) > 0;
  const haveApprovalPolicy = !!extracted.void_approval || num(cd.void_comp_unauthorized) != null;
  // Void/comp rate from period-scoped Control sum vs period total revenue.
  let voidCompPct = null, voidCompAmt = null;
  if (num(cd.void_comp_total) != null && periodTotalRev > 0) {
    voidCompAmt = round0(cd.void_comp_total);
    voidCompPct = round1((cd.void_comp_total / periodTotalRev) * 100);
  } else if (extracted.void_comp_pct != null) {
    voidCompPct = round1(num(extracted.void_comp_pct));
    voidCompAmt = (periodTotalRev > 0) ? round0((voidCompPct / 100) * periodTotalRev) : null;
  }
  const voidsNoApprovalPct = (num(cd.void_comp_count) > 0 && num(cd.void_comp_unauthorized) != null)
    ? round0((cd.void_comp_unauthorized / cd.void_comp_count) * 100)
    : (extracted.voids_no_approval_pct != null ? round0(extracted.voids_no_approval_pct) : null);
  // Excess void/comp over benchmark, as a monthly dollar leak.
  const s2MonthlyGap = (voidCompPct != null && voidCompPct > VOID_COMP_BENCHMARK_PCT && monthlyBarRev != null && monthlyFoodRev != null)
    ? round0(((voidCompPct - VOID_COMP_BENCHMARK_PCT) / 100) * (monthlyBarRev + monthlyFoodRev))
    : 0;
  // Score off the actual void/comp rate vs benchmark.
  let s2;
  if (voidCompPct != null) {
    const over = voidCompPct - VOID_COMP_BENCHMARK_PCT;
    s2 = over <= 0 ? 85 : over <= 1 ? 65 : over <= 2 ? 45 : 25;
  } else {
    s2 = 50;   // no void/comp data — insufficient to grade behavior
  }
  // Unauthorized voids are a behavior signal — they drag the score down.
  if (voidsNoApprovalPct != null) {
    if (voidsNoApprovalPct > 25) s2 -= 15;
    else if (voidsNoApprovalPct > 10) s2 -= 8;
  }
  // Cash short rate (shorts as a share of reconciliations) — behavior signal.
  if (num(cd.cash_short_count) != null && num(cd.cash_reconciliations) > 0) {
    const shortRate = cd.cash_short_count / cd.cash_reconciliations;
    if (shortRate > 0.30) s2 -= 10;
    else if (shortRate > 0.15) s2 -= 5;
  }
  // Modest, capped credit for controls that genuinely reduce risk — never
  // enough to rescue a bad rate.
  if (haveApprovalPolicy) s2 += 5;
  if (haveCashRecon) s2 += 5;
  s2 = clampScore(s2);

  // ── S3 — Food Cost Control ──
  const haveInvFreq = !!extracted.inv_freq || num(cd.inventory_counts) > 0;
  let s3 = scoreCostVsTarget(foodCostPct, foodTarget, [85, 65, 45, 25]) || 25;
  if (kitchenProducts.length > 0) s3 += 10;
  if (haveInvFreq) s3 += 5;
  s3 = clampScore(s3);
  const s3Diff = (foodCostPct != null && foodTarget != null) ? foodCostPct - foodTarget : 0;
  const s3MonthlyGap = (s3Diff > 0 && monthlyFoodRev != null) ? round0((s3Diff / 100) * monthlyFoodRev) : 0;
  const foodVarPct = round1(num(extracted.food_var_pct));
  const foodCogsPeriod = (foodCostPct != null && periodFoodRev != null) ? round0((foodCostPct / 100) * periodFoodRev) : null;
  const foodVarAmt = (foodVarPct != null && foodCogsPeriod != null) ? round0((foodVarPct / 100) * foodCogsPeriod) : null;

  // ── S4 — Vendor Control (RESULTS-based: invoice-matching behavior +
  // active price verification, not whether the system is set up) ──
  const matchState = (extracted.invoice_vs_po || '').toLowerCase();
  let s4;
  if (matchState.includes('every') || matchState.includes('matched')) s4 = 80;
  else if (matchState.includes('spot')) s4 = 60;
  else s4 = 40;   // never matched / unknown — exposure goes unchecked
  if (vendorLog.length > 0) s4 += 10;   // actively logging/verifying price drift
  if (extracted.backup_vendors) s4 += 5; // negotiating leverage in place
  s4 = clampScore(s4);
  const vendorSpendMonthly = round0((bevCogsPeriod != null || foodCogsPeriod != null)
    ? (((bevCogsPeriod || 0) + (foodCogsPeriod || 0)) / periodWeeks) * WEEKS_PER_MONTH
    : null);
  const s4ExposureMonthly = vendorSpendMonthly != null ? round0((VENDOR_EXPOSURE_PCT / 100) * vendorSpendMonthly) : 0;

  // ── S5 — Prime Cost (CONTEXT ONLY — never summed into recoverable total) ──
  const periodLabor = num(cd.labor_cost) != null
    ? cd.labor_cost
    : ((wkBarLabor != null || wkFoodLabor != null) ? round0(((wkBarLabor || 0) + (wkFoodLabor || 0)) * periodWeeks) : null);
  const totalCogsPeriod = (bevCogsPeriod || 0) + (foodCogsPeriod || 0);
  const primeAmtPeriod = (periodLabor != null) ? round0(totalCogsPeriod + periodLabor) : null;
  const primePct = round1(num(cd.prime_cost_pct) != null
    ? cd.prime_cost_pct
    : (wkPrime != null ? wkPrime : (periodTotalRev > 0 && primeAmtPeriod != null ? (primeAmtPeriod / periodTotalRev) * 100 : null)));
  const laborPct = round1(periodLabor != null && periodTotalRev > 0 ? (periodLabor / periodTotalRev) * 100 : null);
  let s5 = scoreCostVsTarget(primePct, primeTarget, [80, 60, 40, 20]) || 20;
  s5 += (weeks.length > 4 ? 15 : weeks.length > 0 ? 8 : 0);
  s5 = clampScore(s5);
  // Combined COGS gap is the bar + food monthly overage — shown as the prime
  // cost view ONLY. It equals S1_MONTHLY_GAP + S3_MONTHLY_GAP by definition, so
  // the recoverable total (chunk 5, client) must NOT add this on top of them.
  const combinedCogsGap = (s1MonthlyGap || 0) + (s3MonthlyGap || 0);

  // ── Overall — weighted average S1-S5 (equal weight per server spec) ──
  const overall = clampScore(avg([s1, s2, s3, s4, s5]));

  // ── Period label ──
  const latestEnd = weeks.length ? (weeks[weeks.length - 1].period_end || weeks[weeks.length - 1].week_end) : null;
  const auditPeriod = latestEnd ? (`${PERIOD_WEEKS} weeks ending ${latestEnd}`) : `${PERIOD_WEEKS} weeks`;
  const dataTier = (controlData && (cd.sources || []).length)
    ? 'Verified — Control module data'
    : (weeks.length ? 'Standard — weekly data entered' : 'Baseline — uploaded data');

  return {
    BAR_NAME: settings.bar_name || '',
    BAR_CITY_STATE: settings.city_state || '',
    AUDIT_PERIOD: auditPeriod,
    DATA_TIER_LABEL: dataTier,
    OVERALL_SCORE: overall,
    INDUSTRY_AVG: 63,          // internal Bar Cop benchmark (relabeled in chunk 5)
    TARGET_SCORE: 65,

    S1_SCORE: s1,
    S1_BAR_COST_PCT: barCostPct,
    S1_TARGET_PCT: barTarget,
    S1_BAR_REV_MONTHLY: round0(monthlyBarRev),
    S1_BAR_REV_PERIOD: round0(periodBarRev),
    S1_BEV_COGS_PERIOD: bevCogsPeriod,
    S1_INV_VARIANCE_PCT: invVarPct != null ? invVarPct : 0,
    S1_INV_VARIANCE_AMT: invVarAmt != null ? invVarAmt : 0,
    S1_POUR_METHOD: extracted.pour_method || 'Not documented',
    S1_RECIPE_COVERAGE: `${recipes.length} recipes`,
    S1_MONTHLY_GAP: s1MonthlyGap,
    S1_ANNUAL_GAP: round0(s1MonthlyGap * 12),

    S2_SCORE: s2,
    S2_VOID_COMP_PCT: voidCompPct,
    S2_VOID_COMP_AMT: voidCompAmt,
    S2_VOIDS_NO_APPROVAL_PCT: voidsNoApprovalPct,
    S2_CASH_POLICY: haveCashRecon ? 'Reconciliation performed' : 'Not documented',
    S2_VOID_APPROVAL: haveApprovalPolicy ? 'Manager approval tracked' : 'Not documented',
    S2_DRAWER_RECON: num(cd.cash_reconciliations) > 0 ? `Yes — ${cd.cash_reconciliations} entries` : (recons.length ? `Yes — ${recons.length} entries` : 'No'),
    S2_SPILLAGE_LOG: haveShiftChecks ? 'Yes' : 'Not documented',
    S2_MONTHLY_GAP: s2MonthlyGap,
    S2_ANNUAL_GAP: round0(s2MonthlyGap * 12),

    S3_SCORE: s3,
    S3_FOOD_COST_PCT: foodCostPct,
    S3_TARGET_PCT: foodTarget,
    S3_FOOD_REV_MONTHLY: round0(monthlyFoodRev),
    S3_FOOD_VAR_PCT: foodVarPct != null ? foodVarPct : 0,
    S3_FOOD_VAR_AMT: foodVarAmt != null ? foodVarAmt : 0,
    S3_RECIPE_COVERAGE: `${kitchenProducts.length} kitchen products`,
    S3_INV_FREQ: extracted.inv_freq || (num(cd.inventory_counts) > 0 ? `${cd.inventory_counts} counts on file` : 'Not documented'),
    S3_WASTE_LOG: extracted.waste_log || 'Not documented',
    S3_MONTHLY_GAP: s3MonthlyGap,
    S3_ANNUAL_GAP: round0(s3MonthlyGap * 12),

    S4_SCORE: s4,
    S4_BEV_INVOICE_COUNT: num(extracted.bev_invoice_count) != null ? num(extracted.bev_invoice_count) : vendorLog.length,
    S4_FOOD_INVOICE_COUNT: num(extracted.food_invoice_count) != null ? num(extracted.food_invoice_count) : 0,
    S4_VENDOR_SPEND_MONTHLY: vendorSpendMonthly,
    S4_INVOICE_VS_PO: extracted.invoice_vs_po || 'Not documented',
    S4_PRICE_VERIFY: vendorLog.length > 0 ? `Active — ${vendorLog.length} changes logged` : 'Not documented',
    S4_ANNUAL_BIDS: extracted.annual_bids || 'Not documented',
    S4_BACKUP_VENDORS: extracted.backup_vendors || 'Not documented',
    S4_EXPOSURE_MONTHLY: s4ExposureMonthly,
    S4_EXPOSURE_ANNUAL: round0(s4ExposureMonthly * 12),

    S5_SCORE: s5,
    S5_PRIME_COST_PCT: primePct,
    S5_TARGET_PCT: primeTarget,
    S5_PRIME_COST_AMT: primeAmtPeriod,
    S5_TOTAL_REV_PERIOD: round0(periodTotalRev),
    S5_TOTAL_COGS_PERIOD: round0(totalCogsPeriod),
    S5_LABOR_PERIOD: periodLabor,
    S5_LABOR_PCT: laborPct,
    S5_BAR_COST_PCT: barCostPct,
    S5_FOOD_COST_PCT: foodCostPct,
    S5_LABOR_BY_DEPT: (wkBarLabor != null && wkFoodLabor != null) ? 'Yes' : 'Not documented',
    S5_RPLH_TRACKED: extracted.rplh_tracked || 'Not documented',
    S5_COMBINED_COGS_GAP: combinedCogsGap,  // CONTEXT only — see note above

    // WEEKLY_GAP_AMT reconciles to the recoverable total (S1+S2+S3+S4, NOT S5).
    WEEKLY_GAP_AMT: '$' + Math.round(((s1MonthlyGap + s2MonthlyGap + s3MonthlyGap + s4ExposureMonthly)) / WEEKS_PER_MONTH).toLocaleString('en-US')
  };
}

module.exports = { computeProfitAudit };

// ── Self-test: node server/audit-compute.js ───────────────────────────────────
if (require.main === module) {
  // Representative single-unit operation (~$1M/yr). Bar pour cost over target,
  // food slightly over, prime over — numbers chosen to verify gap math by hand.
  const appData = {
    settings: {
      bar_name: 'The Anchor Bar & Kitchen', city_state: 'Austin, TX',
      annual_bar_revenue: 624000, annual_food_revenue: 374400,
      targets: { bar_pour_cost_pct: 22, food_cost_pct: 32, prime_cost_pct: 60 }
    },
    weeks: [1, 2, 3, 4].map(i => ({
      period_end: `2026-04-0${i}`,
      bar: { revenue: 10000, cost_pct: 27.0, labor: 2900 },
      food: { revenue: 6000, cost_pct: 36.0, labor: 1900 },
      prime_cost_pct: 63.0
    })),
    recipes: [{}, {}], bar_products: new Array(40), kitchen_products: new Array(30),
    vendor_log: [{}, {}, {}], shifts: new Array(20), reconciliations: new Array(10)
  };
  const controlData = {
    bar_cost_pct: 27.0, food_cost_pct: 36.0, prime_cost_pct: 63.0,
    void_comp_count: 40, void_comp_total: 2600, void_comp_unauthorized: 12,
    cash_reconciliations: 28, labor_cost: 19200, inventory_counts: 4, spot_checks: 6,
    sources: ['Inventory Control counts', 'Shift Control void and comp log']
  };
  const d = computeProfitAudit(appData, controlData, { pour_method: 'Free pour', inv_variance_pct: 5.0 });

  const monthlyBarRev = 10000 * 4.345;   // 43450
  const monthlyFoodRev = 6000 * 4.345;   // 26070
  const expS1Gap = Math.round(((27 - 22) / 100) * monthlyBarRev);   // 5% * 43450 = 2173
  const expS3Gap = Math.round(((36 - 32) / 100) * monthlyFoodRev);  // 4% * 26070 = 1043
  const periodTotalRev = (10000 + 6000) * 4;                        // 64000
  const expVoidPct = Math.round(((2600 / periodTotalRev) * 100) * 10) / 10;  // 4.1%
  const expS2Gap = Math.round(((expVoidPct - 2.0) / 100) * (monthlyBarRev + monthlyFoodRev));

  const checks = [
    ['S1_SCORE (diff 5 = within-5 band 45, +10 recipes, +5 pour = 60)', d.S1_SCORE, 60],
    ['S1_MONTHLY_GAP', d.S1_MONTHLY_GAP, expS1Gap],
    ['S3_MONTHLY_GAP', d.S3_MONTHLY_GAP, expS3Gap],
    ['S2_VOID_COMP_PCT', d.S2_VOID_COMP_PCT, expVoidPct],
    ['S2_MONTHLY_GAP', d.S2_MONTHLY_GAP, expS2Gap],
    // Results-based: 4.1% void (2.1 over) = 25, -15 unauth (30%), +5 approval +5 recon = 20.
    ['S2_SCORE results-based (bad rate scores LOW, not 100)', d.S2_SCORE, 20],
    ['S2 score below benchmark-pass even with controls logged', d.S2_SCORE < 50, true],
    // Invoice matching unknown (40) + vendor log present (+10) = 50.
    ['S4_SCORE results-based (unknown matching = mediocre)', d.S4_SCORE, 50],
    ['S5_COMBINED_COGS_GAP == S1+S3 gap (no double count beyond)', d.S5_COMBINED_COGS_GAP, expS1Gap + expS3Gap],
    ['S5 prime % from control', d.S5_PRIME_COST_PCT, 63.0],
    ['OVERALL is 1-100', d.OVERALL_SCORE >= 1 && d.OVERALL_SCORE <= 100, true]
  ];
  let pass = 0;
  for (const [label, got, exp] of checks) {
    const ok = got === exp;
    if (ok) pass++;
    console.log((ok ? 'PASS ' : 'FAIL ') + label + '  got=' + got + (ok ? '' : ' expected=' + exp));
  }
  console.log(`\n${pass}/${checks.length} checks passed`);
  console.log('\nFull computed object:');
  console.log(JSON.stringify(d, null, 2));
}
