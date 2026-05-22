'use strict';

/* ── Fix Panel — the Fix Layer renderer ───────────────────────────────────────
   Renders a Recovery module's gap-areas from the static FIX content: the fix
   process, formulas, common mistakes, Quick Reference card, fill-in templates,
   and AI workflow cards. 100% static + client-side (Rule 23 — zero API cost).
   Used by each module's Help & FAQ screen.

   FixPanel.renderInto(el, moduleKey, focusId)
     el        — container element
     moduleKey — 'profit' | 'revenue' | 'traffic'
     focusId   — optional gap-area id to auto-expand and scroll to */

window.FixPanel = {
  gapAreas(moduleKey) {
    return (window.FIX && Array.isArray(FIX[moduleKey])) ? FIX[moduleKey] : [];
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
    const body = expanded ? 'block' : 'none';
    return '<div class="card fp-gap" data-gap="' + esc(g.id) + '" style="padding:0;overflow:hidden;">'
      + '<div class="fp-head" style="display:flex;align-items:flex-start;gap:12px;padding:18px 20px;cursor:pointer;">'
      + '<div style="flex:1;">'
      + '<div style="font-size:13px;font-weight:800;color:var(--t1);text-transform:uppercase;letter-spacing:1px;">' + esc(g.name) + '</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin-top:5px;">' + esc(g.summary || '') + '</div>'
      + '</div>'
      + '<span class="fp-chev" style="flex-shrink:0;font-size:14px;color:var(--t3);transform:rotate(' + (expanded ? '90' : '0') + 'deg);transition:transform 0.15s;">&#9656;</span>'
      + '</div>'
      + '<div class="fp-body" style="display:' + body + ';padding:0 20px 20px;border-top:1px solid var(--b2);">'
      + this.processSection(g)
      + this.formulasSection(g)
      + this.mistakesSection(g)
      + this.quickRefSection(g)
      + this.templatesSection(g)
      + this.aiSection(g)
      + '</div></div>';
  },

  sh(text) {
    return '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;'
      + 'color:var(--gold);margin:20px 0 12px;">' + esc(text) + '</div>';
  },

  // ── Fix process ─────────────────────────────────────────────────────────────
  processSection(g) {
    const p = g.process;
    if (!p) return '';
    const steps = (p.steps || []).map((s, i) =>
      '<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--b2);">'
      + '<div style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--gold-bg);'
      + 'color:var(--gold);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + (i + 1) + '</div>'
      + '<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(s.title) + '</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.65;margin-top:3px;">' + esc(s.detail) + '</div></div>'
      + '</div>').join('');
    return this.sh('The Fix Process')
      + (p.intro ? '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:8px;">' + esc(p.intro) + '</div>' : '')
      + steps;
  },

  // ── Formulas ────────────────────────────────────────────────────────────────
  formulasSection(g) {
    if (!g.formulas || !g.formulas.length) return '';
    const boxes = g.formulas.map(f =>
      '<div style="background:var(--input);border:1px solid var(--b2);border-radius:4px;padding:12px 14px;margin-bottom:8px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);margin-bottom:5px;">' + esc(f.label) + '</div>'
      + '<div style="font-size:12px;color:var(--w);line-height:1.6;">' + esc(f.formula) + '</div>'
      + (f.example ? '<div style="font-size:11px;color:var(--t3);line-height:1.6;margin-top:4px;">e.g. ' + esc(f.example) + '</div>' : '')
      + '</div>').join('');
    return this.sh('Formulas') + boxes;
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

  // ── Templates ───────────────────────────────────────────────────────────────
  templatesSection(g) {
    if (!g.templates || !g.templates.length) return '';
    let html = this.sh('Templates');
    g.templates.forEach(t => {
      const fields = (t.fields || []).map(f =>
        '<div class="f" style="width:200px;flex-shrink:0;"><label>' + esc(f.label) + '</label>'
        + '<input type="text" class="fp-tpl-field" data-tpl="' + esc(t.id) + '" data-key="' + esc(f.key) + '" '
        + 'placeholder="' + esc(f.placeholder || '') + '"/></div>').join('');
      html += '<div class="fp-tpl" data-tpl="' + esc(t.id) + '" data-body="' + esc(t.body || '') + '" '
        + 'style="border:1px solid var(--b1);border-radius:4px;padding:16px 18px;margin-bottom:10px;">'
        + '<div style="font-size:13px;font-weight:700;color:var(--t1);">' + esc(t.name) + '</div>'
        + (t.intro ? '<div style="font-size:12px;color:var(--t3);line-height:1.6;margin:5px 0 12px;">' + esc(t.intro) + '</div>' : '')
        + '<div class="form-row" style="gap:14px;margin-bottom:12px;">' + fields + '</div>'
        + '<div class="fp-tpl-preview" style="background:var(--input);border:1px solid var(--b2);border-radius:4px;'
        + 'padding:16px 18px;font-size:12px;color:var(--t1);line-height:1.7;white-space:pre-wrap;"></div>'
        + '<div style="margin-top:10px;"><button class="btn btn-ghost btn-sm fp-print">Print Template</button></div>'
        + '</div>';
    });
    return html;
  },

  // ── AI workflow cards ───────────────────────────────────────────────────────
  aiSection(g) {
    if (!g.aiWorkflows || !g.aiWorkflows.length) return '';
    let html = this.sh('AI Workflow Cards')
      + '<div style="font-size:11px;color:var(--t3);line-height:1.6;margin-bottom:10px;">'
      + 'Copy a prompt into your own AI tool. Run it on real, verified numbers — the app never sends these for you.</div>';
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
      const copy = ev.target.closest('.fp-copy');
      const print = ev.target.closest('.fp-print');
      if (copy) {
        const block = copy.closest('div').parentElement.querySelector('.fp-prompt');
        if (block && navigator.clipboard) {
          navigator.clipboard.writeText(block.textContent).then(() => {
            copy.textContent = 'Copied';
            setTimeout(() => { copy.textContent = 'Copy Prompt'; }, 1800);
          });
        }
      }
      if (print) window.print();
    });
    el.querySelectorAll('.fp-tpl').forEach(tpl => {
      const id = tpl.dataset.tpl;
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem('fixtpl_' + id) || '{}'); } catch (e) {}
      tpl.querySelectorAll('.fp-tpl-field').forEach(inp => {
        const key = inp.dataset.key;
        if (saved[key] != null) inp.value = saved[key];
        else if (key === 'bar_name' && App.data && App.data.settings && App.data.settings.bar_name) {
          inp.value = App.data.settings.bar_name;
        }
        inp.addEventListener('input', () => this.renderPreview(tpl));
      });
      this.renderPreview(tpl);
    });
  },

  renderPreview(tpl) {
    const id = tpl.dataset.tpl;
    let body = tpl.dataset.body || '';
    const vals = {};
    tpl.querySelectorAll('.fp-tpl-field').forEach(inp => {
      vals[inp.dataset.key] = inp.value.trim();
    });
    try { localStorage.setItem('fixtpl_' + id, JSON.stringify(vals)); } catch (e) {}
    body = body.replace(/\{\{(\w+)\}\}/g, (m, k) =>
      vals[k] ? vals[k] : '_______');
    const preview = tpl.querySelector('.fp-tpl-preview');
    if (preview) preview.textContent = body;
  }
};
