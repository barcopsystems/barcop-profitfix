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
    summary: 'Every menu item is a Star, Plowhorse, Puzzle, or Dog. Each quadrant gets a different action.',

    process: {
      steps: [
        { kind: 'action', target: 'r-menu-items', targetLabel: 'Menu Items',
          title: 'Set up the menu data',
          detail: 'In Menu Items, enter every item with its name, category, current price, and yield-adjusted food cost. The quadrant is only as accurate as this catalog, so refresh an item\'s cost whenever a supplier price moves more than 5%.' },
        { kind: 'result', target: 'r-menu-engineering', targetLabel: 'Menu Engineering',
          title: 'Read the quadrant every quarter',
          detail: 'Menu Engineering plots every item into Stars, Plowhorses, Puzzles, and Dogs, sorted on contribution margin in dollars and sales volume. The percentage tells you structural efficiency. The dollar margin tells you what the item is actually worth. Re-read it the first week of January, April, July, and October.' },
        { kind: 'reference', target: 'Menu_Engineering_Audit.pdf', targetLabel: 'Menu Engineering Review Worksheet',
          title: 'Work the quadrant decisions on the worksheet',
          detail: 'Download the Menu Engineering Review Worksheet and record a decision for every item. Move Stars and high-margin Puzzles into prime menu positions. Some Dogs are buried items with a description problem, not bad items.' },
        { kind: 'action', target: 'r-dog-test', targetLabel: 'Dog Test Tracker',
          title: 'Put each Dog on a 90-day test before you pull it',
          detail: 'A Dog is not always a bad item. In the Dog Test Tracker, start a 90-day test on each Dog: record its baseline weekly volume, move it to a better slot with a rewritten description, and update the volume as the test runs. At day 90 the data, not a hunch, tells you whether to keep it or remove it.' },
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
    ]
  },

  {
    id: 'pricing',
    name: 'Pricing',
    module: 'revenue',
    summary: 'Menus priced by feel drift below cost as ingredients rise.',

    process: {
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
        { kind: 'action', target: 'r-pricing', targetLabel: 'Price Calculator',
          title: 'Model the price change before you commit',
          detail: 'Open the Price Calculator, pull up the flagged item, and enter the price you are considering. It shows the cost floor and the break-even volume: how far weekly sales can fall after an increase before total margin slips below today. Knowing that number before you move a price is what makes the call confident.' },
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
    ]
  },

  {
    id: 'labor-scheduling',
    name: 'Labor Cost and Scheduling',
    module: 'revenue',
    summary: 'Build the schedule from a revenue forecast, not from last week.',

    process: {
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
    ]
  },

  {
    id: 'rplh',
    name: 'Labor Productivity (RPLH)',
    module: 'revenue',
    summary: 'Revenue per labor hour measures what the schedule produces, not just what it costs.',

    process: {
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
    ]
  },

  {
    id: 'check-average',
    name: 'Check Average and Upsell',
    module: 'revenue',
    summary: 'Check average per cover is the floor\'s biggest revenue lever.',

    process: {
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
    ]
  },

  {
    id: 'events-catering',
    name: 'Events and Catering',
    module: 'revenue',
    summary: 'Private dining and catering is revenue most independents leave on the table.',

    process: {
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
    ]
  },

  {
    id: 'server-performance',
    name: 'Server Performance',
    module: 'revenue',
    summary: 'A written standard turns serving from personal style into a trained, measurable job.',

    process: {
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
    ]
  }

];
