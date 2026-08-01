'use strict';

/* ── Bar Cop Briefing — cross-system read of the whole operation ──────────────
   A plain-operator narrative that ties the entire Hub together: the audit
   scores, the money picture (opportunity + recovered), this week's leaks, and
   anything urgent. Generated in CODE from the Hub snapshot, no API call, so it
   is instant and free, re-runs on demand, and always reads current data. Stored
   on App.data.bar_cop_briefing so a reopen is instant. Every line lands on a
   real number, in the same operator voice as the audits. */

window.BarCopBriefing = {

  _snap: null,

  _hasData() {
    const d = App.data || {};
    const has = (arr) => Array.isArray(arr) && arr.length > 0;
    return has(d.audits) || has(d.revenue_audits) || has(d.cash_audits) || has(d.bar_cop_audits);
  },

  _fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch (e) { return ''; }
  },

  attach(containerEl, snapshot) {
    if (!containerEl) return;
    if (snapshot) this._snap = snapshot;
    containerEl.innerHTML = '<button class="btn btn-ghost btn-sm" id="bcb-btn" style="font-size:10px;padding:4px 10px;letter-spacing:1px;">Bar Cop Briefing</button>';
    const btn = containerEl.querySelector('#bcb-btn');
    if (btn) btn.addEventListener('click', () => this._handleClick());
  },

  _handleClick() {
    if (!this._hasData()) {
      this._showError('Run an audit first. The briefing reads your Profit, Revenue, Cash, and Bar Cop Audit scores to size up the whole operation.');
      return;
    }
    const text = this._buildBriefing();
    const generated_at = new Date().toISOString();
    App.data.bar_cop_briefing = { text: text, generated_at: generated_at };
    try { App.save(); } catch (e) { /* show it regardless of a slow save */ }
    this._showModal(text, generated_at);
  },

  // 3 to 4 short paragraphs off the Hub snapshot: overall state, where the money
  // is, anything urgent, and the one move to make first.
  _buildBriefing() {
    const s = this._snap || {};
    const a = s.audits || {};
    const target = a.target || 70;
    const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');
    const paras = [];

    // 1 — overall state: the audit scores and the money picture together.
    const named = [['Profit', a.profit], ['Revenue', a.revenue], ['Cash', a.cash], ['the operational audit', a.barCop]];
    const runTxt = named.filter(([, v]) => v != null).map(([l, v]) => l + ' ' + v);
    const notRun = named.filter(([, v]) => v == null).map(([l]) => l);
    const below  = named.filter(([, v]) => v != null && v < target).map(([l]) => l);
    let p1 = runTxt.length ? 'On the board: ' + runTxt.join(', ') + '. ' : '';
    if (notRun.length) p1 += (notRun.length === 4 ? 'Nothing scored yet. ' : notRun.join(' and ') + ' ' + (notRun.length === 1 ? 'is' : 'are') + ' not run yet. ');
    if (below.length === 0 && runTxt.length) p1 += 'Everything scored is at or above the ' + target + ' line, which is the whole point. ';
    else if (below.length >= 3) p1 += 'Most of it sits under the ' + target + ' line, so there is real room here. ';
    else if (below.length) p1 += below.join(' and ') + ' ' + (below.length === 1 ? 'is' : 'are') + ' under the ' + target + ' line. ';
    /* ⚠ TWO OPPORTUNITY FIGURES SIT IN CONSECUTIVE SENTENCES AND THEY ANSWER DIFFERENT
       QUESTIONS. This one is the AUDIT's monthly number (each action item's monthly_impact,
       fixed when the audit ran); the weekly line in the next paragraph is Recovery.gapImpact
       "at this week's pace". MEASURED on the live demo: $6,055/mo = $72,660/yr against
       $160 + $850 a week = $52,520/yr, a $20,140 gap between adjacent sentences with nothing
       saying why. ⛔ THE FIX IS THE WORDING, NOT THE ARITHMETIC — forcing two different
       quantities to agree is what produced six new defects in the events door ([[the-loop]]
       #57). Each sentence now names its own basis. */
    if (s.opportunity != null) p1 += 'Total monthly opportunity across recovery and revenue is ' + money(s.opportunity) + ', from your latest audits.';
    if ((s.recovered || 0) > 0) p1 += ' You have pulled back ' + money(s.recovered) + ' across ' + (s.fixes || 0) + ' measured fix' + ((s.fixes || 0) === 1 ? '' : 'es') + ' so far.';
    if (p1.trim()) paras.push(p1.trim());

    // 2 — where the real money is, this week and the biggest lines.
    const wk = s.weekly || {};
    const items = (wk.items || []);
    if ((wk.leak || 0) > 0 || (wk.opp || 0) > 0) {
      // The other half of the pair above: this one is measured at the CURRENT PACE off your
      // logged weeks, so it moves every week while the audit figure holds until you re-run it.
      let p2 = 'Week to week at your current pace, ' + money(wk.leak) + ' is leaking in recoverable cost and ' + money(wk.opp) + ' in revenue is sitting on the table. ';
      if (items.length) {
        const top = items[0];
        p2 += 'The fattest single line is ' + String(top.label).toLowerCase() + ' at about ' + money(top.weekly) + ' a week';
        const more = items.slice(1, 3);
        if (more.length) p2 += ', then ' + more.map(it => String(it.label).toLowerCase() + ' at ' + money(it.weekly)).join(' and ');
        p2 += '.';
      }
      paras.push(p2);
    } else {
      paras.push('No sized leaks or revenue gaps are flagged this week. Either the systems are tight or they are hungry for more logged weeks. Keep closing your weeks and the picture sharpens.');
    }

    // 3 — anything urgent this week.
    const crit = (s.critical || []);
    const belowAudits = [['Profit', a.profit], ['Revenue', a.revenue], ['Cash', a.cash], ['Bar Cop', a.barCop]].filter(([, v]) => v != null && v < target).map(([l]) => l);
    if (crit.length || belowAudits.length) {
      const bits = [];
      crit.forEach(c => bits.push(String(c).replace(/\.$/, '')));
      if (belowAudits.length) bits.push('the ' + belowAudits.join(', ') + ' ' + (belowAudits.length === 1 ? 'score is' : 'scores are') + ' under target and dragging the whole read down');
      paras.push('Handle this week: ' + bits.join('; ') + '.');
    }

    // 4 — the one move to make first (only when there is a sized item).
    if (items[0]) paras.push('If you touch one thing first, make it ' + String(items[0].label).toLowerCase() + '. It is the biggest single number on the board and it moves the fastest.');

    return paras.map(p => '<div style="margin-bottom:14px;">' + esc(p) + '</div>').join('');
  },

  _showModal(bodyHtml, generated_at) {
    const dateStr = generated_at ? this._fmtDate(generated_at) : '';
    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">Bar Cop Briefing' + (dateStr ? ' &middot; as of ' + esc(dateStr) : '') + '</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.9;">' + bodyHtml + '</div>'
      + '<div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--b2);font-size:10px;color:var(--t4);line-height:1.6;">Generated from your logged Bar Cop data. A read on where you stand, not real-time and not financial or business advice.</div>'
      + '</div>';
    App.openModal(html, { id: 'bcb-modal', maxWidth: 640 });
  },

  _showError(message) {
    App.openModal('<div class="card form-card" style="margin:0;"><div style="font-size:13px;color:var(--t2);line-height:1.6;">' + message + '</div></div>', { id: 'bcb-error', maxWidth: 440 });
  }
};
