'use strict';

/* ── Shift Control — Help and FAQ ─────────────────────────────────────────────
   The in-app knowledge layer for Shift Control. One topic at a time on the same
   underline tab switcher used by Cash History and Reports, plus a live search
   box that filters questions across every topic. Content tracks the current
   Shift Control: Active Shift (live + past shifts), the Cash Board and Cash
   History, the unified Checklists screen, the tabbed Reports, and how Shift
   Control feeds Profit, Revenue, Inventory, and the Hub. */

S.ShiftHelp = {
  tab: 0,
  query: '',

  SECTIONS: [
    { t: 'Getting Started', qa: [
      { q: 'What does Shift Control do?',
        a: 'Shift Control is where the night happens. Active shift management, shift revenue, covers, cash drops, the safe log, drawer variances, the 86 list, voids and comps, maintenance issues, walked tabs, and your opening and closing checklists. It is one of three Control systems (Inventory, Labor, Shift) that capture daily operations. Shift revenue from here is the single source for the weekly revenue number every Recovery system reads. Cash data feeds Profit Recovery Cash Reconciliation and the Profit Audit. Voids and comps feed Theft Risk. Repeat 86s feed Inventory Control par alerts. Run Shift Control well and the rest of Bar Cop produces honest numbers without you typing the same data twice.' },
      { q: 'Where do I start?',
        a: 'Two paths in. If you are setting up for the first time, build your opening and closing checklist templates on Checklist Templates so they are ready when the first shift starts. If you are mid-week and want to capture data from this point forward, open Active Shift at the start of your next shift, tap the daypart, the manager on duty, and the registers in play, set each opening bank, and open the floor. The Getting Started checklist on the Hub lists the Shift Control tasks in order.' },
      { q: 'How do I log a shift that already happened?',
        a: 'Open Active Shift. Below the open-the-floor card is Recent Shifts, where you can log a past shift or edit one that needs fixing. It writes the same shift record as a live shift, so a shift entered after the fact feeds every downstream number exactly the same way. Until a shift is logged, the weekly revenue total sums only the shifts that exist, so the number reads low.' }
    ]},
    { t: 'Shifts and Revenue', qa: [
      { q: 'How do I run a shift live?',
        a: 'Open Active Shift and tap through the opener: the daypart (Brunch, Lunch, Dinner, Late Night, or your custom types), the manager on duty, the registers live tonight, and each one opening bank. The registers come from your Drawers and Registers list under Setup. Open the floor and the shift is running. As the night runs, the in-shift tiles let you drop cash, log voids and comps, mark 86s, and log maintenance without leaving the screen, and the Shift Notes card timestamps anything the next manager should know. At close, run the Shift Close Wizard and the shift saves to Shift History with everything attached.' },
      { q: 'What are Shift Notes?',
        a: 'A timestamped notebook for things the closer or the next manager should know, captured as the shift runs instead of trying to remember at close. Delivery short on bourbon, VIP at 9pm, server went home sick, weather slowing us down. Each note records the time you added it, and the notes flow into the Shift Handoff so the next manager opens the night knowing what happened on the prior one.' },
      { q: 'What does the Shift Close Wizard do?',
        a: 'Five steps in order: Revenue and Covers (bar, floor, and total covers), Cash Reconciliation (opening bank plus POS cash sales minus drops against the counted cash, which auto-creates a variance entry if it lands outside tolerance), Exception Review (open 86s, large voids and comps, open maintenance, closing checklist completion), Tip Reconciliation (POS tip total against logged tips, with an inline tip pool calculator), and Handoff Notes for the opener. Saving runs all the writes at once.' },
      { q: 'Why does shift revenue matter so much?',
        a: 'It is the single source of weekly revenue for Bar Cop. Profit Recovery and Revenue Recovery both read the weekly sum of your logged shift revenue. You enter it once here and never re-type it. Covers feed the check-average calculation in Revenue Recovery and the Server Check screen. Get every shift logged and the weekly numbers downstream stay honest without manual override.' },
      { q: 'What does Shift History show?',
        a: 'Every saved shift, newest first, read-only. Click any shift for the full detail page: profile (manager, registers, opening banks, staff on floor), revenue (bar, floor, covers, check average), cash reconciliation (opening bank, POS cash, drops, expected, counted, variance, status), tip reconciliation, the exception-review acknowledgments, every timestamped shift note from during service, and the closing handoff notes. Nothing buried behind a second click. Use it to spot the shift that ran outside the norm.' },
      { q: 'How do I save a Shift Handoff?',
        a: 'Open the shift in Shift History, or use the confirmation screen right after you run the close wizard, and Save Handoff PDF gives you a clean one-page handoff to keep or hand to the opener.' }
    ]},
    { t: 'Cash Control', qa: [
      { q: 'Where do I enter cash activity?',
        a: 'On Cash Control. It is the one place you log drops, safe moves, and drawer counts, with a shared bill counter that totals the denominations for you. Past entries are read-only on Cash History, split into Cash Drops, Safe Log, and Variances tabs. Enter on Cash Control, review on Cash History.' },
      { q: 'What is a cash drop?',
        a: 'Cash pulled from a register and moved to the safe during or at the end of a shift. Log each one on Cash Control with the register, who pulled it, and the amount. The denomination grid counts the bills and coins and fills the amount for you, so the count is documented along with the total. Drops feed Profit Recovery Cash Reconciliation as the running picture of cash control for the period.' },
      { q: 'How does the Safe Log work?',
        a: 'A running ledger of cash moving in and out of the safe: drops in, banks issued and returned, deposits prepared, paid-outs. Every entry carries a running balance, so at any moment you know what the safe should hold. Count the safe against that balance at least daily. A safe that does not balance against the log is a problem the log surfaces immediately.' },
      { q: 'What is a variance, and where does it come from?',
        a: 'At close, the expected cash from the POS is compared against the cash actually counted. The difference is the variance, created automatically when you count a drawer in Active Shift (with the shift register and manager pre-filled), or entered by hand if needed. The tolerance lives under Setup, Cash Tolerances (default $10, with optional overrides per daypart and per shift). Anything outside tolerance flags Over or Short, and a drawer with nothing counted shows Not Counted instead of a false Within Tolerance. Profit Recovery Cash Reconciliation and the Profit Audit both read this.' },
      { q: 'What do the variance colors mean?',
        a: 'Within tolerance is green. Short, meaning less cash than expected, is red. Over, meaning more cash than expected, is amber. A drawer that was never counted shows grey as Not Counted. The repeat-offender pattern feeds the Theft Risk Scorecard in Profit Recovery, so a bartender consistently short across shifts is a pattern Bar Cop surfaces without you tracking it on paper.' }
    ]},
    { t: 'Operations Logs', qa: [
      { q: 'How does the 86 List work?',
        a: 'When something runs out, 86 it: pick the menu item or the inventory product, and optionally add a reason (out of product, equipment down, no prep time). It shows as a card visible from any screen until someone marks it back in stock. During-shift use is mobile-first so a bartender on the floor can 86 a product in a few taps. The Worksheet button prints a blank grid the bar can mark up during service for the manager to enter after close. Repeat 86s on the same product across recent shifts flow into Inventory Control as par-level alerts.' },
      { q: 'What goes in the Void and Comp Log?',
        a: 'Every voided ticket and every comped item, logged by the dollar amount (a whole comped table is one line, not one per item). The item is optional, picked from the menu-and-inventory dropdown when you want the link or left off. The Reason carries the classification: customer-facing comps such as service recovery, goodwill, regular or VIP, and promo are loss and feed Theft Risk, while Staff Meal and Shift Drink are policy expense tracked as cost in Books and Year-End. Enter a whole shift at once in the batch builder, or edit a single row to add a check number or a note. The log feeds the Theft Risk Scorecard and the Profit Audit exception analysis.' },
      { q: 'What is the Comp Authorization Threshold?',
        a: 'Under Setup, Comp Authorization sets the dollar amount above which a comp should have a manager in Authorized By (default $25). Saving a comp over the threshold with no manager pops a soft warning you can override, and every override is flagged in Theft Risk under unauthorized large comps. Set the threshold to 0 to turn the warning off.' },
      { q: 'What is the Maintenance Log for?',
        a: 'Broken equipment, facility issues, and operational problems that need attention. Each entry has a priority (Urgent, High, Normal, Low) and a status (Open, In Progress, Resolved). Assigned To suggests staff from your roster but takes free text for an outside vendor like an HVAC tech or a plumber. Urgent open items show up as alerts on the Hub Dashboard so a problem from Saturday night carries to Sunday manager until it gets resolved.' },
      { q: 'What is the Walked Tabs log?',
        a: 'Customers who leave without paying, mis-billed checks, lost-check write-offs. Real dollar losses that used to evaporate into "I think we lost about $73 somewhere on Saturday." Log the server, the amount, the reason (Walked, Mis-bill, Refused to Pay, Lost Check, Other), and the manager who absorbed it. The log attributes the loss to the right server and shift instead of the weekly total, and builds a server trend over time.' }
    ]},
    { t: 'Checklists', qa: [
      { q: 'How do the checklists work?',
        a: 'One Checklists screen runs both routines. Toggle Opening or Closing up top (it starts on the one that fits the time of day), and the items come from a template you built or a built-in default. Tap items to check them off, then Save to record who completed it, the date, and the completion percentage. Completed runs land in the filterable history below, where View shows the per-item detail and Export PDF saves the record. Completion feeds the Reports Operations tab so you can see which shifts ran the open and close properly and which skipped steps.' },
      { q: 'How do I build my own checklist?',
        a: 'On Checklist Templates, create an Opening or Closing template. Add items in order, edit them, drag the handle to reorder, or load the default list as a starting point and modify it. Saved templates appear automatically in the Checklists screen for the next shift. Most operations end up with one template per routine and update them quarterly.' },
      { q: 'Why use checklists in Bar Cop instead of paper?',
        a: 'Three reasons. The digital list shows the same items in the same order to every manager, so quality does not drift by who is working. The completion data feeds the Reports Operations tab, so checklist quality becomes measurable instead of a maybe-it-happened. And a blank Worksheet still prints for the clipboard when you want to run it on paper and enter it after.' }
    ]},
    { t: 'Reports', qa: [
      { q: 'Where are the reports?',
        a: 'One Reports screen with three tabs: Shift, Cash, and Operations. Each tab has a date range and a stats strip up top, then the breakdown tables below, and an Export PDF that saves the tab you are on. Read-only aggregation of everything Shift Control captured.' },
      { q: 'What is on the Shift tab?',
        a: 'Revenue and covers broken down by shift type and by day of week over the date range you pick. Spot the patterns: which daypart produces the highest average check, which day underperforms, which shifts run hottest on covers. Same data the Revenue Audit uses, sliced for the operational decision.' },
      { q: 'What is on the Cash tab?',
        a: 'Cash drops by drawer, variances by cashier, net over/short, and the safe balance over the date range. The variance summary tells you the total over/short for the period and which cashier pattern is off. This is the tab to print and walk through with the bookkeeper.' },
      { q: 'What is on the Operations tab?',
        a: 'Voids and comps by server and by reason, the most-86\'d items, maintenance open and resolved, and checklist completion by type. Use it monthly. The most-86\'d list often surfaces an ordering pattern that no single shift would catch, like a vendor whose delivery never has enough of one product.' }
    ]},
    { t: 'Connections', qa: [
      { q: 'What flows from Shift Control to Profit Recovery?',
        a: 'Four connections, all read-only on the Recovery side. Shift revenue feeds Profit This Week revenue line (the weekly sum of logged shifts). Cash drops and variances feed Cash Reconciliation as a diagnosis view. Cash variance feeds the Profit Audit cash section. Voids and comps feed the Theft Risk Scorecard and the Profit Audit exception analysis. The one number Bar Cop imports rather than calculates is POS revenue, and it enters once per shift here.' },
      { q: 'What flows from Shift Control to Revenue Recovery?',
        a: 'Two connections. Shift revenue feeds Revenue This Week revenue line (the same weekly sum as Profit, broken out as bar and floor). Covers from each shift feed Revenue This Week cover count and the check-average that drives Server Check and the Check Average screen.' },
      { q: 'What flows from Shift Control to Inventory Control?',
        a: 'One feed. Repeat 86s on the same product across recent shifts surface as par-level alerts in Inventory Control. A product 86\'d three times in two weeks is a stocking or par problem, and Bar Cop flags it on the Inventory side so the par gets reviewed before the next 86.' },
      { q: 'What flows from Shift Control to the Hub?',
        a: 'Maintenance entries marked Urgent and Open flow to the Hub Dashboard alerts so they stay visible across shift changes until resolved, and the Hub reads your logged shifts to show how the current week is tracking.' }
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
      + '<input type="text" id="help-search" placeholder="Search Shift Control help..." autocomplete="off" value="' + esc(this.query) + '"/></div>';
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
    // Filter live without re-rendering the input (keeps focus + cursor).
    const search = document.getElementById('help-search');
    if (search) search.addEventListener('input', e => {
      this.query = e.target.value || '';
      const body = document.getElementById('help-body');
      if (body) body.innerHTML = this.bodyHtml();
    });
  }
};
