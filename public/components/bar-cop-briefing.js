'use strict';

/* ── Bar Cop Briefing — weekly cross-system read of the whole operation ───────
   A plain-operator narrative that ties the entire Hub together: the audit
   scores, the money picture (opportunity + recovered), this week's leaks, the
   key metrics versus target, and anything urgent (expiring permits / certs).

   Mounts a button in the Hub "Where You Stand" card. Generated at most ONCE A
   WEEK per bar: the result + a generated_at stamp are stored on
   App.data.bar_cop_briefing (persisted via App.save), so re-opening is free and
   a new analysis only fires when the stored one is REFRESH_DAYS old. No manual
   mid-week refresh, so a user cannot click it over and over and run up API
   cost. Rides the same client-side /api/claude proxy as Bar Cop Outlook, so no
   server work is involved. */

window.BarCopBriefing = {

  REFRESH_DAYS: 7,
  _snap: null,

  _sanitize(text) {
    if (!text) return '';
    return text
      .replace(/—/g, ', ')
      .replace(/–/g, '-')
      .replace(/ -- /g, ', ')
      .replace(/--/g, '-');
  },

  _stored() {
    const b = App.data && App.data.bar_cop_briefing;
    return (b && b.text) ? b : null;
  },
  _ageDays(b) {
    if (!b || !b.generated_at) return Infinity;
    return Math.floor((Date.now() - new Date(b.generated_at).getTime()) / 86400000);
  },
  _isFresh(b) { return this._ageDays(b) < this.REFRESH_DAYS; },
  _nextInDays(b) { return Math.max(0, this.REFRESH_DAYS - this._ageDays(b)); },

  // Enough to summarize? At least one audit has to have run.
  _hasData() {
    const d = App.data || {};
    const has = (arr) => Array.isArray(arr) && arr.length > 0;
    return has(d.audits) || has(d.revenue_audits) || has(d.cash_audits) || has(d.bar_cop_audits);
  },

  _fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch (e) { return ''; }
  },

  // Mount the button into a container. snapshot = the Hub numbers to summarize.
  attach(containerEl, snapshot) {
    if (!containerEl) return;
    if (snapshot) this._snap = snapshot;
    containerEl.innerHTML = '<button class="btn btn-ghost btn-sm" id="bcb-btn" style="font-size:10px;padding:5px 12px;letter-spacing:1px;">Bar Cop Briefing</button>';
    const btn = containerEl.querySelector('#bcb-btn');
    if (btn) btn.addEventListener('click', () => this._handleClick(btn));
  },

  _handleClick(btn) {
    const stored = this._stored();
    if (stored && this._isFresh(stored)) { this._showModal(stored.text, stored.generated_at); return; }
    if (!this._hasData()) {
      this._showError('Run an audit first. The briefing reads your Profit, Revenue, Cash, and Bar Cop Audit scores to size up the whole operation.');
      return;
    }
    this._generate(btn);
  },

  _reset(btn, label) { btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; btn.textContent = label; },

  async _generate(btn) {
    const orig = btn.textContent;
    btn.disabled = true; btn.style.opacity = '0.65'; btn.style.cursor = 'not-allowed'; btn.textContent = 'Analyzing...';
    const prompt = this._buildPrompt();
    try {
      const r = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 700, messages: [{ role: 'user', content: prompt }] })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (data.error) { this._showError('API error: ' + esc(data.error.message || 'unknown')); this._reset(btn, orig); return; }
      const sanitized = this._sanitize(data.content?.[0]?.text || '');
      if (!sanitized.trim()) { this._showError('Empty response. Try again.'); this._reset(btn, orig); return; }
      const html = sanitized.split(/\n\n+/).map(p => '<div style="margin-bottom:14px;">' + esc(p).replace(/\n/g, '<br>') + '</div>').join('');
      const generated_at = new Date().toISOString();
      App.data.bar_cop_briefing = { text: html, generated_at: generated_at };
      try { await App.save(); } catch (e) { /* show it even if the save round-trips slowly */ }
      this._reset(btn, orig);
      this._showModal(html, generated_at);
    } catch (e) {
      this._showError('Could not generate briefing: ' + esc(e.message || 'unknown error'));
      this._reset(btn, orig);
    }
  },

  _showModal(bodyHtml, generated_at) {
    const dateStr = generated_at ? this._fmtDate(generated_at) : '';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--surface);border:1px solid var(--b1);border-radius:var(--r);padding:28px;max-width:640px;width:100%;max-height:82vh;overflow-y:auto;';
    box.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">'
      +   '<div style="font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--t3);">Bar Cop Briefing' + (dateStr ? ' &middot; as of ' + esc(dateStr) : '') + '</div>'
      +   '<button class="btn btn-ghost btn-sm bcb-close">Close</button>'
      + '</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.9;">' + bodyHtml + '</div>'
      + '<div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--b2);font-size:10px;color:var(--t4);line-height:1.6;">Generated from your logged Bar Cop data. A weekly read, not real-time and not financial or business advice. Refreshes once a week.</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    box.querySelector('.bcb-close')?.addEventListener('click', close);
    const onKey = (e) => { if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(); } };
    document.addEventListener('keydown', onKey);
  },

  _showError(message) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--surface);border:1px solid var(--b1);border-radius:var(--r);padding:24px 28px;max-width:440px;width:100%;';
    box.innerHTML = '<div style="font-size:13px;color:var(--t2);line-height:1.6;margin-bottom:18px;">' + message + '</div>'
      + '<div style="display:flex;justify-content:flex-end;"><button class="btn btn-ghost btn-sm bcb-close">OK</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    box.querySelector('.bcb-close')?.addEventListener('click', close);
  },

  _buildPrompt() {
    const s = this._snap || {};
    const a = s.audits || {};
    const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');
    const auditLine = (label, score, withTarget) =>
      label + ': ' + (score != null ? score + ' of 100' + (withTarget ? ' (target ' + (a.target || 70) + ' or higher)' : '') : 'not run yet');
    const auditLines = [
      auditLine('Profit Recovery audit', a.profit, true),
      auditLine('Revenue Recovery audit', a.revenue, true),
      auditLine('Cash Recovery audit', a.cash, true),
      auditLine('Bar Cop operational audit', a.barCop, false)
    ].join('\n');

    const wk = s.weekly || {};
    const wkLine = 'Leaking ' + money(wk.leak) + ' per week in recoverable cost, '
      + money(wk.opp) + ' per week in projected revenue opportunity.';
    const wkItems = (wk.items || []).length
      ? (wk.items || []).map(it => '- ' + (it.module ? it.module.toUpperCase() + ': ' : '') + it.label + ' (~' + money(it.weekly) + '/wk)').join('\n')
      : '- none flagged';

    const metricLines = (s.metrics || []).length
      ? (s.metrics || []).map(m => '- ' + m.label + ': ' + (m.val || 'n/a') + ' (target ' + (m.target || 'n/a') + ', '
          + (m.status === 'bad' ? 'over target' : m.status === 'warn' ? 'watch' : 'on target') + ')').join('\n')
      : '- none yet';

    const critLines = (s.critical || []).length ? (s.critical || []).map(t => '- ' + t).join('\n') : '- none';

    return 'You are a 30-year bar and restaurant operator writing a short weekly briefing for a fellow owner about the overall state of their operation, read off their Bar Cop Hub. '
      + 'Write 3 to 4 short paragraphs. '
      + 'Talk straight across the bar. Give the numbers as they are, the good, the bad, and the ugly, in depth and specific. Do not teach, explain the basics, lecture, or hand out pep talks. No motivational lines, nothing like "you already know what to do," nothing that talks down to the reader. You can be dry and a little funny, and you can weave in a quick bit of bar-floor storytelling so a rough number reads easy instead of stinging, but never at the operator\'s expense and never invented. Every point lands on a real number from the data. No emdashes, no double dashes, no bullet points, no headers, no AI words (cadence, leverage, robust, going forward, ecosystem, synthesize, comprehensive, seamless). '
      + 'Paragraph 1: the overall state of the operation right now, reading the audit scores and the money picture together. '
      + 'Paragraph 2: where the real money is, this week and longer term, the biggest leaks and the biggest opportunity with the dollar figures. '
      + 'Paragraph 3: anything urgent to handle this week, like an expiring permit or certification or an audit slipping below target. '
      + 'Paragraph 4 (only if it earns its place): the single most important move to make first. '
      + 'Total length: 180 to 240 words.\n\n'
      + 'OPERATION: ' + (s.bar || 'this bar') + '\n'
      + 'TOTAL MONTHLY OPPORTUNITY (recovery plus revenue): ' + (s.opportunity != null ? money(s.opportunity) : 'no audit run yet') + '\n'
      + 'RECOVERED TO DATE: ' + money(s.recovered) + ' across ' + (s.fixes || 0) + ' measured fix' + ((s.fixes || 0) === 1 ? '' : 'es') + '\n\n'
      + 'AUDIT SCORES:\n' + auditLines + '\n\n'
      + 'THIS WEEK:\n' + wkLine + '\n' + wkItems + '\n\n'
      + 'KEY WEEKLY METRICS:\n' + metricLines + '\n\n'
      + 'URGENT / CRITICAL ITEMS:\n' + critLines + '\n';
  }
};
