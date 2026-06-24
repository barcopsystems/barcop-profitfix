'use strict';

/* ── Cash Fix — the Cash Recovery Fix System (same rail as Profit/Revenue Fix) ─
   The four Cash Fix Systems on the shared master-detail rail: a left list of
   systems with a live health read, the selected system's fix on the right. Built
   to the profit-fix.js template. The honesty rule holds: the work Bar Cop can
   verify (weekly counts, orders placed, vendor terms set, a tight week in the
   forecast) shows a live status; the rest is Guidance. "Cash freed to date" is
   the measured drop in trapped capital from your own first weeks, off your count
   history, never a metric-times-revenue guess. Verification map here; fix content
   in fix-cash.js. */

const CF_GREEN = '#518A79';
const CF_GREY  = '#6E7C86';
const CF_TRACK = '#0D181E';
const CF_DIM   = '#1B2630';
const CF_TXT   = '#C9D3DA';

S.CashFix = {
  _workGap: null,

  // Which steps Bar Cop can verify, keyed by gap id then step index. Unlisted
  // steps are Guidance (no status, never counted as proof).
  TRACK: {
    'free-trapped': { 1: { kind: 'recur', signal: 'count', maxDays: 9, every: 'every week' } },
    'order-to-par': { 2: { kind: 'recur', signal: 'order', maxDays: 14, every: 'every order you place' }, 3: { kind: 'recur', signal: 'count', maxDays: 9, every: 'every week' } },
    'stay-ahead':   { 0: { kind: 'state', key: 'tightweek' } },
    'pay-on-terms': { 0: { kind: 'state', key: 'terms' } }
  },
  SIGNALS: {
    count: () => (App.inventoryData && App.inventoryData.ic_counts) || [],
    order: () => (App.inventoryData && App.inventoryData.ic_orders) || []
  },

  gaps() { return (window.FIX && Array.isArray(FIX.cash)) ? FIX.cash : []; },
  gap(id) { return this.gaps().find(g => g.id === id) || null; },
  steps(g) { return (g && g.process && g.process.steps) || []; },
  docPath(file) { return 'assets/resources/' + encodeURIComponent(file); },

  // ── Verification ────────────────────────────────────────────────────────────
  lastActivity(signal) {
    const arr = (this.SIGNALS[signal] || (() => []))();
    let latest = null;
    arr.forEach(r => {
      const d = r.period_end || r.date || (r.run_at ? App.ymdLocal(new Date(r.run_at)) : '') || (r.created_at ? App.ymdLocal(new Date(r.created_at)) : '');
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

  // State checks: "good" means no outstanding work right now.
  tightWeeks() { return CashEngine.forecast(4).filter(r => r.net < 0).length; },
  termsSet()   { return CashEngine.termVendors().length; },

  // Status for one step → {kind, good, label, color, sub} or {kind:'guide'}.
  stepStatus(gapId, idx) {
    const t = (this.TRACK[gapId] || {})[idx];
    if (!t) return { kind: 'guide' };
    if (t.kind === 'state') {
      if (t.key === 'tightweek') {
        const n = this.tightWeeks(); const good = n === 0;
        return { kind: 'state', good, state: good ? 'clear' : 'open', label: good ? 'Clear ahead' : n + (n === 1 ? ' tight week ahead' : ' tight weeks ahead'), color: good ? 'var(--green)' : 'var(--amber)', sub: good ? '' : 'Cover it before it bites' };
      }
      const n = this.termsSet(); const good = n > 0;
      return { kind: 'state', good, state: good ? 'clear' : 'open', label: good ? n + (n === 1 ? ' vendor on terms' : ' vendors on terms') : 'No vendor terms set', color: good ? 'var(--green)' : 'var(--amber)', sub: good ? '' : 'Set your vendor terms' };
    }
    const last = this.lastActivity(t.signal);
    const ds = this.daysSince(last);
    if (ds == null) return { kind: 'recur', good: false, never: true, state: 'never', label: 'Not started', color: 'var(--t3)', sub: 'No record yet, ' + t.every };
    let state, label, color;
    if (ds <= t.maxDays)          { state = 'ontrack';  label = 'On track'; color = 'var(--green)'; }
    else if (ds <= t.maxDays * 2) { state = 'slipping'; label = 'Slipping'; color = 'var(--amber)'; }
    else                          { state = 'behind';   label = 'Behind';   color = 'var(--red)'; }
    return { kind: 'recur', good: state === 'ontrack', state, label, color, sub: 'Last done ' + this.agoText(ds) + ', ' + t.every };
  },

  // Roll the watched steps up into one health read for the gap.
  health(g) {
    const watched = this.steps(g).map((s, i) => this.stepStatus(g.id, i)).filter(st => st.kind !== 'guide');
    if (!watched.length) return { state: 'guide', label: 'Guidance', good: 0, watched: 0 };
    const good = watched.filter(st => st.good).length;
    const rs = watched.filter(st => st.kind === 'recur' || st.kind === 'setup');
    const untouched = rs.length > 0 && rs.every(st => (st.kind === 'recur' ? st.never : !st.good));
    const behind = watched.filter(st => (st.kind === 'recur' && (st.state === 'behind' || st.never))).length;
    const slipping = watched.filter(st => (st.kind === 'recur' && st.state === 'slipping') || (st.kind === 'state' && !st.good)).length;
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

  // The selected system's current cash read, for the line under the progress bar.
  systemRead(id) {
    if (id === 'free-trapped') { const t = CashEngine.trapped(); return t.hasData ? App.fmtCurrency(t.total, 0) + ' trapped on the shelf right now' : 'Take a count and Bar Cop reads what is trapped'; }
    if (id === 'order-to-par') { const o = CashEngine.overOrder(3); if (!o.hasData) return 'Take two counts and Bar Cop reads your weeks on hand'; const w = o.weeksOnHand != null ? o.weeksOnHand.toFixed(1) + ' weeks on hand' : 'on par'; return w + (o.excess > 0 ? ', ' + App.fmtCurrency(o.excess, 0) + ' tied up beyond target' : ''); }
    if (id === 'stay-ahead') { const n = this.tightWeeks(); return n ? n + (n === 1 ? ' tight week' : ' tight weeks') + ' in the next four' : 'no tight weeks in the next four'; }
    const tv = this.termsSet(); return tv ? tv + (tv === 1 ? ' vendor' : ' vendors') + ' on terms' : 'no vendor terms set yet';
  },

  // ── Progress ring (SVG literal hex per the SVG-fill rule) ───────────────────
  ring(done, total, size, full) {
    const sw = Math.max(3, Math.round(size / 11));
    const r = (size - sw) / 2, cx = size / 2, cy = size / 2;
    const circ = 2 * Math.PI * r;
    const pct = total > 0 ? Math.min(1, done / total) : 0;
    const off = circ * (1 - pct);
    const prog = pct > 0 ? CF_GREY : CF_DIM;
    const center = full
      ? '<path d="M' + (cx - size * 0.17) + ' ' + cy + ' l' + (size * 0.11) + ' ' + (size * 0.12) + ' l' + (size * 0.24) + ' -' + (size * 0.28) + '" fill="none" stroke="' + CF_GREEN + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/>'
      : '<text x="' + cx + '" y="' + (cy + size * 0.135) + '" text-anchor="middle" font-size="' + (size * 0.30) + '" font-weight="700" fill="' + CF_TXT + '" font-family="\'Barlow Condensed\',sans-serif">' + done + '/' + total + '</text>';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="flex-shrink:0;">'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + CF_TRACK + '" stroke-width="' + sw + '"/>'
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
    const freed = CashEngine.freed();
    const pct = total ? Math.round(running / total * 100) : 0;

    let sub = [];
    if (slipping) sub.push(slipping + ' slipping');
    if (atrisk) sub.push(atrisk + ' behind');
    const subLine = sub.length ? '<span style="color:var(--t3);"> &middot; ' + sub.join(', ') + '</span>' : '';

    const freedHtml = freed.building
      ? '<span style="margin-left:auto;font-size:13px;color:var(--t2);">Cash freed <span style="color:var(--t3);">building</span></span>'
      : '<span style="margin-left:auto;font-size:13px;color:var(--t2);">Cash freed to date <span style="color:var(--gold);font-weight:700;font-family:\'Barlow Condensed\',sans-serif;font-size:18px;">' + App.fmtCurrency(freed.dollars, 0) + '</span></span>';

    const header = '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Your Cash Systems</div>'
      + '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:12px;">'
      + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:34px;font-weight:600;line-height:1;color:var(--t1);">' + running + '<span style="color:var(--t3);font-size:20px;"> / ' + total + '</span></span>'
      + '<span style="font-size:13px;color:var(--t2);">systems running' + subLine + '</span>'
      + freedHtml
      + '</div><div class="pf-progbar"><span style="width:' + pct + '%;"></span></div>'
      + this.measureLine(this.gap(this._workGap)) + '</div>';

    const rail = gaps.map((g, gi) => this.railTile(g, healths[gi])).join('');
    const detail = this._workGap ? this.detailHtml(this.gap(this._workGap)) : '';

    const playbookLink = '<div style="margin:-4px 0 16px;display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-ghost btn-sm cf-playbook">Read the Cash Playbook</button></div>';
    this.container.innerHTML = '<div class="screen">' + header + playbookLink
      + '<div class="pf-2pane"><div class="pf-rail">' + rail + '</div>'
      + '<div class="pf-detail">' + detail + '</div></div></div>';

    this.container.querySelectorAll('.pf-tile').forEach(t =>
      t.addEventListener('click', () => { this._workGap = t.dataset.gap; this.renderPage(); }));
    this.container.querySelector('.cf-playbook')?.addEventListener('click', () => { if (window.S && S.RecoveryPlaybook) S.RecoveryPlaybook.open('cash'); });
    this.wireWorkspace();
  },

  railTile(g, h) {
    const sel = g.id === this._workGap;
    const statusLine = '<span style="color:' + this.healthColor(h.state) + ';font-weight:700;">' + h.label + '</span>';
    return '<div class="pf-tile' + (sel ? ' sel' : '') + '" data-gap="' + esc(g.id) + '">'
      + '<div style="display:flex;align-items:center;gap:12px;">'
      + this.ring(h.good, h.watched, 44, h.watched > 0 && h.state === 'running')
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
      ? '<div class="card" style="padding:0;overflow:hidden;margin-bottom:18px;">' + watchedHtml + '</div>' : '';
    const guideCard = guideHtml
      ? '<div class="sh" style="margin:0 0 12px;">Guidance</div><div class="card" style="padding:0;overflow:hidden;margin-bottom:18px;">' + guideHtml + '</div>' : '';

    const mistakes = Array.isArray(g.commonMistakes) ? g.commonMistakes.slice(0, 4) : [];
    const watchOut = mistakes.length
      ? '<div class="sh" style="margin:0 0 12px;">Watch Out For</div><div class="card">'
        + mistakes.map(t => '<div style="display:flex;gap:10px;padding:5px 0;font-size:12px;color:var(--t2);line-height:1.55;">'
            + '<span style="flex-shrink:0;width:5px;height:5px;border-radius:50%;background:var(--red);margin-top:7px;"></span><span>' + esc(t) + '</span></div>').join('')
        + '</div>' : '';

    return systemCard + guideCard + watchOut;
  },

  stepRow(g, s, i) {
    const st = this.stepStatus(g.id, i);
    const kind = s.kind || 'action';
    const label = esc(s.targetLabel || '');
    let action = '';
    if (s.target) {
      const verb = kind === 'result' ? 'View' : 'Open';
      action = '<button class="btn btn-ghost btn-sm cf-go" data-target="' + esc(s.target) + '" style="display:inline-flex;align-items:center;gap:6px;">' + this.stepIcon(kind) + verb + (label ? ': ' + label : '') + '</button>';
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
    const f = CashEngine.freed();
    const nm = '<span style="color:var(--t1);font-weight:600;">' + esc(g.name) + '</span>';
    const freedBit = f.building
      ? ' Cash freed builds here as you count.'
      : ' Across your systems you have freed <span style="color:var(--gold);font-weight:700;">' + App.fmtCurrency(f.dollars, 0) + '</span> from your first-weeks baseline.';
    return '<div style="margin-top:11px;padding-top:11px;border-top:1px solid var(--b2);font-size:12px;line-height:1.55;color:var(--t2);">' + nm + ': ' + esc(this.systemRead(g.id)) + '.' + freedBit + '</div>';
  },

  wireWorkspace() {
    this.container.querySelectorAll('.cf-go').forEach(btn => btn.addEventListener('click', () => { App._fixFocus = this._workGap; App.openScreen(btn.dataset.target); }));
  },

  showHowTo() {
    App.showHelpModal('How the Cash Fix System Works', [
      { p: ['A fix is not a checklist you finish, it is a system you keep running. So Bar Cop does not ask you to tick boxes. For the work it can see, it reads your real data and shows whether it is happening.'] },
      { h: 'Your Cash Systems', p: ['Each system in the left list is one cash lever. The ring and status read off live data. Select one and its fix opens on the right, so you move between systems without leaving the page. A system reads On track only while its watched work is current; the moment one lapses it tells you exactly what is slipping or behind.'] },
      { h: 'Watched Steps', p: ['The work Bar Cop can verify shows a live status: your weekly count, the orders you place, a tight week sitting in your forecast, whether your vendor terms are set. You cannot fake a logged count. Steps it genuinely cannot see, holding a bill to its due date, asking a rep for better terms, are marked Guidance and never counted as proof.'] },
      { h: 'Cash Freed', p: ['The figure up top is what you have actually freed: how far your trapped cash has come down from your own first weeks, read off your count history. It is the real reduction in capital tied up on the shelf, not a projection, and it builds as you count.'] }
    ]);
  }
};
