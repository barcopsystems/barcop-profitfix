'use strict';

/* ── Blueprint — how the week works, node by node ─────────────────────────────
   A Hub-level full page (top-nav link right of The Hub). Not a link menu (that is
   the Hub) and not a data-flow diagram. It is the reference map of the weekly
   workflow: every stage, section, and step is a clickable node, and clicking one
   explains what it is, why it sits where it does, and what it hands off, in a
   persistent detail panel (desktop) or a slide-in (mobile). Navigation is a
   secondary Open button inside the panel.

   Layout mirrors the Hub / Close The Week depth: numbered main cards with the
   section tiles nested on the recessed data-row fill; Hub-style step circles.
   The DATA below is the single source of truth; _nodes is flattened from it. */

S.FlowMap = {
  _sel: null,

  CAPTURE: [
    { id: 'inventory', title: 'Inventory', go: 'ic-dashboard',
      d: 'Where the bar and food side of your week gets counted. Everything that costs you money and everything that walks out starts as a number here. Nothing in Profit or Cash is real until you have counted.',
      steps: [
        { id: 'inv-1', label: 'Take the count',     d: 'Count what is on the shelf. This is the anchor for every cost and shrink number downstream. Skip it and pour cost, food cost, and trapped cash all go blind.' },
        { id: 'inv-2', label: 'Receive deliveries', d: 'Log what came in since your last count, with what you actually paid. This is where a vendor price creep or a short delivery gets caught, and it feeds your real COGS.' },
        { id: 'inv-3', label: 'Order to par',       d: 'Buy back up to par off your usage, not a gut number. Ordering to par keeps cash off the shelf instead of tied up in overstock you did not need.' },
        { id: 'inv-4', label: 'Review flags',       d: 'Bar Cop surfaces the shrink, the spot checks, and the dead stock worth a look. Clear these and the week\'s inventory story is closed.' }
      ] },
    { id: 'labor', title: 'Labor', go: 'lc-dashboard',
      d: 'Your schedule, hours, wages, and tips. Half of prime cost and the whole payroll worksheet come from here.',
      steps: [
        { id: 'lab-1', label: 'Import hours',    d: 'Drop your timeclock export. These hours are half of prime cost and the base for every labor percent and revenue-per-hour read.' },
        { id: 'lab-2', label: 'Log tips',        d: 'Get the week\'s tips in, by hand or from a POS export. They feed the tip credit, payroll, and the server tip percent.' },
        { id: 'lab-3', label: 'Build next week', d: 'Set next week\'s shifts against your forecast while this week is fresh. This is where overtime gets caught before it is logged, not after.' },
        { id: 'lab-4', label: 'Review flags',    d: 'Overtime, call-outs, and expiring certs Bar Cop caught. Handle them and labor is closed for the week.' }
      ] },
    { id: 'shift', title: 'Shift', go: 'sc-dashboard',
      d: 'Every service logged: sales, cash, drawers, voids, comps. The source of your top line and most of your theft signals.',
      steps: [
        { id: 'shf-1', label: 'Import sales',    d: 'Drop the week\'s sales by day. This is your top line, and it rolls straight into Run This Week for all three Recovery sections.' },
        { id: 'shf-2', label: 'Reconcile cash',  d: 'Get the week\'s over and short in, from your POS cash report or a hand count. Shorts here are the first place theft shows.' },
        { id: 'shf-3', label: 'Log exceptions',  d: 'Waste, spills, and walked tabs off your sheet. Small numbers that add up, and they feed the loss board.' },
        { id: 'shf-4', label: 'Review flags',    d: 'Cash shorts, voids, and comps worth a second look. Clear them and the floor side of the week is closed.' }
      ] }
  ],
  EVENTS: { id: 'events', title: 'Events', go: 'ev-dashboard',
    d: 'Bookings, catering, and your event regulars. It runs on its own clock, not the weekly close, and pushes confirmed offsite catering and deposits into the week ahead and the Revenue audit.' },

  RECOVERY: [
    { id: 'profit', title: 'Profit', go: 'dashboard',
      d: 'Where margin gets defended. Pour cost, food cost, theft, vendor pricing, prime. It reads off your Control closes and hunts the dollars leaking out.',
      steps: [
        { id: 'pf-1', label: 'Run This Week',           d: 'Confirm the week\'s P&L: sales from Shift, COGS from Inventory, labor from Labor. It is the gate. Nothing below it scores until the week is in.' },
        { id: 'pf-2', label: 'Check costs vs target',   d: 'Your pour, food, and prime cost against target for the week. This is where you see which cost slipped before you act on it.' },
        { id: 'pf-3', label: 'Work your biggest leak',  d: 'The audit ranked your leaks by dollars. Take the biggest one down here. Working the top leak first is where the real money is.' },
        { id: 'pf-4', label: 'Run the Profit audit',    d: 'Score the whole margin side and refresh your leak board, about monthly. It runs last because it grades the week you just worked.' }
      ] },
    { id: 'revenue', title: 'Revenue', go: 'r-dashboard',
      d: 'The top line. Check average, menu pricing, and labor productivity. Two bars with the same costs make very different money depending on this.',
      steps: [
        { id: 'rv-1', label: 'Run This Week',           d: 'Confirm sales, covers, and labor for the week. Same gate as Profit: it pulls your closes into one read and nothing below scores until it is in.' },
        { id: 'rv-2', label: 'Check numbers vs target', d: 'Check average, labor percent, and revenue per labor hour against target. Where you see which lever on the top line slipped.' },
        { id: 'rv-3', label: 'Work your biggest leak',  d: 'Open the Revenue Fix on the biggest-dollar gap and close it. Menu, pricing, servers, or labor, whichever is costing you the most.' },
        { id: 'rv-4', label: 'Run the Revenue audit',   d: 'Score the top line and refresh the leak board, about monthly. Runs last, grading the week you just worked.' }
      ] },
    { id: 'cash', title: 'Cash', go: 'c-dashboard',
      d: 'Liquidity. Cash trapped on the shelf, your runway, and how fast you pay. The one section that reads from everywhere to answer whether you make it to next quarter.',
      steps: [
        { id: 'cs-1', label: 'Free up inventory cash', d: 'Run down dead stock and order to par so cash stops sitting on the shelf. The fastest cash you can free without selling a thing.' },
        { id: 'cs-2', label: 'Stay ahead of the week', d: 'Look at what is going out against what is coming in across the next weeks. Catch a tight week before it lands.' },
        { id: 'cs-3', label: 'Pay on terms',           d: 'Hold your cash to the vendor due date and take any early-pay discount worth more than the cash sitting in your account.' },
        { id: 'cs-4', label: 'Run the Cash audit',     d: 'Score your liquidity and refresh the Cash Fix. Like the others, it runs last and grades the week.' }
      ] }
  ],

  ASNEEDED: [
    { id: 'invest',    title: 'Investigations',       go: 'theft-risk',          trigger: 'a loss flag needs working',
      d: 'You open a case from a drawer short, a bad spot check, or a sales pattern, then work the steps and log the finding. It only ever starts from a real flag, never a hunch.' },
    { id: 'menu',      title: 'Reprice the menu',     go: 'r-menu-engineering',  trigger: 'check average or a margin is slipping',
      d: 'Menu Engineering ranks every item against its own category and suggests a price that hits your target. You plan the change, then mark it live when you actually roll it out.' },
    { id: 'dogtest',   title: 'Dog Test',             go: 'r-dog-test',          trigger: 'Menu Engineering flags a Dog',
      d: 'Before you cut a low-margin, low-volume item, give it ninety days in a better slot with a rewritten description and watch the volume. Keep it or cut it on real numbers, not a hunch.' },
    { id: 'chase',     title: 'Chase vendor credits', go: 'ic-receive-delivery', trigger: 'a delivery came up short or a price jumped',
      d: 'File the discrepancy at the dock and chase the credit off your Credits to Chase list. This is money you are owed back, not a new sale.' },
    { id: 'spotcheck', title: 'Spot Check',           go: 'ic-spot-check',       trigger: 'a variance is worth catching mid-week',
      d: 'A fast single-product recount instead of waiting for the full weekly count. It feeds the same loss board and can open an investigation.' }
  ],

  OUTPUTS: [
    { id: 'hub',   title: 'The Hub',       action: 'hub',   d: 'Your cross-system home. Total recovered, your Bar Cop Audit score, and the top exposures across every section, in one read.' },
    { id: 'books', title: 'Books',         action: 'books', d: 'Month-end financials, the Weekly P&L, and the payroll worksheet. Built from Run This Week, your hours and tips, operating expenses, and permits.' },
    { id: 'bca',   title: 'Bar Cop Audit', action: 'audit', d: 'The score that answers whether the place is run with discipline, separate from the dollar-hunting audits. Reads all three Control sections and grades six areas.' }
  ],

  open() {
    App.openHubFullPage('Blueprint', (mount) => {
      this.container = mount;
      this._sel = null;
      this._buildNodes();
      this.render();
    }, 'flowmap');
  },

  // Flatten every clickable node into one lookup. Steps inherit their section's
  // Open target so the panel button lands on the right page.
  _buildNodes() {
    const m = {};
    const addSection = sec => {
      m[sec.id] = { title: sec.title, d: sec.d, go: sec.go, action: sec.action };
      (sec.steps || []).forEach(s => { m[s.id] = { title: sec.title + ': ' + s.label, d: s.d, go: sec.go, action: sec.action }; });
    };
    this.CAPTURE.forEach(addSection);
    addSection(this.EVENTS);
    this.RECOVERY.forEach(addSection);
    this.ASNEEDED.forEach(addSection);
    this.OUTPUTS.forEach(addSection);
    this._nodes = m;
  },

  render() {
    const eventsFeeder = '<div class="fm-feeder" data-node="events">'
      + '<span><span style="color:var(--gold);font-weight:700;">Events</span> feeds catering and deposits into the week ahead. It runs on its own clock, not the weekly close.</span>'
      + '<span class="fm-tch">&rsaquo;</span></div>';

    const tree = this.stage('1', 'Close your Control sections',
        'Put the week\'s raw numbers in. Three closes, worked top to bottom.',
        this.grid(this.CAPTURE, 3) + eventsFeeder)
      + this.connector('Your closes roll up into each section\'s weekly numbers.')
      + this.stage('2', 'Work the money in Recovery',
        'Each opens with Run This Week, pulling your Control closes into one read, then it diagnoses, fixes, and scores.',
        this.grid(this.RECOVERY, 3))
      + this.connector('Working a leak or running an audit points you at the specific jobs below.')
      + this.stage(null, 'As needed',
        'Off the weekly clock. You open these only when the close flags them.',
        this.grid(this.ASNEEDED, 0))
      + this.connector('Everything you recover and score rolls up to')
      + this.stage(null, 'Where it lands',
        'What the week feeds once you have closed it.',
        this.grid(this.OUTPUTS, 0));

    this.container.innerHTML = this.styleBlock()
      + '<div class="screen" style="max-width:none;padding-left:24px;padding-right:24px;">'
      + '<div class="fm-wrap"><div class="fm-tree">' + tree + '</div>'
      + '<div class="fm-panel-col"><div class="fm-panel" id="fm-panel">' + this.panelHtml(null) + '</div></div>'
      + '</div></div>';

    this.container.querySelectorAll('[data-node]').forEach(el =>
      el.addEventListener('click', () => this.select(el.dataset.node)));
    this.wirePanelOpen();
  },

  select(id) {
    const node = this._nodes[id];
    if (!node) return;
    this._sel = id;
    if (window.matchMedia && window.matchMedia('(max-width:900px)').matches) {
      App.showHelpModal(node.title, [{ p: [node.d] }]);
      return;
    }
    this.container.querySelectorAll('[data-node]').forEach(el => el.classList.toggle('fm-on', el.dataset.node === id));
    const panel = document.getElementById('fm-panel');
    if (panel) { panel.innerHTML = this.panelHtml(node); this.wirePanelOpen(); }
  },

  panelHtml(node) {
    if (!node) {
      return '<div class="fm-p-title">The week, node by node</div>'
        + '<div class="fm-p-body">Bar Cop runs on one sitting at the end of the week. Close your three Control sections, roll them up and work the money in Recovery, then chase only what the week flags.</div>'
        + '<div class="fm-p-body" style="margin-top:10px;color:var(--t3);">Tap any section or step for what it is and where it sits in the flow.</div>';
    }
    const openBtn = (node.go || node.action)
      ? '<button class="btn btn-primary btn-sm" id="fm-open" data-go="' + esc(node.go || '') + '" data-action="' + esc(node.action || '') + '" style="margin-top:16px;">Open</button>'
      : '';
    return '<div class="fm-p-title">' + esc(node.title) + '</div>'
      + '<div class="fm-p-body">' + esc(node.d) + '</div>' + openBtn;
  },
  wirePanelOpen() {
    const b = document.getElementById('fm-open');
    if (b) b.addEventListener('click', () => this.goTo(b.dataset.go, b.dataset.action));
  },

  // ── Building blocks ─────────────────────────────────────────────────────────
  stage(num, title, sub, inner) {
    const head = '<div class="fm-hd">'
      + (num ? '<span class="fm-hdnum">' + num + '</span>' : '')
      + '<div style="min-width:0;"><div class="fm-hdt">' + esc(title) + '</div>'
      + '<div class="fm-hds">' + esc(sub) + '</div></div></div>';
    return '<div class="fm-stage">' + head + '<div class="fm-grid">' + inner + '</div></div>';
  },
  grid(cards, cols) {
    // cols>0 forces an even N-column row (the 3 Control / Recovery sections);
    // 0 lets the smaller-job rows auto-fit.
    const tiles = cards.map(c => this.tile(c)).join('');
    return cols ? '<div style="grid-column:1/-1;display:grid;grid-template-columns:repeat(' + cols + ',minmax(0,1fr));gap:12px;">' + tiles + '</div>' : tiles;
  },
  tile(c) {
    let inner = '';
    if (c.steps) {
      inner = '<div style="margin-top:11px;">' + c.steps.map((s, i) =>
        '<div class="fm-step" data-node="' + esc(s.id) + '"><span class="fm-num">' + (i + 1) + '</span><span class="fm-sl">' + esc(s.label) + '</span></div>').join('') + '</div>';
    } else if (c.trigger) {
      inner = '<div class="fm-meta" style="margin-top:9px;"><span style="color:var(--t4);">When </span>' + esc(c.trigger) + '</div>';
    } else if (c.d && !c.steps) {
      // outputs: a short role line under the title
      inner = '<div class="fm-meta" style="margin-top:9px;">' + esc((c.d.split('. ')[0]) + '.') + '</div>';
    }
    return '<div class="fm-tile">'
      + '<div class="fm-tt" data-node="' + esc(c.id) + '"><span class="fm-tn">' + esc(c.title) + '</span><span class="fm-tch">&rsaquo;</span></div>'
      + inner + '</div>';
  },
  connector(label) {
    return '<div class="fm-conn"><div class="fm-conn-line"></div>'
      + (label ? '<div class="fm-conn-txt">' + esc(label) + '</div>' : '')
      + '<div class="fm-conn-arw">&#9662;</div></div>';
  },

  styleBlock() {
    return '<style>'
      + '.fm-wrap{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:20px;align-items:start;}'
      + '@media(max-width:900px){.fm-wrap{grid-template-columns:1fr;}.fm-panel-col{display:none;}}'
      + '.fm-panel{position:sticky;top:8px;background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);padding:18px 20px;}'
      + '.fm-p-title{font-size:15px;font-weight:700;color:var(--t1);margin-bottom:10px;}'
      + '.fm-p-body{font-size:13px;color:var(--t2);line-height:1.7;}'
      + '.fm-stage{background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);padding:18px 20px;}'
      + '.fm-hd{display:flex;align-items:flex-start;gap:13px;margin-bottom:16px;}'
      + '.fm-hdnum{width:28px;height:28px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:13px;font-weight:800;}'
      + '.fm-hdt{font-size:15px;font-weight:700;color:var(--t1);}'
      + '.fm-hds{font-size:12px;color:var(--t3);line-height:1.55;margin-top:3px;max-width:660px;}'
      + '.fm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;}'
      + '.fm-tile{background:#0D181E;border:1px solid var(--b-edge);border-radius:var(--r2);padding:13px 15px;display:flex;flex-direction:column;min-width:0;}'
      + '.fm-tt{display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;padding:2px 4px;margin:-2px -4px;border-radius:5px;transition:background .12s;}'
      + '.fm-tt:hover{background:#0F1A21;}'
      + '.fm-tn{font-size:13px;font-weight:700;color:var(--t1);}'
      + '.fm-tch{color:var(--t4);font-size:14px;line-height:1;}'
      + '.fm-step{display:flex;align-items:center;gap:10px;padding:4px 4px;margin:0 -4px;border-radius:5px;cursor:pointer;transition:background .12s;}'
      + '.fm-step:hover{background:#0F1A21;}'
      + '.fm-num{width:16px;height:16px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--b-edge);color:var(--t3);font-size:9px;font-weight:700;}'
      + '.fm-sl{font-size:11.5px;color:var(--t2);line-height:1.3;}'
      + '.fm-on{background:var(--gold-tint) !important;}'
      + '.fm-on .fm-tn,.fm-on .fm-sl{color:var(--t1);}'
      + '.fm-meta{font-size:11px;color:var(--t3);line-height:1.5;}'
      + '.fm-feeder{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--input);border:1px solid var(--b-edge);border-radius:var(--r2);padding:11px 15px;margin-top:12px;font-size:11.5px;color:var(--t3);line-height:1.55;cursor:pointer;transition:background .12s;}'
      + '.fm-feeder:hover{background:#0F1A21;}'
      + '.fm-conn{display:flex;flex-direction:column;align-items:center;gap:7px;margin:16px 0;}'
      + '.fm-conn-line{width:1px;height:16px;background:var(--b2);}'
      + '.fm-conn-txt{font-size:11.5px;color:var(--t3);text-align:center;max-width:520px;line-height:1.5;}'
      + '.fm-conn-arw{color:var(--gold);font-size:14px;line-height:1;opacity:0.8;}'
      + '</style>';
  },

  goTo(go, action) {
    if (action === 'hub')   return App.showHub();
    if (action === 'audit') return (window.S && S.HubBarCopAudit) ? S.HubBarCopAudit.open() : null;
    if (action === 'books') return (window.S && S.HubBooks) ? S.HubBooks.open() : null;
    if (go) return App.openScreen(go);
  }
};
