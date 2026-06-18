'use strict';

/* ── Traffic Fix — the Traffic Recovery Fix System (verified, monitored) ───────
   Same model as Profit/Revenue Fix: a fix is a system you put in place and keep
   running, not a checklist you finish. Traffic's data is thin (it lives on
   Google, your website, the delivery apps), so Bar Cop verifies the few things
   it can see, that you are logging the weekly numbers in This Week and that your
   setup is in place, and the platform work itself is honest Guidance. The fix
   content lives in fix-traffic.js; the rail, ring colors, and recovery readout
   mirror Revenue Fix. */

const TF_GOLD  = '#DBAB46';
const TF_GREEN = '#518A79';
const TF_GREY  = '#6E7C86';
const TF_TRACK = '#0D181E';
const TF_DIM   = '#1B2630';
const TF_TXT   = '#C9D3DA';

// Operator-set Traffic target with a benchmark default (for metric steps).
function tTgt(key, def) { return (((typeof App !== 'undefined' && App.data && App.data.traffic_settings) || {}).targets || {})[key] ?? def; }

S.TrafficFix = {
  _workGap: null,

  // Which steps Bar Cop can verify, keyed by gap id then step index. The tracked
  // steps come FIRST in fix-traffic.js so these indices line up; a step not
  // listed is Guidance. Kinds: setup = N of M profile toggles (graded); state =
  // one profile flag set (or a select off its inactive set); count = a profile
  // number vs a benchmark (graded); metric = the latest This Week number vs its
  // target (graded); recur = you logged This Week recently; fn = a custom
  // evaluator (delivery is per-platform).
  TRACK: {
    'gbp': {
      0: { kind: 'setup', flags: ['gbp_claimed', 'gbp_hours', 'gbp_phone', 'gbp_website', 'gbp_menu', 'gbp_category', 'gbp_attributes', 'gbp_qa'] },
      1: { kind: 'count', get: p => p.gbp_photos, target: 100, unit: 'photos' },
      2: { kind: 'count', get: p => p.gbp_posts, target: 8, unit: 'a month' },
      3: { kind: 'recur', signal: 'week', maxDays: 9, every: 'every week' }
    },
    'website': {
      0: { kind: 'setup', flags: ['web_exists', 'web_mobile', 'web_menu', 'web_online_order', 'web_reservations', 'web_analytics'] },
      1: { kind: 'recur', signal: 'week', maxDays: 9, every: 'every week' }
    },
    'reviews': {
      0: { kind: 'metric', field: 'response_rate', target: () => tTgt('response_rate', 75), unit: '%' },
      1: { kind: 'metric', field: 'new_reviews', target: () => tTgt('review_velocity', 8), unit: ' a month' },
      2: { kind: 'recur', signal: 'week', maxDays: 9, every: 'every week' }
    },
    'search-seo': {
      0: { kind: 'setup', flags: ['search_nap', 'search_name', 'search_address', 'search_phone'] },
      1: { kind: 'state', key: 'search_maps_pack' },
      2: { kind: 'state', key: 'search_keyword' },
      3: { kind: 'count', get: p => p.search_citations, target: 40, unit: 'listings' },
      4: { kind: 'state', key: 'search_titles' }
    },
    'social': {
      0: { kind: 'setup', flags: ['social_stories', 'social_reels'] },
      1: { kind: 'metric', field: 'ig_posts_month', target: () => tTgt('social_posts_month', 12), unit: ' a month' },
      2: { kind: 'count', get: p => p.social_ig_engagement, target: 2, unit: '%' },
      3: { kind: 'recur', signal: 'week', maxDays: 9, every: 'every week' }
    },
    'delivery': {
      0: { kind: 'fn', fn: 'deliverySetup' },
      1: { kind: 'fn', fn: 'deliveryRating' },
      2: { kind: 'recur', signal: 'week', maxDays: 9, every: 'every week' }
    },
    'email-loyalty': {
      0: { kind: 'state', key: 'email_growth', inactive: ['', 'No active mechanism'] },
      1: { kind: 'state', key: 'email_frequency', inactive: ['', 'Rarely', 'Never'] },
      2: { kind: 'metric', field: 'email_open_rate', target: () => 20, unit: '%' },
      3: { kind: 'recur', signal: 'week', maxDays: 9, every: 'every week' }
    }
  },

  gaps() { return (window.FIX && Array.isArray(FIX.traffic)) ? FIX.traffic : []; },
  gap(id) { return this.gaps().find(g => g.id === id) || null; },
  steps(g) { return (g && g.process && g.process.steps) || []; },
  fixLog() { return (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : []; },
  loggedDate(id) { const e = this.fixLog().filter(x => x.gap_id === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]; return e ? e : null; },
  docPath(file) { return 'assets/resources/traffic/' + encodeURIComponent(file); },

  // ── Verification ────────────────────────────────────────────────────────────
  SIGNALS: {
    week: () => (App.data && App.data.traffic_weeks) || []
  },
  _recDate(r) {
    return r.period_end || r.week_start || r.date
      || (r.updated_at ? App.ymdLocal(new Date(r.updated_at)) : '')
      || (r.created_at ? App.ymdLocal(new Date(r.created_at)) : '');
  },
  lastActivity(signal) {
    const arr = (this.SIGNALS[signal] || (() => []))();
    let latest = null;
    arr.forEach(r => { const d = this._recDate(r); if (d && (!latest || d > latest)) latest = String(d).slice(0, 10); });
    return latest;
  },
  firstActivity(signal) {
    const arr = (this.SIGNALS[signal] || (() => []))();
    let earliest = null;
    arr.forEach(r => { const d = this._recDate(r); if (d) { const ds = String(d).slice(0, 10); if (!earliest || ds < earliest) earliest = ds; } });
    return earliest;
  },
  firstAction(g) {
    const t = this.TRACK[g.id] || {};
    let first = null;
    Object.keys(t).forEach(k => {
      const cfg = t[k];
      if (cfg.kind !== 'recur') return;
      const d = this.firstActivity(cfg.signal);
      if (d && (!first || d < first)) first = d;
    });
    return first;
  },
  _autoStart() {
    if (!App.data) return;
    if (!Array.isArray(App.data.fix_log)) App.data.fix_log = [];
    this.gaps().forEach(g => {
      if (this.fixLog().some(e => e.gap_id === g.id)) return;
      const start = this.firstAction(g);
      if (!start) return;
      App.putRecord('core', 'fix_log', { id: App.uid(), module: 'traffic', gap_id: g.id, gap_name: g.name, date: start, logged_at: new Date().toISOString(), auto: true });
    });
  },
  daysSince(d) {
    if (!d) return null;
    const a = new Date(d + 'T00:00:00').getTime();
    const b = new Date(App.todayLocal() + 'T00:00:00').getTime();
    return Math.max(0, Math.floor((b - a) / 86400000));
  },
  agoText(ds) { return ds === 0 ? 'today' : ds === 1 ? 'yesterday' : ds + ' days ago'; },

  prof() { return (App.data && App.data.traffic_settings && App.data.traffic_settings.profile) || {}; },
  latestWeek() {
    const w = ((App.data && App.data.traffic_weeks) || []).slice().sort((a, b) => (a.period_end || '').localeCompare(b.period_end || ''));
    return w.length ? w[w.length - 1] : null;
  },
  _stColor(state) {
    return state === 'ontrack' ? 'var(--green)' : state === 'slipping' ? 'var(--amber)' : state === 'behind' ? 'var(--red)' : 'var(--t3)';
  },

  // Per-platform delivery is graded across the platforms the operator marked live.
  deliverySetup() {
    const p = this.prof();
    const PL = App.TRAFFIC_DELIVERY_PLATFORMS || [];
    const active = PL.filter(pl => p[pl.key + '_active'] === 'yes');
    if (!active.length) return { state: 'never', good: false, label: 'No active platform', color: this._stColor('never') };
    let done = 0; const total = active.length * 3;
    active.forEach(pl => { if (p[pl.key + '_menu']) done++; if (p[pl.key + '_promo']) done++; if (p[pl.key + '_menu_synced_at']) done++; });
    const state = done === total ? 'ontrack' : done > 0 ? 'slipping' : 'never';
    return { state, good: state === 'ontrack', label: state === 'ontrack' ? 'In place' : state === 'slipping' ? 'Partly done' : 'Not set up', color: this._stColor(state), sub: done + ' of ' + total + ' in place' };
  },
  deliveryRating() {
    const p = this.prof();
    const PL = App.TRAFFIC_DELIVERY_PLATFORMS || [];
    const rated = PL.filter(pl => p[pl.key + '_active'] === 'yes' && p[pl.key + '_rating'] != null);
    if (!rated.length) return { state: 'never', good: false, label: 'No ratings logged', color: this._stColor('never') };
    const below = rated.filter(pl => p[pl.key + '_rating'] < 4.5).length;
    const state = below === 0 ? 'ontrack' : 'slipping';
    return { state, good: state === 'ontrack', label: below === 0 ? 'In place' : 'Below 4.5', color: this._stColor(state), sub: below === 0 ? 'all 4.5 stars or higher' : below + ' under 4.5 stars' };
  },

  stepStatus(gapId, idx) {
    const t = (this.TRACK[gapId] || {})[idx];
    if (!t) return { kind: 'guide' };
    const p = this.prof();

    if (t.kind === 'setup') {
      const total = t.flags.length, done = t.flags.filter(k => p[k]).length;
      const state = done === total ? 'ontrack' : done > 0 ? 'slipping' : 'never';
      return { kind: t.kind, state, good: state === 'ontrack', label: state === 'ontrack' ? 'In place' : state === 'slipping' ? 'Partly done' : 'Not set up', color: this._stColor(state), sub: done + ' of ' + total + ' in place' };
    }
    if (t.kind === 'state') {
      const ok = t.inactive ? !t.inactive.includes(p[t.key] || '') : !!p[t.key];
      const state = ok ? 'ontrack' : 'never';
      return { kind: t.kind, state, good: ok, label: ok ? 'In place' : 'Set this up', color: this._stColor(ok ? 'ontrack' : 'behind') };
    }
    if (t.kind === 'count') {
      const v = t.get(p);
      if (v == null || isNaN(v)) return { kind: t.kind, state: 'never', good: false, label: 'Not started', color: this._stColor('never'), sub: 'target ' + t.target + (t.unit ? ' ' + t.unit : '') };
      const state = v >= t.target ? 'ontrack' : v > 0 ? 'slipping' : 'never';
      return { kind: t.kind, state, good: state === 'ontrack', label: state === 'ontrack' ? 'In place' : state === 'slipping' ? 'Building' : 'Not started', color: this._stColor(state), sub: Math.round(v) + ' of ' + t.target + (t.unit ? ' ' + t.unit : '') };
    }
    if (t.kind === 'metric') {
      const w = this.latestWeek(), v = w ? w[t.field] : null, tg = t.target();
      const u = t.unit || '';
      if (v == null || isNaN(v)) return { kind: t.kind, state: 'never', good: false, label: 'Not logged yet', color: this._stColor('never'), sub: 'target ' + tg + u };
      const state = v >= tg ? 'ontrack' : v >= tg * 0.8 ? 'slipping' : 'behind';
      return { kind: t.kind, state, good: state === 'ontrack', label: state === 'ontrack' ? 'On target' : state === 'slipping' ? 'Close' : 'Under target', color: this._stColor(state), sub: Math.round(v) + u + ', target ' + tg + u };
    }
    if (t.kind === 'fn') {
      return Object.assign({ kind: 'fn' }, this[t.fn]());
    }

    // recur — you logged This Week recently
    const last = this.lastActivity(t.signal);
    const ds = this.daysSince(last);
    if (ds == null) return { kind: 'recur', good: false, state: 'never', label: 'Not started', color: this._stColor('never'), sub: 'No record yet, ' + t.every };
    let state, label;
    if (ds <= t.maxDays)          { state = 'ontrack';  label = 'On track'; }
    else if (ds <= t.maxDays * 2) { state = 'slipping'; label = 'Slipping'; }
    else                          { state = 'behind';   label = 'Behind'; }
    return { kind: 'recur', good: state === 'ontrack', state, label, color: this._stColor(state), sub: 'Last done ' + this.agoText(ds) + ', ' + t.every };
  },

  health(g) {
    const watched = this.steps(g).map((s, i) => this.stepStatus(g.id, i)).filter(st => st.kind !== 'guide');
    if (!watched.length) return { state: 'guide', label: 'Guidance', good: 0, watched: 0 };
    const good = watched.filter(st => st.state === 'ontrack').length;
    const anyData = watched.some(st => st.state !== 'never');
    const behind = watched.filter(st => st.state === 'behind' || st.state === 'never').length;
    const slipping = watched.filter(st => st.state === 'slipping').length;
    let state, label;
    if (!anyData)        { state = 'new';      label = 'Not started'; }
    else if (behind > 0) { state = 'atrisk';   label = behind + (behind === 1 ? ' step behind' : ' steps behind'); }
    else if (slipping)   { state = 'slipping'; label = slipping + (slipping === 1 ? ' step slipping' : ' steps slipping'); }
    else                 { state = 'running';  label = 'On track'; }
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

  ring(done, total, size, full) {
    const sw = Math.max(3, Math.round(size / 11));
    const r = (size - sw) / 2, cx = size / 2, cy = size / 2;
    const circ = 2 * Math.PI * r;
    const pct = total > 0 ? Math.min(1, done / total) : 0;
    const off = circ * (1 - pct);
    const prog = pct > 0 ? TF_GREY : TF_DIM;
    const center = full
      ? '<path d="M' + (cx - size * 0.17) + ' ' + cy + ' l' + (size * 0.11) + ' ' + (size * 0.12) + ' l' + (size * 0.24) + ' -' + (size * 0.28) + '" fill="none" stroke="' + TF_GREEN + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/>'
      : '<text x="' + cx + '" y="' + (cy + size * 0.135) + '" text-anchor="middle" font-size="' + (size * 0.30) + '" font-weight="700" fill="' + TF_TXT + '" font-family="\'Barlow Condensed\',sans-serif">' + done + '/' + total + '</text>';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="flex-shrink:0;">'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + TF_TRACK + '" stroke-width="' + sw + '"/>'
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

  renderPage() {
    const gaps = this.gaps();
    const total = gaps.length;
    const healths = gaps.map(g => this.health(g));
    const running = healths.filter(h => h.state === 'running').length;
    const slipping = healths.filter(h => h.state === 'slipping').length;
    const atrisk = healths.filter(h => h.state === 'atrisk').length;
    const recovered = window.Recovery ? (Recovery.moduleSummary('traffic').recovered || 0) : 0;
    const pct = total ? Math.round(running / total * 100) : 0;

    let sub = [];
    if (slipping) sub.push(slipping + ' slipping');
    if (atrisk) sub.push(atrisk + ' behind');
    const subLine = sub.length ? '<span style="color:var(--t3);"> &middot; ' + sub.join(', ') + '</span>' : '';

    const header = '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Your Online Systems</div>'
      + '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:12px;">'
      + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:34px;font-weight:600;line-height:1;color:var(--t1);">' + running + '<span style="color:var(--t3);font-size:20px;"> / ' + total + '</span></span>'
      + '<span style="font-size:13px;color:var(--t2);">systems running' + subLine + '</span>'
      + '<span style="margin-left:auto;font-size:13px;color:var(--t2);">Recovered to date <span style="color:var(--gold);font-weight:700;font-family:\'Barlow Condensed\',sans-serif;font-size:18px;">' + App.fmtCurrency(recovered, 0) + '</span></span>'
      + '</div><div class="pf-progbar"><span style="width:' + pct + '%;"></span></div>'
      + this.measureLine(this.gap(this._workGap)) + '</div>';

    const timelineLink = '<div style="margin:-4px 0 16px;"><button class="btn btn-ghost btn-sm pf-timeline">See Your Recovery Timeline</button></div>';

    const rail = gaps.map((g, gi) => this.railTile(g, healths[gi])).join('');
    const detail = this._workGap ? this.detailHtml(this.gap(this._workGap)) : '';

    this.container.innerHTML = '<div class="screen">' + header + timelineLink
      + '<div class="pf-2pane"><div class="pf-rail">' + rail + '</div>'
      + '<div class="pf-detail">' + detail + '</div></div></div>';

    this.container.querySelectorAll('.pf-tile').forEach(t =>
      t.addEventListener('click', () => { this._workGap = t.dataset.gap; this.renderPage(); }));
    this.container.querySelector('.pf-timeline')?.addEventListener('click', () =>
      App.pushView(() => { if (window.S && S.RecoveryTimeline) S.RecoveryTimeline.render(this.container, 'traffic'); }));
    this.wireWorkspace();
  },

  railTile(g, h) {
    const logged = !!this.loggedDate(g.id);
    const rec = logged ? this.recoveredFor(g.id) : 0;
    const sel = g.id === this._workGap;
    const statusLine = '<span style="color:' + this.healthColor(h.state) + ';font-weight:700;">' + h.label + '</span>'
      + (logged && rec > 0 ? '<span style="color:var(--t3);"> &middot; ' + App.fmtCurrency(rec, 0) + ' recovered</span>' : '');
    return '<div class="pf-tile' + (sel ? ' sel' : '') + '" data-gap="' + esc(g.id) + '">'
      + '<div style="display:flex;align-items:center;gap:12px;">'
      + this.ring(h.good, h.watched, 44, h.state === 'running')
      + '<div style="min-width:0;flex:1;">'
      + '<div style="font-size:14px;font-weight:600;color:var(--t1);line-height:1.3;">' + esc(g.name) + '</div>'
      + '<div style="font-size:12px;margin-top:4px;line-height:1.4;">' + statusLine + '</div>'
      + '</div></div></div>';
  },

  detailHtml(g) {
    if (!g) return '';
    const steps = this.steps(g);
    const rows = steps.map((s, i) => ({ s, i, guide: this.stepStatus(g.id, i).kind === 'guide' }));
    const watchedHtml = rows.filter(x => !x.guide).map(x => this.stepRow(g, x.s, x.i)).join('');
    const guideHtml = rows.filter(x => x.guide).map(x => this.stepRow(g, x.s, x.i)).join('');

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
        body = since + 'Tracked and running. This one moves your visibility, not a dollar line.';
      }
    }
    return '<div style="margin-top:11px;padding-top:11px;border-top:1px solid var(--b2);font-size:12px;line-height:1.55;color:var(--t2);">' + nm + body + '</div>';
  },

  wireWorkspace() {
    this.container.querySelectorAll('.pf-go').forEach(btn => btn.addEventListener('click', () => { App._fixFocus = this._workGap; App.openScreen(btn.dataset.target); }));
  },

  showHowTo() {
    App.showHelpModal('How the Traffic Fix System Works', [
      { p: ['A fix is not a checklist you finish, it is a system you put in place and keep running. So Bar Cop does not ask you to tick boxes. For the work it can see, it reads your real data and shows whether it is happening.'] },
      { h: 'Your Online Systems', p: ['Each system in the left list is one demand lever, your Google profile, website, reviews, search, social, delivery, and email. The ring and status read off live data. Select one and its fix opens on the right, so you move between systems without leaving the page.'] },
      { h: 'What Bar Cop Verifies', p: ['Every step that maps to a number or a setting on your Online Tracker card counts: your profile checklist, your photo and citation counts, your response and open rates, your posting. Each shows a live status, In place, Building, or Under target, and grades partial work so you see exactly what is left. Save a card past a benchmark and it credits the Recovery Scoreboard on its own.'] },
      { h: 'Guidance Steps', p: ['The off-platform craft, writing the description, replying in your voice, merging duplicate listings, is marked Guidance. Bar Cop cannot see it happen on Google or Instagram, so it shows the step and never counts it as proof.'] },
      { h: 'Watch Out For', p: ['At the bottom of each system are the mistakes that quietly cost you visibility, the things Bar Cop cannot catch for you. Worth a read before you chase a number that looks off.'] },
      { h: 'It Starts On Its Own', p: ['There is no start button. The moment you log the first week, Bar Cop logs that day and measures from there. Website, email, and delivery turn into recovered dollars over time; the rest move your visibility without a clean dollar figure, and Bar Cop says so plainly instead of inventing one.'] }
    ]);
  }
};
