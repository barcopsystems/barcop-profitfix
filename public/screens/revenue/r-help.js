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
      { h: 'Directions For A Specific Screen', p: ['Every working screen in Revenue carries its own directions. Open the screen you have a question about, like This Week or Menu Engineering, and tap this same info i button at the top for the step-by-step. This FAQ covers the why and how it all connects.'] }
    ]);
  },

  SECTIONS: [
    { t: 'Getting Started', qa: [
      { q: 'Where do I start?',
        a: 'Open Getting Started from the Settings sidebar for the full setup path. For Revenue specifically: enter your menu in Menu Items, then let Labor and Shift Control feed your hours, covers, and revenue. Revenue Recovery comes alive once your menu is priced and your first weeks of Shift and Labor data have populated the cover counts and revenue totals. The info "i" on any Revenue screen explains how that screen works.' },
      { q: 'What is Revenue Recovery, and how is it different from Profit Recovery?',
        a: 'Profit Recovery is about cost control: pour cost, food cost, theft, vendor pricing, prime cost. Revenue Recovery is about what your team actually collects from every guest. Two operations can run the same food costs and completely different revenues depending on how well their servers sell, how well their menu is priced, and how efficiently labor is scheduled against volume. Revenue Recovery tracks check average by server, RPLH against forecast, and menu contribution margin by item. One question: how much money are you capable of making versus how much you are actually making.' },
      { q: 'Do I need every screen?',
        a: 'No. Start with three running every week and you have most of the value: Menu Items (your priced catalog), Revenue Forecast (next week\'s revenue and cover goals so the schedule has a number to build against), and Server Check (per-server check average tracking). Add Menu Engineering once your item list is built, and the Dog Test Tracker for items you are deciding whether to cut. The Revenue Audit works with whatever data exists.' }
    ]},
    { t: 'How It Connects', qa: [
      { q: 'What flows from Shift Control into Revenue Recovery?',
        a: 'Shift revenue (bar plus floor) feeds This Week\'s total revenue and RPLH, and the Server Scorecard sales totals. Covers per shift feed the check average math. Log every shift in Shift Control on the day it happened and Revenue This Week sums it for you, so you confirm a week instead of typing it.' },
      { q: 'What flows from Labor Control into Revenue Recovery?',
        a: 'Your staff roster auto-syncs to Server Check, so there is no duplicate server list to maintain. Logged hours feed This Week\'s RPLH and labor cost. Tip pool participant shares feed the Server Scorecard\'s Tips percent column, with the raw Tip Log as the fallback for shifts without a saved pool.' },
      { q: 'What flows from Inventory Control into Revenue Recovery?',
        a: 'Product prices flow into Menu Items: a recipe-based cost auto-updates whenever you change a product price in Inventory Control, so menu costs never go stale. Menu Inventory items (Beer, Wine, NA) link directly to an inventory product for their cost, and the Variance Report reads any Pour Size override you set on a Menu Item for multi-size matching.' },
      { q: 'How does the Recovery Scoreboard pick up a price change?',
        a: 'Logging a price change in the Price Calculator, or editing a price directly on a Menu Item, auto-writes a fix entry tied to the Pricing area. The Scoreboard then watches check average and revenue for the weeks after the change and surfaces the recovered dollars. There is no separate "mark implemented" step for a change you already logged.' },
      { q: 'Why do my Revenue numbers not match my POS exactly?',
        a: 'Two common reasons. First, Bar Cop reads net sales (after voids and comps) from Shift Control, while your POS export may show gross. Second, timing: Bar Cop sums shifts by their date, while your POS report may use a different daypart or fiscal cutoff. Log every shift on the day it happened and let This Week sum from there.' }
    ]},
    { t: 'Decisions', qa: [
      { q: 'How often can I run an audit, and why 30 days?',
        a: 'One Revenue Audit every 30 days from your last one. The pace gives you time to actually act on a report before scoring yourself again; a number you check daily is just noise. The countdown on the Revenue Audit screen shows the days remaining.' },
      { q: 'What is a good RPLH, and how do I set my target?',
        a: 'RPLH is revenue per labor hour: total revenue divided by total labor hours. It is the single cleanest read on labor productivity, because it holds up regardless of headcount. Benchmarks vary by concept; many full-service operators start around $50 to $75 per hour blended. Set your own target in Settings and track it on This Week and the Revenue dashboard.' },
      { q: 'Why are cost savings and revenue growth never combined into one number?',
        a: 'Because they are different jobs with different levers. Cutting labor cost and lifting check average both add to profit, but blending them into one "recovery" figure hides which one is actually moving and lets a win on one side paper over a loss on the other. Bar Cop keeps cost savings (labor) and revenue growth (check average, menu, servers) separate, and every figure is computed from your real data.' }
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
    this.container.innerHTML = '<div class="screen">' + search + tabs + '<div id="help-body">' + this.bodyHtml() + '</div></div>';
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
