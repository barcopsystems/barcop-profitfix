'use strict';

/* ── Fix Layer content — Profit Recovery ──────────────────────────────────────
   Static fix content for the Profit gap-areas (Section 9). Rendered by
   FixPanel inside Profit Recovery's Help & FAQ. Zero API cost (Rule 23).
   Source: the Profit Fix System. */

window.FIX = window.FIX || {};

FIX.profit = [

  {
    id: 'pour-cost',
    name: 'Pour Cost',
    module: 'profit',
    summary: 'The gap between what you spent on bar product and what you sold, including the draft beer lost to foam, over-pour, and line cleaning.',

    process: {
      steps: [
        { kind: 'action', target: 'ic-product-setup', targetLabel: 'Products',
          title: 'Set accurate bottle yields',
          detail: 'In Inventory Control Products, enter every active product with its container size, pour size, and unit cost. Bar Cop turns that into pours per container and cost per pour, and pour cost is only as accurate as those numbers.' },
        { kind: 'action', target: 'ic-take-inventory', targetLabel: 'Take Inventory',
          title: 'Count on the same day every week',
          detail: 'Run a full count in Take Inventory on the same day each week. Count partial bottles with the bottle slider instead of estimating by eye. The count is what every pour cost number is built from.' },
        { kind: 'result', target: 'dashboard', targetLabel: 'Profit Dashboard',
          title: 'Read your actual pour cost',
          detail: 'There is nothing for you to calculate. Bar Cop works out pour cost from your counts and deliveries and shows it on the Profit dashboard against your target. The Fix Areas card shows the dollar gap annualized at this week\'s pace.' },
        { kind: 'action', target: 'ic-report-variance', targetLabel: 'Variance Report',
          title: 'Run the variance report',
          detail: 'The Variance Report compares what your count says you used against what the POS says you sold. Anything above the flag threshold is over-pouring, waste, theft, or unrecorded comps.' },
        { kind: 'action',
          title: 'Spot-check pour accuracy on the floor',
          detail: 'The Variance Report tells you the shift is off; a quick pour test tells you which bartender is off. Set a jigger in front of each bartender and have them free-pour what they think is an ounce, then check it against the jigger. A 0.2 oz over-pour on a 1,000-drink-a-month bartender is real money the shift-level data misses. Coach anyone who is heavy to count their pour on the spot, and pair it with the signed pour standard below.' },
        { kind: 'result', target: 'reports', targetLabel: 'Reports and History',
          title: 'Review the trend every week',
          detail: 'Once a week, open Reports and History. The weekly table shows pour cost against target for every saved week, with the dollar gap. The trend tells you whether the number is holding or drifting.' },
        { kind: 'reference', target: 'Measured_Pour_Standards_Policy.docx', targetLabel: 'Measured Pour Standards Policy',
          title: 'Put a written pour standard in place',
          detail: 'Download the Measured Pour Standards Policy, set your pour sizes, and have every staff member sign it before the effective date. A signed policy makes later corrective action a policy issue, not a personal one.' }
      ]
    },

    commonMistakes: [
      'Estimating partial bottles by eye instead of measuring them. A back bar with 40 open bottles builds a real error into every calculation.',
      'Letting the count slip when a manager is out. The system dies from a missed cycle, not a bad number. Write the process down so it lives in paper, not people.',
      'Starting a variance investigation with a conversation instead of the data. Verify the count first. Many spikes turn out to be a counting error, not a person.',
      'Counting purchases as invoices paid rather than product physically received in the period. One delivery on the wrong side of a count date throws the number off by a full case.',
      'Ignoring draft yield. The Profit Audit compares units sold against what your kegs should have poured. Losing more than 12 to 15 percent to foam and over-pour means the lines, the temperature, the pressure, or the pour are off. A keg that should pour 124 pints and only rings up 100 is a quarter of every keg gone.'
    ]
  },

  {
    id: 'theft-loss',
    name: 'Theft and Loss',
    module: 'profit',
    summary: 'Cash, product, and comp loss that never shows as a line item, including discount abuse and no-sale drawer opens.',

    process: {
      steps: [
        { kind: 'reference', target: 'Theft_Loss_Prevention_Policy.docx', targetLabel: 'Theft and Loss Prevention Policy',
          title: 'Set a written theft and loss policy',
          detail: 'Download the Theft and Loss Prevention Policy, set the cash, comp, and product rules, and have every staff member sign it at hire. It protects the business and every honest employee.' },
        { kind: 'action', target: 'sc-void-comp', targetLabel: 'Void and Comp Log',
          title: 'Log voids, comps, and no-sales by employee with category',
          detail: 'In Shift Control, log every void and comp against the employee who rang it. Each comp carries a Reason that classifies it: customer-facing reasons (service recovery, goodwill, regular or VIP, promo) are loss and feed the Theft Risk score, while Staff Meal and Shift Drink are policy expense tracked as a cost line in the books. Picking the honest reason keeps the theft score real and keeps staff drinks out of the guest-comp number.' },
        { kind: 'action', target: 'sc-shift-policies', targetLabel: 'Shift Policies',
          title: 'Set a Comp Auth Threshold and enforce it',
          detail: 'In Shift Control under Setup, open Shift Policies and set the Comp Auth Threshold above which a manager must sign off (defaults to $25). Saving a comp over the threshold without a manager pops a soft warning the operator can override, and every override flags in Theft Risk under Unauthorized Large Comps. The bartender comping a $40 round of drinks without manager involvement is one of the most common bar-theft patterns and this is how Bar Cop catches it.' },
        { kind: 'action', target: 'sc-cash-control', targetLabel: 'Cash Control',
          title: 'Reconcile every cash drawer',
          detail: 'In Cash Control, count each drawer against expected POS cash at end of shift and log the over or short. Consistent shorts and consistent overs are both signals.' },
        { kind: 'action', target: 'ic-receive-delivery', targetLabel: 'Receive Delivery',
          title: 'Inspect every delivery against the invoice',
          detail: 'Log each delivery in Receive Delivery and check it against the invoice before the driver leaves. Bar Cop flags price changes, and you catch short counts and substitutions.' },
        { kind: 'action', target: 'ic-spot-check', targetLabel: 'Spot Check',
          title: 'Run unannounced shift audits',
          detail: 'Use Spot Check for a fast pre and post shift count on your high-risk products, on different shifts at varied times. The audit is a deterrent as much as a detection tool.' },
        { kind: 'result', target: 'theft-risk', targetLabel: 'Theft Risk',
          title: 'Review the theft signals weekly',
          detail: 'The Theft Risk scorecard pulls voids and comps, cash variance, and spot-check flags into one auto-scored read. Review it every week and watch the trend.' },
        { kind: 'reference', target: 'Employee_Corrective_Action_Template.docx', targetLabel: 'Employee Corrective Action Template',
          title: 'Escalate a documented pattern',
          detail: 'One incident is a data point. Two on the same employee within 30 days is a pattern. Document incidents in writing as you see them, and use the Corrective Action Template once the pattern is clear.' }
      ]
    },

    commonMistakes: [
      'Waiting until you are certain before documenting. By the time you are certain, the paper trail that makes action possible is gone.',
      'Acting on a single incident with no documentation. It creates legal exposure and rarely survives a dispute with an employee who denies it.',
      'Skipping the delivery inspection when the truck arrives mid-service. That is exactly when short counts happen and are hardest to dispute later.',
      'Having no written comp authorization policy. A comp that needs no manager sign-off is an unauthorized expense you approved by silence.',
      'Treating all comps the same. A manager comp for service recovery and a bartender comp for a regular are different things and must be tracked separately.',
      'Ignoring discounts and no-sale opens. The Profit Audit reads both off your POS exception report. Discounts running above 2 percent of sales, or a stack of no-sale drawer opens, are theft vectors that never show as voids or comps. Require manager authorization on discounts and a logged reason for every no-sale.',
      'Using behavioral indicators to accuse someone. They direct attention. They are not evidence.'
    ]
  },

  {
    id: 'food-cost',
    name: 'Food Cost',
    module: 'profit',
    summary: 'What the kitchen spends on product against what it sells.',

    process: {
      steps: [
        { kind: 'action', target: 'r-menu-items', targetLabel: 'Menu Items',
          title: 'Build yield-adjusted recipe cost cards',
          detail: 'In Menu Items, open each menu item and attach an ingredient recipe. Ingredient costs pull from your products and prep batches, so proteins and produce are costed on real prices. Costing on purchase price without a yield adjustment understates every protein on the menu.' },
        { kind: 'action', target: 'ic-take-inventory', targetLabel: 'Take Inventory',
          title: 'Count food on the same weekly schedule as the bar',
          detail: 'Run a Kitchen or Full count in Take Inventory, the same day every week, valued at cost. The count is the foundation every food cost number depends on.' },
        { kind: 'result', target: 'dashboard', targetLabel: 'Profit Dashboard',
          title: 'Read your actual food cost',
          detail: 'Bar Cop works out food cost from your counts and deliveries and shows it on the Profit dashboard against your target. The Fix Areas card shows the dollar gap annualized at this week\'s pace. There is nothing for you to calculate.' },
        { kind: 'action', target: 'sc-waste', targetLabel: 'Waste and Spill Log',
          title: 'Log waste in Shift Control with reason codes',
          detail: 'Every spill, dumped pour, broken product, and expired item gets logged in the Waste and Spill Log with a reason code. The reason code is the point. A count of what was thrown away tells you nothing about what to change. Logged waste also gets subtracted from inventory variance so legit losses do not show as theft.' },
        { kind: 'reference', target: 'Daily_Food_Waste_Tracking.pdf', targetLabel: 'Daily Food Waste Sheet',
          title: 'Paper backup for the line',
          detail: 'Optional. Print the Daily Food Waste Sheet for the kitchen line if a tablet is not within reach during service. Transfer each entry into the Waste and Spill Log at end of shift so it counts toward variance.' },
        { kind: 'action',
          title: 'Spot-check plate portions on the line',
          detail: 'Weigh a few plates of a dish during service and compare against the portion spec on the recipe card. A line cook over-portioning fries by 20 percent on a 200-cover night runs through 40 extra pounds a week, real food cost no other screen catches. When a cook runs heavy, coach the portion on the spot and pair it with the Portion Control Audit below.' },
        { kind: 'reference', target: 'Portion_Control_Audit.pdf', targetLabel: 'Portion Control Audit',
          title: 'Run portion control audits',
          detail: 'Use the Portion Control Audit form on at least two stations a week at varied times, checked against the portion spec on each recipe card. Pair the paper form with Yield Test for the digital trail. Over-portioning is a standards gap, so treat findings as training.' },
        { kind: 'result', target: 'reports', targetLabel: 'Reports and History',
          title: 'Review the trend with the kitchen manager',
          detail: 'Each week, open Reports and History with the kitchen manager. The weekly table shows food cost against target and the dollar gap. Cross-reference it against the Waste and Spill Log entries and the portion audit findings from the past week, and set one specific action with a named owner.' },
        { kind: 'action', target: 'recipe-cost-analysis', targetLabel: 'Recipe Cost Analysis',
          title: 'Reprice the items above target',
          detail: 'When food cost is above target, open Recipe Cost Analysis to see exactly which items are pulling cost up. Open Item from there to reprice on the Menu Items screen. A surgical increase on those items is less visible to guests than an across-the-board raise.' }
      ]
    },

    commonMistakes: [
      'Treating portion audit findings as a disciplinary issue. Over-portioning is almost always a standards gap, not a character gap.',
      'Logging waste without reason codes. A count of what was thrown away tells you nothing about why it happened or what to change.',
      'Raising prices across the board when food cost spikes. A surgical increase on the specific items above target is less visible and more effective.',
      'Building recipe cards once and never updating them. A card built at January prices is wrong by March, and the gap widens with every price move since.',
      'Having no written portion standards posted at stations. A verbal instruction given on day one is a memory that fades and drifts.',
      'Costing proteins at purchase price without a yield adjustment. Every protein on the menu is understated until you cost on true cost per usable pound.'
    ]
  },

  {
    id: 'vendor-control',
    name: 'Vendor Control',
    module: 'profit',
    summary: 'Price drift, short counts, and quiet substitutions on every invoice, plus the filed credits still owed to you that never get chased.',

    process: {
      steps: [
        { kind: 'action', target: 'ic-order-history', targetLabel: 'Order History',
          title: 'Know what you ordered before the truck arrives',
          detail: 'Open Order History and pull the order for the incoming delivery. You cannot audit a delivery against an order you do not have in front of you, so confirm the products, quantities, and agreed prices before the driver is at the door.' },
        { kind: 'action', target: 'ic-receive-delivery', targetLabel: 'Receive Delivery',
          title: 'Count every case before you sign',
          detail: 'Log the delivery in Receive Delivery and count it against the order, line by line. A short count not caught at the door is a loss you already accepted. It does not get recovered later.' },
        { kind: 'action', target: 'ic-receive-delivery', targetLabel: 'Receive Delivery',
          title: 'Check the invoiced prices as you receive',
          detail: 'As you receive, Bar Cop compares each invoiced price against the last price you paid and flags anything that moved. Note any substitution before you sign. A lower-tier product billed at the premium price is an overcharge, not a substitution.' },
        { kind: 'action', target: 'vendor-discrepancy', targetLabel: 'Vendor Discrepancies',
          title: 'File a discrepancy on any variance',
          detail: 'When a delivery is short or a price is wrong, open Vendor Discrepancies and file it: vendor, type, product, agreed price, invoiced price, and the total overcharge. Get it to your rep within 24 hours, discrepancies age out fast. The screen tracks each one from open to credit requested to resolved, and totals what is still owed to you.' },
        { kind: 'result', target: 'vendor-watch', targetLabel: 'Vendor Watch',
          title: 'Read the line-by-line price drift Bar Cop is tracking',
          detail: 'Vendor Watch reads every delivery you receive and surfaces which product prices have drifted up and what that drift costs you per year. There is no price tracker to keep by hand. Check it once a month.' },
        { kind: 'result', target: 'vendor-scorecard', targetLabel: 'Vendor Scorecard',
          title: 'Bring the per-vendor rollup to a quarterly review',
          detail: 'Once a quarter, open Vendor Scorecard for the per-vendor rollup: total spend, net price drift, short counts, open and recovered overcharges, days to credit, and a status tier (HIGH, WATCH, CLEAN). Export PDF and take it into the rep meeting. Ask for a price match or an explanation on every HIGH and WATCH line, and talk volume terms. A documented status tier is hard for a rep to wave off.' },
        { kind: 'reference', target: 'Vendor_Agreement_Terms_Checklist.docx', targetLabel: 'Vendor Agreement Terms Checklist',
          title: 'Confirm the terms in writing',
          detail: 'Within 48 hours of the review, download the Vendor Agreement Terms Checklist, fill in the pricing, substitution policy, and delivery terms you agreed to, and send it to your rep. When a price dispute happens and your only record is a phone call, you have no dispute.' }
      ]
    },

    commonMistakes: [
      'Paying invoices without comparing them to the order line by line. Every invoice you sign unchecked is a price you accepted by default.',
      'Accepting a substitution without adjusting the invoice price. A lower-tier product at the premium price is an overcharge for the difference.',
      'Assuming distributor prices are fixed and never shopping them. Most categories have negotiable elements and respond to documented competition.',
      'Signing the delivery receipt before counting the cases. A short count not caught at the door is a loss you already accepted.',
      'Running vendor relationships on verbal terms with nothing in writing. When a dispute happens, a phone conversation is not documentation.',
      'Treating overcharge recovery as a one-time audit rather than an ongoing job at every delivery.'
    ]
  },

  {
    id: 'prime-cost',
    name: 'Prime Cost',
    module: 'profit',
    summary: 'COGS plus labor as a share of sales. The one number that confirms your cost systems are working.',

    process: {
      steps: [
        { kind: 'action', target: 'this-week', targetLabel: 'This Week',
          title: 'Confirm the week\'s inputs',
          detail: 'Open This Week. Net sales come from Shift Control, labor from Labor Control, and COGS from Inventory Control, already filled in. Confirm them. Prime cost is only as honest as the numbers feeding it, so an unconfirmed week is a prime cost you cannot trust.' },
        { kind: 'result', target: 'dashboard', targetLabel: 'Profit Dashboard',
          title: 'Read prime cost every Monday',
          detail: 'Bar Cop calculates prime cost as total COGS plus total labor over net sales and shows it on the Profit dashboard against your concept target. There is nothing for you to calculate. Read it weekly, not monthly. A 30-day lag is 30 days of loss before you see it.' },
        { kind: 'result', target: 'dashboard', targetLabel: 'Profit Dashboard',
          title: 'Find which part moved when it is over',
          detail: 'When prime cost is over, the Fix Areas card tells you where. Bar Pour Cost, Food Cost, and Labor each carry their own status band and dollar gap. The number tells you it moved. The parts tell you where. Decide whether the gap calls for an investigation today or a corrective action this week.' },
        { kind: 'result', target: 'reports', targetLabel: 'Reports and History',
          title: 'Check spike against trend',
          detail: 'Reports and History shows prime cost across the past weeks. Before you act, look at whether this is a one-week spike from a bulk purchase or a payroll correction, or a real trend that has been building.' },
        { kind: 'reference', target: 'Weekly_PL_Snapshot.pdf', targetLabel: 'Weekly P&L Snapshot',
          title: 'File a weekly P&L snapshot',
          detail: 'Print the Weekly P&L Snapshot each Monday and file it. Four filed snapshots are the monthly review. Skipping them means rebuilding the month from memory, and memory rounds in the wrong direction.' },
        { kind: 'reference', target: 'Monthly_Cost_Control_Review_Agenda.docx', targetLabel: 'Monthly Cost Control Review Agenda',
          title: 'Run the monthly cost review',
          detail: 'Once a month, download the Monthly Cost Control Review Agenda and walk management through the four weeks together. Set the next month\'s cost-control priorities with a named owner on each one.' }
      ]
    },

    commonMistakes: [
      'Reading prime cost monthly instead of weekly. A 30-day lag means 30 days of loss before you see it, and 30 more before you know the fix worked.',
      'Treating prime cost as a finance metric. It belongs in the weekly management meeting, not the monthly P&L review.',
      'Acting on a single week\'s spike before checking the data. A miscoded payroll run or a one-time bulk purchase produces a false spike.',
      'Excluding payroll taxes and benefits from labor. Real labor cost runs 10 to 15% above wages alone, and a wages-only number understates the problem every week.'
    ]
  }

];
