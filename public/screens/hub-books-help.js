'use strict';

/* ── Books — Help and FAQ ─────────────────────────────────────────────────────
   The Books section's knowledge layer, same underline tab switcher + live search
   as the Control / Recovery / Events help pages. Per-page how-tos live on each
   page's info "i" panel; this covers the why: what the accounting deliverables
   are, how Operations tracking works, and the legal posture. Hub-shell screen,
   opens with the Books sidebar. */

S.HubBooksHelp = {
  tab: 0,
  query: '',

  open() {
    App.openHubFullPage('Books Help', (mount) => {
      this.container = mount; this.tab = 0; this.query = ''; this.draw();
    }, 'books-help');
  },

  SECTIONS: [
    { t: 'Getting Started', qa: [
      { q: 'What is the Books section?',
        a: 'Your back office. The Accounting pages turn what you already log in Bar Cop into the files your accountant or bookkeeper needs: a Weekly P&L Brief, the Month-End Books file, and an Annual Review. The Operations pages track the things that keep the doors open: permits, licenses, and operating expenses. Nothing here asks you to re-enter numbers you have already logged.' },
      { q: 'What is on the overview?',
        a: 'The current month rolled up from your weekly records (revenue, prime cost, gross profit), your year-to-date bottom line, recent months, anything coming due, and a link to every Books page through the Quick Actions. The figures are built from the same data as the Month-End Books file, so they agree.' },
      { q: 'Is this a substitute for an accountant?',
        a: 'No. Bar Cop is a software tool, not a CPA or tax preparer. Everything here is built to hand to your accountant, who should review and verify it before you file anything or close your books. The outputs are worksheets, not filed statements.' }
    ]},
    { t: 'Accounting', qa: [
      { q: 'What is in the Month-End Books file?',
        a: 'One workbook your accountant can work straight from: an income statement (month and year to date), inventory valuation, a cash reconciliation trail, a void and comp log, a tip allocation worksheet for IRS Form 8027, variance and shrinkage, and labor cost analysis, plus your audit opportunities turned into dollars. A December close also adds a year-end tax helper. A one-page owner summary PDF comes alongside it.' },
      { q: 'What is the Weekly P&L Brief?',
        a: 'Your weekly revenue, COGS, and labor as an Excel file you can hand to a bookkeeper or open in QuickBooks, Xero, or any spreadsheet. Pick a range (last week, last four, the quarter, year to date, or custom) and download. It is the lighter, more frequent companion to the Month-End Books file.' },
      { q: 'What is the Annual Review?',
        a: 'The annual roll-up: the full year in one place for tax season, plus the current year so far for a read on how things are going. Like everything in Books, it is built from what you logged and meant for your accountant to verify.' }
    ]},
    { t: 'Operations', qa: [
      { q: 'How do Permits and Licenses work?',
        a: 'Enter each permit or license with its next renewal date and Bar Cop tracks it, flagging it as the date nears: due soon within 30 days, more urgent within 14, and expired once it passes. Anything due soon or expired shows under Needs Attention here and under Coming Due on the overview, so a lapse never sneaks up on you. When you renew one, click Mark Renewed to advance the date and log the cost to Operating Expenses under Licenses and Permits in one step. Bar Cop tracks the dates you enter; it does not verify a permit is valid with any agency, and it is not legal advice.' },
      { q: 'What goes in Operating Expenses?',
        a: 'The bills that are not COGS or hourly labor: rent, utilities, insurance, marketing, professional fees, software, and the rest, by category. Logging them is what lets the Month-End income statement show a real operating income instead of stopping at prime cost. Check Recurring on a fixed bill and set a term in months and Bar Cop logs it automatically each month through the term; for bills that change, like utilities, use Duplicate to copy last month forward and set the new amount. You can also switch the form to Import File and drop a CSV or Excel export. Do not enter repairs and maintenance or 3rd-party platform fees here; those are tracked in Shift Control and the weekly P&L so Books does not count them twice.' }
    ]},
    { t: 'Connections', qa: [
      { q: 'Where do the numbers come from?',
        a: 'Revenue from Shift Control, COGS from your Inventory counts, labor from Labor Control, comps from the void and comp log, plus the operating expenses and permit costs you enter here. Books is aggregation and formatting, not a second place to capture data.' },
      { q: 'Why does the count-based COGS not match the income statement?',
        a: 'They are two honest views. The income statement sums your weekly numbers; the inventory valuation does the Schedule C math (beginning plus purchases minus ending count). The count-based figure is the more accurate physical cost of goods. Give your accountant both; the Month-End file includes them side by side.' }
    ]}
  ],

  draw() {
    const search = '<div class="f" style="max-width:420px;margin-bottom:8px;">'
      + '<input type="text" id="help-search" placeholder="Search Books help..." autocomplete="off" value="' + esc(this.query) + '"/></div>';
    const tabs = '<div class="ch-tabs no-print">'
      + this.SECTIONS.map((s, i) => '<button class="ch-tab' + (this.tab === i ? ' on' : '') + '" data-tab="' + i + '">' + esc(s.t) + '</button>').join('')
      + '</div>';
    this.container.innerHTML = '<div class="screen">' + search + tabs + '<div id="help-body">' + this.bodyHtml() + '</div></div>';
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
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
