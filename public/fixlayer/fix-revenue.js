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
  }

];
