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
    summary: 'The gap between what you spent on bar product and what you sold. Measure it weekly, investigate variance, and hold the line with a written pour standard.',

    process: {
      intro: 'A working pour cost system has four parts that all have to run: a count on the same day every week, the pour cost calculated right after it, a variance report reviewed within 48 hours, and a written pour standard. The app does the counting and the math. Each step below opens the screen where that happens.',
      steps: [
        { kind: 'action', target: 'ic-product-setup', targetLabel: 'Products',
          title: 'Set accurate bottle yields',
          detail: 'In Inventory Control Products, enter every active product with its container size, pour size, and unit cost. The app turns that into pours per container and cost per pour, and pour cost is only as accurate as those numbers.' },
        { kind: 'action', target: 'ic-take-inventory', targetLabel: 'Take Inventory',
          title: 'Count on the same day every week',
          detail: 'Run a full count in Take Inventory on the same day each week. Count partial bottles with the bottle slider instead of estimating by eye. The count is what every pour cost number is built from.' },
        { kind: 'result', target: 'dashboard', targetLabel: 'Profit Dashboard',
          title: 'Read your actual pour cost',
          detail: 'There is nothing for you to calculate. The app works out pour cost from your counts and deliveries and shows it on the Profit dashboard, by category, against your target.' },
        { kind: 'action', target: 'ic-report-variance', targetLabel: 'Variance Report',
          title: 'Run the variance report',
          detail: 'The Variance Report compares what your count says you used against what the POS says you sold. Anything above the flag threshold is over-pouring, waste, theft, or unrecorded comps.' },
        { kind: 'result', target: 'reports', targetLabel: 'Reports and History',
          title: 'Review the numbers every week',
          detail: 'Once a week, check pour cost by category against target and read the variance report. The trend in Reports and History tells you whether the number is holding or drifting.' },
        { kind: 'reference', target: 'Measured_Pour_Standards_Policy.docx', targetLabel: 'Measured Pour Standards Policy',
          title: 'Put a written pour standard in place',
          detail: 'Download the Measured Pour Standards Policy, set your pour sizes, and have every staff member sign it before the effective date. A signed policy makes later corrective action a policy issue, not a personal one.' }
      ]
    },

    commonMistakes: [
      'Rounding bottle yield to a whole number. The 0.1-drink gap compounds across every product and quietly understates theoretical pour cost.',
      'Estimating partial bottles by eye instead of measuring them. A back bar with 40 open bottles builds a real error into every calculation.',
      'Counting purchases as invoices paid rather than product physically received in the period. One delivery on the wrong side of a count date throws the number off by a full case.',
      'Letting the count slip when a manager is out. The system dies from a missed cycle, not a bad number. Write the process down so it lives in paper, not people.',
      'Starting a variance investigation with a conversation instead of the data. Verify the count first. Many spikes turn out to be a counting error, not a person.'
    ],

    quickRef: {
      rhythm: [
        'Complete a full physical bar inventory count',
        'Read actual pour cost by category on the Profit dashboard',
        'Run the variance report and flag any product above 3%',
        'Review flagged products within 48 hours of the count',
        'Verify opening and closing counts were completed every shift',
        'Confirm the jigger policy was enforced with the floor manager'
      ],
      benchmarks: [
        { label: 'Spirits',          target: '18-24%', warning: '24-28%', critical: 'above 28%' },
        { label: 'Draft Beer',       target: '20-26%', warning: '26-30%', critical: 'above 30%' },
        { label: 'Bottled Beer',     target: '22-28%', warning: '28-32%', critical: 'above 32%' },
        { label: 'Wine',             target: '28-34%', warning: '34-38%', critical: 'above 38%' },
        { label: 'NA Beverages',     target: '15-22%', warning: '22-26%', critical: 'above 26%' },
        { label: 'Blended bar cost', target: '20-26%', warning: '26-28%', critical: 'above 28%' }
      ],
      escalation: [
        'Verify the count: pull the product count sheets across the full period and check every storage location for a missed partial or a unit-of-measure error.',
        'Calculate theoretical usage: POS sales by drink type times recipe ounces, compared to actual ounce movement.',
        'Identify which shifts drove the variance from the opening and closing counts.',
        'Talk to the bar manager about what they noticed on those shifts, such as breakage, waste, or unusual activity.',
        'Run an unannounced mid-shift count on the flagged product during a service period.',
        'Document the finding and resolution in writing before closing the investigation, even when it is inconclusive.'
      ]
    },

    aiWorkflows: [
      {
        id: 'pc-ai-1',
        title: 'Analyze the Weekly Variance Report',
        whatItDoes: 'Turns a week of variance data into the top three loss areas, their annualized dollar impact, and a probable operational cause for each.',
        prompt: 'Here is my variance report for the week ending [DATE]. Columns are: SKU name, theoretical usage (oz), actual usage (oz), variance (oz), variance (%). [PASTE DATA]. Identify the top three loss SKUs, calculate the annualized dollar impact of each at my weekly bar revenue of $[AMOUNT], and suggest one operational cause for each.',
        whatToPaste: 'Fill in [DATE], paste your variance report rows for [PASTE DATA], and put your weekly bar revenue in [AMOUNT].'
      },
      {
        id: 'pc-ai-2',
        title: 'Write the Measured Pour Staff Memo',
        whatItDoes: 'Drafts a short, positively framed staff memo introducing the jigger policy as an operational standard, not a punishment.',
        prompt: 'I am introducing a measured pour policy at my bar. All bartenders will now use jiggers for every spirit pour. Write a short staff memo (under 200 words) that introduces the policy, explains the reason in operational terms, frames it as a standard rather than a sign of distrust, and sets the start date as [DATE].',
        whatToPaste: 'Replace [DATE] with your effective date.'
      },
      {
        id: 'pc-ai-3',
        title: 'Build a Monthly Pour Cost Trend Summary',
        whatItDoes: 'Reads four weeks of category pour cost and flags which categories are trending up, holding, or improving.',
        prompt: 'Here are my weekly pour cost percentages for the past four weeks by category. Week 1: Spirits [X]%, Draft Beer [X]%, Bottled Beer [X]%, Wine [X]%. Week 2: [repeat]. Week 3: [repeat]. Week 4: [repeat]. Identify which categories are trending up, which are stable, and which improved. Flag any category that moved more than 2 points in either direction over the four weeks.',
        whatToPaste: 'Replace each [X] with your actual weekly category pour cost percentages.'
      },
      {
        id: 'pc-ai-4',
        title: 'Diagnose a Variance Spike on One SKU',
        whatItDoes: 'Walks a single flagged SKU through probable causes in order and tells you which records to pull to confirm each.',
        prompt: 'My variance report shows [SKU NAME] running [X]% above theoretical this week. Last week it was [X]%. The week before it was within normal range. My POS shows [X] units sold this week, my physical count shows [X] units used, and my delivery record shows [X] units received. Walk me through the most likely causes in order of probability and tell me what records to pull to confirm each one.',
        whatToPaste: 'Fill in the SKU name and the four bracketed numbers from your reports.'
      }
    ]
  },

  {
    id: 'theft-loss',
    name: 'Theft & Loss',
    module: 'profit',
    summary: 'Cash, product, and comp loss that never shows as a line item. Track voids and comps by employee, reconcile every drawer, audit shifts, and act on documented patterns.',

    process: {
      intro: 'Theft is caught by accountability, not suspicion. Daily logging creates the data, the weekly review reads it, and a written policy plus a paper trail make action possible when you need it. Each step opens the screen where it happens.',
      steps: [
        { kind: 'reference', target: 'Theft_Loss_Prevention_Policy.docx', targetLabel: 'Theft and Loss Prevention Policy',
          title: 'Set a written theft and loss policy',
          detail: 'Download the Theft and Loss Prevention Policy, set the cash, comp, and product rules, and have every staff member sign it at hire. It protects the business and every honest employee.' },
        { kind: 'action', target: 'sc-void-comp', targetLabel: 'Void and Comp Log',
          title: 'Log voids, comps, and no-sales by employee',
          detail: 'In Shift Control, log every void and comp against the employee who rang it. A blended total hides every pattern that matters, so the by-employee detail is the whole point.' },
        { kind: 'action', target: 'sc-variance-log', targetLabel: 'Variance Log',
          title: 'Reconcile every cash drawer',
          detail: 'In the Variance Log, count each drawer against expected POS cash at end of shift and log the direction. Consistent shorts and consistent overs are both signals.' },
        { kind: 'action', target: 'ic-receive-delivery', targetLabel: 'Receive Delivery',
          title: 'Inspect every delivery against the invoice',
          detail: 'Log each delivery in Receive Delivery and check it against the invoice before the driver leaves. The app flags price changes, and you catch short counts and substitutions.' },
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
      'Reviewing voids and comps as a blended total instead of by employee. A blended rate hides every individual pattern that matters.',
      'Treating all comps the same. A manager comp for service recovery and a bartender comp for a regular are different things and must be tracked separately.',
      'Skipping the delivery inspection when the truck arrives mid-service. That is exactly when short counts happen and are hardest to dispute later.',
      'Having no written comp authorization policy. A comp that needs no manager sign-off is an unauthorized expense you approved by silence.',
      'Acting on a single incident with no documentation. It creates legal exposure and rarely survives a dispute with an employee who denies it.',
      'Using behavioral indicators to accuse someone. They direct attention. They are not evidence.'
    ],

    quickRef: {
      rhythm: [
        'Daily: reconcile every cash drawer before it leaves the floor',
        'Daily: log all voids, comps, and no-sales by employee',
        'Daily: inspect any delivery against its invoice before the driver leaves',
        'Weekly: review void and comp rate by employee, flag anyone above benchmark',
        'Weekly: review drawer reconciliation history for recurring variance',
        'Weekly: run at least two shift audits on different shifts at varied times',
        'Weekly: document any incidents observed in writing before the week closes'
      ],
      benchmarks: [
        { label: 'Void rate (all staff)',     target: '0.5-1.5%', warning: 'above 2.5%', critical: 'above 4%' },
        { label: 'Void rate (per bartender)', target: 'under 1%',  warning: 'above 2%',   critical: 'above 4%' },
        { label: 'Comp rate (all staff)',     target: '1-2%',     warning: 'above 3%',   critical: 'above 5%' },
        { label: 'Comp rate (per bartender)', target: 'under 1.5%', warning: 'above 3%', critical: 'above 5%' },
        { label: 'No-sale transactions',      target: '0-2 / shift', warning: '5+ / shift', critical: '10+ / shift' },
        { label: 'Cash drawer variance',      target: 'under $5',  warning: '$10-$20 consistent', critical: '$25+ recurring' }
      ],
      escalation: [
        'Single incident: document it, increase oversight, do not act yet.',
        'Two incidents on the same employee within 30 days: issue written corrective action.',
        'Unexplained variance above 4% after a full investigation: escalate to a Profit Audit.',
        'Confirmed cash theft with documentation: consult legal before the termination conversation.',
        'Confirmed vendor short count: file a discrepancy report and dispute the invoice.',
        'Pattern of comps without manager approval: address it in writing and revoke comp authority if needed.'
      ]
    },

    aiWorkflows: [
      {
        id: 'tl-ai-1',
        title: 'Analyze Voids and Comps by Employee',
        whatItDoes: 'Finds the statistical outliers in a month of void and comp data and quantifies the dollar gap versus the group median, without drawing conclusions about intent.',
        prompt: 'Here is my void and comp data for the past 30 days by employee. Columns are: employee name, total sales, total voids, total comps, void rate %, comp rate %. [PASTE DATA]. Identify any employees running statistically above the group average, calculate the dollar value of their excess void and comp rate versus the group median, and flag any patterns by shift or day of week if visible. Do not draw conclusions about intent. Report only what the numbers show.',
        whatToPaste: 'Paste your by-employee void and comp table into [PASTE DATA].'
      },
      {
        id: 'tl-ai-2',
        title: 'Write the Void/Comp Tracking Staff Memo',
        whatItDoes: 'Drafts a matter-of-fact memo introducing void and comp tracking as standard practice, not a response to an incident.',
        prompt: 'I am introducing void and comp tracking by employee at my bar. Write a staff memo under 200 words that introduces the system, explains it is standard industry practice, frames it as a normal operational process rather than a sign of distrust, and confirms the start date of [DATE]. Tone should be matter-of-fact and professional with no accusatory language.',
        whatToPaste: 'Replace [DATE] with your start date.'
      },
      {
        id: 'tl-ai-3',
        title: 'Generate a Monthly Theft Risk Summary',
        whatItDoes: 'Turns scorecard indicators into a team risk summary and the top two employees for increased oversight, in pattern-based language.',
        prompt: 'Here is my employee theft risk scorecard data for [MONTH]. For each employee I scored these indicators 0-3: void rate trend, cash drawer consistency, shift audit observations, delivery involvement, peer reports. [PASTE SCORES]. Summarize the risk profile of the team, identify the top two employees for increased oversight, and suggest one specific management action for each. Frame everything as observable patterns, not conclusions about intent.',
        whatToPaste: 'Fill in [MONTH] and paste your scorecard values into [PASTE SCORES].'
      },
      {
        id: 'tl-ai-4',
        title: 'Write a Corrective Action Summary',
        whatItDoes: 'Produces a factual, file-ready corrective action paragraph from the incident facts.',
        prompt: 'I need to document a corrective action for an employee file. The facts: employee name [NAME], date of incident [DATE], shift [SHIFT], what was specifically observed [DESCRIPTION], which policy was violated [POLICY SECTION], prior written warnings [YES or NO and details]. Write a corrective action summary paragraph suitable for the employee file. Keep it factual and specific, with no editorializing or conclusions beyond what was directly observed.',
        whatToPaste: 'Fill in each bracketed field with the incident facts.'
      }
    ]
  },

  {
    id: 'food-cost',
    name: 'Food Cost',
    module: 'profit',
    summary: 'What the kitchen spends on product against what it sells. Cost every recipe on real prices, count weekly, track waste with reasons, and price surgically.',

    process: {
      intro: 'Food cost is set before service on the cost card and held during service at the station. The app costs the recipes and computes the number. The count, the waste sheet, and the portion audit tell you why it moved. Each step opens where the work happens.',
      steps: [
        { kind: 'action', target: 'recipe-library', targetLabel: 'Recipe Library',
          title: 'Build yield-adjusted recipe cost cards',
          detail: 'In Recipe Library, cost every menu item. Ingredient costs pull from your products, so proteins and produce are costed on real prices. Costing on purchase price without a yield adjustment understates every protein on the menu.' },
        { kind: 'action', target: 'ic-take-inventory', targetLabel: 'Take Inventory',
          title: 'Count food on the same weekly schedule as the bar',
          detail: 'Run a Kitchen or Full count in Take Inventory, the same day every week, valued at cost. The count is the foundation every food cost number depends on.' },
        { kind: 'result', target: 'dashboard', targetLabel: 'Profit Dashboard',
          title: 'Read your actual food cost',
          detail: 'The app works out food cost from your counts and deliveries and shows it on the Profit dashboard, by category, against target. There is nothing for you to calculate.' },
        { kind: 'reference', target: 'Daily_Food_Waste_Tracking.pdf', targetLabel: 'Daily Food Waste Sheet',
          title: 'Track waste daily with reason codes',
          detail: 'Print the Daily Food Waste Sheet and have every station log discarded product with a reason code. A count of what was thrown away tells you nothing. The reason code tells you what to change.' },
        { kind: 'reference', target: 'Portion_Control_Audit.pdf', targetLabel: 'Portion Control Audit',
          title: 'Run portion control audits',
          detail: 'Use the Portion Control Audit form on at least two stations a week at varied times, checked against the portion spec on each recipe card. Over-portioning is a standards gap, so treat findings as training.' },
        { kind: 'result', target: 'reports', targetLabel: 'Reports and History',
          title: 'Review weekly with the kitchen manager',
          detail: 'Each week, review food cost by category and the trend in Reports and History against the top waste categories and the portion findings. Set one specific action per problem category, with an owner.' },
        { kind: 'action', target: 'recipe-library', targetLabel: 'Recipe Library',
          title: 'Reprice the items above target',
          detail: 'When a category runs high, open Recipe Library and reprice the specific items flagged above their cost target. A surgical increase on those items is less visible to guests than an across-the-board raise.' }
      ]
    },

    commonMistakes: [
      'Building recipe cards once and never updating them. A card built at January prices is wrong by March, and the error compounds with every price move since.',
      'Costing proteins at purchase price without a yield adjustment. Every protein on the menu is understated until you cost on true cost per usable pound.',
      'Running a blended food cost instead of by category. A 34% blended number can hide a 48% seafood cost that has been invisible for months.',
      'Treating portion audit findings as a disciplinary issue. Over-portioning is almost always a standards gap, not a character gap.',
      'Logging waste without reason codes. A count of what was thrown away tells you nothing about why it happened or what to change.',
      'Raising prices across the board when food cost spikes. A surgical increase on the specific items above target is less visible and more effective.',
      'Having no written portion standards posted at stations. A verbal instruction given on day one is a memory that fades and drifts.'
    ],

    quickRef: {
      rhythm: [
        'Review the food waste log and identify the top three waste categories by dollar value',
        'Run a portion control audit on at least two stations',
        'Update recipe cost cards for any ingredients with invoice price changes',
        'Confirm daily waste sheets are using reason codes correctly',
        'Share the top waste categories with the kitchen manager, one action each',
        'Confirm specials are costed before service, not after'
      ],
      benchmarks: [
        { label: 'Proteins',          target: '28-34%', warning: '34-38%', critical: 'above 38%' },
        { label: 'Produce',           target: '22-28%', warning: '28-32%', critical: 'above 32%' },
        { label: 'Dairy and Eggs',    target: '18-24%', warning: '24-28%', critical: 'above 28%' },
        { label: 'Dry Goods',         target: '15-22%', warning: '22-26%', critical: 'above 26%' },
        { label: 'Bar Food',          target: '24-30%', warning: '30-34%', critical: 'above 34%' },
        { label: 'Blended food cost', target: '28-34%', warning: '34-36%', critical: 'above 36%' }
      ],
      escalation: [
        'Run the category breakdown to find which category is driving the blended number.',
        'Pull recent invoices for that category and check for ingredient price changes not yet in the cost cards.',
        'Re-cost the affected cards at current prices, with yield adjustment on proteins and produce.',
        'Run a portion audit on the stations producing that category.',
        'Review the waste log for that category and read the reason codes.',
        'If cost is still above target, decide between a surgical price increase and a recipe modification.'
      ]
    },

    aiWorkflows: [
      {
        id: 'fc-ai-1',
        title: 'Build a Recipe Cost Card',
        whatItDoes: 'Costs a menu item from an ingredient list, yield-adjusted, with food cost % at your price and the minimum price to hit target.',
        prompt: 'I need to cost a menu item called [ITEM NAME]. Here are the ingredients with purchase units and current purchase prices: [LIST]. The recipe uses these quantities per portion: [LIST RECIPE QUANTITIES]. Assume a waste factor of [X]% on proteins and [X]% on produce. Calculate total cost per portion, food cost percentage at my current menu price of $[PRICE], and the minimum menu price to hit a [TARGET]% food cost. Show your work on yield-adjusted costs for protein and produce items.',
        whatToPaste: 'Fill in the item name, ingredient list, recipe quantities, waste factors, current price, and target.'
      },
      {
        id: 'fc-ai-2',
        title: 'Analyze the 30-Day Waste Log',
        whatItDoes: 'Finds the top waste categories by dollar value, annualizes them, and suggests one specific operational change per category from the reason codes.',
        prompt: 'Here is my food waste log for the past 30 days. Columns: date, item, quantity wasted, unit, reason code, dollar value, station. [PASTE DATA]. Identify the top three waste categories by total dollar value, calculate what each costs annually at this run rate, and for each category identify the most common reason code and suggest one specific operational change based on it. Do not suggest general improvements. Give one specific change per category.',
        whatToPaste: 'Paste your 30-day waste log into [PASTE DATA].'
      },
      {
        id: 'fc-ai-3',
        title: 'Find Menu Items Below Food Cost Target',
        whatItDoes: 'Flags every menu item above its category target and calculates the minimum price increase to fix it.',
        prompt: 'Here are my recipe cost cards with current food cost percentages. [LIST MENU ITEMS WITH CURRENT FOOD COST % AND MENU PRICE]. My target food cost by category is: proteins [X]%, produce [X]%, dry goods [X]%. Identify all items above their category target. For each, calculate the minimum price increase to hit target without rounding up more than $1. Flag any item where hitting target needs an increase above $2. Those need a separate decision about recipe modification versus price change.',
        whatToPaste: 'Paste your menu items with food cost % and price, and fill in the category targets.'
      },
      {
        id: 'fc-ai-4',
        title: 'Write the Weekly Food Cost Summary',
        whatItDoes: 'Drafts a short, direct weekly summary for the kitchen manager with one named priority action.',
        prompt: 'Here is this week\'s food cost data. Total food sales: $[AMOUNT]. Total food cost: $[AMOUNT]. Food cost by category: [LIST CATEGORIES WITH DOLLAR AMOUNTS]. Top three waste items this week with reason codes: [LIST]. Portion audit findings this week: [NOTES]. Write a brief weekly summary under 150 words for my kitchen manager covering what improved from last week, what is still above target, and one priority action for next week with a specific owner named. Direct and operational tone, not congratulatory.',
        whatToPaste: 'Fill in the sales and cost figures, category amounts, waste items, and audit notes.'
      }
    ]
  },

  {
    id: 'vendor-control',
    name: 'Vendor Control',
    module: 'profit',
    summary: 'Price drift, short counts, and quiet substitutions on every invoice. Audit each delivery against the PO, track prices monthly, and renegotiate quarterly with the data.',

    process: {
      intro: 'Vendor overcharge recovery is an ongoing weekly job, not a one-time audit. Every discrepancy you document at delivery is a credit you can request. Every one you miss is a cost you absorbed. The app flags price changes the moment you receive a delivery and tracks the drift over time. Each step below opens the screen where that happens.',
      steps: [
        { kind: 'action', target: 'ic-order-history', targetLabel: 'Order History',
          title: 'Know what you ordered before the truck arrives',
          detail: 'Open Order History and pull the order for the incoming delivery. You cannot audit a delivery against an order you do not have in front of you, so confirm the products, quantities, and agreed prices before the driver is at the door.' },
        { kind: 'action', target: 'ic-receive-delivery', targetLabel: 'Receive Delivery',
          title: 'Count every case before you sign',
          detail: 'Log the delivery in Receive Delivery and count it against the order, line by line. A short count not caught at the door is a loss you already accepted. It does not get recovered later.' },
        { kind: 'action', target: 'ic-receive-delivery', targetLabel: 'Receive Delivery',
          title: 'Check the invoiced prices as you receive',
          detail: 'As you receive, the app compares each invoiced price against the last price you paid and flags anything that moved. Note any substitution before you sign. A lower-tier product billed at the premium price is an overcharge, not a substitution.' },
        { kind: 'action', target: 'vendor-discrepancy', targetLabel: 'Vendor Discrepancies',
          title: 'File a discrepancy on any variance',
          detail: 'When a delivery is short or a price is wrong, open Vendor Discrepancies and file it: vendor, type, product, agreed price, invoiced price, and the total overcharge. Get it to your rep within 24 hours, discrepancies age out fast. The screen tracks each one from open to credit requested to resolved, and totals what is still owed to you.' },
        { kind: 'result', target: 'vendor-watch', targetLabel: 'Vendor Watch',
          title: 'Read the price drift the app is tracking',
          detail: 'Vendor Watch reads every delivery you receive and surfaces which vendor prices have drifted up and what that drift costs you per year. There is no price tracker to keep by hand. Check it once a month.' },
        { kind: 'result', target: 'vendor-watch', targetLabel: 'Vendor Watch',
          title: 'Bring the data to a quarterly vendor review',
          detail: 'Once a quarter, sit down with your rep and the Vendor Watch numbers in hand. Ask for a price match or an explanation on every item that drifted, and talk volume terms. A documented price increase is hard for a rep to wave off.' },
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
    ],

    quickRef: {
      rhythm: [
        'Every delivery: pull the order, count every case, check the invoiced prices',
        'Every delivery: log the delivery and inspection in Receive Delivery before the driver leaves',
        'On any variance: file a discrepancy report and contact the rep within 24 hours',
        'Monthly: review the price drift the app surfaced in Vendor Watch',
        'Monthly: flag any item up more than 5% since last quarter or cheaper elsewhere',
        'Quarterly: run the vendor review with the documented drift data in hand',
        'Quarterly: confirm pricing and substitution terms in writing within 48 hours'
      ],
      benchmarks: [
        { label: 'Invoice price vs order',         target: 'matches order', warning: 'up to 2% over',  critical: 'above 2% over' },
        { label: 'Price drift per quarter',        target: 'flat',          warning: 'up to 5%',       critical: 'above 5%' },
        { label: 'Alternative-vendor gap',         target: 'in line',       warning: '5-8% cheaper',   critical: '8%+ cheaper elsewhere' },
        { label: 'Cumulative overcharge per vendor', target: '$0',          warning: 'under $500 / qtr', critical: '$500+ / qtr' }
      ],
      escalation: [
        'Pull the order and the invoice and compare them line by line for the flagged delivery.',
        'File a vendor discrepancy report: SKU, agreed price, invoiced price, and total overcharge.',
        'Contact your rep within 24 hours of the delivery. Discrepancies age out fast.',
        'Request a credit memo for the full overcharge with a specific response deadline.',
        'Log the variance so the pattern is visible in Vendor Watch at the quarterly review.',
        'If overcharges recur after the dispute, renegotiate terms or move the category to another vendor.'
      ]
    },

    aiWorkflows: [
      {
        id: 'vc-ai-1',
        title: 'Calculate Cumulative Overcharge by Vendor',
        whatItDoes: 'Reads a quarter of invoice audit data and totals the overcharge by vendor, flags the worst SKUs, and projects the annual cost.',
        prompt: 'Here is my invoice audit data for the past quarter. Columns: vendor name, SKU, PO price, invoiced price, variance per unit, quantity, total variance. [PASTE DATA]. Calculate cumulative overcharge by vendor, identify which SKUs have the most consistent variance across deliveries, project the annual overcharge at this run rate, and flag any vendor where cumulative overcharge exceeds $500 for the quarter.',
        whatToPaste: 'Paste your quarter of invoice audit rows into [PASTE DATA].'
      },
      {
        id: 'vc-ai-2',
        title: 'Draft a Vendor Dispute Letter',
        whatItDoes: 'Writes a direct, factual dispute letter requesting a credit memo for a documented overcharge.',
        prompt: 'I need to dispute a price variance with my vendor [VENDOR NAME]. Details: SKU [NAME], agreed price $[AMOUNT], invoiced price $[AMOUNT], quantity [NUMBER], total overcharge $[AMOUNT], delivery date [DATE], invoice number [NUMBER]. Write a professional dispute letter requesting a credit memo for the full overcharge amount. Direct and factual tone, not adversarial. Include a specific deadline for the credit memo response.',
        whatToPaste: 'Fill in the vendor, SKU, prices, quantity, overcharge, date, and invoice number.'
      },
      {
        id: 'vc-ai-3',
        title: 'Build a Quarterly Vendor Review Agenda',
        whatItDoes: 'Turns a quarter of purchase history into a printable review agenda with talking points, questions, and target outcomes.',
        prompt: 'I am preparing for my quarterly review with [VENDOR NAME]. Here is my purchase history for the quarter: total spend $[AMOUNT], top 5 SKUs by spend [LIST WITH AMOUNTS], invoice variances found [LIST], substitutions received [LIST], quality issues [NOTES]. Build a structured meeting agenda with talking points for each item, specific questions to ask, and a target outcome for each agenda item. Format it so I can print it and bring it to the meeting.',
        whatToPaste: 'Fill in the vendor and the quarter\'s spend, SKUs, variances, substitutions, and quality notes.'
      },
      {
        id: 'vc-ai-4',
        title: 'Identify Price Drift on a SKU',
        whatItDoes: 'Reads six months of invoiced prices for one SKU and reports the drift trend, total increase, and cumulative overcharge.',
        prompt: 'Here are my invoiced prices for [SKU NAME] over the past six months, one entry per delivery: [LIST DATES AND PRICES]. Identify the trend direction, calculate the total price increase over the period as a percentage, determine whether it is gradual drift or step changes at specific dates, tell me at what point the price first moved above my original quoted rate of $[AMOUNT], and express the cumulative overcharge in dollars based on my average weekly order volume of [QUANTITY].',
        whatToPaste: 'Fill in the SKU, the dated price list, your original quoted rate, and weekly order volume.'
      }
    ]
  },

  {
    id: 'prime-cost',
    name: 'Prime Cost',
    module: 'profit',
    summary: 'COGS plus labor as a share of sales. The single number that confirms whether your other cost systems are working. Read it weekly, find the driver when it moves, act before the next week starts.',

    process: {
      intro: 'Prime cost is an operations metric, not a finance metric. It is the one number that tells you whether pour cost, food cost, and labor control are actually working. The app pulls the inputs from your Control modules and computes it for you. Read it weekly, on Monday, in fifteen minutes. Each step below opens where that happens.',
      steps: [
        { kind: 'action', target: 'this-week', targetLabel: 'This Week',
          title: 'Confirm the week\'s inputs',
          detail: 'Open This Week. Net sales come from Shift Control, labor from Labor Control, and COGS from Inventory Control, already filled in. Confirm them. Prime cost is only as honest as the numbers feeding it, so an unconfirmed week is a prime cost you cannot trust.' },
        { kind: 'result', target: 'dashboard', targetLabel: 'Profit Dashboard',
          title: 'Read prime cost every Monday',
          detail: 'The app works out prime cost as total COGS plus total labor over net sales, food and beverage kept separate, and shows it on the Profit dashboard against your concept target. There is nothing for you to calculate. Read it weekly, not monthly. A 30-day lag is 30 days of loss before you see it.' },
        { kind: 'result', target: 'dashboard', targetLabel: 'Profit Dashboard',
          title: 'Find which part moved when it is over',
          detail: 'The dashboard breaks prime cost into its parts: bar pour cost, food cost, and labor, each dollar-quantified. The number tells you it moved. The parts tell you where. Decide before the week starts whether the gap is enough to open an investigation or a corrective action today.' },
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
      'Calculating prime cost monthly instead of weekly. A 30-day lag means 30 days of compounding loss before you see it, and 30 more before you know the fix worked.',
      'Excluding payroll taxes and benefits from labor. Real labor cost runs 10 to 15% above wages alone, and a wages-only number understates the problem every week.',
      'Using gross sales instead of net sales as the denominator. Comps and discounts left in make prime cost look better than it is.',
      'Not separating COGS into food and beverage. A blended COGS number hides which side is the problem and sends you looking in the wrong place.',
      'Treating prime cost as a finance metric. It belongs in the weekly management meeting, not the monthly P&L review.',
      'Acting on a single week\'s spike before checking the data. A miscoded payroll run or a one-time bulk purchase produces a false spike.'
    ],

    quickRef: {
      rhythm: [
        'Pull prior-week net sales (after comps and discounts), COGS by category, and total labor',
        'Read prime cost on the dashboard and compare it to target and to last week',
        'If above target, identify whether COGS or labor is the driver',
        'If COGS, isolate the category; if labor, isolate the shifts or departments',
        'Assign an investigation or corrective action before the week starts',
        'File the weekly P&L snapshot',
        'Once a month, review the four weeks together and set named priorities'
      ],
      benchmarks: [
        { label: 'Bar-heavy concept',           target: '48-55%', warning: '55-60%', critical: 'above 60%' },
        { label: 'Full-service bar & restaurant', target: '55-60%', warning: '60-65%', critical: 'above 65%' },
        { label: 'Fast casual',                  target: '55-62%', warning: '62-67%', critical: 'above 67%' },
        { label: 'High-volume nightlife',        target: '42-50%', warning: '50-56%', critical: 'above 56%' },
        { label: 'Craft cocktail bar',           target: '50-58%', warning: '58-63%', critical: 'above 63%' }
      ],
      escalation: [
        'Verify the data first. Net sales truly net of comps, labor including taxes. A miscode produces a false spike.',
        'Split the move: did COGS or labor drive the change versus last week?',
        'If COGS, isolate food versus beverage, then drill to the category.',
        'If labor, isolate which shifts or departments ran over their hours.',
        'Check for one-time events: a bulk purchase or a payroll correction landing in the week.',
        'Decide whether this is a structural problem or a one-week anomaly before acting.'
      ]
    },

    aiWorkflows: [
      {
        id: 'pr-ai-1',
        title: 'Calculate Prime Cost vs. Concept Benchmark',
        whatItDoes: 'Calculates prime cost from your weekly inputs, compares it to your concept target, and says whether COGS or labor is the larger driver.',
        prompt: 'Here is my data for the week ending [DATE]. Net sales: $[AMOUNT]. Food cost: $[AMOUNT]. Beverage cost: $[AMOUNT]. Paper and supplies: $[AMOUNT]. Total wages: $[AMOUNT]. Payroll taxes and benefits: $[AMOUNT]. My concept is a [CONCEPT TYPE] and my target prime cost is [TARGET]%. Calculate my prime cost percentage, compare it to target and calculate the dollar value of the gap, tell me whether COGS or labor is the larger driver of any variance, and show your math.',
        whatToPaste: 'Fill in the week\'s sales and cost figures, your concept type, and target.'
      },
      {
        id: 'pr-ai-2',
        title: 'Diagnose a Prime Cost Spike',
        whatItDoes: 'Walks a week-over-week prime cost jump through probable causes in order and names the exact data to pull for each.',
        prompt: 'My prime cost moved from [X]% to [Y]% this week. Component changes: food cost [X]% to [Y]%, beverage cost [X]% to [Y]%, labor [X]% to [Y]%. Net sales this week: $[AMOUNT] versus $[AMOUNT] last week. Walk me through the most likely cause of the spike in order of probability and tell me exactly what data to pull to confirm each one. Do not suggest general improvements. Suggest specific things to check, in order.',
        whatToPaste: 'Fill in this week and last week\'s prime cost, component percentages, and net sales.'
      },
      {
        id: 'pr-ai-3',
        title: 'Build a Four-Week Prime Cost Trend',
        whatItDoes: 'Calculates four weeks of prime cost, finds the trend and the biggest mover, and judges structural problem versus one-week anomaly.',
        prompt: 'Here are my weekly prime cost inputs for the past four weeks. For each week: net sales, food cost, beverage cost, labor. [PASTE DATA]. Calculate prime cost for each week, identify the trend direction, flag which component has moved the most over the four weeks, and tell me whether this looks like a structural problem or a one-week anomaly and what data to pull to confirm. My concept target is [TARGET]%.',
        whatToPaste: 'Paste four weeks of inputs into [PASTE DATA] and fill in your target.'
      },
      {
        id: 'pr-ai-4',
        title: 'Write the Monthly Cost Control Summary',
        whatItDoes: 'Drafts a direct monthly review summary for management with three named priorities for next month.',
        prompt: 'Here is my prime cost data for the past month by week: [PASTE WEEKLY DATA]. Top three cost control actions we took this month: [LIST]. Results from last month\'s priority actions: [NOTES]. Write a brief monthly review summary under 200 words for my management team covering what the numbers showed, what we did about it, and three priorities for next month with a named owner for each. Direct and operational tone, not encouraging, not congratulatory.',
        whatToPaste: 'Paste the weekly data, this month\'s actions, and last month\'s results.'
      }
    ]
  }

];
