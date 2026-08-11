'use strict';

/* ── Fix Panel — the Fix Layer renderer (v3, master/detail) ───────────────────
   Renders a Recovery module's gap-areas from the static FIX content. The Fix
   Layer is the connective spine of the platform: each fix-process step is a
   deep-link into the feature that performs it, never manual instruction text.

   v3 replaced the accordion of collapsible gap cards with a master/detail flow:
     • renderModule lands on a ranked LEAK BOARD (worst dollar leak first) plus a
       stat strip and the recent-activity feed.
     • Tapping a gap opens its FOCUSED fix page via App.pushView (floating-back to
       the board). Everything for that one gap is visible at once: summary +
       dollar context, Watch Out For (the gap's commonMistakes, now inline), the
       fix process (each step a deep-link + checkbox), and Mark Implemented.
   Shared by Profit / Revenue / Cash Fix, so this rebuild lifts all three.

   Step kinds:
     action    — deep-link to the Control/Recovery feature that does the task
     result    — deep-link to where the app already shows the computed number
     reference — a downloadable PDF/Word document (policies, standards)

   Help lives in each Fix screen's nav-"i" (FixPanel.howToSections). 100% static,
   zero API. */

window.FixPanel = {

  // Reference docs are generated in Bar Cop's own PDF style now (headed with the
  // operator's establishment name) instead of served as stored files. A reference
  // step whose target maps here downloads the generated doc via FixDocs; the map
  // is the bridge from the legacy stored-filename target to the generator id.
  DOC_IDS: {
    'Measured_Pour_Standards_Policy.docx':     'pour-standards',
    'Theft_Loss_Prevention_Policy.docx':       'theft-loss-policy',
    'Employee_Corrective_Action_Template.docx':'corrective-action',
    'Vendor_Agreement_Terms_Checklist.docx':   'vendor-terms',
    'Server_Upsell_Standards_Scripts.docx':    'server-standards',
    'Portion_Control_Audit.pdf':               'portion-audit',
    'Food_Handling_Portion_Standards.docx':    'food-standards'
  },

  gapAreas(moduleKey) {
    return (window.FIX && Array.isArray(FIX[moduleKey])) ? FIX[moduleKey] : [];
  },

  // The per-module Fix screen id a gap-area deep-links into.
  fixScreen(moduleKey) {
    return moduleKey === 'revenue' ? 'r-fix' : 'profit-fix';
  },

  /* ── "ON TRACK" IS ABOUT THE STEPS, NOT ABOUT THE NUMBER ────────────────────────────────────
     Kyle, 2026-08-10, on the handoff from the Hub: *"we are telling the user the biggest gap is
     check average and to go work the fix.. but when you go to the fix all steps are being worked..
     so it looks weird."*
     ⭐ MEASURED, AND IT IS NOT A DATA CONTRADICTION — BOTH STATEMENTS ARE TRUE ABOUT DIFFERENT
     THINGS. `Recovery.gapImpact('check-average')` returns `onTarget:false` with real money on the
     table, while `health()` returns "On track" because every watched STEP is current. So the
     operator arrives from a card that said "close this gap" and reads a green "On track", which
     reasonably looks like the app contradicting itself.
     ⛔ THE HONEST LINE NAMES WHICH ONE IT MEANS. A system can be run perfectly and still be short of
     target: that is the normal state of a fix that is working but has not landed yet, and hiding it
     is how "on track" comes to mean nothing.
     ⚠ ONE IMPLEMENTATION, THREE CALLERS. profit-fix, r-fix and c-fix each build this status line
     with their own copy of the same expression; a clause written into three of them separately is
     three things to keep in step, and the twins on this page have drifted before
     ([[the-loop]] step 0.5 — grep for the second IMPLEMENTATION, not the second caller). */
  stillShortNote(gapId, state) {
    if (state !== 'running' || !gapId) return '';
    if (!window.Recovery || !Recovery.gapImpact) return '';
    const imp = Recovery.gapImpact(gapId);
    /* No note when the gap has hit target, and none when it cannot be measured at all — an absent
       reading is not a failing one, and saying "short of target" over missing data would be the
       false-negative twin of the false $0 this codebase keeps producing. */
    if (!imp || imp.onTarget || !(imp.dollars > 0)) return '';
    return '<span style="color:var(--amber);"> &middot; still short of target</span>';
  },

  // Infer which gap-area a Priority Action Item belongs to from its text.
  // Used to route PAI clicks into the relevant Fix Process when the action
  // item lacks an explicit gap_id (older audits, Claude-generated items). The
  // sample-data and extractActionItems pipelines now tag gap_id explicitly,
  // so this is a fallback. Returns the gap_id string or null if no match.
  inferGapId(actionText, moduleKey) {
    const text = (actionText || '').toLowerCase();
    const maps = {
      profit: [
        { id: 'pour-cost',      k: ['pour cost', 'pour standard', 'jigger', 'bottle yield', 'liquor pour'] },
        { id: 'theft-loss',     k: ['void', 'comp rate', 'drawer', 'theft', 'cash variance', 'shrinkage'] },
        { id: 'food-cost',      k: ['food cost', 'recipe', 'portion', 'kitchen waste', 'waste'] },
        { id: 'vendor-control', k: ['vendor', 'invoice', 'price drift', 'overcharge', 'short count'] },
        { id: 'prime-cost',     k: ['prime cost', 'cogs gap', 'combined cogs'] }
      ],
      revenue: [
        { id: 'check-average',      k: ['check average', 'upsell', 'cover average'] },
        { id: 'labor-scheduling',   k: ['labor cost', 'labor over', 'schedule', 'staffing'] },
        { id: 'menu-engineering',   k: ['menu mix', 'star', 'plowhorse', 'puzzle', 'dog', 'menu engineering'] },
        { id: 'pricing',            k: ['pricing', 'reprice', 'menu price'] },
        { id: 'rplh',               k: ['rplh', 'revenue per labor'] },
        { id: 'server-performance', k: ['server performance', 'server spread', 'bottom third'] },
        { id: 'events-catering',    k: ['event revenue', 'catering', 'private dining'] }
      ]
    };
    const list = maps[moduleKey] || [];
    for (let i = 0; i < list.length; i++) {
      for (let j = 0; j < list[i].k.length; j++) {
        if (text.indexOf(list[i].k[j]) !== -1) return list[i].id;
      }
    }
    return null;
  },

  // ── Card-internal section header. Title sits inside the card with a divider
  // below it.
  sectionHeader(title, helpClass) {
    const help = helpClass
      ? '<button class="' + helpClass + '" style="background:transparent;border:1px solid var(--b1);border-radius:3px;'
        + 'color:var(--t3);font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;'
        + 'padding:4px 9px;cursor:pointer;">How this works</button>'
      : '';
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px 12px;border-bottom:1px solid var(--b2);">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">' + esc(title) + '</div>'
      + help
      + '</div>';
  },

  // ── "Fix Areas" rows. _fixAreasInner returns just the header + rows so the

  // The ranked "leak board": each gap-area as one entry, the dollar-bearing
  // leaks rendered as proportional bars (largest dollar first) and the rest as
  // compact tap-to-review rows. Composite gaps (prime cost = pour + food + labor)
  // are excluded so the same dollars are never shown twice. Honest by construction:
  // a gap shows a $/yr leak only when Recovery has a live weekly metric for it
  // (gapImpact non-null); gaps without one (e.g. Theft and Loss, Vendor Control)
  // show as a Review row, never an invented number. Rows keep .fp-fixarea +
  // data-gap/data-module so the caller routes the click into the fix process.
  _fixAreasInner(moduleKey) {
    const gaps = this.gapAreas(moduleKey);
    if (!gaps.length) return '';
    const log = (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    const fixProgress = (App.data && App.data.fix_progress) || {};
    const composite = (window.Recovery && Recovery.COMPOSITE_GAPS) || [];

    const entryFor = (g, module, opts) => {
      const imp = window.Recovery ? Recovery.gapImpact(g.id) : null;
      return {
        id: g.id, module: module, name: g.name, summary: g.summary || '',
        band: imp ? imp.band : null,
        dollars: imp ? (imp.dollars || 0) : 0,
        hasMetric: !!imp,
        logged: log.some(e => e.gap_id === g.id),
        stepsDone: (fixProgress[g.id] || []).length,
        stepsTotal: (g.process && g.process.steps) ? g.process.steps.length : 0,
        crossNote: (opts && opts.crossNote) || ''
      };
    };

    const entries = gaps
      .filter(g => composite.indexOf(g.id) === -1)
      .map(g => entryFor(g, moduleKey));

    // Labor is the third part of prime cost; its fix process lives in Revenue
    // Recovery, so on the Profit board it is appended as a cross-module entry.
    if (moduleKey === 'profit' && window.FIX && FIX.revenue) {
      const lg = FIX.revenue.find(x => x.id === 'labor-scheduling');
      if (lg) entries.push(entryFor(lg, 'revenue', { crossNote: 'in Revenue Recovery' }));
    }

    const BAND = {
      over:  { label: 'Over',      color: 'var(--red)',   bar: 'var(--red)' },
      watch: { label: 'Watch',     color: 'var(--amber)', bar: 'var(--amber)' },
      ok:    { label: 'On target', color: 'var(--gold)',  bar: 'var(--gold)' }
    };

    const leaking = entries.filter(e => e.hasMetric && e.dollars > 0).sort((a, b) => b.dollars - a.dollars);
    const rest    = entries.filter(e => !(e.hasMetric && e.dollars > 0));
    const maxD    = leaking.length ? leaking[0].dollars : 0;

    const steps = e => (e.stepsDone > 0 && !e.logged)
      ? '<span style="font-size:10px;color:var(--gold);margin-left:8px;">' + e.stepsDone + ' of ' + e.stepsTotal + ' fix steps</span>' : '';

    const leakRow = e => {
      const b = BAND[e.band] || BAND.over;
      const w = maxD > 0 ? Math.max(6, Math.round(e.dollars / maxD * 100)) : 6;
      return '<div class="fp-fixarea" data-gap="' + esc(e.id) + '" data-module="' + esc(e.module) + '" style="cursor:pointer;padding:11px 0;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;">'
        + '<div style="display:flex;align-items:center;gap:9px;min-width:0;">'
        + '<span style="font-size:13px;font-weight:600;color:var(--t1);">' + esc(e.name) + '</span>'
        + '<span style="font-size:9px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:' + b.color + ';">' + b.label + '</span>'
        + (e.crossNote ? '<span style="font-size:10px;color:var(--t3);">' + esc(e.crossNote) + '</span>' : '')
        + '</div>'
        + '<div style="flex-shrink:0;font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:600;color:' + b.color + ';line-height:1;">'
        + App.fmtCurrency(e.dollars, 0) + '<span style="font-size:10px;color:var(--t3);"> /yr</span></div>'
        + '</div>'
        + '<div style="height:7px;background:#0D181E;border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + w + '%;background:' + b.bar + ';border-radius:4px;"></div></div>'
        + (steps(e) ? '<div style="margin-top:5px;">' + steps(e).replace('margin-left:8px;', '') + '</div>' : '')
        + '</div>';
    };

    const flatRow = e => {
      const onTarget = e.band === 'ok';
      const right = onTarget
        ? '<span style="font-size:11px;font-weight:700;color:var(--gold);">On target</span>'
        : '<span style="font-size:11px;color:var(--t3);">' + (e.crossNote ? esc(e.crossNote) : 'Review') + ' &rsaquo;</span>';
      return '<div class="fp-fixarea" data-gap="' + esc(e.id) + '" data-module="' + esc(e.module) + '" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;">'
        + '<div style="min-width:0;"><span style="font-size:13px;font-weight:600;color:var(--t1);">' + esc(e.name) + '</span>' + steps(e) + '</div>'
        + right + '</div>';
    };

    const leakHtml = leaking.map(leakRow).join('');
    const restHtml = rest.map(flatRow).join('');
    const sep = (leakHtml && restHtml) ? '<div style="height:1px;background:var(--b2);margin:8px 0;"></div>' : '';
    return leakHtml + sep + restHtml;
  },

  // Text-only leak rows for the Recovery DASHBOARD "Where You're Leaking Now"
  // panel (no bars — Kyle's call). Same entries as the Fix-screen leak board,
  // but each row is name + band + the honest readout: a $/yr figure where
  // Recovery has a live weekly metric, "Review" otherwise, "On target" when ok.
  // Leaking-with-a-dollar first (largest first), then review rows, then on-target.
  // Rows keep .fp-fixarea + data-gap/data-module so wireFixAreas routes the tap.
  leakRowsText(moduleKey) {
    const gaps = this.gapAreas(moduleKey);
    if (!gaps.length) return '';
    const composite = (window.Recovery && Recovery.COMPOSITE_GAPS) || [];
    const entryFor = (g, module, crossNote) => {
      const imp = window.Recovery ? Recovery.gapImpact(g.id) : null;
      return { id:g.id, module, name:g.name, band: imp?imp.band:null,
        dollars: imp?(imp.dollars||0):0, hasMetric:!!imp, crossNote: crossNote||'' };
    };
    // Labor is part of prime cost but its fix lives in Revenue Recovery, so it is
    // NOT shown on the Profit leak panel (it has its own row on the Revenue
    // dashboard). Composite gaps (prime cost) are excluded so dollars never double.
    const entries = gaps.filter(g => composite.indexOf(g.id) === -1).map(g => entryFor(g, moduleKey));
    const BAND = { over:{label:'Over',color:'var(--red)'}, watch:{label:'Watch',color:'var(--amber)'}, ok:{label:'On target',color:'var(--gold)'} };
    const rank = e => (e.band === 'ok') ? 2 : (e.hasMetric && e.dollars > 0) ? 0 : 1;
    entries.sort((a,b) => rank(a) - rank(b) || b.dollars - a.dollars);
    const rows = entries.map((e,i) => {
      const b = BAND[e.band] || BAND.over;
      const last = i === entries.length - 1;
      const right = (e.hasMetric && e.dollars > 0)
        ? '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:17px;font-weight:600;color:' + b.color + ';white-space:nowrap;">' + App.fmtCurrency(e.dollars, 0) + '<span style="font-size:10px;color:var(--t3);"> /yr</span></span>'
        : (e.band === 'ok'
            ? '<span style="font-size:11px;font-weight:700;color:var(--gold);">On target</span>'
            : '<span style="font-size:11px;color:var(--t3);">' + (e.crossNote ? esc(e.crossNote) : 'Review') + ' &rsaquo;</span>');
      const tag = (e.hasMetric && e.dollars > 0)
        ? '<span style="font-size:9px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:' + b.color + ';">' + b.label + '</span>' : '';
      return '<div class="fp-fixarea" data-gap="' + esc(e.id) + '" data-module="' + esc(e.module) + '" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;' + (last ? '' : 'border-bottom:1px solid var(--row-div);') + '">'
        + '<div style="display:flex;align-items:center;gap:9px;min-width:0;"><span style="font-size:13px;font-weight:600;color:var(--t1);">' + esc(e.name) + '</span>' + tag + '</div>'
        + right + '</div>';
    }).join('');
    if (!rows) return '';
    return rows + '<div style="font-size:11px;color:var(--t4);padding-top:10px;border-top:1px solid var(--row-div);">Tap any line to dig in.</div>';
  },






  // Vertical fix-event markers for an annotated trend chart. xFn maps a week
  // index to an x coordinate; top/bottom are the plot edges.
  markerSvg(markers, xFn, top, bottom) {
    if (!markers || !markers.length) return '';
    return markers.map(m => {
      const x  = xFn(m.index).toFixed(1);
      const t  = top.toFixed(1);
      const b  = bottom.toFixed(1);
      const cy = (bottom - 5).toFixed(1);
      return ''
        + '<line x1="' + x + '" y1="' + t + '" x2="' + x + '" y2="' + cy + '" '
        +   'stroke="rgba(219,171,70,0.18)" stroke-width="1" stroke-dasharray="3,4"/>'
        + '<circle cx="' + x + '" cy="' + cy + '" r="4" fill="#DBAB46" '
        +   'stroke="rgba(0,0,0,0.35)" stroke-width="0.5">'
        +   '<title>' + esc(m.label) + ' implemented ' + esc(m.date) + '</title>'
        + '</circle>';
    }).join('');
  },

  // ════════════════════════════════════════════════════════════════════════
  //  MASTER / DETAIL — the Fix screen (board landing → focused gap page)
  // ════════════════════════════════════════════════════════════════════════


  boardLanding(container, moduleKey) {
    const composite = (window.Recovery && Recovery.COMPOSITE_GAPS) || [];
    const gaps = this.gapAreas(moduleKey).filter(g => composite.indexOf(g.id) === -1);
    const fixProgress = (App.data && App.data.fix_progress) || {};
    const log = (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    let openLeaks = 0, inProgress = 0;
    gaps.forEach(g => {
      const imp = window.Recovery ? Recovery.gapImpact(g.id) : null;
      if (imp && imp.band !== 'ok' && imp.dollars > 0) openLeaks++;
      const logged = log.some(e => e.gap_id === g.id);
      if (!logged && (fixProgress[g.id] || []).length > 0) inProgress++;
    });
    const recovered = window.Recovery ? (Recovery.moduleSummary(moduleKey).recovered || 0) : 0;

    const stat = (label, val, cls) =>
      '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg' + (cls ? ' ' + cls : '') + '">' + val + '</div></div>';
    const statStrip = '<div class="card" style="margin-bottom:14px;"><div style="display:flex;gap:40px;flex-wrap:wrap;align-items:flex-start;">'
      + stat('Open Leaks', String(openLeaks), openLeaks ? 'warn' : '')
      + stat('In Progress', String(inProgress))
      + stat('Recovered to Date', App.fmtCurrency(recovered, 0))
      + '</div></div>';

    const inner = this._fixAreasInner(moduleKey);
    const boardCard = '<div class="card form-card" style="margin-bottom:14px;"><div class="card-title">Where You\'re Leaking</div>'
      + (inner || '<div style="font-size:12px;color:var(--t3);">Run your audit to surface where you\'re leaking.</div>') + '</div>';

    container.innerHTML = '<div class="screen">' + statStrip + boardCard + this.recentActivityCard(moduleKey) + '</div>';

    container.querySelectorAll('.fp-fixarea').forEach(row => row.addEventListener('click', () => {
      const gap = row.dataset.gap, mod = row.dataset.module;
      if (mod === moduleKey) App.pushView(() => this.renderGapDetail(container, moduleKey, gap));
      else { App._fixFocus = gap; App.openScreen(this.fixScreen(mod)); }
    }));
    container.querySelectorAll('.fp-activity').forEach(row => row.addEventListener('click', () =>
      App.pushView(() => this.renderGapDetail(container, moduleKey, row.dataset.gap))));
  },

  // ── One gap's focused fix page (everything visible, no accordion) ───────────
  renderGapDetail(container, moduleKey, gapId) {
    const g = this.gapAreas(moduleKey).find(x => x.id === gapId);
    if (!g) { this.boardLanding(container, moduleKey); return; }

    const imp = window.Recovery ? Recovery.gapImpact(g.id) : null;
    const fixProgress = (App.data && App.data.fix_progress) || {};
    const stepsDone = (fixProgress[g.id] || []).length;
    const stepsTotal = (g.process && g.process.steps) ? g.process.steps.length : 0;
    const log = (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    const isLogged = log.some(e => e.gap_id === g.id);

    const BAND = { over: { label: 'Over', color: 'var(--red)' }, watch: { label: 'Watch', color: 'var(--amber)' }, ok: { label: 'On target', color: 'var(--gold)' } };
    const b = imp ? (BAND[imp.band] || BAND.over) : null;
    const dollarLine = (imp && imp.dollars > 0)
      ? '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:26px;font-weight:600;color:' + b.color + ';line-height:1;">'
          + App.fmtCurrency(imp.dollars, 0) + '<span style="font-size:11px;color:var(--t3);"> /yr at this week\'s pace</span></span>'
          + '<span style="font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:' + b.color + ';margin-left:8px;">' + b.label + '</span>'
      : '<span style="font-size:12px;color:var(--t3);">No live weekly dollar for this gap yet. Work the process and watch it against your own numbers.</span>';
    const progLine = stepsTotal
      ? '<span style="font-size:11px;color:var(--t3);margin-left:auto;align-self:center;white-space:nowrap;">' + stepsDone + ' of ' + stepsTotal + ' steps' + (isLogged ? ' &middot; Implemented' : '') + '</span>'
      : '';

    const header = '<div class="card form-card" style="margin-bottom:14px;"><div class="card-title">' + esc(g.name) + '</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">' + esc(g.summary || '') + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' + dollarLine + progLine + '</div>'
      + '</div>';

    const mistakes = Array.isArray(g.commonMistakes) ? g.commonMistakes : [];
    const watchOut = mistakes.length
      ? '<div class="card form-card" style="margin-bottom:14px;"><div class="card-title">Watch Out For</div>'
        + mistakes.map(t => '<div style="display:flex;gap:11px;padding:6px 0;font-size:13px;color:var(--t2);line-height:1.6;">'
            + '<span style="flex-shrink:0;width:6px;height:6px;border-radius:50%;background:var(--red);margin-top:7px;"></span><span>' + esc(t) + '</span></div>').join('')
        + '</div>'
      : '';

    const checked = new Set(fixProgress[g.id] || []);
    const steps = ((g.process && g.process.steps) || []).map((s, i) => this.stepRow(s, g.module, i, g.id, checked.has(i))).join('');
    const processCard = '<div class="card form-card" style="margin-bottom:14px;"><div class="card-title">The Fix Process</div>'
      + (steps || '<div style="font-size:12px;color:var(--t3);">No steps for this gap.</div>') + '</div>';

    container.innerHTML = '<div class="screen">' + header + watchOut + processCard + this.implementSection(g) + '</div>';
    this.wireGapDetail(container, moduleKey, g.id);
  },

  // Step row: checkbox + content. Each step links into the feature that does it.
  // Badge colors: DO IT gold (the action), SEE IT + DOCUMENT neutral (the label
  // carries the distinction) — kills the old blue per the locked color system.
  stepRow(s, module, stepIdx, gapId, isChecked) {
    const kind = s.kind || 'action';
    const meta = {
      action:    { label: 'DO IT',     color: 'var(--gold)', bg: 'var(--gold-bg)' },
      result:    { label: 'SEE IT',    color: 'var(--t2)',   bg: 'rgba(255,255,255,0.06)' },
      reference: { label: 'DOCUMENT',  color: 'var(--t3)',   bg: 'rgba(255,255,255,0.06)' }
    }[kind] || {};
    const label = esc(s.targetLabel || '');

    let link = '';
    const dlIcon = '<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1v6M2.5 5l3 3 3-3M1 9.5h9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    if (kind === 'reference') {
      const docId = s.doc || (s.target && this.DOC_IDS[s.target]);
      if (docId) {
        // Generated in Bar Cop style, headed with the operator's establishment name.
        link = '<button class="btn btn-ghost btn-sm fp-doc" data-doc="' + esc(docId) + '" '
          + 'style="display:inline-flex;align-items:center;gap:6px;">' + dlIcon
          + 'Download' + (label ? ': ' + label : '') + '</button>';
      }
      /* ⚠ THERE IS NO STORED-FILE FALLBACK ANY MORE, ON PURPOSE. This used to drop through to
         `<a href="assets/resources/<file>" download>`, and that folder has since been deleted --
         so the branch could only ever hand the operator a broken download. A step with no `doc`
         id now renders with no button at all, which is honest: nothing to download beats a
         button that 404s. Every reference step carries a `doc` id today ([[the-loop]] #44 -- a
         thing that was safe becomes a defect the moment the world around it changes). */
    } else if (s.target) {
      const verb = kind === 'result' ? 'View' : 'Open';
      link = '<button class="btn btn-ghost btn-sm fp-go" data-target="' + esc(s.target) + '">'
        + verb + (label ? ': ' + label : '') + '</button>';
    }

    const checkbox = '<button class="fp-step-check" data-gap="' + esc(gapId) + '" data-step="' + stepIdx + '" '
      + 'aria-label="' + (isChecked ? 'Mark step incomplete' : 'Mark step complete') + '" '
      + 'style="flex-shrink:0;width:20px;height:20px;border-radius:4px;border:1px solid '
      + (isChecked ? 'var(--gold)' : 'var(--b1)') + ';background:' + (isChecked ? 'var(--gold-bg)' : 'transparent')
      + ';cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;margin-top:3px;transition:border-color 0.12s,background 0.12s;">'
      + (isChecked ? '<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.5l2.5 2.5 4.5-5.5" stroke="var(--gold)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '')
      + '</button>';

    const titleColor  = isChecked ? 'var(--t3)' : 'var(--t1)';
    const detailColor = isChecked ? 'var(--t4)' : 'var(--t2)';

    return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--b2);">'
      + checkbox
      + '<div style="flex:1;min-width:0;">'
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<span style="font-size:13px;font-weight:700;color:' + titleColor + ';">' + esc(s.title) + '</span>'
      + (meta.label ? '<span style="font-size:8px;font-weight:800;letter-spacing:1px;text-transform:uppercase;'
          + 'padding:2px 6px;border-radius:3px;background:' + meta.bg + ';color:' + meta.color
          + (isChecked ? ';opacity:0.55' : '') + ';">' + meta.label + '</span>' : '')
      + '</div>'
      + '<div style="font-size:12px;color:' + detailColor + ';line-height:1.65;margin-top:4px;">' + esc(s.detail || '') + '</div>'
      + (link ? '<div style="margin-top:8px;' + (isChecked ? 'opacity:0.55;' : '') + '">' + link + '</div>' : '')
      + '</div></div>';
  },

  // ── Mark Fix Implemented — the action sub-card ──────────────────────────────
  implementSection(g) {
    const log = (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    const mine = log.filter(e => e.gap_id === g.id)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const inputStyle = 'background:var(--bg);border:1px solid var(--b1);border-radius:3px;'
      + 'color:#fff;font-size:13px;padding:7px 10px;width:100%;color-scheme:dark;';

    const progress   = (App.data && App.data.fix_progress && App.data.fix_progress[g.id]) || [];
    const totalSteps = (g.process && g.process.steps) ? g.process.steps.length : 0;
    const allChecked = totalSteps > 0 && progress.length >= totalSteps;
    const borderColor = mine.length
      ? 'var(--b1)'
      : (allChecked ? 'var(--gold)' : 'rgba(219,171,70,0.45)');

    let logHtml = '';
    if (mine.length) {
      logHtml = mine.map(e => {
        const r = (window.Recovery) ? Recovery.compute(e) : { status: 'untracked' };
        let result = '', good = false;
        if (r.status === 'ok') {
          const move = r.label + ' ' + r.fmt(r.before) + ' to ' + r.fmt(r.after);
          const prelim = r.mature ? '' : ' Preliminary, ' + r.weeksAfter + ' week' + (r.weeksAfter === 1 ? '' : 's') + ' in.';
          if (r.dollars != null && r.dollars > 0) {
            good = true;
            // > 0, not truthy: dollarsAnnual run-rates the CURRENT window, so a fix that
            // worked early and has since slipped is negative here while dollars stays
            // positive, and App.fmtCurrency prefixes the $ ("on pace for $-4,160 a year").
            // The before-to-after move below already shows the drift. Line 308 has this right.
            result = 'Recovered about ' + App.fmtCurrency(r.dollars) + ' so far'
              + (r.dollarsAnnual > 0 ? ', on pace for ' + App.fmtCurrency(r.dollarsAnnual) + ' a year' : '')
              + '. ' + move + '.' + prelim;
          } else if (r.dollars != null && r.dollars < 0) {
            result = 'Slipping. About ' + App.fmtCurrency(Math.abs(r.dollars)) + ' below your starting point. ' + move + '.' + prelim;
          } else {
            result = 'Holding at your starting level. ' + move + '.' + prelim;
          }
        } else if (r.status === 'building') {
          result = 'Building your baseline. ' + (r.weeksIn || 0) + ' week' + ((r.weeksIn || 0) === 1 ? '' : 's') + ' in. Your recovery figure turns on once there are a few weeks to measure against.';
        }
        return '<div style="padding:12px 20px;border-bottom:1px solid var(--b2);">'
          + '<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--t2);">'
          + '<span style="flex-shrink:0;width:7px;height:7px;border-radius:50%;background:var(--gold);"></span>'
          + 'Implemented ' + esc(e.date)
          + '<button class="btn btn-ghost btn-sm fp-unlog" data-log="' + esc(e.id) + '" style="margin-left:auto;">Remove</button>'
          + '</div>'
          + (result ? '<div style="font-size:12px;line-height:1.6;margin:5px 0 0 15px;color:'
              + (good ? 'var(--gold)' : 'var(--t3)') + ';">' + esc(result) + '</div>' : '')
          + '</div>';
      }).join('');
    }

    const formHtml = '<div style="padding:16px 20px;display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">'
      + '<div class="f" style="width:170px;flex-shrink:0;">'
      + '<label style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:5px;">Implemented On</label>'
      + '<input type="date" class="fp-impl-date" data-gap="' + esc(g.id) + '" style="' + inputStyle + '"/>'
      + '</div>'
      + '<button class="btn btn-primary fp-impl-save" data-gap="' + esc(g.id) + '" '
      + 'data-module="' + esc(g.module) + '" data-name="' + esc(g.name) + '">Mark Implemented</button>'
      + '</div>';

    const bannerHtml = (allChecked && !mine.length)
      ? '<div style="padding:12px 20px;background:var(--gold-bg);border-bottom:1px solid var(--b2);'
        + 'font-size:12px;color:var(--gold);font-weight:700;letter-spacing:0.03em;line-height:1.5;">'
        + 'All steps checked. Lock in the date so Bar Cop can start measuring.</div>'
      : '';

    return '<div style="margin:0 0 14px;background:var(--panel);border:1px solid ' + borderColor + ';border-radius:6px;overflow:hidden;">'
      + this.sectionHeader('Mark Fix Implemented')
      + logHtml
      + bannerHtml
      + formHtml
      + '</div>';
  },

  // ── Recent Activity card — module-scoped chronological feed of step checks ──
  _timeAgo(ts) {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60)     return 'just now';
    if (diff < 3600)   return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400)  return Math.floor(diff / 3600) + 'h ago';
    if (diff < 172800) return 'yesterday';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    if (diff < 2592000) return Math.floor(diff / 604800) + 'w ago';
    return new Date(ts).toLocaleDateString();
  },

  recentActivityCard(moduleKey) {
    const all = (App.data && Array.isArray(App.data.fix_activity)) ? App.data.fix_activity : [];
    // Newest 10, by ts — the event store loads newest-first, so a positional
    // slice(-10) would grab the oldest rows. Sort explicitly instead.
    const mine = all.filter(a => a.module === moduleKey)
      .slice().sort((x, y) => String(y.ts || '').localeCompare(String(x.ts || '')))  // newest first
      .slice(0, 10);
    const titleBar = this.sectionHeader('Recent Activity');

    if (!mine.length) {
      return '<div class="card" style="padding:0;overflow:hidden;margin:18px 0;">'
        + titleBar
        + '<div style="padding:18px 20px;font-size:12px;color:var(--t3);line-height:1.6;">'
        + 'No activity yet. Check off a step in any fix process and it shows up here.</div>'
        + '</div>';
    }

    const badges = {
      action:    { label: 'DO IT',    color: 'var(--gold)', bg: 'var(--gold-bg)' },
      result:    { label: 'SEE IT',   color: 'var(--t2)',   bg: 'rgba(255,255,255,0.06)' },
      reference: { label: 'DOCUMENT', color: 'var(--t3)',   bg: 'rgba(255,255,255,0.06)' }
    };

    const rows = mine.map((a, i) => {
      const b = badges[a.step_kind] || badges.action;
      return '<div class="fp-activity" data-gap="' + esc(a.gap_id) + '" '
        + 'style="display:flex;align-items:center;gap:11px;padding:11px 20px;cursor:pointer;'
        + (i < mine.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
        + '<span style="flex-shrink:0;font-size:8px;font-weight:800;letter-spacing:1px;text-transform:uppercase;'
        + 'padding:2px 6px;border-radius:3px;background:' + b.bg + ';color:' + b.color + ';">' + b.label + '</span>'
        + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t2);line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
        + '<span style="color:var(--t3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;font-size:11px;">' + esc(a.gap_name) + '</span>'
        + '<span style="color:var(--t4);"> · </span>' + esc(a.step_title) + '</div>'
        + '<div style="flex-shrink:0;font-size:11px;color:var(--t3);">' + esc(this._timeAgo(a.ts)) + '</div>'
        + '<span style="flex-shrink:0;font-size:13px;color:var(--t3);">&#9656;</span>'
        + '</div>';
    }).join('');

    return '<div class="card" style="padding:0;overflow:hidden;margin:18px 0;">'
      + titleBar
      + rows
      + '</div>';
  },

  // Wire the leak-board rows for any caller that renders the board on its own
  // (the Recovery dashboards). Each row deep-links into its Fix screen.
  wireFixAreas(container) {
    if (!container) return;
    container.querySelectorAll('.fp-fixarea').forEach(row => {
      row.addEventListener('click', () => {
        App._fixFocus = row.dataset.gap;
        App.openScreen(this.fixScreen(row.dataset.module));
      });
    });
    container.querySelectorAll('.fp-recovery-go').forEach(card => {
      card.addEventListener('click', () => App.openScreen(card.dataset.screen));
    });
    container.querySelectorAll('.fp-step').forEach(step => {
      step.addEventListener('click', () => App.openScreen(step.dataset.screen));
    });
  },

  // ── Gap-detail wiring: step checkboxes, deep-links, Mark Implemented ────────
  wireGapDetail(container, moduleKey, gapId) {
    const reRender = () => this.renderGapDetail(container, moduleKey, gapId);

    container.querySelectorAll('.fp-step-check').forEach(cb => cb.addEventListener('click', async () => {
      const gId = cb.dataset.gap;
      const stepIdx = parseInt(cb.dataset.step, 10);
      App.data.fix_progress = App.data.fix_progress || {};
      const arr = App.data.fix_progress[gId] = App.data.fix_progress[gId] || [];
      const at = arr.indexOf(stepIdx);
      const wasChecked = at >= 0;
      if (wasChecked) arr.splice(at, 1); else arr.push(stepIdx);
      App.saveKey('fix_progress');   // per-gap checkbox map stays in the config blob

      // Activity feed (row-per-record): remove the most recent matching entry on
      // uncheck; append on check and trim the module to its 100 newest rows.
      App.data.fix_activity = App.data.fix_activity || [];
      if (wasChecked) {
        // Pick the newest match by ts, NOT by array position: scanning from the end found the
        // newest only while this array was blob insertion-order. It loads newest-first now, so
        // the backwards scan was deleting the OLDEST matching row — leaving a stale entry, with
        // the wrong timestamp, in the feed for a step that is now unchecked.
        let newest = null;
        for (const a of App.data.fix_activity) {
          if (a.gap_id !== gId || a.step_index !== stepIdx) continue;
          if (!newest || String(a.ts || '').localeCompare(String(newest.ts || '')) >= 0) newest = a;
        }
        const removeId = newest ? newest.id : null;
        if (removeId != null) await App.removeRecord('core', 'fix_activity', removeId);
      } else {
        const gap = this.gapAreas(moduleKey).find(x => x.id === gId);
        const step = gap && gap.process && gap.process.steps && gap.process.steps[stepIdx];
        if (gap && step) {
          const rec = {
            id: App.uid(), module: moduleKey, gap_id: gId, gap_name: gap.name,
            step_index: stepIdx, step_title: step.title || '', step_kind: step.kind || 'action',
            ts: new Date().toISOString()
          };
          await App.putRecord('core', 'fix_activity', rec);
          // Trim the module's feed to its 100 NEWEST rows (delete the oldest overflow).
          // Sort by ts, not array position: the event store loads newest-first, so an
          // index-based trim would delete the newest rows instead of the oldest.
          const mineByAge = App.data.fix_activity.filter(a => a.module === moduleKey)
            .slice().sort((x, y) => String(x.ts || '').localeCompare(String(y.ts || '')));  // oldest first
          const overflow = mineByAge.slice(0, Math.max(0, mineByAge.length - 100));
          for (const a of overflow) await App.removeRecord('core', 'fix_activity', a.id);
        }
      }
      reRender();
    }));

    // Step deep-link: remember this gap so returning to the Fix screen reopens
    // it (App._fixFocus is a one-shot the Fix screen consumes on render).
    container.querySelectorAll('.fp-go').forEach(btn => btn.addEventListener('click', () => {
      App._fixFocus = gapId;
      App.openScreen(btn.dataset.target);
    }));

    // Generated reference docs (branded to the operator), built on the fly.
    container.querySelectorAll('.fp-doc').forEach(btn => btn.addEventListener('click', () => {
      if (window.FixDocs) FixDocs.download(btn.dataset.doc);
    }));

    container.querySelector('.fp-impl-save')?.addEventListener('click', () => {
      const dateEl = container.querySelector('.fp-impl-date');
      const date = dateEl ? dateEl.value : '';
      if (!date) { if (dateEl) dateEl.style.borderColor = 'var(--red)'; return; }
      const save = container.querySelector('.fp-impl-save');
      App.putRecord('core', 'fix_log', {
        id: App.uid(),
        module: save.dataset.module,
        gap_id: save.dataset.gap,
        gap_name: save.dataset.name,
        date: date,
        logged_at: new Date().toISOString()
      });
      if (save.dataset.module === 'profit') App.markSetupDone('gs_p_fix');
      reRender();
    });

    container.querySelectorAll('.fp-unlog').forEach(btn => btn.addEventListener('click', () => {
      App.removeRecord('core', 'fix_log', btn.dataset.log);
      reRender();
    }));
  },

};
