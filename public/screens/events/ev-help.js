'use strict';

/* ── Events — Help and FAQ ────────────────────────────────────────────────────
   The in-app knowledge layer for the Events section. Same underline tab switcher
   + live search as Inventory/Labor/Shift/Recovery Help. Per-screen how-tos live
   on each page's info "i" panel, so this is trimmed to the non-page material:
   orientation, the booking lifecycle, the calendar and regulars model, and how
   Events feeds the rest of Bar Cop. */

S.EventsHelp = {
  tab: 0,
  query: '',

  showHowTo() {
    App.showHelpModal('Events Help and FAQ', [
      { p: ['This page is the full Help and FAQ for Events: how to get started, the booking lifecycle, quotes and deposits, the run sheet and agreement, the calendar and regulars, and how Events feeds This Week, the audits, Books, your Cash Forecast, and Labor scheduling.'] },
      { h: 'Finding An Answer', p: ['Pick a topic along the top, or type a word in the search box to pull every matching question across all topics at once. A search for "deposit", "quote", or "regular" lands you on the right answer fast.'] },
      { h: 'Directions For A Specific Screen', p: ['Every working screen in Events carries its own directions. Open the screen you have a question about, like Event Booking or the Event Calendar, and tap this same info i button at the top for the step-by-step. This FAQ covers the why and how it all connects.'] }
    ]);
  },

  SECTIONS: [
    { t: 'Getting Started', qa: [
      { q: 'What does the Events section do?',
        a: 'Events is where you run the demand side of the business: parties, buyouts, catering, your regulars, and the dates you plan around. A booking is worked from the first phone call to the paid invoice, with its own profit and loss. It is a feeder, like the Control sections, so the revenue and labor from your events flow into This Week, the audits, Books, and your Cash Forecast without you typing the numbers twice. The info "i" on any Events screen explains how that screen works.' },
      { q: 'What does the Events landing show me?',
        a: 'Your events at a glance. Where You Stand up top is the revenue you have booked, your open pipeline, the deposits you are owed, and your win rate. Below it, Book Out Your Events is the running work that keeps the pipeline moving: work your open leads, collect the deposits due, prep the run sheets for events in the next two weeks, and close out the P&L on completed events. Each step stays open until you do the work and mark it done, your own checkmark; it reopens on its own when something new lands in it, a new lead, a deposit due, or an event to prep or close, so the cockpit never goes stale. The Get Started box and the steps both show before you have any data, so it is clear from the first visit how it works.' },
      { q: 'Where do I start?',
        a: 'Log your first booking when a lead comes in, even if all you have is a name and a date. Build a couple of packages on Price Packages so your quotes prefill. Add your regulars so birthday and anniversary outreach has a home. Then use the Event Calendar to see what is coming. None of it has to be perfect on day one; the value builds as you log.' },
      { q: 'Do I need every screen?',
        a: 'No. Event Booking is the heart of it. The Event Calendar, Track Regulars, and Price Packages make bookings easier and catch the money around them, but you can run the section on Event Booking alone and add the rest as you go.' }
    ]},
    { t: 'Bookings', qa: [
      { q: 'How does a booking move through the stages?',
        a: 'Lead is a fresh inquiry. Quote Sent means you priced it and sent it. Booked means they confirmed. Completed means the event ran. Lost stays in the pipeline so your conversion rate stays honest. You move a booking with the buttons at the bottom of its page, and the stage drives what the page asks you for next.' },
      { q: 'How is a quote priced?',
        a: 'Pick a Rate Card package to prefill the price, or open the Catering Calculator to price per head against a target food cost. Bar Cop builds the quote underneath: the food and beverage subtotal (per head times guests, or your F&B minimum, whichever is higher), then your service charge and your tax on top, to one quoted total. Set the service charge and tax once on the booking; the breakdown shows on the booking, the emailed quote, and the Quote PDF, so the number you send matches the invoice.' },
      { q: 'How do deposits and balances work?',
        a: 'Once a booking is Booked, log the deposit you took and mark it paid. The balance is the quoted total minus the deposit, due on the event date. Deposits still owed roll up on the pipeline and the dashboard, and the balances on your booked events show as money coming in on your Cash Forecast, by event date, so your cash plan stays real.' },
      { q: 'What is the Run Sheet?',
        a: 'The Run Sheet is what the kitchen and floor work the event off: the timeline, the food and bar, allergies and dietary, the room setup, AV and rentals, the guaranteed headcount and when the final count is due, and who runs point on site. Open it from a booking, fill it in once the event is booked, and Print Run Sheet hands the team a clean copy.' },
      { q: 'What is the Event Agreement?',
        a: 'The Agreement turns a booking into a one-page agreement for the customer to sign: the event details, the money, your terms, and signature lines for both of you. The terms start from a template you edit once to your own policy, and Bar Cop remembers them for the next event. It prints branded as your venue, not as Bar Cop. It is a worksheet, not a substitute for a contract your attorney has reviewed; that reminder shows while you set it up, not on the customer copy.' },
      { q: 'Where does the event revenue and P&L come from?',
        a: 'On a Completed booking, enter the actual revenue and the food, bar, and other cost. Labor pulls automatically from the staff you check as working the event in Build Schedule, so only their hours hit the Event P&L, not the whole day\'s crew. The margin is the event\'s bottom line.' }
    ]},
    { t: 'Calendar and Planning', qa: [
      { q: 'What is on the Calendar?',
        a: 'One month grid with your booked events, which appear automatically on their event date, and the holidays and local dates you add to plan around. The big holidays show up on their own every year. It is the screen you open once a month to see what is coming before it is too late to prepare for it.' },
      { q: 'What if two events land on the same day?',
        a: 'If two events are booked into the same space on the same day, Bar Cop flags both, on the calendar and on each booking, so you catch a double-booking before it bites you. It only flags when both events name the same space, so a venue running two events in different rooms is left alone.' },
      { q: 'What is the planning checklist?',
        a: 'Each date you add carries a four-step checklist: menu locked, promo created, staffing scheduled, reservations open. The calendar shows how ready you are at a glance, like 2 of 4, so a big date never sneaks up on you half-planned.' }
    ]},
    { t: 'Regulars', qa: [
      { q: 'What is the Regulars book for?',
        a: 'Your guests by name, by drink, by date. Log a regular\'s contact, birthday, anniversary, drink preferences, and last visit, and mark your VIPs. The screen surfaces who has a birthday or anniversary this month and who has gone quiet, so you have a monthly reach-out list and a win-back list. Open any regular in the list to edit them.' },
      { q: 'Can I import a list?',
        a: 'Yes. Switch the add card to Import File and drop a CSV or Excel file. Only Name is required; phone, email, birthday, anniversary, drink preferences, and last visit come in if your file has them. Map the columns once and Bar Cop remembers it. Then Bar Cop lists every row in the file and what will happen to it, so nothing is saved until you press Add on that screen.' }
    ]},
    { t: 'Connections', qa: [
      { q: 'What does Events feed into the rest of Bar Cop?',
        a: 'Offsite catering revenue rolls into This Week as catering, which carries through to the Revenue and Profit audits and to Books and the Annual Review. Your booked event balances show as money coming in on the Cash Forecast, and the staff you check as working an event feed their labor into its Event P&L. A booked event also raises that week\'s Revenue Forecast, so Build Schedule budgets labor for the extra business. So the work you do here keeps the weekly numbers, the books, the cash plan, and the schedule current.' },
      { q: 'How does staffing an event work?',
        a: 'There is no separate event scheduler. From a booking, Schedule Staff for this Event jumps to Build Schedule on the event date, and you check the "Working [event]" box on each person working it. Only those hours land on the Event P&L. Catering and offsite gigs use the Event shift so an odd-time job fits the schedule.' },
      { q: 'Why is Events its own section instead of part of Revenue?',
        a: 'Because it is one job. The lead, the booking, the deposit, the event, and the guest relationship all belong together, and they were scattered across other sections before. Pulling them into one place means the lead becomes the booking with no re-entry, and it keeps Revenue focused on what it does best.' }
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
      + '<input type="text" id="help-search" placeholder="Search Events help..." autocomplete="off" value="' + esc(this.query) + '"/></div>';
    const tabs = '<div class="ch-tabs no-print">'
      + this.SECTIONS.map((s, i) => '<button class="ch-tab' + (this.tab === i ? ' on' : '') + '" data-tab="' + i + '">' + esc(s.t) + '</button>').join('')
      + '</div>';
    this.container.innerHTML = '<div class="screen">' + search + tabs + '<div id="help-body">' + this.bodyHtml() + '</div>' + App.helpFooter() + '</div>';
    this.wire();
  },

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
      if (tab) { this.tab = parseInt(tab.dataset.tab, 10) || 0; this.query = ''; this.draw(); }
    };
    const search = document.getElementById('help-search');
    if (search) search.addEventListener('input', e => {
      this.query = e.target.value || '';
      const body = document.getElementById('help-body');
      if (body) body.innerHTML = this.bodyHtml();
    });
  }
};
