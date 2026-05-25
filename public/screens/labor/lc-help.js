'use strict';

/* ── Labor Control — Help and FAQ ─────────────────────────────────────────────
   The in-app knowledge layer for Labor Control. Explains scheduling, hours,
   tips, overtime, call-outs, and how Labor Control feeds Revenue and Profit
   Recovery. Voice and structure match the Recovery help screens for
   consistency across the platform. */

S.LaborHelp = {
  render(container, actions) {
    if (actions) actions.innerHTML = '';
    const sections = [
      { t: 'Getting Started', qa: [
        { q: 'What does Labor Control do?',
          a: 'Labor Control is where everything operational about your team lives: positions and wages, the staff roster, the schedule, actual hours worked, tip distribution, overtime tracking, and call-outs. It is one of three Control systems (Inventory, Labor, Shift) that capture daily operations. Revenue Recovery reads your roster and your hours. Profit Recovery reads your hours for prime cost. Set the labor data once here and Recovery stays current without you typing the same numbers twice.' },
        { q: 'Where do I start?',
          a: 'Four steps to get Labor Control producing real data. First, set up your positions (bartender, server, line cook, etc.) on the Positions screen with department and default wage. Second, build the Staff Roster, assigning each person to a position. Third, build the first week\'s schedule in Build Schedule. Fourth, log the actual hours worked in Log Hours, by hand or by CSV import. Once those four are running, every report and every Recovery feed starts producing live numbers. The Getting Started checklist on the Hub sidebar walks you through the same sequence with a checkbox per task.' },
        { q: 'Do I have to follow this order?',
          a: 'Yes, with one exception. Positions must exist before Staff Roster (you cannot assign someone to a position that does not exist). Staff Roster must exist before Build Schedule (you cannot schedule an empty roster). Build Schedule and Log Hours can run independently once the first two are in place. Skipping the foundation just produces empty schedules and orphaned hour logs.' }
      ]},
      { t: 'Team: Positions and Staff Roster', qa: [
        { q: 'What is the difference between Positions and Staff Roster?',
          a: 'Positions are the job roles you schedule: bartender, server, line cook, barback, dishwasher, manager. Each position has a name, a department (Bar, Front of House, Kitchen, Management, Other), a default wage, and a tipped flag. Staff Roster is the people: each staff member is assigned to a position, and their wage defaults from the position\'s default but is editable per person. Two layers because real bars hire one bartender at $16 and another at $18 for the same role.' },
        { q: 'Why does the wage matter?',
          a: 'Every scheduled or logged hour is costed at the staff member\'s wage. That is what drives labor cost, labor percentage, the overtime projection, and the live cost number on Build Schedule as you assign hours. Wages that have not been updated since the last round of raises mean your numbers understate your actual labor cost every week. Update wages whenever you give a raise, hire at a different rate, or cross a wage-floor increase.' },
        { q: 'How does the Staff Roster connect to Revenue Recovery?',
          a: 'Per platform rule 20, the Staff Roster is the source for Revenue Recovery\'s server list. Any Front of House staff member you add or remove here flows automatically into Revenue Recovery\'s Server Check screen. There is no separate roster to maintain on the Revenue side.' },
        { q: 'What about salaried staff?',
          a: 'Salaried management does not log hours through Labor Control. The roster can still hold their record for organizational completeness, but their cost flows through your P&L as a fixed labor line, not through the hourly calculations here. Bar Cop\'s labor calculations are built for hourly staff, which is where the real scheduling and overtime decisions live.' }
      ]},
      { t: 'Scheduling', qa: [
        { q: 'How does Build Schedule work?',
          a: 'Pick the week, enter a revenue forecast for the week, and start adding shifts. Each shift has a staff member, a day, and start/end times. As you assign hours, Build Schedule shows live labor cost in dollars, labor percentage against your target, projected RPLH against your target, and budgeted versus actual hours by department. Build the schedule to those numbers, not from the gut. Saving sends it to Schedule History.' },
        { q: 'Why start from a revenue forecast?',
          a: 'A schedule built before checking forecast revenue is built on habit. A schedule built from a revenue number is a plan. The difference shows up in labor percentage every week. The forecast at the top of Build Schedule turns into a labor budget in hours and dollars for each department, so the math is done before you write a single name into a slot.' },
        { q: 'What are schedule templates for?',
          a: 'A typical week of shifts saved as a starting point. Build a template once for a normal week (or for a busy week, or for a slow week), then on the Templates screen, apply the template to next week and Build Schedule pre-fills with those shifts. Adjust as needed. Most bars run two or three templates that cover 90 percent of their weeks.' },
        { q: 'Can I edit a saved schedule?',
          a: 'Yes. Open Schedule History, find the week, click Edit. Build Schedule reopens with that week\'s shifts. Your changes update the same schedule record. The history holds every version so you can verify what was originally posted versus what was changed mid-week.' },
        { q: 'What does Schedule History show?',
          a: 'Every saved schedule, sorted newest first. Click a week to see the full shift detail with hours, costs, and projected versus actual. Use the history to spot patterns: which weeks consistently come in over labor budget, which weeks underdeliver on revenue versus the forecast, which staff members get the heaviest schedule. That data drives smarter builds in future weeks.' }
      ]},
      { t: 'Actuals: Log Hours, Daily View, Weekly Summary', qa: [
        { q: 'How do I log actual hours?',
          a: 'Log Hours records what actually happened, which can differ from what was scheduled. Two paths: enter hours manually for each staff member and each day, or import a timeclock or POS hours export with the CSV import button. Each logged hour is costed at the staff member\'s wage. Actual hours are what flows to Revenue and Profit Recovery, not scheduled hours. The difference between scheduled and actual is the variance, which Daily View and Weekly Summary surface.' },
        { q: 'How does the CSV import work?',
          a: 'On Log Hours, click Import CSV and upload your timeclock or POS hours file. Match your columns to Staff Name, Date, and Hours. The mapping is remembered next time, so weekly imports become one click after the first run. Staff names are matched against your roster. Rows that do not match a roster member are skipped and flagged so you can add the missing staff member and re-import.' },
        { q: 'What does Daily View show?',
          a: 'One day at a time: who worked, their start and end times, total hours, total cost, and actual versus scheduled for that day. Use it to spot the day that went over budget and understand why: who clocked in early, who stayed past their scheduled end, where the overtime came from. Daily View is the diagnosis screen for any single day that ran hot.' },
        { q: 'What does Weekly Summary show?',
          a: 'A week rolled up by staff and by day, with labor percentage and RPLH against the week\'s forecast. The screen flags any department running more than 2 points over target. Use it on Monday morning before building the next week. A department that ran over needs a tighter build. A department that ran under needs the cause checked: was it a revenue miss, a call-out, or genuinely lean scheduling that worked.' }
      ]},
      { t: 'Tips', qa: [
        { q: 'What is the Tip Log?',
          a: 'A daily log of cash tips and credit tips by server. Enter at the end of each shift or import from your POS tip report. The Tip Log feeds the Tip Pool Calculator and Tip History, and gives you a clean record for payroll and tip reporting.' },
        { q: 'How does the Tip Pool Calculator work?',
          a: 'Enter a pool amount (or load it from the Tip Log) and add participants. Two distribution methods: split by hours worked (most common, fair to staff who worked longer shifts) or equal split. You can load participant hours straight from the Tip Log so you do not retype them. Saved splits are kept in Tip History for the record. The calculator does not handle every tip-pool legal scenario, so verify your state\'s tip-credit rules before applying any split to payroll.' },
        { q: 'What does Tip History show?',
          a: 'Every saved tip pool distribution, sorted newest first. Click any entry to see the participants, the method, and the per-person payout. Use it as the paper trail for payroll and for any tip-pool dispute. If a staff member questions a payout from three weeks ago, the history shows exactly how the split was calculated and from what pool.' }
      ]},
      { t: 'Reports', qa: [
        { q: 'What is in Labor Reports?',
          a: 'A trend view of labor cost, labor percentage, hours worked, RPLH, and overtime over time. Rolled up by week and by department. Use it to spot drift: a labor percentage creeping up two points over six weeks is a structural problem worth a build review, not a one-week anomaly worth ignoring. The reports also pre-fill the labor sections of the Revenue Audit.' },
        { q: 'What is Overtime Watch?',
          a: 'A live projection of each staff member\'s end-of-week hours from what they have already worked plus what they are scheduled to work. Anyone heading past 40 hours flags. The screen also shows the overtime dollar cost so you can see what concentrating hours on one person is actually costing versus distributing them. Almost all overtime is hours concentrated on too few employees, not a need for more total hours. Redistribute before the schedule goes out, or before the week is over.' },
        { q: 'What is the Call-Out Log?',
          a: 'Every call-out, no-show, and last-minute schedule change, with the date, the staff member, the reason, and who covered. Two reasons to log them. First, you cannot manage a pattern you do not track. A staff member with three call-outs in a month is a coaching conversation that is hard to have without the record. Second, call-outs cost real labor dollars in coverage scrambles, and the log makes that cost visible.' }
      ]},
      { t: 'How Labor Control Feeds Recovery', qa: [
        { q: 'What flows from Labor Control to Revenue Recovery?',
          a: 'Three connections, all read-only on the Revenue side, all always-on (Rule 14). Logged hours feed Revenue This Week labor (the weekly labor cost line). The same hours feed the RPLH Tracker, which divides revenue by labor hours for each shift and department. The Staff Roster (Front of House staff specifically) feeds the Server Check roster (Rule 20). Set labor data once here and Revenue stays current.' },
        { q: 'What flows from Labor Control to Profit Recovery?',
          a: 'Logged hours feed Profit This Week labor (the weekly labor line on the profit side) and the prime cost calculation, which combines labor and COGS as a percentage of revenue. Prime cost is the single most important number in a healthy operation, and Labor Control owns half of it. The other half comes from Inventory Control counts.' },
        { q: 'Why do my labor numbers not match my payroll provider exactly?',
          a: 'Two common reasons. First, Labor Control tracks scheduled and logged hours at the staff wage; payroll calculates with payroll taxes, employer benefits, and bonuses included on top. Total labor cost runs 10 to 15 percent higher than wages alone. Use Labor Control for operational scheduling decisions, and reconcile against your payroll system for accounting. Second, timing: Labor Control runs on your Bar Cop period_end date, payroll runs on your pay period. If the two periods do not align, the numbers will not match week-over-week.' }
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
