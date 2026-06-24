'use strict';

/* ── Cash Recovery — Help and FAQ ─────────────────────────────────────────────
   The knowledge layer for Cash Recovery. Same tab switcher + live search the
   other Help pages use. Per-screen how-tos live on each page's info "i" panel,
   so this covers the why and how it connects: what cash recovery is, the two
   halves (trapped cash + cash timing), and how it reads off Control and Books
   without keeping the books itself. */

S.CashHelp = {
  tab: 0,
  query: '',

  showHowTo() {
    App.showHelpModal('Cash Help and FAQ', [
      { p: ['This page is the full Help and FAQ for Cash Recovery: what it is, the two halves (cash trapped on your shelves and the timing of cash in versus out), and how it reads off your Control data and your bills without you entering anything twice.'] },
      { h: 'Finding An Answer', p: ['Pick a topic along the top, or type a word in the search box to pull every matching question at once.'] },
      { h: 'Directions For A Specific Screen', p: ['Every working screen in Cash Recovery carries its own directions on the info i button at the top. Open the screen you have a question about and tap it. This FAQ covers the why and how it connects.'] }
    ]);
  },

  SECTIONS: [
    { t: 'Getting Started', qa: [
      { q: 'What is Cash Recovery?',
        a: 'Cash Recovery is the third lever Bar Cop watches alongside Profit and Revenue. Profit is your margin, the cost of every pour and plate. Revenue is your top line, what you ring. Cash is your liquidity, the money actually in your account. The three are different jobs: a bottle of premium scotch can have a perfect margin and still be a cash problem if it sits on the shelf for six months tying up money you could use elsewhere. Plenty of bars are profitable on paper and still run tight, and Cash Recovery is where you catch it.' },
      { q: 'What are the two halves?',
        a: 'Trapped cash and cash timing. Trapped cash is working capital stuck on the shelf, dead stock that does not move and overstock you ordered past what you use. Cash timing is the flow week to week, the bills, buys, and labor going out against the sales coming in, so you spot a tight day before it bites. The cockpit covers both: the scoreboard up top is your trapped cash, and the steps walk the weekly money routine.' },
      { q: 'Do I have to enter anything new?',
        a: 'Almost nothing. Cash Recovery reads off data you already keep: your inventory counts, your orders and deliveries, your bills in Books, your schedule. The one thing worth setting is payment terms on each vendor (net 7, 15, 30) so Bar Cop can flag bills you are paying faster than you have to. Everything else is computed.' }
    ]},
    { t: 'Trapped Cash', qa: [
      { q: 'How does Bar Cop decide what is trapped?',
        a: 'Two ways, off your counts. Dead stock is product on the shelf that did not move at all between your last two counts, its full value is cash sitting still. Overstock is product you are holding well above its par, the cash tied up in the extra is money you did not need to spend yet. Bar Cop counts each product once so nothing double counts, and ranks them by the dollars you can free.' },
      { q: 'What do I actually do about it?',
        a: 'Run the dogs down. Feature a dead bottle, put it on a special, work it into a cocktail, or eighty-six it and stop reordering. For overstock, cut the par so you stop buying ahead of what you use. The Free Up Cash step launches you straight into the dead stock list and Dynamic Pars where that work happens.' }
    ]},
    { t: 'Cash Flow', qa: [
      { q: 'How does the week-ahead read work?',
        a: 'Bar Cop lines up what is going out against what is coming in. Out is your bills due, the cash to reorder to par, and your scheduled labor. In is your projected sales. When a heavy day of cash out lands before the sales come in, that is a tight day, and seeing it on Sunday beats finding it on Friday when the delivery truck wants a check.' },
      { q: 'What is paying on terms about?',
        a: 'If a vendor gives you net 30, paying on day 5 hands them your cash three weeks early for nothing. Hold it to the due date and that money stays in your account working for you. The flip side is an early-pay discount: if a vendor knocks two percent off for paying in ten days, that usually beats what the cash is worth sitting idle, so take it. Bar Cop flags both once your vendor terms are set.' }
    ]},
    { t: 'Connections', qa: [
      { q: 'How is Cash different from Books?',
        a: 'Books is your ledger, it records what happened: the bills, the P&L, the bank reconciliation, accurate and backward looking. Cash Recovery is the forward action layer: it reads your bills and your inventory to tell you what to do next about liquidity, free this trapped cash, hold that payment, watch this tight day. It reads Books, it does not keep the books. Same relationship Profit Recovery already has with your numbers.' },
      { q: 'What feeds Cash Recovery from the rest of Bar Cop?',
        a: 'Your inventory counts and unit costs drive trapped cash and weeks on hand. Your orders and deliveries drive the purchasing read. Your bills in Books and your vendor payment terms drive the week-ahead and pay-on-terms. Your schedule and revenue forecast drive the cash timing. Set the data once in Control and Books and Cash Recovery stays current on its own.' }
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
      + '<input type="text" id="help-search" placeholder="Search Cash Recovery help..." autocomplete="off" value="' + esc(this.query) + '"/></div>';
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
