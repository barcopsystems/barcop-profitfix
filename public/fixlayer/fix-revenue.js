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
      intro: 'Menu engineering plots every item on two axes — contribution margin (dollars, not food cost %) and sales volume — into four quadrants. Stars: high margin, high volume. Plowhorses: low margin, high volume. Puzzles: high margin, low volume. Dogs: low margin, low volume. Each quadrant gets a different action.',
      steps: [
        { title: 'Set up the menu data',
          detail: 'Every item entered with name, category, current price, and yield-adjusted food cost. The matrix is only as accurate as this data — refresh ingredient costs whenever a supplier price moves more than 5%.' },
        { title: 'Run the engineering matrix quarterly',
          detail: 'Enter weekly sales counts and classify every item Star, Plowhorse, Puzzle, or Dog against the category-average margin and category-average volume. Re-run the first week of January, April, July, and October.' },
        { title: 'Analyze on contribution margin dollars',
          detail: 'Sort by contribution margin in dollars, not food cost %. The percentage tells you structural efficiency; the dollar amount tells you what the item is actually worth to the business.' },
        { title: 'Reposition by quadrant',
          detail: 'Move Stars and high-margin Puzzles into prime menu positions — a Star in a prime slot with server promotion typically lifts weekly orders 15-25%. Where items live determines what gets ordered.' },
        { title: 'Reprice Plowhorses surgically',
          detail: 'For each Plowhorse, calculate the price floor, test price sensitivity, and target Star margin territory. A targeted $2 increase on five Plowhorses is far less visible than a 6% blanket increase.' },
        { title: 'Test or remove Dogs',
          detail: 'Give each Dog a 90-day test in a repositioned slot with a rewritten description before pulling it — some Dogs are just buried items with a description problem.' },
        { title: 'Brief servers off the Stars list',
          detail: 'Positioning and pricing only produce results when servers know what to suggest and why. Every item featured in the pre-shift briefing comes from the Stars list.' }
      ]
    },

    formulas: [
      { label: 'Contribution Margin',
        formula: 'Menu price - yield-adjusted ingredient cost',
        example: 'Ribeye $48 - $14.60 cost = $33.40 margin — three times the category average' },
      { label: 'Price Floor',
        formula: 'Ingredient cost / target food cost %',
        example: '$6.20 cost / 30% target = $20.67 minimum price' },
      { label: 'Break-Even Volume After a Price Change',
        formula: '(Current margin x current volume) / New margin',
        example: 'Confirm the break-even volume is at least 20% below current weekly volume before repricing' }
    ],

    commonMistakes: [
      'Running the analysis on food cost percentage instead of contribution margin dollars — the percentage is structural efficiency; the dollar amount is what the item is worth.',
      'Engineering the menu once and treating it as done — costs move and seasonality shifts; a January menu can have three items below floor by August.',
      'Removing Dogs without a 90-day test in a repositioned slot — some Dogs are buried items with a description problem, not bad items.',
      'Leaving Stars in mid-menu positions because they sell anyway — a Star in a prime position with server promotion typically lifts orders 15-25%.',
      'Announcing price increases across the board instead of surgically — a targeted increase on a few Plowhorses is far less visible than a blanket raise.',
      'Running menu engineering without connecting it to the server briefing — positioning and pricing only work when servers know what to suggest.'
    ],

    quickRef: {
      rhythm: [
        'Confirm every item in the menu data has name, category, price, and yield-adjusted food cost %',
        'Enter the latest weekly sales counts and re-run the engineering matrix',
        'Review the quadrant output — which Stars are not in prime menu positions?',
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

    templates: [
      {
        id: 'menu-engineering-worksheet',
        name: 'Menu Engineering Review Worksheet',
        intro: 'The quarterly review worksheet. Print it, work through every item by quadrant, and record the repositioning and repricing decisions.',
        fields: [
          { key: 'bar_name',       label: 'Restaurant Name', placeholder: 'Your restaurant' },
          { key: 'review_quarter', label: 'Review Quarter',  placeholder: 'e.g. Q2' }
        ],
        body: 'MENU ENGINEERING REVIEW\n{{bar_name}} — {{review_quarter}}\n\n'
          + 'Classify every menu item into one quadrant by contribution margin (dollars) and sales volume, then record the decision.\n\n'
          + 'STARS — high margin, high volume\n'
          + 'Action: protect, keep in a prime position, feature in briefings.\n'
          + 'Items: ____________________________________________________\n'
          + 'Decisions: _________________________________________________\n\n'
          + 'PLOWHORSES — low margin, high volume\n'
          + 'Action: reprice toward floor, reduce portion cost, or re-engineer the recipe.\n'
          + 'Items: ____________________________________________________\n'
          + 'Reprice targets: ___________________________________________\n\n'
          + 'PUZZLES — high margin, low volume\n'
          + 'Action: reposition to a prime slot, rewrite the description, feature in briefings.\n'
          + 'Items: ____________________________________________________\n'
          + 'Decisions: _________________________________________________\n\n'
          + 'DOGS — low margin, low volume\n'
          + 'Action: 90-day test in a repositioned slot, then remove if it does not move.\n'
          + 'Items: ____________________________________________________\n'
          + 'Test or remove: ____________________________________________\n\n'
          + 'PRE-SHIFT BRIEFING LIST FOR NEXT QUARTER (from the Stars)\n'
          + '1. ________________________   2. ________________________\n\n'
          + 'Reviewed by: ____________________   Date: __________'
      }
    ],

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
        prompt: 'I need updated menu descriptions for my top Stars. For each item I will provide: name, key ingredients, preparation method, and one beverage pairing. [PASTE ITEM DETAILS]. Write a menu description for each under 22 words, including the preparation method, one specific ingredient detail, and the beverage pairing. No filler — no "fresh", "delicious", or "house-made" unless followed by a specific detail. Format: item name on one line, description on the next.',
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
      intro: 'Price from the math, not the gut. The cost floor tells you what a price needs to be; the competition tells you what the market accepts. They are two different numbers used for two different decisions — and a menu priced once at opening drifts below floor within 18 months.',
      steps: [
        { title: 'Calculate cost-based price floors on yield-adjusted costs',
          detail: 'For every item, divide the yield-adjusted ingredient cost by the target food cost %. A protein priced on raw purchase cost is actually 8 points higher once trim loss is in — build the floor from the right number.' },
        { title: 'Flag every below-floor item',
          detail: 'Compare each current price to its floor. Flag everything priced below it, show the gap in dollars and percent, and sort the flagged list by annual margin impact at current weekly volume.' },
        { title: 'Run the price sensitivity calculation before any change',
          detail: 'Before changing any price, calculate the break-even volume at the new price. Confirm break-even is comfortably below current volume — that is the difference between a confident decision and a guess.' },
        { title: 'Reprice surgically, item by item',
          detail: 'Correct individual items during a routine menu update. A blanket increase reads as a price event and invites guest attention; surgical adjustments rarely produce noticeable feedback.' },
        { title: 'Price each category on its own math',
          detail: 'Spirits, cocktails, beer, wine, and food run different target food costs. Do not apply one percentage across the menu — each category has its own floor.' },
        { title: 'Brief staff on the change',
          detail: 'Tell servers what changed and why before the new menu goes live, and update any item description that needs to support a higher price point.' },
        { title: 'Review quarterly and on immediate triggers',
          detail: 'Run the full review the first week of each quarter. Do not wait for the calendar when a supplier price jumps 8%+, a new item is added, or food cost moves 3+ points above target.' }
      ]
    },

    formulas: [
      { label: 'Price Floor',
        formula: 'Yield-adjusted ingredient cost / target food cost %',
        example: 'Salmon $9.40 cost / 30% target = $31.33 floor — a $28 price is $3.33 below floor' },
      { label: 'Below-Floor Gap',
        formula: 'Current price - price floor',
        example: '$28.00 - $31.33 = -$3.33, or -10.6% below floor' },
      { label: 'Annual Margin Impact of Repricing',
        formula: '(Floor price - current price) x weekly volume x 52',
        example: '$3.33 x 60 covers x 52 = $10,389 recovered at flat volume' }
    ],

    commonMistakes: [
      'Setting prices once at opening and never reviewing them on a schedule — costs change quarterly and a menu drifts below floor within 18 months.',
      'Pricing by competition without calculating your own cost floor first — competitor prices say what the market accepts, your floor says what you need.',
      'Raising all prices at once in a visible refresh — a blanket increase reads as a price event; surgical item-by-item increases rarely draw feedback.',
      'Not yield-adjusting ingredient costs before setting floors — a protein at 30% on raw purchase cost is really 38% once trim loss is included.',
      'Treating the competitive price as a ceiling — if your floor is $16.50 and competitors charge $18, that is $1.50 of pricing room left on every plate.',
      'Skipping the price sensitivity calculation on a high-volume item — knowing the break-even volume before you change the price is what makes the decision confident.'
    ],

    quickRef: {
      rhythm: [
        'Run the price floor calculation on every item whose ingredient cost moved since last review',
        'Flag every item where the current price is below the new floor',
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

    templates: [
      {
        id: 'pricing-review-checklist',
        name: 'Quarterly Pricing Review Checklist',
        intro: 'The quarterly pricing review, on paper, signed off at close. A mental note to reprice an item is an intention — this is the review.',
        fields: [
          { key: 'bar_name',       label: 'Restaurant Name', placeholder: 'Your restaurant' },
          { key: 'review_quarter', label: 'Review Quarter',  placeholder: 'e.g. Q2' }
        ],
        body: 'QUARTERLY PRICING REVIEW\n{{bar_name}} — {{review_quarter}}\n\n'
          + 'STEP 1 — REFRESH COSTS\n'
          + '[ ] Ingredient costs updated for every item with a supplier price change since last review.\n\n'
          + 'STEP 2 — FLOOR CALCULATION\n'
          + '[ ] Price floor recalculated for every affected item (cost / target food cost %).\n'
          + 'Items now below floor: ____________________________________\n'
          + '________________________________________________________\n\n'
          + 'STEP 3 — SENSITIVITY\n'
          + '[ ] Each below-floor item run through the price sensitivity calculation.\n'
          + '[ ] Break-even volume confirmed comfortably below current volume.\n\n'
          + 'STEP 4 — ACTION LIST\n'
          + 'Items to reprice (item / current / new price):\n'
          + '________________________________________________________\n'
          + '________________________________________________________\n'
          + 'Items to remove: __________________________________________\n'
          + 'Items needing new cost cards: _____________________________\n\n'
          + 'STEP 5 — EXECUTE\n'
          + 'Target menu print date: ____________________\n'
          + '[ ] Staff briefed on the changes before the new menu goes live.\n\n'
          + 'Reviewed by: ____________________   Signature: ____________________   Date: __________'
      }
    ],

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
        prompt: 'I need menu descriptions for [NUMBER] items. For each item: name, key ingredients, preparation method, and one beverage pairing suggestion. [PASTE ITEM DETAILS]. Write a menu description for each under 22 words including the preparation method, one specific ingredient detail, and the beverage pairing. No filler — no "fresh", "delicious", "to perfection", or "house-made" unless followed by a specific detail. Format: item name, then description on the next line.',
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
        whatItDoes: 'Creates a seasonal menu item — name, description, and a floor-based recommended price with a server briefing line.',
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
      intro: 'A schedule built before the revenue number is checked is built on habit. A schedule built from a revenue forecast is a plan — and the difference shows up in your labor percentage every week.',
      steps: [
        { title: 'Pull a revenue forecast by day and daypart',
          detail: 'Before writing any names, pull the coming week\'s revenue forecast from POS history, adjusted for known factors. The forecast is the input the whole schedule is built from.' },
        { title: 'Convert the forecast to a labor budget in hours',
          detail: 'For each department and day, revenue forecast times target labor % gives the labor budget in dollars; divide by the loaded hourly wage to get the hours available. Review the hours before writing names.' },
        { title: 'Build the schedule to the budget',
          detail: 'Start with must-have coverage, then fill from there to the budgeted hours. Flag any shift where the proposed schedule exceeds the budget by more than 5%.' },
        { title: 'Manage labor by department, not blended',
          detail: 'Bar, kitchen, and floor have different labor economics. A blended number lets one department running over hide behind the others — budget and review each separately.' },
        { title: 'Calculate labor cost on total labor',
          detail: 'Labor cost % includes wages plus payroll taxes and employer benefits. Total labor runs 10-15% above wages alone — a wages-only number understates the problem every time.' },
        { title: 'Treat overtime as a scheduling error',
          detail: 'Almost all overtime is hours concentrated on too few employees, not a need for more total hours. Redistribute concentrated hours to under-scheduled staff.' },
        { title: 'Run the Monday labor review',
          detail: 'Pull actual labor hours and revenue by department, compare to target, flag any department 2+ points over, and decide whether it was a scheduling error or a revenue miss. One action assigned before the review closes.' }
      ]
    },

    formulas: [
      { label: 'Labor Cost %',
        formula: 'Total labor (wages + taxes + benefits) / Revenue x 100',
        example: 'Wages-only understates labor — total labor runs 10-15% higher' },
      { label: 'Labor Budget ($)',
        formula: 'Revenue forecast x target labor %',
        example: '$7,400 Wednesday forecast x 20% target = $1,480 labor budget' },
      { label: 'Labor Hours Available',
        formula: 'Labor budget $ / loaded hourly wage',
        example: '$1,480 / $14.50 per hour = 102 hours = about 4 servers at a 5-hour shift' }
    ],

    commonMistakes: [
      'Managing labor as a blended total instead of by department — bar, kitchen, and floor have different economics, and one running over hides in the blend.',
      'Building the schedule before checking the revenue forecast — the schedule should be built from a revenue number, not from who worked last week.',
      'Calculating labor percentage on wages only — total labor cost is 10-15% higher than wages, so a wages-only number understates the problem.',
      'Treating overtime as a staffing cost instead of a scheduling error — almost all overtime is hours concentrated on too few people.',
      'Overstaffing slow shifts because it feels safer — an idle server on a slow Tuesday is a labor percentage problem that compounds across the year.',
      'Building a schedule with no revenue reference at all — a schedule without a forecast is a guess.'
    ],

    quickRef: {
      rhythm: [
        'Pull the revenue forecast by day for the coming week from POS history',
        'Enter the forecast by day and department and generate the labor budget in hours',
        'Build the schedule to the budget — must-have coverage first, then fill',
        'Flag any shift where the proposed schedule exceeds the labor budget by more than 5%',
        'Review the schedule with the manager before posting — a budget conversation is easy before, hard after',
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

    templates: [
      {
        id: 'weekly-labor-review',
        name: 'Weekly Labor Review Form',
        intro: 'The Monday labor review, on paper. Completed by the manager on duty so the data is ready before the new schedule is posted.',
        fields: [
          { key: 'bar_name',    label: 'Restaurant Name', placeholder: 'Your restaurant' },
          { key: 'week_ending', label: 'Week Ending',     placeholder: 'e.g. March 9' }
        ],
        body: 'WEEKLY LABOR REVIEW\n{{bar_name}} — Week ending {{week_ending}}\n\n'
          + 'For each department, enter actual hours, actual revenue, and labor %.\n\n'
          + 'BAR\n'
          + 'Actual labor $: __________  Revenue: __________  Labor %: ______  Target: ______\n'
          + 'Variance vs target: ______ points\n\n'
          + 'KITCHEN\n'
          + 'Actual labor $: __________  Revenue: __________  Labor %: ______  Target: ______\n'
          + 'Variance vs target: ______ points\n\n'
          + 'FLOOR\n'
          + 'Actual labor $: __________  Revenue: __________  Labor %: ______  Target: ______\n'
          + 'Variance vs target: ______ points\n\n'
          + 'DIAGNOSIS\n'
          + 'Any department more than 2 points over target: _____________________\n'
          + 'Cause — scheduling error or revenue miss: ________________________\n\n'
          + 'ACTION ITEM (one, assigned before this review closes)\n'
          + 'Action: ____________________________   Owner: ____________________\n\n'
          + 'Completed by: ____________________   Date: __________'
      }
    ],

    aiWorkflows: [
      {
        id: 'ls-ai-1',
        title: 'Build a Revenue-Based Schedule',
        whatItDoes: 'Turns a revenue forecast into a staffing table — labor budget, hours available, and recommended headcount by day and department.',
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
      intro: 'Labor cost percentage tells you the ratio of labor to revenue. RPLH tells you the return on each scheduled hour. You need both — a schedule decision made with only one is missing half the picture.',
      steps: [
        { title: 'Calculate RPLH by shift and department',
          detail: 'Net revenue divided by labor hours, for each shift and each department separately. A blended RPLH hides which department or shift is underperforming.' },
        { title: 'Use RPLH alongside labor percentage',
          detail: 'A department can sit at an acceptable labor % while its RPLH runs well below target. Read the two numbers together to know whether the schedule is actually working.' },
        { title: 'Establish your own 13-week baseline',
          detail: 'Concept benchmarks are a starting orientation only. After one quarter, set each shift\'s RPLH target at roughly 12% above its own 13-week average — that reflects your concept, market, and guest mix.' },
        { title: 'Build the schedule around the RPLH target',
          detail: 'Work backward from the revenue forecast and the RPLH target to the labor hours each shift can support, then staff to that number.' },
        { title: 'Diagnose every below-target shift',
          detail: 'When a shift runs below target, determine whether labor hours ran above budget (a scheduling problem) or revenue ran below what the staffing should produce (a check average problem).' },
        { title: 'Route the fix to the right system',
          detail: 'A scheduling problem is fixed in next week\'s schedule. A check average problem is fixed in the pre-shift briefing — cutting the schedule on a check-average miss fixes nothing.' },
        { title: 'Run the 10-minute Monday RPLH review',
          detail: 'Review last week\'s RPLH by shift before the new schedule is built. Monday review, mid-week build, Thursday post — in that order the review drives the decision.' }
      ]
    },

    formulas: [
      { label: 'Revenue Per Labor Hour (RPLH)',
        formula: 'Net revenue / labor hours (per shift, per department)',
        example: '$7,400 revenue / 102 labor hours = $72.55 RPLH' },
      { label: 'RPLH Target',
        formula: '13-week baseline average x 1.12',
        example: 'A shift averaging $68.75 over 13 weeks sets a target near $77' },
      { label: 'Labor Hours Available at Target',
        formula: 'Revenue forecast / RPLH target',
        example: '$14,200 Friday forecast / $77 target = 184 labor hours for that shift' }
    ],

    commonMistakes: [
      'Using labor percentage alone to evaluate scheduling — percentage is the ratio, RPLH is the return; a decision without both is missing half the picture.',
      'Cutting the schedule when RPLH is low without diagnosing the cause — low RPLH from a check average problem needs an upsell response, not a staffing cut.',
      'Setting RPLH targets once and never updating them — revenue mix shifts seasonally, so a July target may be too aggressive in January.',
      'Tracking RPLH as a blended number across departments — bar, kitchen, and floor generate revenue differently and a blend hides the differences.',
      'Not connecting RPLH data to the pre-shift briefing — servers who know their check average goal change behavior, which moves RPLH.',
      'Treating a single week of low RPLH as a trend — one weak week is noise; four consecutive weeks on the same shift is a structural problem.'
    ],

    quickRef: {
      rhythm: [
        'Enter last week\'s actual revenue and labor hours by shift',
        'Review RPLH vs target by shift — flag any shift more than 10% below target',
        'Check the four-week trend — is RPLH moving toward target or away from it?',
        'Identify whether each below-target shift is a scheduling or a check average problem',
        'If scheduling: adjust next week\'s schedule before it is posted',
        'If check average: add the shift to next week\'s pre-shift briefing focus'
      ],
      benchmarks: [
        { label: 'Bar — peak shift',          target: '$65-85', warning: '$45-65', critical: 'below $45' },
        { label: 'Bar — shoulder shift',      target: '$45-60', warning: '$30-45', critical: 'below $30' },
        { label: 'Full service — peak dinner', target: '$55-75', warning: '$38-55', critical: 'below $38' },
        { label: 'Full service — slow night', target: '$35-50', warning: '$22-35', critical: 'below $22' },
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

    templates: [
      {
        id: 'rplh-review-worksheet',
        name: 'Weekly RPLH Review Worksheet',
        intro: 'The ten-minute Monday RPLH review on paper. Work it before the next schedule is built so the review drives the decision.',
        fields: [
          { key: 'bar_name',    label: 'Restaurant Name', placeholder: 'Your restaurant' },
          { key: 'week_ending', label: 'Week Ending',     placeholder: 'e.g. March 9' }
        ],
        body: 'WEEKLY RPLH REVIEW\n{{bar_name}} — Week ending {{week_ending}}\n\n'
          + 'For each shift: revenue / labor hours = RPLH, compared to target.\n\n'
          + 'SHIFT 1: ____________________\n'
          + 'Revenue: __________  Labor hrs: ______  RPLH: ______  Target: ______\n'
          + 'SHIFT 2: ____________________\n'
          + 'Revenue: __________  Labor hrs: ______  RPLH: ______  Target: ______\n'
          + 'SHIFT 3: ____________________\n'
          + 'Revenue: __________  Labor hrs: ______  RPLH: ______  Target: ______\n'
          + 'SHIFT 4: ____________________\n'
          + 'Revenue: __________  Labor hrs: ______  RPLH: ______  Target: ______\n\n'
          + 'BELOW-TARGET SHIFTS (more than 10% below target)\n'
          + '________________________________________________________\n\n'
          + 'DIAGNOSIS — for each below-target shift, scheduling or check average?\n'
          + '________________________________________________________\n'
          + '________________________________________________________\n\n'
          + 'ACTIONS INTO NEXT WEEK\n'
          + 'Schedule adjustments: ____________________________________\n'
          + 'Shifts added to pre-shift briefing focus: ________________\n\n'
          + 'Completed by: ____________________   Date: __________'
      }
    ],

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
  }

];
