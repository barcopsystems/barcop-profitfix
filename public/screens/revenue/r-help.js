'use strict';
S.RevenueHelp = {
  render(container, actions) {
    const sections = [
      { t: 'Getting Started', qa: [
        { q: 'Where do I start?',
          a: 'Open Getting Started from the Hub sidebar. It is the unified setup checklist across all six Bar Cop systems, ordered in four phases. Foundation first: operation profile and your targets. Baseline Diagnosis: run all three Audits for a scored snapshot of where you sit on day one. Capture System: stand up Inventory Control, Labor Control, and Shift Control so daily operational data starts feeding Recovery. Weekly Work: the recurring habits that keep the numbers honest from week one onward. Revenue Recovery comes alive once your menu items are entered, Labor Control is feeding your hours, and your first weeks of Shift Control data have populated the cover counts and revenue totals.' },
        { q: 'What is Revenue Recovery and how is it different from Profit Recovery?',
          a: 'Profit Recovery is about cost control: pour cost, food cost, theft, vendor pricing, prime cost. Revenue Recovery is about what your team is actually collecting from every guest who walks through the door. Two operations can run the same food costs and completely different revenues depending on how well their servers sell, how well their menu is priced, and how efficiently their labor is scheduled against their volume. Revenue Recovery tracks check average by server, RPLH by daypart and department, menu contribution margin by item, and private dining revenue. One question: how much money are you capable of making versus how much you are actually making. Those two numbers are almost never the same.' },
        { q: 'Do I need to use every section?',
          a: 'No. Start with three things running every week and you have most of the value: Menu Items (your priced catalog), This Week (the weekly review confirming revenue, covers, and labor that Control fed in), and Server Check (per-server check average tracking). Add Menu Engineering once your item list is built. Add Events and Catering if you do private dining. Add the Price Calculator and Dog Test Tracker when you are working specific pricing or menu decisions. The Revenue Audit works with whatever data exists. More data means more sections scored.' }
      ]},
      { t: 'Revenue Audit', qa: [
        { q: 'How does the audit work?',
          a: 'When you request the audit, Bar Cop pulls your Control data (Labor Control hours and roster, Shift Control shift revenue and covers) plus your menu items, server checks, and weekly history, and produces a full scored audit. Sections scored include menu engineering and pricing, labor cost and scheduling, RPLH and labor productivity, check average and upsell, server performance, and events and catering if you have event records. Every section includes specific action items ranked by annual dollar impact. The audit is generated, not a template. It scores your specific operation against your targets.' },
        { q: 'What is the minimum data needed for a useful audit?',
          a: 'Hub Settings revenue targets, your menu items, plus enough weekly data for the math to mean something. One week is enough to run the audit. Four weeks of weekly numbers is where trend insight starts. By twelve weeks the audit has full statistical confidence in every section it scores. The more Labor Control and Shift Control data you have running, the deeper the analysis goes without you uploading a thing.' },
        { q: 'When should I request my first audit?',
          a: 'Day one. Before you change anything. That becomes your baseline score. After 30 days of Bar Cop running on your real numbers, request the second audit. The comparison between the two is what shows you whether your first month of work is moving the dial.' },
        { q: 'How often can I request an audit?',
          a: 'One every 30 days from your last audit. The audit screen shows a countdown to your next available audit. The 30-day pace gives you enough time to act on the prior audit\'s action items before scoring yourself again.' }
      ]},
      { t: 'Revenue Fix', qa: [
        { q: 'What is the Revenue Fix screen?',
          a: 'The prescriptive part of Revenue Recovery. The Revenue Audit scores your gaps; Revenue Fix is where you close them. Each gap area (Menu Engineering, Pricing, Labor Cost and Scheduling, Labor Productivity, Check Average and Upsell, Events and Catering, Server Performance) has a Fix Process: an ordered list of steps that take you to the exact screen that performs the task. Action steps run a feature (build the schedule, brief servers off the Stars list). Result steps show you a computed number (your check average, your RPLH by daypart). Reference steps download a policy or worksheet. When the work is done, mark the fix implemented with a date and the Recovery Scoreboard starts measuring whether the metric moved.' },
        { q: 'How does the Recovery Scoreboard work?',
          a: 'Every time you mark a Fix Process step implemented, Bar Cop logs the date against the gap it closed. The Scoreboard then watches the metric that gap controls for the next eight weeks. It compares the 8-week average before the fix date to the 8-week average after. The improvement multiplied by your revenue base is the recovered dollar figure. A figure appears once two weeks of after-data exist and stays flagged preliminary until the eight-week window is full. Every dollar on the Scoreboard traces to a real weekly number that moved.' }
      ]},
      { t: 'This Week', qa: [
        { q: 'What is the This Week screen for?',
          a: 'The weekly confirm. Bar Revenue and Floor Revenue auto-fill from Shift Control (the week\'s shifts summed). Covers auto-fill from Shift Control. Labor hours auto-fill from Labor Control. This Week is where you review what Control fed in, override any field if you need to (a missed shift, a partial logging), and save the week to history. You almost never type raw numbers anymore. You confirm.' },
        { q: 'What is the difference between Bar Revenue and Floor Revenue?',
          a: 'Bar Revenue is everything rung through your bar department: drinks at the bar, bar tabs, to-go cocktails, any beverage rung by bartenders. Floor Revenue is everything rung through your dining room: food and beverage sold tableside by your servers. They have different labor targets, different RPLH benchmarks, and different contribution profiles. Blending them hides where your operation is working and where it is not. Shift Control captures both as separate fields per shift, and the weekly sum flows here.' },
        { q: 'What are Covers and where do they come from?',
          a: 'Covers are total guests served during the week. Shift Control captures the cover count per shift from your POS guest count or receipt count. The weekly sum flows into This Week. Getting the cover count right matters more than most operators think because check average is total revenue divided by covers. A 10 percent inflation in your cover count makes your check average look 10 percent lower than it actually is.' },
        { q: 'What if a shift did not get logged in Shift Control?',
          a: 'Open the week in This Week and override the affected field with the figure from your POS. Save the week. The overridden field flags as a manual entry so you can see later which weeks were Control-fed and which were patched. The cleaner answer is also to go back to Shift Control and log the missing shift, which feeds every other system that reads shift data.' },
        { q: 'What if my period does not end on Sunday?',
          a: 'Change the Period End Date in This Week to whatever day your accounting week closes. Bar Cop does not enforce a specific day. Whatever date you enter is what appears in your history and reports. The key is consistency. Pick a day and stay with it every week.' }
      ]},
      { t: 'Server Check', qa: [
        { q: 'What is Server Check?',
          a: 'Per-server check average tracking. The roster auto-syncs from Labor Control\'s Front of House staff (Rule 20), so any server you add or remove in Labor Control shows up here automatically. Each server\'s sales divided by their covers is their check average. The screen shows the team average, the spread between top and bottom servers, and the trend line for each individual.' },
        { q: 'Why is check average per server better than total sales per server?',
          a: 'Total sales hides the productivity difference when cover counts differ. Two servers with identical total sales can have very different check averages if one served 80 covers and the other served 110. The 80-cover server is generating more revenue per guest, which is what coaching can replicate across the team. Total sales tells you who works the busy shifts. Check average tells you who is actually selling.' },
        { q: 'What does the performance spread mean?',
          a: 'The gap between your highest check average server and your lowest over the same period. A spread under ten dollars typically means someone is actively coaching and holding a standard. A spread over twenty dollars means no standard exists or no one is enforcing it. The spread tells you your revenue recovery opportunity. If your bottom three servers averaged five dollars below the team average last month on 900 covers, that is 4,500 dollars in revenue underperformance that coaching could fix.' },
        { q: 'How often should I review server check averages?',
          a: 'Weekly. After This Week saves, pull up Server Check and scan the table. Look for three things: whether the team average moved toward or away from your target, whether any server dropped significantly from the prior week, and whether your top performers stayed consistent. A server who drops five dollars week over week usually has a reason. A server who consistently sits at the bottom needs direct coaching with a specific target and a follow-up date.' }
      ]},
      { t: 'Menu Items', qa: [
        { q: 'What is Menu Items for?',
          a: 'Your priced catalog. Every item on the menu with its name, category, current price, ingredient cost (yield-adjusted), and contribution margin. This is the data Menu Engineering plots, the Price Calculator pulls from, the Dog Test Tracker references, and the Revenue Audit scores. Keep it current. An item with a stale cost shows the wrong margin and the wrong quadrant on the matrix.' },
        { q: 'What is yield-adjusted cost and why does it matter?',
          a: 'The actual cost per plate after trim loss, prep waste, and portion variance. Raw purchase cost understates the real number. A protein at 30 percent of menu price on raw purchase cost is 38 percent once trim loss is in it. Set the yield-adjusted cost as your cost on each item and your margins read honestly.' },
        { q: 'How many items should I enter?',
          a: 'Every item that runs on the menu. The minimum to get Menu Engineering rendering is four items with price, cost, and weekly covers. Ten items produces a real picture. The matrix compares each item against your own menu averages, so the more items entered, the more accurate the average lines and the more precisely each item lands in its quadrant.' }
      ]},
      { t: 'Menu Engineering', qa: [
        { q: 'How does the matrix work?',
          a: 'The matrix plots every menu item against contribution margin in dollars and weekly covers. The dividing lines sit at your menu\'s average margin and average cover count, so every item is compared against your own menu rather than an external benchmark. Stars are high margin and high volume. Protect their recipe, feature them prominently, brief servers to sell them. Plowhorses are high volume but low margin, popular items that are not earning their keep. These are first candidates for a price increase because guests already order them. Puzzles are high margin but low volume, items your operation makes good money on when they sell but servers are not moving. These need promotion, pre-shift attention, and better placement. Dogs are low on both, candidates for a 90-day Dog Test in a repositioned slot before removal.' },
        { q: 'When should I run menu engineering?',
          a: 'Quarterly. First week of January, April, July, October. Costs move and seasons shift, and a January menu can have three items below floor by August. Each review takes about an hour once your data is entered.' },
        { q: 'What does "the analysis is on margin, not cost percent" mean?',
          a: 'Operators often run menu engineering on food cost percentage because that is what the back office reports. That is a structural efficiency number. Contribution margin in dollars is what the item is actually worth to your operation. An item at 32 percent cost with a 3 dollar margin earns less per cover than an item at 38 percent cost with a 9 dollar margin. The percentage tells you efficiency. The dollar tells you what to feature.' }
      ]},
      { t: 'Price Calculator', qa: [
        { q: 'What does the Price Calculator do?',
          a: 'A what-if tool for the Pricing gap-area. Pick a menu item, the calculator pulls its current price and cost from Menu Items, and you enter a proposed price. It shows the cost floor, the new contribution margin per item, the weekly revenue impact at current volume, the annual impact, and the break-even volume. Break-even tells you how far weekly sales can fall after the increase before total margin slips below today. Knowing that number before you move the price is what makes the call confident.' },
        { q: 'Does the calculator save my changes?',
          a: 'No. The Price Calculator is pure what-if math. Nothing is saved. When you decide to actually move a price, update it on the item in Menu Items, and the new price flows everywhere else.' },
        { q: 'How should I use the calculator?',
          a: 'Before every price change on a high-volume item. Most operators are surprised by how large a volume drop they can absorb on a well-priced item before the increase becomes net negative. Run the calculator first, see the break-even, then decide. The math usually supports the increase more than the gut feeling does.' }
      ]},
      { t: 'Dog Test Tracker', qa: [
        { q: 'What is the Dog Test Tracker?',
          a: 'A Dog (low margin, low volume) on the menu is not always a bad item. Some are buried items with a description problem or a poor menu position, not bad dishes. Before pulling one, give it a 90-day test in a repositioned slot with a rewritten description, and track whether the volume actually moves. The Dog Test Tracker holds each test: the baseline weekly volume, the test start date, the running 7-day average, and the day count toward 90.' },
        { q: 'When should I start a Dog Test?',
          a: 'When Menu Engineering surfaces an item in the Dog quadrant and your gut says it deserves a second chance. Record the baseline cover count, move the item to a better slot on the menu, rewrite the description, and start the test. At day 90 the data tells you whether to keep it or pull it.' },
        { q: 'What if a Dog Test fails?',
          a: 'Pull the item, simplify the menu, recover the slot for a better-performing item. A failed Dog Test is a feature, not a problem. You walked the methodology, the data answered, you act on it. That is one less item carrying menu cost, prep complexity, and inventory drag.' }
      ]},
      { t: 'RPLH Tracker', qa: [
        { q: 'What is RPLH?',
          a: 'Revenue Per Labor Hour. Total revenue for a period divided by total labor hours worked in that period. It measures how efficiently your scheduled labor is generating revenue. The hours come straight from Labor Control\'s actuals (`lc_actuals`), so the figure is live without you typing anything.' },
        { q: 'Why does Bar Cop break RPLH out by department?',
          a: 'Bar, kitchen, and floor generate revenue differently and a blended number hides the differences. Your dinner floor shift might be running 80 dollars RPLH while your lunch shift drags at 38. Blend them and you see 59 and think the operation is acceptable. With the split you see that lunch is overstaffed for its volume, or that dinner is generating strong revenue per hour and may have room for the right person on the right night. Each daypart has its own target in Hub Settings.' },
        { q: 'What are realistic RPLH targets to start with?',
          a: 'In full-service operations, lunch typically runs between 45 and 60 dollars RPLH, dinner between 65 and 90, and bar between 55 and 75. These are ranges, not rules. The most reliable way to set your targets is to pull eight weeks of your own data, find your three best-performing weeks per daypart, and use the average of those three. That is a number you have actually hit, which means it is achievable again with the right schedule.' },
        { q: 'How do I use RPLH to diagnose a slow shift?',
          a: 'When RPLH runs below target on a shift, decide what drove it. Labor hours above budget is a scheduling problem, fixed in next week\'s schedule by tightening the build. Revenue below what the staffing should produce is a check average problem, fixed in pre-shift with a server briefing. Cutting the schedule on a check average miss fixes nothing.' }
      ]},
      { t: 'Check Average', qa: [
        { q: 'Why is check average the most important number in Revenue Recovery?',
          a: 'Because it is the one revenue metric your team directly controls on every shift. Cover count depends on reservations, weather, events, competition, marketing. None of that is in your servers\' hands in the moment. Check average is entirely within your team\'s influence. A two dollar increase on 400 weekly covers is 800 dollars a week. That is 41,600 dollars a year added to revenue with zero increase in rent, zero increase in food cost, and zero additional marketing spend. No other lever in the operation produces that kind of return with that little investment.' },
        { q: 'How do I use the Upsell Revenue Calculator?',
          a: 'Enter your current team check average, your target, and your typical weekly cover count. The calculator shows the exact weekly and annual revenue gap between where you are and where you are trying to go. Run it before your next pre-shift and put the number on a whiteboard. If your team average is 33 dollars and your target is 38 on 400 weekly covers, that is 2,000 dollars per week your team is not capturing. 104,000 dollars a year. Make the number visible. Teams that know the gap perform differently than teams that never see it.' },
        { q: 'What check average target should I set?',
          a: 'Start with your actual current team average, not an industry number. Pull your last four weeks from This Week and calculate what your team has been averaging. Set a target that represents a realistic improvement: five to eight percent in the first 90 days is achievable through coaching and pre-shift focus without any menu changes. A 20 percent jump in the same window is not. An unreachable target produces a dashboard that is always red, which teams learn to ignore. Hit your first target in 60 days, then move it up.' }
      ]},
      { t: 'Events and Catering', qa: [
        { q: 'What is the Events Pipeline?',
          a: 'A tracker for every event inquiry from first contact through booked-or-cold. Log every inquiry the day it comes in, not after it books. The pipeline captures the full conversion funnel: inquiries that become proposals, proposals that become confirmed bookings, confirmed bookings that complete, and inquiries that go cold. Over time this data shows you your actual close rate. If you have 12,000 dollars in open proposals at a 40 percent close rate, your projected bookings from that pipeline are 4,800 dollars.' },
        { q: 'What is an F and B Minimum?',
          a: 'The food and beverage minimum is the floor spend required to book your private dining room or event space for a given date and time. Not a deposit, not a per-person charge. It is the total food and beverage spend the party must reach to secure the space. If a party comes in below minimum, you gave the room away at a subsidized rate and blocked the space from other bookings that night.' },
        { q: 'How do I build an effective Rate Card?',
          a: 'Build one package entry for each distinct combination of event type, day of week, and cover range. A Tuesday corporate dinner for 20 to 35 guests has a different minimum than a Saturday social buyout for 60 to 100. Once built, every inquiry gets a package reference instead of a verbal quote. Three reasons this matters. First, consistency across whoever takes the booking. Second, it removes the margin erosion that happens when managers negotiate under social pressure. Third, it gives you a record of what was quoted before the event, which protects you in any post-event dispute.' },
        { q: 'How does the Catering Pricing Calculator work?',
          a: 'Enter your food cost per head, bar cost per head, the staff hours required, and any fixed costs like rentals or outside vendors. Then enter your target food cost percentage. The calculator pulls a default staff wage from Labor Control\'s Front of House staff (the average of their hourly rates) and outputs the minimum per-head price required to hit your margin target, the total event revenue at that price, and the gross margin in dollars. Run it before quoting every catering booking. Operators who quote from instinct almost always underprice catering relative to actual cost.' }
      ]},
      { t: 'Reports and History', qa: [
        { q: 'What does Reports and History show?',
          a: 'Every Revenue Recovery week you have saved, sorted newest first. Bar and floor revenue, covers, check average, RPLH by daypart, labor percentage, and the trend line. Click any week to see the full detail and the breakdown by department. Use the history to spot the weeks that ran outside the norm and understand why. A week where check average dropped is worth reviewing alongside Server Check for that period to find which servers moved the number.' },
        { q: 'Can I export the weekly history?',
          a: 'Yes. Every Reports screen has an Export to PDF button in the top right. The PDF uses the same print stylesheet as the screen and produces an accountant-friendly layout. Save it monthly and you have a clean revenue trail.' }
      ]},
      { t: 'Settings', qa: [
        { q: 'Where do I set my revenue targets?',
          a: 'In Hub Settings, on the Revenue Targets card. Check Average, Bar Labor percent, Kitchen Labor percent, Floor Labor percent, RPLH Lunch, RPLH Dinner, RPLH Bar, and Event Close Rate. Industry benchmarks are pre-filled. Adjust them to your operation. Click Save Data when you change them.' },
        { q: 'What RPLH targets should I set by daypart?',
          a: 'Set each daypart target separately because lunch, dinner, and bar operate at fundamentally different revenue levels relative to their labor requirements. Pull your last eight weeks of RPLH data by daypart, find your three best-performing weeks per daypart, and use the average of those three as your target. This anchors the target to something you have actually achieved. Revise targets quarterly. As volume and team performance grow, aspirational targets become floors and you push them higher.' },
        { q: 'What are the labor target percentages for?',
          a: 'The labor target percentages drive the labor variance display in This Week and the labor scoring in the Revenue Audit. Set them based on your ownership goals and concept type. Bar labor 25 to 30 percent is typical for a bar-heavy operation. Kitchen labor 28 to 34 percent covers most full-service kitchens. Floor labor 28 to 35 percent covers most front-of-house operations. Prime cost (labor plus COGS combined) should not exceed 60 to 62 percent of revenue in a healthy operation.' },
        { q: 'Where do I manage my server roster?',
          a: 'In Labor Control, on the Staff Roster screen. The Revenue Recovery server list auto-syncs from there (Rule 20). Any Front of House staff member you add in Labor Control appears in Server Check automatically. The single source of truth for staff and wages is Labor Control, so there is no separate roster to maintain in Revenue Recovery.' },
        { q: 'How do I change my password?',
          a: 'Hub Settings, the Account card. Enter your new password twice, click Update Password. Password must be at least 8 characters.' }
      ]}
    ];

    const sectionsHtml = sections.map(sec => {
      const items = sec.qa.map(f =>
        '<div style="border-bottom:1px solid var(--b2);padding:14px 0;">'
        + '<div style="font-size:12px;font-weight:700;color:var(--t1);margin-bottom:6px;cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'">' + esc(f.q) + '</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.7;display:none;">' + esc(f.a) + '</div>'
        + '</div>'
      ).join('');
      return '<div class="card" style="margin-bottom:14px;">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);margin-bottom:12px;">' + esc(sec.t) + '</div>'
        + items
        + '</div>';
    }).join('');

    container.innerHTML = '<div class="screen">' + sectionsHtml + '</div>';
  }
};
