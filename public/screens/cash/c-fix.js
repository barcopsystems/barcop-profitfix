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
    'free-trapped': {
      0: { kind: 'recur', signal: 'view:c-trapped', maxDays: 9, every: 'every week' },
      1: { kind: 'recur', signal: 'count', maxDays: 9, every: 'every week' },
      2: { kind: 'recur', signal: 'view:ic-par-suggestions', maxDays: 9, every: 'every week' }
    },
    'order-to-par': {
      0: { kind: 'recur', signal: 'view:c-purchasing', maxDays: 9, every: 'every week' },
      1: { kind: 'recur', signal: 'view:ic-par-suggestions', maxDays: 9, every: 'every week' },
      2: { kind: 'recur', signal: 'order', maxDays: 14, every: 'every order you place' },
      3: { kind: 'recur', signal: 'count', maxDays: 9, every: 'every week' }
    },
    'stay-ahead': {
      0: { kind: 'recur', signal: 'view:c-forecast', maxDays: 9, every: 'every week' },
      1: { kind: 'state', key: 'tightweek' }
    },
    'pay-on-terms': {
      0: { kind: 'state', key: 'terms' },
      3: { kind: 'recur', signal: 'view:ic-vendors', maxDays: 95, every: 'once a quarter' }
    }
  },
  SIGNALS: {
    count: () => (App.inventoryData && App.inventoryData.ic_counts) || [],
    order: () => (App.inventoryData && App.inventoryData.ic_orders) || []
  },

  gaps() { return (window.FIX && Array.isArray(FIX.cash)) ? FIX.cash : []; },
  gap(id) { return this.gaps().find(g => g.id === id) || null; },
  steps(g) { return (g && g.process && g.process.steps) || []; },

  // ── Verification ────────────────────────────────────────────────────────────
  lastActivity(signal) {
    // View-stamp signals (view:<key>) read the day a "review/read this screen"
    // target was last opened, stamped automatically on navigate (App.fix_views).
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
  daysSince(d) {
    if (!d) return null;
    const a = new Date(d + 'T00:00:00').getTime();
    const b = new Date(App.todayLocal() + 'T00:00:00').getTime();
    return Math.max(0, Math.floor((b - a) / 86400000));
  },
  agoText(ds) { return ds === 0 ? 'today' : ds === 1 ? 'yesterday' : ds + ' days ago'; },

  // State checks: "good" means no outstanding work right now.
  // Use the SAME 13-week survival forecast every other cash screen uses (c-audit /
  // c-dashboard / c-forecast). The old CashEngine.forecast() is a stale twin that
  // omits projected recurring bills, events, cash outflows, tax remittances, and the
  // week-0 proration, so it reported "clear ahead" while the rest of Cash showed
  // tight weeks. This is the Cash Fix "Stay Ahead" health read, so it must match.
  tightWeeks() { const sf = CashEngine.survivalForecast(13); return (sf && typeof sf.tightWeeks === 'number') ? sf.tightWeeks : 0; },
  termsSet()   { return CashEngine.termVendors().length; },
  // The DENOMINATOR the terms step is judged against. Without it "have you set any terms at
  // all" masquerades as "is this system running" — see stepStatus below.
  vendorCount() { return CashEngine.vendors().length; },

  // Does the system behind a gap actually hold data yet? Gates the review steps so
  // they cannot read On track on a fresh account. Mirrors each gap's systemRead.
  gapHasData(id) {
    if (id === 'free-trapped') return !!CashEngine.trapped().hasData;
    if (id === 'order-to-par') return !!CashEngine.overOrder(3).hasData;
    if (id === 'stay-ahead')   return !!CashEngine.survivalForecast(13).hasData;
    if (id === 'pay-on-terms') return CashEngine.vendors().length > 0;   // data = you have vendors to set terms on
    return true;
  },

  // Status for one step → {kind, good, label, color, sub} or {kind:'guide'}.
  stepStatus(gapId, idx) {
    const t = (this.TRACK[gapId] || {})[idx];
    if (!t) return { kind: 'guide' };
    if (t.kind === 'state') {
      // A zero count reads "all clear" only when there is data behind it. On a fresh
      // account a vacuous zero must not go green, so it reads Not started instead.
      if (!this.gapHasData(gapId)) return { kind: 'state', good: false, state: 'never', label: 'Not started', color: 'var(--t3)', sub: 'No data yet' };
      if (t.key === 'tightweek') {
        const n = this.tightWeeks(); const good = n === 0;
        return { kind: 'state', good, state: good ? 'clear' : 'open', label: good ? 'Clear ahead' : n + (n === 1 ? ' tight week ahead' : ' tight weeks ahead'), color: good ? 'var(--green)' : 'var(--amber)', sub: good ? '' : 'Cover it before it bites' };
      }
      /* ⛔ "ANY VENDOR HAS TERMS" IS NOT "THE TERMS ARE SET". This read `good = n > 0`, so one
         vendor on terms turned the step green and rolled the whole system up to "On track" —
         while the Cash Audit ranked "Set payment terms on the 2 vendors without them" as an
         open action item and its FIX THIS button deep-linked to THIS system. The operator was
         sent here to do a job and told nothing was outstanding. Measured on the demo bar: 4 of
         6 vendors on terms, step green, system On track, audit action item #3 open.
         The denominator was available the whole time — gapHasData() two functions up already
         calls CashEngine.vendors(). Same shape as [[the-loop]] #72: a count that goes green at
         zero without asking what it could not evaluate. */
      const n = this.termsSet(), total = this.vendorCount();
      const missing = Math.max(0, total - n);
      const good = total > 0 && missing === 0;
      return { kind: 'state', good, state: good ? 'clear' : 'open',
        label: total > 0 ? n + ' of ' + total + (total === 1 ? ' vendor on terms' : ' vendors on terms') : 'No vendor terms set',
        color: good ? 'var(--green)' : 'var(--amber)',
        sub: good ? '' : (n === 0 ? 'Set your vendor terms'
          : missing + (missing === 1 ? ' vendor is' : ' vendors are') + ' still paying on delivery') };
    }
    const last = this.lastActivity(t.signal);
    // A review step (view:<screen>) goes green just by opening that screen. Until the
    // system it reviews actually holds data, that view proves nothing, so it reads
    // Not started rather than On track off a drive-by page load on a fresh account.
    if (t.signal && t.signal.indexOf('view:') === 0 && !this.gapHasData(gapId)) {
      return { kind: 'recur', good: false, never: true, state: 'never', label: 'Not started', color: 'var(--t3)', sub: 'No data yet, ' + t.every };
    }
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
    if (id === 'stay-ahead') { const n = this.tightWeeks(); return n ? n + (n === 1 ? ' tight week' : ' tight weeks') + ' in the next thirteen' : 'no tight weeks in the next thirteen'; }
    // Same denominator as the step above, so the header line and the step cannot disagree
    // about how much of this system is actually done.
    const tv = this.termsSet(), tot = this.vendorCount();
    return tot ? tv + ' of ' + tot + (tot === 1 ? ' vendor' : ' vendors') + ' on terms' : 'no vendors set up yet';
  },

  // ── Status ring (SVG literal hex per the SVG-fill rule) ─────────────────────
  // In progress: a thin neutral arc with the step count. On track: the exact
  // thin green circle + check from the Delivery Recorded confirmation, scaled to
  // size (delivery is drawn in a 40 box, so f = size / 40).
  ring(done, total, size, full) {
    const f = size / 40, fx = n => +(n * f).toFixed(2);
    const cx = fx(20), cy = fx(20), r = fx(17);
    const open = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" fill="none" style="flex-shrink:0;">';
    if (full) {
      return open
        + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" stroke="' + CF_GREEN + '" stroke-width="' + fx(1.8) + '"/>'
        + '<path d="M' + fx(12) + ' ' + fx(20.5) + 'l' + fx(5.5) + ' ' + fx(5.5) + 'L' + fx(28) + ' ' + fx(14) + '" stroke="' + CF_GREEN + '" stroke-width="' + fx(2.2) + '" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    const sw = fx(1.8);
    const circ = 2 * Math.PI * r;
    const pct = total > 0 ? Math.min(1, done / total) : 0;
    const off = circ * (1 - pct);
    const prog = pct > 0 ? CF_GREY : CF_DIM;
    return open
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" stroke="' + CF_TRACK + '" stroke-width="' + sw + '"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" stroke="' + prog + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" style="transition:stroke-dashoffset .4s ease;"/>'
      + '<text x="' + cx + '" y="' + (cy + size * 0.135) + '" text-anchor="middle" font-size="' + fx(12) + '" font-weight="700" fill="' + CF_TXT + '" font-family="\'Barlow Condensed\',sans-serif">' + done + '/' + total + '</text>'
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
    const gaps = this.gaps();
    if (focus && this.gap(focus)) this._workGap = focus;
    else {
      // Auto-open the first system that is not On track (the one that needs
      // work); if every system is On track, open the first one.
      const needs = gaps.find(g => this.health(g).state !== 'running');
      this._workGap = needs ? needs.id : (gaps.length ? gaps[0].id : null);
    }
    this.renderPage();
  },

  // ── One single-column page: the systems overview card on top, then each cash
  //    system as a Close-The-Week-style accordion step (its health ring is the
  //    circle). Opening one expands its fix in place; the page is never left. ────
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

    const systems = gaps.map((g, gi) => this.systemRow(g, healths[gi])).join('');

    const playbookLink = '<div style="margin:-4px 0 16px;display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-ghost btn-sm cf-timeline">See Your Recovery Timeline</button><button class="btn btn-ghost btn-sm cf-playbook">Read the Cash Playbook</button></div>';
    this.container.innerHTML = '<div class="screen">' + header + playbookLink + systems + '</div>';

    this.container.querySelectorAll('.pf-sys-head').forEach(t =>
      t.addEventListener('click', () => { this._workGap = (this._workGap === t.dataset.gap) ? null : t.dataset.gap; this.renderPage(); }));
    this.container.querySelector('.cf-timeline')?.addEventListener('click', () =>
      App.pushView(() => { if (window.S && S.RecoveryTimeline) S.RecoveryTimeline.render(this.container, 'cash'); }));
    this.container.querySelector('.cf-playbook')?.addEventListener('click', () => { if (window.S && S.RecoveryPlaybook) S.RecoveryPlaybook.open('cash'); });
    this.wireWorkspace();
  },

  // One cash system as a Close-The-Week-style accordion step. The circle is the
  // system's health ring (steps-done count, or a green check when On track). Open
  // = gold-tint, On track when collapsed = the done look (--input), else --surface.
  systemRow(g, h) {
    const open = g.id === this._workGap;
    const bg = open ? 'var(--gold-tint)' : (h.state === 'running' ? 'var(--input)' : 'var(--surface)');
    const statusLine = '<span style="color:' + this.healthColor(h.state) + ';font-weight:700;">' + esc(h.label) + '</span>'
      + (window.FixPanel ? FixPanel.stillShortNote(g.id, h.state) : '');
    let html = '<div style="border:1px solid var(--b-edge);border-radius:var(--r);background:' + bg + ';overflow:hidden;margin-bottom:10px;">'
      + '<div class="pf-sys-head' + (open ? '' : ' collapsed') + '" data-gap="' + esc(g.id) + '" style="display:flex;align-items:center;gap:13px;padding:14px 16px;cursor:pointer;">'
      + this.ring(h.good, h.watched, 30, h.watched > 0 && h.state === 'running')
      + '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--t1);line-height:1.3;">' + esc(g.name) + '</div>'
      + '<div style="font-size:12px;margin-top:3px;line-height:1.4;">' + statusLine + '</div></div>'
      + '<span class="card-chevron" aria-hidden="true">&#9662;</span>'
      + '</div>';
    if (open) html += '<div style="padding:2px 16px 18px;">' + this.detailHtml(g) + '</div>';
    return html + '</div>';
  },

  detailHtml(g) {
    if (!g) return '';
    const sysAtRisk = this.health(g).state === 'atrisk';
    const steps = this.steps(g);
    const rows = steps.map((s, i) => ({ s, i, guide: this.stepStatus(g.id, i).kind === 'guide' }));
    const watchedHtml = rows.filter(x => !x.guide).map(x => this.stepRow(g, x.s, x.i, sysAtRisk)).join('');
    const guideHtml = rows.filter(x => x.guide).map(x => this.stepRow(g, x.s, x.i, sysAtRisk)).join('');

    // Steps sit directly in the open accordion body as #0D181E blocks (no nested
    // cards), with the Guidance and Watch Out For sections under their headings.
    const guideBlock = guideHtml
      ? '<div class="sh" style="margin:16px 0 10px;">Guidance</div>' + guideHtml : '';

    const mistakes = Array.isArray(g.commonMistakes) ? g.commonMistakes.slice(0, 4) : [];
    const watchOut = mistakes.length
      ? '<div class="sh" style="margin:16px 0 10px;">Watch Out For</div>'
        + '<div style="background:#0D181E;border:1px solid var(--b-edge);border-radius:8px;padding:14px 16px;">'
        + mistakes.map(t => '<div style="display:flex;gap:10px;padding:5px 0;font-size:12px;color:var(--t2);line-height:1.55;">'
            + '<span style="flex-shrink:0;width:5px;height:5px;border-radius:50%;background:var(--red);margin-top:7px;"></span><span>' + esc(t) + '</span></div>').join('')
        + '</div>' : '';

    return watchedHtml + guideBlock + watchOut;
  },

  // A bordered card per step (clear separation, like the Close The Week steps).
  // The WHOLE card is the link into the feature; the status is a colored subline
  // tied right under the title. A watched step that is current shows only its
  // status line; one that needs work also shows the how-to. Guidance steps always
  // show their description. A not-started step turns red when it is what is
  // dragging the system behind, so the red system warning points to the exact step.
  stepRow(g, s, i, sysAtRisk) {
    const st = this.stepStatus(g.id, i);
    const kind = s.kind || 'action';
    const isGuide = st.kind === 'guide';
    const expanded = isGuide || !st.good;

    const statusColor = (st.never && sysAtRisk) ? 'var(--red)' : st.color;
    const statusLine = isGuide ? ''
      : '<div style="font-size:11px;font-weight:700;color:' + statusColor + ';margin-top:4px;">' + esc(st.label)
        + (st.sub ? '<span style="color:var(--t3);font-weight:400;"> &middot; ' + esc(st.sub) + '</span>' : '') + '</div>';
    const detail = (expanded && s.detail)
      ? '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-top:8px;">' + esc(s.detail) + '</div>' : '';

    const inner = '<span style="color:var(--t3);flex-shrink:0;margin-top:1px;">' + this.stepIcon(kind) + '</span>'
      + '<div style="min-width:0;flex:1;">'
      + '<span style="font-size:13px;font-weight:700;color:var(--t1);line-height:1.35;">' + esc(s.title) + '</span>'
      + statusLine + detail + '</div>';

    if (s.target) {
      return '<div class="pf-step pf-stepcard cf-go" data-target="' + esc(s.target) + '">' + inner + '</div>';
    }
    return '<div class="pf-step">' + inner + '</div>';
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
      { h: 'Your Cash Systems', p: ['Each system below is one cash lever. The ring and status read off live data. Open one and its fix expands in place, so you move between systems without leaving the page. A system reads On track only while its watched work is current; the moment one lapses it tells you exactly what is slipping or behind.'] },
      { h: 'Watched Steps', p: ['The work Bar Cop can verify shows a live status: your weekly count, the orders you place, a tight week sitting in your forecast, whether your vendor terms are set. You cannot fake a logged count. Steps it genuinely cannot see, holding a bill to its due date, asking a rep for better terms, are marked Guidance and never counted as proof.'] },
      { h: 'Cash Freed', p: ['The figure up top is what you have actually freed: how far your trapped cash has come down from your own first weeks, read off your count history. It is the real reduction in capital tied up on the shelf, not a projection, and it builds as you count.'] },
      { h: 'See Your Recovery Timeline', p: ['The See Your Recovery Timeline button above the systems opens a chart of your Cash Freed building from zero to now, count by count, so you can see the climb instead of just one running total. It also shows which phase you are in, building your baseline, measuring, or live and tracked.'] }
    ]);
  }
};
