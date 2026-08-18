'use strict';

/* ── Week in Review — the recap of a week that has finished ────────────────────
   For a FINISHED week it reads every section's real activity (counts taken, spot
   checks run, deliveries received, orders placed, hours and tips logged, logs
   filed) and lays out per section: what was DONE, what it turned up, and what is
   carrying into next week. Three bands, every one of them derived from records
   that exist. Monday-based weeks. Opened from the Week ▸ Review rail row.

   ⛔⛔⛔ IT NO LONGER ACCUSES THE OPERATOR, AND IT NO LONGER SHOWS A LIVE WEEK.
   Kyle, 2026-08-11: *"a recap of the PREVIOUS week only.. i don't think it should
   even have the week selector be able to land on the current unfinished week"*,
   and *"every section card shows a red 4 MISSED and 0 OF 4 derived from stepDone
   (manual ticks nothing reads), while its own DONE THIS WEEK band directly
   beneath proves the work happened."*
   ⭐ MEASURED BEFORE CUTTING: `stepDone` was read out of all eight sources, not
   taken from memory. Every one is `doneMap()` — an `App.acctGet` checkbox map —
   with ONE exception in the whole set: Profit and Revenue append
   `r.week = !!this.savedWeek(this.weekEnd())`, which is DERIVED from the
   confirmed-week record. Events' `stepInfo(...).done` is an ack plus a pending
   list, so it is a tick too. So the page printed a red "4 MISSED" off a control
   panel nothing downstream reads, directly above a band of real records proving
   the work happened. The one derived fact SURVIVES, re-derived here straight from
   `savedWeek`, so "the week was never confirmed" is still said — it just no
   longer needs a checkbox to say it.
   ⚠ AND EVERY "Carrying Into Next Week" ITEM GATED ON A TICK HAD TO BE RE-DERIVED
   OR REMOVED, never simply un-gated: an item is only allowed here if a record can
   prove it. Pinned by verify-week-review-recap.js. */

S.WeekReview = {
  container: null,
  _wkStart: null,   // Monday (ymd) of the selected week; null = this week

  open() {
    /* ⛔ WAS `_hubBlocked()` — the MANAGEMENT-ONLY question, which only asks "is this person an
       admin". So every admin reached this page regardless of what the owner had granted them,
       while Close beside it had no gate at all and History was filed under Profit: three pages
       in one rail group, three different answers. They are the Week area now. */
    if (App._hubBlocked && App._hubBlocked('week-review')) return;
    App.openHubFullPage('Week in Review', (mount) => { this.container = mount; this.render(mount); }, 'week-review');
  },

  // ── Monday-based week (matches the section closes) ──────────────────────────
  _monday(dstr) {
    const d = dstr ? new Date(dstr + 'T00:00:00') : new Date();
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return App.ymdLocal(d);
  },
  _addDays(ymd, n) { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return App.ymdLocal(d); },
  /* ⛔⛔ IT OPENS ON THE LAST WEEK YOU ACTUALLY CLOSED. That is the week an operator wants to read
     back, and a `weeks` record with a `period_end` is the only durable definition of "closed" in
     the app ([[confirm-the-week]]). No ticks.
     ⚠ NO FUTURE GUARD HERE ANY MORE, and that is the point: `confirm-week` stamps
     `period_end = App.nextSunday()`, which is TODAY OR LATER, so confirming the RUNNING week wrote a
     record on this week and the old guard waved it through — it only refused a week AHEAD of this
     one. `_defaultMonday`'s ceiling is now the single place that decides how recent the page may
     get, so there is no second rule to disagree with it ([[the-loop]] #45: one fact, one reader). */
  _lastClosedMonday() {
    const ends = ((App.data && App.data.weeks) || [])
      .map(w => String((w && w.period_end) || '').slice(0, 10))
      .filter(Boolean).sort();
    const last = ends[ends.length - 1];
    return last ? this._monday(last) : '';
  },
  /* ⛔⛔ ONE RULE, TWO READERS. `_wkS` is NOT the only thing that decides where this page opens —
     `render` pins `_wkStart` on its first pass so the week is stable across re-renders, and it did
     that with `_monday()`. So the first version of this change put the fallback in `_wkS` alone and
     was completely INERT: render had already assigned this week before `_wkS` was ever consulted.
     It read correct and did nothing, and only walking the page showed it. Both readers ask here. */
  /* ⛔⛔⛔ THE CEILING. The newest week this page can stand on is the week that ENDED. Kyle:
     *"a recap of the previous week.. i don't think it should even have the week selector be able to
     land on the current unfinished week."* A week half-lived has half its records, so a recap of it
     reports a bar that looks like it did nothing about a week nobody has finished.
     ⚠ IT IS A CAP, NOT A CLAMP: an operator who has not closed a week in a month still opens on the
     week they DID close. This only says how recent the page may get. */
  _maxMonday() { return this._addDays(this._monday(), -7); },
  _defaultMonday() {
    const lc = this._lastClosedMonday(), mx = this._maxMonday();
    return (lc && lc <= mx) ? lc : mx;
  },
  _wkS() { return this._wkStart || this._defaultMonday(); },
  _wkE() { return this._addDays(this._wkS(), 6); },
  _inWeek(dstr) { const d = String(dstr || '').slice(0, 10); const s = this._wkS(), e = this._wkE(); return !!d && d >= s && d <= e; },
  _atLatest() { return this._wkS() >= this._maxMonday(); },
  _step(n) {
    const next = this._addDays(this._wkS(), n);
    if (n > 0 && next > this._maxMonday()) return;
    this._wkStart = next;
    this.render(this.container);
  },

  // ── Shared visual bits ──────────────────────────────────────────────────────
  _eyebrow(t) {
    return '<div style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t3);margin-bottom:11px;">' + t + '</div>';
  },
  /* ── DONE THIS WEEK: WRITTEN ROWS, NOT A NUMBER STRIP ─────────────────────────────────────────
     ⛔⛔⛔ Kyle, 2026-08-11: *"i want to make the done this week section more of a written out text
     rows that actual describe what happened.. not just spot checks 1.. but one spot check was taken
     on x/xx by 'name here' and it found X, y and z.. like an actual review of the week and what
     actually happened.. not just a bunch of numbers."*
     ⭐ THE RECORDS CARRIED ALL OF IT AND THE STRIP THREW IT AWAY. A spot check stores its date, its
     location, its shift, who ran it, how many products were flagged and the dollar variance, and the
     card printed the single character "1". Measured across every store before a line was written.
     ⛔ ONLY WHAT HAPPENED (Kyle: *"correct only what happen"*). Nothing with a zero behind it gets a
     line at all, because a recap that lists what did NOT happen is the accusation this page just had
     removed, coming back in a sentence. A section that logged nothing all week says so once.
     ⚠⚠ EVERY CLAUSE IS CONDITIONAL ON ITS OWN FIELD, and that is not defensive habit, it is measured:
     `reason` is an EMPTY STRING on the seed's only call-out and `item` is blank on three of the six
     void/comps. A sentence built by plain concatenation prints "by " or ", ." with nothing after it,
     which is worse than the number it replaced. */
  /* ⛔⛔⛔ EVERY STAFF NAME IN THIS APP ENDS IN A PERIOD — "Maria G.", "Jake T.", "Devin R." — so any
     sentence that ends on a name prints "..", and a dropped optional clause can leave a double space
     behind it. Both showed up the first time the card was rendered against the REAL seed rather than
     a fixture I wrote, which is the whole argument for doing that ([[the-loop]] #32).
     ⭐ NORMALISED IN ONE PLACE, not policed at the seventeen sites that compose a sentence. An
     enumeration of compose sites is a guess about the surface and it will be wrong the next time a
     line is added; this cannot be forgotten ([[the-loop]] #90 — remove the window, do not police it).
     ⚠ SHARED WITH THE EXPORT, because the PDF builds from the same lines and a tidy screen beside a
     ragged PDF is the same defect with an extra step (step 0.6, the second consumer). */
  _tidy(s) {
    return String(s == null ? '' : s)
      .replace(/ {2,}/g, ' ')
      .replace(/([.!?])\1+/g, '$1')
      .replace(/\s+([.,;])/g, '$1')
      .trim();
  },
  _didRow(html) {
    return '<div style="font-size:12.5px;color:var(--t2);line-height:1.55;">' + this._tidy(html) + '</div>';
  },
  _didList(lines) {
    const rows = (lines || []).filter(Boolean);
    return rows.length
      ? '<div style="display:flex;flex-direction:column;gap:9px;">' + rows.map(l => this._didRow(l)).join('') + '</div>'
      : '<div style="font-size:12.5px;color:var(--t3);padding:2px 0;">Nothing logged this week.</div>';
  },
  // The count leads the sentence so the band is still scannable at a glance.
  _n(v) { return '<b style="color:var(--t1);font-weight:700;">' + v + '</b>'; },
  _plu(n, one, many) { return n === 1 ? one : (many || (one + 's')); },
  // A blank name is common on imported rows; it must drop the clause, never print "by ".
  _nm(v) { const s = String(v == null ? '' : v).trim(); return s ? esc(s) : ''; },
  _by(v) { const s = this._nm(v); return s ? ' by ' + s : ''; },
  _day(ymd) {
    const d = new Date(String(ymd || '').slice(0, 10) + 'T00:00:00');
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  },
  _on(ymd) { const s = this._day(ymd); return s ? ' ' + s : ''; },
  _m0(v) { return App.fmtCurrency(v || 0, 0); },
  /* CENTS ONLY WHEN THERE ARE CENTS. A single record's amount sat beside a rounded total in the same
     sentence and read "$301. Biggest was $88.00" — two spellings of money one clause apart. Rounding
     the individual figure instead would have been the wrong trade: a $88.50 comp is not $89. */
  _amt(v) { const n = Number(v) || 0; return Math.round(n) === n ? App.fmtCurrency(n, 0) : App.fmtCurrency(n); },
  // "2 bottles" but "1 bottle" — a quantity of 1 against a plural stored unit reads as a typo.
  _qty(q, unit) {
    const u = String(unit || '').trim();
    const one = Number(q) === 1 && /s$/i.test(u) ? u.slice(0, -1) : u;
    return q + (one ? ' ' + esc(one) : '');
  },
  // "A, B and C" — an Oxford-free join, because these are read as a sentence.
  _join(list) {
    const a = (list || []).filter(Boolean);
    return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  },
  /* ⚠ NO SUPERLATIVE OUT OF A TIE OR A SINGLE ROW. Five of this week's six labor days are 62.2 hours
     to the decimal, so "busiest day" would have named whichever one happened to sort first — a fact
     the data does not support, printed with total confidence. Returns null unless one row beats every
     other outright ([[the-loop]] #83: two orthogonal facts in one slot, and the ternary picks). */
  _topOf(rows, valOf) {
    if (!rows || rows.length < 2) return null;
    const s = rows.slice().sort((a, b) => valOf(b) - valOf(a));
    return valOf(s[0]) > valOf(s[1]) ? s[0] : null;
  },
  /* NAME THEM WHILE THERE ARE FEW, SUMMARISE WHEN THERE ARE MANY. Three is a LAYOUT budget, not a
     measurement: four named events overflow a half-width card on a laptop. Said out loud so nobody
     later reads it as a finding about the data ([[the-loop]] #28).
     ⛔⛔ A METHOD, NOT A DATA PROPERTY. It was `_few: 3` for an hour and that made the "name them
     individually" branch UNTESTABLE: every slicer in the suite lifts METHODS by name and a data
     property is invisible to all of them ([[the-loop]] #16 / #120), so `this._few()` was `undefined`
     in every fixture, `n <= undefined` was false, and all eight sections silently took the summarise
     path in every pin that existed. Nothing went red. It surfaced only when the card was rendered
     against the real seed and a single walked tab refused to name itself. */
  _few() { return 3; },
  _res(label, val, col) {
    return '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:600;line-height:1;color:' + (col || 'var(--t1)') + ';">' + val + '</div></div>';
  },
  _resRow(items) {
    const vdiv = '<div class="wr-vdiv" style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 24px;"></div>';
    return '<div class="wr-statrow" style="display:flex;align-items:flex-start;flex-wrap:wrap;row-gap:16px;">' + items.join(vdiv) + '</div>';
  },
  _openItem(text, sev) {
    const col = sev === 'red' ? 'var(--red)' : 'var(--amber)';
    return '<div style="display:flex;align-items:center;gap:11px;padding:10px 13px;background:var(--gold-tint);border-radius:5px;">'
      + '<span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:' + col + ';"></span>'
      + '<span style="font-size:12.5px;color:var(--t2);line-height:1.5;">' + text + '</span></div>';
  },
  /* ⛔ URGENT FIRST, ON EVERY CARD (Kyle, 2026-07-31: "the carrying into next week sections on
     each card are not consistent with the red urgent dot items all listed above the amber dot
     items"). This rendered in PUSH ORDER, so whether a red sat above an amber depended on which
     check happened to run first. Measured off the rendered dots, two of six populated cards were
     out of order — and on the Cash card the single most urgent line, "Safe-to-spend is negative",
     sat SECOND, under a merely-amber one.
     ⚠⚠ AND THE ORDER DECIDES WHAT SURVIVES: the 5-item cap below truncates whatever is last, so
     unsorted it could drop a RED while showing five ambers. The Labor card already pushes six.
     Sorting fixes the ordering and the truncation together.
     ⚠ STABLE within a band — the authored order inside red (and inside amber) is roughly
     worst-first and must not be shuffled. Pinned by verify-week-review-urgency-and-period.js. */
  /* ⚠ `emptyMsg` EXISTS FOR BOOKS, AND IT IS THE KIND OF THING A DELETION CREATES. Books' band is
     headed "To Close" and it closes a MONTH, so the shared "Clean week." line was wrong there the
     moment the permits row came off and the band could actually render empty on real data. A default
     that was never reached is not a default that was right. */
  _openList(items, emptyMsg) {
    const rank = o => (o && o.sev === 'red') ? 0 : 1;
    const ranked = items.map((o, i) => ({ o, i }))
      .sort((a, b) => (rank(a.o) - rank(b.o)) || (a.i - b.i))
      .map(x => x.o);
    return ranked.length
      ? '<div style="display:flex;flex-direction:column;gap:8px;">' + ranked.slice(0, 5).map(o => this._openItem(o.t, o.sev)).join('') + '</div>'
      : '<div style="font-size:12.5px;color:var(--green);padding:2px 0;">&#10003; ' + (emptyMsg || 'Nothing open. Clean week.') + '</div>';
  },
  /* ⭐ AUDIT FRESHNESS, ASKED AT THE WEEK'S END, NOT AGAINST THE WALL CLOCK. The cockpits' own
     `_auditState` measures days since the newest audit against `Date.now()`, so on a recap of a week
     in March it would print "153 days old" — a fact about today wearing a past week's heading. The
     honest question about a finished week is how fresh the read was WHEN THAT WEEK CLOSED, and the
     app's own bar for "due" is 7 days. Judged against the data's own dates, so it has no shelf life
     ([[the-loop]] #135). ONE helper, three callers, so Profit, Revenue and Cash cannot drift apart
     on it ([[the-loop]] #54). */
  _auditGap(records) {
    const end = this._wkE();
    const last = (records || [])
      .map(a => String((a && (a.date || a.generated_at)) || '').slice(0, 10))
      .filter(d => d && d <= end).sort().pop();
    if (!last) return { ever: false, days: null, stale: true };
    const days = Math.round((new Date(end + 'T00:00:00').getTime() - new Date(last + 'T00:00:00').getTime()) / 86400000);
    return { ever: true, days: days, stale: days >= 7 };
  },
  /* Section shell: header (the section name, full-bleed divider) then inset-divided blocks.
     ⛔ NO STATUS CHIP AND NO FOOTER LINK. The chip counted manual ticks and the link opened one of
     the six cockpits being deleted — seven of the twenty-three remaining cockpit references in the
     whole app were this one line. A recap does not need eight doors on it. */
  _sectionCard(name, blocks) {
    const idiv = '<div class="wr-idiv"></div>';
    /* ⛔ THE SAME HEADER BAND THE REST OF THE APP USES (Kyle: *"make the headers on the 8 section
       cards normal header height like close the week header height"*). MEASURED on the shipped
       build: `.ck-head` is 34px (11/22 padding, a 9px uppercase label) and `.wr-head` was 51px
       (15/20 padding, a 17px Barlow Condensed title). Matching the HEIGHT means matching the
       TREATMENT — at 17px the line box alone is 21px, so no padding change gets to 34.
       ⚠ ONE DEVIATION FROM `.ck-head`, DELIBERATE: the label keeps `--t1` rather than `--t3`. That
       band is a page banner with one instance on screen; this one names one of eight cards sitting
       beside `--t3` band labels inside the card, and at the same grey the card would have no name. */
    const header = '<div class="wr-head" style="display:flex;align-items:center;gap:12px;min-width:0;">'
      + '<span style="font-size:9px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:var(--t1);">' + esc(name) + '</span>'
      + '</div>';
    const body = blocks.map(b => '<div class="wr-block">' + this._eyebrow(b.label) + b.html + '</div>').join(idiv);
    return '<div class="card" style="padding:0 !important;overflow:hidden;margin:0;display:flex;flex-direction:column;">'
      + header + '<div style="flex:1 1 auto;">' + body + '</div></div>';
  },

  // ── The week's money headline (from the confirmed week, matched by Sunday) ───
  _weekMoney() {
    const pe = this._wkE();
    const w  = ((App.data && App.data.weeks) || []).find(x => x && x.period_end === pe);
    const rw = ((App.data && App.data.revenue_weeks) || []).find(x => x && x.period_end === pe);
    let netSales = null, prime = null, laborPct = null;
    if (w) {
      const bar = w.bar || {}, food = w.food || {}, cat = w.catering || {}, oth = w.other || {};
      netSales = (bar.revenue || 0) + (food.revenue || 0) + (cat.revenue || 0) + (oth.revenue || 0);
      prime = w.prime_cost_pct;
    } else if (rw) {
      netSales = (rw.bar_revenue || 0) + (rw.floor_revenue || 0);
    }
    // Labor % is ConfirmWeek's `labor_pct_blended`, measured against TOTAL SALES with
    // catering labor in the numerator ([[labor-cost-model]] THE DENOMINATORS). When that
    // number is missing, rebuild it THE SAME WAY — two things were wrong with the old
    // fallback and both showed the operator a number that was not true:
    //   1. `(b.labor || 0)` reads a BLANK as zero, so a week with revenue and no labor
    //      entered printed a confident "Labor 0.0%" — the best labor number a bar can
    //      have, on a week with no labor data at all. ConfirmWeek is deliberately
    //      null-in/null-out here ("a percentage whose input was never entered is
    //      unknown, and it stays unknown all the way into the store") and every other
    //      consumer honours it: hub.js, r-dashboard.js and hub-group-dashboard.js all
    //      print '-'. This was the only site that invented a value.
    //   2. It divided bar+food labor by bar+food revenue, dropping catering from BOTH
    //      sides, so the same "Labor" label switched basis depending on whether a
    //      revenue_week happened to exist (measured 2.34 points high on a catering week).
    // `laborIn` MIRRORS confirm-week's gate exactly — a department owes a labor figure
    // only once it has rung sales, so a bar with no kitchen still resolves. Do not
    // "simplify" it to a plain null check or a bar-only operation goes unknown forever.
    if (rw && rw.labor_pct_blended != null) laborPct = rw.labor_pct_blended;
    else if (w) {
      const b = w.bar || {}, f = w.food || {}, c = w.catering || {}, o = w.other || {};
      const bR = b.revenue || 0, fR = f.revenue || 0;
      const laborIn = (!(bR > 0) || b.labor != null) && (!(fR > 0) || f.labor != null);
      const totSales = bR + fR + (c.revenue || 0) + (o.revenue || 0);
      if (laborIn && totSales > 0) {
        laborPct = ((b.labor || 0) + (f.labor || 0) + (c.labor || 0)) / totSales * 100;
      }
    }
    /* ⛔ REPORT WHETHER THE WEEK IS CONFIRMED, NOT JUST WHAT IT IS WORTH (W2). These tiles print
       a bare '-' until the week is confirmed, while the Shift card ten inches below prints
       "Net Sales $19,150" off the LOGGED shifts. Both are right and they answer different
       questions — this one is "what did you sign off", that one is "what has been logged so far"
       — but they carry the same label and nothing said which was which
       ([[the-loop]] #57: different quantities are allowed to differ; the fix is the label).
       ⚠ The flag is about the RECORD EXISTING, never about a value being null: a week can be
       confirmed and still leave Labor % unknown (confirm-week is null-in/null-out there on
       purpose), and captioning that "not confirmed" would be a false statement about the
       operator's own work. */
    return { netSales, prime, laborPct, confirmed: !!(w || rw) };
  },
  _topCard() {
    const m = this._weekMoney();
    const pct = v => (v != null && !isNaN(v)) ? (Number(v).toFixed(1) + '%') : '-';
    const stat = (label, val) => '<div style="min-width:0;">'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t3);margin-bottom:7px;">' + label + '</div>'
      + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:38px;font-weight:600;line-height:0.9;color:var(--t1);">' + val + '</div></div>';
    const vdiv = '<div class="wr-vdiv" style="align-self:stretch;width:1px;background:var(--b2);flex-shrink:0;margin:0 34px;"></div>';
    const stats = [
      stat('Net Sales', m.netSales != null ? App.fmtCurrency(m.netSales, 0) : '-'),
      stat('Prime Cost', pct(m.prime)),
      stat('Labor', pct(m.laborPct))
    ].join(vdiv);
    /* ⛔ NO HEADER BAND ON THE STATS BOX (Kyle, 2026-08-11: *"remove the header on the stats box so
       just the stats inside the border"*). It read "WEEK IN REVIEW" directly under a page already
       titled Week in Review, so the band cost 42px of vertical to repeat the title back. */
    /* ⭐ `--stat` (Kyle, 2026-08-14: *"week in review a stat box"*). It is a `.card` with no head
       already, but its stats are hand-rolled at 38px rather than `.calc-item`, so the shape-based
       selector cannot see it. Reading the token here reaches the same place: change `--stat` and
       this box moves with every other one. */
    return '<div class="card" style="margin-bottom:16px;overflow:hidden;padding:0 !important;background:var(--stat);">'
      + '<div class="wr-statrow wr-topstats" style="display:flex;align-items:flex-start;flex-wrap:wrap;row-gap:16px;">' + stats + '</div>'
      /* ⛔ SAY WHY THESE ARE BLANK (W2). Three dashes up here beside "Net Sales $19,150" in the
         Shift card read as a contradiction; they are two different questions and only this one
         waits on the weekly close. Said ONCE, under the row, rather than stuffing words into a
         38px number slot. Gated on the week RECORD, never on a null figure. */
      /* ⚠ PAST TENSE, BECAUSE THE WEEK IS OVER. It still says how to fix it: Close The Week steps
         back to any past week, so an unconfirmed week is not a closed door. */
      + (m.confirmed ? ''
          : '<div class="wr-note" style="padding-top:0;font-size:11.5px;color:var(--t3);line-height:1.6;">'
            + 'This week was never confirmed, so these stayed blank. You can still confirm it from Close The Week. The section cards below show what was logged.</div>')
      + '</div>';
  },

  // ── Inventory ───────────────────────────────────────────────────────────────
  _inventorySection() {
    // No cockpit alias and no absence guard, for the reason written on the Profit card.
    const inv = (App.inventoryData) || {};
    const products = (inv.ic_products || []).filter(p => p.active !== false);
    if (!products.length || !(inv.ic_counts || []).length) return null;

    /* ⚠ THE BORROW HERE WAS LIVE IN MECHANISM AND INERT IN EFFECT, WHICH IS THE WORST OF BOTH.
       `computeState()` returns 27 fields and exactly THREE depend on the week (`hasCountThisWeek`,
       `weekCount`, `deliveriesThisWeek`). This card reads seven, and not one of them is on that
       list — so the page moved another screen's week selector to change three values it then threw
       away. Measured before cutting, not assumed. */
    const st = this._inventoryFigures();

    /* ⭐ THE RECORDS, NOT THEIR COUNTS. Every one of these used to be `.length` and the whole point
       of the rewrite is the detail that was being thrown away on the next line. */
    const cCounts = (inv.ic_counts || []).filter(c => this._inWeek(c.date));
    const cSpot   = App.completedSpotChecks().filter(s => this._inWeek(s.date));
    const cDeliv  = (inv.ic_deliveries || []).filter(d => this._inWeek(d.date));
    const cOrders = (inv.ic_orders || []).filter(o => this._inWeek(o.date));
    const cAdj    = (inv.ic_adjustments || []).filter(a => this._inWeek(a.date_time || a.created_at));
    const cXfer   = (inv.ic_transfers || []).filter(t => this._inWeek(t.date_time || t.created_at));
    const wkOrders = cOrders.length;

    const did = [];
    if (cCounts.length) {
      if (cCounts.length <= this._few()) cCounts.forEach(c => {
        const locs = (c.locations || []).length;
        did.push(this._n(esc(c.type || 'Stock') + ' count') + ' taken' + this._on(c.date) + this._by(c.counted_by)
          + (locs ? ' across ' + locs + ' ' + this._plu(locs, 'location') : '') + '. '
          + (c.item_count || 0) + ' ' + this._plu(c.item_count || 0, 'product') + ', '
          + this._m0(c.total_value) + ' on the shelf.');
      });
      else did.push(this._n(cCounts.length + ' counts') + ' taken, ' + this._m0(cCounts[cCounts.length - 1].total_value)
        + ' on the shelf at the last one' + this._on(cCounts[cCounts.length - 1].date) + '.');
    }
    if (cDeliv.length) {
      const tot = cDeliv.reduce((t, d) => t + (d.total || 0), 0);
      const prices = cDeliv.reduce((t, d) => t + (d.price_change_count || 0), 0);
      const disc = cDeliv.filter(d => d.has_discrepancy).length;
      const vend = this._join([...new Set(cDeliv.map(d => this._nm(d.vendor)).filter(Boolean))].slice(0, this._few()));
      did.push(this._n(cDeliv.length + ' ' + this._plu(cDeliv.length, 'delivery', 'deliveries')) + ' received, '
        + this._m0(tot) + (vend ? ' from ' + vend : '') + '.'
        + (prices ? ' ' + prices + ' price ' + this._plu(prices, 'change') + '.' : '')
        + (disc ? ' ' + disc + ' flagged with a discrepancy.' : ''));
    }
    // Hoisted: the "Ordered" cell in What It Turned Up reads the same total this sentence does, so
    // there is ONE sum and the band and the cell cannot drift apart ([[the-loop]] #54).
    const ordTot = cOrders.reduce((t, o) => t + (o.total || 0), 0);
    if (cOrders.length) {
      /* ⛔ W4: THE PARTS HAVE TO ADD UP TO THE TOTAL BESIDE THEM. `_m0` rounds to whole dollars, so
         two orders of $1,808.50 and $1,209.50 printed as "$1,809" and "$1,210" under a total of
         "$3,018" — parts summing $1 OVER their own total, on the same line. `_amt` shows cents only
         when there are cents, so the arithmetic closes on screen and a whole-dollar week still
         reads clean. The TOTAL uses it too, or the same gap opens from the other side. */
      const each = cOrders.length <= this._few()
        ? ' ' + this._join(cOrders.map(o => this._nm(o.vendor) + ' ' + this._amt(o.total)
            + this._on(o.date) + (String(o.status || '') === 'Open' ? ' and still open' : ''))) + '.'
        : '';
      did.push(this._n(cOrders.length + ' ' + this._plu(cOrders.length, 'order')) + ' placed, ' + this._amt(ordTot) + '.' + each);
    }
    if (cSpot.length) {
      if (cSpot.length <= this._few()) cSpot.forEach(s => {
        const shift = this._nm(s.shift);
        did.push(this._n('1 spot check') + this._on(s.date)
          + (this._nm(s.location) ? ', ' + this._nm(s.location) : '') + (shift ? ', ' + shift.toLowerCase() : '')
          + this._by(s.checked_by) + '. '
          + (s.flagged_count || 0) + ' of ' + (s.product_count || 0) + ' ' + this._plu(s.product_count || 0, 'product')
          + ' flagged' + (s.total_variance_dollar ? ', ' + this._amt(s.total_variance_dollar) + ' out' : '') + '.');
      });
      else {
        const flagged = cSpot.reduce((t, s) => t + (s.flagged_count || 0), 0);
        const varTot = cSpot.reduce((t, s) => t + (s.total_variance_dollar || 0), 0);
        did.push(this._n(cSpot.length + ' spot checks') + ' run, ' + flagged + ' ' + this._plu(flagged, 'product')
          + ' flagged' + (varTot ? ', ' + this._amt(varTot) + ' out' : '') + '.');
      }
    }
    if (cAdj.length) {
      const each = cAdj.length <= this._few()
        ? ' ' + this._join(cAdj.map(a => this._qty(a.quantity, a.unit) + ' ' + this._nm(a.product_name)
            + ' ' + (String(a.direction || '') === 'in' ? 'in' : 'out')
            + (this._nm(a.reason) ? ' (' + this._nm(a.reason).toLowerCase() + ')' : '')
            + this._on(a.date_time) + this._by(a.performed_by))) + '.'
        : '';
      did.push(this._n(cAdj.length + ' ' + this._plu(cAdj.length, 'adjustment')) + ' made.' + each);
    }
    if (cXfer.length) {
      const each = cXfer.length <= this._few()
        ? ' ' + this._join(cXfer.map(t => this._qty(t.quantity, t.unit) + ' ' + this._nm(t.product_name)
            + (this._nm(t.from_location) ? ' from ' + this._nm(t.from_location) : '')
            + (this._nm(t.to_location) ? ' to ' + this._nm(t.to_location) : '')
            + this._on(t.date_time) + this._by(t.performed_by))) + '.'
        : '';
      did.push(this._n(cXfer.length + ' ' + this._plu(cXfer.length, 'transfer')) + ' made.' + each);
    }
    const activity = this._didList(did);
    /* ⛔ OVER TARGET IS NOT A CELL HERE ANY MORE. Kyle, 2026-08-11: *"in the inventory what it turned
       up get rid of the over target stat all together.. it just stays in the carrying into next
       week."* It was the same fact printed twice on one card, once as a number and once as the line
       telling you to do something about it. */
    const results = this._resRow([
      this._res('Used This Period', st.periodCost != null ? App.fmtCurrency(st.periodCost, 0) : '-'),
      this._res('Below Par', App.fmtCurrency(st.reorderTotal, 0), st.reorderCount ? 'var(--amber)' : 'var(--t1)'),
      /* ⛔ SHRINKAGE 30d CAME OFF THIS CARD (Kyle, 2026-08-11: *"get rid of the shrinkage and replace
         it with order placed value"*). It was the clearest case of W3 on the page: a figure headed
         with a finished week that measured the 30 days ending TODAY, so reviewing a week from March
         printed this month's shrinkage. Ordered is the reviewed WEEK's own orders, off the same
         records the band above lists.
         ⚠ NEUTRAL, NO COLOUR. Money committed to stock is not good news or bad news, and colour on
         this card means something ([[dashboard-discipline]]). Below Par is what still needs
         ordering; Ordered is what was ordered — the two read as a pair. */
      this._res('Ordered This Week', App.fmtCurrency(ordTot, 0)),
      this._res('Dead Stock', String(st.deadAll), st.deadAll > 0 ? 'var(--red)' : 'var(--t1)')
    ]);
    /* ⛔ "Variance flags never reviewed this week" is GONE, not un-gated: its only evidence was the
       `review` checkbox, and nothing in the app records that a human looked at a flag. An item with
       no record behind it does not belong on a page whose whole claim is that it reads real logs.
       ⭐ "below par, no order placed" KEPT, re-derived: the order records for the week are right
       here, so the sentence can be proved instead of asserted. */
    const open = [];
    if (st.reorderCount > 0 && wkOrders === 0) open.push({ t: '<b>' + st.reorderCount + '</b> item' + (st.reorderCount === 1 ? '' : 's') + ' below par and no order placed all week', sev: 'red' });
    if (st.deadAll > 0) open.push({ t: '<b>' + st.deadAll + '</b> dead-stock item' + (st.deadAll === 1 ? '' : 's') + ' tying up cash', sev: 'amber' });
    if (st.parOff > 0) open.push({ t: '<b>' + st.parOff + '</b> par' + (st.parOff === 1 ? '' : 's') + ' off versus real usage', sev: 'amber' });
    if (st.menuOver > 0) open.push({ t: '<b>' + st.menuOver + '</b> menu item' + (st.menuOver === 1 ? '' : 's') + ' over cost target', sev: 'amber' });

    // The PDF carries the same sentences the screen shows. Paper and page say one thing.
    (this._pdf || (this._pdf = [])).push({ name: 'Inventory', activity: this._didPlain(did),
      // ⛔ W3: the PDF is the artefact that leaves the building, so it names the basis too.
      results: 'Current stock: Used ' + (st.periodCost != null ? App.fmtCurrency(st.periodCost, 0) : '-') + ', Below Par ' + App.fmtCurrency(st.reorderTotal, 0) + ', Dead Stock ' + st.deadAll + '; Ordered this week ' + App.fmtCurrency(ordTot, 0),
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    /* ⛔ W3: EVERY CELL NAMES ITS OWN BASIS NOW. Three of these four are figures about TODAY —
       `Below Par` is the Order Sheet's plan as it stands, `Dead Stock` is what is tying up cash
       right now, and `Used This Period` is the newest count PAIR, whenever those counts happened.
       Printed under a heading naming a finished week they read as that week's numbers, which is the
       defect this card already removed `Recoverable/yr` and `Shrinkage 30d` for.
       ⭐ THE PAGE ALREADY HAD THE ANSWER: Cash and Events both suffix the band when its figures are
       current state (`· Current Position`, `· Current Pipeline`). Inventory joins them, and the one
       genuinely week-true cell says so in its own label rather than being tarred by the suffix. */
    return this._sectionCard('Inventory', [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up &middot; Current Stock', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Labor ───────────────────────────────────────────────────────────────────
  _laborSection() {
    // No cockpit alias and no absence guard, for the reason written on the Profit card.
    const lab = (App.laborData) || {};
    if (!(lab.lc_staff || []).length || !(lab.lc_actuals || []).length) return null;

    const target = App.laborTargetPct ? App.laborTargetPct() : 29;
    const today = App.todayLocal();
    const cutoff30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return App.ymdLocal(d); })();

    /* ⭐⭐ THE WEEK IS A PARAMETER NOW, NOT A FIELD ON SOMEBODY ELSE'S SCREEN. This is the only one
       of the five borrows that was doing real work: `weekStart` / `weekEnd` / `inWeek` /
       `nextWeekStart` / `weekProjection` all read the Labor cockpit's `_weekStart`, so the page had
       to move that selector to make them answer. The seven store reads underneath were never
       week-aware at all — every one is a one-line `App.laborData.<key>` and they are read straight
       here, the same way this file has always read `App.inventoryData` and `App.data`. */
    const wkStart = this._wkS(), wkEnd = this._wkE();
    const endCap = wkEnd < today ? wkEnd : today;
    const wkActuals = (lab.lc_actuals || []).filter(a => a.date >= wkStart && a.date <= wkEnd);
    const wkHours = wkActuals.reduce((t, a) => t + (a.hours || 0), 0);
    const salCost = (App.salariedCost ? App.salariedCost(wkStart, endCap).total : 0) || 0;
    const otPrem = App.otPremiumForRows ? App.otPremiumForRows(wkActuals).total : 0;   // 0.5x over 40/wk, not stored in a.cost
    const mkPrem = App.tipMakeupForRows ? App.tipMakeupForRows(wkActuals).total : 0;   // tipped-minimum makeup, also not in a.cost
    const wkCost = wkActuals.reduce((t, a) => t + (a.cost || 0), 0) + salCost + otPrem + mkPrem;
    const weekRevenue = ((App.shiftData && App.shiftData.sc_shifts) || [])
      .filter(s => this._inWeek(s.date)).reduce((t, s) => t + (parseFloat(s.total_revenue) || 0), 0);
    const laborPct = weekRevenue > 0 ? (wkCost / weekRevenue * 100) : null;
    const rplh = (wkHours > 0 && weekRevenue > 0) ? (weekRevenue / wkHours) : null;
    const proj = this._weekProjection(wkStart);
    const wkTips = (lab.lc_tips || []).filter(t => this._inWeek(t.date));
    const tipN = wkTips.length;
    const tipTotal = wkTips.reduce((t, r) => t + (r.total_tips || 0), 0);
    const wkPeople = new Set(wkActuals.map(a => a.name).filter(Boolean)).size;
    const wkDays = new Set(wkActuals.filter(a => (a.hours || 0) > 0).map(a => a.date)).size;
    const cOuts = (lab.lc_callouts || []).filter(c => this._inWeek(c.date));
    const calloutN = cOuts.length;
    const calloutUncov = cOuts.filter(c => !c.covered).length;
    const toPending = (lab.lc_time_off || []).filter(t => t.status === 'Requested').length;
    /* ⛔ THE OLD STRIP PRINTED `toPending` UNDER "DONE THIS WEEK", AND IT IS NOT A WEEK FIGURE. It
       counts every request still sitting unanswered, whenever it was made, so a request typed in
       March was being reported as something the crew did last week. The pending count is a real
       fact and it stays in Carrying Into Next Week, where it is true. What belongs in a recap is
       requests RAISED in the week, off `created_at`. */
    const toNew = (lab.lc_time_off || []).filter(t => this._inWeek(t.created_at)).length;
    const activeIds = new Set((lab.lc_staff || []).filter(s => s.status !== 'Inactive').map(s => s.id));
    const expired = (lab.lc_certs || []).filter(c => activeIds.has(c.staff_id) && c.expiration_date && c.expiration_date < today).length;
    const expiring = (lab.lc_certs || []).filter(c => activeIds.has(c.staff_id) && c.expiration_date && c.expiration_date >= today && c.expiration_date <= cutoff30).length;
    const schedBuilt = (lab.lc_schedules || []).some(s => s.week_start === this._addDays(wkStart, 7));

    const otRisk = (proj.over || 0) + (proj.approaching || 0);

    const did = [];
    if (wkHours > 0) did.push(this._n(wkHours.toFixed(1) + ' hours') + ' logged'
      + (wkPeople ? ' across ' + wkPeople + ' ' + this._plu(wkPeople, 'person', 'people') : '')
      + (wkDays ? ' over ' + wkDays + ' ' + this._plu(wkDays, 'day') : '') + ', '
      + this._m0(wkCost) + ' in pay.');
    if (tipN) did.push(this._n(tipN + ' tip ' + this._plu(tipN, 'entry', 'entries')) + ' logged'
      + (tipTotal ? ', ' + this._m0(tipTotal) + ' declared' : '') + '.');
    if (calloutN) {
      const each = calloutN <= this._few()
        ? ' ' + this._join(cOuts.map(c => this._nm(c.name) + this._on(c.date)
            + (this._nm(c.type) ? ', ' + this._nm(c.type).toLowerCase() : '')
            + (c.covered ? (this._nm(c.covered_by) ? ', covered by ' + this._nm(c.covered_by) : ', covered') : ', not covered'))) + '.'
        : ' ' + calloutUncov + ' went uncovered.';
      did.push(this._n(calloutN + ' ' + this._plu(calloutN, 'call-out')) + '.' + each);
    }
    if (toNew) did.push(this._n(toNew + ' time-off ' + this._plu(toNew, 'request')) + ' raised.');
    if (schedBuilt) did.push(this._n('Next week\'s schedule') + ' was built.');
    const activity = this._didList(did);
    const results = this._resRow([
      this._res('Labor Cost', App.fmtCurrency(wkCost, 0)),
      this._res('Labor %', laborPct != null ? laborPct.toFixed(1) + '%' : '-', (laborPct != null && laborPct > target) ? 'var(--amber)' : 'var(--t1)'),
      this._res('Hours', wkHours.toFixed(1)),
      this._res('RPLH', rplh != null ? App.fmtCurrency(rplh) : '-'),
      this._res('OT Risk', String(otRisk), otRisk > 0 ? 'var(--amber)' : 'var(--t1)')
    ]);
    /* ⭐ THE SCHEDULE ITEM ALREADY HAD A DATA HALF, so dropping the tick half cost nothing:
       `schedBuilt` asks the store whether a schedule exists for the week AFTER the one under
       review, which is the actual fact the sentence claims. */
    const open = [];
    if (!schedBuilt) open.push({ t: "Next week's schedule was never built", sev: 'red' });
    if (proj.over > 0) open.push({ t: '<b>' + proj.over + '</b> staff projected over ' + App.OT_THRESHOLD + ' hrs (~' + App.fmtCurrency(proj.otPremium, 0) + ' premium)', sev: 'red' });
    if (calloutUncov > 0) open.push({ t: '<b>' + calloutUncov + '</b> uncovered call-out' + (calloutUncov === 1 ? '' : 's') + ' this week', sev: 'red' });
    if (toPending > 0) open.push({ t: '<b>' + toPending + '</b> time-off request' + (toPending === 1 ? '' : 's') + ' to review', sev: 'amber' });
    if (expired > 0) open.push({ t: '<b>' + expired + '</b> certification' + (expired === 1 ? '' : 's') + ' expired', sev: 'red' });
    if (expiring > 0) open.push({ t: '<b>' + expiring + '</b> certification' + (expiring === 1 ? '' : 's') + ' expiring within 30 days', sev: 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Labor', activity: this._didPlain(did),
      results: 'Labor Cost ' + App.fmtCurrency(wkCost, 0) + ', Labor % ' + (laborPct != null ? laborPct.toFixed(1) + '%' : '-') + ', Hours ' + wkHours.toFixed(1) + ', RPLH ' + (rplh != null ? App.fmtCurrency(rplh) : '-') + ', OT Risk ' + otRisk,
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Labor', [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Shift ───────────────────────────────────────────────────────────────────
  _shiftSection() {
    const sh = (App.shiftData) || {};
    if (!(sh.sc_shifts || []).length) return null;

    /* ⭐⭐ NO COCKPIT AT ALL HERE NOW, AND IT NEEDED NO PARAMETER. The five `SD.*()` calls were pure
       store reads (`sc_shifts`, `sc_void_comps`, `sc_variances`, `sc_waste`, `sc_walked_tabs`) and
       the only week-dependent one was `SD.inWeek`. This page already owns `_inWeek`.
       ⚠ THE ONE THING THAT HAD TO BE PROVED FIRST, because it is not obvious: Shift is SUNDAY
       anchored (`_weekEnd`, then `App.weekStartFor` back to a Monday) and this page is MONDAY
       anchored (`_wkS`, +6 to a Sunday). Swapping one window for the other is only safe if they are
       the SAME window. `verify-week-review-owns-its-week` block W asserts the round trip across
       seventy consecutive days, plus the off-by-one control — [[the-loop]] #54: when two things
       answer one question, pin the EQUALITY, never either side. */
    const wkS = (sh.sc_shifts || []).filter(s => this._inWeek(s.date));
    const rev = wkS.reduce((t, s) => t + (parseFloat(s.total_revenue) || 0), 0);
    const covers = wkS.reduce((t, s) => t + (s.covers || 0), 0);
    const checkAvg = covers > 0 ? rev / covers : null;
    const wkVC = (sh.sc_void_comps || []).filter(r => this._inWeek(r.date));
    const voidTot = wkVC.filter(r => r.type === 'Void').reduce((t, r) => t + (r.amount || 0), 0);
    const compTot = wkVC.filter(r => r.type === 'Comp').reduce((t, r) => t + (r.amount || 0), 0);
    const wkVar = (sh.sc_variances || []).filter(v => this._inWeek(v.date));
    const netVar = wkVar.reduce((t, v) => t + (v.variance || 0), 0);
    const shorts = wkVar.filter(v => v.status === 'Short').length;
    const overs = wkVar.filter(v => v.status === 'Over').length;
    const reconN = wkVar.length;
    const days = wkS.length;
    const vcN = wkVC.length;
    const wasteRows = (sh.sc_waste || []).filter(r => this._inWeek(r.date));
    const walkRows = (sh.sc_walked_tabs || []).filter(r => this._inWeek(r.date));
    const wasteN = wasteRows.length;
    const walkedN = walkRows.length;
    // Named only when one day genuinely beats every other — see `_topOf`.
    const bestDay = this._topOf(wkS, s => parseFloat(s.total_revenue) || 0);
    const worstVar = this._topOf(wkVar.filter(v => (v.variance || 0) < 0), v => -(v.variance || 0))
      || (wkVar.filter(v => (v.variance || 0) < 0).length === 1 ? wkVar.filter(v => (v.variance || 0) < 0)[0] : null);
    const topVC = this._topOf(wkVC, r => r.amount || 0) || (wkVC.length === 1 ? wkVC[0] : null);

    const did = [];
    if (days) did.push(this._n(days + ' ' + this._plu(days, 'day')) + ' of sales logged, ' + this._m0(rev)
      + ' on ' + covers + ' ' + this._plu(covers, 'cover') + '.'
      + (bestDay ? ' Best night' + this._on(bestDay.date) + ', ' + this._m0(bestDay.total_revenue)
          + (bestDay.covers ? ' on ' + bestDay.covers + ' covers' : '') + '.' : ''));
    if (reconN) {
      const clean = reconN - shorts - overs;
      did.push(this._n(reconN + ' drawer ' + this._plu(reconN, 'reconcile')) + ', '
        + (shorts + overs === 0 ? 'all within tolerance.'
           : clean + ' within tolerance, ' + this._join([shorts ? shorts + ' short' : '', overs ? overs + ' over' : ''].filter(Boolean)) + '.')
        + (worstVar ? ' Worst was ' + this._nm(worstVar.drawer) + this._on(worstVar.date) + ', '
            + App.fmtBal(worstVar.variance, 0) + this._by(worstVar.cashier) + '.' : ''));
    }
    /* ⚠ COMPOSED FROM PARTS AND JOINED, NOT CONCATENATED WITH SPACES BUILT IN. The first version
       glued the clauses together with its own separators and printed "Biggest was $120.00  Tue,
       Aug 4." — a DOUBLE SPACE where the blank server dropped out. The pin's own `got=` showed it.
       Every optional clause is a list entry now, so dropping one cannot leave its spacing behind. */
    if (vcN) {
      const bits = topVC ? ['Biggest was ' + this._amt(topVC.amount),
        this._nm(topVC.item) ? 'on ' + this._nm(topVC.item) : '',
        this._nm(topVC.server) ? 'by ' + this._nm(topVC.server) : '',
        this._day(topVC.date)].filter(Boolean) : [];
      did.push(this._n(vcN + ' ' + this._plu(vcN, 'void or comp', 'voids and comps')) + ', ' + this._m0(voidTot + compTot) + '.'
        + (bits.length ? ' ' + bits.join(' ')
            + (this._nm(topVC.reason) ? ' (' + this._nm(topVC.reason).toLowerCase() + ')' : '') + '.' : ''));
    }
    if (wasteN) {
      const cost = wasteRows.reduce((t, r) => t + (r.cost || 0), 0);
      const top = this._topOf(wasteRows, r => r.cost || 0) || (wasteN === 1 ? wasteRows[0] : null);
      did.push(this._n(wasteN + ' waste ' + this._plu(wasteN, 'entry', 'entries')) + (cost ? ', ' + this._m0(cost) : '') + '.'
        + (top && this._nm(top.product_name) ? ' Most of it ' + this._nm(top.product_name)
            + (this._nm(top.reason) ? ' (' + this._nm(top.reason).toLowerCase() + ')' : '') + '.' : ''));
    }
    /* ⚠ NAME THEM OR TOTAL THEM, NEVER BOTH. The first version printed the total AND then named each
       one, so a single walked tab read "1 walked tab, $41. $41 Tue, Aug 4 by Marcus T." — the same
       figure twice in one sentence. At one row the total IS the row. */
    // Permits/licensing is a SHIFT screen now (`sc-licensing`), so its carry-over belongs on this
    // card. Same numbers, read through the tracker's own status rule, just filed under its section.
    const HP = S.HubPermits;
    let permDue = 0, permExpired = 0;
    if (HP && HP._status) {
      ((App.data && App.data.permits_compliance) || []).forEach(r => {
        const s = HP._status(r);
        if (s.key === 'expired' || s.key === 'critical' || s.key === 'warn') { permDue++; if (s.key === 'expired') permExpired++; }
      });
    }
    if (walkedN) {
      const amt = walkRows.reduce((t, r) => t + (r.amount || 0), 0);
      did.push(this._n(walkedN + ' walked ' + this._plu(walkedN, 'tab')) + ', '
        + (walkedN <= this._few()
            ? this._join(walkRows.map(r => this._amt(r.amount) + this._on(r.date) + this._by(r.server)))
            : this._m0(amt)) + '.');
    }
    const activity = this._didList(did);
    const results = this._resRow([
      this._res('Net Sales', App.fmtCurrency(rev, 0)),
      this._res('Covers', String(covers)),
      this._res('Check Avg', checkAvg != null ? App.fmtCurrency(checkAvg) : '-'),
      /* ⛔⛔⛔ A WEEK NOBODY COUNTED A DRAWER IN MUST NEVER READ "$0.00 OVER/SHORT". `netVar` is a
         bare reduce over the week's variance records, so zero records reduce to 0 — and 0 printed
         in neutral is indistinguishable from a genuinely square week. That is the invariant
         `verify-uncounted-drawer-week` was written for, and it was pinned only to the Shift
         cockpit's `whereYouStand`; THIS page replaced that surface and never inherited the guard
         ([[lessons-paid-for]] #9 — a fix written into one page's render does not exist for the
         second). `reconN` was already computed two lines up and read by nothing here.
         ⚠ AND THE SIGN COMES OFF THE ROUNDED VALUE, not the raw one. `App.fmtBal(x, 0)` rounds to
         whole dollars, so a raw -0.004 prints "$0.00" while `netVar < 0` paints it red — a figure
         that says nothing is wrong in the colour that says something is. The cockpit's twin uses
         `fmtSigned(...).sign` for exactly this reason; both readings now agree. */
      this._res('Over / Short',
        reconN ? (App.fmtSigned(netVar, 0).sign > 0 ? '+' : '') + App.fmtBal(netVar, 0) : 'Not counted',
        reconN ? (App.fmtSigned(netVar, 0).sign < 0 ? 'var(--red)' : 'var(--t1)') : 'var(--t3)'),
      this._res('Voids + Comps', App.fmtCurrency(voidTot + compTot, 0))
    ]);
    /* ⛔ "Loss flags never reviewed this week" is GONE — its only evidence was the `review` tick.
       ⭐ "Cash not reconciled" KEPT, on its data half alone, plus the guard the tick used to supply
       by accident: a week the bar never traded has nothing to reconcile, and accusing it of a
       missed reconcile is the same false accusation in a new costume. */
    const open = [];
    if (shorts > 0) open.push({ t: '<b>' + shorts + '</b> cash-short shift' + (shorts === 1 ? '' : 's') + ' to chase', sev: 'red' });
    if (days > 0 && reconN === 0) open.push({ t: 'Cash was never reconciled this week', sev: 'amber' });
    if (walkedN > 0) open.push({ t: '<b>' + walkedN + '</b> walked tab' + (walkedN === 1 ? '' : 's') + ' this week', sev: 'amber' });
    if (permDue > 0) open.push({ t: '<b>' + permDue + '</b> permit/license item' + (permDue === 1 ? '' : 's') + ' need attention', sev: permExpired > 0 ? 'red' : 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Shift', activity: this._didPlain(did),
      // ⚠ THE PDF SAYS WHAT THE SCREEN SAYS. Same guard, same rounded sign — this line is the one
      // that gets handed to somebody, so a "$0.00" here for an uncounted week is the same lie in a
      // document ([[the-loop]] #54: the moment a quantity is printed twice, the test is that they agree).
      results: 'Net Sales ' + App.fmtCurrency(rev, 0) + ', Covers ' + covers + ', Check Avg ' + (checkAvg != null ? App.fmtCurrency(checkAvg) : '-') + ', Over/Short ' + (reconN ? (App.fmtSigned(netVar, 0).sign > 0 ? '+' : '') + App.fmtBal(netVar, 0) : 'Not counted') + ', Voids+Comps ' + App.fmtCurrency(voidTot + compTot, 0),
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Shift', [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  /* ── The six inventory figures this card prints ───────────────────────────────────────────────
     ⭐ THESE ARE THE SIX, AND ONLY THE SIX, THAT THE CARD READS. `computeState()` on the cockpit
     built 27 fields for a page that draws four cells and four warning lines; the other twenty-one
     are the cockpit's own steps and strips and die with it.
     ⭐⭐ AND NONE OF THE REAL WORK MOVED HERE — every figure was already delegating to something
     that survives 1c, which is why this is short:
       periodCost / deadAll  ->  App.computeUsagePair + App._perpetualInventory + App.unitCost
       reorderTotal / Count  ->  S.InventoryOrderSheet.belowParByVendor()  (the Order Sheet's ONE
                                 plan, so the cockpit, the Order Sheet and the cash forecast cannot
                                 disagree about what to buy)
       parOff                ->  S.InventoryParSuggestions.computeSuggestion
       menuOver              ->  App.menuItemsOverTarget()
     ⛔ `shrink` WAS THE SEVENTH AND IT IS GONE (Kyle, 2026-08-11). It was a 30-day window ending
     TODAY, printed under a heading naming a finished week, so a March review showed this month's
     shrinkage. The cell is the reviewed week's own order value now. It also carried the only
     hand-rolled day offset this file had, so `verify-window-cutoff`'s baseline for this file went
     back to zero with it.
     ⚠⚠ THE REST ARE STILL NUMBERS ABOUT TODAY UNDER A FINISHED WEEK'S HEADING. `periodCost` is the
     newest count PAIR, `reorderTotal` / `deadAll` / `parOff` / `menuOver` are all as-of-now. That is
     preserved here exactly as it shipped rather than quietly corrected, and it is still open as W3 —
     a product call, not a refactor. */
  _inventoryFigures() {
    const inv = (App.inventoryData) || {};
    // `productById` lived here only to feed the hand-rolled dead-stock loop; that
    // loop is now `CashEngine.trapped()`, which resolves its own products.
    const asc = [...(inv.ic_counts || [])].sort(App.cmpOldest);
    const latest = asc.length ? asc[asc.length - 1] : null;
    const prev = asc.length >= 2 ? asc[asc.length - 2] : null;

    // One usage pair feeds both periodCost and deadAll, exactly as the cockpit did it.
    const base = (latest && prev) ? App.computeUsagePair(prev, latest, inv.ic_deliveries || []) : null;
    const periodCost = base
      ? Object.values(base).reduce((s, b) => s + (b.unitCost != null ? Math.max(0, b.rawUsed) * b.unitCost : 0), 0)
      : null;

    /* ⛔ ONE DOOR FOR DEAD STOCK, exactly as the note below says for below par
       (2026-08-18, T11). This was a hand-rolled second copy of `CashEngine.trapped()`'s
       dead-stock test and the two had ALREADY drifted before anything was changed
       today: this loop read `base[pid] ? … : 0`, so a product with NO usage record at
       all scored `used = 0` and counted as dead, while `trapped()` requires a real
       usage reading (`used !== null`) — which is what this app's own help promises,
       that a product with only one count has no history to call dead on. T11 would
       have widened the gap a second way, because `trapped()` now measures POSITION
       (counted plus receipts that have settled) and this copy read the count alone.
       Same question, same moment, so it has to be the same answer: the header two
       paragraphs down already lists `deadAll` as an as-of-now figure ([[the-loop]]
       #54 — the moment a number appears on two screens, the test is the AGREEMENT).
       ⚠ BARE, like `CashEngine.bills()` and for the same reason: a guarded fallback
       would print "0 dead-stock items" if the engine were missing, and a silent zero
       on this cell reads as "nothing is tying up cash", which is the opposite of the
       truth ([[the-loop]] #40). `cash-engine.js` is a plain script tag and this runs
       on render, not at load. */
    const deadAll = CashEngine.trapped().items.filter(it => it.kind === 'dead').length;

    /* ⛔ ONE DOOR FOR BELOW PAR. This is the Order Sheet's own plan, never a second below-par loop:
       the cockpit once carried its own copy and the two drifted twice (a vendor already received
       still showing below par, and a hidden product counted here but not there). */
    let reorderTotal = 0, reorderCount = 0;
    const _os = window.S && S.InventoryOrderSheet;
    const _plan = (_os && _os.belowParByVendor) ? _os.belowParByVendor() : null;
    if (_plan && _plan.groups) {
      Object.keys(_plan.groups).forEach(v => (_plan.groups[v] || []).forEach(l => {
        reorderTotal += (l.suggested || 0) * (l.unit_cost || 0);
        reorderCount++;
      }));
    }

    /* Pars that are off versus real usage. Gated on a SECOND count for the same reason the cockpit
       gated it: with one count there is no usage period to judge a par against. */
    let parOff = 0;
    const PS = window.S && S.InventoryParSuggestions;
    if (prev && latest && PS && PS.settings && PS.computeSuggestion) {
      const settings = PS.settings();
      let withPar = 0, tuned = 0;
      (inv.ic_products || []).filter(p => p.active !== false).forEach(p => {
        if (p.par_level == null || p.par_level === '') return;
        const sug = PS.computeSuggestion(p, settings, latest.date);
        if (!sug || sug.suggested == null) return;
        withPar++;
        const cur = Math.round(parseFloat(p.par_level) || 0);
        const diff = Math.abs(sug.suggested - cur);
        if (!(diff >= 1 && diff >= cur * 0.25)) tuned++;
      });
      parOff = withPar - tuned;
    }

    return { periodCost, reorderTotal, reorderCount, deadAll, parOff,
             menuOver: App.menuItemsOverTarget().length };
  },

  /* ── Per-staff overtime projection for the reviewed week ──────────────────────────────────────
     Hours already WORKED plus hours still SCHEDULED on days not yet worked. Same basis as Overtime
     Watch, which this used to claim to match while actually running max(actual, scheduled) — the
     basis Overtime Watch abandoned because it misses anyone already logging extra who still has
     shifts to come.
     ⭐ MOVED OFF THE LABOR COCKPIT, AND THE WEEK IS THE ONE THING THAT CHANGED. It used to read
     `this.weekStart()` / `this.weekEnd()`, which is why this page had to move that screen's
     selector to call it. It takes the Monday now, so nothing has to be mutated to ask it a
     question. Every line below is otherwise the cockpit's own.
     ⚠ NOTE, so nobody re-derives it: newest wins when a week somehow carries more than one
     schedule, matching Overtime Watch, Log Hours, Pay Periods and the Call-Out Log. Rebuilding a
     week does NOT strand a superseded record — Build Schedule replaces in place and loadWeek edits
     the existing one — so this covers two managers posting the same week from different devices
     before a sync. cmpNewest resolves it through its created_at tiebreak. */
  _weekProjection(wkStart) {
    const wkEnd = this._addDays(wkStart, 6);
    const lab = (App.laborData) || {};
    const curWeek = (lab.lc_actuals || []).filter(a => a.date >= wkStart && a.date <= wkEnd);
    const sched = (lab.lc_schedules || []).filter(s => s.week_start === wkStart).sort(App.cmpNewest)[0] || null;
    const proj = {};
    const ensure = (id, name) => { if (!proj[id]) proj[id] = { id, name: name || '-', actual: 0, scheduled: 0 }; return proj[id]; };
    const DAYS = App.DAYS_MON_FIRST || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    curWeek.forEach(a => {
      if (App.isSalaried(a.staff_id)) return;
      const e = ensure(a.staff_id || a.name, a.name);
      e.actual += (a.hours || 0);
      (e.workedDays = e.workedDays || {})[a.date] = true;   // this day is already logged
    });
    if (sched) (sched.shifts || []).forEach(sh => {
      if (App.isSalaried(sh.staff_id)) return;
      const e = ensure(sh.staff_id || sh.name, sh.name);
      e.scheduled += (sh.hours || 0);
      // wkStart is a Monday and DAYS is Monday-first, so the index is the day offset.
      const di = DAYS.indexOf(sh.day);
      const dt = di >= 0 ? this._addDays(wkStart, di) : null;
      if (dt) (e.schedByDate = e.schedByDate || {})[dt] = (e.schedByDate[dt] || 0) + (sh.hours || 0);
    });
    let over = 0, approaching = 0, otPremium = 0;
    Object.values(proj).forEach(e => {
      const remainingSched = Object.keys(e.schedByDate || {}).reduce((t, d) =>
        t + ((e.workedDays && e.workedDays[d]) ? 0 : e.schedByDate[d]), 0);
      const projected = e.actual + remainingSched;
      const wage = App.wageForStaffOn ? (App.wageForStaffOn(e.id, wkStart) || 0) : 0;
      const otHours = Math.max(0, projected - App.OT_THRESHOLD);
      otPremium += otHours * wage * 0.5;
      if (projected > App.OT_THRESHOLD) over++;
      else if (projected >= App.OT_APPROACHING) approaching++;
    });
    return { over, approaching, otPremium };
  },

  /* ── The four reads that used to live on the Profit and Revenue cockpits ──────────────────────
     ⭐ MOVED, NOT REWRITTEN. Every body below is the cockpit's own, byte for byte, with one change:
     the `this.targets()` / `this.weeks()` one-liners are folded in as literals rather than moved
     as members of their own, because nothing else here reads them ([[the-loop]] #120 — a constant
     only its own member reads goes inside it).
     ⚠ THIS IS NOT A SECOND IMPLEMENTATION. Week in Review was the ONLY surviving consumer of all
     four; the cockpits that declared them are deleted at 1c. A copy would be drift, a move is not. */
  _savedProfitWeek(pe) { return ((App.data && App.data.weeks) || []).find(w => w.period_end === pe) || null; },
  _savedRevenueWeek(pe) {
    return ((App.data && App.data.revenue_weeks) || [])
      .find(w => w.period_end === pe && ((w.bar_revenue || 0) + (w.floor_revenue || 0)) > 0) || null;
  },
  // The pour/food/prime cost rows for a saved week, each vs its own target.
  _costRows(w) {
    const t = (App.data && App.data.settings && App.data.settings.targets) || {};
    const mk = (label, val, tgt) => ({ label, val, tgt, over: (val != null && val > tgt) });
    return [
      mk('Bar Pour Cost', (w.bar && w.bar.cost_pct != null) ? w.bar.cost_pct : null, t.bar_pour_cost_pct || 22),
      mk('Food Cost',     (w.food && w.food.cost_pct != null) ? w.food.cost_pct : null, t.food_cost_pct || 32),
      mk('Prime Cost',    (w.prime_cost_pct != null) ? w.prime_cost_pct : null,         t.prime_cost_pct || 60)
    ];
  },
  // Check average, labor %, and revenue per labor hour for a week, each vs its
  // target. good = hitting it (check avg + rplh higher is better; labor % lower).
  _metricsRows(w) {
    const t = (App.data && App.data.revenue_settings && App.data.revenue_settings.targets) || {};
    const tCA = t.check_avg != null ? t.check_avg : 35;
    const tLP = App.laborTargetPct ? App.laborTargetPct() : 30;
    const tR  = t.rplh;
    return [
      { label: 'Check Average', value: w.check_avg != null ? App.fmtCurrency(w.check_avg) : '-', sub: 'target ' + App.fmtCurrency(tCA), good: w.check_avg != null ? (w.check_avg >= tCA) : null },
      { label: 'Labor %', value: w.labor_pct_blended != null ? w.labor_pct_blended.toFixed(1) + '%' : '-', sub: 'target ' + tLP.toFixed(1) + '%', good: w.labor_pct_blended != null ? (w.labor_pct_blended <= tLP) : null },
      { label: 'Revenue / Labor Hour', value: w.rplh_blended != null ? App.fmtCurrency(w.rplh_blended) : '-', sub: tR ? 'target ' + App.fmtCurrency(tR) : 'this week', good: (w.rplh_blended != null && tR) ? (w.rplh_blended >= tR) : null }
    ];
  },

  // ── Profit (Recovery) ───────────────────────────────────────────────────────
  _profitSection() {
    /* ⛔ NO `S.Dashboard` ALIAS AND NO `if (!PD) return ''` GUARD ANY MORE. That guard blanked the
       whole card whenever the Profit cockpit file was absent, and after 1c it is absent forever, so
       keeping it would have retired this card silently. Nothing here needs that file: `savedWeek`
       and `_costRows` were already taking everything they use as arguments. */
    if (!((App.data && App.data.weeks) || []).length && !((App.data && App.data.audits) || []).length) return null;

    /* ⛔ TWO CURRENT-STATE FIGURES CAME OFF THIS CARD IN THE SAME EDIT, for one reason written
       here in the file already: a number about today does not belong under a past week's heading.
         · `Recoverable/yr` was gated on "is this the current week", which this page can no longer
           be, so the cell could only ever print a dash — a dead gate is not a safe gate.
         · "Biggest leak not worked" was that same class PLUS a tick: `_topLeak` ranks
           `Recovery.gapImpact` as it stands TODAY, and `!done.leaks` was the checkbox.
       The Hub is the page that answers "what should I work on now"; this one answers "what did that
       week do". */
    /* ⭐⭐ THE BORROW IS GONE, AND IT WAS DEAD CODE. This block used to save the Profit cockpit's
       `_weekEnd`, overwrite it with the reviewed week, call two members and put it back. MEASURED:
       nothing inside the try block ever read that field. `savedWeek(pe)` takes the period_end as an
       argument and `_costRows(w)` takes the week RECORD, so the whole save-set-restore moved a
       value nothing consulted. A page that reads data has no business writing another screen's
       state, and a `finally` is not a guarantee — anything throwing between the two lines leaves
       that screen parked on a week its own operator never chose. */
    const w = this._savedProfitWeek(this._wkE());
    const costRows = w ? this._costRows(w) : null;
    const overCount = costRows ? costRows.filter(r => r.over).length : 0;

    // Real recovery activity logged this week (records dated in the window).
    const dat = App.data || {};
    const audWk     = (dat.audits || []).filter(a => this._inWeek((a.date || a.generated_at || '').slice(0, 10)));
    const revWk     = (dat.sales_reviews || []).filter(r => this._inWeek(r.date || r.created_at));
    const discWkR   = (dat.vendor_discrepancies || []).filter(d => this._inWeek(d.date || d.filed_at || d.created_at));
    const investWkR = (dat.variance_investigations || []).filter(i => this._inWeek(i.opened_date || i.date));
    const auditsWk = audWk.length;
    /* ⛔ SAME DEFECT AS LABOR'S TIME-OFF COUNT: `status === 'Active'` is a fact about TODAY, and it
       was printed under "Done This Week". An experiment started in June was being reported as this
       week's work. A recap counts what STARTED in the week; the running total is current state and
       belongs on the Hub, which is the page that answers "what now". */
    const expNew = (dat.profit_initiatives || []).filter(e => this._inWeek(e.start_date || e.created_at));

    const did = [];
    audWk.forEach(a => did.push(this._n('Profit audit') + ' run' + this._on(a.date || (a.generated_at || '').slice(0, 10))
      + (a.overall_score != null ? ', scored ' + a.overall_score : '') + '.'
      + ((a.action_items || []).length ? ' ' + a.action_items.length + ' action '
          + this._plu(a.action_items.length, 'item') + ' worth '
          + this._m0((a.action_items || []).reduce((s, x) => s + (x.monthly_impact || 0), 0) * 12) + '/yr.' : '')));
    revWk.forEach(r => {
      const s = r.summary || {};
      did.push(this._n('Sales review') + ' filed' + this._on(r.date || r.created_at) + '.'
        + (s.reviewed ? ' ' + s.reviewed + ' ' + this._plu(s.reviewed, 'server') + ' checked, '
            + (s.flagged || 0) + ' flagged' + (s.high ? ', ' + s.high + ' high risk' : '')
            + (s.exposure ? ', ' + this._amt(s.exposure) + ' exposed' : '') + '.' : ''));
    });
    if (discWkR.length) {
      const over = discWkR.reduce((t, d) => t + (d.overcharge || 0), 0);
      did.push(this._n(discWkR.length + ' vendor ' + this._plu(discWkR.length, 'discrepancy', 'discrepancies')) + ' filed'
        + (over ? ', ' + this._m0(over) + ' overcharged' : '') + '.');
    }
    if (investWkR.length) did.push(this._n(investWkR.length + ' variance ' + this._plu(investWkR.length, 'investigation')) + ' opened.');
    if (expNew.length) did.push(this._n(expNew.length + ' ' + this._plu(expNew.length, 'experiment')) + ' started'
      + (expNew.length <= this._few() ? ': ' + this._join(expNew.map(e => this._nm(e.name))) : '') + '.');
    const activity = this._didList(did);
    const costCell = (i, label) => {
      const r = costRows ? costRows[i] : null;
      const has = r && r.val != null;
      return this._res(label, has ? r.val.toFixed(1) + '%' : '-', has ? (r.over ? 'var(--red)' : 'var(--green)') : 'var(--t1)');
    };
    const results = this._resRow([
      costCell(0, 'Bar Pour'), costCell(1, 'Food Cost'), costCell(2, 'Prime Cost')
    ]);

    /* ⭐ "the week was never confirmed" IS THE ONE DERIVED FACT IN THE WHOLE STEP SET, and it
       survives — asked straight of the record now (`!w`) instead of through `stepDone`, which was
       only ever passing this same answer through. Nothing was lost by cutting the ticks. */
    const ag = this._auditGap(dat.audits);
    const open = [];
    if (!w) open.push({ t: 'This week was never confirmed, so its cost numbers stayed blank', sev: 'red' });
    if (w && overCount > 0) {
      const names = costRows.filter(r => r.over).map(r => r.label.toLowerCase());
      open.push({ t: '<b>' + overCount + '</b> of 3 costs over target (' + names.join(', ') + ')', sev: overCount >= 2 ? 'red' : 'amber' });
    }
    if (!ag.ever) open.push({ t: 'No Profit audit had been run by the end of this week', sev: 'amber' });
    else if (ag.stale) open.push({ t: 'Profit audit was <b>' + ag.days + '</b> days old when this week closed', sev: 'amber' });

    const pcv = i => (costRows && costRows[i] && costRows[i].val != null) ? (costRows[i].val.toFixed(1) + '%') : '-';
    (this._pdf || (this._pdf = [])).push({ name: 'Profit', activity: this._didPlain(did),
      results: 'Bar Pour ' + pcv(0) + ', Food ' + pcv(1) + ', Prime ' + pcv(2),
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Profit', [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Revenue (Recovery) ──────────────────────────────────────────────────────
  _revenueSection() {
    // No cockpit alias and no absence guard, for the reason written on the Profit card.
    if (!((App.data && App.data.revenue_weeks) || []).length && !((App.data && App.data.revenue_audits) || []).length) return null;

    // Same two current-state figures came off this card as off Profit's — see the note there.
    // The borrow here was dead in the same way: neither member ever read `_weekEnd`.
    const w = this._savedRevenueWeek(this._wkE());
    const metrics = this._metricsRows(w || {});
    const offCount = metrics.filter(m => m.good === false).length;

    const dat = App.data || {};
    const audWk   = (dat.revenue_audits || []).filter(a => this._inWeek((a.date || a.generated_at || '').slice(0, 10)));
    const priceWkR = (dat.revenue_price_log || []).filter(p => this._inWeek(p.date || p.created_at || p.changed_at));
    const dogWkR   = (dat.menu_dog_tests || []).filter(t => this._inWeek(t.start_date || t.created_at));
    const checkWkR = (dat.revenue_server_checks || []).filter(c => this._inWeek(c.date || c.created_at));
    const auditsWk = audWk.length;
    // Started in the week, not running today — see the note on the Profit card.
    const expNew = (dat.initiatives || []).filter(e => this._inWeek(e.start_date || e.created_at));

    const did = [];
    audWk.forEach(a => did.push(this._n('Revenue audit') + ' run' + this._on(a.date || (a.generated_at || '').slice(0, 10))
      + (a.overall_score != null ? ', scored ' + a.overall_score : '') + '.'));
    if (priceWkR.length) {
      const each = priceWkR.length <= this._few()
        ? ' ' + this._join(priceWkR.map(p => this._nm(p.item_name)
            + (p.old_price != null && p.new_price != null ? ' ' + this._amt(p.old_price) + ' to ' + this._amt(p.new_price) : ''))) + '.'
        : '';
      did.push(this._n(priceWkR.length + ' price ' + this._plu(priceWkR.length, 'change')) + ' made.' + each);
    }
    if (dogWkR.length) did.push(this._n(dogWkR.length + ' dog ' + this._plu(dogWkR.length, 'test')) + ' started'
      + (dogWkR.length <= this._few() ? ' on ' + this._join(dogWkR.map(t => this._nm(t.item_name))) : '') + '.');
    if (checkWkR.length) {
      const sales = checkWkR.reduce((t, c) => t + (c.sales || 0), 0);
      const covs = checkWkR.reduce((t, c) => t + (c.covers || 0), 0);
      const who = [...new Set(checkWkR.map(c => this._nm(c.server_name)).filter(Boolean))];
      did.push(this._n(checkWkR.length + ' server ' + this._plu(checkWkR.length, 'check')) + ' run'
        + this._on(checkWkR[0].date) + '.'
        + (who.length && who.length <= this._few() ? ' ' + this._join(who) + '.' : '')
        + (sales ? ' ' + this._m0(sales) + ' across ' + covs + ' ' + this._plu(covs, 'cover') + '.' : ''));
    }
    if (expNew.length) did.push(this._n(expNew.length + ' ' + this._plu(expNew.length, 'experiment')) + ' started'
      + (expNew.length <= this._few() ? ': ' + this._join(expNew.map(e => this._nm(e.name))) : '') + '.');
    const activity = this._didList(did);
    const mCell = (i, label) => {
      const m = metrics[i];
      const col = (m && m.good != null) ? (m.good ? 'var(--green)' : 'var(--red)') : 'var(--t1)';
      return this._res(label, m ? m.value : '-', col);
    };
    const results = this._resRow([
      mCell(0, 'Check Avg'), mCell(1, 'Labor %'), mCell(2, 'Rev / Labor Hr')
    ]);

    const ag = this._auditGap(dat.revenue_audits);
    const open = [];
    if (!w) open.push({ t: 'This week was never confirmed, so its numbers stayed blank', sev: 'red' });
    if (w && offCount > 0) {
      const names = metrics.filter(m => m.good === false).map(m => m.label.toLowerCase());
      open.push({ t: '<b>' + offCount + '</b> off target (' + names.join(', ') + ')', sev: offCount >= 2 ? 'red' : 'amber' });
    }
    if (!ag.ever) open.push({ t: 'No Revenue audit had been run by the end of this week', sev: 'amber' });
    else if (ag.stale) open.push({ t: 'Revenue audit was <b>' + ag.days + '</b> days old when this week closed', sev: 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Revenue', activity: this._didPlain(did),
      results: 'Check Avg ' + metrics[0].value + ', Labor % ' + metrics[1].value + ', Rev/Labor Hr ' + metrics[2].value,
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Revenue', [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Cash (Recovery; numbers are a live position, not per-week) ──────────────
  /* ⭐⭐ THE ONLY SECTION THAT NOW READS NOTHING FROM A DYING COCKPIT. `S.CashDashboard` was here for
     one reason — `stepDone()` — so cutting the ticks cut the dependency with it. The other five
     module sections still read their cockpit for real DATA (`ID.computeState`, `LD.actuals`,
     `SD.shifts`, `PD.savedWeek`/`_costRows`, `RD.metricsRows`), which is the extraction 1c still
     needs and is tracked as its own piece of work. */
  _cashSection() {
    if (!window.CashEngine) return '';
    const trapped = CashEngine.trapped ? CashEngine.trapped() : { hasData: false };
    const sf = CashEngine.survivalForecast ? CashEngine.survivalForecast(13) : { hasData: false };
    const pos = CashEngine.position ? CashEngine.position() : { hasOpening: false };
    if (!trapped.hasData && !sf.hasData) return null;

    const dat = App.data || {};
    const audWk = (dat.cash_audits || []).filter(a => this._inWeek((a.date || a.generated_at || '').slice(0, 10)));
    const auditsWk = audWk.length;
    // Started in the week, not running today — see the note on the Profit card.
    const expNew = (dat.cash_initiatives || []).filter(e => this._inWeek(e.start_date || e.created_at));
    const outWk = (CashEngine.cashOutflows() || []).filter(o => this._inWeek(o.date || o.created_at));

    const runwayLabel = r => r == null ? '13+ wks' : r === 0 ? 'This wk' : r + ' wk' + (r === 1 ? '' : 's');

    const did = [];
    audWk.forEach(a => did.push(this._n('Cash audit') + ' run' + this._on(a.date || (a.generated_at || '').slice(0, 10))
      + (a.overall_score != null ? ', scored ' + a.overall_score : '') + '.'));
    if (outWk.length) did.push(this._n(outWk.length + ' cash ' + this._plu(outWk.length, 'outflow')) + ' logged, '
      + this._m0(outWk.reduce((t, o) => t + (Number(o.amount) || 0), 0)) + '.');
    if (expNew.length) did.push(this._n(expNew.length + ' ' + this._plu(expNew.length, 'experiment')) + ' started'
      + (expNew.length <= this._few() ? ': ' + this._join(expNew.map(e => this._nm(e.name))) : '') + '.');
    const activity = this._didList(did);
    const results = this._resRow([
      this._res('Trapped Cash', trapped.hasData ? App.fmtCurrency(trapped.total, 0) : '-', (trapped.hasData && trapped.total > 0) ? 'var(--amber)' : 'var(--t1)'),
      this._res('Runway', (sf.hasData && sf.hasOpening) ? runwayLabel(sf.runway) : '-', (sf.hasOpening && sf.runway != null) ? 'var(--red)' : 'var(--t1)'),
      this._res('Safe to Spend', pos.hasOpening ? App.fmtBal(pos.safe, 0) : '-', (pos.hasOpening && pos.safe < 0) ? 'var(--red)' : 'var(--t1)'),
      this._res('Tightest Week', (sf.hasData && sf.lowPoint) ? App.fmtBal(sf.lowPoint.balance, 0) : '-', (sf.lowPoint && sf.lowPoint.balance < 0) ? 'var(--red)' : 'var(--t1)')
    ]);

    const ag = this._auditGap(dat.cash_audits);
    const open = [];
    if (trapped.hasData && trapped.total > 0) open.push({ t: '<b>' + App.fmtCurrency(trapped.total, 0) + '</b> still trapped on the shelf', sev: 'amber' });
    if (sf.hasOpening && sf.runway != null && sf.runway <= 4) open.push({ t: 'Cash runs thin, about ' + runwayLabel(sf.runway) + ' of runway', sev: 'red' });
    else if (sf.hasData && sf.tightWeeks > 0) open.push({ t: '<b>' + sf.tightWeeks + '</b> tight week' + (sf.tightWeeks === 1 ? '' : 's') + ' in the next 13', sev: 'amber' });
    if (pos.hasOpening && pos.safe != null && pos.safe < 0) open.push({ t: 'Safe-to-spend is negative, into money already spoken for', sev: 'red' });
    if (!ag.ever) open.push({ t: 'No Cash audit had been run by the end of this week', sev: 'amber' });
    else if (ag.stale) open.push({ t: 'Cash audit was <b>' + ag.days + '</b> days old when this week closed', sev: 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Cash', activity: this._didPlain(did),
      results: 'Current position: Trapped Cash ' + (trapped.hasData ? App.fmtCurrency(trapped.total, 0) : '-') + ', Runway ' + ((sf.hasData && sf.hasOpening) ? runwayLabel(sf.runway) : '-') + ', Safe to Spend ' + (pos.hasOpening ? App.fmtBal(pos.safe, 0) : '-') + ', Tightest Week ' + ((sf.hasData && sf.lowPoint) ? App.fmtBal(sf.lowPoint.balance, 0) : '-'),
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Cash', [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up &middot; Current Position', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Events (pipeline, not a weekly close) ───────────────────────────────────
  _eventsSection() {
    /* ⛔ `S.EventsBookings`, NOT the deleted `S.EventsDashboard` (2026-08-12). This guard is the
       reason the deletion had to be measured rather than swept: it returns '' rather than throwing,
       so pointing it at a screen that no longer exists would have removed this whole section from
       the week recap **silently** — no error, no empty state, just a recap that stops mentioning
       Events. `_computeState` and `_money` moved to Bookings, which is where their data already
       lived. */
    const ED = S.EventsBookings;
    if (!ED) return '';
    if (!((App.data && App.data.bookings) || []).length) return null;

    // Events' `stepInfo(...).done` was an ACK plus a pending list, so it was a tick too.
    let st;
    try { st = ED._computeState(); } catch (e) { return null; }

    const bookings = (App.data && App.data.bookings) || [];
    const newBook = bookings.filter(b => this._inWeek(b.date_received));
    const held    = bookings.filter(b => this._inWeek(b.event_date) && (b.stage === 'Booked' || b.stage === 'Completed'));
    const depColl = bookings.filter(b => this._inWeek(b.deposit_paid_date));

    const did = [];
    if (newBook.length) {
      // `quoted_total` is 0 on two of the seed's three new bookings, so the money clause is optional.
      const each = newBook.length <= this._few()
        ? ' ' + this._join(newBook.map(b => this._nm(b.event_name)
            + (this._nm(b.contact_name) ? ' for ' + this._nm(b.contact_name) : '')
            + this._on(b.event_date)
            + (b.party_size ? ', ' + b.party_size + ' people' : '')
            + (b.quoted_total ? ', ' + this._m0(b.quoted_total) + ' quoted' : ''))) + '.'
        : '';
      did.push(this._n(newBook.length + ' new ' + this._plu(newBook.length, 'booking')) + ' taken.' + each);
    }
    if (held.length) {
      const rev = held.reduce((t, b) => t + (Number(b.actual_revenue) || 0), 0);
      const each = held.length <= this._few()
        ? ' ' + this._join(held.map(b => this._nm(b.event_name) + this._on(b.event_date)
            + (b.actual_revenue ? ', ' + this._m0(b.actual_revenue) : ''))) + '.'
        : '';
      did.push(this._n(held.length + ' ' + this._plu(held.length, 'event')) + ' held'
        + (rev ? ', ' + this._m0(rev) + ' in' : '') + '.' + each);
    }
    if (depColl.length) did.push(this._n(depColl.length + ' ' + this._plu(depColl.length, 'deposit')) + ' collected, '
      + this._m0(depColl.reduce((t, b) => t + (Number(b.deposit_amount) || 0), 0)) + '.');
    const activity = this._didList(did);
    const results = this._resRow([
      this._res('Booked', ED._money(st.bookedRev)),
      this._res('Pipeline', ED._money(st.pipeline)),
      this._res('Deposits Due', ED._money(st.depositsDue), st.depositsDue > 0 ? 'var(--amber)' : 'var(--t1)'),
      /* ⛔ THE WINDOW IS DISCLOSED HERE BECAUSE THIS IS WHERE THE OPERATOR NOW READS THE NUMBER.
         The Events dashboard labelled it "Win Rate, 90d"; deleting that screen (2026-08-12) left the
         figure showing on this page under a bare "Win Rate", i.e. a 90-day rate with nothing saying
         so. `verify-copy-numbers-match-code` caught it, which is exactly the rule that pin exists
         for: a displayed window has to be quoted in the copy the operator reads, not in the file
         that happens to compute it. */
      this._res('Win Rate, 90d', st.conv)
    ]);

    const open = [];
    if (st.open.length) open.push({ t: '<b>' + st.open.length + '</b> open lead' + (st.open.length === 1 ? '' : 's') + ' to follow up', sev: st.stale.length ? 'red' : 'amber' });
    if (st.depositsDue > 0) open.push({ t: '<b>' + ED._money(st.depositsDue) + '</b> in deposits still due', sev: 'amber' });
    if (st.noRunSheet.length) open.push({ t: '<b>' + st.noRunSheet.length + '</b> upcoming event' + (st.noRunSheet.length === 1 ? '' : 's') + ' need a run sheet', sev: 'amber' });
    if (st.completedOpen.length) open.push({ t: '<b>' + st.completedOpen.length + '</b> completed event' + (st.completedOpen.length === 1 ? '' : 's') + ' to close out', sev: 'amber' });

    (this._pdf || (this._pdf = [])).push({ name: 'Events', activity: this._didPlain(did),
      results: 'Booked ' + ED._money(st.bookedRev) + ', Pipeline ' + ED._money(st.pipeline) + ', Deposits Due ' + ED._money(st.depositsDue) + ', Win Rate ' + st.conv,
      open: open.length ? open.map(o => this._stripTags(o.t)).join('; ') : 'Nothing open' });
    return this._sectionCard('Events', [
      { label: 'Done This Week', html: activity },
      { label: 'What It Turned Up &middot; Current Pipeline', html: results },
      { label: 'Carrying Into Next Week', html: this._openList(open) }
    ]);
  },

  // ── Books (monthly close) ───────────────────────────────────────────────────
  _booksSection() {
    const BH = S.HubBooksHome;
    if (!BH) return '';
    if (!((App.data && App.data.weeks) || []).length) return null;

    /* ⛔⛔⛔ THE FIGURES BELONG TO THE REVIEWED WEEK'S OWN MONTH, AND THEY USED TO BELONG TO JULY.
       Kyle, 2026-08-11: *"what it turned up is i assuming still listing july numbers.. when the week
       showing is the 1st week of august review.. and why would it say nothing left to close on the
       month if it is the first week of the month? that card makes no sense."*
       MEASURED on the shipped build, reviewing Aug 3-9: `basisKey` was **2026-07**, `monthName` was
       **"July 2026"**, and the card printed July's $75,323 and $9,040.24 under a heading reading
       "MONTH + YTD" — having computed that month name and then never shown it.
       ⭐ THE CAUSE IS A GOOD QUESTION ASKED ON THE WRONG PAGE. `BH._computeState` answers "the last
       SETTLED month", which is exactly right for the Books cockpit, whose job is closing a month you
       can actually close. A recap of a week in August has to answer about August or say nothing.
       ⚠ AND A PART-MONTH IS NOT AN ANSWER EITHER: August so far is `netRev 38,430 / opInc -5,584`,
       negative because every bill is in and only two weeks of revenue are. So the band shows the
       month's figures ONLY once that month is settled, and says so plainly until then. */
    const HB = S.HubBooks;
    /* The week's month is its `period_end` month. That is this codebase's own definition of which
       week a record belongs to — `confirm-week` stamps `period_end`, `_weekMoney` matches on it —
       so a week straddling a boundary lands where the rest of the app already puts it. */
    const mKey = this._wkE().slice(0, 7);
    const nowKey = App.todayLocal().slice(0, 7);
    /* ⚠ BOTH HALVES, AND THE SECOND ONE IS NOT OPTIONAL. `_weeksComplete('2026-08')` returns
       `complete: true` on the 11th — it only means "no GAPS among the weeks that exist", not "the
       month is over". Measured. Same pair `_basisKey` uses, read rather than reinvented. */
    const wc = (HB && HB._weeksComplete) ? (HB._weeksComplete(mKey) || {}) : {};
    const settled = !!(mKey < nowKey && wc.complete);
    const mLabel = (HB && HB._monthLabel) ? HB._monthLabel(mKey) : mKey;
    const P  = (HB && HB._plParts) ? HB._plParts(mKey, false) : null;
    const PY = (HB && HB._plParts) ? HB._plParts(mKey, true)  : null;
    const mRev = P ? P.netRev : null, mInc = P ? P.opInc : null;
    const yNet = PY ? PY.netRev : null, yInc = PY ? PY.opInc : null;
    const yMargin = (yNet) ? yInc / yNet : null;

    /* ⛔ BILLS ARE NOT OUTFLOWS, AND THIS COUNTED ONE DRAW AS BOTH. Since the one-ledger merge
       `operating_expenses` also holds the cash outflows, so an owner draw incremented "Bills
       Logged" here AND "Outflows Logged" on the line below it, side by side on the same card and
       in the PDF. It also suppressed the "no bills logged this month yet" prompt for a month whose
       only row was a draw. */
    const opex = ((App.data && App.data.operating_expenses) || [])
      .filter(r => !S.HubOperatingExpenses.isCashOnlyCategory(r && r.category));
    const billRows = opex.filter(r => r && this._inWeek(r.date));
    const billsWk = billRows.length;
    // ⭐ THE LEDGER, through the engine's own reader, so this count and the forecast can never be
    // counting two different sets of records (the cutover — see CashEngine.cashOutflows).
    const outRows = (CashEngine.cashOutflows() || []).filter(o => this._inWeek(o.date || o.created_at));
    const outflowWk = outRows.length;
    const billsMonth = opex.filter(r => r && String(r.date || '').slice(0, 7) === mKey).length;
    const rawRun = key => { try { return localStorage.getItem(key); } catch (e) { return null; } };
    const pnlRun = rawRun('books_report_run_weeklypnl');
    const meRun  = rawRun('books_report_run_monthend');
    const reportsWk = (pnlRun && this._inWeek(String(pnlRun).slice(0, 10)) ? 1 : 0) + (meRun && this._inWeek(String(meRun).slice(0, 10)) ? 1 : 0);

    /* ⛔⛔ THE STEP LIST IS GONE, AND WITH IT THE DRIFT IT KEPT CAUSING. It was hand-copied and had
       already drifted twice — Kyle spotted the second: *"the week review 4 steps don't match books
       now."* Deriving it from `BH.ORDER` fixed the drift and left the real defect standing, which is
       that the whole band counted checkboxes. There is nothing left here to keep in step. */
    const did = [];
    if (billsWk) {
      const tot = billRows.reduce((t, r) => t + (Number(r.amount) || 0), 0);
      const top = this._topOf(billRows, r => Number(r.amount) || 0) || (billsWk === 1 ? billRows[0] : null);
      did.push(this._n(billsWk + ' ' + this._plu(billsWk, 'bill')) + ' logged, ' + this._m0(tot) + '.'
        + (top && this._nm(top.vendor || top.category) ? ' Largest ' + this._nm(top.vendor || top.category)
            + ' ' + this._m0(top.amount) + '.' : ''));
    }
    if (outflowWk) did.push(this._n(outflowWk + ' cash ' + this._plu(outflowWk, 'outflow')) + ' logged, '
      + this._m0(outRows.reduce((t, o) => t + (Number(o.amount) || 0), 0)) + '.');
    if (reportsWk) did.push(this._n(reportsWk + ' ' + this._plu(reportsWk, 'report')) + ' run.');
    const activity = this._didList(did);
    /* Once the month is closed the figures are real and they say WHICH month, out loud, in the band
       label. Until then the band holds the sentence rather than a number, which is what Kyle asked
       for: *"once books are closed what it turned up stats will show here."* */
    const results = settled
      ? this._resRow([
          this._res('Op Income YTD', BH._money(yInc), yInc < 0 ? 'var(--red)' : 'var(--t1)'),
          this._res('Margin', BH._pct(yMargin)),
          this._res('Month Revenue', BH._money(mRev)),
          this._res('Month Income', BH._money(mInc), mInc < 0 ? 'var(--red)' : 'var(--t1)')
        ])
      : this._didRow(esc(mLabel) + ' is still open. Its figures show here once the month-end books are closed.');

    /* ⛔ "<Month> books not closed yet" is GONE: its only evidence was the `generate` tick, and
       nothing durable records that the month-end pack was produced (the localStorage stamp is the
       run DATE, not the month it covers, so it cannot answer the question). The two items that
       survive are both records: the month's bill rows, and the permit dates. */
    /* ⛔⛔ PERMITS ARE NOT BOOKS' ANY MORE, AND THIS CARD WAS THE LAST PLACE SAYING THEY WERE. Kyle,
       2026-08-11: *"books has to close and 3 permits listed.. but permits are not in books
       anymore."* He is right and the source says so out loud: `hub-books-home.js` carries the note
       *"the tracker in Shift Control"*, and `app.js` registers the screen as `'sc-licensing':
       S.HubPermits` — a SHIFT screen. `BH._computeState` still computes `dueCount`/`expiredCt` for
       its own day-one step, so the number was real; it was filed under the wrong section.
       ⭐ THE FINDING IS NOT LOST, IT MOVED to the Shift card, which is where the tracker lives and
       where the door goes. Reporting an expired permit under Books and nowhere else would have been
       the worse of the two fixes. */
    /* ⭐ A STANDING DIRECTIVE, NOT AN ALERT (Kyle: *"would be a good place just to put a simple
       directive... simple gives them a nice directive to remember to do it"*). It is rendered as a
       plain row, deliberately: the dotted amber pills on every other card mean "something is wrong
       here", and a monthly routine is not a finding. Once the month IS settled the band goes back to
       reporting, and the only thing it can report is a month that never got a bill in it. */
    const open = [];
    if (settled && billsMonth === 0) open.push({ t: 'No bills were ever logged for ' + esc(mLabel), sev: 'amber' });
    const toClose = settled
      ? this._openList(open, 'Nothing left to close on ' + esc(mLabel) + '.')
      : this._didRow('Get all your bills and cash outflows in before the month ends, then close the month-end books.');

    (this._pdf || (this._pdf = [])).push({ name: 'Books', activity: this._didPlain(did),
      results: settled
        ? 'Op Income YTD ' + BH._money(yInc) + ', Margin ' + BH._pct(yMargin) + ', ' + mLabel + ' Revenue ' + BH._money(mRev) + ', ' + mLabel + ' Income ' + BH._money(mInc)
        : mLabel + ' is still open, so its figures are not in yet.',
      open: this._stripTags(this._tidy(toClose)) });
    return this._sectionCard('Books', [
      { label: 'Done This Week', html: activity },
      { label: settled ? 'What It Turned Up &middot; ' + esc(mLabel) : 'What It Turned Up', html: results },
      { label: 'To Close', html: toClose }
    ]);
  },

  render(mount) {
    if (App.setHubTopbarActions) App.setHubTopbarActions('');
    // ⛔ THE SEED IS THE REAL DECISION — see `_defaultMonday`. This line is what actually decides
    // where the page opens, and pointing it at `_monday()` is what made the first attempt inert.
    if (this._wkStart == null) this._wkStart = this._defaultMonday();

    /* ⛔ THE EMPTY STATE IS A DOOR, AND IT POINTED AT A COCKPIT. This was the seventh cockpit
       reference in the file and the only one an operator can actually press, because it is the one
       thing that renders on day one. It names the two real first jobs instead, both survivors. */
    const products = ((App.inventoryData && App.inventoryData.ic_products) || []).filter(p => p.active !== false);
    const counts = (App.inventoryData && App.inventoryData.ic_counts) || [];
    if (!products.length || !counts.length) {
      App.setupCard(mount, {
        title: 'Week in Review',
        lead: 'Week in Review recaps a week that has finished: what your team logged in each section, what it turned up, and what carried over. It reads your real records, so there is nothing here until a week has been worked.',
        steps: [
          /* ⛔ THE BUTTON NAMES THE PAGE IT OPENS. Kyle, 2026-08-11: *"you have the 'add products'
             button going to the list vendors page... the button has to match the page."* I took the
             destination from the Hub's Get Started chip, which points at `ic-vendors` for its own
             reasons, and wrote a products label over it. `app.js`'s title table settles it:
             `ic-product-setup` is titled "Add Products" and `ic-vendors` is "List Vendors".
             ⚠ AND THE DESCRIPTION WAS OVER-CLAIMING TOO. It said "Vendors first", which is not a
             requirement: `vendor` is `required:false` on the product intake, so a product saves with
             no vendor on it. A step that invents a prerequisite sends an operator on an errand. */
          { title: 'Add your products', desc: 'What you buy and what it costs.', btn: 'Add Products', screen: 'ic-product-setup', done: products.length > 0 },
          { title: 'Take a count', desc: 'Count your stock. Once a week has been worked, it reads back here the following week.', btn: 'Take Inventory', screen: 'ic-take-inventory', done: counts.length > 0 }
        ]
      });
      return;
    }

    // ── Week selector (standard buttoned arrows + pill + This Week) ─────────────
    const fmt = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(); };
    const range = fmt(this._wkS()) + ' - ' + fmt(this._wkE());
    // ⛔ The forward arrow stops at the week that ENDED. There is no way to reach the live week.
    const atLatest = this._atLatest();
    const prevBtn = '<button class="btn btn-ghost btn-sm wr-arrow" data-step="-7" aria-label="Previous week" style="margin:0;padding:3px 9px;">&lsaquo;</button>';
    const nextBtn = atLatest
      ? '<span style="padding:3px 9px;color:var(--t4);font-size:15px;line-height:1;">&rsaquo;</span>'
      : '<button class="btn btn-ghost btn-sm wr-arrow" data-step="7" aria-label="Next week" style="margin:0;padding:3px 9px;">&rsaquo;</button>';
    const pill = '<span style="display:inline-flex;align-items:center;border:1px solid var(--b-edge);background:var(--sel-active-bg);border-radius:7px;padding:5px 14px;font-size:12px;font-weight:800;letter-spacing:0.5px;color:var(--t1);white-space:nowrap;">'
      + esc(range) + (atLatest ? '<span style="color:var(--gold);font-weight:800;font-size:11px;margin-left:6px;">LAST WEEK</span>' : '') + '</span>';
    const nowBtn = atLatest ? '' : '<button class="btn btn-ghost btn-sm wr-now" style="margin-left:4px;">Last Week</button>';
    const exportBtn = '<button class="btn btn-ghost btn-sm no-print" id="wr-export">Export PDF</button>';
    const selectorRow = '<div class="no-print" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 10px;">'
      + '<div style="display:inline-flex;align-items:center;gap:8px;">' + prevBtn + pill + nextBtn + nowBtn + '</div>'
      + exportBtn + '</div>';

    this._pdf = [];   // section payloads, collected as each section builds, for the PDF
    const sections = [this._inventorySection(), this._laborSection(), this._shiftSection(), this._profitSection(), this._revenueSection(), this._cashSection(), this._eventsSection(), this._booksSection()].filter(Boolean).join('');

    mount.innerHTML = '<div class="screen wr-screen">'
      + this._topCard()
      + selectorRow
      + '<div class="wr-grid">' + sections + '</div>'
      + '</div>';

    mount.querySelectorAll('.wr-arrow').forEach(a =>
      a.addEventListener('click', () => this._step(parseInt(a.dataset.step, 10))));
    mount.querySelector('.wr-now')?.addEventListener('click', () => { this._wkStart = this._maxMonday(); this.render(mount); });
    document.getElementById('wr-export')?.addEventListener('click', () => this._exportPDF());
  },

  _stripTags(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, ''); },
  // The written band, flattened for the export. Same sentences, no markup.
  _didPlain(lines) {
    const rows = (lines || []).filter(Boolean).map(l => this._tidy(this._stripTags(l)));
    return rows.length ? rows.join(' ') : 'Nothing logged this week.';
  },

  // Data-driven PDF built from the per-section payloads collected during render.
  async _exportPDF() {
    try { await App._ensurePDFLib(); }
    catch (e) { alert('Could not load the PDF engine. Check your connection and try again.'); return; }
    const m = this._weekMoney();
    const pctv = v => (v != null && !isNaN(v)) ? (Number(v).toFixed(1) + '%') : '-';
    const fmt = ymd => { const d = new Date(ymd + 'T00:00:00'); return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
    const range = fmt(this._wkS()) + ' - ' + fmt(this._wkE());
    const b = App._pdfBuilder('Week in Review', {});
    b.header({ right: 'Week in Review', meta: range });
    // The same fact on the artefact that leaves the building: a blank Net Sales on paper, with no
    // explanation, is the identical ambiguity the screen had (step 0.6 — the PDF is the second
    // consumer, and it is the one an accountant reads without the app in front of them).
    if (!m.confirmed) b.paragraph('This week was never confirmed, so the sales and cost figures below stayed blank. The section notes show what was logged.', { gray: 70 });
    b.kv('Net Sales', m.netSales != null ? App.fmtCurrency(m.netSales, 0) : '-');
    b.kv('Prime Cost', pctv(m.prime));
    b.kv('Labor', pctv(m.laborPct));
    // Same three bands as the screen, in the same order. The paper and the page say one thing.
    (this._pdf || []).forEach(s => {
      b.sectionTitle(s.name);
      if (s.activity) b.paragraph('Done this week: ' + s.activity, { gray: 70 });
      b.paragraph('What it turned up: ' + s.results, { gray: 70 });
      b.paragraph('Carrying over: ' + s.open, { gray: 70 });
    });
    /* ⛔ NAME IT FOR THE WEEK IT REVIEWS, NOT THE DAY IT WAS RUN. With no period this fell back
       to today, so three different weeks exported as one filename and each overwrote the last in
       the downloads folder — the same defect the Weekly P&L Brief had (B5). The week is right
       here in _wkS/_wkE. */
    await b.save(App.pdfFileName('Week in Review', this._wkS() + ' to ' + this._wkE()));
  }
  /* ⛔ `showHowTo` IS GONE, AND IT HAD NO CALLER. Hub pages take their help from the topic table in
     `app.js` keyed by the action passed to `openHubFullPage` ([[help-model]]), so the "i" on this
     page has always opened `App._HUB_HELP['week-review']` and never this. It sat here describing
     step ticks and a NOW marker that no longer exist — a stale how-to reads as a spec to the next
     person who opens the file. The live topic is updated in the same edit ([[the-loop]] #61:
     retiring something is three greps, and the help is the one nobody does). */
};
