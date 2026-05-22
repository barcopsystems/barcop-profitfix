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

  renderInto(el, moduleKey, focusId) {
    if (!el) return;
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
      if (go) { App.openScreen(go.dataset.target); return; }
      if (print) { window.print(); return; }
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
