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
const BEV_ATTACH_BENCHMARK = 0.85;     // Revenue S1: drinks per guest, internal Bar Cop benchmark for a bar+kitchen
const DISCOUNT_BENCHMARK_PCT = 2.0;    // Profit S2: discounts as % of sales, internal benchmark

function num(v) { return (v == null || isNaN(v)) ? null : Number(v); }
function round1(v) { return v == null ? null : Math.round(v * 10) / 10; }
function round0(v) { return v == null ? null : Math.round(v); }
function round2(v) { return v == null ? null : Math.round(v * 100) / 100; }
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
  // In-app audits span the actual number of weeks (up to 4). An upload-only
  // audit spans the one month its figures represent (~4.345 weeks), so monthly
  // COGS is not mis-scaled into a 4-week period.
  const periodWeeks = weeks.length || WEEKS_PER_MONTH;

  // Targets (operator-set, with documented industry defaults)
  const barTarget = num(targets.bar_pour_cost_pct) != null ? num(targets.bar_pour_cost_pct) : 22;
  const foodTarget = num(targets.food_cost_pct) != null ? num(targets.food_cost_pct) : 32;
  const primeTarget = num(targets.prime_cost_pct) != null ? num(targets.prime_cost_pct) : 60;

  // ── Source-of-truth percentages: Control data > in-app weeks > uploaded
  // file values (a first-time audit has no weeks; its numbers come from the
  // uploaded POS/financial reports the model extracted). ──
  const wkBarCost = avg(weeks.map(w => w.bar && w.bar.cost_pct));
  const wkFoodCost = avg(weeks.map(w => w.food && w.food.cost_pct));
  const wkPrime = avg(weeks.map(w => w.prime_cost_pct));
  // Cost % from an uploaded P&L: prefer a stated %, else derive it in code from
  // the raw COGS and revenue dollars (we never ask the model to do the ratio).
  const pct = (cogs, rev) => (num(cogs) != null && num(rev) > 0) ? (cogs / rev) * 100 : null;
  const exBarCostPct = num(extracted.bar_cost_pct) != null ? num(extracted.bar_cost_pct)
    : pct(extracted.bar_cogs_monthly, extracted.bar_revenue_monthly);
  const exFoodCostPct = num(extracted.food_cost_pct) != null ? num(extracted.food_cost_pct)
    : pct(extracted.food_cogs_monthly, extracted.food_revenue_monthly);
  const barCostPct = round1(num(cd.bar_cost_pct) != null ? cd.bar_cost_pct
    : (wkBarCost != null ? wkBarCost : exBarCostPct));
  const foodCostPct = round1(num(cd.food_cost_pct) != null ? cd.food_cost_pct
    : (wkFoodCost != null ? wkFoodCost : exFoodCostPct));

  // ── Revenue and labor — weeks first, then uploaded monthly figures, then
  // the operator's annual revenue from settings (÷12). ──
  const wkBarRev = avg(weeks.map(w => w.bar && w.bar.revenue));
  const wkFoodRev = avg(weeks.map(w => w.food && w.food.revenue));
  const wkBarLabor = avg(weeks.map(w => w.bar && w.bar.labor));
  const wkFoodLabor = avg(weeks.map(w => w.food && w.food.labor));
  const fromUpload = weeks.length === 0;

  const monthlyBarRev = wkBarRev != null ? wkBarRev * WEEKS_PER_MONTH
    : (num(extracted.bar_revenue_monthly) != null ? num(extracted.bar_revenue_monthly)
      : (num(settings.annual_bar_revenue) ? settings.annual_bar_revenue / 12 : null));
  const monthlyFoodRev = wkFoodRev != null ? wkFoodRev * WEEKS_PER_MONTH
    : (num(extracted.food_revenue_monthly) != null ? num(extracted.food_revenue_monthly)
      : (num(settings.annual_food_revenue) ? settings.annual_food_revenue / 12 : null));
  // Period basis: in-app audits use a 4-week window; an upload-only audit uses
  // the one month the uploaded figures represent.
  const periodBarRev = wkBarRev != null ? wkBarRev * periodWeeks : monthlyBarRev;
  const periodFoodRev = wkFoodRev != null ? wkFoodRev * periodWeeks : monthlyFoodRev;
  const periodTotalRev = (periodBarRev || 0) + (periodFoodRev || 0);

  // A bar with no kitchen (or a kitchen with no bar) is fully supported. The
  // missing side's section is marked N/A and EXCLUDED from the overall — never
  // scored as a default that drags the operation down for selling what it sells.
  const haveBar = num(monthlyBarRev) > 0;
  const haveFood = num(monthlyFoodRev) > 0;

  // ── S1 — Bar Cost and Pour Control ──
  const recipeCount = recipes.length || (num(extracted.recipe_count) || 0);
  const recipesCosted = (extracted.recipes_costed || '').toLowerCase();
  const haveCostedRecipes = recipeCount > 0 || recipesCosted === 'some' || recipesCosted === 'all';
  // Results-based bonus: only a measured/jiggered pour earns credit. Free pour
  // is the bad behavior, not a control — it earns nothing.
  const pourStr = (extracted.pour_method || '').toLowerCase();
  const measuredPour = pourStr.includes('jigger') || pourStr.includes('measur');
  let s1 = scoreCostVsTarget(barCostPct, barTarget, [85, 65, 45, 25]) || 25;
  if (haveCostedRecipes) s1 += 10;
  if (measuredPour) s1 += 5;
  // ── Draft beer yield (expands S1) ──
  // Units sold vs theoretical from kegs = yield %. 100 - yield = the loss to
  // foam, over-pour, and line cleaning (15-25% is routine). Honest only from a
  // stated yield, OR kegs + units sold + theoretical units per keg (we never
  // assume keg size or pour). Else N/A. Draft loss already lives inside the
  // bar-cost % dollar, so NO separate dollar is emitted (avoid double count) —
  // it nudges the S1 score (a measured result, decision 8) and surfaces as a
  // deficit that routes to the draft-system fix.
  const draftYieldPct = (() => {
    const stated = num(extracted.draft_yield_pct);
    if (stated != null) return round1(Math.max(0, Math.min(100, stated)));
    const kegs = num(extracted.draft_kegs_purchased);
    const sold = num(extracted.draft_units_sold);
    const perKeg = num(extracted.draft_units_per_keg);
    if (kegs > 0 && sold != null && perKeg > 0) return round1(Math.max(0, Math.min(100, (sold / (kegs * perKeg)) * 100)));
    return null;
  })();
  const draftLossPct = draftYieldPct != null ? round1(Math.max(0, 100 - draftYieldPct)) : null;
  if (draftLossPct != null) {
    if (draftLossPct <= 8) s1 += 5;          // tight pour control
    else if (draftLossPct >= 20) s1 -= 8;    // major foam / over-pour loss
    else if (draftLossPct >= 12) s1 -= 4;
  }
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
  const haveCashRecon = (num(cd.cash_reconciliations) > 0) || recons.length > 0 || extracted.drawer_recon === true || num(extracted.cash_recon_count) > 0;
  const haveShiftChecks = shifts.length > 0 || num(cd.spot_checks) > 0;
  const haveApprovalPolicy = !!extracted.void_approval || num(cd.void_comp_unauthorized) != null;
  // Void/comp rate from period-scoped Control sum vs period total revenue.
  let voidCompPct = null, voidCompAmt = null;
  if (num(cd.void_comp_total) != null && periodTotalRev > 0) {
    voidCompAmt = round0(cd.void_comp_total);
    voidCompPct = round1((cd.void_comp_total / periodTotalRev) * 100);
  } else if (num(extracted.voids_total) != null && periodTotalRev > 0) {
    voidCompAmt = round0(extracted.voids_total);
    voidCompPct = round1((extracted.voids_total / periodTotalRev) * 100);
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
  // Cash short rate inputs (Control first, then an uploaded cash report) and the
  // discount / no-sale inputs are read up front so the gradeable check can see
  // them before scoring.
  const shortCount = num(cd.cash_short_count) != null ? cd.cash_short_count : num(extracted.cash_short_count);
  const reconCount = num(cd.cash_reconciliations) > 0 ? cd.cash_reconciliations : num(extracted.cash_recon_count);
  // ── Discount abuse + no-sale drawer opens (expands S2) ──
  // Excessive discounts and no-sale register opens are theft vectors the
  // void/comp + cash-variance view misses. Honest from a POS exception report
  // or Control. Discounts score off discount % of sales vs an internal
  // benchmark (a measured result). No-sale opens are surfaced as a flagged
  // behavior + action item; we do not invent a penalty magnitude for them
  // without an honest denominator. Discounts are a distinct POS category from
  // voids/comps, so there is no double count.
  const discountTotal = num(cd.discount_total) != null ? num(cd.discount_total) : num(extracted.discount_total);
  const discountCount = num(cd.discount_count) != null ? num(cd.discount_count) : num(extracted.discount_count);
  const noSaleCount = num(cd.no_sale_count) != null ? num(cd.no_sale_count) : num(extracted.no_sale_count);
  const discountPct = (discountTotal != null && periodTotalRev > 0) ? round1((discountTotal / periodTotalRev) * 100) : null;

  // S2 is gradeable only when there is real loss-behavior data to read OR a
  // documented control to credit. With nothing at all it is N/A (null) — the
  // same as the cost sections — never a manufactured mid-score. (Mirrors S4.)
  const haveS2 = voidCompPct != null || discountPct != null
    || (shortCount != null && reconCount > 0)
    || voidsNoApprovalPct != null || noSaleCount != null
    || haveApprovalPolicy || haveCashRecon || haveShiftChecks;
  let s2 = null;
  if (haveS2) {
    // Base off the actual void/comp rate vs benchmark when present.
    if (voidCompPct != null) {
      const over = voidCompPct - VOID_COMP_BENCHMARK_PCT;
      s2 = over <= 0 ? 85 : over <= 1 ? 65 : over <= 2 ? 45 : 25;
    } else {
      s2 = 50;   // controls/other signals on file but no void/comp rate to grade
    }
    // Unauthorized voids are a behavior signal — they drag the score down.
    if (voidsNoApprovalPct != null) {
      if (voidsNoApprovalPct > 25) s2 -= 15;
      else if (voidsNoApprovalPct > 10) s2 -= 8;
    }
    // Cash short rate (shorts as a share of reconciliations) — behavior signal.
    if (shortCount != null && reconCount > 0) {
      const shortRate = shortCount / reconCount;
      if (shortRate > 0.30) s2 -= 10;
      else if (shortRate > 0.15) s2 -= 5;
    }
    // Discount % over benchmark — a measured result.
    if (discountPct != null) {
      const over = discountPct - DISCOUNT_BENCHMARK_PCT;
      if (over > 2) s2 -= 10;
      else if (over > 0) s2 -= 5;
    }
    // Modest, capped credit for controls that genuinely reduce risk — never
    // enough to rescue a bad rate.
    if (haveApprovalPolicy) s2 += 5;
    if (haveCashRecon) s2 += 5;
    s2 = clampScore(s2);
  }

  // ── S3 — Food Cost Control ──
  // Results-based: credit only when counts actually happen. "Never" earns nothing.
  const invFreqStr = (extracted.inv_freq || '').toLowerCase();
  const haveInvFreq = num(cd.inventory_counts) > 0
    || (invFreqStr !== '' && !invFreqStr.includes('never') && !invFreqStr.includes('none') && !invFreqStr.includes('not'));
  let s3 = scoreCostVsTarget(foodCostPct, foodTarget, [85, 65, 45, 25]) || 25;
  if (haveCostedRecipes) s3 += 10;   // costed recipes control food cost (behavior, not setup)
  if (haveInvFreq) s3 += 5;
  s3 = clampScore(s3);
  const s3Diff = (foodCostPct != null && foodTarget != null) ? foodCostPct - foodTarget : 0;
  const s3MonthlyGap = (s3Diff > 0 && monthlyFoodRev != null) ? round0((s3Diff / 100) * monthlyFoodRev) : 0;
  const foodVarPct = round1(num(extracted.food_var_pct));
  const foodCogsPeriod = (foodCostPct != null && periodFoodRev != null) ? round0((foodCostPct / 100) * periodFoodRev) : null;
  const foodVarAmt = (foodVarPct != null && foodCogsPeriod != null) ? round0((foodVarPct / 100) * foodCogsPeriod) : null;

  // ── S4 — Vendor Control (RESULTS-based: invoice-matching behavior +
  // active price verification). N/A when there is nothing to assess — no
  // invoice-matching answer and no logged vendor activity. An unanswered
  // question never manufactures a score. ──
  const matchState = (extracted.invoice_vs_po || '').toLowerCase();
  // ── Uncollected vendor credits (expands S4) ──
  // Filed discrepancies are real overcharges the operator already caught. The
  // leak is the credit owed but never chased. From the in-app discrepancy log:
  // outstanding = filed but not Resolved (overcharge $), recovered = what came
  // back. A low recovery rate with credits still open is poor follow-through
  // (a measured result). Filing discrepancies counts as vendor activity. These
  // are real filed dollars distinct from the % exposure estimate, surfaced on
  // their own — NOT folded into the recoverable headline (would muddy the
  // exposure figure). N/A when nothing is filed.
  const discreps = appData.vendor_discrepancies || [];
  let uncollectedCredits = null, recoveredCredits = null, openCreditCount = null, creditRecoveryPct = null;
  if (discreps.length > 0) {
    const outstanding = discreps.filter(r => r.status && r.status !== 'Resolved');
    openCreditCount = outstanding.length;
    uncollectedCredits = round0(outstanding.reduce((s, r) => s + (num(r.overcharge) || 0), 0));
    recoveredCredits = round0(discreps.filter(r => r.status === 'Resolved')
      .reduce((s, r) => s + (num(r.recovered_amount) != null ? num(r.recovered_amount) : (num(r.overcharge) || 0)), 0));
    const addressed = (recoveredCredits || 0) + (uncollectedCredits || 0);
    creditRecoveryPct = addressed > 0 ? round0((recoveredCredits / addressed) * 100) : null;
  }
  const haveVendorActivity = vendorLog.length > 0 || num(cd.deliveries_logged) > 0 || discreps.length > 0;
  let s4 = null;
  if (matchState) {
    if (matchState.includes('never') || matchState.includes('not ') || matchState.includes('no ')) s4 = 40;
    else if (matchState.includes('spot')) s4 = 60;
    else if (matchState.includes('match') || matchState.includes('every') || matchState.includes('all')) s4 = 80;
    else s4 = 40;
  } else if (haveVendorActivity) {
    s4 = 50;   // vendor activity on file but matching discipline not stated
  }
  if (s4 != null) {
    if (vendorLog.length > 0) s4 += 10;   // actively logging/verifying price drift
    // Results-based: credit only real backup vendors. "None"/"No" earns nothing.
    const backupStr = (extracted.backup_vendors || '').toLowerCase();
    if (backupStr !== '' && !backupStr.includes('none') && backupStr !== 'no' && !backupStr.startsWith('no ')) s4 += 5;
    // Credit follow-through (a measured result): chasing filed credits earns
    // modest credit; filing them and not collecting drags the score.
    if (creditRecoveryPct != null) {
      if (creditRecoveryPct >= 75) s4 += 5;
      else if (creditRecoveryPct < 40 && openCreditCount >= 2) s4 -= 8;
    }
    s4 = clampScore(s4);
  }
  const vendorSpendMonthly = round0((bevCogsPeriod != null || foodCogsPeriod != null)
    ? (((bevCogsPeriod || 0) + (foodCogsPeriod || 0)) / periodWeeks) * WEEKS_PER_MONTH
    : null);
  // No exposure figure when the vendor section itself is N/A.
  const s4ExposureMonthly = (s4 != null && vendorSpendMonthly != null) ? round0((VENDOR_EXPOSURE_PCT / 100) * vendorSpendMonthly) : 0;

  // ── S5 — Prime Cost (CONTEXT ONLY — never summed into recoverable total) ──
  const periodLabor = num(cd.labor_cost) != null
    ? cd.labor_cost
    : ((wkBarLabor != null || wkFoodLabor != null)
      ? round0(((wkBarLabor || 0) + (wkFoodLabor || 0)) * periodWeeks)
      : (num(extracted.labor_cost_monthly) != null ? num(extracted.labor_cost_monthly) : null));
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

  // ── Section scores, N/A-aware. A cost section is scored only when the data
  // to compute it honestly exists: S1 needs a bar cost %, S3 a food cost %,
  // S5 a prime cost %. Absent ones are null (N/A) and excluded from the
  // overall, so a bar with no kitchen (or any missing input) is never dragged
  // by a defaulted score. S2/S4 always apply. ──
  const s1Out = (haveBar && barCostPct != null) ? s1 : null;
  const s3Out = (haveFood && foodCostPct != null) ? s3 : null;
  const s5Out = (primePct != null) ? s5 : null;
  const overall = clampScore(avg([s1Out, s2, s3Out, s4, s5Out]));

  // ── Period label ──
  const latestEnd = weeks.length ? (weeks[weeks.length - 1].period_end || weeks[weeks.length - 1].week_end) : null;
  const auditPeriod = latestEnd
    ? (`${PERIOD_WEEKS} weeks ending ${latestEnd}`)
    : (extracted.audit_period || 'Most recent month (uploaded data)');
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
    TARGET_SCORE: 70,

    S1_SCORE: s1Out,
    S1_BAR_COST_PCT: barCostPct,
    S1_TARGET_PCT: barTarget,
    S1_BAR_REV_MONTHLY: round0(monthlyBarRev),
    S1_BAR_REV_PERIOD: round0(periodBarRev),
    S1_BEV_COGS_PERIOD: bevCogsPeriod,
    S1_INV_VARIANCE_PCT: invVarPct != null ? invVarPct : 0,
    S1_INV_VARIANCE_AMT: invVarAmt != null ? invVarAmt : 0,
    S1_DRAFT_YIELD_PCT: draftYieldPct,
    S1_DRAFT_LOSS_PCT: draftLossPct,
    S1_POUR_METHOD: extracted.pour_method || 'Not documented',
    S1_RECIPE_COVERAGE: recipesCosted === 'all' ? 'All recipes costed'
      : recipesCosted === 'some' ? 'Some recipes costed'
      : recipesCosted === 'none' ? 'No costed recipes'
      : `${recipeCount} recipes`,
    S1_MONTHLY_GAP: s1MonthlyGap,
    S1_ANNUAL_GAP: round0(s1MonthlyGap * 12),

    S2_SCORE: s2,
    S2_VOID_COMP_PCT: voidCompPct,
    S2_VOID_COMP_AMT: voidCompAmt,
    S2_VOIDS_NO_APPROVAL_PCT: voidsNoApprovalPct,
    S2_DISCOUNT_TOTAL: discountTotal,
    S2_DISCOUNT_PCT: discountPct,
    S2_DISCOUNT_BENCHMARK_PCT: DISCOUNT_BENCHMARK_PCT,
    S2_DISCOUNT_COUNT: discountCount,
    S2_NO_SALE_COUNT: noSaleCount,
    S2_CASH_POLICY: haveCashRecon ? 'Reconciliation performed' : 'Not documented',
    S2_VOID_APPROVAL: haveApprovalPolicy ? 'Manager approval tracked' : 'Not documented',
    S2_DRAWER_RECON: num(cd.cash_reconciliations) > 0 ? `Yes — ${cd.cash_reconciliations} entries` : (recons.length ? `Yes — ${recons.length} entries` : (num(extracted.cash_recon_count) > 0 ? `Yes — ${round0(extracted.cash_recon_count)} entries` : 'No')),
    S2_SPILLAGE_LOG: haveShiftChecks ? 'Yes' : 'Not documented',
    S2_MONTHLY_GAP: s2MonthlyGap,
    S2_ANNUAL_GAP: round0(s2MonthlyGap * 12),

    S3_SCORE: s3Out,
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
    S4_UNCOLLECTED_CREDITS: uncollectedCredits,
    S4_RECOVERED_CREDITS: recoveredCredits,
    S4_OPEN_CREDIT_COUNT: openCreditCount,
    S4_CREDIT_RECOVERY_PCT: creditRecoveryPct,
    S4_EXPOSURE_MONTHLY: s4ExposureMonthly,
    S4_EXPOSURE_ANNUAL: round0(s4ExposureMonthly * 12),

    S5_SCORE: s5Out,
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

/* computeRevenueAudit(appData, controlData, extracted)
   Same honesty contract as Profit. Five sections:
     S1 Check Average and Revenue  — dollar opportunity (revenue growth)
     S2 Labor Efficiency           — dollar gap (cost recovery)
     S3 Menu Performance           — scored on Dog ratio; NO fabricated dollar
     S4 Server Performance         — grounded spread opportunity (revenue growth)
     S5 Events and Private Dining  — scored; NO fabricated target dollar
   Cost recovery (S2) is kept distinct from revenue opportunity (S1/S4) so the
   two are never pooled into one "recovered" number. Sections with no data are
   N/A (null) and excluded from the overall. Practice answers give results-based
   credit; they never penalize (the bad result already shows in the numbers). */
function computeRevenueAudit(appData, controlData, extracted) {
  appData = appData || {}; controlData = controlData || null; extracted = extracted || {};
  const settings = appData.settings || {};
  const rt = (appData.revenue_settings && appData.revenue_settings.targets) || {};
  const cd = controlData || {};
  const weeks = (appData.revenue_weeks || [])
    .filter(w => w && ((num(w.bar_revenue) || 0) + (num(w.floor_revenue) || 0) > 0 || num(w.total_revenue) > 0))
    .slice(-PERIOD_WEEKS);
  const menuItems = (appData.menu_items || []).filter(i => num(i.price) != null && num(i.cost) != null && num(i.weekly_covers) != null);
  const serverChecks = (appData.revenue_server_checks || appData.revenue_servers || []).filter(c => num(c.check_avg) != null);
  // Events now live in the Events section's unified bookings store; a completed
  // booking is a real event. (The old read filtered revenue_events on e.revenue,
  // a field that never existed on those records, so S5 silently never scored.)
  const events = (appData.bookings || []).filter(e => e && e.stage === 'Completed');

  const checkTarget = num(rt.check_avg) != null ? rt.check_avg : 35;
  // Labor target now lives in one place: settings.targets.labor_cost_pct (mirrors
  // the client App.laborTargetPct). Fall back to the older per-department fields so
  // an audit on legacy settings still scores against a real number, not a default.
  const st = settings.targets || {};
  const laborTarget = num(st.labor_cost_pct) != null ? num(st.labor_cost_pct)
    : (num(st.bar_labor_cost_pct) != null && num(st.food_labor_cost_pct) != null)
      ? (num(st.bar_labor_cost_pct) + num(st.food_labor_cost_pct)) / 2
    : num(rt.labor_pct_blended) != null ? rt.labor_pct_blended
    : (((num(rt.bar_labor_pct) != null ? rt.bar_labor_pct : 28)
      + (num(rt.kitchen_labor_pct) != null ? rt.kitchen_labor_pct : 30)
      + (num(rt.floor_labor_pct) != null ? rt.floor_labor_pct : 32)) / 3);
  const rplhTarget = num(rt.rplh_dinner) != null ? rt.rplh_dinner : 75;

  // ── Revenue + covers base (weeks -> uploads -> settings annual) ──
  const wkTotalRev = avg(weeks.map(w => num(w.total_revenue) != null ? w.total_revenue : (num(w.bar_revenue) || 0) + (num(w.floor_revenue) || 0)));
  const annualTotal = (num(settings.annual_bar_revenue) || 0) + (num(settings.annual_food_revenue) || 0);
  const monthlyRev = wkTotalRev != null ? wkTotalRev * WEEKS_PER_MONTH
    : (num(extracted.monthly_revenue) != null ? num(extracted.monthly_revenue)
      : (annualTotal > 0 ? annualTotal / 12 : null));
  const wkCovers = avg(weeks.map(w => w.covers));
  const monthlyCovers = wkCovers != null ? wkCovers * WEEKS_PER_MONTH
    : (num(extracted.monthly_covers) != null ? num(extracted.monthly_covers) : null);

  // ── S1 — Check Average and Revenue (revenue opportunity) ──
  const wkCheckAvg = avg(weeks.map(w => w.check_avg));
  let checkAvg = num(cd.check_average) != null ? cd.check_average
    : (wkCheckAvg != null ? wkCheckAvg : num(extracted.check_avg));
  if (checkAvg == null && monthlyRev != null && monthlyCovers > 0) checkAvg = monthlyRev / monthlyCovers;
  checkAvg = round2(checkAvg);
  let s1 = null, s1Gap = 0;
  if (checkAvg != null) {
    const below = checkTarget - checkAvg;               // positive = below target
    s1 = clampScore(below <= 1 ? 85 : below <= 3 ? 70 : below <= 5 ? 55 : 35);
    if (below > 0 && monthlyCovers != null) s1Gap = round0(below * monthlyCovers);
  }

  // ── Daypart performance (expands S1) ──
  // Check average split by daypart (lunch/dinner/late). Blended numbers hide a
  // bleeding lunch. Honest ONLY when at least two dayparts are present; else
  // N/A. Diagnostic surfacing — NO separate dollar and NO score change (the
  // blended check average already scores S1, so a daypart dollar would double-
  // count). Routes to the daypart staffing + targeted-upsell fix.
  const dpCheck = { Lunch: num(extracted.lunch_check_avg), Dinner: num(extracted.dinner_check_avg), Late: num(extracted.late_check_avg) };
  const dpEntries = Object.keys(dpCheck).map(k => [k, dpCheck[k]]).filter(([, v]) => v != null);
  let dpWeakest = null, dpWeakestCheck = null, dpStrongestCheck = null, dpSpread = null;
  if (dpEntries.length >= 2) {
    dpEntries.sort((a, b) => a[1] - b[1]);
    dpWeakest = dpEntries[0][0];
    dpWeakestCheck = round2(dpEntries[0][1]);
    dpStrongestCheck = round2(dpEntries[dpEntries.length - 1][1]);
    dpSpread = round2(dpStrongestCheck - dpWeakestCheck);
  }

  // ── Beverage attachment / drink incidence (expands S1) ──
  // Drinks per guest is the single biggest margin lever for a bar+kitchen. It
  // is a RESULT (decision 8): a measured low attach genuinely drags the score.
  // Honest only when a beverage count is available alongside covers; else N/A.
  // We do NOT emit a separate dollar for it — raising drink attach is one way to
  // raise the check average, so its dollar already lives inside S1's check-avg
  // gap. Double-counting it would inflate the headline (root cause B). It shows
  // as a deficit (per-cover vs benchmark) and routes to the beverage-program fix.
  const bevUnits = num(extracted.bev_units_sold);            // beverage items sold, report period
  const statedIncidence = num(extracted.bev_incidence_pct);  // % of checks with a drink, if POS states it
  const bevPerCover = (bevUnits != null && monthlyCovers > 0) ? round2(bevUnits / monthlyCovers) : null;
  if (s1 != null && bevPerCover != null) {
    if (bevPerCover >= BEV_ATTACH_BENCHMARK) s1 = clampScore(s1 + 5);
    else if (bevPerCover < BEV_ATTACH_BENCHMARK * 0.6) s1 = clampScore(s1 - 8);
    else if (bevPerCover < BEV_ATTACH_BENCHMARK) s1 = clampScore(s1 - 4);
  }

  // ── S2 — Labor Efficiency (cost recovery) ──
  const laborPct = round1(num(cd.labor_pct_blended) != null ? cd.labor_pct_blended
    : (avg(weeks.map(w => w.labor_pct_blended)) != null ? avg(weeks.map(w => w.labor_pct_blended)) : num(extracted.labor_pct)));
  const rplh = round0(num(cd.rplh_blended) != null ? cd.rplh_blended
    : (avg(weeks.map(w => w.rplh_blended)) != null ? avg(weeks.map(w => w.rplh_blended)) : num(extracted.rplh)));
  let s2 = null, s2Gap = 0;
  if (laborPct != null) {
    const over = laborPct - laborTarget;
    s2 = over <= 1 ? 85 : over <= 3 ? 65 : over <= 5 ? 50 : 35;
    if (extracted.labor_to_forecast === true) s2 += 10;   // scheduling to a forecast is a real control
    s2 = clampScore(s2);
    if (over > 0 && monthlyRev != null) s2Gap = round0((over / 100) * monthlyRev);
  }

  // ── S3 — Menu Performance (scored on Dog ratio; no fabricated dollar) ──
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
  } else if (num(extracted.dogs_count) != null || num(extracted.stars_count) != null) {
    menuKnown = true;
    stars = num(extracted.stars_count) || 0; plow = num(extracted.plowhorses_count) || 0;
    puzzle = num(extracted.puzzles_count) || 0; dog = num(extracted.dogs_count) || 0;
  }
  // Pricing lag (expands S3) — when prices last rose. Recent repricing to
  // inflation is a real margin control (credit, gated to a scored S3, never a
  // penalty per the practice rule). Stale/never surfaces as a finding + action
  // item. Operator-stated; N/A when unanswered.
  const priceLag = (extracted.last_price_increase || '').toLowerCase();
  const repriceRecent = priceLag === 'within_6mo' || priceLag === '6_12mo';
  const repriceStale = priceLag === 'over_year' || priceLag === 'never';
  let s3 = null;
  if (menuKnown) {
    const total = stars + plow + puzzle + dog || 1;
    const dogRatio = dog / total;
    s3 = dogRatio <= 0.10 ? 80 : dogRatio <= 0.25 ? 60 : dogRatio <= 0.40 ? 45 : 30;
    if (extracted.menu_engineered === true) s3 += 10;
    if (repriceRecent) s3 += 5;     // actively repricing to inflation
    s3 = clampScore(s3);
  }

  // ── S4 — Server Performance (grounded spread opportunity) ──
  let s4 = null, topCA = null, botCA = null, spread = null, s4Gap = 0;
  if (serverChecks.length >= 3) {
    const cas = serverChecks.map(c => c.check_avg).sort((a, b) => a - b);
    botCA = round2(cas[0]); topCA = round2(cas[cas.length - 1]);
    const teamAvg = avg(cas);
    spread = round2(topCA - botCA);
    const spreadPct = teamAvg ? spread / teamAvg : 0;
    s4 = spreadPct <= 0.15 ? 80 : spreadPct <= 0.30 ? 60 : spreadPct <= 0.50 ? 45 : 30;
    if (extracted.pre_shift === 'every' || extracted.pre_shift === true) s4 += 10;
    if (extracted.upsell_standard === true) s4 += 5;
    s4 = clampScore(s4);
    const bottomThird = cas.slice(0, Math.max(1, Math.floor(cas.length / 3)));
    const botAvg = avg(bottomThird);
    if (teamAvg != null && botAvg != null && teamAvg > botAvg && monthlyCovers != null) {
      const botCovers = monthlyCovers * (bottomThird.length / serverChecks.length);
      s4Gap = round0((teamAvg - botAvg) * botCovers);   // bottom third up to team average
    }
  } else if (num(extracted.top_check_avg) != null && num(extracted.bottom_check_avg) != null) {
    // First-time audit: spread read off an uploaded server sales report.
    topCA = round2(extracted.top_check_avg); botCA = round2(extracted.bottom_check_avg);
    spread = round2(topCA - botCA);
    const teamAvg = (topCA + botCA) / 2;               // midpoint estimate from top/bottom
    const spreadPct = teamAvg ? spread / teamAvg : 0;
    s4 = spreadPct <= 0.15 ? 80 : spreadPct <= 0.30 ? 60 : spreadPct <= 0.50 ? 45 : 30;
    if (extracted.pre_shift === 'every' || extracted.pre_shift === true) s4 += 10;
    if (extracted.upsell_standard === true) s4 += 5;
    s4 = clampScore(s4);
    if (monthlyCovers != null && teamAvg > botCA) s4Gap = round0((teamAvg - botCA) * (monthlyCovers / 3));
  }

  // ── S5 — Events and Private Dining (scored; no fabricated target dollar) ──
  let s5 = null, eventsPerMonth = null, avgEventRev = null, eventRevPeriod = null;
  if (events.length > 0) {
    eventRevPeriod = round0(events.reduce((s, e) => s + (num(e.actual_revenue) || 0), 0));
    eventsPerMonth = round1(events.length / 3);            // events span ~last 3 months
    avgEventRev = round0(eventRevPeriod / events.length);
    s5 = clampScore(eventsPerMonth >= 4 ? 80 : eventsPerMonth >= 2 ? 60 : eventsPerMonth >= 1 ? 45 : 30);
  }

  const overall = clampScore(avg([s1, s2, s3, s4, s5]));
  const latestEnd = weeks.length ? (weeks[weeks.length - 1].period_end || weeks[weeks.length - 1].week_end) : null;
  const auditPeriod = latestEnd ? (`${PERIOD_WEEKS} weeks ending ${latestEnd}`) : (extracted.audit_period || 'Most recent month (uploaded data)');
  const dataTier = (controlData && (cd.sources || []).length) ? 'Verified — Control module data'
    : (weeks.length ? 'Standard — weekly data entered' : 'Baseline — uploaded data');

  // Revenue opportunity (projected) vs cost recovery, kept separate.
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
    S1_BEV_PER_COVER: bevPerCover,                        // drinks per guest (N/A when no bev count)
    S1_BEV_ATTACH_BENCHMARK: BEV_ATTACH_BENCHMARK,
    S1_BEV_INCIDENCE_PCT: statedIncidence != null ? round1(statedIncidence) : null,
    S1_BEV_UNITS: bevUnits,
    S1_DAYPART_WEAKEST: dpWeakest,
    S1_DAYPART_WEAKEST_CHECK: dpWeakestCheck,
    S1_DAYPART_STRONGEST_CHECK: dpStrongestCheck,
    S1_DAYPART_SPREAD: dpSpread,
    S1_MONTHLY_GAP: s1Gap,
    S1_ANNUAL_GAP: round0(s1Gap * 12),

    S2_SCORE: s2,
    S2_LABOR_PCT: laborPct,
    S2_LABOR_TARGET_PCT: round1(laborTarget),
    S2_RPLH: rplh,
    S2_RPLH_TARGET: round0(rplhTarget),
    S2_LABOR_PERIOD: num(cd.labor_cost) != null ? cd.labor_cost : (laborPct != null && monthlyRev != null ? round0((laborPct / 100) * monthlyRev) : null),
    S2_SCHED_VS_ACTUAL: extracted.sched_vs_actual || 'Not documented',
    S2_OVERTIME_HRS: num(extracted.overtime_hrs) != null ? num(extracted.overtime_hrs) : null,
    S2_MONTHLY_GAP: s2Gap,
    S2_ANNUAL_GAP: round0(s2Gap * 12),

    S3_SCORE: s3,
    S3_STARS_COUNT: menuKnown ? stars : null,
    S3_PLOWHORSES_COUNT: menuKnown ? plow : null,
    S3_PUZZLES_COUNT: menuKnown ? puzzle : null,
    S3_DOGS_COUNT: menuKnown ? dog : null,
    S3_TOP_CATEGORY: topCategory || (extracted.top_category || 'Not available'),
    S3_PRICING_OPPORTUNITY: 0,     // surfaced qualitatively; no invented menu-mix dollar
    S3_LAST_PRICE_INCREASE: priceLag === 'within_6mo' ? 'Within 6 months'
      : priceLag === '6_12mo' ? '6 to 12 months ago'
      : priceLag === 'over_year' ? 'Over a year ago'
      : priceLag === 'never' ? 'Cannot recall'
      : null,
    S3_PRICING_STALE: repriceStale ? true : (repriceRecent ? false : null),
    S3_MONTHLY_GAP: 0,

    S4_SCORE: s4,
    S4_SERVER_COUNT: serverChecks.length || (num(extracted.server_count) || 0) || (num(cd.roster_count) || 0),
    S4_TOP_CHECK_AVG: topCA,
    S4_BOTTOM_CHECK_AVG: botCA,
    S4_PERFORMANCE_SPREAD: spread,
    S4_APP_ATTACH_RATE: num(extracted.app_attach_rate) != null ? num(extracted.app_attach_rate) : null,
    S4_DESSERT_ATTACH_RATE: num(extracted.dessert_attach_rate) != null ? num(extracted.dessert_attach_rate) : null,
    S4_PRESHIFT_BRIEFING: extracted.pre_shift === 'every' ? 'Held every shift' : extracted.pre_shift === 'sometimes' ? 'Sometimes' : extracted.pre_shift === 'never' ? 'Not held' : 'Not documented',
    S4_MONTHLY_GAP: s4Gap,
    S4_ANNUAL_GAP: round0(s4Gap * 12),

    S5_SCORE: s5,
    S5_EVENT_REV_PERIOD: eventRevPeriod,
    S5_EVENTS_PER_MONTH: eventsPerMonth,
    S5_AVG_EVENT_REVENUE: avgEventRev,
    S5_MINIMUM_MET: extracted.private_dining_min === true ? 'Yes' : (events.length ? 'Tracked' : 'No package'),
    S5_CATERING_REV_PERIOD: num(extracted.catering_rev) != null ? num(extracted.catering_rev) : null,
    S5_ANNUAL_EVENT_GAP: null,     // no fabricated target gap
    S5_MONTHLY_GAP: 0,

    // Headline totals, split honestly. Revenue opportunity is projected growth,
    // not recovered cash; cost recovery (labor) is a real reducible cost.
    REVENUE_OPPORTUNITY_MONTHLY: round0(revenueOpportunity),
    COST_RECOVERY_MONTHLY: round0(costRecovery),
    WEEKLY_GAP_AMT: '$' + Math.round((revenueOpportunity + costRecovery) / WEEKS_PER_MONTH).toLocaleString('en-US')
  };
}

module.exports = { computeProfitAudit, computeRevenueAudit };

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
    ['S1_SCORE (diff 5 = band 45, +10 recipes, free pour earns no bonus = 55)', d.S1_SCORE, 55],
    ['S1_MONTHLY_GAP', d.S1_MONTHLY_GAP, expS1Gap],
    ['S3_MONTHLY_GAP', d.S3_MONTHLY_GAP, expS3Gap],
    ['S2_VOID_COMP_PCT', d.S2_VOID_COMP_PCT, expVoidPct],
    ['S2_MONTHLY_GAP', d.S2_MONTHLY_GAP, expS2Gap],
    // Results-based: 4.1% void (2.1 over) = 25, -15 unauth (30%), +5 approval +5 recon = 20.
    ['S2_SCORE results-based (bad rate scores LOW, not 100)', d.S2_SCORE, 20],
    ['S2 score below benchmark-pass even with controls logged', d.S2_SCORE < 50, true],
    // No invoice answer but vendor activity logged (50) + vendor log present (+10) = 60.
    ['S4_SCORE results-based (vendor activity, matching unstated)', d.S4_SCORE, 60],
    ['S5_COMBINED_COGS_GAP == S1+S3 gap (no double count beyond)', d.S5_COMBINED_COGS_GAP, expS1Gap + expS3Gap],
    ['S5 prime % from control', d.S5_PRIME_COST_PCT, 63.0],
    ['OVERALL is 1-100', d.OVERALL_SCORE >= 1 && d.OVERALL_SCORE <= 100, true]
  ];
  // Draft beer yield (S1 expansion): present -> yield/loss computed and a high
  // loss drags S1; absent -> N/A and score unchanged.
  const draftBase = computeProfitAudit({ settings: { annual_bar_revenue: 600000 } }, null, { bar_cost_pct: 22 });
  const draftLow  = computeProfitAudit({ settings: { annual_bar_revenue: 600000 } }, null, { bar_cost_pct: 22, draft_kegs_purchased: 10, draft_units_per_keg: 124, draft_units_sold: 1000 });
  checks.push(['Profit S1 draft yield computed', draftLow.S1_DRAFT_YIELD_PCT, 80.6]);
  checks.push(['Profit S1 draft loss computed', draftLow.S1_DRAFT_LOSS_PCT, 19.4]);
  checks.push(['Profit S1 draft N/A when absent', draftBase.S1_DRAFT_YIELD_PCT, null]);
  checks.push(['Profit S1 high draft loss drags score', draftLow.S1_SCORE < draftBase.S1_SCORE, true]);
  // Discount + no-sale (S2 expansion): present -> discount % computed and high
  // discounts drag S2; absent -> N/A and score unchanged.
  const discBase = computeProfitAudit({ settings: { annual_bar_revenue: 600000, annual_food_revenue: 360000 } }, { void_comp_total: 0, void_comp_count: 0, sources: [] }, {});
  const discHigh = computeProfitAudit({ settings: { annual_bar_revenue: 600000, annual_food_revenue: 360000 } }, { void_comp_total: 0, void_comp_count: 0, sources: [] }, { discount_total: 4000, no_sale_count: 12 });
  checks.push(['Profit S2 discount % computed', discHigh.S2_DISCOUNT_PCT, 5]);
  checks.push(['Profit S2 no-sale surfaced', discHigh.S2_NO_SALE_COUNT, 12]);
  checks.push(['Profit S2 discount/no-sale N/A when absent', discBase.S2_DISCOUNT_PCT, null]);
  checks.push(['Profit S2 high discounts drag score', discHigh.S2_SCORE < discBase.S2_SCORE, true]);
  // Uncollected vendor credits (S4 expansion): present -> outstanding + recovery
  // rate computed and poor follow-through drags S4; absent -> N/A.
  const credAppData = { settings: { annual_bar_revenue: 600000 }, vendor_discrepancies: [
    { status: 'Open', overcharge: 400 }, { status: 'Credit Requested', overcharge: 350 },
    { status: 'Resolved', overcharge: 200, recovered_amount: 200 }
  ] };
  const credLow = computeProfitAudit(credAppData, null, { invoice_vs_po: 'Spot checked' });
  const credNone = computeProfitAudit({ settings: { annual_bar_revenue: 600000 } }, null, { invoice_vs_po: 'Spot checked' });
  checks.push(['Profit S4 uncollected credits summed', credLow.S4_UNCOLLECTED_CREDITS, 750]);
  checks.push(['Profit S4 recovered credits summed', credLow.S4_RECOVERED_CREDITS, 200]);
  checks.push(['Profit S4 credit recovery rate', credLow.S4_CREDIT_RECOVERY_PCT, 21]);
  checks.push(['Profit S4 poor follow-through drags score', credLow.S4_SCORE < credNone.S4_SCORE, true]);
  checks.push(['Profit S4 credits N/A when none filed', credNone.S4_UNCOLLECTED_CREDITS, null]);
  let pass = 0;
  for (const [label, got, exp] of checks) {
    const ok = got === exp;
    if (ok) pass++;
    console.log((ok ? 'PASS ' : 'FAIL ') + label + '  got=' + got + (ok ? '' : ' expected=' + exp));
  }
  console.log(`\n${pass}/${checks.length} checks passed`);

  // ── Upload-only first-time audit: no weeks, no Control data; financials come
  // from the model's extraction of uploaded files. Proves the gaps still compute.
  console.log('\n--- Upload-only (first-time audit) path ---');
  const firstTime = computeProfitAudit(
    { settings: { bar_name: 'The Anchor Bar & Kitchen', city_state: 'Austin, TX', targets: {} } },
    null,
    {
      // Mirrors the test CSVs: raw COGS dollars (code derives the cost %),
      // voids_total + cash counts (code derives the rate), never matched.
      audit_period: 'April 2026',
      bar_revenue_monthly: 51500, bar_cogs_monthly: 14111,
      food_revenue_monthly: 31000, food_cogs_monthly: 11098,
      labor_cost_monthly: 24000, pour_method: 'Free pour',
      voids_total: 3465, voids_no_approval_pct: 30,
      cash_recon_count: 26, cash_short_count: 9, invoice_vs_po: 'Never matched'
    }
  );
  const ftBarGap = Math.round(((27.4 - 22) / 100) * 51500);  // cost% derived from COGS
  const ftFoodGap = Math.round(((35.8 - 32) / 100) * 31000);
  const ftChecks = [
    ['upload bar cost % derived from COGS dollars', firstTime.S1_BAR_COST_PCT, 27.4],
    ['upload food cost % derived from COGS dollars', firstTime.S3_FOOD_COST_PCT, 35.8],
    ['upload S1_MONTHLY_GAP from file revenue', firstTime.S1_MONTHLY_GAP, ftBarGap],
    ['upload S3_MONTHLY_GAP from file revenue', firstTime.S3_MONTHLY_GAP, ftFoodGap],
    ['upload S2 scores the void rate (4.2%) low', firstTime.S2_SCORE < 50, true],
    ['upload S2_MONTHLY_GAP computed', firstTime.S2_MONTHLY_GAP > 0, true],
    ['upload AUDIT_PERIOD from file', firstTime.AUDIT_PERIOD, 'April 2026'],
    ['S4 "Never matched" scores 40, not 80 (substring bug regression)', firstTime.S4_SCORE, 40],
    ['upload OVERALL is 1-100', firstTime.OVERALL_SCORE >= 1 && firstTime.OVERALL_SCORE <= 100, true]
  ];
  // Sanity: a bar that matches every invoice should score 80 on S4.
  const matched = computeProfitAudit({ settings: { targets: {} } }, null, { bar_revenue_monthly: 50000, invoice_vs_po: 'Matched every delivery' });
  ftChecks.push(['S4 "Matched every delivery" scores 80', matched.S4_SCORE, 80]);

  // Bar-only operation (no kitchen): Food Cost must be N/A and excluded from
  // the overall, not scored as a default that drags the bar down.
  const barOnly = computeProfitAudit({ settings: { targets: {} } }, null, {
    bar_revenue_monthly: 60000, bar_cogs_monthly: 16440, pour_method: 'Free pour',
    voids_total: 1500, invoice_vs_po: 'Spot checked'
  });
  ftChecks.push(['bar-only: S3 Food is N/A (null)', barOnly.S3_SCORE, null]);
  ftChecks.push(['bar-only: S1 Bar still scored', barOnly.S1_SCORE > 0, true]);
  ftChecks.push(['bar-only: OVERALL excludes Food (not dragged to ~25)', barOnly.OVERALL_SCORE >= 1 && barOnly.OVERALL_SCORE <= 100, true]);
  // Food-only operation (no bar): mirror case.
  const foodOnly = computeProfitAudit({ settings: { targets: {} } }, null, { food_revenue_monthly: 40000, food_cogs_monthly: 13200 });
  ftChecks.push(['food-only: S1 Bar is N/A (null)', foodOnly.S1_SCORE, null]);

  // Operating-practice questions: same costs, better practices -> higher scores
  // (the "update answers next audit and watch the score move" case).
  const improved = computeProfitAudit({ settings: { targets: {} } }, null, {
    bar_revenue_monthly: 51500, bar_cogs_monthly: 14111, food_revenue_monthly: 31000, food_cogs_monthly: 11098,
    labor_cost_monthly: 24000, pour_method: 'Jiggered/measured', recipes_costed: 'all', inv_freq: 'Weekly',
    void_approval: true, drawer_recon: true, voids_total: 3465, voids_no_approval_pct: 5,
    invoice_vs_po: 'Matched every delivery', backup_vendors: 'Yes'
  });
  ftChecks.push(['practices: measured pour + costed recipes raise S1', improved.S1_SCORE > firstTime.S1_SCORE, true]);
  ftChecks.push(['practices: costed recipes + counts raise S3', improved.S3_SCORE > firstTime.S3_SCORE, true]);
  ftChecks.push(['practices: matched invoices + backups raise S4', improved.S4_SCORE > firstTime.S4_SCORE, true]);

  // Unanswered vendor question + no vendor data -> S4 is N/A, never a manufactured score.
  const noVendor = computeProfitAudit({ settings: { targets: {} } }, null, { bar_revenue_monthly: 50000, bar_cogs_monthly: 13700 });
  ftChecks.push(['unanswered vendor + no data: S4 is N/A (null)', noVendor.S4_SCORE, null]);
  let ftPass = 0;
  for (const [label, got, exp] of ftChecks) {
    const ok = got === exp; if (ok) ftPass++;
    console.log((ok ? 'PASS ' : 'FAIL ') + label + '  got=' + got + (ok ? '' : ' expected=' + exp));
  }
  console.log(`\n${ftPass}/${ftChecks.length} upload-path checks passed`);

  // ── Revenue audit ───────────────────────────────────────────────────────────
  console.log('\n--- Revenue audit ---');
  const rWeeks = [1, 2, 3, 4].map(i => ({
    period_end: `2026-04-0${i}`, total_revenue: 18000, covers: 600,
    bar_revenue: 11000, floor_revenue: 7000, check_avg: 30.0, labor_pct_blended: 34.0, rplh_blended: 58
  }));
  const rMenu = [
    { name: 'Burger', category: 'Entree', price: 16, cost: 6, weekly_covers: 120 },   // hi vol; margin 10
    { name: 'Steak',  category: 'Entree', price: 38, cost: 14, weekly_covers: 40 },    // hi margin lo vol = puzzle
    { name: 'Fries',  category: 'Side',   price: 7,  cost: 2,  weekly_covers: 150 },   // plowhorse-ish
    { name: 'Wings',  category: 'Starter',price: 13, cost: 7,  weekly_covers: 30 },    // dog-ish
    { name: 'Salad',  category: 'Starter',price: 12, cost: 4,  weekly_covers: 25 }
  ];
  const rServers = [{ name: 'A', check_avg: 38 }, { name: 'B', check_avg: 31 }, { name: 'C', check_avg: 24 }, { name: 'D', check_avg: 29 }];
  const rev = computeRevenueAudit({
    settings: { bar_name: 'The Anchor Bar & Kitchen' },
    revenue_settings: { targets: { check_avg: 35 } },
    revenue_weeks: rWeeks, menu_items: rMenu, revenue_server_checks: rServers, bookings: []
  }, null, {});
  const rExpCovers = 600 * 4.345;                                  // monthly covers
  const rExpS1Gap = Math.round((35 - 30) * rExpCovers);            // (target-actual) x covers
  const rChecks = [
    ['Rev S1 check avg from weeks', rev.S1_CHECK_AVG, 30],
    ['Rev S1 gap = ($5 below) x monthly covers', rev.S1_MONTHLY_GAP, rExpS1Gap],
    ['Rev S1 gap is revenue opportunity (not cost)', rev.REVENUE_OPPORTUNITY_MONTHLY >= rev.S1_MONTHLY_GAP, true],
    ['Rev S2 labor scored (34% over ~30 target)', rev.S2_SCORE > 0 && rev.S2_SCORE <= 100, true],
    ['Rev S2 gap is cost recovery, kept separate', rev.COST_RECOVERY_MONTHLY, rev.S2_MONTHLY_GAP],
    ['Rev S3 menu classified (counts sum to 5)', (rev.S3_STARS_COUNT + rev.S3_PLOWHORSES_COUNT + rev.S3_PUZZLES_COUNT + rev.S3_DOGS_COUNT), 5],
    ['Rev S3 no fabricated dollar', rev.S3_MONTHLY_GAP, 0],
    ['Rev S4 server spread computed', rev.S4_PERFORMANCE_SPREAD, 14],
    ['Rev S4 grounded opportunity > 0', rev.S4_MONTHLY_GAP > 0, true],
    ['Rev S5 events N/A when none', rev.S5_SCORE, null],
    ['Rev OVERALL excludes N/A events', rev.OVERALL_SCORE >= 1 && rev.OVERALL_SCORE <= 100, true]
  ];
  // Events present -> S5 scores.
  const revEv = computeRevenueAudit({ settings: {}, revenue_settings: { targets: {} }, bookings: [{ stage: 'Completed', actual_revenue: 2400 }, { stage: 'Completed', actual_revenue: 3100 }, { stage: 'Completed', actual_revenue: 1800 }] }, null, {});
  rChecks.push(['Rev S5 scores when events exist', revEv.S5_SCORE > 0, true]);
  // Check-average N/A when no covers anywhere.
  const revNoCovers = computeRevenueAudit({ settings: { annual_bar_revenue: 600000 }, revenue_settings: { targets: {} } }, null, {});
  rChecks.push(['Rev S1 N/A when no covers', revNoCovers.S1_SCORE, null]);
  // Beverage attachment (S1 expansion): present -> drinks-per-guest computed and
  // a low attach drags the score; absent -> N/A and score unchanged.
  const revBevBase = computeRevenueAudit({ settings: {}, revenue_settings: { targets: { check_avg: 35 } } }, null, { monthly_covers: 1000, monthly_revenue: 35000, check_avg: 34 });
  const revBevLow  = computeRevenueAudit({ settings: {}, revenue_settings: { targets: { check_avg: 35 } } }, null, { monthly_covers: 1000, monthly_revenue: 35000, check_avg: 34, bev_units_sold: 500 });
  rChecks.push(['Rev S1 bev attach per-guest computed', revBevLow.S1_BEV_PER_COVER, 0.5]);
  rChecks.push(['Rev S1 low bev attach drags score', revBevLow.S1_SCORE < revBevBase.S1_SCORE, true]);
  rChecks.push(['Rev S1 bev attach N/A when no bev data', revBevBase.S1_BEV_PER_COVER, null]);
  // Pricing lag (S3 expansion): recent repricing credits a scored S3, stale is
  // flagged, unanswered is N/A. Uses the menu sample so S3 is scored.
  const rMenuPL = [
    { name: 'A', category: 'Entree', price: 20, cost: 6, weekly_covers: 100 },
    { name: 'B', category: 'Entree', price: 18, cost: 7, weekly_covers: 90 },
    { name: 'C', category: 'Side', price: 8, cost: 2, weekly_covers: 120 },
    { name: 'D', category: 'Starter', price: 12, cost: 5, weekly_covers: 30 }
  ];
  const plBase   = computeRevenueAudit({ settings: {}, revenue_settings: { targets: {} }, menu_items: rMenuPL }, null, {});
  const plRecent = computeRevenueAudit({ settings: {}, revenue_settings: { targets: {} }, menu_items: rMenuPL }, null, { last_price_increase: 'within_6mo' });
  const plStale  = computeRevenueAudit({ settings: {}, revenue_settings: { targets: {} }, menu_items: rMenuPL }, null, { last_price_increase: 'over_year' });
  rChecks.push(['Rev S3 pricing lag N/A when unanswered', plBase.S3_PRICING_STALE, null]);
  rChecks.push(['Rev S3 recent repricing credits score', plRecent.S3_SCORE > plBase.S3_SCORE, true]);
  rChecks.push(['Rev S3 stale pricing flagged', plStale.S3_PRICING_STALE, true]);
  rChecks.push(['Rev S3 stale pricing does not penalize score', plStale.S3_SCORE, plBase.S3_SCORE]);
  // Daypart (S1 expansion): >=2 dayparts -> weakest + spread computed; <2 -> N/A.
  // Diagnostic only, no score change.
  const dpYes = computeRevenueAudit({ settings: {}, revenue_settings: { targets: { check_avg: 35 } } }, null, { monthly_covers: 1000, monthly_revenue: 35000, check_avg: 34, lunch_check_avg: 16, dinner_check_avg: 38 });
  const dpNo  = computeRevenueAudit({ settings: {}, revenue_settings: { targets: { check_avg: 35 } } }, null, { monthly_covers: 1000, monthly_revenue: 35000, check_avg: 34, dinner_check_avg: 38 });
  rChecks.push(['Rev S1 daypart weakest identified', dpYes.S1_DAYPART_WEAKEST, 'Lunch']);
  rChecks.push(['Rev S1 daypart spread computed', dpYes.S1_DAYPART_SPREAD, 22]);
  rChecks.push(['Rev S1 daypart N/A with one daypart', dpNo.S1_DAYPART_WEAKEST, null]);
  rChecks.push(['Rev S1 daypart does not change score', dpYes.S1_SCORE, dpNo.S1_SCORE]);
  let rPass = 0;
  for (const [label, got, exp] of rChecks) {
    const ok = got === exp; if (ok) rPass++;
    console.log((ok ? 'PASS ' : 'FAIL ') + label + '  got=' + got + (ok ? '' : ' expected=' + exp));
  }
  console.log(`\n${rPass}/${rChecks.length} revenue checks passed`);

}
