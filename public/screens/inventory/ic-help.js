'use strict';

/* ── Inventory Control — Help and FAQ ─────────────────────────────────────────
   The in-app knowledge layer for Inventory Control. Same underline tab switcher
   + live search used by Labor Help, Shift Help, Cash History, and the reports.
   Per-screen how-tos live on each page's info "i" panel now, so this is trimmed
   to the non-page material: orientation, setup decisions, the count/variance
   model, ordering judgment, and how Inventory feeds Profit Recovery, Accounting,
   and Loss Prevention. Content tracks the current Inventory Control. */

S.InventoryHelp = {
  tab: 0,
  query: '',

  showHowTo() {
    App.showHelpModal('Inventory Help and FAQ', [
      { p: ['This page is the full Help and FAQ for Inventory Control: how to get started, the count and variance model, ordering and par judgment, the operations logs, and how Inventory feeds Profit Recovery, Accounting, and Loss Prevention.'] },
      { h: 'Finding An Answer', p: ['Pick a topic along the top, or type a word in the search box to pull every matching question across all topics at once. A search for "variance" or "par" lands you on the right answer fast.'] },
      { h: 'Directions For A Specific Screen', p: ['Every working screen in Inventory Control carries its own directions. Open the screen you have a question about, like Take Inventory or Receive Delivery, and tap this same info i button at the top to read the step-by-step for that page. This FAQ covers the why and how it all connects; the per-screen i covers the how-to.'] }
    ]);
  },

  SECTIONS: [
    { t: 'Getting Started', qa: [
      { q: 'What does Inventory Control do?',
        a: 'Inventory Control is where the operational reality of your bar and kitchen gets logged: every product you stock, every count, every delivery, every order. It is one of three Control systems (Inventory, Labor, Shift) that capture daily operations. Every Recovery system that needs cost data reads from here, so you set the product and count data once and the rest of Bar Cop stays current without you typing the same numbers twice. The info "i" at the top of any Inventory screen explains exactly how that screen works.' },
      { q: 'Where do I start?',
        a: 'Set up the foundation in order: first your storage locations, then your vendors, then your products (each product gets a vendor, a home location, a size, a unit cost, and a menu price). Open each location and drag its products into the order you actually walk the shelf so counts follow the room instead of the alphabet. Then take your first count and receive your first delivery, and the reports start working. The Getting Started checklist on the Hub sidebar walks the same sequence with a checkbox per task, and each screen carries its own step-by-step directions on the info "i".' },
      { q: 'Does the setup order matter?',
        a: 'Yes. Locations and vendors come before products, because a product picks its vendor and its home location from those lists. Products come before counting, because you cannot count a product that does not exist yet, and a product with no location will not show up in a count until you place it. Take Inventory, the reports, and the Order Sheet all read off that foundation, so a few minutes spent getting locations, vendors, and products right up front saves you from empty counts and orphaned data later.' },
      { q: 'Do I need a full count every week?',
        a: 'For honest pour cost and variance, yes. A full count on the same day every week is what makes the weekly numbers tie out. If a full count is not realistic in week one, count one or two locations and add the rest the following week. A partial count beats no count. What kills your numbers is a skipped week, not a single imperfect count, so build the count into the schedule from day one.' },
      { q: 'Should I enter every product before I start, or begin with the high-volume ones?',
        a: 'Start with high-volume bar product, the items that move daily, and get those counted weekly right away. Add the rest of the bar over the first month, then layer in the kitchen once the bar is stable. A perfect product list that takes three weeks to build delays every report and order that depends on it. An imperfect list that produces a weekly count from day one starts producing real data immediately, and you fill the gaps as they surface.' }
    ]},
    { t: 'Counts and Variance', qa: [
      { q: 'Why count partial bottles instead of eyeballing them?',
        a: 'A back bar with 40 open bottles builds a real error into every calculation when partials are guessed. A bottle the bartender calls "half" might be 0.4 or 0.6, and that 0.2 across 40 bottles is eight bottles of pour cost swinging in or out of variance for reasons that have nothing to do with operations. The bottle slider takes about five seconds per bottle and removes that noise, so the variance you see is real signal, not measurement error.' },
      { q: 'Why does the physical count stay separate from my POS?',
        a: 'Because the gap between the two is the whole point. Your physical count is the truth of what is actually on the shelf. Your POS sales are what was rung in. Variance is the difference, and that difference is where over-pouring, waste, and theft live. That is why Bar Cop never lets you import a POS or perpetual on-hand number into a count: if the count just mirrored what the register thought you had, variance would always read zero and the leak would be invisible. POS sales data is welcome on the expected side (the Variance Report and Spot Check both use it), but the count itself stays an independent physical truth.' },
      { q: 'How does the Variance Report decide what is OK and what gets flagged?',
        a: 'You set the threshold. Under Set Variance Standards you tell Bar Cop how much variance you are willing to live with per category, and anything inside that reads OK while anything past it reads Flag. The verdict is always re-derived from your current standards, so tightening a threshold re-judges every past period and your history reflects the bar you run today, not the settings you had months ago. The same standards drive the Quick Variance Check on the landing too. Known comps and waste are pulled out before the comparison, so only unexplained loss shows. A flag opens a Review investigation right on the spot, working the same record Loss Prevention reads, when the pattern is worth chasing.' },
      { q: 'What is a Spot Check really for?',
        a: 'It reads variance on a single shift without a full inventory: a quick pre-shift and post-shift count on a few high-risk products (well spirits, draft, premium pours) compared against what the POS rang for that shift, scoped to one bar or register. One shift on its own is noise. The value is the pattern: the same product or the same person coming up short again and again. Spot Check results feed Loss Prevention in Profit Recovery, which is where that pattern surfaces.' }
    ]},
    { t: 'Ordering and Receiving', qa: [
      { q: 'What if my par levels are wrong?',
        a: 'They probably are at first, and that is fine. Set initial pars from gut feel, then watch the Order Sheet for four to six weeks. If you keep reordering a product before it shows below par, raise the par. If a product keeps flagging below par but you always have plenty, the par is too high. Pars drift as your menu mix and traffic change, so plan to revisit them every quarter.' },
      { q: 'How does Bar Cop help me get pars right over time?',
        a: 'Dynamic Pars builds a recommendation from your real usage instead of gut feel: average weekly usage over a recent window times your delivery cycle, plus a safety buffer. It pulls the delivery cycle from the vendor when it can, shows each suggestion with the cash it frees up or ties up, and flags each product to Increase, Reduce, or leave alone. You apply the ones you agree with and keep the rest as they are. Run it monthly or quarterly to keep pars honest as the bar changes.' },
      { q: 'What happens when a delivery comes up short or the price moved?',
        a: 'When you receive the delivery, Bar Cop flags any line where the quantity is short of what you ordered or the price has moved off the product master, and a Flag button opens a pre-filled claim right there without leaving the screen. File it and the item lands in Vendor Tracker under Discrepancies as an open credit you can chase, and the price change itself feeds Vendor Tracker, so a vendor quietly creeping prices up shows up before it eats your margin.' }
    ]},
    { t: 'Operations', qa: [
      { q: 'When should I use the Adjustment Log instead of editing a count?',
        a: 'Always the Adjustment Log. Editing a count to "fix" a loss destroys the count history and erases the reason the stock is gone, so the shrinkage just disappears and nobody knows why. The Adjustment Log keeps the count honest and attributes every documented loss to a real cause (Damage, Theft, Expiration, Found, Other). Your bookkeeper, your insurance adjuster, and your future self all benefit when the shrinkage trail has reasons attached.' },
      { q: 'Do transfers and adjustments change my product totals?',
        a: 'A transfer does not. Moving a case from the stockroom to the front bar changes where the product lives, not how much you have, so nothing leaves the building and your totals hold. An adjustment does change the total, because it is a documented loss out of inventory or found stock back in. Both exist for accountability: they give you a record of every bottle that moved or went missing, and they feed Loss Prevention and the clean record your bookkeeper expects.' },
      { q: 'Why bother logging empties?',
        a: 'Two reasons. Some jurisdictions legally require a log of recyclable or redeemable container disposition, and where bottle deposits apply, the Empties Log tallies the deposit value owed back to you across a period. It does not touch your inventory math, it is a compliance and money-recovery record, with a printable take-along sheet so the work happens during the shift and the totals get entered after close.' }
    ]},
    { t: 'Connections', qa: [
      { q: 'What flows from Inventory Control to Profit Recovery?',
        a: 'Several connections, all read-only on the Recovery side and always on. Your products are the master list Profit Recovery reads. Counts feed Profit This Week COGS and the Profit Audit cost sections. Deliveries feed Vendor Tracker and period COGS. Flagged delivery lines feed Vendor Discrepancies. Spot Checks and confirmed-theft adjustments feed Loss Prevention. Below-par counts feed the Hub alerts. Set the inventory data once here and all of it stays current.' },
      { q: 'What feeds Loss Prevention from Inventory?',
        a: 'Three signals. Spot Check variance flags, where physical pours sold do not match what the POS rang. Adjustment Log entries marked Theft within the last 90 days. And variance investigations you open from a flagged line on the Variance Report or a Spot Check, worked right where you flag them. The more honestly those get logged, the sharper Loss Prevention reads, because it is only as good as the data underneath it.' },
      { q: 'What flows from Inventory Control into Accounting?',
        a: 'Every inventory-driven sheet in the bookkeeper handoff. Month-End Books pulls purchases and COGS into the Income Statement, your beginning and ending counts plus deliveries into Inventory Valuation, and the same usage math the Variance Report uses into Variance and Shrinkage. Weekly P&L pulls the same numbers at a weekly grain. None of it is hand-keyed: if your counts and deliveries are current, your books are too.' },
      { q: 'Why do not my used numbers match my POS sales exactly?',
        a: 'They are not supposed to, and the gap is the point. Used product comes from your physical counts; POS sales come from the register. The difference is variance, and a healthy bar still carries a small one. Known comps and waste explain part of it, which is why logging those matters. What is left after comps and waste is the real signal: over-pouring, giveaways, or theft. The job is not to make the two numbers equal, it is to keep the unexplained gap small and watch it over time.' },
      { q: 'Do I have to use Profit Recovery to get value out of Inventory Control?',
        a: 'No. On its own you still get an organized product master, structured weekly counts, delivery and price history, variance reporting, automated reorder sheets, vendor orders emailed straight from Order History, and the full bookkeeper handoff at month-end. The payoff is bigger when Recovery is reading the data, because that is where the dollar-quantified leaks and the Audit live, but Inventory Control earns its keep standalone.' }
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
      + '<input type="text" id="help-search" placeholder="Search Inventory Control help..." autocomplete="off" value="' + esc(this.query) + '"/></div>';
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
