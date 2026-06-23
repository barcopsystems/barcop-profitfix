'use strict';

/* ── Profit Recovery — Help and FAQ ───────────────────────────────────────────
   The in-app knowledge layer for Profit Recovery. Same underline tab switcher +
   live search used by Inventory, Labor, and Shift Help. Per-screen how-tos live
   on each page's info "i" panel now, so this is trimmed to the non-page material:
   orientation, the audit and fix workflow, how recovery is measured, the weekly
   numbers, the loss/cash/vendor diagnosis views, and how Profit Recovery reads
   from the Control systems. Content tracks the current Profit Recovery. */

S.Help = {
  tab: 0,
  query: '',

  showHowTo() {
    App.showHelpModal('Profit Recovery Help and FAQ', [
      { p: ['This page is the full Help and FAQ for Profit Recovery: how to get started, the audit and fix workflow, how recovered dollars are measured, the weekly numbers, the loss, cash, and vendor views, and how Profit Recovery reads from your Control systems.'] },
      { h: 'Finding An Answer', p: ['Pick a topic along the top, or type a word in the search box to pull every matching question across all topics at once. A search for "recovery", "audit", or "prime" lands you on the right answer fast.'] },
      { h: 'Directions For A Specific Screen', p: ['Every working screen in Profit Recovery carries its own directions. Open the screen you have a question about, like This Week or the Profit Audit, and tap this same info i button at the top to read the step-by-step for that page. This FAQ covers the why and how it all connects; the per-screen i covers the how-to.'] }
    ]);
  },

  SECTIONS: [
    { t: 'Getting Started', qa: [
      { q: 'What does Profit Recovery do?',
        a: 'Profit Recovery is where the dollar leaks in your operation get found and fixed. The Profit Audit scores you across pour cost, theft and loss, food cost, vendor control, and prime cost and puts a dollar figure on each gap. Profit Fix walks the process that closes each one. The dashboard tracks what you have recovered and where you are still leaking. All of it reads from the three Control systems (Inventory, Labor, Shift), so you log operations once there and the diagnosis runs on it. The info "i" at the top of any Profit screen explains how that screen works.' },
      { q: 'Where do I start?',
        a: 'Run your first Profit Audit on day one for a baseline. Set your annual sales and your cost targets in App Settings first, so every gap has a real number to measure against. Then open the Profit Forecast to see your profit at your current pace versus your targets, which is the day-one read on what is on the table. After that, take the biggest gap on the dashboard and work its fix, and confirm each week in This Week as it closes. The recovery numbers build from there.' },
      { q: 'Do I need every screen?',
        a: 'No. The value comes from a few things: your Control data feeding the cost numbers, a Profit Audit for the baseline, and confirming each week in This Week. Recipe Summary, Vendor Tracker, Loss Prevention, and Over and Short are read-only diagnosis views that come alive as Control data builds. You do not enter data in them; they read what you already logged in Control.' },
      { q: 'What can I get on day one, before I have weeks of data?',
        a: 'The Profit Audit runs day one off whatever you upload (a P&L, a POS export) plus any Control data you already have, and the Profit Forecast projects your profit forward from your first confirmed weeks. The realized recovery number on the dashboard needs about thirty days of logged weeks before it turns on, because it measures your real before and after. Until then the dashboard teaches the loop and shows your audit opportunity.' }
    ]},
    { t: 'Audit and Fix', qa: [
      { q: 'How does the Profit Audit work?',
        a: 'You give it your annual sales, optionally upload reports it cannot see yet (a P&L covers bar, food, and prime in one file), and answer a few questions about how you operate. Bar Cop scores five sections from your Control data plus those uploads and ranks the gaps by monthly dollar impact. The more you give it, the more it covers. You can run one every thirty days, which is enough time to act on the last one before scoring yourself again.' },
      { q: 'Why did a section come back N/A?',
        a: 'Because there was nothing to grade it on honestly. A cost section needs a cost percentage, and theft and loss needs real void, comp, or cash data or a documented control. With nothing there, Bar Cop leaves the section out rather than inventing a score. It fills in as you log more or upload a report that covers it.' },
      { q: 'What is the Bar Cop Outlook?',
        a: 'A short operator-voice read on your latest audit, written from your own numbers. It tells you what the score says and the one or two things to do this month, in plain language. It is cached per audit, so re-opening the same audit does not regenerate it.' },
      { q: 'How does Profit Fix close a gap?',
        a: 'Each gap has a fix process, an ordered set of steps that link straight to the Bar Cop screen that does the work. Bar Cop reads your progress from your real Control data, not from checkboxes you tick, so a step reads done only when the work actually shows up: a count logged, a recipe costed, a comp threshold set. The fix starts measuring on its own the first time you take a tracked action. There is no button to mark it implemented.' },
      { q: 'What does Watch Out For show?',
        a: 'The handful of things that quietly break that gap\'s numbers and that Bar Cop cannot catch for you. Read them before you walk the process. They are short on purpose; it is not a management seminar.' }
    ]},
    { t: 'Measuring Recovery', qa: [
      { q: 'How does Bar Cop measure what I recovered?',
        a: 'From your own weekly numbers. It takes your first few weeks as your baseline, measures every later week against it, and the improvement times your revenue is the recovered dollars. It is realized to date, not a projection, and it reads honestly: if a number has slipped below where you started, it says so. A figure shows once a couple of weeks of after-data exist and firms up from there.' },
      { q: 'Why does the Recovery Scoreboard show nothing at first?',
        a: 'Because there is no honest before and after yet. A real recovery number needs about thirty days of logged weeks. Until then the Scoreboard teaches the loop, run the audit, pick a gap, work the fix, and the dashboard shows your audit opportunity, which is what is on the table and never counted as money already won.' },
      { q: 'Why do some gaps show a dollar figure and others do not?',
        a: 'Pour cost and food cost have a weekly cost percentage Bar Cop can measure, so they carry a live dollar a year at your current pace. Theft and loss and vendor control do not reduce to a clean weekly metric, so they read as a Review row you tap to work on their own screen rather than a fake dollar. Labor is part of prime cost, but its fix lives in Revenue Recovery, so it is worked there, not on the Profit dashboard.' },
      { q: 'Opportunity versus recovered, what is the difference?',
        a: 'Opportunity is what is on the table, from your audit and your forecast, a forward number. Recovered is what you have actually won back, measured from your logged weeks looking backward. Bar Cop never shows opportunity as money already in the register.' }
    ]},
    { t: 'The Weekly Numbers', qa: [
      { q: 'What is This Week for?',
        a: 'It is the weekly confirm. Bar Cop pulls the week in from Control: revenue from Shift, COGS from Inventory, labor from Labor. You read the money picture, confirm the grid, and save. You almost never type a raw number, you confirm one. Load From Control re-runs the math if a shift or count landed after you opened the week, and asks before overwriting anything you edited by hand.' },
      { q: 'What is prime cost and why is it the headline?',
        a: 'Prime cost is COGS plus labor as a percentage of sales, the two costs you control day to day. It is the single number that tells you whether the operation is healthy, so it leads This Week and the dashboard. The labor in prime cost is your hourly floor labor; salaried management is a fixed cost that lands in Books, not here.' },
      { q: 'What does the Profit Forecast do?',
        a: 'It projects your profit forward from the weeks you have already confirmed, two ways side by side: at your current pace, and at your cost targets. The gap between them is what tightening up is worth, and it points straight at Profit Fix. Every figure is a projection built from your own averages, an estimate to plan against, not a guarantee.' },
      { q: 'How does variance work?',
        a: 'Variance is the gap between what your inventory says you poured and what your POS says you sold. A positive variance means more product left the shelf than was rung in. The usual causes are over-pouring, unrung drinks, or product walking out. Inventory Control\'s Variance Report ranks products by variance dollars so you know where to start; Spot Check is the per-shift version.' }
    ]},
    { t: 'Loss, Cash, and Vendors', qa: [
      { q: 'What does Loss Prevention show?',
        a: 'A live read of the last seven days of loss signals: drawer shorts, flagged spot checks, and any confirmed theft. There is no score here. It is a working list of what flagged and what each item costs, so you act on the pattern instead of a number. Severe flags also push to the Hub so they find you. Per-server sales-pattern theft (no-sales, voids, comps, cash mix) has its own deeper screen, Sales Integrity.' },
      { q: 'What is Sales Integrity?',
        a: 'The deep theft read. You drop a per-server sales report from your POS and Bar Cop benchmarks every server against the floor, then flags the ones whose numbers do not add up (no-sale drawer opens, void abuse, abnormal cash mix, low average check, comps, refunds) with a dollar exposure on each. It catches the register and cash games that show in the sales data; product theft like overpouring and bottle loss never reaches a sales report and is caught by pour cost, inventory variance, and spot checks instead. A flag opens a Loss Prevention investigation. It is patterns to investigate, not a verdict.' },
      { q: 'What is a Variance Investigation?',
        a: 'When a product shows unexplained variance, you open an investigation and work the steps in order. Because it is tied to a real product, Bar Cop shows the live usage from your last two counts and the recent spot checks for that product right on the steps, so you compare against the POS instead of retyping numbers. A flagged spot check or variance line opens one pre-filled.' },
      { q: 'What is Over and Short?',
        a: 'The cash diagnosis: who and what is repeatedly off. It rolls up your drawer counts by cashier and by register, so a bartender who comes up short most shifts surfaces instead of you scrolling a chronological list. A cashier or register only gets ranked once there are enough counts to read a real pattern. Shift Cash History is the log of when; this is the read on who and what to act on.' },
      { q: 'What does Vendor Tracker do?',
        a: 'One screen with three tabs. Scorecard is the per-vendor read: spend, price drift, short counts, open and recovered credits. Price Changes is every delivery line where the price moved, annualized to a real dollar using your usage. Discrepancies is the credits you can still chase. It is fed automatically from Inventory Control deliveries. You file a discrepancy at the dock in Receive Delivery and work the claim here.' },
      { q: 'What is Recipe Summary?',
        a: 'A read-only diagnostic that ranks every menu item with a recipe by its cost percentage against target, worst first. Ingredient costs flow from your live Inventory Control prices, so when a vendor price moves the recipe cost updates on its own. You edit a recipe on Menu Items in Revenue Recovery; this screen is the read.' }
    ]},
    { t: 'Connections', qa: [
      { q: 'What flows from Inventory Control into Profit Recovery?',
        a: 'Your counts feed This Week COGS and the Profit Audit cost sections. Deliveries feed Vendor Tracker price changes and period COGS. Flagged delivery lines feed Vendor Tracker discrepancies. Spot checks and confirmed-theft adjustments feed Loss Prevention. All of it is read-only on the Recovery side and always on, so you set the data once in Inventory and it stays current here.' },
      { q: 'What flows from Shift Control into Profit Recovery?',
        a: 'Shift revenue is This Week\'s total revenue, the single source. Cash drops and drawer counts feed Over and Short and the audit\'s cash section. Loss-bearing voids and comps feed Loss Prevention and the audit\'s exception read. Staff meal and shift drink are policy expense, not loss, so they do not inflate anything.' },
      { q: 'What flows from Labor Control into Profit Recovery?',
        a: 'Your logged hours are This Week\'s labor line and half of prime cost; Inventory counts are the other half. Bar Cop counts hourly floor labor in prime cost and leaves salaried management to Books as a fixed cost, so the prime number reflects the labor you flex day to day.' },
      { q: 'Why do my Profit numbers not match my POS exactly?',
        a: 'Two usual reasons. Bar Cop reads net sales, after voids and comps, from Shift Control, while your POS export may show gross. And timing: Bar Cop sums shifts by the day they happened, while your POS report may use a different daypart or fiscal cutoff. Log every shift on the day it happened and confirm the week here, and the two line up.' }
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
      + '<input type="text" id="help-search" placeholder="Search Profit Recovery help..." autocomplete="off" value="' + esc(this.query) + '"/></div>';
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
