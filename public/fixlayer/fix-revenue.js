'use strict';

/* ── Fix Layer content — Revenue Recovery ─────────────────────────────────────
   Static fix content for the Revenue gap-areas (Section 9). Rendered by
   FixPanel inside Revenue Recovery's Help & FAQ. Populated gap-area by
   gap-area; see fix-profit.js for the object shape. */

window.FIX = window.FIX || {};

FIX.revenue = [

  {
    id: 'menu-engineering',
    name: 'Menu Engineering',
    module: 'revenue',
    summary: 'Every menu item is a Star, Plowhorse, Puzzle, or Dog. Classify them by contribution margin and volume, then reposition, reprice, and brief servers off the result.',

    process: {
      intro: 'Menu engineering plots every item on two axes: contribution margin in dollars, not food cost percent, and sales volume. That puts every item in one of four quadrants. Stars are high margin and high volume. Plowhorses are low margin and high volume. Puzzles are high margin and low volume. Dogs are low margin and low volume. Each quadrant gets a different action. The app plots the quadrant for you. Each step below opens where the work happens.',
      steps: [
        { kind: 'action', target: 'r-menu-items', targetLabel: 'Menu Items',
          title: 'Set up the menu data',
          detail: 'In Menu Items, enter every item with its name, category, current price, and yield-adjusted food cost. The quadrant is only as accurate as this catalog, so refresh an item\'s cost whenever a supplier price moves more than 5%.' },
        { kind: 'result', target: 'r-menu-engineering', targetLabel: 'Menu Engineering',
          title: 'Read the quadrant every quarter',
          detail: 'Menu Engineering plots every item into Stars, Plowhorses, Puzzles, and Dogs, sorted on contribution margin in dollars and sales volume. The percentage tells you structural efficiency. The dollar margin tells you what the item is actually worth. Re-read it the first week of January, April, July, and October.' },
        { kind: 'reference', target: 'Menu_Engineering_Audit.pdf', targetLabel: 'Menu Engineering Review Worksheet',
          title: 'Work the quadrant decisions on the worksheet',
          detail: 'Download the Menu Engineering Review Worksheet and record a decision for every item. Move Stars and high-margin Puzzles into prime menu positions. Give each Dog a 90-day test in a repositioned slot with a rewritten description before you pull it. Some Dogs are buried items with a description problem, not bad items.' },
        { kind: 'action', target: 'r-menu-items', targetLabel: 'Menu Items',
          title: 'Reprice the Plowhorses',
          detail: 'Back in Menu Items, apply the price changes to the Plowhorses one item at a time. A targeted $2 increase on five Plowhorses is far less visible to guests than a 6% increase across the whole menu.' },
        { kind: 'reference', target: 'PreShift_Upsell_Briefing.pdf', targetLabel: 'Pre-Shift Upsell Briefing',
          title: 'Brief servers off the Stars list',
          detail: 'Positioning and pricing only produce results when servers know what to suggest and why. Print the Pre-Shift Upsell Briefing and build it off the current Stars list. Every item you feature in the briefing comes from that list.' }
      ]
    },

    commonMistakes: [
      'Running the analysis on food cost percentage instead of contribution margin dollars. The percentage is structural efficiency. The dollar amount is what the item is worth.',
      'Engineering the menu once and treating it as done. Costs move and seasons shift, and a January menu can have three items below floor by August.',
      'Removing Dogs without a 90-day test in a repositioned slot. Some Dogs are buried items with a description problem, not bad items.',
      'Leaving Stars in mid-menu positions because they sell anyway. A Star in a prime position with server promotion typically lifts orders 15 to 25%.',
      'Announcing price increases across the board instead of surgically. A targeted increase on a few Plowhorses is far less visible than a blanket raise.',
      'Running menu engineering without connecting it to the server briefing. Positioning and pricing only work when servers know what to suggest.'
    ],

    quickRef: {
      rhythm: [
        'Confirm every item in the menu data has name, category, price, and yield-adjusted food cost %',
        'Re-read the engineering matrix with the latest weekly sales counts in',
        'Review the quadrant output and note which Stars are not in prime menu positions',
        'Sort by contribution margin dollars and flag every Plowhorse for a pricing review',
        'List every Dog with a 90-day test or remove decision before the review closes',
        'Refresh ingredient costs for any item whose supplier price moved more than 5%',
        'Update the pre-shift briefing list from the current Stars'
      ],
      escalation: [
        'Calculate the price floor: ingredient cost divided by target food cost %.',
        'Run the price sensitivity calculation at the proposed new price.',
        'Confirm the break-even volume is at least 20% below current weekly volume.',
        'Log the change with its date and reason in a pricing tracker.',
        'Update the item description to support the new price if needed.',
        'Brief servers on the change before the new menu goes live.'
      ]
    },

    aiWorkflows: [
      {
        id: 'me-ai-1',
        title: 'Run a Full Menu Engineering Analysis',
        whatItDoes: 'Classifies every menu item into the four quadrants by contribution margin and volume, with a reprice target for each Plowhorse and the annual cost of each Dog.',
        prompt: 'Here is my menu item data. For each item: name, category, current price, ingredient cost (yield-adjusted), weekly sales count. [PASTE DATA]. My target food cost by category: food [X]%, bar [X]%, cocktails [X]%. Calculate contribution margin in dollars for every item, classify each as Star, Plowhorse, Puzzle, or Dog based on margin relative to category average and volume relative to category average, and list Stars first, then Plowhorses, Puzzles, Dogs. For each Plowhorse show the price increase needed to move it to Star margin territory. For each Dog show the annual margin cost of keeping it at current volume.',
        whatToPaste: 'Paste your menu item table into [PASTE DATA] and fill in the category food cost targets.'
      },
      {
        id: 'me-ai-2',
        title: 'Write Menu Descriptions for Your Stars',
        whatItDoes: 'Drafts tight, specific menu descriptions for your top Stars, each with a beverage pairing.',
        prompt: 'I need updated menu descriptions for my top Stars. For each item I will provide: name, key ingredients, preparation method, and one beverage pairing. [PASTE ITEM DETAILS]. Write a menu description for each under 22 words, including the preparation method, one specific ingredient detail, and the beverage pairing. No filler. No "fresh", "delicious", or "house-made" unless followed by a specific detail. Format: item name on one line, description on the next.',
        whatToPaste: 'Paste each Star with its ingredients, prep method, and pairing into [PASTE ITEM DETAILS].'
      },
      {
        id: 'me-ai-3',
        title: 'Pick This Week\'s Pre-Shift Features',
        whatItDoes: 'Selects the two best Stars to feature this week and writes one line of server briefing language for each.',
        prompt: 'Here is my current menu engineering quadrant output. [PASTE STARS LIST WITH MARGIN AND WEEKLY SALES]. My current team check average target is $[X]. Select the two best items to feature in this week\'s pre-shift briefing — criteria: highest contribution margin, reasonable server suggestion comfort, and a beverage pairing that supports the check average target. For each selected item, write one sentence of server briefing language.',
        whatToPaste: 'Paste your Stars list and fill in the check average target.'
      },
      {
        id: 'me-ai-4',
        title: 'Model Moving Items to Their Price Floor',
        whatItDoes: 'Models the annual revenue impact of repricing below-floor items at three volume scenarios, with break-even volume and a proceed recommendation.',
        prompt: 'I have three items currently priced below their contribution margin floor. For each: item name, current price, floor price, current weekly sales volume. [PASTE DATA]. Model the annual revenue impact of moving each item to its floor price at three volume scenarios: flat, down 10%, down 15%. Show the break-even volume for each item at the new price, and recommend whether to proceed based on current volume versus break-even.',
        whatToPaste: 'Paste the three items with current price, floor price, and weekly volume.'
      }
    ]
  },

  {
    id: 'pricing',
    name: 'Pricing',
    module: 'revenue',
    summary: 'Most menus are priced by feel and drift below cost as ingredients rise. Build every price from a cost floor, flag below-floor items, and correct them surgically each quarter.',

    process: {
      intro: 'Price from the math, not the gut. The cost floor tells you what a price needs to be. The competition tells you what the market accepts. Those are two different numbers for two different decisions. A menu priced once at opening drifts below floor inside 18 months, so this is a quarterly job. The app holds your costs and prices and shows you cost percent per item. Each step below opens where the work happens.',
      steps: [
        { kind: 'action', target: 'r-menu-items', targetLabel: 'Menu Items',
          title: 'Keep ingredient costs current',
          detail: 'In Menu Items, refresh the yield-adjusted ingredient cost on every item whenever a supplier price moves. A protein priced on raw purchase cost is understated until trim loss is in it. Cost percent is only honest when the cost behind it is current.' },
        { kind: 'result', target: 'r-menu-items', targetLabel: 'Menu Items',
          title: 'Read which items are priced below their floor',
          detail: 'Menu Items shows each item\'s cost percent and contribution margin against your category target. An item running well over its target cost percent is priced below its floor. The worst offenders are the biggest annual margin leaks, so start there.' },
        { kind: 'result', target: 'r-menu-engineering', targetLabel: 'Menu Engineering',
          title: 'Weigh the margin dollars before you reprice',
          detail: 'Open Menu Engineering and read the contribution margin in dollars on the items you flagged. The percentage tells you the item is underpriced. The dollar margin and the volume tell you how much a correction is actually worth.' },
        { kind: 'action', target: 'r-menu-items', targetLabel: 'Menu Items',
          title: 'Reprice the flagged items surgically',
          detail: 'Correct the flagged items one at a time, during a routine menu update. A blanket increase reads as a price event and draws guest attention. Surgical item-by-item changes rarely produce feedback. Each category carries its own target, so price spirits, cocktails, beer, wine, and food each on their own math.' },
        { kind: 'reference', target: 'Quarterly_Pricing_Review.pdf', targetLabel: 'Quarterly Pricing Review Checklist',
          title: 'Run the full pricing review every quarter',
          detail: 'Download the Quarterly Pricing Review checklist and work it the first week of each quarter. It refreshes costs, lists the items to reprice and the items to remove, sets the menu print date, and confirms servers were briefed on the changes before the new menu goes live.' }
      ]
    },

    commonMistakes: [
      'Setting prices once at opening and never reviewing them on a schedule. Costs change quarterly and a menu drifts below floor within 18 months.',
      'Pricing by competition without calculating your own cost floor first. Competitor prices say what the market accepts. Your floor says what you need.',
      'Raising all prices at once in a visible refresh. A blanket increase reads as a price event. Surgical item-by-item increases rarely draw feedback.',
      'Not yield-adjusting ingredient costs before setting floors. A protein at 30% on raw purchase cost is really 38% once trim loss is included.',
      'Treating the competitive price as a ceiling. If your floor is $16.50 and competitors charge $18, that is $1.50 of pricing room left on every plate.',
      'Skipping the price sensitivity check on a high-volume item. Knowing the break-even volume before you change the price is what makes the decision confident.'
    ],

    quickRef: {
      rhythm: [
        'Refresh costs in Menu Items for every item whose ingredient cost moved since last review',
        'Flag every item running over its target cost percent',
        'Run each flagged Plowhorse through the sensitivity calculator at a $1.50-$3 increase',
        'List items to reprice, items to remove, and items needing new cost cards',
        'Close the review with a written action list and a target menu print date',
        'Update ingredient costs in the menu data whenever supplier prices change'
      ],
      escalation: [
        'Supplier price increase above 8% on any item: recalculate the floor before the next service.',
        'New item added to the menu: cost card and floor calculation required before it prints.',
        'Food cost moves 3+ points above target in a single weekly review: run a pricing review now.',
        'A category review shows more than 20% of items below their margin floor: review the category.',
        'Staff report consistent guest pushback on a specific item\'s price: re-run that item\'s numbers.'
      ]
    },

    aiWorkflows: [
      {
        id: 'pr-ai-1',
        title: 'Calculate Price Floors Across the Full Menu',
        whatItDoes: 'Runs the floor calculation on every item, flags everything below floor, and sorts the flagged list by annual margin impact.',
        prompt: 'Here is my current menu with ingredient costs and current prices. For each item: item name, ingredient cost (yield-adjusted), current price, category. [PASTE DATA]. My target food cost by category: spirits 22%, cocktails 26%, draft beer 24%, wine by glass 30%, food 30%. Calculate the price floor for each item at its category target, flag every item where the current price is below the floor, show the gap in dollars and as a percentage, and sort flagged items by annual margin impact at current weekly volume.',
        whatToPaste: 'Paste your menu with yield-adjusted costs, prices, and categories into [PASTE DATA]; adjust the category targets to yours.'
      },
      {
        id: 'pr-ai-2',
        title: 'Write Descriptions for High-Margin Items',
        whatItDoes: 'Drafts tight, specific menu descriptions that support a higher price point, each with a beverage pairing.',
        prompt: 'I need menu descriptions for [NUMBER] items. For each item: name, key ingredients, preparation method, and one beverage pairing suggestion. [PASTE ITEM DETAILS]. Write a menu description for each under 22 words including the preparation method, one specific ingredient detail, and the beverage pairing. No filler. No "fresh", "delicious", "to perfection", or "house-made" unless followed by a specific detail. Format: item name, then description on the next line.',
        whatToPaste: 'Fill in the item count and paste each item\'s ingredients, prep method, and pairing.'
      },
      {
        id: 'pr-ai-3',
        title: 'Model the Cost of Never Raising Prices',
        whatItDoes: 'Projects five years of margin loss from flat pricing against rising costs, then the same with a managed quarterly review.',
        prompt: 'My current annual revenue is $[AMOUNT], my current average food cost percentage is [X]%, and my sales split is [BAR]% bar and [FOOD]% food. Assume ingredient costs increase [Y]% per year for five years with no price changes. Calculate my food cost percentage each year, the annual margin lost versus the current baseline, and the cumulative five-year margin loss. Then show the same calculation with a quarterly pricing review that makes targeted adjustments to hold my current food cost percentage.',
        whatToPaste: 'Fill in revenue, current food cost %, the bar/food split, and an annual cost-inflation assumption.'
      },
      {
        id: 'pr-ai-4',
        title: 'Draft a Seasonal Item with Pricing Rationale',
        whatItDoes: 'Creates a seasonal menu item: name, description, and a floor-based recommended price with a server briefing line.',
        prompt: 'I want to add a seasonal cocktail for [SEASON/OCCASION]. Key ingredients: [LIST]. My cost for the ingredients is approximately $[COST] per drink and my target beverage cost is 24%. Write a menu name, a description under 18 words, a recommended price based on my cost floor, and one sentence of server training language for the pre-shift briefing.',
        whatToPaste: 'Fill in the season/occasion, ingredient list, and per-drink cost.'
      }
    ]
  },

  {
    id: 'labor-scheduling',
    name: 'Labor Cost & Scheduling',
    module: 'revenue',
    summary: 'Build the schedule from a revenue forecast, not from last week. Budget labor in hours per department, staff to the budget, and review actuals every Monday.',

    process: {
      intro: 'A schedule built before the revenue number is checked is built on habit. A schedule built from a revenue forecast is a plan. The difference shows up in your labor percentage every week. Build Schedule in Labor Control turns a forecast into a labor budget in hours, so the math is done before you write a single name. Each step below opens where the work happens.',
      steps: [
        { kind: 'action', target: 'lc-build-schedule', targetLabel: 'Build Schedule',
          title: 'Start the schedule from a revenue forecast',
          detail: 'Open Build Schedule in Labor Control and enter the coming week\'s revenue forecast by day and daypart. The screen turns the forecast into a labor budget in hours for each department. That budget is the input the whole schedule is built from, so set it before you write a single name.' },
        { kind: 'action', target: 'lc-build-schedule', targetLabel: 'Build Schedule',
          title: 'Staff to the budget, department by department',
          detail: 'Fill must-have coverage first, then build out to the budgeted hours. Build Schedule flags any shift that runs more than 5% over budget. Bar, kitchen, and floor have different labor economics, so budget and watch each one on its own. A blended number lets one department running over hide behind the others.' },
        { kind: 'action', target: 'lc-overtime-watch', targetLabel: 'Overtime Watch',
          title: 'Clear projected overtime before you post',
          detail: 'Overtime Watch shows who is heading into overtime on the schedule you just built. Almost all overtime is hours concentrated on too few employees, not a need for more total hours. Redistribute the concentrated hours to under-scheduled staff before the schedule goes out.' },
        { kind: 'result', target: 'lc-weekly-summary', targetLabel: 'Weekly Summary',
          title: 'Read labor cost on total labor',
          detail: 'After the week, Weekly Summary shows labor cost percent by department against target. It is built on total labor, wages plus payroll taxes and employer benefits, which runs 10 to 15% above wages alone. A wages-only number understates the problem every week.' },
        { kind: 'reference', target: 'Weekly_Labor_Review.pdf', targetLabel: 'Weekly Labor Review Form',
          title: 'Run the Monday labor review',
          detail: 'Download the Weekly Labor Review Form and work it every Monday before the new schedule is built. Flag any department more than 2 points over target, decide whether it was a scheduling error or a revenue miss, and assign one action before the review closes. A scheduling error is fixed in next week\'s schedule. A revenue miss is fixed in the pre-shift briefing.' }
      ]
    },

    commonMistakes: [
      'Managing labor as a blended total instead of by department. Bar, kitchen, and floor have different economics, and one running over hides in the blend.',
      'Building the schedule before checking the revenue forecast. The schedule should be built from a revenue number, not from who worked last week.',
      'Calculating labor percentage on wages only. Total labor cost runs 10 to 15% higher than wages, so a wages-only number understates the problem.',
      'Treating overtime as a staffing cost instead of a scheduling error. Almost all overtime is hours concentrated on too few people.',
      'Overstaffing slow shifts because it feels safer. An idle server on a slow Tuesday is a labor percentage problem that compounds across the year.',
      'Building a schedule with no revenue reference at all. A schedule without a forecast is a guess.'
    ],

    quickRef: {
      rhythm: [
        'Pull the revenue forecast by day for the coming week from POS history',
        'Enter the forecast by day and department and generate the labor budget in hours',
        'Build the schedule to the budget, must-have coverage first, then fill',
        'Flag any shift where the proposed schedule exceeds the labor budget by more than 5%',
        'Review the schedule with the manager before posting. A budget conversation is easy before, hard after',
        'Confirm department labor targets are current for the season'
      ],
      escalation: [
        'Pull actual labor hours and revenue by department for the prior week.',
        'Compare actual labor percentage to target for each department.',
        'Flag any department that ran more than 2 points above target.',
        'Determine whether the variance was a scheduling error or a revenue miss.',
        'If a scheduling error, identify the specific over-budget shifts to correct next week.',
        'Assign one action item before the review closes.'
      ]
    },

    aiWorkflows: [
      {
        id: 'ls-ai-1',
        title: 'Build a Revenue-Based Schedule',
        whatItDoes: 'Turns a revenue forecast into a staffing table: labor budget, hours available, and recommended headcount by day and department.',
        prompt: 'Here is my revenue forecast for next week by day and daypart. [PASTE FORECAST]. My labor targets by department: bar [X]%, kitchen [X]%, floor [X]%. My average hourly wage including taxes and benefits: bar $[X]/hr, kitchen $[X]/hr, floor $[X]/hr. Average shift length: bar [X] hrs, kitchen [X] hrs, floor [X] hrs. Calculate the maximum labor hours available for each department each day and show the result as a staffing table: day, department, revenue, labor budget, hours available, recommended headcount.',
        whatToPaste: 'Paste the forecast and fill in your department targets, loaded wages, and shift lengths.'
      },
      {
        id: 'ls-ai-2',
        title: 'Find Over-Scheduled Shifts',
        whatItDoes: 'Analyzes four weeks of labor data, flags every shift over budget, and ranks the worst by annual dollar impact.',
        prompt: 'Here is four weeks of actual labor data by department and day. Columns: date, day of week, department, actual labor hours, actual revenue, labor percentage. [PASTE DATA]. My target labor percentages: bar [X]%, kitchen [X]%, floor [X]%. Identify every shift where actual labor exceeded target by more than 2 points, calculate the annualized dollar cost of those over-budget shifts, sort by total annual impact, and show the top five shifts to address first.',
        whatToPaste: 'Paste four weeks of labor data and fill in the department targets.'
      },
      {
        id: 'ls-ai-3',
        title: 'Calculate the Annual Cost of Overtime',
        whatItDoes: 'Totals and annualizes overtime premium, names the top earners, and shows the redistribution opportunity.',
        prompt: 'Here is four weeks of payroll data showing regular and overtime hours by employee. [PASTE DATA]. My regular wage rates by employee: [PASTE RATES]. Overtime premium is 1.5x the regular rate for hours above 40 per week. Calculate total overtime premium paid in these four weeks, annualize it, identify the top three overtime earners, and for each show how many overtime hours could have been redistributed to under-scheduled employees based on the same four weeks.',
        whatToPaste: 'Paste four weeks of regular/overtime hours and the wage rates.'
      },
      {
        id: 'ls-ai-4',
        title: 'Build a Slow-Season Labor Strategy',
        whatItDoes: 'Recalculates department labor targets and headcount for the slow season so margin holds when revenue drops.',
        prompt: 'My high season runs [MONTHS] and my slow season runs [MONTHS]. My high season average weekly revenue is $[AMOUNT] and my slow season average weekly revenue is $[AMOUNT]. My current labor targets were set for high season. Calculate what my labor targets by department should be in slow season to maintain the same margin, given that fixed labor costs do not flex, then show the schedule headcount implications for a typical slow-season week.',
        whatToPaste: 'Fill in the season months and the high- and slow-season weekly revenue.'
      }
    ]
  },

  {
    id: 'rplh',
    name: 'Labor Productivity (RPLH)',
    module: 'revenue',
    summary: 'Revenue per labor hour measures what the schedule produces, not just what it costs. Track it by shift, set targets off your own baseline, and diagnose every miss.',

    process: {
      intro: 'Labor cost percentage tells you the ratio of labor to revenue. RPLH tells you the return on each scheduled hour. You need both. A schedule decision made with only one is missing half the picture. The RPLH Tracker pulls your labor hours straight from Labor Control and does the math. Each step below opens where the work happens.',
      steps: [
        { kind: 'result', target: 'r-rplh', targetLabel: 'RPLH Tracker',
          title: 'Read RPLH by shift every Monday',
          detail: 'The RPLH Tracker works out net revenue divided by labor hours for each shift and department, using hours pulled straight from Labor Control. Read it every Monday before the new schedule is built. Read it next to labor percentage. A shift can sit at an acceptable labor percent while its RPLH runs well below target.' },
        { kind: 'action', target: 'settings', targetLabel: 'Settings',
          title: 'Set targets off your own 13-week baseline',
          detail: 'Concept benchmarks are a starting orientation only. After one quarter of data, set each shift\'s RPLH target in Settings at roughly 12% above its own 13-week average. Your own baseline reflects your concept, your market, and your guest mix in a way a generic benchmark never will.' },
        { kind: 'action', target: 'lc-build-schedule', targetLabel: 'Build Schedule',
          title: 'Build the schedule to the RPLH target',
          detail: 'In Build Schedule, work backward from the revenue forecast and the RPLH target to the labor hours each shift can support, then staff to that number. Build Schedule shows projected RPLH live as you assign hours.' },
        { kind: 'result', target: 'r-rplh', targetLabel: 'RPLH Tracker',
          title: 'Diagnose every below-target shift',
          detail: 'When the tracker shows a shift below target, decide what drove it. Labor hours above budget is a scheduling problem, fixed in next week\'s schedule. Revenue below what the staffing should produce is a check average problem, fixed in the pre-shift briefing. Cutting the schedule on a check average miss fixes nothing.' }
      ]
    },

    commonMistakes: [
      'Using labor percentage alone to evaluate scheduling. The percentage is the ratio, RPLH is the return, and a decision without both is missing half the picture.',
      'Cutting the schedule when RPLH is low without diagnosing the cause. Low RPLH from a check average problem needs an upsell response, not a staffing cut.',
      'Setting RPLH targets once and never updating them. Revenue mix shifts seasonally, so a July target may be too aggressive in January.',
      'Tracking RPLH as a blended number across departments. Bar, kitchen, and floor generate revenue differently and a blend hides the differences.',
      'Not connecting RPLH data to the pre-shift briefing. Servers who know their check average goal change behavior, which moves RPLH.',
      'Treating a single week of low RPLH as a trend. One weak week is noise. Four consecutive weeks on the same shift is a structural problem.'
    ],

    quickRef: {
      rhythm: [
        'Confirm last week\'s revenue and labor hours imported from Labor Control',
        'Review RPLH vs target by shift and flag any shift more than 10% below target',
        'Check the four-week trend and see whether RPLH is moving toward target or away from it',
        'Identify whether each below-target shift is a scheduling or a check average problem',
        'If scheduling: adjust next week\'s schedule before it is posted',
        'If check average: add the shift to next week\'s pre-shift briefing focus'
      ],
      benchmarks: [
        { label: 'Bar, peak shift',           target: '$65-85', warning: '$45-65', critical: 'below $45' },
        { label: 'Bar, shoulder shift',       target: '$45-60', warning: '$30-45', critical: 'below $30' },
        { label: 'Full service, peak dinner', target: '$55-75', warning: '$38-55', critical: 'below $38' },
        { label: 'Full service, slow night',  target: '$35-50', warning: '$22-35', critical: 'below $22' },
        { label: 'Kitchen department',        target: '$40-55', warning: '$28-40', critical: 'below $28' }
      ],
      escalation: [
        'Confirm the shift has been below target for multiple consecutive weeks, not one.',
        'Calculate average check per cover for the shift across those weeks.',
        'Determine whether labor hours ran above budget or revenue ran below what the staffing should produce.',
        'If labor hours drove it: treat it as a scheduling problem and adjust next week\'s schedule.',
        'If revenue / check average drove it: treat it as an upsell problem and brief that shift.',
        'Re-check the shift after two weeks to confirm the fix moved the number.'
      ]
    },

    aiWorkflows: [
      {
        id: 'rp-ai-1',
        title: 'Analyze 13 Weeks of RPLH and Set Targets',
        whatItDoes: 'Averages a quarter of RPLH by shift, ranks the best and worst, and sets initial targets at 12% above baseline.',
        prompt: 'Here is 13 weeks of revenue and labor hour data by shift and department. Columns: week number, shift name, department, net revenue, labor hours, RPLH calculated. [PASTE DATA]. Calculate my average RPLH by shift type and by department across all 13 weeks, identify the three highest- and three lowest-performing shifts, set initial RPLH targets at 12% above the 13-week average for each shift type, and flag any shift where RPLH varied more than 25% across the 13 weeks as needing further investigation before a target is set.',
        whatToPaste: 'Paste 13 weeks of by-shift revenue and labor-hour data into [PASTE DATA].'
      },
      {
        id: 'rp-ai-2',
        title: 'Diagnose a Below-Target Shift',
        whatItDoes: 'Determines whether a chronically low-RPLH shift is a scheduling problem or a check average problem and recommends one action.',
        prompt: 'I have a shift running below my RPLH target for four consecutive weeks. Shift: [SHIFT NAME]. Target RPLH: $[X]. Actual RPLH last four weeks: [W1], [W2], [W3], [W4]. Scheduled labor hours each week: [W1], [W2], [W3], [W4]. Actual revenue each week: [W1], [W2], [W3], [W4]. Covers each week: [W1], [W2], [W3], [W4]. Calculate average check per cover each week, determine whether the RPLH miss is primarily labor hours above budget or revenue below what the staffing should produce, state the primary cause, and recommend one specific action.',
        whatToPaste: 'Fill in the shift, target, and four weeks of RPLH, hours, revenue, and covers.'
      },
      {
        id: 'rp-ai-3',
        title: 'Calculate Optimal Staffing From RPLH Targets',
        whatItDoes: 'Turns next week\'s forecast and RPLH targets into a staffing table with projected labor percentage.',
        prompt: 'My revenue forecast for next week by shift: [PASTE FORECAST]. My RPLH targets by shift type: peak dinner $[X], shoulder dinner $[X], lunch $[X], brunch $[X]. My average labor cost per hour including taxes and benefits: $[X]. Average shift length by department: floor [X] hrs, bar [X] hrs, kitchen [X] hrs. For each shift, calculate the labor hours available at the RPLH target, the recommended headcount by department, and the labor cost percentage that schedule produces at the forecast revenue.',
        whatToPaste: 'Paste the forecast and fill in your RPLH targets, loaded wage, and shift lengths.'
      },
      {
        id: 'rp-ai-4',
        title: 'Prioritize Shifts for RPLH Improvement',
        whatItDoes: 'Ranks below-target shifts by annual dollar opportunity and names the likely cause for the top three.',
        prompt: 'Here is my RPLH by shift for the last quarter (13 weeks). [PASTE DATA]. My RPLH targets by shift type: [PASTE TARGETS]. Calculate the annualized dollar gap between actual and target RPLH for each shift, sort by total annual opportunity, and for the top three shifts state whether the likely cause is scheduling or check average based on how consistent the RPLH miss is across weeks.',
        whatToPaste: 'Paste 13 weeks of by-shift RPLH and your shift-type targets.'
      }
    ]
  },

  {
    id: 'check-average',
    name: 'Check Average & Upsell',
    module: 'revenue',
    summary: 'Check average per cover is the floor\'s biggest revenue lever. Brief it every shift, track it by server, and coach the few who are below average, not the whole team.',

    process: {
      intro: 'The pre-shift briefing and the weekly review are two halves of one system. The briefing sets the behavior. The review tells you whether it worked. The system compounds. It feels like process for no result until about week four, then the data starts moving. The app tracks check average by server and shows you the spread. Each step below opens where the work happens.',
      steps: [
        { kind: 'result', target: 'r-server-check', targetLabel: 'Server Check',
          title: 'Track check average by server',
          detail: 'Server Check shows sales divided by covers for each individual server. Total sales hides the productivity difference. Two servers with identical sales can have very different check averages if their cover counts differ, and that difference is where the money is.' },
        { kind: 'result', target: 'r-check-average', targetLabel: 'Check Average',
          title: 'Set the team baseline and read the spread',
          detail: 'Check Average shows your team average check and the upsell gap in dollars. Four weeks of data gives you a real baseline. Any server running more than 15% below the team average is flagged. The spread tells you whether you have a few coaching cases or a system-wide gap.' },
        { kind: 'reference', target: 'Server_Upsell_Standards_Scripts.docx', targetLabel: 'Server Upsell Standards and Scripts',
          title: 'Train and post the upsell sequence',
          detail: 'Download the Server Upsell Standards and Scripts, post it in the server area, and use it in training. Pre-dinner beverage, appetizer, dessert close, in that order. Upselling is a learned sequence, not a personality trait. Written down and trained, every server can follow it.' },
        { kind: 'reference', target: 'PreShift_Upsell_Briefing.pdf', targetLabel: 'Pre-Shift Upsell Briefing',
          title: 'Run the pre-shift briefing every shift',
          detail: 'Print the Pre-Shift Upsell Briefing and run it five minutes before doors open: today\'s two or three Stars, one specific check average target for the shift, the upsell sequence, and one named beverage pairing. A written form keeps it consistent across managers.' },
        { kind: 'reference', target: 'Table_Visit_Audit.pdf', targetLabel: 'Table Visit Audit',
          title: 'Audit the floor with table visit audits',
          detail: 'Run two unannounced table visit audits a week with the Table Visit Audit form. They confirm the briefing actually produced floor behavior. A briefing with no audit behind it is one-way communication.' },
        { kind: 'result', target: 'r-server-check', targetLabel: 'Server Check',
          title: 'Coach below-average servers from the data',
          detail: 'Server Check identifies the servers trending down two weeks in a row. Each one gets a coaching conversation that week. Coach the two who need it, not the whole team. A general sell-more message creates resistance from the servers already performing.' }
      ]
    },

    commonMistakes: [
      'Tracking total server sales instead of check average per cover. Total sales hides the productivity difference when cover counts differ.',
      'Running the briefing without a written form. A verbal briefing varies by manager and produces inconsistent execution.',
      'Coaching the whole team when only two servers are below average. A general message has no impact on the two who need it and creates resistance from the rest.',
      'Setting check average targets without a four-week baseline. A target with no baseline is a guess.',
      'Treating upselling as a personality trait rather than a learned sequence. Every server can follow a written, trained sequence.',
      'Forgetting the beverage pairing. A specific wine or cocktail pairing in the briefing and the menu description converts higher than any other upsell.'
    ],

    quickRef: {
      rhythm: [
        'Daily: pull today\'s 2-3 Stars and set one specific check average target for the shift',
        'Daily: brief the upsell sequence and one named beverage pairing, on the written form',
        'Weekly: pull server sales and covers and review check average by server',
        'Weekly: flag any server more than 15% below team average or trending down two weeks',
        'Weekly: review the table visit audits and confirm the briefing produced floor behavior',
        'Weekly: set next week\'s briefing Stars list from the menu engineering output'
      ],
      escalation: [
        'Confirm the server is more than 15% below team average, not just one slow week.',
        'Check the four-week trend and see whether the server is trending down two weeks in a row.',
        'Calculate the annual revenue gap versus team average at the server\'s cover count.',
        'Open the conversation with that dollar number and ask which part of the upsell sequence they are least comfortable with.',
        'Set a specific check average target and focus items for the next two weeks.',
        'Re-review after two weeks; if there is no movement, move to a structured performance plan.'
      ]
    },

    aiWorkflows: [
      {
        id: 'ca-ai-1',
        title: 'Identify Server Coaching Priorities',
        whatItDoes: 'Reads four weeks of server check average data, flags who is below average, and quantifies the annual gap for each.',
        prompt: 'Here is my server check average data for the past four weeks. For each server: name, total sales, total covers, check average by week for four weeks. [PASTE DATA]. My weekly cover count is approximately [X] and my current team average check is $[X]. Calculate each server\'s four-week average check, identify any server more than 15% below team average, calculate each below-average server\'s annual revenue gap versus team average at their cover count, sort by annual gap, and flag the top two for immediate coaching focus.',
        whatToPaste: 'Paste your four weeks of by-server sales and covers into [PASTE DATA].'
      },
      {
        id: 'ca-ai-2',
        title: 'Write Server Upsell Scripts',
        whatItDoes: 'Drafts three suggestion versions per item: for an undecided guest, a decided guest, and as a pairing.',
        prompt: 'I need upsell language for my servers for the following category: [CATEGORY]. My current Stars in this category: [LIST ITEMS WITH BRIEF DESCRIPTION]. My target check average for a table that orders from this category: $[X]. Write three versions of the suggestion for each item: one for a guest who seems undecided, one for a guest who already knows what they want, and one that works as a pairing suggestion with a specific menu item. Keep each version under 20 words. No filler language.',
        whatToPaste: 'Fill in the category, your Stars in it, and the target check average.'
      },
      {
        id: 'ca-ai-3',
        title: 'Model the Check Average Gap',
        whatItDoes: 'Calculates the annual revenue at each check average level and the revenue from lifting just the bottom servers.',
        prompt: 'My current team check average is $[X], my target check average is $[Y], my daily cover count is approximately [Z], and I operate [N] service days per year. Calculate the annual revenue at the current average, at target, and at three intermediate steps, showing the revenue added at each step. Also calculate the revenue added if only my three lowest-average servers move to the current team average, keeping everyone else flat.',
        whatToPaste: 'Fill in current and target check average, daily covers, and service days per year.'
      },
      {
        id: 'ca-ai-4',
        title: 'Draft Tonight\'s Pre-Shift Briefing',
        whatItDoes: 'Writes a five-minute pre-shift briefing script covering Stars, the check average goal, the upsell sequence, and the pairing.',
        prompt: 'Tonight\'s shift details: [SHIFT NAME], expected covers [X], current team check average $[X]. Stars to feature: [LIST 2-3 ITEMS WITH BRIEF DESCRIPTION]. Beverage pairing: [ITEM] with [PAIRING]. Target check average for this shift: $[X]. Write a pre-shift briefing script under 150 words that a manager can read in five minutes, including tonight\'s Stars with one sentence each, the check average goal, the upsell sequence order, and the beverage pairing. Direct language, no motivational filler.',
        whatToPaste: 'Fill in the shift, covers, Stars, pairing, and the check average target.'
      }
    ]
  },

  {
    id: 'events-catering',
    name: 'Events & Catering',
    module: 'revenue',
    summary: 'Private dining and catering is revenue most independents leave on the table. Name an owner, publish a rate card, respond in two hours, and run the P&L before confirming.',

    process: {
      intro: 'An events business runs on speed and process. A published rate card so pricing is instant, a two-hour response standard so the client stays engaged, and a pipeline so nothing goes cold. Name one person to own all of it. Everyone responsible means nobody responsible. Margin varies widely by event, so run the P&L before you confirm, not after. Each step below opens where the work happens.',
      steps: [
        { kind: 'action', target: 'r-events', targetLabel: 'Events and Catering',
          title: 'Build the rate card before any inquiry',
          detail: 'In Events and Catering, set up your rate cards: published packages, per-head pricing, and F&B minimums by room. Pricing decided once, in advance, is faster, produces better margins, and looks more professional than bespoke pricing worked out per inquiry.' },
        { kind: 'reference', target: 'Private_Dining_Events_Package.docx', targetLabel: 'Private Dining and Events Package',
          title: 'Respond to every inquiry within two hours',
          detail: 'Download the Private Dining and Events Package, fill in your venue details, and send it as the complete answer to every inquiry. Send the package first and ask clarifying questions after. Booking probability drops sharply after two hours and below 20% after 24.' },
        { kind: 'action', target: 'r-events', targetLabel: 'Events and Catering',
          title: 'Track every inquiry in the pipeline',
          detail: 'Log every inquiry in Events and Catering with its status and a follow-up date. Any inquiry without a next action in 7 days gets one assigned. Anything stuck 14 days in one status gets a close-or-reactivate decision. A 15-minute Monday pipeline review keeps every open inquiry moving.' },
        { kind: 'result', target: 'r-events', targetLabel: 'Events and Catering',
          title: 'Run the Event P&L before you confirm',
          detail: 'Events and Catering works out the P&L for each booking from its revenue, COGS, labor, and ancillary costs. Event margin varies widely, so read the P&L before you confirm the booking, not after. And take a deposit to hold the date. A hold without a deposit cancels, and a canceled hold that was not replaced costs the whole date.' },
        { kind: 'reference', target: 'Private_Dining_Site_Inspection.pdf', targetLabel: 'Private Dining Site Inspection',
          title: 'Walk the space before you confirm',
          detail: 'For any private dining booking, run the Private Dining Site Inspection checklist with the client. Walking the room together sets expectations on capacity, layout, and service before anything is signed.' },
        { kind: 'reference', target: 'Event_Day_Operations.pdf', targetLabel: 'Event Day Operations',
          title: 'Execute the event off the checklist',
          detail: 'Run the event off the Event Day Operations checklist with manager sign-off. A checklist is what makes a good event repeatable instead of dependent on whoever happens to be working.' },
        { kind: 'reference', target: 'Catering_Delivery_Setup.pdf', targetLabel: 'Catering Delivery Setup',
          title: 'Run catering deliveries off the setup checklist',
          detail: 'For off-site catering, run the Catering Delivery Setup checklist. Transport, timing, equipment, and on-site setup all have to be confirmed before the truck leaves, because there is no kitchen to fall back on once it arrives.' }
      ]
    },

    commonMistakes: [
      'Having no named owner for events. Everyone responsible means nobody responsible.',
      'Pricing events per inquiry rather than from a rate card. Bespoke pricing is slower, produces worse margins, and looks less professional.',
      'Waiting more than two hours to respond. Booking probability drops sharply after two hours and below 20% after 24.',
      'Sending a website link instead of a complete package. A client who has to hunt for pricing calls the next venue.',
      'Not requiring a deposit to hold a date. A hold without a deposit cancels, and a canceled hold that was not replaced costs the whole date.',
      'Not running an Event P&L on every booking. Event margin varies widely, so calculate it before the event, not after.'
    ],

    quickRef: {
      rhythm: [
        'Within 2 hours of any inquiry: log it, send the complete package with a personal note',
        'Set a follow-up date 48 hours out on every inquiry when the package goes out',
        'Confirm or propose the requested date in the same first response',
        'Weekly: review every open inquiry and its status in the pipeline',
        'Weekly: assign a follow-up to any inquiry without a next action in 7 days',
        'Weekly: calculate pipeline value and review last week\'s closed and lost inquiries'
      ],
      escalation: [
        'Review every open inquiry\'s current status and last action.',
        'Close or reactivate any inquiry stuck in the same status for 14 days.',
        'Calculate the overall close rate and find the stage where inquiries go cold.',
        'Compare average response time on booked inquiries versus lost inquiries.',
        'Look for patterns in lost bookings by event type, day of week, guest count, or price.',
        'Fix the most common loss cause first and re-check the close rate next quarter.'
      ]
    },

    aiWorkflows: [
      {
        id: 'ec-ai-1',
        title: 'Draft an Event Inquiry Response',
        whatItDoes: 'Writes a warm, professional response email that confirms the date, references the attached package, and gives a direct contact.',
        prompt: 'I received an event inquiry with the following details: client name [NAME], event type [TYPE], estimated guest count [X], requested date [DATE], any specific requests noted [DETAILS]. My venue details: room name [ROOM], capacity [X], F&B minimum [X], available packages [DESCRIBE]. Write a professional response email under 150 words that confirms receipt and interest, notes that the package is attached, confirms or proposes the requested date, and provides a direct contact name and number. Warm and direct, no sales language.',
        whatToPaste: 'Fill in the inquiry details and your venue\'s room, capacity, minimum, and packages.'
      },
      {
        id: 'ec-ai-2',
        title: 'Analyze the Events Pipeline',
        whatItDoes: 'Reads 90 days of pipeline data to find the close rate, the stage where inquiries go cold, and the patterns in lost bookings.',
        prompt: 'Here is my event pipeline data for the last 90 days. Columns: inquiry date, event type, guest count, status (booked/lost/open), days to first response, notes on reason for loss if known. [PASTE DATA]. Calculate my overall close rate, identify the most common stage where inquiries go cold, calculate average response time for bookings versus lost inquiries, and identify any patterns in lost bookings by event type, day of week, or guest count.',
        whatToPaste: 'Paste 90 days of pipeline rows into [PASTE DATA].'
      },
      {
        id: 'ec-ai-3',
        title: 'Build a Catering Package Description',
        whatItDoes: 'Writes a client-facing catering package description with the per-head price at your target margin.',
        prompt: 'I want to add a catering package for [EVENT TYPE]. The package includes: [LIST ITEMS]. My per-head cost at current ingredient prices is approximately $[X] and my target margin for catering is [X]%. Write a client-facing package description under 120 words that describes what is included, the service style, the per-head price at target margin, and the minimum guest count. Professional and specific, no filler.',
        whatToPaste: 'Fill in the event type, item list, per-head cost, and target margin.'
      },
      {
        id: 'ec-ai-4',
        title: 'Write a Post-Event Follow-Up',
        whatItDoes: 'Drafts a personal post-event follow-up email that drives repeat bookings without offering a discount.',
        prompt: 'Event details: client name [NAME], event type [TYPE], date [DATE], guest count [X], any notable details [NOTES]. Write a post-event follow-up email under 100 words that thanks the client personally, references one specific detail from the event, asks one question about their experience, and mentions you would love to host their next occasion. Do not offer a discount and do not use a template-sounding opener. Write it as the manager who ran the event.',
        whatToPaste: 'Fill in the client, event type, date, guest count, and a notable detail.'
      }
    ]
  },

  {
    id: 'server-performance',
    name: 'Server Performance',
    module: 'revenue',
    summary: 'A written standard turns serving from personal style into a trained, measurable system. Roll it out signed, measure by individual check average, and coach from data.',

    process: {
      intro: 'A briefing tells servers what to suggest today. A written standard tells them how to suggest it at every touch point. The standard is what makes performance trainable, measurable, and enforceable. Coaching has to run on data, not impression, and the app tracks check average by server so the data is there. Each step below opens where the work happens.',
      steps: [
        { kind: 'reference', target: 'Server_Upsell_Standards_Scripts.docx', targetLabel: 'Server Upsell Standards and Scripts',
          title: 'Write and roll out the server standard',
          detail: 'Download the Server Upsell Standards and Scripts, set your six touch points, and distribute it to every active server. Collect a signed acknowledgment, file the signed copies, and post a copy in the server area. Brief every manager on it so a server hears the same expectations from whoever is on the floor. New servers learn the written standard on day one, not by shadowing alone.' },
        { kind: 'result', target: 'r-server-check', targetLabel: 'Server Check',
          title: 'Measure performance by individual check average',
          detail: 'Server Check tracks check average per server, not impression and not total sales. The server with the most covers often ranks lower on check average. Total sales hides the productivity difference, and individual check average is the one number that does not.' },
        { kind: 'reference', target: 'Table_Visit_Audit.pdf', targetLabel: 'Table Visit Audit',
          title: 'Audit the floor with table visit audits',
          detail: 'Run two unannounced table visit audits a week with the Table Visit Audit form. They confirm the standard is actually executed and show you which of the six touch points a server is missing.' },
        { kind: 'result', target: 'r-server-check', targetLabel: 'Server Check',
          title: 'Coach the bottom and recognize the top, from the data',
          detail: 'Server Check shows who is below the team average and trending down, and who is on top. Open a coaching conversation with the specific numbers, never a judgment. The server\'s check average against the team average is coaching. "Your tables are not selling" is an accusation. Then name the prior week\'s top performer in the briefing, so the standard is recognized as well as enforced.' }
      ]
    },

    commonMistakes: [
      'Managing server performance by impression and total sales instead of individual check average. Total sales hides the productivity difference.',
      'Not having a written standard. An unwritten standard means something different to every manager and cannot be trained or enforced.',
      'Coaching the whole team when only two or three servers are below average. A general push has no impact on the people who need it.',
      'Starting the coaching conversation with judgment rather than data. The numbers are a coaching conversation. "Your tables are not selling" is an accusation.',
      'Training new servers by shadowing without a written standard. They learn another server\'s personal style, not a consistent standard.',
      'Not connecting the briefing Stars list to the upsell sequence. Servers who know what to suggest before the shift perform better than those deciding in the moment.'
    ],

    quickRef: {
      rhythm: [
        'Review check average by server and identify anyone below the threshold',
        'Check the four-week trend and flag any server trending down two weeks in a row',
        'Name the prior week\'s top performer in the next pre-shift briefing',
        'Schedule coaching conversations for below-average servers this week, not next',
        'Review the table visit audits and confirm the sequence is being executed on the floor',
        'Update first-section assignments based on last week\'s performance data'
      ],
      escalation: [
        'Open the conversation with the specific numbers: the server\'s check average, the team average, and the annual gap.',
        'Ask one diagnostic question to identify the weakest touch point.',
        'Use the table audit data to confirm whether it is a skill gap or an effort gap.',
        'Agree on one specific behavior change to try this week, drawn from the briefing.',
        'Set a follow-up checkpoint date and review the check average data together.',
        'If there is no movement after two coaching cycles, move to a structured performance plan.'
      ]
    },

    aiWorkflows: [
      {
        id: 'sp-ai-1',
        title: 'Build a Coaching Conversation Framework',
        whatItDoes: 'Drafts a data-first coaching framework for a below-average server: number opening, one diagnostic question, one behavior change, a follow-up date.',
        prompt: 'I need to coach a server whose check average is below team average. Server details: [NAME], average check last 4 weeks: $[X]. Team average: $[X]. Weekly covers: approximately [X]. Annual revenue gap versus team average: $[X]. Table audit results for this server: [DESCRIBE WHAT YOU OBSERVED]. Draft a coaching conversation framework that opens with the specific numbers (not a general statement), asks one question to identify their weakest touch point, suggests one specific behavior change to try this week, and closes with a follow-up checkpoint date.',
        whatToPaste: 'Fill in the server\'s name, check average, the team average, weekly covers, annual gap, and audit notes.'
      },
      {
        id: 'sp-ai-2',
        title: 'Write the Server Upsell Standard',
        whatItDoes: 'Drafts a concise server standard for your concept covering all six touch points with shift-specific check average targets.',
        prompt: 'I need to write a server upsell standard for my concept. Concept type: [TYPE]. Current team check average: $[X]. Target check average: $[X]. Top 3 Stars from my menu engineering matrix: [LIST WITH BRIEF DESCRIPTION]. Current beverage program highlights: [LIST 2-3 ITEMS]. Write a server standard under 4 pages covering table greeting and timing, the beverage suggestion sequence, the appetizer suggestion, the entree pairing suggestion, the dessert close by name, and check average targets for peak versus shoulder shifts. Direct, specific language, no hospitality filler.',
        whatToPaste: 'Fill in your concept type, current and target check average, top Stars, and beverage highlights.'
      },
      {
        id: 'sp-ai-3',
        title: 'Identify Top Performers for Recognition',
        whatItDoes: 'Finds the top two servers, quantifies the revenue their performance adds, and writes one recognition line each for the briefing.',
        prompt: 'Here is my server check average data for the last four weeks. [PASTE DATA]. My team average is $[X]. Identify the top two performers by four-week average, calculate how much additional annual revenue their performance generates compared to team average, and draft one sentence of recognition language for each that I can use in the next pre-shift briefing. Specific and fact-based, not generic praise.',
        whatToPaste: 'Paste four weeks of by-server check average data and the team average.'
      },
      {
        id: 'sp-ai-4',
        title: 'Build a New-Server Training Schedule',
        whatItDoes: 'Creates a day-by-day 14-day onboarding schedule built around the written standard, with a check average review at day 14.',
        prompt: 'I need a two-week onboarding schedule for a new server. My concept: [TYPE]. Current server standard document: [DESCRIBE KEY ELEMENTS]. Top servers they can shadow: [NAMES]. Expected starting shift schedule: [DESCRIBE]. Build a day-by-day training schedule for the first 14 days that starts with the written standard on day one, includes shadow shifts with a specific observation focus, includes managed table time with check average tracking from day four, and ends with a check average review and first coaching conversation at day 14.',
        whatToPaste: 'Fill in the concept, the standard\'s key elements, shadow servers, and the starting schedule.'
      }
    ]
  }

];
