'use strict';

/* ── Fix Layer content — Profit Recovery ──────────────────────────────────────
   Static fix content for the Profit gap-areas (Section 9). Rendered by the
   Profit Fix screen (S.ProfitFix) as the campaign of leak tiles + step flows.
   Zero API cost (Rule 23). Source: the Profit Fix System. */

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
        { kind: 'result', target: 'this-week', targetLabel: 'This Week',
          title: 'Review the trend every week',
          detail: 'Once a week, open This Week. The weekly history shows pour cost against target for every saved week, with the dollar gap. The trend tells you whether the number is holding or drifting.' },
        { kind: 'reference', target: 'Measured_Pour_Standards_Policy.docx', targetLabel: 'Measured Pour Standards Policy',
          title: 'Put a written pour standard in place',
          detail: 'Download the Measured Pour Standards Policy, set your pour sizes, and have every staff member sign it before the effective date. A signed policy makes later corrective action a policy issue, not a personal one.' }
      ]
    },

    commonMistakes: [
      'A product set up wrong in Inventory. If a bottle\'s size, pour, or cost is off, every pour cost built on it is off while the count itself looks fine.',
      'Counts that drift to a different day or time each week, so what you begin and end with never line up against a clean seven days.',
      'A delivery logged on the invoice date instead of the day it landed. One delivery on the wrong side of a count moves the number by a full case.',
      'Reading a variance spike as theft before re-checking the count. As often as not it is a missed back-bar bottle, not a person.'
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
          detail: 'In Shift Control, log every void and comp against the employee who rang it. Each comp carries a Reason that classifies it: customer-facing reasons (service recovery, goodwill, regular or VIP, promo) are loss and show up in Loss Prevention, while Staff Meal and Shift Drink are policy expense tracked as a cost line in the books. Picking the honest reason keeps the loss signals real and keeps staff drinks out of the guest-comp number.' },
        { kind: 'action', target: 'sc-shift-policies', targetLabel: 'Shift Policies',
          title: 'Set a Comp Auth Threshold and enforce it',
          detail: 'In Shift Control under Setup, open Shift Policies and set the Comp Auth Threshold above which a manager must sign off (defaults to $25). Saving a comp over the threshold without a manager pops a soft warning the operator can override, and every override flags in Loss Prevention as a large comp cleared over your threshold without authorization. The bartender comping a $40 round of drinks without manager involvement is one of the most common bar-theft patterns and this is how Bar Cop catches it.' },
        { kind: 'action', target: 'sc-cash-control', targetLabel: 'Cash Control',
          title: 'Reconcile every cash drawer',
          detail: 'In Cash Control, count each drawer against expected POS cash at end of shift and log the over or short. Consistent shorts and consistent overs are both signals.' },
        { kind: 'action', target: 'ic-receive-delivery', targetLabel: 'Receive Delivery',
          title: 'Inspect every delivery against the invoice',
          detail: 'Log each delivery in Receive Delivery and check it against the invoice before the driver leaves. Bar Cop flags price changes, and you catch short counts and substitutions.' },
        { kind: 'action', target: 'ic-spot-check', targetLabel: 'Spot Check',
          title: 'Run unannounced shift audits',
          detail: 'Use Spot Check for a fast pre and post shift count on your high-risk products, on different shifts at varied times. The audit is a deterrent as much as a detection tool.' },
        { kind: 'result', target: 'theft-risk', targetLabel: 'Loss Prevention',
          title: 'Review the loss signals weekly',
          detail: 'Loss Prevention pulls unauthorized voids and comps, drawer shorts, flagged spot checks, and confirmed theft into one live read of what flagged today and over the last 7 days, with a dollar amount on each. It is a catch-it-now detector, not a lagging score. Review it every week, and the worst flags also push to the Hub and to Open the Floor so they find you.' },
        { kind: 'reference', target: 'Employee_Corrective_Action_Template.docx', targetLabel: 'Employee Corrective Action Template',
          title: 'Escalate a documented pattern',
          detail: 'One incident is a data point. Two on the same employee within 30 days is a pattern. Document incidents in writing as you see them, and use the Corrective Action Template once the pattern is clear.' }
      ]
    },

    commonMistakes: [
      'Comps logged under the wrong reason. Staff Meal and Shift Drink are policy expense, everything else is loss, and the wrong pick skews what Loss Prevention shows you.',
      'Voids and comps rung without naming the employee, so the same server\'s pattern never collects in one place.',
      'Overriding the comp threshold and then never opening the flag it raised. The override lands in Loss Prevention whether or not anyone reads it.',
      'Watching only for drawer shorts. A drawer that comes up consistently over is as much a signal as one that comes up short.'
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
          detail: 'Use the Portion Control Audit form on at least two stations a week at varied times, checked against the portion spec on each recipe card. Over-portioning is a standards gap, so treat findings as training, not discipline.' },
        { kind: 'result', target: 'this-week', targetLabel: 'This Week',
          title: 'Review the trend with the kitchen manager',
          detail: 'Each week, open This Week with the kitchen manager. The weekly history shows food cost against target and the dollar gap. Cross-reference it against the Waste and Spill Log entries and the portion audit findings from the past week, and set one specific action with a named owner.' },
        { kind: 'action', target: 'recipe-cost-analysis', targetLabel: 'Recipe Summary',
          title: 'Reprice the items above target',
          detail: 'When food cost is above target, open Recipe Summary to see exactly which items are pulling cost up, sorted over-target first. Edit one right there to fix its recipe or reprice it in place. A surgical increase on the few items above target is less visible to guests than an across-the-board raise.' }
      ]
    },

    commonMistakes: [
      'Waste logged with no reason code. Bar Cop subtracts logged waste from variance, but a number with no reason behind it tells you nothing to change.',
      'Product costs left stale in Inventory. Recipe cost reads off current product prices, so a cost you never updated quietly understates every plate that uses it.',
      'Raising prices across the board when only a few items are over. Recipe Summary sorts the over-target items first so you can lift just those.',
      'A menu item with no recipe attached. With nothing to cost against, it carries no food cost into the number and your cost reads better than it is.'
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
        { kind: 'action', target: 'ic-receive-delivery', targetLabel: 'Receive Delivery',
          title: 'Flag any short count or wrong price at the dock',
          detail: 'When a line comes up short, damaged, or billed wrong, Flag it right on the Receive Delivery line before the driver leaves. The flag files the claim with that delivery attached. If the problem turns up later, an invoice that arrives after or a keg that pours flat, open the delivery in Delivery History and flag the line there. Catch it at the door; a short count you sign for is a loss you already accepted.' },
        { kind: 'action', target: 'vendor-discrepancy', targetLabel: 'Vendor Tracker',
          title: 'Chase the credit you are owed',
          detail: 'Open Vendor Tracker\'s Discrepancies tab to work every claim you flagged. Request Credit drafts the email to your rep and flips the status, Mark Resolved records what you actually got back, and the tab totals what is still owed you. Get to the rep within 24 hours, claims age out fast.' },
        { kind: 'result', target: 'vendor-watch', targetLabel: 'Vendor Tracker',
          title: 'Read the line-by-line price drift Bar Cop is tracking',
          detail: 'Vendor Tracker\'s Price Changes tab reads every delivery you receive and surfaces which product prices have drifted up and what that drift costs you per year. There is no price tracker to keep by hand. Check it once a month.' },
        { kind: 'result', target: 'vendor-scorecard', targetLabel: 'Vendor Tracker',
          title: 'Bring the per-vendor rollup to a quarterly review',
          detail: 'Once a quarter, open Vendor Tracker\'s Scorecard tab for the per-vendor rollup: total spend, net price drift, short counts, open and recovered overcharges, days to credit, and a status (High, Watch, Clean). Export PDF and take it into the rep meeting. Ask for a price match or an explanation on every High and Watch line, and talk volume terms. A documented status is hard for a rep to wave off.' },
        { kind: 'reference', target: 'Vendor_Agreement_Terms_Checklist.docx', targetLabel: 'Vendor Agreement Terms Checklist',
          title: 'Confirm the terms in writing',
          detail: 'Within 48 hours of the review, download the Vendor Agreement Terms Checklist, fill in the pricing, substitution policy, and delivery terms you agreed to, and send it to your rep. When a price dispute happens and your only record is a phone call, you have no dispute.' }
      ]
    },

    commonMistakes: [
      'Signing for a delivery before counting it against the order. A short count you sign for is a loss you already accepted, even if Bar Cop can flag it.',
      'Not flagging a short or a wrong price at the dock. The flag is what files the claim and ties it to that delivery, and chasing it later is harder.',
      'Filing a discrepancy and never working it. Vendor Tracker totals what is still owed you, but the credit only comes back if you Request Credit and stay on the rep.',
      'A substitution waved through at the premium price. A lower-tier product billed at the higher price is an overcharge, not a swap.'
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
        { kind: 'result', target: 'this-week', targetLabel: 'This Week',
          title: 'Check spike against trend',
          detail: 'This Week shows prime cost across the past weeks. Before you act, look at whether this is a one-week spike from a bulk purchase or a payroll correction, or a real trend that has been building.' },
        { kind: 'result', target: 'weekly-pnl', targetLabel: 'Weekly P&L Brief',
          title: 'Pull your weekly P&L',
          detail: 'Each week, open your Weekly P&L Brief under Accounting. Bar Cop builds it from the weeks you confirm, revenue, COGS, labor, and prime cost broken out by bar and food, ready to file or hand your bookkeeper. There is no blank form to fill in by hand. Four of these are your month.' },
        { kind: 'result', target: 'books', targetLabel: 'Month-End Books',
          title: 'Review the month-end numbers',
          detail: 'Once a month, open Month-End Books and walk management through the four weeks together. The numbers are already built from your weekly rollups, so the meeting is about decisions, not data entry. Set next month\'s cost-control priorities with a named owner on each one.' },
        { kind: 'reference', target: 'Monthly_Cost_Control_Review_Agenda.docx', targetLabel: 'Monthly Cost Control Review Agenda',
          title: 'Use the review agenda to run the meeting',
          detail: 'Download the Monthly Cost Control Review Agenda to structure the management meeting, so every cost line gets walked and nothing gets skipped.' }
      ]
    },

    commonMistakes: [
      'Reading a week you never confirmed. Prime cost is only as honest as the sales, labor, and COGS behind it, so confirm the week in This Week first.',
      'Judging a week that is only half logged. Until the shifts and counts are in, a full period of COGS against partial sales reads high on its own.',
      'Taking one week\'s spike as a trend. A bulk buy or a payroll correction throws a single week, and This Week shows whether it is holding or drifting.',
      'Waiting for month-end to look. A 30-day lag is 30 days of loss before you see it, and 30 more before you know a fix worked.'
    ]
  }

];
