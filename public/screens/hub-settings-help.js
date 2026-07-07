'use strict';

/* ── Settings — Help and FAQ ──────────────────────────────────────────────────
   The Settings section's knowledge layer, same underline tab switcher + live
   search as the Control / Recovery / Events help pages. Per-page how-tos live on
   each page's info "i" panel; this covers the why: what each settings area does
   and how the account and team work. Hub-shell screen, opens with the Settings
   sidebar. */

S.HubSettingsHelp = {
  tab: 0,
  query: '',

  open() {
    App.openHubFullPage('Settings Help', (mount) => {
      this.container = mount; this.tab = 0; this.query = ''; this.draw();
    }, 'settings-help');
  },

  SECTIONS: [
    { t: 'Getting Started', qa: [
      { q: 'What is in Settings?',
        a: 'Two things: how Bar Cop is tuned to your operation, and your account. Business Profile and Recovery Targets hold your operation details and the benchmarks Bar Cop measures you against. Your Account and Team Members handle your login, subscription, backups, and who else can get in. The overview shows your account, profile, and targets at a glance, each with an Edit link.' },
      { q: 'How do I set up Bar Cop?',
        a: 'Setup happens as you go, not from a separate checklist. When you first sign in, onboarding captures your business name, location, and service periods. From there, each section walks you through its own setup the first time you open it with no data, showing the steps in order right on that page. Your profile and targets always live here in Settings if you need to adjust them later.' }
    ]},
    { t: 'Business Profile', qa: [
      { q: 'What are service periods and why do they matter?',
        a: 'They are the dayparts you run, like Brunch, Lunch, Dinner, and Late Night. They are not cosmetic: they set every shift-type field across Bar Cop, including the schedule, cash tolerances, and the Recovery daypart breakdowns. Turn on the ones you run, and add a custom one if your venue runs something different.' },
      { q: 'Where do my sales numbers come from?',
        a: 'From the weeks you close in Close The Week. Until your first week is in, the audits ask once for last week\'s bar and food sales so they have a real number to measure against. After that, your closed weeks drive everything and you are not asked again.' }
    ]},
    { t: 'Recovery Targets', qa: [
      { q: 'What are the targets?',
        a: 'The benchmarks Bar Cop grades you against: pour cost, food cost, labor, and prime cost percentages for Profit; check average and revenue per labor hour for Revenue. Industry benchmarks are pre-filled so you can start day one, but you should adjust them to your own operation.' }
    ]},
    { t: 'Account', qa: [
      { q: 'How do I change my password?',
        a: 'On Your Account, under Password. Everyone on the team can change their own password there, whatever their role.' },
      { q: 'Who can see billing and backups?',
        a: 'Only the owner. Your Account shows the subscription, Manage Billing, Add Another Bar, and the full Data Backup to the account owner alone. A backup is the entire account in one file, so it stays with the owner. Admins and staff see just their password on that page.' }
    ]},
    { t: 'Team and Access', qa: [
      { q: 'What are the roles?',
        a: 'Three. Owner is you, or whoever holds the card: full access to everything, holds billing, and controls the whole team. Admin runs the bar day to day and gets the areas you grant plus your bar settings (Business Profile and Recovery Targets), but never billing. Staff gets only the areas you grant, plus their own password. You invite people on Team Members by email; if they already have a Bar Cop login they join with no email, otherwise they get a link to set a password.' },
      { q: 'How does access to each area work?',
        a: 'Every area is either No Access or Full Access, set per person. Full Access means they see and change everything in that area; No Access hides it completely, both on the Hub and in the menus. The areas are Inventory, Labor, Shift, Profit, Revenue, Cash, Events, Books, and the Bar Cop Audit. There is no view-only middle setting on purpose: either someone runs an area or they do not see it, which keeps access simple and honest.' },
      { q: 'Can an admin invite and manage their own people?',
        a: 'Yes, within their own reach. An admin can invite Staff (not other admins), can only grant areas they hold themselves, and can only edit or remove the people they personally invited. Anyone you invited, the admins included, stays under your control alone. So you set an admin\'s ceiling once, and everything they can hand out flows from that. Only the owner changes roles.' },
      { q: 'How do I hand the account to someone else?',
        a: 'On Team Members, use Make Owner on that person\'s row (owner only). Ownership, including billing, moves to them and you stay on as an admin. This is how you fix the common case where a manager signed up with the owner\'s card.' },
      { q: 'Does Bar Cop ask for sensitive employee data?',
        a: 'No. Bar Cop never asks for SSNs, bank details, or anything you would not keep in a binder. It is a management tool, not payroll or HR software.' }
    ]}
  ],

  draw() {
    const search = '<div class="f" style="max-width:420px;margin-bottom:8px;">'
      + '<input type="text" id="help-search" placeholder="Search Settings help..." autocomplete="off" value="' + esc(this.query) + '"/></div>';
    const tabs = '<div class="ch-tabs no-print">'
      + this.SECTIONS.map((s, i) => '<button class="ch-tab' + (this.tab === i ? ' on' : '') + '" data-tab="' + i + '">' + esc(s.t) + '</button>').join('')
      + '</div>';
    this.container.innerHTML = '<div class="screen">' + search + tabs + '<div id="help-body">' + this.bodyHtml() + '</div>' + App.helpFooter() + '</div>';
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
