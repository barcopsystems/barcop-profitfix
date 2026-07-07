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
          detail: 'In Inventory Control Products, enter every active product with its container size, pour size, and unit cost. Bar Cop turns that into pours per container and cost per pour.' },
        { kind: 'action', target: 'ic-take-inventory', targetLabel: 'Take Inventory',
          title: 'Count on the same day every week',
          detail: 'Run a full count in Take Inventory on the same day each week. Count partial bottles with the bottle slider, do not eyeball them.' },
        { kind: 'result', target: 'dashboard', targetLabel: 'Profit Dashboard',
          title: 'Read your actual pour cost',
          detail: 'Open the Profit dashboard and read pour cost against your target. The Fix Areas card carries the dollar gap, annualized at this week\'s pace.' },
        { kind: 'action', target: 'ic-report-variance', targetLabel: 'Variance Report',
          title: 'Run the variance report',
          detail: 'Run the Variance Report and work anything above the flag threshold. That is over-pouring, waste, theft, or unrecorded comps.' },
        { kind: 'action',
          title: 'Spot-check pour accuracy on the floor',
          detail: 'Set a jigger in front of each bartender and have them free-pour what they think is an ounce, then check it against the jigger. A 0.2 oz over-pour on a 1,000-drink-a-month bartender is real money no shift-level number catches. Coach anyone heavy to count their pour on the spot, and back it with the signed pour standard below.' },
        { kind: 'result', target: 'this-week', targetLabel: 'This Week',
          title: 'Review the trend every week',
          detail: 'Once a week, open This Week and read pour cost against target across your saved weeks. Watch whether it is holding or drifting.' },
        { kind: 'reference', doc: 'pour-standards', targetLabel: 'Measured Pour Standards Policy',
          title: 'Put a written pour standard in place',
          detail: 'Download the Measured Pour Standards Policy, set your pour sizes, and have every staff member sign it before the effective date.' }
      ]
    },

    commonMistakes: [
      'A product set up wrong in Inventory. One bad size, pour, or cost throws every pour cost built on it while the count still looks clean.',
      'Letting the count drift to a different day or time each week. The start and end never line up against a clean seven days.',
      'Logging a delivery on the invoice date instead of the day it landed. One delivery on the wrong side of a count moves the number by a full case.',
      'Calling a variance spike theft before you re-check the count. As often as not it is a missed back-bar bottle, not a person.'
    ]
  },

  {
    id: 'theft-loss',
    name: 'Theft and Loss',
    module: 'profit',
    summary: 'Cash, product, and comp loss that never shows as a line item, including discount abuse and no-sale drawer opens.',

    process: {
      steps: [
        { kind: 'reference', doc: 'theft-loss-policy', targetLabel: 'Theft and Loss Prevention Policy',
          title: 'Set a written theft and loss policy',
          detail: 'Download the Theft and Loss Prevention Policy, set the cash, comp, and product rules, and have every staff member sign it at hire.' },
        { kind: 'action', target: 'sc-void-comp', targetLabel: 'Void and Comp Log',
          title: 'Log voids, comps, and no-sales by employee with category',
          detail: 'In the Void and Comp Log, log every void, comp, and no-sale against the server who rang it, with an honest Reason. The give-aways read as loss; Staff Meal and Shift Drink post as a cost line.' },
        { kind: 'action', target: 'sales-integrity', targetLabel: 'Sales Integrity',
          title: 'Run a Sales Integrity review on your server sales',
          detail: 'Drop your POS server sales report into Sales Integrity each week. Work any server it flags for running off the floor on no-sales, voids, cash mix, or check average.' },
        { kind: 'action', target: 'sc-cash-control', targetLabel: 'Cash Control',
          title: 'Reconcile every cash drawer',
          detail: 'In Cash Control, count each drawer against expected POS cash at end of shift and log the over or short. Watch consistent overs as closely as consistent shorts.' },
        { kind: 'action', target: 'ic-receive-delivery', targetLabel: 'Receive Delivery',
          title: 'Inspect every delivery against the invoice',
          detail: 'Log each delivery in Receive Delivery and check it against the invoice before the driver leaves. Bar Cop flags price changes; you catch the short counts and substitutions.' },
        { kind: 'action', target: 'ic-spot-check', targetLabel: 'Spot Check',
          title: 'Run unannounced shift audits',
          detail: 'Use Spot Check for a fast pre and post shift count on your high-risk products, on different shifts at varied times.' },
        { kind: 'result', target: 'theft-risk', targetLabel: 'Loss Prevention',
          title: 'Review the loss signals weekly',
          detail: 'Once a week, open Loss Prevention and work what flagged: drawer shorts, spot checks, confirmed theft. The worst push to the Hub so they find you.' },
        { kind: 'reference', doc: 'corrective-action', targetLabel: 'Employee Corrective Action Template',
          title: 'Escalate a documented pattern',
          detail: 'One incident is a data point; two on the same employee within 30 days is a pattern. Document each one in writing as you see it, and use the Corrective Action Template once the pattern is clear.' }
      ]
    },

    commonMistakes: [
      'Comps logged under the wrong reason. Staff Meal and Shift Drink are policy expense; everything else is loss.',
      'Ringing voids and comps without naming the employee. The same server\'s pattern never collects in one place.',
      'Reading sales as one number instead of by server. The bartender running off book hides in the total until Sales Integrity ranks each one against the floor.',
      'Watching only for drawer shorts. A drawer that runs consistently over is as much a signal as one that runs short.'
    ]
  },

  {
    id: 'food-cost',
    name: 'Food Cost',
    module: 'profit',
    summary: 'What the kitchen spends on product against what it sells.',

    process: {
      steps: [
        { kind: 'action', target: 'r-menu-items', targetLabel: 'Menu Builder',
          title: 'Build yield-adjusted recipe cost cards',
          detail: 'In Menu Builder, open each menu item and attach an ingredient recipe. Costs pull from your products and prep batches. Make sure yield loss is in each cost, not just purchase price.' },
        { kind: 'action', target: 'ic-take-inventory', targetLabel: 'Take Inventory',
          title: 'Count food on the same weekly schedule as the bar',
          detail: 'Run a Kitchen or Full count in Take Inventory, the same day every week, valued at cost.' },
        { kind: 'result', target: 'dashboard', targetLabel: 'Profit Dashboard',
          title: 'Read your actual food cost',
          detail: 'Open the Profit dashboard and read food cost against your target. The Fix Areas card carries the dollar gap, annualized at this week\'s pace.' },
        { kind: 'action', target: 'sc-waste', targetLabel: 'Waste and Spill Log',
          title: 'Log waste in Shift Control with reason codes',
          detail: 'Log every spill, dumped pour, broken product, and expired item in the Waste and Spill Log with a reason code, never a bare count. Logged waste comes out of inventory variance so legit losses do not read as theft. If a tablet is not near the line during service, tap Worksheet on the Waste log to print a blank sheet and enter the entries at end of shift.' },
        { kind: 'action',
          title: 'Spot-check plate portions on the line',
          detail: 'Weigh a few plates of a dish during service against the portion spec on the recipe card. A cook over-portioning fries 20 percent on a 200-cover night burns 40 extra pounds a week. Coach the portion on the spot and back it with the Portion Control Audit below.' },
        { kind: 'reference', doc: 'portion-audit', targetLabel: 'Portion Control Audit',
          title: 'Run portion control audits',
          detail: 'Use the Portion Control Audit form on at least two stations a week at varied times, against the portion spec on each recipe card. Treat what you find as training, not discipline.' },
        { kind: 'result', target: 'this-week', targetLabel: 'This Week',
          title: 'Review the trend with the kitchen manager',
          detail: 'Each week, open This Week with the kitchen manager and read food cost against target with the dollar gap. Cross-check it against the past week\'s Waste and Spill Log and portion audit findings, and set one action with a named owner.' },
        { kind: 'action', target: 'recipe-cost-analysis', targetLabel: 'Recipe Summary',
          title: 'Reprice the items above target',
          detail: 'When food cost is above target, open Recipe Summary, sorted over-target first. Edit an item right there to fix its recipe or reprice it in place.' }
      ]
    },

    commonMistakes: [
      'Logging waste with no reason code. Bar Cop pulls it out of variance, but a bare count gives you nothing to act on.',
      'Leaving product costs stale in Inventory. Recipe cost reads off current prices, so a stale one understates every plate that uses it.',
      'Raising prices across the board when only a few items are over. Recipe Summary sorts the over-target items first; lift just those.',
      'A menu item with no recipe attached. It carries no food cost into the number, so your cost reads better than it is.'
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
          detail: 'Open Order History and pull the order for the incoming delivery. Confirm the products, quantities, and agreed prices before the driver is at the door.' },
        { kind: 'action', target: 'ic-receive-delivery', targetLabel: 'Receive Delivery',
          title: 'Count every case before you sign',
          detail: 'Log the delivery in Receive Delivery and count it against the order, line by line. A short count you do not catch at the door is a loss you already accepted.' },
        { kind: 'action', target: 'ic-receive-delivery', targetLabel: 'Receive Delivery',
          title: 'Check the invoiced prices as you receive',
          detail: 'As you receive, Bar Cop flags any invoiced price that moved off the last price you paid. Note any substitution before you sign. A lower-tier product billed at the premium price is an overcharge, not a swap.' },
        { kind: 'action', target: 'ic-receive-delivery', targetLabel: 'Receive Delivery',
          title: 'Flag any short count or wrong price at the dock',
          detail: 'When a line comes up short, damaged, or billed wrong, Flag it on the Receive Delivery line before the driver leaves. The flag files the claim with that delivery attached. If it turns up later, an invoice that lands after or a keg that pours flat, open the delivery in Delivery History and flag the line there.' },
        { kind: 'action', target: 'ic-receive-delivery', targetLabel: 'Receive Delivery',
          title: 'Chase the credit you are owed',
          detail: 'Open Receive Delivery and work the Credits to Chase list under the form. Open a claim to request the credit, which drafts the email to your rep, log a follow-up by phone or email when they go quiet, and mark it resolved with what you got back. Anything sitting too long flags as Follow Up Due. Get to the rep within 24 hours, claims age out fast.' },
        { kind: 'result', target: 'vendor-watch', targetLabel: 'Vendor Tracker',
          title: 'Read the line-by-line price drift Bar Cop is tracking',
          detail: 'Once a month, open Vendor Tracker\'s Price Changes tab: which product prices have drifted up and what that drift costs you a year.' },
        { kind: 'result', target: 'vendor-scorecard', targetLabel: 'Vendor Tracker',
          title: 'Bring the per-vendor rollup to a quarterly review',
          detail: 'Once a quarter, open Vendor Tracker\'s Scorecard tab for the per-vendor rollup: total spend, net price drift, short counts, open and recovered overcharges, days to credit, and a status (High, Watch, Clean). Export PDF and take it into the rep meeting. Ask for a price match or an explanation on every High and Watch line, and talk volume terms.' },
        { kind: 'reference', doc: 'vendor-terms', targetLabel: 'Vendor Agreement Terms Checklist',
          title: 'Confirm the terms in writing',
          detail: 'Within 48 hours of the review, download the Vendor Agreement Terms Checklist, fill in the pricing, substitution policy, and delivery terms you agreed to, and send it to your rep. If your only record is a phone call, you have no dispute.' }
      ]
    },

    commonMistakes: [
      'Signing for a delivery before counting it against the order. A short count you signed for is a loss you already accepted.',
      'Not flagging a short or a wrong price at the dock. The flag files the claim and ties it to the delivery; chasing it later is harder.',
      'Filing a discrepancy and never working it. The credit only comes back if you Request Credit and stay on the rep.',
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
          detail: 'Open This Week. Net sales come from Shift Control, labor from Labor Control, and COGS from Inventory Control, already filled in. Confirm them.' },
        { kind: 'result', target: 'dashboard', targetLabel: 'Profit Dashboard',
          title: 'Read prime cost every Monday',
          detail: 'Every Monday, open the Profit dashboard and read prime cost (total COGS plus labor over net sales) against your concept target. Read it weekly, not monthly. A 30-day lag is 30 days of loss before you see it.' },
        { kind: 'result', target: 'dashboard', targetLabel: 'Profit Dashboard',
          title: 'Find which part moved when it is over',
          detail: 'When prime cost is over, open the Fix Areas card. Bar Pour Cost, Food Cost, and Labor each carry their own status band and dollar gap. Decide whether the gap calls for an investigation today or a corrective action this week.' },
        { kind: 'result', target: 'this-week', targetLabel: 'This Week',
          title: 'Check spike against trend',
          detail: 'In This Week, read prime cost across the past weeks. Before you act, check whether this is a one-week spike from a bulk buy or a payroll correction, or a trend that has been building.' },
        { kind: 'result', target: 'weekly-pnl', targetLabel: 'Weekly P&L Brief',
          title: 'Pull your weekly P&L',
          detail: 'Each week, open your Weekly P&L Brief under Accounting. Bar Cop builds it from the weeks you confirm: revenue, COGS, labor, and prime cost broken out by bar and food, ready to file or hand your bookkeeper. Four of these are your month.' },
        { kind: 'result', target: 'books', targetLabel: 'Month-End Books',
          title: 'Review the month-end numbers',
          detail: 'Once a month, open Month-End Books and walk management through the four weeks together, cost line by cost line, skipping nothing. It is already built from your weekly rollups, so spend the meeting on decisions, not data entry. Set next month\'s cost-control priorities with a named owner on each.' }
      ]
    },

    commonMistakes: [
      'Reading a week you never confirmed. Confirm it in This Week first.',
      'Judging a week that is only half logged. A full period of COGS against partial sales reads high until the shifts and counts are in.',
      'Taking one week\'s spike as a trend. A bulk buy or a payroll correction throws a single week; This Week shows whether it is holding.',
      'Waiting for month-end to look. A 30-day lag is 30 days of loss before you see it, and 30 more before you know a fix worked.'
    ]
  }

];
