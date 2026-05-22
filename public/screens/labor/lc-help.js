'use strict';

/* ── Labor Control — Help and FAQ ─────────────────────────────────────────────
   The in-app knowledge layer for Labor Control — how scheduling, hours, tips,
   and reports work, and how Labor Control feeds Revenue and Profit Recovery. */

S.LaborHelp = {
  FAQ: [
    ['Team Setup', [
      ['What is the difference between Positions and Staff Roster?',
        'Positions are the job roles you schedule — bartender, server, line cook — each with a department '
        + 'and a default wage. Staff Roster is the people: each staff member is assigned a position, and '
        + 'their wage defaults from it but can be set per person.'],
      ['Why does wage matter?',
        'Every hour logged or scheduled is costed at the staff member\'s wage. That is what drives labor '
        + 'cost, labor %, and the overtime projections — so keep wages current.']
    ]],
    ['Scheduling', [
      ['How does Build Schedule work?',
        'Pick the week and enter a revenue forecast, then add a shift for each staff member with a day '
        + 'and start/end times. The screen shows live labor cost, labor % against your target, and RPLH '
        + 'as you build. Saving sends it to Schedule History.'],
      ['What are schedule templates for?',
        'A template is a typical week of shifts. Build it once, then use it from the Templates screen to '
        + 'pre-fill Build Schedule instead of starting from scratch every week.'],
      ['Can I edit a saved schedule?',
        'Yes — open it in Schedule History and choose Edit in Build Schedule. Your changes update the '
        + 'same schedule record.']
    ]],
    ['Hours and Actuals', [
      ['How do I log hours?',
        'Log Hours records actual hours worked, by hand or by importing a timeclock export. Each entry '
        + 'is costed at the staff member\'s wage.'],
      ['How does the CSV import work?',
        'In Log Hours, choose Import CSV and upload your timeclock or POS hours file. Match your columns '
        + 'to Staff Name, Date, and Hours — the mapping is remembered. Staff names are matched to your '
        + 'roster; rows that do not match are skipped.'],
      ['What do Daily View and Weekly Summary show?',
        'Daily View is one day — who worked, their cost, and actual versus scheduled. Weekly Summary '
        + 'rolls a week up by staff and by day, with labor % and RPLH against the week\'s forecast.']
    ]],
    ['Tips, Overtime, and Reports', [
      ['How does the Tip Pool Calculator work?',
        'Enter a pool amount and add participants. Split it by hours worked or as an equal split — you '
        + 'can load the pool and participant hours straight from the Tip Log. Saved splits are kept for '
        + 'the record.'],
      ['What is Overtime Watch?',
        'It projects each staff member\'s end-of-week hours from what they have worked and what they are '
        + 'scheduled, flags anyone heading past 40 hours, and quantifies the extra overtime cost.'],
      ['How does Labor Control feed the rest of Bar Cop?',
        'Logged hours flow to Revenue Recovery and Profit Recovery as weekly labor cost and prime cost, '
        + 'and to the RPLH Tracker. Your Staff Roster also feeds the Revenue Recovery server list — set '
        + 'labor data once here and Recovery stays current.']
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
      + 'How Labor Control works and how it connects to the rest of Bar Cop. '
      + 'Tap any question to expand it.</div>'
      + this.FAQ.map(([title, items]) => section(title, items)).join('')
      + '</div>';
  }
};
