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
          detail: 'In Menu Items, enter every item with its name, category, current price, and yield-adjusted food cost. Garbage in here means a garbage quadrant, so refresh an item\'s cost whenever a supplier price moves more than 5%.' },
        { kind: 'result', target: 'r-menu-engineering', targetLabel: 'Menu Engineering',
          title: 'Read the quadrant every quarter',
          detail: 'Menu Engineering plots every item into Stars, Plowhorses, Puzzles, and Dogs, sorted on margin in dollars and sales volume. Watch the dollar margin, not just the cost percent, a tight-percent item can still be a small-dollar earner. Re-read it the first week of January, April, July, and October.' },
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
          detail: 'Print the Pre-Shift Upsell Briefing and build it off the current Stars list. Pricing and position mean nothing if the servers do not know what to push, so every item you feature comes off that list.' }
      ]
    },

    commonMistakes: [
      'Running it on food cost percent instead of margin dollars. Percent will not tell you a $4 item is outselling a $9 one ten to one.',
      'Engineering the menu once and treating it as done. Costs move and seasons shift, and a January menu can have three items below floor by August.',
      'Removing Dogs without a 90-day test in a repositioned slot. Some Dogs are buried items with a description problem, not bad items.',
      'Leaving Stars in mid-menu positions because they sell anyway. A Star in a prime position with server promotion typically lifts orders 15 to 25%.',
      'Announcing price increases across the board instead of surgically. A targeted increase on a few Plowhorses is far less visible than a blanket raise.',
      'Running menu engineering without tying it to the server briefing. All the positioning work is wasted if nobody on the floor is pushing the items.'
    ]
  },

  {
    id: 'pricing',
    name: 'Pricing',
    module: 'revenue',
    summary: 'Menus priced by feel drift below cost as ingredients rise. Going more than a year without a price increase, which the Revenue Audit flags, means you have absorbed every cost increase since.',

    process: {
      steps: [
        { kind: 'action', target: 'r-menu-items', targetLabel: 'Menu Items',
          title: 'Keep ingredient costs current',
          detail: 'In Menu Items, refresh the yield-adjusted ingredient cost on every item whenever a supplier price moves. A protein priced on raw purchase cost reads cheaper than it really is until trim loss is in it.' },
        { kind: 'result', target: 'r-menu-items', targetLabel: 'Menu Items',
          title: 'Read which items are priced below their floor',
          detail: 'Menu Items shows each item\'s cost percent and dollar margin. An item running well over its target cost percent is priced below its floor. The worst offenders are the biggest annual margin leaks, so start there.' },
        { kind: 'result', target: 'r-menu-engineering', targetLabel: 'Menu Engineering',
          title: 'Weigh the margin dollars before you reprice',
          detail: 'Open Menu Engineering and read the dollar margin on the items you flagged. Percent flags that an item is underpriced, but the dollar margin and the volume tell you which fix is actually worth chasing, so start with the biggest-dollar items.' },
        { kind: 'action', target: 'r-price-calc', targetLabel: 'Price Calculator',
          title: 'Model the change on the Price Calculator',
          detail: 'Open the Price Calculator, or click Reprice on the item in Menu Engineering to land there with it preselected. Type the price you are considering and a volume change estimate. Bar Cop shows the cost floor, new margin, weekly and annual impact, and the break-even volume drop you can absorb before total margin slips. Know that number before you touch the price. The Log Price Change button saves the entry so Bar Cop can check it against the real result three weeks later.' },
        { kind: 'action', target: 'r-menu-items', targetLabel: 'Menu Items',
          title: 'Apply the change directly on Menu Items',
          detail: 'Once you have the number, open the item on Menu Items and update the price. Bar Cop logs the change and ties it to the Pricing system on your Recovery Scoreboard on its own. The Scoreboard then watches check average and revenue for the eight weeks after and surfaces the recovered dollars, with nothing for you to mark done. Surgical, item-by-item changes rarely draw guest feedback; a blanket increase reads as a price event.' },
        { kind: 'reference', target: 'Quarterly_Pricing_Review.pdf', targetLabel: 'Quarterly Pricing Review Checklist',
          title: 'Run the full pricing review every quarter',
          detail: 'Download the Quarterly Pricing Review checklist and work it the first week of each quarter. It refreshes costs, lists the items to reprice and the items to remove, sets the menu print date, and confirms servers were briefed on the changes before the new menu goes live.' }
      ]
    },

    commonMistakes: [
      'Setting prices once at opening and never reviewing them on a schedule. Costs change quarterly and a menu drifts below floor within 18 months.',
      'Pricing off the competition without working out your own cost floor first. Their price tells you what the market will take, not what you need to clear on the plate.',
      'Raising all prices at once in a visible refresh. A blanket increase reads as a price event. Surgical item-by-item increases rarely draw feedback.',
      'Not yield-adjusting ingredient costs before setting floors. A protein at 30% on raw purchase cost is 38% once trim loss is in it.',
      'Treating the competitive price as a ceiling. If your floor is $16.50 and competitors charge $18, that is $1.50 of pricing room left on every plate.',
      'Skipping the Price Calculator check on a high-volume item. Move the price without the break-even number and you are flying blind on your highest-volume plates.'
    ]
  },

  {
    id: 'labor-scheduling',
    name: 'Labor Cost and Scheduling',
    module: 'revenue',
    summary: 'Build the schedule from a revenue forecast, not from last week.',

    process: {
      steps: [
        { kind: 'action', target: 'r-forecast', targetLabel: 'Revenue Forecast',
          title: 'Set the revenue forecast for the coming week',
          detail: 'Open Revenue Forecast in Revenue Recovery and set what you expect to bring in each day Monday through Sunday. Bar Cop pre-fills each day from the last 8 same-weekday weeks, so you are tuning a real number, not guessing. Build Schedule reads this forecast automatically when you lay shifts in.' },
        { kind: 'action', target: 'lc-build-schedule', targetLabel: 'Build Schedule',
          title: 'Staff to the budget, department by department',
          detail: 'Fill must-have coverage first, then build out to the budgeted hours. Build Schedule flags any shift that runs more than 5% over budget. Bar, kitchen, and floor have different labor economics, so budget and watch each one on its own. A blended number lets one department running over hide behind the others.' },
        { kind: 'action', target: 'lc-overtime-watch', targetLabel: 'Overtime Watch',
          title: 'Clear projected overtime before you post',
          detail: 'Overtime Watch shows who is heading into overtime on the schedule you just built. Almost all overtime is hours concentrated on too few employees, not a need for more total hours. Redistribute the concentrated hours to under-scheduled staff before the schedule goes out.' },
        { kind: 'result', target: 'lc-reports', targetLabel: 'Labor Reports',
          title: 'Read labor cost on total labor',
          detail: 'After the week, the Week view in Labor Reports shows labor cost percent by department against target. It is built on total labor, wages plus payroll taxes and employer benefits, which runs 10 to 15% above wages alone. A wages-only number understates the problem every week.' },
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
      'Overstaffing slow shifts because it feels safer. That idle server on a dead Tuesday bleeds your labor percent every week you let it ride.',
      'Building a schedule with no revenue number behind it. Staff to a forecast or you are just guessing at coverage.'
    ]
  },

  {
    id: 'rplh',
    name: 'Labor Productivity (RPLH)',
    module: 'revenue',
    summary: 'Revenue per labor hour measures what the schedule produces, not just what it costs.',

    process: {
      steps: [
        { kind: 'result', target: 'r-this-week', targetLabel: 'This Week',
          title: 'Read your weekly RPLH every Monday',
          detail: 'This Week\'s history shows revenue per labor hour for each saved week, with the labor hours pulled straight from Labor Control, next to your labor percentage. Read it every Monday before the new schedule is built. A week can sit at an acceptable labor percent while its RPLH runs well below target.' },
        { kind: 'action', target: 'settings', targetLabel: 'Settings',
          title: 'Set targets off your own 13-week baseline',
          detail: 'Concept benchmarks are a starting point only. After one quarter of data, set each shift\'s RPLH target in Settings at roughly 12% above its own 13-week average. Your own numbers fit your room better than any benchmark off a chart ever will.' },
        { kind: 'action', target: 'lc-build-schedule', targetLabel: 'Build Schedule',
          title: 'Build the schedule to the RPLH target',
          detail: 'In Build Schedule, the week\'s revenue forecast becomes a Target Hours number (the labor hours that revenue supports at your RPLH target) and a dollar labor budget. Staff to those, watching projected RPLH and budget-left update live as you assign hours.' },
        { kind: 'result', target: 'r-this-week', targetLabel: 'This Week',
          title: 'Diagnose every below-target week',
          detail: 'When a week\'s RPLH comes in below target, decide what drove it. Labor hours above budget is a scheduling problem, fixed in next week\'s schedule. Revenue below what the staffing should produce is a check average problem, fixed in the pre-shift briefing. Cutting the schedule on a check average miss fixes nothing.' }
      ]
    },

    commonMistakes: [
      'Judging the schedule on labor percent alone. Percent is the cost side; RPLH is what those hours brought back. You need both to make the call.',
      'Cutting the schedule when RPLH is low without diagnosing the cause. Low RPLH from a check average problem needs an upsell response, not a staffing cut.',
      'Setting RPLH targets once and never updating them. Revenue mix shifts seasonally, so a July target may be too aggressive in January.',
      'Tracking RPLH as a blended number across departments. Bar, kitchen, and floor generate revenue differently and a blend hides the differences.',
      'Not connecting RPLH to the pre-shift briefing. Give servers a check average goal for the shift and the number moves.',
      'Treating a single week of low RPLH as a trend. One weak week is noise. Four consecutive weeks on the same shift is a structural problem.'
    ]
  },

  {
    id: 'check-average',
    name: 'Check Average and Upsell',
    module: 'revenue',
    summary: 'Check average per cover is the floor\'s biggest revenue lever, and beverage attachment (the share of guests who order a drink) is the highest-margin piece of it.',

    process: {
      steps: [
        { kind: 'result', target: 'r-server-check', targetLabel: 'Server Check',
          title: 'Track check average by server',
          detail: 'Server Check shows sales divided by covers for each individual server. Total sales hides the productivity difference. Two servers with identical sales can have very different check averages if their cover counts differ, and that difference is where the money is.' },
        { kind: 'result', target: 'r-server-check', targetLabel: 'Server Scorecard',
          title: 'Set the team baseline and read the spread',
          detail: 'The Server Scorecard at the top of Server Check shows team average, top performer, and any servers trending down. Four weeks of data gives you a real baseline. Servers running below team average get flagged. The spread tells you whether you have a few coaching cases or a system-wide gap.' },
        { kind: 'reference', target: 'Server_Upsell_Standards_Scripts.docx', targetLabel: 'Server Upsell Standards and Scripts',
          title: 'Train and post the upsell sequence',
          detail: 'Download the Server Upsell Standards and Scripts, post it in the server area, and use it in training. Pre-dinner beverage, appetizer, dessert close, in that order. It is a sequence, not a knack. Write it down and train it, and every server runs it.' },
        { kind: 'reference', target: 'PreShift_Upsell_Briefing.pdf', targetLabel: 'Pre-Shift Upsell Briefing',
          title: 'Run the pre-shift briefing every shift',
          detail: 'Print the Pre-Shift Upsell Briefing and run it five minutes before doors open: today\'s two or three Stars, one specific check average target for the shift, the upsell sequence, and one named beverage pairing. A written form keeps it consistent across managers.' },
        { kind: 'reference', target: 'Table_Visit_Audit.pdf', targetLabel: 'Table Visit Audit',
          title: 'Audit the floor with table visit audits',
          detail: 'Run two unannounced table visit audits a week with the Table Visit Audit form. They tell you whether the briefing actually changed anything on the floor. Brief without auditing and you are just talking to yourself.' },
        { kind: 'result', target: 'r-server-check', targetLabel: 'Server Check',
          title: 'Coach below-average servers from the data',
          detail: 'Server Check identifies the servers trending down two weeks in a row. Each one gets a coaching conversation that week. Coach the two who need it, not the whole team. A general sell-more message creates resistance from the servers already performing.' }
      ]
    },

    commonMistakes: [
      'Tracking total server sales instead of check average per cover. Total sales hides the productivity difference when cover counts differ.',
      'Running the briefing without a written form. Do it from memory and it changes with whoever is running the shift.',
      'Coaching the whole team when only two servers are below average. A general message has no impact on the two who need it and creates resistance from the rest.',
      'Setting check average targets before you have four weeks of real numbers to set them off.',
      'Waiting for servers who have the knack instead of training the sequence. Write it down and every server can run it.',
      'Forgetting the beverage pairing. A specific wine or cocktail pairing in the briefing and the menu description converts higher than any other upsell.',
      'Not watching beverage attachment. The Revenue Audit reads your drinks per guest off the POS. Below the benchmark means tables are sitting without a drink in front of them, the single biggest margin leak on the floor. Make the first-round drink the opening move at every table.',
      'Reading one blended check average. A healthy dinner can hide a bleeding lunch. The Revenue Audit splits check average by daypart when your POS breaks it out. A wide spread means the weak daypart needs its own menu, staffing, and upsell focus, not the same plan as your strong one.'
    ]
  },

  {
    id: 'server-performance',
    name: 'Server Performance',
    module: 'revenue',
    summary: 'A written standard makes serving a trained, measured job instead of whatever each server decides it is.',

    process: {
      steps: [
        { kind: 'reference', target: 'Server_Upsell_Standards_Scripts.docx', targetLabel: 'Server Upsell Standards and Scripts',
          title: 'Write and roll out the server standard',
          detail: 'Download the Server Upsell Standards and Scripts, set your six touch points, and distribute it to every active server. Collect a signed acknowledgment, file the signed copies, and post a copy in the server area. Brief every manager on it so a server hears the same expectations from whoever is on the floor. New servers learn the written standard on day one instead of picking up someone else\'s habits.' },
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
      'Running without a written standard. If it is not written down it means something different to every manager, and you cannot train to it or hold anyone to it.',
      'Coaching the whole team when only two or three servers are below average. A "sell more" speech has no impact on the people who need it and creates resistance from the ones already producing.',
      'Starting the coaching conversation with judgment rather than data. The numbers are a coaching conversation. "Your tables are not selling" is an accusation.',
      'Training new servers by shadowing without a written standard. They learn another server\'s personal style, not a consistent standard.',
      'Not connecting the briefing Stars list to the upsell sequence. Servers who walk in knowing what to push beat the ones deciding table by table.'
    ]
  }

];
