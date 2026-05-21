'use strict';

/* ── Shift Control — Help and FAQ ─────────────────────────────────────────────
   The in-app knowledge layer for Shift Control — how shifts, cash control,
   operations logs, and checklists work, and how Shift Control feeds Profit
   and Revenue Recovery. */

S.ShiftHelp = {
  FAQ: [
    ['Shifts and Revenue', [
      ['How do I run a shift?',
        'Active Shift is the live command center. Start a shift with the type, manager, and opening '
        + 'bank, then use the one-tap links to log cash drops, voids, and 86s as they happen. End Shift '
        + 'captures the revenue and covers and closes it out.'],
      ['Active Shift vs. Log a Shift — what is the difference?',
        'Active Shift is for running a shift live, start to finish. Log a Shift is for entering a shift '
        + 'after the fact, or editing one. Both write the same shift record, so use whichever fits.'],
      ['Why does shift revenue matter so much?',
        'Shift revenue is the single source of weekly revenue for the whole platform. Profit Recovery '
        + 'and Revenue Recovery both read the weekly sum of your shift revenue — you enter it once here '
        + 'and never re-type it. Covers feed the check-average calculation.'],
      ['What if I did not log every shift in a week?',
        'The weekly number is the sum of the shifts you logged. If a shift is missing, the weekly total '
        + 'in Recovery can be overridden manually — but logging every shift keeps it accurate without '
        + 'any extra work.']
    ]],
    ['Cash Control', [
      ['What is a cash drop?',
        'A cash drop is cash pulled from a register to the safe during or after a shift. Log each one '
        + 'in Cash Drop — the denomination grid counts it for you and fills in the amount. Drops feed '
        + 'Profit Recovery\'s Cash Reconciliation.'],
      ['How does the Safe Log work?',
        'The Safe Log is a running ledger of cash moving in and out of the safe — drops, banks issued '
        + 'and returned, deposits, and paid-outs. Every entry carries a running balance so you always '
        + 'know what should be in the safe.'],
      ['What is the Variance Log?',
        'At the end of a shift you compare expected cash from the POS against the cash you actually '
        + 'counted. The difference is the variance. The tolerance comes from Hub Settings — anything '
        + 'outside it is flagged Over or Short.'],
      ['What do the variance colors mean?',
        'Within tolerance is gold (OK). Over — more cash than expected — is neutral. Short — less cash '
        + 'than expected — is red. Repeated shortages from one cashier feed your Theft Risk score in '
        + 'Profit Recovery.']
    ]],
    ['Operations Logs', [
      ['How does the 86 List work?',
        'When something runs out, 86 it from the 86 List — item, category, and an optional reason. It '
        + 'shows as a large card until someone taps Back In Stock. An item 86\'d repeatedly is flagged, '
        + 'and repeat 86s feed par-level alerts in Inventory Control.'],
      ['What goes in the Void and Comp Log?',
        'Every voided and comped item. Voids and comps are exception transactions that can hide theft '
        + 'or training gaps, so the log feeds Profit Recovery\'s Theft Risk and the Profit Audit\'s '
        + 'exception analysis.'],
      ['What is the Maintenance Log for?',
        'Broken equipment and facility issues — with a priority and a status. Open and urgent items '
        + 'show up as alerts on the Hub so a problem from one shift carries over to the next until it '
        + 'is resolved.']
    ]],
    ['Checklists and Reports', [
      ['How do the Opening and Closing Checklists work?',
        'Each screen runs a checklist for the shift. It uses a template from the Templates screen, or a '
        + 'built-in default when you have not made one. Tap items to check them off; saving records who '
        + 'completed it and how much was done.'],
      ['How do I build my own checklist?',
        'In Templates, create an Opening or Closing template, add and reorder the items, or load the '
        + 'default list as a starting point. Your templates then appear in the Opening and Closing '
        + 'Checklist screens.'],
      ['What do the three reports show?',
        'Shift Reports breaks revenue and covers down by shift type and day of week. Cash Reports '
        + 'summarizes drops, variances, and the safe balance. Operations Reports covers voids/comps, '
        + 'the most-86\'d items, maintenance, and checklist completion. Each one exports to PDF.']
    ]]
  ],

  render(container, actions) {
    actions.innerHTML = '';
    const faqItem = (q, a) =>
      '<details style="border-bottom:1px solid var(--b2);">'
      + '<summary style="font-size:13px;font-weight:700;color:var(--t1);cursor:pointer;padding:12px 2px;">'
      + esc(q) + '</summary>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.7;padding:2px 2px 14px;">' + esc(a) + '</div>'
      + '</details>';
    const section = (title, items) =>
      '<div class="card"><div class="card-title">' + esc(title) + '</div>'
      + items.map(([q, a]) => faqItem(q, a)).join('') + '</div>';

    container.innerHTML = '<div class="screen">'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.7;margin-bottom:16px;">'
      + 'How Shift Control works and how it connects to the rest of Bar Cop. '
      + 'Tap any question to expand it.</div>'
      + this.FAQ.map(([title, items]) => section(title, items)).join('')
      + '</div>';
  }
};
