'use strict';

/* ── Hub Getting Started — the unified whole-app setup checklist ──────────────
   A Hub-owned view (map Section 1, Section 9). One ordered, checkable setup
   plan across all six modules: the Capture layer first (Inventory, Labor,
   Shift), then the Diagnose layer (Profit, Revenue, Traffic). Progress is
   stored in hub_setup_progress. Each task deep-links to the screen that does
   it. Renders into the Hub container, never the module app shell. */
S.HubGettingStarted = {

  _open: {},

  // Four-phase setup: Foundation makes the numbers honest, Baseline Diagnosis
  // gives the operator a scored picture on day one without needing any Control
  // data, Capture System builds the operational engine that feeds live metrics,
  // and Weekly Work is the recurring operational rhythm from then on.
  GROUPS: [
    { id:'foundation', title:'Foundation' },
    { id:'baseline',   title:'Baseline Diagnosis' },
    { id:'capture',    title:'Capture System' },
    { id:'weekly',     title:'Weekly Work' }
  ],

  TASKS: [
    // ── Phase 1: Foundation ──────────────────────────────────────────────
    { group:'foundation', id:'gs_profile', screen:'settings',
      label:'Set your operation profile in Settings: bar name, location, and annual bar and food revenue.' },
    { group:'foundation', id:'gs_targets', screen:'settings',
      label:'Set your Profit, Revenue, and Traffic targets in Settings. Industry benchmarks are pre-filled; adjust them to your operation.' },

    // ── Phase 2: Baseline Diagnosis — three audits give immediate scored value
    { group:'baseline', id:'gs_p_audit', screen:'audit-tracker',
      label:'Run your first Profit Audit for a baseline score.' },
    { group:'baseline', id:'gs_r_audit', screen:'r-audit',
      label:'Run your first Revenue Audit for a baseline score.' },
    { group:'baseline', id:'gs_t_audit', screen:'t-audit',
      label:'Run your first Traffic Audit for a baseline score.' },

    // ── Phase 3: Capture System — operational setup. Control feeds Recovery.
    { group:'capture', id:'gs_ic_products', screen:'ic-product-setup',
      label:'Add your bar and kitchen products in Inventory Control. This is the product master the whole platform reads.' },
    { group:'capture', id:'gs_ic_locations', screen:'ic-locations',
      label:'Set your storage locations, then add your vendors.' },
    { group:'capture', id:'gs_ic_count', screen:'ic-take-inventory',
      label:'Run your first inventory count in Take Inventory.' },
    { group:'capture', id:'gs_ic_delivery', screen:'ic-receive-delivery',
      label:'Receive your first delivery so vendor pricing starts tracking.' },
    { group:'capture', id:'gs_lc_positions', screen:'lc-positions',
      label:'Set up your positions and wage rates in Labor Control.' },
    { group:'capture', id:'gs_lc_roster', screen:'lc-staff-roster',
      label:'Add every staff member to the Staff Roster.' },
    { group:'capture', id:'gs_lc_schedule', screen:'lc-build-schedule',
      label:'Build your first weekly schedule in Build Schedule.' },
    { group:'capture', id:'gs_lc_hours', screen:'lc-log-hours',
      label:'Log a week of actual hours in Log Hours.' },
    { group:'capture', id:'gs_sc_checklists', screen:'sc-checklist-templates',
      label:'Set your opening and closing checklist templates in Shift Control.' },
    { group:'capture', id:'gs_sc_shift', screen:'sc-log-shift',
      label:'Log your first shift. Shift revenue and covers feed Profit and Revenue Recovery.' },
    { group:'capture', id:'gs_sc_cash', screen:'sc-cash-drop',
      label:'Record a cash drop and a drawer count so cash data starts flowing.' },

    // ── Phase 4: Weekly Work — the operational rhythm from week one onward
    { group:'weekly', id:'gs_p_week', screen:'this-week',
      label:'Confirm your first week in Profit This Week. Most figures auto-fill from your Control modules.' },
    { group:'weekly', id:'gs_p_recipes', screen:'recipe-library',
      label:'Cost your top recipes in Recipe Library.' },
    { group:'weekly', id:'gs_p_fix', screen:'profit-fix',
      label:'Open Profit Fix and walk the fix process for your biggest gap area.' },
    { group:'weekly', id:'gs_r_menu', screen:'r-menu-items',
      label:'Add your menu items and pricing in Menu Items.' },
    { group:'weekly', id:'gs_r_week', screen:'r-this-week',
      label:'Confirm your first week in Revenue This Week.' },
    { group:'weekly', id:'gs_r_eng', screen:'r-menu-engineering',
      label:'Run Menu Engineering to see your Stars, Plowhorses, Puzzles, and Dogs.' },
    { group:'weekly', id:'gs_t_gbp', screen:'t-gbp',
      label:'Audit your Google Business Profile in the GBP section.' },
    { group:'weekly', id:'gs_t_reviews', screen:'t-reviews',
      label:'Log your current ratings and review counts in Review Tracker.' },
    { group:'weekly', id:'gs_t_week', screen:'t-this-week',
      label:'Enter your first week of digital metrics in Traffic This Week.' }
  ],

  progress() { return App.data.hub_setup_progress || {}; },

  // Open the Getting Started view inside the Hub container. Mirrors App.showHub().
  open() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('ob-overlay').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
    let wrap = document.getElementById('hub-wrapper');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'hub-wrapper';
      wrap.style.cssText = 'position:fixed;inset:0;overflow-y:auto;background:var(--bg);z-index:100;';
      document.body.appendChild(wrap);
    }
    wrap.style.display = 'block';
    // The Hub leaves hub-wrapper at overflowY:hidden (fixed-viewport dashboard).
    // This view scrolls, so restore it whenever the wrapper is reused.
    wrap.style.overflowY = 'auto';
    this.render(wrap);
  },

  render(container) {
    const prog  = this.progress();
    const total = this.TASKS.length;
    const done  = this.TASKS.filter(t => prog[t.id]).length;
    const pct   = total ? Math.round(done / total * 100) : 0;

    const groups = this.GROUPS.map(g => {
      const tasks = this.TASKS.filter(t => t.group === g.id);
      if (!tasks.length) return '';
      const gDone = tasks.filter(t => prog[t.id]).length;
      const open  = !!this._open[g.id];
      const rows = tasks.map(t => {
        const d = !!prog[t.id];
        return '<div style="display:flex;align-items:flex-start;gap:12px;padding:11px 0;border-bottom:1px solid var(--b2);">'
          + '<input type="checkbox" class="gs-chk" data-id="' + esc(t.id) + '"' + (d ? ' checked' : '')
          + ' style="margin-top:2px;flex-shrink:0;accent-color:var(--gold);width:16px;height:16px;cursor:pointer;"/>'
          + '<div style="flex:1;font-size:12px;line-height:1.55;color:' + (d ? 'var(--t3)' : 'var(--t1)') + ';'
          + (d ? 'text-decoration:line-through;' : '') + '">' + esc(t.label) + '</div>'
          + '<button class="btn btn-ghost btn-sm gs-go" data-screen="' + esc(t.screen) + '" style="flex-shrink:0;font-size:10px;padding:4px 10px;">Go</button>'
          + '</div>';
      }).join('');
      const allDone = gDone === tasks.length;
      return '<div class="hg-card" data-group="' + g.id + '" style="background:var(--surface);border:1px solid var(--b1);border-radius:4px;margin-bottom:10px;overflow:hidden;">'
        + '<div class="hg-head" style="display:flex;align-items:center;gap:12px;padding:15px 20px;cursor:pointer;">'
        +   '<div style="flex:1;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--t1);">' + esc(g.title) + '</div>'
        +   '<div style="font-size:11px;font-weight:700;color:' + (allDone ? 'var(--gold)' : 'var(--t3)') + ';">' + gDone + ' / ' + tasks.length + '</div>'
        +   '<span class="hg-chev" style="font-size:13px;color:var(--t3);transition:transform .15s;transform:rotate(' + (open ? '90' : '0') + 'deg);">&#9656;</span>'
        + '</div>'
        + '<div class="hg-body" style="display:' + (open ? 'block' : 'none') + ';padding:2px 20px 14px;border-top:1px solid var(--b2);">' + rows + '</div>'
        + '</div>';
    }).join('');

    container.scrollTop = container.scrollTop || 0;
    container.innerHTML =
      '<div style="max-width:880px;margin:0 auto;padding:0 24px 64px;">'
      + '<div style="display:flex;align-items:center;gap:14px;padding:20px 0 16px;position:sticky;top:0;background:var(--bg);z-index:5;border-bottom:1px solid var(--b2);margin-bottom:18px;">'
      +   '<button id="hg-back" class="btn btn-ghost btn-sm">&#8592; Back to Hub</button>'
      +   '<div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--w);">Getting Started</div>'
      + '</div>'
      + '<div class="card" style="margin-bottom:18px;">'
      +   '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'
      +     '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Setup Progress, All Six Modules</div>'
      +     '<div style="font-size:18px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;color:' + (pct===100?'var(--gold)':'var(--w)') + ';">' + pct + '%</div>'
      +   '</div>'
      +   '<div class="prog"><div class="prog-fill" style="width:' + pct + '%;"></div></div>'
      +   (pct===100
            ? '<div style="font-size:12px;color:var(--gold);font-weight:700;margin-top:12px;">Setup complete. Every module is configured and feeding Bar Cop.</div>'
            : '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-top:10px;">Work top to bottom. Each phase builds on the one above it.</div>')
      + '</div>'
      + groups
      + '</div>';

    document.getElementById('hg-back').addEventListener('click', () => App.showHub());

    container.querySelectorAll('.hg-head').forEach(head => {
      head.addEventListener('click', () => {
        const card  = head.closest('.hg-card');
        const id    = card.dataset.group;
        const body  = head.nextElementSibling;
        const chev  = head.querySelector('.hg-chev');
        const isOpen = body.style.display !== 'none';
        this._open[id] = !isOpen;
        body.style.display = isOpen ? 'none' : 'block';
        if (chev) chev.style.transform = 'rotate(' + (isOpen ? '0' : '90') + 'deg)';
      });
    });
    container.querySelectorAll('.gs-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        const p = this.progress();
        if (chk.checked) p[chk.dataset.id] = new Date().toISOString();
        else delete p[chk.dataset.id];
        App.data.hub_setup_progress = p;
        App.saveKey('hub_setup_progress').then(() => this.render(container));
      });
    });
    container.querySelectorAll('.gs-go').forEach(btn => {
      btn.addEventListener('click', () => App.openScreen(btn.dataset.screen));
    });
  }
};
