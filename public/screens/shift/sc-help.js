'use strict';

/* ── Shift Control — Help and FAQ ─────────────────────────────────────────────
   The in-app knowledge layer for Shift Control. Explains shifts, cash control,
   operations logs, checklists, reports, and how Shift Control feeds Profit and
   Revenue Recovery plus the Inventory Control par alerts. Voice and structure
   match the Recovery help screens for consistency across the platform. */

S.ShiftHelp = {
  render(container, actions) {
    if (actions) actions.innerHTML = '';
    const sections = [
      { t: 'Getting Started', qa: [
        { q: 'What does Shift Control do?',
          a: 'Shift Control is where the night happens. Active shift management, shift revenue, covers, cash drops, the safe log, drawer variances, the 86 list, voids and comps, maintenance issues, opening and closing checklists. It is one of three Control systems (Inventory, Labor, Shift) that capture daily operations. Shift revenue from here is the single source for the weekly revenue number every Recovery system reads. Cash data feeds Profit Recovery\'s Cash Reconciliation and the Profit Audit. Voids feed Theft Risk. Repeat 86s feed Inventory Control\'s par alerts. Run Shift Control well and the rest of Bar Cop produces honest numbers without you typing the same data twice.' },
        { q: 'Where do I start?',
          a: 'Two paths in. If you are setting up for the first time, build your opening and closing checklist templates on the Templates screen so they are ready when the first shift starts. If you are mid-week and want to capture data from this point forward, open Active Shift at the start of your next shift, log shift type, manager, opening bank, and run the shift from there. The Getting Started checklist on the Hub sidebar lists Shift Control tasks (templates first, then first shift logged, then first cash drop) in order.' },
        { q: 'Active Shift versus Log a Shift, what is the difference?',
          a: 'Active Shift is the live command center for running a shift in real time. Start it, run the operations, end it. As the shift runs you tap into Cash Drop, Void/Comp Log, 86 List from inside Active Shift without losing your place. Log a Shift is for after the fact: a shift that happened but did not get logged live, or a shift that needs editing. Both write the same shift record, so use whichever fits the moment.' }
      ]},
      { t: 'Shifts and Revenue', qa: [
        { q: 'How do I run a shift live?',
          a: 'Open Active Shift, enter shift type (AM, PM, Late, or your custom types), manager on duty, drawer/register, opening bank, and staff on floor. The drawer dropdown pulls from your Drawers list under Setup; picking one pre-fills the Opening Bank from that drawer\'s default. As the night runs, use the in-shift tiles to drop cash, log voids and comps, mark 86s, and update maintenance issues without leaving Active Shift. Drop notes throughout the shift in the Shift Notes card (timestamped automatically, flow into the Handoff Report at close). At close, hit End Shift, run the Shift Close Wizard (Revenue + Covers, Cash Reconciliation, Exception Review, Tip Reconciliation, Handoff Notes), and the shift saves to Shift History with everything attached.' },
        { q: 'What are Shift Notes?',
          a: 'A timestamped notebook for things the closer or the next manager should know, captured as the shift runs instead of trying to remember at close. Delivery short on bourbon, VIP at 9pm, server X went home sick, weather slowing us down. Each note records the time you added it. Notes flow into the Shift Handoff Report so the next manager opens the night knowing what happened on the prior one.' },
        { q: 'What does the Shift Close Wizard do?',
          a: 'Five steps in order: Revenue and Covers (bar + floor + total covers), Cash Reconciliation (opening bank plus POS cash sales minus drops vs counted cash, auto-creates a Variance Log entry if outside tolerance), Exception Review (open 86s, big voids/comps, open maintenance, closing checklist completion), Tip Reconciliation (POS tip total vs logged tips, inline tip pool calculator that writes a pool record with shift_id), and Handoff Notes (free text for the opener). Saving runs all the writes at once.' },
        { q: 'Why does shift revenue matter so much?',
          a: 'It is the single source of weekly revenue for Bar Cop. Profit Recovery and Revenue Recovery both read the weekly sum of your logged shift revenue. You enter it once here and never re-type it. Covers feed the check-average calculation in Revenue Recovery and the Server Check screen. Get every shift logged and the weekly numbers downstream stay honest without manual override.' },
        { q: 'What if I missed logging a shift?',
          a: 'Open Log a Shift, enter the missing shift\'s date and details, save. It lands in Shift History where it belongs. Until it is logged, the weekly revenue total in Profit and Revenue This Week sums only the shifts that exist, so the number is low. Either log the missing shift or override the weekly total manually in This Week (with a flagged note). Logging the shift is the cleaner path because it feeds every downstream system; overrides only patch the one weekly figure.' },
        { q: 'What does Shift History show?',
          a: 'Every saved shift, sorted newest first. Click any shift for the unified detail page: Profile (manager, drawer, opening bank, staff on floor), Revenue (bar/floor/covers/check average), Cash Reconciliation (opening bank, POS cash, drops, expected, counted, variance, status), Tip Reconciliation (logged vs POS vs variance), Exception Review acknowledgments, every timestamped Shift Note from during service, manager Notes, and the closing Handoff Notes. Nothing hidden, no "click here to see more" buried behind a second button. Use the history to spot the shift that ran outside the norm.' },
        { q: 'How do I print or email a Shift Handoff Report?',
          a: 'Open the shift in Shift History (or from the Shift Closed confirmation screen right after running the close wizard) and click Handoff Report. A one-page styled report opens in a new tab and auto-fires print. The Email Handoff button on the same screen opens your email client pre-filled with the same content as plain text so you can send it to the opener.' }
      ]},
      { t: 'Cash Control', qa: [
        { q: 'What is a cash drop?',
          a: 'Cash pulled from a register and moved to the safe during or at the end of a shift. Log each one in Cash Drop with the register, the cashier, and the amount. The denomination grid counts the bills and coins for you and fills the amount automatically, so the count is documented in addition to the total. Cash drops feed Profit Recovery\'s Cash Reconciliation as the running picture of cash control for the period.' },
        { q: 'How does the Safe Log work?',
          a: 'A running ledger of cash moving in and out of the safe: drops in, banks issued and returned, deposits prepared, paid-outs. Every entry carries a running balance, so at any moment you know what the safe should hold. Reconcile the running balance against the physical count at the end of each shift or at least daily. A safe that does not balance against the log is a problem the log itself surfaces immediately.' },
        { q: 'What is the Variance Log?',
          a: 'At the end of a shift, the expected cash from the POS gets compared against the cash actually counted. The difference is the variance, logged here automatically when you close out the drawer in Active Shift (with the shift\'s drawer and manager pre-filled) or manually entered if needed. The tolerance is set under Shift Control Setup, Cash Tolerances (default $10, with optional overrides per shift type and per shift). Anything outside tolerance flags as Over or Short. A row with both expected and counted at zero shows as Not Counted instead of falsely Within Tolerance. Profit Recovery Cash Reconciliation reads from this log; the Profit Audit cash section reads from it too.' },
        { q: 'What do the variance colors mean?',
          a: 'Within tolerance is gold (OK). Over (more cash than expected) shows neutral. Short (less cash than expected) shows red. The repeat-offender data feeds the Theft Risk Scorecard in Profit Recovery, so a bartender who is consistently $5 short across every shift is a pattern Bar Cop surfaces without you having to track it on paper.' },
        { q: 'What is Cash Control?',
          a: 'One screen that assembles the cash picture: current safe balance (lifetime), summary tiles (drops in, safe out, drawer net, out-of-tolerance counts), a Net In Window figure that shows how the safe moved over the selected date range, and a chronological activity stream merging every safe entry, drop, and variance. Read-only by design (every event still gets logged on its dedicated screen). It is the assembled-picture view rather than another entry point.' }
      ]},
      { t: 'Operations Logs', qa: [
        { q: 'How does the 86 List work?',
          a: 'When something runs out, 86 it: pick the menu item or the inventory product from the dropdown, optionally add a reason (out of product, equipment down, no prep time). The item shows as a large card visible from any screen until someone marks it Back In Stock. Active during-shift use is mobile-first so a bartender on the floor can 86 a product in three taps. Print Blank Sheet on the 86 List actions row prints a paper grid the bar can mark up during service, then the manager enters into Bar Cop after close. Repeat 86s on the same product across recent shifts flow into Inventory Control as par-level alerts.' },
        { q: 'What goes in the Void and Comp Log?',
          a: 'Every voided ticket and every comped item, with who authorized it. The Item field suggests menu items from your Revenue Recovery menu (so rollups stay clean) but lets you type a custom name. The log feeds Profit Recovery Theft Risk Scorecard (volume and pattern matter) and the Profit Audit exception analysis. Print Blank Sheet on the Void/Comp Log gives you a paper tally sheet to clip to the POS during service; manager enters into Bar Cop after close.' },
        { q: 'What is the Maintenance Log for?',
          a: 'Broken equipment, facility issues, and operational problems that need attention. Each entry has a priority (Urgent, High, Normal, Low) and a status (Open, In Progress, Resolved). Resolved entries must carry a resolution date so the audit trail is honest. Assigned To suggests staff from your roster but accepts free text for external vendors (HVAC, plumber). Urgent and open items show up as alerts on the Hub Dashboard so a problem from Saturday night carries over to Sunday\'s manager until it gets resolved.' },
        { q: 'What is the Walked Tabs log?',
          a: 'Customers who leave without paying, mis-billed checks, lost-check write-offs. Real dollar losses that previously evaporated into "I think we lost about $73 somewhere on Saturday." Log the server, the amount, the reason (Walked / Mis-bill / Refused to Pay / Lost Check / Other), and the manager who absorbed the loss. The data attributes losses to the right server and shift instead of disappearing into the weekly total, and creates a server trend signal over time.' },
        { q: 'What is the Incident Log?',
          a: 'The manager\'s insurance/legal logbook. Customer slip-and-fall, altercation between guests, refusal of service, employee injury, theft observed, property damage, police visit, health inspector visit, ABC or liquor authority visit, fire marshal. Captures date, time, type, severity, manager on duty, location in building, people involved, description, witnesses, action taken, and follow-up needed. Edit any logged incident and the Print Insurance Report button generates a one-page styled report you hand to your insurance broker or attorney. Documented the same night beats trying to reconstruct it months later when a claim hits.' }
      ]},
      { t: 'Checklists', qa: [
        { q: 'How do the Opening and Closing Checklists work?',
          a: 'Each screen runs the appropriate checklist for the shift. The list comes from a template you built (or a built-in default if you have not made one yet). Tap items to check them off as you complete them. Saving records who completed the checklist, the time, and the completion percentage. The checklist feeds the Operations Report under Checklist Completion, so you can see at the end of the week which shifts ran the open and close properly and which ones skipped steps. Completed runs land in the history section below the runner; click View to see the per-item detail and Print This Checklist to print the record.' },
        { q: 'How do I build my own checklist?',
          a: 'On the Templates screen, create an Opening or Closing template. Add items in order, edit existing items, reorder by drag, or load the default list as a starting point and modify from there. Your saved templates appear automatically in the Opening Checklist and Closing Checklist screens for the next shift. Most operations end up with one template per shift type and update them quarterly.' },
        { q: 'Why bother with checklists in Bar Cop instead of paper?',
          a: 'Three reasons. First, the digital list shows the same items in the same order to every manager, so the checklist quality does not drift by who is working. Second, the completion data feeds the Operations Report, so checklist quality becomes a measurable thing instead of a maybe-it-happened thing. Third, items can link directly into other Shift Control screens (count the safe, log the cash drop, set the 86 list to clean for the next shift), so the checklist runs the work instead of just describing it.' }
      ]},
      { t: 'Reports', qa: [
        { q: 'What does Shift Reports show?',
          a: 'Revenue and covers broken down by shift type and day of week, over a selectable date range. Spot the patterns: which shift type produces the highest average check, which day of the week underperforms, which manager\'s shifts run hottest on covers. The data is the same data the Revenue Audit uses, just sliced for the operational-decision view.' },
        { q: 'What does Cash Reports show?',
          a: 'Cash drops, variances, and safe balance trends over the date range. The variance summary tells you total over/short for the period, the worst-offender shifts, and any cashier whose variance pattern is statistically off. Cash Reports is the screen to print and walk through with the bookkeeper or accountant; it answers the cash-control questions every back-office review hits.' },
        { q: 'What does Operations Reports show?',
          a: 'Voids and comps by manager and by cashier, the most-86\'d items, maintenance items open and resolved over the period, and checklist completion rates by shift. Use it monthly. The most-86\'d items list often surfaces an ordering pattern (a vendor whose Tuesday delivery never has enough of a specific product, for example) that no single shift would catch. Each report exports to PDF.' }
      ]},
      { t: 'How Shift Control Feeds the Rest of Bar Cop', qa: [
        { q: 'What flows from Shift Control to Profit Recovery?',
          a: 'Four connections, all read-only on the Recovery side, all always-on (Rule 14). Shift revenue feeds Profit This Week\'s revenue line (weekly sum of logged shifts). Cash drops and variances feed Cash Reconciliation as a read-only diagnosis view. Cash variance data feeds the Profit Audit cash section. Void and comp log feeds the Theft Risk Scorecard and the Profit Audit exception analysis. The single number Bar Cop imports rather than generates is POS revenue, and it enters once per shift here (Rule 24).' },
        { q: 'What flows from Shift Control to Revenue Recovery?',
          a: 'Two connections. Shift revenue feeds Revenue This Week\'s revenue line (same weekly sum as Profit, broken out as bar revenue and floor revenue). Cover count from each shift feeds Revenue This Week\'s covers and the check-average calculation that drives Server Check and the Check Average screen.' },
        { q: 'What flows from Shift Control to Inventory Control?',
          a: 'One feed. Repeat 86s on the same product across multiple recent shifts surface as par-level alerts in Inventory Control. A product 86\'d three times in two weeks is a stocking-or-par problem, and Bar Cop flags it on the Inventory Control side so the par level gets reviewed before the next 86.' },
        { q: 'What flows from Shift Control to the Hub?',
          a: 'Maintenance Log entries marked Urgent and Open flow to the Hub Dashboard alert strip so they stay visible across shift changes until resolved. The Hub also reads the running shift count for the Weekly Status tile so the operator can see at a glance how many shifts of the current week have been logged.' }
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
