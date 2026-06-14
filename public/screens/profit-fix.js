'use strict';

/* ── Profit Fix — the Profit Recovery Fix Layer (campaign redesign) ────────────
   A visual, guided take on working your leaks (the Active Shift design language):
     • Landing = a campaign of LEAK TILES, each with a progress ring (steps done
       of total). A slim header tracks leaks fixed + recovered to date.
     • Tap a tile → a focused WORKSPACE that walks you one step at a time: the
       current step is the highlighted action, finished steps collapse above,
       upcoming steps preview below. A big ring fills as you go; finishing every
       step lights up "Mark This Leak Fixed" and the recovered-money line.
   No color badges, status as colored text, step-type as a monochrome icon, help
   in the nav-"i". Profit only for now; ports to Revenue/Traffic once blessed.
   Reuses the FIX.profit content + the fix_progress / fix_log / fix_activity
   plumbing + the Recovery math (gapImpact / moduleSummary / compute). */

const PF_GOLD  = '#DBAB46';
const PF_TRACK = '#0D181E';
const PF_DIM   = '#1B2630';
const PF_TXT   = '#C9D3DA';

S.ProfitFix = {
  _workGap: null,
  _expStep: -1,

  gaps() { return (window.FIX && Array.isArray(FIX.profit)) ? FIX.profit : []; },
  gap(id) { return this.gaps().find(g => g.id === id) || null; },
  fixLog() { return (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : []; },
  progressOf(id) { return (App.data && App.data.fix_progress && App.data.fix_progress[id]) || []; },
  isLogged(id) { return this.fixLog().some(e => e.gap_id === id); },
  stepCount(g) { return (g && g.process && g.process.steps) ? g.process.steps.length : 0; },
  imp(id) { return window.Recovery ? Recovery.gapImpact(id) : null; },

  docPath(file) { return 'assets/resources/' + encodeURIComponent(file); },

  recoveredFor(id) {
    if (!window.Recovery) return 0;
    let r = 0;
    this.fixLog().filter(e => e.gap_id === id).forEach(e => {
      const c = Recovery.compute(e);
      if (c && c.status === 'ok' && c.dollars > 0) r += c.dollars;
    });
    return r;
  },

  // Monochrome progress ring (SVG: literal hex per the SVG-fill rule).
  ring(done, total, size, fixed) {
    const sw = Math.max(3, Math.round(size / 11));
    const r  = (size - sw) / 2, cx = size / 2, cy = size / 2;
    const circ = 2 * Math.PI * r;
    const pct  = total > 0 ? Math.min(1, done / total) : 0;
    const off  = circ * (1 - pct);
    const prog = (fixed || pct > 0) ? PF_GOLD : PF_DIM;
    const center = fixed
      ? '<path d="M' + (cx - size * 0.17) + ' ' + cy + ' l' + (size * 0.11) + ' ' + (size * 0.12) + ' l' + (size * 0.24) + ' -' + (size * 0.28) + '" fill="none" stroke="' + PF_GOLD + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/>'
      : '<text x="' + cx + '" y="' + (cy + size * 0.135) + '" text-anchor="middle" font-size="' + (size * 0.30) + '" font-weight="700" fill="' + PF_TXT + '" font-family="\'Barlow Condensed\',sans-serif">' + done + '/' + total + '</text>';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="flex-shrink:0;">'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + PF_TRACK + '" stroke-width="' + sw + '"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + prog + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" style="transition:stroke-dashoffset .4s ease;"/>'
      + center + '</svg>';
  },

  // Step-type icon (monochrome stroke, inherits color). No color badges.
  stepIcon(kind) {
    const p = kind === 'result'
      ? '<path d="M1 7s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.7"/>'
      : kind === 'reference'
        ? '<path d="M3.5 1.5h4l3 3v8h-7z"/><path d="M7.5 1.5v3h3"/>'
        : '<path d="M2.5 7h7M7 4l3 3-3 3"/>';
    return '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">' + p + '</svg>';
  },

  statusText(g) {
    if (this.isLogged(g.id)) {
      const rec = this.recoveredFor(g.id);
      return '<span style="color:var(--gold);font-weight:700;">Fixed</span>' + (rec > 0 ? '<span style="color:var(--t3);"> &middot; ' + App.fmtCurrency(rec, 0) + ' recovered</span>' : '');
    }
    const imp = this.imp(g.id);
    if (imp && imp.band) {
      const map = { over: ['Over', 'var(--red)'], watch: ['Watch', 'var(--amber)'], ok: ['On target', 'var(--gold)'] };
      const [label, color] = map[imp.band] || map.over;
      return '<span style="color:' + color + ';font-weight:700;">' + label + '</span>'
        + (imp.dollars > 0 ? '<span style="color:var(--t3);"> &middot; ' + App.fmtCurrency(imp.dollars, 0) + '/yr</span>' : '');
    }
    return '<span style="color:var(--t3);">Review</span>';
  },

  // ── Screen entry ────────────────────────────────────────────────────────────
  render(container) {
    this.container = container;
    const focus = App._fixFocus || null;
    App._fixFocus = null;
    this.renderLanding();
    if (focus && this.gap(focus)) App.pushView(() => this.enterWorkspace(focus));
  },

  // ── Landing: campaign header + leak tiles ───────────────────────────────────
  renderLanding() {
    const gaps = this.gaps();
    const total = gaps.length;
    const fixed = gaps.filter(g => this.isLogged(g.id)).length;
    const recovered = window.Recovery ? (Recovery.moduleSummary('profit').recovered || 0) : 0;
    const pct = total ? Math.round(fixed / total * 100) : 0;

    const header = '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">Your Profit Leaks</div>'
      + '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:12px;">'
      + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:34px;font-weight:600;line-height:1;color:var(--t1);">' + fixed + '<span style="color:var(--t3);font-size:20px;"> / ' + total + '</span></span>'
      + '<span style="font-size:13px;color:var(--t2);">leaks fixed</span>'
      + '<span style="margin-left:auto;font-size:13px;color:var(--t2);">Recovered to date <span style="color:var(--gold);font-weight:700;font-family:\'Barlow Condensed\',sans-serif;font-size:18px;">' + App.fmtCurrency(recovered, 0) + '</span></span>'
      + '</div>'
      + '<div class="pf-progbar"><span style="width:' + pct + '%;"></span></div>'
      + '</div>';

    const tiles = gaps.map(g => {
      const done = this.progressOf(g.id).length;
      const tot  = this.stepCount(g);
      const isFixed = this.isLogged(g.id);
      return '<div class="pf-tile' + (isFixed ? ' fixed' : '') + '" data-gap="' + esc(g.id) + '">'
        + '<div style="display:flex;align-items:center;gap:14px;">'
        + this.ring(done, tot, 48, isFixed)
        + '<div style="min-width:0;flex:1;">'
        + '<div style="font-size:14px;font-weight:600;color:var(--t1);line-height:1.3;">' + esc(g.name) + '</div>'
        + '<div style="font-size:12px;margin-top:4px;line-height:1.4;">' + this.statusText(g) + '</div>'
        + '</div></div></div>';
    }).join('');

    this.container.innerHTML = '<div class="screen">' + header + '<div class="pf-grid">' + tiles + '</div></div>';
    this.container.querySelectorAll('.pf-tile').forEach(t =>
      t.addEventListener('click', () => App.pushView(() => this.enterWorkspace(t.dataset.gap))));
  },

  // ── Workspace: one gap, guided one step at a time ───────────────────────────
  firstUnchecked(g) {
    const checked = new Set(this.progressOf(g.id));
    const steps = (g.process && g.process.steps) || [];
    for (let i = 0; i < steps.length; i++) if (!checked.has(i)) return i;
    return -1;
  },

  enterWorkspace(gapId) {
    const g = this.gap(gapId);
    if (!g) { this.renderLanding(); return; }
    this._workGap = gapId;
    this._expStep = this.firstUnchecked(g);
    this.renderWorkspace();
  },

  renderWorkspace() {
    const g = this.gap(this._workGap);
    if (!g) { this.renderLanding(); return; }
    const steps = (g.process && g.process.steps) || [];
    const checked = new Set(this.progressOf(g.id));
    const done = checked.size, tot = steps.length;
    const isLogged = this.isLogged(g.id);
    const allDone = tot > 0 && done >= tot;

    // Hero
    const imp = this.imp(g.id);
    let context;
    if (isLogged) context = '<span style="font-size:13px;color:var(--gold);font-weight:700;">Fixed</span>';
    else if (imp && imp.dollars > 0) {
      const color = imp.band === 'over' ? 'var(--red)' : imp.band === 'watch' ? 'var(--amber)' : 'var(--gold)';
      context = '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:600;color:' + color + ';">' + App.fmtCurrency(imp.dollars, 0) + '<span style="font-size:11px;color:var(--t3);font-weight:400;"> /yr at this week\'s pace</span></span>';
    } else context = '<span style="font-size:12px;color:var(--t3);">No live weekly dollar yet. Work the steps and watch it against your own numbers.</span>';

    const hero = '<div class="card form-card" style="margin-bottom:14px;">'
      + '<div style="display:flex;align-items:center;gap:18px;">'
      + this.ring(done, tot, 72, isLogged)
      + '<div style="min-width:0;flex:1;">'
      + '<div style="font-size:17px;font-weight:700;color:var(--t1);">' + esc(g.name) + '</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.55;margin:5px 0 8px;">' + esc(g.summary || '') + '</div>'
      + context
      + '</div></div></div>';

    // Watch Out For (compact red-accented callout)
    const mistakes = Array.isArray(g.commonMistakes) ? g.commonMistakes.slice(0, 4) : [];
    const watchOut = mistakes.length
      ? '<div class="card" style="margin-bottom:14px;border-left:3px solid var(--red);">'
        + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--red);margin-bottom:9px;">Watch Out For</div>'
        + mistakes.map(t => '<div style="display:flex;gap:10px;padding:4px 0;font-size:12px;color:var(--t2);line-height:1.55;">'
            + '<span style="flex-shrink:0;width:5px;height:5px;border-radius:50%;background:var(--red);margin-top:7px;"></span><span>' + esc(t) + '</span></div>').join('')
        + '</div>'
      : '';

    // Steps
    const stepsHtml = steps.map((s, i) => this.stepCard(g, s, i, checked.has(i), i === this._expStep)).join('');

    this.container.innerHTML = '<div class="screen">' + hero + watchOut
      + '<div class="sh" style="margin:4px 0 12px;">The Fix Process</div>' + stepsHtml
      + this.markFixedCard(g, allDone, isLogged) + '</div>';
    this.wireWorkspace();
  },

  stepCard(g, s, i, isChecked, isExpanded) {
    const num = i + 1;
    // Collapsed (done or upcoming, not the expanded one)
    if (!isExpanded) {
      const cls = isChecked ? 'pf-step done' : 'pf-step up';
      const mark = isChecked
        ? '<span class="pf-check on" style="width:22px;height:22px;border-width:2px;"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.5l2.5 2.5 4.5-5.5" stroke="#0B0F14" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
        : '<span style="flex-shrink:0;width:22px;height:22px;border-radius:50%;border:1px solid var(--b1);color:var(--t3);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">' + num + '</span>';
      return '<div class="' + cls + ' pf-srow" data-idx="' + i + '"><div style="display:flex;align-items:center;gap:12px;padding:13px 16px;">'
        + mark
        + '<span style="flex:1;min-width:0;font-size:13px;font-weight:600;color:' + (isChecked ? 'var(--t3)' : 'var(--t1)') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(s.title) + '</span>'
        + '<span style="flex-shrink:0;color:var(--t4);">' + this.stepIcon(s.kind) + '</span>'
        + '</div></div>';
    }
    // Expanded (the focused step): full detail + action
    const kind = s.kind || 'action';
    const label = esc(s.targetLabel || '');
    let action = '';
    if (kind === 'reference' && s.target) {
      action = '<a class="btn btn-ghost btn-sm" href="' + this.docPath(s.target) + '" download style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;">'
        + this.stepIcon('reference') + 'Download' + (label ? ': ' + label : '') + '</a>';
    } else if (s.target) {
      const verb = kind === 'result' ? 'View' : 'Open';
      action = '<button class="btn btn-primary btn-sm pf-go" data-target="' + esc(s.target) + '" style="display:inline-flex;align-items:center;gap:6px;">'
        + this.stepIcon(kind) + verb + (label ? ': ' + label : '') + '</button>';
    }
    const checkBtn = '<button class="pf-check' + (isChecked ? ' on' : '') + '" data-idx="' + i + '" aria-label="' + (isChecked ? 'Mark step not done' : 'Mark step done') + '">'
      + (isChecked ? '<svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.5l2.5 2.5 4.5-5.5" stroke="#0B0F14" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') + '</button>';
    return '<div class="pf-step cur" data-idx="' + i + '"><div style="padding:16px;">'
      + '<div style="display:flex;align-items:flex-start;gap:13px;">'
      + checkBtn
      + '<div style="flex:1;min-width:0;">'
      + '<div style="display:flex;align-items:center;gap:8px;"><span style="color:var(--t3);">' + this.stepIcon(kind) + '</span>'
      + '<span style="font-size:14px;font-weight:700;color:var(--t1);">' + esc(s.title) + '</span></div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.65;margin:7px 0 0;">' + esc(s.detail || '') + '</div>'
      + (action ? '<div style="margin-top:12px;">' + action + '</div>' : '')
      + (isChecked ? '' : '<button class="btn btn-ghost btn-sm pf-markstep" data-idx="' + i + '" style="margin-top:12px;">Mark step done</button>')
      + '</div></div></div>';
  },

  markFixedCard(g, allDone, isLogged) {
    const inputStyle = 'background:var(--bg);border:1px solid var(--b1);border-radius:4px;color:#fff;font-size:13px;padding:8px 10px;width:100%;color-scheme:dark;';
    if (isLogged) {
      const mine = this.fixLog().filter(e => e.gap_id === g.id).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const rows = mine.map(e => {
        const r = window.Recovery ? Recovery.compute(e) : { status: 'untracked' };
        let line = '', good = false;
        if (r.status === 'ok') {
          const move = r.fmt(r.before) + ' to ' + r.fmt(r.after);
          if (r.dollars != null && r.dollars > 0) { good = true; line = 'Recovered about ' + App.fmtCurrency(r.dollars) + ' so far' + (r.dollarsAnnual ? ', on pace for ' + App.fmtCurrency(r.dollarsAnnual) + ' a year' : '') + '. ' + r.label + ' ' + move + '.' + (r.mature ? '' : ' Preliminary, ' + r.weeksAfter + ' week' + (r.weeksAfter === 1 ? '' : 's') + ' of data so far.'); }
          else line = r.label + ' has not improved since this fix. ' + move + '.';
        } else if (r.status === 'pending') line = 'Measuring. ' + r.weeksAfter + ' week' + (r.weeksAfter === 1 ? '' : 's') + ' of data since this fix.';
        else if (r.status === 'no-baseline') line = 'No weeks logged before this date to measure recovery against.';
        return '<div style="padding:11px 0;border-top:1px solid var(--b2);"><div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--t2);">'
          + '<span style="flex-shrink:0;width:7px;height:7px;border-radius:50%;background:var(--gold);"></span>Implemented ' + esc(e.date)
          + '<button class="btn btn-ghost btn-sm pf-unlog" data-log="' + esc(e.id) + '" style="margin-left:auto;">Remove</button></div>'
          + (line ? '<div style="font-size:12px;line-height:1.6;margin:5px 0 0 15px;color:' + (good ? 'var(--gold)' : 'var(--t3)') + ';">' + esc(line) + '</div>' : '') + '</div>';
      }).join('');
      return '<div class="card form-card" style="margin-top:6px;border-color:var(--gold-tint-bord);background:var(--gold-tint);"><div class="card-title" style="color:var(--gold);">Leak Fixed</div>' + rows + '</div>';
    }
    const banner = allDone
      ? '<div style="font-size:13px;color:var(--gold);font-weight:700;line-height:1.5;margin-bottom:12px;">All steps done. Lock in the date and Bar Cop starts measuring what you win back.</div>'
      : '<div style="font-size:12px;color:var(--t3);line-height:1.5;margin-bottom:12px;">Finish the steps above, then lock in the date you put the fix in place.</div>';
    return '<div class="card form-card" style="margin-top:6px;' + (allDone ? 'border-color:var(--gold);' : '') + '"><div class="card-title">Mark This Leak Fixed</div>'
      + banner
      + '<div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">'
      + '<div class="f" style="width:180px;flex-shrink:0;"><label>Implemented On</label><input type="date" class="pf-impl-date" style="' + inputStyle + '"/></div>'
      + '<button class="btn ' + (allDone ? 'btn-primary' : 'btn-ghost') + ' pf-mark" data-gap="' + esc(g.id) + '" data-name="' + esc(g.name) + '">Mark This Leak Fixed</button>'
      + '</div></div>';
  },

  // ── Wiring ──────────────────────────────────────────────────────────────────
  wireWorkspace() {
    const c = this.container;
    // Expand a collapsed step (done or upcoming).
    c.querySelectorAll('.pf-srow').forEach(row => row.addEventListener('click', () => {
      this._expStep = parseInt(row.dataset.idx, 10); this.renderWorkspace();
    }));
    // Toggle the current step's checkbox.
    c.querySelectorAll('.pf-check[data-idx]').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation(); this.toggleStep(parseInt(btn.dataset.idx, 10));
    }));
    c.querySelectorAll('.pf-markstep').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation(); this.toggleStep(parseInt(btn.dataset.idx, 10));
    }));
    // Step deep-link: remember this gap so returning reopens it.
    c.querySelectorAll('.pf-go').forEach(btn => btn.addEventListener('click', () => {
      App._fixFocus = this._workGap; App.openScreen(btn.dataset.target);
    }));
    // Mark fixed.
    c.querySelector('.pf-mark')?.addEventListener('click', (ev) => {
      const dateEl = c.querySelector('.pf-impl-date');
      const date = dateEl ? dateEl.value : '';
      if (!date) { if (dateEl) dateEl.style.borderColor = 'var(--red)'; return; }
      const btn = ev.currentTarget;
      App.putRecord('core', 'fix_log', { id: App.uid(), module: 'profit', gap_id: btn.dataset.gap, gap_name: btn.dataset.name, date: date, logged_at: new Date().toISOString() });
      App.markSetupDone && App.markSetupDone('gs_p_fix');
      this.renderWorkspace();
    });
    c.querySelectorAll('.pf-unlog').forEach(btn => btn.addEventListener('click', () => {
      App.removeRecord('core', 'fix_log', btn.dataset.log); this.renderWorkspace();
    }));
  },

  toggleStep(idx) {
    const g = this.gap(this._workGap);
    if (!g) return;
    App.data.fix_progress = App.data.fix_progress || {};
    const arr = App.data.fix_progress[g.id] = App.data.fix_progress[g.id] || [];
    const at = arr.indexOf(idx);
    const wasChecked = at >= 0;
    if (wasChecked) arr.splice(at, 1); else arr.push(idx);
    App.saveKey('fix_progress');
    this.logActivity(g, idx, wasChecked);
    // Advance the focus to the next unchecked step after completing one.
    if (!wasChecked) this._expStep = this.firstUnchecked(g);
    this.renderWorkspace();
  },

  // Keep the module-scoped activity feed current (read by the dashboard).
  logActivity(g, idx, wasChecked) {
    App.data.fix_activity = App.data.fix_activity || [];
    const feed = App.data.fix_activity;
    if (wasChecked) {
      for (let i = feed.length - 1; i >= 0; i--) {
        if (feed[i].gap_id === g.id && feed[i].step_index === idx && feed[i].module === 'profit') { feed.splice(i, 1); break; }
      }
    } else {
      const step = g.process && g.process.steps && g.process.steps[idx];
      if (step) {
        feed.push({ id: App.uid(), module: 'profit', gap_id: g.id, gap_name: g.name, step_index: idx, step_title: step.title || '', step_kind: step.kind || 'action', ts: new Date().toISOString() });
        let cnt = feed.filter(a => a.module === 'profit').length;
        for (let i = 0; i < feed.length && cnt > 100; i++) { if (feed[i].module === 'profit') { feed.splice(i, 1); i--; cnt--; } }
      }
    }
    App.saveKey('fix_activity');
  },

  showHowTo() {
    App.showHelpModal('How Profit Fix Works', [
      { p: ['Your profit leaks, laid out as a campaign. Each tile is one leak with a ring that fills as you complete its fix. The header tracks how many you have fixed and what you have recovered.'] },
      { h: 'Working a Leak', p: ['Tap a tile to open it. Bar Cop walks you one step at a time: the current step is highlighted with its action button, finished steps collapse above, and what is coming previews below. Tap any step to jump to it.'] },
      { h: 'The Steps', p: ['Every step is a link into the part of Bar Cop that does the work. The icon tells you the kind: open the screen where the work happens, view where Bar Cop already shows the number, or download a policy or template. Mark each step done as you go.'] },
      { h: 'Watch Out For', p: ['Each leak lists the mistakes that quietly cost operators the most. Read them first. They are the things Bar Cop itself cannot stop.'] },
      { h: 'Mark It Fixed', p: ['When every step is done, lock in the date you put the fix in place. Bar Cop averages the eight weeks before and after to measure what the fix actually recovered, and tracks it on your dashboard. A figure shows once two weeks of after-data land.'] },
      { h: 'The Honest Rule', p: ['A dollar figure only shows when the math comes from real data Bar Cop already holds. A leak that cannot be dollarized honestly still gets worked and logged; its recovery shows as the score moving, not invented dollars.'] }
    ]);
  }
};
