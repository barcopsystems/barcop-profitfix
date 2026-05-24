'use strict';

/* ── Fix Panel — the Fix Layer renderer (v2) ──────────────────────────────────
   Renders a Recovery module's gap-areas from the static FIX content. The Fix
   Layer is the connective spine of the platform: each fix-process step is a
   deep-link into the feature that performs it, never manual instruction text.

   Step kinds:
     action    — deep-link to the Control/Recovery feature that does the task
     result    — deep-link to where the app already shows the computed number
     reference — a downloadable PDF/Word document (policies, standards)

   FixPanel.renderInto(el, moduleKey, focusId) — el container, module key,
   optional gap-area id to auto-expand and scroll to. 100% static, zero API. */

window.FixPanel = {
  RESOURCE_ROOT: 'assets/resources/',

  gapAreas(moduleKey) {
    return (window.FIX && Array.isArray(FIX[moduleKey])) ? FIX[moduleKey] : [];
  },
  docPath(module, file) {
    return this.RESOURCE_ROOT + (module === 'profit' ? '' : module + '/') + encodeURIComponent(file);
  },

  // The per-module Fix screen id a gap-area deep-links into.
  fixScreen(moduleKey) {
    return moduleKey === 'revenue' ? 'r-fix' : moduleKey === 'traffic' ? 't-fix' : 'profit-fix';
  },

  // ── Card-internal section header. Title sits inside the card with a divider
  // below it. Optional helpClass adds a "How this works" button on the right
  // that the calling code wires to open a modal.
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
  // combined recoveryCard can drop it in. fixAreasCard wraps that in a
  // standalone .card for any caller that wants Fix Areas on its own.
  fixAreasCard(moduleKey) {
    const inner = this._fixAreasInner(moduleKey);
    if (!inner) return '';
    return '<div class="card" style="padding:0;overflow:hidden;margin-bottom:18px;">'
      + inner
      + '</div>';
  },

  _fixAreasInner(moduleKey) {
    const gaps = this.gapAreas(moduleKey);
    if (!gaps.length) return '';
    const BANDS = {
      ok:    { label: 'On Target', color: 'var(--gold)' },
      watch: { label: 'Watch',     color: 'var(--w)' },
      over:  { label: 'Over',      color: 'var(--red)' }
    };
    const log = (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    const fixProgress = (App.data && App.data.fix_progress) || {};
    const rows = gaps.map((g, i) => {
      const imp = window.Recovery ? Recovery.gapImpact(g.id) : null;
      const isLogged = log.some(e => e.gap_id === g.id);
      const stepsDone = (fixProgress[g.id] || []).length;
      const stepsTotal = (g.process && g.process.steps) ? g.process.steps.length : 0;
      const showProgress = !isLogged && stepsTotal > 0 && stepsDone > 0;
      let impHtml = '';
      if (imp && BANDS[imp.band]) {
        const bm = BANDS[imp.band];
        impHtml = '<div style="flex-shrink:0;text-align:right;">'
          + '<div style="display:flex;align-items:baseline;justify-content:flex-end;gap:10px;white-space:nowrap;">'
          + '<span style="font-size:9px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:' + bm.color + ';">' + bm.label + '</span>'
          + (imp.dollars > 0
              ? '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:16px;font-weight:600;color:' + bm.color + ';line-height:1;">'
                + App.fmtCurrency(imp.dollars) + '<span style="font-size:9px;"> /yr</span></span>'
              : '')
          + '</div>'
          + (showProgress
              ? '<div style="font-size:10px;color:var(--gold);margin-top:5px;font-weight:600;letter-spacing:0.04em;">'
                + stepsDone + ' of ' + stepsTotal + ' steps</div>'
              : '')
          + '</div>';
      } else if (showProgress) {
        impHtml = '<div style="flex-shrink:0;text-align:right;font-size:10px;color:var(--gold);font-weight:600;letter-spacing:0.04em;">'
          + stepsDone + ' of ' + stepsTotal + ' steps</div>';
      }
      // Last visible row in the card has no border-bottom. If we're appending
      // a Labor row below for Profit, every gap row keeps its border-bottom
      // and the Labor row becomes the bottomless one.
      const hasLabor = moduleKey === 'profit';
      const isLastVisible = !hasLabor && (i === gaps.length - 1);
      return '<div class="fp-fixarea" data-gap="' + esc(g.id) + '" data-module="' + esc(moduleKey) + '" '
        + 'style="display:flex;align-items:center;gap:24px;padding:13px 20px;cursor:pointer;'
        + (isLastVisible ? '' : 'border-bottom:1px solid var(--b2);') + '">'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:12px;font-weight:700;color:var(--t1);text-transform:uppercase;letter-spacing:0.5px;">' + esc(g.name) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);line-height:1.5;margin-top:3px;">' + esc(g.summary || '') + '</div>'
        + '</div>'
        + impHtml
        + '<span style="flex-shrink:0;font-size:13px;color:var(--t3);">&#9656;</span>'
        + '</div>';
    }).join('');

    // Profit dashboard surfaces Labor as the third part of prime cost. The
    // labor fix process lives in Revenue Recovery, so clicking routes there.
    // Diagnosis stays on Profit; the workflow lives where it belongs.
    let extraRow = '';
    if (moduleKey === 'profit' && window.Recovery && window.FIX && FIX.revenue) {
      const laborImp = Recovery.gapImpact('labor-scheduling');
      const laborLogged = log.some(e => e.gap_id === 'labor-scheduling');
      const laborSteps = (fixProgress['labor-scheduling'] || []).length;
      const laborGap = FIX.revenue.find(x => x.id === 'labor-scheduling');
      const laborStepsTotal = (laborGap && laborGap.process && laborGap.process.steps) ? laborGap.process.steps.length : 0;
      const showLaborProgress = !laborLogged && laborStepsTotal > 0 && laborSteps > 0;

      let labImp = '';
      if (laborImp && BANDS[laborImp.band]) {
        const bm = BANDS[laborImp.band];
        labImp = '<div style="flex-shrink:0;text-align:right;">'
          + '<div style="display:flex;align-items:baseline;justify-content:flex-end;gap:10px;white-space:nowrap;">'
          + '<span style="font-size:9px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:' + bm.color + ';">' + bm.label + '</span>'
          + (laborImp.dollars > 0
              ? '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:16px;font-weight:600;color:' + bm.color + ';line-height:1;">'
                + App.fmtCurrency(laborImp.dollars) + '<span style="font-size:9px;"> /yr</span></span>'
              : '')
          + '</div>'
          + (showLaborProgress
              ? '<div style="font-size:10px;color:var(--gold);margin-top:5px;font-weight:600;letter-spacing:0.04em;">'
                + laborSteps + ' of ' + laborStepsTotal + ' steps</div>'
              : '')
          + '</div>';
      } else if (showLaborProgress) {
        labImp = '<div style="flex-shrink:0;text-align:right;font-size:10px;color:var(--gold);font-weight:600;letter-spacing:0.04em;">'
          + laborSteps + ' of ' + laborStepsTotal + ' steps</div>';
      }

      extraRow = '<div class="fp-fixarea" data-gap="labor-scheduling" data-module="revenue" '
        + 'style="display:flex;align-items:center;gap:24px;padding:13px 20px;cursor:pointer;">'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:12px;font-weight:700;color:var(--t1);text-transform:uppercase;letter-spacing:0.5px;">Labor</div>'
        + '<div style="font-size:11px;color:var(--t3);line-height:1.5;margin-top:3px;">Bar, kitchen, and floor staff as a share of revenue. The third part of prime cost, worked in Revenue Recovery.</div>'
        + '</div>'
        + labImp
        + '<span style="flex-shrink:0;font-size:13px;color:var(--t3);">&#9656;</span>'
        + '</div>';
    }

    return this.sectionHeader('Fix Areas') + rows + extraRow;
  },

  // ── Compact "Recovery Scoreboard" slice for a Recovery dashboard ────────────
  // The module's running recovery from logged fixes. Lives at the top of the
  // dashboard as the platform's headline number. Four states:
  //   1) brand new (no audit, no fixes): 3-step explainer teaching the loop
  //   2) audit ran, no fixes yet: opportunity $ + 2-step explainer
  //   3) fixes logged, measured: recovered $ receipt
  //   4) fixes logged, all still measuring: logged count + measuring count
  auditScreen(moduleKey) {
    return moduleKey === 'revenue' ? 'r-audit'
         : moduleKey === 'traffic' ? 't-audit'
         : 'audit-tracker';
  },

  _stepRow(num, title, target, isLast) {
    return '<div class="fp-step" data-screen="' + esc(target) + '" '
      + 'style="display:flex;align-items:center;gap:13px;padding:14px 20px;cursor:pointer;'
      + (isLast ? '' : 'border-bottom:1px solid var(--b2);') + '">'
      + '<div style="flex-shrink:0;width:24px;height:24px;border-radius:50%;background:var(--gold-bg);'
      + 'color:var(--gold);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + num + '</div>'
      + '<div style="flex:1;min-width:0;font-size:12px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;color:var(--t1);">' + esc(title) + '</div>'
      + '<span style="flex-shrink:0;font-size:13px;color:var(--t3);">&#9656;</span>'
      + '</div>';
  },

  // Combined Recovery Scoreboard + Fix Areas card. Scoreboard sits at the top
  // (states 1-4 below), then a "Fix Areas" sub-header divides, then the gap
  // rows. One title bar, one "How this works" button covering the whole flow.
  recoveryCard(moduleKey) {
    if (!window.Recovery) return '';
    const s = Recovery.moduleSummary(moduleKey);
    const fixScreen = this.fixScreen(moduleKey);
    const titleBar = this.sectionHeader('Recovery Scoreboard', 'fp-rec-help');

    // ── Scoreboard portion (state-dependent) ─────────────────────────────────
    let scoreboardHtml = '';
    if (s.logged === 0) {
      const auditKey = moduleKey === 'profit' ? 'audits' : moduleKey + '_audits';
      const audits = (App.data && App.data[auditKey]) || [];
      const latest = audits[audits.length - 1];
      const monthly = latest ? (latest.action_items || []).reduce((sum, a) => sum + (a.monthly_impact || 0), 0) : 0;
      const annual  = monthly * 12;
      const moduleName = moduleKey === 'profit' ? 'Profit' : moduleKey === 'revenue' ? 'Revenue' : 'Traffic';

      if (annual > 0) {
        // State 2 — audit done, no fixes yet.
        scoreboardHtml = '<div style="padding:18px 20px;border-bottom:1px solid var(--b2);">'
          + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:32px;font-weight:600;line-height:1;color:var(--gold);">'
          + App.fmtCurrency(annual, 0)
          + '<span style="font-size:13px;color:var(--t3);font-weight:600;letter-spacing:0.04em;"> / yr opportunity</span></div>'
          + '</div>'
          + this._stepRow(1, 'Pick a gap, work the fix', fixScreen, false)
          + this._stepRow(2, 'Mark implemented', fixScreen, true);
      } else {
        // State 1 — brand new, three steps.
        scoreboardHtml = this._stepRow(1, 'Run your ' + moduleName + ' Audit', this.auditScreen(moduleKey), false)
          + this._stepRow(2, 'Pick a gap, work the fix', fixScreen, false)
          + this._stepRow(3, 'Mark implemented', fixScreen, true);
      }
    } else if (s.withFigure > 0) {
      // State 3 — recovered $ receipt.
      scoreboardHtml = '<div style="padding:18px 20px;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:32px;font-weight:600;line-height:1;color:var(--gold);">'
        + App.fmtCurrency(s.recovered, 0) + '<span style="font-size:13px;color:var(--t3);font-weight:600;letter-spacing:0.04em;"> recovered</span></div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:5px;">across '
        + s.withFigure + ' measured fix' + (s.withFigure === 1 ? '' : 'es')
        + (s.measuring > 0 ? ', ' + s.measuring + ' still measuring' : '') + '</div>'
        + '</div>';
    } else {
      // State 4 — logged, no figure yet.
      scoreboardHtml = '<div style="padding:18px 20px;font-size:13px;color:var(--t2);line-height:1.6;">'
        + s.logged + ' fix' + (s.logged === 1 ? '' : 'es') + ' logged'
        + (s.measuring > 0 ? ', ' + s.measuring + ' still measuring' : '') + '.</div>';
    }

    // ── Fix Areas portion ────────────────────────────────────────────────────
    const fixAreasHtml = this._fixAreasInner(moduleKey);

    return '<div class="card" style="padding:0;overflow:hidden;margin-bottom:18px;">'
      + titleBar
      + scoreboardHtml
      + fixAreasHtml
      + '</div>';
  },

  // ── "How this works" modal for the Recovery Scoreboard ─────────────────────
  showRecoveryHelp() {
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--surface);border:1px solid var(--b1);border-radius:6px;max-width:600px;width:100%;max-height:82vh;overflow:hidden;display:flex;flex-direction:column;';
    const head = '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:1px solid var(--b2);flex-shrink:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">How the Recovery Scoreboard Works</div>'
      + '<button class="btn btn-ghost btn-sm fp-rec-close">Close</button>'
      + '</div>';
    const sh = t => '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin:18px 0 8px;">' + t + '</div>';
    const p  = t => '<p style="margin:0 0 10px;">' + t + '</p>';
    const body = '<div style="padding:20px 22px 24px;font-size:13px;color:var(--t2);line-height:1.75;overflow-y:auto;">'
      + p('Two pieces work together: the Scoreboard up top tracks what you have already recovered, and the Fix Areas list below shows where the operation is still leaking. Same workflow, opposite ends.')
      + sh('The Scoreboard')
      + p('Tracks what Bar Cop has put back in your register, in dollars per year. No projections. No industry averages. Your own weekly numbers, measured before and after each fix.')
      + sh('Fix Areas')
      + p('The current weekly status of each gap. The band (On Target, Watch, Over) and dollar figure read from the latest week of your data, scored against your target. The dollar is the annualized cost of being off target at this week\'s pace.')
      + p('Once you check steps in The Fix Process for a gap, the row also shows your step progress. Once you mark the fix implemented, the progress hides and the Scoreboard up top is where to watch.')
      + sh('The Loop')
      + p('1. Run the audit. It scores your operation and lists every gap with a dollar figure on what it costs you per year.')
      + p('2. Pick a gap and open the fix process. Every step is a link into the part of Bar Cop that does the work.')
      + p('3. When the fix is in place, click Mark Implemented and lock in the date.')
      + sh('What Happens Next')
      + p('Bar Cop watches the metric for that gap. It averages the 8 weeks before the date and the 8 weeks after, multiplies the improvement by your revenue base, and annualizes it.')
      + p('You see a preliminary figure once 2 weeks of after-data exist. It firms up over the next 6 weeks and settles at 8.')
      + sh('The Honest Rule')
      + p('A dollar figure only shows when the math comes from real data Bar Cop already holds. If a fix cannot be dollarized honestly (most Traffic fixes), it still gets logged. Recovery for that fix shows as the score moving, not the dollars.')
      + '</div>';
    box.innerHTML = head + body;
    m.appendChild(box);
    document.body.appendChild(m);
    m.onclick = ev => { if (ev.target === m) m.remove(); };
    box.querySelector('.fp-rec-close')?.addEventListener('click', () => m.remove());
  },

  // ── "How this works" modal for The Fix Process header ──────────────────────
  // Per-gap: explains the gap-card workflow (step kinds, checkboxes, Mark
  // Implemented) and surfaces the top 3 "Watch Out For" warnings from the
  // gap's commonMistakes — operator wisdom that the app itself cannot prevent.
  showProcessHelp(g) {
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--surface);border:1px solid var(--b1);border-radius:6px;max-width:600px;width:100%;max-height:82vh;overflow:hidden;display:flex;flex-direction:column;';
    const head = '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:1px solid var(--b2);flex-shrink:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">How The Fix Process Works</div>'
      + '<button class="btn btn-ghost btn-sm fp-rec-close">Close</button>'
      + '</div>';
    const sh = t => '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin:18px 0 10px;">' + t + '</div>';
    const p  = t => '<p style="margin:0 0 10px;">' + t + '</p>';
    const badge = (label, color, bg) => '<span style="display:inline-block;font-size:8px;font-weight:800;letter-spacing:1px;'
      + 'text-transform:uppercase;padding:2px 6px;border-radius:3px;background:' + bg + ';color:' + color + ';margin-right:8px;">' + label + '</span>';

    const mistakes = (g && Array.isArray(g.commonMistakes)) ? g.commonMistakes.slice(0, 3) : [];
    const watchOut = mistakes.length
      ? sh('Watch Out For')
        + mistakes.map(t => '<div style="display:flex;gap:10px;padding:5px 0;font-size:13px;color:var(--t2);line-height:1.65;">'
            + '<span style="flex-shrink:0;width:6px;height:6px;border-radius:50%;background:var(--red);margin-top:8px;"></span>'
            + '<span>' + esc(t) + '</span></div>').join('')
      : '';

    const body = '<div style="padding:20px 22px 24px;font-size:13px;color:var(--t2);line-height:1.75;overflow-y:auto;">'
      + p('Each step below is a link into the part of Bar Cop that does the work. Three kinds:')
      + '<div style="margin:0 0 8px;">' + badge('DO IT', 'var(--gold)', 'var(--gold-bg)') + 'opens the screen where the work happens.</div>'
      + '<div style="margin:0 0 8px;">' + badge('SEE IT', 'var(--blue)', 'var(--blue-bg)') + 'opens where Bar Cop already shows the number.</div>'
      + '<div style="margin:0 0 14px;">' + badge('DOCUMENT', 'var(--t3)', 'rgba(255,255,255,0.06)') + 'downloads a policy, standard, or template.</div>'
      + p('Check the boxes as you go. Progress saves and shows on the dashboard.')
      + p('When the whole process is in place, click Mark Implemented and lock in the date. Bar Cop measures the metric for 8 weeks before and after to show what the fix recovered.')
      + watchOut
      + '</div>';
    box.innerHTML = head + body;
    m.appendChild(box);
    document.body.appendChild(m);
    m.onclick = ev => { if (ev.target === m) m.remove(); };
    box.querySelector('.fp-rec-close')?.addEventListener('click', () => m.remove());
  },

  // Wire the Fix Areas rows and the Recovery card. Call after render.
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
    container.querySelectorAll('.fp-rec-help').forEach(btn => {
      btn.addEventListener('click', ev => { ev.stopPropagation(); this.showRecoveryHelp(); });
    });
  },

  // Vertical fix-event markers for an annotated trend chart. xFn maps a week
  // index to an x coordinate; top/bottom are the plot edges.
  // Disabled for now — full-height dashed lines + gold dots were too visually
  // loud against the trend lines on every chart they appeared in. Restore by
  // removing the early return below if a softer style is added later.
  markerSvg(markers, xFn, top, bottom) {
    return '';
    /* eslint-disable */
    if (!markers || !markers.length) return '';
    return markers.map(m => {
      const x = xFn(m.index).toFixed(1);
      return '<line x1="' + x + '" y1="' + top.toFixed(1) + '" x2="' + x + '" y2="' + bottom.toFixed(1) + '" '
        + 'stroke="rgba(219,171,70,0.5)" stroke-width="1" stroke-dasharray="2,3"/>'
        + '<circle cx="' + x + '" cy="' + top.toFixed(1) + '" r="3" fill="#DBAB46">'
        + '<title>' + esc(m.label) + ' implemented ' + esc(m.date) + '</title></circle>';
    }).join('');
    /* eslint-enable */
  },

  renderInto(el, moduleKey, focusId) {
    if (!el) return;
    el.dataset.fixModule = moduleKey;
    if (focusId) {
      App._fixOpen = App._fixOpen || {};
      App._fixOpen[moduleKey] = focusId;
    }
    const gaps = this.gapAreas(moduleKey);
    if (gaps.length === 0) {
      el.innerHTML = '<div class="card"><div style="font-size:13px;color:var(--t3);">'
        + 'Fix content for this module is on the way.</div></div>';
      return;
    }
    el.innerHTML = gaps.map(g => this.gapCard(g, g.id === focusId)).join('');
    this.wire(el);
    if (focusId) {
      const card = el.querySelector('.fp-gap[data-gap="' + focusId + '"]');
      if (card) setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
  },

  // ── One gap-area collapsible card ───────────────────────────────────────────
  // Header shows a toned-down status line on the right (t3, mixed case) so the
  // operator can scan all gaps at a glance: "4 of 6 steps", "Implemented · $X /yr",
  // "$X /yr", or nothing. Same data the dashboard surfaces in color, here muted
  // so it reads as reference instead of headline.
  gapCard(g, expanded) {
    const log = (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    const isLogged = log.some(e => e.gap_id === g.id);
    const fixProgress = (App.data && App.data.fix_progress) || {};
    const stepsDone = (fixProgress[g.id] || []).length;
    const stepsTotal = (g.process && g.process.steps) ? g.process.steps.length : 0;

    let status = '';
    if (isLogged) {
      let recovered = 0;
      log.filter(e => e.gap_id === g.id).forEach(e => {
        const r = (window.Recovery) ? Recovery.compute(e) : null;
        if (r && r.status === 'ok' && r.dollars > 0) recovered += r.dollars;
      });
      status = recovered > 0
        ? 'Implemented · ' + App.fmtCurrency(recovered, 0) + ' /yr'
        : 'Implemented';
    } else if (stepsDone > 0 && stepsTotal > 0) {
      status = stepsDone + ' of ' + stepsTotal + ' steps';
    } else if (window.Recovery) {
      const imp = Recovery.gapImpact(g.id);
      if (imp && imp.dollars > 0) status = App.fmtCurrency(imp.dollars, 0) + ' /yr';
    }

    const statusHtml = status
      ? '<div style="flex-shrink:0;font-size:11px;color:var(--t3);align-self:center;text-align:right;white-space:nowrap;">' + esc(status) + '</div>'
      : '';

    return '<div class="card fp-gap" data-gap="' + esc(g.id) + '" style="padding:0;overflow:hidden;">'
      + '<div class="fp-head" style="display:flex;align-items:flex-start;gap:14px;padding:18px 20px;cursor:pointer;">'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:13px;font-weight:800;color:var(--t1);text-transform:uppercase;letter-spacing:1px;">' + esc(g.name) + '</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-top:5px;">' + esc(g.summary || '') + '</div>'
      + '</div>'
      + statusHtml
      + '<span class="fp-chev" style="flex-shrink:0;font-size:14px;color:var(--t3);transform:rotate(' + (expanded ? '90' : '0') + 'deg);transition:transform 0.15s;align-self:center;">&#9656;</span>'
      + '</div>'
      + '<div class="fp-body" style="display:' + (expanded ? 'block' : 'none') + ';padding:0 20px 20px;border-top:1px solid var(--b2);">'
      + this.processSection(g)
      + this.implementSection(g)
      + '</div></div>';
  },

  sh(text, subdued) {
    return '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;'
      + 'color:' + (subdued ? 'var(--t3)' : 'var(--gold)') + ';margin:20px 0 12px;">' + esc(text) + '</div>';
  },

  // ── Fix process — every step is a link ──────────────────────────────────────
  // Each step renders with a checkbox the operator ticks as they work through
  // it. Progress persists per-gap in App.data.fix_progress[gap_id] = [idx,...].
  // Checked steps dim visually. Recovery math still measures at gap-area level,
  // gated by the Mark Implemented date — the checklist is operator-facing only.
  processSection(g) {
    const p = g.process;
    if (!p) return '';
    const progress = (App.data && App.data.fix_progress && App.data.fix_progress[g.id]) || [];
    const checked = new Set(progress);
    const steps = (p.steps || []).map((s, i) => this.stepRow(s, g.module, i, g.id, checked.has(i))).join('');
    const header = '<div style="display:flex;align-items:center;justify-content:space-between;margin:20px 0 12px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);">The Fix Process</div>'
      + '<button class="fp-proc-help" data-gap="' + esc(g.id) + '" style="background:transparent;border:1px solid var(--b1);border-radius:3px;'
      + 'color:var(--t3);font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 9px;cursor:pointer;">How this works</button>'
      + '</div>';
    return header + steps;
  },

  // Step row: checkbox + content. Numbered circle removed since row order
  // carries the sequence and the checkbox carries the action.
  stepRow(s, module, stepIdx, gapId, isChecked) {
    const kind = s.kind || 'action';
    const meta = {
      action:    { label: 'DO IT',     color: 'var(--gold)',  bg: 'var(--gold-bg)' },
      result:    { label: 'SEE IT',    color: 'var(--blue)',  bg: 'var(--blue-bg)' },
      reference: { label: 'DOCUMENT',  color: 'var(--t3)',    bg: 'rgba(255,255,255,0.06)' }
    }[kind] || {};
    const label = esc(s.targetLabel || '');

    let link = '';
    if (kind === 'reference') {
      if (s.target) {
        link = '<a class="btn btn-ghost btn-sm" href="' + this.docPath(module, s.target) + '" download '
          + 'style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;">'
          + '<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1v6M2.5 5l3 3 3-3M1 9.5h9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          + 'Download' + (label ? ': ' + label : '') + '</a>';
      }
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
      + '<div style="flex:1;">'
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

  // ── Mark Fix Implemented — the action card ──────────────────────────────────
  // Rendered as a prominent sub-card inside the expanded gap card. Gold border
  // when nothing has been logged yet (draws the eye to the action). Neutral
  // border once a fix has been logged. The "How this works" button opens the
  // shared Recovery Scoreboard modal so all instruction lives there.
  implementSection(g) {
    const log = (App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    const mine = log.filter(e => e.gap_id === g.id)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const inputStyle = 'background:var(--bg);border:1px solid var(--b1);border-radius:3px;'
      + 'color:#fff;font-size:13px;padding:7px 10px;width:100%;color-scheme:dark;';

    // Banner state: all steps in The Fix Process have been checked but no
    // implementation has been logged yet. Border goes solid gold and a banner
    // sits above the form prompting the operator to lock in the date.
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
          const move = r.fmt(r.before) + ' to ' + r.fmt(r.after);
          if (r.dollars != null && r.dollars > 0) {
            good = true;
            result = 'Recovered about ' + App.fmtCurrency(r.dollars) + ' a year. ' + r.label + ' ' + move + '.'
              + (r.mature ? '' : ' Preliminary, ' + r.weeksAfter + ' week' + (r.weeksAfter === 1 ? '' : 's') + ' of data so far.');
          } else {
            result = r.label + ' has not improved since this fix. ' + move + '.';
          }
        } else if (r.status === 'pending') {
          result = 'Measuring. ' + r.weeksAfter + ' week' + (r.weeksAfter === 1 ? '' : 's') + ' of data since this fix.';
        } else if (r.status === 'no-baseline') {
          result = 'No weeks logged before this date to measure recovery against.';
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

    return '<div style="margin:20px 0;background:var(--panel);border:1px solid ' + borderColor + ';border-radius:4px;overflow:hidden;">'
      + this.sectionHeader('Mark Fix Implemented')
      + logHtml
      + bannerHtml
      + formHtml
      + '</div>';
  },

  // ── Recent Activity card — module-scoped chronological feed of step checks
  // Lives at the bottom of each Fix screen. Each row is clickable to re-open
  // the gap at that step. Tones (t3 throughout) keep it as quiet reference —
  // duplicates "X of N steps" from the gap-card status without screaming.
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
    const mine = all.filter(a => a.module === moduleKey).slice(-10).reverse();
    const titleBar = this.sectionHeader('Recent Activity');

    if (!mine.length) {
      return '<div class="card" style="padding:0;overflow:hidden;margin:18px 0;">'
        + titleBar
        + '<div style="padding:18px 20px;font-size:12px;color:var(--t3);line-height:1.6;">'
        + 'No activity yet. Check off a step in any fix process above and it shows up here.</div>'
        + '</div>';
    }

    const badges = {
      action:    { label: 'DO IT',    color: 'var(--gold)', bg: 'var(--gold-bg)' },
      result:    { label: 'SEE IT',   color: 'var(--blue)', bg: 'var(--blue-bg)' },
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

  wireActivityCard(container, moduleKey) {
    if (!container) return;
    container.querySelectorAll('.fp-activity').forEach(row => {
      row.addEventListener('click', () => {
        const gapId = row.dataset.gap;
        const mount = document.getElementById('fix-panel-mount');
        if (mount) {
          App._fixFocus = gapId;
          this.renderInto(mount, moduleKey, gapId);
        }
      });
    });
  },

  _refreshActivity(moduleKey) {
    const mount = document.getElementById('recent-activity-mount');
    if (!mount) return;
    mount.innerHTML = this.recentActivityCard(moduleKey);
    this.wireActivityCard(mount, moduleKey);
  },

  // ── Event wiring ────────────────────────────────────────────────────────────
  // renderInto() can be called many times against the same el (e.g. every time
  // a step checkbox is toggled). The per-element .fp-head listeners must be
  // re-attached each call because innerHTML replacement destroyed the old head
  // nodes. The delegated click listener on `el` itself MUST be attached only
  // once — otherwise every render adds another copy, and stacking copies cancel
  // each other out (toggle then immediately untoggle), making clicks feel dead.
  wire(el) {
    el.querySelectorAll('.fp-head').forEach(head => {
      head.addEventListener('click', () => {
        const card = head.closest('.fp-gap');
        const body = card.querySelector('.fp-body');
        const chev = head.querySelector('.fp-chev');
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        if (chev) chev.style.transform = 'rotate(' + (open ? '0' : '90') + 'deg)';
        // Persist which gap is open per module so navigating away and back
        // (e.g., clicking a step deep-link, then breadcrumb back) reopens it.
        App._fixOpen = App._fixOpen || {};
        App._fixOpen[el.dataset.fixModule] = open ? null : card.dataset.gap;
      });
    });
    if (el.dataset.fpWired) return;
    el.dataset.fpWired = '1';
    el.addEventListener('click', ev => {
      const procHelp = ev.target.closest('.fp-proc-help');
      if (procHelp) {
        ev.stopPropagation();
        const gapId = procHelp.dataset.gap;
        const moduleKey = el.dataset.fixModule;
        const gap = (window.FIX && FIX[moduleKey] || []).find(x => x.id === gapId);
        if (gap) this.showProcessHelp(gap);
        return;
      }
      const stepCheck = ev.target.closest('.fp-step-check');
      if (stepCheck) {
        ev.stopPropagation();
        const gapId = stepCheck.dataset.gap;
        const stepIdx = parseInt(stepCheck.dataset.step, 10);
        const moduleKey = el.dataset.fixModule;
        App.data.fix_progress = App.data.fix_progress || {};
        App.data.fix_progress[gapId] = App.data.fix_progress[gapId] || [];
        const arr = App.data.fix_progress[gapId];
        const at = arr.indexOf(stepIdx);
        const wasChecked = at >= 0;
        if (wasChecked) arr.splice(at, 1); else arr.push(stepIdx);
        App.saveKey('fix_progress');
        // Update the activity feed: push on check, remove the most recent
        // matching entry on uncheck (so the feed reflects current truth).
        App.data.fix_activity = App.data.fix_activity || [];
        if (wasChecked) {
          for (let i = App.data.fix_activity.length - 1; i >= 0; i--) {
            const a = App.data.fix_activity[i];
            if (a.gap_id === gapId && a.step_index === stepIdx) {
              App.data.fix_activity.splice(i, 1);
              break;
            }
          }
        } else {
          const gap = (window.FIX && FIX[moduleKey] || []).find(x => x.id === gapId);
          const step = gap && gap.process && gap.process.steps && gap.process.steps[stepIdx];
          if (gap && step) {
            App.data.fix_activity.push({
              id: App.uid(),
              module: moduleKey,
              gap_id: gapId,
              gap_name: gap.name,
              step_index: stepIdx,
              step_title: step.title || '',
              step_kind: step.kind || 'action',
              ts: new Date().toISOString()
            });
            // Cap at 100 entries per module to keep the array bounded.
            const all = App.data.fix_activity;
            const moduleCount = all.filter(a => a.module === moduleKey).length;
            if (moduleCount > 100) {
              for (let i = 0; i < all.length && moduleCount - 100 > 0; i++) {
                if (all[i].module === moduleKey) {
                  all.splice(i, 1);
                  i--;
                  if (all.filter(a => a.module === moduleKey).length <= 100) break;
                }
              }
            }
          }
        }
        App.saveKey('fix_activity');
        this.renderInto(el, moduleKey, gapId);
        this._refreshActivity(moduleKey);
        return;
      }
      const go = ev.target.closest('.fp-go');
      const implSave = ev.target.closest('.fp-impl-save');
      const unlog = ev.target.closest('.fp-unlog');
      if (go) { App.openScreen(go.dataset.target); return; }
      if (implSave) {
        const gapId = implSave.dataset.gap;
        const dateEl = el.querySelector('.fp-impl-date[data-gap="' + gapId + '"]');
        const date = dateEl ? dateEl.value : '';
        if (!date) {
          if (dateEl) dateEl.style.borderColor = 'var(--red)';
          return;
        }
        App.data.fix_log = App.data.fix_log || [];
        App.data.fix_log.push({
          id: App.uid(),
          module: implSave.dataset.module,
          gap_id: gapId,
          gap_name: implSave.dataset.name,
          date: date,
          logged_at: new Date().toISOString()
        });
        App.saveKey('fix_log');
        this.renderInto(el, el.dataset.fixModule, gapId);
        return;
      }
      if (unlog) {
        const logId = unlog.dataset.log;
        App.data.fix_log = (App.data.fix_log || []).filter(e => e.id !== logId);
        App.saveKey('fix_log');
        const card = unlog.closest('.fp-gap');
        this.renderInto(el, el.dataset.fixModule, card ? card.dataset.gap : null);
        return;
      }
    });
  }
};
