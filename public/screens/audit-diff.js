'use strict';

/* ── Audit Diff Visual ──────────────────────────────────────────────────────
   Compare any two audits within the same module. Shows section-by-section
   score deltas, action items resolved vs surfaced, and dollar-impact change.
   Pure visual — no Claude call, runs on existing audit data. Phase 3 Item 28.
   Launched by a "Compare Audits" button on each module's audit screen. */

S.AuditDiff = {

  // Public entry: open the diff modal for a specific module.
  open(moduleKey) {
    const audits = this._auditsFor(moduleKey);
    if (!audits || audits.length < 2) {
      this._alertModal('You need at least 2 ' + this._moduleName(moduleKey) + ' audits to compare. Run another audit and try again.');
      return;
    }
    const sorted = audits.slice().sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
    const after  = sorted[0];
    const before = sorted[1];
    this._showModal(moduleKey, sorted, before.audit_id || before.date, after.audit_id || after.date);
  },

  _auditsFor(moduleKey) {
    if (moduleKey === 'profit')  return App.data?.audits || [];
    if (moduleKey === 'revenue') return App.data?.revenue_audits || [];
    if (moduleKey === 'traffic') return App.data?.traffic_audits || [];
    return [];
  },

  _moduleName(moduleKey) {
    return moduleKey === 'profit' ? 'Profit' : moduleKey === 'revenue' ? 'Revenue' : 'Traffic';
  },

  _auditLabel(a) {
    const dateStr = (a.date || '').slice(0, 10) || 'unknown date';
    const period = a.audit_period ? ' · ' + a.audit_period : '';
    const score = a.overall_score != null ? ' (' + a.overall_score + ')' : '';
    return dateStr + period + score;
  },

  _auditKey(a) {
    return a.audit_id || a.date || JSON.stringify(a).slice(0, 16);
  },

  _close() {
    const m = document.getElementById('audit-diff-modal');
    if (m) m.remove();
  },

  _alertModal(message) {
    const m = document.createElement('div');
    m.id = 'audit-diff-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;padding:40px 20px;background:rgba(0,0,0,0.65);';
    m.innerHTML = '<div style="background:var(--surface);border:1px solid var(--b1);border-radius:6px;padding:28px;max-width:440px;width:100%;">'
      + '<div style="font-size:13px;color:var(--t1);line-height:1.6;margin-bottom:20px;">' + esc(message) + '</div>'
      + '<div style="display:flex;justify-content:flex-end;"><button id="ad-alert-ok" class="btn btn-ghost">OK</button></div>'
      + '</div>';
    document.body.appendChild(m);
    document.getElementById('ad-alert-ok').addEventListener('click', () => this._close());
    m.addEventListener('click', ev => { if (ev.target === m) this._close(); });
  },

  _showModal(moduleKey, sorted, beforeKey, afterKey) {
    const m = document.createElement('div');
    m.id = 'audit-diff-modal';
    m.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto;background:rgba(0,0,0,0.65);';
    m.innerHTML = '<div class="ad-panel" style="background:var(--bg);border:1px solid var(--b1);border-radius:8px;max-width:960px;width:100%;max-height:calc(100vh - 80px);overflow-y:auto;position:relative;box-shadow:0 8px 40px rgba(0,0,0,0.55);"></div>';
    document.body.appendChild(m);
    m.addEventListener('click', ev => { if (ev.target === m) this._close(); });
    const panel = m.querySelector('.ad-panel');
    this._render(panel, moduleKey, sorted, beforeKey, afterKey);
  },

  _fixScreenFor(moduleKey) {
    if (moduleKey === 'profit')  return 'profit-fix';
    if (moduleKey === 'revenue') return 'r-fix';
    if (moduleKey === 'traffic') return 't-fix';
    return 'profit-fix';
  },

  _render(panel, moduleKey, sorted, beforeKey, afterKey) {
    const before = sorted.find(a => this._auditKey(a) === beforeKey) || sorted[1];
    const after  = sorted.find(a => this._auditKey(a) === afterKey)  || sorted[0];
    this._currentModule = moduleKey;

    const opts = (selectedKey) => sorted.map(a => {
      const k = this._auditKey(a);
      const sel = k === selectedKey ? ' selected' : '';
      return '<option value="' + esc(k) + '"' + sel + '>' + esc(this._auditLabel(a)) + '</option>';
    }).join('');

    const header = '<div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px 16px;position:sticky;top:0;background:var(--bg);z-index:5;border-bottom:1px solid var(--b2);">'
      +   '<div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--w);">Compare ' + this._moduleName(moduleKey) + ' Audits</div>'
      +   '<button id="ad-close" type="button" aria-label="Close" style="background:none;border:none;color:var(--t2);font-size:26px;line-height:1;cursor:pointer;padding:0 4px;font-weight:300;">&times;</button>'
      + '</div>';

    const pickers = '<div style="padding:18px 24px;display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end;border-bottom:1px solid var(--b2);">'
      +   '<div class="f" style="flex:1;min-width:260px;"><label style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:6px;">Compare</label>'
      +     '<select id="ad-before-sel" style="width:100%;background:var(--input);border:1px solid var(--b1);border-radius:4px;color:var(--w);font-size:13px;padding:8px 10px;">' + opts(this._auditKey(before)) + '</select>'
      +   '</div>'
      +   '<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);padding-bottom:9px;">vs</div>'
      +   '<div class="f" style="flex:1;min-width:260px;"><label style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:6px;">Against</label>'
      +     '<select id="ad-after-sel" style="width:100%;background:var(--input);border:1px solid var(--b1);border-radius:4px;color:var(--w);font-size:13px;padding:8px 10px;">' + opts(this._auditKey(after)) + '</select>'
      +   '</div>'
      + '</div>';

    const narrativeSection = (before === after) ? '' : this._renderNarrativeShell();

    const body = (before === after)
      ? '<div style="padding:32px 24px;font-size:13px;color:var(--t3);text-align:center;">Pick two different audits to see the comparison.</div>'
      : this._renderDiff(before, after);

    panel.innerHTML = header + pickers + narrativeSection + body;

    document.getElementById('ad-close').addEventListener('click', () => this._close());
    document.getElementById('ad-before-sel').addEventListener('change', (e) => {
      this._render(panel, moduleKey, sorted, e.target.value, this._auditKey(after));
    });
    document.getElementById('ad-after-sel').addEventListener('change', (e) => {
      this._render(panel, moduleKey, sorted, this._auditKey(before), e.target.value);
    });
    // Fix This deep-links — close modal, focus the gap, navigate to the right fix screen
    panel.querySelectorAll('.ad-fix-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const gapId = btn.dataset.gap;
        const fixScreen = this._fixScreenFor(moduleKey);
        this._close();
        App._fixFocus = gapId;
        App.openScreen(fixScreen);
      });
    });
    // Generate AI Narrative (click-to-generate, fresh each click)
    document.getElementById('ad-narr-btn')?.addEventListener('click', () => {
      this._generateNarrative(moduleKey, before, after);
    });
  },

  _renderNarrativeShell() {
    return '<div id="ad-narrative-wrap" style="padding:18px 24px;border-bottom:1px solid var(--b2);background:rgba(219,171,70,0.04);">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
      +   '<div><div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);">AI Narrative</div>'
      +     '<div style="font-size:11px;color:var(--t3);margin-top:4px;">Operator-voice summary of what changed between these two audits.</div>'
      +   '</div>'
      +   '<button class="btn btn-ghost btn-sm" id="ad-narr-btn" style="font-size:10px;padding:4px 12px;">Get AI Narrative</button>'
      + '</div>'
      + '<div id="ad-narr-body" style="display:none;font-size:13px;color:var(--t2);line-height:1.7;margin-top:14px;"></div>'
      + '</div>';
  },

  async _generateNarrative(moduleKey, before, after) {
    const btn = document.getElementById('ad-narr-btn');
    const body = document.getElementById('ad-narr-body');
    if (!btn || !body) return;
    btn.disabled = true;
    btn.textContent = 'Generating...';
    body.style.display = 'block';
    body.innerHTML = '<div style="color:var(--t3);">Reading both audits and writing the analysis...</div>';

    const prompt = this._buildNarrativePrompt(moduleKey, before, after);
    try {
      const r = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (data.error) {
        body.innerHTML = '<div style="color:var(--red);">API error: ' + esc(data.error.message || 'unknown') + '</div>';
      } else {
        const text = data.content?.[0]?.text || '';
        if (!text) {
          body.innerHTML = '<div style="color:var(--red);">Empty response. Try again.</div>';
        } else {
          // Render paragraphs separated by blank lines
          const paragraphs = text.split(/\n\n+/).map(p =>
            '<div style="margin-bottom:12px;">' + esc(p).replace(/\n/g, '<br>') + '</div>'
          ).join('');
          body.innerHTML = paragraphs;
        }
      }
    } catch (e) {
      body.innerHTML = '<div style="color:var(--red);">Could not generate narrative: ' + esc(e.message || 'unknown error') + '</div>';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Regenerate';
    }
  },

  _buildNarrativePrompt(moduleKey, before, after) {
    const moduleName = this._moduleName(moduleKey);
    const beforeDate = (before.date || '').slice(0, 10) || 'unknown';
    const afterDate  = (after.date  || '').slice(0, 10) || 'unknown';
    const beforeScore = before.overall_score || 0;
    const afterScore  = after.overall_score || 0;
    const scoreDelta  = afterScore - beforeScore;

    const beforeS = before.sections || {};
    const afterS  = after.sections || {};
    const allSections = Array.from(new Set([...Object.keys(beforeS), ...Object.keys(afterS)]));
    const sectionLines = allSections.map(name => {
      const b = beforeS[name];
      const a = afterS[name];
      const delta = (b != null && a != null) ? (a - b) : null;
      const deltaStr = delta == null ? 'n/a' : (delta > 0 ? '+' : '') + delta;
      return '- ' + name + ': ' + (b ?? 'n/a') + ' -> ' + (a ?? 'n/a') + ' (' + deltaStr + ')';
    }).join('\n');

    const beforeItems = before.action_items || [];
    const afterItems  = after.action_items || [];
    const beforeIds = new Set(beforeItems.map(i => i.gap_id).filter(Boolean));
    const afterIds  = new Set(afterItems.map(i => i.gap_id).filter(Boolean));
    const resolved = beforeItems.filter(i => i.gap_id && !afterIds.has(i.gap_id));
    const surfaced = afterItems.filter(i => i.gap_id && !beforeIds.has(i.gap_id));
    const ongoing  = afterItems.filter(i => i.gap_id && beforeIds.has(i.gap_id));

    const fmtItems = items => items.length === 0 ? 'none'
      : items.map(i => '- ' + (i.action || i.gap_id) + (i.monthly_impact ? ' ($' + Math.round(i.monthly_impact) + '/mo)' : '')).join('\n');

    const beforeMonthly = beforeItems.reduce((s,i) => s + (i.monthly_impact || 0), 0);
    const afterMonthly  = afterItems.reduce((s,i) => s + (i.monthly_impact || 0), 0);
    const monthlyDelta  = afterMonthly - beforeMonthly;

    return 'You are a 30-year bar and restaurant operator writing a brief analysis for a fellow owner. '
      + 'Compare two ' + moduleName + ' audits and write 2 to 3 short paragraphs about what changed. '
      + 'Rules: direct operator-to-operator voice, plain sentences, specific numbers from the data below. '
      + 'No emdashes, no "--" dashes, no bullet points in your output, no headers, no AI language like "cadence" or "leverage" or "going forward". '
      + 'Lead with the overall story (what happened to the score and why). '
      + 'Second paragraph: the biggest win or biggest concern with specific numbers. '
      + 'Third paragraph (optional): the single most important action to take this month. '
      + 'Total length: 150 to 200 words.\n\n'
      + 'AUDIT BEFORE: ' + beforeDate + ', overall score ' + beforeScore + '\n'
      + 'AUDIT AFTER: ' + afterDate + ', overall score ' + afterScore + ' (delta ' + (scoreDelta > 0 ? '+' : '') + scoreDelta + ' pts)\n\n'
      + 'SECTION SCORE CHANGES:\n' + sectionLines + '\n\n'
      + 'GAPS RESOLVED (closed since the before audit):\n' + fmtItems(resolved) + '\n\n'
      + 'NEW GAPS SURFACED (new in the after audit):\n' + fmtItems(surfaced) + '\n\n'
      + 'STILL OPEN (in both audits):\n' + fmtItems(ongoing) + '\n\n'
      + 'MONTHLY OPPORTUNITY: $' + Math.round(beforeMonthly) + ' -> $' + Math.round(afterMonthly) + ' (delta $' + Math.round(monthlyDelta) + '/mo)\n';
  },

  _renderDiff(before, after) {
    const beforeScore = before.overall_score || 0;
    const afterScore  = after.overall_score || 0;
    const scoreDelta  = afterScore - beforeScore;
    const scoreColor  = scoreDelta > 0 ? 'var(--green)' : scoreDelta < 0 ? 'var(--red)' : 'var(--t2)';
    const scoreSign   = scoreDelta > 0 ? '+' : '';

    // Section deltas — show every section in either audit
    const beforeS = before.sections || {};
    const afterS  = after.sections || {};
    const allSections = Array.from(new Set([...Object.keys(beforeS), ...Object.keys(afterS)]));
    const sectionRows = allSections.map(name => {
      const b = beforeS[name];
      const a = afterS[name];
      const delta = (b != null && a != null) ? (a - b) : null;
      const deltaCell = delta == null
        ? '<span style="color:var(--t4);">—</span>'
        : '<span style="color:' + (delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--t3)') + ';font-weight:700;">' + (delta > 0 ? '+' : '') + delta + '</span>';
      const beforeCell = b == null ? '—' : b;
      const afterCell  = a == null ? '—' : a;
      return '<tr style="border-bottom:1px solid var(--b2);">'
        + '<td style="padding:10px 14px;font-size:13px;color:var(--t1);">' + esc(name) + '</td>'
        + '<td style="padding:10px 14px;font-size:14px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;color:var(--t2);text-align:right;">' + beforeCell + '</td>'
        + '<td style="padding:10px 14px;font-size:14px;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;color:var(--t1);text-align:right;">' + afterCell + '</td>'
        + '<td style="padding:10px 14px;font-size:14px;font-family:\'Barlow Condensed\',sans-serif;text-align:right;">' + deltaCell + '</td>'
        + '</tr>';
    }).join('');

    // Action item changes (by gap_id)
    const beforeItems = before.action_items || [];
    const afterItems  = after.action_items  || [];
    const beforeIds = new Set(beforeItems.map(i => i.gap_id).filter(Boolean));
    const afterIds  = new Set(afterItems.map(i => i.gap_id).filter(Boolean));
    const resolved = beforeItems.filter(i => i.gap_id && !afterIds.has(i.gap_id));
    const surfaced = afterItems.filter(i => i.gap_id && !beforeIds.has(i.gap_id));
    const ongoing  = afterItems.filter(i => i.gap_id && beforeIds.has(i.gap_id));

    const beforeMonthly = beforeItems.reduce((s,i) => s + (i.monthly_impact || 0), 0);
    const afterMonthly  = afterItems.reduce((s,i) => s + (i.monthly_impact || 0), 0);
    const monthlyDelta  = afterMonthly - beforeMonthly;

    const itemList = (items, kind) => {
      if (!items.length) return '<div style="font-size:12px;color:var(--t4);padding:8px 0;">None.</div>';
      return '<div>' + items.map(i => {
        const dollar = i.monthly_impact ? ' · ' + App.fmtCurrency(i.monthly_impact, 0) + '/mo' : '';
        const fixBtn = (kind === 'ongoing' && i.gap_id)
          ? '<button class="ad-fix-btn" data-gap="' + esc(i.gap_id) + '" style="margin-left:8px;background:transparent;border:1px solid var(--b1);color:var(--t2);font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:3px;cursor:pointer;white-space:nowrap;flex-shrink:0;">Fix This &#9656;</button>'
          : '';
        return '<div style="padding:8px 0;border-bottom:1px solid var(--b2);font-size:12px;color:var(--t2);line-height:1.5;display:flex;align-items:flex-start;gap:6px;">'
          + '<span style="display:inline-block;width:18px;color:' + (kind === 'resolved' ? 'var(--green)' : kind === 'surfaced' ? 'var(--red)' : 'var(--t4)') + ';font-weight:700;flex-shrink:0;">' + (kind === 'resolved' ? '✓' : kind === 'surfaced' ? '+' : '·') + '</span>'
          + '<span style="flex:1;">' + esc(i.action || i.gap_id || 'Action') + dollar + '</span>'
          + fixBtn
          + '</div>';
      }).join('') + '</div>';
    };

    const summary = '<div style="padding:24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:18px;border-bottom:1px solid var(--b2);">'
      +   '<div><div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Overall Score</div>'
      +     '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:28px;font-weight:700;color:var(--w);line-height:1;">' + beforeScore + ' → ' + afterScore + '</div>'
      +     '<div style="font-size:13px;font-weight:700;color:' + scoreColor + ';margin-top:4px;">' + scoreSign + scoreDelta + ' pts</div>'
      +   '</div>'
      +   '<div><div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Gaps Resolved</div>'
      +     '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:28px;font-weight:700;color:var(--green);line-height:1;">' + resolved.length + '</div>'
      +   '</div>'
      +   '<div><div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">New Gaps Surfaced</div>'
      +     '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:28px;font-weight:700;color:var(--red);line-height:1;">' + surfaced.length + '</div>'
      +   '</div>'
      +   '<div><div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);margin-bottom:6px;">Monthly Opportunity</div>'
      +     '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:var(--w);line-height:1.2;">' + App.fmtCurrency(beforeMonthly, 0) + ' → ' + App.fmtCurrency(afterMonthly, 0) + '</div>'
      +     '<div style="font-size:12px;font-weight:700;color:' + (monthlyDelta < 0 ? 'var(--green)' : monthlyDelta > 0 ? 'var(--red)' : 'var(--t3)') + ';margin-top:4px;">' + (monthlyDelta > 0 ? '+' : '') + App.fmtCurrency(monthlyDelta, 0) + '/mo</div>'
      +   '</div>'
      + '</div>';

    const sectionsCard = '<div style="padding:24px;border-bottom:1px solid var(--b2);">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:14px;">Section Scores</div>'
      + '<div style="border:1px solid var(--b2);border-radius:6px;overflow:hidden;background:var(--surface);">'
      +   '<table style="width:100%;border-collapse:collapse;">'
      +     '<thead><tr style="background:var(--input);">'
      +       '<th style="padding:9px 14px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);text-align:left;">Section</th>'
      +       '<th style="padding:9px 14px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);text-align:right;">Before</th>'
      +       '<th style="padding:9px 14px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);text-align:right;">After</th>'
      +       '<th style="padding:9px 14px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--t3);text-align:right;">Change</th>'
      +     '</tr></thead>'
      +     '<tbody>' + sectionRows + '</tbody>'
      +   '</table>'
      + '</div></div>';

    const actionsCard = '<div style="padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:20px;">'
      + '<div>'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--green);margin-bottom:10px;">Resolved (' + resolved.length + ')</div>'
      +   itemList(resolved, 'resolved')
      + '</div>'
      + '<div>'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--red);margin-bottom:10px;">New Gaps Surfaced (' + surfaced.length + ')</div>'
      +   itemList(surfaced, 'surfaced')
      + '</div>'
      + '<div style="grid-column:1 / -1;">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">Still Open (' + ongoing.length + ')</div>'
      +   itemList(ongoing, 'ongoing')
      + '</div>'
      + '</div>';

    return summary + sectionsCard + actionsCard;
  }
};
