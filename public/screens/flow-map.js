'use strict';

/* ── Blueprint — your weekly workflow, top to bottom ──────────────────────────
   A Hub-level full page (top-nav link right of The Hub). This is not a data-flow
   diagram (that plumbing lives in each section's Help -> Connections). It maps
   the WORKFLOW: how one weekly sitting cascades through the app. Two bands read
   top to bottom, "Your weekly sitting" (close Control, then work the money in
   Recovery) and "As needed" (the jobs the close flags), landing on the outputs.
   Every block is clickable and jumps into that screen.

   SECTIONS below are the single source of truth; the layout derives from them. */

S.FlowMap = {
  open() {
    App.openHubFullPage('Blueprint', (mount) => {
      this.container = mount;
      this.render();
    }, 'flowmap');
  },

  SECTIONS: {
    // The three Control closes: capture the week's raw numbers.
    capture: [
      { id: 'inventory', title: 'Inventory', go: 'ic-dashboard', steps: ['Take the count', 'Receive deliveries', 'Order to par', 'Review flags'] },
      { id: 'labor',     title: 'Labor',     go: 'lc-dashboard', steps: ['Import hours', 'Log tips', 'Build next week', 'Review flags'] },
      { id: 'shift',     title: 'Shift',     go: 'sc-dashboard', steps: ['Import sales', 'Reconcile cash', 'Log exceptions', 'Review flags'] }
    ],
    // The three Recovery closes: roll the week up and work the money.
    recovery: [
      { id: 'profit',  title: 'Profit',  go: 'dashboard',   steps: ['Run This Week', 'Check costs vs target', 'Work your biggest leak', 'Run the Profit audit'] },
      { id: 'revenue', title: 'Revenue', go: 'r-dashboard', steps: ['Run This Week', 'Check numbers vs target', 'Work your biggest leak', 'Run the Revenue audit'] },
      { id: 'cash',    title: 'Cash',    go: 'c-dashboard', steps: ['Free up inventory cash', 'Stay ahead of the week', 'Pay on terms', 'Run the Cash audit'] }
    ],
    // Triggered work: off the weekly clock, opened only when the close flags it.
    asneeded: [
      { id: 'invest',    title: 'Investigations',      go: 'theft-risk',         trigger: 'a loss flag in Profit needs working' },
      { id: 'menu',      title: 'Reprice the menu',    go: 'r-menu-engineering', trigger: 'check average or a margin is slipping' },
      { id: 'dogtest',   title: 'Dog Test',            go: 'r-dog-test',          trigger: 'Menu Engineering flags a Dog to keep or cut' },
      { id: 'chase',     title: 'Chase vendor credits', go: 'ic-receive-delivery', trigger: 'a delivery came up short or a price jumped' },
      { id: 'spotcheck', title: 'Spot Check',          go: 'ic-spot-check',       trigger: 'a variance is worth catching mid-week' }
    ],
    // Where the week lands.
    outputs: [
      { id: 'hub',   title: 'The Hub',        action: 'hub',   desc: 'Recovered dollars and your Bar Cop Audit score, across every section.' },
      { id: 'books', title: 'Books',          action: 'books', desc: 'Month-end financials, the Weekly P&L Brief, and the payroll worksheet.' },
      { id: 'bca',   title: 'Bar Cop Audit',  action: 'audit', desc: 'The cross-system score that reads all three Control sections.' }
    ]
  },

  render() {
    const S = this.SECTIONS;
    const grid = cards => '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;">' + cards.map(c => this.card(c)).join('') + '</div>';

    const eventsFeeder = '<div class="fm-card" data-go="ev-dashboard" style="cursor:pointer;margin-top:14px;background:var(--input);border:1px dashed var(--b-edge);border-radius:var(--r);padding:11px 15px;font-size:12px;color:var(--t3);line-height:1.6;">'
      + '<span style="color:var(--gold);font-weight:700;">Events feeds in &rarr; </span>'
      + 'bookings, catering, and deposits flow into your week ahead and the Revenue audit. It runs on its own clock, not the weekly close.</div>';

    const intro = '<div style="font-size:13px;color:var(--t2);line-height:1.7;max-width:700px;margin-bottom:24px;">'
      + 'This is your weekly workflow, top to bottom. Bar Cop runs on one sitting at the end of the week: close your Control sections, roll them up and work the money in Recovery, and only then chase the specific jobs the week flags. Tap any block to jump into it.</div>';

    const html = intro
      + this.band('Your weekly sitting', 'One sitting at the end of the week. Work it top to bottom.')
      + this.stage('1 &middot; Close your Control sections', 'Put the week\'s raw numbers in.')
      + grid(S.capture)
      + eventsFeeder
      + this.connector('Your three closes roll up into each section\'s weekly numbers.')
      + this.stage('2 &middot; Work the money in Recovery', 'Each section opens with Run This Week, which pulls your Control closes into one weekly read, then diagnoses, fixes, and scores.')
      + grid(S.recovery)
      + this.connector('Working your biggest leak, or running an audit, points you at the specific jobs below.')
      + this.band('As needed', 'Off the weekly clock. You open these only when the close flags them.')
      + grid(S.asneeded)
      + this.connector('Everything you recover and score rolls up to')
      + this.band('Where it lands', '')
      + grid(S.outputs);

    this.container.innerHTML = '<style>'
      + '.fm-card{transition:border-color .12s,background .12s;}'
      + '.fm-card:hover{border-color:var(--gold) !important;background:var(--gold-tint) !important;}'
      + '</style>'
      + '<div class="screen" style="max-width:none;padding-left:24px;padding-right:24px;">' + html + '</div>';

    this.container.querySelectorAll('.fm-card').forEach(el =>
      el.addEventListener('click', () => this.goTo(el.dataset.go, el.dataset.action)));
  },

  // ── Building blocks ─────────────────────────────────────────────────────────
  band(title, sub) {
    return '<div style="margin:26px 0 14px;">'
      + '<div style="font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);">' + title + '</div>'
      + (sub ? '<div style="font-size:12px;color:var(--t3);margin-top:5px;line-height:1.5;">' + sub + '</div>' : '')
      + '</div>';
  },
  stage(title, sub) {
    return '<div style="margin:0 0 12px;">'
      + '<div class="sh" style="margin:0;">' + title + '</div>'
      + (sub ? '<div style="font-size:11.5px;color:var(--t3);margin-top:5px;line-height:1.55;max-width:640px;">' + sub + '</div>' : '')
      + '</div>';
  },
  connector(label) {
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin:18px 0 8px;">'
      + '<div style="width:1px;height:16px;background:var(--b2);"></div>'
      + (label ? '<div style="font-size:11.5px;color:var(--t3);text-align:center;max-width:560px;line-height:1.55;">' + label + '</div>' : '')
      + '<div style="color:var(--t4);font-size:15px;line-height:1;">&#9662;</div>'
      + '</div>';
  },
  card(c) {
    const steps = (c.steps || []).map((s, i) =>
      '<div style="display:flex;gap:9px;align-items:baseline;font-size:12px;color:var(--t2);padding:3px 0;">'
      + '<span style="color:var(--t4);font-size:10px;font-weight:700;flex-shrink:0;width:9px;">' + (i + 1) + '</span>'
      + '<span style="line-height:1.4;">' + esc(s) + '</span></div>').join('');
    const trigger = c.trigger
      ? '<div style="font-size:11px;color:var(--t3);line-height:1.55;"><span style="color:var(--gold);font-weight:700;">When </span>' + esc(c.trigger) + '</div>'
      : '';
    const desc = c.desc ? '<div style="font-size:11px;color:var(--t3);line-height:1.55;">' + esc(c.desc) + '</div>' : '';
    return '<div class="fm-card" data-go="' + esc(c.go || '') + '" data-action="' + esc(c.action || '') + '" '
      + 'style="background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);padding:14px 16px;cursor:pointer;min-width:0;display:flex;flex-direction:column;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;' + (steps || trigger || desc ? 'margin-bottom:11px;' : '') + '">'
      +   '<span style="font-size:13.5px;font-weight:700;color:var(--t1);">' + esc(c.title) + '</span>'
      +   '<span style="color:var(--t4);font-size:15px;">&rsaquo;</span>'
      + '</div>'
      + steps + trigger + desc
      + '</div>';
  },

  goTo(go, action) {
    if (action === 'hub')   return App.showHub();
    if (action === 'audit') return (window.S && S.HubBarCopAudit) ? S.HubBarCopAudit.open() : null;
    if (action === 'books') return (window.S && S.HubBooks) ? S.HubBooks.open() : null;
    if (go) return App.openScreen(go);
  }
};
