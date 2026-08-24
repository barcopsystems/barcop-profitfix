'use strict';

/* ── HELP AND FAQ — THE BUILDING BLOCKS, IN ORDER ─────────────────────────────
   Kyle, 2026-08-24: *"write the faq page in the app based on how bar cop works now.. the building
   blocks starting with inventory first.. and then everything is optional.. but each builds off the
   other.. in the app.. what is this? here is what is.. use it if you want this.. for this to work
   you need to do this.. see i help for detailed page instructions."*

   ⛔⛔⛔ THIS REPLACES A 214-QUESTION PAGE. The version before it gathered all eleven section FAQs
   onto one page behind eight tabs: 53 topics, ~21,000 words. Every word was reachable and most of
   it was accurate, and it was still the wrong page. **The nav was redesigned to make the app less
   confusing, and a 214-question FAQ explaining it put the confusion straight back.** His words:
   *"these FAQs are just way too much.. most of this is covered in the i help section."*

   ⭐⭐⭐ THE SHAPE IS FOUR BEATS PER SECTION AND IT IS HIS, NOT MINE: what it is, what you get if
   you use it, what has to be true for it to work, and nothing else. Depth lives on the per-screen
   "i" and always has. That pointer is the FIRST thing on the page, because somebody who does not
   know the "i" exists will read this whole page hunting for a step-by-step that is one press away.

   ⭐⭐ THE ORDER IS THE ARGUMENT. Inventory is the foundation and everything after it is optional
   and built on the count. `NEEDS` on each block says what it is built on, so the page cannot claim
   a section stands alone when it does not. Rearranging these blocks breaks the point of the page.

   ⛔ NO SUBSCRIPTION, PRICING OR TRIAL QUESTIONS. Kyle: *"questions talk about what a user gets in
   a subscription.. like why? these are in an app they already would have signed up for."*

   ⚠ THE TEN SECTION FAQ FILES ARE NO LONGER READ BY ANYTHING and still hold ~21,000 words. That is
   a RETIREMENT and its own job, not a line in this one ([[the-loop]] #123). `verify-global-help`
   block H names them so the debt cannot go quiet. */
S.HubHelp = {

  // Full-page Hub screen, reached from the rail's Help row. The third argument is what lights that
  // row: a hub page cannot name itself, so `openHubFullPage` passes the action through.
  open() {
    App.openHubFullPage('Help and FAQ', (mount) => this.render(mount), 'help');
  },

  INTRO: [
    'Every working screen has its own directions on the "i" at the top of the page: what to enter, what the numbers mean, and what to do next on that screen. That is where the detail is.',
    'This page is the shape of the thing. It starts with Inventory. Everything after that is optional, and each part is built on the one before it.'
  ],

  /* ⛔ ONE BLOCK PER RAIL SECTION, IN BUILD ORDER. `need` is not filler: it is what has to already
     be true, and it is the difference between a list of features and an order of operations. */
  BLOCKS: [
    { t: 'Inventory', tag: 'Start here',
      what: 'Your products, your counts, your ordering and your deliveries. You count on your phone in your own shelf order, the order sheet fills itself in off that count, and the delivery lands against the order.',
      want: 'Your pour cost and food cost, what to order, what is sitting on your shelves, and your variance.',
      need: 'Set up your products and vendors once, then count on the same day each week. This is the only part everything else needs.' },

    { t: 'The Week', tag: 'Built on your count',
      what: 'One sit-down at the end of the week where your sales, your hours and your count come together and you confirm the week.',
      want: 'To know what the week made and what it cost you a few days after it ends instead of a month later.',
      need: 'A count for that week, plus the week\'s sales and hours. Confirm it once and nothing after this is entered twice.' },

    { t: 'Run Audit', tag: 'Built on your weeks',
      what: 'Four scores off your own numbers. Operations for how the place is being run, and Profit, Revenue and Cash for the dollars.',
      want: 'A ranked list of what is costing you money, priced by the month, biggest first, any day you want it.',
      need: 'At least one confirmed week. The more weeks you close, the more it can score.' },

    { t: 'The Floor', tag: 'Feeds your week',
      what: 'The parts of a shift your POS has no report for. Schedules, hours and tips, the safe, drawer counts, waste, walked tabs, incidents and your checklists.',
      want: 'All of it logged and searchable instead of on paper, and your labor line filled in for you when you close the week.',
      need: 'Add your positions and your staff first. Use only the parts you need; nothing here is all or nothing.' },

    { t: 'Menus', tag: 'Built on your product costs',
      what: 'Your priced menu, ranked on what each item earns you and how well it sells.',
      want: 'To know what to feature, what to reprice, what to promote and what to cut, and what a price change is worth before you make it.',
      need: 'Your products need costs on them in Inventory. Item costs come from there, so a vendor increase turns up here on its own.' },

    { t: 'Events', tag: 'Feeds your week',
      what: 'Bookings, per-head pricing, deposits and a calendar for parties and catering.',
      want: 'Event work tracked with the rest of the business instead of on the side.',
      need: 'Nothing up front. Complete an event and its revenue goes into the week it lands in on its own.' },

    { t: 'Books', tag: 'Built on your weeks',
      what: 'Your statements, your break-even and your forecasts, built out of weeks you have already closed.',
      want: 'A month-end file you hand your bookkeeper instead of a night you lose to paperwork.',
      need: 'Close your weeks, and log the bills that are not product or labor under Money Out.' },

    /* ⚠ SETTINGS TAKES NEITHER LABEL, and that is deliberate rather than an omission. "Use it if
       you want" and "For it to work" are the right two questions for an OPTIONAL BLOCK; Settings is not
       one, so both labels read as nonsense on it. The one thing worth saying early sits in the
       description instead. Read on the rendered page, not decided in the table. */
    { t: 'Settings', tag: '',
      what: 'Your bar name and location, your cost targets, your account and password, your team and what each of them can reach, and a full backup of everything in one file. Set your cost targets early: every audit measures your gaps against them, so a target you never set is a score with nothing behind it.',
      want: '',
      need: '' }
  ],

  render(container) {
    this.container = container;
    this.draw();
  },

  draw() {
    const line = (label, text) => text
      ? '<div style="margin-top:10px;font-size:12.5px;color:var(--t2);line-height:1.7;">'
        + '<span style="color:var(--gold);font-weight:700;">' + esc(label) + '</span> ' + esc(text) + '</div>'
      : '';
    const intro = '<div class="card" style="margin-bottom:14px;">'
      + this.INTRO.map(t => '<div class="pdf-para" style="font-size:12.5px;color:var(--t2);line-height:1.7;margin-bottom:8px;">' + esc(t) + '</div>').join('')
      + '</div>';
    const blocks = this.BLOCKS.map(b =>
      '<div class="card" style="margin-bottom:14px;">'
      + '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">'
      + '<div style="font-size:15px;font-weight:800;color:var(--t1);">' + esc(b.t) + '</div>'
      + (b.tag ? '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t4);">' + esc(b.tag) + '</div>' : '')
      + '</div>'
      + '<div style="margin-top:8px;font-size:12.5px;color:var(--t2);line-height:1.7;">' + esc(b.what) + '</div>'
      + line('Use it if you want:', b.want)
      + line('For it to work:', b.need)
      + '</div>').join('');
    this.container.scrollTop = 0;
    this.container.innerHTML = '<div class="screen">' + intro + blocks + App.helpFooter() + '</div>';
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
  }
};
