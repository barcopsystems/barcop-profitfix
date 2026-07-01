'use strict';

/* ── Blueprint — your weekly workflow, top to bottom ──────────────────────────
   A Hub-level full page (top-nav link right of The Hub). Not a data-flow diagram
   (that plumbing lives in each section's Help -> Connections). It maps the
   WORKFLOW: how one weekly sitting cascades through the app.

   Layout mirrors the Hub / Close The Week depth: each stage is a MAIN CARD
   (numbered where it is a weekly step) with the section TILES nested inside it,
   the tiles sitting on the recessed data-row fill. Gold is the single accent
   (step numbers, arrows, key words); no gold hover borders. Connectors carry the
   hand-off narrative between cards. SECTIONS are the single source of truth. */

S.FlowMap = {
  open() {
    App.openHubFullPage('Blueprint', (mount) => {
      this.container = mount;
      this.render();
    }, 'flowmap');
  },

  CAPTURE: [
    { id: 'inventory', title: 'Inventory', go: 'ic-dashboard', steps: ['Take the count', 'Receive deliveries', 'Order to par', 'Review flags'] },
    { id: 'labor',     title: 'Labor',     go: 'lc-dashboard', steps: ['Import hours', 'Log tips', 'Build next week', 'Review flags'] },
    { id: 'shift',     title: 'Shift',     go: 'sc-dashboard', steps: ['Import sales', 'Reconcile cash', 'Log exceptions', 'Review flags'] }
  ],
  RECOVERY: [
    { id: 'profit',  title: 'Profit',  go: 'dashboard',   steps: ['Run This Week', 'Check costs vs target', 'Work your biggest leak', 'Run the Profit audit'] },
    { id: 'revenue', title: 'Revenue', go: 'r-dashboard', steps: ['Run This Week', 'Check numbers vs target', 'Work your biggest leak', 'Run the Revenue audit'] },
    { id: 'cash',    title: 'Cash',    go: 'c-dashboard', steps: ['Free up inventory cash', 'Stay ahead of the week', 'Pay on terms', 'Run the Cash audit'] }
  ],
  ASNEEDED: [
    { id: 'invest',    title: 'Investigations',       go: 'theft-risk',          trigger: 'a loss flag in Profit needs working' },
    { id: 'menu',      title: 'Reprice the menu',     go: 'r-menu-engineering',  trigger: 'check average or a margin is slipping' },
    { id: 'dogtest',   title: 'Dog Test',             go: 'r-dog-test',          trigger: 'Menu Engineering flags a Dog to keep or cut' },
    { id: 'chase',     title: 'Chase vendor credits', go: 'ic-receive-delivery', trigger: 'a delivery came up short or a price jumped' },
    { id: 'spotcheck', title: 'Spot Check',           go: 'ic-spot-check',       trigger: 'a variance is worth catching mid-week' }
  ],
  OUTPUTS: [
    { id: 'hub',   title: 'The Hub',       action: 'hub',   desc: 'Recovered dollars and your audit score, across every section.' },
    { id: 'books', title: 'Books',         action: 'books', desc: 'Month-end financials, the Weekly P&L, and payroll.' },
    { id: 'bca',   title: 'Bar Cop Audit', action: 'audit', desc: 'The cross-system score off your Control data.' }
  ],

  render() {
    const eventsFeeder = '<div class="fm-feeder" data-go="ev-dashboard">'
      + '<span><span style="color:var(--gold);font-weight:700;">Events</span> feeds catering and deposits into the week ahead. It runs on its own clock, not the weekly close.</span>'
      + '<span class="fm-tch">&rsaquo;</span></div>';

    const html = '<div class="fm-band">Your weekly sitting</div>'
      + this.stage('1', 'Close your Control sections',
          'Put the week\'s raw numbers in. Three closes, worked top to bottom.',
          this.grid(this.CAPTURE) + eventsFeeder)
      + this.connector('Your closes roll up into each section\'s weekly numbers.')
      + this.stage('2', 'Work the money in Recovery',
          'Each opens with Run This Week, pulling your Control closes into one read, then it diagnoses, fixes, and scores.',
          this.grid(this.RECOVERY))
      + this.connector('Working a leak or running an audit points you at the specific jobs below.')
      + this.stage(null, 'As needed',
          'Off the weekly clock. You open these only when the close flags them.',
          this.grid(this.ASNEEDED))
      + this.connector('Everything you recover and score rolls up to')
      + this.stage(null, 'Where it lands',
          'What the week feeds once you have closed it.',
          this.grid(this.OUTPUTS));

    this.container.innerHTML = '<style>'
      + '.fm-band{font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--t3);margin:0 0 12px;}'
      + '.fm-stage{background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);padding:18px 20px;}'
      + '.fm-hd{display:flex;align-items:flex-start;gap:13px;margin-bottom:16px;}'
      + '.fm-hdnum{width:28px;height:28px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:13px;font-weight:800;}'
      + '.fm-hdt{font-size:15px;font-weight:700;color:var(--t1);}'
      + '.fm-hds{font-size:12px;color:var(--t3);line-height:1.55;margin-top:3px;max-width:660px;}'
      + '.fm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(212px,1fr));gap:12px;}'
      + '.fm-tile{background:#0D181E;border:1px solid var(--b-edge);border-radius:var(--r2);padding:13px 15px;cursor:pointer;transition:background .12s;display:flex;flex-direction:column;min-width:0;}'
      + '.fm-tile:hover{background:#0F1A21;}'
      + '.fm-tt{display:flex;align-items:center;justify-content:space-between;gap:8px;}'
      + '.fm-tn{font-size:13px;font-weight:700;color:var(--t1);}'
      + '.fm-tch{color:var(--t4);font-size:14px;line-height:1;}'
      + '.fm-step{display:flex;align-items:center;gap:10px;padding:3.5px 0;}'
      + '.fm-num{width:20px;height:20px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:9px;font-weight:800;}'
      + '.fm-sl{font-size:11.5px;color:var(--t2);line-height:1.3;}'
      + '.fm-meta{font-size:11px;color:var(--t3);line-height:1.5;}'
      + '.fm-feeder{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--input);border:1px solid var(--b-edge);border-radius:var(--r2);padding:11px 15px;margin-top:12px;font-size:11.5px;color:var(--t3);line-height:1.55;cursor:pointer;transition:background .12s;}'
      + '.fm-feeder:hover{background:#0F1A21;}'
      + '.fm-conn{display:flex;flex-direction:column;align-items:center;gap:7px;margin:16px 0;}'
      + '.fm-conn-line{width:1px;height:16px;background:var(--b2);}'
      + '.fm-conn-txt{font-size:11.5px;color:var(--t3);text-align:center;max-width:520px;line-height:1.5;}'
      + '.fm-conn-arw{color:var(--gold);font-size:14px;line-height:1;opacity:0.8;}'
      + '</style>'
      + '<div class="screen" style="max-width:none;padding-left:24px;padding-right:24px;">' + html + '</div>';

    this.container.querySelectorAll('[data-go],[data-action]').forEach(el => {
      if (el.dataset.go || el.dataset.action) el.addEventListener('click', () => this.goTo(el.dataset.go, el.dataset.action));
    });
  },

  // ── Building blocks ─────────────────────────────────────────────────────────
  stage(num, title, sub, inner) {
    const head = '<div class="fm-hd">'
      + (num ? '<span class="fm-hdnum">' + num + '</span>' : '')
      + '<div style="min-width:0;"><div class="fm-hdt">' + esc(title) + '</div>'
      + '<div class="fm-hds">' + esc(sub) + '</div></div></div>';
    return '<div class="fm-stage">' + head + '<div class="fm-grid">' + inner + '</div></div>';
  },
  grid(cards) { return cards.map(c => this.tile(c)).join(''); },

  tile(c) {
    let inner = '';
    if (c.steps) {
      inner = '<div style="margin-top:11px;">' + c.steps.map((s, i) =>
        '<div class="fm-step"><span class="fm-num">' + (i + 1) + '</span><span class="fm-sl">' + esc(s) + '</span></div>').join('') + '</div>';
    } else if (c.trigger) {
      inner = '<div class="fm-meta" style="margin-top:9px;"><span style="color:var(--t4);">When </span>' + esc(c.trigger) + '</div>';
    } else if (c.desc) {
      inner = '<div class="fm-meta" style="margin-top:9px;">' + esc(c.desc) + '</div>';
    }
    return '<div class="fm-tile" data-go="' + esc(c.go || '') + '" data-action="' + esc(c.action || '') + '">'
      + '<div class="fm-tt"><span class="fm-tn">' + esc(c.title) + '</span><span class="fm-tch">&rsaquo;</span></div>'
      + inner + '</div>';
  },
  connector(label) {
    return '<div class="fm-conn"><div class="fm-conn-line"></div>'
      + (label ? '<div class="fm-conn-txt">' + esc(label) + '</div>' : '')
      + '<div class="fm-conn-arw">&#9662;</div></div>';
  },

  goTo(go, action) {
    if (action === 'hub')   return App.showHub();
    if (action === 'audit') return (window.S && S.HubBarCopAudit) ? S.HubBarCopAudit.open() : null;
    if (action === 'books') return (window.S && S.HubBooks) ? S.HubBooks.open() : null;
    if (go) return App.openScreen(go);
  }
};
