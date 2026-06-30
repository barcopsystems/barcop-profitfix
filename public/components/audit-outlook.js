'use strict';

/* ── Bar Cop Briefing — shared audit narrative helper ─────────────────────────
   One home for the operator-voice paragraph that goes on every audit detail
   page. The button mounts inside the audit detail header card next to the
   score. On click the API call fires, the button shows "Analyzing...", and
   the paragraphs render in a popup modal layered over the audit (mirroring
   the Trend Insights pattern on the Recovery dashboards so the audit detail
   page itself does not overflow with text).

   Caches the rendered HTML per audit id for the session. Re-clicks open the
   cached modal instantly without re-spending API tokens.

   Replaces the equivalent Outlook plumbing that used to live inside the
   killed audit-diff.js Compare Other Audits modal. All four audits (Profit,
   Revenue, Cash, Bar Cop Audit) call AuditOutlook.attach() from inside
   their audit detail header card. */

window.AuditOutlook = {

  // Persisted per-audit cache: the rendered HTML is stored on
  // App.data.audit_outlooks keyed by auditType:auditId. Generated once per
  // audit; re-opening reuses it (no API spend) and a newly-run audit (new id)
  // generates fresh. Survives reloads via App.save.
  _stored(key) { const s = App.data && App.data.audit_outlooks; return (s && s[key]) ? s[key] : null; },

  _cacheKey(auditType, audit) {
    const id = audit?.audit_id || audit?.date || (audit?.id || '');
    return auditType + ':' + id;
  },

  // Strip emdashes and double-dash sequences from model output. The prompt
  // forbids them, but defense in depth keeps any slip from reaching screen.
  _sanitize(text) {
    if (!text) return '';
    return text
      .replace(/—/g, ', ')   // emdash to comma-space
      .replace(/–/g, '-')    // en-dash to hyphen
      .replace(/ -- /g, ', ')     // " -- " to comma-space
      .replace(/--/g, '-');       // remaining "--" to single hyphen
  },

  /* Mount the Outlook button into the given container element. Wires the
     click handler. Button-only, no inline text body — the paragraph renders
     in a popup modal on click so the audit header card never overflows.

     containerEl  — DOM node where the button should render
     audit        — the audit record (uses audit_id, date, overall_score,
                    sections, action_items)
     auditType    — one of 'profit', 'revenue', 'cash', 'bar-cop'
     opts         — { compact: true } shrinks button padding for headers
                    where space is tight                                        */
  attach(containerEl, audit, auditType, opts) {
    if (!containerEl || !audit) return;
    opts = opts || {};
    const btnId = 'ao-btn-' + auditType;
    const btnStyle = opts.compact
      ? 'font-size:10px;padding:5px 12px;letter-spacing:1px;'
      : 'font-size:11px;padding:6px 14px;letter-spacing:1px;';
    containerEl.insertAdjacentHTML('beforeend',
      '<button class="btn btn-ghost btn-sm" id="' + btnId + '" style="' + btnStyle + '">Bar Cop Briefing</button>'
    );
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => this._handleClick(auditType, audit, btn));
  },

  _handleClick(auditType, audit, btn) {
    const cached = this._stored(this._cacheKey(auditType, audit));
    if (cached) {
      this._showModal(auditType, audit, cached);
      return;
    }
    this._generate(auditType, audit, btn);
  },

  async _generate(auditType, audit, btn) {
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.style.opacity = '0.65';
    btn.style.cursor = 'not-allowed';
    btn.textContent = 'Analyzing...';

    const prompt = this._buildPrompt(auditType, audit);
    try {
      const r = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (data.error) {
        this._showError('API error: ' + esc(data.error.message || 'unknown'));
        btn.textContent = 'Try Again';
        btn.disabled = false;
        btn.style.opacity = '';
        btn.style.cursor = '';
        return;
      }
      const raw = data.content?.[0]?.text || '';
      const sanitized = this._sanitize(raw);
      if (!sanitized.trim()) {
        this._showError('Empty response. Try again.');
        btn.textContent = 'Try Again';
        btn.disabled = false;
        btn.style.opacity = '';
        btn.style.cursor = '';
        return;
      }
      const paragraphs = sanitized.split(/\n\n+/).map(p =>
        '<div style="margin-bottom:14px;">' + esc(p).replace(/\n/g, '<br>') + '</div>'
      ).join('');
      App.data.audit_outlooks = App.data.audit_outlooks || {};
      App.data.audit_outlooks[this._cacheKey(auditType, audit)] = paragraphs;
      App.save();
      this._showModal(auditType, audit, paragraphs);
      btn.textContent = originalLabel;
      btn.disabled = false;
      btn.style.opacity = '';
      btn.style.cursor = '';
    } catch (e) {
      this._showError('Could not generate outlook: ' + esc(e.message || 'unknown error'));
      btn.textContent = 'Try Again';
      btn.disabled = false;
      btn.style.opacity = '';
      btn.style.cursor = '';
    }
  },

  _showModal(auditType, audit, bodyHtml) {
    const typeLabel = this._typeLabel(auditType);
    const period = (audit.date || '').slice(0, 10);
    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">Bar Cop Briefing: ' + esc(typeLabel) + (period ? ' &middot; ' + esc(period) : '') + '</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.9;">' + bodyHtml + '</div>'
      + '</div>';
    App.openModal(html, { id: 'ao-modal', maxWidth: 620 });
  },

  _showError(message) {
    App.openModal('<div class="card form-card" style="margin:0;"><div style="font-size:13px;color:var(--red);line-height:1.6;">' + message + '</div></div>', { id: 'ao-error', maxWidth: 420 });
  },

  _typeLabel(auditType) {
    if (auditType === 'profit')   return 'Profit Recovery';
    if (auditType === 'revenue')  return 'Revenue Recovery';
    if (auditType === 'cash')     return 'Cash Recovery';
    if (auditType === 'bar-cop')  return 'Bar Cop';
    return 'Operational';
  },

  _buildPrompt(auditType, audit) {
    if (auditType === 'cash') return this._buildCashPrompt(audit);
    return this._buildScorePrompt(auditType, audit);
  },

  // Cash audits do not have a per-action monthly dollar (the opportunity is a
  // one-time amount and the rest is timing), so the generic score prompt would
  // miss the point. This one leads with the survival story off the 13-week
  // forecast and names the single move that fixes the tight week.
  _buildCashPrompt(audit) {
    const d = audit.raw || {};
    const date  = (audit.date || '').slice(0, 10) || 'unknown';
    const score = audit.overall_score != null ? audit.overall_score : 'n/a';
    const sections = audit.sections || {};
    const sectionLines = Object.keys(sections).map(n => '- ' + n + ': ' + (sections[n] != null ? sections[n] : 'n/a')).join('\n') || '- none';
    const m = (v) => v == null ? 'n/a' : '$' + Math.round(v).toLocaleString();
    const dys = (v) => v == null ? 'n/a' : Math.round(v) + ' days';
    const runway = d.HAS_OPENING ? (d.RUNWAY == null ? 'holds all 13 weeks' : (d.RUNWAY === 0 ? 'runs out this week' : d.RUNWAY + ' weeks')) : 'not set (no opening balance)';
    const low = d.HAS_OPENING && d.LOW_POINT_WEEK ? (d.LOW_POINT_WEEK + ' at ' + m(d.LOW_POINT_BAL)) : 'n/a';

    return 'You are a 30-year bar and restaurant operator writing a brief cash analysis for a fellow owner. '
      + 'This is the survival read: can they make it through the next quarter, and where is their money really going. '
      + 'Write 2 to 3 short paragraphs. '
      + 'Talk straight across the bar. Give the numbers as they are, the good, the bad, and the ugly, in depth and specific. Do not teach, explain the basics, lecture, or hand out pep talks. No motivational lines, nothing like "you already know what to do," nothing that talks down to the reader. You can be dry and a little funny, and you can weave in a quick bit of bar-floor storytelling so a rough number reads easy instead of stinging, but never at the operator\'s expense and never invented. Every point lands on a real number from the data. No emdashes, no double dashes, no bullet points, no headers, no AI words (cadence, leverage, robust, going forward, ecosystem, synthesize, comprehensive, seamless). '
      + 'First paragraph: the survival story. Lead with the runway and the tightest week, what the cash picture says about the next 13 weeks right now. '
      + 'Second paragraph: where the cash is stuck, the trapped shelf cash and how many days the cash stays locked in the cycle, with the numbers. '
      + 'Third paragraph: the single most important move to make this week to cover the tight week or free the cash. One clear action. '
      + 'Total length: 150 to 200 words.\n\n'
      + 'AUDIT DATE: ' + date + '\n'
      + 'OVERALL CASH SCORE: ' + score + '\n\n'
      + 'SECTION SCORES:\n' + sectionLines + '\n\n'
      + 'THE 13-WEEK SURVIVAL PICTURE:\n'
      + '- Runway: ' + runway + '\n'
      + '- Tightest week: ' + low + '\n'
      + '- Tight weeks (more cash out than in): ' + (d.TIGHT_WEEKS != null ? d.TIGHT_WEEKS : 'n/a') + ' of 13\n'
      + '- Safe to spend right now: ' + (d.SAFE_TO_SPEND != null ? m(d.SAFE_TO_SPEND) : 'n/a (opening balance not set)') + '\n\n'
      + 'WHERE THE CASH IS STUCK:\n'
      + '- Cash to free (one-time, dead stock + above par): ' + m(d.TRAPPED_CASH) + '\n'
      + '- Of that, dead stock: ' + m(d.DEAD_STOCK) + '; above par: ' + m(d.OVERSTOCK) + '\n'
      + '- Cash locked in the cycle: ' + dys(d.CYCLE_DAYS) + ' (product sits ' + dys(d.DIO) + ', you take ' + dys(d.DPO) + ' to pay)\n'
      + '- Vendors on terms: ' + (d.VENDORS_ON_TERMS != null ? d.VENDORS_ON_TERMS + ' of ' + d.TOTAL_VENDORS : 'n/a') + '\n';
  },

  _buildScorePrompt(auditType, audit) {
    const typeLabel  = this._typeLabel(auditType);
    const weekly = auditType === 'bar-cop';
    const date       = (audit.date || '').slice(0, 10) || 'unknown';
    const score      = audit.overall_score != null ? audit.overall_score : 'n/a';
    const sections   = audit.sections || {};
    const sectionLines = Object.keys(sections).map(name => {
      const v = sections[name];
      return '- ' + name + ': ' + (v != null ? v : 'n/a');
    }).join('\n') || '- none';

    const items = (audit.action_items || []).slice()
      .sort((a, b) => (b.monthly_impact || 0) - (a.monthly_impact || 0))
      .slice(0, 5);
    const itemLines = items.length
      ? items.map(i => '- ' + (i.action || i.gap_id || 'Action')
          + (i.monthly_impact ? ' (~$' + Math.round(i.monthly_impact) + '/mo)' : '')).join('\n')
      : '- none';
    const monthlyTotal = (audit.action_items || []).reduce((s, i) => s + (i.monthly_impact || 0), 0);

    return 'You are a 30-year bar and restaurant operator writing a brief analysis for a fellow owner about their ' + typeLabel + ' audit. '
      + 'Write 2 to 3 short paragraphs. '
      + 'Talk straight across the bar. Give the numbers as they are, the good, the bad, and the ugly, in depth and specific. Do not teach, explain the basics, lecture, or hand out pep talks. No motivational lines, nothing like "you already know what to do," nothing that talks down to the reader. You can be dry and a little funny, and you can weave in a quick bit of bar-floor storytelling so a rough number reads easy instead of stinging, but never at the operator\'s expense and never invented. Every point lands on a real number from the data. No emdashes, no double dashes, no bullet points, no headers, no AI words (cadence, leverage, robust, going forward, ecosystem, synthesize, comprehensive, seamless). '
      + 'Lead with the overall story (what the score says about the operation right now). '
      + 'Second paragraph: the biggest concern or biggest win with specific numbers. '
      + 'Third paragraph (optional): the single most important action to take ' + (weekly ? 'this week' : 'this month') + '. '
      + 'Total length: 150 to 200 words.\n\n'
      + 'AUDIT DATE: ' + date + '\n'
      + 'OVERALL SCORE: ' + score + '\n\n'
      + 'SECTION SCORES:\n' + sectionLines + '\n\n'
      + (weekly
          ? 'TOP FINDINGS:\n' + itemLines + '\n'
          : 'TOP ACTION ITEMS (ranked by monthly impact):\n' + itemLines + '\n\n'
            + 'MONTHLY OPPORTUNITY (sum of all action items): $' + Math.round(monthlyTotal) + '\n');
  }
};
