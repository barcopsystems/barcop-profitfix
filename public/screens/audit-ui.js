'use strict';
/* ── Shared Audit UI ───────────────────────────────────────────────────────
   THE single source of truth for the Profit / Revenue / Traffic audit layout:
   the landing request card, the merged Latest-Audit card (summary + section
   breakdown rows), the 12-month score-history bars, the Audit History list, and
   the full-view hero + recoverable strip + Action Items + scored-section blocks
   + Fix buttons. Each audit screen supplies only its own section DEFINITIONS and
   data; the LAYOUT lives here so all three stay identical and a future tweak is
   made once. `pfx` = the screen's button-class prefix ('at' profit / 'ra'
   revenue / 'ta' traffic). Built off the Profit audit (audit-tracker.js). */
const AuditUI = {

  // Data-quality tier badge — app colors only (gold-tint full / neutral else).
  tierChip(grade) {
    if (!grade) return '';
    const full = grade.includes('3') || grade.toLowerCase().includes('full');
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
    const countdown = '<div style="font-size:10px;color:var(--t3);font-weight:700;letter-spacing:1px;text-transform:uppercase;">Next audit in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + '</div>';
    let right;
    if (canRun) {
      right = '<button class="btn btn-primary" id="' + pfx + '-new-btn">' + (hasLatest ? 'Generate New Audit' : 'Generate First Audit') + '</button>';
    } else if (opts.notReady) {
      right = '';
    } else if (opts.lockedNoInputs) {
      right = countdown;
    } else {
      right = '<button class="btn btn-primary" id="' + pfx + '-new-btn">Review / Update Inputs</button>' + countdown;
    }
    return '<div class="card form-card" style="margin-bottom:16px;"><div class="card-title">' + esc(title) + '</div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">'
      + '<div style="font-size:12px;color:var(--t3);max-width:520px;line-height:1.6;">' + desc + '</div>'
      + (right ? '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0;">' + right + '</div>' : '')
      + '</div></div></div>';
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
    const secHeader = '<div style="display:flex;align-items:center;gap:14px;padding:11px 20px;border-top:1px solid var(--b2);border-bottom:1px solid var(--row-div);font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);">'
      + '<div style="flex:1;min-width:0;">Section</div>'
      + '<div style="width:80px;flex-shrink:0;"></div>'
      + '<div style="width:42px;text-align:right;flex-shrink:0;">Score</div>'
      + '<div style="width:48px;text-align:right;flex-shrink:0;">Change</div>'
      + '</div>';
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
      + '<div style="margin:16px -20px -20px;">' + secHeader + secRows + '</div>'
      + '</div>';
  },

  // ── Landing: 12-month score-history bars ───────────────────────────────────
  // One column per month (capped at a year). Bars neutral (#1E2B34); only the
  // score number carries the tier color, with a dashed target line. Months
  // without an audit yet show as empty slots with a dimmed label, so the year
  // ahead is visible. Shows from a single audit; scrolls on a narrow card.
  scoreChart(audits, title) {
    const sorted = audits.slice().sort((a,b) => new Date(a.date||0) - new Date(b.date||0)).slice(-12);
    if (!sorted.length) return '';
    const CH = 130, USABLE = CH - 24;
    const last   = sorted[sorted.length-1] || {};
    const target = (last.raw && last.raw.TARGET_SCORE) || last.TARGET_SCORE || 65;
    const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const clamp = s => Math.max(0, Math.min(100, s));
    const ym = d => { const p = (d||'').slice(0,7).split('-'); return { y:+p[0], m:+p[1] }; };
    const start = ym(sorted[0].date);
    const cols = [];
    for (let k = 0; k < 12; k++) {
      let mi = start.m - 1 + k;
      const y = start.y + Math.floor(mi / 12);
      mi = ((mi % 12) + 12) % 12;
      cols.push({ y, m: mi + 1, label: MO[mi], audit: null });
    }
    sorted.forEach(a => {
      const p = ym(a.date);
      const idx = (p.y - start.y) * 12 + (p.m - start.m);
      if (idx >= 0 && idx < 12) cols[idx].audit = a;
    });
    const bars = cols.map(c => {
      if (!c.audit || c.audit.overall_score == null) return '<div style="flex:0 0 40px;height:100%;"></div>';
      const s = c.audit.overall_score || 0;
      const h = Math.round(clamp(s)/100*USABLE);
      return '<div style="flex:0 0 40px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;">'
        + '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;line-height:1;margin-bottom:5px;color:' + App.scoreColor(s) + ';">' + s + '</span>'
        + '<div style="width:100%;height:' + h + 'px;background:#1E2B34;border-radius:3px 3px 0 0;"></div>'
        + '</div>';
    }).join('');
    const dates = cols.map(c => '<div style="flex:0 0 40px;text-align:center;font-size:10px;font-weight:600;color:' + (c.audit ? 'var(--t3)' : 'var(--t4)') + ';">' + c.label + '</div>').join('');
    const tgt = Math.round(clamp(target)/100*USABLE);
    return '<div class="card" style="margin-bottom:16px;padding:20px 24px 16px;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:18px;">' + esc(title) + '</div>'
      + '<div style="overflow-x:auto;">'
      +   '<div style="width:max-content;min-width:100%;">'
      +     '<div style="position:relative;height:' + CH + 'px;border-bottom:1px solid var(--b2);display:flex;align-items:flex-end;gap:12px;">'
      +       '<div style="position:absolute;left:0;right:0;bottom:' + tgt + 'px;border-top:1px dashed rgba(255,255,255,0.25);">'
      +         '<span style="position:absolute;right:0;top:-7px;font-size:9px;color:var(--t3);background:var(--surface);padding:0 5px;letter-spacing:1px;text-transform:uppercase;">Target ' + target + '</span>'
      +       '</div>'
      +       bars
      +     '</div>'
      +     '<div style="display:flex;gap:12px;margin-top:8px;">' + dates + '</div>'
      +   '</div>'
      + '</div></div>';
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
    return '<div class="card form-card"><div style="text-align:center;padding:22px;"><div style="font-size:15px;font-weight:700;color:var(--t1);margin-bottom:6px;">No audits yet</div>'
      + '<div style="font-size:12px;color:var(--t3);">Generate your first audit above. It scores from your Control data plus anything you upload.</div></div></div>';
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
  viewHero(audit, heroLabel) {
    const naO = audit.overall_score == null;
    const scoreColor = naO ? 'var(--t3)' : App.scoreColor(audit.overall_score||0);
    return '<div class="card form-card" style="margin-bottom:16px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">'
      + '<div>'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">' + esc(heroLabel) + '</div>'
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
      +   '<div id="' + pfx + '-outlook-mount"></div>'
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
      + (c.ok ? 'background:var(--gold-tint);border:1px solid var(--gold-tint-bord);color:var(--t1);font-weight:700;'
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

  // Generate + Back row below the cards (standard placement) + status + note.
  intakeSubmit(pfx, canRun, daysLeft, note) {
    return '<div style="margin:18px 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
      + (canRun
          ? '<button class="btn btn-primary" id="' + pfx + '-iz-submit">Generate Audit</button>'
          : '<button class="btn btn-primary" id="' + pfx + '-iz-submit" disabled style="opacity:0.5;cursor:default;">Next audit in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + '</button>')
      + '<button class="btn btn-ghost" id="' + pfx + '-iz-cancel">Back</button>'
      + '<span id="' + pfx + '-iz-status" style="font-size:12px;color:var(--red);display:none;margin-left:8px;"></span></div>'
      + '<div style="font-size:11px;color:var(--t3);margin-bottom:24px;">' + (canRun ? (note || 'Analysis takes 60 to 90 seconds.') : 'Review and update your inputs now. The next audit can run in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ', and your changes save when you generate it.') + '</div>';
  }
};
