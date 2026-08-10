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

  /* ⭐⭐ IS THERE ANYTHING TRUE TO SAY? That is the gate, and it is NOT "has an audit been run".
     ⛔ IT USED TO BE. `_hasData()` asked for one row in audits / revenue_audits / cash_audits /
     bar_cop_audits and refused outright otherwise. Correct when the briefing was audit-scores-first
     — its own header still says it reads those scores "to size up the whole operation" — but it
     then grew the weekly leak lines, the section paragraph and the one-move line, none of which
     need an audit, and the gate never moved with them.
     MEASURED on a bar with logged weeks and worked steps but no audit: **4 of the 5 paragraphs were
     real and the operator was shown NONE of them.** The first paragraph already degrades honestly on
     its own ("Nothing scored yet."), so the audit half was never the thing that needed protecting.
     ⚠ AND IT MATTERS MORE SINCE THE RAIL MOVED TO THE TOP BAR. On the Hub it was one refusal on one
     page; now it is on every page a new bar opens in its first week.
     ⚠ ZEROES ARE NOT SUBSTANCE. Day one has all eight sections present at 0 of 4 and a weekly
     readout of 0/0, so every disjunct below tests for a REAL value, never for the field existing. */
  _hasSubstance(s) {
    s = s || {};
    const a = s.audits || {};
    const w = s.weekly || {};
    const scored   = ['profit', 'revenue', 'cash', 'barCop'].some(k => a[k] != null);
    const money    = (w.leak || 0) > 0 || (w.opp || 0) > 0 || (s.recovered || 0) > 0;
    const progress = (s.sections || []).some(x => (x.done || 0) > 0);
    const flagged  = (s.critical || []).length > 0;
    return scored || money || progress || flagged;
  },

  _fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch (e) { return ''; }
  },

  /* ⛔ `attach()` IS GONE. It mounted a button into the Hub's Where You Stand header and handed it a
     snapshot built during that page's render. The Rail replaced both: one button, static in the top
     bar, taking its snapshot on demand. Its only caller went with the Hub's slot, and a mounting
     helper with nothing to mount is the kind of leftover the next person reuses by accident. */

  /* THE ONE DOOR. The Rail button sits in the top bar on every page, so the snapshot cannot come
     from whatever the Hub last rendered — it is computed here, at click time, from App.data.
     ⛔ BARE CALL ON PURPOSE. If S.Hub.briefingSnapshot is ever missing this must fail loudly:
     optional-chaining it would fall back to a stale-or-empty _snap and print a confident-looking
     briefing with most of the bar missing, which is the one outcome worse than an error
     ([[the-loop]] #40). */
  open() {
    this._snap = S.Hub.briefingSnapshot();
    this._handleClick();
  },

  _handleClick() {
    /* Gated on the SNAPSHOT, not on the stores: `open()` has just built it, and it is the same
       object every paragraph reads, so the button cannot refuse over data the briefing would have
       used. The old copy demanded an audit and named nothing else; a logged week or one worked step
       is enough to fill this in, and saying so is what makes it a day-one screen rather than a
       locked door. */
    if (!this._hasSubstance(this._snap)) {
      this._showError('Nothing to read yet. The Rail sizes up the whole bar from your own logged numbers. '
        + 'Close out a week, work a step, or run any audit and it fills in from there.');
      return;
    }
    /* ⚠ NOT PERSISTED ANY MORE, AND THE COMMENT THAT SAID IT WAS HAS GONE WITH IT. This used to
       write App.data.bar_cop_briefing and fire an App.save() on every open, under a header
       claiming it made a reopen instant. Nothing ever read it back — _handleClick always rebuilt —
       so it was a save round-trip per click buying nothing, and the briefing is rebuilt from
       current data anyway, which is the behaviour you actually want now that the button is on
       every page ([[the-loop]] #25: computed, persisted, read nowhere). */
    this._showModal(this._buildBriefing(), new Date().toISOString());
  },

  // Up to 5 short paragraphs off the snapshot: overall state, where the money is, where the eight
  // sections stand this week, anything urgent, and the one move to make first.
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

    /* 3 — WHERE THE EIGHT SECTIONS STAND THIS WEEK. This paragraph came from the Week In Review
       briefing, which is being retired: it was the one part of that read which was about the whole
       BAR rather than about that page's numbers, so it belongs here. Sections are named, never
       counted ("Inventory, Labor and Shift closed clean" beats "3 of 8 complete") — the operator
       needs to know WHICH one is behind, and a bare count makes them go and look. */
    const secs = s.sections || [];
    if (secs.length) {
      const clean = secs.filter(x => x.total > 0 && x.done >= x.total).map(x => x.name);
      const open  = secs.filter(x => x.total > 0 && x.done < x.total);
      const list  = (arr) => arr.length > 1 ? arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1] : arr[0];
      let p3 = '';
      if (clean.length && !open.length) p3 = 'Every section is closed out this week. The whole board is caught up.';
      else if (clean.length) p3 = list(clean) + ' ' + (clean.length === 1 ? 'is' : 'are') + ' closed out this week. ';
      // Name the shortfall with its own numbers; "still open" alone sends them hunting.
      if (open.length) {
        p3 += (clean.length ? 'Still open: ' : 'Nothing is closed out yet this week. Still open: ')
          + open.map(x => x.name + ' (' + x.done + ' of ' + x.total + ')').join(', ') + '.';
      }
      if (p3) paras.push(p3.trim());
    }

    // 4 — anything urgent this week.
    const crit = (s.critical || []);
    const belowAudits = [['Profit', a.profit], ['Revenue', a.revenue], ['Cash', a.cash], ['Bar Cop', a.barCop]].filter(([, v]) => v != null && v < target).map(([l]) => l);
    if (crit.length || belowAudits.length) {
      const bits = [];
      crit.forEach(c => bits.push(String(c).replace(/\.$/, '')));
      if (belowAudits.length) bits.push('the ' + belowAudits.join(', ') + ' ' + (belowAudits.length === 1 ? 'score is' : 'scores are') + ' under target and dragging the whole read down');
      paras.push('Handle this week: ' + bits.join('; ') + '.');
    }

    // 5 — the one move to make first (only when there is a sized item).
    if (items[0]) paras.push('If you touch one thing first, make it ' + String(items[0].label).toLowerCase() + '. It is the biggest single number on the board and it moves the fastest.');

    return paras.map(p => '<div style="margin-bottom:14px;">' + esc(p) + '</div>').join('');
  },

  _showModal(bodyHtml, generated_at) {
    const dateStr = generated_at ? this._fmtDate(generated_at) : '';
    const html = '<div class="card form-card" style="margin:0;">'
      + '<div class="card-title">The Rail' + (dateStr ? ' &middot; as of ' + esc(dateStr) : '') + '</div>'
      + '<div style="font-size:13px;color:var(--t2);line-height:1.9;">' + bodyHtml + '</div>'
      + '<div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--b2);font-size:10px;color:var(--t4);line-height:1.6;">Generated from your logged Bar Cop data. A read on where you stand, not real-time and not financial or business advice.</div>'
      + '</div>';
    App.openModal(html, { id: 'bcb-modal', maxWidth: 640 });
  },

  _showError(message) {
    App.openModal('<div class="card form-card" style="margin:0;"><div style="font-size:13px;color:var(--t2);line-height:1.6;">' + message + '</div></div>', { id: 'bcb-error', maxWidth: 440 });
  }
};
