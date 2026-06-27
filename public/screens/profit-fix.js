'use strict';

/* ── Profit Fix — the Profit Recovery Fix System (verified, monitored) ─────────
   A fix is not a checklist you finish, it is a system you put in place and then
   keep running. So Bar Cop does not ask the operator to tick boxes and take their
   word for it. For every step that maps to real work, it reads the actual Control
   data and shows whether the work is happening:
     • Setup steps  — verified by state (recipe cards built, product costs
       entered). In place, or not.
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
const PF_GREY  = '#6E7C86';   // neutral progress-ring arc (de-emphasized)
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
    'theft-loss':     { 1: { kind: 'recur', signal: 'voidcomp', maxDays: 4, every: 'every shift' }, 2: { kind: 'recur', signal: 'salesreview', maxDays: 9, every: 'every week' }, 3: { kind: 'recur', signal: 'drawer', maxDays: 3, every: 'every shift' }, 4: { kind: 'recur', signal: 'delivery', maxDays: 10, every: 'every delivery' }, 5: { kind: 'recur', signal: 'spotcheck', maxDays: 7, every: 'a couple times a week' }, 6: { kind: 'recur', signal: 'view:theft-risk', maxDays: 9, every: 'every week' } },
    'food-cost':      { 0: { kind: 'setup', key: 'recipes' }, 1: { kind: 'recur', signal: 'count', maxDays: 9, every: 'every week' }, 2: { kind: 'recur', signal: 'view:dashboard', maxDays: 9, every: 'every week' }, 3: { kind: 'recur', signal: 'waste', maxDays: 4, every: 'every shift' }, 7: { kind: 'recur', signal: 'week', maxDays: 9, every: 'every week' }, 8: { kind: 'state', key: 'reprice' } },
    'vendor-control': { 0: { kind: 'recur', signal: 'order', maxDays: 14, every: 'every order you place' }, 1: { kind: 'recur', signal: 'delivery', maxDays: 10, every: 'every delivery' }, 4: { kind: 'state', key: 'chase' }, 5: { kind: 'recur', signal: 'view:vendor-tracker:watch', maxDays: 35, every: 'once a month' }, 6: { kind: 'recur', signal: 'view:vendor-tracker:scorecard', maxDays: 95, every: 'once a quarter' } },
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
    salesreview: () => (App.data        && App.data.sales_reviews)            || [],
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
      const d = r.period_end || r.date || (r.run_at ? App.ymdLocal(new Date(r.run_at)) : '') || (r.created_at ? App.ymdLocal(new Date(r.created_at)) : '');
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
      const d = r.period_end || r.date || (r.run_at ? App.ymdLocal(new Date(r.run_at)) : '') || (r.created_at ? App.ymdLocal(new Date(r.created_at)) : '');
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
    const behind = watched.filter(st => (st.kind === 'recur' && (st.state === 'behind' || st.never)) || (st.kind === 'setup' && !st.good)).length;
    const slipping = watched.filter(st => (st.kind === 'recur' && st.state === 'slipping') || (st.kind === 'state' && !st.good)).length;
    // The label names the cause so it connects to the steps: a system reads
    // On track only while every watched step is current, otherwise it says
    // exactly how many are behind or slipping (fix them and it climbs back).
    let state, label;
    if (untouched)         { state = 'new';      label = 'Not started'; }
    else if (behind > 0)   { state = 'atrisk';   label = behind + (behind === 1 ? ' step behind' : ' steps behind'); }
    else if (slipping > 0) { state = 'slipping'; label = slipping + (slipping === 1 ? ' step slipping' : ' steps slipping'); }
    else                   { state = 'running';  label = 'On track'; }
    return { state, label, good, watched: watched.length, behind, slipping };
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

  // Status ring (SVG literal hex per the SVG-fill rule). In progress: a thin
  // neutral arc with the step count. On track: the exact thin green circle +
  // check from the Delivery Recorded confirmation, scaled to size (f = size / 40).
  ring(done, total, size, full) {
    const f = size / 40, fx = n => +(n * f).toFixed(2);
    const cx = fx(20), cy = fx(20), r = fx(17);
    const open = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" fill="none" style="flex-shrink:0;">';
    if (full) {
      return open
        + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" stroke="' + PF_GREEN + '" stroke-width="' + fx(1.8) + '"/>'
        + '<path d="M' + fx(12) + ' ' + fx(20.5) + 'l' + fx(5.5) + ' ' + fx(5.5) + 'L' + fx(28) + ' ' + fx(14) + '" stroke="' + PF_GREEN + '" stroke-width="' + fx(2.2) + '" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    const sw = fx(1.8);
    const circ = 2 * Math.PI * r;
    const pct = total > 0 ? Math.min(1, done / total) : 0;
    const off = circ * (1 - pct);
    const prog = pct > 0 ? PF_GREY : PF_DIM;
    return open
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" stroke="' + PF_TRACK + '" stroke-width="' + sw + '"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" stroke="' + prog + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" style="transition:stroke-dashoffset .4s ease;"/>'
      + '<text x="' + cx + '" y="' + (cy + size * 0.135) + '" text-anchor="middle" font-size="' + fx(12) + '" font-weight="700" fill="' + PF_TXT + '" font-family="\'Barlow Condensed\',sans-serif">' + done + '/' + total + '</text>'
      + '</svg>';
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
    if (atrisk) sub.push(atrisk + ' behind');
    const subLine = sub.length ? '<span style="color:var(--t3);"> &middot; ' + sub.join(', ') + '</span>' : '';

    const header = '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Your Profit Systems</div>'
      + '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:12px;">'
      + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:34px;font-weight:600;line-height:1;color:var(--t1);">' + running + '<span style="color:var(--t3);font-size:20px;"> / ' + total + '</span></span>'
      + '<span style="font-size:13px;color:var(--t2);">systems running' + subLine + '</span>'
      + '<span style="margin-left:auto;font-size:13px;color:var(--t2);">Recovered to date <span style="color:var(--gold);font-weight:700;font-family:\'Barlow Condensed\',sans-serif;font-size:18px;">' + App.fmtCurrency(recovered, 0) + '</span></span>'
      + '</div><div class="pf-progbar"><span style="width:' + pct + '%;"></span></div>'
      + this.measureLine(this.gap(this._workGap)) + '</div>';

    const timelineLink = '<div style="margin:-4px 0 16px;display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-ghost btn-sm pf-timeline">See Your Recovery Timeline</button><button class="btn btn-ghost btn-sm pf-playbook">Read the Recovery Playbook</button></div>';

    const rail = gaps.map((g, gi) => this.railTile(g, healths[gi])).join('');
    const detail = this._workGap ? this.detailHtml(this.gap(this._workGap)) : '';

    this.container.innerHTML = '<div class="screen">' + header + timelineLink
      + '<div class="pf-2pane"><div class="pf-rail">' + rail + '</div>'
      + '<div class="pf-detail">' + detail + '</div></div></div>';

    this.container.querySelectorAll('.pf-tile').forEach(t =>
      t.addEventListener('click', () => { this._workGap = t.dataset.gap; this.renderPage(); }));
    this.container.querySelector('.pf-timeline')?.addEventListener('click', () =>
      App.pushView(() => { if (window.S && S.RecoveryTimeline) S.RecoveryTimeline.render(this.container, 'profit'); }));
    this.container.querySelector('.pf-playbook')?.addEventListener('click', () =>
      { if (window.S && S.RecoveryPlaybook) S.RecoveryPlaybook.open('profit'); });
    this.wireWorkspace();
  },

  // One system button in the left rail. The selected one is highlighted gold.
  railTile(g, h) {
    const logged = !!this.loggedDate(g.id);
    const rec = logged ? this.recoveredFor(g.id) : 0;
    const sel = g.id === this._workGap;
    const statusLine = '<span style="color:' + this.healthColor(h.state) + ';font-weight:700;">' + h.label + '</span>'
      + (logged && rec > 0 ? '<span style="color:var(--t3);"> &middot; ' + App.fmtCurrency(rec, 0) + ' recovered</span>' : '');
    return '<div class="pf-tile' + (sel ? ' sel' : '') + '" data-gap="' + esc(g.id) + '">'
      + '<div style="display:flex;align-items:center;gap:12px;">'
      + this.ring(h.good, h.watched, 40, h.state === 'running')
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
    const rows = steps.map((s, i) => ({ s, i, guide: this.stepStatus(g.id, i).kind === 'guide' }));
    const watchedHtml = rows.filter(x => !x.guide).map(x => this.stepRow(g, x.s, x.i)).join('');
    const guideHtml = rows.filter(x => x.guide).map(x => this.stepRow(g, x.s, x.i)).join('');

    // Each section is ONE card of rows (divider-separated), not a card per step.
    const systemCard = watchedHtml
      ? '<div class="card" style="padding:0;overflow:hidden;margin-bottom:18px;">' + watchedHtml + '</div>'
      : '';
    const guideCard = guideHtml
      ? '<div class="sh" style="margin:0 0 12px;">Guidance</div>'
        + '<div class="card" style="padding:0;overflow:hidden;margin-bottom:18px;">' + guideHtml + '</div>'
      : '';

    const mistakes = Array.isArray(g.commonMistakes) ? g.commonMistakes.slice(0, 4) : [];
    const watchOut = mistakes.length
      ? '<div class="sh" style="margin:0 0 12px;">Watch Out For</div><div class="card">'
        + mistakes.map(t => '<div style="display:flex;gap:10px;padding:5px 0;font-size:12px;color:var(--t2);line-height:1.55;">'
            + '<span style="flex-shrink:0;width:5px;height:5px;border-radius:50%;background:var(--red);margin-top:7px;"></span><span>' + esc(t) + '</span></div>').join('')
        + '</div>'
      : '';

    return systemCard + guideCard + watchOut;
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

    // Guidance rows sit in their own card, so no per-row label; watched rows lead
    // with their live status as colored text (no badge, no colored border).
    const statusHtml = (st.kind === 'guide') ? ''
      : '<div style="margin-bottom:5px;font-size:12px;font-weight:700;color:' + st.color + ';">' + st.label
        + (st.sub ? '<span style="color:var(--t3);font-weight:400;"> &middot; ' + esc(st.sub) + '</span>' : '') + '</div>';

    return '<div class="pf-line">'
      + statusHtml
      + '<div style="display:flex;align-items:center;gap:8px;"><span style="color:var(--t3);">' + this.stepIcon(kind) + '</span>'
      + '<span style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(s.title) + '</span></div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin:6px 0 0;">' + esc(s.detail || '') + '</div>'
      + (action ? '<div style="margin-top:11px;">' + action + '</div>' : '')
      + '</div>';
  },

  // The selected system's recovery readout, shown as one line under the campaign
  // progress bar (not as a card in the detail pane).
  measureLine(g) {
    if (!g) return '';
    const logged = this.loggedDate(g.id);
    const nm = '<span style="color:var(--t1);font-weight:600;">' + esc(g.name) + '</span>';
    const gold = v => '<span style="color:var(--gold);font-weight:700;">' + App.fmtCurrency(v, 0) + '</span>';
    const red  = v => '<span style="color:var(--red);font-weight:700;">' + App.fmtCurrency(v, 0) + '</span>';
    let body;
    if (!logged) {
      body = ' is not started yet. Do its first step and Bar Cop starts measuring from that day.';
    } else {
      const r = window.Recovery ? Recovery.compute(logged) : { status: 'untracked' };
      const since = ' running since ' + esc(logged.date) + '. ';
      if (r.status === 'building') {
        const wk = r.weeksIn || 0, need = (r.baselineWeeks || 3) + 1;
        body = since + 'Building your baseline, ' + wk + ' of about ' + need + ' weeks logged. The recovery number turns on around your first month.';
      } else if (r.status === 'ok' && r.dollars != null && r.dollars > 0) {
        body = since + 'Recovered about ' + gold(r.dollars) + ' so far' + (r.dollarsAnnual ? ', on pace for ' + gold(r.dollarsAnnual) + ' a year' : '') + '.';
      } else if (r.status === 'ok' && r.dollars != null && r.dollars < 0) {
        body = since + 'Slipping, about ' + red(Math.abs(r.dollars)) + ' below where you started. Get the watched steps back on track.';
      } else if (r.status === 'ok') {
        body = since + 'Holding steady at your starting level.';
      } else {
        body = since + 'Tracked and running. The win shows up in your other numbers.';
      }
    }
    return '<div style="margin-top:11px;padding-top:11px;border-top:1px solid var(--b2);font-size:12px;line-height:1.55;color:var(--t2);">' + nm + body + '</div>';
  },

  wireWorkspace() {
    this.container.querySelectorAll('.pf-go').forEach(btn => btn.addEventListener('click', () => { App._fixFocus = this._workGap; App.openScreen(btn.dataset.target); }));
  },

  showHowTo() {
    App.showHelpModal('How the Profit Fix System Works', [
      { p: ['A fix is not a checklist you finish, it is a system you put in place and then keep running. So Bar Cop does not ask you to tick boxes. For the work it can see, it reads your real data and shows whether it is actually happening.'] },
      { h: 'Your Profit Systems', p: ['Each system in the left list is one leak. The ring and status read off live data: how many of the watched steps are on track. Select one and its fix opens on the right, so you move between systems without leaving the page. A system reads On track only while every watched step is current; the moment one lapses it tells you exactly how many steps are slipping or behind, so you know what to get back on.'] },
      { h: 'Watched Steps', p: ['The work Bar Cop can verify shows a live status: On track, slipping, or behind, with when it was last done and how often it should happen. You cannot fake a counted drawer or a logged comp. Even the weekly reviews count, because opening the screen leaves a record, and steps like repricing read your live numbers (any menu item still over target) or open vendor claims still owed. This is the honest answer to whether the system is being worked, not just claimed.'] },
      { h: 'Guidance Steps', p: ['The handful of things Bar Cop genuinely cannot see, a signed paper policy, the jigger pour-test on the floor, are marked Guidance. They still matter, but they are never counted as proof, so nobody passes a system by clicking a box.'] },
      { h: 'Watch Out For', p: ['At the bottom of each system are the mistakes that quietly break its numbers, the things Bar Cop itself cannot catch for you. Worth a read before you chase a number that looks off.'] },
      { h: 'It Starts On Its Own', p: ['There is no start button. The moment you do the first tracked step, Bar Cop logs that day and measures from there. If you have already been doing the work in Control, the system is running the first time you open it. It takes your own first few weeks as the baseline and compares the weeks since against it, so the recovery number reads against where you started, not a guess. Early on there is not enough logged to call anything recovered, and Bar Cop says so plainly instead of inventing a figure.'] },
      { h: 'See Your Recovery Timeline', p: ['The See Your Recovery Timeline button above the systems opens a chart of your recovered dollars building from zero to now, week by week, so you can see the climb instead of just one running total.'] }
    ]);
  }
};
