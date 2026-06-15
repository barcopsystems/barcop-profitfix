'use strict';

/* ── Profit Fix — the Profit Recovery Fix System (verified, monitored) ─────────
   A fix is not a checklist you finish, it is a system you put in place and then
   keep running. So Bar Cop does not ask the operator to tick boxes and take their
   word for it. For every step that maps to real work, it reads the actual Control
   data and shows whether the work is happening:
     • Setup steps  — verified by state (comp threshold set, recipe cards built,
       product costs entered). In place, or not.
     • Watched steps — verified by the records flowing in (counts, drawer
       reconciliations, voids and comps, deliveries, spot checks, waste). On
       track, slipping, behind, or not started. You cannot fake a logged drawer.
     • Guidance steps — the policies, coaching, and reviews Bar Cop genuinely
       cannot see. Shown as do-this, never counted as proof.
   A leak reads Running only while its watched work keeps flowing; it drops back
   to Slipping or At risk on its own. Locking in the date you put the system in
   place lets Bar Cop measure what it wins back. Profit only for now.
   Verification map lives here; the fix content stays in fix-profit.js. */

const PF_GOLD  = '#DBAB46';
const PF_GREEN = '#518A79';   // matches --green / the "Running" status text
const PF_TRACK = '#0D181E';
const PF_DIM   = '#1B2630';
const PF_TXT   = '#C9D3DA';

S.ProfitFix = {
  _workGap: null,

  // Which steps Bar Cop can verify, keyed by gap id then step index. Steps not
  // listed are guidance (no status, not counted). maxDays = the window a watched
  // step stays On track; up to 2x is Slipping; beyond is Behind.
  TRACK: {
    'pour-cost':      { 0: { kind: 'setup', key: 'yields' }, 1: { kind: 'recur', signal: 'count', maxDays: 9, every: 'every week' }, 2: { kind: 'recur', signal: 'view:dashboard', maxDays: 9, every: 'every week' }, 3: { kind: 'recur', signal: 'variancereport', maxDays: 12, every: 'every week' }, 5: { kind: 'recur', signal: 'week', maxDays: 9, every: 'every week' } },
    'theft-loss':     { 1: { kind: 'recur', signal: 'voidcomp', maxDays: 4, every: 'every shift' }, 2: { kind: 'setup', key: 'comp_threshold' }, 3: { kind: 'recur', signal: 'drawer', maxDays: 3, every: 'every shift' }, 4: { kind: 'recur', signal: 'delivery', maxDays: 10, every: 'every delivery' }, 5: { kind: 'recur', signal: 'spotcheck', maxDays: 7, every: 'a couple times a week' }, 6: { kind: 'recur', signal: 'view:theft-risk', maxDays: 9, every: 'every week' } },
    'food-cost':      { 0: { kind: 'setup', key: 'recipes' }, 1: { kind: 'recur', signal: 'count', maxDays: 9, every: 'every week' }, 2: { kind: 'recur', signal: 'view:dashboard', maxDays: 9, every: 'every week' }, 3: { kind: 'recur', signal: 'waste', maxDays: 4, every: 'every shift' }, 7: { kind: 'recur', signal: 'week', maxDays: 9, every: 'every week' }, 8: { kind: 'state', key: 'reprice' } },
    'vendor-control': { 0: { kind: 'recur', signal: 'order', maxDays: 14, every: 'every order you place' }, 1: { kind: 'recur', signal: 'delivery', maxDays: 10, every: 'every delivery' }, 4: { kind: 'state', key: 'chase' }, 5: { kind: 'recur', signal: 'view:vendor-tracker', maxDays: 35, every: 'once a month' }, 6: { kind: 'recur', signal: 'view:vendor-tracker', maxDays: 95, every: 'once a quarter' } },
    'prime-cost':     { 0: { kind: 'recur', signal: 'week', maxDays: 9, every: 'every week' }, 1: { kind: 'recur', signal: 'view:dashboard', maxDays: 9, every: 'every week' }, 4: { kind: 'recur', signal: 'view:weekly-pnl', maxDays: 9, every: 'every week' }, 5: { kind: 'recur', signal: 'view:books', maxDays: 35, every: 'once a month' } }
  },

  gaps() { return (window.FIX && Array.isArray(FIX.profit)) ? FIX.profit : []; },
  gap(id) { return this.gaps().find(g => g.id === id) || null; },
  steps(g) { return (g && g.process && g.process.steps) || []; },
  fixLog() { return (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : []; },
  loggedDate(id) { const e = this.fixLog().filter(x => x.gap_id === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]; return e ? e : null; },
  docPath(file) { return 'assets/resources/' + encodeURIComponent(file); },

  // ── Verification ────────────────────────────────────────────────────────────
  SIGNALS: {
    count:     () => (App.inventoryData && App.inventoryData.ic_counts)      || [],
    voidcomp:  () => (App.shiftData     && App.shiftData.sc_void_comps)       || [],
    drawer:    () => (App.shiftData     && App.shiftData.sc_variances)        || [],
    delivery:  () => (App.inventoryData && App.inventoryData.ic_deliveries)   || [],
    spotcheck: () => (App.inventoryData && App.inventoryData.ic_spot_checks)  || [],
    variancereport: () => (App.inventoryData && App.inventoryData.ic_variance_runs) || [],
    order:     () => (App.inventoryData && App.inventoryData.ic_orders)       || [],
    waste:     () => (App.shiftData     && App.shiftData.sc_waste)            || [],
    week:      () => (App.data          && App.data.weeks)                    || []
  },
  lastActivity(signal) {
    if (signal && signal.indexOf('view:') === 0) {
      const v = (App.data && App.data.fix_views) || {};
      return v[signal.slice(5)] || null;
    }
    const arr = (this.SIGNALS[signal] || (() => []))();
    let latest = null;
    arr.forEach(r => {
      const d = r.period_end || r.date || (r.run_at ? String(r.run_at).slice(0, 10) : '') || (r.created_at ? String(r.created_at).slice(0, 10) : '');
      if (d && (!latest || d > latest)) latest = String(d).slice(0, 10);
    });
    return latest;
  },
  // Earliest record for a signal (when the work first happened).
  firstActivity(signal) {
    if (signal && signal.indexOf('view:') === 0) return this.lastActivity(signal);
    const arr = (this.SIGNALS[signal] || (() => []))();
    let earliest = null;
    arr.forEach(r => {
      const d = r.period_end || r.date || (r.run_at ? String(r.run_at).slice(0, 10) : '') || (r.created_at ? String(r.created_at).slice(0, 10) : '');
      if (d) { const ds = String(d).slice(0, 10); if (!earliest || ds < earliest) earliest = ds; }
    });
    return earliest;
  },
  // The day the system started: the first real (data, not view) tracked action
  // for the gap. Auto-derived, never asked for.
  firstAction(g) {
    const t = this.TRACK[g.id] || {};
    let first = null;
    Object.keys(t).forEach(k => {
      const cfg = t[k];
      if (cfg.kind !== 'recur' || (cfg.signal && cfg.signal.indexOf('view:') === 0)) return;
      const d = this.firstActivity(cfg.signal);
      if (d && (!first || d < first)) first = d;
    });
    return first;
  },
  // Auto-start: the moment a gap has its first tracked action, log the start
  // date (= that action) so Bar Cop measures from there. No manual button.
  _autoStart() {
    if (!App.data) return;
    if (!Array.isArray(App.data.fix_log)) App.data.fix_log = [];
    this.gaps().forEach(g => {
      if (this.fixLog().some(e => e.gap_id === g.id)) return;
      const start = this.firstAction(g);
      if (!start) return;
      App.putRecord('core', 'fix_log', { id: App.uid(), module: 'profit', gap_id: g.id, gap_name: g.name, date: start, logged_at: new Date().toISOString(), auto: true });
      if (App.markSetupDone) App.markSetupDone('gs_p_fix');
    });
  },
  daysSince(d) {
    if (!d) return null;
    const a = new Date(d + 'T00:00:00').getTime();
    const b = new Date(App.todayLocal() + 'T00:00:00').getTime();
    return Math.max(0, Math.floor((b - a) / 86400000));
  },
  agoText(ds) { return ds === 0 ? 'today' : ds === 1 ? 'yesterday' : ds + ' days ago'; },
  setupState(key) {
    if (key === 'yields') {
      const p = (App.inventoryData && App.inventoryData.ic_products) || [];
      return p.length > 0 && p.some(x => (parseFloat(x.unit_cost) || parseFloat(x.cost) || 0) > 0);
    }
    if (key === 'recipes') {
      const m = (App.data && App.data.menu_items) || [];
      return m.some(x => x.recipe && Array.isArray(x.recipe.ingredients) && x.recipe.ingredients.length > 0);
    }
    if (key === 'comp_threshold') return (parseFloat(App.data && App.data.settings && App.data.settings.comp_auth_threshold) || 0) > 0;
    return false;
  },

  // State checks: "good" means no outstanding work right now.
  repriceOver() {
    const items = (App.data && App.data.menu_items) || [];
    let over = 0;
    items.forEach(i => {
      const hasRecipe = i.recipe && Array.isArray(i.recipe.ingredients) && i.recipe.ingredients.length > 0;
      if (!hasRecipe || !(i.price > 0)) return;
      const cost = (App.menuItemCost ? App.menuItemCost(i) : 0) || 0;
      const tgt = i.target_cost_pct || (App.MENU_TARGET_COST_PCT ? (i.recipe.mode === 'food' ? App.MENU_TARGET_COST_PCT.plate : App.MENU_TARGET_COST_PCT.cocktail) : 0) || 0;
      if (tgt > 0 && (cost / i.price * 100) > tgt) over++;
    });
    return over;
  },
  chaseOpen() {
    const d = (App.data && App.data.vendor_discrepancies) || [];
    return d.filter(x => x && x.status !== 'Resolved').length;
  },

  // Status for one step → {kind, good, label, color, sub} or {kind:'guide'}.
  stepStatus(gapId, idx) {
    const t = (this.TRACK[gapId] || {})[idx];
    if (!t) return { kind: 'guide' };
    if (t.kind === 'setup') {
      const ok = this.setupState(t.key);
      return { kind: 'setup', good: ok, label: ok ? 'In place' : 'Set this up', color: ok ? 'var(--green)' : 'var(--amber)' };
    }
    if (t.kind === 'state') {
      const n = t.key === 'reprice' ? this.repriceOver() : t.key === 'chase' ? this.chaseOpen() : 0;
      const good = n === 0;
      let label, sub;
      if (t.key === 'reprice') { label = good ? 'All at target' : n + (n === 1 ? ' item over target' : ' items over target'); sub = good ? '' : 'Reprice or re-cost them'; }
      else { label = good ? 'No open claims' : n + (n === 1 ? ' open claim' : ' open claims'); sub = good ? '' : 'Chase the credit'; }
      return { kind: 'state', good, state: good ? 'clear' : 'open', label, color: good ? 'var(--green)' : 'var(--amber)', sub };
    }
    const last = this.lastActivity(t.signal);
    const ds = this.daysSince(last);
    if (ds == null) return { kind: 'recur', good: false, never: true, state: 'never', label: 'Not started', color: 'var(--t3)', sub: 'No record yet, ' + t.every };
    let state, label, color;
    if (ds <= t.maxDays)        { state = 'ontrack';  label = 'On track'; color = 'var(--green)'; }
    else if (ds <= t.maxDays * 2) { state = 'slipping'; label = 'Slipping'; color = 'var(--amber)'; }
    else                        { state = 'behind';   label = 'Behind';   color = 'var(--red)'; }
    return { kind: 'recur', good: state === 'ontrack', state, label, color, sub: 'Last done ' + this.agoText(ds) + ', ' + t.every };
  },

  // Roll the watched steps up into one health read for the gap.
  health(g) {
    const watched = this.steps(g).map((s, i) => this.stepStatus(g.id, i)).filter(st => st.kind !== 'guide');
    if (!watched.length) return { state: 'guide', label: 'Guidance', good: 0, watched: 0 };
    const good = watched.filter(st => st.good).length;
    const rs = watched.filter(st => st.kind === 'recur' || st.kind === 'setup');
    const untouched = rs.length > 0 && rs.every(st => (st.kind === 'recur' ? st.never : !st.good));
    const anyBad = watched.some(st => (st.kind === 'recur' && (st.state === 'behind' || st.never)) || (st.kind === 'setup' && !st.good));
    const anySlip = watched.some(st => (st.kind === 'recur' && st.state === 'slipping') || (st.kind === 'state' && !st.good));
    let state, label;
    if (untouched)      { state = 'new';     label = 'Not started'; }
    else if (anyBad)    { state = 'atrisk';  label = 'At risk'; }
    else if (anySlip)   { state = 'slipping'; label = 'Slipping'; }
    else                { state = 'running'; label = 'Running'; }
    return { state, label, good, watched: watched.length };
  },
  healthColor(state) {
    return state === 'running' ? 'var(--green)' : state === 'slipping' ? 'var(--amber)' : state === 'atrisk' ? 'var(--red)' : 'var(--t3)';
  },
  recoveredFor(id) {
    if (!window.Recovery) return 0;
    let r = 0;
    this.fixLog().filter(e => e.gap_id === id).forEach(e => { const c = Recovery.compute(e); if (c && c.status === 'ok' && c.dollars > 0) r += c.dollars; });
    return r;
  },

  // Progress ring (SVG literal hex per the SVG-fill rule).
  ring(done, total, size, full) {
    const sw = Math.max(3, Math.round(size / 11));
    const r = (size - sw) / 2, cx = size / 2, cy = size / 2;
    const circ = 2 * Math.PI * r;
    const pct = total > 0 ? Math.min(1, done / total) : 0;
    const off = circ * (1 - pct);
    const accent = full ? PF_GREEN : PF_GOLD;   // a completed (running) ring + check is green, like the status text
    const prog = pct > 0 ? accent : PF_DIM;
    const center = full
      ? '<path d="M' + (cx - size * 0.17) + ' ' + cy + ' l' + (size * 0.11) + ' ' + (size * 0.12) + ' l' + (size * 0.24) + ' -' + (size * 0.28) + '" fill="none" stroke="' + accent + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/>'
      : '<text x="' + cx + '" y="' + (cy + size * 0.135) + '" text-anchor="middle" font-size="' + (size * 0.30) + '" font-weight="700" fill="' + PF_TXT + '" font-family="\'Barlow Condensed\',sans-serif">' + done + '/' + total + '</text>';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="flex-shrink:0;">'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + PF_TRACK + '" stroke-width="' + sw + '"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + prog + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" style="transition:stroke-dashoffset .4s ease;"/>'
      + center + '</svg>';
  },
  stepIcon(kind) {
    const p = kind === 'result'
      ? '<path d="M1 7s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.7"/>'
      : kind === 'reference'
        ? '<path d="M3.5 1.5h4l3 3v8h-7z"/><path d="M7.5 1.5v3h3"/>'
        : '<path d="M2.5 7h7M7 4l3 3-3 3"/>';
    return '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">' + p + '</svg>';
  },

  // ── Screen entry ────────────────────────────────────────────────────────────
  render(container) {
    this.container = container;
    const focus = App._fixFocus || null;
    App._fixFocus = null;
    this._autoStart();
    const gaps = this.gaps();
    if (focus && this.gap(focus)) this._workGap = focus;
    else if (!this._workGap || !this.gap(this._workGap)) this._workGap = gaps.length ? gaps[0].id : null;
    this.renderPage();
  },

  // ── One master-detail page: the campaign header full width, a left rail of
  //    systems, and the selected system's fix detail on the right. Selecting a
  //    system swaps the detail in place; the page is never left. ───────────────
  renderPage() {
    const gaps = this.gaps();
    const total = gaps.length;
    const healths = gaps.map(g => this.health(g));
    const running = healths.filter(h => h.state === 'running').length;
    const slipping = healths.filter(h => h.state === 'slipping').length;
    const atrisk = healths.filter(h => h.state === 'atrisk').length;
    const recovered = window.Recovery ? (Recovery.moduleSummary('profit').recovered || 0) : 0;
    const pct = total ? Math.round(running / total * 100) : 0;

    let sub = [];
    if (slipping) sub.push(slipping + ' slipping');
    if (atrisk) sub.push(atrisk + ' at risk');
    const subLine = sub.length ? '<span style="color:var(--t3);"> &middot; ' + sub.join(', ') + '</span>' : '';

    const header = '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Your Profit Systems</div>'
      + '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:12px;">'
      + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:34px;font-weight:600;line-height:1;color:var(--t1);">' + running + '<span style="color:var(--t3);font-size:20px;"> / ' + total + '</span></span>'
      + '<span style="font-size:13px;color:var(--t2);">systems running' + subLine + '</span>'
      + '<span style="margin-left:auto;font-size:13px;color:var(--t2);">Recovered to date <span style="color:var(--gold);font-weight:700;font-family:\'Barlow Condensed\',sans-serif;font-size:18px;">' + App.fmtCurrency(recovered, 0) + '</span></span>'
      + '</div><div class="pf-progbar"><span style="width:' + pct + '%;"></span></div></div>';

    const timelineLink = '<div style="margin:-4px 0 16px;"><button class="btn btn-ghost btn-sm pf-timeline">How recovery builds over time</button></div>';

    const rail = gaps.map((g, gi) => this.railTile(g, healths[gi])).join('');
    const detail = this._workGap ? this.detailHtml(this.gap(this._workGap)) : '';

    this.container.innerHTML = '<div class="screen">' + header + timelineLink
      + '<div class="pf-2pane"><div class="pf-rail">' + rail + '</div>'
      + '<div class="pf-detail">' + detail + '</div></div></div>';

    this.container.querySelectorAll('.pf-tile').forEach(t =>
      t.addEventListener('click', () => { this._workGap = t.dataset.gap; this.renderPage(); }));
    this.container.querySelector('.pf-timeline')?.addEventListener('click', () =>
      App.pushView(() => { if (window.S && S.RecoveryTimeline) S.RecoveryTimeline.render(this.container, 'profit'); }));
    this.wireWorkspace();
  },

  // One system button in the left rail. The selected one is highlighted gold.
  railTile(g, h) {
    const logged = !!this.loggedDate(g.id);
    const rec = logged ? this.recoveredFor(g.id) : 0;
    const sel = g.id === this._workGap;
    const statusLine = '<span style="color:' + this.healthColor(h.state) + ';font-weight:700;">' + h.label + '</span>'
      + (h.watched ? '<span style="color:var(--t3);"> &middot; ' + h.good + ' of ' + h.watched + ' on track</span>' : '')
      + (logged && rec > 0 ? '<span style="color:var(--t3);"> &middot; ' + App.fmtCurrency(rec, 0) + ' recovered</span>' : '');
    return '<div class="pf-tile' + (sel ? ' sel' : '') + '" data-gap="' + esc(g.id) + '">'
      + '<div style="display:flex;align-items:center;gap:12px;">'
      + this.ring(h.good, h.watched, 44, h.state === 'running')
      + '<div style="min-width:0;flex:1;">'
      + '<div style="font-size:14px;font-weight:600;color:var(--t1);line-height:1.3;">' + esc(g.name) + '</div>'
      + '<div style="font-size:12px;margin-top:4px;line-height:1.4;">' + statusLine + '</div>'
      + '</div></div></div>';
  },

  // ── Detail pane: the selected system's fix. The rail button carries the name,
  //    ring, and health, so the detail leads with the mistakes to avoid, then the
  //    watched system steps, the guidance steps, and the recovery readout. ──────
  detailHtml(g) {
    if (!g) return '';
    const steps = this.steps(g);
    const h = this.health(g);
    const logged = this.loggedDate(g.id);

    const mistakes = Array.isArray(g.commonMistakes) ? g.commonMistakes.slice(0, 4) : [];
    const watchOut = mistakes.length
      ? '<div class="card" style="margin-bottom:14px;border-left:3px solid var(--red);">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--red);margin-bottom:9px;">Watch Out For</div>'
        + mistakes.map(t => '<div style="display:flex;gap:10px;padding:4px 0;font-size:12px;color:var(--t2);line-height:1.55;">'
            + '<span style="flex-shrink:0;width:5px;height:5px;border-radius:50%;background:var(--red);margin-top:7px;"></span><span>' + esc(t) + '</span></div>').join('')
        + '</div>'
      : '';

    const rows = steps.map((s, i) => ({ s, i, guide: this.stepStatus(g.id, i).kind === 'guide' }));
    const watchedHtml = rows.filter(x => !x.guide).map(x => this.stepRow(g, x.s, x.i)).join('');
    const guideHtml = rows.filter(x => x.guide).map(x => this.stepRow(g, x.s, x.i)).join('');
    const body = (watchedHtml ? '<div class="sh" style="margin:4px 0 12px;">The System</div>' + watchedHtml : '')
      + (guideHtml ? '<div class="sh" style="margin:18px 0 12px;">Guidance</div>' + guideHtml : '');

    return body + this.measureCard(g, h, logged) + watchOut;
  },

  stepRow(g, s, i) {
    const st = this.stepStatus(g.id, i);
    const kind = s.kind || 'action';
    const label = esc(s.targetLabel || '');
    let action = '';
    if (kind === 'reference' && s.target) {
      action = '<a class="btn btn-ghost btn-sm" href="' + this.docPath(s.target) + '" download style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;">' + this.stepIcon('reference') + 'Download' + (label ? ': ' + label : '') + '</a>';
    } else if (s.target) {
      const verb = kind === 'result' ? 'View' : 'Open';
      action = '<button class="btn btn-ghost btn-sm pf-go" data-target="' + esc(s.target) + '" style="display:inline-flex;align-items:center;gap:6px;">' + this.stepIcon(kind) + verb + (label ? ': ' + label : '') + '</button>';
    }

    let statusHtml, border;
    if (st.kind === 'guide') {
      border = 'var(--b-edge)';
      statusHtml = '<span style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t4);">Guidance</span>';
    } else {
      border = st.color;
      statusHtml = '<span style="font-size:12px;font-weight:700;color:' + st.color + ';">' + st.label + '</span>'
        + (st.sub ? '<span style="font-size:11px;color:var(--t3);"> &middot; ' + esc(st.sub) + '</span>' : '');
    }

    return '<div class="pf-step" style="border-left:3px solid ' + border + ';"><div style="padding:14px 16px;">'
      + '<div style="margin-bottom:5px;">' + statusHtml + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;"><span style="color:var(--t3);">' + this.stepIcon(kind) + '</span>'
      + '<span style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(s.title) + '</span></div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin:6px 0 0;">' + esc(s.detail || '') + '</div>'
      + (action ? '<div style="margin-top:11px;">' + action + '</div>' : '')
      + '</div></div>';
  },

  measureCard(g, h, logged) {
    if (logged) {
      const r = window.Recovery ? Recovery.compute(logged) : { status: 'untracked' };
      let line = '', tone = 'var(--t2)';
      if (r.status === 'building') {
        const wk = r.weeksIn || 0, need = (r.baselineWeeks || 3) + 1;
        line = 'Building your baseline. ' + wk + ' of about ' + need + ' weeks of operating logged. Your recovery number turns on once Bar Cop has a few weeks to measure against, around your first month, then it firms up from there.';
        tone = 'var(--t3)';
      } else if (r.status === 'untracked') {
        line = 'This system does not turn into a clean dollar figure on its own, so there is no recovery number to show. It is still tracked and running, and the win shows up in your other numbers.';
        tone = 'var(--t3)';
      } else if (r.status === 'ok') {
        const move = r.label + ' ' + r.fmt(r.before) + ' to ' + r.fmt(r.after);
        const prelim = r.mature ? '' : ' Preliminary, ' + r.weeksAfter + ' week' + (r.weeksAfter === 1 ? '' : 's') + ' in.';
        if (r.dollars != null && r.dollars > 0) {
          tone = 'var(--gold)';
          line = 'Recovered about ' + App.fmtCurrency(r.dollars) + ' so far' + (r.dollarsAnnual ? ', on pace for ' + App.fmtCurrency(r.dollarsAnnual) + ' a year' : '') + '. ' + move + '.' + prelim;
        } else if (r.dollars != null && r.dollars < 0) {
          tone = 'var(--red)';
          line = 'Slipping. You are about ' + App.fmtCurrency(Math.abs(r.dollars)) + ' below where you started. ' + move + '. Get the watched steps back on track.' + prelim;
        } else {
          line = 'Holding steady at your starting level. ' + move + '.' + prelim;
        }
      } else {
        line = 'Bar Cop tracks this system from the day you started it.';
      }
      return '<div class="card form-card" style="margin-top:6px;border-color:var(--gold-tint-bord);background:var(--gold-tint);">'
        + '<div class="card-title" style="color:var(--gold);">Running Since ' + esc(logged.date) + '</div>'
        + '<div style="font-size:12px;color:' + tone + ';line-height:1.6;">' + esc(line) + '</div></div>';
    }
    return '<div class="card form-card" style="margin-top:6px;"><div class="card-title">Not Started Yet</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.55;">Do the first step above and Bar Cop starts this system on its own, from the day you do it. Nothing to set, no date to pick.</div></div>';
  },

  wireWorkspace() {
    this.container.querySelectorAll('.pf-go').forEach(btn => btn.addEventListener('click', () => { App._fixFocus = this._workGap; App.openScreen(btn.dataset.target); }));
  },

  showHowTo() {
    App.showHelpModal('How the Profit Fix System Works', [
      { p: ['A fix is not a checklist you finish, it is a system you put in place and then keep running. So Bar Cop does not ask you to tick boxes. For the work it can see, it reads your real data and shows whether it is actually happening.'] },
      { h: 'Your Profit Systems', p: ['Each system in the left list is one leak. The ring and status read off live data: how many of the watched steps are on track. Select one and its fix opens on the right, so you move between systems without leaving the page. A system reads Running only while the work keeps flowing, and drops back to Slipping or At risk on its own the moment it lapses.'] },
      { h: 'Watched Steps', p: ['The work Bar Cop can verify shows a live status: On track, slipping, or behind, with when it was last done and how often it should happen. You cannot fake a counted drawer or a logged comp. Even the weekly reviews count, because opening the screen leaves a record, and steps like repricing read your live numbers (any menu item still over target) or open vendor claims still owed. This is the honest answer to whether the system is being worked, not just claimed.'] },
      { h: 'Guidance Steps', p: ['The handful of things Bar Cop genuinely cannot see, a signed paper policy, the jigger pour-test on the floor, are marked Guidance. They still matter, but they are never counted as proof, so nobody passes a system by clicking a box.'] },
      { h: 'Watch Out For', p: ['Each leak lists the mistakes that quietly cost operators the most. Read them first. They are the things Bar Cop itself cannot stop.'] },
      { h: 'It Starts On Its Own', p: ['There is no start button. The moment you do the first tracked step, Bar Cop logs that day and starts measuring from there. If you have already been doing the work in Control, the system is running the first time you open it. From the start day it averages the eight weeks before against the eight weeks after to measure what it wins back. If there is no history before you started, there is nothing to call recovered yet, and that is the honest answer.'] }
    ]);
  }
};
