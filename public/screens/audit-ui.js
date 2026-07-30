'use strict';
/* ── Shared Audit UI ───────────────────────────────────────────────────────
   THE single source of truth for the Profit / Revenue / Cash audit layout:
   the landing request card, the merged Latest-Audit card (summary + section
   breakdown rows), the 12-month score-history bars, the Audit History list, and
   the full-view hero + recoverable strip + Action Items + scored-section blocks
   + Fix buttons. Each audit screen supplies only its own section DEFINITIONS and
   data; the LAYOUT lives here so all three stay identical and a future tweak is
   made once. `pfx` = the screen's button-class prefix ('at' profit / 'ra'
   revenue / 'ca' cash). Built off the Profit audit (audit-tracker.js). */
const AuditUI = {

  _gsProgBar(done, total) {
    const pct = total ? Math.round(done / total * 100) : 0;
    return '<div style="height:6px;background:var(--bg);border:1px solid var(--b-edge);border-radius:3px;overflow:hidden;margin:2px 0 14px;">'
      + '<div style="height:100%;width:' + pct + '%;background:var(--green);transition:width .2s;"></div></div>';
  },
  wireFirstAudit(container) {
    if (!container) return;
    container.querySelectorAll('.au-fa-step[data-go]').forEach(el =>
      el.addEventListener('click', () => App.openScreen(el.dataset.go)));
    container.querySelectorAll('input[id$="-fa-check"]').forEach(cb =>
      cb.addEventListener('change', () => {
        const btn = document.getElementById(cb.id.replace('-fa-check', '-new-btn'));
        if (btn) { btn.disabled = !cb.checked; btn.style.opacity = cb.checked ? '' : '0.5'; btn.style.cursor = cb.checked ? '' : 'default'; }
      }));
  },

  // ── Weekly sales estimate (cold-start fallback) ──────────────────────────────
  // Until the first week is closed there is no real revenue for an audit to size
  // its dollars off. Instead of a stale annual guess from onboarding, we ask for
  // last week's bar + food sales at generate time, store it keyed to the current
  // week, and let a real POS week supersede it. A new week re-prompts.
  _weekKey() { return App.weekStartFor(App.todayLocal()); },
  weekSalesEstimate() {
    const e = (App.data.settings || {}).week_sales_estimate;
    return (e && e.week === this._weekKey() && ((+e.bar || 0) > 0 || (+e.food || 0) > 0)) ? e : null;
  },
  promptWeekSales(onReady) {
    const id = 'week-sales-modal';
    const html = '<div class="card form-card narrow-form" style="margin:0;">'
      + '<div class="card-title">Estimate Last Week\'s Sales</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:14px;line-height:1.55;">Enter last week\'s bar and food sales so this audit has real numbers to work from. Once you drop your POS sales files when closing the week, those numbers take over and this box goes away.</div>'
      + '<div class="form-row" style="gap:12px;flex-wrap:wrap;">'
      +   '<div class="f"><label>Last Week\'s Bar Sales</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ws-bar" min="0" step="1" placeholder="0"/></div></div>'
      +   '<div class="f"><label>Last Week\'s Food Sales</label><div class="fw"><span class="pre">$</span><input class="pre" type="number" id="ws-food" min="0" step="1" placeholder="0"/></div></div>'
      + '</div>'
      + '<div class="card-actions"><button class="btn btn-primary" id="ws-save">Use These Numbers</button>'
      +   '<span id="ws-err" style="color:var(--red);font-size:12px;align-self:center;display:none;">Enter at least one number.</span></div>'
      + '</div>';
    App.openModal(html, { id, maxWidth: 540 });
    document.getElementById('ws-save')?.addEventListener('click', async () => {
      const bar  = parseFloat(document.getElementById('ws-bar')?.value)  || 0;
      const food = parseFloat(document.getElementById('ws-food')?.value) || 0;
      if (bar <= 0 && food <= 0) { const e = document.getElementById('ws-err'); if (e) e.style.display = 'inline'; return; }
      App.data.settings = App.data.settings || {};
      App.data.settings.week_sales_estimate = { week: this._weekKey(), bar, food };
      await App.saveKey('settings');
      App.closeModal(id);
      if (onReady) onReady();
    });
  },

  // ── Projected data quality ───────────────────────────────────────────────────
  // The level this audit would come out at if run RIGHT NOW, off the data Bar Cop
  // currently holds. readyArr = one boolean per SCORED section (true = that section
  // has data to score). Uses the same Full/Partial/Limited thresholds as the
  // post-run dataQuality badge, so the projection matches the real result. Zero
  // ready reads "Not enough data".
  projectedQuality(readyArr) {
    const total = (readyArr || []).length;
    const scored = (readyArr || []).filter(Boolean).length;
    if (!total || scored === 0) return { label: 'Not enough data', color: 'var(--t3)', none: true, full: false };
    if (scored >= total)   return { label: 'Full data',    color: 'var(--green)', none: false, full: true };
    if (scored * 2 >= total) return { label: 'Partial data', color: 'var(--amber)', none: false, full: false };
    return { label: 'Limited data', color: 'var(--t3)', none: false, full: false };
  },
  projectedChip(q) {
    return '<span style="display:inline-block;font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:3px 10px;border-radius:20px;background:transparent;border:1px solid var(--b-edge);color:' + q.color + ';white-space:nowrap;flex-shrink:0;">' + esc(q.label) + '</span>';
  },

  // ── Readiness card — the shared pre-generate screen for all four audits ──────
  // A live projected-quality badge (what the audit would come out at if run now)
  // + a progress bar + a checklist of what the audit reads, each row auto-checked
  // (green) once Bar Cop has that data or tappable to jump to the step that fills
  // it, then the Generate button at the bottom. Audits are uncapped (run anytime),
  // so there is no lock and no run-without-data warning. The screen wires the jump
  // via wireFirstAudit and the Generate via #<pfx>-gen-btn.
  //   cfg: { pfx, title, desc, steps:[{label, done, go}], sectionsReady:[bool], hasLatest }
  readinessCard(cfg) {
    const steps = cfg.steps || [];
    const doneCount = steps.filter(s => s.done).length;
    // Projected badge: prefer an explicit per-section readiness array (faithful to
    // the post-run badge); fall back to step completion when a caller omits it.
    const readyArr = Array.isArray(cfg.sectionsReady) ? cfg.sectionsReady : steps.map(s => !!s.done);
    const q = AuditUI.projectedQuality(readyArr);
    const label = cfg.hasLatest ? 'Generate New Audit' : 'Generate First Audit';
    const genBtn = '<button class="btn btn-primary" id="' + cfg.pfx + '-gen-btn">' + label + '</button>';
    const projLine = q.none
      ? 'No data in Bar Cop yet. Work the steps below, then run your first audit.'
      : q.full
        ? 'Run it now and you get a <strong style="color:' + q.color + ';">Full data</strong> audit. Bar Cop has everything this reads.'
        : 'Run it now and you get a <strong style="color:' + q.color + ';">' + esc(q.label) + '</strong> audit. Fill in the rest below to move it up.';
    const rows = steps.map((s, i) =>
      '<div class="au-fa-step"' + (s.done || !s.go ? '' : ' data-go="' + s.go + '"') + ' style="display:flex;align-items:center;gap:13px;padding:12px 14px;margin-top:8px;background:#0D181E;border-radius:8px;' + (s.done || !s.go ? '' : 'cursor:pointer;') + '">'
      + (s.done
          ? '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:13px;font-weight:800;">&#10003;</span>'
          : '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:11px;font-weight:800;">' + (i + 1) + '</span>')
      + '<div style="flex:1;min-width:0;font-size:13px;font-weight:600;color:' + (s.done ? 'var(--t3)' : 'var(--t1)') + ';">' + esc(s.label) + '</div>'
      + (s.done ? '<span style="font-size:11px;color:var(--green);font-weight:700;flex-shrink:0;">Have it</span>'
                : (s.go ? '<span style="color:var(--t4);font-size:13px;flex-shrink:0;">&rsaquo;</span>' : ''))
      + '</div>').join('');
    // Generate button lives OUTSIDE the card, bottom-left, at normal size (the
    // app-wide on-page form-button standard). Status message sits beside it.
    return '<div class="card form-card" style="margin-bottom:12px;">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><span>' + esc(cfg.title) + '</span>' + AuditUI.projectedChip(q) + '</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:6px;">' + cfg.desc + '</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:10px;">' + projLine + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:8px;"><strong style="color:var(--green);">' + doneCount + '</strong> of ' + steps.length + ' ready</div>'
      + this._gsProgBar(doneCount, steps.length)
      + rows
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:12px;margin:0 0 20px;">' + genBtn + '<span id="' + cfg.pfx + '-gen-status" style="font-size:12px;color:var(--red);display:none;"></span></div>';
  },

  // ── Landing: View-Full-Audit button + merged Latest-Audit card ─────────────
  // Summary on top, the section breakdown folded in as a compact row list (bar
  // beside the score; one row per section on mobile). View button sits above.
  landingCard(latest, prev, sectionNames, pfx) {
    const naO = latest.overall_score == null;
    const scoreColor = naO ? 'var(--t3)' : App.scoreColor(latest.overall_score);
    const scoreLabel = naO ? 'Not enough data yet' : App.scoreLabel(latest.overall_score);
    let vsLine = '';
    if (prev && latest.overall_score != null && prev.overall_score != null) {
      const diff = latest.overall_score - prev.overall_score;
      vsLine = '<div style="font-size:12px;margin-top:8px;"><span style="color:' + (diff>=0?'var(--green)':'var(--red)') + ';font-weight:700;">' + (diff>=0?'+':'') + diff + ' pts</span><span style="color:var(--t3);"> vs last audit (' + prev.overall_score + ' to ' + latest.overall_score + ')</span></div>';
    }
    const sections = latest.sections || {};
    const names = sectionNames || Object.keys(sections);
    // Section breakdown as the Hub card-row pills: name left, bar + score + delta
    // right, each its own rounded #0D181E pill with a 6px gap.
    const secRows = names.map((name, i) => {
      const score = sections[name];
      const na   = score == null;
      const col  = na ? 'var(--t3)' : App.scoreColor(score);
      const bar  = na ? 0 : Math.min(100, Math.max(0, score));
      const ps   = prev && prev.sections ? prev.sections[name] : null;
      const diff = (!na && ps != null) ? score - ps : null;
      return '<div style="display:flex;align-items:center;gap:14px;padding:10px 14px;background:#0D181E;border-radius:6px;' + (i ? 'margin-top:6px;' : '') + '">'
        + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t3);">' + esc(name) + '</div>'
        + (na ? '' : '<div style="width:70px;flex-shrink:0;background:var(--b2);height:6px;border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + bar + '%;background:' + col + ';border-radius:3px;"></div></div>')
        + '<div style="width:34px;text-align:right;flex-shrink:0;font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:' + col + ';">' + (na ? 'N/A' : score) + '</div>'
        + '<div style="width:32px;text-align:right;flex-shrink:0;color:' + (diff==null||diff===0?'var(--t3)':diff>0?'var(--green)':'var(--red)') + ';font-size:12px;">' + (diff!=null&&diff!==0?(diff>0?'+':'')+diff:'') + '</div>'
        + '</div>';
    }).join('');
    return '<div class="card" style="margin-bottom:16px;overflow:hidden;">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;">'
      + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Latest Audit</div>'
      + '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + esc(latest.bar_name||App.data.settings.bar_name||'Your Bar') + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (latest.date||'').slice(0,10) + (latest.audit_period ? '  ' + esc(latest.audit_period) : '') + '</div>'
      + vsLine + '</div>'
      + '<div style="text-align:right;">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:52px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + (naO ? 'N/A' : latest.overall_score) + '</div>'
      + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';margin:2px 0 8px;">' + scoreLabel + '</div>'
      + '</div></div>'
      + '<div style="margin-top:16px;">' + secRows + '</div>'
      + '<div style="display:flex;justify-content:flex-end;margin-top:20px;"><button class="btn btn-ghost btn-sm ' + pfx + '-view-btn" data-idx="0">View Full Audit</button></div>'
      + '</div>';
  },

  // ── Data-quality badge ─────────────────────────────────────────────────────
  // Uniform across all four audits: how much of the audit had real data behind
  // it, measured by how many of its sections cleared the confidence bar and got
  // scored (a section reads N/A when the app has no data for it, so scored-of-
  // total is a faithful read of the data the app held when the audit ran). This
  // replaces the old upload-era "Tier 2 / Tier 3" grade. total = the audit's full
  // section count (passed by each caller).
  dataQuality(a, total) {
    const scored = Object.keys((a && a.sections) || {}).length;
    const t = total || scored;
    if (!t) return null;
    // Nothing scored is not "limited", it is NONE. "Limited data" implies some data
    // got through; an audit with zero scored sections has none and its overall_score
    // is null, so the badge sat one line under "Profit Score: N/A (Not enough data
    // yet)" in the exported PDF and contradicted it. This is also the branch that
    // makes the projection above honest: projectedQuality promises "Not enough data"
    // at zero ready, and without this the post-run badge could never produce it.
    if (!scored) return { label: 'Not enough data', color: 'var(--t3)' };
    if (scored >= t)   return { label: 'Full data',    color: 'var(--green)' };
    if (scored*2 >= t) return { label: 'Partial data', color: 'var(--amber)' };
    return { label: 'Limited data', color: 'var(--t3)' };
  },
  // Plain-text data-quality label for the PDFs (which take text, not HTML chips).
  dataQualityLabel(a, total) { const q = this.dataQuality(a, total); return q ? q.label : ''; },
  dataQualityChip(a, total) {
    const q = this.dataQuality(a, total);
    if (!q) return '';
    return '<span style="display:inline-block;font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:3px 10px;border-radius:20px;background:transparent;border:1px solid var(--b-edge);color:' + q.color + ';">' + esc(q.label) + '</span>';
  },

  // ── Landing: Audit History data-card ───────────────────────────────────────
  // Identical across all four audits: Date / Score / Change / Data Quality / View,
  // one #0D181E pill per row via .row-list, colgroup for even spacing, data left-
  // aligned under its header. opts.sectionCount = the audit's full section count,
  // read by dataQualityChip.
  historyCard(audits, listKey, pfx, opts) {
    opts = opts || {};
    const total = opts.sectionCount || 0;
    const rows = audits.slice(0, App.listLimit('core', listKey)).map((a,i) => {
      const p    = audits[i+1];
      const naA  = a.overall_score == null;
      const col  = naA ? 'var(--t3)' : App.scoreColor(a.overall_score);
      const diff = (p && !naA && p.overall_score != null) ? a.overall_score - p.overall_score : null;
      return '<tr>'
        + '<td>' + (a.date||'').slice(0,10) + '</td>'
        + '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:' + col + ';">' + (naA ? 'N/A' : a.overall_score) + '</td>'
        + '<td style="color:' + (diff==null||diff===0?'var(--t3)':diff>0?'var(--green)':'var(--red)') + ';">' + (diff!=null&&diff!==0?(diff>0?'+':'')+diff+' pts':'') + '</td>'
        + '<td>' + AuditUI.dataQualityChip(a, total) + '</td>'
        + '<td style="text-align:right;"><button class="btn btn-ghost btn-sm ' + pfx + '-view-btn" data-idx="' + i + '">View</button></td>'
        + '</tr>';
    }).join('');
    return '<div class="sh" style="margin:24px 0 10px;">Audit History</div>'
      + '<div class="card" style="overflow-x:auto;"><table class="row-list">'
      + '<colgroup><col style="width:24%;"><col style="width:14%;"><col style="width:16%;"><col style="width:28%;"><col style="width:18%;"></colgroup>'
      + '<thead><tr><th>Audit Date</th><th>Score</th><th>Change</th><th>Data Quality</th><th></th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>'
      + App.showOlderBar('core', listKey, audits, false);
  },


  // ── Full view: findings text under a section (the divider above provides the
  //    spacing). Shared block so the recovery audits and the Bar Cop audit read
  //    the same. ───────────────────────────────────────────────────────────────
  findingsBlock(texts) {
    texts = (texts || []).filter(v => v && String(v).trim());
    if (!texts.length) return '';
    return '<div>'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Findings</div>'
      + texts.map(t => '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:8px;">' + esc(t) + '</div>').join('')
      + '</div>';
  },
  findings(d, num) {
    if (!d) return '';
    const fields = ['S'+num+'_EVIDENCE', 'S'+num+'_GAP', 'S'+num+'_TOOL', 'S'+num+'_NARRATIVE', 'S'+num+'_FINDING'];
    return AuditUI.findingsBlock(fields.map(f => d[f]));
  },

  // ── Full view: one scored section (metric readout + signals + findings) ────
  // items = [[label, value, highlight?]]; highlight 'warn'(red)/'good'(gold).
  // signals = risk-signal objects for the Risk Signals section (score null).
  // d = the audit raw, for the inline Findings.
  sectionBlock(num, name, score, items, signals, d) {
    const naScore = score == null;
    // Metrics as flush recessed rows (the Hub card-row look, no bordered box):
    // label left, value right, #0D181E with row dividers, full-bleed in the card.
    const rows = (items||[]).filter(([,v]) => v !== undefined && v !== null && v !== '' && v !== 0 && v !== '0')
      // 4th element = an optional BASIS note, rendered by metricRows as a dimmed parenthetical.
      // It exists so a row can say which basis its number is on (S9): c-audit prints an on-hand
      // value directly above turns computed from the 4-count average, and a reader who does not
      // know that tries to divide one into the other and cannot make it reconcile.
      .map(([label, val, hl, extra]) => ({ label: label, value: String(val), extra: extra || '', valColor: hl==='warn'?'var(--red)':hl==='good'?'var(--green)':'var(--t1)' }));
    const rowsHtml = AuditUI.metricRows(rows);
    const sigRows = (signals||[]).map(sig => {
      const sc = (sig.score||'').toUpperCase();
      const dot = sc==='HIGH'?'var(--red)':sc==='MEDIUM'?'var(--amber)':'var(--t3)';
      return '<div style="border:1px solid var(--b-edge);border-radius:8px;padding:12px;margin-top:10px;">'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">'
        + '<div style="width:8px;height:8px;border-radius:50%;background:' + dot + ';flex-shrink:0;"></div>'
        + '<div style="font-size:11px;font-weight:700;color:var(--t1);">' + esc(sig.label||'') + '</div>'
        + '<div style="margin-left:auto;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:' + dot + ';">' + esc(sig.score||'') + '</div>'
        + '</div>'
        + (sig.evidence ? '<div style="font-size:11px;color:var(--t3);margin-bottom:4px;">' + esc(sig.evidence) + '</div>' : '')
        + (sig.gap      ? '<div style="font-size:11px;color:var(--t2);margin-bottom:4px;">' + esc(sig.gap) + '</div>' : '')
        + (sig.tool     ? '<div style="font-size:11px;color:var(--gold);">' + esc(sig.tool) + '</div>' : '')
        + '</div>';
    }).join('');
    const isSignals = signals && signals.length;
    const scoreBlock = !naScore
      ? AuditUI.scoreRing(score)
      : isSignals ? ''
        : '<div style="text-align:right;flex-shrink:0;"><div style="font-size:14px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);line-height:1;">N/A</div><div style="font-size:10px;color:var(--t4);margin-top:3px;">Not enough data</div></div>';
    const divider = '<div style="border-top:1px solid var(--b2);margin:14px 0;"></div>';
    const findingsHtml = AuditUI.findings(d, num);
    const body = rowsHtml + sigRows;
    return '<div class="card" style="margin-bottom:14px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">Section ' + num + '</div>'
      + '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + name + '</div></div>'
      + scoreBlock + '</div>'
      + (body ? divider + body : '')
      + (findingsHtml ? divider + findingsHtml : '')
      + '</div>';
  },

  // ── Section score as a circle gauge with the number inside (SVG uses literal
  //    hex per the SVG-fill rule). Used in every section header across the four
  //    audits so they read identically. ─────────────────────────────────────────
  scoreRing(score, size) {
    size = size || 44;
    const hex = score >= 70 ? '#518A79' : score >= 50 ? '#9A5D34' : '#C03828';
    const sw = 4, r = (size - sw) / 2, c = size / 2;
    const circ = 2 * Math.PI * r;
    const pct = Math.min(100, Math.max(0, score)) / 100;
    const dash = (circ * pct).toFixed(1) + ' ' + circ.toFixed(1);
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="flex-shrink:0;display:block;">'
      + '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="#1B262B" stroke-width="' + sw + '"/>'
      + '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + hex + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + dash + '" transform="rotate(-90 ' + c + ' ' + c + ')"/>'
      + '<text x="' + c + '" y="' + c + '" text-anchor="middle" dominant-baseline="central" font-family="Barlow Condensed, sans-serif" font-size="' + Math.round(size * 0.4) + '" font-weight="700" fill="' + hex + '">' + score + '</text>'
      + '</svg>';
  },

  // ── Metric/check rows — the Hub card-row look (.hd-step): each row is its own
  //    rounded #0D181E pill, label left + value right, separated by a 6px gap (no
  //    dividers, no bordered box). Shared by every audit section so all four read
  //    the same. rows = [{ label, extra?, value, valColor? }]. ──────────────────
  metricRows(rows) {
    if (!rows || !rows.length) return '';
    return rows.map((r, i) =>
      '<div style="display:flex;align-items:center;gap:14px;padding:10px 14px;background:#0D181E;border-radius:6px;' + (i ? 'margin-top:6px;' : '') + '">'
      + '<div style="flex:1;min-width:0;font-size:12px;color:var(--t3);line-height:1.4;">' + esc(r.label) + (r.extra ? ' <span style="color:var(--t4);">(' + esc(r.extra) + ')</span>' : '') + '</div>'
      + '<div style="flex-shrink:0;font-size:13px;font-weight:600;text-align:right;white-space:nowrap;color:' + (r.valColor || 'var(--t1)') + ';">' + esc(r.value) + '</div>'
      + '</div>'
    ).join('');
  },

  // ── Full view: score hero — full-bleed divider header (title left, Briefing
  //    right), then bar name + period + grade badge on the left and the overall
  //    score + band on the right. ──────────────────────────────────────────────
  viewHero(audit, heroLabel, pfx, sectionCount) {
    const naO = audit.overall_score == null;
    const dqChip = AuditUI.dataQualityChip(audit, sectionCount);
    const scoreColor = naO ? 'var(--t3)' : App.scoreColor(audit.overall_score||0);
    const scoreLabel = naO ? '' : App.scoreLabel(audit.overall_score);
    const sub = (audit.date||'').slice(0,10) + (audit.audit_period ? '  |  ' + esc(audit.audit_period) : '') + (audit.audit_id ? '  |  ' + esc(audit.audit_id) : '');
    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      +   '<span>' + esc(heroLabel) + '</span>'
      +   '<div id="' + (pfx || 'audit') + '-outlook-mount" style="flex-shrink:0;"></div>'
      + '</div>'
      + '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap;">'
      + '<div>'
      + '<div style="font-size:20px;font-weight:800;color:var(--t1);">' + esc(audit.bar_name||App.data.settings.bar_name||'Your Bar') + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:4px;">' + sub + '</div>'
      + (dqChip ? '<div style="margin-top:10px;">' + dqChip + '</div>' : '')
      + '</div>'
      + (naO
          ? '<div style="text-align:right;"><div style="font-size:18px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);line-height:1;">N/A</div><div style="font-size:10px;color:var(--t4);margin-top:4px;">Not enough data yet</div></div>'
          : '<div style="text-align:right;">'
            + '<div style="display:flex;align-items:baseline;gap:8px;justify-content:flex-end;">'
            +   '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:44px;font-weight:700;color:' + scoreColor + ';line-height:0.9;">' + audit.overall_score + '</div>'
            +   (scoreLabel ? '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';">' + esc(scoreLabel) + '</div>' : '')
            + '</div>'
            + '<div style="width:180px;max-width:100%;margin-left:auto;margin-top:8px;text-align:left;">' + App.scoreBar(audit.overall_score) + '</div>'
            + '</div>')
      + '</div></div>';
  },

  // ── Full view: total recoverable stat strip (money hero) ───────────────────
  recoverStrip(audit) {
    const d = audit.raw || audit;
    const totalMonthly = (audit.action_items||[]).reduce((s,a) => s+(a.monthly_impact||0), 0);
    const hasWeekly = !!d.WEEKLY_GAP_AMT;
    if (!(totalMonthly > 0) && !hasWeekly) return '';
    const calcItem = (label, val) => '<div class="calc-item"><div class="calc-label">' + label + '</div><div class="calc-val lg good">' + val + '</div></div>';
    return '<div class="card" style="margin-bottom:16px;"><div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;">'
      + (totalMonthly > 0 ? calcItem('Recoverable / Month', App.fmtCurrency(totalMonthly)) + calcItem('Annualized', App.fmtCurrency(totalMonthly*12)) : '')
      + (hasWeekly ? calcItem('Weekly Gap', esc(String(d.WEEKLY_GAP_AMT))) : '')
      + '</div></div>';
  },

  // ── Full view: Action Items heading row (+ Outlook mount) + ranked list ────
  actionsArea(audit, gapModule, pfx) {
    const actionItems = (audit.action_items || []).map((a,i) => {
      const txt = a.action || a || '';
      const gid = a.gap_id || (window.FixPanel ? FixPanel.inferGapId(txt, gapModule) : null);
      const btn = gid
        ? '<button class="' + pfx + '-fix-btn" data-gap="' + esc(gid) + '" style="flex-shrink:0;background:transparent;border:1px solid var(--b1);color:var(--t2);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 11px;border-radius:3px;cursor:pointer;align-self:center;">Fix This</button>'
        : '';
      return '<div class="at-arow" style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--b2);align-items:center;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:24px;font-weight:700;color:var(--t3);width:28px;flex-shrink:0;align-self:center;">' + (i+1) + '</div>'
        + '<div style="flex:1;"><div style="font-size:13px;color:var(--t1);line-height:1.6;">' + esc(txt) + '</div>'
        + (a.monthly_impact ? '<div style="font-size:12px;margin-top:4px;"><span style="color:var(--gold);font-weight:700;">+' + App.fmtCurrency(a.monthly_impact) + '</span><span style="color:var(--t3);">/month opportunity</span></div>' : '')
        + '</div>'
        + btn
        + '</div>';
    }).join('');
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:24px 0 10px;">'
      + '<div class="sh" style="margin:0;">' + (actionItems ? 'Action Items, Ranked by Impact' : '') + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">'
      +   '<button class="btn btn-ghost btn-sm ' + pfx + '-export-btn">Export PDF</button>'
      + '</div>'
      + '</div>'
      + (actionItems ? '<div class="card" style="margin-bottom:16px;">' + actionItems + '</div>' : '');
  },

  // Mount the Bar Cop Outlook into the actions-area slot (call after innerHTML).
  attachOutlook(pfx, audit, module) {
    const m = document.getElementById(pfx + '-outlook-mount');
    if (m && window.AuditOutlook) AuditOutlook.attach(m, audit, module, { compact: true });
  },

  // ── Intake-form helpers (shared by all three audit intakes) ────────────────
  // Generic banded form card.
  formCard(title, bodyHtml) {
    return '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">' + esc(title) + '</div>' + bodyHtml + '</div>';
  },

  // A $ baseline input (sales/revenue), matching the standard form field.
  moneyField(id, label, ph, val) {
    return '<div class="f" style="width:220px;"><label>' + esc(label) + '</label>'
      + '<div class="fw"><span class="pre">$</span><input class="form-input pre" type="number" id="' + id + '" placeholder="' + esc(ph) + '" value="' + esc(val || '') + '"/></div></div>';
  },




};
