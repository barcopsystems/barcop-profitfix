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
          detail: 'In Menu Items, enter every item with its name, category, current price, and yield-adjusted food cost. Update an item\'s cost whenever a vendor price moves more than 5%.' },
        { kind: 'result', target: 'r-menu-engineering', targetLabel: 'Menu Engineering',
          title: 'Read the quadrant and record a decision on every item',
          detail: 'Open Menu Engineering the first week of January, April, July, and October. Rank items by dollar margin and volume, not cost percent, and work the four groups top to bottom. Move Stars and high-margin Puzzles into prime menu positions, and flag any Dog that might just be in a bad slot with a weak description. Export PDF gives you the worked quadrant to take into the menu meeting.' },
        { kind: 'action', target: 'r-dog-test', targetLabel: 'Dog Test Tracker',
          title: 'Put each Dog on a 90-day test before you pull it',
          detail: 'In the Dog Test Tracker, start a 90-day test on each Dog: record its baseline weekly volume, move it to a better slot with a rewritten description, and update the volume as it runs. Keep or cut it on the day-90 number.' },
        { kind: 'action', target: 'r-menu-items', targetLabel: 'Menu Items',
          title: 'Reprice the Plowhorses',
          detail: 'In Menu Items, raise the Plowhorse prices one item at a time. A $2 bump on five Plowhorses beats a 6% raise across the whole menu.' },
        { kind: 'reference', target: 'PreShift_Upsell_Briefing.pdf', targetLabel: 'Pre-Shift Upsell Briefing',
          title: 'Brief servers off the Stars list',
          detail: 'Print the Pre-Shift Upsell Briefing and build it off the current Stars list. Feature only items from that list.' }
      ]
    },

    commonMistakes: [
      'Ranking items on food cost percent instead of margin dollars.',
      'Engineering the menu once and treating it as done. A January menu can have three items below floor by August.',
      'Cutting a Dog before a 90-day test in a better slot.',
      'Leaving Stars stuck in mid-menu positions.',
      'Raising prices across the whole menu instead of item by item. Guests notice a full-menu jump and rarely notice a few targeted bumps.',
      'Running menu engineering without feeding the server briefing. Nothing moves if the floor is not pushing the items.'
    ]
  },

  {
    id: 'pricing',
    name: 'Pricing',
    module: 'revenue',
    summary: 'Reprice on a schedule, not by feel. Go a year without raising prices, which the Revenue Audit flags, and you have eaten every cost increase since.',

    process: {
      steps: [
        { kind: 'action', target: 'r-menu-items', targetLabel: 'Menu Items',
          title: 'Keep ingredient costs current',
          detail: 'In Menu Items, update the yield-adjusted ingredient cost on every item whenever a vendor price moves. Make sure yield loss is in the cost before you recost the item.' },
        { kind: 'result', target: 'r-menu-items', targetLabel: 'Menu Items',
          title: 'Read which items are priced below their floor',
          detail: 'In Menu Items, sort to the items running well over their target cost percent. Fix the worst offenders first.' },
        { kind: 'result', target: 'r-menu-engineering', targetLabel: 'Menu Engineering',
          title: 'Weigh the margin dollars before you reprice',
          detail: 'Open Menu Engineering and sort the items you flagged by dollar margin. Start with the biggest-dollar leaks, not the highest cost percent.' },
        { kind: 'action', target: 'r-menu-engineering', targetLabel: 'Menu Engineering',
          title: 'Model the change in Menu Engineering',
          detail: 'In Menu Engineering, click Reprice on the item. Enter the price you are considering and an expected volume change, and read the new margin, the weekly impact, and the break-even volume drop. Do not move the price until you have that break-even number. Save it as planned or mark it live, and Bar Cop checks it against the real result three weeks later in the Pricing Review Log.' },
        { kind: 'action', target: 'r-menu-items', targetLabel: 'Menu Items',
          title: 'Apply the change directly on Menu Items',
          detail: 'Once you have the number, open the item in Menu Items and update the price. Bar Cop logs the change to the Pricing system on your Recovery Scoreboard, then watches check average and revenue for the eight weeks after. Nothing to mark done.' },
        { kind: 'action', target: 'r-menu-engineering', targetLabel: 'Menu Engineering',
          title: 'Run the full pricing review every quarter',
          detail: 'The first week of each quarter, work the whole menu in Menu Engineering: refresh costs, reprice the items over target, set the menu print date, and confirm servers were briefed before the new menu goes live. The Pricing Review Log at the bottom checks each change against the real result three weeks on.' }
      ]
    },

    commonMistakes: [
      'Setting prices at opening and never reviewing them. A menu drifts below floor within 18 months.',
      'Pricing off the competition without working out your own cost floor first.',
      'Raising all prices at once. Guests notice a full-menu jump and rarely notice a few targeted item bumps.',
      'Setting floors on raw purchase cost. A protein at 30% raw runs 38% once trim loss is in it.',
      'Treating the competitor price as your ceiling. A floor at $16.50 against an $18 street price leaves $1.50 a plate on the table.',
      'Changing a price on a high-volume item without running the break-even first.'
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
          detail: 'In Revenue Forecast, set what you expect to bring in each day Monday through Sunday. Bar Cop pre-fills each day from the last 8 same-weekday weeks; adjust from there. Build Schedule pulls this forecast when you lay shifts in.' },
        { kind: 'action', target: 'lc-build-schedule', targetLabel: 'Build Schedule',
          title: 'Staff to the budget, department by department',
          detail: 'In Build Schedule, fill must-have coverage first, then build out to the budgeted hours. Clear any shift it flags more than 5% over budget. Budget and watch bar, kitchen, and floor separately, never as one blended number.' },
        { kind: 'action', target: 'lc-overtime-watch', targetLabel: 'Overtime Watch',
          title: 'Clear projected overtime before you post',
          detail: 'In Overtime Watch, find anyone heading into overtime on the schedule you just built. Move the concentrated hours to under-scheduled staff before the schedule goes out.' },
        { kind: 'result', target: 'lc-reports', targetLabel: 'Labor History',
          title: 'Run the Monday labor review on total labor',
          detail: 'Every Monday before you build the new schedule, open the Week view in Labor History and read labor cost percent by department against target. It runs on total labor, wages plus payroll taxes and benefits, 10 to 15% above wages alone. Flag any department more than 2 points over, decide whether it was a scheduling error or a revenue miss, and set one action: fix a scheduling error in next week\'s schedule, fix a revenue miss in the pre-shift briefing.' }
      ]
    },

    commonMistakes: [
      'Managing labor as one blended total instead of by department. One overspending department hides in the blend.',
      'Building the schedule before you set the revenue forecast.',
      'Figuring labor percent on wages only. Total labor runs 10 to 15% higher.',
      'Treating overtime as a staffing problem instead of a scheduling one. It is usually hours piled on too few people.',
      'Overstaffing slow shifts because it feels safer. That idle server bleeds your labor percent all week.',
      'Building a schedule with no revenue number behind it.'
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
          detail: 'Every Monday, open This Week and read RPLH for the last saved week next to its labor percent. Flag any week where RPLH is below target even when labor percent looks fine.' },
        { kind: 'action', target: 'settings', targetLabel: 'Settings',
          title: 'Set targets off your own 13-week baseline',
          detail: 'After one quarter of data, set each shift\'s RPLH target in Settings at roughly 12% above its own 13-week average. Lean on a concept benchmark only until you have that quarter.' },
        { kind: 'action', target: 'lc-build-schedule', targetLabel: 'Build Schedule',
          title: 'Build the schedule to the RPLH target',
          detail: 'In Build Schedule, staff to the Target Hours and dollar labor budget the forecast sets. Watch projected RPLH and budget-left as you assign hours.' },
        { kind: 'result', target: 'r-this-week', targetLabel: 'This Week',
          title: 'Diagnose every below-target week',
          detail: 'When RPLH comes in below target, find the cause. Hours over budget: fix it in next week\'s schedule. Revenue under what the staffing should produce: fix it in the pre-shift briefing. Do not cut the schedule on a check average miss.' }
      ]
    },

    commonMistakes: [
      'Judging the schedule on labor percent alone. Read it next to RPLH.',
      'Cutting the schedule on low RPLH without finding the cause. A check average miss needs an upsell push, not a staffing cut.',
      'Setting RPLH targets once and never updating them. A July target can be too steep for January.',
      'Tracking RPLH as one blended number across departments.',
      'Not connecting RPLH to the pre-shift briefing. Give servers a check average goal and the number moves.',
      'Treating one low week as a trend. One week is noise; four in a row on the same shift is a problem.'
    ]
  },

  {
    id: 'check-average',
    name: 'Check Average and Upsell',
    module: 'revenue',
    summary: 'Check average per cover is the floor\'s biggest revenue lever. Beverage attachment, the share of guests who order a drink, is the highest-margin piece of it.',

    process: {
      steps: [
        { kind: 'result', target: 'r-server-check', targetLabel: 'Server Check',
          title: 'Track check average by server',
          detail: 'In Server Check, read sales divided by covers for each server, not total sales. Two servers with the same sales can run very different check averages once you split by covers.' },
        { kind: 'result', target: 'r-server-check', targetLabel: 'Server Scorecard',
          title: 'Set the team baseline and read the spread',
          detail: 'Read the Server Scorecard at the top of Server Check for team average, top performer, and anyone trending down. Give it four weeks for a real baseline, then work the servers flagged below team average. Check the spread for a few coaching cases versus a floor-wide gap.' },
        { kind: 'reference', doc: 'server-standards', targetLabel: 'Server Upsell Standards and Scripts',
          title: 'Train and post the upsell sequence',
          detail: 'Download the Server Upsell Standards and Scripts, post it in the server area, and use it in training. Run the sequence in order: pre-dinner beverage, appetizer, dessert close.' },
        { kind: 'reference', target: 'PreShift_Upsell_Briefing.pdf', targetLabel: 'Pre-Shift Upsell Briefing',
          title: 'Run the pre-shift briefing every shift',
          detail: 'Print the Pre-Shift Upsell Briefing and run it five minutes before doors: today\'s two or three Stars, one check average target for the shift, the upsell sequence, and one named beverage pairing.' },
        { kind: 'action', target: 'r-server-check', targetLabel: 'Server Check',
          title: 'Watch the floor against your standard',
          detail: 'Twice a week at varied times, watch a few tables unannounced against your server upsell standard, then coach off the numbers in Server Check. Is the briefing showing up in how servers work the tables, or not?' },
        { kind: 'result', target: 'r-server-check', targetLabel: 'Server Check',
          title: 'Coach below-average servers from the data',
          detail: 'In Server Check, pull the servers trending down two weeks running. Coach each of them that week, one on one, not the whole team.' }
      ]
    },

    commonMistakes: [
      'Tracking total server sales instead of check average per cover.',
      'Running the briefing without a written form. From memory it changes with whoever has the shift.',
      'Coaching the whole team when only two servers are below average.',
      'Setting check average targets before you have four weeks of real numbers.',
      'Waiting for servers who have the knack instead of training the sequence.',
      'Forgetting the beverage pairing. Name a specific wine or cocktail in the briefing and on the menu.',
      'Not watching beverage attachment. The Revenue Audit reads drinks per guest off your POS; below benchmark means tables sitting without a drink. Make the first-round drink the opening move at every table.',
      'Reading one blended check average. A strong dinner hides a weak lunch. Split it by daypart in the Revenue Audit and give the weak daypart its own menu, staffing, and upsell plan.'
    ]
  },

  {
    id: 'server-performance',
    name: 'Server Performance',
    module: 'revenue',
    summary: 'A written standard makes serving a trained, measured job instead of whatever each server decides it is.',

    process: {
      steps: [
        { kind: 'reference', doc: 'server-standards', targetLabel: 'Server Upsell Standards and Scripts',
          title: 'Write and roll out the server standard',
          detail: 'Download the Server Upsell Standards and Scripts, set your six touch points, and hand it to every active server. Collect a signed acknowledgment, file the copies, and post one in the server area. Brief every manager on it, and put it in front of every new server on day one.' },
        { kind: 'result', target: 'r-server-check', targetLabel: 'Server Check',
          title: 'Measure performance by individual check average',
          detail: 'In Server Check, rank servers by individual check average, not impression and not total sales. The one with the most covers often ranks lower than you would guess.' },
        { kind: 'action', target: 'r-server-check', targetLabel: 'Server Check',
          title: 'Watch the floor against the standard',
          detail: 'Twice a week, watch a few tables unannounced and note which of the six touch points each server is missing, then coach off their own Server Check numbers, not an impression.' },
        { kind: 'result', target: 'r-server-check', targetLabel: 'Server Check',
          title: 'Coach the bottom and recognize the top, from the data',
          detail: 'In Server Check, find who is below team average and trending down, and who is on top. Coach the bottom with their own numbers, never a judgment: their check average against the team average, not "your tables are not selling." Name last week\'s top performer in the briefing.' }
      ]
    },

    commonMistakes: [
      'Managing servers by impression and total sales instead of individual check average.',
      'Running without a written standard. Unwritten, it means something different to every manager.',
      'Coaching the whole team when only two or three servers are below average.',
      'Starting a coaching conversation with judgment instead of the numbers. "Your tables are not selling" is an accusation, not coaching.',
      'Training new servers by shadowing without a written standard. They pick up one person\'s style, not your standard.',
      'Not connecting the briefing Stars list to the upsell sequence.'
    ]
  }

];
