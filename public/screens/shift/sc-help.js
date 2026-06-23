'use strict';

/* ── Shift Control — Help and FAQ ─────────────────────────────────────────────
   The in-app knowledge layer for Shift Control. One topic at a time on the same
   underline tab switcher used by Cash History and Reports, plus a live search
   box that filters questions across every topic. Per-screen step-by-step
   directions live in each screen's nav "i" panel (showHowTo), so this FAQ stays
   on orientation, the why, cross-system connections, and troubleshooting, not the
   how-to. Content tracks the current Shift Control: the weekly cockpit (the POS
   sales import), Cash Control and Cash History, the operations logs, the unified
   Checklists screen, the tabbed Reports, the registers reference,
   and how Shift Control feeds Profit, Revenue, Inventory, and the Hub. */

S.ShiftHelp = {
  tab: 0,
  query: '',

  showHowTo() {
    App.showHelpModal('Shift Help and FAQ', [
      { p: ['This page is the full Help and FAQ for Shift Control: importing your weekly POS sales, cash control and reconciliation, the operations logs (voids, comps, walked tabs, maintenance), checklists, the reports, and how Shift feeds the rest of Bar Cop.'] },
      { h: 'Finding An Answer', p: ['Pick a topic along the top, or type a word in the search box to pull every matching question across all topics at once. A search for "drawer" or "comp" lands you on the right answer fast.'] },
      { h: 'Directions For A Specific Screen', p: ['Every working screen in Shift Control carries its own directions. Open the screen you have a question about, like Cash Control or the Void and Comp Log, and tap this same info i button at the top to read the step-by-step for that page. This FAQ covers the why and how it all connects; the per-screen i covers the how-to.'] }
    ]);
  },

  SECTIONS: [
    { t: 'Getting Started', qa: [
      { q: 'What does Shift Control do?',
        a: 'Shift Control captures the operating week: your imported POS sales (revenue and covers), cash drops, the safe log, drawer variances, voids and comps, maintenance issues, walked tabs, and your opening and closing checklists. It is one of three Control systems (Inventory, Labor, Shift) that capture daily operations. Your imported sales are the single source for the weekly revenue number every Recovery system reads. Cash data feeds Profit Recovery Cash Reconciliation and the Profit Audit. Voids and comps feed Theft Risk. Run Shift Control well and the rest of Bar Cop produces honest numbers without you typing the same data twice.' },
      { q: 'Where do I start?',
        a: 'A little setup, then a weekly habit. To set up, build your opening and closing checklist templates on Checklist Templates and add your registers on Add Registers. Then each week, open the Shift dashboard and import this week\'s POS sales: one "sales by day" export, dropped once, lands the whole week. The Getting Started checklist on the Hub lists the Shift Control tasks in order.' },
      { q: 'How do I add or fix a past week?',
        a: 'Import it. On the Shift dashboard, step the week selector back to the week you want and drop that week\'s POS sales export. Re-importing a week replaces those days, so correcting a week is just re-importing it. Until a week is imported, the weekly revenue total only sums the days that exist, so the number reads low.' }
    ]},
    { t: 'Sales and Revenue', qa: [
      { q: 'How do I get my sales into Bar Cop?',
        a: 'On the Shift dashboard, the first step is Import this week\'s sales. Pull a "sales by day" report from your POS for the week and drop it: one file, one row per day. Bar Cop reads the whole week at once and lands each day\'s bar revenue, food revenue, and covers. Re-importing a week replaces those days so it never double-counts. No daily entry and no live shift to run; the POS is the system of record for sales and Bar Cop ingests it once a week.' },
      { q: 'Why does the sales import matter so much?',
        a: 'It is the single source of weekly revenue for Bar Cop. Profit This Week and Revenue This Week both fill their revenue and covers straight from the imported days, so you confirm the week instead of typing it. Covers feed the check-average in Revenue Recovery and the Server Check screen. Import every week and the numbers downstream stay honest without manual override.' }
    ]},
    { t: 'Cash Control', qa: [
      { q: 'Where do I enter cash activity?',
        a: 'On Cash Control. It is the one place you log drops, safe moves, and drawer counts, with a shared bill counter that totals the denominations for you. Past entries are read-only on Cash History, split into Cash Drops, Safe Log, and Variances tabs. Enter on Cash Control, review on Cash History.' },
      { q: 'What is a cash drop?',
        a: 'Cash pulled from a register and moved to the safe during or at the end of a shift. Log each one on Cash Control with the register, who pulled it, and the amount. The denomination grid counts the bills and coins and fills the amount for you, so the count is documented along with the total. Drops feed Profit Recovery Cash Reconciliation as the running picture of cash control for the period.' },
      { q: 'How does the Safe Log work?',
        a: 'A running ledger of cash moving in and out of the safe: drops in, banks issued and returned, deposits prepared, paid-outs. Every entry carries a running balance, so at any moment you know what the safe should hold. Count the safe against that balance at least daily. A safe that does not balance against the log is a problem the log surfaces immediately.' },
      { q: 'What is a variance, and where does it come from?',
        a: 'At close, the expected cash from the POS is compared against the cash actually counted. The difference is the variance, created when you reconcile a drawer in Cash Control, or entered by hand if needed. The tolerance is set per register on Add Registers (default $10), so a busy main bar can run a wider tolerance than a slow service well. Anything outside that register\'s tolerance flags Over or Short, and a drawer with nothing counted shows Not Counted instead of a false Within Tolerance. Profit Recovery Cash Reconciliation and the Profit Audit both read this.' },
      { q: 'What do the variance colors mean?',
        a: 'Within tolerance is green. Short, meaning less cash than expected, is red. Over, meaning more cash than expected, is amber. A drawer that was never counted shows grey as Not Counted. The repeat-offender pattern feeds the Theft Risk Scorecard in Profit Recovery, so a bartender consistently short across shifts is a pattern Bar Cop surfaces without you tracking it on paper.' }
    ]},
    { t: 'Operations Logs', qa: [
      { q: 'What goes in the Void and Comp Log?',
        a: 'Every voided ticket and every comped item, logged by the dollar amount (a whole comped table is one line, not one per item). The item is optional, picked from the menu-and-inventory dropdown when you want the link or left off. The Reason carries the classification: customer-facing comps such as service recovery, goodwill, regular or VIP, and promo are loss and feed Theft Risk, while Staff Meal and Shift Drink are policy expense tracked as cost in Books and Year-End. Enter a whole shift at once in the batch builder, or edit a single row to add a check number or a note. The log feeds the Theft Risk Scorecard and the Profit Audit exception analysis.' },
      { q: 'How does Bar Cop catch comp abuse?',
        a: 'By comp volume per server, not by whether a manager name was typed (that is a POS-native control). Log every comp against the server who rang it with an honest Reason, and Loss Prevention ranks comp dollars by server and flags anyone running well above the rest of the floor, the bartender giving away rounds. Authorized By stays on the form as an optional record of who cleared a comp, but it does not drive the flag.' },
      { q: 'What is the Maintenance Log for?',
        a: 'Broken equipment, facility issues, and operational problems that need attention. Each entry has a priority (Urgent, High, Normal, Low) and a status (Open, In Progress, Resolved). Assigned To suggests staff from your roster but takes free text for an outside vendor like an HVAC tech or a plumber. Urgent open items show up as alerts on the Hub Dashboard so a problem from Saturday night carries to Sunday manager until it gets resolved.' },
      { q: 'What is the Walked Tabs log?',
        a: 'Customers who leave without paying, mis-billed checks, lost-check write-offs. Real dollar losses that used to evaporate into "I think we lost about $73 somewhere on Saturday." Log the server, the amount, the reason (Walked, Mis-bill, Refused to Pay, Lost Check, Other), and the manager who absorbed it. The log attributes the loss to the right server and shift instead of the weekly total, and builds a server trend over time.' }
    ]},
    { t: 'Checklists', qa: [
      { q: 'How do the checklists work?',
        a: 'One Checklists screen runs both routines. Toggle Opening or Closing up top (it starts on the one that fits the time of day), and the items come from a template you built or a built-in default. Tap items to check them off, then Save to record who completed it, the date, and the completion percentage. Completed runs land in the filterable history below, where View shows the per-item detail and Export PDF saves the record. Completion feeds the Reports Operations tab so you can see which shifts ran the open and close properly and which skipped steps.' },
      { q: 'Why use checklists in Bar Cop instead of paper?',
        a: 'Three reasons. The digital list shows the same items in the same order to every manager, so quality does not drift by who is working. The completion data feeds the Reports Operations tab, so checklist quality becomes measurable instead of a maybe-it-happened. And a blank Worksheet still prints for the clipboard when you want to run it on paper and enter it after.' }
    ]},
    { t: 'Reports', qa: [
      { q: 'What is on the Shift tab?',
        a: 'Revenue and covers broken down by day over the date range you pick. Spot the patterns: which day produces the highest average check, which day underperforms, which day runs hottest on covers. Same data the Revenue Audit uses, sliced for the operational decision.' },
      { q: 'What is on the Cash tab?',
        a: 'Cash drops by drawer, variances by cashier, net over/short, and the safe balance over the date range. The variance summary tells you the total over/short for the period and which cashier pattern is off. This is the tab to print and walk through with the bookkeeper.' },
      { q: 'What is on the Operations tab?',
        a: 'Voids and comps by server and by reason, maintenance open and resolved, and checklist completion by type. Use it monthly to spot the patterns a single shift would not catch, like a server who runs a high comp total or a checklist that keeps getting skipped.' }
    ]},
    { t: 'Connections', qa: [
      { q: 'What flows from Shift Control to Profit Recovery?',
        a: 'Four connections, all read-only on the Recovery side. Your imported sales feed Profit This Week revenue line (the weekly sum of the imported days). Cash drops and variances feed Cash Reconciliation as a diagnosis view. Cash variance feeds the Profit Audit cash section. Voids and comps feed the Theft Risk Scorecard and the Profit Audit exception analysis. POS revenue is imported, not calculated, and it enters once a week here via the sales import.' },
      { q: 'What flows from Shift Control to Revenue Recovery?',
        a: 'Two connections. Your imported sales feed Revenue This Week revenue line (the same weekly sum as Profit, broken out as bar and floor). Covers from the import feed Revenue This Week cover count and the check-average that drives Server Check and the Check Average screen.' },
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
