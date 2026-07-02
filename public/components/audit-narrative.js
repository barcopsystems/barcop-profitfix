'use strict';
/* ── Audit findings — code-generated, no API ───────────────────────────────────
   Operator to operator: name the number, give the order, no teaching, no fluff.
   Every line is built from the computed numbers this module receives, so it can
   never contradict the scoring (the honesty rule). Returns the S{n}_NARRATIVE /
   _FINDING / _TOOL fields the audit views render. Reworked to the deep-analysis
   section layout (2026-07-14): Profit = Pour / Food / Shrink & Waste / Theft &
   Cash / Vendor; Prime is context, not a section. No API call, deterministic. */

const money = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('en-US');
const pct1  = (v) => (v == null ? '' : (Math.round(Number(v) * 10) / 10) + '%');

function profitNarrative(d) {
  const o = {};

  // S1 — Pour & Bar Cost
  if (d.S1_SCORE != null) {
    const bar = d.S1_BAR_COST_PCT, tgt = d.S1_TARGET_PCT;
    const leak = d.S1_MONTHLY_GAP > 0, ptsOver = Math.round(((bar || 0) - (tgt || 0)) * 10) / 10;
    o.S1_NARRATIVE = leak
      ? `Your bar pour cost ran ${pct1(bar)} against a ${pct1(tgt)} target${ptsOver >= 5 ? ', the biggest cost leak on this sheet' : ''}. Every point over is money you poured and never rang.`
      : `Bar pour cost is ${pct1(bar)} against a ${pct1(tgt)} target, close enough that what is left is menu-mix drift, not a leak.`;
    o.S1_FINDING = leak
      ? `On ${money(d.S1_BAR_REV_MONTHLY)} of monthly bar sales, the overage is ${money(d.S1_MONTHLY_GAP)} a month. Recipe costing sits at ${d.S1_RECIPE_COVERAGE}.`
      : `Recipe costing is at ${d.S1_RECIPE_COVERAGE}. Hold it there.`;
    o.S1_TOOL = leak
      ? `Jigger every well and call pour, cost the drinks that are not, and watch the gap close on the next audit.`
      : `Hold the discipline. Review pour cost monthly, not week to week.`;
  }

  // S2 — Food Cost
  if (d.S2_SCORE != null) {
    const fc = d.S2_FOOD_COST_PCT, tgt = d.S2_TARGET_PCT, over = d.S2_MONTHLY_GAP > 0;
    o.S2_NARRATIVE = over
      ? `Food cost ran ${pct1(fc)} against your ${pct1(tgt)} target. The plate is eating margin.`
      : `Food cost is ${pct1(fc)}, in line with your ${pct1(tgt)} target. The kitchen is holding the line.`;
    o.S2_FINDING = over
      ? `On ${money(d.S2_FOOD_REV_MONTHLY)} of monthly food sales, that overage is ${money(d.S2_MONTHLY_GAP)} a month. Plate costing sits at ${d.S2_RECIPE_COVERAGE}.`
      : `Plate costing is at ${d.S2_RECIPE_COVERAGE}. Nothing to chase here.`;
    o.S2_TOOL = over
      ? `Tighten portions on the high-volume plates and finish costing the menu so a price creep cannot hide.`
      : `Hold it. Keep costing new plates so a cost creep cannot sneak the number up.`;
  }

  // S3 — Shrink & Waste
  if (d.S3_SCORE != null) {
    const vpct = d.S3_INV_VARIANCE_PCT, vdol = d.S3_INV_VARIANCE_DOLLAR;
    const bad = (vpct != null && vpct > 2) || (d.S3_COUNT_CADENCE && /monthly|not counted/i.test(d.S3_COUNT_CADENCE));
    o.S3_NARRATIVE = (vdol != null)
      ? `The variance report shows ${money(vdol)} of product used but never rung this period${vpct != null ? `, ${pct1(vpct)} of your cost of goods` : ''}. That is over-pour, waste, and theft you can see.`
      : `You are counting inventory but the variance is not scored yet. Run the variance report to put a dollar on the shrink.`;
    o.S3_FINDING = `Counts are running ${String(d.S3_COUNT_CADENCE || '').toLowerCase()}${d.S3_WASTE_TOTAL != null ? `, and ${money(d.S3_WASTE_TOTAL)} of waste is logged` : ''}. You can only catch shrink you count for, and that dollar already sits inside your pour and food cost above.`;
    o.S3_TOOL = bad
      ? `Count weekly, run the variance report every count, and work the biggest negative lines in Loss Prevention.`
      : `Hold the weekly count and the variance report. That is what keeps the shrink honest.`;
  }

  // S4 — Theft & Cash Loss
  if (d.S4_SCORE != null) {
    const vc = d.S4_VOID_COMP_PCT, hot = d.S4_MONTHLY_GAP > 0;
    o.S4_NARRATIVE = (vc != null)
      ? (hot
          ? `Voids and comps hit ${pct1(vc)} of sales${vc >= 4 ? ', more than double where a tight house runs' : ''}. That is the easiest place in the building to make money disappear.`
          : `Voids and comps are running ${pct1(vc)} of sales, inside the range. Keep the gate closed.`)
      : `Your cash path has signals on file but no void and comp rate to grade yet.`;
    o.S4_FINDING = hot
      ? `${d.S4_VOIDS_NO_APPROVAL_PCT > 0 ? `${pct1(d.S4_VOIDS_NO_APPROVAL_PCT)} of those voids went through with no manager approval. ` : ''}${d.S4_WALKED_TABS_TOTAL ? `${money(d.S4_WALKED_TABS_TOTAL)} walked out in unpaid tabs. ` : ''}${d.S4_SALES_INTEGRITY_FLAGS ? `${d.S4_SALES_INTEGRITY_FLAGS} server${d.S4_SALES_INTEGRITY_FLAGS === 1 ? '' : 's'} flagged in Sales Integrity. ` : ''}Call it ${money(d.S4_MONTHLY_GAP)} a month in excess to tighten.`
      : `${d.S4_DRAWER_RECON && /^Yes/.test(d.S4_DRAWER_RECON) ? 'Drawers are reconciling. ' : ''}${d.S4_WALKED_TABS_TOTAL ? `${money(d.S4_WALKED_TABS_TOTAL)} walked out in unpaid tabs. ` : ''}This is a controlled cash path.`;
    o.S4_TOOL = hot
      ? `Require a manager code on every void and comp, and watch the volume by server in Loss Prevention.`
      : `Keep logging every void against the server who rang it so a pattern cannot hide.`;
  }

  // S5 — Vendor Cost Control
  if (d.S5_SCORE != null) {
    const cred = d.S5_UNCOLLECTED_CREDITS > 0;
    o.S5_NARRATIVE = d.S5_DELIVERIES_LOGGED
      ? `You logged ${d.S5_DELIVERIES_LOGGED} deliveries and caught ${d.S5_VENDOR_PRICE_CHANGES || 0} price change${d.S5_VENDOR_PRICE_CHANGES === 1 ? '' : 's'} this period. Checking the invoice in is where vendor overcharges get caught.`
      : `Vendor activity is on file but deliveries are not being logged against the order. That is the door you are leaving open.`;
    o.S5_FINDING = cred
      ? `You already flagged ${money(d.S5_UNCOLLECTED_CREDITS)} in overcharges across ${d.S5_OPEN_CREDIT_COUNT || 0} open discrepanc${d.S5_OPEN_CREDIT_COUNT === 1 ? 'y' : 'ies'} and have not collected it. The catching is done, the chasing is not.`
      : `About ${money(d.S5_EXPOSURE_MONTHLY)} a month of spend is exposed to overcharges you are not verifying. It is an estimate, not a measured leak.`;
    o.S5_TOOL = cred
      ? `Chase the filed credits in Vendor Tracker, and match every new invoice to its price sheet before you pay it.`
      : `Match every invoice to its PO and price sheet in Receive Delivery, and flag the drift the day it lands.`;
  }

  return o;
}

function revenueNarrative(d) {
  const o = {};

  // S1 — Check Average and Revenue
  if (d.S1_SCORE != null) {
    const ca = d.S1_CHECK_AVG, tgt = d.S1_CHECK_AVG_TARGET, under = ca < tgt;
    o.S1_NARRATIVE = under
      ? `Your blended check average is ${money(ca)} against a ${money(tgt)} target. Every guest is leaving room on the table.`
      : `Blended check average is ${money(ca)}, ${ca > tgt ? 'over' : 'right at'} your ${money(tgt)} target. The room is spending.`;
    o.S1_FINDING = under
      ? `On ${d.S1_COVER_COUNT ? Number(d.S1_COVER_COUNT).toLocaleString('en-US') : 'your'} monthly covers, closing that gap is ${money(d.S1_MONTHLY_GAP)} a month.`
      : `The check is where you set it. Nudge the target up as the menu and service push add-ons.`;
    o.S1_TOOL = under
      ? `Set a drink-and-app standard, teach it at pre-shift, and track check average by server in Server Check.`
      : `Hold it, and raise the target as add-on selling improves.`;
  }

  // S2 — Labor Efficiency
  if (d.S2_SCORE != null) {
    const lab = d.S2_LABOR_PCT, tgt = d.S2_LABOR_TARGET_PCT, over = lab > tgt;
    o.S2_NARRATIVE = over
      ? `Labor ran ${pct1(lab)} of sales against a ${pct1(tgt)} target. You are carrying hours the sales did not ask for.`
      : `Labor is ${pct1(lab)} of sales, ${lab < tgt ? 'under' : 'on'} your ${pct1(tgt)} target. The schedule is matched to the room.`;
    o.S2_FINDING = over
      ? `That overage is ${money(d.S2_MONTHLY_GAP)} a month.${d.S2_RPLH != null && d.S2_RPLH_TARGET != null ? ` Revenue per labor hour is ${money(d.S2_RPLH)} against a ${money(d.S2_RPLH_TARGET)} target.` : ''}`
      : `Revenue per labor hour is ${d.S2_RPLH != null ? money(d.S2_RPLH) : 'holding'}. The build is tight.`;
    o.S2_TOOL = over
      ? `Schedule to the cover forecast in Build Schedule, cut the hour that is not earning, and kill the overtime before it starts.`
      : `Keep scheduling to the forecast. Watch the overtime flags in Build Schedule.`;
  }

  // S3 — Menu Performance
  if (d.S3_SCORE != null) {
    const dogs = d.S3_DOGS_COUNT || 0, stale = d.S3_PRICING_STALE === true, act = dogs > 3 || stale;
    o.S3_NARRATIVE = act
      ? `Your menu is carrying ${dogs} Dog${dogs === 1 ? '' : 's'}, low margin and low volume${stale ? `, and your last price increase was ${String(d.S3_LAST_PRICE_INCREASE || '').toLowerCase()}` : ''}. Dead weight on the page.`
      : `The menu mix is working, ${d.S3_STARS_COUNT || 0} Star${d.S3_STARS_COUNT === 1 ? '' : 's'} pulling their weight and few Dogs.${d.S3_TOP_CATEGORY && d.S3_TOP_CATEGORY !== 'Not available' ? ' ' + d.S3_TOP_CATEGORY + ' leads the revenue.' : ''}`;
    o.S3_FINDING = act
      ? `${dogs} Dog${dogs === 1 ? '' : 's'} and ${d.S3_PLOWHORSES_COUNT || 0} Plowhorse${d.S3_PLOWHORSES_COUNT === 1 ? '' : 's'} sit below where they should. ${stale ? 'Stale pricing is leaving margin on every ticket.' : 'Reprice or reposition them before they eat the mix.'}`
      : `${d.S3_LAST_PRICE_INCREASE ? 'Your last price increase was ' + String(d.S3_LAST_PRICE_INCREASE).toLowerCase() + '. ' : ''}${d.S3_DOG_TESTS_ACTIVE ? d.S3_DOG_TESTS_ACTIVE + ' dog test' + (d.S3_DOG_TESTS_ACTIVE === 1 ? '' : 's') + ' running. ' : ''}Stars and Puzzles carry the mix.`;
    o.S3_TOOL = act
      ? `Reprice the over-target items to target in Menu Engineering, and Dog Test the low-volume plates before you cut them.`
      : `Keep the menu fresh. Reprice to target in Menu Engineering whenever costs move.`;
  }

  // S4 — Server Performance (spread + comp discipline)
  if (d.S4_SCORE != null) {
    const spread = d.S4_PERFORMANCE_SPREAD, wideSpread = spread != null && spread > 5;
    const comp = d.S4_COMP_PCT, hotComp = comp != null && comp > d.S4_COMP_BENCHMARK_PCT;
    o.S4_NARRATIVE = (spread != null)
      ? (wideSpread
          ? `Your top server rings ${money(d.S4_TOP_CHECK_AVG)} a check and your bottom rings ${money(d.S4_BOTTOM_CHECK_AVG)}, a ${money(spread)} spread. Same tables, different money.`
          : `Your servers are tight, only ${money(spread)} between the top and bottom check average.`)
      : `Comp discipline is graded but there are not enough server checks to read the check-average spread yet.`;
    o.S4_FINDING = wideSpread
      ? `Pull the bottom third up to the team average and that is ${money(d.S4_MONTHLY_GAP)} a month, no new guests required.${hotComp ? ` Comps are also running ${pct1(comp)} of server sales against a ${pct1(d.S4_COMP_BENCHMARK_PCT)} benchmark.` : ''}`
      : hotComp
        ? `Comps are running ${pct1(comp)} of server sales against a ${pct1(d.S4_COMP_BENCHMARK_PCT)} benchmark. Someone is buying goodwill on your dime.`
        : `Across ${d.S4_SERVER_COUNT || 'your'} servers the spread is narrow${comp != null ? ` and comps are in line at ${pct1(comp)}` : ''}. The standard is landing.`;
    o.S4_TOOL = (wideSpread || hotComp)
      ? `Name the bottom performers in Server Check, coach the add-on and watch the comp rate, then re-measure next week.`
      : `Keep the pre-shift standard tight and watch the spread and comp rate in Server Check.`;
  }

  // S5 — Events and Private Dining
  if (d.S5_SCORE != null) {
    const evs = d.S5_EVENTS_PER_MONTH || 0;
    o.S5_NARRATIVE = evs > 0
      ? `You are running ${evs} event${evs === 1 ? '' : 's'} a month at ${money(d.S5_AVG_EVENT_REVENUE)} average, ${money(d.S5_EVENT_REV_PERIOD)} in the window. A booked event is your highest-margin cover.`
      : `No events on the books in the window. That is a whole revenue line sitting idle.`;
    o.S5_FINDING = evs > 0
      ? `The room is doing the work. More dates is more of your best margin.`
      : `The space, the staff, and the kitchen are already paid for. Every event you book is close to pure margin.`;
    o.S5_TOOL = evs > 0
      ? `Set or hold a spend minimum in Price Packages and keep the pipeline full in Event Booking.`
      : `Build a private-dining offering with a spend minimum in Price Packages and start quoting inquiries in Event Booking.`;
  }

  return o;
}

// Shared by the server (require) and the client seed (window global), so live
// audits and the sample data write findings from the same generator.
const _AN_API = { profitNarrative, revenueNarrative };
if (typeof module !== 'undefined' && module.exports) module.exports = _AN_API;
if (typeof window !== 'undefined') window.AuditNarrative = _AN_API;
