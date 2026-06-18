'use strict';

/* ── Traffic Recovery — Help and FAQ ──────────────────────────────────────────
   The in-app knowledge layer for Traffic Recovery. Same underline tab switcher +
   live search as the other section Help pages. Per-screen how-tos live on each
   page's info "i" panel, so this is trimmed to the non-page material: orientation,
   how the online funnel feeds Revenue and Profit, and the cross-cutting decisions. */

S.TrafficHelp = {
  tab: 0,
  query: '',

  showHowTo() {
    App.showHelpModal('Traffic Help and FAQ', [
      { p: ['This page is the full Help and FAQ for Traffic Recovery: how to get started, how the online funnel feeds Revenue and Profit, and the judgment calls behind the numbers.'] },
      { h: 'Finding An Answer', p: ['Pick a topic along the top, or type a word in the search box to pull every matching question across all topics at once. A search for "reviews", "audit", or "sessions" lands you on the right answer fast.'] },
      { h: 'Directions For A Specific Screen', p: ['Every working screen in Traffic carries its own directions. Open the screen you have a question about, like Online Presence or This Week, and tap this same info i button at the top for the step-by-step. This FAQ covers the why and how it all connects.'] }
    ]);
  },

  SECTIONS: [
    { t: 'Getting Started', qa: [
      { q: 'What does Traffic Recovery do?',
        a: 'Traffic is your online channel: the website, digital menu, online reservations and orders, and the Google Business, search, and reviews presence that gets people there. Profit Recovery works your costs and Revenue Recovery works what your team collects from the guests in the room. Traffic works the step before that, whether enough people find you online, pick you, and come back. Tight costs and a sharp service team still leave money on the table when the top of the funnel is dry. The info "i" on any Traffic screen explains how that screen works.' },
      { q: 'Where do I start?',
        a: 'Open Online Presence. It puts every area (Google Business, website, reviews, search, social, delivery, email) on one page with your live number against the target and the one next move for each. Run the Traffic Audit on day one for a scored baseline. Then log This Week so your ratings, reviews, sessions, and orders start building a trend. Fix the weakest area first, the one Online Presence flags.' },
      { q: 'Do I need every area?',
        a: 'No. Google Business, reviews, and your website carry most of the weight for a bar or restaurant. Get those three right and you have covered most of what a new guest sees before they decide. Add social, delivery, and email as you have time. Online Presence shows which area is costing you the most right now, so you always know what to work next.' }
    ]},
    { t: 'How It Works', qa: [
      { q: 'How does the online funnel work?',
        a: 'Three stages. Get found: Google Business, search and SEO, and reviews decide whether you show up when someone looks for a bar near them. Convert the visit: the website, digital menu, online reservations, and online ordering decide whether a visitor becomes a booking or an order. Keep them: social and email bring past guests back. The outcomes at the end are sessions, reservations, and orders, and those turn into revenue. Traffic Recovery works each stage so the volume feeds Revenue and Profit.' },
      { q: 'Why is Traffic standalone with no Control system?',
        a: 'Inventory, Labor, and Shift capture what happens inside the four walls, and they feed Profit and Revenue. Traffic data lives outside the walls: on Google, in your website analytics, on the delivery platforms, in your email tool. There is no in-house log to feed it. So Traffic captures and diagnoses in one place. The weekly numbers that feel like Control (rating, reviews, sessions, orders) live in This Week.' },
      { q: 'What is the weekly work on Traffic?',
        a: 'Once a week, open This Week and confirm the numbers that moved: Google rating and new reviews, response rate, sessions, posts, orders, email. It prefills from last week, so you update what changed instead of retyping a blank form. That weekly entry is what builds the trend and feeds the Recovery Scoreboard. Five minutes on a Monday keeps the whole section honest.' }
    ]},
    { t: 'How It Connects', qa: [
      { q: 'What does Traffic feed into the rest of Bar Cop?',
        a: 'Traffic is demand generation, so its job is to push volume into the systems that turn volume into money. More reservations and orders show up as covers and sales in Revenue and Profit. Where a gap has a clean dollar read (website conversion, email, delivery), the recovery engine puts a dollar figure on it so you can see what closing it is worth. The connection runs one way: Traffic builds the demand, Revenue and Profit work it once it is in the room.' },
      { q: 'How does the Recovery Scoreboard handle Traffic?',
        a: 'Honestly, which means not every Traffic fix gets a dollar sign. Some areas dollarize cleanly: website conversion, email, delivery volume. Others move the underlying score without a clean dollar figure: review velocity, Google Business completeness. When a fix has a dollar metric, the Scoreboard shows recovered dollars once the window matures. When it does not, it shows the score movement. Bar Cop never invents a dollar number to fill the gap.' },
      { q: 'Where do my targets and platform links live?',
        a: 'In Settings. Traffic Targets holds your goals: Google rating, new reviews per month, response rate, monthly sessions, and posts per month, with Bar Cop benchmarks prefilled to adjust. Operation Links holds your website, Google, Yelp, social, delivery, reservation, and email URLs. Those links power the Live Links strip on the dashboard and let the Audit pull your public numbers.' }
    ]},
    { t: 'Decisions', qa: [
      { q: 'When do I run my first audit, and why the 30-day pace?',
        a: 'Day one, before you change anything, so you have a baseline score. After that, one audit every 30 days. The pace gives you time to work the prior report before you score yourself again; a number you check daily is just noise. The gap between two audits is the most useful number here, it shows what 30 days of work moved. The countdown on the Traffic Audit screen shows the days left.' },
      { q: 'What if I do not have every number each week?',
        a: 'Log what you have. Google rating and new reviews take two minutes from the Google Business dashboard. Sessions need analytics access, follower counts are on your profile in seconds. Enter what you can and leave the rest blank. Partial numbers entered every week beat a complete set entered once a quarter. Do not skip the week because the data is not all there.' },
      { q: 'Why does Bar Cop give ranges instead of a promise?',
        a: 'Because no one can promise what a search ranking or a menu change will return. What Bar Cop can do is show what the opportunity is worth at your own numbers: your sessions, your check average, your order value. Those are estimates and ranges, marked as estimates, never a guarantee. An honest range you can plan against beats a confident number that turns out wrong.' }
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
      + '<input type="text" id="help-search" placeholder="Search Traffic help..." autocomplete="off" value="' + esc(this.query) + '"/></div>';
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
