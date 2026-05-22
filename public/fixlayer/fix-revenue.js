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
  }

];
