'use strict';

/* ── Map — how the week works, node by node ───────────────────────────────────
   A Hub-level full page (top-nav link right of The Hub). Not a link menu (that is
   the Hub) and not a data-flow diagram. It is the reference map of the weekly
   workflow: four numbered stages, all open, no dividers. Every section title and
   step is a clickable node; selecting one explains what it is, why it sits where
   it does, and what it hands off, in a persistent detail panel (desktop) or a
   slide-in (mobile). The section number goes green to mark the last stage you
   touched, and stays green until you click a node in a different stage. The
   panel's Open button deep-links to the actual page that does the work.

   The stage arrays are the single source of truth; _nodes is flattened from them,
   each node carrying its stage and its own Open target. */

S.FlowMap = {
  _sel: null,
  _activeStage: null,

  CAPTURE: [
    { id: 'inventory', title: 'Inventory', go: 'ic-dashboard',
      d: 'Where the bar and food side of your week gets counted. Everything that costs you money and everything that walks out starts as a number here. Nothing in Profit or Cash is real until you have counted.',
      steps: [
        { id: 'inv-1', label: 'Take the count',     go: 'ic-take-inventory',  d: 'Count what is on the shelf. This is the anchor for every cost and shrink number downstream. Skip it and pour cost, food cost, and trapped cash all go blind.' },
        { id: 'inv-2', label: 'Receive deliveries', go: 'ic-receive-delivery', d: 'Log what came in since your last count, with what you actually paid. This is where a vendor price creep or a short delivery gets caught, and it feeds your real COGS.' },
        { id: 'inv-3', label: 'Order to par',       go: 'ic-order-sheet',      d: 'Buy back up to par off your usage, not a gut number. Ordering to par keeps cash off the shelf instead of tied up in overstock you did not need.' },
        { id: 'inv-4', label: 'Review flags',       go: 'ic-report-variance',  d: 'Bar Cop surfaces the shrink, the spot checks, and the dead stock worth a look. Clear these and the week\'s inventory story is closed.' }
      ] },
    { id: 'labor', title: 'Labor', go: 'lc-dashboard',
      d: 'Your schedule, hours, wages, and tips. Half of prime cost and the whole payroll worksheet come from here.',
      steps: [
        { id: 'lab-1', label: 'Import hours',    go: 'lc-log-hours',      d: 'Drop your timeclock export. These hours are half of prime cost and the base for every labor percent and revenue-per-hour read.' },
        { id: 'lab-2', label: 'Log tips',        go: 'lc-tip-log',        d: 'Get the week\'s tips in, by hand or from a POS export. They feed the tip credit, payroll, and the server tip percent.' },
        { id: 'lab-3', label: 'Build next week', go: 'lc-build-schedule', d: 'Set next week\'s shifts against your forecast while this week is fresh. This is where overtime gets caught before it is logged, not after.' },
        { id: 'lab-4', label: 'Review flags',    go: 'lc-overtime-watch', d: 'Overtime, call-outs, and expiring certs Bar Cop caught. Handle them and labor is closed for the week.' }
      ] },
    { id: 'shift', title: 'Shift', go: 'sc-dashboard',
      d: 'Every service logged: sales, cash, drawers, voids, comps. The source of your top line and most of your theft signals.',
      steps: [
        { id: 'shf-1', label: 'Import sales',   go: 'sc-dashboard',    d: 'Drop the week\'s sales by day. This is your top line, and it rolls straight into Confirm the Week for all three Recovery sections.' },
        { id: 'shf-2', label: 'Reconcile cash', go: 'sc-cash-control', d: 'Get the week\'s over and short in, from your POS cash report or a hand count. Shorts here are the first place theft shows.' },
        { id: 'shf-3', label: 'Log exceptions', go: 'sc-void-comp',    d: 'Waste, spills, and walked tabs off your sheet. Small numbers that add up, and they feed the loss board.' },
        { id: 'shf-4', label: 'Review flags',   go: 'theft-risk',      d: 'Cash shorts, voids, and comps worth a second look. Clear them and the floor side of the week is closed.' }
      ] }
  ],
  EVENTS: { id: 'events', title: 'Events', go: 'ev-dashboard',
    d: 'Bookings, catering, and your event regulars. It runs on its own clock, not the weekly close, and pushes confirmed offsite catering and deposits into the week ahead and the Revenue audit.' },

  RECOVERY: [
    { id: 'profit', title: 'Profit', go: 'dashboard',
      d: 'Where margin gets defended. Pour cost, food cost, theft, vendor pricing, prime. It reads off your Control closes and hunts the dollars leaking out.',
      steps: [
        { id: 'pf-1', label: 'Confirm the Week',        go: 'dashboard',     d: 'Confirm the week\'s P&L: sales from Shift, COGS from Inventory, labor from Labor. It is the gate. Nothing below it scores until the week is in.' },
        { id: 'pf-2', label: 'Check costs vs target',  go: 'dashboard',     d: 'Your pour, food, and prime cost against target for the week. This is where you see which cost slipped before you act on it.' },
        { id: 'pf-3', label: 'Work your biggest leak', go: 'profit-fix',    d: 'The audit ranked your leaks by dollars and the Playbook lays out the move. Take the biggest one down in the Profit Fix. That is where the real money is.' },
        { id: 'pf-4', label: 'Run the Profit audit',   go: 'audit-tracker', d: 'Score the whole margin side and refresh your leak board. Run it whenever you want a fresh read; it runs last because it grades the week you just worked.' }
      ] },
    { id: 'revenue', title: 'Revenue', go: 'r-dashboard',
      d: 'The top line. Check average, menu pricing, and labor productivity. Two bars with the same costs make very different money depending on this.',
      steps: [
        { id: 'rv-1', label: 'Confirm the Week',        go: 'r-dashboard', d: 'Confirm sales, covers, and labor for the week. Same gate as Profit: it pulls your closes into one read and nothing below scores until it is in.' },
        { id: 'rv-2', label: 'Check numbers vs target', go: 'r-dashboard', d: 'Check average, labor percent, and revenue per labor hour against target. Where you see which lever on the top line slipped.' },
        { id: 'rv-3', label: 'Work your biggest leak',  go: 'r-fix',       d: 'Open the Revenue Fix on the biggest-dollar gap and close it. Menu, pricing, servers, or labor, whichever is costing you the most.' },
        { id: 'rv-4', label: 'Run the Revenue audit',   go: 'r-audit',     d: 'Score the top line and refresh the leak board. Run it whenever you want a fresh read; it runs last, grading the week you just worked.' }
      ] },
    { id: 'cash', title: 'Cash', go: 'c-dashboard',
      d: 'Liquidity. Cash trapped on the shelf, your runway, and how fast you pay. The one section that reads from everywhere to answer whether you make it to next quarter.',
      steps: [
        { id: 'cs-1', label: 'Free up inventory cash', go: 'c-trapped',  d: 'Run down dead stock and order to par so cash stops sitting on the shelf. The fastest cash you can free without selling a thing.' },
        { id: 'cs-2', label: 'Stay ahead of the week', go: 'c-forecast', d: 'Look at what is going out against what is coming in across the next weeks. Catch a tight week before it lands.' },
        { id: 'cs-3', label: 'Pay on terms',           go: 'ic-vendors', d: 'Hold your cash to the vendor due date and take any early-pay discount worth more than the cash sitting in your account.' },
        { id: 'cs-4', label: 'Run the Cash audit',     go: 'c-audit',    d: 'Score your liquidity and refresh the Cash Fix. Like the others, it runs last and grades the week.' }
      ] }
  ],

  ASNEEDED: [
    { id: 'invest',    title: 'Investigations',       go: 'theft-risk',          trigger: 'a loss flag needs working',
      d: 'You open a case from a drawer short, a bad spot check, or a sales pattern, then work the steps and log the finding. It only ever starts from a real flag, never a hunch.' },
    { id: 'menu',      title: 'Reprice the menu',     go: 'r-menu-engineering',  trigger: 'check average or a margin is slipping',
      d: 'Menu Engineering ranks every item against its own category and suggests a price that hits your target. You plan the change, then mark it live when you actually roll it out.' },
    { id: 'dogtest',   title: 'Dog Test',             go: 'r-dog-test',          trigger: 'Menu Engineering flags a Dog',
      d: 'Before you cut a low-margin, low-volume item, give it ninety days in a better slot with a rewritten description and watch the volume. Keep it or cut it on real numbers, not a hunch.' },
    { id: 'variance',  title: 'Variance Report',      go: 'ic-report-variance',  trigger: 'you want product-by-product shrink detail',
      d: 'When the category read is not enough, drop a POS product sales file for the period and Bar Cop breaks the shrink down to every product, so you see exactly where the ounces went.' },
    { id: 'chase',     title: 'Chase vendor credits', go: 'ic-receive-delivery', trigger: 'a delivery came up short or a price jumped',
      d: 'File the discrepancy at the dock and chase the credit off your Credits to Chase list. This is money you are owed back, not a new sale.' },
    { id: 'spotcheck', title: 'Spot Check',           go: 'ic-spot-check',       trigger: 'a variance is worth catching mid-week',
      d: 'A fast single-product recount instead of waiting for the full weekly count. It feeds the same loss board and can open an investigation.' },
    { id: 'forecast',  title: 'Cash Forecast',        go: 'c-forecast',          trigger: 'you need the runway or a lender forecast',
      d: 'Projects your cash thirteen weeks out, what is coming in against what is going out, so you catch a tight week early. It also exports a clean forecast to hand a bank for a line of credit.' },
    { id: 'position',  title: 'Cash Position',        go: 'c-position',          trigger: 'you need today\'s safe-to-spend',
      d: 'The point-in-time read: how much of what is in your account is actually free to move on right now, after the tax you owe, outstanding gift cards, and your reserve.' }
  ],

  OUTPUTS: [
    { id: 'hub',    title: 'The Hub',        action: 'hub',    d: 'Your cross-system home. Total recovered, your Bar Cop Audit score, and the top exposures across every section, in one read.' },
    { id: 'review', title: 'Week in Review', action: 'review', d: 'The accountability side of the weekly close, section by section. Four reads per section on how the week actually ran, and it fills in once you confirm the week.' },
    { id: 'books',  title: 'Books',          action: 'books',  d: 'Month-end financials, the Weekly P&L, and the payroll worksheet. Built from your confirmed weeks, your hours and tips, operating expenses, and permits.' },
    { id: 'bca',    title: 'Bar Cop Audit',  action: 'audit',  d: 'The score that answers whether the place is run with discipline, separate from the dollar-hunting audits. Reads all three Control sections and grades six areas.' }
  ],

  STAGES: [
    { num: 1, key: 'capture',  title: 'Close your Control sections', sub: 'Put the week\'s raw numbers in. Three closes, worked top to bottom.', cols: 3, list: 'CAPTURE', feeder: true },
    { num: 2, key: 'recovery', title: 'Work the money in Recovery',  sub: 'Each opens with Confirm the Week, pulling your Control closes into one read, then it diagnoses, fixes, and scores.', cols: 3, list: 'RECOVERY' },
    { num: 3, key: 'asneeded', title: 'As needed',                   sub: 'Off the weekly clock. You open these only when the close flags them.', cols: 4, list: 'ASNEEDED' },
    { num: 4, key: 'lands',    title: 'Where it lands',              sub: 'What the week feeds once you have closed it.', cols: 4, list: 'OUTPUTS' }
  ],

  open() {
    if (App._hubBlocked && App._hubBlocked()) return;   // app-wide orientation map — not for Staff
    App.openHubFullPage('Map', (mount) => {
      this.container = mount;
      this._sel = null;
      this._activeStage = null;
      this._buildNodes();
      this.render();
    }, 'flowmap');
  },

  // Flatten every clickable node into one lookup, each carrying its stage and its
  // own Open target (steps deep-link to the page that does the work).
  _buildNodes() {
    const m = {};
    const add = (id, title, d, go, action, stage) => { m[id] = { title: title, d: d, go: go || '', action: action || '', stage: stage }; };
    const addSection = (sec, stage) => {
      add(sec.id, sec.title, sec.d, sec.go, sec.action, stage);
      (sec.steps || []).forEach(s => add(s.id, sec.title + ': ' + s.label, s.d, s.go || sec.go, sec.action, stage));
    };
    this.CAPTURE.forEach(s => addSection(s, 'capture'));
    addSection(this.EVENTS, 'capture');
    this.RECOVERY.forEach(s => addSection(s, 'recovery'));
    this.ASNEEDED.forEach(s => addSection(s, 'asneeded'));
    this.OUTPUTS.forEach(s => addSection(s, 'lands'));
    this._nodes = m;
  },

  render() {
    const tree = this.STAGES.map(st => this.stageCard(st)).join('');
    this.container.innerHTML = this.styleBlock()
      + '<div class="screen" style="max-width:none;">'
      + '<div class="fm-wrap"><div class="fm-tree">' + tree + '</div>'
      + '<div class="fm-panel-col"><div class="fm-panel" id="fm-panel">' + this.panelHtml(this._sel ? this._nodes[this._sel] : null) + '</div></div>'
      + '</div></div>';

    this.container.querySelectorAll('[data-node]').forEach(el =>
      el.addEventListener('click', () => this.select(el.dataset.node)));
    this.wirePanel();
  },

  stageCard(st) {
    const inner = this.grid(this[st.list], st.cols, st.feeder ? this.eventsFeeder() : '');
    const on = this._activeStage === st.key ? ' fm-hdnum-on' : '';
    return '<div class="fm-stage">'
      + '<div class="fm-hd">'
      +   '<span class="fm-hdnum' + on + '" data-stage="' + st.key + '">' + st.num + '</span>'
      +   '<div style="min-width:0;"><div class="fm-hdt">' + esc(st.title) + '</div><div class="fm-hds">' + esc(st.sub) + '</div></div>'
      + '</div>' + inner + '</div>';
  },

  select(id) {
    const node = this._nodes[id];
    if (!node) return;
    this._sel = id;
    this._activeStage = node.stage;
    // Green number on the stage this node lives in; stays until another stage.
    this.container.querySelectorAll('.fm-hdnum[data-stage]').forEach(el => el.classList.toggle('fm-hdnum-on', el.dataset.stage === node.stage));
    if (window.matchMedia && window.matchMedia('(max-width:900px)').matches) {
      const action = (node.go || node.action) ? { label: 'Open', onClick: () => this.goTo(node.go, node.action) } : null;
      App.showHelpModal(node.title, [{ p: [node.d] }], action);
      return;
    }
    this.container.querySelectorAll('[data-node]').forEach(el => el.classList.toggle('fm-on', el.dataset.node === id));
    const panel = document.getElementById('fm-panel');
    if (panel) { panel.innerHTML = this.panelHtml(node); this.wirePanel(); }
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
  wirePanel() {
    const b = document.getElementById('fm-open');
    if (b) b.addEventListener('click', () => this.goTo(b.dataset.go, b.dataset.action));
  },

  // ── Grid + tiles ────────────────────────────────────────────────────────────
  grid(cards, cols, extra) {
    return '<div style="display:grid;grid-template-columns:repeat(' + cols + ',minmax(0,1fr));gap:12px;">'
      + cards.map(c => this.tile(c)).join('') + (extra || '') + '</div>';
  },
  tile(c) {
    let inner = '';
    if (c.steps) {
      inner = '<div style="margin-top:11px;">' + c.steps.map((s, i) =>
        '<div class="fm-step" data-node="' + esc(s.id) + '"><span class="fm-num">' + (i + 1) + '</span><span class="fm-sl">' + esc(s.label) + '</span></div>').join('') + '</div>';
    } else if (c.trigger) {
      inner = '<div class="fm-meta" style="margin-top:9px;"><span style="color:var(--t4);">When </span>' + esc(c.trigger) + '</div>';
    } else if (c.d) {
      inner = '<div class="fm-meta" style="margin-top:9px;">' + esc(c.d.split('. ')[0] + '.') + '</div>';
    }
    return '<div class="fm-tile">'
      + '<div class="fm-tt" data-node="' + esc(c.id) + '"><span class="fm-tn">' + esc(c.title) + '</span><span class="fm-tch">&rsaquo;</span></div>'
      + inner + '</div>';
  },
  eventsFeeder() {
    return '<div class="fm-feeder" data-node="events">'
      + '<span><span style="color:var(--gold);font-weight:700;">Events</span> feeds catering and deposits into the week ahead. It runs on its own clock, not the weekly close.</span>'
      + '<span class="fm-tch">&rsaquo;</span></div>';
  },

  styleBlock() {
    return '<style>'
      + '.fm-wrap{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:20px;align-items:start;}'
      + '@media(max-width:900px){.fm-wrap{grid-template-columns:1fr;}.fm-panel-col{display:none;}}'
      + '.fm-panel{position:sticky;top:8px;background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);padding:18px 20px;}'
      + '.fm-p-title{font-size:15px;font-weight:700;color:var(--t1);margin-bottom:10px;}'
      + '.fm-p-body{font-size:13px;color:var(--t2);line-height:1.7;}'
      + '.fm-tree{display:flex;flex-direction:column;gap:18px;}'
      + '.fm-stage{background:var(--surface);border:1px solid var(--b-edge);border-radius:var(--r);padding:18px 20px;}'
      + '.fm-hd{display:flex;align-items:flex-start;gap:13px;margin-bottom:16px;}'
      + '.fm-hdnum{width:28px;height:28px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:13px;font-weight:800;}'
      + '.fm-hdnum-on{background:var(--green);color:var(--bg);}'
      + '.fm-hdt{font-size:15px;font-weight:700;color:var(--t1);}'
      + '.fm-hds{font-size:12px;color:var(--t3);line-height:1.55;margin-top:3px;max-width:680px;}'
      + '.fm-tile{background:#0D181E;border:1px solid var(--b-edge);border-radius:var(--r2);padding:13px 15px;display:flex;flex-direction:column;min-width:0;}'
      + '.fm-tt{display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;padding:3px 5px;margin:-3px -5px;border-radius:5px;transition:background .12s;}'
      + '.fm-tt:hover{background:#16242E;}'
      + '.fm-tn{font-size:13px;font-weight:700;color:var(--t1);}'
      + '.fm-tch{color:var(--t4);font-size:14px;line-height:1;}'
      + '.fm-step{display:flex;align-items:center;gap:10px;padding:4px 5px;margin:0 -5px;border-radius:5px;cursor:pointer;transition:background .12s;}'
      + '.fm-step:hover{background:#16242E;}'
      + '.fm-num{width:16px;height:16px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--b-edge);color:var(--t3);font-size:9px;font-weight:700;}'
      + '.fm-sl{font-size:11.5px;color:var(--t2);line-height:1.3;}'
      + '.fm-on{background:var(--gold-tint) !important;}'
      + '.fm-on .fm-tn,.fm-on .fm-sl{color:var(--t1);}'
      + '.fm-meta{font-size:11px;color:var(--t3);line-height:1.5;}'
      + '.fm-feeder{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--input);border:1px solid var(--b-edge);border-radius:var(--r2);padding:11px 15px;font-size:11.5px;color:var(--t3);line-height:1.55;cursor:pointer;transition:background .12s;}'
      + '.fm-feeder:hover{background:#16242E;}'
      + '</style>';
  },

  goTo(go, action) {
    if (action === 'hub')    return App.showHub();
    if (action === 'audit')  return (window.S && S.HubBarCopAudit) ? S.HubBarCopAudit.open() : null;
    if (action === 'books')  return (window.S && S.HubBooks) ? S.HubBooks.open() : null;
    if (action === 'review') return (window.S && S.WeekReview) ? S.WeekReview.open() : null;
    if (go) return App.openScreen(go);
  }
};
