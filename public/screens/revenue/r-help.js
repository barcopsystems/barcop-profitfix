'use strict';
S.RevenueHelp = {
  render(container, actions) {
    const sections = [
      { t: 'Getting Started', qa: [
        { q: 'Where do I start?', a: 'Go to Getting Started in the sidebar. It walks you through the 4-week setup in order. Start by setting your revenue targets on the Dashboard, then add your menu items, build your server roster in Settings, and enter your first week of data in This Week. Once you have 4 weeks of data the dashboard, check average trends, and RPLH charts are fully populated.' },
        { q: 'What is the Revenue Recovery module for?', a: 'Revenue Recovery focuses on the other side of the profit equation — not what you spend, but what you capture. It tracks check average by server, labor efficiency by daypart, menu item contribution, and event revenue. If your operation is leaving revenue on the table through low check averages, overstaffing, underpriced menu items, or underutilized event space, this module identifies where and quantifies how much.' },
        { q: 'Do I need to use every section?', a: 'No. Start with Settings, Menu Items, and This Week. Add Menu Engineering, RPLH, and Server Check Average as you build the habit. The audit works with whatever data you have submitted. More data submitted means more sections scored and more specific action items in your monthly Revenue Audit.' },
      ]},
      { t: 'This Week', qa: [
        { q: 'What is Bar Revenue vs Floor Revenue?', a: 'Bar Revenue is all sales rung through the bar department in your POS — drinks served at the bar, bar tabs, and any bar-originated sales. Floor Revenue is all sales from the dining room or floor — tableside food and beverage sold by servers. Keep them separate because they drive different labor targets and RPLH calculations.' },
        { q: 'What are Covers?', a: 'Total guests served during the week. Your POS guest count report. Used to calculate check average. If your POS does not track covers, count receipts. Accuracy here matters because check average is revenue divided by covers — an inflated cover count makes your check average look lower than it is.' },
        { q: 'What is RPLH and why enter it by daypart?', a: 'Revenue Per Labor Hour. Revenue divided by hours worked. Entering it by daypart — lunch, dinner, bar — lets you see which part of your day is most and least efficient. Lunch typically runs lower RPLH than dinner. Knowing the split tells you where to reduce hours, where to cut early, and where you may actually be understaffed relative to volume.' },
        { q: 'What if I do not have department-level labor data?', a: 'Enter your total labor cost and hours in one department and leave the others blank. The blended RPLH and blended labor percentage will still calculate and feed the dashboard. Department-level data unlocks more specific analysis but the weekly entry works without it.' },
      ]},
      { t: 'Check Average', qa: [
        { q: 'Why does check average matter more than total revenue?', a: 'Total revenue is affected by cover count, which you do not fully control. Check average is what your team does with every guest that walks in. A $2 increase in check average across 400 weekly covers is $800 per week — $41,600 per year — with no increase in rent, labor, or overhead. It is the highest leverage number in the system.' },
        { q: 'What is a good performance spread?', a: 'The spread is the gap between your top server check average and your bottom server check average. Under $10 means your team is performing consistently and a standard is being enforced. Over $20 means there is no coaching process — your bottom performers are dragging your team average down significantly every week.' },
        { q: 'How do I use the Upsell Revenue Calculator?', a: 'Enter your current team average, your target, and your weekly cover count. The calculator shows you the weekly and annual revenue gap. Use it when briefing your team — make the gap a number they know. If the team average is $33 and your target is $38 on 400 covers, that is $2,000 per week left on the table. Post it.' },
      ]},
      { t: 'Menu Engineering', qa: [
        { q: 'What does the matrix show?', a: 'It plots every menu item on two axes: contribution margin on the horizontal axis and weekly covers on the vertical. Stars are high margin and high volume — your best items, feature and protect them. Plowhorses are high volume but low margin — consider a price increase. Puzzles are high margin but low volume — they need promotion and server attention. Dogs are low on both — candidates for removal or a full rework.' },
        { q: 'How does the Price Sensitivity Calculator work?', a: 'Select an item, enter a proposed new price, and optionally estimate a volume change percentage. The calculator shows the new contribution margin, the weekly and annual revenue impact, and the breakeven — how many covers you can afford to lose before the price increase stops being beneficial. Run this before any price change.' },
        { q: 'What is the Pricing Log for?', a: 'Every time you log a price change through the Price Sensitivity Calculator it records here automatically. It gives you a dated audit trail of when you changed what and why, and the projected margin impact at the time of the change.' },
        { q: 'How many menu items do I need for the matrix?', a: 'Minimum 4 items with price, cost, and weekly covers all filled in. The matrix uses your own data averages to set the quadrant thresholds — it is not comparing you to industry benchmarks, it is comparing each of your items to the average performance of your own menu.' },
      ]},
      { t: 'Labor Budget and RPLH', qa: [
        { q: 'How does the Labor Budget calculator work?', a: 'It takes the most recent week\'s revenue by department, multiplies by your labor target percentage, and divides by your average hourly wage to give you the maximum schedulable hours before you go over budget. Use it on schedule day before you write names in. If your dinner target is 30% labor and you project $8,400 in dinner revenue, you have $2,520 in labor budget — at $13.50 average wage that is 187 hours to schedule.' },
        { q: 'What is a realistic RPLH target?', a: 'Lunch typically runs $45 to $60 RPLH in full-service operations. Dinner runs $65 to $85. Bar runs $55 to $75. Set your target based on your best recent performance, not an industry average. If your best dinner week produced $78 RPLH, that is a better target than a benchmark number from an operation with a different concept.' },
        { q: 'What does the Optimal Staffing Calculator show?', a: 'Enter a revenue forecast and RPLH target and it tells you exactly how many labor hours you can schedule for that shift to hit your RPLH goal. It also shows the maximum labor dollar budget at your target labor percentage. Use both numbers together — hours gets the schedule right, dollars confirms it is on budget.' },
      ]},
      { t: 'Events and Catering', qa: [
        { q: 'What is an F&B Minimum?', a: 'The minimum food and beverage spend required to book the private dining room or event space for that date and time. It is not a deposit — it is the spend floor. An event that comes in below minimum is an event you gave your space to at a discount. Track compliance rate in the pipeline to see how often minimums are being enforced.' },
        { q: 'How do I use the Rate Card builder?', a: 'Build one package per event type and cover range. A weeknight dinner for 20 to 40 has a different minimum than a Saturday buyout for 80. Once your rate card is built you stop verbal quoting — every inquiry gets a package number. Consistency protects your margins and removes ambiguity in the sales conversation.' },
        { q: 'How does the Catering Pricing Calculator work?', a: 'Enter your food cost per head, bar cost per head, staff hours, and any other costs. Enter your target food cost percentage. The calculator outputs the suggested per-head price, total event revenue, and gross margin. Use it every time you quote a new catering booking to make sure you are pricing to your margin goal, not guessing.' },
      ]},
      { t: 'Revenue Audit', qa: [
        { q: 'How does the Revenue Audit work?', a: 'You upload your POS revenue reports, labor schedule, and any other data files. The audit reads all submitted documents and produces a full scored PDF report covering menu engineering, labor efficiency, server performance, check average trends, and event revenue. More data submitted means more sections scored and more specific action items.' },
        { q: 'What is the minimum data needed?', a: 'Your POS Daily Sales Summary for a minimum of 4 weeks. That produces a Tier 1 audit covering revenue trend, category split, and blended check average. Submitting a Server Sales Report is the single highest-value addition — it unlocks the two server performance sections.' },
        { q: 'How often can I request an audit?', a: 'One audit per month, available at the start of each billing cycle. The countdown on the Revenue Audit screen shows how many days until your next audit is available.' },
        { q: 'When should I request my first audit?', a: 'Request it as soon as you sign up, before you change anything. This becomes your baseline score. After 30 days of using the app and entering weekly data, request your second audit — it will automatically include all your tracked weekly numbers for a significantly deeper analysis.' },
      ]},
      { t: 'Settings', qa: [
        { q: 'What check average target should I set?', a: 'Set it based on your current team average plus a realistic improvement goal. If your team is currently averaging $32, setting $38 immediately may not be achievable. Set $34 first, build the habit, then adjust. Full-service restaurants typically target $35 to $55. Bar-heavy concepts often see $28 to $42. Use your own data as the baseline.' },
        { q: 'What RPLH targets should I set?', a: 'Set them by daypart in Settings. Lunch targets typically run lower than dinner due to lower average checks. Look at your best performing weeks for each daypart and use those as your initial targets. Adjust quarterly as your operation improves.' },
        { q: 'What is the Server Roster for?', a: 'Every server you add to the roster can be tracked individually in This Week and Server Check. Their name appears in the weekly entry form so you log their covers and sales each week. Without a server on the roster their data cannot be tracked. Keep the roster current — remove servers who have left and add new hires before their first week.' },
        { q: 'How do I change my password?', a: 'Go to Settings, scroll to the Account section, enter your new password twice, and click Update Password. Password must be at least 8 characters.' },
      ]},
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
