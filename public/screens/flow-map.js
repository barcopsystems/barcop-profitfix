'use strict';

/* ── Blueprint — your weekly workflow, top to bottom ──────────────────────────
   A Hub-level full page (top-nav link right of The Hub). Not a data-flow diagram
   (that plumbing lives in each section's Help -> Connections). It maps the
   WORKFLOW: how one weekly sitting cascades through the app. Two bands read top
   to bottom, "Your weekly sitting" (close Control, then work the money in
   Recovery) and "As needed" (the jobs the close flags), landing on the outputs.

   Visual language is lifted from the Close The Week step pages: surface cards,
   circle step numbers, app colors only. The only loose text on the canvas is the
   connector line between bands. SECTIONS are the single source of truth. */

S.FlowMap = {
  open() {
    App.openHubFullPage('Blueprint', (mount) => {
      this.container = mount;
      this.render();
    }, 'flowmap');
  },

  SECTIONS: {
    // The three Control closes (+ Events feeder): capture the week's raw numbers.
    capture: [
      { id: 'inventory', title: 'Inventory', go: 'ic-dashboard', steps: ['Take the count', 'Receive deliveries', 'Order to par', 'Review flags'] },
      { id: 'labor',     title: 'Labor',     go: 'lc-dashboard', steps: ['Import hours', 'Log tips', 'Build next week', 'Review flags'] },
      { id: 'shift',     title: 'Shift',     go: 'sc-dashboard', steps: ['Import sales', 'Reconcile cash', 'Log exceptions', 'Review flags'] },
      { id: 'events',    title: 'Events',    go: 'ev-dashboard', feeder: 'Feeds catering and deposits into the week ahead.' }
    ],
    // The three Recovery closes: roll the week up and work the money.
    recovery: [
      { id: 'profit',  title: 'Profit',  go: 'dashboard',   steps: ['Run This Week', 'Check costs vs target', 'Work your biggest leak', 'Run the Profit audit'] },
      { id: 'revenue', title: 'Revenue', go: 'r-dashboard', steps: ['Run This Week', 'Check numbers vs target', 'Work your biggest leak', 'Run the Revenue audit'] },
      { id: 'cash',    title: 'Cash',    go: 'c-dashboard', steps: ['Free up inventory cash', 'Stay ahead of the week', 'Pay on terms', 'Run the Cash audit'] }
    ],
    // Triggered work: off the weekly clock, opened only when the close flags it.
    asneeded: [
      { id: 'invest',    title: 'Investigations',       go: 'theft-risk',          trigger: 'a loss flag in Profit needs working' },
      { id: 'menu',      title: 'Reprice the menu',     go: 'r-menu-engineering',  trigger: 'check average or a margin is slipping' },
      { id: 'dogtest',   title: 'Dog Test',             go: 'r-dog-test',          trigger: 'Menu Engineering flags a Dog to keep or cut' },
      { id: 'chase',     title: 'Chase vendor credits', go: 'ic-receive-delivery', trigger: 'a delivery came up short or a price jumped' },
      { id: 'spotcheck', title: 'Spot Check',           go: 'ic-spot-check',       trigger: 'a variance is worth catching mid-week' }
    ],
    // Where the week lands.
    outputs: [
      { id: 'hub',   title: 'The Hub',       action: 'hub',   desc: 'Recovered dollars and your audit score, across every section.' },
      { id: 'books', title: 'Books',         action: 'books', desc: 'Month-end financials, the Weekly P&L, and payroll.' },
      { id: 'bca',   title: 'Bar Cop Audit', action: 'audit', desc: 'The cross-system score off your Control data.' }
    ]
  },

  render() {
    const S = this.SECTIONS;
    const grid = cards => '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(216px,1fr));gap:14px;">' + cards.map(c => this.card(c)).join('') + '</div>';

    const html = this.band('Your weekly sitting')
      + grid(S.capture)
      + this.connector('Your closes roll up into each section\'s weekly numbers.')
      + grid(S.recovery)
      + this.connector('Working a leak or running an audit points you at the jobs below.')
      + this.band('As needed')
      + grid(S.asneeded)
      + this.connector('It all rolls up to')
      + this.band('Where it lands')
      + grid(S.outputs);

    this.container.innerHTML = '<style>'
      + '.fm-card{background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);padding:15px 16px;cursor:pointer;display:flex;flex-direction:column;min-width:0;transition:background .12s;}'
      + '.fm-card:hover{background:var(--hover);}'
      + '.fm-ct{display:flex;align-items:center;justify-content:space-between;gap:8px;}'
      + '.fm-cn{font-size:14px;font-weight:700;color:var(--t1);}'
      + '.fm-ch{color:var(--t4);font-size:15px;line-height:1;}'
      + '.fm-step{display:flex;align-items:center;gap:11px;padding:4px 0;}'
      + '.fm-num{width:22px;height:22px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:10px;font-weight:800;}'
      + '.fm-sl{font-size:12px;color:var(--t2);line-height:1.35;}'
      + '.fm-meta{font-size:11.5px;color:var(--t3);line-height:1.55;}'
      + '.fm-band{font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--t3);margin:26px 0 12px;}'
      + '.fm-conn{display:flex;flex-direction:column;align-items:center;gap:7px;margin:18px 0 8px;}'
      + '.fm-conn-line{width:1px;height:16px;background:var(--b2);}'
      + '.fm-conn-txt{font-size:11.5px;color:var(--t3);text-align:center;max-width:520px;line-height:1.5;}'
      + '.fm-conn-arw{color:var(--t4);font-size:15px;line-height:1;}'
      + '</style>'
      + '<div class="screen" style="max-width:none;padding-left:24px;padding-right:24px;">' + html + '</div>';

    this.container.querySelectorAll('.fm-card').forEach(el =>
      el.addEventListener('click', () => this.goTo(el.dataset.go, el.dataset.action)));
  },

  band(title) { return '<div class="fm-band">' + esc(title) + '</div>'; },

  connector(label) {
    return '<div class="fm-conn"><div class="fm-conn-line"></div>'
      + (label ? '<div class="fm-conn-txt">' + esc(label) + '</div>' : '')
      + '<div class="fm-conn-arw">&#9662;</div></div>';
  },

  card(c) {
    let inner = '';
    if (c.steps) {
      inner = c.steps.map((s, i) => '<div class="fm-step"><span class="fm-num">' + (i + 1) + '</span><span class="fm-sl">' + esc(s) + '</span></div>').join('');
    } else if (c.trigger) {
      inner = '<div class="fm-meta"><span style="color:var(--t4);">When </span>' + esc(c.trigger) + '</div>';
    } else if (c.feeder || c.desc) {
      inner = '<div class="fm-meta">' + esc(c.feeder || c.desc) + '</div>';
    }
    return '<div class="fm-card" data-go="' + esc(c.go || '') + '" data-action="' + esc(c.action || '') + '">'
      + '<div class="fm-ct" style="' + (inner ? 'margin-bottom:11px;' : '') + '"><span class="fm-cn">' + esc(c.title) + '</span><span class="fm-ch">&rsaquo;</span></div>'
      + inner + '</div>';
  },

  goTo(go, action) {
    if (action === 'hub')   return App.showHub();
    if (action === 'audit') return (window.S && S.HubBarCopAudit) ? S.HubBarCopAudit.open() : null;
    if (action === 'books') return (window.S && S.HubBooks) ? S.HubBooks.open() : null;
    if (go) return App.openScreen(go);
  }
};
