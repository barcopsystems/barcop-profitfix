'use strict';

/* ── Labor Control — Help and FAQ ─────────────────────────────────────────────
   The in-app knowledge layer for Labor Control. One topic at a time on the same
   underline tab switcher used by Cash History, Reports, and Shift Help, plus a
   live search box that filters questions across every topic. Content tracks the
   current Labor Control: positions, the staff roster with certifications and the
   coaching log, scheduling, hours, tips, pay periods with payroll close-lock and
   tip-credit compliance, overtime, and how Labor feeds Revenue, Profit, Shift,
   and Accounting. */

S.LaborHelp = {
  tab: 0,
  query: '',

  SECTIONS: [
    { t: 'Getting Started', qa: [
      { q: 'What does Labor Control do?',
        a: 'Labor Control is where everything operational about your team lives: positions and wages, the staff roster, certifications and expiration tracking, the schedule, actual hours worked, tip distribution, overtime watch, pay periods with payroll close-lock, call-outs, and a coaching log per staff member. It is one of three Control systems (Inventory, Labor, Shift) that capture daily operations. Revenue Recovery reads your roster and your hours. Profit Recovery reads your hours for prime cost. Set the labor data once here and Recovery stays current without you typing the same numbers twice.' },
      { q: 'Where do I start?',
        a: 'Four steps to get Labor Control producing real data. First, set up your positions (bartender, server, line cook, etc.) on the Positions screen with department, default wage, and a tipped flag where it applies. Second, build the Staff Roster, assigning each person to a position and capturing any certifications they hold. Third, build the first week\'s schedule in Build Schedule. Fourth, log the actual hours worked in Log Hours, by hand or by CSV import. Once those four are running, every report and every Recovery feed starts producing live numbers. The Getting Started checklist on the Hub sidebar walks you through the same sequence with a checkbox per task.' },
      { q: 'Do I have to follow this order?',
        a: 'Yes, with one exception. Positions must exist before Staff Roster (you cannot assign someone to a position that does not exist). Staff Roster must exist before Build Schedule (you cannot schedule an empty roster). Build Schedule and Log Hours can run independently once the first two are in place. Skipping the foundation just produces empty schedules and orphaned hour logs.' }
    ]},
    { t: 'Positions & Roster', qa: [
      { q: 'What is the difference between Positions and Staff Roster?',
        a: 'Positions are the job roles you schedule: bartender, server, line cook, barback, dishwasher, manager. Each position has a name, a department (Bar, Front of House, Kitchen, Management, Other), a default wage, and a tipped flag. Staff Roster is the people: each staff member is assigned to a position, and their wage defaults from the position\'s default but is editable per person. Two layers because real bars hire one bartender at $16 and another at $18 for the same role.' },
      { q: 'What does the tipped flag on a position do?',
        a: 'It tells Bar Cop the staff in that role earn tips on top of base wage, which matters for tip-credit compliance. When tipped is on, Payroll Export adds tip-credit columns (tips earned, tipped wage paid, effective hourly rate including tips) so your payroll provider or bookkeeper has what they need to verify the staff member cleared the state minimum wage every week. Bar Cop also flags any tipped employee whose effective hourly rate fell below the state minimum on Pay Periods detail, so you can make up the difference before payroll runs.' },
      { q: 'Why does the wage matter?',
        a: 'Every scheduled or logged hour is costed at the staff member\'s wage. That is what drives labor cost, labor percentage, the overtime projection, and the live cost number on Build Schedule as you assign hours. Wages that have not been updated since the last round of raises mean your numbers understate your actual labor cost every week. Update wages whenever you give a raise, hire at a different rate, or cross a wage-floor increase.' },
      { q: 'What is wage history and why does Bar Cop track it?',
        a: 'Every time you change a staff member\'s wage on the roster, Bar Cop records the change: the prior wage, the new wage, and the effective date. Hours logged or scheduled before the change still cost out at the old wage; hours after cost out at the new one. Without this, raising a wage today would retroactively re-cost every shift that staff member ever worked, and your historical labor numbers would shift overnight. Wage history keeps every past week honest at the wage that was in effect when it happened.' },
      { q: 'How does the Staff Roster connect to Revenue Recovery?',
        a: 'The Staff Roster is the source for Revenue Recovery\'s server list. Any Front of House staff member you add or remove here flows automatically into Revenue Recovery\'s Server Check screen. There is no separate roster to maintain on the Revenue side.' },
      { q: 'What does the Staff detail page show?',
        a: 'One page per staff member with everything attached: Profile (name, position, pay type, wage, status), a Certifications section with expiration dates, and the Coaching Log. Click any roster row or hit Edit and you land on the same page. Add or edit a certification or a coaching note in a focused pop-up without leaving the page.' },
      { q: 'What about salaried staff?',
        a: 'Set a staff member\'s Pay Type to Salary on the roster and enter their annual salary. Bar Cop treats salaried staff as exempt: a fixed weekly cost (annual divided by 52), no overtime, no matter how many hours they work. That weekly cost still rolls into your labor cost, labor percentage, and RPLH, so a salaried GM or AGM shows up in the numbers instead of off to the side. They do not have to log hours, but you can still log them for the record and keep their certifications and coaching notes. Anyone who is salaried but legally non-exempt should be set to Hourly so overtime tracks correctly.' },
      { q: 'How do I import a whole staff list?',
        a: 'On the Add Staff card, switch the toggle from Enter Manually to Import File and drop a CSV or Excel export. Map the columns once (only Name is required) and Bar Cop matches each person\'s position to your existing positions by name. Anything missing imports blank to fill in after. Set up your positions first for the cleanest import.' }
    ]},
    { t: 'Certifications', qa: [
      { q: 'What is the Certifications card for?',
        a: 'Tracks every regulated certification your staff is required to hold: TABC or state liquor server permit, ServSafe, food handler card, RBS (Responsible Beverage Service), and anything else specific to your jurisdiction. Each entry captures the cert type, the holder, issue date, expiration date, certificate number, and notes. The expiration date is required so Bar Cop can flag it before it lapses.' },
      { q: 'How does the expiry alert work?',
        a: 'Bar Cop flags any certification expiring within 30 days as Expiring, and any already past its date as Expired. Both surface on the Labor Control dashboard with the staff member and the cert type. A bartender working an expired TABC is a regulatory exposure your shift manager should not be guessing at. The 30-day window gives the staff member time to renew before they show up to a shift and cannot legally work.' },
      { q: 'What if my state requires a cert Bar Cop does not list?',
        a: 'Pick Other on the cert type dropdown and put the specific name in the notes field. Bar Cop tracks it the same way: expiration date, alert at 30 days, expired flag past the date. The common defaults cover most US jurisdictions; Other covers the rest without forcing you to map your state\'s exact terminology.' }
    ]},
    { t: 'Coaching Log', qa: [
      { q: 'What is the Coaching Log?',
        a: 'A written record of staff conversations, kept on the staff member\'s detail page. Four categories: Praise, Coaching, Concern, Warning. Each note carries the date, the category, who delivered it (manager), and the detail of what was said and what was agreed. The record is what protects the operator when a tough HR moment lands.' },
      { q: 'Why bother with a coaching log in software instead of memory?',
        a: 'Two reasons. First, when a staff member has been late seven times in two months and you need the conversation that leads to a final warning, a written history of every prior coaching moment is what makes the termination defensible. "I think we talked about this in March" is not a record. Second, the Praise category builds a positive trail you can pull at review time so a year-end conversation is grounded in real examples instead of last-week recency bias.' },
      { q: 'Who can see Coaching Log entries?',
        a: 'Admin role only, per Bar Cop\'s role permissions. Staff and Viewer roles cannot reach the coaching cards. Treat the log as you would any personnel file: written by management, accessed by management, retained for the same period your jurisdiction requires for HR records.' }
    ]},
    { t: 'Scheduling', qa: [
      { q: 'How does Build Schedule work?',
        a: 'Pick the week, confirm the revenue forecast for the week (read-only from Revenue Recovery, with an Edit Forecast button if you need to update it), and start adding shifts. Each shift has a staff member, a day, and start/end times. As you assign hours, Build Schedule shows live labor cost in dollars, labor percentage against your target, and projected RPLH against your target. Build the schedule to those numbers, not from the gut. Saving sends it to Schedule History.' },
      { q: 'How does conflict detection work?',
        a: 'As you build the schedule, Bar Cop checks every row for two kinds of conflicts. First, inactive staff: assigning a shift to a staff member whose roster status is off flags an inline warning. Second, time overlaps: scheduling the same person twice on the same day with overlapping times flags both rows. The warning shows under the affected row so you see it before you save, not after the staff member shows up confused on Tuesday.' },
      { q: 'Why start from a revenue forecast?',
        a: 'A schedule built before checking forecast revenue is built on habit. A schedule built from a revenue number is a plan. The difference shows up in labor percentage every week. The forecast at the top of Build Schedule turns into a labor budget in hours and dollars, so the math is done before you write a single name into a slot. The forecast lives in Revenue Recovery; Build Schedule reads it so the number is the same across every screen.' },
      { q: 'What are schedule templates for?',
        a: 'A typical week of shifts saved as a starting point. To make one, build a week in Build Schedule, put a name in the Template Name box, and save. Saved templates appear right there in Build Schedule, where Load fills the week in with those shifts so you can adjust and save. Most bars run two or three templates that cover most of their weeks.' },
      { q: 'What does Copy to New Week do?',
        a: 'On Schedule History, every saved schedule has a Copy to New Week button. Pick the target week (defaults to next week) and Bar Cop opens Build Schedule pre-filled with every shift from the source week, shifted to the new dates. Use it when last week\'s schedule was the right shape and you just need to roll it forward. Faster than rebuilding from scratch, more flexible than running a template when you only want to copy that one week.' },
      { q: 'Can I edit a saved schedule?',
        a: 'Yes. Open Schedule History, click View to see the full detail, click Edit to reopen it in Build Schedule with that week\'s shifts. Your changes update the same schedule record. The history holds every version so you can verify what was originally posted versus what was changed mid-week.' },
      { q: 'What does Schedule History show?',
        a: 'Every saved schedule, sorted newest first. Each row has View (full detail), Edit (reopen in Build Schedule), and Copy to New Week. The detail page shows hours, costs, and projected versus actual. Use the history to spot patterns: which weeks consistently come in over labor budget, which weeks underdeliver on revenue versus the forecast, which staff members get the heaviest schedule.' }
    ]},
    { t: 'Hours & Actuals', qa: [
      { q: 'How do I log actual hours?',
        a: 'Log Hours records what actually happened, which can differ from what was scheduled. One card, two ways in: switch the toggle between Enter Manually (type a row per staff member and day) and Import File (drop a timeclock or POS hours export). Each logged hour is costed at the staff member\'s wage in effect on that date (using wage history). Actual hours are what flows to Revenue and Profit Recovery, not scheduled hours. The difference between scheduled and actual is the variance, which Daily Snapshot and Weekly Summary surface.' },
      { q: 'How does the import work?',
        a: 'On Log Hours, pick Import File and drop your timeclock or POS hours file. Match your columns to Staff Name, Date, and Hours (Shift is optional). The mapping is remembered next time, so weekly imports become one click after the first run. Staff names are matched against your roster. Rows that do not match a roster member, or are missing hours, are skipped and reported so you can fix them.' },
      { q: 'Can I edit logged hours without leaving Daily Snapshot or Weekly Summary?',
        a: 'Yes. Both screens have an Edit Hours button on each row. Daily Snapshot pops a modal with hours and notes for that one staff member on that one date. Weekly Summary pops a modal with every logged-hours entry for that staff member across the week (one row per date, edit all in one save). You never have to navigate back to Log Hours to fix a logged shift. Locked records (pay period closed) show a LOCKED tag instead of the Edit button.' },
      { q: 'What does Daily Snapshot show?',
        a: 'One day at a time: who worked, their hours, the wage in effect that day, and the cost, with actual versus scheduled side by side. Use it to spot the day that went over budget and understand why: who picked up extra hours, where the overtime came from, where the schedule and the floor did not line up. Daily Snapshot is the diagnosis screen for any single day that ran hot.' },
      { q: 'What does Weekly Summary show?',
        a: 'A week rolled up by staff and by day, with labor percentage and RPLH against the week\'s forecast. Use it on Monday morning before building the next week. A department that ran over needs a tighter build. A department that ran under needs the cause checked: was it a revenue miss, a call-out, or genuinely lean scheduling that worked.' }
    ]},
    { t: 'Tips', qa: [
      { q: 'What is the Tip Log?',
        a: 'A daily log of cash and card tips by server, anchored to a shift. Pick the shift from the dropdown (Open and recent shifts surface first), and Bar Cop auto-fills date, shift type, and manager from the shift record. Pick the staff member and hours auto-fill from logged actuals. You only type the tip amounts. There is also a manual entry path for off-cycle tips that did not happen on a logged shift, plus an Import File toggle for a POS tips export. Tip Log feeds the Pool Calculator, Tip History, Payroll Export, and the Books Form 8027 Worksheet.' },
      { q: 'What does the Worksheet button do?',
        a: 'Downloads a clean PDF tip sheet for the bar or floor to print and fill in by hand during a shift, then the manager enters totals into Bar Cop after close. Columns for date, server, cash tips, card tips, total. The paper-to-digital bridge is the same pattern as the 86 List and the Void/Comp Log: operations happen on paper during service, data lands in Bar Cop after close.' },
      { q: 'How does the Pool Calculator work?',
        a: 'Two paths. Inside the Shift Close Wizard, the pool runs inline as Step 4 with that shift\'s logged tips and staff hours pre-loaded. Outside of close, the standalone Pool Calculator lets you split any pool for any date. Pick a date and Bar Cop auto-loads the matching tip log entries. Add participants and hours auto-fill from logged hours. Two distribution methods: split by hours worked (most common) or equal split. Saving stores the split linked to that shift, which is what the Books Form 8027 Worksheet reads when allocating per-employee tips to the IRS form.' },
      { q: 'What does Tip History show?',
        a: 'Every saved tip pool distribution and every tip log entry, on a tabbed view: By Staff, By Shift, and By Week. The By-Shift view groups by shift so you can see exactly how the night\'s pool was split. Use it as the paper trail for payroll and for any tip dispute. If a staff member questions a payout from three weeks ago, the history shows exactly how the split was calculated and from what pool.' }
    ]},
    { t: 'Pay Periods', qa: [
      { q: 'What is the Pay Periods screen?',
        a: 'A view of the last 12 weeks (Monday to Sunday by default), split into Open Periods and Closed Periods. Each row shows total hours, OT hours, and gross wages, with View and Close & Lock on the open ones (or Reopen on the closed). Pay Periods is the bridge between your live operational labor data and what gets handed to payroll. Run it weekly: review the detail, run Payroll Export, close the period.' },
      { q: 'What does Close & Lock do?',
        a: 'Stamps every logged-hours entry in the range as locked and tied to that pay period. Once locked, the records cannot be edited or deleted from Log Hours, Daily Snapshot, or Weekly Summary. The LOCKED tag replaces the Edit button on those screens. The lock is the integrity guarantee: once payroll has been cut from this data, nothing can change it after the fact. If you find an error after close, hit Reopen to unlock the week temporarily, fix the record, then close again. Closing and reopening write the whole week in one bulk save, so it is near-instant.' },
      { q: 'What does Payroll Export give me?',
        a: 'Payroll Export builds the file you hand to payroll for a chosen week. Two formats: a formatted workbook (.xlsx) laid out like Month-End Books, and a clean import CSV with columns only for a payroll provider that wants a plain upload. Either one carries one row per staff member: name, position, week dates, regular hours, OT hours, total hours, wage, regular cost, OT premium, and gross, with a total row at the bottom. For tipped positions it adds the tip-credit columns. Both files download as "Payroll Worksheet" and, before the download, Bar Cop shows a short acknowledgment that this is a worksheet to verify, not your official payroll record. The numbers come straight from Pay Periods, so the export always ties to what you closed.' },
      { q: 'How does tip-credit compliance work?',
        a: 'In jurisdictions that allow tip credit, an employer can pay a tipped wage below the standard minimum wage as long as tips bring the staff member up to or over the state minimum. Set your state minimum wage on Wage Policies, under Setup. Mark tipped positions with the tipped flag. Payroll Export calculates each tipped staff member\'s effective hourly rate (base wage plus tips divided by hours) and flags any week that fell below the state minimum. Pay Periods detail also shows the count of tipped employees below minimum at the top of the week with the reminder to make up the difference before payroll runs. This is a planning aid, not legal or payroll advice; verify the rules for your jurisdiction.' },
      { q: 'What if my pay period is bi-weekly instead of weekly?',
        a: 'Pay Periods displays weekly by default because the week grain matches Bar Cop\'s shift and revenue rollups. For bi-weekly payroll, run Payroll Export for two consecutive weeks and combine them in Excel, or hand both files to your payroll provider. Closing weeks individually keeps the lock granularity tight (a single bad shift in week one does not unlock all of week two).' }
    ]},
    { t: 'Reports & Overtime', qa: [
      { q: 'What is in Labor Reports?',
        a: 'A trend view of labor cost, hours, and tips over a date range, broken down By Department and By Staff on one page (no tabs, since both tables are short), with one Export PDF covering both. Salaried staff carry their fixed weekly salary across the range. Use it to spot drift: a department creeping up over several weeks is a structural problem worth a build review, not a one-week anomaly worth ignoring.' },
      { q: 'What is Overtime Watch?',
        a: 'A live projection of each staff member\'s end-of-week hours from what they have already worked plus what they are scheduled to work. Anyone heading past 40 hours flags as Over (with the OT dollar cost calculated). Anyone within range of 40 flags as Approaching. The Suggested Action column tells you exactly what to do: Over rows show "Cut X.X hr" with the precise reduction to clear 40; Approaching rows show "Watch, X.X hr to OT." A View Schedule for This Week button jumps you straight to Build Schedule so the fix happens in the right place. Almost all overtime is hours concentrated on too few employees, not a need for more total hours. Redistribute before the schedule goes out, or before the week is over.' },
      { q: 'What is the Call-Out Log?',
        a: 'Every call-out, no-show, late arrival, and early-out, with the date, the staff member, the type, the shift, and whether it got covered and by whom. Two reasons to log them. First, you cannot manage a pattern you do not track; a staff member with repeat call-outs in 60 days gets flagged in red, and that is a coaching conversation you can pull straight into a Coaching Log Concern entry. Second, call-outs cost real labor dollars in coverage scrambles, and the log makes that cost visible.' }
    ]},
    { t: 'Connections', qa: [
      { q: 'What flows from Labor Control to Revenue Recovery?',
        a: 'Three connections, all read-only on the Revenue side, all always on. Logged hours feed Revenue This Week labor (the weekly labor cost line). The same hours feed the RPLH Tracker, which divides revenue by labor hours for each shift and department. The Staff Roster (Front of House staff specifically) feeds the Server Check roster. Set labor data once here and Revenue stays current.' },
      { q: 'What flows from Labor Control to Profit Recovery?',
        a: 'Logged hours feed Profit This Week labor (the weekly labor line on the profit side) and the prime cost calculation, which combines labor and COGS as a percentage of revenue. Prime cost is the single most important number in a healthy operation, and Labor Control owns half of it. The other half comes from Inventory Control counts.' },
      { q: 'What flows from Labor Control to Shift Control?',
        a: 'Two ways. Tip pool records are linked to the shift so the Shift Close Wizard\'s Tip Reconciliation step can read and update them inline. And the staff roster is the source for the staff dropdowns across Shift Control (manager on duty, void/comp authorizer, performed-by on cash drops, completed-by on checklists).' },
      { q: 'What flows from Labor Control into Accounting?',
        a: 'The Books Month-End workbook reads Labor Control for the Labor Cost Analysis sheet (hours and wages by position and by staff) and for the Form 8027 Worksheet (per-employee tips, preferring the saved tip-pool split when a pool exists for the shift). Payroll Export builds the payroll file for direct handoff to your payroll provider. Set the labor data right here and every accounting deliverable lines up automatically.' },
      { q: 'Why do my labor numbers not match my payroll provider exactly?',
        a: 'Two common reasons. First, Labor Control tracks scheduled and logged hours at the staff wage; payroll calculates with payroll taxes, employer benefits, and bonuses included on top. Total labor cost runs 10 to 15 percent higher than wages alone. Use Labor Control for operational scheduling decisions, and reconcile against your payroll system for accounting. Second, timing: if your Bar Cop weeks do not align with your pay period, the numbers will not match week-over-week. Once you start using Pay Periods Close & Lock, the lock boundaries should match your payroll cycle so the two systems stay in sync.' }
    ]}
  ],

  render(container, actions) {
    this.container = container;
    if (actions) actions.innerHTML = '';
    this.tab = 0;
    this.query = '';
    this.draw();
  },

  draw() {
    const search = '<div class="f" style="max-width:420px;margin-bottom:8px;">'
      + '<input type="text" id="help-search" placeholder="Search Labor Control help..." autocomplete="off" value="' + esc(this.query) + '"/></div>';
    const tabs = '<div class="ch-tabs no-print">'
      + this.SECTIONS.map((s, i) => '<button class="ch-tab' + (this.tab === i ? ' on' : '') + '" data-tab="' + i + '">' + esc(s.t) + '</button>').join('')
      + '</div>';
    this.container.innerHTML = '<div class="screen">' + search + tabs + '<div id="help-body">' + this.bodyHtml() + '</div></div>';
    this.wire();
  },

  // The active tab's Q&A, or — when the search box has text — every matching
  // question across all topics, each tagged with its topic.
  bodyHtml() {
    const q = this.query.trim().toLowerCase();
    if (q) {
      const matches = [];
      this.SECTIONS.forEach(sec => sec.qa.forEach(item => {
        if (item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)) matches.push({ topic: sec.t, q: item.q, a: item.a });
      }));
      if (!matches.length) return '<div style="padding:18px 2px;color:var(--t3);font-size:13px;">No help topics match that search. Try a different word.</div>';
      return matches.map(m => this.qaHtml(m.q, m.a, m.topic)).join('');
    }
    const sec = this.SECTIONS[this.tab] || this.SECTIONS[0];
    return sec.qa.map(item => this.qaHtml(item.q, item.a)).join('');
  },

  qaHtml(q, a, topic) {
    return '<div style="border-bottom:1px solid var(--b2);padding:16px 0;">'
      + (topic ? '<div class="sh" style="margin-bottom:7px;">' + esc(topic) + '</div>' : '')
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:7px;">' + esc(q) + '</div>'
      + '<div style="font-size:12.5px;color:var(--t2);line-height:1.7;">' + esc(a) + '</div>'
      + '</div>';
  },

  wire() {
    this.container.onclick = ev => {
      const tab = ev.target.closest('.ch-tab');
      if (tab) {
        this.tab = parseInt(tab.dataset.tab, 10) || 0;
        this.query = '';
        this.draw();
      }
    };
    const search = document.getElementById('help-search');
    if (search) search.addEventListener('input', e => {
      this.query = e.target.value || '';
      const body = document.getElementById('help-body');
      if (body) body.innerHTML = this.bodyHtml();
    });
  }
};
