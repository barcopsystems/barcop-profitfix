'use strict';

/* ── Bar Cop Outlook — shared audit narrative helper ─────────────────────────
   One home for the operator-voice paragraph that goes on every audit detail
   page. Renders a button in the audit detail header card (next to the score),
   on click fetches /api/claude with a prompt tuned to the audit type, caches
   the result per audit id for the session so re-opening the same audit does
   not re-spend tokens. Sanitizes the model output for emdashes and double-
   dash punctuation before render (the prompt forbids them, but the model
   sometimes ignores).

   Replaces the equivalent Outlook plumbing that used to live inside the
   killed audit-diff.js Compare Other Audits modal. All four audits (Profit,
   Revenue, Traffic, Bar Cop Audit) call AuditOutlook.attach() from inside
   their audit detail header card. */

window.AuditOutlook = {

  // Session cache: keyed by auditType:auditId, value is the rendered HTML.
  // Resets on page reload. Same audit re-opened in the same session restores
  // the previously-generated paragraph without another API call.
  _cache: {},

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

  /* Mount the Outlook button + body wrapper into the given container element.
     Wires the click handler and restores any cached paragraph for this audit.

     containerEl  — DOM node where the button should render
     audit        — the audit record (uses audit_id, date, overall_score,
                    sections, action_items)
     auditType    — one of 'profit', 'revenue', 'traffic', 'bar-cop'
     opts         — { compact: true } shrinks button padding for headers
                    where space is tight                                        */
  attach(containerEl, audit, auditType, opts) {
    if (!containerEl || !audit) return;
    opts = opts || {};
    const btnId  = 'ao-btn-' + auditType;
    const bodyId = 'ao-body-' + auditType;
    const btnStyle = opts.compact
      ? 'font-size:10px;padding:5px 12px;letter-spacing:1px;'
      : 'font-size:11px;padding:6px 14px;letter-spacing:1px;';
    const html = '<div class="ao-wrap">'
      + '<button class="btn btn-ghost btn-sm" id="' + btnId + '" style="' + btnStyle + '">Bar Cop Outlook</button>'
      + '<div id="' + bodyId + '" class="ao-body" style="display:none;font-size:13px;color:var(--t2);line-height:1.7;margin-top:14px;padding:14px;background:rgba(219,171,70,0.04);border:1px solid rgba(219,171,70,0.15);border-radius:6px;"></div>'
      + '</div>';
    containerEl.insertAdjacentHTML('beforeend', html);

    const btn = document.getElementById(btnId);
    const body = document.getElementById(bodyId);
    if (!btn || !body) return;

    btn.addEventListener('click', () => this._generate(auditType, audit, btn, body));

    // Restore cached paragraph if this audit was generated already this session.
    const cached = this._cache[this._cacheKey(auditType, audit)];
    if (cached) {
      body.style.display = 'block';
      body.innerHTML = cached;
      this._lockButton(btn, 'Outlook Generated');
    }
  },

  _lockButton(btn, label) {
    btn.disabled = true;
    btn.style.opacity = '0.65';
    btn.style.cursor = 'not-allowed';
    btn.textContent = label;
  },

  async _generate(auditType, audit, btn, body) {
    btn.disabled = true;
    btn.style.opacity = '0.65';
    btn.style.cursor = 'not-allowed';
    btn.textContent = 'Generating...';
    body.style.display = 'block';
    body.innerHTML = '<div style="color:var(--t3);">Reading the audit and writing the outlook...</div>';

    const prompt = this._buildPrompt(auditType, audit);
    let succeeded = false;
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
        const raw = data.content?.[0]?.text || '';
        const sanitized = this._sanitize(raw);
        if (!sanitized.trim()) {
          body.innerHTML = '<div style="color:var(--red);">Empty response. Try again.</div>';
        } else {
          const paragraphs = sanitized.split(/\n\n+/).map(p =>
            '<div style="margin-bottom:12px;">' + esc(p).replace(/\n/g, '<br>') + '</div>'
          ).join('');
          body.innerHTML = paragraphs;
          succeeded = true;
        }
      }
    } catch (e) {
      body.innerHTML = '<div style="color:var(--red);">Could not generate outlook: ' + esc(e.message || 'unknown error') + '</div>';
    } finally {
      if (succeeded) {
        this._cache[this._cacheKey(auditType, audit)] = body.innerHTML;
        this._lockButton(btn, 'Outlook Generated');
      } else {
        btn.disabled = false;
        btn.style.opacity = '';
        btn.style.cursor = '';
        btn.textContent = 'Try Again';
      }
    }
  },

  _typeLabel(auditType) {
    if (auditType === 'profit')   return 'Profit Recovery';
    if (auditType === 'revenue')  return 'Revenue Recovery';
    if (auditType === 'traffic')  return 'Traffic Recovery';
    if (auditType === 'bar-cop')  return 'Bar Cop';
    return 'Operational';
  },

  _buildPrompt(auditType, audit) {
    const typeLabel  = this._typeLabel(auditType);
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
      + 'Write 2 to 3 short paragraphs. Direct operator-to-operator voice. Plain sentences. Specific numbers from the data below. '
      + 'Strict rules: no emdashes, no "--" double dashes, no bullet points in your output, no headers, no AI words like "cadence" or "leverage" or "robust" or "going forward" or "ecosystem" or "synthesize". '
      + 'Lead with the overall story (what the score says about the operation right now). '
      + 'Second paragraph: the biggest concern or biggest win with specific numbers. '
      + 'Third paragraph (optional): the single most important action to take this month. '
      + 'Total length: 150 to 200 words.\n\n'
      + 'AUDIT DATE: ' + date + '\n'
      + 'OVERALL SCORE: ' + score + '\n\n'
      + 'SECTION SCORES:\n' + sectionLines + '\n\n'
      + 'TOP ACTION ITEMS (ranked by monthly impact):\n' + itemLines + '\n\n'
      + 'MONTHLY OPPORTUNITY (sum of all action items): $' + Math.round(monthlyTotal) + '\n';
  }
};
