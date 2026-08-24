'use strict';

/* ── THE GLOBAL HELP AND FAQ — ONE PAGE, EVERY SECTION ────────────────────────
   Kyle, 2026-08-24: *"we need to create the global help page.. combining all the section FAQs
   into one main one.. with the 1st part pointing to the i help icon in the top bar for specific
   page help... that global help page will go on the rail menu under settings .. Help with an
   icon."*

   ⛔⛔⛔ MEASURED BEFORE THIS PAGE EXISTED: ALL ELEVEN FAQs IN THE APP WERE UNREACHABLE. Every
   section nav still names a help row, and none of them reaches a screen — the eight sections with
   a top BAR drop the whole Support group through `SectionTabs.ASIDE_GROUP`, and labor, shift,
   profit, revenue and cash stopped being rail rows entirely. 53 topics and 214 questions of
   operator copy, roughly 21,000 words, with no door in front of any of it.

   ⭐⭐⭐ THIS PAGE READS THEM, IT DOES NOT COPY THEM. Every sibling FAQ stays exactly where it is
   and stays the one home of its own copy; `SOURCES` below names the objects and this page gathers
   their `SECTIONS` at render time. Copying 21,000 words into a twelfth file would have created a
   second home for every answer, and two homes for one sentence is the drift this codebase has
   watched happen four times. Nothing here has to be kept in step: edit a section FAQ and this
   page shows the edit.

   ⭐ THE TABS ARE DERIVED FROM THE RAIL, NOT FROM THE OLD SIDEBAR. Each tab is a row an operator
   can actually see today. Three of the eleven sources no longer have a rail row of their own and
   are filed where their PAGES now live: the Profit FAQ under Run Audit (it is audit material),
   the Cash one under Books (its pages moved there), and Labor + Shift together under The Floor
   (which replaced both). Those three placements are the only judgement calls in this file and
   they are one table edit to change.

   ⚠ THE SHELL IS THE ONE THE SIBLINGS ALREADY USE, copied from `S.Help` rather than invented:
   a live search box, the `.ch-tabs` underline switcher, and `App.helpFooter()`. 214 questions
   with no search is not a page anybody can use, and the app already had the answer to that.
   The search spans EVERY tab, which is the one thing only a combined page can do. */
S.HubHelp = {
  tab: 0,
  query: '',

  // Full-page Hub screen, reached from the rail's Help row. The third argument is what lights
  // that row: a hub page cannot name itself, so `openHubFullPage` passes the action through.
  open() {
    App.openHubFullPage('Help and FAQ', (mount) => this.render(mount), 'help');
  },

  /* ⭐ THE FIRST THING ON THE PAGE, AND KYLE NAMED IT: this FAQ answers how Bar Cop works and how
     the parts connect; the "i" in the top bar answers how the SCREEN IN FRONT OF YOU works. Two
     different questions, and an operator who does not know the second one exists will read this
     whole page looking for a step-by-step that lives one button away. */
  INTRO: [
    'Looking for directions on the screen you are on? Use the "i" button at the top of the page. Every working screen in Bar Cop carries its own step-by-step on that button: what to enter, what the numbers mean, and what to do next on that page.',
    'This page is the rest of it. How Bar Cop works, how the sections feed each other, what each number is built from, and what to do when something does not look right. Pick a section along the top, or type a word in the search box to pull every matching answer from every section at once.'
  ],

  /* This page's OWN cross-system questions: the ones that belong to no single section. Held as a
     property like every sibling FAQ so `SOURCES` can gather it the same way as the rest, rather
     than the local it used to be inside render(). */
  SECTIONS: [
      { t: 'About Bar Cop', qa: [
        { q: 'What is Bar Cop?',
          a: 'Bar Cop runs your operation in three layers. Capture is the three Control systems where you log what actually happened: Inventory Control for product counts and deliveries, Labor Control for schedules and hours, Shift Control for shift revenue and cash. Diagnose is the three Recovery systems and the Operations Audit. Recovery reads your Control data, surfaces the dollar leaks, and ranks the action items by annual impact. The Operations Audit is the executive weekly read on the whole operation. Fix is the work itself, and it happens on the floor rather than in an app. The audits rank the gaps biggest dollar first and name what to do about each one. You go and do it, then confirm each week as it closes. Bar Cop measures the change against your own baseline, so the Hub shows what has actually come back rather than what was promised. Capture, diagnose, fix. That is the loop.' },
        { q: 'How do the six systems fit together?',
          a: 'The three Control systems log the operation. The three Recovery systems read that log and score it. No double entry. Anything you count in Inventory Control feeds the Profit Audit and the Recovery systems. Anything you schedule and pay in Labor Control feeds the Revenue Audit and the labor cost line on every weekly review. Shift revenue and cash variance from Shift Control feed both Profit and Revenue. The Hub pulls every number into one cross-system view so you can see the full picture without opening six different screens.' },
        { q: 'Where do I start?',
          a: 'When you first sign in, a short onboarding collects the essentials, your bar name, your annual sales, and your service periods, then drops you on the Hub. From there the fastest path is to run your three Recovery Audits for a day-one scored snapshot, then log your first week in each Control system. Every section opens to a guided empty state that walks you through its setup in context, so you are never staring at a blank page. Work the weekly close each week and the numbers fill in from there.' },
        { q: 'Can I use Bar Cop on my phone behind the bar?',
          a: 'Yes. The screens that get used during a shift are built mobile-first, meaning they work on a phone propped behind the bar, a tablet on the counting cart, or a manager\'s tablet during a walkthrough. 48px touch targets, 16px text minimum, no horizontal scroll, auto-save the moment a value is entered. The mobile-first screens are Take Inventory, Receive Delivery, and Spot Check in Inventory Control, plus Cash Control and the Void / Comp Log in Shift Control. These are the screens you actually touch while running the floor, not while sitting at a desk. If your wifi flakes mid-count, Bar Cop keeps writing to local storage as you go. The next time you open it on a working connection, a sync banner offers to push the pending changes to the server. Nothing is lost when the connection drops in the middle of counting the well.' }
      ]},

      { t: 'The Hub, Audits, and What It Shows', qa: [
        { q: 'What is the Hub showing me?',
          a: 'The Hub is your home screen and the cross-system view, laid out in the owner\'s reading order. Four figures run across the top: Total Opportunity, the money your audits have surfaced that you have not closed yet; Recovered, the proven dollars you have put back, counted only after a fix is measured; Trapped Cash, the dead and overstocked inventory you could free; and Break-Even, the sales you need to clear your costs. The first three open the audit that found that money. Under them your Operations Audit panel shows your first score against today\'s and the points between, with the three Recovery audits and the date each last ran. Where you were, where you are is a fixed two-week comparison of prime cost, labor, check average and weekly sales. Do this first names the single biggest money move across every audit, one item rather than a list, because Bar Cop has already done the ranking. Your biggest gain and your worst drag name the two operating numbers that moved furthest for and against you. Needs attention is the operational list, worst first: expiring certs and permits, projected overtime, cash flags. Done this week ticks the five recurring jobs off your real records and resets Monday.' },
        { q: 'What is the Operations Audit?',
          a: 'The Operations Audit is the executive read on your whole operation. It sits above the six systems and scores six operational areas on a 0 to 100 scale: Operational Discipline (are your daily and weekly procedures actually getting done), Cash Integrity (variance trend, drawer counts, cash drops), Inventory Execution (count frequency, vendor discrepancy resolution, spot check variance), Labor Hygiene (schedule adherence, callouts, overtime, certifications, coaching), Recovery Action (gaps surfaced versus fixes logged versus dollars recovered), and Operational Consistency (week-over-week variance in stable metrics). The audit also surfaces Top Operational Exposures (the items you need to address now) and Recurring Patterns (chronic issues showing up across rolling 90-day windows). Open it by clicking your Operations Audit score at the top of the Hub. Run it whenever you want a fresh read; it scores your trailing 30 days. There is no lock. It scores as soon as there is anything real to read and each sub-score fills in as you log more, showing Not Enough Data until then.' },
        { q: 'How is the Operations Audit different from the three Recovery Audits?',
          a: 'The Recovery Audits are about money. They name the gaps where the operation is leaking revenue or running cost up, attach a dollar figure to each gap, and rank action items by annual impact. They answer where the money is going. The Operations Audit is about discipline. It scores whether the operation is being run well, whether the procedures are being followed, whether issues are being acted on. It answers whether the operation is being run with discipline. Both serve different purposes and both run whenever you want a fresh read, most operators run them together with the weekly close. Read them together. A weak Recovery score with a strong Operations Audit score means the leaks are structural, not operational. A weak Operations Audit score with a passable Recovery score means the operation is leaking ground that does not show up on the weekly P&L yet.' },
        { q: 'What does a Recovery Audit do that the Hub does not?',
          a: 'The Hub shows you the current state. A Recovery Audit scores the operation. It is a structured diagnostic on a 0 to 100 scale across every section of the Recovery system, written like a coaching report instead of a raw metric dump. It names each gap, attaches a dollar figure to it, and ranks the action items by annual impact. Run each Recovery audit as often as you want; it is included in your subscription. The recurring value of Bar Cop is the scored reports plus the recovered-dollar tracking in Where You Stand proving the work is paying off.' },
        { q: 'How does Bar Cop measure what a fix recovers?',
          a: 'A gap\'s fix starts on its own from your first tracked action on it, and Bar Cop logs that date against the gap and watches the metric that gap controls from there. It does not compare you to a history you never gave it. Your own first three weeks after that date set the baseline, and every week after that is measured against it. A figure appears once four weeks are in, three to set the baseline and one to measure, and it reads preliminary until four measurement weeks have landed. The current rate is the average of your most recent eight measurement weeks, so a good week does not flatter it and a bad one does not sink it. The improvement multiplied by your revenue base is the recovered dollar figure, and it shows in Where You Stand. No invented conversion rates, no marketing math. Every recovered dollar traces to a real weekly number that moved.' },
        { q: 'What is the Bar Cop Briefing button on an audit?',
          a: 'It writes a short operator-voice read of the audit you are looking at, generated in code from the same numbers, so it opens instantly with no wait and reads the same every time. The Briefing lives on every audit detail (Profit, Revenue, Cash, and Operations Audit) and gives you the narrative instead of a metric dump.' }
      ]},

      { t: 'Accounting and Compliance', qa: [
        { q: 'What is Month-End Books?',
          a: 'Month-End Books is the multi-tab Excel workbook plus a one-page PDF executive summary that goes to your accountant or bookkeeper at every monthly close. Open Books, then Month-End Books under Statements. Pick the month, click Generate File. The workbook covers Income Statement (month plus year to date with operating expense lines pulled from your money out log), Inventory Valuation (bottle-level detail and Schedule C COGS math), Cash Reconciliation (every shift with variance), Void and Comp Log (audit trail with category breakdown), Form 8027 Tip Allocation Worksheet, Variance and Shrinkage Report, Labor Cost Analysis (by position, by staff), and Operational Opportunities (your latest audit action items as forward-looking agenda). On a December close it adds a Year-End Tax Helper sheet that maps to Schedule C line numbers. Nothing for you to re-type. Everything builds from data you already have in Bar Cop.' },
        { q: 'What is the Annual Review?',
          a: 'The Annual Review is the annual roll-up: an eight-tab Excel workbook plus a four-page PDF Executive Summary your accountant, your CPA, your lender, or your business partner can read. Open it from the Accounting section. Pick a year, click Generate File. The workbook covers Annual Summary with year-over-year deltas, P&L by Month (twelve months side by side), Inventory Valuation Trend, Labor Cost Trend, Form 8027 Tip Allocation annualized, Cash Control Summary, Audit History (every audit you ran during the year with score and monthly opportunity), and Operational Events (voids and comps, walked tabs, call-outs, certifications that lapsed). Run it alongside your December close for the tax package, or run it for the current year so far, or any prior year with data, for a read on how things are going.' },
        { q: 'What is the Weekly P&L Brief?',
          a: 'The Weekly P&L Brief is the Excel export your bookkeeper opens between monthly closes. Open it from the Accounting section. Pick a range (last completed week, last 4, last 13, year to date, all weeks, or a custom date range), click Download File. Each row is one week with bar revenue, food revenue, total revenue, COGS by department, total labor by department, prime cost, pour cost percent, food cost percent, and prime cost percent. Open it in Excel, QuickBooks, Xero, or any spreadsheet software.' },
        { q: 'Where do I log money out, and what counts?',
          a: 'You log it on Money Out: drop a bank or card statement, or type one in by hand, on the card at the top. The tabs below are the history of everything logged, with Edit and Delete on every row, but it is not where you enter. Log each bill with a date, category (Occupancy, Utilities, Insurance, Marketing and Advertising, Professional Fees, Bank and Credit Card Fees, Licenses and Permits, Software and Subscriptions, or Other), vendor, and amount. Bar Cop works out which bills recur by watching what you actually log. Drop two months of statements and it picks up rent, insurance and your subscriptions on its own, and projects them onto your Cash Forecast. There is nothing to tick and no schedule to fill in. A bill that stops showing up stops being projected, so cancelling a service needs no extra step. Use Repeat to copy a bill forward when you want to log the next one by hand. Books rolls all of this up monthly into the Income Statement Operating Expenses lines, and the Annual Review into the annual P&L by Month sheet, so you stop re-typing rent, utilities, and insurance every close. Every dollar that leaves the business is logged here, including repairs and 3rd-party platform fees (DoorDash, UberEats, Grubhub). One log, one place to look, nothing counted twice.' },
        { q: 'What do I log in Licensing?',
          a: 'Licensing is your renewal calendar. Open it from Shift Control, under Incidents and Maintenance. Add every permit and license with a name, type (Liquor License, Business License, Health Permit, Food Service Permit, Fire Safety, Music/Entertainment, Outdoor Seating, Sign, Workers Comp, or Other), next renewal date, recurrence (Annual, Biennial, Quarterly, Monthly, One-Time, Other), last renewed date, and notes. Mark Renewed when you pay and set the next renewal date; Bar Cop suggests it from the recurrence. Licensing tracks dates, not money: what a renewal cost comes in with the rest of your money out on Money Out and lands on the Licenses and Permits line of your P&L. The Operations Audit Top Operational Exposures section surfaces any permit due in the next 30 days, and the Hub\'s Needs attention list flags expired and soon-due permits.' }
      ]},

      { t: 'Multiple Bars (Group Operators)', qa: [
        { q: 'I run more than one bar. How does Bar Cop handle that?',
          a: 'Each bar is its own Bar Cop account with its own data, audits, and fix log. You sign in once and a location switcher appears in the topbar showing every bar you belong to. Switch between bars from any screen. The data, the Hub, the audits, and the fix log all swap to the bar you selected. Nothing is shared across bars by default. Targets, products, vendors, staff rosters, every record is per-bar.' },
        { q: 'Can I compare my bars side by side?',
          a: 'Not as one combined view. Bar Cop runs each bar on its own account data, and you switch between them with the location switcher in the top bar. Open a bar and its Hub, audits and Recovery numbers are that bar\'s alone. Compare them by reading the same figure on each, or export the Month-End Books for each bar and line them up in one sheet.' },
        { q: 'How do I switch between bars?',
          a: 'The location switcher dropdown in the topbar holds every bar on your account. Pick one, the page reloads on that bar\'s Hub. The active bar is remembered so the next time you open Bar Cop you land on the bar you used last.' },
        { q: 'How do I add another bar?',
          a: 'Open Settings, then Account. Scroll to Subscription and use Add Another Bar. A Stripe checkout opens for the additional subscription. After payment the new bar lands on your account and the location switcher updates.' }
      ]},

      { t: 'Your Account and Your Data', qa: [
        { q: 'How is my data saved?',
          a: 'Every change saves to your account automatically the moment you make it. There is no Save button to remember on most screens. Sign in on another device and your data is already there. If your connection drops mid-change, Bar Cop holds the edit on this device and pushes it to the server the next time you are online. A small banner appears the next time you open Bar Cop offering to sync any pending changes. Nothing is lost when your wifi flakes mid-shift.' },
        { q: 'Does Bar Cop connect to my POS?',
          a: 'Not through a live API connection yet. The bridge today is CSV and Excel import. Most POSes (Toast, Square, Lightspeed, Aloha) let you export a Sales by Item, Item Selection, or Product Mix report for any date range. Bar Cop\'s import screens read those exports directly. Upload the file, map the columns once on the mapping screen, the data lands. The Variance Report in Inventory Control reads a POS sales export and works out what you should have poured, against what your counts say you actually used. The product setup screens import your full menu off a vendor order guide or POS item list in one shot. Shift revenue is the one POS number Bar Cop reads as ground truth. You enter it per shift in Shift Control along with covers and cash. Every Recovery system reads the weekly sum from there, so there is no double entry across the rest of Bar Cop.' },
        { q: 'Can I export my data?',
          a: 'Yes. Open Settings, then Backup, and use Export Backup. The export pulls every record from every system into one JSON file: settings, targets, weekly numbers, all three Recovery Audits, your Operations Audits, recipes, fix log, your money out log, Permits, and your full Inventory, Labor, and Shift Control records. Keep a copy offsite as your own backup. Restore from Backup reads the same file back in if you ever need to roll back or move accounts. Export takes under a second on most accounts.' },
        { q: 'What happens if I cancel my subscription?',
          a: 'Your account stays in place for 30 days after cancellation. During that window you can sign back in, run an export, or resubscribe and pick up exactly where you left off. After 30 days the account closes and the data is removed for good. If you think you might come back, do the export before you cancel anyway. Backup files do not expire.' },
        { q: 'How do I change my bar name or location?',
          a: 'Open Settings, then Profile. The Business Profile card holds your bar name, location, taxes, and service periods. Click Save Data below the card when you are done. Bar name and location changes flow through every screen.' },
        { q: 'How do I change my targets?',
          a: 'App Settings, then the Profit Targets or Revenue Targets card depending on which system you are tuning. Industry benchmarks are pre-filled (22 percent bar pour cost, 32 percent food cost, 60 percent prime cost, etc). Change them to reflect your specific operation. A target that does not match your real business just produces a page full of red that nobody pays attention to. Save Data on the card commits the change.' },
        { q: 'How do I change my password?',
          a: 'Open Settings, then Account. Enter your new password twice and click Update Password. Password must be at least 8 characters. Bar Cop does not store the old password, so if you forget it, use the Reset Password link on the sign-in screen instead.' },
        { q: 'How do I invite team members or change someone\'s access?',
          a: 'Open Settings, then Team, admin only. Enter the email, pick the role (Admin or Staff), and click Send Invite. Admin sees everything and can change every setting. Staff sees only the areas you grant, and each area is either No Access or Full Access. There is no read-only role: it was dropped as unenforceable across every screen. For a bookkeeper, grant Staff the sections you check below, with optional edit and delete on each. Existing members appear in the Members list above the invite form. Change a member\'s role from the dropdown next to their name. Edit Access opens the same permission grid for Staff users. Remove takes a member off your account immediately.' }
      ]},

      { t: 'Getting Unstuck', qa: [
        { q: 'A number on the Hub looks wrong.',
          a: 'Click the number. The Hub takes you straight to the screen where that figure is calculated, and you can see every input that produced it. Most wrong-looking numbers turn out to be a missed week, a partial inventory count, a target that was set to an aspirational figure instead of an operational one, or a shift that did not get logged into Shift Control. Fix the input on its own screen and the Hub updates the moment the change saves. If the math itself looks off after you have verified the inputs, that is a bug worth reporting through Settings, then Bugs.' },
        { q: 'I missed a week of data. Can I go back and add it?',
          a: 'Yes. Open Week History and any recent week you have not confirmed carries a Confirm button. That opens Confirm the Week for that week: fill in the numbers from your POS and inventory count for that period and save. The Hub regenerates with the new week included. The trend charts, the audit data tiers, and the recovery math all redraw based on whatever weeks exist, not a fixed calendar. If you missed several weeks, work newest first or oldest first, whatever fits your records. The order does not matter to Bar Cop. What matters is filling the gaps so the trend math has continuous data to average against. Nothing is frozen: the recovery math reads your weeks fresh every time it runs, so a week you fill in counts the moment it lands, even against a fix you logged months ago. If it falls in a gap\'s first three weeks it becomes part of that gap\'s baseline.' },
        { q: 'My POS numbers do not match what Bar Cop is showing.',
          a: 'Three common causes, in order of how often they show up. First, net vs gross. Most POSes default to gross, the total ring before voids, comps, and refunds. Bar Cop uses net sales, the figure after voids and comps. If your POS report shows $24,000 gross and Bar Cop shows $22,400, the $1,600 gap is your void and comp activity for the week, which is exactly what should be excluded. Second, period cutoff. Most POSes cut the day at 4am or at close, not at midnight. Bar Cop\'s weekly periods cut on the period_end date at midnight. If your POS week ends Sunday at 4am Monday and your Bar Cop week ends Sunday at midnight, four hours of Sunday-night sales sit on opposite sides of the line. Set the Bar Cop period_end to match your POS week boundary and the gap closes. Third, manual overrides. Anything you type over a cell in Confirm the Week wins over whatever Control fed in. If the auto-filled revenue from Shift Control was $22,400 and you typed $23,800 over it, the week now reads $23,800. Refresh from Control re-runs the pull, and when a cell you edited differs from the fresh figure it asks before replacing it, so you can Keep My Numbers or take the calculated ones. If none of those explain the gap, the variance itself is useful data. A persistent unexplained discrepancy between POS sales and Bar Cop sales is often the first signal of cash handling or void-fraud activity, which is what Sales Integrity and the Operations Audit exist to surface.' },
        { q: 'I have a question about a specific screen or system.',
          a: 'Every system has its own Help and FAQ in its own sidebar. Profit Recovery Help covers the Profit Audit and Fix, how recovery is measured, the weekly numbers, and loss, cash and vendors. Revenue Recovery Help covers menu items, menu engineering, RPLH, check average, and events. Cash Recovery Help covers trapped cash, the cash forecast, capital efficiency, and paying vendors on terms. The three Control systems each have their own Help too. This page is for cross-system questions about Bar Cop, the Hub, accounting, compliance, multi-location operation, and your account.' },
        { q: 'I logged data and the Hub did not update.',
          a: 'Two things to check. First, did the save complete? Most screens show a brief Saved confirmation in gold after a successful write. If you closed the screen before that appeared, the change may not have committed. Reopen the screen and verify the data is there. Second, are you looking at the right week? Most Hub figures roll up to the current period. A shift logged for last week shows up in last week, not this week. Cross-system rollups also need the week to be closed and saved on the relevant system before they reflect.' },
        { q: 'Something is broken.',
          a: 'Use Report a Bug in the Support section of the sidebar. Tell us what you were doing when it broke and what you expected to see instead. A screenshot of the screen helps. Reports come straight to support and we triage every one. If the bug is blocking you from running your shift, say so in the description and we move it to the top of the queue.' },
        { q: 'I want a feature that does not exist yet.',
          a: 'Use Report a Bug in the Support section and describe the feature instead of a problem. Tell us what you are trying to do, what would help, and how often you would use it. Every note gets read by the team that builds Bar Cop, and operator suggestions drive most of what gets built next. Specific requests with a real use case land louder than abstract wishlists.' }
      ]}
    ],

  /* ⛔ THE ONE TABLE THAT DECIDES THE PAGE. Label an operator recognises, then the objects whose
     `SECTIONS` fill that tab. A missing object is skipped rather than throwing, because a help
     page that goes blank when one script fails to load is worse than one that is short. */
  SOURCES: [
    ['Bar Cop',   ['HubHelp']],
    ['Inventory', ['InventoryHelp']],
    ['Run Audit', ['HubAuditHelp', 'Help']],
    ['The Floor', ['LaborHelp', 'ShiftHelp']],
    ['Menus',     ['RevenueHelp']],
    ['Events',    ['EventsHelp']],
    ['Books',     ['HubBooksHelp', 'CashHelp']],
    ['Settings',  ['HubSettingsHelp']]
  ],

  /* Resolve SOURCES into flat, tagged Q&A per tab. Each answer keeps its own topic heading, so a
     tab that gathers two sources still reads as the grouped FAQ it came from. */
  groups() {
    return this.SOURCES.map(([label, names]) => {
      const qa = [];
      names.forEach(n => {
        const o = (typeof S !== 'undefined') ? S[n] : null;
        const secs = (o && Array.isArray(o.SECTIONS)) ? o.SECTIONS : [];
        secs.forEach(sec => (sec.qa || []).forEach(it => qa.push({ topic: sec.t, q: it.q, a: it.a })));
      });
      return { label: label, qa: qa };
    }).filter(g => g.qa.length);
  },

  render(container) {
    this.container = container;
    this.tab = 0;
    this.query = '';
    this.draw();
  },

  draw() {
    const gs = this.groups();
    const intro = '<div class="card" style="margin-bottom:14px;">'
      + this.INTRO.map(t => '<div class="pdf-para" style="font-size:12.5px;color:var(--t2);line-height:1.7;margin-bottom:8px;">' + esc(t) + '</div>').join('')
      + '</div>';
    const search = '<div class="f" style="max-width:420px;margin-bottom:8px;">'
      + '<input type="text" id="help-search" placeholder="Search all of Bar Cop help..." autocomplete="off" value="' + esc(this.query) + '"/></div>';
    const tabs = '<div class="ch-tabs no-print">'
      + gs.map((g, i) => '<button class="ch-tab' + (this.tab === i ? ' on' : '') + '" data-tab="' + i + '">' + esc(g.label) + '</button>').join('')
      + '</div>';
    this.container.scrollTop = 0;
    this.container.innerHTML = '<div class="screen">' + intro + search + tabs
      + '<div id="help-body">' + this.bodyHtml() + '</div>' + App.helpFooter() + '</div>';
    this.wire();
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
  },

  // The active tab, or — when the search box has text — every match across EVERY section, each
  // tagged with the section it came from. That cross-section search is the whole point of one page.
  bodyHtml() {
    const gs = this.groups();
    const q = this.query.trim().toLowerCase();
    if (q) {
      const hits = [];
      gs.forEach(g => g.qa.forEach(it => {
        if (it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q)) hits.push({ tag: g.label + ' · ' + it.topic, q: it.q, a: it.a });
      }));
      if (!hits.length) return '<div style="padding:18px 2px;color:var(--t3);font-size:13px;">No help topics match that search. Try a different word.</div>';
      return hits.map(h => this.qaHtml(h.q, h.a, h.tag)).join('');
    }
    const g = gs[this.tab] || gs[0];
    if (!g) return '<div style="padding:18px 2px;color:var(--t3);font-size:13px;">Help is still loading.</div>';
    let last = '';
    return g.qa.map(it => {
      const head = (it.topic && it.topic !== last) ? (last = it.topic, it.topic) : '';
      return this.qaHtml(it.q, it.a, head);
    }).join('');
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
