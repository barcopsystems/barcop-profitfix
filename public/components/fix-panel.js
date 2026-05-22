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

  // ── Compact "Fix Areas" card for a Recovery dashboard ───────────────────────
  // Each row deep-links into the module's Fix screen at that gap-area.
  fixAreasCard(moduleKey) {
    const gaps = this.gapAreas(moduleKey);
    if (!gaps.length) return '';
    const rows = gaps.map((g, i) =>
      '<div class="fp-fixarea" data-gap="' + esc(g.id) + '" data-module="' + esc(moduleKey) + '" '
      + 'style="display:flex;align-items:center;gap:12px;padding:13px 20px;cursor:pointer;'
      + (i < gaps.length - 1 ? 'border-bottom:1px solid var(--b2);' : '') + '">'
      + '<div style="flex:1;">'
      + '<div style="font-size:12px;font-weight:700;color:var(--t1);text-transform:uppercase;letter-spacing:0.5px;">' + esc(g.name) + '</div>'
      + '<div style="font-size:11px;color:var(--t3);line-height:1.5;margin-top:3px;">' + esc(g.summary || '') + '</div>'
      + '</div>'
      + '<span style="flex-shrink:0;font-size:13px;color:var(--t3);">&#9656;</span>'
      + '</div>').join('');
    return '<div class="sh">Fix Areas</div>'
      + '<div class="card" style="padding:0;overflow:hidden;margin-bottom:18px;">' + rows + '</div>';
  },

  // ── Compact "Recovery Scoreboard" slice for a Recovery dashboard ────────────
  // The module's running recovery from logged fixes. Dollar figure where the
  // metric dollarizes, fix count otherwise. Clicking opens the Fix screen.
  recoveryCard(moduleKey) {
    if (!window.Recovery) return '';
    const s = Recovery.moduleSummary(moduleKey);
    let body;
    if (s.logged === 0) {
      body = '<div style="font-size:12px;color:var(--t3);line-height:1.65;">'
        + 'No fixes logged yet. When you put a fix in place, mark it implemented on the Fix screen '
        + 'and the app measures what it recovered.</div>';
    } else if (s.withFigure > 0) {
      body = '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:30px;font-weight:600;line-height:1;color:var(--gold);">'
        + App.fmtCurrency(s.recovered) + '</div>'
        + '<div style="font-size:11px;color:var(--t3);margin-top:5px;">annualized recovery across '
        + s.withFigure + ' measured fix' + (s.withFigure === 1 ? '' : 'es')
        + (s.measuring > 0 ? ', ' + s.measuring + ' still measuring' : '') + '</div>';
    } else {
      body = '<div style="font-size:13px;color:var(--t2);line-height:1.6;">'
        + s.logged + ' fix' + (s.logged === 1 ? '' : 'es') + ' logged. '
        + 'Recovery for this module shows as the scores improve, not in dollars.</div>'
        + (s.measuring > 0 ? '<div style="font-size:11px;color:var(--t4);margin-top:4px;">'
            + s.measuring + ' still measuring.</div>' : '');
    }
    return '<div class="sh">Recovery Scoreboard</div>'
      + '<div class="card fp-recovery-go" data-screen="' + esc(this.fixScreen(moduleKey)) + '" '
      + 'style="margin-bottom:18px;display:flex;align-items:center;gap:16px;justify-content:space-between;cursor:pointer;">'
      + '<div style="flex:1;min-width:0;">' + body + '</div>'
      + '<span style="flex-shrink:0;font-size:13px;color:var(--t3);">&#9656;</span>'
      + '</div>';
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
  },

  renderInto(el, moduleKey, focusId) {
    if (!el) return;
    el.dataset.fixModule = moduleKey;
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
  gapCard(g, expanded) {
    return '<div class="card fp-gap" data-gap="' + esc(g.id) + '" style="padding:0;overflow:hidden;">'
      + '<div class="fp-head" style="display:flex;align-items:flex-start;gap:12px;padding:18px 20px;cursor:pointer;">'
      + '<div style="flex:1;">'
      + '<div style="font-size:13px;font-weight:800;color:var(--t1);text-transform:uppercase;letter-spacing:1px;">' + esc(g.name) + '</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-top:5px;">' + esc(g.summary || '') + '</div>'
      + '</div>'
      + '<span class="fp-chev" style="flex-shrink:0;font-size:14px;color:var(--t3);transform:rotate(' + (expanded ? '90' : '0') + 'deg);transition:transform 0.15s;">&#9656;</span>'
      + '</div>'
      + '<div class="fp-body" style="display:' + (expanded ? 'block' : 'none') + ';padding:0 20px 20px;border-top:1px solid var(--b2);">'
      + this.processSection(g)
      + this.implementSection(g)
      + this.mistakesSection(g)
      + this.quickRefSection(g)
      + this.aiSection(g)
      + '</div></div>';
  },

  sh(text) {
    return '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;'
      + 'color:var(--gold);margin:20px 0 12px;">' + esc(text) + '</div>';
  },

  // ── Fix process — every step is a link ──────────────────────────────────────
  processSection(g) {
    const p = g.process;
    if (!p) return '';
    const steps = (p.steps || []).map((s, i) => this.stepRow(s, g.module, i + 1)).join('');
    return this.sh('The Fix Process')
      + (p.intro ? '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:8px;">' + esc(p.intro) + '</div>' : '')
      + steps;
  },

  stepRow(s, module, num) {
    const kind = s.kind || 'action';
    const meta = {
      action:    { label: 'DO IT',     color: 'var(--gold)',  bg: 'var(--gold-bg)' },
      result:    { label: 'SEE IT',    color: 'var(--steel)', bg: 'rgba(72,136,168,0.12)' },
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

    return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--b2);">'
      + '<div style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--gold-bg);'
      + 'color:var(--gold);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + num + '</div>'
      + '<div style="flex:1;">'
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<span style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(s.title) + '</span>'
      + (meta.label ? '<span style="font-size:8px;font-weight:800;letter-spacing:1px;text-transform:uppercase;'
          + 'padding:2px 6px;border-radius:3px;background:' + meta.bg + ';color:' + meta.color + ';">' + meta.label + '</span>' : '')
      + '</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.65;margin-top:4px;">' + esc(s.detail || '') + '</div>'
      + (link ? '<div style="margin-top:8px;">' + link + '</div>' : '')
      + '</div></div>';
  },

  // ── Recovery tracking — log when a fix went in ──────────────────────────────
  implementSection(g) {
    const log = (window.App && App.data && Array.isArray(App.data.fix_log)) ? App.data.fix_log : [];
    const mine = log.filter(e => e.gap_id === g.id)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const inputStyle = 'background:var(--input);border:1px solid var(--b1);border-radius:3px;'
      + 'color:#fff;font-size:13px;padding:7px 10px;width:100%;color-scheme:dark;';

    let html = this.sh('Recovery Tracking');
    html += '<div style="font-size:12px;color:var(--t2);line-height:1.65;margin-bottom:10px;">'
      + 'When you have this fix in place, log the date. The Recovery Scoreboard measures the metric before and after to show what the fix recovered.</div>';

    if (mine.length) {
      html += mine.map(e => {
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
        return '<div style="padding:8px 0;border-bottom:1px solid var(--b2);">'
          + '<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--t2);">'
          + '<span style="flex-shrink:0;width:6px;height:6px;border-radius:50%;background:var(--gold);"></span>'
          + 'Implemented ' + esc(e.date)
          + '<button class="btn btn-ghost btn-sm fp-unlog" data-log="' + esc(e.id) + '" style="margin-left:auto;">Remove</button>'
          + '</div>'
          + (result ? '<div style="font-size:12px;line-height:1.6;margin:4px 0 0 14px;color:'
              + (good ? 'var(--gold)' : 'var(--t3)') + ';">' + esc(result) + '</div>' : '')
          + '</div>';
      }).join('');
    }

    html += '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-top:10px;">'
      + '<div class="f" style="width:150px;">'
      + '<label>Implemented On</label>'
      + '<input type="date" class="fp-impl-date" data-gap="' + esc(g.id) + '" style="' + inputStyle + '"/>'
      + '</div>'
      + '<button class="btn btn-primary btn-sm fp-impl-save" data-gap="' + esc(g.id) + '" '
      + 'data-module="' + esc(g.module) + '" data-name="' + esc(g.name) + '">Mark Implemented</button>'
      + '</div>';
    return html;
  },

  // ── Common mistakes ─────────────────────────────────────────────────────────
  mistakesSection(g) {
    if (!g.commonMistakes || !g.commonMistakes.length) return '';
    const items = g.commonMistakes.map(m =>
      '<div style="display:flex;gap:10px;padding:7px 0;">'
      + '<span style="flex-shrink:0;width:6px;height:6px;border-radius:50%;background:var(--red);margin-top:6px;"></span>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.65;">' + esc(m) + '</div></div>').join('');
    return this.sh('Common Mistakes') + items;
  },

  // ── Quick Reference card ────────────────────────────────────────────────────
  quickRefSection(g) {
    const q = g.quickRef;
    if (!q) return '';
    let html = this.sh('Quick Reference Card');
    html += '<div class="fp-qr" style="background:var(--input);border:1px solid var(--b1);border-radius:4px;padding:16px 18px;">';

    if (q.rhythm && q.rhythm.length) {
      html += '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin-bottom:8px;">Weekly Rhythm</div>'
        + q.rhythm.map(r =>
            '<div style="display:flex;gap:9px;padding:4px 0;font-size:12px;color:var(--t2);">'
            + '<span style="flex-shrink:0;color:var(--t4);">&#9633;</span>' + esc(r) + '</div>').join('');
    }
    if (q.benchmarks && q.benchmarks.length) {
      const rows = q.benchmarks.map(b =>
        '<tr><td style="padding:5px 8px;font-size:12px;color:var(--t1);">' + esc(b.label) + '</td>'
        + '<td style="padding:5px 8px;font-size:12px;color:var(--gold);">' + esc(b.target || '—') + '</td>'
        + '<td style="padding:5px 8px;font-size:12px;color:var(--t2);">' + esc(b.warning || '—') + '</td>'
        + '<td style="padding:5px 8px;font-size:12px;color:var(--red);">' + esc(b.critical || '—') + '</td></tr>').join('');
      html += '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:14px 0 6px;">Benchmarks</div>'
        + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">'
        + '<thead><tr>'
        + '<th style="text-align:left;padding:4px 8px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);"></th>'
        + '<th style="text-align:left;padding:4px 8px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">Target</th>'
        + '<th style="text-align:left;padding:4px 8px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">Watch</th>'
        + '<th style="text-align:left;padding:4px 8px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);">Critical</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    if (q.escalation && q.escalation.length) {
      html += '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin:14px 0 6px;">Investigation Steps</div>'
        + q.escalation.map((e, i) =>
            '<div style="display:flex;gap:9px;padding:4px 0;font-size:12px;color:var(--t2);line-height:1.6;">'
            + '<span style="flex-shrink:0;color:var(--gold);font-weight:700;">' + (i + 1) + '.</span>' + esc(e) + '</div>').join('');
    }
    html += '<div style="margin-top:14px;"><button class="btn btn-ghost btn-sm fp-print">Print Card</button></div>';
    html += '</div>';
    return html;
  },

  // ── AI workflow cards ───────────────────────────────────────────────────────
  aiSection(g) {
    if (!g.aiWorkflows || !g.aiWorkflows.length) return '';
    let html = this.sh('AI Workflow Cards')
      + '<div style="font-size:11px;color:var(--t3);line-height:1.6;margin-bottom:10px;">'
      + 'Copy a prompt into your own AI tool. Run it on real, verified numbers. The app never sends these for you.</div>';
    g.aiWorkflows.forEach((w, i) => {
      html += '<div style="border:1px solid var(--b1);border-radius:4px;padding:14px 16px;margin-bottom:10px;">'
        + '<div style="display:flex;gap:10px;align-items:baseline;">'
        + '<span style="font-family:\'Barlow Condensed\';font-size:20px;font-weight:600;color:var(--gold);">' + (i + 1) + '</span>'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(w.title) + '</div></div>'
        + (w.whatItDoes ? '<div style="font-size:12px;color:var(--t2);line-height:1.65;margin:6px 0 10px;">' + esc(w.whatItDoes) + '</div>' : '')
        + '<div class="fp-prompt" style="background:var(--input);border:1px solid var(--b2);border-radius:4px;'
        + 'padding:12px 14px;font-size:12px;color:var(--t1);line-height:1.65;white-space:pre-wrap;">' + esc(w.prompt) + '</div>'
        + (w.whatToPaste ? '<div style="font-size:11px;color:var(--t3);line-height:1.6;margin-top:8px;">' + esc(w.whatToPaste) + '</div>' : '')
        + '<div style="margin-top:10px;"><button class="btn btn-ghost btn-sm fp-copy">Copy Prompt</button></div>'
        + '</div>';
    });
    return html;
  },

  // ── Event wiring ────────────────────────────────────────────────────────────
  wire(el) {
    el.querySelectorAll('.fp-head').forEach(head => {
      head.addEventListener('click', () => {
        const card = head.closest('.fp-gap');
        const body = card.querySelector('.fp-body');
        const chev = head.querySelector('.fp-chev');
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        if (chev) chev.style.transform = 'rotate(' + (open ? '0' : '90') + 'deg)';
      });
    });
    el.addEventListener('click', ev => {
      const go = ev.target.closest('.fp-go');
      const copy = ev.target.closest('.fp-copy');
      const print = ev.target.closest('.fp-print');
      const implSave = ev.target.closest('.fp-impl-save');
      const unlog = ev.target.closest('.fp-unlog');
      if (go) { App.openScreen(go.dataset.target); return; }
      if (print) { window.print(); return; }
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
      if (copy) {
        const block = copy.closest('div').parentElement.querySelector('.fp-prompt');
        if (block && navigator.clipboard) {
          navigator.clipboard.writeText(block.textContent).then(() => {
            copy.textContent = 'Copied';
            setTimeout(() => { copy.textContent = 'Copy Prompt'; }, 1800);
          });
        }
      }
    });
  }
};
