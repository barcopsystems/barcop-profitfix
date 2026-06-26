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

  // Data-quality tier badge — app colors only (gold-tint full / neutral else).
  tierChip(grade) {
    if (!grade) return '';
    const full = grade.includes('3') || grade.toLowerCase().includes('full') || grade.toLowerCase().includes('complete');
    return '<span style="display:inline-block;font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:3px 10px;border-radius:20px;'
      + (full ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t3);') + '">' + esc(grade) + '</span>';
  },

  // ── Landing: request card ─────────────────────────────────────────────────
  // opts.lockedNoInputs: this audit reads from logged data (no intake to edit),
  //   so when locked show only the countdown, never a "Review / Update Inputs".
  // opts.notReady: not enough data to score yet — the description carries it,
  //   no button and no countdown.
  requestCard(pfx, title, desc, canRun, hasLatest, daysLeft, opts) {
    opts = opts || {};
    let right;
    const label = hasLatest ? 'Generate New Audit' : 'Generate First Audit';
    if (canRun) {
      right = '<button class="btn btn-primary" id="' + pfx + '-new-btn">' + label + '</button>';
    } else {
      // Locked: the disabled button itself carries the countdown ("Next audit in
      // N days"), or the generic label when there is no day count (e.g. the Bar
      // Cop Audit before it has enough data). The intake is reachable only
      // through the active button, so a locked audit cannot be re-opened.
      const lockedLabel = daysLeft > 0
        ? 'Next audit in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's')
        : label;
      right = '<button class="btn btn-primary" disabled style="opacity:0.5;cursor:default;">' + lockedLabel + '</button>';
    }
    return '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">' + esc(title) + '</div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">'
      + '<div style="font-size:12px;color:var(--t3);max-width:520px;line-height:1.6;">' + desc + '</div>'
      + (right ? '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0;">' + right + '</div>' : '')
      + '</div></div>';
  },

  // ── First-audit gate ───────────────────────────────────────────────────────
  // Until the first audit is run, the request card is replaced by a Getting
  // Started box so nobody runs an empty audit. Computed audits (Cash, Bar Cop)
  // show auto-tracked steps + a progress bar and unlock Generate once the data is
  // there; upload audits (Profit, Revenue) show one confirm checkbox that enables
  // Generate. After the first audit, the normal weekly request card takes over.
  firstAuditCard(cfg) {
    if (cfg.hasLatest || !cfg.gs) {
      return this.requestCard(cfg.pfx, cfg.title, cfg.desc, cfg.canRun, cfg.hasLatest, cfg.daysLeft, cfg.opts);
    }
    const gs = cfg.gs;
    if (gs.mode === 'auto' && gs.ready) {
      // Unlocked: a real, active Generate First Audit button.
      return this.requestCard(cfg.pfx, cfg.title, cfg.desc, true, false, 0, cfg.opts);
    }
    return gs.mode === 'check' ? this._gsCheckCard(cfg.pfx, cfg.title, gs)
                               : this._gsAutoCard(cfg.pfx, cfg.title, gs);
  },
  _gsProgBar(done, total) {
    const pct = total ? Math.round(done / total * 100) : 0;
    return '<div style="height:6px;background:var(--bg);border:1px solid var(--b-edge);border-radius:3px;overflow:hidden;margin:2px 0 14px;">'
      + '<div style="height:100%;width:' + pct + '%;background:var(--green);transition:width .2s;"></div></div>';
  },
  _gsAutoCard(pfx, title, gs) {
    const steps = gs.steps || [];
    const doneCount = steps.filter(s => s.done).length;
    const rows = steps.map((s, i) =>
      '<div class="au-fa-step" data-go="' + s.go + '" style="display:flex;align-items:center;gap:13px;padding:12px 14px;margin-top:8px;background:#0D181E;border-radius:8px;cursor:pointer;">'
      + (s.done
          ? '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--green);color:var(--bg);font-size:13px;font-weight:800;">&#10003;</span>'
          : '<span style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--sel-active-bg);color:var(--gold);font-size:11px;font-weight:800;">' + (i + 1) + '</span>')
      + '<div style="flex:1;min-width:0;font-size:13px;font-weight:600;color:' + (s.done ? 'var(--t3)' : 'var(--t1)') + ';">' + esc(s.label) + '</div>'
      + (s.done ? '<span style="font-size:11px;color:var(--green);font-weight:700;flex-shrink:0;">Done</span>'
                : '<span style="color:var(--t4);font-size:13px;flex-shrink:0;">&rsaquo;</span>')
      + '</div>').join('');
    return '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">' + esc(title) + '</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:8px;">' + gs.intro + '</div>'
      + this._gsProgBar(doneCount, steps.length)
      + rows
      + '<div style="font-size:11px;color:var(--t3);margin-top:14px;line-height:1.55;">Finish these and Bar Cop unlocks your first audit. Once unlocked, run it again every 7 days.</div>'
      + '</div>';
  },
  _gsCheckCard(pfx, title, gs) {
    return '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">' + esc(title) + '</div>'
      + '<div style="font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:14px;">' + gs.intro + '</div>'
      + '<label style="display:flex;align-items:center;gap:11px;padding:12px 14px;background:#0D181E;border-radius:8px;cursor:pointer;">'
      +   '<input type="checkbox" class="bc-check" id="' + pfx + '-fa-check" style="width:18px;height:18px;flex-shrink:0;cursor:pointer;">'
      +   '<span style="font-size:13px;font-weight:600;color:var(--t1);">' + esc(gs.checkLabel) + '</span>'
      + '</label>'
      + (gs.hint ? '<div style="font-size:11px;color:var(--t3);margin-top:10px;line-height:1.55;">' + gs.hint + '</div>' : '')
      + '<div style="display:flex;justify-content:flex-end;margin-top:16px;">'
      +   '<button class="btn btn-primary" id="' + pfx + '-new-btn" disabled style="opacity:0.5;cursor:default;">Generate First Audit</button>'
      + '</div></div>';
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
    const secRows = names.map((name, i) => {
      const bb = i === names.length - 1 ? '' : 'border-bottom:1px solid var(--row-div);';
      const score = sections[name];
      if (score == null) {
        return '<div style="display:flex;align-items:center;gap:14px;padding:11px 20px;background:#0D181E;' + bb + '">'
          + '<div class="val" style="flex:1;min-width:0;">' + esc(name) + '</div>'
          + '<div style="width:80px;flex-shrink:0;"></div>'
          + '<div style="width:42px;text-align:right;flex-shrink:0;color:var(--t3);font-weight:700;">N/A</div>'
          + '<div style="width:48px;flex-shrink:0;"></div>'
          + '</div>';
      }
      const ps   = prev && prev.sections ? prev.sections[name] : null;
      const diff = ps != null ? score - ps : null;
      const bar  = Math.min(100, Math.max(0, score));
      const col  = App.scoreColor(score);
      return '<div style="display:flex;align-items:center;gap:14px;padding:11px 20px;background:#0D181E;' + bb + '">'
        + '<div class="val" style="flex:1;min-width:0;">' + esc(name) + '</div>'
        + '<div style="width:80px;flex-shrink:0;background:var(--b2);height:6px;border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + bar + '%;background:' + col + ';border-radius:3px;"></div></div>'
        + '<div style="width:42px;text-align:right;flex-shrink:0;font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:' + col + ';">' + score + '</div>'
        + '<div style="width:48px;text-align:right;flex-shrink:0;color:' + (diff==null?'var(--t3)':diff>=0?'var(--green)':'var(--red)') + ';font-size:12px;">' + (diff!=null?(diff>=0?'+':'')+diff:'') + '</div>'
        + '</div>';
    }).join('');
    return '<div style="margin-bottom:12px;"><button class="btn btn-ghost btn-sm ' + pfx + '-view-btn" data-idx="0">View Full Audit</button></div>'
      + '<div class="card" style="margin-bottom:16px;overflow:hidden;">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;">'
      + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Latest Audit</div>'
      + '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + esc(latest.bar_name||App.data.settings.bar_name||'Your Bar') + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:2px;">' + (latest.date||'').slice(0,10) + (latest.audit_period ? '  ' + esc(latest.audit_period) : '') + '</div>'
      + vsLine + '</div>'
      + '<div style="text-align:right;">'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:52px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + (naO ? 'N/A' : latest.overall_score) + '</div>'
      + '<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + scoreColor + ';margin:2px 0 8px;">' + scoreLabel + '</div>'
      + '</div></div>'
      + '<div style="margin:16px -20px -20px;">' + secRows + '</div>'
      + '</div>';
  },

  // ── Landing: Audit History data-card ───────────────────────────────────────
  // opts.hideGrade drops the Data Quality column for audits with no grade tier
  // (the Bar Cop Audit, which reads from logged data and has no upload tier).
  historyCard(audits, listKey, pfx, opts) {
    opts = opts || {};
    const rows = audits.slice(0, App.listLimit('core', listKey)).map((a,i) => {
      const p    = audits[i+1];
      const naA  = a.overall_score == null;
      const diff = (p && !naA && p.overall_score != null) ? a.overall_score - p.overall_score : null;
      return '<tr><td><div class="val">' + (a.date||'').slice(0,10) + '</div></td>'
        + (naA
            ? '<td style="font-size:11px;font-weight:800;letter-spacing:0.5px;color:var(--t3);">N/A</td>'
            : '<td style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:' + App.scoreColor(a.overall_score) + ';">' + a.overall_score + '</td>')
        + '<td style="color:' + (diff==null?'var(--t3)':diff>=0?'var(--green)':'var(--red)') + ';">' + (diff!=null?(diff>=0?'+':'')+diff+' pts':'') + '</td>'
        + (opts.hideGrade ? '' : '<td>' + AuditUI.tierChip(a.grade) + '</td>')
        + '<td style="text-align:right;"><button class="btn btn-ghost btn-sm ' + pfx + '-view-btn" data-idx="' + i + '">View</button></td></tr>';
    }).join('');
    return '<div class="sh" style="margin:24px 0 10px;">Audit History</div>'
      + '<div class="card card-bleed data-card"><div class="card-bleed-tbl"><table class="tbl"><thead><tr>'
      + '<th>Date</th><th>Score</th><th>Change</th>' + (opts.hideGrade ? '' : '<th>Data Quality</th>') + '<th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>'
      + App.showOlderBar('core', listKey, audits, false);
  },

  emptyState() {
    return '<div class="card form-card"><div style="text-align:center;padding:22px;"><div style="font-size:15px;font-weight:700;color:var(--t1);">No audits yet</div></div></div>';
  },

  // ── Full view: findings text under a section ───────────────────────────────
  findings(d, num) {
    if (!d) return '';
    const fields = ['S'+num+'_EVIDENCE', 'S'+num+'_GAP', 'S'+num+'_TOOL', 'S'+num+'_NARRATIVE', 'S'+num+'_FINDING'];
    const texts = fields.map(f => d[f]).filter(v => v && String(v).trim());
    if (!texts.length) return '';
    return '<div style="margin-top:14px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Findings</div>'
      + texts.map(t => '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:8px;">' + esc(t) + '</div>').join('')
      + '</div>';
  },

  // ── Full view: one scored section (metric readout + signals + findings) ────
  // items = [[label, value, highlight?]]; highlight 'warn'(red)/'good'(gold).
  // signals = risk-signal objects for the Risk Signals section (score null).
  // d = the audit raw, for the inline Findings.
  sectionBlock(num, name, score, items, signals, d) {
    const bar   = Math.min(100, Math.max(0, score||0));
    const color = App.scoreColor(score);
    const rows  = (items||[]).filter(([,v]) => v !== undefined && v !== null && v !== '' && v !== 0 && v !== '0').map(([label, val, highlight]) =>
      '<tr><td>' + label + '</td>'
      + '<td style="color:' + (highlight==='warn'?'var(--red)':highlight==='good'?'var(--gold)':'var(--t1)') + ';">' + val + '</td></tr>'
    ).join('');
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
    const scoreBlock = score != null
      ? '<div style="text-align:right;">'
        + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:42px;font-weight:700;color:' + color + ';line-height:1;">' + score + '</div>'
        + '<div style="background:var(--b2);height:5px;border-radius:3px;width:80px;margin-top:4px;overflow:hidden;"><div style="height:100%;width:' + bar + '%;background:' + color + ';border-radius:3px;"></div></div>'
        + '</div>'
      : isSignals ? ''
        : '<div style="text-align:right;"><div style="font-size:14px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);line-height:1;">N/A</div><div style="font-size:10px;color:var(--t4);margin-top:3px;">Not enough data</div></div>';
    return '<div class="card" style="margin-bottom:14px;">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;">'
      + '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:3px;">Section ' + num + '</div>'
      + '<div style="font-size:15px;font-weight:700;color:var(--t1);">' + name + '</div></div>'
      + scoreBlock + '</div>'
      + (rows ? '<div class="at-metrics"><table class="at-mtbl">' + rows + '</table></div>' : '')
      + sigRows
      + AuditUI.findings(d, num)
      + '</div>';
  },

  // ── Full view: score hero (name/grade left, big score + scale bar right) ───
  viewHero(audit, heroLabel, pfx) {
    const naO = audit.overall_score == null;
    const scoreColor = naO ? 'var(--t3)' : App.scoreColor(audit.overall_score||0);
    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">'
      +   '<span>' + esc(heroLabel) + '</span>'
      +   '<div id="' + (pfx || 'audit') + '-outlook-mount" style="flex-shrink:0;"></div>'
      + '</div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div>'
      + '<div style="font-size:22px;font-weight:800;color:var(--t1);">' + esc(audit.bar_name||App.data.settings.bar_name||'Your Bar') + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:4px;">' + (audit.date||'').slice(0,10) + (audit.audit_period ? '  |  ' + esc(audit.audit_period) : '') + (audit.audit_id ? '  |  ' + esc(audit.audit_id) : '') + '</div>'
      + (audit.grade ? '<div style="margin-top:8px;">' + AuditUI.tierChip(audit.grade) + '</div>' : '')
      + '</div>'
      + (naO
          ? '<div style="text-align:right;"><div style="font-size:18px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);line-height:1;">N/A</div><div style="font-size:10px;color:var(--t4);margin-top:4px;">Not enough data yet</div></div>'
          : '<div style="text-align:right;">'
            + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:52px;font-weight:700;color:' + scoreColor + ';line-height:1;">' + audit.overall_score + '</div>'
            + '<div style="width:200px;max-width:100%;margin-left:auto;text-align:left;">' + App.scoreBar(audit.overall_score) + '</div>'
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

  // "What Bar Cop already has" pills — ALWAYS shown; gold-tint + green check when
  // the data exists, greyed otherwise. checks = [{label, ok}].
  intakePills(checks) {
    return checks.map(c => '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:4px 11px;border-radius:20px;margin:0 6px 7px 0;'
      + (c.ok ? 'background:var(--sel-active-bg);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
              : 'background:transparent;border:1px solid var(--b1);color:var(--t3);') + '">'
      + (c.ok ? '<span style="color:var(--green);font-weight:800;">&#10003;</span>' : '')
      + esc(c.label) + '</span>').join('');
  },

  // Sub-heading + note + pills block (the "what Bar Cop already has" section).
  intakeHasBlock(heading, note, checks) {
    return '<div class="sh" style="margin:18px 0 8px;">' + esc(heading) + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:10px;">' + note + '</div>'
      + '<div>' + AuditUI.intakePills(checks) + '</div>';
  },

  // One intake question row (label left, grey-chevron select right).
  // options = [[value,label],...]; current = the saved value (or '').
  intakeQRow(pfx, label, id, options, current) {
    const all = [['', 'Select Answer']].concat(options);
    const opts = all.map(o => '<option value="' + esc(o[0]) + '"' + (String(current == null ? '' : current) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('');
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 2px;border-bottom:1px solid var(--row-div);">'
      + '<span style="font-size:13px;color:var(--t1);">' + esc(label) + '</span>'
      + '<select class="at-qsel" id="' + pfx + '-q-' + id + '" style="min-width:175px;flex-shrink:0;">' + opts + '</select>'
      + '</div>';
  },

  // Generate row below the intake cards. The intake is reachable only when the
  // audit can run (the landing button gates access), so this is always active.
  intakeSubmit(pfx) {
    return '<div style="margin:18px 0 24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-primary" id="' + pfx + '-iz-submit">Generate Audit</button>'
      + '<span id="' + pfx + '-iz-status" style="font-size:12px;color:var(--red);display:none;margin-left:8px;"></span></div>';
  }
};
