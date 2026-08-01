'use strict';

/* ── Revenue Recovery — Help and FAQ ──────────────────────────────────────────
   The in-app knowledge layer for Revenue Recovery. Same underline tab switcher +
   live search as the other section Help pages. Per-screen how-tos live on each
   page's info "i" panel, so this is trimmed to the non-page material: orientation,
   how Revenue reads from Control, and the cross-cutting decisions. */

S.RevenueHelp = {
  tab: 0,
  query: '',

  showHowTo() {
    App.showHelpModal('Revenue Help and FAQ', [
      { p: ['This page is the full Help and FAQ for Revenue Recovery: how to get started, how Revenue reads from your Control systems, and the judgment calls behind the numbers.'] },
      { h: 'Finding An Answer', p: ['Pick a topic along the top, or type a word in the search box to pull every matching question across all topics at once. A search for "RPLH", "audit", or "covers" lands you on the right answer fast.'] },
      { h: 'Directions For A Specific Screen', p: ['Every working screen in Revenue carries its own directions. Open the screen you have a question about, like Confirm the Week or Menu Engineering, and tap this same info i button at the top for the step-by-step. This FAQ covers the why and how it all connects.'] }
    ]);
  },

  SECTIONS: [
    { t: 'Getting Started', qa: [
      { q: 'Where do I start?',
        a: 'For Revenue: enter your menu in Menu Builder, then let Labor and Shift Control feed your hours, covers, and revenue. Revenue Recovery comes alive once your menu is priced and your first weeks of Shift and Labor data have populated the cover counts and revenue totals. The info "i" on any Revenue screen explains how that screen works.' },
      { q: 'What is Revenue Recovery, and how is it different from Profit Recovery?',
        a: 'Profit Recovery is about cost control: pour cost, food cost, theft, vendor pricing, prime cost. Revenue Recovery is about what your team actually collects from every guest. Two operations can run the same food costs and completely different revenues depending on how well their servers sell, how well their menu is priced, and how efficiently labor is scheduled against volume. Revenue Recovery tracks check average by server, RPLH against forecast, and menu contribution margin by item. One question: how much money are you capable of making versus how much you are actually making.' },
      { q: 'Do I need every screen?',
        a: 'No. Start with three and you have most of the value: Menu Builder (your priced catalog), Revenue Forecast (next week\'s revenue and cover goals, projected for you automatically so the schedule has a number to build against), and Server Check (per-server check average tracking). Add Menu Engineering once your item list is built, and the Dog Test Tracker for items you are deciding whether to cut. The Revenue Audit works with whatever data exists.' }
    ]},
    { t: 'Decisions', qa: [
      { q: 'What do Star, Plowhorse, Puzzle and Dog mean?',
        a: 'They are the four boxes Menu Engineering sorts every priced item into, and each one names a different move. Bar Cop measures two things per item against the other items in its own category: contribution margin in dollars, which is menu price minus item cost, and weekly units sold. A Star is at or above the category average on both, so feature it and push it. A Plowhorse sells well on a thin margin, so raise the price. A Puzzle earns well but nobody orders it, so promote it. A Dog is below average on both, so rework it or cut it. Every item is judged inside its own category, never against the whole menu, and a category needs at least four priced items before Bar Cop will rank it at all. Menu Rundown counts the four across the top and prints each item\'s verdict on its tile.' },
      { q: 'How do I price my menu, and what happened to the Price Calculator?',
        a: 'Menu Engineering is now the single pricing engine and the one door that changes a price. The standalone Price Calculator was folded into it, so there is nothing separate to keep in sync. Menu Engineering sorts each item against the other items in its own category (a soda is judged against sodas, not steaks), suggests a price that hits your target cost percent rounded up to a real menu number, and shows the weekly upside. You reprice as a plan first, model the volume you expect to lose, and mark it live when you actually roll it out. The reprice step also shows Weekly Impact, the weekly dollars the new price adds or costs you at the volume you expect after the change, so you see the trade before you commit. Dogs route to the Dog Test instead of a blind price bump.' },
      { q: 'What is Menu Mix?',
        a: 'Menu Mix is one item\'s share of the weekly units sold in the group it is read against, printed as a percent on every Menu Rundown tile. An item at 20% is one of every five things sold in that group. It is a popularity read, not a money read, which is why a high Menu Mix on a thin-margin item is exactly what makes a Plowhorse worth repricing. Every item with a units-sold figure counts toward the group total, costed or not, so an item you have not costed yet still shows its share. Units sold refresh from the product mix report you drop at the Shift weekly close.' },
      { q: 'What happens when I keep or cut a Dog?',
        a: 'A Dog is low margin and low volume in its category. Rather than pull it on a hunch, the Dog Test gives it ninety days in a better slot with a rewritten description and tracks whether volume moves. Keep It leaves the item live and tags it Kept back in Menu Engineering so it stops flagging. Cut It archives the item: it drops off Menu Engineering and your menu list but is not deleted. Archived items sit at the bottom of Menu Builder, where you can restore one back onto the menu or delete it for good.' },
      { q: 'What is Forecast Accuracy, and what do Average Error and Matched Weeks mean?',
        a: 'Forecast Accuracy is the card at the bottom of Revenue Forecast that scores your last twelve forecasts against what actually came in. For every confirmed week it pairs the real revenue, bar plus floor plus any catering, against the forecast that was in effect for that week, and shows the gap in dollars and in percent. Average Error is those percentage gaps averaged with the direction stripped out, so a week 10% over and a week 10% under both count as 10 rather than cancelling each other to zero. Matched Weeks is how many weeks had both a real number and a forecast to compare it against, which is your sample size: three matched weeks is a hint, twelve is a track record. A week with no forecast set, or no revenue confirmed, is skipped rather than scored as a miss.' },
      { q: 'How often can I run an audit?',
        a: 'As often as you want. There is no lock and no countdown. It scores your trailing four weeks, so each run reflects a fresh week of confirmed numbers without whipsawing on one slow or busy day, and Bar Cop keeps one record a day so the history stays clean. The Revenue Audit landing shows a live data badge for what level it would come out at right now. Most operators run it with their weekly close, but that is your call.' },
      { q: 'What is a good RPLH, and how do I set my target?',
        a: 'RPLH is revenue per labor hour: total revenue divided by total labor hours. It is the single cleanest read on labor productivity, because it holds up regardless of headcount. Benchmarks vary by concept; many full-service operators start around $50 to $75 per hour blended. Set your own target in Settings and track it on Confirm the Week and the Revenue dashboard.' },
      { q: 'Why are cost savings and revenue growth never combined into one number?',
        a: 'Because they are different jobs with different levers. Cutting labor cost and lifting check average both add to profit, but blending them into one "recovery" figure hides which one is actually moving and lets a win on one side paper over a loss on the other. Bar Cop keeps cost savings (labor) and revenue growth (check average, menu, servers) separate, and every figure is computed from your real data.' }
    ]},
    { t: 'Connections', qa: [
      { q: 'What flows from Shift Control into Revenue Recovery?',
        a: 'Shift revenue (bar plus floor) feeds Confirm the Week\'s total revenue and RPLH, and the Server Scorecard sales totals. Covers per shift feed the check average math. Log every shift in Shift Control on the day it happened and Confirm the Week sums it for you, so you confirm a week instead of typing it. A per-server sales report dropped at the Shift weekly close fills your Server Check scorecard, and a product-mix report refreshes Menu Engineering units sold, off the same sitting.' },
      { q: 'What flows from Labor Control into Revenue Recovery?',
        a: 'Your staff roster auto-syncs to Server Check, so there is no duplicate server list to maintain. Logged hours feed This Week\'s RPLH and labor cost. Tip pool participant shares feed the Server Scorecard\'s Tips percent column, with the raw Tip Tracking entries as the fallback for shifts without a saved pool.' },
      { q: 'What flows from Inventory Control into Revenue Recovery?',
        a: 'Product prices flow into Menu Builder: a recipe-based cost auto-updates whenever you change a product price in Inventory Control, so menu costs never go stale. Menu Inventory items (Beer, Wine, NA) link directly to an inventory product for their cost, and the Variance Report reads any Pour Size override you set on a Menu Item for multi-size matching.' },
      { q: 'How does a price change get tracked?',
        a: 'Menu Engineering is the one place a menu price changes now. Repricing an item first saves a planned price you can model against volume; Mark Live is the moment it becomes real, sets the price, and logs the change with its date. Editing a price directly on a Menu Item logs it the same way. Pricing is tracked as a logged change, not a recovered-dollar figure, because a raise only pays if volume holds. So the dashboard shows Pricing as a Review row, and the Pricing Review Log at the bottom of Menu Engineering checks the real weekly margin swing against what you predicted once three weeks of covers land. Covers come from your weekly product-mix import.' },
      { q: 'Why do my Revenue numbers not match my POS exactly?',
        a: 'Two common reasons. First, Bar Cop reads net sales (after voids and comps) from Shift Control, while your POS export may show gross. Second, timing: Bar Cop sums shifts by their date, while your POS report may use a different daypart or fiscal cutoff. Log every shift on the day it happened and let Confirm the Week sum from there.' }
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
      + '<input type="text" id="help-search" placeholder="Search Revenue help..." autocomplete="off" value="' + esc(this.query) + '"/></div>';
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
