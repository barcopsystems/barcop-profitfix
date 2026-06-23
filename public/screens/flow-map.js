'use strict';

/* ── Blueprint — interactive map of how data moves through Bar Cop ──────────────
   A Hub-level full page (top-nav link right of The Hub). Plots the app as a
   left-to-right flow: Control captures, This Week rolls it up, Recovery + the
   Bar Cop Audit diagnose, the Fix Process + Recovery Scoreboard close and
   measure, and the Hub + Accounting report. Tap a node to see exactly what
   feeds it and what it feeds.

   The NODES/EDGES below are the single source of truth; the layout + detail
   panel derive from them. */

S.FlowMap = {
  _sel: null,

  LAYERS: [
    { key: 'control',  title: 'Capture' },
    { key: 'weekly',   title: 'Weekly' },
    { key: 'diagnose', title: 'Diagnose' },
    { key: 'plan',     title: 'Plan' },
    { key: 'fix',      title: 'Fix & Measure' },
    { key: 'report',   title: 'Report' }
  ],

  NODES: [
    { id: 'inventory', label: 'Inventory', full: 'Inventory Control', layer: 'control', go: 'ic-dashboard',
      what: 'Captures counts, products, deliveries, spot checks, adjustments, and your vendor records. The data source for every cost and theft signal on the bar side.' },
    { id: 'labor', label: 'Labor', full: 'Labor Control', layer: 'control', go: 'lc-dashboard',
      what: 'Captures the schedule, logged hours, wages, and tips. The data source for labor cost and the payroll worksheet.' },
    { id: 'shift', label: 'Shift', full: 'Shift Control', layer: 'control', go: 'sc-dashboard',
      what: 'Captures each shift: revenue, cash drops, drawer variances, voids and comps, checklists. The data source for sales and most theft signals.' },
    { id: 'events', label: 'Events', full: 'Events', layer: 'control', go: 'ev-dashboard',
      what: 'Captures bookings, catering, and your event regulars. A forward-looking feeder, not a diagnose loop: it pushes confirmed business into the week and the Revenue Audit.' },
    { id: 'this-week', label: 'This Week', full: 'This Week (Weekly P&L)', layer: 'weekly', go: 'this-week',
      what: 'Rolls the week up from Control into one P&L: revenue from Shift, COGS from Inventory, labor from Labor. The hub every weekly number flows out of.' },
    { id: 'profit', label: 'Profit', full: 'Profit Recovery', layer: 'diagnose', go: 'dashboard',
      what: 'Diagnoses where margin leaks: pour cost, food cost, theft and loss, vendor control, prime cost. Runs the Profit Audit and the leak board off Control plus This Week.' },
    { id: 'revenue', label: 'Revenue', full: 'Revenue Recovery', layer: 'diagnose', go: 'r-dashboard',
      what: 'Diagnoses the top line: check average, menu engineering, pricing, and labor productivity.' },
    { id: 'traffic', label: 'Traffic', full: 'Traffic Recovery', layer: 'diagnose', go: 't-dashboard',
      what: 'Diagnoses online demand: reviews, Google Business, website, social, delivery, and email. It reads your weekly online numbers and screenshots rather than Control data, so nothing upstream feeds it.' },
    { id: 'bca', label: 'Bar Cop Audit', full: 'Bar Cop Audit', layer: 'diagnose', action: 'audit',
      what: 'The cross-system score. Reads all three Control sections and grades six areas: operational discipline, cash integrity, inventory execution, labor hygiene, recovery action, and operational consistency.' },
    { id: 'profit-playbook', label: 'Profit Playbook', full: 'Profit Playbook', layer: 'plan', go: 'recovery-playbook',
      what: 'The strategic read for Profit Recovery, sitting between the Profit Audit and the Profit Fix. Where margin leaks (pour cost, food cost, theft, vendor, prime), what each leak costs, and a link straight into the screen that fixes it. One of three: every Recovery section has its own.' },
    { id: 'revenue-playbook', label: 'Revenue Playbook', full: 'Revenue Playbook', layer: 'plan', go: 'r-playbook',
      what: 'The strategic read for Revenue Recovery, between the Revenue Audit and the Revenue Fix. Where the top line leaks (menu, pricing, labor productivity, check average) and the screen that closes each gap.' },
    { id: 'traffic-playbook', label: 'Traffic Playbook', full: 'Traffic Playbook', layer: 'plan', go: 't-playbook',
      what: 'The strategic read for Traffic Recovery, between the Traffic Audit and the Traffic Fix. Where your online presence leaks the guests already searching (Google Business, website, reviews, search, social, delivery, email) and the screen that closes each gap.' },
    { id: 'fix', label: 'Fix Process', full: 'The Fix Process', layer: 'fix', go: 'profit-fix',
      what: 'Turns each diagnosed gap into an ordered set of steps that deep-link into the exact screen that does the work. Mark a fix implemented to start measuring it.' },
    { id: 'scoreboard', label: 'Scoreboard', full: 'Recovery Scoreboard', layer: 'fix', go: 'dashboard',
      what: 'Measures what each fix actually recovered: the weekly metric for that gap, eight weeks before versus after the fix date. Realized dollars only, never a projection.' },
    { id: 'hub', label: 'Hub', full: 'Hub Dashboard', layer: 'report', action: 'hub',
      what: 'The cross-system home. Surfaces the total recovered, the Bar Cop Audit score, and the top exposures across every section.' },
    { id: 'books', label: 'Books', full: 'Accounting / Books', layer: 'report', action: 'books',
      what: 'Month-end Books, Year-End Review, and the Weekly P&L Brief. Built from This Week, labor and tips, operating expenses, and permits.' }
  ],

  EDGES: [
    { from: 'inventory', to: 'this-week', desc: 'Weekly counts plus deliveries between them become bar and food COGS on This Week.' },
    { from: 'inventory', to: 'profit',    desc: 'Counts feed Variance; deliveries and prices feed Vendor Tracker and Recipe Summary; spot checks and theft adjustments feed Loss Prevention.' },
    { from: 'inventory', to: 'revenue',   desc: 'Product prices cost out every menu item recipe in Revenue Recovery.' },
    { from: 'inventory', to: 'bca',       desc: 'Counts, spot checks, and discrepancies feed the audit inventory execution and theft sub-scores.' },
    { from: 'labor', to: 'this-week',     desc: 'Logged hours, costed and split bar versus food, become the labor line.' },
    { from: 'labor', to: 'revenue',       desc: 'Hours against revenue drive labor cost percent and revenue per labor hour.' },
    { from: 'labor', to: 'books',         desc: 'Hours and tips feed the payroll worksheet, the tip credit, and Form 8027.' },
    { from: 'labor', to: 'bca',           desc: 'Schedules and actual hours feed the audit labor sub-score.' },
    { from: 'shift', to: 'this-week',     desc: 'Each shift logged revenue is summed for the week.' },
    { from: 'shift', to: 'revenue',       desc: 'Logged covers and sales drive check average and the Server Check scorecard.' },
    { from: 'shift', to: 'profit',        desc: 'Cash drops and drawer variances feed Over and Short; voids, comps, and cash variance feed Loss Prevention.' },
    { from: 'shift', to: 'bca',           desc: 'Cash variances, voids and comps, and checklist completion feed the audit.' },
    { from: 'events', to: 'this-week',    desc: 'Offsite catering revenue flows into the week as its own line, counted once so it never doubles an onsite event already rung through Shift.' },
    { from: 'events', to: 'revenue',      desc: 'Booked events and your close rate feed the Revenue Audit events section.' },
    { from: 'this-week', to: 'profit',    desc: 'The saved week powers the Profit dashboard, the eight-week trend, and the live cost percentages.' },
    { from: 'this-week', to: 'scoreboard',desc: 'Weekly pour, food, and prime cost are the metrics the Scoreboard measures fixes against.' },
    { from: 'this-week', to: 'books',     desc: 'Weekly revenue, COGS, and labor feed Books and the Weekly P&L Brief.' },
    { from: 'profit', to: 'profit-playbook',   desc: 'The Profit Audit flags the gaps; the Profit Playbook is the strategic read on pour cost, food cost, theft, vendor, and prime that sits between the audit and the fix.' },
    { from: 'revenue', to: 'revenue-playbook', desc: 'The Revenue Audit flags the gaps; the Revenue Playbook is the strategic read on menu, pricing, labor, and check average.' },
    { from: 'traffic', to: 'traffic-playbook', desc: 'The Traffic Audit flags the gaps; the Traffic Playbook is the strategic read on Google Business, website, reviews, search, social, delivery, and email.' },
    { from: 'profit-playbook', to: 'fix',      desc: 'Its Go-to buttons open the Profit Fix to close each gap, plus the capture screens that feed it.' },
    { from: 'revenue-playbook', to: 'fix',     desc: 'Its Go-to buttons open the Revenue Fix to close each gap, plus the screens that feed it.' },
    { from: 'traffic-playbook', to: 'fix',     desc: 'Its Go-to buttons open the Traffic Fix to close each gap, plus the screens that feed it.' },
    { from: 'fix', to: 'scoreboard',      desc: 'Marking a fix implemented stamps the date and starts the eight-week before-and-after measurement.' },
    { from: 'scoreboard', to: 'hub',      desc: 'Recovered dollars across all three Recovery sections roll up to the Hub.' },
    { from: 'bca', to: 'hub',             desc: 'The Bar Cop Audit score and top exposures surface on the Hub Dashboard.' }
  ],

  open() {
    App.openHubFullPage('Blueprint', (mount) => {
      this.container = mount;
      this._sel = null;
      this._scrollLeft = 0;
      this.render();
    }, 'flowmap');
  },

  render() {
    const NODES = this.NODES, EDGES = this.EDGES, LAYERS = this.LAYERS;
    const W = 1280, H = 600, NW = 132, NH = 52, top = 70, usable = H - top - 24;
    const colX = c => 36 + c * 208;

    const pos = {};
    LAYERS.forEach((L, ci) => {
      const list = NODES.filter(n => n.layer === L.key);
      const slot = usable / list.length;
      list.forEach((node, i) => {
        pos[node.id] = { x: colX(ci), y: top + i * slot + (slot - NH) / 2 };
      });
    });

    const sel = this._sel;
    const connected = new Set();
    if (sel) {
      connected.add(sel);
      EDGES.forEach(e => { if (e.from === sel) connected.add(e.to); if (e.to === sel) connected.add(e.from); });
    }

    const edgeEls = EDGES.map(e => {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) return '';
      const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, dx = (x2 - x1) * 0.45;
      const active = sel && (e.from === sel || e.to === sel);
      const dim = sel && !active;
      const col = active ? '#DBAB46' : 'rgba(255,255,255,0.16)';
      return '<path d="M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' C' + (x1 + dx).toFixed(1) + ' ' + y1.toFixed(1)
        + ', ' + (x2 - dx).toFixed(1) + ' ' + y2.toFixed(1) + ', ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + '" '
        + 'fill="none" stroke="' + col + '" stroke-width="' + (active ? 2.2 : 1.2) + '" opacity="' + (dim ? '0.07' : '1') + '"/>';
    }).join('');

    const colTitles = LAYERS.map((L, ci) =>
      '<text x="' + (colX(ci) + NW / 2) + '" y="34" text-anchor="middle" fill="#5F7280" font-family="Barlow,system-ui,sans-serif" font-size="10" font-weight="700" letter-spacing="1.5">'
      + esc(L.title.toUpperCase()) + '</text>').join('');

    const nodeEls = NODES.map(n => {
      const p = pos[n.id], isSel = sel === n.id, dim = sel && !connected.has(n.id);
      const fill = isSel ? '#1E2B34' : '#070E15';
      const stroke = '#16252E';
      return '<g class="fm-node" data-node="' + n.id + '" style="cursor:pointer;opacity:' + (dim ? '0.28' : '1') + ';">'
        + '<rect x="' + p.x + '" y="' + p.y.toFixed(1) + '" width="' + NW + '" height="' + NH + '" rx="8" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1"/>'
        + '<text x="' + (p.x + NW / 2) + '" y="' + (p.y + NH / 2 + 4).toFixed(1) + '" text-anchor="middle" fill="#E8EDF0" font-family="Barlow,system-ui,sans-serif" font-size="12.5" font-weight="600">'
        + esc(n.label) + '</text></g>';
    }).join('');

    const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;min-width:760px;overflow:visible;">'
      + edgeEls + colTitles + nodeEls + '</svg>';

    this.container.innerHTML = '<style>.fm-node{transition:opacity .12s;}.fm-node:hover{opacity:1 !important;}.fm-node:hover text{fill:#fff;}</style>'
      + '<div class="screen" style="max-width:none;">'
      + '<div class="card fm-scroll" style="padding:16px 18px;margin-bottom:14px;overflow-x:auto;">' + svg + '</div>'
      + this.panelHtml(sel)
      + '</div>';

    // Re-render rebuilds the card, which resets its horizontal scroll. Restore the
    // position captured on click so tapping a node does not jump you back to the left.
    const scroller = this.container.querySelector('.fm-scroll');
    if (scroller && this._scrollLeft) scroller.scrollLeft = this._scrollLeft;

    this.container.querySelectorAll('.fm-node').forEach(g =>
      g.addEventListener('click', () => {
        const sc = this.container.querySelector('.fm-scroll');
        this._scrollLeft = sc ? sc.scrollLeft : 0;
        this._sel = (this._sel === g.dataset.node) ? null : g.dataset.node;
        this.render();
      }));
    const goBtn = this.container.querySelector('#fm-go');
    if (goBtn) goBtn.addEventListener('click', () => this.goTo(goBtn.dataset.go, goBtn.dataset.action));
  },

  panelHtml(sel) {
    if (!sel) {
      return '<div class="card form-card"><div class="card-title">How your data flows</div>'
        + '<div style="font-size:13px;color:var(--t2);line-height:1.7;">Tap any box above to see exactly what feeds it and what it feeds. Bar Cop runs in three moves: your Control sections <strong>capture</strong> the data, Recovery and the Bar Cop Audit <strong>diagnose</strong> where the money is leaking, and the Fix Process <strong>closes</strong> the gaps while the Recovery Scoreboard measures what came back.</div>'
        + '<div style="margin-top:14px;font-size:12px;color:var(--t3);line-height:1.8;"><strong style="color:var(--t2);">Capture</strong> is your Control sections, Inventory, Labor, and Shift, plus Events. <strong style="color:var(--t2);">Weekly</strong> is This Week, which rolls them into your P&L. <strong style="color:var(--t2);">Diagnose</strong> is the three Recovery sections plus the Bar Cop Audit. <strong style="color:var(--t2);">Fix &amp; Measure</strong> is the Fix Process and the Recovery Scoreboard. <strong style="color:var(--t2);">Report</strong> is the Hub Dashboard and Accounting.</div>'
        + '</div>';
    }
    const n = this.NODES.find(x => x.id === sel);
    if (!n) return '';
    const nameOf = id => { const x = this.NODES.find(y => y.id === id); return x ? (x.full || x.label) : id; };
    const feeds = this.EDGES.filter(e => e.from === sel).map(e => ({ name: nameOf(e.to), desc: e.desc }));
    const fedBy = this.EDGES.filter(e => e.to === sel).map(e => ({ name: nameOf(e.from), desc: e.desc }));
    const flowList = (arr, arrow) => arr.length
      ? arr.map(f => '<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--b2);">'
          + '<span style="color:var(--gold);flex-shrink:0;font-weight:700;">' + arrow + '</span>'
          + '<div><div style="font-size:12px;font-weight:600;color:var(--t1);">' + esc(f.name) + '</div>'
          + '<div style="font-size:11px;color:var(--t3);line-height:1.55;margin-top:2px;">' + esc(f.desc) + '</div></div></div>').join('')
      : '<div style="font-size:12px;color:var(--t3);padding:6px 0;">Nothing yet.</div>';
    const goBtn = (n.go || n.action)
      ? '<button class="btn btn-primary" id="fm-go" data-go="' + esc(n.go || '') + '" data-action="' + esc(n.action || '') + '" style="margin-top:16px;">Go to ' + esc(n.full || n.label) + '</button>'
      : '';
    // Only show a Feeds / Fed by section when it actually has connections: an
    // origin (Control / Events) has no inputs, a terminal (Hub / Books) has no
    // outputs, so an empty side is structural, not "not wired yet."
    const feedsSec = feeds.length ? '<div class="sh" style="margin:0 0 4px;">Feeds</div>' + flowList(feeds, '→') : '';
    const fedBySec = fedBy.length ? '<div class="sh" style="margin:' + (feeds.length ? '18px' : '0') + ' 0 4px;">Fed by</div>' + flowList(fedBy, '←') : '';
    return '<div class="card form-card"><div class="card-title">' + esc(n.full || n.label) + '</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.7;margin-bottom:16px;">' + esc(n.what) + '</div>'
      + feedsSec + fedBySec
      + goBtn + '</div>';
  },

  goTo(go, action) {
    if (action === 'hub')   return App.showHub();
    if (action === 'audit') return (window.S && S.HubBarCopAudit) ? S.HubBarCopAudit.open() : null;
    if (action === 'books') return (window.S && S.HubBooks) ? S.HubBooks.open() : null;
    if (go) return App.openScreen(go);
  }
};
