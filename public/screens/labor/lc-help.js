'use strict';

/* ── Labor Control — Help and FAQ ─────────────────────────────────────────────
   The in-app knowledge layer for Labor Control: orientation, the decisions and
   judgment calls, cross-system connections, and troubleshooting. One topic at a
   time on the same underline tab switcher used elsewhere, plus a live search box
   that filters questions across every topic. Per-screen step-by-step directions
   live in each screen's nav "i" panel (showHowTo), so this FAQ stays on the why
   and the how-it-connects, not the how-to. */

S.LaborHelp = {
  tab: 0,
  query: '',

  showHowTo() {
    App.showHelpModal('Labor Help and FAQ', [
      { p: ['This page is the Help and FAQ for Labor Control: how to get started, the roster and wages, certs and coaching, tips and tip credit, payroll, and how Labor feeds Revenue, Profit, Shift, and Accounting. It covers the why and how it all connects.'] },
      { h: 'Finding An Answer', p: ['Pick a topic along the top, or type a word in the search box to pull every matching question across all topics at once. A search for "overtime" or "tip credit" lands you on the right answer fast.'] },
      { h: 'Directions For A Specific Screen', p: ['Every working screen in Labor Control carries its own step-by-step directions. Open the screen you have a question about, like Build Schedule or Log Hours, and tap this same info i button at the top to read the how-to for that page. This FAQ covers the why; the per-screen i covers the how.'] }
    ]);
  },

  SECTIONS: [
    { t: 'Getting Started', qa: [
      { q: 'What does Labor Control do?',
        a: 'Labor Control is where everything operational about your team lives: positions and wages, the staff roster, certifications, the schedule, actual hours worked, tips, overtime, pay periods, call-outs, and a coaching log per person. It is one of three Control systems (Inventory, Labor, Shift) that capture your daily operations. Revenue Recovery reads your roster and your hours; Profit Recovery reads your hours for prime cost. Set the labor data once here and Recovery stays current without you typing the same numbers twice.' },
      { q: 'Where do I start?',
        a: 'Four steps get Labor Control producing real numbers. First, set up your Staff Positions (bartender, server, line cook) with a department, a default wage, and the tipped setting where it applies. Second, build the Staff Roster, assigning each person a position and capturing any certifications. Third, build the first week in Build Schedule. Fourth, log the hours people actually worked in Log Hours, by hand or by import. The Getting Started checklist on the Hub walks the same sequence with a checkbox per task.' },
      { q: 'Do I have to follow that order?',
        a: 'Mostly. Positions have to exist before the roster, since you cannot assign someone to a role that does not exist, and the roster has to exist before Build Schedule, since you cannot schedule an empty roster. Build Schedule and Log Hours run independently once the first two are in place. Skipping the foundation just produces empty schedules and orphaned hour logs.' }
    ]},
    { t: 'Roster & Wages', qa: [
      { q: 'What is the difference between Staff Positions and the Staff Roster?',
        a: 'Positions are the job roles you schedule: bartender, server, line cook, barback, dishwasher, manager. Each has a name, a department (Bar, Front of House, Kitchen, Management, Other), a default wage, and a tipped setting. The Staff Roster is the people: each person is assigned to a position, and their wage defaults from the position but is editable per person. Two layers, because one bartender starts at $16 and the next at $18 for the same role.' },
      { q: 'Why does the wage matter, and what is wage history?',
        a: 'Every scheduled or logged hour is costed at the person\'s wage, and that drives labor cost, labor percent, the overtime projection, and the live cost on Build Schedule as you assign hours. When you change a wage, Bar Cop records the change with an effective date: hours worked before it still cost at the old wage, hours after at the new one. That keeps every past week honest instead of re-pricing your whole history the day you give a raise. Update wages whenever you give a raise, hire at a different rate, or a wage floor moves.' },
      { q: 'How does Bar Cop handle salaried staff?',
        a: 'Set a person\'s Pay Type to Salary on the roster and enter the annual figure. Bar Cop treats them as exempt: a fixed weekly cost (annual divided by 52), no overtime, no matter how many hours they work. That weekly cost still rolls into labor cost, labor percent, and revenue per labor hour, so a salaried GM shows up in the numbers instead of off to the side. They do not have to log hours, but you can for coverage and the record. Anyone salaried but legally non-exempt should be set to Hourly so overtime tracks correctly. How you classify staff under wage and hour law is your call.' }
    ]},
    { t: 'Certs & Coaching', qa: [
      { q: 'How does the certification expiry alert work?',
        a: 'Every certification you track (liquor server permit, ServSafe, food handler, and the rest) carries an expiration date. Bar Cop flags any cert expiring within 30 days as Expiring and any already past its date as Expired, and surfaces both on the Labor dashboard with the person and the cert type. A bartender working an expired permit is a regulatory exposure your shift manager should not be guessing at, and the 30-day window gives the person time to renew. If your state requires a cert that is not on the list, pick Other and name it in the notes; it tracks the same way.' },
      { q: 'Why keep a coaching log in software instead of in my head?',
        a: 'Two reasons. When someone has been late seven times in two months and you need the conversation that leads to a final warning, a written history of every prior coaching moment is what makes the decision defensible. "I think we talked about this in March" is not a record. And the Praise entries build a positive trail you can pull at review time, so a year-end conversation is grounded in real examples instead of last-week recency.' },
      { q: 'Who can see coaching log entries?',
        a: 'The coaching log lives on each person\'s page, so anyone you give access to the Staff Roster screen can see it, along with that person\'s profile and certifications. Access follows the role permissions you set under Settings: Admin has full access, Viewer is read-only, and a Staff or Manager role sees it only if you grant the Staff Roster screen. Treat the log like any personnel file and keep Staff Roster access limited to the people who should be reading HR notes. Retain entries as long as your jurisdiction requires for HR records.' },
      { q: 'How do I keep someone from being scheduled on a day they have off?',
        a: 'Two ways, both feed Build Schedule. For a one-time request, vacation, or sick day, log it on Time Off with the dates and set it to Approved. For a standing day someone never works, set their Regular Days Off on their Staff Roster profile. Either way, when you put a shift on that person during their time off, the cell flags red and Bar Cop warns you before the schedule posts, so you cannot accidentally schedule someone you already gave the day off. The Call-Out Log is the opposite, for absences after the fact (a no-show or a sick call the day of).' }
    ]},
    { t: 'Tips & Tip Credit', qa: [
      { q: 'How does tip-out work in Bar Cop?',
        a: 'Tip-out is set per role on Staff Positions, because a server and a bartender tip out different amounts. A role that rings sales and tips out gets a Tip Out percent of sales; a role that only receives, like a busser or barback, stays at 0. In Tip Tracking, Bar Cop figures each earner\'s tip-out off their sales, and you record what each support person actually received, since the real distribution is yours to make. A Collected versus Distributed line flags any gap. Bar Cop calculates the amounts and each person\'s net take-home; how a tip-out is physically paid out is your call and your payroll provider\'s.' },
      { q: 'How does the tip-credit check work?',
        a: 'In jurisdictions that allow a tip credit, you can pay a tipped wage below the standard minimum as long as tips bring the person up to or over it. Set your state minimum in App Settings, under Business Profile, and mark the tipped positions. Bar Cop figures each tipped person\'s effective hourly rate (base wage plus tips, divided by hours) for the week and flags any week that fell below the state minimum on the Pay Periods detail, so you can make up the difference before payroll runs. This is a planning aid, not legal or payroll advice; verify the rules for your jurisdiction.' }
    ]},
    { t: 'Payroll', qa: [
      { q: 'What does Close & Lock do?',
        a: 'Closing a pay period stamps every logged-hours entry in that week as locked and tied to the period. Once locked, those records cannot be edited or deleted from Log Hours or Labor History, and a LOCKED tag replaces the Edit button. That is the integrity guarantee: once payroll has been cut from this data, nothing can change it after the fact. If you find an error after close, Reopen the week, fix the record, and close it again. Closing and reopening write the whole week in one save, so it is near-instant.' },
      { q: 'What if my pay period is bi-weekly instead of weekly?',
        a: 'Pay Periods runs weekly because the week grain matches Bar Cop\'s shift and revenue rollups. For bi-weekly payroll, run Payroll Export for two consecutive weeks and combine them, or hand both files to your payroll provider. Closing weeks one at a time keeps the lock tight, so a single bad shift in week one does not unlock all of week two.' },
      { q: 'Why do my labor numbers not match my payroll provider exactly?',
        a: 'Two common reasons. Labor Control tracks hours at the staff wage; payroll adds payroll taxes, employer benefits, and bonuses on top, so total labor cost usually runs 10 to 15 percent higher than wages alone. And timing: if your Bar Cop weeks do not line up with your pay period, the numbers will not match week to week. Once you use Close & Lock, set the lock boundaries to match your payroll cycle so the two systems stay in sync.' }
    ]},
    { t: 'Connections', qa: [
      { q: 'What flows from Labor Control to Revenue Recovery?',
        a: 'Three connections, all read-only on the Revenue side, all always on. Logged hours feed Revenue This Week labor (the weekly labor cost line). The same hours feed This Week\'s RPLH, which divides revenue by labor hours. And the Staff Roster, Front of House staff specifically, feeds the Server Check roster. Set the labor data once here and Revenue stays current.' },
      { q: 'What flows from Labor Control to Profit Recovery?',
        a: 'Logged hours feed Profit This Week labor and the prime cost calculation, which combines labor and COGS as a percentage of revenue. Prime cost is the single most important number in a healthy operation, and Labor Control owns half of it. The other half comes from Inventory Control counts.' },
      { q: 'What flows from Labor Control to Shift Control?',
        a: 'The staff roster is the source for the staff dropdowns across Shift Control: the void and comp authorizer, performed-by on cash drops, and completed-by on checklists. Tip logs and tip pools also draw their crew from the roster.' },
      { q: 'What flows from Labor Control into Accounting?',
        a: 'The Books Month-End workbook reads Labor Control for the Labor Cost Analysis sheet (hours and wages by position and by staff) and for the Form 8027 Worksheet (per-employee tips, preferring the saved tip-pool split when a pool exists for the shift). Payroll Export builds the payroll file for direct handoff to your payroll provider. Set the labor data right here and every accounting deliverable lines up automatically.' }
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
