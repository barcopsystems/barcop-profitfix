'use strict';
/* ── Audit findings — code-generated, replaces the Claude narrative API ────────
   Operator to operator: name the number, give the order, no teaching, no fluff.
   Every line is built from the computed numbers this module receives, so it can
   never contradict the scoring (the honesty rule). Returns the same
   S{n}_NARRATIVE / _FINDING / _TOOL fields the API used to write, so the audit
   views render unchanged. Section-6 operational-risk-signal prose is not
   generated here (it was optional; the views drop it when absent).
   No API call, no cost, instant, deterministic. */

const money = (v) => '$' + Math.round(Number(v) || 0).toLocaleString('en-US');
const pct1  = (v) => (v == null ? '' : (Math.round(Number(v) * 10) / 10) + '%');
const yes   = (v) => /^Yes/i.test(String(v == null ? '' : v));

function profitNarrative(d) {
  const o = {};

  // S1 — Bar Cost and Pour Control
  if (d.S1_SCORE != null) {
    const bar = d.S1_BAR_COST_PCT, tgt = d.S1_TARGET_PCT;
    const leak = d.S1_MONTHLY_GAP > 0, ptsOver = Math.round((bar - tgt) * 10) / 10;
    o.S1_NARRATIVE = leak
      ? `Your bar pour cost ran ${pct1(bar)} against a ${pct1(tgt)} target${ptsOver >= 5 ? ', the single biggest leak on this sheet' : ''}. Every point over is money you poured and never rang.`
      : `Bar pour cost is ${pct1(bar)} against a ${pct1(tgt)} target, close enough that what is left is menu-mix drift, not a leak. That is margin you keep on every pour.`;
    o.S1_FINDING = leak
      ? `Inventory variance of ${pct1(d.S1_INV_VARIANCE_PCT)} says this is pour discipline, not your pricing. On ${money(d.S1_BAR_REV_MONTHLY)} of monthly bar sales, the overage is ${money(d.S1_MONTHLY_GAP)} walking out the door every month.` + (d.S1_DRAFT_LOSS_PCT >= 12 ? ` Draft is bleeding too, ${pct1(d.S1_DRAFT_LOSS_PCT)} of every keg going to foam and over-pour.` : '')
      : `Inventory variance of ${pct1(d.S1_INV_VARIANCE_PCT)} is clean and your recipes are costed. The small residual gap is normal menu-mix drift, not a control failure.`;
    o.S1_TOOL = leak
      ? `Jigger every well and call drink, cost the recipes that are not, and watch pour variance in Spot Check until the number comes back to target.`
      : `Hold the discipline. Review pour cost monthly rather than chasing it week to week.`;
  }

  // S2 — Theft and Loss Prevention
  if (d.S2_SCORE != null) {
    const vc = d.S2_VOID_COMP_PCT, hot = d.S2_MONTHLY_GAP > 0;
    o.S2_NARRATIVE = hot
      ? `Voids and comps hit ${pct1(vc)} of sales${vc >= 4 ? ', more than double where a tight house runs' : ''}. That is the easiest place in the building to make money disappear.`
      : `Voids and comps are running ${pct1(vc)} of sales, inside the range. Nothing here is screaming, keep the gate closed.`;
    o.S2_FINDING = hot
      ? `${d.S2_VOIDS_NO_APPROVAL_PCT > 0 ? `${pct1(d.S2_VOIDS_NO_APPROVAL_PCT)} of those voids went through with no manager approval. ` : ''}${d.S2_NO_SALE_COUNT >= 10 ? `${d.S2_NO_SALE_COUNT} no-sale drawer opens sit on top of it. ` : ''}Call it ${money(d.S2_MONTHLY_GAP)} a month in excess you can tighten.`
      : `Drawer reconciliation is ${yes(d.S2_DRAWER_RECON) ? 'getting done' : 'the gap to close'} and unauthorized voids are low. This is a controlled cash path.`;
    o.S2_TOOL = hot
      ? `Require a manager code on every void and comp, and watch the volume by server in Loss Prevention. The ones who spike are your conversation.`
      : `Keep logging every void against the server who rang it in Void and Comps so a pattern cannot hide.`;
  }

  // S3 — Food Cost Control
  if (d.S3_SCORE != null) {
    const fc = d.S3_FOOD_COST_PCT, tgt = d.S3_TARGET_PCT, over = d.S3_MONTHLY_GAP > 0;
    o.S3_NARRATIVE = over
      ? `Food cost ran ${pct1(fc)} against your ${pct1(tgt)} target. The plate is eating margin.`
      : `Food cost is ${pct1(fc)}, in line with your ${pct1(tgt)} target. The kitchen is holding the line.`;
    o.S3_FINDING = over
      ? `On ${money(d.S3_FOOD_REV_MONTHLY)} of monthly food sales, that overage is ${money(d.S3_MONTHLY_GAP)} a month. A ${pct1(d.S3_FOOD_VAR_PCT)} food variance points at portioning and waste, not your menu prices.`
      : `A food variance of ${pct1(d.S3_FOOD_VAR_PCT)} says portions and prep are tight. Nothing to chase here.`;
    o.S3_TOOL = over
      ? `Tighten portions on the high-volume plates and log waste in Inventory so you can see where it goes. Re-cost anything the last delivery moved.`
      : `Hold it. Keep costing new menu items so a price creep cannot sneak the number up.`;
  }

  // S4 — Vendor Control
  if (d.S4_SCORE != null) {
    const cred = d.S4_UNCOLLECTED_CREDITS > 0;
    o.S4_NARRATIVE = `Vendor spend runs ${money(d.S4_VENDOR_SPEND_MONTHLY)} a month and invoices are ${String(d.S4_INVOICE_VS_PO || '').toLowerCase().indexOf('matched') === 0 ? 'getting matched to the order' : 'the soft spot'}. On unverified invoices, a few points of every dollar slips through in overcharges and short counts.`;
    o.S4_FINDING = cred
      ? `You already flagged ${money(d.S4_UNCOLLECTED_CREDITS)} in overcharges across ${d.S4_OPEN_CREDIT_COUNT || 0} open discrepanc${d.S4_OPEN_CREDIT_COUNT === 1 ? 'y' : 'ies'} and have not collected it yet. The catching is done, the chasing is not.`
      : `Roughly ${money(d.S4_EXPOSURE_MONTHLY)} a month of spend is exposed to overcharges you are not verifying. It is not a measured leak, it is the door you are leaving open.`;
    o.S4_TOOL = cred
      ? `Chase the filed credits in Vendor Tracker. Match every new invoice to its PO and price sheet before you pay it.`
      : `Match every invoice to its PO and price sheet in Receive Delivery, and flag the drift the day it lands, not at month end.`;
  }

  // S5 — Prime Cost
  if (d.S5_SCORE != null) {
    const prime = d.S5_PRIME_COST_PCT, tgt = d.S5_TARGET_PCT || 60, over = prime > tgt;
    o.S5_NARRATIVE = over
      ? `Prime cost is ${pct1(prime)} against a ${pct1(tgt)} ceiling. That is the one number that decides whether the doors stay open, and it is over.`
      : `Prime cost is ${pct1(prime)}, ${prime < tgt ? 'under' : 'at'} your ${pct1(tgt)} ceiling. Get this right and the rest of the P&L usually follows.`;
    o.S5_FINDING = `Pour cost ${pct1(d.S5_BAR_COST_PCT)}, food cost ${pct1(d.S5_FOOD_COST_PCT)}, labor ${pct1(d.S5_LABOR_PCT)}. ${over ? 'The overage lives in whichever of the three sits furthest over target. Close that one and prime follows.' : 'All three are pulling their weight.'}`;
    o.S5_TOOL = over
      ? `Work the biggest of the three gaps first in Profit Fix. Prime does not move until pour, food, or labor does.`
      : `Hold all three. Prime cost is a lagging read, so protect the disciplines that got you here.`;
  }

  return o;
}

function revenueNarrative(d) {
  const o = {};

  // S1 — Check Average and Revenue
  if (d.S1_SCORE != null) {
    const ca = d.S1_CHECK_AVG, tgt = d.S1_CHECK_AVG_TARGET, under = ca < tgt;
    const bev = d.S1_BEV_PER_COVER, bench = d.S1_BEV_ATTACH_BENCHMARK;
    o.S1_NARRATIVE = under
      ? `Your blended check average is ${money(ca)} against a ${money(tgt)} target. Every guest is leaving room on the table.`
      : `Blended check average is ${money(ca)}, ${ca > tgt ? 'over' : 'right at'} your ${money(tgt)} target. The room is spending.`;
    o.S1_FINDING = under
      ? `On ${d.S1_COVER_COUNT ? Number(d.S1_COVER_COUNT).toLocaleString('en-US') : 'your'} monthly covers, closing that gap is ${money(d.S1_MONTHLY_GAP)} a month.` + (bev != null && bench != null && bev < bench ? ` Beverage attachment is ${bev} drinks a guest against a ${bench} benchmark, that is the fastest dollar.` : '') + (d.S1_DAYPART_SPREAD >= 4 && d.S1_DAYPART_WEAKEST ? ` ${d.S1_DAYPART_WEAKEST} is your soft daypart at ${money(d.S1_DAYPART_WEAKEST_CHECK)}.` : '')
      : `Beverage attachment${bev != null ? ` is ${bev} drinks a guest` : ' is holding'} and the dayparts are even. The check is where you set it.`;
    o.S1_TOOL = under
      ? `Push the attach on the weak daypart. Set a drink-and-app standard, teach it at pre-shift, and track check average by server in Server Check.`
      : `Hold it, and nudge the target up as the menu and service push add-ons.`;
  }

  // S2 — Labor Efficiency
  if (d.S2_SCORE != null) {
    const lab = d.S2_LABOR_PCT, tgt = d.S2_LABOR_TARGET_PCT, over = lab > tgt;
    o.S2_NARRATIVE = over
      ? `Labor ran ${pct1(lab)} of sales against a ${pct1(tgt)} target. You are carrying hours the sales did not ask for.`
      : `Labor is ${pct1(lab)} of sales, ${lab < tgt ? 'under' : 'on'} your ${pct1(tgt)} target. The schedule is matched to the room.`;
    o.S2_FINDING = over
      ? `That overage is ${money(d.S2_MONTHLY_GAP)} a month. ${d.S2_RPLH != null && d.S2_RPLH_TARGET != null ? `Revenue per labor hour is ${money(d.S2_RPLH)} against a ${money(d.S2_RPLH_TARGET)} target, ` : ''}${d.S2_OVERTIME_HRS ? `and ${d.S2_OVERTIME_HRS} overtime hours are in the window.` : 'the hours are landing where the covers are not.'}`
      : `Revenue per labor hour is ${d.S2_RPLH != null ? money(d.S2_RPLH) : 'holding'} and overtime is in check. The build is tight.`;
    o.S2_TOOL = over
      ? `Schedule to the cover forecast in Build Schedule, cut the hour that is not earning, and kill the overtime before it starts.`
      : `Keep scheduling to the forecast. Watch the overtime flags in Build Schedule so a creep does not start.`;
  }

  // S3 — Menu Performance
  if (d.S3_SCORE != null) {
    const dogs = d.S3_DOGS_COUNT || 0, stale = d.S3_PRICING_STALE === true, act = dogs > 3 || stale;
    o.S3_NARRATIVE = act
      ? `Your menu is carrying ${dogs} Dog${dogs === 1 ? '' : 's'}, low margin and low volume${stale ? `, and prices last moved ${String(d.S3_LAST_PRICE_INCREASE || '').toLowerCase()}` : ''}. Dead weight on the page.`
      : `The menu mix is working, ${d.S3_STARS_COUNT || 0} Star${d.S3_STARS_COUNT === 1 ? '' : 's'} pulling their weight and few Dogs.${d.S3_TOP_CATEGORY ? ' ' + d.S3_TOP_CATEGORY + ' leads the revenue.' : ''}`;
    o.S3_FINDING = act
      ? `${dogs} Dog${dogs === 1 ? '' : 's'} and ${d.S3_PLOWHORSES_COUNT || 0} Plowhorse${d.S3_PLOWHORSES_COUNT === 1 ? '' : 's'} sit below where they should. ${stale ? 'Stale pricing is leaving margin on every ticket.' : 'Reprice or reposition them before they eat the mix.'}`
      : `Stars and Puzzles carry the mix and the Dogs are few. Nothing to cut today.`;
    o.S3_TOOL = act
      ? `Reprice the over-target items to target in Menu Engineering, and Dog Test the low-volume plates before you cut them.`
      : `Keep the menu fresh. Reprice to target in Menu Engineering whenever costs move.`;
  }

  // S4 — Server Performance
  if (d.S4_SCORE != null) {
    const spread = d.S4_PERFORMANCE_SPREAD, wide = spread > 5 || d.S4_MONTHLY_GAP > 0;
    o.S4_NARRATIVE = wide
      ? `Your top server rings ${money(d.S4_TOP_CHECK_AVG)} a check and your bottom rings ${money(d.S4_BOTTOM_CHECK_AVG)}, a ${money(spread)} spread. Same tables, different money.`
      : `Your servers are tight, only ${money(spread)} between the top and bottom check average. The floor is coached up.`;
    o.S4_FINDING = wide
      ? `Pull the bottom third up to the team average and that is ${money(d.S4_MONTHLY_GAP)} a month, no new guests required.` + (d.S4_APP_ATTACH_RATE != null && d.S4_APP_ATTACH_RATE < 30 ? ` Appetizer attach is only ${pct1(d.S4_APP_ATTACH_RATE)}.` : '')
      : `Across ${d.S4_SERVER_COUNT || 'your'} servers the spread is narrow. The standard is landing.`;
    o.S4_TOOL = wide
      ? `Name the bottom two in Server Check, coach the add-on and the second round, and re-measure next week.`
      : `Keep the pre-shift standard tight and watch the spread in Server Check so it does not widen.`;
  }

  // S5 — Events and Private Dining
  if (d.S5_SCORE != null) {
    const evs = d.S5_EVENTS_PER_MONTH || 0;
    o.S5_NARRATIVE = evs > 0
      ? `You are running ${evs} event${evs === 1 ? '' : 's'} a month at ${money(d.S5_AVG_EVENT_REVENUE)} average, ${money(d.S5_EVENT_REV_PERIOD)} in the window. A booked event is your highest-margin cover.`
      : `No events on the books in the window. That is a whole revenue line sitting idle.`;
    o.S5_FINDING = evs > 0
      ? `${yes(d.S5_MINIMUM_MET) ? 'Your spend minimum is holding, ' : 'There is no spend minimum set yet, '}the room is doing the work. More dates is more of your best margin.`
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
