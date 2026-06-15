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
    const prog = pct > 0 ? PF_GOLD : PF_DIM;
    const center = full
      ? '<path d="M' + (cx - size * 0.17) + ' ' + cy + ' l' + (size * 0.11) + ' ' + (size * 0.12) + ' l' + (size * 0.24) + ' -' + (size * 0.28) + '" fill="none" stroke="' + PF_GOLD + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/>'
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
    this.renderLanding();
    if (focus && this.gap(focus)) App.pushView(() => this.enterWorkspace(focus));
  },

  // ── Landing: campaign header + system tiles ─────────────────────────────────
  renderLanding() {
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

    const tiles = gaps.map((g, gi) => {
      const h = healths[gi];
      const logged = !!this.loggedDate(g.id);
      const rec = logged ? this.recoveredFor(g.id) : 0;
      const statusLine = '<span style="color:' + this.healthColor(h.state) + ';font-weight:700;">' + h.label + '</span>'
        + (h.watched ? '<span style="color:var(--t3);"> &middot; ' + h.good + ' of ' + h.watched + ' on track</span>' : '')
        + (logged && rec > 0 ? '<span style="color:var(--t3);"> &middot; ' + App.fmtCurrency(rec, 0) + ' recovered</span>' : '');
      return '<div class="pf-tile' + (h.state === 'running' ? ' fixed' : '') + '" data-gap="' + esc(g.id) + '">'
        + '<div style="display:flex;align-items:center;gap:14px;">'
        + this.ring(h.good, h.watched, 48, h.state === 'running')
        + '<div style="min-width:0;flex:1;">'
        + '<div style="font-size:14px;font-weight:600;color:var(--t1);line-height:1.3;">' + esc(g.name) + '</div>'
        + '<div style="font-size:12px;margin-top:4px;line-height:1.4;">' + statusLine + '</div>'
        + '</div></div></div>';
    }).join('');

    this.container.innerHTML = '<div class="screen">' + header + '<div class="pf-grid">' + tiles + '</div></div>';
    this.container.querySelectorAll('.pf-tile').forEach(t =>
      t.addEventListener('click', () => App.pushView(() => this.enterWorkspace(t.dataset.gap))));
  },

  // ── Workspace ───────────────────────────────────────────────────────────────
  enterWorkspace(gapId) {
    const g = this.gap(gapId);
    if (!g) { this.renderLanding(); return; }
    this._workGap = gapId;
    this.renderWorkspace();
  },

  renderWorkspace() {
    const g = this.gap(this._workGap);
    if (!g) { this.renderLanding(); return; }
    const steps = this.steps(g);
    const h = this.health(g);
    const logged = this.loggedDate(g.id);

    // The headline issue: the worst watched step, named.
    const watched = steps.map((s, i) => ({ s, i, st: this.stepStatus(g.id, i) })).filter(x => x.st.kind !== 'guide');
    const rank = st => st.kind === 'recur' && st.state === 'behind' ? 0 : st.kind === 'recur' && st.never ? 1 : st.kind === 'setup' && !st.good ? 2 : st.kind === 'state' && !st.good ? 2.5 : st.kind === 'recur' && st.state === 'slipping' ? 3 : 9;
    const worst = watched.slice().sort((a, b) => rank(a.st) - rank(b.st))[0];
    const issue = (h.state === 'running')
      ? 'Every watched step is on track. Keep it running.'
      : worst ? esc(worst.s.title) + ': ' + worst.st.label.toLowerCase() + (worst.st.sub ? ' (' + esc(worst.st.sub) + ')' : '') + '.' : '';

    const hero = '<div class="card form-card" style="margin-bottom:14px;border-left:3px solid ' + this.healthColor(h.state) + ';">'
      + '<div style="display:flex;align-items:center;gap:18px;">'
      + this.ring(h.good, h.watched, 72, h.state === 'running')
      + '<div style="min-width:0;flex:1;">'
      + '<div style="font-size:17px;font-weight:700;color:var(--t1);">' + esc(g.name) + '</div>'
      + '<div style="font-size:13px;margin:4px 0 6px;"><span style="color:' + this.healthColor(h.state) + ';font-weight:700;">' + h.label + '</span>'
      + (h.watched ? '<span style="color:var(--t3);"> &middot; ' + h.good + ' of ' + h.watched + ' watched steps on track</span>' : '') + '</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.55;">' + issue + '</div>'
      + '</div></div></div>';

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

    this.container.innerHTML = '<div class="screen">' + hero + watchOut + body + this.measureCard(g, h, logged) + '</div>';
    this.wireWorkspace();
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
    const inputStyle = 'background:var(--bg);border:1px solid var(--b1);border-radius:4px;color:#fff;font-size:13px;padding:8px 10px;width:100%;color-scheme:dark;';
    if (logged) {
      const r = window.Recovery ? Recovery.compute(logged) : { status: 'untracked' };
      let line = '', good = false;
      if (r.status === 'ok') {
        const move = r.fmt(r.before) + ' to ' + r.fmt(r.after);
        if (r.dollars != null && r.dollars > 0) { good = true; line = 'Recovered about ' + App.fmtCurrency(r.dollars) + ' so far' + (r.dollarsAnnual ? ', on pace for ' + App.fmtCurrency(r.dollarsAnnual) + ' a year' : '') + '. ' + r.label + ' ' + move + '.' + (r.mature ? '' : ' Preliminary, ' + r.weeksAfter + ' week' + (r.weeksAfter === 1 ? '' : 's') + ' of data so far.'); }
        else line = r.label + ' has not improved since this fix. ' + move + '.';
      } else if (r.status === 'pending') line = 'Measuring. ' + r.weeksAfter + ' week' + (r.weeksAfter === 1 ? '' : 's') + ' of data since you put it in place.';
      else if (r.status === 'no-baseline') line = 'No weeks logged before this date to measure recovery against.';
      return '<div class="card form-card" style="margin-top:6px;border-color:var(--gold-tint-bord);background:var(--gold-tint);">'
        + '<div class="card-title" style="color:var(--gold);">In Place Since ' + esc(logged.date) + '</div>'
        + (line ? '<div style="font-size:12px;color:' + (good ? 'var(--gold)' : 'var(--t2)') + ';line-height:1.6;">' + esc(line) + '</div>' : '')
        + '<div class="card-actions"><button class="btn btn-ghost btn-sm pf-unlog" data-log="' + esc(logged.id) + '">Remove date</button></div></div>';
    }
    const ready = h.state === 'running';
    const lead = ready
      ? 'This system is up and running. Lock in the date you put it in place and Bar Cop measures what it wins back, the eight weeks before against the eight weeks after.'
      : 'Get every watched step on track, then lock in the date you put the system in place so Bar Cop can measure what it recovers.';
    return '<div class="card form-card" style="margin-top:6px;' + (ready ? 'border-color:var(--gold);' : '') + '"><div class="card-title">Lock In the Start Date</div>'
      + '<div style="font-size:12px;color:' + (ready ? 'var(--gold)' : 'var(--t3)') + ';line-height:1.55;margin-bottom:12px;font-weight:' + (ready ? '700' : '400') + ';">' + lead + '</div>'
      + '<div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">'
      + '<div class="f" style="width:180px;flex-shrink:0;"><label>In Place On</label><input type="date" class="pf-impl-date" style="' + inputStyle + '"/></div>'
      + '<button class="btn ' + (ready ? 'btn-primary' : 'btn-ghost') + ' pf-mark" data-gap="' + esc(g.id) + '" data-name="' + esc(g.name) + '">Lock In the Date</button>'
      + '</div></div>';
  },

  wireWorkspace() {
    const c = this.container;
    c.querySelectorAll('.pf-go').forEach(btn => btn.addEventListener('click', () => { App._fixFocus = this._workGap; App.openScreen(btn.dataset.target); }));
    c.querySelector('.pf-mark')?.addEventListener('click', (ev) => {
      const dateEl = c.querySelector('.pf-impl-date');
      const date = dateEl ? dateEl.value : '';
      if (!date) { if (dateEl) dateEl.style.borderColor = 'var(--red)'; return; }
      const btn = ev.currentTarget;
      App.putRecord('core', 'fix_log', { id: App.uid(), module: 'profit', gap_id: btn.dataset.gap, gap_name: btn.dataset.name, date: date, logged_at: new Date().toISOString() });
      App.markSetupDone && App.markSetupDone('gs_p_fix');
      this.renderWorkspace();
    });
    c.querySelectorAll('.pf-unlog').forEach(btn => btn.addEventListener('click', () => { App.removeRecord('core', 'fix_log', btn.dataset.log); this.renderWorkspace(); }));
  },

  showHowTo() {
    App.showHelpModal('How the Profit Fix System Works', [
      { p: ['A fix is not a checklist you finish, it is a system you put in place and then keep running. So Bar Cop does not ask you to tick boxes. For the work it can see, it reads your real data and shows whether it is actually happening.'] },
      { h: 'Your Profit Systems', p: ['Each tile is one leak with its own system. The ring and the status read off live data: how many of the watched steps are on track. A system reads Running only while the work keeps flowing, and drops back to Slipping or At risk on its own the moment it lapses.'] },
      { h: 'Watched Steps', p: ['The work Bar Cop can verify shows a live status: On track, slipping, or behind, with when it was last done and how often it should happen. You cannot fake a counted drawer or a logged comp. Even the weekly reviews count, because opening the screen leaves a record, and steps like repricing read your live numbers (any menu item still over target) or open vendor claims still owed. This is the honest answer to whether the system is being worked, not just claimed.'] },
      { h: 'Guidance Steps', p: ['The handful of things Bar Cop genuinely cannot see, a signed paper policy, the jigger pour-test on the floor, are marked Guidance. They still matter, but they are never counted as proof, so nobody passes a system by clicking a box.'] },
      { h: 'Watch Out For', p: ['Each leak lists the mistakes that quietly cost operators the most. Read them first. They are the things Bar Cop itself cannot stop.'] },
      { h: 'Lock In the Start Date', p: ['Once a system is running, lock in the date you put it in place. Bar Cop averages the eight weeks before against the eight weeks after to measure what it actually recovered, and tracks it on your dashboard. A figure shows once two weeks of after-data land.'] }
    ]);
  }
};
